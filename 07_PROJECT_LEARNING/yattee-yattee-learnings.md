# Forensic Learning Record (Deep Inspection): yattee/yattee

> **Canonical Artifact**: `07_PROJECT_LEARNING/yattee-yattee-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/yattee/yattee](https://github.com/yattee/yattee))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:28:37.318Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yattee/yattee`
- **Description**: Privacy oriented video player for iOS, tvOS and macOS
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3729 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Yattee/Core/AppEnvironment.swift`
```
//
//  AppEnvironment.swift
//  Yattee
//
//  Dependency injection container for the application.
//

import Foundation
import SwiftUI
import SwiftData

/// Main dependency injection container that holds all app services.
/// Passed through the SwiftUI environment to provide dependencies to views.
@MainActor
@Observable
final class AppEnvironment {
    // MARK: - Services

    let settingsManager: SettingsManager
    let instancesManager: InstancesManager
    let contentService: ContentService
    let instanceDetector: InstanceDetector
    let dataManager: DataManager
    let subscriptionService: SubscriptionService
    let navigationCoordinator: NavigationCoordinator
    let downloadManager: DownloadManager
    let downloadSettings: DownloadSettings
    let playerService: PlayerService
    let queueManager: QueueManager
    let cloudKitSync: CloudKitSyncEngine
    let deArrowBrandingProvider: DeArrowBrandingProvider
    let notificationManager: NotificationManager
    let backgroundRefreshManager: BackgroundRefreshManager
    let mediaSourcesManager: MediaSourcesManager
    let webDAVClient: WebDAVClient
    let webDAVClientFactory: WebDAVClientFactory
    let smbClient: SMBClient
    let localFileClient: LocalFileClient
    let urlSessionFactory: URLSessionFactory
    let httpClientFactory: HTTPClientFactory
    let localNetworkService: LocalNetworkService
    let remoteControlCoordinator: RemoteControlCoordinator
    let networkShareDiscoveryService: NetworkShareDiscoveryService
    let connectivityMonitor: ConnectivityMonitor
    let httpClient: HTTPClient
    let toastManager: ToastManager
    let handoffManager: HandoffManager
    let invidiousCredentialsManager: InvidiousCredentialsManager
    let pipedCredentialsManager: PipedCredentialsManager
    let basicAuthCredentialsManager: BasicAuthCredentialsManager
    let homeInstanceCache: HomeInstanceCache
    let invidiousAPI: InvidiousAPI
    let pipedAPI: PipedAPI
    let subscriptionAccountValidator: SubscriptionAccountValidator
    let playerControlsLayoutService: PlayerControlsLayoutService
    let legacyMigrationService: LegacyDataMigrationService
    let sourcesSettings: SourcesSettings

    /// Center-section settings of the active player controls preset, cached for
    /// synchronous access. Menu bar commands read seek durations from here since
    /// they cannot await the layout service actor.
    private(set) var activeControlsCenterSettings: CenterSectionSettings = .default

    @ObservationIgnored private var controlsSettingsObservers: [NSObjectProtocol] = []

    // MARK: - Shared Instance

    /// The single, process-wide app environment.
    ///
    /// SwiftUI may evaluate a `@State` property's default-value autoclosure more
    /// than once (it keeps only the first result but still runs the side effects
    /// of the discarded instances). Constructing `AppEnvironment` more than once
    /// would create multiple `DownloadManager`s — and therefore multiple
    /// background `URLSession`s registered under the same identifier — causing
    /// download-completion delegate callbacks to be delivered to an instance
    /// whose `activeDownloads` is empty (the finished file is then dropped).
    /// Referencing this `static let` from the App's `@State` guarantees exactly
    /// one instance for the lifetime of the process.
    static let shared = AppEnvironment()

    // MARK: - Initialization

    init(
        httpClient: HTTPClient? = nil,
        settingsManager: SettingsManager? = nil,
        instancesManager: InstancesManager? = nil,
        dataManager: DataManager? = nil,
        navigationCoordinator: NavigationCoordinator? = nil,
        downloadManager: DownloadManager? = nil
    ) {
        let client = httpClient ?? HTTPClient()
        self.httpClient = client

        let settings = settingsManager ?? SettingsManager()
        self.settingsManager = settings

        // Configure HTTP client with custom User-Agent
        Task {
            await client.setUserAgent(settings.customUserAgent)
            await client.setRandomizeUserAgentPerRequest(settings.randomizeUserAgentPerRequest)
        }

        let instances = instancesManager ?? InstancesManager(settingsManager: settings)
        instances.setSettingsManager(settings)
        self.instancesManager = instances

        // Initialize Basic Auth Credentials Manager early (needed for ContentService)
        let basicAuthCreds = BasicAuthCredentialsManager()
        basicAuthCreds.settingsManager = settings
        self.basicAuthCredentialsManager = basicAuthCreds

        let contentSvc = ContentService(httpClient: client, basicAuthCredentialsManager: basicAuthCreds)
        self.contentService = contentSvc
        self.instanceDetector = InstanceDetector(httpClient: client)
        self.navigationCoordinator = navigationCoordinator ?? NavigationCoordinator()
        self.downloadManager = downloadManager ?? DownloadManager()
        self.downloadSettings = DownloadSettings()

        // Initialize DataManager, falling back to in-memory for failures
        let dm: DataManager
        if let manager = dataManager {
            dm = manager
        } else {
            do {
                dm = try DataManager(iCloudSyncEnabled: settings.iCloudSyncEnabled)
            } catch {
                // Fall back to in-memory storage if persistent storage fails
                dm = try! DataManager(inMemory: true)
            }
        }
        self.dataManager = dm

        // Initialize Invidious Credentials Manager (needed for SubscriptionService)
        let invidiousCreds = InvidiousCredentialsManager()
        invidiousCreds.settingsManager = settings
        self.invidiousCredentialsManager = invidiousCreds

        // Initialize Piped Credentials Manager
        let pipedCreds = PipedCredentialsManager()
        pipedCreds.settingsManager = settings
        self.pipedCredentialsManager = pipedCreds

        // Initialize Invidious API (used by SubscriptionService and SubscriptionFeedCache)
        let invidiousAPI = InvidiousAPI(httpClient: client)
        self.invidiousAPI = invidiousAPI

        // Initialize Piped API (used by SubscriptionService and SubscriptionFeedCache)
        let pipedAPI = PipedAPI(httpClient: client)
        self.pipedAPI = pipedAPI

        // Initialize SubscriptionService with all required dependencies
        self.subscriptionService = SubscriptionService(
            dataManager: dm,
            settingsManager: settings,
            instancesManager: instances,
            invidiousCredentialsManager: invidiousCreds,
            pipedCredentialsManager: pipedCreds,
            invidiousAPI: invidiousAPI,
            pipedAPI: pipedAPI
        )

        // Initialize CloudKit Sync Engine
        let cloudKit = CloudKitSyncEngine(
            dataManager: dm,
            settingsManager: settings,
            instancesManager: instances
        )
        self.cloudKitSync = cloudKit
        dm.cloudKitSync = cloudKit

        // Initialize DeArrow with low-priority networking
        let lowPrioritySession = URLSessionFactory.shared.lowPrioritySession()
        let deArrowHTTPClient = HTTPClient(session: lowPrioritySession)
        let deArrowAPI = DeArrowAPI(httpClient: deArrowHTTPClient, urlSession: lowPrioritySession)
        let deArrowProvider = DeArrowBrandingProvider(api: deArrowAPI)
        deArrowProvider.setSettingsManager(settings)
        self.deArrowBrandingProvider = deArrowProvider

        // Initialize PlayerService
        let downloads = self.downloadManager
        let player = PlayerService(
            httpClient: client,
            contentService: contentSvc,
            dataManager: dm
        )
        player.setInstancesManager(instances)
        player.setSettingsManager(settings)
        player.setDownloadManager(downloads)
        player.setNavigationCoordinator(self.navigationCoordinator)
        player.setDeArrowBrandingProvider(deArrowProvider)
        self.playerService = player

        // Initialize QueueManager
        let queue = QueueManager(contentService: contentSvc)
        queue.setPlayerState(player.state)
        queue.setPlayerService(player)
        queue.setSettingsManager(settings)
        queue.setInstancesManager(instances)
        queue.setDownloadManager(downloads)
        player.setQueueManager(queue)
        self.queueManager = queue

        // Initialize Notification & Background Refresh managers
        let notifManager = NotificationManager()
        #if !os(tvOS)
        notifManager.registerNotificationCategories()
        #endif
        self.notificationManager = notifManager

        let bgRefreshManager = BackgroundRefreshManager(notificationManager: notifManager)
        self.backgroundRefreshManager = bgRefreshManager

        // Initialize URL Session and Client Factories
        let sessionFactory = URLSessionFactory.shared
        self.urlSessionFactory = sessionFactory
        self.httpClientFactory = HTTPClientFactory(sessionFactory: sessionFactory)
        self.webDAVClientFactory = WebDAVClientFactory(sessionFactory: sessionFactory)

        // Initialize Media Sources components
        let mediaSources = MediaSourcesManager(settingsManager: settings)
        self.mediaSourcesManager = mediaSources
        mediaSources.setDataManager(dm)
        
        // Initialize media clients
        self.webDAVClient = WebDAVClient()
        self.smbClient = SMBClient()
        self.localFileClient = LocalFileClient()
        
        // Wire up media services to player
        player.setMediaSourcesManager(mediaSources)
        self.navigationCoordinator.setMediaSourcesManager(mediaSources)
        player.setSMBClient(self.smbClient)
        player.setWebDAVClient(self.webDAVClient)
        player.setLocalFileClient(self.localFileClient)
        
        // Wire up SMB client to check if SMB playback is active
        // This prevents crashes from concurrent libsmbcli
```

### Core Architecture Module: `Yattee/Core/AppGroup.swift`
```
import Foundation

enum AppGroup {
    static let identifier = "group.stream.yattee.app.shared"

    /// UserDefaults key holding an ordered [String] of enabled TopShelfSection raw values.
    static let enabledSectionsKey = "topShelf.enabledSections"

    static var defaults: UserDefaults {
        UserDefaults(suiteName: identifier) ?? .standard
    }
}

```

### Core Architecture Module: `Yattee/Core/AppIdentifiers.swift`
```
import Foundation

/// Centralized app identifiers - single source of truth for all app-wide identifiers.
enum AppIdentifiers {
    // MARK: - Base Identifier

    static let bundleIdentifier = "stream.yattee.app"

    // MARK: - iCloud

    static var iCloudContainer: String {
        "iCloud.\(bundleIdentifier)"
    }

    // MARK: - Background Tasks

    static var backgroundFeedRefresh: String {
        "\(bundleIdentifier).feedRefresh"
    }

    // MARK: - User Activities (Handoff)

    static var handoffActivityType: String {
        "\(bundleIdentifier).activity"
    }

    // MARK: - URL Sessions

    static let downloadSession = "stream.yattee.downloads"

    // MARK: - Logging

    static var logSubsystem: String {
        bundleIdentifier
    }
}

```

### Core Architecture Module: `Yattee/Core/FeedCache.swift`
```
//
//  FeedCache.swift
//  Yattee
//
//  Persistent on-device feed cache for subscription videos.
//  Stores feed data on disk to enable fast loading on app launch.
//

import Foundation

/// Persistent feed cache that stores subscription videos on disk.
/// This is a local-only cache (not synced to iCloud) for fast feed loading.
actor FeedCache {
    static let shared = FeedCache()

    private let fileManager = FileManager.default
    private let cacheDirectory: URL
    private let cacheFileName = "subscription_feed.json"

    /// In-memory cache of the feed data.
    private var cachedData: FeedCacheData?

    private init() {
        // Use Caches directory - not backed up, not synced
        let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first!
        cacheDirectory = caches.appendingPathComponent("FeedCache", isDirectory: true)

        try? fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
    }

    private var cacheFileURL: URL {
        cacheDirectory.appendingPathComponent(cacheFileName)
    }

    // MARK: - Public API

    /// Loads the cached feed from disk.
    /// Returns nil if no cache exists or if it's corrupted.
    func load() async -> FeedCacheData? {
        // Return in-memory cache if available
        if let cachedData {
            return cachedData
        }

        // Try to load from disk
        guard fileManager.fileExists(atPath: cacheFileURL.path) else {
            return nil
        }

        do {
            let data = try Data(contentsOf: cacheFileURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let cacheData = try decoder.decode(FeedCacheData.self, from: data)

            // Store in memory
            cachedData = cacheData
            return cacheData
        } catch {
            // Cache is corrupted, remove it
            try? fileManager.removeItem(at: cacheFileURL)
            return nil
        }
    }

    /// Saves the feed to disk.
    func save(videos: [Video], lastUpdated: Date) async {
        let cacheData = FeedCacheData(videos: videos, lastUpdated: lastUpdated)

        // Update in-memory cache
        cachedData = cacheData

        // Write to disk
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = .prettyPrinted
            let data = try encoder.encode(cacheData)
            let sizeMB = Double(data.count) / (1024 * 1024)
            try data.write(to: cacheFileURL, options: .atomic)
            await MainActor.run {
                LoggingService.shared.debug(
                    "FeedCache.save: Wrote \(videos.count) videos (\(String(format: "%.2f", sizeMB)) MB) to disk, lastUpdated: \(lastUpdated)",
                    category: .general
                )
            }
        } catch {
            await MainActor.run {
                LoggingService.shared.error(
                    "FeedCache.save: Failed to write to disk",
                    category: .general,
                    details: error.localizedDescription
                )
            }
        }
    }

    /// Clears the feed cache from both memory and disk.
    func clear() async {
        cachedData = nil
        try? fileManager.removeItem(at: cacheFileURL)
    }

    /// Invalidates the cache by clearing the lastUpdated timestamp.
    /// The cached videos remain available but will be considered stale.
    func invalidate() async {
        guard var data = cachedData else { return }
        data.lastUpdated = .distantPast
        cachedData = data
        await save(videos: data.videos, lastUpdated: .distantPast)
    }
}

// MARK: - Cache Data Model

/// Data structure for the feed cache.
struct FeedCacheData: Codable {
    var videos: [Video]
    var lastUpdated: Date
}

```

### Core Architecture Module: `Yattee/Core/FileCommands.swift`
```
//
//  FileCommands.swift
//  Yattee
//
//  Menu bar commands for file operations.
//

import SwiftUI

#if !os(tvOS)
/// File-related menu bar commands.
struct FileCommands: Commands {
    var body: some Commands {
        CommandGroup(replacing: .newItem) {
            Button(String(localized: "menu.file.openLink")) {
                NotificationCenter.default.post(name: .showOpenLinkSheet, object: nil)
            }
            .keyboardShortcut("o", modifiers: [.command])
        }
    }
}
#endif

#if os(macOS)
/// App menu Settings… item that opens the dedicated Settings window.
struct SettingsWindowMenuItem: View {
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Button(String(localized: "menu.app.settings")) {
            openWindow(id: "settings")
        }
        .keyboardShortcut(",", modifiers: [.command])
    }
}
#endif

```

### Core Architecture Module: `Yattee/Core/HardwareCapabilities.swift`
```
//
//  HardwareCapabilities.swift
//  Yattee
//
//  Detects hardware video decoding capabilities using VideoToolbox.
//

import Foundation
import VideoToolbox
import CoreMedia

/// Detects and caches hardware video decoding capabilities for the current device.
@MainActor
final class HardwareCapabilities {
    static let shared = HardwareCapabilities()

    // MARK: - Cached Results

    private var _supportsH264Hardware: Bool?
    private var _supportsHEVCHardware: Bool?
    private var _supportsHEVCAlphaHardware: Bool?
    private var _supportsDolbyVisionHEVCHardware: Bool?
    private var _supportsVP9Hardware: Bool?
    private var _supportsAV1Hardware: Bool?
    private var _supportsProResHardware: Bool?

    // MARK: - Hardware Support Properties

    /// Whether the device supports H.264/AVC hardware decoding.
    var supportsH264Hardware: Bool {
        if let cached = _supportsH264Hardware { return cached }
        let supported = VTIsHardwareDecodeSupported(kCMVideoCodecType_H264)
        _supportsH264Hardware = supported
        return supported
    }

    /// Whether the device supports HEVC/H.265 hardware decoding.
    var supportsHEVCHardware: Bool {
        if let cached = _supportsHEVCHardware { return cached }
        let supported = VTIsHardwareDecodeSupported(kCMVideoCodecType_HEVC)
        _supportsHEVCHardware = supported
        return supported
    }

    /// Whether the device supports HEVC with Alpha hardware decoding.
    var supportsHEVCAlphaHardware: Bool {
        if let cached = _supportsHEVCAlphaHardware { return cached }
        let supported = VTIsHardwareDecodeSupported(kCMVideoCodecType_HEVCWithAlpha)
        _supportsHEVCAlphaHardware = supported
        return supported
    }

    /// Whether the device supports Dolby Vision HEVC hardware decoding.
    var supportsDolbyVisionHEVCHardware: Bool {
        if let cached = _supportsDolbyVisionHEVCHardware { return cached }
        let supported = VTIsHardwareDecodeSupported(kCMVideoCodecType_DolbyVisionHEVC)
        _supportsDolbyVisionHEVCHardware = supported
        return supported
    }

    /// Whether the device supports VP9 hardware decoding.
    var supportsVP9Hardware: Bool {
        if let cached = _supportsVP9Hardware { return cached }
        let supported = VTIsHardwareDecodeSupported(kCMVideoCodecType_VP9)
        _supportsVP9Hardware = supported
        return supported
    }

    /// Whether the device supports AV1 hardware decoding.
    var supportsAV1Hardware: Bool {
        if let cached = _supportsAV1Hardware { return cached }
        let supported = VTIsHardwareDecodeSupported(kCMVideoCodecType_AV1)
        _supportsAV1Hardware = supported
        return supported
    }

    /// Whether the device supports ProRes hardware decoding.
    var supportsProResHardware: Bool {
        if let cached = _supportsProResHardware { return cached }
        let supported = VTIsHardwareDecodeSupported(kCMVideoCodecType_AppleProRes422)
        _supportsProResHardware = supported
        return supported
    }

    // MARK: - Codec Priority

    /// Returns codec priority for stream selection (higher = better).
    ///
    /// When hardware decode is available, the codec gets a higher priority
    /// to prefer battery-efficient playback. When not available, codecs that
    /// require software decode get priority 0 to prefer hardware-decodable
    /// alternatives at the same or similar resolution.
    ///
    /// Priority levels:
    /// - 4: Best (AV1 with hardware)
    /// - 3: Great (VP9 with hardware, HEVC with hardware)
    /// - 2: Good (H.264 - always hardware supported)
    /// - 1: Acceptable (HEVC software - rare)
    /// - 0: Avoid (AV1/VP9 software - battery drain, potential performance issues)
    func codecPriority(for codec: String?) -> Int {
        guard let codec = codec?.lowercased() else { return 0 }

        if codec.contains("av1") || codec.contains("av01") {
            // AV1: Best compression but avoid without hardware (heavy CPU usage)
            return supportsAV1Hardware ? 4 : 0
        } else if codec.contains("vp9") || codec.contains("vp09") {
            // VP9: Good compression but avoid without hardware (battery drain)
            return supportsVP9Hardware ? 3 : 0
        } else if codec.contains("avc") || codec.contains("h264") || codec.contains("h.264") {
            // H.264: Universal hardware support - reliable choice
            return 2
        } else if codec.contains("hevc") || codec.contains("hev") || codec.contains("h265") || codec.contains("h.265") {
            // HEVC: Good compression, most devices have hardware support
            return supportsHEVCHardware ? 3 : 1
        }
        return 0
    }

    /// Returns an ordered list of preferred codecs based on hardware support.
    var preferredCodecOrder: [String] {
        var codecs: [(String, Int)] = []

        if supportsAV1Hardware {
            codecs.append(("AV1", 4))
        }
        if supportsVP9Hardware {
            codecs.append(("VP9", 3))
        }
        // H.264 is always hardware supported
        codecs.append(("H.264", 2))
        if supportsHEVCHardware {
            codecs.append(("HEVC", 2))
        }

        return codecs.sorted { $0.1 > $1.1 }.map { $0.0 }
    }

    // MARK: - All Capabilities

    /// Returns all codec capabilities for display in Device Capabilities view.
    var allCapabilities: [(name: String, supported: Bool)] {
        [
            ("H.264/AVC", supportsH264Hardware),
            ("HEVC/H.265", supportsHEVCHardware),
            ("HEVC with Alpha", supportsHEVCAlphaHardware),
            ("Dolby Vision HEVC", supportsDolbyVisionHEVCHardware),
            ("VP9", supportsVP9Hardware),
            ("AV1", supportsAV1Hardware),
            ("ProRes", supportsProResHardware)
        ]
    }

    // MARK: - Logging

    /// Logs all hardware capabilities for debugging.
    func logCapabilities() {
        let capabilities = allCapabilities.map { "\($0.name): \($0.supported ? "Yes" : "No")" }.joined(separator: ", ")
        LoggingService.shared.info("Hardware decode capabilities: \(capabilities)", category: .general)
        LoggingService.shared.info("Preferred codec order: \(preferredCodecOrder.joined(separator: " > "))", category: .general)
    }
}

```

### Core Architecture Module: `Yattee/Core/HomeInstanceDiskCache.swift`
```
//
//  HomeInstanceDiskCache.swift
//  Yattee
//
//  Persistent on-device cache for home instance content (Popular/Trending).
//  Stores cached videos on disk to enable fast loading on app launch.
//

import Foundation

/// Persistent cache for home instance content that stores videos on disk.
/// This is a local-only cache (not synced to iCloud) for fast content loading.
actor HomeInstanceDiskCache {
    static let shared = HomeInstanceDiskCache()

    private let fileManager = FileManager.default
    private let cacheDirectory: URL
    private let cacheFileName = "library_instances.json"

    /// In-memory cache of the data.
    private var cachedData: CacheData?

    private init() {
        // Use Caches directory - not backed up, not synced
        let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first!
        cacheDirectory = caches.appendingPathComponent("LibraryCache", isDirectory: true)

        try? fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
    }

    private var cacheFileURL: URL {
        cacheDirectory.appendingPathComponent(cacheFileName)
    }

    // MARK: - Public API

    /// Loads the cached data from disk.
    /// Returns nil if no cache exists or if it's corrupted.
    func load() async -> CacheData? {
        // Return in-memory cache if available
        if let cachedData {
            return cachedData
        }

        // Try to load from disk
        guard fileManager.fileExists(atPath: cacheFileURL.path) else {
            return nil
        }

        do {
            let data = try Data(contentsOf: cacheFileURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let cacheData = try decoder.decode(CacheData.self, from: data)

            // Store in memory
            cachedData = cacheData
            return cacheData
        } catch {
            // Cache is corrupted, remove it
            try? fileManager.removeItem(at: cacheFileURL)
            await MainActor.run {
                LoggingService.shared.warning(
                    "HomeInstanceDiskCache.load: Cache corrupted, removed",
                    category: .general,
                    details: error.localizedDescription
                )
            }
            return nil
        }
    }

    /// Saves the cache to disk.
    func save(_ data: CacheData) async {
        // Update in-memory cache
        cachedData = data

        // Write to disk
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = .prettyPrinted
            let encodedData = try encoder.encode(data)
            let sizeMB = Double(encodedData.count) / (1024 * 1024)
            try encodedData.write(to: cacheFileURL, options: .atomic)
            await MainActor.run {
                LoggingService.shared.debug(
                    "HomeInstanceDiskCache.save: Wrote \(data.videos.values.map { $0.count }.reduce(0, +)) videos (\(String(format: "%.2f", sizeMB)) MB) to disk",
                    category: .general
                )
            }
        } catch {
            await MainActor.run {
                LoggingService.shared.error(
                    "HomeInstanceDiskCache.save: Failed to write to disk",
                    category: .general,
                    details: error.localizedDescription
                )
            }
        }
    }

    /// Clears the cache from both memory and disk.
    func clear() async {
        cachedData = nil
        try? fileManager.removeItem(at: cacheFileURL)
        await MainActor.run {
            LoggingService.shared.debug("HomeInstanceDiskCache.clear: Cache cleared", category: .general)
        }
    }
}

// MARK: - Cache Data Model

extension HomeInstanceDiskCache {
    /// Data structure for the home instance cache.
    /// Uses cache keys in format "instanceID_contentType" (e.g., "UUID_popular")
    struct CacheData: Codable, Sendable {
        var videos: [String: [Video]]  // cacheKey -> videos
        var lastUpdated: [String: Date]  // cacheKey -> timestamp
        
        init(videos: [String: [Video]] = [:], lastUpdated: [String: Date] = [:]) {
            self.videos = videos
            self.lastUpdated = lastUpdated
        }
    }
}

```

### Core Architecture Module: `Yattee/Core/InstancesManager.swift`
```
//
//  InstancesManager.swift
//  Yattee
//
//  Manages configured backend instances with iCloud sync.
//

import Foundation
import SwiftUI

/// Status of an instance's connectivity and authentication.
enum InstanceStatus: Equatable {
    /// Instance is online and working.
    case online
    /// Instance is offline or unreachable.
    case offline
    /// Instance requires authentication but credentials are not provided.
    case authRequired
    /// Instance authentication failed (wrong credentials).
    case authFailed
}

/// Manages the list of configured backend instances with iCloud sync.
@MainActor
@Observable
final class InstancesManager {
    // MARK: - Storage

    private let localDefaults = UserDefaults.standard
    private let ubiquitousStore = NSUbiquitousKeyValueStore.default
    private let instancesKey = "configuredInstances"
    private let activeInstanceKey = "activeInstanceID"

    // MARK: - Dependencies

    private weak var settingsManager: SettingsManager?

    // MARK: - State

    private(set) var instances: [Instance] = []
    private(set) var activeInstanceID: UUID?

    /// Current status of each instance, keyed by instance ID.
    private(set) var instanceStatuses: [UUID: InstanceStatus] = [:]

    // MARK: - Initialization

    init(settingsManager: SettingsManager? = nil) {
        self.settingsManager = settingsManager

        loadInstances()
        loadActiveInstance()

        // Listen for external changes from iCloud
        NotificationCenter.default.addObserver(
            forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: ubiquitousStore,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.handleiCloudChange()
            }
        }
    }

    /// Sets the settings manager reference for checking iCloud sync status.
    func setSettingsManager(_ manager: SettingsManager) {
        self.settingsManager = manager
    }

    /// Whether iCloud sync is currently enabled.
    private var iCloudSyncEnabled: Bool {
        settingsManager?.iCloudSyncEnabled ?? false
    }

    /// Whether instance sync is enabled (requires both master toggle and category toggle).
    private var instanceSyncEnabled: Bool {
        iCloudSyncEnabled && (settingsManager?.syncInstances ?? true)
    }

    /// Handles external iCloud changes by replacing local data with iCloud data.
    private func handleiCloudChange() {
        // Only process iCloud changes if instance sync is enabled
        guard instanceSyncEnabled else { return }

        guard let iCloudData = ubiquitousStore.data(forKey: instancesKey),
              let iCloudInstances = try? JSONDecoder().decode([Instance].self, from: iCloudData) else {
            return
        }

        // Replace local instances with iCloud data
        instances = iCloudInstances
        // Save to local defaults for offline access
        localDefaults.set(iCloudData, forKey: instancesKey)

        // Update sync time
        settingsManager?.updateLastSyncTime()
    }

    /// Syncs local data to iCloud (called when enabling iCloud sync).
    /// Only syncs if instance sync is enabled.
    func syncToiCloud() {
        guard instanceSyncEnabled else { return }

        guard let data = try? JSONEncoder().encode(instances) else { return }
        ubiquitousStore.set(data, forKey: instancesKey)
        ubiquitousStore.synchronize()
        settingsManager?.updateLastSyncTime()
    }

    /// Replaces local data with iCloud data (called when enabling iCloud sync).
    /// Only replaces if instance sync is enabled.
    func replaceWithiCloudData() {
        guard instanceSyncEnabled else { return }

        ubiquitousStore.synchronize()

        guard let iCloudData = ubiquitousStore.data(forKey: instancesKey),
              let iCloudInstances = try? JSONDecoder().decode([Instance].self, from: iCloudData) else {
            // No iCloud data exists, sync local data to iCloud
            syncToiCloud()
            return
        }

        // Replace local with iCloud data
        instances = iCloudInstances
        localDefaults.set(iCloudData, forKey: instancesKey)
        settingsManager?.updateLastSyncTime()
    }

    // MARK: - Public Methods

    func add(_ instance: Instance) {
        instances.append(instance)
        saveInstances()
    }

    func remove(_ instance: Instance) {
        instances.removeAll { $0.id == instance.id }

        // Clear active instance if it was the removed one
        if activeInstanceID == instance.id {
            activeInstanceID = nil
            localDefaults.removeObject(forKey: activeInstanceKey)
        }

        saveInstances()
        Task { await ProxyDetectionCache.shared.invalidate(instance: instance) }
    }

    func update(_ instance: Instance) {
        if let index = instances.firstIndex(where: { $0.id == instance.id }) {
            instances[index] = instance
            saveInstances()
            // Editing a source can change the proxy answer (URL change, toggle
            // flip). Drop the cached auto-detect verdict so the next playback
            // re-probes.
            Task { await ProxyDetectionCache.shared.invalidate(instance: instance) }
        }
    }

    /// Alias for add method to maintain consistency.
    func addInstance(_ instance: Instance) {
        add(instance)
    }

    /// Toggles the enabled state of an instance.
    func toggleEnabled(_ instance: Instance) {
        if let index = instances.firstIndex(where: { $0.id == instance.id }) {
            var updated = instances[index]
            updated.isEnabled.toggle()
            instances[index] = updated
            saveInstances()
        }
    }

    /// Records whether an instance sits behind HTTP Basic Auth.
    /// Persisted (and synced to iCloud) so missing Keychain credentials can be
    /// detected after a reinstall.
    func setUsesBasicAuth(_ value: Bool, for instance: Instance) {
        guard let index = instances.firstIndex(where: { $0.id == instance.id }),
              instances[index].usesBasicAuth != value else { return }
        instances[index].usesBasicAuth = value
        saveInstances()
    }

    /// Records whether the user has logged into an account on an instance.
    /// Persisted (and synced to iCloud) so missing Keychain credentials can be
    /// detected after a reinstall.
    func setUsesAccountLogin(_ value: Bool, for instance: Instance) {
        guard let index = instances.firstIndex(where: { $0.id == instance.id }),
              instances[index].usesAccountLogin != value else { return }
        instances[index].usesAccountLogin = value
        saveInstances()
    }

    /// Sets the given instance as the primary (first) instance.
    func setPrimary(_ instance: Instance) {
        LoggingService.shared.debug("[InstancesManager] setPrimary called for: \(instance.displayName)", category: .general)
        LoggingService.shared.debug("[InstancesManager] Current instances: \(instances.map { $0.displayName })", category: .general)

        guard let index = instances.firstIndex(where: { $0.id == instance.id }) else {
            LoggingService.shared.debug("[InstancesManager] Instance not found in list", category: .general)
            return
        }

        if index == 0 {
            LoggingService.shared.debug("[InstancesManager] Instance already at index 0, skipping", category: .general)
            return
        }

        LoggingService.shared.debug("[InstancesManager] Moving instance from index \(index) to 0", category: .general)
        // Move to front
        let removed = instances.remove(at: index)
        instances.insert(removed, at: 0)
        saveInstances()
        LoggingService.shared.debug("[InstancesManager] After move: \(instances.map { $0.displayName })", category: .general)
    }

    // MARK: - Computed Properties

    var enabledInstances: [Instance] {
        instances.filter(\.isEnabled)
    }

    var youtubeInstances: [Instance] {
        instances.filter(\.isYouTubeInstance)
    }

    var peertubeInstances: [Instance] {
        instances.filter(\.isPeerTubeInstance)
    }

    var yatteeServerInstances: [Instance] {
        instances.filter(\.isYatteeServerInstance)
    }

    var hasYouTubeInstances: Bool {
        instances.contains { $0.isYouTubeInstance }
    }

    var hasPeerTubeInstances: Bool {
        instances.contains { $0.isPeerTubeInstance }
    }

    var hasYatteeServerInstances: Bool {
        instances.contains { $0.isYatteeServerInstance }
    }

    var invidiousPipedInstances: [Instance] {
        instances.filter { $0.type == .invidious || $0.type == .piped }
    }

    var hasInvidiousPipedInstances: Bool {
        instances.contains { $0.type == .invidious || $0.type == .piped }
    }

    var enabledYatteeServerInstances: [Instance] {
        yatteeServerInstances.filter(\.isEnabled)
    }

    /// Selects an enabled instance appropriate for the given video's content source.
    /// - For PeerTube videos: prefers the exact instance, falls back to any PeerTube instance
    /// - For YouTube/extracted content: uses YouTube-capable instance (Invidious, Piped, Yattee Server)
    func instance(for video: Video) -> Instance? {
        instance(for: video.id.source)
    }

    /// Selects an enabled instance appropriate for the given content source.
    /// - For PeerTube content: prefers the exact instance, falls back to any PeerTube instance
    /// - For extracted content: requires Yattee Server (only backend with yt-dlp)
    /// - For YouTube content: uses YouTube-capable instance (Invidious, Piped, Yattee Server)
    func instance(for contentSource: ContentSource) -> Instance? {
        switch contentSource {
        case .federated(let provider, let instanceURL) where provider == ContentSource.peertubeProvider:
            // PeerTube content - prefer the exact instance, fall back to any PeerTube instance
     
```

### Core Architecture Module: `Yattee/Core/MediaSourcesManager.swift`
```
//
//  MediaSourcesManager.swift
//  Yattee
//
//  Manages configured media sources with persistence.
//

import Foundation
import Security

/// Manages the list of configured media sources.
@MainActor
@Observable
final class MediaSourcesManager {
    // MARK: - Storage

    private let localDefaults = UserDefaults.standard
    private let ubiquitousStore = NSUbiquitousKeyValueStore.default
    private let sourcesKey = "configuredMediaSources"
    private let iCloudSourcesKey = "syncedMediaSources"
    private let keychainServiceName = "com.yattee.mediasources"

    // MARK: - Dependencies

    private weak var settingsManager: SettingsManager?
    private weak var dataManager: DataManager?

    // MARK: - Sync State

    private var isImportingFromiCloud = false
    private var iCloudObserver: NSObjectProtocol?

    // MARK: - State

    private(set) var sources: [MediaSource] = []

    /// Tracks which sources have passwords stored (for reactive UI updates)
    private(set) var passwordStoredSourceIDs: Set<UUID> = []

    // MARK: - Initialization

    init(settingsManager: SettingsManager? = nil) {
        self.settingsManager = settingsManager
        loadSources()
        observeiCloudChanges()
        // Import or refresh network sources from iCloud on startup
        importFromiCloudOnStartupIfNeeded()
    }

    /// Imports or refreshes network sources (WebDAV and SMB) from iCloud on startup.
    /// - If no local network sources exist: imports all from iCloud (first-time setup).
    /// - If local network sources differ from iCloud: replaces local with iCloud data
    ///   (catches name changes, enable/disable toggles, etc. made on other devices while app was closed).
    private func importFromiCloudOnStartupIfNeeded() {
        guard iCloudSyncEnabled else {
            LoggingService.shared.debug("MediaSources startup: iCloud sync disabled, skipping import", category: .cloudKit)
            return
        }

        ubiquitousStore.synchronize()

        guard let data = ubiquitousStore.data(forKey: iCloudSourcesKey),
              let exports = try? JSONDecoder().decode([MediaSourceExport].self, from: data),
              !exports.isEmpty else {
            LoggingService.shared.debug("MediaSources startup: No network sources in iCloud", category: .cloudKit)
            return
        }

        let iCloudNetworkSources = exports.compactMap { $0.toMediaSource() }

        if networkSources.isEmpty {
            // First-time import: no local network sources
            LoggingService.shared.info("MediaSources startup: Importing \(iCloudNetworkSources.count) network sources from iCloud", category: .cloudKit)
            sources.append(contentsOf: iCloudNetworkSources)
            saveSources()
            refreshPasswordStoredStatus()
        } else if networkSources != iCloudNetworkSources {
            // Existing sources differ from iCloud - refresh from iCloud
            // This catches name changes, enable/disable toggles, etc. made on other devices
            LoggingService.shared.info("MediaSources startup: Refreshing \(iCloudNetworkSources.count) network sources from iCloud (local differs)", category: .cloudKit)
            isImportingFromiCloud = true
            defer { isImportingFromiCloud = false }
            let localFolderSources = sources.filter { $0.type == .localFolder }
            sources = localFolderSources + iCloudNetworkSources
            saveSources()
            refreshPasswordStoredStatus()
        } else {
            LoggingService.shared.debug("MediaSources startup: Local sources match iCloud, no update needed", category: .cloudKit)
        }
    }

    /// Sets the settings manager reference (for dependency injection after init).
    func configure(settingsManager: SettingsManager) {
        self.settingsManager = settingsManager
    }

    /// Sets the data manager reference (for cleanup when sources are deleted).
    func setDataManager(_ manager: DataManager) {
        self.dataManager = manager
    }

    // MARK: - Source Management

    /// Adds a new media source.
    func add(_ source: MediaSource) {
        sources.append(source)
        saveSources()
        syncToiCloudIfNeeded()
    }

    /// Removes a media source and its stored credentials.
    func remove(_ source: MediaSource) {
        // Clean up associated data (history, bookmarks, playlist items)
        dataManager?.removeAllDataForMediaSource(sourceID: source.id)

        // Remove from Home cards/sections
        settingsManager?.removeFromHome(sourceID: source.id)

        sources.removeAll { $0.id == source.id }
        saveSources()
        syncToiCloudIfNeeded()

        // Remove password from Keychain (for network sources)
        if source.type == .webdav || source.type == .smb {
            deletePassword(for: source)
        }
    }

    /// Updates an existing media source.
    func update(_ source: MediaSource) {
        if let index = sources.firstIndex(where: { $0.id == source.id }) {
            sources[index] = source
            saveSources()
            syncToiCloudIfNeeded()
        }
    }

    /// Toggles the enabled state of a source.
    func toggleEnabled(_ source: MediaSource) {
        if let index = sources.firstIndex(where: { $0.id == source.id }) {
            var updated = sources[index]
            updated.isEnabled.toggle()
            sources[index] = updated
            saveSources()
            syncToiCloudIfNeeded()
        }
    }

    // MARK: - Computed Properties

    var enabledSources: [MediaSource] {
        sources.filter(\.isEnabled)
    }

    var webdavSources: [MediaSource] {
        sources.filter { $0.type == .webdav }
    }
    
    var smbSources: [MediaSource] {
        sources.filter { $0.type == .smb }
    }

    /// All network sources (WebDAV and SMB) that can be synced to iCloud.
    var networkSources: [MediaSource] {
        sources.filter { $0.type == .webdav || $0.type == .smb }
    }

    var localFolderSources: [MediaSource] {
        sources.filter { $0.type == .localFolder }
    }

    var isEmpty: Bool {
        sources.isEmpty
    }

    /// Returns true if this network source (WebDAV or SMB) needs password to be configured.
    /// Uses the tracked set for reactive UI updates.
    func needsPassword(for source: MediaSource) -> Bool {
        guard source.type == .webdav || source.type == .smb else { return false }
        return !passwordStoredSourceIDs.contains(source.id)
    }

    /// Returns true if any network source needs password.
    var hasSourcesNeedingPassword: Bool {
        networkSources.contains { needsPassword(for: $0) }
    }

    /// Find source by UUID.
    func source(byID id: UUID) -> MediaSource? {
        sources.first { $0.id == id }
    }

    // MARK: - Persistence

    private func loadSources() {
        if let data = localDefaults.data(forKey: sourcesKey),
           let decoded = try? JSONDecoder().decode([MediaSource].self, from: data) {
            sources = decoded
            refreshPasswordStoredStatus()
            cleanupOrphanedHomeItems()
        }
    }
    
    /// Removes Home items for sources that no longer exist
    private func cleanupOrphanedHomeItems() {
        let validSourceIDs = Set(sources.map(\.id))
        settingsManager?.cleanupOrphanedHomeMediaSourceItems(validSourceIDs: validSourceIDs)
    }

    /// Refreshes the set of source IDs that have passwords stored (for network sources).
    /// Call this when app returns from background to sync with Keychain state.
    func refreshPasswordStoredStatus() {
        let previousIDs = passwordStoredSourceIDs
        passwordStoredSourceIDs = Set(
            sources.filter { $0.type == .webdav || $0.type == .smb }
                .filter { password(for: $0) != nil }
                .map(\.id)
        )

        // Log if status changed (helps debug auth issues)
        if previousIDs != passwordStoredSourceIDs {
            let added = passwordStoredSourceIDs.subtracting(previousIDs)
            let removed = previousIDs.subtracting(passwordStoredSourceIDs)
            LoggingService.shared.info(
                "Password status changed",
                category: .keychain,
                details: "added=\(added.count), removed=\(removed.count)"
            )
        }
    }

    private func saveSources() {
        guard let data = try? JSONEncoder().encode(sources) else { return }
        localDefaults.set(data, forKey: sourcesKey)
    }

    // MARK: - Keychain (Passwords)

    /// Stores a password for a WebDAV/SMB source in the Keychain.
    /// Password syncs to iCloud Keychain when iCloud sync is enabled for media sources.
    func setPassword(_ password: String, for source: MediaSource) {
        let account = source.id.uuidString
        guard let data = password.data(using: .utf8) else {
            LoggingService.shared.error("Failed to encode password data", category: .keychain)
            return
        }

        let syncEnabled = shouldSyncCredentialsToiCloud

        // First, delete any existing item (both synced and non-synced) to avoid duplicates
        let deleteQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainServiceName,
            kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: kSecAttrSynchronizableAny
        ]
        SecItemDelete(deleteQuery as CFDictionary)

        // Create new item with current sync preference
        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainServiceName,
            kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: syncEnabled,
            kSecValueData as String: data
        ]

        let status = SecItemAdd(addQuery as CFDictionary, nil)

        if status == errSecSuccess {
            LoggingService.shared.info(
            
```

### Core Architecture Module: `Yattee/Core/NavigationCommands.swift`
```
//
//  NavigationCommands.swift
//  Yattee
//
//  Menu bar commands for tab navigation.
//

import SwiftUI

#if !os(tvOS)
/// Navigation-related menu bar commands.
/// Works on both macOS and iPadOS 26+.
struct NavigationCommands: Commands {
    let appEnvironment: AppEnvironment

    private var navigationCoordinator: NavigationCoordinator {
        appEnvironment.navigationCoordinator
    }

    private var settingsManager: SettingsManager {
        appEnvironment.settingsManager
    }

    private var visibleItems: [SidebarMainItem] {
        settingsManager.visibleSidebarMainItems()
    }

    var body: some Commands {
        CommandMenu(String(localized: "menu.navigation")) {
            // Home is always visible (required)
            homeButton
            if visibleItems.contains(.subscriptions) {
                subscriptionsButton
            }
            Divider()
            if visibleItems.contains(.bookmarks) {
                bookmarksButton
            }
            if visibleItems.contains(.history) {
                historyButton
            }
            if visibleItems.contains(.downloads) {
                downloadsButton
            }
            Divider()
            if visibleItems.contains(.channels) {
                channelsButton
            }
            if visibleItems.contains(.sources) {
                sourcesButton
            }
            Divider()
            // Search is always visible (required)
            searchButton
            if visibleItems.contains(.settings) {
                settingsButton
            }
        }
    }

    private var homeButton: some View {
        Button {
            navigationCoordinator.selectedTab = .home
        } label: {
            Text(String(localized: "menu.navigation.home"))
        }
        .keyboardShortcut("1", modifiers: [.command])
    }

    private var subscriptionsButton: some View {
        Button {
            navigationCoordinator.selectedTab = .subscriptions
        } label: {
            Text(String(localized: "menu.navigation.subscriptions"))
        }
        .keyboardShortcut("2", modifiers: [.command])
    }

    private var searchButton: some View {
        Button {
            navigationCoordinator.selectedTab = .search
        } label: {
            Text(String(localized: "menu.navigation.search"))
        }
        .keyboardShortcut("f", modifiers: [.command])
    }

    private var bookmarksButton: some View {
        Button {
            navigationCoordinator.selectedSidebarItem = .bookmarks
        } label: {
            Text(String(localized: "menu.navigation.bookmarks"))
        }
        .keyboardShortcut("3", modifiers: [.command])
    }

    private var historyButton: some View {
        Button {
            navigationCoordinator.selectedSidebarItem = .history
        } label: {
            Text(String(localized: "menu.navigation.history"))
        }
        .keyboardShortcut("4", modifiers: [.command])
    }

    private var downloadsButton: some View {
        Button {
            navigationCoordinator.selectedSidebarItem = .downloads
        } label: {
            Text(String(localized: "menu.navigation.downloads"))
        }
        .keyboardShortcut("5", modifiers: [.command])
    }

    private var channelsButton: some View {
        Button {
            navigationCoordinator.selectedSidebarItem = .manageChannels
        } label: {
            Text(String(localized: "menu.navigation.channels"))
        }
        .keyboardShortcut("6", modifiers: [.command])
    }

    private var sourcesButton: some View {
        Button {
            navigationCoordinator.selectedSidebarItem = .sources
        } label: {
            Text(String(localized: "menu.navigation.sources"))
        }
        .keyboardShortcut("7", modifiers: [.command])
    }

    private var settingsButton: some View {
        Button {
            navigationCoordinator.selectedSidebarItem = .settings
        } label: {
            Text(String(localized: "menu.navigation.settings"))
        }
        .keyboardShortcut("9", modifiers: [.command])
    }
}
#endif

```

### Core Architecture Module: `Yattee/Core/Notifications.swift`
```
//
//  Notifications.swift
//  Yattee
//
//  App-wide notification names.
//

import Foundation

extension Notification.Name {
    static let showSettings = Notification.Name("showSettings")
    static let showOpenLinkSheet = Notification.Name("showOpenLinkSheet")
    static let openDescriptionLink = Notification.Name("openDescriptionLink")
    /// Posted when a URL shortener (bit.ly, etc.) has been resolved to an
    /// ambiguous destination — the app isn't certain it can play it, so the
    /// user is prompted whether to try opening it in Yattee or in the browser.
    /// `object` is the resolved `URL`.
    static let promptResolvedShortLink = Notification.Name("promptResolvedShortLink")
    /// Posted when a tapped link is not confidently a video (no YouTube /
    /// PeerTube / direct-media match) but could potentially be extracted via
    /// the Yattee server / yt-dlp. User is prompted whether to try extracting
    /// or open it in the system browser instead.
    /// `object` is the candidate `URL`.
    static let promptAmbiguousExternalLink = Notification.Name("promptAmbiguousExternalLink")
}

```

### Core Architecture Module: `Yattee/Core/PlaybackCommands.swift`
```
//
//  PlaybackCommands.swift
//  Yattee
//
//  Menu bar commands for playback control.
//

import SwiftUI

#if !os(tvOS)
/// Playback-related menu bar commands.
/// Works on both macOS and iPadOS 26+.
struct PlaybackCommands: Commands {
    let appEnvironment: AppEnvironment

    private var playerService: PlayerService {
        appEnvironment.playerService
    }

    private var navigationCoordinator: NavigationCoordinator {
        appEnvironment.navigationCoordinator
    }

    private var state: PlayerState {
        playerService.state
    }

    private var settingsManager: SettingsManager {
        appEnvironment.settingsManager
    }

    private var hasActiveVideo: Bool {
        state.currentVideo != nil
    }

    private var isPlayerExpanded: Bool {
        navigationCoordinator.isPlayerExpanded
    }

    var body: some Commands {
        CommandMenu(String(localized: "menu.playback")) {
            // Player visibility (existing)
            playerToggleButton

            Divider()

            // Core playback
            playPauseButton

            Divider()

            // Seeking
            seekBackwardButton
            seekForwardButton
            secondarySeekBackwardButton
            secondarySeekForwardButton

            Divider()

            // Navigation
            previousVideoButton
            nextVideoButton

            Divider()

            // Speed
            slowerButton
            fasterButton
            resetSpeedButton

            Divider()

            // Volume
            volumeUpButton
            volumeDownButton
            muteButton

            Divider()

            // Display modes
            pipButton
            
            Divider()
            closeVideoButton
        }
    }

    // MARK: - Player Visibility

    private var playerToggleButton: some View {
        Button {
            togglePlayerExpanded()
        } label: {
            Text(isPlayerExpanded
                ? String(localized: "menu.playback.hidePlayer")
                : String(localized: "menu.playback.showPlayer"))
        }
        .keyboardShortcut("p", modifiers: [.command, .shift])
        .disabled(!hasActiveVideo)
    }

    private func togglePlayerExpanded() {
        if isPlayerExpanded {
            navigationCoordinator.isPlayerExpanded = false
        } else {
            navigationCoordinator.expandPlayer()
        }
    }

    // MARK: - Core Playback

    private var playPauseButton: some View {
        Button {
            playerService.togglePlayPause()
        } label: {
            Text(String(localized: "menu.playback.playPause"))
        }
        .keyboardShortcut("k", modifiers: [.command])
        .disabled(!hasActiveVideo)
    }

    // MARK: - Seeking

    /// Seek durations follow the active player controls preset, matching the
    /// in-player arrow key shortcuts.
    private var seekBackwardSeconds: Int {
        appEnvironment.activeControlsCenterSettings.seekBackwardSeconds
    }

    private var seekForwardSeconds: Int {
        appEnvironment.activeControlsCenterSettings.seekForwardSeconds
    }

    private var seekBackwardButton: some View {
        Button {
            playerService.seekBackward(by: TimeInterval(seekBackwardSeconds))
        } label: {
            Text(String(localized: "menu.playback.seekBackward \(seekBackwardSeconds)"))
        }
        .keyboardShortcut(.leftArrow, modifiers: [.command])
        .disabled(!hasActiveVideo)
    }

    private var seekForwardButton: some View {
        Button {
            playerService.seekForward(by: TimeInterval(seekForwardSeconds))
        } label: {
            Text(String(localized: "menu.playback.seekForward \(seekForwardSeconds)"))
        }
        .keyboardShortcut(.rightArrow, modifiers: [.command])
        .disabled(!hasActiveVideo)
    }

    private var secondarySeekBackwardSeconds: Int {
        appEnvironment.activeControlsCenterSettings.secondarySeekBackwardSeconds
    }

    private var secondarySeekForwardSeconds: Int {
        appEnvironment.activeControlsCenterSettings.secondarySeekForwardSeconds
    }

    private var secondarySeekBackwardButton: some View {
        Button {
            playerService.seekBackward(by: TimeInterval(secondarySeekBackwardSeconds))
        } label: {
            Text(String(localized: "menu.playback.seekBackward \(secondarySeekBackwardSeconds)"))
        }
        .keyboardShortcut(.leftArrow, modifiers: [.command, .shift])
        .disabled(!hasActiveVideo)
    }

    private var secondarySeekForwardButton: some View {
        Button {
            playerService.seekForward(by: TimeInterval(secondarySeekForwardSeconds))
        } label: {
            Text(String(localized: "menu.playback.seekForward \(secondarySeekForwardSeconds)"))
        }
        .keyboardShortcut(.rightArrow, modifiers: [.command, .shift])
        .disabled(!hasActiveVideo)
    }

    // MARK: - Navigation

    private var previousVideoButton: some View {
        Button {
            Task {
                await playerService.playPrevious()
            }
        } label: {
            Text(String(localized: "menu.playback.previousVideo"))
        }
        .keyboardShortcut(.leftArrow, modifiers: [.command, .option])
        .disabled(!hasActiveVideo || !state.hasPrevious)
    }

    private var nextVideoButton: some View {
        Button {
            Task {
                await playerService.playNext()
            }
        } label: {
            Text(String(localized: "menu.playback.nextVideo"))
        }
        .keyboardShortcut(.rightArrow, modifiers: [.command, .option])
        .disabled(!hasActiveVideo || !state.hasNext)
    }

    // MARK: - Speed

    private var slowerButton: some View {
        Button {
            cycleSpeedDown()
        } label: {
            Text(String(localized: "menu.playback.slower"))
        }
        .keyboardShortcut("[", modifiers: [.command])
        .disabled(!hasActiveVideo)
    }

    private var fasterButton: some View {
        Button {
            cycleSpeedUp()
        } label: {
            Text(String(localized: "menu.playback.faster"))
        }
        .keyboardShortcut("]", modifiers: [.command])
        .disabled(!hasActiveVideo)
    }

    private var resetSpeedButton: some View {
        Button {
            state.rate = .x1
            playerService.currentBackend?.rate = 1.0
        } label: {
            Text(String(localized: "menu.playback.resetSpeed"))
        }
        .keyboardShortcut("0", modifiers: [.command])
        .disabled(!hasActiveVideo)
    }

    private func cycleSpeedDown() {
        let rates = PlaybackRate.allCases
        guard let currentIndex = rates.firstIndex(of: state.rate) else { return }
        if currentIndex > 0 {
            let newRate = rates[currentIndex - 1]
            state.rate = newRate
            playerService.currentBackend?.rate = Float(newRate.rawValue)
        }
    }

    private func cycleSpeedUp() {
        let rates = PlaybackRate.allCases
        guard let currentIndex = rates.firstIndex(of: state.rate) else { return }
        if currentIndex < rates.count - 1 {
            let newRate = rates[currentIndex + 1]
            state.rate = newRate
            playerService.currentBackend?.rate = Float(newRate.rawValue)
        }
    }

    // MARK: - Volume

    private var volumeUpButton: some View {
        Button {
            let newVolume = min(1.0, state.volume + 0.1)
            state.volume = newVolume
            playerService.currentBackend?.volume = newVolume
        } label: {
            Text(String(localized: "menu.playback.volumeUp"))
        }
        .keyboardShortcut(.upArrow, modifiers: [.command])
        .disabled(!hasActiveVideo)
    }

    private var volumeDownButton: some View {
        Button {
            let newVolume = max(0.0, state.volume - 0.1)
            state.volume = newVolume
            playerService.currentBackend?.volume = newVolume
        } label: {
            Text(String(localized: "menu.playback.volumeDown"))
        }
        .keyboardShortcut(.downArrow, modifiers: [.command])
        .disabled(!hasActiveVideo)
    }

    private var muteButton: some View {
        Button {
            state.isMuted.toggle()
            playerService.currentBackend?.isMuted = state.isMuted
        } label: {
            Text(String(localized: "menu.playback.mute"))
        }
        .keyboardShortcut("m", modifiers: [.command, .shift])
        .disabled(!hasActiveVideo)
    }

    // MARK: - Display Modes

    private var pipButton: some View {
        Button {
            if let mpvBackend = playerService.currentBackend as? MPVBackend {
                mpvBackend.togglePiP()
            }
        } label: {
            Text(String(localized: "menu.playback.pip"))
        }
        .keyboardShortcut("i", modifiers: [.command, .shift])
        .disabled(!hasActiveVideo || !state.isPiPPossible || state.currentStream?.isAudioOnly == true)
    }
    
    // MARK: - Close video button
    
    private var closeVideoButton: some View {
        Button {
            closeVideo()
        } label: {
            Text(String(localized: "menu.playback.closeVideo"))
        }
        .keyboardShortcut(".", modifiers: [.command])
        .disabled(!hasActiveVideo)
    }

    private func closeVideo() {
        // Mark as closing to hide tab accessory before dismissal
        state.isClosingVideo = true

        // Clear the queue when closing video
        appEnvironment.queueManager.clearQueue()

        // Reset panel state when closing player
        settingsManager.landscapeDetailsPanelVisible = false
        settingsManager.landscapeDetailsPanelPinned = false

        // Stop player FIRST before dismissing window
        playerService.stop()

        // Then dismiss player window (after backend is stopped)
        navigationCoordinator.isPlayerExpanded = false
    }
}
#endif

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #973** (2026-08-23): **No playable streams available from Piped**
  *Symptoms*: ### Guidelines  - [x] I have searched the [issue tracker](https://github.com/yattee/yattee/issues) and I haven't found bug report like this  ### Current Behavior  Use a Piped server as the source, play any video, it would error with 'No playable streams available'.  ### Expected Behavior  The video should play (with audio), regardless of the quality.  ### Device & OS Version  iOS 26.6  ### App Build  2.0.0 (269)  ### App Settings  _No response_  ### Crash log  _No response_  ### Screenshots, Videos and other files  _No response_

- **Issue #960** (2026-08-03): **Yattee says I have 10 subscriptions but I have 2**
  *Symptoms*: ### Guidelines  - [x] I have searched the [issue tracker](https://github.com/yattee/yattee/issues) and I haven't found bug report like this  ### Current Behavior  <img width="1206" height="2622" alt="Image" src="https://github.com/user-attachments/assets/4e17130d-2978-4887-98cc-7d02f7173a25" />  <img width="1206" height="2622" alt="Image" src="https://github.com/user-attachments/assets/1b5feba4-550b-43f1-a10c-0b238e617ac6" />  <img width="1206" height="2622" alt="Image" src="https://github.com/user-attachments/assets/1e88d95e-baa0-4980-ba23-6ebc6d3508db" />  <img width="1206" height="2622" alt="Image" src="https://github.com/user-attachments/assets/ca98c441-1a81-4d19-a4db-6d6cced49e8d" />  <img width="1206" height="2622" alt="Image" src="https://github.com/user-attachments/assets/a3dc4a6f-4b05-417e-bf7d-c38bd3c6438c" />  ### Expected Behavior  Subscriptions count would match invidious, way to clear local subscription data  ### Device & OS Version  iPhone, 26.5.2  ### App Build  266  ### App Settings  _No response_  ### Crash log  _No response_  ### Screenshots, Videos and other files  _No response_

- **Issue #959** (2026-07-30): **Video does not play**
  *Symptoms*: ### Guidelines  - [x] I have searched the [issue tracker](https://github.com/yattee/yattee/issues) and I haven't found bug report like this  ### Current Behavior  When playing this video youtube.com/watch?v=5gN72wntuig I am getting an error:  Failed to decode response: Data corrupted at  The error is on every app but with the invidious website it works  ### Expected Behavior  Video playback  ### Device & OS Version  tvOS, iOS or macOS  ### App Build  266  ### App Settings  _No response_  ### Crash log  Yattee Log ``` [21:58:02.550] [INFO] [API] GET https://invidious.tower.internal/api/v1/videos/5gN72wntuig [21:58:02.562] [INFO] [API] Response 200 from invidious.tower.internal (12ms) [21:58:02.562] [ERROR] [API] API decoding error: Data corrupted at  [21:58:02.562] [ERROR] [Player] Playback failed: global:youtube:5gN72wntuig   Details: Failed to decode response: Data corrupted at  [21:58:05.034] [INFO] [Player] [ExpandedPlayerWindowManager] hide called, expandedWindow=true, animated=true [21:58:05.034] [INFO] [Player] [ExpandedPlayerWindowManager] hide: isPlayerWindowVisible=false, isPlayerCollapsing=true [21:58:05.034] [INFO] [Player] [ExpandedPlayerWindowManager] hide: animated=true, didRotateDuringSession=false, shouldAnimateMainWindow=true [21:58:05.040] [INFO] [CloudKit] cleanupOrphanedHomeInstanceItems: no orphans found, skipped all writes [21:58:05.040] [INFO] [CloudKit] cleanupOrphanedHomeMediaSourceItems: no orphans found, skipped all writes [21:58:05.040] [INFO] [Pla
  **Post-Mortem & Fix Analysis**:
  > This is an Invidious server-side bug, not a Yattee one. You most likely need to update your instance or report it to Invidious maintainers.

- **Issue #958** (2026-08-03): **Suspected AV1 hardware decode failure after backgrounding app, falling back to software decode**
  *Symptoms*: ### Guidelines  - [x] I have searched the [issue tracker](https://github.com/yattee/yattee/issues) and I haven't found bug report like this  ### Current Behavior  When playing AV1 video and switching to another app then back to Yattee, hardware decode fails and playback silently falls back to software decoding (speculated based on thermal/battery behavior — I could not confirm this directly in the logs).  	•	Happens on every single app switch when video is paused in background 	•	Confirmed at 1080p, 1440p, and 2160p AV1 	•	Happens with both streamed and downloaded video 	•	Device becomes noticeably warm within a few minutes of switching back, and battery drain increases significantly 	•	Workaround: stopping playback (not pausing) and starting again restores hardware decode  ### Expected Behavior  Hardware decode should reinitialize after the app returns to foreground, rather than silently remaining on software decode until playback is manually stopped and restarted.  ### Device & OS Version  iPhone 17 Pro 26.5.2  ### App Build  266  ### App Settings  _No response_  ### Crash log  _No response_  ### Screenshots, Videos and other files  _No response_

- **Issue #956** (2026-07-23): **Video renders black while OSD renders fine; both hwdec and software decode affected. Regression from 1.x MPV**
  *Symptoms*: ### Guidelines  - [x] I have searched the [issue tracker](https://github.com/yattee/yattee/issues) and I haven't found bug report like this  ### Current Behavior  On Apple TV HD (A1625), every video plays audio only with a permanently black picture. This is a regression from Yattee 1.x where the MPV backend worked fine on this same device.  What I've verified:  - All streams involved are H.264 (avc1), so no codec support issue - Framebuffer is created successfully (log: `createFramebuffer complete: FB:1 RB:1 1920x1080 complete:✓`) and `performRender` succeeds (`Render periodic status fbo:1 ✓`) - The MPV Debug Stats overlay IS visible on screen, so the GL context and OSD rendering work - With default `hwdec=videotoolbox-copy`: stats show HW Decode active, frame counter advancing, ~20fps output, heavy dropped frames, picture stays black - With `hwdec=no` at 240x426: software decode runs, frame counter advancing at ~21fps, picture still black - So decode works in both modes and the OSD render path works, but decoded video frames never appear on screen. Only the video rendering path fails - `hasDisplayedVideo` stays false until a manual seek is issued; videos also never autoplay, play must be pressed manually - Suspicion: the mpv 0.41 GL/libplacebo video render path is incompatible with the A8's PowerVR GLES driver, whereas the older mpv in 1.x rendered fine on this GPU. This is a wild guess though.   ### Expected Behavior  Video is visible during playback, as in Yattee 1.x on th

- **Issue #955** (2026-08-03): **[tvOS] Can't set subtitle color**
  *Symptoms*: ### Guidelines  - [x] I have searched the [issue tracker](https://github.com/yattee/yattee/issues) and I haven't found bug report like this  ### Current Behavior  It skips right over when trying to select.  https://github.com/user-attachments/assets/0f79345a-e341-4f59-875a-0e40c66743e1  ### Expected Behavior  Selectable  ### Device & OS Version  tvOS latest as of today  ### App Build  266  ### App Settings  _No response_  ### Crash log  _No response_  ### Screenshots, Videos and other files  _No response_

- **Issue #953** (2026-07-19): **[macOS] Playback not working**
  *Symptoms*: ### Guidelines  - [x] I have searched the [issue tracker](https://github.com/yattee/yattee/issues) and I haven't found bug report like this  ### Current Behavior  Related to https://github.com/yattee/yattee/issues/916  Like previous issue works fine on iOS/tvOS.  Latest invidious backend as of today.  With proxy / without  or Allow Software-Decoded Formats makes no difference in settings.  Tried 480p, 720p, 1080p:  <img width="712" height="1196" alt="Image" src="https://github.com/user-attachments/assets/d4452c85-0216-4b22-869f-bf3f461dae27" />  <img width="878" height="520" alt="Image" src="https://github.com/user-attachments/assets/3f6c226c-9636-43b9-8fad-8ea911f3e675" />  EDL Combined Streams loads the video over and over but still no playback:  https://github.com/user-attachments/assets/1199d0f6-4db5-42bc-8d26-f930daa9abe8  <img width="870" height="500" alt="Image" src="https://github.com/user-attachments/assets/ff554d40-fc37-4a2a-b632-b4519032b0c9" />  ### Expected Behavior  Working  ### Device & OS Version  macOS 15.7.7 (24G720)  ### App Build  264  ### App Settings  Same as iOS  ### Crash log  _No response_  ### Screenshots, Videos and other files  _No response_
  **Post-Mortem & Fix Analysis**:
  > Can you post logs? Enable in Settings > Advanced > Developer > Enable logging and Verbose MPV logging You may anonymise instance URL
  > `Yattee Logs - Exported 2026-07-19, 18:32 ============================================================ [18:31:48.427] [INFO] [CloudKit] Sync state updated and saved (1689 bytes) [18:31:48.777] [INFO] [CloudKit] CKSyncEngine will fetch changes (auto-triggered) [18:31:48.939] [INFO] [CloudKit] Sync state updated and saved (1689 bytes) [18:31:48.943] [INFO] [CloudKit] CKSyncEngine finished fetching changes [18:31:50.923] [DEBUG] [Keychain] Retrieved SID for Invidious instance   Details: instanceID=9C8D3346-E43E-40FC-8009-E2707757BF9C [18:31:50.924] [DEBUG] [Keychain] Retrieved SID for Invidious instance   Details: instanceID=9C8D3346-E43E-40FC-8009-E2707757BF9C [18:31:50.924] [INFO] [API] GET http://192.168.20.2:3000/api/v1/auth/subscriptions [18:31:50.925] [DEBUG] [API] Request cancelled before execution: http://192.168.20.2:3000/api/v1/auth/subscriptions [18:31:50.925] [INFO] [API] GET http://192.168.20.2:3000/api/v1/auth/subscriptions [18:31:50.925] [INFO] [API] GET http://192.168.20.2
  > Thanks, the logs show what's happening. You're running the iPhone/iPad version of Yattee on your Mac (installed from the "iOS Apps" section of TestFlight), and its video renderer currently fails to initialize in that environment ("Can't load OpenGL functions"), so every video errors out regardless of network or proxy settings. Two things: (1) please install the native macOS app from TestFlight or GitHub releases instead — it should play fine; (2) I'll look into fixing the iOS-on-Mac rendering path as well.

- **Issue #945** (2026-06-26): **Subtitles not working with invidious and yattee testflight**
  *Symptoms*: ### Guidelines  - [x] I have searched the [issue tracker](https://github.com/yattee/yattee/issues) and I haven't found bug report like this  ### Current Behavior  When enabling subtitles in a video on any device, I do not see them, despite it saying that they are enabled  ### Expected Behavior  Subtitles to apear  ### Device & OS Version  iPhone IOS 26 latest dev beta  ### App Build  261  ### App Settings  N/A  ### Crash log  _No response_  ### Screenshots, Videos and other files  _No response_
  **Post-Mortem & Fix Analysis**:
  > This is a server side issue, not Yattee's
  > > This is a server side issue, not Yattee's  Oh you are right sorry, I don't see subtitles in invidious either lol

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

### Incident Patch 1: `9306bafb` (2026-08-23)
**Commit Message**: Bump build number to 270

**File**: `Yattee.xcodeproj/project.pbxproj` (modified, +12/-12)
```diff
@@ -570,7 +570,7 @@
 				AUTOMATION_APPLE_EVENTS = NO;
 				CODE_SIGN_ENTITLEMENTS = Yattee/Yattee.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 269;
+				CURRENT_PROJECT_VERSION = 270;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				ENABLE_APP_SANDBOX = YES;
@@ -656,7 +656,7 @@
 				CODE_SIGN_ENTITLEMENTS = Yattee/Yattee.entitlements;
 				"CODE_SIGN_ENTITLEMENTS[sdk=macosx*]" = "Yattee/Yattee-macOS.entitlements";
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 269;
+				CURRENT_PROJECT_VERSION = 270;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				ENABLE_APP_SANDBOX = YES;
@@ -800,7 +800,7 @@
 				CODE_SIGN_ENTITLEMENTS = Yattee/Yattee.entitlements;
 				"CODE_SIGN_ENTITLEMENTS[sdk=macosx*]" = "Yattee/Yattee-macOS-DeveloperID.entitlements";
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 269;
+				CURRENT_PROJECT_VERSION = 270;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				ENABLE_APP_SANDBOX = YES;
@@ -881,7 +881,7 @@
 			buildSettings = {
 				BUNDLE_LOADER = "$(TEST_HOST)";
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 269;
+				CURRENT_PROJECT_VERSION = 270;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				GENERATE_INFOPLIST_FILE = YES;
@@ -910,7 +910,7 @@
 			buildSettings = {
 				CODE_SIGN_ENTITLEMENTS = YatteeShareExtension/YatteeShareExtension.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 269;
+				CURRENT_PROJECT_VERSION = 270;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = YatteeShareExtension/Info.plist;
@@ -942,7 +942,7 @@
 			buildSettings = {
 				CODE_SIGN_ENTITLEMENTS = YatteeTopShelf/YatteeTopShelf.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 269;
+				CURRENT_PROJECT_VERSION = 270;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = YatteeTopShelf/Info.plist;
@@ -977,7 +977,7 @@
 			buildSettings = {
 				CODE_SIGN_ENTITLEMENTS = YatteeShareExtension/YatteeShareExtension.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 269;
+				CURRENT_PROJECT_VERSION = 270;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = YatteeShareExtension/Info.plist;
@@ -1008,7 +1008,7 @@
 			buildSettings = {
 				CODE_SIGN_ENTITLEMENTS = YatteeShareExtension/YatteeShareExtension.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 269;
+				CURRENT_PROJECT_VERSION = 270;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = YatteeShareExtension/Info.plist;
@@ -1040,7 +1040,7 @@
 			buildSettings = {
 				CODE_SIGN_ENTITLEMENTS = YatteeTopShelf/YatteeTopShelf.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 269;
+				CURRENT_PROJECT_VERSION = 270;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = YatteeTopShelf/Info.plist;
@@ -1074,7 +1074,7 @@
 			buildSettings = {
 				CODE_SIGN_ENTITLEMENTS = YatteeTopShelf/YatteeTopShelf.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 269;
+				CURRENT_PROJECT_VERSION = 270;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = YatteeTopShelf/Info.plist;
@@ -1109,7 +1109,7 @@
 			buildSettings = {
 				BUNDLE_LOADER = "$(TEST_HOST)";
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 269;
+				CURRENT_PROJECT_VERSION = 270;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				GENERATE_INFOPLIST_FILE = YES;
@@ -1138,7 +1138,7 @@
 			buildSettings = {
 				BUNDLE_LOADER = "$(TEST_HOST)";
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 269;
+				CURRENT_PROJECT_VERSION = 270;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				GENERATE_INFOPLIST_FILE = YES;
```

---

### Incident Patch 2: `3ebae6d2` (2026-08-23)
**Commit Message**: Fix no streams reported from Piped (#974)

Piped currently is having an issue it would only return a muxed 360p
stream, and it is rejected here because the audioCodec being set to nil.

**File**: `Yattee/Services/API/PipedAPI.swift` (modified, +3/-1)
```diff
@@ -672,12 +672,14 @@ private struct PipedVideoStream: Decodable, Sendable {
             resolution = nil
         }
 
+        let audioCodec: String? = (videoOnly ?? true) ? nil : "aac"
+
         return Stream(
             url: streamUrl,
             resolution: resolution,
             format: format ?? "unknown",
             videoCodec: codec,
-            audioCodec: nil,
+            audioCodec: audioCodec,
             bitrate: bitrate,
             fileSize: contentLength,
             isAudioOnly: false,
```

---

### Incident Patch 3: `c4101618` (2026-08-23)
**Commit Message**: Fix description timestamp links seeking to wrong position for out-of-range values (#966)

DescriptionText.parseTimestamp turned a matched timestamp string into a
clickable seek link by computing seconds from its colon-separated parts
with no range validation. The link regex (\d{1,2}:\d{2}(?::\d{2})?)
matches strings that are not valid clock positions, such as 1:99 or
0:60, and parseTimestamp happily computed 1*60+99 = 159 for 1:99 — so
tapping such a link seeked the player to 2:39 instead of being ignored.

This also diverged from ChapterParser, which rejects seconds/minutes
>= 60; the same timestamp string could be dropped as a chapter but
still seek as a description link.

- Validate seconds < 60 in the MM:SS branch and minutes < 60, seconds
  < 60 in the H:MM:SS branch; return nil otherwise
- Change parseTimestamp to return Int? and skip building the seek link
  for nil, so out-of-range matches are left as plain text
- Add DescriptionTextTests with valid, boundary, and out-of-range cases

**File**: `Yattee/Utilities/DescriptionText.swift` (modified, +19/-9)
```diff
@@ -56,28 +56,38 @@ enum DescriptionText {
                 }
 
                 let timestampString = String(text[range])
-                let seconds = parseTimestamp(timestampString)
-
-                if let url = URL(string: "yattee-seek://\(seconds)") {
-                    attributedString[attributedRange].link = url
-                    attributedString[attributedRange].foregroundColor = linkColor
+                guard let seconds = parseTimestamp(timestampString),
+                      let url = URL(string: "yattee-seek://\(seconds)") else {
+                    continue
                 }
+
+                attributedString[attributedRange].link = url
+                attributedString[attributedRange].foregroundColor = linkColor
             }
         }
 
         return attributedString
     }
 
     /// Parses a timestamp string (MM:SS or H:MM:SS) into total seconds.
-    static func parseTimestamp(_ timestamp: String) -> Int {
+    /// Returns nil when a component is out of its valid range (e.g. `1:99`,
+    /// `0:60`, `1:99:30`); those strings are matched by the link regex above
+    /// but are not valid clock positions, so they must not become seek links.
+    /// This mirrors the range validation in `ChapterParser`.
+    static func parseTimestamp(_ timestamp: String) -> Int? {
         let components = timestamp.split(separator: ":").compactMap { Int($0) }
         switch components.count {
         case 2: // MM:SS
-            return components[0] * 60 + components[1]
+            let seconds = components[1]
+            guard seconds < 60 else { return nil }
+            return components[0] * 60 + seconds
         case 3: // H:MM:SS
-            return components[0] * 3600 + components[1] * 60 + components[2]
+            let minutes = components[1]
+            let seconds = components[2]
+            guard minutes < 60, seconds < 60 else { return nil }
+            return components[0] * 3600 + minutes * 60 + seconds
         default:
-            return 0
+            return nil
         }
     }
 
```

**File**: `YatteeTests/DescriptionTextTests.swift` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+//
+//  DescriptionTextTests.swift
+//  YatteeTests
+//
+//  Unit tests for description-text timestamp parsing.
+//
+
+import Testing
+import Foundation
+@testable import Yattee
+
+@Suite("DescriptionText Timestamp Parsing")
+struct DescriptionTextTimestampTests {
+
+    // MARK: - Valid Timestamps
+
+    @Test("Parses M:SS format")
+    func parseMSS() {
+        #expect(DescriptionText.parseTimestamp("0:00") == 0)
+        #expect(DescriptionText.parseTimestamp("5:30") == 330)
+    }
+
+    @Test("Parses MM:SS format")
+    func parseMMSS() {
+        #expect(DescriptionText.parseTimestamp("00:00") == 0)
+        #expect(DescriptionText.parseTimestamp("12:45") == 765)
+        #expect(DescriptionText.parseTimestamp("59:59") == 3599)
+    }
+
+    @Test("Parses H:MM:SS format")
+    func parseHMMSS() {
+        #expect(DescriptionText.parseTimestamp("1:23:45") == 5025)
+        #expect(DescriptionText.parseTimestamp("01:23:45") == 5025)
+    }
+
+    @Test("Parses long minutes in MM:SS form")
+    func parseLongMinutes() {
+        // A 99-minute position is valid for a long video (2-digit minutes).
+        #expect(DescriptionText.parseTimestamp("99:59") == 5999)
+    }
+
+    // MARK: - Out-of-Range Rejection (regression)
+
+    @Test("Rejects seconds >= 60 in MM:SS form")
+    func rejectsInvalidSeconds() {
+        // Previously returned components[0]*60 + components[1] = 60 and 159,
+        // seeking the player to the wrong position.
+        #expect(DescriptionText.parseTimestamp("0:60") == nil)
+        #expect(DescriptionText.parseTimestamp("1:99") == nil)
+        #expect(DescriptionText.parseTimestamp("5:75") == nil)
+    }
+
+    @Test("Rejects minutes or seconds >= 60 in H:MM:SS form")
+    func rejectsInvalidHoursMinutesSeconds() {
+        #expect(DescriptionText.parseTimestamp("1:99:30") == nil)
+        #expect(DescriptionText.parseTimestamp("1:30:60") == nil)
+        #expect(DescriptionText.parseTimestamp("2:60:00") == nil)
+    }
+
+    // MARK: - Boundary
+
+    @Test("Accepts the 59 boundary in every field")
+    func acceptsBoundary() {
+        #expect(DescriptionText.parseTimestamp("59:59") == 3599)
+        #expect(DescriptionText.parseTimestamp("1:59:59") == 7199)
+    }
+}
```

---

### Incident Patch 4: `3d2544b2` (2026-08-23)
**Commit Message**: Fix deep link timestamp parsing accepting infinity as seek position (#965)

URLRouter.parseTimestampValue used TimeInterval(_:) for the plain-numeric
branch ("90", "90.5"). That initializer also accepts the special tokens
"inf"/"infinity" and "nan", and the value infinity compares as >= 0, so a
deep link or share URL carrying ?t=inf parsed to Double.infinity and was
forwarded to the player as a seek target. Seeking to infinity is undefined
and breaks playback startup for the affected link.

Reject non-finite values explicitly alongside the existing negative
check, so only finite non-negative seconds are accepted.

- Add isFinite guard to the plain-numeric branch of parseTimestampValue
- Cover inf/infinity/nan/negative rejection in URLRouterTests

**File**: `Yattee/Services/Navigation/URLRouter.swift` (modified, +4/-2)
```diff
@@ -145,9 +145,11 @@ struct URLRouter: Sendable {
         let trimmed = raw.trimmingCharacters(in: .whitespaces)
         guard !trimmed.isEmpty else { return nil }
 
-        // Plain numeric value (e.g. "90", "90.5")
+        // Plain numeric value (e.g. "90", "90.5"). Reject non-finite values
+        // ("inf"/"infinity"/"nan") that `TimeInterval(_:)` accepts — a `?t=inf`
+        // link would otherwise seek the player to `Double.infinity`.
         if let value = TimeInterval(trimmed) {
-            return value >= 0 ? value : nil
+            return (value.isFinite && value >= 0) ? value : nil
         }
 
         // Compound form like "1h2m3s", "2m30s", "90s"
```

**File**: `YatteeTests/NavigationTests.swift` (modified, +14/-0)
```diff
@@ -123,6 +123,20 @@ struct URLRouterTests {
         #expect(URLRouter.parseTimestampValue("90.5") == 90.5)
     }
 
+    @Test("Reject non-finite and negative plain timestamp values")
+    func rejectInvalidPlainTimestampValues() {
+        // Plain numeric values that are accepted by TimeInterval(_:) but are not
+        // valid seek targets must return nil rather than poisoning the player.
+        #expect(URLRouter.parseTimestampValue("inf") == nil)
+        #expect(URLRouter.parseTimestampValue("infinity") == nil)
+        #expect(URLRouter.parseTimestampValue("nan") == nil)
+        #expect(URLRouter.parseTimestampValue("-5") == nil)
+        // Valid plain seconds still parse.
+        #expect(URLRouter.parseTimestampValue("0") == 0)
+        #expect(URLRouter.parseTimestampValue("90") == 90)
+        #expect(URLRouter.parseTimestampValue("90.5") == 90.5)
+    }
+
     // MARK: - Share Extension Wrapper Tests
 
     @Test("Unwrap yattee://open wrapper to inner URL with timestamp")
```

---

### Incident Patch 5: `6c5c9915` (2026-08-23)
**Commit Message**: Fix audio sample rate label dropping the kHz decimal (#964)

MPVTrack.detailText built its sample-rate label with integer division
(`sampleRate / 1000`), which truncates the fractional kHz. The
second-most-common audio rate — 44100 Hz (CD quality, music videos) —
showed as "44 kHz", a label that denotes 44000 Hz (a different rate),
instead of the conventional "44.1 kHz" used by VLC, mpv and every DAW.
The same defect hit 88200 -> "88 kHz", 176400 -> "176 kHz" and
22050 -> "22 kHz". Whole-kHz rates (48000, 96000, ...) were already
correct and stay unchanged. The label is live in the quality selector's
advanced details, where EmbeddedTrackRowView renders track.detailText.

- Factor the formatting into MPVTrack.formatSampleRate(_:), a pure
  static helper: divide as Double, drop the decimal for whole kHz,
  otherwise keep 1-2 meaningful digits with the trailing zero stripped
  (44.1, 88.2, 22.05).
- detailText now appends Self.formatSampleRate(sampleRate); its structure
  (codec / channelCount parts, separator, nil-when-empty) is unchanged.
- Add YatteeTests/MPVTrackFormatTests covering whole-kHz rates, the
  44.1 kHz family (the bug), half-decimal rates and the detailText
  integrati

**File**: `Yattee/Models/MPVTrack.swift` (modified, +19/-2)
```diff
@@ -148,7 +148,24 @@ struct MPVTrack: Equatable, Sendable, Identifiable, Decodable {
         return preferred == baseLanguageCode
     }
 
-    /// Secondary detail line for advanced mode, e.g. "eac3 · 6ch · 48 kHz".
+    /// Format a sample rate in Hz as the conventional kHz label.
+    /// 48000 → "48 kHz", 44100 → "44.1 kHz", 88200 → "88.2 kHz",
+    /// 22050 → "22.05 kHz", 176400 → "176.4 kHz".
+    /// Whole-kHz rates drop the decimal; fractional rates keep their
+    /// meaningful digits (1–2 decimals, trailing zero stripped).
+    static func formatSampleRate(_ hz: Int) -> String {
+        let kHz = Double(hz) / 1000.0
+        if kHz == kHz.rounded() {
+            return "\(Int(kHz)) kHz"
+        }
+        var label = String(format: "%.2f", kHz)
+        if label.hasSuffix("0") {
+            label.removeLast()
+        }
+        return "\(label) kHz"
+    }
+
+    /// Secondary detail line for advanced mode, e.g. "aac · 2ch · 44.1 kHz".
     var detailText: String? {
         var parts: [String] = []
         if let codec, !codec.isEmpty {
@@ -158,7 +175,7 @@ struct MPVTrack: Equatable, Sendable, Identifiable, Decodable {
             parts.append("\(channelCount)ch")
         }
         if let sampleRate {
-            parts.append("\(sampleRate / 1000) kHz")
+            parts.append(Self.formatSampleRate(sampleRate))
         }
         return parts.isEmpty ? nil : parts.joined(separator: " · ")
     }
```

**File**: `YatteeTests/MPVTrackFormatTests.swift` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+//
+//  MPVTrackFormatTests.swift
+//  YatteeTests
+//
+//  Tests for MPVTrack sample-rate (kHz) label formatting.
+//
+
+import Testing
+import Foundation
+@testable import Yattee
+
+@Suite("MPVTrack sample-rate formatting")
+struct MPVTrackFormatTests {
+    @Test("Whole-kHz rates have no decimal")
+    func wholeKHz() {
+        #expect(MPVTrack.formatSampleRate(8000) == "8 kHz")
+        #expect(MPVTrack.formatSampleRate(16000) == "16 kHz")
+        #expect(MPVTrack.formatSampleRate(24000) == "24 kHz")
+        #expect(MPVTrack.formatSampleRate(48000) == "48 kHz")
+        #expect(MPVTrack.formatSampleRate(96000) == "96 kHz")
+        #expect(MPVTrack.formatSampleRate(192000) == "192 kHz")
+    }
+
+    @Test("44.1 kHz family keeps its decimal (the bug)")
+    func fractionalKHz() {
+        #expect(MPVTrack.formatSampleRate(44100) == "44.1 kHz")
+        #expect(MPVTrack.formatSampleRate(88200) == "88.2 kHz")
+        #expect(MPVTrack.formatSampleRate(176400) == "176.4 kHz")
+    }
+
+    @Test("Half-decimal rates keep two digits")
+    func halfDecimal() {
+        #expect(MPVTrack.formatSampleRate(22050) == "22.05 kHz")
+        // 11025/1000 = 11.025; %.2f rounds the nearest double to "11.03" on macOS arm64.
+        #expect(MPVTrack.formatSampleRate(11025) == "11.03 kHz")
+    }
+
+    @Test("detailText surfaces the formatted sample rate")
+    func detailTextIntegration() {
+        let track = MPVTrack(trackID: 1, type: .audio, codec: "aac",
+                             channelCount: 2, sampleRate: 44100)
+        #expect(track.detailText == "aac · 2ch · 44.1 kHz")
+    }
+}
```

---

### Incident Patch 6: `11d370b3` (2026-08-23)
**Commit Message**: Fix playback rate display dropping meaningful digits (#963)

PlaybackRate.displayText/compactDisplayText used String(format: "%.2gx"), whose significant-figure notation dropped meaningful digits (1.25 -> "1.2x") and rounded others (1.75 -> "1.8x"). Replace with a fixed two-decimal format + trailing-zero strip so whole rates have no decimal (2 -> "2x"), halves show one (1.5 -> "1.5x"), and quarter-steps are preserved (1.25 -> "1.25x"). Adds a Swift Testing suite (PlaybackRateTests) proving red->green.

**File**: `Yattee/Services/Player/PlayerState.swift` (modified, +15/-2)
```diff
@@ -131,13 +131,26 @@ enum PlaybackRate: Double, CaseIterable, Identifiable, Sendable {
         if rawValue == 1.0 {
             return String(localized: "player.playbackRate.normal")
         }
-        return String(format: "%.2gx", rawValue)
+        return formattedRate
     }
 
     /// Compact display text that always shows numeric value (e.g., "1x", "1.5x").
     /// Use this in space-constrained UI like the player pill.
     var compactDisplayText: String {
-        String(format: "%.2gx", rawValue)
+        formattedRate
+    }
+
+    /// The rate with an `x` suffix rendered with a fixed two-decimal format and
+    /// the trailing `.0` stripped, so whole rates have no decimal
+    /// (2 → "2x", 1.5 → "1.5x", 1.25 → "1.25x"). Replaces `%.2g`, whose
+    /// significant-figure notation dropped meaningful digits (1.25 → "1.2") and
+    /// rounded others (1.75 → "1.8"). `String(format:)` keeps the period decimal
+    /// separator, matching the player's other speed labels.
+    private var formattedRate: String {
+        var value = String(format: "%.2f", rawValue)
+        while value.hasSuffix("0") { value.removeLast() }
+        if value.hasSuffix(".") { value.removeLast() }
+        return "\(value)x"
     }
 }
 
```

**File**: `YatteeTests/PlaybackRateTests.swift` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+//
+//  PlaybackRateTests.swift
+//  YatteeTests
+//
+//  Tests for PlaybackRate display-text formatting.
+//
+
+import Testing
+import Foundation
+@testable import Yattee
+
+@Suite("PlaybackRate Display Tests")
+struct PlaybackRateDisplayTests {
+    @Test("displayText renders every rate without losing precision")
+    func displayTextPrecision() {
+        #expect(PlaybackRate.x025.displayText == "0.25x")
+        #expect(PlaybackRate.x05.displayText == "0.5x")
+        #expect(PlaybackRate.x075.displayText == "0.75x")
+        #expect(PlaybackRate.x125.displayText == "1.25x")
+        #expect(PlaybackRate.x15.displayText == "1.5x")
+        #expect(PlaybackRate.x175.displayText == "1.75x")
+        #expect(PlaybackRate.x2.displayText == "2x")
+        #expect(PlaybackRate.x25.displayText == "2.5x")
+        #expect(PlaybackRate.x3.displayText == "3x")
+    }
+
+    @Test("displayText for the normal rate uses the localized label, not the numeric form")
+    func displayTextNormal() {
+        let normal = PlaybackRate.x1.displayText
+        #expect(normal == String(localized: "player.playbackRate.normal"))
+        #expect(!normal.hasSuffix("x"))
+    }
+
+    @Test("compactDisplayText always shows the numeric value")
+    func compactDisplayText() {
+        #expect(PlaybackRate.x1.compactDisplayText == "1x")
+        #expect(PlaybackRate.x125.compactDisplayText == "1.25x")
+        #expect(PlaybackRate.x15.compactDisplayText == "1.5x")
+        #expect(PlaybackRate.x175.compactDisplayText == "1.75x")
+        #expect(PlaybackRate.x2.compactDisplayText == "2x")
+        #expect(PlaybackRate.x3.compactDisplayText == "3x")
+    }
+
+    @Test("every case has a non-empty display string")
+    func allCasesNonEmpty() {
+        for rate in PlaybackRate.allCases {
+            #expect(!rate.displayText.isEmpty)
+            #expect(!rate.compactDisplayText.isEmpty)
+        }
+    }
+}
```

---

### Incident Patch 7: `63b625bc` (2026-08-23)
**Commit Message**: Fix www.duckduckgo.com misrouting to yt-dlp external video extraction (#962)

**File**: `Yattee/Services/Navigation/URLRouter.swift` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@ struct URLRouter: Sendable {
         let excludedHosts = [
             "google.com", "www.google.com",
             "bing.com", "www.bing.com",
-            "duckduckgo.com",
+            "duckduckgo.com", "www.duckduckgo.com",
             "apple.com", "www.apple.com",
             "github.com", "www.github.com"
         ]
```

**File**: `YatteeTests/NavigationTests.swift` (modified, +20/-0)
```diff
@@ -273,6 +273,26 @@ struct URLRouterTests {
         }
     }
 
+    // MARK: - External Host Exclusion Tests
+
+    @Test("www.duckduckgo.com is excluded from external video routing")
+    func wwwDuckDuckGoExcluded() {
+        let url = URL(string: "https://www.duckduckgo.com/?q=cat+videos")!
+        let destination = router.route(url)
+        if case .externalVideo = destination {
+            Issue.record("www.duckduckgo.com must not route to externalVideo; yt-dlp extraction should not run for a search engine")
+        }
+    }
+
+    @Test("duckduckgo.com bare host remains excluded from external video")
+    func duckDuckGoBareExcluded() {
+        let url = URL(string: "https://duckduckgo.com/?q=test")!
+        let destination = router.route(url)
+        if case .externalVideo = destination {
+            Issue.record("duckduckgo.com must not route to externalVideo; yt-dlp extraction should not run for a search engine")
+        }
+    }
+
     // MARK: - YouTube Channel URL Tests
 
     @Test("Parse YouTube channel URL")
```

---

### Incident Patch 8: `dda7d6d5` (2026-08-03)
**Commit Message**: Bump build number to 269

**File**: `Yattee.xcodeproj/project.pbxproj` (modified, +12/-12)
```diff
@@ -570,7 +570,7 @@
 				AUTOMATION_APPLE_EVENTS = NO;
 				CODE_SIGN_ENTITLEMENTS = Yattee/Yattee.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 268;
+				CURRENT_PROJECT_VERSION = 269;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				ENABLE_APP_SANDBOX = YES;
@@ -656,7 +656,7 @@
 				CODE_SIGN_ENTITLEMENTS = Yattee/Yattee.entitlements;
 				"CODE_SIGN_ENTITLEMENTS[sdk=macosx*]" = "Yattee/Yattee-macOS.entitlements";
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 268;
+				CURRENT_PROJECT_VERSION = 269;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				ENABLE_APP_SANDBOX = YES;
@@ -800,7 +800,7 @@
 				CODE_SIGN_ENTITLEMENTS = Yattee/Yattee.entitlements;
 				"CODE_SIGN_ENTITLEMENTS[sdk=macosx*]" = "Yattee/Yattee-macOS-DeveloperID.entitlements";
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 268;
+				CURRENT_PROJECT_VERSION = 269;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				ENABLE_APP_SANDBOX = YES;
@@ -881,7 +881,7 @@
 			buildSettings = {
 				BUNDLE_LOADER = "$(TEST_HOST)";
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 268;
+				CURRENT_PROJECT_VERSION = 269;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				GENERATE_INFOPLIST_FILE = YES;
@@ -910,7 +910,7 @@
 			buildSettings = {
 				CODE_SIGN_ENTITLEMENTS = YatteeShareExtension/YatteeShareExtension.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 268;
+				CURRENT_PROJECT_VERSION = 269;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = YatteeShareExtension/Info.plist;
@@ -942,7 +942,7 @@
 			buildSettings = {
 				CODE_SIGN_ENTITLEMENTS = YatteeTopShelf/YatteeTopShelf.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 268;
+				CURRENT_PROJECT_VERSION = 269;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = YatteeTopShelf/Info.plist;
@@ -977,7 +977,7 @@
 			buildSettings = {
 				CODE_SIGN_ENTITLEMENTS = YatteeShareExtension/YatteeShareExtension.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 268;
+				CURRENT_PROJECT_VERSION = 269;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = YatteeShareExtension/Info.plist;
@@ -1008,7 +1008,7 @@
 			buildSettings = {
 				CODE_SIGN_ENTITLEMENTS = YatteeShareExtension/YatteeShareExtension.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 268;
+				CURRENT_PROJECT_VERSION = 269;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = YatteeShareExtension/Info.plist;
@@ -1040,7 +1040,7 @@
 			buildSettings = {
 				CODE_SIGN_ENTITLEMENTS = YatteeTopShelf/YatteeTopShelf.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 268;
+				CURRENT_PROJECT_VERSION = 269;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = YatteeTopShelf/Info.plist;
@@ -1074,7 +1074,7 @@
 			buildSettings = {
 				CODE_SIGN_ENTITLEMENTS = YatteeTopShelf/YatteeTopShelf.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 268;
+				CURRENT_PROJECT_VERSION = 269;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = YatteeTopShelf/Info.plist;
@@ -1109,7 +1109,7 @@
 			buildSettings = {
 				BUNDLE_LOADER = "$(TEST_HOST)";
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 268;
+				CURRENT_PROJECT_VERSION = 269;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				GENERATE_INFOPLIST_FILE = YES;
@@ -1138,7 +1138,7 @@
 			buildSettings = {
 				BUNDLE_LOADER = "$(TEST_HOST)";
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 268;
+				CURRENT_PROJECT_VERSION = 269;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = 78Z5H3M6RJ;
 				GENERATE_INFOPLIST_FILE = YES;
```

---

### Incident Patch 9: `b0f573be` (2026-08-03)
**Commit Message**: Fix double-tap fullscreen gesture rotating on portrait videos

The fullscreen button routes through a portrait-video check (toggling
the details panel instead of rotating), but the double-tap gesture
called onToggleFullscreen directly and always rotated to landscape.
Extract the shared decision into PlayerControlsActions.performFullscreenTap()
and use it from both the button and the tap gesture handler.

**File**: `Yattee/Views/Player/ControlsSectionRenderer.swift` (modified, +1/-21)
```diff
@@ -125,7 +125,7 @@ struct ControlsSectionRenderer: View {
         case .fullscreen:
             if actions.shouldShowFullscreenButton {
                 controlButton(systemImage: actions.fullscreenIcon) {
-                    handleFullscreenTap()
+                    actions.performFullscreenTap()
                 }
                 .disabled(isLocked)
                 .opacity(isLocked ? 0.5 : 1.0)
@@ -818,26 +818,6 @@ struct ControlsSectionRenderer: View {
         .animation(.easeInOut(duration: 0.2), value: isBrightnessExpanded)
     }
 
-    // MARK: - Fullscreen Handling
-
-    private func handleFullscreenTap() {
-        let isActualWidescreenLayout = actions.isWideScreenLayout && actions.onTogglePanel != nil
-
-        if actions.isIPad {
-            // iPad: always toggle details visibility
-            actions.onToggleDetailsVisibility?()
-        } else if isActualWidescreenLayout && actions.isFullscreen && !actions.isWidescreenVideo {
-            // iPhone in landscape with portrait video fullscreen: rotate back to portrait
-            actions.onToggleFullscreen?()
-        } else if !actions.isWidescreenVideo {
-            // iPhone portrait video in portrait layout: toggle details visibility
-            actions.onToggleDetailsVisibility?()
-        } else {
-            // iPhone with widescreen video: rotate orientation
-            actions.onToggleFullscreen?()
-        }
-    }
-
     // MARK: - Transport State
 
     private var isTransportDisabled: Bool {
```

**File**: `Yattee/Views/Player/PlayerControlsActions.swift` (modified, +21/-1)
```diff
@@ -277,8 +277,28 @@ struct PlayerControlsActions {
         }
     }
 
+    /// Shared fullscreen-tap decision used by the fullscreen button and tap gestures.
+    /// Keep in sync with `willRotateOnFullscreenToggle` (icon mirror of this logic).
+    func performFullscreenTap() {
+        let isActualWidescreenLayout = isWideScreenLayout && onTogglePanel != nil
+
+        if isIPad {
+            // iPad: always toggle details visibility
+            onToggleDetailsVisibility?()
+        } else if isActualWidescreenLayout && isFullscreen && !isWidescreenVideo {
+            // iPhone in landscape with portrait video fullscreen: rotate back to portrait
+            onToggleFullscreen?()
+        } else if !isWidescreenVideo {
+            // iPhone portrait video in portrait layout: toggle details visibility
+            onToggleDetailsVisibility?()
+        } else {
+            // iPhone with widescreen video: rotate orientation
+            onToggleFullscreen?()
+        }
+    }
+
     /// Whether tapping fullscreen will cause device rotation.
-    /// Mirrors the logic in ControlsSectionRenderer.handleFullscreenTap()
+    /// Mirrors the logic in `performFullscreenTap()`
     var willRotateOnFullscreenToggle: Bool {
         // iPad never rotates via fullscreen button
         guard !isIPad else { return false }
```

**File**: `Yattee/Views/Player/PlayerControlsView.swift` (modified, +2/-2)
```diff
@@ -1220,8 +1220,8 @@ struct PlayerControlsView: View {
                 }
 
             case .toggleFullscreen:
-                // Execute immediately
-                onToggleFullscreen?()
+                // Execute immediately, using the same decision logic as the fullscreen button
+                controlsActions.performFullscreenTap()
 
             case .togglePiP:
                 // Execute immediately
```

---

### Incident Patch 10: `01cf9c95` (2026-08-03)
**Commit Message**: Fix project.pbxproj

**File**: `Yattee.xcodeproj/project.pbxproj` (modified, +8/-8)
```diff
@@ -1218,14 +1218,6 @@
 /* End XCConfigurationList section */
 
 /* Begin XCRemoteSwiftPackageReference section */
-		378CF2FF2EF21783002C1CD7 /* XCRemoteSwiftPackageReference "MPVKit" */ = {
-			isa = XCRemoteSwiftPackageReference;
-			repositoryURL = "https://github.com/yattee/MPVKit.git";
-			requirement = {
-				kind = exactVersion;
-				version = 1.0.1;
-			};
-		};
 		370E71962F9A1A41000E04B2 /* XCRemoteSwiftPackageReference "Sparkle" */ = {
 			isa = XCRemoteSwiftPackageReference;
 			repositoryURL = "https://github.com/sparkle-project/Sparkle";
@@ -1242,6 +1234,14 @@
 				minimumVersion = 12.8.0;
 			};
 		};
+		378CF2FF2EF21783002C1CD7 /* XCRemoteSwiftPackageReference "MPVKit" */ = {
+			isa = XCRemoteSwiftPackageReference;
+			repositoryURL = "https://github.com/yattee/MPVKit.git";
+			requirement = {
+				kind = exactVersion;
+				version = 1.0.1;
+			};
+		};
 /* End XCRemoteSwiftPackageReference section */
 
 /* Begin XCSwiftPackageProductDependency section */
```

---

### Incident Patch 11: `d624a093` (2026-08-02)
**Commit Message**: Fix timed links resuming at watch position instead of URL timestamp

Timed links arrive wrapped as yattee://open?url=... from the share
extension, but the timestamp was parsed from the wrapper URL, where a
single-? form like youtu.be/ID?t=N hides t inside the url query item.
With no startTime the player fell back to saved watch progress.

- Add URLRouter.unwrapped(_:) resolving the wrapper to the inner URL
  (raw remainder after ?url=, since the share extension does not encode
  & and URLComponents would drop &t= parts) and use it in handleDeepLink
- Thread forceStartTime through openVideo/playPreferringDownloaded/play
  so explicit link timestamps beat the 90%-watched restart threshold,
  clamped to just before the end; resume flows keep the old behavior
- Carry the parsed timestamp through OpenLinkSheet's play action, which
  dropped it entirely
- Cover timestamp parsing and wrapper unwrapping in NavigationTests

**File**: `Yattee/Services/Navigation/URLRouter.swift` (modified, +26/-0)
```diff
@@ -96,6 +96,32 @@ struct URLRouter: Sendable {
         return true
     }
 
+    // MARK: - Wrapper Unwrapping
+
+    /// Resolve a `yattee://open?url={encoded_url}` wrapper (share extension) to the inner URL.
+    /// Returns the input unchanged for any other URL. The wrapper's query holds the full
+    /// original link, so timestamp parsing must run against the unwrapped URL.
+    ///
+    /// The share extension encodes with `.urlQueryAllowed`, which leaves `?`, `&`, and `=`
+    /// intact - URLComponents would split the inner URL's own query into separate wrapper
+    /// items (losing e.g. `&t=120`), so take the raw remainder after `?url=` instead.
+    func unwrapped(_ url: URL) -> URL {
+        guard url.scheme?.lowercased() == "yattee", url.host == "open",
+              let range = url.absoluteString.range(of: "?url=") else {
+            return url
+        }
+        let raw = String(url.absoluteString[range.upperBound...])
+        guard let decoded = raw.removingPercentEncoding,
+              let innerURL = URL(string: decoded) else {
+            return url
+        }
+        // Unwrap once more in case the wrapper was itself wrapped
+        if innerURL.scheme?.lowercased() == "yattee", innerURL.host == "open", innerURL != url {
+            return unwrapped(innerURL)
+        }
+        return innerURL
+    }
+
     // MARK: - Timestamp Parsing
 
     /// Extract a timestamp (seconds) from a URL's query, supporting `t`, `time`, and `start`.
```

**File**: `Yattee/Services/Player/PlayerService.swift` (modified, +18/-9)
```diff
@@ -240,7 +240,9 @@ final class PlayerService {
     ///   - stream: Optional specific stream to use (if provided, skips fetching streams from API)
     ///   - audioStream: Optional separate audio stream (for video-only streams)
     ///   - startTime: Optional start time in seconds
-    func play(video: Video, stream: Stream? = nil, audioStream: Stream? = nil, startTime: TimeInterval? = nil) async {
+    ///   - forceStartTime: When true, startTime is an explicit user request (timed link,
+    ///     chapter tap) and is honored even past the completion threshold
+    func play(video: Video, stream: Stream? = nil, audioStream: Stream? = nil, startTime: TimeInterval? = nil, forceStartTime: Bool = false) async {
         // Downloaded/local files bypass stream selection (they arrive here as
         // ready-made file:// streams), so audio mode is applied at this choke
         // point instead of in selectStreams.
@@ -427,7 +429,11 @@ final class PlayerService {
             } else if let startTime {
                 // Explicit startTime provided - use it (0 means play from beginning, >0 means resume)
                 // For quality switching with startTime > 0, honor the time unless video was completed
-                if startTime > 0 && completionThreshold > 0 && startTime >= completionThreshold {
+                if forceStartTime {
+                    // User-requested timestamp (timed link, chapter tap) - always honor it,
+                    // clamped so an out-of-range value can't seek past the end.
+                    seekTime = effectiveDuration > 0 ? min(startTime, max(0, effectiveDuration - 1)) : startTime
+                } else if startTime > 0 && completionThreshold > 0 && startTime >= completionThreshold {
                     seekTime = 0  // Video was completed, start over
                 } else {
                     seekTime = startTime
@@ -951,15 +957,16 @@ final class PlayerService {
         video: Video,
         fallbackStream: Stream? = nil,
         fallbackAudioStream: Stream? = nil,
-        startTime: TimeInterval? = nil
+        startTime: TimeInterval? = nil,
+        forceStartTime: Bool = false
     ) async {
         // Check if this is a media source video needing on-demand resolution
         // Uses unified method that fetches folder contents dynamically - works from any playback source
         if video.isFromMediaSource {
             do {
                 let (stream, captions) = try await resolveMediaSourceStream(for: video)
                 currentDownload = nil
-                await play(video: video, stream: stream, audioStream: nil, startTime: startTime)
+                await play(video: video, stream: stream, audioStream: nil, startTime: startTime, forceStartTime: forceStartTime)
 
                 // Set available captions and auto-select preferred
                 if !captions.isEmpty {
@@ -983,7 +990,7 @@ final class PlayerService {
             if let (downloadedVideo, localStream, audioStream, captionURL, dislikeCount) = downloadManager.videoAndStream(for: download) {
                 // Store the download info for later reference
                 currentDownload = download
-                await play(video: downloadedVideo, stream: localStream, audioStream: audioStream, startTime: startTime)
+                await play(video: downloadedVideo, stream: localStream, audioStream: audioStream, startTime: startTime, forceStartTime: forceStartTime)
                 // Restore dislike count from download (for offline playback)
                 if let dislikeCount {
                     state.dislikeCount = dislikeCount
@@ -1014,11 +1021,11 @@ final class PlayerService {
                     autoDismissDelay: 4.0
                 )
                 currentDownload = nil
-                await play(video: video, stream: fallbackStream, audioStream: fallbackAudioStream, startTime: startTime)
+                await play(video: video, stream: fallbackStream, audioStream: fallbackAudioStream, startTime: startTime, forceStartTime: forceStartTime)
             }
         } else {
             currentDownload = nil
-            await play(video: video, stream: fallbackStream, audioStream: fallbackAudioStream, startTime: startTime)
+            await play(video: video, stream: fallbackStream, audioStream: fallbackAudioStream, startTime: startTime, forceStartTime: forceStartTime)
         }
     }
 
@@ -1044,7 +1051,9 @@ final class PlayerService {
     /// - Parameters:
     ///   - video: The video to open
     ///   - startTime: Optional start time in seconds (used for continue watching)
-    func openVideo(_ video: Video, startTime: TimeInterval? = nil) {
+    ///   - forceStartTime: When true, startTime is an explicit user request (timed link,
+    ///     chapter tap) and is honored even past the completion threshold
+    func openVideo(_ video: Video, startTime: TimeInterval? = nil, forceStartTime: Bool = false) {
         // Live streams have no meaningful r
```

**File**: `Yattee/Views/Home/OpenLinkSheet.swift` (modified, +5/-3)
```diff
@@ -682,7 +682,7 @@ struct OpenLinkFormView: View {
 
                 if !firstVideoPlayed {
                     // Play first video - this expands player
-                    playVideo(video, appEnvironment: appEnvironment)
+                    playVideo(video, sourceURL: url, appEnvironment: appEnvironment)
                     firstVideoPlayed = true
                 } else {
                     // Add to queue
@@ -767,11 +767,13 @@ struct OpenLinkFormView: View {
         }
     }
 
-    private func playVideo(_ video: Video, appEnvironment: AppEnvironment) {
+    private func playVideo(_ video: Video, sourceURL: URL, appEnvironment: AppEnvironment) {
         // Don't pass a specific stream - let the player's selectStreamAndBackend
         // choose the best video+audio combination. Using streams.first would
         // incorrectly select audio-only streams for sites like Bilibili.
-        appEnvironment.playerService.openVideo(video)
+        let router = URLRouter()
+        let startTime = router.parseTimestamp(router.unwrapped(sourceURL))
+        appEnvironment.playerService.openVideo(video, startTime: startTime, forceStartTime: startTime != nil)
     }
 
     // MARK: - Download Action
```

**File**: `Yattee/YatteeApp.swift` (modified, +4/-1)
```diff
@@ -500,6 +500,9 @@ struct YatteeApp: App {
     /// Handle incoming deep link URLs.
     private func handleDeepLink(_ url: URL) {
         let router = URLRouter()
+        // Resolve yattee://open?url=… wrappers first so timestamp parsing and
+        // sheet prefill below see the real link, not the wrapper.
+        let url = router.unwrapped(url)
         guard let destination = router.route(url) else { return }
 
         let action = appEnvironment.settingsManager.defaultLinkAction
@@ -671,7 +674,7 @@ struct YatteeApp: App {
             )
             LoggingService.shared.info("Deep link play: fetched video, opening player", category: .general)
             appEnvironment.toastManager.dismiss(id: toastID)
-            appEnvironment.playerService.openVideo(video, startTime: startTime)
+            appEnvironment.playerService.openVideo(video, startTime: startTime, forceStartTime: startTime != nil)
         } catch {
             LoggingService.shared.error(
                 "Deep link play: video fetch failed (\(error.localizedDescription)), falling back to info view",
```

**File**: `YatteeTests/NavigationTests.swift` (modified, +57/-0)
```diff
@@ -107,6 +107,63 @@ struct URLRouterTests {
         }
     }
 
+    // MARK: - Timestamp Parsing Tests
+
+    @Test("Parse timestamp from youtu.be short URL")
+    func timestampFromShortURL() {
+        let url = URL(string: "https://youtu.be/GBimVR2VBQU?t=17097")!
+        #expect(router.parseTimestamp(url) == 17097)
+    }
+
+    @Test("Parse compound timestamp value")
+    func compoundTimestampValue() {
+        #expect(URLRouter.parseTimestampValue("1h2m3s") == 3723)
+        #expect(URLRouter.parseTimestampValue("2m30s") == 150)
+        #expect(URLRouter.parseTimestampValue("90s") == 90)
+        #expect(URLRouter.parseTimestampValue("90.5") == 90.5)
+    }
+
+    // MARK: - Share Extension Wrapper Tests
+
+    @Test("Unwrap yattee://open wrapper to inner URL with timestamp")
+    func unwrapOpenWrapper() {
+        // Share extension percent-encoding leaves ?, /, : intact - this is the literal form delivered
+        let wrapper = URL(string: "yattee://open?url=https://youtu.be/GBimVR2VBQU?t=17097")!
+        let inner = router.unwrapped(wrapper)
+
+        #expect(inner.absoluteString == "https://youtu.be/GBimVR2VBQU?t=17097")
+        #expect(router.parseTimestamp(inner) == 17097)
+
+        // Unwrapped URL still routes to the right video
+        if case .video(let source, _) = router.route(inner), case .id(let videoID) = source {
+            #expect(videoID.videoID == "GBimVR2VBQU")
+        } else {
+            Issue.record("Expected video destination")
+        }
+    }
+
+    @Test("Unwrap wrapper with ampersand timestamp form")
+    func unwrapOpenWrapperAmpersandForm() {
+        let wrapper = URL(string: "yattee://open?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120")!
+        let inner = router.unwrapped(wrapper)
+
+        #expect(router.parseTimestamp(inner) == 120)
+        if case .video(let source, _) = router.route(inner), case .id(let videoID) = source {
+            #expect(videoID.videoID == "dQw4w9WgXcQ")
+        } else {
+            Issue.record("Expected video destination")
+        }
+    }
+
+    @Test("Unwrapped returns non-wrapper URLs unchanged")
+    func unwrapPassthrough() {
+        let plain = URL(string: "https://youtu.be/dQw4w9WgXcQ?t=42")!
+        #expect(router.unwrapped(plain) == plain)
+
+        let scheme = URL(string: "yattee://subscriptions")!
+        #expect(router.unwrapped(scheme) == scheme)
+    }
+
     // MARK: - PeerTube URL Tests
 
     @Test("Parse PeerTube /w/ video URL")
```

---

### Incident Patch 12: `d17423fa` (2026-08-02)
**Commit Message**: Fix autoplay countdown showing in repeat one queue mode

When queue mode was set to repeat one, the "Playing in N seconds"
countdown still appeared after a video ended, showing the next queued
video - then restarting the current one anyway. The video-end path
never consulted the queue mode; only playNext() did, after the
countdown had already run.

- PlayerService.backendDidFinishPlaying: restart immediately in repeat
  one mode, regardless of queue contents, player visibility, background,
  or PiP. This also fixes repeat one never looping with an empty queue.
- ExpandedPlayerSheet.isAutoPlayEnabled: false in repeat one mode, which
  gates all countdown triggers (start on ended, overlay render, re-arm
  on appear) on iOS/macOS.
- TVPlayerView.handleVideoEnded: early-return in repeat one mode so
  tvOS shows neither the countdown nor the replay controls.

**File**: `Yattee/Services/Player/PlayerService.swift` (modified, +9/-0)
```diff
@@ -3126,6 +3126,15 @@ extension PlayerService: PlayerBackendDelegate {
         saveProgressAsCompleted()
         delegate?.playerServiceDidFinishPlaying(self)
 
+        // Repeat one: restart immediately - no countdown, independent of queue contents
+        // and the auto-play-next setting (that setting governs advancing to the next video)
+        if state.queueMode == .repeatOne {
+            Task {
+                await playNext()
+            }
+            return
+        }
+
         // Auto-play immediately if player is not visible (no point showing countdown)
         // UI (ExpandedPlayerSheet) will handle countdown when player is visible
         let autoPlayEnabled = settingsManager?.queueAutoPlayNext ?? true
```

**File**: `Yattee/Views/Player/ExpandedPlayerSheet.swift` (modified, +2/-1)
```diff
@@ -134,7 +134,8 @@ struct ExpandedPlayerSheet: View {
 
     var isAutoPlayEnabled: Bool {
         (appEnvironment?.settingsManager.queueEnabled ?? true) &&
-        (appEnvironment?.settingsManager.queueAutoPlayNext ?? true)
+        (appEnvironment?.settingsManager.queueAutoPlayNext ?? true) &&
+        playerState?.queueMode != .repeatOne
     }
 
     var autoPlayCountdownDuration: Int {
```

**File**: `Yattee/Views/Player/tvOS/TVPlayerView.swift` (modified, +5/-0)
```diff
@@ -1046,6 +1046,11 @@ struct TVPlayerView: View {
             controlsVisible = false
         }
 
+        // Repeat one: PlayerService restarts the video itself - no countdown, no replay controls
+        if playerState?.queueMode == .repeatOne {
+            return
+        }
+
         // Check if autoplay is enabled and there's a next video
         let autoPlayEnabled = appEnvironment?.settingsManager.queueAutoPlayNext ?? true
         let hasNextVideo = playerState?.hasNext ?? false
```

---

### Incident Patch 13: `908a916f` (2026-07-31)
**Commit Message**: Fix sending extracted videos (Twitch streams) to other devices

The remote control loadVideo command only carried the raw video ID and
an instance URL, so extracted videos (Twitch live streams and other
yt-dlp sites) failed on the receiver: it tried to fetch the ID from the
/api/v1/videos endpoint, which rejects non-YouTube IDs.

The command now carries the full ContentSource and title. The receiver
rebuilds the VideoID from the source and opens a placeholder Video -
the player then re-extracts streams and full metadata from the original
URL, same as when opening the video locally. Media-source extractors
(WebDAV/SMB/local) keep using the existing UUID:path branch.

Both fields are optional for protocol compatibility: old receivers
ignore them, commands from old senders keep the legacy behavior.

Also stop sending a start time for live streams - there is no shared
timeline, the receiver joins at the live edge.

**File**: `Yattee/Services/RemoteControl/RemoteControlCoordinator.swift` (modified, +79/-6)
```diff
@@ -389,7 +389,7 @@ final class RemoteControlCoordinator {
     ///   - startTime: Optional start time to seek to after loading.
     ///   - pauseLocalPlayback: If true, pause local playback when remote device starts playing (for "Move to" feature).
     ///   - device: The device to load the video on.
-    func loadVideo(videoID: String, videoTitle: String? = nil, instanceURL: String?, startTime: TimeInterval? = nil, pauseLocalPlayback: Bool = false, on device: DiscoveredDevice) async {
+    func loadVideo(videoID: String, videoTitle: String? = nil, videoSource: ContentSource? = nil, instanceURL: String?, startTime: TimeInterval? = nil, pauseLocalPlayback: Bool = false, on device: DiscoveredDevice) async {
         rcLog("REMOTEPLAY", "[\(device.name)] Starting remote play", details: "videoID=\(videoID), instance=\(instanceURL ?? "default"), startTime=\(startTime ?? 0), pauseLocal=\(pauseLocalPlayback)")
 
         // Clear any stale pending state from previous timed-out operations
@@ -432,7 +432,7 @@ final class RemoteControlCoordinator {
 
         // For move operations, use handshake protocol: remote prepares but waits for play command
         let awaitPlayCommand = pauseLocalPlayback
-        await sendCommand(.loadVideo(videoID: videoID, instanceURL: instanceURL, startTime: startTime, awaitPlayCommand: awaitPlayCommand), to: device)
+        await sendCommand(.loadVideo(videoID: videoID, instanceURL: instanceURL, startTime: startTime, awaitPlayCommand: awaitPlayCommand, videoSource: videoSource, videoTitle: videoTitle), to: device)
         rcLog("REMOTEPLAY", "[\(device.name)] loadVideo command sent, waiting for state update...")
     }
 
@@ -620,8 +620,8 @@ final class RemoteControlCoordinator {
                 playerService?.state.rate = playbackRate
             }
 
-        case .loadVideo(let videoID, let instanceURLString, let startTime, let awaitPlayCommand):
-            rcLog("HANDLE", "[\(senderName)] Executing: loadVideo", details: "videoID=\(videoID), instance=\(instanceURLString ?? "default"), startTime=\(startTime ?? 0), awaitPlay=\(awaitPlayCommand ?? false)")
+        case .loadVideo(let videoID, let instanceURLString, let startTime, let awaitPlayCommand, let videoSource, let videoTitle):
+            rcLog("HANDLE", "[\(senderName)] Executing: loadVideo", details: "videoID=\(videoID), instance=\(instanceURLString ?? "default"), startTime=\(startTime ?? 0), awaitPlay=\(awaitPlayCommand ?? false), source=\(videoSource.map(String.init(describing:)) ?? "none")")
             // Show toast indicating remote video opening
             if let deviceName = controllingDevice?.name {
                 toastManager?.show(
@@ -633,7 +633,7 @@ final class RemoteControlCoordinator {
                     autoDismissDelay: 5.0
                 )
             }
-            await handleLoadVideo(videoID: videoID, instanceURLString: instanceURLString, startTime: startTime, awaitPlayCommand: awaitPlayCommand ?? false, senderDeviceID: message.senderDeviceID)
+            await handleLoadVideo(videoID: videoID, instanceURLString: instanceURLString, startTime: startTime, awaitPlayCommand: awaitPlayCommand ?? false, videoSource: videoSource, videoTitle: videoTitle, senderDeviceID: message.senderDeviceID)
 
         case .closeVideo:
             rcLog("HANDLE", "[\(senderName)] Executing: closeVideo")
@@ -766,8 +766,11 @@ final class RemoteControlCoordinator {
         }
     }
 
-    private func handleLoadVideo(videoID: String, instanceURLString: String?, startTime: TimeInterval? = nil, awaitPlayCommand: Bool = false, senderDeviceID: String? = nil) async {
+    private func handleLoadVideo(videoID: String, instanceURLString: String?, startTime: TimeInterval? = nil, awaitPlayCommand: Bool = false, videoSource: ContentSource? = nil, videoTitle: String? = nil, senderDeviceID: String? = nil) async {
         rcLog("LOADVIDEO", "Loading video: \(videoID)", details: "startTime=\(startTime ?? 0), awaitPlay=\(awaitPlayCommand)")
+        // Short standalone line so it can't be lost to log truncation - confirms this build
+        // understands videoSource and shows what was decoded from the wire
+        rcLog("LOADVIDEO", "Protocol v2: videoSource=\(videoSource?.id ?? "nil"), title=\(videoTitle ?? "nil")")
 
         // Check if we're already playing the same video - just seek instead of reloading
         if let currentVideoID = playerService?.state.currentVideo?.id.videoID,
@@ -808,6 +811,29 @@ final class RemoteControlCoordinator {
             return
         }
 
+        // Extracted videos (Twitch streams, other yt-dlp sites) can't be fetched from the
+        // /videos API - reconstruct the VideoID from the sender's ContentSource and let the
+        // player re-extract from the original URL. Media-source extractors (WebDAV/SMB/local)
+        // are excluded: they're handled by the UUID:path branch above and need a locally
+        // configured source, not extraction.
+        if let videoSource,
```

**File**: `Yattee/Services/RemoteControl/RemoteControlProtocol.swift` (modified, +4/-1)
```diff
@@ -52,7 +52,10 @@ enum RemoteControlCommand: Codable, Sendable {
     case setVolume(Float)
     case setMuted(Bool)
     case setRate(Float)
-    case loadVideo(videoID: String, instanceURL: String?, startTime: TimeInterval?, awaitPlayCommand: Bool?)
+    /// `videoSource` carries the full ContentSource so non-API videos (e.g. extracted
+    /// Twitch streams) can be reconstructed on the receiver. Optional for
+    /// backward compatibility with older app versions.
+    case loadVideo(videoID: String, instanceURL: String?, startTime: TimeInterval?, awaitPlayCommand: Bool?, videoSource: ContentSource?, videoTitle: String?)
     case closeVideo
     case toggleFullscreen
     case playNext
```

**File**: `Yattee/Views/Components/VideoContextMenu.swift` (modified, +5/-2)
```diff
@@ -527,8 +527,9 @@ struct VideoContextMenuContent: View {
             await remoteControl.loadVideo(
                 videoID: video.id.videoID,
                 videoTitle: video.title,
+                videoSource: video.id.source,
                 instanceURL: instanceURL,
-                startTime: startTime,
+                startTime: video.isLive ? nil : startTime,
                 pauseLocalPlayback: false,
                 on: device
             )
@@ -556,11 +557,13 @@ struct VideoContextMenuContent: View {
 
             // Send load video command with current playback time
             // pauseLocalPlayback: true will pause local playback when remote device confirms it started playing
+            // Live streams have no shared timeline - the remote device joins the stream at the live edge
             await remoteControl.loadVideo(
                 videoID: video.id.videoID,
                 videoTitle: video.title,
+                videoSource: video.id.source,
                 instanceURL: instanceURL,
-                startTime: currentTime,
+                startTime: video.isLive ? nil : currentTime,
                 pauseLocalPlayback: true,
                 on: device
             )
```

---

### Incident Patch 14: `2c0c2e85` (2026-07-31)
**Commit Message**: Apply thumbnail fallback everywhere a single URL was rendered

The previous fix rebuilt the quality chain when converting persisted
models back to videos, but many consumers discarded it again by
rendering bestThumbnail (usually a maxresdefault.jpg that 404s for
older videos) as a single URL with no fallback.

Extract the retry logic from VideoThumbnailView into FallbackLazyImage
and use it at every in-app site that can iterate: player thumbnails
(mini bar, expanded sheet loaders, autoplay previews, tvOS audio-mode
artwork - previously a silent black screen), video info card and tvOS
header, and the tvOS playlist cover.

Sites that fetch or send exactly one URL are rewritten to the
always-available hqdefault variant via Thumbnail.reliableURL (exposed
as Video.reliableThumbnailURL): Now Playing artwork, Top Shelf
snapshots, remote control state, the frozen transition thumbnail,
blurred info background, navigation covers, and playlist covers
derived from a video's first thumbnail in Invidious/Yattee Server
responses.

Also invert RecentPlaylist's upgrade helper, which rewrote covers *to*
maxresdefault, walk the quality chain when caching download thumbnails
for offline artwork instea

**File**: `Yattee/Data/DataManager+Recents.swift` (modified, +1/-1)
```diff
@@ -358,7 +358,7 @@ extension DataManager {
             existing.title = playlist.title
             existing.authorName = playlist.authorName
             existing.videoCount = playlist.videoCount
-            existing.thumbnailURLString = RecentPlaylist.upgradedThumbnailURLString(playlist.thumbnailURL)
+            existing.thumbnailURLString = RecentPlaylist.reliableThumbnailURLString(playlist.thumbnailURL)
             savedEntry = existing
         } else {
             // Create new entry
```

**File**: `Yattee/Data/RecentPlaylist.swift` (modified, +6/-13)
```diff
@@ -57,23 +57,16 @@ final class RecentPlaylist {
             title: playlist.title,
             authorName: playlist.authorName,
             videoCount: playlist.videoCount,
-            thumbnailURLString: upgradedThumbnailURLString(playlist.thumbnailURL)
+            thumbnailURLString: reliableThumbnailURLString(playlist.thumbnailURL)
         )
     }
 
-    /// Rewrites YouTube `/vi/ID/{default|mq|hq|sd}default.jpg` thumbnails to `maxresdefault.jpg`
-    /// so recent playlist cards show a higher-quality image.
-    static func upgradedThumbnailURLString(_ url: URL?) -> String? {
+    /// Rewrites YouTube `/vi/ID/...` thumbnails to the always-available `hqdefault.jpg`
+    /// variant: recent playlist cards render a single URL without fallback, and
+    /// higher-quality variants (`maxresdefault`/`sddefault`) 404 for many older videos.
+    static func reliableThumbnailURLString(_ url: URL?) -> String? {
         guard let url else { return nil }
-        let path = url.path
-        let upgradable = ["default.jpg", "mqdefault.jpg", "hqdefault.jpg", "sddefault.jpg"]
-        guard path.range(of: #"/vi/[^/]+/"#, options: .regularExpression) != nil,
-              let match = upgradable.first(where: { path.hasSuffix($0) }),
-              var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
-            return url.absoluteString
-        }
-        components.path = String(path.dropLast(match.count)) + "maxresdefault.jpg"
-        return components.url?.absoluteString ?? url.absoluteString
+        return (Thumbnail.reliableURL(for: url) ?? url).absoluteString
     }
 
     private static func extractSourceInfo(from source: ContentSource) -> (String, String?) {
```

**File**: `Yattee/Models/Video.swift` (modified, +10/-0)
```diff
@@ -100,6 +100,16 @@ struct Video: Identifiable, Codable, Sendable {
         thumbnails.sorted { $0.quality > $1.quality }.map(\.url)
     }
 
+    /// Best thumbnail URL rewritten to the always-available `hqdefault` variant.
+    ///
+    /// For consumers that render or fetch a single URL with no way to fall back
+    /// through the quality chain (Now Playing artwork, Top Shelf, remote control,
+    /// navigation covers): the best advertised variant is often `maxresdefault`,
+    /// which 404s for many older videos.
+    var reliableThumbnailURL: URL? {
+        Thumbnail.reliableURL(for: bestThumbnail?.url)
+    }
+
     var formattedDuration: String {
         guard !isLive else { return "LIVE" }
         guard duration > 0 else { return "" }
```

**File**: `Yattee/Services/API/InvidiousAPI.swift` (modified, +3/-3)
```diff
@@ -763,7 +763,7 @@ private struct InvidiousAuthPlaylist: Decodable, Sendable {
             description: description,
             author: author.map { Author(id: "", name: $0) },
             videoCount: videoCount,
-            thumbnailURL: videos?.first?.videoThumbnails?.first?.thumbnailURL(baseURL: baseURL),
+            thumbnailURL: Thumbnail.reliableURL(for: videos?.first?.videoThumbnails?.first?.thumbnailURL(baseURL: baseURL)),
             videos: videos?.map { $0.toVideo(baseURL: baseURL) } ?? []
         )
     }
@@ -1551,7 +1551,7 @@ private struct InvidiousPlaylist: Decodable, Sendable {
             description: description,
             author: authorId.map { Author(id: $0, name: author ?? "") },
             videoCount: videoCount,
-            thumbnailURL: validVideos.first?.thumbnails.first?.url,
+            thumbnailURL: Thumbnail.reliableURL(for: validVideos.first?.thumbnails.first?.url),
             videos: validVideos
         )
     }
@@ -1683,7 +1683,7 @@ private struct InvidiousSearchPlaylist: Decodable, Sendable {
             title: title,
             author: authorId.map { Author(id: $0, name: author ?? "") },
             videoCount: videoCount,
-            thumbnailURL: thumbnailURL,
+            thumbnailURL: Thumbnail.reliableURL(for: thumbnailURL),
             videos: videos?.map { $0.toVideo(baseURL: baseURL) } ?? []
         )
     }
```

**File**: `Yattee/Services/API/PipedAPI.swift` (modified, +2/-6)
```diff
@@ -532,9 +532,7 @@ private struct PipedVideo: Decodable, Sendable {
             publishedText: uploadedDate,
             viewCount: views.map { Int($0) },
             likeCount: nil,
-            thumbnails: thumbnail.flatMap { URL(string: $0) }.map {
-                [Thumbnail(url: $0, quality: .high)]
-            } ?? [],
+            thumbnails: Thumbnail.fallbackChain(for: thumbnail.flatMap { URL(string: $0) }),
             isLive: duration == -1,
             isUpcoming: false,
             scheduledStartTime: nil
@@ -771,9 +769,7 @@ private struct PipedSearchItem: Decodable, Sendable {
             publishedText: uploadedDate,
             viewCount: views.map { Int($0) },
             likeCount: nil,
-            thumbnails: thumbnail.flatMap { URL(string: $0) }.map {
-                [Thumbnail(url: $0, quality: .high)]
-            } ?? [],
+            thumbnails: Thumbnail.fallbackChain(for: thumbnail.flatMap { URL(string: $0) }),
             isLive: duration == -1,
             isUpcoming: false,
             scheduledStartTime: nil
```

**File**: `Yattee/Services/API/YatteeServerAPI.swift` (modified, +2/-2)
```diff
@@ -1363,7 +1363,7 @@ private struct YatteePlaylist: Decodable, Sendable {
             description: description,
             author: authorId.map { Author(id: $0, name: author ?? "") },
             videoCount: videoCount,
-            thumbnailURL: validVideos.first?.thumbnails.first?.url,
+            thumbnailURL: Thumbnail.reliableURL(for: validVideos.first?.thumbnails.first?.url),
             videos: validVideos
         )
     }
@@ -1440,7 +1440,7 @@ private struct YatteeSearchPlaylist: Decodable, Sendable {
             title: title,
             author: authorId.map { Author(id: $0, name: author ?? "") },
             videoCount: videoCount,
-            thumbnailURL: thumbnailURL,
+            thumbnailURL: Thumbnail.reliableURL(for: thumbnailURL),
             videos: videos?.map { $0.toVideo() } ?? []
         )
     }
```

**File**: `Yattee/Services/Downloads/DownloadManager+Assets.swift` (modified, +10/-5)
```diff
@@ -346,12 +346,17 @@ extension DownloadManager {
             var thumbnailPath: String?
             var channelThumbnailPath: String?
 
-            // Download video thumbnail (best quality) - best-effort, ignore failures
+            // Download video thumbnail - best-effort, ignore failures. The stored URL
+            // is the best advertised variant (often maxresdefault, which 404s for
+            // older videos), so walk the quality chain until one succeeds.
             if let thumbnailURL = download.thumbnailURL {
-                thumbnailPath = await downloadThumbnail(
-                    from: thumbnailURL,
-                    filename: "\(videoID)_thumbnail.jpg"
-                )
+                for candidate in Thumbnail.fallbackChain(for: thumbnailURL) {
+                    thumbnailPath = await downloadThumbnail(
+                        from: candidate.url,
+                        filename: "\(videoID)_thumbnail.jpg"
+                    )
+                    if thumbnailPath != nil { break }
+                }
             }
 
             // Download channel thumbnail - best-effort, ignore failures
```

**File**: `Yattee/Services/Player/PlayerService.swift` (modified, +3/-1)
```diff
@@ -522,8 +522,10 @@ final class PlayerService {
                    let localThumbnailPath = download.localThumbnailPath {
                     localThumbnailURL = downloadManager.downloadsDirectory().appendingPathComponent(localThumbnailPath)
                 }
+                // Reliable (hqdefault) variant: artwork is a single fetch with no
+                // fallback, and the best advertised variant often 404s.
                 await nowPlayingService.loadArtwork(
-                    from: videoForNowPlaying.bestThumbnail?.url,
+                    from: videoForNowPlaying.reliableThumbnailURL,
                     localPath: localThumbnailURL
                 )
             }
```

---

### Incident Patch 15: `fd1029d3` (2026-07-31)
**Commit Message**: Fix missing thumbnails for videos saved to library

Persistence models (local playlists, watch history, bookmarks,
downloads) store only the best advertised thumbnail URL - usually
maxresdefault.jpg, which doesn't exist for many older videos and 404s.
Live API results survive this because views fall back through the full
quality chain, but toVideo() rebuilt videos with that single dead URL,
leaving placeholder covers.

Reconstruct the quality fallback chain from the stored YouTube-style
URL at read time (Thumbnail.fallbackChain), and rewrite playlist list
covers to the always-available hqdefault variant
(Thumbnail.reliableURL), since those views render a single URL without
fallback. Also expand the fabricated maxres URL in PipedAPI into a
full chain.

**File**: `Yattee/Data/Bookmark.swift` (modified, +1/-1)
```diff
@@ -217,7 +217,7 @@ final class Bookmark {
             publishedText: publishedText,
             viewCount: viewCount,
             likeCount: nil,
-            thumbnails: thumbnailURL.map { [Thumbnail(url: $0, width: nil, height: nil)] } ?? [],
+            thumbnails: Thumbnail.fallbackChain(for: thumbnailURL),
             isLive: isLive,
             isUpcoming: false,
             scheduledStartTime: nil
```

**File**: `Yattee/Data/LocalPlaylist.swift` (modified, +10/-4)
```diff
@@ -75,10 +75,16 @@ final class LocalPlaylist {
     }
 
     /// The first video's thumbnail URL for display.
+    ///
+    /// Rewritten to the always-available `hqdefault` variant because the stored
+    /// URL is the best advertised quality (often `maxresdefault`), which 404s
+    /// for many older videos and would leave the cover blank.
     var thumbnailURL: URL? {
-        (items ?? []).sorted { $0.sortOrder < $1.sortOrder }
-            .first?
-            .thumbnailURL
+        Thumbnail.reliableURL(
+            for: (items ?? []).sorted { $0.sortOrder < $1.sortOrder }
+                .first?
+                .thumbnailURL
+        )
     }
 
     /// Sorted items by order.
@@ -249,7 +255,7 @@ extension LocalPlaylistItem {
             publishedText: nil,
             viewCount: nil,
             likeCount: nil,
-            thumbnails: thumbnailURL.map { [Thumbnail(url: $0, quality: .medium)] } ?? [],
+            thumbnails: Thumbnail.fallbackChain(for: thumbnailURL),
             isLive: isLive,
             isUpcoming: false,
             scheduledStartTime: nil
```

**File**: `Yattee/Data/WatchEntry.swift` (modified, +1/-1)
```diff
@@ -241,7 +241,7 @@ extension WatchEntry {
             publishedText: nil,
             viewCount: nil,
             likeCount: nil,
-            thumbnails: thumbnailURL.map { [Thumbnail(url: $0, quality: .medium)] } ?? [],
+            thumbnails: Thumbnail.fallbackChain(for: thumbnailURL),
             isLive: isLive,
             isUpcoming: false,
             scheduledStartTime: nil
```

**File**: `Yattee/Models/Video.swift` (modified, +49/-0)
```diff
@@ -311,6 +311,55 @@ struct Thumbnail: Codable, Hashable, Sendable {
         self.width = width
         self.height = height
     }
+
+    /// Expands a single stored YouTube-style thumbnail URL (`/vi/<id>/<variant>.jpg`)
+    /// into a best-first fallback chain. Persistence models (playlists, watch history,
+    /// bookmarks) store only the best advertised URL — usually `maxresdefault.jpg`,
+    /// which doesn't exist for many older videos and 404s. Reconstructing the
+    /// lower-quality variants lets thumbnail views fall back the same way they do
+    /// for live API results. Non-matching URLs get a single-entry chain.
+    /// Rewrites a YouTube-style thumbnail URL (`/vi/<id>/<variant>.jpg`) to the
+    /// `hqdefault.jpg` variant, which exists for effectively every video (unlike
+    /// `maxresdefault`/`sddefault`, which 404 for many older uploads). Use where a
+    /// single URL is displayed without fallback, e.g. playlist covers. Non-matching
+    /// URLs are returned unchanged.
+    static func reliableURL(for url: URL?) -> URL? {
+        guard let url else { return nil }
+        let variants = ["maxresdefault.jpg", "sddefault.jpg", "hqdefault.jpg", "mqdefault.jpg", "default.jpg"]
+        let path = url.path
+        guard path.range(of: #"/vi/[^/]+/"#, options: .regularExpression) != nil,
+              let match = variants.first(where: { path.hasSuffix($0) }),
+              var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
+            return url
+        }
+        components.path = String(path.dropLast(match.count)) + "hqdefault.jpg"
+        return components.url ?? url
+    }
+
+    static func fallbackChain(for url: URL?) -> [Thumbnail] {
+        guard let url else { return [] }
+        let variants: [(suffix: String, quality: Quality)] = [
+            ("maxresdefault.jpg", .maxres),
+            ("sddefault.jpg", .standard),
+            ("hqdefault.jpg", .high),
+            ("mqdefault.jpg", .medium),
+            ("default.jpg", .default),
+        ]
+        let path = url.path
+        guard path.range(of: #"/vi/[^/]+/"#, options: .regularExpression) != nil,
+              let current = variants.first(where: { path.hasSuffix($0.suffix) }),
+              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
+            return [Thumbnail(url: url, quality: .medium)]
+        }
+        let basePath = String(path.dropLast(current.suffix.count))
+        return variants.compactMap { variant in
+            guard variant.quality <= current.quality else { return nil }
+            var variantComponents = components
+            variantComponents.path = basePath + variant.suffix
+            guard let variantURL = variantComponents.url else { return nil }
+            return Thumbnail(url: variantURL, quality: variant.quality)
+        }
+    }
 }
 
 // MARK: - Preview Support
```

**File**: `Yattee/Services/API/PipedAPI.swift` (modified, +1/-1)
```diff
@@ -590,7 +590,7 @@ private struct PipedStreamResponse: Decodable, Sendable {
         let thumbnails: [Thumbnail] = {
             if !resolvedVideoId.isEmpty,
                let url = URL(string: "https://i.ytimg.com/vi/\(resolvedVideoId)/maxresdefault.jpg") {
-                return [Thumbnail(url: url, quality: .maxres)]
+                return Thumbnail.fallbackChain(for: url)
             }
             // Fallback to proxy URL if video ID not available
             if let proxyURL = thumbnailUrl.flatMap({ URL(string: $0) }) {
```

**File**: `Yattee/Services/Downloads/Download.swift` (modified, +1/-1)
```diff
@@ -336,7 +336,7 @@ struct Download: Identifiable, Codable, Sendable, Equatable {
             publishedText: publishedText,
             viewCount: viewCount,
             likeCount: likeCount,
-            thumbnails: resolvedThumbnailURL.map { [Thumbnail(url: $0, quality: .medium)] } ?? [],
+            thumbnails: Thumbnail.fallbackChain(for: resolvedThumbnailURL),
             isLive: false,
             isUpcoming: false,
             scheduledStartTime: nil
```

**File**: `Yattee/Services/Downloads/DownloadManager.swift` (modified, +1/-1)
```diff
@@ -960,7 +960,7 @@ final class DownloadManager: NSObject {
             publishedText: download.publishedText,
             viewCount: download.viewCount,
             likeCount: download.likeCount,
-            thumbnails: download.thumbnailURL.map { [Thumbnail(url: $0, quality: .medium)] } ?? [],
+            thumbnails: Thumbnail.fallbackChain(for: download.thumbnailURL),
             isLive: false,
             isUpcoming: false,
             scheduledStartTime: nil
```

#### Recent Merged Pull Requests:
- **PR #974** (2026-08-23): Fix no streams reported from Piped (@raycheung)
- **PR #967** (2026-08-23): Chunk stateless feed requests to support more than 500 subscriptions (@pehbehbeh)
- **PR #966** (2026-08-23): Fix description timestamp links seeking to wrong position for out-of-range values (@YuriNachos)
- **PR #965** (2026-08-23): Fix deep link timestamp parsing accepting infinity as seek position (@YuriNachos)
- **PR #964** (2026-08-23): Fix audio sample rate label dropping the kHz decimal (@YuriNachos)
- **PR #963** (2026-08-23): Fix playback rate display dropping meaningful digits (@YuriNachos)
- **PR #962** (2026-08-23): Fix www.duckduckgo.com misrouting to yt-dlp external video extraction (@YuriNachos)
- **PR #957** (2026-07-23): Fix black video, freezes, autoplay and clock on Apple TV HD (A8, 2016) (@rswilem)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
