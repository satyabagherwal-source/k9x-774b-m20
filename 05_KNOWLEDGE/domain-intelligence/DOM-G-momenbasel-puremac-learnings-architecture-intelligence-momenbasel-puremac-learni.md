# Domain G — Architecture Intelligence: Architecture Intelligence: momenbasel-puremac-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "momenbasel-puremac-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T06:03:41.484Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-momenbasel-puremac-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [momenbasel-puremac-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T06:03:41.484Z`  
> **Learning ID**: `LEARN-EVO-momenbasel-puremac-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), D (Research & Knowledge Intelligence), A (Human & Need Intelligence), M (Feedback & Evolution Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), L (Deployment & Operations Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 57%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from momenbasel-puremac-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/momenbasel-puremac-learnings.md`  
> **Source**: github ([https://github.com/momenbasel/PureMac](https://github.com/momenbasel/PureMac))  
> **Source Version**: `878316e2`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-25T06:03:04.209Z  
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
> **Harvest Timestamp**: 2026-11-25T06:03:04.205Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `momenbasel/PureMac`
- **Description**: Free, open-source macOS cleaner. CleanMyMac alternative with zero telemetry. Native SwiftUI, scheduled auto-cleaning, Xcode/Homebrew/system cache cleanup. MIT licensed.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7950 stars

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

### Incident Patch 1: `878316e2` (2026-11-25)
**Commit Message**: chore: refresh star history

**File**: `assets/star-history-dark.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#21262d" stroke-width="1"/>
   <text x="52" y="62" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.58 366.85 L66.75 365.74 L72.28 364.59 L72.51 363.47 L72.87 362.36 L73.31 361.24 L73.67 360.1 L73.99 358.98 L74.57 357.86 L75.09 356.75 L75.77 355.63 L76.1 354.48 L76.31 353.37 L76.49 352.25 L76.68 351.14 L76.85 349.99 L76.98 348.87 L77.09 347.76 L77.18 346.64 L77.33 345.53 L77.45 344.38 L77.6 343.26 L77.79 342.15 L77.96 341.03 L78.05 339.91 L78.19 338.77 L78.28 337.65 L78.39 336.54 L78.49 335.42 L78.57 334.27 L78.69 333.16 L78.8 332.04 L78.98 330.92 L79.09 329.81 L79.24 328.66 L79.41 327.55 L79.67 326.43 L79.94 325.31 L80.35 324.17 L80.78 323.05 L81.17 321.93 L81.58 320.82 L81.86 319.7 L82.25 318.56 L82.51 317.44 L82.81 316.32 L83.79 315.21 L84.47 314.06 L84.68 312.94 L84.98 311.83 L85.47 310.71 L86.13 309.6 L86.79 308.45 L87.04 307.33 L87.22 306.22 L87.35 305.1 L87.46 303.99 L87.55 302.84 L87.72 301.72 L87.87 300.61 L88 299.49 L88.11 298.34 L88.26 297.23 L88.44 296.11 L88.61 295 L88.84 293.88 L89.13 292.73 L89.33 291.62 L89.78 290.5 L90.28 289.38 L90.7 288.24 L91.08 287.12 L91.58 286.01 L92.54 284.89 L94.04 283.77 L95.45 282.63 L96.28 281.51 L97.22 280.39 L99.01 279.28 L100.3 278.13 L102.27 277.02 L102.66 275.9 L103.19 274.78 L104.34 273.67 L104.95 272.52 L105.84 271.4 L106.5 270.29 L107.62 269.17 L109.38 268.02 L111.73 266.91 L113.27 265.79 L114.66 264.68 L116.33 263.56 L117.34 262.41 L119.67 261.3 L122.57 260.18 L125.65 259.07 L129.44 257.95 L133.28 256.8 L138.36 255.69 L143.52 254.57 L145.84 253.46 L146.53 252.31 L148.64 251.19 L150.17 250.08 L153.07 248.96 L155.89 247.84 L156.85 246.7 L157.81 245.58 L158.89 244.46 L160.13 243.35 L161.1 242.2 L161.87 241.09 L165.5 239.97 L170.14 238.85 L173.93 237.74 L179.35 236.59 L183.29 235.48 L185.74 234.36 L192.88 233.24 L197.49 232.1 L203.99 230.98 L206.97 229.86 L212.33 228.75 L221.04 227.63 L231.02 226.49 L240.72 225.37 L247.25 224.25 L253.66 223.14 L264.16 222.02 L271.89 220.87 L282.1 219.76 L290.66 218.64 L299.65 217.53 L305.9 216.38 L309.97 215.26 L320.14 214.15 L326.48 213.03 L332.82 211.92 L344.39 210.77 L352.46 209.65 L358.32 208.54 L359.52 207.42 L362.33 206.27 L365.08 205.16 L368.69 204.04 L375.86 202.93 L381.74 201.81 L388.96 200.66 L396.2 199.55 L405.24 198.43 L408.11 197.31 L414.53 196.17 L420.3 195.05 L426.62 193.94 L432.5 192.82 L440.35 191.7 L446.77 190.56 L449.43 189.44 L452.5 188.32 L453.36 187.21 L454.46 186.06 L455.48 184.95 L460.9 183.83 L465.38 182.71 L471.16 181.6 L478.08 180.45 L486.77 179.33 L494.41 178.22 L503.45 177.1 L505.21 175.99 L508.66 174.84 L513.92 173.72 L520.48 172.61 L526.02 171.49 L528.82 170.34 L532.17 169.23 L535.24 168.11 L540.48 167 L546.66 165.88 L552.65 164.73 L553.53 163.62 L555.51 162.5 L558.51 161.39 L561.19 160.24 L567.55 159.12 L572.86 158.01 L580.77 156.89 L587.06 155.77 L592.3 154.63 L596.24 153.51 L601.77 152.4 L607.27 151.28 L611.46 150.13 L616.04 149.02 L621.91 147.9 L624.95 146.78 L628.98 145.67 L632.59 144.52 L637.06 143.41 L641.02 142.29 L643.88 141.17 L646.53 140.06 L651.66 138.91 L656.9 137.79 L661.76 136.68 L664.14 135.56 L668.85 134.42 L672.71 133.3 L678.57 132.18 L685.35 131.07 L693.21 129.95 L698.25 128.8 L703.73 127.69 L710.59 126.57 L717.4 125.46 L723.3 124.31 L728.7 123.19 L736 122.08 L736 368 L62 368 Z" fill="url(#fill-starhistorydarksvg)"/>
-  <path d="M62 367.97 L65.58 366.85 L66.75 365.74 L72.28 364.59 L72.51 363.47 L72.87 362.36 L73.31 361.24 L73.67 360.1 L73.99 358.98 L74.57 357.86 L75.09 356.75 L75.77 355.63 L76.1 354.48 L76.31 353.37 L76.49 352.25 L76.68 351.14 L76.85 349.99 L76.98 348.87 L77.09 347.76 L77.18 346.64 L77.33 345.53 L77.45 344.38 L77.6 343.26 L77.79 342.15 L77.96 341.03 L78.05 339.91 L78.19 338.77 L78.28 337.65 L78.39 336.54 L78.49 335.42 L78.57 334.27 L78.69 333.16 L78.8 332.04 L78.98 330.92 L79.09 329.81 L79.24 328.66 L79.41 327.55 L79.67 326.43 L79.94 325.31 L80.35 324.17 L80.78 323.05 L81.17 321.93 L81.58 320.82 L81.86 319.7 L82.25 318.56 L82.51 317.44 L82.81 316.32 L83.79 315.21 L84.47 314.06 L84.68 312.94 L84.98 311.83 L85.47 310.71 L86.13 309.6 L86.79 308.45 L87.04 307.33 L87.22 306.22 L87.35 305.1 L87.46 303.99 L87.55 302.84 L87.72 301.72 L87.87 300.61 L88 299.49 L88.11 298.34 L88.26 297.23 L88.44 296.11 L88.61 295 L88.84 293.88 L89.13 292.73 L89.33 291.62 L89.78 290.5 L90.28 289.38 L90.7 288.24 L91.08 287.12 L91.58 286.01 L92.54 284.89 L94.04 283.77 L95.45 282.63 L96.28 281.51 L97.22 280.39 L99.01 279.28 L100.3 278.13 L102.27 277.02 L102.66 275.9 L103.19 274.78 L104.34 273.67 L104.95 272.52 L105.84 271.4 L106.5 270.29 L107.62 269.17 L109.38 268.02 L111.73 266.91 L113.27 265.79 L114.66 264.68 L116.33 263.56 L117.34 262.41 L119.67 261.3 L122.57 260.18 L125.65 259.07 L129.44 257.95 L133.28 256.8 L138.36 255.69 L143.52 254.57 L145.84 253.46 L146.53 252.31 L148.64 251.19 L150.17 2
```

**File**: `assets/star-history.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#e6eaef" stroke-width="1"/>
   <text x="52" y="62" fill="#59636e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.58 366.85 L66.75 365.74 L72.28 364.59 L72.51 363.47 L72.87 362.36 L73.31 361.24 L73.67 360.1 L73.99 358.98 L74.57 357.86 L75.09 356.75 L75.77 355.63 L76.1 354.48 L76.31 353.37 L76.49 352.25 L76.68 351.14 L76.85 349.99 L76.98 348.87 L77.09 347.76 L77.18 346.64 L77.33 345.53 L77.45 344.38 L77.6 343.26 L77.79 342.15 L77.96 341.03 L78.05 339.91 L78.19 338.77 L78.28 337.65 L78.39 336.54 L78.49 335.42 L78.57 334.27 L78.69 333.16 L78.8 332.04 L78.98 330.92 L79.09 329.81 L79.24 328.66 L79.41 327.55 L79.67 326.43 L79.94 325.31 L80.35 324.17 L80.78 323.05 L81.17 321.93 L81.58 320.82 L81.86 319.7 L82.25 318.56 L82.51 317.44 L82.81 316.32 L83.79 315.21 L84.47 314.06 L84.68 312.94 L84.98 311.83 L85.47 310.71 L86.13 309.6 L86.79 308.45 L87.04 307.33 L87.22 306.22 L87.35 305.1 L87.46 303.99 L87.55 302.84 L87.72 301.72 L87.87 300.61 L88 299.49 L88.11 298.34 L88.26 297.23 L88.44 296.11 L88.61 295 L88.84 293.88 L89.13 292.73 L89.33 291.62 L89.78 290.5 L90.28 289.38 L90.7 288.24 L91.08 287.12 L91.58 286.01 L92.54 284.89 L94.04 283.77 L95.45 282.63 L96.28 281.51 L97.22 280.39 L99.01 279.28 L100.3 278.13 L102.27 277.02 L102.66 275.9 L103.19 274.78 L104.34 273.67 L104.95 272.52 L105.84 271.4 L106.5 270.29 L107.62 269.17 L109.38 268.02 L111.73 266.91 L113.27 265.79 L114.66 264.68 L116.33 263.56 L117.34 262.41 L119.67 261.3 L122.57 260.18 L125.65 259.07 L129.44 257.95 L133.28 256.8 L138.36 255.69 L143.52 254.57 L145.84 253.46 L146.53 252.31 L148.64 251.19 L150.17 250.08 L153.07 248.96 L155.89 247.84 L156.85 246.7 L157.81 245.58 L158.89 244.46 L160.13 243.35 L161.1 242.2 L161.87 241.09 L165.5 239.97 L170.14 238.85 L173.93 237.74 L179.35 236.59 L183.29 235.48 L185.74 234.36 L192.88 233.24 L197.49 232.1 L203.99 230.98 L206.97 229.86 L212.33 228.75 L221.04 227.63 L231.02 226.49 L240.72 225.37 L247.25 224.25 L253.66 223.14 L264.16 222.02 L271.89 220.87 L282.1 219.76 L290.66 218.64 L299.65 217.53 L305.9 216.38 L309.97 215.26 L320.14 214.15 L326.48 213.03 L332.82 211.92 L344.39 210.77 L352.46 209.65 L358.32 208.54 L359.52 207.42 L362.33 206.27 L365.08 205.16 L368.69 204.04 L375.86 202.93 L381.74 201.81 L388.96 200.66 L396.2 199.55 L405.24 198.43 L408.11 197.31 L414.53 196.17 L420.3 195.05 L426.62 193.94 L432.5 192.82 L440.35 191.7 L446.77 190.56 L449.43 189.44 L452.5 188.32 L453.36 187.21 L454.46 186.06 L455.48 184.95 L460.9 183.83 L465.38 182.71 L471.16 181.6 L478.08 180.45 L486.77 179.33 L494.41 178.22 L503.45 177.1 L505.21 175.99 L508.66 174.84 L513.92 173.72 L520.48 172.61 L526.02 171.49 L528.82 170.34 L532.17 169.23 L535.24 168.11 L540.48 167 L546.66 165.88 L552.65 164.73 L553.53 163.62 L555.51 162.5 L558.51 161.39 L561.19 160.24 L567.55 159.12 L572.86 158.01 L580.77 156.89 L587.06 155.77 L592.3 154.63 L596.24 153.51 L601.77 152.4 L607.27 151.28 L611.46 150.13 L616.04 149.02 L621.91 147.9 L624.95 146.78 L628.98 145.67 L632.59 144.52 L637.06 143.41 L641.02 142.29 L643.88 141.17 L646.53 140.06 L651.66 138.91 L656.9 137.79 L661.76 136.68 L664.14 135.56 L668.85 134.42 L672.71 133.3 L678.57 132.18 L685.35 131.07 L693.21 129.95 L698.25 128.8 L703.73 127.69 L710.59 126.57 L717.4 125.46 L723.3 124.31 L728.7 123.19 L736 122.08 L736 368 L62 368 Z" fill="url(#fill-starhistorysvg)"/>
-  <path d="M62 367.97 L65.58 366.85 L66.75 365.74 L72.28 364.59 L72.51 363.47 L72.87 362.36 L73.31 361.24 L73.67 360.1 L73.99 358.98 L74.57 357.86 L75.09 356.75 L75.77 355.63 L76.1 354.48 L76.31 353.37 L76.49 352.25 L76.68 351.14 L76.85 349.99 L76.98 348.87 L77.09 347.76 L77.18 346.64 L77.33 345.53 L77.45 344.38 L77.6 343.26 L77.79 342.15 L77.96 341.03 L78.05 339.91 L78.19 338.77 L78.28 337.65 L78.39 336.54 L78.49 335.42 L78.57 334.27 L78.69 333.16 L78.8 332.04 L78.98 330.92 L79.09 329.81 L79.24 328.66 L79.41 327.55 L79.67 326.43 L79.94 325.31 L80.35 324.17 L80.78 323.05 L81.17 321.93 L81.58 320.82 L81.86 319.7 L82.25 318.56 L82.51 317.44 L82.81 316.32 L83.79 315.21 L84.47 314.06 L84.68 312.94 L84.98 311.83 L85.47 310.71 L86.13 309.6 L86.79 308.45 L87.04 307.33 L87.22 306.22 L87.35 305.1 L87.46 303.99 L87.55 302.84 L87.72 301.72 L87.87 300.61 L88 299.49 L88.11 298.34 L88.26 297.23 L88.44 296.11 L88.61 295 L88.84 293.88 L89.13 292.73 L89.33 291.62 L89.78 290.5 L90.28 289.38 L90.7 288.24 L91.08 287.12 L91.58 286.01 L92.54 284.89 L94.04 283.77 L95.45 282.63 L96.28 281.51 L97.22 280.39 L99.01 279.28 L100.3 278.13 L102.27 277.02 L102.66 275.9 L103.19 274.78 L104.34 273.67 L104.95 272.52 L105.84 271.4 L106.5 270.29 L107.62 269.17 L109.38 268.02 L111.73 266.91 L113.27 265.79 L114.66 264.68 L116.33 263.56 L117.34 262.41 L119.67 261.3 L122.57 260.18 L125.65 259.07 L129.44 257.95 L133.28 256.8 L138.36 255.69 L143.52 254.57 L145.84 253.46 L146.53 252.31 L148.64 251.19 L150.17 250.0
```

---

### Incident Patch 2: `4568ccc0` (2026-11-24)
**Commit Message**: chore: refresh star history

**File**: `assets/star-history-dark.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#21262d" stroke-width="1"/>
   <text x="52" y="62" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.59 366.85 L66.76 365.74 L72.31 364.62 L72.54 363.47 L72.9 362.36 L73.34 361.24 L73.7 360.13 L74 359.01 L74.58 357.89 L75.13 356.75 L75.81 355.63 L76.13 354.52 L76.34 353.4 L76.53 352.28 L76.72 351.17 L76.89 350.02 L77.02 348.9 L77.13 347.79 L77.23 346.67 L77.37 345.56 L77.49 344.44 L77.65 343.29 L77.83 342.18 L78 341.06 L78.1 339.95 L78.23 338.83 L78.33 337.71 L78.44 336.57 L78.53 335.45 L78.62 334.33 L78.73 333.22 L78.85 332.1 L79.02 330.99 L79.14 329.84 L79.3 328.72 L79.44 327.61 L79.68 326.49 L79.98 325.38 L80.36 324.26 L80.81 323.11 L81.22 322 L81.62 320.88 L81.92 319.76 L82.27 318.65 L82.56 317.53 L82.86 316.39 L83.79 315.27 L84.45 314.15 L84.72 313.04 L85.02 311.92 L85.52 310.81 L86.15 309.66 L86.84 308.54 L87.08 307.43 L87.28 306.31 L87.42 305.19 L87.52 304.08 L87.62 302.93 L87.79 301.82 L87.93 300.7 L88.07 299.58 L88.17 298.47 L88.33 297.35 L88.52 296.2 L88.68 295.09 L88.9 293.97 L89.17 292.86 L89.39 291.74 L89.83 290.62 L90.31 289.48 L90.76 288.36 L91.12 287.25 L91.55 286.13 L92.57 285.01 L93.96 283.9 L95.41 282.78 L96.37 281.63 L97.3 280.52 L98.88 279.4 L100.31 278.29 L102.13 277.17 L102.68 276.05 L103.22 274.91 L104.35 273.79 L105.03 272.68 L105.91 271.56 L106.41 270.44 L107.66 269.33 L109.11 268.18 L111.71 267.06 L113 265.95 L114.68 264.83 L116.45 263.72 L117.31 262.6 L119.7 261.45 L122.57 260.34 L125.47 259.22 L129.51 258.11 L132.52 256.99 L137.9 255.87 L143.25 254.73 L146.07 253.61 L146.71 252.49 L148.26 251.38 L149.93 250.26 L152.98 249.15 L156.03 248 L156.96 246.88 L157.97 245.77 L158.99 244.65 L160.24 243.54 L161.17 242.42 L162.05 241.27 L164.97 240.16 L170.11 239.04 L173.81 237.92 L178.31 236.81 L183.07 235.69 L185.76 234.55 L192.54 233.43 L197.01 232.31 L203.98 231.2 L206.25 230.08 L211.43 228.97 L220.3 227.82 L229.41 226.7 L239.35 225.59 L247.12 224.47 L252.8 223.35 L263.07 222.24 L271.34 221.09 L280.74 219.98 L289.76 218.86 L299 217.74 L306.33 216.63 L308.43 215.51 L318.76 214.36 L325.78 213.25 L331.23 212.13 L343.71 211.02 L351 209.9 L359.06 208.78 L360.17 207.64 L362.51 206.52 L365.63 205.41 L368.93 204.29 L374.76 203.17 L381.78 202.06 L387.15 200.94 L395.48 199.79 L404.2 198.68 L407.94 197.56 L413.7 196.45 L420.02 195.33 L426.54 194.21 L432.72 193.07 L439.41 191.95 L447.7 190.84 L450.19 189.72 L453.32 188.6 L454.34 187.49 L455.19 186.34 L456.46 185.22 L460.58 184.11 L465.47 182.99 L470.48 181.88 L477.68 180.76 L486.31 179.61 L494.07 178.5 L503.99 177.38 L506.43 176.27 L508.5 175.15 L513.02 174.03 L520.93 172.89 L525.4 171.77 L529.77 170.65 L532.88 169.54 L535.71 168.42 L540.32 167.31 L546 166.16 L552.32 165.04 L554.73 163.93 L556.32 162.81 L559.45 161.7 L561.86 160.58 L567.05 159.43 L573.57 158.32 L579.61 157.2 L587.15 156.08 L592.02 154.97 L596.11 153.85 L601.36 152.7 L606.75 151.59 L611.89 150.47 L616.03 149.36 L622.86 148.24 L625.12 147.13 L628.99 145.98 L633.31 144.86 L637.74 143.75 L641.38 142.63 L645.48 141.51 L646.6 140.4 L651.54 139.25 L657.23 138.14 L662.89 137.02 L665.05 135.9 L669.41 134.79 L673.06 133.67 L678.52 132.52 L684.54 131.41 L691.51 130.29 L697.85 129.18 L703.95 128.06 L710.55 126.94 L716.97 125.8 L723.76 124.68 L728.56 123.57 L736 122.45 L736 368 L62 368 Z" fill="url(#fill-starhistorydarksvg)"/>
-  <path d="M62 367.97 L65.59 366.85 L66.76 365.74 L72.31 364.62 L72.54 363.47 L72.9 362.36 L73.34 361.24 L73.7 360.13 L74 359.01 L74.58 357.89 L75.13 356.75 L75.81 355.63 L76.13 354.52 L76.34 353.4 L76.53 352.28 L76.72 351.17 L76.89 350.02 L77.02 348.9 L77.13 347.79 L77.23 346.67 L77.37 345.56 L77.49 344.44 L77.65 343.29 L77.83 342.18 L78 341.06 L78.1 339.95 L78.23 338.83 L78.33 337.71 L78.44 336.57 L78.53 335.45 L78.62 334.33 L78.73 333.22 L78.85 332.1 L79.02 330.99 L79.14 329.84 L79.3 328.72 L79.44 327.61 L79.68 326.49 L79.98 325.38 L80.36 324.26 L80.81 323.11 L81.22 322 L81.62 320.88 L81.92 319.76 L82.27 318.65 L82.56 317.53 L82.86 316.39 L83.79 315.27 L84.45 314.15 L84.72 313.04 L85.02 311.92 L85.52 310.81 L86.15 309.66 L86.84 308.54 L87.08 307.43 L87.28 306.31 L87.42 305.19 L87.52 304.08 L87.62 302.93 L87.79 301.82 L87.93 300.7 L88.07 299.58 L88.17 298.47 L88.33 297.35 L88.52 296.2 L88.68 295.09 L88.9 293.97 L89.17 292.86 L89.39 291.74 L89.83 290.62 L90.31 289.48 L90.76 288.36 L91.12 287.25 L91.55 286.13 L92.57 285.01 L93.96 283.9 L95.41 282.78 L96.37 281.63 L97.3 280.52 L98.88 279.4 L100.31 278.29 L102.13 277.17 L102.68 276.05 L103.22 274.91 L104.35 273.79 L105.03 272.68 L105.91 271.56 L106.41 270.44 L107.66 269.33 L109.11 268.18 L111.71 267.06 L113 265.95 L114.68 264.83 L116.45 263.72 L117.31 262.6 L119.7 261.45 L122.57 260.34 L125.47 259.22 L129.51 258.11 L132.52 256.99 L137.9 255.87 L143.25 254.73 L146.07 253.61 L146.71 252.49 L148.26 251.38 L149.93 250.26 L152.98 249
```

**File**: `assets/star-history.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#e6eaef" stroke-width="1"/>
   <text x="52" y="62" fill="#59636e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.59 366.85 L66.76 365.74 L72.31 364.62 L72.54 363.47 L72.9 362.36 L73.34 361.24 L73.7 360.13 L74 359.01 L74.58 357.89 L75.13 356.75 L75.81 355.63 L76.13 354.52 L76.34 353.4 L76.53 352.28 L76.72 351.17 L76.89 350.02 L77.02 348.9 L77.13 347.79 L77.23 346.67 L77.37 345.56 L77.49 344.44 L77.65 343.29 L77.83 342.18 L78 341.06 L78.1 339.95 L78.23 338.83 L78.33 337.71 L78.44 336.57 L78.53 335.45 L78.62 334.33 L78.73 333.22 L78.85 332.1 L79.02 330.99 L79.14 329.84 L79.3 328.72 L79.44 327.61 L79.68 326.49 L79.98 325.38 L80.36 324.26 L80.81 323.11 L81.22 322 L81.62 320.88 L81.92 319.76 L82.27 318.65 L82.56 317.53 L82.86 316.39 L83.79 315.27 L84.45 314.15 L84.72 313.04 L85.02 311.92 L85.52 310.81 L86.15 309.66 L86.84 308.54 L87.08 307.43 L87.28 306.31 L87.42 305.19 L87.52 304.08 L87.62 302.93 L87.79 301.82 L87.93 300.7 L88.07 299.58 L88.17 298.47 L88.33 297.35 L88.52 296.2 L88.68 295.09 L88.9 293.97 L89.17 292.86 L89.39 291.74 L89.83 290.62 L90.31 289.48 L90.76 288.36 L91.12 287.25 L91.55 286.13 L92.57 285.01 L93.96 283.9 L95.41 282.78 L96.37 281.63 L97.3 280.52 L98.88 279.4 L100.31 278.29 L102.13 277.17 L102.68 276.05 L103.22 274.91 L104.35 273.79 L105.03 272.68 L105.91 271.56 L106.41 270.44 L107.66 269.33 L109.11 268.18 L111.71 267.06 L113 265.95 L114.68 264.83 L116.45 263.72 L117.31 262.6 L119.7 261.45 L122.57 260.34 L125.47 259.22 L129.51 258.11 L132.52 256.99 L137.9 255.87 L143.25 254.73 L146.07 253.61 L146.71 252.49 L148.26 251.38 L149.93 250.26 L152.98 249.15 L156.03 248 L156.96 246.88 L157.97 245.77 L158.99 244.65 L160.24 243.54 L161.17 242.42 L162.05 241.27 L164.97 240.16 L170.11 239.04 L173.81 237.92 L178.31 236.81 L183.07 235.69 L185.76 234.55 L192.54 233.43 L197.01 232.31 L203.98 231.2 L206.25 230.08 L211.43 228.97 L220.3 227.82 L229.41 226.7 L239.35 225.59 L247.12 224.47 L252.8 223.35 L263.07 222.24 L271.34 221.09 L280.74 219.98 L289.76 218.86 L299 217.74 L306.33 216.63 L308.43 215.51 L318.76 214.36 L325.78 213.25 L331.23 212.13 L343.71 211.02 L351 209.9 L359.06 208.78 L360.17 207.64 L362.51 206.52 L365.63 205.41 L368.93 204.29 L374.76 203.17 L381.78 202.06 L387.15 200.94 L395.48 199.79 L404.2 198.68 L407.94 197.56 L413.7 196.45 L420.02 195.33 L426.54 194.21 L432.72 193.07 L439.41 191.95 L447.7 190.84 L450.19 189.72 L453.32 188.6 L454.34 187.49 L455.19 186.34 L456.46 185.22 L460.58 184.11 L465.47 182.99 L470.48 181.88 L477.68 180.76 L486.31 179.61 L494.07 178.5 L503.99 177.38 L506.43 176.27 L508.5 175.15 L513.02 174.03 L520.93 172.89 L525.4 171.77 L529.77 170.65 L532.88 169.54 L535.71 168.42 L540.32 167.31 L546 166.16 L552.32 165.04 L554.73 163.93 L556.32 162.81 L559.45 161.7 L561.86 160.58 L567.05 159.43 L573.57 158.32 L579.61 157.2 L587.15 156.08 L592.02 154.97 L596.11 153.85 L601.36 152.7 L606.75 151.59 L611.89 150.47 L616.03 149.36 L622.86 148.24 L625.12 147.13 L628.99 145.98 L633.31 144.86 L637.74 143.75 L641.38 142.63 L645.48 141.51 L646.6 140.4 L651.54 139.25 L657.23 138.14 L662.89 137.02 L665.05 135.9 L669.41 134.79 L673.06 133.67 L678.52 132.52 L684.54 131.41 L691.51 130.29 L697.85 129.18 L703.95 128.06 L710.55 126.94 L716.97 125.8 L723.76 124.68 L728.56 123.57 L736 122.45 L736 368 L62 368 Z" fill="url(#fill-starhistorysvg)"/>
-  <path d="M62 367.97 L65.59 366.85 L66.76 365.74 L72.31 364.62 L72.54 363.47 L72.9 362.36 L73.34 361.24 L73.7 360.13 L74 359.01 L74.58 357.89 L75.13 356.75 L75.81 355.63 L76.13 354.52 L76.34 353.4 L76.53 352.28 L76.72 351.17 L76.89 350.02 L77.02 348.9 L77.13 347.79 L77.23 346.67 L77.37 345.56 L77.49 344.44 L77.65 343.29 L77.83 342.18 L78 341.06 L78.1 339.95 L78.23 338.83 L78.33 337.71 L78.44 336.57 L78.53 335.45 L78.62 334.33 L78.73 333.22 L78.85 332.1 L79.02 330.99 L79.14 329.84 L79.3 328.72 L79.44 327.61 L79.68 326.49 L79.98 325.38 L80.36 324.26 L80.81 323.11 L81.22 322 L81.62 320.88 L81.92 319.76 L82.27 318.65 L82.56 317.53 L82.86 316.39 L83.79 315.27 L84.45 314.15 L84.72 313.04 L85.02 311.92 L85.52 310.81 L86.15 309.66 L86.84 308.54 L87.08 307.43 L87.28 306.31 L87.42 305.19 L87.52 304.08 L87.62 302.93 L87.79 301.82 L87.93 300.7 L88.07 299.58 L88.17 298.47 L88.33 297.35 L88.52 296.2 L88.68 295.09 L88.9 293.97 L89.17 292.86 L89.39 291.74 L89.83 290.62 L90.31 289.48 L90.76 288.36 L91.12 287.25 L91.55 286.13 L92.57 285.01 L93.96 283.9 L95.41 282.78 L96.37 281.63 L97.3 280.52 L98.88 279.4 L100.31 278.29 L102.13 277.17 L102.68 276.05 L103.22 274.91 L104.35 273.79 L105.03 272.68 L105.91 271.56 L106.41 270.44 L107.66 269.33 L109.11 268.18 L111.71 267.06 L113 265.95 L114.68 264.83 L116.45 263.72 L117.31 262.6 L119.7 261.45 L122.57 260.34 L125.47 259.22 L129.51 258.11 L132.52 256.99 L137.9 255.87 L143.25 254.73 L146.07 253.61 L146.71 252.49 L148.26 251.38 L149.93 250.26 L152.98 249.15 
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


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
