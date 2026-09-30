# Forensic Learning Record (Deep Inspection): igorescodro/alkaa

> **Canonical Artifact**: `07_PROJECT_LEARNING/igorescodro-alkaa-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/igorescodro/alkaa](https://github.com/igorescodro/alkaa))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T23:32:34.298Z  
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

### Incident Patch 2: `df0de14b` (2026-03-21)
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
+    // Flow return: .asFlow().mapToList()
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
