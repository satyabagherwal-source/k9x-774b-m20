# Forensic Learning Record (Deep Inspection): open-ani/animeko

> **Canonical Artifact**: `07_PROJECT_LEARNING/open-ani-animeko-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/open-ani/animeko](https://github.com/open-ani/animeko))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:24:59.302Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `open-ani/animeko`
- **Description**: 集找番、追番、看番的一站式弹幕追番平台，云收藏同步 (Bangumi)，离线缓存，BitTorrent，弹幕云过滤。100% Kotlin/Compose Multiplatform
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 20518 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app/shared/app-data/src/androidMain/kotlin/domain/torrent/RemoteTorrentEngineFactory.kt`
```
/*
 * Copyright (C) 2024-2025 OpenAni and contributors.
 *
 * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
 * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
 *
 * https://github.com/open-ani/ani/blob/main/LICENSE
 */

package me.him188.ani.app.domain.torrent

import android.os.Build
import androidx.annotation.RequiresApi
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.DelicateCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.newSingleThreadContext
import me.him188.ani.app.data.models.preference.AnitorrentConfig
import me.him188.ani.app.data.models.preference.ProxyConfig
import me.him188.ani.app.domain.media.cache.engine.TorrentEngineAccess
import me.him188.ani.app.domain.torrent.client.RemoteAnitorrentEngine
import me.him188.ani.app.domain.torrent.peer.PeerFilterSettings
import me.him188.ani.app.domain.torrent.service.TorrentServiceConnection
import me.him188.ani.utils.io.SystemPath
import me.him188.ani.utils.ktor.ScopedHttpClient
import kotlin.coroutines.CoroutineContext

@RequiresApi(Build.VERSION_CODES.O_MR1)
class RemoteAnitorrentEngineFactory(
    private val serviceConnection: TorrentServiceConnection<IRemoteAniTorrentEngine>,
    private val torrentEngineAccess: TorrentEngineAccess,
    private val proxyConfig: Flow<ProxyConfig?>,
    private val defaultDispatcher: CoroutineDispatcher =
        @OptIn(DelicateCoroutinesApi::class) newSingleThreadContext("RemoteAnitorrentEngine"),
) : TorrentEngineFactory {
    override fun createTorrentEngine(
        parentCoroutineContext: CoroutineContext,
        config: Flow<AnitorrentConfig>,
        client: ScopedHttpClient,
        peerFilterSettings: Flow<PeerFilterSettings>,
        saveDir: SystemPath
    ): TorrentEngine {
        return RemoteAnitorrentEngine(
            serviceConnection,
            torrentEngineAccess,
            config,
            proxyConfig,
            peerFilterSettings,
            saveDir,
            parentCoroutineContext,
            defaultDispatcher,
        )
    }
}
```

### Core Architecture Module: `app/shared/app-data/src/androidMain/kotlin/domain/torrent/client/RemoteAnitorrentEngine.kt`
```
/*
 * Copyright (C) 2024-2025 OpenAni and contributors.
 *
 * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
 * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
 *
 * https://github.com/open-ani/ani/blob/main/LICENSE
 */

package me.him188.ani.app.domain.torrent.client

import android.os.Build
import android.os.IInterface
import androidx.annotation.RequiresApi
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineName
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.serialization.builtins.nullable
import kotlinx.serialization.json.Json
import me.him188.ani.app.data.models.preference.AnitorrentConfig
import me.him188.ani.app.data.models.preference.ProxyConfig
import me.him188.ani.app.domain.media.cache.engine.TorrentEngineAccess
import me.him188.ani.app.domain.torrent.IRemoteAniTorrentEngine
import me.him188.ani.app.domain.torrent.TorrentEngine
import me.him188.ani.app.domain.torrent.TorrentEngineType
import me.him188.ani.app.domain.torrent.parcel.PAnitorrentConfig
import me.him188.ani.app.domain.torrent.parcel.PProxyConfig
import me.him188.ani.app.domain.torrent.parcel.toParceled
import me.him188.ani.app.domain.torrent.peer.PeerFilterSettings
import me.him188.ani.app.domain.torrent.service.TorrentServiceConnection
import me.him188.ani.app.torrent.api.TorrentDownloader
import me.him188.ani.datasources.api.source.MediaSourceLocation
import me.him188.ani.utils.coroutines.IO_
import me.him188.ani.utils.coroutines.childScope
import me.him188.ani.utils.io.SystemPath
import me.him188.ani.utils.io.absolutePath
import me.him188.ani.utils.logging.logger
import kotlin.coroutines.CoroutineContext

/**
 * Create a remote torrent engine based on Android RPC services.
 *
 * @param singleThreadDispatcher Dispatcher for collecting client settings to remote.
 *   If this dispatcher has risk of being blocked, settings collector will not work.
 *   This may leading to endless blocking for whole app.
 */
@RequiresApi(Build.VERSION_CODES.O_MR1)
class RemoteAnitorrentEngine(
    private val connection: TorrentServiceConnection<IRemoteAniTorrentEngine>,
    private val engineAccess: TorrentEngineAccess,
    anitorrentConfigFlow: Flow<AnitorrentConfig>,
    proxyConfig: Flow<ProxyConfig?>,
    peerFilterConfig: Flow<PeerFilterSettings>,
    override val saveDir: SystemPath,
    parentCoroutineContext: CoroutineContext,
    singleThreadDispatcher: CoroutineDispatcher,
) : TorrentEngine {
    private val logger = logger<RemoteAnitorrentEngine>()

    private val scope = parentCoroutineContext.childScope(singleThreadDispatcher)
    private val fetchRemoteScope = parentCoroutineContext.childScope(
        CoroutineName("RemoteAnitorrentEngineFetchRemote") + Dispatchers.IO_,
    )

    private val connectivityAware = DefaultConnectivityAware(
        parentCoroutineContext.childScope(),
        connection.connected,
    )

    override val type: TorrentEngineType = TorrentEngineType.RemoteAnitorrent

    override val isSupported: Boolean
        get() = true

    override val location: MediaSourceLocation = MediaSourceLocation.Local

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    init {
        // transfer from app to service.
        collectSettingsToRemote(
            settingsFlow = proxyConfig.map { json.encodeToString(ProxyConfig.serializer().nullable, it) },
            getBinder = { getBinderOrFail().proxySettingsCollector },
            transact = { collect(PProxyConfig(it)) },
        )
        collectSettingsToRemote(
            settingsFlow = peerFilterConfig.map { it.toParceled() },
            getBinder = { getBinderOrFail().torrentPeerConfigCollector },
            transact = { collect(it) },
        )
        collectSettingsToRemote(
            settingsFlow = anitorrentConfigFlow.map { json.encodeToString(AnitorrentConfig.serializer(), it) },
            getBinder = { getBinderOrFail().anitorrentConfigCollector },
            transact = { collect(PAnitorrentConfig(it)) },
        )
        collectSettingsToRemote(
            settingsFlow = flowOf(saveDir.absolutePath),
            getBinder = { getBinderOrFail() },
            transact = { setSaveDir(it) },
        )
    }

    override suspend fun testConnection(): Boolean {
        return connection.connected.value
    }

    override suspend fun getDownloader(): TorrentDownloader {
        engineAccess.isServiceConnected.first { it } // await for engine access
        return RemoteTorrentDownloader(
            fetchRemoteScope,
            RetryRemoteObject(fetchRemoteScope) { getBinderOrFail().downlaoder },
            connectivityAware,
        )
    }

    private suspend fun getBinderOrFail(): IRemoteAniTorrentEngine {
        return connection.getBinder()
    }

    override fun close() {
        scope.cancel()
        fetchRemoteScope.cancel()
    }

    private inline fun <I : IInterface, T> collectSettingsToRemote(
        settingsFlow: Flow<T>,
        noinline getBinder: suspend () -> I,
        crossinline transact: I.(T) -> Unit
    ) = scope.launch {
        val stateFlow = settingsFlow.stateIn(this)
        val remoteCall = RetryRemoteObject(fetchRemoteScope) { getBinder() }

        connection.connected.filter { it }.collectLatest {
            stateFlow.collect {
                remoteCall.call { transact(it) }
            }
        }
    }
}
```

### Core Architecture Module: `app/shared/app-data/src/androidMain/kotlin/domain/torrent/service/proxy/TorrentEngineProxy.kt`
```
/*
 * Copyright (C) 2024 OpenAni and contributors.
 *
 * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
 * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
 *
 * https://github.com/open-ani/ani/blob/main/LICENSE
 */

package me.him188.ani.app.domain.torrent.service.proxy

import android.os.Build
import androidx.annotation.RequiresApi
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.builtins.nullable
import kotlinx.serialization.json.Json
import me.him188.ani.app.data.models.preference.AnitorrentConfig
import me.him188.ani.app.data.models.preference.ProxyConfig
import me.him188.ani.app.domain.torrent.IRemoteAniTorrentEngine
import me.him188.ani.app.domain.torrent.IRemoteTorrentDownloader
import me.him188.ani.app.domain.torrent.client.DefaultConnectivityAware
import me.him188.ani.app.domain.torrent.collector.IAnitorrentConfigCollector
import me.him188.ani.app.domain.torrent.collector.IProxySettingsCollector
import me.him188.ani.app.domain.torrent.collector.ITorrentPeerConfigCollector
import me.him188.ani.app.domain.torrent.engines.AnitorrentEngine
import me.him188.ani.app.domain.torrent.parcel.PAnitorrentConfig
import me.him188.ani.app.domain.torrent.parcel.PProxyConfig
import me.him188.ani.app.domain.torrent.parcel.PTorrentPeerFilterSettings
import me.him188.ani.app.domain.torrent.parcel.toPeerFilterSettings
import me.him188.ani.app.domain.torrent.peer.PeerFilterSettings
import me.him188.ani.app.torrent.api.TorrentDownloader
import me.him188.ani.utils.coroutines.childScope
import me.him188.ani.utils.logging.info
import me.him188.ani.utils.logging.logger
import kotlin.coroutines.CoroutineContext

class TorrentEngineProxy(
    private val saveDirDeferred: CompletableDeferred<String>,
    private val proxyConfig: MutableSharedFlow<ProxyConfig?>,
    private val peerFilterSettings: MutableSharedFlow<PeerFilterSettings>,
    private val anitorrentConfig: MutableSharedFlow<AnitorrentConfig>,
    private val anitorrent: CompletableDeferred<AnitorrentEngine>,
    isClientBound: StateFlow<Boolean>,
    context: CoroutineContext,
) : IRemoteAniTorrentEngine.Stub() {
    private val logger = logger<TorrentEngineProxy>()
    private val scope = context.childScope()
    private val connectivityAware = DefaultConnectivityAware(context.childScope(), isClientBound)

    // cache downloader in case clients always get the same downloader proxy instance.
    private var currentDownloader: TorrentDownloader? = null

    private val downloaderProxy = flow<TorrentDownloader> {
        val newDownloader = anitorrent.await().getDownloader()
        if (currentDownloader == null || newDownloader !== currentDownloader) {
            emit(newDownloader)
            currentDownloader = newDownloader
        }
    }
        .distinctUntilChanged()
        .map { TorrentDownloaderProxy(it, connectivityAware, scope.coroutineContext) }
        .stateIn(scope, SharingStarted.Lazily, null)

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    override fun getAnitorrentConfigCollector(): IAnitorrentConfigCollector {
        return object : IAnitorrentConfigCollector.Stub() {
            override fun collect(config: PAnitorrentConfig?) {
                logger.info { "received client AnitorrentConfig: $config" }
                if (config != null) anitorrentConfig.tryEmit(
                    json.decodeFromString(AnitorrentConfig.serializer(), config.serializedJson),
                )
            }
        }
    }

    override fun getProxySettingsCollector(): IProxySettingsCollector {
        return object : IProxySettingsCollector.Stub() {
            override fun collect(config: PProxyConfig?) {
                logger.info { "received client ProxyConfig: $config" }
                if (config != null) proxyConfig.tryEmit(
                    json.decodeFromString(ProxyConfig.serializer().nullable, config.serializedJson),
                )
            }
        }
    }

    @RequiresApi(Build.VERSION_CODES.O_MR1)
    override fun getTorrentPeerConfigCollector(): ITorrentPeerConfigCollector {
        return object : ITorrentPeerConfigCollector.Stub() {
            override fun collect(config: PTorrentPeerFilterSettings?) {
                logger.info { "received client TorrentPeerConfig: $config" }
                if (config != null) peerFilterSettings.tryEmit(config.toPeerFilterSettings())
            }
        }
    }

    override fun setSaveDir(saveDir: String?) {
        logger.info { "received client saveDir: $saveDir" }
        if (saveDir != null) saveDirDeferred.complete(saveDir)
    }

    override fun getDownlaoder(): IRemoteTorrentDownloader {
        return runBlocking { downloaderProxy.filterNotNull().first() }
    }
}
```

### Core Architecture Module: `app/shared/app-data/src/commonMain/kotlin/data/models/bangumi/BangumiSyncState.kt`
```
/*
 * Copyright (C) 2024-2025 OpenAni and contributors.
 *
 * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
 * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
 *
 * https://github.com/open-ani/ani/blob/main/LICENSE
 */

package me.him188.ani.app.data.models.bangumi

import me.him188.ani.client.models.AniBangumiFullSyncState
import me.him188.ani.client.models.AniBangumiSyncError
import me.him188.ani.client.models.AniBangumiSyncStateEntity

sealed interface BangumiSyncState {
    val finished: Boolean get() = false

    data object Preparing : BangumiSyncState

    data class FetchingSubjects(val fetchedCount: Int) : BangumiSyncState
    data class FetchingEpisodes(val fetchedCount: Int) : BangumiSyncState
    data class Inserting(val savedCount: Int) : BangumiSyncState

    data class Finishing(val savedCount: Int) : BangumiSyncState

    data class Finished(val savedCount: Int, val error: AniBangumiSyncError?) : BangumiSyncState {
        override val finished: Boolean
            get() = true
    }

    data object Unsupported : BangumiSyncState

    companion object {
        fun fromEntity(entity: AniBangumiSyncStateEntity): BangumiSyncState? {
            return when (entity.state) {
                null -> Unsupported
                AniBangumiFullSyncState.PREPARING -> Preparing
                AniBangumiFullSyncState.FETCHING_SUBJECTS -> FetchingSubjects(entity.value ?: 0)
                AniBangumiFullSyncState.FETCHING_EPISODES -> FetchingEpisodes(entity.value ?: 0)
                AniBangumiFullSyncState.INSERTING_DATABASE -> Inserting(entity.value ?: 0)
                AniBangumiFullSyncState.FINISHING -> Finishing(entity.value ?: 0)
                AniBangumiFullSyncState.FINISHED -> Finished(entity.value ?: 0, entity.error)
            }
        }
    }
}
```

### Core Architecture Module: `app/shared/app-data/src/commonMain/kotlin/data/persistent/database/dao/HttpCacheDownloadStateDao.kt`
```
/*
 * Copyright (C) 2024-2026 OpenAni and contributors.
 *
 * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
 * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
 *
 * https://github.com/open-ani/ani/blob/main/LICENSE
 */

package me.him188.ani.app.data.persistent.database.dao

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow
import me.him188.ani.utils.httpdownloader.DownloadId
import me.him188.ani.utils.httpdownloader.DownloadState
import me.him188.ani.utils.httpdownloader.DownloadStatus

@Dao
interface HttpCacheDownloadStateDao {
    @Query("""SELECT * FROM http_cache_download_state""")
    fun getAll(): Flow<List<DownloadState>>

    @Upsert
    suspend fun upsert(state: DownloadState)

    @Query("""UPDATE http_cache_download_state SET status = :status WHERE downloadId = :id""")
    suspend fun updateStatus(id: DownloadId, status: DownloadStatus)

    @Query("""DELETE FROM http_cache_download_state""")
    suspend fun deleteAll()

    @Query("""DELETE FROM http_cache_download_state WHERE downloadId = :id""")
    suspend fun deleteById(id: DownloadId)

    @Query("""SELECT * FROM http_cache_download_state WHERE downloadId = :id LIMIT 1""")
    suspend fun getById(id: DownloadId): DownloadState?
}

```

### Core Architecture Module: `app/shared/app-data/src/commonMain/kotlin/data/repository/WindowStateRepository.kt`
```
/*
 * Copyright (C) 2024-2025 OpenAni and contributors.
 *
 * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
 * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
 *
 * https://github.com/open-ani/ani/blob/main/LICENSE
 */

package me.him188.ani.app.data.repository

import androidx.compose.ui.unit.Dp
import androidx.datastore.core.DataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

sealed class WindowStateRepository : Repository() {
    abstract val flow: Flow<SavedWindowState?>
    abstract suspend fun update(states: SavedWindowState)
}

@Serializable
data class SavedWindowState(
    val x: @Serializable(DpSerializer::class) Dp, // dp
    val y: @Serializable(DpSerializer::class) Dp, // dp
    val width: @Serializable(DpSerializer::class) Dp, // dp
    val height: @Serializable(DpSerializer::class) Dp, // dp
) {
    fun hasUnspecified(): Boolean =
        x == Dp.Unspecified || y == Dp.Unspecified || width == Dp.Unspecified || height == Dp.Unspecified
}

private object DpSerializer : KSerializer<Dp> {
    override val descriptor = Float.serializer().descriptor

    override fun serialize(encoder: Encoder, value: Dp) {
        encoder.encodeFloat(value.value)
    }

    override fun deserialize(decoder: Decoder): Dp = Dp(decoder.decodeFloat())
}

class WindowStateRepositoryImpl(
    private val store: DataStore<SavedWindowState?>,
) : WindowStateRepository() {
    override val flow: Flow<SavedWindowState?> = store.data

    override suspend fun update(states: SavedWindowState) {
        store.updateData {
            states
        }
    }

}

```

### Core Architecture Module: `app/shared/app-data/src/commonMain/kotlin/domain/danmaku/DanmakuLoadingState.kt`
```
/*
 * Copyright (C) 2024-2025 OpenAni and contributors.
 *
 * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
 * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
 *
 * https://github.com/open-ani/ani/blob/main/LICENSE
 */

package me.him188.ani.app.domain.danmaku

import androidx.compose.runtime.Immutable

@Immutable
sealed class DanmakuLoadingState {
    @Immutable
    data object Idle : DanmakuLoadingState()

    @Immutable
    data object Loading : DanmakuLoadingState()

    @Immutable
    data object Success : DanmakuLoadingState()

    @Immutable
    data class Failed(
        val cause: Throwable,
    ) : DanmakuLoadingState()
}

```

### Core Architecture Module: `app/shared/app-data/src/commonMain/kotlin/domain/episode/EpisodeFetchSelectPlayState.kt`
```
/*
 * Copyright (C) 2024-2026 OpenAni and contributors.
 *
 * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
 * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
 *
 * https://github.com/open-ani/ani/blob/main/LICENSE
 */

package me.him188.ani.app.domain.episode

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineName
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.getAndUpdate
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.job
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import me.him188.ani.app.data.repository.media.SelectorMediaSourceEpisodeCacheRepository
import me.him188.ani.app.data.repository.player.EpisodePlayHistoryRepository
import me.him188.ani.app.domain.foundation.LoadError
import me.him188.ani.app.domain.media.hls.HlsPlaybackPreparer
import me.him188.ani.app.domain.media.fetch.MediaFetchSession
import me.him188.ani.app.domain.media.fetch.MediaSourceManager
import me.him188.ani.app.domain.media.fetch.createFetchFetchSession
import me.him188.ani.app.domain.media.resolver.toEpisodeMetadata
import me.him188.ani.app.domain.media.selector.MediaSelector
import me.him188.ani.app.domain.player.ExtensionException
import me.him188.ani.app.domain.player.PlayerExtensionManager
import me.him188.ani.app.domain.player.extension.EpisodePlayerExtensionFactory
import me.him188.ani.app.domain.player.extension.ExtensionBackgroundTaskScope
import me.him188.ani.app.domain.player.extension.PlayerExtension
import me.him188.ani.app.domain.player.extension.PlayerExtensionEvent
import me.him188.ani.app.domain.usecase.GlobalKoin
import me.him188.ani.app.domain.watchtogether.PlaybackAutomationGate
import me.him188.ani.utils.analytics.Analytics
import me.him188.ani.utils.analytics.AnalyticsEvent.Companion.EpisodeSwitch
import me.him188.ani.utils.logging.info
import me.him188.ani.utils.logging.logger
import me.him188.ani.utils.logging.warn
import org.koin.core.Koin
import org.openani.mediamp.MediampPlayer
import kotlin.coroutines.AbstractCoroutineContextElement
import kotlin.coroutines.CoroutineContext
import kotlin.coroutines.cancellation.CancellationException


/**
 * 用于管理单个番剧集数（episode）的数据获取、媒体资源选择与播放流程，并在内部协调这些流程的切换和更新。
 *
 * 要查看有关剧集 查询-选择-播放 架构的详细信息，请参阅 PR 文档 [#1439](https://github.com/open-ani/animeko/pull/1439).
 *
 * ### 主要功能
 * - **获取与维护 Episode 数据**：通过 [EpisodeSession] 提供 [SubjectEpisodeInfoBundle]、[MediaFetchSession]、[MediaSelector] 等播放时需要的数据.
 * - **播放器扩展管理**：可在播放流程中加载多个 [EpisodePlayerExtensionFactory] 提供的扩展, 例如自动连播. 详见 [PlayerExtension]
 * - **切换 Episode**：调用 [switchEpisode] 切换到新的 `episodeId`，会关闭旧的 [EpisodeSession] 并重置播放器状态。
 * - **UI 生命周期对接**：在 [onUIReady] 时机启动需要依赖 UI 就绪的后台任务，例如部分扩展初始化。
 *
 * ### 生命周期
 * 1. **初始化**：初始化提供 [isInitialized], 将会为它创建一个 [EpisodeSession]. 但不会立即启动任何后台任务. 需要等待 [onUIReady] 时才会启动.
 * 2. **切换 episode**：在需要切换到新的 episode 时调用 [switchEpisode]。旧的 [EpisodeSession] 及其所有后台协程会被停止，新的 episode 会重新开始资源加载与播放流程。
 *
 * ### 注意 [UnsafeEpisodeSessionApi]
 * 如果在 `combine` 多个 flow 时（例如 [episodeSessionFlow]、[infoBundleFlow]、[mediaFetchSessionFlow] 等），要注意可能会出现数据不一致的情况。
 * 当 [switchEpisode] 被调用后，一些 Flow 可能仍在处理旧的数据或在协程中引用旧的 `episodeId`。若要安全地组合多个 Flow，请务必在同一个 [EpisodeSession] 上进行或参照注解文档 [UnsafeEpisodeSessionApi]。
 */
class EpisodeFetchSelectPlayState(
    val subjectId: Int,
    initialEpisodeId: Int,
    player: MediampPlayer,
    private val backgroundScope: CoroutineScope,
    extensions: List<EpisodePlayerExtensionFactory<*>>,
    private val koin: Koin = GlobalKoin,
    private val sharingStarted: SharingStarted = SharingStarted.WhileSubscribed(),
    private val mainDispatcher: CoroutineContext = Dispatchers.Main.immediate,
    private val analyticsContext: AnalyticsContext = object : AnalyticsContext {},
) {
    interface AnalyticsContext {
        suspend fun isFullscreen(): Boolean? = false
    }

    private val selectorCacheRepo by koin.inject<SelectorMediaSourceEpisodeCacheRepository>()
    private val mediaSourceManager by koin.inject<MediaSourceManager>()
    private val playHistoryRepository by koin.inject<EpisodePlayHistoryRepository>()
    private val automationGate by koin.inject<PlaybackAutomationGate>()

    /**
     * 条目级查询会话, 各集共用: 切集只重建选择器, 不重新查询.
     */
    private val fetchSessions = SubjectMediaFetchSessions(backgroundScope) { request ->
        mediaSourceManager.createFetchFetchSession(flowOf(request))
    }

    private val _episodeSessionFlow = MutableStateFlow(
        newEpisodeSession(initialEpisodeId),
    )

    /**
     * A flow of [EpisodeSession].
     * TODO Document
     */
    val episodeSessionFlow: StateFlow<EpisodeSession> = _episodeSessionFlow.asStateFlow()

    val playerSession = PlayerSession(
        player,
        koin,
        backgroundScope,
        mainDispatcher,
    )

    private val extensionManager by lazy {
        val intrinsicExtensions = listOf(
            EpisodePlayerExtensionFactory { context, _ ->
                LoadMediaOnSelectExtension { episodeId ->
                    backgroundScope.launch { context.broadcast(MediaLoadedEvent(episodeId)) }
                }
            },
        )

        PlayerExtensionManager(
            intrinsicExtensions + extensions,
            this, koin,
        ) // leaking 'this', but should be fine
    }

    private val switchEpisodeLock = Mutex()

    /**
     * Switch to a new episode.
     *
     * This function flushes all background tasks and starts new ones.
     */
    suspend fun switchEpisode(episodeId: Int) {
        Analytics.recordEvent(
            EpisodeSwitch,
            mapOf(
                "subject_id" to subjectId,
                "episode_id" to episodeId,
                "is_fullscreen" to analyticsContext.isFullscreen(),
            ),
        )

        currentCoroutineContext()[InSwitchEpisode]?.let { element ->
            error(
                "Recursive switchEpisode call detected. " +
                        "You wanted to switch to $episodeId, while you are already switching to ${element.newEpisodeId}.",
            )
        }

        /**
         * Caution: switchEpisode maybe called from a session scope task that was launched from [PlayerExtension.onStart].
         *
         * At step 1 we close the scope. This will cancel all session scope tasks, including the current one running this line of code.
         *
         * So we launch a new coroutine to do the actual work.
         */
        backgroundScope.launch {
            switchEpisodeLock.withLock {
                withContext(InSwitchEpisode(episodeId)) {
                    // 1. 停止上一个 episode 生命周期内的所有后台任务.
                    logger.info { "SwitchEpisode($episodeId): Stopping previous scope" }
                    _episodeSessionFlow.value.sessionScope.coroutineContext.job.cancelAndJoin()

                    // 2. 暂停播放, '冻结'播放器状态. 此时还不能 stop, 因为要调用扩展.
                    logger.info { "SwitchEpisode($episodeId): Pausing player" }
                    withContext(mainDispatcher) {
                        // 按播放意图判断: 缓冲中也应当暂停 (v1 只在 PLAYING 时暂停, 是个缺陷)
                        if (player.state.value.playWhenReady) {
                            player.pause()
                        }
                    }

                    // 3. 调用扩展, 使用旧播放器的状态.
                    logger.info { "SwitchEpisode($episodeId): Calling extension onBeforeSwitchEpisode" }
                    extensionManager.call {
                        it.onBeforeSwitchEpisode(episodeId)
                    }

                    // 4. 停止播放器, 清空播放器状态.
                    logger.info { "SwitchEpisode($episodeId): Stopping player" }
                    playerSession.stopPlayback()

                    // 5. 创建新的 fetchSelectSession
                    logger.info { "SwitchEpisode($episodeId): Propagate newEpisodeSession" }
                    val newSession = newEpisodeSession(episodeId)
                    _episodeSessionFlow.value = newSession

                    // 6. Suspend until background tasks are started.
                    logger.info { "SwitchEpisode($episodeId): Start background tasks" }
                    newSession.startSessionScopeTasks()

                    logger.info { "SwitchEpisode($episodeId): Complete" }
                }
            }
        }.join()
    }

    private fun newEpisodeSession(episodeId: Int) = EpisodeSession(
        subjectId,
        episodeId,
        koin,
        backgroundScope.coroutineContext,
        sharingStarted,
        fetchSessions,
    )

    private val uiReady = CompletableDeferred<Unit>()

    fun onUIReady() {
        uiReady.complete(Unit)

        /**
         * Check if we need to startBackgroundTasks. This is needed, because initial value of [_episodeSessionFlow] does not call startBackgroundTasks.
         */
        episodeSessionFlow.value.let { session ->
            if (!session.sessionScopeTasksStarted.value) {
                backgroundScope.launch {
                    session.startSessionScopeTasks() // Will check again if backgroundTasksStarted so thread-safe.
                }
            }
        }

        // 清除已过期的 web 源搜索缓存. 与启动查询无关 (读取本身就会过滤过期行), 因此不阻塞 session 启动.
     
```

### Core Architecture Module: `app/shared/app-data/src/commonMain/kotlin/domain/media/cache/engine/DummyMediaCacheEngine.kt`
```
/*
 * Copyright (C) 2024-2025 OpenAni and contributors.
 *
 * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
 * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
 *
 * https://github.com/open-ani/ani/blob/main/LICENSE
 */

package me.him188.ani.app.domain.media.cache.engine

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import me.him188.ani.app.domain.media.cache.MediaCache
import me.him188.ani.app.domain.media.cache.MediaCacheState
import me.him188.ani.app.domain.media.resolver.EpisodeMetadata
import me.him188.ani.app.tools.toProgress
import me.him188.ani.datasources.api.CachedMedia
import me.him188.ani.datasources.api.Media
import me.him188.ani.datasources.api.MediaCacheMetadata
import me.him188.ani.datasources.api.source.MediaSourceLocation
import me.him188.ani.datasources.api.topic.FileSize.Companion.megaBytes
import kotlin.coroutines.CoroutineContext

/**
 * 不会实际发起下载, 内部维护一个虚拟进度条, 用于测试.
 */
class DummyMediaCacheEngine(
    private val mediaSourceId: String,
    private val location: MediaSourceLocation = MediaSourceLocation.Local,
    override val engineKey: MediaCacheEngineKey = Companion.engineKey,
) : MediaCacheEngine {
    
    override val stats: Flow<MediaStats> = flowOf(MediaStats.Unspecified)

    override fun supports(media: Media): Boolean = true

    override suspend fun restore(
        origin: Media,
        metadata: MediaCacheMetadata,
        parentContext: CoroutineContext
    ): MediaCache = DummyMediaCache(origin, metadata, mediaSourceId, location)

    override suspend fun createCache(
        origin: Media,
        metadata: MediaCacheMetadata,
        episodeMetadata: EpisodeMetadata,
        parentContext: CoroutineContext
    ): MediaCache = DummyMediaCache(origin, metadata, mediaSourceId, location)

    override suspend fun deleteUnusedCaches(all: List<MediaCache>) {
    }

    companion object {
        val engineKey = MediaCacheEngineKey("test-in-memory")
    }
}

class DummyMediaCache(
    override val origin: Media,
    override val metadata: MediaCacheMetadata,
    val mediaSourceId: String,
    val location: MediaSourceLocation = MediaSourceLocation.Local,
) : MediaCache {
    private val cachedMedia by lazy {
        CachedMedia(origin, mediaSourceId, origin.download, location)
    }
    override val state: MutableStateFlow<MediaCacheState> = MutableStateFlow(
        MediaCacheState.IN_PROGRESS,
    )

    override suspend fun getCachedMedia(): CachedMedia = cachedMedia

    override val fileStats: Flow<MediaCache.FileStats> =
        flowOf(MediaCache.FileStats(300.megaBytes, 100.megaBytes))
    override val sessionStats: Flow<MediaCache.SessionStats> =
        flowOf(
            MediaCache.SessionStats(
                0.megaBytes,
                0.megaBytes,
                0.megaBytes,
                0.megaBytes,
                0.megaBytes,
                0f.toProgress(),
            ),
        )

    override suspend fun pause() {
    }

    override suspend fun close() {
    }

    override suspend fun resume() {
    }

    override val isDeleted: MutableStateFlow<Boolean> = MutableStateFlow(false)

    override suspend fun closeAndDeleteFiles() {
        isDeleted.value = true
    }
}

```

### Core Architecture Module: `app/shared/app-data/src/commonMain/kotlin/domain/media/cache/engine/HttpMediaCacheEngine.kt`
```
/*
 * Copyright (C) 2024-2026 OpenAni and contributors.
 *
 * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
 * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
 *
 * https://github.com/open-ani/ani/blob/main/LICENSE
 */

package me.him188.ani.app.domain.media.cache.engine

import androidx.compose.runtime.Composable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.io.Buffer
import kotlinx.io.files.Path
import kotlinx.io.files.SystemFileSystem
import kotlinx.io.writeString
import me.him188.ani.app.data.persistent.database.dao.HttpCacheDownloadStateDao
import me.him188.ani.app.domain.media.cache.DownloaderStatus
import me.him188.ani.app.domain.media.cache.MediaCache
import me.him188.ani.app.domain.media.cache.MediaCacheState
import me.him188.ani.app.domain.media.resolver.EpisodeMetadata
import me.him188.ani.app.domain.media.resolver.MediaResolver
import me.him188.ani.app.tools.Progress
import me.him188.ani.app.tools.toProgress
import me.him188.ani.app.torrent.api.files.averageRate
import me.him188.ani.datasources.api.CachedMedia
import me.him188.ani.datasources.api.DefaultMedia
import me.him188.ani.datasources.api.Media
import me.him188.ani.datasources.api.MediaCacheMetadata
import me.him188.ani.datasources.api.MediaCacheProperties
import me.him188.ani.datasources.api.topic.FileSize
import me.him188.ani.datasources.api.topic.FileSize.Companion.bytes
import me.him188.ani.datasources.api.topic.ResourceLocation
import me.him188.ani.utils.coroutines.IO_
import me.him188.ani.utils.httpdownloader.DownloadId
import me.him188.ani.utils.httpdownloader.DownloadOptions
import me.him188.ani.utils.httpdownloader.DownloadProgress
import me.him188.ani.utils.httpdownloader.DownloadState
import me.him188.ani.utils.httpdownloader.DownloadStatus
import me.him188.ani.utils.httpdownloader.HttpDownloader
import me.him188.ani.utils.httpdownloader.MediaType
import me.him188.ani.utils.io.DigestAlgorithm
import me.him188.ani.utils.io.absolutePath
import me.him188.ani.utils.io.actualSize
import me.him188.ani.utils.io.delete
import me.him188.ani.utils.io.deleteRecursively
import me.him188.ani.utils.io.exists
import me.him188.ani.utils.io.inSystem
import me.him188.ani.utils.io.readAndDigest
import me.him188.ani.utils.logging.error
import me.him188.ani.utils.logging.info
import me.him188.ani.utils.logging.logger
import me.him188.ani.utils.logging.warn
import org.openani.mediamp.source.SeekableInputMediaData
import org.openani.mediamp.source.UriMediaData
import kotlin.coroutines.CoroutineContext

class HttpMediaCacheEngine(
    private val downloader: HttpDownloader,
    private val saveDir: Path,
    private val mediaResolver: MediaResolver,
    private val mediaSourceId: String,
    private val dao: HttpCacheDownloadStateDao,
) : MediaCacheEngine {
    override val engineKey: MediaCacheEngineKey = MediaCacheEngineKey.WebM3u

    override val stats: Flow<MediaStats> = run {
        val downloadSpeedFlow =
            downloader.downloadStatesFlow
                .map { list ->
                    list.sumOf { it.downloadedBytes }
                }
                .averageRate()

        combine(downloader.downloadStatesFlow, downloadSpeedFlow) { list, speed ->
            MediaStats(
                uploaded = FileSize.Zero,
                downloaded = list.sumOf { it.downloadedBytes }.bytes,
                uploadSpeed = FileSize.Zero,
                downloadSpeed = speed.bytes,
            )
        }
    }

    override fun supports(media: Media): Boolean {
        // Check that the media is not already cached
        when (media) {
            is CachedMedia -> return false
            is DefaultMedia -> {} // for smart cast
        }

        return when (media.download) {
            is ResourceLocation.HttpStreamingFile -> mediaResolver.supports(media)
            is ResourceLocation.HttpTorrentFile,
            is ResourceLocation.MagnetLink,
            is ResourceLocation.LocalFile,
                -> {
                false
            }

            is ResourceLocation.WebVideo -> mediaResolver.supports(media)
        }
    }


    @Composable
    override fun ComposeContent(): Unit = mediaResolver.ComposeContent()

    override suspend fun restore(
        origin: Media,
        metadata: MediaCacheMetadata,
        parentContext: CoroutineContext,
    ): MediaCache? {
        if (!supports(origin)) throw UnsupportedOperationException("Media is not supported by this engine $this: ${origin.download}")

        logger.info { "Restarting cache '${origin.mediaId}'" }
        val downloadId = restoredHttpDownloadId(origin, metadata)

        // 注意, getState 一般不会返回 null, 除非 downloader 的 persistent datastore 出问题了 (例如文件损坏).
        if (downloader.getState(downloadId) != null) {
            downloader.resume(downloadId) // ignore result.
            // Task already exists
            logger.info { "Resumed download $downloadId" }
            return HttpMediaCache(origin, downloadId, metadata)
        }

        val persistentState = dao.getById(downloadId) ?: kotlin.run {
            logger.error { "Failed to find download state $downloadId from persistent storage while recreating cache." }
            return null
        }

        logger.info { "Download not found, recreating $downloadId" }
        downloader.downloadWithId(
            downloadId = downloadId,
            persistentState.url,
            options = DownloadOptions(headers = persistentState.requestHeaders),
        )
        return HttpMediaCache(origin, downloadId, metadata)
    }

    override suspend fun createCache(
        origin: Media,
        metadata: MediaCacheMetadata,
        episodeMetadata: EpisodeMetadata,
        parentContext: CoroutineContext,
    ): MediaCache {
        if (!supports(origin)) throw UnsupportedOperationException("Media is not supported by this engine $this: ${origin.download}")

        val mediaDataProvider = mediaResolver.resolve(origin, episodeMetadata)
        when (val mediaData = mediaDataProvider.open(CoroutineScope(parentContext))) {
            is SeekableInputMediaData -> {
                // This should not happen.
                throw UnsupportedOperationException("SeekableInputMediaData is not supported")
            }

            is UriMediaData -> {
                val downloadId = httpDownloadId(origin, metadata)
                val options = DownloadOptions(headers = mediaData.headers)
                val state = downloader.downloadWithId(
                    downloadId = downloadId,
                    mediaData.uri,
                    options = options,
                ) ?: throw UnsupportedOperationException("Failed to create download job of $downloadId, state is null.")

                return HttpMediaCache(
                    origin,
                    downloadId,
                    metadata,
                )
            }
        }
    }

    /**
     * 新建任务的标识, 由 mediaId, subjectId 与 episodeId 共同决定: 合集资源各集有独立的任务与文件.
     */
    private fun httpDownloadId(media: Media, metadata: MediaCacheMetadata): DownloadId {
        val identity = listOf(media.mediaId, metadata.subjectId, metadata.episodeId)
            .joinToString("") { "${it.length}:$it" }
        val digest = Buffer().apply { writeString(identity) }.readAndDigest(DigestAlgorithm.SHA256).toHexString()
        return DownloadId("http-v2-$digest")
    }

    /**
     * 恢复记录时的任务标识: 优先 [httpDownloadId]; downloader 与 [dao] 中都没有时回退到 [toSafeDownloadId], 以匹配旧记录.
     */
    private suspend fun restoredHttpDownloadId(media: Media, metadata: MediaCacheMetadata): DownloadId {
        val current = httpDownloadId(media, metadata)
        if (downloader.getState(current) != null || dao.getById(current) != null) return current
        return media.toSafeDownloadId()
    }

    override suspend fun deleteUnusedCaches(all: List<MediaCache>) {
        if (!(SystemFileSystem.exists(saveDir))) return


        val allowedAbsolute = buildSet {
            for (mediaCache in all.filterIsInstance<HttpMediaCache>()) {
                downloader.getState(mediaCache.downloadId)?.let { state ->
                    add(Path(saveDir, state.relativeOutputPath).inSystem.absolutePath)
                    add(Path(saveDir, state.relativeSegmentCacheDir).inSystem.absolutePath)
                }
            }
        }
        withContext(Dispatchers.IO_) {
            val saves = SystemFileSystem.list(saveDir)
            for (save in saves) {
                val myPath = save.inSystem.absolutePath
                if (allowedAbsolute.none {
                        myPath.startsWith(it)
                    }) {
                    logger.warn { "本地 WEB 缓存文件未找到匹配的 MediaCache, 已释放 ${save.inSystem.actualSize().bytes}: ${save.inSystem.absolutePath}" }
                    SystemFileSystem.deleteRecursively(save)
                }
            }
        }

    }

    inner class HttpMediaCache(
        override val origin: Media,
        internal val downloadId: DownloadId,
        override val metadata: MediaCacheMetadata,
    ) : MediaCache {
        override val state: Flow<MediaCacheState> =
            downloader.getProgressFlow(downloadId).map { it.status.toMediaCacheState() }

        override val canPlay: Flow<Boolean>
            get() = downloader.getProgressFlow(downloadId).map {
                it.status == DownloadStatus.COMPLETED
            }

        override val fileStats: Flow<MediaCache.FileStats> = downloader.getProgressFlow(downloadId).map {
            val totalSize = it.totalBytes
            val downloadedBytes = it.downloadedBytes
            MediaCache.FileStats(

```

### Core Architecture Module: `app/shared/app-data/src/commonMain/kotlin/domain/media/cache/engine/KtorPersistentHttpDownloader.kt`
```
/*
 * Copyright (C) 2024-2026 OpenAni and contributors.
 *
 * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
 * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
 *
 * https://github.com/open-ani/ani/blob/main/LICENSE
 */

package me.him188.ani.app.domain.media.cache.engine

import kotlinx.collections.immutable.toPersistentMap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.withLock
import kotlinx.io.files.FileSystem
import kotlinx.io.files.Path
import me.him188.ani.app.data.persistent.database.dao.HttpCacheDownloadStateDao
import me.him188.ani.utils.coroutines.IO_
import me.him188.ani.utils.httpdownloader.DownloadId
import me.him188.ani.utils.httpdownloader.DownloadState
import me.him188.ani.utils.httpdownloader.DownloadStatus
import me.him188.ani.utils.httpdownloader.KtorHttpDownloader
import me.him188.ani.utils.httpdownloader.m3u.DefaultM3u8Parser
import me.him188.ani.utils.httpdownloader.m3u.M3u8Parser
import me.him188.ani.utils.ktor.ScopedHttpClient
import me.him188.ani.utils.logging.info
import me.him188.ani.utils.logging.logger
import kotlin.coroutines.CoroutineContext
import kotlin.time.Clock

/**
 * A persistent version of [me.him188.ani.utils.httpdownloader.KtorHttpDownloader] that automatically:
 * - Loads saved download states from [dao] on construction.
 * - Saves new/updated states whenever [_downloadStatesFlow] changes.
 */
class KtorPersistentHttpDownloader(
    private val dao: HttpCacheDownloadStateDao,
    client: ScopedHttpClient,
    fileSystem: FileSystem,
    baseSaveDir: Path,
    ioDispatcher: CoroutineContext = Dispatchers.IO_,
    clock: Clock = Clock.System,
    m3u8Parser: M3u8Parser = DefaultM3u8Parser,
    scope: CoroutineScope,
) : KtorHttpDownloader(
    client = client,
    fileSystem = fileSystem,
    baseSaveDir = baseSaveDir,
    clock = clock,
    m3u8Parser = m3u8Parser,
    parentScope = scope,
    ioDispatcher = ioDispatcher,
) {
    override suspend fun init() {
        super.init()
        restoreStates()
    }

    /**
     * Replaces the current in-memory map with data loaded from [dataStore], but does not resume them.
     * To resume downloads, call [resume] for each entry in the restored map.
     */
    private suspend fun restoreStates() {
        val savedList: List<DownloadState> = dao.getAll().first()
        stateMutex.withLock {
            val currentMap: MutableMap<DownloadId, DownloadEntry> = LinkedHashMap(savedList.size)

            savedList.forEach { st ->
                currentMap[st.downloadId] = DownloadEntry(
                    job = null,
                    state = st.copy(
                        status = when (val status = st.status) {
                            // 恢复时必须将原本的下载中状态设置为 PAUSED, 否则无法 resume.
                            DownloadStatus.INITIALIZING,
                            DownloadStatus.DOWNLOADING,
                            DownloadStatus.MERGING -> DownloadStatus.PAUSED

                            DownloadStatus.PAUSED,
                            DownloadStatus.COMPLETED,
                            DownloadStatus.FAILED,
                            DownloadStatus.CANCELED -> status
                        },
                    ),
                )
            }
            _downloadStatesFlow.value = currentMap.toPersistentMap()
            logger.info { "Restored ${currentMap.size} downloads from DataStore" }
        }
    }

    override fun onCreateDownloadState(state: DownloadState) {
        scope.launch {
            dao.upsert(state)
        }
    }

    override fun onUpdateDownloadState(downloadId: DownloadId, state: DownloadState) {
        scope.launch {
            dao.upsert(state)
        }
    }

    override fun onUpdateDownloadStatus(downloadId: DownloadId, status: DownloadStatus) {
        scope.launch {
            dao.updateStatus(downloadId, status)
        }
    }

    override fun onRemoveAllDownloads() {
        scope.launch {
            dao.deleteAll()
        }
    }

    override fun onRemoveDownload(downloadId: DownloadId) {
        scope.launch {
            dao.deleteById(downloadId)
        }
    }

    private companion object {
        private val logger = logger<KtorPersistentHttpDownloader>()
    }
}

```

### Core Architecture Module: `app/shared/app-data/src/commonMain/kotlin/domain/media/cache/engine/MediaCacheEngine.kt`
```
/*
 * Copyright (C) 2024-2025 OpenAni and contributors.
 *
 * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
 * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
 *
 * https://github.com/open-ani/ani/blob/main/LICENSE
 */

package me.him188.ani.app.domain.media.cache.engine

import androidx.compose.runtime.Composable
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.Serializable
import me.him188.ani.app.domain.media.cache.MediaCache
import me.him188.ani.app.domain.media.cache.storage.MediaCacheSave
import me.him188.ani.app.domain.media.cache.storage.MediaCacheStorage
import me.him188.ani.app.domain.media.resolver.EpisodeMetadata
import me.him188.ani.app.domain.torrent.TorrentEngineType
import me.him188.ani.datasources.api.Media
import me.him188.ani.datasources.api.MediaCacheMetadata
import kotlin.coroutines.CoroutineContext
import kotlin.jvm.JvmInline

/**
 * 资源缓存引擎, 负责 [MediaCache] 的创建.
 *
 * [MediaCacheEngine] 的作用可以简单理解为是使用 libtorrent4j (内嵌) 还是 qBittorrent (本机局域网) 来下载种子.
 * 虽然目前不支持缓存 WEB 视频, 但未来增加一个 [MediaCacheEngine] 实现即可支持.
 *
 * ### 元数据管理
 *
 * [Media] 和 [MediaCacheMetadata] 是一个 [MediaCache] 必要的数据.
 * [Media] 表示该 [MediaCache] 缓存的是哪个视频和这个视频自身的信息, [MediaCacheMetadata] 则包含该视频属于哪个番剧的哪一集等来源信息.
 *
 * [MediaCacheEngine] 不考虑缓存元数据的存储方式, 即不考虑目前有多少缓存.
 * 它只根据 [Media] 与 [MediaCacheMetadata] 来启动或恢复下载任务并返回一个 [MediaCache] 示例.
 * [MediaCacheStorage] 负责持久化 [Media] 与 [MediaCacheMetadata], 然后调用 [MediaCacheEngine.restore] 恢复下载任务.
 *
 * ### 下载数据存储位置
 *
 * [MediaCacheEngine] 决定种子数据的实际存储位置, 但该目录不一定包含视频文件. TODO
 */
interface MediaCacheEngine {
    /**
     * 此引擎缓存时使用的标识 key. [MediaCacheStorage] 使用此 key 区分不同的引擎创建的缓存.
     * 其他组件也可能使用此 key 来作为此引擎的唯一标识.
     */
    val engineKey: MediaCacheEngineKey

    /**
     * 此引擎的总体传输统计
     */
    val stats: Flow<MediaStats>

    /**
     * 是否支持给定缓存给定的 [Media].
     * 当且仅当返回 `true` 时, [restore] 和 [createCache] 才可以被调用.
     */
    fun supports(media: Media): Boolean

    /**
     * "挂载" 到 composable 中, 以便进行需要虚拟 UI 的操作, 例如 WebView
     */
    @Composable
    fun ComposeContent() {
    }

    /**
     * 使用给定的 [Media] 信息 [origin] 以及缓存元数据 [metadata], 恢复一个 [MediaCache]
     * Restores a cache that was created by [createCache].
     *
     * @param metadata from `MediaCache.media.cacheMetadata` from [createCache]
     *
     * Returns `null` if the cache was deleted or invalid.
     * @throws UnsupportedOperationException if [supports] returned false
     */
    suspend fun restore(
        origin: Media,
        metadata: MediaCacheMetadata,
        parentContext: CoroutineContext
    ): MediaCache?

    /**
     * 创建一个新的返回
     * @throws UnsupportedOperationException if [supports] returned false
     */
    suspend fun createCache(
        origin: Media,
        metadata: MediaCacheMetadata,
        episodeMetadata: EpisodeMetadata,
        parentContext: CoroutineContext,
    ): MediaCache

    /**
     * 删除所有未在 [all] 中找到对应 [MediaCache] 的文件. 这通常包括在线播放的视频. 不会包括通过缓存功能创建的.
     */
    suspend fun deleteUnusedCaches(all: List<MediaCache>)
}

/**
 * 每个 [MediaCacheEngine] 使用独一无二的 key，存储于 [MediaCacheSave] 用于区分不同的引擎创建的 [MediaCache].
 */
@Serializable
@JvmInline
value class MediaCacheEngineKey(val key: String) {
    /**
     * 云盘引擎按需从服务商取流, 没有磁力链解析、节点和上传, 展示层据此区分本地 BT.
     */
    val isCloud: Boolean get() = this == PikPak

    companion object {
        val Anitorrent = MediaCacheEngineKey(TorrentEngineType.Anitorrent.id)
        val PikPak = MediaCacheEngineKey(TorrentEngineType.PikPak.id)
        val WebM3u = MediaCacheEngineKey("web-m3u")
    }
}
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3535** (2026-10-05): **Android 端播放视频时手机严重发热**
  *Symptoms*: ### 建议内容  手机端看不完一集就发热过大，烫的能煎鸡蛋吃。  ### 当前 Ani 版本号  6.3.0  ### 操作系统  Android 手机/平板
  **Post-Mortem & Fix Analysis**:
  > 开画质增强了吗，这个功能会消耗非常多 GPU 资源 还需要说一下是什么设备

- **Issue #3534** (2026-10-05): **安卓端开启超分辨率时切换全屏状态会导致黑屏**
  *Symptoms*: ### 问题描述  安卓端开启超分辨率的情况下进行全屏或者退出全屏操作，会导致画面直接黑屏。无法自行恢复，只能退出观看页面重新进入  ### 复现步骤  开启超分辨率的情况下进行全屏或者退出全屏操作，稳定触发  ### Ani 版本号  6.2.0  ### 操作系统  Android 手机/平板  ### 应用日志  [app.log](https://github.com/user-attachments/files/33049012/app.log) ...
  **Post-Mortem & Fix Analysis**:
  > 已经修了，下个版本发

- **Issue #3531** (2026-10-05): **perf(update): 自动更新与 CI 构建分块并行下载**
  *Symptoms*: ## 问题  自动更新 (`DefaultFileDownloader`) 和开发者设置里安装 CI 构建 (`GitHubDevBuildApi`) 各有一份下载代码, 都只用一条连接顺序下载. GitHub artifact 的直链 (Azure Blob) 单连接只有 2 MB/s 左右, 300 MB 的安装包要两分钟.  ## 修改  - 新增共用的 `HttpClient.downloadToFile`, 两处都改用它, 删掉各自的下载循环. - 先以 `Range: bytes=0-0` 探测. 服务器返回 206 时把文件切成 4 MiB 的块, 由 8 个并发请求依次领取, 快的连接多下几块; 各块写入临时文件, 完成后按顺序拼接, 边拼接边删除. 服务器忽略 Range (返回 200) 时直接写入完整响应, 不多发请求, 与原来的单连接下载相同. - 失败的块单独重试, 最多 3 次: 网络错误、数据不完整和 5xx 重试, 4xx (例如直链过期后的 403) 不重试. 失败或取消时删除临时文件. - client 没有自动跟随重定向时 (CI 构建的 client) 由 `downloadToFile` 跟随; 不论 client 的 `expectSuccess`, 非预期状态码都抛出 `DownloadHttpException`. - 两个下载用的 client 都把单个 host 的并发请求上限调到 8 (`engineMaxRequestsPerHost` / `maxRequestsPerHost`), 否则 OkHttp 默认只放行 5 个. - 自动更新的 `.sha1` 校验和多地址顺序尝试不变.  ### 为什么是 8 个连接、4 MiB 的块  在一台机器上实测 (300 MB 的 macOS artifact, Azure `productionresultssa12`, HTTP/1.1):  | | 用时 | 平均速度 | | --- | --- | --- | | 单连接 | 约 110–150 s (估算) | 2.0–2.7 MB/s | | 4 个连接, 4 MiB 块队列 | 46.7 s | 6.5 MB/s | | 8 个连接, 4 MiB 块队列 | 37.9 s | 8.0 MB/s | | 本 PR 的实现 (OkHttp, 8 个连接) | 41.5 s | 7.3 MB/s, SHA-256 与 GitHub 给出的 digest 一致 |  10 秒窗口内 12–16 个连接合计 9.5–10.8 MB/s, 比 8 个多得不多. 同一次下载里单个连接的速度在 0.2–2.2 MB/s 之间, 所以不按连接数固定切段 (那样总耗时取决于最慢的一段), 而是用小块排队: 8 个连接各领到 6–12 块, 最早和最晚结束的连接只差约 4 秒.  其他下载源单连接已经很快: Release 附件 37 MB/s, `d2.myani.org` 24 MB/s. 这两个和 `ghfast.top` 都支持 Range, 走 HTTP/2, OkHttp 会把各块请求复用在一条连接上, 所以对它们提速有限, 但不会变慢.  ### 已知限制  - 块请求在整个下载期间陆续发出, 要求链接一直有效. artifact 直链约 10 分钟过期 (`st` 到 `se`), 合计速度低于约 0.5 MB/s 时后面的块会得到 403. 原来的单连接下载只在开始时校验一次. - 不支持

- **Issue #3530** (2026-10-04): **建议允许animeko在局域网内分享缓存**
  *Symptoms*: ### 建议内容  比如一台机器上有animeko缓存，则允许animeko挂在后台，其他设备上的animeko发现此台机器上的缓存时可以直接从这台机器上取得缓存以进行播放，以避免访问更慢的外部网络  ### 当前 Ani 版本号  6.1.0  ### 操作系统  Windows

- **Issue #3529** (2026-10-04): **建议添加命令行或 MCP 接口，以自动查询追番更新并缓存剧集**
  *Symptoms*: ### 建议内容  个人使用场景为，需要让openclaw按时查找关注的动画清单是否有更新，若有更新则openclaw自动启动缓存进程，将资源缓存到本地，以实现无感自动缓存。 至少需要以下命令：获取指定动画的元数据，获得指定动画的剧集元数据，获得指定动画的缓存状态，对指定动画执行缓存（在命令行中完成，以便openclaw进行监视），获得用户的关注动画列表等 也不一定非要由命令行完成，也可以是允许animeko可以以mcp服务的方式挂在后台  ### 当前 Ani 版本号  6.1.0  ### 操作系统  Windows

- **Issue #3528** (2026-10-05): **refactor(search): 搜索过滤交给服务端, 去掉客户端本地过滤**
  *Symptoms*: 搜索结果原先在本地过滤 (按评分人数, 以及"忽略已看过/抛弃"), 整页被滤空时分页会提前结束 (#3505, #3514 先按"服务端空页才结束"修了一版). 这个 PR 把过滤都交给服务端, 每页结果直接来自服务端.  **依赖 open-ani/ani-api-server#112, 需要先部署服务端再发版.** 新客户端连旧服务端时 `excludeCollectionTypes` 会被忽略, "忽略已看过/抛弃"不生效; `ranks` 过滤旧服务端已经支持.  ## 改动  - **最高排名**: 请求 `ranks=>=1` (仍按评分降序), 只返回 Bangumi 有排名的条目, 代替本地按评分人数 >= 50 过滤. 生产数据对比: 有排名的条目全部 >= 50 票 (最少 51); >= 50 票却无排名的只占 0.1%~0.7%, 多是刚好 50/51 票, 少数是 Bangumi 主动不排名的条目.    | 范围 | >= 50 票 | 有排名 |   |---|---|---|   | 2023 年 | 460 | 455 |   | 2020 年 | 399 | 397 |   | 2025 年 | 435 | 434 |   | 标签"漫画改" | 3510 | 3485 |  - **忽略已看过/抛弃**: 搜索与搜索补全都传 `excludeCollectionTypes=DONE,DROPPED`, 由服务端按登录用户的收藏排除. 搜索请求本来就带 Ani token. - **按放送日期排序**: 去掉页内重排; 已在生产确认关键词与语义两条路径的服务端排序正确. - 两个搜索 repository 不再依赖 `SubjectCollectionRepository`; `getSubjectIdsByCollectionType` 与对应 DAO 查询没有调用方了, 一并删除 (含测试 fake 里的 override). - `generateOpenApiForAnimeko` 按服务端 PR 的 spec 重新生成, 只保留搜索接口相关部分 (`excludeCollectionTypes`, 以及服务端已有但客户端没生成过的 `mode` / `AniSubjectSearchMode`).  ## 测试  - 重写 `SubjectSearchPagingSourceTest`: 最高排名每页都请求 `ranks=>=1` 与 `sortBy=ratingDesc`, 其他排序不带 `ranks`; 开启忽略时每页都带 `excludeCollectionTypes=DONE,DROPPED`, 默认不带; 服务端空页才结束分页, 结果不做本地过滤. - `app-data` 下 subject 相关测试通过 (desktop); `app/shared`, `ui-download`, `ui-subject` 的测试源码与 `application` 编译通过.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 

- **Issue #3525** (2026-10-04): **test(search): 覆盖本地过滤清空整页时的搜索分页**
  *Symptoms*: #3514 的回归测试 (#3505).  搜索结果会在本地按评分人数 (`SearchSort.RANK`) 和已看过/抛弃过滤, 整页可能被清空. 测试用 MockEngine 模拟服务端分页, 断言:  - 按评分排序时首页全是评分人数不足的条目, 仍会请求下一页并拿到后面的结果; - 开启"忽略已看过/抛弃"时整页被排除, 同样继续翻页; - 两种情况都在服务端返回空页后结束.  把修复改回 `subjectInfos.isEmpty()` 时两个测试都会失败 (结果为空列表).  为了直接测 `load`, `SubjectSearchPagingSource` 从 `private` 改为 `internal`.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 

- **Issue #3524** (2026-10-04): **feat(settings): 账号设置支持注销账号**
  *Symptoms*: ## 改动  - 设置页账号一栏底部新增「账号管理」分组，内含「注销账号」，仅登录时显示。 - 确认弹窗说明注销会永久删除此账号的全部数据（收藏、观看记录、评论和弹幕），注销后不可撤回，数据不可找回。需要输入 `yes` 才能确认，忽略大小写和首尾空格（手机键盘常会自动大写首字母）。 - 注销期间弹窗显示进度，不能关闭，按钮禁用。成功后本地退出登录并提示「账号已注销」；失败时 toast 错误，弹窗保留，可以重试。 - `UserRepository.deleteAccount()` / `ProfileViewModel.deleteAccount()`。服务端成功后清除本地登录状态，这一步不会因为界面离开而被取消。 - 用本地服务端跑 `generateOpenApiForAnimeko` 重新生成 API 客户端，只保留新增的 `deleteAccount()`。 - 四个语言的 strings.xml 各加 8 条文案。  依赖服务端 PR：open-ani/ani-api-server#111（`DELETE /v2/users/me`）。  ## 截图  | 设置页底部「账号管理」分组里的入口 | 确认弹窗：输入 yes 前不能确认 | | --- | --- | | ![delete-account-1-entry-v2.png](https://github.com/user-attachments/assets/f1563a50-4de1-498d-be05-f23bbe428f61) | ![delete-account-2-dialog.png](https://github.com/user-attachments/assets/7edb015b-cad9-4376-a1a1-33bbd6dbfb7f) |  | 输入 yes 后可以确认 | 注销中：等待完成，不能关闭 | | --- | --- | | ![delete-account-3-typed.png](https://github.com/user-attachments/assets/943e8603-a5be-46a0-a409-1dad7f2f925b) | ![delete-account-4-deleting.png](https://github.com/user-attachments/assets/eb0f99a2-adcf-499b-a18e-bb1b4f6b7a10) |  ## 测试  - 新增 `ProfileGroupDeleteAccountTest` 5 个用例：未登录时不显示入口、输入 yes 才能确认、注销期间弹窗等待且不能关闭、失败后弹窗保留可重试、取消不注销。 - `ui.settings.account` 下全部 22 个 desktop UI 测试通过。  🤖 Generated with [Claude Code](https://claude.com/claude-code)  

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

### Incident Patch 1: `2d6ab35c` (2026-10-05)
**Commit Message**: fix(player): 桌面端全屏默认隐藏侧边栏

#3510 让桌面端宽屏全屏也跟随侧边栏开关, 而开关默认打开且进出全屏不重置,
导致点击全屏后侧边栏仍然显示. 窗口和全屏各记一份开关, 全屏默认只显示视频,
全屏里仍可通过按钮展开侧边栏, 两者互不影响.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `app/shared/src/commonMain/kotlin/ui/subject/episode/EpisodeScreenLayout.kt` (modified, +22/-0)
```diff
@@ -10,6 +10,10 @@
 package me.him188.ani.app.ui.subject.episode
 
 import androidx.compose.runtime.Composable
+import androidx.compose.runtime.Stable
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.setValue
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.layout.Layout
 import androidx.compose.ui.unit.Constraints
@@ -49,6 +53,24 @@ internal fun episodeScreenLayoutMode(
     else -> EpisodeScreenLayoutMode.VIDEO_ONLY
 }
 
+/**
+ * 宽屏布局的侧边栏开关. 窗口和全屏各记一份: 全屏是为了专心看视频, 默认不显示侧边栏;
+ * 在全屏里展开侧边栏也不会改变退出全屏后的布局.
+ */
+@Stable
+internal class EpisodeSidebarState(
+    private val isFullscreen: () -> Boolean,
+) {
+    private var visibleInWindow by mutableStateOf(true)
+    private var visibleInFullscreen by mutableStateOf(false)
+
+    var isVisible: Boolean
+        get() = if (isFullscreen()) visibleInFullscreen else visibleInWindow
+        set(value) {
+            if (isFullscreen()) visibleInFullscreen = value else visibleInWindow = value
+        }
+}
+
 /**
  * 播放页布局: 播放器和它旁边的次要内容 (窄屏时是下方的详情与评论, 宽屏时是右侧的侧边栏).
  *
```

**File**: `app/shared/src/commonMain/kotlin/ui/subject/episode/EpisodeViewModel.kt` (modified, +2/-1)
```diff
@@ -693,7 +693,8 @@ open class EpisodeViewModel(
         )
 
     var isFullscreen: Boolean by mutableStateOf(initialIsFullscreen)
-    var sidebarVisible: Boolean by mutableStateOf(true)
+    private val sidebarState = EpisodeSidebarState { isFullscreen }
+    var sidebarVisible: Boolean by sidebarState::isVisible
     val commentLazyGirdState: LazyGridState = LazyGridState()
 
     /**
```

**File**: `app/shared/src/desktopTest/kotlin/ui/subject/episode/EpisodeVideoControllerTest.kt` (modified, +37/-19)
```diff
@@ -418,26 +418,26 @@ class EpisodeVideoControllerTest {
     }
 
     @Test
-    fun `desktop sidebar toggles before during and after fullscreen`() = runAniComposeUiTest {
-        var sidebarVisible by mutableStateOf(true)
+    fun `desktop fullscreen hides sidebar by default and toggles it separately from window`() = runAniComposeUiTest {
         val fullscreenState = TestFullscreenState(initialIsFullscreen = false)
+        val sidebarState = EpisodeSidebarState { fullscreenState.isFullscreen }
         val visibleControllerState = PlayerControllerState(NORMAL_VISIBLE)
         var playerCreatedCount = 0
         setContent {
             EpisodeScreenLayout(
                 mode = episodeScreenLayoutMode(
                     isFullscreen = fullscreenState.isFullscreen,
                     showExpandedUI = true,
-                    sidebarVisible = sidebarVisible,
+                    sidebarVisible = sidebarState.isVisible,
                     isDesktop = true,
                 ),
                 video = {
                     Player(
                         GestureFamily.MOUSE,
                         playerControllerState = visibleControllerState,
                         fullscreenState = fullscreenState,
-                        sidebarVisible = sidebarVisible,
-                        onToggleSidebar = { sidebarVisible = it },
+                        sidebarVisible = sidebarState.isVisible,
+                        onToggleSidebar = { sidebarState.isVisible = it },
                         onPlayerStateCreated = { playerCreatedCount++ },
                     )
                 },
@@ -446,22 +446,40 @@ class EpisodeVideoControllerTest {
             )
         }
 
-        for (fullscreen in listOf(false, true, false, true)) {
-            if (fullscreenState.isFullscreen != fullscreen) {
-                fullScreenButton.performClick()
-            }
-            onNodeWithTag("sidebar").assertWidthIsEqualTo(340.dp)
-            player.assertWidthIsEqualTo(660.dp)
-            onNodeWithTag(TAG_COLLAPSE_SIDEBAR).performClick()
-            onNodeWithTag("sidebar").assertDoesNotExist()
-            player.assertWidthIsEqualTo(1000.dp)
-            onNodeWithTag(TAG_COLLAPSE_SIDEBAR).performClick()
-            onNodeWithTag("sidebar").assertWidthIsEqualTo(340.dp)
-            runOnIdle {
-                assertEquals(fullscreen, fullscreenState.isFullscreen)
-                assertEquals(1, playerCreatedCount)
+        fun assertSidebar(fullscreen: Boolean, visible: Boolean) {
+            runOnIdle { assertEquals(fullscreen, fullscreenState.isFullscreen) }
+            if (visible) {
+                onNodeWithTag("sidebar").assertWidthIsEqualTo(340.dp)
+                player.assertWidthIsEqualTo(660.dp)
+            } else {
+                onNodeWithTag("sidebar").assertDoesNotExist()
+                player.assertWidthIsEqualTo(1000.dp)
             }
         }
+
+        assertSidebar(fullscreen = false, visible = true)
+
+        // 进入全屏默认只显示视频, 按钮仍能展开侧边栏
+        fullScreenButton.performClick()
+        assertSidebar(fullscreen = true, visible = false)
+        onNodeWithTag(TAG_COLLAPSE_SIDEBAR).performClick()
+        assertSidebar(fullscreen = true, visible = true)
+
+        // 全屏里的开关不影响窗口
+        fullScreenButton.performClick()
+        assertSidebar(fullscreen = false, visible = true)
+        onNodeWithTag(TAG_COLLAPSE_SIDEBAR).performClick()
+        assertSidebar(fullscreen = false, visible = false)
+
+        // 窗口里的开关也不影响全屏
+        fullScreenButton.performClick()
+        assertSidebar(fullscreen = true, visible = true)
+        onNodeWithTag(TAG_COLLAPSE_SIDEBAR).performClick()
+        assertSidebar(fullscreen = true, visible = false)
+        fullScreenButton.performClick()
+        assertSidebar(fullscreen = false, visible = false)
+
+        runOnIdle { assertEquals(1, playerCreatedCount) }
     }
 
     /**
```

---

### Incident Patch 2: `e3affcbd` (2026-10-04)
**Commit Message**: fix(search): 修复本地过滤空页导致搜索提前结束 (#3514)

* fix(search): continue pagination after locally filtered pages

* chore(search): remove newly added pagination tests

---------

Co-authored-by: zhenghn <[REDACTED_EMAIL]>

**File**: `app/shared/app-data/src/commonMain/kotlin/data/repository/subject/SubjectSearchRepository.kt` (modified, +2/-1)
```diff
@@ -97,7 +97,8 @@ class SubjectSearchRepository(
                 return@withContext LoadResult.Page(
                     subjectInfos,
                     prevKey = if (offset == 0) null else offset,
-                    nextKey = if (subjectInfos.isEmpty()) null else offset + params.loadSize,
+                    // 搜索响应只有 items; 用服务端原始空页判断结束, 避免本地过滤清空整页时截断结果.
+                    nextKey = if (subjects.isEmpty()) null else offset + params.loadSize,
                 )
             } catch (e: CancellationException) {
                 throw e
```

---

### Incident Patch 3: `49e7ba1c` (2026-10-04)
**Commit Message**: fix(download): 选集页快捷选择在窄屏放不下时换行 (#3523)

英文下「This episode only / This episode onwards / All」在手机宽度一行放不下, Row 把后面的 chip 挤窄,
「All」被压成竖排甚至看不见. 改为 FlowRow 换行, 并加窄屏测试.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `app/shared/ui-download/src/commonMain/kotlin/ui/download/subject/SubjectDownloadRequestDialogs.kt` (modified, +4/-1)
```diff
@@ -14,6 +14,7 @@ import androidx.compose.foundation.clickable
 import androidx.compose.foundation.layout.Arrangement
 import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.Column
+import androidx.compose.foundation.layout.FlowRow
 import androidx.compose.foundation.layout.Row
 import androidx.compose.foundation.layout.WindowInsets
 import androidx.compose.foundation.layout.add
@@ -402,9 +403,11 @@ internal fun DownloadEpisodePicker(
                 )
             }
         }
-        Row(
+        // 窄屏 (尤其英文) 一行放不下三个快捷选择时换行; 纵向 -8dp 抵消 chip 的 48dp 触控高度, 行间视觉间距与横向一致.
+        FlowRow(
             Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
             horizontalArrangement = Arrangement.spacedBy(8.dp),
+            verticalArrangement = Arrangement.spacedBy((-8).dp),
         ) {
             FilterChip(
                 selected = selected == onlyCurrent,
```

**File**: `app/shared/ui-download/src/desktopTest/kotlin/ui/download/subject/DownloadEpisodePickerTest.kt` (modified, +37/-0)
```diff
@@ -9,12 +9,18 @@
 
 package me.him188.ani.app.ui.download.subject
 
+import androidx.compose.foundation.layout.Box
+import androidx.compose.foundation.layout.width
+import androidx.compose.ui.Modifier
 import androidx.compose.ui.test.assertIsEnabled
 import androidx.compose.ui.test.assertIsNotEnabled
 import androidx.compose.ui.test.assertTextEquals
 import androidx.compose.ui.test.onNodeWithTag
 import androidx.compose.ui.test.onNodeWithText
 import androidx.compose.ui.test.performClick
+import androidx.compose.ui.unit.dp
+import java.util.Locale
+import kotlin.math.abs
 import kotlin.test.Test
 import kotlin.test.assertEquals
 import kotlin.test.assertTrue
@@ -90,4 +96,35 @@ class DownloadEpisodePickerTest {
         onNodeWithTag(DownloadEpisodePickerTestTags.BACK).performClick()
         runOnIdle { assertTrue(back) }
     }
+
+    @Test
+    fun `shortcut chips wrap instead of being squeezed on a narrow screen`() {
+        val previous = Locale.getDefault()
+        // 英文的三个快捷选择在 360dp 宽下一行放不下
+        Locale.setDefault(Locale.ENGLISH)
+        try {
+            runAniComposeUiTest {
+                setContent {
+                    ProvideCompositionLocalsForPreview {
+                        Box(Modifier.width(360.dp)) {
+                            DownloadEpisodePicker(state, onBack = {}, onConfirm = {})
+                        }
+                    }
+                }
+                val width = onNodeWithTag(DownloadEpisodePickerTestTags.ROOT).fetchSemanticsNode().boundsInRoot.width
+                val chips = listOf(
+                    DownloadEpisodePickerTestTags.ONLY_CURRENT,
+                    DownloadEpisodePickerTestTags.FROM_CURRENT,
+                    DownloadEpisodePickerTestTags.ALL,
+                ).map { onNodeWithTag(it).fetchSemanticsNode().boundsInRoot }
+                // 被挤窄的 chip 文字会逐字换行而变高, 完整显示时三个一样高
+                val heights = chips.map { it.height }
+                assertTrue(heights.all { abs(it - heights.first()) < 0.5f }, "Chip heights differ: $heights")
+                assertTrue(chips.all { it.right <= width + 0.5f }, "Chips overflow width $width: $chips")
+            }
+        } finally {
+            Locale.setDefault(previous)
+        }
+    }
 }
+
```

---

### Incident Patch 4: `6c66a99b` (2026-10-04)
**Commit Message**: fix(lang): 字符串资源不使用 Compose 不认的 \' \" 转义 (#3522)

字符串资源由 Compose Multiplatform 直接读取, 它只还原 \uXXXX、\n、\t 与 \\, \' 与 \" 会连同反斜杠原样显示
(如手动查找救援按钮显示为 "Can\'t find it?"). 撇号改为 ’, 成对引号改为 “”, 并加测试防止再写回.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `app/shared/app-lang/src/androidMain/res/values-zh-rCN/strings.xml` (modified, +2/-2)
```diff
@@ -707,7 +707,7 @@
     <string name="settings_danmaku_cancel">取消</string>
     <string name="settings_danmaku_regex_expression">正则表达式</string>
     <string name="settings_danmaku_regex_invalid">正则表达式语法不正确</string>
-    <string name="settings_danmaku_regex_description">填写用于屏蔽的正则表达式，例如：\'.*签.*\' 会屏蔽所有含有文字\'签\'的弹幕。</string>
+    <string name="settings_danmaku_regex_description">填写用于屏蔽的正则表达式，例如：“.*签.*”会屏蔽所有含有文字“签”的弹幕。</string>
     <string name="settings_danmaku_export_to_clipboard">复制规则到剪切板</string>
     <string name="settings_danmaku_import_from_clipboard">从剪切板导入规则</string>
     <string name="settings_danmaku_import_title">导入弹幕正则过滤规则</string>
@@ -770,7 +770,7 @@
 
     <!-- AutoCacheGroup -->
     <string name="settings_media_auto_cache_title">自动缓存</string>
-    <string name="settings_media_auto_cache_description">自动缓存 \"在看\" 分类中未观看的剧集</string>
+    <string name="settings_media_auto_cache_description">自动缓存“在看”分类中未观看的剧集</string>
     <string name="settings_media_auto_cache_enable">启用自动缓存</string>
     <string name="settings_media_auto_cache_max_count">最大自动缓存话数</string>
     <string name="settings_media_auto_cache_max_count_description">若手动缓存数量超过该设置值，将不会自动缓存</string>
```

**File**: `app/shared/app-lang/src/androidMain/res/values-zh-rHK/strings.xml` (modified, +3/-3)
```diff
@@ -404,7 +404,7 @@
     <!-- Storage Settings -->
     <string name="settings_storage_title">存儲設置</string>
     <string name="settings_storage_bt_cache_location">BT 影片緩存位置</string>
-    <string name="settings_storage_bt_cache_location_description">修改後不會自動遷移數據，也不會自動刪除舊數據。\n如需刪除舊數據，請在修改之前點擊\"打開 BT 緩存目錄\" 並刪除該目錄下的所有文件。\n\n重啟生效</string>
+    <string name="settings_storage_bt_cache_location_description">修改後不會自動遷移數據，也不會自動刪除舊數據。\n如需刪除舊數據，請在修改之前點擊“打開 BT 緩存目錄”並刪除該目錄下的所有文件。\n\n重啟生效</string>
     <string name="settings_storage_choose_directory">選擇影片保存目錄</string>
     <string name="settings_storage_open_directory_chooser">打開目錄選擇</string>
     <string name="settings_storage_open_bt_cache_directory">打開 BT 緩存目錄</string>
@@ -662,7 +662,7 @@
     <string name="settings_danmaku_cancel">取消</string>
     <string name="settings_danmaku_regex_expression">正則表達式</string>
     <string name="settings_danmaku_regex_invalid">正則表達式語法不正確</string>
-    <string name="settings_danmaku_regex_description">填寫用於屏蔽的正則表達式，例如：\'.*簽.*\' 會屏蔽所有含有文字\'簽\'的彈幕。</string>
+    <string name="settings_danmaku_regex_description">填寫用於屏蔽的正則表達式，例如：“.*簽.*”會屏蔽所有含有文字“簽”的彈幕。</string>
     <string name="settings_danmaku_export_to_clipboard">複製規則到剪貼板</string>
     <string name="settings_danmaku_import_from_clipboard">從剪貼板導入規則</string>
     <string name="settings_danmaku_import_title">導入彈幕正則過濾規則</string>
@@ -725,7 +725,7 @@
 
     <!-- AutoCacheGroup -->
     <string name="settings_media_auto_cache_title">自動緩存</string>
-    <string name="settings_media_auto_cache_description">自動緩存 \"在看\" 分類中未觀看的劇集</string>
+    <string name="settings_media_auto_cache_description">自動緩存“在看”分類中未觀看的劇集</string>
     <string name="settings_media_auto_cache_enable">啟用自動緩存</string>
     <string name="settings_media_auto_cache_max_count">最大自動緩存話數</string>
     <string name="settings_media_auto_cache_max_count_description">若手動緩存數量超過該設置值，將不會自動緩存</string>
```

**File**: `app/shared/app-lang/src/androidMain/res/values-zh-rTW/strings.xml` (modified, +2/-2)
```diff
@@ -662,7 +662,7 @@
     <string name="settings_danmaku_cancel">取消</string>
     <string name="settings_danmaku_regex_expression">正則表達式</string>
     <string name="settings_danmaku_regex_invalid">正則表達式語法不正確</string>
-    <string name="settings_danmaku_regex_description">填寫用於屏蔽的正則表達式，例如：\'.*簽.*\' 會屏蔽所有含有文字\'簽\'的彈幕。</string>
+    <string name="settings_danmaku_regex_description">填寫用於屏蔽的正則表達式，例如：“.*簽.*”會屏蔽所有含有文字“簽”的彈幕。</string>
     <string name="settings_danmaku_export_to_clipboard">複製規則到剪貼板</string>
     <string name="settings_danmaku_import_from_clipboard">從剪貼板導入規則</string>
     <string name="settings_danmaku_import_title">導入彈幕正則過濾規則</string>
@@ -725,7 +725,7 @@
 
     <!-- AutoCacheGroup -->
     <string name="settings_media_auto_cache_title">自動快取</string>
-    <string name="settings_media_auto_cache_description">自動快取 \"在看\" 分類中未觀看的劇集</string>
+    <string name="settings_media_auto_cache_description">自動快取“在看”分類中未觀看的劇集</string>
     <string name="settings_media_auto_cache_enable">啟用自動快取</string>
     <string name="settings_media_auto_cache_max_count">最大自動快取話數</string>
     <string name="settings_media_auto_cache_max_count_description">若手動快取數量超過該設定值，將不會自動快取</string>
```

**File**: `app/shared/app-lang/src/androidMain/res/values/strings.xml` (modified, +25/-25)
```diff
@@ -52,7 +52,7 @@
     <string name="settings_tab_danmaku">Server Region</string>
     <string name="settings_tab_proxy">Proxy</string>
     <string name="settings_tab_bt">BitTorrent</string>
-    <string name="settings_pikpak_description">Resolve BitTorrent magnets through PikPak\'s cloud offline servers for faster playback. Premium subscription is required.\nThe anitorrent settings above do not apply to PikPak.</string>
+    <string name="settings_pikpak_description">Resolve BitTorrent magnets through PikPak’s cloud offline servers for faster playback. Premium subscription is required.\nThe anitorrent settings above do not apply to PikPak.</string>
     <string name="settings_pikpak_enabled">Enable PikPak</string>
     <string name="settings_pikpak_username">Username</string>
     <string name="settings_pikpak_username_placeholder">Email or phone</string>
@@ -249,7 +249,7 @@
     <string name="settings_mediasource_selector_config_request_interval">Search request interval (ms)</string>
     <string name="settings_mediasource_selector_config_request_interval_description">Controls how long to wait after sending each request before sending the next one</string>
     <string name="settings_mediasource_selector_config_search_cache_ttl">Search cache duration (minutes)</string>
-    <string name="settings_mediasource_selector_config_search_cache_ttl_description">Reuse search results when switching episodes within this duration. The effective value is the smaller of this and the user\'s setting. 0 disables caching</string>
+    <string name="settings_mediasource_selector_config_search_cache_ttl_description">Reuse search results when switching episodes within this duration. The effective value is the smaller of this and the user’s setting. 0 disables caching</string>
     <string name="settings_mediasource_selector_config_filter_settings">Filter settings</string>
     <string name="settings_mediasource_selector_config_filter_by_subject_name">Filter by item name</string>
     <string name="settings_mediasource_selector_config_filter_by_subject_name_description">Require the resource title to contain the item name. Useful when the source may return irrelevant results. This only works in versions before 4.4.0 and has no effect in other versions</string>
@@ -289,15 +289,15 @@
     <string name="settings_mediasource_selector_episode_lists_label">Extract a list of episode panels from the page</string>
     <string name="settings_mediasource_selector_episode_lists_supporting">CSS selector expression. Expected to return some &lt;div&gt; elements, each corresponding to an episode panel. The panel typically contains 1–12 episode buttons</string>
     <string name="settings_mediasource_selector_episodes_from_list_label">Extract the episode list from each panel</string>
-    <string name="settings_mediasource_selector_episodes_from_list_supporting">CSS selector expression. Expected to return some elements, each of which will have its text used as the episode name.\nIf the element is &lt;a&gt;, its href will be read as the episode link by default. Alternatively, you can configure the following settings to extract the link in a different way.\nIf the element is not &lt;a&gt;, i.e. the name and link are not in the same element, you\'ll need to configure the following settings to extract the link.</string>
+    <string name="settings_mediasource_selector_episodes_from_list_supporting">CSS selector expression. Expected to return some elements, each of which will have its text used as the episode name.\nIf the element is &lt;a&gt;, its href will be read as the episode link by default. Alternatively, you can configure the following settings to extract the link in a different way.\nIf the element is not &lt;a&gt;, i.e. the name and link are not in the same element, you’ll need to configure the following settings to extract the link.</string>
     <string name="settings_mediasource_selector_episode_links_from_list_label">Extract a list of episode links from the panel (optional)</string>
-    <string name="settings_mediasource_selector_episode_links_from_list_supporting">An optional CSS selector expression. If the previously extracted episode elements are not &lt;a&gt;, you\'ll need to configure this to extract the links.</string>
+    <string name="settings_mediasource_selector_episode_links_from_list_supporting">An optional CSS selector expression. If the previously extracted episode elements are not &lt;a&gt;, you’ll need to configure this to extract the links.</string>
     <string name="settings_mediasource_selector_match_episode_sort_from_name_label">Match the episode number from the episode name</string>
     <string name="settings_mediasource_selector_match_episode_sort_from_name_supporting">A regular expression search. A group named ep is expected, ideally numeric.</string>
     <string name="settings_mediasource_selector_episodes_label">Extract the episode list</string>
-    <string name="settings_mediasource_selector_episodes_
```

**File**: `app/shared/app-lang/src/desktopTest/kotlin/StringResourceEscapesTest.kt` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+/*
+ * Copyright (C) 2024-2026 OpenAni and contributors.
+ *
+ * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
+ * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
+ *
+ * https://github.com/open-ani/ani/blob/main/LICENSE
+ */
+
+package me.him188.ani.app.ui.lang
+
+import java.io.File
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertTrue
+
+/**
+ * 字符串资源由 Compose Multiplatform 直接读取 (见 build.gradle.kts 的 `customDirectory`), 它只还原 `\uXXXX`、`\n`、`\t` 与 `\\`.
+ * Android 风格的 `\'`、`\"`、`\@`、`\?` 在 Android 上正常, 在 Compose 资源里会连同反斜杠原样显示.
+ * 撇号与引号直接写成 `’`、`“”` 等字符.
+ */
+class StringResourceEscapesTest {
+    @Test
+    fun `strings use only escapes compose resources understand`() {
+        val files = File("src/androidMain/res").walk().filter { it.name == "strings.xml" }.toList()
+        assertTrue(files.isNotEmpty(), "No strings.xml found under ${File("src/androidMain/res").absolutePath}")
+
+        val offenders = files.flatMap { file ->
+            file.readLines().withIndex()
+                .filter { (_, line) -> UNSUPPORTED_ESCAPE.containsMatchIn(line) }
+                .map { (index, _) -> "${file.parentFile.name}/${file.name}:${index + 1}" }
+        }
+        assertEquals(emptyList(), offenders)
+    }
+
+    private companion object {
+        /**
+         * 前面不是反斜杠的 `\'`、`\"`、`\@`、`\?`; `\\` 是已转义的反斜杠, 不算.
+         */
+        val UNSUPPORTED_ESCAPE = Regex("""(?<!\\)\\['"@?]""")
+    }
+}
```

---

### Incident Patch 5: `71619a8f` (2026-10-04)
**Commit Message**: Fix desktop fullscreen sidebar toggle (#3510)

Co-authored-by: openanibot <[REDACTED_EMAIL]>

**File**: `app/shared/src/commonMain/kotlin/ui/subject/episode/EpisodePage.kt` (modified, +6/-6)
```diff
@@ -512,12 +512,12 @@ private fun EpisodeScreenBody(
         vm.isFullscreen -> fullscreenVideoWindowInsets(compactWindowInsets)
         else -> compactWindowInsets
     }
-    val mode = when {
-        vm.isFullscreen -> EpisodeScreenLayoutMode.VIDEO_ONLY
-        !showExpandedUI -> EpisodeScreenLayoutMode.COMPACT
-        vm.sidebarVisible -> EpisodeScreenLayoutMode.WIDE
-        else -> EpisodeScreenLayoutMode.VIDEO_ONLY
-    }
+    val mode = episodeScreenLayoutMode(
+        isFullscreen = vm.isFullscreen,
+        showExpandedUI = showExpandedUI,
+        sidebarVisible = vm.sidebarVisible,
+        isDesktop = LocalPlatform.current.isDesktop(),
+    )
 
     EpisodeScreenLayout(
         mode,
```

**File**: `app/shared/src/commonMain/kotlin/ui/subject/episode/EpisodeScreenLayout.kt` (modified, +13/-0)
```diff
@@ -36,6 +36,19 @@ enum class EpisodeScreenLayoutMode {
     WIDE,
 }
 
+/** 桌面端宽屏布局在全屏时也由侧边栏开关决定是否显示次要内容. */
+internal fun episodeScreenLayoutMode(
+    isFullscreen: Boolean,
+    showExpandedUI: Boolean,
+    sidebarVisible: Boolean,
+    isDesktop: Boolean,
+): EpisodeScreenLayoutMode = when {
+    isFullscreen && (!isDesktop || !showExpandedUI) -> EpisodeScreenLayoutMode.VIDEO_ONLY
+    !showExpandedUI -> EpisodeScreenLayoutMode.COMPACT
+    sidebarVisible -> EpisodeScreenLayoutMode.WIDE
+    else -> EpisodeScreenLayoutMode.VIDEO_ONLY
+}
+
 /**
  * 播放页布局: 播放器和它旁边的次要内容 (窄屏时是下方的详情与评论, 宽屏时是右侧的侧边栏).
  *
```

**File**: `app/shared/src/desktopTest/kotlin/ui/subject/episode/EpisodeScreenLayoutTest.kt` (modified, +22/-0)
```diff
@@ -100,6 +100,28 @@ class EpisodeScreenLayoutTest {
         onNodeWithTag(TAG_SECONDARY).assertBounds(WIDTH - sidebarWidth, 0.dp, sidebarWidth, HEIGHT)
     }
 
+    @Test
+    fun `mobile fullscreen hides secondary content regardless of sidebar preference`() {
+        for (expanded in listOf(false, true)) {
+            for (sidebarVisible in listOf(false, true)) {
+                assertEquals(
+                    EpisodeScreenLayoutMode.VIDEO_ONLY,
+                    episodeScreenLayoutMode(true, expanded, sidebarVisible, isDesktop = false),
+                )
+            }
+        }
+    }
+
+    @Test
+    fun `compact desktop fullscreen only shows video`() {
+        for (sidebarVisible in listOf(false, true)) {
+            assertEquals(
+                EpisodeScreenLayoutMode.VIDEO_ONLY,
+                episodeScreenLayoutMode(true, false, sidebarVisible, isDesktop = true),
+            )
+        }
+    }
+
     @Test
     fun `video only fills the layout without secondary`() = runAniComposeUiTest {
         mode = EpisodeScreenLayoutMode.VIDEO_ONLY
```

**File**: `app/shared/src/desktopTest/kotlin/ui/subject/episode/EpisodeVideoControllerTest.kt` (modified, +52/-2)
```diff
@@ -11,6 +11,7 @@ package me.him188.ani.app.ui.subject.episode
 
 import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.fillMaxSize
+import androidx.compose.foundation.layout.requiredSize
 import androidx.compose.foundation.layout.size
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.CompositionLocalProvider
@@ -249,6 +250,8 @@ class EpisodeVideoControllerTest {
         isInPictureInPicture: Boolean = false,
         danmakuEnabled: Boolean = false,
         danmakuHost: @Composable () -> Unit = {},
+        sidebarVisible: Boolean = true,
+        onToggleSidebar: (Boolean) -> Unit = {},
     ) {
         ProvideCompositionLocalsForPreview(darkMode = DarkMode.DARK) {
             val actualWatchTogetherPlayerController = watchTogetherPlayerController
@@ -312,8 +315,8 @@ class EpisodeVideoControllerTest {
                             showFramePreviewInPopup = expanded,
                         )
                     },
-                    sidebarVisible = true,
-                    onToggleSidebar = {},
+                    sidebarVisible = sidebarVisible,
+                    onToggleSidebar = onToggleSidebar,
                     progressSliderState = progressSliderState,
                     cacheProgressInfoFlow = cacheProgressInfoFlow,
                     framePreview = framePreview,
@@ -414,6 +417,53 @@ class EpisodeVideoControllerTest {
         onNodeWithTag("danmakuHost").assertIsDisplayed()
     }
 
+    @Test
+    fun `desktop sidebar toggles before during and after fullscreen`() = runAniComposeUiTest {
+        var sidebarVisible by mutableStateOf(true)
+        val fullscreenState = TestFullscreenState(initialIsFullscreen = false)
+        val visibleControllerState = PlayerControllerState(NORMAL_VISIBLE)
+        var playerCreatedCount = 0
+        setContent {
+            EpisodeScreenLayout(
+                mode = episodeScreenLayoutMode(
+                    isFullscreen = fullscreenState.isFullscreen,
+                    showExpandedUI = true,
+                    sidebarVisible = sidebarVisible,
+                    isDesktop = true,
+                ),
+                video = {
+                    Player(
+                        GestureFamily.MOUSE,
+                        playerControllerState = visibleControllerState,
+                        fullscreenState = fullscreenState,
+                        sidebarVisible = sidebarVisible,
+                        onToggleSidebar = { sidebarVisible = it },
+                        onPlayerStateCreated = { playerCreatedCount++ },
+                    )
+                },
+                secondary = { Box(Modifier.fillMaxSize().testTag("sidebar")) },
+                modifier = Modifier.requiredSize(1000.dp, 600.dp),
+            )
+        }
+
+        for (fullscreen in listOf(false, true, false, true)) {
+            if (fullscreenState.isFullscreen != fullscreen) {
+                fullScreenButton.performClick()
+            }
+            onNodeWithTag("sidebar").assertWidthIsEqualTo(340.dp)
+            player.assertWidthIsEqualTo(660.dp)
+            onNodeWithTag(TAG_COLLAPSE_SIDEBAR).performClick()
+            onNodeWithTag("sidebar").assertDoesNotExist()
+            player.assertWidthIsEqualTo(1000.dp)
+            onNodeWithTag(TAG_COLLAPSE_SIDEBAR).performClick()
+            onNodeWithTag("sidebar").assertWidthIsEqualTo(340.dp)
+            runOnIdle {
+                assertEquals(fullscreen, fullscreenState.isFullscreen)
+                assertEquals(1, playerCreatedCount)
+            }
+        }
+    }
+
     /**
      * 记录每一次真正生效的全屏请求. 幂等地被忽略掉的请求 (已在目标状态) 不记录.
      */
```

---

### Incident Patch 6: `184badb6` (2026-10-03)
**Commit Message**: fix(player): 播放器的状态栏 padding 始终挂载, 修复 iOS 退出全屏后状态栏间距消失

播放器节点在进出全屏时保持不变, 状态栏 padding 原先随 expanded 增删. Compose Multiplatform 在 iOS 上
把 statusBarsPadding() 实现为两个节点, 读取 insets 的节点挂载时通过 traverseAncestors 查找自己的 padding 节点.
它被插入已挂载的节点链时, 链头的 aggregateChildKindSet 尚未包含新节点, 查找会跳过所在的链,
padding 一直是 0.

改用带 WindowInsets 参数的 windowInsetsPadding, 全屏时传入空 insets, 节点结构不随全屏状态变化.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `app/shared/src/commonMain/kotlin/ui/subject/episode/EpisodePage.kt` (modified, +5/-1)
```diff
@@ -25,6 +25,7 @@ import androidx.compose.foundation.layout.imePadding
 import androidx.compose.foundation.layout.only
 import androidx.compose.foundation.layout.padding
 import androidx.compose.foundation.layout.safeContent
+import androidx.compose.foundation.layout.statusBars
 import androidx.compose.foundation.layout.statusBarsPadding
 import androidx.compose.foundation.layout.systemBars
 import androidx.compose.foundation.layout.union
@@ -1295,7 +1296,10 @@ private fun EpisodeVideo(
         onClickCache = { navigator.navigateSubjectCaches(vm.subjectId) },
         modifier = modifier
             .fillMaxWidth().background(Color.Black)
-            .then(if (expanded) Modifier.fillMaxSize() else Modifier.statusBarsPadding()),
+            // 播放器节点在进出全屏时保持不变, 状态栏 padding 必须始终挂载, 只切换 insets 的值.
+            // iOS 上 statusBarsPadding() 被插入已挂载的节点时找不到自己的 padding 节点, padding 会一直是 0.
+            .windowInsetsPadding(if (expanded) WindowInsets(0.dp) else WindowInsets.statusBars)
+            .then(if (expanded) Modifier.fillMaxSize() else Modifier),
         maintainAspectRatio = maintainAspectRatio,
         contentWindowInsets = windowInsets,
         fastForwardSpeed = vm.videoScaffoldConfig.fastForwardSpeed,
```

---

### Incident Patch 7: `29ef23de` (2026-10-03)
**Commit Message**: fix(player): 画质增强的缩放着色器自行跟随视口尺寸, 修复 Android 切换全屏后播放卡死

开启「预先加载画质增强着色器」和画质增强后, 切换全屏会在短时间内连续报告多个视口尺寸
(如 60x33 的过渡尺寸和最终尺寸), 每个尺寸都用新的缩放效果调用一次 ExoPlayer.setVideoEffects.
Media3 在上一次效果切换的帧渲染完之前收到下一次切换时, 播放线程会阻塞在
DefaultVideoFrameProcessor.registerInputStream, 而渲染这些帧的正是播放线程, 于是死锁.
10 秒后以 StuckPlayerException 报错并自动切换到其他数据源, 新的数据源也无法开始播放.

- DesktopStyleLanczosSharpEffect: 视口尺寸是可更新的状态, 着色器在下一帧按新尺寸重建输出纹理
- ExoPlayerVideoEnhancementController: 只有切换模式才替换效果列表, 视口变化只更新缩放效果的尺寸

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `app/shared/video-player/src/androidHostTest/kotlin/videoenhancement/VideoEnhancementControllerTest.kt` (modified, +24/-3)
```diff
@@ -12,6 +12,7 @@
 package me.him188.ani.app.videoplayer.videoenhancement
 
 import androidx.media3.common.Effect
+import androidx.media3.common.util.Size
 import kotlinx.coroutines.ExperimentalCoroutinesApi
 import kotlinx.coroutines.flow.flowOf
 import kotlinx.coroutines.test.runCurrent
@@ -25,7 +26,7 @@ import kotlin.test.assertIs
 
 class VideoEnhancementControllerTest {
     @Test
-    fun metadataChangesDoNotRebuildQualityShaders() = runTest {
+    fun onlyModeChangesReplaceEffects() = runTest {
         val player = TestMediampPlayer(backgroundScope.coroutineContext)
         val effects = mutableListOf<List<Effect>>()
         val controller = ExoPlayerVideoEnhancementController(
@@ -37,7 +38,8 @@ class VideoEnhancementControllerTest {
             runCurrent()
             assertEquals(1, effects.size)
             assertEquals(3, effects.single().size)
-            assertIs<DesktopStyleLanczosSharpEffect>(effects.single().last())
+            val scaler = assertIs<DesktopStyleLanczosSharpEffect>(effects.single().last())
+            assertEquals(VideoDimensions(1920, 1080), scaler.viewportSize)
 
             player.setMediaData(UriMediaData("file:///test.mp4"))
             runCurrent()
@@ -51,9 +53,20 @@ class VideoEnhancementControllerTest {
             runCurrent()
             assertEquals(1, effects.size, "Metadata loss and recovery must retain compiled shaders")
 
+            // A fullscreen switch reports intermediate layout sizes in quick succession.
+            controller.setViewportSize(60, 33)
+            runCurrent()
             controller.setViewportSize(2560, 1440)
             runCurrent()
-            assertEquals(2, effects.size, "A viewport resize must update the scaler")
+            assertEquals(1, effects.size, "A viewport resize must not replace the effect list")
+            assertEquals(VideoDimensions(2560, 1440), scaler.viewportSize)
+
+            controller.setMode(VideoEnhancementMode.PERFORMANCE)
+            runCurrent()
+            assertEquals(2, effects.size)
+            val performanceScaler = assertIs<DesktopStyleLanczosSharpEffect>(effects.last().last())
+            assertEquals(VideoDimensions(2560, 1440), performanceScaler.viewportSize)
+
             controller.setMode(VideoEnhancementMode.OFF)
             runCurrent()
             assertEquals(emptyList(), effects.last())
@@ -62,4 +75,12 @@ class VideoEnhancementControllerTest {
             player.close()
         }
     }
+
+    @Test
+    fun scalerOutputFitsViewport() {
+        assertEquals(Size(1920, 1080), lanczosSharpOutputSize(1280, 720, VideoDimensions(1920, 1080)))
+        assertEquals(Size(1920, 1080), lanczosSharpOutputSize(1280, 720, VideoDimensions(2400, 1080)))
+        assertEquals(Size(1080, 608), lanczosSharpOutputSize(1920, 1080, VideoDimensions(1080, 608)))
+        assertEquals(Size(1280, 720), lanczosSharpOutputSize(1280, 720, viewport = null))
+    }
 }
```

**File**: `app/shared/video-player/src/androidMain/kotlin/videoenhancement/DesktopStyleLanczosSharpEffect.kt` (modified, +52/-15)
```diff
@@ -13,6 +13,8 @@ package me.him188.ani.app.videoplayer.videoenhancement
 
 import android.content.Context
 import android.opengl.GLES20
+import androidx.media3.common.GlObjectsProvider
+import androidx.media3.common.GlTextureInfo
 import androidx.media3.common.VideoFrameProcessingException
 import androidx.media3.common.util.GlProgram
 import androidx.media3.common.util.GlUtil
@@ -28,19 +30,24 @@ import kotlin.math.roundToInt
  *
  * It uses mpv's Jinc radius and sharp blur, sigmoid upscaling, and 0.7 anti-ringing while
  * avoiding a second full-size intermediate texture on mobile GPUs.
+ *
+ * The output is the input scaled to fit [viewportSize], or the input size while it is `null`.
+ * [viewportSize] may be updated from any thread while the effect is in use: the shader program
+ * resizes its output on the next frame. Replacing the effect through `ExoPlayer.setVideoEffects`
+ * to resize is unsafe, because Media3 blocks the playback thread when a second effect change
+ * arrives before the frames of the previous one are rendered.
  */
-internal class DesktopStyleLanczosSharpEffect(
-    private val viewportWidth: Int,
-    private val viewportHeight: Int,
-) : GlEffect {
+internal class DesktopStyleLanczosSharpEffect : GlEffect {
+    @Volatile
+    var viewportSize: VideoDimensions? = null
+
     override fun toGlShaderProgram(context: Context, useHdr: Boolean): GlShaderProgram =
-        DesktopStyleLanczosSharpShaderProgram(context, viewportWidth, viewportHeight)
+        DesktopStyleLanczosSharpShaderProgram(context) { viewportSize }
 }
 
 private class DesktopStyleLanczosSharpShaderProgram(
     context: Context,
-    private val viewportWidth: Int,
-    private val viewportHeight: Int,
+    private val viewportSize: () -> VideoDimensions?,
 ) : BaseGlShaderProgram(
     /* useHighPrecisionColorComponents = */ true,
     /* texturePoolCapacity = */ 1,
@@ -61,18 +68,33 @@ private class DesktopStyleLanczosSharpShaderProgram(
 
     private var inputWidth = 0
     private var inputHeight = 0
+    private var configuredViewport: VideoDimensions? = null
+
+    override fun queueInputFrame(
+        glObjectsProvider: GlObjectsProvider,
+        inputTexture: GlTextureInfo,
+        presentationTimeUs: Long,
+    ) {
+        if (viewportSize() != configuredViewport) {
+            // BaseGlShaderProgram calls configure() again once its output textures are deleted.
+            // A frame is only queued while the single output texture is free, so nothing
+            // downstream is using it.
+            try {
+                super.release()
+            } catch (e: VideoFrameProcessingException) {
+                onError(e)
+                return
+            }
+        }
+        super.queueInputFrame(glObjectsProvider, inputTexture, presentationTimeUs)
+    }
 
     override fun configure(inputWidth: Int, inputHeight: Int): Size {
         this.inputWidth = inputWidth
         this.inputHeight = inputHeight
-        val scale = minOf(
-            viewportWidth.toDouble() / inputWidth,
-            viewportHeight.toDouble() / inputHeight,
-        )
-        return Size(
-            (inputWidth * scale).roundToInt().coerceAtLeast(1),
-            (inputHeight * scale).roundToInt().coerceAtLeast(1),
-        )
+        val viewport = viewportSize()
+        configuredViewport = viewport
+        return lanczosSharpOutputSize(inputWidth, inputHeight, viewport)
     }
 
     override fun drawFrame(inputTexId: Int, presentationTimeUs: Long) {
@@ -102,6 +124,21 @@ private class DesktopStyleLanczosSharpShaderProgram(
 }
 
 
+/**
+ * The size of [inputWidth] x [inputHeight] scaled to fit [viewport] while keeping its aspect ratio.
+ */
+internal fun lanczosSharpOutputSize(inputWidth: Int, inputHeight: Int, viewport: VideoDimensions?): Size {
+    if (viewport == null) return Size(inputWidth, inputHeight)
+    val scale = minOf(
+        viewport.width.toDouble() / inputWidth,
+        viewport.height.toDouble() / inputHeight,
+    )
+    return Size(
+        (inputWidth * scale).roundToInt().coerceAtLeast(1),
+        (inputHeight * scale).roundToInt().coerceAtLeast(1),
+    )
+}
+
 private class LanczosSharpShaderSources(context: Context) {
     val vertexShader = VideoEnhancementShaderProvider.getShaderSource(
         context,
```

**File**: `app/shared/video-player/src/androidMain/kotlin/videoenhancement/VideoEnhancementController.android.kt` (modified, +19/-19)
```diff
@@ -42,9 +42,11 @@ internal class ExoPlayerVideoEnhancementController(
     parentCoroutineContext: CoroutineContext,
 ) : BaseVideoEnhancementController(player, parentCoroutineContext) {
     private var appliedMode = VideoEnhancementMode.OFF
-    private var scalerApplied = false
-    private var appliedWidth = 0
-    private var appliedHeight = 0
+
+    /**
+     * The scaler of the applied effect list, or `null` while the mode is [VideoEnhancementMode.OFF].
+     */
+    private var appliedScaler: DesktopStyleLanczosSharpEffect? = null
 
     init {
         // Media3 requires the effect graph to exist before the first prepare in order to
@@ -67,14 +69,18 @@ internal class ExoPlayerVideoEnhancementController(
             return
         }
 
-        // The shader receives input dimensions in configure(). Metadata availability must not
-        // rebuild the effect graph: compiling the quality shaders can stall playback.
-        val shouldApplyScaler = viewportSize != null
-        if (
-            appliedMode == mode && scalerApplied == shouldApplyScaler &&
-            (!shouldApplyScaler || appliedWidth == viewportSize.width && appliedHeight == viewportSize.height)
-        ) return
+        // Only a mode change replaces the effect list. The shaders receive input dimensions in
+        // configure() and the scaler follows the viewport by itself, so neither metadata
+        // availability nor a viewport resize rebuilds the effect graph: compiling the quality
+        // shaders can stall playback, and Media3 deadlocks the playback thread when effect lists
+        // are replaced in quick succession, as the intermediate layout sizes of a fullscreen
+        // switch would do.
+        if (appliedMode == mode) {
+            appliedScaler?.viewportSize = viewportSize
+            return
+        }
 
+        val scaler = DesktopStyleLanczosSharpEffect().apply { this.viewportSize = viewportSize }
         setVideoEffects(
             buildList {
                 when (mode) {
@@ -85,24 +91,18 @@ internal class ExoPlayerVideoEnhancementController(
                         add(Anime4kUpscaleQualityEffect)
                     }
                 }
-                if (shouldApplyScaler) {
-                    add(DesktopStyleLanczosSharpEffect(viewportSize.width, viewportSize.height))
-                }
+                add(scaler)
             },
         )
         appliedMode = mode
-        scalerApplied = shouldApplyScaler
-        appliedWidth = if (shouldApplyScaler) viewportSize.width else 0
-        appliedHeight = if (shouldApplyScaler) viewportSize.height else 0
+        appliedScaler = scaler
     }
 
     override fun restore() {
         if (appliedMode == VideoEnhancementMode.OFF) return
         setVideoEffects(emptyList())
         appliedMode = VideoEnhancementMode.OFF
-        scalerApplied = false
-        appliedWidth = 0
-        appliedHeight = 0
+        appliedScaler = null
     }
 }
 
```

---

### Incident Patch 8: `36e14d0e` (2026-10-03)
**Commit Message**: fix(image-viewer): Always use dark caption theme in image viewer window.

**File**: `app/shared/ui-foundation/src/desktopMain/kotlin/ui/foundation/ImageViewer.desktop.kt` (modified, +3/-3)
```diff
@@ -16,13 +16,12 @@ import androidx.compose.runtime.Composable
 import androidx.compose.runtime.CompositionLocalProvider
 import androidx.compose.runtime.DisposableEffect
 import androidx.compose.runtime.LaunchedEffect
-import androidx.compose.runtime.LaunchedEffect
 import androidx.compose.runtime.getValue
 import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.remember
 import androidx.compose.runtime.rememberCoroutineScope
-import androidx.compose.runtime.setValue
 import androidx.compose.runtime.rememberUpdatedState
+import androidx.compose.runtime.setValue
 import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.draganddrop.DragAndDropSourceModifierNode
@@ -69,7 +68,7 @@ import kotlinx.coroutines.withTimeoutOrNull
 import me.him188.ani.app.platform.PlatformWindow
 import me.him188.ani.app.platform.window.MacTrackpadGestures
 import me.him188.ani.app.platform.window.rememberLayoutHitTestOwner
-import me.him188.ani.app.ui.foundation.LocalSketch
+import me.him188.ani.app.ui.foundation.effects.OverrideCaptionButtonAppearance
 import me.him188.ani.app.ui.foundation.imageviewer.FileKitImageFileSaver
 import me.him188.ani.app.ui.foundation.imageviewer.ImageViewerContent
 import me.him188.ani.app.ui.foundation.imageviewer.ImageViewerExportedFile
@@ -213,6 +212,7 @@ private fun ImageViewerWindow(
         val window = this.window
         val saveDialogTitle = stringResource(Lang.image_viewer_save)
         val content: @Composable () -> Unit = {
+            OverrideCaptionButtonAppearance(true)
             ImageViewerContent(
                 model = model,
                 onClose = onClose,
```

---

### Incident Patch 9: `c173844a` (2026-10-01)
**Commit Message**: feat(player): filter hls ads by pts continuity and align timestamps (#3471)

* feat(player): filter hls ads by pts continuity and align timestamps

Aggregator sites splice ads into HLS playlists at #EXT-X-DISCONTINUITY
boundaries. The ads are transcoded separately, so their PTS starts a new
timeline instead of continuing the main content. Decide ads by that alone:
chain groups whose first PTS continues the previous main group, and treat
off-chain groups that look like separate encodes as ads. Size-based rules
removed six main-content fragments on 48 labelled samples and are dropped
entirely.

The chain extends in both directions, picks the longest chain as main
content, treats the cursor after unprobed groups as a range, and never
removes a group whose probe failed. An off-chain group is an ad only if its
timeline starts within 10 seconds or it continues the previous ad: some
sources cut the main content from its original timeline, leaving off-chain
main parts that start mid-timeline. The first group is never removed, since
main content also starts at zero. A run of ads longer than 60 seconds is
kept, since separately encoded main parts also start a new timeline.
Encrypted playlist

**File**: `app/desktop/src/main/kotlin/DesktopModules.kt` (modified, +2/-1)
```diff
@@ -150,7 +150,8 @@ fun getDesktopModules(getContext: () -> DesktopContext, scope: CoroutineScope) =
     single<BrowserNavigator> { DesktopBrowserNavigator() }
     single<CaptchaBrowserFactory> { DesktopCaptchaBrowserFactory() }
     single<ImageCaptchaRecognizer> { DesktopOnnxImageCaptchaRecognizer() }
-    single<HlsPlaybackPreparer> { PlatformHlsPlaybackPreparer(get()) }
+    // 桌面端用 mpv 播放, libavformat 不按 discontinuity 重映射时间戳, 需要代理对齐
+    single<HlsPlaybackPreparer> { PlatformHlsPlaybackPreparer(get(), alignTimestamps = true) }
     factory<MediaResolver> {
         MediaResolver.from(
             torrentMediaResolvers(get<TorrentManager>().engines, get())
```

**File**: `app/shared/app-data/src/commonMain/kotlin/data/models/preference/VideoScaffoldConfig.kt` (modified, +7/-4)
```diff
@@ -120,11 +120,14 @@ data class VideoScaffoldConfig @SerializationOnly constructor(
      */
     val enableHighQualityAudioTimeStretch: Boolean = true,
     /**
-     * 过滤 HLS 播放列表中的插播片段.
+     * 过滤 HLS 播放列表中的插播广告, 见 `HlsManifestFilter`.
      *
-     * @since 5.7
+     * 5.7 至 6.1 的同类开关是默认关闭的 `enableExperimentalHlsSegmentFiltering`, 已不再读取:
+     * 换用新字段, 所有用户按新的默认值启用.
+     *
+     * @since 6.2
      */
-    val enableExperimentalHlsSegmentFiltering: Boolean = false,
+    val enableHlsAdFiltering: Boolean = true,
     /**
      * 用于在安卓上设置屏幕刷新率, 解决某些设备会自动限制刷新率的问题 (三星).
      *
@@ -265,7 +268,7 @@ data class VideoScaffoldConfig @SerializationOnly constructor(
             autoSkipOpEd = false,
             autoSwitchMediaOnPlayerError = false,
             enableHighQualityAudioTimeStretch = false,
-            enableExperimentalHlsSegmentFiltering = false,
+            enableHlsAdFiltering = false,
             backgroundBehavior = BackgroundBehavior.PAUSE,
         )
     }
```

**File**: `app/shared/app-data/src/commonMain/kotlin/domain/episode/EpisodeFetchSelectPlayState.kt` (modified, +28/-1)
```diff
@@ -36,7 +36,9 @@ import kotlinx.coroutines.sync.Mutex
 import kotlinx.coroutines.sync.withLock
 import kotlinx.coroutines.withContext
 import me.him188.ani.app.data.repository.media.SelectorMediaSourceEpisodeCacheRepository
+import me.him188.ani.app.data.repository.player.EpisodePlayHistoryRepository
 import me.him188.ani.app.domain.foundation.LoadError
+import me.him188.ani.app.domain.media.hls.HlsPlaybackPreparer
 import me.him188.ani.app.domain.media.fetch.MediaFetchSession
 import me.him188.ani.app.domain.media.fetch.MediaSourceManager
 import me.him188.ani.app.domain.media.fetch.createFetchFetchSession
@@ -49,10 +51,12 @@ import me.him188.ani.app.domain.player.extension.ExtensionBackgroundTaskScope
 import me.him188.ani.app.domain.player.extension.PlayerExtension
 import me.him188.ani.app.domain.player.extension.PlayerExtensionEvent
 import me.him188.ani.app.domain.usecase.GlobalKoin
+import me.him188.ani.app.domain.watchtogether.PlaybackAutomationGate
 import me.him188.ani.utils.analytics.Analytics
 import me.him188.ani.utils.analytics.AnalyticsEvent.Companion.EpisodeSwitch
 import me.him188.ani.utils.logging.info
 import me.him188.ani.utils.logging.logger
+import me.him188.ani.utils.logging.warn
 import org.koin.core.Koin
 import org.openani.mediamp.MediampPlayer
 import kotlin.coroutines.AbstractCoroutineContextElement
@@ -96,6 +100,8 @@ class EpisodeFetchSelectPlayState(
 
     private val selectorCacheRepo by koin.inject<SelectorMediaSourceEpisodeCacheRepository>()
     private val mediaSourceManager by koin.inject<MediaSourceManager>()
+    private val playHistoryRepository by koin.inject<EpisodePlayHistoryRepository>()
+    private val automationGate by koin.inject<PlaybackAutomationGate>()
 
     /**
      * 条目级查询会话, 各集共用: 切集只重建选择器, 不重新查询.
@@ -322,7 +328,11 @@ class EpisodeFetchSelectPlayState(
                                 .first()
                                 .episodeInfo
 
-                            playerSession.loadMedia(media, episodeInfo.toEpisodeMetadata())
+                            playerSession.loadMedia(
+                                media,
+                                episodeInfo.toEpisodeMetadata(),
+                                startPositionHintMillis(episodeInfo.episodeId),
+                            )
                             onMediaLoaded(episodeInfo.episodeId)
                         }
                     }
@@ -331,6 +341,23 @@ class EpisodeFetchSelectPlayState(
         }
     }
 
+    /**
+     * 续播的起点, 供 HLS 代理在起播前预缓存那里的分片 (见 [HlsPlaybackPreparer.prepare]).
+     * 跳转仍由 RememberPlayProgressExtension 在播放开始后执行, 这里与它读同一份进度; 一起看时它不续播, 这里也不给.
+     * 读取失败只是少了预缓存, 不影响加载.
+     */
+    private suspend fun startPositionHintMillis(episodeId: Int): Long? {
+        if (automationGate.suppressed.value) return null
+        return try {
+            playHistoryRepository.getResumePositionMillisByEpisodeId(episodeId)
+        } catch (e: CancellationException) {
+            throw e
+        } catch (e: Exception) {
+            logger.warn(e) { "Failed to read play progress of episode $episodeId for HLS start position hint" }
+            null
+        }
+    }
+
     private companion object {
         private val logger = logger<EpisodeFetchSelectPlayState>()
     }
```

**File**: `app/shared/app-data/src/commonMain/kotlin/domain/episode/PlayerSession.kt` (modified, +11/-5)
```diff
@@ -108,8 +108,14 @@ class PlayerSession(
 
     /**
      * 解析 media 并开始播放这个 media.
+     *
+     * @param startPositionHintMillis 预计从哪里开始播放, 见 [HlsPlaybackPreparer.prepare]. 只影响预缓存, 不会跳转.
      */
-    suspend fun loadMedia(media: Media?, episodeInfo: EpisodeMetadata) = coroutineScope {
+    suspend fun loadMedia(
+        media: Media?,
+        episodeInfo: EpisodeMetadata,
+        startPositionHintMillis: Long? = null,
+    ) = coroutineScope {
         val backgroundScope = this
         _videoLoadingStateFlow.value = VideoLoadingState.Initial // 避免一直显示已取消 (.Cancelled)
         stopPlayback()
@@ -132,7 +138,7 @@ class PlayerSession(
             )
 
             val data = source.open(scopeForCleanup = backgroundScope) // may throw MediaSourceOpenException
-            val preparedData = prepareHlsPlaybackIfEnabled(data).also {
+            val preparedData = prepareHlsPlaybackIfEnabled(data, startPositionHintMillis).also {
                 preparedHlsPlaybackProxySession = it.session
             }.data
 
@@ -211,20 +217,20 @@ class PlayerSession(
         }
     }
 
-    private suspend fun prepareHlsPlaybackIfEnabled(data: MediaData): PreparedMediaData {
+    private suspend fun prepareHlsPlaybackIfEnabled(data: MediaData, startPositionHintMillis: Long?): PreparedMediaData {
         if (data !is UriMediaData) {
             return PreparedMediaData(data)
         }
         val config = getVideoScaffoldConfigUseCase.invoke().first()
         val options = HlsPlaybackOptions(
-            filterSegments = config.enableExperimentalHlsSegmentFiltering,
+            filterSegments = config.enableHlsAdFiltering,
             // 自动跳过 OP/ED 需要提前缓存跳转目标处的分片, 这要求分片经由本地代理
             proxySegments = config.autoSkipOpEd,
         )
         if (!options.isEnabled) {
             return PreparedMediaData(data)
         }
-        val result = hlsPlaybackPreparer.prepare(data, options)
+        val result = hlsPlaybackPreparer.prepare(data, options, startPositionHintMillis)
         return PreparedMediaData(result.data, result.session)
     }
 
```

**File**: `app/shared/app-data/src/commonMain/kotlin/domain/foundation/HttpClientProvider.kt` (modified, +3/-1)
```diff
@@ -102,6 +102,7 @@ fun HttpClientProvider.get(
     distroChannel: String? = currentAniBuildConfig.distroChannel,
     cookieJar: WebSourceCookieJar? = null,
     identityRegistry: WebSourceIdentityRegistry? = null,
+    maxRequestsPerHost: Int? = null,
 ): ScopedHttpClient = get(
     buildSet {
         add(UserAgentFeature.withValue(userAgent))
@@ -113,6 +114,7 @@ fun HttpClientProvider.get(
         add(DistributionChannelFeature.withValue { distroChannel })
         if (cookieJar != null) add(CookieJarFeature.withValue(cookieJar))
         if (identityRegistry != null) add(WebSourceIdentityFeature.withValue(identityRegistry))
+        if (maxRequestsPerHost != null) add(MaxRequestsPerHostFeature.withValue(maxRequestsPerHost))
     },
 )
 
@@ -128,7 +130,7 @@ fun HttpClientProvider.get(
 class DefaultHttpClientProvider(
     private val proxyProvider: ProxyProvider,
     private val backgroundScope: CoroutineScope,
-    featureHandlers: List<ScopedHttpClientFeatureHandler<*>> = listOf(UserAgentFeatureHandler),
+    featureHandlers: List<ScopedHttpClientFeatureHandler<*>> = listOf(UserAgentFeatureHandler, MaxRequestsPerHostFeatureHandler),
 ) : HttpClientProvider() {
     // must have stable `equals`
     private data class Matrix(
```

**File**: `app/shared/app-data/src/commonMain/kotlin/domain/foundation/ScopedHttpClientFeature.kt` (modified, +18/-0)
```diff
@@ -32,6 +32,7 @@ import kotlinx.coroutines.flow.first
 import kotlinx.io.IOException
 import me.him188.ani.app.platform.getAniUserAgent
 import me.him188.ani.utils.coroutines.Symbol
+import me.him188.ani.utils.ktor.engineMaxRequestsPerHost
 import me.him188.ani.utils.ktor.userAgent
 import me.him188.ani.utils.logging.debug
 import me.him188.ani.utils.logging.logger
@@ -360,3 +361,20 @@ data object ConvertSendCountExceedExceptionFeatureHandler : ScopedHttpClientFeat
 }
 
 // endregion
+
+// region MaxRequestsPerHostFeature
+
+/**
+ * 引擎对单个 host 的并发请求上限. 用于需要对同一源站同时发出大量短请求的调用方, 例如 HLS 时间戳探测.
+ *
+ * 只作用于带这个特性借出的 client. 共享的默认 client 保持引擎默认值, 否则全应用对每个源站的并发都会跟着变.
+ */
+val MaxRequestsPerHostFeature = ScopedHttpClientFeatureKey<Int>("MaxRequestsPerHost")
+
+data object MaxRequestsPerHostFeatureHandler : ScopedHttpClientFeatureHandler<Int>(MaxRequestsPerHostFeature) {
+    override fun applyToConfig(config: HttpClientConfig<*>, value: Int) {
+        config.engineMaxRequestsPerHost(value)
+    }
+}
+
+// endregion
```

**File**: `app/shared/app-data/src/commonMain/kotlin/domain/media/hls/HlsManifestFilter.kt` (modified, +226/-214)
```diff
@@ -11,58 +11,147 @@ package me.him188.ani.app.domain.media.hls
 
 import me.him188.ani.utils.httpdownloader.m3u.DefaultM3u8Parser
 import me.him188.ani.utils.httpdownloader.m3u.M3u8Playlist
+import kotlin.math.roundToLong
 
+/**
+ * 从播放列表中移除插播广告.
+ *
+ * 唯一的判据是时间戳连续性 ([HlsPtsContinuity]): 广告是独立转码后拼进来的, PTS 自成一条时间轴,
+ * 接不上正片. 按组的时长、分片数或文件名猜测都会误删正片: 广告插入点常把正片镜头切出几秒的残片,
+ * 正片里也有与广告等长的短镜头段.
+ */
 object HlsManifestFilter {
-    fun filter(content: String, baseUrl: String = "http://127.0.0.1/playlist.m3u8"): HlsManifestFilterResult {
-        val lines = content.lines()
+    /**
+     * 一段连续的链外组超过这个时长就不删. 实测插播 15.8-25.7 秒; 正片也可能分几段独立编码
+     * (例如单独转码的片头), 它们同样自成时间轴, 但通常远长于插播. 这个上限只阻止删除, 不产生删除.
+     */
+    private const val MAX_AD_BREAK_MILLIS = 60_000L
+
+    /**
+     * 只做结构分析, 不下判断. 调用方据 [HlsManifestAnalysis.probeTargets] 探测各组首片的时间戳, 再交给 [filter].
+     */
+    fun analyze(content: String, baseUrl: String = "http://127.0.0.1/playlist.m3u8"): HlsManifestAnalysis {
         val playlist = try {
             DefaultM3u8Parser.parse(content, baseUrl)
         } catch (_: Exception) {
-            return HlsManifestFilterResult.unsupported(content, "invalid_playlist")
+            return HlsManifestAnalysis.earlyReturn(content, HlsManifestFilterResult.unsupported(content, "invalid_playlist"))
         }
 
         when (playlist) {
             is M3u8Playlist.MasterPlaylist -> {
-                return HlsManifestFilterResult.unsupported(content, "master_playlist")
+                return HlsManifestAnalysis.earlyReturn(
+                    content,
+                    HlsManifestFilterResult.unsupported(content, MASTER_PLAYLIST),
+                )
             }
 
             is M3u8Playlist.MediaPlaylist -> {
                 if (!playlist.isEndlist) {
-                    return HlsManifestFilterResult.unsupported(content, "live_or_incomplete_playlist")
+                    return HlsManifestAnalysis.earlyReturn(
+                        content,
+                        HlsManifestFilterResult.unsupported(content, "live_or_incomplete_playlist"),
+                    )
                 }
                 if (playlist.segments.none { it.isDiscontinuity }) {
-                    return HlsManifestFilterResult.unchanged(content, "no_discontinuity")
+                    return HlsManifestAnalysis.earlyReturn(
+                        content,
+                        HlsManifestFilterResult.unchanged(content, "no_discontinuity"),
+                    )
+                }
+                // 探测读到的是密文, 同步字节有极小概率蒙对而解出假时间戳, 把正片判成广告
+                if (playlist.segments.any { it.encryption != null }) {
+                    return HlsManifestAnalysis.earlyReturn(
+                        content,
+                        HlsManifestFilterResult.unchanged(content, "encrypted"),
+                    )
+                }
+                // 探测按组首片的地址取文件开头, 而这类播放列表的各组同在一个文件的不同区间,
+                // 每组都会读到同一个 PTS, 链串不起来, 起始 PTS 很小的正片组会被判成广告
+                if (playlist.segments.any { it.byteRange != null }) {
+                    return HlsManifestAnalysis.earlyReturn(
+                        content,
+                        HlsManifestFilterResult.unchanged(content, "byterange"),
+                    )
                 }
             }
         }
 
         val groups = parseGroups(playlist)
-        if (groups.isEmpty()) {
-            return HlsManifestFilterResult.unchanged(content, "no_segments")
+        if (groups.size < 2) {
+            return HlsManifestAnalysis.earlyReturn(content, HlsManifestFilterResult.unchanged(content, "single_group"))
         }
+        return HlsManifestAnalysis(content, groups)
+    }
 
-        val candidates = detectCandidates(groups)
-        if (candidates.isEmpty()) {
-            return HlsManifestFilterResult.unchanged(content, "no_candidate")
-        }
-        if (hasAes128KeyWithoutExplicitIv(playlist)) {
-            return HlsManifestFilterResult.unchanged(content, "encrypted_implicit_iv")
-        }
-        if (hasByteRangeWithoutExplicitOffset(playlist)) {
-            return HlsManifestFilterResult.unchanged(content, "byterange_implicit_offset")
+    /**
+     * @param probe 按顺序给出各目标首片的首个 PTS (毫秒), 探测失败为 `null`.
+     */
+    suspend fun filter(
+        analysis: HlsManifestAnalysis,
+        probe: suspend (List<HlsProbeTarget>) -> List<Long?>,
+    ): HlsManifestFilterResult {
+        analysis.earlyResult?.let { return it }
+        return decide(analysis, classify(analysis, probe(analysis.probeTargets)))
+    }
+
+    /**
+     * @param firstPts 与 [HlsManifestAnalysis.probeTargets] 一一对应. 探测失败或尚未探测的为 `null`.
+     */
+    internal fun classify(analysis: HlsManifestAnalysis, firstPts: List<Long?>): HlsPtsContinuity.Verdict {
+        return HlsPtsContinuity.classify(
+            analysis.probeTargets.mapIndexed { i, target ->
+                HlsPtsContinuity.Group(target.groupIndex, target.durationMillis, firstPts[i])
+            },
+        )
+    }
+
```

**File**: `app/shared/app-data/src/commonMain/kotlin/domain/media/hls/HlsPlaybackPreparer.kt` (modified, +15/-2)
```diff
@@ -36,7 +36,16 @@ data class HlsPlaybackOptions(
 }
 
 interface HlsPlaybackPreparer {
-    suspend fun prepare(data: UriMediaData, options: HlsPlaybackOptions): HlsPlaybackPreparerResult
+    /**
+     * @param startPositionHintMillis 播放预计从哪里开始 (续播时为记忆的进度), 在去除广告后的时间轴上.
+     * 只用于决定起播前预先下载哪个分片, 不影响播放列表; 给错了只会白下载一个分片.
+     * 它是单次播放的输入, 不是用户开关, 所以不放进 [HlsPlaybackOptions].
+     */
+    suspend fun prepare(
+        data: UriMediaData,
+        options: HlsPlaybackOptions,
+        startPositionHintMillis: Long? = null,
+    ): HlsPlaybackPreparerResult
 }
 
 data class HlsPlaybackPreparerResult(
@@ -57,7 +66,11 @@ interface HlsPlaybackProxySession : AutoCloseable {
 }
 
 object NoopHlsPlaybackPreparer : HlsPlaybackPreparer {
-    override suspend fun prepare(data: UriMediaData, options: HlsPlaybackOptions): HlsPlaybackPreparerResult {
+    override suspend fun prepare(
+        data: UriMediaData,
+        options: HlsPlaybackOptions,
+        startPositionHintMillis: Long?,
+    ): HlsPlaybackPreparerResult {
         return HlsPlaybackPreparerResult(data)
     }
 }
```

---

### Incident Patch 10: `ef1e30d0` (2026-10-01)
**Commit Message**: fix(player): 切换全屏、画中画与宽窄布局时保持播放器节点, 不再销毁视频 Surface (#3508)

播放页的手机布局和宽屏布局各自组合一次播放器, 手机进入全屏后旋转为横屏会从一个布局切到另一个,
Android 画中画也会切到另一棵组合子树. 播放器节点被重建时 SurfaceView 脱离窗口并销毁 Surface,
ExoPlayer 在主线程等待播放线程放开旧输出, 超时即停止播放.

- 新增 EpisodeScreenLayout: 播放器始终是同一个子节点, 紧凑 / 宽屏 / 仅视频三种模式只改变它的大小和位置
- VideoScaffold 新增 videoOnly, 画中画时只隐藏视频以外的层
- 进出全屏后隐藏控制器、离开 expanded 时解除手势锁定, 这两项原先依赖播放器重建

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `app/shared/src/commonMain/kotlin/ui/subject/episode/EpisodePage.kt` (modified, +251/-262)
```diff
@@ -18,7 +18,6 @@ import androidx.compose.foundation.layout.Row
 import androidx.compose.foundation.layout.Spacer
 import androidx.compose.foundation.layout.WindowInsets
 import androidx.compose.foundation.layout.WindowInsetsSides
-import androidx.compose.foundation.layout.fillMaxHeight
 import androidx.compose.foundation.layout.fillMaxSize
 import androidx.compose.foundation.layout.fillMaxWidth
 import androidx.compose.foundation.layout.height
@@ -29,7 +28,6 @@ import androidx.compose.foundation.layout.safeContent
 import androidx.compose.foundation.layout.statusBarsPadding
 import androidx.compose.foundation.layout.systemBars
 import androidx.compose.foundation.layout.union
-import androidx.compose.foundation.layout.width
 import androidx.compose.foundation.layout.windowInsetsPadding
 import androidx.compose.foundation.lazy.grid.LazyGridState
 import androidx.compose.foundation.lazy.grid.rememberLazyGridState
@@ -75,7 +73,6 @@ import androidx.compose.ui.platform.LocalUriHandler
 import androidx.compose.ui.tooling.preview.Preview
 import androidx.compose.ui.tooling.preview.PreviewLightDark
 import androidx.compose.ui.unit.Dp
-import androidx.compose.ui.unit.coerceIn
 import androidx.compose.ui.unit.dp
 import androidx.lifecycle.Lifecycle
 import androidx.lifecycle.compose.LifecycleEventEffect
@@ -410,34 +407,18 @@ private fun EpisodeScreenContent(
                     LocalImageViewerHandler provides imageViewer,
                     LocalPictureInPictureController provides pictureInPictureController,
                 ) {
-                    when {
-                        showExpandedUI ->
-                            EpisodeScreenTabletVeryWide(
-                                vm,
-                                page,
-                                vm.danmakuHostState,
-                                danmakuEditorState,
-                                page.fetchRequest,
-                                { vm.updateFetchRequest(it) },
-                                pauseOnPlaying = pauseOnPlaying,
-                                tryUnpause = tryUnpause,
-                                setShowEditCommentSheet = { showEditCommentSheet = it },
-                                modifier = Modifier.fillMaxSize(),
-                                windowInsets = windowInsets,
-                            )
-
-                        else -> EpisodeScreenContentPhone(
-                            vm,
-                            page,
-                            vm.danmakuHostState,
-                            danmakuEditorState,
-                            Modifier.fillMaxSize(),
-                            pauseOnPlaying = pauseOnPlaying,
-                            tryUnpause = tryUnpause,
-                            setShowEditCommentSheet = { showEditCommentSheet = it },
-                            windowInsets,
-                        )
-                    }
+                    EpisodeScreenBody(
+                        vm,
+                        page,
+                        vm.danmakuHostState,
+                        danmakuEditorState,
+                        showExpandedUI = showExpandedUI,
+                        pauseOnPlaying = pauseOnPlaying,
+                        tryUnpause = tryUnpause,
+                        setShowEditCommentSheet = { showEditCommentSheet = it },
+                        modifier = Modifier.fillMaxSize(),
+                        windowInsets = windowInsets,
+                    )
                 }
             }
         }
@@ -492,181 +473,231 @@ internal fun WatchTogetherPopupVisibilityEffect(
     }
 }
 
+/**
+ * 播放页主体: 播放器, 以及窄屏时下方的详情或宽屏时右侧的侧边栏.
+ *
+ * 播放器只在这里组合一次, 旋转、进出全屏、切换宽窄布局都不会重建它, 见 [EpisodeScreenLayout].
+ */
 @Composable
-private fun EpisodeScreenTabletVeryWide(
+private fun EpisodeScreenBody(
     vm: EpisodeViewModel,
     page: EpisodePageState,
     danmakuHostState: DanmakuHostState,
     danmakuEditorState: DanmakuEditorState,
-    fetchRequest: MediaFetchRequest?,
-    onFetchRequestChange: (MediaFetchRequest) -> Unit,
+    showExpandedUI: Boolean,
     pauseOnPlaying: () -> Unit,
     tryUnpause: () -> Unit,
     setShowEditCommentSheet: (Boolean) -> Unit,
     modifier: Modifier = Modifier,
     windowInsets: WindowInsets = ScaffoldDefaults.contentWindowInsets,
 ) {
-    BoxWithConstraints {
-        val maxWidth = maxWidth
-        Row(
-            modifier
-                .then(
-                    if (vm.isFullscreen) Modifier.fillMaxSize()
-                    else Modifier,
-                ),
-        ) {
+    val compactWindowInsets = windowInsets
+        .union(WindowInsets.desktopTitleBar)
+        .run {
+            // iOS 上的 top window insets 没有被正确消耗, 手动排除 top insets
+            if (LocalPlatform.current.isIos()) {
+                only(WindowInsetsSides.Horizontal)
+            } else {
+                only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal)
+            }
+        }
+    val videoWindow
```

**File**: `app/shared/src/commonMain/kotlin/ui/subject/episode/EpisodeScreenLayout.kt` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+/*
+ * Copyright (C) 2024-2026 OpenAni and contributors.
+ *
+ * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
+ * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
+ *
+ * https://github.com/open-ani/ani/blob/main/LICENSE
+ */
+
+package me.him188.ani.app.ui.subject.episode
+
+import androidx.compose.runtime.Composable
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.layout.Layout
+import androidx.compose.ui.unit.Constraints
+import androidx.compose.ui.unit.coerceIn
+import androidx.compose.ui.unit.dp
+
+/**
+ * [EpisodeScreenLayout] 的布局模式.
+ */
+enum class EpisodeScreenLayoutMode {
+    /**
+     * 只有播放器, 占满整个区域. 用于全屏, 以及宽屏布局收起侧边栏时.
+     */
+    VIDEO_ONLY,
+
+    /**
+     * 播放器在上, 高度由播放器自己决定; 次要内容在下, 占满剩余高度.
+     */
+    COMPACT,
+
+    /**
+     * 播放器在左, 次要内容作为侧边栏在右.
+     */
+    WIDE,
+}
+
+/**
+ * 播放页布局: 播放器和它旁边的次要内容 (窄屏时是下方的详情与评论, 宽屏时是右侧的侧边栏).
+ *
+ * 不论 [mode] 如何, [video] 都是同一个子节点, 切换模式只改变它的大小和位置.
+ * 播放器节点一旦换了父布局就会被销毁重建: Android 上 SurfaceView 会脱离窗口并销毁 Surface,
+ * ExoPlayer 在主线程上等待播放线程放开旧的视频输出, 超时则停止播放.
+ * 因此旋转、进出全屏、窗口宽度跨过宽屏阈值都只能改变 [mode], 不能把播放器放进另一个布局.
+ *
+ * @param secondary 次要内容. [EpisodeScreenLayoutMode.VIDEO_ONLY] 时不组合.
+ */
+@Composable
+fun EpisodeScreenLayout(
+    mode: EpisodeScreenLayoutMode,
+    video: @Composable () -> Unit,
+    secondary: @Composable () -> Unit,
+    modifier: Modifier = Modifier,
+) {
+    val secondaryContent = if (mode == EpisodeScreenLayoutMode.VIDEO_ONLY) EmptyContent else secondary
+    Layout(
+        contents = listOf(video, secondaryContent),
+        modifier = modifier,
+    ) { (videoMeasurables, secondaryMeasurables), constraints ->
+        val width = constraints.maxWidth
+        val height = constraints.maxHeight
+        when (mode) {
+            EpisodeScreenLayoutMode.VIDEO_ONLY -> {
+                val videoPlaceables = videoMeasurables.map { it.measure(Constraints.fixed(width, height)) }
+                layout(width, height) {
+                    videoPlaceables.forEach { it.placeRelative(0, 0) }
+                }
+            }
+
+            EpisodeScreenLayoutMode.COMPACT -> {
+                val videoPlaceables = videoMeasurables.map { it.measure(constraints.copy(minHeight = 0)) }
+                val videoHeight = videoPlaceables.maxOfOrNull { it.height } ?: 0
+                val secondaryConstraints = Constraints.fixed(width, (height - videoHeight).coerceAtLeast(0))
+                val secondaryPlaceables = secondaryMeasurables.map { it.measure(secondaryConstraints) }
+                layout(width, height) {
+                    videoPlaceables.forEach { it.placeRelative(0, 0) }
+                    secondaryPlaceables.forEach { it.placeRelative(0, videoHeight) }
+                }
+            }
+
+            EpisodeScreenLayoutMode.WIDE -> {
+                val sidebarWidth = (width.toDp() * 0.25f).coerceIn(340.dp, 460.dp).roundToPx().coerceAtMost(width)
+                val videoWidth = width - sidebarWidth
+                val videoPlaceables = videoMeasurables.map { it.measure(Constraints.fixed(videoWidth, height)) }
+                val secondaryPlaceables = secondaryMeasurables.map { it.measure(Constraints.fixed(sidebarWidth, height)) }
+                layout(width, height) {
+                    videoPlaceables.forEach { it.placeRelative(0, 0) }
+                    secondaryPlaceables.forEach { it.placeRelative(videoWidth, 0) }
+                }
+            }
+        }
+    }
+}
+
+private val EmptyContent: @Composable () -> Unit = {}
```

**File**: `app/shared/src/commonMain/kotlin/ui/subject/episode/EpisodeVideo.kt` (modified, +11/-20)
```diff
@@ -11,7 +11,6 @@ package me.him188.ani.app.ui.subject.episode
 
 import androidx.compose.foundation.hoverable
 import androidx.compose.foundation.interaction.MutableInteractionSource
-import androidx.compose.foundation.background
 import androidx.compose.foundation.interaction.collectIsHoveredAsState
 import androidx.compose.foundation.layout.Box
 import androidx.compose.foundation.layout.Column
@@ -54,7 +53,6 @@ import androidx.compose.runtime.rememberCoroutineScope
 import androidx.compose.runtime.saveable.rememberSaveable
 import androidx.compose.runtime.setValue
 import androidx.compose.ui.Modifier
-import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.layout.onSizeChanged
 import androidx.compose.ui.platform.LocalDensity
 import androidx.compose.ui.platform.testTag
@@ -253,28 +251,19 @@ internal fun EpisodeVideoImpl(
     pictureInPictureController: PictureInPictureController = NoOpPictureInPictureController,
     isInPictureInPicture: Boolean = false,
 ) {
-    // Don't rememberSavable. 刻意让每次切换都是隐藏的
-    var isLocked by remember { mutableStateOf(false) }
+    // Don't rememberSavable. 页面重建后都回到默认状态
+    // 锁定按钮只在 expanded 时显示, 离开 expanded 时必须解锁, 否则无法再解除
+    var isLocked by remember(expanded) { mutableStateOf(false) }
     var showPlayerStats by remember { mutableStateOf(false) }
     val playerStats by rememberPlayerStatsState(playerState)
     val sheetsController = rememberVideoSideSheetsController<EpisodeVideoSideSheetPage>()
     val anySideSheetVisible by sheetsController.hasPageAsState()
     val previewModeText = stringResource(Lang.subject_episode_preview_mode)
 
-    // iOS 不切换组合结构: 系统小窗只采集 AVPlayerLayer, 页面 UI 无需最小化;
-    // 若在此处切换到另一组合子树, 原 VideoPlayer(UIKitView) 会被 dispose,
-    // AVPictureInPictureController 持有的 AVPlayerLayer 随之失效, 小窗立即关闭且之后无法再启动
-    if (isInPictureInPicture && !LocalPlatform.current.isIos()) {
-        // 画中画小窗只渲染视频, 交互由系统提供.
-        Box(modifier.fillMaxSize().background(Color.Black)) {
-            if (LocalIsPreviewing.current) {
-                Text(previewModeText)
-            } else {
-                VideoPlayer(playerState, Modifier.matchParentSize())
-            }
-        }
-        return
-    }
+    // 画中画小窗只渲染视频, 交互由系统提供. iOS 系统小窗只采集 AVPlayerLayer, 页面 UI 无需最小化.
+    // 进出小窗只隐藏视频以外的层, 不切换组合结构: 播放器节点被重建会销毁视频输出
+    // (Android 的 Surface; iOS 上 AVPictureInPictureController 持有的 AVPlayerLayer 会失效, 小窗立即关闭且之后无法再启动).
+    val videoOnly = isInPictureInPicture && !LocalPlatform.current.isIos()
     val watchTogetherPlayerController = LocalWatchTogetherPlayerController.current
 
     // auto hide cursor
@@ -300,10 +289,12 @@ internal fun EpisodeVideoImpl(
         VideoScaffold(
             expanded = expanded,
             modifier = modifier
+                .ifThen(videoOnly) { fillMaxSize() }
                 .hoverable(videoInteractionSource)
                 .cursorVisibility(showCursor),
             contentWindowInsets = contentWindowInsets,
-            maintainAspectRatio = maintainAspectRatio,
+            maintainAspectRatio = maintainAspectRatio && !videoOnly,
+            videoOnly = videoOnly,
             controllerState = playerControllerState,
             gestureLocked = isLocked,
             topBar = {
@@ -356,7 +347,7 @@ internal fun EpisodeVideoImpl(
                     VideoPlayer(
                         playerState,
                         Modifier
-                            .ifThen(statusBarHeight != 0.dp) {
+                            .ifThen(statusBarHeight != 0.dp && !videoOnly) {
                                 offset(x = -statusBarHeight / 2, y = 0.dp)
                             }
                             .onSizeChanged {
```

**File**: `app/shared/src/commonMain/kotlin/ui/subject/episode/EpisodeViewModel.kt` (modified, +1/-1)
```diff
@@ -406,7 +406,7 @@ open class EpisodeViewModel(
 
     /**
      * 全屏播放器的手动查找 / BT 容器是否可见. 放 VM 而不是 EpisodeVideo 的 rememberSaveable:
-     * EpisodeVideo 被 EpisodeScreenTabletVeryWide 与 EpisodeScreenContentPhone 两处调用, 窗口跨 600dp / 旋转时组合位置改变, 位置型状态会归零.
+     * 容器从侧边栏页面打开, 侧边栏页面被 closeSideSheet 销毁后容器仍要保留.
      */
     var fullscreenSelectorVisible: Boolean by mutableStateOf(false)
 
```

**File**: `app/shared/src/desktopTest/kotlin/ui/subject/episode/EpisodeScreenLayoutTest.kt` (added, +126/-0)
```diff
@@ -0,0 +1,126 @@
+/*
+ * Copyright (C) 2024-2026 OpenAni and contributors.
+ *
+ * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
+ * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
+ *
+ * https://github.com/open-ani/ani/blob/main/LICENSE
+ */
+
+package me.him188.ani.app.ui.subject.episode
+
+import androidx.compose.foundation.layout.Box
+import androidx.compose.foundation.layout.fillMaxSize
+import androidx.compose.foundation.layout.fillMaxWidth
+import androidx.compose.foundation.layout.height
+import androidx.compose.foundation.layout.requiredSize
+import androidx.compose.runtime.Composable
+import androidx.compose.runtime.DisposableEffect
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.setValue
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.platform.testTag
+import androidx.compose.ui.test.SemanticsNodeInteraction
+import androidx.compose.ui.test.assertHeightIsEqualTo
+import androidx.compose.ui.test.assertLeftPositionInRootIsEqualTo
+import androidx.compose.ui.test.assertTopPositionInRootIsEqualTo
+import androidx.compose.ui.test.assertWidthIsEqualTo
+import androidx.compose.ui.test.onNodeWithTag
+import androidx.compose.ui.unit.Dp
+import androidx.compose.ui.unit.dp
+import me.him188.ani.app.ui.framework.doesNotExist
+import me.him188.ani.app.ui.framework.runAniComposeUiTest
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertTrue
+
+class EpisodeScreenLayoutTest {
+    private var mode by mutableStateOf(EpisodeScreenLayoutMode.COMPACT)
+    private var videoEnterCount = 0
+    private var videoLeaveCount = 0
+
+    @Composable
+    private fun Content() {
+        EpisodeScreenLayout(
+            mode,
+            video = {
+                DisposableEffect(Unit) {
+                    videoEnterCount++
+                    onDispose { videoLeaveCount++ }
+                }
+                Box(Modifier.fillMaxWidth().height(VIDEO_HEIGHT).testTag(TAG_VIDEO))
+            },
+            secondary = {
+                Box(Modifier.fillMaxSize().testTag(TAG_SECONDARY))
+            },
+            Modifier.requiredSize(WIDTH, HEIGHT),
+        )
+    }
+
+    @Test
+    fun `video is kept when switching modes`() = runAniComposeUiTest {
+        setContent { Content() }
+
+        for (next in listOf(
+            EpisodeScreenLayoutMode.VIDEO_ONLY,
+            EpisodeScreenLayoutMode.WIDE,
+            EpisodeScreenLayoutMode.COMPACT,
+            EpisodeScreenLayoutMode.WIDE,
+            EpisodeScreenLayoutMode.VIDEO_ONLY,
+            EpisodeScreenLayoutMode.COMPACT,
+        )) {
+            mode = next
+            waitForIdle()
+        }
+
+        runOnIdle {
+            assertEquals(1, videoEnterCount)
+            assertEquals(0, videoLeaveCount)
+        }
+    }
+
+    @Test
+    fun `compact places secondary below video`() = runAniComposeUiTest {
+        mode = EpisodeScreenLayoutMode.COMPACT
+        setContent { Content() }
+
+        onNodeWithTag(TAG_VIDEO).assertBounds(0.dp, 0.dp, WIDTH, VIDEO_HEIGHT)
+        onNodeWithTag(TAG_SECONDARY).assertBounds(0.dp, VIDEO_HEIGHT, WIDTH, HEIGHT - VIDEO_HEIGHT)
+    }
+
+    @Test
+    fun `wide places sidebar on the right`() = runAniComposeUiTest {
+        mode = EpisodeScreenLayoutMode.WIDE
+        setContent { Content() }
+
+        // 宽度的 1/4 为 250dp, 不足侧边栏最小宽度 340dp
+        val sidebarWidth = 340.dp
+        onNodeWithTag(TAG_VIDEO).assertBounds(0.dp, 0.dp, WIDTH - sidebarWidth, HEIGHT)
+        onNodeWithTag(TAG_SECONDARY).assertBounds(WIDTH - sidebarWidth, 0.dp, sidebarWidth, HEIGHT)
+    }
+
+    @Test
+    fun `video only fills the layout without secondary`() = runAniComposeUiTest {
+        mode = EpisodeScreenLayoutMode.VIDEO_ONLY
+        setContent { Content() }
+
+        onNodeWithTag(TAG_VIDEO).assertBounds(0.dp, 0.dp, WIDTH, HEIGHT)
+        assertTrue { onNodeWithTag(TAG_SECONDARY).doesNotExist() }
+    }
+
+    private fun SemanticsNodeInteraction.assertBounds(left: Dp, top: Dp, width: Dp, height: Dp) {
+        assertLeftPositionInRootIsEqualTo(left)
+        assertTopPositionInRootIsEqualTo(top)
+        assertWidthIsEqualTo(width)
+        assertHeightIsEqualTo(height)
+    }
+
+    private companion object {
+        const val TAG_VIDEO = "video"
+        const val TAG_SECONDARY = "secondary"
+        val WIDTH = 1000.dp
+        val HEIGHT = 600.dp
+        val VIDEO_HEIGHT = 225.dp
+    }
+}
```

**File**: `app/shared/video-player/src/commonMain/kotlin/ui/VideoScaffold.kt` (modified, +4/-0)
```diff
@@ -86,13 +86,16 @@ val LocalVideoScaffoldSheetWindowInsets = compositionLocalOf<WindowInsets> { Win
  * @param rhsSheet 右侧侧边栏. 框架不为它应用 [contentWindowInsets], 而是通过 [LocalVideoScaffoldSheetWindowInsets] 提供给它.
  * @param bottomBar [PlayerControllerBar]
  * @param expanded 当前是否处于全屏模式. 全屏时此框架会 [Modifier.fillMaxSize], 否则会限制为一个 16:9 的框.
+ * @param videoOnly 只组合 [video], 其他各层都不组合, 用于画中画小窗.
+ * 切换它不会重建 [video]: 播放器节点被重建会销毁视频输出.
  */
 @Composable
 fun VideoScaffold(
     expanded: Boolean,
     modifier: Modifier = Modifier,
     contentWindowInsets: WindowInsets = WindowInsets.safeContent, // TODO: 目前只对部分元素有效
     maintainAspectRatio: Boolean = !expanded,
+    videoOnly: Boolean = false,
     controllerState: PlayerControllerState,
     gestureLocked: Boolean = false,
     topBar: @Composable RowScope.() -> Unit = {},
@@ -143,6 +146,7 @@ fun VideoScaffold(
                 video()
                 Box(Modifier.matchParentSize()) // 防止点击事件传播到 video 里
             }
+            if (videoOnly) return@Box
 
             // 弹幕
             Box(
```

**File**: `app/shared/video-player/src/desktopTest/kotlin/ui/VideoScaffoldVideoOnlyTest.kt` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+/*
+ * Copyright (C) 2024-2026 OpenAni and contributors.
+ *
+ * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
+ * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
+ *
+ * https://github.com/open-ani/ani/blob/main/LICENSE
+ */
+
+package me.him188.ani.app.videoplayer.ui
+
+import androidx.compose.foundation.layout.Box
+import androidx.compose.foundation.layout.size
+import androidx.compose.runtime.DisposableEffect
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
+import androidx.compose.runtime.setValue
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.platform.testTag
+import androidx.compose.ui.test.onNodeWithTag
+import androidx.compose.ui.unit.dp
+import me.him188.ani.app.ui.foundation.ProvideCompositionLocalsForPreview
+import me.him188.ani.app.ui.framework.doesNotExist
+import me.him188.ani.app.ui.framework.exists
+import me.him188.ani.app.ui.framework.runAniComposeUiTest
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertTrue
+
+class VideoScaffoldVideoOnlyTest {
+    @Test
+    fun `switching video only keeps video and hides other layers`() = runAniComposeUiTest {
+        var videoOnly by mutableStateOf(false)
+        var videoEnterCount = 0
+        var videoLeaveCount = 0
+        val controllerState = PlayerControllerState(ControllerVisibility.Visible)
+
+        setContent {
+            ProvideCompositionLocalsForPreview {
+                VideoScaffold(
+                    expanded = true,
+                    modifier = Modifier.size(640.dp, 360.dp),
+                    videoOnly = videoOnly,
+                    controllerState = controllerState,
+                    topBar = { Box(Modifier.size(10.dp).testTag(TAG_TOP_BAR)) },
+                    video = {
+                        DisposableEffect(Unit) {
+                            videoEnterCount++
+                            onDispose { videoLeaveCount++ }
+                        }
+                        Box(Modifier.size(10.dp).testTag(TAG_VIDEO))
+                    },
+                )
+            }
+        }
+        assertTrue { onNodeWithTag(TAG_TOP_BAR).exists() }
+
+        videoOnly = true
+        waitForIdle()
+        assertTrue { onNodeWithTag(TAG_VIDEO).exists() }
+        assertTrue { onNodeWithTag(TAG_TOP_BAR).doesNotExist() }
+
+        videoOnly = false
+        waitForIdle()
+        assertTrue { onNodeWithTag(TAG_TOP_BAR).exists() }
+
+        runOnIdle {
+            assertEquals(1, videoEnterCount)
+            assertEquals(0, videoLeaveCount)
+        }
+    }
+
+    private companion object {
+        const val TAG_VIDEO = "video"
+        const val TAG_TOP_BAR = "topBar"
+    }
+}
```

**File**: `docs/contributing/code/media/media-selector-ui.md` (modified, +1/-1)
```diff
@@ -168,7 +168,7 @@ BT 候选与 WEB 不同：同一集有几十条来自不同字幕组、分辨率
 不继承 Activity 对系统栏的隐藏，弹出即把系统栏拉回来并压缩可用高度。其余情况（非全屏的播放器、详情页）用窗口级对话框。
 窗口级对话框铺满整个窗口，包括系统栏与横屏挖孔所在的边，由内容自己避开这些区域：窗口若给它们留边，
 铺满的面板盖不住这几条，底下的视频和页面会从边上露出来。全屏容器的可见性与模式都由 ViewModel 持有：
-播放器在宽窄布局间切换时组合位置会改变，位置型状态会归零。
+容器从侧边栏页面打开，侧边栏页面关闭后容器仍要保留。
 
 页面内部的版式只看容器宽度：≥ 720dp 时 BT 页用表格、手动查找用双栏（左栏源与结果，右栏线路与剧集），
 否则 BT 用紧凑列表、手动查找堆叠为两页（先条目，后线路与剧集）。手动查找与 BT 页顶部有「正在观看 第 N 话 剧集名」提示，
```

---

### Incident Patch 11: `b3c522f7` (2026-09-30)
**Commit Message**: fix(player): Android 视频输出移除超时后在原位置重新打开媒体, 修复切换全屏或切到后台后黑屏 (#3507)

切换全屏时播放器的 AndroidView 会被重建, 退到后台或锁屏时窗口 Surface 会被销毁. 视频输出 (SurfaceView)
被移除时, ExoPlayer 在主线程等待播放线程释放旧输出, 超过 detachSurfaceTimeoutMs 就以 ERROR_CODE_TIMEOUT
停止播放, 画面黑屏且不会自动恢复.

- LibassExoPlayerMediampPlayer: 打开期间超时时重试; 播放中超时时用 AnalyticsListener 记录的位置
  重新打开同一个 UriMediaData. detachSurfaceTimeoutMs 放宽到 3 秒
- RememberPlayProgressExtension: 同一个 MediaData 被重新打开时保留播放器给出的位置, 不跳回记忆进度
- PlayerSession: 记录媒体加载成功后播放中的播放器错误
- 全屏切换日志改用应用 logger, 进入应用日志文件

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `app/shared/app-data/src/commonMain/kotlin/domain/episode/PlayerSession.kt` (modified, +14/-0)
```diff
@@ -17,6 +17,7 @@ import kotlinx.coroutines.flow.first
 import kotlinx.coroutines.flow.MutableStateFlow
 import kotlinx.coroutines.flow.StateFlow
 import kotlinx.coroutines.flow.asStateFlow
+import kotlinx.coroutines.launch
 import kotlinx.coroutines.withContext
 import me.him188.ani.app.domain.media.hls.HlsPlaybackOptions
 import me.him188.ani.app.domain.media.hls.HlsPlaybackPreparer
@@ -43,6 +44,7 @@ import me.him188.ani.utils.logging.warn
 import org.koin.core.Koin
 import org.openani.mediamp.MediampPlayer
 import org.openani.mediamp.PlaybackException
+import org.openani.mediamp.errorOrNull
 import org.openani.mediamp.source.MediaData
 import org.openani.mediamp.source.UriMediaData
 import kotlin.coroutines.CoroutineContext
@@ -92,6 +94,18 @@ class PlayerSession(
      */
     val videoLoadingState: StateFlow<VideoLoadingState> get() = _videoLoadingStateFlow.asStateFlow()
 
+    init {
+        backgroundScope.launch {
+            // 打开失败由 loadMedia 记录, 这里记录媒体加载成功后播放过程中的错误
+            player.state.collect { state ->
+                val error = state.errorOrNull ?: return@collect
+                if (_videoLoadingStateFlow.value is VideoLoadingState.Succeed) {
+                    logger.warn(error) { "Player error during playback" }
+                }
+            }
+        }
+    }
+
     /**
      * 解析 media 并开始播放这个 media.
      */
```

**File**: `app/shared/app-data/src/commonMain/kotlin/domain/player/extension/RememberPlayProgressExtension.kt` (modified, +12/-0)
```diff
@@ -31,6 +31,7 @@ import me.him188.ani.utils.logging.info
 import me.him188.ani.utils.logging.logger
 import org.koin.core.Koin
 import org.openani.mediamp.MediaStatus
+import org.openani.mediamp.source.MediaData
 import kotlin.time.Duration
 import kotlin.time.Duration.Companion.minutes
 import kotlin.time.Duration.Companion.seconds
@@ -91,6 +92,9 @@ class RememberPlayProgressExtension(
         backgroundTaskScope.launch("PlaybackStateListener") {
             val player = context.player
             var haveResumedOnce = false
+            // 已经恢复过记忆进度的媒体. 播放器在原位置重新打开同一个 MediaData 时 (Android 上视频输出超时后恢复播放),
+            // 保留播放器打开时的位置, 不跳回记忆的进度.
+            var resumedMediaData: MediaData? = null
             player.state.collectLatest { state ->
                 when {
                     state.mediaStatus == MediaStatus.Opening -> {
@@ -99,17 +103,23 @@ class RememberPlayProgressExtension(
                     }
 
                     state.isPlaying -> {
+                        val mediaData = player.mediaData.value
+                        if (mediaData != null && mediaData === resumedMediaData) {
+                            haveResumedOnce = true
+                        }
                         // Some backends (notably desktop mpv) report playing before the loaded file accepts seeks.
                         // Restore once metadata is ready, but only report after playback remains active for 5 seconds.
                         if (!haveResumedOnce) {
                             if (automationGate.suppressed.value) {
                                 haveResumedOnce = true
+                                resumedMediaData = mediaData
                             } else {
                                 val positionMillis =
                                     playProgressRepository.getResumePositionMillisByEpisodeId(episodeSession.episodeId)
                                 if (positionMillis == null) {
                                     logger.info { "Did not find saved position" }
                                     haveResumedOnce = true
+                                    resumedMediaData = mediaData
                                 } else {
                                     logger.info {
                                         "Loaded saved position: $positionMillis, waiting for video properties"
@@ -120,7 +130,9 @@ class RememberPlayProgressExtension(
                                             "Video properties ready, seeking to saved position: $positionMillis"
                                         }
                                         player.seekTo(positionMillis)
+                                        // seek 引起的状态变化会取消本次收集, 标记必须在 NonCancellable 内完成
                                         haveResumedOnce = true
+                                        resumedMediaData = mediaData
                                     }
                                 }
                             }
```

**File**: `app/shared/app-data/src/commonTest/kotlin/domain/player/extension/RememberPlayProgressExtensionTest.kt` (modified, +30/-0)
```diff
@@ -13,6 +13,7 @@ import kotlinx.coroutines.Dispatchers
 import kotlinx.coroutines.cancel
 import kotlinx.coroutines.flow.filterNotNull
 import kotlinx.coroutines.flow.first
+import kotlinx.coroutines.launch
 import kotlinx.coroutines.test.StandardTestDispatcher
 import kotlinx.coroutines.test.TestScope
 import kotlinx.coroutines.test.advanceTimeBy
@@ -39,12 +40,14 @@ import me.him188.ani.utils.coroutines.childScope
 import org.openani.mediamp.PlaybackErrorCode
 import org.openani.mediamp.PlaybackException
 import org.openani.mediamp.metadata.MediaProperties
+import org.openani.mediamp.test.TestMediampPlayer
 import kotlin.time.Duration
 import kotlin.time.Duration.Companion.minutes
 import kotlin.test.Ignore
 import kotlin.test.Test
 import kotlin.test.assertEquals
 import kotlin.test.assertNotEquals
+import kotlin.test.assertNotNull
 import kotlin.test.assertNull
 import kotlin.test.assertTrue
 
@@ -670,6 +673,33 @@ class RememberPlayProgressExtensionTest : AbstractPlayerExtensionTest() {
         testScope.cancel()
     }
 
+    @Test
+    fun `keeps position when player reopens the same media data`() = runTest {
+        val (testScope, suite, _) = createCase()
+        advanceUntilIdle()
+        repository.saveOrUpdate(episodeId = initialEpisodeId, 500)
+
+        suite.player.loadMedia(durationMs = 100_000L, playWhenReady = true, uri = "file://test")
+        advanceUntilIdle()
+        assertEquals(500, suite.player.currentPositionMillis.value)
+        val mediaData = assertNotNull(suite.player.mediaData.value)
+
+        // Android 上视频输出超时: 播放器出错, 随后在出错位置重新打开同一个 MediaData
+        suite.player.injectError(PlaybackException(PlaybackErrorCode.INTERNAL, "Detaching surface timed out"))
+        runCurrent()
+        val open = TestMediampPlayer.OpenBehavior.Hold()
+        suite.player.openBehavior = open
+        testScope.launch {
+            suite.player.setMediaData(mediaData, playWhenReady = true, startPositionMillis = 30_000L)
+        }
+        runCurrent()
+        open.release()
+        advanceUntilIdle()
+
+        assertEquals(30_000, suite.player.currentPositionMillis.value)
+        testScope.cancel()
+    }
+
     @Test
     fun `loads saved history on switch episode`() = runTest {
         val (testScope, suite, state) = createCase()
```

**File**: `app/shared/ui-foundation/src/androidMain/kotlin/ui/foundation/layout/Fullscreen.android.kt` (modified, +4/-1)
```diff
@@ -15,11 +15,14 @@ import androidx.core.view.WindowCompat
 import androidx.core.view.WindowInsetsCompat
 import androidx.core.view.WindowInsetsControllerCompat
 import me.him188.ani.app.platform.Context
+import me.him188.ani.utils.logging.info
+import me.him188.ani.utils.logging.logger
 
+private val logger = logger("Fullscreen")
 
 @Suppress("USELESS_CAST") // compiler bug
 actual suspend fun Context.setRequestFullScreen(window: PlatformWindowMP, fullscreen: Boolean) {
-    android.util.Log.i("setRequestFullScreen", "Requesting fullscreen: $fullscreen, context=$this")
+    logger.info { "Requesting fullscreen: $fullscreen, context=$this" }
     if (this is Activity) {
         if (fullscreen) {
             // go landscape
```

**File**: `app/shared/video-player/src/androidHostTest/kotlin/media/VideoOutputDetachTimeoutTest.kt` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+/*
+ * Copyright (C) 2024-2026 OpenAni and contributors.
+ *
+ * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
+ * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
+ *
+ * https://github.com/open-ani/ani/blob/main/LICENSE
+ */
+
+package me.him188.ani.app.videoplayer.media
+
+import androidx.annotation.OptIn
+import androidx.media3.common.util.UnstableApi
+import androidx.media3.exoplayer.ExoTimeoutException
+import org.openani.mediamp.PlaybackErrorCode
+import org.openani.mediamp.PlaybackException
+import kotlin.test.Test
+import kotlin.test.assertFalse
+import kotlin.test.assertTrue
+
+@OptIn(UnstableApi::class)
+class VideoOutputDetachTimeoutTest {
+    @Test
+    fun detectsDetachTimeoutWrappedByMediamp() {
+        // MediaMP -> ExoPlaybackException -> ExoTimeoutException, as reported in user logs
+        val error = PlaybackException(
+            PlaybackErrorCode.INTERNAL,
+            "ExoPlayer playback failed: ERROR_CODE_TIMEOUT (1003): Unexpected runtime error",
+            RuntimeException(
+                "Unexpected runtime error",
+                ExoTimeoutException(ExoTimeoutException.TIMEOUT_OPERATION_DETACH_SURFACE),
+            ),
+        )
+        assertTrue(error.isVideoOutputDetachTimeout())
+    }
+
+    @Test
+    fun ignoresOtherTimeoutsAndErrors() {
+        assertFalse(
+            RuntimeException(ExoTimeoutException(ExoTimeoutException.TIMEOUT_OPERATION_RELEASE))
+                .isVideoOutputDetachTimeout(),
+        )
+        assertFalse(PlaybackException(PlaybackErrorCode.IO, "Source error").isVideoOutputDetachTimeout())
+    }
+}
```

**File**: `app/shared/video-player/src/androidMain/kotlin/media/LibassExoPlayerMediampPlayer.kt` (modified, +117/-8)
```diff
@@ -13,13 +13,16 @@ import android.content.Context
 import android.net.Uri
 import androidx.annotation.OptIn as AndroidxOptIn
 import androidx.media3.common.MediaItem
+import androidx.media3.common.PlaybackException as Media3PlaybackException
 import androidx.media3.common.util.UnstableApi
 import androidx.media3.datasource.DataSource
 import androidx.media3.datasource.DataSpec
 import androidx.media3.datasource.DefaultDataSource
 import androidx.media3.datasource.DefaultHttpDataSource
 import androidx.media3.datasource.TransferListener
 import androidx.media3.exoplayer.ExoPlayer
+import androidx.media3.exoplayer.ExoTimeoutException
+import androidx.media3.exoplayer.analytics.AnalyticsListener
 import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
 import androidx.media3.exoplayer.source.MediaSource
 import androidx.media3.extractor.DefaultExtractorsFactory
@@ -33,15 +36,21 @@ import kotlinx.coroutines.Dispatchers
 import kotlinx.coroutines.Job
 import kotlinx.coroutines.SupervisorJob
 import kotlinx.coroutines.cancel
+import kotlinx.coroutines.currentCoroutineContext
 import kotlinx.coroutines.delay
+import kotlinx.coroutines.ensureActive
 import kotlinx.coroutines.flow.FlowCollector
 import kotlinx.coroutines.flow.StateFlow
 import kotlinx.coroutines.isActive
 import kotlinx.coroutines.launch
+import me.him188.ani.utils.logging.logger
+import me.him188.ani.utils.logging.warn
 import org.openani.mediamp.ExperimentalMediampApi
 import org.openani.mediamp.InternalForInheritanceMediampApi
+import org.openani.mediamp.MediaStatus
 import org.openani.mediamp.MediampPlayer
 import org.openani.mediamp.MediampPlayerFactory
+import org.openani.mediamp.PlaybackException
 import org.openani.mediamp.exoplayer.ExoPlayerAudioTimeStretch
 import org.openani.mediamp.exoplayer.ExoPlayerMediampPlayer
 import org.openani.mediamp.io.SeekableInput
@@ -65,6 +74,15 @@ import kotlin.time.Duration.Companion.milliseconds
  * the open, before the interceptor runs, and the `createInput` contract allows only one open
  * input at a time. [setMediaData] therefore wraps the data in [TrackingSeekableInputMediaData]
  * so the interceptor can route playback reads through that already-open input.
+ *
+ * Video output detach timeouts: when the video output (e.g. a SurfaceView's surface) is destroyed,
+ * ExoPlayer blocks the main thread until the playback thread releases it, and stops playback with
+ * [ExoTimeoutException.TIMEOUT_OPERATION_DETACH_SURFACE] if that takes longer than
+ * [DETACH_SURFACE_TIMEOUT_MILLIS]. The media itself is fine and the picture resumes once a new
+ * output is attached, so a [UriMediaData] is reopened at the position where it failed: [openMedia]
+ * retries timeouts during an open, and [videoOutputTimeoutListener] reopens after timeouts during
+ * playback. A [SeekableInputMediaData] (BT, local files) is closed by MediaMP when its session ends
+ * and cannot be reopened as is, so its timeouts are reported as ordinary playback errors.
  */
 @OptIn(InternalForInheritanceMediampApi::class)
 @AndroidxOptIn(UnstableApi::class)
@@ -98,7 +116,10 @@ class LibassExoPlayerMediampPlayer private constructor(
             parentCoroutineContext,
             audioTimeStretch,
             mediaSourceInterceptor = pipeline::intercept,
-            configurePlayerBuilder = configurePlayerBuilder,
+            configurePlayerBuilder = { builder ->
+                builder.setDetachSurfaceTimeoutMs(DETACH_SURFACE_TIMEOUT_MILLIS)
+                configurePlayerBuilder?.invoke(builder)
+            },
         ),
     )
 
@@ -108,10 +129,48 @@ class LibassExoPlayerMediampPlayer private constructor(
     private val backgroundScope = CoroutineScope(
         parentCoroutineContext + SupervisorJob(parentCoroutineContext[Job.Key]),
     )
+    @Volatile
     private var closed = false
 
+    /**
+     * The media of the caller's latest [setMediaData], or `null` after [stopPlayback]. Reopened after
+     * a video output detach timeout during playback.
+     */
+    @Volatile
+    private var currentMediaData: MediaData? = null
+
+    /**
+     * ExoPlayer registers its analytics collector at construction, before MediaMP's Player.Listener,
+     * so this listener sees the error first. MediaMP handles the error by stopping ExoPlayer and
+     * clearing the media, so the failed position is taken from [AnalyticsListener.EventTime].
+     */
+    private val videoOutputTimeoutListener = object : AnalyticsListener {
+        override fun onPlayerError(eventTime: AnalyticsListener.EventTime, error: Media3PlaybackException) {
+            if (closed || !error.isVideoOutputDetachTimeout()) return
+            // A timeout during an open is thrown from setMediaData and retried by openMedia.
+            if (exoMediampPlayer.state.value.mediaStatus == MediaStatus.Opening) return
+            val data = currentMediaData as? UriMediaData ?: return
+            val positionMillis = eventTime.currentPlaybackPositionMs
+            v
```

---

### Incident Patch 12: `7c8f5278` (2026-09-30)
**Commit Message**: fix(danmaku): 弹弹 play 匹配接口失败时返回 matches=null, 修复弹幕获取抛出反序列化异常 (#3506)

弹弹 play 的 /api/v2/match 拒绝请求时返回 success=false 且 matches=null.
DandanplayMatchVideoResponse 把 matches 声明为非空, 反序列化抛出
JsonDecodingException, 整次弹弹 play 弹幕获取失败并被 DanmakuFetcher 重试.

- 按接口文档把 matches, errorMessage 以及匹配结果中的 animeTitle,
  episodeTitle, typeDescription 声明为可空
- 文件名匹配返回 success=false 时记录 errorCode/errorMessage 并返回 NoMatch
- 补充失败响应反序列化、匹配被拒绝时返回 NoMatch、文件名匹配成功的测试

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `danmaku/dandanplay/src/commonMain/kotlin/DandanplayDanmakuProvider.kt` (modified, +14/-6)
```diff
@@ -155,27 +155,35 @@ class DandanplayDanmakuProvider(
                 fileSize = request.fileSize,
                 videoDuration = request.videoDuration,
             )
+            if (!resp.success) {
+                logger.warn {
+                    "Dandanplay file match failed for '$filename', " +
+                            "errorCode=${resp.errorCode}, errorMessage=${resp.errorMessage}"
+                }
+                return DanmakuFetchResult.noMatch(providerId, DanmakuServiceId.Dandanplay)
+            }
+            val matches = resp.matches.orEmpty()
             val match = if (resp.isMatched) {
-                resp.matches.firstOrNull() ?: return DanmakuFetchResult.noMatch(providerId, DanmakuServiceId.Dandanplay)
+                matches.firstOrNull() ?: return DanmakuFetchResult.noMatch(providerId, DanmakuServiceId.Dandanplay)
             } else {
                 matcher.match(
-                    resp.matches.map {
+                    matches.map {
                         DanmakuEpisodeWithSubject(
                             it.episodeId.toString(),
-                            it.animeTitle,
-                            it.episodeTitle,
+                            it.animeTitle.orEmpty(),
+                            it.episodeTitle.orEmpty(),
                             null,
                         )
                     },
                 )?.let { match ->
-                    resp.matches.first { it.episodeId.toString() == match.id }
+                    matches.first { it.episodeId.toString() == match.id }
                 } ?: return DanmakuFetchResult.noMatch(providerId, DanmakuServiceId.Dandanplay)
             }
             logger.info { "Best match by file match: ${match.animeTitle} - ${match.episodeTitle}" }
             val episodeId = match.episodeId
             return createResult(
                 episodeId,
-                DanmakuMatchMethod.Fuzzy(match.animeTitle, match.episodeTitle),
+                DanmakuMatchMethod.Fuzzy(match.animeTitle.orEmpty(), match.episodeTitle.orEmpty()),
             )
         }
         return DanmakuFetchResult.noMatch(providerId, DanmakuServiceId.Dandanplay)
```

**File**: `danmaku/dandanplay/src/commonMain/kotlin/data/MatchVideo.kt` (modified, +5/-5)
```diff
@@ -68,19 +68,19 @@ class DandanplayDanmakuListResponse(
 @Serializable
 data class DandanplayEpisode(
     val animeId: Long,
-    val animeTitle: String,
+    val animeTitle: String? = null,
     val episodeId: Long,
-    val episodeTitle: String,
+    val episodeTitle: String? = null,
     val shift: Double,// 弹幕偏移时间（弹幕应延迟多少秒出现）。此数字为负数时表示弹幕应提前多少秒出现。
     val type: String,
-    val typeDescription: String
+    val typeDescription: String? = null,
 )
 
 @Serializable
 class DandanplayMatchVideoResponse(
     val isMatched: Boolean,
-    val matches: List<DandanplayEpisode>, // Actually it's null when success is false
+    val matches: List<DandanplayEpisode>? = null, // success 为 false 时为 null
     val errorCode: Int,
     val success: Boolean,
-    val errorMessage: String,
+    val errorMessage: String? = null,
 )
```

**File**: `danmaku/dandanplay/src/commonTest/kotlin/DandanplayDanmakuProviderTest.kt` (modified, +111/-1)
```diff
@@ -24,12 +24,15 @@ import kotlinx.coroutines.test.runTest
 import kotlinx.serialization.json.Json
 import me.him188.ani.danmaku.api.provider.DanmakuFetchRequest
 import me.him188.ani.danmaku.api.provider.DanmakuMatchMethod
+import me.him188.ani.danmaku.dandanplay.data.DandanplayMatchVideoResponse
 import me.him188.ani.datasources.api.EpisodeSort
 import me.him188.ani.datasources.api.PackedDate
 import me.him188.ani.utils.ktor.asScopedHttpClient
 import kotlin.test.Test
 import kotlin.test.assertEquals
+import kotlin.test.assertFalse
 import kotlin.test.assertIs
+import kotlin.test.assertNull
 import kotlin.time.Duration.Companion.minutes
 
 class DandanplayDanmakuProviderTest {
@@ -288,6 +291,99 @@ class DandanplayDanmakuProviderTest {
         assertEquals("第7话 コンビニを出ると, そこは不思議の世界でした", method.episodeTitle)
     }
 
+    @Test
+    fun `DandanplayMatchVideoResponse accepts null matches when match request is rejected`() {
+        val response = json.decodeFromString<DandanplayMatchVideoResponse>(REJECTED_MATCH_RESPONSE)
+
+        assertFalse(response.success)
+        assertFalse(response.isMatched)
+        assertEquals(2, response.errorCode)
+        assertEquals("一个或多个参数不符合规则", response.errorMessage)
+        assertNull(response.matches)
+    }
+
+    @Test
+    fun `fetchAutomatic returns no match when file match request is rejected`() = runTest {
+        val seenPaths = mutableListOf<String>()
+        val provider = createProvider { path ->
+            seenPaths += path
+            when (path) {
+                "/api/v2/bangumi/bgmtv/999999999" -> respondJson(
+                    """{"success": false, "errorCode": 7, "errorMessage": "无法找到指定的资源", "bangumi": null}""",
+                )
+
+                "/api/v2/search/episodes" -> respondJson(EMPTY_EPISODE_SEARCH_RESPONSE)
+                "/api/v2/match" -> respondJson(REJECTED_MATCH_RESPONSE)
+                else -> error("Unexpected request: $path")
+            }
+        }
+
+        val result = provider.fetchAutomatic(
+            request(
+                subjectId = 999999999,
+                subjectName = "unknown subject",
+                episodeSort = EpisodeSort(1),
+                episodeName = "unknown episode",
+                filename = "[Group] unknown subject - 01 [1080P]",
+            ),
+        ).single()
+
+        assertEquals(DanmakuMatchMethod.NoMatch, result.matchInfo.method)
+        assertEquals(
+            listOf(
+                "/api/v2/bangumi/bgmtv/999999999",
+                "/api/v2/search/episodes",
+                "/api/v2/match",
+            ),
+            seenPaths,
+        )
+    }
+
+    @Test
+    fun `fetchAutomatic uses file match when other matching fails`() = runTest {
+        val provider = createProvider { path ->
+            when (path) {
+                "/api/v2/bangumi/bgmtv/999999999" -> respondJson(
+                    """{"success": false, "errorCode": 7, "errorMessage": "无法找到指定的资源", "bangumi": null}""",
+                )
+
+                "/api/v2/search/episodes" -> respondJson(EMPTY_EPISODE_SEARCH_RESPONSE)
+                "/api/v2/match" -> respondJson(
+                    """
+                    {
+                      "isMatched": false,
+                      "matches": [
+                        {
+                          "episodeId": 176170001, "animeId": 17617, "animeTitle": "葬送的芙莉莲",
+                          "episodeTitle": "第1话 冒险的结束", "type": "tvseries", "typeDescription": "TV动画",
+                          "shift": 0, "imageUrl": "https://example.com/17617.jpg"
+                        }
+                      ],
+                      "errorCode": 0, "success": true, "errorMessage": ""
+                    }
+                    """.trimIndent(),
+                )
+
+                "/api/v2/comment/176170001" -> respondJson("""{"count":0,"comments":[]}""")
+                else -> error("Unexpected request: $path")
+            }
+        }
+
+        val result = provider.fetchAutomatic(
+            request(
+                subjectId = 999999999,
+                subjectName = "葬送的芙莉莲",
+                episodeSort = EpisodeSort(1),
+                episodeName = "冒险的结束",
+                filename = "[Group] Sousou no Frieren - 01 [1080P]",
+            ),
+        ).single()
+
+        val method = assertIs<DanmakuMatchMethod.Fuzzy>(result.matchInfo.method)
+        assertEquals("葬送的芙莉莲", method.subjectTitle)
+        assertEquals("第1话 冒险的结束", method.episodeTitle)
+    }
+
     @Test
     fun `normalizeEpisodeTitle strips number prefix and unifies width and spaces`() {
         assertEquals("ラム", normalizeEpisodeTitle("第18话 ラム"))
@@ -330,6 +426,7 @@ class DandanplayDanmakuProviderTest {
         episodeName: String,
         episodeEp: EpisodeSort? = null,
         episodeNames: List<String> = listOf(episodeName),
+        filename: String? = null,
     ) = DanmakuFetchRequest(
         subjectId = subjectId,
         subjectPrimaryName = s
```

---

### Incident Patch 13: `58640970` (2026-09-28)
**Commit Message**: fix(danmaku): 弹弹 play 匹配剧集时先按标题精确匹配, 修复分段放送合并条目匹配错集 (#3476)

* test: 修复桌面端 CI 测试失败并让失败日志带上断言消息

- 弹幕匀速回归: 换字号后的位置偏差容差按推进帧数累加, 与逐帧检查一致, 不再用 0.05 的总容差卡浮点累积误差.
- Gradle 测试日志改为完整异常格式, CI 失败时能直接看到 expected/actual.
- 图片加载器配置测试的断言消息附上 Sketch 描述, 便于定位平台差异.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

* fix(danmaku): 弹弹 play 匹配剧集时先按标题精确匹配, 修复分段放送合并条目匹配错集

弹弹 play 会把 Bangumi 拆成多个条目的分段放送 (如 Re:Zero 第四季的丧失篇与夺还篇)
合并为一个番剧并连续编号, 且只映射到第一个 Bangumi 条目. 后半条目走剧集搜索时,
接口不返回集数, 请求又只带中文集名, 与弹弹的日文标题对不上, 最后编辑距离兜底
选中了错误的剧集.

- DanmakuFetchRequest 新增 episodeNames, 携带剧集原名与译名
- 匹配顺序改为: 标题精确匹配 -> sort -> ep -> 模糊; 标题比较前去掉 "第x话" 前缀,
  全角转半角, 去空白并忽略大小写
- 补充分段放送、标题优先于集数、无标题回退集数、归一化函数的测试

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `app/shared/app-data/src/commonMain/kotlin/data/models/episode/EpisodeInfo.kt` (modified, +7/-0)
```diff
@@ -66,6 +66,13 @@ val EpisodeInfo.displayName get() = nameCn.ifBlank { name }
 @Stable
 val EpisodeInfo.nameOrNameCn get() = name.ifBlank { nameCn }
 
+/**
+ * 所有非空的名称, 原名优先. 用于需要跨语言匹配剧集的场景.
+ */
+@Stable
+val EpisodeInfo.allNames: List<String>
+    get() = listOf(name, nameCn).filter { it.isNotBlank() }.distinct()
+
 /**
  * 根据用户偏好选择的显示名称, 与 [subjectPreferredDisplayName] 同一约定.
  * @param useOriginalTitle 为 `true` 时优先显示原名 ([name]), 为 `false` 时行为与 [displayName] 一致.
```

**File**: `app/shared/app-data/src/commonMain/kotlin/domain/danmaku/DanmakuLoader.kt` (modified, +2/-0)
```diff
@@ -27,6 +27,7 @@ import kotlinx.coroutines.flow.shareIn
 import kotlinx.coroutines.flow.transformLatest
 import kotlinx.coroutines.flow.update
 import kotlinx.coroutines.launch
+import me.him188.ani.app.data.models.episode.allNames
 import me.him188.ani.app.data.models.episode.displayName
 import me.him188.ani.app.data.repository.danmaku.SearchDanmakuRequest
 import me.him188.ani.danmaku.api.DanmakuCollection
@@ -227,6 +228,7 @@ class DanmakuLoaderImpl internal constructor(
             episodeSort = episodeInfo.sort,
             episodeEp = episodeInfo.ep,
             episodeName = episodeInfo.displayName,
+            episodeNames = episodeInfo.allNames,
             filename = filename,
             fileHash = fileHash,
             fileSize = fileLength,
```

**File**: `app/shared/app-data/src/commonMain/kotlin/domain/media/download/AddDownloadUseCase.kt` (modified, +2/-0)
```diff
@@ -14,6 +14,7 @@ import kotlinx.coroutines.CancellationException
 import kotlinx.coroutines.flow.first
 import kotlinx.coroutines.launch
 import me.him188.ani.app.data.models.episode.EpisodeInfo
+import me.him188.ani.app.data.models.episode.allNames
 import me.him188.ani.app.data.models.subject.SubjectInfo
 import me.him188.ani.app.domain.media.cache.MediaCache
 import me.him188.ani.app.domain.media.resolver.toEpisodeMetadata
@@ -73,6 +74,7 @@ class AddDownloadUseCaseImpl(
                         episodeSort = episode.sort,
                         episodeEp = episode.ep,
                         episodeName = episode.name,
+                        episodeNames = episode.allNames,
                         filename = media.originalTitle,
                         fileSize = cache.fileStats.first().totalSize.takeUnless { it.isUnspecified }?.inBytes,
                         fileHash = null,
```

**File**: `danmaku/api/src/commonMain/kotlin/provider/DanmakuProvider.kt` (modified, +8/-0)
```diff
@@ -60,7 +60,15 @@ class DanmakuFetchRequest(
     val episodeId: Int,
     val episodeSort: EpisodeSort,
     val episodeEp: EpisodeSort?,
+    /**
+     * 用于展示和模糊匹配的剧集名称, 通常是中文名.
+     */
     val episodeName: String,
+    /**
+     * 剧集的所有已知名称 (原名, 译名等), 用于按标题精确匹配. 弹幕源的剧集标题语言不固定,
+     * 例如弹弹 play 对同一部番可能只有日文原名, 只用 [episodeName] 会匹配不到.
+     */
+    val episodeNames: List<String> = listOf(episodeName),
 
     val filename: String?,
     val fileHash: String?,
```

**File**: `danmaku/dandanplay/src/commonMain/kotlin/DandanplayDanmakuProvider.kt` (modified, +45/-17)
```diff
@@ -130,7 +130,7 @@ class DandanplayDanmakuProvider(
                 if (it is CancellationException) throw it
                 logger.warn(it) { "Failed to fetch episodes by Bangumi subject id: ${request.subjectId}" }
             }.getOrNull()
-        tryMatchEpisodes(request, bgmtvEpisodes, prefixedExpectedEpisodeName, matcher)?.let { return it }
+        tryMatchEpisodes(request, bgmtvEpisodes, matcher)?.let { return it }
 
         val episodes: List<DanmakuEpisodeWithSubject>? =
             runCatching { getEpisodesByExactSubjectMatch(request) }
@@ -144,7 +144,7 @@ class DandanplayDanmakuProvider(
                     if (it is CancellationException) throw it
                     logger.error(it) { "Failed to fetch episodes by fuzzy search" }
                 }.getOrNull()
-        tryMatchEpisodes(request, episodes, prefixedExpectedEpisodeName, matcher)?.let { return it }
+        tryMatchEpisodes(request, episodes, matcher)?.let { return it }
 
         // 都不行, 那就用最不准的方法
 
@@ -184,11 +184,17 @@ class DandanplayDanmakuProvider(
     private suspend fun tryMatchEpisodes(
         request: DanmakuFetchRequest,
         episodes: List<DanmakuEpisodeWithSubject>?,
-        prefixedExpectedEpisodeName: String,
         matcher: DanmakuMatcher,
     ): DanmakuFetchResult? {
         if (episodes == null) return null
 
+        // 先用标题精确匹配. 弹弹 play 会把 Bangumi 拆成多个条目的分段放送合并为一个番剧并连续编号,
+        // 此时 Bangumi 的 ep 与弹弹的集数对不上, 只有标题是可靠的.
+        matchEpisodeByTitle(request, episodes)?.let {
+            logger.info { "Matched episode by exact title: ${it.subjectName} - ${it.episodeName}" }
+            return createResult(it.id.toLong(), DanmakuMatchMethod.Exact(it.subjectName, it.episodeName))
+        }
+
         // 用剧集编号匹配. 先用系列的, 因为系列的更大.
         episodes.firstOrNull { it.epOrSort != null && it.epOrSort == request.episodeSort }?.let {
             logger.info { "Matched episode by exact episodeSort: ${it.subjectName} - ${it.episodeName}" }
@@ -199,20 +205,6 @@ class DandanplayDanmakuProvider(
             return createResult(it.id.toLong(), DanmakuMatchMethod.Exact(it.subjectName, it.episodeName))
         }
 
-        // 用名称精确匹配, 标记为 Exact.
-        if (request.episodeName.isNotBlank()) {
-            val match =
-                episodes.firstOrNull { it.episodeName == request.episodeName }
-                    ?: episodes.firstOrNull { it.episodeName == prefixedExpectedEpisodeName }
-            match?.let { episode ->
-                logger.info { "Matched episode by exact episodeName: ${episode.subjectName} - ${episode.episodeName}" }
-                return createResult(
-                    episode.id.toLong(),
-                    DanmakuMatchMethod.Exact(episode.subjectName, episode.episodeName),
-                )
-            }
-        }
-
         // 用名字不精确匹配.
         if (episodes.isNotEmpty()) {
             matcher.match(episodes)?.let {
@@ -227,6 +219,25 @@ class DandanplayDanmakuProvider(
         return null
     }
 
+    /**
+     * 按标题精确匹配. 标题去掉 "第x话" 前缀并归一化后比较, 同时接受 [DanmakuFetchRequest.episodeNames] 中的任一名称.
+     * 多个候选标题相同时, 用集数消歧; 仍无法确定则返回 `null`, 交给后续的集数匹配.
+     */
+    private fun matchEpisodeByTitle(
+        request: DanmakuFetchRequest,
+        episodes: List<DanmakuEpisodeWithSubject>,
+    ): DanmakuEpisodeWithSubject? {
+        val expectedTitles = (request.episodeNames + request.episodeName)
+            .map { normalizeEpisodeTitle(it) }
+            .filterTo(HashSet()) { it.isNotEmpty() }
+        if (expectedTitles.isEmpty()) return null
+
+        val candidates = episodes.filter { normalizeEpisodeTitle(it.episodeName) in expectedTitles }
+        return candidates.singleOrNull()
+            ?: candidates.firstOrNull { it.epOrSort != null && it.epOrSort == request.episodeSort }
+            ?: candidates.firstOrNull { it.epOrSort != null && it.epOrSort == request.episodeEp }
+    }
+
     private suspend fun getEpisodesByBgmtvSubjectId(
         request: DanmakuFetchRequest
     ): List<DanmakuEpisodeWithSubject>? {
@@ -406,3 +417,20 @@ class DandanplayDanmakuProvider(
         }
     }
 }
+
+private val episodeNumberPrefixRegex = Regex("""^第\s*\d+\s*[话話集]""")
+
+/**
+ * 去掉 "第x话" 前缀, 全角 ASCII 转半角, 去除所有空白并转小写.
+ * 弹弹 play 的标题形如 "第18话 ラム", Bangumi 的原名则是 "ラム"; 标点也可能在 "／" 与 " / " 之间变化.
+ */
+internal fun normalizeEpisodeTitle(title: String): String {
+    val stripped = episodeNumberPrefixRegex.replace(title.trim(), "")
+    return buildString(stripped.length) {
+        for (c in stripped) {
+            val half = if (c in '\uFF01'..'\uFF5E') (c - 0xFEE0) else c
+            if (half.isWhitespace()) continue
+            append(half.lowercaseChar())
+        }
+    }
+}
```

**File**: `danmaku/dandanplay/src/commonTest/kotlin/DandanplayDanmakuProviderTest.kt` (modified, +148/-1)
```diff
@@ -156,6 +156,150 @@ class DandanplayDanmakuProviderTest {
         )
     }
 
+    /**
+     * 弹弹 play 把 Re:Zero 第四季的丧失篇和夺还篇合并为一个番剧 (1-19 话), 只映射到丧失篇的 Bangumi 条目.
+     * 夺还篇的 Bangumi 条目没有映射, 只能走剧集搜索; 搜索结果没有集数, 且中文名与弹弹的日文标题不同.
+     */
+    @Test
+    fun `fetchAutomatic matches merged split cour episode by original title from episode search`() = runTest {
+        val provider = createProvider { path ->
+            when (path) {
+                "/api/v2/bangumi/bgmtv/633836" -> respondJson(
+                    """{"success": false, "errorCode": 7, "errorMessage": "无法找到指定的资源", "bangumi": null}""",
+                )
+
+                "/api/v2/search/episodes" -> respondJson(
+                    """
+                    {
+                      "success": true, "errorCode": 0, "errorMessage": "", "hasMore": false,
+                      "animes": [
+                        {
+                          "animeId": 19242,
+                          "animeTitle": "Re：从零开始的异世界生活 第四季",
+                          "episodes": [
+                            {"episodeId": 192420007, "episodeTitle": "第7话 コンビニを出ると, そこは不思議の世界でした"},
+                            {"episodeId": 192420009, "episodeTitle": "第9话 残骸"},
+                            {"episodeId": 192420018, "episodeTitle": "第18话 ラム"},
+                            {"episodeId": 192420019, "episodeTitle": "第19话"}
+                          ]
+                        }
+                      ]
+                    }
+                    """.trimIndent(),
+                )
+
+                "/api/v2/comment/192420018" -> respondJson("""{"count":0,"comments":[]}""")
+                else -> error("Unexpected request: $path")
+            }
+        }
+
+        val result = provider.fetchAutomatic(
+            request(
+                subjectId = 633836,
+                subjectName = "Re：从零开始的异世界生活 第四季 夺还篇",
+                episodeSort = EpisodeSort(84),
+                episodeEp = EpisodeSort(7),
+                episodeName = "拉姆",
+                episodeNames = listOf("ラム", "拉姆"),
+            ),
+        ).single()
+
+        val method = assertIs<DanmakuMatchMethod.Exact>(result.matchInfo.method)
+        assertEquals("第18话 ラム", method.episodeTitle)
+    }
+
+    @Test
+    fun `fetchAutomatic prefers title over episode number when Bangumi mapping covers merged cours`() = runTest {
+        val provider = createProvider { path ->
+            when (path) {
+                "/api/v2/bangumi/bgmtv/633836" -> respondJson(
+                    """
+                    {
+                      "success": true, "errorCode": 0, "errorMessage": "",
+                      "bangumi": {
+                        "animeTitle": "Re：从零开始的异世界生活 第四季",
+                        "type": "tvseries",
+                        "episodes": [
+                          {"episodeId": 192420007, "episodeTitle": "第7话 コンビニを出ると, そこは不思議の世界でした", "episodeNumber": "7", "lastWatched": null, "airDate": "2026-09-23T00:00:00"},
+                          {"episodeId": 192420018, "episodeTitle": "第18话 ラム", "episodeNumber": "18", "lastWatched": null, "airDate": "2026-09-23T00:00:00"}
+                        ]
+                      }
+                    }
+                    """.trimIndent(),
+                )
+
+                "/api/v2/comment/192420018" -> respondJson("""{"count":0,"comments":[]}""")
+                else -> error("Unexpected request: $path")
+            }
+        }
+
+        val result = provider.fetchAutomatic(
+            request(
+                subjectId = 633836,
+                subjectName = "Re：从零开始的异世界生活 第四季 夺还篇",
+                episodeSort = EpisodeSort(84),
+                episodeEp = EpisodeSort(7),
+                episodeName = "拉姆",
+                episodeNames = listOf("ラム", "拉姆"),
+            ),
+        ).single()
+
+        val method = assertIs<DanmakuMatchMethod.Exact>(result.matchInfo.method)
+        assertEquals("第18话 ラム", method.episodeTitle)
+    }
+
+    @Test
+    fun `fetchAutomatic falls back to episode number when title is unknown`() = runTest {
+        val provider = createProvider { path ->
+            when (path) {
+                "/api/v2/bangumi/bgmtv/633836" -> respondJson(
+                    """
+                    {
+                      "success": true, "errorCode": 0, "errorMessage": "",
+                      "bangumi": {
+                        "animeTitle": "Re：从零开始的异世界生活 第四季",
+                        "type": "tvseries",
+                        "episodes": [
+                          {"episodeId": 192420007, "episodeTitle": "第7话 コンビニを出ると, そこは不思議の世界でした", "episodeNumber": "7", "lastWatched": null, "airDate": "2026-09-23T00:00:00"},
+                          {"episodeId": 192420019, "episodeTitle": "第19话", "episodeNumber": "19", "lastWatched": null, "airDate": "2026-09-23T00:00:00"}
+                        ]
+                      }
+                    }
+                    """.trimIndent(),
+       
```

---

### Incident Patch 14: `0c1bd103` (2026-09-28)
**Commit Message**: Fix Android log-copy crashes and enhancement graph rebuilds (#3491)

Fix Android log copying and stabilize video enhancement effects

Co-authored-by: openanibot <[REDACTED_EMAIL]>
Co-authored-by: Him188 <[REDACTED_EMAIL]>

**File**: `app/shared/app-lang/src/androidMain/res/values-zh-rCN/strings.xml` (modified, +2/-0)
```diff
@@ -1408,6 +1408,8 @@
     <string name="settings_log_share_today_log_file">分享当日日志文件</string>
     <string name="settings_log_share_file">分享日志文件</string>
     <string name="settings_log_copy_today_log_content">复制当日日志内容（很大）</string>
+    <string name="settings_log_copy_too_large">日志太大，无法复制。请使用“分享当日日志文件”导出完整日志。</string>
+    <string name="settings_log_copy_failed">无法复制日志，请尝试“分享当日日志文件”。</string>
     <string name="settings_log_file_not_found">未找到日志文件</string>
     <string name="rating_requires_collection">请先收藏再评分</string>
     <string name="rating_discard_edit_title">舍弃编辑</string>
```

**File**: `app/shared/app-lang/src/androidMain/res/values-zh-rHK/strings.xml` (modified, +2/-0)
```diff
@@ -1378,6 +1378,8 @@
     <string name="settings_log_share_today_log_file">分享當日日誌檔案</string>
     <string name="settings_log_share_file">分享日誌檔案</string>
     <string name="settings_log_copy_today_log_content">複製當日日誌內容（很大）</string>
+    <string name="settings_log_copy_too_large">日誌太大，無法複製。請使用「分享當日日誌檔案」匯出完整日誌。</string>
+    <string name="settings_log_copy_failed">無法複製日誌，請嘗試「分享當日日誌檔案」。</string>
     <string name="settings_log_file_not_found">未找到日誌檔案</string>
     <string name="rating_requires_collection">請先收藏再評分</string>
     <string name="rating_discard_edit_title">捨棄編輯</string>
```

**File**: `app/shared/app-lang/src/androidMain/res/values-zh-rTW/strings.xml` (modified, +2/-0)
```diff
@@ -1368,6 +1368,8 @@
     <string name="settings_log_share_today_log_file">分享當日日誌檔案</string>
     <string name="settings_log_share_file">分享日誌檔案</string>
     <string name="settings_log_copy_today_log_content">複製當日日誌內容（很大）</string>
+    <string name="settings_log_copy_too_large">日誌太大，無法複製。請使用「分享當日日誌檔案」匯出完整日誌。</string>
+    <string name="settings_log_copy_failed">無法複製日誌，請嘗試「分享當日日誌檔案」。</string>
     <string name="settings_log_file_not_found">未找到日誌檔案</string>
     <string name="rating_requires_collection">請先收藏再評分</string>
     <string name="rating_discard_edit_title">捨棄編輯</string>
```

**File**: `app/shared/app-lang/src/androidMain/res/values/strings.xml` (modified, +2/-0)
```diff
@@ -1368,6 +1368,8 @@
     <string name="settings_log_share_today_log_file">Share today\'s log file</string>
     <string name="settings_log_share_file">Share log file</string>
     <string name="settings_log_copy_today_log_content">Copy today\'s log content (large)</string>
+    <string name="settings_log_copy_too_large">Log too large to copy. Use “Share today’s log file”.</string>
+    <string name="settings_log_copy_failed">Copy failed. Use “Share today’s log file”.</string>
     <string name="settings_log_file_not_found">Log file not found</string>
     <string name="rating_requires_collection">Follow this anime before rating</string>
     <string name="rating_discard_edit_title">Discard changes</string>
```

**File**: `app/shared/ui-settings/src/androidHostTest/kotlin/ui/settings/tabs/log/LogClipboardTest.kt` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+/*
+ * Copyright (C) 2024-2026 OpenAni and contributors.
+ *
+ * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
+ * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
+ *
+ * https://github.com/open-ani/ani/blob/main/LICENSE
+ */
+
+package me.him188.ani.app.ui.settings.tabs.log
+
+import kotlinx.coroutines.CancellationException
+import kotlinx.coroutines.test.runTest
+import java.io.File
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFailsWith
+
+class LogClipboardTest {
+    @Test
+    fun copiesCompleteSmallLog() = runTest {
+        withLog("日志 😀\nsecond line") { file ->
+            var copied: String? = null
+            assertEquals(LogCopyResult.Copied, copyLogToClipboard(file) { copied = it })
+            assertEquals(file.readText(), copied)
+        }
+    }
+
+    @Test
+    fun copiesLogAtCharacterLimit() = runTest {
+        withLog("中".repeat(MAX_LOG_CLIPBOARD_CHARS)) { file ->
+            var copied: String? = null
+            assertEquals(LogCopyResult.Copied, copyLogToClipboard(file) { copied = it })
+            assertEquals(file.readText(), copied)
+        }
+    }
+
+    @Test
+    fun rejectsOversizedLogWithoutChangingClipboard() = runTest {
+        for (size in listOf(MAX_LOG_CLIPBOARD_CHARS + 1, 8 * 1024 * 1024)) {
+            withLog("x".repeat(size)) { file ->
+                var copied = "previous clipboard"
+                assertEquals(LogCopyResult.TooLarge, copyLogToClipboard(file) { copied = it })
+                assertEquals("previous clipboard", copied)
+            }
+        }
+    }
+
+    @Test
+    fun handlesClipboardServiceFailure() = runTest {
+        withLog("small log") { file ->
+            assertEquals(LogCopyResult.Failed, copyLogToClipboard(file) {
+                throw RuntimeException("Clipboard service rejected the transaction")
+            })
+        }
+    }
+
+    @Test
+    fun handlesMissingLog() = runTest {
+        withLog("") { file ->
+            file.delete()
+            var copied = false
+            assertEquals(LogCopyResult.Failed, copyLogToClipboard(file) { copied = true })
+            assertEquals(false, copied)
+        }
+    }
+
+    @Test
+    fun preservesCancellation() = runTest {
+        withLog("small log") { file ->
+            assertFailsWith<CancellationException> {
+                copyLogToClipboard(file) { throw CancellationException("Screen closed") }
+            }
+        }
+    }
+
+    private suspend fun withLog(text: String, block: suspend (File) -> Unit) {
+        val file = File.createTempFile("animeko-log-", ".log")
+        try {
+            file.writeText(text)
+            block(file)
+        } finally {
+            file.delete()
+        }
+    }
+}
```

**File**: `app/shared/ui-settings/src/androidMain/kotlin/ui/settings/tabs/log/LogClipboard.kt` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+/*
+ * Copyright (C) 2024-2026 OpenAni and contributors.
+ *
+ * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
+ * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
+ *
+ * https://github.com/open-ani/ani/blob/main/LICENSE
+ */
+
+package me.him188.ani.app.ui.settings.tabs.log
+
+import kotlinx.coroutines.CancellationException
+import kotlinx.coroutines.Dispatchers
+import kotlinx.coroutines.withContext
+import me.him188.ani.utils.logging.logger
+import java.io.File
+
+// Android parcels text as UTF-16. Leave room in the shared Binder buffer for other transactions.
+internal const val MAX_LOG_CLIPBOARD_CHARS = 128 * 1024
+
+internal enum class LogCopyResult { Copied, TooLarge, Failed }
+
+internal suspend fun copyLogToClipboard(
+    file: File,
+    setClipboardText: suspend (String) -> Unit,
+): LogCopyResult {
+    try {
+        val text = withContext(Dispatchers.IO) {
+            file.bufferedReader().use { reader ->
+                // Read one extra character to detect overflow, including files growing during the read.
+                val buffer = CharArray(MAX_LOG_CLIPBOARD_CHARS + 1)
+                var count = 0
+                while (count < buffer.size) {
+                    val read = reader.read(buffer, count, buffer.size - count)
+                    if (read == -1) break
+                    count += read
+                }
+                if (count > MAX_LOG_CLIPBOARD_CHARS) null else String(buffer, 0, count)
+            }
+        } ?: return LogCopyResult.TooLarge
+        setClipboardText(text)
+        return LogCopyResult.Copied
+    } catch (e: CancellationException) {
+        throw e
+    } catch (e: Exception) {
+        logger("LogClipboard").warn("Could not copy today's log to the clipboard", e)
+        return LogCopyResult.Failed
+    }
+}
```

**File**: `app/shared/ui-settings/src/androidMain/kotlin/ui/settings/tabs/log/LogTab.android.kt` (modified, +11/-2)
```diff
@@ -1,5 +1,5 @@
 /*
- * Copyright (C) 2024-2025 OpenAni and contributors.
+ * Copyright (C) 2024-2026 OpenAni and contributors.
  *
  * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
  * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
@@ -24,11 +24,15 @@ import androidx.core.content.FileProvider
 import kotlinx.coroutines.launch
 import me.him188.ani.app.platform.LocalContext
 import me.him188.ani.app.ui.foundation.setClipEntryText
+import me.him188.ani.app.ui.foundation.widgets.LocalToaster
 import me.him188.ani.app.ui.lang.Lang
 import me.him188.ani.app.ui.lang.settings_log_copy_today_log_content
+import me.him188.ani.app.ui.lang.settings_log_copy_failed
+import me.him188.ani.app.ui.lang.settings_log_copy_too_large
 import me.him188.ani.app.ui.lang.settings_log_share_file
 import me.him188.ani.app.ui.lang.settings_log_share_today_log_file
 import me.him188.ani.buildconfig.AndroidBuildConfig
+import org.jetbrains.compose.resources.getString
 import org.jetbrains.compose.resources.stringResource
 import java.io.File
 
@@ -38,6 +42,7 @@ internal actual fun ColumnScope.PlatformLoggingItems(listItemColors: ListItemCol
     val context = LocalContext.current
     val clipboard = LocalClipboard.current
     val scope = rememberCoroutineScope()
+    val toaster = LocalToaster.current
     val shareTodayLogFileText = stringResource(Lang.settings_log_share_today_log_file)
     val shareLogFileText = stringResource(Lang.settings_log_share_file)
     val copyTodayLogContentText = stringResource(Lang.settings_log_copy_today_log_content)
@@ -65,7 +70,11 @@ internal actual fun ColumnScope.PlatformLoggingItems(listItemColors: ListItemCol
         headlineContent = { Text(copyTodayLogContentText) },
         Modifier.clickable {
             scope.launch {
-                clipboard.setClipEntryText(context.getCurrentLogFile().readText())
+                when (copyLogToClipboard(context.getCurrentLogFile(), clipboard::setClipEntryText)) {
+                    LogCopyResult.Copied -> Unit
+                    LogCopyResult.TooLarge -> toaster.toast(getString(Lang.settings_log_copy_too_large))
+                    LogCopyResult.Failed -> toaster.toast(getString(Lang.settings_log_copy_failed))
+                }
             }
         },
         colors = listItemColors,
```

**File**: `app/shared/video-player/build.gradle.kts` (modified, +4/-0)
```diff
@@ -41,6 +41,10 @@ kotlin {
         implementation(libs.libass.media)
         api(libs.mediamp.exoplayer)
     }
+    sourceSets.getByName("androidHostTest").dependencies {
+        implementation(libs.mediamp.test)
+        implementation(libs.kotlinx.coroutines.test)
+    }
     sourceSets.desktopMain.dependencies {
         api(compose.desktop.currentOs) {
             exclude("org.jetbrains.compose.material:material") // We use material3
```

---

### Incident Patch 15: `bccfed3b` (2026-09-28)
**Commit Message**: fix(ci): Codex agent 清理复用工作区中 fork PR 留下的 remote 配置

self-hosted runner 复用工作区, actions/checkout 不会移除额外的 remote 和 pushurl,
导致处理过一次 fork PR 后, 后续 fork PR 的 iterate 因 `remote fork already exists` 失败,
同仓库分支的 push 也会被残留的 no-push pushurl 拦截.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/codex-agent.yml` (modified, +9/-0)
```diff
@@ -464,6 +464,9 @@ jobs:
           set -euo pipefail
           git config user.name  "$GIT_NAME"
           git config user.email "$GIT_EMAIL"
+          # The self-hosted workspace is reused and checkout keeps extra remote config; drop what fork-PR runs leave.
+          git config --unset-all remote.origin.pushurl || true
+          git remote remove fork 2>/dev/null || true
 
       - name: React 👀 to the issue
         run: |
@@ -589,6 +592,9 @@ jobs:
           set -euo pipefail
           git config user.name  "$GIT_NAME"
           git config user.email "$GIT_EMAIL"
+          # The self-hosted workspace is reused and checkout keeps extra remote config; drop what fork-PR runs leave.
+          git config --unset-all remote.origin.pushurl || true
+          git remote remove fork 2>/dev/null || true
 
       - name: Resolve & check out PR branch
         id: pr
@@ -862,6 +868,9 @@ jobs:
           set -euo pipefail
           git config user.name  "$GIT_NAME"
           git config user.email "$GIT_EMAIL"
+          # The self-hosted workspace is reused and checkout keeps extra remote config; drop what fork-PR runs leave.
+          git config --unset-all remote.origin.pushurl || true
+          git remote remove fork 2>/dev/null || true
 
       - name: React 👀 to the comment
         run: |
```

#### Recent Merged Pull Requests:
- **PR #3531** (2026-10-05): perf(update): 自动更新与 CI 构建分块并行下载 (@Him188)
- **PR #3528** (2026-10-05): refactor(search): 搜索过滤交给服务端, 去掉客户端本地过滤 (@Him188)
- **PR #3525** (2026-10-04): test(search): 覆盖本地过滤清空整页时的搜索分页 (@Him188)
- **PR #3524** (2026-10-04): feat(settings): 账号设置支持注销账号 (@Him188)
- **PR #3523** (2026-10-04): fix(download): 选集页快捷选择在窄屏放不下时换行 (@Him188)
- **PR #3522** (2026-10-04): fix(lang): 字符串资源不使用 Compose 不认的 \' \" 转义 (@Him188)
- **PR #3516** (2026-10-03): feat(player): 重构播放器截图: 权限检查、闪光与角落预览面板、分享 (@StageGuard)
- **PR #3514** (2026-10-04): fix(search): 修复本地过滤空页导致搜索提前结束 (@BagunoMushi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
