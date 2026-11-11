> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/open-ani-animeko-learnings.md`  
> **Source**: github ([https://github.com/open-ani/animeko](https://github.com/open-ani/animeko))  
> **Source Version**: `2e22f49a`  
> **License**: AGPL-3.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-11T09:15:25.301Z  
> **Learning ID**: `learn-github-open-ani-animeko`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): open-ani/animeko

---

## 1. Executive Forensic Architecture & System Mechanics

`open-ani/animeko` (formerly `ani`) is a cross-platform (Kotlin Multiplatform + Compose Multiplatform, targeting Android, iOS, macOS, Windows, Linux) anime aggregation, metadata management, torrent stream-caching, and media playback client.

```
+---------------------------------------------------------------------------------------+
|                                    UI Layer                                           |
| Compose Multiplatform (Desktop / Android)  |  Swift / Metal Video Renderer (iOS)      |
+---------------------------------------------------------------------------------------+
                                           |
+---------------------------------------------------------------------------------------+
|                                 Domain & State                                        |
|  EpisodeFetchSelectPlayState  <-->  SubjectMediaFetchSessions  <-->  PlayerExtension   |
|         |                                                                             |
|         v                                                                             |
|  MediaSelector (Tiers / Sources) <---> Danmaku Engine <---> BangumiSyncState FSM      |
+---------------------------------------------------------------------------------------+
                                           |
+---------------------------------------------------------------------------------------+
|                                  Data / IPC Layer                                     |
|  Room KMP (SQLite)  |  DataStore (Preferences)  |  Android IPC / AIDL Proxy Service    |
|  [v29 Schema]       |  [Atomic Move Engine]     |  (IRemoteAniTorrentEngine)          |
+---------------------------------------------------------------------------------------+
                                           |
+---------------------------------------------------------------------------------------+
|                             Media & Native Engines                                    |
|   MediampPlayer (VLC / ExoPlayer)  |  libtorrent / Anitorrent Daemon  |  Metal CNN    |
+---------------------------------------------------------------------------------------+
```

### Core Subsystems and Boundary Isolations

1. **Decoupled BitTorrent Subsystem via Multi-Process RPC (`IRemoteAniTorrentEngine`)**:
   - On Android, running BitTorrent engines (`libtorrent`/`anitorrent`) within the main application process triggers severe memory spikes, CPU throttling, and OS-level low-memory killer (OOM) termination.
   - The engine is isolated into an external background service executing over Android IPC (AIDL interfaces). IPC state synchronization uses unidirectional data-flow collectors (`IAnitorrentConfigCollector`, `IProxySettingsCollector`) where configuration mutations stream from the host app UI into the service process via serialized parcelable bridges (`PAnitorrentConfig`, `PProxyConfig`).

2. **Hierarchical Episode Lifecycle Coordinator (`EpisodeFetchSelectPlayState`)**:
   - Manages the entire lifecycle of finding media, parsing source tiers, resolving direct streams vs. torrent infohashes, attaching subtitles/danmaku, and orchestrating playback.
   - Decouples **Subject-level** queries (anime-wide metadata, caching all torrent seeds across episodes) from **Episode-level** sessions. Switching an episode does not dump the media query cache; it cancels the nested `EpisodeSession` coroutine scope, freezes the player state, runs pre-switch interceptor extensions, resets the player canvas, and instantiates a new child session scope.

3. **Hybrid Metal / Compute Pipeline Video Post-Processing (`RawMetalRenderer.swift`)**:
   - On iOS, standard AVFoundation video outputs lack upscale/restoration capabilities for anime line-art.
   - A low-level Metal pipeline intercepts frames via `AVPlayerItemVideoOutput`, pulls frame buffers through zero-copy CoreVideo-to-Metal texture caches (`CVMetalTextureCacheCreateTextureFromImage`), and processes them through custom Metal Compute Kernels (Anime4K CNN shaders: `Anime4K_Restore_CNN_M` and `Anime4K_Upscale_CNN_x2_M`) before drawing to an `MTKView`.

4. **Multiplatform Persistence and Synchronous Migration Safeguards**:
   - Uses Room KMP backed by SQLite with an explicit schema hash contract (`AniDatabase`).
   - Relies on auto-migration specifications (`AutoMigrationSpec`) paired with explicit SQL invalidation hooks (`onPostMigrate`) to enforce cache coherency when database keys evolve.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Composite Key Cardinality Completeness in Normalized Junction Tables
**RULE**:
When caching multi-dimensional relational data from external upstream APIs (e.g., entity metadata, credit rosters, polymorphic tag bindings), the database junction table's PRIMARY KEY **MUST** include all distinguishing discriminator columns (`position`, `role`, `type`) rather than only `(entityId, targetId)`. If an upsert operation maps many-to-many relationships where an entity can fulfill multiple roles simultaneously, omitting the role discriminator **MUST NOT** occur.

**WHY**:
External APIs frequently sort payload arrays by position/role priority or ID. When Room/SQLite executes an `INSERT OR REPLACE` (upsert) on a primary key of only `(subjectId, personId)`, each subsequent role held by the same person overwrites the previous role. In anime metadata, a Director who is also credited for Storyboard and Key Animation will have their Director record silently deleted and replaced with Key Animation if the upstream API iterates through keyframes last.

**WHEN TO APPLY**:
Apply to all relational schemas, Room/SQLDelight/Exposed entities, SQLite junction tables, and local caches where upstream records have non-unique entity pairings but distinct contextual attributes.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified from: app/shared/app-data/src/commonMain/kotlin/data/persistent/database/entity/SubjectPersonRelationEntity.kt
@Entity(
    tableName = "subject_person",
    indices = [
        Index(value = ["personId"], orders = [Index.Order.ASC]),
        Index(value = ["subjectId"], orders = [Index.Order.ASC]),
    ],
    // Invariant: position MUST be part of primary key to allow one person 
    // to hold multiple positions (e.g. Director AND Storyboard) in the same subject.
    primaryKeys = ["subjectId", "personId", "position"],
    foreignKeys = [
        ForeignKey(
            entity = SubjectCollectionEntity::class,
            parentColumns = ["subjectId"],
            childColumns = ["subjectId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
)
data class SubjectPersonRelationEntity(
    val subjectId: Int,
    val personId: Int,
    val position: PersonPosition,
    val index: Int, // Upstream rank order preserved for deterministic sorting
)
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Primary key assumes 1:1 mapping between subject and person.
// Later rows during upsert will overwrite earlier rows.
@Entity(
    tableName = "subject_person",
    primaryKeys = ["subjectId", "personId"], // DEFECT: position omitted!
)
data class BrokenSubjectPersonRelationEntity(
    val subjectId: Int,
    val personId: Int,
    val position: PersonPosition,
)
```

**VERIFICATION METHOD**:
Enforce migration schema validation and write a DAO test asserting that upserting multiple records for the same `(subjectId, personId)` with differing `position` values yields `size == N` rows instead of `1`:
```kotlin
@Test
fun verifyMultiRoleRetentionOnUpsert() = runTest {
    dao.upsert(SubjectPersonRelationEntity(subjectId = 1, personId = 100, position = PersonPosition.Director, index = 1))
    dao.upsert(SubjectPersonRelationEntity(subjectId = 1, personId = 100, position = PersonPosition.KeyAnimation, index = 67))
    val rows = dao.getBySubject(1)
    assertEquals(2, rows.size)
    assertTrue(rows.any { it.position == PersonPosition.Director })
}
```

---

### 2. Post-Migration Cache Invalidation Invariant
**RULE**:
When an automated schema migration alters primary keys or splits merged rows to recover previously clobbered data, the migration specification **MUST** execute an explicit SQL cache-invalidation statement in `onPostMigrate` to clear timestamps/hashes across dependent entities. System components **MUST NOT** assume that a schema table rebuild automatically repairs data that was lost or corrupted prior to the migration.

**WHY**:
An `AutoMigration` that expands table keys recreates the SQLite table and copies existing rows. However, pre-migration databases already lost clobbered rows during past upserts. The local database will now have valid schema structure, but truncated historical state. Unless dependent tracking columns (e.g., `cachedStaffUpdated`) are set to `0`, the cache freshness subsystem will continue to treat the partial data as valid, permanently hiding the restored attributes from the user until cache TTL expires.

**WHEN TO APPLY**:
Any database migration (Room, SQLDelight, Flyway, Liquibase, Prisma) where table constraints, columns, or relations are modified to fix a data truncation bug.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified from: app/shared/app-data/src/commonMain/kotlin/data/persistent/database/AniDatabase.kt
class Migration_28_29 : AutoMigrationSpec {
    override fun onPostMigrate(connection: SQLiteConnection) {
        // Force refetch on next access: table rebuild preserves old rows, 
        // but missing roles from previous clobbering can only be recovered from network.
        connection.execSQL(
            "UPDATE `subject_collection` SET `cachedStaffUpdated` = 0, `cachedCharactersUpdated` = 0"
        )
    }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Empty post-migration hook leaving stale truncated data intact
class Migration_28_29_Bad : AutoMigrationSpec {
    override fun onPostMigrate(connection: SQLiteConnection) {
        // Table rebuilt, but subject_collection still has cachedStaffUpdated = 1718000000.
        // UI assumes cache is warm and never refetches missing records from network!
    }
}
```

**VERIFICATION METHOD**:
Implement a migration test using `MigrationTestHelper` that writes a pre-migration record with non-zero cache timestamps, executes the migration, and asserts that the timestamps were reset to `0L`:
```kotlin
@Test
fun verifyPostMigrationCacheInvalidation() {
    val helper = createHelper()
    helper.createDatabase(28).use { db ->
        db.execSQL("INSERT INTO subject_collection (subjectId, cachedStaffUpdated) VALUES (1, 1000)")
    }
    helper.runMigrationsAndValidate(29, emptyList()).use { db ->
        val cursor = db.prepare("SELECT cachedStaffUpdated FROM subject_collection WHERE subjectId = 1")
        assertTrue(cursor.step())
        assertEquals(0L, cursor.getLong(0))
    }
}
```

---

### 3. Cross-Process Settings Propagation via Serialized State Bridges
**RULE**:
When bridging state between an application UI process and an isolated daemon/worker process over an asynchronous IPC channel (AIDL/Binder, Unix Sockets, Named Pipes), configuration collectors **MUST** pass self-contained, version-tolerant serializable models or raw JSON payloads wrapped in Parcels, and the recipient process **MUST** buffer incoming values through a `StateFlow` or `MutableSharedFlow(replay = 1)`. Components **MUST NOT** perform direct blocking calls across IPC boundaries during UI initialization or inside coroutine loops.

**WHY**:
Direct cross-process blocking queries on startup freeze the calling thread if the target service is cold-starting or bound to native thread loops. Furthermore, binary serialization mismatches between separate build modules or APK splits crash Binder transactions with `BadParcelableException`. Exchanging JSON strings wrapped in lightweight parcelable containers ensures backwards-compatible payloads that decouple schema evolution between client and daemon.

**WHEN TO APPLY**:
Android IPC multi-process architectures, Electron main-to-renderer channels, Native C++ daemon IPC bridges.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified from: app/shared/app-data/src/androidMain/kotlin/domain/torrent/client/RemoteAnitorrentEngine.kt
// and TorrentEngineProxy.kt
private inline fun <I : IInterface, T> collectSettingsToRemote(
    settingsFlow: Flow<T>,
    noinline getBinder: suspend () -> I,
    crossinline transact: I.(T) -> Unit
) = scope.launch {
    // 1. Maintain latest state across reconnections
    val stateFlow = settingsFlow.stateIn(this)
    val remoteCall = RetryRemoteObject(fetchRemoteScope) { getBinder() }

    // 2. On connection established, emit latest cached state immediately
    connection.connected.filter { it }.collectLatest {
        stateFlow.collect { value ->
            remoteCall.call { transact(value) }
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Invoking blocking IPC calls directly in UI or synchronous init
fun updateSettingsSync(config: Config) {
    // If remote service is dead or frozen in native call, UI thread ANRs immediately
    val binder = ServiceManager.getService("remote_torrent") as IRemoteTorrent
    binder.updateConfig(config) // Crashes or blocks thread indefinitely
}
```

**VERIFICATION METHOD**:
Simulate IPC binder disconnection and service restart in an integration test. Verify that upon reconnection, the newly bound service receives the most recent configuration payload without manual user re-entry.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Silent Overwrite of Animation Directors in SQLite Cache (BUG-ANIMEKO-01)
- **Context**: `app/shared/app-data/src/commonMain/kotlin/data/persistent/database/entity/SubjectPersonRelationEntity.kt` & `AniDatabase.kt`
- **What Was Expected**: Querying an anime's production staff should return all staff members with their respective roles. A director who also drew storyboards or key frames should appear under "Director" and "Storyboard".
- **What Actually Happened**: The staff list regularly omitted the Director. Only secondary positions like Key Animation appeared for prominent creators.
- **Evidence in Repo**: Commit `a9763126`, PR `#3695`. DB Version bumped from 28 to 29.
- **Root Cause**:
  In SQLite table `subject_person`, the primary key was defined strictly as `PRIMARY KEY (subjectId, personId)`.
  When the remote Bangumi API returned staff info, it returned records sorted by position ID ascending. In anime production metadata, Director (`position = 2`) appeared early, followed by Storyboard (`position = 8`), Episode Director (`position = 16`), and Key Animation (`position = 20`).
  Because Room's DAO performed `upsert` (`INSERT OR REPLACE`), when the same `personId` was encountered for later roles, SQLite clobbered the existing row. The Director row was perpetually overwritten by whichever role was serialized last.
- **Remediation Code Diff**:
```diff
--- a/app/shared/app-data/src/commonMain/kotlin/data/persistent/database/entity/SubjectPersonRelationEntity.kt
+++ b/app/shared/app-data/src/commonMain/kotlin/data/persistent/database/entity/SubjectPersonRelationEntity.kt
@@ -23,3 +23,3 @@
 @Entity(
     "subject_person",
-    primaryKeys = ["subjectId", "personId"],
+    primaryKeys = ["subjectId", "personId", "position"],
     foreignKeys = [
--- a/app/shared/app-data/src/commonMain/kotlin/data/persistent/database/AniDatabase.kt
+++ b/app/shared/app-data/src/commonMain/kotlin/data/persistent/database/AniDatabase.kt
@@ -119,2 +119,3 @@
         AutoMigration(from = 27, to = 28, spec = Migrations.Migration_27_28::class),
+        AutoMigration(from = 28, to = 29, spec = Migrations.Migration_28_29::class),
     ],
+    class Migration_28_29 : AutoMigrationSpec {
+        override fun onPostMigrate(connection: SQLiteConnection) {
+            connection.execSQL("UPDATE `subject_collection` SET `cachedStaffUpdated` = 0, `cachedCharactersUpdated` = 0")
+        }
+    }
```
- **Lesson**: Primary keys on local cache tables must mirror the full tuple of distinct semantic identity from upstream APIs, not just relational identity. Schema fixes that allow missing data to be stored must proactively invalidate cache markers (`cachedStaffUpdated = 0`) to trigger recovery network fetches.

---

### Incident 2: DEX SimpleName Format Rejection from Test Function Names (BUG-ANIMEKO-02)
- **Context**: `app/shared/app-data/src/commonTest/kotlin/data/models/subject/RelatedPersonInfoTest.kt`
- **What Was Expected**: Kotlin Multiplatform tests located in `commonTest` compile and run on both Desktop JVM and Android Device Test (Instrumentation) runners.
- **What Actually Happened**: Desktop JVM tests passed, but Android Device Tests crashed during packaging with D8 Dex error:
  `cannot be represented in dex format`.
- **Evidence in Repo**: Commit `a9763126`, commit message:
  `test(subject): 测试名去掉逗号, 修复 Android device test 无法 dex`.
- **Root Cause**:
  The developer used backtick function identifiers containing Chinese commas:
  `fun `重要职位靠前，其余按index排序`()`.
  While JVM bytecode allows arbitrary UTF-8 strings in method names, the Android Dalvik/ART Executable (DEX) specification restricts method identifiers (`SimpleName`). The DEX specification allows spaces on modern Android SDKs (minSdk 30 / DEX 040), but commas (`,`) violate DEX token parsing rules in D8, causing dexing compilation to abort.
- **Remediation Code Diff**:
```diff
--- a/app/shared/app-data/src/commonTest/kotlin/data/models/subject/RelatedPersonInfoTest.kt
+++ b/app/shared/app-data/src/commonTest/kotlin/data/models/subject/RelatedPersonInfoTest.kt
@@ -30,2 +30,2 @@ class RelatedPersonInfoTest {
     @Test
-    fun `重要职位靠前，其余按index排序`() {
+    fun `重要职位靠前 其余按index排序`() {
```
- **Lesson**: In Kotlin Multiplatform code targeting Android execution (including instrumentation tests compiled from `commonTest`), backtick function names must never contain characters illegal in DEX `SimpleName` specifications (avoid commas, semicolons, colons, slashes, and periods).

---

### Incident 3: DataStore 1.2.0 Non-Atomic File Move Concurrency Race (BUG-ANIMEKO-03)
- **Context**: Desktop E2E tests, `gradle/libs.versions.toml`, `AppUpdateViewModel`
- **What Was Expected**: Calling `updateSettings(autoDownloadUpdate = true)` followed immediately by reading settings via `data.first()` must return `true`.
- **What Actually Happened**: E2E tests timed out after 5 minutes on macOS CI runners. `AppUpdateViewModel` read `autoDownloadUpdate = false` (the default value), aborting background updates.
- **Evidence in Repo**: Issue / PR `#3701`. DataStore updated from `1.2.0` to `1.3.0`.
- **Root Cause**:
  In DataStore `1.2.0` on JVM targets:
  1. When a write is active, any concurrent read collector bypasses in-memory cache and attempts a direct file read.
  2. DataStore 1.2.0 invoked `Files.move` without the `ATOMIC_MOVE` copy option.
  3. On standard JDK file system implementations, non-atomic `move` performs an `unlink` of the destination file followed by a `rename` of the staging file.
  4. In the microsecond window between `unlink` and `rename`, concurrent readers encountered a `NoSuchFileException`. DataStore caught this and fell back to empty/default Preferences (`autoDownloadUpdate = false`).
  5. The concurrent reader missed the subsequent update entirely due to upstream bug `b/431787506`.
- **Remediation Code Diff**:
```diff
--- a/gradle/libs.versions.toml
+++ b/gradle/libs.versions.toml
@@ -45,2 +45,2 @@
-datastore = "1.2.0"
+datastore = "1.3.0"
```
  *Upstream patch incorporates `ATOMIC_MOVE` and eliminates dropped updates during concurrent read/write.*
- **Lesson**: Critical storage frameworks that persist settings must employ true atomic file renames (`ATOMIC_MOVE` or native atomic file swaps). Non-atomic file swaps expose read threads to momentary file disappearance windows that masquerade as default states.

---

### Incident 4: Recursive Switch Episode Coroutine Scope Deadlock (BUG-ANIMEKO-04)
- **Context**: `app/shared/app-data/src/commonMain/kotlin/domain/episode/EpisodeFetchSelectPlayState.kt`
- **What Was Expected**: Calling `switchEpisode(newId)` stops the current episode's background tasks, pauses playback, invokes player extensions (such as watch history flushing), and initiates playback for `newId`.
- **What Actually Happened**: When switching episodes was triggered from an extension hook or auto-advance callback, the application deadlocked or threw unhandled coroutine cancellations, terminating the media playback engine.
- **Evidence in Repo**: `EpisodeFetchSelectPlayState.kt` annotations:
  `switchEpisode maybe called from a session scope task that was launched from [PlayerExtension.onStart]`.
- **Root Cause**:
  `switchEpisode` cancels `_episodeSessionFlow.value.sessionScope.coroutineContext.job.cancelAndJoin()`.
  If `switchEpisode` was invoked from a coroutine residing inside that very `sessionScope` (e.g., an auto-play extension detecting media completion), the function instructed its own parent coroutine to cancel and wait for itself to join, creating a self-canceling deadlock.
- **Remediation Code Diff**:
```diff
--- a/app/shared/app-data/src/commonMain/kotlin/domain/episode/EpisodeFetchSelectPlayState.kt
+++ b/app/shared/app-data/src/commonMain/kotlin/domain/episode/EpisodeFetchSelectPlayState.kt
@@ -165,6 +165,16 @@ class EpisodeFetchSelectPlayState(
+    currentCoroutineContext()[InSwitchEpisode]?.let { element ->
+        error(
+            "Recursive switchEpisode call detected. " +
+            "You wanted to switch to $episodeId, while you are already switching to ${element.newEpisodeId}."
+        )
+    }
+    // Detach from the sessionScope that is about to be cancelled:
+    backgroundScope.launch {
+        switchEpisodeLock.withLock {
+            withContext(InSwitchEpisode(episodeId)) {
+                _episodeSessionFlow.value.sessionScope.coroutineContext.job.cancelAndJoin()
+                // ... execute switch logic
+            }
+        }
+    }
```
- **Lesson**: A lifecycle coordinator must never cancel its active scope from within execution contexts owned by that scope. Detach lifecycle teardown routines to an independent orchestrator scope (`backgroundScope.launch`) and guard against reentry with context markers (`InSwitchEpisode`).

---

### Incident 5: Pause Invalidation Failure During Buffering Episode Transitions (BUG-ANIMEKO-05)
- **Context**: `EpisodeFetchSelectPlayState.kt` (lines 190–205)
- **What Was Expected**: When switching away from an episode that is currently buffering, the underlying media player must pause and clear playback pipelines.
- **What Actually Happened**: The old player continued to buffer and immediately began playing audio/video of the abandoned episode in the background once buffering completed, colliding with the audio of the newly selected episode.
- **Evidence in Repo**: `EpisodeFetchSelectPlayState.kt` inline documentation:
  `// 按播放意图判断: 缓冲中也应当暂停 (v1 只在 PLAYING 时暂停, 是个缺陷)`
- **Root Cause**:
  The v1 code checked `if (player.state.value.playbackState == PlaybackState.PLAYING) player.pause()`.
  If the network was slow and the player was in `PlaybackState.BUFFERING`, `playWhenReady` was `true` (user wanted playback), but the state was not `PLAYING`. The check evaluated to `false`, omitting the `pause()` command. Once chunks arrived, the native engine began outputting audio from the unlinked session.
- **Remediation Code Diff**:
```diff
--- a/app/shared/app-data/src/commonMain/kotlin/domain/episode/EpisodeFetchSelectPlayState.kt
+++ b/app/shared/app-data/src/commonMain/kotlin/domain/episode/EpisodeFetchSelectPlayState.kt
@@ -194,3 +194,3 @@
 withContext(mainDispatcher) {
-    if (player.state.value.playbackState == PlaybackState.PLAYING) {
+    if (player.state.value.playWhenReady) {
         player.pause()
     }
 }
```
- **Lesson**: In media engine lifecycle orchestration, evaluate user intent (`playWhenReady`) rather than transient player state machine flags (`BUFFERING`, `READY`, `PLAYING`) when issuing pre-emptive suspension commands.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Stable Multi-Attribute Ordering via `compareBy` and `thenBy`**:
  Sorting UI display items using `indexOfFirst` produces `-1` for missing elements. In Kotlin, if an item is not found, returning `-1` places it at the very top of ascending sorts unless explicitly normalized.
  ```kotlin
  // app/shared/app-data/src/commonMain/kotlin/data/models/subject/RelatedPersonInfo.kt
  val ImportanceOrder = compareBy<RelatedPersonInfo> { info ->
      val index = SORT_ORDER.indexOfFirst { position -> info.position == position }
      if (index == -1) Int.MAX_VALUE else index // Invariant: unlisted positions fall back to tail
  }.thenBy { it.index } // Invariant: secondary sort breaks ties deterministically via server sequence
  ```
- **Serialization of Compose Types**:
  Compose primitives like `Dp` cannot be directly processed by `kotlinx.serialization` without explicit custom serializers. Direct serialization leads to runtime reflection failure on multiplatform builds:
  ```kotlin
  // app/shared/app-data/src/commonMain/kotlin/data/repository/WindowStateRepository.kt
  private object DpSerializer : KSerializer<Dp> {
      override val descriptor = Float.serializer().descriptor
      override fun serialize(encoder: Encoder, value: Dp) = encoder.encodeFloat(value.value)
      override fun deserialize(decoder: Decoder): Dp = Dp(decoder.decodeFloat())
  }
  ```

### 2. Infinite Loop & Recursion Guards
- **Coroutine Context Invariant against Recursive Call Cycles**:
  Re-entrant functions across UI events must tag their coroutine context with a discriminator element to halt re-entrant loop amplification:
  ```kotlin
  private class InSwitchEpisode(val newEpisodeId: Int) : AbstractCoroutineContextElement(Key) {
      companion object Key : CoroutineContext.Key<InSwitchEpisode>
  }

  suspend fun switchEpisode(episodeId: Int) {
      currentCoroutineContext()[InSwitchEpisode]?.let {
          error("Recursive switchEpisode call detected. Wanted $episodeId, already switching to ${it.newEpisodeId}")
      }
      withContext(InSwitchEpisode(episodeId)) { /* execute */ }
  }
  ```
- **Bounded Pagination Loops on Notification Focus Landing**:
  When navigating from a deep-link notification to a nested comment (`focusReplyId`), the paging loader must impose an absolute boundary cap to prevent runaway paging loops if an ID was deleted upstream:
  ```kotlin
  // PR #3702: Focus reply pagination guard
  var pagesScanned = 0
  while (replyNotFound && pagesScanned < 10) { // Invariant: Hard cap at 10 pages
      loadNextPage()
      pagesScanned++
  }
  ```

### 3. UI & UX Micro-Mechanics
- **BackHandler Interception Stacking Order**:
  In Compose Multiplatform, back handlers execute in reverse order of registration (latest registration wins). When nesting full-screen or sliding comment panels (`CommentThreadHostContent` inside a player screen), the child host must conditionally register its `BackHandler`:
  ```kotlin
  // Invariant: Fullscreen video playback MUST take precedence over comment detail back handling
  val isPlayerFullscreen by playerFullscreenState.collectAsState()
  if (isThreadOpen && !isPlayerFullscreen) {
      BackHandler(enabled = true) {
          closeThreadDetail()
      }
  }
  ```
- **Pointer Event Decoupling for Thread Replies**:
  Clicking a root comment container navigates to the thread or activates the reply input bar. Clicking an author chip or nested user tag inside that comment must halt event bubbling to avoid triggering double focus:
  `Modifier.clickable` on the inner chip must use `indication = null` and intercept interactions cleanly.

### 4. Backend Concurrency & Memory Safety
- **CoreVideo Metal Texture Cache Flushes**:
  Failing to explicitly drain `CVMetalTextureCache` instances during media dimension alterations or player resets leaks hardware-accelerated video buffers, leading to `kCVReturnAllocationFailed`:
  ```swift
  // app/ios/Animeko/VideoEnhancementRenderer.swift
  func clearFrame() {
      frame = nil
      releaseTextures()
      lastFrameTime = 0
      if let cache { 
          // Invariant: Purge unreferenced CVMetalTexture references from Apple Silicon unified memory
          CVMetalTextureCacheFlush(cache, 0) 
      }
  }
  ```
- **Single-Thread IPC Concurrency Isolation**:
  Collecting flows across Binder boundaries must use dedicated single-thread dispatchers to prevent deadlock in thread pools if the host process experiences heavy disk I/O:
  ```kotlin
  private val defaultDispatcher: CoroutineDispatcher =
      newSingleThreadContext("RemoteAnitorrentEngine")
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Sentinel Type Validation over Boolean Coercions**:
  Avoid using raw nullable booleans (`Boolean?`) for complex state transitions like torrent download validation or Bangumi synchronization. Model full sealed interface states:
  ```kotlin
  // app/shared/app-data/src/commonMain/kotlin/data/models/bangumi/BangumiSyncState.kt
  sealed interface BangumiSyncState {
      val finished: Boolean get() = false
      data object Preparing : BangumiSyncState
      data class FetchingSubjects(val fetchedCount: Int) : BangumiSyncState
      data class FetchingEpisodes(val fetchedCount: Int) : BangumiSyncState
      data class Inserting(val savedCount: Int) : BangumiSyncState
      data class Finishing(val savedCount: Int) : BangumiSyncState
      data class Finished(val savedCount: Int, val error: AniBangumiSyncError?) : BangumiSyncState {
          override val finished: Boolean get() = true
      }
      data object Unsupported : BangumiSyncState
  }
  ```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Layer Boundary Enforcement**: Strict separation between `:app:shared:app-data` (Room, DataStore, Network Ktor, Torrent domain abstractions) and UI modules (`:app:shared:ui-comment`, `:app:shared:ui-player`).
- **Decoupled Engines**: Native media engines (`MediampPlayer`, wrapping VLC on Desktop and ExoPlayer on Android) expose state flows; the domain layer coordinates without referencing platform-specific UI bindings.

### 2. Core Abstractions
- `EpisodeFetchSelectPlayState`: Orchestrates the transition from an abstract episode identifier to candidate video sources, filtering via `MediaSelector`, picking the best bitstream, and driving the player.
- `PlayerExtension`: Interceptor interface (`onBeforeSwitchEpisode`, `onStart`) enabling modular behaviors like automatic next-episode queuing, resume playback, and analytics without polluting the base media controller.

### 3. Error Handling
- **Fault-Tolerant Remote Interception**: `RetryRemoteObject` wraps Android Binder interfaces. When `DeadObjectException` or IPC link severance occurs, it encapsulates reconnect retries without blowing up the UI collectors.
- **Sync Fallbacks**: Corrupted Bangumi sync states fall back to `BangumiSyncState.Unsupported` rather than throwing deserialization exceptions.

### 4. Testing
- **Cross-Platform Schema Verification**: `MigrationTestHelper` runs against real SQLite instances on Desktop JVM using embedded SQLite binaries, asserting schema fidelity against exported JSON schemas (`schemas/.../29.json`).
- **DEX Packaging Safeguards**: Common tests are verified to avoid naming semantics that break Dalvik/ART D8 compilers.

### 5. Security
- **IPC Access Authorization**: Local Android service binders validate calling packages/signatures.
- **Process Memory Protection**: Sensitive torrent tokens and proxy credentials pass through memory-bound Parcelables, stripped from public Android loggers.

### 6. Performance
- **Zero-Copy Metal Video Rendering**: iOS video processing creates `MTLTexture` instances directly from `CVPixelBuffer` via `CVMetalTextureCacheCreateTextureFromImage`, bypassing CPU memory copies completely.
- **Lazy Downloader State Streams**: Torrent downloaders in the proxy layer are initialized with `SharingStarted.Lazily` to avoid spooling native libtorrent threads until subscribers exist.

### 7. Deployment
- **CI/CD Invariants**: Automated GitHub Actions runners compile Android APKs, macOS Universal binaries (AArch64 + x86_64), and Linux distributables.
- **Pre-packaged JBR**: Desktop distributables link against custom JetBrains Runtime (JBR) environments containing JCEF binaries for embedded rendering support (`download_jbr.py`).

### 8. Agent Patterns
- **Local Automation Skills**: The repo embeds dedicated agent skill harnesses under `.agents/skills/` and `.claude/skills/` (e.g., `desktop-ui-verify`, `android-ui-verify`) containing Python and Bash scripts (`ui_tree.py`, `frame_diff.py`, `desk.sh`) that let automated agents execute the app, parse accessibility UI trees, capture frames, and assert UI visual diffs autonomously.

### 9. Data Flow
- Unidirectional Data Flow (UDF):
  `DataStore / Room -> Repository -> UseCase Flow -> StateFlow -> Compose UI`.
  Mutations propagate downwards via suspend commands; state propagates upwards via cold `Flow` transformations converted to hot `StateFlow` holders.

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Scope-Safe Multi-Stage Media Transition
When switching stateful playback engines, run teardown on an orchestrator scope detached from the child session scope being destroyed:
```kotlin
suspend fun switchEpisode(episodeId: Int) {
    backgroundScope.launch {
        switchLock.withLock {
            _session.value.scope.cancelAndJoin() // Clean child
            player.pause()                      // Suspend native engine
            _session.value = createSession(episodeId) // Mount new
        }
    }
}
```

### 2. Rule: Cache Rebuilds Require Data Invalidation
Any schema migration that expands composite keys to correct a truncation bug must issue an explicit SQL update in `onPostMigrate` to clear timestamps on parent entities, forcing a network refetch.

### 3. Architecture Principle: Cross-Process State Isolation
Heavy I/O, native memory pools, and untrusted protocols (such as BitTorrent peer networks) must run in an external OS process, communicating with the UI strictly via