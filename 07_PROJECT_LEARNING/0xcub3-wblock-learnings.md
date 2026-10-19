> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/0xcub3-wblock-learnings.md`  
> **Source**: github ([https://github.com/0xCUB3/wBlock](https://github.com/0xCUB3/wBlock))  
> **Source Version**: `d525614e`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T22:19:22.865Z  
> **Learning ID**: `learn-github-0xcub3-wblock`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): 0xCUB3/wBlock

> **Canonical Artifact**: `07_PROJECT_LEARNING/0xcub3-wblock-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/0xCUB3/wBlock](https://github.com/0xCUB3/wBlock))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T22:19:22.244Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `0xCUB3/wBlock`
- **Description**: The next-generation ad blocker for Safari. Free and open source on macOS, iOS, iPadOS, and visionOS, with 750,000 rules, userscripts, userstyles, and an element zapper.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3083 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/render_action_icons.swift`
```
#!/usr/bin/env swift

import AppKit

// Run from the repository root: swift scripts/render_action_icons.swift
// Draws the toolbar shield from vector geometry at every size so Retina
// toolbars stay sharp. Safari tints toolbar icons using their alpha mask, so
// gray alone cannot distinguish disabled protection; the disabled variant cuts
// a gap around a diagonal slash instead.
let directory = URL(fileURLWithPath: "wBlock Scripts (iOS)/Resources/assets/images", isDirectory: true)
let gray = CGColor(gray: 0.56, alpha: 1)

func write(_ context: CGContext, _ name: String) throws {
    guard let output = context.makeImage(),
          let png = NSBitmapImageRep(cgImage: output).representation(using: .png, properties: [:]) else {
        fatalError("Cannot encode \(name)")
    }
    try png.write(to: directory.appendingPathComponent(name))
}

for size in [48, 96, 128, 256, 512] {
    guard let context = CGContext(
        data: nil, width: size, height: size, bitsPerComponent: 8,
        bytesPerRow: size * 4, space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { fatalError("Cannot render icon at \(size)px") }

    // Shield outline in a 512-unit, top-left-origin design space.
    let side = CGFloat(size)
    let shield = CGMutablePath()
    shield.move(to: CGPoint(x: 262, y: 32))
    shield.addLine(to: CGPoint(x: 451, y: 104))
    shield.addLine(to: CGPoint(x: 451, y: 318))
    shield.addQuadCurve(to: CGPoint(x: 262, y: 478), control: CGPoint(x: 440, y: 390))
    shield.addQuadCurve(to: CGPoint(x: 74, y: 318), control: CGPoint(x: 84, y: 390))
    shield.addLine(to: CGPoint(x: 74, y: 104))
    shield.closeSubpath()
    var transform = CGAffineTransform(a: side / 512, b: 0, c: 0, d: -side / 512, tx: 0, ty: side)
    context.addPath(shield.copy(using: &transform)!)
    context.setLineWidth(side * 38 / 512)
    context.setLineJoin(.round)
    context.setStrokeColor(CGColor(gray: 0, alpha: 0.85))
    context.strokePath()
    try write(context, "icon-\(size).png")

    let bounds = CGRect(x: 0, y: 0, width: side, height: side)
    context.setBlendMode(.sourceIn)
    context.setFillColor(gray)
    context.fill(bounds)

    func strokeSlash(width: CGFloat, blendMode: CGBlendMode) {
        context.setBlendMode(blendMode)
        context.setStrokeColor(gray)
        context.setLineWidth(side * width)
        context.setLineCap(.round)
        context.move(to: CGPoint(x: side * 0.18, y: side * 0.82))
        context.addLine(to: CGPoint(x: side * 0.82, y: side * 0.18))
        context.strokePath()
    }

    strokeSlash(width: 0.19, blendMode: .clear)
    strokeSlash(width: 0.075, blendMode: .normal)
    try write(context, "icon-disabled-\(size).png")
}

```

### Core Architecture Module: `wBlock Scripts (iOS)/Resources/redirects/scorecardresearch-beacon.js`
```
(function(source, args) {
    const flag = "done";
    const uniqueIdentifier = source.uniqueId + source.name + "_" + (Array.isArray(args) ? args.join("_") : "");
    if (source.uniqueId) {
        if (Window.prototype.toString[uniqueIdentifier] === flag) {
            return;
        }
    }
    function ScoreCardResearchBeacon(source) {
        window.COMSCORE = {
            purge() {
                window._comscore = [];
            },
            beacon() {}
        };
        hit(source);
    }
    function hit(e) {
        if (e.verbose) {
            try {
                var n = console.trace.bind(console), i = "[AdGuard] ";
                "corelibs" === e.engine ? i += e.ruleText : (e.domainName && (i += `${e.domainName}`), 
                e.args ? i += `#%#//scriptlet('${e.name}', '${e.args.join("', '")}')` : i += `#%#//scriptlet('${e.name}')`), 
                n && n(i);
            } catch (e) {}
            "function" == typeof window.__debug && window.__debug(e);
        }
    }
    const updatedArgs = args ? [].concat(source).concat(args) : [ source ];
    try {
        ScoreCardResearchBeacon.apply(this, updatedArgs);
        if (source.uniqueId) {
            Object.defineProperty(Window.prototype.toString, uniqueIdentifier, {
                value: flag,
                enumerable: false,
                writable: false,
                configurable: false
            });
        }
    } catch (e) {
        console.log(e);
    }
})({
    name: "scorecardresearch-beacon",
    args: []
}, []);
```

### Core Architecture Module: `wBlock/ConcurrentLogManager.swift`
```
//
//  ConcurrentLogManager.swift
//  wBlock
//
//  Created by Alexander Skula on 5/23/25.
//

import Foundation
import wBlockCoreService

/// Log severity levels following Swift-Log best practices
public enum LogLevel: String, Codable, Comparable, CaseIterable {
    case trace   // Detailed diagnostics, not for production
    case debug   // High-value operational info
    case info    // Significant events, recoverable failures
    case warning // One-time warnings, deprecations
    case error   // Errors requiring attention

    public static func < (lhs: LogLevel, rhs: LogLevel) -> Bool {
        let order: [LogLevel] = [.trace, .debug, .info, .warning, .error]
        guard let lhsIndex = order.firstIndex(of: lhs),
              let rhsIndex = order.firstIndex(of: rhs) else {
            return false
        }
        return lhsIndex < rhsIndex
    }
}

/// Log category for better organization
public enum LogCategory: String, Codable {
    case system = "System"
    case filterUpdate = "FilterUpdate"
    case filterApply = "FilterApply"
    case userScript = "UserScript"
    case network = "Network"
    case whitelist = "Whitelist"
    case autoUpdate = "AutoUpdate"
    case startup = "Startup"
}

/// Structured log entry with metadata support
public struct LogEntry: Identifiable, Codable, Equatable {
    public let id: UUID
    public let timestamp: Date
    public let level: LogLevel
    public let category: LogCategory
    public let message: String
    public let metadata: [String: String]?
    public var count: Int // For deduplication

    public init(
        id: UUID = UUID(),
        timestamp: Date = Date(),
        level: LogLevel,
        category: LogCategory,
        message: String,
        metadata: [String: String]? = nil,
        count: Int = 1
    ) {
        self.id = id
        self.timestamp = timestamp
        self.level = level
        self.category = category
        self.message = message
        self.metadata = metadata
        self.count = count
    }

    /// Check if this entry can be deduplicated with another
    func canDeduplicate(with other: LogEntry) -> Bool {
        self.level == other.level &&
        self.category == other.category &&
        self.message == other.message &&
        self.metadata == other.metadata
    }

    /// Compact single-line format
    var compactFormat: String {
        let time = LogDateFormatters.timeFormatter.string(from: timestamp)
        let metaStr = metadata?.sorted { $0.key < $1.key }.map { "\($0.key)=\($0.value)" }.joined(separator: ", ") ?? ""
        let meta = metaStr.isEmpty ? "" : " (\(metaStr))"
        let countStr = count > 1 ? " ×\(count)" : ""
        return "\(time) [\(level.rawValue.uppercased())] \(category.rawValue): \(message)\(meta)\(countStr)"
    }

    /// Export format for txt file
    var exportFormat: String {
        let time = LogDateFormatters.exportTimeFormatter.string(from: timestamp)
        var lines = ["\(time) [\(level.rawValue.uppercased())] \(category.rawValue): \(message)"]
        if let metadata = metadata, !metadata.isEmpty {
            lines.append("  Metadata: \(metadata.sorted { $0.key < $1.key }.map { "\($0.key)=\($0.value)" }.joined(separator: ", "))")
        }
        if count > 1 {
            lines.append("  Repeated: \(count) times")
        }
        return lines.joined(separator: "\n")
    }

}

/// Concurrency-safe logger with structured logging and deduplication
public actor ConcurrentLogManager {

    private let maxLogEntries: Int = 5_000
    private let cleanupThreshold: Int = 6_000
    private let deduplicationWindow: TimeInterval = 60 // 1 minute

    private var logEntries: [LogEntry] = []
    private let iso8601Formatter = ISO8601DateFormatter()
    private let iso8601FractionalFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    public static let shared = ConcurrentLogManager()

    private init() {}

    /// Log a message with structured metadata
    public func log(
        _ level: LogLevel,
        _ category: LogCategory,
        _ message: String,
        metadata: [String: String]? = nil,
        timestamp: Date = Date(),
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        var resolvedMetadata = metadata ?? [:]
        // Warnings and errors record where they came from so a report can be
        // traced back to code without guessing. Info rows stay quiet.
        if level >= .warning, resolvedMetadata["source"] == nil {
            let fileName = file.split(separator: "/").last.map(String.init) ?? file
            resolvedMetadata["source"] = "\(fileName):\(line)"
        }
        let entry = LogEntry(
            timestamp: timestamp,
            level: level,
            category: category,
            message: message,
            metadata: resolvedMetadata.isEmpty ? nil : resolvedMetadata
        )

        // Try to deduplicate with recent entries
        if let lastEntry = logEntries.last,
           lastEntry.canDeduplicate(with: entry),
           entry.timestamp.timeIntervalSince(lastEntry.timestamp) >= 0,
           entry.timestamp.timeIntervalSince(lastEntry.timestamp) < deduplicationWindow {
            // Increment count on last entry
            logEntries[logEntries.count - 1].count += 1
        } else {
            // Add new entry
            logEntries.append(entry)

            // Cleanup if needed
            if logEntries.count > cleanupThreshold {
                logEntries.removeFirst(logEntries.count - maxLogEntries)
            }
        }

        // Print to console for debugging
        #if DEBUG
        print(entry.compactFormat)
        #endif

        schedulePersist()
    }

    public func operation(_ event: String, fields: [String: String] = [:], level: LogLevel = .info) {
        log(level, .system, LocalizedStrings.text("Operation details"),
            metadata: fields.merging(["operation": event]) { _, new in new })
    }

    public func debug(_ category: LogCategory, _ message: String, metadata: [String: String]? = nil,
                      file: String = #file, function: String = #function, line: Int = #line) {
        log(.debug, category, message, metadata: metadata, file: file, function: function, line: line)
    }

    public func info(_ category: LogCategory, _ message: String, metadata: [String: String]? = nil,
                     file: String = #file, function: String = #function, line: Int = #line) {
        log(.info, category, message, metadata: metadata, file: file, function: function, line: line)
    }

    public func warning(_ category: LogCategory, _ message: String, metadata: [String: String]? = nil,
                        file: String = #file, function: String = #function, line: Int = #line) {
        log(.warning, category, message, metadata: metadata, file: file, function: function, line: line)
    }

    public func error(_ category: LogCategory, _ message: String, metadata: [String: String]? = nil,
                      file: String = #file, function: String = #function, line: Int = #line) {
        log(.error, category, message, metadata: metadata, file: file, function: function, line: line)
    }

    /// Logs an error together with a full description of the thrown value
    /// (domain, code, underlying errors) under the `error` metadata key.
    public func error(_ category: LogCategory, _ message: String, error: Error,
                      metadata: [String: String] = [:],
                      file: String = #file, function: String = #function, line: Int = #line) {
        var merged = metadata
        merged["error"] = LogErrorDescriber.describe(error)
        log(.error, category, message, metadata: merged, file: file, function: function, line: line)
    }

    public func warning(_ category: LogCategory, _ message: String, error: Error,
                        metadata: [String: String] = [:],
                        file: String = #file, function: String = #function, line: Int = #line) {
        var merged = metadata
        merged["error"] = LogErrorDescriber.describe(error)
        log(.warning, category, message, metadata: merged, file: file, function: function, line: line)
    }

    // MARK: - Environment

    /// App and OS details that every bug report needs. Written once per launch
    /// as the first Startup entry and repeated in the export header.
    public nonisolated static var environmentDetails: [String: String] {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "?"
        let build = info?["CFBundleVersion"] as? String ?? "?"
        let os = ProcessInfo.processInfo.operatingSystemVersion
        #if os(macOS)
        let platform = "macOS"
        #else
        let platform = "iOS"
        #endif
        var details: [String: String] = [
            "app": "\(version) (\(build))",
            "os": "\(platform) \(os.majorVersion).\(os.minorVersion).\(os.patchVersion)",
            "device": deviceModelIdentifier,
            "locale": Locale.current.identifier,
        ]
        #if DEBUG
        details["configuration"] = "debug"
        #endif
        return details
    }

    private nonisolated static var deviceModelIdentifier: String {
        #if os(macOS)
        // On macOS utsname.machine is the CPU architecture; hw.model holds the Mac model.
        var size = 0
        sysctlbyname("hw.model", nil, &size, nil, 0)
        if size > 0 {
            var buffer = [CChar](repeating: 0, count: size)
            if sysctlbyname("hw.model", &buffer, &size, nil, 0) == 0 {
                let model = String(cString: buffer)
                if !model.isEmpty { return model }
            }
        }
        #endif
        var systemInfo = utsname()
        uname(&systemInfo)
        let machine = wi
```

### Core Architecture Module: `wBlockCoreService/AdGuardFilterRegistry.swift`
```
import Foundation

/// A list from AdGuard's Safari filter registry, ready to add as a custom list.
public struct AdGuardRegistryList: Identifiable, Hashable, Sendable {
    public let id: Int
    /// Its Safari-optimized download, with the registry's name, description,
    /// category, and languages.
    public let filter: FilterList
    /// Every address the list is published at: the download, its upstream
    /// source, and the registry's mirrors of the download.
    public let knownURLs: [URL]

    public func isSameList(as url: URL) -> Bool {
        knownURLs.contains { FilterListURLSupport.isSameList($0, url) }
            || FilterListURLMirror.adGuardFilterID(for: url) == id
    }
}

/// AdGuard's filter registry for Safari, so people can find lists wBlock
/// doesn't include. Fetched only when asked for, refreshed at most daily, and
/// served from the last good copy when offline.
public enum AdGuardFilterRegistry {
    public static let sourceURL = URL(string:
        "https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/platforms/extension/safari/filters.json")!
    static let refreshInterval: TimeInterval = 24 * 60 * 60

    private struct Payload: Decodable {
        struct Entry: Decodable {
            let filterId: Int
            let name: String
            let description: String?
            let groupId: Int
            let languages: [String]?
            let deprecated: Bool?
            let subscriptionUrl: URL?
            let downloadUrl: URL
        }
        let filters: [Entry]
    }

    /// Registry lists still maintained, in the registry's order.
    public static func lists(from data: Data) throws -> [AdGuardRegistryList] {
        try JSONDecoder().decode(Payload.self, from: data).filters.compactMap { entry in
            guard entry.deprecated != true, entry.downloadUrl.scheme?.lowercased() == "https" else { return nil }
            let category = category(filterID: entry.filterId, groupID: entry.groupId)
            // GitHub first, like wBlock's own lists, then AdGuard's CDN and jsDelivr.
            let url = FilterListURLMirror.fallbackURLs(for: entry.downloadUrl)
                .first { $0.host == "raw.githubusercontent.com" } ?? entry.downloadUrl
            let filter = FilterList(
                name: entry.name, url: url, category: category, isCustom: true,
                description: entry.description ?? "",
                languages: category == .foreign ? entry.languages ?? [] : [])
            var urls = [url, entry.downloadUrl] + FilterListURLMirror.fallbackURLs(for: url)
            if let source = entry.subscriptionUrl { urls.append(source) }
            return AdGuardRegistryList(id: entry.filterId, filter: filter, knownURLs: urls)
        }
    }

    /// The registry's groups mapped onto wBlock's categories. Its "Other" group
    /// mixes an allowlist and an experimental list with privacy lists.
    static func category(filterID: Int, groupID: Int) -> FilterListCategory {
        switch (filterID, groupID) {
        case (5, _): return .experimental
        case (10, _): return .allowlists
        case (_, 1): return .ads
        case (_, 2): return .privacy
        case (_, 3), (_, 4): return .annoyances
        case (_, 5): return .security
        case (_, 7): return .foreign
        default: return .custom
        }
    }

    public static var defaultCacheURL: URL? {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?
            .appendingPathComponent("adguard-safari-filter-registry.json")
    }

    public static func load(
        session: URLSession = .shared,
        cacheURL: URL? = defaultCacheURL,
        now: Date = Date()
    ) async throws -> [AdGuardRegistryList] {
        let cached = cacheURL.flatMap { try? Data(contentsOf: $0) }.flatMap { try? lists(from: $0) }
        let cacheDate = cacheURL.flatMap {
            try? FileManager.default.attributesOfItem(atPath: $0.path)[.modificationDate] as? Date
        }
        if let cached, let cacheDate, now.timeIntervalSince(cacheDate) < refreshInterval {
            return cached
        }
        var lastError: Error = URLError(.badServerResponse)
        for url in [sourceURL] + FilterListURLMirror.fallbackURLs(for: sourceURL) {
            do {
                let request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20)
                let (data, response) = try await session.data(for: request)
                guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                    throw URLError(.badServerResponse)
                }
                let fresh = try lists(from: data)
                guard !fresh.isEmpty else { throw URLError(.cannotDecodeContentData) }
                if let cacheURL { try? data.write(to: cacheURL, options: .atomic) }
                return fresh
            } catch {
                if error is CancellationError || (error as? URLError)?.code == .cancelled { throw error }
                lastError = error
            }
        }
        if let cached { return cached }
        throw lastError
    }
}

```

### Core Architecture Module: `wBlockCoreService/AsyncConcurrency.swift`
```
import Foundation

public enum CloudSyncUploadAction: Equatable {
    case startNow(String)
    case deferUntilIdle
}

public struct CloudSyncUploadCoordinator {
    private var deferredTrigger: String?

    public init() {}

    public mutating func actionForUploadRequest(
        trigger: String,
        isSyncing: Bool
    ) -> CloudSyncUploadAction {
        guard isSyncing else {
            return .startNow(trigger)
        }

        deferredTrigger = trigger
        return .deferUntilIdle
    }

    public mutating func takeDeferredTrigger() -> String? {
        defer { deferredTrigger = nil }
        return deferredTrigger
    }
}

/// Runs an async operation on each item with bounded concurrency, calling `onResult`
/// for each completed result in completion order. Platform-aware default concurrency.
public func boundedConcurrentForEach<Item: Sendable, Result: Sendable>(
    _ items: [Item],
    maxConcurrent: Int? = nil,
    operation: @Sendable @escaping (Item) async -> Result,
    onResult: (Result) async -> Void
) async {
    guard !items.isEmpty else { return }

    let limit: Int
    if let maxConcurrent {
        limit = max(1, maxConcurrent)
    } else {
        #if os(macOS)
        limit = 3
        #else
        limit = 2
        #endif
    }

    var iterator = items.makeIterator()

    await withTaskGroup(of: Result.self) { group in
        func enqueueNext() {
            guard let item = iterator.next() else { return }
            group.addTask { await operation(item) }
        }

        for _ in 0..<min(limit, items.count) {
            enqueueNext()
        }

        while let result = await group.next() {
            guard !Task.isCancelled else {
                group.cancelAll()
                break
            }
            await onResult(result)
            guard !Task.isCancelled else {
                group.cancelAll()
                break
            }
            enqueueNext()
        }
    }
}

```

### Core Architecture Module: `wBlockCoreService/AsyncDelay.swift`
```
import Foundation

public struct AsyncDelay: Sendable, Equatable, CustomStringConvertible {
    public let nanoseconds: UInt64

    public init(nanoseconds: UInt64) {
        self.nanoseconds = nanoseconds
    }

    public static func seconds(_ seconds: Int) -> AsyncDelay {
        AsyncDelay(nanoseconds: clampedNanoseconds(seconds, multiplier: 1_000_000_000))
    }

    public static func seconds(_ seconds: TimeInterval) -> AsyncDelay {
        guard seconds > 0 else { return AsyncDelay(nanoseconds: 0) }
        let nanoseconds = seconds * 1_000_000_000
        return AsyncDelay(nanoseconds: nanoseconds >= Double(UInt64.max) ? UInt64.max : UInt64(nanoseconds))
    }

    public static func milliseconds(_ milliseconds: Int) -> AsyncDelay {
        AsyncDelay(nanoseconds: clampedNanoseconds(milliseconds, multiplier: 1_000_000))
    }

    public var description: String {
        if nanoseconds.isMultiple(of: 1_000_000_000) {
            return "\(nanoseconds / 1_000_000_000)s"
        }
        if nanoseconds.isMultiple(of: 1_000_000) {
            return "\(nanoseconds / 1_000_000)ms"
        }
        return "\(nanoseconds)ns"
    }

    private static func clampedNanoseconds(_ value: Int, multiplier: UInt64) -> UInt64 {
        guard value > 0 else { return 0 }
        let unsignedValue = UInt64(value)
        guard unsignedValue <= UInt64.max / multiplier else { return UInt64.max }
        return unsignedValue * multiplier
    }
}

public enum TaskSleep {
    public static func sleep(for delay: AsyncDelay) async throws {
        try await Task.sleep(nanoseconds: delay.nanoseconds)
    }
}

```

### Core Architecture Module: `wBlockCoreService/BackgroundUpdateSchedule.swift`
```
import Foundation

public enum BackgroundUpdateSchedule {
    public static func earliestBeginDate(
        now: Date,
        intervalHours: Double,
        nextEligibleTime: Int64,
        lastCheckTime: Int64
    ) -> Date {
        let due: Date
        if nextEligibleTime > 0 {
            due = Date(timeIntervalSince1970: TimeInterval(nextEligibleTime))
        } else if lastCheckTime > 0 {
            let hours = intervalHours.isFinite && intervalHours > 0 ? intervalHours : 6
            due = Date(timeIntervalSince1970: TimeInterval(lastCheckTime) + hours * 3600)
        } else {
            due = now
        }
        // Backoff prevents immediate resubmission loops for an overdue task.
        return max(due, now.addingTimeInterval(60))
    }
}

```

### Core Architecture Module: `wBlockCoreService/BlockingPauseStore.swift`
```
//
//  BlockingPauseStore.swift
//  wBlockCoreService
//
//  Stores the global "blocking paused" flag in the shared app-group container so that
//  the host app and the FilterUpdateAgent/XPC helpers share one source of truth.
//

import Foundation
import CoreFoundation

public struct BlockingPauseComponents: OptionSet, Hashable, Sendable {
    public let rawValue: Int

    public init(rawValue: Int) {
        self.rawValue = rawValue
    }

    public static let filters = BlockingPauseComponents(rawValue: 1 << 0)
    public static let userScripts = BlockingPauseComponents(rawValue: 1 << 1)
    public static let elementZapper = BlockingPauseComponents(rawValue: 1 << 2)
    public static let all: BlockingPauseComponents = [.filters, .userScripts, .elementZapper]
}

public enum BlockingPauseStore {
    /// Legacy UserDefaults key backing the single paused flag.
    public static let key = "isBlockingPaused"
    /// App-group key storing the bitmask of independently paused components.
    public static let componentsKey = "blockingPausedComponents"
    /// Shared request key used by the extension to ask the containing app to resume.
    public static let resumeRequestKey = "blockingResumeRequested"
    public static let resumeStatusKey = "blockingResumeStatus"
    public static let resumeErrorKey = "blockingResumeError"
    public static let resumeRequestNotificationName = "skula.wBlock.blocking-resume-requested"
    private static let resumeRequestLock = NSLock()

    public enum ResumeStatus: String {
        case idle
        case pending
        case applying
        case succeeded
        case failed
    }

    /// Reads the paused components, migrating the old single Boolean to all components.
    public static func pausedComponents(
        groupIdentifier: String = GroupIdentifier.shared.value
    ) -> BlockingPauseComponents {
        guard let defaults = UserDefaults(suiteName: groupIdentifier) else { return [] }
        if let rawValue = defaults.object(forKey: componentsKey) as? NSNumber {
            return BlockingPauseComponents(rawValue: rawValue.intValue).intersection(.all)
        }

        // Existing installations only have `isBlockingPaused`; a true value means that
        // every component was paused by the old global switch.
        let migrated = defaults.bool(forKey: key) ? BlockingPauseComponents.all : []
        defaults.set(migrated.rawValue, forKey: componentsKey)
        return migrated
    }

    public static func isPaused(
        _ component: BlockingPauseComponents,
        groupIdentifier: String = GroupIdentifier.shared.value
    ) -> Bool {
        !pausedComponents(groupIdentifier: groupIdentifier).intersection(component).isEmpty
    }

    /// True when both output-producing blocking components are paused. User scripts are
    /// independent and do not make the content-blocker extensions inert.
    public static func isContentBlockingPaused(
        groupIdentifier: String = GroupIdentifier.shared.value
    ) -> Bool {
        isPaused(.filters, groupIdentifier: groupIdentifier)
            && isPaused(.elementZapper, groupIdentifier: groupIdentifier)
    }

    /// Reads the global paused state. It remains true whenever any component is paused.
    public static func isPaused(groupIdentifier: String = GroupIdentifier.shared.value) -> Bool {
        !pausedComponents(groupIdentifier: groupIdentifier).isEmpty
    }

    public static func setPausedComponents(
        _ components: BlockingPauseComponents,
        groupIdentifier: String = GroupIdentifier.shared.value
    ) {
        let normalized = components.intersection(.all)
        guard let defaults = UserDefaults(suiteName: groupIdentifier) else { return }
        defaults.set(normalized.rawValue, forKey: componentsKey)
        defaults.set(!normalized.isEmpty, forKey: key)
    }

    /// Persists the legacy global operation: pausing selects all components and resuming
    /// clears every component selection.
    public static func setPaused(
        _ paused: Bool,
        groupIdentifier: String = GroupIdentifier.shared.value
    ) {
        setPausedComponents(paused ? .all : [], groupIdentifier: groupIdentifier)
    }

    /// Allows Safari to read prepared rules during a serialized resume apply without
    /// resuming user scripts or committing the global pause toggle prematurely.
    @MainActor
    public static func withContentBlockingResumed<T>(
        groupIdentifier: String = GroupIdentifier.shared.value,
        operation: @MainActor () async throws -> T
    ) async rethrows -> T {
        let previous = pausedComponents(groupIdentifier: groupIdentifier)
        setPausedComponents(previous.subtracting([.filters, .elementZapper]), groupIdentifier: groupIdentifier)
        defer { setPausedComponents(previous, groupIdentifier: groupIdentifier) }
        return try await operation()
    }

    /// Requests that the containing app run its canonical resume/apply lifecycle.
    /// Pending and applying requests are coalesced so repeated popup taps cannot start
    /// another apply or reset the status of the request already in progress.
    @discardableResult
    public static func requestResume(groupIdentifier: String = GroupIdentifier.shared.value) -> ResumeStatus {
        guard let defaults = UserDefaults(suiteName: groupIdentifier) else { return .idle }
        resumeRequestLock.lock()
        defer { resumeRequestLock.unlock() }
        let currentStatus = ResumeStatus(
            rawValue: defaults.string(forKey: resumeStatusKey) ?? ResumeStatus.idle.rawValue
        ) ?? .idle
        if currentStatus == .pending || currentStatus == .applying {
            return currentStatus
        }

        defaults.set(true, forKey: resumeRequestKey)
        defaults.set(ResumeStatus.pending.rawValue, forKey: resumeStatusKey)
        defaults.removeObject(forKey: resumeErrorKey)
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName(rawValue: resumeRequestNotificationName as CFString),
            nil,
            nil,
            true
        )
        return .pending
    }

    /// Consumes one queued resume request. This is intentionally separate from `setPaused`:
    /// the app must clear the pause only through AppFilterManager.setBlockingPaused(false).
    public static func consumeResumeRequest(groupIdentifier: String = GroupIdentifier.shared.value) -> Bool {
        guard let defaults = UserDefaults(suiteName: groupIdentifier),
              defaults.bool(forKey: resumeRequestKey)
        else { return false }
        defaults.set(false, forKey: resumeRequestKey)
        return true
    }

    public static func setResumeApplying(groupIdentifier: String = GroupIdentifier.shared.value) {
        UserDefaults(suiteName: groupIdentifier)?.set(ResumeStatus.applying.rawValue, forKey: resumeStatusKey)
    }

    public static func setResumeSucceeded(groupIdentifier: String = GroupIdentifier.shared.value) {
        guard let defaults = UserDefaults(suiteName: groupIdentifier) else { return }
        defaults.set(ResumeStatus.succeeded.rawValue, forKey: resumeStatusKey)
        defaults.removeObject(forKey: resumeErrorKey)
    }

    public static func setResumeFailed(
        _ error: String,
        groupIdentifier: String = GroupIdentifier.shared.value
    ) {
        guard let defaults = UserDefaults(suiteName: groupIdentifier) else { return }
        defaults.set(ResumeStatus.failed.rawValue, forKey: resumeStatusKey)
        defaults.set(error, forKey: resumeErrorKey)
    }

    public static func resumeStatus(
        groupIdentifier: String = GroupIdentifier.shared.value
    ) -> (status: ResumeStatus, error: String?) {
        let defaults = UserDefaults(suiteName: groupIdentifier)
        let rawStatus = defaults?.string(forKey: resumeStatusKey) ?? ResumeStatus.idle.rawValue
        return (
            status: ResumeStatus(rawValue: rawStatus) ?? .idle,
            error: defaults?.string(forKey: resumeErrorKey)
        )
    }
}

```

### Core Architecture Module: `wBlockCoreService/BuiltInUserScripts.swift`
```
import Foundation

struct BuiltInUserScriptDefinition {
    let name: String
    let url: String
    let isEnabledByDefault: Bool
    let description: String
    let languages: [String]
    let displayRole: BuiltInUserScriptDisplayRole?
    let isBeta: Bool

    init(
        name: String,
        url: String,
        isEnabledByDefault: Bool,
        description: String = "Default userscript",
        languages: [String] = [],
        displayRole: BuiltInUserScriptDisplayRole? = nil,
        isBeta: Bool = false
    ) {
        self.name = name
        self.url = url
        self.isEnabledByDefault = isEnabledByDefault
        self.description = description
        self.languages = languages.map { $0.lowercased() }
        self.displayRole = displayRole
        self.isBeta = isBeta
    }
}

enum BuiltInUserScripts {
    static let popupBlockerName = "AdGuard Popup Blocker"
    static let popupBlockerStableURL =
        "https://userscripts.adtidy.org/release/popup-blocker/2.5/popupblocker.user.js"
    static let tinyShieldURL =
        "https://cdn.jsdelivr.net/npm/@filteringdev/tinyshield@latest/dist/tinyShield.user.js"
    static let tinyShieldDescription =
        "Lets ad blockers quickly resist Ad-Shield, which reinserts ads on matching sites after filter lists hide them."
    static let retiredYouTubeAdBlockURL =
        "https://raw.githubusercontent.com/SysAdminDoc/YoutubeAdblock/main/YoutubeAdblock.user.js"

    static let tubeCleanerURL = "https://raw.githubusercontent.com/0xCUB3/wBlock-userscripts/main/packages/tube-cleaner/dist/tube-cleaner.user.js"
    static let deArrowURL = DeArrowPreference.scriptURL
    static let deArrowDescription = "Replaces YouTube titles and thumbnails with community-submitted DeArrow alternatives."
    static let playerCleanerURL = "https://raw.githubusercontent.com/0xCUB3/wBlock-userscripts/main/packages/player-cleaner/dist/player-cleaner.user.js"
    static let darkReaderURL = DarkReaderAppearancePreference.scriptURL
    static let darkReaderDescription =
        "Dark Reader's MIT-licensed API engine for wBlock (beta; without the full site-fix database)."
    static let tubeCleanerDescription =
        "Gives YouTube Safari-native controls, chapters, SponsorBlock skipping, picture-in-picture, background playback, quality selection, and audio-only mode."
    static let playerCleanerDescription =
        "Gives custom web players native controls, auto PiP, background playback, restored subtitle and chapter tracks, Now Playing metadata, and remembered playback preferences."

    static let definitions: [BuiltInUserScriptDefinition] = [
        BuiltInUserScriptDefinition(
            name: "Tube Cleaner",
            url: tubeCleanerURL,
            isEnabledByDefault: false,
            description: tubeCleanerDescription,
            displayRole: .functionality,
            isBeta: true
        ),
        BuiltInUserScriptDefinition(
            name: "DeArrow",
            url: deArrowURL,
            isEnabledByDefault: false,
            description: deArrowDescription,
            displayRole: .functionality,
            isBeta: true
        ),
        BuiltInUserScriptDefinition(
            name: "Player Cleaner",
            url: playerCleanerURL,
            isEnabledByDefault: false,
            description: playerCleanerDescription,
            displayRole: .functionality,
            isBeta: true
        ),
        BuiltInUserScriptDefinition(
            name: "Dark Reader",
            url: darkReaderURL,
            isEnabledByDefault: false,
            description: darkReaderDescription,
            displayRole: .functionality,
            isBeta: true
        ),
        BuiltInUserScriptDefinition(
            name: "Return YouTube Dislike",
            url: "https://raw.githubusercontent.com/Anarios/return-youtube-dislike/main/Extensions/UserScript/Return%20Youtube%20Dislike.user.js",
            isEnabledByDefault: false,
            displayRole: .functionality
        ),
        BuiltInUserScriptDefinition(
            name: "Bypass Paywalls Clean",
            url: "https://greasyfork.org/scripts/542351-bypass-paywalls-clean-en/code/Bypass%20Paywalls%20Clean%20(EN).user.js",
            isEnabledByDefault: false,
            languages: ["en"],
            displayRole: .functionality
        ),
        BuiltInUserScriptDefinition(
            name: "AdGuard Extra",
            url: "https://userscripts.adtidy.org/release/adguard-extra/1.0/adguard-extra.user.js",
            isEnabledByDefault: false,
            description: "AdGuard Extra blocks Twitch ads and handles complicated anti-adblock cases.",
            displayRole: .blocking
        ),
        BuiltInUserScriptDefinition(
            name: "TwitchAdSolutions (vaft)",
            url: "https://raw.githubusercontent.com/ryanbr/TwitchAdSolutions/master/vaft/vaft.user.js",
            isEnabledByDefault: false,
            description: "Blocks Twitch ads with the vaft script from TwitchAdSolutions.",
            displayRole: .blocking
        ),
        BuiltInUserScriptDefinition(
            name: "tinyShield",
            url: tinyShieldURL,
            isEnabledByDefault: true,
            description: tinyShieldDescription,
            displayRole: .blocking
        ),
        BuiltInUserScriptDefinition(
            name: popupBlockerName,
            url: popupBlockerStableURL,
            isEnabledByDefault: false,
            displayRole: .blocking
        ),
    ]

    static let protectedURLs = Set(definitions.map(\.url))
    static let displayRoleByURL = Dictionary(uniqueKeysWithValues: definitions.compactMap { definition in
        definition.displayRole.map { (definition.url, $0) }
    })
    static let isBetaByURL = Dictionary(
        uniqueKeysWithValues: definitions.filter(\.isBeta).map { ($0.url, true) }
    )
    static let languagesByURL = Dictionary(
        uniqueKeysWithValues: definitions.map { ($0.url, $0.languages) }
    )
    static let isEnabledByDefaultByURL = Dictionary(
        uniqueKeysWithValues: definitions.map { ($0.url, $0.isEnabledByDefault) }
    )

    static func definition(for url: URL?) -> BuiltInUserScriptDefinition? {
        guard let source = url?.absoluteString else { return nil }
        return definitions.first { $0.url == source }
    }

    /// Catalog keys keep curated metadata localizable; uncataloged descriptions use the header.
    @discardableResult
    static func applyDisplayMetadata(to script: inout UserScript) -> Bool {
        guard let definition = definition(for: script.url) else { return false }
        let previousName = script.name
        let previousDescription = script.description
        script.name = definition.name
        if definition.description != "Default userscript" {
            script.description = definition.description
        }
        return script.name != previousName || script.description != previousDescription
    }
}

```

### Core Architecture Module: `wBlockCoreService/CompilationScope.swift`
```
import Foundation

/// Work shared by the blockers of one Apply. It lives only as long as the
/// Apply, so idle processes keep nothing, and direct callers outside an Apply
/// compute everything themselves.
final class CompilationScope: @unchecked Sendable {
    @TaskLocal static var current: CompilationScope?

    /// Blockers compiled at once. Past freezes, watchdog kills, and Safari
    /// compiler crashes came from memory and time pressure on phones,
    /// background refreshes, and smaller Macs, so only a foreground Apply on a
    /// Mac with at least 16 GB, 8 cores, normal thermal state, and Low Power
    /// Mode off gets more.
    static func targetCapacity(interactive: Bool) -> Int {
        #if os(macOS)
        let info = ProcessInfo.processInfo
        let roomy = interactive
            && info.physicalMemory >= 16 << 30
            && info.activeProcessorCount >= 8
            && info.thermalState.rawValue <= ProcessInfo.ThermalState.fair.rawValue
            && !info.isLowPowerModeEnabled
        return roomy ? 5 : 3
        #else
        return 2
        #endif
    }

    private final class Entry {
        let lock = NSLock()
        var value: Any?
    }

    private let lock = NSLock()
    private var entries: [AnyHashable: Entry] = [:]

    /// Blockers that ask for the same key wait for the first one to finish
    /// instead of repeating its work; different keys run in parallel. Errors,
    /// including cancellation, are not cached.
    func memoized<Key: Hashable, Value>(_ key: Key, _ compute: () throws -> Value) rethrows -> Value {
        lock.lock()
        let entry = entries[key] ?? Entry()
        entries[key] = entry
        lock.unlock()

        entry.lock.lock()
        defer { entry.lock.unlock() }
        if let value = entry.value as? Value { return value }
        let value = try compute()
        entry.value = value
        return value
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1012** (2026-10-19): **[BUG]Element zapper rule fails to sync to other devices**
  *Symptoms*: ### Describe the bug  An Element zapper rule created on iPhone fails to sync to Mac.   ### To reproduce  Steps to reproduce the behavior: 1. On iPhone, use Element Zapper to create a rule on a website. 2. Go into Wblock Settings and select Sync Now.  3. On a Mac (which is logged into the same iCloud account as the iPhone, and configured with same version of Wblock, and set to sync via iCloud), open Wblock Settings > Element Zapper.   4.  The rule created on the iPhone is not synced.   ### Expected behavior  When logged into the same iCloud account, and using the same Wblock version on multiple devices all with iCloud sync enabled, the rules created with Element zapper should sync to the other devices.  ### Screenshot or video  _No response_  ### Environment  - OS: iOS 27.x, MacOS 27.x - wBlock Version: 3.1.3 - Intel or Apple Silicon (macOS only): Apple M4 Pro   ### Troubleshooting checklist  - [x] I have enabled all 5 wBlock Content Blocker extensions in Safari _(including Profiles, if applicable)_. - [x] I have enabled `wBlock Scripts` and set it to `Allow` on all websites (`Always Allow on Every Website`) in Safari settings. - [ ] I have enabled `Allow in Private Browsing` for `wBlock Scripts` and all 5 content blockers _(Safari → Settings → Extensions)_. - [x] I have opened wBlock and pressed `Apply Changes` after changing filters, userscripts, whitelist, and/or extension settings. - [x] For filtering issues, I have restarted iOS/iPadOS and/or macOS, opened wBlock, manuall

- **Issue #1010** (2026-10-19): **[BUG] Tube Cleaner background dimming**
  *Symptoms*: ### Describe the bug  There are random spots on the native player on YouTube when using Tube Cleaner that makes the video flicker between dim and normal. Also when your cursor is on top of the custom buttons (audio, quality, SponsorBlock) and their respective menus, can you keep the native player visible so the background is still dimmed?  ### To reproduce  Steps to reproduce the behavior: 1. Go to '...' 2. Click on '....' 3. Scroll down to '....' 4. See error   ### Expected behavior  _No response_  ### Screenshot or video  _No response_  ### Environment  - OS: [e.g. iOS 26.5, macOS 26.5] - wBlock Version: [e.g. 2.0.4] - Intel or Apple Silicon (macOS only): [e.g. Apple M2]   ### Troubleshooting checklist  - [ ] I have enabled all 5 wBlock Content Blocker extensions in Safari _(including Profiles, if applicable)_. - [ ] I have enabled `wBlock Scripts` and set it to `Allow` on all websites (`Always Allow on Every Website`) in Safari settings. - [ ] I have enabled `Allow in Private Browsing` for `wBlock Scripts` and all 5 content blockers _(Safari → Settings → Extensions)_. - [ ] I have opened wBlock and pressed `Apply Changes` after changing filters, userscripts, whitelist, and/or extension settings. - [ ] For filtering issues, I have restarted iOS/iPadOS and/or macOS, opened wBlock, manually checked for updates 🔄, and reopened Safari. _(Optional)_  ### Additional context  _No response_

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

### Incident Patch 1: `b92dc7d7` (2026-10-18)
**Commit Message**: fix(apply): stop applying filter edits on their own

Any edit started a 60-second timer that ran a full apply. On iOS the timer
paused while wBlock was in the background, so the apply started the moment
the user came back. Edits now wait for Apply. Only an app upgrade rebuild
and disabled-site changes from Safari still apply by themselves (#1003).

**File**: `wBlock/AppFilterManager+ApplyPipeline.swift` (modified, +0/-5)
```diff
@@ -214,11 +214,6 @@ extension AppFilterManager {
         defer {
             isApplyInFlight = false
             Task { await SharedAutoUpdateManager.shared.setForegroundApplyInProgress(false) }
-            if lastApplySucceeded
-                && hasUnappliedChanges
-                && !BlockingPauseStore.isPaused(.filters) {
-                scheduleAutoApplyDebounce()
-            }
         }
         ApplyCancellation.reset()
         let applyTask = Task {
```

**File**: `wBlock/AppFilterManager+DisabledSites.swift` (modified, +1/-2)
```diff
@@ -101,8 +101,7 @@ extension AppFilterManager {
             _ = await self.performFastDisabledSitesApply()
         }
         if !started {
-            // The active full apply will schedule one follow-up from the shared gate’s
-            // defer path. Avoid recursive polling while a long conversion is running.
+            // Retry once after the active apply instead of polling during a long conversion.
             hasUnappliedChanges = true
             lastApplySucceeded = false
             scheduleAutoApplyDebounce()
```

**File**: `wBlock/AppFilterManager.swift` (modified, +4/-6)
```diff
@@ -251,9 +251,8 @@ class AppFilterManager: ObservableObject {
 
     private func refreshHasUnappliedChanges() {
         hasUnappliedChanges = hasPendingSelectionChanges || hasPendingNonSelectionChanges
-        if hasUnappliedChanges {
-            scheduleAutoApplyDebounce()
-        } else {
+        // Edits wait for Apply (#1003). Only upgrades and disabled-site changes apply on their own.
+        if !hasUnappliedChanges {
             autoApplyTask?.cancel()
             autoApplyTask = nil
         }
@@ -728,9 +727,8 @@ class AppFilterManager: ObservableObject {
             && (hasURLMigrations || selectedDeprecatedListWasRemoved || signatureMismatch)
         if needsRebuild {
             markNonSelectionChangesPending()
-            if storedFailedUpgradeSignature() == currentSignature {
-                autoApplyTask?.cancel()
-                autoApplyTask = nil
+            if storedFailedUpgradeSignature() != currentSignature {
+                scheduleAutoApplyDebounce()
             }
         } else {
             markCurrentStateApplied()
```

---

### Incident Patch 2: `fe1d5f0b` (2026-10-17)
**Commit Message**: fix(mac): keep the tabs in the toolbar at the narrowest window

Below about 530 points AppKit moved the tab picker into the overflow menu
and bunched the other buttons against it. The window's minimum width now
follows the widest localized tab title, so the picker always fits, and a
pushed page's title gives way before the tabs do (#1000).

**File**: `wBlock/AppTabView.swift` (modified, +18/-1)
```diff
@@ -37,7 +37,7 @@ struct AppTabView<Filters: View, Userscripts: View, Settings: View>: View {
                 .tabItem { Label("Settings", systemImage: "gear") }
         }
         #if os(macOS)
-        .frame(minWidth: 480, idealWidth: 540, minHeight: 550, idealHeight: 720)
+        .frame(minWidth: MacTabWindow.minimumWidth, idealWidth: max(540, MacTabWindow.minimumWidth), minHeight: 550, idealHeight: 720)
         #endif
     }
 
@@ -69,3 +69,20 @@ struct AppTabView<Filters: View, Userscripts: View, Settings: View>: View {
     }
     #endif
 }
+
+#if os(macOS)
+enum MacTabWindow {
+    /// Narrow enough for the toolbar and no narrower. Below it AppKit moved
+    /// the tab picker into the overflow menu and packed the other buttons
+    /// against it (#1000). The picker's segments share the widest title's
+    /// width, about 1.2 times its width at the system font size, so longer
+    /// localized titles widen the window instead of hiding the tabs.
+    static let minimumWidth: CGFloat = {
+        let font = NSFont.systemFont(ofSize: NSFont.systemFontSize)
+        let widestTitle = ["Filters", "Userscripts", "Settings"]
+            .map { (String(localized: String.LocalizationValue($0)) as NSString).size(withAttributes: [.font: font]).width }
+            .max() ?? 0
+        return max(480, (290 + 3 * 1.2 * widestTitle).rounded(.up))
+    }()
+}
+#endif
```

**File**: `wBlock/LiquidGlassDesignSystem.swift` (modified, +2/-0)
```diff
@@ -799,6 +799,8 @@ extension View {
                     Text(title).font(.headline).fixedSize()
                 }
                 .sharedBackgroundVisibility(.hidden)
+                // The first thing to go in a narrow window, ahead of the tabs.
+                .toolbarVisibilityPriorityCompat(.low)
             }
         } else {
             toolbar {
```

---

### Incident Patch 3: `f5e4d30d` (2026-10-19)
**Commit Message**: fix: let update checks see a fresh userscript push

The updater kept an in-memory URL cache. GitHub serves raw files with
max-age=300, so a check soon after a push got the old .meta.js back
and reported no updates until wBlock was relaunched. Filter checks send
their own ETag/Last-Modified, so nothing needs this cache.

**File**: `wBlock/FilterListUpdater.swift` (modified, +3/-1)
```diff
@@ -80,7 +80,9 @@ final class FilterListUpdater: @unchecked Sendable {
         let config = URLSessionConfiguration.default
         config.timeoutIntervalForRequest = 15
         config.timeoutIntervalForResource = 30
-        config.urlCache = URLCache(memoryCapacity: 2 * 1024 * 1024, diskCapacity: 0, diskPath: nil)  // 2MB memory, no disk cache
+        // Update checks must see a fresh push; filters send their own validators.
+        config.urlCache = nil
+        config.requestCachePolicy = .reloadIgnoringLocalCacheData
         return URLSession(configuration: config)
     }()
 
```

#### Recent Merged Pull Requests:
- **PR #1005** (2026-10-18): Turkish localization updated (@remad0)
- **PR #983** (2026-10-14): Update Japenese translation (@so-5699)
- **PR #974** (2026-10-13): Add Persian (fa) localization (@aliafshany)
- **PR #969** (2026-10-12): Cancel initial rules analysis when the viewer closes (@ivan-magda)
- **PR #967** (2026-10-11): Respect cancellation in the iCloud upload debounce (@ivan-magda)
- **PR #965** (2026-10-11): Turkish localization updated (@remad0)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
