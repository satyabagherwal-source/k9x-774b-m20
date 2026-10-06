# Forensic Learning Record (Deep Inspection): 0xCUB3/wBlock

> **Canonical Artifact**: `07_PROJECT_LEARNING/0xcub3-wblock-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/0xCUB3/wBlock](https://github.com/0xCUB3/wBlock))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:18:40.346Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `0xCUB3/wBlock`
- **Description**: The next-generation ad blocker for Safari. Free and open source on macOS, iOS, iPadOS, and visionOS, with 750,000 rules, userscripts, userstyles, and an element zapper.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3012 stars

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

### Core Architecture Module: `scripts/render_apply_progress_previews.swift`
```
import AppKit
import SwiftUI

@main
struct ApplyProgressPreviewRenderer {
    @MainActor
    static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)

        let converting = convertingPresentation()
        let updating = updatingPresentation()
        let outDir = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("docs/media/img", isDirectory: true)

        write(
            macSheet(converting),
            size: CGSize(width: 500, height: 400),
            appearance: .aqua,
            to: outDir.appendingPathComponent("apply_progress_light.png")
        )
        write(
            macSheet(converting),
            size: CGSize(width: 500, height: 400),
            appearance: .darkAqua,
            to: outDir.appendingPathComponent("apply_progress_dark.png")
        )
        write(
            iosSheet(updating),
            size: CGSize(width: 320, height: 520),
            appearance: .aqua,
            to: outDir.appendingPathComponent("apply_progress_ios_light.png")
        )
        write(
            iosSheet(updating),
            size: CGSize(width: 320, height: 520),
            appearance: .darkAqua,
            to: outDir.appendingPathComponent("apply_progress_ios_dark.png")
        )
        print("wrote previews to \(outDir.path)")
    }

    @MainActor
    private static func convertingPresentation() -> ApplyProgressPresentation {
        let viewModel = ApplyChangesViewModel()
        viewModel.beginProgressRun()
        viewModel.updateFilterUpdatesFound(3)
        viewModel.updateScriptsUpdateResult(updated: 2, failed: 0)
        viewModel.updatePhaseCompletion(updating: true, scripts: true, reading: false)
        viewModel.updateProcessedCount(0, total: 5)
        viewModel.updatePhaseCompletion(reading: true, converting: false)
        viewModel.updateConvertingDone(2)
        viewModel.updateCurrentFilter("AdGuard Tracking Protection Filter")
        return ApplyProgressPresentation.make(from: viewModel.state)
    }

    @MainActor
    private static func updatingPresentation() -> ApplyProgressPresentation {
        let viewModel = ApplyChangesViewModel()
        viewModel.beginProgressRun()
        viewModel.updateCurrentFilter("AdGuard Tracking Protection Filter")
        viewModel.updatePhaseProgress(0.18)
        return ApplyProgressPresentation.make(from: viewModel.state)
    }

    private static func macSheet(_ presentation: ApplyProgressPresentation) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Apply Changes")
                .font(.title2.weight(.semibold))
            ApplyProgressField(presentation: presentation)
        }
        .padding(20)
        .frame(width: 500, height: 400, alignment: .topLeading)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    private static func iosSheet(_ presentation: ApplyProgressPresentation) -> some View {
        VStack(spacing: 0) {
            Capsule()
                .fill(Color.secondary.opacity(0.35))
                .frame(width: 36, height: 5)
                .padding(.top, 8)
                .padding(.bottom, 12)

            VStack(alignment: .leading, spacing: 16) {
                Text("Apply Changes")
                    .font(.title2.weight(.semibold))
                ApplyProgressField(presentation: presentation)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 20)

            Spacer(minLength: 0)
        }
        .frame(width: 320, height: 520, alignment: .top)
        .background(Color(nsColor: .underPageBackgroundColor))
    }

    private static func write<V: View>(
        _ view: V,
        size: CGSize,
        appearance: NSAppearance.Name,
        to url: URL
    ) {
        let hosting = NSHostingView(
            rootView: view.frame(width: size.width, height: size.height, alignment: .topLeading)
        )
        hosting.appearance = NSAppearance(named: appearance)
        hosting.frame = NSRect(origin: .zero, size: size)

        let window = NSWindow(
            contentRect: hosting.frame,
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        window.isReleasedWhenClosed = false
        window.appearance = NSAppearance(named: appearance)
        window.backgroundColor = .clear
        window.contentView = hosting
        window.orderFrontRegardless()
        hosting.layoutSubtreeIfNeeded()
        window.displayIfNeeded()
        RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.4))

        guard let rep = hosting.bitmapImageRepForCachingDisplay(in: hosting.bounds) else {
            fputs("FAIL: could not create bitmap for \(url.lastPathComponent)\n", stderr)
            exit(1)
        }
        hosting.cacheDisplay(in: hosting.bounds, to: rep)
        guard let data = rep.representation(using: .png, properties: [:]) else {
            fputs("FAIL: could not encode \(url.lastPathComponent)\n", stderr)
            exit(1)
        }
        do {
            try data.write(to: url)
        } catch {
            fputs("FAIL: \(error)\n", stderr)
            exit(1)
        }
        window.close()
    }
}

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

    var emoji: String {
        switch self {
        case .trace: return "🔍"
        case .debug: return "🐛"
        case .info: return "ℹ️"
        case .warning: return "⚠️"
        case .error: return "❌"
        }
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

    /// Convenience methods for each log level
    public func trace(_ category: LogCategory, _ message: String, metadata: [String: String]? = nil,
                      file: String = #file, function: String = #function, line: Int = #line) {
        log(.trace, category, message, metadata: metadata, file: file, function: function, line: line)
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

    private nonisolated static var deviceModelIdentifi
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

/// Runs an async transform with bounded concurrency and keeps only non-nil outputs.
/// Results are returned in completion order.
public func boundedConcurrentCompactMap<Item: Sendable, Output: Sendable>(
    _ items: [Item],
    maxConcurrent: Int? = nil,
    transform: @Sendable @escaping (Item) async -> Output?
) async -> [Output] {
    var outputs: [Output] = []
    await boundedConcurrentForEach(
        items,
        maxConcurrent: maxConcurrent,
        operation: transform
    ) { output in
        if let output { outputs.append(output) }
    }

    return outputs
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
    static let legacyPopupBlockerBetaURL =
        "https://userscripts.adtidy.org/beta/popup-blocker/2.5/popupblocker.user.js"
    static let tinyShieldURL =
        "https://cdn.jsdelivr.net/npm/@filteringdev/tinyshield@latest/dist/tinyShield.user.js"
    static let legacyTinyShieldGroupedURLPrefix =
        "https://cdn.jsdelivr.net/npm/@filteringdev/tinyshield@latest/dist/grouped/"
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
    static let legacyBundledURLsByCanonical: [String: String] = [
        "https://bundled.wblock.invalid/tube-cleaner.user.js": tubeCleanerURL,
        "https://bundled.wblock.invalid/player-cleaner.user.js": playerCleanerURL,
        "https://bundled.wblock.invalid/dark-reader.user.js": darkReaderURL,
    ]
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
    static let legacyProtectedURLs = Set(legacyBundledURLsByCanonical.keys)
    static let allProtectedURLs = protectedURLs.union(legacyProtectedURLs)
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
        let canonical = legacyBundledURLsByCanonical[source] ?? source
        return definitions.first { $0.url == canonical }
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

    /// Workers one large list may be parsed with. Above one only for an
    /// interactive Apply on a Mac with room to spare.
    let parseWorkers: Int

    init(parseWorkers: Int = 1) {
        self.parseWorkers = max(1, parseWorkers)
    }

    /// Blockers compiled at once and parse workers per list. Past freezes,
    /// watchdog kills, and Safari compiler crashes came from memory and time
    /// pressure on phones, background refreshes, and smaller Macs, so only a
    /// foreground Apply on a Mac with at least 16 GB, 8 cores, normal thermal
    /// state, and Low Power Mode off gets more. Everything else keeps the
    /// limits that shipped before.
    static func capacity(interactive: Bool) -> (targets: Int, parseWorkers: Int) {
        #if os(macOS)
        let info = ProcessInfo.processInfo
        let roomy = interactive
            && info.physicalMemory >= 16 << 30
            && info.activeProcessorCount >= 8
            && info.thermalState.rawValue <= ProcessInfo.ThermalState.fair.rawValue
            && !info.isLowPowerModeEnabled
        return roomy ? (5, 2) : (3, 1)
        #else
        return (2, 1)
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

### Core Architecture Module: `wBlockCoreService/ConditionalEvaluator.swift`
```
//
//  ConditionalEvaluator.swift
//  wBlockCoreService
//
//  Evaluates !#if / !#else / !#endif conditional blocks in filter list content.
//
//  Algorithm derived from AdGuard FiltersDownloader resolveConditions +
//  resolveExpression (https://github.com/AdguardTeam/FiltersDownloader).
//

import Foundation

/// Evaluates `!#if` / `!#else` / `!#endif` conditional blocks in filter list lines.
///
/// Input is a slice of filter list lines (already split by newline).
/// Output is the subset of lines that apply for the current platform.
/// Directive lines (`!#if`, `!#else`, `!#endif`) are never present in the output.
/// Nesting is supported. Malformed blocks are treated as no-ops (block excluded, orphaned
/// directives skipped silently).
///
/// The expression language supports:
/// - `||`  OR  (lowest precedence)
/// - `&&`  AND
/// - `!`   NOT (unary prefix)
/// - `(…)` Parentheses (highest precedence)
/// - Identifiers — looked up via `PlatformConstants.value(for:)`
///
/// Unknown identifiers return `false` (PREP-08). The literal tokens `true` and `false`
/// are also recognised by `PlatformConstants`.
public enum ConditionalEvaluator {

    /// Processes filter list lines and returns only the lines that should be
    /// included for the current platform.
    ///
    /// - Parameter lines: Raw filter list lines (may include `!#if` / `!#else` / `!#endif`)
    /// - Returns: Lines with conditional blocks resolved; all directive lines removed.
    ///            Non-directive lines are preserved verbatim (not trimmed or modified).
    public static func evaluate(lines: [String]) -> [String] {
        resolveConditions(lines)
    }

    // MARK: - Block processor

    private static func resolveConditions(_ lines: [String]) -> [String] {
        var result: [String] = []
        var i = 0

        while i < lines.count {
            let trimmed = lines[i].trimmingCharacters(in: .whitespacesAndNewlines)

            if trimmed == "!#if" || trimmed.hasPrefix("!#if ") {
                // Find the matching !#endif (respects nesting)
                let endIndex = findBlockEnd(
                    lines: lines,
                    seeking: "!#endif",
                    from: i + 1,
                    to: lines.count
                )

                guard endIndex != -1 else {
                    // Unmatched !#if — skip the directive, continue
                    i += 1
                    continue
                }

                // Find a same-level !#else within this block (if any)
                let elseIndex = findBlockEnd(
                    lines: lines,
                    seeking: "!#else",
                    from: i + 1,
                    to: endIndex
                )

                let conditionMet = evaluateCondition(trimmed)

                if conditionMet {
                    let trueSlice = Array(lines[(i + 1)..<(elseIndex == -1 ? endIndex : elseIndex)])
                    result += resolveConditions(trueSlice)
                } else if elseIndex != -1 {
                    let falseSlice = Array(lines[(elseIndex + 1)..<endIndex])
                    result += resolveConditions(falseSlice)
                }
                // Skip past the entire block (including the !#endif line)
                i = endIndex + 1

            } else if trimmed.hasPrefix("!#else") || trimmed.hasPrefix("!#endif") {
                // Orphaned directive — skip silently
                i += 1

            } else {
                // Non-directive line — preserve verbatim (never trim)
                result.append(lines[i])
                i += 1
            }
        }

        return result
    }

    // MARK: - Nesting finder

    /// Finds the index of a matching directive (`!#else` or `!#endif`) at the same nesting
    /// level as the `!#if` that preceded `start`. Returns `-1` if not found in `[start, end)`.
    ///
    /// Depth logic: increment on every `!#if`; decrement on every `!#endif` (regardless of
    /// what target we're seeking). Return when `depth == 0` AND line matches `target`.
    /// This correctly skips over nested `!#if...!#endif` pairs when searching for `!#else`.
    private static func findBlockEnd(
        lines: [String],
        seeking target: String,
        from start: Int,
        to end: Int
    ) -> Int {
        var depth = 0

        for i in start..<end {
            let trimmed = lines[i].trimmingCharacters(in: .whitespacesAndNewlines)

            if trimmed == "!#if" || trimmed.hasPrefix("!#if ") {
                depth += 1
            } else if trimmed.hasPrefix("!#endif") {
                if depth == 0 {
                    // This !#endif closes the block we were called from
                    if target == "!#endif" { return i }
                    // We were looking for !#else but found the closing !#endif — not found
                    return -1
                }
                depth -= 1
            } else if trimmed.hasPrefix(target) && depth == 0 {
                return i
            }
        }

        return -1 // target not found
    }

    // MARK: - Expression evaluator

    /// Strips the `!#if ` prefix and delegates to `evaluateExpression(_:)`.
    private static func evaluateCondition(_ ifLine: String) -> Bool {
        let prefix = "!#if "
        guard ifLine.hasPrefix(prefix) else { return false }
        let expression = String(ifLine.dropFirst(prefix.count))
            .trimmingCharacters(in: .whitespaces)
        guard !expression.isEmpty else { return false }
        return evaluateExpression(expression)
    }

    /// Recursively evaluates a boolean expression.
    ///
    /// Precedence (lowest to highest): `||`, `&&`, `!`, parentheses.
    /// Parentheses are resolved first by substituting the innermost group, then recursing.
    private static func evaluateExpression(_ raw: String) -> Bool {
        let expr = raw.trimmingCharacters(in: .whitespaces)
        guard !expr.isEmpty else { return false }

        // Step 1: Resolve innermost parenthesized group first (highest precedence)
        if let openIdx = expr.lastIndex(of: "("),
           let afterOpen = expr.index(openIdx, offsetBy: 1, limitedBy: expr.endIndex),
           let closeIdx = expr[afterOpen...].firstIndex(of: ")") {
            let inner = String(expr[afterOpen..<closeIdx])
            let innerResult = evaluateExpression(inner)
            let before = expr[..<openIdx]
            let after = expr[expr.index(after: closeIdx)...]
            let rebuilt = before + (innerResult ? "true" : "false") + after
            return evaluateExpression(String(rebuilt))
        }

        // Step 2: OR has lowest precedence — split on first occurrence
        if let orRange = expr.range(of: "||") {
            let left = String(expr[..<orRange.lowerBound]).trimmingCharacters(in: .whitespaces)
            let right = String(expr[orRange.upperBound...]).trimmingCharacters(in: .whitespaces)
            return evaluateExpression(left) || evaluateExpression(right)
        }

        // Step 3: AND
        if let andRange = expr.range(of: "&&") {
            let left = String(expr[..<andRange.lowerBound]).trimmingCharacters(in: .whitespaces)
            let right = String(expr[andRange.upperBound...]).trimmingCharacters(in: .whitespaces)
            return evaluateExpression(left) && evaluateExpression(right)
        }

        // Step 4: NOT — only recognised at position 0
        if expr.hasPrefix("!") {
            let operand = String(expr.dropFirst()).trimmingCharacters(in: .whitespaces)
            return !evaluateExpression(operand)
        }

        // Step 5: Base case — constant lookup (PREP-08: unknown name → false)
        return PlatformConstants.value(for: expr)
    }
}

// MARK: - Manual verification (no XCTest target in this project)
//
// The following comment block documents the expected behaviour for each Phase 2
// success criterion and the key edge cases. All assertions were manually verified
// against the implementation above.
//
// ── Success Criterion 1: Platform-specific blocks excluded ──────────────────
//
//   Input:  ["!#if adguard_app_ios", "ios-only-rule", "!#endif"]
//   Result: []     (adguard_app_ios = false → block excluded)
//
//   Input:  ["!#if adguard_app_mac", "mac-only-rule", "!#endif"]
//   Result: []     (adguard_app_mac = false → block excluded)
//
// ── Success Criterion 2: ext_ublock always excluded ─────────────────────────
//
//   Input:  ["!#if ext_ublock", "ublock-only-rule", "!#endif"]
//   Result: []     (ext_ublock = false)
//
// ── Success Criterion 3: !#else branch included when condition is false ──────
//
//   Input:  ["!#if ext_ublock", "ublock-rule", "!#else", "general-rule", "!#endif"]
//   Result: ["general-rule"]
//
//   Input:  ["!#if adguard", "adguard-rule", "!#else", "fallback-rule", "!#endif"]
//   Result: ["adguard-rule"]   (adguard = true → if-branch kept)
//
// ── Success Criterion 4: Nested blocks handled correctly ─────────────────────
//
//   Input:  ["rule-before",
//            "!#if adguard",       // true
//            "!#if ext_ublock",    // false → nested block excluded
//            "ublock-rule",
//            "!#endif",
//            "adguard-rule",
//            "!#endif",
//            "rule-after"]
//   Result: ["rule-before", "adguard-rule", "rule-after"]
//
//   Input:  ["!#if adguard",           // true
//            "!#if ext_ublock",        // false
//            "ublock-rule",
//            "!#else",
//            "not-ublock-rule",
//            "!#endif",
//            "adguard-rule",
//            "!#endif"]
//   Result: ["not-ublock-rule", "adguard-rule"]
//
// ── Boolean operators ────────────────────────────────────────────────────────
//
//   "!ext_ublock"               → true   (NOT false = true)
//   "adguard_app_ios || adguard_app_android"  → false (both false)
//   "adguard || ext_ublock"     → true   (true || false)
//   "adguard && env_safari"     → true   (true && tru
```

### Core Architecture Module: `wBlockCoreService/ContentBlockerExtensionRequestHandler.swift`
```
//
//  ContentBlockerExtensionRequestHandler.swift
//  safari-blocker
//
//  Created by Andrey Meshkov on 10/12/2024.
//

import os.log
import Foundation
import UniformTypeIdentifiers

/// Implements Safari content blocker extension logic.
/// This handler is responsible for loading content blocking rules from the
/// shared container and providing them to Safari extensions.
///
/// The rules are loaded from a shared location that is accessible by both the main app
/// and the content blocker extension. If no custom rules are found, it falls back to
/// the default blocker list included in the extension bundle.
public enum ContentBlockerExtensionRequestHandler {
    /// Convenience entry point that handles platform detection, target lookup, and fallback.
    public static func handleRequest(with context: NSExtensionContext) {
        #if os(iOS)
        let platform: Platform = .iOS
        #else
        let platform: Platform = .macOS
        #endif

        let bundleIdentifier = Bundle.main.bundleIdentifier ?? "Unknown"
        guard let targetInfo = ContentBlockerTargetManager.shared.targetInfo(forBundleIdentifier: bundleIdentifier, platform: platform) else {
            os_log(.fault, "CRITICAL: Could not find ContentBlockerTargetInfo for bundleIdentifier '%@' on platform '%@'.", bundleIdentifier, String(describing: platform))
            let inertRules = ContentBlockerService.inertContentBlockerRulesJSON
            let item = NSExtensionItem()
            item.attachments = [NSItemProvider(item: inertRules.data(using: .utf8) as NSData?, typeIdentifier: UTType.json.identifier as String)]
            context.completeRequest(returningItems: [item])
            return
        }

        handleRequest(with: context, groupIdentifier: GroupIdentifier.shared.value, rulesFilenameInAppGroup: targetInfo.rulesFilename)
    }

    private static func completeWithEmptyRules(_ context: NSExtensionContext, reason: String) {
        os_log(.info, "Loading inert content blocker rules: %@", reason)
        let inertRules = ContentBlockerService.inertContentBlockerRulesJSON
        let item = NSExtensionItem()
        item.attachments = [NSItemProvider(item: inertRules.data(using: .utf8) as NSData?, typeIdentifier: UTType.json.identifier as String)]
        context.completeRequest(returningItems: [item])
    }

    /// Handles content blocking extension request for rules.
    ///
    /// This method loads the content blocker rules JSON file from the shared container
    /// and attaches it to the extension context to be used by Safari.
    ///
    /// - Parameters:
    ///   - context: The extension context that initiated the request.
    ///   - groupIdentifier: The app group identifier used to access the shared container.
    public static func handleRequest(with context: NSExtensionContext, groupIdentifier: String, rulesFilenameInAppGroup: String) {
        os_log(.info, "ContentBlockerExtensionRequestHandler: Preparing to load rules for target file: %@", rulesFilenameInAppGroup)

        if BlockingPauseStore.isContentBlockingPaused(groupIdentifier: groupIdentifier) {
            completeWithEmptyRules(context, reason: "blocking is paused")
            return
        }

        guard let appGroupURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupIdentifier) else {
            os_log(.error, "Failed to access App Group container.")
            context.cancelRequest(withError: createError(code: 1001, message: "Failed to access App Group container."))
            return
        }

        let sharedFileURL = appGroupURL.appendingPathComponent(rulesFilenameInAppGroup)
        var rulesToLoadURL: URL?

        if FileManager.default.fileExists(atPath: sharedFileURL.path) {
            rulesToLoadURL = sharedFileURL
            os_log(.info, "Found rules in app group: %@", sharedFileURL.path)
        } else {
            os_log(.info, "Rules file %@ not found in app group. Falling back to bundled blockerList.json.", rulesFilenameInAppGroup)
            // Each extension should have its own "blockerList.json" as a fallback.
            // The name "blockerList.json" is hardcoded in many of your ContentBlockerRequestHandler.swift files already.
            if let bundledFallbackURL = Bundle.main.url(forResource: "blockerList", withExtension: "json") {
                rulesToLoadURL = bundledFallbackURL
                os_log(.info, "Using bundled fallback: %@", bundledFallbackURL.path)
            } else {
                os_log(.error, "FATAL: Bundled blockerList.json also not found for extension trying to load rules for %@.", rulesFilenameInAppGroup)
                let inertRules = ContentBlockerService.inertContentBlockerRulesJSON
                let item = NSExtensionItem()
                item.attachments = [NSItemProvider(item: inertRules.data(using: .utf8) as NSData?, typeIdentifier: UTType.json.identifier as String)]
                context.completeRequest(returningItems: [item]) { _ in
                    os_log(.info, "Finished loading inert content blocker due to missing files for originally sought: %@", rulesFilenameInAppGroup)
                }
                return
            }
        }

        guard let finalURL = rulesToLoadURL, let attachment = NSItemProvider(contentsOf: finalURL) else {
            os_log(.error, "Failed to create attachment from URL: %@", rulesToLoadURL?.path ?? "nil URL")
            let inertRules = ContentBlockerService.inertContentBlockerRulesJSON
            let item = NSExtensionItem()
            item.attachments = [NSItemProvider(item: inertRules.data(using: .utf8) as NSData?, typeIdentifier: UTType.json.identifier as String)]
            context.completeRequest(returningItems: [item]) { _ in
                os_log(.info, "Finished loading inert content blocker due to attachment failure for: %@", rulesFilenameInAppGroup)
            }
            return
        }

        let item = NSExtensionItem()
        item.attachments = [attachment]
        context.completeRequest(returningItems: [item]) { _ in
            os_log(.info, "Successfully completed request for content blocker rules from %@ (originally sought %@)", finalURL.path, rulesFilenameInAppGroup)
        }
    }

    /// Creates an NSError with the specified code and message.
    ///
    /// - Parameters:
    ///   - code: The error code.
    ///   - message: The error message.
    /// - Returns: An NSError object with the specified parameters.
    private static func createError(code: Int, message: String) -> NSError {
        return NSError(
            domain: "skula.wBlock",
            code: code,
            userInfo: [NSLocalizedDescriptionKey: message]
        )
    }
}

```

### Core Architecture Module: `wBlockCoreService/ContentBlockerMappingService.swift`
```
//
//  ContentBlockerMappingService.swift
//  wBlockCoreService
//
//  Created by Alexander Skula on 8/12/25.
//

import Foundation

/// Shared slot-mapping logic used by the app and background auto-update flows.
/// This keeps target distribution behavior identical across processes.
public enum ContentBlockerMappingService {
    /// Refreshes download-derived metadata without changing the user configuration
    /// captured at the start of an apply run.
    public static func refreshingCompilationMetadata(
        snapshot: [FilterList],
        latest: [FilterList]
    ) -> [FilterList] {
        let latestByID = Dictionary(latest.map { ($0.id, $0) }, uniquingKeysWith: { _, newer in newer })
        return snapshot.map { filter in
            guard let current = latestByID[filter.id] else { return filter }
            var refreshed = filter
            refreshed.version = current.version
            refreshed.sourceRuleCount = current.sourceRuleCount
            refreshed.rawSourceRuleCount = current.rawSourceRuleCount
            refreshed.lastUpdated = current.lastUpdated
            refreshed.etag = current.etag
            refreshed.serverLastModified = current.serverLastModified
            return refreshed
        }
    }

    /// Order in which a target's lists are fed to the converter (#645). Safari's
    /// converter keeps the first rules and drops the rest when a target overflows,
    /// so the most recently updated lists go first and stale content is what gets
    /// cut. Ties fall back to the distribution order for determinism.
    public static func orderedForCompilation(_ selectedFilters: [FilterList]) -> [FilterList] {
        orderedForDistribution(selectedFilters).enumerated()
            .sorted { lhs, rhs in
                let lhsDate = lhs.element.lastUpdated ?? .distantPast
                let rhsDate = rhs.element.lastUpdated ?? .distantPast
                if lhsDate != rhsDate { return lhsDate > rhsDate }
                return lhs.offset < rhs.offset
            }
            .map(\.element)
    }

    public static func orderedForDistribution(_ selectedFilters: [FilterList]) -> [FilterList] {
        var latestByID: [UUID: FilterList] = [:]
        var firstIDs = Set<UUID>()
        for filter in selectedFilters {
            latestByID[filter.id] = filter
            firstIDs.insert(filter.id)
        }
        let uniqueFilters = firstIDs.compactMap { latestByID[$0] }
        return uniqueFilters.sorted { lhs, rhs in
            let lhsCount = lhs.sourceRuleCount ?? 0
            let rhsCount = rhs.sourceRuleCount ?? 0
            if lhsCount != rhsCount { return lhsCount > rhsCount }
            return lhs.id.uuidString < rhs.id.uuidString
        }
    }

    /// Distributes selected filters across available content blocker targets by
    /// least-filled estimated source-rule count.
    ///
    /// - Parameters:
    ///   - selectedFilters: Filters to distribute.
    ///   - targets: Platform-specific content blocker targets.
    /// - Returns: Mapping of target -> assigned filter lists.
    public static func distribute(
        selectedFilters: [FilterList],
        across targets: [ContentBlockerTargetInfo]
    ) -> [ContentBlockerTargetInfo: [FilterList]] {
        guard !targets.isEmpty else { return [:] }

        var filtersByTarget: [ContentBlockerTargetInfo: [FilterList]] = Dictionary(
            uniqueKeysWithValues: targets.map { ($0, []) }
        )
        var estimatedSourceRulesByTarget: [ContentBlockerTargetInfo: Int] = Dictionary(
            uniqueKeysWithValues: targets.map { ($0, 0) }
        )

        let sortedFilters = orderedForDistribution(selectedFilters)

        for filter in sortedFilters {
            guard let destination = targets.min(by: {
                (estimatedSourceRulesByTarget[$0] ?? 0) < (estimatedSourceRulesByTarget[$1] ?? 0)
            }) else {
                break
            }

            filtersByTarget[destination, default: []].append(filter)
            estimatedSourceRulesByTarget[destination, default: 0] += filter.sourceRuleCount ?? 0
        }

        return filtersByTarget
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #938** (2026-10-05): **[BUG] importing updating and custom filter lists**
  *Symptoms*: ### Describe the bug  i exported my current lists i onboarded i added another filter list which failed to download i imported the one i just exported and bam my filter list is still there still trying to get downloaded  ### To reproduce  IN DESCRIPTION   ### Expected behavior  to delete that custom one bc it wasnt in exported backup  ### Screenshot or video  _No response_  ### Environment  ios 26.7.1  ### Troubleshooting checklist  - [x] I have enabled all 5 wBlock Content Blocker extensions in Safari _(including Profiles, if applicable)_. - [x] I have enabled `wBlock Scripts` and set it to `Allow` on all websites (`Always Allow on Every Website`) in Safari settings. - [x] I have enabled `Allow in Private Browsing` for `wBlock Scripts` and all 5 content blockers _(Safari → Settings → Extensions)_. - [x] I have opened wBlock and pressed `Apply Changes` after changing filters, userscripts, whitelist, and/or extension settings. - [x] For filtering issues, I have restarted iOS/iPadOS and/or macOS, opened wBlock, manually checked for updates 🔄, and reopened Safari. _(Optional)_  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the clear steps! Importing a backup kept any custom lists that weren't in it. That's why the one that failed to download stuck around. Fixed in 4809f07f, so importing now removes lists that aren't in the backup. It'll be in the next release.

- **Issue #927** (2026-10-03): **[BUG] YouTube Advertisements are not being blocked**
  *Symptoms*: ### Describe the bug  When I go on YouTube in Safari, none of the ads are blocked like they used to be.  ### To reproduce  Go to https://youtube.com/ Click on any video that you know  Wait for ads.  ### Expected behavior  Playback without ads.  ### Screenshot or video  I see this error in the log  <img width="972" height="111" alt="Image" src="https://github.com/user-attachments/assets/182863fa-20e3-436a-995b-1ab9b3778609" />   <img width="1262" height="842" alt="Image" src="https://github.com/user-attachments/assets/99b01e41-ff8b-4a2c-8441-e738e8ee6e27" />   ### Environment  - OS: macOS Sequoia Version 15.8.1 - wBlock Version:   3.1.3 (1245) - MacBook Pro 13-inch, 2018, Four Thunderbolt 3 Ports 2.7 GHz Quad-Core Intel Core i7 Intel Iris Plus Graphics 655 1536 MB 16 GB 2133 MHz LPDDR3 macOS Sequoia Version 15.8.1 Safari 27.0  ### Troubleshooting checklist  - [x] I have enabled all 5 wBlock Content Blocker extensions in Safari _(including Profiles, if applicable)_. - [x] I have enabled `wBlock Scripts` and set it to `Allow` on all websites (`Always Allow on Every Website`) in Safari settings. - [x] I have enabled `Allow in Private Browsing` for `wBlock Scripts` and all 5 content blockers _(Safari → Settings → Extensions)_. - [x] I have opened wBlock and pressed `Apply Changes` after changing filters, userscripts, whitelist, and/or extension settings. - [x] For filtering issues, I have restarted iOS/iPadOS and/or macOS, opened wBlock, manually checked for updates 🔄, and reopen
  **Post-Mortem & Fix Analysis**:
  > That log line has nothing to do with YouTube. It means a filter list failed to download and auto-update will try again sooner. Please don't use it as evidence of a blocking problem.  Nobody else is seeing YouTube ads on 3.1.3. The last time you reported this (#515), wBlock Scripts was off, because you'd disabled it in #504. Check that it's on and set to Allow for youtube.com, then update your filter lists and press Apply Changes. If ads still play after that, send a screenshot of the Filters tab. Until then I'm treating this as a setup problem. 
  > It's been on since those tickets.  <img width="837" height="574" alt="Image" src="https://github.com/user-attachments/assets/6b2b1c2d-efb1-4654-bf6c-a98433da6166" />  <img width="316" height="425" alt="Image" src="https://github.com/user-attachments/assets/43648b57-8bf2-46be-9c3b-cc945e706b5f" />  <img width="976" height="708" alt="Image" src="https://github.com/user-attachments/assets/75afda9d-6540-43a2-b997-193be0b93644" />  <img width="959" height="702" alt="Image" src="https://github.com/user-attachments/assets/f4e8c1f8-7f94-43ab-bd2d-9fb5338e1533" />  <img width="981" height="697" alt="Image" src="https://github.com/user-attachments/assets/37f75a7e-531e-417d-b24c-1d87ac36e024" />  <img width="967" height="501" alt="Image" src="https://github.com/user-attachments/assets/cf1b1c6a-07ef-4a29-916e-c23b1d893dc4" />
  > Settings look right. 3.2.0 fixes two bugs that can cause exactly this. wBlock Scripts could hand YouTube its rules too late on a slower Mac, after the player had already loaded the ad, and pages Safari preloads before they belong to a tab got no scripts at all. Update to 3.2.0 when it's out. If ads still play on it, post here with the video URL. 

- **Issue #925** (2026-10-03): **[BUG] wBlock extension fails to reload when adding exclusion rule to some filter lists**
  *Symptoms*: ### Describe the bug  wBlock extensions fail to reload when adding exclusion rule to some filter lists, but not all of them result in this issue occurring. Happens to me only when I apply an exclusion rule to the AdGuard Tracking Protection Filter.  ### To reproduce  Steps to reproduce the behavior: 1. Go to AdGuard Tracking Protection Filter → Settings 2. Add a website to exclude 3. Apply changes 4. See error “Failed to reload wBlock 1.”   ### Expected behavior  Expected behaviour is of course not to get this error. It doesn’t seem to happen when adding an exclusion to any other filter list I tried either, so perhaps it has to do with the size of the filter (+100k rules).  ### Screenshot or video  _No response_  ### Environment  - OS: iOS 27 - wBlock Version: 3.1.3   ### Troubleshooting checklist  - [x] I have enabled all 5 wBlock Content Blocker extensions in Safari _(including Profiles, if applicable)_. - [x] I have enabled `wBlock Scripts` and set it to `Allow` on all websites (`Always Allow on Every Website`) in Safari settings. - [x] I have enabled `Allow in Private Browsing` for `wBlock Scripts` and all 5 content blockers _(Safari → Settings → Extensions)_. - [x] I have opened wBlock and pressed `Apply Changes` after changing filters, userscripts, whitelist, and/or extension settings. - [x] For filtering issues, I have restarted iOS/iPadOS and/or macOS, opened wBlock, manually checked for updates 🔄, and reopened Safari. _(Optional)_  ### Additional context  _No respon
  **Post-Mortem & Fix Analysis**:
  > Thanks for narrowing it to Tracking Protection. Your guess about its size was right. Excluding a site added that site to the exception list of almost every one of its ~100k rules, and Safari's rule compiler ran out of room building that many conditional rules and was killed, so wBlock 1 failed to reload. d5566e68 compiles that list's ordinary rules first and adds a single rule that switches them off on the excluded sites. Your other lists still block there. This will be in 3.2.0.

- **Issue #924** (2026-10-03): **[BUG] Window size on settings page bug**
  *Symptoms*: ### Describe the bug  <img width="592" height="714" alt="Image" src="https://github.com/user-attachments/assets/cda2539c-a236-472d-960a-3af8e4aa5370" />  On narrowest, smallest width window size, the sides of the settings page get cut off.  ### To reproduce  Steps to reproduce the behavior: 1. Go to '...' 2. Click on '....' 3. Scroll down to '....' 4. See error   ### Expected behavior  _No response_  ### Screenshot or video  _No response_  ### Environment  - OS: [e.g. iOS 26.5, macOS 26.5] - wBlock Version: [e.g. 2.0.4] - Intel or Apple Silicon (macOS only): [e.g. Apple M2]   ### Troubleshooting checklist  - [ ] I have enabled all 5 wBlock Content Blocker extensions in Safari _(including Profiles, if applicable)_. - [ ] I have enabled `wBlock Scripts` and set it to `Allow` on all websites (`Always Allow on Every Website`) in Safari settings. - [ ] I have enabled `Allow in Private Browsing` for `wBlock Scripts` and all 5 content blockers _(Safari → Settings → Extensions)_. - [ ] I have opened wBlock and pressed `Apply Changes` after changing filters, userscripts, whitelist, and/or extension settings. - [ ] For filtering issues, I have restarted iOS/iPadOS and/or macOS, opened wBlock, manually checked for updates 🔄, and reopened Safari. _(Optional)_  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the screenshot. At the narrowest window the three summary pills on Settings were wider than the window itself, so the whole page spilled past both edges. When the full pills don't fit, the row now switches to the compact ones (bd1e623f), and everything stays inside the window. This will be in 3.2.0.

- **Issue #922** (2026-10-02): **[BUG] Rule type filters auto-close on toggle when viewing filter list**
  *Symptoms*: ### Describe the bug  When viewing rules for a custom filter list, the filter menu closes every time a category of rules is toggled on or off. As a result, filtering by a single category requires re-opening the filter menu 5 times.  ### To reproduce  Steps to reproduce the behavior: 1. Open 'Filters' tab 2. Tap on a filter list 3. Tap "View rules" 4. Wait for rules to process, then tap "View" 5. Tap a category to toggle it off   ### Expected behavior  The filter menu stays open until I tap X to close it so I can toggle multiple options.  ### Screenshot or video  https://github.com/user-attachments/assets/0a37c4f6-6b46-4446-8fd8-1c4f85d4bcfd  ### Environment  - OS: iOS 26.6.1 - wBlock Version: 3.1.3   ### Troubleshooting checklist  - [x] I have enabled all 5 wBlock Content Blocker extensions in Safari _(including Profiles, if applicable)_. - [x] I have enabled `wBlock Scripts` and set it to `Allow` on all websites (`Always Allow on Every Website`) in Safari settings. - [x] I have enabled `Allow in Private Browsing` for `wBlock Scripts` and all 5 content blockers _(Safari → Settings → Extensions)_. - [x] I have opened wBlock and pressed `Apply Changes` after changing filters, userscripts, whitelist, and/or extension settings. - [ ] For filtering issues, I have restarted iOS/iPadOS and/or macOS, opened wBlock, manually checked for updates 🔄, and reopened Safari. _(Optional)_  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the video! On iOS, a menu closes as soon as you pick anything in it by default, and the View menu never asked for different behavior. That made sense for one-off actions, but this menu is a set of checkboxes. As of 37ca8456 it stays open while you toggle rule types, and you close it with a tap outside. This will be in 3.2.0.  On iOS 15, menus can't be kept open, so it'll still close after each toggle there.

- **Issue #919** (2026-10-02): **[BUG] Tube Cleaner: PiP stops working after swiping down into the full-screen player**
  *Symptoms*: ### Describe the bug  On mobile, you can swipe down from the video title on YouTube’s video page to enter the full-screen player. After doing so, Tube Cleaner’s PiP and Background Playback will stop working.  ### To reproduce  Steps to reproduce the behavior: 1. Go to [https://m.youtube.com/watch?v=dQw4w9WgXcQ](https://m.youtube.com/watch?v=dQw4w9WgXcQ) 2. Swipe down from the video title to enter full-screen 3. Click the PiP button 4. See error   ### Expected behavior  _No response_  ### Screenshot or video  _No response_  ### Environment  - OS: iOS 27.0.1 - wBlock Version: 3.1.3 - Tube Cleaner Version: 0.1.50   ### Troubleshooting checklist  - [x] I have enabled all 5 wBlock Content Blocker extensions in Safari _(including Profiles, if applicable)_. - [x] I have enabled `wBlock Scripts` and set it to `Allow` on all websites (`Always Allow on Every Website`) in Safari settings. - [x] I have enabled `Allow in Private Browsing` for `wBlock Scripts` and all 5 content blockers _(Safari → Settings → Extensions)_. - [x] I have opened wBlock and pressed `Apply Changes` after changing filters, userscripts, whitelist, and/or extension settings. - [ ] For filtering issues, I have restarted iOS/iPadOS and/or macOS, opened wBlock, manually checked for updates 🔄, and reopened Safari. _(Optional)_  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > One workaround for users is to disable Tube Cleaner’s Background Playback feature and use the following userscript: ``` (function() {     'use strict';      document.addEventListener('touchstart', function initOnTouch() {         let v = document.querySelector('video');         if (v) {             v.addEventListener('webkitpresentationmodechanged', (e)=>e.stopPropagation(), true);             document.removeEventListener('touchstart', initOnTouch);         }     }, true); })(); ```
  > Thanks for the clear steps, and for posting a workaround so others weren't stuck in the meantime.  The cause was in YouTube's mobile player. It listens for the video's presentation changes, and on some pages it answers every switch into picture-in-picture by telling the video to exit fullscreen. After the swipe-down player, that call pulls the video straight back out of PiP. Once PiP closed, playback was tied to the page again, so background playback stopped too. Your script worked because it hid that event from YouTube.  Tube Cleaner now ignores that exit request only while the video is in PiP. Ordinary fullscreen exits still go through, and you don't need to turn off Background Playback anymore. The fix is in 0xCUB3/wBlock-userscripts@78efa21 and ships as Tube Cleaner 0.1.51, which wBlock picks up on its next userscript update. You can remove the workaround once you have it. 

- **Issue #918** (2026-10-02): **[BUG] Filter with `:remove-attr()` breaks other filters for same site**
  *Symptoms*: ### Describe the bug  If a custom filter list contains a rule that uses `:remove-attr()`, other filters in the list that target the same site will ail to work.  ### To reproduce  1. Open wGuard 2. Add filter from URL `https://gist.githubusercontent.com/Stevoisiak/101137e2de7d71849145f2817064e09c/raw/3d8f431a3b6bdd3ef2e54964e8a02f8a8a311787/adguard-ios-remove-bug.txt`     ```     ! Title: Adguard iOS remove bug     www.reddit.com##reddit-search-small[expanded-composer-enabled]:remove-attr(expanded-composer-enabled)     www.reddit.com###answers-nav-button     ``` 3. Wait for filters to convert 4. Open `https://www.reddit.com/r/AskReddit/comments/1vzcoet/what_antagonist_from_a_video_game_is_impossible/` in Safari  ### Expected behavior  The sparkling AI button in the header is hidden by rule `www.reddit.com###answers-nav-button`  ### Screenshot or video  _No response_  ### Environment  - OS: iOS 26.6.1 - wBlock Version: 3.1.3  ### Troubleshooting checklist  - [x] I have enabled all 5 wBlock Content Blocker extensions in Safari _(including Profiles, if applicable)_. - [x] I have enabled `wBlock Scripts` and set it to `Allow` on all websites (`Always Allow on Every Website`) in Safari settings. - [x] I have enabled `Allow in Private Browsing` for `wBlock Scripts` and all 5 content blockers _(Safari → Settings → Extensions)_. - [x] I have opened wBlock and pressed `Apply Changes` after changing filters, userscripts, whitelist, and/or extension settings. - [x] For filtering issues, 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the clean repro and the upstream link, Stevo.  The converter treated `:remove-attr()` as an ordinary CSS selector and merged it into the same `css-display-none` rule as `###answers-nav-button`. Safari then rejected that combined selector, which took the sparkle-button rule down with it. wBlock now rewrites uBO `:remove-attr()` and `:remove-class()` rules into the equivalent AdGuard scriptlets before conversion, so they run through wBlock Scripts and the other hiding rules for that site stay intact. The rules viewer counts them as advanced as well.  The fix is in 574603d0 and will ship in 3.1.4. Until then, the AdGuard-syntax version of your list is still the safer pick. 
  > As a filter list creator, is there a way to work around this issue since it hasn't been fixed in AdGuard yet?  Also, is there a failsafe to prevent other potential unrecognized pseudo classes from breaking filters?
  > You can try uBO's scriptlet form instead of the pseudo-class:  ``` www.reddit.com##+js(remove-attr, expanded-composer-enabled, reddit-search-small[expanded-composer-enabled]) ```

- **Issue #915** (2026-10-02): **[BUG] Duplicate filter list message briefly shown when adding filter via URL**
  *Symptoms*: ### Describe the bug  When adding a custom filter list via a URL, wBlock briefly clears the filter name field and shows a message “A filter list with this URL already exists in wBlock” as the window slides away.  ### To reproduce  Steps to reproduce the behavior: 1. Go to Filters 2. Tap the plus sign 3. Add filter from url https://raw.githubusercontent.com/Stevoisiak/Stevos-AI-Blocklist/refs/heads/main/GenAI-Blocklist.txt 4. Tap “add”  ### Expected behavior  The warning is not shown when initially adding a filter.  ### Screenshot or video  https://github.com/user-attachments/assets/4878ea5d-6998-401d-a42f-61d9865f9a4b  ### Environment  - OS: iOS 26.6.1 - wBlock Version: 3.1.3  ### Troubleshooting checklist  - [x] I have enabled all 5 wBlock Content Blocker extensions in Safari _(including Profiles, if applicable)_. - [x] I have enabled `wBlock Scripts` and set it to `Allow` on all websites (`Always Allow on Every Website`) in Safari settings. - [x] I have enabled `Allow in Private Browsing` for `wBlock Scripts` and all 5 content blockers _(Safari → Settings → Extensions)_. - [x] I have opened wBlock and pressed `Apply Changes` after changing filters, userscripts, whitelist, and/or extension settings. - [ ] For filtering issues, I have restarted iOS/iPadOS and/or macOS, opened wBlock, manually checked for updates 🔄, and reopened Safari. _(Optional)_  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the recording! I've fixed that in 7dded38d so the name fields stay put and the warning doesn't flash. This will be in 3.1.4. 

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

### Incident Patch 1: `62968571` (2026-10-05)
**Commit Message**: fix(userscripts): label Dark Reader, Tube Cleaner, and Player Cleaner as userscripts

They were tagged Integrated, which suggested they were built into wBlock
rather than userscripts it ships (#939). Drop the special label and its
translations.

**File**: `wBlock/UserScriptManagerView.swift` (modified, +3/-20)
```diff
@@ -37,15 +37,6 @@ import UIKit
 import AppKit
 #endif
 
-private func isIntegratedUserScript(
-    _ script: UserScript,
-    isBuiltIn: Bool,
-    builtInDisplayRole: BuiltInUserScriptDisplayRole?
-) -> Bool {
-    isBuiltIn && builtInDisplayRole == .functionality
-        && (script.name == "Dark Reader" || script.name == "Tube Cleaner" || script.name == "Player Cleaner")
-}
-
 private struct UserScriptListItem: Identifiable, Hashable {
     let id: UUID
     let name: String
@@ -63,7 +54,6 @@ private struct UserScriptListItem: Identifiable, Hashable {
     var category: FilterListCategory
     var displayCategory: UserScriptDisplayCategory
     let isBuiltIn: Bool
-    let isIntegrated: Bool
     let isCustom: Bool
     let isBeta: Bool
     let isDarkReader: Bool
@@ -103,11 +93,6 @@ private struct UserScriptListItem: Identifiable, Hashable {
             isBeta: isBeta
         )
         self.isBuiltIn = isBuiltIn
-        isIntegrated = isIntegratedUserScript(
-            script,
-            isBuiltIn: isBuiltIn,
-            builtInDisplayRole: builtInDisplayRole
-        )
         isCustom = !isBuiltIn
         self.isBeta = isBeta
         self.isDarkReader = isDarkReader
@@ -773,7 +758,7 @@ struct UserScriptManagerView: View {
                 // sheet carries the full detail.
                 Text(ContentRowMetadata.summary([
                     NSLocalizedString(
-                        script.isIntegrated ? "Integrated" : (script.isUserStyle ? "Userstyle" : "Userscript"),
+                        script.isUserStyle ? "Userstyle" : "Userscript",
                         comment: "Content type"
                     ),
                     ContentRowMetadata.versionLabel(script.version),
@@ -1179,7 +1164,6 @@ struct UserScriptInfoSidebar: View {
     let isDownloaded: Bool
     let formatFileSize: (Int) -> String
     let isBuiltIn: Bool
-    let builtInDisplayRole: BuiltInUserScriptDisplayRole?
 
     var body: some View {
         VStack(alignment: .leading, spacing: 16) {
@@ -1200,7 +1184,7 @@ struct UserScriptInfoSidebar: View {
             }
             InfoMetadataList {
                 InfoMetadataRow(title: "Type", value: NSLocalizedString(
-                    script.isUserStyle ? "Userstyle" : (isIntegratedUserScript(script, isBuiltIn: isBuiltIn, builtInDisplayRole: builtInDisplayRole) ? "Integrated" : "Userscript"),
+                    script.isUserStyle ? "Userstyle" : "Userscript",
                     comment: "Content type"
                 ), valueStyle: .typeBadge)
                 InfoMetadataRow(title: "Author", value: metadata.author ?? String(localized: "Not provided"))
@@ -1262,8 +1246,7 @@ struct UserScriptInfoView: View {
                         contentLength: script.content.utf8.count,
                         isDownloaded: userScriptManager.hasDownloadedContent(for: script),
                         formatFileSize: formatFileSize,
-                        isBuiltIn: userScriptManager.isDefaultUserScript(script),
-                        builtInDisplayRole: userScriptManager.builtInDisplayRole(for: script)
+                        isBuiltIn: userScriptManager.isDefaultUserScript(script)
                     )
                     actionList(for: script)
                 }
```

**File**: `wBlock/ar.lproj/Localizable.strings` (modified, +0/-1)
```diff
@@ -467,7 +467,6 @@
 "Include the // ==UserScript== metadata block (or /* ==UserStyle== */ for userstyles) so wBlock can read the name and URL patterns." = "ضمّن كتلة البيانات الوصفية // ==UserScript== (أو /* ==UserStyle== */ لأنماط المستخدم) حتى يتمكن wBlock من قراءة الاسم وأنماط عناوين URL.";
 "IndianList" = "IndianList";
 "Info" = "معلومات";
-"Integrated" = "مدمج";
 "Info.plist missing" = "ملف Info.plist مفقود";
 "Initialized with %d filter list(s)." = "تمت التهيئة باستخدام قائمة (قوائم) عوامل التصفية %d.";
 "International" = "دولية";
```

**File**: `wBlock/de.lproj/Localizable.strings` (modified, +0/-1)
```diff
@@ -467,7 +467,6 @@
 "Include the // ==UserScript== metadata block (or /* ==UserStyle== */ for userstyles) so wBlock can read the name and URL patterns." = "Füge den // ==UserScript==-Metadatenblock (oder /* ==UserStyle== */ für Userstyles) ein, damit wBlock den Namen und die URL-Muster lesen kann.";
 "IndianList" = "IndianList";
 "Info" = "Info";
-"Integrated" = "Integriert";
 "Info.plist missing" = "Info.plist fehlt";
 "Initialized with %d filter list(s)." = "Initialisiert mit %d-Filterliste(n).";
 "International" = "International";
```

**File**: `wBlock/el.lproj/Localizable.strings` (modified, +0/-1)
```diff
@@ -467,7 +467,6 @@
 "Include the // ==UserScript== metadata block (or /* ==UserStyle== */ for userstyles) so wBlock can read the name and URL patterns." = "Συμπεριλάβετε το μπλοκ μεταδεδομένων // ==UserScript== (ή /* ==UserStyle== */ για στύλ χρήστη), ώστε το wBlock να μπορεί να διαβάσει το όνομα και τα μοτίβα URL.";
 "IndianList" = "IndianList";
 "Info" = "Πληροφορίες";
-"Integrated" = "Ενσωματωμένο";
 "Info.plist missing" = "Λείπει το Info.plist";
 "Initialized with %d filter list(s)." = "Αρχικοποιήθηκε με λίστες φίλτρων %d.";
 "International" = "Διεθνή";
```

**File**: `wBlock/en.lproj/Localizable.strings` (modified, +0/-1)
```diff
@@ -467,7 +467,6 @@
 "Include the // ==UserScript== metadata block (or /* ==UserStyle== */ for userstyles) so wBlock can read the name and URL patterns." = "Include the // ==UserScript== metadata block (or /* ==UserStyle== */ for userstyles) so wBlock can read the name and URL patterns.";
 "IndianList" = "IndianList";
 "Info" = "Info";
-"Integrated" = "Integrated";
 "Info.plist missing" = "Info.plist missing";
 "Initialized with %d filter list(s)." = "Initialized with %d filter list(s).";
 "International" = "International";
```

**File**: `wBlock/es.lproj/Localizable.strings` (modified, +0/-1)
```diff
@@ -467,7 +467,6 @@
 "Include the // ==UserScript== metadata block (or /* ==UserStyle== */ for userstyles) so wBlock can read the name and URL patterns." = "Incluye el bloque de metadatos // ==UserScript== (o /* ==UserStyle== */ para estilos de usuario) para que wBlock pueda leer el nombre y los patrones de URL.";
 "IndianList" = "IndianList";
 "Info" = "Información";
-"Integrated" = "Integrado";
 "Info.plist missing" = "Falta Info.plist";
 "Initialized with %d filter list(s)." = "Inicializado con listas de filtros %d.";
 "International" = "Internacionales";
```

**File**: `wBlock/fr.lproj/Localizable.strings` (modified, +0/-1)
```diff
@@ -467,7 +467,6 @@
 "Include the // ==UserScript== metadata block (or /* ==UserStyle== */ for userstyles) so wBlock can read the name and URL patterns." = "Incluez le bloc de métadonnées // ==UserScript== (ou /* ==UserStyle== */ pour les styles utilisateur) afin que wBlock puisse lire le nom et les modèles d’URL.";
 "IndianList" = "IndianList";
 "Info" = "Infos";
-"Integrated" = "Intégré";
 "Info.plist missing" = "Info.plist manquant";
 "Initialized with %d filter list(s)." = "Initialisé avec la ou les listes de filtres %d.";
 "International" = "Internationaux";
```

**File**: `wBlock/hu.lproj/Localizable.strings` (modified, +0/-1)
```diff
@@ -467,7 +467,6 @@
 "Include the // ==UserScript== metadata block (or /* ==UserStyle== */ for userstyles) so wBlock can read the name and URL patterns." = "Add meg a // ==UserScript== metaadatblokkot (vagy /* ==UserStyle== */ blokkot felhasználói stílusokhoz), hogy a wBlock ki tudja olvasni a nevet és az URL mintákat.";
 "IndianList" = "IndianList";
 "Info" = "Információ";
-"Integrated" = "Integrált";
 "Info.plist missing" = "Hiányzik az Info.plist";
 "Initialized with %d filter list(s)." = "%d szűrőlistával inicializálva.";
 "International" = "Nemzetközi";
```

---

### Incident Patch 2: `2e18c90b` (2026-10-05)
**Commit Message**: fix(updates): check the server before installing a list a helper staged earlier

A background helper can download a list and leave it for the app to apply.
When the app later applied it, it skipped the server check, so a newer
version published in the meantime was missed and a manual check right after
the auto-update still found updates (#879). Both update paths now fetch first
and fall back to the staged copy only when nothing newer arrives.

**File**: `wBlock/FilterListUpdater.swift` (modified, +9/-2)
```diff
@@ -325,10 +325,17 @@ final class FilterListUpdater: @unchecked Sendable {
         if let cached = await pendingDownloads.take(filter.id) {
             return await processDownloadedFilter(filter, download: cached)
         }
-        if let pending = PendingFilterUpdateRevisions.publishedRevision(filterID: filter.id.uuidString),
-           await applyPublishedPendingRevision(pending, to: filter) {
+        // A helper's staged copy may already be stale; prefer the server and
+        // fall back to the staged copy only when nothing newer arrives.
+        let pending = PendingFilterUpdateRevisions.publishedRevision(filterID: filter.id.uuidString)
+        let fetched = await fetchFromServer(filter)
+        if fetched != .updated, let pending, await applyPublishedPendingRevision(pending, to: filter) {
             return .updated
         }
+        return fetched
+    }
+
+    private func fetchFromServer(_ filter: FilterList) async -> FilterFetchResult {
         do {
             let validators = loader.filterFileExists(filter)
                 ? await storedValidators(for: filter)
```

**File**: `wBlockCoreService/SharedAutoUpdateManager.swift` (modified, +24/-16)
```diff
@@ -1553,24 +1553,32 @@ public actor SharedAutoUpdateManager {
         )
     }
 
+    /// A list a helper downloaded but could not apply is still checked against
+    /// the server, so the app never installs a copy that is already stale. The
+    /// staged copy is used only when nothing newer can be fetched.
     private func fetchIfUpdated(_ filter: FilterList, containerURL: URL) async -> FilterFetchOutcome {
+        let pending = PendingFilterUpdateRevisions.publishedRevision(filterID: filter.id.uuidString)
+        let fetched = await fetchFromServer(filter, containerURL: containerURL)
+        if case .updated = fetched { return fetched }
+        guard let pending else { return fetched }
+        var updated = filter
+        if let data = localDataForComparison(filter: filter, containerURL: containerURL) {
+            updated.sourceRuleCount = countRulesInData(data: data)
+        }
+        if let version = pending.version, !version.isEmpty {
+            updated.version = version
+        }
+        updated.lastUpdated = Date(timeIntervalSince1970: pending.downloadedAt)
+        updated.etag = pending.etag
+        updated.serverLastModified = pending.lastModified
+        return .updated(
+            filter: updated,
+            validators: (etag: pending.etag, lastModified: pending.lastModified)
+        )
+    }
+
+    private func fetchFromServer(_ filter: FilterList, containerURL: URL) async -> FilterFetchOutcome {
         let uuid = filter.id.uuidString
-        if let pending = PendingFilterUpdateRevisions.publishedRevision(filterID: uuid) {
-            var updated = filter
-            if let data = localDataForComparison(filter: filter, containerURL: containerURL) {
-                updated.sourceRuleCount = countRulesInData(data: data)
-            }
-            if let version = pending.version, !version.isEmpty {
-                updated.version = version
-            }
-            updated.lastUpdated = Date(timeIntervalSince1970: pending.downloadedAt)
-            updated.etag = pending.etag
-            updated.serverLastModified = pending.lastModified
-            return .updated(
-                filter: updated,
-                validators: (etag: pending.etag, lastModified: pending.lastModified)
-            )
-        }
         let etag = await getFilterEtag(uuid)
         let lastModified = await getFilterLastModified(uuid)
         // Attempt a uBlock-Origin-style delta/differential update first. A nil
```

---

### Incident Patch 3: `f9241f53` (2026-10-05)
**Commit Message**: fix(macos): size Settings pills to the widest one like the other tabs

Settings drew its pills in a plain HStack, so each took its own width. Longer translations like Greek made the mismatch obvious. The row now uses StatsCardsView, so every pill on a tab matches the widest one there.

**File**: `wBlock/SettingsView.swift` (modified, +1/-5)
```diff
@@ -393,7 +393,7 @@ struct SettingsView: View {
         let capacity = filterManager.safariRuleCapacityFraction
         // Relative times in the pills age while Settings stays open.
         return TimelineView(.periodic(from: .now, by: 30)) { context in
-            HStack(spacing: compact ? 8 : 12) {
+            StatsCardsView(compact: compact) {
                 Button {
                     showingRuleCapacity = true
                 } label: {
@@ -441,10 +441,6 @@ struct SettingsView: View {
                 }
             }
         }
-        #if os(iOS)
-        .fixedSize(horizontal: false, vertical: true)
-        #endif
-        .padding(.horizontal)
     }
 
     private func syncPillValue(now: Date) -> String {
```

**File**: `wBlock/StatCard.swift` (modified, +2/-2)
```diff
@@ -35,8 +35,8 @@ private extension EnvironmentValues {
     }
 }
 
-/// Both tab summaries share spacing and horizontal clearance. On macOS every
-/// card takes the widest card's natural width, but never less than the 155pt
+/// Every tab's summary row shares spacing and horizontal clearance. On macOS
+/// each card takes the widest card in its row's natural width, but never less than the 155pt
 /// every other pill uses, so short counts don't shrink a tab's pills (#921).
 struct StatsCardsView<Content: View>: View {
     var compact = false
```

---

### Incident Patch 4: `4809f07f` (2026-10-05)
**Commit Message**: fix(backup): drop custom lists the backup doesn't have when restoring

Restore merged the backup's custom lists into the current ones, so a list added after the export stayed and kept trying to download (#938).

**File**: `scripts/test_backup_restore.swift` (modified, +5/-0)
```diff
@@ -110,6 +110,7 @@ actor ConcurrentLogManager {
         return saveFilterListsResult
     }
     func markNonSelectionChangesPending() {}
+    func removeCustomFilterList(_ filter: FilterList) {}
 }
 @MainActor final class ZapperRuleManager {
     static let shared = ZapperRuleManager()
@@ -399,6 +400,10 @@ enum AppAppearance: String {
         let restored = try BackupCustomFilterRestorer.restoreWithReceipt([remoteEntry], into: [remote], localFileURL: { _ in nil }).lists
         precondition(restored.count == 1 && restored[0].id == remoteID && restored[0].name == "Restored")
         precondition(restored[0].category == .privacy && restored[0].uniqueRuleCount == nil)
+        // Custom lists added after the backup was taken don't survive restoring it (#938).
+        let added = FilterList(name: "Added later", url: URL(string: "https://example.com/added.txt")!, category: .custom, isCustom: true)
+        let replaced = try BackupCustomFilterRestorer.restoreWithReceipt([remoteEntry], into: [remote, added], localFileURL: { _ in nil }).lists
+        precondition(replaced.map(\.id) == [remoteID], "restore must drop custom lists the backup doesn't have")
 
         // A failure after the first inline publish must roll back every file and
         // leave the caller's metadata untouched because restore never returned.
```

**File**: `wBlock/BackupManager.swift` (modified, +10/-0)
```diff
@@ -396,6 +396,10 @@ enum BackupCustomFilterRestorer {
 
         var lists = existing
         var writes: [URL: Data] = [:]
+        // A restore replaces the custom set. Lists the backup can't restore stay.
+        var keptCustomIDs = Set(entries.filter(\.isUnavailable).flatMap { entry in
+            existing.filter { $0.isCustom && FilterListURLSupport.isSameList($0.url, PersistedFilterURL.resolve(entry.url).url) }.map(\.id)
+        })
         for entry in entries where !entry.isUnavailable {
             let resolvedURL = PersistedFilterURL.resolve(entry.url).url
             guard let components = URLComponents(url: resolvedURL, resolvingAgainstBaseURL: false),
@@ -458,13 +462,15 @@ enum BackupCustomFilterRestorer {
                 }
                 writes[destination] = Data(content.utf8)
             }
+            keptCustomIDs.insert(id)
             if let index = lists.firstIndex(where: matches) {
                 lists[index] = restored
                 lists = lists.enumerated().filter { $0.offset == index || !matches($0.element) }.map(\.element)
             } else {
                 lists.append(restored)
             }
         }
+        lists.removeAll { $0.isCustom && !keptCustomIDs.contains($0.id) }
         // This synchronous MainActor section does not interleave with app-side
         // edits. Rollback is best effort and leaves externally changed bytes
         // alone; any rollback I/O failures are returned with the original error.
@@ -659,6 +665,10 @@ enum BackupManager {
             )
         }
         let currentLists = filterManager.filterLists
+        let keptIDs = Set(lists.map(\.id))
+        for dropped in originalLists where dropped.isCustom && !keptIDs.contains(dropped.id) {
+            filterManager.removeCustomFilterList(dropped)
+        }
         for entry in backup.customFilterLists where !entry.isUnavailable {
             let url = PersistedFilterURL.resolve(entry.url).url
             if let filter = currentLists.first(where: { $0.isCustom && FilterListURLSupport.isSameList($0.url, url) }) {
```

---

### Incident Patch 5: `ad81ed84` (2026-10-05)
**Commit Message**: fix: capture the recovered filter immutably and make parts a let

**File**: `wBlock/FilterListUpdater.swift` (modified, +1/-1)
```diff
@@ -381,7 +381,7 @@ final class FilterListUpdater: @unchecked Sendable {
         recovered.etag = revision.etag
         recovered.serverLastModified = revision.lastModified
 
-        await MainActor.run {
+        await MainActor.run { [recovered] in
             guard let index = filterListManager?.filterLists.firstIndex(where: { $0.id == recovered.id }) else {
                 return
             }
```

**File**: `wBlockCoreService/FilterListSiteExclusion.swift` (modified, +1/-1)
```diff
@@ -217,7 +217,7 @@ public enum FilterListSiteExclusion {
         }
         let body = dollar.map { String(line[..<$0]) } ?? line
         let options = dollar.map { String(line[line.index(after: $0)...]) } ?? ""
-        var parts = options.isEmpty ? [] : options.split(separator: ",", omittingEmptySubsequences: false).map(String.init)
+        let parts = options.isEmpty ? [] : options.split(separator: ",", omittingEmptySubsequences: false).map(String.init)
         let domainIndex = parts.firstIndex(where: { $0.hasPrefix("domain=") || $0.hasPrefix("from=") }) ?? parts.count
         let rawDomains = domainIndex < parts.count
             ? parts[domainIndex].split(separator: "=", maxSplits: 1, omittingEmptySubsequences: false)[1].split(separator: "|")
```

---

### Incident Patch 6: `9525d873` (2026-10-05)
**Commit Message**: fix(macos): mark the tappable stat pills with a chevron

**File**: `wBlock/RowDisclosureChevron.swift` (modified, +0/-2)
```diff
@@ -1,6 +1,5 @@
 import SwiftUI
 
-#if os(iOS)
 /// The disclosure glyph every Settings row uses. Tapping a filter or script
 /// row opens its Info sheet, which lists all of the row's actions, and this
 /// is what tells the user the row opens at all. The switch stays flush
@@ -13,4 +12,3 @@ struct RowDisclosureChevron: View {
             .accessibilityHidden(true)
     }
 }
-#endif
```

**File**: `wBlock/StatCard.swift` (modified, +0/-2)
```diff
@@ -122,11 +122,9 @@ struct StatCard: View {
                         .foregroundStyle(.secondary)
                         .lineLimit(1)
                         .minimumScaleFactor(0.75)
-                    #if os(iOS)
                     if showsDisclosure {
                         RowDisclosureChevron()
                     }
-                    #endif
                 }
 
                 Text(value)
```

---

### Incident Patch 7: `c4680b43` (2026-10-05)
**Commit Message**: fix(regional): keep the language picker a steady size while searching

Matches scroll in a fixed band, so the Regional info popover no longer grows and shrinks with each keystroke (#932).

**File**: `wBlock/RegionalLanguagePickerView.swift` (modified, +24/-15)
```diff
@@ -154,23 +154,32 @@ struct RegionalLanguagePickerView: View {
             .padding(.horizontal, 12)
             .padding(.vertical, 9)
 
-            ForEach(matchingOptions) { language in
-                Divider().padding(.leading, 42)
-                Button {
-                    selectedLanguages.insert(language.code)
-                    searchQuery = ""
-                } label: {
-                    HStack(spacing: 10) {
-                        languageLeading(language)
-                        Text(language.nativeName)
-                        Spacer()
+            // Results scroll in a fixed band, so the sheet around the picker
+            // keeps its size while each keystroke changes the match count (#932).
+            if !searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
+                ScrollView {
+                    VStack(spacing: 0) {
+                        ForEach(matchingOptions) { language in
+                            Divider().padding(.leading, 42)
+                            Button {
+                                selectedLanguages.insert(language.code)
+                                searchQuery = ""
+                            } label: {
+                                HStack(spacing: 10) {
+                                    languageLeading(language)
+                                    Text(language.nativeName)
+                                    Spacer()
+                                }
+                                .padding(.horizontal, 12)
+                                .padding(.vertical, 9)
+                                .contentShape(Rectangle())
+                            }
+                            .buttonStyle(.plain)
+                            .noFocusRingCompat()
+                        }
                     }
-                    .padding(.horizontal, 12)
-                    .padding(.vertical, 9)
-                    .contentShape(Rectangle())
                 }
-                .buttonStyle(.plain)
-                .noFocusRingCompat()
+                .frame(height: 190)
             }
         }
         .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
```

---

### Incident Patch 8: `33fc5f4a` (2026-10-05)
**Commit Message**: fix(settings): keep Cosmetic Filtering usable during an apply

The apply snapshots that setting, so a change made meanwhile just waits for the next run. The sync-only switch still waits for the current sync and now says so.

**File**: `wBlock/CosmeticFilteringSitesView.swift` (modified, +2/-4)
```diff
@@ -8,8 +8,6 @@ struct CosmeticFilteringSitesView: View {
     @State private var isEnabled = CosmeticFilteringPreference.isEnabled()
     @State private var sites = CosmeticFilteringPreference.sites()
 
-    private var isSaving: Bool { filterManager.isLoading || filterManager.isApplyInFlight }
-
     var body: some View {
         ScrollView {
             VStack(alignment: .leading, spacing: 20) {
@@ -25,7 +23,8 @@ struct CosmeticFilteringSitesView: View {
                 #if os(macOS)
                 .toggleStyle(MacTrailingSwitchToggleStyle())
                 #endif
-                .disabled(isSaving)
+                // Not locked during an apply (#936): the run snapshots this setting
+                // and a change made meanwhile stays pending for the next one.
                 // The scope only matters while the switch is on, so it is
                 // hidden rather than left editable with no effect.
                 if isEnabled {
@@ -34,7 +33,6 @@ struct CosmeticFilteringSitesView: View {
                         emptySelectionMessage: "No sites selected. Cosmetic filtering will not apply.",
                         excludedMessage: "Cosmetic filtering will not apply on these sites. Network blocking still applies.",
                         footer: "Sites include their subdomains. Apply changes to update filtering.",
-                        isSaving: isSaving,
                         updateSelected: { update(CosmeticFilteringPreference.Sites(selectedSites: $0, excludedSites: sites.excludedSites)) },
                         updateExcluded: { update(CosmeticFilteringPreference.Sites(selectedSites: sites.selectedSites, excludedSites: $0)) }
                     )
```

**File**: `wBlock/SettingsView.swift` (modified, +7/-0)
```diff
@@ -659,6 +659,13 @@ struct SettingsView: View {
                             .font(.caption)
                             .foregroundStyle(.secondary)
                             .fixedSize(horizontal: false, vertical: true)
+                        // Changing what syncs mid-cycle would change what that cycle
+                        // merges, so the switch waits; say so instead of looking stuck (#936).
+                        if syncManager.isSyncing {
+                            Text("Available when the current sync finishes.")
+                                .font(.caption)
+                                .foregroundStyle(.secondary)
+                        }
                     }
                 }
                 .disabled(syncManager.isSyncing)
```

**File**: `wBlock/ar.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1179,3 +1179,6 @@ To re-enable these filters, disable other large filters and apply changes again.
 "Paste or write a userstyle with a /* ==UserStyle== */ metadata block." = "الصق نمط مستخدم أو اكتبه مع كتلة بيانات /* ==UserStyle== */.";
 
 "Paste or write a userscript with a // ==UserScript== metadata block." = "الصق سكربت مستخدم أو اكتبه مع كتلة بيانات // ==UserScript==.";
+
+/* Shown under a sync setting while a sync is running */
+"Available when the current sync finishes." = "يتوفر عند انتهاء المزامنة الحالية.";
```

**File**: `wBlock/de.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1179,3 +1179,6 @@ Um diese Filter wieder zu aktivieren, deaktiviere andere große Filter und wende
 "Paste or write a userstyle with a /* ==UserStyle== */ metadata block." = "Füge einen Userstyle mit einem /* ==UserStyle== */-Metadatenblock ein oder schreibe ihn.";
 
 "Paste or write a userscript with a // ==UserScript== metadata block." = "Füge ein Userscript mit einem // ==UserScript==-Metadatenblock ein oder schreibe es.";
+
+/* Shown under a sync setting while a sync is running */
+"Available when the current sync finishes." = "Verfügbar, sobald die aktuelle Synchronisierung abgeschlossen ist.";
```

**File**: `wBlock/el.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1179,3 +1179,6 @@ To re-enable these filters, disable other large filters and apply changes again.
 "Paste or write a userstyle with a /* ==UserStyle== */ metadata block." = "Επικολλήστε ή γράψτε ένα userstyle με μπλοκ μεταδεδομένων /* ==UserStyle== */.";
 
 "Paste or write a userscript with a // ==UserScript== metadata block." = "Επικολλήστε ή γράψτε ένα userscript με μπλοκ μεταδεδομένων // ==UserScript==.";
+
+/* Shown under a sync setting while a sync is running */
+"Available when the current sync finishes." = "Διαθέσιμο όταν ολοκληρωθεί ο τρέχων συγχρονισμός.";
```

**File**: `wBlock/en.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1188,3 +1188,6 @@ To re-enable these filters, disable other large filters and apply changes again.
 "Paste or write a userstyle with a /* ==UserStyle== */ metadata block." = "Paste or write a userstyle with a /* ==UserStyle== */ metadata block.";
 
 "Paste or write a userscript with a // ==UserScript== metadata block." = "Paste or write a userscript with a // ==UserScript== metadata block.";
+
+/* Shown under a sync setting while a sync is running */
+"Available when the current sync finishes." = "Available when the current sync finishes.";
```

**File**: `wBlock/es.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1179,3 +1179,6 @@ Para volver a activarlos, desactiva otros filtros grandes y aplica los cambios d
 "Paste or write a userstyle with a /* ==UserStyle== */ metadata block." = "Pega o escribe un userstyle con un bloque de metadatos /* ==UserStyle== */.";
 
 "Paste or write a userscript with a // ==UserScript== metadata block." = "Pega o escribe un userscript con un bloque de metadatos // ==UserScript==.";
+
+/* Shown under a sync setting while a sync is running */
+"Available when the current sync finishes." = "Disponible cuando termine la sincronización actual.";
```

**File**: `wBlock/fr.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1179,3 +1179,6 @@ Pour les réactiver, désactivez d’autres gros filtres puis appliquez à nouve
 "Paste or write a userstyle with a /* ==UserStyle== */ metadata block." = "Collez ou écrivez un style utilisateur avec un bloc de métadonnées /* ==UserStyle== */.";
 
 "Paste or write a userscript with a // ==UserScript== metadata block." = "Collez ou écrivez un script utilisateur avec un bloc de métadonnées // ==UserScript==.";
+
+/* Shown under a sync setting while a sync is running */
+"Available when the current sync finishes." = "Disponible lorsque la synchronisation en cours sera terminée.";
```

---

### Incident Patch 9: `fccdd29b` (2026-10-05)
**Commit Message**: fix(regional): let custom lists name any language and keep the form aligned

The language search field had a visible label, so on macOS the Form gave it a label column and shifted the name, description, and category rows right.

**File**: `wBlock/RegionalLanguagePickerView.swift` (modified, +9/-2)
```diff
@@ -58,9 +58,13 @@ struct RegionalLanguageOption: Identifiable, Hashable {
         options(for: filters.filter { $0.category == .foreign }.flatMap(\.languages), locale: locale)
     }
 
-    /// Every language a custom regional list can cover (#921).
+    /// Every language a custom regional list can cover (#921), including ones
+    /// wBlock has no flag for, so any list can name its language (#932).
     static func assignable(locale: Locale = displayLocale) -> [RegionalLanguageOption] {
-        options(for: FilterList.flaggedLanguageCodes, locale: locale)
+        let named = NSLocale.isoLanguageCodes.filter { code in
+            locale.localizedString(forLanguageCode: code).map { $0.lowercased() != code } ?? false
+        }
+        return options(for: FilterList.flaggedLanguageCodes + named, locale: locale)
     }
 
     private static func options(for codes: [String], locale: Locale) -> [RegionalLanguageOption] {
@@ -141,8 +145,11 @@ struct RegionalLanguagePickerView: View {
                 Image(systemName: "magnifyingglass")
                     .foregroundStyle(.secondary)
                     .frame(width: 20)
+                // Hidden label: a macOS Form lifts a field's label into its label
+                // column, which pushed every other row to the right (#932).
                 TextField("Search languages", text: $searchQuery)
                     .textFieldStyle(.plain)
+                    .labelsHidden()
             }
             .padding(.horizontal, 12)
             .padding(.vertical, 9)
```

---

### Incident Patch 10: `2104a3ef` (2026-10-05)
**Commit Message**: fix(settings): share one Automatic Updates row between filter and script settings

**File**: `wBlock/ContentSettingsView.swift` (modified, +27/-0)
```diff
@@ -29,3 +29,30 @@ struct ContentSettingsView<Content: View>: View {
         }
     }
 }
+
+/// The Automatic Updates switch both settings sheets lead with, so filter
+/// lists and userscripts read the same (#932).
+struct AutomaticUpdatesToggle: View {
+    let isOn: Bool
+    let description: LocalizedStringKey
+    let onChange: (Bool) -> Void
+
+    var body: some View {
+        Toggle(isOn: Binding(get: { isOn }, set: onChange)) {
+            VStack(alignment: .leading, spacing: 4) {
+                Text("Automatic Updates")
+                Text(description)
+                    .font(.caption)
+                    .foregroundStyle(.secondary)
+                    .fixedSize(horizontal: false, vertical: true)
+            }
+        }
+        .toggleStyle(.switch)
+        .padding(.vertical, 6)
+        .padding(.horizontal, 8)
+        // A shape background instead of cornerRadius: the latter clips, and on
+        // iOS 26 the switch's glass thumb extends past the row's bounds.
+        .background(Color.orange.opacity(isOn ? 0 : 0.08), in: RoundedRectangle(cornerRadius: 8))
+        .padding(.horizontal, -8)
+    }
+}
```

**File**: `wBlock/FilterInfoView.swift` (modified, +4/-5)
```diff
@@ -196,11 +196,10 @@ struct FilterSettingsView: View {
     var body: some View {
         ContentSettingsView(name: liveFilter.localizedDisplayName) {
             if liveFilter.isRemoteURL {
-                Toggle("Automatic Updates", isOn: Binding(
-                    get: { liveFilter.updatesAutomatically },
-                    set: { filterManager.setFilterList(liveFilter.id, updatesAutomatically: $0) }
-                ))
-                .toggleStyle(.switch)
+                AutomaticUpdatesToggle(
+                    isOn: liveFilter.updatesAutomatically,
+                    description: "Turn this off to keep the current version when wBlock updates filter lists in bulk or on a schedule."
+                ) { filterManager.setFilterList(liveFilter.id, updatesAutomatically: $0) }
             }
             SiteScopeEditor(
                 title: "Apply on", selectedSites: liveFilter.selectedSites, excludedSites: liveFilter.excludedSites,
```

**File**: `wBlock/UserScriptManagerView.swift` (modified, +5/-26)
```diff
@@ -1149,43 +1149,22 @@ struct UserScriptSettingsView: View {
     var body: some View {
         if let script = userScriptManager.userScript(withId: scriptID) {
             ContentSettingsView(name: script.localizedDisplayName) {
-                UserScriptWebsiteExceptionsView(scriptID: scriptID, userScriptManager: userScriptManager)
                 if !script.isLocal && script.resolvedDownloadURL != nil {
-                    ScriptUpdateSettingsView(updatesAutomatically: script.updatesAutomatically) { enabled in
+                    AutomaticUpdatesToggle(
+                        isOn: script.updatesAutomatically,
+                        description: "Turn this off to keep the current version when wBlock updates scripts in bulk or on a schedule."
+                    ) { enabled in
                         Task { await userScriptManager.setUserScript(script, updatesAutomatically: enabled) }
                     }
                 }
+                UserScriptWebsiteExceptionsView(scriptID: scriptID, userScriptManager: userScriptManager)
             }
         } else {
             Text("Unable to load script")
         }
     }
 }
 
-private struct ScriptUpdateSettingsView: View {
-    let updatesAutomatically: Bool
-    let onChange: (Bool) -> Void
-
-    var body: some View {
-        Toggle(isOn: Binding(get: { updatesAutomatically }, set: onChange)) {
-            VStack(alignment: .leading, spacing: 4) {
-                Text("Automatic Updates")
-                Text("Turn this off to keep the current version when wBlock updates scripts in bulk or on a schedule.")
-                    .font(.caption)
-                    .foregroundStyle(.secondary)
-                    .fixedSize(horizontal: false, vertical: true)
-            }
-        }
-        .toggleStyle(.switch)
-        .padding(.vertical, 6)
-        .padding(.horizontal, 8)
-        // A shape background instead of cornerRadius: the latter clips, and on
-        // iOS 26 the switch's glass thumb extends past the row's bounds.
-        .background(Color.orange.opacity(updatesAutomatically ? 0 : 0.08), in: RoundedRectangle(cornerRadius: 8))
-        .padding(.horizontal, -8)
-    }
-}
-
 
 struct UserScriptInfoSidebar: View {
     let script: UserScript
```

**File**: `wBlock/ar.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1170,3 +1170,6 @@ To re-enable these filters, disable other large filters and apply changes again.
 
 /* Invalid single filter URL */
 "This isn’t a valid http(s) filter URL." = "هذا ليس عنوان URL صالحًا لقائمة فلاتر http(s).";
+
+/* Filter list Automatic Updates setting description */
+"Turn this off to keep the current version when wBlock updates filter lists in bulk or on a schedule." = "أوقف هذا الخيار للاحتفاظ بالإصدار الحالي عندما يحدّث wBlock قوائم الفلاتر دفعة واحدة أو وفق جدول.";
```

**File**: `wBlock/de.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1170,3 +1170,6 @@ Um diese Filter wieder zu aktivieren, deaktiviere andere große Filter und wende
 
 /* Invalid single filter URL */
 "This isn’t a valid http(s) filter URL." = "Das ist keine gültige http(s)-Filter-URL.";
+
+/* Filter list Automatic Updates setting description */
+"Turn this off to keep the current version when wBlock updates filter lists in bulk or on a schedule." = "Schalte dies aus, um die aktuelle Version zu behalten, wenn wBlock Filterlisten gesammelt oder nach Zeitplan aktualisiert.";
```

**File**: `wBlock/el.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1170,3 +1170,6 @@ To re-enable these filters, disable other large filters and apply changes again.
 
 /* Invalid single filter URL */
 "This isn’t a valid http(s) filter URL." = "Αυτή δεν είναι έγκυρη διεύθυνση URL φίλτρου http(s).";
+
+/* Filter list Automatic Updates setting description */
+"Turn this off to keep the current version when wBlock updates filter lists in bulk or on a schedule." = "Απενεργοποιήστε το για να διατηρήσετε την τρέχουσα έκδοση όταν το wBlock ενημερώνει τις λίστες φίλτρων μαζικά ή βάσει προγράμματος.";
```

**File**: `wBlock/en.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1179,3 +1179,6 @@ To re-enable these filters, disable other large filters and apply changes again.
 
 /* Invalid single filter URL */
 "This isn’t a valid http(s) filter URL." = "This isn’t a valid http(s) filter URL.";
+
+/* Filter list Automatic Updates setting description */
+"Turn this off to keep the current version when wBlock updates filter lists in bulk or on a schedule." = "Turn this off to keep the current version when wBlock updates filter lists in bulk or on a schedule.";
```

**File**: `wBlock/es.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1170,3 +1170,6 @@ Para volver a activarlos, desactiva otros filtros grandes y aplica los cambios d
 
 /* Invalid single filter URL */
 "This isn’t a valid http(s) filter URL." = "Esta no es una URL de filtro http(s) válida.";
+
+/* Filter list Automatic Updates setting description */
+"Turn this off to keep the current version when wBlock updates filter lists in bulk or on a schedule." = "Desactívalo para conservar la versión actual cuando wBlock actualice listas de filtros de forma masiva o programada.";
```

---

### Incident Patch 11: `b6ab4d6d` (2026-10-05)
**Commit Message**: fix(editor): gray out Undo and Redo only when there's nothing to step through

Enabled controls now draw in the primary color, the toolbar buttons share one spacing, and the rule-type filter gets its circle back so it no longer looks like Wrap Lines.

**File**: `scripts/codemirror-build/editor.js` (modified, +20/-1)
```diff
@@ -3,7 +3,7 @@
 //  - keep syntax highlighting on for typical userscripts instead of disabling
 //    it whenever a single line exceeds 8192 chars; only drop it for genuinely
 //    large documents, and fall back to a stream highlighter rather than none.
-import { EditorState, Compartment } from "@codemirror/state";
+import { EditorState, Compartment, Transaction } from "@codemirror/state";
 import {
   EditorView,
   ViewPlugin,
@@ -24,6 +24,8 @@ import {
   historyKeymap,
   undo,
   redo,
+  undoDepth,
+  redoDepth,
 } from "@codemirror/commands";
 import {
   searchKeymap,
@@ -103,6 +105,17 @@ let baselineText = "";
 let dirtyKnown = false;
 let suppressDirty = false;
 let view = null;
+let lastHistory = "";
+
+// Undo and Redo gray out when there is nothing to step through (#932).
+function postHistory(state) {
+  const canUndo = !state.readOnly && undoDepth(state) > 0;
+  const canRedo = !state.readOnly && redoDepth(state) > 0;
+  const key = `${canUndo}${canRedo}`;
+  if (key === lastHistory) return;
+  lastHistory = key;
+  post({ type: "historyChanged", canUndo, canRedo });
+}
 
 function post(message) {
   window.webkit?.messageHandlers?.[HANDLER]?.postMessage(message);
@@ -168,6 +181,7 @@ function baseExtensions() {
     search({ top: true }),
     theme(),
     EditorView.updateListener.of((update) => {
+      if (update.transactions.length) postHistory(update.state);
       if (!update.docChanged || suppressDirty) return;
       post({ type: "documentChanged" });
       if (!dirtyKnown) {
@@ -264,6 +278,8 @@ window.wblockEditor = {
     const parent = document.getElementById("editor");
     view?.destroy();
     view = new EditorView({ state, parent });
+    lastHistory = "";
+    postHistory(view.state);
     post({
       type: "ready",
       analysis: {
@@ -277,6 +293,7 @@ window.wblockEditor = {
   setEditable(editable) {
     reconfigure(editableCompartment, EditorView.editable.of(!!editable));
     reconfigure(readOnlyCompartment, EditorState.readOnly.of(!editable));
+    if (view) postHistory(view.state);
     if (editable) view?.focus();
   },
   setLineWrapping(enabled) {
@@ -290,6 +307,8 @@ window.wblockEditor = {
     view.dispatch({
       changes: { from: 0, to: view.state.doc.length, insert: nextText },
       effects: lineKindsCompartment.reconfigure(categoryDecorations(lineKinds)),
+      // Loading a document is not an edit the user can undo back out of.
+      annotations: markClean ? Transaction.addToHistory.of(false) : [],
     });
     suppressDirty = false;
     if (markClean) {
```

**File**: `wBlock/CodeMirrorTextEditor.swift` (modified, +12/-0)
```diff
@@ -22,6 +22,8 @@ final class CodeMirrorEditorController: ObservableObject {
     /// Increments for document edits so consumers can debounce bounded metadata scans.
     @Published private(set) var documentRevision = 0
     @Published private(set) var analysis: CodeMirrorDocumentAnalysis?
+    @Published private(set) var canUndo = false
+    @Published private(set) var canRedo = false
 
     init(text: String, isUserStyle: Bool = false) {
         self.initialText = text
@@ -75,6 +77,11 @@ final class CodeMirrorEditorController: ObservableObject {
         documentRevision &+= 1
     }
 
+    fileprivate func updateHistory(canUndo: Bool, canRedo: Bool) {
+        if self.canUndo != canUndo { self.canUndo = canUndo }
+        if self.canRedo != canRedo { self.canRedo = canRedo }
+    }
+
     fileprivate func updateAnalysis(_ analysis: CodeMirrorDocumentAnalysis) {
         guard self.analysis != analysis else { return }
         self.analysis = analysis
@@ -385,6 +392,11 @@ extension CodeMirrorTextEditor {
                 }
             case "documentChanged":
                 controller.noteDocumentChanged()
+            case "historyChanged":
+                controller.updateHistory(
+                    canUndo: payload["canUndo"] as? Bool ?? false,
+                    canRedo: payload["canRedo"] as? Bool ?? false
+                )
             default:
                 break
             }
```

**File**: `wBlock/FilterInfoView.swift` (modified, +3/-2)
```diff
@@ -327,9 +327,10 @@ struct FilterRulesView: View {
                 Label("Comments", systemImage: "text.quote")
             }
         } label: {
-            // An icon like Search and Wrap beside it; filled while some kinds are hidden.
+            // The circle keeps it apart from Wrap Lines' similar bars; filled
+            // while some kinds are hidden.
             SourceControlIcon(systemImage: shownKinds.count == FilterRuleKind.allCases.count
-                ? "line.3.horizontal.decrease" : "line.3.horizontal.decrease.circle.fill")
+                ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill")
         }
         .menuStyle(.borderlessButton)
         .menuIndicator(.hidden)
```

**File**: `wBlock/SourceEditorSheet.swift` (modified, +2/-2)
```diff
@@ -37,9 +37,9 @@ struct SourceEditorSheet: View {
             .padding(.top, 16)
             HStack(spacing: SourceControlMetrics.spacing) {
                 SourceControlButton("Undo", systemImage: "arrow.uturn.backward", action: editorController.undo)
+                    .disabled(!editorController.canUndo)
                 SourceControlButton("Redo", systemImage: "arrow.uturn.forward", action: editorController.redo)
-                // A wider gap sets the history pair apart from the edit tools.
-                Spacer().frame(width: SourceControlMetrics.size / 2)
+                    .disabled(!editorController.canRedo)
                 SourceControlButton("Paste", systemImage: "doc.on.clipboard", action: onPaste ?? pasteClipboard)
                 Spacer(minLength: 0)
                 SourceViewerControls(wrapsLines: $wrapsLines, onSearch: editorController.openSearch)
```

**File**: `wBlock/SourceViewerControls.swift` (modified, +6/-4)
```diff
@@ -1,7 +1,8 @@
 import SwiftUI
 
 /// The icon controls every source window shares, viewing or editing (#921):
-/// one size, one spacing, no tint beyond the wrap toggle's on state.
+/// one size, one spacing. Enabled controls draw in the primary color and
+/// unavailable ones gray out, so gray always means "can't press" (#932).
 struct SourceViewerControls<Extra: View>: View {
     @Binding var wrapsLines: Bool
     let onSearch: () -> Void
@@ -42,9 +43,9 @@ enum SourceControlMetrics {
 
     static var spacing: CGFloat {
         #if os(iOS)
-        4
-        #else
         8
+        #else
+        12
         #endif
     }
 }
@@ -77,11 +78,12 @@ struct SourceControlButton: View {
 struct SourceControlIcon: View {
     let systemImage: String
     var isOn = false
+    @Environment(\.isEnabled) private var isEnabled
 
     var body: some View {
         Image(systemName: systemImage)
             .frame(width: SourceControlMetrics.size, height: SourceControlMetrics.size)
             .contentShape(Rectangle())
-            .foregroundStyle(isOn ? Color.accentColor : Color.secondary)
+            .foregroundStyle(isOn ? Color.accentColor : (isEnabled ? Color.primary : Color.secondary.opacity(0.5)))
     }
 }
```

---

### Incident Patch 12: `dc5f4586` (2026-10-05)
**Commit Message**: fix(editor): make the search panel more compact

**File**: `wBlock/Resources/CodeMirror/codemirror.html` (modified, +16/-14)
```diff
@@ -106,8 +106,8 @@
   display: flex !important;
   flex-wrap: wrap;
   align-items: center;
-  gap: 8px;
-  padding: 8px 48px 8px 12px !important;
+  gap: 6px;
+  padding: 6px 40px 6px 10px !important;
 }
 /* A <br> is not a flex item, so a full-width ::after sits between the find
    row and the replace controls, which are ordered after it. */
@@ -124,25 +124,27 @@
 .cm-panel.cm-search label {
   margin: 0 !important;
   box-sizing: border-box;
-  font-size: 13px !important;
+  font-size: 12px !important;
   line-height: 1 !important;
 }
+/* Kept compact so the panel covers less of the document (#932). */
 .cm-panel.cm-search .cm-textfield,
 .cm-panel.cm-search .cm-button {
-  height: 32px;
+  height: 26px;
+  padding: 0 8px !important;
 }
 .cm-panel.cm-search label {
   display: inline-flex !important;
   align-items: center;
-  gap: 6px;
-  height: 32px;
+  gap: 4px;
+  height: 26px;
   color: var(--cm-foreground);
 }
 .cm-panel.cm-search input[type=checkbox] {
   -webkit-appearance: none;
   appearance: none;
-  width: 18px;
-  height: 18px;
+  width: 16px;
+  height: 16px;
   flex: none;
   border: 1.5px solid var(--cm-gutter-foreground);
   border-radius: 5px;
@@ -164,13 +166,13 @@
 }
 .cm-panels .cm-search button[name=close] {
   position: absolute !important;
-  top: 8px !important;
-  right: 8px !important;
-  width: 32px;
-  height: 32px;
+  top: 6px !important;
+  right: 6px !important;
+  width: 26px;
+  height: 26px;
   padding: 0 !important;
-  border-radius: 16px !important;
-  font-size: 22px !important;
+  border-radius: 13px !important;
+  font-size: 18px !important;
   line-height: 1 !important;
   display: inline-grid;
   place-content: center;
```

---

### Incident Patch 13: `c7c975b7` (2026-10-05)
**Commit Message**: fix(add): drop the line number from single URL errors

**File**: `wBlock/ContentView.swift` (modified, +4/-1)
```diff
@@ -1614,7 +1614,10 @@ struct AddFilterListView: View {
 	                    Text("wBlock will fetch and enable the filter list automatically")
                             .foregroundStyle(.secondary)
 	                case .invalid:
-                        if let lineNumber = parsedURLInput.invalidLineNumbers.first {
+                        if urlEntryMode == .single {
+                            Text("This isn’t a valid http(s) filter URL.")
+                                .foregroundStyle(.orange)
+                        } else if let lineNumber = parsedURLInput.invalidLineNumbers.first {
                             Text(LocalizedStrings.format(
                                 "Line %d isn’t a valid http(s) filter URL.",
                                 comment: "Invalid bulk filter URL line",
```

**File**: `wBlock/ar.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1167,3 +1167,6 @@ To re-enable these filters, disable other large filters and apply changes again.
 
 /* Onboarding footer under the regional filter list */
 "English and languages without a regional list are covered by the default filters." = "تغطي الفلاتر الافتراضية الإنجليزية واللغات التي لا توجد لها قائمة إقليمية.";
+
+/* Invalid single filter URL */
+"This isn’t a valid http(s) filter URL." = "هذا ليس عنوان URL صالحًا لقائمة فلاتر http(s).";
```

**File**: `wBlock/de.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1167,3 +1167,6 @@ Um diese Filter wieder zu aktivieren, deaktiviere andere große Filter und wende
 
 /* Onboarding footer under the regional filter list */
 "English and languages without a regional list are covered by the default filters." = "Englisch und Sprachen ohne regionale Liste werden von den Standardfiltern abgedeckt.";
+
+/* Invalid single filter URL */
+"This isn’t a valid http(s) filter URL." = "Das ist keine gültige http(s)-Filter-URL.";
```

**File**: `wBlock/el.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1167,3 +1167,6 @@ To re-enable these filters, disable other large filters and apply changes again.
 
 /* Onboarding footer under the regional filter list */
 "English and languages without a regional list are covered by the default filters." = "Τα αγγλικά και οι γλώσσες χωρίς περιφερειακή λίστα καλύπτονται από τα προεπιλεγμένα φίλτρα.";
+
+/* Invalid single filter URL */
+"This isn’t a valid http(s) filter URL." = "Αυτή δεν είναι έγκυρη διεύθυνση URL φίλτρου http(s).";
```

**File**: `wBlock/en.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1176,3 +1176,6 @@ To re-enable these filters, disable other large filters and apply changes again.
 
 /* Onboarding footer under the regional filter list */
 "English and languages without a regional list are covered by the default filters." = "English and languages without a regional list are covered by the default filters.";
+
+/* Invalid single filter URL */
+"This isn’t a valid http(s) filter URL." = "This isn’t a valid http(s) filter URL.";
```

**File**: `wBlock/es.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1167,3 +1167,6 @@ Para volver a activarlos, desactiva otros filtros grandes y aplica los cambios d
 
 /* Onboarding footer under the regional filter list */
 "English and languages without a regional list are covered by the default filters." = "El inglés y los idiomas sin lista regional quedan cubiertos por los filtros predeterminados.";
+
+/* Invalid single filter URL */
+"This isn’t a valid http(s) filter URL." = "Esta no es una URL de filtro http(s) válida.";
```

**File**: `wBlock/fr.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1167,3 +1167,6 @@ Pour les réactiver, désactivez d’autres gros filtres puis appliquez à nouve
 
 /* Onboarding footer under the regional filter list */
 "English and languages without a regional list are covered by the default filters." = "L’anglais et les langues sans liste régionale sont couverts par les filtres par défaut.";
+
+/* Invalid single filter URL */
+"This isn’t a valid http(s) filter URL." = "Ceci n’est pas une URL de filtre http(s) valide.";
```

**File**: `wBlock/hu.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1167,3 +1167,6 @@ Az újbóli engedélyezésükhöz tilts le más nagy szűrőket, majd alkalmazd
 
 /* Onboarding footer under the regional filter list */
 "English and languages without a regional list are covered by the default filters." = "Az angolt és a regionális lista nélküli nyelveket az alapértelmezett szűrők lefedik.";
+
+/* Invalid single filter URL */
+"This isn’t a valid http(s) filter URL." = "Ez nem érvényes http(s) szűrő-URL.";
```

---

### Incident Patch 14: `9195822f` (2026-10-05)
**Commit Message**: fix(add): line the single URL field up with the other editors

**File**: `wBlock/AddContentShell.swift` (modified, +3/-0)
```diff
@@ -321,7 +321,10 @@ struct AddContentURLInput: View {
             .frame(minHeight: 96, maxHeight: 140)
             .accessibilityLabel(label)
         } else {
+            // Forms on macOS put the label beside the field, which pushed it out
+            // of line with the bulk and text editors; the placeholder names it.
             TextField(label, text: $text, prompt: placeholder)
+                .labelsHidden()
                 #if os(macOS)
                 .textFieldStyle(.roundedBorder)
                 #endif
```

---

### Incident Patch 15: `6325e348` (2026-10-05)
**Commit Message**: fix(onboarding): keep the content blocker chips tight so they share a line

**File**: `wBlock/OnboardingView.swift` (modified, +3/-1)
```diff
@@ -667,7 +667,9 @@ struct OnboardingView: View {
                     }
 
                     if !detectedContentBlockerStates.isEmpty {
-                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 76), spacing: 6, alignment: .leading)], alignment: .leading, spacing: 6) {
+                        // Adaptive columns stretch to fill the row, which spread the
+                        // chips apart and pushed the last one onto its own line (#932).
+                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 76, maximum: 84), spacing: 6, alignment: .leading)], alignment: .leading, spacing: 6) {
                                 ForEach(detectedContentBlockerStates) { slotState in
                                     HStack(spacing: 3) {
                                         Image(systemName: slotState.isEnabled ? "checkmark.circle.fill" : "xmark.circle")
```

#### Recent Merged Pull Requests:
- **PR #937** (2026-10-05): Fix Japanese localization strings formatting (@so-5699)
- **PR #930** (2026-10-04): fix(userscripts): keep deleted scripts deleted on rebase (@DisturbedOcean)
- **PR #929** (2026-10-03): Corrections to German translations in de.lproj/Localizable.strings (@cell849)
- **PR #926** (2026-10-03): Rebuild Add sheets with native tabs and forms (@0xCUB3)
- **PR #920** (2026-10-02): Turkish localization updated (@remad0)
- **PR #910** (2026-10-01): Return after native site-setting requests (@dajiaohuang)
- **PR #909** (2026-10-01): Explain userscript enabled state sync (@dajiaohuang)
- **PR #908** (closed): Import bulk filter URLs from a text file (@dajiaohuang)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
