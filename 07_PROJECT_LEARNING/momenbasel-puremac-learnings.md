> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/momenbasel-puremac-learnings.md`  
> **Source**: github ([https://github.com/momenbasel/PureMac](https://github.com/momenbasel/PureMac))  
> **Source Version**: `656ec5b1`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-15T14:36:30.339Z  
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
> **Harvest Timestamp**: 2026-11-15T14:36:30.227Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `momenbasel/PureMac`
- **Description**: Free, open-source macOS cleaner. CleanMyMac alternative with zero telemetry. Native SwiftUI, scheduled auto-cleaning, Xcode/Homebrew/system cache cleanup. MIT licensed.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7805 stars

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

### Incident Patch 1: `656ec5b1` (2026-11-15)
**Commit Message**: chore: refresh star history

**File**: `assets/star-history-dark.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#21262d" stroke-width="1"/>
   <text x="52" y="62" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.74 366.85 L66.95 365.77 L72.73 364.65 L72.94 363.57 L73.32 362.45 L73.77 361.37 L74.11 360.25 L74.41 359.17 L75.04 358.05 L75.63 356.96 L76.15 355.85 L76.68 354.76 L76.86 353.65 L77.08 352.56 L77.27 351.45 L77.43 350.36 L77.61 349.25 L77.7 348.16 L77.81 347.04 L77.95 345.96 L78.09 344.84 L78.2 343.76 L78.38 342.64 L78.58 341.56 L78.71 340.44 L78.82 339.33 L78.94 338.24 L79.06 337.12 L79.15 336.04 L79.23 334.92 L79.34 333.84 L79.46 332.72 L79.62 331.64 L79.76 330.52 L79.88 329.44 L80.03 328.32 L80.23 327.24 L80.5 326.12 L80.79 325.03 L81.24 323.92 L81.64 322.83 L82.14 321.72 L82.48 320.63 L82.77 319.52 L83.15 318.43 L83.41 317.32 L83.74 316.23 L84.75 315.11 L85.46 314 L85.67 312.91 L85.99 311.8 L86.5 310.71 L87.15 309.6 L87.85 308.51 L88.1 307.4 L88.31 306.31 L88.45 305.19 L88.56 304.11 L88.65 302.99 L88.81 301.91 L88.97 300.79 L89.1 299.71 L89.24 298.59 L89.39 297.51 L89.56 296.39 L89.73 295.31 L89.94 294.19 L90.21 293.1 L90.46 291.99 L90.85 290.9 L91.28 289.79 L91.77 288.7 L92.15 287.59 L92.62 286.47 L93.4 285.39 L94.96 284.27 L96.14 283.18 L97.29 282.07 L98.23 280.98 L99.36 279.87 L100.96 278.78 L102.47 277.67 L104.2 276.58 L104.69 275.47 L105.28 274.38 L106.39 273.26 L107.05 272.18 L107.84 271.06 L108.75 269.98 L109.98 268.86 L112.37 267.78 L114.05 266.66 L115.69 265.58 L117.27 264.46 L119.01 263.38 L119.98 262.26 L122.23 261.17 L125.36 260.06 L128.97 258.94 L132.53 257.86 L136.53 256.74 L141.7 255.66 L147.09 254.54 L149.5 253.46 L150.22 252.34 L152.12 251.25 L153.74 250.14 L156.85 249.05 L159.89 247.94 L160.82 246.85 L161.87 245.74 L162.89 244.65 L164.22 243.54 L165.19 242.45 L166.05 241.33 L168.66 240.25 L173.85 239.13 L177.67 238.05 L181.95 236.93 L187.51 235.85 L190.25 234.73 L196.17 233.62 L202.12 232.53 L207.87 231.41 L211.58 230.33 L215.99 229.21 L224.47 228.13 L232.89 227.01 L242.93 225.93 L252.03 224.81 L258.37 223.73 L267.55 222.61 L275.66 221.53 L286.29 220.41 L294.47 219.32 L304.14 218.21 L313.98 217.12 L316.98 216.01 L323.03 214.92 L332.87 213.81 L339.59 212.72 L348.9 211.61 L358.13 210.52 L368.74 209.4 L371.4 208.32 L372.84 207.2 L376.47 206.09 L379.46 205 L382.78 203.89 L390.28 202.8 L396.08 201.69 L403.35 200.6 L411.27 199.48 L420.28 198.4 L423.28 197.28 L429.66 196.2 L435.82 195.08 L442.22 194 L448.6 192.88 L455.85 191.8 L463.41 190.68 L466.13 189.6 L469.45 188.48 L470.33 187.39 L471.18 186.28 L472.44 185.19 L476.74 184.08 L481.26 182.99 L486.9 181.88 L493.99 180.79 L501.55 179.68 L510.9 178.56 L520.83 177.47 L524.37 176.36 L525.61 175.27 L530.41 174.16 L537.59 173.07 L543.16 171.96 L547.77 170.87 L551.57 169.76 L554.09 168.67 L558.19 167.55 L563.36 166.47 L569.46 165.35 L574.54 164.27 L575.94 163.15 L578.26 162.07 L580.81 160.95 L584.61 159.87 L591.41 158.75 L596.49 157.67 L607.92 156.55 L611.35 155.46 L616.38 154.35 L620.46 153.23 L625.86 152.15 L631.88 151.03 L635.64 149.95 L641.05 148.83 L646.57 147.75 L649.62 146.63 L653.82 145.54 L657.29 144.43 L662.17 143.34 L666.05 142.23 L669.3 141.14 L671.88 140.03 L676.29 138.94 L682.42 137.82 L687.43 136.74 L689.87 135.62 L694.18 134.54 L698.23 133.42 L703.59 132.34 L709.82 131.22 L716.46 130.14 L723.24 129.02 L729.56 127.94 L736 126.82 L736 368 L62 368 Z" fill="url(#fill-starhistorydarksvg)"/>
-  <path d="M62 367.97 L65.74 366.85 L66.95 365.77 L72.73 364.65 L72.94 363.57 L73.32 362.45 L73.77 361.37 L74.11 360.25 L74.41 359.17 L75.04 358.05 L75.63 356.96 L76.15 355.85 L76.68 354.76 L76.86 353.65 L77.08 352.56 L77.27 351.45 L77.43 350.36 L77.61 349.25 L77.7 348.16 L77.81 347.04 L77.95 345.96 L78.09 344.84 L78.2 343.76 L78.38 342.64 L78.58 341.56 L78.71 340.44 L78.82 339.33 L78.94 338.24 L79.06 337.12 L79.15 336.04 L79.23 334.92 L79.34 333.84 L79.46 332.72 L79.62 331.64 L79.76 330.52 L79.88 329.44 L80.03 328.32 L80.23 327.24 L80.5 326.12 L80.79 325.03 L81.24 323.92 L81.64 322.83 L82.14 321.72 L82.48 320.63 L82.77 319.52 L83.15 318.43 L83.41 317.32 L83.74 316.23 L84.75 315.11 L85.46 314 L85.67 312.91 L85.99 311.8 L86.5 310.71 L87.15 309.6 L87.85 308.51 L88.1 307.4 L88.31 306.31 L88.45 305.19 L88.56 304.11 L88.65 302.99 L88.81 301.91 L88.97 300.79 L89.1 299.71 L89.24 298.59 L89.39 297.51 L89.56 296.39 L89.73 295.31 L89.94 294.19 L90.21 293.1 L90.46 291.99 L90.85 290.9 L91.28 289.79 L91.77 288.7 L92.15 287.59 L92.62 286.47 L93.4 285.39 L94.96 284.27 L96.14 283.18 L97.29 282.07 L98.23 280.98 L99.36 279.87 L100.96 278.78 L102.47 277.67 L104.2 276.58 L104.69 275.47 L105.28 274.38 L106.39 273.26 L107.05 272.18 L107.84 271.06 L108.75 269.98 L109.98 268.86 L112.37 267.78 L114.05 266.66 L115.69 265.58 L117.27 264.46 L119.01 263.38 L119.98 262.26 L122.23 261.17 L125.36 260.06 L128.97 258.94 L132.53 257.86 L136.53 256.74 L141.7 255.66 L147.09 254.54 L149.5 253.46
```

**File**: `assets/star-history.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#e6eaef" stroke-width="1"/>
   <text x="52" y="62" fill="#59636e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.74 366.85 L66.95 365.77 L72.73 364.65 L72.94 363.57 L73.32 362.45 L73.77 361.37 L74.11 360.25 L74.41 359.17 L75.04 358.05 L75.63 356.96 L76.15 355.85 L76.68 354.76 L76.86 353.65 L77.08 352.56 L77.27 351.45 L77.43 350.36 L77.61 349.25 L77.7 348.16 L77.81 347.04 L77.95 345.96 L78.09 344.84 L78.2 343.76 L78.38 342.64 L78.58 341.56 L78.71 340.44 L78.82 339.33 L78.94 338.24 L79.06 337.12 L79.15 336.04 L79.23 334.92 L79.34 333.84 L79.46 332.72 L79.62 331.64 L79.76 330.52 L79.88 329.44 L80.03 328.32 L80.23 327.24 L80.5 326.12 L80.79 325.03 L81.24 323.92 L81.64 322.83 L82.14 321.72 L82.48 320.63 L82.77 319.52 L83.15 318.43 L83.41 317.32 L83.74 316.23 L84.75 315.11 L85.46 314 L85.67 312.91 L85.99 311.8 L86.5 310.71 L87.15 309.6 L87.85 308.51 L88.1 307.4 L88.31 306.31 L88.45 305.19 L88.56 304.11 L88.65 302.99 L88.81 301.91 L88.97 300.79 L89.1 299.71 L89.24 298.59 L89.39 297.51 L89.56 296.39 L89.73 295.31 L89.94 294.19 L90.21 293.1 L90.46 291.99 L90.85 290.9 L91.28 289.79 L91.77 288.7 L92.15 287.59 L92.62 286.47 L93.4 285.39 L94.96 284.27 L96.14 283.18 L97.29 282.07 L98.23 280.98 L99.36 279.87 L100.96 278.78 L102.47 277.67 L104.2 276.58 L104.69 275.47 L105.28 274.38 L106.39 273.26 L107.05 272.18 L107.84 271.06 L108.75 269.98 L109.98 268.86 L112.37 267.78 L114.05 266.66 L115.69 265.58 L117.27 264.46 L119.01 263.38 L119.98 262.26 L122.23 261.17 L125.36 260.06 L128.97 258.94 L132.53 257.86 L136.53 256.74 L141.7 255.66 L147.09 254.54 L149.5 253.46 L150.22 252.34 L152.12 251.25 L153.74 250.14 L156.85 249.05 L159.89 247.94 L160.82 246.85 L161.87 245.74 L162.89 244.65 L164.22 243.54 L165.19 242.45 L166.05 241.33 L168.66 240.25 L173.85 239.13 L177.67 238.05 L181.95 236.93 L187.51 235.85 L190.25 234.73 L196.17 233.62 L202.12 232.53 L207.87 231.41 L211.58 230.33 L215.99 229.21 L224.47 228.13 L232.89 227.01 L242.93 225.93 L252.03 224.81 L258.37 223.73 L267.55 222.61 L275.66 221.53 L286.29 220.41 L294.47 219.32 L304.14 218.21 L313.98 217.12 L316.98 216.01 L323.03 214.92 L332.87 213.81 L339.59 212.72 L348.9 211.61 L358.13 210.52 L368.74 209.4 L371.4 208.32 L372.84 207.2 L376.47 206.09 L379.46 205 L382.78 203.89 L390.28 202.8 L396.08 201.69 L403.35 200.6 L411.27 199.48 L420.28 198.4 L423.28 197.28 L429.66 196.2 L435.82 195.08 L442.22 194 L448.6 192.88 L455.85 191.8 L463.41 190.68 L466.13 189.6 L469.45 188.48 L470.33 187.39 L471.18 186.28 L472.44 185.19 L476.74 184.08 L481.26 182.99 L486.9 181.88 L493.99 180.79 L501.55 179.68 L510.9 178.56 L520.83 177.47 L524.37 176.36 L525.61 175.27 L530.41 174.16 L537.59 173.07 L543.16 171.96 L547.77 170.87 L551.57 169.76 L554.09 168.67 L558.19 167.55 L563.36 166.47 L569.46 165.35 L574.54 164.27 L575.94 163.15 L578.26 162.07 L580.81 160.95 L584.61 159.87 L591.41 158.75 L596.49 157.67 L607.92 156.55 L611.35 155.46 L616.38 154.35 L620.46 153.23 L625.86 152.15 L631.88 151.03 L635.64 149.95 L641.05 148.83 L646.57 147.75 L649.62 146.63 L653.82 145.54 L657.29 144.43 L662.17 143.34 L666.05 142.23 L669.3 141.14 L671.88 140.03 L676.29 138.94 L682.42 137.82 L687.43 136.74 L689.87 135.62 L694.18 134.54 L698.23 133.42 L703.59 132.34 L709.82 131.22 L716.46 130.14 L723.24 129.02 L729.56 127.94 L736 126.82 L736 368 L62 368 Z" fill="url(#fill-starhistorysvg)"/>
-  <path d="M62 367.97 L65.74 366.85 L66.95 365.77 L72.73 364.65 L72.94 363.57 L73.32 362.45 L73.77 361.37 L74.11 360.25 L74.41 359.17 L75.04 358.05 L75.63 356.96 L76.15 355.85 L76.68 354.76 L76.86 353.65 L77.08 352.56 L77.27 351.45 L77.43 350.36 L77.61 349.25 L77.7 348.16 L77.81 347.04 L77.95 345.96 L78.09 344.84 L78.2 343.76 L78.38 342.64 L78.58 341.56 L78.71 340.44 L78.82 339.33 L78.94 338.24 L79.06 337.12 L79.15 336.04 L79.23 334.92 L79.34 333.84 L79.46 332.72 L79.62 331.64 L79.76 330.52 L79.88 329.44 L80.03 328.32 L80.23 327.24 L80.5 326.12 L80.79 325.03 L81.24 323.92 L81.64 322.83 L82.14 321.72 L82.48 320.63 L82.77 319.52 L83.15 318.43 L83.41 317.32 L83.74 316.23 L84.75 315.11 L85.46 314 L85.67 312.91 L85.99 311.8 L86.5 310.71 L87.15 309.6 L87.85 308.51 L88.1 307.4 L88.31 306.31 L88.45 305.19 L88.56 304.11 L88.65 302.99 L88.81 301.91 L88.97 300.79 L89.1 299.71 L89.24 298.59 L89.39 297.51 L89.56 296.39 L89.73 295.31 L89.94 294.19 L90.21 293.1 L90.46 291.99 L90.85 290.9 L91.28 289.79 L91.77 288.7 L92.15 287.59 L92.62 286.47 L93.4 285.39 L94.96 284.27 L96.14 283.18 L97.29 282.07 L98.23 280.98 L99.36 279.87 L100.96 278.78 L102.47 277.67 L104.2 276.58 L104.69 275.47 L105.28 274.38 L106.39 273.26 L107.05 272.18 L107.84 271.06 L108.75 269.98 L109.98 268.86 L112.37 267.78 L114.05 266.66 L115.69 265.58 L117.27 264.46 L119.01 263.38 L119.98 262.26 L122.23 261.17 L125.36 260.06 L128.97 258.94 L132.53 257.86 L136.53 256.74 L141.7 255.66 L147.09 254.54 L149.5 253.46 L15
```

---

### Incident Patch 2: `21db8cd6` (2026-11-14)
**Commit Message**: chore: refresh star history

**File**: `assets/star-history-dark.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#21262d" stroke-width="1"/>
   <text x="52" y="62" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.41 366.88 L66.98 365.77 L72.77 364.68 L72.99 363.57 L73.37 362.48 L73.82 361.37 L74.12 360.28 L74.47 359.17 L75.1 358.08 L75.69 356.96 L76.18 355.88 L76.75 354.76 L76.93 353.68 L77.14 352.59 L77.34 351.48 L77.49 350.39 L77.68 349.28 L77.77 348.19 L77.88 347.08 L78.02 345.99 L78.16 344.87 L78.28 343.79 L78.45 342.67 L78.66 341.59 L78.79 340.47 L78.9 339.39 L79.01 338.3 L79.12 337.19 L79.22 336.1 L79.31 334.99 L79.41 333.9 L79.53 332.78 L79.69 331.7 L79.83 330.58 L79.96 329.5 L80.1 328.38 L80.28 327.3 L80.57 326.18 L80.85 325.1 L81.27 324.01 L81.73 322.9 L82.12 321.81 L82.54 320.69 L82.84 319.61 L83.23 318.49 L83.5 317.41 L83.82 316.29 L84.78 315.21 L85.47 314.09 L85.75 313.01 L86.06 311.89 L86.59 310.81 L87.13 309.72 L87.92 308.6 L88.21 307.52 L88.42 306.4 L88.57 305.32 L88.67 304.2 L88.77 303.12 L88.9 302 L89.06 300.92 L89.21 299.8 L89.35 298.72 L89.49 297.6 L89.66 296.51 L89.85 295.43 L90.05 294.31 L90.31 293.23 L90.55 292.11 L90.91 291.03 L91.38 289.91 L91.85 288.83 L92.26 287.71 L92.71 286.63 L93.42 285.51 L94.71 284.42 L95.96 283.31 L97.35 282.22 L98.23 281.14 L99.29 280.02 L100.99 278.94 L102.49 277.82 L104.33 276.74 L104.84 275.62 L105.32 274.53 L106.48 273.42 L107.11 272.33 L108.01 271.22 L108.8 270.13 L109.92 269.02 L111.72 267.93 L114.15 266.85 L115.77 265.73 L117.18 264.65 L118.98 263.53 L119.9 262.45 L122.36 261.33 L125.41 260.24 L128.44 259.13 L132.59 258.04 L135.73 256.93 L141.31 255.84 L146.75 254.73 L149.87 253.64 L150.37 252.56 L151.54 251.44 L153.74 250.36 L156.62 249.24 L160.14 248.15 L161.05 247.04 L162.04 245.95 L163.11 244.84 L164.51 243.75 L165.56 242.64 L166.37 241.55 L168.26 240.47 L173.34 239.35 L176.85 238.27 L181.86 237.15 L187.26 236.06 L190.32 234.95 L193.92 233.86 L200.87 232.75 L206.33 231.66 L211.92 230.55 L215.65 229.46 L222.43 228.35 L231.44 227.26 L240.79 226.18 L251.04 225.06 L256.92 223.97 L265.32 222.86 L274.7 221.77 L284.2 220.66 L293.28 219.57 L302.88 218.46 L311.52 217.37 L317.8 216.26 L322.19 215.17 L332.77 214.05 L339.37 212.97 L345.82 211.88 L357.75 210.77 L366.02 209.68 L372.69 208.57 L373.78 207.48 L376.47 206.37 L379.52 205.28 L383.15 204.17 L389.02 203.08 L396.4 201.96 L401.96 200.88 L410.65 199.76 L419.33 198.68 L423.06 197.59 L429.36 196.48 L435.93 195.39 L442.78 194.28 L448.39 193.19 L455.07 192.08 L463.65 190.99 L467.11 189.87 L470.35 188.79 L471.96 187.67 L472.73 186.59 L474.02 185.47 L477.27 184.39 L481.96 183.3 L487.19 182.19 L493.78 181.1 L500.12 179.99 L509.25 178.9 L518.29 177.78 L526.13 176.7 L526.95 175.58 L531.36 174.5 L537.47 173.38 L543.13 172.3 L549.27 171.18 L552.17 170.1 L555.42 169.01 L558.49 167.9 L564.23 166.81 L570.51 165.69 L576.75 164.61 L577.53 163.49 L579.55 162.41 L582.7 161.29 L585.41 160.21 L591.86 159.09 L597.54 158.01 L604.22 156.89 L611.4 155.81 L616.89 154.72 L621.75 153.6 L626.49 152.52 L631.99 151.4 L637.03 150.32 L641.49 149.2 L648.42 148.12 L650.78 147 L654.24 145.92 L658.8 144.8 L662.91 143.72 L667.18 142.6 L671.86 141.51 L673.01 140.43 L677.66 139.31 L682.96 138.23 L688.32 137.11 L691.58 136.03 L694.68 134.91 L699.69 133.83 L704.89 132.71 L709.9 131.63 L716.77 130.51 L724.34 129.42 L730.57 128.31 L736 127.22 L736 368 L62 368 Z" fill="url(#fill-starhistorydarksvg)"/>
-  <path d="M62 367.97 L65.41 366.88 L66.98 365.77 L72.77 364.68 L72.99 363.57 L73.37 362.48 L73.82 361.37 L74.12 360.28 L74.47 359.17 L75.1 358.08 L75.69 356.96 L76.18 355.88 L76.75 354.76 L76.93 353.68 L77.14 352.59 L77.34 351.48 L77.49 350.39 L77.68 349.28 L77.77 348.19 L77.88 347.08 L78.02 345.99 L78.16 344.87 L78.28 343.79 L78.45 342.67 L78.66 341.59 L78.79 340.47 L78.9 339.39 L79.01 338.3 L79.12 337.19 L79.22 336.1 L79.31 334.99 L79.41 333.9 L79.53 332.78 L79.69 331.7 L79.83 330.58 L79.96 329.5 L80.1 328.38 L80.28 327.3 L80.57 326.18 L80.85 325.1 L81.27 324.01 L81.73 322.9 L82.12 321.81 L82.54 320.69 L82.84 319.61 L83.23 318.49 L83.5 317.41 L83.82 316.29 L84.78 315.21 L85.47 314.09 L85.75 313.01 L86.06 311.89 L86.59 310.81 L87.13 309.72 L87.92 308.6 L88.21 307.52 L88.42 306.4 L88.57 305.32 L88.67 304.2 L88.77 303.12 L88.9 302 L89.06 300.92 L89.21 299.8 L89.35 298.72 L89.49 297.6 L89.66 296.51 L89.85 295.43 L90.05 294.31 L90.31 293.23 L90.55 292.11 L90.91 291.03 L91.38 289.91 L91.85 288.83 L92.26 287.71 L92.71 286.63 L93.42 285.51 L94.71 284.42 L95.96 283.31 L97.35 282.22 L98.23 281.14 L99.29 280.02 L100.99 278.94 L102.49 277.82 L104.33 276.74 L104.84 275.62 L105.32 274.53 L106.48 273.42 L107.11 272.33 L108.01 271.22 L108.8 270.13 L109.92 269.02 L111.72 267.93 L114.15 266.85 L115.77 265.73 L117.18 264.65 L118.98 263.53 L119.9 262.45 L122.36 261.33 L125.41 260.24 L128.44 259.13 L132.59 258.04 L135.73 256.93 L141.31 255.84 L146.75 254.73 L149.87 253.64 L150.37 252
```

**File**: `assets/star-history.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#e6eaef" stroke-width="1"/>
   <text x="52" y="62" fill="#59636e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.41 366.88 L66.98 365.77 L72.77 364.68 L72.99 363.57 L73.37 362.48 L73.82 361.37 L74.12 360.28 L74.47 359.17 L75.1 358.08 L75.69 356.96 L76.18 355.88 L76.75 354.76 L76.93 353.68 L77.14 352.59 L77.34 351.48 L77.49 350.39 L77.68 349.28 L77.77 348.19 L77.88 347.08 L78.02 345.99 L78.16 344.87 L78.28 343.79 L78.45 342.67 L78.66 341.59 L78.79 340.47 L78.9 339.39 L79.01 338.3 L79.12 337.19 L79.22 336.1 L79.31 334.99 L79.41 333.9 L79.53 332.78 L79.69 331.7 L79.83 330.58 L79.96 329.5 L80.1 328.38 L80.28 327.3 L80.57 326.18 L80.85 325.1 L81.27 324.01 L81.73 322.9 L82.12 321.81 L82.54 320.69 L82.84 319.61 L83.23 318.49 L83.5 317.41 L83.82 316.29 L84.78 315.21 L85.47 314.09 L85.75 313.01 L86.06 311.89 L86.59 310.81 L87.13 309.72 L87.92 308.6 L88.21 307.52 L88.42 306.4 L88.57 305.32 L88.67 304.2 L88.77 303.12 L88.9 302 L89.06 300.92 L89.21 299.8 L89.35 298.72 L89.49 297.6 L89.66 296.51 L89.85 295.43 L90.05 294.31 L90.31 293.23 L90.55 292.11 L90.91 291.03 L91.38 289.91 L91.85 288.83 L92.26 287.71 L92.71 286.63 L93.42 285.51 L94.71 284.42 L95.96 283.31 L97.35 282.22 L98.23 281.14 L99.29 280.02 L100.99 278.94 L102.49 277.82 L104.33 276.74 L104.84 275.62 L105.32 274.53 L106.48 273.42 L107.11 272.33 L108.01 271.22 L108.8 270.13 L109.92 269.02 L111.72 267.93 L114.15 266.85 L115.77 265.73 L117.18 264.65 L118.98 263.53 L119.9 262.45 L122.36 261.33 L125.41 260.24 L128.44 259.13 L132.59 258.04 L135.73 256.93 L141.31 255.84 L146.75 254.73 L149.87 253.64 L150.37 252.56 L151.54 251.44 L153.74 250.36 L156.62 249.24 L160.14 248.15 L161.05 247.04 L162.04 245.95 L163.11 244.84 L164.51 243.75 L165.56 242.64 L166.37 241.55 L168.26 240.47 L173.34 239.35 L176.85 238.27 L181.86 237.15 L187.26 236.06 L190.32 234.95 L193.92 233.86 L200.87 232.75 L206.33 231.66 L211.92 230.55 L215.65 229.46 L222.43 228.35 L231.44 227.26 L240.79 226.18 L251.04 225.06 L256.92 223.97 L265.32 222.86 L274.7 221.77 L284.2 220.66 L293.28 219.57 L302.88 218.46 L311.52 217.37 L317.8 216.26 L322.19 215.17 L332.77 214.05 L339.37 212.97 L345.82 211.88 L357.75 210.77 L366.02 209.68 L372.69 208.57 L373.78 207.48 L376.47 206.37 L379.52 205.28 L383.15 204.17 L389.02 203.08 L396.4 201.96 L401.96 200.88 L410.65 199.76 L419.33 198.68 L423.06 197.59 L429.36 196.48 L435.93 195.39 L442.78 194.28 L448.39 193.19 L455.07 192.08 L463.65 190.99 L467.11 189.87 L470.35 188.79 L471.96 187.67 L472.73 186.59 L474.02 185.47 L477.27 184.39 L481.96 183.3 L487.19 182.19 L493.78 181.1 L500.12 179.99 L509.25 178.9 L518.29 177.78 L526.13 176.7 L526.95 175.58 L531.36 174.5 L537.47 173.38 L543.13 172.3 L549.27 171.18 L552.17 170.1 L555.42 169.01 L558.49 167.9 L564.23 166.81 L570.51 165.69 L576.75 164.61 L577.53 163.49 L579.55 162.41 L582.7 161.29 L585.41 160.21 L591.86 159.09 L597.54 158.01 L604.22 156.89 L611.4 155.81 L616.89 154.72 L621.75 153.6 L626.49 152.52 L631.99 151.4 L637.03 150.32 L641.49 149.2 L648.42 148.12 L650.78 147 L654.24 145.92 L658.8 144.8 L662.91 143.72 L667.18 142.6 L671.86 141.51 L673.01 140.43 L677.66 139.31 L682.96 138.23 L688.32 137.11 L691.58 136.03 L694.68 134.91 L699.69 133.83 L704.89 132.71 L709.9 131.63 L716.77 130.51 L724.34 129.42 L730.57 128.31 L736 127.22 L736 368 L62 368 Z" fill="url(#fill-starhistorysvg)"/>
-  <path d="M62 367.97 L65.41 366.88 L66.98 365.77 L72.77 364.68 L72.99 363.57 L73.37 362.48 L73.82 361.37 L74.12 360.28 L74.47 359.17 L75.1 358.08 L75.69 356.96 L76.18 355.88 L76.75 354.76 L76.93 353.68 L77.14 352.59 L77.34 351.48 L77.49 350.39 L77.68 349.28 L77.77 348.19 L77.88 347.08 L78.02 345.99 L78.16 344.87 L78.28 343.79 L78.45 342.67 L78.66 341.59 L78.79 340.47 L78.9 339.39 L79.01 338.3 L79.12 337.19 L79.22 336.1 L79.31 334.99 L79.41 333.9 L79.53 332.78 L79.69 331.7 L79.83 330.58 L79.96 329.5 L80.1 328.38 L80.28 327.3 L80.57 326.18 L80.85 325.1 L81.27 324.01 L81.73 322.9 L82.12 321.81 L82.54 320.69 L82.84 319.61 L83.23 318.49 L83.5 317.41 L83.82 316.29 L84.78 315.21 L85.47 314.09 L85.75 313.01 L86.06 311.89 L86.59 310.81 L87.13 309.72 L87.92 308.6 L88.21 307.52 L88.42 306.4 L88.57 305.32 L88.67 304.2 L88.77 303.12 L88.9 302 L89.06 300.92 L89.21 299.8 L89.35 298.72 L89.49 297.6 L89.66 296.51 L89.85 295.43 L90.05 294.31 L90.31 293.23 L90.55 292.11 L90.91 291.03 L91.38 289.91 L91.85 288.83 L92.26 287.71 L92.71 286.63 L93.42 285.51 L94.71 284.42 L95.96 283.31 L97.35 282.22 L98.23 281.14 L99.29 280.02 L100.99 278.94 L102.49 277.82 L104.33 276.74 L104.84 275.62 L105.32 274.53 L106.48 273.42 L107.11 272.33 L108.01 271.22 L108.8 270.13 L109.92 269.02 L111.72 267.93 L114.15 266.85 L115.77 265.73 L117.18 264.65 L118.98 263.53 L119.9 262.45 L122.36 261.33 L125.41 260.24 L128.44 259.13 L132.59 258.04 L135.73 256.93 L141.31 255.84 L146.75 254.73 L149.87 253.64 L150.37 252.56 
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
