> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/momenbasel-puremac-learnings.md`  
> **Source**: github ([https://github.com/momenbasel/PureMac](https://github.com/momenbasel/PureMac))  
> **Source Version**: `61311f6a`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T03:10:25.930Z  
> **Learning ID**: `learn-github-momenbasel-puremac`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): momenbasel/PureMac

> **Canonical Artifact**: `07_PROJECT_LEARNING/momenbasel-puremac-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/momenbasel/PureMac](https://github.com/momenbasel/PureMac))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-12T03:10:25.922Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `momenbasel/PureMac`
- **Description**: Free, open-source macOS cleaner. CleanMyMac alternative with zero telemetry. Native SwiftUI, scheduled auto-cleaning, Xcode/Homebrew/system cache cleanup. MIT licensed.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7751 stars

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
    ///
    /// The engines canonicalize a symlinked home, so the roots are spelled
    /// under every form of the home: literal, symlink-resolved, and resolved
    /// then standardized. Otherwise a canonical path under a symlinked home
    /// would never match a root built from the literal home.
    static func deniedRoots(
        homeDirectory: URL = FileManager.default.homeDirectoryForCurrentUser
    ) -> [String] {
        let resolved = homeDirectory.resolvingSymlinksInPath()
        var homes: [String] = []
        for home in [homeDirectory.standardizedFileURL.path, resolved.path, resolved.standardizedFileURL.path]
        where !homes.contains(home) {
            homes.append(home)
        }
        return homes.flatMap { home in
            [
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
    }

    /// True when `path` is inside provider-owned state and must be left alone.
    ///
    /// The check runs against both the literal path and its symlink-resolved
    /// form. That second pass matters: with "Desktop & Documents Folders" sync
    /// enabled, `~/Desktop` and `~/Documents` resolve into
    /// `~/Library/Mobile Documents/com~apple~CloudDocs`, so an innocuous-looking
    /// root can walk straight into iCloud state.
    static func isProviderOwned(
        _ path: String,
        homeDirectory: URL = FileManager.default.homeDirectoryForCurrentUser
    ) -> Bool {
        let roots = deniedRoots(homeDirectory: homeDirectory)
        let candidates = [
            (path as NSString).standardizingPath,
            URL(fileURLWithPath: path).resolvingSymlinksInPath().path,
        ]
        for candidate in candidates {
            // Any component of the form `com~apple~CloudDocs` (or any other
            // provider domain) marks provider territory regardless of location.
            if candidate.contains("com~apple~") { return true }
            for root in roots where candidate == root || candidate.hasPrefix(root + "/") {
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
    /// Always symlink-resolved so allow-listed roots agree with ScanEngine and
    /// XcodeBuildMCPDerivedDataSupport path checks on symlinked homes.
    private let homeDirectory: URL
    private let binaryThinner = BinaryThinner()

    init(homeDirectory: URL = FileManager.default.homeDirectoryForCurrentUser) {
        self.homeDirectory = XcodeBuildMCPDerivedDataSupport.canonicalHomeDirectory(homeDirectory)
    }

    struct CleaningResult {
        var freedSpace: Int64 = 0
        var itemsCleaned: Int = 0
        var errors: [String] = []
        var cleanedPaths: Set<String> = []
        /// Destination paths returned by FileManager.trashItem. Keeping these
        /// lets callers and tests distinguish recoverable Trash moves from
        /// irreversible removals.
        var trashedPaths: Set<String> = []
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

            if item.category == .aiApps, !isSupportedAIAppPath(item.path) {
                result.errors.append("Unsupported AI app cleanup path: \(item.path)")
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
                // languageFiles never reaches here — it is handled above via
                // the staged re-sign flow, not the delete path.
                let pathAccepted = isSafeToDelete(item: item, resolvedPath: resolved)
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

                let isManagedDerivedData = XcodeBuildMCPDerivedDataSupport.isManagedDerivedDataPath(
                    item.path,
                    homeDirectory: homeDirectory
                ) || XcodeBuildMCPDerivedDataSupport.isManagedDerivedDataPath(
                    resolved,
                    homeDirectory: homeDirectory
                )
                if isManagedDerivedData {
                    // The legacy shared root predates XcodeBuildMCP's
                    // per-workspace lock, so only workspace DerivedData waits
                    // for the lock before moving to the Trash.
                    var lifecycleLock: XcodeBuildMCPDerivedDataSupport.LifecycleLock?
                    if XcodeBuildMCPDerivedDataSupport.workspaceKey(
                        forManagedDerivedDataPath: resolved,
                        homeDirectory: homeDirectory
                    ) != nil {
                        guard let acquired = XcodeBuildMCPDerivedDataSupport.acquireLifecycleLock(
                            forManagedDerivedDataPath: resolved,
                            homeDirectory: homeDirectory,
                            fileManager: fileManager
                        ) else {
                            let detail = "Skipped XcodeBuildMCP DerivedData: lifecycle lock is unavailable: \(item.path)"
                            Logger.shared.log(detail, level: .warning)
                            result.errors.append(detail)
                            continue
                        }
                        lifecycleLock = acquired
                    }
                    defer {
                        if let lifecycleLock {
                            XcodeBuildMCPDerivedDataSupport.releaseLifecycleLock(
                                lifecycleLock,
                                fileManager: fileManager
                            )

```

### Core Architecture Module: `PureMac/Services/ScanEngine.swift`
```
import Foundation

actor ScanEngine {
    private let fileManager = FileManager.default
    private let home: String

    init(homeDirectory: URL = FileManager.default.homeDirectoryForCurrentUser) {
        home = XcodeBuildMCPDerivedDataSupport.canonicalHomeDirectory(homeDirectory).path
    }

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
        ] + ProviderPaths.deniedRoots(homeDirectory: URL(fileURLWithPath: home, isDirectory: true))).map(normalizePath))

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
                path: "\(home)/Library/Saved Application State/com.electron.ollama
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #144** (2026-08-10): **[Bug] PureMac corrupts applications on default settings, reinstalls needed**
  *Symptoms*: After a cleanup, several apps stop working and require to be reinstalled.  In my case and single run: - Cursor - GitKraken - Jetbrains Toolbox - Figma - Keka - Ableton Live 12 - Stats  Steps to reproduce the behavior: 1. Do a Cleanup. 2. Test every app, you'll find one that uses cache completely broken.  Keka shows permission prompts during the cleanup. Clearly touching stuff that shouldn't.  <img width="302" height="410" alt="Image" src="https://github.com/user-attachments/assets/6ceaff45-b464-41a5-a7ca-d1b559d98877" />  Screenshot on opening all apps mentioned.  - macOS version: macOS Tahoe Version 26.5.2 (25F84) - PureMac version: 2.9.4 (24) - Install method: (Homebrew / DMG / App Store / Source): DMG

- **Issue #142** (2026-08-21): **[Bug] Cleanup appears to corrupt iCloud Drive File Provider metadata and causes severe Finder copy delays**
  *Symptoms*: **Describe the bug**  Immediately after running a cleanup with PureMac, Finder operations involving iCloud Drive became extremely slow. Copying a fully downloaded folder containing 36 files (19.9 MB total) from iCloud Drive to the local Downloads folder, which was effectively instant before the cleanup, started taking approximately 9–23 seconds.  The timing strongly suggests that the PureMac cleanup triggered the problem, because:  - the slowdown started immediately after using PureMac; - there had been no recent macOS update before the symptom appeared; - PureMac was not running afterward and no persistent PureMac background job was found; - the SSD, memory, network, and ordinary local file I/O tested normally; - Safe Mode did not change the behavior; - Apple's File Provider consistency checker now reports hundreds of broken invariants.  I cannot conclusively identify which PureMac cleaning category caused the damage because PureMac does not expose a persistent, user-readable log of the exact paths removed. Please treat the PureMac causal link as a strong timeline-based suspicion, not as a proven identification of a specific source-code path. The application should retain a detailed cleanup transaction log so destructive side effects can be audited.  **To reproduce**  1. Enable iCloud Drive and keep a folder containing multiple small, fully downloaded files. 2. Confirm that copying the folder from iCloud Drive to a local folder such as Downloads is fast. 3. Run a PureMac cle

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

### Incident Patch 1: `61311f6a` (2026-11-11)
**Commit Message**: chore: refresh star history

**File**: `assets/star-history-dark.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#21262d" stroke-width="1"/>
   <text x="52" y="62" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.46 366.88 L67.02 365.8 L72.92 364.68 L73.14 363.6 L73.52 362.51 L73.98 361.43 L74.28 360.31 L74.63 359.23 L75.24 358.14 L75.86 357.06 L76.29 355.94 L76.95 354.86 L77.11 353.77 L77.34 352.69 L77.53 351.57 L77.7 350.49 L77.88 349.4 L77.98 348.32 L78.09 347.2 L78.23 346.11 L78.36 345.03 L78.49 343.94 L78.65 342.83 L78.88 341.74 L79 340.66 L79.11 339.57 L79.23 338.46 L79.33 337.37 L79.44 336.29 L79.53 335.2 L79.62 334.09 L79.75 333 L79.88 331.92 L80.05 330.83 L80.18 329.72 L80.33 328.63 L80.49 327.55 L80.74 326.46 L81.04 325.34 L81.43 324.26 L81.9 323.17 L82.29 322.09 L82.76 320.97 L83.05 319.89 L83.41 318.8 L83.7 317.72 L84.03 316.6 L84.8 315.52 L85.6 314.43 L85.99 313.35 L86.29 312.23 L86.75 311.15 L87.2 310.06 L88.05 308.98 L88.5 307.86 L88.69 306.77 L88.88 305.69 L89 304.61 L89.11 303.49 L89.23 302.4 L89.39 301.32 L89.54 300.23 L89.68 299.12 L89.79 298.03 L89.97 296.95 L90.14 295.86 L90.34 294.75 L90.58 293.66 L90.85 292.58 L91.06 291.49 L91.53 290.38 L92.07 289.29 L92.48 288.21 L92.86 287.12 L93.31 286.04 L94.39 284.92 L95.79 283.83 L97.32 282.75 L98.38 281.66 L99.32 280.55 L100.7 279.46 L101.99 278.38 L104.27 277.29 L105.05 276.18 L105.61 275.09 L106.44 274.01 L107.4 272.92 L108.1 271.81 L108.85 270.72 L110.04 269.64 L111.06 268.55 L114.04 267.44 L115.18 266.35 L117.3 265.27 L118.64 264.18 L120.21 263.07 L121.27 261.98 L123.73 260.9 L126.79 259.81 L130.36 258.69 L134.11 257.61 L138.55 256.52 L143.97 255.44 L148.98 254.32 L151.15 253.24 L151.87 252.15 L154.11 251.07 L155.73 249.95 L158.78 248.87 L161.75 247.78 L162.75 246.7 L163.78 245.58 L164.8 244.5 L166.13 243.41 L167.11 242.33 L168 241.21 L170.98 240.13 L175.92 239.04 L179.81 237.96 L184.17 236.84 L189.83 235.75 L192.59 234.67 L197.33 233.58 L204.72 232.47 L210.47 231.38 L214.28 230.3 L218.59 229.21 L226.5 228.1 L235.61 227.01 L245.33 225.93 L254.88 224.84 L261.07 223.73 L270.63 222.64 L278.53 221.56 L289.05 220.47 L298.31 219.36 L307.81 218.27 L316.91 217.19 L321.45 216.1 L326.81 214.98 L337.22 213.9 L343.95 212.81 L351.51 211.73 L362.71 210.61 L371.05 209.53 L377.03 208.44 L378.29 207.36 L381 206.27 L384.06 205.16 L387.91 204.07 L394.36 202.99 L401.19 201.9 L407.96 200.79 L415.47 199.7 L424.48 198.62 L428.3 197.53 L434.5 196.42 L441.08 195.33 L447.89 194.25 L453.66 193.16 L459.83 192.04 L469.12 190.96 L472.63 189.87 L475.55 188.79 L477.56 187.67 L478.33 186.59 L479.66 185.5 L482.42 184.42 L487.16 183.3 L492.57 182.22 L499.01 181.13 L505.47 180.05 L514.76 178.93 L523.27 177.85 L532.32 176.76 L533.26 175.68 L537.29 174.56 L542.78 173.48 L549.49 172.39 L555.34 171.31 L558.3 170.19 L561.71 169.1 L564.97 168.02 L570.6 166.93 L576.58 165.82 L583.33 164.73 L584.38 163.65 L586.04 162.56 L589.37 161.45 L591.83 160.36 L596.77 159.28 L603.26 158.19 L609.34 157.08 L618.44 155.99 L623.06 154.91 L627.53 153.82 L632.37 152.7 L638.01 151.62 L643.38 150.54 L647.72 149.45 L654.07 148.33 L658.24 147.25 L661.92 146.16 L665.34 145.08 L669.73 143.96 L674.09 142.88 L679.05 141.79 L680.8 140.71 L683.83 139.59 L689.34 138.51 L694.6 137.42 L699.7 136.34 L702.16 135.22 L706.84 134.14 L710.71 133.05 L716.47 131.97 L722.58 130.85 L730.16 129.77 L736 128.68 L736 368 L62 368 Z" fill="url(#fill-starhistorydarksvg)"/>
-  <path d="M62 367.97 L65.46 366.88 L67.02 365.8 L72.92 364.68 L73.14 363.6 L73.52 362.51 L73.98 361.43 L74.28 360.31 L74.63 359.23 L75.24 358.14 L75.86 357.06 L76.29 355.94 L76.95 354.86 L77.11 353.77 L77.34 352.69 L77.53 351.57 L77.7 350.49 L77.88 349.4 L77.98 348.32 L78.09 347.2 L78.23 346.11 L78.36 345.03 L78.49 343.94 L78.65 342.83 L78.88 341.74 L79 340.66 L79.11 339.57 L79.23 338.46 L79.33 337.37 L79.44 336.29 L79.53 335.2 L79.62 334.09 L79.75 333 L79.88 331.92 L80.05 330.83 L80.18 329.72 L80.33 328.63 L80.49 327.55 L80.74 326.46 L81.04 325.34 L81.43 324.26 L81.9 323.17 L82.29 322.09 L82.76 320.97 L83.05 319.89 L83.41 318.8 L83.7 317.72 L84.03 316.6 L84.8 315.52 L85.6 314.43 L85.99 313.35 L86.29 312.23 L86.75 311.15 L87.2 310.06 L88.05 308.98 L88.5 307.86 L88.69 306.77 L88.88 305.69 L89 304.61 L89.11 303.49 L89.23 302.4 L89.39 301.32 L89.54 300.23 L89.68 299.12 L89.79 298.03 L89.97 296.95 L90.14 295.86 L90.34 294.75 L90.58 293.66 L90.85 292.58 L91.06 291.49 L91.53 290.38 L92.07 289.29 L92.48 288.21 L92.86 287.12 L93.31 286.04 L94.39 284.92 L95.79 283.83 L97.32 282.75 L98.38 281.66 L99.32 280.55 L100.7 279.46 L101.99 278.38 L104.27 277.29 L105.05 276.18 L105.61 275.09 L106.44 274.01 L107.4 272.92 L108.1 271.81 L108.85 270.72 L110.04 269.64 L111.06 268.55 L114.04 267.44 L115.18 266.35 L117.3 265.27 L118.64 264.18 L120.21 263.07 L121.27 261.98 L123.73 260.9 L126.79 259.81 L130.36 258.69 L134.11 257.61 L138.55 256.52 L143.97 255.44 L148.98 254.32 L151.15 253.24 L151.87 252
```

**File**: `assets/star-history.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#e6eaef" stroke-width="1"/>
   <text x="52" y="62" fill="#59636e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.46 366.88 L67.02 365.8 L72.92 364.68 L73.14 363.6 L73.52 362.51 L73.98 361.43 L74.28 360.31 L74.63 359.23 L75.24 358.14 L75.86 357.06 L76.29 355.94 L76.95 354.86 L77.11 353.77 L77.34 352.69 L77.53 351.57 L77.7 350.49 L77.88 349.4 L77.98 348.32 L78.09 347.2 L78.23 346.11 L78.36 345.03 L78.49 343.94 L78.65 342.83 L78.88 341.74 L79 340.66 L79.11 339.57 L79.23 338.46 L79.33 337.37 L79.44 336.29 L79.53 335.2 L79.62 334.09 L79.75 333 L79.88 331.92 L80.05 330.83 L80.18 329.72 L80.33 328.63 L80.49 327.55 L80.74 326.46 L81.04 325.34 L81.43 324.26 L81.9 323.17 L82.29 322.09 L82.76 320.97 L83.05 319.89 L83.41 318.8 L83.7 317.72 L84.03 316.6 L84.8 315.52 L85.6 314.43 L85.99 313.35 L86.29 312.23 L86.75 311.15 L87.2 310.06 L88.05 308.98 L88.5 307.86 L88.69 306.77 L88.88 305.69 L89 304.61 L89.11 303.49 L89.23 302.4 L89.39 301.32 L89.54 300.23 L89.68 299.12 L89.79 298.03 L89.97 296.95 L90.14 295.86 L90.34 294.75 L90.58 293.66 L90.85 292.58 L91.06 291.49 L91.53 290.38 L92.07 289.29 L92.48 288.21 L92.86 287.12 L93.31 286.04 L94.39 284.92 L95.79 283.83 L97.32 282.75 L98.38 281.66 L99.32 280.55 L100.7 279.46 L101.99 278.38 L104.27 277.29 L105.05 276.18 L105.61 275.09 L106.44 274.01 L107.4 272.92 L108.1 271.81 L108.85 270.72 L110.04 269.64 L111.06 268.55 L114.04 267.44 L115.18 266.35 L117.3 265.27 L118.64 264.18 L120.21 263.07 L121.27 261.98 L123.73 260.9 L126.79 259.81 L130.36 258.69 L134.11 257.61 L138.55 256.52 L143.97 255.44 L148.98 254.32 L151.15 253.24 L151.87 252.15 L154.11 251.07 L155.73 249.95 L158.78 248.87 L161.75 247.78 L162.75 246.7 L163.78 245.58 L164.8 244.5 L166.13 243.41 L167.11 242.33 L168 241.21 L170.98 240.13 L175.92 239.04 L179.81 237.96 L184.17 236.84 L189.83 235.75 L192.59 234.67 L197.33 233.58 L204.72 232.47 L210.47 231.38 L214.28 230.3 L218.59 229.21 L226.5 228.1 L235.61 227.01 L245.33 225.93 L254.88 224.84 L261.07 223.73 L270.63 222.64 L278.53 221.56 L289.05 220.47 L298.31 219.36 L307.81 218.27 L316.91 217.19 L321.45 216.1 L326.81 214.98 L337.22 213.9 L343.95 212.81 L351.51 211.73 L362.71 210.61 L371.05 209.53 L377.03 208.44 L378.29 207.36 L381 206.27 L384.06 205.16 L387.91 204.07 L394.36 202.99 L401.19 201.9 L407.96 200.79 L415.47 199.7 L424.48 198.62 L428.3 197.53 L434.5 196.42 L441.08 195.33 L447.89 194.25 L453.66 193.16 L459.83 192.04 L469.12 190.96 L472.63 189.87 L475.55 188.79 L477.56 187.67 L478.33 186.59 L479.66 185.5 L482.42 184.42 L487.16 183.3 L492.57 182.22 L499.01 181.13 L505.47 180.05 L514.76 178.93 L523.27 177.85 L532.32 176.76 L533.26 175.68 L537.29 174.56 L542.78 173.48 L549.49 172.39 L555.34 171.31 L558.3 170.19 L561.71 169.1 L564.97 168.02 L570.6 166.93 L576.58 165.82 L583.33 164.73 L584.38 163.65 L586.04 162.56 L589.37 161.45 L591.83 160.36 L596.77 159.28 L603.26 158.19 L609.34 157.08 L618.44 155.99 L623.06 154.91 L627.53 153.82 L632.37 152.7 L638.01 151.62 L643.38 150.54 L647.72 149.45 L654.07 148.33 L658.24 147.25 L661.92 146.16 L665.34 145.08 L669.73 143.96 L674.09 142.88 L679.05 141.79 L680.8 140.71 L683.83 139.59 L689.34 138.51 L694.6 137.42 L699.7 136.34 L702.16 135.22 L706.84 134.14 L710.71 133.05 L716.47 131.97 L722.58 130.85 L730.16 129.77 L736 128.68 L736 368 L62 368 Z" fill="url(#fill-starhistorysvg)"/>
-  <path d="M62 367.97 L65.46 366.88 L67.02 365.8 L72.92 364.68 L73.14 363.6 L73.52 362.51 L73.98 361.43 L74.28 360.31 L74.63 359.23 L75.24 358.14 L75.86 357.06 L76.29 355.94 L76.95 354.86 L77.11 353.77 L77.34 352.69 L77.53 351.57 L77.7 350.49 L77.88 349.4 L77.98 348.32 L78.09 347.2 L78.23 346.11 L78.36 345.03 L78.49 343.94 L78.65 342.83 L78.88 341.74 L79 340.66 L79.11 339.57 L79.23 338.46 L79.33 337.37 L79.44 336.29 L79.53 335.2 L79.62 334.09 L79.75 333 L79.88 331.92 L80.05 330.83 L80.18 329.72 L80.33 328.63 L80.49 327.55 L80.74 326.46 L81.04 325.34 L81.43 324.26 L81.9 323.17 L82.29 322.09 L82.76 320.97 L83.05 319.89 L83.41 318.8 L83.7 317.72 L84.03 316.6 L84.8 315.52 L85.6 314.43 L85.99 313.35 L86.29 312.23 L86.75 311.15 L87.2 310.06 L88.05 308.98 L88.5 307.86 L88.69 306.77 L88.88 305.69 L89 304.61 L89.11 303.49 L89.23 302.4 L89.39 301.32 L89.54 300.23 L89.68 299.12 L89.79 298.03 L89.97 296.95 L90.14 295.86 L90.34 294.75 L90.58 293.66 L90.85 292.58 L91.06 291.49 L91.53 290.38 L92.07 289.29 L92.48 288.21 L92.86 287.12 L93.31 286.04 L94.39 284.92 L95.79 283.83 L97.32 282.75 L98.38 281.66 L99.32 280.55 L100.7 279.46 L101.99 278.38 L104.27 277.29 L105.05 276.18 L105.61 275.09 L106.44 274.01 L107.4 272.92 L108.1 271.81 L108.85 270.72 L110.04 269.64 L111.06 268.55 L114.04 267.44 L115.18 266.35 L117.3 265.27 L118.64 264.18 L120.21 263.07 L121.27 261.98 L123.73 260.9 L126.79 259.81 L130.36 258.69 L134.11 257.61 L138.55 256.52 L143.97 255.44 L148.98 254.32 L151.15 253.24 L151.87 252.15 
```

---

### Incident Patch 2: `1ebe2b83` (2026-11-10)
**Commit Message**: chore: refresh star history

**File**: `assets/star-history-dark.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#21262d" stroke-width="1"/>
   <text x="52" y="62" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.48 366.88 L67.04 365.8 L72.97 364.71 L73.2 363.6 L73.58 362.51 L74.04 361.43 L74.34 360.34 L74.68 359.26 L75.29 358.17 L75.93 357.09 L76.31 356 L77.02 354.89 L77.18 353.8 L77.41 352.72 L77.61 351.63 L77.77 350.55 L77.95 349.46 L78.06 348.38 L78.16 347.29 L78.31 346.18 L78.42 345.09 L78.57 344.01 L78.72 342.92 L78.94 341.84 L79.08 340.75 L79.17 339.67 L79.3 338.58 L79.41 337.47 L79.52 336.38 L79.62 335.3 L79.7 334.21 L79.82 333.13 L79.95 332.04 L80.12 330.96 L80.23 329.87 L80.39 328.75 L80.56 327.67 L80.79 326.58 L81.1 325.5 L81.47 324.41 L81.94 323.33 L82.34 322.24 L82.78 321.16 L83.13 320.04 L83.43 318.96 L83.75 317.87 L84.09 316.79 L84.78 315.7 L85.61 314.62 L86.07 313.53 L86.34 312.42 L86.76 311.33 L87.25 310.25 L88.01 309.16 L88.58 308.08 L88.78 306.99 L88.96 305.91 L89.11 304.82 L89.23 303.71 L89.31 302.62 L89.49 301.54 L89.64 300.45 L89.78 299.37 L89.89 298.28 L90.04 297.2 L90.25 296.11 L90.42 295 L90.65 293.91 L90.92 292.83 L91.14 291.74 L91.63 290.65 L92.02 289.57 L92.56 288.49 L92.89 287.4 L93.38 286.28 L94.22 285.2 L95.74 284.11 L96.97 283.03 L98.13 281.94 L99.12 280.86 L100.24 279.77 L101.88 278.69 L103.42 277.57 L105.19 276.49 L105.7 275.4 L106.27 274.32 L107.38 273.23 L108.09 272.15 L108.89 271.06 L109.77 269.95 L110.99 268.86 L113.1 267.78 L115.15 266.69 L116.87 265.61 L118.4 264.52 L120.05 263.44 L121.05 262.35 L123.51 261.24 L126.65 260.15 L129.69 259.07 L133.91 257.98 L136.78 256.9 L142.7 255.81 L148.31 254.73 L151.52 253.64 L152.01 252.53 L153.18 251.44 L155.41 250.36 L158.27 249.27 L161.94 248.19 L162.7 247.1 L163.89 246.02 L164.92 244.93 L166.34 243.81 L167.36 242.73 L168.07 241.64 L169.12 240.56 L174.65 239.47 L178.36 238.39 L183.45 237.3 L189.04 236.22 L192.21 235.1 L195.55 234.02 L202.88 232.93 L207.34 231.85 L213.89 230.76 L217.02 229.68 L222.67 228.59 L231.93 227.51 L242.54 226.39 L252.57 225.31 L259.68 224.22 L266.33 223.14 L277.86 222.05 L284.99 220.97 L295.01 219.88 L304.61 218.77 L314.04 217.68 L322.21 216.6 L323.89 215.51 L334.31 214.43 L341.69 213.34 L347.13 212.26 L360 211.17 L368.59 210.06 L377.11 208.97 L379.13 207.89 L380.83 206.8 L384.68 205.72 L387.5 204.63 L392.04 203.55 L399.65 202.46 L405.2 201.34 L413.45 200.26 L422.61 199.17 L428.97 198.09 L432.53 197 L439.88 195.92 L444.98 194.83 L452 193.75 L458.34 192.63 L466.25 191.55 L473.05 190.46 L475.69 189.38 L479.11 188.29 L480 187.21 L480.88 186.12 L482.19 185.04 L486.57 183.92 L491.55 182.84 L496.93 181.75 L504.19 180.67 L511.09 179.58 L520.35 178.5 L530.66 177.41 L535.16 176.3 L536.47 175.21 L541.31 174.13 L547.84 173.04 L553.49 171.96 L558.79 170.87 L561.84 169.79 L565.04 168.7 L568.89 167.59 L574.48 166.5 L580.64 165.42 L586.58 164.33 L587.39 163.25 L590.08 162.16 L592.57 161.08 L595.35 159.99 L602.14 158.87 L607.79 157.79 L614.91 156.7 L622.73 155.62 L627.49 154.53 L632.27 153.45 L637.1 152.36 L642.55 151.28 L647.84 150.16 L652.16 149.08 L659.15 147.99 L661.84 146.91 L665.35 145.82 L669.67 144.74 L673.61 143.65 L677.91 142.57 L683.21 141.45 L684.46 140.37 L688.24 139.28 L693.83 138.2 L699.49 137.11 L703.08 136.03 L706.29 134.94 L710.7 133.86 L715.38 132.74 L721.14 131.66 L728.01 130.57 L736 129.49 L736 368 L62 368 Z" fill="url(#fill-starhistorydarksvg)"/>
-  <path d="M62 367.97 L65.48 366.88 L67.04 365.8 L72.97 364.71 L73.2 363.6 L73.58 362.51 L74.04 361.43 L74.34 360.34 L74.68 359.26 L75.29 358.17 L75.93 357.09 L76.31 356 L77.02 354.89 L77.18 353.8 L77.41 352.72 L77.61 351.63 L77.77 350.55 L77.95 349.46 L78.06 348.38 L78.16 347.29 L78.31 346.18 L78.42 345.09 L78.57 344.01 L78.72 342.92 L78.94 341.84 L79.08 340.75 L79.17 339.67 L79.3 338.58 L79.41 337.47 L79.52 336.38 L79.62 335.3 L79.7 334.21 L79.82 333.13 L79.95 332.04 L80.12 330.96 L80.23 329.87 L80.39 328.75 L80.56 327.67 L80.79 326.58 L81.1 325.5 L81.47 324.41 L81.94 323.33 L82.34 322.24 L82.78 321.16 L83.13 320.04 L83.43 318.96 L83.75 317.87 L84.09 316.79 L84.78 315.7 L85.61 314.62 L86.07 313.53 L86.34 312.42 L86.76 311.33 L87.25 310.25 L88.01 309.16 L88.58 308.08 L88.78 306.99 L88.96 305.91 L89.11 304.82 L89.23 303.71 L89.31 302.62 L89.49 301.54 L89.64 300.45 L89.78 299.37 L89.89 298.28 L90.04 297.2 L90.25 296.11 L90.42 295 L90.65 293.91 L90.92 292.83 L91.14 291.74 L91.63 290.65 L92.02 289.57 L92.56 288.49 L92.89 287.4 L93.38 286.28 L94.22 285.2 L95.74 284.11 L96.97 283.03 L98.13 281.94 L99.12 280.86 L100.24 279.77 L101.88 278.69 L103.42 277.57 L105.19 276.49 L105.7 275.4 L106.27 274.32 L107.38 273.23 L108.09 272.15 L108.89 271.06 L109.77 269.95 L110.99 268.86 L113.1 267.78 L115.15 266.69 L116.87 265.61 L118.4 264.52 L120.05 263.44 L121.05 262.35 L123.51 261.24 L126.65 260.15 L129.69 259.07 L133.91 257.98 L136.78 256.9 L142.7 255.81 L148.31 254.73 L151.52 253.64 L152
```

**File**: `assets/star-history.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#e6eaef" stroke-width="1"/>
   <text x="52" y="62" fill="#59636e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.48 366.88 L67.04 365.8 L72.97 364.71 L73.2 363.6 L73.58 362.51 L74.04 361.43 L74.34 360.34 L74.68 359.26 L75.29 358.17 L75.93 357.09 L76.31 356 L77.02 354.89 L77.18 353.8 L77.41 352.72 L77.61 351.63 L77.77 350.55 L77.95 349.46 L78.06 348.38 L78.16 347.29 L78.31 346.18 L78.42 345.09 L78.57 344.01 L78.72 342.92 L78.94 341.84 L79.08 340.75 L79.17 339.67 L79.3 338.58 L79.41 337.47 L79.52 336.38 L79.62 335.3 L79.7 334.21 L79.82 333.13 L79.95 332.04 L80.12 330.96 L80.23 329.87 L80.39 328.75 L80.56 327.67 L80.79 326.58 L81.1 325.5 L81.47 324.41 L81.94 323.33 L82.34 322.24 L82.78 321.16 L83.13 320.04 L83.43 318.96 L83.75 317.87 L84.09 316.79 L84.78 315.7 L85.61 314.62 L86.07 313.53 L86.34 312.42 L86.76 311.33 L87.25 310.25 L88.01 309.16 L88.58 308.08 L88.78 306.99 L88.96 305.91 L89.11 304.82 L89.23 303.71 L89.31 302.62 L89.49 301.54 L89.64 300.45 L89.78 299.37 L89.89 298.28 L90.04 297.2 L90.25 296.11 L90.42 295 L90.65 293.91 L90.92 292.83 L91.14 291.74 L91.63 290.65 L92.02 289.57 L92.56 288.49 L92.89 287.4 L93.38 286.28 L94.22 285.2 L95.74 284.11 L96.97 283.03 L98.13 281.94 L99.12 280.86 L100.24 279.77 L101.88 278.69 L103.42 277.57 L105.19 276.49 L105.7 275.4 L106.27 274.32 L107.38 273.23 L108.09 272.15 L108.89 271.06 L109.77 269.95 L110.99 268.86 L113.1 267.78 L115.15 266.69 L116.87 265.61 L118.4 264.52 L120.05 263.44 L121.05 262.35 L123.51 261.24 L126.65 260.15 L129.69 259.07 L133.91 257.98 L136.78 256.9 L142.7 255.81 L148.31 254.73 L151.52 253.64 L152.01 252.53 L153.18 251.44 L155.41 250.36 L158.27 249.27 L161.94 248.19 L162.7 247.1 L163.89 246.02 L164.92 244.93 L166.34 243.81 L167.36 242.73 L168.07 241.64 L169.12 240.56 L174.65 239.47 L178.36 238.39 L183.45 237.3 L189.04 236.22 L192.21 235.1 L195.55 234.02 L202.88 232.93 L207.34 231.85 L213.89 230.76 L217.02 229.68 L222.67 228.59 L231.93 227.51 L242.54 226.39 L252.57 225.31 L259.68 224.22 L266.33 223.14 L277.86 222.05 L284.99 220.97 L295.01 219.88 L304.61 218.77 L314.04 217.68 L322.21 216.6 L323.89 215.51 L334.31 214.43 L341.69 213.34 L347.13 212.26 L360 211.17 L368.59 210.06 L377.11 208.97 L379.13 207.89 L380.83 206.8 L384.68 205.72 L387.5 204.63 L392.04 203.55 L399.65 202.46 L405.2 201.34 L413.45 200.26 L422.61 199.17 L428.97 198.09 L432.53 197 L439.88 195.92 L444.98 194.83 L452 193.75 L458.34 192.63 L466.25 191.55 L473.05 190.46 L475.69 189.38 L479.11 188.29 L480 187.21 L480.88 186.12 L482.19 185.04 L486.57 183.92 L491.55 182.84 L496.93 181.75 L504.19 180.67 L511.09 179.58 L520.35 178.5 L530.66 177.41 L535.16 176.3 L536.47 175.21 L541.31 174.13 L547.84 173.04 L553.49 171.96 L558.79 170.87 L561.84 169.79 L565.04 168.7 L568.89 167.59 L574.48 166.5 L580.64 165.42 L586.58 164.33 L587.39 163.25 L590.08 162.16 L592.57 161.08 L595.35 159.99 L602.14 158.87 L607.79 157.79 L614.91 156.7 L622.73 155.62 L627.49 154.53 L632.27 153.45 L637.1 152.36 L642.55 151.28 L647.84 150.16 L652.16 149.08 L659.15 147.99 L661.84 146.91 L665.35 145.82 L669.67 144.74 L673.61 143.65 L677.91 142.57 L683.21 141.45 L684.46 140.37 L688.24 139.28 L693.83 138.2 L699.49 137.11 L703.08 136.03 L706.29 134.94 L710.7 133.86 L715.38 132.74 L721.14 131.66 L728.01 130.57 L736 129.49 L736 368 L62 368 Z" fill="url(#fill-starhistorysvg)"/>
-  <path d="M62 367.97 L65.48 366.88 L67.04 365.8 L72.97 364.71 L73.2 363.6 L73.58 362.51 L74.04 361.43 L74.34 360.34 L74.68 359.26 L75.29 358.17 L75.93 357.09 L76.31 356 L77.02 354.89 L77.18 353.8 L77.41 352.72 L77.61 351.63 L77.77 350.55 L77.95 349.46 L78.06 348.38 L78.16 347.29 L78.31 346.18 L78.42 345.09 L78.57 344.01 L78.72 342.92 L78.94 341.84 L79.08 340.75 L79.17 339.67 L79.3 338.58 L79.41 337.47 L79.52 336.38 L79.62 335.3 L79.7 334.21 L79.82 333.13 L79.95 332.04 L80.12 330.96 L80.23 329.87 L80.39 328.75 L80.56 327.67 L80.79 326.58 L81.1 325.5 L81.47 324.41 L81.94 323.33 L82.34 322.24 L82.78 321.16 L83.13 320.04 L83.43 318.96 L83.75 317.87 L84.09 316.79 L84.78 315.7 L85.61 314.62 L86.07 313.53 L86.34 312.42 L86.76 311.33 L87.25 310.25 L88.01 309.16 L88.58 308.08 L88.78 306.99 L88.96 305.91 L89.11 304.82 L89.23 303.71 L89.31 302.62 L89.49 301.54 L89.64 300.45 L89.78 299.37 L89.89 298.28 L90.04 297.2 L90.25 296.11 L90.42 295 L90.65 293.91 L90.92 292.83 L91.14 291.74 L91.63 290.65 L92.02 289.57 L92.56 288.49 L92.89 287.4 L93.38 286.28 L94.22 285.2 L95.74 284.11 L96.97 283.03 L98.13 281.94 L99.12 280.86 L100.24 279.77 L101.88 278.69 L103.42 277.57 L105.19 276.49 L105.7 275.4 L106.27 274.32 L107.38 273.23 L108.09 272.15 L108.89 271.06 L109.77 269.95 L110.99 268.86 L113.1 267.78 L115.15 266.69 L116.87 265.61 L118.4 264.52 L120.05 263.44 L121.05 262.35 L123.51 261.24 L126.65 260.15 L129.69 259.07 L133.91 257.98 L136.78 256.9 L142.7 255.81 L148.31 254.73 L151.52 253.64 L152.01 
```

#### Recent Merged Pull Requests:
- **PR #192** (closed): feat(cli): redesign the interactive CLI with a terminal UI toolkit (@ingvarch)
- **PR #185** (2026-10-08): cli: land the dev download caches from #164 and the Hugging Face entry from #165 (@momenbasel)
- **PR #184** (2026-10-08): 3.1.0: land the reviewed localization, Settings and cleanup PRs (@momenbasel)
- **PR #183** (2026-10-08): fix(protection): treat firewall block-all mode (State = 2) as enabled (@momenbasel)
- **PR #182** (2026-10-08): fix(brew): use postflight_steps so the cask stops warning on upgrade (@momenbasel)
- **PR #181** (closed): Improve Simplified Chinese localization: complete fallbacks, add runtime-resolved strings, align terminology (@BruceQin520)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
