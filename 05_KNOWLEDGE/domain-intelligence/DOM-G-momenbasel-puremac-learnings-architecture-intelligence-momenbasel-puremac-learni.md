# Domain G — Architecture Intelligence: Architecture Intelligence: momenbasel-puremac-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "momenbasel-puremac-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T19:44:11.960Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-momenbasel-puremac-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [momenbasel-puremac-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T19:44:11.960Z`  
> **Learning ID**: `LEARN-EVO-momenbasel-puremac-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), D (Research & Knowledge Intelligence), A (Human & Need Intelligence), M (Feedback & Evolution Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), L (Deployment & Operations Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 57%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from momenbasel-puremac-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/momenbasel-puremac-learnings.md`  
> **Source**: github ([https://github.com/momenbasel/PureMac](https://github.com/momenbasel/PureMac))  
> **Source Version**: `2ad5f1a9`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-22T19:43:15.488Z  
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
> **Harvest Timestamp**: 2026-11-22T19:43:15.481Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `momenbasel/PureMac`
- **Description**: Free, open-source macOS cleaner. CleanMyMac alternative with zero telemetry. Native SwiftUI, scheduled auto-cleaning, Xcode/Homebrew/system cache cleanup. MIT licensed.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7916 stars

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

### Incident Patch 1: `2ad5f1a9` (2026-11-22)
**Commit Message**: chore: refresh star history

**File**: `assets/star-history-dark.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#21262d" stroke-width="1"/>
   <text x="52" y="62" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.63 366.85 L66.81 365.74 L72.4 364.62 L72.61 363.51 L72.98 362.39 L73.44 361.27 L73.78 360.16 L74.1 359.04 L74.69 357.93 L75.24 356.81 L75.87 355.69 L76.26 354.58 L76.45 353.46 L76.64 352.31 L76.83 351.2 L77 350.08 L77.15 348.97 L77.25 347.85 L77.36 346.73 L77.5 345.62 L77.62 344.5 L77.76 343.39 L77.95 342.27 L78.14 341.15 L78.24 340.04 L78.35 338.92 L78.46 337.81 L78.57 336.69 L78.66 335.57 L78.76 334.46 L78.86 333.34 L78.99 332.23 L79.15 331.11 L79.27 329.99 L79.4 328.88 L79.58 327.76 L79.8 326.65 L80.09 325.53 L80.45 324.41 L80.92 323.3 L81.3 322.18 L81.76 321.04 L82.04 319.92 L82.41 318.8 L82.68 317.69 L82.99 316.57 L83.85 315.46 L84.52 314.34 L84.86 313.22 L85.17 312.11 L85.65 310.99 L86.18 309.88 L86.95 308.76 L87.28 307.64 L87.47 306.53 L87.63 305.41 L87.74 304.3 L87.83 303.18 L87.96 302.06 L88.12 300.95 L88.27 299.83 L88.4 298.72 L88.54 297.6 L88.71 296.48 L88.89 295.37 L89.09 294.25 L89.34 293.14 L89.59 292.02 L89.98 290.87 L90.4 289.76 L90.91 288.64 L91.26 287.52 L91.72 286.41 L92.53 285.29 L94.01 284.18 L95.33 283.06 L96.37 281.94 L97.26 280.83 L98.41 279.71 L99.98 278.6 L102.07 277.48 L102.94 276.36 L103.49 275.25 L104.27 274.13 L105.22 273.02 L105.89 271.9 L106.61 270.78 L107.83 269.67 L108.77 268.55 L111.74 267.44 L112.82 266.32 L114.81 265.2 L116.7 264.09 L117.62 262.97 L119.16 261.86 L121.43 260.71 L125.13 259.59 L128.49 258.48 L131.88 257.36 L135.71 256.25 L142.29 255.13 L146.15 254.01 L147.14 252.9 L148.06 251.78 L150.29 250.67 L152.8 249.55 L156.36 248.43 L157.22 247.32 L158.45 246.2 L159.46 245.08 L160.84 243.97 L161.79 242.85 L162.49 241.74 L163.72 240.62 L168.93 239.51 L172.58 238.39 L177.35 237.27 L182.63 236.16 L185.82 235.04 L189.27 233.93 L196.01 232.81 L201.29 231.69 L206.69 230.58 L210.79 229.43 L217.51 228.31 L226.1 227.2 L236.01 226.08 L245.59 224.97 L251.5 223.85 L260.62 222.73 L268.29 221.62 L279.16 220.5 L287.25 219.39 L296.36 218.27 L305.78 217.15 L309.12 216.04 L315.11 214.92 L324.65 213.81 L331.2 212.69 L340.46 211.57 L349.96 210.46 L359.55 209.34 L362.15 208.23 L363.5 207.11 L367.4 205.99 L369.99 204.88 L373.96 203.76 L381.45 202.65 L386.15 201.53 L394.43 200.41 L403.02 199.27 L409.63 198.15 L413.05 197.04 L420.57 195.92 L425.58 194.8 L432.93 193.69 L438.99 192.57 L446.37 191.46 L451.79 190.34 L454.53 189.22 L457.37 188.11 L458.17 186.99 L459.32 185.88 L461.52 184.76 L466.3 183.64 L471.21 182.53 L477.31 181.41 L483.86 180.3 L492.75 179.18 L500.69 178.06 L508.94 176.95 L510.64 175.83 L514.49 174.71 L519.72 173.6 L526.17 172.48 L532.01 171.37 L534.73 170.25 L538.2 169.1 L541.14 167.99 L546.71 166.87 L552.77 165.76 L558.81 164.64 L559.61 163.52 L562.11 162.41 L564.62 161.29 L567.31 160.18 L573.72 159.06 L579.1 157.94 L587.09 156.83 L593.46 155.71 L598.74 154.6 L602.73 153.48 L608.33 152.36 L613.89 151.25 L617.98 150.13 L622.58 149.02 L628.5 147.9 L631.74 146.78 L635.58 145.67 L639.21 144.55 L643.96 143.44 L647.73 142.32 L650.88 141.2 L653.56 140.09 L658.6 138.97 L663.94 137.82 L668.95 136.71 L671.36 135.59 L675.9 134.48 L679.69 133.36 L685.45 132.25 L692.26 131.13 L699.84 130.01 L704.48 128.9 L710.48 127.78 L717.14 126.67 L723.97 125.55 L730.63 124.43 L736 123.32 L736 368 L62 368 Z" fill="url(#fill-starhistorydarksvg)"/>
-  <path d="M62 367.97 L65.63 366.85 L66.81 365.74 L72.4 364.62 L72.61 363.51 L72.98 362.39 L73.44 361.27 L73.78 360.16 L74.1 359.04 L74.69 357.93 L75.24 356.81 L75.87 355.69 L76.26 354.58 L76.45 353.46 L76.64 352.31 L76.83 351.2 L77 350.08 L77.15 348.97 L77.25 347.85 L77.36 346.73 L77.5 345.62 L77.62 344.5 L77.76 343.39 L77.95 342.27 L78.14 341.15 L78.24 340.04 L78.35 338.92 L78.46 337.81 L78.57 336.69 L78.66 335.57 L78.76 334.46 L78.86 333.34 L78.99 332.23 L79.15 331.11 L79.27 329.99 L79.4 328.88 L79.58 327.76 L79.8 326.65 L80.09 325.53 L80.45 324.41 L80.92 323.3 L81.3 322.18 L81.76 321.04 L82.04 319.92 L82.41 318.8 L82.68 317.69 L82.99 316.57 L83.85 315.46 L84.52 314.34 L84.86 313.22 L85.17 312.11 L85.65 310.99 L86.18 309.88 L86.95 308.76 L87.28 307.64 L87.47 306.53 L87.63 305.41 L87.74 304.3 L87.83 303.18 L87.96 302.06 L88.12 300.95 L88.27 299.83 L88.4 298.72 L88.54 297.6 L88.71 296.48 L88.89 295.37 L89.09 294.25 L89.34 293.14 L89.59 292.02 L89.98 290.87 L90.4 289.76 L90.91 288.64 L91.26 287.52 L91.72 286.41 L92.53 285.29 L94.01 284.18 L95.33 283.06 L96.37 281.94 L97.26 280.83 L98.41 279.71 L99.98 278.6 L102.07 277.48 L102.94 276.36 L103.49 275.25 L104.27 274.13 L105.22 273.02 L105.89 271.9 L106.61 270.78 L107.83 269.67 L108.77 268.55 L111.74 267.44 L112.82 266.32 L114.81 265.2 L116.7 264.09 L117.62 262.97 L119.16 261.86 L121.43 260.71 L125.13 259.59 L128.49 258.48 L131.88 257.36 L135.71 256.25 L142.29 255.13 L146.15 254.01 L147.14 252.9 L148.06 251.78 L150.29 
```

**File**: `assets/star-history.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#e6eaef" stroke-width="1"/>
   <text x="52" y="62" fill="#59636e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.63 366.85 L66.81 365.74 L72.4 364.62 L72.61 363.51 L72.98 362.39 L73.44 361.27 L73.78 360.16 L74.1 359.04 L74.69 357.93 L75.24 356.81 L75.87 355.69 L76.26 354.58 L76.45 353.46 L76.64 352.31 L76.83 351.2 L77 350.08 L77.15 348.97 L77.25 347.85 L77.36 346.73 L77.5 345.62 L77.62 344.5 L77.76 343.39 L77.95 342.27 L78.14 341.15 L78.24 340.04 L78.35 338.92 L78.46 337.81 L78.57 336.69 L78.66 335.57 L78.76 334.46 L78.86 333.34 L78.99 332.23 L79.15 331.11 L79.27 329.99 L79.4 328.88 L79.58 327.76 L79.8 326.65 L80.09 325.53 L80.45 324.41 L80.92 323.3 L81.3 322.18 L81.76 321.04 L82.04 319.92 L82.41 318.8 L82.68 317.69 L82.99 316.57 L83.85 315.46 L84.52 314.34 L84.86 313.22 L85.17 312.11 L85.65 310.99 L86.18 309.88 L86.95 308.76 L87.28 307.64 L87.47 306.53 L87.63 305.41 L87.74 304.3 L87.83 303.18 L87.96 302.06 L88.12 300.95 L88.27 299.83 L88.4 298.72 L88.54 297.6 L88.71 296.48 L88.89 295.37 L89.09 294.25 L89.34 293.14 L89.59 292.02 L89.98 290.87 L90.4 289.76 L90.91 288.64 L91.26 287.52 L91.72 286.41 L92.53 285.29 L94.01 284.18 L95.33 283.06 L96.37 281.94 L97.26 280.83 L98.41 279.71 L99.98 278.6 L102.07 277.48 L102.94 276.36 L103.49 275.25 L104.27 274.13 L105.22 273.02 L105.89 271.9 L106.61 270.78 L107.83 269.67 L108.77 268.55 L111.74 267.44 L112.82 266.32 L114.81 265.2 L116.7 264.09 L117.62 262.97 L119.16 261.86 L121.43 260.71 L125.13 259.59 L128.49 258.48 L131.88 257.36 L135.71 256.25 L142.29 255.13 L146.15 254.01 L147.14 252.9 L148.06 251.78 L150.29 250.67 L152.8 249.55 L156.36 248.43 L157.22 247.32 L158.45 246.2 L159.46 245.08 L160.84 243.97 L161.79 242.85 L162.49 241.74 L163.72 240.62 L168.93 239.51 L172.58 238.39 L177.35 237.27 L182.63 236.16 L185.82 235.04 L189.27 233.93 L196.01 232.81 L201.29 231.69 L206.69 230.58 L210.79 229.43 L217.51 228.31 L226.1 227.2 L236.01 226.08 L245.59 224.97 L251.5 223.85 L260.62 222.73 L268.29 221.62 L279.16 220.5 L287.25 219.39 L296.36 218.27 L305.78 217.15 L309.12 216.04 L315.11 214.92 L324.65 213.81 L331.2 212.69 L340.46 211.57 L349.96 210.46 L359.55 209.34 L362.15 208.23 L363.5 207.11 L367.4 205.99 L369.99 204.88 L373.96 203.76 L381.45 202.65 L386.15 201.53 L394.43 200.41 L403.02 199.27 L409.63 198.15 L413.05 197.04 L420.57 195.92 L425.58 194.8 L432.93 193.69 L438.99 192.57 L446.37 191.46 L451.79 190.34 L454.53 189.22 L457.37 188.11 L458.17 186.99 L459.32 185.88 L461.52 184.76 L466.3 183.64 L471.21 182.53 L477.31 181.41 L483.86 180.3 L492.75 179.18 L500.69 178.06 L508.94 176.95 L510.64 175.83 L514.49 174.71 L519.72 173.6 L526.17 172.48 L532.01 171.37 L534.73 170.25 L538.2 169.1 L541.14 167.99 L546.71 166.87 L552.77 165.76 L558.81 164.64 L559.61 163.52 L562.11 162.41 L564.62 161.29 L567.31 160.18 L573.72 159.06 L579.1 157.94 L587.09 156.83 L593.46 155.71 L598.74 154.6 L602.73 153.48 L608.33 152.36 L613.89 151.25 L617.98 150.13 L622.58 149.02 L628.5 147.9 L631.74 146.78 L635.58 145.67 L639.21 144.55 L643.96 143.44 L647.73 142.32 L650.88 141.2 L653.56 140.09 L658.6 138.97 L663.94 137.82 L668.95 136.71 L671.36 135.59 L675.9 134.48 L679.69 133.36 L685.45 132.25 L692.26 131.13 L699.84 130.01 L704.48 128.9 L710.48 127.78 L717.14 126.67 L723.97 125.55 L730.63 124.43 L736 123.32 L736 368 L62 368 Z" fill="url(#fill-starhistorysvg)"/>
-  <path d="M62 367.97 L65.63 366.85 L66.81 365.74 L72.4 364.62 L72.61 363.51 L72.98 362.39 L73.44 361.27 L73.78 360.16 L74.1 359.04 L74.69 357.93 L75.24 356.81 L75.87 355.69 L76.26 354.58 L76.45 353.46 L76.64 352.31 L76.83 351.2 L77 350.08 L77.15 348.97 L77.25 347.85 L77.36 346.73 L77.5 345.62 L77.62 344.5 L77.76 343.39 L77.95 342.27 L78.14 341.15 L78.24 340.04 L78.35 338.92 L78.46 337.81 L78.57 336.69 L78.66 335.57 L78.76 334.46 L78.86 333.34 L78.99 332.23 L79.15 331.11 L79.27 329.99 L79.4 328.88 L79.58 327.76 L79.8 326.65 L80.09 325.53 L80.45 324.41 L80.92 323.3 L81.3 322.18 L81.76 321.04 L82.04 319.92 L82.41 318.8 L82.68 317.69 L82.99 316.57 L83.85 315.46 L84.52 314.34 L84.86 313.22 L85.17 312.11 L85.65 310.99 L86.18 309.88 L86.95 308.76 L87.28 307.64 L87.47 306.53 L87.63 305.41 L87.74 304.3 L87.83 303.18 L87.96 302.06 L88.12 300.95 L88.27 299.83 L88.4 298.72 L88.54 297.6 L88.71 296.48 L88.89 295.37 L89.09 294.25 L89.34 293.14 L89.59 292.02 L89.98 290.87 L90.4 289.76 L90.91 288.64 L91.26 287.52 L91.72 286.41 L92.53 285.29 L94.01 284.18 L95.33 283.06 L96.37 281.94 L97.26 280.83 L98.41 279.71 L99.98 278.6 L102.07 277.48 L102.94 276.36 L103.49 275.25 L104.27 274.13 L105.22 273.02 L105.89 271.9 L106.61 270.78 L107.83 269.67 L108.77 268.55 L111.74 267.44 L112.82 266.32 L114.81 265.2 L116.7 264.09 L117.62 262.97 L119.16 261.86 L121.43 260.71 L125.13 259.59 L128.49 258.48 L131.88 257.36 L135.71 256.25 L142.29 255.13 L146.15 254.01 L147.14 252.9 L148.06 251.78 L150.29 250.
```

---

### Incident Patch 2: `8a0d4ad8` (2026-11-21)
**Commit Message**: chore: refresh star history

**File**: `assets/star-history-dark.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#21262d" stroke-width="1"/>
   <text x="52" y="62" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.64 366.85 L66.83 365.74 L72.45 364.62 L72.66 363.51 L73.03 362.39 L73.49 361.27 L73.83 360.16 L74.15 359.04 L74.74 357.93 L75.3 356.81 L75.93 355.69 L76.31 354.58 L76.51 353.46 L76.69 352.38 L76.89 351.26 L77.05 350.14 L77.21 349.03 L77.31 347.91 L77.42 346.8 L77.55 345.68 L77.68 344.56 L77.82 343.45 L78.01 342.33 L78.2 341.22 L78.29 340.1 L78.41 338.98 L78.52 337.87 L78.64 336.75 L78.72 335.64 L78.82 334.52 L78.92 333.4 L79.04 332.29 L79.21 331.17 L79.34 330.06 L79.47 328.94 L79.64 327.82 L79.86 326.71 L80.16 325.59 L80.49 324.48 L80.97 323.36 L81.35 322.24 L81.78 321.16 L82.1 320.04 L82.4 318.93 L82.71 317.81 L83.03 316.7 L83.77 315.58 L84.56 314.46 L84.94 313.35 L85.22 312.23 L85.68 311.12 L86.19 310 L87 308.88 L87.38 307.77 L87.53 306.65 L87.73 305.53 L87.83 304.42 L87.93 303.3 L88.06 302.19 L88.21 301.07 L88.35 299.96 L88.5 298.84 L88.63 297.72 L88.79 296.61 L88.99 295.49 L89.18 294.38 L89.44 293.26 L89.67 292.14 L90.01 291.06 L90.47 289.94 L90.94 288.83 L91.33 287.71 L91.78 286.59 L92.53 285.48 L93.93 284.36 L95.1 283.25 L96.32 282.13 L97.24 281.01 L98.35 279.9 L99.93 278.78 L101.4 277.67 L103.09 276.55 L103.57 275.43 L104.27 274.32 L105.29 273.2 L105.92 272.09 L106.72 270.97 L107.67 269.85 L108.83 268.74 L111.19 267.62 L112.74 266.51 L114.73 265.39 L116.14 264.27 L117.64 263.16 L118.72 262.04 L121.02 260.96 L124.08 259.84 L127.39 258.73 L131.26 257.61 L135.59 256.49 L141.81 255.38 L145.52 254.26 L147.37 253.15 L148.06 252.03 L150.34 250.91 L152.93 249.8 L156.15 248.68 L157.5 247.57 L158.58 246.45 L159.68 245.33 L160.94 244.22 L161.87 243.1 L162.78 241.99 L163.67 240.87 L168.68 239.75 L172.34 238.64 L176.76 237.52 L181.61 236.41 L185.47 235.29 L188.9 234.17 L195.69 233.06 L200.24 231.94 L206.52 230.83 L209.47 229.74 L215.39 228.62 L224.83 227.51 L234.27 226.39 L243.82 225.28 L250.38 224.16 L258.02 223.04 L267.78 221.93 L275.33 220.81 L285.69 219.7 L294.44 218.58 L303.68 217.46 L309.87 216.35 L314.01 215.23 L324.35 214.12 L330.78 213 L337.23 211.88 L348.65 210.77 L356.97 209.65 L363.13 208.54 L364.34 207.42 L367.21 206.3 L369.88 205.19 L373.65 204.07 L380.7 202.96 L386.77 201.84 L393.64 200.72 L401.02 199.64 L410.16 198.52 L413.01 197.41 L419.92 196.29 L425.75 195.18 L431.98 194.06 L438.21 192.94 L445.05 191.83 L452.81 190.71 L455.47 189.6 L458.7 188.48 L459.56 187.36 L460.44 186.25 L461.68 185.13 L466.12 184.02 L471.03 182.9 L476.1 181.78 L483.48 180.67 L491.92 179.55 L499.78 178.43 L509.84 177.32 L512.31 176.2 L514.4 175.09 L518.98 173.97 L526.64 172.86 L531.32 171.74 L535.79 170.62 L538.93 169.54 L541.88 168.42 L546.07 167.31 L551.99 166.19 L558.11 165.07 L561.22 163.96 L562.74 162.84 L565.93 161.73 L568.35 160.61 L572.84 159.49 L578.43 158.38 L584.79 157.26 L593.91 156.15 L598.43 155.03 L602.76 153.91 L607.59 152.8 L613.28 151.68 L618.11 150.57 L622.79 149.45 L629.71 148.33 L632.47 147.22 L635.87 146.1 L640 144.99 L644 143.87 L648.23 142.75 L652.98 141.64 L654.23 140.52 L658.79 139.41 L664.16 138.32 L669.52 137.2 L672.15 136.09 L675.77 134.97 L680.2 133.86 L685.87 132.74 L691.54 131.63 L697.79 130.51 L705 129.39 L710.79 128.28 L716.9 127.16 L724.49 126.05 L729.94 124.93 L736 123.81 L736 368 L62 368 Z" fill="url(#fill-starhistorydarksvg)"/>
-  <path d="M62 367.97 L65.64 366.85 L66.83 365.74 L72.45 364.62 L72.66 363.51 L73.03 362.39 L73.49 361.27 L73.83 360.16 L74.15 359.04 L74.74 357.93 L75.3 356.81 L75.93 355.69 L76.31 354.58 L76.51 353.46 L76.69 352.38 L76.89 351.26 L77.05 350.14 L77.21 349.03 L77.31 347.91 L77.42 346.8 L77.55 345.68 L77.68 344.56 L77.82 343.45 L78.01 342.33 L78.2 341.22 L78.29 340.1 L78.41 338.98 L78.52 337.87 L78.64 336.75 L78.72 335.64 L78.82 334.52 L78.92 333.4 L79.04 332.29 L79.21 331.17 L79.34 330.06 L79.47 328.94 L79.64 327.82 L79.86 326.71 L80.16 325.59 L80.49 324.48 L80.97 323.36 L81.35 322.24 L81.78 321.16 L82.1 320.04 L82.4 318.93 L82.71 317.81 L83.03 316.7 L83.77 315.58 L84.56 314.46 L84.94 313.35 L85.22 312.23 L85.68 311.12 L86.19 310 L87 308.88 L87.38 307.77 L87.53 306.65 L87.73 305.53 L87.83 304.42 L87.93 303.3 L88.06 302.19 L88.21 301.07 L88.35 299.96 L88.5 298.84 L88.63 297.72 L88.79 296.61 L88.99 295.49 L89.18 294.38 L89.44 293.26 L89.67 292.14 L90.01 291.06 L90.47 289.94 L90.94 288.83 L91.33 287.71 L91.78 286.59 L92.53 285.48 L93.93 284.36 L95.1 283.25 L96.32 282.13 L97.24 281.01 L98.35 279.9 L99.93 278.78 L101.4 277.67 L103.09 276.55 L103.57 275.43 L104.27 274.32 L105.29 273.2 L105.92 272.09 L106.72 270.97 L107.67 269.85 L108.83 268.74 L111.19 267.62 L112.74 266.51 L114.73 265.39 L116.14 264.27 L117.64 263.16 L118.72 262.04 L121.02 260.96 L124.08 259.84 L127.39 258.73 L131.26 257.61 L135.59 256.49 L141.81 255.38 L145.52 254.26 L147.37 253.15 L148.06 252.03 L150.34 250
```

**File**: `assets/star-history.svg` (modified, +11/-11)
```diff
@@ -23,18 +23,18 @@
   <line x1="62" y1="58" x2="736" y2="58" stroke="#e6eaef" stroke-width="1"/>
   <text x="52" y="62" fill="#59636e" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="11" text-anchor="end">10k</text>
 
-  <path d="M62 367.97 L65.64 366.85 L66.83 365.74 L72.45 364.62 L72.66 363.51 L73.03 362.39 L73.49 361.27 L73.83 360.16 L74.15 359.04 L74.74 357.93 L75.3 356.81 L75.93 355.69 L76.31 354.58 L76.51 353.46 L76.69 352.38 L76.89 351.26 L77.05 350.14 L77.21 349.03 L77.31 347.91 L77.42 346.8 L77.55 345.68 L77.68 344.56 L77.82 343.45 L78.01 342.33 L78.2 341.22 L78.29 340.1 L78.41 338.98 L78.52 337.87 L78.64 336.75 L78.72 335.64 L78.82 334.52 L78.92 333.4 L79.04 332.29 L79.21 331.17 L79.34 330.06 L79.47 328.94 L79.64 327.82 L79.86 326.71 L80.16 325.59 L80.49 324.48 L80.97 323.36 L81.35 322.24 L81.78 321.16 L82.1 320.04 L82.4 318.93 L82.71 317.81 L83.03 316.7 L83.77 315.58 L84.56 314.46 L84.94 313.35 L85.22 312.23 L85.68 311.12 L86.19 310 L87 308.88 L87.38 307.77 L87.53 306.65 L87.73 305.53 L87.83 304.42 L87.93 303.3 L88.06 302.19 L88.21 301.07 L88.35 299.96 L88.5 298.84 L88.63 297.72 L88.79 296.61 L88.99 295.49 L89.18 294.38 L89.44 293.26 L89.67 292.14 L90.01 291.06 L90.47 289.94 L90.94 288.83 L91.33 287.71 L91.78 286.59 L92.53 285.48 L93.93 284.36 L95.1 283.25 L96.32 282.13 L97.24 281.01 L98.35 279.9 L99.93 278.78 L101.4 277.67 L103.09 276.55 L103.57 275.43 L104.27 274.32 L105.29 273.2 L105.92 272.09 L106.72 270.97 L107.67 269.85 L108.83 268.74 L111.19 267.62 L112.74 266.51 L114.73 265.39 L116.14 264.27 L117.64 263.16 L118.72 262.04 L121.02 260.96 L124.08 259.84 L127.39 258.73 L131.26 257.61 L135.59 256.49 L141.81 255.38 L145.52 254.26 L147.37 253.15 L148.06 252.03 L150.34 250.91 L152.93 249.8 L156.15 248.68 L157.5 247.57 L158.58 246.45 L159.68 245.33 L160.94 244.22 L161.87 243.1 L162.78 241.99 L163.67 240.87 L168.68 239.75 L172.34 238.64 L176.76 237.52 L181.61 236.41 L185.47 235.29 L188.9 234.17 L195.69 233.06 L200.24 231.94 L206.52 230.83 L209.47 229.74 L215.39 228.62 L224.83 227.51 L234.27 226.39 L243.82 225.28 L250.38 224.16 L258.02 223.04 L267.78 221.93 L275.33 220.81 L285.69 219.7 L294.44 218.58 L303.68 217.46 L309.87 216.35 L314.01 215.23 L324.35 214.12 L330.78 213 L337.23 211.88 L348.65 210.77 L356.97 209.65 L363.13 208.54 L364.34 207.42 L367.21 206.3 L369.88 205.19 L373.65 204.07 L380.7 202.96 L386.77 201.84 L393.64 200.72 L401.02 199.64 L410.16 198.52 L413.01 197.41 L419.92 196.29 L425.75 195.18 L431.98 194.06 L438.21 192.94 L445.05 191.83 L452.81 190.71 L455.47 189.6 L458.7 188.48 L459.56 187.36 L460.44 186.25 L461.68 185.13 L466.12 184.02 L471.03 182.9 L476.1 181.78 L483.48 180.67 L491.92 179.55 L499.78 178.43 L509.84 177.32 L512.31 176.2 L514.4 175.09 L518.98 173.97 L526.64 172.86 L531.32 171.74 L535.79 170.62 L538.93 169.54 L541.88 168.42 L546.07 167.31 L551.99 166.19 L558.11 165.07 L561.22 163.96 L562.74 162.84 L565.93 161.73 L568.35 160.61 L572.84 159.49 L578.43 158.38 L584.79 157.26 L593.91 156.15 L598.43 155.03 L602.76 153.91 L607.59 152.8 L613.28 151.68 L618.11 150.57 L622.79 149.45 L629.71 148.33 L632.47 147.22 L635.87 146.1 L640 144.99 L644 143.87 L648.23 142.75 L652.98 141.64 L654.23 140.52 L658.79 139.41 L664.16 138.32 L669.52 137.2 L672.15 136.09 L675.77 134.97 L680.2 133.86 L685.87 132.74 L691.54 131.63 L697.79 130.51 L705 129.39 L710.79 128.28 L716.9 127.16 L724.49 126.05 L729.94 124.93 L736 123.81 L736 368 L62 368 Z" fill="url(#fill-starhistorysvg)"/>
-  <path d="M62 367.97 L65.64 366.85 L66.83 365.74 L72.45 364.62 L72.66 363.51 L73.03 362.39 L73.49 361.27 L73.83 360.16 L74.15 359.04 L74.74 357.93 L75.3 356.81 L75.93 355.69 L76.31 354.58 L76.51 353.46 L76.69 352.38 L76.89 351.26 L77.05 350.14 L77.21 349.03 L77.31 347.91 L77.42 346.8 L77.55 345.68 L77.68 344.56 L77.82 343.45 L78.01 342.33 L78.2 341.22 L78.29 340.1 L78.41 338.98 L78.52 337.87 L78.64 336.75 L78.72 335.64 L78.82 334.52 L78.92 333.4 L79.04 332.29 L79.21 331.17 L79.34 330.06 L79.47 328.94 L79.64 327.82 L79.86 326.71 L80.16 325.59 L80.49 324.48 L80.97 323.36 L81.35 322.24 L81.78 321.16 L82.1 320.04 L82.4 318.93 L82.71 317.81 L83.03 316.7 L83.77 315.58 L84.56 314.46 L84.94 313.35 L85.22 312.23 L85.68 311.12 L86.19 310 L87 308.88 L87.38 307.77 L87.53 306.65 L87.73 305.53 L87.83 304.42 L87.93 303.3 L88.06 302.19 L88.21 301.07 L88.35 299.96 L88.5 298.84 L88.63 297.72 L88.79 296.61 L88.99 295.49 L89.18 294.38 L89.44 293.26 L89.67 292.14 L90.01 291.06 L90.47 289.94 L90.94 288.83 L91.33 287.71 L91.78 286.59 L92.53 285.48 L93.93 284.36 L95.1 283.25 L96.32 282.13 L97.24 281.01 L98.35 279.9 L99.93 278.78 L101.4 277.67 L103.09 276.55 L103.57 275.43 L104.27 274.32 L105.29 273.2 L105.92 272.09 L106.72 270.97 L107.67 269.85 L108.83 268.74 L111.19 267.62 L112.74 266.51 L114.73 265.39 L116.14 264.27 L117.64 263.16 L118.72 262.04 L121.02 260.96 L124.08 259.84 L127.39 258.73 L131.26 257.61 L135.59 256.49 L141.81 255.38 L145.52 254.26 L147.37 253.15 L148.06 252.03 L150.34 250.91 
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
