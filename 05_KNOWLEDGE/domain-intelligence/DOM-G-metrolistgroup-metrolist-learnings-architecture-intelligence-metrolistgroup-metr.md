# Domain G — Architecture Intelligence: Architecture Intelligence: metrolistgroup-metrolist-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "metrolistgroup-metrolist-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T14:53:36.243Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-metrolistgroup-metrolist-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [metrolistgroup-metrolist-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T14:53:36.243Z`  
> **Learning ID**: `LEARN-EVO-metrolistgroup-metrolist-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: I (Content & Information Intelligence), K (Quality & Verification Intelligence), H (Technical Construction Intelligence), M (Feedback & Evolution Intelligence), B (Product Intelligence), D (Research & Knowledge Intelligence), J (Search & Distribution Intelligence), L (Deployment & Operations Intelligence), A (Human & Need Intelligence), F (Design Intelligence)
- **Confidence Rating**: 82%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from metrolistgroup-metrolist-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/metrolistgroup-metrolist-learnings.md`  
> **Source**: github ([https://github.com/MetrolistGroup/Metrolist](https://github.com/MetrolistGroup/Metrolist))  
> **Source Version**: `6fa4e821`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T14:53:27.382Z  
> **Learning ID**: `learn-github-metrolistgroup-metrolist`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): MetrolistGroup/Metrolist

> **Canonical Artifact**: `07_PROJECT_LEARNING/metrolistgroup-metrolist-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MetrolistGroup/Metrolist](https://github.com/MetrolistGroup/Metrolist))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-26T14:53:27.377Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MetrolistGroup/Metrolist`
- **Description**: Material Design YouTube Music client for Android, iOS and desktop
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 15210 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `androidApp/src/debug/kotlin/com/metrolist/android/utils/SentryManager.kt`
```
package com.metrolist.android.utils

import android.app.Application
import com.metrolist.shared.playback.PlaybackClientStats
import com.metrolist.shared.settings.Settings

object SentryManager {
    fun initialize(application: Application) = Unit

    // Keeps the launch counter and stored counts bounded; debug builds never send them.
    suspend fun reportPlaybackClientStats() {
        PlaybackClientStats.takeReportOnLaunch()
    }

    fun setEnabled(enabled: Boolean) {
        Settings.shared.sentryEnabled = enabled
    }
}

```

### Core Architecture Module: `androidApp/src/main/kotlin/com/metrolist/android/backup/AutomaticBackupWorker.kt`
```
package com.metrolist.android.backup

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.metrolist.shared.backup.AutoBackupFrequency
import com.metrolist.shared.backup.defaultBackupFilename
import com.metrolist.shared.db.MusicDatabase
import com.metrolist.shared.settings.Settings
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.koin.core.context.GlobalContext
import java.io.File
import java.util.concurrent.TimeUnit

class AutomaticBackupWorker(
    context: Context,
    parameters: WorkerParameters,
) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result = backupMutex.withLock { doWorkLocked() }

    private suspend fun doWorkLocked(): Result {
        if (inputData.getBoolean(PRUNE_ONLY_KEY, false)) {
            return runCatching { pruneBackups(File(applicationContext.filesDir, BACKUP_DIRECTORY)) }
                .fold({ Result.success() }, { Result.retry() })
        }
        val settings = Settings.shared
        if (!settings.autoBackupEnabled) return Result.success()

        val directory = File(applicationContext.filesDir, BACKUP_DIRECTORY)
        val destination = File(directory, "${defaultBackupFilename(BACKUP_FILENAME_PREFIX)}.zip")
        val backupResult =
            runCatching {
                check(directory.isDirectory || directory.mkdirs()) { "Could not create automatic backup directory" }
                BackupRestoreManager(applicationContext, GlobalContext.get().get<MusicDatabase>())
                    .backup(destination)
                    .getOrThrow()
            }
        if (backupResult.isFailure) return Result.retry()

        settings.autoBackupLastSuccessEpochMillis = System.currentTimeMillis()
        runCatching { settings.flush() }
        val pruneResult = runCatching { pruneBackups(directory) }
        if (pruneResult.isFailure) {
            WorkManager
                .getInstance(applicationContext)
                .enqueueUniqueWork(
                    PRUNE_WORK_NAME,
                    ExistingWorkPolicy.KEEP,
                    OneTimeWorkRequestBuilder<AutomaticBackupWorker>()
                        .setInputData(workDataOf(PRUNE_ONLY_KEY to true))
                        .build(),
                )
        }
        return Result.success()
    }

    private fun pruneBackups(directory: File) {
        directory
            .listFiles { file -> file.isFile && (file.extension == "tmp" || file.name.endsWith(".tmp")) }
            ?.forEach { it.delete() }
        directory
            .listFiles { file -> file.isFile && file.extension == "zip" }
            .orEmpty()
            .sortedByDescending(File::lastModified)
            .drop(MAX_RETAINED_BACKUPS)
            .forEach { check(it.delete()) { "Could not remove expired automatic backup" } }
    }

    companion object {
        private val backupMutex = Mutex()
        private const val BACKUP_DIRECTORY = "automatic-backups"
        private const val BACKUP_FILENAME_PREFIX = "metrolist-backup"
        private const val MAX_RETAINED_BACKUPS = 10
        private const val WORK_NAME = "automatic-backup"
        private const val PRUNE_WORK_NAME = "automatic-backup-prune"
        private const val PRUNE_ONLY_KEY = "pruneOnly"

        fun schedule(
            context: Context,
            enabled: Boolean,
            frequency: AutoBackupFrequency,
        ) {
            val workManager = WorkManager.getInstance(context)
            if (!enabled) {
                workManager.cancelUniqueWork(WORK_NAME)
                return
            }
            val request =
                PeriodicWorkRequestBuilder<AutomaticBackupWorker>(frequency.intervalMillis, TimeUnit.MILLISECONDS)
                    .build()
            workManager.enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
        }
    }
}

```

### Core Architecture Module: `androidApp/src/main/kotlin/com/metrolist/android/models/PersistPlayerState.kt`
```
/*
 * Metrolist Project (C) 2026
 * Licensed under GPL-3.0 | See git history for contributors
 */

package com.metrolist.android.models

import com.metrolist.shared.model.SongItem
import com.metrolist.shared.playback.MusicQueueSnapshot
import com.metrolist.shared.playback.StoredQueueSnapshotSerializer
import com.metrolist.shared.playback.hasSameStructure
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.util.UUID
import java.util.concurrent.atomic.AtomicLong

internal val playbackPersistenceJson =
    Json {
        ignoreUnknownKeys = true
        encodeDefaults = false
    }

@Serializable
data class PersistRadioQueueChip(
    val id: String,
    val title: String,
    val playlistId: String,
    val params: String? = null,
    val isSelected: Boolean = false,
)

@Serializable
data class PersistPlayerState(
    val playWhenReady: Boolean,
    val repeatMode: Int,
    val shuffleModeEnabled: Boolean,
    val volume: Float,
    val currentPosition: Long,
    val currentMediaItemIndex: Int,
    val playbackState: Int,
    val queueTitle: String? = null,
    val queueSongs: List<SongItem> = emptyList(),
    @Serializable(with = StoredQueueSnapshotSerializer::class)
    val queueSnapshot: MusicQueueSnapshot? = null,
    val radioQueueSeedSongId: String? = null,
    val radioQueueFinite: Boolean? = null,
    val radioQueue: Boolean = false,
    val explicitRadioQueue: Boolean? = null,
    val queueSessionId: Long? = null,
    val radioQueueChips: List<PersistRadioQueueChip> = emptyList(),
    val radioQueueSelectedChipId: String? = null,
    val radioQueueContinuation: String? = null,
    val radioQueuePlaylistId: String? = null,
    val radioQueueParams: String? = null,
    val radioQueueExplicitFeed: Boolean? = null,
    val revision: String? = null,
) : java.io.Serializable

internal class PlaybackPersistenceWriter(
    private val writePosition: (String) -> Unit,
    private val writeStoredValue: (String) -> Unit,
) {
    class Request internal constructor(
        internal val revision: Long,
        internal val state: PersistPlayerState?,
        internal val clear: Boolean,
    )

    private val lock = Any()
    private val revision = AtomicLong()

    // A null state is a skipped checkpoint; only requestClear discards the saved queue.
    fun request(state: PersistPlayerState?): Request = Request(revision.incrementAndGet(), state, clear = false)

    fun requestClear(): Request = Request(revision.incrementAndGet(), state = null, clear = true)

    private var lastState: PersistPlayerState? = null
    private var lastCheckpoint: PlayerPositionCheckpoint? = null

    fun write(request: Request) {
        synchronized(lock) {
            if (request.revision != revision.get()) return
            if (request.clear) {
                writeStoredValue("")
                writePosition("")
                lastState = null
                lastCheckpoint = null
                return
            }
            val state = request.state ?: return
            val previous = lastState
            val sameQueue =
                if (state.queueSnapshot != null) {
                    previous?.queueSnapshot?.hasSameStructure(state.queueSnapshot) == true
                } else {
                    previous?.queueSongs == state.queueSongs
                }
            val structureUnchanged =
                previous != null && sameQueue &&
                    state.copy(
                        queueSnapshot = previous.queueSnapshot,
                        currentPosition = previous.currentPosition,
                        currentMediaItemIndex = previous.currentMediaItemIndex,
                        repeatMode = previous.repeatMode,
                        playWhenReady = previous.playWhenReady,
                        playbackState = previous.playbackState,
                        volume = previous.volume,
                        revision = previous.revision,
                    ) == previous
            val committed =
                if (structureUnchanged) {
                    checkNotNull(previous)
                } else {
                    val next = state.copy(revision = UUID.randomUUID().toString())
                    writeStoredValue(playbackPersistenceJson.encodeToString(PersistPlayerState.serializer(), next))
                    lastState = next
                    next
                }
            val checkpoint =
                PlayerPositionCheckpoint(
                    checkNotNull(committed.revision),
                    state.currentPosition,
                    state.currentMediaItemIndex,
                    state.repeatMode,
                    state.playWhenReady,
                    state.playbackState,
                    state.volume,
                )
            if (checkpoint != lastCheckpoint) {
                writePosition(playbackPersistenceJson.encodeToString(PlayerPositionCheckpoint.serializer(), checkpoint))
                lastCheckpoint = checkpoint
            }
        }
    }
}

@Serializable
internal data class PlayerPositionCheckpoint(
    val revision: String,
    val positionMs: Long,
    val currentIndex: Int,
    val repeatMode: Int,
    val playWhenReady: Boolean,
    val playbackState: Int,
    val volume: Float,
)

internal fun decodePersistPlayerState(
    raw: String,
    position: String,
): PersistPlayerState {
    val state = playbackPersistenceJson.decodeFromString(PersistPlayerState.serializer(), raw)
    val checkpoint =
        runCatching {
            playbackPersistenceJson.decodeFromString(PlayerPositionCheckpoint.serializer(), position)
        }.getOrNull()?.takeIf {
            it.revision == state.revision &&
                it.currentIndex in (state.queueSnapshot?.displayedItems ?: state.queueSongs).indices
        }
            ?: return state
    return state.copy(
        currentPosition = checkpoint.positionMs,
        currentMediaItemIndex = checkpoint.currentIndex,
        queueSnapshot = state.queueSnapshot?.copy(currentIndex = checkpoint.currentIndex),
        repeatMode = checkpoint.repeatMode,
        playWhenReady = checkpoint.playWhenReady,
        playbackState = checkpoint.playbackState,
        volume = checkpoint.volume,
    )
}

```

### Core Architecture Module: `androidApp/src/main/kotlin/com/metrolist/android/playback/AndroidQueueCoordinator.kt`
```
package com.metrolist.android.playback

import android.content.Context
import androidx.media3.common.Player
import com.metrolist.android.R
import com.metrolist.android.deviceconnect.AndroidDeviceConnect
import com.metrolist.android.listentogether.AndroidListenTogetherManager
import com.metrolist.android.models.PersistPlayerState
import com.metrolist.android.models.PersistRadioQueueChip
import com.metrolist.shared.api.PlaylistPage
import com.metrolist.shared.api.shouldLoadPlaylistPage
import com.metrolist.shared.cast.CastState
import com.metrolist.shared.cast.forQueueEntry
import com.metrolist.shared.deviceconnect.DcPlaybackAction
import com.metrolist.shared.deviceconnect.DcPlaybackCommand
import com.metrolist.shared.model.RadioQueueChip
import com.metrolist.shared.model.RadioQueuePage
import com.metrolist.shared.model.RadioRecommendationHistory
import com.metrolist.shared.model.SongItem
import com.metrolist.shared.model.buildRadioQueueRecommendations
import com.metrolist.shared.model.isPodcast
import com.metrolist.shared.model.isVideoSong
import com.metrolist.shared.model.selectRadioQueueChip
import com.metrolist.shared.playback.MusicQueue
import com.metrolist.shared.playback.MusicQueueSnapshot
import com.metrolist.shared.playback.PlaybackSeekSource
import com.metrolist.shared.playback.QUEUE_SOURCE_ADDED_MANUALLY
import com.metrolist.shared.playback.QUEUE_SOURCE_AUTO_MIX
import com.metrolist.shared.playback.QUEUE_SOURCE_RECOMMENDED
import com.metrolist.shared.playback.isAutoMixQueueSource
import com.metrolist.shared.playback.isRecommendationGeneratedQueueSource
import com.metrolist.shared.playback.isRecommendedQueueSource
import com.metrolist.shared.settings.BlockedContent
import com.metrolist.shared.settings.Settings
import com.metrolist.shared.state.GlobalYouTubeRepository
import com.metrolist.shared.youtube.playback.PlaybackNetworkStateStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.jetbrains.compose.resources.getString
import timber.log.Timber
import java.util.concurrent.atomic.AtomicInteger

internal class AndroidQueueCoordinator(
    private val context: Context,
    private val player: AndroidPlaybackPlayer,
    private val scope: CoroutineScope,
    private val _repeatMode: MutableStateFlow<Int>,
    private val _shuffleModeEnabled: MutableStateFlow<Boolean>,
    private val onSave: () -> Unit,
    private val onSessionReset: () -> Unit,
    private val onVideoSelected: (SongItem) -> Unit = {},
    private val castState: () -> CastState = { CastState() },
) {
    companion object {
        private const val TAG = "MusicService"
        private const val MAX_RADIO_CONTINUATION_PAGES = 10
    }

    lateinit var transitions: AndroidQueueTransitions
    val repeatMode: StateFlow<Int> = _repeatMode.asStateFlow()
    private val _isQueueLoading = MutableStateFlow(false)
    val isQueueLoading: StateFlow<Boolean> = _isQueueLoading.asStateFlow()
    private val queueLoadingOperations = AtomicInteger()
    private val _isPlaybackLoading = MutableStateFlow(false)
    val isPlaybackLoading: StateFlow<Boolean> = _isPlaybackLoading.asStateFlow()
    private val playbackLoadingOperations = AtomicInteger()

    private val queueTitleState = MutableStateFlow<String?>(null)
    val queueTitle: StateFlow<String?> = queueTitleState.asStateFlow()

    private val queueChipsState = MutableStateFlow<List<RadioQueueChip>>(emptyList())
    val queueChips: StateFlow<List<RadioQueueChip>> = queueChipsState.asStateFlow()

    var recommendationSeedSongId: String? = null
        private set
    private var radioQueueContinuation: String? = null
    private var radioQueueContinuationClassic: Boolean = Settings.shared.classicRecommendations
    private var radioQueueExplicitFeed = false
    private var radioQueuePlaylistId: String? = null
    private var radioQueueParams: String? = null
    private var isRadioQueue = false
    private var isExplicitRadioQueue = false
    val explicitRadioQueue: Boolean get() = isExplicitRadioQueue
    private val queuedSongIds = linkedSetOf<String>()
    private val recommendationHistory = RadioRecommendationHistory()
    private val queueSessionLock = Any()
    var isFiniteQueue = false
        private set
    private var recommendationRequestGeneration = 0L
    var recommendationBootstrapJob: Job? = null
        private set
    private var autoLoadMoreJob: Job? = null
    private val _playlistPage = MutableStateFlow<PlaylistPage?>(null)
    val playlistPageState = _playlistPage.asStateFlow()
    var playlistPage: PlaylistPage?
        get() = _playlistPage.value
        private set(value) {
            _playlistPage.value = value
        }
    private var playlistPageJob: Job? = null
    private var lastAutoLoadedSongId: String? = null

    @Volatile
    var queueSessionId = 0L
        private set
    private val pendingRestorePosition = PendingQueueRestorePosition()
    private var remoteLoadGeneration = 0L

    fun saveShuffleMode() {
        val queue = player.queueSnapshots.value
        if (queue.displayedItems.isNotEmpty()) Settings.shared.shuffleEnabled = queue.isShuffled
    }

    fun restoreShuffleMode() {
        _shuffleModeEnabled.value =
            restoredShuffleMode(Settings.shared.shuffleEnabled, Settings.shared.rememberShuffleAndRepeat)
    }

    fun buildPersistPlayerState(): PersistPlayerState? {
        if (!Settings.shared.persistentQueue) return null
        val queue = player.queueSnapshots.value
        if (queue.displayedItems.isEmpty()) return null
        val currentIndex = queue.currentIndex.coerceIn(queue.displayedItems.indices)
        val persistedQueue = queue.copy(currentIndex = currentIndex)

        val remote = castState().takeIf { it.isConnected }?.forQueueEntry(player.queueState.value)
        val playing = remote?.isPlaying ?: player.isPlaying.value
        return PersistPlayerState(
            playWhenReady = playing,
            currentMediaItemIndex = currentIndex,
            currentPosition = remote?.positionMs ?: player.getRealtimePositionMs(),
            queueSnapshot = persistedQueue,
            playbackState = if (playing) 3 else 1,
            repeatMode = repeatMode.value,
            shuffleModeEnabled = persistedQueue.isShuffled,
            volume = 1.0f,
            queueTitle = queueTitleState.value,
            radioQueueSeedSongId = recommendationSeedSongId,
            radioQueueFinite = isFiniteQueue,
            radioQueue = isRadioQueue,
            explicitRadioQueue = isExplicitRadioQueue,
            queueSessionId = queueSessionId.takeIf { isRadioQueue },
            radioQueueChips =
                queueChipsState.value.map { chip ->
                    PersistRadioQueueChip(chip.id, chip.title, chip.playlistId, chip.params, chip.isSelected)
                },
            radioQueueSelectedChipId =
                queueChipsState.value
                    .firstOrNull { it.isSelected }
                    ?.id,
            radioQueueContinuation = radioQueueContinuation,
            radioQueuePlaylistId = radioQueuePlaylistId,
            radioQueueParams = radioQueueParams,
            radioQueueExplicitFeed = radioQueueExplicitFeed,
        )
    }

    fun restorePersistedQueue(
        state: PersistPlayerState,
        restoredQueue: MusicQueueSnapshot,
        expectedQueueSessionId: Long,
        restoreModes: Boolean,
    ): Boolean =
        synchronized(queueSessionLock) {
            if (queueSessionId != expectedQueueSessionId || player.songQueue.value.isNotEmpty()) return@synchronized false
            val restoredSongs = restoredQueue.displayedItems
            val restoredSeed =
                restoredQueue.originalItems.firstOrNull { !it.queueSourceTitle.isRecommendationGeneratedQueueSource() }
                    ?: restoredSongs.getOrNull(restoredQueue.currentIndex)
            val restoredMix = restoredQueue.originalItems.any { it.queueSourceTitle.isAutoMixQueueSource() }
            resetQueueSession(
                seedSongId = state.radioQueueSeedSongId ?: restoredSeed?.id,
                queueTitle =
                    state.queueTitle
                        ?: restoredSeed?.title?.takeIf { restoredMix }?.let { context.getString(R.string.song_mix_title, it) },
                finite = state.radioQueueFinite ?: !restoredMix,
                sessionId = state.queueSessionId,
            )
            val restoredPosition = state.currentPosition
            isRadioQueue = state.radioQueue || restoredMix
            isExplicitRadioQueue = state.explicitRadioQueue ?: false
            radioQueueContinuation = null
            // A persisted continuation's recommendations mode is not stored, so after a
            // restart its mode is unknown: discard it and let autoplay fetch a fresh page.
            radioQueuePlaylistId = state.radioQueuePlaylistId
            radioQueueParams = state.radioQueueParams
            radioQueueExplicitFeed = state.radioQueueExplicitFeed ?: (
                radioQueueParams != null ||
                    radioQueuePlaylistId?.let { it != "RDAMVM$recommendationSeedSongId" } == true
            )
            queueChipsState.value =
                state.radioQueueChips.map { chip ->
                    RadioQueueChip(
                        chip.id,
                        chip.title,
                        chip.playlistId,
                        chip.params,
                        state.radio
```

### Core Architecture Module: `androidApp/src/main/kotlin/com/metrolist/android/playback/AndroidQueueTransitions.kt`
```
package com.metrolist.android.playback

import android.os.SystemClock
import androidx.compose.runtime.snapshotFlow
import androidx.media3.common.Player
import com.metrolist.android.deviceconnect.AndroidDeviceConnect
import com.metrolist.android.listentogether.AndroidListenTogetherManager
import com.metrolist.shared.api.musicvideo.MusicVideoResolver
import com.metrolist.shared.model.SongItem
import com.metrolist.shared.model.canSwitchToAudioTrack
import com.metrolist.shared.model.isPodcast
import com.metrolist.shared.model.isVideoSong
import com.metrolist.shared.playback.PlaybackCrossfadeController
import com.metrolist.shared.playback.SleepTimerController
import com.metrolist.shared.playback.ffmpeg.DirectPlaybackCache
import com.metrolist.shared.playback.playbackCrossfadeDurationMs
import com.metrolist.shared.playback.playbackCrossfadeGains
import com.metrolist.shared.playback.playbackCrossfadeProgress
import com.metrolist.shared.playback.songsShareAlbum
import com.metrolist.shared.settings.BlockedContent
import com.metrolist.shared.settings.Settings
import com.metrolist.shared.state.SongMetadataState
import com.metrolist.shared.youtube.playback.PlaybackNetworkStateStore
import com.metrolist.shared.youtube.playback.PlaybackResource
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import timber.log.Timber
import kotlin.time.Duration.Companion.milliseconds

internal class AndroidQueueTransitions(
    private val player: AndroidPlaybackPlayer,
    private val scope: CoroutineScope,
    private val audioCacheManager: AudioCacheManager,
    private val musicVideoResolver: MusicVideoResolver,
    private val queue: AndroidQueueCoordinator,
    private val fetchPlaybackResource: suspend (SongItem, Boolean) -> PlaybackResource?,
    private val onPreloadFailure: suspend (PlaybackResource, SongItem, Boolean, Throwable) -> Unit,
    private val onAdvance: suspend () -> Unit,
    private val episodeResumePosition: suspend (SongItem, Long) -> Long,
) {
    companion object {
        private const val TAG = "MusicService"
        private const val NEXT_RENDER_WAIT_TIMEOUT_MS = 5_000L
    }

    private var nextTrackPreloadJob: Job? = null
    private var nextTrackPreloadToken: AndroidPlaybackPlayer.PlaybackPreloadToken? = null
    private val nextTrackPreloadResourceState = MutableStateFlow<PlaybackResource?>(null)
    private var nextTrackPreloadResource: PlaybackResource?
        get() = nextTrackPreloadResourceState.value
        set(value) {
            nextTrackPreloadResourceState.value = value
        }
    private var nextTrackPreloadSong: SongItem? = null
    private var nextTrackPreloadSourceSong: SongItem? = null
    private var nextTrackPreloadExpectedInstanceId = 0L
    private var nextTrackPreloadAttempt: NextTrackPreloadAttempt? = null
    private val nextTrackPreloadInvalidation = MutableStateFlow(0L)
    private var crossfadeJob: Job? = null
    var isCrossfading = false
        private set
    private val crossfadeCompletionGuard = CrossfadeCompletionGuard()
    private val crossfadeController = PlaybackCrossfadeController<SongItem>()
    val crossfadeState: StateFlow<AndroidCrossfadeState?> = crossfadeController.state
    private val queuePreCacheScheduler = QueuePreCacheScheduler(scope)
    private val deferredSabrCacheSongs = linkedMapOf<String, SongItem>()
    private val pendingAutomaticCacheSongs = linkedMapOf<String, SongItem>()
    private val cacheRetryPolicy = CacheRetryPolicy(SystemClock::elapsedRealtime)
    private var cacheQueueSessionId: Long? = null
    private var preCacheJob: Job? = null

    fun observe(sleepTimer: SleepTimerController) {
        player.consumePreloadedNext = { consumePreloadedNext(player.currentPlaybackInstanceId) }

        scope.launch {
            nextTrackPreloadTriggers(
                playbackPosition = player.currentPosition,
                currentMediaItemIndex = player.currentMediaItemIndex,
                songQueue = player.songQueue,
                repeatMode = queue.repeatMode,
                invalidation = nextTrackPreloadInvalidation,
                currentPlaybackInstanceId = { player.currentPlaybackInstanceId },
                hasMore = { queue.playlistPage?.hasMore == true },
                stopAfterCurrentSong = { sleepTimer.isStopAfterCurrentSong },
                isPreloadedTargetActive = { instanceId, nextVideoId ->
                    val token = nextTrackPreloadToken
                    token != null && token.queueSongId == nextVideoId &&
                        nextTrackPreloadExpectedInstanceId == instanceId &&
                        player.isPreloadedPlaybackActive(token)
                },
            ).collectLatest { trigger ->
                if (trigger.shouldPreload && trigger.nextVideoId != null) {
                    if (!trigger.hasValidPreload) {
                        while (isCrossfading) delay(CROSSFADE_UPDATE_INTERVAL_MS.milliseconds)
                        if (nextTrackPreloadToken != null) cancelNextTrackPreload(resetAttempt = false)
                        delay(NEXT_TRACK_PRELOAD_SETTLE_DELAY_MS.milliseconds)
                        scheduleNextTrackPreload(trigger)
                    }
                } else if (nextTrackPreloadToken != null || nextTrackPreloadJob?.isActive == true) {
                    cancelNextTrackPreload()
                }
            }
        }

        scope.launch {
            combine(
                player.currentPosition,
                player.duration,
                player.isPlaying,
            ) { position, duration, isPlaying ->
                Triple(position, duration, isPlaying)
            }.collect { (position, duration, isPlaying) ->
                val songs = player.songQueue.value
                val next =
                    nextQueuedIndex(
                        songs.size,
                        player.currentMediaItemIndex.value,
                        queue.repeatMode.value,
                        queue.playlistPage?.hasMore == true,
                    )?.let(songs::getOrNull)
                        ?: return@collect
                val current = player.currentSong.value
                val isGapless =
                    Settings.shared.crossfadeGapless && songsShareAlbum(current, next)
                val crossfadeDurationMs =
                    playbackCrossfadeDurationMs(
                        enabled = Settings.shared.crossfadeEnabled,
                        preserveSameAlbumGapless = Settings.shared.crossfadeGapless,
                        sameAlbum = isGapless,
                        configuredDurationMs = (Settings.shared.crossfadeDuration * 1_000f).toLong().coerceAtLeast(1_000L),
                        outgoingDurationMs = duration,
                        incomingDurationMs = next.duration?.times(1_000L) ?: duration,
                    )
                if (
                    shouldStartAndroidCrossfade(
                        playbackPositionMs = position,
                        durationMs = duration,
                        crossfadeDurationMs = crossfadeDurationMs,
                        isPlaying = isPlaying,
                        crossfadeEnabled = Settings.shared.crossfadeEnabled,
                        isCrossfading = isCrossfading,
                        repeatMode = queue.repeatMode.value,
                        isGapless = isGapless,
                        stopAfterCurrentSong = sleepTimer.isStopAfterCurrentSong,
                    )
                ) {
                    startAndroidCrossfade()
                }
            }
        }

        scope.launch {
            combine(
                player.currentMediaItemIndex,
                player.songQueue,
                player.currentPlaybackResource,
                player.playbackStateFlow,
                nextTrackPreloadResourceState,
            ) { currentIndex, queue, resource, playbackState, preloaded ->
                val currentSongId = queue.getOrNull(currentIndex)?.id
                listOf(resource?.videoId, currentSongId, playbackState, preloaded?.videoId)
            }.combine(queue.repeatMode) { targets, repeat -> targets to repeat }
                .distinctUntilChanged()
                .collect { scheduleQueuePreCache(queue.queueSessionId) }
        }

        scope.launch {
            combine(player.isPlaying, player.currentSong) { playing, song -> playing to song }
                .distinctUntilChanged()
                .collect { (playing, _) -> if (playing) scheduleQueuePreCache(queue.queueSessionId) }
        }

        scope.launch {
            snapshotFlow { Triple(Settings.shared.videoViewerVisible, Settings.shared.crossfadeEnabled, Settings.shared.crossfadeGapless) }
                .distinctUntilChanged()
                .collect { cancelNextTrackPreload() }
        }

        scope.launch {
            snapshotFlow { Settings.shared.maxSongCacheSize }
                .distinctUntilChanged()
                .collect { cacheSize ->
                    withContext(Dispatchers.IO) { DirectPlaybackCache.clear() }
                    audioCacheManager.sabrPlaybackCache.clear()
                    if (cacheSize == 0) {
                        preCacheJob?.cancel()
                        preCacheJob = null
                        deferredSabrCacheSongs.clear()
                        pendingAutomaticCacheSongs.clear()
                        cancelSongCache()
                    } else {
                        scheduleQueuePreCache(que
```

### Core Architecture Module: `androidApp/src/main/kotlin/com/metrolist/android/playback/AutomotiveQueuePolicy.kt`
```
package com.metrolist.android.playback

import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.session.SessionError
import androidx.media3.session.SessionResult
import com.metrolist.innertubex.extraction.StreamResolveException
import com.metrolist.shared.model.SongItem
import com.metrolist.shared.playback.MusicQueueEntry
import com.metrolist.shared.playback.PlaybackFailureCategory
import com.metrolist.shared.playback.PlaybackFailureClassifier
import kotlinx.coroutines.CancellationException
import timber.log.Timber

internal fun nextMediaSessionRepeatMode(mode: Int): Int =
    when (mode) {
        Player.REPEAT_MODE_OFF -> Player.REPEAT_MODE_ALL
        Player.REPEAT_MODE_ALL -> Player.REPEAT_MODE_ONE
        else -> Player.REPEAT_MODE_OFF
    }

internal fun canResolveMediaSessionItems(
    canBrowse: Boolean,
    isAssistant: Boolean,
    mediaItems: List<MediaItem>,
    entries: List<MusicQueueEntry>,
): Boolean {
    if (canBrowse || isAssistant) return true
    val item = mediaItems.singleOrNull() ?: return false
    return item.requestMetadata.searchQuery == null && automotiveQueueIndex(item.mediaId, entries) != null
}

internal suspend fun offlineAutomotiveQueue(
    queue: AutomotiveSongResolution,
    networkConnected: Boolean,
    isCached: suspend (String) -> Boolean,
): AutomotiveSongResolution? {
    if (networkConnected) return queue
    val playableIndices = queue.songs.indices.filter { isCached(queue.songs[it].id) }
    if (playableIndices.isEmpty()) return null
    val selected = playableIndices.firstOrNull { it >= queue.startIndex } ?: playableIndices.first()
    return queue.copy(
        songs = playableIndices.map(queue.songs::get),
        startIndex = playableIndices.indexOf(selected),
        retainsRequestedStartPosition = queue.retainsRequestedStartPosition && selected == queue.startIndex,
    )
}

// Selects inside the active queue so going offline never trims it to the downloaded songs.
internal suspend fun offlineQueueEntryIndex(
    entries: List<MusicQueueEntry>,
    startIndex: Int,
    isCached: suspend (String) -> Boolean,
): Int? {
    val playableIndices = entries.indices.filter { isCached(entries[it].song.id) }
    return playableIndices.firstOrNull { it >= startIndex } ?: playableIndices.firstOrNull()
}

internal suspend fun nextOfflineQueueIndex(
    songs: List<SongItem>,
    currentIndex: Int,
    repeatAll: Boolean,
    backward: Boolean = false,
    isPlayable: suspend (SongItem) -> Boolean,
): Int? {
    if (currentIndex !in songs.indices) return null
    val indices =
        if (backward) {
            (currentIndex - 1 downTo 0) + if (repeatAll) (songs.lastIndex downTo currentIndex + 1) else emptyList()
        } else {
            (currentIndex + 1 until songs.size) + if (repeatAll) (0 until currentIndex) else emptyList()
        }
    return indices.firstOrNull { isPlayable(songs[it]) }
}

internal fun automotivePlaybackErrorCode(error: Throwable?): Int {
    val requiresLogin =
        generateSequence(error) { it.cause?.takeUnless { cause -> cause === it } }
            .filterIsInstance<StreamResolveException>()
            .any { failure -> failure.diagnostics?.attempts?.any { it.outcome == "playability:LOGIN_REQUIRED" } == true }
    if (requiresLogin) return PlaybackException.ERROR_CODE_AUTHENTICATION_EXPIRED
    return when (PlaybackFailureClassifier.fromThrowable(error)) {
        PlaybackFailureCategory.NETWORK -> PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED
        PlaybackFailureCategory.TIMEOUT -> PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT
        PlaybackFailureCategory.DECODER -> PlaybackException.ERROR_CODE_DECODING_FAILED
        PlaybackFailureCategory.UNAVAILABLE -> PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND
        else -> PlaybackException.ERROR_CODE_UNSPECIFIED
    }
}

internal suspend fun addAutomotiveSongToQueue(
    mediaId: String?,
    isPlaybackLocked: () -> Boolean,
    resolve: suspend (MediaItem) -> List<MediaItem>,
    append: (List<MediaItem>) -> Unit,
): SessionResult {
    if (isPlaybackLocked()) return SessionResult(SessionError.ERROR_PERMISSION_DENIED)
    if (mediaId == null || AutomotiveMediaIds.songId(mediaId).isNullOrBlank()) {
        return SessionResult(SessionError.ERROR_BAD_VALUE)
    }
    return try {
        val items = resolve(MediaItem.Builder().setMediaId(mediaId).build())
        when {
            isPlaybackLocked() -> {
                SessionResult(SessionError.ERROR_PERMISSION_DENIED)
            }

            items.isEmpty() -> {
                SessionResult(SessionError.ERROR_BAD_VALUE)
            }

            else -> {
                append(items)
                SessionResult(SessionResult.RESULT_SUCCESS)
            }
        }
    } catch (error: CancellationException) {
        throw error
    } catch (error: Exception) {
        Timber.e(error, "Automotive queue addition failed")
        SessionResult(SessionError.ERROR_IO)
    }
}

```

### Core Architecture Module: `androidApp/src/main/kotlin/com/metrolist/android/playback/DownloadQueuePersistence.kt`
```
package com.metrolist.android.playback

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import timber.log.Timber
import java.util.concurrent.atomic.AtomicReference

internal class DownloadQueuePersistence(
    scope: CoroutineScope,
    private val write: (List<DownloadRequest>) -> Unit,
) {
    private val pending = AtomicReference<List<DownloadRequest>?>(null)
    private val changes = Channel<Unit>(Channel.CONFLATED)
    private val writer = Mutex()

    init {
        scope.launch {
            for (change in changes) {
                delay(250)
                try {
                    flush()
                } catch (e: Exception) {
                    Timber.w(e, "Failed to persist download queue")
                    delay(1_000)
                    changes.trySend(Unit)
                }
            }
        }
    }

    fun submit(requests: List<DownloadRequest>) {
        pending.set(requests)
        check(changes.trySend(Unit).isSuccess)
    }

    suspend fun flush() {
        writer.withLock {
            val snapshot = pending.getAndSet(null) ?: return
            try {
                write(snapshot)
            } catch (e: Exception) {
                pending.compareAndSet(null, snapshot)
                throw e
            }
        }
    }
}

```

### Core Architecture Module: `androidApp/src/main/kotlin/com/metrolist/android/playback/PendingQueueRestorePosition.kt`
```
package com.metrolist.android.playback

/** The saved position belongs to one queue occurrence, not every copy of the same song. */
internal class PendingQueueRestorePosition {
    private var entryKey: Long? = null
    private var positionMs: Long? = null

    fun restore(
        selectedEntryKey: Long?,
        savedPositionMs: Long,
    ) {
        entryKey = selectedEntryKey
        positionMs = savedPositionMs.takeIf { it > 0L }
    }

    fun update(
        selectedEntryKey: Long?,
        requestedPositionMs: Long,
    ) {
        if (entryKey != null && selectedEntryKey == entryKey) positionMs = requestedPositionMs.coerceAtLeast(0L)
    }

    fun take(
        selectedEntryKey: Long?,
        requestedPositionMs: Long,
    ): Long {
        val saved = positionMs?.takeIf { entryKey != null && selectedEntryKey == entryKey }
        clear()
        return (saved ?: requestedPositionMs).coerceAtLeast(0L)
    }

    fun clear() {
        entryKey = null
        positionMs = null
    }
}

```

### Core Architecture Module: `androidApp/src/main/kotlin/com/metrolist/android/playback/QueueEnqueue.kt`
```
package com.metrolist.android.playback

import com.metrolist.shared.model.SongItem
import com.metrolist.shared.playback.MusicQueue
import com.metrolist.shared.playback.QUEUE_SOURCE_ADDED_MANUALLY
import com.metrolist.shared.playback.isRecommendationGeneratedQueueSource

internal fun enqueueSongs(
    queue: MusicQueue,
    songs: List<SongItem>,
    playNext: Boolean,
    preventDuplicates: Boolean,
) {
    val additions = if (preventDuplicates && !playNext) songs.asReversed().distinctBy { it.id }.asReversed() else songs
    val prepared =
        additions.map { song ->
            if (playNext && song.queueSourceTitle.isRecommendationGeneratedQueueSource()) {
                song.copy(queueSourceTitle = QUEUE_SOURCE_ADDED_MANUALLY)
            } else if (!playNext && !song.queueSourceTitle.isRecommendationGeneratedQueueSource()) {
                song.copy(queueSourceTitle = song.queueSourceTitle ?: QUEUE_SOURCE_ADDED_MANUALLY)
            } else {
                song
            }
        }
    if (playNext) {
        queue.playNext(prepared, preventDuplicates)
    } else {
        val (recommended, manual) = prepared.partition { it.queueSourceTitle.isRecommendationGeneratedQueueSource() }
        if (preventDuplicates) queue.removeSongs(prepared.mapTo(mutableSetOf()) { it.id }, keepCurrent = true)
        val insertIndex =
            queue.items.value.indices.firstOrNull {
                it > queue.currentIndex.value &&
                    queue.items.value[it]
                        .queueSourceTitle
                        .isRecommendationGeneratedQueueSource()
            }
        queue.addToQueue(manual, preventDuplicates, insertIndex)
        queue.addToQueue(recommended, preventDuplicates)
    }
}

```

### Core Architecture Module: `androidApp/src/main/kotlin/com/metrolist/android/playback/QueuePlaybackResolveDeadline.kt`
```
package com.metrolist.android.playback

import com.metrolist.shared.playback.PlaybackRecoveryBudget
import kotlinx.coroutines.withTimeoutOrNull

internal suspend fun <T : Any> withQueuePlaybackResolveDeadline(
    deadlineAtMs: Long,
    nowMs: () -> Long,
    block: suspend () -> T,
): T? {
    val remainingMs = deadlineAtMs - nowMs()
    if (remainingMs <= 0L) return null
    return withTimeoutOrNull(remainingMs) { block() }
}

internal fun queuePlaybackResolveBudget(
    nowMs: Long,
    clientOverrideId: String?,
): PlaybackRecoveryBudget {
    val budget = PlaybackRecoveryBudget.starting(nowMs)
    // Samsung can spend 30 seconds waiting for pre-roll before preparation starts.
    return if (clientOverrideId == "TVHTML5_SAMSUNG") budget.copy(deadlineAtMs = nowMs + 55_000L) else budget
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5391** (2026-11-26): **[Linux / AUR] Hardcoded /home/hussien/ icon path in Metrolist.desktop**
  *Symptoms*: ### Checklist  - [x] I can reproduce this on the [latest release](https://github.com/MetrolistGroup/Metrolist/releases). - [x] I searched open and closed issues and found no duplicate. - [x] This issue contains only one bug. - [x] The title describes the bug. - [x] This issue is written in English.  ### Device  Linux  ### Version  Linux (CachyOS / Arch) / metrolist-desktop-bin (version 14.0.0-2 or 14.0.1)  ### Issue  When installing metrolist-desktop-bin from the AUR on Arch/CachyOS, the application icon is broken in app launchers and taskbars because /usr/share/applications/Metrolist.desktop contains a hardcoded user directory path:  [Desktop Entry] Type=Application Name=Metrolist Exec=env "/opt/metrolist-desktop-bin/metrolist.AppImage" %u Icon=/home/hussien/.local/share/icons/hicolor/512x512/apps/Metrolist.png StartupWMClass=Metrolist Comment=Metrolist music client Categories=AudioVideo;Player; Terminal=false MimeType=x-scheme-handler/metrolist;x-scheme-handler/metrolist-auth; X-Metrolist-AppImage=true  Cause: It looks like a .desktop file generated by Metrolist's AppImage integration (X-Metrolist-AppImage=true) on the packager's local environment (/home/hussien/...) was bundled directly into the AUR package, while PKGBUILD installs the actual system icon to /usr/share/icons/hicolor/512x512/apps/metrolist.png (lowercase).  Suggested Fix: Set Icon=metrolist in the packaged Metrolist.desktop (or run sed -i 's|^Icon=.*|Icon=metrolist|' "$pkgdir/usr/share/applications/Metrolist

- **Issue #5378** (2026-11-26): **No Sound**
  *Symptoms*: ### Checklist  - [x] I can reproduce this on the [latest release](https://github.com/MetrolistGroup/Metrolist/releases). - [x] I searched open and closed issues and found no duplicate. - [x] This issue contains only one bug. - [x] The title describes the bug. - [x] This issue is written in English.  ### Device  iOS  ### Version  ios 16.7.16 / v14.0.1  ### Issue  No Sound Coming Out of the app at full volumeOn iPhone 8, on ios 16.7.16 with metrolist version 14.0.1  ### Logs  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > <!-- coderabbit-ai-generated:v1 -->  <!-- This is an auto-generated issue plan by CodeRabbit -->  <details> <summary>⚠️ Possible Duplicate Issue(s)</summary> <dl> <dd> <br>  - https://github.com/MetrolistGroup/Metrolist/issues/5243 </dd> </dl> </details>  --- <details> <summary>📝 Issue Planner</summary> <dl> <dd> <br>  <sub>Check the box below or use the `@coderabbitai plan` command to generate an implementation plan and prompts that you can use with your favorite coding assistant.</sub>  - [ ] <!-- {"checkboxId":"8d4f2b9c-3e1a-4f7c-a9b2-d5e8f1c4a7b9"} --> Create Plan </dd> </dl> </details>   --- <details> <summary> 🧪 Issue enrichment is currently in open beta.</summary> <dl> <dd> <br>   You can configure auto-planning by selecting labels in the issue_enrichment configuration.  To disable automatic issue enrichment, add the following to your `.coderabbit.yaml`: ```yaml issue_enrichment:   auto_enrich:     enabled: false ``` </dd> </dl> </details>  💬 Have feedback or questions? Drop 
  > Duplicate of #5243.

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

### Incident Patch 1: `4018eb76` (2026-11-25)
**Commit Message**: fix(db): load single Room relations as lists to avoid iOS crash (#5346)

Opening Library on iOS crashed with ConcurrentModificationException once the database held more than 999 songs. The 14.0.1 dSYM resolves the stack to Room's recursiveFetchMap, reached from songsByCreateDateAsc while loading the album relation. For single-value relations, Room calls putAll on the result map while it is still iterating that map's keys after each 999-key batch. JVM HashMap tolerates this; the Kotlin/Native HashMap throws.

Song.album, Song.format, EventWithSong.song, EventWithSong.snapshot and PlaylistSong.song are now list relations, which Room fills without that putAll. Getters with the old names return the last element, the row the single-value relation used to keep, so callers are unchanged. The same crash would also have hit history and playlists with more than 999 rows.

fixes: #5253

AI usage: Claude Opus 5.5 (claude-opus-5-5)

**File**: `shared/src/commonMain/kotlin/com/metrolist/shared/db/HistorySong.kt` (modified, +17/-15)
```diff
@@ -53,21 +53,23 @@ internal fun EventWithSong.withHistoricalMetadata(): EventWithSong {
                 ?: ArtistEntity(id = "history-artist:$name", name = name, isLocal = true)
         }
     return copy(
-        song =
-            song.copy(
-                song =
-                    song.song.copy(
-                        title = snapshot.title,
-                        customTitle = null,
-                        customArtist = null,
-                        albumId = snapshot.albumId,
-                        albumName = snapshot.album,
-                        duration = snapshot.duration?.toInt() ?: -1,
-                        thumbnailUrl = snapshot.thumbnailUrl,
-                    ),
-                artists = artists,
-                artistMaps = artists.mapIndexed { index, artist -> SongArtistMap(event.songId, artist.id, index) },
-                album = song.album?.takeIf { it.id == snapshot.albumId },
+        songs =
+            listOf(
+                song.copy(
+                    song =
+                        song.song.copy(
+                            title = snapshot.title,
+                            customTitle = null,
+                            customArtist = null,
+                            albumId = snapshot.albumId,
+                            albumName = snapshot.album,
+                            duration = snapshot.duration?.toInt() ?: -1,
+                            thumbnailUrl = snapshot.thumbnailUrl,
+                        ),
+                    artists = artists,
+                    artistMaps = artists.mapIndexed { index, artist -> SongArtistMap(event.songId, artist.id, index) },
+                    albums = listOfNotNull(song.album?.takeIf { it.id == snapshot.albumId }),
+                ),
             ),
     )
 }
```

**File**: `shared/src/commonMain/kotlin/com/metrolist/shared/db/entities/EventWithSong.kt` (modified, +9/-3)
```diff
@@ -16,7 +16,13 @@ data class EventWithSong(
         parentColumns = ["songId"],
         entityColumns = ["id"],
     )
-    val song: Song,
+    val songs: List<Song>,
     @Relation(parentColumns = ["id"], entityColumns = ["eventId"])
-    val snapshot: HistorySnapshot? = null,
-)
+    val snapshots: List<HistorySnapshot> = emptyList(),
+) {
+    // Lists avoid Room's iOS ConcurrentModificationException for single-value relations above 999 rows.
+    val song: Song
+        get() = songs.last()
+    val snapshot: HistorySnapshot?
+        get() = snapshots.lastOrNull()
+}
```

**File**: `shared/src/commonMain/kotlin/com/metrolist/shared/db/entities/PlaylistSong.kt` (modified, +6/-2)
```diff
@@ -16,8 +16,12 @@ data class PlaylistSong(
         entityColumns = ["id"],
         entity = SongEntity::class,
     )
-    val song: Song,
-)
+    val songs: List<Song>,
+) {
+    // A list avoids Room's iOS ConcurrentModificationException for single-value relations above 999 rows.
+    val song: Song
+        get() = songs.last()
+}
 
 fun PlaylistSong.toSongItem(): SongItem =
     song.toSongItem().copy(
```

**File**: `shared/src/commonMain/kotlin/com/metrolist/shared/db/entities/Song.kt` (modified, +8/-2)
```diff
@@ -39,13 +39,19 @@ data class Song(
                 entityColumns = ["albumId"],
             ),
     )
-    val album: AlbumEntity? = null,
+    val albums: List<AlbumEntity> = emptyList(),
     @Relation(
         parentColumns = ["id"],
         entityColumns = ["id"],
     )
-    val format: FormatEntity? = null,
+    val formats: List<FormatEntity> = emptyList(),
 ) : LocalItem() {
+    // Single-value relations crash on iOS above 999 rows: Room's recursiveFetchMap calls putAll while iterating the map.
+    // last matches the row Room's single-value relation kept, since it overwrote the map entry per row.
+    val album: AlbumEntity?
+        get() = albums.lastOrNull()
+    val format: FormatEntity?
+        get() = formats.lastOrNull()
     override val id: String
         get() = song.id
     override val title: String
```

---

### Incident Patch 2: `788fb64b` (2026-11-25)
**Commit Message**: fix(listen-together): keep guests in sync and suggestions reliable (#5380)

Users reported that Listen Together drifts out of sync, breaks on track changes and reconnects, and loses suggestions. Host playback actions now carry the server time when the position was read, and guests anchor pong drift reports to the ping's own position and capture time, ignore reports from before a newer host action, and let a newer correction replace a running one. Hosts reconcile reconnects under the publication mutex, so a track changed while offline is published. Guests acknowledge buffer readiness with the newest `change_track` revision, including same-track restarts during loading, which removes a 25-second stall.

Hosts publish at most 1,000 upcoming tracks within the server's 200 KiB estimate, because larger queues failed to encode and track changes never reached guests. Guests can suggest a track again after a lost decision, the newest suggestion ID replaces the stale one, and the server deduplicates pending suggestions. On desktop, a track loaded before joining counts as ready and readiness resets when playback switches tracks. docs/listen-together.md is updated, and the server side is Metro

**File**: `desktopApp/src/jvmMain/kotlin/com/metrolist/desktop/listentogether/DesktopListenTogetherPlayback.kt` (modified, +19/-3)
```diff
@@ -14,6 +14,7 @@ import com.metrolist.shared.model.SongItem
 import kotlinx.coroutines.flow.MutableStateFlow
 import kotlinx.coroutines.flow.StateFlow
 import kotlinx.coroutines.flow.collectLatest
+import kotlinx.coroutines.flow.combine
 import kotlinx.coroutines.launch
 
 class DesktopListenTogetherPlayback : ListenTogetherPlayback {
@@ -28,9 +29,24 @@ class DesktopListenTogetherPlayback : ListenTogetherPlayback {
 
     init {
         AppState.scope.launch {
-            currentSong.collectLatest { song ->
-                if (song == null) readiness.value = PlaybackReadiness.IDLE
-            }
+            combine(currentSong, PlayerState.player.currentPlaybackResource) { song, resource -> song to resource }
+                .collectLatest { (song, resource) ->
+                    when {
+                        song == null -> {
+                            readiness.value = PlaybackReadiness.IDLE
+                        }
+
+                        // A track prepared before joining never passes through playQueueFromRemote.
+                        resource?.videoId == song.id && readiness.value == PlaybackReadiness.IDLE -> {
+                            readiness.value = PlaybackReadiness.READY
+                        }
+
+                        // A direct switch to another track leaves the old resource's READY behind.
+                        resource?.videoId != song.id && readiness.value == PlaybackReadiness.READY -> {
+                            readiness.value = PlaybackReadiness.IDLE
+                        }
+                    }
+                }
         }
         AppState.scope.launch {
             PlayerState.player.loadFailure.collectLatest { failure ->
```

**File**: `docs/listen-together.md` (modified, +2/-2)
```diff
@@ -31,13 +31,13 @@ Encode on `Dispatchers.Default` in send order, capturing negotiated compression.
 
 Retain the committed queue and station metadata until room audio preparation succeeds. Prepare remote queues paused. Guests resume after synchronization; host imports explicitly start playback. Failed or canceled loads preserve committed state. Recovery stays paused even if the host sends play. Empty sync snapshots cancel pending loads and pause without discarding the loaded track. A confirmed idle room with an empty queue clears upcoming entries and, when no track is loaded, the saved Android queue.
 
-Read the player's queue snapshot and current occurrence for publication. Serialize server updates with host publication and preserve unpublished host edits. Preserve duplicate occurrences, canonical upcoming order and empty replacements. Consume legacy host queue acknowledgements once.
+Read the player's queue snapshot and current occurrence for publication. Hosts publish at most 1,000 upcoming tracks within metroserver's 200 KiB queue estimate, so every snapshot fits the 256 KiB envelope; later tracks stay in the host's local queue. Serialize server updates with host publication and preserve unpublished host edits. Preserve duplicate occurrences, canonical upcoming order and empty replacements. Consume legacy host queue acknowledgements once.
 
 Publish host track changes when the player's current song changes. Keep periodic timeline updates. Guests reuse matching tracks from the player queue with the host's metadata before requesting metadata for an unfamiliar track, and still wait for buffer synchronization before playing.
 
 Removing the final host track pauses guests and clears the upcoming queue. The server retains last-track metadata because `change_track` requires a track; clearing it needs an upstream action.
 
-Pending joins can be canceled and resubmitted after reconnect. Keep approval rows until acknowledgement, and failed decisions until retry. With `suggestion_ack`, retry unacknowledged guest sends after authentication; coalesce repeated taps. `duplicate_suggestion` confirms an existing pending send. Leaving clears unsent suggestions.
+Pending joins can be canceled and resubmitted after reconnect. Keep approval rows until acknowledgement, and failed decisions until retry. With `suggestion_ack`, retry unacknowledged guest sends after authentication; coalesce repeated taps. Guests can resend a submitted suggestion, and the server answers with the pending suggestion's ID, so a lost decision never blocks the track. `duplicate_suggestion` confirms an existing pending send on older servers. Leaving clears unsent suggestions.
 
 Notify hosts of automatic approvals only after confirmation. Rejection, manual decisions, leaving or host-role loss discard pending automatic feedback. Guest volume and mute are local; Sync host volume controls whether host volume overrides them.
 
```

**File**: `shared/src/commonMain/kotlin/com/metrolist/shared/listentogether/ListenTogetherManager.kt` (modified, +147/-62)
```diff
@@ -181,6 +181,14 @@ class ListenTogetherManager(
         }
     }
 
+    /** A sent ping and, when it reported a position, the guest timeline it described. */
+    private data class OutstandingPing(
+        val clientTime: Long,
+        val position: Long? = null,
+        val positionCapturedAt: Long = 0L,
+        val playbackGeneration: Long = 0L,
+    )
+
     private data class PendingBarrier(
         val trackId: String,
         val position: Long,
@@ -300,7 +308,7 @@ class ListenTogetherManager(
     private var sessionReconnectRejected = false
     private var pingSequence = 0L
     private var lastPongSequence = 0L
-    private val outstandingPings = LinkedHashMap<Long, Long>()
+    private val outstandingPings = LinkedHashMap<Long, OutstandingPing>()
     private val pendingHostQueues = ArrayDeque<List<TrackInfo>>()
     private var connectionGeneration = 0L
     private var authenticatedConnectionGeneration = -1L
@@ -316,13 +324,19 @@ class ListenTogetherManager(
     private var upcomingCurrentId: String? = null
     private var upcomingCurrentIndex: Int? = null
     private var upcomingTrackInfo = emptyList<TrackInfo>()
+    private var publishedQueueInput: List<TrackInfo>? = null
+    private var publishedQueue = emptyList<TrackInfo>()
     private var lastVolume: Float? = null
     private var lastTrackId: String? = null
     private var lastTrackInstanceId: Long? = null
     private var lastPlaying: Boolean? = null
     private var lastPositionBucket: Long? = null
     private var driftGeneration = 0L
 
+    // The newest change_track revision; readiness acknowledges it even when the host restarts the
+    // same track while it is still loading.
+    private var latestTrackRevision = 0L
+
     @Volatile
     private var serverFeatures: Set<String> = emptySet()
     private var requestSequence = 0L
@@ -647,10 +661,9 @@ class ListenTogetherManager(
 
     fun suggestTrack(track: TrackInfo) {
         if (_role.value != ListenTogetherRoomRole.GUEST || !_isInRoom.value) return
-        synchronized(participationLock) {
-            if (_submittedSuggestions.value.values.any { it.id == track.id }) return
-            outgoingSuggestions.getOrPut(track.id) { PendingSuggestion(track) }
-        }
+        // The server deduplicates pending suggestions and returns the existing ID, so a decision lost
+        // in transit never blocks suggesting the track again.
+        synchronized(participationLock) { outgoingSuggestions.getOrPut(track.id) { PendingSuggestion(track) } }
         sendPendingSuggestions()
     }
 
@@ -977,9 +990,11 @@ class ListenTogetherManager(
             val instanceId = playback.playbackInstanceId()
             val playing = playback.playing.value
             val position = playback.currentPositionMs()
+            // Sends below can wait on delivery, so the server must age the position from when it was read.
+            val capturedAt = serverClock.serverTimeNow()
             val observedSequence = nextHostSequence()
             val positionBucket = position / 3_000L
-            val upcoming = currentUpcomingTrackInfo()
+            val upcoming = publishedUpcomingTrackInfo()
             val previousTrackId = lastTrackId ?: _roomState.value?.currentTrack?.id
             _roomState.value =
                 _roomState.value?.copy(
@@ -993,7 +1008,13 @@ class ListenTogetherManager(
                 )
             if (trackId == null && previousTrackId != null) {
                 if (sendPlaybackAction(
-                        PlaybackActionPayload(PlaybackActions.PAUSE, previousTrackId, position, hostSequence = observedSequence),
+                        PlaybackActionPayload(
+                            PlaybackActions.PAUSE,
+                            previousTrackId,
+                            position,
+                            hostSequence = observedSequence,
+                            capturedAtServerTime = capturedAt,
+                        ),
                     )
                 ) {
                     lastTrackId = null
@@ -1017,6 +1038,7 @@ class ListenTogetherManager(
                             queue = upcoming,
                             queueTitle = playback.currentQueueTitle(),
                             replaceQueue = true,
+                            capturedAtServerTime = capturedAt,
                         ),
                     )
                 ) {
@@ -1042,18 +1064,38 @@ class ListenTogetherManager(
                             trackId,
                             position,
                             hostSequence = observedSequence,
+                            capturedAtServerTime = capturedAt,
                         ),
                     )
                 ) {
                     lastPlaying = playing
                 }
             } else if (trackId != null && playing && lastPositionBucket != positionBucket) {
-                if (sendPlaybackAction(PlaybackActionPayload(PlaybackActions.PLAY, trackId, p
```

**File**: `shared/src/commonMain/kotlin/com/metrolist/shared/listentogether/ListenTogetherPolicies.kt` (modified, +23/-0)
```diff
@@ -197,6 +197,29 @@ internal fun reconcileHostQueue(
     return retained.map { (key, track) -> if (key in publishedSet) canonicalByKey[key] ?: track else track }
 }
 
+private const val MAX_PUBLISHED_QUEUE_TRACKS = 1_000
+private const val MAX_PUBLISHED_QUEUE_BYTES = 200 * 1024
+
+/**
+ * Keeps the published upcoming queue within metroserver's queue limits so every snapshot fits the
+ * clients' 256 KiB envelope. The byte estimate matches the server's queueWireSize. Tracks past the
+ * limit stay in the host's local queue because reconcileHostQueue keeps unpublished entries.
+ */
+internal fun publishableQueue(queue: List<TrackInfo>): List<TrackInfo> {
+    var bytes = 0
+    val count =
+        queue
+            .asSequence()
+            .take(MAX_PUBLISHED_QUEUE_TRACKS)
+            .takeWhile { track ->
+                bytes += 32 +
+                    listOf(track.id, track.title, track.artist, track.album, track.thumbnail, track.suggestedBy)
+                        .sumOf { it?.encodeToByteArray()?.size ?: 0 }
+                bytes <= MAX_PUBLISHED_QUEUE_BYTES
+            }.count()
+    return if (count == queue.size) queue else queue.take(count)
+}
+
 sealed interface DriftCorrection {
     data object None : DriftCorrection
 
```

**File**: `shared/src/desktopTest/kotlin/com/metrolist/shared/listentogether/ListenTogetherManagerLifecycleTest.kt` (modified, +19/-7)
```diff
@@ -391,7 +391,9 @@ class ListenTogetherManagerLifecycleTest {
                 assertEquals(listOf(first, second), host.pendingSuggestions.value.map { it.trackInfo })
                 assertEquals(listOf(first, second), server.suggestedTracks.value)
 
+                server.pendingSuggestionIds.value -= "first"
                 guest.handleBinary(MessageCodec().encode(MessageTypes.SUGGESTION_APPROVED, SuggestionApprovedPayload("first", first)))
+                assertEquals(setOf("second"), guest.submittedSuggestions.value.keys)
                 guest.suggestTrack(first)
                 withTimeout(5_000L.milliseconds) { server.suggestedTracks.first { it.size == 3 } }
                 assertEquals(listOf(first, second, first), server.suggestedTracks.value)
@@ -1813,6 +1815,9 @@ class ListenTogetherManagerLifecycleTest {
         private val dropFirstSuggestionAck: Boolean = false,
     ) {
         val suggestedTracks = MutableStateFlow<List<TrackInfo>>(emptyList())
+
+        /** Track IDs awaiting a host decision; the real server deduplicates only these. */
+        val pendingSuggestionIds = MutableStateFlow<Set<String>>(emptySet())
         val kickedUsers = MutableStateFlow<List<String>>(emptyList())
         val suggestionAttempts = AtomicInteger(0)
         private val activeSession = AtomicBoolean(false)
@@ -1920,20 +1925,27 @@ class ListenTogetherManagerLifecycleTest {
                         MessageTypes.SUGGEST_TRACK -> {
                             val track = (codec.decodePayload(type, envelope.payload) as SuggestTrackPayload).trackInfo
                             suggestionAttempts.incrementAndGet()
-                            if (dropFirstSuggestionAck && suggestedTracks.value.any { it.id == track.id }) {
-                                session.send(
-                                    Frame.Binary(
-                                        true,
+                            if (track.id in pendingSuggestionIds.value) {
+                                // Servers with suggestion_ack return the pending suggestion's ID; older ones report a duplicate.
+                                val reply =
+                                    if (dropFirstSuggestionAck) {
                                         codec.encode(
                                             MessageTypes.ERROR,
                                             ErrorPayload("duplicate_suggestion", "Already pending"),
                                             envelope.requestId,
-                                        ),
-                                    ),
-                                )
+                                        )
+                                    } else {
+                                        codec.encode(
+                                            MessageTypes.SUGGESTION_SUBMITTED,
+                                            SuggestionSubmittedPayload(track.id, track),
+                                            envelope.requestId,
+                                        )
+                                    }
+                                session.send(Frame.Binary(true, reply))
                                 continue
                             }
                             suggestedTracks.value += track
+                            pendingSuggestionIds.value += track.id
                             receiveSuggestion?.invoke(SuggestionReceivedPayload(track.id, "room-user", "Guest", track))
                             if (dropFirstSuggestionAck && suggestedTracks.value.size == 1) {
                                 session.close()
```

---

### Incident Patch 3: `299737f2` (2026-11-25)
**Commit Message**: fix(build): require Java 25.0.5.1 for CVE-2026-114938 (#5371)

CVE-2026-114938 is a Java 25 HotSpot C2 Base64 intrinsic bounds bug fixed in Java 25.0.5.1; this pins build, CI and packaging JDKs to fixed versions.

- `build.gradle.kts` fails the build when Gradle runs on Java 25 older than 25.0.5.1. Desktop packaging checks the packaging JDK's release file the same way, including `metrolist.desktop.javaHome` overrides.
- `gradle-daemon-jvm.properties` downloads Temurin 25.0.5.1+2 for every platform.
- `setup-java` steps in the prepare-ci-gradle action, `reusable-desktop-macos.yml` and `verify-aur-package.yml` use `check-latest` so runners do not reuse an older cached JDK. Windows ARM64 installs Microsoft's 25.0.5.1 zip with its SHA-256, because setup-java's Microsoft manifest stops at 25.0.5.
- The GraalVM native-image builder is pinned to 25.0.5.1 with Oracle's SHA-256 hashes; `native_image.py` rejects an older builder, and `package.py` rejects an older macOS packaging JDK.
- The Flatpak manifest pins Temurin 25.0.5.1+2 for x64 and ARM64 with checksums.
- AUR PKGBUILD and .SRCINFO require `jdk25-temurin>=25.0.5.1` and `jdk21-openjdk>=21.0.13.1`.
- `scripts/deps.sh` treats Java olde

**File**: `.github/actions/prepare-ci-gradle/action.yml` (modified, +13/-2)
```diff
@@ -7,7 +7,7 @@ inputs:
     required: false
     default: ''
   java-distribution:
-    description: JDK distribution; Temurin has no Windows ARM64 JDK 25
+    description: JDK distribution; Temurin has no Windows ARM64 JDK 25, so microsoft installs the pinned Windows ARM64 build
     required: false
     default: temurin
   cache-strict-match:
@@ -45,11 +45,22 @@ runs:
         CACHE_SCOPE: ${{ inputs.cache-scope }}
       run: test -n "$CACHE_SCOPE" || { echo "cache-scope is required" >&2; exit 1; }
 
+    # setup-java's Microsoft manifest stops before 25.0.5.1, the CVE-2026-114938 fix.
+    - name: Download Microsoft JDK 25
+      if: inputs.java-distribution == 'microsoft'
+      shell: bash
+      working-directory: ${{ runner.temp }}
+      run: |
+        curl -fsSL -o microsoft-jdk.zip https://aka.ms/download-jdk/microsoft-jdk-25.0.5.1-windows-aarch64.zip
+        echo 'a0fc659c6770e2c1a59329ae7dc5d080d4cc83230a62d78f7ffc77502ac3bba8  microsoft-jdk.zip' | sha256sum -c -
+
     - name: Set up JDK 25
       uses: actions/setup-java@b843ebf9b913146b38da2eaa7aeddf76074ae1ad # v6
       with:
-        distribution: ${{ inputs.java-distribution }}
+        distribution: ${{ inputs.java-distribution == 'microsoft' && 'jdkfile' || inputs.java-distribution }}
+        jdkFile: ${{ inputs.java-distribution == 'microsoft' && format('{0}/microsoft-jdk.zip', runner.temp) || '' }}
         java-version: '25'
+        check-latest: true
         architecture: ${{ inputs.java-architecture }}
 
     - name: Set up Gradle
```

**File**: `.github/workflows/reusable-desktop-macos.yml` (modified, +1/-0)
```diff
@@ -90,6 +90,7 @@ jobs:
         with:
           distribution: temurin
           java-version: '25'
+          check-latest: true
           architecture: x64
 
       - name: Prepare CI Gradle
```

**File**: `.github/workflows/verify-aur-package.yml` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ jobs:
         with:
           distribution: temurin
           java-version: '25'
+          check-latest: true
 
       - name: Prepare unprivileged package builder
         run: |
```

**File**: `aur/.SRCINFO` (modified, +2/-2)
```diff
@@ -6,8 +6,8 @@ pkgbase = metrolist-git
 	arch = x86_64
 	license = GPL-3.0-only
 	makedepends = git
-	makedepends = jdk21-openjdk
-	makedepends = jdk25-temurin
+	makedepends = jdk21-openjdk>=21.0.13.1
+	makedepends = jdk25-temurin>=25.0.5.1
 	depends = alsa-lib
 	depends = dbus
 	depends = fontconfig
```

**File**: `aur/PKGBUILD` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ arch=('x86_64')
 url='https://github.com/MetrolistGroup/Metrolist'
 license=('GPL-3.0-only')
 depends=('alsa-lib' 'dbus' 'fontconfig' 'gtk3' 'hicolor-icon-theme' 'libglvnd' 'libsecret' 'libxi' 'libxrender' 'libxtst' 'webkit2gtk-4.1')
-makedepends=('git' 'jdk21-openjdk' 'jdk25-temurin')
+makedepends=('git' 'jdk21-openjdk>=21.0.13.1' 'jdk25-temurin>=25.0.5.1')
 provides=('metrolist')
 conflicts=('metrolist')
 options=('!strip' '!debug')
```

**File**: `build.gradle.kts` (modified, +5/-0)
```diff
@@ -18,6 +18,11 @@ plugins {
     alias(libs.plugins.sentry.jvm) apply false
 }
 
+val minimumJavaVersion = Runtime.Version.parse("25.0.5.1")
+require(Runtime.version().feature() == 25 && Runtime.version() >= minimumJavaVersion) {
+    "Java $minimumJavaVersion or a newer Java 25 update is required to fix CVE-2026-114938. Update the Gradle JVM."
+}
+
 tasks.register<Delete>("clean") {
     delete(rootProject.layout.buildDirectory)
 }
```

**File**: `desktopApp/build.gradle.kts` (modified, +17/-9)
```diff
@@ -726,17 +726,25 @@ compose.desktop {
 
         mainClass = "com.metrolist.desktop.MainKt"
         javaHome =
-            providers.gradleProperty("metrolist.desktop.javaHome").orNull?.let { home ->
+            (
+                providers.gradleProperty("metrolist.desktop.javaHome").orNull?.let { home ->
+                    val release = Properties().apply { file("$home/release").inputStream().use(::load) }
+                    val architecture = release.getProperty("OS_ARCH").trim('"')
+                    val expectedArchitectures = if (isArm64) setOf("aarch64", "arm64") else setOf("x86_64", "amd64")
+                    require(architecture in expectedArchitectures) {
+                        "Packaging JDK architecture $architecture does not match $targetArchitecture"
+                    }
+                    home
+                } ?: desktopJavaLauncher
+                    .get()
+                    .metadata.installationPath.asFile.absolutePath
+            ).also { home ->
                 val release = Properties().apply { file("$home/release").inputStream().use(::load) }
-                val architecture = release.getProperty("OS_ARCH").trim('"')
-                val expectedArchitectures = if (isArm64) setOf("aarch64", "arm64") else setOf("x86_64", "amd64")
-                require(architecture in expectedArchitectures) {
-                    "Packaging JDK architecture $architecture does not match $targetArchitecture"
+                val javaVersion = Runtime.Version.parse(release.getProperty("JAVA_VERSION").trim('"'))
+                require(javaVersion.feature() == 25 && javaVersion >= Runtime.Version.parse("25.0.5.1")) {
+                    "Packaging requires Java 25.0.5.1 or a newer Java 25 update to fix CVE-2026-114938; found $javaVersion."
                 }
-                home
-            } ?: desktopJavaLauncher
-                .get()
-                .metadata.installationPath.asFile.absolutePath
+            }
         jvmArgs +=
             listOf(
                 "--enable-native-access=ALL-UNNAMED",
```

**File**: `docs/checks.md` (modified, +0/-1)
```diff
@@ -264,7 +264,6 @@ python3 -m unittest discover -s scripts -p 'test_collect_android_apks.py'
 python3 scripts/test_generate_android_strings.py
 
 # Not run in CI
-python3 scripts/test_deps.py
 python3 scripts/test_find_unused_strings.py
 ```
 
```

#### Recent Merged Pull Requests:
- **PR #5393** (2026-11-26): fix(artwork): restore retained covers in offline app (@nyxiereal)
- **PR #5382** (2026-11-26): fix(android): check raw TAKE_AUDIO_FOCUS app op mode (@sahuadarsh0)
- **PR #5380** (2026-11-25): fix(listen-together): fix reconnect reconciliation, drift handling and queue publishing (@nyxiereal)
- **PR #5371** (2026-11-25): fix(build): require Java 25.0.5.1 for CVE-2026-114938 (@nyxiereal)
- **PR #5367** (2026-11-25): fix(desktop): stop WebView2 error dialog for hidden WebViews (@nyxiereal)
- **PR #5362** (2026-11-25): fix(home): detect signed-out YouTube Music responses (@nyxiereal)

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

## X. db): load single Room relations as lists to avoid iOS crash

**RULE**:
When implementing operations in `shared/src/commonMain/kotlin/com/metrolist/shared/db/HistorySong.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in MetrolistGroup/Metrolist. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4018eb76`: db): load single Room relations as lists to avoid iOS crash. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `shared/src/commonMain/kotlin/com/metrolist/shared/db/HistorySong.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
        songs =
            listOf(
                song.copy(
                    song =
                        song.song.copy(
                            title = snapshot.title,
                            customTitle = null,
                            customArtist = null,
                            albumId = snapshot.albumId,
                            albumName = snapshot.album,
                            duration = snapshot.duration?.toInt() ?: -1,
                            thumbnailUrl = snapshot.thumbnailUrl,
                        ),
                    artists = artists,
                    artistMaps = artists.mapIndexed { index, artist -> SongArtistMap(event.songId, artist.id, index) },
                    albums = listOfNotNull(song.album?.takeIf { it.id == snapshot.albumId }),
                ),
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
        song =
            song.copy(
                song =
                    song.song.copy(
                        title = snapshot.title,
                        customTitle = null,
                        customArtist = null,
                        albumId = snapshot.albumId,
                        albumName = snapshot.album,
                        duration = snapshot.duration?.toInt() ?: -1,
                        thumbnailUrl = snapshot.thumbnailUrl,
                    ),
                artists = artists,
                artistMaps = artists.mapIndexed { index, artist -> SongArtistMap(event.songId, artist.id, index) },
                album = song.album?.takeIf { it.id == snapshot.albumId },
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4018eb76` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
