# Forensic Learning Record (Deep Inspection): igorescodro/alkaa

> **Canonical Artifact**: `07_PROJECT_LEARNING/igorescodro-alkaa-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/igorescodro/alkaa](https://github.com/igorescodro/alkaa))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:34:09.459Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `igorescodro/alkaa`
- **Description**: Kotlin multiplatform app to manage your tasks
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1647 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `features/category-api/src/commonMain/kotlin/com/escodro/categoryapi/presentation/CategoryState.kt`
```
package com.escodro.categoryapi.presentation

import com.escodro.categoryapi.model.Category
import kotlinx.collections.immutable.ImmutableList

/**
 * Represents the states of [CategoryListViewModel].
 */
sealed class CategoryState {

    /**
     * Loading state.
     */
    data object Loading : CategoryState()

    /**
     * Loaded state.
     *
     * @property categoryList the loaded category list
     */
    data class Loaded(val categoryList: ImmutableList<Category>) : CategoryState()

    /**
     * Empty state, there are no categories to be shown.
     */
    data object Empty : CategoryState()
}

```

### Core Architecture Module: `features/category/src/commonMain/kotlin/com/escodro/category/presentation/bottomsheet/CategorySheetState.kt`
```
package com.escodro.category.presentation.bottomsheet

import com.escodro.categoryapi.model.Category

internal sealed class CategorySheetState {

    data object Empty : CategorySheetState()

    data class Loaded(val category: Category) : CategorySheetState()
}

```

### Core Architecture Module: `features/glance/src/androidMain/kotlin/com/escodro/glance/data/TaskListStateDefinition.kt`
```
package com.escodro.glance.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.core.Serializer
import androidx.datastore.dataStore
import androidx.datastore.dataStoreFile
import androidx.glance.state.GlanceStateDefinition
import com.escodro.glance.model.Task
import kotlinx.collections.immutable.persistentListOf
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.decodeFromStream
import kotlinx.serialization.json.encodeToStream
import java.io.File
import java.io.InputStream
import java.io.OutputStream

/**
 * Custom [GlanceStateDefinition] to store the widget-related data in a [DataStore].
 *
 * Ideally, all this data logic would stay in the `:data` layer, however once the processing here is
 * too specific for the Glance logic, I decided to keep it here. Moving some logic across other
 * layers would make it confusing and the use cases would need to know from which datasource the
 * data is available. There is no pretty solution for now.
 */
internal object TaskListStateDefinition : GlanceStateDefinition<List<Task>> {

    private const val DATA_STORE_FILENAME = "taskList"

    private val Context.datastore by dataStore(DATA_STORE_FILENAME, TaskListSerializer)

    override suspend fun getDataStore(
        context: Context,
        fileKey: String,
    ): DataStore<List<Task>> =
        context.datastore

    override fun getLocation(context: Context, fileKey: String): File =
        context.dataStoreFile(DATA_STORE_FILENAME)

    /**
     * Updates the underlying [DataStore] data.
     * @param context Context to get datastore
     * @param newTasks List of new contents that are to be updated
     */
    suspend fun updateData(context: Context, newTasks: List<Task>) =
        getDataStore(context, DATA_STORE_FILENAME).updateData { newTasks }

    /**
     * Custom serializer to write and read data from [DataStore].
     */
    @OptIn(ExperimentalSerializationApi::class)
    object TaskListSerializer : Serializer<List<Task>> {

        override val defaultValue: List<Task>
            get() = persistentListOf()

        override suspend fun readFrom(input: InputStream): List<Task> =
            Json.decodeFromStream(input)

        override suspend fun writeTo(t: List<Task>, output: OutputStream) {
            Json.encodeToStream(t, output)
        }
    }
}

```

### Core Architecture Module: `features/glance/src/androidMain/kotlin/com/escodro/glance/data/TaskListUpdaterWorker.kt`
```
package com.escodro.glance.data

import android.content.Context
import androidx.glance.appwidget.updateAll
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.escodro.glance.model.Task
import com.escodro.glance.presentation.TaskListGlanceWidget
import kotlinx.coroutines.flow.first
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject

/**
 * Worker to update the Task List in the widget. A worker is needed here because the process might
 * be dead during between the writing, reading and displaying of the information.
 */
internal class TaskListUpdaterWorker(
    private val context: Context,
    workerParameters: WorkerParameters,
) : CoroutineWorker(context, workerParameters), KoinComponent {

    private val glanceUpdater: TaskListGlanceUpdater by inject()

    override suspend fun doWork(): Result {
        val list = glanceUpdater.loadTaskList().first()
        updateWidgets(list)
        return Result.success()
    }

    private suspend fun updateWidgets(list: List<Task>) {
        TaskListStateDefinition.updateData(context, list)
        TaskListGlanceWidget().updateAll(context)
    }

    companion object {
        private val uniqueWorkName = TaskListUpdaterWorker::class.java.simpleName

        fun enqueue(context: Context) {
            val manager = WorkManager.getInstance(context)
            val requestBuilder = OneTimeWorkRequestBuilder<TaskListUpdaterWorker>()

            manager.enqueueUniqueWork(
                uniqueWorkName,
                ExistingWorkPolicy.KEEP,
                requestBuilder.build(),
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(uniqueWorkName)
        }
    }
}

```

### Core Architecture Module: `features/search/src/commonMain/kotlin/com/escodro/search/presentation/SearchViewState.kt`
```
package com.escodro.search.presentation

import com.escodro.search.model.TaskSearchItem
import kotlinx.collections.immutable.ImmutableList

/**
 * Represents the possible UI stated of Search screen.
 */
internal sealed class SearchViewState {

    /**
     * Represents the stated where the screen is loading.
     */
    internal data object Loading : SearchViewState()

    /**
     * Represents the stated where the tasks matches the query.
     */
    internal data class Loaded(val taskList: ImmutableList<TaskSearchItem>) : SearchViewState()

    /**
     * Represents the state where there are no tasks matching the query.
     */
    internal data object Empty : SearchViewState()
}

```

### Core Architecture Module: `features/task/src/commonMain/kotlin/com/escodro/task/presentation/detail/alarm/AlarmSelectionState.kt`
```
package com.escodro.task.presentation.detail.alarm

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.escodro.permission.api.PermissionController
import com.escodro.task.model.AlarmInterval
import kotlinx.datetime.LocalDateTime

/**
 * State holder for the [AlarmSelection] composable.
 */
class AlarmSelectionState(
    calendar: LocalDateTime?,
    alarmInterval: AlarmInterval?,
    permissionsController: PermissionController,
) {

    /**
     * The [PermissionController] to request the permissions on each platform.
     */
    var permissionsController by mutableStateOf(permissionsController)

    /**
     * The alarm date, if set.
     */
    var date by mutableStateOf(calendar)

    /**
     * The alarm data, if set.
     */
    var alarmInterval by mutableStateOf(alarmInterval)

    /**
     * The Exact Alarm permission dialog visibility state.
     */
    var isExactAlarmDialogOpen by mutableStateOf(false)

    /**
     * The Notification permission dialog visibility state.
     */
    var isNotificationDialogOpen by mutableStateOf(false)

    /**
     * The Notification Rationale dialog visibility state.
     */
    var isRationaleDialogOpen by mutableStateOf(false)

    /**
     * The Date and Time Picker dialog visibility state.
     */
    var isDateTimePickerDialogOpen by mutableStateOf(false)
}

@Composable
internal fun rememberAlarmSelectionState(
    calendar: LocalDateTime?,
    alarmInterval: AlarmInterval?,
    permissionsController: PermissionController,
): AlarmSelectionState =
    remember {
        AlarmSelectionState(
            calendar = calendar,
            alarmInterval = alarmInterval,
            permissionsController = permissionsController,
        )
    }

```

### Core Architecture Module: `features/task/src/commonMain/kotlin/com/escodro/task/presentation/detail/main/TaskDetailState.kt`
```
package com.escodro.task.presentation.detail.main

import com.escodro.task.model.Task

internal sealed class TaskDetailState {

    data object Loading : TaskDetailState()

    data object Error : TaskDetailState()

    data class Loaded(val task: Task) : TaskDetailState()
}

```

### Core Architecture Module: `features/task/src/commonMain/kotlin/com/escodro/task/presentation/list/CategoryStateHandler.kt`
```
package com.escodro.task.presentation.list

import com.escodro.categoryapi.presentation.CategoryState
import com.escodro.task.presentation.detail.main.CategoryId

internal data class CategoryStateHandler(
    val state: CategoryState = CategoryState.Empty,
    val currentCategory: CategoryId? = null,
    val onCategoryChange: (CategoryId?) -> Unit = {},
)

```

### Core Architecture Module: `features/task/src/commonMain/kotlin/com/escodro/task/presentation/list/TaskListViewState.kt`
```
package com.escodro.task.presentation.list

import com.escodro.task.model.TaskWithCategory
import kotlinx.collections.immutable.ImmutableList

/**
 * Presentation entity to represent the view states of Task Section.
 */
internal sealed class TaskListViewState {

    data object Loading : TaskListViewState()

    data class Error(val cause: Throwable) : TaskListViewState()

    data class Loaded(val items: ImmutableList<TaskWithCategory>) : TaskListViewState()

    data object Empty : TaskListViewState()
}

```

### Core Architecture Module: `features/task/src/commonMain/kotlin/com/escodro/task/presentation/list/TaskStateHandler.kt`
```
package com.escodro.task.presentation.list

import com.escodro.task.model.TaskWithCategory

internal data class TaskStateHandler(
    val state: TaskListViewState = TaskListViewState.Empty,
    val onCheckedChange: (TaskWithCategory) -> Unit = {},
    val onItemClick: (Long) -> Unit = {},
    val onAddClick: () -> Unit = {},
)

```

### Core Architecture Module: `features/tracker/src/commonMain/kotlin/com/escodro/tracker/presentation/TrackerViewState.kt`
```
package com.escodro.tracker.presentation

import com.escodro.tracker.model.Tracker

/**
 * Represents the possible UI States of Tracker screen.
 */
internal sealed class TrackerViewState {

    /**
     * Represents the stated where the screen is loading.
     */
    internal data object Loading : TrackerViewState()

    /**
     * Represents the state where they are [Tracker.Info] to be shown on the screen.
     */
    internal data class Loaded(val trackerInfo: Tracker.Info) : TrackerViewState()

    /**
     * Represents the state where they are no information to be shown.
     */
    internal data object Empty : TrackerViewState()

    /**
     * Represents the state where an error occurred.
     */
    internal data class Error(val cause: Throwable) : TrackerViewState()
}

```

### Core Architecture Module: `libraries/appstate/src/commonMain/kotlin/com/escodro/appstate/AlkaaAppState.kt`
```
package com.escodro.appstate

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.remember
import com.escodro.navigationapi.controller.NavBackStack
import com.escodro.navigationapi.destination.Destination
import com.escodro.navigationapi.destination.HomeDestination

/**
 * Alkaa App state.
 */
@Stable
data class AlkaaAppState(val navBackStack: NavBackStack<Destination>)

/**
 * Function to remember a [AlkaaAppState].
 *
 * @param navBackStack the navigation back stack
 */
@Composable
fun rememberAlkaaAppState(
    navBackStack: NavBackStack<Destination> = remember {
        NavBackStack(HomeDestination.TaskList)
    },
): AlkaaAppState = remember(navBackStack) { AlkaaAppState(navBackStack) }

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #864** (2025-02-15): **Improve BottomSheet animation**
  *Symptoms*: # Issue  The BottomSheet does not have an animation for entering the screen, making the UX weird. The goal is to add a similar animation that the exit has.  https://github.com/user-attachments/assets/20f7f776-1b08-479f-9897-de4d931f186d    

- **Issue #863** (2025-02-15): **Update open source libraries on iOS**
  *Symptoms*: # Issue  On iOS, the Open Source libraries JSON needs to be manually updated. It's been a while and several entries are outdated.  For more info: https://github.com/mikepenz/AboutLibraries?tab=readme-ov-file#gradle-api  

- **Issue #862** (2025-02-16): **Broken strings issues**
  *Symptoms*: # Issue  A few strings are not set correctly in the app.   | Remove category (`Removing "%s"`) | About screen (`If you\'re a developer`) | Task Tracker (`You don\'t have`) | | ------------- | ------------- | ------------- | | <img src="https://github.com/user-attachments/assets/683243a2-4498-4b79-ac22-df8d1d2a0dec"/> | <img src="https://github.com/user-attachments/assets/1f3ac5cb-f9f7-4f18-b090-1a67db5e613c"/>  | <img src="https://github.com/user-attachments/assets/cd0d4318-4ccf-47ee-a66b-bc75f94e0bd9"/> |  

- **Issue #861** (2025-02-16): **External links not working on iOS app**
  *Symptoms*: # Issue  When clicking on the "Visit project on GitHub" inside the "About" screen or clicking multiple times in the "Version" code in the "More" screen, the app does not redirect the user to the browser in the respective website. It's working fine in the Android app and Simulator, but not in the real device.  https://github.com/user-attachments/assets/9696007e-06ac-4fa9-916a-d8f4a14f175c    

- **Issue #87** (2019-12-25): **Dialog button is weird on latest release**
  *Symptoms*: The confirmation buttons on dialogs are off styles.  <img src="https://user-images.githubusercontent.com/2267495/71445898-a92af400-26fc-11ea-9819-7f4eae7e2984.png" width="300"> <img src="https://user-images.githubusercontent.com/2267495/71445946-33735800-26fd-11ea-8063-c9e415147fd5.png" width="300">   

- **Issue #86** (2019-12-25): **Status bar icons not visible on Dark Theme**
  *Symptoms*: The status bar icons (clock, battery etc) is black when using Dark Theme. This way it is not possible to see them.  <img src="https://user-images.githubusercontent.com/2267495/71445434-92829e00-26f8-11ea-88f9-47115e8ca3c9.png" width="300"> 

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

### Incident Patch 1: `62c6e2e2` (2026-03-29)
**Commit Message**: 🔧 Fix TaskItemTest Koin configuration and add RelativeDateTimeProviderFake

- Update TaskItemTest to use new RelativeDateTimeProviderFake for better consistency.
- Explicitly bind RelativeDateTimeProvider in Koin test modules to fix NoDefinitionFoundException.
- Update KoinApplication to use koinConfiguration and ensure stopKoin() is called in @AfterTest.

**File**: `features/task/src/commonTest/kotlin/com/escodro/task/presentation/fake/RelativeDateTimeProviderFake.kt` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+package com.escodro.task.presentation.fake
+
+import com.escodro.task.provider.RelativeDateTimeProvider
+import kotlinx.datetime.LocalDateTime
+
+internal class RelativeDateTimeProviderFake : RelativeDateTimeProvider {
+    override fun toRelativeDateTimeString(dateTime: LocalDateTime): String =
+        "${dateTime.hour}:${dateTime.minute}"
+}
```

**File**: `features/task/src/commonTest/kotlin/com/escodro/task/presentation/instrumented/AlarmSelectionTest.kt` (modified, +10/-2)
```diff
@@ -26,7 +26,10 @@ import kotlinx.coroutines.runBlocking
 import kotlinx.datetime.LocalDateTime
 import org.jetbrains.compose.resources.getString
 import org.koin.compose.KoinApplication
+import org.koin.core.context.stopKoin
+import org.koin.dsl.koinConfiguration
 import org.koin.dsl.module
+import kotlin.test.AfterTest
 import kotlin.test.Test
 
 @OptIn(ExperimentalTestApi::class)
@@ -37,6 +40,11 @@ internal class AlarmSelectionTest : AlkaaTest() {
         single<OpenAlarmScheduler> { OpenAlarmSchedulerImpl() }
     }
 
+    @AfterTest
+    fun tearDown() {
+        stopKoin()
+    }
+
     @Test
     fun test_addAlarm() = runComposeUiTest {
         // Load the alarm section component
@@ -123,7 +131,7 @@ internal class AlarmSelectionTest : AlkaaTest() {
         hasExactAlarmPermission: Boolean = true,
     ) {
         setContent {
-            KoinApplication(application = { modules(testModule) }) {
+            KoinApplication(configuration = koinConfiguration { modules(testModule) }) {
                 AlkaaThemePreview {
                     AlarmSelection(
                         calendar = null,
@@ -144,7 +152,7 @@ internal class AlarmSelectionTest : AlkaaTest() {
         alarmInterval: AlarmInterval,
     ) {
         setContent {
-            KoinApplication(application = { modules(testModule) }) {
+            KoinApplication(configuration = koinConfiguration { modules(testModule) }) {
                 AlkaaThemePreview {
                     AlarmSelection(
                         calendar = calendar,
```

**File**: `features/task/src/commonTest/kotlin/com/escodro/task/presentation/instrumented/TaskDetailTest.kt` (modified, +9/-1)
```diff
@@ -23,7 +23,10 @@ import kotlinx.collections.immutable.persistentListOf
 import kotlinx.coroutines.runBlocking
 import org.jetbrains.compose.resources.getString
 import org.koin.compose.KoinApplication
+import org.koin.core.context.stopKoin
+import org.koin.dsl.koinConfiguration
 import org.koin.dsl.module
+import kotlin.test.AfterTest
 import kotlin.test.Test
 
 @OptIn(ExperimentalTestApi::class)
@@ -34,6 +37,11 @@ internal class TaskDetailTest : AlkaaTest() {
         single<OpenAlarmScheduler> { OpenAlarmSchedulerFake() }
     }
 
+    @AfterTest
+    fun tearDown() {
+        stopKoin()
+    }
+
     @Test
     fun test_errorViewIsShown() = runComposeUiTest {
         // Given an error state
@@ -69,7 +77,7 @@ internal class TaskDetailTest : AlkaaTest() {
     }
 
     private fun ComposeUiTest.loadTaskDetail(state: TaskDetailState) = setContent {
-        KoinApplication(application = { modules(testModule) }) {
+        KoinApplication(configuration = koinConfiguration { modules(testModule) }) {
             AlkaaThemePreview {
                 TaskDetailRouter(
                     isSinglePane = true,
```

**File**: `features/task/src/commonTest/kotlin/com/escodro/task/presentation/instrumented/TaskItemTest.kt` (modified, +11/-8)
```diff
@@ -8,25 +8,28 @@ import androidx.compose.ui.test.runComposeUiTest
 import com.escodro.designsystem.theme.AlkaaThemePreview
 import com.escodro.task.model.Task
 import com.escodro.task.model.TaskWithCategory
+import com.escodro.task.presentation.fake.RelativeDateTimeProviderFake
 import com.escodro.task.presentation.list.TaskItem
 import com.escodro.task.provider.RelativeDateTimeProvider
 import com.escodro.test.AlkaaTest
 import kotlinx.datetime.LocalDateTime
 import org.koin.compose.KoinApplication
-import org.koin.dsl.bind
+import org.koin.core.context.stopKoin
+import org.koin.dsl.koinConfiguration
 import org.koin.dsl.module
+import kotlin.test.AfterTest
 import kotlin.test.Test
 
 @OptIn(ExperimentalTestApi::class)
 internal class TaskItemTest : AlkaaTest() {
 
     private val testModule = module {
-        factory {
-            object : RelativeDateTimeProvider {
-                override fun toRelativeDateTimeString(dateTime: LocalDateTime): String =
-                    "${dateTime.hour}:${dateTime.minute}"
-            }
-        } bind RelativeDateTimeProvider::class
+        factory<RelativeDateTimeProvider> { RelativeDateTimeProviderFake() }
+    }
+
+    @AfterTest
+    fun tearDown() {
+        stopKoin()
     }
 
     @Test
@@ -65,7 +68,7 @@ internal class TaskItemTest : AlkaaTest() {
 
     private fun ComposeUiTest.loadItemView(item: TaskWithCategory, onItemClick: (Long) -> Unit) {
         setContent {
-            KoinApplication(application = { modules(testModule) }) {
+            KoinApplication(configuration = koinConfiguration { modules(testModule) }) {
                 AlkaaThemePreview {
                     TaskItem(
                         task = item,
```

---

### Incident Patch 2: `8f5bd10c` (2026-03-29)
**Commit Message**: 🖥️ Scope build/test/quality commands to Desktop only

Remove all-platform Gradle tasks from CLAUDE.md; CI handles those on every PR.
Keep only Desktop-scoped commands for fast local feedback loops.

**File**: `CLAUDE.md` (modified, +6/-10)
```diff
@@ -6,20 +6,16 @@ This is a Kotlin Multiplatform (KMP) task management app targeting Android, iOS,
 
 ```bash
 # Build
-./gradlew assemble                    # Build all modules
-./gradlew :app:assemble               # Android APK only
-./gradlew :desktop-app:assemble       # Desktop only
+./gradlew :desktop-app:assemble       # Desktop (fastest)
 
 # Test
-./gradlew allTests                    # All platforms
-./gradlew desktopTest                 # Desktop (fastest for iteration)
-./gradlew connectedAndroidTest        # Android device/emulator
+./gradlew desktopTest                 # Desktop unit tests (fastest for iteration)
 
-# Code quality (all run via `check`)
-./gradlew ktlint                      # Lint check
+# Code quality
 ./gradlew ktlintFormat                # Auto-fix lint
-./gradlew detektAll                   # Static analysis
-./gradlew check                       # ktlint + detekt + lint
+./gradlew :desktop-app:ktlint         # Lint check
+./gradlew :desktop-app:detekt         # Static analysis
+./gradlew :desktop-app:check          # ktlint + detekt
 ```
 
 ## Architecture
```

---

### Incident Patch 3: `e6448986` (2026-03-22)
**Commit Message**: 📦 Refactor 9 project skills to lightweight guide + references pattern

Each SKILL.md trimmed to ≤100 lines of prose with rules and mistakes tables.
Code examples and detailed patterns moved to named references/ files per skill.
Added verify_migrations.sh and verify_quality.sh scripts for two skills.

**File**: `.claude/skills/navigation/SKILL.md` (modified, +25/-123)
```diff
@@ -7,7 +7,7 @@ description: Use when adding a new screen or modifying navigation in the Alkaa p
 
 ## Overview
 
-Alkaa uses **event-driven navigation**: UI components send named action events, and the system resolves where to go. Navigation is never triggered directly from UI or ViewModels — it always flows through `NavEventController`.
+Alkaa uses event-driven navigation: UI components send named action events, and the system resolves where to go. Navigation is never triggered directly from UI or ViewModels — it always flows through `NavEventController`.
 
 ## Required Files per Navigation Change
 
@@ -17,133 +17,24 @@ Alkaa uses **event-driven navigation**: UI components send named action events,
 | `*Destination.kt` | `com.escodro.navigationapi.destination` | Defines typed routes |
 | `*NavGraph.kt` | feature module | Registers entries and sends events |
 
-All files live in `features/navigation-api` (events/destinations) or within the feature module (NavGraph).
+Both `*Event.kt` and `*Destination.kt` live in `features/navigation-api`. → See `references/CODE_PATTERNS.md` for Kotlin examples of all three files.
 
-## Step-by-Step
+## Steps
 
-### 1. Create the Event
+1. **Create the Event** — Name after the action, not the destination (`OnEditClick`, not `NavigateToEdit`) → see `references/CODE_PATTERNS.md`
+2. **Create the Destination** — Add `@Serializable`; choose interface based on screen type → see `references/CODE_PATTERNS.md`
+3. **Add a NavGraph Entry** — `entry<Destination>` block with appropriate transition spec → see `references/CODE_PATTERNS.md`
+4. **Hoist Navigation** — Composables receive lambdas; NavGraph calls `navEventController.sendEvent()` → see `references/CODE_PATTERNS.md`
 
-Add to the existing `*Event.kt` object for the feature, or create a new one.
+## Destination Interface Rules
 
-```kotlin
-// features/navigation-api/.../event/TaskEvent.kt
-object TaskEvent {
-    data class OnTaskClick(val id: Long) : Event {
-        override fun nextDestination(): Destination = TasksDestination.TaskDetail(taskId = id)
-    }
+| Interface | When to use |
+|-----------|-------------|
+| `TopLevel` | Bottom-nav root screens only (requires `title`, `icon`, `@CommonParcelize`) |
+| `TopAppBarVisible` | Dialogs, bottom sheets, non-full-screen destinations |
+| Neither | Regular full-screen push destinations |
 
-    data object OnNewTaskClick : Event {
-        override fun nextDestination(): Destination = TasksDestination.AddTaskBottomSheet
-    }
-}
-```
-
-**Rules:**
-- Name after the **action**, not the destination (e.g., `OnEditClick`, not `NavigateToEdit`)
-- Use `data object` for parameterless events, `data class` when passing IDs/data
-- `nextDestination()` is the only place that maps event → destination
-
-### 2. Create the Destination
-
-Add to the existing `*Destination.kt` object for the feature, or create a new one.
-
-```kotlin
-// features/navigation-api/.../destination/TasksDestination.kt
-object TasksDestination {
-    @Serializable
-    data class TaskDetail(val taskId: Long) : Destination          // full screen
-
-    @Serializable
-    data object AddTaskBottomSheet : Destination, TopAppBarVisible // dialog/sheet
-}
-```
-
-**Interface rules:**
-- `TopLevel` — only for bottom-nav root screens (requires `title`, `icon`, `@CommonParcelize`)
-- `TopAppBarVisible` — for dialogs, bottom sheets, and non-full-screen destinations
-- Neither — for regular full-screen push destinations
-
-**`TopLevel` template:**
-
-```kotlin
-@Serializable
-@CommonParcelize
-data object MyFeature : Destination, TopLevel {
-    @CommonIgnoredOnParcel
-    override val title: StringResource = Res.string.my_title
-    @CommonIgnoredOnParcel
-    override val icon: ImageVector = Icons.Outlined.MyIcon
-}
-```
-
-Also register in `TopLevelDestinations` and `TopAppBarVisibleDestinations` in `Destination.kt`.
-
-### 3. Add a NavGraph Entry
-
-> If the screen composable doesn't exist yet, use the `write-composable` skill to create it first.
-> If the `TopLevel` destination title is a new string, use the `localization` skill to add it.
-
-In the feature's `*NavGraph.kt`, add an `entry<>` block for each new destination:
-
-```kotlin
-// features/task/.../navigation/TaskNavGraph.kt
-internal class TaskNavGraph : NavGraph {
-    override val navGraph: EntryProviderScope<Destination>.(NavEventController) -> Unit =
-        { navEventController ->
-            entry<TasksDestination.TaskDetail>(
-                metadata = NavDisplay.transitionSpec { SlideInHorizontallyTransition } +
-                    NavDisplay.popTransitionSpec { SlideOutHorizontallyTransition } +
-                    NavDisplay.predictivePopTransitionSpec { SlideOutHorizontallyTransition },
-            ) { entry ->
-                TaskDetailScreen(
-                    taskId = entry.taskId,
-                    onUpPress = { navEventController.sendEvent(Event.OnBack) },
-                )
-            }
-        }
-}
-```
-
-**Transition c
```

**File**: `.claude/skills/navigation/references/CODE_PATTERNS.md` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+# Navigation Code Patterns
+
+## Step 1. Create the Event
+
+```kotlin
+// features/navigation-api/.../event/TaskEvent.kt
+object TaskEvent {
+    data class OnTaskClick(val id: Long) : Event {
+        override fun nextDestination(): Destination = TasksDestination.TaskDetail(taskId = id)
+    }
+
+    data object OnNewTaskClick : Event {
+        override fun nextDestination(): Destination = TasksDestination.AddTaskBottomSheet
+    }
+}
+```
+
+**Rules:**
+- Name after the **action**, not the destination (e.g., `OnEditClick`, not `NavigateToEdit`)
+- Use `data object` for parameterless events, `data class` when passing IDs/data
+- `nextDestination()` is the only place that maps event → destination
+
+## Step 2. Create the Destination
+
+```kotlin
+// features/navigation-api/.../destination/TasksDestination.kt
+object TasksDestination {
+    @Serializable
+    data class TaskDetail(val taskId: Long) : Destination          // full screen
+
+    @Serializable
+    data object AddTaskBottomSheet : Destination, TopAppBarVisible // dialog/sheet
+}
+```
+
+**Interface rules:**
+
+| Interface | When to use |
+|-----------|-------------|
+| `TopLevel` | Bottom-nav root screens only (requires `title`, `icon`, `@CommonParcelize`) |
+| `TopAppBarVisible` | Dialogs, bottom sheets, non-full-screen destinations |
+| Neither | Regular full-screen push destinations |
+
+**`TopLevel` template:**
+
+```kotlin
+@Serializable
+@CommonParcelize
+data object MyFeature : Destination, TopLevel {
+    @CommonIgnoredOnParcel
+    override val title: StringResource = Res.string.my_title
+    @CommonIgnoredOnParcel
+    override val icon: ImageVector = Icons.Outlined.MyIcon
+}
+```
+
+Also register in `TopLevelDestinations` and `TopAppBarVisibleDestinations` in `Destination.kt`.
+
+## Step 3. Add a NavGraph Entry
+
+```kotlin
+// features/task/.../navigation/TaskNavGraph.kt
+internal class TaskNavGraph : NavGraph {
+    override val navGraph: EntryProviderScope<Destination>.(NavEventController) -> Unit =
+        { navEventController ->
+            entry<TasksDestination.TaskDetail>(
+                metadata = NavDisplay.transitionSpec { SlideInHorizontallyTransition } +
+                    NavDisplay.popTransitionSpec { SlideOutHorizontallyTransition } +
+                    NavDisplay.predictivePopTransitionSpec { SlideOutHorizontallyTransition },
+            ) { entry ->
+                TaskDetailScreen(
+                    taskId = entry.taskId,
+                    onUpPress = { navEventController.sendEvent(Event.OnBack) },
+                )
+            }
+        }
+}
+```
+
+**Transition conventions:**
+
+| Screen type | Transition |
+|-------------|------------|
+| Full-screen push/detail | `SlideInHorizontally` / `SlideOutHorizontally` |
+| Top-level tabs | `FadeIn` / `FadeOut` |
+| Dialogs/bottom sheets | `DialogSceneStrategy.dialog()` metadata |
+
+## Step 4. Hoist Navigation in the UI
+
+```kotlin
+// In NavGraph entry (correct — event is sent here)
+entry<HomeDestination.TaskList> {
+    TaskListSection(
+        onItemClick = { taskId ->
+            navEventController.sendEvent(TaskEvent.OnTaskClick(taskId))
+        },
+        onFabClick = {
+            navEventController.sendEvent(TaskEvent.OnNewTaskClick)
+        },
+    )
+}
+
+// TaskListSection signature (correct — receives lambdas, doesn't know about navigation)
+@Composable
+fun TaskListSection(
+    onItemClick: (Long) -> Unit,
+    onFabClick: () -> Unit,
+)
+```
+
+Composables receive callbacks as lambdas. They call the callback; the NavGraph `entry<>` block calls `navEventController.sendEvent()`.
```

**File**: `.claude/skills/write-composable/SKILL.md` (modified, +30/-192)
```diff
@@ -11,214 +11,52 @@ Composables in Alkaa follow a strict three-layer Screen → Loader → Content p
 
 ## Screen Structure
 
-Every screen follows the three-layer pattern:
-
-```
-<Feature>Screen        ← public, stateless, called from NavGraph
-    └─ <Feature>Loader ← internal, injects ViewModel, collects state
-        └─ <Feature>Content ← internal, stateless, renders UI
-```
-
-### `<Feature>Screen`
-- Public entry point from NavGraph
-- Stateless — passes nothing down except navigation callbacks
-- Delegates immediately to `<Feature>Loader`
-
-### `<Feature>Loader`
-- Internal (`internal`)
-- Injects ViewModel via `koinViewModel()`
-- Collects **all** ViewModel state with `remember + collectAsState()`
-- No UI rendering — delegates to `<Feature>Content`
-
-```kotlin
-@Composable
-internal fun TaskLoader(onNavigateBack: () -> Unit) {
-    val viewModel = koinViewModel<TaskViewModel>()
-    val state by remember(viewModel) { viewModel.state }.collectAsState()
-    TaskContent(state = state, onNavigateBack = onNavigateBack)
-}
-```
-
-### `<Feature>Content` (and variants)
-- Internal, stateless — receives a `State` data class, no ViewModel
-- Receives all data ready to render (no mapping in composables)
-- **This is the composable tested with Compose Testing**
-- Add variants (`<Feature>Success`, `<Feature>Error`) when complexity warrants it
-
-## Overall Rules
+Every screen has three layers: `<Feature>Screen` (public, stateless, NavGraph entry point) → `<Feature>Loader` (internal, injects ViewModel, collects state) → `<Feature>Content` (internal, stateless, tested with Compose Testing).
+
+→ See `references/SCREEN_PATTERNS.md` for Kotlin code examples of each layer.
+
+For screens with list→detail relationships, a two-pane adaptive layout is required on wide windows (tablets, desktop). The `isSinglePane` boolean originates at the NavGraph entry and flows unchanged to the Loader where branching happens.
+
+→ See `references/ADAPTIVE_LAYOUTS.md` for `isSinglePane` flow, Loader branching pattern, `ListDetailPaneScaffold`, and toolbar adaptation.
+
+## Rules
 
 | Rule | Details |
 |------|---------|
-| **Kuvio only** | Use `KuvioText`, `KuvioIcon`, etc. — never raw `Text`, `Icon`, or Material components directly. If a base component is missing from Kuvio, implement it first. |
-| **Modifier param** | Every rendering composable accepts an optional `modifier: Modifier = Modifier` |
-| **Paddings** | Always even numbers, ideally multiples of 4 |
+| **Kuvio only** | Use `KuvioText`, `KuvioIcon`, etc. — never raw `Text`, `Icon`, or Material components |
+| **Modifier param** | Every rendering composable accepts `modifier: Modifier = Modifier` |
+| **Paddings** | Always even numbers, multiples of 4 (4, 8, 12, 16, 24 dp) |
 | **Snackbar** | Use Snackbar, never Toast |
-| **Adaptive** | Screens must work on landscape, tablets, and desktop using Material Adaptive components |
-| **Previews** | All composables need both dark and light previews. Use a single interactive preview with state over multiple static ones. |
-
-## Adaptive Layouts
-
-Screens with a list→detail relationship must support two-pane layouts on wide windows (tablets, desktop, landscape). The `isSinglePane` boolean drives all branching — it originates at the NavGraph and flows down unchanged through every layer.
-
-### Where isSinglePane comes from
-
-Always computed at the **NavGraph entry** using the extension from `navigation-api`:
-
-```kotlin
-// In NavGraph entry block
-TaskListSection(
-    isSinglePane = currentWindowAdaptiveInfo().windowSizeClass.isSinglePane(),
-)
-```
-
-Returns `true` below 600dp (phone portrait), `false` on wider windows. Nested detail destinations (pushed via back-stack) always receive `isSinglePane = true` — they are always full-screen.
-
-### Parameter flow
-
-`isSinglePane` passes top-to-bottom without modification:
-
-```
-NavGraph entry    → computes isSinglePane
-  └─ <Feature>Section(isSinglePane)
-      └─ <Feature>Loader(isSinglePane)   ← branches here
-          ├─ (true)  <Feature>Scaffold              ← standard layout
-          └─ (false) Adaptive<Feature>Scaffold      ← ListDetailPaneScaffold
-```
-
-### Loader branching
-
-The **Loader** is where the single/two-pane decision lives, not the Content:
-
-```kotlin
-@Composable
-internal fun TaskListLoader(
-    isSinglePane: Boolean,
-    onItemClick: (Long) -> Unit,
-    onFabClick: () -> Unit,
-    modifier: Modifier = Modifier,
-    viewModel: TaskListViewModel = koinInject(),
-) {
-    val state by remember(viewModel) { viewModel.loadTaskList() }
-        .collectAsState(TaskListViewState.Loading)
-
-    if (isSinglePane) {
-        TaskListScaffold(
-            state = state,
-            onItemClick = onItemClick,   // navigates via NavEventController
-            onFabClick = onFabClick,
-            modifier = modifier,
-        )
-    } else {
-        AdaptiveTaskListScaffold(
-            state = state,
-            onFabClick = onFabClick,
-    
```

**File**: `.claude/skills/write-composable/references/ADAPTIVE_LAYOUTS.md` (added, +136/-0)
```diff
@@ -0,0 +1,136 @@
+# Adaptive Layouts
+
+Screens with a list→detail relationship must support two-pane layouts on wide windows (tablets, desktop, landscape). The `isSinglePane` boolean drives all branching — it originates at the NavGraph and flows down unchanged through every layer.
+
+## Where isSinglePane comes from
+
+Always computed at the **NavGraph entry** using the extension from `navigation-api`:
+
+```kotlin
+// In NavGraph entry block
+TaskListSection(
+    isSinglePane = currentWindowAdaptiveInfo().windowSizeClass.isSinglePane(),
+)
+```
+
+Returns `true` below 600dp (phone portrait), `false` on wider windows. Nested detail destinations (pushed via back-stack) always receive `isSinglePane = true` — they are always full-screen.
+
+## Parameter flow
+
+`isSinglePane` passes top-to-bottom without modification:
+
+```
+NavGraph entry    → computes isSinglePane
+  └─ <Feature>Section(isSinglePane)
+      └─ <Feature>Loader(isSinglePane)   ← branches here
+          ├─ (true)  <Feature>Scaffold              ← standard layout
+          └─ (false) Adaptive<Feature>Scaffold      ← ListDetailPaneScaffold
+```
+
+## Loader branching
+
+The **Loader** is where the single/two-pane decision lives, not the Content:
+
+```kotlin
+@Composable
+internal fun TaskListLoader(
+    isSinglePane: Boolean,
+    onItemClick: (Long) -> Unit,
+    onFabClick: () -> Unit,
+    modifier: Modifier = Modifier,
+    viewModel: TaskListViewModel = koinInject(),
+) {
+    val state by remember(viewModel) { viewModel.loadTaskList() }
+        .collectAsState(TaskListViewState.Loading)
+
+    if (isSinglePane) {
+        TaskListScaffold(
+            state = state,
+            onItemClick = onItemClick,   // navigates via NavEventController
+            onFabClick = onFabClick,
+            modifier = modifier,
+        )
+    } else {
+        AdaptiveTaskListScaffold(
+            state = state,
+            onFabClick = onFabClick,
+            modifier = modifier,
+        )
+    }
+}
+```
+
+## Two-pane scaffold
+
+Use `ListDetailPaneScaffold` + `ThreePaneScaffoldNavigator` for the selected-item state:
+
+```kotlin
+@OptIn(ExperimentalMaterial3AdaptiveApi::class)
+@Composable
+private fun AdaptiveTaskListScaffold(
+    state: TaskListViewState,
+    onFabClick: () -> Unit,
+    modifier: Modifier = Modifier,
+) {
+    val navigator = rememberListDetailPaneScaffoldNavigator<TaskId>()
+    val coroutineScope = rememberCoroutineScope()
+
+    ListDetailPaneScaffold(
+        directive = navigator.scaffoldDirective,
+        value = navigator.scaffoldValue,
+        listPane = {
+            AnimatedPane {
+                TaskListScaffold(
+                    state = state,
+                    onItemClick = { taskId ->
+                        coroutineScope.launch {
+                            navigator.navigateTo(ListDetailPaneScaffoldRole.Detail, TaskId(taskId))
+                        }
+                    },
+                    onFabClick = onFabClick,
+                    modifier = modifier,
+                )
+            }
+        },
+        detailPane = {
+            AnimatedPane {
+                val taskId = navigator.currentDestination?.contentKey?.value
+                if (taskId != null) {
+                    TaskDetailScreen(
+                        isSinglePane = false,   // side-panel mode
+                        taskId = taskId,
+                        onUpPress = { coroutineScope.launch { navigator.navigateBack() } },
+                    )
+                } else {
+                    DefaultIconTextContent(   // empty-state placeholder
+                        icon = Icons.Outlined.CheckCircle,
+                        header = stringResource(Res.string.task_detail_pane_title),
+                    )
+                }
+            }
+        },
+    )
+}
+```
+
+**Rules:**
+- `ThreePaneScaffoldNavigator<T>` where `T` is the selected item's ID type
+- `navigator.navigateTo(ListDetailPaneScaffoldRole.Detail, item)` — always call inside a `coroutineScope.launch`
+- `navigator.currentDestination?.contentKey` is nullable — always handle the empty state
+- Detail pane always passes `isSinglePane = false`
+- `@OptIn(ExperimentalMaterial3AdaptiveApi::class)` required on the composable
+
+## Toolbar adapts to isSinglePane
+
+Detail screens pass `isSinglePane` to `AlkaaToolbar`, which changes the navigation icon:
+
+| `isSinglePane` | Icon | Meaning |
+|----------------|------|---------|
+| `true` | Back arrow | Full-screen push navigation |
+| `false` | Close (×) | Side panel, dismiss in place |
+
+## When NOT to use ListDetailPaneScaffold
+
+Only screens with a canonical list→detail drill-down need two-pane layouts (Task, Search). Screens without a detail (Category edit dialogs, Preference sub-screens) use standard `Scaffold` and remain single-pane; use `BoxWithConstraints` for responsive grid sizing if needed.
+
+Reference file: `features/task/src/commonMain/kotlin/com/escodro/task/presentation/
```

**File**: `.claude/skills/write-composable/references/SCREEN_PATTERNS.md` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+# Screen Patterns
+
+Every screen in Alkaa follows a strict three-layer pattern:
+
+```
+<Feature>Screen        ← public, stateless, called from NavGraph
+    └─ <Feature>Loader ← internal, injects ViewModel, collects state
+        └─ <Feature>Content ← internal, stateless, renders UI
+```
+
+## `<Feature>Screen`
+
+- Public entry point from NavGraph
+- Stateless — passes nothing down except navigation callbacks
+- Delegates immediately to `<Feature>Loader`
+
+## `<Feature>Loader`
+
+- Internal (`internal`)
+- Injects ViewModel via `koinViewModel()`
+- Collects **all** ViewModel state with `remember + collectAsState()`
+- No UI rendering — delegates to `<Feature>Content`
+
+```kotlin
+@Composable
+internal fun TaskLoader(onNavigateBack: () -> Unit) {
+    val viewModel = koinViewModel<TaskViewModel>()
+    val state by remember(viewModel) { viewModel.state }.collectAsState()
+    TaskContent(state = state, onNavigateBack = onNavigateBack)
+}
+```
+
+## `<Feature>Content` (and variants)
+
+- Internal, stateless — receives a `State` data class, no ViewModel
+- Receives all data ready to render (no mapping in composables)
+- **This is the composable tested with Compose Testing**
+- Add variants (`<Feature>Success`, `<Feature>Error`) when complexity warrants it
```

**File**: `.claude/skills/write-design-system-component/SKILL.md` (modified, +33/-208)
```diff
@@ -7,240 +7,65 @@ description: Use when implementing a new Kuvio component for the Alkaa Design Sy
 
 ## Overview
 
-Kuvio is the Alkaa Design System's component library. Implementing a Kuvio component means translating a design spec into a reusable, theme-aware Compose Multiplatform composable following strict naming, structure, and styling conventions.
+Kuvio is the Alkaa Design System's component library. This skill guides implementation of theme-aware, multiplatform Compose Multiplatform components following strict naming, structure, and styling conventions.
 
-**Core principle:** Design specs and component architecture are finalized BEFORE implementation begins. This skill guides the implementation workflow.
-
-## When to Use
-
-**REQUIRED: Use AFTER these skills complete:**
-- `superpowers:brainstorming` — Design decisions and component structure are finalized
-- Design spec exists and is accessible (HTML design system reference or Figma)
+**Prerequisite:** Design spec must be finalized (variants, layout, interactive states) before using this skill. If not, use `superpowers:brainstorming` first.
 
-**Use this skill when:**
-- Design spec is defined (variants, layout, interactive states all decided)
-- Component structure and slots are finalized
-- Ready to write implementation code
-- Component is new to the codebase
+## Steps
 
-**Do NOT use when:**
-- Still designing or debating structure (use `superpowers:brainstorming` first)
-- Exploring whether component should exist (use `superpowers:writing-plans` first)
-- Design decisions are unclear or incomplete
-- Uncertain about variants, slots, or what to expose
+1. **Extract Design Spec** — Identify visual structure, variants, spacing, typography, interactive states → see `references/IMPLEMENTATION_GUIDE.md`
+2. **Study Existing Components** — Read at least 2 reference implementations → see `references/IMPLEMENTATION_GUIDE.md`
+3. **Choose Output Directory** — Map component category to folder → see `references/IMPLEMENTATION_GUIDE.md`
+4. **Implement Component** — Follow naming, code style, and slot conventions → see `references/IMPLEMENTATION_GUIDE.md`
+5. **Externalize Strings** — Use `localization` skill for all user-visible strings
+6. **Add Previews** — Light + dark pair for every meaningful variant → see `references/IMPLEMENTATION_GUIDE.md`
+7. **Verify Code Quality** — Run `scripts/verify_quality.sh`
+8. **Report** — List files created, variants exposed, slots, dependencies, design tokens used → see `references/IMPLEMENTATION_GUIDE.md`
 
-**Optional but recommended:**
-- `superpowers:test-driven-development` — Write preview tests first, implementation second
-- Use TDD to verify component variants match design spec before finishing
-
-## Before You Start: Verify Design Spec Is Ready
-
-**Your design spec MUST include:**
-- Visual structure (what goes where, layout)
-- All variants (sizes, color roles, states, disabled/active)
-- Spacing and sizing (how much padding, how far apart)
-- Typography (which text style for each area)
-- Interactive behavior (what happens on click, focus, etc.)
-
-**If the spec is incomplete or unclear:**
-- STOP. Do not proceed to implementation.
-- Use `superpowers:brainstorming` to finalize the spec first.
-- Unclear specs cause rework. Clarify BEFORE coding.
-
-## Implementation Workflow
-
-### Step 1: Extract Design Spec
-
-Read the design system HTML to find the component section:
-
-```bash
-grep -n "section-title\|subsection-title\|id=" /path/to/alkaa-ds.html | grep -i "ComponentName"
-```
-
-Extract from spec:
-- Visual structure and layout
-- Variants (sizes, states, color roles)
-- Spacing/sizing tokens
-- Typography used
-- Interactive states
-
-### Step 2: Study Existing Components
-
-Read at least 2 reference implementations:
-
-- `KuvioCounterCard.kt` — complex card layout with slots
-- `KuvioDialog.kt` — multi-part component with state management
-- `KuvioEmojiIcon.kt` — simple icon component
-- `KuvioBodyMediumText.kt` — text primitives
-- Badge/item components for more patterns
-
-Look for:
-- How slots are exposed (`icon: (@Composable () -> Unit)?`)
-- How tokens are used (`MaterialTheme.colorScheme.*`)
-- How nesting is structured (max ~3 levels)
-- How composables under ~60 lines are extracted
-
-### Step 3: Choose Output Directory
-
-Place under: `libraries/designsystem/src/commonMain/kotlin/com/escodro/designsystem/components/kuvio/<folder>/`
-
-| Category | Folder | Examples |
-|----------|--------|----------|
-| Text variants | `text/` | `KuvioBodyMediumText`, `KuvioLabelSmallText` |
-| Icons/Avatars | `icon/` | `KuvioEmojiIcon`, `KuvioAvatar` |
-| Data display | `card/` | `KuvioCounterCard`, `KuvioTaskCard` |
-| Badges/Tags | `badge/` | `KuvioBadge`, `KuvioChip` |
-| List items | `item/` | `KuvioTaskItem`, `KuvioListItem` |
-| Modals/Overlays | `dialog/` | `KuvioDialog`, `KuvioAlertDialog` |
-| New category | `<lowercase>-no-spaces/` | Create if no match |
-
-### Step 4: Implement Component
-

```

**File**: `.claude/skills/write-design-system-component/references/IMPLEMENTATION_GUIDE.md` (added, +132/-0)
```diff
@@ -0,0 +1,132 @@
+# Implementation Guide: Kuvio Component
+
+## Step 1: Extract Design Spec
+
+Read the design system HTML to find the component section:
+
+```bash
+grep -n "section-title\|subsection-title\|id=" /path/to/alkaa-ds.html | grep -i "ComponentName"
+```
+
+Extract from spec:
+- Visual structure and layout
+- Variants (sizes, states, color roles)
+- Spacing/sizing tokens
+- Typography used
+- Interactive states
+
+---
+
+## Step 2: Study Existing Components
+
+Read at least 2 reference implementations:
+
+- `KuvioCounterCard.kt` — complex card layout with slots
+- `KuvioDialog.kt` — multi-part component with state management
+- `KuvioEmojiIcon.kt` — simple icon component
+- `KuvioBodyMediumText.kt` — text primitives
+- Badge/item components for more patterns
+
+Look for:
+- How slots are exposed (`icon: (@Composable () -> Unit)?`)
+- How tokens are used (`MaterialTheme.colorScheme.*`)
+- How nesting is structured (max ~3 levels)
+- How composables under ~60 lines are extracted
+
+---
+
+## Step 3: Choose Output Directory
+
+Place under: `libraries/designsystem/src/commonMain/kotlin/com/escodro/designsystem/components/kuvio/<folder>/`
+
+| Category | Folder | Examples |
+|----------|--------|----------|
+| Text variants | `text/` | `KuvioBodyMediumText`, `KuvioLabelSmallText` |
+| Icons/Avatars | `icon/` | `KuvioEmojiIcon`, `KuvioAvatar` |
+| Data display | `card/` | `KuvioCounterCard`, `KuvioTaskCard` |
+| Badges/Tags | `badge/` | `KuvioBadge`, `KuvioChip` |
+| List items | `item/` | `KuvioTaskItem`, `KuvioListItem` |
+| Modals/Overlays | `dialog/` | `KuvioDialog`, `KuvioAlertDialog` |
+| New category | `<lowercase-no-spaces>/` | Create if no match |
+
+---
+
+## Step 4: Implement Component
+
+**Naming Rules:**
+- All public composables: `Kuvio<Name>` prefix (PascalCase)
+- Package: `com.escodro.designsystem.components.kuvio.<folder>`
+- Private sub-composables: lowercase with camelCase
+
+**Code Style:**
+- Reuse existing Kuvio primitives (`KuvioBodyMediumText`, `KuvioEmojiIcon`) — never raw `Text`
+- No `Canvas` for shapes/icons — use `Box`, `Surface`, `Icon`, `clip`, `background`
+- Theme-aware only: `MaterialTheme.colorScheme.*` and `MaterialTheme.shapes.*` — no hardcoded colors except Previews
+- Slots over config: Prefer `icon: (@Composable () -> Unit)?` over nested objects
+- Max ~60 lines per composable, max ~3 nesting levels
+- Extract logical chunks into private composables when needed
+
+**Structure:**
+- File per composable (unless closely related)
+- KDoc for every public function and parameter
+- Constant naming: **PascalCase** (`AddTaskPlaceholder`, not `ADD_TASK_PLACEHOLDER`)
+
+---
+
+## Step 6: Add Previews
+
+Every file must have light AND dark previews:
+
+```kotlin
+@Preview(showBackground = true)
+@Composable
+private fun KuvioXxxLightPreview() {
+    AlkaaThemePreview {
+        // Component with realistic sample data
+    }
+}
+
+@Preview(showBackground = true, backgroundColor = 0xFF0F1B2D)
+@Composable
+private fun KuvioXxxDarkPreview() {
+    AlkaaThemePreview(isDarkTheme = true) {
+        // Same component
+    }
+}
+```
+
+Use `AlkaaThemePreview` (from `com.escodro.designsystem.theme`).
+
+For variants: One preview pair per meaningful variant (size, state, color).
+
+Place preview strings as `private const val` at file bottom.
+
+---
+
+## Step 7: Verify Code Quality
+
+Compilation check:
+```bash
+./gradlew :libraries:designsystem:compileKotlinDesktop 2>&1 | tail -30
+```
+
+Static analysis:
+```bash
+./gradlew :libraries:designsystem:detektCommonMainSourceSet ktlintCheck 2>&1 | grep -E "\.kt:|BUILD|FAILED"
+```
+
+Fix reported issues:
+- Constant names are PascalCase (not SCREAMING_SNAKE_CASE)
+- No composable exceeds ~60 lines
+- Lambda names are present-tense (`onFocus`, not `onFocused`)
+- All strings externalized to resources
+
+---
+
+## Step 8: Report
+
+List files created/modified and describe:
+- Variants exposed
+- Slots available
+- Dependencies on other Kuvio components
+- Design tokens used
```

**File**: `.claude/skills/write-design-system-component/scripts/verify_quality.sh` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+#!/bin/bash
+# Verifies Kuvio component quality: compilation and static analysis.
+
+echo "=== Compilation check ==="
+./gradlew :libraries:designsystem:compileKotlinDesktop 2>&1 | tail -30
+
+echo "=== Static analysis ==="
+./gradlew :libraries:designsystem:detektCommonMainSourceSet ktlintCheck 2>&1 | grep -E "\.kt:|BUILD|FAILED"
```

---

### Incident Patch 4: `5af4f00b` (2026-03-22)
**Commit Message**: 📦 Add DB migrations guidance to write-local-datasource skill

Add section 2b covering SQLDelight .sqm migration files: version tracking,
ADD COLUMN and table-recreate patterns, rules, and verification. Also adds
five migration-specific rows to the Common Mistakes table.

**File**: `.claude/skills/write-local-datasource/SKILL.md` (modified, +49/-1)
```diff
@@ -27,7 +27,9 @@ interface CategoryDataSource {
 }
 ```
 
-## Phase 2: SQLDelight Schema (.sq)
+## Phase 2: SQLDelight Schema
+
+### 2a. Schema file (.sq)
 
 Location: `data/local/src/commonMain/sqldelight/com/escodro/local/<Name>.sq`
 
@@ -68,6 +70,47 @@ DELETE FROM Category;
 - FOREIGN KEY with `ON DELETE CASCADE` for child tables (e.g., Task referencing Category)
 - For inserts that need to return the new ID: add a `lastInsertedId: SELECT LAST_INSERT_ROWID();` query
 
+### 2b. DB Migrations (.sqm)
+
+**Trigger:** Any structural change to an existing table, or a new table added to an app with existing users. Always update the `.sq` file first (target state), then add a migration file.
+
+SQLDelight derives the DB version from the count of `.sqm` files. File `N.sqm` upgrades version N → N+1. To find the next file number, count existing `.sqm` files.
+
+```
+data/local/src/commonMain/sqldelight/
+├── com/escodro/local/          ← .sq files (always reflect the final schema)
+└── migrations/
+    ├── 1.sqm                   ← upgrades version 1 → 2
+    ├── 2.sqm                   ← upgrades version 2 → 3
+    └── 3.sqm                   ← upgrades version 3 → 4
+```
+
+**Add a column** — most common case:
+```sql
+ALTER TABLE Task ADD COLUMN task_priority INTEGER NOT NULL DEFAULT 0;
+```
+
+**Recreate a table** — required when dropping a column, changing a constraint, or adding `AUTOINCREMENT`:
+```sql
+ALTER TABLE Category RENAME TO Category_temp;
+CREATE TABLE IF NOT EXISTS Category (
+    `category_id`    INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
+    `category_name`  TEXT NOT NULL,
+    `category_color` TEXT NOT NULL
+);
+INSERT INTO Category(category_id, category_name, category_color)
+SELECT category_id, category_name, category_color FROM Category_temp;
+DROP TABLE Category_temp;
+```
+
+**Rules:**
+- `.sqm` files contain raw SQL only — no query labels
+- `NOT NULL` columns require `DEFAULT <value>` when added to existing tables
+- Never edit an existing `.sqm` file — create a new one for each change
+- No `BEGIN`/`END TRANSACTION` — the driver manages the transaction
+
+Verify with `./gradlew check` — this includes `verifySqlDelightMigration`, which confirms the migration output matches the `.sq` schema.
+
 ## Phase 3: DAO Interface
 
 Location: `data/local/src/commonMain/kotlin/com/escodro/local/dao/<Name>Dao.kt`
@@ -285,3 +328,8 @@ After completing the local data layer, use the `write-unit-tests` skill to test
 | Registering DataSource or DAO as `factoryOf` | Always `singleOf` — they share database state across the app |
 | Adding `DatabaseProvider` registration again | It is already registered once; duplicate registration causes a Koin conflict |
 | Accessing `*Queries` directly in LocalDataSource | LocalDataSource injects the DAO — never the queries object |
+| Changing a `CREATE TABLE` in `.sq` without a `.sqm` file | Existing users never see the change; always pair schema edits with a migration |
+| Adding a `NOT NULL` column in `.sqm` without `DEFAULT` | SQLite rejects the statement on existing rows — always supply a default value |
+| Editing an existing `.sqm` file | `.sqm` files are immutable history; create a new file for the next version |
+| Wrong `.sqm` file number | The file number must equal the current version count (number of existing `.sqm` files) |
+| Wrapping migration SQL in `BEGIN`/`END TRANSACTION` | The driver manages the transaction; wrapping it can cause crashes |
```

---

### Incident Patch 5: `397a139e` (2026-03-21)
**Commit Message**: 🗺️ Add adaptive layout guidance to write-composable skill

Documents the isSinglePane pattern: NavGraph-level detection, parameter
flow through Section→Loader→Content, ListDetailPaneScaffold with
ThreePaneScaffoldNavigator, AnimatedPane usage, and toolbar icon behavior.

**File**: `.claude/skills/write-composable/SKILL.md` (modified, +140/-0)
```diff
@@ -56,6 +56,143 @@ internal fun TaskLoader(onNavigateBack: () -> Unit) {
 | **Adaptive** | Screens must work on landscape, tablets, and desktop using Material Adaptive components |
 | **Previews** | All composables need both dark and light previews. Use a single interactive preview with state over multiple static ones. |
 
+## Adaptive Layouts
+
+Screens with a list→detail relationship must support two-pane layouts on wide windows (tablets, desktop, landscape). The `isSinglePane` boolean drives all branching — it originates at the NavGraph and flows down unchanged through every layer.
+
+### Where isSinglePane comes from
+
+Always computed at the **NavGraph entry** using the extension from `navigation-api`:
+
+```kotlin
+// In NavGraph entry block
+TaskListSection(
+    isSinglePane = currentWindowAdaptiveInfo().windowSizeClass.isSinglePane(),
+)
+```
+
+Returns `true` below 600dp (phone portrait), `false` on wider windows. Nested detail destinations (pushed via back-stack) always receive `isSinglePane = true` — they are always full-screen.
+
+### Parameter flow
+
+`isSinglePane` passes top-to-bottom without modification:
+
+```
+NavGraph entry    → computes isSinglePane
+  └─ <Feature>Section(isSinglePane)
+      └─ <Feature>Loader(isSinglePane)   ← branches here
+          ├─ (true)  <Feature>Scaffold              ← standard layout
+          └─ (false) Adaptive<Feature>Scaffold      ← ListDetailPaneScaffold
+```
+
+### Loader branching
+
+The **Loader** is where the single/two-pane decision lives, not the Content:
+
+```kotlin
+@Composable
+internal fun TaskListLoader(
+    isSinglePane: Boolean,
+    onItemClick: (Long) -> Unit,
+    onFabClick: () -> Unit,
+    modifier: Modifier = Modifier,
+    viewModel: TaskListViewModel = koinInject(),
+) {
+    val state by remember(viewModel) { viewModel.loadTaskList() }
+        .collectAsState(TaskListViewState.Loading)
+
+    if (isSinglePane) {
+        TaskListScaffold(
+            state = state,
+            onItemClick = onItemClick,   // navigates via NavEventController
+            onFabClick = onFabClick,
+            modifier = modifier,
+        )
+    } else {
+        AdaptiveTaskListScaffold(
+            state = state,
+            onFabClick = onFabClick,
+            modifier = modifier,
+        )
+    }
+}
+```
+
+### Two-pane scaffold
+
+Use `ListDetailPaneScaffold` + `ThreePaneScaffoldNavigator` for the selected-item state:
+
+```kotlin
+@OptIn(ExperimentalMaterial3AdaptiveApi::class)
+@Composable
+private fun AdaptiveTaskListScaffold(
+    state: TaskListViewState,
+    onFabClick: () -> Unit,
+    modifier: Modifier = Modifier,
+) {
+    val navigator = rememberListDetailPaneScaffoldNavigator<TaskId>()
+    val coroutineScope = rememberCoroutineScope()
+
+    ListDetailPaneScaffold(
+        directive = navigator.scaffoldDirective,
+        value = navigator.scaffoldValue,
+        listPane = {
+            AnimatedPane {
+                TaskListScaffold(
+                    state = state,
+                    onItemClick = { taskId ->
+                        coroutineScope.launch {
+                            navigator.navigateTo(ListDetailPaneScaffoldRole.Detail, TaskId(taskId))
+                        }
+                    },
+                    onFabClick = onFabClick,
+                    modifier = modifier,
+                )
+            }
+        },
+        detailPane = {
+            AnimatedPane {
+                val taskId = navigator.currentDestination?.contentKey?.value
+                if (taskId != null) {
+                    TaskDetailScreen(
+                        isSinglePane = false,   // side-panel mode
+                        taskId = taskId,
+                        onUpPress = { coroutineScope.launch { navigator.navigateBack() } },
+                    )
+                } else {
+                    DefaultIconTextContent(   // empty-state placeholder
+                        icon = Icons.Outlined.CheckCircle,
+                        header = stringResource(Res.string.task_detail_pane_title),
+                    )
+                }
+            }
+        },
+    )
+}
+```
+
+**Rules:**
+- `ThreePaneScaffoldNavigator<T>` where `T` is the selected item's ID type
+- `navigator.navigateTo(ListDetailPaneScaffoldRole.Detail, item)` — always call inside a `coroutineScope.launch`
+- `navigator.currentDestination?.contentKey` is nullable — always handle the empty state
+- Detail pane always passes `isSinglePane = false`
+- `@OptIn(ExperimentalMaterial3AdaptiveApi::class)` required on the composable
+
+### Toolbar adapts to isSinglePane
+
+Detail screens pass `isSinglePane` to `AlkaaToolbar`, which changes the navigation icon:
+
+| `isSinglePane` | Icon | Meaning |
+|----------------|------|---------|
+| `true` | Back arrow | Full-screen push navigation |
+| `false` | Close (×) | Side panel, dismiss in place |
+
+### When NOT to use ListDetailPaneScaffold
+
+Only screens with a canonical list→detail dril
```

---

### Incident Patch 6: `df0de14b` (2026-03-21)
**Commit Message**: 🗄️ Add write-local-datasource skill and fix write-feature bug

Add new skill covering the full local data layer: SQLDelight schema,
DAO interface and implementation, local mapper, LocalDataSource, and
DI registration in LocalModule.

Fix write-feature Phase 3b to use singleOf (not factoryOf) for
repository registration, matching the actual codebase convention.

Add cross-reference from write-feature Phase 2 to the new skill.

**File**: `.claude/skills/write-feature/SKILL.md` (modified, +3/-1)
```diff
@@ -74,6 +74,8 @@ internal class LoadAllCategoriesImpl(
 
 ## Phase 2: Data Layer
 
+> If the feature requires a **new database table**, invoke the `write-local-datasource` skill before continuing. It covers the full local stack: `.sq` schema, DAO, local mapper, LocalDataSource, and DI in `LocalModule`.
+
 ### 2a. Repository Mapper
 
 Location: `data/repository/src/commonMain/kotlin/com/escodro/repository/mapper/`
@@ -147,7 +149,7 @@ val categoryModule = module {
 Add to `data/repository/src/commonMain/kotlin/com/escodro/repository/di/RepositoryModule.kt`:
 
 ```kotlin
-factoryOf(::CategoryRepositoryImpl) bind CategoryRepository::class
+singleOf(::CategoryRepositoryImpl) bind CategoryRepository::class
 ```
 
 ### 3c. Register in KoinHelper
```

**File**: `.claude/skills/write-local-datasource/SKILL.md` (added, +283/-0)
```diff
@@ -0,0 +1,283 @@
+---
+name: write-local-datasource
+description: Use when a new feature needs to persist data locally in Alkaa — triggers on tasks like "add database support", "create a new table", "store this data in SQLDelight", or when write-feature Phase 2 requires a new entity in the local database.
+---
+
+# Write Local DataSource
+
+## Overview
+
+The local data layer has six artifacts per entity: a SQLDelight `.sq` schema, a DataSource interface (in `data/repository`), a DAO interface, a DAO implementation, a local mapper, and a LocalDataSource implementation. All six must follow strict conventions; the DI module wires them together at the end.
+
+## Phase 1: DataSource Interface
+
+Location: `data/repository/src/commonMain/kotlin/com/escodro/repository/datasource/<Name>DataSource.kt`
+
+This is the contract the `RepositoryImpl` in `write-feature` depends on. Mirror the DAO signature but use **repository models**, not local types.
+
+```kotlin
+// Flow for observable streams, suspend for single reads and mutations
+interface CategoryDataSource {
+    fun findAllCategories(): Flow<List<Category>>
+    suspend fun findCategoryById(categoryId: Long): Category?
+    suspend fun insertCategory(category: Category)
+    suspend fun updateCategory(category: Category)
+    suspend fun deleteCategory(category: Category)
+    suspend fun cleanTable()
+}
+```
+
+## Phase 2: SQLDelight Schema (.sq)
+
+Location: `data/local/src/commonMain/sqldelight/com/escodro/local/<Name>.sq`
+
+```sql
+-- Import custom Kotlin types at the top
+import kotlin.Boolean;
+import kotlinx.datetime.LocalDateTime;
+
+CREATE TABLE IF NOT EXISTS Category (
+    `category_id`    INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
+    `category_name`  TEXT NOT NULL,
+    `category_color` TEXT NOT NULL
+);
+
+selectAll:
+SELECT * FROM Category;
+
+selectByCategoryId:
+SELECT * FROM Category WHERE category_id = ?;
+
+insert:
+INSERT INTO Category (category_name, category_color) VALUES (?, ?);
+
+update:
+UPDATE Category SET category_name = ?, category_color = ? WHERE category_id = ?;
+
+delete:
+DELETE FROM Category WHERE category_id = ?;
+
+cleanTable:
+DELETE FROM Category;
+```
+
+**Rules:**
+- Field names prefixed with the table name in snake_case (e.g., `category_id`, `task_title`)
+- Custom Kotlin types declared via `INTEGER AS MyType` with a matching adapter in `DatabaseProvider`
+- Every table needs `insert:`, `update:`, `delete:`, and `cleanTable:` — `cleanTable:` is required for E2E test teardown
+- FOREIGN KEY with `ON DELETE CASCADE` for child tables (e.g., Task referencing Category)
+- For inserts that need to return the new ID: add a `lastInsertedId: SELECT LAST_INSERT_ROWID();` query
+
+## Phase 3: DAO Interface
+
+Location: `data/local/src/commonMain/kotlin/com/escodro/local/dao/<Name>Dao.kt`
+
+```kotlin
+interface CategoryDao {
+    // Observable streams: return Flow — never suspend
+    fun findAllCategories(): Flow<List<Category>>
+
+    // Single reads: suspend, always nullable
+    suspend fun findCategoryById(categoryId: Long): Category?
+
+    // Mutations: suspend, Unit return
+    suspend fun insertCategory(category: Category)
+    suspend fun updateCategory(category: Category)
+    suspend fun deleteCategory(category: Category)
+    suspend fun cleanTable()
+}
+```
+
+**Rule:** `Flow<List<T>>` (not suspend) for reactive reads; `suspend` for mutations and one-shot reads. If the repository only needs a point-in-time snapshot (not a stream), use `suspend fun ...: List<T>` instead.
+
+## Phase 4: DAO Implementation
+
+Location: `data/local/src/commonMain/kotlin/com/escodro/local/dao/impl/<Name>DaoImpl.kt`
+
+```kotlin
+internal class CategoryDaoImpl(
+    private val databaseProvider: DatabaseProvider,
+    private val dispatcherProvider: CoroutineDispatcherProvider,
+) : CategoryDao {
+
+    private val categoryQueries: CategoryQueries
+        get() = databaseProvider.getInstance().categoryQueries
+
+    // Flow return: .asFlow().mapToList() — no .first()
+    override fun findAllCategories(): Flow<List<Category>> =
+        categoryQueries.selectAll().asFlow().mapToList(dispatcherProvider.io)
+
+    // Suspend return: .executeAsOneOrNull() — never executeAsOne()
+    override suspend fun findCategoryById(categoryId: Long): Category? =
+        categoryQueries.selectByCategoryId(categoryId).executeAsOneOrNull()
+
+    override suspend fun insertCategory(category: Category) {
+        categoryQueries.insert(
+            category_name = category.category_name,
+            category_color = category.category_color,
+        )
+    }
+
+    override suspend fun updateCategory(category: Category) {
+        categoryQueries.update(
+            category_name = category.category_name,
+            category_color = category.category_color,
+            category_id = category.category_id,
+        )
+    }
+
+    override suspend fun deleteCategory(category: Category) {
+        categoryQueries.delete(category.category_id)
+    }
```

---

### Incident Patch 7: `fb325b0f` (2026-03-21)
**Commit Message**: 🧪 Add write-ui-tests skill for Alkaa

Adds a project-level skill guiding Compose/UI instrumented test conventions:
stateless composables, AlkaaTest base class, snake_case naming, Given/When/Then
structure, AlkaaThemePreview wrapping, semantic assertions, and fakes over mocks.

**File**: `.claude/skills/write-ui-tests/SKILL.md` (added, +240/-0)
```diff
@@ -0,0 +1,240 @@
+---
+name: write-ui-tests
+description: Use when writing or modifying UI/Compose instrumented tests in the Alkaa project — triggers on tasks like "add a UI test", "test this composable", "add instrumented test", "test this screen behavior".
+---
+
+# Write UI Tests
+
+## Overview
+
+UI tests in Alkaa test **Compose and UI behavior** in isolation — they are not integration tests. Composables should be as stateless as possible to make testing straightforward: pass all state and callbacks as parameters, then assert on the semantic tree.
+
+---
+
+## File Location
+
+Tests live in `commonTest` inside an `instrumented` package within each feature module:
+
+```
+features/<feature>/src/commonTest/kotlin/com/escodro/<feature>/presentation/instrumented/
+```
+
+---
+
+## Test Class Setup
+
+```kotlin
+@OptIn(ExperimentalTestApi::class)
+internal class TaskListTest : AlkaaTest() {
+
+    @Test
+    fun test_emptyViewIsShown() = runComposeUiTest {
+        // ...
+    }
+}
+```
+
+- Extend `AlkaaTest()` — handles Robolectric on Android, no-op on Desktop
+- `@OptIn(ExperimentalTestApi::class)` on the class
+- `internal` visibility
+- Each test body: `= runComposeUiTest { }`
+
+---
+
+## Naming
+
+Use snake_case with two accepted forms:
+
+```kotlin
+// Standard
+fun test_emptyViewIsShown()
+fun test_dueDateIsShown()
+fun test_allAlarmIntervalsCanBeSelected()
+
+// State-driven: when_<precondition>_then_<expected>
+fun when_view_is_opened_then_empty_view_is_shown()
+fun when_view_has_items_then_items_are_shown()
+```
+
+**No camelCase, no backtick names** in UI tests.
+
+---
+
+## Given / When / Then
+
+Use comments to separate the three blocks:
+
+```kotlin
+@Test
+fun test_errorViewIsShown() = runComposeUiTest {
+    // Given an error state
+    val state = TaskListViewState.Error(IllegalStateException())
+
+    // When the view is loaded
+    loadTaskList(state)
+
+    // Then the error view is shown
+    val header = runBlocking { getString(Res.string.task_list_header_error) }
+    onNodeWithText(text = header).assertExists()
+}
+```
+
+---
+
+## Loading Composables
+
+Define a private extension function on `ComposeUiTest` to encapsulate composable setup:
+
+```kotlin
+// Stateless — no DI needed
+private fun ComposeUiTest.loadTaskList(state: TaskListViewState) {
+    setContent {
+        AlkaaThemePreview {
+            TaskListScaffold(
+                taskViewState = state,
+                onFabClick = {},
+                onItemClick = {},
+                modifier = Modifier,
+            )
+        }
+    }
+}
+
+// With DI — wrap with KoinApplication
+private fun ComposeUiTest.loadTaskDetail(state: TaskDetailState) = setContent {
+    KoinApplication(application = { modules(testModule) }) {
+        AlkaaThemePreview {
+            TaskDetailRouter(
+                detailViewState = state,
+                actions = TaskDetailActions(),
+            )
+        }
+    }
+}
+```
+
+- Always wrap with `AlkaaThemePreview`
+- Pass all callbacks as `{}`
+- Only use `KoinApplication` when the composable requires injected dependencies
+
+---
+
+## Fakes Over Mocks
+
+Prefer fakes. Only use mocks for types you cannot create an interface for (Android/Framework types like `Context`).
+
+```kotlin
+class PermissionControllerFake : PermissionController {
+    var isPermissionGrantedValue: Boolean = true
+
+    override suspend fun isPermissionGranted(permission: Permission) =
+        isPermissionGrantedValue
+
+    override suspend fun requestPermission(permission: Permission) = Unit
+
+    fun clean() {
+        isPermissionGrantedValue = true
+    }
+}
+```
+
+Register in a Koin test module and reset in `@AfterTest`:
+
+```kotlin
+private val permissionsController = PermissionControllerFake()
+
+private val testModule = module {
+    single<PermissionController> { permissionsController }
+}
+
+@AfterTest
+fun tearDown() {
+    permissionsController.clean()
+}
+```
+
+---
+
+## Semantic Assertions
+
+Query the UI by text, content description, or test tag — never by component IDs:
+
+```kotlin
+// Existence
+onNodeWithText(text = header).assertExists()
+onNodeWithContentDescription(label = contentDescription).assertExists()
+
+// Visibility
+onNodeWithText(noAlarmString).assertIsDisplayed()
+
+// Non-existence
+onNodeWithText(repeatIconCd).assertDoesNotExist()
+
+// Selection state
+onChip(category.name).assertIsSelected()
+onChip(other.name).assertIsNotSelected()
+
+// Interactions
+onNodeWithText(label).performClick()
+onNodeWithContentDescription(cd, useUnmergedTree = true).performClick()
+
+// Multiple matches
+onAllNodesWithText(intervalString)[0].performClick()
+```
+
+Use `useUnmergedTree = true` when nodes are nested inside merged semantics.
+
+---
+
+## Resource Strings
+
+Resolve Compose Multiplatform string resources at test time via `runBlocking`:
+
+```kotlin
+val header = runBlocking { getString(Res.string.task_list_header_error) }
+onNodeWithText(text = header).assertExists()
+```
+
```

---

### Incident Patch 8: `bc0f4507` (2026-03-25)
**Commit Message**: Update dependency androidx.compose.ui:ui-test-manifest to v1.10.6

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ multiplatform_paths = "0.2.2"
 test_junit = "4.13.2"
 test_uiautomator = "2.3.0"
 test_junit4_android = "1.10.6"
-test_manifest = "1.10.5"
+test_manifest = "1.10.6"
 test_work = "2.11.1"
 test_robolectric = "4.16.1"
 
```

---

### Incident Patch 9: `94339744` (2026-03-25)
**Commit Message**: Update dependency androidx.compose.ui:ui-test-junit4-android to v1.10.6

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ multiplatform_paths = "0.2.2"
 # Test
 test_junit = "4.13.2"
 test_uiautomator = "2.3.0"
-test_junit4_android = "1.10.5"
+test_junit4_android = "1.10.6"
 test_manifest = "1.10.5"
 test_work = "2.11.1"
 test_robolectric = "4.16.1"
```

---

### Incident Patch 10: `918476d1` (2026-03-20)
**Commit Message**: Update dependency org.jetbrains.compose.ui:ui-tooling-preview to v1.10.3

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ compose_material3 = "1.10.0-alpha05"
 compose_components_resources = "1.10.3"
 compose_materialIconsExtended = "1.7.3"
 compose_uiTooling = "1.10.3"
-compose_uiToolingPreview = "1.10.2"
+compose_uiToolingPreview = "1.10.3"
 compose_uiTest = "1.10.3"
 compose_material3AdaptiveNavigationSuite = "1.10.0-alpha05"
 compose_navigation = "1.0.0-alpha06"
```

---

### Incident Patch 11: `a4d6ef11` (2026-03-20)
**Commit Message**: Update dependency org.jetbrains.compose.ui:ui-tooling to v1.10.3

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ compose_material = "1.10.3"
 compose_material3 = "1.10.0-alpha05"
 compose_components_resources = "1.10.3"
 compose_materialIconsExtended = "1.7.3"
-compose_uiTooling = "1.10.2"
+compose_uiTooling = "1.10.3"
 compose_uiToolingPreview = "1.10.2"
 compose_uiTest = "1.10.3"
 compose_material3AdaptiveNavigationSuite = "1.10.0-alpha05"
```

---

### Incident Patch 12: `bc1893b5` (2026-03-19)
**Commit Message**: Update dependency org.jetbrains.compose.ui:ui-test to v1.10.3

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ compose_components_resources = "1.10.2"
 compose_materialIconsExtended = "1.7.3"
 compose_uiTooling = "1.10.2"
 compose_uiToolingPreview = "1.10.2"
-compose_uiTest = "1.10.2"
+compose_uiTest = "1.10.3"
 compose_material3AdaptiveNavigationSuite = "1.10.0-alpha05"
 compose_navigation = "1.0.0-alpha06"
 compose_adaptive = "1.3.0-alpha03"
```

---

### Incident Patch 13: `50982f4a` (2026-03-11)
**Commit Message**: Update dependency androidx.compose.ui:ui-test-manifest to v1.10.5

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ multiplatform_paths = "0.2.2"
 test_junit = "4.13.2"
 test_uiautomator = "2.3.0"
 test_junit4_android = "1.10.5"
-test_manifest = "1.10.4"
+test_manifest = "1.10.5"
 test_work = "2.11.1"
 test_robolectric = "4.16.1"
 
```

---

### Incident Patch 14: `e632ad01` (2026-03-11)
**Commit Message**: Update dependency androidx.compose.ui:ui-test-junit4-android to v1.10.5

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ multiplatform_paths = "0.2.2"
 # Test
 test_junit = "4.13.2"
 test_uiautomator = "2.3.0"
-test_junit4_android = "1.10.4"
+test_junit4_android = "1.10.5"
 test_manifest = "1.10.4"
 test_work = "2.11.1"
 test_robolectric = "4.16.1"
```

---

### Incident Patch 15: `3c3919b3` (2026-03-07)
**Commit Message**: 📝 Update Kuvio generation rules with string and linting guidelines

Added a new step to extract user-visible strings to the resources module
and defined naming conventions for keys. Introduced rules for keeping
composables concise by extracting sub-composables and enforcing
PascalCase for constant names.

Updated the verification process to include Detekt and Ktlint checks to
ensure code quality and style compliance.

**File**: `.claude/commands/kuvio.md` (modified, +62/-17)
```diff
@@ -24,6 +24,7 @@ sed -n '<start>,<end>p' /Users/igorescodro/StudioProjects/alkaa/assets/designsys
 ```
 
 Extract from the HTML:
+
 - Visual structure and layout
 - Variants (sizes, states, color roles)
 - Spacing/sizing tokens
@@ -34,36 +35,68 @@ Extract from the HTML:
 
 Read at least 2 existing components as code reference:
 
-- `libraries/designsystem/src/commonMain/kotlin/com/escodro/designsystem/components/kuvio/card/KuvioCounterCard.kt`
-- `libraries/designsystem/src/commonMain/kotlin/com/escodro/designsystem/components/kuvio/dialog/KuvioDialog.kt`
-- `libraries/designsystem/src/commonMain/kotlin/com/escodro/designsystem/components/kuvio/icon/KuvioEmojiIcon.kt`
-- `libraries/designsystem/src/commonMain/kotlin/com/escodro/designsystem/components/kuvio/text/KuvioBodyMediumText.kt`
+-
+`libraries/designsystem/src/commonMain/kotlin/com/escodro/designsystem/components/kuvio/card/KuvioCounterCard.kt`
+-
+`libraries/designsystem/src/commonMain/kotlin/com/escodro/designsystem/components/kuvio/dialog/KuvioDialog.kt`
+-
+`libraries/designsystem/src/commonMain/kotlin/com/escodro/designsystem/components/kuvio/icon/KuvioEmojiIcon.kt`
+-
+`libraries/designsystem/src/commonMain/kotlin/com/escodro/designsystem/components/kuvio/text/KuvioBodyMediumText.kt`
 
 Also check the badge and item components for more patterns.
 
 ### 3. Choose the output directory
 
 Place the file(s) under:
+
 ```
 libraries/designsystem/src/commonMain/kotlin/com/escodro/designsystem/components/kuvio/<folder>/
 ```
 
-Use an existing folder if the component fits a category already present (`text`, `icon`, `card`, `badge`, `item`, `dialog`). Otherwise create a new folder named after the component category (lowercase, no spaces).
+Use an existing folder if the component fits a category already present (`text`, `icon`, `card`,
+`badge`, `item`, `dialog`). Otherwise create a new folder named after the component category (
+lowercase, no spaces).
 
 ### 4. Implement the component
 
 Follow these rules strictly:
 
-- **Naming**: All public composables must start with `Kuvio` prefix (e.g. `KuvioTaskChip`, `KuvioAvatar`)
+- **Naming**: All public composables must start with `Kuvio` prefix (e.g. `KuvioTaskChip`,
+  `KuvioAvatar`)
 - **Package**: `com.escodro.designsystem.components.kuvio.<folder>`
-- **Reuse**: Always use existing Kuvio text components (`KuvioBodyMediumText`, `KuvioLabelMediumText`, etc.) instead of raw `Text`. Reuse `KuvioEmojiIcon`, `KuvioDialogIconContainer`, etc. where applicable
-- **No canvas**: Do not use `Canvas` to draw shapes, icons, or backgrounds. Use `Box`, `Surface`, `Icon`, `clip`, `background` modifiers instead
-- **Theme-aware**: Use `MaterialTheme.colorScheme.*` and `MaterialTheme.shapes.*` tokens — never hardcode colors except in Previews
-- **Slots over config**: Prefer composable slot parameters (`icon: (@Composable () -> Unit)?`) over deeply nested configuration objects
-- **Split files**: If the component has 3+ distinct sub-composables or is clearly multi-part, split into separate files in the same folder
+- **Reuse**: Always use existing Kuvio text components (`KuvioBodyMediumText`,
+  `KuvioLabelMediumText`, etc.) instead of raw `Text`. Reuse `KuvioEmojiIcon`,
+  `KuvioDialogIconContainer`, etc. where applicable
+- **No canvas**: Do not use `Canvas` to draw shapes, icons, or backgrounds. Use `Box`, `Surface`,
+  `Icon`, `clip`, `background` modifiers instead
+- **Theme-aware**: Use `MaterialTheme.colorScheme.*` and `MaterialTheme.shapes.*` tokens — never
+  hardcode colors except in Previews
+- **Slots over config**: Prefer composable slot parameters (`icon: (@Composable () -> Unit)?`) over
+  deeply nested configuration objects
+- **Split files**: If the component has 3+ distinct sub-composables or is clearly multi-part, split
+  into separate files in the same folder
 - **KDoc**: Add KDoc for every public composable and its parameters
+- **Extract sub-composables**: Keep each `@Composable` function under ~60 lines with no more than ~3
+  levels of nesting. When a function grows beyond this, extract logical chunks (text fields, action
+  rows, decoration boxes, icon groups, etc.) into private composables in the same file.
+- **Constant naming**: Name all `private const val` string constants (content descriptions,
+  placeholders, preview text, etc.) in **PascalCase**, not SCREAMING_SNAKE_CASE — e.g.
+  `AddTaskPlaceholder`, not `ADD_TASK_PLACEHOLDER`.
+
+### 5. Add strings to the resources module
+
+For any user-visible strings in the component (labels, content descriptions, placeholders, etc.), *
+*do not hardcode them in the composable**. Add them to the `resources/` module instead, in the
+appropriate `strings.xml` files for each locale.
+
+Name keys using the pattern `kuvio_<component>_<purpose>`, e.g. `kuvio_add_task_bar_placeholder` or
+`kuvio_add_task_bar_cd_submit`.
+
+**Strings for Previews may be hardcoded** as private `const val` constants at the bottom of the
+file — they are never shipped to u
```

#### Recent Merged Pull Requests:
- **PR #1254** (2026-05-25): Update Gradle to v9.5.1 (@renovate[bot])
- **PR #1253** (2026-05-25): Update kotlinx-coroutines monorepo to v1.11.0 (@renovate[bot])
- **PR #1252** (2026-05-08): Update dependency org.jetbrains.kotlinx:kotlinx-datetime to v0.8.0-0.6.x-compat (@renovate[bot])
- **PR #1251** (2026-05-07): Update android.gradle.plugin to v9.2.1 (@renovate[bot])
- **PR #1250** (2026-04-29): Update Gradle to v9.5.0 (@renovate[bot])
- **PR #1249** (2026-04-25): Update dependency io.nlopez.compose.rules:detekt to v0.5.8 (@renovate[bot])
- **PR #1247** (2026-04-24): Update kotlin monorepo to v2.3.21 (@renovate[bot])
- **PR #1244** (2026-04-21): Update android.gradle.plugin to v9.2.0 (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
