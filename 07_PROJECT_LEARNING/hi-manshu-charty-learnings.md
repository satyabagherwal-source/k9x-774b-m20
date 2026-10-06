# Forensic Learning Record (Deep Inspection): hi-manshu/charty

> **Canonical Artifact**: `07_PROJECT_LEARNING/hi-manshu-charty-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/hi-manshu/charty](https://github.com/hi-manshu/charty))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:05:17.252Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `hi-manshu/charty`
- **Description**: Weave data into enchanting Jetpack Compose graphs—no potions required! 📜🔮
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1288 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `charty/src/commonMain/kotlin/com/himanshoe/charty/bar/internal/bar/groupedhorizontal/GroupedHorizontalState.kt`
```
package com.himanshoe.charty.bar.internal.bar.groupedhorizontal

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.util.fastFlatMap
import com.himanshoe.charty.bar.data.BarGroup
import com.himanshoe.charty.color.ChartyColor
import com.himanshoe.charty.common.config.NegativeValuesDrawMode
import com.himanshoe.charty.common.constants.ChartConstants
import com.himanshoe.charty.common.util.calculateNiceAxisRange

/**
 * Memoized state for [com.himanshoe.charty.bar.GroupedHorizontalBarChart].
 *
 * @property minValue Nice (rounded) minimum value for the value axis.
 * @property maxValue Nice (rounded) maximum value for the value axis.
 * @property axisSteps Number of intervals between axis ticks (computed to ensure zero is a tick
 *   whenever the range spans both negative and positive values).
 * @property colorList Resolved list of bar colours.
 */
internal data class GroupedHorizontalState(
    val minValue: Float,
    val maxValue: Float,
    val axisSteps: Int,
    val colorList: List<Color>,
)

/**
 * Memoizes the axis range and colour list derived from [dataList] and [colors].
 *
 * Uses a D3-style "nice axis" algorithm so that axis ticks land on round numbers and — when the
 * data spans both negative and positive values in [NegativeValuesDrawMode.BELOW_AXIS] mode —
 * zero is guaranteed to coincide with a tick mark.
 */
@Composable
internal fun rememberGroupedHorizontalState(
    dataList: List<BarGroup>,
    negativeValuesDrawMode: NegativeValuesDrawMode,
    colors: ChartyColor,
): GroupedHorizontalState =
    remember(dataList, negativeValuesDrawMode, colors) {
        val allValues = dataList.fastFlatMap { it.values }
        val rawMin = allValues.minOrNull() ?: 0f
        val rawMax = allValues.maxOrNull() ?: 0f

        val axisMin =
            if (negativeValuesDrawMode == NegativeValuesDrawMode.BELOW_AXIS && rawMin >= 0f) {
                0f
            } else {
                rawMin
            }
        val axisMax =
            if (rawMax < axisMin) {
                axisMin
            } else {
                rawMax
            }

        val (niceMin, niceMax, steps) =
            calculateNiceAxisRange(
                rawMin = axisMin,
                rawMax = axisMax,
                targetSteps = ChartConstants.DEFAULT_AXIS_STEPS,
            )

        GroupedHorizontalState(
            minValue = niceMin,
            maxValue = niceMax,
            axisSteps = steps,
            colorList = colors.value,
        )
    }

```

### Core Architecture Module: `charty/src/commonMain/kotlin/com/himanshoe/charty/common/CartesianChartState.kt`
```
package com.himanshoe.charty.common

import androidx.compose.animation.core.Animatable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import com.himanshoe.charty.common.animation.rememberAnimatedRange
import com.himanshoe.charty.common.animation.rememberChartAnimation
import com.himanshoe.charty.common.config.Animation
import com.himanshoe.charty.common.config.ChartInteractionConfig

private val EmptyValueRange = 0f to 0f

/**
 * The state every Cartesian chart resolves before it draws: which slice of the series is visible,
 * the axis range that slice maps onto, how far the reveal animation has progressed, and what a
 * screen reader should say about it. Produced by [rememberCartesianChartState].
 *
 * [data] and [displayData] are deliberately separate. [data] is the windowed truth and is what
 * hit-testing, axis labels, and data-size bookkeeping must use; [displayData] is the same series
 * with its values tweened toward their targets, and is what the canvas draws. When a chart does not
 * animate value changes the two are the same list.
 *
 * @property fullData The complete series the caller supplied, before any windowing.
 * @property data The windowed — and where enabled, downsampled — points the chart works with.
 * @property displayData [data] with per-value change animation applied, ready to draw.
 * @property streaming The layout sliding a rolling window, or `null` when the chart draws statically.
 * @property minValue The axis minimum for this frame, already smoothed while streaming.
 * @property maxValue The axis maximum for this frame, already smoothed while streaming.
 * @property animationProgress The reveal progress from `0f` to `1f`. Kept as an [Animatable] rather
 *   than a plain `Float` so drawing code reads `.value` inside the draw phase and each animation
 *   frame redraws without recomposing the chart.
 * @property description The chart-level accessibility summary, or `null` when the chart supplies no
 *   summary generator or the caller suppressed the description.
 */
@Immutable
internal class CartesianChartState<T>(
    val fullData: List<T>,
    val data: List<T>,
    val displayData: List<T>,
    val streaming: StreamingLayout?,
    val minValue: Float,
    val maxValue: Float,
    val animationProgress: Animatable<Float, *>,
    val description: String?,
)

/**
 * Resolves the opening sequence shared by every Cartesian chart, in the one order they all need it:
 * window the series (see [rememberVisibleData]), tween its values, derive the axis range from the
 * result, smooth that range while streaming (see [rememberAnimatedRange]), start the reveal
 * animation, build the accessibility summary, and publish the resulting data sizes to the
 * interaction state holders.
 *
 * Every hook inside runs on every composition — the optional behaviour is expressed through the
 * default lambdas rather than through skipped calls — so a chart never changes its hook order by
 * switching between static, windowed, and streaming modes.
 *
 * Charts differ in where their range comes from: some read the windowed values, some the tweened
 * ones, some pin the minimum to zero and animate only the maximum. [range] receives both lists and
 * returns the pair it wants, which expresses all three without a further parameter. A chart with no
 * value axis at all — a normalized or mosaic layout, where every bar fills its slot — simply omits
 * [range] and ignores [CartesianChartState.minValue] and [CartesianChartState.maxValue].
 *
 * @param fullData The complete series. Callers must handle the empty case before calling, since a
 *   composable cannot return early on their behalf.
 * @param interactionConfig Supplies the viewport, streaming, brush-selection, and accessibility
 *   settings, and receives the resolved data sizes.
 * @param animation Drives the reveal, the value tweening, and the streaming range smoothing.
 * @param visibleWindow The rolling "show last N" window, or `null` to show everything.
 * @param downsampleThreshold The maximum points to render, or `null` to disable downsampling.
 * @param downsampleValue Extracts the y-value that downsampling preserves the shape of. Required
 *   only when [downsampleThreshold] is set.
 * @param displayData Applies per-value change animation to the windowed points; defaults to passing
 *   them through untouched.
 * @param describe Builds the accessibility summary from the full series and the resolved axis
 *   range, or `null` when the chart provides its own accessibility payload.
 * @param range Derives the raw `(min, max)` axis range from the windowed points and the tweened
 *   points; defaults to a zero range for charts without a value axis.
 * @return The resolved state for this frame.
 */
@Composable
internal fun <T> rememberCartesianChartState(
    fullData: List<T>,
    interactionConfig: ChartInteractionConfig,
    animation: Animation,
    visibleWindow: Int?,
    downsampleThreshold: Int? = null,
    downsampleValue: ((T) -> Float)? = null,
    displayData: @Composable (List<T>) -> List<T> = { it },
    describe: ((data: List<T>, minValue: Float, maxValue: Float) -> String)? = null,
    range: @Composable (data: List<T>, displayData: List<T>) -> Pair<Float, Float> = { _, _ -> EmptyValueRange },
): CartesianChartState<T> {
    val visible =
        rememberVisibleData(
            fullDataList = fullData,
            interactionConfig = interactionConfig,
            downsampleThreshold = downsampleThreshold,
            visibleWindow = visibleWindow,
            animation = animation,
            value = { item -> downsampleValue?.invoke(item) ?: 0f },
        )
    val data = visible.data
    val display = displayData(data)
    val (rawMinValue, rawMaxValue) = range(data, display)
    val (minValue, maxValue) =
        rememberAnimatedRange(
            minValue = rawMinValue,
            maxValue = rawMaxValue,
            animation = animation,
            active = visible.streaming != null,
        )
    val animationProgress = rememberChartAnimation(animation)
    val generatedDescription =
        rememberChartDescription(fullData, interactionConfig.accessibilityDescription) { series ->
            describe?.invoke(series, minValue, maxValue).orEmpty()
        }
    syncInteractionDataSizes(
        viewPortState = interactionConfig.viewPortState,
        brushSelectionState = interactionConfig.brushSelectionState,
        fullDataSize = fullData.size,
        dataSize = data.size,
    )
    return CartesianChartState(
        fullData = fullData,
        data = data,
        displayData = display,
        streaming = visible.streaming,
        minValue = minValue,
        maxValue = maxValue,
        animationProgress = animationProgress,
        description = if (describe == null) null else generatedDescription,
    )
}

```

### Core Architecture Module: `charty/src/commonMain/kotlin/com/himanshoe/charty/common/ChartEmptyState.kt`
```
package com.himanshoe.charty.common

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.sp
import com.himanshoe.charty.common.theme.currentChartyTheme

private const val EMPTY_TEXT_SP = 14

/**
 * The placeholder a chart renders instead of throwing when it has no data — so empty or
 * not-yet-loaded data shows something rather than crashing. Charts fall back to this automatically
 * when their data list is empty; it is public so callers can reuse the same look.
 *
 * Pass [content] to fully replace the default message with your own composable (spinner, illustration,
 * retry button, etc.); it is centered within [modifier].
 *
 * @param modifier Modifier applied to the placeholder (typically the chart's own modifier, so it
 *   fills the same space).
 * @param message The text shown when [content] is `null`; defaults to "No data".
 * @param textStyle Text style for the message; defaults to the ambient theme's label color.
 * @param content Optional custom placeholder; when non-null it replaces [message].
 */
@Composable
fun ChartEmptyState(
    modifier: Modifier = Modifier,
    message: String = "No data",
    textStyle: TextStyle = TextStyle(color = currentChartyTheme.labelTextStyle.color, fontSize = EMPTY_TEXT_SP.sp),
    content: (@Composable () -> Unit)? = null,
) {
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        if (content != null) {
            content()
        } else {
            BasicText(text = message, style = textStyle)
        }
    }
}

```

### Core Architecture Module: `charty/src/commonMain/kotlin/com/himanshoe/charty/common/ChartStreamingRender.kt`
```
package com.himanshoe.charty.common

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import com.himanshoe.charty.common.config.ChartInteractionConfig
import com.himanshoe.charty.common.streaming.StreamingState

/**
 * Everything [ChartScaffold] needs to render a chart in rolling-window streaming mode: where the window
 * currently sits, and the floating control that offers to jump back to the live edge.
 *
 * The two travel together because they are two views of the same thing — a window that has been dragged
 * off the newest point — and bundling them keeps the scaffold's parameter list stable as streaming grows
 * new affordances.
 *
 * Instances are created by the charts themselves; pass `null` to [ChartScaffold] for a static chart.
 *
 * @property layout The sliding window layout that positions the series and the category-axis labels, or
 *   `null` when the chart is not streaming.
 * @property overlay Composable drawn on top of the plot while the window is detached, typically a
 *   "jump to latest" affordance. `null` renders nothing.
 */
@Immutable
class ChartStreamingRender internal constructor(
    val layout: StreamingLayout?,
    val overlay: (@Composable () -> Unit)? = null,
)

/**
 * Builds the [ChartStreamingRender] a chart hands to [ChartScaffold], wiring the consumer's
 * [ChartInteractionConfig.jumpToLatest] slot to [ChartInteractionConfig.streamingState] only when the
 * chart is actually streaming with scrollback enabled. Anything less — no rolling window, no scrollback
 * state, or no overlay slot — renders the layout alone, exactly as before.
 *
 * @param layout The active streaming layout, or `null` when the chart is not streaming.
 */
internal fun ChartInteractionConfig.streamingRender(layout: StreamingLayout?): ChartStreamingRender {
    val state = streamingState
    val slot = jumpToLatest
    if (layout == null || state == null || slot == null) {
        return ChartStreamingRender(layout = layout, overlay = null)
    }
    return ChartStreamingRender(
        layout = layout,
        overlay = { ChartJumpToLatestSlot(state = state, content = slot) },
    )
}

/**
 * Renders [content] only while [state] is detached from the live edge, so the "jump to latest" control
 * appears exactly when there is somewhere to jump to. Keeping the check in its own composable scopes the
 * [StreamingState.isFollowing] read here instead of recomposing the whole chart on every attach/detach.
 *
 * @param state The scrollback state being observed.
 * @param content The consumer-supplied control.
 */
@Composable
internal fun ChartJumpToLatestSlot(
    state: StreamingState,
    content: @Composable (StreamingState) -> Unit,
) {
    if (!state.isFollowing) {
        content(state)
    }
}

```

### Core Architecture Module: `charty/src/commonMain/kotlin/com/himanshoe/charty/common/brush/BrushSelectionState.kt`
```
package com.himanshoe.charty.common.brush

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue

/**
 * Tracks the active brush-selection range drawn over a chart.
 *
 * A brush selection lets the user drag horizontally across the chart to highlight a
 * contiguous range of data points. The selected pixel range is converted to data-index
 * bounds via [toIndexRange] once the gesture completes.
 *
 * Use [rememberBrushSelectionState] to create an instance.
 */
class BrushSelectionState {
    /**
     * The pixel x-coordinate where the drag gesture started, or `null` when no selection is active.
     */
    var startX: Float? by mutableStateOf(null)
        private set

    /**
     * The pixel x-coordinate of the current drag position, or `null` when no selection is active.
     */
    var currentX: Float? by mutableStateOf(null)
        private set

    internal var chartLeft: Float = 0f
    internal var chartRight: Float = 0f
    internal var dataSize: Int = 0

    /**
     * `true` while a drag gesture is in progress and a selection rectangle is being drawn.
     */
    val isActive: Boolean get() = startX != null

    /**
     * The (min, max) pixel x-coordinates of the current selection, always ordered `start ≤ end`
     * regardless of drag direction. Returns `null` when no selection is active.
     */
    val pixelRange: Pair<Float, Float>?
        get() {
            val s = startX ?: return null
            val c = currentX ?: return null
            return if (s <= c) {
                s to c
            } else {
                c to s
            }
        }

    /**
     * Converts the current pixel selection to a pair of data indices clamped to `[0, dataSize-1]`.
     *
     * Requires the chart to have set [chartLeft], [chartRight], and [dataSize] during its draw
     * pass. Returns `null` when no selection is active or chart bounds have not yet been set.
     *
     * @return A pair of `(startIndex, endIndex)` into the chart's data list, or `null`.
     */
    fun toIndexRange(): Pair<Int, Int>? {
        val (startPx, endPx) = pixelRange ?: return null
        val totalWidth = (chartRight - chartLeft).coerceAtLeast(1f)
        val startFrac = ((startPx - chartLeft) / totalWidth).coerceIn(0f, 1f)
        val endFrac = ((endPx - chartLeft) / totalWidth).coerceIn(0f, 1f)
        val maxIndex = (dataSize - 1).coerceAtLeast(0)
        val startIdx = (startFrac * dataSize).toInt().coerceIn(0, maxIndex)
        val endIdx = (endFrac * dataSize).toInt().coerceIn(0, maxIndex)
        return startIdx to endIdx
    }

    internal fun start(x: Float) {
        startX = x
        currentX = x
    }

    internal fun update(x: Float) {
        currentX = x
    }

    internal fun clear() {
        startX = null
        currentX = null
    }
}

/**
 * Creates and remembers a [BrushSelectionState] instance that survives recomposition.
 *
 * Pass the returned state to a chart's `brushSelectionState` parameter to enable drag-to-select
 * gestures. Use the accompanying `onRangeSelect` callback to act on the committed selection.
 */
@Composable
fun rememberBrushSelectionState(): BrushSelectionState = remember { BrushSelectionState() }

```

### Core Architecture Module: `charty/src/commonMain/kotlin/com/himanshoe/charty/common/draw/ChartDrawUtils.kt`
```
package com.himanshoe.charty.common.draw

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.text.TextMeasurer
import com.himanshoe.charty.color.ChartyColor
import com.himanshoe.charty.color.toBrush
import com.himanshoe.charty.color.toHorizontalBrush
import com.himanshoe.charty.common.ChartContext
import com.himanshoe.charty.common.ChartOrientation
import com.himanshoe.charty.common.config.ReferenceBandConfig
import com.himanshoe.charty.common.config.ReferenceLineConfig
import com.himanshoe.charty.common.tooltip.TooltipConfig
import com.himanshoe.charty.common.tooltip.TooltipState
import com.himanshoe.charty.common.tooltip.drawTooltip

/**
 * Common drawing utilities for charts
 */

/**
 * Draws a reference line on the chart if a [ReferenceLineConfig] is provided.
 *
 * @param referenceLineConfig The configuration for the reference line. If `null`, no line is drawn.
 * @param chartContext The context of the chart, providing dimensions and value range.
 * @param orientation The orientation of the chart, either [ChartOrientation.VERTICAL] or [ChartOrientation.HORIZONTAL].
 * @param textMeasurer A [TextMeasurer] used for measuring the label text.
 */
fun DrawScope.drawReferenceLineIfNeeded(
    referenceLineConfig: ReferenceLineConfig?,
    chartContext: ChartContext,
    orientation: ChartOrientation,
    textMeasurer: TextMeasurer,
) {
    referenceLineConfig?.let { config ->
        drawReferenceLine(
            chartContext = chartContext,
            orientation = orientation,
            config = config,
            textMeasurer = textMeasurer,
        )
    }
}

/**
 * Draws a reference band on the chart if a [ReferenceBandConfig] is provided. Call before the data
 * so the band renders behind it.
 *
 * @param referenceBandConfig The band configuration. If `null`, nothing is drawn.
 * @param chartContext The context of the chart, providing dimensions and value range.
 * @param orientation The orientation of the value axis.
 * @param textMeasurer A [TextMeasurer] used for the optional label.
 */
fun DrawScope.drawReferenceBandIfNeeded(
    referenceBandConfig: ReferenceBandConfig?,
    chartContext: ChartContext,
    orientation: ChartOrientation,
    textMeasurer: TextMeasurer,
) {
    referenceBandConfig?.let { config ->
        drawReferenceBand(
            chartContext = chartContext,
            orientation = orientation,
            config = config,
            textMeasurer = textMeasurer,
        )
    }
}

/**
 * Draws a tooltip on the chart if a [TooltipState] is provided.
 *
 * @param tooltipState The state of the tooltip. If `null`, no tooltip is drawn.
 * @param tooltipConfig The configuration for the tooltip's appearance. Charts resolve their own
 *   `null` config against the ambient theme before drawing, so a `null` here means the caller asked
 *   for no tooltip at all and nothing is drawn.
 * @param textMeasurer A [TextMeasurer] used for measuring the tooltip text.
 * @param chartContext The context of the chart, providing dimensions.
 */
fun DrawScope.drawTooltipIfNeeded(
    tooltipState: TooltipState?,
    tooltipConfig: TooltipConfig?,
    textMeasurer: TextMeasurer,
    chartContext: ChartContext,
) {
    val state = tooltipState ?: return
    tooltipConfig?.let { config ->
        drawTooltip(
            tooltipState = state,
            config = config,
            textMeasurer = textMeasurer,
            chartWidth = chartContext.right,
            chartTop = chartContext.top,
            chartBottom = chartContext.bottom,
        )
    }
}

/**
 * Draws a highlighted point, typically used for tooltips, with a white outer circle and a colored inner circle.
 *
 * @param center The center position of the point.
 * @param pointRadius The base radius of the point.
 * @param colorBrush The [Brush] used for the inner circle.
 * @param outerRadiusAddition The additional radius for the outer halo circle.
 * @param innerRadiusAddition The additional radius for the inner colored circle.
 * @param haloColor The color or gradient of the outer halo that separates the point from the data.
 */
fun DrawScope.drawHighlightedPoint(
    center: Offset,
    pointRadius: Float,
    colorBrush: Brush,
    outerRadiusAddition: Float = 3f,
    innerRadiusAddition: Float = 2f,
    haloColor: ChartyColor = ChartyColor.Solid(Color.White),
) {
    drawCircle(
        brush = haloColor.toBrush(),
        radius = pointRadius + outerRadiusAddition,
        center = center,
    )
    drawCircle(
        brush = colorBrush,
        radius = pointRadius + innerRadiusAddition,
        center = center,
    )
}

/**
 * Draw a vertical guideline with customizable appearance
 *
 * @param x The x-coordinate of the line
 * @param chartContext The chart context with dimensions
 * @param color The color or gradient of the line (default black)
 * @param strokeWidth The width of the line (default 1.5f)
 * @param alpha The opacity applied to the line color (default 0.1f)
 */
fun DrawScope.drawVerticalGuideline(
    x: Float,
    chartContext: ChartContext,
    color: ChartyColor = ChartyColor.Solid(Color.Black),
    strokeWidth: Float = 1.5f,
    alpha: Float = 0.1f,
) {
    drawLine(
        brush = color.toBrush(),
        alpha = alpha,
        start = Offset(x, chartContext.top),
        end = Offset(x, chartContext.bottom),
        strokeWidth = strokeWidth,
    )
}

/**
 * Draw a horizontal guideline with customizable appearance
 *
 * @param y The y-coordinate of the line
 * @param chartContext The chart context with dimensions
 * @param color The color or gradient of the line (default black)
 * @param strokeWidth The width of the line (default 1.5f)
 * @param alpha The opacity applied to the line color (default 0.1f)
 */
fun DrawScope.drawHorizontalGuideline(
    y: Float,
    chartContext: ChartContext,
    color: ChartyColor = ChartyColor.Solid(Color.Black),
    strokeWidth: Float = 1.5f,
    alpha: Float = 0.1f,
) {
    drawLine(
        brush = color.toHorizontalBrush(),
        alpha = alpha,
        start = Offset(chartContext.left, y),
        end = Offset(chartContext.right, y),
        strokeWidth = strokeWidth,
    )
}

/**
 * Draw a circle with an outline (border)
 *
 * @param center The center position of the circle
 * @param radius The radius of the circle
 * @param fillBrush The brush for filling the circle
 * @param outlineColor The color or gradient of the outline
 * @param outlineWidth The width of the outline (default 2f)
 */
fun DrawScope.drawCircleWithOutline(
    center: Offset,
    radius: Float,
    fillBrush: Brush,
    outlineColor: ChartyColor,
    outlineWidth: Float = 2f,
) {
    drawCircle(
        brush = fillBrush,
        radius = radius,
        center = center,
    )
    drawCircle(
        brush = outlineColor.toBrush(),
        radius = radius,
        center = center,
        style =
            androidx.compose.ui.graphics.drawscope
                .Stroke(width = outlineWidth),
    )
}

```

### Core Architecture Module: `charty/src/commonMain/kotlin/com/himanshoe/charty/common/gesture/CrosshairState.kt`
```
package com.himanshoe.charty.common.gesture

import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.State
import androidx.compose.runtime.currentCompositeKeyHashCode
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.himanshoe.charty.common.PlotBoundsSource
import com.himanshoe.charty.common.config.ChartInteractionConfig
import com.himanshoe.charty.common.streaming.StreamingState
import com.himanshoe.charty.common.viewport.ViewPortState

/**
 * Holds the current position and value label for the crosshair overlay.
 *
 * @property x Pixel x-coordinate of the snapped data point on the canvas.
 * @property y Pixel y-coordinate of the snapped data point on the canvas.
 * @property label Pre-formatted value string displayed in the crosshair label bubble.
 */
data class CrosshairState(
    val x: Float,
    val y: Float,
    val label: String,
)

/**
 * Manages the crosshair's visible state across recompositions.
 *
 * Holds the current [CrosshairState] as observable Compose state so that the canvas
 * redraws automatically whenever the crosshair moves. Call [update] on each drag event
 * and [dismiss] when the finger lifts. Use [rememberCrosshairManager] to create an instance.
 *
 * @param T The chart's data/point type, exposed via [selectedItem] so callers can render a
 *   custom composable crosshair label.
 */
class CrosshairManager<T> {
    /**
     * The current crosshair position and label, or `null` when the crosshair is not visible.
     */
    var state: CrosshairState? by mutableStateOf(null)
        private set

    /**
     * The data item the crosshair is currently snapped to, or `null` when not visible.
     * Used by custom composable crosshair overlays.
     */
    var selectedItem: T? by mutableStateOf(null)
        private set

    /**
     * Updates the crosshair to [newState]. Pass `null` to hide the crosshair.
     *
     * @param newState The new crosshair position and label, or `null` to dismiss.
     * @param item The data item the crosshair snapped to, or `null` to clear it.
     */
    fun update(
        newState: CrosshairState?,
        item: T? = null,
    ) {
        state = newState
        selectedItem = item
    }

    /**
     * Hides the crosshair by clearing [state] and [selectedItem].
     */
    fun dismiss() = update(newState = null, item = null)

    /**
     * Returns `true` when the crosshair is currently visible.
     */
    fun isVisible(): Boolean = state != null
}

/**
 * Creates and remembers a [CrosshairManager] instance that survives recomposition.
 */
@Composable
fun <T> rememberCrosshairManager(): CrosshairManager<T> = remember { CrosshairManager() }

/**
 * A position-smoothed crosshair whose animated `x`/`y` are held as [State] rather than read eagerly.
 *
 * Call [resolve] from inside a `DrawScope` block to read the current animated position; because the
 * read then happens in the draw phase, a crosshair drag invalidates draw only and does not recompose
 * the host chart every frame.
 */
@Immutable
internal class AnimatedCrosshair(
    private val animatedX: State<Float>,
    private val animatedY: State<Float>,
    private val label: String,
) {
    fun resolve(): CrosshairState = CrosshairState(x = animatedX.value, y = animatedY.value, label = label)
}

/**
 * Bundles the standard crosshair setup used by every crosshair-capable chart: a nullable
 * [CrosshairManager] (present only when [enabled]) and the position-smoothed [AnimatedCrosshair]
 * derived from it via [rememberAnimatedCrosshairState].
 *
 * ```kotlin
 * val (crosshairManager, animatedCrosshairState) =
 *     rememberChartCrosshair<LineData>(lineConfig.crosshairConfig != null)
 * ```
 *
 * When the chart is inside a [CrosshairSyncScope] and [viewPortState] is supplied, the manager is
 * also enrolled in the synced group: its own gesture is published to the group and, while another
 * chart owns the gesture, it mirrors the shared position.
 *
 * @param enabled Whether the crosshair is configured for this chart (typically
 *   `config.crosshairConfig != null`). When `false`, both returned values are `null`.
 * @param viewPortState The chart's viewport state, used as the source of plot pixel geometry when
 *   syncing across charts.
 * @param streamingState The chart's streaming state, used as the geometry source when the chart has
 *   a rolling window rather than a viewport. Syncing needs one of the two; with neither, this chart
 *   keeps its crosshair to itself. While the crosshair is enabled it also claims the chart's drag
 *   from that state, which makes streaming scrollback unavailable for as long as this chart lives.
 * @return A [Pair] of `(manager, animatedCrosshair)`.
 */
@Composable
internal fun <T> rememberChartCrosshair(
    enabled: Boolean,
    viewPortState: ViewPortState? = null,
    streamingState: StreamingState? = null,
): Pair<CrosshairManager<T>?, AnimatedCrosshair?> {
    val manager =
        if (enabled) {
            rememberCrosshairManager<T>()
        } else {
            null
        }
    if (manager != null && streamingState != null) {
        DisposableEffect(streamingState) {
            streamingState.crosshairOwnsDrag = true
            onDispose { streamingState.crosshairOwnsDrag = false }
        }
    }
    val sync = LocalCrosshairSync.current
    val ownerId = currentCompositeKeyHashCode.toString()
    val bounds: PlotBoundsSource? = viewPortState ?: streamingState
    if (manager != null && sync != null && bounds != null) {
        CrosshairSyncParticipantEffects(
            sync = sync,
            ownerId = ownerId,
            manager = manager,
            bounds = bounds,
        )
    }
    val animated = rememberAnimatedCrosshairState(manager?.state)
    return manager to animated
}

/**
 * Returns an [AnimatedCrosshair] whose `x`/`y` springs toward [state]'s position, so the crosshair
 * glides between data points during a drag instead of snapping instantly. The animated values are
 * held as [State] and read lazily via [AnimatedCrosshair.resolve]. Returns `null` when [state] is
 * `null`, which also resets the internal animations so the next appearance starts at its target.
 *
 * @param state The target crosshair state to follow, or `null` when the crosshair is hidden.
 * @param animationSpec The spring used to drive the positional motion.
 */
@Composable
internal fun rememberAnimatedCrosshairState(
    state: CrosshairState?,
    animationSpec: AnimationSpec<Float> = spring(stiffness = Spring.StiffnessMediumLow),
): AnimatedCrosshair? {
    state ?: return null
    val animatedX = animateFloatAsState(targetValue = state.x, animationSpec = animationSpec)
    val animatedY = animateFloatAsState(targetValue = state.y, animationSpec = animationSpec)
    return AnimatedCrosshair(animatedX = animatedX, animatedY = animatedY, label = state.label)
}

/**
 * Convenience over [rememberChartCrosshair] that takes the geometry sources straight from
 * [interactionConfig], so a chart enrols in a [CrosshairSyncScope] whether it pans a viewport or
 * rolls a streaming window.
 *
 * @param enabled Whether the crosshair is configured for this chart.
 * @param interactionConfig The chart's interaction config, supplying the viewport or streaming state.
 * @return A [Pair] of `(manager, animatedCrosshair)`.
 */
@Composable
internal fun <T> rememberChartCrosshair(
    enabled: Boolean,
    interactionConfig: ChartInteractionConfig,
): Pair<CrosshairManager<T>?, AnimatedCrosshair?> =
    rememberChartCrosshair(
        enabled = enabled,
        viewPortState = interactionConfig.viewPortState,
        streamingState = interactionConfig.streamingState,
    )

```

### Core Architecture Module: `charty/src/commonMain/kotlin/com/himanshoe/charty/common/gesture/GestureUtils.kt`
```
package com.himanshoe.charty.common.gesture

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.util.fastFirstOrNull
import androidx.compose.ui.util.fastMinByOrNull
import com.himanshoe.charty.common.ChartOrientation
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * Calculates the Euclidean distance between two points.
 *
 * @param point1 The first point.
 * @param point2 The second point.
 * @return The distance between the two points.
 */
fun calculateDistance(
    point1: Offset,
    point2: Offset,
): Float {
    val dx = point1.x - point2.x
    val dy = point1.y - point2.y
    return sqrt(dx * dx + dy * dy)
}

/**
 * Returns the shortest distance from [offset] to the edge of this rectangle, or `0` when the
 * offset falls inside the rectangle. Used to apply a forgiving hit-slop around bar hit areas.
 */
private fun Rect.distanceTo(offset: Offset): Float {
    val dx =
        when {
            offset.x < left -> left - offset.x
            offset.x > right -> offset.x - right
            else -> 0f
        }
    val dy =
        when {
            offset.y < top -> top - offset.y
            offset.y > bottom -> offset.y - bottom
            else -> 0f
        }
    return sqrt(dx * dx + dy * dy)
}

/**
 * Finds the data associated with a clicked item from a list of bounds.
 *
 * @param T The type of the data associated with each bound.
 * @param offset The position of the tap.
 * @param bounds A list of pairs, where each pair contains the [Rect] bounds and its associated data.
 * @return The data associated with the clicked bounds, or `null` if no bounds contain the tap offset.
 */
fun <T> findClickedItem(
    offset: Offset,
    bounds: List<Pair<Rect, T>>,
): T? = bounds.fastFirstOrNull { (rect, _) -> rect.contains(offset) }?.second

/**
 * Finds the clicked item along with its bounds from a list of bounds.
 *
 * @param T The type of the data associated with each bound.
 * A tap that lands inside a bound is always matched. If none contains the tap and [hitSlop] is
 * positive, the nearest bound within [hitSlop] pixels of the tap is returned instead, so taps that
 * narrowly miss a thin bar still register.
 *
 * @param offset The position of the tap.
 * @param bounds A list of pairs, where each pair contains the [Rect] bounds and its associated data.
 * @param hitSlop Extra tolerance in pixels around each bound; `0` requires an exact hit.
 * @return A [Pair] containing the bounds and data of the clicked item, or `null` if no bounds are within range.
 */
fun <T> findClickedItemWithBounds(
    offset: Offset,
    bounds: List<Pair<Rect, T>>,
    hitSlop: Float = 0f,
): Pair<Rect, T>? {
    val exactHit = bounds.fastFirstOrNull { (rect, _) -> rect.contains(offset) }
    return exactHit ?: bounds
        .takeIf { hitSlop > 0f }
        ?.fastMinByOrNull { (rect, _) -> rect.distanceTo(offset) }
        ?.takeIf { (rect, _) -> rect.distanceTo(offset) <= hitSlop }
}

/**
 * Finds the nearest point to a given offset within a specified radius.
 *
 * @param T The type of the data associated with each point.
 * @param offset The position of the tap.
 * @param pointBounds A list of pairs, where each pair contains the [Offset] position of a point and its associated data.
 * @param tapRadius The maximum radius around a point to be considered a tap.
 * @return A [Pair] containing the position and data of the nearest point if it's within the tap radius, otherwise `null`.
 */
fun <T> findNearestPoint(
    offset: Offset,
    pointBounds: List<Pair<Offset, T>>,
    tapRadius: Float,
): Pair<Offset, T>? =
    pointBounds
        .fastMinByOrNull { (position, _) -> calculateDistance(position, offset) }
        ?.takeIf { (position, _) -> calculateDistance(position, offset) <= tapRadius }

/**
 * Finds the point whose x-coordinate is closest to [xOffset], ignoring the y-axis distance.
 *
 * This is used by the crosshair handler to snap to the nearest data point as the user drags
 * horizontally across the chart.
 *
 * @param T The type of data associated with each point.
 * @param xOffset The x position of the touch/drag event.
 * @param pointBounds A list of pairs, where each pair contains the [Offset] position of a point
 *   and its associated data.
 * @return The nearest point pair, or `null` if [pointBounds] is empty.
 */
fun <T> findNearestPointByX(
    xOffset: Float,
    pointBounds: List<Pair<Offset, T>>,
): Pair<Offset, T>? = pointBounds.fastMinByOrNull { (position, _) -> abs(position.x - xOffset) }

/**
 * Finds the point whose y-coordinate is closest to [yOffset], ignoring the x-axis distance.
 *
 * This is the horizontal-chart counterpart of [findNearestPointByX]: charts whose categories run
 * down the plot (such as [com.himanshoe.charty.bar.HorizontalBarChart]) snap the crosshair as the
 * user drags vertically across the rows.
 *
 * @param T The type of data associated with each point.
 * @param yOffset The y position of the touch/drag event.
 * @param pointBounds A list of pairs, where each pair contains the [Offset] position of a point
 *   and its associated data.
 * @return The nearest point pair, or `null` if [pointBounds] is empty.
 */
fun <T> findNearestPointByY(
    yOffset: Float,
    pointBounds: List<Pair<Offset, T>>,
): Pair<Offset, T>? = pointBounds.fastMinByOrNull { (position, _) -> abs(position.y - yOffset) }

/**
 * Finds the point nearest to [position] along the chart's category axis: by x for a
 * [ChartOrientation.VERTICAL] chart and by y for a [ChartOrientation.HORIZONTAL] one.
 *
 * @param T The type of data associated with each point.
 * @param position The current touch/drag position.
 * @param pointBounds Pairs of point positions and their associated data.
 * @param orientation The chart's orientation, which decides the axis snapping runs along.
 * @return The nearest point pair, or `null` if [pointBounds] is empty.
 */
fun <T> findNearestPointAlongCategoryAxis(
    position: Offset,
    pointBounds: List<Pair<Offset, T>>,
    orientation: ChartOrientation,
): Pair<Offset, T>? =
    when (orientation) {
        ChartOrientation.VERTICAL -> findNearestPointByX(xOffset = position.x, pointBounds = pointBounds)
        ChartOrientation.HORIZONTAL -> findNearestPointByY(yOffset = position.y, pointBounds = pointBounds)
    }

/**
 * Finds the rectangular item under a drag [position], used by the drag-to-track tooltip gesture.
 *
 * Preference order:
 * 1. A bound that geometrically contains [position] (handles stacked segments — the finger's
 *    y-coordinate disambiguates which segment in a column is selected).
 * 2. A bound whose horizontal span contains `position.x` (the column under the finger when the
 *    finger is above or below the bars).
 * 3. The bound whose horizontal centre is nearest to `position.x` (snaps across gaps).
 *
 * @param T The data associated with each bound.
 * @param position The current drag position.
 * @param bounds Pairs of [Rect] bounds and their associated data.
 * @return The matched bound and data, or `null` when [bounds] is empty.
 */
fun <T> findItemByX(
    position: Offset,
    bounds: List<Pair<Rect, T>>,
): Pair<Rect, T>? {
    val inColumn =
        bounds.fastFirstOrNull { (rect, _) -> rect.contains(position) }
            ?: bounds.fastFirstOrNull { (rect, _) -> position.x >= rect.left && position.x <= rect.right }
    return inColumn ?: bounds.fastMinByOrNull { (rect, _) -> abs(rect.center.x - position.x) }
}

```

### Core Architecture Module: `charty/src/commonMain/kotlin/com/himanshoe/charty/common/streaming/StreamingState.kt`
```
package com.himanshoe.charty.common.streaming

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationVector1D
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.himanshoe.charty.common.PlotBoundsSource
import com.himanshoe.charty.common.animation.isAnimated
import com.himanshoe.charty.common.animation.toFloatSpec
import com.himanshoe.charty.common.config.Animation
import kotlin.math.roundToInt

/**
 * Follow-or-browse state for a chart with a rolling `visibleWindow`.
 *
 * A streaming chart is normally **following**: the window stays pinned to the newest point and
 * advances as data arrives. Dragging the plot backwards **detaches** it, and from that moment the
 * window holds the points the reader is looking at — new data keeps accumulating off-screen instead
 * of yanking the view to the end. [pendingCount] counts what arrived while detached, which is what a
 * "jump to latest" affordance shows, and [jumpToLatest] animates back to the newest point and
 * resumes following.
 *
 * Create one with [rememberStreamingState] and hand it to a chart through
 * [com.himanshoe.charty.common.config.ChartInteractionConfig]. Without one, a chart configured with
 * `visibleWindow` simply always follows, which is the behaviour of a chart that has no scrollback.
 *
 * The scroll position is expressed in data indices — `0` shows the very first point at the plot's
 * leading edge, and [maxScroll] shows the newest — so it is independent of pixel size and survives
 * a resize.
 *
 * Scrollback and a crosshair cannot share a chart: both are drag gestures, and the crosshair wins.
 * A chart configured with a crosshair keeps its window following the newest data, and a "jump to
 * latest" control never appears because the window never detaches by dragging. Tap-to-tooltip is
 * unaffected either way.
 */
@Stable
class StreamingState internal constructor() : PlotBoundsSource {
    private var plotLeftState by mutableFloatStateOf(0f)
    private var plotWidthState by mutableFloatStateOf(0f)

    override val plotLeft: Float get() = plotLeftState
    override val plotWidth: Float get() = plotWidthState

    internal fun updatePlotBounds(
        left: Float,
        width: Float,
    ) {
        plotLeftState = left
        plotWidthState = width
    }

    internal val scroll: Animatable<Float, AnimationVector1D> = Animatable(0f)

    internal var crosshairOwnsDrag: Boolean = false

    private var followingState by mutableStateOf(true)
    private var pendingState by mutableIntStateOf(0)
    private var maxScrollState by mutableFloatStateOf(0f)

    /**
     * Whether the window is pinned to the newest point. `true` initially; dragging backwards clears
     * it and [jumpToLatest] restores it.
     */
    val isFollowing: Boolean get() = followingState

    /**
     * How many points have arrived since the window detached, or `0` while following. Use it to
     * label a "jump to latest" control.
     */
    val pendingCount: Int get() = pendingState

    /** The scroll position that shows the newest point, i.e. `dataSize - windowSize`. */
    val maxScroll: Float get() = maxScrollState

    /** The scroll position currently rendered, in data indices. */
    val currentScroll: Float get() = scroll.value

    /**
     * Detaches the window so it stops following new data. Called by the drag gesture; call it
     * directly to detach programmatically, for example when your own control takes over.
     */
    fun detach() {
        followingState = false
    }

    /**
     * Animates the window back to the newest point with [animation] and resumes following, clearing
     * [pendingCount]. A disabled [animation] jumps immediately.
     *
     * Resuming following is what makes the chart re-drive this animation itself, which matters
     * because the overlay that triggered the jump usually disappears the moment following resumes —
     * taking its coroutine scope, and this call, with it. The chart finishes the slide regardless.
     */
    suspend fun jumpToLatest(animation: Animation = Animation.Default) {
        followingState = true
        pendingState = 0
        if (animation.isAnimated) {
            scroll.animateTo(targetValue = maxScrollState, animationSpec = animation.toFloatSpec())
        } else {
            scroll.snapTo(maxScrollState)
        }
    }

    /**
     * Eases the window to the nearest whole data index, so a drag always comes to rest on aligned
     * slots instead of leaving the leading and trailing items sliced in half by the plot edges.
     *
     * Called when a drag ends. While following, the window is already heading for a whole index, so
     * this does nothing and leaves the follow animation undisturbed.
     */
    internal suspend fun settleToNearestIndex(animation: Animation) {
        if (followingState) {
            return
        }
        val nearest =
            scroll.value
                .roundToInt()
                .toFloat()
                .coerceIn(minimumValue = 0f, maximumValue = maxScrollState)
        if (nearest == scroll.value) {
            return
        }
        if (animation.isAnimated) {
            scroll.animateTo(targetValue = nearest, animationSpec = animation.toFloatSpec())
        } else {
            scroll.snapTo(nearest)
        }
    }

    /**
     * Eases the window to the newest point when following has resumed but the scroll has not caught
     * up yet, which happens when the caller's jump was cancelled with its overlay.
     */
    internal suspend fun settleToLatest(animation: Animation) {
        if (!followingState || scroll.value == maxScrollState) {
            return
        }
        if (animation.isAnimated) {
            scroll.animateTo(targetValue = maxScrollState, animationSpec = animation.toFloatSpec())
        } else {
            scroll.snapTo(maxScrollState)
        }
    }

    /**
     * Moves the window by [delta] data indices, detaching it, and clamps the result into
     * `0..maxScroll` so a drag can never scroll past either end of the data.
     */
    internal suspend fun scrollBy(delta: Float) {
        detach()
        scroll.snapTo((scroll.value + delta).coerceIn(minimumValue = 0f, maximumValue = maxScrollState))
    }

    /**
     * Records the newest reachable scroll position and, when the data grew, either follows it or
     * counts the arrivals as pending.
     */
    internal suspend fun onDataChanged(
        newMaxScroll: Float,
        appended: Int,
        animation: Animation,
    ) {
        val previousMax = maxScrollState
        maxScrollState = newMaxScroll
        if (followingState) {
            if (animation.isAnimated) {
                scroll.animateTo(targetValue = newMaxScroll, animationSpec = animation.toFloatSpec())
            } else {
                scroll.snapTo(newMaxScroll)
            }
        } else if (appended > 0 && newMaxScroll > previousMax) {
            pendingState += appended
            scroll.snapTo(scroll.value.coerceIn(minimumValue = 0f, maximumValue = newMaxScroll))
        }
    }
}

/**
 * Creates and remembers a [StreamingState] for a chart with a rolling `visibleWindow`, so the reader
 * can scroll back through history while new data keeps accumulating.
 *
 * ```kotlin
 * val streaming = rememberStreamingState()
 * LineChart(
 *     data = { points },
 *     lineConfig = LineChartConfig(visibleWindow = 20),
 *     interactionConfig = ChartInteractionConfig(streamingState = streaming),
 * )
 * ```
 */
@Composable
fun rememberStreamingState(): StreamingState = remember { StreamingState() }

```

### Core Architecture Module: `charty/src/commonMain/kotlin/com/himanshoe/charty/common/util/ChartLabelFormat.kt`
```
package com.himanshoe.charty.common.util

import kotlin.math.abs
import kotlin.math.roundToLong

private const val DECIMAL_SCALE = 10f
private const val WHOLE_NUMBER_EPSILON = 0.0001f

/**
 * Formats a chart value the way a reader expects to see it rather than the way a `Float` prints.
 *
 * A whole number loses its decimal part entirely, and anything else is rounded to a single decimal
 * place. Without this, a value produced by arithmetic renders its full binary expansion — a label
 * reading `37.86205291748047` instead of `37.9`, wide enough to overflow the plot it sits in.
 *
 * Charts that need a different precision, a unit or a currency should pass their own formatter
 * through the relevant config instead of relying on this default.
 */
fun Float.toChartLabel(): String {
    val rounded = (this * DECIMAL_SCALE).roundToLong() / DECIMAL_SCALE
    return if (abs(rounded - rounded.toLong()) < WHOLE_NUMBER_EPSILON) {
        rounded.toLong().toString()
    } else {
        rounded.toString()
    }
}

```

### Core Architecture Module: `charty/src/commonMain/kotlin/com/himanshoe/charty/common/util/ValueCalculations.kt`
```
package com.himanshoe.charty.common.util

import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.pow

/**
 * Common utilities for calculating min/max values with nice rounding
 * for chart axis scaling.
 */

private const val NICE_STEP_UPPER_1 = 1.5f
private const val NICE_STEP_UPPER_2 = 3.5f
private const val NICE_STEP_UPPER_5 = 7.5f
private const val NICE_FACTOR_2 = 2f
private const val NICE_FACTOR_5 = 5f
private const val NICE_FACTOR_10 = 10f
private const val NICE_RANGE_ROUND_HALF = 0.5f

/**
 * Calculates an appropriate maximum value with "nice" rounding, suitable for a chart axis.
 *
 * This function rounds the maximum value in the list up to the nearest multiple of [stepSize].
 * An empty list has no maximum and yields `0f`.
 *
 * @param values The list of values from which to find the maximum.
 * @param stepSize The step size for rounding. Must be positive.
 * @return The rounded maximum value.
 * @throws IllegalArgumentException if [stepSize] is not positive, which would otherwise divide by
 *   zero and round to an arbitrary value.
 */
fun calculateMaxValue(
    values: List<Float>,
    stepSize: Int = 10,
): Float {
    require(stepSize > 0) { "stepSize must be positive but was $stepSize" }
    val maxData = values.maxOrNull() ?: 0f
    return ceil(maxData / stepSize).toInt() * stepSize.toFloat()
}

/**
 * Calculates an appropriate minimum value with "nice" rounding, suitable for a chart axis.
 *
 * This function rounds the minimum value in the list down to the nearest multiple of [stepSize].
 * An empty list has no minimum and yields `0f`.
 *
 * @param values The list of values from which to find the minimum.
 * @param stepSize The step size for rounding. Must be positive.
 * @return The rounded minimum value.
 * @throws IllegalArgumentException if [stepSize] is not positive, which would otherwise divide by
 *   zero and round to an arbitrary value.
 */
fun calculateMinValue(
    values: List<Float>,
    stepSize: Int = 10,
): Float {
    require(stepSize > 0) { "stepSize must be positive but was $stepSize" }
    val minData = values.minOrNull() ?: 0f
    return floor(minData / stepSize).toInt() * stepSize.toFloat()
}

/**
 * Calculates the minimum and maximum values with percentage-based padding.
 *
 * This is useful for charts like candlestick charts where padding is preferred over step-based rounding.
 *
 * The padding is always applied **outwards**, scaled by each bound's magnitude: the minimum moves
 * down by `|min| * paddingMultiplier` and the maximum up by `|max| * paddingMultiplier`. Scaling by
 * the signed bound instead would pull a negative minimum *up*, cropping the very extreme the padding
 * exists to reveal. An empty list yields `0f to 0f`.
 *
 * @param values The list of values from which to calculate the range.
 * @param paddingMultiplier The padding as a fraction (e.g., 0.05 for 5% padding).
 * @return A [Pair] containing the minimum and maximum values with padding applied.
 */
fun calculateMinMaxWithPadding(
    values: List<Float>,
    paddingMultiplier: Float = 0.05f,
): Pair<Float, Float> {
    val min = values.minOrNull() ?: 0f
    val max = values.maxOrNull() ?: 0f
    return (min - abs(min) * paddingMultiplier) to (max + abs(max) * paddingMultiplier)
}

/**
 * Calculates the minimum and maximum values from a list with step-based rounding.
 *
 * @param values The list of values.
 * @param stepSize The step size for rounding.
 * @return A [Pair] containing the minimum and maximum values with "nice" rounding.
 */
fun calculateMinMaxValue(
    values: List<Float>,
    stepSize: Int = 10,
): Pair<Float, Float> =
    calculateMinValue(values = values, stepSize = stepSize) to
        calculateMaxValue(values = values, stepSize = stepSize)

/**
 * Computes the `(min, max)` value range for a chart whose bars grow from a zero baseline.
 *
 * Applies the shared rule used by the bar-family charts: the maximum is "nice"-rounded via
 * [calculateMaxValue], and the minimum is clamped to `0f` unless the data actually goes negative
 * (in which case the "nice"-rounded [calculateMinValue] is used). Centralizing this keeps the
 * baseline behaviour identical across `BarChart`, `HorizontalBarChart`, `BubbleBarChart`,
 * `ComparisonBarChart`, and any future bar variant.
 *
 * @param values The flattened data values.
 * @return A [Pair] of `(min, max)` for the value axis.
 */
internal fun baselineValueRange(values: List<Float>): Pair<Float, Float> {
    val calculatedMin = calculateMinValue(values)
    val calculatedMax = calculateMaxValue(values)
    val finalMin =
        if (calculatedMin >= 0f) {
            0f
        } else {
            calculatedMin
        }
    return finalMin to calculatedMax
}

/**
 * Rounds a rough step value up to the nearest "nice" increment (1, 2, or 5 × 10ᵏ).
 * Produces human-readable axis tick intervals.
 */
internal fun niceAxisStep(roughStep: Float): Float {
    if (roughStep <= 0f) {
        return 1f
    }
    val exponent = floor(log10(roughStep)).toInt()
    val magnitude = NICE_FACTOR_10.pow(exponent)
    val normalized = roughStep / magnitude
    val niceFraction =
        when {
            normalized <= NICE_STEP_UPPER_1 -> 1f
            normalized <= NICE_STEP_UPPER_2 -> NICE_FACTOR_2
            normalized <= NICE_STEP_UPPER_5 -> NICE_FACTOR_5
            else -> NICE_FACTOR_10
        }
    return niceFraction * magnitude
}

/**
 * Computes a "nice" axis range guaranteed to include zero as a tick whenever the range
 * spans both negative and positive values.
 *
 * Uses a D3-style algorithm: the rough step is rounded to the nearest 1/2/5 × 10ᵏ, then the
 * domain is expanded to the nearest multiples of that step. Because [niceMin] and [niceMax]
 * are both multiples of the step, zero (also a multiple of any positive step) is always a tick.
 *
 * @param rawMin Minimum data value (already clamped/adjusted where needed).
 * @param rawMax Maximum data value.
 * @param targetSteps Approximate desired number of intervals between ticks.
 * @return Triple(niceMin, niceMax, actualSteps).
 */
internal fun calculateNiceAxisRange(
    rawMin: Float,
    rawMax: Float,
    targetSteps: Int,
): Triple<Float, Float, Int> {
    require(targetSteps > 0)
    if (rawMin == rawMax) {
        val half =
            if (rawMin == 0f) {
                1f
            } else {
                abs(rawMin)
            }
        return Triple(rawMin - half, rawMax + half, 2)
    }
    val range = rawMax - rawMin
    val step = niceAxisStep(range / targetSteps)
    val niceMin = floor(rawMin / step) * step
    val niceMax = ceil(rawMax / step) * step
    val actualSteps = ((niceMax - niceMin) / step + NICE_RANGE_ROUND_HALF).toInt().coerceAtLeast(1)
    return Triple(niceMin, niceMax, actualSteps)
}

```

### Core Architecture Module: `charty/src/commonMain/kotlin/com/himanshoe/charty/common/viewport/ViewPortState.kt`
```
package com.himanshoe.charty.common.viewport

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.exponentialDecay
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import com.himanshoe.charty.common.PlotBoundsSource
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

private const val MIN_VISIBLE_FRACTION = 0.1f
private const val FLING_FRICTION = 1.5f
private const val EDGE_EPSILON = 0.001f
private const val SCROLL_ANIMATION_MILLIS = 600

/**
 * Tracks the currently visible data window for a zoomable/pannable chart.
 *
 * The viewport is expressed in normalised fractions `[0, 1]` over the full dataset:
 * `startFraction = 0f` and `endFraction = 1f` shows everything. Pinch-to-zoom narrows
 * the window around a focus point; drag pans it; releasing with velocity launches an
 * inertial fling that decelerates smoothly.
 *
 * The chart reads [visibleIndices] each frame to determine which data subset to render.
 *
 * Use [rememberViewPortState] to create an instance bound to the composition lifecycle.
 */
class ViewPortState(
    initialVisibleFraction: Float = 1f,
) : PlotBoundsSource {
    /** Where the visible window starts, as a fraction of the whole series. `0f` is the first point. */
    var startFraction by mutableFloatStateOf(0f)
        private set

    /** Where the visible window ends, as a fraction of the whole series. `1f` is the last point. */
    var endFraction by mutableFloatStateOf(initialVisibleFraction.coerceIn(MIN_VISIBLE_FRACTION, 1f))
        private set

    /** Pixel x-coordinate of the chart's left edge — set by ChartScaffold each draw. */
    override val plotLeft: Float get() = chartLeft

    override val plotWidth: Float get() = chartWidth

    internal var chartLeft by mutableFloatStateOf(0f)

    /** Pixel width of the chart drawing area — set by ChartScaffold each draw. */
    internal var chartWidth by mutableFloatStateOf(0f)

    /** Total number of data items — set by the chart before gesture handling. */
    internal var dataSize by mutableIntStateOf(0)

    private val decay = exponentialDecay<Float>(frictionMultiplier = FLING_FRICTION)
    private var flingJob: Job? = null
    private var coroutineScope: CoroutineScope? = null

    /**
     * The fraction of the dataset currently shown, equal to `endFraction - startFraction`.
     * A value of `1f` means the full dataset is visible; `0.5f` means half is visible.
     */
    val visibleFraction: Float get() = endFraction - startFraction

    /**
     * Returns the range of data indices currently visible in the viewport.
     *
     * The result is clamped to `[0, totalItems)` and is non-empty for any non-empty dataset; a
     * [totalItems] of `0` has no indices to return and yields an empty range.
     *
     * @param totalItems The total number of items in the full dataset.
     * @return An [IntRange] of indices whose data should be rendered.
     */
    fun visibleIndices(totalItems: Int): IntRange {
        val start = (startFraction * totalItems).toInt().coerceAtLeast(0)
        val end = (endFraction * totalItems).toInt().coerceAtMost(totalItems)
        return start until end.coerceAtLeast(start + 1).coerceAtMost(totalItems)
    }

    /**
     * Applies a zoom gesture centred on [focusFraction].
     *
     * @param focusFraction The focal point of the zoom expressed as a fraction of the chart
     *   width, where `0f` is the left edge and `1f` is the right edge.
     * @param scaleFactor Multiplicative zoom factor. Values greater than `1f` zoom in;
     *   values less than `1f` zoom out. The minimum visible window is capped at 10 % of
     *   the dataset to prevent over-zooming.
     */
    internal fun zoom(
        focusFraction: Float,
        scaleFactor: Float,
    ) {
        val newWidth = (visibleFraction / scaleFactor).coerceIn(MIN_VISIBLE_FRACTION, 1f)
        val focusAbsolute = startFraction + focusFraction * visibleFraction
        val newStart = (focusAbsolute - focusFraction * newWidth).coerceIn(0f, 1f - newWidth)
        startFraction = newStart
        endFraction = newStart + newWidth
    }

    /**
     * Applies a pan gesture by shifting the viewport window.
     *
     * @param deltaFraction The amount to shift, expressed as a fraction of the full dataset
     *   width. Positive values pan right (towards later data); negative values pan left.
     *   The window is clamped so it never extends beyond the dataset boundaries.
     */
    internal fun pan(deltaFraction: Float) {
        val width = visibleFraction
        val newStart = (startFraction + deltaFraction).coerceIn(0f, 1f - width)
        startFraction = newStart
        endFraction = newStart + width
    }

    /**
     * Launches an inertial fling that continues panning after a drag gesture ends.
     *
     * The fling decelerates using exponential decay with a friction multiplier of
     * [FLING_FRICTION]. Calling this while a fling is already running replaces it.
     *
     * @param initialVelocityX Pixel-per-second velocity along the x-axis at gesture release.
     *   Negative values fling towards later data; positive values fling towards earlier data.
     */
    internal fun fling(initialVelocityX: Float) {
        flingJob?.cancel()
        val scope = coroutineScope ?: return
        val cw = chartWidth.coerceAtLeast(1f)
        flingJob =
            scope.launch {
                var prevValue = 0f
                Animatable(0f).animateDecay(
                    initialVelocity = initialVelocityX,
                    animationSpec = decay,
                ) {
                    val delta = value - prevValue
                    prevValue = value
                    pan(delta / cw * visibleFraction)
                }
            }
    }

    /**
     * Cancels any in-progress fling animation immediately. Call this at the start of a new
     * gesture so the fling does not fight the user's input.
     */
    internal fun cancelFling() {
        flingJob?.cancel()
        flingJob = null
    }

    /**
     * `true` when the window's left edge is at the start of the dataset (there is no earlier data
     * scrolled off to the left).
     */
    val isAtStart: Boolean get() = startFraction <= EDGE_EPSILON

    /**
     * `true` when the window's right edge is at the end of the dataset (there is no later data
     * scrolled off to the right).
     */
    val isAtEnd: Boolean get() = endFraction >= 1f - EDGE_EPSILON

    /**
     * Moves the window to the end of the dataset, keeping the current [visibleFraction], so the most
     * recent data becomes visible. No-op effect when already showing the full dataset.
     */
    fun scrollToEnd() {
        cancelFling()
        val width = visibleFraction
        startFraction = (1f - width).coerceAtLeast(0f)
        endFraction = 1f
    }

    /**
     * Like [scrollToEnd] but glides the window to the end with a smooth tween instead of jumping.
     * Falls back to an instant [scrollToEnd] if no coroutine scope is bound yet.
     */
    fun animateScrollToEnd() {
        cancelFling()
        val width = visibleFraction
        val targetStart = (1f - width).coerceAtLeast(0f)
        val scope = coroutineScope
        if (scope == null) {
            scrollToEnd()
            return
        }
        flingJob =
            scope.launch {
                Animatable(startFraction).animateTo(
                    targetValue = targetStart,
                    animationSpec = tween(durationMillis = SCROLL_ANIMATION_MILLIS),
                ) {
                    startFraction = value
                    endFraction = (value + width).coerceAtMost(1f)
                }
            }
    }

    /**
     * Resets the viewport to show the full dataset by setting [startFraction] to `0f`
     * and [endFraction] to `1f`.
     */
    fun reset() {
        cancelFling()
        startFraction = 0f
        endFraction = 1f
    }

    internal fun bindCoroutineScope(scope: CoroutineScope) {
        coroutineScope = scope
    }
}

/**
 * Creates and remembers a [ViewPortState] instance bound to the current composition.
 *
 * Pass the returned state to a chart's `viewPortState` parameter inside
 * [com.himanshoe.charty.common.config.ChartInteractionConfig] to enable pinch-to-zoom,
 * wheel-zoom, drag-to-pan, and inertial fling. Call [ViewPortState.reset] to restore the
 * full-data view at any time.
 *
 * @param initialVisibleFraction How much of the series to show at first, as a fraction of the whole.
 *   The default of `1f` shows everything, and a chart showing everything cannot be panned — there is
 *   nothing off-screen to pan to — so a series of two hundred points opens as two hundred slivers
 *   and stays that way until someone thinks to pinch it. Opening at `0.1f` shows the first tenth and
 *   is draggable immediately, which is what a long series usually wants.
 */
@Composable
fun rememberViewPortState(initialVisibleFraction: Float = 1f): ViewPortState {
    val scope = rememberCoroutineScope()
    return remember(initialVisibleFraction) {
        ViewPortState(initialVisibleFraction = initialVisibleFraction)
    }.also { state -> state.bindCoroutineScope(scope) }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #144** (2025-05-01): **Chart with 0 values**
  *Symptoms*: Hi,  While plotting a chart, if all values happen to be 0, the chart crashes.  Is this the expected behavior or am I doing something wrong?
  **Post-Mortem & Fix Analysis**:
  > Which chart are we talking about?
  > For example:  Suppose we draw a chart with mockdata.  BarData(             yValue = Random.nextFloat() * 20 + number, // Random value between -10 and 10             xValue = years[it % years.size],             barColor = if (useColor) colors[it % colors.size].asSolidChartColor() else Color.Unspecified.asSolidChartColor()         )  now if all the 'yValue' ( yValue = 0.0f) are zero,  the app crashes. 
  > Do we have a timeline on when this bug is fixed? I also ran into the issue and there doesn't seem to be a way around it

- **Issue #57** (2025-02-03): **IllegalArgumentException with CurveLineChart**
  *Symptoms*: I am using `CurveLineChart` to display some data.  Here is the code that displays the chart  ```kt CurveLineChart(     modifier = Modifier         .fillMaxWidth()         .padding(vertical = 10.dp),     lineData = lineData,     chartColors = listOf(         MaterialTheme.colors.secondary,         MaterialTheme.colors.secondary     ),     lineColors = listOf(         MaterialTheme.colors.primary,         MaterialTheme.colors.primary     ) ) // Where lineData is // [LineData(xValue=Oct 27, 2022, yValue=0.0), LineData(xValue=Oct 28, 2022, yValue=0.0), ......] // the other values have yValue equals to 0  ```  When I run the app, I have the following stacktrace  ``` E/AndroidRuntime: FATAL EXCEPTION: main     Process: com.ola.myapp, PID: 7867     java.lang.IllegalArgumentException         at android.graphics.LinearGradient.nativeCreate(Native Method)         at android.graphics.LinearGradient.createNativeInstance(LinearGradient.java:158)         at android.graphics.Shader.getNativeInstance(Shader.java:191)         at android.graphics.Paint.getNativeInstance(Paint.java:726)         at android.graphics.BaseRecordingCanvas.drawPath(BaseRecordingCanvas.java:292)         at androidx.compose.ui.graphics.AndroidCanvas.drawPath(AndroidCanvas.android.kt:242)         at androidx.compose.ui.graphics.drawscope.CanvasDrawScope.drawPath-GBMwjPU(CanvasDrawScope.kt:473)         at androidx.compose.ui.node.LayoutNodeDrawScope.drawPath-GBMwjPU(Unknown Source:26
  **Post-Mortem & Fix Analysis**:
  > Hey thanks for letting me know will check!
  > I have done some tests and i have noticed that this error appears when all the values are 0
  > @Ola-jed  This is part of my data and this bug happens:  Edit:  The strings are empty and thats why it happens. ![image](https://github.com/hi-manshu/Charty/assets/139352271/13e5ca6c-500d-45b4-aa97-3de4f6b98d69)   Though it still happens when I set : ``` chartColors = CurvedLineChartColors(                         backgroundColors = if(marketCapChange.value > 0) listOf(Color(0xFF218842), Color(0xFF218842)) else listOf(Color(0xffFCEEEE), Color(0xffFCEEEE))                     ) ```

- **Issue #46** (2025-02-03): **Line drawn out of bounds on dataset update**
  *Symptoms*: Using a `LineChart`, when the dataset is updated with a large value, the recomposition results in a line being drawn out of bounds.  ```kotlin LineChart(             lineData = pagesReadData,             color = MaterialTheme.colors.primaryVariant,             modifier = modifier                 .height(250.dp)                 .fillMaxWidth()                 .padding(32.dp),             axisConfig = AxisConfig(                 showAxis = true,                 isAxisDashed = false,                 showUnitLabels = true,                 showXLabels = true,                 xAxisColor = MaterialTheme.colors.onSurface,                 yAxisColor = MaterialTheme.colors.onSurface,             )         ) ```  Resultant: ![Screenshot_20220923_195016](https://user-images.githubusercontent.com/22092047/191983372-07aca0d4-6de4-4f23-beec-d29120786bff.png)  ScreenCap: [Out of bounds.webm](https://user-images.githubusercontent.com/22092047/191982743-8d0b69c1-e923-435e-a302-c105b22d070b.webm)   Please let me know if any other data is needed.  
  **Post-Mortem & Fix Analysis**:
  > Hey buddy, thank you for this. Can you pass your dataset for me to replicate!  thanks
  > Initial Data: ``` LineData(xValue=23 Sep , yValue=10.0) LineData(xValue=24 Sep , yValue=10.0) ```  Updated Data: ``` LineData(xValue=23 Sep , yValue=10.0) LineData(xValue=24 Sep , yValue=10.0) LineData(xValue=26 Sep , yValue=20.0) ```  Result: ![image](https://user-images.githubusercontent.com/22092047/192212763-685f8d7a-6425-49c9-8189-70cf5d92e498.png)
  > Thank you, will check soon!

- **Issue #45** (2022-10-04): **Labels not visible on dark mode**
  *Symptoms*: Using a `LineChart`, the x and y-axis labels aren't legible on dark mode since they are in black color. The axis config colors aren't applied to them.  ```kotlin LineChart(             lineData = minutesReadData,             color = MaterialTheme.colors.primaryVariant,             modifier = modifier                 .height(250.dp)                 .fillMaxWidth()                 .padding(vertical = 32.dp, horizontal = 32.dp),             axisConfig = AxisConfig(                 showAxis = true,                 isAxisDashed = false,                 showUnitLabels = true,                 showXLabels = true,                 xAxisColor = Color.White,                 yAxisColor = Color.White,             ),         ) ```  On Light Mode: ![image](https://user-images.githubusercontent.com/22092047/191969746-97fc3905-fb3f-40ab-af90-0b94dea88cf9.png)  On Dark Mode: ![image](https://user-images.githubusercontent.com/22092047/191969872-38f03878-060c-44f8-b19f-e46a00a51aa5.png)
  **Post-Mortem & Fix Analysis**:
  > Hey this is something I have planned for future releases but right now I am focusing more on making this library stable.. but will keep this in mind!
  > Late addition:  As a workaround, I forked the lib and obtained the `onSurface` color in the `LineChart` composable: ```kotlin val labelColor = MaterialTheme.colors.onSurface yAxis(... labelColor = labelColor) ```  Then, added a color param to `DrawScope.yAxis` and `DrawScope.drawXLabel` which is then consumed during paint object init: ```kotlin fun draw...(..., labelColor: Color = Color.Black) {     // ...     Paint().apply {         // ...         color = labelColor.toArgb()     } } ```  Now, ![image](https://user-images.githubusercontent.com/22092047/193568970-4a5f727f-6ba9-4543-a94f-a992ef28777d.png) ![image](https://user-images.githubusercontent.com/22092047/193569001-95d9b89d-1229-4d8f-951a-1ddc456b901c.png)
  > Hey, I have these fixed, Will be putting a new release soon!

- **Issue #34** (2022-09-07): **Fix. Chart Padding**
  *Symptoms*: - Fixed Padding for Pie - https://github.com/hi-manshu/Charty/issues/32

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

### Incident Patch 1: `c7ba0b05` (2026-08-31)
**Commit Message**: [Fix] Implement scaleToFit: the radar shrinks so its text stays on the canvas

The flag shipped documented as "shrinks the radar so labels stay inside the bounds",
defaulted to true, and was read by nothing — labels near the edge just clipped. It is
the fourth and last of the dead flags the post-#179 sweep found.

Each label is a box hung off its anchor at radius * labelDistanceMultiplier along the
axis angle, so its position is linear in the radius, and "stay inside the canvas" is one
linear inequality per canvas edge. The solver takes the smallest solution across every
box, capped at the padding-derived radius — fitting only ever shrinks, so a chart whose
labels already fit renders byte-for-byte as before, which is what keeps all 35 doc
images unchanged in this commit. A 40% floor stops a pathological label from shrinking
the chart to a dot; past that point clipping is the lesser harm.

Value stacks join their label's box, so BELOW_AXIS_LABEL placement no longer needs the
paddingFraction workaround the previous release documented. Both charts feed the solver
their own label alignment - centred for the single radar, side-aligned for the multiple
- through the same alignment functi

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -7,6 +7,12 @@ changes are listed first in each release and say what to do about them.
 
 ### Fixed
 
+- **`RadarChartConfig.scaleToFit` fits.** The last of the four dead flags, and the one whose
+  absence users could see: labels near the canvas edge simply clipped. Both radar charts now solve
+  for the largest radius at which every label — and any value stack beneath it — stays inside the
+  canvas, capped at the padding-derived radius and floored at 40% of it. A chart whose labels
+  already fit renders byte-for-byte as before, because fitting only ever shrinks; every existing
+  doc image is unchanged.
 - **`LabelConfig.shouldShowLabelsOutside` places pie labels outside the rim.** Declared and
   documented since it shipped, read by nothing — the playground even offered it as a toggle that did
   nothing. Labels now sit just outside the pie on their slice's angle. Mind your `labelTextStyle`:
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/radar/MultipleRadarChart.kt` (modified, +10/-9)
```diff
@@ -53,10 +53,11 @@ import com.himanshoe.charty.radar.config.valueLabelClearance
 import com.himanshoe.charty.radar.data.RadarDataSet
 import com.himanshoe.charty.radar.internal.drawMultipleRadarValuesBelowLabels
 import com.himanshoe.charty.radar.internal.drawRadarAxisValues
+import com.himanshoe.charty.radar.internal.drawRadarCenterBackdrop
+import com.himanshoe.charty.radar.internal.multipleRadarFitRadius
 import com.himanshoe.charty.radar.internal.radarLabelBoxAlignment
 import kotlin.math.PI
 import kotlin.math.cos
-import kotlin.math.min
 import kotlin.math.sin
 
 private const val FULL_CIRCLE_DEGREES = 360f
@@ -497,7 +498,13 @@ private fun RadarChartContent(
                     ),
         ) {
             val center = Offset(size.width / 2f, size.height / 2f)
-            val maxRadius = min(size.width / 2f, size.height / 2f) * (1f - config.radarConfig.paddingFraction)
+            val maxRadius =
+                multipleRadarFitRadius(
+                    config = config,
+                    measuredLabels = measuredAxisLabels,
+                    measuredValues = measuredAxisValues,
+                    numberOfAxes = numberOfAxes,
+                )
 
             if (config.radarConfig.gridConfig.showGridLines) {
                 drawRadarGrid(
@@ -574,13 +581,7 @@ private fun RadarChartContent(
                 )
             }
 
-            if (config.radarConfig.centerConfig.centerBackgroundRadius > 0f) {
-                drawCircle(
-                    brush = Brush.linearGradient(config.radarConfig.centerConfig.centerBackgroundColor.value),
-                    radius = config.radarConfig.centerConfig.centerBackgroundRadius,
-                    center = center,
-                )
-            }
+            drawRadarCenterBackdrop(centerConfig = config.radarConfig.centerConfig, center = center)
         }
     }
 }
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/radar/RadarChart.kt` (modified, +10/-9)
```diff
@@ -39,14 +39,15 @@ import com.himanshoe.charty.radar.config.valueLabelClearance
 import com.himanshoe.charty.radar.data.RadarAxisData
 import com.himanshoe.charty.radar.data.RadarDataSet
 import com.himanshoe.charty.radar.internal.drawRadarAxisValues
+import com.himanshoe.charty.radar.internal.drawRadarCenterBackdrop
 import com.himanshoe.charty.radar.internal.drawRadarValuesBelowLabel
 import com.himanshoe.charty.radar.internal.radarAxisAngleRadians
+import com.himanshoe.charty.radar.internal.radarChartFitRadius
 import com.himanshoe.charty.radar.internal.radarValueStackCenteredAnchor
 import kotlin.math.PI
 import kotlin.math.abs
 import kotlin.math.atan2
 import kotlin.math.cos
-import kotlin.math.min
 import kotlin.math.sin
 
 private const val FULL_CIRCLE_DEGREES = 360f
@@ -170,7 +171,13 @@ fun RadarChart(
         Canvas(modifier = Modifier.fillMaxSize()) {
             val centerX = size.width / 2f
             val centerY = size.height / 2f
-            val maxRadius = min(centerX, centerY) * (1f - config.paddingFraction)
+            val maxRadius =
+                radarChartFitRadius(
+                    config = config,
+                    measuredLabels = measuredAxisLabels,
+                    measuredValues = measuredAxisValues,
+                    numberOfAxes = numberOfAxes,
+                )
             if (config.gridConfig.showGridLines) {
                 drawRadarGrid(
                     center = Offset(centerX, centerY),
@@ -236,13 +243,7 @@ fun RadarChart(
                 )
             }
 
-            if (config.centerConfig.centerBackgroundRadius > 0f) {
-                drawCircle(
-                    brush = Brush.linearGradient(config.centerConfig.centerBackgroundColor.value),
-                    radius = config.centerConfig.centerBackgroundRadius,
-                    center = Offset(centerX, centerY),
-                )
-            }
+            drawRadarCenterBackdrop(centerConfig = config.centerConfig, center = Offset(centerX, centerY))
         }
         if (centerContent != null) {
             centerContent()
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/radar/internal/RadarFit.kt` (added, +241/-0)
```diff
@@ -0,0 +1,241 @@
+package com.himanshoe.charty.radar.internal
+
+import androidx.compose.ui.geometry.Offset
+import androidx.compose.ui.graphics.drawscope.DrawScope
+import androidx.compose.ui.text.TextLayoutResult
+import androidx.compose.ui.util.fastForEachIndexed
+import com.himanshoe.charty.radar.config.MultipleRadarChartConfig
+import com.himanshoe.charty.radar.config.RadarChartConfig
+import com.himanshoe.charty.radar.config.RadarLabelConfig
+import com.himanshoe.charty.radar.config.RadarValuePlacement
+import kotlin.math.cos
+import kotlin.math.min
+import kotlin.math.sin
+
+private const val COEFFICIENT_EPSILON = 1e-4f
+
+/**
+ * The floor on how far fitting may shrink the radar, as a fraction of the padded radius. Without it
+ * a pathological label — a paragraph on one axis — could shrink the chart to a dot; past this point
+ * clipping the label is the lesser harm, and the caller's remedies are shorter labels or more room.
+ */
+private const val MIN_FIT_FRACTION = 0.4f
+
+/**
+ * One axis's text as the fit solver sees it: a box hung off the label anchor, where the anchor sits
+ * at `radius * labelDistanceMultiplier` along [angleRadians] from the centre. [offsetX]/[offsetY]
+ * are the box's top-left relative to the anchor and do not depend on the radius; [height] includes
+ * any value stack hanging below the label.
+ */
+internal class RadarFitBox(
+    val angleRadians: Float,
+    val offsetX: Float,
+    val offsetY: Float,
+    val width: Float,
+    val height: Float,
+)
+
+/**
+ * The largest radius at which every [RadarFitBox] stays inside the canvas, capped at [paddedRadius].
+ *
+ * Each box's position is `centre + radius * multiplier * (cos, sin) + offset`, which is linear in
+ * the radius — so "stay inside the canvas" is one linear inequality per edge, and the answer is the
+ * smallest of their solutions. A chart whose labels already fit gets [paddedRadius] back unchanged,
+ * which is what keeps existing renders byte-identical: fitting only ever shrinks, and only when
+ * something would otherwise leave the canvas.
+ */
+internal fun radarFitRadius(
+    centerX: Float,
+    centerY: Float,
+    canvasWidth: Float,
+    canvasHeight: Float,
+    labelDistanceMultiplier: Float,
+    boxes: List<RadarFitBox>,
+    paddedRadius: Float,
+): Float {
+    var fit = paddedRadius
+    boxes.forEach { box ->
+        val coefficientX = labelDistanceMultiplier * cos(box.angleRadians)
+        val coefficientY = labelDistanceMultiplier * sin(box.angleRadians)
+        fit =
+            minOf(
+                fit,
+                maxRadiusFor(
+                    base = centerX + box.offsetX,
+                    coefficient = coefficientX,
+                    low = 0f,
+                    high = canvasWidth - box.width,
+                ),
+                maxRadiusFor(
+                    base = centerY + box.offsetY,
+                    coefficient = coefficientY,
+                    low = 0f,
+                    high = canvasHeight - box.height,
+                ),
+            )
+    }
+    return maxOf(fit, paddedRadius * MIN_FIT_FRACTION)
+}
+
+/**
+ * The largest radius keeping `base + radius * coefficient` inside `[low, high]`. A coefficient near
+ * zero means the radius cannot move this edge of the box at all, so it imposes no bound.
+ */
+private fun maxRadiusFor(
+    base: Float,
+    coefficient: Float,
+    low: Float,
+    high: Float,
+): Float =
+    when {
+        coefficient > COEFFICIENT_EPSILON -> (high - base) / coefficient
+        coefficient < -COEFFICIENT_EPSILON -> (base - low) / -coefficient
+        else -> Float.MAX_VALUE
+    }
+
+/**
+ * The radius the single radar draws at: the padding-derived radius, shrunk just enough for every
+ * centred label — and any value stack beneath it — to stay inside the canvas when `scaleToFit` asks
+ * for that.
+ */
+internal fun DrawScope.radarChartFitRadius(
+    config: RadarChartConfig,
+    measuredLabels: List<TextLayoutResult>,
+    measuredValues: List<List<TextLayoutResult>>,
+    numberOfAxes: Int,
+): Float {
+    val centerX = size.width / 2f
+    val centerY = size.height / 2f
+    val paddedRadius = min(centerX, centerY) * (1f - config.paddingFraction)
+    if (!config.scaleToFit) {
+        return paddedRadius
+    }
+    val boxes =
+        fitBoxes(
+            labelConfig = config.labelConfig,
+            measuredLabels = measuredLabels,
+            measuredValues = measuredValues,
+            numberOfAxes = numberOfAxes,
+            startAngleDegrees = config.startAngleDegrees,
+            alignment = { _, width, height -> Offset(x = -width / 2f, y = -height / 2f) },
+        )
+    return radarFitRadius(
+        centerX = centerX,
+        centerY = centerY,
+        canvasWidth = size.width,
+        canvasHeight = size.height,
+        labelDistanceMultiplier = config.labelConfig.labelDistanceMultiplier,
+        boxes = boxes,
+        paddedRadius = paddedRadius,
+    )
+}
+
+/**
+
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/radar/internal/RadarValueLabels.kt` (modified, +19/-0)
```diff
@@ -1,11 +1,13 @@
 package com.himanshoe.charty.radar.internal
 
 import androidx.compose.ui.geometry.Offset
+import androidx.compose.ui.graphics.Brush
 import androidx.compose.ui.graphics.drawscope.DrawScope
 import androidx.compose.ui.text.TextLayoutResult
 import androidx.compose.ui.text.drawText
 import androidx.compose.ui.util.fastForEachIndexed
 import com.himanshoe.charty.radar.config.MultipleRadarChartConfig
+import com.himanshoe.charty.radar.config.RadarCenterConfig
 import kotlin.math.abs
 import kotlin.math.cos
 import kotlin.math.sin
@@ -168,3 +170,20 @@ internal fun DrawScope.drawMultipleRadarValuesBelowLabels(
         }
     }
 }
+
+/**
+ * The optional backdrop circle behind the radar's centre, drawn when the config gives it a radius.
+ * Both radar charts drew this identical block themselves.
+ */
+internal fun DrawScope.drawRadarCenterBackdrop(
+    centerConfig: RadarCenterConfig,
+    center: Offset,
+) {
+    if (centerConfig.centerBackgroundRadius > 0f) {
+        drawCircle(
+            brush = Brush.linearGradient(centerConfig.centerBackgroundColor.value),
+            radius = centerConfig.centerBackgroundRadius,
+            center = center,
+        )
+    }
+}
```

**File**: `charty/src/commonTest/kotlin/com/himanshoe/charty/radar/RadarFitRadiusTest.kt` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+package com.himanshoe.charty.radar
+
+import com.himanshoe.charty.radar.internal.RadarFitBox
+import com.himanshoe.charty.radar.internal.radarFitRadius
+import kotlin.math.PI
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertTrue
+
+private const val TOLERANCE = 0.01f
+
+class RadarFitRadiusTest {
+    @Test
+    fun `a chart whose labels already fit keeps its padded radius exactly`() {
+        val fit =
+            radarFitRadius(
+                centerX = 200f,
+                centerY = 200f,
+                canvasWidth = 400f,
+                canvasHeight = 400f,
+                labelDistanceMultiplier = 1.15f,
+                boxes =
+                    listOf(
+                        RadarFitBox(angleRadians = 0f, offsetX = -10f, offsetY = -5f, width = 20f, height = 10f),
+                    ),
+                paddedRadius = 100f,
+            )
+
+        assertEquals(expected = 100f, actual = fit, absoluteTolerance = TOLERANCE)
+    }
+
+    @Test
+    fun `a label that would leave the canvas shrinks the radius just enough`() {
+        // Rightward axis, canvas 400 wide: the box's right edge is centre + r*1.0 + 40, so at the
+        // padded 190 it would reach 430. Fitting solves r for edge == 400, which is 160.
+        val fit =
+            radarFitRadius(
+                centerX = 200f,
+                centerY = 200f,
+                canvasWidth = 400f,
+                canvasHeight = 400f,
+                labelDistanceMultiplier = 1f,
+                boxes =
+                    listOf(
+                        RadarFitBox(angleRadians = 0f, offsetX = -40f, offsetY = -5f, width = 80f, height = 10f),
+                    ),
+                paddedRadius = 190f,
+            )
+
+        assertEquals(expected = 160f, actual = fit, absoluteTolerance = TOLERANCE)
+    }
+
+    @Test
+    fun `a downward axis constrains against the bottom edge, stack height included`() {
+        // Downward axis (PI/2): the box top sits at centre + r - 8 and the box is 30 tall (label
+        // plus stack), so the bottom edge reaches the 400px canvas when r = 178 - below the padded
+        // 190, so the chart shrinks by exactly the 12px the stack needed.
+        val fit =
+            radarFitRadius(
+                centerX = 200f,
+                centerY = 200f,
+                canvasWidth = 400f,
+                canvasHeight = 400f,
+                labelDistanceMultiplier = 1f,
+                boxes =
+                    listOf(
+                        RadarFitBox(
+                            angleRadians = (PI / 2).toFloat(),
+                            offsetX = -20f,
+                            offsetY = -8f,
+                            width = 40f,
+                            height = 30f,
+                        ),
+                    ),
+                paddedRadius = 190f,
+            )
+        assertEquals(expected = 178f, actual = fit, absoluteTolerance = TOLERANCE)
+    }
+
+    @Test
+    fun `a pathological label cannot shrink the chart past the floor`() {
+        val fit =
+            radarFitRadius(
+                centerX = 200f,
+                centerY = 200f,
+                canvasWidth = 400f,
+                canvasHeight = 400f,
+                labelDistanceMultiplier = 1f,
+                boxes =
+                    listOf(
+                        RadarFitBox(angleRadians = 0f, offsetX = -190f, offsetY = -5f, width = 380f, height = 10f),
+                    ),
+                paddedRadius = 190f,
+            )
+
+        assertTrue(actual = fit >= 190f * 0.4f - TOLERANCE, message = "the floor holds at 40% of padded")
+    }
+}
```

**File**: `docs/charty/charts/radial/RadarChart.md` (modified, +1/-1)
```diff
@@ -86,7 +86,7 @@ The chart attaches a generated summary ("Radar chart, 1 dataset, 5 axes each. St
 | `gridConfig` | `RadarGridConfig` | `RadarGridConfig()` | Grid and axis lines |
 | `centerConfig` | `RadarCenterConfig` | `RadarCenterConfig()` | Optional centre icon and backdrop |
 | `animation` | `Animation` | `Animation.Default` | Grow-from-centre entry animation |
-| `scaleToFit` | `Boolean` | `true` | Shrinks the radar so labels stay inside the bounds |
+| `scaleToFit` | `Boolean` | `true` | Shrinks the radar just enough that labels (and value stacks) stay inside the canvas; floored at 40% of the padded radius so a pathological label cannot shrink the chart to a dot |
 | `paddingFraction` | `Float` | `0.15f` | Padding around the radar; `0f..0.5f` |
 
 ### `RadarLabelConfig`
```

---

### Incident Patch 2: `f166f879` (2026-08-31)
**Commit Message**: [Fix] Make three dead pie and radar flags do what they always claimed

The sweep after #179 found four public flags that were declared, documented and read by
nothing. This lands the pie pair and settles the radar icon; scaleToFit follows
separately because it changes geometry.

shouldShowLabelsOutside now draws slice labels just outside the rim on their slice's
angle. enableHoverEffect now grows the slice under the pointer — less than selection
does, and selection wins, pinned by a unit test on the scale rule. Both were playground
toggles that visibly did nothing.

showCenterIcon could never be implemented: there has never been an icon for it to show,
nor any parameter to supply one. Wiring it would have meant inventing an icon nobody
chose. It and centerIconSize are deprecated pointing at the real feature, a centerContent
composable slot on RadarChart mirroring PieChart's, rendered above the existing backdrop
circle. Its dead require() also goes: validating a value nothing reads only punishes
callers who have not migrated yet.

Verified by rendering: goldens for outside labels (inside as control), and for the centre
slot. The snapshot suite and all 35 doc images are byte-identica

**File**: `CHANGELOG.md` (modified, +20/-0)
```diff
@@ -3,6 +3,26 @@
 Notable changes to Charty. Versions follow [semantic versioning](https://semver.org); breaking
 changes are listed first in each release and say what to do about them.
 
+## Unreleased
+
+### Fixed
+
+- **`LabelConfig.shouldShowLabelsOutside` places pie labels outside the rim.** Declared and
+  documented since it shipped, read by nothing — the playground even offered it as a toggle that did
+  nothing. Labels now sit just outside the pie on their slice's angle. Mind your `labelTextStyle`:
+  the default is white, chosen for text on coloured slices.
+- **`InteractionConfig.enableHoverEffect` exists now.** On hover-capable platforms the slice under
+  the pointer grows slightly (less than a selection does, and selection wins). It was another
+  documented no-op.
+
+### Changed
+
+- **`RadarCenterConfig.showCenterIcon` and `centerIconSize` are deprecated.** They never drew
+  anything and never could: there has never been an icon for the flag to show, nor a way to supply
+  one. The real feature arrives instead — `RadarChart` gains a `centerContent` composable slot,
+  rendered over the chart's centre above the `centerBackgroundRadius` backdrop, mirroring
+  `PieChart`'s slot of the same name.
+
 ## 3.2.0
 
 ### Added
```

**File**: `charty/src/androidUnitTest/kotlin/com/himanshoe/charty/snapshot/PieOutsideLabelTest.kt` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+package com.himanshoe.charty.snapshot
+
+import androidx.compose.foundation.background
+import androidx.compose.foundation.layout.Box
+import androidx.compose.foundation.layout.size
+import androidx.compose.runtime.Composable
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.graphics.Color
+import androidx.compose.ui.text.TextStyle
+import androidx.compose.ui.unit.dp
+import androidx.compose.ui.unit.sp
+import com.github.takahirom.roborazzi.RoborazziOptions
+import com.github.takahirom.roborazzi.captureRoboImage
+import com.himanshoe.charty.color.ChartyColor
+import com.himanshoe.charty.color.ChartyColors
+import com.himanshoe.charty.common.config.Animation
+import com.himanshoe.charty.pie.PieChart
+import com.himanshoe.charty.pie.config.LabelConfig
+import com.himanshoe.charty.pie.config.PieChartConfig
+import com.himanshoe.charty.pie.data.PieData
+import org.junit.Test
+import org.junit.runner.RunWith
+import org.robolectric.RobolectricTestRunner
+import org.robolectric.annotation.Config
+import org.robolectric.annotation.GraphicsMode
+
+private const val PIE_SNAPSHOT_SDK = 34
+private const val PIE_ANTIALIASING_TOLERANCE = 0.01f
+private const val PIE_SNAPSHOT_SCREEN = "w480dp-h800dp"
+
+/**
+ * Pins that `LabelConfig.shouldShowLabelsOutside` moves the slice labels outside the rim.
+ *
+ * The flag was declared and documented for a release without a single reader in the drawing code —
+ * the same defect class as #179's `showValues`. Only a rendering test can hold the fix in place.
+ * Outside labels default to a dark style in this capture because the config's white-on-slice default
+ * is unreadable on a white background — which is the caller's choice to make, not the chart's.
+ */
+@RunWith(RobolectricTestRunner::class)
+@GraphicsMode(GraphicsMode.Mode.NATIVE)
+@Config(sdk = [PIE_SNAPSHOT_SDK], qualifiers = PIE_SNAPSHOT_SCREEN)
+class PieOutsideLabelTest {
+    @Test
+    fun pieLabelsOutside() = capture(name = "pie_labels_outside", outside = true)
+
+    @Test
+    fun pieLabelsInside() = capture(name = "pie_labels_inside", outside = false)
+
+    private fun capture(
+        name: String,
+        outside: Boolean,
+    ) {
+        captureRoboImage(
+            filePath = "src/androidUnitTest/snapshots/$name.png",
+            roborazziOptions =
+                RoborazziOptions(
+                    compareOptions = RoborazziOptions.CompareOptions(changeThreshold = PIE_ANTIALIASING_TOLERANCE),
+                ),
+        ) {
+            PieUnderTest(outside = outside)
+        }
+    }
+}
+
+@Composable
+private fun PieUnderTest(outside: Boolean) {
+    Box(modifier = Modifier.size(size = 360.dp).background(color = Color.White)) {
+        PieChart(
+            data = {
+                listOf(
+                    PieData(label = "A", value = 45f, color = ChartyColor.Solid(ChartyColors.Blue)),
+                    PieData(label = "B", value = 30f, color = ChartyColor.Solid(ChartyColors.Teal)),
+                    PieData(label = "C", value = 15f, color = ChartyColor.Solid(ChartyColors.Orange)),
+                    PieData(label = "D", value = 10f, color = ChartyColor.Solid(ChartyColors.Purple)),
+                )
+            },
+            config =
+                PieChartConfig(
+                    animation = Animation.Disabled,
+                    labelConfig =
+                        LabelConfig(
+                            shouldShowLabelsOutside = outside,
+                            labelTextStyle =
+                                if (outside) {
+                                    TextStyle(color = Color.Black, fontSize = 12.sp)
+                                } else {
+                                    LabelConfig().labelTextStyle
+                                },
+                        ),
+                ),
+        )
+    }
+}
```

**File**: `charty/src/androidUnitTest/kotlin/com/himanshoe/charty/snapshot/RadarCenterContentTest.kt` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+package com.himanshoe.charty.snapshot
+
+import androidx.compose.foundation.background
+import androidx.compose.foundation.layout.Box
+import androidx.compose.foundation.layout.size
+import androidx.compose.material3.Text
+import androidx.compose.runtime.Composable
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.graphics.Color
+import androidx.compose.ui.text.TextStyle
+import androidx.compose.ui.text.font.FontWeight
+import androidx.compose.ui.unit.dp
+import androidx.compose.ui.unit.sp
+import com.github.takahirom.roborazzi.RoborazziOptions
+import com.github.takahirom.roborazzi.captureRoboImage
+import com.himanshoe.charty.color.ChartyColor
+import com.himanshoe.charty.color.ChartyColors
+import com.himanshoe.charty.common.config.Animation
+import com.himanshoe.charty.radar.RadarChart
+import com.himanshoe.charty.radar.config.RadarCenterConfig
+import com.himanshoe.charty.radar.config.RadarChartConfig
+import com.himanshoe.charty.radar.data.RadarAxisData
+import com.himanshoe.charty.radar.data.RadarDataSet
+import org.junit.Test
+import org.junit.runner.RunWith
+import org.robolectric.RobolectricTestRunner
+import org.robolectric.annotation.Config
+import org.robolectric.annotation.GraphicsMode
+
+private const val CENTER_SNAPSHOT_SDK = 34
+private const val CENTER_ANTIALIASING_TOLERANCE = 0.01f
+
+/**
+ * Pins the `centerContent` slot: a composable handed to the radar renders over its centre, above the
+ * backdrop circle from [RadarCenterConfig.centerBackgroundRadius]. The slot replaces the deprecated
+ * `showCenterIcon` flag, which shipped without any icon to show or a way to supply one.
+ */
+@RunWith(RobolectricTestRunner::class)
+@GraphicsMode(GraphicsMode.Mode.NATIVE)
+@Config(sdk = [CENTER_SNAPSHOT_SDK])
+class RadarCenterContentTest {
+    @Test
+    fun radarCenterContent() {
+        captureRoboImage(
+            filePath = "src/androidUnitTest/snapshots/radar_center_content.png",
+            roborazziOptions =
+                RoborazziOptions(
+                    compareOptions = RoborazziOptions.CompareOptions(changeThreshold = CENTER_ANTIALIASING_TOLERANCE),
+                ),
+        ) {
+            RadarWithCenterScore()
+        }
+    }
+}
+
+@Composable
+private fun RadarWithCenterScore() {
+    Box(modifier = Modifier.size(size = 320.dp).background(color = Color.White)) {
+        RadarChart(
+            data = {
+                listOf(
+                    RadarDataSet(
+                        label = "Player",
+                        axes =
+                            listOf(
+                                RadarAxisData(label = "Speed", value = 80f),
+                                RadarAxisData(label = "Power", value = 65f),
+                                RadarAxisData(label = "Skill", value = 90f),
+                                RadarAxisData(label = "Stamina", value = 70f),
+                                RadarAxisData(label = "Defense", value = 55f),
+                            ),
+                        color = ChartyColor.Solid(ChartyColors.Blue),
+                    ),
+                )
+            },
+            config =
+                RadarChartConfig(
+                    animation = Animation.Disabled,
+                    centerConfig =
+                        RadarCenterConfig(
+                            centerBackgroundColor = ChartyColor.Solid(Color.White),
+                            centerBackgroundRadius = 60f,
+                        ),
+                ),
+            centerContent = {
+                Text(
+                    text = "72",
+                    style = TextStyle(color = Color.Black, fontSize = 22.sp, fontWeight = FontWeight.Bold),
+                )
+            },
+        )
+    }
+}
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/pie/config/PieChartConfig.kt` (modified, +5/-2)
```diff
@@ -48,7 +48,8 @@ enum class PieChartStyle {
  * @property shouldShowPercentage Whether to display percentage values
  * @property shouldShowValue Whether to display actual numeric values
  * @property minimumPercentageToShowLabel Minimum percentage threshold to display a label
- * @property shouldShowLabelsOutside Whether to show labels outside the chart
+ * @property shouldShowLabelsOutside Draws each slice's label just outside the rim, on its slice's
+ *   angle, instead of inside the slice. Use it when slices are thin enough that inside labels crowd.
  * @property labelTextStyle TextStyle for customizing label appearance
  */
 @Stable
@@ -82,7 +83,9 @@ data class LabelConfig(
  * @property selectedScaleMultiplier Scale multiplier applied when a slice is selected
  * @property selectedSlicePullOutDistance Distance in pixels to pull out selected slice from center
  * @property selectionAnimationDurationMs Duration of selection animation in milliseconds
- * @property enableHoverEffect Whether to enable hover effects (useful for desktop/web)
+ * @property enableHoverEffect Grows the slice under the pointer slightly on hover, so desktop and
+ *   web readers can see what a click would select. Touch platforms never hover, so this costs them
+ *   nothing.
  * @property unselectedSliceOpacity Opacity for non-selected slices when one is selected
  */
 @Stable
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/pie/internal/PieChartDrawer.kt` (modified, +79/-9)
```diff
@@ -7,7 +7,10 @@ import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.fillMaxSize
 import androidx.compose.material3.Text
 import androidx.compose.runtime.Composable
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.remember
+import androidx.compose.runtime.setValue
 import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.geometry.Offset
@@ -16,6 +19,7 @@ import androidx.compose.ui.graphics.Brush
 import androidx.compose.ui.graphics.StrokeCap
 import androidx.compose.ui.graphics.drawscope.DrawScope
 import androidx.compose.ui.graphics.drawscope.Stroke
+import androidx.compose.ui.input.pointer.PointerEventType
 import androidx.compose.ui.input.pointer.pointerInput
 import androidx.compose.ui.text.TextMeasurer
 import androidx.compose.ui.text.drawText
@@ -37,6 +41,16 @@ private const val CHART_SIZE_MULTIPLIER = 0.8f
 private const val PIE_LABEL_RADIUS_MULTIPLIER = 0.65f
 private const val DONUT_LABEL_RADIUS_DIVISOR = 2f
 private const val LABEL_ANIMATION_THRESHOLD = 0.5f
+
+/**
+ * Where outside labels sit, as a multiple of the pie's radius. The pie itself is drawn at
+ * [CHART_SIZE_MULTIPLIER] of the available half-extent, so the ring at 1.12 of that still lands
+ * inside the canvas with room for the text's own height.
+ */
+private const val OUTSIDE_LABEL_RADIUS_MULTIPLIER = 1.12f
+
+/** How much a hovered slice grows: enough to read as live, small enough not to jostle neighbours. */
+private const val HOVER_SCALE_MULTIPLIER = 1.03f
 private const val PERCENTAGE_PRECISION_MULTIPLIER = 10.0
 private const val FULL_CIRCLE_DEGREES = 360f
 private const val HALF_DIVIDER = 2f
@@ -94,6 +108,7 @@ internal data class PieSliceDrawParams(
     val animationProgress: Float,
     val selectedSliceIndex: Int?,
     val selectedScale: Float,
+    val hoveredSliceIndex: Int?,
     val textMeasurer: TextMeasurer,
 )
 
@@ -126,6 +141,7 @@ internal fun PieChartContent(
 ) {
     val textMeasurer = rememberTextMeasurer()
     val sliceBrushes = remember(params.sliceColors) { params.sliceColors.map { it.toDiagonalBrush() } }
+    var hoveredSliceIndex by remember { mutableStateOf<Int?>(null) }
 
     Box(
         modifier = modifier,
@@ -135,7 +151,41 @@ internal fun PieChartContent(
             modifier =
                 Modifier
                     .fillMaxSize()
-                    .pointerInput(params.dataList, params.config.interactionConfig.isEnabled) {
+                    .pointerInput(params.dataList, params.config.interactionConfig.enableHoverEffect) {
+                        if (params.config.interactionConfig.enableHoverEffect) {
+                            awaitPointerEventScope {
+                                while (true) {
+                                    val event = awaitPointerEvent()
+                                    when (event.type) {
+                                        PointerEventType.Move -> {
+                                            if (event.changes.none { change -> change.pressed }) {
+                                                val position = event.changes.first().position
+                                                hoveredSliceIndex =
+                                                    findClickedSlice(
+                                                        touchPosition = position,
+                                                        center =
+                                                            Offset(
+                                                                size.width / HALF_DIVIDER,
+                                                                size.height / HALF_DIVIDER,
+                                                            ),
+                                                        radius =
+                                                            minOf(size.width, size.height) / HALF_DIVIDER *
+                                                                CHART_SIZE_MULTIPLIER,
+                                                        dataList = params.dataList,
+                                                        total = params.total,
+                                                        config = params.config,
+                                                    )
+                                            }
+                                        }
+
+                                        PointerEventType.Exit -> {
+                                            hoveredSliceIndex = null
+                                        }
+                                    }
+                                }
+                            }
+                        }
+                    }.pointerInput(params.dataList, params.config.interactionConfig.isEnabled) {
                         if (params.config.interactionConfig.isEnabled) {
                             de
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/radar/RadarChart.kt` (modified, +45/-18)
```diff
@@ -8,6 +8,7 @@ import androidx.compose.runtime.Composable
 import androidx.compose.runtime.derivedStateOf
 import androidx.compose.runtime.getValue
 import androidx.compose.runtime.remember
+import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.geometry.Offset
 import androidx.compose.ui.graphics.Brush
@@ -70,6 +71,8 @@ private const val DEGREES_TO_RADIANS = PI.toFloat() / 180f
  *   `null` (default) a built-in "No data" state is used.
  * @param config The configuration for the radar chart's appearance, defined by a [RadarChartConfig].
  * @param accessibilityDescription Overrides the auto-generated screen-reader description. Pass an empty string to suppress it.
+ * @param centerContent Optional composable rendered over the centre of the radar — a score, an
+ *   icon, a summary. Pairs with [RadarCenterConfig.centerBackgroundRadius] for a backdrop behind it.
  * @param onAxisClick Invoked with the [RadarAxisData] and index of the axis nearest the tap (a tap
  *   anywhere along an axis selects it). Pass `null` (default) to disable click handling.
  *
@@ -110,6 +113,7 @@ fun RadarChart(
     config: RadarChartConfig = RadarChartConfig(),
     accessibilityDescription: String? = null,
     onAxisClick: ((axis: RadarAxisData, index: Int) -> Unit)? = null,
+    centerContent: (@Composable () -> Unit)? = null,
 ) {
     val dataSets by remember(data) { derivedStateOf { data() } }
     if (dataSets.isEmpty()) {
@@ -152,25 +156,17 @@ fun RadarChart(
         )
 
     val clickModifier =
-        if (onAxisClick != null) {
-            Modifier.pointerInput(dataSets, onAxisClick) {
-                detectTapGestures { offset ->
-                    val index =
-                        nearestRadarAxisIndex(
-                            offset = offset,
-                            width = size.width.toFloat(),
-                            height = size.height.toFloat(),
-                            startAngleDegrees = config.startAngleDegrees,
-                            numberOfAxes = numberOfAxes,
-                        )
-                    onAxisClick(dataSets.first().axes[index], index)
-                }
-            }
-        } else {
-            Modifier
-        }
+        radarAxisClickModifier(
+            dataSets = dataSets,
+            numberOfAxes = numberOfAxes,
+            startAngleDegrees = config.startAngleDegrees,
+            onAxisClick = onAxisClick,
+        )
 
-    BoxWithConstraints(modifier = modifier.then(semanticsModifier).then(clickModifier)) {
+    BoxWithConstraints(
+        modifier = modifier.then(semanticsModifier).then(clickModifier),
+        contentAlignment = Alignment.Center,
+    ) {
         Canvas(modifier = Modifier.fillMaxSize()) {
             val centerX = size.width / 2f
             val centerY = size.height / 2f
@@ -248,6 +244,9 @@ fun RadarChart(
                 )
             }
         }
+        if (centerContent != null) {
+            centerContent()
+        }
     }
 }
 
@@ -562,3 +561,31 @@ private fun rememberMeasuredAxisValues(
             }
         }
     }
+
+/**
+ * The tap handler for axis clicks, or an inert modifier when the chart has no listener — an inert
+ * chart should not pay for a pointer pipeline it will never use.
+ */
+private fun radarAxisClickModifier(
+    dataSets: List<RadarDataSet>,
+    numberOfAxes: Int,
+    startAngleDegrees: Float,
+    onAxisClick: ((axis: RadarAxisData, index: Int) -> Unit)?,
+): Modifier =
+    if (onAxisClick != null) {
+        Modifier.pointerInput(dataSets, onAxisClick) {
+            detectTapGestures { offset ->
+                val index =
+                    nearestRadarAxisIndex(
+                        offset = offset,
+                        width = size.width.toFloat(),
+                        height = size.height.toFloat(),
+                        startAngleDegrees = startAngleDegrees,
+                        numberOfAxes = numberOfAxes,
+                    )
+                onAxisClick(dataSets.first().axes[index], index)
+            }
+        }
+    } else {
+        Modifier
+    }
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/radar/config/RadarChartConfig.kt` (modified, +10/-1)
```diff
@@ -145,13 +145,22 @@ data class RadarGridConfig(
  */
 @Stable
 data class RadarCenterConfig(
+    @Deprecated(
+        message =
+            "Never drawn: there has never been an icon for this flag to show, and no way to supply " +
+                "one. Pass a composable to RadarChart's centerContent parameter instead.",
+    )
     val showCenterIcon: Boolean = false,
+    @Deprecated(
+        message =
+            "Never read, for the same reason as showCenterIcon: size a centerContent composable " +
+                "yourself instead.",
+    )
     val centerIconSize: Float = DEFAULT_CENTER_ICON_SIZE,
     val centerBackgroundColor: ChartyColor = ChartyColor.Solid(Color.Transparent),
     val centerBackgroundRadius: Float = 0f,
 ) {
     init {
-        require(centerIconSize > 0f) { "Center icon size must be positive" }
         require(centerBackgroundRadius >= 0f) { "Center background radius must be non-negative" }
     }
 }
```

**File**: `charty/src/commonTest/kotlin/com/himanshoe/charty/pie/SliceScaleTest.kt` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+package com.himanshoe.charty.pie
+
+import com.himanshoe.charty.pie.internal.sliceScale
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertTrue
+
+class SliceScaleTest {
+    @Test
+    fun `an idle slice draws at its natural size`() {
+        assertEquals(expected = 1f, actual = sliceScale(isSelected = false, selectedScale = 1.1f, isHovered = false))
+    }
+
+    @Test
+    fun `a hovered slice grows, but only a little`() {
+        val scale = sliceScale(isSelected = false, selectedScale = 1.1f, isHovered = true)
+
+        assertTrue(actual = scale > 1f, message = "hover should be visible")
+        assertTrue(actual = scale < 1.1f, message = "hover should stay smaller than selection")
+    }
+
+    @Test
+    fun `selection wins over hover, so a chosen slice never shrinks under the pointer`() {
+        assertEquals(expected = 1.1f, actual = sliceScale(isSelected = true, selectedScale = 1.1f, isHovered = true))
+    }
+}
```

---

### Incident Patch 3: `27e005a1` (2026-08-28)
**Commit Message**: [Docs] Number the radar fix 3.1.1

A flag that was declared and documented but drew nothing now draws it. Nothing was
added or removed from the API, so this is a patch.

Stats: 1 file changed, 1 insertion(+), 1 deletion(-)

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 Notable changes to Charty. Versions follow [semantic versioning](https://semver.org); breaking
 changes are listed first in each release and say what to do about them.
 
-## Unreleased
+## 3.1.1
 
 ### Fixed
 
```

---

### Incident Patch 4: `27637460` (2026-08-28)
**Commit Message**: [Fix] Draw the radar values that showValues has always promised

RadarLabelConfig.showValues and its companion valueTextStyle were declared, documented
in the property table, shown in the docs example — and read by nothing. A caller who set
them got axis names, no values, and no error to explain why. Reported as #179 with a
config that was entirely correct.

Both radar charts now draw each axis's value just outside its data point. Attaching it to
the vertex rather than to the axis name keeps the number with the thing it reports while
the entry animation grows the shape.

How far outside is measured rather than picked. The label moves along its axis by what the
shape occupies at that vertex — the point radius, or half the stroke when points are
hidden — plus its own half-extent in that direction, which is where its box ends. A caller
who doubles the font size or the point radius gets the same clearance rather than the same
pixel count.

MultipleRadarChart takes the same RadarLabelConfig, so it was equally dead there and is
fixed in the same pass, through one shared drawer rather than two copies.

Verified by rendering: a golden pair, values against a blank-of-values frame, since thi

**File**: `CHANGELOG.md` (modified, +11/-0)
```diff
@@ -3,6 +3,17 @@
 Notable changes to Charty. Versions follow [semantic versioning](https://semver.org); breaking
 changes are listed first in each release and say what to do about them.
 
+## Unreleased
+
+### Fixed
+
+- **`RadarLabelConfig.showValues` draws the values.** It never had. The property and its companion
+  `valueTextStyle` were declared, documented, and read by nothing, so a caller who asked for values
+  got labels, no values and no error. Both radar charts now draw each axis's value just outside its
+  data point, where the distance is derived from the point radius and the text's own measured size
+  rather than a fixed number of pixels — raising the font size keeps the clearance instead of
+  overlapping the shape. Reported as [#179](https://github.com/hi-manshu/charty/issues/179).
+
 ## 3.1.0
 
 Fixes to the zoom and pan path and to the crosshair label, one new parameter with a default, and two
```

**File**: `charty/src/androidUnitTest/kotlin/com/himanshoe/charty/snapshot/RadarValueLabelTest.kt` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+package com.himanshoe.charty.snapshot
+
+import androidx.compose.foundation.background
+import androidx.compose.foundation.layout.Box
+import androidx.compose.foundation.layout.size
+import androidx.compose.runtime.Composable
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.graphics.Color
+import androidx.compose.ui.unit.dp
+import com.github.takahirom.roborazzi.RoborazziOptions
+import com.github.takahirom.roborazzi.captureRoboImage
+import com.himanshoe.charty.color.ChartyColor
+import com.himanshoe.charty.color.ChartyColors
+import com.himanshoe.charty.common.config.Animation
+import com.himanshoe.charty.radar.RadarChart
+import com.himanshoe.charty.radar.config.RadarChartConfig
+import com.himanshoe.charty.radar.config.RadarLabelConfig
+import com.himanshoe.charty.radar.data.RadarAxisData
+import com.himanshoe.charty.radar.data.RadarDataSet
+import org.junit.Test
+import org.junit.runner.RunWith
+import org.robolectric.RobolectricTestRunner
+import org.robolectric.annotation.Config
+import org.robolectric.annotation.GraphicsMode
+
+private const val RADAR_SNAPSHOT_SDK = 34
+private const val RADAR_ANTIALIASING_TOLERANCE = 0.01f
+
+/**
+ * Pins that `RadarLabelConfig.showValues` puts numbers on the chart.
+ *
+ * It had never drawn anything. The property and its `valueTextStyle` companion were declared,
+ * documented and read by nothing, so a caller who asked for values got labels and no error — which is
+ * how it was reported, in #179.
+ *
+ * Rendering is the only test that can catch this class of bug: the code compiled perfectly well while
+ * doing nothing, and any assertion short of "did text appear" would have compiled too.
+ */
+@RunWith(RobolectricTestRunner::class)
+@GraphicsMode(GraphicsMode.Mode.NATIVE)
+@Config(sdk = [RADAR_SNAPSHOT_SDK])
+class RadarValueLabelTest {
+    @Test
+    fun radarValuesShown() = capture(name = "radar_values_shown", showValues = true)
+
+    @Test
+    fun radarValuesHidden() = capture(name = "radar_values_hidden", showValues = false)
+
+    private fun capture(
+        name: String,
+        showValues: Boolean,
+    ) {
+        captureRoboImage(
+            filePath = "src/androidUnitTest/snapshots/$name.png",
+            roborazziOptions =
+                RoborazziOptions(
+                    compareOptions = RoborazziOptions.CompareOptions(changeThreshold = RADAR_ANTIALIASING_TOLERANCE),
+                ),
+        ) {
+            RadarUnderTest(showValues = showValues)
+        }
+    }
+}
+
+@Composable
+private fun RadarUnderTest(showValues: Boolean) {
+    Box(modifier = Modifier.size(width = 360.dp, height = 320.dp).background(color = Color.White)) {
+        RadarChart(
+            data = {
+                listOf(
+                    RadarDataSet(
+                        label = "Muscle Groups",
+                        axes =
+                            listOf(
+                                RadarAxisData(label = "Chest", value = 80f, maxValue = 100f),
+                                RadarAxisData(label = "Back", value = 65f, maxValue = 100f),
+                                RadarAxisData(label = "Legs", value = 92f, maxValue = 100f),
+                                RadarAxisData(label = "Arms", value = 40f, maxValue = 100f),
+                                RadarAxisData(label = "Core", value = 55f, maxValue = 100f),
+                            ),
+                        color = ChartyColor.Solid(ChartyColors.Blue),
+                    ),
+                )
+            },
+            config =
+                RadarChartConfig(
+                    animation = Animation.Disabled,
+                    labelConfig = RadarLabelConfig(showLabels = true, showValues = showValues),
+                ),
+        )
+    }
+}
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/radar/MultipleRadarChart.kt` (modified, +34/-0)
```diff
@@ -44,10 +44,13 @@ import com.himanshoe.charty.common.accessibility.generateRadarChartDescription
 import com.himanshoe.charty.common.animation.isAnimated
 import com.himanshoe.charty.common.animation.rememberChartAnimation
 import com.himanshoe.charty.common.config.Animation
+import com.himanshoe.charty.common.util.toChartLabel
 import com.himanshoe.charty.radar.config.LegendPosition
 import com.himanshoe.charty.radar.config.MultipleRadarChartConfig
 import com.himanshoe.charty.radar.config.RadarGridStyle
+import com.himanshoe.charty.radar.config.valueLabelClearance
 import com.himanshoe.charty.radar.data.RadarDataSet
+import com.himanshoe.charty.radar.internal.drawRadarAxisValues
 import kotlin.math.PI
 import kotlin.math.cos
 import kotlin.math.min
@@ -444,6 +447,26 @@ private fun RadarChartContent(
 ) {
     val animationProgress = rememberRadarAnimation(config.radarConfig.animation)
     val textMeasurer = rememberTextMeasurer()
+    val measuredAxisValues =
+        remember(
+            dataSetsList,
+            textMeasurer,
+            config.radarConfig.labelConfig.showValues,
+            config.radarConfig.labelConfig.valueTextStyle,
+        ) {
+            if (!config.radarConfig.labelConfig.showValues) {
+                emptyList()
+            } else {
+                dataSetsList.fastMap { dataSet ->
+                    dataSet.axes.fastMap { axis ->
+                        textMeasurer.measure(
+                            text = axis.value.toChartLabel(),
+                            style = config.radarConfig.labelConfig.valueTextStyle,
+                        )
+                    }
+                }
+            }
+        }
     val measuredAxisLabels =
         remember(dataSetsList, textMeasurer, config.radarConfig.labelConfig.labelTextStyle) {
             dataSetsList.first().axes.fastMap { axis ->
@@ -515,6 +538,7 @@ private fun RadarChartContent(
                         dataSet = dataSet,
                         config = config,
                         animationProgress = datasetAnimationProgress,
+                        measuredValues = measuredAxisValues.getOrNull(index).orEmpty(),
                     )
 
                 if (onDataSetClick != null) {
@@ -641,15 +665,18 @@ private fun DrawScope.drawRadarDataSet(
     dataSet: RadarDataSet,
     config: MultipleRadarChartConfig,
     animationProgress: Float,
+    measuredValues: List<TextLayoutResult>,
 ): List<Offset> {
     val numberOfAxes = dataSet.axes.size
     val path = Path()
     val points = mutableListOf<Offset>()
+    val angles = mutableListOf<Float>()
 
     dataSet.axes.fastForEachIndexed { index, axisData ->
         val baseAngle = config.radarConfig.startAngleDegrees
         val sweepPerAxis = FULL_CIRCLE_DEGREES * index / numberOfAxes
         val angle = (baseAngle + sweepPerAxis) * DEGREES_TO_RADIANS
+        angles.add(angle)
         val normalizedValue = axisData.getNormalizedValue()
         val radius = maxRadius * normalizedValue * animationProgress
 
@@ -708,6 +735,13 @@ private fun DrawScope.drawRadarDataSet(
         }
     }
 
+    drawRadarAxisValues(
+        points = points,
+        angles = angles,
+        measuredValues = measuredValues,
+        shapeClearance = config.radarConfig.valueLabelClearance(),
+    )
+
     return points
 }
 
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/radar/RadarChart.kt` (modified, +29/-1)
```diff
@@ -28,10 +28,13 @@ import com.himanshoe.charty.color.ChartyColor
 import com.himanshoe.charty.common.ChartEmptyState
 import com.himanshoe.charty.common.accessibility.generateRadarChartDescription
 import com.himanshoe.charty.common.animation.rememberChartAnimation
+import com.himanshoe.charty.common.util.toChartLabel
 import com.himanshoe.charty.radar.config.RadarChartConfig
 import com.himanshoe.charty.radar.config.RadarGridStyle
+import com.himanshoe.charty.radar.config.valueLabelClearance
 import com.himanshoe.charty.radar.data.RadarAxisData
 import com.himanshoe.charty.radar.data.RadarDataSet
+import com.himanshoe.charty.radar.internal.drawRadarAxisValues
 import kotlin.math.PI
 import kotlin.math.abs
 import kotlin.math.atan2
@@ -135,6 +138,21 @@ fun RadarChart(
                 textMeasurer.measure(text = axis.label, style = config.labelConfig.labelTextStyle)
             }
         }
+    val measuredAxisValues =
+        remember(dataSets, textMeasurer, config.labelConfig.showValues, config.labelConfig.valueTextStyle) {
+            if (!config.labelConfig.showValues) {
+                emptyList()
+            } else {
+                dataSets.fastMap { dataSet ->
+                    dataSet.axes.fastMap { axis ->
+                        textMeasurer.measure(
+                            text = axis.value.toChartLabel(),
+                            style = config.labelConfig.valueTextStyle,
+                        )
+                    }
+                }
+            }
+        }
 
     val clickModifier =
         if (onAxisClick != null) {
@@ -184,13 +202,14 @@ fun RadarChart(
                 )
             }
 
-            dataSets.fastForEachIndexed { _, dataSet ->
+            dataSets.fastForEachIndexed { dataSetIndex, dataSet ->
                 drawRadarDataSet(
                     center = Offset(centerX, centerY),
                     maxRadius = maxRadius,
                     dataSet = dataSet,
                     config = config,
                     animationProgress = animationProgress.value,
+                    measuredValues = measuredAxisValues.getOrNull(dataSetIndex).orEmpty(),
                 )
             }
 
@@ -362,12 +381,15 @@ private fun DrawScope.drawRadarDataSet(
     dataSet: RadarDataSet,
     config: RadarChartConfig,
     animationProgress: Float,
+    measuredValues: List<TextLayoutResult>,
 ) {
     val numberOfAxes = dataSet.axes.size
     val path = Path()
     val points = mutableListOf<Offset>()
+    val angles = mutableListOf<Float>()
     dataSet.axes.fastForEachIndexed { index, axisData ->
         val angle = (config.startAngleDegrees + (FULL_CIRCLE_DEGREES * index / numberOfAxes)) * DEGREES_TO_RADIANS
+        angles.add(angle)
         val normalizedValue = axisData.getNormalizedValue()
         val radius = maxRadius * normalizedValue * animationProgress
 
@@ -412,6 +434,12 @@ private fun DrawScope.drawRadarDataSet(
             )
         }
     }
+    drawRadarAxisValues(
+        points = points,
+        angles = angles,
+        measuredValues = measuredValues,
+        shapeClearance = config.valueLabelClearance(),
+    )
 }
 
 /**
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/radar/config/RadarChartConfig.kt` (modified, +11/-0)
```diff
@@ -159,3 +159,14 @@ data class RadarChartConfig(
         require(paddingFraction in 0f..0.5f) { "Padding fraction must be between 0 and 0.5" }
     }
 }
+
+/**
+ * How much room the plotted shape takes at a vertex, which is what a value label has to clear: the
+ * data point when points are drawn, and half the stroke when they are not.
+ */
+internal fun RadarChartConfig.valueLabelClearance(): Float =
+    if (showDataPoints) {
+        dataPointRadius
+    } else {
+        dataLineWidth / 2f
+    }
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/radar/internal/RadarValueLabels.kt` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+package com.himanshoe.charty.radar.internal
+
+import androidx.compose.ui.geometry.Offset
+import androidx.compose.ui.graphics.drawscope.DrawScope
+import androidx.compose.ui.text.TextLayoutResult
+import androidx.compose.ui.text.drawText
+import androidx.compose.ui.util.fastForEachIndexed
+import kotlin.math.abs
+import kotlin.math.cos
+import kotlin.math.sin
+
+/**
+ * Draws each axis value just outside the data point it belongs to.
+ *
+ * The text follows the vertex rather than the axis label, so it stays attached to the value it
+ * reports while the entry animation grows the shape.
+ *
+ * How far outside is measured, not chosen. The label is pushed along its axis by [shapeClearance] —
+ * whatever the shape occupies at that vertex — plus the label's own half-extent in that direction,
+ * which is where its box stops. A caller who doubles the font size or the point radius gets the same
+ * visual clearance rather than the same number of pixels.
+ *
+ * Shared by both radar charts: they take the same [RadarLabelConfig], so a value that renders on one
+ * and not the other is a bug rather than a difference worth having.
+ */
+internal fun DrawScope.drawRadarAxisValues(
+    points: List<Offset>,
+    angles: List<Float>,
+    measuredValues: List<TextLayoutResult>,
+    shapeClearance: Float,
+) {
+    measuredValues.fastForEachIndexed { index, textLayoutResult ->
+        val point = points.getOrNull(index) ?: return@fastForEachIndexed
+        val angle = angles.getOrNull(index) ?: return@fastForEachIndexed
+        val halfWidth = textLayoutResult.size.width / 2f
+        val halfHeight = textLayoutResult.size.height / 2f
+        val halfExtentAlongAxis = abs(cos(angle)) * halfWidth + abs(sin(angle)) * halfHeight
+        val distance = shapeClearance + halfExtentAlongAxis
+        drawText(
+            textLayoutResult = textLayoutResult,
+            topLeft =
+                Offset(
+                    x = point.x + cos(angle) * distance - halfWidth,
+                    y = point.y + sin(angle) * distance - halfHeight,
+                ),
+        )
+    }
+}
```

**File**: `docs/charty/charts/radial/RadarChart.md` (modified, +12/-7)
```diff
@@ -91,13 +91,18 @@ The chart attaches a generated summary ("Radar chart, 1 dataset, 5 axes each. St
 
 ### `RadarLabelConfig`
 
-| Property | Type | Default |
-| --- | --- | --- |
-| `showLabels` | `Boolean` | `true` |
-| `showValues` | `Boolean` | `false` |
-| `labelDistanceMultiplier` | `Float` | `1.15f` (must be positive) |
-| `labelTextStyle` | `TextStyle` | 12 sp, black |
-| `valueTextStyle` | `TextStyle` | 10 sp, black |
+| Property | Type | Default | Description |
+| --- | --- | --- | --- |
+| `showLabels` | `Boolean` | `true` | Axis names, placed outside the grid |
+| `showValues` | `Boolean` | `false` | Each axis's value, drawn just outside its data point |
+| `labelDistanceMultiplier` | `Float` | `1.15f` | How far out the axis names sit; must be positive |
+| `labelTextStyle` | `TextStyle` | 12 sp, black | Style for the axis names |
+| `valueTextStyle` | `TextStyle` | 10 sp, black | Style for the values |
+
+Values follow the data points rather than the axis names, so they stay attached to what they report
+while the entry animation grows the shape. Their distance from each point is derived from the point
+radius and the text's own size, so raising `valueTextStyle`'s font size keeps the same clearance
+instead of overlapping the shape.
 
 ### `RadarGridConfig`
 
```

---

### Incident Patch 5: `d16bfcc1` (2026-08-14)
**Commit Message**: [Fix] Honour showLabel on line-family crosshairs, and delete what hid it

ChartCrosshairConfig.showLabel promises to control whether the crosshair's value label
appears. On every line-family chart it had stopped doing anything: the label used to be
drawn on the canvas, where the flag was read, and when it became a Composable overlay
the check did not come with it. Bar charts, which still draw theirs on the canvas, were
unaffected — so the flag worked or not depending on which chart you picked.

What kept this invisible was a drawLabel parameter threaded through seven charts, three
draw-parameter bundles and two crosshair drawers, hard-coded to false at every single
call site. A flag nobody can set reads as a deliberate switch rather than as a path that
died, and the on-canvas label bubble it guarded had been unreachable since the overlay
replaced it. Both are gone.

Verified by rendering: two goldens under the existing snapshot suite, a badge for
showLabel = true and a blank frame for false, so a regression that brings the label back
fails CI. Doc images regenerated with --rerun-tasks: byte-identical.

Stats: 20 files changed, 83 insertions(+), 37 deletions(-)

**File**: `charty/src/androidUnitTest/kotlin/com/himanshoe/charty/snapshot/CrosshairLabelVisibilityTest.kt` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+package com.himanshoe.charty.snapshot
+
+import androidx.compose.foundation.background
+import androidx.compose.foundation.layout.Box
+import androidx.compose.foundation.layout.size
+import androidx.compose.runtime.Composable
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.graphics.Color
+import androidx.compose.ui.unit.dp
+import com.github.takahirom.roborazzi.RoborazziOptions
+import com.github.takahirom.roborazzi.captureRoboImage
+import com.himanshoe.charty.common.gesture.ChartCrosshair
+import com.himanshoe.charty.common.gesture.ChartCrosshairConfig
+import com.himanshoe.charty.common.gesture.ChartCrosshairHost
+import com.himanshoe.charty.common.gesture.CrosshairState
+import org.junit.Test
+import org.junit.runner.RunWith
+import org.robolectric.RobolectricTestRunner
+import org.robolectric.annotation.Config
+import org.robolectric.annotation.GraphicsMode
+
+private const val CROSSHAIR_SNAPSHOT_SDK = 34
+private const val CROSSHAIR_ANTIALIASING_TOLERANCE = 0.01f
+
+/**
+ * Pins that a crosshair's `showLabel` flag decides whether a label appears.
+ *
+ * The flag had stopped working on every line-family chart. The label used to be drawn on the canvas,
+ * where the flag was read; when it became a Composable overlay the check did not come with it. Nothing
+ * caught that, because the parameter which had carried the old behaviour was still threaded through
+ * five files — hard-coded to `false` at every call site, which made a dead path look like a live one.
+ *
+ * Only rendering can answer this: the question is whether pixels appear. The `false` golden is a blank
+ * frame, so a regression that brings the label back has nowhere to hide.
+ *
+ * Where the badge lands is incidental — the host is placed here without a chart under it, so it has no
+ * plot bounds to position against. This test is about presence, not placement.
+ */
+@RunWith(RobolectricTestRunner::class)
+@GraphicsMode(GraphicsMode.Mode.NATIVE)
+@Config(sdk = [CROSSHAIR_SNAPSHOT_SDK])
+class CrosshairLabelVisibilityTest {
+    @Test
+    fun crosshairLabelShown() = capture(name = "crosshair_label_shown", showLabel = true)
+
+    @Test
+    fun crosshairLabelHidden() = capture(name = "crosshair_label_hidden", showLabel = false)
+
+    private fun capture(
+        name: String,
+        showLabel: Boolean,
+    ) {
+        captureRoboImage(
+            filePath = "src/androidUnitTest/snapshots/$name.png",
+            roborazziOptions =
+                RoborazziOptions(
+                    compareOptions =
+                        RoborazziOptions.CompareOptions(changeThreshold = CROSSHAIR_ANTIALIASING_TOLERANCE),
+                ),
+        ) {
+            CrosshairLabelUnderTest(showLabel = showLabel)
+        }
+    }
+}
+
+@Composable
+private fun CrosshairLabelUnderTest(showLabel: Boolean) {
+    Box(modifier = Modifier.size(width = 360.dp, height = 220.dp).background(color = Color.White)) {
+        ChartCrosshairHost(
+            crosshair = ChartCrosshair<Float>(config = ChartCrosshairConfig(showLabel = showLabel)),
+            item = 42f,
+            state = CrosshairState(x = 260f, y = 140f, label = "42"),
+        )
+    }
+}
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/bar/internal/bar/wavy/WavyChartDrawer.kt` (modified, +0/-1)
```diff
@@ -187,7 +187,6 @@ internal fun DrawScope.drawWavyOverlays(
                 chartContext = chartContext,
                 textMeasurer = textMeasurer,
                 chartColor = color,
-                drawLabel = false,
             )
         }
     }
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/combo/ComboChart.kt` (modified, +0/-1)
```diff
@@ -226,7 +226,6 @@ fun ComboChart(
                     drawTooltipBubble = tooltip.isCanvas(),
                     textMeasurer = textMeasurer,
                     interactionConfig = interactionConfig,
-                    drawCrosshairLabel = false,
                 ),
             )
         }
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/combo/internal/ComboChartDrawer.kt` (modified, +0/-1)
```diff
@@ -208,7 +208,6 @@ internal fun DrawScope.drawComboContent(p: ComboDrawParams) {
                 chartContext = p.chartContext,
                 textMeasurer = p.textMeasurer,
                 chartColor = p.lineColor,
-                drawLabel = p.drawCrosshairLabel,
             )
         }
     }
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/combo/internal/ComboDrawParams.kt` (modified, +0/-3)
```diff
@@ -36,8 +36,6 @@ import com.himanshoe.charty.common.tooltip.TooltipState
  *   Compose-overlay tooltip is hosted above the canvas instead.
  * @property textMeasurer Measurer used for the reference band, markers, tooltip, and crosshair.
  * @property interactionConfig Supplies the annotation, brush-selection, and edge-fade overlays.
- * @property drawCrosshairLabel Whether the crosshair label is drawn on the canvas rather than as a
- *   composable overlay above it.
  * @property tooltipConfig Styling for the tooltip bubble, already resolved against the theme.
  */
 internal data class ComboDrawParams(
@@ -58,6 +56,5 @@ internal data class ComboDrawParams(
     val drawTooltipBubble: Boolean,
     val textMeasurer: TextMeasurer,
     val interactionConfig: ChartInteractionConfig,
-    val drawCrosshairLabel: Boolean,
     val tooltipConfig: TooltipConfig,
 )
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/common/gesture/ChartCrosshair.kt` (modified, +5/-3)
```diff
@@ -53,7 +53,8 @@ class CrosshairScope<T> internal constructor(
 
 /**
  * Renders a [ChartCrosshair]'s label over the guide line. Place it as a sibling over the chart
- * canvas; it draws nothing when there is no active crosshair selection.
+ * canvas; it draws nothing when there is no active crosshair selection, or when the crosshair has
+ * been configured not to show a label.
  *
  * @param crosshair The crosshair configuration.
  * @param item The snapped data point, or `null` when the crosshair is inactive.
@@ -67,13 +68,14 @@ fun <T> ChartCrosshairHost(
     state: CrosshairState?,
     modifier: Modifier = Modifier,
 ) {
-    if (item == null || state == null) {
+    val config = crosshair.config.orThemeCrosshair()
+    if (item == null || state == null || !config.showLabel) {
         return
     }
     ChartCrosshairOverlay(
         item = item,
         state = state,
-        config = crosshair.config.orThemeCrosshair().tooltipConfig,
+        config = config.tooltipConfig,
         modifier = modifier,
     ) { data ->
         RenderCrosshairLabel(
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/line/AreaChart.kt` (modified, +0/-1)
```diff
@@ -224,7 +224,6 @@ fun AreaChart(
                         chartContext = chartContext,
                         textMeasurer = textMeasurer,
                         chartColor = color,
-                        drawLabel = false,
                     )
                 }
             }
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/line/LineChart.kt` (modified, +0/-3)
```diff
@@ -255,7 +255,6 @@ fun LineChart(
                 textMeasurer = textMeasurer,
                 color = color,
                 drawBubble = tooltip.isCanvas(),
-                drawCrosshairLabel = false,
                 tooltipConfig = styling.tooltipConfig,
             )
         }
@@ -312,7 +311,6 @@ private fun DrawScope.drawLineCrosshairAndTooltip(
     textMeasurer: TextMeasurer,
     color: ChartyColor,
     drawBubble: Boolean,
-    drawCrosshairLabel: Boolean,
     tooltipConfig: TooltipConfig,
 ) {
     crosshairState?.let { resolvedState ->
@@ -323,7 +321,6 @@ private fun DrawScope.drawLineCrosshairAndTooltip(
                 chartContext = chartContext,
                 textMeasurer = textMeasurer,
                 chartColor = color,
-                drawLabel = drawCrosshairLabel,
             )
         }
     }
```

---

### Incident Patch 6: `fdc0f05e` (2026-08-14)
**Commit Message**: [Fix] Format bar data labels the way every other label in the library is formatted

The default `dataLabelFormatter` re-implemented integer-versus-decimal formatting inline, ending in a
raw `value.toString()`. That is the exact construct that has produced cross-platform bugs in this
codebase repeatedly: a `Float` prints differently on JS and Wasm than on JVM and Android, which is why
`toChartLabel` exists and why ten other formatters were routed through it.

It now uses `toChartLabel`, so a bar's label is formatted by the same rule as its axis.

This does change output in one case, deliberately: a value with more than one decimal place used to
print in full — `37.86205291748047` for anything that came out of arithmetic — and now rounds to one
place. That is the behaviour every other label already had, and the reason stated in `toChartLabel`'s
own documentation is that a full binary expansion is wide enough to overflow the plot it sits in.
Callers wanting more precision pass their own formatter, which is unchanged.

No documentation image moves, since those datasets are whole numbers.

Stats: 1 file changed

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/bar/config/BarChartConfig.kt` (modified, +1/-8)
```diff
@@ -100,14 +100,7 @@ data class BarChartConfig(
     },
     val crosshairConfig: ChartCrosshairConfig? = null,
     val showDataLabels: Boolean = false,
-    val dataLabelFormatter: (BarData) -> String = { barData ->
-        val v = barData.value
-        if (v == v.toLong().toFloat()) {
-            v.toLong().toString()
-        } else {
-            v.toString()
-        }
-    },
+    val dataLabelFormatter: (BarData) -> String = { barData -> barData.value.toChartLabel() },
     val dataLabelStyle: TextStyle =
         TextStyle(
             fontSize = 10.sp,
```

---

### Incident Patch 7: `72765bf2` (2026-08-14)
**Commit Message**: [Fix] Give horizontal charts the measured axis gutters vertical ones already had

Issue #161 reported a y-axis value of 999999 rendering as "9999". The measuring fix that went into
3.0.0 only reached vertical charts: drawHorizontalChartAxes computed its own bounds from three private
constants and never saw the gutters the scaffold measured. A hundred pixels for the category names
whatever they said, twenty on the right whatever the largest number was — so a long category ran under
the plot, and the final value label, which is centred on the right-hand edge, had its tail sliced off
by the canvas. A reporter looking at a horizontal chart today would have filed #161 again, verbatim.

Both gutters are now measured: the left against the category names, the right against half the widest
value label, since that is exactly how far the last one overhangs.

Labels are also thinned when they would collide. Every tick was labelled regardless of how wide the
numbers were, so a seven-figure axis printed six overlapping labels into a smear that reads as broken
rendering rather than as a crowded axis. Only labels are skipped — the grid keeps its original
density, and the last tick is always labell

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/common/ChartScaffold.kt` (modified, +85/-27)
```diff
@@ -13,17 +13,20 @@ import androidx.compose.ui.graphics.drawscope.clipRect
 import androidx.compose.ui.platform.LocalDensity
 import androidx.compose.ui.semantics.contentDescription
 import androidx.compose.ui.semantics.semantics
+import androidx.compose.ui.text.TextMeasurer
 import androidx.compose.ui.text.rememberTextMeasurer
 import androidx.compose.ui.unit.dp
 import com.himanshoe.charty.common.accessibility.ChartAccessibility
 import com.himanshoe.charty.common.accessibility.ChartDataPointSemantics
+import com.himanshoe.charty.common.axis.AXIS_LABEL_MARGIN
 import com.himanshoe.charty.common.axis.AxisConfig
 import com.himanshoe.charty.common.axis.DrawAxisAndLabels
 import com.himanshoe.charty.common.axis.measureAxisGutter
+import com.himanshoe.charty.common.axis.measureMaxLabelWidth
+import com.himanshoe.charty.common.axis.measureTrailingLabelOverhang
 import com.himanshoe.charty.common.config.ChartScaffoldConfig
 import com.himanshoe.charty.common.theme.ChartyThemeDefaults
 
-private const val HORIZONTAL_LEFT_PADDING_WITH_LABELS = 100f
 private const val LEFT_PADDING_WITHOUT_LABELS = 20f
 private const val RIGHT_PADDING = 20f
 private const val TOP_PADDING = 20f
@@ -74,34 +77,24 @@ fun ChartScaffold(
         }
     val textMeasurer = rememberTextMeasurer()
     val leftPadding =
-        remember(yAxisConfig, config.showLabels, config.labelTextStyle, orientation) {
-            when {
-                orientation == ChartOrientation.HORIZONTAL ->
-                    if (config.showLabels) {
-                        HORIZONTAL_LEFT_PADDING_WITH_LABELS
-                    } else {
-                        LEFT_PADDING_WITHOUT_LABELS
-                    }
-
-                else ->
-                    measureAxisGutter(
-                        axisConfig = yAxisConfig,
-                        textMeasurer = textMeasurer,
-                        labelStyle = config.labelTextStyle,
-                        showLabels = config.showLabels,
-                    )
-            }
+        remember(yAxisConfig, xLabels, config.showLabels, config.labelTextStyle, orientation) {
+            measureLeftGutter(
+                orientation = orientation,
+                xLabels = xLabels,
+                yAxisConfig = yAxisConfig,
+                config = config,
+                textMeasurer = textMeasurer,
+            )
         }
     val rightPadding =
-        remember(secondaryYAxisConfig, config.showLabels, config.labelTextStyle) {
-            secondaryYAxisConfig?.let {
-                measureAxisGutter(
-                    axisConfig = it,
-                    textMeasurer = textMeasurer,
-                    labelStyle = config.labelTextStyle,
-                    showLabels = config.showLabels,
-                )
-            } ?: RIGHT_PADDING
+        remember(secondaryYAxisConfig, yAxisConfig, config.showLabels, config.labelTextStyle, orientation) {
+            measureRightGutter(
+                orientation = orientation,
+                secondaryYAxisConfig = secondaryYAxisConfig,
+                yAxisConfig = yAxisConfig,
+                config = config,
+                textMeasurer = textMeasurer,
+            )
         }
 
     Box(modifier = modifier.then(accessibilityModifier)) {
@@ -187,3 +180,68 @@ private fun DrawScope.clipToPlot(
         clipRect(left = chartContext.left, top = 0f, right = chartContext.right, bottom = size.height) { block() }
     }
 }
+
+/**
+ * The gutter on the left of the plot.
+ *
+ * A horizontal chart carries its categories there, so it is measured against those names; every other
+ * orientation carries the value axis, so it is measured against the widest tick label.
+ */
+private fun measureLeftGutter(
+    orientation: ChartOrientation,
+    xLabels: List<String>,
+    yAxisConfig: AxisConfig,
+    config: ChartScaffoldConfig,
+    textMeasurer: TextMeasurer,
+): Float =
+    if (orientation == ChartOrientation.HORIZONTAL) {
+        if (config.showLabels) {
+            (
+                measureMaxLabelWidth(
+                    labels = xLabels,
+                    textMeasurer = textMeasurer,
+                    labelStyle = config.labelTextStyle,
+                ) + AXIS_LABEL_MARGIN * 2f
+            ).coerceAtLeast(LEFT_PADDING_WITHOUT_LABELS)
+        } else {
+            LEFT_PADDING_WITHOUT_LABELS
+        }
+    } else {
+        measureAxisGutter(
+            axisConfig = yAxisConfig,
+            textMeasurer = textMeasurer,
+            labelStyle = config.labelTextStyle,
+            showLabels = config.showLabels,
+        )
+    }
+
+/**
+ * The gutter on the right of the plot: a second value axis if there is one, otherwise room for the
+ * overhang of the last label on a horizontal chart, otherwise a plain margin.
+ */
+private fun measureRightGutter(
+    orientation: ChartOrientation,
+    secondaryYAxisConfig: AxisConfig?,
+    yAxisConfig: AxisConfig,
+    config: ChartScaffoldConfig,
+    textMeasurer: TextMeasur
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/common/axis/AxisMeasure.kt` (modified, +86/-0)
```diff
@@ -58,3 +58,89 @@ internal fun measureAxisGutter(
         measureMaxAxisLabelWidth(axisConfig = axisConfig, textMeasurer = textMeasurer, labelStyle = labelStyle)
     return labelWidth + AXIS_LABEL_MARGIN * 2f
 }
+
+/**
+ * The width of the widest of [labels], for sizing a gutter that holds category names rather than
+ * numbers.
+ *
+ * A horizontal chart puts its categories down the left-hand side, where a long one — "September",
+ * "Engineering" — is as wide as several numbers and just as capable of running off the edge.
+ */
+internal fun measureMaxLabelWidth(
+    labels: List<String>,
+    textMeasurer: TextMeasurer,
+    labelStyle: TextStyle,
+): Float {
+    var maxWidth = 0f
+    labels.forEach { label ->
+        val width =
+            textMeasurer
+                .measure(text = AnnotatedString(label), style = labelStyle)
+                .size.width
+                .toFloat()
+        if (width > maxWidth) {
+            maxWidth = width
+        }
+    }
+    return maxWidth
+}
+
+/**
+ * How far the last tick label on a horizontal value axis reaches past the end of the plot.
+ *
+ * Bottom-axis labels are centred on their tick, so the final one — the largest number, and therefore
+ * usually the widest — hangs half its width beyond the plot's right edge. With only a fixed margin
+ * there it was sliced off by the canvas, which is what made a seven-figure value read as a six-figure
+ * one.
+ */
+internal fun measureTrailingLabelOverhang(
+    axisConfig: AxisConfig,
+    textMeasurer: TextMeasurer,
+    labelStyle: TextStyle,
+    showLabels: Boolean,
+): Float {
+    if (!showLabels) {
+        return AXIS_LABEL_MARGIN
+    }
+    val widest =
+        measureMaxAxisLabelWidth(axisConfig = axisConfig, textMeasurer = textMeasurer, labelStyle = labelStyle)
+    return (widest / 2f + AXIS_LABEL_MARGIN).coerceAtLeast(AXIS_LABEL_MARGIN)
+}
+
+/** Space kept between two neighbouring axis labels, in pixels, so they read as separate numbers. */
+private const val LABEL_GAP = 12f
+
+/**
+ * How many ticks to advance between labels so that neighbouring labels cannot overlap.
+ *
+ * Returns 1 when every tick fits. Wider labels — long numbers, or a narrow chart — return 2, 3 and so
+ * on, which thins the labels while leaving the grid alone.
+ */
+internal fun labelStrideFor(
+    axisConfig: AxisConfig,
+    steps: Int,
+    axisWidth: Float,
+    textMeasurer: TextMeasurer,
+    labelStyle: TextStyle,
+): Int {
+    val spacing =
+        if (steps > 0) {
+            axisWidth / steps
+        } else {
+            0f
+        }
+    if (spacing <= 0f) {
+        return 1
+    }
+    val needed =
+        measureMaxAxisLabelWidth(
+            axisConfig = axisConfig,
+            textMeasurer = textMeasurer,
+            labelStyle = labelStyle,
+        ) + LABEL_GAP
+    var stride = 1
+    while (stride < steps && spacing * stride < needed) {
+        stride++
+    }
+    return stride
+}
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/common/axis/DrawAxisAndLabels.kt` (modified, +2/-0)
```diff
@@ -65,6 +65,8 @@ internal fun DrawAxisAndLabels(
                     textMeasurer = textMeasurer,
                     labelStyle = labelStyle,
                     leftLabelRotation = leftLabelRotation,
+                    leftPadding = leftPadding,
+                    rightPadding = rightPadding,
                     streamingLayout = streamingLayout,
                 )
         }
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/common/ext/DrawScopeExtensions.kt` (modified, +92/-36)
```diff
@@ -12,15 +12,13 @@ import com.himanshoe.charty.color.toBrush
 import com.himanshoe.charty.common.StreamingLayout
 import com.himanshoe.charty.common.axis.AxisConfig
 import com.himanshoe.charty.common.axis.LabelRotation
+import com.himanshoe.charty.common.axis.labelStrideFor
 import com.himanshoe.charty.common.config.ChartScaffoldConfig
 
 private const val VERTICAL_CHART_TOP_PADDING = 20f
 private const val VERTICAL_CHART_BOTTOM_PADDING_WITH_LABELS = 50f
 private const val VERTICAL_CHART_BOTTOM_PADDING_WITHOUT_LABELS = 20f
 
-private const val HORIZONTAL_CHART_LEFT_PADDING_WITH_LABELS = 100f
-private const val HORIZONTAL_CHART_LEFT_PADDING_WITHOUT_LABELS = 20f
-private const val HORIZONTAL_CHART_RIGHT_PADDING = 20f
 private const val HORIZONTAL_CHART_TOP_PADDING = 20f
 private const val HORIZONTAL_CHART_BOTTOM_PADDING_WITH_LABELS = 50f
 private const val HORIZONTAL_CHART_BOTTOM_PADDING_WITHOUT_LABELS = 20f
@@ -248,17 +246,20 @@ private fun DrawScope.drawSecondaryVerticalAxis(
     }
 }
 
+/*
+ * The gutters arrive measured, as they do for a vertical chart.
+ *
+ * They used to be constants here — a hundred pixels for the category names whatever they said, and
+ * twenty on the right whatever the largest number was. A category longer than the allowance ran under
+ * the plot, and the final value label, which is centred on the right-hand edge, had its tail sliced
+ * off by the canvas. That is what made a seven-figure value read as a six-figure one.
+ */
 private fun calculateHorizontalChartBounds(
     size: androidx.compose.ui.geometry.Size,
     showLabels: Boolean,
+    leftPadding: Float,
+    rightPadding: Float,
 ): ChartBounds {
-    val leftPadding =
-        if (showLabels) {
-            HORIZONTAL_CHART_LEFT_PADDING_WITH_LABELS
-        } else {
-            HORIZONTAL_CHART_LEFT_PADDING_WITHOUT_LABELS
-        }
-    val rightPadding = HORIZONTAL_CHART_RIGHT_PADDING
     val topPadding = HORIZONTAL_CHART_TOP_PADDING
     val bottomPadding =
         if (showLabels) {
@@ -309,9 +310,17 @@ internal fun DrawScope.drawHorizontalChartAxes(
     textMeasurer: TextMeasurer,
     labelStyle: TextStyle,
     leftLabelRotation: LabelRotation,
+    leftPadding: Float,
+    rightPadding: Float,
     streamingLayout: StreamingLayout? = null,
 ) {
-    val bounds = calculateHorizontalChartBounds(size = size, showLabels = config.showLabels)
+    val bounds =
+        calculateHorizontalChartBounds(
+            size = size,
+            showLabels = config.showLabels,
+            leftPadding = leftPadding,
+            rightPadding = rightPadding,
+        )
     val baselineX = calculateVerticalAxisPosition(yAxisConfig = yAxisConfig, chartBounds = bounds)
     val valueRange = yAxisConfig.maxValue - yAxisConfig.minValue
     val steps = yAxisConfig.steps.coerceAtLeast(MIN_STEPS)
@@ -332,32 +341,32 @@ internal fun DrawScope.drawHorizontalChartAxes(
         )
     }
 
-    for (i in 0..steps) {
-        val value = yAxisConfig.minValue + valueRange * (i.toFloat() / steps)
-        val normalized = (value - yAxisConfig.minValue) / valueRange
-        val x = bounds.left + (normalized * bounds.width)
-
-        if (config.showGrid && i > 0 && i < steps) {
-            drawLine(
-                brush = config.gridColor.toBrush(),
-                start = Offset(x, bounds.top),
-                end = Offset(x, bounds.bottom),
-                strokeWidth = config.gridThickness,
-            )
-        }
+    /*
+     * How many ticks to skip between labels.
+     *
+     * Every tick used to be labelled regardless of how wide the numbers were, so a seven-figure axis
+     * printed six overlapping labels into an unreadable smear — which reads as broken rendering
+     * rather than as a crowded axis. Labelling every nth tick keeps the grid as dense as it was and
+     * prints only what can be read. The grid lines themselves are untouched.
+     */
+    val labelStride =
+        labelStrideFor(
+            axisConfig = yAxisConfig,
+            steps = steps,
+            axisWidth = bounds.width,
+            textMeasurer = textMeasurer,
+            labelStyle = labelStyle,
+        )
 
-        if (config.showLabels) {
-            val textLayout = textMeasurer.measure(AnnotatedString(yAxisConfig.valueFormatter(value)), labelStyle)
-            drawText(
-                textLayoutResult = textLayout,
-                topLeft =
-                    Offset(
-                        x - textLayout.size.width / CENTER_DIVISOR,
-                        bounds.bottom + LABEL_OFFSET,
-                    ),
-            )
-        }
-    }
+    drawHorizontalValueAxis(
+        yAxisConfig = yAxisConfig,
+        config = config,
+        textMeasurer = textMeasurer,
+        labelStyle = labelStyle,
+        bounds = bounds,
+        steps = steps,
+        labelStride = labelStride,
+    )
 
     if (config.showLabels && xLabels.isNotEmpty()) {
         val barHeight = bounds.height / xLabels.size
@@ -394,3 +4
```

---

### Incident Patch 8: `ba6b69e7` (2026-08-14)
**Commit Message**: [Fix] Make zoom and pan reachable on a desktop, and stop them eating taps

Charts have had pinch-to-zoom, drag-to-pan and a fling for a while, and issue #154 asked for scrolling
as though none of it existed. Reading it back, the reporter was effectively right: the feature was
there and could not be got at.

A pinch needs two touch points. On the JVM and in a browser with a mouse there are none, so the
window could never be narrowed — and panning is clamped to whatever sits off-screen, which at full
width is nothing at all. A chart handed a viewport therefore did nothing whatsoever on the two
targets most likely to be given one. Wheel and trackpad now zoom, and a horizontal wheel pans.

The gesture also claimed every pointer change, including a stationary tap. That cancelled the tap
detector underneath it, so supplying a viewport silently cost the chart its tooltip: the zoom worked
and the tap quietly stopped. It now only consumes when the gesture actually moved the viewport.

rememberViewPortState takes an initialVisibleFraction. Left at the default a chart shows everything,
and a chart showing everything cannot be panned, so two hundred points arrive as two hundred slivers
and sta

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/common/gesture/ChartGestureModifiers.kt` (modified, +61/-18)
```diff
@@ -11,6 +11,7 @@ import androidx.compose.foundation.gestures.detectTapGestures
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.geometry.Offset
 import androidx.compose.ui.geometry.Rect
+import androidx.compose.ui.input.pointer.PointerEventType
 import androidx.compose.ui.input.pointer.pointerInput
 import androidx.compose.ui.input.pointer.positionChanged
 import androidx.compose.ui.input.pointer.util.VelocityTracker
@@ -333,25 +334,67 @@ fun <D> Modifier.chartBrushSelectionHandler(
  * @param viewPortState The shared viewport state the chart reads each frame.
  */
 fun Modifier.chartZoomAndPan(viewPortState: ViewPortState): Modifier =
-    this.pointerInput(viewPortState) {
-        awaitEachGesture {
-            viewPortState.cancelFling()
-            val velocityTracker = VelocityTracker()
-            awaitFirstDown(requireUnconsumed = false)
-            do {
+    this
+        .pointerInput(viewPortState) {
+            awaitEachGesture {
+                viewPortState.cancelFling()
+                val velocityTracker = VelocityTracker()
+                awaitFirstDown(requireUnconsumed = false)
+                do {
+                    val event = awaitPointerEvent()
+                    val zoom = event.calculateZoom()
+                    val pan = event.calculatePan()
+                    val centroid = event.calculateCentroid(useCurrent = true)
+                    val chartWidth = viewPortState.chartWidth.coerceAtLeast(1f)
+                    val focusFraction = ((centroid.x - viewPortState.chartLeft) / chartWidth).coerceIn(0f, 1f)
+                    viewPortState.zoom(focusFraction, zoom)
+                    viewPortState.pan(-pan.x / chartWidth * viewPortState.visibleFraction)
+                    event.changes.fastFirstOrNull { true }?.let { change ->
+                        velocityTracker.addPosition(change.uptimeMillis, change.position)
+                    }
+                    // Only claim the event when the gesture actually moved the viewport. Consuming
+                    // unconditionally swallowed stationary taps too, which cancelled the tap
+                    // detector underneath and cost the chart its tooltip the moment a viewport was
+                    // supplied — the zoom worked and the tap silently stopped.
+                    if (zoom != 1f || pan != Offset.Zero) {
+                        event.changes.fastForEach { it.consume() }
+                    }
+                } while (event.changes.fastAny { it.pressed })
+                viewPortState.fling(-velocityTracker.calculateVelocity().x)
+            }
+        }.pointerInput(viewPortState) {
+            /*
+             * Wheel and trackpad, which is the only way to zoom on a desktop or a laptop.
+             *
+             * Zooming was reachable by pinch alone, and pinching needs two touch points. On the JVM
+             * and in a browser with a mouse there are none, so the viewport could never be narrowed
+             * — and panning is clamped to the part of the series that is off-screen, which at full
+             * width is nothing. The result was that a chart given a viewport did nothing at all on
+             * the two targets most likely to have one.
+             */
+            awaitEachGesture {
                 val event = awaitPointerEvent()
-                val zoom = event.calculateZoom()
-                val pan = event.calculatePan()
-                val centroid = event.calculateCentroid(useCurrent = true)
+                if (event.type != PointerEventType.Scroll) {
+                    return@awaitEachGesture
+                }
+                viewPortState.cancelFling()
                 val chartWidth = viewPortState.chartWidth.coerceAtLeast(1f)
-                val focusFraction = ((centroid.x - viewPortState.chartLeft) / chartWidth).coerceIn(0f, 1f)
-                viewPortState.zoom(focusFraction, zoom)
-                viewPortState.pan(-pan.x / chartWidth * viewPortState.visibleFraction)
-                event.changes.fastFirstOrNull { true }?.let { change ->
-                    velocityTracker.addPosition(change.uptimeMillis, change.position)
+                event.changes.fastForEach { change ->
+                    val scroll = change.scrollDelta
+                    if (scroll.y != 0f) {
+                        val focus = ((change.position.x - viewPortState.chartLeft) / chartWidth).coerceIn(0f, 1f)
+                        viewPortState.zoom(focus, 1f - scroll.y * WHEEL_ZOOM_SENSITIVITY)
+                    }
+                    if (scroll.x != 0f) {
+                        viewPortState.pan(scroll.x * WHEEL_PAN_SENSITIVITY * viewPortState.visibleFraction)
+                    }
+                    change.consume()
                 }
-                event.changes.fastForEach { it.consume() }
-            } while (event.changes.fastAny { it.pressed })
-            viewPortState.fling(-velocityTracker.calculateVelocity().x)
+            
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/common/viewport/ViewPortState.kt` (modified, +16/-6)
```diff
@@ -32,13 +32,15 @@ private const val SCROLL_ANIMATION_MILLIS = 600
  *
  * Use [rememberViewPortState] to create an instance bound to the composition lifecycle.
  */
-class ViewPortState : PlotBoundsSource {
+class ViewPortState(
+    initialVisibleFraction: Float = 1f,
+) : PlotBoundsSource {
     /** Where the visible window starts, as a fraction of the whole series. `0f` is the first point. */
     var startFraction by mutableFloatStateOf(0f)
         private set
 
     /** Where the visible window ends, as a fraction of the whole series. `1f` is the last point. */
-    var endFraction by mutableFloatStateOf(1f)
+    var endFraction by mutableFloatStateOf(initialVisibleFraction.coerceIn(MIN_VISIBLE_FRACTION, 1f))
         private set
 
     /** Pixel x-coordinate of the chart's left edge — set by ChartScaffold each draw. */
@@ -217,11 +219,19 @@ class ViewPortState : PlotBoundsSource {
  *
  * Pass the returned state to a chart's `viewPortState` parameter inside
  * [com.himanshoe.charty.common.config.ChartInteractionConfig] to enable pinch-to-zoom,
- * drag-to-pan, and inertial fling. Call [ViewPortState.reset] to restore the full-data
- * view at any time.
+ * wheel-zoom, drag-to-pan, and inertial fling. Call [ViewPortState.reset] to restore the
+ * full-data view at any time.
+ *
+ * @param initialVisibleFraction How much of the series to show at first, as a fraction of the whole.
+ *   The default of `1f` shows everything, and a chart showing everything cannot be panned — there is
+ *   nothing off-screen to pan to — so a series of two hundred points opens as two hundred slivers
+ *   and stays that way until someone thinks to pinch it. Opening at `0.1f` shows the first tenth and
+ *   is draggable immediately, which is what a long series usually wants.
  */
 @Composable
-fun rememberViewPortState(): ViewPortState {
+fun rememberViewPortState(initialVisibleFraction: Float = 1f): ViewPortState {
     val scope = rememberCoroutineScope()
-    return remember { ViewPortState() }.also { it.bindCoroutineScope(scope) }
+    return remember(initialVisibleFraction) {
+        ViewPortState(initialVisibleFraction = initialVisibleFraction)
+    }.also { state -> state.bindCoroutineScope(scope) }
 }
```

---

### Incident Patch 9: `aec27fbe` (2026-08-14)
**Commit Message**: [Fix] Let the web dev server take the port it is given

The dev server hardcoded webpack's default of 8080, which is a busy port on any machine running more
than one thing — it collided with an unrelated node process and refused to start. It now reads PORT
from the environment when one is set, which is how the preview harness hands over a free port, and
falls back to 8080 so a plain `./gradlew jsBrowserDevelopmentRun` behaves exactly as before. The
launch configuration asks for an assigned port rather than insisting on 8080; nothing here needs a
fixed one, since there are no callbacks or origins pinned to it.

Stats: 2 files changed

**File**: `.claude/launch.json` (modified, +2/-1)
```diff
@@ -5,7 +5,8 @@
       "name": "web-playground",
       "runtimeExecutable": "./gradlew",
       "runtimeArgs": ["-q", ":composeApp:jsBrowserDevelopmentRun", "--continuous"],
-      "port": 8080
+      "port": 8080,
+      "autoPort": true
     }
   ]
 }
```

**File**: `composeApp/build.gradle.kts` (modified, +17/-1)
```diff
@@ -1,6 +1,7 @@
 import org.jetbrains.compose.desktop.application.dsl.TargetFormat
 import org.jetbrains.kotlin.gradle.ExperimentalWasmDsl
 import org.jetbrains.kotlin.gradle.dsl.JvmTarget
+import org.jetbrains.kotlin.gradle.targets.js.webpack.KotlinWebpackConfig
 
 plugins {
     alias(libs.plugins.kotlinMultiplatform)
@@ -40,7 +41,22 @@ kotlin {
     jvm()
 
     js {
-        browser()
+        browser {
+            /*
+             * The dev server takes its port from the PORT environment variable when one is set.
+             *
+             * Webpack's default is 8080, which is a busy port on any machine running more than one
+             * thing; the preview harness assigns a free port and publishes it as PORT, and without
+             * this the server ignored that and collided. Falling back to 8080 keeps a plain
+             * `./gradlew jsBrowserDevelopmentRun` behaving exactly as it always has.
+             */
+            commonWebpackConfig {
+                devServer =
+                    (devServer ?: KotlinWebpackConfig.DevServer()).copy(
+                        port = System.getenv("PORT")?.toIntOrNull() ?: 8080,
+                    )
+            }
+        }
         binaries.executable()
     }
 
```

---

### Incident Patch 10: `1ac5e63f` (2026-08-14)
**Commit Message**: [Fix] Make the chart's axis and labels visible in dark mode

The axis colour, the grid colour and the label colour were fixed at black and light grey. On a dark
background the axis line disappeared and the labels went entirely — ChartScaffoldConfig's own default
label style is black text, and the playground never set one, so every value down the y-axis and every
index along the x-axis was black on near-black.

All three now follow the theme when nobody has picked otherwise, and a colour chosen in the panel
still wins: it is only the untouched state that adapts. The grid sits well below the axis in weight
in both themes, so it reads as a guide rather than as a second set of lines.

This surfaced from wiring the shared scaffold config into more screens — the defaults had always been
wrong for dark, but until now most screens never passed them.

Stats: 2 files changed

**File**: `composeApp/src/webMain/kotlin/com/himanshoe/sample/PlaygroundApp.kt` (modified, +1/-0)
```diff
@@ -106,6 +106,7 @@ fun WebApp() {
     val navigation = rememberPlaygroundNavigation()
     val family = navigation.family
     val shared = remember { PlaygroundSharedState() }
+    shared.dark = dark
 
     MaterialTheme(
         colorScheme =
```

**File**: `composeApp/src/webMain/kotlin/com/himanshoe/sample/PlaygroundSharedState.kt` (modified, +50/-8)
```diff
@@ -44,8 +44,16 @@ internal class PlaygroundSharedState {
     var showAxis by mutableStateOf(true)
     var showGrid by mutableStateOf(true)
     var showLabels by mutableStateOf(true)
-    var axisColor by mutableStateOf(Color.Black)
-    var gridColor by mutableStateOf(Color.LightGray)
+
+    /*
+     * Null means "whatever suits the current theme". The axis, grid and labels were fixed at black
+     * and light grey, which is invisible on a dark background — the labels vanished entirely, since
+     * ChartScaffoldConfig's own default label style is black text. A colour picked in the panel still
+     * wins; it is only the untouched state that follows the theme.
+     */
+    var dark by mutableStateOf(false)
+    var axisColor: Color? by mutableStateOf(null)
+    var gridColor: Color? by mutableStateOf(null)
     var axisThickness by mutableIntStateOf(2)
     var gridThickness by mutableIntStateOf(1)
     var rotateLabels by mutableStateOf(false)
@@ -72,14 +80,40 @@ internal class PlaygroundSharedState {
     var themePrimary by mutableStateOf(playgroundPalette[0])
 
     /** The scaffold config the controls currently describe. */
+
+    /** The axis colour when none has been picked: ink on paper, either way round. */
+    fun defaultAxisColor(): Color =
+        if (dark) {
+            Color(0xFFE6E6EA)
+        } else {
+            Color.Black
+        }
+
+    /** The grid colour when none has been picked, kept well below the axis in weight. */
+    fun defaultGridColor(): Color =
+        if (dark) {
+            Color(0xFF3A3A42)
+        } else {
+            Color.LightGray
+        }
+
+    /** Axis labels, which have no picker and so always follow the theme. */
+    fun defaultLabelColor(): Color =
+        if (dark) {
+            Color(0xFFE6E6EA)
+        } else {
+            Color.Black
+        }
+
     val scaffoldConfig: ChartScaffoldConfig
         get() =
             ChartScaffoldConfig(
                 showAxis = showAxis,
                 showGrid = showGrid,
                 showLabels = showLabels,
-                axisColor = ChartyColor.Solid(axisColor),
-                gridColor = ChartyColor.Solid(gridColor),
+                axisColor = ChartyColor.Solid(axisColor ?: defaultAxisColor()),
+                gridColor = ChartyColor.Solid(gridColor ?: defaultGridColor()),
+                labelTextColor = ChartyColor.Solid(defaultLabelColor()),
                 axisThickness = axisThickness.toFloat(),
                 gridThickness = gridThickness.toFloat(),
                 leftLabelRotation =
@@ -220,8 +254,8 @@ internal class PlaygroundSharedState {
         showAxis = true
         showGrid = true
         showLabels = true
-        axisColor = Color.Black
-        gridColor = Color.LightGray
+        axisColor = null
+        gridColor = null
         axisThickness = 2
         gridThickness = 1
         rotateLabels = false
@@ -282,8 +316,16 @@ internal fun AxisAndGridControls(state: PlaygroundSharedState) {
         valueRange = 0..8,
         onValueChange = { state.gridThickness = it },
     )
-    ColorRow(label = "Axis colour", selected = state.axisColor, onSelect = { state.axisColor = it })
-    ColorRow(label = "Grid colour", selected = state.gridColor, onSelect = { state.gridColor = it })
+    ColorRow(
+        label = "Axis colour",
+        selected = state.axisColor ?: state.defaultAxisColor(),
+        onSelect = { state.axisColor = it },
+    )
+    ColorRow(
+        label = "Grid colour",
+        selected = state.gridColor ?: state.defaultGridColor(),
+        onSelect = { state.gridColor = it },
+    )
 }
 
 /** Controls for the shared [TooltipConfig], which almost every chart draws its tap bubble with. */
```

---

### Incident Patch 11: `c2712e88` (2026-08-14)
**Commit Message**: [Fix] Make every playground control reach the chart beside it

The three screens I had left — synced crosshair, the streaming dashboard, and streaming itself — each
build an interaction config carrying something only they know about: a streaming state, a viewport, a
jump-to-latest slot. They built it and stopped, so the shared switches next to them moved and nothing
happened. A small helper now lays the shared settings over whatever config a screen has already made,
which keeps what the screen needs and adds back what the panel promises. All three also pass the
shared scaffold config, so axis and grid — grid thickness among them — work there now.

The tooltip section is restored rather than hidden, and it works. Tooltip styling lives on each
chart's own config, so a shared panel has nowhere to send it — but a config left unset resolves
against the ambient theme, and the theme carries every one of those values. Folding the five controls
into the theme the playground already provides reaches all thirty-five charts at once, and does it
the way the library intends instead of threading an argument through thirty-five call sites.

The calendar joins the matrix heatmap in declaring itself

**File**: `composeApp/src/webMain/kotlin/com/himanshoe/sample/Playground.kt` (modified, +1/-4)
```diff
@@ -246,10 +246,7 @@ private fun ControlPanel(
             if (cartesian) {
                 InteractionControls(state = shared)
                 AxisAndGridControls(state = shared)
-                // The tooltip style section is not shown: nothing consumes what it produces. Every
-                // chart carries its tooltip styling on its own config, so a single shared panel has
-                // nowhere to send it, and it sat here adjusting five values that reached no chart.
-                // Restoring it means wiring playgroundTooltipConfig() into each chart's own config.
+                TooltipStyleControls(state = shared)
             }
             ThemeControls(state = shared)
         }
```

**File**: `composeApp/src/webMain/kotlin/com/himanshoe/sample/PlaygroundApp.kt` (modified, +1/-7)
```diff
@@ -49,7 +49,6 @@ import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.text.font.FontWeight
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.unit.sp
-import com.himanshoe.charty.common.theme.ChartyTheme
 import com.himanshoe.charty.common.theme.ChartyThemeProvider
 
 /** When `true`, playground charts play their entry animation; when `false` they render instantly. */
@@ -118,12 +117,7 @@ fun WebApp() {
     ) {
         ChartyThemeProvider(
             theme =
-                shared.theme(dark = dark)
-                    ?: if (dark) {
-                        ChartyTheme.dark()
-                    } else {
-                        ChartyTheme.light()
-                    },
+                shared.theme(dark = dark),
         ) {
             Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                 Column(modifier = Modifier.fillMaxSize()) {
```

**File**: `composeApp/src/webMain/kotlin/com/himanshoe/sample/PlaygroundChartsExtra.kt` (modified, +3/-0)
```diff
@@ -946,6 +946,9 @@ internal fun CalendarPlayground() {
         )
         """.trimIndent()
     PlaygroundScaffold(
+        // The calendar draws no ChartScaffold and takes neither a scaffold nor an interaction config,
+        // so the shared axis, grid and interaction sections would be controls that reach nothing.
+        cartesian = false,
         code = code,
         chart = {
             CalendarHeatmapChart(
```

**File**: `composeApp/src/webMain/kotlin/com/himanshoe/sample/PlaygroundSharedState.kt` (modified, +77/-15)
```diff
@@ -11,6 +11,7 @@
 
 package com.himanshoe.sample
 
+import androidx.compose.foundation.shape.RoundedCornerShape
 import androidx.compose.material3.MaterialTheme
 import androidx.compose.material3.Text
 import androidx.compose.runtime.Composable
@@ -106,21 +107,59 @@ internal class PlaygroundSharedState {
             )
 
     /** The theme to provide around the chart, or `null` to leave Charty's own defaults in place. */
-    fun theme(dark: Boolean): ChartyTheme? =
-        if (!themed) {
-            null
-        } else {
-            val base =
-                if (dark) {
-                    ChartyTheme.dark()
-                } else {
-                    ChartyTheme.light()
-                }
-            base.copy(
-                primaryColor = ChartyColor.Solid(themePrimary),
-                palette = playgroundPalette.map { hue -> ChartyColor.Solid(hue) },
-            )
-        }
+    fun theme(dark: Boolean): ChartyTheme {
+        val base =
+            if (dark) {
+                ChartyTheme.dark()
+            } else {
+                ChartyTheme.light()
+            }
+        val palette =
+            if (themed) {
+                base.copy(
+                    primaryColor = ChartyColor.Solid(themePrimary),
+                    palette = playgroundPalette.map { hue -> ChartyColor.Solid(hue) },
+                )
+            } else {
+                base
+            }
+        return palette.withTooltipStyle(this)
+    }
+
+    /**
+     * Folds the tooltip controls into the theme, which is how they reach a chart at all.
+     *
+     * Tooltip styling lives on each chart's own config, so a shared panel has nowhere to send it —
+     * which is why these five controls used to adjust nothing. But a config left unset resolves
+     * against the ambient theme, and the theme carries every one of these values. Putting them here
+     * reaches all thirty-five charts at once, and does it the way the library intends rather than by
+     * threading an argument through thirty-five call sites.
+     */
+    private fun ChartyTheme.withTooltipStyle(state: PlaygroundSharedState): ChartyTheme =
+        copy(
+            componentColors = componentColors.copy(tooltipBackground = ChartyColor.Solid(state.tooltipBackground)),
+            shapes =
+                shapes.copy(
+                    tooltip = RoundedCornerShape(state.tooltipCorner.dp),
+                    tooltipCornerRadius = state.tooltipCorner.dp,
+                ),
+            dimensions =
+                dimensions.copy(
+                    tooltipElevation = state.tooltipElevation.dp,
+                    tooltipBorderWidth =
+                        if (state.tooltipBorder) {
+                            dimensions.tooltipBorderWidth
+                        } else {
+                            0.dp
+                        },
+                    tooltipArrowSize =
+                        if (state.tooltipArrow) {
+                            dimensions.tooltipArrowSize
+                        } else {
+                            0.dp
+                        },
+                ),
+        )
 
     /**
      * The interaction settings the controls currently describe, given the brush state the chart owns.
@@ -337,3 +376,26 @@ internal fun playgroundInteractionConfig(pointCount: Int = 0): ChartInteractionC
     val brushState = rememberBrushSelectionState()
     return LocalPlaygroundShared.current.interactionConfig(brushState = brushState, pointCount = pointCount)
 }
+
+/**
+ * The shared interaction settings, laid over a config a screen has already built for itself.
+ *
+ * The streaming and synced screens each construct a [ChartInteractionConfig] carrying something only
+ * they know about — a streaming state, a viewport, a jump-to-latest slot. They used to build it and
+ * stop there, which left the shared switches beside them doing nothing at all. Copying the shared
+ * settings onto that config keeps what the screen needs and adds back what the panel promises.
+ */
+@Composable
+internal fun withPlaygroundInteractions(
+    base: ChartInteractionConfig,
+    pointCount: Int = 0,
+): ChartInteractionConfig {
+    val shared = playgroundInteractionConfig(pointCount = pointCount)
+    return base.copy(
+        brushSelectionState = shared.brushSelectionState,
+        onRangeSelect = shared.onRangeSelect,
+        annotations = shared.annotations,
+        accessibilityDescription = shared.accessibilityDescription ?: base.accessibilityDescription,
+        dragTooltipEnabled = shared.dragTooltipEnabled,
+    )
+}
```

**File**: `composeApp/src/webMain/kotlin/com/himanshoe/sample/StreamingDashboardPlayground.kt` (modified, +21/-9)
```diff
@@ -222,10 +222,14 @@ private fun StreamingDashboardCharts(
                         animation = animation,
                         markers = markers,
                     ),
+                scaffoldConfig = playgroundScaffoldConfig(),
                 interactionConfig =
-                    ChartInteractionConfig(
-                        streamingState = throughputStream,
-                        jumpToLatest = { state -> ChartJumpToLatestPill(state = state) },
+                    withPlaygroundInteractions(
+                        base =
+                            ChartInteractionConfig(
+                                streamingState = throughputStream,
+                                jumpToLatest = { state -> ChartJumpToLatestPill(state = state) },
+                            ),
                     ),
                 crosshair = crosshairConfig?.let { ChartCrosshair(config = it) },
                 tooltip = ChartTooltip.none(),
@@ -242,10 +246,14 @@ private fun StreamingDashboardCharts(
                         animation = animation,
                         markers = markers,
                     ),
+                scaffoldConfig = playgroundScaffoldConfig(),
                 interactionConfig =
-                    ChartInteractionConfig(
-                        streamingState = requestsStream,
-                        jumpToLatest = { state -> ChartJumpToLatestPill(state = state) },
+                    withPlaygroundInteractions(
+                        base =
+                            ChartInteractionConfig(
+                                streamingState = requestsStream,
+                                jumpToLatest = { state -> ChartJumpToLatestPill(state = state) },
+                            ),
                     ),
                 tooltip = ChartTooltip.none(),
             )
@@ -261,10 +269,14 @@ private fun StreamingDashboardCharts(
                         animation = animation,
                         markers = markers,
                     ),
+                scaffoldConfig = playgroundScaffoldConfig(),
                 interactionConfig =
-                    ChartInteractionConfig(
-                        streamingState = latencyStream,
-                        jumpToLatest = { state -> ChartJumpToLatestPill(state = state) },
+                    withPlaygroundInteractions(
+                        base =
+                            ChartInteractionConfig(
+                                streamingState = latencyStream,
+                                jumpToLatest = { state -> ChartJumpToLatestPill(state = state) },
+                            ),
                     ),
                 crosshair = crosshairConfig?.let { ChartCrosshair(config = it) },
                 tooltip = ChartTooltip.none(),
```

**File**: `composeApp/src/webMain/kotlin/com/himanshoe/sample/StreamingPlayground.kt` (modified, +12/-8)
```diff
@@ -172,14 +172,18 @@ internal fun StreamingLinePlayground() {
             animation = animation,
             markers = markers,
             interactionConfig =
-                ChartInteractionConfig(
-                    streamingState =
-                        if (scrollback) {
-                            streamingState
-                        } else {
-                            null
-                        },
-                    jumpToLatest = jumpToLatestSlot(overlay = jumpOverlay, enabled = scrollback),
+                withPlaygroundInteractions(
+                    base =
+                        ChartInteractionConfig(
+                            streamingState =
+                                if (scrollback) {
+                                    streamingState
+                                } else {
+                                    null
+                                },
+                            jumpToLatest = jumpToLatestSlot(overlay = jumpOverlay, enabled = scrollback),
+                        ),
+                    pointCount = values.size,
                 ),
             tooltipMode = tooltipMode,
             crosshairEnabled = crosshairEnabled && supportsCrosshair,
```

**File**: `composeApp/src/webMain/kotlin/com/himanshoe/sample/SyncedPlayground.kt` (modified, +12/-4)
```diff
@@ -83,7 +83,9 @@ internal fun SyncedPlayground() {
                 crosshair = ChartCrosshair(
                     config = ChartCrosshairConfig(dismissOnRelease = ${!pinOnRelease}),
                 ),
-                interactionConfig = ChartInteractionConfig(viewPortState = revenueViewport),
+                scaffoldConfig = playgroundScaffoldConfig(),
+                interactionConfig =
+                    withPlaygroundInteractions(base = ChartInteractionConfig(viewPortState = revenueViewport)),
             )
 
             val ordersViewport = rememberViewPortState()
@@ -92,7 +94,9 @@ internal fun SyncedPlayground() {
                 crosshair = ChartCrosshair(
                     config = ChartCrosshairConfig(dismissOnRelease = ${!pinOnRelease}),
                 ),
-                interactionConfig = ChartInteractionConfig(viewPortState = ordersViewport),
+                scaffoldConfig = playgroundScaffoldConfig(),
+                interactionConfig =
+                    withPlaygroundInteractions(base = ChartInteractionConfig(viewPortState = ordersViewport)),
             )
         }
         // A chart participates when it has a crosshair AND a viewPortState (the plot geometry
@@ -162,7 +166,9 @@ private fun SyncedCharts(
                     ),
                 crosshair =
                     ChartCrosshair(config = crosshairConfig),
-                interactionConfig = ChartInteractionConfig(viewPortState = topViewport),
+                scaffoldConfig = playgroundScaffoldConfig(),
+                interactionConfig =
+                    withPlaygroundInteractions(base = ChartInteractionConfig(viewPortState = topViewport)),
             )
             Spacer(modifier = Modifier.height(12.dp))
             val bottomViewport = rememberViewPortState()
@@ -177,7 +183,9 @@ private fun SyncedCharts(
                     ),
                 crosshair =
                     ChartCrosshair(config = crosshairConfig),
-                interactionConfig = ChartInteractionConfig(viewPortState = bottomViewport),
+                scaffoldConfig = playgroundScaffoldConfig(),
+                interactionConfig =
+                    withPlaygroundInteractions(base = ChartInteractionConfig(viewPortState = bottomViewport)),
             )
         }
     }
```

---

### Incident Patch 12: `7b1c8379` (2026-08-14)
**Commit Message**: [Fix] Stop the playground showing controls that reach no chart

Grid thickness did nothing, and so did fourteen of its neighbours — not because the library ignores
them, but because five screens rendered the shared axis, grid and interaction sections without ever
passing the configuration those sections produce. The library honours grid thickness everywhere it is
given one.

The matrix heatmap now declares itself non-cartesian: it draws no scaffold and accepts neither
config, so the sections it was showing could never have worked. The export screen passes both, since
its chart takes them.

Three controls are withdrawn rather than wired, because wiring them would mean pretending. "Fade the
scroll edges" and "Follow the newest point" are both guarded in the library on a viewport the shared
panel never creates, so the switches moved and nothing else did. The tooltip style section produced a
config that has no call site anywhere in the repository: each chart carries tooltip styling on its
own config, so a single shared panel has nowhere to send it. Restoring that one means wiring it into
each chart's config, not re-showing the panel.

The annotation switch said "middle point" and alway

**File**: `composeApp/src/webMain/kotlin/com/himanshoe/sample/ExportPlayground.kt` (modified, +2/-0)
```diff
@@ -88,6 +88,8 @@ internal fun ExportPlayground() {
             LineChart(
                 data = { data },
                 modifier = Modifier.fillMaxSize().chartCapture(controller),
+                scaffoldConfig = playgroundScaffoldConfig(),
+                interactionConfig = playgroundInteractionConfig(pointCount = data.size),
                 color = ChartyColor.Solid(color),
                 lineConfig =
                     LineChartConfig(
```

**File**: `composeApp/src/webMain/kotlin/com/himanshoe/sample/HeatmapPlayground.kt` (modified, +3/-0)
```diff
@@ -106,6 +106,9 @@ internal fun HeatmapPlayground() {
         """.trimIndent()
 
     PlaygroundScaffold(
+        // MatrixHeatmapChart draws no ChartScaffold and takes neither a scaffold nor an interaction
+        // config, so the shared axis, grid and interaction sections would be controls that do nothing.
+        cartesian = false,
         code = code,
         chart = {
             MatrixHeatmapChart(
```

**File**: `composeApp/src/webMain/kotlin/com/himanshoe/sample/Playground.kt` (modified, +41/-16)
```diff
@@ -35,6 +35,7 @@ import androidx.compose.foundation.rememberScrollState
 import androidx.compose.foundation.shape.CircleShape
 import androidx.compose.foundation.shape.RoundedCornerShape
 import androidx.compose.foundation.verticalScroll
+import androidx.compose.material3.HorizontalDivider
 import androidx.compose.material3.MaterialTheme
 import androidx.compose.material3.Slider
 import androidx.compose.material3.Surface
@@ -57,6 +58,7 @@ import androidx.compose.ui.text.font.FontFamily
 import androidx.compose.ui.text.font.FontWeight
 import androidx.compose.ui.text.style.TextAlign
 import androidx.compose.ui.unit.dp
+import androidx.compose.ui.unit.em
 import androidx.compose.ui.unit.sp
 import com.himanshoe.charty.common.config.CornerRadius
 import kotlin.math.roundToInt
@@ -173,10 +175,9 @@ private fun ChartStage(
 ) {
     Surface(
         modifier = modifier,
-        shape = RoundedCornerShape(20.dp),
+        shape = RoundedCornerShape(12.dp),
         color = MaterialTheme.colorScheme.surface,
-        tonalElevation = 1.dp,
-        shadowElevation = 2.dp,
+        border = BorderStroke(width = 1.dp, color = MaterialTheme.colorScheme.outline),
     ) {
         Box(modifier = Modifier.fillMaxSize().padding(20.dp), contentAlignment = Alignment.Center) {
             chart()
@@ -202,10 +203,9 @@ private fun ControlPanel(
 ) {
     Surface(
         modifier = modifier,
-        shape = RoundedCornerShape(20.dp),
+        shape = RoundedCornerShape(12.dp),
         color = MaterialTheme.colorScheme.surface,
-        tonalElevation = 1.dp,
-        shadowElevation = 2.dp,
+        border = BorderStroke(width = 1.dp, color = MaterialTheme.colorScheme.outline),
     ) {
         Column(
             modifier =
@@ -246,7 +246,10 @@ private fun ControlPanel(
             if (cartesian) {
                 InteractionControls(state = shared)
                 AxisAndGridControls(state = shared)
-                TooltipStyleControls(state = shared)
+                // The tooltip style section is not shown: nothing consumes what it produces. Every
+                // chart carries its tooltip styling on its own config, so a single shared panel has
+                // nowhere to send it, and it sat here adjusting five values that reached no chart.
+                // Restoring it means wiring playgroundTooltipConfig() into each chart's own config.
             }
             ThemeControls(state = shared)
         }
@@ -330,15 +333,28 @@ private fun CodePanel(
     }
 }
 
+/**
+ * A heading in the control panel.
+ *
+ * Set in the muted foreground with a rule beside it rather than in the accent colour: there are eight
+ * of these down a single panel, and eight headings competing for attention is the same as none.
+ */
 @Composable
 internal fun ControlSection(title: String) {
-    Text(
-        text = title.uppercase(),
-        style = MaterialTheme.typography.labelMedium,
-        fontWeight = FontWeight.Bold,
-        color = MaterialTheme.colorScheme.primary,
-        modifier = Modifier.padding(top = 8.dp),
-    )
+    Row(
+        modifier = Modifier.fillMaxWidth().padding(top = 18.dp, bottom = 2.dp),
+        verticalAlignment = Alignment.CenterVertically,
+        horizontalArrangement = Arrangement.spacedBy(10.dp),
+    ) {
+        Text(
+            text = title.uppercase(),
+            style = MaterialTheme.typography.labelSmall,
+            fontWeight = FontWeight.Bold,
+            letterSpacing = 0.09.em,
+            color = MaterialTheme.colorScheme.onSurfaceVariant,
+        )
+        HorizontalDivider(modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.outline)
+    }
 }
 
 @Composable
@@ -429,15 +445,24 @@ internal fun <T> ChoiceRow(
                     modifier =
                         Modifier
                             .padding(top = 6.dp)
-                            .clip(RoundedCornerShape(50))
+                            .clip(RoundedCornerShape(8.dp))
                             .background(
                                 if (isSelected) {
                                     MaterialTheme.colorScheme.primary
                                 } else {
                                     MaterialTheme.colorScheme.surface
                                 },
+                            ).border(
+                                width = 1.dp,
+                                color =
+                                    if (isSelected) {
+                                        MaterialTheme.colorScheme.primary
+                                    } else {
+                                        MaterialTheme.colorScheme.outline
+                                    },
+                                shape = RoundedCornerShape(8.dp),
                             ).clickable { onSelect(option) }
-                            .padding(horizontal = 12.dp, vertical = 6.dp),
+                            .padding(horizontal = 12.dp, vertical = 7.dp),
             
```

**File**: `composeApp/src/webMain/kotlin/com/himanshoe/sample/PlaygroundSharedState.kt` (modified, +10/-12)
```diff
@@ -152,7 +152,11 @@ internal class PlaygroundSharedState {
                 },
             annotations =
                 if (annotate) {
-                    listOf(ChartAnnotation(xIndex = (pointCount / 2).coerceAtLeast(0), label = "Note"))
+                    // The first point, not the middle one. Most screens call this without a count —
+                    // the parameter defaults to zero — so "middle" resolved to index 0 anyway and the
+                    // label was describing something that never happened. Annotating the first point
+                    // is true on every screen, whether or not the caller knows how many there are.
+                    listOf(ChartAnnotation(xIndex = 0, label = "Note"))
                 } else {
                     emptyList()
                 },
@@ -301,7 +305,7 @@ internal fun InteractionControls(state: PlaygroundSharedState) {
         )
     }
     SwitchRow(
-        label = "Annotate the middle point",
+        label = "Annotate the first point",
         checked = state.annotate,
         onCheckedChange = { state.annotate = it },
     )
@@ -310,16 +314,10 @@ internal fun InteractionControls(state: PlaygroundSharedState) {
         checked = state.dragTooltip,
         onCheckedChange = { state.dragTooltip = it },
     )
-    SwitchRow(
-        label = "Fade the scroll edges",
-        checked = state.edgeFade,
-        onCheckedChange = { state.edgeFade = it },
-    )
-    SwitchRow(
-        label = "Follow the newest point",
-        checked = state.autoScrollToLatest,
-        onCheckedChange = { state.autoScrollToLatest = it },
-    )
+    // "Fade the scroll edges" and "Follow the newest point" are not offered here. Both only take
+    // effect when the chart has a viewport — the library guards each on `viewPortState != null` —
+    // and this panel supplies none, so the switches moved but nothing ever did. They belong on a
+    // screen that sets one up, not on every screen as controls that quietly do nothing.
     SwitchRow(
         label = "Screen-reader description",
         checked = state.describeForScreenReaders,
```

---

### Incident Patch 13: `5b6bdd05` (2026-08-14)
**Commit Message**: [Fix] Open the playground in the theme the reader already chose

It opened light whatever the reader had picked, which is jarring twice over: it is reached from a
documentation site that remembers a preference, and it ignored the one the operating system already
publishes. Both are answered now, in the order a reader would expect — a choice made on the site
wins over the machine's default, being more specific and more recent — and the key is the site's
own, so the two halves of the same site agree rather than each keeping a private opinion.

The system preference keeps being followed only while nobody has chosen. Someone who picked light at
ten in the morning did not ask to be flipped when their machine turns dark at six.

The code panel wears the same window frame the documentation site uses, so the one thing that appears
on both is not presented two different ways.

Stats: 3 files changed

**File**: `composeApp/src/webMain/kotlin/com/himanshoe/sample/Playground.kt` (modified, +23/-11)
```diff
@@ -63,9 +63,10 @@ import kotlin.math.roundToInt
 import kotlin.random.Random
 import kotlinx.coroutines.delay
 
-private val codeBackground = Color(0xFF1E1E2E)
+private val codeBackground = Color(0xFF16161A)
+private val codeChrome = Color(0xFF1F1F24)
 private val codeForeground = Color(0xFFE4E6F1)
-private val codeLabel = Color(0xFF9AA0B4)
+private val codeLabel = Color(0xFFA5A5B2)
 
 /** Formats a [Color] as a Kotlin `0xAARRGGBB` literal for the code panel. */
 internal fun colorHex(color: Color): String =
@@ -263,16 +264,27 @@ private fun CodePanel(
     val clipboard = LocalClipboardManager.current
     Column(modifier = modifier.clip(RoundedCornerShape(12.dp)).background(codeBackground)) {
         Row(
-            modifier = Modifier.fillMaxWidth().padding(start = 12.dp, end = 8.dp, top = 8.dp, bottom = 2.dp),
+            modifier =
+                Modifier
+                    .fillMaxWidth()
+                    .background(codeChrome)
+                    .padding(start = 12.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
             horizontalArrangement = Arrangement.SpaceBetween,
             verticalAlignment = Alignment.CenterVertically,
         ) {
-            Text(
-                text = "CODE",
-                style = MaterialTheme.typography.labelSmall,
-                fontWeight = FontWeight.Bold,
-                color = codeLabel,
-            )
+            // The same window the documentation site draws its snippets in, so the two halves of the
+            // site do not present the same thing two different ways.
+            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
+                listOf(Color(0xFFFF5F57), Color(0xFFFEBC2E), Color(0xFF28C840)).forEach { light ->
+                    Box(modifier = Modifier.size(10.dp).clip(RoundedCornerShape(50)).background(light))
+                }
+                Spacer(modifier = Modifier.width(8.dp))
+                Text(
+                    text = "Kotlin",
+                    style = MaterialTheme.typography.labelSmall,
+                    color = codeLabel,
+                )
+            }
             var copied by remember { mutableStateOf(false) }
             LaunchedEffect(copied) {
                 if (copied) {
@@ -295,9 +307,9 @@ private fun CodePanel(
                         .clip(RoundedCornerShape(6.dp))
                         .background(
                             if (copied) {
-                                Color(0xFF3A6B4A)
+                                Color(0xFF2F6B45)
                             } else {
-                                Color(0xFF3B3B54)
+                                Color(0xFF2A2A33)
                             },
                         ).clickable {
                             clipboard.setText(AnnotatedString(code))
```

**File**: `composeApp/src/webMain/kotlin/com/himanshoe/sample/PlaygroundApp.kt` (modified, +3/-2)
```diff
@@ -101,7 +101,8 @@ internal enum class PlaygroundFamily(
  */
 @Composable
 fun WebApp() {
-    var dark by remember { mutableStateOf(false) }
+    val theme = rememberPlaygroundTheme()
+    val dark = theme.dark
     var animate by remember { mutableStateOf(false) }
     val navigation = rememberPlaygroundNavigation()
     val family = navigation.family
@@ -130,7 +131,7 @@ fun WebApp() {
                         backTitle = family?.title,
                         onBack = navigation::back,
                         dark = dark,
-                        onToggleDark = { dark = !dark },
+                        onToggleDark = theme::toggle,
                         animate = animate,
                         onToggleAnimate = { animate = !animate },
                     )
```

**File**: `composeApp/src/webMain/kotlin/com/himanshoe/sample/PlaygroundTheme.kt` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+package com.himanshoe.sample
+
+import androidx.compose.runtime.Composable
+import androidx.compose.runtime.DisposableEffect
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.remember
+import androidx.compose.runtime.setValue
+import kotlinx.browser.localStorage
+import kotlinx.browser.window
+
+private const val THEME_KEY = "charty-theme"
+private const val DARK = "dark"
+private const val LIGHT = "light"
+
+/**
+ * Whether the playground is dark, and how a reader changes it.
+ *
+ * The playground opened light whatever the reader had chosen, which is jarring twice over: it is
+ * reached from a documentation site that remembers a preference, and it ignores the one the
+ * operating system already publishes. Both are answered here, in the order a reader would expect —
+ * a choice they made on the site wins over the machine's default, because it is more specific and
+ * more recent.
+ *
+ * The key is the site's own, so the two halves of the same site agree rather than each keeping a
+ * private opinion.
+ */
+class PlaygroundTheme(
+    initiallyDark: Boolean,
+) {
+    /** Whether the playground is currently showing its dark theme. */
+    var dark by mutableStateOf(initiallyDark)
+        private set
+
+    /** Flips the theme and records the choice, so it survives a reload and reaches the docs. */
+    fun toggle() {
+        dark = !dark
+        val value =
+            if (dark) {
+                DARK
+            } else {
+                LIGHT
+            }
+        runCatching { localStorage.setItem(key = THEME_KEY, value = value) }
+    }
+
+    /** Applies a preference that changed elsewhere, without writing it back. */
+    fun follow(isDark: Boolean) {
+        dark = isDark
+    }
+}
+
+/**
+ * Remembers the theme and keeps following the system while the reader has expressed no preference.
+ *
+ * Once someone has chosen, the system no longer overrides them — a reader who picked light at ten in
+ * the morning did not ask to be flipped when their machine turns dark at six.
+ */
+@Composable
+fun rememberPlaygroundTheme(): PlaygroundTheme {
+    val theme = remember { PlaygroundTheme(initiallyDark = preferredIsDark()) }
+
+    DisposableEffect(theme) {
+        val query = runCatching { window.matchMedia("(prefers-color-scheme: dark)") }.getOrNull()
+        val listener: (org.w3c.dom.events.Event) -> Unit = {
+            if (storedPreference() == null) {
+                theme.follow(isDark = query?.matches == true)
+            }
+        }
+        query?.addEventListener(type = "change", callback = listener)
+        onDispose { query?.removeEventListener(type = "change", callback = listener) }
+    }
+    return theme
+}
+
+/** The stored choice, or `null` when the reader has never made one. */
+private fun storedPreference(): String? =
+    runCatching { localStorage.getItem(THEME_KEY) }
+        .getOrNull()
+        ?.takeIf { value -> value == DARK || value == LIGHT }
+
+/** The theme to open with: the reader's stored choice, else what the operating system asks for. */
+private fun preferredIsDark(): Boolean {
+    val stored = storedPreference()
+    if (stored != null) {
+        return stored == DARK
+    }
+    return runCatching { window.matchMedia("(prefers-color-scheme: dark)").matches }.getOrDefault(false)
+}
```

---

### Incident Patch 14: `4603de32` (2026-08-14)
**Commit Message**: [Fix] Give code blocks a light theme instead of a black slab on a white page

They were fixed dark in both themes, on the reasoning that syntax palettes are designed for a dark
ground. That is true and beside the point: a slab of black halfway down a white page is the loudest
thing on it, and a reader who picks a light theme picks it for the code as much as the prose.

Both palettes are built against their own background rather than borrowed from each other, because a
colour that reads well on near-black is usually too pale on near-white. Every token was measured:
the lowest contrast in either theme is 5.09:1, comfortably past the 4.5:1 the guidelines ask for, and
the line-number gutter — the one thing that had been under it, at 3.05:1 — is now 4.80:1.

The window chrome and copy button had dark-only colours baked in as literals, so they are variables
now and follow the theme with everything else. The three lights stay as they are: they mean the same
thing on either ground.

Stats: 1 file changed

**File**: `docsite/src/main/resources/docs.css` (modified, +32/-8)
```diff
@@ -65,13 +65,37 @@
     --shadow: 0 1px 2px rgba(0, 0, 0, 0.6), 0 8px 24px rgba(0, 0, 0, 0.5);
 }
 
-/* The code surface does not follow the theme. */
+/*
+  Code follows the theme like everything else.
+
+  It was fixed dark at first, on the reasoning that syntax palettes are designed for a dark ground.
+  That is true and beside the point: a slab of black halfway down a white page is the loudest thing
+  on it, and readers who chose a light theme chose it for the code as much as the prose. Both
+  palettes below are checked against their own background rather than borrowed from the other, since
+  a colour that reads well on near-black is usually too pale on near-white.
+*/
 :root {
+    --code-bg: #fbfbfc;
+    --code-bg-header: #f1f1f3;
+    --code-border: #e2e2e6;
+    --code-text: #16161a;
+    --code-gutter: #6f6f7a;
+    --code-chrome-text: #55555f;
+    --tok-keyword: #7326c9;
+    --tok-string: #0a6c41;
+    --tok-comment: #6b6b76;
+    --tok-number: #9a4200;
+    --tok-type: #0b539e;
+    --tok-annotation: #7d4f00;
+}
+
+:root[data-theme="dark"] {
     --code-bg: #16161a;
     --code-bg-header: #1f1f24;
     --code-border: #32323a;
     --code-text: #f7f7f8;
-    --code-gutter: #6e6e78;
+    --code-gutter: #9797a3;
+    --code-chrome-text: #a5a5b2;
     --tok-keyword: #e0b6ff;
     --tok-string: #7dfab5;
     --tok-comment: #9b9baa;
@@ -646,9 +670,9 @@ code {
     font-size: 12px;
     font-weight: 600;
     border-radius: var(--radius-pill);
-    border: 1px solid rgba(255, 255, 255, 0.14);
+    border: 1px solid var(--code-border);
     background: var(--code-bg-header);
-    color: #cac4d0;
+    color: var(--code-chrome-text);
     cursor: pointer;
     opacity: 0;
     transition: opacity 120ms ease;
@@ -2115,7 +2139,7 @@ code {
     text-align: center;
     font-size: 12px;
     font-weight: 500;
-    color: #9b9baa;
+    color: var(--code-chrome-text);
     letter-spacing: 0.02em;
 }
 
@@ -2128,12 +2152,12 @@ code {
     border-radius: 6px;
     border: 1px solid var(--code-border);
     background: transparent;
-    color: #9b9baa;
+    color: var(--code-chrome-text);
 }
 
 .code-block .copy:hover {
-    color: #f7f7f8;
-    border-color: #55555f;
+    color: var(--code-text);
+    border-color: var(--code-gutter);
 }
 
 .code-block pre {
```

---

### Incident Patch 15: `5825d814` (2026-08-14)
**Commit Message**: [Fix] Stop a cached playground script asking for a bundle that no longer exists

The WebAssembly bundle is content-hashed; composeApp.js is not. They deploy together, so a browser
holding yesterday's composeApp.js asks for the bundle that build referenced — a file this deploy does
not contain — and the playground dies on a 404 with a blank page and nothing in the console a reader
would understand. The script is now named by its own content, which makes every deploy a new URL, so
a stale copy can never be paired with a bundle that has been deleted.

The banner has a real dark rendering rather than a dimmed light one. Dimming does not make a dark
image: the ground stays pale and merely goes duller. This inverts the illustration's lightness so it
is genuinely drawn on black, and lifts the brand purple back up, because a mid-lightness purple
inverts to something legible on white and murky on black. Two earlier attempts are worth not
repeating: inverting saturated colours along with everything else made the wordmark muddy, and
brightening them instead made the artwork garish. Only the purple is special-cased. The swap is CSS
rather than <picture>, because <picture> follows the operating

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/common/viewport/ViewPortState.kt` (modified, +3/-0)
```diff
@@ -33,8 +33,11 @@ private const val SCROLL_ANIMATION_MILLIS = 600
  * Use [rememberViewPortState] to create an instance bound to the composition lifecycle.
  */
 class ViewPortState : PlotBoundsSource {
+    /** Where the visible window starts, as a fraction of the whole series. `0f` is the first point. */
     var startFraction by mutableFloatStateOf(0f)
         private set
+
+    /** Where the visible window ends, as a fraction of the whole series. `1f` is the last point. */
     var endFraction by mutableFloatStateOf(1f)
         private set
 
```

**File**: `charty/src/commonMain/kotlin/com/himanshoe/charty/radar/config/MultipleRadarChartConfig.kt` (modified, +19/-1)
```diff
@@ -42,15 +42,33 @@ data class MultipleRadarChartConfig(
 }
 
 /**
- * Position for chart legend
+ * Where the legend sits relative to the chart.
+ *
+ * The four edges lay the entries out along that edge; the four corners stack them in place, which
+ * keeps a long legend from stealing the chart's width.
  */
 enum class LegendPosition {
+    /** Centred above the chart, entries in a row. */
     TOP,
+
+    /** Centred below the chart, entries in a row. */
     BOTTOM,
+
+    /** Down the left side, entries in a column. */
     LEFT,
+
+    /** Down the right side, entries in a column. */
     RIGHT,
+
+    /** Stacked in the top-left corner, over the plot. */
     TOP_LEFT,
+
+    /** Stacked in the top-right corner, over the plot. */
     TOP_RIGHT,
+
+    /** Stacked in the bottom-left corner, over the plot. */
     BOTTOM_LEFT,
+
+    /** Stacked in the bottom-right corner, over the plot. */
     BOTTOM_RIGHT,
 }
```

**File**: `config/detekt/detekt.yml` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ comments:
     active: true
     excludes: ['**/test/**', '**/androidTest/**']
   UndocumentedPublicProperty:
-    active: false
+    active: true
 
 complexity:
   active: true
```

**File**: `docsite/build.gradle.kts` (modified, +30/-0)
```diff
@@ -69,4 +69,34 @@ val assembleSite by tasks.registering(Sync::class) {
     from(project(":composeApp").tasks.named("wasmJsBrowserDistribution")) {
         into("playground")
     }
+
+    /*
+     * Stamps the playground's script tag with the hash of the script itself.
+     *
+     * The WebAssembly bundle is content-hashed but composeApp.js is not, and the two ship together.
+     * A browser holding a cached composeApp.js from an earlier deploy asks for the bundle that build
+     * referenced — a file the current deploy no longer contains — and the playground dies on a 404
+     * with nothing on screen. Naming the script by its own content makes every deploy a new URL, so
+     * a stale copy can never be paired with a bundle that has been deleted.
+     */
+    // Resolved here rather than inside doLast: a task action that reaches back into the project at
+    // execution time cannot be stored in the configuration cache.
+    val scriptReference = "composeApp.js"
+    val playgroundDir = layout.buildDirectory.dir("published-site/playground")
+
+    doLast {
+        val playground = playgroundDir.get().asFile
+        val script = playground.resolve(scriptReference)
+        val page = playground.resolve("index.html")
+        if (script.isFile && page.isFile) {
+            val fingerprint =
+                script
+                    .readBytes()
+                    .contentHashCode()
+                    .toUInt()
+                    .toString(radix = 16)
+            page.writeText(page.readText().replace(scriptReference, "$scriptReference?v=$fingerprint"))
+            println("Playground script stamped: $scriptReference?v=$fingerprint")
+        }
+    }
 }
```

**File**: `docsite/src/main/kotlin/com/himanshoe/docsite/Catalog.kt` (modified, +5/-0)
```diff
@@ -4,14 +4,19 @@ import java.io.File
 
 /** One chart in the landing page's catalog. */
 data class CatalogChart(
+    /** The chart's display name. */
     val name: String,
+    /** Where its documentation page lives on the site. */
     val url: String,
+    /** Its thumbnail's file name, or `null` when it has none. */
     val image: String?,
 )
 
 /** A family of charts, as the catalog groups them. */
 data class CatalogSection(
+    /** The family heading, such as "Bar charts". */
     val title: String,
+    /** The charts in this family. */
     val charts: List<CatalogChart>,
 )
 
```

**File**: `docsite/src/main/kotlin/com/himanshoe/docsite/Home.kt` (modified, +3/-1)
```diff
@@ -153,8 +153,10 @@ private fun hero(chartCount: Int): String =
 
   <div class="hero-art">
     ${renderKotlinBlock(quickStart)}
-    <img class="hero-banner" src="img/banner.png" width="1280" height="640"
+    <img class="hero-banner hero-banner--light" src="img/banner.png" width="1280" height="640"
          alt="Charty — an elementary compose library" fetchpriority="high">
+    <img class="hero-banner hero-banner--dark" src="img/banner-dark.png" width="1280" height="640"
+         alt="" aria-hidden="true" loading="lazy">
   </div>
 </section>
 """
```

**File**: `docsite/src/main/kotlin/com/himanshoe/docsite/Main.kt` (modified, +5/-3)
```diff
@@ -133,9 +133,11 @@ private fun copyBrand(
     brandDir: File,
     outputDir: File,
 ) {
-    val banner = brandDir.resolve("banner.png")
-    require(banner.isFile) { "Missing brand asset: ${banner.absolutePath}" }
-    banner.copyTo(target = outputDir.resolve("img/banner.png"), overwrite = true)
+    listOf("banner.png", "banner-dark.png").forEach { name ->
+        val asset = brandDir.resolve(name)
+        require(asset.isFile) { "Missing brand asset: ${asset.absolutePath}" }
+        asset.copyTo(target = outputDir.resolve("img/$name"), overwrite = true)
+    }
 }
 
 private fun copyAssets(outputDir: File) {
```

**File**: `docsite/src/main/kotlin/com/himanshoe/docsite/Navigation.kt` (modified, +4/-0)
```diff
@@ -2,13 +2,17 @@ package com.himanshoe.docsite
 
 /** One page in the sidebar: where its markdown lives, and what the nav calls it. */
 data class NavEntry(
+    /** Path to the markdown file, relative to the docs root. */
     val path: String,
+    /** What the sidebar calls this page, which may be shorter than the page's own heading. */
     val title: String,
 )
 
 /** A titled group of pages in the sidebar. */
 data class NavSection(
+    /** The group heading shown in the sidebar. */
     val title: String,
+    /** The pages in this group, in reading order. */
     val entries: List<NavEntry>,
 )
 
```

#### Recent Merged Pull Requests:
- **PR #176** (closed): Fix Touch Issue (@Fifteen15Studios)
- **PR #175** (closed): [WIP] Fix BarChart Y-axis labels exceeding screen width (@Copilot)
- **PR #173** (closed): chore(deps): update actions/checkout action to v6 (@renovate[bot])
- **PR #172** (closed): fix(deps): update dokka to v2.1.0 (@renovate[bot])
- **PR #167** (closed): fix(deps): update dependency androidx.activity:activity-compose to v1.12.0 (@renovate[bot])
- **PR #166** (closed): chore(deps): update actions/setup-python action to v6 (@renovate[bot])
- **PR #165** (closed): chore(deps): update actions/setup-java action to v5 (@renovate[bot])
- **PR #164** (closed): chore(deps): update actions/checkout action to v5 - autoclosed (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
