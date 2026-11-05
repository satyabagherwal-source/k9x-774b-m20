> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/momenbasel-puremac-learnings.md`  
> **Source**: github ([https://github.com/momenbasel/PureMac](https://github.com/momenbasel/PureMac))  
> **Source Version**: `03606271`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T02:55:14.317Z  
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
> **Harvest Timestamp**: 2026-11-05T02:55:14.309Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `momenbasel/PureMac`
- **Description**: Free, open-source macOS cleaner. CleanMyMac alternative with zero telemetry. Native SwiftUI, scheduled auto-cleaning, Xcode/Homebrew/system cache cleanup. MIT licensed.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7640 stars

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

### Incident Patch 1: `03606271` (2026-11-04)
**Commit Message**: chore: refresh star history

**File**: `assets/star-history-dark.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#21262d" stroke-width="1"/>
   <text x="52" y="62" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.58 366.88 L67.19 365.83 L73 364.75 L73.48 363.66 L73.88 362.61 L74.34 361.52 L74.66 360.44 L75.01 359.35 L75.57 358.3 L76.27 357.21 L76.68 356.13 L77.38 355.07 L77.6 353.99 L77.84 352.9 L78.02 351.85 L78.19 350.76 L78.38 349.68 L78.5 348.59 L78.6 347.54 L78.71 346.46 L78.86 345.37 L78.98 344.32 L79.15 343.23 L79.34 342.15 L79.53 341.09 L79.63 340.01 L79.76 338.92 L79.87 337.84 L79.99 336.78 L80.08 335.7 L80.17 334.61 L80.28 333.56 L80.41 332.47 L80.59 331.39 L80.72 330.34 L80.84 329.25 L81 328.17 L81.21 327.08 L81.49 326.03 L81.79 324.94 L82.26 323.86 L82.69 322.8 L83.16 321.72 L83.57 320.63 L83.84 319.58 L84.26 318.49 L84.54 317.41 L84.85 316.32 L85.77 315.27 L86.49 314.18 L86.84 313.1 L87.17 312.05 L87.67 310.96 L88.23 309.88 L89.04 308.82 L89.44 307.74 L89.61 306.65 L89.82 305.57 L89.93 304.51 L90.04 303.43 L90.17 302.34 L90.32 301.29 L90.48 300.2 L90.62 299.12 L90.74 298.06 L90.93 296.98 L91.1 295.89 L91.3 294.81 L91.54 293.76 L91.78 292.67 L92.03 291.59 L92.5 290.53 L92.96 289.45 L93.48 288.36 L93.81 287.31 L94.31 286.22 L95.34 285.14 L96.77 284.08 L98.2 283 L99.3 281.91 L100.27 280.83 L101.43 279.77 L103.05 278.69 L104.62 277.6 L106.44 276.55 L106.95 275.47 L107.54 274.38 L108.68 273.33 L109.31 272.24 L110.24 271.16 L111.09 270.07 L112.23 269.02 L114.09 267.93 L116.67 266.85 L118.15 265.79 L119.77 264.71 L121.7 263.62 L122.62 262.57 L124.98 261.48 L127.99 260.4 L131.42 259.31 L135.11 258.26 L138.44 257.18 L142.57 256.09 L149.56 255.04 L153.5 253.95 L154.47 252.87 L155.37 251.81 L157.8 250.73 L160.44 249.64 L163.92 248.56 L165.32 247.5 L166.47 246.42 L167.58 245.33 L168.8 244.28 L169.9 243.19 L170.94 242.11 L171.75 241.06 L175.29 239.97 L180.57 238.89 L184.72 237.8 L188.8 236.75 L194.34 235.66 L197.21 234.58 L203.65 233.52 L209.64 232.44 L215.62 231.35 L219.49 230.3 L223.93 229.21 L232.09 228.13 L241.51 227.04 L251.51 225.99 L261.4 224.9 L267.34 223.82 L277.28 222.77 L285.7 221.68 L296.34 220.6 L304.96 219.54 L314.5 218.46 L323.55 217.37 L330.13 216.29 L333.9 215.23 L345.1 214.15 L352.37 213.06 L358.39 212.01 L370.92 210.92 L378.74 209.84 L387.51 208.78 L388.47 207.7 L390.65 206.61 L394.27 205.56 L397.57 204.48 L402.76 203.39 L410.15 202.31 L416.21 201.25 L425.13 200.17 L433.99 199.08 L439.62 198.03 L443.53 196.94 L451.45 195.86 L456.7 194.8 L464.19 193.72 L470.23 192.63 L477.94 191.55 L484.92 190.49 L487.64 189.41 L491.16 188.32 L492.04 187.27 L492.94 186.19 L494.26 185.1 L498.27 184.05 L503.12 182.96 L508.07 181.88 L516.58 180.79 L522.91 179.74 L531.81 178.65 L541.39 177.57 L548.58 176.51 L549.49 175.43 L554.03 174.34 L559.67 173.29 L566.31 172.2 L572.6 171.12 L575.48 170.03 L578.86 168.98 L582.23 167.9 L587.97 166.81 L594.07 165.76 L601.06 164.67 L602.14 163.59 L603.77 162.53 L607.2 161.45 L609.74 160.36 L614.57 159.28 L620.59 158.22 L626.86 157.14 L637.12 156.05 L641.23 155 L646.57 153.91 L650.8 152.83 L656.14 151.78 L662.39 150.69 L666.41 149.6 L672.93 148.52 L677.71 147.47 L680.92 146.38 L685.38 145.3 L688.91 144.24 L694.06 143.16 L697.79 142.07 L701.54 141.02 L703.57 139.93 L708.42 138.85 L714.23 137.76 L720.43 136.71 L722.41 135.62 L726.17 134.54 L730.65 133.49 L736 132.4 L736 368 L62 368 Z" fill="url(#fill-starhistorydarksvg)"/>
-  <path d="M62 367.97 L65.58 366.88 L67.19 365.83 L73 364.75 L73.48 363.66 L73.88 362.61 L74.34 361.52 L74.66 360.44 L75.01 359.35 L75.57 358.3 L76.27 357.21 L76.68 356.13 L77.38 355.07 L77.6 353.99 L77.84 352.9 L78.02 351.85 L78.19 350.76 L78.38 349.68 L78.5 348.59 L78.6 347.54 L78.71 346.46 L78.86 345.37 L78.98 344.32 L79.15 343.23 L79.34 342.15 L79.53 341.09 L79.63 340.01 L79.76 338.92 L79.87 337.84 L79.99 336.78 L80.08 335.7 L80.17 334.61 L80.28 333.56 L80.41 332.47 L80.59 331.39 L80.72 330.34 L80.84 329.25 L81 328.17 L81.21 327.08 L81.49 326.03 L81.79 324.94 L82.26 323.86 L82.69 322.8 L83.16 321.72 L83.57 320.63 L83.84 319.58 L84.26 318.49 L84.54 317.41 L84.85 316.32 L85.77 315.27 L86.49 314.18 L86.84 313.1 L87.17 312.05 L87.67 310.96 L88.23 309.88 L89.04 308.82 L89.44 307.74 L89.61 306.65 L89.82 305.57 L89.93 304.51 L90.04 303.43 L90.17 302.34 L90.32 301.29 L90.48 300.2 L90.62 299.12 L90.74 298.06 L90.93 296.98 L91.1 295.89 L91.3 294.81 L91.54 293.76 L91.78 292.67 L92.03 291.59 L92.5 290.53 L92.96 289.45 L93.48 288.36 L93.81 287.31 L94.31 286.22 L95.34 285.14 L96.77 284.08 L98.2 283 L99.3 281.91 L100.27 280.83 L101.43 279.77 L103.05 278.69 L104.62 277.6 L106.44 276.55 L106.95 275.47 L107.54 274.38 L108.68 273.33 L109.31 272.24 L110.24 271.16 L111.09 270.07 L112.23 269.02 L114.09 267.93 L116.67 266.85 L118.15 265.79 L119.77 264.71 L121.7 263.62 L122.62 262.57 L124.98 261.48 L127.99 260.4 L131.42 259.31 L135.11 258.26 L138.44 257.18 L142.57 256.09 L149.56 255.04 L153.5 2
```

**File**: `assets/star-history.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#e6eaef" stroke-width="1"/>
   <text x="52" y="62" fill="#59636e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.58 366.88 L67.19 365.83 L73 364.75 L73.48 363.66 L73.88 362.61 L74.34 361.52 L74.66 360.44 L75.01 359.35 L75.57 358.3 L76.27 357.21 L76.68 356.13 L77.38 355.07 L77.6 353.99 L77.84 352.9 L78.02 351.85 L78.19 350.76 L78.38 349.68 L78.5 348.59 L78.6 347.54 L78.71 346.46 L78.86 345.37 L78.98 344.32 L79.15 343.23 L79.34 342.15 L79.53 341.09 L79.63 340.01 L79.76 338.92 L79.87 337.84 L79.99 336.78 L80.08 335.7 L80.17 334.61 L80.28 333.56 L80.41 332.47 L80.59 331.39 L80.72 330.34 L80.84 329.25 L81 328.17 L81.21 327.08 L81.49 326.03 L81.79 324.94 L82.26 323.86 L82.69 322.8 L83.16 321.72 L83.57 320.63 L83.84 319.58 L84.26 318.49 L84.54 317.41 L84.85 316.32 L85.77 315.27 L86.49 314.18 L86.84 313.1 L87.17 312.05 L87.67 310.96 L88.23 309.88 L89.04 308.82 L89.44 307.74 L89.61 306.65 L89.82 305.57 L89.93 304.51 L90.04 303.43 L90.17 302.34 L90.32 301.29 L90.48 300.2 L90.62 299.12 L90.74 298.06 L90.93 296.98 L91.1 295.89 L91.3 294.81 L91.54 293.76 L91.78 292.67 L92.03 291.59 L92.5 290.53 L92.96 289.45 L93.48 288.36 L93.81 287.31 L94.31 286.22 L95.34 285.14 L96.77 284.08 L98.2 283 L99.3 281.91 L100.27 280.83 L101.43 279.77 L103.05 278.69 L104.62 277.6 L106.44 276.55 L106.95 275.47 L107.54 274.38 L108.68 273.33 L109.31 272.24 L110.24 271.16 L111.09 270.07 L112.23 269.02 L114.09 267.93 L116.67 266.85 L118.15 265.79 L119.77 264.71 L121.7 263.62 L122.62 262.57 L124.98 261.48 L127.99 260.4 L131.42 259.31 L135.11 258.26 L138.44 257.18 L142.57 256.09 L149.56 255.04 L153.5 253.95 L154.47 252.87 L155.37 251.81 L157.8 250.73 L160.44 249.64 L163.92 248.56 L165.32 247.5 L166.47 246.42 L167.58 245.33 L168.8 244.28 L169.9 243.19 L170.94 242.11 L171.75 241.06 L175.29 239.97 L180.57 238.89 L184.72 237.8 L188.8 236.75 L194.34 235.66 L197.21 234.58 L203.65 233.52 L209.64 232.44 L215.62 231.35 L219.49 230.3 L223.93 229.21 L232.09 228.13 L241.51 227.04 L251.51 225.99 L261.4 224.9 L267.34 223.82 L277.28 222.77 L285.7 221.68 L296.34 220.6 L304.96 219.54 L314.5 218.46 L323.55 217.37 L330.13 216.29 L333.9 215.23 L345.1 214.15 L352.37 213.06 L358.39 212.01 L370.92 210.92 L378.74 209.84 L387.51 208.78 L388.47 207.7 L390.65 206.61 L394.27 205.56 L397.57 204.48 L402.76 203.39 L410.15 202.31 L416.21 201.25 L425.13 200.17 L433.99 199.08 L439.62 198.03 L443.53 196.94 L451.45 195.86 L456.7 194.8 L464.19 193.72 L470.23 192.63 L477.94 191.55 L484.92 190.49 L487.64 189.41 L491.16 188.32 L492.04 187.27 L492.94 186.19 L494.26 185.1 L498.27 184.05 L503.12 182.96 L508.07 181.88 L516.58 180.79 L522.91 179.74 L531.81 178.65 L541.39 177.57 L548.58 176.51 L549.49 175.43 L554.03 174.34 L559.67 173.29 L566.31 172.2 L572.6 171.12 L575.48 170.03 L578.86 168.98 L582.23 167.9 L587.97 166.81 L594.07 165.76 L601.06 164.67 L602.14 163.59 L603.77 162.53 L607.2 161.45 L609.74 160.36 L614.57 159.28 L620.59 158.22 L626.86 157.14 L637.12 156.05 L641.23 155 L646.57 153.91 L650.8 152.83 L656.14 151.78 L662.39 150.69 L666.41 149.6 L672.93 148.52 L677.71 147.47 L680.92 146.38 L685.38 145.3 L688.91 144.24 L694.06 143.16 L697.79 142.07 L701.54 141.02 L703.57 139.93 L708.42 138.85 L714.23 137.76 L720.43 136.71 L722.41 135.62 L726.17 134.54 L730.65 133.49 L736 132.4 L736 368 L62 368 Z" fill="url(#fill-starhistorysvg)"/>
-  <path d="M62 367.97 L65.58 366.88 L67.19 365.83 L73 364.75 L73.48 363.66 L73.88 362.61 L74.34 361.52 L74.66 360.44 L75.01 359.35 L75.57 358.3 L76.27 357.21 L76.68 356.13 L77.38 355.07 L77.6 353.99 L77.84 352.9 L78.02 351.85 L78.19 350.76 L78.38 349.68 L78.5 348.59 L78.6 347.54 L78.71 346.46 L78.86 345.37 L78.98 344.32 L79.15 343.23 L79.34 342.15 L79.53 341.09 L79.63 340.01 L79.76 338.92 L79.87 337.84 L79.99 336.78 L80.08 335.7 L80.17 334.61 L80.28 333.56 L80.41 332.47 L80.59 331.39 L80.72 330.34 L80.84 329.25 L81 328.17 L81.21 327.08 L81.49 326.03 L81.79 324.94 L82.26 323.86 L82.69 322.8 L83.16 321.72 L83.57 320.63 L83.84 319.58 L84.26 318.49 L84.54 317.41 L84.85 316.32 L85.77 315.27 L86.49 314.18 L86.84 313.1 L87.17 312.05 L87.67 310.96 L88.23 309.88 L89.04 308.82 L89.44 307.74 L89.61 306.65 L89.82 305.57 L89.93 304.51 L90.04 303.43 L90.17 302.34 L90.32 301.29 L90.48 300.2 L90.62 299.12 L90.74 298.06 L90.93 296.98 L91.1 295.89 L91.3 294.81 L91.54 293.76 L91.78 292.67 L92.03 291.59 L92.5 290.53 L92.96 289.45 L93.48 288.36 L93.81 287.31 L94.31 286.22 L95.34 285.14 L96.77 284.08 L98.2 283 L99.3 281.91 L100.27 280.83 L101.43 279.77 L103.05 278.69 L104.62 277.6 L106.44 276.55 L106.95 275.47 L107.54 274.38 L108.68 273.33 L109.31 272.24 L110.24 271.16 L111.09 270.07 L112.23 269.02 L114.09 267.93 L116.67 266.85 L118.15 265.79 L119.77 264.71 L121.7 263.62 L122.62 262.57 L124.98 261.48 L127.99 260.4 L131.42 259.31 L135.11 258.26 L138.44 257.18 L142.57 256.09 L149.56 255.04 L153.5 253.9
```

---

### Incident Patch 2: `0091a378` (2026-11-03)
**Commit Message**: chore: refresh star history

**File**: `assets/star-history-dark.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#21262d" stroke-width="1"/>
   <text x="52" y="62" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.6 366.88 L67.21 365.83 L73.05 364.75 L73.53 363.66 L73.94 362.61 L74.4 361.52 L74.71 360.47 L75.07 359.38 L75.64 358.3 L76.33 357.24 L76.74 356.16 L77.45 355.07 L77.67 354.02 L77.91 352.93 L78.08 351.88 L78.26 350.8 L78.43 349.71 L78.57 348.66 L78.68 347.57 L78.78 346.49 L78.93 345.43 L79.06 344.35 L79.2 343.29 L79.41 342.21 L79.61 341.12 L79.7 340.07 L79.83 338.98 L79.95 337.9 L80.07 336.85 L80.16 335.76 L80.25 334.71 L80.36 333.62 L80.49 332.54 L80.67 331.48 L80.8 330.4 L80.93 329.31 L81.07 328.26 L81.29 327.17 L81.57 326.12 L81.86 325.03 L82.33 323.95 L82.76 322.9 L83.18 321.81 L83.63 320.73 L83.93 319.67 L84.32 318.59 L84.58 317.53 L84.9 316.45 L85.86 315.36 L86.53 314.31 L86.94 313.22 L87.23 312.14 L87.71 311.08 L88.24 310 L89.1 308.95 L89.53 307.86 L89.72 306.77 L89.91 305.72 L90.04 304.64 L90.15 303.55 L90.26 302.5 L90.43 301.41 L90.6 300.36 L90.73 299.27 L90.84 298.19 L91 297.13 L91.2 296.05 L91.38 294.96 L91.62 293.91 L91.89 292.83 L92.12 291.77 L92.63 290.69 L93.02 289.6 L93.55 288.55 L93.92 287.46 L94.41 286.38 L95.22 285.32 L96.84 284.24 L97.97 283.18 L99.26 282.1 L100.26 281.01 L101.38 279.96 L103.08 278.88 L104.63 277.79 L106.57 276.74 L107.06 275.65 L107.52 274.6 L108.79 273.51 L109.43 272.43 L110.38 271.37 L111.02 270.29 L112.29 269.2 L113.69 268.15 L116.72 267.06 L117.9 266.01 L119.83 264.93 L121.87 263.84 L122.78 262.79 L124.92 261.7 L126.93 260.62 L130.88 259.56 L134.49 258.48 L137.84 257.42 L142.23 256.34 L149.14 255.25 L152.76 254.2 L154.77 253.11 L155.45 252.03 L157.95 250.98 L160.44 249.89 L162.64 248.84 L165.7 247.75 L166.72 246.67 L167.73 245.61 L168.79 244.53 L170.16 243.44 L171.17 242.39 L172.06 241.3 L174.45 240.25 L179.6 239.16 L183.87 238.08 L188.45 237.03 L194.28 235.94 L197.16 234.86 L200.96 233.8 L208.24 232.72 L213.76 231.66 L219.58 230.58 L223.68 229.49 L230 228.44 L239.41 227.35 L249.44 226.27 L259.57 225.21 L266.62 224.13 L273.47 223.08 L285.18 221.99 L292.83 220.91 L303.33 219.85 L313.49 218.77 L322.94 217.68 L330.95 216.63 L332.69 215.54 L343.08 214.49 L351.05 213.4 L356.58 212.32 L369.81 211.26 L377.88 210.18 L387.27 209.09 L389.67 208.04 L391.3 206.96 L395.31 205.9 L398.16 204.82 L402.37 203.73 L409.78 202.68 L415.59 201.59 L424.02 200.51 L431.53 199.45 L441.06 198.37 L443.84 197.31 L450.95 196.23 L457.11 195.14 L463.42 194.09 L469.48 193.01 L477.13 191.92 L485.82 190.87 L488.6 189.78 L492.01 188.73 L493.69 187.64 L494.48 186.56 L495.84 185.5 L498.71 184.42 L503.58 183.33 L508.77 182.28 L515.23 181.19 L522.29 180.14 L531.89 179.05 L539.92 177.97 L549.51 176.92 L551.45 175.83 L554.56 174.75 L558.92 173.69 L567.51 172.61 L572.21 171.55 L576.85 170.47 L580.26 169.38 L583.27 168.33 L587.63 167.24 L593.71 166.16 L599.18 165.11 L604.29 164.02 L605.75 162.97 L608.2 161.88 L610.89 160.8 L614.29 159.74 L621.5 158.66 L627.02 157.57 L636.18 156.52 L641.95 155.43 L647.55 154.38 L651.79 153.29 L657.51 152.21 L662.87 151.16 L667.87 150.07 L672.28 148.98 L679.52 147.93 L681.99 146.85 L685.63 145.79 L690.09 144.71 L694.17 143.62 L698.56 142.57 L703.96 141.48 L705.21 140.4 L708.79 139.34 L714.57 138.26 L720.52 137.2 L724.44 136.12 L727.36 135.04 L731.97 133.98 L736 132.9 L736 368 L62 368 Z" fill="url(#fill-starhistorydarksvg)"/>
-  <path d="M62 367.97 L65.6 366.88 L67.21 365.83 L73.05 364.75 L73.53 363.66 L73.94 362.61 L74.4 361.52 L74.71 360.47 L75.07 359.38 L75.64 358.3 L76.33 357.24 L76.74 356.16 L77.45 355.07 L77.67 354.02 L77.91 352.93 L78.08 351.88 L78.26 350.8 L78.43 349.71 L78.57 348.66 L78.68 347.57 L78.78 346.49 L78.93 345.43 L79.06 344.35 L79.2 343.29 L79.41 342.21 L79.61 341.12 L79.7 340.07 L79.83 338.98 L79.95 337.9 L80.07 336.85 L80.16 335.76 L80.25 334.71 L80.36 333.62 L80.49 332.54 L80.67 331.48 L80.8 330.4 L80.93 329.31 L81.07 328.26 L81.29 327.17 L81.57 326.12 L81.86 325.03 L82.33 323.95 L82.76 322.9 L83.18 321.81 L83.63 320.73 L83.93 319.67 L84.32 318.59 L84.58 317.53 L84.9 316.45 L85.86 315.36 L86.53 314.31 L86.94 313.22 L87.23 312.14 L87.71 311.08 L88.24 310 L89.1 308.95 L89.53 307.86 L89.72 306.77 L89.91 305.72 L90.04 304.64 L90.15 303.55 L90.26 302.5 L90.43 301.41 L90.6 300.36 L90.73 299.27 L90.84 298.19 L91 297.13 L91.2 296.05 L91.38 294.96 L91.62 293.91 L91.89 292.83 L92.12 291.77 L92.63 290.69 L93.02 289.6 L93.55 288.55 L93.92 287.46 L94.41 286.38 L95.22 285.32 L96.84 284.24 L97.97 283.18 L99.26 282.1 L100.26 281.01 L101.38 279.96 L103.08 278.88 L104.63 277.79 L106.57 276.74 L107.06 275.65 L107.52 274.6 L108.79 273.51 L109.43 272.43 L110.38 271.37 L111.02 270.29 L112.29 269.2 L113.69 268.15 L116.72 267.06 L117.9 266.01 L119.83 264.93 L121.87 263.84 L122.78 262.79 L124.92 261.7 L126.93 260.62 L130.88 259.56 L134.49 258.48 L137.84 257.42 L142.23 256.34 L149.14 255.25
```

**File**: `assets/star-history.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#e6eaef" stroke-width="1"/>
   <text x="52" y="62" fill="#59636e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.6 366.88 L67.21 365.83 L73.05 364.75 L73.53 363.66 L73.94 362.61 L74.4 361.52 L74.71 360.47 L75.07 359.38 L75.64 358.3 L76.33 357.24 L76.74 356.16 L77.45 355.07 L77.67 354.02 L77.91 352.93 L78.08 351.88 L78.26 350.8 L78.43 349.71 L78.57 348.66 L78.68 347.57 L78.78 346.49 L78.93 345.43 L79.06 344.35 L79.2 343.29 L79.41 342.21 L79.61 341.12 L79.7 340.07 L79.83 338.98 L79.95 337.9 L80.07 336.85 L80.16 335.76 L80.25 334.71 L80.36 333.62 L80.49 332.54 L80.67 331.48 L80.8 330.4 L80.93 329.31 L81.07 328.26 L81.29 327.17 L81.57 326.12 L81.86 325.03 L82.33 323.95 L82.76 322.9 L83.18 321.81 L83.63 320.73 L83.93 319.67 L84.32 318.59 L84.58 317.53 L84.9 316.45 L85.86 315.36 L86.53 314.31 L86.94 313.22 L87.23 312.14 L87.71 311.08 L88.24 310 L89.1 308.95 L89.53 307.86 L89.72 306.77 L89.91 305.72 L90.04 304.64 L90.15 303.55 L90.26 302.5 L90.43 301.41 L90.6 300.36 L90.73 299.27 L90.84 298.19 L91 297.13 L91.2 296.05 L91.38 294.96 L91.62 293.91 L91.89 292.83 L92.12 291.77 L92.63 290.69 L93.02 289.6 L93.55 288.55 L93.92 287.46 L94.41 286.38 L95.22 285.32 L96.84 284.24 L97.97 283.18 L99.26 282.1 L100.26 281.01 L101.38 279.96 L103.08 278.88 L104.63 277.79 L106.57 276.74 L107.06 275.65 L107.52 274.6 L108.79 273.51 L109.43 272.43 L110.38 271.37 L111.02 270.29 L112.29 269.2 L113.69 268.15 L116.72 267.06 L117.9 266.01 L119.83 264.93 L121.87 263.84 L122.78 262.79 L124.92 261.7 L126.93 260.62 L130.88 259.56 L134.49 258.48 L137.84 257.42 L142.23 256.34 L149.14 255.25 L152.76 254.2 L154.77 253.11 L155.45 252.03 L157.95 250.98 L160.44 249.89 L162.64 248.84 L165.7 247.75 L166.72 246.67 L167.73 245.61 L168.79 244.53 L170.16 243.44 L171.17 242.39 L172.06 241.3 L174.45 240.25 L179.6 239.16 L183.87 238.08 L188.45 237.03 L194.28 235.94 L197.16 234.86 L200.96 233.8 L208.24 232.72 L213.76 231.66 L219.58 230.58 L223.68 229.49 L230 228.44 L239.41 227.35 L249.44 226.27 L259.57 225.21 L266.62 224.13 L273.47 223.08 L285.18 221.99 L292.83 220.91 L303.33 219.85 L313.49 218.77 L322.94 217.68 L330.95 216.63 L332.69 215.54 L343.08 214.49 L351.05 213.4 L356.58 212.32 L369.81 211.26 L377.88 210.18 L387.27 209.09 L389.67 208.04 L391.3 206.96 L395.31 205.9 L398.16 204.82 L402.37 203.73 L409.78 202.68 L415.59 201.59 L424.02 200.51 L431.53 199.45 L441.06 198.37 L443.84 197.31 L450.95 196.23 L457.11 195.14 L463.42 194.09 L469.48 193.01 L477.13 191.92 L485.82 190.87 L488.6 189.78 L492.01 188.73 L493.69 187.64 L494.48 186.56 L495.84 185.5 L498.71 184.42 L503.58 183.33 L508.77 182.28 L515.23 181.19 L522.29 180.14 L531.89 179.05 L539.92 177.97 L549.51 176.92 L551.45 175.83 L554.56 174.75 L558.92 173.69 L567.51 172.61 L572.21 171.55 L576.85 170.47 L580.26 169.38 L583.27 168.33 L587.63 167.24 L593.71 166.16 L599.18 165.11 L604.29 164.02 L605.75 162.97 L608.2 161.88 L610.89 160.8 L614.29 159.74 L621.5 158.66 L627.02 157.57 L636.18 156.52 L641.95 155.43 L647.55 154.38 L651.79 153.29 L657.51 152.21 L662.87 151.16 L667.87 150.07 L672.28 148.98 L679.52 147.93 L681.99 146.85 L685.63 145.79 L690.09 144.71 L694.17 143.62 L698.56 142.57 L703.96 141.48 L705.21 140.4 L708.79 139.34 L714.57 138.26 L720.52 137.2 L724.44 136.12 L727.36 135.04 L731.97 133.98 L736 132.9 L736 368 L62 368 Z" fill="url(#fill-starhistorysvg)"/>
-  <path d="M62 367.97 L65.6 366.88 L67.21 365.83 L73.05 364.75 L73.53 363.66 L73.94 362.61 L74.4 361.52 L74.71 360.47 L75.07 359.38 L75.64 358.3 L76.33 357.24 L76.74 356.16 L77.45 355.07 L77.67 354.02 L77.91 352.93 L78.08 351.88 L78.26 350.8 L78.43 349.71 L78.57 348.66 L78.68 347.57 L78.78 346.49 L78.93 345.43 L79.06 344.35 L79.2 343.29 L79.41 342.21 L79.61 341.12 L79.7 340.07 L79.83 338.98 L79.95 337.9 L80.07 336.85 L80.16 335.76 L80.25 334.71 L80.36 333.62 L80.49 332.54 L80.67 331.48 L80.8 330.4 L80.93 329.31 L81.07 328.26 L81.29 327.17 L81.57 326.12 L81.86 325.03 L82.33 323.95 L82.76 322.9 L83.18 321.81 L83.63 320.73 L83.93 319.67 L84.32 318.59 L84.58 317.53 L84.9 316.45 L85.86 315.36 L86.53 314.31 L86.94 313.22 L87.23 312.14 L87.71 311.08 L88.24 310 L89.1 308.95 L89.53 307.86 L89.72 306.77 L89.91 305.72 L90.04 304.64 L90.15 303.55 L90.26 302.5 L90.43 301.41 L90.6 300.36 L90.73 299.27 L90.84 298.19 L91 297.13 L91.2 296.05 L91.38 294.96 L91.62 293.91 L91.89 292.83 L92.12 291.77 L92.63 290.69 L93.02 289.6 L93.55 288.55 L93.92 287.46 L94.41 286.38 L95.22 285.32 L96.84 284.24 L97.97 283.18 L99.26 282.1 L100.26 281.01 L101.38 279.96 L103.08 278.88 L104.63 277.79 L106.57 276.74 L107.06 275.65 L107.52 274.6 L108.79 273.51 L109.43 272.43 L110.38 271.37 L111.02 270.29 L112.29 269.2 L113.69 268.15 L116.72 267.06 L117.9 266.01 L119.83 264.93 L121.87 263.84 L122.78 262.79 L124.92 261.7 L126.93 260.62 L130.88 259.56 L134.49 258.48 L137.84 257.42 L142.23 256.34 L149.14 255.25 L15
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
