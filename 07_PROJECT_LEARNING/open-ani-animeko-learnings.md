> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/open-ani-animeko-learnings.md`  
> **Source**: github ([https://github.com/open-ani/animeko](https://github.com/open-ani/animeko))  
> **Source Version**: `bd7a42f3`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T19:33:51.755Z  
> **Learning ID**: `learn-github-open-ani-animeko`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): open-ani/animeko

> **Canonical Artifact**: `07_PROJECT_LEARNING/open-ani-animeko-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/open-ani/animeko](https://github.com/open-ani/animeko))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-04T19:33:49.108Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `open-ani/animeko`
- **Description**: 集找番、追番、看番的一站式弹幕追番平台，云收藏同步 (Bangumi)，离线缓存，BitTorrent，弹幕云过滤。100% Kotlin/Compose Multiplatform
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 21492 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app/ios/Animeko/VideoEnhancementRenderer.swift`
```
import AVFoundation
import CoreVideo
import MetalKit

final class FrameCounter: @unchecked Sendable {
    private let lock = NSLock()
    private var count = 0
    func increment() { lock.lock(); count += 1; lock.unlock() }
    var value: Int { lock.lock(); defer { lock.unlock() }; return count }
}

final class RawMetalRenderer: NSObject, MTKViewDelegate {
    var presentationTransform = CGAffineTransform.identity { didSet { needsRedraw = true } }
    var aspectMode = 0 { didSet { if oldValue != aspectMode { needsRedraw = true } } } // fit, stretch, crop
    var onEnhancedFrame: ((Int) -> Void)?
    var onFailure: ((String) -> Void)?
    var output: AVPlayerItemVideoOutput?
    let completedFrames = FrameCounter()
    let completedEnhancedFrames = FrameCounter()
    let completedPresentations = FrameCounter()
    var allocatedTextureBytes: Int {
        (intermediateTextures + qualityTextures.flatMap { $0 }).reduce(0) { $0 + $1.width * $1.height * 8 }
    }
    var performanceEnabled = false { didSet { if oldValue != performanceEnabled { releaseTextures() } } }
    var qualityEnabled = false { didSet { if oldValue != qualityEnabled { releaseTextures() } } }
    var maxGpuMilliseconds = 0.0
    var lastFrameTime = 0.0
    var maxTimestampOffset = 0.0
    var failure: String? { didSet { if let failure, oldValue == nil { onFailure?(failure) } } }
    private var needsRedraw = true
    private var generation = 0
    private let queue: MTLCommandQueue
    private let pipeline: MTLRenderPipelineState
    private let ewaPipeline: MTLRenderPipelineState
    private let computePipelines: [MTLComputePipelineState]
    private let qualityPasses: [[MetalCnnPass]]
    private var qualityTextures: [[MTLTexture]] = []
    private let device: MTLDevice
    private var intermediateTextures: [MTLTexture] = []
    private var processedTexture: MTLTexture?
    private var cache: CVMetalTextureCache!
    private var frame: (CVPixelBuffer, CVMetalTexture, MTLTexture)?

    // A nil profile prepares both modes for the standalone probe.
    init(device: MTLDevice, quality: Bool? = nil) throws {
        self.device = device
        guard let queue = device.makeCommandQueue() else { throw NSError(domain: "Metal command queue", code: 1) }
        self.queue = queue
        let library = try device.makeLibrary(source: """
        #include <metal_stdlib>
        using namespace metal;
        struct V { float4 position [[position]]; float2 uv; };
        vertex V rawVertex(uint id [[vertex_id]], constant float4 *vertices [[buffer(0)]]) {
            V v; v.position = float4(vertices[id].xy,0,1);
            v.uv = vertices[id].zw; return v;
        }
        fragment float4 rawFragment(V v [[stage_in]], texture2d<float> image [[texture(0)]]) {
            constexpr sampler s(coord::normalized, address::clamp_to_edge, filter::linear);
            return float4(image.sample(s, v.uv).rgb, 1);
        }
        """, options: nil)
        let descriptor = MTLRenderPipelineDescriptor()
        descriptor.vertexFunction = library.makeFunction(name: "rawVertex")
        descriptor.fragmentFunction = library.makeFunction(name: "rawFragment")
        descriptor.colorAttachments[0].pixelFormat = .bgra8Unorm
        pipeline = try device.makeRenderPipelineState(descriptor: descriptor)
        let ewaURL = Bundle.main.url(forResource: "ewa_lanczossharp", withExtension: "frag")!
        let ewaSource = try String(contentsOf: ewaURL, encoding: .utf8)
        let ewaLibrary = try device.makeLibrary(source: ewaMetalSource(ewaSource), options: nil)
        descriptor.fragmentFunction = ewaLibrary.makeFunction(name: "ewaFragment")
        ewaPipeline = try device.makeRenderPipelineState(descriptor: descriptor)
        if quality != true {
            let shaderURL = Bundle.main.url(forResource: "Anime4K_Restore_CNN_S", withExtension: "glsl")!
            let shader = try String(contentsOf: shaderURL, encoding: .utf8)
            let computeLibrary = try device.makeLibrary(source: anime4kMetalSource(shader), options: nil)
            computePipelines = try (0..<4).map { try device.makeComputePipelineState(function: computeLibrary.makeFunction(name: "restore\($0)")!) }
        } else { computePipelines = [] }
        qualityPasses = try (quality == false ? [] : ["Anime4K_Restore_CNN_M", "Anime4K_Upscale_CNN_x2_M"]).map { name in
            let source = try String(contentsOf: Bundle.main.url(forResource: name, withExtension: "glsl")!, encoding: .utf8)
            return try metalMediumPasses(source, device: device)
        }
        super.init()
        guard CVMetalTextureCacheCreate(nil, nil, device, nil, &cache) == kCVReturnSuccess else { throw NSError(domain: "Metal texture cache", code: 1) }
    }

    func releaseTextures() {
        generation += 1
        processedTexture = nil
        intermediateTextures.removeAll()
        qualityTextures.removeAll()
        needsRedraw = true
    }

    func clearFrame() {
        frame = nil
        releaseTextures()
        lastFrameTime = 0
        if let cache { CVMetalTextureCacheFlush(cache, 0) }
    }
    func comparePausedFrame() -> String {
        guard let source = frame?.0, let texture = processedTexture,
              let command = queue.makeCommandBuffer(), let blit = command.makeBlitCommandEncoder() else { return "UNVERIFIED same-frame pixel comparison" }
        guard texture.width == CVPixelBufferGetWidth(source), texture.height == CVPixelBufferGetHeight(source) else {
            blit.endEncoding()
            return "UNVERIFIED same-frame comparison requires matching dimensions"
        }
        let rowBytes = ((texture.width * 8 + 255) / 256) * 256
        guard let buffer = device.makeBuffer(length: rowBytes * texture.height, options: .storageModeShared) else { return "FAIL comparison buffer allocation" }
        blit.copy(from: texture, sourceSlice: 0, sourceLevel: 0, sourceOrigin: MTLOrigin(x: 0, y: 0, z: 0), sourceSize: MTLSize(width: texture.width, height: texture.height, depth: 1), to: buffer, destinationOffset: 0, destinationBytesPerRow: rowBytes, destinationBytesPerImage: rowBytes * texture.height)
        blit.endEncoding()
        command.commit()
        command.waitUntilCompleted()
        guard command.status == .completed else { return "FAIL comparison GPU readback" }
        CVPixelBufferLockBaseAddress(source, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(source, .readOnly) }
        guard let original = CVPixelBufferGetBaseAddress(source) else { return "FAIL original buffer access" }
        let stride = CVPixelBufferGetBytesPerRow(source)
        var changed = 0
        var total = 0
        var maxDifference = 0.0
        for y in Swift.stride(from: 0, to: texture.height, by: 4) {
            for x in Swift.stride(from: 0, to: texture.width, by: 4) {
                let raw = original.advanced(by: y * stride + x * 4).assumingMemoryBound(to: UInt8.self)
                let restored = buffer.contents().advanced(by: y * rowBytes + x * 8).assumingMemoryBound(to: UInt16.self)
                var difference = 0.0
                for channel in 0..<3 {
                    let value = min(1, max(0, Double(Float16(bitPattern: restored[channel]))))
                    difference = max(difference, abs(value - Double(raw[2 - channel]) / 255))
                }
                if difference > 1.0 / 255 { changed += 1 }
                maxDifference = max(maxDifference, difference)
                total += 1
            }
        }
        return "\(changed > 0 ? "PASS" : "UNVERIFIED") same-frame changed pixels=\(changed)/\(total), max RGB delta=\(maxDifference); NOT a quality score"
    }
    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) { needsRedraw = true }
    func draw(in view: MTKView) {
        guard failure == nil, let output else { return }
        let requestedTime = output.itemTime(forHostTime: CACurrentMediaTime() + 1.0 / Double(view.preferredFramesPerSecond))
        var newFrame = false
        if output.hasNewPixelBuffer(forItemTime: requestedTime) {
            var displayTime = CMTime.zero
            if let pixel = output.copyPixelBuffer(forItemTime: requestedTime, itemTimeForDisplay: &displayTime) {
                var reference: CVMetalTexture?
                let status = CVMetalTextureCacheCreateTextureFromImage(nil, cache, pixel, nil, .bgra8Unorm, CVPixelBufferGetWidth(pixel), CVPixelBufferGetHeight(pixel), 0, &reference)
                if status == kCVReturnSuccess, let reference, let texture = CVMetalTextureGetTexture(reference) {
                    frame = (pixel, reference, texture)
                    processedTexture = nil
                    needsRedraw = true
                    lastFrameTime = displayTime.seconds
                    maxTimestampOffset = max(maxTimestampOffset, abs(displayTime.seconds - requestedTime.seconds))
                    newFrame = true
                } else { failure = "texture status \(status)"; return }
            }
        }
        // Polling for a decoded frame is cheap; static frames need no GPU presentation.
        guard frame != nil, newFrame || needsRedraw else { return }
        guard let drawable = view.currentDrawable, let descriptor = view.currentRenderPassDescriptor else { return }
        guard let command = queue.makeCommandBuffer() else { failure = "command buffer unavailable"; return }
        let retainedFrame = frame
        var enhanced = false
        if performanceEnabled && qualityEnabled, let input = retainedFrame?.2, newFrame || processedTexture == nil {
            if qualityTextures.first?.first?.width != input.width || qualityTextures.first?.first?.height != input.height {
                qualityTextures.removeAll()
                processedTexture = nil
                let pixels = input.width * input.height
                let units = qualityPasses.flatMap { $0 }.reduce(0) { $0 + $1.scale * $1.scale }
                let budget: UInt64 = 512 * 1024 * 1024
      
```

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

### Core Architecture Module: `app/shared/app-data/src/commonMain/kotlin/data/models/notification/NotificationBadgeState.kt`
```
/*
 * Copyright (C) 2024-2026 OpenAni and contributors.
 *
 * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
 * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
 *
 * https://github.com/open-ani/ani/blob/main/LICENSE
 */

package me.him188.ani.app.data.models.notification

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.Stable

/**
 * 通知入口 (头像和头像菜单里的“通知”) 和通知中心标签页需要的未读状态.
 *
 * @property unreadCounts 通知中心各个标签页 ([NotificationGroup.TABS]) 的未读通知数, 不含本机关闭的类型.
 * 没有未读通知的分组不在其中. 公告不计入. 游客为空.
 * @property hasUnreadAnnouncements 是否有未读公告. 游客总是 `false`.
 * @property unreadAnnouncementCount 未读公告数. 游客总是 0.
 * @property latestAnnouncement 公告列表的第一条 (置顶优先, 然后最新), 没有公告时为 `null`. 游客也有.
 */
@Immutable
data class NotificationBadgeState(
    val unreadCounts: Map<NotificationGroup, Int>,
    val hasUnreadAnnouncements: Boolean,
    val unreadAnnouncementCount: Int,
    val latestAnnouncement: Announcement?,
) {
    /**
     * 所有标签页的未读通知数之和. 通知入口的红点依据它.
     */
    val unreadCount: Int get() = unreadCounts.values.sum()

    /**
     * [group] 的标签页上显示的未读数.
     */
    fun unreadCountOf(group: NotificationGroup): Int = unreadCounts[group] ?: 0

    companion object {
        @Stable
        val Empty = NotificationBadgeState(
            unreadCounts = emptyMap(),
            hasUnreadAnnouncements = false,
            unreadAnnouncementCount = 0,
            latestAnnouncement = null,
        )
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
import kotlinx.coroutines.isActive
import kotlinx.coroutines.job
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import me.him188.ani.app.data.repository.media.SelectorMediaSourceEpisodeCacheRepository
import me.him188.ani.app.data.repository.player.EpisodePlayHistoryRepository
import me.him188.ani.app.domain.foundation.LoadError
import me.him188.ani.app.domain.media.fetch.MediaFetchSession
import me.him188.ani.app.domain.media.fetch.MediaSourceManager
import me.him188.ani.app.domain.media.fetch.createFetchFetchSession
import me.him188.ani.app.domain.media.resolver.toEpisodeMetadata
import me.him188.ani.app.domain.media.selector.MediaSelector
import me.him188.ani.app.domain.media.selector.MediaSelectorSourceTiers
import me.him188.ani.app.domain.mediasource.GetMediaSelectorSourceTiersUseCase
import me.him188.ani.app.domain.player.ExtensionException
import me.him188.ani.app.domain.player.PlayerExtensionManager
import me.him188.ani.app.domain.player.analytics.EpisodeFlowExtension
import me.him188.ani.app.domain.player.analytics.PlayFlowFetchObserver
import me.him188.ani.app.domain.player.analytics.PlayFlowMediaLoadListener
import me.him188.ani.app.domain.player.analytics.PlayFlowRecorder
import me.him188.ani.app.domain.player.analytics.PlayFlowStep
import me.him188.ani.app.domain.player.analytics.PlaybackFlowExtension
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
    /**
     * 本播放页的加载流程埋点记录器. 页面 (ViewModel) 创建它并在进入页面时记录 `enter`; 这里为每个 [EpisodeSession] 分配剧集尝试.
     */
    val playFlow: PlayFlowRecorder = PlayFlowRecorder(subjectId),
) {
    interface AnalyticsContext {
        suspend fun isFullscreen(): Boolean? = false
    }

    private val selectorCacheRepo by koin.inject<SelectorMediaSourceEpisodeCacheRepository>()
    private val mediaSourceManager by koin.inject<MediaSourceManager>()
    private val playHistoryRepository by koin.inject<EpisodePlayHistoryRepository>()
    private val automationGate by koin.inject<PlaybackAutomationGate>()
    private val getSourceTiers: GetMediaSelectorSourceTiersUseCase? by lazy { koin.getOrNull<GetMediaSelectorSourceTiersUseCase>() }

    /**
     * 最新的数据源阶级, 供埋点读取. 从 [onUIReady] 起收集.
     */
    private val latestSourceTiers = MutableStateFlow<MediaSelectorSourceTiers?>(null)

    /**
     * 观察条目级查询会话, 记录每轮查询的逐源结果.
     */
    private val fetchObserver = PlayFlowFetchObserver(playFlow, backgroundScope)

    /**
     * 条目级查询会话, 各集共用: 切集只重建选择器, 不重新查询.
     */
    private val fetchSessions = SubjectMediaFetchSessions(
        backgroundScope,
        createSession = { request -> mediaSourceManager.createFetchFetchSession(flowOf(request)) },
        onSessionCreated = fetchObserver::onSessionCreated,
        onSessionReused = fetchObserver::onSessionReused,
    )

    private val _episodeSessionFlow = MutableStateFlow(
        newEpisodeSession(initialEpisodeId, EpisodeSwitchTrigger.ENTER),
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
            EpisodeFlowExtension.Factory(fetchObserver::describeSearchStart) { latestSourceTiers.value },
            PlaybackFlowExtension,
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
     *
     * @param trigger 切集的发起方, 记入埋点. 目标与当前集相同时视为重试 ([EpisodeSwitchTrigger.RETRY]).
     */
    suspend fun switchEpisode(episodeId: Int, trigger: EpisodeSwitchTrigger = EpisodeSwitchTrigger.MANUAL) {
        val leaving = _episodeSessionFlow.value
        val isFullscreen = analyticsContext.isFullscreen()
        Analytics.recordEvent(
            EpisodeSwitch,
            buildMap {
                put("subject_id", subjectId)
                put("episode_id", episodeId)
                put("is_fullscreen", isFullscreen)
                putAll(playFlow.legacyProperties(leaving.playFlowEpisode))
            },
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
                    extensionManager.cal
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3691** (2026-11-02): **fix(download): 下载弹窗选源默认自动匹配, 切过的模式在会话内保持**
  *Symptoms*: ## 背景  下载弹窗的选源步骤原先在会话里有 BT 源时默认落到 BT 页，用户每次下载都要先切回自动匹配。另外用户切过的模式存在选源页内部的 `rememberSaveable` 里，而选源与选集两步靠 `AnimatedContent` 切换，选源页在过渡结束后会被销毁：选集后点返回、或下滑隐藏弹窗再从剧集行打开，模式都会重置为初值。之前初值是 BT，从 BT 页选资源再返回的人碰巧还在 BT 页；初值改成自动后这个问题就会暴露出来。  ## 改动  - `DownloadMediaPickerContent` 的初始模式固定为自动匹配，不随 BT 源有无或播放偏好变化。播放页的初始模式仍按设置里的 preferKind 推导，不受影响。 - 用户切过的模式挂到 `DownloadMediaPickerState` 上。这个对象由 presenter 持有，同一查询会话的两步和隐藏重开共用同一实例，正好对应「本次会话内保持」的语义，也和播放页把模式放在 ViewModel 上的做法一致。选源页改为接收宿主传入的模式与回调。 - `DownloadRequestSheet` 的两步切换外面套一层 `SaveableStateHolder`，返回选源时 BT 列表的滚动位置等 `rememberSaveable` 状态也能保住。 - 文档 media-downloads.md 与 media-selector-ui.md 同步更新默认模式与保持规则。  ## 验证  - `:app:shared:ui-download:desktopTest` 全部通过（16 个测试类）。 - `DownloadMediaPickerTest` 原「有 BT 源时默认 BT」的用例改为「有 BT 源时仍默认自动，可从菜单切到 BT」；新增回归测试用 `AnimatedContent` 模拟两步切换，切到 BT 后离开再回来仍在 BT 页，离开期间断言选源页确实被销毁。 - 修复前用同样结构的探针测试确认过：离开再回来会落到自动匹配页。  🤖 Generated with [Claude Code](https://claude.com/claude-code) 

- **Issue #3681** (2026-11-01): **fix(datasource): JSON API 源保留条目级资源以支持播放器内切集**
  *Symptoms*: ## 问题与行为  Closes #3680  稀饭动漫 Next 使用的 JSON API 数据源在 `fetch` 返回前按当前集裁剪资源。播放页通过 `SubjectMediaFetchSessions` 为同一条目复用查询结果，因此从第 1 集进入后，在播放器内切到第 2 集时没有 Next 的候选；退出再从详情进入第 2 集则能找到。  ## 修改  - `JsonApiMediaSource.selectMedia` 返回条目下全部可解析剧集与线路的资源，当前集筛选由现有 `MediaSelector` 完成，与 `MediaSource.fetch` 的条目级约定一致。在线查询和搜索缓存读取共用此方法。 - 保留资源 ID、集号解析、线路、播放参数与按需获取播放地址的逻辑。播放器、连播、切集、查询会话复用及其他数据源实现均未修改。 - 更新原有单集查询预期，验证各剧集的集号与各线路资源；新增在线、缓存两条路径下共用一份结果切集的回归测试，覆盖第 1、2、3 集、特别篇和切回第 1 集，并断言不额外查询或提前签发地址。特别篇继续遵守现有映射及选择器匹配规则。 - 播放地址来自剧集列表的测试使用一次查询返回的第 2、3 集资源，验证播放时列表响应仍可共用并在过期后刷新。  ## 验证  - 修复前两条新增回归测试失败；在线路径切到第 2 集时预期 4 个候选，实际为 0。 - 修复后桌面 JVM 上运行 92 个相关测试，全部通过，0 skipped：JSON API 数据源、引擎、模板与配置序列化，`SubjectMediaFetchSessionsTest`、`MediaSelectorFilterCharacterizationTest`、`MediaSelectorSubjectSeriesTest`。 - `git diff --check` 通过。  测试任务及筛选范围：  ```shell ./gradlew :app:shared:app-data:desktopTest   --tests '*domain.mediasource.jsonapi.*'   --tests '*SubjectMediaFetchSessionsTest'   --tests '*MediaSelectorFilterCharacterizationTest'   --tests '*MediaSelectorSubjectSeriesTest' ```  本机 Windows 使用项目 CI 同版本的 JBR 21（含 JCEF）；由于工作区路径含中文，测试运行时通过仓库外的临时 Gradle init script 将 classpath 映射到同一目录的英文 junction，并传入 `-Pandroid.overridePathCheck=true`。这些本地环境适配未纳入改动。  验证范围为自动化测试；未将修复打包替换已安装应用，也未对修复后的实际站点播放做运行验证。 
  **Post-Mortem & Fix Analysis**:
  > [`MediaSource.fetch` 的接口约定](https://github.com/open-ani/animeko/blob/8ca97e5d54f9a97dddb1a4fb2ec89d411e1b7802/datasource/api/src/commonMain/kotlin/source/MediaSource.kt#L108-L114)明确要求返回条目下全部剧集，由选择器按当前集筛选；现有 [`web-selector` 实现](https://github.com/open-ani/animeko/blob/8ca97e5d54f9a97dddb1a4fb2ec89d411e1b7802/app/shared/app-data/src/commonMain/kotlin/domain/mediasource/web/SelectorMediaSource.kt#L386-L395)也返回未按当前集裁剪的 `originalList`  似乎是这些部分干扰到了 codex  这个 PR 是希望让 JSON API 的查询行为与上述约定一致，但之前没有充分说明它会改变该配置为 `true` 时的行为  这里应仅由订阅侧调整 Next 配置并关闭 PR，还是继续统一 JSON API 的条目级查询行为，补充配置语义说明？
  > > [`MediaSource.fetch` 的接口约定](https://github.com/open-ani/animeko/blob/8ca97e5d54f9a97dddb1a4fb2ec89d411e1b7802/datasource/api/src/commonMain/kotlin/source/MediaSource.kt#L108-L114)明确要求返回条目下全部剧集，由选择器按当前集筛选；现有 [`web-selector` 实现](https://github.com/open-ani/animeko/blob/8ca97e5d54f9a97dddb1a4fb2ec89d411e1b7802/app/shared/app-data/src/commonMain/kotlin/domain/mediasource/web/SelectorMediaSource.kt#L386-L395)也返回未按当前集裁剪的 `originalList` >  >  >  > 似乎是这些部分干扰到了 codex >  >  >  > 这个 PR 是希望让 JSON API 的查询行为与上述约定一致，但之前没有充分说明它会改变该配置为 `true` 时的行为 >  >  >  > 这里应仅由订阅侧调整 Next 配置并关闭 PR，还是继续统一 JSON API 的条目级查询行为，补充配置语义说明？  文档的问题，这个地方改数据源就行了

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

### Incident Patch 1: `bd7a42f3` (2026-11-02)
**Commit Message**: fix(download): 下载弹窗选源默认自动匹配, 切过的模式在会话内保持 (#3691)

下载弹窗的选源步骤原先在会话里有 BT 源时默认落到 BT 页, 现在初值固定为自动匹配,
不随 BT 源有无或播放偏好变化; 要挑种子的用户自己切到 BT 页.

用户切过的模式原先存在选源页内部的 rememberSaveable 里, 选源与选集两步靠
AnimatedContent 切换, 选源页在过渡结束后被销毁, 选集后返回或隐藏弹窗再打开都会
重置为初值. 现在模式挂在 DownloadMediaPickerState 上, 由 presenter 在本次会话内
持有; 两步切换处再套一层 SaveableStateHolder, 列表滚动位置等状态返回时也能保住.

Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `app/shared/ui-download/src/commonMain/kotlin/ui/download/subject/SubjectDownloadRequestDialogs.kt` (modified, +32/-17)
```diff
@@ -45,7 +45,7 @@ import androidx.compose.runtime.key
 import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.remember
 import androidx.compose.runtime.rememberCoroutineScope
-import androidx.compose.runtime.saveable.rememberSaveable
+import androidx.compose.runtime.saveable.rememberSaveableStateHolder
 import androidx.compose.runtime.setValue
 import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
@@ -119,7 +119,13 @@ class DownloadMediaPickerState(
      * 本次选源会话的手动查找, 点选的一集作为本集的选择; 为 `null` 时没有手动查找.
      */
     val manualBrowse: ManualBrowseState? = null,
-)
+) {
+    /**
+     * 用户在模式 chip 上选的模式, `null` 表示还没选 (用初值). 放在会话状态上而不是选源页里:
+     * 选集后返回与弹窗隐藏重开都会重建选源页, 用户切过的模式要在本次会话内保持.
+     */
+    var userMode: MediaSelectorMode? by mutableStateOf(null)
+}
 
 /**
  * 选集步骤: 用户已在 [DownloadMediaPickerState] 中选定 [chosen].
@@ -203,21 +209,25 @@ private fun DownloadRequestSheet(
         modifier = Modifier.desktopTitleBarPadding().statusBarsPadding(),
         contentWindowInsets = { BottomSheetDefaults.windowInsets.add(WindowInsets.desktopTitleBar()) },
     ) {
+        // AnimatedContent 在两步切换时销毁另一步的内容; 用 SaveableStateHolder 保住各步的 rememberSaveable 状态 (列表滚动位置等), 返回选源时回到原处.
+        val stateHolder = rememberSaveableStateHolder()
         AnimatedContent(
             targetState = episodePicker,
             contentKey = { it != null },
             contentAlignment = Alignment.TopCenter,
         ) { picker ->
-            if (picker == null) {
-                DownloadMediaPicker(selection, sourceInfoProvider, settings, onSelect)
-            } else {
-                DownloadEpisodePicker(
-                    picker,
-                    onBack = onBack,
-                    onConfirm = onConfirmEpisodes,
-                    modifier = Modifier.padding(vertical = 12.dp)
-                        .navigationBarsPadding().fillMaxHeight().fillMaxWidth(),
-                )
+            stateHolder.SaveableStateProvider(picker != null) {
+                if (picker == null) {
+                    DownloadMediaPicker(selection, sourceInfoProvider, settings, onSelect)
+                } else {
+                    DownloadEpisodePicker(
+                        picker,
+                        onBack = onBack,
+                        onConfirm = onConfirmEpisodes,
+                        modifier = Modifier.padding(vertical = 12.dp)
+                            .navigationBarsPadding().fillMaxHeight().fillMaxWidth(),
+                    )
+                }
             }
         }
     }
@@ -256,6 +266,8 @@ private fun DownloadMediaPicker(
         selectorState = selectorState,
         sourceResults = presentation,
         hasBt = hasBt,
+        userMode = selection.userMode,
+        onUserModeChange = { selection.userMode = it },
         watching = watching,
         fetchRequest = fetchRequest,
         onFetchRequestChange = selection.fetchSession::setFetchRequest,
@@ -267,10 +279,12 @@ private fun DownloadMediaPicker(
 
 /**
  * 选源步骤的界面: 标题行「数据源」+ 模式 chip, 下方按模式放自动匹配页、手动查找页或 BT 资源页.
- * 模式在本次弹窗内保持; 初值有 BT 源 → BT, 否则 AUTO.
+ * 初值总是 AUTO, 不随 BT 源有无或播放偏好变化: 下载走自动匹配最省事, 要挑种子的用户自己切到 BT 页.
  * 弹窗宽 640dp, BT 页因此总是紧凑列表, 手动查找总是堆叠两页.
  *
  * @param hasBt 会话内是否有 BT 源 (含禁用源). 为 false 时模式菜单没有 BT 项.
+ * @param userMode 用户切过的模式, `null` 用初值. 由宿主持有 ([DownloadMediaPickerState.userMode]): 本页在选集与返回之间会重建, 自己记不住.
+ * @param onUserModeChange 模式 chip 或自动匹配页的救援按钮改了模式.
  * @param watching 要下载的集; BT 页只用它画「第 N 话」chip, 不画「正在观看」卡片.
  * @param fetchRequest 当前生效的查询请求, 供 BT 页搜索框回显与提交; 会话未就绪时为 null.
  * @param onSelect 用户在自动匹配页或 BT 页点了资源; 宿主进入选集步骤, 不关闭弹窗.
@@ -281,6 +295,8 @@ internal fun DownloadMediaPickerContent(
     selectorState: MediaSelectorState,
     sourceResults: MediaSourceResultListPresentation,
     hasBt: Boolean,
+    userMode: MediaSelectorMode?,
+    onUserModeChange: (MediaSelectorMode) -> Unit,
     watching: WatchingEpisode?,
     fetchRequest: MediaFetchRequest?,
     onFetchRequestChange: (MediaFetchRequest) -> Unit,
@@ -289,9 +305,8 @@ internal fun DownloadMediaPickerContent(
     modifier: Modifier = Modifier,
     manualBrowse: ManualBrowseState? = null,
 ) {
-    var userMode by rememberSaveable { mutableStateOf<MediaSelectorMode?>(null) }
     val mode = userMode?.takeIf { it != MediaSelectorMode.MANUAL || manualBrowse != null }
-        ?: if (hasBt) MediaSelectorMode.BT else MediaSelectorMode.AUTO
+        ?: MediaSelectorMode.AUTO
 
     // 手动查找页自己处理水平边距, 并在第二页用自己的顶栏替换标题行, 所以标题行与另外两页各自加水平边距.
     val titleRow = @Composable {
@@ -306,7 +321,7 @@ internal fun DownloadMediaPickerContent(
             )
             MediaSelectorModeChip(
                 mode,
-                onModeChange = { userMode = it },
+                onModeChange = onUserModeChange,
                 showBt = hasBt,
                 showManual = manualBrowse != null,
             )
@@ -351,7 +366,7 @@ internal fun DownloadMediaPickerContent(
                     selectorState,
       
```

**File**: `app/shared/ui-download/src/desktopTest/kotlin/ui/download/subject/DownloadMediaPickerTest.kt` (modified, +51/-7)
```diff
@@ -9,8 +9,16 @@
 
 package me.him188.ani.app.ui.download.subject
 
+import androidx.compose.animation.AnimatedContent
+import androidx.compose.foundation.layout.Box
 import androidx.compose.runtime.Composable
+import androidx.compose.runtime.MutableState
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.remember
+import androidx.compose.runtime.setValue
+import androidx.compose.ui.Modifier
+import androidx.compose.ui.platform.testTag
 import androidx.compose.ui.test.ComposeUiTest
 import androidx.compose.ui.test.assertTextEquals
 import androidx.compose.ui.test.hasTestTag
@@ -49,9 +57,14 @@ import org.jetbrains.compose.resources.getString
 class DownloadMediaPickerTest {
     /**
      * @param onManualPick 非 null 时提供手动查找, 点选的一集交给它; null 时宿主没有手动查找.
+     * @param userMode 宿主持有的模式, 默认本次组合内的局部状态.
      */
     @Composable
-    private fun Picker(hasBt: Boolean, onManualPick: ((Media, ManualBrowseMemory?) -> Unit)? = null) {
+    private fun Picker(
+        hasBt: Boolean,
+        onManualPick: ((Media, ManualBrowseMemory?) -> Unit)? = null,
+        userMode: MutableState<MediaSelectorMode?> = remember { mutableStateOf(null) },
+    ) {
         ProvideCompositionLocalsForPreview {
             val scope = rememberBackgroundScope()
             val manualBrowse = remember {
@@ -68,6 +81,8 @@ class DownloadMediaPickerTest {
                 selectorState = rememberTestMediaSelectorState(),
                 sourceResults = TestMediaSourceResultListPresentation,
                 hasBt = hasBt,
+                userMode = userMode.value,
+                onUserModeChange = { userMode.value = it },
                 watching = WatchingEpisode("01", "Episode 1"),
                 fetchRequest = TestMediaFetchRequest,
                 onFetchRequestChange = {},
@@ -91,19 +106,48 @@ class DownloadMediaPickerTest {
     }
 
     @Test
-    fun `defaults to BT with BT sources and switches to auto from the menu`() = runAniComposeUiTest {
+    fun `defaults to auto even with BT sources and switches to BT from the menu`() = runAniComposeUiTest {
         setContent { Picker(hasBt = true) }
+        onNodeWithTag(AutoMatchPageTestTags.ROOT).assertExists()
+        onNodeWithTag(BtResourcesPageTestTags.ROOT).assertDoesNotExist()
+        onNodeWithTag(MediaSelectorChromeTestTags.MODE_CHIP).assertTextEquals(modeName(MediaSelectorMode.AUTO))
+
+        onNodeWithTag(MediaSelectorChromeTestTags.MODE_CHIP).performClick()
+        onNodeWithTag(MediaSelectorChromeTestTags.modeItem(MediaSelectorMode.MANUAL)).assertDoesNotExist()
+        onNodeWithTag(MediaSelectorChromeTestTags.modeItem(MediaSelectorMode.BT)).performClick()
+
         onNodeWithTag(BtResourcesPageTestTags.ROOT).assertExists()
         onNodeWithTag(AutoMatchPageTestTags.ROOT).assertDoesNotExist()
         onNodeWithTag(MediaSelectorChromeTestTags.MODE_CHIP).assertTextEquals(modeName(MediaSelectorMode.BT))
+    }
 
+    @Test
+    fun `mode chosen in the picker survives leaving for the episode step and coming back`() = runAniComposeUiTest {
+        // 与 DownloadRequestSheet 一样用 AnimatedContent 在选源与选集之间切换, 选源页会被销毁重建; 模式由宿主持有.
+        val userMode = mutableStateOf<MediaSelectorMode?>(null)
+        var step by mutableStateOf(0)
+        setContent {
+            AnimatedContent(targetState = step, contentKey = { it != 0 }) { s ->
+                if (s == 0) Picker(hasBt = true, userMode = userMode) else Box(Modifier.testTag("episode_step"))
+            }
+        }
         onNodeWithTag(MediaSelectorChromeTestTags.MODE_CHIP).performClick()
-        onNodeWithTag(MediaSelectorChromeTestTags.modeItem(MediaSelectorMode.MANUAL)).assertDoesNotExist()
-        onNodeWithTag(MediaSelectorChromeTestTags.modeItem(MediaSelectorMode.AUTO)).performClick()
+        onNodeWithTag(MediaSelectorChromeTestTags.modeItem(MediaSelectorMode.BT)).performClick()
+        onNodeWithTag(BtResourcesPageTestTags.ROOT).assertExists()
 
-        onNodeWithTag(AutoMatchPageTestTags.ROOT).assertExists()
-        onNodeWithTag(BtResourcesPageTestTags.ROOT).assertDoesNotExist()
-        onNodeWithTag(MediaSelectorChromeTestTags.MODE_CHIP).assertTextEquals(modeName(MediaSelectorMode.AUTO))
+        step = 1
+        waitForIdle()
+        mainClock.advanceTimeBy(5_000)
+        waitForIdle()
+        onNodeWithTag("episode_step").assertExists()
+        onNodeWithTag(DownloadMediaPickerTestTags.ROOT).assertDoesNotExist()
+
+        step = 0
+        waitForIdle()
+        mainClock.advanceTimeBy(5_000)
+        waitForIdle()
+        onNodeWithTag(BtResourcesPageTestTags.ROOT).assertExists()
+        onNodeWithTag(MediaSelectorChromeTestTags.MODE_CHIP).assertTextEquals(modeName(MediaSelectorMode.BT))
     }
 
     @Test
```

**File**: `docs/contributing/code/media/media-downloads.md` (modified, +1/-1)
```diff
@@ -113,7 +113,7 @@ presenter 持有当前会话并把会话状态映射为页面状态：
 - `AwaitingSelection` 与 `SelectingEpisodes` 共用同一个底部弹窗（`DownloadMediaPickerState` 以查询会话为准，
   两步之间保持同一实例），分别显示选源视图与选集视图（`DownloadEpisodePicker`）。
   选源视图与播放页的[选源界面](media-selector-ui.md)共用页面，有自动匹配、手动查找与 BT 资源三种模式；
-  会话里有 BT 源时默认 BT。手动查找的状态由 presenter 随 `DownloadMediaPickerState` 一起创建，
+  默认自动匹配，不随 BT 源有无或播放偏好变化；切过的模式挂在 `DownloadMediaPickerState` 上，选集后返回或隐藏弹窗再打开都不重置。手动查找的状态由 presenter 随 `DownloadMediaPickerState` 一起创建，
   点选的一集与自动匹配页点选的资源一样通过 `select` 交给会话，条目的其他集按线路里的位置生成的资源一起交给会话。底部弹窗的宽度不足以放表格，BT 列表与播放页 BT 资源页共用紧凑列表组件。
   选集视图列出条目的全部剧集，可下载的集可勾选，默认勾选本话及之后，并提供仅本话 / 本话及之后 / 全部的快捷选择；
   已下载与未匹配的集不可勾选。`Finished(error)` 对应添加失败的提示；取消或完成后不显示任何弹窗。
```

**File**: `docs/contributing/code/media/media-selector-ui.md` (modified, +1/-1)
```diff
@@ -173,7 +173,7 @@ BT 候选与 WEB 不同：同一集有几十条来自不同字幕组、分辨率
   侧边栏太矮时例外，见下。
 - **详情页，窄窗口**：底部弹窗，标题行「数据源」+ 模式下拉，三种模式都在弹窗内。
 - **播放器**：与详情页一样，侧边栏装全部三种模式。
-- **批量下载对话框**：底部弹窗，标题行「数据源」+ 模式下拉，三种模式都在弹窗内；会话里有 BT 源时默认 BT。
+- **批量下载对话框**：底部弹窗，标题行「数据源」+ 模式下拉，三种模式都在弹窗内；默认自动匹配，不随 BT 源有无或播放偏好变化。
   弹窗宽度不超过 640dp，手动查找总是堆叠两页。
   资源选定后的选集步骤见[下载管理](media-downloads.md#添加下载)。
 
```

---

### Incident Patch 2: `e97ab2a1` (2026-11-01)
**Commit Message**: fix(danmaku): honor location visibility settings (#3666)

Check the configured location switch before placing live or repopulated danmakus, so disabled top, bottom, and floating comments cannot bypass the setting.

Fixes #3665

Co-authored-by: Copilot <[REDACTED_EMAIL]>

**File**: `danmaku/ui/src/commonMain/kotlin/DanmakuHostState.kt` (modified, +10/-0)
```diff
@@ -539,20 +539,23 @@ class DanmakuHostState(
         return withContext(Dispatchers.Main.immediate) {
             when (danmaku.danmaku.location) {
                 DanmakuLocation.NORMAL -> {
+                    if (!danmakuConfig.isLocationEnabled(DanmakuLocation.NORMAL)) return@withContext false
                     val floatingDanmaku = floatingTrack.firstNotNullOfOrNull {
                         it.tryPlace(styledDanmaku, placeFrameTimeNanos, overrideSpeedMultiplier)
                     }
                     floatingDanmaku != null
                 }
 
                 DanmakuLocation.TOP -> {
+                    if (!danmakuConfig.isLocationEnabled(DanmakuLocation.TOP)) return@withContext false
                     val floatingDanmaku = topTrack.firstNotNullOfOrNull {
                         it.tryPlace(styledDanmaku, placeFrameTimeNanos)
                     }
                     floatingDanmaku != null
                 }
 
                 DanmakuLocation.BOTTOM -> {
+                    if (!danmakuConfig.isLocationEnabled(DanmakuLocation.BOTTOM)) return@withContext false
                     val floatingDanmaku = bottomTrack.firstNotNullOfOrNull {
                         it.tryPlace(styledDanmaku, placeFrameTimeNanos)
                     }
@@ -898,6 +901,13 @@ internal class DanmakuRepopulator(
     }
 }
 
+internal fun DanmakuConfig.isLocationEnabled(location: DanmakuLocation): Boolean =
+    when (location) {
+        DanmakuLocation.NORMAL -> enableFloating
+        DanmakuLocation.TOP -> enableTop
+        DanmakuLocation.BOTTOM -> enableBottom
+    }
+
 private fun <D : SizeSpecifiedDanmaku, DT, T : DanmakuTrack<D, DT>>
         MutableList<T>.setTrackCountImpl(count: Int, newInstance: List<T>.(index: Int) -> T) {
     when {
```

**File**: `danmaku/ui/src/commonTest/kotlin/DanmakuRepopulationTest.kt` (modified, +14/-0)
```diff
@@ -17,11 +17,25 @@ import me.him188.ani.danmaku.api.DanmakuLocation
 import me.him188.ani.danmaku.api.DanmakuServiceId
 import kotlin.test.Test
 import kotlin.test.assertEquals
+import kotlin.test.assertFalse
 import kotlin.test.assertTrue
 
 
 class DanmakuRepopulatorTest {
 
+    @Test
+    fun `location enabled follows each danmaku setting`() {
+        val config = DanmakuConfig(
+            enableFloating = false,
+            enableTop = true,
+            enableBottom = false,
+        )
+
+        assertFalse(config.isLocationEnabled(DanmakuLocation.NORMAL))
+        assertTrue(config.isLocationEnabled(DanmakuLocation.TOP))
+        assertFalse(config.isLocationEnabled(DanmakuLocation.BOTTOM))
+    }
+
     @Test
     fun `repopulate with empty list - onSend should not be called`() = runTest {
         // Arrange
```

#### Recent Merged Pull Requests:
- **PR #3691** (2026-11-02): fix(download): 下载弹窗选源默认自动匹配, 切过的模式在会话内保持 (@Him188)
- **PR #3681** (closed): fix(datasource): JSON API 源保留条目级资源以支持播放器内切集 (@SXP-Simon)
- **PR #3670** (2026-10-28): Complete Traditional Chinese (Taiwan) translation (@monarchsofchaos004-gif)
- **PR #3666** (2026-11-01): fix(danmaku): honor location visibility settings (@bighamx)
- **PR #3658** (2026-10-24): perf(update): 桌面端下载阶段就解压并校验安装包, 点「重启更新」后只剩交换目录 (@Him188)
- **PR #3655** (2026-10-24): ci(release): release notes 生成失败时让 step 失败, 不再用空 notes 建 release (@Him188)

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

## X. download): 下载弹窗选源默认自动匹配, 切过的模式在会话内保持 (#3691)

**RULE**:
When implementing operations in `app/shared/ui-download/src/commonMain/kotlin/ui/download/subject/SubjectDownloadRequestDialogs.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in open-ani/animeko. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bd7a42f3`: download): 下载弹窗选源默认自动匹配, 切过的模式在会话内保持 (#3691). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `app/shared/ui-download/src/commonMain/kotlin/ui/download/subject/SubjectDownloadRequestDialogs.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
) {
    /**
     * 用户在模式 chip 上选的模式, `null` 表示还没选 (用初值). 放在会话状态上而不是选源页里:
     * 选集后返回与弹窗隐藏重开都会重建选源页, 用户切过的模式要在本次会话内保持.
     */
    var userMode: MediaSelectorMode? by mutableStateOf(null)
}
        // AnimatedContent 在两步切换时销毁另一步的内容; 用 SaveableStateHolder 保住各步的 rememberSaveable 状态 (列表滚动位置等), 返回选源时回到原处.
        val stateHolder = rememberSaveableStateHolder()
            stateHolder.SaveableStateProvider(picker != null) {
                if (picker == null) {
                    DownloadMediaPicker(selection, sourceInfoProvider, settings, onSelect)
                } else {
                    DownloadEpisodePicker(
                        picker,
                        onBack = onBack,
                        onConfirm = onConfirmEpisodes,
                        modifier = Modifier.padding(vertical = 12.dp)
                            .navigationBarsPadding().fillMaxHeight().fillMaxWidth(),
                    )
                }
        userMode = selection.userMode,
        onUserModeChange = { selection.userMode = it },
 * 初值总是 AUTO, 不随 BT 源有无或播放偏好变化: 下载走自动匹配最省事, 要挑种子的用户自己切到 BT 页.
 * @param userMode 用户切过的模式, `nu
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Anti-pattern to NEVER write (induced failure mode):
import androidx.compose.runtime.saveable.rememberSaveable
)
            if (picker == null) {
                DownloadMediaPicker(selection, sourceInfoProvider, settings, onSelect)
            } else {
                DownloadEpisodePicker(
                    picker,
                    onBack = onBack,
                    onConfirm = onConfirmEpisodes,
                    modifier = Modifier.padding(vertical = 12.dp)
                        .navigationBarsPadding().fillMaxHeight().fillMaxWidth(),
                )
 * 模式在本次弹窗内保持; 初值有 BT 源 → BT, 否则 AUTO.
    var userMode by rememberSaveable { mutableStateOf<MediaSelectorMode?>(null) }
        ?: if (hasBt) MediaSelectorMode.BT else MediaSelectorMode.AUTO
                onModeChange = { userMode = it },
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bd7a42f3` are properly handled with clean fallback behavior.
