# Forensic Learning Record (Deep Inspection): momenbasel/PureMac

> **Canonical Artifact**: `07_PROJECT_LEARNING/momenbasel-puremac-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/momenbasel/PureMac](https://github.com/momenbasel/PureMac))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:29:34.879Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `momenbasel/PureMac`
- **Description**: Free, open-source macOS cleaner. CleanMyMac alternative with zero telemetry. Native SwiftUI, scheduled auto-cleaning, Xcode/Homebrew/system cache cleanup. MIT licensed.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6929 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `PureMac/Core/AppConstants.swift`
```
//
//  AppConstants.swift
//  PureMac
//
//  Created by Theo Sementa on 12/04/2026.
//

import Foundation

struct AppConstants {
    
    static let appVersion: String = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0"
    
}

```

### Core Architecture Module: `PureMac/Logic/Utilities/CLI.swift`
```
import Foundation

struct CLI {
    private static let knownCommands: Set<String> = [
        "scan", "disk-info", "list",
        "help", "--help", "-h",
        "version", "--version", "-v",
    ]

    static func isKnownCommand(_ arg: String) -> Bool {
        knownCommands.contains(arg)
    }

    static func run() -> Never {
        let args = Array(CommandLine.arguments.dropFirst())

        guard let command = args.first else {
            printUsage()
            exit(0)
        }

        switch command {
        case "scan":
            handleScan(args: Array(args.dropFirst()))
        case "disk-info":
            handleDiskInfo()
        case "list":
            handleList()
        case "help", "--help", "-h":
            printUsage()
        case "version", "--version", "-v":
            printVersion()
        default:
            printError("Unknown command: \(command)")
            printUsage()
            exit(1)
        }
        exit(0)
    }

    // MARK: - Commands

    private static func handleScan(args: [String]) {
        let json = args.contains("--json")
        let categoryFilter = extractValue(for: "--category", in: args)

        let engine = ScanEngine()
        let categories: [CleaningCategory]

        if let filter = categoryFilter {
            guard let cat = CleaningCategory.scannable.first(where: {
                $0.rawValue.lowercased().replacingOccurrences(of: " ", with: "") ==
                filter.lowercased().replacingOccurrences(of: " ", with: "")
            }) else {
                printError("Unknown category: \(filter)")
                print("Available: \(CleaningCategory.scannable.map(\.rawValue).joined(separator: ", "))")
                exit(1)
            }
            categories = [cat]
        } else {
            categories = CleaningCategory.scannable
        }

        var allResults: [(String, Int, Int64)] = []

        let group = DispatchGroup()
        let queue = DispatchQueue(label: "cli.scan")

        for category in categories {
            group.enter()
            Task {
                let result = await engine.scanCategory(category)
                queue.sync {
                    allResults.append((category.rawValue, result.itemCount, result.totalSize))
                }
                group.leave()
            }
        }
        group.wait()

        if json {
            printJSON(allResults)
        } else {
            printTable(allResults)
        }
    }

    private static func handleDiskInfo() {
        let engine = ScanEngine()
        var info = DiskInfo()
        let group = DispatchGroup()
        group.enter()
        Task {
            info = await engine.getDiskInfo()
            group.leave()
        }
        group.wait()

        print("Disk Usage:")
        print("  Total:     \(info.formattedTotal)")
        print("  Used:      \(info.formattedUsed)")
        print("  Free:      \(info.formattedFree)")
        if info.purgeableSpace > 0 {
            print("  Purgeable: \(info.formattedPurgeable)")
        }
    }

    private static func handleList() {
        let apps = AppInfoFetcher.shared.fetchInstalledApps()
        print("Installed Apps (\(apps.count)):")
        for app in apps {
            let size = ByteCountFormatter.string(fromByteCount: app.size, countStyle: .file)
            print("  \(app.appName.padding(toLength: 35, withPad: " ", startingAt: 0)) \(size.padding(toLength: 12, withPad: " ", startingAt: 0)) \(app.bundleIdentifier)")
        }
    }

    // MARK: - Output

    private static func printTable(_ results: [(String, Int, Int64)]) {
        var totalSize: Int64 = 0
        var totalItems = 0

        print("Category                Items     Size")
        print("----------------------  -----     --------")
        for (name, count, size) in results {
            let sizeStr = ByteCountFormatter.string(fromByteCount: size, countStyle: .file)
            print("\(name.padding(toLength: 22, withPad: " ", startingAt: 0))  \(String(count).padding(toLength: 5, withPad: " ", startingAt: 0))     \(sizeStr)")
            totalSize += size
            totalItems += count
        }
        print("----------------------  -----     --------")
        let totalStr = ByteCountFormatter.string(fromByteCount: totalSize, countStyle: .file)
        print("Total                   \(String(totalItems).padding(toLength: 5, withPad: " ", startingAt: 0))     \(totalStr)")
    }

    private static func printJSON(_ results: [(String, Int, Int64)]) {
        var entries: [String] = []
        for (name, count, size) in results {
            entries.append("    {\"category\": \"\(name)\", \"items\": \(count), \"bytes\": \(size)}")
        }
        print("[\n\(entries.joined(separator: ",\n"))\n]")
    }

    private static func printUsage() {
        print("""
        PureMac CLI

        Usage: puremac <command> [options]

        Commands:
          scan                    Scan all categories
          scan --category <name>  Scan a specific category
          scan --json             Output as JSON
          disk-info               Show disk usage
          list                    List installed apps
          version                 Show version
          help                    Show this help

        Categories:
          \(CleaningCategory.scannable.map(\.rawValue).joined(separator: ", "))
        """)
    }

    private static func printVersion() {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "2.0.0"
        print("PureMac \(version)")
    }

    private static func printError(_ message: String) {
        FileHandle.standardError.write(Data("Error: \(message)\n".utf8))
    }

    private static func extractValue(for flag: String, in args: [String]) -> String? {
        guard let index = args.firstIndex(of: flag), index + 1 < args.count else { return nil }
        return args[index + 1]
    }
}

```

### Core Architecture Module: `PureMac/Logic/Utilities/FileProtection.swift`
```
import Foundation

/// Shared SIP/immutability check used by both ScanEngine (so protected
/// entries never surface as cleanable items) and CleaningEngine (so a
/// protected survivor is reported as "skipped, protected by macOS" instead
/// of a scary removal error).
enum FileProtection {

    /// True when the entry is SIP-protected or immutable: BSD flags carry
    /// SF_RESTRICTED/SF_IMMUTABLE/UF_IMMUTABLE, or the path has the
    /// com.apple.rootless xattr. Deleting these fails even with admin
    /// privileges.
    static func isProtectedFromDeletion(path: String) -> Bool {
        var sb = stat()
        if lstat(path, &sb) == 0 {
            // SF_RESTRICTED (0x00080000) isn't exported by Darwin's Swift
            // overlay, so spell out the literal; the immutable flags are.
            let protectedFlags: UInt32 = 0x0008_0000 | UInt32(SF_IMMUTABLE) | UInt32(UF_IMMUTABLE)
            if sb.st_flags & protectedFlags != 0 {
                return true
            }
        }

        // SIP also marks paths with the com.apple.rootless xattr, which
        // can be present even when st_flags reads 0.
        let bufSize = listxattr(path, nil, 0, XATTR_NOFOLLOW)
        if bufSize > 0 {
            var buffer = [CChar](repeating: 0, count: bufSize)
            let read = listxattr(path, &buffer, bufSize, XATTR_NOFOLLOW)
            if read > 0 {
                let names = Data(bytes: &buffer, count: read)
                    .split(separator: 0)
                    .compactMap { String(data: $0, encoding: .utf8) }
                if names.contains("com.apple.rootless") {
                    return true
                }
            }
        }

        return false
    }
}

```

### Core Architecture Module: `PureMac/Logic/Utilities/FileSize.swift`
```
import Foundation

/// Allocated-size calculation that works for both files and directories.
///
/// `URLResourceValues.totalFileAllocatedSize` does **not** recurse: on a
/// directory URL it returns only the directory inode's own allocation
/// (~96 bytes to a few KB on APFS), not the sum of the bundle's contents.
/// Reading it directly on an `.app` bundle or a support folder is what made
/// items display as a handful of bytes. For directories we enumerate and sum
/// the regular files instead.
enum FileSizeCalculator {
    private static let fileManager = FileManager.default

    /// On-disk allocated size of `url`. Recurses into directories.
    /// Returns `nil` if the item can't be read at all.
    static func size(of url: URL) -> Int64? {
        let values = try? url.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
        // Treat a symlink as a file (size of the link itself), never recursing
        // into its target. `.isDirectoryKey` resolves symlinks, so without this
        // guard a top-level symlink-to-directory would be walked as the target's
        // full tree — inflating the size, escaping the item's real footprint,
        // and mismatching deletion (removeItem deletes only the link). Check
        // isSymbolicLink first so the directory branch only sees real dirs.
        if values?.isSymbolicLink != true, values?.isDirectory == true {
            return directorySize(of: url)
        }
        return fileSize(of: url)
    }

    private static func fileSize(of url: URL) -> Int64? {
        if let values = try? url.resourceValues(forKeys: [.totalFileAllocatedSizeKey]),
           let size = values.totalFileAllocatedSize {
            return Int64(size)
        }
        if let values = try? url.resourceValues(forKeys: [.fileAllocatedSizeKey]),
           let size = values.fileAllocatedSize {
            return Int64(size)
        }
        guard let attrs = try? fileManager.attributesOfItem(atPath: url.path),
              let size = (attrs[.size] as? NSNumber)?.int64Value else { return nil }
        return size
    }

    private static func directorySize(of url: URL) -> Int64 {
        guard let enumerator = fileManager.enumerator(
            at: url,
            includingPropertiesForKeys: [.totalFileAllocatedSizeKey, .fileAllocatedSizeKey, .isRegularFileKey, .isSymbolicLinkKey],
            options: [.skipsHiddenFiles]
        ) else { return 0 }

        var total: Int64 = 0
        for case let fileURL as URL in enumerator {
            if Task.isCancelled { break }
            guard let values = try? fileURL.resourceValues(forKeys: [.totalFileAllocatedSizeKey, .fileAllocatedSizeKey, .isRegularFileKey, .isSymbolicLinkKey]) else { continue }
            // Skip symlinks so we don't double-count or follow links that
            // escape the directory. Only sum regular-file payload.
            if values.isSymbolicLink == true { continue }
            guard values.isRegularFile == true else { continue }
            if let allocated = values.totalFileAllocatedSize {
                total += Int64(allocated)
            } else if let allocated = values.fileAllocatedSize {
                total += Int64(allocated)
            }
        }
        return total
    }
}

```

### Core Architecture Module: `PureMac/Logic/Utilities/Logger.swift`
```
import Foundation
import os

struct LogEntry: Identifiable, Sendable {
    let id = UUID()
    let timestamp = Date()
    let message: String
    let level: LogLevel
    let source: String
}

enum LogLevel: String, Sendable, CaseIterable {
    case debug
    case info
    case warning
    case error

    fileprivate var osLogType: OSLogType {
        switch self {
        case .debug: return .debug
        case .info: return .info
        case .warning: return .default
        case .error: return .error
        }
    }
}

@MainActor
final class Logger: ObservableObject {

    static let shared = Logger()

    @Published private(set) var entries: [LogEntry] = []

    private static let maxEntries = 1000

    private let osLogger: os.Logger

    private init() {
        let subsystem = Bundle.main.bundleIdentifier ?? "com.puremac.app"
        self.osLogger = os.Logger(subsystem: subsystem, category: "general")
    }

    nonisolated func log(_ message: String, level: LogLevel = .info, source: String = #function) {
        osLogger.log(level: level.osLogType, "\(message, privacy: .public)")

        let entry = LogEntry(message: message, level: level, source: source)
        Task { @MainActor [weak self] in
            self?.append(entry)
        }
    }

    private func append(_ entry: LogEntry) {
        entries.append(entry)
        if entries.count > Self.maxEntries {
            entries.removeFirst(entries.count - Self.maxEntries)
        }
    }
}

```

### Core Architecture Module: `PureMac/Logic/Utilities/OrphanSafetyPolicy.swift`
```
import Foundation

enum OrphanSafetyPolicy {
    private static let home = FileManager.default.homeDirectoryForCurrentUser.path

    // Conservative allowlist: only volatile data directories.
    static let allowedRoots: [String] = [
        "\(home)/Library/Caches",
        "\(home)/Library/Logs",
        "\(home)/Library/Saved Application State",
        "\(home)/Library/HTTPStorages",
        "\(home)/Library/WebKit",
        "\(home)/Library/Application Support/CrashReporter",
        "/Library/Caches",
        "/Library/Logs",
    ]

    private static let blockedFragments: [String] = [
        "/Library/Preferences",
        "/Library/PreferencePanes",
        "/Library/Containers",
        "/Library/Group Containers",
        "/Library/Application Scripts",
        "/Library/LaunchAgents",
        "/Library/LaunchDaemons",
        "/Library/PrivilegedHelperTools",
        "/Library/Keychains",
        "/Library/Mail",
        "/Library/Safari",
        "/Library/Messages",
        "/Library/Calendars",
        "/Library/Accounts",
        "/Library/Mobile Documents",
        "/Library/CloudStorage",
    ]

    static func isSafeCandidate(_ url: URL) -> Bool {
        let path = normalizedPath(url)
        let lowerPath = path.lowercased()

        // Belt-and-suspenders: reject any high-risk home dotpath (defined in
        // Conditions.swift). The allowedRoots filter below would catch most
        // of these, but this early block keeps the rule obvious.
        for root in highRiskHomeDotPaths {
            if path == root || path.hasPrefix(root + "/") {
                return false
            }
        }

        // Require the match to land STRICTLY inside the allowed root, not at a
        // sibling like /tmpfoo. Trailing "/" prevents hasPrefix from matching
        // sibling directories whose names merely start with the root name.
        guard allowedRoots.contains(where: { root in
            let rootWithSlash = root.lowercased() + "/"
            return lowerPath.hasPrefix(rootWithSlash)
        }) else {
            return false
        }

        if blockedFragments.contains(where: { lowerPath.contains($0.lowercased()) }) {
            return false
        }

        let name = url.lastPathComponent.lowercased()
        if name.hasPrefix("com.apple.") || name == ".globalpreferences.plist" {
            return false
        }

        return true
    }

    private static func normalizedPath(_ url: URL) -> String {
        let standardized = url.standardizedFileURL
        return standardized.resolvingSymlinksInPath().path
    }
}

```

### Core Architecture Module: `PureMac/Logic/Utilities/ProviderPaths.swift`
```
import Foundation

/// Hard denylist for cloud File Provider state (issue #142).
///
/// iCloud Drive, and every other provider that plugs into FileProvider.framework,
/// keeps a database of what it believes is on disk. Removing a file underneath it
/// with `unlink` does not tell the provider anything, so its snapshot and the
/// filesystem drift apart. `fileproviderctl check` then reports invariants like
/// `is_on_disk_but_not_in_FS_Snapshot`, and Finder copies out of iCloud Drive slow
/// from instant to tens of seconds because every read goes through reconciliation.
/// A user reported exactly this after one cleanup: 513 of 19693 files broken, and
/// the live service rebuilt the inconsistent state ~10s after each repair.
///
/// These directories are implementation detail owned by `bird`, `cloudd`, and
/// `fileproviderd`. They are never junk, they are never safe to reclaim, and no
/// amount of space saved justifies corrupting a user's cloud sync state.
enum ProviderPaths {

    /// Roots that must never be scanned, offered, or deleted. Any path equal to
    /// or beneath one of these is off limits.
    static var deniedRoots: [String] {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        return [
            // iCloud Drive user-visible root and its per-app containers.
            "\(home)/Library/Mobile Documents",
            // Third-party providers (Dropbox, OneDrive, Google Drive, ...).
            "\(home)/Library/CloudStorage",
            // FileProvider framework state and per-provider domains.
            "\(home)/Library/Application Support/FileProvider",
            "\(home)/Library/Application Support/CloudDocs",
            // Provider extension containers.
            "\(home)/Library/Daemon Containers",
            // Live databases, not reclaimable caches, despite living in Caches.
            "\(home)/Library/Caches/CloudKit",
            "\(home)/Library/Caches/com.apple.bird",
            "\(home)/Library/Caches/com.apple.cloudkit",
            "\(home)/Library/Caches/com.apple.cloudd",
            "\(home)/Library/Caches/com.apple.FileProvider",
        ]
    }

    /// True when `path` is inside provider-owned state and must be left alone.
    ///
    /// The check runs against both the literal path and its symlink-resolved
    /// form. That second pass matters: with "Desktop & Documents Folders" sync
    /// enabled, `~/Desktop` and `~/Documents` resolve into
    /// `~/Library/Mobile Documents/com~apple~CloudDocs`, so an innocuous-looking
    /// root can walk straight into iCloud state.
    static func isProviderOwned(_ path: String) -> Bool {
        let candidates = [
            (path as NSString).standardizingPath,
            URL(fileURLWithPath: path).resolvingSymlinksInPath().path,
        ]
        for candidate in candidates {
            // Any component of the form `com~apple~CloudDocs` (or any other
            // provider domain) marks provider territory regardless of location.
            if candidate.contains("com~apple~") { return true }
            for root in deniedRoots where candidate == root || candidate.hasPrefix(root + "/") {
                return true
            }
        }
        return false
    }
}

```

### Core Architecture Module: `PureMac/Logic/Utilities/SimulatorRuntimeSupport.swift`
```
import Foundation

/// Parsing + selection policy for `xcrun simctl runtime`.
/// Kept free of Process I/O so unit tests can cover the scan/clean contract
/// without talking to CoreSimulator.
enum SimulatorRuntimeSupport {
    static let xcrunPath = "/usr/bin/xcrun"
    static let xcodeSelectPath = "/usr/bin/xcode-select"
    static let missingXcrunMessage =
        "Xcode command-line tools not found — install Xcode or run xcode-select --install"

    struct RuntimeInfo: Equatable {
        let identifier: String
        let displayName: String
        let sizeBytes: Int64
        let deletable: Bool
        let lastUsedAt: Date?
    }

    /// True when an active developer directory is configured. `/usr/bin/xcrun`
    /// is a base-OS shim and exists even without developer tools; invoking it
    /// in that state can show Apple's command-line-tools installer dialog.
    static func isXcrunAvailable(
        statusRunner: (_ executablePath: String, _ arguments: [String]) -> Int32 = runStatus
    ) -> Bool {
        statusRunner(xcodeSelectPath, ["-p"]) == 0
    }

    /// Parse stdout from `xcrun simctl runtime list -j`.
    /// Returns nil when the payload is empty or not the expected dictionary.
    static func parseRuntimeListJSON(_ jsonText: String) -> [RuntimeInfo]? {
        let trimmed = jsonText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              let data = trimmed.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: [String: Any]]
        else {
            return nil
        }

        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime]

        var runtimes: [RuntimeInfo] = []
        for (key, info) in json {
            let identifier = (info["identifier"] as? String) ?? key
            let version = info["version"] as? String
            let build = info["build"] as? String
            let platform = platformName(from: info["platformIdentifier"] as? String)
            let sizeBytes = (info["sizeBytes"] as? NSNumber)?.int64Value ?? 0
            let deletable = info["deletable"] as? Bool ?? true
            let lastUsedAt: Date? = {
                guard let raw = info["lastUsedAt"] as? String else { return nil }
                return isoFormatter.date(from: raw)
            }()

            let displayName: String = {
                var parts: [String] = []
                if let platform { parts.append(platform) }
                if let version { parts.append(version) }
                let base = parts.isEmpty ? "Simulator Runtime" : parts.joined(separator: " ")
                if let build { return "\(base) (\(build))" }
                return base
            }()

            runtimes.append(RuntimeInfo(
                identifier: identifier,
                displayName: displayName,
                sizeBytes: sizeBytes,
                deletable: deletable,
                lastUsedAt: lastUsedAt
            ))
        }

        return runtimes.sorted {
            if $0.sizeBytes != $1.sizeBytes { return $0.sizeBytes > $1.sizeBytes }
            return $0.displayName.localizedStandardCompare($1.displayName) == .orderedAscending
        }
    }

    /// Build opt-in cleanable rows. Runtime downloads are recoverable only by
    /// downloading them again, so Smart Scan must never preselect them.
    static func makeCleanableItems(from runtimes: [RuntimeInfo]) -> [CleanableItem] {
        runtimes.compactMap { runtime in
            guard runtime.sizeBytes > 0 else { return nil }
            return CleanableItem(
                name: runtime.displayName,
                path: CleanableItem.simctlRuntimePathPrefix + runtime.identifier,
                size: runtime.sizeBytes,
                category: .xcodeJunk,
                isSelected: false,
                lastModified: runtime.lastUsedAt
            )
        }
    }

    static func platformName(from platformIdentifier: String?) -> String? {
        guard let platformIdentifier else { return nil }
        switch platformIdentifier {
        case "com.apple.platform.iphonesimulator": return "iOS"
        case "com.apple.platform.watchsimulator": return "watchOS"
        case "com.apple.platform.appletvsimulator": return "tvOS"
        case "com.apple.platform.xrsimulator": return "visionOS"
        default:
            if platformIdentifier.contains("iphone") { return "iOS" }
            if platformIdentifier.contains("watch") { return "watchOS" }
            if platformIdentifier.contains("tv") { return "tvOS" }
            if platformIdentifier.contains("xr") || platformIdentifier.contains("vision") {
                return "visionOS"
            }
            return nil
        }
    }

    /// Run `/usr/bin/xcrun` after an availability check. Returns status -1 and
    /// `missingXcrunMessage` when the binary is absent so callers can skip
    /// scan rows / surface a clean delete error.
    static func runXcrun(
        _ arguments: [String],
        availabilityCheck: () -> Bool = { isXcrunAvailable() }
    ) -> (status: Int32, stdout: String, stderr: String) {
        guard availabilityCheck() else {
            Logger.shared.log("No active developer directory reported by xcode-select", level: .warning)
            return (-1, "", missingXcrunMessage)
        }

        let task = Process()
        task.executableURL = URL(fileURLWithPath: xcrunPath)
        task.arguments = arguments
        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        task.standardOutput = stdoutPipe
        task.standardError = stderrPipe
        do {
            try task.run()
        } catch {
            Logger.shared.log(
                "xcrun \(arguments.joined(separator: " ")) failed to launch: \(error.localizedDescription)",
                level: .warning
            )
            return (-1, "", error.localizedDescription)
        }
        let outData = stdoutPipe.fileHandleForReading.readDataToEndOfFile()
        let errData = stderrPipe.fileHandleForReading.readDataToEndOfFile()
        task.waitUntilExit()
        return (
            task.terminationStatus,
            String(data: outData, encoding: .utf8) ?? "",
            String(data: errData, encoding: .utf8) ?? ""
        )
    }

    static func runStatus(_ executablePath: String, _ arguments: [String]) -> Int32 {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: executablePath)
        task.arguments = arguments
        task.standardOutput = Pipe()
        task.standardError = Pipe()
        do {
            try task.run()
            task.waitUntilExit()
            return task.terminationStatus
        } catch {
            return -1
        }
    }
}

```

### Core Architecture Module: `PureMac/Services/CleaningEngine.swift`
```
import Foundation

actor CleaningEngine {
    private let fileManager = FileManager.default
    private let binaryThinner = BinaryThinner()

    struct CleaningResult {
        var freedSpace: Int64 = 0
        var itemsCleaned: Int = 0
        var errors: [String] = []
        var cleanedPaths: Set<String> = []
        // Items that user-level FileManager.removeItem refused with EACCES /
        // EPERM. These are root-owned and need an admin-privileged second
        // pass via cleanWithAdminPrivileges(items:).
        var requiresAdmin: [CleanableItem] = []
        // Paths skipped because they are SIP-protected or immutable (see
        // FileProtection). Deleting these fails even as root, so they are
        // recorded here — not in errors — and must never trigger the
        // "Couldn't clean everything" alert.
        var protectedPaths: Set<String> = []
        var skippedProtected: Int { protectedPaths.count }
    }

    // MARK: - Public API

    func cleanItems(_ items: [CleanableItem], progressHandler: @Sendable (Double) -> Void) async -> CleaningResult {
        var result = CleaningResult()
        let total = items.count
        let exclusions = CleanupExclusions.paths()

        for (index, item) in items.enumerated() {
            let progress = Double(index + 1) / Double(total)
            defer { progressHandler(progress) }
            if CleanupExclusions.excludes(item.path, paths: exclusions) {
                result.errors.append("Excluded from cleanup: \(item.name)")
                continue
            }

            if item.category == .purgeableSpace {
                let purged = await purgePurgeableSpace()
                result.freedSpace += purged
                if purged > 0 { result.itemsCleaned += 1 }
                // Purgeable space is a one-shot reclaim action, not a file
                // unlink. Mark it handled so it isn't later mistaken for an
                // item that "couldn't be removed" (the purge ran regardless of
                // how much APFS chose to release). See issue #112.
                result.cleanedPaths.insert(item.path)
                continue
            }

            if item.category == .universalBinaries {
                // Thinning is a lipo rewrite plus re-sign, not a file unlink,
                // so it bypasses the delete path entirely. The item path is
                // the app bundle; the per-binary work list is re-derived here
                // so a stale scan can't strip slices that no longer exist.
                let thinOutcome = await thinUniversalBinaryItem(item)
                result.freedSpace += thinOutcome.freed
                if thinOutcome.cleaned {
                    result.itemsCleaned += 1
                    result.cleanedPaths.insert(item.path)
                }
                if let error = thinOutcome.error {
                    result.errors.append(error)
                }
                continue
            }

            if item.category == .languageFiles {
                // Localizations are sealed into the bundle's CodeResources; a
                // plain unlink would break the app's code signature, so the
                // folder is removed through BinaryThinner's staged re-sign
                // flow instead of the delete path.
                let lprojOutcome = await removeLanguageFileItem(item)
                result.freedSpace += lprojOutcome.freed
                if lprojOutcome.cleaned {
                    result.itemsCleaned += 1
                    result.cleanedPaths.insert(item.path)
                }
                if let error = lprojOutcome.error {
                    result.errors.append(error)
                }
                continue
            }

            if item.category == .dockerCache && item.path.isEmpty {
                // The virtual "Docker prune" entry (empty path, like
                // purgeableSpace) reclaims space inside the Docker/OrbStack VM
                // via `docker system prune -f` — there is no file to unlink.
                let pruneOutcome = await pruneDockerSystem()
                result.freedSpace += pruneOutcome.freed
                if pruneOutcome.freed > 0 { result.itemsCleaned += 1 }
                result.cleanedPaths.insert(item.path)
                if let error = pruneOutcome.error {
                    result.errors.append(error)
                }
                continue
            }

            if let runtimeID = item.simctlRuntimeIdentifier {
                // Simulator runtimes live in CoreSimulator's secure storage;
                // deleting the mount path by hand leaves orphaned disk images.
                // Always go through `xcrun simctl runtime delete`.
                let deleteOutcome = await deleteSimulatorRuntime(identifier: runtimeID, reportedSize: item.size)
                result.freedSpace += deleteOutcome.freed
                if deleteOutcome.cleaned {
                    result.itemsCleaned += 1
                    result.cleanedPaths.insert(item.path)
                }
                if let error = deleteOutcome.error {
                    result.errors.append(error)
                }
                continue
            }

            do {
                let itemURL = URL(fileURLWithPath: item.path)
                guard !hasUnexpectedSymlink(in: item.path) else {
                    let msg = "Skipped symlink or unsafe path: \(item.path)"
                    Logger.shared.log(msg, level: .warning)
                    result.errors.append(msg)
                    continue
                }
                guard fileManager.fileExists(atPath: item.path) else {
                    result.cleanedPaths.insert(item.path)
                    continue
                }
                let resolvedURL = itemURL.resolvingSymlinksInPath()
                let resolved = resolvedURL.path

                // Large files surfaced by scanLargeFiles are per-file items
                // under Downloads/Documents/Desktop; those get a narrower check
                // instead of the whole-subtree allow-list.
                let pathAccepted: Bool = {
                    if item.category == .largeFiles {
                        return isExplicitSingleFileDeletable(resolvedPath: resolved)
                    }
                    // languageFiles never reaches here — it is handled above
                    // via the staged re-sign flow, not the delete path.
                    return isSafeToDelete(resolvedPath: resolved)
                }()
                guard pathAccepted else {
                    let msg = "Skipped symlink or unsafe path: \(item.path) -> \(resolved)"
                    Logger.shared.log(msg, level: .warning)
                    result.errors.append(msg)
                    continue
                }

                // Narrow the TOCTOU window: re-resolve right before the delete
                // and require the resolved path to still match. Any concurrent
                // swap between check and delete aborts the operation.
                let reResolved = itemURL.resolvingSymlinksInPath().path
                guard reResolved == resolved, !hasUnexpectedSymlink(in: item.path) else {
                    let msg = "Aborting delete: path resolution changed between check and unlink for \(item.path)"
                    Logger.shared.log(msg, level: .warning)
                    result.errors.append(msg)
                    continue
                }

                try fileManager.removeItem(at: itemURL)
                result.freedSpace += item.size
                result.itemsCleaned += 1
                result.cleanedPaths.insert(item.path)
            } catch {
                let nsError = error as NSError
                let isPermissionDenied =
                    (nsError.domain == NSCocoaErrorDomain &&
                        (nsError.code == NSFileWriteNoPermissionError ||
                         nsError.code == NSFileReadNoPermissionError)) ||
                    (nsError.domain == NSPOSIXErrorDomain &&
                        (nsError.code == Int(EACCES) || nsError.code == Int(EPERM)))
                if isPermissionDenied {
                    // SIP-protected/immutable entries fail even as root, so
                    // escalating them just wastes an auth prompt and produces
                    // a bogus "survived admin removal" error. Record and move on.
                    if FileProtection.isProtectedFromDeletion(path: item.path) {
                        result.protectedPaths.insert(item.path)
                        Logger.shared.log("Skipping SIP-protected path: \(item.path)", level: .info)
                        continue
                    }
                    // Defer to the admin pass — these are typically root-owned
                    // system caches that the user-level process can't unlink.
                    result.requiresAdmin.append(item)
                    Logger.shared.log("Deferring to admin pass: \(item.path)", level: .info)
                } else {
                    let detail = "\(item.name) at \(item.path): \(error.localizedDescription)"
                    result.errors.append(detail)
                    Logger.shared.log("Clean failed: \(detail)", level: .error)
                }
            }
        }

        return result
    }

    func cleanCategory(_ result: CategoryResult, progressHandler: @Sendable (Double) -> Void) async -> CleaningResult {
        let selectedItems = result.items.filter { $0.isSelected }
        return await cleanItems(selectedItems, progressHandler: progressHandler)
    }

    /// Re-runs the deletion of the supplied items as root via NSAppleScript's
    /// "with administrator privileges" clause. Triggers exactly one auth
    /// prompt for the whole batch (macOS caches the credential for ~5 min).
    ///
    /// Every path is re-validated against the same allow-list as the user-
    /// level pass (isSafeToDelete /
```

### Core Architecture Module: `PureMac/Services/ScanEngine.swift`
```
import Foundation

actor ScanEngine {
    private let fileManager = FileManager.default
    private let home = FileManager.default.homeDirectoryForCurrentUser.path

    /// Live path reporter for the dashboard's scanning ticker. Throttled so
    /// a directory with thousands of entries doesn't flood the main actor.
    private var onPath: (@Sendable (String) -> Void)?
    private var lastReport = Date.distantPast

    /// `path` is an autoclosure so the String is only materialized after the
    /// throttle gate passes — a deep home-directory walk enumerates hundreds
    /// of thousands of entries and only ~12/sec are ever displayed.
    private func report(_ path: @autoclosure () -> String) {
        guard let onPath else { return }
        let now = Date()
        guard now.timeIntervalSince(lastReport) > 0.1 else { return }
        lastReport = now
        onPath(path())
    }

    private struct CleanupTarget {
        let name: String
        let path: String
        let isSelected: Bool
        let minimumSize: Int64

        init(name: String, path: String, isSelected: Bool = true, minimumSize: Int64 = 1024) {
            self.name = name
            self.path = path
            self.isSelected = isSelected
            self.minimumSize = minimumSize
        }
    }

    enum NodeCacheManager: String, CaseIterable {
        case npm
        case yarn
        case pnpm
    }

    // MARK: - Public API

    func scanCategory(
        _ category: CleaningCategory,
        onPath: (@Sendable (String) -> Void)? = nil
    ) async -> CategoryResult {
        self.onPath = onPath
        defer { self.onPath = nil }
        switch category {
        case .smartScan:
            return CategoryResult(category: category, items: [], totalSize: 0)
        case .systemJunk:
            return scanSystemJunk()
        case .userCache:
            return scanUserCache()
        case .aiApps:
            return scanAIApps()
        case .mailAttachments:
            return scanMailAttachments()
        case .trashBins:
            return scanTrash()
        case .largeFiles:
            return scanLargeFiles()
        case .purgeableSpace:
            return scanPurgeableSpace()
        case .xcodeJunk:
            return scanXcodeJunk()
        case .brewCache:
            return await scanBrewCache()
        case .nodeCache:
            return await scanNodeCache()
        case .dockerCache:
            return await scanDockerCache()
        case .universalBinaries:
            return scanUniversalBinaries()
        case .languageFiles:
            return scanLanguageFiles()
        }
    }

    func getDiskInfo() -> DiskInfo {
        var info = DiskInfo()
        do {
            let attrs = try fileManager.attributesOfFileSystem(forPath: "/")
            if let total = attrs[.systemSize] as? Int64 {
                info.totalSpace = total
            }
            if let free = attrs[.systemFreeSize] as? Int64 {
                info.freeSpace = free
            }
            info.usedSpace = info.totalSpace - info.freeSpace

            // Use URLResourceValues for accurate purgeable space detection
            let rootURL = URL(fileURLWithPath: "/")
            let values = try rootURL.resourceValues(forKeys: [
                .volumeAvailableCapacityForImportantUsageKey,
                .volumeAvailableCapacityKey
            ])
            if let importantCapacity = values.volumeAvailableCapacityForImportantUsage,
               let freeCapacity = values.volumeAvailableCapacity {
                // Purgeable = important capacity (free + purgeable) minus actual free
                let purgeable = importantCapacity - Int64(freeCapacity)
                if purgeable > 10 * 1024 * 1024 { // Only report if > 10 MB
                    info.purgeableSpace = purgeable
                }
            }
        } catch {
            Logger.shared.log("Disk info unavailable: \(error.localizedDescription)", level: .warning)
        }
        return info
    }

    // MARK: - Scanners

    private func scanSystemJunk() -> CategoryResult {
        var items: [CleanableItem] = []
        var totalSize: Int64 = 0

        let systemPaths = [
            "/Library/Caches",
            "/Library/Logs",
            "/private/var/log",
            "\(home)/Library/Logs",
            "/tmp",
            "/private/var/tmp",
        ]

        for path in systemPaths {
            let scanned = scanDirectory(path: path, category: .systemJunk, recursive: true, maxDepth: 3)
            items.append(contentsOf: scanned)
        }

        totalSize = items.reduce(0) { $0 + $1.size }
        return CategoryResult(category: .systemJunk, items: items, totalSize: totalSize)
    }

    private func scanUserCache() -> CategoryResult {
        var items: [CleanableItem] = []
        // Exclude cache roots claimed by dedicated categories to avoid double-counting,
        // plus cloud File Provider state, which lives under Caches but is a live
        // database rather than reclaimable junk (issue #142).
        let excludedRootPaths = Set(([
            "\(home)/Library/Caches/Homebrew",
            "\(home)/Library/Caches/com.electron.ollama",
            "\(home)/Library/Caches/ollama",
            "\(home)/Library/Caches/npm",
            "\(home)/Library/Caches/Yarn",
            "\(home)/Library/Caches/dev.kdrag0n.MacVirt",
        ] + ProviderPaths.deniedRoots).map(normalizePath))

        // Dynamically enumerate ~/Library/Caches/ so every subdirectory is visible
        let cachePath = "\(home)/Library/Caches"
        let scanned = scanDirectory(
            path: cachePath,
            category: .userCache,
            recursive: false,
            maxDepth: 1,
            excluding: excludedRootPaths
        )
        items.append(contentsOf: scanned)

        // Also scan for npm/pip/yarn caches
        let devCaches = [
            "\(home)/.cache/pip",
            "\(home)/Library/Caches/pip",
        ]

        for path in devCaches {
            if let item = makeCleanupItem(
                name: URL(fileURLWithPath: path).lastPathComponent,
                path: path,
                category: .userCache
            ) {
                items.append(item)
            }
        }

        // Sandboxed apps keep their caches inside per-app containers, not
        // ~/Library/Caches — on modern macOS this is where most of the
        // "user cache" gigabytes actually live. One item per container,
        // skipping near-empty caches (< 1 MB).
        let containerRoots = [
            "\(home)/Library/Containers",
            "\(home)/Library/Group Containers",
        ]
        for root in containerRoots {
            guard let containers = try? fileManager.contentsOfDirectory(atPath: root) else { continue }
            // App containers nest caches under Data/; group containers don't.
            let cacheSubpath = root.hasSuffix("Group Containers")
                ? "Library/Caches"
                : "Data/Library/Caches"
            for container in containers {
                let cachePath = (root as NSString)
                    .appendingPathComponent(container)
                    .appending("/" + cacheSubpath)
                // Same symlink defense as scanDirectory: an app at this UID
                // could plant Data or Data/Library as a symlink into an
                // allow-listed root and have the target sized here and later
                // deleted. Only accept paths that resolve to themselves.
                let resolvedCachePath = URL(fileURLWithPath: cachePath).resolvingSymlinksInPath().path
                guard normalizePath(resolvedCachePath) == normalizePath(cachePath) else { continue }
                if let item = makeCleanupItem(
                    name: "\(container) (sandbox cache)",
                    path: cachePath,
                    category: .userCache,
                    minimumSize: 1024 * 1024
                ) {
                    items.append(item)
                }
            }
        }

        // Per-app HTTP cookie/response storage — one entry per app, same
        // non-recursive shape as the top-level Caches pass above. CFNetwork
        // keeps each native app's cookies and HSTS state here, i.e. live
        // login sessions rather than regenerable cache, so these entries
        // start unselected and the user opts in per app.
        let httpStorages = scanDirectory(
            path: "\(home)/Library/HTTPStorages",
            category: .userCache,
            recursive: false,
            maxDepth: 1,
            isSelected: false
        )
        items.append(contentsOf: httpStorages)

        let uniqueItems = deduplicatedItems(items)
        let totalSize = uniqueItems.reduce(0) { $0 + $1.size }
        return CategoryResult(category: .userCache, items: uniqueItems, totalSize: totalSize)
    }

    private func scanAIApps() -> CategoryResult {
        let targets = [
            CleanupTarget(
                name: String(localized: "Ollama Logs"),
                path: "\(home)/.ollama/logs"
            ),
            CleanupTarget(
                name: String(localized: "Ollama Cache"),
                path: "\(home)/Library/Caches/ollama"
            ),
            CleanupTarget(
                name: String(localized: "Ollama Electron Cache"),
                path: "\(home)/Library/Caches/com.electron.ollama"
            ),
            CleanupTarget(
                name: String(localized: "Ollama WebKit Data"),
                path: "\(home)/Library/WebKit/com.electron.ollama"
            ),
            CleanupTarget(
                name: String(localized: "Ollama Saved State"),
                path: "\(home)/Library/Saved Application State/com.electron.ollama.savedState"
            ),
            CleanupTarget(
                name: String(localized: "Ollama CLI Prompt History (Optional)"),
                path: "\(home)/.ollama/history",
        
```

### Core Architecture Module: `PureMac/ViewModels/AppState.swift`
```
import SwiftUI
import Combine
import UserNotifications
import AppKit

// InstalledApp is defined in AppInfoFetcher.swift

enum AppSection: Hashable {
    case apps
    case orphans
    case spaceExplorer
    case duplicates
    case similarPhotos
    case protection
    case performance
    case appUpdates
    case cleaning(CleaningCategory)
}

extension Notification.Name {
    /// Posted by the Finder Services handler ("Uninstall with PureMac") with a
    /// `["path": String]` userInfo pointing at the right-clicked .app bundle.
    static let pureMacExternalUninstall = Notification.Name("PureMac.ExternalUninstall")
}

/// Cold-launch buffer for Finder Services. A "Uninstall with PureMac" request
/// can arrive before the SwiftUI scene (and thus AppState) exists; the posted
/// notification then has no subscriber and is lost (NotificationCenter has no
/// replay). AppDelegate stashes the path here and AppState drains it in init.
enum ExternalUninstallBuffer {
    // Written by the Finder Services handler and drained by AppState — both
    // run on the main thread, so a plain static is sufficient here.
    static var pendingPath: String?
}

/// Standalone observable for the live scan-path ticker. The scan engine reports
/// the filesystem path it is touching ~10×/sec. Routing that through AppState's
/// own `@Published` storage republished the *entire* view tree at that rate,
/// which surfaced as window-drag / button-hover lag and a Smart Scan that
/// looked frozen until you switched sidebar sections and forced a fresh render
/// (issues #119, #120). Isolating the high-frequency value here means only the
/// small ticker label observes it, so the rest of the UI stays still.
@MainActor
final class ScanProgressTicker: ObservableObject {
    @Published var path: String = ""
}

@MainActor
final class AppState: ObservableObject {
    typealias AppFileScanner = @MainActor (
        _ app: InstalledApp,
        _ locations: Locations,
        _ completion: @escaping (Set<URL>) -> Void
    ) -> Void
    typealias AppFileTrasher = @MainActor (
        _ urls: [URL],
        _ completion: @escaping ([URL], Bool, [URL], [URL]) -> Void
    ) -> Void

    // MARK: - Scan / Clean State

    @Published var selectedCategory: CleaningCategory = .smartScan
    @Published var scanState: ScanState = .idle
    @Published var categoryResults: [CleaningCategory: CategoryResult] = [:]
    @Published var diskInfo = DiskInfo()
    @Published var totalJunkSize: Int64 = 0
    @Published var totalFreedSpace: Int64 = 0
    @Published var scanProgress: Double = 0
    @Published var scanWasCancelled = false
    @Published var lastScanDate: Date?
    private var scanTask: Task<Void, Never>?
    private var scanGeneration = UUID()
    private var cleanupGeneration = UUID()
    @Published var cleanProgress: Double = 0
    @Published var currentScanCategory: String = ""
    /// Live filesystem path the scan engine is touching, feeding the dashboard's
    /// ticker. Deliberately NOT a `@Published` on AppState — it updates ~10×/sec
    /// and would otherwise invalidate the whole view tree (issues #119, #120).
    /// Only the ticker label observes this object directly.
    let scanTicker = ScanProgressTicker()
    @Published var showCleanConfirmation = false
    @Published var lastCleanedDate: Date?
    @Published var selectedCleanupItems: Set<UUID> = []
    @Published var deselectedItems: Set<UUID> = []
    @Published var hasFullDiskAccess: Bool = true
    @Published var fdaBannerDismissed: Bool = false
    @Published var cleanError: String?
    @Published private(set) var lastCleanupHadFailures = false
    /// True when the most recent clean error is rooted in a TCC/FDA refusal
    /// (i.e. items survived even the admin pass). MainWindow uses this to
    /// route the user into the PermissionSheet instead of the generic alert.
    @Published var cleanErrorIsFDAFixable: Bool = false
    /// Items that survived the most recent clean attempt — used to re-run the
    /// operation after the user grants Full Disk Access without forcing them
    /// to re-select anything.
    @Published var pendingPermissionRetryItems: [CleanableItem] = []

    // MARK: - App Uninstaller State

    @Published var installedApps: [InstalledApp] = []
    @Published var selectedApp: InstalledApp?
    @Published var discoveredFiles: [URL] = []
    @Published var selectedFiles: Set<URL> = []
    @Published var orphanedFiles: [URL] = []
    @Published var isSearchingOrphans: Bool = false
    @Published var isLoadingApps: Bool = false
    @Published var isScanningAppFiles: Bool = false
    @Published var isRemovingAppFiles = false
    @Published var removalError: String?
    @Published var removalNeedsFullDiskAccess = false
    /// Snapshot of the URLs that failed the most recent uninstall due to a
    /// permission denial. Frozen at finishRemoval time so AppFilesView's
    /// retry path operates on the failed batch even if the user clicks a
    /// different app or mutates selection while the FDA sheet is open.
    @Published var lastFailedRemovalURLs: [URL] = []
    @Published var appFileScanLocationCount: Int = 0
    /// Set when a right-clicked app arrives via the Finder Services handler.
    /// MainWindow consumes it on both onChange AND onAppear so a request that
    /// lands before MainWindow mounts (cold launch, or while onboarding is
    /// still showing) is still surfaced — a one-shot token would be missed.
    @Published var pendingExternalApp: InstalledApp?

    private var externalUninstallObserver: AnyCancellable?
    private var appFileScanGeneration = UUID()

    // MARK: - Services

    var scheduler = SchedulerService()
    private let scanEngine = ScanEngine()
    private let cleaningEngine = CleaningEngine()
    private let locationsProvider: () -> Locations
    private let appFileScanner: AppFileScanner
    private let appFileTrasher: AppFileTrasher

    // MARK: - Computed

    var totalItemCount: Int {
        categoryResults.values.reduce(0) { $0 + $1.itemCount }
    }

    var currentCategoryResult: CategoryResult? {
        categoryResults[selectedCategory]
    }

    var allResults: [CategoryResult] {
        CleaningCategory.scannable.compactMap { categoryResults[$0] }.filter { $0.totalSize > 0 }
    }

    var totalSelectedSize: Int64 {
        allResults.flatMap { $0.items }.filter { isItemSelected($0) }.reduce(0) { $0 + $1.size }
    }

    var currentAppFileSearchLocationCount: Int {
        if isScanningAppFiles && appFileScanLocationCount > 0 {
            return appFileScanLocationCount
        }
        return discoveredFiles.count
    }

    // MARK: - Init

    init(
        performStartupTasks: Bool = true,
        locationsProvider: @escaping () -> Locations = Locations.init,
        appFileScanner: @escaping AppFileScanner = AppState.defaultAppFileScanner,
        appFileTrasher: @escaping AppFileTrasher = AppState.defaultAppFileTrasher
    ) {
        self.locationsProvider = locationsProvider
        self.appFileScanner = appFileScanner
        self.appFileTrasher = appFileTrasher

        // Listen for right-click "Uninstall with PureMac" hand-offs from the
        // Finder Services handler in AppDelegate.
        externalUninstallObserver = NotificationCenter.default
            .publisher(for: .pureMacExternalUninstall)
            .receive(on: RunLoop.main)
            .sink { [weak self] note in
                let path = (note.userInfo?["path"] as? String) ?? ExternalUninstallBuffer.pendingPath
                ExternalUninstallBuffer.pendingPath = nil
                guard let path else { return }
                Task { @MainActor in self?.presentExternalUninstall(appPath: path) }
            }
        // Drain a request that arrived before this AppState existed (cold launch
        // via Finder Services — the notification fired with no subscriber).
        if let buffered = ExternalUninstallBuffer.pendingPath {
            ExternalUninstallBuffer.pendingPath = nil
            presentExternalUninstall(appPath: buffered)
        }

        if performStartupTasks {
            loadDiskInfo()
            checkFullDiskAccess()
            loadInstalledApps()
            scheduler.setTrigger { [weak self] in
                await self?.runScheduledScan()
            }
            // Only arm the scheduler once onboarding has completed. Before
            // the first launch the defaults plist may have been
            // attacker-planted with autoClean=true; wait for human consent
            // via onboarding.
            if UserDefaults.standard.bool(forKey: "PureMac.OnboardingComplete") {
                scheduler.start()
            }
        }
    }

    // MARK: - App Loading

    func loadInstalledApps() {
        isLoadingApps = true
        Task.detached(priority: .userInitiated) {
            let apps = AppInfoFetcher.shared.fetchInstalledApps()
            await MainActor.run { [weak self] in
                self?.installedApps = apps
                self?.isLoadingApps = false
            }
        }
    }

    /// Resolve a right-clicked .app (via the Finder Services handler) into the
    /// uninstaller: select it, kick off the related-files scan, and signal
    /// MainWindow to surface the Installed Apps section.
    func presentExternalUninstall(appPath: String) {
        let url = URL(fileURLWithPath: appPath)
        if let cached = installedApps.first(where: { $0.path.standardizedFileURL == url.standardizedFileURL }) {
            applyExternalUninstall(cached)
            return
        }
        // Not in the cached list (non-standard location, or a cold start before
        // loadInstalledApps finished). Resolve off the main thread — fetchApp
        // walks the entire bundle to size it, which would beachball the UI for
        // a multi-gigabyte app.
        Task.detached(priority: .userInitiated) {
            let app = AppInfoFetcher.shared.fetchApp(at: url)
            await MainActor.run 
```

### Core Architecture Module: `PureMac/Views/Components/EmptyStateView.swift`
```
import SwiftUI

struct EmptyStateView: View {
    let title: LocalizedStringKey
    let systemImage: String
    let description: LocalizedStringKey
    var action: (() -> Void)?
    var actionLabel: LocalizedStringKey?
    /// Halo/icon tint — positive states pass a color (e.g. green for "All
    /// Clean"); neutral states keep the secondary look.
    var tint: Color?

    @State private var floating = false
    @State private var popped = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(_ title: LocalizedStringKey, systemImage: String, description: LocalizedStringKey,
         action: (() -> Void)? = nil, actionLabel: LocalizedStringKey? = nil, tint: Color? = nil) {
        self.title = title
        self.systemImage = systemImage
        self.description = description
        self.action = action
        self.actionLabel = actionLabel
        self.tint = tint
    }

    var body: some View {
        VStack(spacing: 12) {
            Spacer()
            ZStack {
                Circle()
                    .fill((tint ?? Color.secondary).opacity(0.10))
                    .frame(width: 96, height: 96)
                Circle()
                    .strokeBorder((tint ?? Color.secondary).opacity(0.16), lineWidth: 1)
                    .frame(width: 96, height: 96)
                Image(systemName: systemImage)
                    .font(.system(size: 40))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(tint ?? Color.secondary)
            }
            // One-shot entrance pop, then a gentle idle float. Both skipped
            // under Reduce Motion.
            .scaleEffect(popped || reduceMotion ? 1 : 0.8)
            .offset(y: reduceMotion ? 0 : (floating ? -5 : 5))
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.spring(response: 0.4, dampingFraction: 0.6)) {
                    popped = true
                }
                withAnimation(.easeInOut(duration: 2.4).repeatForever(autoreverses: true)) {
                    floating = true
                }
            }

            Text(title)
                .font(.title3.bold())
                .staggered(0, baseDelay: 0.08)
            Text(description)
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 300)
                .staggered(1, baseDelay: 0.08)
            if let action, let label = actionLabel {
                Button(action: action) { Text(label) }
                    .buttonStyle(.borderedProminent)
                    .padding(.top, 4)
                    .staggered(2, baseDelay: 0.08)
            }
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #144** (2026-08-10): **[Bug] PureMac corrupts applications on default settings, reinstalls needed**
  *Symptoms*: After a cleanup, several apps stop working and require to be reinstalled.  In my case and single run: - Cursor - GitKraken - Jetbrains Toolbox - Figma - Keka - Ableton Live 12 - Stats  Steps to reproduce the behavior: 1. Do a Cleanup. 2. Test every app, you'll find one that uses cache completely broken.  Keka shows permission prompts during the cleanup. Clearly touching stuff that shouldn't.  <img width="302" height="410" alt="Image" src="https://github.com/user-attachments/assets/6ceaff45-b464-41a5-a7ca-d1b559d98877" />  Screenshot on opening all apps mentioned.  - macOS version: macOS Tahoe Version 26.5.2 (25F84) - PureMac version: 2.9.4 (24) - Install method: (Homebrew / DMG / App Store / Source): DMG
  **Post-Mortem & Fix Analysis**:
  > After researching I think that the issue is caused by PureMac modifying app bundles in a way that strips or invalidates their code signature (`codesign`). It seems to hit Electron-based apps particularly hard (had the issue with Deezer, Thaw, Canva, VsCode..)  By manually re-sign the corrupted applications it resolve the issue but it's tedious. The command line is:  ```bash sudo codesign --force --deep --sign - /Applications/<AppName>.app ```
  > Confirmed, and you were right that it happens on default settings. Fixed in 2.9.5.  What was happening: Universal Binaries and Language Files both modify the application bundle and then ad-hoc re-sign it. The code claimed both categories start unselected and are skipped by automatic cleanups — that part was true — but the protection was only wired into the scheduler. `selectAllInCategory` had no such guard, so selecting everything in a category and cleaning fed those items straight through.  Removing a single `.lproj` was worse than it looks: it cloned the whole bundle and ran `codesign --force --deep --sign -` over the entire app. Since `--deep` skips `Contents/Resources`, that leaves vendor-signed code beside an ad-hoc outer bundle, and macOS refuses to launch the result.  Nicolo456 was right about the mechanism. The re-sign command does resolve it, though reinstalling is safer since ad-hoc signing does not restore notarization. Electron apps are hit hardest simply because they carry

- **Issue #142** (2026-08-21): **[Bug] Cleanup appears to corrupt iCloud Drive File Provider metadata and causes severe Finder copy delays**
  *Symptoms*: **Describe the bug**  Immediately after running a cleanup with PureMac, Finder operations involving iCloud Drive became extremely slow. Copying a fully downloaded folder containing 36 files (19.9 MB total) from iCloud Drive to the local Downloads folder, which was effectively instant before the cleanup, started taking approximately 9–23 seconds.  The timing strongly suggests that the PureMac cleanup triggered the problem, because:  - the slowdown started immediately after using PureMac; - there had been no recent macOS update before the symptom appeared; - PureMac was not running afterward and no persistent PureMac background job was found; - the SSD, memory, network, and ordinary local file I/O tested normally; - Safe Mode did not change the behavior; - Apple's File Provider consistency checker now reports hundreds of broken invariants.  I cannot conclusively identify which PureMac cleaning category caused the damage because PureMac does not expose a persistent, user-readable log of the exact paths removed. Please treat the PureMac causal link as a strong timeline-based suspicion, not as a proven identification of a specific source-code path. The application should retain a detailed cleanup transaction log so destructive side effects can be audited.  **To reproduce**  1. Enable iCloud Drive and keep a folder containing multiple small, fully downloaded files. 2. Confirm that copying the folder from iCloud Drive to a local folder such as Downloads is fast. 3. Run a PureMac cle
  **Post-Mortem & Fix Analysis**:
  > Confirmed, and your instinct about the cause was right. Partially fixed in 2.9.5.  There was no iCloud or File Provider denylist anywhere in the cleaning path. The user cache scan (`ScanEngine.swift:143-151`) was a depth-1 sweep of `~/Library/Caches` where every child over 1 KB became a pre-ticked deletion target — the only exclusions in the entire scan were Homebrew and two ollama directories. On any Mac with iCloud Drive enabled, that enumerated live CloudDocs, CloudKit and bird state and offered it as junk. Deletion then used `removeItem`, never `trashItem`, and never anything provider-aware, while `bird` and `fileproviderd` held those files open.  That is exactly what produces `is_on_disk_but_not_in_FS_Snapshot`: files removed from underneath the provider without telling it, so its snapshot and the filesystem diverge. It also explains why repair worked and then regressed about ten seconds later — the live service was rebuilding state against a database that no longer matched disk. 
  > The reported File Provider corruption path was fixed in commit be2ec797 and shipped in PureMac 2.9.5. The fix blocks iCloud/File Provider roots during both scanning and deletion and checks symlink-resolved paths. Persistent cleanup history and rollback/quarantine did not ship; this closure covers the original provider-state deletion bug, not those follow-up features.  Fix: https://github.com/momenbasel/PureMac/commit/be2ec797156bc2d8345e4be7a39c6f5df49333b4 Release: https://github.com/momenbasel/PureMac/releases/tag/v2.9.5

- **Issue #141** (2026-08-21): **[Bug]  Menu items show icons only, text missing in v2.9.2**
  *Symptoms*: <img width="2242" height="1304" alt="Image" src="https://github.com/user-attachments/assets/d6690d57-508f-48d5-a3a0-75c6458a26d3" />  Describe the bug After upgrading to version 2.9.2, the menu bar and context menu items only display icons without any text labels. This happens regardless of the language setting (tested both Chinese and English). I have already tried the following troubleshooting steps with no success:  1. Switched the app's built-in language between Chinese and English. 2. Ran the terminal command: defaults write -g AppleLanguages -array "zh-Hans" "en" 3. Reset the app's preferences via: defaults delete com.puremac.PureMac 4. Disabled "Increase Contrast" and "Reduce Transparency" in System Settings > Accessibility > Display.  None of these resolved the issue.  To Reproduce Steps to reproduce the behavior:  1. Install/upgrade to PureMac version 2.9.2. 2. Launch the app. 3. Click on any menu item from the app's menu bar or right-click the app icon.  Expected behavior Menu items should display both icon and text labels, not just icons.  Screenshots [Attach a screenshot showing the blank menu here]  Environment (please complete the following information):  - macOS Version: 14.7.7 Sonoma - PureMac Version: 2.9.2 - Mac Model: MacBook Pro 15-inch, 2018 (Intel Core i7 2.2 GHz, Radeon Pro 555X)  Additional context This issue might be related to the app's font rendering engine or the UI framework used in this version, as the problem persists across language changes and
  **Post-Mortem & Fix Analysis**:
  > I'm on the latest version with same problems still  <img width="1168" height="766" alt="Image" src="https://github.com/user-attachments/assets/38868622-6f45-4618-8131-443ba8fe31a9" />
  > Confirmed as a real, ongoing bug. Still open — here is where the investigation stands.  First, the version story does not hold up: 2.9.2 contained no Swift changes at all. `git diff v2.9.1..v2.9.2 -- "*.swift"` is empty; that release was only the app icon. So this is not a regression introduced between those two versions, which fits @frerrr still seeing it on the latest build. It is environment-dependent rather than version-dependent, which is also why a downgrade appearing to fix it can be misleading.  I had both screenshots measured pixel by pixel, and they show two different things:  - **@frerrr's** (1168x766): the sidebar rows really are being laid out narrow. The selected-row background stops at x=104 while the sidebar/detail divider is at x=234, and the badge sits at x≈110 instead of trailing-aligned near x≈200. - **@wanxiyu's** (2242x1304, the original report): the opposite. The selected row's background spans x=20..229 in a ~278px column — full width minus the 12pt row insets. 
  > Hi momenbasel,   Thank you for the detailed analysis and for taking the time to compare the screenshots. I really appreciate the effort you've put into narrowing this down.   To answer your questions:   1. **Font management tools:** No, I do not have any font management software installed (like FontExplorer, Suitcase, or RightFont). I also have not disabled or replaced any system fonts in Font Book. SF Pro and Helvetica Neue should be intact. 2. **Duplicate/corrupt fonts:** I ran Font Book and checked "Edit &gt; Look for Enabled Duplicates" — it shows no duplicates or corrupt fonts. 3. **Other SwiftUI apps:** Yes, text renders normally in other SwiftUI apps. I have tested a few and they all display correctly. This issue only appears to happen with PureMac.   Since you mentioned both of us are on Intel Macs, I can confirm my machine is an Intel MacBook Pro (15-inch, 2018) running macOS Sonoma 14.7.7.   I hope this information helps. Please let me know if you need me to 

- **Issue #127** (2026-07-18): **[Bug] Switch dark/light theme button background display is incorrect**
  *Symptoms*: **Describe the bug** Sometimes the switch dark/light theme button background is not in right area, it will appear in the upper-left corner.  **To reproduce** Steps to reproduce the behavior: 1. Go to 'Installed Apps' 2. select any app  3. after app file details loaded, the button background  will move to the upper-left corner   **Screenshots**  <img width="1120" height="708" alt="Image" src="https://github.com/user-attachments/assets/1f98fea4-cd64-4a1f-9fff-6a3ec2ec59a2" />  **Environment** - macOS version: macos 15 intel version - PureMac version: 2.8.3 - Install method: Homebrew 
  **Post-Mortem & Fix Analysis**:
  > Confirmed and fixed in 7100ce1, shipping in v2.8.4 today.  Root cause: the theme toggle's sliding highlight used `matchedGeometryEffect`, and the pill lives inside the window toolbar. When the file scan for a selected app finishes, the Uninstall button in that same toolbar animates in, forcing a toolbar re-layout - and during that re-layout the matched-geometry frame resolves against a hosting view with no geometry yet, so the highlight draws at the window origin. That's the stray rounded rectangle in your upper-left corner, and why it only appears right after the details load.  The highlight is now a single view anchored to the pill's own bounds and positioned by segment index, so the toolbar re-layout can't move it anywhere else. `brew upgrade --cask puremac` once v2.8.4 is up - I'll close this when the release is published.
  > v2.8.4 is out with the fix - https://github.com/momenbasel/PureMac/releases/tag/v2.8.4. Update with `brew upgrade --cask puremac`. The highlight now stays pinned behind the selected segment no matter what else the toolbar animates. Reopen if you can still trigger it.

- **Issue #126** (2026-07-18): **[Bug] The installed Application file size showing is wrong**
  *Symptoms*: **Describe the bug** The installed Application file size show is wrong, for example. Microsoft Word size should be 2.59GB, but in file details total size only show 459KB, main issue is '/Applications/Microsoft Word.app' only 96 bytes instead of 2.59GB.   **Screenshots**  <img width="1063" height="680" alt="Image" src="https://github.com/user-attachments/assets/945b9aa5-c8f8-4ecd-bd77-2c7d7e1981b2" />  **Environment** - macOS version: MacOS15.3.2, Intel version  - PureMac version: 2.8.3 - Install method: Homebrew 
  **Post-Mortem & Fix Analysis**:
  > Confirmed and root-caused. Thanks for the exact numbers - the 96 bytes gave it away.  In v2.8.3 the file-details pane sized each path with a non-recursive fallback chain that ends at the directory entry's own size on disk. On APFS a directory's inode size is 32 bytes per entry; `Microsoft Word.app` contains a single `Contents` folder, so (1 entry + `.` + `..`) x 32 = exactly the 96 bytes you saw. The Installed Apps list column already sized recursively, which is why only the details pane was wrong.  The fix (#124 plus a hardening commit) routes every displayed size through one shared recursive calculator, so the list and detail pane can no longer disagree. It ships in v2.8.4, going out today - `brew upgrade --cask puremac` once it lands. I'll close this when the release is up.
  > v2.8.4 is out with the fix - https://github.com/momenbasel/PureMac/releases/tag/v2.8.4. Update with `brew upgrade --cask puremac` (or `brew update && brew upgrade --cask puremac` if you installed from the tap). Word should now report its real ~2.6 GB in the details pane. Reopen if anything still looks off.

- **Issue #120** (2026-06-28): **[Bug] The new UI is lagging**
  *Symptoms*: **Describe the bug** The new UI from the new update is just lagging whenever I move the window around or just hover over the buttons. Maybe make an option to bring back the old UI  **To reproduce** Steps to reproduce the behavior: 1. Open pure mac 2. Make a smart scan 3. Try to move the window around  **Expected behavior** The windows and the buttons to lag a little bit  **Screenshots** If applicable, add screenshots.  **Environment** - macOS version: 26.5.1 - PureMac version: 2.8.1 - Install method: Homebrew 
  **Post-Mortem & Fix Analysis**:
  > Fixed in **v2.8.2**.  Root cause: the live "currently scanning…" file-path ticker on the dashboard republished the **entire** view tree ~10×/second during a scan. On a busy scan that meant window drags and button hovers were constantly fighting the scan for the main thread, which showed up as the lag you described.  It's now isolated in its own small observable, so only the one ticker label updates at that rate and the rest of the UI stays still. Should be smooth on macOS 26 now.  Please update to 2.8.2 and reopen if you still see lag. 

- **Issue #119** (2026-06-28): **[Bug] App does not complete the full scan**
  *Symptoms*: When I start a smart scan, it just stops, and then I need to switch between menus in order for the scan to complete; otherwise, it is just completely frozen.  **To reproduce** 1. Open the app 2. Click on the smart scan icon 3. and then it just crashes  **Expected behavior** I expect for the scan to just stop and crash  **Screenshots** If applicable, add screenshots.  **Environment** - macOS version: 26.5.1 - PureMac version: 2.8.1 - Install method: Homebrew  https://github.com/user-attachments/assets/72a041da-088f-40ab-b0a9-12fa1ee8e2fe 
  **Post-Mortem & Fix Analysis**:
  > Fixed in **v2.8.2** — same root cause as #120.  The scan itself wasn't actually crashing or stopping; it runs off the main thread. The problem was the dashboard's live path ticker invalidating the whole view tree ~10×/second, which starved the UI of redraws — so the scan *looked* frozen until you switched sidebar sections and forced a fresh render. That high-frequency update is now isolated to its own tiny view, so progress keeps animating while the scan runs.  Please update to 2.8.2. If a scan still stalls for you, reopen with the screen recording and we'll dig in. 

- **Issue #118** (2026-06-28): **Deprecation warning in puremac.rb: depends_on macos: string comparison is deprecated**
  *Symptoms*: **Describe the bug** When running `brew outdated` or managing packages via Homebrew, a deprecation warning is triggered by the `puremac.rb` formula due to an outdated `depends_on macos:` syntax.   **To reproduce** Steps to reproduce the behavior: 1. Open Terminal. 2. Run `brew update` followed by `brew outdated` (or any brew command that parses the tap). 3. See the following warning: ```text Warning: Calling string comparison format for `depends_on macos:` is deprecated! Use `depends_on macos: :ventura` instead. Please report this issue to the momenbasel/homebrew-tap tap (not Homebrew/* repositories), or even better, submit a PR to fix it:   /opt/homebrew/Library/Taps/momenbasel/homebrew-tap/Casks/puremac.rb:10  ```  **Expected behavior** The Homebrew command should run cleanly without any deprecation warnings. Line 10 in `puremac.rb` should be updated to use the modern syntax: `depends_on macos: :ventura`.  **Screenshots** *(If applicable, you can drag and drop a screenshot of your terminal here)*  **Environment**  * macOS version: 15.7.5 * PureMac version: Latest Cask version * Install method: Homebrew
  **Post-Mortem & Fix Analysis**:
  > Fixed.  The warning came from the cask using the old string-comparison form `depends_on macos: ">= :ventura"`, which Homebrew deprecated. It now uses the modern symbol form `depends_on macos: :ventura` — which is Homebrew's *exact* recommended replacement and still means "Ventura or newer", so nothing changes for users on macOS 13+.  - Custom tap (`momenbasel/homebrew-tap`): updated. - In-repo cask: PR #122 applies the same change (merged).  No more deprecation notice on `brew install`/`upgrade`. Thanks for the clean report. 

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

### Incident Patch 1: `b399a4f0` (2026-09-14)
**Commit Message**: Fix ignored path normalization on macOS 15

**File**: `cli/Sources/puremac/Core/Stores.swift` (modified, +18/-4)
```diff
@@ -123,11 +123,9 @@ struct IgnoreStore {
             guard allowRelative else {
                 throw StoreError.invalidIgnorePath
             }
-            absolute = URL(fileURLWithPath: currentDirectoryPath, isDirectory: true)
-                .appendingPathComponent(expanded)
-                .path
+            absolute = currentDirectoryPath + "/" + expanded
         }
-        let standardized = URL(fileURLWithPath: absolute).standardizedFileURL.path
+        let standardized = try lexicalStandardizedAbsolutePath(absolute)
         guard standardized.hasPrefix("/"), standardized != "/",
               !standardized.unicodeScalars.contains(where: {
                   $0.value == 0 || CharacterSet.newlines.contains($0)
@@ -138,6 +136,22 @@ struct IgnoreStore {
         return standardized
     }
 
+    private static func lexicalStandardizedAbsolutePath(_ path: String) throws -> String {
+        guard path.hasPrefix("/") else {
+            throw StoreError.invalidIgnorePath
+        }
+        var components: [Substring] = []
+        for component in path.split(separator: "/") {
+            if component == "." { continue }
+            if component == ".." {
+                if !components.isEmpty { components.removeLast() }
+                continue
+            }
+            components.append(component)
+        }
+        return "/" + components.joined(separator: "/")
+    }
+
     private static func load(from fileURL: URL) throws -> [String] {
         guard FileManager.default.fileExists(atPath: fileURL.path) else { return [] }
         let contents = try String(contentsOf: fileURL, encoding: .utf8)
```

**File**: `cli/Sources/puremac/PureMac.swift` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 import ArgumentParser
 import Foundation
 
-let puremacVersion = "1.1.0"
+let puremacVersion = "1.1.1"
 
 @main
 struct PureMac: ParsableCommand {
```

**File**: `cli/Tests/puremacTests/OptimizeConfigTests.swift` (modified, +13/-4)
```diff
@@ -126,10 +126,19 @@ final class OptimizeConfigTests: XCTestCase {
         }
         XCTAssertTrue(store.roots.isEmpty)
         var rootStore = try IgnoreStore(fileURL: file, currentDirectoryPath: "/")
-        XCTAssertThrowsError(try rootStore.add("."))
-
-        try Data("relative/path\n".utf8).write(to: file)
-        XCTAssertThrowsError(try IgnoreStore(fileURL: file))
+        for path in [".", "/.", "/tmp/.."] {
+            XCTAssertThrowsError(try rootStore.add(path))
+            XCTAssertThrowsError(try rootStore.remove(path))
+        }
+        XCTAssertTrue(rootStore.roots.isEmpty)
+        XCTAssertTrue(try rootStore.add("/tmp/./puremac-ignore-fixture"))
+        XCTAssertEqual(rootStore.roots, ["/tmp/puremac-ignore-fixture"])
+        XCTAssertTrue(try rootStore.remove("/tmp/puremac-ignore-fixture"))
+
+        for contents in ["relative/path\n", "/.\n", "/tmp/..\n"] {
+            try Data(contents.utf8).write(to: file)
+            XCTAssertThrowsError(try IgnoreStore(fileURL: file))
+        }
     }
 
     private func temporaryDirectory() throws -> URL {
```

---

### Incident Patch 2: `87c1a9cc` (2026-08-21)
**Commit Message**: Fix/appearance system reset (#152)

* fix: Dark -> System appearance switch left window content dark

Problem:
Selecting Dark in the appearance picker and then switching back to
System updated only the title bar; the sidebar and detail content stayed
dark while the window was focused. The content only snapped to the
correct scheme once the PureMac window lost focus.

Reproduction (system appearance set to Light):
1. Launch PureMac (Appearance: System)
2. Choose Appearance -> Dark
3. Choose Appearance -> System
   -> title bar turns light, all window content remains dark
4. Click any other window: the content now turns light

Root cause:
The theme was applied with .preferredColorScheme(appearance.colorScheme),
where System maps to nil. On macOS, resetting preferredColorScheme from
an explicit scheme back to nil inside a WindowGroup that hosts a
NavigationSplitView (unified toolbar) resets the NSWindow appearance --
the title bar follows the system again -- but SwiftUI does not
re-evaluate the content's colorScheme environment until the window
resigns key. Confirmed on macOS 26.5 with a minimal instrumented repro:
after the reset, window.appearance=nil / effectiveAppearance=Aqua whil

**File**: `PureMac.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -43,6 +43,7 @@
 		A549D8A39A9E5E70D91B90A6 /* Haptics.swift in Sources */ = {isa = PBXBuildFile; fileRef = 40A3F22FCEF534DE4A2CAD0E /* Haptics.swift */; };
 		A9C3A1F643C26930F442E729 /* OrphanSafetyPolicy.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4AE790496C936424EF98320A /* OrphanSafetyPolicy.swift */; };
 		ABDDD4F35102A39CC1A2C325 /* ConfettiView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F0599AA604B0D6BA4F957537 /* ConfettiView.swift */; };
+		ABE3B80279483DB90B8EC1BC /* ThemeManagerTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 55CE234DB2DB54ED53A4EFD6 /* ThemeManagerTests.swift */; };
 		B51E5A95BB49A6C0F5273E21 /* FileSize.swift in Sources */ = {isa = PBXBuildFile; fileRef = 8CE522B406791BCE905BC55B /* FileSize.swift */; };
 		B52938BBD11842631314543D /* CategoryDetailView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 10B0AF194677EAC1D5568785 /* CategoryDetailView.swift */; };
 		B928E4369A3FC4369F014A29 /* SmartCareCoreArtwork.swift in Sources */ = {isa = PBXBuildFile; fileRef = DAA389C4F50505795FB31A51 /* SmartCareCoreArtwork.swift */; };
@@ -109,6 +110,7 @@
 		46660271CFF167AB0FE7371D /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist; path = Info.plist; sourceTree = "<group>"; };
 		491771F923C93FD61A263893 /* AppLanguagePreferencesTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppLanguagePreferencesTests.swift; sourceTree = "<group>"; };
 		4AE790496C936424EF98320A /* OrphanSafetyPolicy.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = OrphanSafetyPolicy.swift; sourceTree = "<group>"; };
+		55CE234DB2DB54ED53A4EFD6 /* ThemeManagerTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ThemeManagerTests.swift; sourceTree = "<group>"; };
 		5664D2BDAEAA9AE3A53DB364 /* PureMac.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = PureMac.entitlements; sourceTree = "<group>"; };
 		5785762276FB5E3209C6DE4D /* Logger.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Logger.swift; sourceTree = "<group>"; };
 		5A5C80929EE4A430272674BC /* ja */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = ja; path = ja.lproj/Localizable.strings; sourceTree = "<group>"; };
@@ -185,6 +187,7 @@
 				752603285F7DBBA12BB3AA91 /* AppStateTests.swift */,
 				155CE1B8CDCCCA6F9FD028C1 /* LocalizationFilesTests.swift */,
 				C7D81BE7EA5DB17F4A0300AD /* SimulatorRuntimeSupportTests.swift */,
+				55CE234DB2DB54ED53A4EFD6 /* ThemeManagerTests.swift */,
 			);
 			path = PureMacTests;
 			sourceTree = "<group>";
@@ -536,6 +539,7 @@
 				E2403D82F00D749C9AD4A6D4 /* AppStateTests.swift in Sources */,
 				CFA64F54CDBF8A4765E0068D /* LocalizationFilesTests.swift in Sources */,
 				F4F02F966001A1504C2B4D33 /* SimulatorRuntimeSupportTests.swift in Sources */,
+				ABE3B80279483DB90B8EC1BC /* ThemeManagerTests.swift in Sources */,
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 		};
```

**File**: `PureMac/PureMacApp.swift` (modified, +0/-1)
```diff
@@ -107,7 +107,6 @@ struct PureMacApp: App {
                 }
             }
             .environmentObject(theme)
-            .preferredColorScheme(theme.appearance.colorScheme)
             // Record the openWindow action so the menu-bar popover can reopen
             // this window after it's been closed (the popover lives outside the
             // scene graph and can't use openWindow itself).
```

**File**: `PureMac/Views/Components/AppTheme.swift` (modified, +19/-4)
```diff
@@ -1,3 +1,4 @@
+import AppKit
 import SwiftUI
 
 /// User-overridable appearance setting that lives independently of the system
@@ -22,11 +23,11 @@ enum AppearanceMode: String, CaseIterable, Identifiable {
         }
     }
 
-    var colorScheme: ColorScheme? {
+    var nsAppearance: NSAppearance? {
         switch self {
         case .system: return nil
-        case .light: return .light
-        case .dark: return .dark
+        case .light: return NSAppearance(named: .aqua)
+        case .dark: return NSAppearance(named: .darkAqua)
         }
     }
 }
@@ -37,9 +38,23 @@ final class ThemeManager: ObservableObject {
 
     @AppStorage("PureMac.Appearance") private var rawValue: String = AppearanceMode.system.rawValue
 
+    private init() { applyToApp() }
+
     var appearance: AppearanceMode {
         get { AppearanceMode(rawValue: rawValue) ?? .system }
-        set { rawValue = newValue.rawValue; objectWillChange.send() }
+        set { rawValue = newValue.rawValue; objectWillChange.send(); applyToApp() }
+    }
+
+    /// The theme is driven through NSApp.appearance, not SwiftUI's
+    /// .preferredColorScheme: resetting preferredColorScheme back to nil
+    /// (System) inside a WindowGroup hosting a NavigationSplitView only
+    /// re-appearances the titlebar — the content's colorScheme environment
+    /// isn't re-evaluated until the window resigns key, so the body stays
+    /// stuck in the previous scheme while focused. The AppKit route applies
+    /// immediately and also themes windows outside the main scene
+    /// (Settings, menus, popovers).
+    func applyToApp() {
+        NSApplication.shared.appearance = appearance.nsAppearance
     }
 }
 
```

**File**: `PureMacTests/ThemeManagerTests.swift` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+import AppKit
+import XCTest
+@testable import PureMac
+
+@MainActor
+final class ThemeManagerTests: XCTestCase {
+    private var originalRawValue: String?
+    private var originalMode: AppearanceMode = .system
+    private var originalApplicationAppearance: NSAppearance?
+
+    override func setUp() {
+        super.setUp()
+        originalRawValue = UserDefaults.standard.string(forKey: "PureMac.Appearance")
+        originalMode = ThemeManager.shared.appearance
+        originalApplicationAppearance = NSApp.appearance
+    }
+
+    override func tearDown() {
+        // Reset the singleton first: @AppStorage caches writes made through the
+        // wrapper, so changing UserDefaults directly is not enough to restore
+        // the value ThemeManager reads when applying the process-wide theme.
+        ThemeManager.shared.appearance = originalMode
+
+        // Preserve the exact defaults representation as well (including an
+        // absent or previously invalid value) and restore the AppKit override
+        // independently so this suite cannot leak appearance state.
+        if let originalRawValue {
+            UserDefaults.standard.set(originalRawValue, forKey: "PureMac.Appearance")
+        } else {
+            UserDefaults.standard.removeObject(forKey: "PureMac.Appearance")
+        }
+        NSApp.appearance = originalApplicationAppearance
+        super.tearDown()
+    }
+
+    func testDarkSelectionAppliesAppKitAppearance() {
+        ThemeManager.shared.appearance = .dark
+        XCTAssertEqual(NSApp.appearance?.name, .darkAqua)
+    }
+
+    func testLightSelectionAppliesAppKitAppearance() {
+        ThemeManager.shared.appearance = .light
+        XCTAssertEqual(NSApp.appearance?.name, .aqua)
+    }
+
+    /// Dark -> System must clear the app-level override entirely. The previous
+    /// .preferredColorScheme(nil) pipeline left the NavigationSplitView content
+    /// stuck in the old scheme until the window resigned key.
+    func testSystemSelectionClearsAppKitAppearance() {
+        ThemeManager.shared.appearance = .dark
+        ThemeManager.shared.appearance = .system
+        XCTAssertNil(NSApp.appearance)
+    }
+
+    func testSelectionPersistsAcrossManagerReads() {
+        ThemeManager.shared.appearance = .dark
+        XCTAssertEqual(UserDefaults.standard.string(forKey: "PureMac.Appearance"), "dark")
+        XCTAssertEqual(ThemeManager.shared.appearance, .dark)
+    }
+}
```

---

### Incident Patch 3: `b5cb1670` (2026-08-21)
**Commit Message**: Fix Smart Care progress shimmer clipping (#153)

**File**: `PureMac/Views/DashboardView.swift` (modified, +49/-28)
```diff
@@ -1499,42 +1499,63 @@ private struct ShimmerProgressBar: View {
 
     private var clamped: Double { max(0, min(1, progress)) }
 
+    var body: some View {
+        ZStack(alignment: .leading) {
+            Capsule()
+                .fill(Color.primary.opacity(0.08))
+
+            if reduceMotion {
+                ShimmerProgressFill(progress: CGFloat(clamped), cycle: nil, tint: tint)
+            } else {
+                TimelineView(.animation) { timeline in
+                    let t = timeline.date.timeIntervalSinceReferenceDate
+                    let cycle = CGFloat((t.truncatingRemainder(dividingBy: 1.8)) / 1.8)
+                    ShimmerProgressFill(progress: CGFloat(clamped), cycle: cycle, tint: tint)
+                        .animation(.easeOut(duration: 0.35), value: clamped)
+                }
+            }
+        }
+        .clipShape(Capsule())
+        .frame(height: 9)
+    }
+}
+
+/// Keeps the fill, its clipping boundary, and the shimmer path on the same
+/// interpolated progress value while `TimelineView` independently drives the
+/// shimmer phase.
+private struct ShimmerProgressFill: View, Animatable {
+    var progress: CGFloat
+    let cycle: CGFloat?
+    let tint: Color
+
+    var animatableData: CGFloat {
+        get { progress }
+        set { progress = newValue }
+    }
+
     var body: some View {
         GeometryReader { geo in
-            let fillWidth = geo.size.width * CGFloat(clamped)
+            let fillWidth = geo.size.width * max(0, min(1, progress))
+            let visibleFillWidth = min(geo.size.width, max(8, fillWidth))
+
             ZStack(alignment: .leading) {
-                Capsule()
-                    .fill(Color.primary.opacity(0.08))
+                LinearGradient(colors: [tint, tint.opacity(0.7)],
+                               startPoint: .leading, endPoint: .trailing)
 
-                Capsule()
-                    .fill(
-                        LinearGradient(colors: [tint, tint.opacity(0.7)],
-                                       startPoint: .leading, endPoint: .trailing)
-                    )
-                    .frame(width: max(8, fillWidth))
-                    .animation(reduceMotion ? nil : .easeOut(duration: 0.35), value: clamped)
-
-                if !reduceMotion {
-                    TimelineView(.animation) { timeline in
-                        let t = timeline.date.timeIntervalSinceReferenceDate
-                        let cycle = (t.truncatingRemainder(dividingBy: 1.8)) / 1.8
-                        let bandWidth: CGFloat = 56
-                        LinearGradient(
-                            colors: [.clear, .white.opacity(0.35), .clear],
-                            startPoint: .leading, endPoint: .trailing
-                        )
-                        .frame(width: bandWidth)
-                        .offset(x: CGFloat(cycle) * (geo.size.width + bandWidth) - bandWidth)
-                    }
-                    .mask(
-                        Capsule()
-                            .frame(width: max(8, fillWidth))
-                            .frame(maxWidth: .infinity, alignment: .leading)
+                if let cycle {
+                    let bandWidth = min(56, max(3, visibleFillWidth * 0.6))
+                    LinearGradient(
+                        colors: [.clear, .white.opacity(0.35), .clear],
+                        startPoint: .leading, endPoint: .trailing
                     )
+                    .frame(width: bandWidth)
+                    .offset(x: cycle * (visibleFillWidth + bandWidth) - bandWidth)
+                    .frame(maxWidth: .infinity, alignment: .leading)
                 }
             }
+            .frame(width: visibleFillWidth)
+            .clipShape(Capsule())
         }
-        .frame(height: 9)
     }
 }
 
```

---

### Incident Patch 4: `7e0a6fea` (2026-08-10)
**Commit Message**: Merge pull request #146 from boombertz/fix/appearance-name-localization

fix(l10n): apply appearance name localization in MainWindow

**File**: `PureMac/Views/MainWindow.swift` (modified, +3/-3)
```diff
@@ -350,7 +350,7 @@ struct MainWindow: View {
                 Button {
                     theme.appearance = appearance
                 } label: {
-                    Label(appearance.label, systemImage: appearance.icon)
+                    Label(LocalizedStringKey(appearance.label), systemImage: appearance.icon)
                 }
             }
         } label: {
@@ -366,7 +366,7 @@ struct MainWindow: View {
 
                 Spacer(minLength: 6)
 
-                Text(theme.appearance.label)
+                Text(LocalizedStringKey(theme.appearance.label))
                     .font(.system(size: 10.5, weight: .medium))
                     .foregroundStyle(.secondary)
 
@@ -382,7 +382,7 @@ struct MainWindow: View {
         .menuStyle(.borderlessButton)
         .help("Change appearance")
         .accessibilityLabel("Appearance")
-        .accessibilityValue(theme.appearance.label)
+        .accessibilityValue(Text(LocalizedStringKey(theme.appearance.label)))
     }
 
     private var sidebarLabelColor: Color {
```

---

### Incident Patch 5: `e49162f9` (2026-07-30)
**Commit Message**: fix(l10n): apply appearance name localization in MainWindow

The appearance name (System/Light/Dark) was rendered via Text(String)
and Label(String, systemImage:), which use the non-localizing
initializers. As a result the existing "System"/"Light"/"Dark"
translations were never applied and the labels always showed English.

Wrap the values in LocalizedStringKey (matching AppearancePill) at the
menu item, the sidebar value, and the accessibility value so they
localize correctly.

**File**: `PureMac/Views/MainWindow.swift` (modified, +3/-3)
```diff
@@ -350,7 +350,7 @@ struct MainWindow: View {
                 Button {
                     theme.appearance = appearance
                 } label: {
-                    Label(appearance.label, systemImage: appearance.icon)
+                    Label(LocalizedStringKey(appearance.label), systemImage: appearance.icon)
                 }
             }
         } label: {
@@ -366,7 +366,7 @@ struct MainWindow: View {
 
                 Spacer(minLength: 6)
 
-                Text(theme.appearance.label)
+                Text(LocalizedStringKey(theme.appearance.label))
                     .font(.system(size: 10.5, weight: .medium))
                     .foregroundStyle(.secondary)
 
@@ -382,7 +382,7 @@ struct MainWindow: View {
         .menuStyle(.borderlessButton)
         .help("Change appearance")
         .accessibilityLabel("Appearance")
-        .accessibilityValue(theme.appearance.label)
+        .accessibilityValue(Text(LocalizedStringKey(theme.appearance.label)))
     }
 
     private var sidebarLabelColor: Color {
```

---

### Incident Patch 6: `38736d73` (2026-07-30)
**Commit Message**: localization: localize dynamic UI strings

**File**: `PureMac/PureMacApp.swift` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ class AppDelegate: NSObject, NSApplicationDelegate {
         let urls = (pboard.readObjects(forClasses: [NSURL.self],
                                        options: [.urlReadingFileURLsOnly: true]) as? [URL]) ?? []
         guard let appURL = urls.first(where: { $0.pathExtension == "app" }) else {
-            error?.pointee = "Select an application (.app) to uninstall." as NSString
+            error?.pointee = String(localized: "Select an application (.app) to uninstall.") as NSString
             return
         }
         NSApp.activate(ignoringOtherApps: true)
```

**File**: `PureMac/Services/MenuBarController.swift` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ final class MenuBarController: NSObject, NSPopoverDelegate {
         if let button = statusItem.button {
             button.image = NSImage(
                 systemSymbolName: "gauge.with.dots.needle.67percent",
-                accessibilityDescription: "System Monitor"
+                accessibilityDescription: String(localized: "System Monitor")
             )
             button.imagePosition = .imageLeading
             button.target = self
```

**File**: `PureMac/Services/ScanEngine.swift` (modified, +12/-12)
```diff
@@ -226,37 +226,37 @@ actor ScanEngine {
     private func scanAIApps() -> CategoryResult {
         let targets = [
             CleanupTarget(
-                name: "Ollama Logs",
+                name: String(localized: "Ollama Logs"),
                 path: "\(home)/.ollama/logs"
             ),
             CleanupTarget(
-                name: "Ollama Cache",
+                name: String(localized: "Ollama Cache"),
                 path: "\(home)/Library/Caches/ollama"
             ),
             CleanupTarget(
-                name: "Ollama Electron Cache",
+                name: String(localized: "Ollama Electron Cache"),
                 path: "\(home)/Library/Caches/com.electron.ollama"
             ),
             CleanupTarget(
-                name: "Ollama WebKit Data",
+                name: String(localized: "Ollama WebKit Data"),
                 path: "\(home)/Library/WebKit/com.electron.ollama"
             ),
             CleanupTarget(
-                name: "Ollama Saved State",
+                name: String(localized: "Ollama Saved State"),
                 path: "\(home)/Library/Saved Application State/com.electron.ollama.savedState"
             ),
             CleanupTarget(
-                name: "Ollama CLI Prompt History (Optional)",
+                name: String(localized: "Ollama CLI Prompt History (Optional)"),
                 path: "\(home)/.ollama/history",
                 isSelected: false,
                 minimumSize: 0
             ),
             CleanupTarget(
-                name: "LM Studio Server Logs",
+                name: String(localized: "LM Studio Server Logs"),
                 path: "\(home)/.lmstudio/server-logs"
             ),
             CleanupTarget(
-                name: "LM Studio Conversations (Optional)",
+                name: String(localized: "LM Studio Conversations (Optional)"),
                 path: "\(home)/.lmstudio/conversations",
                 isSelected: false,
                 minimumSize: 0
@@ -572,12 +572,12 @@ actor ScanEngine {
 
         let managers: [ManagerCache] = [
             ManagerCache(
-                name: "npm cache",
+                name: String(localized: "npm cache"),
                 defaultPath: "\(home)/.npm",
                 detectionCommand: (cli: "npm", args: ["config", "get", "cache"])
             ),
             ManagerCache(
-                name: "yarn classic cache",
+                name: String(localized: "yarn classic cache"),
                 defaultPath: "\(home)/Library/Caches/Yarn",
                 detectionCommand: (cli: "yarn", args: ["cache", "dir"])
             ),
@@ -586,7 +586,7 @@ actor ScanEngine {
             // touched by a system cleaner. The classic cache above remains the
             // global, safe-to-clean location.
             ManagerCache(
-                name: "pnpm content-addressable store",
+                name: String(localized: "pnpm content-addressable store"),
                 defaultPath: "\(home)/Library/pnpm/store",
                 detectionCommand: (cli: "pnpm", args: ["store", "path"])
             ),
@@ -735,7 +735,7 @@ actor ScanEngine {
         for dockerBin in dockerBinPaths where fileManager.fileExists(atPath: dockerBin) {
             if let reclaimable = reclaimableDockerSpace(dockerBin: dockerBin), reclaimable > 0 {
                 items.append(CleanableItem(
-                    name: "Docker prune (stopped containers, dangling images, build cache)",
+                    name: String(localized: "Docker prune (stopped containers, dangling images, build cache)"),
                     path: "",
                     size: reclaimable,
                     category: .dockerCache,
```

**File**: `PureMac/Views/Components/DashboardCharts.swift` (modified, +1/-1)
```diff
@@ -231,7 +231,7 @@ struct CategoryBarChart: View {
         return Chart(bars) { bar in
             BarMark(
                 x: .value("Size", Double(bar.size) * reveal),
-                y: .value("Category", bar.name)
+                y: .value(String(localized: "Category"), bar.name)
             )
             .foregroundStyle(bar.category.color.gradient)
             .cornerRadius(5)
```

**File**: `PureMac/Views/Components/FDADemoView.swift` (modified, +1/-1)
```diff
@@ -170,7 +170,7 @@ struct FDADemoView: View {
     }
 
     private struct DemoRow {
-        let name: String
+        let name: LocalizedStringKey
         let systemImage: String
         let granted: Bool
         var isPureMac: Bool = false
```

**File**: `PureMac/Views/Components/PermissionSheet.swift` (modified, +6/-4)
```diff
@@ -50,9 +50,11 @@ struct PermissionSheet: View {
             VStack(alignment: .leading, spacing: 2) {
                 Text(coordinator.context.headline)
                     .font(.system(size: 16, weight: .bold))
-                Text(coordinator.hasFullDiskAccess
-                     ? "Access granted. Retrying…"
-                     : "1-tap setup. We'll detect the change automatically.")
+                Text(LocalizedStringKey(
+                    coordinator.hasFullDiskAccess
+                        ? "Access granted. Retrying…"
+                        : "1-tap setup. We'll detect the change automatically."
+                ))
                     .font(.system(size: 12))
                     .foregroundStyle(.secondary)
             }
@@ -160,7 +162,7 @@ struct PermissionSheet: View {
                     .font(.system(size: 11.5))
                     .foregroundStyle(.secondary)
                 Spacer()
-                Button(showAdvanced ? "Hide help" : "PureMac not in the list?") {
+                Button(LocalizedStringKey(showAdvanced ? "Hide help" : "PureMac not in the list?")) {
                     withAnimation(.easeInOut(duration: 0.25)) { showAdvanced.toggle() }
                 }
                 .buttonStyle(.link)
```

**File**: `PureMac/Views/OnboardingView.swift` (modified, +17/-13)
```diff
@@ -137,7 +137,7 @@ struct OnboardingView: View {
                 Button("Start") { isComplete = true }
                     .buttonStyle(GlowProminentButtonStyle(breathes: true))
             } else {
-                Button(page == .permission ? "Continue" : "Next") { advance(by: 1) }
+                Button(LocalizedStringKey(page == .permission ? "Continue" : "Next")) { advance(by: 1) }
                     .buttonStyle(.borderedProminent)
                     .controlSize(.large)
             }
@@ -307,10 +307,10 @@ private struct MissionScene: View {
 private struct FeatureRow: View {
     let systemImage: String
     let tint: Color
-    let title: String
-    let body_: String
+    let title: LocalizedStringKey
+    let body_: LocalizedStringKey
 
-    init(systemImage: String, tint: Color, title: String, body: String) {
+    init(systemImage: String, tint: Color, title: LocalizedStringKey, body: LocalizedStringKey) {
         self.systemImage = systemImage
         self.tint = tint
         self.title = title
@@ -347,12 +347,14 @@ private struct PermissionScene: View {
     var body: some View {
         VStack(spacing: 18) {
             VStack(spacing: 8) {
-                Text(hasFda ? "Permission granted" : "One permission, then we're done")
+                Text(LocalizedStringKey(hasFda ? "Permission granted" : "One permission, then we're done"))
                     .font(.system(size: 26, weight: .semibold))
                     .multilineTextAlignment(.center)
-                Text(hasFda
-                     ? "PureMac can now reach the locations macOS protects by default."
-                     : "macOS hides certain folders from every app until you say otherwise. We need them to find caches and uninstall cleanly.")
+                Text(LocalizedStringKey(
+                    hasFda
+                        ? "PureMac can now reach the locations macOS protects by default."
+                        : "macOS hides certain folders from every app until you say otherwise. We need them to find caches and uninstall cleanly."
+                ))
                     .font(.system(size: 13))
                     .foregroundStyle(.secondary)
                     .multilineTextAlignment(.center)
@@ -382,7 +384,7 @@ private struct PermissionScene: View {
                         Button {
                             openSettings()
                         } label: {
-                            Label(hasOpenedSettings ? "Reopen Settings" : "Open Settings & reveal PureMac",
+                            Label(LocalizedStringKey(hasOpenedSettings ? "Reopen Settings" : "Open Settings & reveal PureMac"),
                                   systemImage: "gear")
                                 .font(.system(size: 13, weight: .semibold))
                                 .frame(minWidth: 240)
@@ -473,11 +475,13 @@ private struct ReadyScene: View {
                 }
 
                 VStack(spacing: 10) {
-                    Text(hasFda ? "You're ready" : "Ready when you are")
+                    Text(LocalizedStringKey(hasFda ? "You're ready" : "Ready when you are"))
                         .font(.system(size: 30, weight: .semibold))
-                    Text(hasFda
-                         ? "Hit Start to run your first Smart Scan."
-                         : "Some features will be limited without Full Disk Access. You can grant it later in Settings.")
+                    Text(LocalizedStringKey(
+                        hasFda
+                            ? "Hit Start to run your first Smart Scan."
+                            : "Some features will be limited without Full Disk Access. You can grant it later in Settings."
+                    ))
                         .font(.system(size: 13.5))
                         .foregroundStyle(.secondary)
                         .multilineTextAlignment(.center)
```

**File**: `PureMac/Views/Orphans/OrphanListView.swift` (modified, +6/-2)
```diff
@@ -156,7 +156,7 @@ struct OrphanListView: View {
 
         for url in urlsToRemove {
             guard OrphanSafetyPolicy.isSafeCandidate(url) else {
-                failedPaths.append("\(url.path) (blocked by safety policy)")
+                failedPaths.append("\(url.path) (\(String(localized: "blocked by safety policy")))")
                 continue
             }
 
@@ -198,7 +198,11 @@ struct OrphanListView: View {
         if !failedPaths.isEmpty {
             let preview = failedPaths.prefix(3).joined(separator: "\n")
             let suffix = failedPaths.count > 3 ? "\n…" : ""
-            removalErrorMessage = "\(failedPaths.count) item(s) failed to delete.\n\n\(preview)\(suffix)"
+            removalErrorMessage = String(
+                format: String(localized: "%lld item(s) failed to delete.\n\n%@"),
+                Int64(failedPaths.count),
+                preview + suffix
+            )
         }
     }
 
```

---

### Incident Patch 7: `fb3e5ad3` (2026-07-19)
**Commit Message**: app icon: continuous-curvature squircle + drop shadow; bump 2.9.2

The 2.9.1 icon used a plain rounded-rectangle mask with no margin
shadow, so it sat flat and oversized next to system icons in the app
switcher. The master is now cut with a superellipse (n=5) matching
Apple's continuous corner curvature and composited with the standard
soft drop shadow inside the 1024 px canvas margin.

Claude-Session: https://claude.ai/code/session_01QyFNvecmmotai2A9TkYAGh

**File**: `project.yml` (modified, +2/-2)
```diff
@@ -23,8 +23,8 @@ settings:
     CODE_SIGN_ENTITLEMENTS: "PureMac/PureMac.entitlements"
     INFOPLIST_FILE: "PureMac/Info.plist"
     PRODUCT_BUNDLE_IDENTIFIER: "com.puremac.app"
-    MARKETING_VERSION: "2.9.1"
-    CURRENT_PROJECT_VERSION: "22"
+    MARKETING_VERSION: "2.9.2"
+    CURRENT_PROJECT_VERSION: "23"
     GENERATE_INFOPLIST_FILE: "NO"
     ASSETCATALOG_COMPILER_APPICON_NAME: "AppIcon"
     COMBINE_HIDPI_IMAGES: "YES"
```

---

### Incident Patch 8: `695eb259` (2026-07-19)
**Commit Message**: cleanup depth: universal binaries, language files, deeper caches; fix wifi.log and Docker cleaning; bump 2.9.0

Two new categories close the gap against CleanMyMac:

- Universal Binaries: parses FAT Mach-O headers (main executable plus
  frameworks) and strips the non-native slice via a staged clone: APFS
  clone of the bundle, lipo on the clone, ad-hoc re-sign, codesign
  --verify --deep --strict, atomic swap. Any failure discards the clone
  and leaves the original untouched. Apps with restricted entitlements
  and App Store apps are refused or unselected.
- Language Files: removes unused .lproj folders through the same staged
  re-sign flow so the signature seal stays valid. Keeps preferred
  languages, CFBundleDevelopmentRegion, per-app AppleLanguages, en, Base.
Both are unselected by default and excluded from scheduled auto-clean.

Scanner depth fixes:
- directorySize dropped its 10,000-entry cap, which truncated DerivedData
  to a fraction of its real size. Now uses totalFileAllocatedSize with an
  error-tolerant enumerator and honors task cancellation.
- Xcode junk adds DeviceSupport (iOS/watchOS/tvOS), XCTestDevices,
  Previews, and SwiftPM caches.
- User cache now covers s

**File**: `PureMac/Logic/Scanning/LanguageFilesScanner.swift` (added, +214/-0)
```diff
@@ -0,0 +1,214 @@
+import Foundation
+
+/// One app bundle with localization folders the user's system does not need.
+struct LanguageFileFinding: Sendable {
+    /// A single removable localization folder inside Contents/Resources.
+    struct Lproj: Sendable {
+        /// Full path to the .lproj folder.
+        let path: String
+        /// Recursive size of the folder in bytes.
+        let size: Int64
+    }
+
+    /// Bundle name without the .app suffix.
+    let appName: String
+    /// Full path to the .app bundle.
+    let appPath: String
+    /// Removable .lproj folders found in the bundle.
+    let lprojs: [Lproj]
+    /// True when Contents/_MASReceipt is present. An App Store update or
+    /// re-download restores stripped localizations anyway, so callers should
+    /// leave these findings unselected by default.
+    let appStore: Bool
+
+    /// Combined size of all removable folders in the bundle.
+    var totalBytes: Int64 { lprojs.reduce(0) { $0 + $1.size } }
+}
+
+/// Finds unused .lproj localization folders inside installed app bundles
+/// (the CleanMyMac "Language Files" feature). Pure logic - nothing is deleted
+/// here. The integrator surfaces each removable .lproj as its own
+/// CleanableItem (see `flatten`), and deletion runs through the existing
+/// CleaningEngine.removeItem flow.
+struct LanguageFilesScanner: Sendable {
+
+    /// Normalized language keys that must never be flagged as removable.
+    /// Built from Locale.preferredLanguages - "en-US" keeps "en" plus the
+    /// "en-US"/"en_US" variants - and always includes en, English (the legacy
+    /// folder name) and Base, which apps rely on as fallbacks.
+    var keepLanguages: Set<String> {
+        var keep: Set<String> = ["en", "english", "base"]
+        for language in Locale.preferredLanguages {
+            // "en-us" also keeps plain "en" so regional variants of a
+            // preferred language survive.
+            Self.insertWithBase(Self.normalize(language), into: &keep)
+        }
+        return keep
+    }
+
+    /// Scans the given application directories (top level plus one nested
+    /// level, e.g. /Applications/Utilities) and returns one finding per app
+    /// bundle that has removable localizations. Apps under /System and the
+    /// PureMac bundle itself are never reported.
+    func scan(applicationDirs: [String]) -> [LanguageFileFinding] {
+        let fileManager = FileManager.default
+        let keep = keepLanguages
+        let ownPath = (Bundle.main.bundlePath as NSString).standardizingPath
+
+        var findings: [LanguageFileFinding] = []
+        for dir in applicationDirs {
+            for appPath in appBundles(in: dir, fileManager: fileManager) {
+                if let finding = inspect(appPath: appPath, keep: keep, ownPath: ownPath, fileManager: fileManager) {
+                    findings.append(finding)
+                }
+            }
+        }
+
+        return findings.sorted { $0.totalBytes > $1.totalBytes }
+    }
+
+    /// Expands per-app findings into one entry per removable .lproj so the
+    /// integrator can surface each folder as its own CleanableItem. Entries
+    /// are named "<App> - <language display name>".
+    func flatten(_ findings: [LanguageFileFinding]) -> [(name: String, path: String, size: Int64, appStore: Bool)] {
+        findings.flatMap { finding in
+            finding.lprojs.map { lproj in
+                let code = ((lproj.path as NSString).lastPathComponent as NSString).deletingPathExtension
+                let identifier = code.replacingOccurrences(of: "_", with: "-")
+                let display = Locale.current.localizedString(forIdentifier: identifier) ?? code
+                return (name: "\(finding.appName) - \(display)", path: lproj.path, size: lproj.size, appStore: finding.appStore)
+            }
+        }
+    }
+
+    // MARK: - Private
+
+    /// Lowercases and unifies separators so "pt_BR", "pt-BR" and "pt-br" all
+    /// compare equal.
+    private static func normalize(_ language: String) -> String {
+        language.lowercased().replacingOccurrences(of: "_", with: "-")
+    }
+
+    /// Inserts a normalized language plus its base, so "pt-br" also keeps
+    /// plain "pt".
+    private static func insertWithBase(_ normalized: String, into keep: inout Set<String>) {
+        keep.insert(normalized)
+        if let base = normalized.split(separator: "-").first {
+            keep.insert(String(base))
+        }
+    }
+
+    /// Lists .app bundles at the top level of `dir` and one nested level
+    /// below it. A missing directory (e.g. ~/Applications) is treated as
+    /// empty.
+    private func appBundles(in dir: String, fileManager: FileManager) -> [String] {
+        guard let topLevel = try? fileManager.contentsOfDirectory(atPath: dir) else { return [] }
+
+        var bundles: [String] = []
+        for entry in topLevel {
+            let path = dir + "/" + entry
+            if entry.hasSuffix(".app")
```

**File**: `PureMac/Logic/Scanning/UniversalBinaryScanner.swift` (added, +343/-0)
```diff
@@ -0,0 +1,343 @@
+import Foundation
+
+/// One fat Mach-O file inside an app bundle, together with the slices that
+/// can be stripped on this machine and the bytes doing so would reclaim.
+/// `removableArchs` uses lipo's arch spelling ("x86_64", "arm64", ...) so it
+/// can be passed straight to `lipo -remove` by BinaryThinner.
+struct FatBinary: Sendable {
+    let path: String
+    let removableArchs: [String]
+    let reclaimableBytes: Int64
+}
+
+/// A universal-binary discovery for one app bundle: the app's main
+/// executable plus every fat framework/dylib found under Contents/Frameworks
+/// (where most of the savings live for Electron apps). `appStore` marks apps
+/// carrying a _MASReceipt — thinning those can break receipt validation, so
+/// the caller should surface them unselected by default.
+struct UniversalBinaryFinding: Identifiable, Sendable {
+    let id = UUID()
+    let appPath: String
+    let appName: String
+    let executablePath: String
+    let nativeArch: String
+    /// Union of removable arch names across all fat binaries in the bundle.
+    let removableArchs: [String]
+    /// Total bytes freed by stripping every foreign slice in the bundle.
+    let reclaimableBytes: Int64
+    let appStore: Bool
+    /// Every fat Mach-O in the bundle with per-file removable archs — the
+    /// exact work list BinaryThinner executes.
+    let fatBinaries: [FatBinary]
+}
+
+/// Finds universal (fat) app binaries carrying a slice for the architecture
+/// this Mac does not run natively, and computes how many bytes stripping the
+/// foreign slice would reclaim. Pure logic — no mutation, no privileged
+/// operations — so it stays a plain Sendable struct rather than an actor.
+///
+/// The FAT header is parsed by hand from the first 4 KB of each candidate
+/// file instead of shelling out to `lipo -info` per file: an /Applications
+/// walk touches thousands of framework binaries and process spawns would
+/// dominate the scan time.
+struct UniversalBinaryScanner: Sendable {
+
+    // MARK: - Mach-O constants (values as they appear byte-swapped from disk)
+
+    private static let fatMagic: UInt32 = 0xcafe_babe
+    private static let fatMagic64: UInt32 = 0xcafe_babf
+    private static let cpuTypeX86_64: UInt32 = 0x0100_0007
+    private static let cpuTypeARM64: UInt32 = 0x0100_000c
+
+    /// lipo arch spelling per (cputype, masked cpusubtype). arm64e and x86_64h
+    /// are distinct lipo names, so the subtype matters for `-remove` to hit
+    /// the right slice.
+    private static func archName(cpuType: UInt32, cpuSubtype: UInt32) -> String? {
+        // High byte of cpusubtype carries capability flags (e.g. LIB64,
+        // PTRAUTH versioning) — mask them off before matching.
+        let subtype = cpuSubtype & 0x00ff_ffff
+        switch (cpuType, subtype) {
+        case (0x0000_0007, _): return "i386"
+        case (Self.cpuTypeX86_64, 8): return "x86_64h"
+        case (Self.cpuTypeX86_64, _): return "x86_64"
+        case (0x0000_000c, _): return "arm"
+        case (Self.cpuTypeARM64, 2): return "arm64e"
+        case (Self.cpuTypeARM64, _): return "arm64"
+        default: return nil
+        }
+    }
+
+    /// The machine's native architecture, asked of the kernel at runtime.
+    /// A compile-time #if arch check would follow whichever slice PureMac
+    /// itself runs as — under Rosetta the x86_64 slice would classify every
+    /// app's native arm64/arm64e slices as removable, and thinning would
+    /// strip them. hw.optional.arm64 is absent on Intel hardware.
+    private static let hostIsARM64: Bool = {
+        var value: Int32 = 0
+        var size = MemoryLayout<Int32>.size
+        guard sysctlbyname("hw.optional.arm64", &value, &size, nil, 0) == 0 else {
+            return false
+        }
+        return value == 1
+    }()
+    private static var hostCPUType: UInt32 { hostIsARM64 ? cpuTypeARM64 : cpuTypeX86_64 }
+    private static var hostArchName: String { hostIsARM64 ? "arm64" : "x86_64" }
+
+    private var fileManager: FileManager { .default }
+
+    // MARK: - Public API
+
+    /// Walks the given application directories (top level plus one nested
+    /// level, so apps grouped in subfolders like /Applications/Utilities are
+    /// found) and returns one finding per app that has at least one foreign
+    /// slice to strip.
+    ///
+    /// Skipped entirely: anything under /System, and PureMac itself (thinning
+    /// the running binary out from under the process is asking for trouble).
+    /// App Store apps (Contents/_MASReceipt present) are still reported but
+    /// flagged `appStore = true`.
+    func scan(
+        applicationDirs: [String] = ["/Applications", "\(NSHomeDirectory())/Applications"]
+    ) -> [UniversalBinaryFinding] {
+        var findings: [UniversalBinaryFinding] = []
+        let ownBundlePath = Bundle.main.bundleURL.resolvingSymlinksInPath().path
+
+        for dir in applicationDirs {
+            for appPath in ap
```

**File**: `PureMac/Logic/Utilities/FileProtection.swift` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+import Foundation
+
+/// Shared SIP/immutability check used by both ScanEngine (so protected
+/// entries never surface as cleanable items) and CleaningEngine (so a
+/// protected survivor is reported as "skipped, protected by macOS" instead
+/// of a scary removal error).
+enum FileProtection {
+
+    /// True when the entry is SIP-protected or immutable: BSD flags carry
+    /// SF_RESTRICTED/SF_IMMUTABLE/UF_IMMUTABLE, or the path has the
+    /// com.apple.rootless xattr. Deleting these fails even with admin
+    /// privileges.
+    static func isProtectedFromDeletion(path: String) -> Bool {
+        var sb = stat()
+        if lstat(path, &sb) == 0 {
+            // SF_RESTRICTED (0x00080000) isn't exported by Darwin's Swift
+            // overlay, so spell out the literal; the immutable flags are.
+            let protectedFlags: UInt32 = 0x0008_0000 | UInt32(SF_IMMUTABLE) | UInt32(UF_IMMUTABLE)
+            if sb.st_flags & protectedFlags != 0 {
+                return true
+            }
+        }
+
+        // SIP also marks paths with the com.apple.rootless xattr, which
+        // can be present even when st_flags reads 0.
+        let bufSize = listxattr(path, nil, 0, XATTR_NOFOLLOW)
+        if bufSize > 0 {
+            var buffer = [CChar](repeating: 0, count: bufSize)
+            let read = listxattr(path, &buffer, bufSize, XATTR_NOFOLLOW)
+            if read > 0 {
+                let names = Data(bytes: &buffer, count: read)
+                    .split(separator: 0)
+                    .compactMap { String(data: $0, encoding: .utf8) }
+                if names.contains("com.apple.rootless") {
+                    return true
+                }
+            }
+        }
+
+        return false
+    }
+}
```

**File**: `PureMac/Models/Models.swift` (modified, +17/-0)
```diff
@@ -15,6 +15,8 @@ enum CleaningCategory: String, CaseIterable, Identifiable, Codable {
     case brewCache = "Brew Cache"
     case nodeCache = "Node Cache"
     case dockerCache = "Docker Cache"
+    case universalBinaries = "Universal Binaries"
+    case languageFiles = "Language Files"
 
     var id: String { rawValue }
 
@@ -32,6 +34,8 @@ enum CleaningCategory: String, CaseIterable, Identifiable, Codable {
         case .brewCache: return "mug.fill"
         case .nodeCache: return "leaf.fill"
         case .dockerCache: return "shippingbox.fill"
+        case .universalBinaries: return "cpu"
+        case .languageFiles: return "globe"
         }
     }
 
@@ -49,6 +53,8 @@ enum CleaningCategory: String, CaseIterable, Identifiable, Codable {
         case .brewCache: return "Homebrew download cache"
         case .nodeCache: return "npm, yarn, and pnpm download caches"
         case .dockerCache: return "Docker images, containers, and build cache"
+        case .universalBinaries: return "Unused CPU architecture slices in app binaries"
+        case .languageFiles: return "Unused app localizations"
         }
     }
 
@@ -66,6 +72,8 @@ enum CleaningCategory: String, CaseIterable, Identifiable, Codable {
         case .brewCache: return .mint
         case .nodeCache: return .pink
         case .dockerCache: return .indigo
+        case .universalBinaries: return .brown
+        case .languageFiles: return .gray
         }
     }
 
@@ -80,6 +88,15 @@ enum CleaningCategory: String, CaseIterable, Identifiable, Codable {
     static var scannable: [CleaningCategory] {
         allCases.filter { $0 != .smartScan && $0 != .purgeableSpace }
     }
+
+    // Categories that rewrite app bundles in place (binary thinning,
+    // localization stripping) instead of deleting junk. Their items always
+    // start unselected, and the scheduled autoClean path skips them
+    // entirely — re-signing every installed app is never an unattended
+    // action.
+    static var appModifying: Set<CleaningCategory> {
+        [.universalBinaries, .languageFiles]
+    }
 }
 
 // MARK: - Scan State
```

**File**: `PureMac/Services/BinaryThinner.swift` (added, +323/-0)
```diff
@@ -0,0 +1,323 @@
+import Foundation
+
+/// Strips foreign-architecture slices from the fat binaries of one app
+/// bundle (a UniversalBinaryFinding from UniversalBinaryScanner) and ad-hoc
+/// re-signs the bundle so Gatekeeper still accepts it. Also removes .lproj
+/// localization folders through the same flow, because deleting sealed
+/// resources with a plain unlink breaks the bundle's signature.
+///
+/// Safety model — the original bundle is never modified in place:
+///   1. Entitlement gate: apps claiming provisioning-backed entitlements
+///      (com.apple.developer.*, com.apple.application-identifier) are
+///      refused outright. Those entitlements are only honored under an
+///      Apple-issued certificate; an ad-hoc signature carrying them is
+///      killed by AMFI at spawn.
+///   2. Preflight: the bundle and its parent directory must be writable by
+///      the current user (the swap below is two renames in the parent).
+///      Otherwise fail with `needsAdmin` before touching anything; there
+///      is no admin escalation here.
+///   3. Stage: clone the whole bundle to a hidden sibling directory (APFS
+///      makes the copy cheap) and apply every modification — lipo or lproj
+///      removal — to the copy only.
+///   4. Sign the staged copy ad-hoc, then verify it with
+///      `codesign --verify --deep --strict`. Any failure discards the copy
+///      and leaves the original untouched; nothing to roll back, so a
+///      failed sign can never leave a mixed Developer ID / ad-hoc bundle.
+///   5. Strip com.apple.quarantine from the verified copy. The re-sign
+///      changes the cdhash, so a still-quarantined app would otherwise be
+///      re-assessed by Gatekeeper and refused as not notarized.
+///   6. Swap: rename the original aside, rename the staged copy into place,
+///      delete the original. If the delete fails (root-owned contents) the
+///      swap is undone and `needsAdmin` is returned, so "success" always
+///      means the space was actually freed.
+actor BinaryThinner {
+
+    enum ThinningError: LocalizedError {
+        /// Bundle, its parent directory, or its contents not writable by
+        /// this user. Caller decides what to do; this actor never escalates
+        /// privileges.
+        case needsAdmin(String)
+        /// App claims provisioning-backed entitlements that only work under
+        /// its original developer signature; re-signing would stop it
+        /// launching, so it is refused before anything is staged.
+        case restrictedEntitlements(String)
+        case lipoFailed(String, String)
+        case swapFailed(String, String)
+        case codesignFailed(String, String)
+        case verificationFailed(String, String)
+        case nothingToThin(String)
+
+        var errorDescription: String? {
+            switch self {
+            case .needsAdmin(let path):
+                return "Not writable by current user: \(path)"
+            case .restrictedEntitlements(let app):
+                return "Cannot modify \(app): its entitlements require the original developer signature"
+            case .lipoFailed(let path, let detail):
+                return "lipo failed for \(path): \(detail)"
+            case .swapFailed(let path, let detail):
+                return "Could not swap modified bundle into place at \(path): \(detail)"
+            case .codesignFailed(let app, let detail):
+                return "Re-signing failed for \(app): \(detail)"
+            case .verificationFailed(let app, let detail):
+                return "Signature verification failed for \(app): \(detail)"
+            case .nothingToThin(let app):
+                return "No removable slices in \(app)"
+            }
+        }
+    }
+
+    private let fileManager = FileManager.default
+
+    // MARK: - Public API
+
+    /// Thins every fat binary in the finding and re-signs the bundle.
+    /// Success value is the number of bytes actually freed (sum of
+    /// before-minus-after file sizes, which can differ slightly from the
+    /// scanner's estimate because lipo rewrites the FAT header padding).
+    func thin(_ finding: UniversalBinaryFinding) async -> Result<Int64, Error> {
+        let binaries = finding.fatBinaries.filter { !$0.removableArchs.isEmpty }
+        guard !binaries.isEmpty else {
+            return .failure(ThinningError.nothingToThin(finding.appPath))
+        }
+
+        let appPath = (finding.appPath as NSString).standardizingPath
+        let result = stagedModify(appPath: appPath, appName: finding.appName) { stagedPath in
+            var freedBytes: Int64 = 0
+            for binary in binaries {
+                freedBytes += try self.thinBinary(binary, appPath: appPath, stagedPath: stagedPath)
+            }
+            return freedBytes
+        }
+
+        if case .success(let freed) = result {
+            Logger.shared.log("Thinned \(finding.appName): freed \(freed) bytes across \(binaries.count) bin
```

**File**: `PureMac/Services/CleaningEngine.swift` (modified, +312/-1)
```diff
@@ -2,6 +2,7 @@ import Foundation
 
 actor CleaningEngine {
     private let fileManager = FileManager.default
+    private let binaryThinner = BinaryThinner()
 
     struct CleaningResult {
         var freedSpace: Int64 = 0
@@ -12,6 +13,12 @@ actor CleaningEngine {
         // EPERM. These are root-owned and need an admin-privileged second
         // pass via cleanWithAdminPrivileges(items:).
         var requiresAdmin: [CleanableItem] = []
+        // Paths skipped because they are SIP-protected or immutable (see
+        // FileProtection). Deleting these fails even as root, so they are
+        // recorded here — not in errors — and must never trigger the
+        // "Couldn't clean everything" alert.
+        var protectedPaths: Set<String> = []
+        var skippedProtected: Int { protectedPaths.count }
     }
 
     // MARK: - Public API
@@ -36,6 +43,54 @@ actor CleaningEngine {
                 continue
             }
 
+            if item.category == .universalBinaries {
+                // Thinning is a lipo rewrite plus re-sign, not a file unlink,
+                // so it bypasses the delete path entirely. The item path is
+                // the app bundle; the per-binary work list is re-derived here
+                // so a stale scan can't strip slices that no longer exist.
+                let thinOutcome = await thinUniversalBinaryItem(item)
+                result.freedSpace += thinOutcome.freed
+                if thinOutcome.cleaned {
+                    result.itemsCleaned += 1
+                    result.cleanedPaths.insert(item.path)
+                }
+                if let error = thinOutcome.error {
+                    result.errors.append(error)
+                }
+                continue
+            }
+
+            if item.category == .languageFiles {
+                // Localizations are sealed into the bundle's CodeResources; a
+                // plain unlink would break the app's code signature, so the
+                // folder is removed through BinaryThinner's staged re-sign
+                // flow instead of the delete path.
+                let lprojOutcome = await removeLanguageFileItem(item)
+                result.freedSpace += lprojOutcome.freed
+                if lprojOutcome.cleaned {
+                    result.itemsCleaned += 1
+                    result.cleanedPaths.insert(item.path)
+                }
+                if let error = lprojOutcome.error {
+                    result.errors.append(error)
+                }
+                continue
+            }
+
+            if item.category == .dockerCache && item.path.isEmpty {
+                // The virtual "Docker prune" entry (empty path, like
+                // purgeableSpace) reclaims space inside the Docker/OrbStack VM
+                // via `docker system prune -f` — there is no file to unlink.
+                let pruneOutcome = await pruneDockerSystem()
+                result.freedSpace += pruneOutcome.freed
+                if pruneOutcome.freed > 0 { result.itemsCleaned += 1 }
+                result.cleanedPaths.insert(item.path)
+                if let error = pruneOutcome.error {
+                    result.errors.append(error)
+                }
+                continue
+            }
+
             do {
                 let itemURL = URL(fileURLWithPath: item.path)
                 guard fileManager.fileExists(atPath: item.path) else { continue }
@@ -54,6 +109,8 @@ actor CleaningEngine {
                     if item.category == .largeFiles {
                         return isExplicitSingleFileDeletable(resolvedPath: resolved)
                     }
+                    // languageFiles never reaches here — it is handled above
+                    // via the staged re-sign flow, not the delete path.
                     return isSafeToDelete(resolvedPath: resolved)
                 }()
                 guard pathAccepted else {
@@ -87,6 +144,14 @@ actor CleaningEngine {
                     (nsError.domain == NSPOSIXErrorDomain &&
                         (nsError.code == Int(EACCES) || nsError.code == Int(EPERM)))
                 if isPermissionDenied {
+                    // SIP-protected/immutable entries fail even as root, so
+                    // escalating them just wastes an auth prompt and produces
+                    // a bogus "survived admin removal" error. Record and move on.
+                    if FileProtection.isProtectedFromDeletion(path: item.path) {
+                        result.protectedPaths.insert(item.path)
+                        Logger.shared.log("Skipping SIP-protected path: \(item.path)", level: .info)
+                        continue
+                    }
                     // Defer to the admin pass — these are typically root-owned
                     // system caches that the user-level process can't unlink.
                     result.requiresAdmin.append(item)
@@ -128,6 +193,10 @@ actor CleaningEngine {
                 if item.categ
```

**File**: `PureMac/Services/ScanEngine.swift` (modified, +165/-19)
```diff
@@ -67,6 +67,10 @@ actor ScanEngine {
             return scanNodeCache()
         case .dockerCache:
             return scanDockerCache()
+        case .universalBinaries:
+            return scanUniversalBinaries()
+        case .languageFiles:
+            return scanLanguageFiles()
         }
     }
 
@@ -165,6 +169,55 @@ actor ScanEngine {
             }
         }
 
+        // Sandboxed apps keep their caches inside per-app containers, not
+        // ~/Library/Caches — on modern macOS this is where most of the
+        // "user cache" gigabytes actually live. One item per container,
+        // skipping near-empty caches (< 1 MB).
+        let containerRoots = [
+            "\(home)/Library/Containers",
+            "\(home)/Library/Group Containers",
+        ]
+        for root in containerRoots {
+            guard let containers = try? fileManager.contentsOfDirectory(atPath: root) else { continue }
+            // App containers nest caches under Data/; group containers don't.
+            let cacheSubpath = root.hasSuffix("Group Containers")
+                ? "Library/Caches"
+                : "Data/Library/Caches"
+            for container in containers {
+                let cachePath = (root as NSString)
+                    .appendingPathComponent(container)
+                    .appending("/" + cacheSubpath)
+                // Same symlink defense as scanDirectory: an app at this UID
+                // could plant Data or Data/Library as a symlink into an
+                // allow-listed root and have the target sized here and later
+                // deleted. Only accept paths that resolve to themselves.
+                let resolvedCachePath = URL(fileURLWithPath: cachePath).resolvingSymlinksInPath().path
+                guard normalizePath(resolvedCachePath) == normalizePath(cachePath) else { continue }
+                if let item = makeCleanupItem(
+                    name: "\(container) (sandbox cache)",
+                    path: cachePath,
+                    category: .userCache,
+                    minimumSize: 1024 * 1024
+                ) {
+                    items.append(item)
+                }
+            }
+        }
+
+        // Per-app HTTP cookie/response storage — one entry per app, same
+        // non-recursive shape as the top-level Caches pass above. CFNetwork
+        // keeps each native app's cookies and HSTS state here, i.e. live
+        // login sessions rather than regenerable cache, so these entries
+        // start unselected and the user opts in per app.
+        let httpStorages = scanDirectory(
+            path: "\(home)/Library/HTTPStorages",
+            category: .userCache,
+            recursive: false,
+            maxDepth: 1,
+            isSelected: false
+        )
+        items.append(contentsOf: httpStorages)
+
         let uniqueItems = deduplicatedItems(items)
         let totalSize = uniqueItems.reduce(0) { $0 + $1.size }
         return CategoryResult(category: .userCache, items: uniqueItems, totalSize: totalSize)
@@ -388,6 +441,18 @@ actor ScanEngine {
             "\(home)/Library/Developer/Xcode/Archives",
             "\(home)/Library/Developer/CoreSimulator/Caches",
             "\(home)/Library/Caches/com.apple.dt.Xcode",
+            // Per-OS symbol caches, regenerated on next device connect.
+            // These alone are often tens of GB on active dev machines.
+            "\(home)/Library/Developer/Xcode/iOS DeviceSupport",
+            "\(home)/Library/Developer/Xcode/watchOS DeviceSupport",
+            "\(home)/Library/Developer/Xcode/tvOS DeviceSupport",
+            // Simulator clones spun up by xcodebuild test runs
+            "\(home)/Library/Developer/XCTestDevices",
+            // SwiftUI preview build products
+            "\(home)/Library/Developer/Xcode/UserData/Previews",
+            // Swift Package Manager download + build caches
+            "\(home)/Library/Caches/org.swift.swiftpm",
+            "\(home)/Library/org.swift.swiftpm",
         ]
 
         for path in xcodePaths {
@@ -632,6 +697,14 @@ actor ScanEngine {
             "\(home)/.docker/cli-plugins/.cache",
             // Buildx / containerd inline cache
             "\(home)/.docker/buildx/cache",
+            // OrbStack (Docker Desktop alternative) keeps its daemon logs and
+            // caches outside ~/Library/Containers. The VM data disk itself
+            // (~/.orbstack/data) is intentionally NOT listed — image/container
+            // space inside the VM is only reclaimable via `docker system
+            // prune`, surfaced as the virtual entry below.
+            "\(home)/.orbstack/log",
+            "\(home)/Library/Caches/dev.kdrag0n.MacVirt",
+            "\(home)/Library/Logs/OrbStack",
         ]
 
         for path in dockerDataDirs {
@@ -648,17 +721,22 @@ actor ScanEngine {
             ))
         }
 
-        // If the `docker` CLI is available, surface reclaimable space
-        // reported by `dock
```

**File**: `PureMac/ViewModels/AppState.swift` (modified, +31/-5)
```diff
@@ -750,6 +750,7 @@ final class AppState: ObservableObject {
             result.itemsCleaned += admin.itemsCleaned
             result.freedSpace += admin.freedSpace
             result.errors.append(contentsOf: admin.errors)
+            result.protectedPaths.formUnion(admin.protectedPaths)
         }
 
         totalFreedSpace = result.freedSpace
@@ -777,7 +778,7 @@ final class AppState: ObservableObject {
         // Route survivors back through the same outcome path the original
         // cleanup uses. Without this, an FDA revocation between grant and
         // retry would silently drop errors instead of re-popping the sheet.
-        let survivors = items.filter { !result.cleanedPaths.contains($0.path) }
+        let survivors = survivingItems(from: items, result: result)
         handleCleanOutcome(errors: result.errors, survivors: survivors)
 
         scanState = .cleaned
@@ -883,13 +884,14 @@ final class AppState: ObservableObject {
                 result.itemsCleaned += admin.itemsCleaned
                 result.freedSpace += admin.freedSpace
                 result.errors.append(contentsOf: admin.errors)
+                result.protectedPaths.formUnion(admin.protectedPaths)
             }
 
             totalFreedSpace = result.freedSpace
             lastCleanedDate = Date()
             if result.itemsCleaned > 0 { Haptics.successWithSound() }
 
-            let survivors = itemsToClean.filter { !result.cleanedPaths.contains($0.path) }
+            let survivors = survivingItems(from: itemsToClean, result: result)
 
             for (cat, catResult) in categoryResults {
                 let remaining = catResult.items.filter { !result.cleanedPaths.contains($0.path) }
@@ -944,6 +946,7 @@ final class AppState: ObservableObject {
                 cleanResult.itemsCleaned += admin.itemsCleaned
                 cleanResult.freedSpace += admin.freedSpace
                 cleanResult.errors.append(contentsOf: admin.errors)
+                cleanResult.protectedPaths.formUnion(admin.protectedPaths)
             }
 
             totalFreedSpace = cleanResult.freedSpace
@@ -968,7 +971,7 @@ final class AppState: ObservableObject {
             }
             totalJunkSize = categoryResults.values.reduce(0) { $0 + $1.totalSize }
 
-            let survivors = selectedItems.filter { !cleanResult.cleanedPaths.contains($0.path) }
+            let survivors = survivingItems(from: selectedItems, result: cleanResult)
             handleCleanOutcome(errors: cleanResult.errors, survivors: survivors)
 
             scanState = .cleaned
@@ -980,6 +983,20 @@ final class AppState: ObservableObject {
         }
     }
 
+    /// Items that neither got cleaned nor were skipped as SIP-protected.
+    /// Protected paths can't be removed even as root, so treating them as
+    /// failures only produces a "Couldn't clean everything" alert the user
+    /// can do nothing about (e.g. /private/var/log/wifi.log) — log and move on.
+    private func survivingItems(from items: [CleanableItem], result: CleaningEngine.CleaningResult) -> [CleanableItem] {
+        if result.skippedProtected > 0 {
+            let protectedList = result.protectedPaths.sorted().joined(separator: ", ")
+            Logger.shared.log("Skipped \(result.skippedProtected) macOS-protected item(s): \(protectedList)", level: .info)
+        }
+        return items.filter {
+            !result.cleanedPaths.contains($0.path) && !result.protectedPaths.contains($0.path)
+        }
+    }
+
     /// Inspect a clean batch's leftovers and either route the user into the
     /// PermissionSheet (FDA is the most likely cause) or surface a richer
     /// error alert that lists actual paths instead of "Check the log".
@@ -992,14 +1009,19 @@ final class AppState: ObservableObject {
         }
 
         let fdaGranted = FullDiskAccessManager.shared.hasFullDiskAccess
-        let likelyFDA = !fdaGranted && !survivors.isEmpty
+        // App-modifying survivors (thinning, localization stripping) fail on
+        // root-owned bundles that Full Disk Access cannot make writable, so
+        // they must not steer the user into a Grant Access loop that can
+        // never succeed. Only junk-file survivors count toward that hint.
+        let fdaFixableSurvivors = survivors.filter { !CleaningCategory.appModifying.contains($0.category) }
+        let likelyFDA = !fdaGranted && !fdaFixableSurvivors.isEmpty
         cleanErrorIsFDAFixable = likelyFDA
         pendingPermissionRetryItems = survivors
 
         if likelyFDA {
             cleanError = String(
                 format: String(localized: "%lld item(s) need Full Disk Access to remove. Tap Grant Access to fix in one step."),
-                Int64(survivors.count)
+                Int64(fdaFixableSurvivors.count)
             )
         } else if !survivors.isEmpty {
             let preview = survivors.prefix(2).map { ($0.path as NSString).lastPathComponent }.joined(separator: ", ")
@@ -1036,7 +1058,11 @@ f
```

---

### Incident Patch 9: `47be19af` (2026-07-18)
**Commit Message**: ui overhaul: glow-orb dashboard hero, stacked storage meter, vivid tiles, inline selection strip; bump 2.8.5

AppTheme: CardSurface gets a 14pt radius and optional tint wash, raised
elevation strengthened, IconTile grows a vivid full-saturation mode, new
shared SectionHeader and AmbientBackdrop (layered radial washes, halved
in light mode), GlowProminentButtonStyle large variant for hero CTAs.

Dashboard: hero rebuilt around a 38pt free-space count-up and a
full-width hoverable StackedMeter (Used/Junk/Purgeable/Free with %
shares) plus a large Smart Scan CTA. HealthRing becomes a glowing orb
with layered bloom, a slow conic sheen, and orbiting satellite bubbles,
all gated behind Reduce Motion. Stat cards tinted, composition donut at
148pt with % shares, completed state shows a gradient 40pt junk number
with inline Clean / Scan Again.

CategoryDetail: tinted hero with a 60pt vivid tile and category-tinted
scan button. New inline selection strip (select-all toggle, selected
count and size, destructive glow Clean) replaces the toolbar
Select/Deselect/Clean items. File rows get category-tinted type icons
and a hover-reveal Finder button; same treatment on orphan rows.

AppFilesView hea

**File**: `PureMac/Views/Apps/AppFilesView.swift` (modified, +44/-32)
```diff
@@ -84,8 +84,9 @@ struct AppFilesView: View {
     var body: some View {
         VStack(spacing: 0) {
             header
-
-            Divider()
+                .padding(.horizontal, 16)
+                .padding(.top, 14)
+                .padding(.bottom, 10)
 
             // Content
             if appState.isScanningAppFiles {
@@ -145,39 +146,41 @@ struct AppFilesView: View {
     // MARK: - Header
 
     private var header: some View {
-        HStack(spacing: 12) {
-            Image(nsImage: app.icon)
-                .resizable()
-                .frame(width: 48, height: 48)
-                .scaleEffect(iconHovering && !reduceMotion ? 1.06 : 1)
-                .animation(reduceMotion ? nil : MotionTokens.snappy, value: iconHovering)
-                .onHover { iconHovering = $0 }
-
-            VStack(alignment: .leading, spacing: 2) {
-                Text(app.appName)
-                    .font(.title3.bold())
-                Text(app.bundleIdentifier)
-                    .font(.caption)
-                    .foregroundStyle(.secondary)
-            }
+        CardSurface(padding: 16, tint: Tint.purple) {
+            HStack(spacing: 14) {
+                Image(nsImage: app.icon)
+                    .resizable()
+                    .frame(width: 52, height: 52)
+                    .shadow(color: .black.opacity(0.18), radius: 6, y: 3)
+                    .scaleEffect(iconHovering && !reduceMotion ? 1.06 : 1)
+                    .animation(reduceMotion ? nil : MotionTokens.snappy, value: iconHovering)
+                    .onHover { iconHovering = $0 }
+
+                VStack(alignment: .leading, spacing: 3) {
+                    Text(app.appName)
+                        .font(.system(size: 17, weight: .bold))
+                    Text(app.bundleIdentifier)
+                        .font(.system(size: 11.5))
+                        .foregroundStyle(.secondary)
+                }
 
-            Spacer()
+                Spacer()
 
-            if !appState.discoveredFiles.isEmpty {
-                VStack(alignment: .trailing, spacing: 2) {
-                    Text(filesCountText(count: appState.discoveredFiles.count))
-                        .font(.callout)
-                        .foregroundStyle(.secondary)
-                        .monospacedDigit()
-                        .contentTransition(.numericText())
-                    CountUpBytes(bytes: totalSelectedSize)
-                        .font(.callout.bold())
+                if !appState.discoveredFiles.isEmpty {
+                    VStack(alignment: .trailing, spacing: 2) {
+                        CountUpBytes(bytes: totalSelectedSize)
+                            .font(.system(size: 18, weight: .bold))
+                        Text(filesCountText(count: appState.discoveredFiles.count))
+                            .font(.system(size: 11))
+                            .foregroundStyle(.secondary)
+                            .monospacedDigit()
+                            .contentTransition(.numericText())
+                    }
+                    .animation(reduceMotion ? nil : .spring(response: 0.4, dampingFraction: 0.9),
+                               value: appState.discoveredFiles.count)
                 }
-                .animation(reduceMotion ? nil : .spring(response: 0.4, dampingFraction: 0.9),
-                           value: appState.discoveredFiles.count)
             }
         }
-        .padding()
     }
 
     // MARK: - Scanning state
@@ -297,13 +300,18 @@ struct AppFilesView: View {
     // MARK: - Action bar
 
     private var actionBar: some View {
-        HStack {
+        HStack(spacing: 12) {
             Button("Select All") {
                 appState.selectedFiles = Set(appState.discoveredFiles)
             }
+            .buttonStyle(.bordered)
+            .controlSize(.small)
+
             Button("Deselect All") {
                 appState.selectedFiles.removeAll()
             }
+            .buttonStyle(.bordered)
+            .controlSize(.small)
 
             Spacer()
 
@@ -323,8 +331,12 @@ struct AppFilesView: View {
         }
         .animation(reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.8),
                    value: appState.selectedFiles.isEmpty)
-        .padding()
+        .padding(.horizontal, 16)
+        .padding(.vertical, 12)
         .background(.bar)
+        .overlay(alignment: .top) {
+            Divider().opacity(0.6)
+        }
     }
 
     // MARK: - Helpers
```

**File**: `PureMac/Views/Apps/AppListView.swift` (modified, +1/-1)
```diff
@@ -154,7 +154,7 @@ private struct HoverScaleIcon: View {
     var body: some View {
         Image(nsImage: icon)
             .resizable()
-            .frame(width: 20, height: 20)
+            .frame(width: 22, height: 22)
             .scaleEffect(hovering && !reduceMotion ? 1.12 : 1)
             .animation(reduceMotion ? nil : MotionTokens.snappy, value: hovering)
             .onHover { hovering = $0 }
```

**File**: `PureMac/Views/CategoryDetailView.swift` (modified, +102/-55)
```diff
@@ -25,7 +25,12 @@ struct CategoryDetailView: View {
                     if result.items.isEmpty {
                         EmptyStateView("All Clean", systemImage: "checkmark.circle", description: "No junk files found in this category.", tint: Tint.green)
                     } else {
-                        fileList(result)
+                        VStack(spacing: 0) {
+                            selectionStrip(result)
+                                .padding(.horizontal, 20)
+                                .padding(.bottom, 10)
+                            fileList(result)
+                        }
                     }
                 } else {
                     EmptyStateView("Not Scanned", systemImage: category.icon, description: "Run a scan to analyze this category.", action: { appState.scanSingleCategory(category) }, actionLabel: "Scan Now", tint: category.color)
@@ -44,14 +49,8 @@ struct CategoryDetailView: View {
                 .disabled(appState.scanState.isActive)
             }
 
-            ToolbarItemGroup(placement: .automatic) {
+            ToolbarItem(placement: .automatic) {
                 if let result = result, !result.items.isEmpty {
-                    Button("Select All") {
-                        appState.selectAllInCategory(category)
-                    }
-                    Button("Deselect All") {
-                        appState.deselectAllInCategory(category)
-                    }
                     Button(action: { sortDescending.toggle() }) {
                         Label {
                             Text(LocalizedStringKey(sortDescending ? "Largest First" : "Smallest First"))
@@ -62,24 +61,6 @@ struct CategoryDetailView: View {
                     .help(LocalizedStringKey(sortDescending ? "Sorted: Largest First" : "Sorted: Smallest First"))
                 }
             }
-
-            ToolbarItem(placement: .automatic) {
-                if let _ = result, !appState.scanState.isActive {
-                    let selectedSize = appState.selectedSizeInCategory(category)
-                    let selectedCount = appState.selectedCountInCategory(category)
-                    if selectedSize > 0 {
-                        Button {
-                            showConfirmation = true
-                        } label: {
-                            Label {
-                                Text(cleanItemsLabel(count: selectedCount))
-                            } icon: {
-                                Image(systemName: "trash")
-                            }
-                        }
-                    }
-                }
-            }
         }
         .confirmationDialog(cleanConfirmationTitle, isPresented: $showConfirmation, titleVisibility: .visible) {
             Button("Clean", role: .destructive) {
@@ -109,23 +90,26 @@ struct CategoryDetailView: View {
         let itemCount = result?.itemCount ?? 0
         let isScanning = appState.scanState.isActive
 
-        return CardSurface(padding: 18) {
+        return CardSurface(padding: 20, tint: category.color) {
             HStack(alignment: .center, spacing: 16) {
-                IconTile(systemName: category.icon, tint: category.color, size: 56, corner: 14)
+                IconTile(systemName: category.icon, tint: category.color, size: 60, corner: 16, vivid: true)
 
                 VStack(alignment: .leading, spacing: 4) {
                     Text(LocalizedStringKey(category.rawValue))
-                        .font(.system(size: 22, weight: .semibold))
+                        .font(.system(size: 22, weight: .bold))
                     Text(LocalizedStringKey(category.description))
-                        .font(.system(size: 12))
+                        .font(.system(size: 12.5))
                         .foregroundStyle(.secondary)
                     if itemCount > 0 {
                         Text(itemsAndSizeText(itemCount: itemCount, totalSize: totalSize))
-                            .font(.system(size: 11.5, weight: .medium))
+                            .font(.system(size: 11.5, weight: .semibold))
                             .monospacedDigit()
                             .contentTransition(reduceMotion ? .identity : .numericText())
                             .foregroundStyle(category.color)
-                            .padding(.top, 2)
+                            .padding(.horizontal, 8)
+                            .padding(.vertical, 3)
+                            .background(Capsule().fill(category.color.opacity(0.12)))
+                            .padding(.top, 4)
                             .animation(reduceMotion ? nil : MotionTokens.gentle, value: totalSize)
                     }
                 }
@@ -143,12 +127,73 @@ struct CategoryDetailView: View {
                     .font(.system(size: 12.5, weight: .semibold))
                 }
                 .buttonStyle(.bordered)
+                .tint(category.color)
                 .controlSize(.lar
```

**File**: `PureMac/Views/Components/AppTheme.swift` (modified, +99/-24)
```diff
@@ -83,14 +83,18 @@ enum TintGradient {
 }
 
 /// Tinted square icon container used in the sidebar and on dashboard cards.
-/// Single muted fill, thin border. When `glow` is set (selected sidebar row,
-/// emphasized card) the tile picks up a gradient fill and a soft tinted halo.
+/// Two-stop tinted fill with a hairline inner stroke. When `glow` is set
+/// (selected sidebar row, emphasized card) the tile picks up a stronger
+/// gradient and a soft tinted halo. When `vivid` is set the tile becomes a
+/// full-saturation gradient bubble with a white glyph — reserved for focal
+/// spots (category heroes, result rows) so the chrome stays matte elsewhere.
 struct IconTile: View {
     let systemName: String
     var tint: Color = Tint.blue
     var size: CGFloat = 26
     var corner: CGFloat = 7
     var glow: Bool = false
+    var vivid: Bool = false
 
     @Environment(\.accessibilityReduceMotion) private var reduceMotion
 
@@ -99,50 +103,103 @@ struct IconTile: View {
             RoundedRectangle(cornerRadius: corner, style: .continuous)
                 .fill(
                     LinearGradient(
-                        colors: [tint.opacity(glow ? 0.30 : 0.14), tint.opacity(0.14)],
+                        colors: vivid
+                            ? [tint, tint.opacity(0.72)]
+                            : [tint.opacity(glow ? 0.32 : 0.16), tint.opacity(glow ? 0.16 : 0.07)],
                         startPoint: .topLeading, endPoint: .bottomTrailing
                     )
                 )
-                .shadow(color: tint.opacity(glow ? 0.45 : 0), radius: glow ? 5 : 0)
+                .overlay(
+                    RoundedRectangle(cornerRadius: corner, style: .continuous)
+                        .strokeBorder(vivid ? Color.white.opacity(0.22) : tint.opacity(glow ? 0.38 : 0.20),
+                                      lineWidth: 0.5)
+                )
+                .shadow(color: tint.opacity(vivid ? 0.42 : (glow ? 0.45 : 0)),
+                        radius: vivid ? 6 : (glow ? 5 : 0))
             Image(systemName: systemName)
                 .font(.system(size: size * 0.52, weight: .semibold))
-                .foregroundStyle(tint)
-                .shadow(color: tint.opacity(glow ? 0.5 : 0), radius: glow ? 3 : 0)
+                .foregroundStyle(vivid ? Color.white : tint)
+                .shadow(color: vivid ? Color.black.opacity(0.18) : tint.opacity(glow ? 0.5 : 0),
+                        radius: vivid ? 2 : (glow ? 3 : 0))
         }
         .frame(width: size, height: size)
         .animation(reduceMotion ? nil : MotionTokens.snappy, value: glow)
     }
 }
 
-/// Card surface. Flat fill, hairline border, single soft shadow. No accent
-/// stripe by default — content hierarchy carries the meaning, not chrome.
-/// Pass `material` for a vibrancy/glass panel (used on focal hero states
-/// where a tinted backdrop sits behind the card).
+/// Shared ambient backdrop for the app's detail surfaces: layered radial
+/// washes in jewel tones, concentrated at the top where hero content lives
+/// and fading to nothing at the bottom. Static layers — no Reduce Motion
+/// concerns. Opacities halve in light mode so surfaces stay clean.
+struct AmbientBackdrop: View {
+    @Environment(\.colorScheme) private var colorScheme
+
+    private var strength: Double { colorScheme == .dark ? 1 : 0.55 }
+
+    var body: some View {
+        ZStack {
+            Color(nsColor: .windowBackgroundColor)
+            RadialGradient(
+                colors: [Tint.blue.opacity(0.10 * strength), .clear],
+                center: .topLeading, startRadius: 0, endRadius: 700
+            )
+            RadialGradient(
+                colors: [Tint.purple.opacity(0.08 * strength), .clear],
+                center: .topTrailing, startRadius: 0, endRadius: 620
+            )
+            RadialGradient(
+                colors: [Tint.pink.opacity(0.05 * strength), .clear],
+                center: UnitPoint(x: 0.5, y: -0.15), startRadius: 0, endRadius: 480
+            )
+        }
+        .ignoresSafeArea()
+    }
+}
+
+/// Card surface. Flat fill, hairline border, soft shadow. No accent stripe —
+/// content hierarchy carries the meaning, not chrome. Pass `material` for a
+/// vibrancy/glass panel (used on focal hero states where a tinted backdrop
+/// sits behind the card). Pass `tint` for a barely-there vertical color wash
+/// that gives the card an identity without adding chrome.
 struct CardSurface<Content: View>: View {
     var padding: CGFloat = 16
     /// Retained for callsite compatibility; the accent line is intentionally
     /// not rendered in the restrained design.
     var accent: Color? = nil
     var elevation: CardElevation = .standard
     var material: Material? = nil
+    /// Optional identity wash. Kept under ~7% opacity so text contrast and
+    /// light-mode cleanliness are unaffected.
+    var tint: Color? = nil
     @ViewBuilder var content: Content
 
+    private let cornerR
```

**File**: `PureMac/Views/Components/DashboardCharts.swift` (modified, +105/-7)
```diff
@@ -28,16 +28,56 @@ struct HealthRing: View {
 
     var body: some View {
         ZStack {
+            // Orb body — a deep jewel fill that turns the flat ring into a
+            // glowing sphere. Inset so it never bleeds across the track.
+            Circle()
+                .fill(
+                    RadialGradient(
+                        colors: [arcColor.opacity(0.14), arcColor.opacity(0.05), .clear],
+                        center: .center,
+                        startRadius: 2,
+                        endRadius: 160
+                    )
+                )
+                .padding(lineWidth + 10)
+
+            // Slow conic sheen sweeping the orb interior — the "alive" cue.
+            // Removed entirely under Reduce Motion.
+            if !reduceMotion {
+                TimelineView(.animation) { timeline in
+                    let t = timeline.date.timeIntervalSinceReferenceDate
+                    let angle = (t.truncatingRemainder(dividingBy: 6.0) / 6.0) * 360.0
+                    Circle()
+                        .fill(
+                            AngularGradient(
+                                colors: [.clear, .clear, arcColor.opacity(0.10), .clear],
+                                center: .center
+                            )
+                        )
+                        .rotationEffect(.degrees(angle))
+                }
+                .padding(lineWidth + 10)
+                .clipShape(Circle())
+            }
+
             Circle()
                 .stroke(Color.primary.opacity(0.06), lineWidth: lineWidth)
 
-            // Soft glow layer underneath the crisp arc.
+            // Bloom: a wide soft halo under a tighter, brighter one. The
+            // glow comes from these blurred duplicates of the crisp arc.
             Circle()
                 .trim(from: 0, to: sweep)
-                .stroke(arcColor.opacity(0.5),
+                .stroke(arcColor.opacity(0.35),
                         style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                 .rotationEffect(.degrees(-90))
-                .blur(radius: 9)
+                .blur(radius: 16)
+
+            Circle()
+                .trim(from: 0, to: sweep)
+                .stroke(arcColor.opacity(0.55),
+                        style: StrokeStyle(lineWidth: lineWidth * 0.7, lineCap: .round))
+                .rotationEffect(.degrees(-90))
+                .blur(radius: 7)
 
             Circle()
                 .trim(from: 0, to: sweep)
@@ -225,24 +265,82 @@ struct LegendChip: View {
     let color: Color
     let label: LocalizedStringKey
     let value: String
+    /// Optional share readout ("72%") rendered after the value.
+    var percent: String? = nil
 
     var body: some View {
         HStack(spacing: 7) {
-            RoundedRectangle(cornerRadius: 3, style: .continuous)
+            RoundedRectangle(cornerRadius: 3.5, style: .continuous)
                 .fill(color)
                 .frame(width: 10, height: 10)
             VStack(alignment: .leading, spacing: 0) {
                 Text(label)
                     .font(.system(size: 10.5))
                     .foregroundStyle(.secondary)
-                Text(value)
-                    .font(.system(size: 12, weight: .semibold))
-                    .monospacedDigit()
+                HStack(alignment: .firstTextBaseline, spacing: 4) {
+                    Text(value)
+                        .font(.system(size: 12, weight: .semibold))
+                        .monospacedDigit()
+                    if let percent {
+                        Text(percent)
+                            .font(.system(size: 10, weight: .medium))
+                            .monospacedDigit()
+                            .foregroundStyle(.tertiary)
+                    }
+                }
             }
         }
     }
 }
 
+// MARK: - Stacked meter
+//
+// Full-width segmented storage bar (Used / Junk / Purgeable / Free). Segments
+// sit flush inside one track with thin separators, grow in with a spring on
+// appear, and cross-dim when a legend chip reports a hover. Honors Reduce
+// Motion (instant reveal, instant cross-dim).
+
+struct StackedMeter: View {
+    struct Segment: Identifiable {
+        /// Stable id so legend hover can cross-highlight the matching segment.
+        let id: String
+        let value: Double
+        let color: Color
+    }
+
+    let segments: [Segment]
+    var height: CGFloat = 14
+    /// When set (legend hover), every other segment dims for cross-highlight.
+    var highlightedID: String? = nil
+
+    @State private var reveal: CGFloat = 0
+    @Environment(\.accessibilityReduceMotion) private var reduceMotion
+
+    private var total: Double { max(segments.reduce(0) { $0 + $1.value }, 0.0001) }
+
+    var body: some View {
+        GeometryReader { geo in
+            let separator: CGFloat = 2
+            let available = geo.size.width - separator * CGFloat(max(0, segments.count - 1)
```

**File**: `PureMac/Views/Components/EmptyStateView.swift` (modified, +4/-0)
```diff
@@ -31,8 +31,12 @@ struct EmptyStateView: View {
                 Circle()
                     .fill((tint ?? Color.secondary).opacity(0.10))
                     .frame(width: 96, height: 96)
+                Circle()
+                    .strokeBorder((tint ?? Color.secondary).opacity(0.16), lineWidth: 1)
+                    .frame(width: 96, height: 96)
                 Image(systemName: systemImage)
                     .font(.system(size: 40))
+                    .symbolRenderingMode(.hierarchical)
                     .foregroundStyle(tint ?? Color.secondary)
             }
             // One-shot entrance pop, then a gentle idle float. Both skipped
```

**File**: `PureMac/Views/Components/MenuBarMonitorView.swift` (modified, +18/-6)
```diff
@@ -22,9 +22,16 @@ struct MenuBarMonitorView: View {
 
     var body: some View {
         VStack(alignment: .leading, spacing: 12) {
-            Text("System Monitor")
-                .font(.system(size: 13, weight: .semibold))
-                .foregroundStyle(.primary)
+            HStack(spacing: 7) {
+                if let appIcon = NSImage(named: "AppIcon") {
+                    Image(nsImage: appIcon)
+                        .resizable()
+                        .frame(width: 18, height: 18)
+                }
+                Text("System Monitor")
+                    .font(.system(size: 13, weight: .semibold))
+                    .foregroundStyle(.primary)
+            }
 
             VStack(spacing: 10) {
                 MeterRow(title: "CPU", tint: Tint.blue,
@@ -61,7 +68,7 @@ struct MenuBarMonitorView: View {
             }
         }
         .padding(14)
-        .frame(width: 248)
+        .frame(width: 252)
         .onAppear { monitor.start() }
         .onDisappear { monitor.stop() }
     }
@@ -119,11 +126,16 @@ private struct MeterRow: View {
                     Capsule()
                         .fill(Color.primary.opacity(0.08))
                     Capsule()
-                        .fill(tint)
+                        .fill(
+                            LinearGradient(
+                                colors: [tint, tint.opacity(0.65)],
+                                startPoint: .leading, endPoint: .trailing
+                            )
+                        )
                         .frame(width: max(2, geo.size.width * clamped))
                 }
             }
-            .frame(height: 5)
+            .frame(height: 6)
         }
     }
 }
```

**File**: `PureMac/Views/DashboardView.swift` (modified, +210/-151)
```diff
@@ -34,14 +34,6 @@ struct DashboardView: View {
 
     var body: some View {
         ZStack {
-            // Quiet tinted wash so the glass hero states have color to
-            // refract. Static — no Reduce Motion concerns.
-            LinearGradient(
-                colors: [Tint.blue.opacity(0.08), Tint.purple.opacity(0.05), .clear],
-                startPoint: .top, endPoint: .bottom
-            )
-            .ignoresSafeArea()
-
             ScrollView {
                 VStack(alignment: .leading, spacing: 20) {
                     switch appState.scanState {
@@ -155,53 +147,59 @@ struct DashboardView: View {
         // Below this width the side-by-side ring + storage column overflows the
         // card, so the hero stacks vertically and the ring shrinks.
         let compact = dashboardSize.width > 0 && dashboardSize.width < 660
-        let ringSize: CGFloat = compact ? 132 : 180
-
-        return CardSurface(padding: 24, accent: stress ? Tint.orange : Tint.blue, elevation: .raised) {
-            AdaptiveStack(compact: compact, spacing: compact ? 18 : 28) {
-                ZStack {
-                    // Slow atmospheric drift behind the ring — barely-there
-                    // ambient depth, frozen under Reduce Motion.
-                    HeroDrift(tint: stress ? Tint.orange : Tint.blue)
-                    HealthRing(percent: percentUsed)
-                        .frame(width: ringSize, height: ringSize)
-                }
+        let ringSize: CGFloat = compact ? 132 : 176
+
+        return CardSurface(padding: compact ? 20 : 26, elevation: .raised,
+                           tint: stress ? Tint.orange : Tint.blue) {
+            VStack(spacing: compact ? 18 : 24) {
+                AdaptiveStack(compact: compact, spacing: compact ? 18 : 30) {
+                    ZStack {
+                        // Slow atmospheric drift behind the ring — barely-there
+                        // ambient depth, frozen under Reduce Motion.
+                        HeroDrift(tint: stress ? Tint.orange : Tint.blue)
+                        HealthRing(percent: percentUsed)
+                            .frame(width: ringSize, height: ringSize)
+                        // Small satellite bubbles orbiting the ring — the
+                        // playful counterweight to the matte stat cards.
+                        OrbSatellites(tint: stress ? Tint.orange : Tint.blue, ringSize: ringSize)
+                    }
 
-                VStack(alignment: .leading, spacing: 14) {
-                    HStack(alignment: .top) {
-                        VStack(alignment: .leading, spacing: 4) {
-                            HStack(spacing: 8) {
-                                Text("Storage")
-                                    .font(.system(size: 13, weight: .semibold))
-                                    .foregroundStyle(.secondary)
-                                    .textCase(.uppercase)
-                                    .tracking(0.6)
-                                if stress {
-                                    StatusChip(label: String(localized: "Low space"),
-                                               systemImage: "exclamationmark.triangle.fill",
-                                               tint: Tint.orange)
+                    VStack(alignment: .leading, spacing: 12) {
+                        HStack(alignment: .top) {
+                            VStack(alignment: .leading, spacing: 5) {
+                                HStack(spacing: 8) {
+                                    Text("Storage")
+                                        .font(.system(size: 12, weight: .semibold))
+                                        .foregroundStyle(.secondary)
+                                        .textCase(.uppercase)
+                                        .tracking(0.8)
+                                    if stress {
+                                        StatusChip(label: String(localized: "Low space"),
+                                                   systemImage: "exclamationmark.triangle.fill",
+                                                   tint: Tint.orange)
+                                    }
                                 }
+                                CountUpBytes(bytes: free)
+                                    .font(.system(size: 38, weight: .bold))
+                                    .foregroundStyle(stress ? Tint.orange : Color.primary)
+                                Text(freeOfText(total: total))
+                                    .font(.system(size: 12.5))
+                                    .foregroundStyle(.secondary)
                             }
-                            CountUpBytes(bytes: free)
-                                .font(.system(size: 34, weight: .semibold))
-                                .foregroundStyle(stress ? Tint.orange : Color.primary)
-                            Text(freeOfText(total: total))
-                      
```

---

### Incident Patch 10: `7100ce1c` (2026-07-18)
**Commit Message**: fix #127 theme-toggle stray highlight; localize Polish name; bump 2.8.4

The appearance pill's selected-segment highlight could render at the
window origin: matchedGeometryEffect inside the NSToolbar-hosted item
resolved a zero frame during the animated toolbar re-layout that fires
when an app-file scan completes (selectedFiles flips non-empty and the
Uninstall button animates in the same toolbar). Replace it with a single
indicator anchored to the pill's own bounds, positioned by segment index
and mirrored under right-to-left layout.

Follow-ups to #125: translate the "Polish" language name in the six
non-English locales, and align pl terminology with Apple's macOS
glossary (Desktop "Pulpit" -> "Biurko" to stop colliding with Dashboard,
Storage "Pamięć" -> "Pamięć masowa" to disambiguate from Memory).

project.yml: 2.8.3(18) -> 2.8.4(19).

Claude-Session: https://claude.ai/code/session_01DE9Zo9AfnDhMDNaaUy8o4o

**File**: `PureMac/Views/Components/AppearancePill.swift` (modified, +23/-12)
```diff
@@ -5,11 +5,19 @@ import SwiftUI
 /// looked like a generic dropdown affordance.
 struct AppearancePill: View {
     @Binding var selection: AppearanceMode
-    @Namespace private var indicator
     @Environment(\.accessibilityReduceMotion) private var reduceMotion
+    @Environment(\.layoutDirection) private var layoutDirection
+
+    private static let segmentWidth: CGFloat = 28
+    private static let segmentHeight: CGFloat = 22
+    private static let segmentSpacing: CGFloat = 2
+
+    private var selectedIndex: CGFloat {
+        CGFloat(AppearanceMode.allCases.firstIndex(of: selection) ?? 0)
+    }
 
     var body: some View {
-        HStack(spacing: 2) {
+        HStack(spacing: Self.segmentSpacing) {
             ForEach(AppearanceMode.allCases) { mode in
                 Button {
                     withAnimation(reduceMotion ? nil : .spring(response: 0.32, dampingFraction: 0.78)) {
@@ -18,22 +26,25 @@ struct AppearancePill: View {
                 } label: {
                     Image(systemName: mode.icon)
                         .font(.system(size: 12, weight: .semibold))
-                        .frame(width: 28, height: 22)
+                        .frame(width: Self.segmentWidth, height: Self.segmentHeight)
                         .foregroundStyle(selection == mode ? Color.primary : .secondary)
-                        .background(
-                            ZStack {
-                                if selection == mode {
-                                    RoundedRectangle(cornerRadius: 6, style: .continuous)
-                                        .fill(Color.primary.opacity(0.10))
-                                        .matchedGeometryEffect(id: "indicator", in: indicator)
-                                }
-                            }
-                        )
                         .contentShape(Rectangle())
                 }
                 .buttonStyle(.plain)
                 .help(LocalizedStringKey(mode.label))
             }
         }
+        // Indicator is anchored to the pill's own bounds and positioned by
+        // segment index, so toolbar re-layout can't misplace it. The previous
+        // matchedGeometryEffect resolved a zero frame inside the NSToolbar
+        // hosting view and drew the highlight at the window origin (#127).
+        // .offset(x:) is not layout-direction aware, so mirror it for RTL.
+        .background(alignment: .leading) {
+            let x = selectedIndex * (Self.segmentWidth + Self.segmentSpacing)
+            RoundedRectangle(cornerRadius: 6, style: .continuous)
+                .fill(Color.primary.opacity(0.10))
+                .frame(width: Self.segmentWidth, height: Self.segmentHeight)
+                .offset(x: layoutDirection == .rightToLeft ? -x : x)
+        }
     }
 }
```

**File**: `PureMac/ar.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -183,7 +183,7 @@
 "Spanish" = "الإسبانية";
 "Japanese" = "اليابانية";
 "Arabic" = "العربية";
-"Polish" = "Polish";
+"Polish" = "البولندية";
 "Portuguese (Brazil)" = "البرتغالية (البرازيل)";
 "Chinese (Simplified)" = "الصينية (المبسطة)";
 "Chinese (Traditional)" = "الصينية (التقليدية)";
```

**File**: `PureMac/es.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -183,7 +183,7 @@
 "Spanish" = "Español";
 "Japanese" = "Japonés";
 "Arabic" = "Árabe";
-"Polish" = "Polish";
+"Polish" = "Polaco";
 "Portuguese (Brazil)" = "Portugués (Brasil)";
 "Chinese (Simplified)" = "Chino (simplificado)";
 "Chinese (Traditional)" = "Chino (tradicional)";
```

**File**: `PureMac/ja.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -183,7 +183,7 @@
 "Spanish" = "スペイン語";
 "Japanese" = "日本語";
 "Arabic" = "アラビア語";
-"Polish" = "Polish";
+"Polish" = "ポーランド語";
 "Portuguese (Brazil)" = "ポルトガル語(ブラジル)";
 "Chinese (Simplified)" = "中国語(簡体字)";
 "Chinese (Traditional)" = "中国語(繁体字)";
```

**File**: `PureMac/pl.lproj/Localizable.strings` (modified, +3/-3)
```diff
@@ -60,7 +60,7 @@
 "Dismiss" = "Zamknij";
 
 /* Dashboard */
-"Storage" = "Pamięć";
+"Storage" = "Pamięć masowa";
 "Smart Scan" = "Inteligentne skanowanie";
 "free of %@" = "wolne z %@";
 "%lld%% used" = "%lld%% użyte";
@@ -194,7 +194,7 @@
 "Trash" = "Kosz";
 "Mail Data" = "Dane poczty";
 "Safari Data" = "Dane Safari";
-"Desktop" = "Pulpit";
+"Desktop" = "Biurko";
 "Documents" = "Dokumenty";
 "TCC Database" = "Baza TCC";
 "Blocked" = "Zablokowane";
@@ -354,7 +354,7 @@
 
 /* v2.8.2: large-file folder exclusions (#121) */
 "Excluded Folders" = "Wykluczone foldery";
-"Files inside these folders are skipped from the Large & Old Files scan (Downloads, Documents, Desktop)." = "Pliki w tych folderach są pomijane podczas skanowania Dużych i starych plików (Pobrane, Dokumenty, Pulpit).";
+"Files inside these folders are skipped from the Large & Old Files scan (Downloads, Documents, Desktop)." = "Pliki w tych folderach są pomijane podczas skanowania Dużych i starych plików (Pobrane, Dokumenty, Biurko).";
 "Remove from exclusions" = "Usuń z wykluczeń";
 "Add Folder…" = "Dodaj folder…";
 
```

**File**: `PureMac/pt-BR.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -183,7 +183,7 @@
 "Spanish" = "Espanhol";
 "Japanese" = "Japonês";
 "Arabic" = "Árabe";
-"Polish" = "Polish";
+"Polish" = "Polonês";
 "Portuguese (Brazil)" = "Português (Brasil)";
 "Chinese (Simplified)" = "Chinês (simplificado)";
 "Chinese (Traditional)" = "Chinês (tradicional)";
```

**File**: `PureMac/zh-Hans.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -183,7 +183,7 @@
 "Spanish" = "西班牙语";
 "Japanese" = "日语";
 "Arabic" = "阿拉伯语";
-"Polish" = "Polish";
+"Polish" = "波兰语";
 "Portuguese (Brazil)" = "葡萄牙语(巴西)";
 "Chinese (Simplified)" = "简体中文";
 "Chinese (Traditional)" = "繁体中文";
```

**File**: `PureMac/zh-Hant.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -183,7 +183,7 @@
 "Spanish" = "西班牙文";
 "Japanese" = "日文";
 "Arabic" = "阿拉伯文";
-"Polish" = "Polish";
+"Polish" = "波蘭文";
 "Portuguese (Brazil)" = "葡萄牙文(巴西)";
 "Chinese (Simplified)" = "簡體中文";
 "Chinese (Traditional)" = "繁體中文";
```

---

### Incident Patch 11: `1a1e9e31` (2026-06-28)
**Commit Message**: Merge pull request #124 from albertonoys/fix/recursive-app-sizes

Fix app/file sizes showing as bytes instead of recursive total

**File**: `PureMac.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -37,6 +37,7 @@
 		A549D8A39A9E5E70D91B90A6 /* Haptics.swift in Sources */ = {isa = PBXBuildFile; fileRef = 40A3F22FCEF534DE4A2CAD0E /* Haptics.swift */; };
 		A9C3A1F643C26930F442E729 /* OrphanSafetyPolicy.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4AE790496C936424EF98320A /* OrphanSafetyPolicy.swift */; };
 		ABDDD4F35102A39CC1A2C325 /* ConfettiView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F0599AA604B0D6BA4F957537 /* ConfettiView.swift */; };
+		B51E5A95BB49A6C0F5273E21 /* FileSize.swift in Sources */ = {isa = PBXBuildFile; fileRef = 8CE522B406791BCE905BC55B /* FileSize.swift */; };
 		B52938BBD11842631314543D /* CategoryDetailView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 10B0AF194677EAC1D5568785 /* CategoryDetailView.swift */; };
 		BC6C800216343438413349A3 /* OnboardingView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 3D4FD34378988D430A582ED0 /* OnboardingView.swift */; };
 		CDCDFEBA39A3290101F86AC6 /* MainWindow.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9F510F232341EE18F11DC934 /* MainWindow.swift */; };
@@ -102,6 +103,7 @@
 		77D3D9A9BC52839E6D0A22BC /* Locations.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Locations.swift; sourceTree = "<group>"; };
 		798B80977D14647A5691B0A0 /* AppFilesView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppFilesView.swift; sourceTree = "<group>"; };
 		82BB0904726B38DEB141BECA /* AppLanguage.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppLanguage.swift; sourceTree = "<group>"; };
+		8CE522B406791BCE905BC55B /* FileSize.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = FileSize.swift; sourceTree = "<group>"; };
 		8D5E63D733D1A3BDEDF4DCA5 /* pt-BR */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = "pt-BR"; path = "pt-BR.lproj/Localizable.strings"; sourceTree = "<group>"; };
 		913E3064AA9BD7BE94A315CF /* MenuBarController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MenuBarController.swift; sourceTree = "<group>"; };
 		92259B3E9F4468865F15DEEC /* AppearancePill.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppearancePill.swift; sourceTree = "<group>"; };
@@ -275,6 +277,7 @@
 			isa = PBXGroup;
 			children = (
 				01B2C5F66B6D812572BD4F05 /* CLI.swift */,
+				8CE522B406791BCE905BC55B /* FileSize.swift */,
 				5785762276FB5E3209C6DE4D /* Logger.swift */,
 				4AE790496C936424EF98320A /* OrphanSafetyPolicy.swift */,
 			);
@@ -446,6 +449,7 @@
 				A2AE68CC75CB72D6B10CBDF5 /* DashboardView.swift in Sources */,
 				76B132F9C499225D33E0D075 /* EmptyStateView.swift in Sources */,
 				52F11962555C639F0EECADD6 /* FDADemoView.swift in Sources */,
+				B51E5A95BB49A6C0F5273E21 /* FileSize.swift in Sources */,
 				2253F11BDF561B617439C96B /* FullDiskAccessManager.swift in Sources */,
 				A549D8A39A9E5E70D91B90A6 /* Haptics.swift in Sources */,
 				E60B0A2C5D0A6CAE35BF4DFB /* Locations.swift in Sources */,
```

**File**: `PureMac/Logic/Scanning/AppInfoFetcher.swift` (modified, +1/-26)
```diff
@@ -133,31 +133,6 @@ final class AppInfoFetcher {
     }
 
     private func appSize(at url: URL) -> Int64 {
-        // totalFileAllocatedSizeKey on a directory URL returns only the
-        // directory inode (~4 KB on APFS), not the recursive sum - the
-        // previous fast-path returned that and exited, causing app sizes
-        // to display as ~4 KB regardless of bundle contents. Always
-        // enumerate the bundle contents and sum.
-        guard let enumerator = fileManager.enumerator(
-            at: url,
-            includingPropertiesForKeys: [.totalFileAllocatedSizeKey, .fileAllocatedSizeKey, .isRegularFileKey, .isSymbolicLinkKey],
-            options: [.skipsHiddenFiles]
-        ) else { return 0 }
-
-        var total: Int64 = 0
-        for case let fileURL as URL in enumerator {
-            guard let values = try? fileURL.resourceValues(forKeys: [.totalFileAllocatedSizeKey, .fileAllocatedSizeKey, .isRegularFileKey, .isSymbolicLinkKey]) else { continue }
-            // Skip symlinks so we don't double-count or follow links out of
-            // the bundle. Skip directories so we only count regular file
-            // payload.
-            if values.isSymbolicLink == true { continue }
-            guard values.isRegularFile == true else { continue }
-            if let allocated = values.totalFileAllocatedSize {
-                total += Int64(allocated)
-            } else if let allocated = values.fileAllocatedSize {
-                total += Int64(allocated)
-            }
-        }
-        return total
+        FileSizeCalculator.size(of: url) ?? 0
     }
 }
```

**File**: `PureMac/Logic/Utilities/FileSize.swift` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+import Foundation
+
+/// Allocated-size calculation that works for both files and directories.
+///
+/// `URLResourceValues.totalFileAllocatedSize` does **not** recurse: on a
+/// directory URL it returns only the directory inode's own allocation
+/// (~96 bytes to a few KB on APFS), not the sum of the bundle's contents.
+/// Reading it directly on an `.app` bundle or a support folder is what made
+/// items display as a handful of bytes. For directories we enumerate and sum
+/// the regular files instead.
+enum FileSizeCalculator {
+    private static let fileManager = FileManager.default
+
+    /// On-disk allocated size of `url`. Recurses into directories.
+    /// Returns `nil` if the item can't be read at all.
+    static func size(of url: URL) -> Int64? {
+        let values = try? url.resourceValues(forKeys: [.isDirectoryKey])
+        if values?.isDirectory == true {
+            return directorySize(of: url)
+        }
+        return fileSize(of: url)
+    }
+
+    private static func fileSize(of url: URL) -> Int64? {
+        if let values = try? url.resourceValues(forKeys: [.totalFileAllocatedSizeKey]),
+           let size = values.totalFileAllocatedSize {
+            return Int64(size)
+        }
+        if let values = try? url.resourceValues(forKeys: [.fileAllocatedSizeKey]),
+           let size = values.fileAllocatedSize {
+            return Int64(size)
+        }
+        guard let attrs = try? fileManager.attributesOfItem(atPath: url.path),
+              let size = attrs[.size] as? Int64 else { return nil }
+        return size
+    }
+
+    private static func directorySize(of url: URL) -> Int64 {
+        guard let enumerator = fileManager.enumerator(
+            at: url,
+            includingPropertiesForKeys: [.totalFileAllocatedSizeKey, .fileAllocatedSizeKey, .isRegularFileKey, .isSymbolicLinkKey],
+            options: [.skipsHiddenFiles]
+        ) else { return 0 }
+
+        var total: Int64 = 0
+        for case let fileURL as URL in enumerator {
+            guard let values = try? fileURL.resourceValues(forKeys: [.totalFileAllocatedSizeKey, .fileAllocatedSizeKey, .isRegularFileKey, .isSymbolicLinkKey]) else { continue }
+            // Skip symlinks so we don't double-count or follow links that
+            // escape the directory. Only sum regular-file payload.
+            if values.isSymbolicLink == true { continue }
+            guard values.isRegularFile == true else { continue }
+            if let allocated = values.totalFileAllocatedSize {
+                total += Int64(allocated)
+            } else if let allocated = values.fileAllocatedSize {
+                total += Int64(allocated)
+            }
+        }
+        return total
+    }
+}
```

**File**: `PureMac/Views/Apps/AppFilesView.swift` (modified, +1/-14)
```diff
@@ -372,20 +372,7 @@ struct AppFilesView: View {
     }
 
     private func fileSize(_ url: URL) -> Int64? {
-        // totalFileAllocatedSize recurses into directories; attributesOfItem
-        // returns the directory's own metadata size (≈0), which is why
-        // bundles and support folders previously displayed as 0 B.
-        if let values = try? url.resourceValues(forKeys: [.totalFileAllocatedSizeKey]),
-           let size = values.totalFileAllocatedSize, size > 0 {
-            return Int64(size)
-        }
-        if let values = try? url.resourceValues(forKeys: [.fileAllocatedSizeKey]),
-           let size = values.fileAllocatedSize {
-            return Int64(size)
-        }
-        guard let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
-              let size = attrs[.size] as? Int64 else { return nil }
-        return size
+        FileSizeCalculator.size(of: url)
     }
 
     private func removeSingleFile(_ url: URL) {
```

**File**: `PureMac/Views/Orphans/OrphanListView.swift` (modified, +1/-11)
```diff
@@ -125,17 +125,7 @@ struct OrphanListView: View {
     }
 
     private func fileSize(_ url: URL) -> Int64? {
-        if let values = try? url.resourceValues(forKeys: [.totalFileAllocatedSizeKey]),
-           let size = values.totalFileAllocatedSize, size > 0 {
-            return Int64(size)
-        }
-        if let values = try? url.resourceValues(forKeys: [.fileAllocatedSizeKey]),
-           let size = values.fileAllocatedSize {
-            return Int64(size)
-        }
-        guard let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
-              let size = attrs[.size] as? Int64 else { return nil }
-        return size
+        FileSizeCalculator.size(of: url)
     }
 
     private func removeSelectedOrphans() async {
```

---

### Incident Patch 12: `cf404c95` (2026-06-28)
**Commit Message**: fix: dashboard hero + stats overflow at narrow window widths

At small window sizes the idle-dashboard hero (fixed 180pt ring beside the
storage column) overflowed the card and the storage figure clipped, and
the 4-up stat grid crushed its values. Make both adapt to the dashboard
width: below 660pt the hero stacks vertically with a smaller ring via a
new AdaptiveStack, and the stat grid drops from 4 columns to 2.

Claude-Session: https://claude.ai/code/session_01B6BCRcv3uVh5Tizs9hMv88

**File**: `PureMac/Views/DashboardView.swift` (modified, +27/-3)
```diff
@@ -152,15 +152,19 @@ struct DashboardView: View {
         let free = appState.diskInfo.freeSpace
         let percentUsed = total > 0 ? Double(used) / Double(total) : 0
         let stress = percentUsed > 0.85
+        // Below this width the side-by-side ring + storage column overflows the
+        // card, so the hero stacks vertically and the ring shrinks.
+        let compact = dashboardSize.width > 0 && dashboardSize.width < 660
+        let ringSize: CGFloat = compact ? 132 : 180
 
         return CardSurface(padding: 24, accent: stress ? Tint.orange : Tint.blue, elevation: .raised) {
-            HStack(alignment: .center, spacing: 28) {
+            AdaptiveStack(compact: compact, spacing: compact ? 18 : 28) {
                 ZStack {
                     // Slow atmospheric drift behind the ring — barely-there
                     // ambient depth, frozen under Reduce Motion.
                     HeroDrift(tint: stress ? Tint.orange : Tint.blue)
                     HealthRing(percent: percentUsed)
-                        .frame(width: 180, height: 180)
+                        .frame(width: ringSize, height: ringSize)
                 }
 
                 VStack(alignment: .leading, spacing: 14) {
@@ -264,7 +268,10 @@ struct DashboardView: View {
         let total = appState.diskInfo.totalSpace
         let percentUsed = total > 0 ? Double(total - free) / Double(total) : 0
 
-        return LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4), spacing: 12) {
+        // Four across when there's room, two when the dashboard is narrow so the
+        // cards don't crush their values.
+        let columnCount = dashboardSize.width > 0 && dashboardSize.width < 660 ? 2 : 4
+        return LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: columnCount), spacing: 12) {
             StatCard(
                 icon: "internaldrive.fill",
                 tint: Tint.blue,
@@ -950,3 +957,20 @@ private struct CategoryToggleRow: View {
         String(format: String(localized: "%lld items"), Int64(result.itemCount))
     }
 }
+
+/// Lays its content out horizontally at full width and vertically when the
+/// container is too narrow for the row to fit, so wide hero rows reflow into a
+/// stacked layout instead of overflowing.
+struct AdaptiveStack<Content: View>: View {
+    let compact: Bool
+    var spacing: CGFloat = 28
+    @ViewBuilder var content: Content
+
+    var body: some View {
+        if compact {
+            VStack(alignment: .leading, spacing: spacing) { content }
+        } else {
+            HStack(alignment: .center, spacing: spacing) { content }
+        }
+    }
+}
```

---

### Incident Patch 13: `373d3dd6` (2026-06-28)
**Commit Message**: feat: menu-bar system monitor (opt-in CPU/memory/disk meters)

Adds an optional menu-bar status item showing live CPU / memory / disk
usage, toggled from Settings > General > System Monitor. Clicking it
opens a popover with labeled meters plus Open/Quit actions; the menu-bar
button shows live CPU%.

Implementation notes:
- AppKit NSStatusItem + NSPopover (hosting the SwiftUI MenuBarMonitorView)
  rather than a SwiftUI MenuBarExtra: a conditional .window-style
  MenuBarExtra fails to type-check in @SceneBuilder, and an unconditional
  one stalls the XCTest host run loop. The AppKit controller is created
  only when enabled and never under XCTest.
- SystemMonitor samples CPU (host_statistics), memory (host_statistics64),
  and disk (volume capacity) on a 2s timer, refcounted so it idles when
  unobserved.
- statusItem.isVisible is set explicitly (it restores hidden from autosave
  state otherwise) with an autosaveName to persist the user's placement.
- App stays resident while enabled so the meters keep updating after the
  window closes; WindowOpener captures openWindow so the popover can
  reopen it.
- +8 localized UI strings across all 7 locales (321-key parity preserved).
- proje

**File**: `PureMac.xcodeproj/project.pbxproj` (modified, +16/-4)
```diff
@@ -27,10 +27,12 @@
 		826A750D2D7EC14C2AE306A3 /* Models.swift in Sources */ = {isa = PBXBuildFile; fileRef = 3667D46D8E2004EB4D73835A /* Models.swift */; };
 		8947F0CE448791BD50EECF46 /* Conditions.swift in Sources */ = {isa = PBXBuildFile; fileRef = CB94E06E145558123BB5BFB3 /* Conditions.swift */; };
 		8B541441926847072DC5B75B /* DashboardCharts.swift in Sources */ = {isa = PBXBuildFile; fileRef = 08C60E04A0CA3F227816DB63 /* DashboardCharts.swift */; };
+		91751CF033E1541BFD39B12C /* MenuBarMonitorView.swift in Sources */ = {isa = PBXBuildFile; fileRef = A27DB5A70FA829B6C3ED0AC3 /* MenuBarMonitorView.swift */; };
 		93743B036059418560D876E6 /* SettingsView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 3A8D39C3C250F26302EC45AB /* SettingsView.swift */; };
 		95278ABDCF5F4D6AC60503B1 /* AppearancePill.swift in Sources */ = {isa = PBXBuildFile; fileRef = 92259B3E9F4468865F15DEEC /* AppearancePill.swift */; };
 		9AA80E035DF7B33F6EE118DF /* AppState.swift in Sources */ = {isa = PBXBuildFile; fileRef = CED1B71D5F9510582E869CFD /* AppState.swift */; };
 		9BB5AAA574AFED6C27A3F8E2 /* AppPathFinder.swift in Sources */ = {isa = PBXBuildFile; fileRef = AC0FEE7141871ED5F9E36121 /* AppPathFinder.swift */; };
+		9E3639F9EFCB2A22F6747894 /* MenuBarController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 913E3064AA9BD7BE94A315CF /* MenuBarController.swift */; };
 		A2AE68CC75CB72D6B10CBDF5 /* DashboardView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F661A0F64CF93E482CB1728F /* DashboardView.swift */; };
 		A549D8A39A9E5E70D91B90A6 /* Haptics.swift in Sources */ = {isa = PBXBuildFile; fileRef = 40A3F22FCEF534DE4A2CAD0E /* Haptics.swift */; };
 		A9C3A1F643C26930F442E729 /* OrphanSafetyPolicy.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4AE790496C936424EF98320A /* OrphanSafetyPolicy.swift */; };
@@ -41,6 +43,7 @@
 		CFA64F54CDBF8A4765E0068D /* LocalizationFilesTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 155CE1B8CDCCCA6F9FD028C1 /* LocalizationFilesTests.swift */; };
 		D50EB059E741011EB2523731 /* ScanError.swift in Sources */ = {isa = PBXBuildFile; fileRef = EEF15CB1B8EFCA78EF491824 /* ScanError.swift */; };
 		D9445C2641A8637B65DA5ACE /* ScanEngine.swift in Sources */ = {isa = PBXBuildFile; fileRef = A711CDF5285F68775D9B5513 /* ScanEngine.swift */; };
+		DBFD73E3D9BDA74EC1CA56AB /* SystemMonitor.swift in Sources */ = {isa = PBXBuildFile; fileRef = DB798781B99987F55D77E2E3 /* SystemMonitor.swift */; };
 		DC32253D26D0E29762006DA0 /* AppBundleDragHandle.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2D3F9FEDC493A8E49E910F67 /* AppBundleDragHandle.swift */; };
 		DDD6BA35DBF32E7A6B5F6F8B /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = B2EA41E1096FA8E3B916AD13 /* Assets.xcassets */; };
 		DDDA5879006CB97D5D7BDD87 /* Logger.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5785762276FB5E3209C6DE4D /* Logger.swift */; };
@@ -100,9 +103,11 @@
 		798B80977D14647A5691B0A0 /* AppFilesView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppFilesView.swift; sourceTree = "<group>"; };
 		82BB0904726B38DEB141BECA /* AppLanguage.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppLanguage.swift; sourceTree = "<group>"; };
 		8D5E63D733D1A3BDEDF4DCA5 /* pt-BR */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = "pt-BR"; path = "pt-BR.lproj/Localizable.strings"; sourceTree = "<group>"; };
+		913E3064AA9BD7BE94A315CF /* MenuBarController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MenuBarController.swift; sourceTree = "<group>"; };
 		92259B3E9F4468865F15DEEC /* AppearancePill.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppearancePill.swift; sourceTree = "<group>"; };
 		9F04B811BB0012F6D2F07F91 /* en */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = en; path = en.lproj/Localizable.strings; sourceTree = "<group>"; };
 		9F510F232341EE18F11DC934 /* MainWindow.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MainWindow.swift; sourceTree = "<group>"; };
+		A27DB5A70FA829B6C3ED0AC3 /* MenuBarMonitorView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MenuBarMonitorView.swift; sourceTree = "<group>"; };
 		A711CDF5285F68775D9B5513 /* ScanEngine.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ScanEngine.swift; sourceTree = "<group>"; };
 		AC0FEE7141871ED5F9E36121 /* AppPathFinder.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppPathFinder.swift; sourceTree = "<group>"; };
 		B2CD0028599BE178B96F18A6 /* ar */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = ar; path = ar.lproj/Localizable.strings; sourceTree = "<group>"; };
@@ -111,6 +116,7 @@
 		C5ADDC35F31E40780FB5D017 /* Theme.swift */ = {isa = PBXFileReference; lastKnownFi
```

**File**: `PureMac/PureMacApp.swift` (modified, +51/-2)
```diff
@@ -1,11 +1,30 @@
 import AppKit
 import SwiftUI
 
+@MainActor
 class AppDelegate: NSObject, NSApplicationDelegate {
-    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
+    /// Owns the optional menu-bar status item. Nil until the monitor is enabled.
+    private var menuBarController: MenuBarController?
+
+    /// Normally PureMac quits when its window closes. When the menu-bar system
+    /// monitor is enabled the app stays resident so the meters keep updating in
+    /// the menu bar; "Open PureMac" in that menu reopens the window.
+    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
+        !UserDefaults.standard.bool(forKey: "settings.general.menuBarMonitor")
+    }
 
     func applicationDidFinishLaunching(_ notification: Notification) {
         NSWindow.allowsAutomaticWindowTabbing = false
+
+        // Install the menu-bar monitor if the user has it enabled. Never under
+        // XCTest — the status-item machinery would stall the test-host run loop.
+        if NSClassFromString("XCTestCase") == nil {
+            syncMenuBarMonitor()
+            NotificationCenter.default.addObserver(
+                self, selector: #selector(syncMenuBarMonitor),
+                name: .pureMacMenuBarMonitorChanged, object: nil
+            )
+        }
         // Touch TCC-protected paths so macOS registers PureMac in the
         // Full Disk Access pane on first launch (fixes issue #75).
         FullDiskAccessManager.shared.triggerRegistration()
@@ -38,6 +57,25 @@ class AppDelegate: NSObject, NSApplicationDelegate {
             userInfo: ["path": appURL.path]
         )
     }
+
+    /// Create or tear down the menu-bar status item to match the current
+    /// Settings toggle. Posted to whenever the toggle flips so it takes effect
+    /// without a relaunch.
+    @objc func syncMenuBarMonitor() {
+        let enabled = UserDefaults.standard.bool(forKey: "settings.general.menuBarMonitor")
+        if enabled, menuBarController == nil {
+            menuBarController = MenuBarController()
+        } else if !enabled, let controller = menuBarController {
+            controller.teardown()
+            menuBarController = nil
+        }
+    }
+}
+
+extension Notification.Name {
+    /// Posted when the "Show system monitor in menu bar" Settings toggle flips,
+    /// so AppDelegate can add/remove the status item live.
+    static let pureMacMenuBarMonitorChanged = Notification.Name("PureMac.MenuBarMonitorChanged")
 }
 
 @main
@@ -58,7 +96,7 @@ struct PureMacApp: App {
     }
 
     var body: some Scene {
-        WindowGroup {
+        WindowGroup(id: "main") {
             Group {
                 if onboardingComplete {
                     MainWindow()
@@ -70,6 +108,10 @@ struct PureMacApp: App {
             }
             .environmentObject(theme)
             .preferredColorScheme(theme.appearance.colorScheme)
+            // Record the openWindow action so the menu-bar popover can reopen
+            // this window after it's been closed (the popover lives outside the
+            // scene graph and can't use openWindow itself).
+            .background(WindowOpenerCapture())
         }
         .windowStyle(.automatic)
         .windowToolbarStyle(.unified)
@@ -89,5 +131,12 @@ struct PureMacApp: App {
             SettingsView()
                 .environmentObject(appState)
         }
+
+        // The opt-in menu-bar system monitor is an AppKit NSStatusItem managed
+        // by AppDelegate/MenuBarController rather than a SwiftUI MenuBarExtra:
+        // a conditional `.window`-style MenuBarExtra fails to type-check, and an
+        // unconditional one sets up status-item machinery that hangs the XCTest
+        // host. The AppKit controller is only created when enabled and never
+        // under tests, sidestepping both problems.
     }
 }
```

**File**: `PureMac/Services/MenuBarController.swift` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+import AppKit
+import SwiftUI
+import Combine
+
+/// Captures SwiftUI's `openWindow` action so AppKit surfaces (the menu-bar
+/// popover, which lives outside the scene graph and has no working `openWindow`
+/// environment) can reopen the main window after it has been closed. The main
+/// window records the action on appear; the closure stays valid for the app's
+/// lifetime even once the window is gone.
+@MainActor
+final class WindowOpener {
+    static let shared = WindowOpener()
+    var open: ((String) -> Void)?
+    private init() {}
+}
+
+/// AppKit-backed menu-bar system monitor. A SwiftUI `MenuBarExtra` was avoided
+/// here: a conditional `.window`-style `MenuBarExtra` fails to type-check, and
+/// an unconditional one stalls the XCTest host's run loop. An `NSStatusItem`
+/// driving an `NSPopover` (which hosts the existing SwiftUI `MenuBarMonitorView`)
+/// gives the same UI with full create/destroy control and no test-host impact.
+@MainActor
+final class MenuBarController: NSObject, NSPopoverDelegate {
+    private let statusItem: NSStatusItem
+    private let popover = NSPopover()
+    private let monitor = SystemMonitor.shared
+    private var cancellable: AnyCancellable?
+
+    override init() {
+        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
+        super.init()
+
+        // Persist the user's show/hide choice and ensure the item is requested
+        // visible (it defaults hidden when restored from a prior autosave state).
+        statusItem.autosaveName = "PureMacSystemMonitor"
+        statusItem.isVisible = true
+
+        monitor.start()
+
+        if let button = statusItem.button {
+            button.image = NSImage(
+                systemSymbolName: "gauge.with.dots.needle.67percent",
+                accessibilityDescription: "System Monitor"
+            )
+            button.imagePosition = .imageLeading
+            button.target = self
+            button.action = #selector(togglePopover)
+            updateTitle()
+        }
+
+        popover.behavior = .transient
+        popover.contentSize = NSSize(width: 248, height: 230)
+        popover.contentViewController = NSHostingController(rootView: MenuBarMonitorView())
+        popover.delegate = self
+
+        // Refresh the menu-bar CPU readout each time the monitor samples.
+        cancellable = monitor.$cpuUsage
+            .receive(on: RunLoop.main)
+            .sink { [weak self] _ in self?.updateTitle() }
+    }
+
+    /// Remove the status item and release the monitor observer. Called by
+    /// AppDelegate before dropping the controller so teardown runs on the main
+    /// actor (a `@MainActor` deinit cannot touch isolated state safely).
+    func teardown() {
+        cancellable?.cancel()
+        cancellable = nil
+        if popover.isShown { popover.performClose(nil) }
+        NSStatusBar.system.removeStatusItem(statusItem)
+        monitor.stop()
+    }
+
+    private func updateTitle() {
+        guard let button = statusItem.button else { return }
+        button.title = " \(Int((monitor.cpuUsage * 100).rounded()))%"
+    }
+
+    @objc private func togglePopover() {
+        guard let button = statusItem.button else { return }
+        if popover.isShown {
+            popover.performClose(nil)
+        } else {
+            NSApp.activate(ignoringOtherApps: true)
+            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
+            popover.contentViewController?.view.window?.makeKey()
+        }
+    }
+}
```

**File**: `PureMac/Services/SystemMonitor.swift` (added, +144/-0)
```diff
@@ -0,0 +1,144 @@
+import Foundation
+import Darwin
+
+/// Lightweight live system telemetry for the menu-bar monitor (CPU / memory /
+/// disk). Polls on a timer only while a SwiftUI view is observing it; the menu
+/// bar's `MenuBarExtra` keeps a single shared instance alive, and `start()` /
+/// `stop()` gate the timer so the app does no background sampling when the
+/// monitor is disabled in Settings.
+///
+/// All readings use public Mach / Foundation APIs (no sandbox-incompatible
+/// shelling out), so this stays valid under the app's hardened-runtime,
+/// notarized build.
+@MainActor
+final class SystemMonitor: ObservableObject {
+    static let shared = SystemMonitor()
+
+    /// 0.0 - 1.0 fraction of total CPU time spent non-idle since the last sample.
+    @Published private(set) var cpuUsage: Double = 0
+    @Published private(set) var memoryUsed: Int64 = 0
+    @Published private(set) var memoryTotal: Int64 = 0
+    @Published private(set) var diskUsed: Int64 = 0
+    @Published private(set) var diskTotal: Int64 = 0
+
+    var memoryFraction: Double {
+        guard memoryTotal > 0 else { return 0 }
+        return Double(memoryUsed) / Double(memoryTotal)
+    }
+
+    var diskFraction: Double {
+        guard diskTotal > 0 else { return 0 }
+        return Double(diskUsed) / Double(diskTotal)
+    }
+
+    private var timer: Timer?
+    /// Previous CPU tick counters, kept to turn the kernel's monotonically
+    /// increasing totals into a per-interval delta.
+    private var previousBusy: UInt64 = 0
+    private var previousTotal: UInt64 = 0
+    /// Number of live observers; the timer runs only while > 0 so two views
+    /// (menu-bar label + dropdown) share one timer and the app idles cleanly.
+    private var observerCount = 0
+
+    private init() {}
+
+    /// Begin (or keep) sampling. Refcounted so multiple observers share a timer.
+    func start(interval: TimeInterval = 2.0) {
+        observerCount += 1
+        guard timer == nil else { return }
+        memoryTotal = Int64(ProcessInfo.processInfo.physicalMemory)
+        sample()
+        let t = Timer(timeInterval: interval, repeats: true) { [weak self] _ in
+            Task { @MainActor in self?.sample() }
+        }
+        // .common so sampling continues while a menu/popover tracks the run loop.
+        RunLoop.main.add(t, forMode: .common)
+        timer = t
+    }
+
+    /// Release one observer; the timer stops once the last one goes away.
+    func stop() {
+        observerCount = max(0, observerCount - 1)
+        guard observerCount == 0 else { return }
+        timer?.invalidate()
+        timer = nil
+    }
+
+    private func sample() {
+        sampleCPU()
+        sampleMemory()
+        sampleDisk()
+    }
+
+    // MARK: - CPU
+
+    private func sampleCPU() {
+        var info = host_cpu_load_info()
+        var count = mach_msg_type_number_t(
+            MemoryLayout<host_cpu_load_info_data_t>.stride / MemoryLayout<integer_t>.stride
+        )
+        let result = withUnsafeMutablePointer(to: &info) {
+            $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
+                host_statistics(mach_host_self(), HOST_CPU_LOAD_INFO, $0, &count)
+            }
+        }
+        guard result == KERN_SUCCESS else { return }
+
+        let user = UInt64(info.cpu_ticks.0)
+        let system = UInt64(info.cpu_ticks.1)
+        let idle = UInt64(info.cpu_ticks.2)
+        let nice = UInt64(info.cpu_ticks.3)
+        let busy = user &+ system &+ nice
+        let total = busy &+ idle
+
+        defer { previousBusy = busy; previousTotal = total }
+        // First sample has no prior baseline to diff against.
+        guard previousTotal != 0, total > previousTotal else { return }
+
+        let busyDelta = Double(busy &- previousBusy)
+        let totalDelta = Double(total &- previousTotal)
+        guard totalDelta > 0 else { return }
+        cpuUsage = min(1, max(0, busyDelta / totalDelta))
+    }
+
+    // MARK: - Memory
+
+    private func sampleMemory() {
+        var stats = vm_statistics64()
+        var count = mach_msg_type_number_t(
+            MemoryLayout<vm_statistics64_data_t>.stride / MemoryLayout<integer_t>.stride
+        )
+        let result = withUnsafeMutablePointer(to: &stats) {
+            $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
+                host_statistics64(mach_host_self(), HOST_VM_INFO64, $0, &count)
+            }
+        }
+        guard result == KERN_SUCCESS else { return }
+
+        let pageSize = Int64(vm_kernel_page_size)
+        // "App Memory" + wired + compressed mirrors what Activity Monitor counts
+        // as memory pressure; free + purgeable + most file-backed pages are not
+        // pressure, so they're excluded.
+        let used = (Int64(stats.active_count)
+            + Int64(stats.wire_count)
+            + Int64(stats.compressor_page_count)) * pageSize
+        memoryUsed = used
+    }
+
+    // MARK: - Dis
```

**File**: `PureMac/Views/Components/MenuBarMonitorView.swift` (added, +129/-0)
```diff
@@ -0,0 +1,129 @@
+import SwiftUI
+import AppKit
+
+/// Zero-size helper that captures SwiftUI's `openWindow` action into
+/// `WindowOpener.shared` when the main window appears, so the AppKit menu-bar
+/// popover can reopen the window after it's been closed.
+struct WindowOpenerCapture: View {
+    @Environment(\.openWindow) private var openWindow
+
+    var body: some View {
+        Color.clear
+            .frame(width: 0, height: 0)
+            .onAppear { WindowOpener.shared.open = { id in openWindow(id: id) } }
+    }
+}
+
+/// Drop-down panel hosted in the menu-bar `NSPopover` (via `NSHostingController`)
+/// with live CPU / memory / disk meters and quick actions. Kept self-contained
+/// so the menu bar surface stays decoupled from the main window's `AppState`.
+struct MenuBarMonitorView: View {
+    @ObservedObject private var monitor = SystemMonitor.shared
+
+    var body: some View {
+        VStack(alignment: .leading, spacing: 12) {
+            Text("System Monitor")
+                .font(.system(size: 13, weight: .semibold))
+                .foregroundStyle(.primary)
+
+            VStack(spacing: 10) {
+                MeterRow(title: "CPU", tint: Tint.blue,
+                         fraction: monitor.cpuUsage,
+                         detail: "\(Int((monitor.cpuUsage * 100).rounded()))%")
+                MeterRow(title: "Memory", tint: Tint.purple,
+                         fraction: monitor.memoryFraction,
+                         detail: byteDetail(monitor.memoryUsed, monitor.memoryTotal))
+                MeterRow(title: "Disk", tint: Tint.green,
+                         fraction: monitor.diskFraction,
+                         detail: byteDetail(monitor.diskUsed, monitor.diskTotal))
+            }
+
+            Divider()
+
+            HStack {
+                Button {
+                    openMainWindow()
+                } label: {
+                    Text("Open PureMac")
+                }
+                .buttonStyle(.borderedProminent)
+                .controlSize(.small)
+
+                Spacer()
+
+                Button {
+                    NSApp.terminate(nil)
+                } label: {
+                    Text("Quit PureMac")
+                }
+                .buttonStyle(.bordered)
+                .controlSize(.small)
+            }
+        }
+        .padding(14)
+        .frame(width: 248)
+        .onAppear { monitor.start() }
+        .onDisappear { monitor.stop() }
+    }
+
+    private func byteDetail(_ used: Int64, _ total: Int64) -> String {
+        let u = ByteCountFormatter.string(fromByteCount: used, countStyle: .memory)
+        let t = ByteCountFormatter.string(fromByteCount: total, countStyle: .memory)
+        return "\(u) / \(t)"
+    }
+
+    /// Bring the app forward and surface the main window. The app stays alive
+    /// after its window closes only while the monitor is enabled (see
+    /// `AppDelegate.applicationShouldTerminateAfterLastWindowClosed`), so this
+    /// reopens a fresh window when none is left, otherwise just focuses it.
+    private func openMainWindow() {
+        NSApp.activate(ignoringOtherApps: true)
+        // Exclude the menu-bar popover's own panel; a real content window is
+        // titled and can become main.
+        if let existing = NSApp.windows.first(where: {
+            $0.canBecomeMain && $0.styleMask.contains(.titled)
+        }) {
+            existing.makeKeyAndOrderFront(nil)
+        } else {
+            // No content window left — reopen via the captured openWindow action
+            // (the popover has no working openWindow environment of its own).
+            WindowOpener.shared.open?("main")
+        }
+    }
+}
+
+/// One labeled meter: title on the left, a thin tinted progress bar, and a
+/// trailing numeric detail. Mirrors the restrained chrome used elsewhere.
+private struct MeterRow: View {
+    let title: LocalizedStringKey
+    let tint: Color
+    let fraction: Double
+    let detail: String
+
+    private var clamped: Double { max(0, min(1, fraction)) }
+
+    var body: some View {
+        VStack(spacing: 4) {
+            HStack {
+                Text(title)
+                    .font(.system(size: 11, weight: .medium))
+                    .foregroundStyle(.secondary)
+                Spacer()
+                Text(detail)
+                    .font(.system(size: 11, weight: .semibold))
+                    .monospacedDigit()
+                    .foregroundStyle(.primary)
+            }
+            GeometryReader { geo in
+                ZStack(alignment: .leading) {
+                    Capsule()
+                        .fill(Color.primary.opacity(0.08))
+                    Capsule()
+                        .fill(tint)
+                        .frame(width: max(2, geo.size.width * clamped))
+                }
+            }
+            .frame(height: 5)
+        }
+    }
+}
```

**File**: `PureMac/Views/Settings/SettingsView.swift` (modified, +19/-0)
```diff
@@ -40,6 +40,7 @@ struct GeneralSettingsView: View {
     @AppStorage("settings.general.launchAtLogin") private var launchAtLogin = false
     @AppStorage("settings.general.searchSensitivity") private var sensitivity: SearchSensitivity = .enhanced
     @AppStorage("settings.general.confirmBeforeDelete") private var confirmBeforeDelete = true
+    @AppStorage("settings.general.menuBarMonitor") private var menuBarMonitor = false
     @AppStorage(Haptics.soundEffectsKey) private var soundEffects = true
     @AppStorage(AppLanguage.preferenceKey) private var appLanguageRaw = AppLanguage.current.rawValue
     @State private var languageNeedsRelaunch = false
@@ -86,6 +87,13 @@ struct GeneralSettingsView: View {
                 }
             }
 
+            Section("System Monitor") {
+                Toggle("Show system monitor in menu bar", isOn: menuBarMonitorBinding)
+                Text("Live CPU, memory, and disk meters in the menu bar. PureMac keeps running in the background while this is on.")
+                    .font(.caption)
+                    .foregroundStyle(.secondary)
+            }
+
             Section("Sound") {
                 Toggle("Play sound effects", isOn: $soundEffects)
             }
@@ -99,6 +107,17 @@ struct GeneralSettingsView: View {
                    value: languageNeedsRelaunch)
     }
 
+    private var menuBarMonitorBinding: Binding<Bool> {
+        Binding(
+            get: { menuBarMonitor },
+            set: { newValue in
+                menuBarMonitor = newValue
+                // Tell AppDelegate to add/remove the status item without relaunch.
+                NotificationCenter.default.post(name: .pureMacMenuBarMonitorChanged, object: nil)
+            }
+        )
+    }
+
     private var launchAtLoginBinding: Binding<Bool> {
         Binding(
             get: { launchAtLogin },
```

**File**: `PureMac/ar.lproj/Localizable.strings` (modified, +10/-0)
```diff
@@ -364,3 +364,13 @@
 "Ignored orphans: %lld" = "الملفات اليتيمة المتجاهَلة: %lld";
 "Forget Ignored" = "نسيان المتجاهَلة";
 "Ignored files won't appear in future orphan scans." = "لن تظهر الملفات المتجاهَلة في عمليات فحص الملفات اليتيمة المستقبلية.";
+
+/* v2.8.3: menu-bar system monitor */
+"System Monitor" = "مراقب النظام";
+"Show system monitor in menu bar" = "إظهار مراقب النظام في شريط القوائم";
+"Live CPU, memory, and disk meters in the menu bar. PureMac keeps running in the background while this is on." = "مقاييس مباشرة للمعالج والذاكرة والقرص في شريط القوائم. يستمر PureMac في العمل في الخلفية أثناء تفعيل هذا الخيار.";
+"CPU" = "المعالج";
+"Memory" = "الذاكرة";
+"Disk" = "القرص";
+"Open PureMac" = "فتح PureMac";
+"Quit PureMac" = "إنهاء PureMac";
```

**File**: `PureMac/en.lproj/Localizable.strings` (modified, +10/-0)
```diff
@@ -364,3 +364,13 @@
 "Ignored orphans: %lld" = "Ignored orphans: %lld";
 "Forget Ignored" = "Forget Ignored";
 "Ignored files won't appear in future orphan scans." = "Ignored files won't appear in future orphan scans.";
+
+/* v2.8.3: menu-bar system monitor */
+"System Monitor" = "System Monitor";
+"Show system monitor in menu bar" = "Show system monitor in menu bar";
+"Live CPU, memory, and disk meters in the menu bar. PureMac keeps running in the background while this is on." = "Live CPU, memory, and disk meters in the menu bar. PureMac keeps running in the background while this is on.";
+"CPU" = "CPU";
+"Memory" = "Memory";
+"Disk" = "Disk";
+"Open PureMac" = "Open PureMac";
+"Quit PureMac" = "Quit PureMac";
```

---

### Incident Patch 14: `f2589d06` (2026-06-28)
**Commit Message**: fix: sidebar/footer labels invisible on some configs (#117)

Sidebar nav-row labels and the health-footer title inherited the
.listStyle(.sidebar) default foreground. On configs with a custom
accent or reduced transparency (reported on M1 Max, Sonoma 14.7.5)
that emphasized/vibrant primary style resolves transparent, so the
text disappeared while explicitly-colored text (section headers,
badges) stayed visible. This is why toggling Light/Dark and Increase
Contrast had no effect - none of those touch the vibrancy path.

Force an explicit, colorScheme-driven solid color on both labels so
they bypass the vibrant primary style entirely and cannot collapse to
transparent regardless of accent/transparency settings.

Claude-Session: https://claude.ai/code/session_01B6BCRcv3uVh5Tizs9hMv88

**File**: `PureMac/Views/MainWindow.swift` (modified, +23/-0)
```diff
@@ -7,6 +7,7 @@ struct MainWindow: View {
     @State private var selectedSection: AppSection? = .cleaning(.smartScan)
     @State private var columnVisibility: NavigationSplitViewVisibility = .all
     @Environment(\.accessibilityReduceMotion) private var reduceMotion
+    @Environment(\.colorScheme) private var colorScheme
 
     var body: some View {
         NavigationSplitView(columnVisibility: $columnVisibility) {
@@ -143,6 +144,11 @@ struct MainWindow: View {
             VStack(alignment: .leading, spacing: 1) {
                 Text(LocalizedStringKey(ok ? "Ready to clean" : "Limited access"))
                     .font(.system(size: 12, weight: .semibold))
+                    // Explicit solid color — same vibrancy-collapse guard as the
+                    // sidebar rows (#117); this title also inherited the default.
+                    .foregroundStyle(colorScheme == .dark
+                        ? Color.white.opacity(0.92)
+                        : Color.black.opacity(0.85))
                 Text(LocalizedStringKey(ok ? "Full Disk Access granted" : "Grant FDA in Settings"))
                     .font(.system(size: 10.5))
                     .foregroundStyle(.secondary)
@@ -319,12 +325,21 @@ private struct SidebarNavRow: View {
 
     @State private var hovering = false
     @Environment(\.accessibilityReduceMotion) private var reduceMotion
+    @Environment(\.colorScheme) private var colorScheme
 
     var body: some View {
         HStack(spacing: 10) {
             IconTile(systemName: icon, tint: tint, size: 24, glow: isSelected)
             Text(label)
                 .font(.system(size: 13, weight: isSelected ? .semibold : .regular))
+                // Force an explicit, solid foreground instead of inheriting the
+                // sidebar list's default. On some configs (custom accent /
+                // reduced transparency, seen on M1 Max — issue #117) the
+                // inherited emphasized/vibrant label style resolves transparent
+                // and the row text disappears while explicitly-colored text
+                // (headers, badges) stays visible. A colorScheme-driven solid
+                // color sidesteps that vibrancy path entirely.
+                .foregroundStyle(labelColor)
             Spacer()
             if let badge {
                 Text(badge)
@@ -353,6 +368,14 @@ private struct SidebarNavRow: View {
         .contentShape(Rectangle())
         .onHover { hovering = $0 }
     }
+
+    /// Solid, opaque label color that adapts to light/dark without routing
+    /// through the sidebar's vibrant primary style (see #117).
+    private var labelColor: Color {
+        colorScheme == .dark
+            ? Color.white.opacity(0.92)
+            : Color.black.opacity(0.85)
+    }
 }
 
 /// Small reusable status dot with optional pulse. Used in the sidebar health
```

---

### Incident Patch 15: `c5897c12` (2026-06-28)
**Commit Message**: Fix app/file sizes showing as bytes instead of recursive total

fileSize() in AppFilesView and OrphanListView read
totalFileAllocatedSize directly on the URL, which on a directory returns
only the directory inode (~bytes on APFS) rather than the sum of its
contents. App bundles and support folders then were displayed as a
handful of bytes (Bambu Studio showed 18 KB instead of 2.8 GB, for
example).

This seems to be a recurrence of #92, but that fix only covered
AppInfoFetcher.appSize.

- Extract the recursive logic into a shared FileSizeCalculator that
enumerates directories and sums regular-file allocated sizes.
- Route all three call sites (AppFilesView, OrphanListView,
AppInfoFetcher) through it.

**File**: `PureMac.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -35,6 +35,7 @@
 		A549D8A39A9E5E70D91B90A6 /* Haptics.swift in Sources */ = {isa = PBXBuildFile; fileRef = 40A3F22FCEF534DE4A2CAD0E /* Haptics.swift */; };
 		A9C3A1F643C26930F442E729 /* OrphanSafetyPolicy.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4AE790496C936424EF98320A /* OrphanSafetyPolicy.swift */; };
 		ABDDD4F35102A39CC1A2C325 /* ConfettiView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F0599AA604B0D6BA4F957537 /* ConfettiView.swift */; };
+		B51E5A95BB49A6C0F5273E21 /* FileSize.swift in Sources */ = {isa = PBXBuildFile; fileRef = 8CE522B406791BCE905BC55B /* FileSize.swift */; };
 		B52938BBD11842631314543D /* CategoryDetailView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 10B0AF194677EAC1D5568785 /* CategoryDetailView.swift */; };
 		BC6C800216343438413349A3 /* OnboardingView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 3D4FD34378988D430A582ED0 /* OnboardingView.swift */; };
 		CDCDFEBA39A3290101F86AC6 /* MainWindow.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9F510F232341EE18F11DC934 /* MainWindow.swift */; };
@@ -99,6 +100,7 @@
 		77D3D9A9BC52839E6D0A22BC /* Locations.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Locations.swift; sourceTree = "<group>"; };
 		798B80977D14647A5691B0A0 /* AppFilesView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppFilesView.swift; sourceTree = "<group>"; };
 		82BB0904726B38DEB141BECA /* AppLanguage.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppLanguage.swift; sourceTree = "<group>"; };
+		8CE522B406791BCE905BC55B /* FileSize.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = FileSize.swift; sourceTree = "<group>"; };
 		8D5E63D733D1A3BDEDF4DCA5 /* pt-BR */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = "pt-BR"; path = "pt-BR.lproj/Localizable.strings"; sourceTree = "<group>"; };
 		92259B3E9F4468865F15DEEC /* AppearancePill.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppearancePill.swift; sourceTree = "<group>"; };
 		9F04B811BB0012F6D2F07F91 /* en */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = en; path = en.lproj/Localizable.strings; sourceTree = "<group>"; };
@@ -266,6 +268,7 @@
 			isa = PBXGroup;
 			children = (
 				01B2C5F66B6D812572BD4F05 /* CLI.swift */,
+				8CE522B406791BCE905BC55B /* FileSize.swift */,
 				5785762276FB5E3209C6DE4D /* Logger.swift */,
 				4AE790496C936424EF98320A /* OrphanSafetyPolicy.swift */,
 			);
@@ -437,6 +440,7 @@
 				A2AE68CC75CB72D6B10CBDF5 /* DashboardView.swift in Sources */,
 				76B132F9C499225D33E0D075 /* EmptyStateView.swift in Sources */,
 				52F11962555C639F0EECADD6 /* FDADemoView.swift in Sources */,
+				B51E5A95BB49A6C0F5273E21 /* FileSize.swift in Sources */,
 				2253F11BDF561B617439C96B /* FullDiskAccessManager.swift in Sources */,
 				A549D8A39A9E5E70D91B90A6 /* Haptics.swift in Sources */,
 				E60B0A2C5D0A6CAE35BF4DFB /* Locations.swift in Sources */,
```

**File**: `PureMac/Logic/Scanning/AppInfoFetcher.swift` (modified, +1/-26)
```diff
@@ -133,31 +133,6 @@ final class AppInfoFetcher {
     }
 
     private func appSize(at url: URL) -> Int64 {
-        // totalFileAllocatedSizeKey on a directory URL returns only the
-        // directory inode (~4 KB on APFS), not the recursive sum - the
-        // previous fast-path returned that and exited, causing app sizes
-        // to display as ~4 KB regardless of bundle contents. Always
-        // enumerate the bundle contents and sum.
-        guard let enumerator = fileManager.enumerator(
-            at: url,
-            includingPropertiesForKeys: [.totalFileAllocatedSizeKey, .fileAllocatedSizeKey, .isRegularFileKey, .isSymbolicLinkKey],
-            options: [.skipsHiddenFiles]
-        ) else { return 0 }
-
-        var total: Int64 = 0
-        for case let fileURL as URL in enumerator {
-            guard let values = try? fileURL.resourceValues(forKeys: [.totalFileAllocatedSizeKey, .fileAllocatedSizeKey, .isRegularFileKey, .isSymbolicLinkKey]) else { continue }
-            // Skip symlinks so we don't double-count or follow links out of
-            // the bundle. Skip directories so we only count regular file
-            // payload.
-            if values.isSymbolicLink == true { continue }
-            guard values.isRegularFile == true else { continue }
-            if let allocated = values.totalFileAllocatedSize {
-                total += Int64(allocated)
-            } else if let allocated = values.fileAllocatedSize {
-                total += Int64(allocated)
-            }
-        }
-        return total
+        FileSizeCalculator.size(of: url) ?? 0
     }
 }
```

**File**: `PureMac/Logic/Utilities/FileSize.swift` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+import Foundation
+
+/// Allocated-size calculation that works for both files and directories.
+///
+/// `URLResourceValues.totalFileAllocatedSize` does **not** recurse: on a
+/// directory URL it returns only the directory inode's own allocation
+/// (~96 bytes to a few KB on APFS), not the sum of the bundle's contents.
+/// Reading it directly on an `.app` bundle or a support folder is what made
+/// items display as a handful of bytes. For directories we enumerate and sum
+/// the regular files instead.
+enum FileSizeCalculator {
+    private static let fileManager = FileManager.default
+
+    /// On-disk allocated size of `url`. Recurses into directories.
+    /// Returns `nil` if the item can't be read at all.
+    static func size(of url: URL) -> Int64? {
+        let values = try? url.resourceValues(forKeys: [.isDirectoryKey])
+        if values?.isDirectory == true {
+            return directorySize(of: url)
+        }
+        return fileSize(of: url)
+    }
+
+    private static func fileSize(of url: URL) -> Int64? {
+        if let values = try? url.resourceValues(forKeys: [.totalFileAllocatedSizeKey]),
+           let size = values.totalFileAllocatedSize {
+            return Int64(size)
+        }
+        if let values = try? url.resourceValues(forKeys: [.fileAllocatedSizeKey]),
+           let size = values.fileAllocatedSize {
+            return Int64(size)
+        }
+        guard let attrs = try? fileManager.attributesOfItem(atPath: url.path),
+              let size = attrs[.size] as? Int64 else { return nil }
+        return size
+    }
+
+    private static func directorySize(of url: URL) -> Int64 {
+        guard let enumerator = fileManager.enumerator(
+            at: url,
+            includingPropertiesForKeys: [.totalFileAllocatedSizeKey, .fileAllocatedSizeKey, .isRegularFileKey, .isSymbolicLinkKey],
+            options: [.skipsHiddenFiles]
+        ) else { return 0 }
+
+        var total: Int64 = 0
+        for case let fileURL as URL in enumerator {
+            guard let values = try? fileURL.resourceValues(forKeys: [.totalFileAllocatedSizeKey, .fileAllocatedSizeKey, .isRegularFileKey, .isSymbolicLinkKey]) else { continue }
+            // Skip symlinks so we don't double-count or follow links that
+            // escape the directory. Only sum regular-file payload.
+            if values.isSymbolicLink == true { continue }
+            guard values.isRegularFile == true else { continue }
+            if let allocated = values.totalFileAllocatedSize {
+                total += Int64(allocated)
+            } else if let allocated = values.fileAllocatedSize {
+                total += Int64(allocated)
+            }
+        }
+        return total
+    }
+}
```

**File**: `PureMac/Views/Apps/AppFilesView.swift` (modified, +1/-14)
```diff
@@ -372,20 +372,7 @@ struct AppFilesView: View {
     }
 
     private func fileSize(_ url: URL) -> Int64? {
-        // totalFileAllocatedSize recurses into directories; attributesOfItem
-        // returns the directory's own metadata size (≈0), which is why
-        // bundles and support folders previously displayed as 0 B.
-        if let values = try? url.resourceValues(forKeys: [.totalFileAllocatedSizeKey]),
-           let size = values.totalFileAllocatedSize, size > 0 {
-            return Int64(size)
-        }
-        if let values = try? url.resourceValues(forKeys: [.fileAllocatedSizeKey]),
-           let size = values.fileAllocatedSize {
-            return Int64(size)
-        }
-        guard let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
-              let size = attrs[.size] as? Int64 else { return nil }
-        return size
+        FileSizeCalculator.size(of: url)
     }
 
     private func removeSingleFile(_ url: URL) {
```

**File**: `PureMac/Views/Orphans/OrphanListView.swift` (modified, +1/-11)
```diff
@@ -125,17 +125,7 @@ struct OrphanListView: View {
     }
 
     private func fileSize(_ url: URL) -> Int64? {
-        if let values = try? url.resourceValues(forKeys: [.totalFileAllocatedSizeKey]),
-           let size = values.totalFileAllocatedSize, size > 0 {
-            return Int64(size)
-        }
-        if let values = try? url.resourceValues(forKeys: [.fileAllocatedSizeKey]),
-           let size = values.fileAllocatedSize {
-            return Int64(size)
-        }
-        guard let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
-              let size = attrs[.size] as? Int64 else { return nil }
-        return size
+        FileSizeCalculator.size(of: url)
     }
 
     private func removeSelectedOrphans() async {
```

#### Recent Merged Pull Requests:
- **PR #178** (closed): V3.0.0 zh.4 (@qg-hs)
- **PR #165** (closed): cli: add Claude Desktop, ChatGPT & Hugging Face caches to `clean ai` (@ry-ops)
- **PR #164** (closed): cli: add Puppeteer, Playwright, node-gyp & Electron caches to `clean dev` (@ry-ops)
- **PR #160** (closed): Add file and folder scan exclusions (@omartio)
- **PR #159** (closed): Add advanced storage intelligence, diagnostics, and filesystem performance optimizations (@a7med2o6)
- **PR #157** (2026-08-17): feat(cli): add puremac terminal cleaner (@momenbasel)
- **PR #156** (closed): Add a shared sort control to every file list (@wicolian)
- **PR #155** (closed): xcode: clean XcodeBuildMCP DerivedData (@omartio)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
