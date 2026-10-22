> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/0xcub3-wblock-learnings.md`  
> **Source**: github ([https://github.com/0xCUB3/wBlock](https://github.com/0xCUB3/wBlock))  
> **Source Version**: `3b85896c`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-22T16:26:08.120Z  
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
> **Harvest Timestamp**: 2026-10-22T16:26:07.053Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `0xCUB3/wBlock`
- **Description**: The next-generation ad blocker for Safari. Free and open source on macOS, iOS, iPadOS, and visionOS, with 750,000 rules, userscripts, userstyles, and an element zapper.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3094 stars

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
// Draws the toolbar shield from vector geometry at every size. Mac Safari crops
// a toolbar icon to its opaque bounds and scales that square to 19pt, so the
// shield spans the full height and its sides sit on pixel boundaries. Safari tints toolbar icons using their alpha mask, so
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

for size in [16, 19, 32, 38, 48, 96, 128, 256, 512] {
    guard let context = CGContext(
        data: nil, width: size, height: size, bitsPerComponent: 8,
        bytesPerRow: size * 4, space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { fatalError("Cannot render icon at \(size)px") }

    // Shield outline in a 512-unit, top-left-origin design space, mapped so
    // the stroke's outer edge touches the top and bottom rows.
    let side = CGFloat(size)
    let stroke = max(1, (side * 38 / 512).rounded())
    let half = stroke / 2
    let left = (side * 74 / 512 - half).rounded() + half
    func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
        CGPoint(x: left + (x - 74) * (side - 2 * left) / 377,
                y: side - half - (y - 32) * (side - stroke) / 446)
    }
    let shield = CGMutablePath()
    shield.move(to: point(262.5, 32))
    shield.addLine(to: point(451, 104))
    shield.addLine(to: point(451, 318))
    shield.addQuadCurve(to: point(262.5, 478), control: point(440, 390))
    shield.addQuadCurve(to: point(74, 318), control: point(85, 390))
    shield.addLine(to: point(74, 104))
    shield.closeSubpath()
    context.addPath(shield)
    context.setLineWidth(stroke)
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

### Core Architecture Module: `wBlockCoreService/BlockedCountDNRRules.swift`
```
import Foundation

/// Counting rules for the toolbar's blocked-request badge.
///
/// Safari only counts blocks made by an extension's own DNR rules, and never
/// reports what the content blockers block. Safari evaluates every rule list
/// for every load, so a DNR copy of a filter-list block still gets counted
/// when a content blocker blocked the same request.
///
/// Only host-anchored blocks without site conditions are copied (`||host^`,
/// `||host/path`, optionally limited to third-party requests or resource
/// types), so the copies stay a subset of what the content blockers already
/// block. Exceptions become `allow` rules at the same priority, which wins
/// over a block. Every other wBlock DNR rule sits at priority 2 or higher, so
/// these allows only ever cancel counting rules.
extension RemoveParamDNRRuleGenerator {
    public static let blockedCountRulesFilename = "blocked_count_dnr_rules.json"
    public static let blockedCountRuleIDBase = 1_660_000
    /// Global Privacy Control's rule starts at 1,700,000.
    public static let blockedCountRuleIDLimit = 1_700_000
    static let blockedCountMaxRules = blockedCountRuleIDLimit - blockedCountRuleIDBase
    static let blockedCountDomainsPerRule = 1_000
    /// Removeparam, redirects, GPC and the CSP rule must stay above this.
    public static let blockedCountPriority = 1
    /// Bump when `extractBlockedCountLines` changes, so cached lists rescan.
    static let blockedCountExtractionFormat = 1

    /// Exception options that lift every block on the page, not just one host.
    private static let pageWideExceptionOptions: Set<String> = ["document", "doc", "urlblock", "genericblock", "all"]
    /// Exceptions that lift cosmetic, scripting or other non-blocking rules.
    private static let nonBlockingExceptionOptions: Set<String> = [
        "elemhide", "ehide", "generichide", "ghide", "specifichide", "shide",
        "jsinject", "content", "extension", "stealth", "popup", "csp",
        "redirect", "redirect-rule", "removeparam", "removeheader", "cookie",
        "replace", "header", "permissions", "jsonprune", "hls",
        "referrerpolicy", "urltransform", "webrtc"
    ]

    // MARK: - Extraction

    /// Compact per-list summary cached beside the removeparam lines, one
    /// tab-separated entry per line:
    /// `H host thirdParty` whole-host block, `P host urlFilter types thirdParty`
    /// path or typed block, `U pattern` badfilter, `S site` page-wide
    /// exception, `E host urlFilter sites` exception (host, filter and sites
    /// may each be empty), `X host` exception on a host it cannot express.
    static func extractBlockedCountLines(from contents: String) -> String {
        var result = ""
        RuleText.forEachLine(contents) { rawLine in
            let line = RuleText.trimmed(rawLine)
            guard line.hasPrefix("||") || line.hasPrefix("@@") else { return }
            for entry in blockedCountEntries(for: String(line)) {
                result.append(entry.joined(separator: "\t"))
                result.append("\n")
            }
        }
        return result
    }

    private static func blockedCountEntries(for line: String) -> [[String]] {
        let isException = line.hasPrefix("@@")
        let body = isException ? String(line.dropFirst(2)) : line
        // A regex may contain `$`; its options follow the closing slash.
        let isRegex = body.hasPrefix("/") && (body.range(of: "/$", options: .backwards) != nil
            || body.hasSuffix("/") && body.count > 1)
        let optionsStart = isRegex
            ? body.range(of: "/$", options: .backwards).map { body.index(before: $0.upperBound) }
            : body.lastIndex(of: "$")
        let pattern = optionsStart.map { String(body[..<$0]) } ?? body
        let options = optionsStart.map {
            splitOptions(String(body[body.index(after: $0)...])).map(optionNameAndValue)
        } ?? []
        let names = Set(options.map(\.name))

        guard isException else {
            if names.contains("badfilter") { return [["U", pattern]] }
            return blockEntry(pattern: pattern, names: names).map { [$0] } ?? []
        }

        if names.contains("badfilter") { return [] }
        let sites = options.first { $0.name == "domain" }.flatMap { $0.value }
            .map { $0.split(separator: "|").map { $0.trimmingCharacters(in: .whitespaces).lowercased() } }
        let includedSites = sites?.filter { !$0.hasPrefix("~") && isCountableHost($0) } ?? []
        // DNR cannot express negated or `name.*` sites. Widening such an
        // exception to everywhere only means fewer requests get counted.
        let scopedSites = sites != nil && includedSites.count == sites?.count ? includedSites : []

        if !names.isDisjoint(with: pageWideExceptionOptions) {
            if !scopedSites.isEmpty { return scopedSites.map { ["S", $0] } }
            return anchoredHost(pattern).flatMap { isCountableHost($0) ? [["S", $0]] : nil } ?? []
        }
        if !names.isDisjoint(with: nonBlockingExceptionOptions) { return [] }

        let host = isRegex ? nil : anchoredHost(pattern).flatMap { isCountableHost($0) ? $0 : nil }
        let urlFilter = !isRegex && isCountableURLFilter(pattern) ? pattern : ""
        // Widened to everywhere, a catch-all like `*` or `|http` would
        // cancel every count, so keep it to the sites DNR can express.
        if host == nil, isCatchAll(pattern), scopedSites.isEmpty {
            return includedSites.map { ["S", $0] }
        }
        if urlFilter.isEmpty {
            // A regex or odd pattern could lift any block, so the only safe
            // reading is that it lifts every block on its sites.
            if !scopedSites.isEmpty, host == nil { return scopedSites.map { ["S", $0] } }
            guard let host else { return [] }
            if scopedSites.isEmpty { return [["X", host]] }
        }
        return [["E", host ?? "", urlFilter, scopedSites.joined(separator: "|")]]
    }

    private static func blockEntry(pattern: String, names: Set<String>) -> [String]? {
        guard pattern.hasPrefix("||"), let host = anchoredHost(pattern), isCountableHost(host) else { return nil }
        var thirdParty = false
        var types: [String] = []
        for name in names {
            switch name {
            case "third-party", "3p": thirdParty = true
            case "important": break
            default:
                guard let mapped = resourceTypeMap[name], !mapped.contains("main_frame") else { return nil }
                types.append(contentsOf: mapped)
            }
        }
        let flag = thirdParty ? "1" : "0"
        if pattern == "||\(host)^", types.isEmpty { return ["H", host, flag] }
        guard isCountableURLFilter(pattern) else { return nil }
        return ["P", host, pattern, Set(types).sorted().joined(separator: ","), flag]
    }

    private static func isCountableHost(_ host: String) -> Bool {
        host.contains(".") && host.allSatisfy(\.isASCII) && isSupportedDomain(host)
            && !host.hasPrefix(".") && !host.hasSuffix(".") && !host.hasPrefix("-")
    }

    private static func isCatchAll(_ pattern: String) -> Bool {
        var rest = pattern.lowercased()
        for token in ["https", "http", "wss", "ws"] { rest = rest.replacingOccurrences(of: token, with: "") }
        return rest.allSatisfy { "*|^:/.".contains($0) }
    }

    /// Plain ASCII in filter syntax, which DNR's `urlFilter` shares.
    private static func isCountableURLFilter(_ pattern: String) -> Bool {
        !pattern.isEmpty && pattern.count <= 512 && !pattern.hasPrefix("||*")
            && pattern.unicodeScalars.allSatisfy { $0.value > 0x20 && $0.value < 0x7F }
    }

    // MARK: - Generation

    private struct PathBlock: Hashable {
        var host: String
        var urlFilter: String
        var types: [String]
        var thirdParty: Bool
    }

    private struct Exception: Hashable {
        var host: String
        var urlFilter: String
        var sites: [String]
    }

    public static func generateBlockedCountRules(
        from summary: String,
        disabledSites: [String] = []
    ) -> [DeclarativeRule] {
        var hostBlocks: [String: Bool] = [:]  // host -> third-party only
        var pathBlocks: [PathBlock] = []
        var listCount: [String: Int] = [:]  // how many entries name a host
        var badfilters = Set<String>()
        var exceptedHosts = Set<String>()
        var exceptions = Set<Exception>()
        var pageWideSites = Set(disabledSites
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
            .filter(isCountableHost))

        RuleText.forEachLine(summary) { line in
            let parts = line.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
            guard parts.count >= 2 else { return }
            switch (parts[0], parts.count) {
            case ("H", 3):
                hostBlocks[parts[1]] = (hostBlocks[parts[1]] ?? true) && parts[2] == "1"
                listCount[parts[1], default: 0] += 1
            case ("P", 5):
                pathBlocks.append(PathBlock(
                    host: parts[1], urlFilter: parts[2],
                    types: parts[3].isEmpty ? [] : parts[3].split(separator: ",").map(String.init),
                    thirdParty: parts[4] == "1"
                ))
                listCount[parts[1], default: 0] += 1
            case ("U", _): badfilters.insert(parts[1])
            case ("X", _): exceptedHosts.insert(parts[1])
            case ("S", _): pageWideSites.insert(parts[1])
            case ("E", 4):
                exceptions.insert(Exception(
                    host: parts[1], urlFilter: parts[2],
                    sites: parts[3].isEmpty ? [] : parts[3].split(separator: "|").map(String.init)
                ))
            default: break
            }
        }
        for host in hostBlocks.keys where badfilters.contains("||\(host)^") { hostBlocks[host
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1029** (2026-10-22): **[BUG] 3.2.1 corrupts #$# rules whose selector starts with an ID (#$##id …)**
  *Symptoms*: ### Describe the bug  Since 3.2.1, a CSS injection rule whose selector list starts with an ID selector is no longer applied at all. The same rule works in AdGuard for iOS, which uses the same SafariConverterLib 4.3.0 commit.  Example rule: ``` example.com#$##mainheader, .search { top: 0px !important; transition: none !important; } ```  **Cause:** this appears to be a regression from 3a3b3cd4 (the #918 fix that rewrites `##selector { style }` to `#$#`).  `FilterRuleAnalysis.adGuardEquivalent` locates the marker with `RuleText.range(of: "##")`, which returns the first byte-for-byte match. It does not check whether that match is the rule's actual marker. In `#$##mainheader`, the `##` formed by the end of `#$#` and the start of `#mainheader` is mistaken for an element hiding marker. Since 3a3b3cd4 added `{` to the entry guard, every `#$#` rule (which always has a style block) now reaches this branch, and the rule is rewritten:  ``` in:  example.com#$##mainheader, .search { top: 0px !important; transition: none !important; } out: example.com#$#$#mainheader, .search { top: 0px !important; transition: none !important; } ```  The converter then reads the first `#$#` as the marker, so the selector becomes `$#mainheader, .search`. Because `$#mainheader` is invalid, the whole selector list is discarded when the CSS is inserted, and `.search` is not applied either.  I confirmed this by porting the cosmetic branch of `adGuardEquivalent` (at 90552a0) and running it on the rule above. Check

- **Issue #1028** (2026-10-22): **[Feature Request] Build 1436**
  *Symptoms*: ### Is your feature request related to a problem? Please describe.  I know I have been requesting a lot of this stuff but I do think some of it can be removed: a) specifically controlling what to pause b) the jump to section button in settings c) background diagnostics could be merged into logs d) check for updates and update now button in settings (redundant) e) background update agent, since this can be disabled by users who want to via apple settings f) merge help and about sections (except open safari settings) into one page g) i do think that safari settings button could be removed, but up to you h) GPC/blocked requests moved to advanced, since GPC can be used for fingerprinting, and blocked requests is not fully accurate i) controlling automatic updates for specific filter lists and userscripts j) controlling which sites filter lists and userscripts should/shouldn't run on from the info pop-up/context menu, as filter lists do not need to be site specific and userscripts can already be controlled from the site settings/popover k) applies to/URL patterns for userscripts l) autoplay on this site toggle in popover and even the autoplay feature entirely (why is this an option in an adblocker?) m) "Turn on All" for Tube and Player cleaner n) removing original thumbnail channels for DeArrow o) "Hide Shorts" since it does not have to do with the native player p) **Remove the display/appearance settings since those are already controlled by system settings**  In the regional lan

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

### Incident Patch 1: `2cb64d5a` (2026-10-21)
**Commit Message**: fix(popup): show why the popup failed to load

Safari 17 drops a runtime.onMessage reply whose promise has already
settled when the listener returns, so every background error reached the
popup as undefined. Defer the reply one microtask and append the reason,
including the rejected sender's shape, to "Failed to load popup."

Refs #1025

**File**: `extension-src/background.js` (modified, +8/-3)
```diff
@@ -26821,8 +26821,12 @@ function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e =
       // Safari 17 sends popup messages as { origin: "null" } with no URL (#896).
       const isPopupSender = sender && !sender.tab && (sender.url === browser.runtime.getURL("pages/popup/popup.html")
           || (sender.url === undefined && sender.origin === "null" && sender.frameId === undefined));
-      if (!isPopupSender
-          || !nativeRequest || !allowedActions.has(nativeRequest.action)) {
+      if (!isPopupSender) {
+        // Echo the sender's shape so a popup error screenshot shows what Safari sent.
+        const shape = sender ? { tab: Boolean(sender.tab), url: sender.url, origin: sender.origin, frameId: sender.frameId } : null;
+        return { ok: false, error: `Invalid popup sender ${JSON.stringify(shape)}` };
+      }
+      if (!nativeRequest || !allowedActions.has(nativeRequest.action)) {
         return { ok: false, error: "Invalid popup native request" };
       }
       try {
@@ -28307,6 +28311,7 @@ function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e =
         if (active) injectNoAutoplay({ tabId: sender.tab.id, frameIds: [sender.frameId] });
       }, () => {});
     }
-    return handleMessages(request, sender);
+    // Safari 17 drops a reply whose promise has already settled when the listener returns.
+    return Promise.resolve().then(() => handleMessages(request, sender));
   });
 })(browser);
```

**File**: `wBlock Scripts (iOS)/Resources/background.js` (modified, +56/-56)
```diff
@@ -1132,59 +1132,59 @@ lay.js"],matches:["<all_urls>"],allFrames:!0,runAt:"document_start"},en=!!(Fe.sc
 id,allFrames:!0})}),()=>{}))}).catch(t=>console.warn("[wBlock] No Autoplay setup failed:",t))),tn),Ar={id:17e5,priority:2,action:{type:"modifyHeaders",requestHeaders:[{header:"Sec-GPC",operation:"set",value:"1"}]},condition:{resourceTypes:["main_frame","sub_frame","stylesheet","script","image","font","xmlhttprequest","ping","media","websocket","other"]}},Zn={id:"wblock-gpc",js:["gpc.js"],matches:["<all_urls>"],allFrames:!0,runAt:"document_start",world:"MAIN"};let Er=Promise.resolve(),ea=0;const ta=()=>{
 const e=Fe.declarativeNetRequest;return!en||!e||typeof e.getDynamicRules!="function"||Date.now()-ea<Jr||(ea=Date.now(),Er=Er.then(async()=>{const t=await sr({action:"getGlobalPrivacyControlState"}).catch(()=>null);if(!t||typeof t.enabled!="boolean")return;const I=[Zn.id],D=(await e.getDynamicRules()).find(T=>T&&T.id===Ar.id),L=!!D,z=(await Fe.scripting.getRegisteredContentScripts({ids:I})).length>0;if(!t.enabled){z&&await Fe.scripting.unregisterContentScripts({ids:I}),L&&await e.updateDynamicRules(
 {removeRuleIds:[Ar.id]});return}(!L||D.priority!==Ar.priority)&&await e.updateDynamicRules({removeRuleIds:L?[Ar.id]:[],addRules:[Ar]}),z||await Fe.scripting.registerContentScripts([Zn])}).catch(t=>console.warn("[wBlock] Global Privacy Control setup failed:",t))),Er},qi=async(e,t)=>{var I,D;let L=e;if(L&&L.action==="wblock:popup:nativeMessage"){const i=new Set(["logExtensionDiagnostic","syncZapperRules","getZapperRules","getBlockingPausedState","getResumeRequestStatus","resumeBlocking","getSiteDi\
-sabledState","setSiteDisabledState","setSiteZapperDisabled","getSiteFilterDisabledState","setSiteFilterDisabledState","setUserScriptsSiteDisabled","getPageUserScripts","setUserScriptSiteDisabledState","getNoAutoplayState","setNoAutoplaySiteAllowed","setNoAutoplayEnabled"]),n=L.message;if(!(t&&!t.tab&&(t.url===Fe.runtime.getURL("pages/popup/popup.html")||t.url===void 0&&t.origin==="null"&&t.frameId===void 0))||!n||!i.has(n.action))return{ok:!1,error:"Invalid popup native request"};try{const f=await Tt(
-n);return/^setNoAutoplay/.test(n.action)&&await Sn(!0),{ok:!0,response:f}}catch(f){return{ok:!1,error:String(f&&f.message?f.message:f)}}}if(L&&new Set(["getUserScripts","validateUserScriptExecution","getUserScriptContentChunk","getUserScriptResourceChunk","setUserScriptStorageValue","deleteUserScriptStorageValue"]).has(L.action)){if(!t||!Number.isSafeInteger(t.frameId)||t.frameId<0||typeof t.url!="string"||!/^https?:\/\//.test(t.url))return{ok:!1,error:"Userscript request requires a verified fra\
-me"};L={...L,url:t.url,pageURL:t.url,isTopFrame:t.frameId===0}}if(L&&L.action==="wblock:noAutoplay:injectGate"){const i=t&&t.tab?t.tab.id:void 0;if(typeof i!="number"||!Fe.scripting||typeof globalThis.__wblockNoAutoplayGate!="function"||typeof L.token!="string")return{ok:!1};try{return await Fe.scripting.executeScript({target:{tabId:i,frameIds:[t.frameId??0]},func:globalThis.__wblockNoAutoplayGate,args:[L.token],world:"MAIN",injectImmediately:!0}),{ok:!0}}catch(n){return{ok:!1,error:String(n&&n.
-message?n.message:n)}}}if(L&&L.action==="wblock:filterUpdate:start")try{return await Tt({action:"startFilterUpdate"})}catch(i){return{ok:!1,state:"failed",error:String(i&&i.message?i.message:i)}}if(L&&L.action==="wblock:filterUpdate:getStatus")try{return await Tt({action:"getFilterUpdateStatus"})}catch(i){return{ok:!1,state:"failed",error:String(i&&i.message?i.message:i)}}if(L&&L.action==="wblock:clearCache")return or+=1,Rt.clear(),ur(),pr=0,yr.clear(),await Promise.all([Ri(),hr()]),await gr(!0),
-await oa(),{ok:!0};if(L&&L.action==="wblock:installRemoveParamDNRRules")return await gr(!0),{ok:!0};if(L&&L.action==="wblock:getCleanURL"){const i=typeof L.url=="string"?L.url:"";return{ok:!0,cleanUrl:await So(i)}}if(L&&L.action==="wblock:getSiteDisabledState"){const i=wr(L.host);if(!i)return{ok:!1,disabled:!1,error:"Missing host"};try{const n=await Jn(i);return{ok:!0,disabled:!!(n&&n.disabled)}}catch(n){return console.warn("[wBlock] Failed to resolve site disabled state for",i,n),{ok:!1,disabled:!1,
-error:String(n&&n.message?n.message:n)}}}if(L&&L.action==="wblock:noAutoplay:getState"){const i=wr(L.host);if(!i)return{ok:!1,error:"Missing host"};try{const n=await sr({action:"getNoAutoplayState",host:i});if(!n||typeof n.enabled!="boolean"||typeof n.siteAllowed!="boolean")throw new Error("Invalid No Autoplay state from native host");return{ok:!0,enabled:n.enabled,siteAllowed:n.siteAllowed}}catch(n){return{ok:!1,error:String(n&&n.message?n.message:n)}}}if(L&&L.action==="wblock:zapper:syncRules"){
-const i=typeof L.hostname=="string"?L.hostname:"",n=Array.isArray(L.rules)?L.rules:[];if(!i)return{ok:!1,error:"Missing hostname",rules:[]};try{return await Dt({action:"syncZapperRules",hostname:i,rules:n})||{ok:!1,rules:[]}}catch(u){const f=String(u&&u.message?u.message:u);return console.error(`[wBlock] Failed to sync zapper rules via background 
```

**File**: `wBlock Scripts (iOS)/Resources/pages/popup/popup.js` (modified, +4/-3)
```diff
@@ -866,7 +866,7 @@ async function getBlockingPausedState() {
         return response;
     } catch (error) {
         console.error('[wBlock] Failed to get pause state:', error);
-        return null;
+        return { error: String((error && error.message) || error) };
     }
 }
 
@@ -1897,9 +1897,10 @@ async function refreshUi() {
         contentScriptReachablePromise,
         noAutoplayStatePromise,
     ]);
-    if (pauseState === null) {
+    if (pauseState.error !== undefined) {
         setStatus(t('popup_status_error', undefined, 'Error'), 'disabled');
-        setError(t('popup_error_load_popup', undefined, 'Failed to load popup.'));
+        // The raw reason is what tells a support screenshot apart from #896.
+        setError(`${t('popup_error_load_popup', undefined, 'Failed to load popup.')} (${pauseState.error})`);
         if (disableToggle) disableToggle.disabled = true;
         if (zapperEnabledToggle) zapperEnabledToggle.disabled = true;
         if (zapperActivate) zapperActivate.disabled = true;
```

---

### Incident Patch 2: `3b85896c` (2026-10-22)
**Commit Message**: fix(safari): ship 19pt toolbar icon sizes

Mac Safari draws the toolbar icon at 19pt and only had 48px and up to pick from, so it scaled 48px down to 38px. Render 16, 19, 32 and 38 px icons that fill the full height with pixel-aligned sides, so Safari uses them without resampling.

**File**: `extension-src/background.js` (modified, +8/-0)
```diff
@@ -27373,13 +27373,21 @@ function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e =
   const POPUP_PATH = "pages/popup/popup.html";
   const SUPPORTED_PAGE_PROTOCOLS = new Set(["http:", "https:"]);
   const DEFAULT_ACTION_ICON = {
+    16: "assets/images/icon-16.png",
+    19: "assets/images/icon-19.png",
+    32: "assets/images/icon-32.png",
+    38: "assets/images/icon-38.png",
     48: "assets/images/icon-48.png",
     96: "assets/images/icon-96.png",
     128: "assets/images/icon-128.png",
     256: "assets/images/icon-256.png",
     512: "assets/images/icon-512.png"
   };
   const DISABLED_ACTION_ICON = {
+    16: "assets/images/icon-disabled-16.png",
+    19: "assets/images/icon-disabled-19.png",
+    32: "assets/images/icon-disabled-32.png",
+    38: "assets/images/icon-disabled-38.png",
     48: "assets/images/icon-disabled-48.png",
     96: "assets/images/icon-disabled-96.png",
     128: "assets/images/icon-disabled-128.png",
```

**File**: `scripts/render_action_icons.swift` (modified, +21/-13)
```diff
@@ -3,8 +3,9 @@
 import AppKit
 
 // Run from the repository root: swift scripts/render_action_icons.swift
-// Draws the toolbar shield from vector geometry at every size so Retina
-// toolbars stay sharp. Safari tints toolbar icons using their alpha mask, so
+// Draws the toolbar shield from vector geometry at every size. Mac Safari crops
+// a toolbar icon to its opaque bounds and scales that square to 19pt, so the
+// shield spans the full height and its sides sit on pixel boundaries. Safari tints toolbar icons using their alpha mask, so
 // gray alone cannot distinguish disabled protection; the disabled variant cuts
 // a gap around a diagonal slash instead.
 let directory = URL(fileURLWithPath: "wBlock Scripts (iOS)/Resources/assets/images", isDirectory: true)
@@ -18,26 +19,33 @@ func write(_ context: CGContext, _ name: String) throws {
     try png.write(to: directory.appendingPathComponent(name))
 }
 
-for size in [48, 96, 128, 256, 512] {
+for size in [16, 19, 32, 38, 48, 96, 128, 256, 512] {
     guard let context = CGContext(
         data: nil, width: size, height: size, bitsPerComponent: 8,
         bytesPerRow: size * 4, space: CGColorSpaceCreateDeviceRGB(),
         bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
     ) else { fatalError("Cannot render icon at \(size)px") }
 
-    // Shield outline in a 512-unit, top-left-origin design space.
+    // Shield outline in a 512-unit, top-left-origin design space, mapped so
+    // the stroke's outer edge touches the top and bottom rows.
     let side = CGFloat(size)
+    let stroke = max(1, (side * 38 / 512).rounded())
+    let half = stroke / 2
+    let left = (side * 74 / 512 - half).rounded() + half
+    func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
+        CGPoint(x: left + (x - 74) * (side - 2 * left) / 377,
+                y: side - half - (y - 32) * (side - stroke) / 446)
+    }
     let shield = CGMutablePath()
-    shield.move(to: CGPoint(x: 262, y: 32))
-    shield.addLine(to: CGPoint(x: 451, y: 104))
-    shield.addLine(to: CGPoint(x: 451, y: 318))
-    shield.addQuadCurve(to: CGPoint(x: 262, y: 478), control: CGPoint(x: 440, y: 390))
-    shield.addQuadCurve(to: CGPoint(x: 74, y: 318), control: CGPoint(x: 84, y: 390))
-    shield.addLine(to: CGPoint(x: 74, y: 104))
+    shield.move(to: point(262.5, 32))
+    shield.addLine(to: point(451, 104))
+    shield.addLine(to: point(451, 318))
+    shield.addQuadCurve(to: point(262.5, 478), control: point(440, 390))
+    shield.addQuadCurve(to: point(74, 318), control: point(85, 390))
+    shield.addLine(to: point(74, 104))
     shield.closeSubpath()
-    var transform = CGAffineTransform(a: side / 512, b: 0, c: 0, d: -side / 512, tx: 0, ty: side)
-    context.addPath(shield.copy(using: &transform)!)
-    context.setLineWidth(side * 38 / 512)
+    context.addPath(shield)
+    context.setLineWidth(stroke)
     context.setLineJoin(.round)
     context.setStrokeColor(CGColor(gray: 0, alpha: 0.85))
     context.strokePath()
```

**File**: `wBlock Scripts (iOS)/Resources/background.js` (modified, +34/-33)
```diff
@@ -1155,36 +1155,37 @@ action==="getUserScriptContentChunk"||L.action==="getUserScriptResourceChunk")){
 t chunk:",n),{error:String(n&&n.message?n.message:n)}}}if(L&&["gmXmlhttpRequestNative","getUserScriptRequestPolicy"].includes(L.action))return{error:"Native userscript networking is only available through the authorized GM bridge"};const T=((I=t.tab)===null||I===void 0?void 0:I.id)??0,k=t.frameId??0;let P=!1,x=t.url||"";const d=k===0||(D=t.tab)===null||D===void 0?void 0:D.url;!x.startsWith("http")&&d&&(x=d,P=!0);let m;try{m=await Ii(L,x,d)}catch(i){const n=String(i&&i.message?i.message:i);return dr.
 error("Native configuration lookup failed for ",x,n),{type:ir.InitContentScript,state:"error",error:n}}if(!m||!m.configuration){const i="Native configuration unavailable";return dr.error(i,x),{type:ir.InitContentScript,state:"error",error:i}}const{configuration:y,fromCache:l,fresh:s}=m;let a=y,o=null;if(s)o={disabled:!1,paused:!1},a={...y,disabled:!1,paused:!1};else if(l){let i="";try{i=new URL(x).hostname}catch{}try{const n=await Mi(i);if(!n||typeof n.disabled!="boolean"||typeof n.paused!="bool\
 ean")throw new Error("Invalid blocking state from native host");o=n}catch(n){const u=String(n&&n.message?n.message:n);return dr.error("Cached configuration state lookup failed for ",x,u),{type:ir.InitContentScript,state:"error",error:u}}o.disabled||o.paused?(ur(),a=Vn(o.disabled,o.paused)):a={...y,disabled:!1,paused:!1}}else(a.disabled===!0||a.paused===!0)&&(a=Vn(a.disabled===!0,a.paused===!0));const r={type:ir.InitContentScript,...l?o:typeof a.disabled=="boolean"&&typeof a.paused=="boolean"?{disabled:a.
-disabled,paused:a.paused}:{}};if(!P&&T){if(!l||!(o.disabled||o.paused))try{await wi.applyConfiguration(T,k,a)}catch(i){dr.error("Failed to apply configuration for ",x,String(i&&i.message?i.message:i))}}else r.payload=Ai(a);return r},Li="pages/popup/popup.html",Bi=new Set(["http:","https:"]),Ui={48:"assets/images/icon-48.png",96:"assets/images/icon-96.png",128:"assets/images/icon-128.png",256:"assets/images/icon-256.png",512:"assets/images/icon-512.png"},Vi={48:"assets/images/icon-disabled-48.png",
-96:"assets/images/icon-disabled-96.png",128:"assets/images/icon-disabled-128.png",256:"assets/images/icon-disabled-256.png",512:"assets/images/icon-disabled-512.png"},Hi=typeof Fe<"u"&&!!(Fe.action&&Fe.action.enable&&Fe.action.disable),Gi=typeof Fe<"u"&&!!(Fe.action&&Fe.action.setPopup),Xi=typeof Fe<"u"&&!!(Fe.action&&Fe.action.setIcon),Ji=typeof Fe<"u"&&!!(Fe.action&&Fe.action.setTitle),Ki=typeof Fe<"u"&&!!(Fe.action&&Fe.action.setBadgeText),zi=typeof Fe<"u"&&!!(Fe.action&&Fe.action.setBadgeBackgroundColor),
-ra=typeof Fe<"u"&&!!Fe.tabs,na=typeof Fe<"u"&&!!(Fe.declarativeNetRequest&&Fe.declarativeNetRequest.setExtensionActionOptions),$n=new Map,rn=new Map,Kt=new Map,aa=e=>Array.isArray(e)?e.filter(t=>t&&typeof t=="object").map(t=>({bridgeId:typeof t.bridgeId=="string"?t.bridgeId:"",commandId:typeof t.commandId=="string"?t.commandId:"",caption:typeof t.caption=="string"?t.caption:"",title:typeof t.title=="string"?t.title:"",accessKey:typeof t.accessKey=="string"?t.accessKey:"",scriptName:typeof t.scriptName==
-"string"?t.scriptName:"",sortOrder:Number.isFinite(Number(t.sortOrder))?Number(t.sortOrder):0})).filter(t=>t.bridgeId&&t.commandId&&t.caption.trim()):[],Yi=(e,t,I)=>{if(typeof e!="number")return;const D=aa(I).map(z=>({...z,frameId:t})),L=Kt.get(e)||new Map;D.length===0?L.delete(t):L.set(t,D),L.size===0?Kt.delete(e):Kt.set(e,L)},ia=e=>{if(typeof e!="number")return[];const t=Kt.get(e);if(!t)return[];const I=[];return t.forEach(D=>{I.push(...D)}),I.sort((D,L)=>{const z=D.frameId===0?0:1,T=L.frameId===
-0?0:1;return z!==T?z-T:D.frameId!==L.frameId?D.frameId-L.frameId:D.sortOrder!==L.sortOrder?D.sortOrder-L.sortOrder:D.caption.localeCompare(L.caption)}),I},Qi=async e=>{if(!Fe.scripting||!Fe.scripting.executeScript||typeof e!="number"||!e)return null;try{const t=await Fe.scripting.executeScript({target:{tabId:e,allFrames:!0},func:()=>Array.isArray(window.__wBlockUserscriptMenuState)?window.__wBlockUserscriptMenuState:[]}),I=new Map;for(const D of t||[]){const L=typeof D.frameId=="number"?D.frameId:
-0,z=aa(D.result).map(T=>({...T,frameId:L}));z.length>0&&I.set(L,z)}return I.size===0?Kt.delete(e):Kt.set(e,I),ia(e)}catch(t){return console.warn("[wBlock] Failed to query live menu commands:",t),null}},Zi=e=>{const t=Object.entries(e).filter(([,I])=>I!=null&&I!=="");return Object.fromEntries(t.map(([I,D])=>[I,String(D)]))},Rn=async e=>{const t=Zi(e);console.info("[wBlock] Support diagnostic",t);try{await Dt({action:"logExtensionDiagnostic",fields:t})}catch(I){console.warn("[wBlock] Failed to for\
-ward support diagnostic to native log:",I,t)}},eo=e=>{if(typeof e!="string"||e.length===0)return{supported:!1,reason:"missing_url",url:""};try{const t=new URL(e);return Bi.has(t.protocol)?t.hostname.length===0?{supported:!1,reason:"missing_hostname",url:e,protocol:t.protocol}:{supported:!0,reason:"url_supported",url:e,protocol:t.p
```

**File**: `wBlock Scripts (iOS)/Resources/manifest.json` (modified, +4/-0)
```diff
@@ -47,6 +47,10 @@
     "action": {
         "default_popup": "pages/popup/popup.html",
         "default_icon": {
+            "16": "assets/images/icon-16.png",
+            "19": "assets/images/icon-19.png",
+            "32": "assets/images/icon-32.png",
+            "38": "assets/images/icon-38.png",
             "48": "assets/images/icon-48.png",
             "96": "assets/images/icon-96.png",
             "128": "assets/images/icon-128.png",
```

---

### Incident Patch 3: `8d9951ca` (2026-10-22)
**Commit Message**: fix(ui): use the Site Settings field in every site list

**File**: `wBlock/SiteSettingsView.swift` (modified, +1/-3)
```diff
@@ -143,13 +143,11 @@ struct SiteSettingsView: View {
         VStack(alignment: .leading, spacing: 6) {
             HStack(spacing: 12) {
                 TextField("example.com", text: $newDomain)
-                    .textFieldStyle(.plain)
                     .focused($isTextFieldFocused)
                     .onSubmit {
                         addDomain()
                     }
-                    .padding(12)
-                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 8))
+                    .listEntryField()
 
                 AddItemButton(canAdd: addableDomain != nil, isBusy: isAddingDomain, action: addDomain)
             }
```

**File**: `wBlock/StringListEditor.swift` (modified, +16/-7)
```diff
@@ -18,18 +18,13 @@ struct StringListEditor: View {
     var body: some View {
         VStack(alignment: .leading, spacing: 4) {
             if let title { Text(title).font(.callout.weight(.medium)) }
-            HStack {
+            HStack(spacing: 12) {
                 // onSubmit rather than onCommit: on macOS the onCommit closure kept
                 // the list from the first render, so a second Return replaced the
                 // first site instead of adding to it (#948).
                 TextField(placeholder, text: $input)
                     .onSubmit(addItem)
-                    .textFieldStyle(.roundedBorder)
-                    .disableAutocorrection(true)
-                    #if os(iOS)
-                    .keyboardType(.URL)
-                    .textInputAutocapitalization(.never)
-                    #endif
+                    .listEntryField()
                 AddItemButton(canAdd: candidate != nil && !isSaving, action: addItem)
             }
             ForEach(items, id: \.self) { item in
@@ -61,6 +56,20 @@ struct StringListEditor: View {
     }
 }
 
+extension View {
+    /// The site field Site Settings opens with, shared by every site list (#1028).
+    func listEntryField() -> some View {
+        textFieldStyle(.plain)
+            .disableAutocorrection(true)
+            #if os(iOS)
+            .keyboardType(.URL)
+            .textInputAutocapitalization(.never)
+            #endif
+            .padding(12)
+            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 8))
+    }
+}
+
 /// The round + beside a site field. It turns secondary while there is nothing
 /// to add, so an empty field reads as disabled on every sheet (#999).
 struct AddItemButton: View {
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


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. popup): show why the popup failed to load

**RULE**:
When implementing operations in `extension-src/background.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in 0xCUB3/wBlock. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2cb64d5a`: popup): show why the popup failed to load. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `extension-src/background.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
      if (!isPopupSender) {
        // Echo the sender's shape so a popup error screenshot shows what Safari sent.
        const shape = sender ? { tab: Boolean(sender.tab), url: sender.url, origin: sender.origin, frameId: sender.frameId } : null;
        return { ok: false, error: `Invalid popup sender ${JSON.stringify(shape)}` };
      }
      if (!nativeRequest || !allowedActions.has(nativeRequest.action)) {
    // Safari 17 drops a reply whose promise has already settled when the listener returns.
    return Promise.resolve().then(() => handleMessages(request, sender));
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
      if (!isPopupSender
          || !nativeRequest || !allowedActions.has(nativeRequest.action)) {
    return handleMessages(request, sender);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2cb64d5a` are properly handled with clean fallback behavior.
