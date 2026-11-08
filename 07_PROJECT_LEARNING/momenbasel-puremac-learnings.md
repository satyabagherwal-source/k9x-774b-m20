> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/momenbasel-puremac-learnings.md`  
> **Source**: github ([https://github.com/momenbasel/PureMac](https://github.com/momenbasel/PureMac))  
> **Source Version**: `14da8d0e`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-08T03:35:46.243Z  
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
> **Harvest Timestamp**: 2026-11-08T03:35:45.915Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `momenbasel/PureMac`
- **Description**: Free, open-source macOS cleaner. CleanMyMac alternative with zero telemetry. Native SwiftUI, scheduled auto-cleaning, Xcode/Homebrew/system cache cleanup. MIT licensed.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7686 stars

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

### Incident Patch 1: `14da8d0e` (2026-11-07)
**Commit Message**: chore: refresh star history

**File**: `assets/star-history-dark.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#21262d" stroke-width="1"/>
   <text x="52" y="62" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.53 366.88 L67.12 365.8 L73.13 364.71 L73.34 363.63 L73.74 362.54 L74.2 361.46 L74.51 360.37 L74.83 359.29 L75.45 358.2 L76.12 357.12 L76.48 356.07 L77.21 354.98 L77.39 353.9 L77.62 352.81 L77.81 351.73 L77.98 350.64 L78.16 349.56 L78.27 348.47 L78.38 347.39 L78.52 346.3 L78.64 345.22 L78.77 344.13 L78.93 343.05 L79.14 341.96 L79.31 340.88 L79.4 339.79 L79.54 338.71 L79.64 337.62 L79.75 336.54 L79.85 335.45 L79.94 334.37 L80.05 333.28 L80.18 332.23 L80.35 331.14 L80.48 330.06 L80.61 328.97 L80.78 327.89 L80.99 326.8 L81.32 325.72 L81.67 324.63 L82.16 323.55 L82.53 322.46 L83.02 321.38 L83.33 320.29 L83.65 319.21 L83.99 318.12 L84.3 317.04 L84.79 315.95 L85.82 314.87 L86.39 313.78 L86.6 312.7 L86.98 311.61 L87.52 310.53 L88.18 309.44 L88.85 308.39 L89.12 307.3 L89.31 306.22 L89.46 305.13 L89.57 304.05 L89.67 302.96 L89.82 301.88 L90 300.79 L90.12 299.71 L90.27 298.62 L90.41 297.54 L90.59 296.45 L90.78 295.37 L90.99 294.28 L91.23 293.2 L91.49 292.11 L91.83 291.03 L92.26 289.94 L92.8 288.86 L93.21 287.77 L93.66 286.69 L94.24 285.6 L95.56 284.55 L96.81 283.46 L98.3 282.38 L99.17 281.29 L100.29 280.21 L102.11 279.12 L103.48 278.04 L105.6 276.95 L106 275.87 L106.53 274.78 L107.74 273.7 L108.41 272.61 L109.25 271.53 L109.92 270.44 L111.24 269.36 L112.33 268.27 L115.62 267.19 L116.53 266.1 L118.64 265.02 L120.64 263.93 L121.58 262.85 L123.26 261.76 L125.17 260.71 L128.85 259.62 L131.98 258.54 L136.1 257.45 L140.65 256.37 L147.16 255.28 L151.04 254.2 L153.01 253.11 L153.67 252.03 L156.14 250.94 L158.58 249.86 L160.86 248.77 L163.75 247.69 L164.77 246.6 L165.76 245.52 L166.83 244.43 L168.18 243.35 L169.14 242.26 L170.06 241.18 L173.22 240.09 L178.2 239.01 L182.17 237.92 L186.45 236.87 L192.19 235.79 L194.96 234.7 L199.67 233.62 L207.08 232.53 L213.19 231.45 L217.06 230.36 L221.48 229.28 L228.7 228.19 L237.67 227.11 L247.17 226.02 L257.9 224.94 L263.74 223.85 L272.92 222.77 L281.94 221.68 L291.57 220.6 L301.47 219.51 L310.87 218.43 L319.79 217.34 L326.27 216.26 L330.67 215.17 L341.52 214.09 L348.2 213.03 L354.18 211.95 L366.61 210.86 L374.2 209.78 L382.89 208.69 L383.81 207.61 L386.18 206.52 L389.6 205.44 L392.87 204.35 L398.93 203.27 L406.75 202.18 L411.63 201.1 L421.22 200.01 L429.29 198.93 L434.28 197.84 L439.51 196.76 L446.42 195.67 L451.91 194.59 L459.63 193.5 L465.85 192.42 L473.47 191.33 L479.21 190.25 L482.05 189.19 L485.1 188.11 L486.04 187.02 L487.17 185.94 L488.29 184.85 L492.99 183.77 L498.29 182.68 L504.19 181.6 L511.36 180.51 L519.96 179.43 L528.13 178.34 L538.75 177.26 L541.96 176.17 L543.24 175.09 L548.12 174 L555.61 172.92 L560.88 171.83 L565.92 170.75 L569.44 169.66 L572.33 168.58 L576.55 167.49 L582.01 166.41 L587.95 165.35 L593.97 164.27 L594.79 163.18 L597.52 162.1 L600.05 161.01 L602.87 159.93 L609.6 158.84 L615.36 157.76 L622.2 156.67 L629.61 155.59 L635.29 154.5 L640.22 153.42 L645.1 152.33 L650.45 151.25 L655.7 150.16 L660.21 149.08 L667.53 147.99 L670.25 146.91 L673.81 145.82 L677.91 144.74 L681.92 143.65 L686.45 142.57 L691.7 141.51 L692.87 140.43 L696.56 139.34 L701.98 138.26 L708.09 137.17 L711.93 136.09 L714.79 135 L719.52 133.92 L723.52 132.83 L729.4 131.75 L736 130.66 L736 368 L62 368 Z" fill="url(#fill-starhistorydarksvg)"/>
-  <path d="M62 367.97 L65.53 366.88 L67.12 365.8 L73.13 364.71 L73.34 363.63 L73.74 362.54 L74.2 361.46 L74.51 360.37 L74.83 359.29 L75.45 358.2 L76.12 357.12 L76.48 356.07 L77.21 354.98 L77.39 353.9 L77.62 352.81 L77.81 351.73 L77.98 350.64 L78.16 349.56 L78.27 348.47 L78.38 347.39 L78.52 346.3 L78.64 345.22 L78.77 344.13 L78.93 343.05 L79.14 341.96 L79.31 340.88 L79.4 339.79 L79.54 338.71 L79.64 337.62 L79.75 336.54 L79.85 335.45 L79.94 334.37 L80.05 333.28 L80.18 332.23 L80.35 331.14 L80.48 330.06 L80.61 328.97 L80.78 327.89 L80.99 326.8 L81.32 325.72 L81.67 324.63 L82.16 323.55 L82.53 322.46 L83.02 321.38 L83.33 320.29 L83.65 319.21 L83.99 318.12 L84.3 317.04 L84.79 315.95 L85.82 314.87 L86.39 313.78 L86.6 312.7 L86.98 311.61 L87.52 310.53 L88.18 309.44 L88.85 308.39 L89.12 307.3 L89.31 306.22 L89.46 305.13 L89.57 304.05 L89.67 302.96 L89.82 301.88 L90 300.79 L90.12 299.71 L90.27 298.62 L90.41 297.54 L90.59 296.45 L90.78 295.37 L90.99 294.28 L91.23 293.2 L91.49 292.11 L91.83 291.03 L92.26 289.94 L92.8 288.86 L93.21 287.77 L93.66 286.69 L94.24 285.6 L95.56 284.55 L96.81 283.46 L98.3 282.38 L99.17 281.29 L100.29 280.21 L102.11 279.12 L103.48 278.04 L105.6 276.95 L106 275.87 L106.53 274.78 L107.74 273.7 L108.41 272.61 L109.25 271.53 L109.92 270.44 L111.24 269.36 L112.33 268.27 L115.62 267.19 L116.53 266.1 L118.64 265.02 L120.64 263.93 L121.58 262.85 L123.26 261.76 L125.17 260.71 L128.85 259.62 L131.98 258.54 L136.1 257.45 L140.65 256.37 L147.16 255.28 L151.04 254.2 L153.
```

**File**: `assets/star-history.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#e6eaef" stroke-width="1"/>
   <text x="52" y="62" fill="#59636e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.53 366.88 L67.12 365.8 L73.13 364.71 L73.34 363.63 L73.74 362.54 L74.2 361.46 L74.51 360.37 L74.83 359.29 L75.45 358.2 L76.12 357.12 L76.48 356.07 L77.21 354.98 L77.39 353.9 L77.62 352.81 L77.81 351.73 L77.98 350.64 L78.16 349.56 L78.27 348.47 L78.38 347.39 L78.52 346.3 L78.64 345.22 L78.77 344.13 L78.93 343.05 L79.14 341.96 L79.31 340.88 L79.4 339.79 L79.54 338.71 L79.64 337.62 L79.75 336.54 L79.85 335.45 L79.94 334.37 L80.05 333.28 L80.18 332.23 L80.35 331.14 L80.48 330.06 L80.61 328.97 L80.78 327.89 L80.99 326.8 L81.32 325.72 L81.67 324.63 L82.16 323.55 L82.53 322.46 L83.02 321.38 L83.33 320.29 L83.65 319.21 L83.99 318.12 L84.3 317.04 L84.79 315.95 L85.82 314.87 L86.39 313.78 L86.6 312.7 L86.98 311.61 L87.52 310.53 L88.18 309.44 L88.85 308.39 L89.12 307.3 L89.31 306.22 L89.46 305.13 L89.57 304.05 L89.67 302.96 L89.82 301.88 L90 300.79 L90.12 299.71 L90.27 298.62 L90.41 297.54 L90.59 296.45 L90.78 295.37 L90.99 294.28 L91.23 293.2 L91.49 292.11 L91.83 291.03 L92.26 289.94 L92.8 288.86 L93.21 287.77 L93.66 286.69 L94.24 285.6 L95.56 284.55 L96.81 283.46 L98.3 282.38 L99.17 281.29 L100.29 280.21 L102.11 279.12 L103.48 278.04 L105.6 276.95 L106 275.87 L106.53 274.78 L107.74 273.7 L108.41 272.61 L109.25 271.53 L109.92 270.44 L111.24 269.36 L112.33 268.27 L115.62 267.19 L116.53 266.1 L118.64 265.02 L120.64 263.93 L121.58 262.85 L123.26 261.76 L125.17 260.71 L128.85 259.62 L131.98 258.54 L136.1 257.45 L140.65 256.37 L147.16 255.28 L151.04 254.2 L153.01 253.11 L153.67 252.03 L156.14 250.94 L158.58 249.86 L160.86 248.77 L163.75 247.69 L164.77 246.6 L165.76 245.52 L166.83 244.43 L168.18 243.35 L169.14 242.26 L170.06 241.18 L173.22 240.09 L178.2 239.01 L182.17 237.92 L186.45 236.87 L192.19 235.79 L194.96 234.7 L199.67 233.62 L207.08 232.53 L213.19 231.45 L217.06 230.36 L221.48 229.28 L228.7 228.19 L237.67 227.11 L247.17 226.02 L257.9 224.94 L263.74 223.85 L272.92 222.77 L281.94 221.68 L291.57 220.6 L301.47 219.51 L310.87 218.43 L319.79 217.34 L326.27 216.26 L330.67 215.17 L341.52 214.09 L348.2 213.03 L354.18 211.95 L366.61 210.86 L374.2 209.78 L382.89 208.69 L383.81 207.61 L386.18 206.52 L389.6 205.44 L392.87 204.35 L398.93 203.27 L406.75 202.18 L411.63 201.1 L421.22 200.01 L429.29 198.93 L434.28 197.84 L439.51 196.76 L446.42 195.67 L451.91 194.59 L459.63 193.5 L465.85 192.42 L473.47 191.33 L479.21 190.25 L482.05 189.19 L485.1 188.11 L486.04 187.02 L487.17 185.94 L488.29 184.85 L492.99 183.77 L498.29 182.68 L504.19 181.6 L511.36 180.51 L519.96 179.43 L528.13 178.34 L538.75 177.26 L541.96 176.17 L543.24 175.09 L548.12 174 L555.61 172.92 L560.88 171.83 L565.92 170.75 L569.44 169.66 L572.33 168.58 L576.55 167.49 L582.01 166.41 L587.95 165.35 L593.97 164.27 L594.79 163.18 L597.52 162.1 L600.05 161.01 L602.87 159.93 L609.6 158.84 L615.36 157.76 L622.2 156.67 L629.61 155.59 L635.29 154.5 L640.22 153.42 L645.1 152.33 L650.45 151.25 L655.7 150.16 L660.21 149.08 L667.53 147.99 L670.25 146.91 L673.81 145.82 L677.91 144.74 L681.92 143.65 L686.45 142.57 L691.7 141.51 L692.87 140.43 L696.56 139.34 L701.98 138.26 L708.09 137.17 L711.93 136.09 L714.79 135 L719.52 133.92 L723.52 132.83 L729.4 131.75 L736 130.66 L736 368 L62 368 Z" fill="url(#fill-starhistorysvg)"/>
-  <path d="M62 367.97 L65.53 366.88 L67.12 365.8 L73.13 364.71 L73.34 363.63 L73.74 362.54 L74.2 361.46 L74.51 360.37 L74.83 359.29 L75.45 358.2 L76.12 357.12 L76.48 356.07 L77.21 354.98 L77.39 353.9 L77.62 352.81 L77.81 351.73 L77.98 350.64 L78.16 349.56 L78.27 348.47 L78.38 347.39 L78.52 346.3 L78.64 345.22 L78.77 344.13 L78.93 343.05 L79.14 341.96 L79.31 340.88 L79.4 339.79 L79.54 338.71 L79.64 337.62 L79.75 336.54 L79.85 335.45 L79.94 334.37 L80.05 333.28 L80.18 332.23 L80.35 331.14 L80.48 330.06 L80.61 328.97 L80.78 327.89 L80.99 326.8 L81.32 325.72 L81.67 324.63 L82.16 323.55 L82.53 322.46 L83.02 321.38 L83.33 320.29 L83.65 319.21 L83.99 318.12 L84.3 317.04 L84.79 315.95 L85.82 314.87 L86.39 313.78 L86.6 312.7 L86.98 311.61 L87.52 310.53 L88.18 309.44 L88.85 308.39 L89.12 307.3 L89.31 306.22 L89.46 305.13 L89.57 304.05 L89.67 302.96 L89.82 301.88 L90 300.79 L90.12 299.71 L90.27 298.62 L90.41 297.54 L90.59 296.45 L90.78 295.37 L90.99 294.28 L91.23 293.2 L91.49 292.11 L91.83 291.03 L92.26 289.94 L92.8 288.86 L93.21 287.77 L93.66 286.69 L94.24 285.6 L95.56 284.55 L96.81 283.46 L98.3 282.38 L99.17 281.29 L100.29 280.21 L102.11 279.12 L103.48 278.04 L105.6 276.95 L106 275.87 L106.53 274.78 L107.74 273.7 L108.41 272.61 L109.25 271.53 L109.92 270.44 L111.24 269.36 L112.33 268.27 L115.62 267.19 L116.53 266.1 L118.64 265.02 L120.64 263.93 L121.58 262.85 L123.26 261.76 L125.17 260.71 L128.85 259.62 L131.98 258.54 L136.1 257.45 L140.65 256.37 L147.16 255.28 L151.04 254.2 L153.01 2
```

---

### Incident Patch 2: `bc3580d5` (2026-11-06)
**Commit Message**: chore: refresh star history

**File**: `assets/star-history-dark.svg` (modified, +12/-12)
```diff
@@ -10,7 +10,7 @@
   <rect x="0.5" y="0.5" width="759" height="419" rx="8" fill="#0d1117" stroke="#30363d" stroke-width="1"/>
 
   <text x="24" y="32" fill="#e6edf3" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="15" font-weight="600">momenbasel/PureMac</text>
-  <text x="736" y="32" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="12" text-anchor="end">7.6k stars</text>
+  <text x="736" y="32" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="12" text-anchor="end">7.7k stars</text>
 
   <line x1="62" y1="368" x2="736" y2="368" stroke="#21262d" stroke-width="1"/>
   <text x="52" y="372" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">0</text>
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#21262d" stroke-width="1"/>
   <text x="52" y="62" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.55 366.88 L67.14 365.8 L73.19 364.71 L73.4 363.63 L73.79 362.58 L74.25 361.49 L74.56 360.41 L74.9 359.32 L75.5 358.24 L76.18 357.15 L76.55 356.07 L77.29 354.98 L77.47 353.93 L77.7 352.84 L77.9 351.76 L78.06 350.67 L78.24 349.59 L78.35 348.5 L78.46 347.42 L78.6 346.33 L78.72 345.25 L78.86 344.19 L79.02 343.11 L79.21 342.02 L79.39 340.94 L79.49 339.85 L79.63 338.77 L79.73 337.68 L79.84 336.6 L79.93 335.54 L80.03 334.46 L80.14 333.37 L80.27 332.29 L80.45 331.2 L80.57 330.12 L80.7 329.03 L80.88 327.95 L81.08 326.89 L81.4 325.81 L81.71 324.72 L82.22 323.64 L82.59 322.55 L83.1 321.47 L83.42 320.38 L83.75 319.3 L84.11 318.21 L84.37 317.16 L84.8 316.08 L85.76 314.99 L86.5 313.9 L86.72 312.82 L87.03 311.74 L87.57 310.65 L88.25 309.57 L88.97 308.51 L89.24 307.43 L89.46 306.34 L89.6 305.26 L89.7 304.17 L89.81 303.09 L89.95 302 L90.11 300.92 L90.27 299.83 L90.4 298.78 L90.55 297.69 L90.72 296.61 L90.92 295.52 L91.13 294.44 L91.36 293.35 L91.62 292.27 L91.95 291.18 L92.37 290.13 L92.93 289.04 L93.34 287.96 L93.79 286.87 L94.34 285.79 L95.67 284.7 L96.96 283.62 L98.44 282.53 L99.34 281.45 L100.35 280.39 L102.05 279.31 L103.59 278.22 L105.5 277.14 L106.16 276.05 L106.76 274.97 L107.74 273.88 L108.62 272.8 L109.28 271.75 L110.03 270.66 L111.34 269.58 L112.34 268.49 L115.49 267.4 L116.62 266.32 L118.79 265.24 L120.59 264.15 L121.65 263.1 L122.8 262.01 L125.26 260.93 L128.41 259.84 L132.04 258.76 L135.89 257.67 L140.43 256.59 L145.99 255.5 L151.12 254.42 L153.34 253.36 L154.08 252.28 L156.15 251.19 L157.74 250.11 L160.99 249.02 L164.12 247.94 L164.99 246.85 L166.1 245.77 L167.17 244.71 L168.52 243.63 L169.59 242.54 L170.48 241.46 L172.45 240.37 L177.71 239.29 L181.7 238.2 L186.5 237.12 L192.11 236.03 L195.27 234.98 L198.88 233.89 L206.15 232.81 L211.55 231.72 L217.32 230.64 L221.11 229.55 L227.56 228.47 L236.93 227.38 L246.66 226.33 L256.83 225.25 L263.81 224.16 L270.6 223.08 L282.16 221.99 L289.7 220.91 L300.77 219.82 L310.28 218.74 L319.4 217.68 L327.32 216.6 L329.25 215.51 L339.78 214.43 L347.22 213.34 L352.82 212.26 L365.97 211.17 L374.6 210.09 L383.28 209 L385.34 207.95 L387 206.86 L390.89 205.78 L393.79 204.69 L398.15 203.61 L406.2 202.52 L411.22 201.44 L420.1 200.35 L428.59 199.3 L436.11 198.21 L439.49 197.13 L446.44 196.04 L452.32 194.96 L459.11 193.87 L465.47 192.79 L473.04 191.7 L480.91 190.62 L483.69 189.56 L487.01 188.48 L488.06 187.39 L488.83 186.31 L490.26 185.22 L494.28 184.14 L498.81 183.05 L503.97 181.97 L511 180.92 L518.17 179.83 L526.97 178.74 L536.65 177.66 L544.14 176.58 L544.97 175.49 L549.36 174.4 L555.14 173.32 L561.74 172.24 L567.87 171.18 L570.77 170.1 L574.18 169.01 L577.4 167.93 L583.17 166.84 L589.27 165.76 L596.19 164.67 L597.27 163.59 L598.88 162.53 L602.28 161.45 L604.8 160.36 L609.58 159.28 L615.55 158.19 L621.94 157.11 L631.95 156.02 L636.73 154.94 L641.34 153.88 L645.69 152.8 L650.88 151.71 L657.08 150.63 L661.4 149.54 L667.48 148.46 L672.65 147.37 L675.79 146.29 L679.78 145.2 L683.63 144.15 L688.45 143.06 L692.5 141.98 L695.81 140.89 L698.5 139.81 L703.1 138.72 L708.91 137.64 L714.66 136.55 L716.97 135.5 L720.9 134.42 L725.28 133.33 L730.81 132.25 L736 131.16 L736 368 L62 368 Z" fill="url(#fill-starhistorydarksvg)"/>
-  <path d="M62 367.97 L65.55 366.88 L67.14 365.8 L73.19 364.71 L73.4 363.63 L73.79 362.58 L74.25 361.49 L74.56 360.41 L74.9 359.32 L75.5 358.24 L76.18 357.15 L76.55 356.07 L77.29 354.98 L77.47 353.93 L77.7 352.84 L77.9 351.76 L78.06 350.67 L78.24 349.59 L78.35 348.5 L78.46 347.42 L78.6 346.33 L78.72 345.25 L78.86 344.19 L79.02 343.11 L79.21 342.02 L79.39 340.94 L79.49 339.85 L79.63 338.77 L79.73 337.68 L79.84 336.6 L79.93 335.54 L80.03 334.46 L80.14 333.37 L80.27 332.29 L80.45 331.2 L80.57 330.12 L80.7 329.03 L80.88 327.95 L81.08 326.89 L81.4 325.81 L81.71 324.72 L82.22 32
```

**File**: `assets/star-history.svg` (modified, +12/-12)
```diff
@@ -10,7 +10,7 @@
   <rect x="0.5" y="0.5" width="759" height="419" rx="8" fill="#ffffff" stroke="#d1d9e0" stroke-width="1"/>
 
   <text x="24" y="32" fill="#1f2328" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="15" font-weight="600">momenbasel/PureMac</text>
-  <text x="736" y="32" fill="#59636e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="12" text-anchor="end">7.6k stars</text>
+  <text x="736" y="32" fill="#59636e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="12" text-anchor="end">7.7k stars</text>
 
   <line x1="62" y1="368" x2="736" y2="368" stroke="#e6eaef" stroke-width="1"/>
   <text x="52" y="372" fill="#59636e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">0</text>
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#e6eaef" stroke-width="1"/>
   <text x="52" y="62" fill="#59636e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.55 366.88 L67.14 365.8 L73.19 364.71 L73.4 363.63 L73.79 362.58 L74.25 361.49 L74.56 360.41 L74.9 359.32 L75.5 358.24 L76.18 357.15 L76.55 356.07 L77.29 354.98 L77.47 353.93 L77.7 352.84 L77.9 351.76 L78.06 350.67 L78.24 349.59 L78.35 348.5 L78.46 347.42 L78.6 346.33 L78.72 345.25 L78.86 344.19 L79.02 343.11 L79.21 342.02 L79.39 340.94 L79.49 339.85 L79.63 338.77 L79.73 337.68 L79.84 336.6 L79.93 335.54 L80.03 334.46 L80.14 333.37 L80.27 332.29 L80.45 331.2 L80.57 330.12 L80.7 329.03 L80.88 327.95 L81.08 326.89 L81.4 325.81 L81.71 324.72 L82.22 323.64 L82.59 322.55 L83.1 321.47 L83.42 320.38 L83.75 319.3 L84.11 318.21 L84.37 317.16 L84.8 316.08 L85.76 314.99 L86.5 313.9 L86.72 312.82 L87.03 311.74 L87.57 310.65 L88.25 309.57 L88.97 308.51 L89.24 307.43 L89.46 306.34 L89.6 305.26 L89.7 304.17 L89.81 303.09 L89.95 302 L90.11 300.92 L90.27 299.83 L90.4 298.78 L90.55 297.69 L90.72 296.61 L90.92 295.52 L91.13 294.44 L91.36 293.35 L91.62 292.27 L91.95 291.18 L92.37 290.13 L92.93 289.04 L93.34 287.96 L93.79 286.87 L94.34 285.79 L95.67 284.7 L96.96 283.62 L98.44 282.53 L99.34 281.45 L100.35 280.39 L102.05 279.31 L103.59 278.22 L105.5 277.14 L106.16 276.05 L106.76 274.97 L107.74 273.88 L108.62 272.8 L109.28 271.75 L110.03 270.66 L111.34 269.58 L112.34 268.49 L115.49 267.4 L116.62 266.32 L118.79 265.24 L120.59 264.15 L121.65 263.1 L122.8 262.01 L125.26 260.93 L128.41 259.84 L132.04 258.76 L135.89 257.67 L140.43 256.59 L145.99 255.5 L151.12 254.42 L153.34 253.36 L154.08 252.28 L156.15 251.19 L157.74 250.11 L160.99 249.02 L164.12 247.94 L164.99 246.85 L166.1 245.77 L167.17 244.71 L168.52 243.63 L169.59 242.54 L170.48 241.46 L172.45 240.37 L177.71 239.29 L181.7 238.2 L186.5 237.12 L192.11 236.03 L195.27 234.98 L198.88 233.89 L206.15 232.81 L211.55 231.72 L217.32 230.64 L221.11 229.55 L227.56 228.47 L236.93 227.38 L246.66 226.33 L256.83 225.25 L263.81 224.16 L270.6 223.08 L282.16 221.99 L289.7 220.91 L300.77 219.82 L310.28 218.74 L319.4 217.68 L327.32 216.6 L329.25 215.51 L339.78 214.43 L347.22 213.34 L352.82 212.26 L365.97 211.17 L374.6 210.09 L383.28 209 L385.34 207.95 L387 206.86 L390.89 205.78 L393.79 204.69 L398.15 203.61 L406.2 202.52 L411.22 201.44 L420.1 200.35 L428.59 199.3 L436.11 198.21 L439.49 197.13 L446.44 196.04 L452.32 194.96 L459.11 193.87 L465.47 192.79 L473.04 191.7 L480.91 190.62 L483.69 189.56 L487.01 188.48 L488.06 187.39 L488.83 186.31 L490.26 185.22 L494.28 184.14 L498.81 183.05 L503.97 181.97 L511 180.92 L518.17 179.83 L526.97 178.74 L536.65 177.66 L544.14 176.58 L544.97 175.49 L549.36 174.4 L555.14 173.32 L561.74 172.24 L567.87 171.18 L570.77 170.1 L574.18 169.01 L577.4 167.93 L583.17 166.84 L589.27 165.76 L596.19 164.67 L597.27 163.59 L598.88 162.53 L602.28 161.45 L604.8 160.36 L609.58 159.28 L615.55 158.19 L621.94 157.11 L631.95 156.02 L636.73 154.94 L641.34 153.88 L645.69 152.8 L650.88 151.71 L657.08 150.63 L661.4 149.54 L667.48 148.46 L672.65 147.37 L675.79 146.29 L679.78 145.2 L683.63 144.15 L688.45 143.06 L692.5 141.98 L695.81 140.89 L698.5 139.81 L703.1 138.72 L708.91 137.64 L714.66 136.55 L716.97 135.5 L720.9 134.42 L725.28 133.33 L730.81 132.25 L736 131.16 L736 368 L62 368 Z" fill="url(#fill-starhistorysvg)"/>
-  <path d="M62 367.97 L65.55 366.88 L67.14 365.8 L73.19 364.71 L73.4 363.63 L73.79 362.58 L74.25 361.49 L74.56 360.41 L74.9 359.32 L75.5 358.24 L76.18 357.15 L76.55 356.07 L77.29 354.98 L77.47 353.93 L77.7 352.84 L77.9 351.76 L78.06 350.67 L78.24 349.59 L78.35 348.5 L78.46 347.42 L78.6 346.33 L78.72 345.25 L78.86 344.19 L79.02 343.11 L79.21 342.02 L79.39 340.94 L79.49 339.85 L79.63 338.77 L79.73 337.68 L79.84 336.6 L79.93 335.54 L80.03 334.46 L80.14 333.37 L80.27 332.29 L80.45 331.2 L80.57 330.12 L80.7 329.03 L80.88 327.95 L81.08 326.89 L81.4 325.81 L81.71 324.72 L82.22 323.64
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
