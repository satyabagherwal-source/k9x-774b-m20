> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/momenbasel-puremac-learnings.md`  
> **Source**: github ([https://github.com/momenbasel/PureMac](https://github.com/momenbasel/PureMac))  
> **Source Version**: `073d2fba`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-27T15:27:13.282Z  
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
> **Harvest Timestamp**: 2026-11-27T15:27:13.100Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `momenbasel/PureMac`
- **Description**: Free, open-source macOS cleaner. CleanMyMac alternative with zero telemetry. Native SwiftUI, scheduled auto-cleaning, Xcode/Homebrew/system cache cleanup. MIT licensed.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7989 stars

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

### Core Architecture Module: `PureMac/Logic/Utilities/DevToolCaches.swift`
```
import Foundation

/// The "Dev Tool Caches" category: one row per cache root of a developer tool.
///
/// `roots` is the single GUI list. It mirrors the "Dev Tools" targets in
/// `cli/Sources/puremac/Core/Catalog.swift` (paths and `selectedByDefault`);
/// the deviations are listed in `docs/DEV-TOOL-CACHES.md`. Project-level
/// artifacts (`node_modules`, Rust `target`) are deliberately not here.
///
/// Every root is an exact directory. `CleaningEngine` removes only a path that
/// equals one of these roots, never a descendant and never a parent.
enum DevToolCaches {
    /// How a root is emptied. The tool's own CLI is preferred whenever the tool
    /// manages its cache (lock handling, read-only files).
    enum Removal: Equatable {
        /// Plain `FileManager.removeItem` on the root.
        case unlink
        /// Plain removal, refused while a Gradle daemon or build is running.
        case unlinkUnlessGradleRunning
        /// `uv cache clean --cache-dir <root>` when `uv` exists, else plain removal.
        case uvCacheClean
        /// `go clean -cache` when `go` exists, else plain removal.
        case goCleanCache
        /// `go clean -modcache` when `go` exists. Never removed without `go`:
        /// module files are read-only, so plain removal fails midway.
        case goCleanModcache
    }

    struct Root: Equatable {
        /// Stable identifier, also used by tests and docs.
        let id: String
        /// Localization key shown as the row name.
        let nameKey: String
        /// Path relative to the home directory.
        let relativePath: String
        var selectedByDefault = true
        var removal: Removal = .unlink

        func path(home: String) -> String {
            (home as NSString).appendingPathComponent(relativePath)
        }
    }

    // Order matches the scan order shown in the UI.
    static let roots: [Root] = [
        Root(id: "bun", nameKey: "Bun cache", relativePath: ".bun/install/cache"),
        Root(id: "uv-xdg", nameKey: "uv cache", relativePath: ".cache/uv", removal: .uvCacheClean),
        Root(id: "uv-library", nameKey: "uv cache", relativePath: "Library/Caches/uv", removal: .uvCacheClean),
        Root(id: "pip-library", nameKey: "pip cache", relativePath: "Library/Caches/pip"),
        Root(id: "pip-xdg", nameKey: "pip cache", relativePath: ".cache/pip"),
        Root(id: "poetry-library", nameKey: "Poetry cache", relativePath: "Library/Caches/pypoetry"),
        Root(id: "poetry-xdg", nameKey: "Poetry cache", relativePath: ".cache/pypoetry"),
        Root(id: "cocoapods", nameKey: "CocoaPods cache", relativePath: "Library/Caches/CocoaPods"),
        Root(id: "swiftpm", nameKey: "Swift Package Manager cache", relativePath: "Library/Caches/org.swift.swiftpm"),
        Root(id: "gradle-caches", nameKey: "Gradle caches", relativePath: ".gradle/caches", removal: .unlinkUnlessGradleRunning),
        Root(id: "gradle-wrapper", nameKey: "Gradle wrapper distributions", relativePath: ".gradle/wrapper/dists", removal: .unlinkUnlessGradleRunning),
        // Cargo: only these four. ~/.cargo/bin and ~/.cargo/config.toml are never touched.
        Root(id: "cargo-registry-cache", nameKey: "Cargo registry cache", relativePath: ".cargo/registry/cache"),
        Root(id: "cargo-registry-index", nameKey: "Cargo registry index", relativePath: ".cargo/registry/index"),
        Root(id: "cargo-git-db", nameKey: "Cargo git database", relativePath: ".cargo/git/db"),
        Root(id: "cargo-git-checkouts", nameKey: "Cargo git checkouts", relativePath: ".cargo/git/checkouts"),
        Root(id: "go-build", nameKey: "Go build cache", relativePath: "Library/Caches/go-build", removal: .goCleanCache),
        // The CLI lists go/pkg/mod/cache (the download subset). `go clean -modcache`
        // removes all of GOMODCACHE, so the GUI row and its size cover go/pkg/mod.
        Root(id: "go-modcache", nameKey: "Go module cache", relativePath: "go/pkg/mod", removal: .goCleanModcache),
        Root(id: "deno-library", nameKey: "Deno cache", relativePath: "Library/Caches/deno"),
        Root(id: "deno-xdg", nameKey: "Deno cache", relativePath: ".cache/deno"),
        // The CLI lists all of ~/.pub-cache. bin/ and global_packages/ hold
        // `dart pub global activate` tools, so only downloaded packages are listed.
        Root(id: "pub-hosted", nameKey: "Dart pub packages", relativePath: ".pub-cache/hosted"),
        Root(id: "pub-git", nameKey: "Dart pub git packages", relativePath: ".pub-cache/git"),
        Root(id: "playwright-library", nameKey: "Playwright browsers", relativePath: "Library/Caches/ms-playwright"),
        Root(id: "playwright-xdg", nameKey: "Playwright browsers", relativePath: ".cache/ms-playwright"),
        Root(id: "puppeteer", nameKey: "Puppeteer browsers", relativePath: ".cache/puppeteer"),
        Root(id: "node-gyp-library", nameKey: "node-gyp headers", relativePath: "Library/Caches/node-gyp"),
        Root(id: "node-gyp-xdg", nameKey: "node-gyp headers", relativePath: ".cache/node-gyp"),
        Root(id: "electron", nameKey: "Electron download cache", relativePath: "Library/Caches/electron"),
        Root(id: "electron-builder", nameKey: "Electron Builder cache", relativePath: "Library/Caches/electron-builder"),
        // Opt-in: these can hold things that are not re-downloadable.
        Root(id: "maven", nameKey: "Maven repository (may hold local installs)", relativePath: ".m2/repository", selectedByDefault: false),
        Root(id: "nuget-packages", nameKey: "NuGet packages (may hold local packages)", relativePath: ".nuget/packages", selectedByDefault: false),
        Root(id: "nuget-http", nameKey: "NuGet HTTP cache", relativePath: ".local/share/NuGet/http-cache", selectedByDefault: false),
    ]

    /// Directories searched for `uv` and `go`. The GUI app does not inherit the
    /// shell `PATH`.
    static func toolSearchDirectories(home: String) -> [String] {
        [
            "/opt/homebrew/bin",
            "/usr/local/bin",
            "/usr/local/go/bin",
            "\(home)/.local/bin",
            "\(home)/.cargo/bin",
        ]
    }

    /// Process command-line fragments that identify a live Gradle daemon,
    /// wrapper client or test worker.
    static let gradleProcessMarkers = [
        "GradleDaemon",
        "GradleWrapperMain",
        "GradleWorkerMain",
        "org.gradle.launcher.GradleMain",
    ]

    /// Absolute, standardized root paths for `home`.
    static func absolutePaths(home: String) -> [String] {
        roots.map { ($0.path(home: home) as NSString).standardizingPath }
    }

    static func contains(_ path: String, home: String) -> Bool {
        let normalized = (path as NSString).standardizingPath
        return absolutePaths(home: home).contains {
            normalized == $0 || normalized.hasPrefix($0 + "/")
        }
    }

    /// The root whose path equals `path` exactly (after standardizing), or nil.
    /// Descendants, parents and relative paths do not match.
    static func root(forPath path: String, home: String) -> Root? {
        guard path.hasPrefix("/"), !path.utf8.contains(0) else { return nil }
        let standardized = (path as NSString).standardizingPath
        guard standardized == path else { return nil }
        let normalizedHome = (home as NSString).standardizingPath
        return roots.first { ($0.path(home: normalizedHome) as NSString).standardizingPath == standardized }
    }

    /// True when `path` or any directory between `home` and `path` is a symbolic
    /// link. `lstat` semantics: the link itself is inspected, never followed.
    static func hasSymlinkBelowHome(_ path: String, home: String) -> Bool {
        let normalizedHome = (home as NSString).standardizingPath
        var current = (path as NSString).standardizingPath
        guard current.hasPrefix(normalizedHome + "/") else { return true }
        while current.count > normalizedHome.count {
            var info = stat()
            if lstat(current, &info) == 0, (info.st_mode & S_IFMT) == S_IFLNK { return true }
            current = (current as NSString).deletingLastPathComponent
        }
        return false
    }

    /// True when any entry of `commandLines` names a Gradle process.
    static func containsGradleProcess(_ commandLines: [String]) -> Bool {
        commandLines.contains { line in
            gradleProcessMarkers.contains { line.contains($0) }
        }
    }
}

/// Everything about the host that the dev tool cache scan and clean read:
/// where tools live, whether Gradle runs, how long a tool may take. Injected
/// by tests so no real `uv`, `go` or process list is ever consulted.
struct DevToolCacheEnvironment: Sendable {
    /// Directories searched for `uv` and `go`. Empty means "use the defaults for home".
    var searchDirectories: [String]?
    /// Command line of every running process, read-only. nil when the process
    /// list cannot be read; callers then treat Gradle as running.
    var processCommandLines: @Sendable () -> [String]?
    /// Upper bound for a single `uv` or `go` invocation.
    var commandTimeout: TimeInterval
    /// Test seam: runs with the root path after the clean's first checks and
    /// before the final symlink re-check that precedes a plain unlink. Lets a
    /// test swap the root for a symlink inside the race window.
    var beforeUnlinkRecheck: @Sendable (String) -> Void = { _ in }

    static let live = DevToolCacheEnvironment(
        searchDirectories: nil,
        processCommandLines: { DevToolCacheEnvironment.livePSCommandLines() },
        commandTimeout: 300
    )

    func isGradleRunning() -> Bool {
        guard let lines = processCommandLines() else { return true }
        return DevToolCaches.containsGradleProcess(lines)
    }

    func locate(_ tool: String, home: String, fileManager: FileManager = .default) -> String? {
        let directories = searchDirectories ?? DevToolCaches.toolSearchDirectories(home: home)
        for dir
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
        String(localized: "Xcode command-line tools not found — install Xcode or run xcode-select --install")

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
                let base = parts.isEmpty ? String(localized: "Simulator runtime") : parts.joined(separator: " ")
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
    private let devTools: DevToolCacheEnvironment

    init(
        homeDirectory: URL = FileManager.default.homeDirectoryForCurrentUser,
        devToolEnvironment: DevToolCacheEnvironment = .live
    ) {
        self.homeDirectory = XcodeBuildMCPDerivedDataSupport.canonicalHomeDirectory(homeDirectory)
        self.devTools = devToolEnvironment
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
        // Paths deliberately left alone because the owning tool is busy (uv
        // cache locked, Gradle running). The reason is in `errors`; unlike a
        // survivor, Full Disk Access cannot fix these, so they must not raise
        // the Grant Access prompt.
        var skippedPaths: Set<String> = []
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
                result.errors.append(String(localized: "Excluded from cleanup: \(item.name)"))
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

            if item.category == .devToolCaches {
                // Developer tool caches never take the generic unlink path:
                // each root is validated by exact match, and tools that manage
                // their own cache (uv, go) are cleaned through their CLI.
                let outcome = await cleanDevToolCache(item)
                result.freedSpace += outcome.freed
                if outcome.removed { result.itemsCleaned += 1 }
                if outcome.handled { result.cleanedPaths.insert(item.path) }
                if outcome.skipped { result.skippedPaths.insert(item.path) }
                if let error = outcome.error { result.errors.append(error) }
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

            if item.category == .rustTargets {
                // `cargo clean` rather than an unlink, as requested for Rust
                // projects: cargo knows its own layout and lock files.
                let cargoOutcome = await cargoClean(item)
                result.freedSpace += cargoOutcome.freed
                if cargoOutcome.cleaned {
                    result.itemsCleaned += 1
                    result.cleanedPaths.insert(item.path)
                }
                if let error = cargoOutcome.error {
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
                    let msg = String(localized: "Skipped symlink or unsafe path: \(item.path)")
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
                    let msg = String(localized: "Skipped symlink or unsafe path: \(item.path) -> \(resolved)")
                    Logger.shared.log(msg, level: .warning)
                    result.errors.append(msg)
                    continue
                }

                // Narrow the TOCTOU window: re-resolve right before the delete
                // and require the resolved path to still match. Any concurrent
                // swap between check and delete aborts the operation.
                let reResolved = itemURL.resolvingSymlinksInPath().path
                guard reResolved == resolved, !hasUnexpectedSymlink(in: item.path) else {
                    let msg = String(localized: "Aborting delete: path resolution changed between check and unlink for \(item.path)")
                    Logger.shared.log(msg, level: .warning)
                    result.errors.append(msg)
                    continue
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

### Incident Patch 1: `073d2fba` (2026-11-27)
**Commit Message**: chore: refresh star history

**File**: `assets/star-history-dark.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#21262d" stroke-width="1"/>
   <text x="52" y="62" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.55 366.85 L66.72 365.71 L72.18 364.59 L72.4 363.47 L72.77 362.33 L73.21 361.21 L73.55 360.1 L73.87 358.95 L74.45 357.83 L74.96 356.69 L75.63 355.57 L75.98 354.45 L76.17 353.31 L76.34 352.19 L76.54 351.07 L76.7 349.93 L76.83 348.81 L76.94 347.7 L77.04 346.55 L77.18 345.43 L77.3 344.32 L77.46 343.17 L77.64 342.05 L77.81 340.91 L77.9 339.79 L78.03 338.67 L78.12 337.53 L78.23 336.41 L78.32 335.3 L78.41 334.15 L78.53 333.03 L78.67 331.92 L78.81 330.77 L78.93 329.65 L79.09 328.54 L79.25 327.39 L79.52 326.27 L79.8 325.13 L80.24 324.01 L80.63 322.9 L81.1 321.75 L81.42 320.63 L81.71 319.52 L82.08 318.37 L82.32 317.25 L82.71 316.14 L83.74 314.99 L84.28 313.87 L84.47 312.76 L84.88 311.61 L85.33 310.5 L86.07 309.35 L86.61 308.23 L86.8 307.12 L86.98 305.97 L87.12 304.85 L87.23 303.74 L87.33 302.59 L87.48 301.47 L87.64 300.36 L87.77 299.21 L87.87 298.1 L88.06 296.98 L88.23 295.83 L88.42 294.72 L88.63 293.57 L88.9 292.45 L89.2 291.34 L89.6 290.19 L90.13 289.07 L90.49 287.96 L90.92 286.81 L91.48 285.7 L92.82 284.58 L93.93 283.43 L95.33 282.32 L96.19 281.2 L97.29 280.05 L98.82 278.94 L100.3 277.82 L101.99 276.67 L102.47 275.56 L103.04 274.41 L104.1 273.3 L104.73 272.18 L105.55 271.03 L106.42 269.92 L107.6 268.8 L109.91 267.65 L111.42 266.54 L113.36 265.42 L114.81 264.27 L116.2 263.16 L117.43 262.04 L119.53 260.9 L122.83 259.78 L125.93 258.63 L129.74 257.52 L133.91 256.4 L140.38 255.25 L143.69 254.14 L145.24 253.02 L146.07 251.87 L148.26 250.76 L150.69 249.64 L154.21 248.5 L155.11 247.38 L156.25 246.26 L157.31 245.12 L158.65 244 L159.6 242.85 L160.32 241.74 L161.55 240.62 L166.76 239.47 L170.32 238.36 L175.08 237.24 L180.23 236.1 L183.13 234.98 L186.61 233.86 L194.01 232.72 L199.95 231.6 L203.65 230.48 L207.79 229.34 L215.14 228.22 L223.89 227.07 L233.56 225.96 L242.19 224.84 L248.26 223.7 L257.89 222.58 L266.41 221.46 L275.75 220.32 L283.64 219.2 L292.17 218.08 L302.71 216.94 L304.22 215.82 L312.06 214.71 L320.41 213.56 L325.97 212.44 L338 211.3 L345.86 210.18 L353.91 209.06 L355.84 207.92 L357.53 206.8 L361.1 205.68 L364.14 204.54 L368.96 203.42 L376.42 202.31 L381.64 201.16 L390.33 200.04 L398.09 198.93 L402.34 197.78 L407.77 196.66 L414.69 195.55 L421.22 194.4 L426.63 193.28 L432.98 192.14 L441.73 191.02 L444.34 189.91 L447.64 188.76 L449.07 187.64 L449.77 186.53 L451.11 185.38 L454.77 184.26 L459.17 183.15 L464.5 182 L471.6 180.88 L478.03 179.77 L487.67 178.62 L497.08 177.51 L500.47 176.36 L501.69 175.24 L506.58 174.13 L514.45 172.98 L518.66 171.86 L523.22 170.75 L526.49 169.6 L529.37 168.48 L533.45 167.37 L539.3 166.22 L545.44 165.11 L548.21 163.99 L549.77 162.84 L552.82 161.73 L555.26 160.58 L560.2 159.46 L566.47 158.35 L572.78 157.2 L580.22 156.08 L585.02 154.97 L589.21 153.82 L594.24 152.7 L599.56 151.59 L604.71 150.44 L608.91 149.33 L615.46 148.21 L617.89 147.06 L621.69 145.95 L625.98 144.8 L630.28 143.68 L634.15 142.57 L637.82 141.42 L639.66 140.3 L644.06 139.19 L649.77 138.04 L655.04 136.93 L657.33 135.81 L661.5 134.66 L665.6 133.55 L670.98 132.43 L677.55 131.28 L684.88 130.17 L690.14 129.02 L695.96 127.91 L702.5 126.79 L709.34 125.64 L715.86 124.53 L721.1 123.41 L728.52 122.26 L736 121.15 L736 368 L62 368 Z" fill="url(#fill-starhistorydarksvg)"/>
-  <path d="M62 367.97 L65.55 366.85 L66.72 365.71 L72.18 364.59 L72.4 363.47 L72.77 362.33 L73.21 361.21 L73.55 360.1 L73.87 358.95 L74.45 357.83 L74.96 356.69 L75.63 355.57 L75.98 354.45 L76.17 353.31 L76.34 352.19 L76.54 351.07 L76.7 349.93 L76.83 348.81 L76.94 347.7 L77.04 346.55 L77.18 345.43 L77.3 344.32 L77.46 343.17 L77.64 342.05 L77.81 340.91 L77.9 339.79 L78.03 338.67 L78.12 337.53 L78.23 336.41 L78.32 335.3 L78.41 334.15 L78.53 333.03 L78.67 331.92 L78.81 330.77 L78.93 329.65 L79.09 328.54 L79.25 327.39 L79.52 326.27 L79.8 325.13 L80.24 324.01 L80.63 322.9 L81.1 321.75 L81.42 320.63 L81.71 319.52 L82.08 318.37 L82.32 317.25 L82.71 316.14 L83.74 314.99 L84.28 313.87 L84.47 312.76 L84.88 311.61 L85.33 310.5 L86.07 309.35 L86.61 308.23 L86.8 307.12 L86.98 305.97 L87.12 304.85 L87.23 303.74 L87.33 302.59 L87.48 301.47 L87.64 300.36 L87.77 299.21 L87.87 298.1 L88.06 296.98 L88.23 295.83 L88.42 294.72 L88.63 293.57 L88.9 292.45 L89.2 291.34 L89.6 290.19 L90.13 289.07 L90.49 287.96 L90.92 286.81 L91.48 285.7 L92.82 284.58 L93.93 283.43 L95.33 282.32 L96.19 281.2 L97.29 280.05 L98.82 278.94 L100.3 277.82 L101.99 276.67 L102.47 275.56 L103.04 274.41 L104.1 273.3 L104.73 272.18 L105.55 271.03 L106.42 269.92 L107.6 268.8 L109.91 267.65 L111.42 266.54 L113.36 265.42 L114.81 264.27 L116.2 263.16 L117.43 262.04 L119.53 260.9 L122.83 259.78 L125.93 258.63 L129.74 257.52 L133.91 256.4 L140.38 255.25 L143.69 254.14 L145.24 253.02 L146.07 251.87 L148.26 250.76 L150.69 249.64 L154.21 
```

**File**: `assets/star-history.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#e6eaef" stroke-width="1"/>
   <text x="52" y="62" fill="#59636e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.55 366.85 L66.72 365.71 L72.18 364.59 L72.4 363.47 L72.77 362.33 L73.21 361.21 L73.55 360.1 L73.87 358.95 L74.45 357.83 L74.96 356.69 L75.63 355.57 L75.98 354.45 L76.17 353.31 L76.34 352.19 L76.54 351.07 L76.7 349.93 L76.83 348.81 L76.94 347.7 L77.04 346.55 L77.18 345.43 L77.3 344.32 L77.46 343.17 L77.64 342.05 L77.81 340.91 L77.9 339.79 L78.03 338.67 L78.12 337.53 L78.23 336.41 L78.32 335.3 L78.41 334.15 L78.53 333.03 L78.67 331.92 L78.81 330.77 L78.93 329.65 L79.09 328.54 L79.25 327.39 L79.52 326.27 L79.8 325.13 L80.24 324.01 L80.63 322.9 L81.1 321.75 L81.42 320.63 L81.71 319.52 L82.08 318.37 L82.32 317.25 L82.71 316.14 L83.74 314.99 L84.28 313.87 L84.47 312.76 L84.88 311.61 L85.33 310.5 L86.07 309.35 L86.61 308.23 L86.8 307.12 L86.98 305.97 L87.12 304.85 L87.23 303.74 L87.33 302.59 L87.48 301.47 L87.64 300.36 L87.77 299.21 L87.87 298.1 L88.06 296.98 L88.23 295.83 L88.42 294.72 L88.63 293.57 L88.9 292.45 L89.2 291.34 L89.6 290.19 L90.13 289.07 L90.49 287.96 L90.92 286.81 L91.48 285.7 L92.82 284.58 L93.93 283.43 L95.33 282.32 L96.19 281.2 L97.29 280.05 L98.82 278.94 L100.3 277.82 L101.99 276.67 L102.47 275.56 L103.04 274.41 L104.1 273.3 L104.73 272.18 L105.55 271.03 L106.42 269.92 L107.6 268.8 L109.91 267.65 L111.42 266.54 L113.36 265.42 L114.81 264.27 L116.2 263.16 L117.43 262.04 L119.53 260.9 L122.83 259.78 L125.93 258.63 L129.74 257.52 L133.91 256.4 L140.38 255.25 L143.69 254.14 L145.24 253.02 L146.07 251.87 L148.26 250.76 L150.69 249.64 L154.21 248.5 L155.11 247.38 L156.25 246.26 L157.31 245.12 L158.65 244 L159.6 242.85 L160.32 241.74 L161.55 240.62 L166.76 239.47 L170.32 238.36 L175.08 237.24 L180.23 236.1 L183.13 234.98 L186.61 233.86 L194.01 232.72 L199.95 231.6 L203.65 230.48 L207.79 229.34 L215.14 228.22 L223.89 227.07 L233.56 225.96 L242.19 224.84 L248.26 223.7 L257.89 222.58 L266.41 221.46 L275.75 220.32 L283.64 219.2 L292.17 218.08 L302.71 216.94 L304.22 215.82 L312.06 214.71 L320.41 213.56 L325.97 212.44 L338 211.3 L345.86 210.18 L353.91 209.06 L355.84 207.92 L357.53 206.8 L361.1 205.68 L364.14 204.54 L368.96 203.42 L376.42 202.31 L381.64 201.16 L390.33 200.04 L398.09 198.93 L402.34 197.78 L407.77 196.66 L414.69 195.55 L421.22 194.4 L426.63 193.28 L432.98 192.14 L441.73 191.02 L444.34 189.91 L447.64 188.76 L449.07 187.64 L449.77 186.53 L451.11 185.38 L454.77 184.26 L459.17 183.15 L464.5 182 L471.6 180.88 L478.03 179.77 L487.67 178.62 L497.08 177.51 L500.47 176.36 L501.69 175.24 L506.58 174.13 L514.45 172.98 L518.66 171.86 L523.22 170.75 L526.49 169.6 L529.37 168.48 L533.45 167.37 L539.3 166.22 L545.44 165.11 L548.21 163.99 L549.77 162.84 L552.82 161.73 L555.26 160.58 L560.2 159.46 L566.47 158.35 L572.78 157.2 L580.22 156.08 L585.02 154.97 L589.21 153.82 L594.24 152.7 L599.56 151.59 L604.71 150.44 L608.91 149.33 L615.46 148.21 L617.89 147.06 L621.69 145.95 L625.98 144.8 L630.28 143.68 L634.15 142.57 L637.82 141.42 L639.66 140.3 L644.06 139.19 L649.77 138.04 L655.04 136.93 L657.33 135.81 L661.5 134.66 L665.6 133.55 L670.98 132.43 L677.55 131.28 L684.88 130.17 L690.14 129.02 L695.96 127.91 L702.5 126.79 L709.34 125.64 L715.86 124.53 L721.1 123.41 L728.52 122.26 L736 121.15 L736 368 L62 368 Z" fill="url(#fill-starhistorysvg)"/>
-  <path d="M62 367.97 L65.55 366.85 L66.72 365.71 L72.18 364.59 L72.4 363.47 L72.77 362.33 L73.21 361.21 L73.55 360.1 L73.87 358.95 L74.45 357.83 L74.96 356.69 L75.63 355.57 L75.98 354.45 L76.17 353.31 L76.34 352.19 L76.54 351.07 L76.7 349.93 L76.83 348.81 L76.94 347.7 L77.04 346.55 L77.18 345.43 L77.3 344.32 L77.46 343.17 L77.64 342.05 L77.81 340.91 L77.9 339.79 L78.03 338.67 L78.12 337.53 L78.23 336.41 L78.32 335.3 L78.41 334.15 L78.53 333.03 L78.67 331.92 L78.81 330.77 L78.93 329.65 L79.09 328.54 L79.25 327.39 L79.52 326.27 L79.8 325.13 L80.24 324.01 L80.63 322.9 L81.1 321.75 L81.42 320.63 L81.71 319.52 L82.08 318.37 L82.32 317.25 L82.71 316.14 L83.74 314.99 L84.28 313.87 L84.47 312.76 L84.88 311.61 L85.33 310.5 L86.07 309.35 L86.61 308.23 L86.8 307.12 L86.98 305.97 L87.12 304.85 L87.23 303.74 L87.33 302.59 L87.48 301.47 L87.64 300.36 L87.77 299.21 L87.87 298.1 L88.06 296.98 L88.23 295.83 L88.42 294.72 L88.63 293.57 L88.9 292.45 L89.2 291.34 L89.6 290.19 L90.13 289.07 L90.49 287.96 L90.92 286.81 L91.48 285.7 L92.82 284.58 L93.93 283.43 L95.33 282.32 L96.19 281.2 L97.29 280.05 L98.82 278.94 L100.3 277.82 L101.99 276.67 L102.47 275.56 L103.04 274.41 L104.1 273.3 L104.73 272.18 L105.55 271.03 L106.42 269.92 L107.6 268.8 L109.91 267.65 L111.42 266.54 L113.36 265.42 L114.81 264.27 L116.2 263.16 L117.43 262.04 L119.53 260.9 L122.83 259.78 L125.93 258.63 L129.74 257.52 L133.91 256.4 L140.38 255.25 L143.69 254.14 L145.24 253.02 L146.07 251.87 L148.26 250.76 L150.69 249.64 L154.21 248.
```

---

### Incident Patch 2: `e6fa1ce3` (2026-11-27)
**Commit Message**: docs: link PureFence, the renamed PureSnitch

**File**: `docs/index.html` (modified, +1/-1)
```diff
@@ -96,6 +96,6 @@
 <details><summary>Where can I get help or report a problem?</summary><p>Read the <a href="https://github.com/momenbasel/PureMac#troubleshooting">troubleshooting guide</a> or <a href="https://github.com/momenbasel/PureMac/issues">open an issue</a>. Review logs and screenshots for personal file paths before posting them publicly.</p></details>
 </div></section>
 </main>
-<footer class="wrap footer"><div><a class="brand" href="./"><img src="assets/icon.png" width="32" height="32" alt=""><span>PureMac</span></a><p>Mac care, open source.</p></div><nav aria-label="Project links"><a href="https://github.com/momenbasel/PureMac">Source</a><a href="https://github.com/momenbasel/PureMac/releases">Releases</a><a href="privacy.html">Privacy</a></nav><nav aria-label="More Mac apps"><span>More Mac apps</span><a href="https://www.moamenbasel.com/puresnitch/">PureSnitch</a><a href="https://www.moamenbasel.com/pesty/">Pesty</a><a href="https://www.moamenbasel.com/Phosphor/">Phosphor</a></nav></footer>
+<footer class="wrap footer"><div><a class="brand" href="./"><img src="assets/icon.png" width="32" height="32" alt=""><span>PureMac</span></a><p>Mac care, open source.</p></div><nav aria-label="Project links"><a href="https://github.com/momenbasel/PureMac">Source</a><a href="https://github.com/momenbasel/PureMac/releases">Releases</a><a href="privacy.html">Privacy</a></nav><nav aria-label="More Mac apps"><span>More Mac apps</span><a href="https://www.moamenbasel.com/purefence/">PureFence</a><a href="https://www.moamenbasel.com/pesty/">Pesty</a><a href="https://www.moamenbasel.com/Phosphor/">Phosphor</a></nav></footer>
 </body>
 </html>
```

#### Recent Merged Pull Requests:
- **PR #210** (2026-11-19): Translate the new cleanup keys and announce sidebar section state (@momenbasel)
- **PR #209** (2026-11-19): Land the developer cleanup and sidebar PRs (@momenbasel)
- **PR #208** (2026-11-19): Complete the French translation and add 101 missing keys (@Shirowwww)
- **PR #206** (2026-11-19): l10n: complete Japanese (ja) translations (@sogapiano)
- **PR #205** (closed): Complete Russian localization (@xamelion)
- **PR #204** (closed): Add Korean localization (@noolldeman)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
