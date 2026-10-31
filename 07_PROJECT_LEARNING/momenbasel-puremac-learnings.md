> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/momenbasel-puremac-learnings.md`  
> **Source**: github ([https://github.com/momenbasel/PureMac](https://github.com/momenbasel/PureMac))  
> **Source Version**: `8872099c`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T20:11:51.807Z  
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
> **Harvest Timestamp**: 2026-10-31T20:11:51.800Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `momenbasel/PureMac`
- **Description**: Free, open-source macOS cleaner. CleanMyMac alternative with zero telemetry. Native SwiftUI, scheduled auto-cleaning, Xcode/Homebrew/system cache cleanup. MIT licensed.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7546 stars

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

### Incident Patch 1: `8872099c` (2026-10-31)
**Commit Message**: chore: refresh star history

**File**: `assets/star-history-dark.svg` (modified, +10/-10)
```diff
@@ -23,17 +23,17 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#21262d" stroke-width="1"/>
   <text x="52" y="62" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">8k</text>
 
-  <path d="M62 367.96 L65.53 366.64 L67.29 365.29 L73.07 363.97 L73.68 362.65 L74.11 361.34 L74.53 359.98 L74.9 358.66 L75.24 357.34 L75.77 356.03 L76.48 354.67 L76.88 353.35 L77.63 352.04 L77.88 350.68 L78.07 349.36 L78.28 348.04 L78.46 346.73 L78.64 345.37 L78.78 344.05 L78.89 342.74 L79 341.42 L79.15 340.06 L79.28 338.74 L79.41 337.43 L79.62 336.11 L79.81 334.75 L79.94 333.44 L80.05 332.12 L80.18 330.76 L80.29 329.44 L80.4 328.13 L80.48 326.81 L80.58 325.45 L80.72 324.14 L80.86 322.82 L81.02 321.5 L81.14 320.14 L81.3 318.83 L81.47 317.51 L81.71 316.15 L82.02 314.83 L82.39 313.52 L82.87 312.2 L83.32 310.84 L83.77 309.53 L84.11 308.21 L84.4 306.89 L84.75 305.53 L85.06 304.22 L85.57 302.9 L86.61 301.58 L87.22 300.23 L87.44 298.91 L87.75 297.59 L88.34 296.24 L89 294.92 L89.74 293.6 L90.01 292.28 L90.23 290.93 L90.38 289.61 L90.49 288.29 L90.59 286.97 L90.73 285.62 L90.9 284.3 L91.04 282.98 L91.19 281.63 L91.33 280.31 L91.52 278.99 L91.69 277.67 L91.9 276.32 L92.13 275 L92.41 273.68 L92.65 272.37 L93.12 271.01 L93.63 269.69 L94.09 268.37 L94.45 267.06 L94.96 265.7 L96 264.38 L97.47 263.07 L98.91 261.71 L100.01 260.39 L101 259.07 L102.1 257.76 L103.82 256.4 L105.41 255.08 L107.25 253.77 L107.78 252.45 L108.29 251.09 L109.51 249.77 L110.14 248.46 L111.13 247.1 L111.84 245.78 L113.03 244.46 L114.6 243.15 L117.52 241.79 L118.78 240.47 L120.67 239.16 L122.7 237.84 L123.66 236.48 L125.67 235.17 L127.79 233.85 L131.24 232.53 L134.61 231.17 L138.62 229.86 L143.16 228.54 L149.99 227.18 L153.74 225.86 L155.95 224.55 L156.73 223.23 L159.17 221.87 L160.68 220.56 L163.87 219.24 L167.03 217.92 L167.92 216.57 L169.06 215.25 L170.11 213.93 L171.54 212.57 L172.63 211.26 L173.46 209.94 L174.68 208.62 L180.56 207.27 L184.39 205.95 L189.39 204.63 L195.21 203.31 L198.43 201.96 L201.9 200.64 L209.34 199.32 L213.81 198 L221.02 196.65 L223.5 195.33 L229.3 194.01 L238.82 192.66 L248.27 191.34 L259.37 190.02 L267.76 188.7 L273.64 187.35 L284.06 186.03 L293.39 184.71 L302.81 183.4 L312.14 182.04 L321.91 180.72 L331.85 179.4 L335.52 178.05 L341.47 176.73 L352.04 175.41 L359.12 174.1 L365.84 172.74 L378.01 171.42 L386.79 170.1 L393.85 168.79 L395.05 167.43 L397.37 166.11 L400.88 164.8 L404.13 163.48 L410.4 162.12 L417.91 160.8 L423.19 159.49 L432.29 158.13 L441.16 156.81 L446.86 155.5 L450.85 154.18 L458.92 152.82 L464.26 151.5 L470.96 150.19 L477.14 148.87 L485.53 147.51 L492.89 146.2 L495.77 144.88 L499.24 143.52 L500.2 142.2 L500.98 140.89 L502.38 139.57 L506.42 138.21 L511.05 136.89 L516.24 135.58 L522.96 134.26 L529.9 132.9 L539.13 131.59 L547.88 130.27 L556.73 128.95 L558.61 127.6 L562.28 126.28 L567.19 124.96 L575.35 123.6 L579.82 122.29 L584.56 120.97 L587.8 119.65 L591.03 118.3 L595.29 116.98 L601.44 115.66 L606.98 114.34 L612.16 112.99 L613.64 111.67 L616.13 110.35 L618.86 109 L622.08 107.68 L629.14 106.36 L634.56 105.04 L643.24 103.69 L650.14 102.37 L655.03 101.05 L659.99 99.73 L665.06 98.38 L670.49 97.06 L675.83 95.74 L680.31 94.43 L687.87 93.07 L690.78 91.75 L694.5 90.43 L698.45 89.08 L702.85 87.76 L707.09 86.44 L712.27 85.13 L714.11 83.77 L717.11 82.45 L722.64 81.13 L728.25 79.82 L733.84 78.46 L736 77.14 L736 368 L62 368 Z" fill="url(#fill-starhistorydarksvg)"/>
-  <path d="M62 367.96 L65.53 366.64 L67.29 365.29 L73.07 363.97 L73.68 362.65 L74.11 361.34 L74.53 359.98 L74.9 358.66 L75.24 357.34 L75.77 356.03 L76.48 354.67 L76.88 353.35 L77.63 352.04 L77.88 350.68 L78.07 349.36 L78.28 348.04 L78.46 346.73 L78.64 345.37 L78.78 344.05 L78.89 342.74 L79 341.42 L79.15 340.06 L79.28 338.74 L79.41 337.43 L79.62 336.11 L79.81 334.75 L79.94 333.44 L80.05 332.12 L80.18 330.76 L80.29 329.44 L80.4 328.13 L80.48 326.81 L80.58 325.45 L80.72 324.14 L80.86 322.82 L81.02 321.5 L81.14 320.14 L81.3 318.83 L81.47 317.51 L81.71 316.15 L82.02 314.83 L82.39 313.52 L82.87 312.2 L83.32 310.84 L83.77 309.53 L84.11 308.21 L84.4 306.89 L84.75 305.53 L85.06 304.22 L85.57 302.9 L86.61 301.58 L87.22 300.23 L87.44 298.91 L87.75 297.59 L88.34 296.24 L89 294.92 L89.74 293.6 L90.01 292.28 L90.23 290.93 L90.38 289.61 L90.49 288.29 L90.59 286.97 L90.73 285.62 L90.9 284.3 L91.04 282.98 L91.19 281.63 L91.33 280.31 L91.52 278.99 L91.69 277.67 L91.9 276.32 L92.13 275 L92.41 273.68 L92.65 272.37 L93.12 271.01 L93.63 269.69 L94.09 268.37 L94.45 267.06 L94.96 265.7 L96 264.38 L97.47 263.07 L98.91 261.71 L100.01 260.39 L101 259.07 L102.1 257.76 L103.82 256.4 L105.41 255.08 L107.25 253.77 L107.78 252.45 L108.29 251.09 L109.51 249.77 L110.14 248.46 L111.13 247.1 L111.84 245.78 L113.03 244.46 L114.6 243.15 L117.52 241.79 L118.78 240.47 L120.67 239.16 L122.7 237.84 L123.66 236.48 L125.67 235.17 L127.79 233.85 L131.24 232.53 L134.61 231.17 L138.62 229.86 L143.16 228.54 L149.99 227.18 L153.74 225.86 L155.95 
```

**File**: `assets/star-history.svg` (modified, +10/-10)
```diff
@@ -23,17 +23,17 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#e6eaef" stroke-width="1"/>
   <text x="52" y="62" fill="#59636e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">8k</text>
 
-  <path d="M62 367.96 L65.53 366.64 L67.29 365.29 L73.07 363.97 L73.68 362.65 L74.11 361.34 L74.53 359.98 L74.9 358.66 L75.24 357.34 L75.77 356.03 L76.48 354.67 L76.88 353.35 L77.63 352.04 L77.88 350.68 L78.07 349.36 L78.28 348.04 L78.46 346.73 L78.64 345.37 L78.78 344.05 L78.89 342.74 L79 341.42 L79.15 340.06 L79.28 338.74 L79.41 337.43 L79.62 336.11 L79.81 334.75 L79.94 333.44 L80.05 332.12 L80.18 330.76 L80.29 329.44 L80.4 328.13 L80.48 326.81 L80.58 325.45 L80.72 324.14 L80.86 322.82 L81.02 321.5 L81.14 320.14 L81.3 318.83 L81.47 317.51 L81.71 316.15 L82.02 314.83 L82.39 313.52 L82.87 312.2 L83.32 310.84 L83.77 309.53 L84.11 308.21 L84.4 306.89 L84.75 305.53 L85.06 304.22 L85.57 302.9 L86.61 301.58 L87.22 300.23 L87.44 298.91 L87.75 297.59 L88.34 296.24 L89 294.92 L89.74 293.6 L90.01 292.28 L90.23 290.93 L90.38 289.61 L90.49 288.29 L90.59 286.97 L90.73 285.62 L90.9 284.3 L91.04 282.98 L91.19 281.63 L91.33 280.31 L91.52 278.99 L91.69 277.67 L91.9 276.32 L92.13 275 L92.41 273.68 L92.65 272.37 L93.12 271.01 L93.63 269.69 L94.09 268.37 L94.45 267.06 L94.96 265.7 L96 264.38 L97.47 263.07 L98.91 261.71 L100.01 260.39 L101 259.07 L102.1 257.76 L103.82 256.4 L105.41 255.08 L107.25 253.77 L107.78 252.45 L108.29 251.09 L109.51 249.77 L110.14 248.46 L111.13 247.1 L111.84 245.78 L113.03 244.46 L114.6 243.15 L117.52 241.79 L118.78 240.47 L120.67 239.16 L122.7 237.84 L123.66 236.48 L125.67 235.17 L127.79 233.85 L131.24 232.53 L134.61 231.17 L138.62 229.86 L143.16 228.54 L149.99 227.18 L153.74 225.86 L155.95 224.55 L156.73 223.23 L159.17 221.87 L160.68 220.56 L163.87 219.24 L167.03 217.92 L167.92 216.57 L169.06 215.25 L170.11 213.93 L171.54 212.57 L172.63 211.26 L173.46 209.94 L174.68 208.62 L180.56 207.27 L184.39 205.95 L189.39 204.63 L195.21 203.31 L198.43 201.96 L201.9 200.64 L209.34 199.32 L213.81 198 L221.02 196.65 L223.5 195.33 L229.3 194.01 L238.82 192.66 L248.27 191.34 L259.37 190.02 L267.76 188.7 L273.64 187.35 L284.06 186.03 L293.39 184.71 L302.81 183.4 L312.14 182.04 L321.91 180.72 L331.85 179.4 L335.52 178.05 L341.47 176.73 L352.04 175.41 L359.12 174.1 L365.84 172.74 L378.01 171.42 L386.79 170.1 L393.85 168.79 L395.05 167.43 L397.37 166.11 L400.88 164.8 L404.13 163.48 L410.4 162.12 L417.91 160.8 L423.19 159.49 L432.29 158.13 L441.16 156.81 L446.86 155.5 L450.85 154.18 L458.92 152.82 L464.26 151.5 L470.96 150.19 L477.14 148.87 L485.53 147.51 L492.89 146.2 L495.77 144.88 L499.24 143.52 L500.2 142.2 L500.98 140.89 L502.38 139.57 L506.42 138.21 L511.05 136.89 L516.24 135.58 L522.96 134.26 L529.9 132.9 L539.13 131.59 L547.88 130.27 L556.73 128.95 L558.61 127.6 L562.28 126.28 L567.19 124.96 L575.35 123.6 L579.82 122.29 L584.56 120.97 L587.8 119.65 L591.03 118.3 L595.29 116.98 L601.44 115.66 L606.98 114.34 L612.16 112.99 L613.64 111.67 L616.13 110.35 L618.86 109 L622.08 107.68 L629.14 106.36 L634.56 105.04 L643.24 103.69 L650.14 102.37 L655.03 101.05 L659.99 99.73 L665.06 98.38 L670.49 97.06 L675.83 95.74 L680.31 94.43 L687.87 93.07 L690.78 91.75 L694.5 90.43 L698.45 89.08 L702.85 87.76 L707.09 86.44 L712.27 85.13 L714.11 83.77 L717.11 82.45 L722.64 81.13 L728.25 79.82 L733.84 78.46 L736 77.14 L736 368 L62 368 Z" fill="url(#fill-starhistorysvg)"/>
-  <path d="M62 367.96 L65.53 366.64 L67.29 365.29 L73.07 363.97 L73.68 362.65 L74.11 361.34 L74.53 359.98 L74.9 358.66 L75.24 357.34 L75.77 356.03 L76.48 354.67 L76.88 353.35 L77.63 352.04 L77.88 350.68 L78.07 349.36 L78.28 348.04 L78.46 346.73 L78.64 345.37 L78.78 344.05 L78.89 342.74 L79 341.42 L79.15 340.06 L79.28 338.74 L79.41 337.43 L79.62 336.11 L79.81 334.75 L79.94 333.44 L80.05 332.12 L80.18 330.76 L80.29 329.44 L80.4 328.13 L80.48 326.81 L80.58 325.45 L80.72 324.14 L80.86 322.82 L81.02 321.5 L81.14 320.14 L81.3 318.83 L81.47 317.51 L81.71 316.15 L82.02 314.83 L82.39 313.52 L82.87 312.2 L83.32 310.84 L83.77 309.53 L84.11 308.21 L84.4 306.89 L84.75 305.53 L85.06 304.22 L85.57 302.9 L86.61 301.58 L87.22 300.23 L87.44 298.91 L87.75 297.59 L88.34 296.24 L89 294.92 L89.74 293.6 L90.01 292.28 L90.23 290.93 L90.38 289.61 L90.49 288.29 L90.59 286.97 L90.73 285.62 L90.9 284.3 L91.04 282.98 L91.19 281.63 L91.33 280.31 L91.52 278.99 L91.69 277.67 L91.9 276.32 L92.13 275 L92.41 273.68 L92.65 272.37 L93.12 271.01 L93.63 269.69 L94.09 268.37 L94.45 267.06 L94.96 265.7 L96 264.38 L97.47 263.07 L98.91 261.71 L100.01 260.39 L101 259.07 L102.1 257.76 L103.82 256.4 L105.41 255.08 L107.25 253.77 L107.78 252.45 L108.29 251.09 L109.51 249.77 L110.14 248.46 L111.13 247.1 L111.84 245.78 L113.03 244.46 L114.6 243.15 L117.52 241.79 L118.78 240.47 L120.67 239.16 L122.7 237.84 L123.66 236.48 L125.67 235.17 L127.79 233.85 L131.24 232.53 L134.61 231.17 L138.62 229.86 L143.16 228.54 L149.99 227.18 L153.74 225.86 L155.95 224.
```

---

### Incident Patch 2: `b66e705d` (2026-10-30)
**Commit Message**: chore: refresh star history

**File**: `assets/star-history-dark.svg` (modified, +10/-10)
```diff
@@ -23,17 +23,17 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#21262d" stroke-width="1"/>
   <text x="52" y="62" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">8k</text>
 
-  <path d="M62 367.96 L65.55 366.64 L67.32 365.33 L72.38 364.01 L73.74 362.69 L74.16 361.37 L74.58 360.06 L74.94 358.74 L75.29 357.42 L75.78 356.1 L76.53 354.75 L76.94 353.43 L77.67 352.11 L77.94 350.8 L78.16 349.48 L78.32 348.16 L78.53 346.84 L78.69 345.53 L78.86 344.21 L78.97 342.89 L79.07 341.57 L79.22 340.26 L79.36 338.94 L79.48 337.62 L79.66 336.3 L79.89 334.99 L80.01 333.67 L80.12 332.35 L80.25 330.99 L80.35 329.68 L80.47 328.36 L80.57 327.04 L80.66 325.72 L80.78 324.41 L80.91 323.09 L81.08 321.77 L81.21 320.45 L81.34 319.14 L81.52 317.82 L81.73 316.5 L82.06 315.18 L82.38 313.87 L82.91 312.55 L83.26 311.23 L83.77 309.91 L84.12 308.6 L84.46 307.24 L84.83 305.92 L85.1 304.61 L85.44 303.29 L86.47 301.97 L87.16 300.65 L87.46 299.33 L87.8 298.02 L88.3 296.7 L88.83 295.38 L89.7 294.07 L90.09 292.75 L90.28 291.43 L90.48 290.11 L90.6 288.8 L90.71 287.48 L90.81 286.16 L90.99 284.84 L91.15 283.49 L91.28 282.17 L91.4 280.85 L91.56 279.53 L91.77 278.22 L91.95 276.9 L92.16 275.58 L92.44 274.26 L92.7 272.95 L93.09 271.63 L93.55 270.31 L94.05 268.99 L94.45 267.68 L94.93 266.36 L95.51 265.04 L96.88 263.72 L98.18 262.41 L99.68 261.09 L100.6 259.77 L101.66 258.42 L103.51 257.1 L104.99 255.78 L106.87 254.46 L107.64 253.15 L108.21 251.83 L109.08 250.51 L110.09 249.19 L110.78 247.88 L111.59 246.56 L112.61 245.24 L113.85 243.92 L116.39 242.61 L118.16 241.29 L119.89 239.97 L121.55 238.65 L123.28 237.34 L124.24 236.02 L126.82 234.66 L130.01 233.34 L133.23 232.03 L137.34 230.71 L140.39 229.39 L144.66 228.07 L151.73 226.76 L155.74 225.44 L156.73 224.12 L157.64 222.8 L160.12 221.49 L162.8 220.17 L166.22 218.85 L167.78 217.53 L168.86 216.22 L169.88 214.9 L170.96 213.58 L172.32 212.26 L173.35 210.91 L174.27 209.59 L176.81 208.27 L181.92 206.96 L186.09 205.64 L190.78 204.32 L196.52 203 L199.78 201.69 L203.51 200.37 L210.98 199.05 L216.17 197.73 L222.27 196.42 L225.42 195.1 L231.35 193.78 L240.88 192.46 L251.05 191.15 L261.57 189.83 L269.81 188.51 L276.15 187.15 L286.02 185.84 L295.75 184.52 L305.61 183.2 L314.33 181.88 L323.78 180.57 L335.2 179.25 L337.12 177.93 L343.63 176.61 L353.7 175.3 L361.23 173.98 L368.85 172.66 L380.45 171.34 L388.87 170.03 L395.63 168.71 L396.78 167.39 L399.41 166.07 L402.75 164.76 L406.2 163.44 L412.34 162.08 L420.34 160.77 L425.22 159.45 L434.21 158.13 L443.12 156.81 L448.86 155.5 L452.86 154.18 L460.73 152.86 L465.88 151.54 L473.08 150.23 L479.26 148.91 L487.39 147.59 L495.07 146.27 L497.94 144.95 L501.23 143.64 L502.41 142.32 L503.15 141 L504.5 139.68 L507.99 138.33 L512.5 137.01 L518.1 135.69 L524.63 134.38 L531.57 133.06 L541.29 131.74 L549.38 130.42 L559.15 129.11 L561.13 127.79 L563.68 126.47 L568.63 125.15 L576.89 123.84 L581.59 122.52 L586.55 121.2 L590.26 119.88 L593.11 118.57 L597.25 117.25 L602.72 115.93 L608.92 114.57 L614.94 113.26 L615.82 111.94 L618.62 110.62 L621.19 109.31 L624.06 107.99 L630.83 106.67 L636.81 105.35 L643.26 104.03 L651.64 102.72 L656.63 101.4 L661.24 100.08 L666.18 98.76 L671.33 97.45 L677.49 96.13 L682.12 94.81 L688.33 93.5 L693.28 92.18 L696.53 90.82 L700.65 89.5 L704.59 88.19 L709.53 86.87 L713.34 85.55 L717.19 84.23 L719.06 82.92 L723.83 81.6 L729.83 80.28 L736 78.96 L736 368 L62 368 Z" fill="url(#fill-starhistorydarksvg)"/>
-  <path d="M62 367.96 L65.55 366.64 L67.32 365.33 L72.38 364.01 L73.74 362.69 L74.16 361.37 L74.58 360.06 L74.94 358.74 L75.29 357.42 L75.78 356.1 L76.53 354.75 L76.94 353.43 L77.67 352.11 L77.94 350.8 L78.16 349.48 L78.32 348.16 L78.53 346.84 L78.69 345.53 L78.86 344.21 L78.97 342.89 L79.07 341.57 L79.22 340.26 L79.36 338.94 L79.48 337.62 L79.66 336.3 L79.89 334.99 L80.01 333.67 L80.12 332.35 L80.25 330.99 L80.35 329.68 L80.47 328.36 L80.57 327.04 L80.66 325.72 L80.78 324.41 L80.91 323.09 L81.08 321.77 L81.21 320.45 L81.34 319.14 L81.52 317.82 L81.73 316.5 L82.06 315.18 L82.38 313.87 L82.91 312.55 L83.26 311.23 L83.77 309.91 L84.12 308.6 L84.46 307.24 L84.83 305.92 L85.1 304.61 L85.44 303.29 L86.47 301.97 L87.16 300.65 L87.46 299.33 L87.8 298.02 L88.3 296.7 L88.83 295.38 L89.7 294.07 L90.09 292.75 L90.28 291.43 L90.48 290.11 L90.6 288.8 L90.71 287.48 L90.81 286.16 L90.99 284.84 L91.15 283.49 L91.28 282.17 L91.4 280.85 L91.56 279.53 L91.77 278.22 L91.95 276.9 L92.16 275.58 L92.44 274.26 L92.7 272.95 L93.09 271.63 L93.55 270.31 L94.05 268.99 L94.45 267.68 L94.93 266.36 L95.51 265.04 L96.88 263.72 L98.18 262.41 L99.68 261.09 L100.6 259.77 L101.66 258.42 L103.51 257.1 L104.99 255.78 L106.87 254.46 L107.64 253.15 L108.21 251.83 L109.08 250.51 L110.09 249.19 L110.78 247.88 L111.59 246.56 L112.61 245.24 L113.85 243.92 L116.39 242.61 L118.16 241.29 L119.89 239.97 L121.55 238.65 L123.28 237.34 L124.24 236.02 L126.82 234.66 L130.01 233.34 L133.23 232.03 L137.34 230.71 L140.39 229.39 L14
```

**File**: `assets/star-history.svg` (modified, +10/-10)
```diff
@@ -23,17 +23,17 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#e6eaef" stroke-width="1"/>
   <text x="52" y="62" fill="#59636e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">8k</text>
 
-  <path d="M62 367.96 L65.55 366.64 L67.32 365.33 L72.38 364.01 L73.74 362.69 L74.16 361.37 L74.58 360.06 L74.94 358.74 L75.29 357.42 L75.78 356.1 L76.53 354.75 L76.94 353.43 L77.67 352.11 L77.94 350.8 L78.16 349.48 L78.32 348.16 L78.53 346.84 L78.69 345.53 L78.86 344.21 L78.97 342.89 L79.07 341.57 L79.22 340.26 L79.36 338.94 L79.48 337.62 L79.66 336.3 L79.89 334.99 L80.01 333.67 L80.12 332.35 L80.25 330.99 L80.35 329.68 L80.47 328.36 L80.57 327.04 L80.66 325.72 L80.78 324.41 L80.91 323.09 L81.08 321.77 L81.21 320.45 L81.34 319.14 L81.52 317.82 L81.73 316.5 L82.06 315.18 L82.38 313.87 L82.91 312.55 L83.26 311.23 L83.77 309.91 L84.12 308.6 L84.46 307.24 L84.83 305.92 L85.1 304.61 L85.44 303.29 L86.47 301.97 L87.16 300.65 L87.46 299.33 L87.8 298.02 L88.3 296.7 L88.83 295.38 L89.7 294.07 L90.09 292.75 L90.28 291.43 L90.48 290.11 L90.6 288.8 L90.71 287.48 L90.81 286.16 L90.99 284.84 L91.15 283.49 L91.28 282.17 L91.4 280.85 L91.56 279.53 L91.77 278.22 L91.95 276.9 L92.16 275.58 L92.44 274.26 L92.7 272.95 L93.09 271.63 L93.55 270.31 L94.05 268.99 L94.45 267.68 L94.93 266.36 L95.51 265.04 L96.88 263.72 L98.18 262.41 L99.68 261.09 L100.6 259.77 L101.66 258.42 L103.51 257.1 L104.99 255.78 L106.87 254.46 L107.64 253.15 L108.21 251.83 L109.08 250.51 L110.09 249.19 L110.78 247.88 L111.59 246.56 L112.61 245.24 L113.85 243.92 L116.39 242.61 L118.16 241.29 L119.89 239.97 L121.55 238.65 L123.28 237.34 L124.24 236.02 L126.82 234.66 L130.01 233.34 L133.23 232.03 L137.34 230.71 L140.39 229.39 L144.66 228.07 L151.73 226.76 L155.74 225.44 L156.73 224.12 L157.64 222.8 L160.12 221.49 L162.8 220.17 L166.22 218.85 L167.78 217.53 L168.86 216.22 L169.88 214.9 L170.96 213.58 L172.32 212.26 L173.35 210.91 L174.27 209.59 L176.81 208.27 L181.92 206.96 L186.09 205.64 L190.78 204.32 L196.52 203 L199.78 201.69 L203.51 200.37 L210.98 199.05 L216.17 197.73 L222.27 196.42 L225.42 195.1 L231.35 193.78 L240.88 192.46 L251.05 191.15 L261.57 189.83 L269.81 188.51 L276.15 187.15 L286.02 185.84 L295.75 184.52 L305.61 183.2 L314.33 181.88 L323.78 180.57 L335.2 179.25 L337.12 177.93 L343.63 176.61 L353.7 175.3 L361.23 173.98 L368.85 172.66 L380.45 171.34 L388.87 170.03 L395.63 168.71 L396.78 167.39 L399.41 166.07 L402.75 164.76 L406.2 163.44 L412.34 162.08 L420.34 160.77 L425.22 159.45 L434.21 158.13 L443.12 156.81 L448.86 155.5 L452.86 154.18 L460.73 152.86 L465.88 151.54 L473.08 150.23 L479.26 148.91 L487.39 147.59 L495.07 146.27 L497.94 144.95 L501.23 143.64 L502.41 142.32 L503.15 141 L504.5 139.68 L507.99 138.33 L512.5 137.01 L518.1 135.69 L524.63 134.38 L531.57 133.06 L541.29 131.74 L549.38 130.42 L559.15 129.11 L561.13 127.79 L563.68 126.47 L568.63 125.15 L576.89 123.84 L581.59 122.52 L586.55 121.2 L590.26 119.88 L593.11 118.57 L597.25 117.25 L602.72 115.93 L608.92 114.57 L614.94 113.26 L615.82 111.94 L618.62 110.62 L621.19 109.31 L624.06 107.99 L630.83 106.67 L636.81 105.35 L643.26 104.03 L651.64 102.72 L656.63 101.4 L661.24 100.08 L666.18 98.76 L671.33 97.45 L677.49 96.13 L682.12 94.81 L688.33 93.5 L693.28 92.18 L696.53 90.82 L700.65 89.5 L704.59 88.19 L709.53 86.87 L713.34 85.55 L717.19 84.23 L719.06 82.92 L723.83 81.6 L729.83 80.28 L736 78.96 L736 368 L62 368 Z" fill="url(#fill-starhistorysvg)"/>
-  <path d="M62 367.96 L65.55 366.64 L67.32 365.33 L72.38 364.01 L73.74 362.69 L74.16 361.37 L74.58 360.06 L74.94 358.74 L75.29 357.42 L75.78 356.1 L76.53 354.75 L76.94 353.43 L77.67 352.11 L77.94 350.8 L78.16 349.48 L78.32 348.16 L78.53 346.84 L78.69 345.53 L78.86 344.21 L78.97 342.89 L79.07 341.57 L79.22 340.26 L79.36 338.94 L79.48 337.62 L79.66 336.3 L79.89 334.99 L80.01 333.67 L80.12 332.35 L80.25 330.99 L80.35 329.68 L80.47 328.36 L80.57 327.04 L80.66 325.72 L80.78 324.41 L80.91 323.09 L81.08 321.77 L81.21 320.45 L81.34 319.14 L81.52 317.82 L81.73 316.5 L82.06 315.18 L82.38 313.87 L82.91 312.55 L83.26 311.23 L83.77 309.91 L84.12 308.6 L84.46 307.24 L84.83 305.92 L85.1 304.61 L85.44 303.29 L86.47 301.97 L87.16 300.65 L87.46 299.33 L87.8 298.02 L88.3 296.7 L88.83 295.38 L89.7 294.07 L90.09 292.75 L90.28 291.43 L90.48 290.11 L90.6 288.8 L90.71 287.48 L90.81 286.16 L90.99 284.84 L91.15 283.49 L91.28 282.17 L91.4 280.85 L91.56 279.53 L91.77 278.22 L91.95 276.9 L92.16 275.58 L92.44 274.26 L92.7 272.95 L93.09 271.63 L93.55 270.31 L94.05 268.99 L94.45 267.68 L94.93 266.36 L95.51 265.04 L96.88 263.72 L98.18 262.41 L99.68 261.09 L100.6 259.77 L101.66 258.42 L103.51 257.1 L104.99 255.78 L106.87 254.46 L107.64 253.15 L108.21 251.83 L109.08 250.51 L110.09 249.19 L110.78 247.88 L111.59 246.56 L112.61 245.24 L113.85 243.92 L116.39 242.61 L118.16 241.29 L119.89 239.97 L121.55 238.65 L123.28 237.34 L124.24 236.02 L126.82 234.66 L130.01 233.34 L133.23 232.03 L137.34 230.71 L140.39 229.39 L144.66
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
