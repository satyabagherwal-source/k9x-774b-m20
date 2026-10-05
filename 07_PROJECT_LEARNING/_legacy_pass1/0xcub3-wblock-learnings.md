# Forensic Learning Record (Deep Inspection): 0xCUB3/wBlock

> **Canonical Artifact**: `07_PROJECT_LEARNING/0xcub3-wblock-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/0xCUB3/wBlock](https://github.com/0xCUB3/wBlock))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:34:47.409Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `0xCUB3/wBlock`
- **Description**: The next-generation ad blocker for Safari. Free and open source on macOS, iOS, iPadOS, and visionOS, with 750,000 rules, userscripts, userstyles, and an element zapper.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3007 stars

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

### Core Architecture Module: `wBlockCoreService/ContentBlockerReloadPolicy.swift`
```
import Foundation

public enum ContentBlockerReloadPolicy {
    public static let recoveryThreshold = 3
    public static let recoveryTimeout: TimeInterval = 45
    private static let prefix = "wBlock.reloadFailureStreak."

    public static func failureStreak(identifier: String, groupIdentifier: String) -> Int {
        max(0, UserDefaults(suiteName: groupIdentifier)?.integer(forKey: prefix + identifier) ?? 0)
    }

    public static func needsRecovery(identifier: String, groupIdentifier: String) -> Bool {
        failureStreak(identifier: identifier, groupIdentifier: groupIdentifier) >= recoveryThreshold
    }

    public static func record(
        identifier: String, groupIdentifier: String, success: Bool,
        attempts: Int, disabledInSafari: Bool = false
    ) {
        guard let defaults = UserDefaults(suiteName: groupIdentifier) else { return }
        if success {
            defaults.removeObject(forKey: prefix + identifier)
        } else if attempts > 0 && !disabledInSafari {
            defaults.set(min(100, failureStreak(identifier: identifier, groupIdentifier: groupIdentifier) + 1),
                         forKey: prefix + identifier)
        }
    }

    public static func orderedTargets(
        _ targets: [ContentBlockerTargetInfo], ruleCounts: [String: Int],
        groupIdentifier: String = GroupIdentifier.shared.value
    ) -> [ContentBlockerTargetInfo] {
        let recovering = Set(targets.filter {
            needsRecovery(identifier: $0.bundleIdentifier, groupIdentifier: groupIdentifier)
        }.map(\.bundleIdentifier))
        let ordered = targets.sorted {
            let left = recovering.contains($0.bundleIdentifier)
            let right = recovering.contains($1.bundleIdentifier)
            if left != right { return left }
            let leftCount = ruleCounts[$0.bundleIdentifier] ?? 0
            let rightCount = ruleCounts[$1.bundleIdentifier] ?? 0
            if leftCount != rightCount { return leftCount > rightCount }
            return $0.slot < $1.slot
        }
        let fields = ["order": ordered.map { $0.bundleIdentifier }.joined(separator: ","),
                      "ruleCounts": ordered.map { String(ruleCounts[$0.bundleIdentifier] ?? 0) }.joined(separator: ","),
                      "recoveryTargets": recovering.sorted().joined(separator: ",")]
        Task { await SharedAutoUpdateManager.shared.recordOperation("reload-order", fields: fields) }
        return ordered
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
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

- **Issue #912** (2026-10-01): **[BUG]Adguard mobile filter apply failed**
  *Symptoms*: ### Describe the bug  This filter cause an error. Everytime when you start an update this filter failed to update or apply. Its maybe a source problem. Maybe you find the lists on github too.  ### To reproduce  Steps to reproduce the behavior: 1. Go to '...' 2. Click on '....' 3. Scroll down to '....' 4. See error   ### Expected behavior  _No response_  ### Screenshot or video  _No response_  ### Environment  - OS: 27.2 beta - wBlock Version: 3.1.3 - Intel or Apple Silicon (macOS only): [e.g. Apple M2]   ### Troubleshooting checklist  - [x] I have enabled all 5 wBlock Content Blocker extensions in Safari _(including Profiles, if applicable)_. - [x] I have enabled `wBlock Scripts` and set it to `Allow` on all websites (`Always Allow on Every Website`) in Safari settings. - [x] I have enabled `Allow in Private Browsing` for `wBlock Scripts` and all 5 content blockers _(Safari → Settings → Extensions)_. - [x] I have opened wBlock and pressed `Apply Changes` after changing filters, userscripts, whitelist, and/or extension settings. - [x] For filtering issues, I have restarted iOS/iPadOS and/or macOS, opened wBlock, manually checked for updates 🔄, and reopened Safari. _(Optional)_  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this, Markus! AdGuard Mobile Filter was the one AdGuard list wBlock downloaded straight from AdGuard's own server, filters.adtidy.org, with no backup source. If that server didn't answer or your network couldn't reach it, the list failed on every update. The other AdGuard lists quietly fall back to another source when that happens.  In a353e848 it now downloads from AdGuard's GitHub registry like the rest, and falls back to AdGuard's server and then jsDelivr if GitHub doesn't work. Your existing list switches over on its own. I couldn't reproduce the failure here, so if it still fails after the update, please reopen this. The fix will ship in 3.1.4. 

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

### Incident Patch 1: `2561ebbe` (2026-10-04)
**Commit Message**: fix(ios): give each Add sheet tab its own navigation bar

The tabs shared one bar, so its scroll-edge effect could carry over from one
form to the next. Mid-switch the shared bar drew a separator line across the
incoming form, the hard edge seen cutting through Choose File.

**File**: `wBlock/AddContentShell.swift` (modified, +24/-16)
```diff
@@ -8,7 +8,8 @@ protocol AddContentMode: CaseIterable, Identifiable, Hashable {
 
 /// Both Add sheets: a native TabView of grouped forms (bottom tab bar on iOS,
 /// top tabs on macOS), with Cancel and the primary action where each
-/// platform puts them.
+/// platform puts them. On iOS each tab owns its navigation bar, so a bar's
+/// scroll-edge blur sized for one form never lingers over another.
 struct AddContentSheet<Mode: AddContentMode, Content: View>: View {
     let title: LocalizedStringKey
     @Binding var mode: Mode
@@ -27,15 +28,7 @@ struct AddContentSheet<Mode: AddContentMode, Content: View>: View {
 
     var body: some View {
         #if os(iOS)
-        CompatibleNavigationStack {
-            tabs
-                .navigationTitle(title)
-                .navigationBarTitleDisplayMode(.inline)
-                .toolbar {
-                    ToolbarItem(placement: .cancellationAction) { cancelButton }
-                    ToolbarItem(placement: .confirmationAction) { submitButton }
-                }
-        }
+        tabs
         .interactiveDismissDisabled(isLoading)
         .largeSheetPresentationCompat()
         #else
@@ -68,18 +61,33 @@ struct AddContentSheet<Mode: AddContentMode, Content: View>: View {
     }
 
     private func tab(_ mode: Mode) -> some View {
+        page(mode)
+            .tabItem { Label(mode.localizedTitle, systemImage: mode.systemImage) }
+            .tag(mode)
+    }
+
+    @ViewBuilder
+    private func page(_ mode: Mode) -> some View {
+        #if os(iOS)
+        CompatibleNavigationStack {
+            Form { content(mode) }
+                .groupedFormStyleCompat()
+                .disabled(isLoading)
+                .navigationTitle(title)
+                .navigationBarTitleDisplayMode(.inline)
+                .toolbar {
+                    ToolbarItem(placement: .cancellationAction) { cancelButton }
+                    ToolbarItem(placement: .confirmationAction) { submitButton }
+                }
+        }
+        #else
         Form { content(mode) }
-            #if os(macOS)
             .columnsFormStyleCompat()
             .padding(.horizontal, 20)
             .padding(.vertical, 16)
             .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
-            #else
-            .groupedFormStyleCompat()
-            #endif
             .disabled(isLoading)
-            .tabItem { Label(mode.localizedTitle, systemImage: mode.systemImage) }
-            .tag(mode)
+        #endif
     }
 
     private var cancelButton: some View {
```

---

### Incident Patch 2: `9c4f05a8` (2026-10-04)
**Commit Message**: Merge pull request #930 from DisturbedOcean/fix-icloud-sync

fix(userscripts): keep deleted scripts deleted on rebase

**File**: `scripts/test_userscript_persistence_race.swift` (modified, +10/-0)
```diff
@@ -61,6 +61,16 @@ struct UserScriptPersistenceRaceTests {
             fatalError("genuinely new ID was not inserted")
         }
 
+        let disabledB = record("B", false, "old B")
+        let staleSnapshot = UserScriptPersistence.rebase(
+            persisted: [b],
+            incoming: [a, disabledB, c],
+            baseline: [a, b]
+        )
+        guard staleSnapshot.map(\.id) == ["B", "C"],
+              staleSnapshot.first?.isEnabled == false
+        else { fatalError("stale snapshot rebase resurrected a deleted ID or lost an enable change") }
+
         let remoteX = "https://example.com/scripts/x.user.js"
         let persistedRemote = record(
             "remote-A", false, "persisted X", url: "HTTPS://EXAMPLE.COM:443/scripts/x.user.js#old"
```

**File**: `wBlockCoreService/ProtobufDataManager.swift` (modified, +5/-6)
```diff
@@ -270,12 +270,11 @@ private func mergePersistedChanges(
         deletedIDs: explicitlyDeletedFilterIDs
     )
 
-    var explicitEnabledStates: [String: Bool] = [:]
-    let previousScriptsByID = Dictionary(uniqueKeysWithValues: previous.userScripts.map { ($0.id, $0) })
-    for script in snapshot.userScripts where previousScriptsByID[script.id]?.isEnabled != script.isEnabled {
-        explicitEnabledStates[script.id] = script.isEnabled
-    }
-    snapshot.userScripts = UserScriptPersistence.merge(persisted: persisted.userScripts, incoming: snapshot.userScripts, explicitEnabledStates: explicitEnabledStates)
+    snapshot.userScripts = UserScriptPersistence.rebase(
+        persisted: persisted.userScripts,
+        incoming: snapshot.userScripts,
+        baseline: previous.userScripts
+    )
 
     var whitelist = snapshot.whitelist
     mergeStringSet(
```

**File**: `wBlockCoreService/UserScriptPersistence.swift` (modified, +20/-0)
```diff
@@ -69,6 +69,26 @@ enum UserScriptPersistence {
         return result
     }
 
+    /// Rebases an in-memory snapshot onto disk. An ID in `baseline` but missing
+    /// from `persisted` was deleted by another writer and must stay deleted.
+    static func rebase(
+        persisted: [Wblock_Data_UserScriptData],
+        incoming: [Wblock_Data_UserScriptData],
+        baseline: [Wblock_Data_UserScriptData]
+    ) -> [Wblock_Data_UserScriptData] {
+        let baselineByID = Dictionary(baseline.map { ($0.id, $0) }, uniquingKeysWith: { _, latest in latest })
+        var explicitEnabledStates: [String: Bool] = [:]
+        for script in incoming where baselineByID[script.id]?.isEnabled != script.isEnabled {
+            explicitEnabledStates[script.id] = script.isEnabled
+        }
+        return merge(
+            persisted: persisted,
+            incoming: incoming,
+            explicitEnabledStates: explicitEnabledStates,
+            allowedInsertIDs: Set(incoming.map(\.id)).subtracting(baselineByID.keys)
+        )
+    }
+
     static func merge(
         persisted: [Wblock_Data_UserScriptData],
         incoming: [Wblock_Data_UserScriptData],
```

---

### Incident Patch 3: `d1aac55f` (2026-10-04)
**Commit Message**: fix(info): Size macOS popovers in one pass and frost the iPad header on scroll

A measured height reached the popover a frame late, so AppKit opened it at a placeholder size and slid it diagonally. On iPad form sheets the content frame never went negative under the header, so the frost never appeared (#916).

**File**: `wBlock/ContentInfoMetadata.swift` (modified, +11/-16)
```diff
@@ -223,26 +223,21 @@ struct InfoMetadataRow: View {
 }
 
 #if os(macOS)
-private struct InfoContentHeight: PreferenceKey {
-    static let defaultValue: CGFloat = 0
-    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
-}
-
+/// Sizes to its content up to a cap in the first layout pass. A measured
+/// height fed back through state reached the popover a frame late, so AppKit
+/// opened it at a placeholder size and slid it diagonally to refit (#916).
 struct InfoContentScrollView<Content: View>: View {
-    var maximumHeight: CGFloat = 640
     @ViewBuilder var content: () -> Content
-    @State private var contentHeight: CGFloat = 360
 
     var body: some View {
-        ScrollView {
-            content().background(GeometryReader { proxy in
-                Color.clear.preference(key: InfoContentHeight.self, value: proxy.size.height)
-            })
-        }
-        .frame(height: min(contentHeight, maximumHeight))
-        .onPreferenceChange(InfoContentHeight.self) { height in
-            if height > 0 { contentHeight = height }
-        }
+        ScrollView { content() }
+            .infoPopoverHeightCap()
+    }
+}
+
+extension View {
+    func infoPopoverHeightCap() -> some View {
+        frame(maxHeight: 640).fixedSize(horizontal: false, vertical: true)
     }
 }
 #endif
```

**File**: `wBlock/SheetDesignSystem.swift` (modified, +25/-16)
```diff
@@ -86,9 +86,7 @@ extension View {
 struct InfoSheetContainer<Header: View, Content: View>: View {
     let header: () -> Header
     let content: () -> Content
-    #if os(macOS)
-    @State private var headerHeight: CGFloat = 0
-    #else
+    #if os(iOS)
     @State private var isScrolled = false
     #endif
 
@@ -102,13 +100,7 @@ struct InfoSheetContainer<Header: View, Content: View>: View {
             #if os(macOS)
             header()
                 .frame(maxWidth: .infinity, alignment: .leading)
-                .background(GeometryReader { proxy in
-                    Color.clear.preference(key: InfoSheetHeaderHeight.self, value: proxy.size.height)
-                })
-                .onPreferenceChange(InfoSheetHeaderHeight.self) { headerHeight = $0 }
-            InfoContentScrollView(maximumHeight: max(0, 640 - headerHeight)) {
-                scrollContent
-            }
+            ScrollView { scrollContent }
             #else
             ScrollView {
                 scrollContent
@@ -121,7 +113,10 @@ struct InfoSheetContainer<Header: View, Content: View>: View {
                     })
             }
             .coordinateSpace(name: InfoSheetScrollOffset.space)
-            .onPreferenceChange(InfoSheetScrollOffset.self) { isScrolled = $0 < -1 }
+            .onPreferenceChange(InfoSheetScrollOffset.self) { top in
+                if #unavailable(iOS 18.0) { isScrolled = top < -1 }
+            }
+            .infoSheetScrolledCompat($isScrolled)
             .safeAreaInset(edge: .top, spacing: 0) {
                 // Frosted only once content scrolls beneath it, so the title and
                 // description do not sit against a divider at rest.
@@ -132,6 +127,9 @@ struct InfoSheetContainer<Header: View, Content: View>: View {
             }
             #endif
         }
+        #if os(macOS)
+        .infoPopoverHeightCap()
+        #endif
     }
 
     private var scrollContent: some View {
@@ -148,12 +146,23 @@ private struct InfoSheetScrollOffset: PreferenceKey {
     static let defaultValue: CGFloat = 0
     static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
 }
-#endif
 
-#if os(macOS)
-private struct InfoSheetHeaderHeight: PreferenceKey {
-    static let defaultValue: CGFloat = 0
-    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
+private extension View {
+    /// Content offset measured against the top inset. On iPad form sheets the
+    /// content's frame never goes negative while the header inset covers it,
+    /// so the frame test alone left the title unfrosted over the rows (#916).
+    @ViewBuilder
+    func infoSheetScrolledCompat(_ isScrolled: Binding<Bool>) -> some View {
+        if #available(iOS 18.0, *) {
+            onScrollGeometryChange(for: Bool.self) { geometry in
+                geometry.contentOffset.y + geometry.contentInsets.top > 1
+            } action: { _, scrolled in
+                isScrolled.wrappedValue = scrolled
+            }
+        } else {
+            self
+        }
+    }
 }
 #endif
 
```

---

### Incident Patch 4: `3b22dbfb` (2026-10-04)
**Commit Message**: fix(macos): Stop a row rebuild from closing userscript info

SwiftUI briefly hosts a window-less copy of the row's anchor with the same token. When it left, it unregistered the live button's anchor and the selection was cleared before the popover opened. Only the owning view may unregister now (#931).

**File**: `wBlock/InfoPresentation.swift` (modified, +8/-4)
```diff
@@ -113,8 +113,12 @@ final class InfoPopoverPresenter: ObservableObject {
     private var anchors: [UUID: (id: AnyHashable, view: InfoPopoverAnchorView)] = [:]
 
     func register(_ token: UUID, id: AnyHashable, view: InfoPopoverAnchorView) { anchors[token] = (id, view) }
-    func unregister(_ token: UUID) {
-        guard let id = anchors.removeValue(forKey: token)?.id else { return }
+    /// SwiftUI can host a second, window-less copy of an anchor with the same
+    /// token while it rebuilds a row. Only the view that owns the registration
+    /// may remove it, or the copy evicts the live button and its popover is
+    /// cleared before it opens (#931).
+    func unregister(_ token: UUID, view: InfoPopoverAnchorView) {
+        guard anchors[token]?.view === view, let id = anchors.removeValue(forKey: token)?.id else { return }
         // A presented row that moves (a category change from its own popover)
         // follows its new anchor; one that leaves the list closes its popover.
         DispatchQueue.main.async { [self] in
@@ -259,7 +263,7 @@ final class InfoPopoverAnchorView: NSView {
     fileprivate var registration: (token: UUID, id: AnyHashable, presenter: InfoPopoverPresenter)? {
         didSet {
             if let oldValue, oldValue.token != registration?.token || oldValue.presenter !== registration?.presenter {
-                oldValue.presenter.unregister(oldValue.token)
+                oldValue.presenter.unregister(oldValue.token, view: self)
             }
             register()
         }
@@ -274,7 +278,7 @@ final class InfoPopoverAnchorView: NSView {
     private func register() {
         guard let registration else { return }
         if window == nil {
-            registration.presenter.unregister(registration.token)
+            registration.presenter.unregister(registration.token, view: self)
         } else {
             registration.presenter.register(registration.token, id: registration.id, view: self)
         }
```

---

### Incident Patch 5: `99001000` (2026-10-04)
**Commit Message**: fix(ios): Gray the Apply label while a sheet or alert is up

SwiftUI text ignores UIKit's tint dimming, so Apply stayed black beside the grayed icons on iOS 26 (#931).

**File**: `wBlock/SwiftUICompatibility.swift` (modified, +46/-2)
```diff
@@ -506,7 +506,7 @@ struct ApplyChangesToolbarLabel: View {
     @ViewBuilder
     private var horizontalLabel: some View {
         if hasPendingChanges {
-            Text("Apply").fontWeight(.semibold)
+            ApplyText()
         } else {
             Image(systemName: symbolName)
         }
@@ -526,14 +526,58 @@ struct ApplyChangesToolbarLabel: View {
                     systemImage: hasPendingChanges ? "checkmark.arrow.trianglehead.counterclockwise" : symbolName
                 )
             } else if hasPendingChanges {
-                Text("Apply").fontWeight(.semibold)
+                ApplyText()
             } else {
                 Image(systemName: symbolName)
             }
         }
     }
     #endif
 }
+
+/// UIKit grays toolbar symbols through tint dimming while a sheet or alert is
+/// up, but SwiftUI text ignores it, so Apply stayed black beside the grayed
+/// icons (#931). The text follows UIKit's dimming state instead.
+private struct ApplyText: View {
+    @State private var isDimmed = false
+
+    var body: some View {
+        Text("Apply").fontWeight(.semibold)
+            .foregroundStyle(isDimmed ? .secondary : .primary)
+            .background(TintDimmingReader(isDimmed: $isDimmed))
+    }
+}
+
+private struct TintDimmingReader: UIViewRepresentable {
+    @Binding var isDimmed: Bool
+
+    func makeUIView(context: Context) -> ReaderView {
+        let view = ReaderView()
+        view.isUserInteractionEnabled = false
+        return view
+    }
+
+    func updateUIView(_ view: ReaderView, context: Context) {
+        view.onChange = { dimmed in
+            if isDimmed != dimmed { isDimmed = dimmed }
+        }
+    }
+
+    final class ReaderView: UIView {
+        var onChange: (Bool) -> Void = { _ in }
+
+        // Reads the effective mode, inherited from the nearest ancestor that sets one.
+        override func tintColorDidChange() {
+            super.tintColorDidChange()
+            onChange(tintAdjustmentMode == .dimmed)
+        }
+
+        override func didMoveToWindow() {
+            super.didMoveToWindow()
+            onChange(tintAdjustmentMode == .dimmed)
+        }
+    }
+}
 #endif
 
 /// Toolbar Apply control: tap applies pending changes or checks for updates; 3s hold force-applies.
```

---

### Incident Patch 6: `44f1abc5` (2026-10-04)
**Commit Message**: fix(macos): Lead the open search field with its magnifier and gray inactive toolbars

The magnifier now rides the capsule's leading edge like Notes and Mail, and Search and Add gray out with the window in the background (#931).

**File**: `wBlock/LiquidGlassDesignSystem.swift` (modified, +15/-12)
```diff
@@ -185,6 +185,7 @@ private struct CompactToolbarButtonStyle: ButtonStyle {
     @State private var isHovered = false
     @Environment(\.compactToolbarTextLabel) private var isTextLabel
     @Environment(\.compactToolbarGrouped) private var isGrouped
+    @Environment(\.controlActiveState) private var controlActiveState
 
     private var side: CGFloat { isGrouped ? 30 : 36 }
 
@@ -195,7 +196,8 @@ private struct CompactToolbarButtonStyle: ButtonStyle {
             .frame(width: isTextLabel ? nil : side, height: side)
             .padding(.horizontal, isTextLabel ? 10 : 0)
             .contentShape(Rectangle())
-            .foregroundStyle(.primary)
+            // Background windows gray their toolbar, as native items do.
+            .foregroundStyle(controlActiveState == .inactive ? .secondary : .primary)
             .background(Color.primary.opacity(isEnabled ? (configuration.isPressed ? 0.12 : (isHovered ? 0.08 : 0)) : 0), in: .capsule)
             .opacity(isEnabled ? (configuration.isPressed ? 0.6 : 1) : 0.35)
             .onHover { isHovered = $0 }
@@ -273,6 +275,7 @@ struct InlineGlassSearchField: View {
     @State private var anchor = ToolbarItemAnchor()
     @FocusState private var isFocused: Bool
     @Environment(\.accessibilityReduceMotion) private var reduceMotion
+    @Environment(\.controlActiveState) private var controlActiveState
 
     var body: some View {
         HStack(spacing: 0) {
@@ -307,8 +310,8 @@ struct InlineGlassSearchField: View {
             .opacity(isExpanded ? 1 : 0)
             .allowsHitTesting(isExpanded)
             .accessibilityHidden(!isExpanded)
-            .padding(.leading, growsTrailing ? 36 : 8)
-            .padding(.trailing, growsTrailing ? 8 : 36)
+            .padding(.leading, 36)
+            .padding(.trailing, 8)
         }
         .frame(width: isExpanded ? Self.expandedWidth : 36, height: 36, alignment: buttonEdge)
         .clipShape(.capsule)
@@ -322,21 +325,17 @@ struct InlineGlassSearchField: View {
             }
         }
         .glassEffect(.regular.interactive(), in: .capsule)
-        .animation(reduceMotion ? nil : .smooth(duration: Self.duration), value: isExpanded)
-        .animation(reduceMotion ? nil : .easeInOut(duration: 0.18), value: text.isEmpty)
-        .frame(width: holdsExpandedSlot ? Self.expandedWidth : 36, alignment: buttonEdge)
-        .background(ToolbarItemAnchorReader(anchor: anchor))
-        .overlay(alignment: buttonEdge) {
-            // The magnifier is outside the animated field so it stays anchored
-            // while AppKit reserves or releases the wider toolbar slot.
+        // The magnifier sits on the capsule's leading edge, outside the field, so
+        // it rides that edge as the capsule grows and ends in front of the text,
+        // the way Notes and Mail place it.
+        .overlay(alignment: .leading) {
             Button(action: expandAndFocus) {
                 Label(prompt, systemImage: "magnifyingglass")
                     .labelStyle(.iconOnly)
                     .font(.system(size: 13))
                     .fixedSize()
-                    .foregroundStyle(text.isEmpty ? Color.primary : Color.accentColor)
+                    .foregroundStyle(text.isEmpty ? (controlActiveState == .inactive ? Color.secondary : Color.primary) : Color.accentColor)
                     .contentTransition(.identity)
-                    .transaction { transaction in transaction.animation = nil }
                     .frame(width: 20, height: 36)
                     .padding(.horizontal, 8)
                     .contentShape(Rectangle())
@@ -345,6 +344,10 @@ struct InlineGlassSearchField: View {
             .accessibilityValue(text)
             .help(prompt)
         }
+        .animation(reduceMotion ? nil : .smooth(duration: Self.duration), value: isExpanded)
+        .animation(reduceMotion ? nil : .easeInOut(duration: 0.18), value: text.isEmpty)
+        .frame(width: holdsExpandedSlot ? Self.expandedWidth : 36, alignment: buttonEdge)
+        .background(ToolbarItemAnchorReader(anchor: anchor))
         .onAppear {
             isVisible = true
             if !text.isEmpty { expand() }
```

---

### Incident Patch 7: `58f409ae` (2026-10-04)
**Commit Message**: fix(filters): Show automatic updates as a switch like userscripts

(#931)

**File**: `wBlock/FilterInfoView.swift` (modified, +1/-0)
```diff
@@ -200,6 +200,7 @@ struct FilterSettingsView: View {
                     get: { liveFilter.updatesAutomatically },
                     set: { filterManager.setFilterList(liveFilter.id, updatesAutomatically: $0) }
                 ))
+                .toggleStyle(.switch)
             }
             SiteScopeEditor(
                 title: "Apply on", selectedSites: liveFilter.selectedSites, excludedSites: liveFilter.excludedSites,
```

---

### Incident Patch 8: `80fd5ffc` (2026-10-04)
**Commit Message**: fix(settings): Drop ellipses from Reset and Restart

They open a plain confirmation, not more input (#931).

**File**: `wBlock/SettingsView.swift` (modified, +2/-2)
```diff
@@ -763,7 +763,7 @@ struct SettingsView: View {
         Section {
             #if os(macOS)
             CompatibleLabeledContent {
-                Button("Reset…", role: .destructive) { showingResetOrderingConfirmation = true }
+                Button("Reset", role: .destructive) { showingResetOrderingConfirmation = true }
                     .buttonStyle(.bordered)
             } label: {
                 rowLabel(
@@ -772,7 +772,7 @@ struct SettingsView: View {
                 )
             }
             CompatibleLabeledContent {
-                Button(isRestarting ? "Restarting…" : "Restart…", role: .destructive) {
+                Button(isRestarting ? "Restarting…" : "Restart", role: .destructive) {
                     showingRestartConfirmation = true
                 }
                 .buttonStyle(.bordered)
```

**File**: `wBlock/wBlockApp.swift` (modified, +1/-1)
```diff
@@ -127,7 +127,7 @@ struct wBlockApp: App {
         #if os(macOS)
         .commands {
             CommandGroup(after: .appInfo) {
-                Button("Restart Onboarding…") {
+                Button("Restart Onboarding") {
                     showingRestartConfirmation = true
                 }
             }
```

---

### Incident Patch 9: `304a78c0` (2026-10-04)
**Commit Message**: fix(ios): Keep both onboarding presenters attached across size classes

Branching on the size class swapped the whole view tree when Stage Manager crossed compact width, and the Apply sheet hosted there came back with no dimming (#923).

**File**: `wBlock/ContentView.swift` (modified, +15/-6)
```diff
@@ -1074,22 +1074,31 @@ struct FilterRowView: View {
 #if os(iOS)
 /// Size class rather than idiom decides the presentation, so the regular-width
 /// inner display of iPhone Duo gets the sheet iPad already uses.
+/// Onboarding is a sheet in regular width and full screen in compact width.
+/// Both presenters stay attached and only their bindings follow the size class.
+/// Branching on the size class swapped the whole view tree when Stage Manager
+/// crossed the compact width, and the Apply sheet hosted on that tree came back
+/// with no dimming behind it (#923).
 private struct OnboardingPresentationModifier: ViewModifier {
     @Binding var isPresented: Bool
     let filterManager: AppFilterManager
     @Environment(\.horizontalSizeClass) private var horizontalSizeClass
 
-    @ViewBuilder
     func body(content: Content) -> some View {
-        if horizontalSizeClass == .regular {
-            content.sheet(isPresented: $isPresented) {
+        content
+            .sheet(isPresented: presented(when: true)) {
                 OnboardingView(filterManager: filterManager)
             }
-        } else {
-            content.fullScreenCover(isPresented: $isPresented) {
+            .fullScreenCover(isPresented: presented(when: false)) {
                 OnboardingView(filterManager: filterManager)
             }
-        }
+    }
+
+    private func presented(when regular: Bool) -> Binding<Bool> {
+        Binding(
+            get: { isPresented && (horizontalSizeClass == .regular) == regular },
+            set: { if !$0 { isPresented = false } }
+        )
     }
 }
 #endif
```

---

### Incident Patch 10: `56f36538` (2026-10-04)
**Commit Message**: fix(filters): Put the recommended checkmark before the flags

Rows with and without a checkmark now line their flags up (#931).

**File**: `wBlock/ContentView.swift` (modified, +3/-3)
```diff
@@ -954,14 +954,14 @@ struct FilterRowView: View {
         HStack(spacing: 0) {
             VStack(alignment: .leading, spacing: 4) {
                 HStack(spacing: 6) {
-                    if let flags = filter.flagEmojis {
-                        Text(flags).accessibilityHidden(true)
-                    }
                     if filter.category == .foreign, ForeignFilterOrganizer.isRecommended(filter) {
                         Image(systemName: "checkmark.circle")
                             .foregroundStyle(Color.accentColor)
                             .accessibilityLabel(Text("Recommended"))
                     }
+                    if let flags = filter.flagEmojis {
+                        Text(flags).accessibilityHidden(true)
+                    }
                     Text(filter.localizedDisplayName)
                         .fontWeight(.medium)
                         .foregroundStyle(.primary)
```

---

### Incident Patch 11: `2aded4c3` (2026-10-04)
**Commit Message**: fix(regional): Rename Sámi, add Malay to AdBlockID, recommend Estonian

Slovenian List has not changed since November 2024 and CERT.PL's list sits almost entirely inside KAD, so both retire into custom subscriptions for anyone who had them on (#931).

**File**: `wBlock/FilterListLoader.swift` (modified, +4/-15)
```diff
@@ -102,6 +102,8 @@ class FilterListLoader {
         "raw.githubusercontent.com/MasterKia/PersianBlocker/main/PersianBlocker.txt",  // Persian Blocker, maintainer passed away (#921)
         "raw.githubusercontent.com/AnXh3L0/blocklist/master/albanian-easylist-addition/Albania.txt",  // Adblock List for Albania and Kosovo, unmaintained (#921)
         "raw.githubusercontent.com/lonum1rus/Raajje-AdList/master/filter.txt",  // Raajje AdList, unmaintained (#921)
+        "raw.githubusercontent.com/betterwebleon/slovenian-list/master/filters.txt",  // Slovenian List, unmaintained since 2024 (#931)
+        "hole.cert.pl/domains/",  // CERT.PL's Warning List, almost entirely inside KAD (#931)
     ]
 
     static func isRetiredBuiltIn(_ filter: FilterList) -> Bool {
@@ -381,7 +383,7 @@ class FilterListLoader {
                         "https://raw.githubusercontent.com/realodix/AdBlockID/main/dist/adblockid.adfl.txt"
                 )!, category: .foreign,
                 description: "Additional filter list for websites in Indonesian.",
-                languages: ["id"], trustLevel: "high"),
+                languages: ["id", "ms"], trustLevel: "high"),
             FilterList(
                 id: UUID(), name: "AdGuard Chinese filter",
                 url: URL(
@@ -522,7 +524,7 @@ class FilterListLoader {
             FilterList(
                 id: UUID(), name: "Estonian List", url: URL(string: "https://adblock.ee/list.txt")!,
                 category: .foreign, description: "Filter for ad blocking on Estonian sites.",
-                languages: ["et"], trustLevel: "low"),
+                languages: ["et"], trustLevel: "high"),
             FilterList(
                 id: UUID(), name: "Frellwit's Swedish Filter",
                 url: URL(
@@ -569,13 +571,6 @@ class FilterListLoader {
                 description:
                     "Filter that protects against various types of scams in the Polish network, such as mass text messaging, fake online stores, etc.",
                 languages: ["pl"], trustLevel: "high"),
-            FilterList(
-                id: UUID(), name: "CERT.PL's Warning List",
-                url: URL(string: "https://hole.cert.pl/domains/v2/domains_ublock.txt")!,
-                category: .foreign,
-                description:
-                    "CERT Polska's list of dangerous domains that impersonate real sites to steal data or money.",
-                languages: ["pl"], trustLevel: "low"),
             FilterList(
                 id: UUID(), name: "Latvian List",
                 url: URL(
@@ -613,12 +608,6 @@ class FilterListLoader {
                 )!, category: .foreign,
                 description: "Additional filter list for websites in Polish.", languages: ["pl"],
                 trustLevel: "high"),
-            FilterList(
-                id: UUID(), name: "Slovenian List",
-                url: URL(
-                    string: "https://raw.githubusercontent.com/betterwebleon/slovenian-list/master/filters.txt")!,
-                category: .foreign, description: "Additional filter list for websites in Slovenian.",
-                languages: ["sl"], trustLevel: "high"),
             FilterList(
                 id: UUID(), name: "road-block light",
                 url: URL(
```

**File**: `wBlock/LocalizationHelpers.swift` (modified, +10/-3)
```diff
@@ -9,6 +9,13 @@ import Foundation
 import wBlockCoreService
 
 extension Locale {
+    /// Display name for a regional language code. The Nordic list covers every
+    /// Sámi language, but ICU names `se` North Sámi, so it gets the umbrella name.
+    func regionalLanguageName(for code: String) -> String? {
+        if code.lowercased() == "se" { return NSLocalizedString("Sámi", comment: "Language name") }
+        return localizedString(forLanguageCode: code)
+    }
+
     static var appCurrent: Locale {
         guard let preferredLocalization = Bundle.main.preferredLocalizations.first else {
             return .autoupdatingCurrent
@@ -146,7 +153,7 @@ enum ForeignFilterOrganizer {
             return LocalizedStrings.text("Regional", comment: "Filter list category")
         }
 
-        return Locale.appCurrent.localizedString(forLanguageCode: languageCode) ?? languageCode.uppercased()
+        return Locale.appCurrent.regionalLanguageName(for: languageCode) ?? languageCode.uppercased()
     }
 }
 
@@ -208,12 +215,12 @@ enum LocalizedFormatting {
 extension FilterList {
     func localizedLanguageNames(locale: Locale = .appCurrent) -> [String] {
         Set(languages.map { $0.lowercased() }).map {
-            locale.localizedString(forLanguageCode: $0) ?? $0.uppercased()
+            locale.regionalLanguageName(for: $0) ?? $0.uppercased()
         }.sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
     }
 
     func matchesLanguage(_ query: String, locale: Locale) -> Bool {
-        let nativeNames = languages.compactMap { Locale(identifier: $0).localizedString(forLanguageCode: $0) }
+        let nativeNames = languages.compactMap { Locale(identifier: $0).regionalLanguageName(for: $0) }
         return (languages + nativeNames + localizedLanguageNames(locale: locale)).contains {
             $0.localizedCaseInsensitiveContains(query)
         }
```

**File**: `wBlock/RegionalLanguagePickerView.swift` (modified, +2/-1)
```diff
@@ -28,6 +28,7 @@ struct RegionalLanguageOption: Identifiable, Hashable {
     var nativeName: String {
         // ICU does not provide a native display name for Montenegrin.
         if code == "cnr" { return String(localized: "crnogorski") }
+        if code == "se" { return String(localized: "sámegiella") }
         return Locale(identifier: code).localizedString(forLanguageCode: code) ?? name
     }
 
@@ -65,7 +66,7 @@ struct RegionalLanguageOption: Identifiable, Hashable {
         return codes.map { $0.lowercased() }.filter { seen.insert($0).inserted }.map { code in
             RegionalLanguageOption(
                 code: code,
-                name: locale.localizedString(forLanguageCode: code) ?? code,
+                name: locale.regionalLanguageName(for: code) ?? code,
                 flag: FilterList.flag(forLanguage: code) ?? ""
             )
         }
```

**File**: `wBlock/ar.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1152,3 +1152,6 @@ To re-enable these filters, disable other large filters and apply changes again.
 "Languages" = "اللغات";
 "Add Script" = "إضافة سكربت";
 "Paste or type filter rules." = "الصق قواعد التصفية أو اكتبها.";
+
+"Sámi" = "السامية";
+"sámegiella" = "sámegiella";
```

**File**: `wBlock/de.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1152,3 +1152,6 @@ Um diese Filter wieder zu aktivieren, deaktiviere andere große Filter und wende
 "Languages" = "Sprachen";
 "Add Script" = "Skript hinzufügen";
 "Paste or type filter rules." = "Filterregeln einfügen oder eingeben.";
+
+"Sámi" = "Samisch";
+"sámegiella" = "sámegiella";
```

**File**: `wBlock/el.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1152,3 +1152,6 @@ To re-enable these filters, disable other large filters and apply changes again.
 "Languages" = "Γλώσσες";
 "Add Script" = "Προσθήκη σεναρίου";
 "Paste or type filter rules." = "Επικολλήστε ή πληκτρολογήστε κανόνες φίλτρου.";
+
+"Sámi" = "Σάμι";
+"sámegiella" = "sámegiella";
```

**File**: `wBlock/en.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1161,3 +1161,6 @@ To re-enable these filters, disable other large filters and apply changes again.
 "Languages" = "Languages";
 "Add Script" = "Add Script";
 "Paste or type filter rules." = "Paste or type filter rules.";
+
+"Sámi" = "Sámi";
+"sámegiella" = "sámegiella";
```

**File**: `wBlock/es.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -1152,3 +1152,6 @@ Para volver a activarlos, desactiva otros filtros grandes y aplica los cambios d
 "Languages" = "Idiomas";
 "Add Script" = "Añadir script";
 "Paste or type filter rules." = "Pega o escribe reglas de filtro.";
+
+"Sámi" = "sami";
+"sámegiella" = "sámegiella";
```

---

### Incident Patch 12: `16e7639a` (2026-10-03)
**Commit Message**: fix(userscripts): keep deleted scripts deleted on rebase

- Add `UserScriptPersistence.rebase` to merge a stale snapshot onto disk.

- Skip an ID that is in the baseline but missing from disk. Another writer deleted it.

- Insert only IDs that are new to the snapshot.

- Compute explicit enable changes against the baseline.

- Use `rebase` in `mergePersistedChanges` instead of the inline merge.

**File**: `scripts/test_userscript_persistence_race.swift` (modified, +10/-0)
```diff
@@ -61,6 +61,16 @@ struct UserScriptPersistenceRaceTests {
             fatalError("genuinely new ID was not inserted")
         }
 
+        let disabledB = record("B", false, "old B")
+        let staleSnapshot = UserScriptPersistence.rebase(
+            persisted: [b],
+            incoming: [a, disabledB, c],
+            baseline: [a, b]
+        )
+        guard staleSnapshot.map(\.id) == ["B", "C"],
+              staleSnapshot.first?.isEnabled == false
+        else { fatalError("stale snapshot rebase resurrected a deleted ID or lost an enable change") }
+
         let remoteX = "https://example.com/scripts/x.user.js"
         let persistedRemote = record(
             "remote-A", false, "persisted X", url: "HTTPS://EXAMPLE.COM:443/scripts/x.user.js#old"
```

**File**: `wBlockCoreService/ProtobufDataManager.swift` (modified, +5/-6)
```diff
@@ -270,12 +270,11 @@ private func mergePersistedChanges(
         deletedIDs: explicitlyDeletedFilterIDs
     )
 
-    var explicitEnabledStates: [String: Bool] = [:]
-    let previousScriptsByID = Dictionary(uniqueKeysWithValues: previous.userScripts.map { ($0.id, $0) })
-    for script in snapshot.userScripts where previousScriptsByID[script.id]?.isEnabled != script.isEnabled {
-        explicitEnabledStates[script.id] = script.isEnabled
-    }
-    snapshot.userScripts = UserScriptPersistence.merge(persisted: persisted.userScripts, incoming: snapshot.userScripts, explicitEnabledStates: explicitEnabledStates)
+    snapshot.userScripts = UserScriptPersistence.rebase(
+        persisted: persisted.userScripts,
+        incoming: snapshot.userScripts,
+        baseline: previous.userScripts
+    )
 
     var whitelist = snapshot.whitelist
     mergeStringSet(
```

**File**: `wBlockCoreService/UserScriptPersistence.swift` (modified, +20/-0)
```diff
@@ -69,6 +69,26 @@ enum UserScriptPersistence {
         return result
     }
 
+    /// Rebases an in-memory snapshot onto disk. An ID in `baseline` but missing
+    /// from `persisted` was deleted by another writer and must stay deleted.
+    static func rebase(
+        persisted: [Wblock_Data_UserScriptData],
+        incoming: [Wblock_Data_UserScriptData],
+        baseline: [Wblock_Data_UserScriptData]
+    ) -> [Wblock_Data_UserScriptData] {
+        let baselineByID = Dictionary(baseline.map { ($0.id, $0) }, uniquingKeysWith: { _, latest in latest })
+        var explicitEnabledStates: [String: Bool] = [:]
+        for script in incoming where baselineByID[script.id]?.isEnabled != script.isEnabled {
+            explicitEnabledStates[script.id] = script.isEnabled
+        }
+        return merge(
+            persisted: persisted,
+            incoming: incoming,
+            explicitEnabledStates: explicitEnabledStates,
+            allowedInsertIDs: Set(incoming.map(\.id)).subtracting(baselineByID.keys)
+        )
+    }
+
     static func merge(
         persisted: [Wblock_Data_UserScriptData],
         incoming: [Wblock_Data_UserScriptData],
```

---

### Incident Patch 13: `b7f071e8` (2026-10-03)
**Commit Message**: Merge main into German translation fixes

Resolve conflicts with main and fix a stray ASCII quote that broke the strings file, plus two small wording typos.

**File**: `extension-src/background.js` (modified, +11/-5)
```diff
@@ -26682,8 +26682,7 @@ function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e =
     if (message && frameActions.has(message.action)) {
       // Content code never chooses its origin or top-frame status. This does
       // not authenticate individual installed scripts within the content world.
-      if (!sender || !sender.tab || !Number.isSafeInteger(sender.tab.id)
-          || !Number.isSafeInteger(sender.frameId) || sender.frameId < 0
+      if (!sender || !Number.isSafeInteger(sender.frameId) || sender.frameId < 0
           || typeof sender.url !== "string" || !/^https?:\/\//.test(sender.url)) {
         return {ok:false, error:"Userscript request requires a verified frame"};
       }
@@ -27208,10 +27207,17 @@ function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e =
     //
     // In this case we fallback to using the content script to apply rules.
     // The downside here is that the content script cannot override website's
-    // CSPs.
-    if (!blankFrame) {
+    // CSPs. A sender without a tab (e.g. a page Safari loads before it joins a
+    // tab) has no injection target either, so it takes the same path.
+    if (!blankFrame && tabId) {
       if (!fromCache || !(cachedBlockingState.disabled || cachedBlockingState.paused)) {
-        await backgroundScript.applyConfiguration(tabId, frameId, configuration);
+        // Injection may have partly landed; an error here would make the
+        // content script retry and inject twice.
+        try {
+          await backgroundScript.applyConfiguration(tabId, frameId, configuration);
+        } catch (error) {
+          wBlockLogger.error('Failed to apply configuration for ', url, String(error && error.message ? error.message : error));
+        }
       }
     } else {
       // Pass precompiled scriptlet source to the content script. The content
```

**File**: `extension-src/content.js` (modified, +19/-5)
```diff
@@ -6205,6 +6205,7 @@ function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e =
    *    captured events.
    */
   let initializationStatePromise;
+  const INIT_RETRY_DELAYS_MS = [250, 1000, 3000];
   const stateFromInitResponse = response => {
     if (response && response.state === "error") {
       return Promise.resolve(true);
@@ -6229,11 +6230,24 @@ function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e =
     const message = {
       type: MessageType.InitContentScript
     };
-    const configPromise = browser.runtime.sendMessage(message).catch(error => ({
-      type: MessageType.InitContentScript,
-      state: "error",
-      error: String(error && error.message ? error.message : error)
-    }));
+    // A failed lookup (native timeout, background waking up) is not a
+    // disabled site; retry it so the document still gets its rules.
+    const requestInitialization = async () => {
+      for (let attempt = 0; ; attempt += 1) {
+        const response = await browser.runtime.sendMessage(message).catch(error => ({
+          type: MessageType.InitContentScript,
+          state: "error",
+          error: String(error && error.message ? error.message : error)
+        }));
+        if (!(response && response.state === "error")
+          || attempt >= INIT_RETRY_DELAYS_MS.length
+          || cloudflareChallengeContext) {
+          return response;
+        }
+        await new Promise(resolve => setTimeout(resolve, INIT_RETRY_DELAYS_MS[attempt]));
+      }
+    };
+    const configPromise = requestInitialization();
     initializationStatePromise = configPromise.then(stateFromInitResponse);
     const response = await configPromise;
     if (await initializationStatePromise) return;
```

**File**: `scripts/run-ci-tests.sh` (modified, +1/-0)
```diff
@@ -174,6 +174,7 @@ compile_core_test filter-list-setup scripts/test_filter_list_setup.swift wBlock/
 compile_core_test apply-baseline-acknowledgement scripts/test_apply_baseline_acknowledgement.swift \
   wBlock/ApplyFilterConfiguration.swift
 compile_core_test filter-list-site-exclusion scripts/test_filter_list_site_exclusion.swift
+compile_core_test site-exclusion-ignore-segment scripts/test_site_exclusion_ignore_segment.swift
 compile_core_test userscript-pattern-budget scripts/test_userscript_pattern_budget.swift
 compile_core_test userscript-duplicates scripts/test_userscript_duplicates.swift \
   wBlock/CloudSyncUserScriptSync.swift \
```

**File**: `scripts/test_filter_list_validation.swift` (modified, +7/-0)
```diff
@@ -152,6 +152,13 @@ struct FilterListValidationTests {
                 == "||a.example^\n||b.example^",
             "expected hosts entries to become domain rules"
         )
+        precondition(
+            FilterListContentProcessing.normalizedContent(from: "! Title: Domains\nAds.example\n\nb.example")
+                == "! Title: Domains\n||ads.example^\n\n||b.example^"
+                && FilterListContentProcessing.normalizedContent(from: "||a.example^\n_werbung.php")
+                == "||a.example^\n_werbung.php",
+            "expected only domain-only lists to become domain rules"
+        )
         precondition(
             FilterListMetadataParser.parse(from: "# Note: prose\n# Title: Hosts").title == "Hosts",
             "expected # Title headers to be read"
```

**File**: `scripts/test_issue_918_remove_attr.swift` (modified, +6/-0)
```diff
@@ -17,6 +17,12 @@ struct Main {
              "example.com#@%#//scriptlet('remove-class', 'a|b', 'div[data-x=\\'y\\']')"),
             ("example.com##a:remove-attr(/^data-/)", "example.com##a:remove-attr(/^data-/)"),
             ("example.com###answers-nav-button", "example.com###answers-nav-button"),
+            // Unknown pseudo-classes would poison the merged selector; they run as extended CSS.
+            ("example.com##div:made-up(x)", "example.com#?#div:made-up(x)"),
+            ("example.com#@#div:upward(2)", "example.com#@?#div:upward(2)"),
+            ("example.com##div:has(> a):not(.b)", "example.com##div:has(> a):not(.b)"),
+            ("example.com##a[title=':odd(x)']", "example.com##a[title=':odd(x)']"),
+            ("example.com##li:nth-child(2n+1)", "example.com##li:nth-child(2n+1)"),
         ]
         for (input, expected) in cases {
             let output = FilterRuleAnalysis.adGuardEquivalent(input)
```

**File**: `scripts/test_list_display_order_sync.swift` (modified, +5/-0)
```diff
@@ -73,5 +73,10 @@ struct ListDisplayOrderSyncTests {
         }
         precondition(final.value == ["b", "a"], "the final payload must include the mid-build reorder")
         precondition(final.value != ["a", "b"], "the reorder must differ from the remote payload")
+
+        // Two rows sharing an ID must not exhaust the moved order and trap.
+        let shared = Item(key: "x")
+        let duplicated = [shared, deviceB[0], shared]
+        precondition(!ListDisplayOrder.merging(["x", "a"], into: duplicated, key: key).isEmpty)
     }
 }
```

**File**: `scripts/test_protobuf_reliability.swift` (modified, +20/-0)
```diff
@@ -11,6 +11,7 @@ struct ProtobufReliabilityTests {
         defer { try? FileManager.default.removeItem(at: root) }
 
         await testFilterAutomaticUpdates(root: root.appendingPathComponent("filter-updates"))
+        await testCustomRegionalLanguages(root: root.appendingPathComponent("custom-languages"))
         await testBackgroundMetadataPreservesConfiguration(root: root.appendingPathComponent("background-metadata"))
         await testUnchangedMetadataPreservesForegroundDownload(root: root.appendingPathComponent("untouched-metadata"))
         await testSourceTimestampOwnership(root: root.appendingPathComponent("source-timestamp"))
@@ -70,6 +71,25 @@ struct ProtobufReliabilityTests {
                "a stale writer must not resurrect a removed subscription")
     }
 
+    private static func testCustomRegionalLanguages(root: URL) async {
+        let suite = "test.wblock.custom-languages.\(UUID().uuidString)"
+        let defaults = UserDefaults(suiteName: suite)!
+        defer { defaults.removePersistentDomain(forName: suite) }
+        let custom = FilterList(name: "Custom", url: URL(string: "https://example.com/fa.txt")!,
+                                category: .foreign, isCustom: true, isSelected: true, languages: ["fa", "ps"])
+        let builtIn = FilterList(name: "Built-in", url: URL(string: "https://example.com/de.txt")!,
+                                 category: .foreign, isSelected: true, languages: ["de"])
+        let writer = await makeManager(root: root, standard: defaults, group: defaults)
+        await writer.loadData()
+        await writer.updateFilterLists([custom, builtIn])
+        let reloaded = await makeManager(root: root, standard: defaults, group: defaults)
+        await reloaded.loadData()
+        expect(reloaded.getFilterLists().first { $0.id == custom.id }?.languages == ["fa", "ps"],
+               "custom regional languages must persist across launches")
+        expect(reloaded.getFilterLists().first { $0.id == builtIn.id }?.languages == [],
+               "built-in languages stay catalog-owned rather than stored")
+    }
+
     private static func testBackgroundMetadataPreservesConfiguration(root: URL) async {
         let suite = "test.wblock.filter-metadata.\(UUID())"
         let defaults = UserDefaults(suiteName: suite)!
```

**File**: `scripts/test_site_exclusion_ignore_segment.swift` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+import Foundation
+import wBlockCoreService
+
+// A large list with a site exclusion compiled ~99k domain-conditioned rules,
+// which killed WebKit's compiler (#925). Its unscoped blocks now precede one
+// ignore rule; other lists in the blocker must still block on that site.
+@main
+struct SiteExclusionIgnoreSegmentTests {
+    static func main() throws {
+        let groupIdentifier = "group.wblock.test.925.\(UUID().uuidString.prefix(8))"
+        let container = FileManager.default.temporaryDirectory
+            .appendingPathComponent("wblock-925-\(UUID().uuidString)", isDirectory: true)
+        try FileManager.default.createDirectory(at: container, withIntermediateDirectories: true)
+        defer { try? FileManager.default.removeItem(at: container) }
+
+        let target = ContentBlockerTargetManager.shared.allTargets(forPlatform: .macOS)[0]
+        var excluded = FilterList(name: "excluded", url: URL(string: "https://example.com/a.txt")!, category: .privacy, isSelected: true)
+        excluded.excludedSites = ["example.com"]
+        let other = FilterList(name: "other", url: URL(string: "https://example.com/b.txt")!, category: .privacy, isSelected: true)
+        let unscoped = (0..<2000).map { "||tracker\($0).net^" }.joined(separator: "\n")
+        try (unscoped + "\n||scoped.net^$domain=news.org\n@@||allowed.net^\n")
+            .write(to: container.appendingPathComponent(ContentBlockerIncrementalCache.localFilename(for: excluded)), atomically: true, encoding: .utf8)
+        try "||other.net^\n".write(to: container.appendingPathComponent(ContentBlockerIncrementalCache.localFilename(for: other)), atomically: true, encoding: .utf8)
+
+        let ordered = ContentBlockerMappingService.orderedForCompilation([excluded, other])
+        _ = try ContentBlockerService.compileTargetRules(
+            filters: [excluded, other], orderedSelectedFilters: ordered,
+            affinitySnapshot: SafariContentBlockerAffinityProcessor.snapshot(for: ordered, containerURL: container),
+            targetInfo: target, allTargets: [target], disabledSites: [], extraRulesText: nil,
+            groupIdentifier: groupIdentifier, containerURL: container
+        )
+        let data = try Data(contentsOf: container.appendingPathComponent(target.rulesFilename))
+        let rules = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] ?? []
+
+        func blocked(_ url: String, on host: String) -> Bool {
+            var state = false
+            for rule in rules {
+                let trigger = rule["trigger"] as? [String: Any] ?? [:]
+                guard let filter = trigger["url-filter"] as? String,
+                      url.range(of: filter, options: .regularExpression) != nil else { continue }
+                let matches: ([String]) -> Bool = { $0.contains { d in
+                    let site = d.hasPrefix("*") ? String(d.dropFirst()) : d
+                    return host == site || host.hasSuffix("." + site)
+                } }
+                if let only = trigger["if-domain"] as? [String], !matches(only) { continue }
+                if let except = trigger["unless-domain"] as? [String], matches(except) { continue }
+                switch (rule["action"] as? [String: Any])?["type"] as? String {
+                case "block": state = true
+                case "ignore-previous-rules": state = false
+                default: break
+                }
+            }
+            return state
+        }
+
+        let conditioned = rules.filter { (($0["trigger"] as? [String: Any])?["unless-domain"]) != nil }.count
+        check(conditioned < 10, "unscoped rules carry no per-rule negation: \(conditioned)")
+        check(blocked("https://tracker7.net/x.js", on: "news.org"), "excluded list still blocks elsewhere")
+        check(!blocked("https://tracker7.net/x.js", on: "www.example.com"), "excluded list stops on the excluded site")
+        check(!blocked("https://scoped.net/x.js", on: "example.com") && blocked("https://scoped.net/x.js", on: "news.org"), "scoped rules keep their scope")
+        check(blocked("https://other.net/x.js", on: "example.com"), "other lists still block on the excluded site")
+        print("PASS: site exclusions compile as one ignore rule")
+    }
+
+    private static func check(_ condition: Bool, _ message: String) {
+        guard condition else {
+            FileHandle.standardError.write(Data("FAIL: \(message)\n".utf8))
+            exit(1)
+        }
+    }
+}
```

---

### Incident Patch 14: `56dde8c0` (2026-10-03)
**Commit Message**: fix(regional): Use CERT.PL's 30-day list and anchor domain-only lists

domains_adblock.txt is the whole register (~127k rules); uBO ships
domains_ublock.txt, the last 30 days (~17k). Its lines are bare
hostnames, which Safari matched as URL substrings, so lists made only of
hostnames now become ||host^ rules (#882).

**File**: `scripts/test_filter_list_validation.swift` (modified, +7/-0)
```diff
@@ -152,6 +152,13 @@ struct FilterListValidationTests {
                 == "||a.example^\n||b.example^",
             "expected hosts entries to become domain rules"
         )
+        precondition(
+            FilterListContentProcessing.normalizedContent(from: "! Title: Domains\nAds.example\n\nb.example")
+                == "! Title: Domains\n||ads.example^\n\n||b.example^"
+                && FilterListContentProcessing.normalizedContent(from: "||a.example^\n_werbung.php")
+                == "||a.example^\n_werbung.php",
+            "expected only domain-only lists to become domain rules"
+        )
         precondition(
             FilterListMetadataParser.parse(from: "# Note: prose\n# Title: Hosts").title == "Hosts",
             "expected # Title headers to be read"
```

**File**: `wBlock/FilterListLoader.swift` (modified, +1/-1)
```diff
@@ -571,7 +571,7 @@ class FilterListLoader {
                 languages: ["pl"], trustLevel: "high"),
             FilterList(
                 id: UUID(), name: "CERT.PL's Warning List",
-                url: URL(string: "https://hole.cert.pl/domains/v2/domains_adblock.txt")!,
+                url: URL(string: "https://hole.cert.pl/domains/v2/domains_ublock.txt")!,
                 category: .foreign,
                 description:
                     "CERT Polska's list of dangerous domains that impersonate real sites to steal data or money.",
```

**File**: `wBlockCoreService/Utils.swift` (modified, +13/-4)
```diff
@@ -174,15 +174,24 @@ public enum FilterListContentProcessing {
     }
 
     /// Drops unsupported `!#` directives and rewrites hosts-file entries
-    /// (`0.0.0.0 ads.example`) as `||ads.example^` rules.
+    /// (`0.0.0.0 ads.example`) and the lines of domain-only lists
+    /// (`ads.example`) as `||ads.example^` rules.
     public static func normalizedContent(
         from content: String,
         onStrip: ((String) -> Void)? = nil
     ) -> String {
+        let lines = content.split(omittingEmptySubsequences: false, whereSeparator: { $0.isNewline })
+            .map { ($0, $0.trimmingCharacters(in: .whitespacesAndNewlines)) }
+        // Converted as-is, a bare hostname is a substring match anywhere in the URL.
+        // Only anchor it when the whole list is hostnames, since ABP lists use
+        // hostname-shaped substrings such as `_werbung.php` on purpose.
+        let isDomainList = lines.contains { matches(hostsHostname, $0.1) }
+            && lines.allSatisfy { $0.1.isEmpty || "!#[".contains($0.1.first!) || matches(hostsHostname, $0.1) }
         var result: [String] = []
-        for line in content.split(omittingEmptySubsequences: false, whereSeparator: { $0.isNewline }) {
-            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
-            if let hosts = hostsEntryHosts(trimmed) {
+        for (line, trimmed) in lines {
+            if isDomainList, matches(hostsHostname, trimmed) {
+                result.append("||\(trimmed.lowercased())^")
+            } else if let hosts = hostsEntryHosts(trimmed) {
                 result += hosts.map { "||\($0)^" }
             } else if FilterDirectivePolicy.shouldStripUnsupportedDirective(trimmed) {
                 onStrip?(String(trimmed.prefix(60)))
```

---

### Incident Patch 15: `91a96a1b` (2026-10-03)
**Commit Message**: fix: prevent crashes from mid-save deletes, duplicate list IDs, and bad dates

**File**: `scripts/test_list_display_order_sync.swift` (modified, +5/-0)
```diff
@@ -73,5 +73,10 @@ struct ListDisplayOrderSyncTests {
         }
         precondition(final.value == ["b", "a"], "the final payload must include the mid-build reorder")
         precondition(final.value != ["a", "b"], "the reorder must differ from the remote payload")
+
+        // Two rows sharing an ID must not exhaust the moved order and trap.
+        let shared = Item(key: "x")
+        let duplicated = [shared, deviceB[0], shared]
+        precondition(!ListDisplayOrder.merging(["x", "a"], into: duplicated, key: key).isEmpty)
     }
 }
```

**File**: `wBlock/CloudSyncManager.swift` (modified, +1/-0)
```diff
@@ -997,6 +997,7 @@ final class CloudSyncManager: ObservableObject {
             selectionChanged: Bool = false,
             nonSelectionChanged: Bool = false
         ) async {
+            let filterLists = filterManager?.deduplicateFilterIDs(filterLists) ?? filterLists
             if let filterManager {
                 filterManager.filterLists = filterLists
                 if nonSelectionChanged {
```

**File**: `wBlock/ListDisplayOrder.swift` (modified, +1/-1)
```diff
@@ -74,7 +74,7 @@ enum ListDisplayOrder {
         let moved = moved.filter { liveIDs.contains($0.id) }
         let movedIDs = Set(moved.map(\.id))
         var iterator = moved.makeIterator()
-        let ids = filters.map { movedIDs.contains($0.id) ? iterator.next()!.id : $0.id }
+        let ids = filters.map { movedIDs.contains($0.id) ? iterator.next()?.id ?? $0.id : $0.id }
         return (try? JSONEncoder().encode(ids)) ?? Data()
     }
 }
```

**File**: `wBlock/SourceEditorSheet.swift` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@ struct SourceEditorSheet: View {
             HStack(spacing: 12) {
                 Button("Cancel", action: cancel)
                     .keyboardShortcut(.cancelAction)
+                    .disabled(isSaving)
                 Text(LocalizedStringKey(title))
                     .font(.headline)
                     .lineLimit(1)
```

**File**: `wBlockCoreService/FilterMetadataPersistence.swift` (modified, +6/-1)
```diff
@@ -1,5 +1,10 @@
 import Foundation
 
+extension Date {
+    /// Whole epoch seconds, or 0 when a corrupt stored date is outside Int64.
+    var epochSeconds: Int64 { Int64(exactly: timeIntervalSince1970.rounded(.towardZero)) ?? 0 }
+}
+
 /// An operation owns only its metadata delta, never configuration or membership.
 enum FilterMetadataPersistence {
     static func merge(_ updates: [FilterList], baseline: [FilterList], into records: inout [Wblock_Data_FilterListData]) {
@@ -24,7 +29,7 @@ enum FilterMetadataPersistence {
                 else { record.clearSourceRuleCount() }
             }
             if update.lastUpdated != original.lastUpdated, let date = update.lastUpdated {
-                record.lastUpdated = Int64(date.timeIntervalSince1970)
+                record.lastUpdated = date.epochSeconds
             }
             if update.uniqueRuleCount != original.uniqueRuleCount {
                 if let count = update.uniqueRuleCount { record.admittedSourceRuleCount = Int32(count) }
```

**File**: `wBlockCoreService/ProtobufDataManager+Extensions.swift` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ extension ProtobufDataManager {
             if let sourceRuleCount = filter.sourceRuleCount {
                 protoFilterList.sourceRuleCount = Int32(sourceRuleCount)
             }
-            protoFilterList.lastUpdated = filter.lastUpdated.map { Int64($0.timeIntervalSince1970) }
+            protoFilterList.lastUpdated = filter.lastUpdated.map(\.epochSeconds)
                 ?? localBaselineByID[protoFilterList.id]?.lastUpdated ?? 0
             protoFilterList.isCustom = shouldPersistCustomFlag(for: filter)
             protoFilterList.userProvidedName = filter.hasUserProvidedName
```

**File**: `wBlockCoreService/UserScriptManager.swift` (modified, +5/-3)
```diff
@@ -3361,14 +3361,15 @@ public class UserScriptManager: ObservableObject {
     }
 
     public func saveEditedContent(for scriptId: UUID, newContent rawNewContent: String) async -> String? {
-        guard let index = indexOfUserScript(withId: scriptId) else { return nil }
+        guard indexOfUserScript(withId: scriptId) != nil else { return nil }
         let newContent: String
         do {
             newContent = try await inlineRemoteStyleImports(in: rawNewContent)
         } catch {
             return (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
         }
-        let existing = userScripts[index]
+        // The script list can change while the imports download; resolve by ID afterward.
+        guard let existing = indexOfUserScript(withId: scriptId).map({ userScripts[$0] }) else { return nil }
         var candidate = existing
         candidate.replaceContentAndParseMetadata(newContent)
         if existing.isUserStyle && !candidate.isUserStyle {
@@ -3400,13 +3401,14 @@ public class UserScriptManager: ObservableObject {
             candidate.compiledStyleBody = style.compiledArtifact?.body
         }
         candidate.lastUpdated = Date()
+        guard let index = indexOfUserScript(withId: scriptId) else { return nil }
         guard writeUserScriptFiles(candidate) else {
             return String(localized: "Couldn't save the edited source.", comment: "Userstyle editor save error")
         }
         userScripts[index] = candidate
         recordScriptMutation(candidate.id)
         await persistUserScriptsNow()
-        logger.info("Saved edited content for \(self.userScripts[index].name)")
+        logger.info("Saved edited content for \(candidate.name)")
         return nil
     }
 
```

#### Recent Merged Pull Requests:
- **PR #930** (2026-10-04): fix(userscripts): keep deleted scripts deleted on rebase (@DisturbedOcean)
- **PR #929** (2026-10-03): Corrections to German translations in de.lproj/Localizable.strings (@cell849)
- **PR #926** (2026-10-03): Rebuild Add sheets with native tabs and forms (@0xCUB3)
- **PR #920** (2026-10-02): Turkish localization updated (@remad0)
- **PR #910** (2026-10-01): Return after native site-setting requests (@dajiaohuang)
- **PR #909** (2026-10-01): Explain userscript enabled state sync (@dajiaohuang)
- **PR #908** (closed): Import bulk filter URLs from a text file (@dajiaohuang)
- **PR #907** (2026-10-01): Expand regional filters in enabled-only view (@dajiaohuang)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
