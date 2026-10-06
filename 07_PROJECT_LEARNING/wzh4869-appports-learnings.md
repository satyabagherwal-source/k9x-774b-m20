# Forensic Learning Record (Deep Inspection): wzh4869/AppPorts

> **Canonical Artifact**: `07_PROJECT_LEARNING/wzh4869-appports-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wzh4869/AppPorts](https://github.com/wzh4869/AppPorts))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:29:40.411Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wzh4869/AppPorts`
- **Description**: 📦 A macOS utility to seamlessly migrate applications to external storage and reclaim local disk space.【一款 macOS 工具，无缝迁移应用到外部存储并自动建立链接，释放宝贵的本地空间】
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2107 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `AppPorts/Models/AppListScanState.swift`
```
import Foundation

/// 单个应用面板的扫描生命周期。请求保留到下次扫描，以便拒绝过期结果。
struct AppListScanState {
    struct Request: Equatable, Sendable {
        let id = UUID()
        let externalDirectory: URL?
        let customPaths: [String]
        let forceSizeRefresh: Bool
    }

    private(set) var request: Request?
    private(set) var isScanning = false
    private var needsSizeRefresh = false

    mutating func begin(externalDirectory: URL?, customPaths: [String], isManual: Bool = false) -> Request? {
        guard !isManual || !isScanning else { return nil }
        // 监控触发的新扫描可以替代旧扫描，但不能吞掉用户尚未完成的体积刷新。
        needsSizeRefresh = needsSizeRefresh || isManual
        let next = Request(externalDirectory: externalDirectory, customPaths: customPaths,
                           forceSizeRefresh: needsSizeRefresh)
        request = next
        isScanning = true
        return next
    }

    mutating func finish(_ completed: Request) {
        guard request == completed else { return }
        isScanning = false
        needsSizeRefresh = false
    }

    mutating func invalidate() {
        request = nil
        isScanning = false
    }
}

```

### Core Architecture Module: `AppPorts/Services/AppOperationState.swift`
```
import Combine
import Foundation

/// 跨页面、跨窗口保留文件操作的生命周期，阻止重建视图或重复启动迁移。
@MainActor
final class AppOperationState: ObservableObject {
    static let shared = AppOperationState()

    @Published private var activeOperation: UUID?

    var isBusy: Bool { activeOperation != nil }

    func begin() -> UUID? {
        guard activeOperation == nil else { return nil }
        let token = UUID()
        activeOperation = token
        return token
    }

    func finish(_ token: UUID) {
        guard activeOperation == token else { return }
        activeOperation = nil
    }
}

```

### Core Architecture Module: `AppPorts/Utils/AppIdentityResolver.swift`
```
import Foundation
import Darwin

enum AppIdentitySource: String, Sendable {
    case macOSBundle, rootBundle, wrappedBundle, wrapperChild
}

struct ResolvedAppIdentity: Sendable {
    /// The outer real application remains distinct from the iOS identity bundle.
    let realAppURL: URL
    let identityBundleURL: URL
    let bundleIdentifier: String
    let source: AppIdentitySource
}

struct AppIdentityIssue: Error, Equatable, Sendable {
    enum Reason: String, Sendable {
        case realAppUnavailable, unreadableInfoPlist, invalidInfoPlist
        case invalidIdentifier, missingInfoPlist, wrappedBundleUnavailable
        case ambiguousWrapper, outsideWrapper, wrapperCycle, wrapperDepthExceeded
    }

    let url: URL
    let reason: Reason
}

/// Read-only application identity lookup. Portal interpretation stays with the existing resolver;
/// wrapper traversal only selects metadata and never changes the target of a signing operation.
enum AppIdentityResolver {
    static func resolve(at appURL: URL) -> Result<ResolvedAppIdentity, AppIdentityIssue> {
        let realAppURL: URL
        do {
            realAppURL = try CodeSigner.resolveAppURL(at: appURL).resolvingSymlinksInPath()
        } catch {
            return .failure(AppIdentityIssue(url: appURL, reason: .realAppUnavailable))
        }

        var visited = Set<String>()
        do {
            return .success(try readBundle(at: realAppURL, realAppURL: realAppURL,
                                           source: nil, depth: 0, visited: &visited))
        } catch let issue as AppIdentityIssue {
            return .failure(issue)
        } catch {
            return .failure(AppIdentityIssue(url: realAppURL, reason: .unreadableInfoPlist))
        }
    }

    private static func readBundle(
        at url: URL, realAppURL: URL, source: AppIdentitySource?, depth: Int, visited: inout Set<String>
    ) throws -> ResolvedAppIdentity {
        let bundleURL = url.resolvingSymlinksInPath().standardizedFileURL
        guard isInside(bundleURL, root: realAppURL) else {
            throw AppIdentityIssue(url: url, reason: .outsideWrapper)
        }
        guard visited.insert(bundleURL.path).inserted else {
            throw AppIdentityIssue(url: url, reason: .wrapperCycle)
        }
        guard depth <= 8 else {
            throw AppIdentityIssue(url: url, reason: .wrapperDepthExceeded)
        }

        for (relativePath, defaultSource) in [
            ("Contents/Info.plist", AppIdentitySource.macOSBundle), ("Info.plist", .rootBundle)
        ] {
            let plistURL = bundleURL.appendingPathComponent(relativePath)
            if try entryExists(plistURL) {
                // Wrapped metadata may itself be a symlink (including Contents). Validate the
                // file we will actually read, while preserving ordinary native metadata links.
                if source != nil, !isInside(plistURL.resolvingSymlinksInPath(), root: realAppURL) {
                    throw AppIdentityIssue(url: plistURL, reason: .outsideWrapper)
                }
                // A broken or invalid higher-priority plist must not select a different identity.
                let identifier = try readIdentifier(at: plistURL)
                return ResolvedAppIdentity(realAppURL: realAppURL, identityBundleURL: bundleURL,
                                           bundleIdentifier: identifier, source: source ?? defaultSource)
            }
        }

        let wrapped = bundleURL.appendingPathComponent("WrappedBundle")
        if try entryExists(wrapped) {
            let target = try wrapperTarget(wrapped)
            guard isInside(target, root: realAppURL) else {
                throw AppIdentityIssue(url: wrapped, reason: .outsideWrapper)
            }
            var isDirectory: ObjCBool = false
            guard FileManager.default.fileExists(atPath: target.path, isDirectory: &isDirectory),
                  isDirectory.boolValue else {
                throw AppIdentityIssue(url: wrapped, reason: .wrappedBundleUnavailable)
            }
            return try readBundle(at: target, realAppURL: realAppURL, source: source ?? .wrappedBundle,
                                  depth: depth + 1, visited: &visited)
        }

        let wrapper = bundleURL.appendingPathComponent("Wrapper")
        guard try entryExists(wrapper) else {
            throw AppIdentityIssue(url: bundleURL, reason: .missingInfoPlist)
        }
        guard isInside(wrapper.resolvingSymlinksInPath(), root: realAppURL) else {
            throw AppIdentityIssue(url: wrapper, reason: .outsideWrapper)
        }
        let candidates: [URL]
        do {
            candidates = try FileManager.default.contentsOfDirectory(
                at: wrapper, includingPropertiesForKeys: [.isDirectoryKey], options: .skipsHiddenFiles
            ).filter { candidate in
                guard candidate.pathExtension.lowercased() == "app" else { return false }
                // Count broken .app links as candidates too, rather than selecting a different app.
                if FileManager.default.destinationOfSymbolicLinkIfPresent(at: candidate) != nil { return true }
                return try candidate.resourceValues(forKeys: [.isDirectoryKey]).isDirectory == true
            }
        } catch {
            throw AppIdentityIssue(url: wrapper, reason: .wrappedBundleUnavailable)
        }
        guard candidates.count == 1, let candidate = candidates.first else {
            throw AppIdentityIssue(url: wrapper, reason: candidates.isEmpty ? .missingInfoPlist : .ambiguousWrapper)
        }
        let target = try wrapperTarget(candidate)
        return try readBundle(at: target, realAppURL: realAppURL, source: source ?? .wrapperChild,
                              depth: depth + 1, visited: &visited)
    }

    private static func readIdentifier(at url: URL) throws -> String {
        let data: Data
        do { data = try Data(contentsOf: url) }
        catch { throw AppIdentityIssue(url: url, reason: .unreadableInfoPlist) }
        let plist: [String: Any]
        do {
            guard let value = try PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any] else {
                throw AppIdentityIssue(url: url, reason: .invalidInfoPlist)
            }
            plist = value
        } catch { throw AppIdentityIssue(url: url, reason: .invalidInfoPlist) }
        guard let value = plist["CFBundleIdentifier"] as? String else {
            throw AppIdentityIssue(url: url, reason: .invalidIdentifier)
        }
        let identifier = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !identifier.isEmpty, !identifier.lowercased().hasSuffix(".appports.stub") else {
            throw AppIdentityIssue(url: url, reason: .invalidIdentifier)
        }
        return identifier
    }

    /// lstat-like existence also notices dangling links; access errors are not treated as absence.
    private static func entryExists(_ url: URL) throws -> Bool {
        if FileManager.default.destinationOfSymbolicLinkIfPresent(at: url) != nil { return true }
        do {
            _ = try FileManager.default.attributesOfItem(atPath: url.path)
            return true
        } catch {
            if DataDirReadIssue.isMissingFile(error) { return false }
            throw AppIdentityIssue(url: url, reason: .unreadableInfoPlist)
        }
    }

    private static func wrapperTarget(_ url: URL) throws -> URL {
        // Resolve with filesystem semantics before URL normalization: Alias/.. must traverse
        // Alias when it is a symlink. realpath also bounds symlink traversal and rejects cycles.
        guard let resolved = realpath(url.path, nil) else {
            let reason: AppIdentityIssue.Reason = errno == ELOOP ? .wrapperCycle : .wrappedBundleUnavailable
            throw AppIdentityIssue(url: url, reason: reason)
        }
        defer { free(resolved) }
        return URL(fileURLWithPath: String(cString: resolved))
    }

    private static func isInside(_ url: URL, root: URL) -> Bool {
        url.standardizedFileURL.pathComponents.starts(with: root.standardizedFileURL.pathComponents)
    }
}

private extension FileManager {
    func destinationOfSymbolicLinkIfPresent(at url: URL) -> String? {
        try? destinationOfSymbolicLink(atPath: url.path)
    }
}

```

### Core Architecture Module: `AppPorts/Utils/AppRunningState.swift`
```
import Foundation

/// 用运行应用的快照匹配真实应用；不依赖 UI 扫描时缓存的 isRunning。
enum AppRunningState {
    struct RunningApplication: Sendable {
        let bundleURL: URL?
        let bundleIdentifier: String?
    }

    nonisolated static func isRunning(appURL: URL, applications: [RunningApplication]) -> Bool {
        let realURL = (try? CodeSigner.resolveAppURL(at: appURL)) ?? appURL
        let identifier = CodeSigner.bundleIdentifier(at: realURL)
        return applications.contains {
            matches(appURL: realURL, bundleIdentifier: identifier, application: $0)
        }
    }

    /// 路径匹配覆盖无 Bundle ID 的进程；身份匹配覆盖由其它位置启动的同一应用。
    nonisolated static func matches(
        appURL: URL,
        bundleIdentifier: String?,
        application: RunningApplication
    ) -> Bool {
        if let runningURL = application.bundleURL,
           normalizedPath(runningURL) == normalizedPath(appURL) {
            return true
        }

        // nil == nil 或空字符串相等不代表同一应用。
        guard let expectedID = nonemptyIdentifier(bundleIdentifier),
              let runningID = nonemptyIdentifier(application.bundleIdentifier) else {
            return false
        }
        return expectedID == runningID
    }

    nonisolated private static func normalizedPath(_ url: URL) -> String {
        url.resolvingSymlinksInPath().standardizedFileURL.path
    }

    nonisolated private static func nonemptyIdentifier(_ identifier: String?) -> String? {
        guard let identifier = identifier?.trimmingCharacters(in: .whitespacesAndNewlines),
              !identifier.isEmpty else { return nil }
        return identifier
    }
}

```

### Core Architecture Module: `AppPorts/Utils/AppScanner.swift`
```
//
//  AppScanner.swift
//  AppPorts
//
//  Created by shimoko.com on 2026/2/6.
//

import Darwin
import Foundation

// MARK: - 应用扫描器

/// 异步应用扫描工具
///
/// 使用 Actor 模型在后台线程扫描应用程序目录，识别应用状态、类型和大小。
/// 该工具能够检测：
/// - 本地应用和外部存储应用
/// - 符号链接状态（标准符号链接和深层符号链接）
/// - App Store 应用（包含 _MASReceipt 目录）
/// - iOS 应用（运行在 Apple Silicon Mac 上的 iPhone/iPad 应用）
/// - 正在运行的应用
/// - 系统应用
///
/// ## 使用示例
/// ```swift
/// let scanner = AppScanner()
/// let apps = await scanner.scanLocalApps(
///     at: URL(fileURLWithPath: "/Applications"),
///     runningAppURLs: runningApps
/// )
/// ```
///
/// - Note: 使用 Actor 确保所有扫描操作在后台线程串行执行，不阻塞 UI
actor AppScanner {
    private var infoPlistCache: [URL: [String: Any]] = [:]

    /// 签名备份目录。默认与 AppPorts 应用数据同级；测试可注入临时目录。
    private let backupDirectoryURL: URL

    /// ad-hoc 签名探测。返回 `nil` 表示**没查出来**（codesign 超时/启动失败），测试可注入。
    private let adHocProbe: @Sendable (URL) -> Bool?

    init(
        backupDirectoryURL: URL? = nil,
        adHocProbe: @escaping @Sendable (URL) -> Bool? = { AppScanner.probeAdHocSignature(at: $0) }
    ) {
        self.backupDirectoryURL = backupDirectoryURL ?? Self.defaultBackupDirectoryURL
        self.adHocProbe = adHocProbe
    }

    private func readInfoPlist(for appURL: URL) -> [String: Any]? {
        if let cached = infoPlistCache[appURL] {
            return cached.isEmpty ? nil : cached
        }
        let infoPlistURL = appURL.appendingPathComponent("Contents/Info.plist")
        guard let plistData = try? Data(contentsOf: infoPlistURL),
              let plist = try? PropertyListSerialization.propertyList(from: plistData, options: [], format: nil) as? [String: Any] else {
            infoPlistCache[appURL] = [:]
            return nil
        }
        infoPlistCache[appURL] = plist
        return plist
    }

    private struct ScanCandidate {
        let app: AppItem
        let dedupeKey: String
        let priority: Int
    }

    private struct ExternalComparisonIndex {
        var byBundleID: [String: ExternalComparableApp] = [:]
        var byName: [String: ExternalComparableApp] = [:]
    }

    private struct ExternalComparableApp {
        let bundleURL: URL
        let containerURL: URL
        let bundleID: String?
        let version: String?
    }

    enum AppSizeMode {
        /// 解析到真实 bundle 或目录后计算内容体积。
        case logicalContent
        /// 保留本地入口结构，仅统计 symlink 或 wrapper 自身占用。
        case localPortal
    }
    
    // MARK: - 公共 API
    
    /// 计算目录大小
    ///
    /// 递归计算目录树的总大小。
    ///
    /// - Parameter url: 目录 URL
    /// - Returns: 目录总大小（字节）
    ///
    /// - Note:
    ///   - 普通目录：跳过内部符号链接，避免重复计算
    ///   - `.app` 包：会尽量解析入口 symlink 或 `Contents` 深层链接，得到真实体积
    func calculateDirectorySize(at url: URL, mode: AppSizeMode = .logicalContent) -> Int64 {
        let fileManager = FileManager.default
        var size: Int64 = 0
        let scanURL: URL
        let countsSymlinkEntries: Bool

        switch mode {
        case .logicalContent:
            scanURL = resolveSizeCalculationURL(for: url)
            countsSymlinkEntries = false
        case .localPortal:
            scanURL = url
            countsSymlinkEntries = true
        }

        guard fileManager.fileExists(atPath: scanURL.path) else { return 0 }
        
        // 需要获取的资源键
        let resourceKeys: [URLResourceKey] = [.isRegularFileKey, .fileSizeKey, .isSymbolicLinkKey, .isDirectoryKey]

        if let rootValues = try? scanURL.resourceValues(forKeys: Set(resourceKeys)) {
            if case .localPortal = mode, rootValues.isSymbolicLink == true {
                return Int64(rootValues.fileSize ?? 0)
            }

            if rootValues.isDirectory != true {
                return Int64(rootValues.fileSize ?? 0)
            }
        }
        
        // 创建目录枚举器（深度优先遍历）
        guard let enumerator = fileManager.enumerator(
            at: scanURL,
            includingPropertiesForKeys: resourceKeys,
            options: [.skipsHiddenFiles], // 跳过隐藏文件提升性能
            errorHandler: nil
        ) else { return 0 }

        var fileCount = 0
        let maxFileCount = 500_000

        // 累加所有文件大小
        for case let fileURL as URL in enumerator {
            fileCount += 1
            if fileCount > maxFileCount {
                AppLogger.shared.logContext(
                    "calculateDirectorySize: 文件数量达到上限，提前终止",
                    details: [("path", scanURL.path), ("limit", String(maxFileCount))],
                    level: "WARN"
                )
                break
            }
            let resourceValues = try? fileURL.resourceValues(forKeys: Set(resourceKeys))
            if resourceValues?.isSymbolicLink == true {
                if countsSymlinkEntries {
                    size += Int64(resourceValues?.fileSize ?? 0)
                }
                continue
            }
            if let fileSize = resourceValues?.fileSize { size += Int64(fileSize) }
        }
        return size
    }

    /// 根据显示场景选择应用体积计算方式。
    ///
    /// 本地列表中的“已链接”应用应显示本地入口大小，避免看起来像在本地保留了一整份实体副本。
    func calculateDisplayedSize(for app: AppItem, isLocalEntry: Bool) -> Int64 {
        let mode: AppSizeMode = (isLocalEntry && app.status == AppStatus.linked) ? .localPortal : .logicalContent
        return calculateDirectorySize(at: app.path, mode: mode)
    }
    
    /// 扫描本地应用目录
    ///
    /// 扫描指定目录（通常是 /Applications），识别所有 .app 包并检测其状态。
    ///
    /// - Parameters:
    ///   - dir: 要扫描的目录 URL
    ///   - runningAppURLs: 当前正在运行的应用 URL 集合
    ///
    /// - Returns: 应用列表，按链接状态和名称排序
    ///
    /// - Note: 检测逻辑包括：
    ///   - 符号链接检测（标准 symlink 和深层 symlink）
    ///   - 系统应用识别（路径以 /System 开头）
    ///   - 运行状态检测
    ///   - App Store 应用和 iOS 应用检测
    func scanLocalApps(at dir: URL, runningAppURLs: Set<URL>, externalAppsDir: URL? = nil) -> [AppItem] {
        let scanID = AppLogger.shared.makeOperationID(prefix: "app-scanner-local")
        AppLogger.shared.logContext(
            "AppScanner 开始扫描本地应用",
            details: [
                ("scan_id", scanID),
                ("directory", dir.path),
                ("external_directory", externalAppsDir?.path),
                ("running_app_count", String(runningAppURLs.count))
            ],
            level: "TRACE"
        )
        infoPlistCache.removeAll()
        let fileManager = FileManager.default
        var candidates: [ScanCandidate] = []
        let externalComparisonIndex = makeExternalComparisonIndex(for: externalAppsDir)

        // 性能优化：预先获取需要的资源键
        let keys: [URLResourceKey] = [.isSymbolicLinkKey, .isDirectoryKey]
        let items = (try? fileManager.contentsOfDirectory(at: dir, includingPropertiesForKeys: keys, options: .skipsHiddenFiles)) ?? []

        for itemURL in items {
            // 只处理 .app 扩展名的项目
            if itemURL.pathExtension == "app" {
                let appName = itemURL.lastPathComponent
                AppLogger.shared.log("扫描应用: \(appName)", level: "TRACE")
                let baseStatus = detectLocalAppStatus(at: itemURL)
                let status = statusForLocalApp(
                    baseStatus: baseStatus,
                    localBundleURL: itemURL,
                    fallbackName: appName,
                    externalComparisonIndex: externalComparisonIndex
                )
                let isSystem = itemURL.path.hasPrefix("/System")
                let isRunning = runningAppURLs.contains(itemURL)
                let version = readBundleVersion(from: itemURL)
                
                // 检测是否为 App Store 应用和 iOS 应用
                let (isAppStore, isIOS) = detectAppStoreAndIOSApp(at: itemURL)
                let signing = checkSigningStatus(bundleURL: itemURL)
                let (isElectron, isSparkle) = detectElectronAndSparkle(at: itemURL)
                let hasUpdater = isSparkle || (isElectron && hasElectronUpdater(at: itemURL)) || hasCustomUpdater(at: itemURL)
                let needsLock = isSparkle || (isElectron && hasElectronUpdater(at: itemURL))
                let app = AppItem(
                    name: appName,
                    path: itemURL,
                    bundleURL: itemURL,
                    status: status,
                    isSystemApp: isSystem,
                    isRunning: isRunning,
                    isAppStoreApp: isAppStore,
                    isIOSApp: isIOS,
                    isResigned: signing.isResigned,
                    signatureReplaced: signing.signatureReplaced,
                    signatureCheckUnavailable: signing.signatureCheckUnavailable,
                    isElectronApp: isElectron,
                    isSparkleApp: isSparkle,
                    hasSelfUpdater: hasUpdater,
                    needsLock: needsLock,
                    version: version,
                    containerKind: .standaloneApp
                )
                candidates.append(makeCandidate(for: app, bundleURL: itemURL, priority: 10))
            }
            // 处理包含 .app 的文件夹（包括迁移后的“文件夹 symlink -> 外部单应用容器”）
            else {
                let appsInFolder = appBundlesInsideFolderPortal(at: itemURL)

                if !appsInFolder.isEmpty {
                    let folderName = itemURL.lastPathComponent
                    let appCount = appsInFolder.count
                    let baseStatus = detectLocalFolderStatus(at: itemURL)

                    let hasRunning = appsInFolder.contains { bundleURL in
                        runningAppURLs.contains(bundleURL)
                            || runningAppURLs.contains(itemURL.appendingPathComponent(bundleURL.lastPathComponent))
                    }

                    if appCount == 1, let bundleURL = appsInFolder.first {
                        let status = statusForLocalApp(
                            baseStatus: baseStatus,
                            localBundleURL: bundleURL,
                            fallbackName: bundleURL.lastPathComponent,
                            externalComparisonIndex: externalComparisonIndex
               
```

### Core Architecture Module: `AppPorts/Utils/ContainerRemountLoop.swift`
```
//
//  ContainerRemountLoop.swift
//  AppPorts
//

import Foundation

// MARK: - 重挂载重试循环

/// 自动挂载代理的重试策略：**只在真的发生事件时重试**，定时器只当兜底。
///
/// 为什么不是纯定时轮询：开机时系统很忙，外置盘可能过很久才被识别
/// （2026-09-23 那次是开机后 2 分 33 秒）。间隔太短会在开机最忙的时候空转 diskutil
/// （一次查询约 1 秒），间隔太长又会错过微信启动（登录后约 43 秒）。
/// 改成等 `/Volumes` 的真实事件后：盘一出现立刻重试，实测事件到挂载完成约 1 秒。
enum ContainerRemountLoop {

    struct Policy: Equatable, Sendable {
        /// 总等待窗口；用满就收工，剩下的交给下一次 `/Volumes` 变化或下次登录。
        var window: TimeInterval = 180
        /// 完全没有事件时的兜底复查间隔。只为兜住"事件丢了"这种意外，不是主要触发方式。
        var backstop: TimeInterval = 20
        /// 最多重试轮数（双保险，避免任何情况下死循环）。
        var maxCycles: Int = 20
    }

    /// 一轮尝试的结果。
    enum Attempt: Sendable {
        /// 让路：AppPorts 主应用正在做容器操作，这一轮没跑。保持原状态继续等。
        case deferred
        /// 跑完了，这是每条记录的状态。
        case results([ContainerVolumeMigrator.RemountOutcome])
    }

    enum StopReason: Equatable, Sendable {
        /// 所有记录都就位了。
        case settled
        /// 没有任何挂载记录。
        case noRecords
        /// 窗口用尽。
        case windowExpired
        /// 达到轮数上限。
        case cycleLimit
        /// 每一轮都在让路，一次都没跑成。
        case alwaysDeferred
    }

    struct Result: Sendable {
        let outcomes: [ContainerVolumeMigrator.RemountOutcome]
        let cycles: Int
        let deferredCycles: Int
        let reason: StopReason

        /// 是否真的等过（用来决定要不要在日志里交代等待过程）。
        var waited: Bool { cycles > 1 }
    }

    /// 还需要继续等的记录：卷没上线，或者这一轮挂载没成功。
    static func pendingRecords(
        in outcomes: [ContainerVolumeMigrator.RemountOutcome]
    ) -> [ContainerVolumeMigrator.RemountOutcome] {
        outcomes.filter {
            switch $0.state {
            case .mounted, .alreadyMounted, .requiresIntervention: return false
            case .unavailable, .failed: return true
            }
        }
    }

    /// 跑一轮重挂载；没就位就等事件，等到就再跑一轮。
    ///
    /// - Parameters:
    ///   - attempt: 一轮尝试（拿锁 → 重挂载 → 放锁）。锁只在单轮里持有，等待期间不占锁，
    ///     用户此刻在 AppPorts 里的操作不会被卡住。
    ///   - waitForChange: 等下一次目录变化的秒数（返回 nil 表示超时）；定时器只做兜底。
    ///   - now: 时间源，测试时注入。
    static func run(
        policy: Policy = Policy(),
        attempt: () async -> Attempt,
        waitForChange: (TimeInterval) async -> VolumeChangeMonitor.Change?,
        now: @escaping @Sendable () -> Date = { Date() }
    ) async -> Result {
        let deadline = now().addingTimeInterval(policy.window)
        var outcomes: [ContainerVolumeMigrator.RemountOutcome] = []
        var cycles = 0
        var deferredCycles = 0
        var sawResults = false
        var waitingLogged = false
        var stopReason: StopReason?

        while cycles < policy.maxCycles {
            cycles += 1
            switch await attempt() {
            case .deferred:
                deferredCycles += 1
            case .results(let latest):
                sawResults = true
                outcomes = latest
                if latest.isEmpty {
                    return Result(outcomes: latest, cycles: cycles, deferredCycles: deferredCycles, reason: .noRecords)
                }
                let pending = pendingRecords(in: latest)
                if pending.isEmpty {
                    return Result(outcomes: latest, cycles: cycles, deferredCycles: deferredCycles, reason: .settled)
                }
                if !waitingLogged {
                    waitingLogged = true
                    AppLogger.shared.logContext(
                        "还有挂载点没就位，开始等外置卷出现",
                        details: [
                            ("pending", String(pending.count)),
                            ("window_seconds", Self.seconds(policy.window)),
                            ("backstop_seconds", Self.seconds(policy.backstop))
                        ]
                    )
                    for outcome in pending {
                        AppLogger.shared.logContext(
                            "等待中的挂载点",
                            details: [
                                ("mount_point", outcome.record.mountPointPath),
                                ("volume", outcome.record.volumeName),
                                ("state", String(describing: outcome.state))
                            ],
                            level: "TRACE"
                        )
                    }
                }
            }

            let remaining = deadline.timeIntervalSince(now())
            guard remaining > 0 else {
                stopReason = .windowExpired
                break
            }
            let timeout = min(remaining, policy.backstop)
            if let change = await waitForChange(timeout) {
                AppLogger.shared.logContext(
                    "等到目录变化，重试挂载",
                    details: [
                        ("cycle", String(cycles)),
                        ("waited_seconds", String(format: "%.1f", change.waited)),
                        ("flags", change.flagsDescription)
                    ]
                )
            } else if remaining > policy.backstop {
                AppLogger.shared.logContext(
                    "等待窗口内没有目录变化，兜底复查一次",
                    details: [("cycle", String(cycles)), ("timeout_seconds", Self.seconds(timeout))],
                    level: "TRACE"
                )
            }
        }

        // 一次都没跑成（一直在给主应用让路）时如实说明，别让日志看起来像"没有记录"。
        let reason: StopReason = (!sawResults && deferredCycles > 0) ? .alwaysDeferred : (stopReason ?? .cycleLimit)
        return Result(outcomes: outcomes, cycles: cycles, deferredCycles: deferredCycles, reason: reason)
    }

    private static func seconds(_ interval: TimeInterval) -> String {
        String(Int(interval.rounded()))
    }
}

```

### Core Architecture Module: `AppPorts/Utils/ContainerVolumeMigrator.swift`
```
//
//  ContainerVolumeMigrator.swift
//  AppPorts
//

import Darwin
import Foundation

// MARK: - 容器数据挂载迁移器

/// 沙盒应用容器数据的挂载迁移器。
///
/// 与 `DataDirMover` 的符号链接策略并列：沙盒应用无法透过符号链接访问容器外路径
/// （内核按解析后的真实路径判定），这里改为在外置盘的 APFS 容器中新建一个卷，
/// 把它挂载到容器内的原目录上。路径不离开容器，应用签名与 entitlements 不做任何修改。
///
/// ## 操作流程
/// - **迁移**：建卷 → 临时挂载并复制 → 卸载 → 原目录改名为安全备份 → 在原路径挂载 → 写记录 → 保留原件待验证
/// - **还原**：确保已挂载 → 复制到暂存目录 → 卸载 → 暂存目录改回原路径 → 保留外置卷待验证
/// - **挂载 / 卸载**：只处理已有记录。未挂载期间挂载点保持 000 权限，
///   应用在盘不在时只会看到空目录，不会把新数据写进本地形成分叉。
actor ContainerVolumeMigrator {

    enum MigrationError: LocalizedError {
        case sourceNotDirectory(URL)
        case alreadyManaged(URL)
        case externalNotAPFS(URL)
        case encryptedDestination
        case unexpectedMountedVolume(URL)
        case volumeCreationFailed(String)
        case mountFailed(URL, String)
        case mountVerificationFailed(URL)
        case mountPointNotEmpty(URL)
        case mountPointConflict(URL, String)
        case unmountFailed(URL, String)
        case volumeUnavailable(String)
        case insufficientSpace(required: Int64, available: Int64)
        case copyFailed(Error)
        case switchFailed(Error)
        case rollbackIncomplete(backup: URL, volumeName: String, volumeUUID: String, underlying: Error)
        /// 还原时本地副本已复制好，但没能换到原路径。外置卷和记录保持不变。
        case restoreIncomplete(staging: URL, underlying: Error)
        case restoreRecordRecovery(staging: URL, underlying: Error)
        case ownershipRollbackFailed(URL, operation: Error, rollback: Error)

        var errorDescription: String? {
            switch self {
            case .sourceNotDirectory(let url):
                return String(format: "该路径不是真实目录，无法挂载迁移：%@".localized, url.lastPathComponent)
            case .alreadyManaged(let url):
                return String(format: "该目录已经是挂载迁移项：%@".localized, url.lastPathComponent)
            case .externalNotAPFS(let url):
                return String(format: "外部存储不是 APFS 格式，无法创建挂载卷：%@".localized, url.path)
            case .encryptedDestination:
                return "所选 APFS 卷已加密，新建数据卷不会继承它的密码。为避免降低数据保护，当前版本不支持向此位置挂载迁移；原数据未改动，可以继续保留现状。".localized
            case .unexpectedMountedVolume(let url):
                return String(format: "此目录挂载的卷与迁移记录不一致，已停止操作并保留数据：%@".localized, url.path)
            case .volumeCreationFailed(let output):
                return String(format: "创建外置卷失败：%@".localized, output)
            case .mountFailed(let url, let output):
                return String(format: "挂载到容器目录失败：%@\n%@".localized, url.path, output)
            case .mountVerificationFailed(let url):
                return String(format: "挂载后校验失败，该路径不是挂载点：%@".localized, url.path)
            case .mountPointConflict(let url, let details):
                return String(format: "挂载点出现并发变化，已保留两端数据，请检查后恢复：%@\n%@".localized, url.path, details)
            case .mountPointNotEmpty(let url):
                return String(format: "挂载点目录不为空，为避免覆盖数据已停止操作：%@".localized, url.path)
            case .unmountFailed(let url, let output):
                return String(format: "卸载失败，可能有应用正在使用该目录：%@\n%@".localized, url.path, output)
            case .volumeUnavailable(let name):
                return String(format: "找不到外置卷「%@」，请确认外部存储已连接".localized, name)
            case .insufficientSpace(let required, let available):
                return String(
                    format: "空间不足：需要约 %@ 可用空间，目前只有 %@。未做任何改动。".localized,
                    LocalizedByteCountFormatter.string(fromByteCount: required),
                    LocalizedByteCountFormatter.string(fromByteCount: available)
                )
            case .copyFailed(let error):
                return String(format: "复制失败：%@".localized, error.localizedDescription)
            case .switchFailed(let error):
                return String(format: "切换挂载点失败，数据已紧急还原：%@".localized, error.localizedDescription)
            case .rollbackIncomplete(let backup, let volumeName, let volumeUUID, let error):
                return String(
                    format: "挂载迁移未完成，原数据保留在「%@」，未覆盖当前路径。外置卷「%@」（%@）也已保留。请检查挂载点后再恢复。%@".localized,
                    backup.path, volumeName, volumeUUID, error.localizedDescription
                )
            case .restoreIncomplete(let staging, let error):
                return String(
                    format: "还原没有完成：外置卷上的数据和迁移记录保持不变，已复制到本机的副本保留在「%@」。%@".localized,
                    staging.path,
                    error.localizedDescription
                )
            case .restoreRecordRecovery(let staging, let error):
                return String(
                    format: "还原未完成，已复制的本地数据保留在「%@」，外置卷也已保留。请检查迁移记录和挂载状态后重试。%@".localized,
                    staging.path, error.localizedDescription
                )
            case .ownershipRollbackFailed(let url, let operation, let rollback):
                return String(format: "还原失败，且无法恢复卷的原挂载选项；数据已保留，请检查挂载状态：%@\n%@\n%@".localized,
                              url.path, operation.localizedDescription, rollback.localizedDescription)
            }
        }
    }

    struct MigrationResult: Sendable {
        let record: ContainerMountRecord
        let cleanupWarning: CleanupWarning?
    }

    /// 主操作已完成，副本或记录清理尚未完成；调用方须按部分成功呈现。
    struct CleanupWarning: Sendable {
        let cleanup: ContainerCleanupRecord
        let details: String
        var needsRecordUpdateOnly = false

        var message: String {
            if needsRecordUpdateOnly {
                return String(format: "数据操作和副本清理已完成，但清理记录尚未更新。请稍后重试。%@".localized, details)
            }
            switch cleanup.kind {
            case .migrationBackup:
                return String(
                    format: "挂载迁移已完成，但本地安全备份仍保留在「%@」。可稍后重试清理；当前挂载数据不受影响。%@".localized,
                    cleanup.localPath, details
                )
            case .restoredVolume:
                return String(
                    format: "数据已还原到「%@」，但外置卷「%@」（%@）的清理尚未完成。该卷不会再自动挂载，请稍后重试清理。%@".localized,
                    cleanup.localPath, cleanup.mountRecord.volumeName, cleanup.mountRecord.volumeUUID, details
                )
            }
        }
    }

    /// 卷现在挂在哪 —— 决定挂载前要不要先把它从别处卸下来。
    enum KnownMountPoint: Equatable {
        /// 还没查过，需要一次 `diskutil info`（开机时这条要一秒上下）。
        case unknown
        /// 查过，卷没挂在任何地方。
        case unmounted
        /// 卷挂在别的位置（多半是系统自动挂到了 `/Volumes`）。
        case mounted(at: URL)
    }

    struct RemountOutcome: Sendable {
        enum State: Equatable, Sendable {
            case alreadyMounted
            case mounted
            case unavailable
            case failed(String)
            case requiresIntervention(String)
        }

        let record: ContainerMountRecord
        let state: State
    }

    static let volumeMarkerFileName = ".appports-mount-metadata.plist"
    /// 系统自动挂载外置卷的位置：`/Volumes/<卷名>`。挂载前先看一眼这里能省掉一次 diskutil 查询。
    static let autoMountRoot = "/Volumes"
    /// 卷根的防索引标记：系统会把挂到容器路径上的卷当成普通外置卷索引，
    /// 两个微信卷实测留下过合计约 110 MB 的 `.Spotlight-V100`。空文件放在卷根，
    /// mds 就会跳过整个卷；标记写在卷上，跟着卷走，不需要任何系统设置。
    static let neverIndexFileName = ".metadata_never_index"
    private static let managedIdentifier = "com.shimoko.AppPorts"
    private static let lockedMountPointMode: mode_t = 0o000
    private static let openMountPointMode: mode_t = 0o700
    /// 挂载动作的尝试轮数：命令报告成功但挂载点没出现时（被系统自动挂载抢先）重来。
    static let maximumMountAttempts = 3
    /// 两次挂载尝试之间的间隔，给自动挂载留出落地时间。
    private static let mountRetrySettleNanoseconds: UInt64 = 500_000_000
    /// 卷根目录上由系统创建、不属于应用数据的条目，还原时不带回本地。
    private static let volumeSystemArtifacts: Set<String> = [
        volumeMarkerFileName, neverIndexFileName, ".fseventsd", ".Spotlight-V100", ".Trashes", ".TemporaryItems",
        ".DocumentRevisions-V100", ".PKInstallSandboxManager", ".PKInstallSandboxManager-SystemSoftware"
    ]

    /// 复制这么多数据需要预留的可用空间：数据本身加 5% 余量，至少多留 256 MB 给文件系统元数据。
    static func requiredFreeBytes(forDataBytes bytes: Int64) -> Int64 {
        bytes + max(bytes / 20, 256 * 1024 * 1024)
    }

    private struct VolumeMarker: Codable {
        let schemaVersion: Int
        let managedBy: String
        let mountPointPath: String
        let volumeUUID: String
        let dataDirType: String
        let appName: String
        let createdAt: Date
    }

    private let fileManager = FileManager.default
    private let disk: DiskUtility
    private let store: ContainerMountStore
    private let isMountPoint: @Sendable (URL) -> Bool
    private let mountedVolumePath: @Sendable (URL) -> String?
    private let mountedVolumeUUID: @Sendable (URL) -> String?
    /// 读卷根迁移标记里的 Volume UUID。挂载前用它确认 `/Volumes/<卷名>` 上挂的就是我们要的卷，
    /// 测试注入假实现，避免真去读磁盘。
    private let volumeUUIDMarker: @Sendable (URL) -> String?
    /// 记录增删后同步登录代理的安装状态；测试注入空实现，避免动真实 LaunchAgents。
    private let synchronizeAgent: @Sendable (ContainerMountStore) -> Void
    /// 路径所在卷的可用空间；返回 nil 表示查不到，此时不拦截。测试注入固定值。
    private let availableCapacity: @Sendable (URL) -> Int64?
    /// 挂载点的挂载标志，用来发现早期版本挂上、仍会显示在 Finder 里的卷。测试注入固定值。
    private let mountFlags: @Sendable (URL) -> UInt32?
    private let stagingMountRootURL: URL
    private let safety: DataOperationSafety
    private let makeMountPointLease: @Sendable (URL) throws -> any MountPointLeasing

    init(
        disk: DiskUtility = DiskUtility(),
        store: ContainerMountStore = .shared,
        stagingMountRootURL: URL? = nil,
        isMountPoint: @escaping @Sendable (URL) -> Bool = { DiskUtility.isMountPoint($0) },
        mountedVolumePath: @escaping @Sendable (URL) -> String? = { DiskUtility.mountedVolumePath(containing: $0) },
        mountedVolumeUUID: @escaping @Sendable (URL) -> String? = { DiskUtility.mountedVolumeUUID(at: $0) },
        volumeUUIDMarker: @escaping @Sendable (URL) -> String? = { ContainerVolumeMigrator.readVolumeMarkerUUID(at: $0) },
        synchronizeAgent: @escaping @Sendable (ContainerMountStore) -> Void = { ContainerMountAgentInstaller.installIfNeeded(store: $0) },
        availableCapacity: @escaping @Sendable (U
```

### Core Architecture Module: `AppPorts/Utils/CustomDirScanner.swift`
```
//
//  CustomDirScanner.swift
//  AppPorts
//
//  Created by Codex on 2026/6/26.
//

import Foundation

actor CustomDirScanner {
    private let fileManager: FileManager

    init(fileManager: FileManager = .default) {
        self.fileManager = fileManager
    }

    func scan(configs: [CustomDirConfig], calculateSizes: Bool = false) -> [CustomDirPair] {
        configs.map { scan(config: $0, calculateSizes: calculateSizes) }
    }

    private func scan(config: CustomDirConfig, calculateSizes: Bool) -> CustomDirPair {
        let localURL = config.localURL
        let externalURL = config.externalDestinationURL
        let localState = inspectLocal(localURL: localURL, expectedExternalURL: externalURL)
        let externalExists = fileManager.fileExists(atPath: externalURL.path)
        let externalStatus: String

        if externalExists {
            externalStatus = localState.status == CustomDirStatus.linked
                ? CustomDirStatus.linked
                : CustomDirStatus.pendingRelink
        } else {
            externalStatus = CustomDirStatus.missing
        }

        var localEntry = CustomDirEntry(
            config: config,
            kind: .local,
            url: localURL,
            status: localState.status,
            linkedDestination: localState.linkedDestination
        )
        var externalEntry = CustomDirEntry(
            config: config,
            kind: .external,
            url: externalURL,
            status: externalStatus,
            linkedDestination: localState.status == CustomDirStatus.linked ? localURL : nil
        )

        if calculateSizes {
            applySize(to: &localEntry)
            applySize(to: &externalEntry)
        }

        return CustomDirPair(config: config, local: localEntry, external: externalEntry)
    }

    private func inspectLocal(localURL: URL, expectedExternalURL: URL) -> (status: String, linkedDestination: URL?) {
        if isSymbolicLink(at: localURL) {
            guard let destination = resolveSymlinkDestination(of: localURL) else {
                return (CustomDirStatus.orphanedLink, nil)
            }

            if fileManager.fileExists(atPath: destination.path) {
                let status = destination.standardizedFileURL == expectedExternalURL.standardizedFileURL
                    ? CustomDirStatus.linked
                    : CustomDirStatus.destinationConflict
                return (status, destination.standardizedFileURL)
            }

            return (CustomDirStatus.orphanedLink, destination.standardizedFileURL)
        }

        if fileManager.fileExists(atPath: localURL.path) {
            return (CustomDirStatus.local, nil)
        }

        return (CustomDirStatus.missing, nil)
    }

    private func applySize(to entry: inout CustomDirEntry) {
        guard fileManager.fileExists(atPath: entry.url.path) else { return }
        let sizeBytes = fastDirectorySize(at: entry.url, fileManager: fileManager)
        entry.sizeBytes = sizeBytes
        entry.size = LocalizedByteCountFormatter.string(fromByteCount: sizeBytes)
    }

    private func isSymbolicLink(at url: URL) -> Bool {
        guard let attrs = try? fileManager.attributesOfItem(atPath: url.path),
              let fileType = attrs[.type] as? FileAttributeType else {
            return false
        }
        return fileType == .typeSymbolicLink
    }

    private func resolveSymlinkDestination(of url: URL) -> URL? {
        guard let destinationPath = try? fileManager.destinationOfSymbolicLink(atPath: url.path) else {
            return nil
        }

        if destinationPath.hasPrefix("/") {
            return URL(fileURLWithPath: destinationPath).standardizedFileURL
        }

        return url
            .deletingLastPathComponent()
            .appendingPathComponent(destinationPath)
            .standardizedFileURL
    }
}

```

### Core Architecture Module: `AppPorts/Utils/DataDirMover.swift`
```
import Darwin
import Foundation

/// Data-tree operations retain verified originals until explicit cleanup.
/// UI flags never authorize execution; every entry point evaluates real paths and durable topology.
actor DataDirMover {
    private let fileManager = FileManager.default
    private let homeDir: URL
    private let store: ContainerMountStore
    private let safety: DataOperationSafety
    private let failSymlinkCreation: Bool
    private let managedLinkMarkerFileName = ".appports-link-metadata.plist"
    private let managedLinkMetadataSidecarSuffix = ".appports-link-metadata.plist"
    private let managedLinkIdentifier = "com.shimoko.AppPorts"
    private let managedLinkSchemaVersion = 1

    private struct ManagedLinkMetadata: Codable, Sendable {
        let schemaVersion: Int
        let managedBy: String
        let sourcePath: String
        let destinationPath: String
        let dataDirType: String
    }

    init(homeDir: URL = URL(fileURLWithPath: NSHomeDirectory()),
         failSymlinkCreation: Bool = false, failSourceBackupCleanup: Bool = false,
         store: ContainerMountStore = .shared, runner: any ShellCommandRunning = ProcessCommandRunner()) {
        self.homeDir = homeDir.standardizedFileURL
        self.store = store
        self.safety = DataOperationSafety(homeDirectory: homeDir, store: store, runner: runner)
        self.failSymlinkCreation = failSymlinkCreation
        // Kept source-compatible with older callers. Success now always retains the original.
        _ = failSourceBackupCleanup
    }

    func migrate(item: DataDirItem, to externalBaseURL: URL, progressHandler: FileCopier.ProgressHandler?) async throws {
        let source = item.path.standardizedFileURL
        let destination = externalBaseURL.appendingPathComponent(source.lastPathComponent).standardizedFileURL
        try requirePolicy(source)
        guard !isSymbolicLink(at: source) else { throw DataDirError.destinationExists(source) }
        guard !DiskUtility.isMountPoint(source) else { throw DataOperationSafety.Failure.conflict(source.path) }
        guard try !entryExists(destination) else { throw DataDirError.destinationExists(destination) }
        try requireMarker(at: source, for: source, type: item.type, allowOwned: false)
        try await safety.requireNewMigration(at: source, destination: destination, bundleIdentifier: item.associatedBundleIdentifier)
        let id = UUID()
        let backup = source.deletingLastPathComponent().appendingPathComponent(".appports-migration-backup-\(source.lastPathComponent)-\(id)")
        var transfer = DataTransferRecord(operationID: id, mode: .symlink, direction: .migrate, sourceID: item.id,
            appName: item.associatedAppName ?? item.name, bundleIdentifier: item.associatedBundleIdentifier,
            dataDirType: item.type.rawValue, originalPath: source.path, activePath: source.path,
            destinationPath: destination.path, backupPath: backup.path,
            sourceIdentity: try DataPathIdentity.capture(source))
        try store.beginTransfer(transfer)
        do {
            try checkWritePermission(at: externalBaseURL)
            transfer.phase = .copying
            try store.updateTransfer(transfer)
            let baseline = try await copy(from: source, to: destination, final: destination, progress: progressHandler)
            try requireMarker(at: source, for: source, type: item.type, allowOwned: false)
            try installMarker(source: source, destination: destination, type: item.type, baseline: baseline)
            transfer.destinationIdentity = try DataPathIdentity.capture(destination)
            transfer.baseline = try PropertyListEncoder().encode(baseline)
            transfer.phase = .verified
            try store.updateTransfer(transfer)
            await progressHandler?(.init(copiedBytes: baseline.logicalBytes, totalBytes: baseline.logicalBytes, currentFile: "正在切换本地入口...".localized))
            try await safety.requireNoKnownWriters(at: source, bundleIdentifier: item.associatedBundleIdentifier)
            try requireIdentity(source, transfer.sourceIdentity)
            try requireMarker(at: source, for: source, type: item.type, allowOwned: false)
            try TreeCopySession.verifyUnchanged(at: source, against: baseline)
            try TreeCopySession.verifyCopy(at: destination, against: baseline)
            transfer.phase = .switching
            try store.updateTransfer(transfer)
            try DataTreeRelocator.move(source, to: backup)
            transfer.backupIdentity = try DataPathIdentity.capture(backup)
            try requireIdentity(backup, transfer.sourceIdentity)
            try store.updateTransfer(transfer)
            await progressHandler?(.init(copiedBytes: baseline.logicalBytes, totalBytes: baseline.logicalBytes, currentFile: "正在创建符号链接...".localized))
            try requireMarker(at: backup, for: source, type: item.type, allowOwned: false)
            try TreeCopySession.verifyUnchanged(at: backup, against: baseline)
            do { try createSymbolicLink(at: source, withDestinationURL: destination) }
            catch {
                // The backup is still complete; never overwrite a competing entry during rollback.
                if try !entryExists(source) { try DataTreeRelocator.move(backup, to: source) }
                throw DataDirError.symlinkFailed(error)
            }
            transfer.activePath = destination.path
            try requireMarker(at: backup, for: source, type: item.type, allowOwned: false)
            try TreeCopySession.verifyUnchanged(at: backup, against: baseline)
            try TreeCopySession.verifyCopy(at: destination, against: baseline)
            try store.commitMigration(record: nil, transfer: transfer)
            invalidateSizeCache(for: source)
            invalidateSizeCache(for: destination)
        } catch { try recordFailure(&transfer, error: error) }
    }

    func restore(item: DataDirItem, progressHandler: FileCopier.ProgressHandler?) async throws {
        let local = item.path.standardizedFileURL
        let indexed = try store.managedLink(forOriginalPath: local.path)
        let existingTransfers = try store.transfers()
        if !isSymbolicLink(at: local), indexed == nil,
           let completed = existingTransfers.last(where: { $0.direction == .restore && $0.originalPath == local.path && [.awaitingUserVerification, .cleanupRequested].contains($0.phase) }),
           let identity = completed.destinationIdentity, let current = try? DataPathIdentity.capture(local), identity.matchesFilesystemObject(current) { return }
        let linkIdentity: DataPathIdentity?
        let external: URL
        if isSymbolicLink(at: local) {
            linkIdentity = try DataPathIdentity.capture(local)
            external = local.resolvingSymlinksInPath()
        } else if let indexed, try !entryExists(local) {
            linkIdentity = nil
            external = URL(fileURLWithPath: indexed.destinationPath)
        } else { throw DataDirError.notASymlink(local) }
        guard fileManager.fileExists(atPath: external.path), !isSymbolicLink(at: external) else { throw DataDirError.externalNotFound(external) }
        let sourceIdentity = try DataPathIdentity.capture(external)
        if let indexed {
            guard DataPathTopology.relationship(indexed.destinationPath, external.path) == .same,
                  indexed.destinationIdentity.matchesFilesystemObject(sourceIdentity) else { throw DataOperationSafety.Failure.conflict(external.path) }
        }
        try requireMarker(at: external, for: local, type: item.type, allowOwned: true)
        let prior = indexed?.operationID ?? existingTransfers.last(where: {
            $0.direction == .migrate && $0.originalPath == local.path && $0.destinationIdentity?.matchesFilesystemObject(sourceIdentity) == true
        })?.operationID
        let ownedIDs = prior.map { transferAncestors(of: $0, transfers: existingTransfers) } ?? []
        try safety.requireNoOverlap(at: local, ownedTransferIDs: ownedIDs, ownedLinkPath: indexed?.originalPath)
        try safety.requireNoOverlap(at: external, ownedTransferIDs: ownedIDs, ownedLinkPath: indexed?.originalPath)
        try requireLocalRestoreParent(local)
        try await safety.requireNoKnownWriters(at: external, bundleIdentifier: item.associatedBundleIdentifier ?? indexed?.bundleIdentifier)
        let id = UUID()
        let staging = local.deletingLastPathComponent().appendingPathComponent(".appports-restore-\(id)")
        let copyURL = staging.appendingPathComponent("data")
        var transfer = DataTransferRecord(operationID: id, mode: .symlink, direction: .restore, sourceID: item.id,
            appName: item.associatedAppName ?? item.name, bundleIdentifier: item.associatedBundleIdentifier ?? indexed?.bundleIdentifier,
            dataDirType: item.type.rawValue, originalPath: local.path, activePath: external.path, destinationPath: local.path,
            backupPath: external.path, stagingPath: staging.path, sourceIdentity: sourceIdentity,
            backupIdentity: sourceIdentity, priorOperationID: prior)
        try store.beginTransfer(transfer)
        do {
            try fileManager.createDirectory(at: staging, withIntermediateDirectories: true)
            transfer.phase = .copying
            try store.updateTransfer(transfer)
            let baseline = try await copy(from: external, to: copyURL, final: local, progress: progressHandler)
            transfer.destinationIdentity = try DataPathIdentity.capture(copyURL)
            transfer.baseline = try PropertyListEncoder().encode(baseline)
            transfer.phase = .verified
            try store.updateTransfer(transfer)
            try await safety.requireNoKnownWriters(at: external, bundleIdentifier: transfer.bundleIdentifier)
            try requireIdentity(external, sourceIdentity)
            try requireMarker(at: external, for: local, type: item.type, allowOwned: true)
            
```

### Core Architecture Module: `AppPorts/Utils/DataDirScanner.swift`
```
//
//  DataDirScanner.swift
//  AppPorts
//
//  Created by shimoko.com on 2026/3/4.
//

import Foundation

// MARK: - 已知 dotFolder 描述结构

/// 内置已知工具目录的描述信息
private struct KnownDotFolder {
    let name: String
    let relativePath: String       // 相对于 ~ 的路径，如 ".npm" 或 ".cache/torch"
    let priority: DataDirPriority
    let description: String
    let isMigratable: Bool
    let nonMigratableReason: String?

    init(name: String, relativePath: String,
         priority: DataDirPriority = .recommended,
         description: String,
         isMigratable: Bool = true,
         nonMigratableReason: String? = nil) {
        self.name = name
        self.relativePath = relativePath
        self.priority = priority
        self.description = description
        self.isMigratable = isMigratable
        self.nonMigratableReason = nonMigratableReason
    }
}

private struct AppMatchProfile {
    let exactMatches: Set<String>
    let containsMatches: [String]
    let shortPrefixMatches: [String]
}

private struct AppDataSearchConfig {
    let localBaseURL: URL
    let type: DataDirType
    let priority: DataDirPriority
    let description: String
}

// MARK: - 数据目录扫描器

/// 扫描应用关联数据目录和已知工具 dotFolder
///
/// 使用 Actor 模型在后台线程安全地执行扫描，不阻塞 UI。
///
/// ## 功能
/// 1. 根据 AppItem（BundleID + AppName）扫描 ~/Library/ 关联目录
/// 2. 扫描内置已知 dotFolder 列表（~/.npm、~/.m2 等）
/// 3. 检测每个目录当前状态（本地 / 已链接 / 现有软链 / 未找到）
///
/// ## 使用示例
/// ```swift
/// let scanner = DataDirScanner()
/// // 扫描工具目录
/// let dotItems = await scanner.scanKnownDotFolders()
/// // 扫描应用关联目录
/// let libItems = await scanner.scanLibraryDirs(for: someApp)
/// ```

// MARK: - 快速目录大小计算（非 actor 隔离，支持并发）

/// 目录大小缓存，减少重复遍历
private let directorySizeCache: NSCache<NSString, NSNumber> = {
    let c = NSCache<NSString, NSNumber>()
    c.countLimit = 200
    return c
}()

/// 缓存键带上当前挂载状态。挂载点被挂上或卸下时目录内容会整体替换，
/// 状态一变就等于缓存失效，不会把卸载前那份旧大小继续报给界面。
private func sizeCacheKey(for path: String, isMountPoint: Bool) -> NSString {
    "\(path)|\(isMountPoint ? "mount" : "plain")" as NSString
}

/// 子目录内容变更也会改变所有父目录的总大小，两种挂载状态的缓存都要失效。
func invalidateSizeCache(for url: URL) {
    var path = url.standardizedFileURL.path
    while !path.isEmpty {
        directorySizeCache.removeObject(forKey: sizeCacheKey(for: path, isMountPoint: true))
        directorySizeCache.removeObject(forKey: sizeCacheKey(for: path, isMountPoint: false))
        guard path != "/" else { break }
        path = (path as NSString).deletingLastPathComponent
    }
}

/// 清除全部大小缓存
func clearSizeCache() {
    directorySizeCache.removeAllObjects()
}

/// 非隔离的快速目录大小计算，支持 TaskGroup 并发调用。
///
/// 优先级：内存缓存 → FileManager.enumerator
/// 注意：不对目录使用 Spotlight（kMDItemFSSize 对目录不可靠，PearCleaner 也跳过了）
func fastDirectorySize(
    at url: URL,
    fileManager: FileManager = .default,
    isMountPoint: (URL) -> Bool = { DiskUtility.isMountPoint($0) }
) -> Int64 {
    measureDirectorySize(at: url, fileManager: fileManager, isMountPoint: isMountPoint).bytes
}

/// 界面需要同时知道大小和读取是否完整，不能把读取失败当成 0 字节。
func measureDirectorySize(
    at url: URL,
    fileManager: FileManager = .default,
    useCache: Bool = true,
    isMountPoint: (URL) -> Bool = { DiskUtility.isMountPoint($0) }
) -> DirectorySizeResult {
    let cacheKey = sizeCacheKey(for: url.standardizedFileURL.path, isMountPoint: isMountPoint(url))
    if useCache, let cached = directorySizeCache.object(forKey: cacheKey) {
        return DirectorySizeResult(bytes: cached.int64Value)
    }
    directorySizeCache.removeObject(forKey: cacheKey)

    let resourceKeys: [URLResourceKey] = [.isRegularFileKey, .fileSizeKey, .isSymbolicLinkKey, .isDirectoryKey]
    let values: URLResourceValues
    do {
        values = try url.resourceValues(forKeys: Set(resourceKeys))
    } catch {
        return DirectorySizeResult(readIssues: [DataDirReadIssue(url: url, error: error)])
    }

    // 单文件：直接返回大小
    if values.isRegularFile == true {
        let size = Int64(values.fileSize ?? 0)
        directorySizeCache.setObject(NSNumber(value: size), forKey: cacheKey)
        return DirectorySizeResult(bytes: size)
    }

    guard values.isDirectory == true else { return DirectorySizeResult() }

    // 枚举器遍历（单次批量遍历，替代手动递归的 contentsOfDirectory）
    var result = DirectorySizeResult()
    guard let enumerator = fileManager.enumerator(
        at: url,
        includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey, .isSymbolicLinkKey],
        options: [],
        errorHandler: { failedURL, error in
            result.readIssues.append(DataDirReadIssue(url: failedURL, error: error))
            return true
        }
    ) else {
        return DirectorySizeResult(readIssues: [DataDirReadIssue(url: url, error: CocoaError(.fileReadUnknown))])
    }

    for case let fileURL as URL in enumerator {
        do {
            let attrs = try fileURL.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey, .isSymbolicLinkKey])
            guard attrs.isSymbolicLink != true, attrs.isRegularFile == true,
                  let fileSize = attrs.fileSize else { continue }
            result.bytes += Int64(fileSize)
        } catch {
            result.readIssues.append(DataDirReadIssue(url: fileURL, error: error))
        }
    }
    // 0 不写缓存：未挂载的挂载点就是一个空目录，算出来同样是 0；缓存下来会让卷挂好之后
    // 一直显示「0 字节」。空目录重新遍历的代价可以忽略，所以每次重算更安全。
    if result.isComplete && result.bytes > 0 {
        directorySizeCache.setObject(NSNumber(value: result.bytes), forKey: cacheKey)
    }
    return result
}

// MARK: - 数据目录扫描器

actor DataDirScanner {

    private let fileManager = FileManager.default
    private let homeDir: URL
    private let managedLinkMarkerFileName = ".appports-link-metadata.plist"
    private let managedLinkMetadataSidecarSuffix = ".appports-link-metadata.plist"
    private let managedLinkIdentifier = "com.shimoko.AppPorts"
    private let managedLinkSchemaVersion = 1
    private let mountStore: ContainerMountStore
    private let isMountPoint: @Sendable (URL) -> Bool
    private let isVolumeOnline: @Sendable (String) -> Bool
    private let isSandboxedApplication: @Sendable (URL) -> Bool
    /// 本轮扫描开始时读取一次的挂载记录，避免逐路径重复读文件。
    private var mountRecordsByPath: [String: ContainerMountRecord] = [:]
    private var recoveryInspection: ContainerMountStore.Inspection?
    private var readIssues: [DataDirReadIssue] = []

    private struct ManagedLinkMetadata: Codable, Sendable {
        let schemaVersion: Int
        let managedBy: String
        let sourcePath: String
        let destinationPath: String
        let dataDirType: String
    }

    init(
        homeDir: URL = URL(fileURLWithPath: NSHomeDirectory()),
        mountStore: ContainerMountStore = .shared,
        isMountPoint: @escaping @Sendable (URL) -> Bool = { DiskUtility.isMountPoint($0) },
        isVolumeOnline: @escaping @Sendable (String) -> Bool = { DiskUtility.isVolumeOnline($0) },
        isSandboxedApplication: @escaping @Sendable (URL) -> Bool = { DataDirScanner.isSandboxedRealApplication($0) }
    ) {
        self.homeDir = homeDir.standardizedFileURL
        self.mountStore = mountStore
        self.isMountPoint = isMountPoint
        self.isVolumeOnline = isVolumeOnline
        self.isSandboxedApplication = isSandboxedApplication
    }

    /// 解析入口到真实应用后读取 entitlements；找不到真实应用时按非沙盒处理，
    /// 后续的重签名与挂载入口会各自再做校验。
    static func isSandboxedRealApplication(_ appURL: URL) -> Bool {
        guard let realURL = try? CodeSigner.resolveAppURL(at: appURL) else { return false }
        return CodeSigner.isSandboxed(at: realURL)
    }

    /// 关联应用是否为沙盒应用。沙盒应用迁移数据后不能重签名。
    /// 容器目录本身是否需要挂载迁移不看这个值：见 `scanLibraryDirs` 中的统一规则。
    func isSandboxed(_ app: AppItem) -> Bool {
        guard !app.isFolder else { return false }
        return isSandboxedApplication(app.displayURL)
    }

    // MARK: - 内置已知 dotFolder 列表

    private let knownDotFolders: [KnownDotFolder] = [
        // ── 开发工具 / 包管理 ────────────────────────────────────
        KnownDotFolder(
            name: "npm 缓存",
            relativePath: ".npm",
            priority: .recommended,
            description: "Node.js 包管理器本地缓存"
        ),
        KnownDotFolder(
            name: "Maven 仓库",
            relativePath: ".m2",
            priority: .recommended,
            description: "Java Maven 依赖仓库"
        ),
        KnownDotFolder(
            name: "Gradle 缓存",
            relativePath: ".gradle",
            priority: .recommended,
            description: "Gradle 构建缓存、Wrapper 和依赖数据"
        ),
        KnownDotFolder(
            name: "Android 开发数据",
            relativePath: ".android",
            priority: .recommended,
            description: "Android、ADB 和模拟器配置与缓存数据"
        ),
        KnownDotFolder(
            name: "Flutter/Dart 缓存",
            relativePath: ".pub-cache",
            priority: .recommended,
            description: "Dart 和 Flutter Pub 包缓存"
        ),
        KnownDotFolder(
            name: "Bun 运行时",
            relativePath: ".bun",
            priority: .recommended,
            description: "Bun JavaScript 运行时及缓存"
        ),
        KnownDotFolder(
            name: "Conda 环境",
            relativePath: ".conda",
            priority: .recommended,
            description: "Anaconda/Miniconda 环境数据"
        ),
        KnownDotFolder(
            name: "Nexus 数据",
            relativePath: ".nexus",
            priority: .optional,
            description: "Nexus 代理缓存"
        ),
        KnownDotFolder(
            name: "Composer 包",
            relativePath: ".composer",
            priority: .optional,
            description: "PHP Composer 全局包"
        ),

        // ── AI / ML 工具 ─────────────────────────────────────────
        KnownDotFolder(
            name: "Ollama 模型",
            relativePath: ".ollama",
            priority: .recommended,
            description: "Ollama 本地大语言模型存储"
        ),
        KnownDotFolder(
            name: "PyTorch 模型缓存",
            relativePath: ".cache/torch",
            priority: .recommended,
            description: "PyTorch 预训练模型
```

### Core Architecture Module: `AppPorts/Utils/DataTreeRelocator.swift`
```
import Darwin
import Foundation

/// Moves a real tree root without replacing an entry or changing its identity or permissions.
/// Open directory descriptors anchor both names during the exclusive, same-volume rename.
enum DataTreeRelocator {
    static func move(_ source: URL, to destination: URL) throws {
        let sourceParent = source.deletingLastPathComponent().resolvingSymlinksInPath()
        let destinationParent = destination.deletingLastPathComponent().resolvingSymlinksInPath()
        let sourceFD = open(sourceParent.path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
        guard sourceFD >= 0 else { throw posixFailure() }
        defer { close(sourceFD) }
        let destinationFD = open(destinationParent.path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
        guard destinationFD >= 0 else { throw posixFailure() }
        defer { close(destinationFD) }
        var sourceParentInfo = stat(), destinationParentInfo = stat(), original = stat()
        guard fstat(sourceFD, &sourceParentInfo) == 0,
              fstat(destinationFD, &destinationParentInfo) == 0,
              fstatat(sourceFD, source.lastPathComponent, &original, AT_SYMLINK_NOFOLLOW) == 0 else { throw posixFailure() }
        let kind = original.st_mode & S_IFMT
        guard kind == S_IFDIR || kind == S_IFREG else { throw POSIXError(.EINVAL) }
        guard original.st_dev == sourceParentInfo.st_dev,
              original.st_dev == destinationParentInfo.st_dev else { throw POSIXError(.EXDEV) }
        guard original.st_flags & UInt32(UF_IMMUTABLE | SF_IMMUTABLE | UF_APPEND | SF_APPEND) == 0 else { throw POSIXError(.EPERM) }
        let rootFD = openat(sourceFD, source.lastPathComponent, O_RDONLY | O_NONBLOCK | O_NOFOLLOW | O_CLOEXEC)
        guard rootFD >= 0 else { throw posixFailure() }
        defer { close(rootFD) }
        var opened = stat()
        guard fstat(rootFD, &opened) == 0 else { throw posixFailure() }
        guard sameObject(original, opened) else { throw POSIXError(.ESTALE) }
        let originalMode = original.st_mode & 0o7777
        let needsWrite = kind == S_IFDIR && originalMode & 0o200 == 0
            && !sameObject(sourceParentInfo, destinationParentInfo)
        if needsWrite, fchmod(rootFD, originalMode | 0o200) != 0 { throw posixFailure() }
        do {
            try requireParent(sourceParent, matches: sourceParentInfo)
            try requireParent(destinationParent, matches: destinationParentInfo)
            var current = stat()
            guard fstatat(sourceFD, source.lastPathComponent, &current, AT_SYMLINK_NOFOLLOW) == 0 else { throw posixFailure() }
            guard sameObject(current, original) else { throw POSIXError(.ESTALE) }
            guard renameatx_np(sourceFD, source.lastPathComponent, destinationFD, destination.lastPathComponent, UInt32(RENAME_EXCL)) == 0 else { throw posixFailure() }
            guard fstatat(destinationFD, destination.lastPathComponent, &current, AT_SYMLINK_NOFOLLOW) == 0 else { throw posixFailure() }
            guard sameObject(current, original) else { throw POSIXError(.ESTALE) }
            try requireParent(destinationParent, matches: destinationParentInfo)
        } catch {
            if needsWrite { try restoreMode(originalMode, descriptor: rootFD) }
            throw error
        }
        if needsWrite { try restoreMode(originalMode, descriptor: rootFD) }
        var final = stat()
        guard fstatat(destinationFD, destination.lastPathComponent, &final, AT_SYMLINK_NOFOLLOW) == 0 else { throw posixFailure() }
        guard sameObject(final, original), final.st_mode & 0o7777 == originalMode else { throw POSIXError(.ESTALE) }
    }

    private static func restoreMode(_ mode: mode_t, descriptor: Int32) throws {
        guard fchmod(descriptor, mode) == 0 else { throw posixFailure() }
        var restored = stat()
        guard fstat(descriptor, &restored) == 0 else { throw posixFailure() }
        guard restored.st_mode & 0o7777 == mode else { throw POSIXError(.EPERM) }
    }

    private static func requireParent(_ url: URL, matches expected: stat) throws {
        var current = stat()
        guard lstat(url.path, &current) == 0 else { throw posixFailure() }
        guard current.st_mode & S_IFMT == S_IFDIR, sameObject(current, expected) else { throw POSIXError(.ESTALE) }
    }

    private static func sameObject(_ lhs: stat, _ rhs: stat) -> Bool {
        lhs.st_dev == rhs.st_dev && lhs.st_ino == rhs.st_ino && lhs.st_mode & S_IFMT == rhs.st_mode & S_IFMT
    }

    private static func posixFailure() -> POSIXError { POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO) }
}

```

### Core Architecture Module: `AppPorts/Utils/DiskUtility.swift`
```
//
//  DiskUtility.swift
//  AppPorts
//

import Darwin
import Foundation

// MARK: - 外部命令执行

struct ShellCommandResult: Sendable {
    let status: Int32
    let standardOutput: Data
    let standardError: Data
    let timedOut: Bool

    var stdoutText: String { String(decoding: standardOutput, as: UTF8.self) }
    var stderrText: String { String(decoding: standardError, as: UTF8.self) }
    var combinedText: String {
        (stdoutText + "\n" + stderrText).trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

/// 可注入的命令执行器；测试用假执行器记录调用顺序并伪造输出。
protocol ShellCommandRunning: Sendable {
    func run(executable: String, arguments: [String], timeout: TimeInterval) async throws -> ShellCommandResult
}

/// 用 Process 执行外部命令。超时后终止进程，避免 diskutil 挂死时整个操作卡住。
struct ProcessCommandRunner: ShellCommandRunning {
    func run(executable: String, arguments: [String], timeout: TimeInterval) async throws -> ShellCommandResult {
        // Include dispatch queueing and process launch in the caller's time budget.
        let deadline = ProcessInfo.processInfo.systemUptime + max(0, timeout)
        let cancellation = CancellationState()
        return try await withTaskCancellationHandler(operation: {
            try Task.checkCancellation()
            return try await withCheckedThrowingContinuation { continuation in
                DispatchQueue.global(qos: .utility).async {
                    do { continuation.resume(returning: try Self.execute(executable: executable,
                        arguments: arguments, deadline: deadline, cancellation: cancellation)) }
                    catch { continuation.resume(throwing: error) }
                }
            }
        }, onCancel: { cancellation.cancel() })
    }

    /// Nonblocking pipe reads let one deadline cover the child AND inherited pipes.
    /// This worker never blocks Foundation's process termination callback queue.
    private static func execute(executable: String, arguments: [String], deadline: TimeInterval,
                                cancellation: CancellationState) throws -> ShellCommandResult {
        if cancellation.isCancelled { throw CancellationError() }
        guard ProcessInfo.processInfo.systemUptime < deadline else {
            return ShellCommandResult(status: -1, standardOutput: Data(), standardError: Data(), timedOut: true)
        }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        process.standardInput = FileHandle.nullDevice
        let output = Pipe(), error = Pipe()
        process.standardOutput = output
        process.standardError = error
        let handles = [output.fileHandleForReading, error.fileHandleForReading]
        defer { handles.forEach { try? $0.close() } }
        let fds = handles.map(\.fileDescriptor)
        // A blocking read would bypass the deadline. Validate this before spawning a child.
        for fd in fds {
            let flags = fcntl(fd, F_GETFL)
            guard flags >= 0, fcntl(fd, F_SETFL, flags | O_NONBLOCK) == 0 else {
                throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
            }
        }
        try process.run()
        try? output.fileHandleForWriting.close()
        try? error.fileHandleForWriting.close()
        var streams = [Data(), Data()]
        var ended = [false, false]
        var buffer = [UInt8](repeating: 0, count: 65_536)
        var stoppingAt: TimeInterval?
        var timedOut = false
        while true {
            // Bound each drain so an endlessly writing child cannot hide the deadline.
            for index in fds.indices where !ended[index] {
                for _ in 0..<16 {
                    let count = Darwin.read(fds[index], &buffer, buffer.count)
                    if count > 0 { streams[index].append(contentsOf: buffer.prefix(count)) }
                    else if count == 0 { ended[index] = true; break }
                    else if errno == EINTR { continue }
                    else { break }
                }
            }
            let now = ProcessInfo.processInfo.systemUptime
            // Check the full budget even when a slow launch has already exited by this poll.
            if stoppingAt == nil, now >= deadline || cancellation.isCancelled {
                timedOut = now >= deadline
                stoppingAt = now
                if process.isRunning { process.terminate() }
            }
            if !process.isRunning && ended.allSatisfy({ $0 }) { break }
            if let stoppingAt {
                if !process.isRunning { break }
                if now - stoppingAt >= 0.25 { _ = kill(process.processIdentifier, SIGKILL) }
                if now - stoppingAt >= 1 { break }
            }
            var descriptors = fds.enumerated().map { index, fd in
                pollfd(fd: ended[index] ? -1 : fd, events: Int16(POLLIN), revents: 0)
            }
            _ = poll(&descriptors, nfds_t(descriptors.count), 20)
            // EOF pipes report immediately even while the child is still alive.
            if ended.contains(true) { Thread.sleep(forTimeInterval: 0.005) }
        }
        if cancellation.isCancelled { throw CancellationError() }
        return ShellCommandResult(status: process.isRunning ? -1 : process.terminationStatus,
            standardOutput: streams[0], standardError: streams[1], timedOut: timedOut)
    }

    private final class CancellationState: @unchecked Sendable {
        private let lock = NSLock()
        private var cancelled = false
        var isCancelled: Bool { lock.lock(); defer { lock.unlock() }; return cancelled }
        func cancel() { lock.lock(); defer { lock.unlock() }; cancelled = true }
    }
}

// MARK: - diskutil 封装

/// `diskutil` 与 `statfs` 封装，供容器数据挂载迁移使用。
///
/// 所有 diskutil 调用都带超时；查询类命令统一用 `-plist` 解析，避免依赖人类可读输出。
struct DiskUtility: Sendable {
    struct VolumeInfo: Equatable, Sendable {
        let deviceIdentifier: String
        let volumeUUID: String?
        let volumeName: String?
        let filesystemType: String?
        let apfsContainerReference: String?
        let mountPoint: String?
        var isEncrypted: Bool = false

        var isAPFS: Bool {
            filesystemType?.lowercased() == "apfs"
        }
    }

    enum Failure: LocalizedError {
        case commandFailed(command: String, output: String)
        case timedOut(command: String)
        case unexpectedOutput(command: String, output: String)
        case administratorPromptCancelled(command: String)
        case privilegeRequired(command: String)

        var errorDescription: String? {
            switch self {
            case .commandFailed(let command, let output):
                return String(format: "磁盘命令执行失败（%@）：%@".localized, command, output)
            case .timedOut(let command):
                return String(format: "磁盘命令超时（%@）".localized, command)
            case .unexpectedOutput(let command, let output):
                return String(format: "无法解析磁盘命令输出（%@）：%@".localized, command, output)
            case .administratorPromptCancelled(let command):
                return String(format: "用户取消了管理员授权，无法执行磁盘命令（%@）".localized, command)
            case .privilegeRequired(let command):
                return String(format: "此系统版本要求管理员权限才能执行磁盘命令，当前环境无法弹出授权框（%@）".localized, command)
            }
        }
    }

    /// 以管理员权限执行命令；返回 nil 表示当前环境无法弹出授权框（如后台代理）。
    typealias AdministratorRunner = @Sendable (_ executable: String, _ arguments: [String]) throws -> ShellCommandResult

    static let diskutilPath = "/usr/sbin/diskutil"
    static let mountPath = "/sbin/mount"

    private let runner: ShellCommandRunning
    private let commandTimeout: TimeInterval
    private let administratorRunner: AdministratorRunner?

    /// - Parameter administratorRunner: 旧系统（macOS 12 等）的 DiskArbitration 不允许普通用户把卷挂到
    ///   自定义路径（`kDAReturnNotPrivileged`）。遇到这类失败时用它重试；传 nil 表示不能提权（后台代理）。
    init(
        runner: ShellCommandRunning = ProcessCommandRunner(),
        commandTimeout: TimeInterval = 180,
        administratorRunner: AdministratorRunner? = { try DiskUtility.runWithAdministratorPrivileges(executable: $0, arguments: $1) }
    ) {
        self.runner = runner
        self.commandTimeout = commandTimeout
        self.administratorRunner = administratorRunner
    }

    /// 通过 AppleScript 弹出系统密码框执行命令。同一进程内的授权会被系统缓存约 5 分钟，
    /// 一次迁移中的多条 diskutil 命令通常只提示一次。
    static func runWithAdministratorPrivileges(executable: String, arguments: [String]) throws -> ShellCommandResult {
        let command = ([executable] + arguments).map(shellQuoted).joined(separator: " ")
        let script = "do shell script \(AppMigrationService.appleScriptStringLiteral(command)) with administrator privileges"
        var errorInfo: NSDictionary?
        let output = NSAppleScript(source: script)?.executeAndReturnError(&errorInfo)
        if let errorInfo {
            let number = errorInfo[NSAppleScript.errorNumber] as? Int ?? -1
            let message = errorInfo[NSAppleScript.errorMessage] as? String ?? "unknown AppleScript error"
            if number == -128 {
                throw Failure.administratorPromptCancelled(command: command)
            }
            return ShellCommandResult(status: 1, standardOutput: Data(), standardError: Data("\(message) (AppleScript error \(number))".utf8), timedOut: false)
        }
        return ShellCommandResult(status: 0, standardOutput: Data((output?.stringValue ?? "").utf8), standardError: Data(), timedOut: false)
    }

    private static func shellQuoted(_ value: String) -> String {
        "'" + value.replacingOccurrences(of: "'", with: "'\\''") + "'"
    }

    /// DiskArbitration 拒绝普通用户操作时的典型输出。
    static func indicatesPrivilegeFailure(_ output: String) -> Bool {
        output.contains("kDAReturnNotPrivileged")
            || output.localizedCaseInsensitiveContains("not allowed by the invoking user")
            || output.localizedCaseInsensitiveContains("Not
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #57** (2026-09-16): **[BUG] 有没有可能把APP打包之后，迁移后再解包?千万个小文件会卡住**
  *Symptoms*: ### 问题描述 / Problem  可能也跟我的网络有问题，我在迁移一个APP的时候就发现它特别的慢，显然应该就是无数个小文件在迁移的时候会各种验证导致的吧? 所以，迁移的时候能否先打包？打包之后等于是迁移一个文件呀，完了再解包。我不知道这种有没有可能性?  ### 复现步骤 / Steps to Reproduce  .  ### 设备系统版本 / OS Version  27  ### 软件版本 / App Version  1.7.1  ### 诊断信息确认 / Diagnostics  - [ ] 我已附上诊断包；如无法提供，已在下方说明原因。 / I attached a diagnostic package or explained why it is unavailable.  ### 诊断包 / Diagnostic Package  _No response_  ### 外置存储设备类型 / External Storage Type  - [x] NAS - [ ] 移动硬盘 / Portable External Drive - [ ] 移动硬盘盒 / Drive Enclosure - [ ] 其他 / Other  ### 外置存储设备产品名 / External Storage Product Name  _No response_  ### 截图（可选） / Screenshots (Optional)  _No response_  ### 日志（可选，仅在无诊断包时填写） / Logs (Optional, only if no diagnostic package)  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈，新版本对 nas 迁移做了优化，因测试环境的不同，可能会出现其他的问题，建议试用前备份好数据 请查阅：https://github.com/wzh4869/AppPorts/releases 此 issues 将关闭，如有相关的进一步问题可再次打开

- **Issue #56** (2026-08-12): **[BUG] 移动后无法正常打开，提示损坏，可以补充相关说明，如果无法解决建议禁止移动这类应用**
  *Symptoms*: ### 问题描述 / Problem  <img width="260" height="220" alt="Image" src="https://github.com/user-attachments/assets/72bc7246-003a-4c3c-8f8f-a7321e62b7e6" />  ### 复现步骤 / Steps to Reproduce  1、移动figma 2、打开figma  ### 设备系统版本 / OS Version  15.7  ### 软件版本 / App Version  当前最新  ### 诊断信息确认 / Diagnostics  - [x] 我已附上诊断包；如无法提供，已在下方说明原因。 / I attached a diagnostic package or explained why it is unavailable.  ### 诊断包 / Diagnostic Package  _No response_  ### 外置存储设备类型 / External Storage Type  - [ ] NAS - [x] 移动硬盘 / Portable External Drive - [x] 移动硬盘盒 / Drive Enclosure - [ ] 其他 / Other  ### 外置存储设备产品名 / External Storage Product Name  _No response_  ### 截图（可选） / Screenshots (Optional)  _No response_  ### 日志（可选，仅在无诊断包时填写） / Logs (Optional, only if no diagnostic package)  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > 有试过重签名吗
  > 如有试过重签名幸苦发一下日志包，也可以发在这个地址里 a@shimoko.com 幸苦了💗

- **Issue #51** (2026-06-23): **[BUG] Adobe, Apple Office, 飞书等软件存在不同程度问题**
  *Symptoms*: ### 问题描述 / Problem  1. Adobe Photoshop 迁移后图标在启动台里消失 2. pages，keynote和 numbers 等软件在启动台中点击一次均无法打开，需要再次在启动台中点击才会打开 3. 飞书显示损坏，签名也无法成功，原因不明，未进行更多尝试  ### 复现步骤 / Steps to Reproduce  如上所述  ### 设备系统版本 / OS Version  26.5.1  ### 软件版本 / App Version  latest  ### 诊断信息确认 / Diagnostics  - [x] 我已附上诊断包；如无法提供，已在下方说明原因。 / I attached a diagnostic package or explained why it is unavailable.  ### 诊断包 / Diagnostic Package  软件已卸载，只是想起来反映一下  ### 外置存储设备类型 / External Storage Type  - [ ] NAS - [ ] 移动硬盘 / Portable External Drive - [x] 移动硬盘盒 / Drive Enclosure - [ ] 其他 / Other  ### 外置存储设备产品名 / External Storage Product Name  ORICO 底座+致钛7100 plus  ### 截图（可选） / Screenshots (Optional)  _No response_  ### 日志（可选，仅在无诊断包时填写） / Logs (Optional, only if no diagnostic package)  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > 没有看到日志或诊断包，幸苦补充提交以定位。 如多个问题同时存在请提交多个issues 和关键复现步骤哈，此 issues 将关闭💗

- **Issue #50** (2026-06-24): **[BUG] appstore 安装在外置硬盘的软件链接回应用程序文件夹内，后续更新打开方式出现上个版本信息，没有刷新**
  *Symptoms*: ### 问题描述 / Problem  <img width="785" height="276" alt="Image" src="https://github.com/user-attachments/assets/9824abeb-74ec-4775-911a-527a5db8a4bd" />  就如上面显示的，重新取消链接后重新链接又可以了；然后不知道为啥还冒出来 libreofficedev，实际上没装；想删掉还得安装一遍这个软件然后利用工具卸载；  ### 复现步骤 / Steps to Reproduce  1、appstore 打开安装到外置硬盘，AppPorts 链接回本地 2、外置硬盘的软件更新 3、相关文件的打开方式出现多个版本  ### 设备系统版本 / OS Version  mac26.5/mac27  ### 软件版本 / App Version  1.6.1  ### 诊断信息确认 / Diagnostics  - [x] 我已附上诊断包；如无法提供，已在下方说明原因。 / I attached a diagnostic package or explained why it is unavailable.  ### 诊断包 / Diagnostic Package  [AppPorts-Diagnostic-20260618-104730.zip](https://github.com/user-attachments/files/29074756/AppPorts-Diagnostic-20260618-104730.zip)  ### 外置存储设备类型 / External Storage Type  - [ ] NAS - [ ] 移动硬盘 / Portable External Drive - [x] 移动硬盘盒 / Drive Enclosure - [ ] 其他 / Other  ### 外置存储设备产品名 / External Storage Product Name  _No response_  ### 截图（可选） / Screenshots (Optional)  _No response_  ### 日志（可选，仅在无诊断包时填写） / Logs (Optional, only if no diagnostic package)  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈！新版本已解决该问题[releases](https://github.com/wzh4869/AppPorts/releases/tag/1.7.1)  关于libreofficedev 问题，烦请使用新版本的 AppPorts 进行二次复现，如问题依然存在幸苦再新开一个 issues🙏 此 issues 将关闭，如此问题有更多反馈请继续留言💗

- **Issue #48** (2026-06-24): **[BUG] 无法检测到JetBrains Toolbox中下载的软件**
  *Symptoms*: ### 问题描述 / Problem  如题，比如在toolbox中下载的idea、pycharm等无法被软件检测到导致无法迁移  ### 复现步骤 / Steps to Reproduce  - 在toolbox里下载pycharm - 打开app ports，无法检测到pycharm  ### 设备系统版本 / OS Version  macOS 26.5.1  ### 软件版本 / App Version  1.7.0  ### 诊断信息确认 / Diagnostics  - [x] 我已附上诊断包；如无法提供，已在下方说明原因。 / I attached a diagnostic package or explained why it is unavailable.  ### 诊断包 / Diagnostic Package  应该不需要吧  ### 外置存储设备类型 / External Storage Type  - [ ] NAS - [ ] 移动硬盘 / Portable External Drive - [x] 移动硬盘盒 / Drive Enclosure - [ ] 其他 / Other  ### 外置存储设备产品名 / External Storage Product Name  _No response_  ### 截图（可选） / Screenshots (Optional)  _No response_  ### 日志（可选，仅在无诊断包时填写） / Logs (Optional, only if no diagnostic package)  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > 并且在重启电脑后无法恢复迁移软件的窗口
  > 感谢，这周复现💗
  > 感谢反馈！新版本已解决该问题[releases](https://github.com/wzh4869/AppPorts/releases/tag/1.7.1)  此 issues 将关闭，如此问题有更多反馈请继续留言💗

- **Issue #47** (2026-06-24): **[BUG] 在【应用数据】项目扫描TraeSOLO CN（或者TraeCN）的目录时AppPorts应用程序卡死**
  *Symptoms*: ### 问题描述 / Problem  <img width="1800" height="1564" alt="Image" src="https://github.com/user-attachments/assets/e68857f6-78ab-410e-ba17-c221b6d5796c" />  <img width="442" height="660" alt="Image" src="https://github.com/user-attachments/assets/05f6263e-91ec-40c4-af32-5e7156f5c48f" />  [AppPorts崩溃日志.txt](https://github.com/user-attachments/files/28676176/AppPorts.txt)  <img width="1800" height="1564" alt="Image" src="https://github.com/user-attachments/assets/866112c7-759d-41f2-b532-be5d7081b582" />  <img width="1800" height="1564" alt="Image" src="https://github.com/user-attachments/assets/6ce97199-d9e3-4a05-9282-7810d2292d28" />  <img width="1800" height="1564" alt="Image" src="https://github.com/user-attachments/assets/c5dcf782-7dfd-4a60-99a1-63936e4520ca" />  其他IDE均可打开，但是唯独字节跳动旗下的Trae系列无法正常打开。  <img width="1800" height="1564" alt="Image" src="https://github.com/user-attachments/assets/9159c199-7f49-44f6-80f2-fe7979cab468" />  <img width="2134" height="1434" alt="Image" src="https://github.com/user-attachments/assets/23358a67-7264-464d-a9ea-f8888f5a3081" />  <img width="2134" height="1434" alt="Image" src="https://github.com/user-attachments/assets/e105efc0-865e-4858-985d-d008603466de" />  ### 复现步骤 / Steps to Reproduce  在数据目录，应用数据选中Trae CN或者Trae SOLO CN稳定触发本Bug，其他VSCodium类似物都没有出现卡死情况。Trae国际版未使用故没有测试  [AppPorts-Diagnostic-20260607-130213.zip](https://github.com/user-attachments/files/28676215/AppPorts-Diagnostic-20260607-130213.zip)  ### 设备系统版本 / OS Version  macOS 26.6 (Buil
  **Post-Mortem & Fix Analysis**:
  > 我也遇到了 转外置的时候很快  迁移回来 一个多小时了才百分之三 
  > > 我也遇到了 转外置的时候很快 迁移回来 一个多小时了才百分之三  我甚至无法查看，更别说迁移了，估计是Trae里面写了屎山代码。
  > 收到，感谢反馈，可能是兼容性问题，trae 的更新使得 AppPorts 没有同步适配，下周前我定位问题解决💗

- **Issue #44** (2026-05-26): **[BUG] 微信数据迁移后打开提示目录无法识别消息丢失**
  *Symptoms*: ### 问题描述 / Problem  <img width="586" height="254" alt="Image" src="https://github.com/user-attachments/assets/957ee915-2614-431a-83a7-b9635c6e67b6" />  容器子目录迁移后，打开微信看不到聊天信息了，回迁后恢复。  ### 复现步骤 / Steps to Reproduce  1. 容器子目录点击迁移 2. 打开微信，聊天信息丢失 3. 回迁，聊天信息恢复  ### 设备系统版本 / OS Version  macOS 15.5 (24F74)  ### 软件版本 / App Version  v1.6.2  ### 诊断信息确认 / Diagnostics  - [x] 我已附上诊断包；如无法提供，已在下方说明原因。 / I attached a diagnostic package or explained why it is unavailable.  ### 诊断包 / Diagnostic Package  [AppPorts-Diagnostic-20260525-144907.zip](https://github.com/user-attachments/files/28209418/AppPorts-Diagnostic-20260525-144907.zip)  ### 外置存储设备类型 / External Storage Type  - [ ] NAS - [x] 移动硬盘 / Portable External Drive - [ ] 移动硬盘盒 / Drive Enclosure - [ ] 其他 / Other  ### 外置存储设备产品名 / External Storage Product Name  _No response_  ### 截图（可选） / Screenshots (Optional)  _No response_  ### 日志（可选，仅在无诊断包时填写） / Logs (Optional, only if no diagnostic package)  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > 看了一下日志，好像没有对微信进行重签名，微信没有重签名会出现打开微信后报错，请尝试进行重签名操作，重签名后如依然无法使用请继续告知💗 关于重签名请参阅：https://docs-appports.shimoko.com/datamigrae/resign.html 
  > [1.7.0](https://github.com/wzh4869/AppPorts/releases/tag/1.7.0) 中数据迁移策略添加重签名确认：迁移应用容器内数据前，AppPorts 现在会询问是否在迁移完成后自动对关联应用执行 Ad-hoc 重签名。用户可以选择「同意重签名」或「不同意，仅迁移」，用于降低容器数据迁移后应用无法识别数据、提示异常或启动异常的风险。 感谢你的反馈和耐心💗  <img width="1363" height="894" alt="Image" src="https://github.com/user-attachments/assets/70d662fb-c4ec-4c6e-acdc-26dd59dbcdab" />
  > 此issues将关闭，如有更多与此 issues 相关的问题可再次打开哈

- **Issue #43** (2026-05-26): **[BUG]  Help screens within the app are not displayed in English even when the main app interface set to English**
  *Symptoms*: ### 问题描述 / Problem  1. That includes startup screens  2. Screen that pops up during startup talking about 15.1+ native ext location support for large apps  3. And others   Below are the screenshots for 1 occurrence out of a few I found  <img width="912" height="788" alt="Image" src="https://github.com/user-attachments/assets/46397056-f8a5-4867-baf7-f0f9f261f9c6" />  <img width="423" height="390" alt="Image" src="https://github.com/user-attachments/assets/0f73cb97-63c7-4f56-97fe-8e43cb02b69c" />  ### 复现步骤 / Steps to Reproduce  1. Install the app 2. Change the interface to English 3. Open ANY help window (by pressing "?") 4. The help window wont be in English  ### 设备系统版本 / OS Version  macOS 25.6  ### 软件版本 / App Version  1.6.2  ### 诊断信息确认 / Diagnostics  - [x] 我已附上诊断包；如无法提供，已在下方说明原因。 / I attached a diagnostic package or explained why it is unavailable.  ### 诊断包 / Diagnostic Package  _No response_  ### 外置存储设备类型 / External Storage Type  - [ ] NAS - [x] 移动硬盘 / Portable External Drive - [ ] 移动硬盘盒 / Drive Enclosure - [ ] 其他 / Other  ### 外置存储设备产品名 / External Storage Product Name  _No response_  ### 截图（可选） / Screenshots (Optional)  _No response_  ### 日志（可选，仅在无诊断包时填写） / Logs (Optional, only if no diagnostic package)  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > Thank you so much for the issues! Because there's a lot of text to translate, it's easy to miss some spots. I will fully improve the multi-language translations in the next release. Currently, I am working on the Liquid Glass adaptation for macOS 26 and CLI support, so it might take a bit more time. Thanks for your patience!
  > 1.7.0 has improved English translations. If there are any other omissions, please continue to provide feedback. Thank you for your patience ！      [1.7.0](https://github.com/wzh4869/AppPorts/releases/tag/1.7.0) This issue will be closed, but can be reopened if you needed.
  > <img width="1363" height="894" alt="Image" src="https://github.com/user-attachments/assets/038ff2de-f0eb-4b99-ad9c-5ed10707eb28" />

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

### Incident Patch 1: `bb1a0956` (2026-10-05)
**Commit Message**: fix(ui): synchronize custom directories across windows

**File**: `AppPorts/ContentView.swift` (modified, +9/-0)
```diff
@@ -372,6 +372,13 @@ struct ContentView: View {
                 }
             }
         }
+        .onReceive(NotificationCenter.default.publisher(for: UserDefaults.didChangeNotification)) { _ in
+            let latest = UserDefaults.standard.stringArray(forKey: "customLocalScanPaths") ?? []
+            guard isVisible, latest != customLocalScanPaths else { return }
+            customLocalScanPaths = latest
+            startMonitoringLocal()
+            scanBothAppsAtomic()
+        }
         .onDisappear {
             monitorRescanDebouncer.cancel()
             isVisible = false
@@ -1592,6 +1599,7 @@ struct ContentView: View {
         panel.message = "选择要额外扫描的应用目录".localized
         guard panel.runModal() == .OK, let url = panel.url else { return }
         let path = url.path
+        customLocalScanPaths = UserDefaults.standard.stringArray(forKey: "customLocalScanPaths") ?? []
         guard !customLocalScanPaths.contains(path) else { return }
         customLocalScanPaths.append(path)
         UserDefaults.standard.set(customLocalScanPaths, forKey: "customLocalScanPaths")
@@ -1600,6 +1608,7 @@ struct ContentView: View {
     }
 
     func removeCustomLocalScanPath(_ path: String) {
+        customLocalScanPaths = UserDefaults.standard.stringArray(forKey: "customLocalScanPaths") ?? []
         customLocalScanPaths.removeAll { $0 == path }
         UserDefaults.standard.set(customLocalScanPaths, forKey: "customLocalScanPaths")
         startMonitoringLocal()
```

**File**: `AppPorts/Views/CustomDirsView.swift` (modified, +37/-33)
```diff
@@ -26,7 +26,8 @@ enum CustomDirRecoveryEligibility {
 @MainActor
 struct CustomDirsView: View {
     @ObservedObject private var operationState = AppOperationState.shared
-    @State private var configs: [CustomDirConfig] = CustomDirConfigStore.load()
+    @ObservedObject private var configStore = CustomDirConfigStore.shared
+    private var configs: [CustomDirConfig] { configStore.configs }
     @State private var pairs: [CustomDirPair] = []
     @State private var selectedLocalIDs: Set<String> = []
     @State private var selectedExternalIDs: Set<String> = []
@@ -121,6 +122,7 @@ struct CustomDirsView: View {
             isVisible = true
             refresh()
         }
+        .onChange(of: configStore.configs) { _ in refresh() }
         .onDisappear {
             isVisible = false
             invalidateRefresh()
@@ -271,23 +273,8 @@ struct CustomDirsView: View {
     }
 
     private func addConfig(_ config: CustomDirConfig) -> String? {
-        guard !configs.contains(where: { $0.localURL == config.localURL }) else {
-            return "该目录已在目录迁移列表中".localized
-        }
-
-        do {
-            try CustomDirValidator.validate(
-                localURL: config.localURL,
-                externalBaseURL: config.externalBaseURL,
-                existingConfigs: configs
-            )
-        } catch {
-            return error.localizedDescription
-        }
-
-        configs.append(config)
-        saveConfigs()
-        return nil
+        do { try configStore.insert(config); return nil }
+        catch { return error.localizedDescription }
     }
 
     private func addAndMigrateConfig(_ config: CustomDirConfig) -> String? {
@@ -311,18 +298,14 @@ struct CustomDirsView: View {
 
     private func removeConfig(_ config: CustomDirConfig) {
         guard !operationState.isBusy else { return }
-        configs.removeAll { $0.id == config.id }
+        do { try configStore.remove(id: config.id) }
+        catch { errorMessage = error.localizedDescription; showError = true; return }
         pairs.removeAll { $0.config.id == config.id }
         selectedLocalIDs.remove("\(config.id.uuidString)-\(CustomDirEntryKind.local.rawValue)")
         selectedExternalIDs.remove("\(config.id.uuidString)-\(CustomDirEntryKind.external.rawValue)")
-        saveConfigs()
         refresh()
     }
 
-    private func saveConfigs() {
-        CustomDirConfigStore.save(configs)
-    }
-
     private func refresh() {
         guard isVisible else { return }
         do {
@@ -547,20 +530,41 @@ private final class CustomDirLocalOpenPanelDelegate: NSObject, NSOpenSavePanelDe
     }
 }
 
-private enum CustomDirConfigStore {
+/// All windows share one published snapshot. Mutations reload the persisted state,
+/// so even a second client cannot overwrite another client's completed edit.
+@MainActor
+final class CustomDirConfigStore: ObservableObject {
+    static let shared = CustomDirConfigStore()
     private static let key = "customDirConfigs"
+    private let defaults: UserDefaults
+    @Published private(set) var configs: [CustomDirConfig]
 
-    static func load() -> [CustomDirConfig] {
-        guard let data = UserDefaults.standard.data(forKey: key),
-              let configs = try? JSONDecoder().decode([CustomDirConfig].self, from: data) else {
-            return []
-        }
+    init(defaults: UserDefaults = .standard) {
+        self.defaults = defaults
+        configs = Self.load(defaults)
+    }
+
+    private static func load(_ defaults: UserDefaults) -> [CustomDirConfig] {
+        guard let data = defaults.data(forKey: key),
+              let configs = try? JSONDecoder().decode([CustomDirConfig].self, from: data) else { return [] }
         return configs
     }
 
-    static func save(_ configs: [CustomDirConfig]) {
-        guard let data = try? JSONEncoder().encode(configs) else { return }
-        UserDefaults.standard.set(data, forKey: key)
+    func insert(_ config: CustomDirConfig, homeURL: URL = FileManager.default.homeDirectoryForCurrentUser) throws {
+        var current = Self.load(defaults)
+        try CustomDirValidator.validate(localURL: config.localURL, externalBaseURL: config.externalBaseURL,
+                                        existingConfigs: current, homeURL: homeURL)
+        current.append(config)
+        try save(current)
+    }
+
+    func remove(id: UUID) throws {
+        try save(Self.load(defaults).filter { $0.id != id })
+    }
+
+    private func save(_ current: [CustomDirConfig]) throws {
+        defaults.set(try JSONEncoder().encode(current), forKey: Self.key)
+        configs = current
     }
 }
 
```

---

### Incident Patch 2: `3ef50358` (2026-10-05)
**Commit Message**: fix(ui): isolate scan debounce state per window

**File**: `AppPorts/ContentView.swift` (modified, +8/-3)
```diff
@@ -270,7 +270,7 @@ struct ContentView: View {
     @State private var externalMonitor: FolderMonitor?
 
     // Monitor 防抖：合并两个 monitor 的扫描请求
-    private static let monitorRescanDebouncer = RescanDebouncer()
+    @State private var monitorRescanDebouncer = RescanDebouncer()
 
     // Track previous external drive URL for logging
     @State private var previousExternalDriveURL: URL?
@@ -373,6 +373,7 @@ struct ContentView: View {
             }
         }
         .onDisappear {
+            monitorRescanDebouncer.cancel()
             isVisible = false
             localScanState.invalidate()
             externalScanState.invalidate()
@@ -2752,7 +2753,7 @@ struct ContentView: View {
 
     /// 统一防抖：合并两个 monitor 的扫描请求，避免列表连续跳两下
     private func scheduleMonitorRescan(local: Bool) {
-        Self.monitorRescanDebouncer.schedule { [self] in
+        monitorRescanDebouncer.schedule { [self] in
             Task { @MainActor in
                 AppLogger.shared.logContext("Monitor 防抖触发扫描", details: [("trigger", local ? "local" : "external")], level: "TRACE")
                 self.scanBothAppsAtomic()
@@ -3052,10 +3053,14 @@ struct ContentView: View {
 }
 
 /// 统一防抖器：合并 FolderMonitor 的扫描请求，避免列表连续跳动
-private class RescanDebouncer {
+final class RescanDebouncer {
     private var work: DispatchWorkItem?
     private let queue = DispatchQueue(label: "com.shimoko.AppPorts.rescanDebounce")
 
+    func cancel() {
+        queue.async { self.work?.cancel(); self.work = nil }
+    }
+
     func schedule(action: @escaping () -> Void) {
         queue.async {
             self.work?.cancel()
```

---

### Incident Patch 3: `6a63bef4` (2026-10-05)
**Commit Message**: fix(portals): preserve iOS application metadata

**File**: `AppPorts/Services/AppMigrationService.swift` (modified, +10/-6)
```diff
@@ -1658,10 +1658,15 @@ struct AppMigrationService {
 
         // 4. 从 iTunesMetadata.plist 生成 Info.plist（位于 Wrapper/ 目录内）
         let iTunesPlist = wrapperDir.appendingPathComponent("iTunesMetadata.plist")
-        if let metadata = NSDictionary(contentsOf: iTunesPlist) as? [String: Any] {
-            let bundleID = metadata["softwareVersionBundleId"] as? String ?? "com.appports.stub"
+        let metadata = (NSDictionary(contentsOf: iTunesPlist) as? [String: Any]) ?? [:]
+        let identityMetadata = applicationMetadata(at: externalURL)
+        guard let bundleID = (identityMetadata?["CFBundleIdentifier"] as? String)
+                ?? (metadata["softwareVersionBundleId"] as? String), !bundleID.isEmpty else {
+            throw AppMoverError.generalError(CocoaError(.fileReadCorruptFile))
+        }
+        do {
             let appName = metadata["title"] as? String ?? localURL.deletingPathExtension().lastPathComponent
-            let version = metadata["bundleShortVersionString"] as? String ?? "1.0"
+            let version = identityMetadata?["CFBundleShortVersionString"] as? String ?? metadata["bundleShortVersionString"] as? String ?? "1.0"
 
             let plist: [String: Any] = [
                 "CFBundleExecutable": "launcher",
@@ -1675,9 +1680,8 @@ struct AppMigrationService {
                 "CFBundleIconFile": "AppIcon",
                 "LSMinimumSystemVersion": "12.0"
             ]
-            if let newData = try? PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0) {
-                try newData.write(to: localContents.appendingPathComponent("Info.plist"))
-            }
+            let newData = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
+            try newData.write(to: localContents.appendingPathComponent("Info.plist"))
         }
 
         // 5. 写入 PkgInfo
```

**File**: `AppPortsTests/AppMigrationServiceTests.swift` (modified, +2/-0)
```diff
@@ -263,6 +263,8 @@ final class AppMigrationServiceTests: XCTestCase {
         )
 
         try assertStubPortal(localAppURL, pointsTo: externalAppURL)
+        let info = localAppURL.appendingPathComponent("Contents/Info.plist")
+        XCTAssertTrue(fileManager.fileExists(atPath: info.path), "A successful iOS portal must have metadata")
     }
 
     func testDeleteLinkRejectsRealLocalAppBundle() throws {
```

---

### Incident Patch 4: `792df6a7` (2026-10-05)
**Commit Message**: fix(portals): validate targets before refreshing launchers

**File**: `AppPorts/ContentView.swift` (modified, +2/-2)
```diff
@@ -1292,7 +1292,7 @@ struct ContentView: View {
                     if localApp.usesFolderOperation {
                         // 文件夹镜像：重新同步内部 Stub 与符号链接（旧版整体 symlink 文件夹会被安全跳过）
                         service.refreshFolderMirror(at: localApp.path, from: externalApp.path)
-                    } else if localApp.version != externalApp.version {
+                    } else {
                         service.refreshStubPortal(at: localApp.path, from: externalApp.path)
                     }
                 }
@@ -2822,7 +2822,7 @@ struct ContentView: View {
                 if localApp.usesFolderOperation {
                     // 文件夹镜像：重新同步内部 Stub 与符号链接（旧版整体 symlink 文件夹会被安全跳过）
                     service.refreshFolderMirror(at: localApp.path, from: externalApp.path)
-                } else if localApp.version != externalApp.version {
+                } else {
                     service.refreshStubPortal(at: localApp.path, from: externalApp.path)
                 }
             }
```

**File**: `AppPorts/Services/AppMigrationService.swift` (modified, +56/-60)
```diff
@@ -1227,6 +1227,26 @@ struct AppMigrationService {
         return nil
     }
 
+    private func samePortalTarget(_ stored: String, _ expected: URL) -> Bool {
+        guard stored.hasPrefix("/") else { return false }
+        let url = URL(fileURLWithPath: stored).standardizedFileURL
+        return url.lastPathComponent == expected.lastPathComponent
+            && DiskUtility.pathsMatch(url.deletingLastPathComponent().path, expected.deletingLastPathComponent().path)
+    }
+
+    private func hasRealStubStorage(at url: URL) -> Bool {
+        for path in ["", "Contents", "Contents/MacOS", "Contents/Resources"] {
+            let candidate = path.isEmpty ? url : url.appendingPathComponent(path)
+            guard let attributes = try? fileManager.attributesOfItem(atPath: candidate.path),
+                  attributes[.type] as? FileAttributeType == .typeDirectory else { return false }
+        }
+        for path in ["Contents/Info.plist", "Contents/MacOS/launcher"] {
+            guard let attributes = try? fileManager.attributesOfItem(atPath: url.appendingPathComponent(path).path),
+                  attributes[.type] as? FileAttributeType == .typeRegular else { return false }
+        }
+        return true
+    }
+
     private func externalTargetReplacementReason(for appToMove: AppItem, destinationURL: URL) -> String? {
         if appToMove.status == AppStatus.pendingMoveOut {
             // A scanner status is not authority to delete the name-based destination.
@@ -1349,14 +1369,18 @@ struct AppMigrationService {
             let pathFile = localContentsURL.appendingPathComponent("Resources/real_app_path.txt")
             if let raw = try? String(contentsOf: pathFile, encoding: .utf8) {
                 let realPath = raw.trimmingCharacters(in: .whitespacesAndNewlines)
-                if !realPath.isEmpty && realPath == standardizedExternalURL.path {
+                if !realPath.isEmpty && samePortalTarget(realPath, standardizedExternalURL) {
                     return .stubPortal
                 }
             }
             // 旧版 bash launcher：检查脚本内容
             if let script = try? String(contentsOf: launcherPath, encoding: .utf8),
-               script.contains(standardizedExternalURL.path) {
-                return .stubPortal
+               let assignment = script.components(separatedBy: .newlines)
+                    .map({ $0.trimmingCharacters(in: .whitespaces) }).first(where: { $0.hasPrefix("REAL_APP=") }),
+               assignment.hasPrefix("REAL_APP='"), assignment.hasSuffix("'") {
+                let path = String(assignment.dropFirst("REAL_APP='".count).dropLast())
+                    .replacingOccurrences(of: "'\\''", with: "'")
+                if samePortalTarget(path, standardizedExternalURL) { return .stubPortal }
             }
         }
 
@@ -1556,72 +1580,40 @@ struct AppMigrationService {
     /// 仅对带标记文件的真实镜像文件夹生效，旧版整体符号链接文件夹会被安全跳过。
     func refreshFolderMirror(at localFolderURL: URL, from externalFolderURL: URL) {
         let fm = fileManager
-
-        // 仅处理 AppPorts 镜像文件夹（标记存在），其余（旧 symlink 文件夹、用户真实文件夹）跳过
-        let markerURL = localFolderURL.appendingPathComponent(Self.folderPortalMarkerName)
-        guard fm.fileExists(atPath: markerURL.path),
-              let externalEntries = try? fm.contentsOfDirectory(
-                  at: externalFolderURL,
-                  includingPropertiesForKeys: nil,
-                  options: .skipsHiddenFiles
-              ) else {
-            return
-        }
-
-        let externalNames = Set(externalEntries.map { $0.lastPathComponent })
+        guard (try? fm.attributesOfItem(atPath: localFolderURL.path)[.type]) as? FileAttributeType == .typeDirectory,
+              let recorded = Self.folderMirrorExternalURL(at: localFolderURL, fileManager: fm),
+              recorded.resolvingSymlinksInPath() == externalFolderURL.resolvingSymlinksInPath(),
+              let externalEntries = try? fm.contentsOfDirectory(at: externalFolderURL,
+                  includingPropertiesForKeys: nil, options: .skipsHiddenFiles) else { return }
+        let externalNames = Set(externalEntries.map(\.lastPathComponent))
         var didChange = false
-
-        // 1. 新增 / 刷新外部存在的条目
         for entry in externalEntries {
-            let localEntry = localFolderURL.appendingPathComponent(entry.lastPathComponent)
-            if entry.pathExtension == "app" {
-                if fm.fileExists(atPath: localEntry.path),
-                   localPortalKind(at: localEntry, linkedTo: entry) == .stubPortal {
-                    // 现有内部 Stub：同步版本/图标
-                    refreshStubPortal(at: localEntry, from: entry)
-                } else {
-                    // 外部新增 app（或本地缺失/损坏）：重建 Stub
-                    try? fm.removeItem(at: localEntry)
-                    do {
-                        try createStubPortal(at: localEntry, pointingTo: entry)
-                        didChange = true
-                    } catch {
-         
```

**File**: `AppPortsTests/AppMigrationServiceTests.swift` (modified, +32/-0)
```diff
@@ -985,6 +985,38 @@ final class AppMigrationServiceTests: XCTestCase {
         XCTAssertEqual(try String(contentsOf: target.appendingPathComponent("Contents/Resources/payload.txt")), "unrelated-original")
     }
 
+    func testRefreshNeverWritesThroughLegacyPortalOrUsesDifferentTarget() throws {
+        let w = try makeWorkspace()
+        defer { cleanupWorkspace(w.rootURL) }
+        let real = w.externalRootURL.appendingPathComponent("Foo.app")
+        let other = w.rootURL.appendingPathComponent("Other/Foo.app")
+        let local = w.localAppsURL.appendingPathComponent("Foo.app")
+        try createAppBundle(at: real)
+        try createAppBundle(at: other)
+        try updateReviewPlist(other, values: ["CFBundleShortVersionString": "2.0"])
+        let original = try Data(contentsOf: real.appendingPathComponent("Contents/Info.plist"))
+        try fileManager.createSymbolicLink(at: local, withDestinationURL: real)
+        AppMigrationService(dockShortcutUpdater: { _, _ in 0 }).refreshStubPortal(at: local, from: other)
+        XCTAssertEqual(try Data(contentsOf: real.appendingPathComponent("Contents/Info.plist")), original)
+    }
+
+    func testFolderRefreshPreservesLocalRealFilesAndReplacementApps() throws {
+        let w = try makeWorkspace()
+        defer { cleanupWorkspace(w.rootURL) }
+        let local = w.localAppsURL.appendingPathComponent("Suite")
+        let external = w.externalRootURL.appendingPathComponent("Suite")
+        try createAppBundle(at: local.appendingPathComponent("Foo.app"), payload: "local-official-update")
+        try createAppBundle(at: external.appendingPathComponent("Foo.app"))
+        let marker: [String: Any] = ["externalPath": external.path, "createdBy": "AppPorts", "kind": "folderMirror", "version": 1]
+        try PropertyListSerialization.data(fromPropertyList: marker, format: .xml, options: 0)
+            .write(to: local.appendingPathComponent(AppMigrationService.folderPortalMarkerName))
+        let note = local.appendingPathComponent("my-notes.txt")
+        try Data("keep me".utf8).write(to: note)
+        AppMigrationService(dockShortcutUpdater: { _, _ in 0 }).refreshFolderMirror(at: local, from: external)
+        XCTAssertTrue(fileManager.fileExists(atPath: note.path))
+        XCTAssertEqual(try String(contentsOf: local.appendingPathComponent("Foo.app/Contents/Resources/payload.txt")), "local-official-update")
+    }
+
     func testRestoreRejectsRunningAppBeforeChangingEitherCopy() async throws {
         let w = try makeWorkspace()
         defer { cleanupWorkspace(w.rootURL) }
```

---

### Incident Patch 5: `0d49bc64` (2026-10-05)
**Commit Message**: fix(apps): verify identity and version before replacing targets

**File**: `AppPorts/Services/AppMigrationService.swift` (modified, +28/-1)
```diff
@@ -1216,9 +1216,36 @@ struct AppMigrationService {
         }
     }
 
+    private func applicationMetadata(at url: URL) -> [String: Any]? {
+        guard case .success(let identity) = AppIdentityResolver.resolve(at: url) else { return nil }
+        for path in ["Contents/Info.plist", "Info.plist"] {
+            if let data = try? Data(contentsOf: identity.identityBundleURL.appendingPathComponent(path)),
+               let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any] {
+                return plist
+            }
+        }
+        return nil
+    }
+
     private func externalTargetReplacementReason(for appToMove: AppItem, destinationURL: URL) -> String? {
         if appToMove.status == AppStatus.pendingMoveOut {
-            return "pending_move_out"
+            // A scanner status is not authority to delete the name-based destination.
+            guard let source = applicationMetadata(at: appToMove.path),
+                  let target = applicationMetadata(at: destinationURL),
+                  let sourceID = source["CFBundleIdentifier"] as? String,
+                  let targetID = target["CFBundleIdentifier"] as? String,
+                  !sourceID.isEmpty, sourceID == targetID else { return nil }
+            for key in ["CFBundleShortVersionString", "CFBundleVersion"] {
+                guard let newer = source[key] as? String, let older = target[key] as? String,
+                      !newer.isEmpty, !older.isEmpty,
+                      newer.allSatisfy({ $0.isNumber || $0 == "." }),
+                      older.allSatisfy({ $0.isNumber || $0 == "." }) else { return nil }
+                let comparison = newer.compare(older, options: .numeric)
+                if comparison != .orderedSame {
+                    return comparison == .orderedDescending ? "pending_move_out" : nil
+                }
+            }
+            return nil
         }
 
         guard let portalKind = localPortalKind(at: destinationURL) else {
```

**File**: `AppPortsTests/AppMigrationServiceTests.swift` (modified, +25/-0)
```diff
@@ -339,6 +339,7 @@ final class AppMigrationServiceTests: XCTestCase {
         let externalAppURL = workspace.externalRootURL.appendingPathComponent("Replace.app")
         try createAppBundle(at: localAppURL, payload: "new-local")
         try createAppBundle(at: externalAppURL, payload: "old-external")
+        try updateReviewPlist(localAppURL, values: ["CFBundleShortVersionString": "2.0"])
 
         try await AppMigrationService(dockShortcutUpdater: { _, _ in 0 }).moveAndLink(
             appToMove: AppItem(name: "Replace.app", path: localAppURL, status: AppStatus.pendingMoveOut),
@@ -967,6 +968,23 @@ final class AppMigrationServiceTests: XCTestCase {
         XCTAssertFalse(fileManager.fileExists(atPath: externalAppURL.path))
     }
 
+    func testPendingMoveOutRejectsDifferentDestinationIdentity() async throws {
+        let w = try makeWorkspace()
+        defer { cleanupWorkspace(w.rootURL) }
+        let local = w.localAppsURL.appendingPathComponent("Foo.app")
+        let target = w.externalRootURL.appendingPathComponent("Foo.app")
+        try createAppBundle(at: local, payload: "new-local")
+        try createAppBundle(at: target, payload: "unrelated-original")
+        try updateReviewPlist(target, values: ["CFBundleIdentifier": "com.other.app"])
+        do {
+            try await AppMigrationService(dockShortcutUpdater: { _, _ in 0 }).moveAndLink(
+                appToMove: AppItem(name: "Foo.app", path: local, status: AppStatus.pendingMoveOut),
+                destinationURL: target, isRunning: false, progressHandler: nil)
+            XCTFail("A display status must not authorize replacing a different application")
+        } catch {}
+        XCTAssertEqual(try String(contentsOf: target.appendingPathComponent("Contents/Resources/payload.txt")), "unrelated-original")
+    }
+
     func testRestoreRejectsRunningAppBeforeChangingEitherCopy() async throws {
         let w = try makeWorkspace()
         defer { cleanupWorkspace(w.rootURL) }
@@ -1005,6 +1023,13 @@ final class AppMigrationServiceTests: XCTestCase {
         }
     }
 
+    private func updateReviewPlist(_ app: URL, values: [String: String]) throws {
+        let url = app.appendingPathComponent("Contents/Info.plist")
+        var plist = try XCTUnwrap(PropertyListSerialization.propertyList(from: Data(contentsOf: url), format: nil) as? [String: Any])
+        for (key, value) in values { plist[key] = value }
+        try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0).write(to: url)
+    }
+
     private func makeWorkspace() throws -> (rootURL: URL, localAppsURL: URL, externalRootURL: URL) {
         let rootURL = fileManager.temporaryDirectory.appendingPathComponent("AppPortsTests-\(UUID().uuidString)")
         let localAppsURL = rootURL.appendingPathComponent("Applications")
```

---

### Incident Patch 6: `aa33e819` (2026-10-05)
**Commit Message**: fix(apps): recheck running applications during restore

**File**: `AppPorts/Services/AppMigrationService.swift` (modified, +25/-0)
```diff
@@ -6,6 +6,7 @@
 //
 
 import Foundation
+import AppKit
 
 struct AppMigrationService {
     typealias FinderRemover = (URL) throws -> Void
@@ -43,17 +44,24 @@ struct AppMigrationService {
     private let fileManager: FileManager
     private let portalCreationOverride: PortalCreationOverride?
     private let dockShortcutUpdater: DockShortcutUpdater
+    private let runningApplications: () -> [AppRunningState.RunningApplication]
 
     init(
         fileManager: FileManager = .default,
         portalCreationOverride: PortalCreationOverride? = nil,
         dockShortcutUpdater: @escaping DockShortcutUpdater = { source, destination in
             try DockShortcutService.shared.redirectShortcuts(from: source, to: destination)
+        },
+        runningApplications: @escaping () -> [AppRunningState.RunningApplication] = {
+            NSWorkspace.shared.runningApplications.map {
+                .init(bundleURL: $0.bundleURL, bundleIdentifier: $0.bundleIdentifier)
+            }
         }
     ) {
         self.fileManager = fileManager
         self.portalCreationOverride = portalCreationOverride
         self.dockShortcutUpdater = dockShortcutUpdater
+        self.runningApplications = runningApplications
     }
 
     static func checkWritePermission(at localURL: URL, fileManager: FileManager = .default) throws {
@@ -626,6 +634,7 @@ struct AppMigrationService {
         localDestinationURL: URL,
         progressHandler: FileCopier.ProgressHandler?
     ) async throws -> RestoreResult {
+        try requireNotRunning(app)
         let operationID = AppLogger.shared.makeOperationID(prefix: "app-restore")
         let startedAt = Date()
         var operationResult = "failed"
@@ -794,6 +803,10 @@ struct AppMigrationService {
             destPath: localDestinationURL.path
         )
 
+        // A process may have started while the copy was in progress. Keep both
+        // complete copies if so; never delete resources from a live application.
+        try requireNotRunning(app)
+
         // 本地副本完整后即可切回；外部副本清理失败也不应让 Dock 继续打开旧副本。
         var dockSynchronized = synchronizeDockShortcuts(
             from: app.path, to: localDestinationURL, operationID: operationID
@@ -1191,6 +1204,18 @@ struct AppMigrationService {
         return URL(fileURLWithPath: rawPath, relativeTo: url.deletingLastPathComponent()).standardizedFileURL
     }
 
+    private func requireNotRunning(_ app: AppItem) throws {
+        var urls = [app.path]
+        if app.usesFolderOperation {
+            urls += try fileManager.contentsOfDirectory(at: app.path, includingPropertiesForKeys: nil)
+                .filter { $0.pathExtension.lowercased() == "app" }
+        }
+        let snapshot = runningApplications()
+        guard !urls.contains(where: { AppRunningState.isRunning(appURL: $0, applications: snapshot) }) else {
+            throw AppMoverError.appIsRunning
+        }
+    }
+
     private func externalTargetReplacementReason(for appToMove: AppItem, destinationURL: URL) -> String? {
         if appToMove.status == AppStatus.pendingMoveOut {
             return "pending_move_out"
```

**File**: `AppPortsTests/AppMigrationServiceTests.swift` (modified, +38/-0)
```diff
@@ -967,6 +967,44 @@ final class AppMigrationServiceTests: XCTestCase {
         XCTAssertFalse(fileManager.fileExists(atPath: externalAppURL.path))
     }
 
+    func testRestoreRejectsRunningAppBeforeChangingEitherCopy() async throws {
+        let w = try makeWorkspace()
+        defer { cleanupWorkspace(w.rootURL) }
+        let external = w.externalRootURL.appendingPathComponent("Live.app")
+        let local = w.localAppsURL.appendingPathComponent("Live.app")
+        try createAppBundle(at: external, payload: "live-app")
+        let service = AppMigrationService(dockShortcutUpdater: { _, _ in 0 },
+            runningApplications: { [.init(bundleURL: external, bundleIdentifier: nil)] })
+        do {
+            _ = try await service.moveBack(app: AppItem(name: "Live.app", path: external, status: "外部"),
+                                          localDestinationURL: local, progressHandler: nil)
+            XCTFail("Running source must be rejected")
+        } catch AppMoverError.appIsRunning {} catch { XCTFail("Unexpected error: \(error)") }
+        XCTAssertEqual(try String(contentsOf: external.appendingPathComponent("Contents/Resources/payload.txt")), "live-app")
+        XCTAssertFalse(fileManager.fileExists(atPath: local.path))
+    }
+
+    func testRestoreRetainsSourceWhenAppStartsDuringCopy() async throws {
+        let w = try makeWorkspace()
+        defer { cleanupWorkspace(w.rootURL) }
+        let external = w.externalRootURL.appendingPathComponent("Live.app")
+        let local = w.localAppsURL.appendingPathComponent("Live.app")
+        try createAppBundle(at: external, payload: "live-app")
+        var calls = 0
+        let service = AppMigrationService(dockShortcutUpdater: { _, _ in 0 }, runningApplications: {
+            calls += 1
+            return calls > 1 ? [.init(bundleURL: external, bundleIdentifier: nil)] : []
+        })
+        do {
+            _ = try await service.moveBack(app: AppItem(name: "Live.app", path: external, status: "外部"),
+                                          localDestinationURL: local, progressHandler: nil)
+            XCTFail("Late start must preserve the source")
+        } catch AppMoverError.appIsRunning {} catch { XCTFail("Unexpected error: \(error)") }
+        for app in [external, local] {
+            XCTAssertEqual(try String(contentsOf: app.appendingPathComponent("Contents/Resources/payload.txt")), "live-app")
+        }
+    }
+
     private func makeWorkspace() throws -> (rootURL: URL, localAppsURL: URL, externalRootURL: URL) {
         let rootURL = fileManager.temporaryDirectory.appendingPathComponent("AppPortsTests-\(UUID().uuidString)")
         let localAppsURL = rootURL.appendingPathComponent("Applications")
```

---

### Incident Patch 7: `53e30131` (2026-10-05)
**Commit Message**: fix(restore): resume verified private recovery mounts

**File**: `AppPorts/Models/DataTransferRecord.swift` (modified, +2/-0)
```diff
@@ -86,6 +86,8 @@ struct DataTransferRecord: Codable, Equatable, Identifiable, Sendable {
     var legacyRootOwnership: TreeCopySnapshot.Ownership? = nil
     /// Original noowners flags; absent if the source already uses owners or is restored offline.
     var legacyMountFlags: UInt32? = nil
+    /// Identity of our private empty mount point, recorded before the mount attempt.
+    var recoveryMountPointIdentity: DataPathIdentity? = nil
     var recoverableReason: String?
 
     init(operationID: UUID = UUID(), mode: Mode, direction: Direction, sourceID: String? = nil,
```

**File**: `AppPorts/Services/ContainerMountStore.swift` (modified, +2/-0)
```diff
@@ -498,6 +498,8 @@ final class ContainerMountStore: @unchecked Sendable {
               old.destinationIdentity == nil || old.destinationIdentity == transfer.destinationIdentity,
               old.backupIdentity == nil || old.backupIdentity == transfer.backupIdentity,
               old.baseline == nil || old.baseline == transfer.baseline,
+              old.recoveryMountPointIdentity == transfer.recoveryMountPointIdentity
+                || (old.isUnstartedMountRestore && transfer.isUnstartedMountRestore && old.recoveryMountPointIdentity == nil),
               old.legacyRootOwnership == transfer.legacyRootOwnership
                 || (old.isUnstartedMountRestore && transfer.isUnstartedMountRestore && old.legacyRootOwnership == nil),
               old.legacyMountFlags == transfer.legacyMountFlags
```

**File**: `AppPorts/Utils/ContainerVolumeMigrator.swift` (modified, +33/-7)
```diff
@@ -529,7 +529,7 @@ actor ContainerVolumeMigrator {
                 && $0.priorOperationID == prior?.operationID
         }
         guard resumable.count <= 1 else { throw DataOperationSafety.Failure.conflict(mountPoint.path) }
-        if let pending = resumable.first { try validateUnstartedRestorePaths(pending, record: record) }
+        if let pending = resumable.first { try await validateUnstartedRestorePaths(pending, record: record) }
         var ownedIDs = Set(prior.map { [$0.operationID] } ?? [])
         if let pending = resumable.first { ownedIDs.insert(pending.operationID) }
         try safety.requireNoOverlap(at: mountPoint, ownedMount: record, ownedTransferIDs: ownedIDs)
@@ -598,7 +598,20 @@ actor ContainerVolumeMigrator {
                     try await safety.requireNoKnownWriters(at: current, bundleIdentifier: record.bundleIdentifier)
                 }
                 try fileManager.createDirectory(at: recovery.deletingLastPathComponent(), withIntermediateDirectories: true)
-                try await mountVolume(record.volumeUUID, at: recovery, operationID: operationID, knownMountPoint: hint)
+                if transfer.recoveryMountPointIdentity == nil {
+                    // Creation must be exclusive; a pre-existing directory is not our intent.
+                    try fileManager.createDirectory(at: recovery, withIntermediateDirectories: false)
+                    transfer.recoveryMountPointIdentity = try DataPathIdentity.capture(recovery)
+                    try store.updateTransfer(transfer)
+                }
+                if isMountPoint(recovery) {
+                    // A prior attempt may have mounted successfully before its postcheck failed.
+                    // Inspect the retained volume directly; a new lease would inspect its payload.
+                    try await requireExpectedVolume(record.volumeUUID, at: recovery)
+                    try await safety.requireNoKnownWriters(at: recovery, bundleIdentifier: record.bundleIdentifier)
+                } else {
+                    try await mountVolume(record.volumeUUID, at: recovery, operationID: operationID, knownMountPoint: hint)
+                }
                 source = recovery
             }
             try requireOwners(at: source)
@@ -944,7 +957,7 @@ actor ContainerVolumeMigrator {
         return (DiskUtility.pathsMatch(current, mountPoint.path) ? .reportedByDiskUtil : .notMounted, info)
     }
 
-    private func validateUnstartedRestorePaths(_ transfer: DataTransferRecord, record: ContainerMountRecord) throws {
+    private func validateUnstartedRestorePaths(_ transfer: DataTransferRecord, record: ContainerMountRecord) async throws {
         let root = record.mountPointURL
         let staging = root.deletingLastPathComponent().appendingPathComponent(".appports-restore-staging-\(transfer.operationID.uuidString)")
         let recovery = stagingMountRootURL.appendingPathComponent("recovery-\(transfer.operationID.uuidString)")
@@ -953,10 +966,23 @@ actor ContainerVolumeMigrator {
               transfer.stagingPath == staging.path, transfer.backupPath == recovery.path else {
             throw DataOperationSafety.Failure.conflict(root.path)
         }
-        for path in [staging, recovery] {
-            var info = stat()
-            guard lstat(path.path, &info) != 0, errno == ENOENT else {
-                throw DataOperationSafety.Failure.conflict(path.path)
+        var info = stat()
+        guard lstat(staging.path, &info) != 0, errno == ENOENT else {
+            throw DataOperationSafety.Failure.conflict(staging.path)
+        }
+        if let expected = transfer.recoveryMountPointIdentity {
+            if isMountPoint(recovery) {
+                try await requireExpectedVolume(record.volumeUUID, at: recovery)
+            } else {
+                guard lstat(recovery.path, &info) == 0, info.st_mode & S_IFMT == S_IFDIR,
+                      try DataPathIdentity.capture(recovery).matchesFilesystemObject(expected) else {
+                    throw DataOperationSafety.Failure.conflict(recovery.path)
+                }
+                // mountVolume's descriptor-backed lease checks emptiness before any mount.
+            }
+        } else {
+            guard lstat(recovery.path, &info) != 0, errno == ENOENT else {
+                throw DataOperationSafety.Failure.conflict(recovery.path)
             }
         }
     }
```

**File**: `AppPortsTests/ContainerVolumeMigratorTests.swift` (modified, +66/-0)
```diff
@@ -590,6 +590,72 @@ struct ContainerVolumeMigratorTests {
             sourceIdentity: DataPathIdentity(volumeUUID: record.volumeUUID), phase: .needsRecovery)
     }
 
+    @Test("A failed offline mount can be retried after reloading its durable intent")
+    func failedOfflineRestoreCanRetry() async throws {
+        let workspace = try Workspace()
+        defer { workspace.cleanup() }
+        let source = try workspace.makeContainerDirectory(named: "OfflineRetry")
+        let record = workspace.record(mountPoint: source)
+        try workspace.store.upsert(record)
+        let runner = FakeDiskCommandRunner(onlineVolumes: [record.volumeUUID])
+        runner.hideContentsOnUnmount()
+        defer { runner.stashedVolumeContents.forEach { try? FileManager.default.removeItem(at: $0) } }
+        // Materialize a fake volume so unmount/remount keeps its payload, just as APFS does.
+        try FileManager.default.removeItem(at: source.appendingPathComponent("payload.txt"))
+        try await workspace.makeMigrator(runner: runner).mount(record: record)
+        try Data("payload".utf8).write(to: source.appendingPathComponent("payload.txt"))
+        try await workspace.makeMigrator(runner: runner).unmount(record: record)
+        runner.failWhen(prefix: ["mount"])
+        await #expect(throws: (any Error).self) {
+            try await workspace.makeMigrator(runner: runner).restore(record: record, estimatedTotalBytes: 0, progressHandler: nil)
+        }
+        let pending = try #require(try workspace.store.transfers().first)
+        runner.clearFailure()
+        let cold = ContainerMountStore(fileURL: workspace.rootURL.appendingPathComponent("container-mounts.plist"))
+        _ = try await workspace.makeMigrator(runner: runner, storeOverride: cold)
+            .restore(record: record, estimatedTotalBytes: 0, progressHandler: nil)
+        let completed = try #require(try cold.transfers().first)
+        #expect(completed.operationID == pending.operationID)
+        #expect(completed.phase == .awaitingUserVerification)
+        #expect(try String(contentsOf: source.appendingPathComponent("payload.txt")) == "payload")
+    }
+
+    @Test("An already mounted recovery volume survives a cold restore retry")
+    func mountedOfflineRestoreCanRetry() async throws {
+        let workspace = try Workspace()
+        defer { workspace.cleanup() }
+        let source = try workspace.makeContainerDirectory(named: "MountedOfflineRetry")
+        let record = workspace.record(mountPoint: source)
+        try workspace.store.upsert(record)
+        let runner = FakeDiskCommandRunner(onlineVolumes: [record.volumeUUID])
+        runner.hideContentsOnUnmount()
+        defer { runner.stashedVolumeContents.forEach { try? FileManager.default.removeItem(at: $0) } }
+        try FileManager.default.removeItem(at: source.appendingPathComponent("payload.txt"))
+        try await workspace.makeMigrator(runner: runner).mount(record: record)
+        try Data("payload".utf8).write(to: source.appendingPathComponent("payload.txt"))
+        try await workspace.makeMigrator(runner: runner).unmount(record: record)
+        // The mount succeeds, but its ownership postcheck fails before source identity is saved.
+        let failing = workspace.makeMigrator(runner: runner,
+            mountFlags: { _ in UInt32(MNT_IGNORE_OWNERSHIP) })
+        await #expect(throws: (any Error).self) {
+            try await failing.restore(record: record, estimatedTotalBytes: 0, progressHandler: nil)
+        }
+        let pending = try #require(try workspace.store.transfers().first)
+        #expect(pending.isUnstartedMountRestore)
+        let recovery = URL(fileURLWithPath: try #require(pending.backupPath))
+        #expect(runner.isMounted(recovery))
+        #expect(try String(contentsOf: recovery.appendingPathComponent("payload.txt")) == "payload")
+        let mountCount = runner.commands(prefix: ["mount"]).count
+        let cold = ContainerMountStore(fileURL: workspace.rootURL.appendingPathComponent("container-mounts.plist"))
+        _ = try await workspace.makeMigrator(runner: runner, storeOverride: cold)
+            .restore(record: record, estimatedTotalBytes: 0, progressHandler: nil)
+        let completed = try #require(try cold.transfers().first)
+        #expect(completed.operationID == pending.operationID)
+        #expect(completed.phase == .awaitingUserVerification)
+        #expect(runner.commands(prefix: ["mount"]).count == mountCount)
+        #expect(try String(contentsOf: source.appendingPathComponent("payload.txt")) == "payload")
+    }
+
     @Test("An unstarted restore reuses its operation ID without discarding evidence")
     func restoreResumesUnstartedIntent() async throws {
         let workspace = try Workspace()
```

---

### Incident Patch 8: `89b65590` (2026-10-05)
**Commit Message**: fix(data): preserve historical types when relinking directories

**File**: `AppPorts/Utils/DataDirMover.swift` (modified, +20/-3)
```diff
@@ -182,7 +182,7 @@ actor DataDirMover {
             guard try !entryExists(local) else { throw DataDirError.destinationExists(local) }
             adoptedEntry = nil
         }
-        let type = inferType(for: local) ?? .custom
+        let type = try managedType(for: local, external: external, indexedType: old?.dataDirType)
         try requireMarker(at: external, for: local, type: type, allowOwned: true)
         let history = try store.transfers()
         let owned = old.map { transferAncestors(of: $0.operationID, transfers: history) } ?? []
@@ -234,8 +234,9 @@ actor DataDirMover {
         guard isSymbolicLink(at: local), DataPathTopology.relationship(local.path, source.path) == .same else { throw DataDirError.invalidSymlink(local) }
         if DataPathTopology.relationship(source.path, destination.path) == .same { return }
         guard try !entryExists(destination) else { throw DataDirError.destinationExists(destination) }
-        try requireMarker(at: source, for: local, type: inferType(for: local) ?? .custom, allowOwned: true)
         let old = try store.managedLink(forOriginalPath: local.path)
+        let type = try managedType(for: local, external: source, indexedType: old?.dataDirType)
+        try requireMarker(at: source, for: local, type: type, allowOwned: true)
         let sourceIdentity = try DataPathIdentity.capture(source)
         if let old { try requireIdentity(source, old.destinationIdentity) }
         let history = try store.transfers()
@@ -249,7 +250,6 @@ actor DataDirMover {
         let id = UUID()
         let staging = local.deletingLastPathComponent().appendingPathComponent(".appports-normalize-\(id)")
         let linkIdentity = try DataPathIdentity.capture(local)
-        let type = inferType(for: local) ?? .custom
         var transfer = DataTransferRecord(operationID: id, mode: .symlink, direction: .migrate, sourceID: local.path,
             appName: old?.appName ?? local.lastPathComponent, bundleIdentifier: old?.bundleIdentifier ?? inferredBundleIdentifier(local),
             dataDirType: type.rawValue, originalPath: local.path, activePath: source.path, destinationPath: destination.path,
@@ -543,6 +543,23 @@ actor DataDirMover {
             .appendingPathComponent(".\(standardizedURL.lastPathComponent)\(managedLinkMetadataSidecarSuffix)")
     }
 
+    /// Type is part of a validated historical record, not a classification of its path.
+    private func managedType(for local: URL, external: URL, indexedType: String?) throws -> DataDirType {
+        if let indexedType, let type = DataDirType(rawValue: indexedType) { return type }
+        let marker = markerURL(for: external)
+        if try entryExists(marker) {
+            guard !isSymbolicLink(at: marker),
+                  let data = try? Data(contentsOf: marker),
+                  let metadata = try? PropertyListDecoder().decode(ManagedLinkMetadata.self, from: data),
+                  let type = DataDirType(rawValue: metadata.dataDirType) else {
+                throw DataDirError.metadataWriteFailed(DataOperationSafety.Failure.conflict(marker.path))
+            }
+            try requireMarker(at: external, for: local, type: type, allowOwned: true)
+            return type
+        }
+        return inferType(for: local) ?? .custom
+    }
+
     private func inferType(for localPath: URL) -> DataDirType? {
         let path = localPath.standardizedFileURL.path
         let libraryRoot = homeDir.appendingPathComponent("Library")
```

**File**: `AppPortsTests/DataDirMoverTests.swift` (modified, +16/-0)
```diff
@@ -22,6 +22,22 @@ final class DataDirMoverTests: XCTestCase {
         try super.tearDownWithError()
     }
 
+    func testCustomDirectoryTypeSurvivesDisconnectAndRelink() async throws {
+        for path in [".review-custom", "Library/Application Support/ReviewCustom"] {
+            let w = try makeWorkspace()
+            defer { cleanupWorkspace(w.rootURL) }
+            let local = w.homeURL.appendingPathComponent(path)
+            try createDirectoryWithPayload(at: local, payload: "custom-data")
+            let item = DataDirItem(name: "Custom", path: local, type: .custom, priority: .optional, description: "")
+            let mover = makeMover(homeDir: w.homeURL)
+            try await mover.migrate(item: item, to: w.externalRootURL, progressHandler: nil)
+            let external = local.resolvingSymlinksInPath()
+            try await mover.deleteLink(localPath: local)
+            try await mover.createLink(localPath: local, externalPath: external)
+            try assertSymlink(local, pointsTo: external)
+        }
+    }
+
     func testMigrateAndRestoreRoundTripForApplicationSupportDirectory() async throws {
         let workspace = try makeWorkspace()
         defer { cleanupWorkspace(workspace.rootURL) }
```

---

### Incident Patch 9: `856c6589` (2026-10-05)
**Commit Message**: fix(copy): preserve and verify directory ACLs

**File**: `AppPorts/Utils/FileCopier.swift` (modified, +31/-0)
```diff
@@ -365,6 +365,7 @@ actor FileCopier {
             }
             Self.copyDirectoryExtendedAttributes(from: directory.source, to: directory.destination, removeQuarantine: removeQuarantine)
             try fileManager.setAttributes(directory.attributes, ofItemAtPath: directory.destination.path)
+            try Self.copyDirectoryACL(from: directory.source, to: directory.destination)
             await reportProgressIfNeeded(name: directory.source.lastPathComponent, state: &state, progressHandler: progressHandler)
         }
         if let firstGroupRestoreError {
@@ -522,6 +523,36 @@ actor FileCopier {
         }
     }
 
+    nonisolated private static func copyDirectoryACL(from source: URL, to destination: URL) throws {
+        var sourceACL = acl_get_file(source.path, ACL_TYPE_EXTENDED)
+        if sourceACL == nil {
+            if errno == ENOTSUP { return }
+            // Darwin uses ENOENT for a present directory with no extended ACL.
+            guard errno == ENOENT, FileManager.default.fileExists(atPath: source.path) else {
+                throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
+            }
+            sourceACL = acl_init(0)
+        }
+        guard let acl = sourceACL else { throw POSIXError(.ENOMEM) }
+        defer { acl_free(UnsafeMutableRawPointer(acl)) }
+        var entry: acl_entry_t?
+        let hasEntries = acl_get_entry(acl, ACL_FIRST_ENTRY.rawValue, &entry) == 0
+        guard acl_set_file(destination.path, ACL_TYPE_EXTENDED, acl) == 0 else {
+            if !hasEntries, errno == ENOTSUP { return }
+            throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
+        }
+        guard let actual = acl_get_file(destination.path, ACL_TYPE_EXTENDED) else {
+            if !hasEntries, errno == ENOENT, FileManager.default.fileExists(atPath: destination.path) { return }
+            throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
+        }
+        defer { acl_free(UnsafeMutableRawPointer(actual)) }
+        guard let expectedText = acl_to_text(acl, nil), let actualText = acl_to_text(actual, nil) else {
+            throw POSIXError(.EIO)
+        }
+        defer { acl_free(expectedText); acl_free(actualText) }
+        guard String(cString: expectedText) == String(cString: actualText) else { throw POSIXError(.EIO) }
+    }
+
     nonisolated private static func isManagedLinkMetadataFile(_ fileName: String) -> Bool {
         fileName == ".appports-link-metadata.plist"
             || (fileName.hasPrefix(".") && fileName.hasSuffix(".appports-link-metadata.plist"))
```

**File**: `AppPortsTests/FileCopierTests.swift` (modified, +23/-0)
```diff
@@ -5,6 +5,29 @@ import XCTest
 final class FileCopierTests: XCTestCase {
     private let fileManager = FileManager.default
 
+    func testDirectoryACLIsPreserved() async throws {
+        let w = try makeWorkspace()
+        defer { cleanup(w.root) }
+        let command = Process()
+        command.executableURL = URL(fileURLWithPath: "/bin/chmod")
+        command.arguments = ["+a", "everyone allow read,readattr,readextattr,readsecurity", w.source.path]
+        try command.run()
+        command.waitUntilExit()
+        XCTAssertEqual(command.terminationStatus, 0)
+        func aclText(_ url: URL) throws -> String {
+            guard let acl = acl_get_file(url.path, ACL_TYPE_EXTENDED) else { return "" }
+            defer { acl_free(UnsafeMutableRawPointer(acl)) }
+            guard let text = acl_to_text(acl, nil) else { return "" }
+            defer { acl_free(text) }
+            return String(cString: text)
+        }
+        let original = try aclText(w.source)
+        XCTAssertFalse(original.isEmpty)
+        _ = try await FileCopier().copyDirectory(from: w.source, to: w.destination, progressHandler: nil)
+        XCTAssertEqual(try aclText(w.destination), original)
+        XCTAssertEqual(try aclText(w.source), original)
+    }
+
     func testCopiesManySmallFilesWithRootAndNestedDirectoryMetadata() async throws {
         let workspace = try makeWorkspace()
         defer { cleanup(workspace.root) }
```

---

### Incident Patch 10: `ff8452a6` (2026-10-05)
**Commit Message**: fix(process): bound command deadlines and cancellation

**File**: `AppPorts/Utils/DiskUtility.swift` (modified, +79/-65)
```diff
@@ -29,81 +29,95 @@ protocol ShellCommandRunning: Sendable {
 /// 用 Process 执行外部命令。超时后终止进程，避免 diskutil 挂死时整个操作卡住。
 struct ProcessCommandRunner: ShellCommandRunning {
     func run(executable: String, arguments: [String], timeout: TimeInterval) async throws -> ShellCommandResult {
-        try await withCheckedThrowingContinuation { continuation in
-            let process = Process()
-            process.executableURL = URL(fileURLWithPath: executable)
-            process.arguments = arguments
-            process.standardInput = FileHandle.nullDevice
-            let outputPipe = Pipe()
-            let errorPipe = Pipe()
-            process.standardOutput = outputPipe
-            process.standardError = errorPipe
-
-            let collector = OutputCollector()
-            let readers = DispatchGroup()
-            readers.enter()
-            DispatchQueue.global(qos: .utility).async {
-                collector.setStandardOutput(outputPipe.fileHandleForReading.readDataToEndOfFile())
-                readers.leave()
-            }
-            readers.enter()
-            DispatchQueue.global(qos: .utility).async {
-                collector.setStandardError(errorPipe.fileHandleForReading.readDataToEndOfFile())
-                readers.leave()
+        // Include dispatch queueing and process launch in the caller's time budget.
+        let deadline = ProcessInfo.processInfo.systemUptime + max(0, timeout)
+        let cancellation = CancellationState()
+        return try await withTaskCancellationHandler(operation: {
+            try Task.checkCancellation()
+            return try await withCheckedThrowingContinuation { continuation in
+                DispatchQueue.global(qos: .utility).async {
+                    do { continuation.resume(returning: try Self.execute(executable: executable,
+                        arguments: arguments, deadline: deadline, cancellation: cancellation)) }
+                    catch { continuation.resume(throwing: error) }
+                }
             }
+        }, onCancel: { cancellation.cancel() })
+    }
 
-            process.terminationHandler = { finished in
-                // 等两个管道读完再返回结果，但不阻塞系统的高优先级退出回调线程。
-                let status = finished.terminationStatus
-                readers.notify(queue: .global(qos: .utility)) {
-                    continuation.resume(returning: collector.result(status: status))
+    /// Nonblocking pipe reads let one deadline cover the child AND inherited pipes.
+    /// This worker never blocks Foundation's process termination callback queue.
+    private static func execute(executable: String, arguments: [String], deadline: TimeInterval,
+                                cancellation: CancellationState) throws -> ShellCommandResult {
+        if cancellation.isCancelled { throw CancellationError() }
+        guard ProcessInfo.processInfo.systemUptime < deadline else {
+            return ShellCommandResult(status: -1, standardOutput: Data(), standardError: Data(), timedOut: true)
+        }
+        let process = Process()
+        process.executableURL = URL(fileURLWithPath: executable)
+        process.arguments = arguments
+        process.standardInput = FileHandle.nullDevice
+        let output = Pipe(), error = Pipe()
+        process.standardOutput = output
+        process.standardError = error
+        let handles = [output.fileHandleForReading, error.fileHandleForReading]
+        defer { handles.forEach { try? $0.close() } }
+        let fds = handles.map(\.fileDescriptor)
+        // A blocking read would bypass the deadline. Validate this before spawning a child.
+        for fd in fds {
+            let flags = fcntl(fd, F_GETFL)
+            guard flags >= 0, fcntl(fd, F_SETFL, flags | O_NONBLOCK) == 0 else {
+                throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
+            }
+        }
+        try process.run()
+        try? output.fileHandleForWriting.close()
+        try? error.fileHandleForWriting.close()
+        var streams = [Data(), Data()]
+        var ended = [false, false]
+        var buffer = [UInt8](repeating: 0, count: 65_536)
+        var stoppingAt: TimeInterval?
+        var timedOut = false
+        while true {
+            // Bound each drain so an endlessly writing child cannot hide the deadline.
+            for index in fds.indices where !ended[index] {
+                for _ in 0..<16 {
+                    let count = Darwin.read(fds[index], &buffer, buffer.count)
+                    if count > 0 { streams[index].append(contentsOf: buffer.prefix(count)) }
+                    else if count == 0 { ended[index] = true; break }
+                    else if errno == EINTR { continue }
+                    else { break }
                 }
             }
-
-            do {
-                try process.run()
-            } catch {
-                process.terminationHandler = nil
-                // 释放写端，让两个读取任务立即结束。
-                try? outputPipe.fileHandleFo
```

**File**: `AppPortsTests/ProcessCommandRunnerTests.swift` (modified, +52/-0)
```diff
@@ -4,6 +4,58 @@ import Testing
 
 @Suite("Process command completion")
 struct ProcessCommandRunnerTests {
+    @Test("Deadline includes ignored termination and inherited pipes", arguments: [
+        "trap '' TERM; /bin/sleep 2", "(/bin/sleep 2; printf tail) & exit 7"
+    ])
+    func boundedDeadline(command: String) async throws {
+        let start = Date()
+        let result = try await ProcessCommandRunner().run(executable: "/bin/sh", arguments: ["-c", command], timeout: 0.1)
+        #expect(result.timedOut)
+        #expect(Date().timeIntervalSince(start) < 1.5)
+    }
+
+    @Test("Concurrent deadlines remain bounded while children retain pipe writers")
+    func concurrentDeadlines() async throws {
+        try await withThrowingTaskGroup(of: Void.self) { group in
+            for index in 0..<16 {
+                group.addTask {
+                    let command = index.isMultiple(of: 2)
+                        ? "trap '' TERM; /bin/sleep 2"
+                        : "(/bin/sleep 2; printf tail) & exit 7"
+                    let start = ProcessInfo.processInfo.systemUptime
+                    let result = try await ProcessCommandRunner().run(
+                        executable: "/bin/sh", arguments: ["-c", command], timeout: 0.1)
+                    #expect(result.timedOut)
+                    #expect(ProcessInfo.processInfo.systemUptime - start < 1.5)
+                }
+            }
+            try await group.waitForAll()
+        }
+    }
+
+    @Test("An expired deadline does not launch the command")
+    func expiredDeadlineSkipsLaunch() async throws {
+        let marker = FileManager.default.temporaryDirectory.appendingPathComponent("process-deadline-\(UUID())")
+        defer { try? FileManager.default.removeItem(at: marker) }
+        let result = try await ProcessCommandRunner().run(executable: "/bin/sh",
+            arguments: ["-c", "printf launched > \"$1\"", "runner-test", marker.path], timeout: 0)
+        #expect(result.timedOut)
+        #expect(!FileManager.default.fileExists(atPath: marker.path))
+    }
+
+    @Test("Cancellation interrupts a child that ignores termination")
+    func cancellationIsBounded() async throws {
+        let task = Task {
+            try await ProcessCommandRunner().run(executable: "/bin/sh",
+                arguments: ["-c", "trap '' TERM; /bin/sleep 2"], timeout: 10)
+        }
+        try await Task.sleep(nanoseconds: 100_000_000)
+        let start = ProcessInfo.processInfo.systemUptime
+        task.cancel()
+        await #expect(throws: CancellationError.self) { try await task.value }
+        #expect(ProcessInfo.processInfo.systemUptime - start < 1.5)
+    }
+
     @Test("Keeps stdout, stderr and the original exit status", arguments: [0, 23])
     func preservesOutputAndStatus(status: Int) async throws {
         let result = try await ProcessCommandRunner().run(
```

---

### Incident Patch 11: `fdd03a11` (2026-10-05)
**Commit Message**: fix(sponsors): update sponsor list with new entry for zed

**File**: `README.md` (modified, +4/-2)
```diff
@@ -3,7 +3,7 @@
 <img src="assets/appports-banner-en.png" alt="AppPorts — macOS App & Data Migration" width="100%">
 
 **Move big apps out. Make room for what matters.**
-
+   
 Move apps and data to an external drive. Open them as usual.
 
 
@@ -173,8 +173,10 @@ AppPorts is completely free, open source and free of ads. It is maintained by a
 Thanks to the following sponsors (this list is kept in sync with `sponsors.json` in the repository root):
 
 - **师杀** · [space.bilibili.com/396481888](https://space.bilibili.com/396481888)
-- **符华**
+- **zed**
 - **VC**
+- **符华**
+
 
 ## Advanced Storage Management
 
```

**File**: `README_CN.md` (modified, +2/-1)
```diff
@@ -173,8 +173,9 @@ AppPorts 完全免费、开源、无广告，项目由个人在业余时间维
 感谢以下赞助者（此列表与仓库根目录的 `sponsors.json` 同步）：
 
 - **师杀** · [space.bilibili.com/396481888](https://space.bilibili.com/396481888)
-- **符华**
+- **zed**
 - **VC**
+- **符华**
  
 ## 🔗 进阶存储管理
 
```

**File**: `sponsors.json` (modified, +6/-0)
```diff
@@ -21,6 +21,12 @@
       "link": "",
       "amount": 8.80,
       "date": "2026-09-30"
+    },
+    {
+      "name": "zed",
+      "link": "",
+      "amount": 50,
+      "date": "2026-10-5"
     }
   ]
 }
```

---

### Incident Patch 12: `5b7b67c4` (2026-10-02)
**Commit Message**: fix(migration): preserve ownership compatibility across upgrades

**File**: `AppPorts/Models/ContainerMountModels.swift` (modified, +10/-1)
```diff
@@ -18,6 +18,10 @@ import Foundation
 struct ContainerMountRecord: Codable, Equatable, Identifiable, Sendable {
     static let currentSchemaVersion = 1
 
+    enum OwnershipPolicy: String, Codable, Sendable {
+        case owners
+    }
+
     /// 以挂载点路径作为稳定 ID
     var id: String { mountPointPath }
 
@@ -37,6 +41,9 @@ struct ContainerMountRecord: Codable, Equatable, Identifiable, Sendable {
     /// 迁移时用户选择的外部存储根目录（记录来源，不参与挂载）
     let externalRootPath: String
     let createdAt: Date
+    /// Missing in historical records: use the volume's persistent system setting.
+    /// New verified migrations require real ownership, even after backup cleanup.
+    var ownershipPolicy: OwnershipPolicy?
 
     init(
         appName: String,
@@ -46,7 +53,8 @@ struct ContainerMountRecord: Codable, Equatable, Identifiable, Sendable {
         volumeUUID: String,
         volumeName: String,
         externalRootPath: String,
-        createdAt: Date = Date()
+        createdAt: Date = Date(),
+        ownershipPolicy: OwnershipPolicy? = nil
     ) {
         self.schemaVersion = Self.currentSchemaVersion
         self.appName = appName
@@ -57,6 +65,7 @@ struct ContainerMountRecord: Codable, Equatable, Identifiable, Sendable {
         self.volumeName = volumeName
         self.externalRootPath = externalRootPath
         self.createdAt = createdAt
+        self.ownershipPolicy = ownershipPolicy
     }
 
     var mountPointURL: URL {
```

**File**: `AppPorts/Models/DataTransferRecord.swift` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@ struct DataTransferRecord: Codable, Equatable, Identifiable, Sendable {
     var baseline: Data?
     /// Preserve the effective legacy root owner without rewriting the retained source manifest.
     var legacyRootOwnership: TreeCopySnapshot.Ownership? = nil
-    /// Original online flags, recorded before ownership is enabled; absent for an offline restore.
+    /// Original noowners flags; absent if the source already uses owners or is restored offline.
     var legacyMountFlags: UInt32? = nil
     var recoverableReason: String?
 
```

**File**: `AppPorts/Services/ContainerMountStore.swift` (modified, +22/-3)
```diff
@@ -55,7 +55,7 @@ final class ContainerMountStore: @unchecked Sendable {
         init(from decoder: Decoder) throws {
             let values = try decoder.container(keyedBy: CodingKeys.self)
             schemaVersion = try values.decode(Int.self, forKey: .schemaVersion)
-            guard schemaVersion == 2 || schemaVersion == 3 else { throw StoreError.unsupportedSchema(schemaVersion) }
+            guard (2...4).contains(schemaVersion) else { throw StoreError.unsupportedSchema(schemaVersion) }
             mounts = try values.decode([ContainerMountRecord].self, forKey: .mounts)
             cleanups = try values.decode([ContainerCleanupRecord].self, forKey: .cleanups)
             transfers = schemaVersion == 2 ? [] : try values.decode([DataTransferRecord].self, forKey: .transfers)
@@ -341,6 +341,15 @@ final class ContainerMountStore: @unchecked Sendable {
             guard deletionConfirmed else { throw StoreError.deletionNotConfirmed }
             guard let transfer = current.transfers.first(where: { $0.operationID == operationID }) else { return }
             guard transfer.phase == .cleanupRequested else { throw StoreError.invalidState("Cleanup must be explicitly requested") }
+            // Earlier safety builds kept the owners contract only in the
+            // verified migration. Persist it atomically before removing that proof.
+            if transfer.mode == .mount, transfer.direction == .migrate, transfer.baseline != nil,
+               let uuid = transfer.createdVolumeUUID,
+               let index = current.mounts.firstIndex(where: {
+                   $0.mountPointPath == transfer.originalPath && self.sameUUID($0.volumeUUID, uuid)
+               }) {
+                current.mounts[index].ownershipPolicy = .owners
+            }
             current.transfers.removeAll { $0.operationID == operationID }
         }
     }
@@ -359,7 +368,14 @@ final class ContainerMountStore: @unchecked Sendable {
         defer { _ = flock(writer, LOCK_UN); _ = close(writer) }
         var document = try load()
         try body(&document)
-        document.schemaVersion = 3
+        // Older schema-3 writers drop unknown transfer fields while preserving
+        // the opaque baseline. Protect ownership-aware records before any such
+        // writer can erase the exception required to interpret that baseline.
+        let needsOwnershipSchema = document.transfers.contains {
+            $0.legacyRootOwnership != nil || $0.legacyMountFlags != nil
+        } || document.mounts.contains { $0.ownershipPolicy != nil }
+            || document.cleanups.contains { $0.mountRecord.ownershipPolicy != nil }
+        document.schemaVersion = max(document.schemaVersion, needsOwnershipSchema ? 4 : 3)
         // Removing a mount also resolves its remount-only block; transfer recovery remains independent.
         let activeVolumes = Set(document.mounts.map { $0.volumeUUID.uppercased() })
         document.remountInterventions = document.remountInterventions.filter { activeVolumes.contains($0.key) }
@@ -443,7 +459,10 @@ final class ContainerMountStore: @unchecked Sendable {
             guard sameUUID(document.mounts[index].volumeUUID, mount.volumeUUID) else {
                 throw StoreError.conflict("A different volume already owns this mount point")
             }
-            document.mounts[index] = mount
+            var replacement = mount
+            // A stale caller must not erase the persisted ownership contract.
+            replacement.ownershipPolicy = document.mounts[index].ownershipPolicy ?? mount.ownershipPolicy
+            document.mounts[index] = replacement
         } else { document.mounts.append(mount) }
     }
     private func putLink(_ link: ManagedDataLinkRecord, into document: inout Document, replacingFor transfer: DataTransferRecord? = nil) throws {
```

**File**: `AppPorts/Utils/ContainerVolumeMigrator.swift` (modified, +24/-16)
```diff
@@ -341,7 +341,8 @@ actor ContainerVolumeMigrator {
             try TreeCopySession.verifyUnchanged(at: backup, against: baseline)
             let record = ContainerMountRecord(appName: appName, bundleIdentifier: bundleIdentifier,
                 dataDirType: item.type.rawValue, mountPointPath: source.path, volumeUUID: uuid,
-                volumeName: volumeName, externalRootPath: externalRootURL.standardizedFileURL.path)
+                volumeName: volumeName, externalRootPath: externalRootURL.standardizedFileURL.path,
+                ownershipPolicy: .owners)
             try store.commitMigration(record: record, transfer: transfer)
             synchronizeAgent(store)
             invalidateSizeCache(for: source)
@@ -364,23 +365,26 @@ actor ContainerVolumeMigrator {
         let mountPoint = record.mountPointURL
         try safety.requirePolicy(at: mountPoint)
         guard try store.recordsStrict().contains(record) else { throw DataOperationSafety.Failure.conflict(mountPoint.path) }
+        let related = try store.transfers().filter {
+            $0.mode == .mount && $0.direction == .migrate && $0.createdVolumeUUID == record.volumeUUID
+                && $0.originalPath == record.mountPointPath && [.awaitingUserVerification, .cleanupRequested].contains($0.phase)
+        }
+        let requiresOwnership = record.ownershipPolicy == .owners || related.contains { $0.baseline != nil }
         if isMountPoint(mountPoint) {
             try await requireExpectedVolume(record.volumeUUID, at: mountPoint)
             if try store.remountIntervention(forVolumeUUID: record.volumeUUID) != nil {
                 throw DataOperationSafety.Failure.conflict(mountPoint.path)
             }
+            if requiresOwnership { try requireOwners(at: mountPoint) }
             return
         }
-        let related = try store.transfers().filter {
-            $0.mode == .mount && $0.direction == .migrate && $0.createdVolumeUUID == record.volumeUUID
-                && $0.originalPath == record.mountPointPath && [.awaitingUserVerification, .cleanupRequested].contains($0.phase)
-        }
         try safety.requireNoOverlap(at: mountPoint, ownedMount: record,
                                     ownedTransferIDs: Set(related.map(\.operationID)))
         try safety.requireNoManagedFileSystemAncestor(at: mountPoint)
         let operationID = AppLogger.shared.makeOperationID(prefix: "container-mount")
         let hint = try await knownMountPoint(for: record, operationID: operationID)
-        try await mountVolume(record.volumeUUID, at: mountPoint, operationID: operationID, knownMountPoint: hint)
+        try await mountVolume(record.volumeUUID, at: mountPoint, operationID: operationID, knownMountPoint: hint,
+                              requireOwnership: requiresOwnership)
         try store.setRemountIntervention(volumeUUID: record.volumeUUID, reason: nil)
         invalidateSizeCache(for: mountPoint)
         AppLogger.shared.logContext(
@@ -548,7 +552,9 @@ actor ContainerVolumeMigrator {
                 guard lstat(mountPoint.path, &info) == 0, info.st_uid == geteuid(), info.st_gid == getegid() else {
                     throw TreeCopyError.unsupportedMetadata(mountPoint.path)
                 }
-                projectedOwner = .init(uid: info.st_uid, gid: info.st_gid)
+                if record.ownershipPolicy == nil, prior == nil {
+                    projectedOwner = .init(uid: info.st_uid, gid: info.st_gid)
+                }
             }
         }
         let id = resumable.first?.operationID ?? UUID()
@@ -596,10 +602,11 @@ actor ContainerVolumeMigrator {
                 source = recovery
             }
             try requireOwners(at: source)
-            // Offline legacy volumes have no prior verified manifest. A root-owned
-            // APFS volume root was an implementation artifact of the old creator.
-            // Only that root receives the current user's former effective ownership.
-            if !originallyOnline, prior == nil, transfer.legacyRootOwnership == nil {
+            // A legacy volume can already use owners after a normal remount.
+            // Without a prior verified manifest, the old creator's root-owned
+            // volume root needs the same destination projection online or offline.
+            // Descendants and the retained source keep their actual ownership.
+            if record.ownershipPolicy == nil, prior == nil, transfer.legacyRootOwnership == nil {
                 var info = stat()
                 guard lstat(source.path, &info) == 0 else { throw DataOperationSafety.Failure.inspection(source.path) }
                 if info.st_uid == 0 {
@@ -825,7 +832,8 @@ actor ContainerVolumeMigrator {
         at mountPoint: URL,
         operationID: String,
         knownMountPoint: KnownMountPoint = .unknown,
-        allowRelocation: Bool = true
+        allowRelocation: Bool = true,
+        requireOwnership: Bool = true
     ) async throws {
    
```

**File**: `AppPortsTests/ContainerVolumeMigratorTests.swift` (modified, +66/-6)
```diff
@@ -317,6 +317,66 @@ final class FakeDiskCommandRunner: ShellCommandRunning, @unchecked Sendable {
 
 @Suite("Container volume migration", .serialized)
 struct ContainerVolumeMigratorTests {
+    @Test("Legacy remount follows the volume setting; modern remount requires owners", arguments: [false, true])
+    func remountOwnershipPolicy(modern: Bool) async throws {
+        let workspace = try Workspace()
+        defer { workspace.cleanup() }
+        let runner = FakeDiskCommandRunner(onlineVolumes: ["OWNERSHIP-UUID"])
+        let source = try workspace.makeContainerDirectory(named: "Policy")
+        try FileManager.default.removeItem(at: source.appendingPathComponent("payload.txt"))
+        var record = workspace.record(mountPoint: source, volumeUUID: "OWNERSHIP-UUID")
+        record.ownershipPolicy = modern ? .owners : nil
+        try workspace.store.upsert(record)
+        let migrator = workspace.makeMigrator(runner: runner)
+        try await migrator.mount(record: record)
+        let options = modern ? ["-mountOptions", "owners"] : []
+        #expect(runner.commands(prefix: ["mount"]) == [["mount", "nobrowse", "-mountPoint", source.path] + options + [record.volumeUUID]])
+
+        let noowners = workspace.makeMigrator(runner: runner, mountFlags: { _ in UInt32(MNT_IGNORE_OWNERSHIP) })
+        if modern {
+            await #expect(throws: (any Error).self) { try await noowners.mount(record: record) }
+        } else {
+            try await noowners.mount(record: record)
+        }
+        #expect(runner.commands(prefix: ["-u"]).isEmpty)
+    }
+
+    @Test("Verified older migration keeps its owners policy after transfer cleanup and stale writes")
+    func ownershipSurvivesTransferCleanup() async throws {
+        let workspace = try Workspace()
+        defer { workspace.cleanup() }
+        let runner = FakeDiskCommandRunner()
+        let migrator = workspace.makeMigrator(runner: runner)
+        let source = try workspace.makeContainerDirectory(named: "Policy")
+        let result = try await migrator.migrate(item: workspace.item(for: source), externalRootURL: workspace.externalRootURL,
+            appName: "Chat", bundleIdentifier: "com.example.chat", progressHandler: nil)
+        #expect(result.record.ownershipPolicy == .owners)
+        let file = workspace.rootURL.appendingPathComponent("container-mounts.plist")
+        var document = try #require(try PropertyListSerialization.propertyList(from: Data(contentsOf: file), format: nil) as? [String: Any])
+        var mounts = try #require(document["mounts"] as? [[String: Any]])
+        mounts[0].removeValue(forKey: "ownershipPolicy")
+        document["mounts"] = mounts
+        document["schemaVersion"] = 3
+        let legacyBytes = try PropertyListSerialization.data(fromPropertyList: document, format: .binary, options: 0)
+        try legacyBytes.write(to: file)
+        let old = try #require(try workspace.store.recordsStrict().first)
+        #expect(old.ownershipPolicy == nil)
+        #expect(try Data(contentsOf: file) == legacyBytes)
+        let noowners = workspace.makeMigrator(runner: runner, mountFlags: { _ in UInt32(MNT_IGNORE_OWNERSHIP) })
+        await #expect(throws: (any Error).self) { try await noowners.mount(record: old) }
+        let transfer = try #require(try workspace.store.transfers().first)
+        try workspace.store.requestCleanup(operationID: transfer.operationID)
+        try workspace.store.finishTransfer(operationID: transfer.operationID, deletionConfirmed: true)
+        try workspace.store.upsert(old)
+        let reopened = ContainerMountStore(fileURL: file)
+        let current = try #require(try reopened.recordsStrict().first)
+        #expect(current.ownershipPolicy == .owners)
+        #expect(try reopened.transfers().isEmpty)
+        let saved = try #require(try PropertyListSerialization.propertyList(from: Data(contentsOf: file), format: nil) as? [String: Any])
+        #expect(saved["schemaVersion"] as? Int == 4)
+        await #expect(throws: (any Error).self) { try await noowners.mount(record: current) }
+    }
+
     @Test("Migration creates a volume, copies data, mounts it in place, and records it")
     func migrationHappyPath() async throws {
         let workspace = try Workspace()
@@ -1148,7 +1208,7 @@ struct ContainerVolumeMigratorTests {
         #expect(states["ONLINE-UUID"] == .mounted)
         #expect(states["OFFLINE-UUID"] == .unavailable)
         #expect(states["MOUNTED-UUID"] == .alreadyMounted)
-        #expect(runner.commands(prefix: ["mount"]) == [["mount", "nobrowse", "-mountPoint", online.path, "-mountOptions", "owners", "ONLINE-UUID"]])
+        #expect(runner.commands(prefix: ["mount"]) == [["mount", "nobrowse", "-mountPoint", online.path, "ONLINE-UUID"]])
         // 每个记录只查一次 diskutil（在线 + 挂载点合并）；离线的那个查一次就放弃。
         #expect(runner.commands(prefix: ["info"]).count == 2)
         #expect(runner.commands(prefix: ["info"]).allSatisfy { $0.last != "MOUNTED-UUID" })
@
```

**File**: `AppPortsTests/DataTransferStoreTests.swift` (modified, +46/-0)
```diff
@@ -4,6 +4,52 @@ import Testing
 @testable import AppPorts
 
 struct DataTransferStoreTests {
+    @Test("Ownership-aware records require schema 4 before an old writer can discard their meaning", arguments: [false, true])
+    func ownershipMetadataProtectsAgainstOlderWriters(online: Bool) throws {
+        let fixture = try Fixture()
+        defer { fixture.remove() }
+        let mount = fixture.mount("A")
+        try fixture.store.upsert(mount)
+        func document() throws -> [String: Any] {
+            try #require(try PropertyListSerialization.propertyList(from: Data(contentsOf: fixture.file), format: nil) as? [String: Any])
+        }
+        #expect(try document()["schemaVersion"] as? Int == 3)
+        var transfer = fixture.restore(mount)
+        try fixture.store.beginTransfer(transfer)
+        let before = try Data(contentsOf: fixture.file)
+        transfer.legacyRootOwnership = .init(uid: geteuid(), gid: getegid())
+        transfer.legacyMountFlags = online ? UInt32(MNT_IGNORE_OWNERSHIP) : nil
+        let rejecting = ContainerMountStore(fileURL: fixture.file, writeData: { _, _ in throw CocoaError(.fileWriteNoPermission) })
+        #expect(throws: (any Error).self) { try rejecting.updateTransfer(transfer) }
+        #expect(try Data(contentsOf: fixture.file) == before)
+        try fixture.store.updateTransfer(transfer)
+        #expect(try document()["schemaVersion"] as? Int == 4)
+        let protected = try Data(contentsOf: fixture.file)
+        #expect(throws: (any Error).self) { try PropertyListDecoder().decode(Schema3Reader.self, from: protected) }
+        #expect(try ContainerMountStore(fileURL: fixture.file).transfer(operationID: transfer.operationID) == transfer)
+        // The preceding build wrote these fields as schema 3. Read it without changing bytes,
+        // then promote atomically on the next mutation instead of dropping the optional fields.
+        var priorBuild = try document()
+        priorBuild["schemaVersion"] = 3
+        let oldBytes = try PropertyListSerialization.data(fromPropertyList: priorBuild, format: .binary, options: 0)
+        try oldBytes.write(to: fixture.file)
+        let reopened = ContainerMountStore(fileURL: fixture.file)
+        #expect(try reopened.transfer(operationID: transfer.operationID) == transfer)
+        #expect(try Data(contentsOf: fixture.file) == oldBytes)
+        try reopened.upsert(fixture.mount("Other", volume: "VOLUME-B"))
+        #expect(try document()["schemaVersion"] as? Int == 4)
+        #expect(try reopened.transfer(operationID: transfer.operationID) == transfer)
+    }
+
+    private struct Schema3Reader: Decodable {
+        enum Keys: String, CodingKey { case schemaVersion }
+        init(from decoder: Decoder) throws {
+            let values = try decoder.container(keyedBy: Keys.self)
+            let schema = try values.decode(Int.self, forKey: .schemaVersion)
+            guard schema == 2 || schema == 3 else { throw ContainerMountStore.StoreError.unsupportedSchema(schema) }
+        }
+    }
+
     @Test("A different volume cannot silently replace the same recorded source")
     func rejectsConflictingMountIdentity() throws {
         let fixture = try Fixture()
```

---

### Incident Patch 13: `7d3061c1` (2026-10-02)
**Commit Message**: test(scanner): require resolved identity for offline containers

**File**: `AppPortsTests/AppIdentityScannerTests.swift` (modified, +7/-2)
```diff
@@ -100,20 +100,25 @@ final class AppIdentityScannerTests: XCTestCase {
         XCTAssertTrue(result.contains { $0.path.standardizedFileURL.path == nativeData.standardizedFileURL.path })
     }
 
-    func testOfflineNameFallbackSurvivesAndResolvesAfterTargetReturns() async throws {
+    func testOfflineNameFallbackPreservesSupportButRequiresResolvedContainerIdentity() async throws {
         let f = try IdentityFixture()
         defer { f.cleanup() }
         let target = f.root.appendingPathComponent("External/wpsoffice.app")
         let portal = try f.stub("Apps/wpsoffice.app", id: "com.kingsoft.wpsoffice.mac", target: target)
         let data = try f.container("com.kingsoft.wpsoffice.mac")
+        let support = try f.directory("Home/Library/Application Support/wpsoffice")
         let scanner = f.scanner()
         let offline = await scanner.scanLibraryDirsWithDiagnostics(for: f.app(portal))
-        XCTAssertTrue(offline.items.contains { $0.path.standardizedFileURL.path == data.standardizedFileURL.path }, "Existing long-name fallback must survive")
+        XCTAssertTrue(offline.items.contains { $0.path.standardizedFileURL.path == support.standardizedFileURL.path },
+                      "Non-container name fallback remains available while the real app is offline")
+        XCTAssertFalse(offline.items.contains { $0.path.standardizedFileURL.path == data.standardizedFileURL.path },
+                       "An ordinary sandbox container requires a resolved application identity")
         XCTAssertEqual(offline.identityIssue?.reason, .realAppUnavailable)
         XCTAssertTrue(offline.readIssues.isEmpty, "Identity failure is not a directory permission error")
         _ = try f.native("External/wpsoffice.app", id: "com.kingsoft.wpsoffice.mac")
         let online = await scanner.scanLibraryDirsWithDiagnostics(for: f.app(portal))
         XCTAssertTrue(online.items.contains { $0.path.standardizedFileURL.path == data.standardizedFileURL.path })
+        XCTAssertTrue(online.items.contains { $0.path.standardizedFileURL.path == support.standardizedFileURL.path })
         XCTAssertNil(online.identityIssue)
     }
 
```

---

### Incident Patch 14: `a6ffc90d` (2026-10-02)
**Commit Message**: fix(data): restore legacy APFS volumes with verified ownership

**File**: `AppPorts/Localizable.xcstrings` (modified, +274/-0)
```diff
@@ -130140,6 +130140,280 @@
           }
         }
       }
+    },
+    "此卷仍在忽略文件所有权，无法验证权限；已停止操作并保留原件：%@" : {
+      "extractionState" : "manual",
+      "localizations" : {
+        "en" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "This volume still ignores file ownership, so permissions cannot be verified. The operation stopped and originals were preserved: %@"
+          }
+        },
+        "zh-Hant" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "此卷仍在忽略檔案擁有權，無法驗證權限；已停止操作並保留原件：%@"
+          }
+        },
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Dieses Volume ignoriert weiterhin Dateieigentümer. Berechtigungen können nicht geprüft werden. Der Vorgang wurde gestoppt, Originale bleiben erhalten: %@"
+          }
+        },
+        "es" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Este volumen sigue ignorando la propiedad de los archivos; no se pueden verificar los permisos. La operación se detuvo y los originales se conservaron: %@"
+          }
+        },
+        "fr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Ce volume ignore toujours la propriété des fichiers ; les autorisations ne peuvent pas être vérifiées. L’opération s’est arrêtée et les originaux sont conservés : %@"
+          }
+        },
+        "pt" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Este volume ainda ignora a propriedade dos arquivos; não é possível verificar as permissões. A operação foi interrompida e os originais foram preservados: %@"
+          }
+        },
+        "it" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Questo volume ignora ancora la proprietà dei file; non è possibile verificare i permessi. L’operazione è stata interrotta e gli originali sono conservati: %@"
+          }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "このボリュームはファイルの所有権を無視しているため、アクセス権を検証できません。操作を停止し、元のデータを保持しました：%@"
+          }
+        },
+        "ko" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "이 볼륨은 파일 소유권을 무시하고 있어 권한을 검증할 수 없습니다. 작업을 중단하고 원본을 보존했습니다: %@"
+          }
+        },
+        "ru" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Этот том по-прежнему игнорирует владельцев файлов, поэтому проверить права невозможно. Операция остановлена, оригиналы сохранены: %@"
+          }
+        },
+        "nl" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Dit volume negeert nog steeds bestandseigendom; rechten kunnen niet worden geverifieerd. De bewerking is gestopt en de originelen zijn bewaard: %@"
+          }
+        },
+        "pl" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Ten wolumin nadal ignoruje właścicieli plików, więc nie można zweryfikować uprawnień. Operacja została zatrzymana, a oryginały zachowane: %@"
+          }
+        },
+        "id" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Volume ini masih mengabaikan kepemilikan berkas, sehingga izin tidak dapat diverifikasi. Operasi dihentikan dan data asli dipertahankan: %@"
+          }
+        },
+        "tr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Bu birim hâlâ dosya sahipliğini yok sayıyor; izinler doğrulanamıyor. İşlem durduruldu ve asıllar korundu: %@"
+          }
+        },
+        "vi" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Ổ đĩa này vẫn bỏ qua quyền sở hữu tệp nên không thể xác minh quyền truy cập. Thao tác đã dừng và bản gốc được giữ lại: %@"
+          }
+        },
+        "eo" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Ĉi tiu volumo ankoraŭ ignoras dosierposedon, do permesoj ne povas esti kontrolitaj. La operacio haltis kaj la originaloj estas konservitaj: %@"
+          }
+        },
+        "hi" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "यह वॉल्यूम अब भी फ़ाइल स्वामित्व को अनदेखा करता है, इसलिए अनुमतियाँ सत्यापित नहीं की जा सकतीं। कार्रवाई रोक दी गई है और मूल डेटा सुरक्षित है: %@"
+          }
+        },
+        "ar" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "لا يزال هذا القسم يتجاهل ملكية الملفات، لذا يتعذر التحقق من الأذونات. أُوقفت العملية وحُفظت النسخ الأصلية: %@"
+          }
+        },
+        "th" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "โวลุ่มนี้ยังคงละเลยความเป็นเจ้าของไฟล์ จึงตรวจ
```

**File**: `AppPorts/Models/DataTransferErrorPresentation.swift` (modified, +3/-1)
```diff
@@ -5,8 +5,10 @@ extension TreeCopyError: LocalizedError {
         switch self {
         case .unsafeLayout(let path), .mountBoundary(let path), .hardlinkOutsideSelection(let path), .relativeLinkChangesTarget(let path):
             return String(format: "数据目录包含不支持的路径关系，已停止操作并保留原件：%@".localized, path)
-        case .unsupportedNode(let path), .unsupportedMetadata(let path), .ownershipDisabled(let path):
+        case .unsupportedNode(let path), .unsupportedMetadata(let path):
             return String(format: "无法完整保留此项目的内容或权限，已停止操作并保留原件：%@".localized, path)
+        case .ownershipDisabled(let path):
+            return String(format: "此卷仍在忽略文件所有权，无法验证权限；已停止操作并保留原件：%@".localized, path)
         case .sourceChanged(let path), .verificationFailed(let path):
             return String(format: "数据在操作期间发生变化或校验不一致，已保留副本，请检查后重试：%@".localized, path)
         case .destinationExists(let path):
```

**File**: `AppPorts/Models/DataTransferRecord.swift` (modified, +12/-0)
```diff
@@ -82,6 +82,10 @@ struct DataTransferRecord: Codable, Equatable, Identifiable, Sendable {
     let policyVersion: Int
     var phase: Phase
     var baseline: Data?
+    /// Preserve the effective legacy root owner without rewriting the retained source manifest.
+    var legacyRootOwnership: TreeCopySnapshot.Ownership? = nil
+    /// Original online flags, recorded before ownership is enabled; absent for an offline restore.
+    var legacyMountFlags: UInt32? = nil
     var recoverableReason: String?
 
     init(operationID: UUID = UUID(), mode: Mode, direction: Direction, sourceID: String? = nil,
@@ -116,6 +120,14 @@ struct DataTransferRecord: Codable, Equatable, Identifiable, Sendable {
         self.recoverableReason = recoverableReason
     }
 
+    var isUnstartedMountRestore: Bool {
+        mode == .mount && direction == .restore && [.preparing, .needsRecovery].contains(phase)
+            && sourceIdentity.isVolumeOnly && destinationIdentity == nil && backupIdentity == nil
+            && baseline == nil && createdVolumeUUID == nil
+            && activePath == originalPath && destinationPath == originalPath
+            && backupPath != nil && stagingPath != nil
+    }
+
     var topologyEntries: [DataPathTopology.Entry] {
         let origin: DataPathTopology.Origin = [.awaitingUserVerification, .cleanupRequested].contains(phase) ? .retained : .transfer
         return [originalPath, activePath, destinationPath, backupPath, stagingPath].compactMap { $0 }.map {
```

**File**: `AppPorts/Services/ContainerMountStore.swift` (modified, +70/-1)
```diff
@@ -219,6 +219,32 @@ final class ContainerMountStore: @unchecked Sendable {
         }
     }
 
+    /// Resume only an unchanged intent for which no copying could have begun.
+    /// Caller additionally verifies expected path templates, absence and current volume.
+    func resumeUnstartedMountRestore(_ expected: DataTransferRecord, record: ContainerMountRecord) throws -> DataTransferRecord {
+        var resumed = expected
+        try mutate { current in
+            guard let index = current.transfers.firstIndex(where: { $0.operationID == expected.operationID }),
+                  current.transfers[index] == expected, expected.isUnstartedMountRestore,
+                  current.mounts.contains(record), expected.originalPath == record.mountPointPath,
+                  self.sameUUID(expected.sourceIdentity.volumeUUID, record.volumeUUID),
+                  expected.appName == record.appName, expected.bundleIdentifier == record.bundleIdentifier,
+                  expected.dataDirType == record.dataDirType else { throw StoreError.conflict("Restore intent changed or already started") }
+            if let priorID = expected.priorOperationID {
+                guard current.transfers.contains(where: {
+                    $0.operationID == priorID && $0.mode == .mount && $0.direction == .migrate
+                        && $0.originalPath == expected.originalPath
+                        && self.sameUUID($0.createdVolumeUUID, record.volumeUUID)
+                        && [.awaitingUserVerification, .cleanupRequested].contains($0.phase)
+                }) else { throw StoreError.conflict("Restore migration lineage changed") }
+            }
+            resumed.phase = .preparing
+            resumed.recoverableReason = nil
+            current.transfers[index] = resumed
+        }
+        return resumed
+    }
+
     /// A created volume UUID can be filled once immediately after creation, never replaced.
     func updateTransfer(_ transfer: DataTransferRecord) throws {
         try mutate { current in try self.replaceTransfer(transfer, in: &current) }
@@ -452,7 +478,11 @@ final class ContainerMountStore: @unchecked Sendable {
               old.createdVolumeUUID == nil || sameUUID(old.createdVolumeUUID, transfer.createdVolumeUUID),
               old.destinationIdentity == nil || old.destinationIdentity == transfer.destinationIdentity,
               old.backupIdentity == nil || old.backupIdentity == transfer.backupIdentity,
-              old.baseline == nil || old.baseline == transfer.baseline else {
+              old.baseline == nil || old.baseline == transfer.baseline,
+              old.legacyRootOwnership == transfer.legacyRootOwnership
+                || (old.isUnstartedMountRestore && transfer.isUnstartedMountRestore && old.legacyRootOwnership == nil),
+              old.legacyMountFlags == transfer.legacyMountFlags
+                || (old.isUnstartedMountRestore && transfer.isUnstartedMountRestore && old.legacyMountFlags == nil) else {
             throw StoreError.conflict("Transfer identity or verified baseline changed")
         }
         guard permits(old.phase, transfer.phase) else { throw StoreError.invalidState("Invalid transfer phase transition") }
@@ -488,6 +518,44 @@ final class ContainerMountStore: @unchecked Sendable {
     }
     private func validPath(_ path: String) -> Bool { path.hasPrefix("/") && URL(fileURLWithPath: path).standardizedFileURL.path != "/" && !path.contains("\0") }
 
+    /// Ordinary records need only the exception marker, not a second in-memory copy of every entry.
+    private struct LegacyOwnershipMarker: Decodable {
+        let restoredRootOwnership: TreeCopySnapshot.Ownership?
+    }
+
+    /// The destination-only ownership exception must never leak into source or cleanup metadata.
+    private func validateLegacyOwnership(_ transfer: DataTransferRecord) throws {
+        let marker = transfer.baseline.flatMap { try? PropertyListDecoder().decode(LegacyOwnershipMarker.self, from: $0) }
+        // An intent has no manifest yet; once copying succeeds, both records must agree.
+        if transfer.baseline != nil, marker?.restoredRootOwnership != transfer.legacyRootOwnership {
+            throw StoreError.invalidState("Legacy restored-root ownership does not match the verified baseline")
+        }
+        guard transfer.legacyRootOwnership != nil || transfer.legacyMountFlags != nil else { return }
+        try validateLegacyOwnershipIntent(transfer)
+        if let encoded = transfer.baseline {
+            guard let snapshot = try? PropertyListDecoder().decode(TreeCopySnapshot.self, from: encoded),
+                  let root = snapshot.entries.first, root.path.isEmpty, root.kind == .directory,
+                  snapshot.entries.filter({ $0.path.isEmpty }).count == 1,
+                  let owner = transfer.legacyRootOwnership,
+                  root.uid == 0 || root.uid == owner.uid,
+                  root.identity.inode == transfer.sourceIdenti
```

**File**: `AppPorts/Utils/ContainerVolumeMigrator.swift` (modified, +108/-9)
```diff
@@ -41,6 +41,7 @@ actor ContainerVolumeMigrator {
         /// 还原时本地副本已复制好，但没能换到原路径。外置卷和记录保持不变。
         case restoreIncomplete(staging: URL, underlying: Error)
         case restoreRecordRecovery(staging: URL, underlying: Error)
+        case ownershipRollbackFailed(URL, operation: Error, rollback: Error)
 
         var errorDescription: String? {
             switch self {
@@ -94,6 +95,9 @@ actor ContainerVolumeMigrator {
                     format: "还原未完成，已复制的本地数据保留在「%@」，外置卷也已保留。请检查迁移记录和挂载状态后重试。%@".localized,
                     staging.path, error.localizedDescription
                 )
+            case .ownershipRollbackFailed(let url, let operation, let rollback):
+                return String(format: "还原失败，且无法恢复卷的原挂载选项；数据已保留，请检查挂载状态：%@\n%@\n%@".localized,
+                              url.path, operation.localizedDescription, rollback.localizedDescription)
             }
         }
     }
@@ -510,31 +514,76 @@ actor ContainerVolumeMigrator {
         let mountPoint = record.mountPointURL
         // Exact history ownership is required. A stale UI value cannot authorize recovery.
         guard try store.recordsStrict().contains(record) else { throw MigrationError.alreadyManaged(mountPoint) }
-        let prior = try store.transfers().first {
+        let transfers = try store.transfers()
+        let prior = transfers.first {
             $0.mode == .mount && $0.direction == .migrate && $0.originalPath == record.mountPointPath
                 && $0.createdVolumeUUID == record.volumeUUID && [.awaitingUserVerification, .cleanupRequested].contains($0.phase)
         }
-        let ownedIDs = Set(prior.map { [$0.operationID] } ?? [])
+        let resumable = transfers.filter {
+            $0.isUnstartedMountRestore && $0.originalPath == record.mountPointPath
+                && $0.sourceIdentity.volumeUUID?.caseInsensitiveCompare(record.volumeUUID) == .orderedSame
+                && $0.priorOperationID == prior?.operationID
+        }
+        guard resumable.count <= 1 else { throw DataOperationSafety.Failure.conflict(mountPoint.path) }
+        if let pending = resumable.first { try validateUnstartedRestorePaths(pending, record: record) }
+        var ownedIDs = Set(prior.map { [$0.operationID] } ?? [])
+        if let pending = resumable.first { ownedIDs.insert(pending.operationID) }
         try safety.requireNoOverlap(at: mountPoint, ownedMount: record, ownedTransferIDs: ownedIDs)
         try safety.requireLocalRestoreParent(at: mountPoint, isMountPoint: isMountPoint)
         if estimatedTotalBytes > 0, let available = availableCapacity(mountPoint.deletingLastPathComponent()) {
             let required = Self.requiredFreeBytes(forDataBytes: estimatedTotalBytes)
             guard available >= required else { throw MigrationError.insufficientSpace(required: required, available: available) }
         }
-        let id = UUID()
+        // Online inspection is read-only and must finish before creating an intent.
+        let originallyOnline = isMountPoint(mountPoint)
+        var originalFlags: UInt32?
+        var projectedOwner: TreeCopySnapshot.Ownership?
+        if originallyOnline {
+            try await requireExpectedVolume(record.volumeUUID, at: mountPoint)
+            try await safety.requireNoKnownWriters(at: mountPoint, bundleIdentifier: record.bundleIdentifier)
+            guard let flags = mountFlags(mountPoint) else { throw DataOperationSafety.Failure.inspection(mountPoint.path) }
+            originalFlags = flags
+            if flags & UInt32(MNT_IGNORE_OWNERSHIP) != 0 {
+                var info = stat()
+                guard lstat(mountPoint.path, &info) == 0, info.st_uid == geteuid(), info.st_gid == getegid() else {
+                    throw TreeCopyError.unsupportedMetadata(mountPoint.path)
+                }
+                projectedOwner = .init(uid: info.st_uid, gid: info.st_gid)
+            }
+        }
+        let id = resumable.first?.operationID ?? UUID()
         let staging = mountPoint.deletingLastPathComponent().appendingPathComponent(".appports-restore-staging-\(id.uuidString)")
         let recovery = stagingMountRootURL.appendingPathComponent("recovery-\(id.uuidString)")
         var transfer = DataTransferRecord(operationID: id, mode: .mount, direction: .restore,
             sourceID: prior?.sourceID, appName: record.appName, bundleIdentifier: record.bundleIdentifier,
             dataDirType: record.dataDirType, originalPath: mountPoint.path, activePath: mountPoint.path,
             destinationPath: mountPoint.path, backupPath: recovery.path, stagingPath: staging.path,
             sourceIdentity: DataPathIdentity(volumeUUID: record.volumeUUID), priorOperationID: prior?.operationID)
-        try store.beginTransfer(transfer)
+        if let pending = resumable.first {
+            transfer = try store.resumeUnstartedMountRestore(pending, record: record)
+        } else {
+            try store.beginTransfer(transfer)
+        }
+        if let
```

**File**: `AppPorts/Utils/DiskUtility.swift` (modified, +12/-0)
```diff
@@ -295,6 +295,18 @@ struct DiskUtility: Sendable {
         _ = try await run(["mount", "nobrowse", "-mountPoint", mountPoint.path] + options + [volume])
     }
 
+    /// Explicit restore only. Keep Finder/safety flags while enabling real ownership.
+    func setOwnershipForRestore(mountPoint: URL, originalFlags: UInt32, enabled: Bool) async throws {
+        let flags = enabled ? originalFlags & ~UInt32(MNT_IGNORE_OWNERSHIP) : originalFlags
+        var options = Self.updateOptions(addingNobrowseTo: flags)
+        if enabled { options += ",owners" }
+        let result = try await runner.run(executable: Self.mountPath,
+            arguments: ["-u", "-o", options, mountPoint.path], timeout: commandTimeout)
+        guard result.status == 0, !result.timedOut else {
+            throw Failure.commandFailed(command: "mount ownership update", output: result.combinedText)
+        }
+    }
+
     /// 给早期版本挂上、没带 `nobrowse` 的卷补上这个选项，不用卸载。
     ///
     /// `mount -u` 会按给出的选项重设标志，只写 `nobrowse` 会把 `noowners` 等冲掉
```

**File**: `AppPorts/Utils/TreeCopySession.swift` (modified, +28/-8)
```diff
@@ -8,12 +8,19 @@ import Foundation
 /// identities for checking a retained original. The caller must retain that
 /// original: no userspace copy can rule out a write after this method returns.
 actor TreeCopySession {
+    // macOS owns this provenance tag. It may inject it into a new local root,
+    // and xattr removal can return success without removing it. Do not copy or
+    // erase the OS tag; retain it in manifests for diagnostics, but exclude it
+    // from portable metadata equality (including manifests from older builds).
+    nonisolated private static let systemProvenanceAttribute = "com.apple.provenance"
+
     func copy(
         from source: URL,
         to destination: URL,
         excludingRootEntries: Set<String> = [],
         finalDestination: URL? = nil,
         logicalSourceRoot: URL? = nil,
+        legacyRootOwnership: TreeCopySnapshot.Ownership? = nil,
         progressHandler: FileCopier.ProgressHandler? = nil
     ) async throws -> TreeCopySnapshot {
         try Task.checkCancellation()
@@ -23,8 +30,15 @@ actor TreeCopySession {
         guard !Self.contains(source.path, destination.path), !Self.contains(destination.path, source.path) else {
             throw TreeCopyError.unsafeLayout(destination.path)
         }
-        let baseline = try Self.snapshot(at: source, excludingRootEntries: excludingRootEntries,
+        var baseline = try Self.snapshot(at: source, excludingRootEntries: excludingRootEntries,
                                          finalDestination: finalDestination, logicalSourceRoot: logicalSourceRoot)
+        if let legacyRootOwnership {
+            guard legacyRootOwnership.uid == geteuid(), legacyRootOwnership.gid == getegid(),
+                  let root = baseline.entries.first, root.path.isEmpty, root.kind == .directory,
+                  root.uid == 0 || root.uid == legacyRootOwnership.uid,
+                  DiskUtility.isMountPoint(source) else { throw TreeCopyError.unsupportedMetadata(source.path) }
+            baseline.restoredRootOwnership = legacyRootOwnership
+        }
         try Self.requireOwnership(at: destination.deletingLastPathComponent())
         let context = CopyContext(snapshot: baseline, source: source, destination: destination, progress: progressHandler)
         await progressHandler?(FileCopier.Progress(copiedBytes: 0, totalBytes: baseline.logicalBytes, currentFile: source.lastPathComponent))
@@ -58,7 +72,7 @@ actor TreeCopySession {
     /// Checks semantic equality, including hardlink relationships, without
     /// comparing source and destination device/inode numbers.
     nonisolated static func verifyCopy(at root: URL, against snapshot: TreeCopySnapshot) throws {
-        try compare(scan(canonicalRoot(root), exclusions: snapshot.excludedRootEntries), snapshot, identities: false)
+        try compare(scan(canonicalRoot(root), exclusions: snapshot.excludedRootEntries), snapshot, identities: false, destinationOwnership: true)
     }
 
     /// Checks a retained original even after its root has been renamed. ctime
@@ -204,7 +218,7 @@ actor TreeCopySession {
 
         init(snapshot: TreeCopySnapshot, source: URL, destination: URL, progress: FileCopier.ProgressHandler?) {
             self.snapshot = snapshot
-            entries = Dictionary(uniqueKeysWithValues: snapshot.entries.map { ($0.path, $0) })
+            entries = Dictionary(uniqueKeysWithValues: snapshot.entries.map { ($0.path, snapshot.destinationEntry($0)) })
             children = Dictionary(grouping: snapshot.entries.filter { !$0.path.isEmpty }.map(\.path)) {
                 ($0 as NSString).deletingLastPathComponent
             }
@@ -350,10 +364,10 @@ actor TreeCopySession {
         try setACL(nil, fd: fd, path: entry.path)
         guard fchown(fd, entry.uid, entry.gid) == 0 else { throw posix(entry.path) }
         let current = try extendedAttributes(fd: fd, path: entry.path)
-        for name in current.keys where entry.extendedAttributes[name] == nil {
+        for name in current.keys where name != systemProvenanceAttribute && entry.extendedAttributes[name] == nil {
             guard fremovexattr(fd, name, 0) == 0 else { throw posix(entry.path) }
         }
-        for (name, data) in entry.extendedAttributes {
+        for (name, data) in entry.extendedAttributes where name != systemProvenanceAttribute {
             guard data.withUnsafeBytes({ fsetxattr(fd, name, $0.baseAddress, $0.count, 0, 0) }) == 0 else { throw posix(entry.path) }
         }
         guard fchmod(fd, entry.mode) == 0 else { throw posix(entry.path) }
@@ -539,21 +553,27 @@ actor TreeCopySession {
         return (fd, components.last!)
     }
 
-    nonisolated private static func compare(_ actual: TreeCopySnapshot, _ expected: TreeCopySnapshot, identities: Bool) throws {
+    nonisolated private static func compare(_ actual: TreeCopySnapshot, _ expected: TreeCopySnapshot, identities: Bool, destinationOwnership: Bool = false) throws {
         guard actual.entries.m
```

**File**: `AppPorts/Utils/TreeCopySnapshot.swift` (modified, +18/-0)
```diff
@@ -3,6 +3,11 @@ import Foundation
 /// A content and metadata manifest. Paths are relative to the selected root.
 /// Source identities support checking a retained original after a rename.
 struct TreeCopySnapshot: Codable, Equatable, Sendable {
+    struct Ownership: Codable, Equatable, Sendable {
+        let uid: UInt32
+        let gid: UInt32
+    }
+
     struct Identity: Codable, Equatable, Hashable, Sendable {
         let device: Int32
         let inode: UInt64
@@ -32,6 +37,19 @@ struct TreeCopySnapshot: Codable, Equatable, Sendable {
         let hardlinkGroup: String?
     }
 
+    /// Only legacy mount restores may preserve the formerly projected root owner.
+    /// entries always retain the actual source ownership for unchanged/cleanup checks.
+    var restoredRootOwnership: Ownership? = nil
+
+    func destinationEntry(_ entry: Entry) -> Entry {
+        guard entry.path.isEmpty, let owner = restoredRootOwnership else { return entry }
+        return Entry(path: entry.path, kind: entry.kind, identity: entry.identity, mode: entry.mode,
+                     uid: owner.uid, gid: owner.gid, flags: entry.flags, birthTime: entry.birthTime,
+                     modificationTime: entry.modificationTime, extendedAttributes: entry.extendedAttributes,
+                     acl: entry.acl, size: entry.size, digest: entry.digest, linkTarget: entry.linkTarget,
+                     hardlinkGroup: entry.hardlinkGroup)
+    }
+
     let entries: [Entry]
     let excludedRootEntries: Set<String>
     var logicalBytes: Int64 { entries.filter { $0.kind == .file }.reduce(0) { $0 + $1.size } }
```

---

### Incident Patch 15: `4e1d484d` (2026-10-02)
**Commit Message**: fix: default directory details to compact height

**File**: `AppPorts/Views/Components/AppDataDirectoryBrowser.swift` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ struct AppDataDirectoryBrowser<Actions: View>: View {
     @State private var selectedItemID: String?
     @State private var collapsedDirectoryIDs: Set<String> = []
     @State private var collapsedGroups: Set<DataDirType> = []
-    @State private var informationPanelHeight: CGFloat = 160
+    @State private var informationPanelHeight: CGFloat = DirectoryPanelLayout.minimumInformationHeight
     @State private var informationResizeStartHeight: CGFloat?
     @State private var isInformationHandleHovered = false
     @FocusState private var isOutlineFocused: Bool
```

#### Recent Merged Pull Requests:
- **PR #58** (2026-08-27): docs: fix broken star history chart in README (@Dessalines39394)
- **PR #55** (2026-07-02): feat: 体积会话缓存 + 弹窗本地化修复（中文→本地化、补全俄语）+ 受保护应用迁移预警 (@niazlv)
- **PR #54** (2026-07-01): Add custom directory migration and safer rollback (@admintertar)
- **PR #39** (closed): Update bug report instructions for diagnostic logs (@wzh4869)
- **PR #38** (closed): Install Vercel Web Analytics with latest docs (@vercel[bot])
- **PR #37** (2026-05-09): Develop (@wzh4869)
- **PR #34** (2026-04-29): Develop (@wzh4869)
- **PR #26** (2026-03-15): 测试 (@wzh4869)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
