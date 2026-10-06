# Forensic Learning Record (Deep Inspection): kizitonwose/Calendar

> **Canonical Artifact**: `07_PROJECT_LEARNING/kizitonwose-calendar-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kizitonwose/Calendar](https://github.com/kizitonwose/Calendar))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:45:29.633Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kizitonwose/Calendar`
- **Description**: A highly customizable calendar view and compose library for Android and Kotlin Multiplatform.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5610 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `compose-multiplatform/library/src/androidMain/kotlin/com/kizitonwose/calendar/data/Utils.android.kt`
```
package com.kizitonwose.calendar.data

import android.util.Log

internal actual fun log(tag: String, message: String) = Log.w(tag, message).asUnit()

```

### Core Architecture Module: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/compose/CalendarState.kt`
```
package com.kizitonwose.calendar.compose

import androidx.compose.foundation.MutatePriority
import androidx.compose.foundation.ScrollIndicatorState
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.ScrollScope
import androidx.compose.foundation.gestures.ScrollableState
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.lazy.LazyListLayoutInfo
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import com.kizitonwose.calendar.core.CalendarDay
import com.kizitonwose.calendar.core.DayPosition
import com.kizitonwose.calendar.core.OutDateStyle
import com.kizitonwose.calendar.core.firstDayOfWeekFromLocale
import com.kizitonwose.calendar.core.format.fromIso8601YearMonth
import com.kizitonwose.calendar.core.format.toIso8601String
import com.kizitonwose.calendar.core.now
import com.kizitonwose.calendar.data.DataStore
import com.kizitonwose.calendar.data.VisibleItemState
import com.kizitonwose.calendar.data.checkRange
import com.kizitonwose.calendar.data.daysUntil
import com.kizitonwose.calendar.data.getCalendarMonthData
import com.kizitonwose.calendar.data.getMonthIndex
import com.kizitonwose.calendar.data.getMonthIndicesCount
import com.kizitonwose.calendar.data.indexOfFirstOrNull
import com.kizitonwose.calendar.data.log
import com.kizitonwose.calendar.data.positionYearMonth
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
import kotlinx.datetime.YearMonth

/**
 * Creates a [CalendarState] that is remembered across compositions.
 *
 * @param startMonth the initial value for [CalendarState.startMonth]
 * @param endMonth the initial value for [CalendarState.endMonth]
 * @param firstDayOfWeek the initial value for [CalendarState.firstDayOfWeek]
 * @param firstVisibleMonth the initial value for [CalendarState.firstVisibleMonth]
 * @param outDateStyle the initial value for [CalendarState.outDateStyle]
 */
@Composable
public fun rememberCalendarState(
    startMonth: YearMonth = YearMonth.now(),
    endMonth: YearMonth = startMonth,
    firstVisibleMonth: YearMonth = startMonth,
    firstDayOfWeek: DayOfWeek = firstDayOfWeekFromLocale(),
    outDateStyle: OutDateStyle = OutDateStyle.EndOfRow,
): CalendarState {
    return rememberSaveable(
        inputs = arrayOf<Any>(
            startMonth,
            endMonth,
            firstVisibleMonth,
            firstDayOfWeek,
            outDateStyle,
        ),
        saver = CalendarState.Saver,
    ) {
        CalendarState(
            startMonth = startMonth,
            endMonth = endMonth,
            firstDayOfWeek = firstDayOfWeek,
            firstVisibleMonth = firstVisibleMonth,
            outDateStyle = outDateStyle,
            visibleItemState = null,
        )
    }
}

/**
 * A state object that can be hoisted to control and observe calendar properties.
 *
 * This should be created via [rememberCalendarState].
 *
 * @param startMonth the first month on the calendar.
 * @param endMonth the last month on the calendar.
 * @param firstDayOfWeek the first day of week on the calendar.
 * @param firstVisibleMonth the initial value for [CalendarState.firstVisibleMonth]
 * @param outDateStyle the preferred style for out date generation.
 */
@Stable
public class CalendarState internal constructor(
    startMonth: YearMonth,
    endMonth: YearMonth,
    firstDayOfWeek: DayOfWeek,
    firstVisibleMonth: YearMonth,
    outDateStyle: OutDateStyle,
    visibleItemState: VisibleItemState?,
) : ScrollableState {
    /** Backing state for [startMonth] */
    private var _startMonth by mutableStateOf(startMonth)

    /** The first month on the calendar. */
    public var startMonth: YearMonth
        get() = _startMonth
        set(value) {
            if (value != startMonth) {
                _startMonth = value
                monthDataChanged()
            }
        }

    /** Backing state for [endMonth] */
    private var _endMonth by mutableStateOf(endMonth)

    /** The last month on the calendar. */
    public var endMonth: YearMonth
        get() = _endMonth
        set(value) {
            if (value != endMonth) {
                _endMonth = value
                monthDataChanged()
            }
        }

    /** Backing state for [firstDayOfWeek] */
    private var _firstDayOfWeek by mutableStateOf(firstDayOfWeek)

    /** The first day of week on the calendar. */
    public var firstDayOfWeek: DayOfWeek
        get() = _firstDayOfWeek
        set(value) {
            if (value != firstDayOfWeek) {
                _firstDayOfWeek = value
                monthDataChanged()
            }
        }

    /** Backing state for [outDateStyle] */
    private var _outDateStyle by mutableStateOf(outDateStyle)

    /** The preferred style for out date generation. */
    public var outDateStyle: OutDateStyle
        get() = _outDateStyle
        set(value) {
            if (value != outDateStyle) {
                _outDateStyle = value
                monthDataChanged()
            }
        }

    /**
     * The first month that is visible.
     *
     * @see [lastVisibleMonth]
     */
    public val firstVisibleMonth: com.kizitonwose.calendar.core.CalendarMonth by derivedStateOf {
        store[listState.firstVisibleItemIndex]
    }

    /**
     * The last month that is visible.
     *
     * @see [firstVisibleMonth]
     */
    public val lastVisibleMonth: com.kizitonwose.calendar.core.CalendarMonth by derivedStateOf {
        store[listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0]
    }

    /**
     * The object of [CalendarLayoutInfo] calculated during the last layout pass. For example,
     * you can use it to calculate what items are currently visible.
     *
     * Note that this property is observable and is updated after every scroll or remeasure.
     * If you use it in the composable function it will be recomposed on every change causing
     * potential performance issues including infinity recomposition loop.
     * Therefore, avoid using it in the composition.
     *
     * If you need to use it in the composition then consider wrapping the calculation into a
     * derived state in order to only have recompositions when the derived value changes.
     * See Example6Page in the sample app for usage.
     *
     * If you want to run some side effects like sending an analytics event or updating a state
     * based on this value consider using "snapshotFlow".
     *
     * see [LazyListLayoutInfo]
     */
    public val layoutInfo: CalendarLayoutInfo
        get() = CalendarLayoutInfo(listState.layoutInfo) { index -> store[index] }

    /**
     * [InteractionSource] that will be used to dispatch drag events when this
     * calendar is being dragged. If you want to know whether the fling (or animated scroll) is in
     * progress, use [isScrollInProgress].
     */
    public val interactionSource: InteractionSource
        get() = listState.interactionSource

    internal val listState = LazyListState(
        firstVisibleItemIndex = visibleItemState?.firstVisibleItemIndex
            ?: getScrollIndex(firstVisibleMonth) ?: 0,
        firstVisibleItemScrollOffset = visibleItemState?.firstVisibleItemScrollOffset ?: 0,
    )

    internal val placementInfo = ItemPlacementInfo()

    internal var calendarInfo by mutableStateOf(CalendarInfo(indexCount = 0))

    internal val store = DataStore { offset ->
        getCalendarMonthData(
            startMonth = this.startMonth,
            offset = offset,
            firstDayOfWeek = this.firstDayOfWeek,
            outDateStyle = this.outDateStyle,
        ).calendarMonth
    }

    init {
        monthDataChanged() // Update indexCount initially.
    }

    private fun monthDataChanged() {
        store.clear()
        checkRange(startMonth, endMonth)
        // Read the firstDayOfWeek and outDateStyle properties to ensure recomposition
        // even though they are unused in the CalendarInfo. Alternatively, we could use
        // mutableStateMapOf() as the backing store for DataStore() to ensure recomposition
        // but not sure how compose handles recomposition of a lazy list that reads from
        // such map when an entry unrelated to the visible indices changes.
        calendarInfo = CalendarInfo(
            indexCount = getMonthIndicesCount(startMonth, endMonth),
            firstDayOfWeek = firstDayOfWeek,
            outDateStyle = outDateStyle,
        )
    }

    /**
     * Instantly brings the [month] to the top of the viewport.
     *
     * @param month the month to which to scroll. Must be within the
     * range of [startMonth] and [endMonth].
     *
     * @see [animateScrollToMonth]
     */
    public suspend fun scrollToMonth(month: YearMonth) {
        listState.scrollToItem(getScrollIndex(month) ?: return)
    }

    /**
     * Animate (smooth scroll) to the given [month].
     *
     * @param month the month to which to scroll. Must be within the
     * range of [startMonth] and [endMonth].
     *
     * @see [scrollToMonth]
     */
    public suspend fun animateScrollToMonth(month: YearMonth) {
        listState.animateScrollToItem(getScrollIndex(month) ?: return)
    }

    /**
     * Instantly brings the [date] to the top of the viewport.
     *
     * @param date the date to which to scroll. Must be within the
     * range of [startMonth] and [endMonth].
     * @param position the position of the date in the month.
     *
     * @see [animateScrollToDate]
     */
    public suspend fun scrollToDate(
        date: LocalDate,
        position
```

### Core Architecture Module: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/compose/heatmapcalendar/HeatMapCalendarState.kt`
```
package com.kizitonwose.calendar.compose.heatmapcalendar

import androidx.compose.foundation.MutatePriority
import androidx.compose.foundation.ScrollIndicatorState
import androidx.compose.foundation.gestures.ScrollScope
import androidx.compose.foundation.gestures.ScrollableState
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import com.kizitonwose.calendar.compose.CalendarInfo
import com.kizitonwose.calendar.compose.CalendarLayoutInfo
import com.kizitonwose.calendar.core.CalendarMonth
import com.kizitonwose.calendar.core.firstDayOfWeekFromLocale
import com.kizitonwose.calendar.core.format.fromIso8601YearMonth
import com.kizitonwose.calendar.core.format.toIso8601String
import com.kizitonwose.calendar.core.now
import com.kizitonwose.calendar.data.DataStore
import com.kizitonwose.calendar.data.VisibleItemState
import com.kizitonwose.calendar.data.checkRange
import com.kizitonwose.calendar.data.getHeatMapCalendarMonthData
import com.kizitonwose.calendar.data.getMonthIndex
import com.kizitonwose.calendar.data.getMonthIndicesCount
import com.kizitonwose.calendar.data.log
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.YearMonth

/**
 * Creates a [HeatMapCalendarState] that is remembered across compositions.
 *
 * @param startMonth the initial value for [HeatMapCalendarState.startMonth]
 * @param endMonth the initial value for [HeatMapCalendarState.endMonth]
 * @param firstDayOfWeek the initial value for [HeatMapCalendarState.firstDayOfWeek]
 * @param firstVisibleMonth the initial value for [HeatMapCalendarState.firstVisibleMonth]
 */
@Composable
public fun rememberHeatMapCalendarState(
    startMonth: YearMonth = YearMonth.now(),
    endMonth: YearMonth = startMonth,
    firstVisibleMonth: YearMonth = startMonth,
    firstDayOfWeek: DayOfWeek = firstDayOfWeekFromLocale(),
): HeatMapCalendarState {
    return rememberSaveable(
        inputs = arrayOf<Any>(
            startMonth,
            endMonth,
            firstVisibleMonth,
            firstDayOfWeek,
        ),
        saver = HeatMapCalendarState.Saver,
    ) {
        HeatMapCalendarState(
            startMonth = startMonth,
            endMonth = endMonth,
            firstDayOfWeek = firstDayOfWeek,
            firstVisibleMonth = firstVisibleMonth,
            visibleItemState = null,
        )
    }
}

/**
 * A state object that can be hoisted to control and observe calendar properties.
 *
 * This should be created via [rememberHeatMapCalendarState].
 *
 * @param startMonth the first month on the calendar.
 * @param endMonth the last month on the calendar.
 * @param firstDayOfWeek the first day of week on the calendar.
 * @param firstVisibleMonth the initial value for [HeatMapCalendarState.firstVisibleMonth]
 */
@Stable
public class HeatMapCalendarState internal constructor(
    startMonth: YearMonth,
    endMonth: YearMonth,
    firstVisibleMonth: YearMonth,
    firstDayOfWeek: DayOfWeek,
    visibleItemState: VisibleItemState?,
) : ScrollableState {
    /** Backing state for [startMonth] */
    private var _startMonth by mutableStateOf(startMonth)

    /** The first month on the calendar. */
    public var startMonth: YearMonth
        get() = _startMonth
        set(value) {
            if (value != startMonth) {
                _startMonth = value
                monthDataChanged()
            }
        }

    /** Backing state for [endMonth] */
    private var _endMonth by mutableStateOf(endMonth)

    /** The last month on the calendar. */
    public var endMonth: YearMonth
        get() = _endMonth
        set(value) {
            if (value != endMonth) {
                _endMonth = value
                monthDataChanged()
            }
        }

    /** Backing state for [firstDayOfWeek] */
    private var _firstDayOfWeek by mutableStateOf(firstDayOfWeek)

    /** The first day of week on the calendar. */
    public var firstDayOfWeek: DayOfWeek
        get() = _firstDayOfWeek
        set(value) {
            if (value != firstDayOfWeek) {
                _firstDayOfWeek = value
                monthDataChanged()
            }
        }

    /**
     * The first month that is visible.
     *
     * @see [lastVisibleMonth]
     */
    public val firstVisibleMonth: CalendarMonth by derivedStateOf {
        store[listState.firstVisibleItemIndex]
    }

    /**
     * The last month that is visible.
     *
     * @see [firstVisibleMonth]
     */
    public val lastVisibleMonth: CalendarMonth by derivedStateOf {
        store[listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0]
    }

    /**
     * The object of [CalendarLayoutInfo] calculated during the last layout pass. For example,
     * you can use it to calculate what items are currently visible.
     *
     * Note that this property is observable and is updated after every scroll or remeasure.
     * If you use it in the composable function it will be recomposed on every change causing
     * potential performance issues including infinity recomposition loop.
     * Therefore, avoid using it in the composition.
     *
     * If you need to use it in the composition then consider wrapping the calculation into a
     * derived state in order to only have recompositions when the derived value changes.
     * See Example6Page in the sample app for usage.
     *
     * If you want to run some side effects like sending an analytics event or updating a state
     * based on this value consider using "snapshotFlow".
     */
    public val layoutInfo: CalendarLayoutInfo
        get() = CalendarLayoutInfo(listState.layoutInfo) { index -> store[index] }

    /**
     * [InteractionSource] that will be used to dispatch drag events when this
     * calendar is being dragged. If you want to know whether the fling (or animated scroll) is in
     * progress, use [isScrollInProgress].
     */
    public val interactionSource: InteractionSource
        get() = listState.interactionSource

    internal val listState = LazyListState(
        firstVisibleItemIndex = visibleItemState?.firstVisibleItemIndex
            ?: getScrollIndex(firstVisibleMonth) ?: 0,
        firstVisibleItemScrollOffset = visibleItemState?.firstVisibleItemScrollOffset ?: 0,
    )

    internal var calendarInfo by mutableStateOf(CalendarInfo(indexCount = 0))

    internal val store = DataStore { offset ->
        getHeatMapCalendarMonthData(
            startMonth = this.startMonth,
            offset = offset,
            firstDayOfWeek = this.firstDayOfWeek,
        ).calendarMonth
    }

    init {
        monthDataChanged() // Update indexCount initially.
    }

    private fun monthDataChanged() {
        store.clear()
        checkRange(startMonth, endMonth)
        calendarInfo = CalendarInfo(
            indexCount = getMonthIndicesCount(startMonth, endMonth),
            firstDayOfWeek = firstDayOfWeek,
        )
    }

    /**
     * Instantly brings the [month] to the top of the viewport.
     *
     * @param month the month to which to scroll. Must be within the
     * range of [startMonth] and [endMonth].
     *
     * @see [animateScrollToMonth]
     */
    public suspend fun scrollToMonth(month: YearMonth) {
        listState.scrollToItem(getScrollIndex(month) ?: return)
    }

    /**
     * Animate (smooth scroll) to the given [month].
     *
     * @param month the month to which to scroll. Must be within the
     * range of [startMonth] and [endMonth].
     */
    public suspend fun animateScrollToMonth(month: YearMonth) {
        listState.animateScrollToItem(getScrollIndex(month) ?: return)
    }

    private fun getScrollIndex(month: YearMonth): Int? {
        if (month !in startMonth..endMonth) {
            log("HeatMapCalendarState", "Attempting to scroll out of range: $month")
            return null
        }
        return getMonthIndex(startMonth, month)
    }

    /**
     * Whether this [ScrollableState] is currently scrolling by gesture, fling or programmatically.
     */
    override val isScrollInProgress: Boolean
        get() = listState.isScrollInProgress

    /**
     * Whether this [ScrollableState] can scroll forward (consume a positive delta).
     * This is typically false if the scroll position is equal to its maximum value, and true otherwise.
     */
    override val canScrollForward: Boolean
        get() = listState.canScrollForward

    /**
     * Whether this [ScrollableState] can scroll backward (consume a negative delta).
     * This is typically false if the scroll position is equal to its minimum value, and true otherwise.
     */
    override val canScrollBackward: Boolean
        get() = listState.canScrollBackward

    /**
     * The value of this property is true under the following scenarios, otherwise it's false.
     * - This [ScrollableState] is currently scrolling forward.
     * - This [ScrollableState] was scrolling forward in its last scroll action.
     */
    override val lastScrolledForward: Boolean
        get() = listState.lastScrolledForward

    /**
     * The value of this property is true under the following scenarios, otherwise it's false.
     * - This [ScrollableState] is currently scrolling backward.
     * - This [ScrollableState] was scrolling backward in its last scroll action.
     */
    override val lastScrolledBackward: Boolean
        get() = listState.lastScrolledBackward

    /**
     * [ScrollIndicatorState] used for drawing a scroll indicator (e.g., a scrollbar).
     */
    override val scrollIndicatorState: ScrollIndicatorState?
        get() = l
```

### Core Architecture Module: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/compose/weekcalendar/WeekCalendarState.kt`
```
package com.kizitonwose.calendar.compose.weekcalendar

import androidx.compose.foundation.MutatePriority
import androidx.compose.foundation.ScrollIndicatorState
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.ScrollScope
import androidx.compose.foundation.gestures.ScrollableState
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import com.kizitonwose.calendar.compose.ItemPlacementInfo
import com.kizitonwose.calendar.core.Week
import com.kizitonwose.calendar.core.WeekDay
import com.kizitonwose.calendar.core.WeekDayPosition
import com.kizitonwose.calendar.core.firstDayOfWeekFromLocale
import com.kizitonwose.calendar.core.format.fromIso8601LocalDate
import com.kizitonwose.calendar.core.format.toIso8601String
import com.kizitonwose.calendar.core.now
import com.kizitonwose.calendar.data.DataStore
import com.kizitonwose.calendar.data.VisibleItemState
import com.kizitonwose.calendar.data.checkRange
import com.kizitonwose.calendar.data.daysUntil
import com.kizitonwose.calendar.data.getWeekCalendarAdjustedRange
import com.kizitonwose.calendar.data.getWeekCalendarData
import com.kizitonwose.calendar.data.getWeekIndex
import com.kizitonwose.calendar.data.getWeekIndicesCount
import com.kizitonwose.calendar.data.log
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
import kotlinx.datetime.YearMonth

/**
 * Creates a [WeekCalendarState] that is remembered across compositions.
 *
 * @param startDate the initial value for [WeekCalendarState.startDate]
 * @param endDate the initial value for [WeekCalendarState.endDate]
 * @param firstDayOfWeek the initial value for [WeekCalendarState.firstDayOfWeek]
 * @param firstVisibleWeekDate the date which will have its week visible initially.
 */
@Composable
public fun rememberWeekCalendarState(
    startDate: LocalDate = YearMonth.now().firstDay,
    endDate: LocalDate = YearMonth.now().lastDay,
    firstVisibleWeekDate: LocalDate = LocalDate.now(),
    firstDayOfWeek: DayOfWeek = firstDayOfWeekFromLocale(),
): WeekCalendarState {
    return rememberSaveable(
        inputs = arrayOf<Any>(
            startDate,
            endDate,
            firstVisibleWeekDate,
            firstDayOfWeek,
        ),
        saver = WeekCalendarState.Saver,
    ) {
        WeekCalendarState(
            startDate = startDate,
            endDate = endDate,
            firstVisibleWeekDate = firstVisibleWeekDate,
            firstDayOfWeek = firstDayOfWeek,
            visibleItemState = null,
        )
    }
}

/**
 * A state object that can be hoisted to control and observe calendar properties.
 *
 * This should be created via [rememberWeekCalendarState].
 *
 * @param startDate the desired first date on the calendar. The actual first date will be the
 * first day in the week to which this date belongs, depending on the provided [firstDayOfWeek].
 * Such days will have their [WeekDayPosition] set to [WeekDayPosition.InDate].
 * @param endDate the desired last date on the calendar. The actual last date will be the last
 * day in the week to which this date belongs. Such days will have their [WeekDayPosition] set
 * to [WeekDayPosition.OutDate].
 * @param firstDayOfWeek the first day of week on the calendar.
 * @param firstVisibleWeekDate the date which will have its week visible initially.
 */
@Stable
public class WeekCalendarState internal constructor(
    startDate: LocalDate,
    endDate: LocalDate,
    firstVisibleWeekDate: LocalDate,
    firstDayOfWeek: DayOfWeek,
    visibleItemState: VisibleItemState?,
) : ScrollableState {
    /**
     * The adjusted first date on the calendar to ensure proper alignment
     * of the provided [firstDayOfWeek].
     */
    private var startDateAdjusted by mutableStateOf(startDate)

    /**
     * The adjusted last date on the calendar to fill the remaining days in the
     * last week after the provided end date.
     */
    private var endDateAdjusted by mutableStateOf(endDate)

    /** Backing state for [startDate] */
    private var _startDate by mutableStateOf(startDate)

    /**
     * The desired first date on the calendar. The actual first date will be the first day
     * in the week to which this date belongs, depending on the provided [firstDayOfWeek].
     * Such days will have their [WeekDayPosition] set to [WeekDayPosition.InDate]
     */
    public var startDate: LocalDate
        get() = _startDate
        set(value) {
            if (value != _startDate) {
                _startDate = value
                adjustDateRange()
            }
        }

    /** Backing state for [endDate] */
    private var _endDate by mutableStateOf(endDate)

    /**
     * The desired last date on the calendar. The actual last date will be the last day
     * in the week to which this date belongs. Such days will have their [WeekDayPosition]
     * set to [WeekDayPosition.OutDate]
     */
    public var endDate: LocalDate
        get() = _endDate
        set(value) {
            if (value != _endDate) {
                _endDate = value
                adjustDateRange()
            }
        }

    /** Backing state for [firstDayOfWeek] */
    private var _firstDayOfWeek by mutableStateOf(firstDayOfWeek)

    /** The first day of week on the calendar. */
    public var firstDayOfWeek: DayOfWeek
        get() = _firstDayOfWeek
        set(value) {
            if (value != _firstDayOfWeek) {
                _firstDayOfWeek = value
                adjustDateRange()
            }
        }

    /**
     * The first week that is visible.
     */
    public val firstVisibleWeek: Week by derivedStateOf {
        store[listState.firstVisibleItemIndex]
    }

    /**
     * The last week that is visible.
     */
    public val lastVisibleWeek: Week by derivedStateOf {
        store[listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0]
    }

    /**
     * The object of [WeekCalendarLayoutInfo] calculated during the last layout pass. For example,
     * you can use it to calculate what items are currently visible.
     *
     * Note that this property is observable and is updated after every scroll or remeasure.
     * If you use it in the composable function it will be recomposed on every change causing
     * potential performance issues including infinity recomposition loop.
     * Therefore, avoid using it in the composition.
     *
     * If you need to use it in the composition then consider wrapping the calculation into a
     * derived state in order to only have recompositions when the derived value changes.
     * See Example5Page in the sample app for usage.
     *
     * If you want to run some side effects like sending an analytics event or updating a state
     * based on this value consider using "snapshotFlow".
     */
    public val layoutInfo: WeekCalendarLayoutInfo
        get() = WeekCalendarLayoutInfo(listState.layoutInfo) { index -> store[index] }

    internal val placementInfo = ItemPlacementInfo()

    internal val store = DataStore { offset ->
        getWeekCalendarData(
            startDateAdjusted = this.startDateAdjusted,
            offset = offset,
            desiredStartDate = this.startDate,
            desiredEndDate = this.endDate,
        ).week
    }

    internal var weekIndexCount by mutableIntStateOf(0)

    internal val listState = run {
        // Update date range and weekIndexCount initially.
        // Since getScrollIndex requires the adjusted start date, it is necessary to do this
        // before finding the first visible index.
        adjustDateRange()
        val item = visibleItemState ?: run {
            VisibleItemState(firstVisibleItemIndex = getScrollIndex(firstVisibleWeekDate) ?: 0)
        }
        LazyListState(
            firstVisibleItemIndex = item.firstVisibleItemIndex,
            firstVisibleItemScrollOffset = item.firstVisibleItemScrollOffset,
        )
    }

    private fun adjustDateRange() {
        checkRange(startDate, endDate)
        val data = getWeekCalendarAdjustedRange(startDate, endDate, firstDayOfWeek)
        startDateAdjusted = data.startDateAdjusted
        endDateAdjusted = data.endDateAdjusted
        store.clear()
        weekIndexCount = getWeekIndicesCount(startDateAdjusted, endDateAdjusted)
    }

    /**
     * Instantly brings the week containing the given [date] to the top of the viewport.
     *
     * @param date the week to which to scroll.
     *
     * @see [animateScrollToWeek]
     */
    public suspend fun scrollToWeek(date: LocalDate) {
        listState.scrollToItem(getScrollIndex(date) ?: return)
    }

    /**
     * Animate (smooth scroll) to the week containing the given [date].
     *
     * @param date the week to which to scroll.
     *
     * @see [scrollToWeek]
     */
    public suspend fun animateScrollToWeek(date: LocalDate) {
        listState.animateScrollToItem(getScrollIndex(date) ?: return)
    }

    /**
     * Instantly brings the week containing the given [day] to the top of the viewport.
     *
     * @param day the week to which to scroll.
     *
     * @see [animateScrollToWeek]]
     */
    public suspend fun scrollToWeek(day: WeekDay): Unit = scrollToWeek(day.date)

    /**
     * Animate (smooth scroll) to the week containing the given [day].
     *
     * @param day the week to which to scroll.
     *
     * @see [scrollToWeek]
     */
    public suspend fun animateScrollToWeek(day: WeekDay): Unit = animateScrollToWeek(day.date)

    /**
```

### Core Architecture Module: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/compose/yearcalendar/YearCalendarState.kt`
```
package com.kizitonwose.calendar.compose.yearcalendar

import androidx.compose.foundation.MutatePriority
import androidx.compose.foundation.ScrollIndicatorState
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.ScrollScope
import androidx.compose.foundation.gestures.ScrollableState
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.lazy.LazyListLayoutInfo
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import com.kizitonwose.calendar.compose.CalendarInfo
import com.kizitonwose.calendar.compose.CalendarLayoutInfo
import com.kizitonwose.calendar.core.CalendarDay
import com.kizitonwose.calendar.core.CalendarMonth
import com.kizitonwose.calendar.core.CalendarYear
import com.kizitonwose.calendar.core.DayPosition
import com.kizitonwose.calendar.core.OutDateStyle
import com.kizitonwose.calendar.core.Year
import com.kizitonwose.calendar.core.firstDayOfWeekFromLocale
import com.kizitonwose.calendar.data.DataStore
import com.kizitonwose.calendar.data.VisibleItemState
import com.kizitonwose.calendar.data.checkRange
import com.kizitonwose.calendar.data.daysUntil
import com.kizitonwose.calendar.data.getCalendarYearData
import com.kizitonwose.calendar.data.getYearIndex
import com.kizitonwose.calendar.data.getYearIndicesCount
import com.kizitonwose.calendar.data.indexOfFirstOrNull
import com.kizitonwose.calendar.data.log
import com.kizitonwose.calendar.data.positionYearMonth
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
import kotlinx.datetime.YearMonth

/**
 * Creates a [YearCalendarState] that is remembered across compositions.
 *
 * @param startYear the initial value for [YearCalendarState.startYear]
 * @param endYear the initial value for [YearCalendarState.endYear]
 * @param firstDayOfWeek the initial value for [YearCalendarState.firstDayOfWeek]
 * @param firstVisibleYear the initial value for [YearCalendarState.firstVisibleYear]
 * @param outDateStyle the initial value for [YearCalendarState.outDateStyle]
 */
@Composable
public fun rememberYearCalendarState(
    startYear: Year = Year.now(),
    endYear: Year = startYear,
    firstVisibleYear: Year = startYear,
    firstDayOfWeek: DayOfWeek = firstDayOfWeekFromLocale(),
    outDateStyle: OutDateStyle = OutDateStyle.EndOfRow,
): YearCalendarState {
    return rememberSaveable(
        inputs = arrayOf(
            startYear,
            endYear,
            firstVisibleYear,
            firstDayOfWeek,
            outDateStyle,
        ),
        saver = YearCalendarState.Saver,
    ) {
        YearCalendarState(
            startYear = startYear,
            endYear = endYear,
            firstDayOfWeek = firstDayOfWeek,
            firstVisibleYear = firstVisibleYear,
            outDateStyle = outDateStyle,
            visibleItemState = null,
        )
    }
}

/**
 * A state object that can be hoisted to control and observe calendar properties.
 *
 * This should be created via [rememberYearCalendarState].
 *
 * @param startYear the first month on the calendar.
 * @param endYear the last month on the calendar.
 * @param firstDayOfWeek the first day of week on the calendar.
 * @param firstVisibleYear the initial value for [YearCalendarState.firstVisibleYear]
 * @param outDateStyle the preferred style for out date generation.
 */
@Stable
public class YearCalendarState internal constructor(
    startYear: Year,
    endYear: Year,
    firstDayOfWeek: DayOfWeek,
    firstVisibleYear: Year,
    outDateStyle: OutDateStyle,
    visibleItemState: VisibleItemState?,
) : ScrollableState {
    /** Backing state for [startYear] */
    private var _startYear by mutableStateOf(startYear)

    /** The first year on the calendar. */
    public var startYear: Year
        get() = _startYear
        set(value) {
            if (value != startYear) {
                _startYear = value
                yearDataChanged()
            }
        }

    /** Backing state for [endYear] */
    private var _endYear by mutableStateOf(endYear)

    /** The last year on the calendar. */
    public var endYear: Year
        get() = _endYear
        set(value) {
            if (value != endYear) {
                _endYear = value
                yearDataChanged()
            }
        }

    /** Backing state for [firstDayOfWeek] */
    private var _firstDayOfWeek by mutableStateOf(firstDayOfWeek)

    /** The first day of week on the calendar. */
    public var firstDayOfWeek: DayOfWeek
        get() = _firstDayOfWeek
        set(value) {
            if (value != firstDayOfWeek) {
                _firstDayOfWeek = value
                yearDataChanged()
            }
        }

    /** Backing state for [outDateStyle] */
    private var _outDateStyle by mutableStateOf(outDateStyle)

    /** The preferred style for out date generation. */
    public var outDateStyle: OutDateStyle
        get() = _outDateStyle
        set(value) {
            if (value != outDateStyle) {
                _outDateStyle = value
                yearDataChanged()
            }
        }

    /**
     * The first year that is visible.
     *
     * @see [lastVisibleYear]
     */
    public val firstVisibleYear: CalendarYear by derivedStateOf {
        store[listState.firstVisibleItemIndex]
    }

    /**
     * The last year that is visible.
     *
     * @see [firstVisibleYear]
     */
    public val lastVisibleYear: CalendarYear by derivedStateOf {
        store[listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0]
    }

    /**
     * The object of [CalendarLayoutInfo] calculated during the last layout pass. For example,
     * you can use it to calculate what items are currently visible.
     *
     * Note that this property is observable and is updated after every scroll or remeasure.
     * If you use it in the composable function it will be recomposed on every change causing
     * potential performance issues including infinity recomposition loop.
     * Therefore, avoid using it in the composition.
     *
     * If you need to use it in the composition then consider wrapping the calculation into a
     * derived state in order to only have recompositions when the derived value changes.
     * See Example6Page in the sample app for usage.
     *
     * If you want to run some side effects like sending an analytics event or updating a state
     * based on this value consider using "snapshotFlow".
     *
     * see [LazyListLayoutInfo]
     */
    public val layoutInfo: YearCalendarLayoutInfo
        get() = YearCalendarLayoutInfo(listState.layoutInfo) { index -> store[index] }

    /**
     * [InteractionSource] that will be used to dispatch drag events when this
     * calendar is being dragged. If you want to know whether the fling (or animated scroll) is in
     * progress, use [isScrollInProgress].
     */
    public val interactionSource: InteractionSource
        get() = listState.interactionSource

    internal val listState = LazyListState(
        firstVisibleItemIndex = visibleItemState?.firstVisibleItemIndex
            ?: getScrollIndex(firstVisibleYear) ?: 0,
        firstVisibleItemScrollOffset = visibleItemState?.firstVisibleItemScrollOffset ?: 0,
    )

    internal val placementInfo = YearItemPlacementInfo()

    internal var calendarInfo by mutableStateOf(CalendarInfo(indexCount = 0))

    internal val store = DataStore { offset ->
        getCalendarYearData(
            startYear = this.startYear,
            offset = offset,
            firstDayOfWeek = this.firstDayOfWeek,
            outDateStyle = this.outDateStyle,
        )
    }

    init {
        yearDataChanged() // Update indexCount initially.
    }

    private fun yearDataChanged() {
        store.clear()
        checkRange(startYear, endYear)
        // Read the firstDayOfWeek and outDateStyle properties to ensure recomposition
        // even though they are unused in the CalendarInfo. Alternatively, we could use
        // mutableStateMapOf() as the backing store for DataStore() to ensure recomposition
        // but not sure how compose handles recomposition of a lazy list that reads from
        // such map when an entry unrelated to the visible indices changes.
        calendarInfo = CalendarInfo(
            indexCount = getYearIndicesCount(startYear, endYear),
            firstDayOfWeek = firstDayOfWeek,
            outDateStyle = outDateStyle,
        )
    }

    /**
     * Instantly brings the [year] to the top of the viewport.
     *
     * @param year the year to which to scroll. Must be within the
     * range of [startYear] and [endYear].
     *
     * @see [animateScrollToYear]
     */
    public suspend fun scrollToYear(year: Year) {
        listState.scrollToItem(getScrollIndex(year) ?: return)
    }

    /**
     * Animate (smooth scroll) to the given [year].
     *
     * @param year the year to which to scroll. Must be within the
     * range of [startYear] and [endYear].
     *
     * @see [scrollToYear]
     */
    public suspend fun animateScrollToYear(year: Year) {
        listState.animateScrollToItem(getScrollIndex(year) ?: return)
    }

    /**
     * Instantly brings the [month] to the top of the viewport.
     *
     * @param month the month to which to scroll. Must be within the
     * range of [startYear] and [endYear].
     *
     * @see [animateScrollToMonth]
     */
    public suspend fun scrollToMonth(month: YearMonth): Unit =
        scrollToMonth(month, animate = false)

    /**
     * Animate (smooth scroll) to the given [month].
     *
     * @param m
```

### Core Architecture Module: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/core/CalendarDay.kt`
```
package com.kizitonwose.calendar.core

import androidx.compose.runtime.Immutable
import kotlinx.datetime.LocalDate

/**
 * Represents a day on the calendar.
 *
 * @param date the date for this day.
 * @param position the [DayPosition] for this day.
 */
@Immutable
public data class CalendarDay(val date: LocalDate, val position: DayPosition)

```

### Core Architecture Module: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/core/CalendarMonth.kt`
```
package com.kizitonwose.calendar.core

import androidx.compose.runtime.Immutable
import kotlinx.datetime.YearMonth

/**
 * Represents a month on the calendar.
 *
 * @param yearMonth the calendar month value.
 * @param weekDays the weeks in this month.
 */
@Immutable
@ConsistentCopyVisibility
public data class CalendarMonth internal constructor(
    val yearMonth: YearMonth,
    val weekDays: List<List<CalendarDay>>,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other == null || this::class != other::class) return false

        other as CalendarMonth

        if (yearMonth != other.yearMonth) return false
        if (weekDays.first().first() != other.weekDays.first().first()) return false
        if (weekDays.last().last() != other.weekDays.last().last()) return false

        return true
    }

    override fun hashCode(): Int {
        var result = yearMonth.hashCode()
        result = 31 * result + weekDays.first().first().hashCode()
        result = 31 * result + weekDays.last().last().hashCode()
        return result
    }

    override fun toString(): String {
        return "CalendarMonth { " +
            "first = ${weekDays.first().first()}, " +
            "last = ${weekDays.last().last()} " +
            "} "
    }
}

```

### Core Architecture Module: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/core/CalendarYear.kt`
```
package com.kizitonwose.calendar.core

import androidx.compose.runtime.Immutable

/**
 * Represents a year on the calendar.
 *
 * @param year the calendar year value.
 * @param months the months in this year.
 */
@Immutable
public data class CalendarYear(
    val year: Year,
    val months: List<CalendarMonth>,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other == null || this::class != other::class) return false

        other as CalendarYear

        if (year != other.year) return false
        if (months.first() != other.months.first()) return false
        if (months.last() != other.months.last()) return false

        return true
    }

    override fun hashCode(): Int {
        var result = year.hashCode()
        result = 31 * result + months.first().hashCode()
        result = 31 * result + months.last().hashCode()
        return result
    }

    override fun toString(): String {
        return "CalendarYear { " +
            "year = $year, " +
            "firstMonth = ${months.first()}, " +
            "lastMonth = ${months.last()} " +
            "} "
    }
}

```

### Core Architecture Module: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/core/DayPosition.kt`
```
package com.kizitonwose.calendar.core

/**
 * Describes the position of a [CalendarDay] in the month.
 */
public enum class DayPosition {
    /**
     * The day is positioned at the start of the month to
     * ensure proper alignment of the first day of the week.
     * The day belongs to the previous month on the calendar.
     */
    InDate,

    /**
     * The day belongs to the current month on the calendar.
     */
    MonthDate,

    /**
     * The day is positioned at the end of the month to
     * to fill the remaining days after the days in the month.
     * The day belongs to the next month on the calendar.
     * @see [OutDateStyle]
     */
    OutDate,
}

```

### Core Architecture Module: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/core/ExperimentalCalendarApi.kt`
```
package com.kizitonwose.calendar.core

@RequiresOptIn(
    message = "This calendar API is experimental and is " +
        "likely to change or to be removed in the future.",
    level = RequiresOptIn.Level.ERROR,
)
@Retention(AnnotationRetention.BINARY)
public annotation class ExperimentalCalendarApi

```

### Core Architecture Module: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/core/Extensions.kt`
```
package com.kizitonwose.calendar.core

import androidx.compose.ui.text.intl.Locale
import kotlinx.datetime.DateTimeArithmeticException
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.YearMonth
import kotlinx.datetime.minus
import kotlinx.datetime.plus
import kotlinx.datetime.todayIn
import kotlinx.datetime.until
import kotlinx.datetime.yearMonth
import kotlin.time.Clock

/**
 * Returns the days of week values such that the desired
 * [firstDayOfWeek] property is at the start position.
 *
 * @see [firstDayOfWeekFromLocale]
 */
public fun daysOfWeek(firstDayOfWeek: DayOfWeek = firstDayOfWeekFromLocale()): List<DayOfWeek> {
    val pivot = 7 - firstDayOfWeek.ordinal
    val daysOfWeek = DayOfWeek.entries
    // Order `daysOfWeek` array so that firstDayOfWeek is at the start position.
    return daysOfWeek.takeLast(pivot) + daysOfWeek.dropLast(pivot)
}

/**
 * Returns the first day of the week from the provided locale.
 */
public expect fun firstDayOfWeekFromLocale(locale: Locale = Locale.current): DayOfWeek

/**
 * Obtains the current [LocalDate] from the specified [clock] and [timeZone].
 *
 * Using this method allows the use of an alternate clock or timezone for testing.
 */
public fun LocalDate.Companion.now(
    clock: Clock = Clock.System,
    timeZone: TimeZone = TimeZone.currentSystemDefault(),
): LocalDate = clock.todayIn(timeZone)

/**
 * Obtains the current [YearMonth] from the specified [clock] and [timeZone].
 *
 * Using this method allows the use of an alternate clock or timezone for testing.
 */
public fun YearMonth.Companion.now(
    clock: Clock = Clock.System,
    timeZone: TimeZone = TimeZone.currentSystemDefault(),
): YearMonth = clock.todayIn(timeZone).yearMonth

/**
 * Returns a [LocalDate] that results from adding the [value] number of
 * days to this date.
 *
 * If the [value] is positive, the returned date is later than this date.
 * If the [value] is negative, the returned date is earlier than this date.
 *
 * @throws DateTimeArithmeticException if the result exceeds the boundaries of [LocalDate].
 */
public fun LocalDate.plusDays(value: Int): LocalDate = plus(value, DateTimeUnit.DAY)

/**
 * Returns a [LocalDate] that results from subtracting the [value] number of
 * days from this date.
 *
 * If the [value] is positive, the returned date is later than this date.
 * If the [value] is negative, the returned date is earlier than this date.
 *
 * @throws DateTimeArithmeticException if the result exceeds the boundaries of [LocalDate].
 */
public fun LocalDate.minusDays(value: Int): LocalDate = minus(value, DateTimeUnit.DAY)

/**
 * Returns a [LocalDate] that results from adding the [value] number of
 * months to this date.
 *
 * If the [value] is positive, the returned date is later than this date.
 * If the [value] is negative, the returned date is earlier than this date.
 *
 * @throws DateTimeArithmeticException if the result exceeds the boundaries of [LocalDate].
 */
public fun LocalDate.plusMonths(value: Int): LocalDate = plus(value, DateTimeUnit.MONTH)

/**
 * Returns a [LocalDate] that results from subtracting the [value] number of
 * months from this date.
 *
 * If the [value] is positive, the returned date is later than this date.
 * If the [value] is negative, the returned date is earlier than this date.
 *
 * @throws DateTimeArithmeticException if the result exceeds the boundaries of [LocalDate].
 */
public fun LocalDate.minusMonths(value: Int): LocalDate = minus(value, DateTimeUnit.MONTH)

/**
 * Returns a [LocalDate] that results from adding the [value] number of
 * years to this date.
 *
 * If the [value] is positive, the returned date is later than this date.
 * If the [value] is negative, the returned date is earlier than this date.
 *
 * @throws DateTimeArithmeticException if the result exceeds the boundaries of [LocalDate].
 */
public fun LocalDate.plusYears(value: Int): LocalDate = plus(value, DateTimeUnit.YEAR)

/**
 * Returns a [LocalDate] that results from subtracting the [value] number of
 * years from this date.
 *
 * If the [value] is positive, the returned date is later than this date.
 * If the [value] is negative, the returned date is earlier than this date.
 *
 * @throws DateTimeArithmeticException if the result exceeds the boundaries of [LocalDate].
 */
public fun LocalDate.minusYears(value: Int): LocalDate = minus(value, DateTimeUnit.YEAR)

/**
 * Returns a [YearMonth] that results from adding the [value] number of months
 * to this year-month.
 *
 * If the [value] is positive, the returned year-month is later than this year-month.
 * If the [value] is negative, the returned year-month is earlier than this year-month.
 *
 * @throws DateTimeArithmeticException if the result exceeds the boundaries
 * of [YearMonth] which is essentially the [LocalDate] boundaries.
 */
public fun YearMonth.plusMonths(value: Int): YearMonth = plus(value, DateTimeUnit.MONTH)

/**
 * Returns a [YearMonth] that results from subtracting the [value] number of months
 * from this year-month.
 *
 * If the [value] is positive, the returned year-month is later than this year-month.
 * If the [value] is negative, the returned year-month is earlier than this year-month.
 *
 * @throws DateTimeArithmeticException if the result exceeds the boundaries
 * of [YearMonth] which is essentially the [LocalDate] boundaries.
 */
public fun YearMonth.minusMonths(value: Int): YearMonth = minus(value, DateTimeUnit.MONTH)

/**
 * Returns a [YearMonth] that results from adding the [value] number of years
 * to this year-month.
 *
 * If the [value] is positive, the returned year-month is later than this year-month.
 * If the [value] is negative, the returned year-month is earlier than this year-month.
 *
 * @throws DateTimeArithmeticException if the result exceeds the boundaries
 * of [YearMonth] which is essentially the [LocalDate] boundaries.
 */
public fun YearMonth.plusYears(value: Int): YearMonth = plus(value, DateTimeUnit.YEAR)

/**
 * Returns a [YearMonth] that results from subtracting the [value] number of years
 * from this year-month.
 *
 * If the [value] is positive, the returned year-month is later than this year-month.
 * If the [value] is negative, the returned year-month is earlier than this year-month.
 *
 * @throws DateTimeArithmeticException if the result exceeds the boundaries
 * of [YearMonth] which is essentially the [LocalDate] boundaries.
 */
public fun YearMonth.minusYears(value: Int): YearMonth = minus(value, DateTimeUnit.YEAR)

internal fun LocalDate.plusWeeks(value: Int): LocalDate = plus(value, DateTimeUnit.WEEK)

internal fun LocalDate.minusWeeks(value: Int): LocalDate = minus(value, DateTimeUnit.WEEK)

internal fun LocalDate.weeksUntil(other: LocalDate): Int = until(other, DateTimeUnit.WEEK).toInt()

```

### Core Architecture Module: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/core/Week.kt`
```
package com.kizitonwose.calendar.core

import androidx.compose.runtime.Immutable

/**
 * Represents a week on the week-based calendar.
 *
 * @param days the days in this week.
 */
@Immutable
@ConsistentCopyVisibility
public data class Week internal constructor(val days: List<WeekDay>) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other == null || this::class != other::class) return false

        other as Week

        if (days.first() != other.days.first()) return false
        if (days.last() != other.days.last()) return false

        return true
    }

    override fun hashCode(): Int {
        var result = days.first().hashCode()
        result = 31 * result + days.last().hashCode()
        return result
    }

    override fun toString(): String {
        return "Week { " +
            "first = ${days.first()}, " +
            "last = ${days.last()} " +
            "} "
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #266** (2021-02-14): **outDateStyle="endOfRow" causes issue **
  *Symptoms*: Steps to reproduce:  1. Change line 100 in Example5Fragment to `        val daysOfWeek = DayOfWeek.values() // used to be = daysOfWeekFromLocale() `  1. Change outDateStyle to "endOfRow" in example_5_fragment.xml  1. Scroll to April. The last week is missing the first time you scroll to April. Going to another month and then coming back again, it works as expected
  **Post-Mortem & Fix Analysis**:
  > Have you had a chance to look at this yet @kizitonwose? 
  > Yes, was able to reproduce it. I have not had the time to work on a fix though.
  > Okay, just let me know when you do 😄 Awesome library by the way!

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

### Incident Patch 1: `21d25078` (2026-01-17)
**Commit Message**: Fix sample project toolbar

**File**: `compose-multiplatform/sample/src/commonMain/kotlin/App.kt` (modified, +1/-10)
```diff
@@ -1,9 +1,6 @@
-
-import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.BoxWithConstraints
 import androidx.compose.foundation.layout.Column
 import androidx.compose.foundation.layout.Row
-import androidx.compose.foundation.layout.fillMaxHeight
 import androidx.compose.foundation.layout.fillMaxSize
 import androidx.compose.material3.ExperimentalMaterial3Api
 import androidx.compose.material3.HorizontalDivider
@@ -24,7 +21,6 @@ import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.remember
 import androidx.compose.runtime.rememberCoroutineScope
 import androidx.compose.runtime.setValue
-import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.unit.dp
@@ -132,12 +128,7 @@ fun ExampleToolbar(
     modifier = modifier,
     colors = colors,
     title = {
-        Box(Modifier.fillMaxHeight()) {
-            Text(
-                modifier = Modifier.align(Alignment.Center),
-                text = title,
-            )
-        }
+        Text(text = title)
     },
     navigationIcon = navigationIcon,
 )
```

**File**: `compose-multiplatform/sample/src/commonMain/kotlin/Utils.kt` (modified, +3/-17)
```diff
@@ -1,33 +1,27 @@
+
 import androidx.compose.foundation.LocalIndication
 import androidx.compose.foundation.clickable
 import androidx.compose.foundation.gestures.animateScrollBy
 import androidx.compose.foundation.interaction.MutableInteractionSource
-import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.PaddingValues
-import androidx.compose.foundation.layout.aspectRatio
 import androidx.compose.foundation.layout.calculateEndPadding
 import androidx.compose.foundation.layout.calculateStartPadding
-import androidx.compose.foundation.layout.fillMaxHeight
-import androidx.compose.foundation.layout.padding
 import androidx.compose.foundation.lazy.LazyListState
-import androidx.compose.foundation.shape.CircleShape
 import androidx.compose.material.icons.Icons
 import androidx.compose.material.icons.automirrored.filled.ArrowBack
 import androidx.compose.material3.Icon
+import androidx.compose.material3.IconButton
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.LaunchedEffect
 import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.remember
 import androidx.compose.runtime.snapshotFlow
-import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.composed
-import androidx.compose.ui.draw.clip
 import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.graphics.vector.ImageVector
 import androidx.compose.ui.platform.LocalLayoutDirection
 import androidx.compose.ui.semantics.Role
-import androidx.compose.ui.unit.dp
 import com.kizitonwose.calendar.compose.CalendarLayoutInfo
 import com.kizitonwose.calendar.compose.CalendarState
 import com.kizitonwose.calendar.compose.weekcalendar.WeekCalendarState
@@ -77,17 +71,9 @@ fun NavigationIcon(
     imageVector: ImageVector = Icons.AutoMirrored.Filled.ArrowBack,
     onBackClick: () -> Unit,
 ) {
-    Box(
-        modifier = Modifier
-            .fillMaxHeight()
-            .aspectRatio(1f)
-            .padding(8.dp)
-            .clip(shape = CircleShape)
-            .clickable(role = Role.Button, onClick = onBackClick),
-    ) {
+    IconButton(onClick = onBackClick) {
         Icon(
             tint = tint,
-            modifier = Modifier.align(Alignment.Center),
             imageVector = imageVector,
             contentDescription = "Back",
         )
```

**File**: `sample/src/main/java/com/kizitonwose/calendar/sample/compose/Utils.kt` (modified, +2/-17)
```diff
@@ -4,34 +4,27 @@ import androidx.compose.foundation.LocalIndication
 import androidx.compose.foundation.clickable
 import androidx.compose.foundation.gestures.animateScrollBy
 import androidx.compose.foundation.interaction.MutableInteractionSource
-import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.PaddingValues
-import androidx.compose.foundation.layout.aspectRatio
 import androidx.compose.foundation.layout.calculateEndPadding
 import androidx.compose.foundation.layout.calculateStartPadding
-import androidx.compose.foundation.layout.fillMaxHeight
-import androidx.compose.foundation.layout.padding
 import androidx.compose.foundation.lazy.LazyListState
-import androidx.compose.foundation.shape.CircleShape
 import androidx.compose.material.icons.Icons
 import androidx.compose.material.icons.automirrored.filled.ArrowBack
 import androidx.compose.material3.Icon
+import androidx.compose.material3.IconButton
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.LaunchedEffect
 import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.remember
 import androidx.compose.runtime.snapshotFlow
-import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.composed
-import androidx.compose.ui.draw.clip
 import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.graphics.toArgb
 import androidx.compose.ui.platform.LocalContext
 import androidx.compose.ui.platform.LocalInspectionMode
 import androidx.compose.ui.platform.LocalLayoutDirection
 import androidx.compose.ui.semantics.Role
-import androidx.compose.ui.unit.dp
 import androidx.lifecycle.compose.LocalLifecycleOwner
 import com.kizitonwose.calendar.compose.CalendarLayoutInfo
 import com.kizitonwose.calendar.compose.CalendarState
@@ -89,17 +82,9 @@ fun StatusBarColorUpdateEffect(color: Color) {
 
 @Composable
 fun NavigationIcon(onBackClick: () -> Unit) {
-    Box(
-        modifier = Modifier
-            .fillMaxHeight()
-            .aspectRatio(1f)
-            .padding(8.dp)
-            .clip(shape = CircleShape)
-            .clickable(role = Role.Button, onClick = onBackClick),
-    ) {
+    IconButton(onClick = onBackClick) {
         Icon(
             tint = Color.White,
-            modifier = Modifier.align(Alignment.Center),
             imageVector = Icons.AutoMirrored.Filled.ArrowBack,
             contentDescription = "Back",
         )
```

---

### Incident Patch 2: `e7cb2593` (2026-01-17)
**Commit Message**: Lint fixes

**File**: `.editorconfig` (modified, +2/-0)
```diff
@@ -24,6 +24,8 @@ ktlint_standard_blank-line-before-declaration = disabled
 ktlint_standard_value-argument-comment = disabled
 ktlint_function_naming_ignore_when_annotated_with = Composable
 ktlint_standard_annotation = disabled
+ktlint_standard_when-entry-bracing = disabled
+ktlint_standard_blank-line-between-when-conditions = disabled
 max_line_length = 200
 
 [**/test/**/*.kt]
```

**File**: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/compose/ItemPlacementInfo.kt` (modified, +2/-2)
```diff
@@ -6,8 +6,8 @@ import androidx.compose.runtime.Stable
 import androidx.compose.runtime.withFrameNanos
 import androidx.compose.ui.layout.LayoutCoordinates
 import androidx.compose.ui.unit.round
+import kotlinx.coroutines.currentCoroutineContext
 import kotlinx.coroutines.isActive
-import kotlin.coroutines.coroutineContext
 
 @Immutable
 internal data class ItemCoordinates(
@@ -25,7 +25,7 @@ internal class ItemPlacementInfo {
 
     suspend fun awaitFistDayOffsetAndSize(orientation: Orientation): OffsetSize? {
         var itemCoordinates = this.itemCoordinates
-        while (coroutineContext.isActive && itemCoordinates == null) {
+        while (currentCoroutineContext().isActive && itemCoordinates == null) {
             withFrameNanos {}
             itemCoordinates = this.itemCoordinates
         }
```

**File**: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/compose/yearcalendar/YearItemPlacementInfo.kt` (modified, +2/-2)
```diff
@@ -7,8 +7,8 @@ import androidx.compose.runtime.withFrameNanos
 import androidx.compose.ui.layout.LayoutCoordinates
 import androidx.compose.ui.unit.round
 import com.kizitonwose.calendar.core.CalendarMonth
+import kotlinx.coroutines.currentCoroutineContext
 import kotlinx.coroutines.isActive
-import kotlin.coroutines.coroutineContext
 
 @Immutable
 internal data class YearItemCoordinates(
@@ -34,7 +34,7 @@ internal class YearItemPlacementInfo {
 
     suspend fun awaitFistMonthDayOffsetAndSize(orientation: Orientation): OffsetSize? {
         var itemCoordinates = this.itemCoordinates
-        while (coroutineContext.isActive && itemCoordinates == null) {
+        while (currentCoroutineContext().isActive && itemCoordinates == null) {
             withFrameNanos {}
             itemCoordinates = this.itemCoordinates
         }
```

**File**: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/core/Year.kt` (modified, +1/-1)
```diff
@@ -119,7 +119,7 @@ public fun Year.length(): Int = if (isLeap()) 366 else 365
 public fun Year.onDay(dayOfYear: Int): LocalDate {
     require(
         dayOfYear >= 1 &&
-            (dayOfYear <= 365 || isLeap() && dayOfYear <= 366),
+            (dayOfYear <= 365 || (isLeap() && dayOfYear <= 366)),
     ) {
         "Invalid dayOfYear value '$dayOfYear' for year '$year"
     }
```

**File**: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/core/deprecated/Extensions.kt` (modified, +6/-6)
```diff
@@ -3,26 +3,26 @@ package com.kizitonwose.calendar.core.deprecated
 import kotlinx.datetime.LocalDate
 import kotlinx.datetime.YearMonth
 
+/**
+ * Returns the first day of the year-month.
+ */
 @Deprecated(
     message = "Please use the `firstDay` property instead. " +
         "This is only available for migration purposes.",
     level = DeprecationLevel.ERROR,
     replaceWith = ReplaceWith("firstDay"),
 )
-/**
- * Returns the first day of the year-month.
- */
 public fun YearMonth.atStartOfMonth(): LocalDate = firstDay
 
+/**
+ * Returns the last day of the year-month.
+ */
 @Deprecated(
     message = "Please use the `lastDay` property instead. " +
         "This is only available for migration purposes.",
     level = DeprecationLevel.ERROR,
     replaceWith = ReplaceWith("lastDay"),
 )
-/**
- * Returns the last day of the year-month.
- */
 public fun YearMonth.atEndOfMonth(): LocalDate = lastDay
 
 // public fun YearMonth.lengthOfMonth(): Int = numberOfDays
```

**File**: `compose-multiplatform/sample/src/commonMain/kotlin/Example3Page.kt` (modified, +0/-1)
```diff
@@ -1,4 +1,3 @@
-
 import androidx.compose.foundation.Image
 import androidx.compose.foundation.background
 import androidx.compose.foundation.border
```

**File**: `compose-multiplatform/sample/src/commonMain/kotlin/Example4Page.kt` (modified, +0/-1)
```diff
@@ -1,4 +1,3 @@
-
 import androidx.compose.foundation.background
 import androidx.compose.foundation.border
 import androidx.compose.foundation.layout.Arrangement
```

**File**: `compose-multiplatform/sample/src/commonMain/kotlin/Example6Page.kt` (modified, +4/-2)
```diff
@@ -278,8 +278,10 @@ private fun getMonthWithYear(
                 // Ensure the Month + Year text can fit.
                 firstItem.size < daySizePx * 3 ||
                 // Ensure the week row size - 1 is visible.
-                firstItem.offset < layoutInfo.viewportStartOffset &&
-                (layoutInfo.viewportStartOffset - firstItem.offset > daySizePx)
+                (
+                    firstItem.offset < layoutInfo.viewportStartOffset &&
+                        layoutInfo.viewportStartOffset - firstItem.offset > daySizePx
+                )
             ) {
                 visibleItemsInfo[1].month.yearMonth
             } else {
```

---

### Incident Patch 3: `5c617511` (2026-01-15)
**Commit Message**: Remove ExperimentalCalendarApi requirement for year calendar.

**File**: `compose-multiplatform/library/api/android/library.api` (modified, +10/-0)
```diff
@@ -12,7 +12,9 @@ public final class com/kizitonwose/calendar/compose/CalendarItemInfo : androidx/
 public final class com/kizitonwose/calendar/compose/CalendarKt {
 	public static final fun HeatMapCalendar (Landroidx/compose/ui/Modifier;Lcom/kizitonwose/calendar/compose/heatmapcalendar/HeatMapCalendarState;Lcom/kizitonwose/calendar/compose/heatmapcalendar/HeatMapWeekHeaderPosition;ZLandroidx/compose/foundation/layout/PaddingValues;Lkotlin/jvm/functions/Function5;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function4;Landroidx/compose/runtime/Composer;II)V
 	public static final fun HorizontalCalendar (Landroidx/compose/ui/Modifier;Lcom/kizitonwose/calendar/compose/CalendarState;ZZZLandroidx/compose/foundation/layout/PaddingValues;Lcom/kizitonwose/calendar/compose/ContentHeightMode;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Landroidx/compose/runtime/Composer;III)V
+	public static final fun HorizontalYearCalendar-Y3kUhCI (Landroidx/compose/ui/Modifier;Lcom/kizitonwose/calendar/compose/yearcalendar/YearCalendarState;IZZZLandroidx/compose/foundation/layout/PaddingValues;Landroidx/compose/foundation/layout/PaddingValues;FFLcom/kizitonwose/calendar/compose/yearcalendar/YearContentHeightMode;Lkotlin/jvm/functions/Function1;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Landroidx/compose/runtime/Composer;IIII)V
 	public static final fun VerticalCalendar (Landroidx/compose/ui/Modifier;Lcom/kizitonwose/calendar/compose/CalendarState;ZZZLandroidx/compose/foundation/layout/PaddingValues;Lcom/kizitonwose/calendar/compose/ContentHeightMode;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Landroidx/compose/runtime/Composer;III)V
+	public static final fun VerticalYearCalendar-Y3kUhCI (Landroidx/compose/ui/Modifier;Lcom/kizitonwose/calendar/compose/yearcalendar/YearCalendarState;IZZZLandroidx/compose/foundation/layout/PaddingValues;Landroidx/compose/foundation/layout/PaddingValues;FFLcom/kizitonwose/calendar/compose/yearcalendar/YearContentHeightMode;Lkotlin/jvm/functions/Function1;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Landroidx/compose/runtime/Composer;IIII)V
 	public static final fun WeekCalendar (Landroidx/compose/ui/Modifier;Lcom/kizitonwose/calendar/compose/weekcalendar/WeekCalendarState;ZZZLandroidx/compose/foundation/layout/PaddingValues;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Landroidx/compose/runtime/Composer;II)V
 }
 
@@ -51,6 +53,7 @@ public final class com/kizitonwose/calendar/compose/CalendarState : androidx/com
 	public final fun getLastVisibleMonth ()Lcom/kizitonwose/calendar/core/CalendarMonth;
 	public final fun getLayoutInfo ()Lcom/kizitonwose/calendar/compose/CalendarLayoutInfo;
 	public final fun getOutDateStyle ()Lcom/kizitonwose/calendar/core/OutDateStyle;
+	public fun getScrollIndicatorState ()Landroidx/compose/foundation/ScrollIndicatorState;
 	public final fun getStartMonth ()Lkotlinx/datetime/YearMonth;
 	public fun isScrollInProgress ()Z
 	public fun scroll (Landroidx/compose/foundation/MutatePriority;Lkotlin/jvm/functions/Function2;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;
@@ -101,6 +104,7 @@ public final class com/kizitonwose/calendar/compose/heatmapcalendar/HeatMapCalen
 	public fun getLastScrolledForward ()Z
 	public final fun getLastVisibleMonth ()Lcom/kizitonwose/calendar/core/CalendarMonth;
 	public final fun getLayoutInfo ()Lcom/kizitonwose/calendar/compose/CalendarLayoutInfo;
+	public fun getScrollIndicatorState ()Landroidx/compose/foundation/ScrollIndicatorState;
 	public final fun getStartMonth ()Lkotlinx/datetime/YearMonth;
 	public fun isScrollInProgress ()Z
 	public fun scroll (Landroidx/compose/foundation/MutatePriority;Lkotlin/jvm/functions/Function2;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;
@@ -188,6 +192,7 @@ public final class com/kizitonwose/calendar/compose/weekcalendar/WeekCalendarSta
 	public fun getLastScrolledForward ()Z
 	public final fun getLastVisibleWeek ()Lcom/kizitonwose/calendar/core/Week;
 	public final fun getLayoutInfo ()Lcom/kizitonwose/calendar/compose/weekcalendar/WeekCalendarLayoutInfo;
+	public fun getScrollIndicatorState ()Landroidx/compose/foundation/ScrollIndicatorState;
 	public final fun getStartDate ()Lkotlinx/datetime/LocalDate;
 	
```

**File**: `compose-multiplatform/library/api/desktop/library.api` (modified, +10/-0)
```diff
@@ -12,7 +12,9 @@ public final class com/kizitonwose/calendar/compose/CalendarItemInfo : androidx/
 public final class com/kizitonwose/calendar/compose/CalendarKt {
 	public static final fun HeatMapCalendar (Landroidx/compose/ui/Modifier;Lcom/kizitonwose/calendar/compose/heatmapcalendar/HeatMapCalendarState;Lcom/kizitonwose/calendar/compose/heatmapcalendar/HeatMapWeekHeaderPosition;ZLandroidx/compose/foundation/layout/PaddingValues;Lkotlin/jvm/functions/Function5;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function4;Landroidx/compose/runtime/Composer;II)V
 	public static final fun HorizontalCalendar (Landroidx/compose/ui/Modifier;Lcom/kizitonwose/calendar/compose/CalendarState;ZZZLandroidx/compose/foundation/layout/PaddingValues;Lcom/kizitonwose/calendar/compose/ContentHeightMode;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Landroidx/compose/runtime/Composer;III)V
+	public static final fun HorizontalYearCalendar-Y3kUhCI (Landroidx/compose/ui/Modifier;Lcom/kizitonwose/calendar/compose/yearcalendar/YearCalendarState;IZZZLandroidx/compose/foundation/layout/PaddingValues;Landroidx/compose/foundation/layout/PaddingValues;FFLcom/kizitonwose/calendar/compose/yearcalendar/YearContentHeightMode;Lkotlin/jvm/functions/Function1;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Landroidx/compose/runtime/Composer;IIII)V
 	public static final fun VerticalCalendar (Landroidx/compose/ui/Modifier;Lcom/kizitonwose/calendar/compose/CalendarState;ZZZLandroidx/compose/foundation/layout/PaddingValues;Lcom/kizitonwose/calendar/compose/ContentHeightMode;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Landroidx/compose/runtime/Composer;III)V
+	public static final fun VerticalYearCalendar-Y3kUhCI (Landroidx/compose/ui/Modifier;Lcom/kizitonwose/calendar/compose/yearcalendar/YearCalendarState;IZZZLandroidx/compose/foundation/layout/PaddingValues;Landroidx/compose/foundation/layout/PaddingValues;FFLcom/kizitonwose/calendar/compose/yearcalendar/YearContentHeightMode;Lkotlin/jvm/functions/Function1;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Landroidx/compose/runtime/Composer;IIII)V
 	public static final fun WeekCalendar (Landroidx/compose/ui/Modifier;Lcom/kizitonwose/calendar/compose/weekcalendar/WeekCalendarState;ZZZLandroidx/compose/foundation/layout/PaddingValues;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function4;Lkotlin/jvm/functions/Function5;Landroidx/compose/runtime/Composer;II)V
 }
 
@@ -51,6 +53,7 @@ public final class com/kizitonwose/calendar/compose/CalendarState : androidx/com
 	public final fun getLastVisibleMonth ()Lcom/kizitonwose/calendar/core/CalendarMonth;
 	public final fun getLayoutInfo ()Lcom/kizitonwose/calendar/compose/CalendarLayoutInfo;
 	public final fun getOutDateStyle ()Lcom/kizitonwose/calendar/core/OutDateStyle;
+	public fun getScrollIndicatorState ()Landroidx/compose/foundation/ScrollIndicatorState;
 	public final fun getStartMonth ()Lkotlinx/datetime/YearMonth;
 	public fun isScrollInProgress ()Z
 	public fun scroll (Landroidx/compose/foundation/MutatePriority;Lkotlin/jvm/functions/Function2;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;
@@ -101,6 +104,7 @@ public final class com/kizitonwose/calendar/compose/heatmapcalendar/HeatMapCalen
 	public fun getLastScrolledForward ()Z
 	public final fun getLastVisibleMonth ()Lcom/kizitonwose/calendar/core/CalendarMonth;
 	public final fun getLayoutInfo ()Lcom/kizitonwose/calendar/compose/CalendarLayoutInfo;
+	public fun getScrollIndicatorState ()Landroidx/compose/foundation/ScrollIndicatorState;
 	public final fun getStartMonth ()Lkotlinx/datetime/YearMonth;
 	public fun isScrollInProgress ()Z
 	public fun scroll (Landroidx/compose/foundation/MutatePriority;Lkotlin/jvm/functions/Function2;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;
@@ -188,6 +192,7 @@ public final class com/kizitonwose/calendar/compose/weekcalendar/WeekCalendarSta
 	public fun getLastScrolledForward ()Z
 	public final fun getLastVisibleWeek ()Lcom/kizitonwose/calendar/core/Week;
 	public final fun getLayoutInfo ()Lcom/kizitonwose/calendar/compose/weekcalendar/WeekCalendarLayoutInfo;
+	public fun getScrollIndicatorState ()Landroidx/compose/foundation/ScrollIndicatorState;
 	public final fun getStartDate ()Lkotlinx/datetime/LocalDate;
 	
```

**File**: `compose-multiplatform/library/api/library.klib.api` (modified, +3/-0)
```diff
@@ -538,9 +538,12 @@ final fun com.kizitonwose.calendar.compose.weekcalendar/rememberWeekCalendarStat
 final fun com.kizitonwose.calendar.compose.yearcalendar/com_kizitonwose_calendar_compose_yearcalendar_YearCalendarItemInfo$stableprop_getter(): kotlin/Int // com.kizitonwose.calendar.compose.yearcalendar/com_kizitonwose_calendar_compose_yearcalendar_YearCalendarItemInfo$stableprop_getter|com_kizitonwose_calendar_compose_yearcalendar_YearCalendarItemInfo$stableprop_getter(){}[0]
 final fun com.kizitonwose.calendar.compose.yearcalendar/com_kizitonwose_calendar_compose_yearcalendar_YearCalendarLayoutInfo$stableprop_getter(): kotlin/Int // com.kizitonwose.calendar.compose.yearcalendar/com_kizitonwose_calendar_compose_yearcalendar_YearCalendarLayoutInfo$stableprop_getter|com_kizitonwose_calendar_compose_yearcalendar_YearCalendarLayoutInfo$stableprop_getter(){}[0]
 final fun com.kizitonwose.calendar.compose.yearcalendar/com_kizitonwose_calendar_compose_yearcalendar_YearCalendarState$stableprop_getter(): kotlin/Int // com.kizitonwose.calendar.compose.yearcalendar/com_kizitonwose_calendar_compose_yearcalendar_YearCalendarState$stableprop_getter|com_kizitonwose_calendar_compose_yearcalendar_YearCalendarState$stableprop_getter(){}[0]
+final fun com.kizitonwose.calendar.compose.yearcalendar/rememberYearCalendarState(com.kizitonwose.calendar.core/Year?, com.kizitonwose.calendar.core/Year?, com.kizitonwose.calendar.core/Year?, kotlinx.datetime/DayOfWeek?, com.kizitonwose.calendar.core/OutDateStyle?, androidx.compose.runtime/Composer?, kotlin/Int, kotlin/Int): com.kizitonwose.calendar.compose.yearcalendar/YearCalendarState // com.kizitonwose.calendar.compose.yearcalendar/rememberYearCalendarState|rememberYearCalendarState(com.kizitonwose.calendar.core.Year?;com.kizitonwose.calendar.core.Year?;com.kizitonwose.calendar.core.Year?;kotlinx.datetime.DayOfWeek?;com.kizitonwose.calendar.core.OutDateStyle?;androidx.compose.runtime.Composer?;kotlin.Int;kotlin.Int){}[0]
 final fun com.kizitonwose.calendar.compose/HeatMapCalendar(androidx.compose.ui/Modifier?, com.kizitonwose.calendar.compose.heatmapcalendar/HeatMapCalendarState?, com.kizitonwose.calendar.compose.heatmapcalendar/HeatMapWeekHeaderPosition?, kotlin/Boolean, androidx.compose.foundation.layout/PaddingValues?, kotlin/Function5<androidx.compose.foundation.layout/ColumnScope, com.kizitonwose.calendar.core/CalendarDay, com.kizitonwose.calendar.compose.heatmapcalendar/HeatMapWeek, androidx.compose.runtime/Composer, kotlin/Int, kotlin/Unit>, kotlin/Function4<androidx.compose.foundation.layout/ColumnScope, kotlinx.datetime/DayOfWeek, androidx.compose.runtime/Composer, kotlin/Int, kotlin/Unit>?, kotlin/Function4<androidx.compose.foundation.layout/ColumnScope, com.kizitonwose.calendar.core/CalendarMonth, androidx.compose.runtime/Composer, kotlin/Int, kotlin/Unit>?, androidx.compose.runtime/Composer?, kotlin/Int, kotlin/Int) // com.kizitonwose.calendar.compose/HeatMapCalendar|HeatMapCalendar(androidx.compose.ui.Modifier?;com.kizitonwose.calendar.compose.heatmapcalendar.HeatMapCalendarState?;com.kizitonwose.calendar.compose.heatmapcalendar.HeatMapWeekHeaderPosition?;kotlin.Boolean;androidx.compose.foundation.layout.PaddingValues?;kotlin.Function5<androidx.compose.foundation.layout.ColumnScope,com.kizitonwose.calendar.core.CalendarDay,com.kizitonwose.calendar.compose.heatmapcalendar.HeatMapWeek,androidx.compose.runtime.Composer,kotlin.Int,kotlin.Unit>;kotlin.Function4<androidx.compose.foundation.layout.ColumnScope,kotlinx.datetime.DayOfWeek,androidx.compose.runtime.Composer,kotlin.Int,kotlin.Unit>?;kotlin.Function4<androidx.compose.foundation.layout.ColumnScope,com.kizitonwose.calendar.core.CalendarMonth,androidx.compose.runtime.Composer,kotlin.Int,kotlin.Unit>?;androidx.compose.runtime.Composer?;kotlin.Int;kotlin.Int){}[0]
 final fun com.kizitonwose.calendar.compose/HorizontalCalendar(androidx.compose.ui/Modifier?, com.kizitonwose.calendar.compose/CalendarState?, kotlin/Boolean, kotlin/Boolean, kotlin/Boolean, androidx.compose.foundation.layout/PaddingValues?, com.kizitonwose.calendar.compose/ContentHeightMode?, kotlin/Function4<androidx.compose.foundation.layout/BoxScope, com.kizitonwose.calendar.core/CalendarDay, androidx.compose.runtime/Composer, kotlin/Int, kotlin/Unit>, kotlin/Function4<androidx.compose.foundation.layout/ColumnScope, com.kizitonwose.calendar.core/CalendarMonth, androidx.compose.runtime/Composer, kotlin/Int, kotlin/Unit>?, kotlin/Function5<androidx.compose.foundation.layout/ColumnScope, com.kizitonwose.calendar.core/CalendarMonth, kotlin/Function2<androidx.compose.runtime/Composer, kotlin/Int, kotlin/Unit>, androidx.compose.runtime/Composer, kotlin/Int, kotlin/Unit>?, kotlin/Function4<androidx.compose.foundation.layout/ColumnScope, com.kizitonwose.calendar.core/CalendarMonth, androidx.compose.runtime/Composer, kotlin/Int, kotlin/Unit>?, kotlin/Function5<androidx.compose.foundation.lazy/LazyItemScope, com.kizitonwose.calendar.core/CalendarMonth, kotlin/Functi
```

**File**: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/compose/Calendar.kt` (modified, +0/-3)
```diff
@@ -29,7 +29,6 @@ import com.kizitonwose.calendar.compose.yearcalendar.rememberYearCalendarState
 import com.kizitonwose.calendar.core.CalendarDay
 import com.kizitonwose.calendar.core.CalendarMonth
 import com.kizitonwose.calendar.core.CalendarYear
-import com.kizitonwose.calendar.core.ExperimentalCalendarApi
 import com.kizitonwose.calendar.core.Week
 import com.kizitonwose.calendar.core.WeekDay
 import kotlinx.datetime.DayOfWeek
@@ -369,7 +368,6 @@ public fun HeatMapCalendar(
  * The actual container content is provided in the block and must be called after your desired
  * customisations are rendered.
  */
-@ExperimentalCalendarApi
 @Composable
 public fun HorizontalYearCalendar(
     modifier: Modifier = Modifier,
@@ -473,7 +471,6 @@ public fun HorizontalYearCalendar(
  * The actual container content is provided in the block and must be called after your desired
  * customisations are rendered.
  */
-@ExperimentalCalendarApi
 @Composable
 public fun VerticalYearCalendar(
     modifier: Modifier = Modifier,
```

**File**: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/compose/yearcalendar/YearCalendarState.kt` (modified, +0/-2)
```diff
@@ -22,7 +22,6 @@ import com.kizitonwose.calendar.core.CalendarDay
 import com.kizitonwose.calendar.core.CalendarMonth
 import com.kizitonwose.calendar.core.CalendarYear
 import com.kizitonwose.calendar.core.DayPosition
-import com.kizitonwose.calendar.core.ExperimentalCalendarApi
 import com.kizitonwose.calendar.core.OutDateStyle
 import com.kizitonwose.calendar.core.Year
 import com.kizitonwose.calendar.core.firstDayOfWeekFromLocale
@@ -49,7 +48,6 @@ import kotlinx.datetime.YearMonth
  * @param firstVisibleYear the initial value for [YearCalendarState.firstVisibleYear]
  * @param outDateStyle the initial value for [YearCalendarState.outDateStyle]
  */
-@ExperimentalCalendarApi
 @Composable
 public fun rememberYearCalendarState(
     startYear: Year = Year.now(),
```

**File**: `compose-multiplatform/sample/src/commonMain/kotlin/Example10Page.kt` (modified, +0/-3)
```diff
@@ -1,4 +1,3 @@
-
 import androidx.compose.foundation.ExperimentalFoundationApi
 import androidx.compose.foundation.background
 import androidx.compose.foundation.gestures.snapping.SnapPosition
@@ -42,7 +41,6 @@ import com.kizitonwose.calendar.compose.yearcalendar.rememberYearCalendarState
 import com.kizitonwose.calendar.core.CalendarDay
 import com.kizitonwose.calendar.core.CalendarMonth
 import com.kizitonwose.calendar.core.DayPosition
-import com.kizitonwose.calendar.core.ExperimentalCalendarApi
 import com.kizitonwose.calendar.core.Year
 import com.kizitonwose.calendar.core.daysOfWeek
 import com.kizitonwose.calendar.core.minusYears
@@ -52,7 +50,6 @@ import kotlinx.coroutines.launch
 import org.jetbrains.compose.ui.tooling.preview.Preview
 import kotlin.math.abs
 
-@OptIn(ExperimentalCalendarApi::class)
 @Composable
 fun Example10Page(adjacentYears: Int = 50) {
     val currentYear = remember { Year.now() }
```

**File**: `compose-multiplatform/sample/src/commonMain/kotlin/Example11Page.kt` (modified, +0/-2)
```diff
@@ -31,15 +31,13 @@ import com.kizitonwose.calendar.compose.yearcalendar.rememberYearCalendarState
 import com.kizitonwose.calendar.core.CalendarDay
 import com.kizitonwose.calendar.core.CalendarMonth
 import com.kizitonwose.calendar.core.DayPosition
-import com.kizitonwose.calendar.core.ExperimentalCalendarApi
 import com.kizitonwose.calendar.core.Year
 import com.kizitonwose.calendar.core.daysOfWeek
 import com.kizitonwose.calendar.core.now
 import com.kizitonwose.calendar.core.plusYears
 import kotlinx.datetime.YearMonth
 import org.jetbrains.compose.ui.tooling.preview.Preview
 
-@OptIn(ExperimentalCalendarApi::class)
 @Composable
 fun Example11Page(adjacentYears: Int = 50) {
     val currentMonth = remember { YearMonth.now() }
```

**File**: `compose-multiplatform/sample/src/commonMain/kotlin/Example9PageAnimatedVisibility.kt` (modified, +0/-1)
```diff
@@ -1,4 +1,3 @@
-
 import Example9PageSharedComponents.CalendarHeader
 import Example9PageSharedComponents.Day
 import Example9PageSharedComponents.MonthAndWeekCalendarTitle
```

---

### Incident Patch 4: `7eb03e2a` (2025-08-21)
**Commit Message**: Merge pull request #629 from taeseong-yoon/fix/example3-occur-bug-scrolling

**File**: `sample/src/main/java/com/kizitonwose/calendar/sample/compose/Utils.kt` (modified, +2/-2)
```diff
@@ -220,11 +220,11 @@ private val CalendarLayoutInfo.completelyVisibleMonths: List<CalendarMonth>
             val lastItem = visibleItemsInfo.last()
             val viewportSize = this.viewportEndOffset + this.viewportStartOffset
             if (lastItem.offset + lastItem.size > viewportSize) {
-                visibleItemsInfo.removeLast()
+                visibleItemsInfo.removeAt(visibleItemsInfo.lastIndex)
             }
             val firstItem = visibleItemsInfo.firstOrNull()
             if (firstItem != null && firstItem.offset < this.viewportStartOffset) {
-                visibleItemsInfo.removeFirst()
+                visibleItemsInfo.removeAt(0)
             }
             visibleItemsInfo.map { it.month }
         }
```

---

### Incident Patch 5: `773c6bb2` (2025-08-21)
**Commit Message**: fix : Example3 occurs bug when scrolling content

By Issued #628

**File**: `sample/src/main/java/com/kizitonwose/calendar/sample/compose/Utils.kt` (modified, +2/-2)
```diff
@@ -220,11 +220,11 @@ private val CalendarLayoutInfo.completelyVisibleMonths: List<CalendarMonth>
             val lastItem = visibleItemsInfo.last()
             val viewportSize = this.viewportEndOffset + this.viewportStartOffset
             if (lastItem.offset + lastItem.size > viewportSize) {
-                visibleItemsInfo.removeLast()
+                visibleItemsInfo.removeAt(visibleItemsInfo.lastIndex)
             }
             val firstItem = visibleItemsInfo.firstOrNull()
             if (firstItem != null && firstItem.offset < this.viewportStartOffset) {
-                visibleItemsInfo.removeFirst()
+                visibleItemsInfo.removeAt(0)
             }
             visibleItemsInfo.map { it.month }
         }
```

---

### Incident Patch 6: `7573ffe9` (2025-07-15)
**Commit Message**: Fix lint

**File**: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/core/deprecated/Extensions.kt` (modified, +5/-5)
```diff
@@ -25,8 +25,8 @@ public fun YearMonth.atStartOfMonth(): LocalDate = firstDay
  */
 public fun YearMonth.atEndOfMonth(): LocalDate = lastDay
 
-//public fun YearMonth.lengthOfMonth(): Int = numberOfDays
-//public fun YearMonth.atDay(day: Int): LocalDate = onDay(day)
-//public fun Year.atDay(dayOfYear: Int): LocalDate = onDay(dayOfYear)
-//public fun Year.atMonth(month: Month): YearMonth = onMonth(month)
-//public fun Year.atMonthDay(month: Month, day: Int): LocalDate = onMonthDay(month, day)
+// public fun YearMonth.lengthOfMonth(): Int = numberOfDays
+// public fun YearMonth.atDay(day: Int): LocalDate = onDay(day)
+// public fun Year.atDay(dayOfYear: Int): LocalDate = onDay(dayOfYear)
+// public fun Year.atMonth(month: Month): YearMonth = onMonth(month)
+// public fun Year.atMonthDay(month: Month, day: Int): LocalDate = onMonthDay(month, day)
```

---

### Incident Patch 7: `4e97a855` (2025-07-14)
**Commit Message**: Fix warnings

**File**: `view/src/main/java/com/kizitonwose/calendar/view/MarginValues.kt` (modified, +4/-4)
```diff
@@ -3,10 +3,10 @@ package com.kizitonwose.calendar.view
 import androidx.annotation.Px
 
 public data class MarginValues(
-    @Px val start: Int = 0,
-    @Px val top: Int = 0,
-    @Px val end: Int = 0,
-    @Px val bottom: Int = 0,
+    @param:Px val start: Int = 0,
+    @param:Px val top: Int = 0,
+    @param:Px val end: Int = 0,
+    @param:Px val bottom: Int = 0,
 ) {
     public constructor(
         @Px horizontal: Int = 0,
```

---

### Incident Patch 8: `eebe8d2d` (2025-07-14)
**Commit Message**: Use `on` prefix for `Year` extensions to match `YearMonth`

**File**: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/core/Year.kt` (modified, +7/-7)
```diff
@@ -19,7 +19,7 @@ public data class Year(val value: Int) : Comparable<Year> {
 
     init {
         try {
-            atMonth(Month.JANUARY)
+            onMonth(Month.JANUARY)
         } catch (e: IllegalArgumentException) {
             throw IllegalArgumentException("Year value $value is out of range", e)
         }
@@ -116,15 +116,15 @@ public fun Year.length(): Int = if (isLeap()) 366 else 365
  *
  * @throws IllegalArgumentException if [dayOfYear] value is invalid in this year.
  */
-public fun Year.atDay(dayOfYear: Int): LocalDate {
+public fun Year.onDay(dayOfYear: Int): LocalDate {
     require(
         dayOfYear >= 1 &&
             (dayOfYear <= 365 || isLeap() && dayOfYear <= 366),
     ) {
         "Invalid dayOfYear value '$dayOfYear' for year '$year"
     }
     for (month in Month.entries) {
-        val yearMonth = atMonth(month)
+        val yearMonth = onMonth(month)
         if (yearMonth.lastDay.dayOfYear >= dayOfYear) {
             return yearMonth.onDay((dayOfYear - yearMonth.firstDay.dayOfYear) + 1)
         }
@@ -138,26 +138,26 @@ public fun Year.atDay(dayOfYear: Int): LocalDate {
  * @throws IllegalArgumentException if either [monthNumber] is invalid or the [day] value
  * is invalid in the resolved calendar [Month].
  */
-public fun Year.atMonthDay(monthNumber: Int, day: Int): LocalDate = LocalDate(year, monthNumber, day)
+public fun Year.onMonthDay(monthNumber: Int, day: Int): LocalDate = LocalDate(year, monthNumber, day)
 
 /**
  * Returns the [LocalDate] at the specified [month] and [day] in this year.
  *
  * @throws IllegalArgumentException if the [day] value is invalid in the resolved calendar [Month].
  */
-public fun Year.atMonthDay(month: Month, day: Int): LocalDate = LocalDate(year, month, day)
+public fun Year.onMonthDay(month: Month, day: Int): LocalDate = LocalDate(year, month, day)
 
 /**
  * Returns the [YearMonth] at the specified [month] in this year.
  */
-public fun Year.atMonth(month: Month): YearMonth = YearMonth(year, month)
+public fun Year.onMonth(month: Month): YearMonth = YearMonth(year, month)
 
 /**
  * Returns the [YearMonth] at the specified [monthNumber] in this year.
  *
  * @throws IllegalArgumentException if either [monthNumber] is invalid.
  */
-public fun Year.atMonth(monthNumber: Int): YearMonth = YearMonth(year, monthNumber)
+public fun Year.onMonth(monthNumber: Int): YearMonth = YearMonth(year, monthNumber)
 
 /**
  * Returns the number of whole years between two year values.
```

**File**: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/core/format/Format.kt` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 package com.kizitonwose.calendar.core.format
 
 import com.kizitonwose.calendar.core.Year
-import com.kizitonwose.calendar.core.atMonth
+import com.kizitonwose.calendar.core.onMonth
 import kotlinx.datetime.LocalDate
 import kotlinx.datetime.YearMonth
 
@@ -21,7 +21,7 @@ internal fun LocalDate.toIso8601String() = ISO_LOCAL_DATE.format(this)
 
 internal fun YearMonth.toIso8601String() = ISO_YEAR_MONTH.format(this)
 
-internal fun Year.toIso8601String() = ISO_YEAR.format(atMonth(1).firstDay)
+internal fun Year.toIso8601String() = ISO_YEAR.format(onMonth(1).firstDay)
 
 internal fun String.fromIso8601LocalDate(): LocalDate =
     LocalDate.parse(this, ISO_LOCAL_DATE)
```

**File**: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/data/YearData.kt` (modified, +2/-2)
```diff
@@ -3,7 +3,7 @@ package com.kizitonwose.calendar.data
 import com.kizitonwose.calendar.core.CalendarYear
 import com.kizitonwose.calendar.core.OutDateStyle
 import com.kizitonwose.calendar.core.Year
-import com.kizitonwose.calendar.core.atMonth
+import com.kizitonwose.calendar.core.onMonth
 import com.kizitonwose.calendar.core.plusYears
 import com.kizitonwose.calendar.core.yearsUntil
 import kotlinx.datetime.DayOfWeek
@@ -18,7 +18,7 @@ internal fun getCalendarYearData(
     val year = startYear.plusYears(offset)
     val months = List(Month.entries.size) { index ->
         getCalendarMonthData(
-            startMonth = year.atMonth(Month.JANUARY),
+            startMonth = year.onMonth(Month.JANUARY),
             offset = index,
             firstDayOfWeek = firstDayOfWeek,
             outDateStyle = outDateStyle,
```

**File**: `compose-multiplatform/library/src/commonTest/kotlin/com/kizitonwose/calendar/core/YearTest.kt` (modified, +8/-8)
```diff
@@ -63,7 +63,7 @@ class YearTest {
     fun atMonth() {
         for (year in listOf(0, -400, 2024, 1, 1999)) {
             for (month in Month.entries) {
-                assertEquals(YearMonth(year, month), Year(year).atMonth(month))
+                assertEquals(YearMonth(year, month), Year(year).onMonth(month))
             }
         }
     }
@@ -72,7 +72,7 @@ class YearTest {
     fun atMonthNumber() {
         for (year in listOf(0, -400, 2024, 1, 1999)) {
             for (month in Month.entries) {
-                assertEquals(YearMonth(year, month.number), Year(year).atMonth(month))
+                assertEquals(YearMonth(year, month.number), Year(year).onMonth(month))
             }
         }
     }
@@ -93,12 +93,12 @@ class YearTest {
         )
 
         for ((year, month, day) in validDays) {
-            assertEquals(LocalDate(year, month, day), Year(year).atMonthDay(month, day))
+            assertEquals(LocalDate(year, month, day), Year(year).onMonthDay(month, day))
         }
 
         for ((year, month, day) in invalidDays) {
             assertFailsWith(IllegalArgumentException::class) {
-                Year(year).atMonthDay(month, day)
+                Year(year).onMonthDay(month, day)
             }
         }
     }
@@ -119,12 +119,12 @@ class YearTest {
         )
 
         for ((year, monthNumber, day) in validDays) {
-            assertEquals(LocalDate(year, monthNumber, day), Year(year).atMonthDay(monthNumber, day))
+            assertEquals(LocalDate(year, monthNumber, day), Year(year).onMonthDay(monthNumber, day))
         }
 
         for ((year, monthNumber, day) in invalidDays) {
             assertFailsWith(IllegalArgumentException::class) {
-                Year(year).atMonthDay(monthNumber, day)
+                Year(year).onMonthDay(monthNumber, day)
             }
         }
     }
@@ -145,12 +145,12 @@ class YearTest {
         )
 
         for ((year, dayOfYear, date) in validDays) {
-            assertEquals(date, Year(year).atDay(dayOfYear))
+            assertEquals(date, Year(year).onDay(dayOfYear))
         }
 
         for ((year, dayOfYear) in invalidDays) {
             assertFailsWith(IllegalArgumentException::class) {
-                Year(year).atDay(dayOfYear)
+                Year(year).onDay(dayOfYear)
             }
         }
     }
```

---

### Incident Patch 9: `4a728948` (2025-06-10)
**Commit Message**: Merge pull request #619 from noritaka1166/fix-typos

**File**: `docs/View.md` (modified, +1/-1)
```diff
@@ -403,7 +403,7 @@ calendarView.dayBinder = object : MonthDayBinder<DayViewContainer> {
     1. **followDaySize**: Each month row height is determined by the `daySize` value set on the calendar. Effectively, this is `wrap-content` if the value is `Square`,
     `SeventhWidth`, or `FreeForm`, and will be equal to the calendar height divided by the number of rows if the value is `Rectangle`. When used together with `Rectangle`, 
     the calendar months and days will uniformly stretch to fill the parent's height.
-    2. **fill**: Each month row height will be the calender height divided by the number of rows on the calendar. This means that the calendar months will be distributed
+    2. **fill**: Each month row height will be the calendar height divided by the number of rows on the calendar. This means that the calendar months will be distributed
     uniformly to fill the parent's height. However, the day content height will independently determine its height. This allows you to spread the calendar months evenly across the screen while
     a `daySize` value of `Square` if you want square day content or `SeventhWidth` if you want to set a specific height value for the day content.
 
```

**File**: `sample/src/androidTest/java/com/kizitonwose/calendar/sample/CalendarComposeTest.kt` (modified, +7/-7)
```diff
@@ -97,7 +97,7 @@ class CalendarComposeTest {
     }
 
     @Test
-    fun squareCalenderDaysWorkAsExpected() {
+    fun squareCalendarDaysWorkAsExpected() {
         composeTestRule.setContent {
             Example1Page()
         }
@@ -115,7 +115,7 @@ class CalendarComposeTest {
     }
 
     @Test
-    fun wrappedCalenderWorkAsExpected() {
+    fun wrappedCalendarWorkAsExpected() {
         val currentMonth = YearMonth.now()
         val weekOfMonthField = WeekFields.of(firstDayOfWeekFromLocale(), 1).weekOfMonth()
         val weeksInMonth = currentMonth.atEndOfMonth().get(weekOfMonthField)
@@ -143,16 +143,16 @@ class CalendarComposeTest {
     }
 
     @Test
-    fun filledHorizontalCalenderWithFooterWorksAsExpected() {
-        filledCalenderWithFooterWorksAsExpected(horizontal = true)
+    fun filledHorizontalCalendarWithFooterWorksAsExpected() {
+        filledCalendarWithFooterWorksAsExpected(horizontal = true)
     }
 
     @Test
-    fun filledVerticalCalenderWithFooterWorksAsExpected() {
-        filledCalenderWithFooterWorksAsExpected(horizontal = false)
+    fun filledVerticalCalendarWithFooterWorksAsExpected() {
+        filledCalendarWithFooterWorksAsExpected(horizontal = false)
     }
 
-    private fun filledCalenderWithFooterWorksAsExpected(horizontal: Boolean) {
+    private fun filledCalendarWithFooterWorksAsExpected(horizontal: Boolean) {
         composeTestRule.setContent {
             Example8Page(horizontal)
         }
```

**File**: `view/src/main/java/com/kizitonwose/calendar/view/MonthHeight.kt` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ public enum class MonthHeight {
     FollowDaySize,
 
     /**
-     * Each month row height will be the calender height divided by the number
+     * Each month row height will be the calendar height divided by the number
      * of rows on the calendar. This means that the calendar months will be distributed
      * uniformly to fill the parent's height. However, the day content height will
      * independently determine its height.
```

**File**: `view/src/main/res/values/attrs.xml` (modified, +1/-1)
```diff
@@ -124,7 +124,7 @@
             uniformly stretch to fill the parent's height. -->
             <enum name="followDaySize" value="0" />
 
-            <!-- Each month's row height will be the calender height divided by the number
+            <!-- Each month's row height will be the calendar height divided by the number
             of rows on the calendar. This means that the calendar months will be distributed
             uniformly to fill the parent's height. However, the day content height will
             independently determine its height.
```

---

### Incident Patch 10: `f8af2622` (2025-05-27)
**Commit Message**: chore: fix typos

**File**: `docs/View.md` (modified, +1/-1)
```diff
@@ -403,7 +403,7 @@ calendarView.dayBinder = object : MonthDayBinder<DayViewContainer> {
     1. **followDaySize**: Each month row height is determined by the `daySize` value set on the calendar. Effectively, this is `wrap-content` if the value is `Square`,
     `SeventhWidth`, or `FreeForm`, and will be equal to the calendar height divided by the number of rows if the value is `Rectangle`. When used together with `Rectangle`, 
     the calendar months and days will uniformly stretch to fill the parent's height.
-    2. **fill**: Each month row height will be the calender height divided by the number of rows on the calendar. This means that the calendar months will be distributed
+    2. **fill**: Each month row height will be the calendar height divided by the number of rows on the calendar. This means that the calendar months will be distributed
     uniformly to fill the parent's height. However, the day content height will independently determine its height. This allows you to spread the calendar months evenly across the screen while
     a `daySize` value of `Square` if you want square day content or `SeventhWidth` if you want to set a specific height value for the day content.
 
```

**File**: `sample/src/androidTest/java/com/kizitonwose/calendar/sample/CalendarComposeTest.kt` (modified, +7/-7)
```diff
@@ -97,7 +97,7 @@ class CalendarComposeTest {
     }
 
     @Test
-    fun squareCalenderDaysWorkAsExpected() {
+    fun squareCalendarDaysWorkAsExpected() {
         composeTestRule.setContent {
             Example1Page()
         }
@@ -115,7 +115,7 @@ class CalendarComposeTest {
     }
 
     @Test
-    fun wrappedCalenderWorkAsExpected() {
+    fun wrappedCalendarWorkAsExpected() {
         val currentMonth = YearMonth.now()
         val weekOfMonthField = WeekFields.of(firstDayOfWeekFromLocale(), 1).weekOfMonth()
         val weeksInMonth = currentMonth.atEndOfMonth().get(weekOfMonthField)
@@ -143,16 +143,16 @@ class CalendarComposeTest {
     }
 
     @Test
-    fun filledHorizontalCalenderWithFooterWorksAsExpected() {
-        filledCalenderWithFooterWorksAsExpected(horizontal = true)
+    fun filledHorizontalCalendarWithFooterWorksAsExpected() {
+        filledCalendarWithFooterWorksAsExpected(horizontal = true)
     }
 
     @Test
-    fun filledVerticalCalenderWithFooterWorksAsExpected() {
-        filledCalenderWithFooterWorksAsExpected(horizontal = false)
+    fun filledVerticalCalendarWithFooterWorksAsExpected() {
+        filledCalendarWithFooterWorksAsExpected(horizontal = false)
     }
 
-    private fun filledCalenderWithFooterWorksAsExpected(horizontal: Boolean) {
+    private fun filledCalendarWithFooterWorksAsExpected(horizontal: Boolean) {
         composeTestRule.setContent {
             Example8Page(horizontal)
         }
```

**File**: `view/src/main/java/com/kizitonwose/calendar/view/MonthHeight.kt` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ public enum class MonthHeight {
     FollowDaySize,
 
     /**
-     * Each month row height will be the calender height divided by the number
+     * Each month row height will be the calendar height divided by the number
      * of rows on the calendar. This means that the calendar months will be distributed
      * uniformly to fill the parent's height. However, the day content height will
      * independently determine its height.
```

**File**: `view/src/main/res/values/attrs.xml` (modified, +1/-1)
```diff
@@ -124,7 +124,7 @@
             uniformly stretch to fill the parent's height. -->
             <enum name="followDaySize" value="0" />
 
-            <!-- Each month's row height will be the calender height divided by the number
+            <!-- Each month's row height will be the calendar height divided by the number
             of rows on the calendar. This means that the calendar months will be distributed
             uniformly to fill the parent's height. However, the day content height will
             independently determine its height.
```

---

### Incident Patch 11: `8ba793c9` (2025-05-17)
**Commit Message**: Fix warnings

**File**: `build.gradle.kts` (modified, +7/-0)
```diff
@@ -1,9 +1,11 @@
+
 import com.kizitonwose.calendar.buildsrc.Version
 import com.kizitonwose.calendar.buildsrc.Version.isNoPublish
 import com.kizitonwose.calendar.buildsrc.androidProjects
 import com.kizitonwose.calendar.buildsrc.multiplatformProjects
 import org.jetbrains.kotlin.gradle.dsl.KotlinProjectExtension
 import org.jetbrains.kotlin.gradle.plugin.KotlinBasePlugin
+import org.jetbrains.kotlin.gradle.tasks.KotlinCompile
 
 plugins {
     alias(libs.plugins.androidApplication) apply false
@@ -23,6 +25,11 @@ plugins {
 allprojects {
     apply(plugin = rootProject.libs.plugins.kotlinter.get().pluginId)
 
+    tasks.withType<KotlinCompile> {
+        compilerOptions {
+            freeCompilerArgs.add("-Xsuppress-warning=NOTHING_TO_INLINE")
+        }
+    }
     plugins.withType<KotlinBasePlugin> {
         extensions.configure<KotlinProjectExtension> {
             if ("sample" !in project.name) {
```

**File**: `buildSrc/build.gradle.kts` (modified, +12/-0)
```diff
@@ -2,6 +2,18 @@ plugins {
     `kotlin-dsl`
 }
 
+java {
+    toolchain {
+        languageVersion.set(JavaLanguageVersion.of(17))
+    }
+}
+
+kotlin {
+    jvmToolchain {
+        languageVersion.set(JavaLanguageVersion.of(17))
+    }
+}
+
 repositories {
     mavenCentral()
 }
```

**File**: `buildSrc/src/main/java/com/kizitonwose/calendar/buildsrc/Build.kt` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ import org.gradle.jvm.toolchain.JavaLanguageVersion
 
 object Config {
     val compatibleJavaVersion = JavaVersion.VERSION_17
-    val compatibleJavaLanguageVersion = JavaLanguageVersion.of(compatibleJavaVersion.majorVersion.toInt())
+    val compatibleJavaLanguageVersion = JavaLanguageVersion.of(compatibleJavaVersion.majorVersion)
 }
 
 object Version {
```

**File**: `compose-multiplatform/library/build.gradle.kts` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ plugins {
 kotlin {
     @OptIn(ExperimentalWasmDsl::class)
     wasmJs {
-        moduleName = "calendar"
+        outputModuleName = "calendar"
         browser {}
         binaries.library()
     }
```

**File**: `compose-multiplatform/sample/build.gradle.kts` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ plugins {
 kotlin {
     @OptIn(ExperimentalWasmDsl::class)
     wasmJs {
-        moduleName = "composeApp"
+        outputModuleName = "composeApp"
         browser {
             commonWebpackConfig {
                 outputFileName = "composeApp.js"
```

**File**: `compose/src/main/java/com/kizitonwose/calendar/compose/CalendarState.kt` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ public fun rememberCalendarState(
     outDateStyle: OutDateStyle = OutDateStyle.EndOfRow,
 ): CalendarState {
     return rememberSaveable(
-        inputs = arrayOf(
+        inputs = arrayOf<Any>(
             startMonth,
             endMonth,
             firstVisibleMonth,
```

**File**: `compose/src/main/java/com/kizitonwose/calendar/compose/heatmapcalendar/HeatMapCalendarState.kt` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ public fun rememberHeatMapCalendarState(
     firstDayOfWeek: DayOfWeek = firstDayOfWeekFromLocale(),
 ): HeatMapCalendarState {
     return rememberSaveable(
-        inputs = arrayOf(
+        inputs = arrayOf<Any>(
             startMonth,
             endMonth,
             firstVisibleMonth,
```

**File**: `compose/src/main/java/com/kizitonwose/calendar/compose/weekcalendar/WeekCalendarState.kt` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ public fun rememberWeekCalendarState(
     firstDayOfWeek: DayOfWeek = firstDayOfWeekFromLocale(),
 ): WeekCalendarState {
     return rememberSaveable(
-        inputs = arrayOf(
+        inputs = arrayOf<Any>(
             startDate,
             endDate,
             firstVisibleWeekDate,
```

---

### Incident Patch 12: `c543b485` (2025-05-17)
**Commit Message**: Fix test run

**File**: `compose/build.gradle.kts` (modified, +2/-0)
```diff
@@ -41,8 +41,10 @@ dependencies {
     implementation(libs.compose.foundation)
     implementation(libs.compose.runtime)
 
+    testImplementation(platform(libs.test.junit5.bom))
     testImplementation(libs.test.junit5.api)
     testRuntimeOnly(libs.test.junit5.engine)
+    testRuntimeOnly(libs.test.junit.platform.launcher)
 }
 
 mavenPublishing {
```

**File**: `data/build.gradle.kts` (modified, +2/-0)
```diff
@@ -23,8 +23,10 @@ dependencies {
     implementation(project(":core"))
     implementation(libs.kotlin.stdlib)
 
+    testImplementation(platform(libs.test.junit5.bom))
     testImplementation(libs.test.junit5.api)
     testRuntimeOnly(libs.test.junit5.engine)
+    testRuntimeOnly(libs.test.junit.platform.launcher)
 }
 
 mavenPublishing {
```

**File**: `gradle/libs.versions.toml` (modified, +4/-2)
```diff
@@ -29,8 +29,10 @@ androidx-test-runner = { module = "androidx.test:runner", version = "1.6.2" }
 androidx-test-rules = { module = "androidx.test:rules", version = "1.6.1" }
 androidx-test-junit = { module = "androidx.test.ext:junit", version = "1.2.1" }
 test-junit4 = { module = "junit:junit", version = "4.13.2" }
-test-junit5-api = { module = "org.junit.jupiter:junit-jupiter-api", version.ref = "junit5" }
-test-junit5-engine = { module = "org.junit.jupiter:junit-jupiter-engine", version.ref = "junit5" }
+test-junit5-bom = { group = "org.junit", name = "junit-bom", version.ref = "junit5" }
+test-junit5-api = { group = "org.junit.jupiter", name = "junit-jupiter-api" }
+test-junit5-engine = { group = "org.junit.jupiter", name = "junit-jupiter-engine" }
+test-junit-platform-launcher = { group = "org.junit.platform", name = "junit-platform-launcher" }
 
 compose-ui-ui = { module = "androidx.compose.ui:ui", version.ref = "composeAndroid" }
 compose-foundation = { module = "androidx.compose.foundation:foundation", version.ref = "composeAndroid" }
```

---

### Incident Patch 13: `db68fd75` (2025-01-18)
**Commit Message**: Fix typo

**File**: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/compose/ItemPlacementInfo.kt` (modified, +1/-1)
```diff
@@ -72,7 +72,7 @@ internal fun findItemViewCoordinates(
 ): LayoutCoordinates {
     var itemViewCoord = firstDayCoord
     var parent = itemViewCoord.parentLayoutCoordinates
-    // Find the coordinates the match the index item layout
+    // Find the coordinates that match the index item layout
     while (parent != null &&
         parent.size != calendarCoord.size &&
         parent.positionInWindow() != calendarCoord.positionInWindow()
```

**File**: `compose/src/main/java/com/kizitonwose/calendar/compose/ItemPlacementInfo.kt` (modified, +1/-1)
```diff
@@ -72,7 +72,7 @@ internal fun findItemViewCoordinates(
 ): LayoutCoordinates {
     var itemViewCoord = firstDayCoord
     var parent = itemViewCoord.parentLayoutCoordinates
-    // Find the coordinates the match the index item layout
+    // Find the coordinates that match the index item layout
     while (parent != null &&
         parent.size != calendarCoord.size &&
         parent.positionInWindow() != calendarCoord.positionInWindow()
```

---

### Incident Patch 14: `23aea806` (2025-01-18)
**Commit Message**: Fix lint

**File**: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/compose/yearcalendar/YearCalendarMonths.kt` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ internal fun LazyListScope.YearCalendarMonths(
             YearContentHeightMode.Wrap -> false
             YearContentHeightMode.Fill,
             YearContentHeightMode.Stretch,
-                -> true
+            -> true
         }
         val hasYearContainer = yearContainer != null
         yearContainer.or(defaultYearContainer)(year) {
```

**File**: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/compose/yearcalendar/YearCalendarState.kt` (modified, +1/-1)
```diff
@@ -398,7 +398,7 @@ public class YearCalendarState internal constructor(
                 // Equal month height, we can multiply reliably.
                 YearContentHeightMode.Fill,
                 YearContentHeightMode.Stretch,
-                    -> true
+                -> true
             }
 
             // Equal month width, we can multiply reliably.
```

**File**: `compose-multiplatform/library/src/commonMain/kotlin/com/kizitonwose/calendar/compose/yearcalendar/YearItemPlacementInfo.kt` (modified, +2/-2)
```diff
@@ -74,7 +74,7 @@ internal class YearItemPlacementInfo {
                 monthSpacing = monthVerticalSpacingPx,
                 dayOffsetInMonth = dayOffsetInMonth.y,
                 daySize = daySize.height,
-                dayBodyCount = month.weekDays.size
+                dayBodyCount = month.weekDays.size,
             )
 
             Orientation.Horizontal -> {
@@ -84,7 +84,7 @@ internal class YearItemPlacementInfo {
                     monthSpacing = monthHorizontalSpacingPx,
                     dayOffsetInMonth = dayOffsetInMonth.x,
                     daySize = daySize.width,
-                    dayBodyCount = month.weekDays.first().size
+                    dayBodyCount = month.weekDays.first().size,
                 )
             }
         }
```

**File**: `compose/src/main/java/com/kizitonwose/calendar/compose/CalendarState.kt` (modified, +0/-1)
```diff
@@ -34,7 +34,6 @@ import java.time.DayOfWeek
 import java.time.LocalDate
 import java.time.YearMonth
 
-
 /**
  * Creates a [CalendarState] that is remembered across compositions.
  *
```

**File**: `compose/src/main/java/com/kizitonwose/calendar/compose/yearcalendar/YearCalendarMonths.kt` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ internal fun LazyListScope.YearCalendarMonths(
             YearContentHeightMode.Wrap -> false
             YearContentHeightMode.Fill,
             YearContentHeightMode.Stretch,
-                -> true
+            -> true
         }
         val hasYearContainer = yearContainer != null
         yearContainer.or(defaultYearContainer)(year) {
```

**File**: `compose/src/main/java/com/kizitonwose/calendar/compose/yearcalendar/YearCalendarState.kt` (modified, +1/-1)
```diff
@@ -398,7 +398,7 @@ public class YearCalendarState internal constructor(
                 // Equal month height, we can multiply reliably.
                 YearContentHeightMode.Fill,
                 YearContentHeightMode.Stretch,
-                    -> true
+                -> true
             }
 
             // Equal month width, we can multiply reliably.
```

**File**: `compose/src/main/java/com/kizitonwose/calendar/compose/yearcalendar/YearItemPlacementInfo.kt` (modified, +2/-2)
```diff
@@ -74,7 +74,7 @@ internal class YearItemPlacementInfo {
                 monthSpacing = monthVerticalSpacingPx,
                 dayOffsetInMonth = dayOffsetInMonth.y,
                 daySize = daySize.height,
-                dayBodyCount = month.weekDays.size
+                dayBodyCount = month.weekDays.size,
             )
 
             Orientation.Horizontal -> {
@@ -84,7 +84,7 @@ internal class YearItemPlacementInfo {
                     monthSpacing = monthHorizontalSpacingPx,
                     dayOffsetInMonth = dayOffsetInMonth.x,
                     daySize = daySize.width,
-                    dayBodyCount = month.weekDays.first().size
+                    dayBodyCount = month.weekDays.first().size,
                 )
             }
         }
```

---

### Incident Patch 15: `0e1b654e` (2025-01-14)
**Commit Message**: Fix background drawable (#600)

**File**: `sample/src/main/java/com/kizitonwose/calendar/sample/view/Example4Fragment.kt` (modified, +22/-20)
```diff
@@ -142,22 +142,18 @@ class Example4Fragment : BaseFragment(R.layout.example_4_fragment), HasToolbar,
     }
 
     private fun configureBinders() {
-        val clipLevelHalf = 5000
-        val ctx = requireContext()
-        val rangeStartBackground =
-            ctx.getDrawableCompat(R.drawable.example_4_continuous_selected_bg_start).also {
+        class DayViewContainer(view: View) : ViewContainer(view) {
+            val clipLevelHalf = 5000
+            val rangeStartBackground = view.context.getDrawableCompat(R.drawable.example_4_continuous_selected_bg_start).also {
                 it.level = clipLevelHalf // Used by ClipDrawable
             }
-        val rangeEndBackground =
-            ctx.getDrawableCompat(R.drawable.example_4_continuous_selected_bg_end).also {
+            val rangeEndBackground = view.context.getDrawableCompat(R.drawable.example_4_continuous_selected_bg_end).also {
                 it.level = clipLevelHalf // Used by ClipDrawable
             }
-        val rangeMiddleBackground =
-            ctx.getDrawableCompat(R.drawable.example_4_continuous_selected_bg_middle)
-        val singleBackground = ctx.getDrawableCompat(R.drawable.example_4_single_selected_bg)
-        val todayBackground = ctx.getDrawableCompat(R.drawable.example_4_today_bg)
+            val rangeMiddleBackground = view.context.getDrawableCompat(R.drawable.example_4_continuous_selected_bg_middle)
+            val singleBackground = view.context.getDrawableCompat(R.drawable.example_4_single_selected_bg)
+            val todayBackground = view.context.getDrawableCompat(R.drawable.example_4_today_bg)
 
-        class DayViewContainer(view: View) : ViewContainer(view) {
             lateinit var day: CalendarDay // Will be set when this container is bound.
             val binding = Example4CalendarDayBinding.bind(view)
 
@@ -200,26 +196,31 @@ class Example4Fragment : BaseFragment(R.layout.example_4_fragment), HasToolbar,
                             when {
                                 startDate == data.date && endDate == null -> {
                                     textView.setTextColorRes(R.color.white)
-                                    roundBgView.applyBackground(singleBackground)
+                                    roundBgView.applyBackground(container.singleBackground)
                                 }
+
                                 data.date == startDate -> {
                                     textView.setTextColorRes(R.color.white)
-                                    continuousBgView.applyBackground(rangeStartBackground)
-                                    roundBgView.applyBackground(singleBackground)
+                                    continuousBgView.applyBackground(container.rangeStartBackground)
+                                    roundBgView.applyBackground(container.singleBackground)
                                 }
+
                                 startDate != null && endDate != null && (data.date > startDate && data.date < endDate) -> {
                                     textView.setTextColorRes(R.color.example_4_grey)
-                                    continuousBgView.applyBackground(rangeMiddleBackground)
+                                    continuousBgView.applyBackground(container.rangeMiddleBackground)
                                 }
+
                                 data.date == endDate -> {
                                     textView.setTextColorRes(R.color.white)
-                                    continuousBgView.applyBackground(rangeEndBackground)
-                                    roundBgView.applyBackground(singleBackground)
+                                    continuousBgView.applyBackground(container.rangeEndBackground)
+                                    roundBgView.applyBackground(container.singleBackground)
                                 }
+
                                 data.date == today -> {
                                     textView.setTextColorRes(R.color.example_4_grey)
-                                    roundBgView.applyBackground(todayBackground)
+                                    roundBgView.applyBackground(container.todayBackground)
                                 }
+
                                 else -> textView.setTextColorRes(R.color.example_4_grey)
                             }
                         }
@@ -231,14 +232,15 @@ class Example4Fragment : BaseFragment(R.layout.example_4_fragment), HasToolbar,
                             endDate != null &&
                             isInDateBetweenSelection(data.date, startDate, endDate)
                         ) {
-                            continuousBgView.applyBackground(rangeMiddleBackground)
+                            continuousBgView.applyBackground(container.rangeMiddleBackground)
                         }
+
                     DayPosition.OutDate ->
                         if (startDate != null &&
                             endDate != nul
```

**File**: `view/src/main/java/com/kizitonwose/calendar/view/internal/DayHolder.kt` (modified, +10/-13)
```diff
@@ -27,23 +27,20 @@ internal class DayHolder<Day>(private val config: DayConfig<Day>) {
         return parent.inflate(config.dayViewRes).apply {
             dayView = this
             layoutParams = DayLinearLayoutParams(layoutParams).apply {
-                weight = 1f // The parent's wightSum is set to 7.
+                if (config.daySize.parentDecidesWidth) {
+                    width = 0
+                    weight = 1f
+                }
                 when (config.daySize) {
-                    DaySize.Square -> {
-                        width = MATCH_PARENT
-                        height = MATCH_PARENT
-                    }
-
-                    DaySize.Rectangle -> {
-                        width = MATCH_PARENT
+                    DaySize.Square,
+                    DaySize.Rectangle,
+                    -> {
                         height = MATCH_PARENT
                     }
 
-                    DaySize.SeventhWidth -> {
-                        width = MATCH_PARENT
-                    }
-
-                    DaySize.FreeForm -> {}
+                    DaySize.SeventhWidth,
+                    DaySize.FreeForm,
+                    -> Unit
                 }
             }
         }
```

**File**: `view/src/main/java/com/kizitonwose/calendar/view/internal/WeekHolder.kt` (modified, +1/-2)
```diff
@@ -47,11 +47,10 @@ internal class WeekHolder<Day>(
         return WidthDivisorLinearLayout(parent.context).apply {
             weekContainer = this
             val width = if (daySize.parentDecidesWidth) MATCH_PARENT else WRAP_CONTENT
-            val height = if (daySize.parentDecidesHeight) MATCH_PARENT else WRAP_CONTENT
+            val height = if (daySize.parentDecidesHeight) 0 else WRAP_CONTENT
             val weight = if (daySize.parentDecidesHeight) 1f else 0f
             layoutParams = LinearLayout.LayoutParams(width, height, weight)
             orientation = LinearLayout.HORIZONTAL
-            weightSum = dayHolders.count().toFloat()
             widthDivisorForHeight = if (daySize == DaySize.Square) dayHolders.count() else 0
             for (holder in dayHolders) {
                 addView(holder.inflateDayView(this))
```

#### Recent Merged Pull Requests:
- **PR #650** (2026-03-28): Release version 2.10.1 (@kizitonwose)
- **PR #649** (2026-03-28): Implement scroll properties (@kizitonwose)
- **PR #645** (2026-01-17): Release 2.10.0 (@kizitonwose)
- **PR #644** (2026-01-17): Release 2.9.1 (@kizitonwose)
- **PR #643** (2026-01-17): Bump compose Android to 1.10.1 and Multiplatform to 1.10.0 (@kizitonwose)
- **PR #642** (2026-01-15): Migrate to bcv in the Kotlin Gradle plugin (@kizitonwose)
- **PR #640** (2026-01-15): Add `weekContainer` parameter to compose and compose-multiplatform (@Terenfear)
- **PR #629** (2025-08-21): fix : Example3 occurs bug when scrolling content (@taeseong-yoon)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
