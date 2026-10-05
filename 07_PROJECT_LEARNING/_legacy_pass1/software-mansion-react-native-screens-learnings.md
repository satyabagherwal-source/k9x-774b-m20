# Forensic Learning Record (Deep Inspection): software-mansion/react-native-screens

> **Canonical Artifact**: `07_PROJECT_LEARNING/software-mansion-react-native-screens-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/software-mansion/react-native-screens](https://github.com/software-mansion/react-native-screens))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T17:46:28.844Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `software-mansion/react-native-screens`
- **Description**: Native navigation primitives for your React Native app.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3732 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/common/ShadowStateProxy.kt`
```
package com.swmansion.rnscreens.common

import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.uimanager.StateWrapper
import com.swmansion.rnscreens.utils.pxToDp
import kotlin.math.abs

internal class ShadowStateProxy(
    private val includesFrameSize: Boolean = true,
) {
    internal var stateWrapper: StateWrapper? = null

    private var lastFrameWidthInDp: Float = 0f
    private var lastFrameHeightInDp: Float = 0f
    private var lastContentOffsetXInDp: Float = 0f
    private var lastContentOffsetYInDp: Float = 0f

    fun updateStateIfNeeded(
        // The display density is supplied per call (not captured once) so it stays correct
        // when the owning view moves between displays of differing density. See pxToDp / #4159.
        density: Float,
        frameWidth: Int? = null,
        frameHeight: Int? = null,
        contentOffsetX: Int? = null,
        contentOffsetY: Int? = null,
    ) {
        val widthInDp = frameWidth?.let { pxToDp(it.toFloat(), density) } ?: lastFrameWidthInDp
        val heightInDp = frameHeight?.let { pxToDp(it.toFloat(), density) } ?: lastFrameHeightInDp
        val offsetXInDp = contentOffsetX?.let { pxToDp(it.toFloat(), density) } ?: lastContentOffsetXInDp
        val offsetYInDp = contentOffsetY?.let { pxToDp(it.toFloat(), density) } ?: lastContentOffsetYInDp

        if (
            abs(lastFrameWidthInDp - widthInDp) < DELTA &&
            abs(lastFrameHeightInDp - heightInDp) < DELTA &&
            abs(lastContentOffsetXInDp - offsetXInDp) < DELTA &&
            abs(lastContentOffsetYInDp - offsetYInDp) < DELTA
        ) {
            return
        }

        lastFrameWidthInDp = widthInDp
        lastFrameHeightInDp = heightInDp
        lastContentOffsetXInDp = offsetXInDp
        lastContentOffsetYInDp = offsetYInDp

        val map =
            WritableNativeMap().apply {
                if (includesFrameSize) {
                    putDouble("frameWidth", widthInDp.toDouble())
                    putDouble("frameHeight", heightInDp.toDouble())
                }
                putDouble("contentOffsetX", offsetXInDp.toDouble())
                putDouble("contentOffsetY", offsetYInDp.toDouble())
            }
        stateWrapper?.updateState(map)
    }

    companion object {
        private const val DELTA = 0.1f
    }
}

```

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/common/container/ContainerUtils.kt`
```
package com.swmansion.rnscreens.common.container

import android.view.ViewGroup

internal fun findParentContainerItem(searchStartPoint: ViewGroup): ContainerItem? {
    var currView = searchStartPoint.parent

    while (currView != null) {
        if (currView is ContainerItem) {
            return currView
        }
        currView = currView.parent
    }
    return null
}

internal fun registerWithParentContainerItem(
    container: Container,
    searchStartPoint: ViewGroup,
): ContainerItem? =
    findParentContainerItem(searchStartPoint)?.let {
        it.registerNestedContainer(container)
        it
    }

internal fun unregisterFromParentContainerItem(
    parentContainerItem: ContainerItem?,
    childContainer: Container,
) {
    parentContainerItem?.unregisterNestedContainer(childContainer)
}

```

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/legacy/LifecycleHelper.kt`
```
package com.swmansion.rnscreens.legacy

import android.view.View
import androidx.fragment.app.Fragment
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleObserver

class LifecycleHelper {
    private val mViewToLifecycleMap: MutableMap<View, Lifecycle> = HashMap()
    private val mRegisterOnLayoutChange: View.OnLayoutChangeListener =
        object : View.OnLayoutChangeListener {
            override fun onLayoutChange(
                view: View,
                i: Int,
                i1: Int,
                i2: Int,
                i3: Int,
                i4: Int,
                i5: Int,
                i6: Int,
                i7: Int,
            ) {
                registerViewWithLifecycleOwner(view)
                view.removeOnLayoutChangeListener(this)
            }
        }

    private fun registerViewWithLifecycleOwner(view: View) {
        val parent = findNearestScreenFragmentAncestor(view)
        if (parent != null && view is LifecycleObserver) {
            val lifecycle = parent.lifecycle
            lifecycle.addObserver((view as LifecycleObserver))
            mViewToLifecycleMap[view] = lifecycle
        }
    }

    fun <T> register(view: T) where T : View, T : LifecycleObserver? {
        // we need to wait until view is mounted in the hierarchy as this method is called only at the
        // moment of the view creation. In order to register lifecycle observer we need to find ancestor
        // of type Screen and this can only happen when the view is properly attached. We rely on
        // Android's onLayout callback being triggered when the view gets added to the hierarchy and
        // only then we attempt to locate lifecycle owner ancestor.
        view.addOnLayoutChangeListener(mRegisterOnLayoutChange)
    }

    fun <T> unregister(view: T) where T : View, T : LifecycleObserver? {
        mViewToLifecycleMap[view]?.removeObserver(view)
    }

    companion object {
        fun findNearestScreenFragmentAncestor(view: View): Fragment? {
            var parent = view.parent
            while (parent != null && parent !is Screen) {
                parent = parent.parent
            }
            return if (parent != null) {
                (parent as Screen).fragment
            } else {
                null
            }
        }
    }
}

```

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/legacy/bottomsheet/SheetUtils.kt`
```
package com.swmansion.rnscreens.legacy.bottomsheet

import android.view.View
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetBehavior.STATE_COLLAPSED
import com.google.android.material.bottomsheet.BottomSheetBehavior.STATE_EXPANDED
import com.google.android.material.bottomsheet.BottomSheetBehavior.STATE_HALF_EXPANDED
import com.google.android.material.bottomsheet.BottomSheetBehavior.STATE_HIDDEN
import com.swmansion.rnscreens.legacy.Screen
import com.swmansion.rnscreens.legacy.ext.asScreenStackFragment

object SheetUtils {
    /**
     * Verifies whether BottomSheetBehavior.State is one of stable states. As unstable states
     * we consider `STATE_DRAGGING` and `STATE_SETTLING`.
     *
     * @param state bottom sheet state to verify
     */
    fun isStateStable(state: Int): Boolean =
        when (state) {
            STATE_HIDDEN,
            STATE_EXPANDED,
            STATE_COLLAPSED,
            STATE_HALF_EXPANDED,
            -> true

            else -> false
        }

    /**
     * This method maps indices from legal detents array (prop) to appropriate values
     * recognized by BottomSheetBehaviour. In particular used when setting up the initial behaviour
     * of the form sheet.
     *
     * @param index index from array with detents fractions
     * @param detentCount length of array with detents fractions
     *
     * @throws IllegalArgumentException for invalid index / detentCount combinations
     */
    fun sheetStateFromDetentIndex(
        index: Int,
        detentCount: Int,
    ): Int =
        when (detentCount) {
            1 ->
                when (index) {
                    -1 -> STATE_HIDDEN
                    0 -> STATE_EXPANDED
                    else -> throw IllegalArgumentException("[RNScreens] Invalid detentCount/index combination $detentCount / $index")
                }

            2 ->
                when (index) {
                    -1 -> STATE_HIDDEN
                    0 -> STATE_COLLAPSED
                    1 -> STATE_EXPANDED
                    else -> throw IllegalArgumentException("[RNScreens] Invalid detentCount/index combination $detentCount / $index")
                }

            3 ->
                when (index) {
                    -1 -> STATE_HIDDEN
                    0 -> STATE_COLLAPSED
                    1 -> STATE_HALF_EXPANDED
                    2 -> STATE_EXPANDED
                    else -> throw IllegalArgumentException("[RNScreens] Invalid detentCount/index combination $detentCount / $index")
                }

            else -> throw IllegalArgumentException("[RNScreens] Invalid detentCount/index combination $detentCount / $index")
        }

    /**
     * This method maps BottomSheetBehavior.State values to appropriate indices of detents array.
     *
     * @param state state of the bottom sheet
     * @param detentCount length of array with detents fractions
     *
     * @throws IllegalArgumentException for invalid state / detentCount combinations
     */
    fun detentIndexFromSheetState(
        @BottomSheetBehavior.State state: Int,
        detentCount: Int,
    ): Int =
        when (detentCount) {
            1 ->
                when (state) {
                    STATE_HIDDEN -> -1
                    STATE_EXPANDED -> 0
                    else -> throw IllegalArgumentException("[RNScreens] Invalid state $state for detentCount $detentCount")
                }

            2 ->
                when (state) {
                    STATE_HIDDEN -> -1
                    STATE_COLLAPSED -> 0
                    STATE_EXPANDED -> 1
                    else -> throw IllegalArgumentException("[RNScreens] Invalid state $state for detentCount $detentCount")
                }

            3 ->
                when (state) {
                    STATE_HIDDEN -> -1
                    STATE_COLLAPSED -> 0
                    STATE_HALF_EXPANDED -> 1
                    STATE_EXPANDED -> 2
                    else -> throw IllegalArgumentException("[RNScreens] Invalid state $state for detentCount $detentCount")
                }

            else -> throw IllegalArgumentException("[RNScreens] Invalid state $state for detentCount $detentCount")
        }

    fun isStateLessEqualThan(
        state: Int,
        otherState: Int,
    ): Boolean {
        if (state == otherState) {
            return true
        }
        if (state != STATE_HALF_EXPANDED && otherState != STATE_HALF_EXPANDED) {
            return state > otherState
        }
        if (state == STATE_HALF_EXPANDED) {
            return otherState == STATE_EXPANDED
        }
        if (state == STATE_COLLAPSED) {
            return otherState != STATE_HIDDEN
        }
        return false
    }
}

fun Screen.isSheetFitToContents(): Boolean =
    stackPresentation === Screen.StackPresentation.FORM_SHEET &&
        sheetDetents.count == 1 &&
        sheetDetents.shortest() == SheetDetents.SHEET_FIT_TO_CONTENTS

fun Screen.usesFormSheetPresentation(): Boolean = stackPresentation === Screen.StackPresentation.FORM_SHEET

fun Screen.requiresEnterTransitionPostponing(): Boolean {
    // On Fabric, system insets are applied after the initial layout pass. However,
    // the BottomSheet height might be measured earlier due to internal BottomSheet logic
    // or layout callbacks, before those insets are applied.
    // To ensure the BottomSheet height respects the top inset we delay starting the enter
    // transition until both layout and insets are fully applied.

    return !this.sheetShouldOverflowTopInset && this.usesFormSheetPresentation()
}

fun Screen.sheetShouldUseDimmingView(): Boolean {
    val currentDetentIndex =
        fragment?.asScreenStackFragment()?.sheetDelegate?.lastStableDetentIndex
            ?: sheetInitialDetentIndex
    return currentDetentIndex > sheetLargestUndimmedDetentIndex
}

/**
 * The view might not be laid out, but have cached dimensions e.g. when host fragment
 * is reattached to container.
 */
fun View.isLaidOutOrHasCachedLayout() = this.isLaidOut || height > 0 || width > 0

internal fun Screen.resolveClampedHeight(
    targetHeight: Int,
    currentTranslationY: Float,
): Int {
    val maxAvailableVerticalSpace =
        fragment
            ?.asScreenStackFragment()
            ?.sheetDelegate
            ?.tryResolveMaxFormSheetHeight() ?: return targetHeight

    // Please note that currentTranslationY is rather < 0 here.
    // The translation is included in constraining the available space, because the FormSheet can have some offset, e.g. to
    // avoid the keyboard.
    return targetHeight.coerceAtMost((maxAvailableVerticalSpace + currentTranslationY).toInt())
}

```

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/legacy/utils/DecorViewInsetsUtils.kt`
```
package com.swmansion.rnscreens.legacy.utils

import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * Retrieves the top system inset (such as status bar or display cutout) from the given decor view.
 *
 * @param decorView The top-level window decor view.
 * @return The top inset in pixels.
 */
internal fun getDecorViewTopInset(decorView: View): Int {
    val insetsCompat = ViewCompat.getRootWindowInsets(decorView) ?: return 0

    return getTopInset(insetsCompat)
}

private fun getTopInset(insetsCompat: WindowInsetsCompat): Int =
    insetsCompat
        .getInsets(
            WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout(),
        ).top

internal fun isSoftKeyboardVisibleOrNull(decorView: View): Boolean? {
    val insetsCompat = ViewCompat.getRootWindowInsets(decorView) ?: return null

    return insetsCompat
        .isVisible(
            WindowInsetsCompat.Type.ime(),
        )
}

```

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/legacy/utils/DeviceUtils.kt`
```
package com.swmansion.rnscreens.legacy.utils

import android.content.Context
import android.content.pm.PackageManager

object DeviceUtils {
    fun isPlatformAndroidTV(context: Context?): Boolean =
        context?.packageManager?.hasSystemFeature(
            PackageManager.FEATURE_LEANBACK,
        ) == true
}

```

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/legacy/utils/FragmentTransactionKt.kt`
```
package com.swmansion.rnscreens.legacy.utils

import androidx.fragment.app.FragmentTransaction
import com.swmansion.rnscreens.R
import com.swmansion.rnscreens.legacy.Screen.StackAnimation

internal fun FragmentTransaction.setTweenAnimations(
    stackAnimation: StackAnimation,
    shouldUseOpenAnimation: Boolean,
) {
    if (shouldUseOpenAnimation) {
        when (stackAnimation) {
            StackAnimation.DEFAULT ->
                this.setCustomAnimations(
                    R.anim.rns_default_enter_in,
                    R.anim.rns_default_enter_out,
                )

            StackAnimation.NONE ->
                this.setCustomAnimations(
                    R.anim.rns_no_animation_20,
                    R.anim.rns_no_animation_20,
                )

            StackAnimation.FADE ->
                this.setCustomAnimations(
                    R.anim.rns_fade_in,
                    R.anim.rns_fade_out,
                )

            StackAnimation.SLIDE_FROM_RIGHT ->
                this.setCustomAnimations(
                    R.anim.rns_slide_in_from_right,
                    R.anim.rns_slide_out_to_left,
                )
            StackAnimation.SLIDE_FROM_LEFT ->
                this.setCustomAnimations(
                    R.anim.rns_slide_in_from_left,
                    R.anim.rns_slide_out_to_right,
                )
            StackAnimation.SLIDE_FROM_BOTTOM ->
                this.setCustomAnimations(
                    R.anim.rns_slide_in_from_bottom,
                    R.anim.rns_no_animation_medium,
                )
            StackAnimation.FADE_FROM_BOTTOM -> this.setCustomAnimations(R.anim.rns_fade_from_bottom, R.anim.rns_no_animation_350)
            StackAnimation.IOS_FROM_RIGHT ->
                this.setCustomAnimations(
                    R.anim.rns_ios_from_right_foreground_open,
                    R.anim.rns_ios_from_right_background_open,
                )
            StackAnimation.IOS_FROM_LEFT ->
                this.setCustomAnimations(
                    R.anim.rns_ios_from_left_foreground_open,
                    R.anim.rns_ios_from_left_background_open,
                )
        }
    } else {
        when (stackAnimation) {
            StackAnimation.DEFAULT ->
                this.setCustomAnimations(
                    R.anim.rns_default_exit_in,
                    R.anim.rns_default_exit_out,
                )

            StackAnimation.NONE ->
                this.setCustomAnimations(
                    R.anim.rns_no_animation_20,
                    R.anim.rns_no_animation_20,
                )

            StackAnimation.FADE ->
                this.setCustomAnimations(
                    R.anim.rns_fade_in,
                    R.anim.rns_fade_out,
                )

            StackAnimation.SLIDE_FROM_RIGHT ->
                this.setCustomAnimations(
                    R.anim.rns_slide_in_from_left,
                    R.anim.rns_slide_out_to_right,
                )
            StackAnimation.SLIDE_FROM_LEFT ->
                this.setCustomAnimations(
                    R.anim.rns_slide_in_from_right,
                    R.anim.rns_slide_out_to_left,
                )
            StackAnimation.SLIDE_FROM_BOTTOM ->
                this.setCustomAnimations(
                    R.anim.rns_no_animation_medium,
                    R.anim.rns_slide_out_to_bottom,
                )
            StackAnimation.FADE_FROM_BOTTOM -> this.setCustomAnimations(R.anim.rns_no_animation_250, R.anim.rns_fade_to_bottom)
            StackAnimation.IOS_FROM_RIGHT ->
                this.setCustomAnimations(
                    R.anim.rns_ios_from_right_background_close,
                    R.anim.rns_ios_from_right_foreground_close,
                )
            StackAnimation.IOS_FROM_LEFT ->
                this.setCustomAnimations(
                    R.anim.rns_ios_from_left_background_close,
                    R.anim.rns_ios_from_left_foreground_close,
                )
        }
    }
}

```

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/legacy/utils/InsetsKt.kt`
```
package com.swmansion.rnscreens.legacy.utils

import android.view.View
import android.view.WindowInsets
import androidx.core.view.WindowInsetsCompat

typealias InsetsCompat = androidx.core.graphics.Insets
typealias InsetsPlatform = android.graphics.Insets // Available since SDK 29

/**
 * Meaningful value is available only in case the receiver is attached to window.
 * Otherwise returns zero-insets.
 *
 * By default this method relies on `rootWindowInsets` of a view. Set `sourceWindowInsets` to change that.
 */
internal fun View.resolveInsetsOrZero(
    @WindowInsetsCompat.Type.InsetsType insetType: Int,
    sourceWindowInsets: WindowInsets? = rootWindowInsets,
    ignoreVisibility: Boolean = false,
): InsetsCompat {
    if (sourceWindowInsets == null) {
        return InsetsCompat.NONE
    }

    // We don't use root view-aware WindowInsetsCompat to make sure we get information about display
    // cutout inset being consumed by one of the ancestor views. Refer to WindowInsetsCompat
    // `Impl20` implementation of getInsetsForType (case Type.DISPLAY_CUTOUT).
    val windowInsetsCompat = WindowInsetsCompat.toWindowInsetsCompat(sourceWindowInsets)
    return if (!ignoreVisibility) {
        windowInsetsCompat.getInsets(insetType)
    } else {
        windowInsetsCompat.getInsetsIgnoringVisibility(insetType)
    }
}

```

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/legacy/utils/ScreenDummyLayoutHelper.kt`
```
package com.swmansion.rnscreens.legacy.utils

import android.app.Activity
import android.app.Application
import android.content.Context
import android.os.Bundle
import android.util.Log
import android.view.View
import androidx.appcompat.widget.Toolbar
import androidx.coordinatorlayout.widget.CoordinatorLayout
import com.facebook.jni.annotations.DoNotStrip
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.PixelUtil
import com.google.android.material.appbar.AppBarLayout
import com.swmansion.rnscreens.legacy.ScreenStackHeaderConfig
import java.lang.ref.WeakReference

/**
 * This class provides methods to create dummy layout (that mimics Screen setup), and to compute
 * expected header height. It is meant to be accessed from C++ layer via JNI.
 * See https://github.com/software-mansion/react-native-screens/pull/2169
 * for more detailed description of the issue this code solves.
 */
@DoNotStrip
internal class ScreenDummyLayoutHelper(
    reactContext: ReactApplicationContext,
) : LifecycleEventListener {
    // The state required to compute header dimensions. We want this on instance rather than on class
    // for context access & being tied to instance lifetime.
    private var coordinatorLayout: CoordinatorLayout? = null
    private var appBarLayout: AppBarLayout? = null
    private var dummyContentView: View? = null
    private var toolbar: Toolbar? = null
    private var defaultFontSize: Float = 0f
    private var defaultContentInsetStartWithNavigation: Int = 0

    // LRU with size 1
    private var cache: CacheEntry = CacheEntry.EMPTY

    // We do not want to be responsible for the context lifecycle. If it's null, we're fine.
    // This same context is being passed down to our view components so it is destroyed
    // only if our views also are.
    private var reactContextRef: WeakReference<ReactApplicationContext> =
        WeakReference(reactContext)

    // We're relying on the native notification for performing cleanup, rather than relying on ReactNative `onHostDestroy`
    private var activityLifecycleCallbacks: Application.ActivityLifecycleCallbacks? = null

    init {
        // We load the library so that we are able to communicate with our C++ code (descriptor & shadow nodes).
        // Basically we leak this object to C++, as its lifecycle should span throughout whole application
        // lifecycle anyway.
        try {
            System.loadLibrary(LIBRARY_NAME)
        } catch (e: UnsatisfiedLinkError) {
            Log.w(TAG, "[RNScreens] Failed to load $LIBRARY_NAME library.")
        }

        weakInstance = WeakReference(this)
        maybeInitDummyLayoutWithHeader(reactContext)
        // We register as lifecycleEventListener to retry initialization in onHostResume if the
        // activity wasn't yet available. Once initialization succeeds, onHostResume removes this listener
        // from that point on cleanup is handled exclusively by ActivityLifecycleCallbacks registered on the
        // Application. onHostDestroy here acts only as a defensive fallback to unregister in the rare case
        // where init never succeeded and the lifecycleEventListener was therefore never removed.
        reactContext.addLifecycleEventListener(this)
    }

    /**
     * Tries to initialize dummy view hierarchy with CoordinatorLayout, AppBarLayout and dummy View.
     * We utilize this to compute header height (app bar layout height) from C++ layer when its needed.
     *
     * This method might fail in case there is activity attached to the react context.
     *
     * This method is called from various threads!
     *
     * @return boolean whether the layout was initialised or not
     */
    private fun maybeInitDummyLayoutWithHeader(reactContext: ReactApplicationContext): Boolean {
        if (isLayoutInitialized) {
            return true
        }

        // Possible data race here - activity is injected into context on UI thread.
        if (!reactContext.hasCurrentActivity()) {
            return false
        }

        // We need to use activity here, as react context does not have theme attributes required by
        // AppBarLayout attached leading to crash.
        val activity =
            requireNotNull(reactContext.currentActivity) {
                "[RNScreens] Attempt to use context detached from activity. This could happen only due to race-condition."
            }

        synchronized(this) {
            // The layout could have been initialised when this thread waited for access to critical section.
            if (isLayoutInitialized) {
                return true
            }
            initDummyLayoutWithHeader(activity)

            registerActivityLifecycleListener(activity)
        }
        return true
    }

    /**
     * Initialises the dummy layout. This method is **not** thread-safe.
     *
     * @param contextWithTheme this function expects the context to have theme attributes required
     * to initialize the AppBarLayout.
     */
    private fun initDummyLayoutWithHeader(contextWithTheme: Context) {
        val newCoordinatorLayout = CoordinatorLayout(contextWithTheme)

        val newAppBarLayout =
            AppBarLayout(contextWithTheme).apply {
                layoutParams =
                    CoordinatorLayout.LayoutParams(
                        CoordinatorLayout.LayoutParams.MATCH_PARENT,
                        CoordinatorLayout.LayoutParams.WRAP_CONTENT,
                    )
            }

        val newToolbar =
            Toolbar(contextWithTheme).apply {
                title = DEFAULT_HEADER_TITLE
                layoutParams =
                    AppBarLayout
                        .LayoutParams(
                            AppBarLayout.LayoutParams.MATCH_PARENT,
                            AppBarLayout.LayoutParams.WRAP_CONTENT,
                        ).apply { scrollFlags = 0 }
            }

        // We know the title text view will be there, cause we've just set title.
        val titleTextView =
            checkNotNull(ScreenStackHeaderConfig.findTitleTextViewInToolbar(newToolbar)) {
                "[RNScreens] Failed to find TextView in children of Toolbar"
            }
        defaultFontSize = titleTextView.textSize
        defaultContentInsetStartWithNavigation = newToolbar.contentInsetStartWithNavigation

        newAppBarLayout.addView(newToolbar)

        val newDummyContentView =
            View(contextWithTheme).apply {
                layoutParams =
                    CoordinatorLayout.LayoutParams(
                        CoordinatorLayout.LayoutParams.MATCH_PARENT,
                        CoordinatorLayout.LayoutParams.MATCH_PARENT,
                    )
            }

        newCoordinatorLayout.apply {
            addView(newAppBarLayout)
            addView(newDummyContentView)
        }

        coordinatorLayout = newCoordinatorLayout
        appBarLayout = newAppBarLayout
        toolbar = newToolbar
        dummyContentView = newDummyContentView

        isLayoutInitialized = true
    }

    /**
     * Triggers layout pass on dummy view hierarchy, taking into consideration selected
     * ScreenStackHeaderConfig props that might have impact on final header height.
     *
     * It's called from C++ via JNI on a background thread; @Synchronized guards against concurrent `cleanUpViews`
     * running on the main thread (activity lifecycle), which would flip `isLayoutInitialized` and clear
     * the cache while a measurement is in progress.
     *
     * @param fontSize font size value as passed from JS
     * @param isTitleEmpty whether the header title is empty
     * @param applyTopInset whether the native header applies the top inset (mirrors
     * `legacyTopInsetBehavior || consumeTopInset` from [CustomToolbar]). When `false`
     * (e.g. `disableTopInsetApplication`), the top inset must be excluded so the reported
     * header height matches what actually renders.
     * @return header height in dp as consumed by Yoga
     */
    @DoNotStrip
    @Synchronized
    private fun computeDummyLayout(
        fontSize: Int,
        isTitleEmpty: Boolean,
        applyTopInset: Boolean,
    ): Float {
        if (!isLayoutInitialized) {
            val reactContext =
                requireReactContext { "[RNScreens] Context was null-ed before dummy layout was initialized" }
            if (!maybeInitDummyLayoutWithHeader(reactContext)) {
                // This theoretically might happen at Fabric + "bridgefull" combination, due to race condition where `reactContext.currentActivity`
                // is still null at this execution point. We don't wanna crash in such case, thus returning zeroed height.
                Log.e(
                    TAG,
                    "[RNScreens] Failed to late-init layout while computing header height. This is most likely a race-condition-bug in react-native-screens, please file an issue at https://github.com/software-mansion/react-native-screens/issues",
                )
                return 0.0f
            }
        }

        if (cache.hasKey(CacheKey(fontSize, isTitleEmpty, applyTopInset))) {
            return cache.headerHeight
        }

        // components below are always initialized and cleared together.
        val currentCoordinatorLayout = coordinatorLayout
        val currentAppBarLayout = appBarLayout
        val currentToolbar = toolbar
        val currentActivity = reactContextRef.get()?.currentActivity
        if (currentCoordinatorLayout == null || currentAppBarLayout == null || currentToolbar == null || currentActivity == null) {
            return 0.0f
        }

        val topLevelDecorView = currentActivity.window.decorView
        val topInset = if (applyTopInset) getDecorViewTopInset(topLevelDecorView) else 0

        // These dimensions are not accurate, as they do include navigation bar, however
        // it is ok for our purposes
```

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/legacy/utils/ViewBackgroundUtils.kt`
```
package com.swmansion.rnscreens.legacy.utils

import com.facebook.react.uimanager.BackgroundStyleApplicator
import com.facebook.react.views.view.ReactViewGroup

internal fun ReactViewGroup.resolveBackgroundColor(): Int? = BackgroundStyleApplicator.getBackgroundColor(this)

```

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/modals/formsheet/native/core/FormSheetAvailableHeightProvider.kt`
```
package com.swmansion.rnscreens.modals.formsheet.native.core

import android.content.Context
import android.view.View

/**
 * View installed as the first child of the window's `android.R.id.content`, as a sibling
 * of Material's dialog `container` - nothing in Material's hierarchy is moved.
 *
 * Every metric we hand to `BottomSheetBehavior` and the height of [FormSheetContainer] is derived from
 * the height the sheet is measured against. The measure pass is the only point where that height is known
 * *before* the sheet gets measured. `FrameLayout` measures its children in index order, so the provider reports
 * the height right before Material's `container`, the coordinator and the sheet are measured in the same
 * traversal, keeping those values in sync with window resizes, e.g. orientation change.
 */
internal class FormSheetAvailableHeightProvider(
    context: Context,
) : View(context) {
    internal fun interface OnAvailableHeightMeasuredListener {
        /**
         * Invoked at the beginning of every measure pass with the height the sheet is about
         * to be measured against.
         */
        fun onAvailableHeightMeasured(height: Int)
    }

    internal var availableHeightListener: OnAvailableHeightMeasuredListener? = null

    init {
        visibility = INVISIBLE
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    override fun onMeasure(
        widthMeasureSpec: Int,
        heightMeasureSpec: Int,
    ) {
        val height = MeasureSpec.getSize(heightMeasureSpec)
        if (MeasureSpec.getMode(heightMeasureSpec) != MeasureSpec.UNSPECIFIED && height > 0) {
            availableHeightListener?.onAvailableHeightMeasured(height)
        }
        super.onMeasure(widthMeasureSpec, heightMeasureSpec)
    }
}

```

### Core Architecture Module: `android/src/main/java/com/swmansion/rnscreens/modals/formsheet/native/core/FormSheetContainer.kt`
```
package com.swmansion.rnscreens.modals.formsheet.native.core

import android.annotation.SuppressLint
import android.content.Context
import android.view.View
import android.widget.LinearLayout
import com.google.android.material.bottomsheet.BottomSheetDragHandleView

@SuppressLint("ViewConstructor")
class FormSheetContainer(
    context: Context,
    internal val contentView: View,
) : LinearLayout(context) {
    private val grabberView =
        BottomSheetDragHandleView(context).apply {
            layoutParams =
                LayoutParams(
                    LayoutParams.MATCH_PARENT,
                    LayoutParams.WRAP_CONTENT,
                )
            visibility = GONE
        }

    init {
        orientation = VERTICAL

        contentView.layoutParams =
            LayoutParams(
                LayoutParams.MATCH_PARENT,
                0,
                1.0f,
            )

        addView(grabberView)
        addView(contentView)
    }

    internal fun setGrabberVisible(visible: Boolean) {
        grabberView.visibility = if (visible) VISIBLE else GONE
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4788** (2026-10-05): **[Android] `NullPointerException` in `ScreensModule.setupFabric` at cold launch: null cannot be cast to `FabricUIManager`**
  *Symptoms*: ### Description  On Android, with the New Architecture, a cold launch sometimes fails before the first screen with this error (red box in a debug build):  ``` [runtime not ready]: Error: Exception in HostObject::get for prop 'RNSModule': java.lang.NullPointerException: null cannot be cast to non-null type com.facebook.react.fabric.FabricUIManager   at com.swmansion.rnscreens.ScreensModule.setupFabric(ScreensModule.kt:59)   at com.swmansion.rnscreens.ScreensModule.initialize(ScreensModule.kt:54)   at com.facebook.react.internal.turbomodule.core.TurboModuleManager.getOrCreateModule(TurboModuleManager.kt:224)   at com.facebook.react.internal.turbomodule.core.TurboModuleManager.getModule(TurboModuleManager.kt:166)   at com.facebook.react.internal.turbomodule.core.TurboModuleManager.getTurboJavaModule(TurboModuleManager.kt:123)   at com.facebook.jni.NativeRunnable.run(Native Method)   at android.os.Handler.handleCallback(Handler.java:958)   at android.os.Handler.dispatchMessage(Handler.java:99)   at com.facebook.react.bridge.queue.MessageQueueThreadHandler.dispatchMessage(MessageQueueThreadHandler.kt:21)   at android.os.Looper.loopOnce(Looper.java:205)   at android.os.Looper.loop(Looper.java:294) ```  **What we think happens.** `ScreensModule.initialize()` calls `setupFabric()`, which does:  ```kotlin val fabricUIManager =     UIManagerHelper.getUIManager(reactContext, UIManagerType.FABRIC) as FabricUIManager ```  Here JavaScript asks for `RNSModule` on the JS thread while the run
  **Post-Mortem & Fix Analysis**:
  > Hey! 👋   The issue doesn't seem to contain a [minimal reproduction](https://stackoverflow.com/help/minimal-reproducible-example).  Could you provide a [snack](https://snack.expo.dev/) or a link to a GitHub repository under your username that reproduces the problem?
  > Hey, thanks for the report. I believe it to be duplicate of #4699 - therefore I'll close this issue & tag you there. 
  > Okey, thank you!

- **Issue #4783** (2026-10-04): **docs: remove README-Fabric.md**
  *Symptoms*: ## Description  The library supports only the new architecture (Fabric) now, so there's no point keeping a separate Fabric README.  I checked whether any of its content should move into the main `README.md`. None of it needs to:  - "Add latest react-native-screens": trivial. - iOS `bundle install` + `pod install`: standard React Native steps, already covered by `README.md` › Installation › iOS. The `rbenv exec` prefix only fits one particular local setup and doesn't belong in user-facing docs. - Android "no additional steps": says nothing.  The `## Fabric` section in `README.md` also linked to `FabricExample/README.md`. Running FabricExample is already documented in detail in `guides/CONTRIBUTING.md`, which `README.md` › Contributing links to, so that link is dropped too.  Closes software-mansion/react-native-screens-labs#1448  ## Changes  - Removed `README-Fabric.md` - Removed the `## Fabric` section from `README.md`  ## Test plan  Docs-only change. Checked that no references to `README-Fabric` / "Fabric README" remain in the repo (excluding `node_modules` and the `react-navigation` submodule).  ## Checklist  - [ ] Included code example that can be used to test this change. - [ ] For visual changes, included screenshots / GIFs / recordings documenting the change. - [ ] For API changes, updated relevant public types. - [ ] Ensured that CI passes  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/software-mansion/react-native-screens/pull/4783?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  - **Configuration used**: Repository UI - **Review profile**: CHILL - **Plan**: Advanced - **Run ID**: `b60cbde8-37dd-404a-956b-ac53c2873fe3`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files tha

- **Issue #4776** (2026-10-02): **[iOS 27] Transparent native-stack header: scroll edge effect only covers the status bar (bar items aren't counted as edge elements)**
  *Symptoms*: ### Description  On iOS 27, the scroll edge effect under a transparent native-stack header (`headerTransparent: true`) only covers the status bar. Content that scrolls under the header's title and bar buttons stays sharp. On iOS 26.5 the same build blurs and darkens content through the whole header, like a native UIKit/SwiftUI navigation bar.  Side-by-side screenshots (iOS 26.5 expected vs iOS 27.0 actual) are in the first comment: same app build, same JS bundle, same screen, same scroll position.  **What UIKit reports.** Inspecting the top `UIKit.ScrollEdgeEffectView` with lldb on iOS 27:  ``` <ScrollEdgeEffectView.PocketElementModel; alignment: top; elementCount: 1; barInteractionCount: 1; cachedRegion: (0.0, 0.0, 402.0, 116.0)> {     elementsByStyle: systemInset=1;     barInteractions: [ <_UIScrollPocketBarInteraction> ]; } ```  The navigation bar is linked (`barInteractionCount: 1`, attached to the visible `UINavigationBar`), but it contributes no elements: only the status bar inset (`systemInset`) is counted. A native SwiftUI `NavigationStack` on the same iOS 27 simulator reports `elementsByStyle: bar=1, container=1, floating=2, systemInset=1`: the bar and its glass items are elements there, and the blur runs through the whole header.  **What we ruled out:**  - The scroll view does get the configured edge style: `topEdge=<style=soft>`, `adjustedContentInset.top` = bar height. It sits on the first-descendant chain (#4369 doesn't apply). - Not option-dependent: same result
  **Post-Mortem & Fix Analysis**:
  > Hey! 👋   The issue doesn't seem to contain a [minimal reproduction](https://stackoverflow.com/help/minimal-reproducible-example).  Could you provide a [snack](https://snack.expo.dev/) or a link to a GitHub repository under your username that reproduces the problem?
  > Same thing on my end, in my testing the automatically chosen hard edge (new iOS 27 default) correctly covered entire header on someone's device, using `ScrollViewMarker` to force it back to `soft` only covers the status bar
  > Closing: this isn't a react-native-screens bug.  A minimal Expo 57 repro (single native-stack screen, `headerTransparent: true`, `scrollEdgeEffects.top: 'soft'`, long `ScrollView`) built with **Xcode 27 / iOS 27 SDK** gets the full soft edge under the whole header on iOS 27, including with a dark theme, nested stacks and a pushed screen with the back button. Its `PocketElementModel` also reports only `systemInset=1`, so the element counts in the description are not the cause.  The app in the report is built with **Xcode 26.6 / iOS 26.5 SDK**. On the iOS 27 runtime that binary gets the reduced soft edge; on iOS 26.5 it's fine. So the difference comes from the SDK the app is linked against, and building with the iOS 27 SDK (which on SDK 57 needs `expo-build-properties` `ios.enableSceneSupport`, see https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md) is the fix.  Sorry for the noise, and thanks for #4369's pointers.

- **Issue #4766** (2026-10-01): **chore(deps): bump brace-expansion from 1.1.18 to 1.1.21 in /docs**
  *Symptoms*: Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion) from 1.1.18 to 1.1.21. <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/juliangruber/brace-expansion/commit/8e81e187b6e9c6c723d16c042657c00acefc2483"><code>8e81e18</code></a> 1.1.21</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/ffdfa3e3806bed17c0874b8f1439b084de354a7e"><code>ffdfa3e</code></a> Merge commit from fork</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/c6513ad31e08edb56dc414a629e39cba724b7548"><code>c6513ad</code></a> 1.1.20</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/1efee7c397c191da6287a78ec19512476a966a7b"><code>1efee7c</code></a> Merge commit from fork</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/a34340a053abb475cc226aeb3f71887018e71bd0"><code>a34340a</code></a> 1.1.19</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/0bcbfc0a5928c3073d48f42999d1ce4fc1c42fbc"><code>0bcbfc0</code></a> Merge commit from fork</li> <li>See full diff in <a href="https://github.com/juliangruber/brace-expansion/compare/v1.1.18...v1.1.21">compare view</a></li> </ul> </details> <br />   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=brace-expansion&package-manager=npm_and_yarn&previous-version=1.1.18&new-version=1.1.21)](https://docs.github.com/en/github/managing-security-vulnerabilities/abo
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- This is an auto-generated comment: skip review by coderabbit.ai -->  > [!IMPORTANT] > ## Review skipped >  > Bot user detected. >  > To trigger a single review, invoke the `@coderabbitai review` command. >  > <details> > <summary>⚙️ Run configuration</summary> >  > **Configuration used**: Repository UI >  > **Review profile**: CHILL >  > **Plan**: Advanced >  > **Run ID**: `e17c2af3-8f81-47e4-bf58-3b5bbd97d213` >  > </details> >  > You can disable this status message by setting the `reviews.review_status` to `false` in the CodeRabbit configuration file. >  > Use the checkbox below for a quick retry: > - [ ] <!-- {"checkboxId":"e9bb8d72-00e8-4f67-9cb2-caf3b22574fe"} --> 🔍 Trigger review  <!-- end of auto-generated comment: skip review by coderabbit.ai -->  <!-- autopilot:start --> - [ ] <!-- {"checkboxId":"2708ad07-9f24-4260-9c11-7dc76a49f2e3"} --> <strong title="Keep fixing CodeRabbit findings and required CI,

- **Issue #4765** (2026-10-01): **chore(deps): bump vm2 from 3.11.6 to 3.12.2**
  *Symptoms*: Bumps [vm2](https://github.com/patriksimek/vm2) from 3.11.6 to 3.12.2. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/patriksimek/vm2/releases">vm2's releases</a>.</em></p> <blockquote> <h2>v3.12.2</h2> <p>Three advisories closed, and vm2 can now be shipped by single-file bundlers. Patch release — no API changes, with observable behaviour changes for host buffers and host promises handed to the sandbox (see Upgrade Notes).</p> <h2>What's Changed</h2> <h3>Security fixes</h3> <ul> <li><strong>GHSA-5h3f-q97h-ccvc</strong> — a <code>NodeVM</code> with a custom <code>require.resolve</code> recorded each resolver answer as a raw string prefix, so resolving an allowlisted package authorized every prefix-sharing sibling beside it (<code>.../node_modules/foo</code> authorized <code>.../node_modules/foo2/index.js</code>), and the <code>{module, path}</code> return shape authorized the whole search directory; under the default <code>context: 'host'</code> the sibling's top-level code ran with host authority. Resolver answers are now recorded as boundary-matched base paths (plus exact extension spellings for extension-probed answers), the object shape authorizes only the resolved package's directory, and an authorization is withdrawn again when its load finds nothing.</li> <li><strong>GHSA-2v2p-6j97-cjg9</strong> — a host promise reaching the sandbox through a constructor return (<code>new HostFn()</code>), a host getter or data property, or a 
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- This is an auto-generated comment: skip review by coderabbit.ai -->  > [!IMPORTANT] > ## Review skipped >  > Bot user detected. >  > To trigger a single review, invoke the `@coderabbitai review` command. >  > <details> > <summary>⚙️ Run configuration</summary> >  > **Configuration used**: Repository UI >  > **Review profile**: CHILL >  > **Plan**: Advanced >  > **Run ID**: `6611ef1f-9cfb-4111-a7f2-0444c7a708cc` >  > </details> >  > You can disable this status message by setting the `reviews.review_status` to `false` in the CodeRabbit configuration file. >  > Use the checkbox below for a quick retry: > - [ ] <!-- {"checkboxId":"e9bb8d72-00e8-4f67-9cb2-caf3b22574fe"} --> 🔍 Trigger review  <!-- end of auto-generated comment: skip review by coderabbit.ai -->  <!-- autopilot:start --> - [ ] <!-- {"checkboxId":"2708ad07-9f24-4260-9c11-7dc76a49f2e3"} --> <strong title="Keep fixing CodeRabbit findings and required CI,

- **Issue #4754** (2026-10-01): **chore(deps): bump brace-expansion from 1.1.16 to 1.1.21**
  *Symptoms*: Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion) from 1.1.16 to 1.1.21. <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/juliangruber/brace-expansion/commit/8e81e187b6e9c6c723d16c042657c00acefc2483"><code>8e81e18</code></a> 1.1.21</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/ffdfa3e3806bed17c0874b8f1439b084de354a7e"><code>ffdfa3e</code></a> Merge commit from fork</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/c6513ad31e08edb56dc414a629e39cba724b7548"><code>c6513ad</code></a> 1.1.20</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/1efee7c397c191da6287a78ec19512476a966a7b"><code>1efee7c</code></a> Merge commit from fork</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/a34340a053abb475cc226aeb3f71887018e71bd0"><code>a34340a</code></a> 1.1.19</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/0bcbfc0a5928c3073d48f42999d1ce4fc1c42fbc"><code>0bcbfc0</code></a> Merge commit from fork</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/758fcd6d188a95c2342818519c77b8c06794552b"><code>758fcd6</code></a> 1.1.18</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/27fbeed22b4fdf2c5f732f66bcf84d43f4a26c6e"><code>27fbeed</code></a> Merge commit from fork</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/5c57cc2519dfb067e188b7cb0733fffbd02946bf"><code>5c57cc
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- This is an auto-generated comment: skip review by coderabbit.ai -->  > [!IMPORTANT] > ## Review skipped >  > Bot user detected. >  > To trigger a single review, invoke the `@coderabbitai review` command. >  > <details> > <summary>⚙️ Run configuration</summary> >  > **Configuration used**: Repository UI >  > **Review profile**: CHILL >  > **Plan**: Advanced >  > **Run ID**: `92f91de3-93fa-48f3-beaf-a5f42613799a` >  > </details> >  > You can disable this status message by setting the `reviews.review_status` to `false` in the CodeRabbit configuration file. >  > Use the checkbox below for a quick retry: > - [ ] <!-- {"checkboxId":"e9bb8d72-00e8-4f67-9cb2-caf3b22574fe"} --> 🔍 Trigger review  <!-- end of auto-generated comment: skip review by coderabbit.ai -->  <!-- autopilot:start --> - [ ] <!-- {"checkboxId":"2708ad07-9f24-4260-9c11-7dc76a49f2e3"} --> <strong title="Keep fixing CodeRabbit findings and required CI,

- **Issue #4753** (2026-09-30): **chore: Run formatter for latest clang-format**
  *Symptoms*: ## Description  There are differences in formatting between clang-format 22.x and 23.1.2. Let's sync that.  ## Changes  - ran `yarn format-ios`  ## Before & after - visual documentation  n/a  ## Test plan  n/a  ## Checklist  - [ ] Included code example that can be used to test this change. - [ ] For visual changes, included screenshots / GIFs / recordings documenting the change. - [ ] For API changes, updated relevant public types. - [ ] Ensured that CI passes 
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/software-mansion/react-native-screens/pull/4753?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Repository UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `51daf59b-8b13-42df-8c43-9ec3d75f46c4`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between aed7a287d9e269a3a
  > after discussion -> https://mise.jdx.dev/

- **Issue #4733** (2026-10-01): **fix(Android): always emit warn, error and wtf RNSLog levels**
  *Symptoms*: ## Description  `RNSLog` on Android gates **every** level behind `RNS_DEBUG_LOGGING` (the `rnsDebugLogsEnabled` gradle property, off by default). As a result warnings and errors never reach release builds, nor debug builds of apps that don't opt in.  This PR gates per level instead:  - `w`, `e`, `wtf` — always emitted, - `d`, `i`, `v` — emitted only when `RNS_DEBUG_LOGGING` is enabled (unchanged).  This keeps the intent of #3144 (hiding debug chatter from consumer apps) while not swallowing diagnostics that indicate real problems. It is also a prerequisite for the planned iOS levelled `RNSLog`, which is meant to replace `RCTLogWarn` / `RCTLogError` call sites — those are not gated, and both platforms should follow the same per-level policy. Part of the RFC-1823 (`core` / `react` layers) implementation, task A1.  **Release note:** Android: `RNSLog` warnings and errors are now emitted in release builds.  ## Changes  - `RNSLog.kt`: `w` / `e` / `wtf` (both overloads) call `android.util.Log` directly; `d` / `i` / `v` still go through the flag check. - Added a KDoc on `RNSLog` stating the per-level policy.  Call sites whose behaviour changes (2 in total, no `e` / `wtf` calls exist today):  - `tabs/container/TabsContainer.kt` — `performSelectedTabUpdate` called without a pending request; an invariant violation, not noise. - `legacy/ScreenStackFragment.kt` — `translucent` set on a FormSheet; genuine misuse. The file itself is not modified.  Note for reviewers: `Log.wtf` may terminate
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/software-mansion/react-native-screens/pull/4733"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Repository UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `09c241d8-2131-43f6-957f-fe99ea0b3a5f`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between bf72a7b326f3643d2265604fb656043ce585be7b a
  > Yeah. I think we'll want to migrate every use case @kligarski.  It's separate step though. 
  > > Yeah. I think we'll want to migrate every use case @kligarski. It's separate step though.  I created a ticket to do so: https://github.com/software-mansion/react-native-screens-labs/issues/1882.

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

### Incident Patch 1: `c1bf4746` (2026-10-01)
**Commit Message**: chore(deps): bump brace-expansion from 1.1.16 to 1.1.21 (#4754)

Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion)
from 1.1.16 to 1.1.21.
<details>
<summary>Commits</summary>
<ul>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/8e81e187b6e9c6c723d16c042657c00acefc2483"><code>8e81e18</code></a>
1.1.21</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/ffdfa3e3806bed17c0874b8f1439b084de354a7e"><code>ffdfa3e</code></a>
Merge commit from fork</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/c6513ad31e08edb56dc414a629e39cba724b7548"><code>c6513ad</code></a>
1.1.20</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/1efee7c397c191da6287a78ec19512476a966a7b"><code>1efee7c</code></a>
Merge commit from fork</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/a34340a053abb475cc226aeb3f71887018e71bd0"><code>a34340a</code></a>
1.1.19</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/0bcbfc0a5928c3073d48f42999d1ce4fc1c42fbc"><code>0bcbfc0</code></a>
Merge commit from fork</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit

**File**: `yarn.lock` (modified, +3/-3)
```diff
@@ -5589,12 +5589,12 @@ __metadata:
   linkType: hard
 
 "brace-expansion@npm:^1.1.7":
-  version: 1.1.16
-  resolution: "brace-expansion@npm:1.1.16"
+  version: 1.1.21
+  resolution: "brace-expansion@npm:1.1.21"
   dependencies:
     balanced-match: "npm:^1.0.0"
     concat-map: "npm:0.0.1"
-  checksum: 10c0/b2a915bbedbf4e45840d1fb9a4d391bbf26a79475bd134714d3cee34f1f0edb0ce982738028843be5fbaf8039429f71fa487df8c915b6065ced542c83e58fae6
+  checksum: 10c0/8f0a68a720f9cb28c2ecaea5cdaf15fafd686d6b6e4e722a81c9d4bd2f68c1fd0619731cac05875d842221eaf4d97d564d329a12eb3c4c22137502fb3c65be8b
   languageName: node
   linkType: hard
 
```

---

### Incident Patch 2: `42c349b4` (2026-10-01)
**Commit Message**: chore(deps): bump brace-expansion from 1.1.18 to 1.1.21 in /docs (#4766)

Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion)
from 1.1.18 to 1.1.21.
<details>
<summary>Commits</summary>
<ul>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/8e81e187b6e9c6c723d16c042657c00acefc2483"><code>8e81e18</code></a>
1.1.21</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/ffdfa3e3806bed17c0874b8f1439b084de354a7e"><code>ffdfa3e</code></a>
Merge commit from fork</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/c6513ad31e08edb56dc414a629e39cba724b7548"><code>c6513ad</code></a>
1.1.20</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/1efee7c397c191da6287a78ec19512476a966a7b"><code>1efee7c</code></a>
Merge commit from fork</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/a34340a053abb475cc226aeb3f71887018e71bd0"><code>a34340a</code></a>
1.1.19</li>
<li><a
href="https://github.com/juliangruber/brace-expansion/commit/0bcbfc0a5928c3073d48f42999d1ce4fc1c42fbc"><code>0bcbfc0</code></a>
Merge commit from fork</li>
<li>See full diff in <a
href="https://github.com/juliangru

**File**: `docs/yarn.lock` (modified, +3/-3)
```diff
@@ -4934,12 +4934,12 @@ __metadata:
   linkType: hard
 
 "brace-expansion@npm:^1.1.7":
-  version: 1.1.18
-  resolution: "brace-expansion@npm:1.1.18"
+  version: 1.1.21
+  resolution: "brace-expansion@npm:1.1.21"
   dependencies:
     balanced-match: "npm:^1.0.0"
     concat-map: "npm:0.0.1"
-  checksum: 10c0/3432c18a9e2ebf94162d4effb62198bd0adea06a9f332b2c0188df5d5e30b1e51ea3c848b6608e47d0b857ebe1ea5b3888ed3326dd3c4f6f9645c94153cf9c14
+  checksum: 10c0/8f0a68a720f9cb28c2ecaea5cdaf15fafd686d6b6e4e722a81c9d4bd2f68c1fd0619731cac05875d842221eaf4d97d564d329a12eb3c4c22137502fb3c65be8b
   languageName: node
   linkType: hard
 
```

---

### Incident Patch 3: `8fdd374d` (2026-10-01)
**Commit Message**: fix(Android): make fragment restoration R8-safe (#4540)

## Description

Closes #4505.

`RNScreensFragmentFactory` identifies screen fragments by checking
whether the restored class name starts with the library package. With R8
enabled (in particular with
`android.r8.optimizedResourceShrinking=true`), those classes can be
renamed and repackaged. The check then falls through to normal fragment
restoration, and the screen fragment constructor throws.

This change makes R8 keep the names of library fragments, so the
existing package-prefix check stays valid in minified builds.

## Changes

- Added a consumer R8 rule, `android/consumer-rules.pro`:
  ```
-keepnames class com.swmansion.rnscreens.** extends
androidx.fragment.app.Fragment
  ```
It keeps the original fully qualified names of every library fragment,
including indirect subclasses such as `ScreenStackFragment`. Unused
fragments can still be removed, and the rest of the library is still
obfuscated.
- Wired the rule into the AAR via `consumerProguardFiles` and added it
to the published npm `files`.
- `RNScreensFragmentFactory` itself is unchanged.

> An earlier iteration of this PR used an
`RNScreensNonRestorableFragment` marker

**File**: `android/build.gradle` (modified, +1/-0)
```diff
@@ -141,6 +141,7 @@ android {
         versionCode 1
         versionName "1.0"
         buildConfigField "boolean", "RNS_DEBUG_LOGGING", areDebugLogsEnabled().toString()
+        consumerProguardFiles "consumer-rules.pro"
         ndk {
             abiFilters (*reactNativeArchitectures())
         }
```

**File**: `android/consumer-rules.pro` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+# RNScreensFragmentFactory recognises library fragments by their package-name prefix when
+# restoring saved state. Keep their names so R8 can't rename or repackage them.
+-keepnames class com.swmansion.rnscreens.** extends androidx.fragment.app.Fragment
```

**File**: `package.json` (modified, +1/-0)
```diff
@@ -43,6 +43,7 @@
     "android/src/fabric/",
     "android/src/versioned/",
     "android/build.gradle",
+    "android/consumer-rules.pro",
     "android/CMakeLists.txt",
     "ios/",
     "cpp/",
```

---

### Incident Patch 4: `bd7e3ce3` (2026-10-01)
**Commit Message**: fix(Android): always emit warn, error and wtf RNSLog levels (#4733)

## Description

`RNSLog` on Android gates **every** level behind `RNS_DEBUG_LOGGING`
(the `rnsDebugLogsEnabled` gradle property, off by default). As a result
warnings and errors never reach release builds, nor debug builds of apps
that don't opt in.

This PR gates per level instead:

- `w`, `e`, `wtf` — always emitted,
- `d`, `i`, `v` — emitted only when `RNS_DEBUG_LOGGING` is enabled
(unchanged).

This keeps the intent of #3144 (hiding debug chatter from consumer apps)
while not swallowing diagnostics that indicate real problems. It is also
a prerequisite for the planned iOS levelled `RNSLog`, which is meant to
replace `RCTLogWarn` / `RCTLogError` call sites — those are not gated,
and both platforms should follow the same per-level policy. Part of the
RFC-1823 (`core` / `react` layers) implementation, task A1.

**Release note:** Android: `RNSLog` warnings and errors are now emitted
in release builds.

## Changes

- `RNSLog.kt`: `w` / `e` / `wtf` (both overloads) call
`android.util.Log` directly; `d` / `i` / `v` still go through the flag
check.
- Added a KDoc on `RNSLog` stating the per-level policy.

Call sites w

**File**: `android/src/main/java/com/swmansion/rnscreens/utils/RNSLog.kt` (modified, +22/-6)
```diff
@@ -3,6 +3,10 @@ package com.swmansion.rnscreens.utils
 import android.util.Log
 import com.swmansion.rnscreens.BuildConfig
 
+/**
+ * `d`, `i` and `v` are emitted only when `RNS_DEBUG_LOGGING` is enabled;
+ * `w`, `e` and `wtf` are always emitted.
+ */
 object RNSLog {
     private inline fun logIfEnabled(
         tag: String,
@@ -39,13 +43,17 @@ object RNSLog {
     fun e(
         tag: String,
         msg: String,
-    ) = logIfEnabled(tag, msg, Log::e)
+    ) {
+        Log.e(tag, msg)
+    }
 
     fun e(
         tag: String,
         msg: String,
         tr: Throwable,
-    ) = logIfEnabled(tag, msg, tr, Log::e)
+    ) {
+        Log.e(tag, msg, tr)
+    }
 
     fun i(
         tag: String,
@@ -72,22 +80,30 @@ object RNSLog {
     fun w(
         tag: String,
         msg: String,
-    ) = logIfEnabled(tag, msg, Log::w)
+    ) {
+        Log.w(tag, msg)
+    }
 
     fun w(
         tag: String,
         msg: String,
         tr: Throwable,
-    ) = logIfEnabled(tag, msg, tr, Log::w)
+    ) {
+        Log.w(tag, msg, tr)
+    }
 
     fun wtf(
         tag: String,
         msg: String,
-    ) = logIfEnabled(tag, msg, Log::wtf)
+    ) {
+        Log.wtf(tag, msg)
+    }
 
     fun wtf(
         tag: String,
         msg: String,
         tr: Throwable,
-    ) = logIfEnabled(tag, msg, tr, Log::wtf)
+    ) {
+        Log.wtf(tag, msg, tr)
+    }
 }
```

---

### Incident Patch 5: `7ffbeebd` (2026-10-01)
**Commit Message**: feat(iOS, Tabs): Migrate to UITab API for iOS >= 26.1 (#4675)

> [!caution]
> This PR brings SIGNIFICANT change to tabs and MUST be carefully
reviewed and tested on all possible scenarios.

## Description

Migrates the children management of `RNSTabBarController` from the
legacy `viewControllers`-based API to the modern `UITab`-based API
(`UITabBarController.tabs` / `selectedTab`) on **iOS 26.1+**. The legacy
path remains in place for iOS < 26.1 and tvOS.

UIKit ties newer tab-bar features to the `UITab` API (e.g. the system
search tab treatment, `UISearchTab.automaticallyActivatesSearch`), so
adopting it is necessary.

> [!note]
> `UISearchTab` is not adopted here — left for a followup PR. The
`search` system item gets a plain `UITab`. Behavioral consequence: on
iOS 26.x the search tab still receives the system trailing-edge
treatment, on iOS 27 it stays in place like any other tab until the
followup lands.

## Changes

- **UIKit boundary**: every UIKit read/write related to child
installation & selection is funnelled through four method —
`installScreenControllers:animated:`, `installedScreenControllers`,
`selectedScreenController`, `applySelectedScreenController:` — so the
two m

**File**: `ios/tabs/RNSTabBarAppearanceCoordinator.mm` (modified, +23/-6)
```diff
@@ -4,6 +4,7 @@
 #import <React/RCTLog.h>
 #import "RCTConvert+RNSTabs.h"
 #import "RNSConversions-Tabs.h"
+#import "RNSDefines.h"
 #import "RNSImageLoadingHelper.h"
 #import "RNSTabBarController.h"
 #import "RNSTabsHostComponentView.h"
@@ -56,6 +57,20 @@ - (void)configureTabBarItemForTabScreenController:(nonnull RNSTabsScreenViewCont
               withImageLoader:imageLoader];
 }
 
+/// Sets the normal icon on both the item (renders the iPhone bar) and the UITab (renders the
+/// iPad floating bar / sidebar, which never reads the item).
+- (void)setNormalImage:(nullable UIImage *)image
+         forTabBarItem:(nonnull UITabBarItem *)tabBarItem
+          ofScreenView:(nullable RNSTabsScreenComponentView *)screenView
+{
+  tabBarItem.image = image;
+#if RNS_UITAB_API_SDK_AVAILABLE
+  if (RNS_UITAB_API_ENABLED) {
+    screenView.controller.tab.image = image;
+  }
+#endif // RNS_UITAB_API_SDK_AVAILABLE
+}
+
 - (void)setIconsForTabBarItem:(UITabBarItem *)tabBarItem
                fromScreenView:(RNSTabsScreenComponentView *)screenView
               withImageLoader:(RCTImageLoader *_Nullable)imageLoader
@@ -67,13 +82,13 @@ - (void)setIconsForTabBarItem:(UITabBarItem *)tabBarItem
         if (image == nil) {
           RCTLogWarn(@"[RNScreens] Failed to load SF Symbol \"%@\" for tab bar item", screenView.iconResourceName);
         }
-        tabBarItem.image = image;
+        [self setNormalImage:image forTabBarItem:tabBarItem ofScreenView:screenView];
       } else {
         UIImage *image = [UIImage imageNamed:screenView.iconResourceName];
         if (image == nil) {
           RCTLogWarn(@"[RNScreens] Failed to load xcasset \"%@\" for tab bar item", screenView.iconResourceName);
         }
-        tabBarItem.image = image;
+        [self setNormalImage:image forTabBarItem:tabBarItem ofScreenView:screenView];
       }
     } else if (screenView.systemItem != RNSTabsScreenSystemItemNone) {
       // Restore default system item icon
@@ -85,9 +100,11 @@ - (void)setIconsForTabBarItem:(UITabBarItem *)tabBarItem
             (long)screenView.systemItem);
         return;
       }
-      tabBarItem.image = [[UITabBarItem alloc] initWithTabBarSystemItem:systemItem.value() tag:0].image;
+      UIImage *_Nullable systemItemImage =
+          [[UITabBarItem alloc] initWithTabBarSystemItem:systemItem.value() tag:0].image;
+      [self setNormalImage:systemItemImage forTabBarItem:tabBarItem ofScreenView:screenView];
     } else {
-      tabBarItem.image = nil;
+      [self setNormalImage:nil forTabBarItem:tabBarItem ofScreenView:screenView];
     }
 
     if (screenView.selectedIconResourceName != nil) {
@@ -141,7 +158,7 @@ - (void)setIconsForTabBarItem:(UITabBarItem *)tabBarItem
                                             forScreenView:weakScreenView];
                                  }];
     } else {
-      tabBarItem.image = nil;
+      [self setNormalImage:nil forTabBarItem:tabBarItem ofScreenView:screenView];
     }
 
     // Selected icon
@@ -183,7 +200,7 @@ - (void)updateTabBarItem:(nullable UITabBarItem *)tabBarItem
   if (isSelected) {
     tabBarItem.selectedImage = image;
   } else {
-    tabBarItem.image = image;
+    [self setNormalImage:image forTabBarItem:tabBarItem ofScreenView:screenView];
   }
 
   // A layout pass is required because the image might be loaded asynchronously,
```

**File**: `ios/tabs/RNSTabBarItemCoordinator.h` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+#pragma once
+
+#import <Foundation/Foundation.h>
+#import "RNSTabsScreenViewController.h"
+
+NS_ASSUME_NONNULL_BEGIN
+
+@interface RNSTabBarItemCoordinator : NSObject
+
+- (void)createTabBarItemsForTabScreenControllers:(nullable NSArray<RNSTabsScreenViewController *> *)tabScreenCtrls;
+
+- (void)updateTabBarItemsForTabScreenControllers:(nullable NSArray<RNSTabsScreenViewController *> *)tabScreenCtrls;
+
+@end
+
+NS_ASSUME_NONNULL_END
```

**File**: `ios/tabs/RNSTabBarItemCoordinator.mm` (added, +143/-0)
```diff
@@ -0,0 +1,143 @@
+#import "RNSTabBarItemCoordinator.h"
+#import <React/RCTLog.h>
+#import "RNSConversions-Tabs.h"
+#import "RNSDefines.h"
+#import "RNSTabsScreenComponentView.h"
+
+@implementation RNSTabBarItemCoordinator
+
+/**
+ * Creates UITabBarItem instance with set systemItem. Needs to be called before UITab creation for the same
+ * viewController.
+ */
+- (void)createTabBarItemsForTabScreenControllers:(nullable NSArray<RNSTabsScreenViewController *> *)tabScreenCtrls
+{
+  for (RNSTabsScreenViewController *tabScreenCtrl in tabScreenCtrls) {
+    RNSTabsScreenComponentView *screenView = tabScreenCtrl.tabScreenComponentView;
+    if (screenView == nil) {
+      RCTLogWarn(@"[RNScreens] Nullish component view of TabScreen while tab bar item creation!");
+      continue;
+    }
+
+    if (screenView.tabBarItemNeedsRecreation) {
+      screenView.tabBarItemNeedsRecreation = NO;
+      [self createTabBarItemForTabScreenController:tabScreenCtrl];
+    }
+  }
+}
+
+/**
+ * Updates the runtime properties of UITabBarItem: title and badge. If used with UITab API, it should be called after
+ * the tab is built.
+ */
+- (void)updateTabBarItemsForTabScreenControllers:(nullable NSArray<RNSTabsScreenViewController *> *)tabScreenCtrls
+{
+  for (RNSTabsScreenViewController *tabScreenCtrl in tabScreenCtrls) {
+    RNSTabsScreenComponentView *screenView = tabScreenCtrl.tabScreenComponentView;
+    if (screenView == nil) {
+      RCTLogWarn(@"[RNScreens] Nullish component view of TabScreen while tab bar item update!");
+      continue;
+    }
+
+    if (screenView.tabBarItemNeedsUpdate) {
+      screenView.tabBarItemNeedsUpdate = NO;
+      [self updateTabBarItemForTabScreenController:tabScreenCtrl];
+    }
+  }
+}
+
+- (void)createTabBarItemForTabScreenController:(nonnull RNSTabsScreenViewController *)tabScreenCtrl
+{
+  RNSTabsScreenComponentView *screenView = tabScreenCtrl.tabScreenComponentView;
+
+  UITabBarItem *tabBarItem = nil;
+  if (screenView.systemItem != RNSTabsScreenSystemItemNone) {
+    std::optional<UITabBarSystemItem> systemItem =
+        rnscreens::conversion::RNSTabsScreenSystemItemToUITabBarSystemItem(screenView.systemItem);
+    if (!systemItem) {
+      RCTLogError(
+          @"[RNScreens] Conversion from tabs screen systemItem to UITabBarSystemItem failed for systemItem [%ld]",
+          (long)screenView.systemItem);
+      return;
+    }
+    tabBarItem = [[UITabBarItem alloc] initWithTabBarSystemItem:systemItem.value() tag:0];
+  } else {
+    tabBarItem = [[UITabBarItem alloc] init];
+  }
+
+  [self applyTabBarItemRepaintWorkaroundForTabScreenController:tabScreenCtrl];
+  tabScreenCtrl.tabBarItem = tabBarItem;
+}
+
+/**
+ * TODO: This is an ugly workaround and I would love to see it replaced.
+ * With UITab-managed children (iOS >= 26.1) any change to the systemItem for the first time
+ * results in missing icon and wrong title. Assigning a throwaway item first flips the internal logic
+ * so that the real assignment that follows paints synchronously.
+ * Remove once UIKit internals no longer require it.
+ */
+- (void)applyTabBarItemRepaintWorkaroundForTabScreenController:(nonnull RNSTabsScreenViewController *)tabScreenCtrl
+{
+#if RNS_UITAB_API_SDK_AVAILABLE
+  if (RNS_UITAB_API_ENABLED) {
+    tabScreenCtrl.tabBarItem = [[UITabBarItem alloc] init];
+  }
+#endif // RNS_UITAB_API_SDK_AVAILABLE
+}
+
+- (void)updateTabBarItemForTabScreenController:(nonnull RNSTabsScreenViewController *)tabScreenCtrl
+{
+  RNSTabsScreenComponentView *screenView = tabScreenCtrl.tabScreenComponentView;
+
+  NSString *evaluatedTitle = screenView.title;
+  if (screenView.title == nil && screenView.systemItem != RNSTabsScreenSystemItemNone) {
+    // Restore default system item title
+    std::optional<UITabBarSystemItem> systemItem =
+        rnscreens::conversion::RNSTabsScreenSystemItemToUITabBarSystemItem(screenView.systemItem);
+    if (!systemItem) {
+      RCTLogError(
+          @"[RNScreens] Conversion from tabs screen systemItem to UITabBarSystemItem failed for systemItem [%ld]",
+          (long)screenView.systemItem);
+      return;
+    }
+    evaluatedTitle = [[UITabBarItem alloc] initWithTabBarSystemItem:systemItem.value() tag:0].title;
+  }
+
+  [self updateTabBarItemTitle:evaluatedTitle forTabScreenController:tabScreenCtrl];
+  [self updateTabBarItemBadge:screenView.badgeValue forTabScreenController:tabScreenCtrl];
+}
+
+- (void)updateTabBarItemTitle:(NSString *)newTitle
+       forTabScreenController:(nonnull RNSTabsScreenViewController *)tabScreenCtrl
+{
+  // Setting controller title updates also controller's tabBarItem.title but only if there
+  // is a change to controller title. After creating new tabBarItem, controller title
+  // remains the same but tabBarItem.title is nil. For consistency, we always
+  // update both.
+  if (![tabScreenCtrl.tabBarItem.title isEqualToString:newTitle] || ![tabScreenCtrl.title isEqualToString:newTitle]) {
+    tabScreenCtrl.title = newTitle;
+    tabScreenC
```

**File**: `ios/tabs/host/RNSTabBarController.h` (modified, +3/-0)
```diff
@@ -4,6 +4,7 @@
 #import "RNSContainer.h"
 #import "RNSReactMountingTransactionObserving.h"
 #import "RNSTabBarAppearanceCoordinator.h"
+#import "RNSTabBarItemCoordinator.h"
 #import "RNSTabsNavigationState.h"
 #import "RNSTabsScreenViewController.h"
 
@@ -117,6 +118,8 @@ NS_ASSUME_NONNULL_BEGIN
  */
 @property (nonatomic, readonly, strong, nonnull) RNSTabBarAppearanceCoordinator *tabBarAppearanceCoordinator;
 
+@property (nonatomic, readonly, strong, nonnull) RNSTabBarItemCoordinator *tabBarItemCoordinator;
+
 /**
  * If true, the controller will reject any navigation state updates if the provenance of the
  * update is stale.
```

**File**: `ios/tabs/host/RNSTabBarController.mm` (modified, +372/-107)
```diff
@@ -5,6 +5,7 @@
 #import <objc/runtime.h>
 #import <limits>
 #import "NSString+RNSUtility.h"
+#import "RNSDefines.h"
 #import "RNSLog.h"
 #import "RNSParentContainerItemRegistry.h"
 #import "RNSScreenWindowTraits.h"
@@ -70,6 +71,11 @@ static void rns_pushViewController(__unsafe_unretained id self,
 @implementation RNSTabBarController {
   NSArray<RNSTabsScreenViewController *> *_Nullable _tabScreenControllers;
 
+  /// Controllers currently installed in UIKit (see `installScreenControllers:animated:`).
+  /// On the UITab path `UITabBarController.viewControllers` is empty once `tabs` is set,
+  /// so the installed set is tracked here; on the legacy path UIKit itself is the source of truth.
+  NSArray<RNSTabsScreenViewController *> *_Nullable _installedScreenControllers;
+
   /// This property is nullable until first container update. Later it MUST NOT be nil.
   RNSTabsNavigationState *_Nullable _navigationState;
 
@@ -86,6 +92,17 @@ @implementation RNSTabBarController {
   /// delegate handling). Setter overrides skip reconciliation while this flag is set.
   BOOL _isHandlingExplicitSelectionUpdate;
 
+  /// UITab path only. Set when `shouldSelectTab:` admits a user selection, consumed by
+  /// `didSelectTab:` - which fires also for programmatic selection and this flag allows for filtering the latter.
+  BOOL _isHandlingUserTabSelection;
+
+  /// UITab path only. Set in `tabBar:didSelectItem:` when the user selects the More tab while
+  /// another tab is active. Tapping More does not necessarily show the More list - the stack may
+  /// re-display a hosted screen retained from a previous visit - so the decision between emitting
+  /// `onMoreTabSelected` and progressing state to the re-displayed screen is deferred to
+  /// `willShowViewController:`, which reports what actually shows.
+  BOOL _pendingMoreTabSelectedEmit;
+
   RNSTabsNavigationStateObserverRegistry *_observerRegistry;
 
   RNSParentContainerItemRegistry *_Nonnull _parentContainerRegistry;
@@ -95,11 +112,15 @@ - (instancetype)init
 {
   if (self = [super init]) {
     _tabScreenControllers = nil;
+    _installedScreenControllers = nil;
     _tabBarAppearanceCoordinator = [RNSTabBarAppearanceCoordinator new];
+    _tabBarItemCoordinator = [RNSTabBarItemCoordinator new];
     _tabsHostComponentView = nil;
     _navigationState = nil;
     _pendingStateUpdate = nil;
     _shouldProgressStateOnMoreNavigationControllerPush = NO;
+    _isHandlingUserTabSelection = NO;
+    _pendingMoreTabSelectedEmit = NO;
     _observerRegistry = [RNSTabsNavigationStateObserverRegistry new];
     _parentContainerRegistry = [RNSParentContainerItemRegistry new];
 
@@ -156,9 +177,9 @@ - (instancetype)initWithTabsHostComponentView:(nullable RNSTabsHostComponentView
 
 - (nullable UIScrollView *)resolveCurrentContentScrollView
 {
-  // `selectedViewController` may be the `moreNavigationController` (a `UINavigationController`) -
+  // The effective selection may be the `moreNavigationController` (a `UINavigationController`) -
   // we only resolve for our own tab screens.
-  UIViewController *selectedController = self.selectedViewController;
+  UIViewController *selectedController = [self effectiveSelectedViewController];
   if (![selectedController isKindOfClass:RNSTabsScreenViewController.class]) {
     return nil;
   }
@@ -191,7 +212,32 @@ - (void)didMoveToParentViewController:(UIViewController *)parent
 
 - (void)tabBar:(UITabBar *)tabBar didSelectItem:(UITabBarItem *)item
 {
-  RNSLog(@"TabBar: %@ didSelectItem: %@", tabBar, item);
+#if RNS_MORE_NAVIGATION_CONTROLLER_AVAILABLE && RNS_UITAB_API_SDK_AVAILABLE
+  if (RNS_UITAB_API_ENABLED) {
+    // The only direct "user tapped More" signal on the UITab path - no UITab delegate covers More.
+    // Mirrors the More branch of the legacy `shouldSelectViewController:`: enforce selection
+    // prevention on the More stack top before UIKit displays it.
+    if ([self isMoreNavigationControllerPresentInTabBar] && item == self.moreNavigationController.tabBarItem) {
+      [self prepareForMoreNavigationControllerHandlingIfNeeded];
+      [self disableNavigationBarInMoreNavigationController];
+      UIViewController *_Nullable poppedViewController =
+          [self popToRootInMoreNavigationControllerRespectSelectionPrevention:YES animated:NO];
+      if (poppedViewController != nil) {
+        [self
+            onDidPreventUserFromSelectingViewControllerWithKey:[self screenKeyForViewController:poppedViewController]];
+      }
+
+      // At this point, the `view.selectedViewController` is not yet updated and points
+      // to previous tab's viewController, which allows us to tell if whether
+      // we've just navigated to More tab or we've been there earlier
+      // Verified on both iOS 26 and 27. There's no other simple way to check that
+      // since `didSelectTab:` doesn't fire for More tab
+      if (![self isSelectedViewControllerTheMoreNavigationController]) {
+        _pendingMoreTabSelectedEmit = YES;
+
```

**File**: `ios/tabs/screen/RNSTabsScreenComponentView.h` (modified, +4/-0)
```diff
@@ -75,6 +75,10 @@ NS_ASSUME_NONNULL_BEGIN
 @property (nonatomic, readonly, nullable) NSString *tabItemAccessibilityLabel;
 @property (nonatomic) BOOL tabBarItemNeedsA11yUpdate;
 
+@property (nonatomic) BOOL tabBarItemNeedsRecreation;
+
+@property (nonatomic) BOOL tabBarItemNeedsUpdate;
+
 @property (nonatomic, readonly) RNSTabsScreenSystemItem systemItem;
 
 @end
```

**File**: `ios/tabs/screen/RNSTabsScreenComponentView.mm` (modified, +6/-69)
```diff
@@ -159,64 +159,6 @@ - (void)overrideScrollViewBehaviorInFirstDescendantChainIfNeeded
   }
 }
 
-#pragma mark - Prop update utils
-
-- (void)createTabBarItem
-{
-  UITabBarItem *tabBarItem = nil;
-  if (_systemItem != RNSTabsScreenSystemItemNone) {
-    std::optional<UITabBarSystemItem> systemItem =
-        rnscreens::conversion::RNSTabsScreenSystemItemToUITabBarSystemItem(_systemItem);
-    if (!systemItem) {
-      RCTLogError(
-          @"[RNScreens] Conversion from tabs screen systemItem to UITabBarSystemItem failed for systemItem [%ld]",
-          (long)_systemItem);
-      return;
-    }
-    tabBarItem = [[UITabBarItem alloc] initWithTabBarSystemItem:systemItem.value() tag:0];
-  } else {
-    tabBarItem = [[UITabBarItem alloc] init];
-  }
-  _controller.tabBarItem = tabBarItem;
-}
-
-- (void)updateTabBarItem
-{
-  UITabBarItem *tabBarItem = _controller.tabBarItem;
-
-  NSString *evaluatedTitle = _title;
-  if (_title == nil && _systemItem != RNSTabsScreenSystemItemNone) {
-    // Restore default system item title
-    std::optional<UITabBarSystemItem> systemItem =
-        rnscreens::conversion::RNSTabsScreenSystemItemToUITabBarSystemItem(_systemItem);
-    if (!systemItem) {
-      RCTLogError(
-          @"[RNScreens] Conversion from tabs screen systemItem to UITabBarSystemItem failed for systemItem [%ld]",
-          (long)_systemItem);
-      return;
-    }
-    evaluatedTitle = [[UITabBarItem alloc] initWithTabBarSystemItem:systemItem.value() tag:0].title;
-  }
-
-  [self updateTabBarItemTitle:evaluatedTitle];
-
-  if (![tabBarItem.badgeValue isEqualToString:_badgeValue]) {
-    tabBarItem.badgeValue = _badgeValue;
-  }
-}
-
-- (void)updateTabBarItemTitle:(NSString *)newTitle
-{
-  // Setting _controller.title updates also _controller.tabBarItem.title but only if there
-  // is a change to _controller.title. After creating new tabBarItem, _controller.title
-  // remains the same but _controller.tabBarItem.title is nil. For consistency, we always
-  // update both.
-  if (![_controller.tabBarItem.title isEqualToString:newTitle] || ![_controller.title isEqualToString:newTitle]) {
-    _controller.title = newTitle;
-    _controller.tabBarItem.title = newTitle;
-  }
-}
-
 #pragma mark - RNSSafeAreaProviding
 
 - (UIEdgeInsets)providerSafeAreaInsets
@@ -249,8 +191,6 @@ - (void)updateProps:(const facebook::react::Props::Shared &)props
 
   bool tabItemNeedsAppearanceUpdate{false};
   bool tabScreenOrientationNeedsUpdate{false};
-  bool tabBarItemNeedsRecreation{false};
-  bool tabBarItemNeedsUpdate{false};
 
   if (newComponentProps.title != oldComponentProps.title ||
       newComponentProps.isTitleUndefined != oldComponentProps.isTitleUndefined) {
@@ -262,7 +202,7 @@ - (void)updateProps:(const facebook::react::Props::Shared &)props
       _title = RCTNSStringFromString(newComponentProps.title);
     }
 
-    tabBarItemNeedsUpdate = YES;
+    _tabBarItemNeedsUpdate = YES;
   }
 
   if (newComponentProps.orientation != oldComponentProps.orientation) {
@@ -277,7 +217,7 @@ - (void)updateProps:(const facebook::react::Props::Shared &)props
 
   if (newComponentProps.badgeValue != oldComponentProps.badgeValue) {
     _badgeValue = RCTNSStringFromStringNilIfEmpty(newComponentProps.badgeValue);
-    tabBarItemNeedsUpdate = YES;
+    _tabBarItemNeedsUpdate = YES;
   }
 
   if (newComponentProps.tabBarItemTestID != oldComponentProps.tabBarItemTestID) {
@@ -378,23 +318,20 @@ - (void)updateProps:(const facebook::react::Props::Shared &)props
   if (newComponentProps.systemItem != oldComponentProps.systemItem) {
     _systemItem =
         rnscreens::conversion::RNSTabsScreenSystemItemFromReactRNSTabsScreenSystemItem(newComponentProps.systemItem);
-    tabBarItemNeedsRecreation = YES;
+    _tabBarItemNeedsRecreation = YES;
   }
 
   if (newComponentProps.userInterfaceStyle != oldComponentProps.userInterfaceStyle) {
     _userInterfaceStyle =
         rnscreens::conversion::UIUserInterfaceStyleFromTabsScreenCppEquivalent(newComponentProps.userInterfaceStyle);
   }
 
-  if (tabBarItemNeedsRecreation) {
-    [self createTabBarItem];
-    tabBarItemNeedsUpdate = YES;
+  if (_tabBarItemNeedsRecreation) {
+    _tabBarItemNeedsUpdate = YES;
     _tabBarItemNeedsA11yUpdate = YES;
   }
 
-  if (tabBarItemNeedsUpdate) {
-    [self updateTabBarItem];
-
+  if (_tabBarItemNeedsUpdate) {
     // Force appearance update to make sure correct image for tab bar item is used
     tabItemNeedsAppearanceUpdate = YES;
   }
```

**File**: `ios/utils/RNSDefines.h` (modified, +12/-7)
```diff
@@ -6,18 +6,23 @@
 #pragma mark - Compiler utility
 
 #define RNS_IGNORE_SUPER_CALL_BEGIN \
-  _Pragma("clang diagnostic push")  \
-      _Pragma("clang diagnostic ignored \"-Wobjc-missing-super-calls\"")
+  _Pragma("clang diagnostic push") _Pragma("clang diagnostic ignored \"-Wobjc-missing-super-calls\"")
 
 #define RNS_IGNORE_SUPER_CALL_END _Pragma("clang diagnostic pop")
 
 #pragma mark - SDK availability utility
 
-#define RNS_IPHONE_OS_VERSION_AVAILABLE(v)                              \
-  (defined(__IPHONE_OS_VERSION_MAX_ALLOWED) && defined(__IPHONE_##v) && \
-   __IPHONE_OS_VERSION_MAX_ALLOWED >= __IPHONE_##v)
+#define RNS_IPHONE_OS_VERSION_AVAILABLE(v) \
+  (defined(__IPHONE_OS_VERSION_MAX_ALLOWED) && defined(__IPHONE_##v) && __IPHONE_OS_VERSION_MAX_ALLOWED >= __IPHONE_##v)
 
 #pragma mark - Availability utils
 
-#define RNS_TABS_BOTTOM_ACCESSORY_AVAILABLE \
-  RNS_IPHONE_OS_VERSION_AVAILABLE(26_0) && !TARGET_OS_TV && !TARGET_OS_VISION
+#define RNS_TABS_BOTTOM_ACCESSORY_AVAILABLE RNS_IPHONE_OS_VERSION_AVAILABLE(26_0) && !TARGET_OS_TV && !TARGET_OS_VISION
+
+// UITab-based UITabBarController children API.
+// Compile-time check for SDK availability and whether we want to actually use it.
+#define RNS_UITAB_API_SDK_AVAILABLE (RNS_IPHONE_OS_VERSION_AVAILABLE(18_0) && !TARGET_OS_TV && !TARGET_OS_VISION)
+// Runtime check deciding since which version we want to use it.
+// Keep in mind that UITab api has been added in iOS 18,
+// plus, for certain iOS 27 features this new API is mandatory.
+#define RNS_UITAB_API_ENABLED @available(iOS 26.1, *)
```

---

### Incident Patch 6: `491e942e` (2026-09-30)
**Commit Message**: fix(Android, Stack v5): add `explicitParentProvider` to `ColorSchemeCoordinator` to ensure correct resolution during transition (#4634)

## Description

After
https://github.com/software-mansion/react-native-screens/pull/4633, a
push detaches the covered screen and that screen's header animates out —
and while it does, it blanks out. With `StackHost`'s `colorScheme`
pinned to a value that differs from the system one (`dark` on a light
device, or the reverse), the covered screen slides away with a hole
where its header used to be, showing the bare window background. The
settled state is always correct, and the same glitch runs in reverse on
pop.

The cause is that a header resolves its color scheme by walking up the
view tree, and a transition moves it somewhere that walk cannot work.
This PR lets a screen's header be _told_ its provider instead of looking
for it.

Closes
https://github.com/software-mansion/react-native-screens-labs/issues/1814.

### Details

**Where the header goes during a transition.** `androidx.transition`
animates a disappearing view by taking it out of the container and
adding it to that container's `ViewGroupOverlay`
(`Visibility.onDisappear`). An overlay is 

**File**: `android/src/main/java/com/swmansion/rnscreens/common/colorscheme/ColorSchemeCoordinator.kt` (modified, +11/-1)
```diff
@@ -3,6 +3,7 @@ package com.swmansion.rnscreens.common.colorscheme
 import android.content.res.Configuration
 import android.view.View
 import android.view.ViewParent
+import java.lang.ref.WeakReference
 import kotlin.properties.Delegates
 
 internal typealias OnUiNightModeResolvedCallback = (nightMode: Int) -> Unit
@@ -16,6 +17,15 @@ internal class ColorSchemeCoordinator :
         }
     }
     private var parentProvider: ColorSchemeProviding? = null
+
+    /**
+     * Parent provider known from ownership, taking precedence over the view-tree walk
+     * in [setup]. Set it when the owner knows its provider statically (e.g. a fragment's
+     * root view always resolves through the container that created the fragment) - the
+     * walk is unreliable there: transitions reparent an exiting fragment's view into the
+     * container's ViewGroupOverlay, whose parent chain ends in null. Survives [teardown].
+     */
+    internal var explicitParentProvider: WeakReference<ColorSchemeProviding>? = null
     private var systemUiNightMode: Int = Configuration.UI_MODE_NIGHT_NO
     private var lastAppliedUiNightMode: Int? = null
     private val childListeners = mutableListOf<ColorSchemeListener>()
@@ -60,7 +70,7 @@ internal class ColorSchemeCoordinator :
 
         systemUiNightMode =
             hostView.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
-        parentProvider = findParentColorSchemeProvider(hostView)
+        parentProvider = explicitParentProvider?.get() ?: findParentColorSchemeProvider(hostView)
         parentProvider?.addColorSchemeListener(this)
         onUiNightModeResolved = onUiNightModeResolvedCallback
         isSetUp = true
```

**File**: `android/src/main/java/com/swmansion/rnscreens/stack/header/StackHeaderCoordinatorLayout.kt` (modified, +6/-1)
```diff
@@ -36,6 +36,7 @@ internal class StackHeaderCoordinatorLayout(
     internal val stackScreen: StackScreen,
     private val canNavigateBack: Boolean,
     private val updateBatchStateProvider: WeakReference<StackUpdateBatchStateProviding>,
+    parentColorSchemeProvider: WeakReference<ColorSchemeProviding>,
     private val backPressHandler: StackHeaderBackPressHandler,
 ) : CoordinatorLayout(context),
     ColorSchemeProviding {
@@ -280,7 +281,11 @@ internal class StackHeaderCoordinatorLayout(
 
     // region Color scheme
 
-    private val colorSchemeCoordinator = ColorSchemeCoordinator()
+    // As the fragment's root view, this layout gets reparented into the container's
+    // ViewGroupOverlay for exit transitions, where a parent walk finds no provider -
+    // hence the ownership-injected one.
+    private val colorSchemeCoordinator =
+        ColorSchemeCoordinator().apply { explicitParentProvider = parentColorSchemeProvider }
 
     // Night mode the header visuals were last applied against. Unlike the coordinator's
     // internal dedupe (reset on every setup()), this survives detach/reattach, skipping
```

**File**: `android/src/main/java/com/swmansion/rnscreens/stack/host/StackContainer.kt` (modified, +1/-0)
```diff
@@ -276,6 +276,7 @@ internal class StackContainer(
             WeakReference(this),
             backPressHandler = WeakReference(this),
             updateBatchStateProvider = WeakReference(this),
+            colorSchemeProvider = WeakReference(this),
         ).also {
             Log.d(TAG, "Created Fragment $it for screen ${screen.screenKey}")
         }
```

**File**: `android/src/main/java/com/swmansion/rnscreens/stack/screen/StackScreenFragment.kt` (modified, +3/-0)
```diff
@@ -9,6 +9,7 @@ import android.view.View
 import android.view.ViewGroup
 import androidx.fragment.app.Fragment
 import androidx.transition.Slide
+import com.swmansion.rnscreens.common.colorscheme.ColorSchemeProviding
 import com.swmansion.rnscreens.stack.header.StackHeaderBackPressHandler
 import com.swmansion.rnscreens.stack.header.StackHeaderCoordinatorLayout
 import com.swmansion.rnscreens.stack.host.StackUpdateBatchStateProviding
@@ -20,6 +21,7 @@ internal class StackScreenFragment(
     private val delegate: WeakReference<StackScreenFragmentDelegate>,
     private val backPressHandler: WeakReference<StackHeaderBackPressHandler>,
     private val updateBatchStateProvider: WeakReference<StackUpdateBatchStateProviding>,
+    private val colorSchemeProvider: WeakReference<ColorSchemeProviding>,
 ) : Fragment() {
     private var screenLifecycleEventEmitter: StackScreenAppearanceEventsEmitter? = null
 
@@ -68,6 +70,7 @@ internal class StackScreenFragment(
             stackScreen,
             canNavigateBack,
             updateBatchStateProvider,
+            colorSchemeProvider,
         ) { pressedScreen ->
             backPressHandler.get()?.handleHeaderBackButtonPress(pressedScreen)
                 ?: Log.w(TAG, "[RNScreens] Header back button press dropped - handler is gone")
```

---

### Incident Patch 7: `26816036` (2026-09-30)
**Commit Message**: chore(e2e): Adding iPad configuration to e2e suite in CI (#4704)

## Description

The iOS e2e workflow only ran the iPhone suite, so the `@ipad`-tagged
specs never ran in CI. The workflow is now split into one `build` job
and a matrix `test` job, which runs the iPhone and iPad suites in
parallel on separate runners. Both use the same release build, so the
app is still built only once.

It also fixes the default iPad simulator. `iPad Pro 13-inch (M4)` isn't
installed on the GitHub runner images: both `macos-26` and `xcode-27`
ship `iPad Pro 11/13-inch (M5)` and `iPad Air 11/13-inch (M4)`, with no
M4 Pro. So the iPad suite could not have started there.

Closes:
https://github.com/software-mansion/react-native-screens-labs/issues/1734

## Changes

- `ios-e2e-test-fabric.yml`: the old `test` job is split in two:
- `build`: installs dependencies, builds the release app and packs
`Release-iphonesimulator/FabricExample.app` into a tarball. It uploads
the tarball as the `build-ios-app` artifact with 1-day retention. It
uses tar because `upload-artifact` drops the executable bit.
- `test` (`needs: build`): a matrix with `iphone` (`yarn test-e2e-ios`)
and `ipad` (`yarn test-e2e-ios-ipad`). `

**File**: `.github/workflows/ios-e2e-test-fabric.yml` (modified, +66/-8)
```diff
@@ -15,15 +15,15 @@ on:
     branches:
       - main
   workflow_dispatch:
+concurrency:
+  group: ios-e2e-fabric-${{ github.ref }}
+  cancel-in-progress: true
 jobs:
-  test:
+  build:
     runs-on: macos-26-xlarge
     timeout-minutes: 90
     env:
       WORKING_DIRECTORY: FabricExample
-    concurrency:
-      group: ios-e2e-fabric-${{ github.ref }}
-      cancel-in-progress: true
     steps:
       - name: checkout
         uses: actions/checkout@v4
@@ -38,8 +38,6 @@ jobs:
           xcode-version: '26.2'
       - name: Get Xcode version
         run: xcodebuild -version
-      - name: Install AppleSimulatorUtils
-        run: brew tap wix/brew && brew trust wix/brew && brew install applesimutils
       - name: Install root node dependencies
         run: yarn install && yarn submodules
       - name: Install node dependencies
@@ -58,11 +56,71 @@ jobs:
       - name: Build app
         working-directory: ${{ env.WORKING_DIRECTORY }}
         run: yarn build-e2e-ios
+        # Hands the release build to the test jobs (they run on separate
+        # machines). tar keeps the executable bit, which upload-artifact drops.
+      - name: Package app
+        run: |
+          tar -czf "$RUNNER_TEMP/FabricExample-app.tar.gz" \
+            -C "$WORKING_DIRECTORY/ios/build/Build/Products" Release-iphonesimulator/FabricExample.app
+      - name: Upload app
+        uses: actions/upload-artifact@v4
+        with:
+          name: build-ios-app
+          path: ${{ runner.temp }}/FabricExample-app.tar.gz
+          retention-days: 1
+
+  test:
+    # iPhone and iPad suites run in parallel on separate machines, both on the
+    # app built once above. fail-fast off, so one failing does not cancel the other.
+    needs: build
+    runs-on: macos-26-xlarge
+    timeout-minutes: 90
+    strategy:
+      fail-fast: false
+      matrix:
+        include:
+          - device: iphone
+            script: test-e2e-ios
+          - device: ipad
+            script: test-e2e-ios-ipad
+    name: test (${{ matrix.device }})
+    env:
+      WORKING_DIRECTORY: FabricExample
+    steps:
+      - name: checkout
+        uses: actions/checkout@v4
+      - name: Setup Node.js (version from .nvmrc)
+        uses: actions/setup-node@v4
+        with:
+          node-version-file: '.nvmrc'
+          cache: 'yarn'
+        # Same Xcode as the build, so the simulator runtime matches the SDK.
+      - name: Use latest stable Xcode
+        uses: maxim-lobanov/setup-xcode@v1
+        with:
+          xcode-version: '26.2'
+      - name: Install AppleSimulatorUtils
+        run: brew tap wix/brew && brew trust wix/brew && brew install applesimutils
+      - name: Install root node dependencies
+        run: yarn install && yarn submodules
+      - name: Install node dependencies
+        working-directory: ${{ env.WORKING_DIRECTORY }}
+        run: yarn
+      - name: Download app built by the build job
+        uses: actions/download-artifact@v4
+        with:
+          name: build-ios-app
+          path: ${{ runner.temp }}/app
+        # Unpacked where Detox's ios.release binaryPath expects it.
+      - name: Unpack app
+        run: |
+          mkdir -p "$WORKING_DIRECTORY/ios/build/Build/Products"
+          tar -xzf "$RUNNER_TEMP/app/FabricExample-app.tar.gz" -C "$WORKING_DIRECTORY/ios/build/Build/Products"
       - name: Test app
         working-directory: ${{ env.WORKING_DIRECTORY }}
-        run: yarn test-e2e-ios
+        run: yarn ${{ matrix.script }}
       - uses: actions/upload-artifact@v4
         if: ${{ failure() }}
         with:
-          name: ios-fail-screen-shots
+          name: ios-fail-screen-shots-${{ matrix.device }}
           path: ${{ env.WORKING_DIRECTORY }}/artifacts
```

**File**: `scripts/e2e/ios-devices.js` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 const { getCommandLineResponse } = require('./command-line-helpers');
 
 const DEFAULT_APPLE_SIMULATOR_NAME = 'iPhone 17';
-const DEFAULT_APPLE_IPAD_SIMULATOR_NAME = 'iPad Pro 13-inch (M4)';
+const DEFAULT_APPLE_IPAD_SIMULATOR_NAME = 'iPad Pro 13-inch (M5)';
 const DEFAULT_IOS_VERSION = '26.5';
 
 const envVarKeys = /** @type {const} */ ({
```

**File**: `scripts/e2e/test-e2e-ios-ipad.sh` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ fi
 # Reject non-iPad names even if RNS_APPLE_SIM_NAME was set by the caller.
 if [[ "${RNS_APPLE_SIM_NAME}" != iPad* ]]; then
   echo "Error: test-e2e-ios-ipad only runs on iPad simulators, but RNS_APPLE_SIM_NAME='${RNS_APPLE_SIM_NAME}'." >&2
-  echo "       Set RNS_APPLE_SIM_NAME to an iPad model (e.g. \"iPad Pro 13-inch (M4)\")." >&2
+  echo "       Set RNS_APPLE_SIM_NAME to an iPad model (e.g. \"iPad Pro 13-inch (M5)\")." >&2
   exit 1
 fi
 export RNS_APPLE_SIM_NAME
```

---

### Incident Patch 8: `545b8e8e` (2026-09-30)
**Commit Message**: feat(Android, Stack v5): handle `direction` prop and improve RTL collapsing header workaround (#4611)

## Description

Stack v5 on Android did not fully support RTL. The collapsing header's
collapsed title was drawn over the trailing subview and the toolbar
menu, and push/pop transitions always slid the same way regardless of
direction.

This PR fixes both and exposes a `direction` prop on `StackHost`
(`inherit` | `ltr` | `rtl`) so the stack's layout direction can be set
explicitly, independently of `I18nManager` in accordance with
[RFC-996](https://github.com/software-mansion/react-native-screens-labs/blob/main-issue-tracker/rfcs/0996-rtl-and-dark-mode.md).
The prop is Android-only for now.

Closes
https://github.com/software-mansion/react-native-screens-labs/issues/891.

### Details

**The `direction` prop.** On Android it maps to React Native's
`style.direction`, which sets the native `layoutDirection` on the host
view; the whole native subtree — app bar, subviews, menu, back button
and the screen content — inherits it. `inherit` therefore falls back to
whatever a parent view resolves to, which in practice is the
`I18nManager` setting.

**The collapsing header workaround, rework

**File**: `android/src/main/java/com/swmansion/rnscreens/stack/header/StackHeaderApplicator.kt` (modified, +0/-42)
```diff
@@ -35,7 +35,6 @@ import com.swmansion.rnscreens.stack.header.appbar.StackHeaderAppBarLayout
 import com.swmansion.rnscreens.stack.header.appbar.StackHeaderContentScrimDrawable
 import com.swmansion.rnscreens.stack.header.config.StackHeaderConfigurationProviding
 import com.swmansion.rnscreens.stack.header.config.StackHeaderType
-import com.swmansion.rnscreens.stack.header.subview.StackHeaderSubview
 import com.swmansion.rnscreens.utils.dpToPx
 import com.swmansion.rnscreens.utils.resolveColorAttr
 import com.swmansion.rnscreens.utils.resolveDrawableAttr
@@ -73,7 +72,6 @@ internal class StackHeaderApplicator(
         // Make sure that we receive insets, necessary when changing header mode in runtime.
         appBar.requestApplyInsets()
         populateAppBar(appBar, config)
-        maybeApplyRTLCollapsingToolbarLayoutWorkaround(coordinatorLayout, config, appBar)
         appBar.toolbar.requestLayout()
 
         return appBar
@@ -601,46 +599,6 @@ internal class StackHeaderApplicator(
     private fun resolveDefaultOverflowIcon(toolbar: MaterialToolbar): Drawable? =
         AppCompatImageView(toolbar.context, null, androidx.appcompat.R.attr.actionOverflowButtonStyle).drawable
 
-    private fun maybeApplyRTLCollapsingToolbarLayoutWorkaround(
-        coordinatorLayout: StackHeaderCoordinatorLayout,
-        config: StackHeaderConfigurationProviding,
-        appBar: StackHeaderAppBarLayout,
-    ) {
-        // For collapsing headers, CTL lazily adds a MATCH_PARENT dummy view to the Toolbar
-        // during the first onMeasure (ensureToolbar). We need our subviews at higher indices
-        // than the dummy view so they get positioned first in RTL layout. Forcing a measure
-        // triggers the dummy view creation.
-        if (appBar is StackHeaderAppBarLayout.Collapsing && config.isRTL) {
-            appBar.measure(
-                View.MeasureSpec.makeMeasureSpec(coordinatorLayout.width, View.MeasureSpec.EXACTLY),
-                View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED),
-            )
-            moveDummyViewToFront(appBar.toolbar)
-        }
-    }
-
-    /**
-     * CollapsingToolbarLayout adds a MATCH_PARENT dummy view to the Toolbar for title bounds
-     * tracking. In RTL, the Toolbar iterates custom views in reverse child order — so the
-     * dummy view (if last) gets processed first and consumes the entire layout cursor.
-     * Moving it to index 0 ensures our subviews are processed first.
-     *
-     * See https://github.com/material-components/material-components-android/issues/1867.
-     */
-    private fun moveDummyViewToFront(toolbar: Toolbar) {
-        for (i in 0 until toolbar.childCount) {
-            val child = toolbar.getChildAt(i)
-            // Assumes only StackHeaderSubview children exist in Collapsing toolbar besides
-            // the CTL dummy view.
-            if (child !is StackHeaderSubview) {
-                val lp = child.layoutParams
-                toolbar.removeViewAt(i)
-                toolbar.addView(child, 0, lp)
-                return
-            }
-        }
-    }
-
     private fun buildTintList(
         normal: Int?,
         pressed: Int?,
```

**File**: `android/src/main/java/com/swmansion/rnscreens/stack/header/StackHeaderCoordinatorLayout.kt` (modified, +22/-0)
```diff
@@ -136,6 +136,26 @@ internal class StackHeaderCoordinatorLayout(
 
     // endregion
 
+    // region Layout direction
+
+    // Direction the header was last built against. In order to ensure correct
+    // layout and appearance (e.g. back button arrow direction), we rebuild the
+    // header on layout direction change.
+    private var builtLayoutDirection: Int? = null
+
+    override fun onRtlPropertiesChanged(layoutDirection: Int) {
+        super.onRtlPropertiesChanged(layoutDirection)
+
+        if (builtLayoutDirection == null || builtLayoutDirection == layoutDirection) {
+            return
+        }
+
+        invalidate(StackHeaderInvalidationFlags.STRUCTURE)
+        flushPendingUpdates()
+    }
+
+    // endregion
+
     // region Header updates
 
     private val wrappedContext =
@@ -186,6 +206,7 @@ internal class StackHeaderCoordinatorLayout(
             resetHeader()
             val appBar = applicator.rebuild(this, provider)
             appBarLayout = appBar
+            builtLayoutDirection = layoutDirection
             attachAppBarListeners(appBar)
         }
 
@@ -330,6 +351,7 @@ internal class StackHeaderCoordinatorLayout(
     private fun removeHeader() {
         resetHeader()
         isAppBarFullyCollapsed = null
+        builtLayoutDirection = null
         removeContentBehavior()
         requestLayout()
     }
```

**File**: `android/src/main/java/com/swmansion/rnscreens/stack/header/appbar/StackHeaderAppBarLayout.kt` (modified, +1/-1)
```diff
@@ -117,7 +117,7 @@ internal sealed class StackHeaderAppBarLayout(
         collapsedTitleGravityMode: StackHeaderCollapsedTitleGravityMode,
     ) : StackHeaderAppBarLayout(context) {
         override val toolbar =
-            MaterialToolbar(context).apply {
+            StackHeaderToolbar(context).apply {
                 elevation = 0f
                 layoutParams =
                     CollapsingToolbarLayout
```

**File**: `android/src/main/java/com/swmansion/rnscreens/stack/header/appbar/StackHeaderToolbar.kt` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+package com.swmansion.rnscreens.stack.header.appbar
+
+import android.content.Context
+import android.view.Gravity
+import android.view.View
+import android.view.ViewGroup.LayoutParams.MATCH_PARENT
+import com.google.android.material.appbar.MaterialToolbar
+import com.swmansion.rnscreens.stack.header.subview.StackHeaderSubview
+
+/**
+ * Toolbar of a collapsing header. It exists to change the gravity of the
+ * placeholder view that CollapsingToolbarLayout adds to the toolbar, so that
+ * custom subview layout under RTL is correct.
+ *
+ * CollapsingToolbarLayout tracks the area the collapsed title is drawn in by
+ * adding a placeholder view with MATCH_PARENT layout params to the toolbar -
+ * the view itself doesn't draw the title, it is only measured. The placeholder
+ * inherits the toolbar's default START gravity, which is the same layout group
+ * our leading subview goes into. The toolbar walks that group in reverse child
+ * order under RTL, so the placeholder is positioned first and takes over the
+ * whole layout cursor, leaving the collapsed title drawn over the trailing
+ * subview and the toolbar menu. CENTER_HORIZONTAL moves it to the group the
+ * toolbar positions last, clamped into what the other children left over, which
+ * is the correct rect in both directions.
+ *
+ * See https://github.com/material-components/material-components-android/issues/1867.
+ */
+internal class StackHeaderToolbar(
+    context: Context,
+) : MaterialToolbar(context) {
+    private var hasCollapsedTitlePlaceholder = false
+
+    override fun onViewAdded(child: View) {
+        super.onViewAdded(child)
+
+        val params = child.layoutParams as LayoutParams
+        if (!isCollapsedTitlePlaceholder(child, params)) {
+            return
+        }
+
+        params.gravity = Gravity.CENTER_HORIZONTAL or Gravity.CENTER_VERTICAL
+        hasCollapsedTitlePlaceholder = true
+    }
+
+    /**
+     * The placeholder is not identifiable by type - it is a plain [View] - so it is recognized by
+     * its size instead. Every view the toolbar builds for itself (navigation & collapse buttons,
+     * menu, logo, expanded action view) is WRAP_CONTENT, and so are the subviews we add, which
+     * leaves a MATCH_PARENT child of a foreign type as the placeholder and nothing else.
+     */
+    private fun isCollapsedTitlePlaceholder(
+        child: View,
+        params: LayoutParams,
+    ): Boolean =
+        child !is StackHeaderSubview &&
+            params.width == MATCH_PARENT &&
+            params.height == MATCH_PARENT
+
+    override fun onLayout(
+        changed: Boolean,
+        l: Int,
+        t: Int,
+        r: Int,
+        b: Int,
+    ) {
+        // The placeholder is added from CollapsingToolbarLayout.onMeasure, which always precedes
+        // our layout. Holds as long as the collapsing layout keeps its title enabled.
+        check(hasCollapsedTitlePlaceholder) {
+            "[RNScreens] CollapsingToolbarLayout did not add its collapsed title placeholder."
+        }
+
+        super.onLayout(changed, l, t, r, b)
+    }
+}
```

**File**: `android/src/main/java/com/swmansion/rnscreens/stack/header/config/StackHeaderConfig.kt` (modified, +0/-4)
```diff
@@ -2,7 +2,6 @@ package com.swmansion.rnscreens.stack.header.config
 
 import android.annotation.SuppressLint
 import android.graphics.drawable.Drawable
-import android.util.LayoutDirection
 import android.view.Gravity
 import com.facebook.react.uimanager.ThemedReactContext
 import com.facebook.react.views.view.ReactViewGroup
@@ -161,9 +160,6 @@ internal class StackHeaderConfig(
 
     private fun invalidateTextAppearance() = invalidate(StackHeaderInvalidationFlags.TITLE_APPEARANCE)
 
-    override val isRTL: Boolean
-        get() = layoutDirection == LayoutDirection.RTL
-
     // endregion
 
     // region Content scroll view
```

**File**: `android/src/main/java/com/swmansion/rnscreens/stack/header/config/StackHeaderConfigurationProviding.kt` (modified, +0/-2)
```diff
@@ -55,7 +55,5 @@ internal interface StackHeaderConfigurationProviding {
     val expandedSubtitleAppearance: TextAppearance
     val collapsedSubtitleAppearance: TextAppearance
 
-    val isRTL: Boolean
-
     fun setConfigurationObserver(observer: StackHeaderConfigurationObserver?)
 }
```

**File**: `android/src/main/java/com/swmansion/rnscreens/stack/screen/StackScreenFragment.kt` (modified, +4/-4)
```diff
@@ -50,10 +50,10 @@ internal class StackScreenFragment(
         allowEnterTransitionOverlap = true
         allowReturnTransitionOverlap = true
 
-        enterTransition = Slide(Gravity.RIGHT)
-        exitTransition = Slide(Gravity.LEFT)
-        returnTransition = Slide(Gravity.RIGHT)
-        reenterTransition = Slide(Gravity.LEFT)
+        enterTransition = Slide(Gravity.END)
+        exitTransition = Slide(Gravity.START)
+        returnTransition = Slide(Gravity.END)
+        reenterTransition = Slide(Gravity.START)
     }
 
     override fun onCreateView(
```

**File**: `apps/src/tests/single-feature-tests/stack-v5/index.ts` (modified, +3/-0)
```diff
@@ -35,6 +35,7 @@ import TestStackHeaderBackground from './test-stack-header-background-android';
 import TestStackHeaderStatusBarScrim from './test-stack-header-status-bar-scrim-android';
 import TestStackColorScheme from './test-stack-color-scheme';
 import TestStackHeaderHiddenRestore from './test-stack-header-hidden-restore-android';
+import TestStackLayoutDirection from './test-stack-layout-direction-android';
 import TestStackToolbarMenuState from './test-stack-toolbar-menu-state-android';
 
 // Scenario entry-point components — each scenario's default export re-exported
@@ -72,6 +73,7 @@ export { default as TestStackHeaderBackground } from './test-stack-header-backgr
 export { default as TestStackHeaderStatusBarScrim } from './test-stack-header-status-bar-scrim-android';
 export { default as TestStackColorScheme } from './test-stack-color-scheme';
 export { default as TestStackHeaderHiddenRestore } from './test-stack-header-hidden-restore-android';
+export { default as TestStackLayoutDirection } from './test-stack-layout-direction-android';
 export { default as TestStackToolbarMenuState } from './test-stack-toolbar-menu-state-android';
 
 const scenarios = {
@@ -109,6 +111,7 @@ const scenarios = {
   TestStackHeaderStatusBarScrim,
   TestStackColorScheme,
   TestStackHeaderHiddenRestore,
+  TestStackLayoutDirection,
 };
 
 const StackScenarioGroup: ScenarioGroup<keyof typeof scenarios> = {
```

---

### Incident Patch 9: `bf72a7b3` (2026-09-28)
**Commit Message**: fix(Android, Stack v5): restore valid header collapse state after re-showing the header (#4606)

## Description

Re-showing a hidden stack v5 header always brought it back **expanded**,
even when the content underneath was scrolled into its middle. That is a
state no gesture can produce, and getting into it jumps the content by
the full header height. The same defect hit a header that was `hidden`
from the moment its screen mounted.

This PR makes the collapse memory a tri-state — "collapsed", "expanded",
"unknown" — and lets the content scroll position decide when, and only
when, the memory is unknown.

Closes
https://github.com/software-mansion/react-native-screens-labs/issues/1781.

### Details

#### The problem

`hidden` invalidates `STRUCTURE`, so it always takes the rebuild path,
and `processUpdate` early-returns through `removeHeader()` — which
clears `isAppBarFullyCollapsed`. A rebuilt app bar starts expanded and
there is nothing left to re-assert against, so the header comes back at
full height regardless of where the content sits. A header hidden from
mount never had a memory in the first place.

The base PR's view retention made this visible rather than causing it:
befor

**File**: `android/src/main/java/com/swmansion/rnscreens/stack/header/StackHeaderCoordinatorLayout.kt` (modified, +11/-5)
```diff
@@ -122,8 +122,9 @@ internal class StackHeaderCoordinatorLayout(
     // Tracks whether the app bar is currently scrolled to its fully collapsed offset, so
     // processUpdate can preserve the collapsed resting state across header updates (rebuilds and
     // re-measures start expanded). This should be equivalent to Material's
-    // `collapsingTitleHelper.getExpansionFraction() == 1f` condition.
-    private var isAppBarFullyCollapsed = false
+    // `collapsingTitleHelper.getExpansionFraction() == 1f` condition. `null` means unknown: no
+    // offset has been observed since the header was last removed.
+    private var isAppBarFullyCollapsed: Boolean? = null
 
     private fun evaluateCollapseState(
         appBar: AppBarLayout,
@@ -237,18 +238,23 @@ internal class StackHeaderCoordinatorLayout(
             }
 
             // A rebuilt or re-measured app bar starts expanded; re-assert the fully-collapsed
-            // resting state so a scrolled-down screen doesn't jump. A pending action, so it wins
+            // resting state so a scrolled-down screen doesn't jump. When the state is unknown
+            // (the header was removed — hidden, config detach), infer it from the content:
+            // scrolled content implies the bar was collapsed. A pending action, so it wins
             // over applyScrollFlags' expand snap, and it resolves against the new configuration —
             // degrading to expanded when the header can no longer collapse. Fractional offsets
             // reset to expanded.
-            if (wasFullyCollapsed) {
+            if (wasFullyCollapsed ?: isContentScrolled()) {
                 appBar.setExpanded(false, false)
             }
         }
 
         onMaybeHeaderLayoutChanged()
     }
 
+    // If the scroll view hasn't reached the top, we consider it scrolled.
+    private fun isContentScrolled() = stackScreen.findContentScrollView()?.canScrollVertically(-1) == true
+
     // endregion
 
     // region Color scheme
@@ -323,7 +329,7 @@ internal class StackHeaderCoordinatorLayout(
 
     private fun removeHeader() {
         resetHeader()
-        isAppBarFullyCollapsed = false
+        isAppBarFullyCollapsed = null
         removeContentBehavior()
         requestLayout()
     }
```

**File**: `apps/src/tests/component-integration-tests/tabs-stack-v5/test-stack-tabs-stack-in-tabs-header-persistence/scenario.md` (modified, +21/-6)
```diff
@@ -6,8 +6,9 @@
 switching away to another tab and back: the app bar, its title, subtitle,
 collapse state and toolbar menu selections come back unchanged and without a
 visible flash. Header configuration changed while the tab is away - the title,
-`type` and `hidden` - is applied when the tab comes back. Pass: nothing about
-the header resets on a tab switch.
+`type` and `hidden` - is applied when the tab comes back (the collapse state of
+a re-shown header is covered in full by `test-stack-header-hidden-restore-android`).
+Pass: nothing about the header resets on a tab switch.
 
 **OS test creation version:** Android: API Level 37.
 
@@ -21,7 +22,9 @@ TBD: Planned, but will be implemented separately.
 
 ## Note
 
-- A header that has been hidden and re-shown always comes back expanded.
+- A re-shown header comes back expanded when the content is at the top and
+  fully collapsed when the content is scrolled, whatever its state before it
+  was hidden.
 - Dismiss the overflow menu (tap outside it) after checking it.
 
 ## Steps
@@ -123,21 +126,33 @@ TBD: Planned, but will be implemented separately.
 
     - [ ] The header collapses on the way down and expands again at the top.
 
-17. Switch to the "Other" tab, set "type" to `medium`, then switch back to
+17. Scroll down until "Push Details" is out of view. Switch to the "Other"
+    tab, toggle "hidden" on, then switch back to "Stack".
+
+    - [ ] The "Home" screen has no header; "Push Details" is still out of
+          view.
+
+18. Switch to the "Other" tab, toggle "hidden" off, then switch back to
     "Stack".
 
+    - [ ] The header comes back fully collapsed (see Note); "Push Details" is
+          still out of view and the content has not moved down.
+
+19. Scroll back to the top. Switch to the "Other" tab, set "type" to
+    `medium`, then switch back to "Stack".
+
     - [ ] The header is a medium header again, shorter than in step 13.
 
 ---
 
 ### Pushed screen
 
-18. Tap "Push Details", then switch to the "Other" tab and back to "Stack".
+20. Tap "Push Details", then switch to the "Other" tab and back to "Stack".
 
     - [ ] The "Details" header is still present with the title "Details" and
           a back button.
 
-19. Tap the back button.
+21. Tap the back button.
 
     - [ ] The "Details" screen is popped.
     - [ ] "Home" screen is shown again, with the title "Home v2".
```

**File**: `apps/src/tests/single-feature-tests/stack-v5/index.ts` (modified, +3/-0)
```diff
@@ -34,6 +34,7 @@ import TestStackHeaderContentInsets from './test-stack-header-content-insets-and
 import TestStackHeaderBackground from './test-stack-header-background-android';
 import TestStackHeaderStatusBarScrim from './test-stack-header-status-bar-scrim-android';
 import TestStackColorScheme from './test-stack-color-scheme';
+import TestStackHeaderHiddenRestore from './test-stack-header-hidden-restore-android';
 import TestStackToolbarMenuState from './test-stack-toolbar-menu-state-android';
 
 // Scenario entry-point components — each scenario's default export re-exported
@@ -70,6 +71,7 @@ export { default as TestStackHeaderContentInsets } from './test-stack-header-con
 export { default as TestStackHeaderBackground } from './test-stack-header-background-android';
 export { default as TestStackHeaderStatusBarScrim } from './test-stack-header-status-bar-scrim-android';
 export { default as TestStackColorScheme } from './test-stack-color-scheme';
+export { default as TestStackHeaderHiddenRestore } from './test-stack-header-hidden-restore-android';
 export { default as TestStackToolbarMenuState } from './test-stack-toolbar-menu-state-android';
 
 const scenarios = {
@@ -106,6 +108,7 @@ const scenarios = {
   TestStackHeaderBackground,
   TestStackHeaderStatusBarScrim,
   TestStackColorScheme,
+  TestStackHeaderHiddenRestore,
 };
 
 const StackScenarioGroup: ScenarioGroup<keyof typeof scenarios> = {
```

**File**: `apps/src/tests/single-feature-tests/stack-v5/test-stack-header-hidden-restore-android/index.tsx` (added, +257/-0)
```diff
@@ -0,0 +1,257 @@
+import React, { useCallback, useEffect, useMemo, useState } from 'react';
+import { Button, ScrollView, StyleSheet, View } from 'react-native';
+import { scenarioDescription } from './scenario-description';
+import { createScenario } from '@apps/tests/shared/helpers';
+import {
+  StackContainer,
+  useStackNavigationContext,
+  type StackRouteConfig,
+} from '@apps/shared/containers/stack';
+import { SettingsPicker, SettingsSwitch } from '@apps/shared';
+import { Colors } from '@apps/shared/styling';
+import {
+  type StackHeaderConfigProps,
+  type StackHeaderConfigPropsAndroid,
+  type StackHeaderTypeAndroid,
+  ScrollViewMarker,
+} from 'react-native-screens';
+import { SafeAreaView } from 'react-native-screens/experimental';
+import LongText from '@apps/shared/LongText';
+
+const HEADER_TYPES: StackHeaderTypeAndroid[] = ['small', 'medium', 'large'];
+
+type ScrollFlags = Required<
+  Pick<
+    StackHeaderConfigPropsAndroid,
+    | 'scrollFlagScroll'
+    | 'scrollFlagEnterAlways'
+    | 'scrollFlagEnterAlwaysCollapsed'
+    | 'scrollFlagExitUntilCollapsed'
+    | 'scrollFlagSnap'
+  >
+>;
+
+const ALL_FLAGS_OFF: ScrollFlags = {
+  scrollFlagScroll: false,
+  scrollFlagEnterAlways: false,
+  scrollFlagEnterAlwaysCollapsed: false,
+  scrollFlagExitUntilCollapsed: false,
+  scrollFlagSnap: false,
+};
+
+// Only valid flag combinations: `enterAlwaysCollapsed` requires `enterAlways`,
+// and both are meaningful only without `exitUntilCollapsed`.
+const SCROLL_FLAG_PRESETS = {
+  default: {
+    ...ALL_FLAGS_OFF,
+    scrollFlagScroll: true,
+    scrollFlagExitUntilCollapsed: true,
+    scrollFlagSnap: true,
+  },
+  'no snap': {
+    ...ALL_FLAGS_OFF,
+    scrollFlagScroll: true,
+    scrollFlagExitUntilCollapsed: true,
+  },
+  'scroll only': { ...ALL_FLAGS_OFF, scrollFlagScroll: true },
+  enterAlways: {
+    ...ALL_FLAGS_OFF,
+    scrollFlagScroll: true,
+    scrollFlagEnterAlways: true,
+  },
+  enterAlwaysCollapsed: {
+    ...ALL_FLAGS_OFF,
+    scrollFlagScroll: true,
+    scrollFlagEnterAlways: true,
+    scrollFlagEnterAlwaysCollapsed: true,
+  },
+  none: ALL_FLAGS_OFF,
+} satisfies Record<string, ScrollFlags>;
+
+type ScrollFlagPreset = keyof typeof SCROLL_FLAG_PRESETS;
+
+const SCROLL_FLAG_PRESET_NAMES = Object.keys(
+  SCROLL_FLAG_PRESETS,
+) as ScrollFlagPreset[];
+
+interface Config {
+  hidden: boolean;
+  headerConfig: boolean;
+  type: StackHeaderTypeAndroid;
+  scrollFlags: ScrollFlagPreset;
+}
+
+const DEFAULT_CONFIG: Config = {
+  hidden: false,
+  headerConfig: true,
+  type: 'large',
+  scrollFlags: 'default',
+};
+
+function buildHeaderConfig(config: Config): StackHeaderConfigProps | undefined {
+  if (!config.headerConfig) {
+    return undefined;
+  }
+
+  return {
+    title: 'Hidden restore',
+    hidden: config.hidden,
+    android: {
+      type: config.type,
+      ...SCROLL_FLAG_PRESETS[config.scrollFlags],
+    },
+  };
+}
+
+function HomeScreen() {
+  const { push, setRouteOptions, routeKey } = useStackNavigationContext();
+  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
+
+  const updateConfig = useCallback(
+    <K extends keyof Config>(key: K, value: Config[K]) => {
+      setConfig(prev => ({ ...prev, [key]: value }));
+    },
+    [],
+  );
+
+  const headerConfig = useMemo(() => buildHeaderConfig(config), [config]);
+
+  useEffect(() => {
+    setRouteOptions(routeKey, { headerConfig });
+  }, [headerConfig, setRouteOptions, routeKey]);
+
+  const hasHeader = config.headerConfig && !config.hidden;
+
+  return (
+    // Without a header there is nothing keeping the content below the status
+    // bar, so the top inset has to take over while the header is gone.
+    <SafeAreaView edges={{ top: !hasHeader }}>
+      <ScrollViewMarker style={styles.scrollViewMarker}>
+        <ScrollView
+          nestedScrollEnabled
+          style={styles.scroll}
+          contentContainerStyle={styles.content}
+          // The controls stick below the header so they stay reachable at any
+          // scroll offset.
+          stickyHeaderIndices={[0]}>
+          <View style={styles.controls}>
+            <SettingsSwitch
+              label="hidden"
+              value={config.hidden}
+              onValueChange={v => updateConfig('hidden', v)}
+            />
+            <SettingsSwitch
+              label="headerConfig"
+              value={config.headerConfig}
+              onValueChange={v => updateConfig('headerConfig', v)}
+            />
+            <SettingsPicker<StackHeaderTypeAndroid>
+              label="type"
+              value={config.type}
+              onValueChange={v => updateConfig('type', v)}
+              items={HEADER_TYPES}
+            />
+            <SettingsPicker<ScrollFlagPreset>
+              label="scroll flags"
+              value={config.scrollFlags}
+              onValueChange={v => updateConfig('scrollFlags', v)}
+              items={SCROLL_FLAG_PRESET_NAMES}
+            />
+            <Butt
```

**File**: `apps/src/tests/single-feature-tests/stack-v5/test-stack-header-hidden-restore-android/scenario-description.ts` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+import type { ScenarioDescription } from '@apps/tests/shared/helpers';
+
+export const scenarioDescription: ScenarioDescription = {
+  name: 'Stack header hidden restore',
+  key: 'test-stack-header-hidden-restore-android',
+  details:
+    'Test that a header removed by hidden or by detaching headerConfig comes ' +
+    'back fully collapsed over scrolled content and expanded otherwise',
+  platforms: ['android'],
+  e2eCoverage: 'tbd',
+  smokeTest: false,
+};
```

**File**: `apps/src/tests/single-feature-tests/stack-v5/test-stack-header-hidden-restore-android/scenario.md` (added, +161/-0)
```diff
@@ -0,0 +1,161 @@
+# Test Scenario: Stack header hidden restore
+
+## Details
+
+**Description:** Verifies the collapse state of a Stack v5 header after it is
+removed and shown again: by toggling `hidden` (also while a `type` change
+lands, and on a screen that mounts hidden) or by detaching `headerConfig`.
+Pass: the header comes back fully collapsed when the content is scrolled and
+expanded when the content is at the top, under every scroll-flag preset.
+
+**OS test creation version:** Android: API Level 37.
+
+## E2E test
+
+TBD: planned, will be implemented separately.
+
+## Prerequisites
+
+- Android emulator or device.
+
+## Note
+
+- A re-shown header comes back fully collapsed when the content is scrolled
+  away from the top and expanded when the content is at the top, regardless
+  of its state before removal.
+- Fully collapsed: only the toolbar row is visible. With the `scroll only`,
+  `enterAlways` and `enterAlwaysCollapsed` presets the whole header is
+  scrolled off screen instead and only the status bar scrim remains behind
+  the status bar.
+- **Known issue:** with a `medium` or `large` header and the `scroll only`,
+  `enterAlways` or `enterAlwaysCollapsed` preset, the status bar scrim fades
+  in when the header is re-shown
+  (https://github.com/software-mansion/react-native-screens-labs/issues/1782).
+
+## Steps
+
+### Baseline
+
+1. Launch the app and navigate to the **Stack header hidden restore** screen.
+
+   - [ ] The "Home" screen shows a large header titled "Hidden restore" with
+         the controls right below it.
+
+2. Scroll down one full screen, then back to the top.
+
+   - [ ] The header collapses on the way down and is expanded again at the
+         top; the controls stay pinned below it and never scroll away.
+
+---
+
+### Re-show with the content at the top
+
+3. Drag up by more than half of the header height but less than its full
+   height, then release.
+
+   - [ ] The header snaps to fully collapsed; the text below the controls has
+         not moved.
+
+4. Toggle "hidden" on.
+
+   - [ ] There is no header and the controls start below the status bar.
+
+5. Toggle "hidden" off.
+
+   - [ ] The header is back and expanded (see Note).
+
+6. Set "scroll flags" to `no snap`, drag up by less than the header height
+   and release so that the header rests part-way, then toggle "hidden" on
+   and off.
+
+   - [ ] The header comes back expanded (see Note).
+
+---
+
+### Re-show with the content scrolled
+
+7. Set "scroll flags" to `default`, scroll down one full screen, then toggle
+   "hidden" on and off.
+
+   - [ ] The header comes back fully collapsed and the text below the controls
+         has not moved.
+
+8. Scroll back to the top, toggle "hidden" on, scroll down one full screen,
+   then toggle "hidden" off.
+
+   - [ ] The header comes back fully collapsed.
+
+9. Toggle "hidden" on, scroll back to the top, then toggle "hidden" off.
+
+   - [ ] The header comes back expanded.
+
+---
+
+### Header removed in other ways
+
+10. Scroll down one full screen, toggle "hidden" on, set "type" to `medium`,
+    then toggle "hidden" off.
+
+    - [ ] The header comes back as a medium header, fully collapsed.
+
+11. Set "type" back to `large`, then toggle "headerConfig" off and on.
+
+    - [ ] The header comes back as a large header, fully collapsed.
+
+---
+
+### Scroll-flag presets
+
+12. Scroll back to the top, set "scroll flags" to `scroll only`, scroll down
+    one full screen, then toggle "hidden" on and off.
+
+    - [ ] The header comes back scrolled entirely off screen (see Known Issue in
+          the Note)
+
+13. Set "scroll flags" to `enterAlways`, scroll down one full screen, then
+    toggle "hidden" on and off.
+
+    - [ ] The header comes back scrolled entirely off screen.
+
+14. Drag down until the whole header has re-entered and release right away,
+    then toggle "hidden" on and off.
+
+    - [ ] The header comes back scrolled entirely off screen (see Note).
+
+15. Set "scroll flags" to `enterAlwaysCollapsed`, scroll down one full screen,
+    then toggle "hidden" on and off.
+
+    - [ ] The header comes back scrolled entirely off screen.
+
+16. Drag down until the toolbar row has re-entered and release right away,
+    then toggle "hidden" on and off.
+
+    - [ ] The toolbar row is gone again; only the status bar scrim is left.
+
+17. Set "scroll flags" to `none`, scroll down one full screen, then toggle
+    "hidden" on and off.
+
+    - [ ] The header comes back at its full height.
+
+18. Set "type" to `small` and "scroll flags" to `scroll only`, scroll down one
+    full screen, then toggle "hidden" on and off.
+
+    - [ ] The toolbar comes back scrolled off screen.
+
+---
+
+### Hidden from the start
+
+19. Set "type" to `large` and "scroll flags" to `default`, scroll back to the
+    top, then tap "Push Details".
+
+    - [ ] The "Details" screen has no header; its "hidden" switch starts below
+          the status bar.
+
+20. Scroll 
```

---

### Incident Patch 10: `329ce3ff` (2026-09-25)
**Commit Message**: fix(iOS, Stack v4): send dismiss event to js when pop animation ends (#4714)

## Description

Closes: #4702 

On iOS 27, using **native bottom tabs** with a **nested native stack**,
re-tapping the active tab triggers UIKit’s pop-to-root on that tab’s
navigation controller. If the user switches to another tab **while that
pop animation is still running**, UIKit can remove the nested view
controller from the stack without delivering `viewDidDisappear` to it
(behavior differs from iOS 26).

React Navigation keeps the JS stack in sync with native dismissals via
`onDismissed`, which we normally emit from `viewDidDisappear`. When that
callback is skipped, JS still believes the nested route is mounted even
though UIKit has already popped it. Returning to the first tab then
re-applies the stale JS state and the nested screen incorrectly
reappears.

This change keeps **animated** pop-to-root on tab reselection and emits
the dismiss event when the **closing transition finishes**, if the
screen is no longer on its navigation stack - covering the missing
lifecycle path without double-firing when `viewDidDisappear` still runs.

## Changes

- **`ios/legacy/RNSScreen.mm`**
- Add `notifyDismissedI

**File**: `apps/src/tests/issue-tests/Test4702.tsx` (added, +138/-0)
```diff
@@ -0,0 +1,138 @@
+import React from 'react';
+import { Button, Platform, StyleSheet, Text, View } from 'react-native';
+import { NavigationContainer } from '@react-navigation/native';
+import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
+import {
+  createNativeStackNavigator,
+  type NativeStackScreenProps,
+} from '@react-navigation/native-stack';
+import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
+
+type FirstTabStackParamList = {
+  FirstTabHome: undefined;
+  NestedScreen: undefined;
+};
+
+type TabParamList = {
+  FirstTab: undefined;
+  SecondTab: undefined;
+};
+
+const Tabs = createNativeBottomTabNavigator<TabParamList>();
+const Stack = createNativeStackNavigator<FirstTabStackParamList>();
+
+function FirstTabHome({
+  navigation,
+}: NativeStackScreenProps<FirstTabStackParamList, 'FirstTabHome'>) {
+  return (
+    <View style={styles.screen} testID="test4702-first-tab-home">
+      <Text style={styles.title}>First tab</Text>
+      <Text style={styles.description}>
+        1. Go to nested screen{'\n'}
+        2. Re-tap First tab{'\n'}
+        3. Immediately tap Second tab{'\n'}
+        4. Tap First again — expect home, not nested (iOS 27)
+      </Text>
+      <Button
+        title="Go to nested screen"
+        testID="test4702-go-nested"
+        onPress={() => navigation.navigate('NestedScreen')}
+      />
+    </View>
+  );
+}
+
+function NestedScreen({
+  navigation,
+}: NativeStackScreenProps<FirstTabStackParamList, 'NestedScreen'>) {
+  return (
+    <View style={styles.screen} testID="test4702-nested-screen">
+      <Text style={styles.title}>Nested screen</Text>
+      <Text style={styles.description}>
+        This screen is inside the first tab's native stack.
+      </Text>
+      <Button
+        title="Go back"
+        testID="test4702-go-back"
+        onPress={() => navigation.goBack()}
+      />
+    </View>
+  );
+}
+
+function FirstTab() {
+  return (
+    <Stack.Navigator screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
+      <Stack.Screen
+        name="FirstTabHome"
+        component={FirstTabHome}
+        options={{ title: 'First tab' }}
+      />
+      <Stack.Screen
+        name="NestedScreen"
+        component={NestedScreen}
+        options={{ title: 'Nested screen' }}
+      />
+    </Stack.Navigator>
+  );
+}
+
+function SecondTab() {
+  return (
+    <SafeAreaView style={styles.screen} testID="test4702-second-tab">
+      <Text style={styles.title}>Second tab</Text>
+    </SafeAreaView>
+  );
+}
+
+export default function Test4702() {
+  return (
+    <SafeAreaProvider>
+      <NavigationContainer>
+        <Tabs.Navigator screenOptions={{ headerShown: false }}>
+          <Tabs.Screen
+            name="FirstTab"
+            component={FirstTab}
+            options={{
+              title: 'First',
+              tabBarIcon: Platform.select({
+                ios: { type: 'sfSymbol', name: 'house' },
+              }),
+            }}
+          />
+          <Tabs.Screen
+            name="SecondTab"
+            component={SecondTab}
+            options={{
+              title: 'Second',
+              tabBarIcon: Platform.select({
+                ios: { type: 'sfSymbol', name: 'star' },
+              }),
+            }}
+          />
+        </Tabs.Navigator>
+      </NavigationContainer>
+    </SafeAreaProvider>
+  );
+}
+
+const styles = StyleSheet.create({
+  screen: {
+    flex: 1,
+    alignItems: 'center',
+    justifyContent: 'center',
+    padding: 24,
+    gap: 16,
+    backgroundColor: '#fff',
+  },
+  title: {
+    fontSize: 24,
+    fontWeight: '600',
+    color: '#111',
+  },
+  description: {
+    fontSize: 16,
+    textAlign: 'center',
+    color: '#444',
+  },
+});
```

**File**: `apps/src/tests/issue-tests/index.ts` (modified, +1/-0)
```diff
@@ -196,6 +196,7 @@ export { default as Test4027 } from './Test4027';
 export { default as Test4064 } from './Test4064';
 export { default as Test4090 } from './Test4090';
 export { default as Test4651 } from './Test4651';
+export { default as Test4702 } from './Test4702';
 export { default as Test4107 } from './Test4107';
 export { default as Test4132 } from './Test4132';
 export { default as Test4155 } from './Test4155';
```

**File**: `ios/legacy/RNSScreen.mm` (modified, +38/-1)
```diff
@@ -1428,6 +1428,7 @@ @implementation RNSScreen {
   BOOL _isSwiping;
   BOOL _shouldNotify;
   BOOL _isRemovedFromParent;
+  BOOL _hasNotifiedDismissed;
 }
 
 #pragma mark - Common
@@ -1439,6 +1440,7 @@ - (instancetype)initWithView:(UIView *)view
     _fakeView = [UIView new];
     _shouldNotify = YES;
     _isRemovedFromParent = NO;
+    _hasNotifiedDismissed = NO;
   }
   return self;
 }
@@ -1535,7 +1537,7 @@ - (void)viewDidDisappear:(BOOL)animated
       [self.screenView notifyDismissCancelledWithDismissCount:_dismissCount];
     } else {
       // screen dismissed, send event
-      [self.screenView notifyDismissedWithCount:_dismissCount];
+      [self notifyDismissedIfNeeded];
     }
   }
   // same flow as in viewDidAppear
@@ -1698,6 +1700,34 @@ - (void)notifyPresentedControllerDismissed
   _isRemovedFromParent = YES;
 }
 
+- (BOOL)isNativelyDismissedFromContainer
+{
+  if (self.presentingViewController != nil) {
+    return NO;
+  }
+  if (self.parentViewController == nil) {
+    return YES;
+  }
+  if ([self.parentViewController isKindOfClass:UINavigationController.class]) {
+    UINavigationController *navigationController = (UINavigationController *)self.parentViewController;
+    return ![navigationController.viewControllers containsObject:self];
+  }
+  return NO;
+}
+
+- (void)notifyDismissedIfNeeded
+{
+  if (_hasNotifiedDismissed || self.screenView.preventNativeDismiss) {
+    return;
+  }
+  if (![self isNativelyDismissedFromContainer]) {
+    return;
+  }
+  _hasNotifiedDismissed = YES;
+  _isRemovedFromParent = YES;
+  [self.screenView notifyDismissedWithCount:_dismissCount];
+}
+
 #pragma mark - transition progress related methods
 
 - (void)setupProgressNotification
@@ -1720,12 +1750,19 @@ - (void)setupProgressNotification
       [self->_animationTimer addToRunLoop:[NSRunLoop currentRunLoop] forMode:NSDefaultRunLoopMode];
     };
 
+    BOOL notifyDismissWhenTransitionEnds = _closing;
     [self.transitionCoordinator
         animateAlongsideTransition:animation
                         completion:^(id<UIViewControllerTransitionCoordinatorContext> _Nonnull context) {
                           [self->_animationTimer setPaused:YES];
                           [self->_animationTimer invalidate];
                           [self->_fakeView removeFromSuperview];
+                          // iOS 27 can skip viewDidDisappear when a tab switch
+                          // interrupts popToRoot. If this screen was popped,
+                          // notify JS when the transition ends.
+                          if (notifyDismissWhenTransitionEnds) {
+                            [self notifyDismissedIfNeeded];
+                          }
                         }];
   }
 }
```

---

### Incident Patch 11: `b4b935bd` (2026-09-24)
**Commit Message**: fix(Android, Tabs): let touches through the strip a hidden tab bar leaves behind (#4489)

## Description

With `tabBarHidden` on, a strip across the bottom of an Android tab
screen renders content but does not accept touches. The strip is exactly
as tall as the tab bar was.

`TabsAppearanceApplicator` hides the bar with
`bottomNavigationView.isVisible = !isTabBarHidden`, i.e. `View.GONE`.
Android skips `GONE` children when laying out, so the bar keeps the
bounds it was last laid out with, and Android's own touch dispatch never
reaches it (`ViewGroup.canViewReceivePointerEvents` requires `VISIBLE`).

React Native does not pick its touch target through Android's dispatch.
`JSTouchDispatcher` calls
`TouchTargetHelper.findTargetTagAndCoordinatesForTouch`, which runs a
separate hit-test over the native view tree. That walk checks bounds,
transforms and `pointerEvents`, and **never looks at visibility** —
`findTouchTargetView` iterates `viewGroup.getChildAt(i)` from the top of
the z-order down and only asks `isTouchPointInView`. `TabsContainer` is
a `FrameLayout` whose last child is the bar, so the hidden bar is the
first candidate tested for every touch, and its retained bounds capture


**File**: `FabricExample/e2e/single-feature-tests/tabs/test-tabs-tab-bar-hidden-pressable-interaction.e2e.ts` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+import { device, expect, element, by } from 'detox';
+import { selectSingleFeatureTestsScreen } from '@e2e/app/test-screen-navigation';
+import { describeIfAndroid } from '@e2e/framework/platform';
+
+// The bar is hidden on Android by setting its visibility to `GONE`, which
+// leaves the bounds it was last laid out with in place. React Native hit-tests
+// the native view tree without looking at visibility, so those retained bounds
+// used to swallow every touch aimed at the strip the bar had occupied.
+// See #4132.
+describeIfAndroid('Tab Bar Hidden Pressable Interaction', () => {
+  beforeAll(async () => {
+    await device.reloadReactNative();
+    await selectSingleFeatureTestsScreen(
+      'Tabs',
+      'test-tabs-tab-bar-hidden-pressable-interaction',
+    );
+  });
+
+  it('tab bar should be visible by default after loading screen', async () => {
+    await expect(element(by.id('tab-bar-hidden-switch'))).toHaveLabel(
+      'tabBarHidden: false',
+    );
+    await expect(element(by.id('tab-bar-item-1-id'))).toBeVisible();
+    await expect(element(by.id('tab-bar-hidden-press-count'))).toHaveText(
+      'Bottom presses: 0',
+    );
+  });
+
+  it('tab bar should be hidden after changing tabBarHidden value to true', async () => {
+    await element(by.id('tab-bar-hidden-switch')).tap();
+    await expect(element(by.id('tab-bar-hidden-switch'))).toHaveLabel(
+      'tabBarHidden: true',
+    );
+    await expect(element(by.id('tab-bar-item-1-id'))).not.toBeVisible();
+  });
+
+  it('content in the strip freed by the hidden tab bar should receive touches', async () => {
+    // The Pressable is 120dp tall and anchored to the bottom of the screen, so
+    // it covers both the strip the tab bar freed and the system navigation bar
+    // below it. 40dp below its top edge is inside the strip - the bar is at
+    // least 80dp tall plus the bottom system inset - and clear of the system
+    // navigation bar, on which taps never reach the app.
+    await element(by.id('tab-bar-hidden-bottom-pressable')).tap({
+      x: 100,
+      y: 40,
+    });
+
+    await expect(element(by.id('tab-bar-hidden-press-count'))).toHaveText(
+      'Bottom presses: 1',
+    );
+  });
+});
```

**File**: `android/src/main/java/com/swmansion/rnscreens/tabs/container/CustomBottomNavigationView.kt` (modified, +21/-1)
```diff
@@ -2,15 +2,35 @@ package com.swmansion.rnscreens.tabs.container
 
 import android.annotation.SuppressLint
 import android.content.Context
+import androidx.core.view.isVisible
+import com.facebook.react.uimanager.PointerEvents
+import com.facebook.react.uimanager.ReactPointerEventsView
 import com.google.android.material.bottomnavigation.BottomNavigationView
 
 @SuppressLint("ViewConstructor") // Should not be restored & should only be constructed by us.
 class CustomBottomNavigationView(
     context: Context,
     val container: TabsContainer,
-) : BottomNavigationView(context) {
+) : BottomNavigationView(context),
+    ReactPointerEventsView {
     private var actionOrigin: TabsActionOrigin? = null
 
+    /**
+     * The tab bar is hidden by setting its visibility to `GONE`. A `GONE` view is skipped by its
+     * parent's layout pass, so it keeps the bounds it was last laid out with, and Android's own
+     * touch dispatch ignores it (`ViewGroup.canViewReceivePointerEvents` requires `VISIBLE`).
+     *
+     * React Native does not go through Android's dispatch to pick a touch target - it runs its own
+     * hit-test over the native view tree in `TouchTargetHelper`, which only checks bounds. The
+     * retained bounds of the hidden bar therefore keep capturing every touch aimed at the content
+     * laid out underneath it. Declaring [PointerEvents.NONE] while hidden is how a native view opts
+     * out of that hit-test, which brings it back in line with Android's dispatch.
+     *
+     * See https://github.com/software-mansion/react-native-screens/issues/4132.
+     */
+    override val pointerEvents: PointerEvents
+        get() = if (isVisible) PointerEvents.AUTO else PointerEvents.NONE
+
     internal fun setSelectedItemIdWithActionOrigin(
         itemId: Int,
         actionOrigin: TabsActionOrigin,
```

**File**: `apps/src/tests/issue-tests/Test4132.tsx` (added, +330/-0)
```diff
@@ -0,0 +1,330 @@
+import React, { useLayoutEffect } from 'react';
+import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
+import { NavigationContainer } from '@react-navigation/native';
+import {
+  createNativeStackNavigator,
+  type NativeStackNavigationProp,
+} from '@react-navigation/native-stack';
+import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
+
+// Repro for https://github.com/software-mansion/react-native-screens/issues/4132
+//
+// Adapted from the maintainer's snippet in the issue thread. Differences:
+//   * `Alert.alert` replaced with `console.log`, so taps driven by raw
+//     `adb shell input tap` can be read back from logcat without a dialog
+//     blocking the next probe,
+//   * the single bottom-anchored `Pressable` is replaced with a ladder of 12
+//     stacked 30dp-tall `Pressable`s, so a tap sweep maps where the dead band
+//     starts instead of only proving that "somewhere down there is dead",
+//   * the ladder occupies the left half only and the `ScrollView` runs to the
+//     bottom of the screen, so both reported paths - a static bottom-anchored
+//     `Pressable` and a row scrolled into the strip - can be exercised on one
+//     screen without either occluding the other,
+//   * a third route mounts the tab host with the bar already hidden, covering
+//     the initial-mount case next to the runtime-toggle one.
+
+const PROBE_COUNT = 12;
+const PROBE_HEIGHT = 30;
+const PROBE_STACK_HEIGHT = PROBE_COUNT * PROBE_HEIGHT;
+
+const RootStack = createNativeStackNavigator();
+const HomeStack = createNativeStackNavigator();
+const Tab = createNativeBottomTabNavigator();
+
+function log(message: string) {
+  console.log(`[RNS4132] ${message}`);
+}
+
+type ScreenProps = {
+  navigation: NativeStackNavigationProp<Record<string, undefined>>;
+};
+
+type DeadZoneReproProps = ScreenProps & {
+  label: string;
+  badgeColor: string;
+};
+
+function DeadZoneRepro({ label, badgeColor, navigation }: DeadZoneReproProps) {
+  return (
+    <View style={styles.reproContainer}>
+      <Text
+        style={[styles.badge, { backgroundColor: badgeColor }]}
+        testID="repro-badge">
+        {label}
+      </Text>
+
+      <Pressable
+        onPress={() => log('TOP tapped')}
+        style={[styles.btn, styles.topBtn]}
+        testID="top-pressable">
+        <Text style={styles.btnText}>TOP Pressable</Text>
+      </Pressable>
+
+      <ScrollView
+        style={styles.scroll}
+        contentContainerStyle={styles.scrollContent}
+        testID="repro-scrollview">
+        {Array.from({ length: 20 }).map((_, i) => (
+          <Pressable
+            key={i}
+            onPress={() => log(`Row ${i} tapped`)}
+            style={styles.rowBtn}
+            testID={`repro-row-${i}`}>
+            <Text style={styles.btnText}>Scrollable Row {i}</Text>
+          </Pressable>
+        ))}
+      </ScrollView>
+
+      <View style={styles.probeStack} testID="probe-stack">
+        {Array.from({ length: PROBE_COUNT }).map((_, i) => (
+          <Pressable
+            key={i}
+            onPress={() => log(`PROBE ${i} tapped`)}
+            style={[
+              styles.probeRow,
+              { backgroundColor: i % 2 === 0 ? '#c62828' : '#ad1457' },
+            ]}
+            testID={`probe-${i}`}>
+            <Text style={styles.probeText}>probe {i}</Text>
+          </Pressable>
+        ))}
+      </View>
+
+      <Pressable
+        onPress={() => navigation.goBack()}
+        style={styles.backBtn}
+        testID="repro-back">
+        <Text style={styles.backBtnText}>← Go Back</Text>
+      </Pressable>
+    </View>
+  );
+}
+
+function ControlScreen({ navigation }: ScreenProps) {
+  return (
+    <DeadZoneRepro
+      label="CONTROL (root route, outside tabs)"
+      badgeColor="green"
+      navigation={navigation}
+    />
+  );
+}
+
+function DetailScreen({ navigation }: ScreenProps) {
+  useLayoutEffect(() => {
+    navigation.getParent()?.setOptions({
+      tabBarHidden: true,
+      tabBarStyle: { display: 'none' },
+    });
+    return () => {
+      navigation.getParent()?.setOptions({
+        tabBarHidden: false,
+        tabBarStyle: { display: 'flex' },
+      });
+    };
+  }, [navigation]);
+
+  return (
+    <DeadZoneRepro
+      label="DETAIL (inside tabs, tab bar hidden=true)"
+      badgeColor="orange"
+      navigation={navigation}
+    />
+  );
+}
+
+function HomeIndexScreen({ navigation }: ScreenProps) {
+  return (
+    <View style={styles.container}>
+      <Text style={styles.title}>Home tab (NativeTabs visible)</Text>
+
+      <Pressable
+        style={styles.link}
+        onPress={() => navigation.navigate('Detail')}
+        testID="open-detail">
+        <Text style={styles.linkText}>Open /detail (pushes inside tabs)</Text>
+        <Text style={styles.linkSubText}>Bug reproduces here</Text>
+      </Pressable>
+
+      <Pressable
+        style={styles.link}
+        onPress={() =>
```

**File**: `apps/src/tests/issue-tests/index.ts` (modified, +1/-0)
```diff
@@ -197,6 +197,7 @@ export { default as Test4064 } from './Test4064';
 export { default as Test4090 } from './Test4090';
 export { default as Test4651 } from './Test4651';
 export { default as Test4107 } from './Test4107';
+export { default as Test4132 } from './Test4132';
 export { default as Test4155 } from './Test4155';
 export { default as Test4161 } from './Test4161';
 export { default as Test4220 } from './Test4220';
```

**File**: `apps/src/tests/single-feature-tests/tabs/index.ts` (modified, +3/-0)
```diff
@@ -9,6 +9,7 @@ import TestTabsAppearanceDefinedBySelectedTab from './test-tabs-appearance-defin
 import TestTabsTabBarColorScheme from './test-tabs-tab-bar-color-scheme';
 import TestTabsOverrideScrollViewContentInset from './test-tabs-override-scroll-view-content-inset-ios';
 import TestTabsTabBarHidden from './test-tabs-tab-bar-hidden';
+import TestTabsTabBarHiddenPressableInteraction from './test-tabs-tab-bar-hidden-pressable-interaction';
 import TestTabsTabBarInitiallyHidden from './test-tabs-tab-bar-initially-hidden';
 import TestTabsTabBarLayoutDirection from './test-tabs-tab-bar-layout-direction';
 import TestTabsIMEInsets from './test-tabs-ime-insets-android';
@@ -39,6 +40,7 @@ export { default as TestTabsAppearanceDefinedBySelectedTab } from './test-tabs-a
 export { default as TestTabsTabBarColorScheme } from './test-tabs-tab-bar-color-scheme';
 export { default as TestTabsOverrideScrollViewContentInset } from './test-tabs-override-scroll-view-content-inset-ios';
 export { default as TestTabsTabBarHidden } from './test-tabs-tab-bar-hidden';
+export { default as TestTabsTabBarHiddenPressableInteraction } from './test-tabs-tab-bar-hidden-pressable-interaction';
 export { default as TestTabsTabBarInitiallyHidden } from './test-tabs-tab-bar-initially-hidden';
 export { default as TestTabsTabBarLayoutDirection } from './test-tabs-tab-bar-layout-direction';
 export { default as TestTabsIMEInsets } from './test-tabs-ime-insets-android';
@@ -69,6 +71,7 @@ const scenarios = {
   TestTabsTabBarColorScheme,
   TestTabsOverrideScrollViewContentInset,
   TestTabsTabBarHidden,
+  TestTabsTabBarHiddenPressableInteraction,
   TestTabsTabBarInitiallyHidden,
   TestTabsTabBarLayoutDirection,
   TestTabsIMEInsets,
```

**File**: `apps/src/tests/single-feature-tests/tabs/test-tabs-tab-bar-hidden-pressable-interaction/index.tsx` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+import { SettingsSwitch } from '@apps/shared/SettingsSwitch';
+import React from 'react';
+import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
+import { scenarioDescription } from './scenario-description';
+import { createScenario } from '@apps/tests/shared/helpers';
+import {
+  TabsContainerWithHostConfigContext,
+  type TabRouteConfig,
+  useTabsHostConfig,
+  DEFAULT_TAB_ROUTE_OPTIONS,
+} from '@apps/shared/containers/tabs';
+import { Colors } from '@apps/shared/styling';
+
+function ConfigScreen() {
+  const { hostConfig, updateHostConfig } = useTabsHostConfig();
+  const [bottomPressCount, setBottomPressCount] = React.useState(0);
+
+  return (
+    <View style={styles.container}>
+      <ScrollView style={styles.scrollView}>
+        <SettingsSwitch
+          style={styles.settingsSwitch}
+          label="tabBarHidden"
+          value={hostConfig.tabBarHidden ?? false}
+          onValueChange={value => updateHostConfig({ tabBarHidden: value })}
+          testID="tab-bar-hidden-switch"
+        />
+        <Text style={styles.hint} testID="tab-bar-hidden-press-count">
+          {`Bottom presses: ${bottomPressCount}`}
+        </Text>
+      </ScrollView>
+      {/* Anchored to the bottom of the screen so that it sits in the strip the
+          tab bar frees up when hidden. See issue #4132. */}
+      <Pressable
+        style={styles.bottomPressable}
+        testID="tab-bar-hidden-bottom-pressable"
+        onPress={() => setBottomPressCount(count => count + 1)}>
+        <Text>Bottom Pressable</Text>
+      </Pressable>
+    </View>
+  );
+}
+
+const styles = StyleSheet.create({
+  container: {
+    flex: 1,
+  },
+  scrollView: {
+    padding: 40,
+  },
+  hint: {
+    textAlign: 'center',
+  },
+  settingsSwitch: {
+    marginBottom: 15,
+  },
+  bottomPressable: {
+    position: 'absolute',
+    bottom: 0,
+    left: 0,
+    right: 0,
+    height: 120,
+    alignItems: 'center',
+    justifyContent: 'center',
+    backgroundColor: Colors.GreenLight60,
+  },
+});
+
+const ROUTE_CONFIGS: TabRouteConfig[] = [
+  {
+    name: 'Tab1',
+    element: <ConfigScreen />,
+    options: {
+      ...DEFAULT_TAB_ROUTE_OPTIONS,
+      tabBarItemTestID: 'tab-bar-item-1-id',
+      title: 'Tab1',
+      // Opt out of the SafeAreaView wrapper Android tab screens get by default,
+      // so that the content runs edge to edge and the bottom Pressable really
+      // sits in the strip the tab bar occupies, whatever the inset resolves to.
+      safeAreaConfiguration: { edges: { bottom: false } },
+    },
+  },
+];
+
+function TestTabsTabBarHiddenPressableInteraction() {
+  return <TabsContainerWithHostConfigContext routeConfigs={ROUTE_CONFIGS} />;
+}
+
+export default createScenario(
+  TestTabsTabBarHiddenPressableInteraction,
+  scenarioDescription,
+);
```

**File**: `apps/src/tests/single-feature-tests/tabs/test-tabs-tab-bar-hidden-pressable-interaction/scenario-description.ts` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+import type { ScenarioDescription } from '@apps/tests/shared/helpers';
+
+export const scenarioDescription: ScenarioDescription = {
+  name: 'Tab Bar Hidden Pressable Interaction',
+  key: 'test-tabs-tab-bar-hidden-pressable-interaction',
+  details:
+    'Test that content in the strip freed by a hidden tab bar receives touches.',
+  platforms: ['android'],
+  e2eCoverage: 'full',
+  smokeTest: false,
+};
```

**File**: `apps/src/tests/single-feature-tests/tabs/test-tabs-tab-bar-hidden-pressable-interaction/scenario.md` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+# Test Scenario: tabBarHidden Pressable interaction
+
+## Details
+
+**Description:** On Android, the tab bar is hidden by setting its visibility to `GONE`,
+which leaves the bounds it was last laid out with in place. React Native hit-tests the
+native view tree without looking at visibility, so those retained bounds used to swallow
+every touch aimed at the strip the tab bar had occupied (see #4132). This scenario ensures
+that a hidden tab bar does not interfere with React Native's Pressables laid out underneath it.
+
+**OS test creation version:** Android: API Level 36.
+
+## E2E test
+
+Full: All manual steps are covered by an E2E test.
+
+## Prerequisites
+
+- Android emulator
+
+## Note
+
+- The tab bar has to be visible first and hidden at runtime. A tab bar that starts hidden
+  is never laid out, so it keeps no bounds and does not reproduce the issue.
+
+## Steps
+
+1. Launch the app and navigate to the screen Tab Bar Hidden Pressable Interaction.
+
+- [ ] Screen with one Tab in tab bar should be displayed.
+- [ ] A green "Bottom Pressable" should be anchored to the bottom of the screen, behind the tab bar.
+- [ ] `Bottom presses: 0` should be displayed.
+
+2. Toggle `tabBarHidden` to `true`.
+
+- [ ] Tab bar should disappear immediately.
+
+3. Tap the green "Bottom Pressable" in the strip the tab bar occupied, just above the system navigation bar.
+
+- [ ] `Bottom presses` should increment. Hidden tab bar should not block Pressable interaction.
```

---

### Incident Patch 12: `f75c56fd` (2026-09-22)
**Commit Message**: fix(iOS, Tabs): prevent tab bar hidden animation on first render (#4673)

## Description

Follow-up to review from
<https://github.com/software-mansion/react-native-screens/pull/4632>.

@kligarski pointed out that if we have `tabBarHidden == true` and
`tabBarHiddenAnimationEnabled == true`
in first render, then on iOS 18 and below we'll see animation of the tab
bar hiding away
after the first render. On iOS > 18 this also happens, but the animation
is fade instead of slide
and it does not bother that much.

## Changes

Now, we animate the tab bar only when the tabBar is attached to window.
Important note: hidden tab bar is still attached to the window.

## Before & after - visual documentation

| Before | After |
| --- | --- |
| <video
src="https://github.com/user-attachments/assets/38765295-8376-4ee8-b393-e41331f6a41c"
alt="before" /> | <video
src="https://github.com/user-attachments/assets/63faa6a0-3f21-4576-bf2f-b2fd05bff895"
alt="after" /> |

## Test plan

Added dedicated single-feature-test:
`test-tabs-tab-bar-initially-hidden`.

## Checklist

- [x] Included code example that can be used to test this change.
- [x] For visual changes, included screenshots / GIFs / recordings
do

**File**: `apps/src/tests/single-feature-tests/tabs/index.ts` (modified, +3/-1)
```diff
@@ -9,6 +9,7 @@ import TestTabsAppearanceDefinedBySelectedTab from './test-tabs-appearance-defin
 import TestTabsTabBarColorScheme from './test-tabs-tab-bar-color-scheme';
 import TestTabsOverrideScrollViewContentInset from './test-tabs-override-scroll-view-content-inset-ios';
 import TestTabsTabBarHidden from './test-tabs-tab-bar-hidden';
+import TestTabsTabBarInitiallyHidden from './test-tabs-tab-bar-initially-hidden';
 import TestTabsTabBarLayoutDirection from './test-tabs-tab-bar-layout-direction';
 import TestTabsIMEInsets from './test-tabs-ime-insets-android';
 import TestTabsSpecialEffectsScrollToTop from './test-tabs-special-effects-scroll-to-top';
@@ -28,7 +29,6 @@ import TestTabsBottomAccessoryLayout from './test-tabs-bottom-accessory-layout-i
 import TestTabsBottomAccessoryVisibility from './test-tabs-bottom-accessory-visibility-ios';
 import TestTabsScreenOrientation from './test-tabs-screen-orientation';
 import TestTabsTabBarExperimentalUserInterfaceStyle from './test-tabs-tab-bar-experimental-user-interface-style-ios';
-
 // Scenario entry-point components — each scenario's default export re-exported
 // under a name for direct rendering (e.g. from App.tsx or e2e harnesses).
 export { default as TestTabsSimpleNav } from './test-tabs-simple-nav';
@@ -38,6 +38,7 @@ export { default as TestTabsAppearanceDefinedBySelectedTab } from './test-tabs-a
 export { default as TestTabsTabBarColorScheme } from './test-tabs-tab-bar-color-scheme';
 export { default as TestTabsOverrideScrollViewContentInset } from './test-tabs-override-scroll-view-content-inset-ios';
 export { default as TestTabsTabBarHidden } from './test-tabs-tab-bar-hidden';
+export { default as TestTabsTabBarInitiallyHidden } from './test-tabs-tab-bar-initially-hidden';
 export { default as TestTabsTabBarLayoutDirection } from './test-tabs-tab-bar-layout-direction';
 export { default as TestTabsIMEInsets } from './test-tabs-ime-insets-android';
 export { default as TestTabsSpecialEffectsScrollToTop } from './test-tabs-special-effects-scroll-to-top';
@@ -66,6 +67,7 @@ const scenarios = {
   TestTabsTabBarColorScheme,
   TestTabsOverrideScrollViewContentInset,
   TestTabsTabBarHidden,
+  TestTabsTabBarInitiallyHidden,
   TestTabsTabBarLayoutDirection,
   TestTabsIMEInsets,
   TestTabsSpecialEffectsScrollToTop,
```

**File**: `apps/src/tests/single-feature-tests/tabs/test-tabs-tab-bar-hidden/scenario-description.ts` (modified, +1/-1)
```diff
@@ -6,6 +6,6 @@ export const scenarioDescription: ScenarioDescription = {
   details:
     'Test tabBarHidden prop on TabsHost - toggle to show/hide the tab bar at runtime.',
   platforms: ['ios', 'android'],
-  e2eCoverage: 'full',
+  e2eCoverage: 'incomplete',
   smokeTest: false,
 };
```

**File**: `apps/src/tests/single-feature-tests/tabs/test-tabs-tab-bar-hidden/scenario.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 
 ## E2E test
 
-Full: Covers all manual scenario steps.
+Incomplete: Steps 4-5 are not covered.
 
 ## Prerequisites
 
```

**File**: `apps/src/tests/single-feature-tests/tabs/test-tabs-tab-bar-initially-hidden/index.tsx` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+import { SettingsSwitch } from '@apps/shared/SettingsSwitch';
+import React from 'react';
+import { Platform, ScrollView, Text } from 'react-native';
+import { scenarioDescription } from './scenario-description';
+import { createScenario } from '@apps/tests/shared/helpers';
+import {
+  TabsContainerWithHostConfigContext,
+  type TabRouteConfig,
+  useTabsHostConfig,
+  DEFAULT_TAB_ROUTE_OPTIONS,
+} from '@apps/shared/containers/tabs';
+
+function ConfigScreen() {
+  const { hostConfig, updateHostConfig } = useTabsHostConfig();
+
+  return (
+    <ScrollView style={{ padding: 40 }} testID="tab-bar-hidden-scrollview">
+      <Text style={{ textAlign: 'center' }}>
+        Change flag value by clicking on button.
+      </Text>
+      <SettingsSwitch
+        style={{ marginTop: 20, marginBottom: 15 }}
+        label="tabBarHidden"
+        value={hostConfig.tabBarHidden ?? false}
+        onValueChange={value => updateHostConfig({ tabBarHidden: value })}
+        testID="tab-bar-hidden-switch"
+      />
+      {Platform.OS === 'ios' && (
+        <SettingsSwitch
+          style={{ marginBottom: 15 }}
+          label="ios.tabBarHiddenAnimationEnabled"
+          value={hostConfig.ios?.tabBarHiddenAnimationEnabled ?? true}
+          onValueChange={value =>
+            updateHostConfig({ ios: { tabBarHiddenAnimationEnabled: value } })
+          }
+          testID="tab-bar-hidden-animation-enabled-switch"
+        />
+      )}
+    </ScrollView>
+  );
+}
+
+const ROUTE_CONFIGS: TabRouteConfig[] = [
+  {
+    name: 'Tab1',
+    element: <ConfigScreen />,
+    options: {
+      ...DEFAULT_TAB_ROUTE_OPTIONS,
+      tabBarItemTestID: 'tab-bar-item-1-id',
+      tabBarItemAccessibilityLabel: 'First Tab Item',
+      title: 'Tab1',
+    },
+  },
+];
+
+function TestTabsTabBarInitiallyHidden() {
+  return (
+    <TabsContainerWithHostConfigContext
+      routeConfigs={ROUTE_CONFIGS}
+      tabBarHidden
+      ios={{ tabBarHiddenAnimationEnabled: true }}
+    />
+  );
+}
+
+export default createScenario(TestTabsTabBarInitiallyHidden, scenarioDescription);
```

**File**: `apps/src/tests/single-feature-tests/tabs/test-tabs-tab-bar-initially-hidden/scenario-description.ts` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+import type { ScenarioDescription } from '@apps/tests/shared/helpers';
+
+export const scenarioDescription: ScenarioDescription = {
+  name: 'Tab Bar Initially Hidden',
+  key: 'test-tabs-tab-bar-initially-hidden',
+  details: 'Verify that there is no hide animation when tab bar is initially hidden',
+  platforms: ['ios'],
+  e2eCoverage: 'incomplete',
+  smokeTest: false,
+};
```

**File**: `apps/src/tests/single-feature-tests/tabs/test-tabs-tab-bar-initially-hidden/scenario.md` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+# Test Scenario: tabBar initially hidden
+
+## Details
+
+**Description**: This test scenario focuses on lack of animation directly after first render when the 
+`ios.tabBarHiddenAnimationEnabled` is enabled and the tab bar is initially hidden.
+
+**OS test creation version:** iOS: 18.6 and 26.2.
+
+## E2E test
+
+Incomplete: not covered at all.
+
+## Prerequisites
+
+- iOS device or simulator - make sure to run on both iOS 18 and >= 26
+
+## Steps
+
+1. Launch the app and navigate to the screen Tab Bar Initially Hidden.
+
+- [ ] The tab bar should be not visible even for a frame. There should be no animation visible.
+
+2. Toggle `tabBarHidden` to `false`.
+
+- [ ] Tab bar should appear with animation.
```

**File**: `ios/tabs/host/RNSTabsHostComponentView.mm` (modified, +3/-1)
```diff
@@ -250,7 +250,9 @@ - (void)updateProps:(const facebook::react::Props::Shared &)props
     _tabBarHidden = newComponentProps.tabBarHidden;
 #if RNS_IPHONE_OS_VERSION_AVAILABLE(18_0)
     if (@available(iOS 18.0, *)) {
-      [_controller setTabBarHidden:_tabBarHidden animated:_tabBarHiddenAnimationEnabled];
+      // Do not animate during the first render / when it's detached from the UI.
+      const BOOL shouldAnimate = [[_controller tabBar] window] != nil && _tabBarHiddenAnimationEnabled;
+      [_controller setTabBarHidden:_tabBarHidden animated:shouldAnimate];
     } else
 #endif // RNS_IPHONE_OS_VERSION_AVAILABLE(18_0)
     {
```

---

### Incident Patch 13: `7db05401` (2026-09-16)
**Commit Message**: fix(Android, FormSheet v5): Move the sheet above the keyboard (#4573)

## Description

`FormSheet` on Android has ignored the software keyboard so far. The
sheet now follows the keyboard: whichever detent it rests at, it is
pushed up by the keyboard height as far as the screen allows, and only
the part that can't be pushed above the keyboard shrinks the content
box. The sheet moves together with the keyboard animation.

Closes:
https://github.com/software-mansion/react-native-screens-labs/issues/1276

## Changes

- `FormSheetDimensionsCoordinator` tracks the IME inset and derives
`keyboardLift = max(0, ime.bottom - systemBars.bottom)`, the part of the
keyboard that sticks out above the navigation bar.
- `FormSheetDetents` extends every resting height by the lift, capped at
the container height. The peek height accounts for Material adding the
keyboard inset back on its own, **the middle detent is kept at least 2
px below the largest one so Material can still tell the two states
apart**, and the content box keeps its size while the sheet rises and
shrinks only once the sheet hits the top of the screen.
- `FormSheetKeyboardCoordinator` defines our own
`WindowInsetsAnimationCompat.Cal

**File**: `android/src/main/java/com/swmansion/rnscreens/modals/formsheet/native/coordinator/FormSheetBehaviorController.kt` (modified, +26/-10)
```diff
@@ -82,6 +82,9 @@ internal class FormSheetBehaviorController(
      * BottomSheet's height to extend its background behind the system bars, while the inner content remains within
      * the safe area. For fractional detents it is subtracted from the collapsed peek height, which Material resolves
      * above the inset, so the lowest detent lands at its fraction of [sheetAvailableSpace] like the other ones.
+     * @param keyboardLift - the part of the keyboard inset above [nativeContainerPaddingBottom]. Every resting position
+     * is extended by it so the sheet is pushed above the keyboard as far as [sheetAvailableSpace] allows,
+     * see [FormSheetDetents].
      * @param initialDetentIndex - the index of the detent the sheet should snap to while opening.
      * @param applyInitialDetent - whether the sheet should forcefully snap to the initial detent state.
      * This should typically be `true` only when the sheet transitions from closed to open.
@@ -91,6 +94,7 @@ internal class FormSheetBehaviorController(
         sheetAvailableSpace: Int,
         contentHeightForFitToContents: Int = 0,
         nativeContainerPaddingBottom: Int = 0,
+        keyboardLift: Int = 0,
         initialDetentIndex: Int = 0,
         applyInitialDetent: Boolean = false,
     ) {
@@ -101,15 +105,22 @@ internal class FormSheetBehaviorController(
         }
 
         if (detents.isFitToContents) {
-            configureFitToContents(detents, sheetAvailableSpace, contentHeightForFitToContents, nativeContainerPaddingBottom)
+            configureFitToContents(
+                detents,
+                sheetAvailableSpace,
+                contentHeightForFitToContents,
+                nativeContainerPaddingBottom,
+                keyboardLift,
+            )
         } else {
             when (detents.count) {
-                1 -> configureSingleDetent(detents, sheetAvailableSpace)
+                1 -> configureSingleDetent(detents, sheetAvailableSpace, keyboardLift)
                 2 ->
                     configureTwoDetents(
                         detents,
                         sheetAvailableSpace,
                         nativeContainerPaddingBottom,
+                        keyboardLift,
                         initialDetentIndex,
                         applyInitialDetent,
                     )
@@ -118,6 +129,7 @@ internal class FormSheetBehaviorController(
                         detents,
                         sheetAvailableSpace,
                         nativeContainerPaddingBottom,
+                        keyboardLift,
                         initialDetentIndex,
                         applyInitialDetent,
                     )
@@ -133,34 +145,37 @@ internal class FormSheetBehaviorController(
         sheetAvailableSpace: Int,
         contentHeight: Int,
         bottomInset: Int,
+        keyboardLift: Int,
     ) = behavior.apply {
         skipCollapsed = true
         isFitToContents = true
-        maxHeight = detents.maxAllowedHeightForFitToContents(sheetAvailableSpace, contentHeight, bottomInset)
+        maxHeight = detents.maxAllowedHeightForFitToContents(sheetAvailableSpace, contentHeight, bottomInset, keyboardLift)
         state = BottomSheetBehavior.STATE_EXPANDED
     }
 
     private fun configureSingleDetent(
         detents: FormSheetDetents,
         sheetAvailableSpace: Int,
+        keyboardLift: Int,
     ) = behavior.apply {
         skipCollapsed = true
         isFitToContents = true
-        maxHeight = detents.maxAllowedHeight(sheetAvailableSpace)
+        maxHeight = detents.maxAllowedHeight(sheetAvailableSpace, keyboardLift)
         state = BottomSheetBehavior.STATE_EXPANDED
     }
 
     private fun configureTwoDetents(
         detents: FormSheetDetents,
         sheetAvailableSpace: Int,
         bottomInset: Int,
+        keyboardLift: Int,
         initialDetentIndex: Int,
         applyInitialDetent: Boolean,
     ) = behavior.apply {
         skipCollapsed = false
         isFitToContents = true
-        peekHeight = detents.peekHeight(sheetAvailableSpace, bottomInset)
-        maxHeight = detents.maxAllowedHeight(sheetAvailableSpace)
+        peekHeight = detents.peekHeight(sheetAvailableSpace, bottomInset, keyboardLift)
+        maxHeight = detents.maxAllowedHeight(sheetAvailableSpace, keyboardLift)
         if (applyInitialDetent) {
             state = resolveStateFromIndex(initialDetentIndex, detents.count)
         }
@@ -170,15 +185,16 @@ internal class FormSheetBehaviorController(
         detents: FormSheetDetents,
         sheetAvailableSpace: Int,
         bottomInset: Int,
+        keyboardLift: Int,
         initialDetentIndex: Int,
         applyInitialDetent: Boolean,
     ) = behavior.apply {
         skipCollapsed = false
         isFitToContents = false
-        peekHeight = detents.peekHeight(sheetAvailableSpace, bottomInset)
-        halfExpandedRatio = detents.halfExpandedRatio()
-        expandedOffset = detents.expandedOffsetF
```

**File**: `android/src/main/java/com/swmansion/rnscreens/modals/formsheet/native/coordinator/FormSheetDimensionsCoordinator.kt` (modified, +22/-25)
```diff
@@ -4,7 +4,6 @@ import android.view.ViewGroup
 import android.widget.FrameLayout
 import androidx.core.view.ViewCompat
 import androidx.core.view.WindowInsetsCompat
-import androidx.core.view.doOnLayout
 import com.swmansion.rnscreens.modals.formsheet.native.core.FormSheetAvailableHeightProvider
 import com.swmansion.rnscreens.modals.formsheet.native.core.FormSheetContainer
 import com.swmansion.rnscreens.modals.formsheet.native.core.FormSheetDialog
@@ -14,12 +13,12 @@ import com.swmansion.rnscreens.modals.formsheet.native.model.FormSheetDetents
 internal class FormSheetDimensionsCoordinator(
     private val dialog: FormSheetDialog,
     private val container: FormSheetContainer,
-    private val bottomSheetView: FrameLayout?,
     private val behaviorController: FormSheetBehaviorController?,
 ) : FormSheetContentSizeChangeDelegate,
     FormSheetAvailableHeightProvider.OnAvailableHeightMeasuredListener {
     private var lastTopInset = 0
     private var lastBottomInset = 0
+    private var lastImeInset = 0
     private var currentDetents: FormSheetDetents? = null
     private var currentInitialDetentIndex: Int = 0
     private var shouldApplyInitialDetent: Boolean = false
@@ -34,41 +33,23 @@ internal class FormSheetDimensionsCoordinator(
     internal fun setup() {
         dialog.availableHeightProvider.availableHeightListener = this
         setupWindowInsetsListener()
-
-        bottomSheetView?.let { view ->
-            disableMaterialInsetsAnimationCallback(view)
-        }
     }
 
     private fun setupWindowInsetsListener() {
         ViewCompat.setOnApplyWindowInsetsListener(container) { _, insets ->
             val topInset = getTopInset(insets)
             val bottomInset = getBottomInset(insets)
-            if (topInset != lastTopInset || bottomInset != lastBottomInset) {
+            val imeInset = getImeInset(insets)
+            if (topInset != lastTopInset || bottomInset != lastBottomInset || imeInset != lastImeInset) {
                 lastTopInset = topInset
                 lastBottomInset = bottomInset
+                lastImeInset = imeInset
                 invalidateGeometry()
             }
             insets
         }
     }
 
-    /**
-     * BottomSheetBehavior registers an internal `WindowInsetsAnimationCallback` on the
-     * sheet view during its first `onLayoutChild`. That callback drives `translationY` to follow
-     * animated inset changes, what interferes with our slide-in custom animation.
-     *
-     * We manage insets ourselves by setting a fixed height for FormSheetContainer, so we can
-     * clear the Material's callback to remove the conflict entirely.
-     *
-     * This method must run after the first layout pass.
-     */
-    private fun disableMaterialInsetsAnimationCallback(view: FrameLayout) {
-        view.doOnLayout {
-            ViewCompat.setWindowInsetsAnimationCallback(it, null)
-        }
-    }
-
     override fun onContentHeightChanged(newHeight: Int) {
         if (currentContentHeight != newHeight) {
             currentContentHeight = newHeight
@@ -122,15 +103,21 @@ internal class FormSheetDimensionsCoordinator(
                 sheetAvailableSpace = sheetAvailableSpace,
                 contentHeightForFitToContents = currentContentHeight,
                 nativeContainerPaddingBottom = lastBottomInset,
+                keyboardLift = keyboardLift,
                 initialDetentIndex = currentInitialDetentIndex,
                 applyInitialDetent = shouldApplyInitialDetent,
             )
             shouldApplyInitialDetent = false
         }
 
         val sheetContainerHeight =
-            currentDetents?.sheetContainerHeight(sheetAvailableSpace, lastTopInset, lastBottomInset, currentContentHeight)
-                ?: (sheetAvailableSpace - lastTopInset - lastBottomInset).coerceAtLeast(0)
+            currentDetents?.sheetContainerHeight(
+                sheetAvailableSpace,
+                lastTopInset,
+                lastBottomInset,
+                currentContentHeight,
+                keyboardLift,
+            ) ?: (sheetAvailableSpace - lastTopInset - lastBottomInset - keyboardLift).coerceAtLeast(0)
 
         val layoutParams =
             container.layoutParams
@@ -143,6 +130,16 @@ internal class FormSheetDimensionsCoordinator(
         }
     }
 
+    /**
+     * The part of the keyboard inset that sticks out above the bottom system inset. Material pads the sheet by
+     * the larger of the two, so this is exactly how much the sheet has to be extended to keep its detent-sized
+     * part above the keyboard.
+     */
+    private val keyboardLift: Int
+        get() = (lastImeInset - lastBottomInset).coerceAtLeast(0)
+
+    private fun getImeInset(insetsCompat: WindowInsetsCompat): Int = insetsCompat.getInsets(WindowInsetsCompat.Type.ime()).bottom
+
     private fun getTopInset(insetsCompat: WindowInsetsCompat): Int =
         insetsCompat
             .getInsets(
```

**File**: `android/src/main/java/com/swmansion/rnscreens/modals/formsheet/native/coordinator/FormSheetKeyboardCoordinator.kt` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+package com.swmansion.rnscreens.modals.formsheet.native.coordinator
+
+import android.widget.FrameLayout
+import androidx.core.view.ViewCompat
+import androidx.core.view.WindowInsetsAnimationCompat
+import androidx.core.view.WindowInsetsCompat
+import androidx.core.view.doOnLayout
+
+internal class FormSheetKeyboardCoordinator(
+    private val bottomSheetView: FrameLayout,
+) {
+    /**
+     * Whether the sheet should track the keyboard animation. Kept `false` while an enter / exit
+     * transition owns `translationY`. Tracking the keyboard (`true`) should be allowed only when
+     * the sheet is in PRESENTED state.
+     */
+    internal var isTrackingEnabled: Boolean = false
+
+    private val insetsAnimationCallback = KeyboardInsetsAnimationCallback()
+
+    internal fun setup() {
+        // BottomSheetBehavior registers an internal `WindowInsetsAnimationCallback` on the
+        // sheet view during its first `onLayoutChild`. That callback drives `translationY` to track
+        // animated inset changes, what interferes with our slide-in custom animation.
+        //
+        // We manage insets ourselves by setting a fixed height for FormSheetContainer, so we can
+        // clear the Material's callback to remove the conflict entirely.
+        //
+        // This method must run after the first layout pass.
+        bottomSheetView.doOnLayout {
+            ViewCompat.setWindowInsetsAnimationCallback(it, insetsAnimationCallback)
+        }
+    }
+
+    internal fun destroy() {
+        ViewCompat.setWindowInsetsAnimationCallback(bottomSheetView, null)
+    }
+
+    private inner class KeyboardInsetsAnimationCallback : WindowInsetsAnimationCompat.Callback(DISPATCH_MODE_STOP) {
+        private var startTop = 0
+        private var startTranslationY = 0f
+
+        // Decided once per keyboard animation, in `onPrepare`. Tracking can't be picked up mid-animation
+        // because of no start position to translate from.
+        private var isTracking = false
+
+        private val isActive: Boolean
+            get() = isTracking && isTrackingEnabled
+
+        override fun onPrepare(animation: WindowInsetsAnimationCompat) {
+            if (!animation.isKeyboardAnimation() || !isTrackingEnabled) {
+                return
+            }
+
+            // Saving sheet's position before applying keyboard insets.
+            startTop = bottomSheetView.top
+            isTracking = true
+        }
+
+        override fun onStart(
+            animation: WindowInsetsAnimationCompat,
+            bounds: WindowInsetsAnimationCompat.BoundsCompat,
+        ): WindowInsetsAnimationCompat.BoundsCompat {
+            if (!animation.isKeyboardAnimation() || !isActive) {
+                return bounds
+            }
+
+            // The end sheet position is known - move the sheet and let the animation progress
+            // bring it to the new position.
+            startTranslationY = (startTop - bottomSheetView.top).toFloat()
+            bottomSheetView.translationY = startTranslationY
+            return bounds
+        }
+
+        override fun onProgress(
+            insets: WindowInsetsCompat,
+            runningAnimations: List<WindowInsetsAnimationCompat>,
+        ): WindowInsetsCompat {
+            if (!isActive) {
+                return insets
+            }
+
+            val keyboardAnimation = runningAnimations.firstOrNull { it.isKeyboardAnimation() } ?: return insets
+            bottomSheetView.translationY = startTranslationY * (1f - keyboardAnimation.interpolatedFraction)
+            return insets
+        }
+
+        override fun onEnd(animation: WindowInsetsAnimationCompat) {
+            if (!animation.isKeyboardAnimation()) {
+                return
+            }
+
+            if (isActive) {
+                bottomSheetView.translationY = 0f
+            }
+            isTracking = false
+        }
+
+        private fun WindowInsetsAnimationCompat.isKeyboardAnimation(): Boolean = typeMask and WindowInsetsCompat.Type.ime() != 0
+    }
+}
```

**File**: `android/src/main/java/com/swmansion/rnscreens/modals/formsheet/native/model/FormSheetDetents.kt` (modified, +51/-18)
```diff
@@ -33,58 +33,83 @@ internal class FormSheetDetents(
 
     private fun heightFractionAt(index: Int): Double = detents[index]
 
+    // Height of the sheet resting at the given detent, measured down to the bottom edge of the container.
     private fun heightAt(
         index: Int,
         containerHeight: Int,
-    ): Int = (heightFractionAt(index) * containerHeight).roundToInt()
-
-    private fun firstHeight(containerHeight: Int): Int = heightAt(0, containerHeight)
+        keyboardLift: Int,
+    ): Int = ((heightFractionAt(index) * containerHeight).roundToInt() + keyboardLift).coerceAtMost(containerHeight)
 
     /**
      * Height handed to Material as `peekHeight`. Material treats the peek height as the content height above
-     * the bottom system inset and adds that inset back (`BottomSheetBehavior.calculatePeekHeight`), while every
+     * the bottom inset and adds that inset back (`BottomSheetBehavior.calculatePeekHeight`), while every
      * other metric (`maxHeight`, `halfExpandedRatio`) describes the sheet down to the screen edge. The inset is
      * subtracted here so the lowest detent is resolved against the same reference as the other ones.
+     * Material's inset covers the keyboard as well, so the lift is subtracted along with the system inset.
      */
     internal fun peekHeight(
         containerHeight: Int,
         bottomInset: Int,
-    ): Int = (firstHeight(containerHeight) - bottomInset).coerceAtLeast(0)
+        keyboardLift: Int = 0,
+    ): Int = (heightAt(0, containerHeight, keyboardLift) - bottomInset - keyboardLift).coerceAtLeast(0)
 
-    internal fun maxAllowedHeight(containerHeight: Int): Int = heightAt(count - 1, containerHeight)
+    internal fun maxAllowedHeight(
+        containerHeight: Int,
+        keyboardLift: Int = 0,
+    ): Int = heightAt(count - 1, containerHeight, keyboardLift)
 
     internal fun maxAllowedHeightForFitToContents(
         containerHeight: Int,
         contentHeight: Int,
         bottomInset: Int,
+        keyboardLift: Int = 0,
     ): Int {
         /*
-         * We add the `bottomInset` to the `contentHeight` so that the Material BottomSheet
-         * is laid out behind the system navigation bar. The sheet's container covers the insets,
+         * We add the `bottomInset` and the `keyboardLift` to the `contentHeight` so that the Material BottomSheet
+         * is laid out behind the system navigation bar or the keyboard. The sheet's container covers the insets,
          * while the RN content is strictly constrained to `contentHeight`.
          */
         if (contentHeight <= 0) {
             // Avoid collapsing the sheet before the React content has been laid out and measured.
             return containerHeight
         }
-        return (contentHeight + bottomInset).coerceAtMost(containerHeight)
+        return (contentHeight + bottomInset + keyboardLift).coerceAtMost(containerHeight)
     }
 
-    internal fun halfExpandedRatio(): Float {
+    /**
+     * Ratio of the middle detent's sheet height to the container height, handed to Material as `halfExpandedRatio`.
+     * Material resolves the half-expanded position from it as `(int) (parentHeight * (1 - ratio))`.
+     *
+     * The keyboard lift can push both the middle and the largest detent to the top of the container. Material needs
+     * the half-expanded position strictly below the expanded one so the middle detent is kept at least
+     * [MIDDLE_DETENT_MIN_GAP] px shorter than the largest one.
+     */
+    internal fun halfExpandedRatio(
+        containerHeight: Int,
+        keyboardLift: Int = 0,
+    ): Float {
         check(count == MAX_DETENTS) { "[RNScreens] Exactly $MAX_DETENTS detents are required for halfExpandedRatio." }
-        return heightFractionAt(1).toFloat()
+        val middleDetentHeight =
+            heightAt(1, containerHeight, keyboardLift)
+                .coerceAtMost(maxAllowedHeight(containerHeight, keyboardLift) - MIDDLE_DETENT_MIN_GAP)
+                .coerceAtLeast(1)
+        return middleDetentHeight.toFloat() / containerHeight
     }
 
     internal fun expandedOffsetFromTop(
         containerHeight: Int,
         topInset: Int = 0,
+        keyboardLift: Int = 0,
     ): Int {
         check(count == MAX_DETENTS) { "[RNScreens] Exactly $MAX_DETENTS detents are required for expandedOffsetFromTop." }
-        return largestDetentTopOffset(containerHeight) + topInset
+        return largestDetentTopOffset(containerHeight, keyboardLift) + topInset
     }
 
     // Distance from the top of the window to the top of the largest detent's surface.
-    private fun largestDetentTopOffset(containerHeight: Int): Int = containerHeight - maxAllowedHeight(containerHeight)
+    private fun largestDetentTopOffset(
+        containerHeight: Int,
+        keyboardLift: Int,
+    ): Int = containerHeight - maxAllowedHeight(containerHeight, keyboardLift)
 
     /**
      * Material's BottomSheetDialog dynamically applies padding when it
```

**File**: `android/src/main/java/com/swmansion/rnscreens/modals/formsheet/native/presentation/FormSheetAnimatorFactory.kt` (modified, +3/-1)
```diff
@@ -42,7 +42,9 @@ internal class FormSheetAnimatorFactory(
         view: View,
         isInterrupting: Boolean = false,
     ): Animator {
-        val startY = if (isInterrupting) view.translationY else 0f
+        // Always leave from the current translation: besides an interrupted enter animation, the sheet
+        // may be mid-way through tracking the keyboard animation when the dismissal starts.
+        val startY = view.translationY
         val startAlpha = if (isInterrupting) dimmingManager.dimmingAlpha else dimmingManager.maxAlpha
 
         val slideAnimator =
```

**File**: `android/src/main/java/com/swmansion/rnscreens/modals/formsheet/native/presentation/FormSheetPresentation.kt` (modified, +16/-1)
```diff
@@ -8,6 +8,7 @@ import com.google.android.material.bottomsheet.BottomSheetBehavior
 import com.swmansion.rnscreens.modals.formsheet.native.coordinator.FormSheetAppearanceCoordinator
 import com.swmansion.rnscreens.modals.formsheet.native.coordinator.FormSheetBehaviorController
 import com.swmansion.rnscreens.modals.formsheet.native.coordinator.FormSheetDimensionsCoordinator
+import com.swmansion.rnscreens.modals.formsheet.native.coordinator.FormSheetKeyboardCoordinator
 import com.swmansion.rnscreens.modals.formsheet.native.coordinator.FormSheetNativeDismissCoordinator
 import com.swmansion.rnscreens.modals.formsheet.native.core.FormSheetContainer
 import com.swmansion.rnscreens.modals.formsheet.native.core.FormSheetDialog
@@ -55,10 +56,14 @@ internal class FormSheetPresentation(
         FormSheetDimensionsCoordinator(
             dialog = dialog,
             container = container,
-            bottomSheetView = bottomSheetView,
             behaviorController = behaviorController,
         )
 
+    private val keyboardCoordinator =
+        bottomSheetView?.let {
+            FormSheetKeyboardCoordinator(bottomSheetView = it)
+        }
+
     private val nativeDismissCoordinator =
         FormSheetNativeDismissCoordinator(
             dialog = dialog,
@@ -71,9 +76,18 @@ internal class FormSheetPresentation(
         nativeDismissCoordinator.setup()
         appearanceCoordinator.setup()
         dimensionsCoordinator.setup()
+        keyboardCoordinator?.setup()
         behaviorController?.setup()
     }
 
+    /**
+     * Enables tracking the keyboard animation. Expected to be on only while the sheet rests in the
+     * PRESENTED state - the enter / exit animators own `translationY` otherwise.
+     */
+    internal fun setKeyboardTrackingEnabled(enabled: Boolean) {
+        keyboardCoordinator?.isTrackingEnabled = enabled
+    }
+
     internal fun onContentHeightChanged(height: Int) {
         dimensionsCoordinator.onContentHeightChanged(height)
     }
@@ -126,6 +140,7 @@ internal class FormSheetPresentation(
         behaviorController?.destroy()
         nativeDismissCoordinator.destroy()
         dimensionsCoordinator.destroy()
+        keyboardCoordinator?.destroy()
 
         dialog.setOnShowListener(null)
         dialog.dismiss()
```

**File**: `android/src/main/java/com/swmansion/rnscreens/modals/formsheet/native/presentation/FormSheetPresentationManager.kt` (modified, +2/-0)
```diff
@@ -109,6 +109,7 @@ internal class FormSheetPresentationManager(
         }
 
         state = FormSheetPresentationState.DISMISSING
+        currentPresentation?.setKeyboardTrackingEnabled(false)
         dismissSheetsAbove()
         // Leaving the stack immediately is deliberate, if another sheet is presented during this exit animation,
         // it must stack on a "stable" sheet - the one we don't intend to dismiss. This window is about to be
@@ -246,6 +247,7 @@ internal class FormSheetPresentationManager(
     private fun onPresentationComplete() {
         if (state == FormSheetPresentationState.PRESENTING) {
             state = FormSheetPresentationState.PRESENTED
+            currentPresentation?.setKeyboardTrackingEnabled(true)
             appearanceEventEmitter?.emitOnDidAppear()
             // ensure state hasn't updated during presentation
             resolvePresentationState()
```

**File**: `apps/src/tests/single-feature-tests/form-sheet/index.ts` (modified, +3/-0)
```diff
@@ -9,6 +9,7 @@ import TestFormSheetFitToContents from './test-form-sheet-fit-to-contents';
 import TestFormSheetFractionalDetents from './test-form-sheet-fractional-detents';
 import TestFormSheetGrabberVisible from './test-form-sheet-grabber-visible';
 import TestFormSheetInitialDetentIndex from './test-form-sheet-initial-detent-index';
+import TestFormSheetKeyboard from './test-form-sheet-keyboard';
 import TestFormSheetLargestUndimmedDetentIndex from './test-form-sheet-largest-undimmed-detent-index-ios';
 import TestFormSheetLifecycleEvents from './test-form-sheet-lifecycle-events';
 import TestFormSheetNativeContainerStyle from './test-form-sheet-native-container-style';
@@ -28,6 +29,7 @@ export { default as TestFormSheetFitToContents } from './test-form-sheet-fit-to-
 export { default as TestFormSheetFractionalDetents } from './test-form-sheet-fractional-detents';
 export { default as TestFormSheetGrabberVisible } from './test-form-sheet-grabber-visible';
 export { default as TestFormSheetInitialDetentIndex } from './test-form-sheet-initial-detent-index';
+export { default as TestFormSheetKeyboard } from './test-form-sheet-keyboard';
 export { default as TestFormSheetLargestUndimmedDetentIndex } from './test-form-sheet-largest-undimmed-detent-index-ios';
 export { default as TestFormSheetLifecycleEvents } from './test-form-sheet-lifecycle-events';
 export { default as TestFormSheetNativeContainerStyle } from './test-form-sheet-native-container-style';
@@ -46,6 +48,7 @@ const scenarios = {
   TestFormSheetFractionalDetents,
   TestFormSheetGrabberVisible,
   TestFormSheetInitialDetentIndex,
+  TestFormSheetKeyboard,
   TestFormSheetLargestUndimmedDetentIndex,
   TestFormSheetLifecycleEvents,
   TestFormSheetNativeContainerStyle,
```

---

### Incident Patch 14: `8b2163ba` (2026-09-15)
**Commit Message**: fix(iOS): skip form sheet scroll view frame correction once the screen is invalidated (#4652)

## Description

Fixes #4651 (same symptom as #4090).

On iOS (Fabric), when a `formSheet` is replaced by a pushed screen in
one navigation action (`goBack()` + `navigate()`, or expo-router's
`router.replace`), the pushed screen's `ScrollView` comes up sized to
the sheet's detent height instead of the screen, and so does every later
screen that Fabric hands the same recycled `UIScrollView` instance.

#4091 removes the sheet's KVO observer synchronously in
`invalidateImpl`, but that is not the path that resizes the scroll view.
The dismissed sheet's `RNSScreenView` still receives a layout pass after
it has been invalidated; `updateBounds` →
`applyFrameCorrectionForDescendantScrollView` finds the scroll view down
its old subview chain, and `correctScrollViewFrame:` sets it back to the
sheet frame. By then Fabric has recycled that scroll view into the new
screen and laid it out at full height. With `NSLog` on 4.26.0:

```
17:10:32.309  invalidate screen=0x37b0ba200 pres=formSheet sv=0x155a6c380
17:10:32.313  correct    screen=0x37b0ba200 pres=formSheet frame={{0, 0}, {440, 464}} sv=0x155a6c38

**File**: `apps/src/tests/issue-tests/Test4651.tsx` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
+import React from 'react';
+import { NavigationContainer } from '@react-navigation/native';
+import {
+  createNativeStackNavigator,
+  type NativeStackNavigationProp,
+} from '@react-navigation/native-stack';
+import { Button, Pressable, ScrollView, Text, View } from 'react-native';
+import { Colors } from '@apps/shared/styling';
+
+// Reproduces https://github.com/software-mansion/react-native-screens/issues/4651
+//
+// A formSheet whose ScrollView is the screen's only child is replaced by a pushed
+// screen whose ScrollView is also the screen's only child and has its content at
+// mount. The pushed screen's UIScrollView ends up sized to the sheet's detent
+// (half the screen): the rows below the fold are neither painted nor tappable and
+// the list does not scroll. "Push Detail directly" shows the same screen at full
+// height, so the sheet dismissal is what breaks it.
+
+type StackParamList = {
+  Home: undefined;
+  FormSheet: undefined;
+  Detail: undefined;
+};
+
+const Stack = createNativeStackNavigator<StackParamList>();
+
+type StackNavigationProp = NativeStackNavigationProp<StackParamList>;
+
+const SCROLL_ROW_COUNT = 40;
+
+function Home({ navigation }: { navigation: StackNavigationProp }) {
+  return (
+    <View
+      style={{
+        flex: 1,
+        alignItems: 'center',
+        justifyContent: 'center',
+        gap: 16,
+        backgroundColor: Colors.White,
+      }}>
+      <Button
+        title="Open FormSheet"
+        onPress={() => navigation.navigate('FormSheet')}
+        testID="home-open-form-sheet"
+      />
+      <Button
+        title="Push Detail directly"
+        onPress={() => navigation.navigate('Detail')}
+        testID="home-push-detail"
+      />
+    </View>
+  );
+}
+
+function FormSheetScreen({ navigation }: { navigation: StackNavigationProp }) {
+  return (
+    <ScrollView
+      style={{ flex: 1, backgroundColor: Colors.GreenLight100 }}
+      contentContainerStyle={{ padding: 16, paddingTop: 72 }}>
+      {['1', '2'].map(id => (
+        <Pressable
+          key={id}
+          onPress={() => {
+            navigation.goBack();
+            navigation.navigate('Detail');
+          }}
+          style={{ paddingVertical: 16 }}
+          testID={`form-sheet-row-${id}`}>
+          <Text style={{ fontSize: 17 }}>Open Detail (row {id})</Text>
+        </Pressable>
+      ))}
+    </ScrollView>
+  );
+}
+
+function DetailScreen() {
+  return (
+    <ScrollView
+      style={{ flex: 1, backgroundColor: Colors.PurpleLight100 }}
+      contentContainerStyle={{ gap: 12, padding: 16 }}
+      contentInsetAdjustmentBehavior="automatic">
+      <Text style={{ fontSize: 24, fontWeight: '600' }}>Detail</Text>
+      {[...Array(SCROLL_ROW_COUNT).keys()].map(index => (
+        <Text key={index}>Scroll row {index}</Text>
+      ))}
+      <View style={{ borderWidth: 1, padding: 16, borderRadius: 12 }}>
+        <Text>Bottom row</Text>
+      </View>
+    </ScrollView>
+  );
+}
+
+export default function Test4651() {
+  return (
+    <NavigationContainer>
+      <Stack.Navigator
+        screenOptions={{ headerShown: true, headerTransparent: true }}>
+        <Stack.Screen
+          name="Home"
+          component={Home}
+          options={{ title: 'Home' }}
+        />
+        <Stack.Screen
+          name="FormSheet"
+          component={FormSheetScreen}
+          options={{
+            title: 'Sheet',
+            presentation: 'formSheet',
+            sheetAllowedDetents: [0.5],
+            sheetGrabberVisible: true,
+          }}
+        />
+        <Stack.Screen
+          name="Detail"
+          component={DetailScreen}
+          options={{ title: 'Detail' }}
+        />
+      </Stack.Navigator>
+    </NavigationContainer>
+  );
+}
```

**File**: `apps/src/tests/issue-tests/index.ts` (modified, +1/-0)
```diff
@@ -195,6 +195,7 @@ export { default as Test3910 } from './Test3910';
 export { default as Test4027 } from './Test4027';
 export { default as Test4064 } from './Test4064';
 export { default as Test4090 } from './Test4090';
+export { default as Test4651 } from './Test4651';
 export { default as Test4107 } from './Test4107';
 export { default as Test4155 } from './Test4155';
 export { default as Test4161 } from './Test4161';
```

**File**: `ios/legacy/RNSScreen.mm` (modified, +7/-0)
```diff
@@ -178,6 +178,13 @@ - (void)updateBounds
 
 - (void)applyFrameCorrectionForDescendantScrollView
 {
+  // A dismissed sheet can still receive a layout pass after React has deleted it. By then Fabric
+  // may have recycled its scroll view into the screen that replaced the sheet, and sizing that
+  // scroll view to the sheet would clip the new screen. See #4651.
+  if (_invalidated) {
+    return;
+  }
+
   RCTScrollViewComponentView *scrollView = [self tryFindDescendantScrollView];
   if (_sheetsScrollView != scrollView) {
     [_sheetsScrollView removeObserver:self forKeyPath:@"bounds" context:nil];
```

---

### Incident Patch 15: `28208229` (2026-09-10)
**Commit Message**: fix(Android, FormSheet v5): Prevent translation to be overridden by `doOnStart` callback (#4581)

## Description

With system animations disabled, the FormSheet stayed off-screen. The
root cause was the `doOnStart` listener attached to the entering
`AnimatorSet`. It relied on start listeners running before the child
animators produce any value, which is not the case when the duration
scale is 0.
```kt
// android.animation.AnimatorSet#start(boolean inReverse, boolean selfPulse)
boolean isEmptySet = isEmptySet(this);
if (!isEmptySet) {
  startAnimation();
}
notifyStartListeners(inReverse);
```

`startAnimation` pulses every child, but with a zero duration,
`ValueAnimator` treats the animator as already finished, so the children
synchronously apply their end values. After that, `notifyStartListeners`
runs our `doOnStart`, which moves the sheet back to `translationY =
height`.

The listener is also redundant. The `keepOffscreenUntilEnterAnimation`
applies `translationY` in the first pre-draw of the sheet, i.e. before
`OnShowListener` starts the animator.

Closes:
https://github.com/software-mansion/react-native-screens-labs/issues/1764

## Changes

- removed the `doOnStart` listener th

**File**: `android/src/main/java/com/swmansion/rnscreens/modals/formsheet/native/presentation/FormSheetAnimatorFactory.kt` (modified, +0/-2)
```diff
@@ -4,7 +4,6 @@ import android.animation.Animator
 import android.animation.AnimatorSet
 import android.animation.ValueAnimator
 import android.view.View
-import androidx.core.animation.doOnStart
 
 internal class FormSheetAnimatorFactory(
     private val dimmingManager: FormSheetDimmingManager,
@@ -36,7 +35,6 @@ internal class FormSheetAnimatorFactory(
         return AnimatorSet().apply {
             playTogether(slideAnimator, alphaAnimator)
             duration = animationDuration
-            doOnStart { view.translationY = startY }
         }
     }
 
```

#### Recent Merged Pull Requests:
- **PR #4783** (2026-10-04): docs: remove README-Fabric.md (@kkafar)
- **PR #4766** (2026-10-01): chore(deps): bump brace-expansion from 1.1.18 to 1.1.21 in /docs (@dependabot[bot])
- **PR #4765** (2026-10-01): chore(deps): bump vm2 from 3.11.6 to 3.12.2 (@dependabot[bot])
- **PR #4754** (2026-10-01): chore(deps): bump brace-expansion from 1.1.16 to 1.1.21 (@dependabot[bot])
- **PR #4753** (closed): chore: Run formatter for latest clang-format (@kmichalikk)
- **PR #4733** (2026-10-01): fix(Android): always emit warn, error and wtf RNSLog levels (@kkafar)
- **PR #4714** (2026-09-25): fix(iOS, Stack v4): send dismiss event to js when pop animation ends (@kacperzolkiewski)
- **PR #4710** (2026-09-28): chore(iOS, TVOSExample): use scene lifecycle by default (@kligarski)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
