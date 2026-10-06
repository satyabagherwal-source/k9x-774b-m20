# Forensic Learning Record (Deep Inspection): software-mansion/react-native-gesture-handler

> **Canonical Artifact**: `07_PROJECT_LEARNING/software-mansion-react-native-gesture-handler-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/software-mansion/react-native-gesture-handler](https://github.com/software-mansion/react-native-gesture-handler))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:45:11.816Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `software-mansion/react-native-gesture-handler`
- **Description**: Declarative API exposing platform native touch and gesture system to React Native.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6788 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/common-app/src/new_api/showcase/state_manager/index.tsx`
```
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  GestureDetector,
  GestureStateManager,
  usePanGesture,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { COLORS, commonStyles } from '../../../common';

export default function GestureStateManagerExample() {
  const upperPanActive = useSharedValue(0);
  const bottomPanActive = useSharedValue(0);

  const bottomPan = usePanGesture({
    onActivate: () => {
      bottomPanActive.value = 1;
    },
    onFinalize: () => {
      bottomPanActive.value = withTiming(0, { duration: 300 });
    },
    minDistance: 50,
  });

  const upperPan = usePanGesture({
    onActivate: () => {
      upperPanActive.value = 1;
      GestureStateManager.activate(bottomPan.handlerTag);
    },
    onFinalize: () => {
      upperPanActive.value = withTiming(0, { duration: 300 });
      GestureStateManager.deactivate(bottomPan.handlerTag);
    },
  });

  const upperPanStyle = useAnimatedStyle(() => ({
    backgroundColor: COLORS.PURPLE,
    transform: [{ scale: withTiming(upperPanActive.value === 1 ? 0.9 : 1) }],
    opacity: withTiming(upperPanActive.value === 1 ? 0.6 : 1),
  }));

  const bottomPanStyle = useAnimatedStyle(() => ({
    backgroundColor: COLORS.GREEN,
    transform: [{ scale: withTiming(bottomPanActive.value === 1 ? 0.9 : 1) }],
    opacity: withTiming(bottomPanActive.value === 1 ? 0.6 : 1),
  }));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GestureStateManager</Text>

      <GestureDetector gesture={upperPan}>
        <Animated.View style={[commonStyles.box, upperPanStyle]} />
      </GestureDetector>
      <Text style={styles.boxLabel}>Box A — pan me</Text>

      <GestureDetector gesture={bottomPan}>
        <Animated.View style={[commonStyles.box, bottomPanStyle]} />
      </GestureDetector>
      <Text style={styles.boxLabel}>Box B — touch me, then pan A</Text>

      <Text style={styles.hint}>
        Touch Box B to begin its pan gesture, then pan Box A. Box A calls{' '}
        <Text style={styles.code}>GestureStateManager.activate</Text> on Box
        B&apos;s gesture. Box B must have a pointer on its surface to be managed
        by StateManager.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.NAVY,
    marginBottom: 8,
  },
  boxLabel: {
    fontSize: 13,
    opacity: 0.6,
    color: COLORS.NAVY,
  },
  hint: {
    fontSize: 13,
    opacity: 0.5,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 8,
    color: COLORS.NAVY,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
});

```

### Core Architecture Module: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/core/DiagonalDirections.kt`
```
package com.swmansion.gesturehandler.core

object DiagonalDirections {
  const val DIRECTION_RIGHT_UP = GestureHandler.DIRECTION_RIGHT or GestureHandler.DIRECTION_UP
  const val DIRECTION_RIGHT_DOWN = GestureHandler.DIRECTION_RIGHT or GestureHandler.DIRECTION_DOWN
  const val DIRECTION_LEFT_UP = GestureHandler.DIRECTION_LEFT or GestureHandler.DIRECTION_UP
  const val DIRECTION_LEFT_DOWN = GestureHandler.DIRECTION_LEFT or GestureHandler.DIRECTION_DOWN
}

```

### Core Architecture Module: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/core/FlingGestureHandler.kt`
```
package com.swmansion.gesturehandler.core

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.VelocityTracker
import com.facebook.react.bridge.ReadableMap
import com.swmansion.gesturehandler.react.events.eventbuilders.FlingGestureHandlerEventDataBuilder

class FlingGestureHandler : GestureHandler() {
  var numberOfPointersRequired = DEFAULT_NUMBER_OF_TOUCHES_REQUIRED
  var direction = DEFAULT_DIRECTION

  private val maxDurationMs = DEFAULT_MAX_DURATION_MS
  private val minVelocity = DEFAULT_MIN_VELOCITY
  private val handler = Handler(Looper.getMainLooper())
  private var maxNumberOfPointersSimultaneously = 0
  private val failDelayed = Runnable { fail() }
  private var velocityTracker: VelocityTracker? = null

  override fun resetConfig() {
    super.resetConfig()
    numberOfPointersRequired = DEFAULT_NUMBER_OF_TOUCHES_REQUIRED
    direction = DEFAULT_DIRECTION
  }

  private fun startFling(event: MotionEvent) {
    velocityTracker = VelocityTracker.obtain()
    begin()
    maxNumberOfPointersSimultaneously = 1
    handler.removeCallbacksAndMessages(null)
    handler.postDelayed(failDelayed, maxDurationMs)
  }

  private fun tryEndFling(event: MotionEvent): Boolean {
    addVelocityMovement(velocityTracker, event)

    val velocityVector = Vector.fromVelocity(velocityTracker!!)

    fun getVelocityAlignment(direction: Int, maxDeviationCosine: Double): Boolean = (
      (this.direction and direction) == direction &&
        velocityVector.isSimilar(Vector.fromDirection(direction), maxDeviationCosine)
      )

    val axialAlignmentsList = arrayOf(
      DIRECTION_LEFT,
      DIRECTION_RIGHT,
      DIRECTION_UP,
      DIRECTION_DOWN,
    ).map { direction -> getVelocityAlignment(direction, MAX_AXIAL_DEVIATION) }

    val diagonalAlignmentsList = arrayOf(
      DiagonalDirections.DIRECTION_RIGHT_UP,
      DiagonalDirections.DIRECTION_RIGHT_DOWN,
      DiagonalDirections.DIRECTION_LEFT_UP,
      DiagonalDirections.DIRECTION_LEFT_DOWN,
    ).map { direction -> getVelocityAlignment(direction, MAX_DIAGONAL_DEVIATION) }

    val isAligned = axialAlignmentsList.any { it } or diagonalAlignmentsList.any { it }
    val isFast = velocityVector.magnitude > this.minVelocity

    return if (
      maxNumberOfPointersSimultaneously == numberOfPointersRequired &&
      isAligned &&
      isFast
    ) {
      handler.removeCallbacksAndMessages(null)
      activate()
      true
    } else {
      false
    }
  }
  override fun activate(force: Boolean) {
    super.activate(force)
    end()
  }

  private fun endFling(event: MotionEvent) {
    if (!tryEndFling(event)) {
      fail()
    }
  }

  override fun onHandle(event: MotionEvent, sourceEvent: MotionEvent) {
    if (shouldSkipEvent(sourceEvent)) {
      return
    }

    val state = state
    if (state == STATE_UNDETERMINED) {
      startFling(sourceEvent)
    }
    if (state == STATE_BEGAN) {
      tryEndFling(sourceEvent)
      if (sourceEvent.pointerCount > maxNumberOfPointersSimultaneously) {
        maxNumberOfPointersSimultaneously = sourceEvent.pointerCount
      }
      val action = sourceEvent.actionMasked
      if (action == MotionEvent.ACTION_UP) {
        endFling(sourceEvent)
      }
    }
  }

  override fun onCancel() {
    handler.removeCallbacksAndMessages(null)
  }

  override fun onReset() {
    velocityTracker?.recycle()
    velocityTracker = null
    handler.removeCallbacksAndMessages(null)
  }

  private fun addVelocityMovement(tracker: VelocityTracker?, event: MotionEvent) {
    val offsetX = event.rawX - event.x
    val offsetY = event.rawY - event.y
    event.offsetLocation(offsetX, offsetY)
    tracker!!.addMovement(event)
    event.offsetLocation(-offsetX, -offsetY)
  }

  class Factory : GestureHandler.Factory<FlingGestureHandler>() {
    override val type = FlingGestureHandler::class.java
    override val name = "FlingGestureHandler"

    override fun create(context: Context?): FlingGestureHandler = FlingGestureHandler()

    override fun updateConfig(handler: FlingGestureHandler, config: ReadableMap) {
      super.updateConfig(handler, config)

      if (config.hasKey(KEY_NUMBER_OF_POINTERS)) {
        handler.numberOfPointersRequired = config.getInt(KEY_NUMBER_OF_POINTERS)
      }
      if (config.hasKey(KEY_DIRECTION)) {
        handler.direction = config.getInt(KEY_DIRECTION)
      }
    }

    override fun createEventBuilder(handler: FlingGestureHandler) = FlingGestureHandlerEventDataBuilder(handler)

    companion object {
      private const val KEY_NUMBER_OF_POINTERS = "numberOfPointers"
      private const val KEY_DIRECTION = "direction"
    }
  }

  companion object {
    private const val DEFAULT_MAX_DURATION_MS: Long = 800
    private const val DEFAULT_MIN_VELOCITY: Long = 2000
    private const val DEFAULT_ALIGNMENT_CONE: Double = 30.0
    private const val DEFAULT_DIRECTION = DIRECTION_RIGHT
    private const val DEFAULT_NUMBER_OF_TOUCHES_REQUIRED = 1

    private val MAX_AXIAL_DEVIATION: Double =
      GestureUtils.coneToDeviation(DEFAULT_ALIGNMENT_CONE)
    private val MAX_DIAGONAL_DEVIATION: Double =
      GestureUtils.coneToDeviation(90 - DEFAULT_ALIGNMENT_CONE)
  }
}

```

### Core Architecture Module: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/core/GestureHandler.kt`
```
package com.swmansion.gesturehandler.core

import android.content.Context
import android.graphics.PointF
import android.view.MotionEvent
import android.view.MotionEvent.PointerCoords
import android.view.MotionEvent.PointerProperties
import android.view.View
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableArray
import com.facebook.react.uimanager.PixelUtil
import com.swmansion.gesturehandler.BuildConfig
import com.swmansion.gesturehandler.RNSVGHitTester
import com.swmansion.gesturehandler.react.RNGestureHandlerDetectorView
import com.swmansion.gesturehandler.react.events.RNGestureHandlerTouchEvent
import com.swmansion.gesturehandler.react.events.eventbuilders.GestureHandlerEventDataBuilder
import com.swmansion.gesturehandler.react.findActivity
import com.swmansion.gesturehandler.react.getPointerType
import com.swmansion.gesturehandler.react.isHoverAction
import java.lang.IllegalStateException
import java.util.*

open class GestureHandler {
  private val trackedPointerIDs = IntArray(MAX_POINTERS_COUNT)
  private var trackedPointersIDsCount = 0
  private val windowOffset = IntArray(2) { 0 }
  var tag = 0
  var testID: String? = null
  var view: View? = null
    private set

  // Host detector view is a reference to a Native Detector designated to handle events from a
  // Virtual Detector to which the gesture is assigned.
  var hostDetectorView: RNGestureHandlerDetectorView? = null

  val viewForEvents: View
    get() {
      return if (usesNativeOrVirtualDetector(actionType)) {
        hostDetectorView!!
      } else {
        view!!
      }
    }

  /**
   * The view whose coordinate space should be used when reporting event positions to JS.
   *
   * Handlers attached via the V3 NativeDetector are registered against the DetectorView wrapper,
   * which never carries user-applied transforms — those live on its child. When the detector has
   * exactly one child we descend into it so reported coordinates match the visible (transformed)
   * view, the same coordinate space V2 and the V3 VirtualGestureDetector report in. With
   * multiple children there is no JS-side way to disambiguate which child caught the pointer,
   * so we keep the detector itself as the reference frame.
   */
  val coordinateView: View?
    get() {
      val v = view
      return if (v is RNGestureHandlerDetectorView && v.childCount == 1) {
        v.getChildAt(0)
      } else {
        v
      }
    }

  var state = STATE_UNDETERMINED
    private set
  var x = 0f
    private set
  var y = 0f
    private set
  var isWithinBounds = false
    private set
  var isEnabled = true
    protected set(enabled) {
      // Don't cancel handler when not changing the value of the isEnabled, executing it always caused
      // handlers to be cancelled on re-render because that's the moment when the config is updated.
      // If the enabled prop "changed" from true to true the handler would get cancelled.
      if (view != null && isEnabled != enabled) {
        // If view is set then handler is in "active" state. In that case we want to "cancel" handler
        // when it changes enabled state so that it gets cleared from the orchestrator
        UiThreadUtil.runOnUiThread { cancel() }
      }
      field = enabled
    }
  var actionType = 0

  var forceReinitializeDuringOnHandle = false
  var changedTouchesPayload: WritableArray? = null
    private set
  var allTouchesPayload: WritableArray? = null
    private set
  var touchEventType = RNGestureHandlerTouchEvent.EVENT_UNDETERMINED
    private set
  var trackedPointersCount = 0
    private set
  private val trackedPointers: Array<PointerData?> = Array(MAX_POINTERS_COUNT) { null }
  var needsPointerData = false
  var dispatchesAnimatedEvents = false
  var dispatchesReanimatedEvents = false
  var cancelsJSResponder = true

  private var hitSlop: FloatArray? = null
  var eventCoalescingKey: Short = 0
    private set
  var lastAbsolutePositionX = 0f
    private set
  var lastAbsolutePositionY = 0f
    private set

  private var manualActivation = false

  private var lastEventOffsetX = 0f
  private var lastEventOffsetY = 0f
  var numberOfPointers = 0
    protected set
  protected var shouldCancelWhenOutside = false
  protected var orchestrator: GestureHandlerOrchestrator? = null
  var onTouchEventListener: OnTouchEventListener? = null
  private var interactionController: GestureHandlerInteractionController? = null
  var pointerType: Int = POINTER_TYPE_OTHER
    private set

  protected var mouseButton = 0

  // properties set and accessed only by the orchestrator
  var activationIndex = 0
  var isActive = false
  var isAwaiting = false
  var shouldResetProgress = false

  /**
   * Whether the handler represents a continuous gesture rather than a discrete one.
   */
  open val isContinuous: Boolean = false

  open fun dispatchStateChange(newState: Int, prevState: Int) {
    onTouchEventListener?.onStateChange(this, newState, prevState)
  }

  open fun dispatchHandlerUpdate(event: MotionEvent) {
    onTouchEventListener?.onHandlerUpdate(this, event)
  }

  open fun dispatchTouchEvent() {
    if (changedTouchesPayload != null) {
      onTouchEventListener?.onTouchEvent(this)
    }
  }

  open fun resetConfig() {
    testID = null
    needsPointerData = DEFAULT_NEEDS_POINTER_DATA
    manualActivation = DEFAULT_MANUAL_ACTIVATION
    shouldCancelWhenOutside = DEFAULT_SHOULD_CANCEL_WHEN_OUTSIDE
    isEnabled = DEFAULT_IS_ENABLED
    hitSlop = DEFAULT_HIT_SLOP
    mouseButton = DEFAULT_MOUSE_BUTTON
    dispatchesAnimatedEvents = DEFAULT_DISPATCHES_ANIMATED_EVENTS
    dispatchesReanimatedEvents = DEFAULT_DISPATCHES_REANIMATED_EVENTS
    cancelsJSResponder = DEFAULT_CANCELS_JS_RESPONDER
  }

  fun hasCommonPointers(other: GestureHandler): Boolean {
    for (i in trackedPointerIDs.indices) {
      if (trackedPointerIDs[i] != -1 && other.trackedPointerIDs[i] != -1) {
        return true
      }
    }
    return false
  }

  fun setHitSlop(leftPad: Float, topPad: Float, rightPad: Float, bottomPad: Float, width: Float, height: Float) {
    if (hitSlop == null) {
      hitSlop = FloatArray(6)
    }
    hitSlop!![HIT_SLOP_LEFT_IDX] = leftPad
    hitSlop!![HIT_SLOP_TOP_IDX] = topPad
    hitSlop!![HIT_SLOP_RIGHT_IDX] = rightPad
    hitSlop!![HIT_SLOP_BOTTOM_IDX] = bottomPad
    hitSlop!![HIT_SLOP_WIDTH_IDX] = width
    hitSlop!![HIT_SLOP_HEIGHT_IDX] = height
  }

  fun setHitSlop(padding: Float?) {
    if (padding == null) {
      hitSlop = DEFAULT_HIT_SLOP
    } else {
      setHitSlop(padding, padding, padding, padding, HIT_SLOP_NONE, HIT_SLOP_NONE)
    }
  }

  fun setInteractionController(controller: GestureHandlerInteractionController?) {
    interactionController = controller
  }

  fun prepare(view: View?, orchestrator: GestureHandlerOrchestrator?) {
    check(!(this.view != null || this.orchestrator != null)) {
      "Already prepared or hasn't been reset"
    }
    Arrays.fill(trackedPointerIDs, -1)
    trackedPointersIDsCount = 0
    state = STATE_UNDETERMINED
    this.view = view
    this.orchestrator = orchestrator

    val content = view?.context.findActivity()?.findViewById<View>(android.R.id.content)
    if (content != null) {
      content.getLocationOnScreen(windowOffset)
    } else {
      windowOffset[0] = 0
      windowOffset[1] = 0
    }

    onPrepare()
  }

  protected open fun onPrepare() {}

  private fun findNextLocalPointerId(): Int {
    var localPointerId = 0
    while (localPointerId < trackedPointersIDsCount) {
      var i = 0
      while (i < trackedPointerIDs.size) {
        if (trackedPointerIDs[i] == localPointerId) {
          break
        }
        i++
      }
      if (i == trackedPointerIDs.size) {
        return localPointerId
      }
      localPointerId++
    }
    return localPointerId
  }

  val hasTrackedPointers: Boolean
    get() = trackedPointersIDsCount > 0

  fun startTrackingPointer(pointerId: Int) {
    if (isTrackingPointer(pointerId)) {
      return
    }

    trackedPointerIDs[pointerId] = findNextLocalPointerId()
    trackedPointersIDsCount++
  }

  fun stopTrackingPointer(pointerId: Int) {
    if (!isTrackingPointer(pointerId)) {
      return
    }

    trackedPointerIDs[pointerId] = -1
    trackedPointersIDsCount--
  }

  private fun isTrackingPointer(pointerId: Int) = trackedPointerIDs[pointerId] != -1

  private fun needAdapt(event: MotionEvent): Boolean {
    if (event.pointerCount != trackedPointersIDsCount) {
      return true
    }

    for (i in trackedPointerIDs.indices) {
      val trackedPointer = trackedPointerIDs[i]
      if (trackedPointer != -1 && trackedPointer != i) {
        return true
      }
    }
    return false
  }

  private fun adaptEvent(event: MotionEvent): MotionEvent {
    if (!needAdapt(event)) {
      return event
    }
    var action = event.actionMasked
    var actionIndex = -1
    if (action == MotionEvent.ACTION_DOWN || action == MotionEvent.ACTION_POINTER_DOWN) {
      actionIndex = event.actionIndex
      val actionPointer = event.getPointerId(actionIndex)
      action = if (trackedPointerIDs[actionPointer] != -1) {
        if (trackedPointersIDsCount == 1) {
          MotionEvent.ACTION_DOWN
        } else {
          MotionEvent.ACTION_POINTER_DOWN
        }
      } else {
        MotionEvent.ACTION_MOVE
      }
    } else if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_POINTER_UP) {
      actionIndex = event.actionIndex
      val actionPointer = event.getPointerId(actionIndex)
      action = if (trackedPointerIDs[actionPointer] != -1) {
        if (trackedPointersIDsCount == 1) {
          MotionEvent.ACTION_UP
        } else {
          MotionEvent.ACTION_POINTER_UP
        }
      } else {
        MotionEvent.ACTION_MOVE
      }
    }
    initPointerProps(trackedPointersIDsCount)
    var count = 0
    val deltaX = event.rawX - event.
```

### Core Architecture Module: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/core/GestureHandlerInteractionController.kt`
```
package com.swmansion.gesturehandler.core

interface GestureHandlerInteractionController {
  fun shouldWaitForHandlerFailure(handler: GestureHandler, otherHandler: GestureHandler): Boolean
  fun shouldRequireHandlerToWaitForFailure(handler: GestureHandler, otherHandler: GestureHandler): Boolean
  fun shouldRecognizeSimultaneously(handler: GestureHandler, otherHandler: GestureHandler): Boolean
  fun shouldHandlerBeCancelledBy(handler: GestureHandler, otherHandler: GestureHandler): Boolean
}

```

### Core Architecture Module: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/core/GestureHandlerOrchestrator.kt`
```
package com.swmansion.gesturehandler.core

import android.graphics.Matrix
import android.graphics.PointF
import android.util.SparseArray
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import com.facebook.react.uimanager.ReactCompoundView
import com.facebook.react.uimanager.RootView
import com.swmansion.gesturehandler.react.RNGestureHandlerDetectorView
import com.swmansion.gesturehandler.react.RNGestureHandlerRootHelper
import com.swmansion.gesturehandler.react.RNGestureHandlerRootView
import com.swmansion.gesturehandler.react.isHoverAction
import java.util.*

class GestureHandlerOrchestrator(
  private val wrapperView: ViewGroup,
  private val handlerRegistry: GestureHandlerRegistry,
  private val viewConfigHelper: ViewConfigurationHelper,
  private val rootView: ViewGroup,
  private val onJSResponderCancelListener: OnJSResponderCancelListener,
) {
  /**
   * Minimum alpha (value from 0 to 1) that should be set to a view so that it can be treated as a
   * gesture target. E.g. if set to 0.1 then views that less than 10% opaque will be ignored when
   * traversing view hierarchy and looking for gesture handlers.
   */
  var minimumAlphaForTraversal = DEFAULT_MIN_ALPHA_FOR_TRAVERSAL
  private val gestureHandlers = arrayListOf<GestureHandler>()
  private val awaitingHandlers = arrayListOf<GestureHandler>()

  // Pool of reusable lists for snapshotting `gestureHandlers` during event delivery.
  private val handlerListPool = ArrayDeque<ArrayList<GestureHandler>>()

  private fun obtainHandlerList() = handlerListPool.pollLast() ?: ArrayList<GestureHandler>()

  private fun recycleHandlerList(list: ArrayList<GestureHandler>) {
    list.clear()
    handlerListPool.addLast(list)
  }

  // Used by `cancelTouchesInInterceptedViews`.
  private val viewsToCancel = arrayListOf<View>()
  private val pointerDownPoints = SparseArray<PointF>()

  // In `onHandlerStateChange` method we iterate through `awaitingHandlers`, but calling `tryActivate` may modify this list.
  // To avoid `ConcurrentModificationException` we iterate through copy. There is one more problem though - if handler was
  // removed from `awaitingHandlers`, it was still present in copy of original list. This hashset helps us identify which handlers
  // are really inside `awaitingHandlers`.
  // `contains` method on HashSet has O(1) complexity, so calling it inside for loop won't result in O(n^2) (contrary to ArrayList)
  private val awaitingHandlersTags = HashSet<Int>()

  var isHandlingTouch = false
    private set
  private var handlingChangeSemaphore = 0
  private var finishedHandlersCleanupScheduled = false
  private var activationIndex = 0

  /**
   * Should be called from the view wrapper
   */
  fun onTouchEvent(event: MotionEvent): Boolean {
    isHandlingTouch = true
    val action = event.actionMasked
    trackPointerDownPoints(event)
    if (action == MotionEvent.ACTION_DOWN ||
      action == MotionEvent.ACTION_POINTER_DOWN ||
      action == MotionEvent.ACTION_HOVER_MOVE
    ) {
      extractGestureHandlers(event)
    } else if (action == MotionEvent.ACTION_CANCEL) {
      cancelAll()
    }
    deliverEventToGestureHandlers(event)
    isHandlingTouch = false
    if (finishedHandlersCleanupScheduled && handlingChangeSemaphore == 0) {
      cleanupFinishedHandlers()
    }
    if (action == MotionEvent.ACTION_UP ||
      action == MotionEvent.ACTION_CANCEL ||
      action == MotionEvent.ACTION_HOVER_EXIT
    ) {
      if (gestureHandlers.isEmpty() && rootView is RootView) {
        rootView.onChildEndedNativeGesture(rootView, event)
      }
    }
    return true
  }

  fun getHandlersForView(view: View) = handlerRegistry.getHandlersForView(view)

  private fun scheduleFinishedHandlersCleanup() {
    if (isHandlingTouch || handlingChangeSemaphore != 0) {
      finishedHandlersCleanupScheduled = true
    } else {
      cleanupFinishedHandlers()
    }
  }

  private fun cleanupFinishedHandlers() {
    for (handler in gestureHandlers.asReversed()) {
      if (isFinished(handler.state) && !handler.isAwaiting) {
        handler.reset()
        handler.apply {
          isActive = false
          isAwaiting = false
          activationIndex = Int.MAX_VALUE
        }
      }
    }

    gestureHandlers.removeAll { isFinished(it.state) && !it.isAwaiting }

    finishedHandlersCleanupScheduled = false
  }

  private fun hasOtherHandlerToWaitFor(handler: GestureHandler) =
    gestureHandlers.any { !isFinished(it.state) && shouldHandlerWaitForOther(handler, it) }

  private fun shouldBeCancelledByFinishedHandler(handler: GestureHandler) =
    gestureHandlers.any { shouldHandlerWaitForOther(handler, it) && it.state == GestureHandler.STATE_END }

  private fun shouldBeCancelledByActiveHandler(handler: GestureHandler) = gestureHandlers.any {
    handler.hasCommonPointers(it) &&
      it.isActive &&
      !canRunSimultaneously(handler, it) &&
      handler.isDescendantOf(it)
  }

  private fun tryActivate(handler: GestureHandler) {
    // If we are waiting for a gesture that has successfully finished, we should cancel handler
    if (shouldBeCancelledByFinishedHandler(handler) || shouldBeCancelledByActiveHandler(handler)) {
      handler.cancel()
      return
    }

    // see if there is anyone else who we need to wait for
    if (hasOtherHandlerToWaitFor(handler)) {
      addAwaitingHandler(handler)
    } else {
      // we can activate handler right away
      makeActive(handler)
      handler.isAwaiting = false
    }
  }

  private fun cleanupAwaitingHandlers() {
    val awaitingHandlersCopy = awaitingHandlers.toList()

    for (handler in awaitingHandlersCopy) {
      if (!handler.isAwaiting) {
        awaitingHandlers.remove(handler)
        awaitingHandlersTags.remove(handler.tag)
      }
    }
  }

  /*package*/
  fun onHandlerStateChange(handler: GestureHandler, newState: Int, prevState: Int) {
    handlingChangeSemaphore += 1

    if (handler.isAwaiting &&
      (newState == GestureHandler.STATE_CANCELLED || newState == GestureHandler.STATE_FAILED)
    ) {
      handler.isAwaiting = false
    }

    if (isFinished(newState)) {
      // We have to loop through copy in order to avoid modifying collection
      // while iterating over its elements
      val currentlyAwaitingHandlers = awaitingHandlers.toList()

      // if there were handlers awaiting completion of this handler, we can trigger active state
      for (otherHandler in currentlyAwaitingHandlers) {
        if (!shouldHandlerWaitForOther(otherHandler, handler) ||
          !awaitingHandlersTags.contains(otherHandler.tag)
        ) {
          continue
        }

        if (newState == GestureHandler.STATE_END) {
          // gesture has ended, we need to kill the awaiting handler
          otherHandler.cancel()
          if (otherHandler.state == GestureHandler.STATE_END) {
            // Handle edge case, where discrete gestures end immediately after activation thus
            // their state is set to END and when the gesture they are waiting for activates they
            // should be cancelled, however `cancel` was never sent as gestures were already in the END state.
            // Send synthetic BEGAN -> CANCELLED to properly handle JS logic
            otherHandler.dispatchStateChange(
              GestureHandler.STATE_CANCELLED,
              GestureHandler.STATE_BEGAN,
            )
          }
          otherHandler.isAwaiting = false
        } else {
          // gesture has failed recognition, we may try activating
          tryActivate(otherHandler)
        }
      }
      cleanupAwaitingHandlers()
    }
    if (newState == GestureHandler.STATE_ACTIVE) {
      tryActivate(handler)
    } else if (prevState == GestureHandler.STATE_ACTIVE || prevState == GestureHandler.STATE_END) {
      if (handler.isActive) {
        handler.dispatchStateChange(newState, prevState)
      } else if (newState == GestureHandler.STATE_CANCELLED || newState == GestureHandler.STATE_FAILED
      ) {
        // Handle edge case where handler awaiting for another one tries to activate but finishes
        // before the other would not send state change event upon ending. Note that we only want
        // to do this if the newState is either CANCELLED or FAILED, if it is END we still want to
        // wait for the other handler to finish as in that case synthetic events will be sent by the
        // makeActive method.
        // This also covers the case where a discrete gesture (e.g. Tap) ends immediately after
        // activation (STATE_ACTIVE -> STATE_END) while still awaiting another handler, and is later
        // cancelled when that handler activates.
        handler.dispatchStateChange(newState, GestureHandler.STATE_BEGAN)
      }
    } else if (prevState != GestureHandler.STATE_UNDETERMINED ||
      newState != GestureHandler.STATE_CANCELLED
    ) {
      // If handler is changing state from UNDETERMINED to CANCELLED, the state change event shouldn't
      // be sent. Handler hasn't yet began so it may not be initialized which results in crashes.
      // If it doesn't crash, there may be some weird behavior on JS side, as `onFinalize` will be
      // called without calling `onBegin` first.
      handler.dispatchStateChange(newState, prevState)
    }
    handlingChangeSemaphore -= 1
    scheduleFinishedHandlersCleanup()
  }

  private fun makeActive(handler: GestureHandler) {
    val currentState = handler.state
    with(handler) {
      isAwaiting = false
      isActive = true
      shouldResetProgress = true
      activationIndex = this@GestureHandlerOrchestrator.activationIndex++
    }

    for (otherHandler in gestureHandlers.asReversed()) {
      if (shouldHandlerBeCancelledBy(otherHandler, handler)) {
        otherHandler.cancel()
      }
    }

    // Clear all awaiting handlers waiting for the current handler to fail
    for (otherHandler in awaitingHandlers.asReversed()) {
      if (shouldHandlerBeCancelledBy(otherHa
```

### Core Architecture Module: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/core/GestureHandlerRegistry.kt`
```
package com.swmansion.gesturehandler.core

import android.view.View
import java.util.*

interface GestureHandlerRegistry {
  fun getHandlersForViewWithTag(viewTag: Int): ArrayList<GestureHandler>?
  fun getHandlersForView(view: View): ArrayList<GestureHandler>?
}

```

### Core Architecture Module: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/core/GestureUtils.kt`
```
package com.swmansion.gesturehandler.core

import android.view.MotionEvent
import kotlin.math.cos

object GestureUtils {
  fun getLastPointerX(event: MotionEvent, averageTouches: Boolean): Float {
    val excludeIndex = if (event.actionMasked == MotionEvent.ACTION_POINTER_UP) {
      event.actionIndex
    } else {
      -1
    }
    return if (averageTouches) {
      var sum = 0f
      var count = 0
      for (i in 0 until event.pointerCount) {
        if (i != excludeIndex) {
          sum += event.getX(i)
          count++
        }
      }
      sum / count
    } else {
      var lastPointerIdx = event.pointerCount - 1
      if (lastPointerIdx == excludeIndex) {
        lastPointerIdx--
      }
      event.getX(lastPointerIdx)
    }
  }

  fun getLastPointerY(event: MotionEvent, averageTouches: Boolean): Float {
    val excludeIndex = if (event.actionMasked ==
      MotionEvent.ACTION_POINTER_UP
    ) {
      event.actionIndex
    } else {
      -1
    }
    return if (averageTouches) {
      var sum = 0f
      var count = 0
      for (i in 0 until event.pointerCount) {
        if (i != excludeIndex) {
          sum += event.getY(i)
          count++
        }
      }
      sum / count
    } else {
      var lastPointerIdx = event.pointerCount - 1
      if (lastPointerIdx == excludeIndex) {
        lastPointerIdx -= 1
      }
      event.getY(lastPointerIdx)
    }
  }

  fun coneToDeviation(angle: Double): Double = cos(Math.toRadians(angle / 2.0))
}

```

### Core Architecture Module: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/core/HoverGestureHandler.kt`
```
package com.swmansion.gesturehandler.core

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import com.swmansion.gesturehandler.react.RNGestureHandlerRootHelper
import com.swmansion.gesturehandler.react.events.eventbuilders.HoverGestureHandlerEventDataBuilder

class HoverGestureHandler : GestureHandler() {
  override val isContinuous = true

  private val handler = Handler(Looper.getMainLooper())
  private var finishRunnable = Runnable { finish() }
  var stylusData: StylusData = StylusData()
    private set

  private infix fun isAncestorOf(other: GestureHandler): Boolean {
    var current: View? = other.view

    while (current != null) {
      if (current == this.view) {
        return true
      }

      current = current.parent as? View
    }

    return false
  }

  private fun isViewDisplayedOverAnother(view: View, other: View, rootView: View = view.rootView): Boolean? {
    // traverse the tree starting on the root view, to see which view will be drawn first
    if (rootView == other) {
      return true
    }

    if (rootView == view) {
      return false
    }

    if (rootView is ViewGroup) {
      for (i in 0 until rootView.childCount) {
        val child = rootView.getChildAt(i)
        return isViewDisplayedOverAnother(view, other, child) ?: continue
      }
    }

    return null
  }

  override fun shouldBeCancelledBy(handler: GestureHandler): Boolean {
    if (handler is HoverGestureHandler && !(handler isAncestorOf this)) {
      return isViewDisplayedOverAnother(handler.view!!, this.view!!)!!
    }

    return super.shouldBeCancelledBy(handler)
  }

  override fun shouldRequireToWaitForFailure(handler: GestureHandler): Boolean {
    if (handler is HoverGestureHandler) {
      if (!(this isAncestorOf handler) && !(handler isAncestorOf this)) {
        isViewDisplayedOverAnother(this.view!!, handler.view!!)?.let {
          return it
        }
      }
    }

    return super.shouldRequireToWaitForFailure(handler)
  }

  override fun shouldRecognizeSimultaneously(handler: GestureHandler): Boolean {
    if (handler is HoverGestureHandler && (this isAncestorOf handler || handler isAncestorOf this)) {
      return true
    }

    if (handler is RNGestureHandlerRootHelper.RootViewGestureHandler) {
      return true
    }

    return super.shouldRecognizeSimultaneously(handler)
  }

  override fun onHandle(event: MotionEvent, sourceEvent: MotionEvent) {
    if (event.action == MotionEvent.ACTION_DOWN) {
      handler.removeCallbacksAndMessages(null)
    } else if (event.action == MotionEvent.ACTION_UP) {
      if (!isWithinBounds) {
        finish()
      }
    }
  }

  override fun onHandleHover(event: MotionEvent, sourceEvent: MotionEvent) {
    when {
      event.action == MotionEvent.ACTION_HOVER_EXIT -> {
        // Touching down synthesizes HOVER_EXIT right before ACTION_DOWN, so finish
        // with a slight delay - the DOWN cancels it and hover survives the press.
        handler.postDelayed(finishRunnable, 4)
      }

      !isWithinBounds -> {
        finish()
      }

      this.state == STATE_ACTIVE && event.getToolType(0) == MotionEvent.TOOL_TYPE_STYLUS -> {
        stylusData = StylusData.fromEvent(event)
      }

      this.state == STATE_UNDETERMINED &&
        (
          event.action == MotionEvent.ACTION_HOVER_MOVE ||
            event.action == MotionEvent.ACTION_HOVER_ENTER
          ) -> {
        begin()
        activate()
      }
    }
  }

  override fun onReset() {
    super.onReset()
    stylusData = StylusData()
  }

  private fun finish() {
    when (this.state) {
      STATE_UNDETERMINED -> cancel()
      STATE_BEGAN -> fail()
      STATE_ACTIVE -> end()
    }
  }

  class Factory : GestureHandler.Factory<HoverGestureHandler>() {
    override val type = HoverGestureHandler::class.java
    override val name = "HoverGestureHandler"

    override fun create(context: Context?): HoverGestureHandler = HoverGestureHandler()

    override fun createEventBuilder(handler: HoverGestureHandler) = HoverGestureHandlerEventDataBuilder(handler)
  }
}

```

### Core Architecture Module: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/core/LongPressGestureHandler.kt`
```
package com.swmansion.gesturehandler.core

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.MotionEvent
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.uimanager.PixelUtil
import com.swmansion.gesturehandler.react.events.eventbuilders.LongPressGestureHandlerEventDataBuilder

class LongPressGestureHandler(context: Context) : GestureHandler() {
  var minDurationMs = DEFAULT_MIN_DURATION_MS
  val duration: Int
    get() = (previousTime - startTime).toInt()
  private val defaultMaxDist: Float
  private var maxDist: Float
  private var numberOfPointersRequired: Int
  private var startX = 0f
  private var startY = 0f
  private var startTime: Long = 0
  private var previousTime: Long = 0
  private val handler = Handler(Looper.getMainLooper())
  private var currentPointers = 0

  init {
    shouldCancelWhenOutside = true

    val systemDefaultMaxDist = DEFAULT_MAX_DIST_DP * context.resources.displayMetrics.density
    defaultMaxDist = systemDefaultMaxDist
    maxDist = defaultMaxDist
    numberOfPointersRequired = DEFAULT_NUMBER_OF_POINTERS_REQUIRED
  }

  override fun resetConfig() {
    super.resetConfig()
    minDurationMs = DEFAULT_MIN_DURATION_MS
    maxDist = defaultMaxDist
    numberOfPointersRequired = DEFAULT_NUMBER_OF_POINTERS_REQUIRED
    shouldCancelWhenOutside = DEFAULT_SHOULD_CANCEL_WHEN_OUTSIDE
  }

  private fun getAverageCoords(ev: MotionEvent, excludePointer: Boolean = false): Pair<Float, Float> {
    if (!excludePointer) {
      val x = (0 until ev.pointerCount).map { ev.getX(it) }.average().toFloat()
      val y = (0 until ev.pointerCount).map { ev.getY(it) }.average().toFloat()

      return Pair(x, y)
    }

    var sumX = 0f
    var sumY = 0f

    for (i in 0 until ev.pointerCount) {
      if (i == ev.actionIndex) {
        continue
      }

      sumX += ev.getX(i)
      sumY += ev.getY(i)
    }

    val x = sumX / (ev.pointerCount - 1)
    val y = sumY / (ev.pointerCount - 1)

    return Pair(x, y)
  }

  override fun initialize(event: MotionEvent, sourceEvent: MotionEvent) {
    previousTime = SystemClock.uptimeMillis()
    startTime = previousTime
  }

  override fun onHandle(event: MotionEvent, sourceEvent: MotionEvent) {
    if (shouldSkipEvent(sourceEvent)) {
      return
    }

    if (forceReinitializeDuringOnHandle) {
      forceReinitializeDuringOnHandle = false
      initialize(event, sourceEvent)
    }

    if (state == STATE_UNDETERMINED) {
      initialize(event, sourceEvent)
      begin()

      val (x, y) = getAverageCoords(sourceEvent)
      startX = x
      startY = y

      currentPointers++
    }

    if (sourceEvent.actionMasked == MotionEvent.ACTION_POINTER_DOWN) {
      currentPointers++

      val (x, y) = getAverageCoords(sourceEvent)
      startX = x
      startY = y

      if (currentPointers > numberOfPointersRequired) {
        fail()
        currentPointers = 0
      }
    }

    if (state == STATE_BEGAN &&
      currentPointers == numberOfPointersRequired &&
      (
        sourceEvent.actionMasked == MotionEvent.ACTION_DOWN ||
          sourceEvent.actionMasked == MotionEvent.ACTION_POINTER_DOWN ||
          sourceEvent.actionMasked == MotionEvent.ACTION_BUTTON_PRESS
        )
    ) {
      handler.removeCallbacksAndMessages(null)
      if (minDurationMs > 0) {
        handler.postDelayed({ activate() }, minDurationMs)
      } else if (minDurationMs == 0L) {
        activate()
      }
    }
    if (sourceEvent.actionMasked == MotionEvent.ACTION_UP ||
      sourceEvent.actionMasked == MotionEvent.ACTION_BUTTON_RELEASE
    ) {
      currentPointers--

      handler.removeCallbacksAndMessages(null)

      if (state == STATE_ACTIVE) {
        end()
      } else {
        fail()
      }
    } else if (sourceEvent.actionMasked == MotionEvent.ACTION_POINTER_UP) {
      currentPointers--

      if (currentPointers < numberOfPointersRequired && state != STATE_ACTIVE) {
        fail()
        currentPointers = 0
      } else {
        val (x, y) = getAverageCoords(sourceEvent, true)
        startX = x
        startY = y
      }
    } else {
      // calculate distance from start
      val (x, y) = getAverageCoords(sourceEvent)

      val deltaX = x - startX
      val deltaY = y - startY
      val distSq = deltaX * deltaX + deltaY * deltaY

      if (distSq > maxDist * maxDist) {
        if (state == STATE_ACTIVE) {
          cancel()
        } else {
          fail()
        }
      }
    }
  }

  override fun onStateChange(newState: Int, previousState: Int) {
    handler.removeCallbacksAndMessages(null)
  }

  override fun dispatchStateChange(newState: Int, prevState: Int) {
    previousTime = SystemClock.uptimeMillis()
    super.dispatchStateChange(newState, prevState)
  }

  override fun dispatchHandlerUpdate(event: MotionEvent) {
    previousTime = SystemClock.uptimeMillis()
    super.dispatchHandlerUpdate(event)
  }

  override fun onReset() {
    super.onReset()
    currentPointers = 0
  }

  class Factory : GestureHandler.Factory<LongPressGestureHandler>() {
    override val type = LongPressGestureHandler::class.java
    override val name = "LongPressGestureHandler"

    override fun create(context: Context?): LongPressGestureHandler = LongPressGestureHandler((context)!!)

    override fun updateConfig(handler: LongPressGestureHandler, config: ReadableMap) {
      super.updateConfig(handler, config)
      if (config.hasKey(KEY_MIN_DURATION_MS)) {
        handler.minDurationMs = config.getInt(KEY_MIN_DURATION_MS).toLong()
      }
      if (config.hasKey(KEY_MAX_DIST)) {
        handler.maxDist = PixelUtil.toPixelFromDIP(config.getDouble(KEY_MAX_DIST))
      }
      if (config.hasKey(KEY_NUMBER_OF_POINTERS)) {
        handler.numberOfPointersRequired = config.getInt(KEY_NUMBER_OF_POINTERS)
      }
    }

    override fun createEventBuilder(handler: LongPressGestureHandler) = LongPressGestureHandlerEventDataBuilder(handler)

    companion object {
      private const val KEY_MIN_DURATION_MS = "minDurationMs"
      private const val KEY_MAX_DIST = "maxDist"
      private const val KEY_NUMBER_OF_POINTERS = "numberOfPointers"
    }
  }

  companion object {
    private const val DEFAULT_SHOULD_CANCEL_WHEN_OUTSIDE = true
    private const val DEFAULT_MIN_DURATION_MS: Long = 500
    private const val DEFAULT_MAX_DIST_DP = 10f
    private const val DEFAULT_NUMBER_OF_POINTERS_REQUIRED = 1
  }
}

```

### Core Architecture Module: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/core/ManualGestureHandler.kt`
```
package com.swmansion.gesturehandler.core

import android.content.Context
import android.view.MotionEvent
import com.swmansion.gesturehandler.react.events.eventbuilders.ManualGestureHandlerEventDataBuilder

class ManualGestureHandler : GestureHandler() {
  override val isContinuous = true

  override fun onHandle(event: MotionEvent, sourceEvent: MotionEvent) {
    if (state == STATE_UNDETERMINED) {
      begin()
    }
  }

  class Factory : GestureHandler.Factory<ManualGestureHandler>() {
    override val type = ManualGestureHandler::class.java
    override val name = "ManualGestureHandler"

    override fun create(context: Context?): ManualGestureHandler = ManualGestureHandler()

    override fun createEventBuilder(handler: ManualGestureHandler) = ManualGestureHandlerEventDataBuilder(handler)
  }
}

```

### Core Architecture Module: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/core/NativeViewGestureHandler.kt`
```
package com.swmansion.gesturehandler.core

import android.content.Context
import android.os.SystemClock
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.widget.ScrollView
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.views.scroll.ReactHorizontalScrollView
import com.facebook.react.views.scroll.ReactScrollView
import com.facebook.react.views.swiperefresh.ReactSwipeRefreshLayout
import com.facebook.react.views.text.ReactTextView
import com.facebook.react.views.textinput.ReactEditText
import com.facebook.react.views.view.ReactViewGroup
import com.swmansion.gesturehandler.react.RNGestureHandlerRootHelper
import com.swmansion.gesturehandler.react.events.eventbuilders.NativeGestureHandlerEventDataBuilder
import java.lang.reflect.Method

class NativeViewGestureHandler : GestureHandler() {
  override val isContinuous = true

  private var shouldActivateOnStart = false

  /**
   * Set this to `true` when wrapping native components that are supposed to be an exclusive
   * target for a touch stream. Like for example switch or slider component which when activated
   * aren't supposed to be cancelled by scrollview or other container that may also handle touches.
   */
  var disallowInterruption = false
    private set

  /**
   * Composes with [disallowInterruption]. When both are `true`, the handler still resists
   * discrete gesture peers but yields to continuous peers. No-op when [disallowInterruption] is `false`.
   */
  var yieldsToContinuousGestures = false
    private set

  /**
   * When set, overrides whether the connected scrollable container delays the pressed state of
   * its children (see [android.view.ViewGroup.shouldDelayChildPressedState]). Only applies to
   * views implementing `HasChildPressedStateDelay` (React Native 0.87+), no-op otherwise. The
   * override is applied for the duration of a gesture.
   */
  var delaysChildPressedState: Boolean? = null
    private set

  private var pressedStateDelayOverriddenView: View? = null

  private var hook: NativeViewGestureHandlerHook = defaultHook

  private data class ActiveUpdateSnapshot(val pointerInside: Boolean, val numberOfPointers: Int, val pointerType: Int)

  private var lastActiveUpdate: ActiveUpdateSnapshot? = null

  init {
    shouldCancelWhenOutside = true
  }

  override fun resetConfig() {
    super.resetConfig()
    shouldActivateOnStart = DEFAULT_SHOULD_ACTIVATE_ON_START
    disallowInterruption = DEFAULT_DISALLOW_INTERRUPTION
    yieldsToContinuousGestures = DEFAULT_YIELDS_TO_CONTINUOUS_GESTURES
    shouldCancelWhenOutside = DEFAULT_SHOULD_CANCEL_WHEN_OUTSIDE
    delaysChildPressedState = DEFAULT_DELAYS_CHILD_PRESSED_STATE
  }

  fun updateConfig(config: Config) {
    isEnabled = config.enabled
    shouldCancelWhenOutside = config.shouldCancelWhenOutside
    testID = config.testID
    val hitSlop = config.hitSlop
    if (hitSlop != null) {
      setHitSlop(hitSlop.left, hitSlop.top, hitSlop.right, hitSlop.bottom, HIT_SLOP_NONE, HIT_SLOP_NONE)
    } else {
      setHitSlop(null)
    }
    shouldActivateOnStart = config.shouldActivateOnStart
    disallowInterruption = config.disallowInterruption
    yieldsToContinuousGestures = config.yieldsToContinuousGestures
    delaysChildPressedState = config.delaysChildPressedState
  }

  override fun shouldRecognizeSimultaneously(handler: GestureHandler): Boolean {
    // if the gesture is marked by user as simultaneous with other or the hook return true
    hook.shouldRecognizeSimultaneously(handler)?.let {
      return@shouldRecognizeSimultaneously it
    }

    if (super.shouldRecognizeSimultaneously(handler)) {
      return true
    }

    if (handler is NativeViewGestureHandler) {
      // Special case when the peer handler is also an instance of NativeViewGestureHandler:
      // For the `disallowInterruption` to work correctly we need to check the property when
      // accessed as a peer, because simultaneous recognizers can be set on either side of the
      // connection.
      if (handler.state == STATE_ACTIVE &&
        handler.disallowInterruption &&
        !handler.yieldsToContinuousGestures
      ) {
        // other handler is active and it disallows interruption, we don't want to get into its way
        return false
      }
    }
    val canBeInterrupted = canBeInterruptedBy(handler)
    val otherState = handler.state
    return if (state == STATE_ACTIVE && otherState == STATE_ACTIVE && canBeInterrupted) {
      // if both handlers are active and the current handler can be interrupted it we return `false`
      // as it means the other handler has turned active and returning `true` would prevent it from
      // interrupting the current handler
      false
    } else {
      state == STATE_ACTIVE &&
        canBeInterrupted &&
        (!hook.shouldCancelRootViewGestureHandlerIfNecessary() || handler.tag > 0)
    }
    // otherwise we can only return `true` if already in an active state
  }

  override fun shouldBeCancelledBy(handler: GestureHandler): Boolean = canBeInterruptedBy(handler)

  /**
   * Whether this handler permits [other] to take over the touch stream, given its
   * `disallowInterruption` and `yieldsToContinuousGestures` configuration.
   */
  fun canBeInterruptedBy(other: GestureHandler): Boolean = !disallowInterruption ||
    (yieldsToContinuousGestures && other.isContinuous)

  override fun shouldBeginWithRecordedHandlers(recorded: List<GestureHandler>): Boolean =
    hook.shouldBeginWithRecordedHandlers(recorded, this)

  override fun onPrepare() {
    when (val view = view) {
      is NativeViewGestureHandlerHook -> this.hook = view
      is ReactEditText -> this.hook = EditTextHook(this, view)
      is ReactSwipeRefreshLayout -> this.hook = SwipeRefreshLayoutHook(this, view)
      is ReactScrollView -> this.hook = ScrollViewHook()
      is ReactHorizontalScrollView -> this.hook = ScrollViewHook()
      is ReactTextView -> this.hook = TextViewHook()
      is ReactViewGroup -> this.hook = ReactViewGroupHook()
    }

    delaysChildPressedState?.let { delays ->
      this.view?.let {
        if (trySetChildPressedStateDelay(it, delays)) {
          pressedStateDelayOverriddenView = it
        }
      }
    }
  }

  override fun onHandle(event: MotionEvent, sourceEvent: MotionEvent) {
    val view = view!!
    if (event.actionMasked == MotionEvent.ACTION_UP) {
      if (state == STATE_UNDETERMINED && !hook.canBegin(event)) {
        cancel()
      } else {
        hook.sendTouchEvent(view, event)
        if (shouldStopNestedScroll()) {
          view.stopNestedScroll()
        }
        if (state == STATE_ACTIVE && hook.shouldClearChildTouchTargets()) {
          clearChildTouchTargets(view as ViewGroup, event)
        }

        if ((state == STATE_UNDETERMINED || state == STATE_BEGAN) && hook.canActivate(view)) {
          activate()
        }

        if (state == STATE_UNDETERMINED) {
          cancel()
        } else {
          end()
        }
      }

      hook.afterGestureEnd(event)
    } else if (state == STATE_UNDETERMINED || state == STATE_BEGAN) {
      if (state != STATE_BEGAN && hook.canBegin(event)) {
        begin()
      }

      when {
        shouldActivateOnStart -> {
          tryIntercept(view, event)
          hook.sendTouchEvent(view, event)
          activate()
        }

        tryIntercept(view, event) -> {
          hook.sendTouchEvent(view, event)
          activate()
        }

        hook.wantsToHandleEventBeforeActivation() -> {
          hook.handleEventBeforeActivation(event)
        }
      }
    } else if (state == STATE_ACTIVE) {
      hook.sendTouchEvent(view, event)
    }
  }

  private fun dispatchCancelEventToView() {
    val time = SystemClock.uptimeMillis()
    val event = MotionEvent.obtain(time, time, MotionEvent.ACTION_CANCEL, 0f, 0f, 0).apply {
      action = MotionEvent.ACTION_CANCEL
    }
    hook.sendTouchEvent(view, event)
    if (shouldStopNestedScroll()) {
      view?.stopNestedScroll()
    }
    event.recycle()
  }

  // While active, the view gets touches through `onTouchEvent`, so the child it dispatched the native
  // DOWN to stays recorded as its touch target. The root's next ACTION_CANCEL would then pass through
  // `ScrollView.onInterceptTouchEvent`, whose CANCEL branch calls `springBack` and ends the fling this
  // UP just started. Disallowing interception lets the CANCEL reach only the stale children.
  private fun clearChildTouchTargets(view: ViewGroup, event: MotionEvent) {
    val cancelEvent = MotionEvent.obtain(event).apply { action = MotionEvent.ACTION_CANCEL }
    view.requestDisallowInterceptTouchEvent(true)
    view.dispatchTouchEvent(cancelEvent)
    cancelEvent.recycle()
  }

  // Once the handler is active, it delivers touches straight to the view's `onTouchEvent`. Normally
  // touches arrive through `View.dispatchTouchEvent`, which also ends the nested scroll when the finger
  // goes up. Because we skip it, the nested scroll stays open and the parent never finds out that the
  // gesture is over - e.g. SwipeRefreshLayout never fires refresh (#4485). While the handler is not
  // active, the view still receives touches the regular way, so Android takes care of it.
  private fun shouldStopNestedScroll() = state == STATE_ACTIVE && hook.shouldStopNestedScroll()

  override fun onCancel() = dispatchCancelEventToView()

  override fun onFail() = dispatchCancelEventToView()

  override fun onReset() {
    this.hook = defaultHook
    lastActiveUpdate = null
    // `null` restores the view's default pressed state delay behavior.
    pressedStateDelayOverriddenView?.let { trySetChildPressedStateDelay(it, null) }
    pressedStateDelayOverriddenView = null
  }

  override fun dispatchHandlerUpdate(event: MotionEvent) {
    val snapshot = ActiveUpdateSnapshot(isWithinBounds, numberOfPointers, pointerType)
    if (snapshot == lastActiveUpdate) {
      return
    }
    lastActiveUpd
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1246** (2021-08-15): **java.lang.ArrayIndexOutOfBoundsException**
  *Symptoms*: ## Description  11-27 09:56:06.323 E/VOS|App (31135): -----Crash Log Begin----- 11-27 09:56:06.323 E/VOS|App (31135): length=12; index=12 11-27 09:56:06.323 W/System.err(31135): java.lang.ArrayIndexOutOfBoundsException: length=12; index=12 11-27 09:56:06.323 W/System.err(31135): 	at com.swmansion.gesturehandler.GestureHandler.startTrackingPointer(GestureHandler.java:219) 11-27 09:56:06.324 W/System.err(31135): 	at com.swmansion.gesturehandler.GestureHandlerOrchestrator.recordViewHandlersForPointer(GestureHandlerOrchestrator.java:390) 11-27 09:56:06.324 W/System.err(31135): 	at com.swmansion.gesturehandler.GestureHandlerOrchestrator.traverseWithPointerEvents(GestureHandlerOrchestrator.java:466) 11-27 09:56:06.324 W/System.err(31135): 	at com.swmansion.gesturehandler.GestureHandlerOrchestrator.extractGestureHandlers(GestureHandlerOrchestrator.java:403) 11-27 09:56:06.324 W/System.err(31135): 	at com.swmansion.gesturehandler.GestureHandlerOrchestrator.onTouchEvent(GestureHandlerOrchestrator.java:97) 11-27 09:56:06.324 W/System.err(31135): 	at com.swmansion.gesturehandler.react.RNGestureHandlerRootHelper.dispatchTouchEvent(RNGestureHandlerRootHelper.java:126) 11-27 09:56:06.324 W/System.err(31135): 	at com.swmansion.gesturehandler.react.RNGestureHandlerRootView.dispatchTouchEvent(RNGestureHandlerRootView.java:63) 11-27 09:56:06.324 W/System.err(31135): 	at android.view.ViewGroup.dispatchTransformedTouchEvent(ViewGroup.java:2405) 11-27 09:56:06.324 W/System.err(31135)
  **Post-Mortem & Fix Analysis**:
  > Could you describe what device are you using and do you interact with it? Seems like you have more than 12 pointers (which is the internal limit of active pointers in gesture handler).
  > > Could you describe what device are you using and do you interact with it? Seems like you have more than 12 pointers (which is the internal limit of active pointers in gesture handler).  my device is RK3288 Android 5.1  how to get device info what you need? I can cooperate  55' screen with Infrared touch
  > I don't really need much more info about the device, was just curious how do you use it. Is it a screen intended for many people to use it simultaneously?  In the meantime, you can patch RNGH via [patch-package](https://www.npmjs.com/package/patch-package) by increasing `MAX_POINTERS_COUNT`, like in [this PR](https://github.com/software-mansion/react-native-gesture-handler/pull/1175/files).

- **Issue #1213** (2021-01-30): **Double tap don't works anymore with only one finger (now requires at least two fingers)**
  *Symptoms*: ## Description  The `TapGestureHandler` seems to have a bug with multitap.  It is now impossible to do a double tap with only one finger, it now requires two fingers to be detected.  ## Steps To Reproduce  1. Open the `multitap` demo from Example project. 2. Try to do a double tap (it won't works, considered as a single tap). 3. Try to do the second tap with a new finger (it will works and it is detected at the average position between the two fingers).  ### Expected behavior  Double tap with only one finger.   ### Actual behavior  Double tap is only possible with two fingers.  ## Snack or minimal code example  Can be reproduce in the `react-native-gesture-handler` demo :  [https://snack.expo.io/@adamgrzybowski/react-native-gesture-handler-demo](https://snack.expo.io/@adamgrzybowski/react-native-gesture-handler-demo)  
  **Post-Mortem & Fix Analysis**:
  > Does anyone have a similar problem, of a minimalist example of a working double tap gesture ?
  > I got the same problem.  I have two scrollviews nested under a pageviewer. Two scrollviews are almost identical except the image attached to the scrollview are different. I use double to enlarge the image to the location where users tap. A few days ago, it worked completely fine. While I revisited the code and do some modifications today, it completely failed.  I move back to the first step and try the simple code in the documentation. It works at first. Once I swipe to another scrollview and move back to the first scrollview, it can only detect single tap. Magically, the second scrollview works completely fine with double tap. If I restart expo client and reload the app, it seems to work at first and the same problem appears again after I swipe to other scrollviews.  I also tried a long list of scrollviews. The double tap only works on the last scrollviews.  Tried on both iphone and ipad, same problem happened.
  > A workaround can be to compare the a time threshold between 2 single taps.. but it defeats the purpose of using this library for double tap gestures.  Does anyone have similar problem or a solution ?

- **Issue #1212** (2021-11-08): **No discrimination of onHandlerStateChange in nested Pan- and PinchGestureHandler components in Android emulator**
  *Symptoms*: ## Description / Actual behaviour  On Android emulator, all onHandlerStateChange functions are called when performing either pan or pinch gestures using nested handler components. Not tested on a physical device.  ### Expected behaviour  Only onHandlerStateChange functions relevant to corresponding gestures should fire.  ## Snack or minimal code example  Both console logs fire when either panning or pinching with the below code:  ``` import React from "react"; import { PanGestureHandler, PinchGestureHandler } from "react-native-gesture-handler"; import Animated from "react-native-reanimated";   const App = () => {   const onPanHandlerStateChange = () => console.log("pan gesture state change");   const onPinchHandlerStateChange = () => console.log("pinch gesture state change");    return (     <PanGestureHandler       onHandlerStateChange={onPanHandlerStateChange}       minPointers={1}       maxPointers={1}     >       <Animated.View style={{flex: 1}}>         <PinchGestureHandler           onHandlerStateChange={onPinchHandlerStateChange}           minPointers={2}           maxPointers={2}         >           <Animated.View style={{ width: "100%", height: "100%" }} />         </PinchGestureHandler>       </Animated.View>     </PanGestureHandler>   ); }  export default App; ```  ## Package versions ``` "react": "16.13.1", "react-native": "0.63.3", "react-native-gesture-handler": "^1.8.0", "react-native-reanimated": "^1.13.1" ```
  **Post-Mortem & Fix Analysis**:
  > This is working as intended. When you place the first finger on the screen we cannot yet determine whether you will pan or pinch, so we assume it could be both and both handlers move to the `BEGAN` state where pan waits for the finger to move and the pinch waits for another finger to be placed. Then you can either move your finger activating pan gesture which will in turn cancel pinch, or you can place the second finger on the screen which will cause the pan to fail as it has `maxPointers` set to 1.

- **Issue #1210** (2021-02-13): **PlatformConstants no longer a member of NativeModules (breaks ForceTouchGestureHandler)**
  *Symptoms*: ## Description  ForceTouchGestureHandler was not working on my iPhone XS Max (claiming it was unavailable on the platform which is untrue) and after digging into it I can see that in PlatformConstants.js, `PlatformConstants` is no longer a member of react-native's `NativeModules` export. Because we're querying `PlatformConstants.forceTouchAvailable` in Gestures.js, this results in `<ForceTouchFallback />` being rendered rather than the actual gesture handler.  I wasn't easily able to see which RN version broke this, but since Gestures.js is the only file that imports PlatformConstants.js, I think we could just `import { Platform } from 'react-native'` here and query `Platform.constants.forceTouchAvailable` rather than conditionally import `NativeModules` if on RN v0.60.x, and from `Platform` if on newer RN versions. That being said, I imagine for future development it's nice to have a centralized PlatformConstants file. I just don't know how the software mansion team would approach this issue while maintaining backwards compatibility.  ### Screenshots  ## Steps To Reproduce Rather than upgrading the entire react-native-gesture-library to support the latest react-native v0.63.3, I just used the reanimated v2 playground repo. 1. `git clone https://github.com/software-mansion-labs/reanimated-2-playground` 2. npm install, pod install 3. Paste the example code below. 4. To fix, replace `import PlatformConstants from './PlatformConstants';` with `import { Platform } fr
  **Post-Mortem & Fix Analysis**:
  > Hey! I'll try to look into this. Seems like it should be fairly easy to fix 😄 
  > But if you also know how to go around it, Pull Requests are welcome, we can always correct things when the PR is open 😄 
  > @jkadamczyk thanks for the speedy response -- I've opened #1211.

- **Issue #1207** (2020-11-26): **RNGestureHandlerManager's _rootViews causes memory leak**
  *Symptoms*: ## Description  In `RNGestureHandlerManager.m`, `_rootViews` is a `NSMutableSet` which will retain the elements.  ``` NSMutableSet<UIView*> *_rootViews; ```  In fact, the element in _rootViews is `RCTRootContentView`.  When a `RCTRootView` is created, the `RCTRootContentView` will be pushed into the `_rootViews`.  In my case, `RCTBridge` is cached after remove a `RCTRootView`.  `RCTRootView` will dealloc, but `RCTRootContentView` will not dealloc.  Then I allocate a new `RCTRootView` which is inited by my cached `RCTBridge`, a new `RCTRootContentView` will be allocated and it will also be retained by `RNGestureHandlerManager`. At present, the `_rootViews` has two `RCTRootContentView` element, the old and the new.   I think that the `_rootViews` should not strong retain the element.  In my opinion, the solution is that using `NSHashTable` instead of `NSMutableSet`  ``` NSHashTable<UIView *> *_rootViews; _rootViews = [NSHashTable hashTableWithOptions:NSPointerFunctionsWeakMemory]; ```   ### Screenshots  ## Steps To Reproduce  1.  ### Expected behavior  When a `RCTRootView` is removed, during the `RCTBridge` is cached, the `RCTRootContentView` should be dealloced  ### Actual behavior  When a `RCTRootView` is removed, during the `RCTBridge` is cached, the `RCTRootContentView` did not be dealloced  ## Snack or minimal code example  <!-- Please provide a Snack ([https://snack.expo.io/](https://snack.expo.io/)) or provide a minimal code exa
  **Post-Mortem & Fix Analysis**:
  > Finally found the culprit of the memory leak, you are great
  > Hi! Thanks for the issue! Would it be possible for you to test the HashSet solution and submit a pull request? That would be a great help, but nevertheless, we will try to look into this.
  > > Hi! Thanks for the issue! > Would it be possible for you to test the HashSet solution and submit a pull request? That would be a great help, but nevertheless, we will try to look into this.  HaseSet? Do you mean NSHashTable? I will submit a PR later.

- **Issue #1178** (2022-04-20): **RectButton & TouchableOpacity (from react-native-gesture-handler) are pressable through overlay in a transparent modal**
  *Symptoms*: **Current Behavior** -  I am using a transparent modal in my application [link](https://reactnavigation.org/docs/stack-navigator/#transparent-modals). The button components from `react-native-gesture-handler` are pressable through the overlay. Working fine with the Button components from `react-native`.  **Expected Behavior**  - They should not be pressable through the overlay.  **How to reproduce**  https://snack.expo.io/@kailash23/react-navigation-v5-modal-bug  I had also filed the same issue on react-navigation [link](https://github.com/react-navigation/react-navigation/issues/8706)   **Your Environment**  | software                       | version | | ------------------------------ | ------- | | iOS or Android                 | Android | @react-navigation/native       | 5.6.1 | react-native                   | 0.62.2 | expo                           | 38.0.0 |react-native-gesture-handler | 1.6.0 | node                           | | npm or yarn                    | 
  **Post-Mortem & Fix Analysis**:
  > Can reproduce only on Android 🤖 
  > CC @jakub-gonet Maybe you recall if we had something similar it seems quite obvious and weird
  > This is still a problem with 1.9.0 version.  Looks like its a problem with most of the routing libraries, I'm using `react-router-native`  There is an old issue with similar problem:  https://github.com/software-mansion/react-native-gesture-handler/issues/514

- **Issue #1176** (2022-03-31): **It's not possible to set border radius of single corner of RectButton**
  *Symptoms*: ## Description  I want to set border radius just of top left and bottom right corners of `RectButton`. To do this, I use `borderTopLeftRadius` and `borderBottomRightRadius`, but it looks like they're ignored. Using `borderRadius` on all corners works like a charm. I am working on managed Expo project. And I develop only for Android device, so I don't know if that's an issue on iOS.  ### Screenshots These are screenshots from code you can find below. And this is how it looks like on my device. First I press button that should have only two corners rounded and both in pressed and idle state no corners are rounded. Then, I press button that has all corners rounded by using `borderRadius` and everything looks and works fine.  ![image](https://user-images.githubusercontent.com/11396814/91092641-9f290e80-e658-11ea-9b68-4bbacb73fd83.png) ![image](https://user-images.githubusercontent.com/11396814/91092681-abad6700-e658-11ea-8a7b-dc27dd44f777.png)  ## Steps To Reproduce  Tap buttons in example below  ### Expected behavior  First two buttons have rounded two corners (top left and bottom right) in idle state and, when pressed, ripple fills them correctly.  ### Actual behavior  First two buttons don't have any corners rounded.  ## Snack or minimal code example  ``` import React from 'react'; import { View } from 'react-native'; import Text from 'components/Text'; import { RectButton } from 'react-native-gesture-handler';  function App() {   return (     <
  **Post-Mortem & Fix Analysis**:
  > FYI, you can achieve this by wrapping the RectButton into a view with "overflow": "hidden" and setting the borderRadius props there. I had a lot of weird behaviors setting borderRadius directly on the RectButton.
  > See [this comment](https://github.com/software-mansion/react-native-gesture-handler/issues/477#issuecomment-680017127) in #477

- **Issue #1170** (2020-09-08): **Web link for "Getting Started" is broken**
  *Symptoms*: ## Description  "Page not found" for Getting Started link  https://docs.swmansion.com/react-native-gesture-handler/docs/next/getting-started  First found it on npm page: https://www.npmjs.com/package/react-native-gesture-handler#installation  Then by clicking on "Getting Started" on: https://docs.swmansion.com/react-native-gesture-handler/docs/next/ ![image](https://user-images.githubusercontent.com/10219697/90678762-cc944780-e267-11ea-92c1-bf517286c5ee.png)    
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting, we are aware of this issue.
  > Fixed by #1185

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

### Incident Patch 1: `bb62b066` (2026-10-05)
**Commit Message**: [Web] Fix view relative coordinates of trackpad pan events (#4531)

## Description

`WheelEventManager` synthesizes a moving pointer out of a stationary
cursor by accumulating wheel deltas, but only the page coordinates use
the accumulator:

```js
this.wheelDelta.x += event.deltaX;      // wheelCallback

x: event.clientX + this.wheelDelta.x,   // accumulated
offsetX: event.offsetX - event.deltaX,  // one event, opposite sign
```

Repro: a Pan with `enableTrackpadTwoFingerGesture` on web, three
trackpad frames of `deltaY: 10` from `clientY: 0`, `offsetY: 0`.
`absoluteY` reads 10, 20, 30 while `y` reads -10, -10, -10. `y` points
the wrong way and never advances for the whole gesture. `translationY`,
`velocityY` and `absoluteY` are fine, they come off the page
coordinates.

`x`/`y` and `absoluteX`/`absoluteY` are the same point in two spaces, so
they can only differ by the view's page offset. Every other producer
keeps that invariant: `PointerEventManager.ts:230` derives `offsetX`
from the same `clientX` it writes to `x`,
`KeyboardEventManager.ts:120-129` writes the view centre into both,
`ScrollEventManager.ts:26-29` writes one value twice, and
`GestureHandlerButton.web.tsx:51-53` co

**File**: `packages/react-native-gesture-handler/src/web/handlers/__tests__/PanGestureHandler.test.ts` (modified, +99/-1)
```diff
@@ -17,6 +17,10 @@ class TestPanGestureHandler extends PanGestureHandler {
     this.onWheel(event);
   }
 
+  public nativeEvent() {
+    return this.transformNativeEvent();
+  }
+
   protected override onWheel(event: AdaptedEvent): void {
     this.wheelEvents.push(event);
     super.onWheel(event);
@@ -83,8 +87,27 @@ afterEach(() => {
 });
 
 class FakeView {
+  public readonly style = {};
+  public readonly children = [];
+  public readonly computedStyle: Record<string, string>;
   private readonly listeners = new Map<string, Set<(event: unknown) => void>>();
 
+  constructor(
+    private readonly left = 0,
+    private readonly top = 0,
+    scale = 1
+  ) {
+    this.computedStyle = {
+      display: 'block',
+      scale: 'none',
+      transform: `matrix(${scale}, 0, 0, ${scale}, 0, 0)`,
+    };
+  }
+
+  public getBoundingClientRect() {
+    return { left: this.left, top: this.top };
+  }
+
   public addEventListener(type: string, listener: (event: unknown) => void) {
     const listeners = this.listeners.get(type) ?? new Set();
     listeners.add(listener);
@@ -95,7 +118,7 @@ class FakeView {
     this.listeners.get(type)?.delete(listener);
   }
 
-  public wheel(deltaY: number): void {
+  public wheel(deltaY: number, event: Partial<WheelEvent> = {}): void {
     this.listeners.get('wheel')?.forEach((listener) =>
       listener({
         clientX: 0,
@@ -107,11 +130,23 @@ class FakeView {
         timeStamp: 0,
         // Not a multiple of 120, so the wheel is recognized as a touchpad.
         wheelDeltaY: 13,
+        ...event,
       })
     );
   }
 }
 
+// The Jest environment is node, the view bounds are read through
+// getComputedStyle.
+beforeAll(() => {
+  (globalThis as Record<string, unknown>).getComputedStyle = (view: FakeView) =>
+    view.computedStyle;
+});
+
+afterAll(() => {
+  delete (globalThis as Record<string, unknown>).getComputedStyle;
+});
+
 describe('PanGestureHandler config reset', () => {
   test('a config without enableTrackpadTwoFingerGesture restores the disabled default', () => {
     const handler = createHandler();
@@ -177,3 +212,66 @@ describe('PanGestureHandler trackpad gesture end', () => {
     expect(handler.wheelEvents[1].y).toBe(30);
   });
 });
+
+describe('PanGestureHandler trackpad coordinates', () => {
+  beforeEach(() => {
+    jest.useFakeTimers();
+  });
+
+  afterEach(() => {
+    jest.clearAllTimers();
+    jest.useRealTimers();
+  });
+
+  function trackpadPan(view: FakeView, event: Partial<WheelEvent> = {}) {
+    const manager = new WheelEventManager(view as unknown as HTMLElement);
+    const handler = createHandler([manager]);
+
+    handler.setGestureConfig({
+      enabled: true,
+      enableTrackpadTwoFingerGesture: true,
+    });
+    handler.attachEventManager(manager);
+
+    view.wheel(10, { deltaX: 5, ...event });
+    view.wheel(10, { deltaX: 5, ...event });
+    view.wheel(10, { deltaX: 5, ...event });
+
+    return handler.nativeEvent();
+  }
+
+  test('a view at the page origin', () => {
+    expect(trackpadPan(new FakeView())).toMatchObject({
+      x: 15,
+      y: 30,
+      absoluteX: 15,
+      absoluteY: 30,
+    });
+  });
+
+  test('a view away from the page origin', () => {
+    const view = new FakeView(40, 60);
+
+    expect(
+      trackpadPan(view, { clientX: 50, clientY: 80, offsetX: 10, offsetY: 20 })
+    ).toMatchObject({ x: 25, y: 50, absoluteX: 65, absoluteY: 110 });
+  });
+
+  test('a wheel over a child of the view', () => {
+    const view = new FakeView(40, 60);
+
+    // The child sits at (70, 90), offsetX and offsetY are relative to it.
+    expect(
+      trackpadPan(view, { clientX: 80, clientY: 100, offsetX: 10, offsetY: 10 })
+    ).toMatchObject({ x: 55, y: 70, absoluteX: 95, absoluteY: 130 });
+  });
+
+  test('a scaled view', () => {
+    const view = new FakeView(40, 60, 2);
+
+    // offsetX and offsetY are in the untransformed space of the view.
+    expect(
+      trackpadPan(view, { clientX: 50, clientY: 80, offsetX: 5, offsetY: 10 })
+    ).toMatchObject({ x: 12.5, y: 25, absoluteX: 65, absoluteY: 110 });
+  });
+});
```

**File**: `packages/react-native-gesture-handler/src/web/tools/WheelEventManager.ts` (modified, +11/-4)
```diff
@@ -1,6 +1,7 @@
 import { PointerType } from '../../PointerType';
 import type { AdaptedEvent } from '../interfaces';
 import { EventTypes } from '../interfaces';
+import { calculateViewScale, getEffectiveBoundingRect } from '../utils';
 import EventManager from './EventManager';
 
 export default class WheelEventManager extends EventManager<HTMLElement> {
@@ -29,11 +30,17 @@ export default class WheelEventManager extends EventManager<HTMLElement> {
   }
 
   protected mapEvent(event: WheelEvent): AdaptedEvent {
+    const rect = getEffectiveBoundingRect(this.view);
+    const { scaleX, scaleY } = calculateViewScale(this.view);
+
+    const x = event.clientX + this.wheelDelta.x;
+    const y = event.clientY + this.wheelDelta.y;
+
     return {
-      x: event.clientX + this.wheelDelta.x,
-      y: event.clientY + this.wheelDelta.y,
-      offsetX: event.offsetX - event.deltaX,
-      offsetY: event.offsetY - event.deltaY,
+      x,
+      y,
+      offsetX: (x - rect.left) / scaleX,
+      offsetY: (y - rect.top) / scaleY,
       pointerId: -1,
       eventType: EventTypes.MOVE,
       pointerType: PointerType.OTHER,
```

---

### Incident Patch 2: `736318ee` (2026-10-02)
**Commit Message**: Bump brace-expansion from 1.1.18 to 1.1.21 (#4559)

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
href="https://github.com/juliangruber/brace-expansion/co

**File**: `yarn.lock` (modified, +3/-3)
```diff
@@ -6006,12 +6006,12 @@ __metadata:
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

### Incident Patch 3: `590518c1` (2026-10-02)
**Commit Message**: Scan mount relations directly instead of rebuilding tag arrays (#4546)

## Description

Fixes #4540

`shouldUpdateDetector` resolved every relation entry through
`transformIntoHandlerTags` on each gesture mount. That call runs
`toArray`, `map` and `filter`, so each mount allocated three arrays per
relation, for three relations, for every attached gesture of every
mounted detector. The issue reports ~800ms of JS thread blocking when
opening a sheet with ~50 pressables on a Pixel 7 Pro, with several
hundred detectors mounted app-wide.

Most of that work could never match. Only refs can start pointing at a
different handler after the detector attached, because `current` is
filled in when the gesture they point at mounts. Gestures and numeric
tags already carry their tag by then — and `transformIntoHandlerTags`
mapped them to `-1` and filtered them out anyway.

This walks the relation array directly and compares
`current.handlerTag`, skipping entries that cannot resolve late. No
allocations, and the impossible comparisons are gone.

It also fixes late-mounted relations on web, the secondary issue in the
report: the web branch of `transformIntoHandlerTags` returns handler
objects, which

**File**: `packages/react-native-gesture-handler/src/__tests__/useMountReactions.test.ts` (added, +132/-0)
```diff
@@ -0,0 +1,132 @@
+import { renderHook } from '@testing-library/react-native';
+import type { Platform as PlatformModule } from 'react-native';
+
+import type { AttachedGestureState } from '../handlers/gestures/GestureDetector/types';
+import { useMountReactions } from '../handlers/gestures/GestureDetector/useMountReactions';
+import { MountRegistry } from '../mountRegistry';
+
+// The relation scan used to resolve entries through `transformIntoHandlerTags`,
+// whose web branch returns handler objects while the caller compares numeric
+// tags — so on web a late-mounted relation could never match. Run these on web
+// to cover that branch.
+jest.mock('react-native/Libraries/Utilities/Platform', () => {
+  const actual = jest.requireActual<{ default: typeof PlatformModule }>(
+    'react-native/Libraries/Utilities/Platform'
+  ).default;
+  return {
+    __esModule: true,
+    default: {
+      ...actual,
+      OS: 'web',
+      select: (spec: Record<string, unknown>) =>
+        'web' in spec ? spec.web : (spec.native ?? spec.default),
+    },
+  };
+});
+
+type RelationKey = 'blocksHandlers' | 'requireToFail' | 'simultaneousWith';
+
+const stateWithRelation = (
+  key: RelationKey,
+  relation: unknown[]
+): AttachedGestureState =>
+  ({
+    attachedGestures: [{ config: { [key]: relation } }],
+    animatedEventHandler: null,
+    animatedHandlers: null,
+    shouldUseReanimated: false,
+    isMounted: true,
+  }) as unknown as AttachedGestureState;
+
+const mount = (handlerTag: number) =>
+  MountRegistry.gestureHandlerWillMount({
+    handlerTag,
+  } as unknown as React.Component);
+
+describe('useMountReactions', () => {
+  const relationKeys: RelationKey[] = [
+    'blocksHandlers',
+    'requireToFail',
+    'simultaneousWith',
+  ];
+
+  test.each(relationKeys)(
+    'updates the detector when a ref in %s resolves on mount',
+    (key) => {
+      const updateDetector = jest.fn();
+      const ref = { current: { handlerTag: 42 } };
+      const { unmount } = renderHook(() =>
+        useMountReactions(updateDetector, stateWithRelation(key, [ref]))
+      );
+
+      mount(42);
+
+      expect(updateDetector).toHaveBeenCalledTimes(1);
+      unmount();
+    }
+  );
+
+  test('leaves the detector alone when an unrelated gesture mounts', () => {
+    const updateDetector = jest.fn();
+    const ref = { current: { handlerTag: 42 } };
+    const { unmount } = renderHook(() =>
+      useMountReactions(
+        updateDetector,
+        stateWithRelation('simultaneousWith', [ref])
+      )
+    );
+
+    mount(7);
+
+    expect(updateDetector).not.toHaveBeenCalled();
+    unmount();
+  });
+
+  test('leaves the detector alone for a ref that has not resolved yet', () => {
+    const updateDetector = jest.fn();
+    const { unmount } = renderHook(() =>
+      useMountReactions(
+        updateDetector,
+        stateWithRelation('simultaneousWith', [{ current: null }])
+      )
+    );
+
+    mount(42);
+
+    expect(updateDetector).not.toHaveBeenCalled();
+    unmount();
+  });
+
+  test('ignores entries that already carried their tag when the detector attached', () => {
+    const updateDetector = jest.fn();
+    // A gesture object and a raw tag are both resolved by the time the detector
+    // attaches, so mounting cannot change what they point at.
+    const { unmount } = renderHook(() =>
+      useMountReactions(
+        updateDetector,
+        stateWithRelation('simultaneousWith', [{ handlerTag: 42 }, 42])
+      )
+    );
+
+    mount(42);
+
+    expect(updateDetector).not.toHaveBeenCalled();
+    unmount();
+  });
+
+  test('does not update a detector that is already unmounted', () => {
+    const updateDetector = jest.fn();
+    const state = stateWithRelation('simultaneousWith', [
+      { current: { handlerTag: 42 } },
+    ]);
+    state.isMounted = false;
+    const { unmount } = renderHook(() =>
+      useMountReactions(updateDetector, state)
+    );
+
+    mount(42);
+
+    expect(updateDetector).not.toHaveBeenCalled();
+    unmount();
+  });
+});
```

**File**: `packages/react-native-gesture-handler/src/handlers/gestures/GestureDetector/useMountReactions.ts` (modified, +13/-3)
```diff
@@ -1,7 +1,6 @@
 import { useEffect } from 'react';
 
 import { MountRegistry } from '../../../mountRegistry';
-import { transformIntoHandlerTags } from '../../utils';
 import type { GestureRef } from '../gesture';
 import type { AttachedGestureState } from './types';
 
@@ -13,8 +12,19 @@ function shouldUpdateDetector(
     return false;
   }
 
-  for (const tag of transformIntoHandlerTags(relation)) {
-    if (tag === gesture.handlerTag) {
+  for (const entry of relation) {
+    // Only refs can start pointing at a different handler after the detector
+    // attached, because `current` is filled in when the gesture they point at
+    // mounts. Gestures and numeric tags already carry their tag by then, so a
+    // mount can never change what they resolve to and scanning them is wasted
+    // work on every mount of every detector.
+    if (entry === null || typeof entry !== 'object' || !('current' in entry)) {
+      continue;
+    }
+
+    const current = entry.current as { handlerTag?: number } | null | undefined;
+
+    if (current?.handlerTag === gesture.handlerTag) {
       return true;
     }
   }
```

---

### Incident Patch 4: `186eb6bf` (2026-09-16)
**Commit Message**: [iOS] Fix `manualActivation` being ignored after a config update mid-gesture (#4520)

## Description

On iOS a handler with `manualActivation: true` activates on its own if
its config is updated mid-gesture. Any re-render during the gesture
triggers that, since the config is re-sent on every render.

`setConfig:` runs `resetConfig` before `updateConfig:`, and
`resetConfig` went through the `manualActivation` setter, which removed
the `RNManualActivationRecognizer` from the view. `UIKit` cancels a
recognizer removed mid-touch, so the failure requirement it imposed on
the handler was lost and the new blocker created by `updateConfig:`
never saw the touch.

`resetConfig` now only clears the flag and the blocker is reconciled
once after the config is applied, only when its presence no longer
matches the flag. Android and web already reset values only.

## Test plan

<details>
<summary>Repro</summary>

```tsx
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  GestureDetector,
  GestureStateManager,
  usePanGesture,
} from 'react-native-gesture-handler';

const ACTIVATION_THRESHOLD = 20;

type Phase = 'idle' | 'began' | 'act

**File**: `packages/react-native-gesture-handler/apple/RNGestureHandler.mm` (modified, +14/-3)
```diff
@@ -116,7 +116,7 @@ - (void)resetConfig
 {
   self.enabled = YES;
   self.testID = nil;
-  self.manualActivation = NO;
+  _manualActivation = NO;
   _shouldCancelWhenOutside = NO;
   _cancelsJSResponder = YES;
   _hitSlop = RNGHHitSlopEmpty;
@@ -132,6 +132,7 @@ - (void)setConfig:(NSDictionary *)config
 {
   [self resetConfig];
   [self updateConfig:config];
+  [self syncManualActivationRecognizer];
 }
 
 - (void)updateConfig:(NSDictionary *)config
@@ -665,14 +666,24 @@ - (void)stopActivationBlocker
 - (void)setManualActivation:(BOOL)manualActivation
 {
   _manualActivation = manualActivation;
+  [self syncManualActivationRecognizer];
+}
+
+- (void)syncManualActivationRecognizer
+{
+  BOOL hasRecognizer = _manualActivationRecognizer != nil;
 
-  if (manualActivation) {
+  if (hasRecognizer == _manualActivation) {
+    return;
+  }
+
+  if (_manualActivation) {
     _manualActivationRecognizer = [[RNManualActivationRecognizer alloc] initWithGestureHandler:self];
 
     if (_recognizer.view != nil) {
       [_recognizer.view addGestureRecognizer:_manualActivationRecognizer];
     }
-  } else if (_manualActivationRecognizer != nil) {
+  } else {
     [_manualActivationRecognizer.view removeGestureRecognizer:_manualActivationRecognizer];
     _manualActivationRecognizer = nil;
   }
```

---

### Incident Patch 5: `2f688d84` (2026-09-15)
**Commit Message**: [iOS] add SPM build support (#4510)

## Description

This PR adds

- support for Swift Package Manager on iOS
- ios-spm-build-test.yml workflow to test SPM build on CI

CocoaPods support is preserved.

## Test plan
### CocoaPods

Run basic-example app and test if it builds and works properly.

### SPM

Manual verification with a blank RN **0.87.x** app:

1. `npx @react-native-community/cli@latest init MyApp`
2. `cd packages/react-native-gesture-handler && yarn && yarn build &&
npm pack`
3. Go to `MyApp` project
4. copy generated `react-native-gesture-handler-2.29.0.tgz` into it
5. add `react-native-gesture-handler:
'./react-native-gesture-handler-2.29.0.tgz'` dependency inside
`package.json`
6. `npm install`
7. `npx react-native spm scaffold --deintegrate --yes`
8. `npm run ios`
9. MyApp should build and work properly.
10. You can add some basic `react-native-gesture-handler` usage to
AppContent to check if everything is linked properly at runtime.

#### Worklets + GH test
11. install `"react-native-worklets":
"0.13.0-nightly-20260913-5336bb7f4"`
12. repeat steps 7-8
13. You can add some basic `react-native-worklets` usage to AppContent
to check if everything is linked properly at 

**File**: `.github/workflows/ios-spm-build-test.yml` (added, +115/-0)
```diff
@@ -0,0 +1,115 @@
+name: Build iOS (SPM)
+
+on:
+  pull_request:
+    paths:
+      - packages/react-native-gesture-handler/Package.swift
+      - packages/react-native-gesture-handler/package.json
+      - packages/react-native-gesture-handler/react-native.config.js
+      - packages/react-native-gesture-handler/package.json
+      - packages/react-native-gesture-handler/RNGestureHandler.podspec
+      - packages/react-native-gesture-handler/apple/**
+      - packages/react-native-gesture-handler/shared/**
+      - packages/react-native-gesture-handler/src/**
+      - rnrepo.config.json
+      - yarn.lock
+      - '!packages/react-native-gesture-handler/src/**/*.test.*'
+      - .github/workflows/ios-spm-build-test.yml
+  push:
+    branches:
+      - main
+  workflow_dispatch:
+
+concurrency:
+  group: ios-spm-${{ github.ref }}
+  cancel-in-progress: true
+
+jobs:
+  ios-spm:
+    if: github.repository == 'software-mansion/react-native-gesture-handler'
+
+    runs-on: macos-26
+    timeout-minutes: 60
+
+    strategy:
+      fail-fast: false
+      matrix:
+        worklets: [false, true]
+
+    env:
+      APP_NAME: GHSpmTest
+      WORKLETS_VERSION: 0.13.0-nightly-20260913-5336bb7f4
+
+    steps:
+      - name: checkout
+        uses: actions/checkout@v4
+
+      - name: Select Xcode
+        run: |
+          XCODE_APP="/Applications/Xcode_26.4.1.app"
+          if [ ! -d "$XCODE_APP" ]; then
+            echo "Xcode 26.4.1 is not installed on this runner. Available:" >&2
+            ls -d /Applications/Xcode*.app >&2
+          fi
+          echo "Using $XCODE_APP"
+          echo "DEVELOPER_DIR=$XCODE_APP/Contents/Developer" >> "$GITHUB_ENV"
+          DEVELOPER_DIR="$XCODE_APP/Contents/Developer" xcodebuild -version
+
+      - name: Use Node.js 24
+        uses: actions/setup-node@v6
+        with:
+          node-version: 24
+          cache: yarn
+
+      - name: Read React Native version
+        id: rn-version
+        run: |
+          RN_VERSION=$(node -p "require('./packages/react-native-gesture-handler/package.json').devDependencies['react-native']")
+          echo "version=$RN_VERSION" >> "$GITHUB_OUTPUT"
+
+      - name: Install monorepo dependencies
+        run: yarn --immutable
+
+      - name: Build and pack library
+        working-directory: packages/react-native-gesture-handler
+        run: |
+          yarn build
+          mkdir -p /tmp/packs
+          npm pack --pack-destination /tmp/packs
+          echo "GH_TARBALL=$(ls /tmp/packs/react-native-gesture-handler-*.tgz)" >> "$GITHUB_ENV"
+
+      - name: Create blank RN app
+        run: |
+          npx @react-native-community/cli@latest init "${{ env.APP_NAME }}" \
+            --version "${{ steps.rn-version.outputs.version }}"
+
+      - name: Install GH from tarball
+        working-directory: ${{ env.APP_NAME }}
+        run: npm install "${{ env.GH_TARBALL }}"
+
+      - name: Install react-native-worklets
+        if: matrix.worklets
+        working-directory: ${{ env.APP_NAME }}
+        run: npm install "react-native-worklets@${{ env.WORKLETS_VERSION }}"
+
+      - name: SPM scaffold
+        working-directory: ${{ env.APP_NAME }}
+        run: npx react-native spm scaffold --deintegrate --yes
+
+      - name: Assert worklets are linked into RNGestureHandler
+        if: matrix.worklets
+        working-directory: ${{ env.APP_NAME }}
+        run: |
+          swift package --package-path ios/build/generated/autolinking show-dependencies --format dot \
+            | grep 'libs/RNGestureHandler" -> ".*libs/RNWorklets"'
+
+      - name: Build iOS (SPM)
+        working-directory: ${{ env.APP_NAME }}/ios
+        run: |
+          xcodebuild build \
+            -project "${{ env.APP_NAME }}.xcodeproj" \
+            -scheme "${{ env.APP_NAME }}" \
+            -configuration Debug \
+            -sdk iphonesimulator \
+            -destination 'generic/platform=iOS Simulator' \
+            -quiet
```

**File**: `packages/react-native-gesture-handler/.gitignore` (modified, +5/-0)
```diff
@@ -66,6 +66,11 @@ jsconfig.json
 !.yarn/versions
 
 
+# Swift Package Manager
+.build/
+.swiftpm/
+Package.resolved
+
 # TS
 dist/
 
```

**File**: `packages/react-native-gesture-handler/Package.swift` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+// swift-tools-version: 6.0
+
+import Foundation
+import PackageDescription
+
+let packageDirectory = Context.packageDirectory
+
+func rnWorkletsPackageExists() -> Bool {
+    let url = URL(fileURLWithPath: packageDirectory)
+        .deletingLastPathComponent()
+        .appendingPathComponent("RNWorklets/Package.swift")
+    return FileManager.default.fileExists(atPath: url.path)
+}
+
+let useWorklets = rnWorkletsPackageExists()
+
+let reactHeaders: [Target.Dependency] = [
+    .product(name: "ReactHeaders", package: "ReactNative"),
+    .product(name: "ReactNativeHeaders", package: "ReactNative"),
+    .product(name: "ReactNativeDependenciesHeaders", package: "ReactNative"),
+    .product(name: "ReactAppHeaders", package: "React-GeneratedCode"),
+]
+
+var packageDependencies: [Package.Dependency] = [
+    .package(name: "ReactNative", path: "../../../../xcframeworks"),
+    .package(name: "React-GeneratedCode", path: "../../../ios"),
+]
+
+var targetDependencies: [Target.Dependency] = reactHeaders
+
+if useWorklets {
+    packageDependencies.append(.package(name: "RNWorklets", path: "../RNWorklets"))
+    targetDependencies.append(.product(name: "RNWorklets", package: "RNWorklets"))
+}
+
+var cSettings: [CSetting] = [
+    .headerSearchPath("apple"),
+    .headerSearchPath("shared/runtime"),
+    .headerSearchPath("shared/shadowNodes"),
+    .headerSearchPath(
+        "shared/shadowNodes/react/renderer/components/rngesturehandler_codegen"),
+    .define("DEBUG", .when(configuration: .debug)),
+    .define("NDEBUG", .when(configuration: .release)),
+]
+
+var cxxSettings: [CXXSetting] = [
+    .headerSearchPath("apple"),
+    .headerSearchPath("shared/runtime"),
+    .headerSearchPath("shared/shadowNodes"),
+    .headerSearchPath(
+        "shared/shadowNodes/react/renderer/components/rngesturehandler_codegen"),
+    .define("DEBUG", .when(configuration: .debug)),
+    .define("NDEBUG", .when(configuration: .release)),
+]
+
+if useWorklets {
+    cxxSettings.append(.define("RNGH_USE_WORKLETS", to: "1"))
+}
+
+let package = Package(
+    name: "RNGestureHandler",
+    platforms: [.iOS(.v15)],
+    products: [
+        .library(name: "RNGestureHandler", targets: ["RNGestureHandler"]),
+    ],
+    dependencies: packageDependencies,
+    targets: [
+        .target(
+            name: "RNGestureHandler",
+            dependencies: targetDependencies,
+            path: ".",
+            exclude: ["apple/RNGestureHandler.xcodeproj"],
+            sources: ["apple", "shared"],
+            cSettings: cSettings,
+            cxxSettings: cxxSettings,
+            linkerSettings: [
+                .linkedFramework("UIKit"),
+                .linkedFramework("Foundation"),
+                .linkedFramework("CoreGraphics"),
+            ]
+        ),
+    ],
+    cxxLanguageStandard: .cxx20
+)
```

**File**: `packages/react-native-gesture-handler/apple/RNGHStylusData.h` (modified, +4/-0)
```diff
@@ -8,6 +8,10 @@
 #ifndef RNGHStylusData_h
 #define RNGHStylusData_h
 
+#import <CoreGraphics/CoreGraphics.h>
+#import <Foundation/Foundation.h>
+#import <math.h>
+
 @interface RNGHStylusData : NSObject
 
 @property (atomic, assign) double tiltX;
```

**File**: `packages/react-native-gesture-handler/include/.gitkeep` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+// Gesture Handler exposes no SPM-facing headers, so Package.swift omits publicHeadersPath.
+// Without publicHeadersPath, SPM defaults to the "include/" directory.
+// We need to provide the "include/" directory so the iOS SPM build succeeds.
```

**File**: `packages/react-native-gesture-handler/package.json` (modified, +2/-0)
```diff
@@ -24,6 +24,8 @@
   "module": "lib/module/index.js",
   "types": "lib/typescript/index.d.ts",
   "files": [
+    "Package.swift",
+    "include/",
     "src",
     "lib",
     "!**/__tests__",
```

**File**: `packages/react-native-gesture-handler/react-native.config.js` (modified, +3/-0)
```diff
@@ -1,4 +1,7 @@
 module.exports = {
+  spm: {
+    name: 'RNGestureHandler',
+  },
   dependency: {
     platforms: {
       android: {
```

---

### Incident Patch 6: `1c8af365` (2026-09-11)
**Commit Message**: fix: stop circular GestureStateManagerType import on web (#4508)

## Description

`moduleSuffixes: [".web", ""]` makes `import type {
GestureStateManagerType } from './gestureStateManager'` in
`gestureStateManager.web.ts` resolve to this file itself. That circular
self-import left the type unresolvable (`any`), so every `on*` gesture
callback's `stateManager` parameter was untyped. Consumers (e.g.
Expensify App) then hit `@typescript-eslint/no-unsafe-call` on
`state.activate()` / `state.fail()`.

A `./gestureStateManager.ts` extension import would skip the suffix, but
this package's tsconfig does not set `allowImportingTsExtensions`, so
the type is declared locally in the web file to match the native
`GestureStateManagerType`.

Related consumer patch: https://github.com/Expensify/App/pull/99495

## Test plan

1. Type-only change — no runtime behavior change.
2. `tsc` with `moduleSuffixes: [".web", ""]` should resolve
`GestureStateManagerType` from the web file instead of collapsing it to
`any`.
3. Gesture `on*` callbacks should type `state.activate()` /
`state.fail()` / `state.begin()` / `state.end()` without
`no-unsafe-call`.

---------

Co-authored-by: Jakub Piasecki <[REDACTED_E

**File**: `packages/react-native-gesture-handler/src/handlers/gestures/gestureStateManager.web.ts` (modified, +12/-1)
```diff
@@ -1,6 +1,17 @@
 import { State } from '../../State';
 import NodeManager from '../../web/tools/NodeManager';
-import type { GestureStateManagerType } from './gestureStateManager';
+
+/**
+ * @deprecated `LegacyGestureStateManagerType` is deprecated and will be removed in the future. Please use the new, hook-based API instead.
+ */
+export interface GestureStateManagerType {
+  begin: () => void;
+  activate: () => void;
+  fail: () => void;
+  end: () => void;
+  /** @internal */
+  handlerTag: number;
+}
 
 export const GestureStateManager = {
   create(handlerTag: number): GestureStateManagerType {
```

**File**: `packages/react-native-gesture-handler/src/v3/gestureStateManager.ts` (modified, +1/-6)
```diff
@@ -1,11 +1,6 @@
 import { State } from '../State';
 import { tagMessage } from '../utils';
-
-export type GestureStateManagerType = {
-  activate(handlerTag: number): void;
-  fail(handlerTag: number): void;
-  deactivate(handlerTag: number): void;
-};
+import type { GestureStateManagerType } from './types/GestureStateManagerTypes';
 
 const setGestureState = (handlerTag: number, state: State) => {
   'worklet';
```

**File**: `packages/react-native-gesture-handler/src/v3/gestureStateManager.web.ts` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ import { tagMessage } from '../utils';
 import type IGestureHandler from '../web/handlers/IGestureHandler';
 import GestureHandlerOrchestrator from '../web/tools/GestureHandlerOrchestrator';
 import NodeManager from '../web/tools/NodeManager';
-import type { GestureStateManagerType } from './gestureStateManager';
+import type { GestureStateManagerType } from './types/GestureStateManagerTypes';
 
 function ensureHandlerAttached(handler: IGestureHandler) {
   if (!handler.attached) {
```

**File**: `packages/react-native-gesture-handler/src/v3/types/GestureStateManagerTypes.ts` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+export type GestureStateManagerType = {
+  activate(handlerTag: number): void;
+  fail(handlerTag: number): void;
+  deactivate(handlerTag: number): void;
+};
```

---

### Incident Patch 7: `e9ff66f5` (2026-09-08)
**Commit Message**: chore: fix typos in web GestureHandler comments (#4490)

## Description

Fixes two typos in code comments in `GestureHandler.ts` (`previuos` →
`previous`, `overriden` → `overridden`). Comment-only change, no runtime
impact.

## Test plan

Not applicable — comment-only change.

**File**: `packages/react-native-gesture-handler/src/web/handlers/GestureHandler.ts` (modified, +2/-2)
```diff
@@ -222,7 +222,7 @@ export default abstract class GestureHandler implements IGestureHandler {
   public fail(sendIfDisabled?: boolean): void {
     if (this.state === State.ACTIVE || this.state === State.BEGAN) {
       // Here the order of calling the delegate and moveToState is important.
-      // At this point we can use currentState as previuos state, because immediately after changing cursor we call moveToState method.
+      // At this point we can use currentState as previous state, because immediately after changing cursor we call moveToState method.
       this.delegate.onFail();
 
       this.moveToState(State.FAILED, sendIfDisabled);
@@ -754,7 +754,7 @@ export default abstract class GestureHandler implements IGestureHandler {
   }
 
   protected transformNativeEvent(): Record<string, unknown> {
-    // Those properties are shared by most handlers and if not this method will be overriden
+    // Those properties are shared by most handlers and if not this method will be overridden
     const lastCoords = this.tracker.getAbsoluteCoordsAverage();
     const lastRelativeCoords = this.tracker.getRelativeCoordsAverage();
 
```

---

### Incident Patch 8: `ed9410d3` (2026-08-27)
**Commit Message**: Fix ReanimatedDrawerLayout animation speed after rerender (#4470)

## Description

Fixes #4469.

`ReanimatedDrawerLayout` memoized `animateDrawer` without
`animationSpeedProp`, so changing the prop did not affect later
programmatic `openDrawer()` or `closeDrawer()` calls. The callback now
tracks the prop and the imperative methods receive the latest default
spring speed after a rerender.

## Test plan

- `yarn workspace react-native-gesture-handler test --runInBand` — 159
tests passed
- `yarn workspace react-native-gesture-handler ts-check`
- `yarn workspace react-native-gesture-handler lint-js` — no errors
(existing warnings remain)
- `yarn workspace react-native-gesture-handler build`

**File**: `packages/react-native-gesture-handler/src/components/ReanimatedDrawerLayout.tsx` (modified, +1/-0)
```diff
@@ -441,6 +441,7 @@ const DrawerLayout = function DrawerLayout(
       );
     },
     [
+      animationSpeedProp,
       openValue,
       emitStateChanged,
       isDrawerOpen,
```

---

### Incident Patch 9: `0d25288c` (2026-08-26)
**Commit Message**: [Android] Fix native handlers attaching to a nested button instead of the detector's child (#4464)

## Description

`tryFindGestureHandlerButton` was added in #3634 to find the button
inside the wrapper `View` of the `display: contents` sandwich. #4044
replaced that structure with a single-view button, so the correct target
is the detector's direct child again - but the search was left in and
still fired whenever the child's first child happened to be a bare
`ButtonViewGroup` (e.g. `Pressable` or `Touchable` as the first child of
a button or of a view under a native-gesture detector), attaching the
handler to that inner button instead.

Before this change, the outer button in the test screen did not react to
presses anywhere except over the inner pressable, and pressing the inner
pressable fired the outer handler's callbacks alongside the inner ones
(with a doubled `pressIn` on the inner pressable).

This PR removes the search so native handlers always attach to the
detector's child, with the existing exception of `RefreshControl`
unwrapping.

## Test plan

Compared builds from this branch and its base commit on the Android
emulator using the test screen below:

<details>
<summary>

**File**: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/react/RNGestureHandlerDetectorView.kt` (modified, +0/-16)
```diff
@@ -2,8 +2,6 @@ package com.swmansion.gesturehandler.react
 
 import android.content.Context
 import android.view.View
-import android.view.ViewGroup
-import androidx.core.view.isNotEmpty
 import com.facebook.react.bridge.ReadableArray
 import com.facebook.react.uimanager.ThemedReactContext
 import com.facebook.react.uimanager.UIManagerHelper
@@ -210,9 +208,6 @@ class RNGestureHandlerDetectorView(context: Context) : ReactViewGroup(context) {
     // Note: RefreshControl is wrapped with a VirtualDetector, and native gestures for it are attached in `attachVirtualChildren`.
     val id = if (child is ReactSwipeRefreshLayout) {
       child.getChildAt(0).id
-      // TODO: figure out how to do it correctly
-    } else if (child is ViewGroup && child.isNotEmpty()) {
-      child.tryFindGestureHandlerButton()?.id ?: child.id
     } else {
       child.id
     }
@@ -272,15 +267,4 @@ class RNGestureHandlerDetectorView(context: Context) : ReactViewGroup(context) {
   }.filterNotNull()
 
   private fun ReadableArray.toIntList(): List<Int> = List(size()) { getInt(it) }
-
-  private fun ViewGroup.tryFindGestureHandlerButton(): RNGestureHandlerButtonViewManager.ButtonViewGroup? {
-    if (isNotEmpty()) {
-      val child = getChildAt(0)
-      if (child is RNGestureHandlerButtonViewManager.ButtonViewGroup) {
-        return child
-      }
-    }
-
-    return null
-  }
 }
```

---

### Incident Patch 10: `d3547acd` (2026-08-26)
**Commit Message**: [Android] Fix buttons firing press events when a scroll takes over the touch (#4441)

## Description

`Pressable` without relation props presses natively through
`ButtonViewGroup`, whose managed `NativeViewGestureHandler` is attached
with `ACTION_TYPE_NONE`. RNGH delivers touches through the orchestrator
regardless of what happens in the native dispatch, so when a native
`ScrollView` takes the gesture over, nothing stops the handler - it
reaches `STATE_END` on lift and fires a press. This shows up in three
ways:

- fling catch: the `ScrollView` intercepts `DOWN` while decelerating,
the button never sees any native event, yet `onPress` fires on lift
(#4432)
- drag: the `ScrollView` intercepts on `MOVE` when the finger starts
scrolling from a row, and `onPress` still fires on lift
([comment](https://github.com/software-mansion/react-native-gesture-handler/issues/4432#issuecomment-5315039272))
- long press while scrolling: the content moves with the finger, so the
pointer never leaves the row and the long-press timer posted on `BEGAN`
fires mid-scroll (same comment)

In all three the `ScrollView` calls
`requestDisallowInterceptTouchEvent(true)`, but the existing sweep
(`cancelAllLegac

**File**: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/core/GestureHandlerOrchestrator.kt` (modified, +16/-9)
```diff
@@ -365,20 +365,13 @@ class GestureHandlerOrchestrator(
     event.recycle()
   }
 
-  /**
-   * Cancels all handlers created using API v1 and v2
-   */
-  fun cancelAllLegacyHandlers() {
+  private inline fun cancelHandlersMatching(predicate: (GestureHandler) -> Boolean) {
     val handlersToProcess = obtainHandlerList()
     handlersToProcess.addAll(gestureHandlers)
 
     try {
       handlersToProcess.forEach {
-        if (it.actionType == GestureHandler.ACTION_TYPE_JS_FUNCTION_OLD_API ||
-          it.actionType == GestureHandler.ACTION_TYPE_JS_FUNCTION_NEW_API ||
-          it.actionType == GestureHandler.ACTION_TYPE_REANIMATED_WORKLET ||
-          it.actionType == GestureHandler.ACTION_TYPE_NATIVE_ANIMATED_EVENT
-        ) {
+        if (predicate(it)) {
           it.cancel()
         }
       }
@@ -389,6 +382,20 @@ class GestureHandlerOrchestrator(
     }
   }
 
+  fun cancelAllLegacyHandlers() = cancelHandlersMatching {
+    it.actionType == GestureHandler.ACTION_TYPE_JS_FUNCTION_OLD_API ||
+      it.actionType == GestureHandler.ACTION_TYPE_JS_FUNCTION_NEW_API ||
+      it.actionType == GestureHandler.ACTION_TYPE_REANIMATED_WORKLET ||
+      it.actionType == GestureHandler.ACTION_TYPE_NATIVE_ANIMATED_EVENT
+  }
+
+  /**
+   * Cancels handlers whose view opted out of surviving a native view taking over the touch stream.
+   */
+  fun cancelHandlersOnNativeTouchGrab(grabbedMidGesture: Boolean) = cancelHandlersMatching {
+    it is NativeViewGestureHandler && it.shouldCancelOnNativeTouchGrab(grabbedMidGesture)
+  }
+
   /**
    * isViewAttachedUnderWrapper checks whether all of parents for view related to handler
    * view are attached. Since there might be an issue rarely observed when view
```

**File**: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/core/NativeViewGestureHandler.kt` (modified, +8/-0)
```diff
@@ -241,6 +241,9 @@ class NativeViewGestureHandler : GestureHandler() {
 
   override fun wantsToAttachDirectlyToView() = true
 
+  fun shouldCancelOnNativeTouchGrab(grabbedMidGesture: Boolean): Boolean =
+    hook.shouldCancelOnNativeTouchGrab(grabbedMidGesture)
+
   data class HitSlop(
     val left: Float = HIT_SLOP_NONE,
     val top: Float = HIT_SLOP_NONE,
@@ -361,6 +364,11 @@ class NativeViewGestureHandler : GestureHandler() {
      */
     fun shouldRecognizeSimultaneously(handler: GestureHandler): Boolean? = null
 
+    /**
+     * Called after a native view grabbed the touch lock; return true to cancel the handler.
+     */
+    fun shouldCancelOnNativeTouchGrab(grabbedMidGesture: Boolean) = false
+
     /**
      * shouldActivateOnStart and tryIntercept have priority over this method
      *
```

**File**: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/react/RNGestureHandlerButtonViewManager.kt` (modified, +19/-0)
```diff
@@ -717,6 +717,10 @@ class RNGestureHandlerButtonViewManager :
     // event).
     private var lastEventWasInside = false
 
+    // Whether the native dispatch delivered DOWN for the current gesture. False when a native
+    // ancestor intercepted it — the orchestrator still delivers events then.
+    private var receivedNativeDown = false
+
     override fun onHandlerUpdate(handler: NativeViewGestureHandler) {
       if (managedHandlerTag == null || handler.isWithinBounds == lastEventWasInside) {
         return
@@ -744,6 +748,11 @@ class RNGestureHandlerButtonViewManager :
       val localLastEventWasInside = lastEventWasInside
 
       if (newState == GestureHandler.STATE_BEGAN) {
+        // Reset here, not on gesture end: the native DOWN sets the flag even when the orchestrator
+        // never tracks the handler (disabled button, alpha below the traversal threshold), so a
+        // terminal state may never come and the stale value would survive. BEGAN precedes both the
+        // native dispatch of the same DOWN and the sweep that reads the flag.
+        receivedNativeDown = false
         dispatchJSEvent(EventType.PressIn, handler)
         longPressDetected = false
 
@@ -815,6 +824,16 @@ class RNGestureHandlerButtonViewManager :
       }
     }
 
+    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
+      if (event.actionMasked == MotionEvent.ACTION_DOWN) {
+        receivedNativeDown = true
+      }
+
+      return super.dispatchTouchEvent(event)
+    }
+
+    override fun shouldCancelOnNativeTouchGrab(grabbedMidGesture: Boolean) = grabbedMidGesture || !receivedNativeDown
+
     override fun onInterceptTouchEvent(event: MotionEvent): Boolean {
       if (super.onInterceptTouchEvent(event)) {
         return true
```

**File**: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/react/RNGestureHandlerRootHelper.kt` (modified, +35/-1)
```diff
@@ -22,6 +22,8 @@ class RNGestureHandlerRootHelper(private val context: ReactContext, wrappedView:
   private var shouldIntercept = false
   private var wasIntercepting = false
   private var passingTouch = false
+  private var passingNativeTouch = false
+  private var nativeTouchGrabRequested = false
 
   init {
     val registry =
@@ -116,14 +118,46 @@ class RNGestureHandlerRootHelper(private val context: ReactContext, wrappedView:
 
   fun requestDisallowInterceptTouchEvent() {
     // If this method gets called it means that some native view is attempting to grab lock for
-    // touch event delivery. In that case we cancel all gesture recognizers
+    // touch event delivery. Legacy handlers are cancelled right away; handlers opting into
+    // native-touch-grab cancellation are deferred to `onNativeDispatchEnd`.
     if (orchestrator != null && !passingTouch) {
       // if we are in the process of delivering touch events via GH orchestrator, we don't want to
       // treat it as a native gesture capturing the lock
+      if (passingNativeTouch) {
+        // Requests may also arrive outside any dispatch pass (e.g. RN's JS responder). Those have
+        // no pass to classify against and must not arm the sweep for a future gesture.
+        nativeTouchGrabRequested = true
+      }
       orchestrator.cancelAllLegacyHandlers()
     }
   }
 
+  fun onNativeDispatchStart() {
+    passingNativeTouch = true
+  }
+
+  /**
+   * Deferred handling of a disallow-intercept request recorded during this dispatch pass. The
+   * request alone doesn't say what the caller did with the event: a scrollable calls it when it
+   * takes over the touch, but e.g. a nested pager calls it already on DOWN, just to keep its
+   * ancestors from stealing a swipe it may recognize later, and the event still reaches the
+   * button - at request time both calls look identical. They only become
+   * distinguishable once the native dispatch completes (did the button receive the DOWN?), which
+   * is why cancellation runs here instead of in `requestDisallowInterceptTouchEvent`.
+   */
+  fun onNativeDispatchEnd(event: MotionEvent) {
+    passingNativeTouch = false
+
+    if (nativeTouchGrabRequested) {
+      nativeTouchGrabRequested = false
+
+      val grabbedMidGesture = event.actionMasked != MotionEvent.ACTION_DOWN &&
+        event.actionMasked != MotionEvent.ACTION_POINTER_DOWN
+
+      orchestrator?.cancelHandlersOnNativeTouchGrab(grabbedMidGesture)
+    }
+  }
+
   fun dispatchTouchEvent(event: MotionEvent): Boolean {
     // We mark `mPassingTouch` before we get into `mOrchestrator.onTouchEvent` so that we can tell
     // if `requestDisallow` has been called as a result of a normal gesture handling process or
```

**File**: `packages/react-native-gesture-handler/android/src/main/java/com/swmansion/gesturehandler/react/RNGestureHandlerRootView.kt` (modified, +4/-1)
```diff
@@ -62,7 +62,10 @@ class RNGestureHandlerRootView(context: Context?) : ReactViewGroup(context) {
     return if (rootViewEnabled && rootHelper!!.dispatchTouchEvent(event)) {
       true
     } else {
-      super.dispatchTouchEvent(event)
+      rootHelper?.onNativeDispatchStart()
+      val handled = super.dispatchTouchEvent(event)
+      rootHelper?.onNativeDispatchEnd(event)
+      handled
     }
   }
 
```

---

### Incident Patch 11: `8819ea62` (2026-08-26)
**Commit Message**: Fix Errors.test.tsx failing with Reanimated 4.6.0 (#4474)

## Description

Since Reanimated 4.6.0 (software-mansion/react-native-reanimated#10107),
importing `react-native-reanimated` under Jest throws during module
evaluation:

```
    [Reanimated] `setCSSEventHandler` is not available in JSReanimated.
      at initializeReanimatedModule (src/initializers.native.ts:22)
      at Object.<anonymous> (src/index.ts:11)
```

Under `Jest`, `Reanimated` selects its `JSReanimated` module (`IS_JEST`
check in `reanimatedModuleInstance.native.ts`), whose
`setCSSEventHandler` stub throws, and `initializers.native.ts` calls it
unconditionally as an import side effect. Our `reanimatedWrapper`
catches the error and silently falls back to `Reanimated = undefined`.



This PR mocks `reanimatedWrapper` in `Errors.test.tsx` (same pattern as
`runOnJSReanimatedHandlers.test.tsx`), which makes the suite independent
of whether the real Reanimated can be imported under Jest. The mock
additionally provides `useComposedEventHandler`, which
`InterceptingGestureDetector` calls.

## Test plan

- yarn test — 19/19 suites, 159/159 tests pass (Errors.test.tsx was
failing on main before this change)

**File**: `packages/react-native-gesture-handler/src/__tests__/Errors.test.tsx` (modified, +22/-0)
```diff
@@ -15,6 +15,28 @@ jest.mock('react-native-worklets', () =>
   require('react-native-worklets/src/mock')
 );
 
+// Reanimated 4.6.0 throws on import under Jest (`setCSSEventHandler` is not
+// available in JSReanimated), which reanimatedWrapper silently turns into
+// `Reanimated = undefined`. Mock the wrapper so gestures with worklet
+// callbacks still take the Reanimated detector path these tests rely on.
+//
+// TODO: Remove after fixed in Reanimated
+jest.mock('../handlers/gestures/reanimatedWrapper', () => ({
+  Reanimated: {
+    useHandler: jest.fn(() => ({
+      doDependenciesDiffer: false,
+      context: { lastUpdateEvent: undefined },
+    })),
+    useEvent: jest.fn(() => jest.fn()),
+    useComposedEventHandler: jest.fn(() => jest.fn()),
+    isSharedValue: (value: unknown): boolean =>
+      value !== null && typeof value === 'object' && 'value' in value,
+    useSharedValue: <T,>(value: T) => ({ value }),
+    setGestureState: jest.fn(),
+  },
+  Worklets: undefined,
+}));
+
 beforeEach(() => cleanup());
 jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
   findNodeHandle: jest.fn(),
```

---

### Incident Patch 12: `80cfa6f9` (2026-08-26)
**Commit Message**: [Web] Fix `delayTimeout` type `FlingGestureHandler` (#4471)

## Description

Leftover from #4381: the web handlers' timeout fields were changed to `ReturnType<typeof setTimeout>`. `FlingGestureHandler` was the one that PR missed.

## Test plan

`yarn ts-check` passes

**File**: `packages/react-native-gesture-handler/src/web/handlers/FlingGestureHandler.ts` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ export default class FlingGestureHandler extends GestureHandler {
 
   private maxDurationMs = DEFAULT_MAX_DURATION_MS;
   private minVelocity = DEFAULT_MIN_VELOCITY;
-  private delayTimeout!: number;
+  private delayTimeout: ReturnType<typeof setTimeout> | undefined;
 
   private maxNumberOfPointersSimultaneously = 0;
   private keyPointer = NaN;
```

---

### Incident Patch 13: `6f73a7e1` (2026-08-24)
**Commit Message**: Fix v3 CI path filter case and remove stale files entry (#4465)

## Description

Two small cleanups:

- The path filter in `rngh-api-v3.yml` pointed at `API_V3.test.tsx`, but
the file is `api_v3.test.tsx` and GitHub path filters are
case-sensitive, so a PR touching only the v3 test suite never triggered
the workflow. The mismatch has been there since the workflow was added
in #3838. Also lowercased the pattern in the `yarn test` step to match
the file literally (it worked before only because jest matches patterns
case-insensitively).
- Removed `android/common/src/main/java/` from `files` in `package.json`
- the directory was deleted in #3544, npm silently ignores the unmatched
entry.

## Test plan

- `npx jest --listTests RelationsTraversal api_v3` still selects both
test files.

**File**: `.github/workflows/rngh-api-v3.yml` (modified, +2/-2)
```diff
@@ -5,7 +5,7 @@ on:
     paths:
       - packages/react-native-gesture-handler/src/v3/**
       - packages/react-native-gesture-handler/src/__tests__/RelationsTraversal.test.tsx
-      - packages/react-native-gesture-handler/src/__tests__/API_V3.test.tsx
+      - packages/react-native-gesture-handler/src/__tests__/api_v3.test.tsx
   push:
     branches:
       - main
@@ -35,4 +35,4 @@ jobs:
 
       - name: Run tests
         working-directory: packages/react-native-gesture-handler
-        run: yarn test RelationsTraversal API_V3
+        run: yarn test RelationsTraversal api_v3
```

**File**: `packages/react-native-gesture-handler/package.json` (modified, +0/-1)
```diff
@@ -35,7 +35,6 @@
     "android/src/main/AndroidManifest.xml",
     "android/src/main/java/",
     "android/src/main/jni/",
-    "android/common/src/main/java/",
     "android/reanimated/src/main/java/",
     "android/noreanimated/src/main/java/",
     "android/svg",
```

---

### Incident Patch 14: `33c4f28b` (2026-08-19)
**Commit Message**: Fix dead presses in `"never"` mode when the keyboard belongs to a native field (#4439)

## Description

With a Gesture Handler `ScrollView` in the default (`never`)
`keyboardShouldPersistTaps` mode, a keyboard opened by a native field
(e.g. a native-stack `headerSearchBarOptions` search bar) made every
RNGH `Pressable`/`Touchable` inside dead, with no way to dismiss the
keyboard by tapping. The keyboard-dismissing tap drop (#992) checks only
keyboard visibility, but the dismissal blurs
`TextInput.State.currentlyFocusedInput()`, which is `null` for native
fields - the tap was consumed while nothing could be dismissed.

Now the tap is dropped only when an RN `TextInput` is focused, mirroring
RN ScrollView's `_keyboardIsDismissible`. Focus is snapshotted when the
keyboard shows, since the dismissal blurs the input at touch-down,
before the press events are checked; a live check is OR-ed in for focus
moving to an RN input while the keyboard is already up. With a
native-field keyboard, presses now behave like RN's `Pressable`: they
fire and the keyboard stays.


## Test plan

- `yarn test` — added cases: no drop when the keyboard is up without a
focused RN input; the drop verdict surviv

**File**: `packages/react-native-gesture-handler/src/__tests__/api_v3.test.tsx` (modified, +47/-1)
```diff
@@ -5,7 +5,7 @@ import {
   screen,
 } from '@testing-library/react-native';
 import { act } from 'react';
-import { Keyboard, View } from 'react-native';
+import { Keyboard, TextInput, View } from 'react-native';
 
 import GestureHandlerRootView from '../components/GestureHandlerRootView';
 import { fireGestureHandler, getByGestureTestId } from '../jestUtils';
@@ -454,8 +454,17 @@ describe('[API v3] Components', () => {
       keyboardShouldPersistTaps,
     });
 
+    // The drop requires a focused RN TextInput to blur.
+    const focusInput = () =>
+      jest
+        .spyOn(TextInput.State, 'currentlyFocusedInput')
+        .mockReturnValue(
+          {} as ReturnType<typeof TextInput.State.currentlyFocusedInput>
+        );
+
     test('isKeyboardDismissingTap is true only in never mode while the keyboard is visible', async () => {
       const addListenerSpy = jest.spyOn(Keyboard, 'addListener');
+      const focusSpy = focusInput();
 
       render(
         <GestureHandlerRootView>
@@ -477,7 +486,38 @@ describe('[API v3] Components', () => {
       // Outside an RNGH ScrollView there is no context, so nothing is dropped.
       expect(isKeyboardDismissingTap(null)).toBe(false);
 
+      // The verdict must survive the dismissal blurring the input mid-tap.
+      focusSpy.mockReturnValue(undefined);
+      expect(isKeyboardDismissingTap(makeContext('never'))).toBe(true);
+
       addListenerSpy.mockRestore();
+      focusSpy.mockRestore();
+    });
+
+    test('isKeyboardDismissingTap is false when no RN TextInput is focused (native field keyboard)', async () => {
+      const addListenerSpy = jest.spyOn(Keyboard, 'addListener');
+
+      render(
+        <GestureHandlerRootView>
+          <ScrollView keyboardShouldPersistTaps="never" />
+        </GestureHandlerRootView>
+      );
+      await act(flushImmediate);
+
+      // Keyboard up for a native field (e.g. a native-stack search bar) -
+      // no RN TextInput to blur, so the tap must not be dropped.
+      showKeyboard(addListenerSpy);
+
+      expect(TextInput.State.currentlyFocusedInput()).toBeNull();
+      expect(isKeyboardDismissingTap(makeContext('never'))).toBe(false);
+
+      // Focus moving to an RN input while the keyboard stays up makes the
+      // tap dismissible again.
+      const focusSpy = focusInput();
+      expect(isKeyboardDismissingTap(makeContext('never'))).toBe(true);
+
+      addListenerSpy.mockRestore();
+      focusSpy.mockRestore();
     });
 
     test('isKeyboardDismissingTap is false for a detached (height 0) keyboard', async () => {
@@ -500,6 +540,7 @@ describe('[API v3] Components', () => {
 
     test('Touchable does NOT fire any press callback on the keyboard-dismissing tap (never)', async () => {
       const addListenerSpy = jest.spyOn(Keyboard, 'addListener');
+      const focusSpy = focusInput();
       const onPress = jest.fn();
       const onPressIn = jest.fn();
       const onPressOut = jest.fn();
@@ -519,6 +560,10 @@ describe('[API v3] Components', () => {
       await act(flushImmediate);
       showKeyboard(addListenerSpy);
 
+      // The 'never' responder blurs the input at touch-down, before the
+      // press events arrive - mirror that ordering.
+      focusSpy.mockReturnValue(undefined);
+
       // Includes a re-entry PressIn (finger dragged out and back in) so the
       // capture-once verdict path is exercised too.
       const button = screen.getByTestId('touchable');
@@ -535,6 +580,7 @@ describe('[API v3] Components', () => {
       expect(onPressIn).not.toHaveBeenCalled();
       expect(onPressOut).not.toHaveBeenCalled();
       addListenerSpy.mockRestore();
+      focusSpy.mockRestore();
     });
 
     test('Touchable fires onPress in never mode when the keyboard is not visible', async () => {
```

**File**: `packages/react-native-gesture-handler/src/v3/scrollViewInterop.ts` (modified, +17/-1)
```diff
@@ -1,4 +1,5 @@
 import * as React from 'react';
+import { TextInput } from 'react-native';
 
 export type KeyboardShouldPersistTaps =
   | boolean
@@ -27,9 +28,15 @@ export function updateResponderEventValue(
 }
 
 let isKeyboardVisible = false;
+let keyboardOpenedForRNInput = false;
 
 export function setKeyboardVisibility(visible: boolean) {
   isKeyboardVisible = visible;
+
+  // Snapshotted at show-time: the dismissal blurs the input at touch-down,
+  // before the press events get checked
+  keyboardOpenedForRNInput =
+    visible && TextInput.State.currentlyFocusedInput?.() != null;
 }
 
 export function isKeyboardDismissingTap(
@@ -42,5 +49,14 @@ export function isKeyboardDismissingTap(
   const mode = jsResponderContext.keyboardShouldPersistTaps;
   const keyboardNeverPersistTaps = !mode || mode === 'never';
 
-  return keyboardNeverPersistTaps && isKeyboardVisible;
+  // Drop only taps that can dismiss the keyboard, i.e. an RN TextInput is (or
+  // was at show-time) focused - mirrors RN ScrollView's `_keyboardIsDismissible`.
+  // A native field's keyboard (e.g. a native-stack search bar) can't be
+  // blurred, so dropping there would leave presses permanently dead
+  return (
+    keyboardNeverPersistTaps &&
+    isKeyboardVisible &&
+    (keyboardOpenedForRNInput ||
+      TextInput.State.currentlyFocusedInput?.() != null)
+  );
 }
```

---

### Incident Patch 15: `0d4b34fa` (2026-08-17)
**Commit Message**: Remove `REACT_NATIVE_MINOR_VERSION` build flag (#4422)

## Description

This PR removes the `REACT_NATIVE_MINOR_VERSION` build flag and fixes
the `target_compile_reactnative_options` call in the Android
`CMakeLists`.

The only consumer of `REACT_NATIVE_MINOR_VERSION` was a >= 81 check in
`RNGHRuntimeDecorator.cpp`, which is always true on supported
react-native versions. If a version check becomes necessary in the
future, react-native ships `<cxxreact/ReactNativeVersion.h>` with the
`REACT_NATIVE_VERSION_MINOR` macro, available on all platforms and build
systems.

The `target_compile_reactnative_options` block added in #3688 never
executed: it ran before `find_package(ReactAndroid)` defines
`ReactAndroid_VERSION_MINOR`, referenced an undefined `LIB_TARGET_NAME`,
and was missing the include of `react-native-flags.cmake` that defines
the function. This PR fixes it to match how reanimated and worklets use
it. Note that this applies RN_SERIALIZABLE_STATE and HERMES_V1_ENABLED=1
to our JNI target for the first time, matching how ReactAndroid itself
is built.

## Test plan

- basic-example builds and launches on iOS (pod install + yarn ios)
- basic-example builds on Android (assembleDebu

**File**: `packages/react-native-gesture-handler/RNGestureHandler.podspec` (modified, +1/-2)
```diff
@@ -5,7 +5,6 @@ is_gh_example_app = ENV["GH_EXAMPLE_APP_NAME"] != nil
 
 compilation_metadata_dir = "CompilationDatabase"
 compilation_metadata_generation_flag = is_gh_example_app ? '-gen-cdb-fragment-path ' + compilation_metadata_dir : ''
-version_flag = "-DREACT_NATIVE_MINOR_VERSION=#{GestureHandlerUtils.get_react_native_minor_version()}"
 use_worklets = GestureHandlerUtils.react_native_worklets_supports_stable_api()
 worklets_flag = use_worklets ? '-DRNGH_USE_WORKLETS=1' : ''
 
@@ -24,7 +23,7 @@ Pod::Spec.new do |s|
   s.requires_arc = true
   s.platforms       = { ios: '15.1', tvos: '15.1', osx: '14.0', visionos: '1.0' }
   s.xcconfig = {
-    "OTHER_CFLAGS" => "$(inherited) #{compilation_metadata_generation_flag} #{version_flag} #{worklets_flag}"
+    "OTHER_CFLAGS" => "$(inherited) #{compilation_metadata_generation_flag} #{worklets_flag}"
   }
 
   install_modules_dependencies(s);
```

**File**: `packages/react-native-gesture-handler/android/build.gradle` (modified, +0/-8)
```diff
@@ -146,12 +146,6 @@ def reactNativeArchitectures() {
 
 def REACT_NATIVE_DIR = resolveReactNativeDirectory()
 
-def reactProperties = new Properties()
-file("$REACT_NATIVE_DIR/ReactAndroid/gradle.properties").withInputStream { reactProperties.load(it) }
-
-def REACT_NATIVE_VERSION = reactProperties.getProperty("VERSION_NAME")
-def REACT_NATIVE_MINOR_VERSION = REACT_NATIVE_VERSION.split("\\.")[1].toInteger()
-
 repositories {
     mavenCentral()
 }
@@ -177,13 +171,11 @@ android {
     defaultConfig {
         minSdkVersion safeExtGet('minSdkVersion', 24)
         targetSdkVersion safeExtGet('targetSdkVersion', 33)
-        buildConfigField "int", "REACT_NATIVE_MINOR_VERSION", REACT_NATIVE_MINOR_VERSION.toString()
 
         externalNativeBuild {
             cmake {
                 cppFlags "-O2", "-frtti", "-fexceptions", "-Wall", "-Werror", "-std=c++20", "-DANDROID"
                 arguments "-DREACT_NATIVE_DIR=${REACT_NATIVE_DIR}",
-                        "-DREACT_NATIVE_MINOR_VERSION=${REACT_NATIVE_MINOR_VERSION}",
                         "-DRNGH_USE_WORKLETS=${shouldUseRuntimeFromWorklets()}",
                         "-DANDROID_STL=c++_shared",
                         "-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON"
```

**File**: `packages/react-native-gesture-handler/android/src/main/jni/CMakeLists.txt` (modified, +5/-14)
```diff
@@ -1,17 +1,8 @@
 project(GestureHandler)
 cmake_minimum_required(VERSION 3.9.0)
 
-string(
-  APPEND
-  CMAKE_CXX_FLAGS
-  " -DREACT_NATIVE_MINOR_VERSION=${REACT_NATIVE_MINOR_VERSION}")
-
 set(CMAKE_VERBOSE_MAKEFILE ON)
-if(${REACT_NATIVE_MINOR_VERSION} GREATER_EQUAL 73)
-    set(CMAKE_CXX_STANDARD 20)
-else()
-    set(CMAKE_CXX_STANDARD 17)
-endif()
+set(CMAKE_CXX_STANDARD 20)
 
 set(PACKAGE_NAME "gesturehandler")
 set(RNGH_DIR "${CMAKE_SOURCE_DIR}/../../../../")
@@ -23,6 +14,8 @@ file(GLOB_RECURSE gesture_handler_shared_SRCS CONFIGURE_DEPENDS "${RNGH_DIR}/sha
 include(${REACT_ANDROID_DIR}/cmake-utils/folly-flags.cmake)
 add_compile_options(${folly_FLAGS})
 
+include(${REACT_NATIVE_DIR}/ReactCommon/cmake-utils/react-native-flags.cmake)
+
 add_library(${PACKAGE_NAME}
   SHARED
   ${gesture_handler_SRCS}
@@ -38,13 +31,11 @@ target_include_directories(
   "${REACT_NATIVE_DIR}/ReactCommon"
 )
 
-if(ReactAndroid_VERSION_MINOR GREATER_EQUAL 80)
-  target_compile_reactnative_options(${LIB_TARGET_NAME} PRIVATE)
-endif()
-
 find_package(ReactAndroid REQUIRED CONFIG)
 find_package(fbjni REQUIRED CONFIG)
 
+target_compile_reactnative_options(${PACKAGE_NAME} PRIVATE)
+
 target_link_libraries(
   ${PACKAGE_NAME}
   ReactAndroid::reactnative
```

**File**: `packages/react-native-gesture-handler/scripts/gesture_handler_utils.rb` (modified, +0/-28)
```diff
@@ -5,34 +5,6 @@ module GestureHandlerUtils
 
     MIN_REACT_NATIVE_WORKLETS_VERSION = Gem::Version.new('0.8.0')
 
-    def try_to_parse_react_native_package_json(react_native_dir)
-        react_native_package_json_path = File.join(react_native_dir, 'package.json')
-
-        if !File.exist?(react_native_package_json_path)
-            return nil
-        end
-
-        return JSON.parse(File.read(react_native_package_json_path))
-    end
-
-    def get_react_native_minor_version()
-        react_native_dir = File.dirname(`cd "#{Pod::Config.instance.installation_root.to_s}" && node --print "require.resolve('react-native/package.json')"`)
-        react_native_json = try_to_parse_react_native_package_json(react_native_dir)
-
-        if react_native_json == nil
-            node_modules_dir = ENV["REACT_NATIVE_NODE_MODULES_DIR"]
-            if node_modules_dir != nil
-                react_native_json = try_to_parse_react_native_package_json(File.join(node_modules_dir, 'react-native'))
-            end
-        end
-
-        if react_native_json == nil
-            raise '[react-native-gesture-handler] Unable to recognize your `react-native` version. Please set environmental variable with `react-native` location: `export REACT_NATIVE_NODE_MODULES_DIR="<path to react-native>" && pod install`.'
-        end
-
-        return react_native_json['version'].split('.')[1].to_i
-    end
-
     def node_package_dir(package_name)
         package_json_path = `cd "#{Pod::Config.instance.installation_root.to_s}" && node --print "require.resolve('#{package_name}/package.json')" 2>/dev/null`.strip
 
```

**File**: `packages/react-native-gesture-handler/shared/runtime/RNGHRuntimeDecorator.cpp` (modified, +0/-4)
```diff
@@ -32,12 +32,8 @@ void RNGHRuntimeDecorator::installRNRuntimeBindings(
           return jsi::Value::null();
         }
 
-#if REACT_NATIVE_MINOR_VERSION >= 81
         auto shadowNode = Bridging<std::shared_ptr<const ShadowNode>>::fromJs(
             runtime, args[0]);
-#else
-        auto shadowNode = shadowNodeFromValue(runtime, args[0]);
-#endif
 
 #ifndef ANDROID
         if (dynamic_pointer_cast<const ParagraphShadowNode>(shadowNode)) {
```

#### Recent Merged Pull Requests:
- **PR #4560** (2026-10-02): Bump joi from 17.13.6 to 17.13.8 (@dependabot[bot])
- **PR #4559** (2026-10-02): Bump brace-expansion from 1.1.18 to 1.1.21 (@dependabot[bot])
- **PR #4558** (2026-10-02): Bump fast-uri from 3.1.7 to 3.1.8 in /packages/docs-gesture-handler (@dependabot[bot])
- **PR #4557** (2026-10-05): [Web] Align Tap maxDelay default with native (200 ms) (@Shexter)
- **PR #4556** (2026-10-02): [General] Hide non-serializable gesture fields from enumeration (@m-bert)
- **PR #4553** (closed): fix(rngh): fixed closure warning (@tshmieldev)
- **PR #4552** (2026-10-02): Bump undici from 8.10.0 to 8.11.2 (@dependabot[bot])
- **PR #4550** (2026-09-29): [CI] Retry failed e2e flows before failing the job (@j-piasecki)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
