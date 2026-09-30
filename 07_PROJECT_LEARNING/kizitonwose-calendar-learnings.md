# Forensic Learning Record (Deep Inspection): kizitonwose/Calendar

> **Canonical Artifact**: `07_PROJECT_LEARNING/kizitonwose-calendar-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kizitonwose/Calendar](https://github.com/kizitonwose/Calendar))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:51:14.886Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kizitonwose/Calendar`
- **Description**: A highly customizable calendar view and compose library for Android and Kotlin Multiplatform.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5607 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


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

---

### Incident Patch 3: `7eb03e2a` (2025-08-21)
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

### Incident Patch 4: `773c6bb2` (2025-08-21)
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

### Incident Patch 5: `7573ffe9` (2025-07-15)
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

### Incident Patch 6: `4e97a855` (2025-07-14)
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

### Incident Patch 7: `eebe8d2d` (2025-07-14)
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

### Incident Patch 8: `4a728948` (2025-06-10)
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

### Incident Patch 9: `f8af2622` (2025-05-27)
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

### Incident Patch 10: `8ba793c9` (2025-05-17)
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
