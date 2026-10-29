> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/momenbasel-puremac-learnings.md`  
> **Source**: github ([https://github.com/momenbasel/PureMac](https://github.com/momenbasel/PureMac))  
> **Source Version**: `046e5c5b`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-29T01:08:58.157Z  
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
> **Harvest Timestamp**: 2026-10-29T01:08:58.045Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `momenbasel/PureMac`
- **Description**: Free, open-source macOS cleaner. CleanMyMac alternative with zero telemetry. Native SwiftUI, scheduled auto-cleaning, Xcode/Homebrew/system cache cleanup. MIT licensed.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7458 stars

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

### Incident Patch 1: `046e5c5b` (2026-10-28)
**Commit Message**: chore: refresh star history

**File**: `assets/star-history-dark.svg` (modified, +10/-10)
```diff
@@ -23,17 +23,17 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#21262d" stroke-width="1"/>
   <text x="52" y="62" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">8k</text>
 
-  <path d="M62 367.96 L65.58 366.64 L67.37 365.33 L72.48 364.01 L73.86 362.69 L74.28 361.37 L74.7 360.1 L75.07 358.78 L75.41 357.46 L75.88 356.14 L76.59 354.83 L77.07 353.51 L77.71 352.19 L78.09 350.87 L78.3 349.56 L78.48 348.24 L78.66 346.96 L78.84 345.64 L79.02 344.32 L79.12 343.01 L79.23 341.69 L79.38 340.37 L79.53 339.05 L79.65 337.74 L79.82 336.42 L80.06 335.1 L80.18 333.78 L80.27 332.51 L80.42 331.19 L80.52 329.87 L80.64 328.55 L80.74 327.24 L80.83 325.92 L80.94 324.6 L81.07 323.28 L81.26 321.97 L81.39 320.65 L81.51 319.37 L81.69 318.05 L81.89 316.73 L82.18 315.42 L82.49 314.1 L82.97 312.78 L83.41 311.46 L83.89 310.15 L84.28 308.83 L84.59 307.51 L84.98 306.23 L85.26 304.92 L85.59 303.6 L86.53 302.28 L87.25 300.96 L87.66 299.65 L87.93 298.33 L88.41 297.01 L88.92 295.69 L89.71 294.38 L90.31 293.06 L90.5 291.78 L90.7 290.46 L90.85 289.14 L90.97 287.83 L91.06 286.51 L91.24 285.19 L91.39 283.87 L91.54 282.56 L91.67 281.24 L91.83 279.92 L92 278.64 L92.2 277.33 L92.41 276.01 L92.65 274.69 L92.92 273.37 L93.26 272.06 L93.68 270.74 L94.25 269.42 L94.67 268.1 L95.08 266.78 L95.6 265.47 L96.65 264.19 L98.13 262.87 L99.73 261.55 L100.79 260.24 L101.62 258.92 L102.9 257.6 L104.54 256.28 L106.09 254.97 L107.98 253.65 L108.49 252.33 L108.99 251.05 L110.23 249.74 L110.87 248.42 L111.87 247.1 L112.56 245.78 L113.8 244.46 L115.23 243.15 L118.32 241.83 L119.48 240.51 L121.53 239.2 L123.57 237.88 L124.52 236.6 L125.99 235.28 L128.26 233.96 L131.75 232.65 L135.18 231.33 L139.32 230.01 L143.89 228.69 L149.69 227.38 L154.83 226.06 L157.35 224.74 L158.06 223.46 L159.38 222.15 L161.61 220.83 L164.62 219.51 L168.4 218.19 L169.25 216.88 L170.47 215.56 L171.52 214.24 L173.04 212.92 L174.01 211.61 L174.82 210.33 L175.79 209.01 L181.1 207.69 L185.12 206.37 L189.26 205.06 L194.58 203.74 L199.42 202.42 L202.24 201.1 L209.18 199.79 L214.85 198.47 L220.95 197.15 L224.91 195.87 L229.41 194.56 L236.75 193.24 L245.8 191.92 L255.91 190.6 L266.38 189.29 L273.19 187.97 L281.38 186.65 L291.93 185.33 L299.93 184.02 L310.55 182.74 L320.27 181.42 L329.96 180.1 L338.84 178.78 L340.47 177.47 L349.58 176.15 L358.86 174.83 L365.17 173.51 L376.54 172.2 L385.68 170.88 L396.37 169.56 L399.14 168.28 L400.58 166.97 L403.62 165.65 L406.7 164.33 L410.78 163.01 L417.57 161.7 L424.67 160.38 L430.64 159.06 L439.78 157.74 L448.41 156.43 L452.98 155.15 L458.85 153.83 L465.83 152.51 L471.3 151.19 L479.25 149.88 L485.64 148.56 L493.44 147.24 L499.68 145.92 L502.42 144.61 L506.06 143.29 L506.98 141.97 L507.82 140.69 L509.18 139.38 L513.34 138.06 L517.88 136.74 L523.35 135.42 L530.3 134.11 L537.04 132.79 L546.59 131.47 L555.49 130.15 L564.93 128.84 L566.14 127.56 L569.4 126.24 L574.74 124.92 L582.68 123.6 L587.58 122.29 L592.25 120.97 L595.72 119.65 L598.86 118.33 L603.26 117.02 L608.33 115.7 L614.51 114.42 L620.45 113.1 L621.38 111.78 L624.17 110.47 L626.82 109.15 L629.78 107.83 L636.65 106.51 L642.72 105.2 L649.3 103.88 L657.58 102.56 L662.77 101.25 L667.21 99.97 L672.2 98.65 L677.4 97.33 L683.61 96.01 L688.29 94.7 L694.56 93.38 L699.57 92.06 L702.45 90.74 L706.99 89.43 L710.66 88.11 L715.95 86.83 L719.81 85.51 L723.69 84.2 L724.92 82.88 L730.2 81.56 L736 80.24 L736 368 L62 368 Z" fill="url(#fill-starhistorydarksvg)"/>
-  <path d="M62 367.96 L65.58 366.64 L67.37 365.33 L72.48 364.01 L73.86 362.69 L74.28 361.37 L74.7 360.1 L75.07 358.78 L75.41 357.46 L75.88 356.14 L76.59 354.83 L77.07 353.51 L77.71 352.19 L78.09 350.87 L78.3 349.56 L78.48 348.24 L78.66 346.96 L78.84 345.64 L79.02 344.32 L79.12 343.01 L79.23 341.69 L79.38 340.37 L79.53 339.05 L79.65 337.74 L79.82 336.42 L80.06 335.1 L80.18 333.78 L80.27 332.51 L80.42 331.19 L80.52 329.87 L80.64 328.55 L80.74 327.24 L80.83 325.92 L80.94 324.6 L81.07 323.28 L81.26 321.97 L81.39 320.65 L81.51 319.37 L81.69 318.05 L81.89 316.73 L82.18 315.42 L82.49 314.1 L82.97 312.78 L83.41 311.46 L83.89 310.15 L84.28 308.83 L84.59 307.51 L84.98 306.23 L85.26 304.92 L85.59 303.6 L86.53 302.28 L87.25 300.96 L87.66 299.65 L87.93 298.33 L88.41 297.01 L88.92 295.69 L89.71 294.38 L90.31 293.06 L90.5 291.78 L90.7 290.46 L90.85 289.14 L90.97 287.83 L91.06 286.51 L91.24 285.19 L91.39 283.87 L91.54 282.56 L91.67 281.24 L91.83 279.92 L92 278.64 L92.2 277.33 L92.41 276.01 L92.65 274.69 L92.92 273.37 L93.26 272.06 L93.68 270.74 L94.25 269.42 L94.67 268.1 L95.08 266.78 L95.6 265.47 L96.65 264.19 L98.13 262.87 L99.73 261.55 L100.79 260.24 L101.62 258.92 L102.9 257.6 L104.54 256.28 L106.09 254.97 L107.98 253.65 L108.49 252.33 L108.99 251.05 L110.23 249.74 L110.87 248.42 L111.87 247.1 L112.56 245.78 L113.8 244.46 L115.23 243.15 L118.32 241.83 L119.48 240.51 L121.53 239.2 L123.57 237.88 L124.52 236.6 L125.99 235.28 L128.26 233.96 L131.75 232.65 L135.18 231.33 L139.32 230.01 L143.89 2
```

**File**: `assets/star-history.svg` (modified, +10/-10)
```diff
@@ -23,17 +23,17 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#e6eaef" stroke-width="1"/>
   <text x="52" y="62" fill="#59636e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">8k</text>
 
-  <path d="M62 367.96 L65.58 366.64 L67.37 365.33 L72.48 364.01 L73.86 362.69 L74.28 361.37 L74.7 360.1 L75.07 358.78 L75.41 357.46 L75.88 356.14 L76.59 354.83 L77.07 353.51 L77.71 352.19 L78.09 350.87 L78.3 349.56 L78.48 348.24 L78.66 346.96 L78.84 345.64 L79.02 344.32 L79.12 343.01 L79.23 341.69 L79.38 340.37 L79.53 339.05 L79.65 337.74 L79.82 336.42 L80.06 335.1 L80.18 333.78 L80.27 332.51 L80.42 331.19 L80.52 329.87 L80.64 328.55 L80.74 327.24 L80.83 325.92 L80.94 324.6 L81.07 323.28 L81.26 321.97 L81.39 320.65 L81.51 319.37 L81.69 318.05 L81.89 316.73 L82.18 315.42 L82.49 314.1 L82.97 312.78 L83.41 311.46 L83.89 310.15 L84.28 308.83 L84.59 307.51 L84.98 306.23 L85.26 304.92 L85.59 303.6 L86.53 302.28 L87.25 300.96 L87.66 299.65 L87.93 298.33 L88.41 297.01 L88.92 295.69 L89.71 294.38 L90.31 293.06 L90.5 291.78 L90.7 290.46 L90.85 289.14 L90.97 287.83 L91.06 286.51 L91.24 285.19 L91.39 283.87 L91.54 282.56 L91.67 281.24 L91.83 279.92 L92 278.64 L92.2 277.33 L92.41 276.01 L92.65 274.69 L92.92 273.37 L93.26 272.06 L93.68 270.74 L94.25 269.42 L94.67 268.1 L95.08 266.78 L95.6 265.47 L96.65 264.19 L98.13 262.87 L99.73 261.55 L100.79 260.24 L101.62 258.92 L102.9 257.6 L104.54 256.28 L106.09 254.97 L107.98 253.65 L108.49 252.33 L108.99 251.05 L110.23 249.74 L110.87 248.42 L111.87 247.1 L112.56 245.78 L113.8 244.46 L115.23 243.15 L118.32 241.83 L119.48 240.51 L121.53 239.2 L123.57 237.88 L124.52 236.6 L125.99 235.28 L128.26 233.96 L131.75 232.65 L135.18 231.33 L139.32 230.01 L143.89 228.69 L149.69 227.38 L154.83 226.06 L157.35 224.74 L158.06 223.46 L159.38 222.15 L161.61 220.83 L164.62 219.51 L168.4 218.19 L169.25 216.88 L170.47 215.56 L171.52 214.24 L173.04 212.92 L174.01 211.61 L174.82 210.33 L175.79 209.01 L181.1 207.69 L185.12 206.37 L189.26 205.06 L194.58 203.74 L199.42 202.42 L202.24 201.1 L209.18 199.79 L214.85 198.47 L220.95 197.15 L224.91 195.87 L229.41 194.56 L236.75 193.24 L245.8 191.92 L255.91 190.6 L266.38 189.29 L273.19 187.97 L281.38 186.65 L291.93 185.33 L299.93 184.02 L310.55 182.74 L320.27 181.42 L329.96 180.1 L338.84 178.78 L340.47 177.47 L349.58 176.15 L358.86 174.83 L365.17 173.51 L376.54 172.2 L385.68 170.88 L396.37 169.56 L399.14 168.28 L400.58 166.97 L403.62 165.65 L406.7 164.33 L410.78 163.01 L417.57 161.7 L424.67 160.38 L430.64 159.06 L439.78 157.74 L448.41 156.43 L452.98 155.15 L458.85 153.83 L465.83 152.51 L471.3 151.19 L479.25 149.88 L485.64 148.56 L493.44 147.24 L499.68 145.92 L502.42 144.61 L506.06 143.29 L506.98 141.97 L507.82 140.69 L509.18 139.38 L513.34 138.06 L517.88 136.74 L523.35 135.42 L530.3 134.11 L537.04 132.79 L546.59 131.47 L555.49 130.15 L564.93 128.84 L566.14 127.56 L569.4 126.24 L574.74 124.92 L582.68 123.6 L587.58 122.29 L592.25 120.97 L595.72 119.65 L598.86 118.33 L603.26 117.02 L608.33 115.7 L614.51 114.42 L620.45 113.1 L621.38 111.78 L624.17 110.47 L626.82 109.15 L629.78 107.83 L636.65 106.51 L642.72 105.2 L649.3 103.88 L657.58 102.56 L662.77 101.25 L667.21 99.97 L672.2 98.65 L677.4 97.33 L683.61 96.01 L688.29 94.7 L694.56 93.38 L699.57 92.06 L702.45 90.74 L706.99 89.43 L710.66 88.11 L715.95 86.83 L719.81 85.51 L723.69 84.2 L724.92 82.88 L730.2 81.56 L736 80.24 L736 368 L62 368 Z" fill="url(#fill-starhistorysvg)"/>
-  <path d="M62 367.96 L65.58 366.64 L67.37 365.33 L72.48 364.01 L73.86 362.69 L74.28 361.37 L74.7 360.1 L75.07 358.78 L75.41 357.46 L75.88 356.14 L76.59 354.83 L77.07 353.51 L77.71 352.19 L78.09 350.87 L78.3 349.56 L78.48 348.24 L78.66 346.96 L78.84 345.64 L79.02 344.32 L79.12 343.01 L79.23 341.69 L79.38 340.37 L79.53 339.05 L79.65 337.74 L79.82 336.42 L80.06 335.1 L80.18 333.78 L80.27 332.51 L80.42 331.19 L80.52 329.87 L80.64 328.55 L80.74 327.24 L80.83 325.92 L80.94 324.6 L81.07 323.28 L81.26 321.97 L81.39 320.65 L81.51 319.37 L81.69 318.05 L81.89 316.73 L82.18 315.42 L82.49 314.1 L82.97 312.78 L83.41 311.46 L83.89 310.15 L84.28 308.83 L84.59 307.51 L84.98 306.23 L85.26 304.92 L85.59 303.6 L86.53 302.28 L87.25 300.96 L87.66 299.65 L87.93 298.33 L88.41 297.01 L88.92 295.69 L89.71 294.38 L90.31 293.06 L90.5 291.78 L90.7 290.46 L90.85 289.14 L90.97 287.83 L91.06 286.51 L91.24 285.19 L91.39 283.87 L91.54 282.56 L91.67 281.24 L91.83 279.92 L92 278.64 L92.2 277.33 L92.41 276.01 L92.65 274.69 L92.92 273.37 L93.26 272.06 L93.68 270.74 L94.25 269.42 L94.67 268.1 L95.08 266.78 L95.6 265.47 L96.65 264.19 L98.13 262.87 L99.73 261.55 L100.79 260.24 L101.62 258.92 L102.9 257.6 L104.54 256.28 L106.09 254.97 L107.98 253.65 L108.49 252.33 L108.99 251.05 L110.23 249.74 L110.87 248.42 L111.87 247.1 L112.56 245.78 L113.8 244.46 L115.23 243.15 L118.32 241.83 L119.48 240.51 L121.53 239.2 L123.57 237.88 L124.52 236.6 L125.99 235.28 L128.26 233.96 L131.75 232.65 L135.18 231.33 L139.32 230.01 L143.89 228.6
```

---

### Incident Patch 2: `13ef307d` (2026-10-27)
**Commit Message**: chore: refresh star history

**File**: `assets/star-history-dark.svg` (modified, +10/-10)
```diff
@@ -23,17 +23,17 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#21262d" stroke-width="1"/>
   <text x="52" y="62" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">8k</text>
 
-  <path d="M62 367.96 L65.6 366.64 L67.39 365.33 L72.19 364.05 L73.9 362.73 L74.33 361.41 L74.76 360.1 L75.13 358.78 L75.48 357.46 L75.94 356.18 L76.59 354.86 L77.12 353.55 L77.78 352.23 L78.15 350.91 L78.36 349.59 L78.55 348.32 L78.74 347 L78.92 345.68 L79.1 344.36 L79.19 343.05 L79.31 341.77 L79.46 340.45 L79.6 339.13 L79.73 337.81 L79.89 336.5 L80.14 335.18 L80.26 333.9 L80.36 332.58 L80.5 331.27 L80.6 329.95 L80.72 328.63 L80.81 327.35 L80.92 326.03 L81.03 324.72 L81.15 323.4 L81.34 322.08 L81.47 320.76 L81.6 319.49 L81.77 318.17 L81.97 316.85 L82.26 315.53 L82.57 314.22 L83.06 312.9 L83.48 311.62 L83.91 310.3 L84.36 308.98 L84.69 307.67 L85.07 306.35 L85.34 305.07 L85.66 303.75 L86.44 302.44 L87.33 301.12 L87.76 299.8 L88.03 298.48 L88.48 297.2 L88.96 295.89 L89.79 294.57 L90.4 293.25 L90.62 291.93 L90.82 290.65 L90.97 289.34 L91.08 288.02 L91.18 286.7 L91.34 285.39 L91.53 284.07 L91.65 282.79 L91.8 281.47 L91.95 280.15 L92.11 278.84 L92.32 277.52 L92.52 276.2 L92.74 274.92 L93.02 273.61 L93.3 272.29 L93.75 270.97 L94.32 269.65 L94.74 268.37 L95.1 267.06 L95.61 265.74 L96.66 264.42 L98.15 263.1 L99.52 261.79 L100.63 260.51 L101.61 259.19 L102.78 257.87 L104.51 256.56 L106 255.24 L108.12 253.92 L108.53 252.64 L109.07 251.32 L110.34 250.01 L111.03 248.69 L111.86 247.37 L112.43 246.09 L113.91 244.77 L114.96 243.46 L118.47 242.14 L119.39 240.82 L121.57 239.51 L122.97 238.23 L124.56 236.91 L125.65 235.59 L128.06 234.27 L131.42 232.96 L134.87 231.68 L139.06 230.36 L142.47 229.04 L148.48 227.73 L154.34 226.41 L157.75 225.09 L158.24 223.81 L159.32 222.49 L161.76 221.18 L164.52 219.86 L168.22 218.54 L169.48 217.22 L170.64 215.95 L171.75 214.63 L173.02 213.31 L174.15 211.99 L175.14 210.68 L176.03 209.4 L179.31 208.08 L184.56 206.76 L188.64 205.44 L193.25 204.13 L198.95 202.81 L201.87 201.53 L205.8 200.21 L213.31 198.9 L218.9 197.58 L224.94 196.26 L228.33 194.98 L234.32 193.66 L243.75 192.35 L254.28 191.03 L264.56 189.71 L272.91 188.39 L279.19 187.11 L289.25 185.8 L298.94 184.48 L309.13 183.16 L317.9 181.85 L327.48 180.53 L338.22 179.25 L341.01 177.93 L347.06 176.61 L357.9 175.3 L365.07 173.98 L371.55 172.7 L384.28 171.38 L393.03 170.07 L400.46 168.75 L401.5 167.43 L403.92 166.11 L407.46 164.83 L410.84 163.52 L415.92 162.2 L423.48 160.88 L430.14 159.56 L438 158.25 L447.04 156.97 L454.45 155.65 L458 154.33 L465.11 153.01 L471.27 151.7 L478.04 150.42 L484.38 149.1 L491.68 147.78 L500.58 146.47 L503.45 145.15 L506.98 143.83 L508.67 142.55 L509.49 141.23 L510.87 139.92 L513.2 138.6 L518.49 137.28 L522.99 136 L529.39 134.69 L536.65 133.37 L545.88 132.05 L554.49 130.73 L565.53 129.42 L568.23 128.14 L569.56 126.82 L574.66 125.5 L581.17 124.19 L587.59 122.87 L593.1 121.55 L596.3 120.27 L599.76 118.95 L602.98 117.64 L608.97 116.32 L615.82 115 L622.39 113.72 L623.46 112.41 L625.2 111.09 L628.67 109.77 L631.08 108.45 L635.81 107.14 L641.85 105.86 L648.01 104.54 L659.71 103.22 L663.44 101.9 L668.7 100.59 L672.64 99.31 L678.84 97.99 L684.48 96.67 L689.12 95.36 L693.7 94.04 L701.02 92.72 L703.58 91.44 L707.31 90.12 L711.62 88.81 L715.84 87.49 L720.4 86.17 L725.57 84.85 L727.19 83.57 L730.41 82.26 L736 80.94 L736 368 L62 368 Z" fill="url(#fill-starhistorydarksvg)"/>
-  <path d="M62 367.96 L65.6 366.64 L67.39 365.33 L72.19 364.05 L73.9 362.73 L74.33 361.41 L74.76 360.1 L75.13 358.78 L75.48 357.46 L75.94 356.18 L76.59 354.86 L77.12 353.55 L77.78 352.23 L78.15 350.91 L78.36 349.59 L78.55 348.32 L78.74 347 L78.92 345.68 L79.1 344.36 L79.19 343.05 L79.31 341.77 L79.46 340.45 L79.6 339.13 L79.73 337.81 L79.89 336.5 L80.14 335.18 L80.26 333.9 L80.36 332.58 L80.5 331.27 L80.6 329.95 L80.72 328.63 L80.81 327.35 L80.92 326.03 L81.03 324.72 L81.15 323.4 L81.34 322.08 L81.47 320.76 L81.6 319.49 L81.77 318.17 L81.97 316.85 L82.26 315.53 L82.57 314.22 L83.06 312.9 L83.48 311.62 L83.91 310.3 L84.36 308.98 L84.69 307.67 L85.07 306.35 L85.34 305.07 L85.66 303.75 L86.44 302.44 L87.33 301.12 L87.76 299.8 L88.03 298.48 L88.48 297.2 L88.96 295.89 L89.79 294.57 L90.4 293.25 L90.62 291.93 L90.82 290.65 L90.97 289.34 L91.08 288.02 L91.18 286.7 L91.34 285.39 L91.53 284.07 L91.65 282.79 L91.8 281.47 L91.95 280.15 L92.11 278.84 L92.32 277.52 L92.52 276.2 L92.74 274.92 L93.02 273.61 L93.3 272.29 L93.75 270.97 L94.32 269.65 L94.74 268.37 L95.1 267.06 L95.61 265.74 L96.66 264.42 L98.15 263.1 L99.52 261.79 L100.63 260.51 L101.61 259.19 L102.78 257.87 L104.51 256.56 L106 255.24 L108.12 253.92 L108.53 252.64 L109.07 251.32 L110.34 250.01 L111.03 248.69 L111.86 247.37 L112.43 246.09 L113.91 244.77 L114.96 243.46 L118.47 242.14 L119.39 240.82 L121.57 239.51 L122.97 238.23 L124.56 236.91 L125.65 235.59 L128.06 234.27 L131.42 232.96 L134.87 231.68 L139.06 230.36 L142.47 229.04 L148.48 227.73 L154.
```

**File**: `assets/star-history.svg` (modified, +10/-10)
```diff
@@ -23,17 +23,17 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#e6eaef" stroke-width="1"/>
   <text x="52" y="62" fill="#59636e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">8k</text>
 
-  <path d="M62 367.96 L65.6 366.64 L67.39 365.33 L72.19 364.05 L73.9 362.73 L74.33 361.41 L74.76 360.1 L75.13 358.78 L75.48 357.46 L75.94 356.18 L76.59 354.86 L77.12 353.55 L77.78 352.23 L78.15 350.91 L78.36 349.59 L78.55 348.32 L78.74 347 L78.92 345.68 L79.1 344.36 L79.19 343.05 L79.31 341.77 L79.46 340.45 L79.6 339.13 L79.73 337.81 L79.89 336.5 L80.14 335.18 L80.26 333.9 L80.36 332.58 L80.5 331.27 L80.6 329.95 L80.72 328.63 L80.81 327.35 L80.92 326.03 L81.03 324.72 L81.15 323.4 L81.34 322.08 L81.47 320.76 L81.6 319.49 L81.77 318.17 L81.97 316.85 L82.26 315.53 L82.57 314.22 L83.06 312.9 L83.48 311.62 L83.91 310.3 L84.36 308.98 L84.69 307.67 L85.07 306.35 L85.34 305.07 L85.66 303.75 L86.44 302.44 L87.33 301.12 L87.76 299.8 L88.03 298.48 L88.48 297.2 L88.96 295.89 L89.79 294.57 L90.4 293.25 L90.62 291.93 L90.82 290.65 L90.97 289.34 L91.08 288.02 L91.18 286.7 L91.34 285.39 L91.53 284.07 L91.65 282.79 L91.8 281.47 L91.95 280.15 L92.11 278.84 L92.32 277.52 L92.52 276.2 L92.74 274.92 L93.02 273.61 L93.3 272.29 L93.75 270.97 L94.32 269.65 L94.74 268.37 L95.1 267.06 L95.61 265.74 L96.66 264.42 L98.15 263.1 L99.52 261.79 L100.63 260.51 L101.61 259.19 L102.78 257.87 L104.51 256.56 L106 255.24 L108.12 253.92 L108.53 252.64 L109.07 251.32 L110.34 250.01 L111.03 248.69 L111.86 247.37 L112.43 246.09 L113.91 244.77 L114.96 243.46 L118.47 242.14 L119.39 240.82 L121.57 239.51 L122.97 238.23 L124.56 236.91 L125.65 235.59 L128.06 234.27 L131.42 232.96 L134.87 231.68 L139.06 230.36 L142.47 229.04 L148.48 227.73 L154.34 226.41 L157.75 225.09 L158.24 223.81 L159.32 222.49 L161.76 221.18 L164.52 219.86 L168.22 218.54 L169.48 217.22 L170.64 215.95 L171.75 214.63 L173.02 213.31 L174.15 211.99 L175.14 210.68 L176.03 209.4 L179.31 208.08 L184.56 206.76 L188.64 205.44 L193.25 204.13 L198.95 202.81 L201.87 201.53 L205.8 200.21 L213.31 198.9 L218.9 197.58 L224.94 196.26 L228.33 194.98 L234.32 193.66 L243.75 192.35 L254.28 191.03 L264.56 189.71 L272.91 188.39 L279.19 187.11 L289.25 185.8 L298.94 184.48 L309.13 183.16 L317.9 181.85 L327.48 180.53 L338.22 179.25 L341.01 177.93 L347.06 176.61 L357.9 175.3 L365.07 173.98 L371.55 172.7 L384.28 171.38 L393.03 170.07 L400.46 168.75 L401.5 167.43 L403.92 166.11 L407.46 164.83 L410.84 163.52 L415.92 162.2 L423.48 160.88 L430.14 159.56 L438 158.25 L447.04 156.97 L454.45 155.65 L458 154.33 L465.11 153.01 L471.27 151.7 L478.04 150.42 L484.38 149.1 L491.68 147.78 L500.58 146.47 L503.45 145.15 L506.98 143.83 L508.67 142.55 L509.49 141.23 L510.87 139.92 L513.2 138.6 L518.49 137.28 L522.99 136 L529.39 134.69 L536.65 133.37 L545.88 132.05 L554.49 130.73 L565.53 129.42 L568.23 128.14 L569.56 126.82 L574.66 125.5 L581.17 124.19 L587.59 122.87 L593.1 121.55 L596.3 120.27 L599.76 118.95 L602.98 117.64 L608.97 116.32 L615.82 115 L622.39 113.72 L623.46 112.41 L625.2 111.09 L628.67 109.77 L631.08 108.45 L635.81 107.14 L641.85 105.86 L648.01 104.54 L659.71 103.22 L663.44 101.9 L668.7 100.59 L672.64 99.31 L678.84 97.99 L684.48 96.67 L689.12 95.36 L693.7 94.04 L701.02 92.72 L703.58 91.44 L707.31 90.12 L711.62 88.81 L715.84 87.49 L720.4 86.17 L725.57 84.85 L727.19 83.57 L730.41 82.26 L736 80.94 L736 368 L62 368 Z" fill="url(#fill-starhistorysvg)"/>
-  <path d="M62 367.96 L65.6 366.64 L67.39 365.33 L72.19 364.05 L73.9 362.73 L74.33 361.41 L74.76 360.1 L75.13 358.78 L75.48 357.46 L75.94 356.18 L76.59 354.86 L77.12 353.55 L77.78 352.23 L78.15 350.91 L78.36 349.59 L78.55 348.32 L78.74 347 L78.92 345.68 L79.1 344.36 L79.19 343.05 L79.31 341.77 L79.46 340.45 L79.6 339.13 L79.73 337.81 L79.89 336.5 L80.14 335.18 L80.26 333.9 L80.36 332.58 L80.5 331.27 L80.6 329.95 L80.72 328.63 L80.81 327.35 L80.92 326.03 L81.03 324.72 L81.15 323.4 L81.34 322.08 L81.47 320.76 L81.6 319.49 L81.77 318.17 L81.97 316.85 L82.26 315.53 L82.57 314.22 L83.06 312.9 L83.48 311.62 L83.91 310.3 L84.36 308.98 L84.69 307.67 L85.07 306.35 L85.34 305.07 L85.66 303.75 L86.44 302.44 L87.33 301.12 L87.76 299.8 L88.03 298.48 L88.48 297.2 L88.96 295.89 L89.79 294.57 L90.4 293.25 L90.62 291.93 L90.82 290.65 L90.97 289.34 L91.08 288.02 L91.18 286.7 L91.34 285.39 L91.53 284.07 L91.65 282.79 L91.8 281.47 L91.95 280.15 L92.11 278.84 L92.32 277.52 L92.52 276.2 L92.74 274.92 L93.02 273.61 L93.3 272.29 L93.75 270.97 L94.32 269.65 L94.74 268.37 L95.1 267.06 L95.61 265.74 L96.66 264.42 L98.15 263.1 L99.52 261.79 L100.63 260.51 L101.61 259.19 L102.78 257.87 L104.51 256.56 L106 255.24 L108.12 253.92 L108.53 252.64 L109.07 251.32 L110.34 250.01 L111.03 248.69 L111.86 247.37 L112.43 246.09 L113.91 244.77 L114.96 243.46 L118.47 242.14 L119.39 240.82 L121.57 239.51 L122.97 238.23 L124.56 236.91 L125.65 235.59 L128.06 234.27 L131.42 232.96 L134.87 231.68 L139.06 230.36 L142.47 229.04 L148.48 227.73 L154.34 2
```

#### Recent Merged Pull Requests:
- **PR #185** (2026-10-08): cli: land the dev download caches from #164 and the Hugging Face entry from #165 (@momenbasel)
- **PR #184** (2026-10-08): 3.1.0: land the reviewed localization, Settings and cleanup PRs (@momenbasel)
- **PR #183** (2026-10-08): fix(protection): treat firewall block-all mode (State = 2) as enabled (@momenbasel)
- **PR #182** (2026-10-08): fix(brew): use postflight_steps so the cask stops warning on upgrade (@momenbasel)
- **PR #181** (closed): Improve Simplified Chinese localization: complete fallbacks, add runtime-resolved strings, align terminology (@BruceQin520)
- **PR #180** (2026-10-08): Improve Simplified Chinese localization across cleanup and maintenance tools (@0x00kh)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
