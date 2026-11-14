# Verification Protocol: Verification Protocol: Empirical Defect Shield for open-ani/animeko

<!-- PROVENANCE_START
{
  "source_repository": "open-ani/animeko",
  "source_url": "https://github.com/open-ani/animeko",
  "source_version": "d54ba004",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-14T18:26:28.596Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-open-ani-animeko",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [open-ani/animeko](https://github.com/open-ani/animeko) (Revision: `d54ba004`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-14T18:26:28.596Z`  
> **Learning ID**: `learn-github-open-ani-animeko`


## 1. Scope & Verification Target
- **Target Repository**: `open-ani/animeko` (Commit: `d54ba004`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): open-ani/animeko

> **Canonical Artifact**: `07_PROJECT_LEARNING/open-ani-animeko-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/open-ani/animeko](https://github.com/open-ani/animeko))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-14T18:26:27.350Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `open-ani/animeko`
- **Description**: 集找番、追番、看番的一站式弹幕追番平台，云收藏同步 (Bangumi)，离线缓存，BitTorrent，弹幕云过滤。100% Kotlin/Compose Multiplatform
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 21751 stars

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
- **Issue #3716** (2026-11-14): **fix(subject): 人物详情的参与作品显示配音, 不再只有主题歌演出**
  *Symptoms*: ## 背景  声优详情页的「参与作品」几乎全部显示「主题歌演出」，配音过的作品不在里面。  Bangumi 的配音关系不是一种职位，服务端的 `works` 接口原先只返回制作职位，所以声优名下只剩唱主题歌、插入歌的条目。数据本身与 Bangumi 一致，但看起来像是这位声优没有给作品配音。  ## 改动  依赖服务端 open-ani/ani-api-server#137：`works` 并入配音过的条目，每项带 `castCount`（在该条目配音的角色数）。  - `PersonWorkInfo` 新增 `castCount` 和 `roleNames`：有配音时「配音」排在最前，之后是各职位的中文名。 - 横滑条副标题显示第一项；「查看全部」和 TV 端显示全部（如「配音、主题歌演出」）。 - 用 `generateOpenApiForAnimeko` 重新生成了 `AniPersonWork` / `AniPersonDetails` / `PersonsAniApi`。重新生成还带出了另外四个 API 文件里与本次无关的变化，没有提交。  ## 合并顺序  生成的 `AniPersonWork.castCount` 是必填字段，连没有更新的服务端时参与作品会加载失败。需要等 open-ani/ani-api-server#137 部署后再合并。  ## 验证  - 新增 `PersonWorkInfoTest`（4 个用例）：配音排在职位之前、只配音、只有职位、没有中文名的职位被跳过。 - `:app:shared:ui-subject:compileKotlinDesktop` 与 `:app:shared:ui-subject-tv:compileAndroidMain` 编译通过。 - 没有启动 App 检查实际界面。  🤖 Generated with [Claude Code](https://claude.com/claude-code) 

- **Issue #3714** (2026-11-14): **fix(player): prevent iOS video enhancement menu crash**
  *Symptoms*: Closes #3713  Opening the video enhancement menu can give Material's scrollable dropdown an infinite maximum height on iOS, triggering `checkScrollableContainerConstraints`. Limit the menu to 320 dp while respecting smaller parent constraints; longer content remains scrollable.  Verification:  - Android: built the debug APK and installed it on the Android 15 Pixel 8 Pro emulator. Used `android-ui-verify` to open the menu through More options in portrait, select Performance and Quality, reopen and confirm the current option is disabled, return to Off, and open the dedicated enhancement button in landscape fullscreen. Inspected screenshots and accessibility state. Android remained in resource selection, so this verifies menu interaction rather than decoded video playback. - macOS: built and launched the packaged app using `desktop-ui-verify`. Opened the enhancement menu with a video loaded, selected Performance and Quality, reopened to confirm the disabled current option, and returned to Off. Video playback continued during the Quality menu check. Inspected window screenshots at 1440 × 900. - `git diff --check` passes.  Screenshot upload failed: the `github-image-upload` skill's Chrome connection returned a `timeoutMs` error and then closed its native pipe before an upload could be made. No images are embedded, and verification screenshots are not committed.  
  **Post-Mortem & Fix Analysis**:
  > remove the unit test @openanibot 
  > Removed the unit test in 88d46fe1c4 and updated the PR description. The app code is unchanged; git diff --check passes.

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

### Incident Patch 1: `51648f45` (2026-11-14)
**Commit Message**: fix(player): prevent iOS video enhancement menu crash (#3714)

* fix(player): bound video enhancement dropdown height

* test(player): remove enhancement dropdown tests

---------

Co-authored-by: openanibot <[REDACTED_EMAIL]>

**File**: `app/shared/src/commonMain/kotlin/ui/subject/episode/details/components/VideoEnhancementDropdown.kt` (modified, +5/-1)
```diff
@@ -9,6 +9,7 @@
 
 package me.him188.ani.app.ui.subject.episode.details.components
 
+import androidx.compose.foundation.layout.heightIn
 import androidx.compose.foundation.layout.padding
 import androidx.compose.material3.DropdownMenu
 import androidx.compose.material3.DropdownMenuItem
@@ -33,6 +34,7 @@ fun VideoEnhancementDropdown(
     videoEnhancement: VideoEnhancementController,
     showDropdown: Boolean,
     onDismissRequest: () -> Unit,
+    modifier: Modifier = Modifier,
 ) {
     val mode by videoEnhancement.mode.collectAsState()
     val title = stringResource(Lang.video_player_video_enhancement)
@@ -43,6 +45,8 @@ fun VideoEnhancementDropdown(
     DropdownMenu(
         expanded = showDropdown,
         onDismissRequest = onDismissRequest,
+        // Popup hosts can measure with unbounded height; the menu's scroll viewport must be finite.
+        modifier = modifier.heightIn(max = 320.dp),
     ) {
         Text(
             title,
@@ -72,4 +76,4 @@ fun VideoEnhancementDropdown(
             )
         }
     }
-}
\ No newline at end of file
+}
```

---

### Incident Patch 2: `d54ba004` (2026-11-14)
**Commit Message**: fix(subject): 人物详情的参与作品显示配音, 不再只有主题歌演出 (#3716)

声优详情页的参与作品几乎全部显示 "主题歌演出", 配音过的作品不在里面: Bangumi 的
配音关系不是一种职位, 服务端的 works 接口原先只返回制作职位.

服务端 (open-ani/ani-api-server#137) 把配音过的条目并入 works, 每项带 castCount.
客户端据此在参与方式里把 "配音" 排在最前: 横滑条副标题显示第一项, "查看全部" 和
TV 端显示全部. 重新生成了 PersonsAniApi 相关的客户端模型.

Co-authored-by: Claude Fable 5.2 <[REDACTED_EMAIL]>

**File**: `app/shared/app-data/src/commonMain/kotlin/data/models/person/PersonDetailsInfo.kt` (modified, +17/-3)
```diff
@@ -14,6 +14,7 @@ import me.him188.ani.app.data.models.subject.CharacterInfo
 import me.him188.ani.app.data.models.subject.CharacterRole
 import me.him188.ani.app.data.models.subject.PersonInfo
 import me.him188.ani.app.data.models.subject.PersonPosition
+import me.him188.ani.app.data.models.subject.nameCn
 
 /**
  * 人物 (声优/制作人员) 详情页数据.
@@ -27,7 +28,7 @@ data class PersonDetailsInfo(
     val infobox: List<InfoboxRowInfo>,
     val collects: Int,
     val commentCount: Int,
-    /** 参与作品数 (去重后的条目数). */
+    /** 参与作品数 (去重后的条目数, 含只配音的条目). */
     val workCount: Int,
     /** 出演角色数 (条目 × 角色). */
     val castCount: Int,
@@ -69,12 +70,25 @@ data class PersonSubjectSummary(
     val displayName get() = nameCn.takeIf { it.isNotBlank() } ?: name
 }
 
-/** 人物参与的一部作品及其全部职位. */
+/** 人物参与的一部作品: 担任的全部职位, 以及配音. */
 @Immutable
 data class PersonWorkInfo(
     val subject: PersonSubjectSummary,
+    /** 制作职位. 只配音的作品为空. */
     val positions: List<PersonPosition>,
-)
+    /** 在这部作品中配音的角色数. Bangumi 里配音不是一种职位, 所以不在 [positions] 里. */
+    val castCount: Int = 0,
+) {
+    /**
+     * 用于展示的参与方式: 配音在前, 之后是各职位的中文名. 已去重, 没有可展示的名字时为空.
+     *
+     * 配音排在最前, 因为声优的职位基本都是主题歌演出, 只显示职位会让人以为这位声优没有给作品配音.
+     */
+    val roleNames: List<String> = buildList {
+        if (castCount > 0) add("配音")
+        positions.mapNotNullTo(this) { it.nameCn }
+    }.distinct()
+}
 
 /** 人物在一部作品中配音的一个角色. */
 @Immutable
```

**File**: `app/shared/app-data/src/commonMain/kotlin/data/repository/person/PersonDetailsRepository.kt` (modified, +1/-0)
```diff
@@ -100,6 +100,7 @@ class PersonDetailsRepository(
                     PersonWorkInfo(
                         subject = it.subject.toSummary(),
                         positions = it.positions.map(::PersonPosition),
+                        castCount = it.castCount,
                     )
                 },
             )
```

**File**: `app/shared/app-data/src/commonTest/kotlin/data/models/person/PersonWorkInfoTest.kt` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+/*
+ * Copyright (C) 2024-2026 OpenAni and contributors.
+ *
+ * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
+ * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
+ *
+ * https://github.com/open-ani/ani/blob/main/LICENSE
+ */
+
+package me.him188.ani.app.data.models.person
+
+import me.him188.ani.app.data.models.subject.PersonPosition
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+class PersonWorkInfoTest {
+    private val subject = PersonSubjectSummary(1, "name", "名字", "")
+
+    @Test
+    fun `voice acting comes before staff positions`() {
+        val work = PersonWorkInfo(
+            subject,
+            listOf(PersonPosition.ThemeSongPerformance, PersonPosition.InsertedSongPerformance),
+            castCount = 1,
+        )
+        assertEquals(listOf("配音", "主题歌演出", "插入歌演出"), work.roleNames)
+    }
+
+    @Test
+    fun `work the person only voiced shows voice acting`() {
+        assertEquals(listOf("配音"), PersonWorkInfo(subject, emptyList(), castCount = 3).roleNames)
+    }
+
+    @Test
+    fun `staff only work shows positions without voice acting`() {
+        val work = PersonWorkInfo(subject, listOf(PersonPosition.Director, PersonPosition.Director))
+        assertEquals(listOf("导演"), work.roleNames)
+    }
+
+    @Test
+    fun `positions without a known name are skipped`() {
+        assertEquals(emptyList(), PersonWorkInfo(subject, listOf(PersonPosition(139))).roleNames)
+    }
+}
```

**File**: `app/shared/ui-subject/src/androidTv/kotlin/ui/subject/person/TvPeopleDetailsScreen.kt` (modified, +1/-1)
```diff
@@ -166,7 +166,7 @@ internal fun TvPeopleDetailsScreen(
             add(peopleSection("works", stringResource(Lang.person_details_works), it,
                 placeholder = { TvDetailsLandscapePlaceholder(it) },
                 key = { record -> record.subject.subjectId.toString() }) { record, itemModifier ->
-                TvPeopleWorkCard(record.subject, record.positions.mapNotNull { position -> position.nameCn }.distinct().joinToString(" · "), itemModifier) {
+                TvPeopleWorkCard(record.subject, record.roleNames.joinToString(" · "), itemModifier) {
                     navigate(TvPeopleIntent.OpenSubject(record.subject))
                 }
             })
```

**File**: `app/shared/ui-subject/src/commonMain/kotlin/ui/subject/person/PeopleDetailsPage.kt` (modified, +2/-2)
```diff
@@ -470,7 +470,7 @@ private fun PersonStrips(
     ) { work ->
         PeopleSubjectCard(
             subject = work.subject,
-            caption = work.positions.firstNotNullOfOrNull { it.nameCn },
+            caption = work.roleNames.firstOrNull(),
             onClick = { navigation.onClickSubject(work.subject) },
         )
     }
@@ -500,7 +500,7 @@ private fun PersonStrips(
             PersonCard(
                 avatarUrl = work.subject.imageLarge,
                 name = work.subject.displayName,
-                relation = work.positions.mapNotNull { it.nameCn }.distinct().joinToString("、"),
+                relation = work.roleNames.joinToString("、"),
                 modifier = Modifier
                     .clip(MaterialTheme.shapes.small)
                     .clickable { navigation.onClickSubject(work.subject) },
```

**File**: `client/src/commonMain/gen/me/him188/ani/client/apis/PersonsAniApi.kt` (modified, +2/-2)
```diff
@@ -298,8 +298,8 @@ open class PersonsAniApi : ApiClient {
 
 
     /**
-     * 获取人物参与的作品 (按条目分组, 含全部职位), 新条目在前.
-     * 获取人物参与的作品 (按条目分组, 含全部职位), 新条目在前.
+     * 获取人物参与的作品 (按条目分组, 含全部职位和配音), 新条目在前. 只配音、没有制作职位的条目也在其中, 此时 &#x60;positions&#x60; 为空.
+     * 获取人物参与的作品 (按条目分组, 含全部职位和配音), 新条目在前. 只配音、没有制作职位的条目也在其中, 此时 &#x60;positions&#x60; 为空.
      * @param personId
      * @param offset  (optional)
      * @param limit  (optional)
```

**File**: `client/src/commonMain/gen/me/him188/ani/client/models/AniPersonDetails.kt` (modified, +2/-2)
```diff
@@ -29,7 +29,7 @@ import kotlinx.serialization.encoding.*
  * @param career 职业, 如 `seiyu`, `mangaka` (Bangumi career 常量)
  * @param collects 收藏人数
  * @param commentCount 评论数 (吐槽箱)
- * @param workCount 参与作品数 (去重后的条目数)
+ * @param workCount 参与作品数 (去重后的条目数, 含只配音的条目)
  * @param castCount 出演角色数 (条目 × 角色)
  */
 @Serializable
@@ -47,7 +47,7 @@ data class AniPersonDetails (
     /* 评论数 (吐槽箱) */
     @SerialName(value = "commentCount") @Required val commentCount: kotlin.Int,
 
-    /* 参与作品数 (去重后的条目数) */
+    /* 参与作品数 (去重后的条目数, 含只配音的条目) */
     @SerialName(value = "workCount") @Required val workCount: kotlin.Int,
 
     /* 出演角色数 (条目 × 角色) */
```

**File**: `client/src/commonMain/gen/me/him188/ani/client/models/AniPersonWork.kt` (modified, +7/-3)
```diff
@@ -26,16 +26,20 @@ import kotlinx.serialization.encoding.*
  *
  *
  * @param subject
- * @param positions 该人物在此条目担任的全部职位 (Bangumi position 常量)
+ * @param positions 该人物在此条目担任的全部职位 (Bangumi position 常量). 只配音的条目为空
+ * @param castCount 该人物在此条目配音的角色数. 大于 0 表示参与了配音
  */
 @Serializable
 
 data class AniPersonWork (
 
     @SerialName(value = "subject") @Required val subject: AniSubjectSummary,
 
-    /* 该人物在此条目担任的全部职位 (Bangumi position 常量) */
-    @SerialName(value = "positions") @Required val positions: kotlin.collections.List<kotlin.Int>
+    /* 该人物在此条目担任的全部职位 (Bangumi position 常量). 只配音的条目为空 */
+    @SerialName(value = "positions") @Required val positions: kotlin.collections.List<kotlin.Int>,
+
+    /* 该人物在此条目配音的角色数. 大于 0 表示参与了配音 */
+    @SerialName(value = "castCount") @Required val castCount: kotlin.Int
 
 ) {
 
```

#### Recent Merged Pull Requests:
- **PR #3716** (2026-11-14): fix(subject): 人物详情的参与作品显示配音, 不再只有主题歌演出 (@Him188)
- **PR #3714** (2026-11-14): fix(player): prevent iOS video enhancement menu crash (@openanibot)
- **PR #3709** (2026-11-14): perf(danmaku): bound group opacity compositing to occupied pixels (@myot233)
- **PR #3708** (2026-11-14): perf(danmaku): avoid per-frame iterator allocations (@myot233)
- **PR #3702** (2026-11-09): feat(comment): 评论详情页与评论被回复的通知 (@Him188)
- **PR #3701** (2026-11-07): build(deps): DataStore 升级到 1.3.0, 修复并发读写时设置读成默认值 (@Him188)

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

## X. player): prevent iOS video enhancement menu crash

**RULE**:
When implementing operations in `app/shared/src/commonMain/kotlin/ui/subject/episode/details/components/VideoEnhancementDropdown.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in open-ani/animeko. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `51648f45`: player): prevent iOS video enhancement menu crash. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `app/shared/src/commonMain/kotlin/ui/subject/episode/details/components/VideoEnhancementDropdown.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
import androidx.compose.foundation.layout.heightIn
    modifier: Modifier = Modifier,
        // Popup hosts can measure with unbounded height; the menu's scroll viewport must be finite.
        modifier = modifier.heightIn(max = 320.dp),
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
}
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `51648f45` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
