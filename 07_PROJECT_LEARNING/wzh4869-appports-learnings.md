# Forensic Learning Record (Deep Inspection): wzh4869/AppPorts

> **Canonical Artifact**: `07_PROJECT_LEARNING/wzh4869-appports-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wzh4869/AppPorts](https://github.com/wzh4869/AppPorts))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:48:16.741Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wzh4869/AppPorts`
- **Description**: 📦 A macOS utility to seamlessly migrate applications to external storage and reclaim local disk space.【一款 macOS 工具，无缝迁移应用到外部存储并自动建立链接，释放宝贵的本地空间】
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2103 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

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
                        )
   
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
            case .mounted, .alreadyMounted: return false
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
/// - **迁移**：建卷 → 临时挂载并复制 → 卸载 → 原目录改名为安全备份 → 在原路径挂载 → 写记录 → 清理备份
/// - **还原**：确保已挂载 → 复制到暂存目录 → 卸载 → 暂存目录改回原路径 → 删卷 → 删记录
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
        case unmountFailed(URL, String)
        case volumeUnavailable(String)
        case insufficientSpace(required: Int64, available: Int64)
        case copyFailed(Error)
        case switchFailed(Error)
        case rollbackIncomplete(backup: URL, volumeName: String, volumeUUID: String, underlying: Error)
        /// 还原时本地副本已复制好，但没能换到原路径。外置卷和记录保持不变。
        case restoreIncomplete(staging: URL, underlying: Error)
        case restoreRecordRecovery(staging: URL, underlying: Error)

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
    private let removeMigrationBackup: @Sendable (URL) throws -> Void

    init(
        disk: DiskUtility = DiskUtility(),
        store: ContainerMountStore = .shared,
        stagingMountRootURL: URL? = nil,
        isMountPoint: @escaping @Sendable (URL) -> Bool = { DiskUtility.isMountPoint($0) },
        mountedVolumePath: @escaping @Sendable (URL) -> String? = { DiskUtility.mountedVolumePath(containing: $0) },
        mountedVolumeUUID: @escaping @Sendable (URL) -> String? = { DiskUtility.mountedVolumeUUID(at: $0) },
        volumeUUIDMarker: @escaping @Sendable (URL) -> String? = { ContainerVolumeMigrator.readVolumeMarkerUUID(at: $0) },
        synchronizeAgent: @escaping @Sendable (ContainerMountStore) -> Void = { ContainerMountAgentInstaller.installIfNeeded(store: $0) },
        availableCapacity: @escaping @Sendable (URL) -> Int64? = { DiskUtility.availableCapacity(at: $0) },
        mountFlags: @escaping @Sendable (URL) -> UInt32? = { DiskUtility.mountFlags(at: $0) },
        removeMigrationBackup: @escaping @Sendable (URL) throws -> Void = { try FileCopier.removeCopy(at: $0) }
    ) {
        self.disk = disk
        self.store = store
        self.isMountPoint = isMountPoint
        self.mountedVolumePath = mountedVolumePath
        self.mountedVolumeUUID = mountedVolumeUUID
        self.volumeUUIDMarker = volumeUUIDMarker
        self.synchronizeAgent = synchronizeAgent
        self.availableCapacity = availableCapacity
        self.mountFlags = mountFlags
        self.re
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
//
//  DataDirMover.swift
//  AppPorts
//
//  Created by shimoko.com on 2026/3/4.
//

import Foundation

// MARK: - 数据目录迁移器

/// 负责数据目录的迁移、还原和链接操作
///
/// 使用 Actor 模型确保所有文件操作线程安全。
/// 与应用本体迁移不同，数据目录使用**整体符号链接**策略：
/// 原路径整体变为符号链接，指向外部存储中的目录。
///
/// ## 操作流程
/// - **迁移**：复制 → 将原目录改名为安全备份 → 创建符号链接 → 清理备份
/// - **还原**：复制回来 → 删除外部目录 → 删除符号链接
/// - **仅链接**：直接在原路径创建符号链接（适用于已手动迁移的情况）
actor DataDirMover {

    private let fileManager = FileManager.default
    private let homeDir: URL
    private let failSymlinkCreation: Bool
    private let failSourceBackupCleanup: Bool
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

    init(
        homeDir: URL = URL(fileURLWithPath: NSHomeDirectory()),
        failSymlinkCreation: Bool = false,
        failSourceBackupCleanup: Bool = false
    ) {
        self.homeDir = homeDir.standardizedFileURL
        self.failSymlinkCreation = failSymlinkCreation
        self.failSourceBackupCleanup = failSourceBackupCleanup
    }

    // MARK: - 迁移

    /// 将数据目录迁移到外部存储
    ///
    /// 执行步骤：
    /// 1. 权限检查（确认能写入目标路径的父目录）
    /// 2. 检测目标冲突
    /// 3. 使用 FileCopier 复制（带进度回调）
    /// 4. 将原目录改名为本地安全备份
    /// 5. 在原路径创建指向外部的符号链接
    /// 6. 清理本地安全备份
    ///
    /// - Parameters:
    ///   - item: 要迁移的数据目录项
    ///   - externalBaseURL: 外部存储的根目录（在其下创建同名子目录）
    ///   - progressHandler: 进度回调
    ///
    /// - Throws: 文件系统错误、权限错误
    func migrate(
        item: DataDirItem,
        to externalBaseURL: URL,
        progressHandler: FileCopier.ProgressHandler?
    ) async throws {
        let sourcePath = item.path
        let destPath = externalBaseURL.appendingPathComponent(sourcePath.lastPathComponent)
        let operationID = AppLogger.shared.makeOperationID(prefix: "data-migrate")
        let startedAt = Date()
        var operationResult = "failed"
        var operationErrorCode: String?

        defer {
            AppLogger.shared.logOperationSummary(
                category: "data_migrate",
                operationID: operationID,
                result: operationResult,
                startedAt: startedAt,
                errorCode: operationErrorCode,
                details: [
                    ("item_name", item.name),
                    ("type", item.type.rawValue),
                    ("source_path", sourcePath.path),
                    ("destination_path", destPath.path)
                ]
            )
        }

        AppLogger.shared.log("===== 开始迁移数据目录 =====")
        AppLogger.shared.logContext(
            "数据目录迁移上下文",
            details: [
                ("operation_id", operationID),
                ("item_name", item.name),
                ("type", item.type.rawValue),
                ("priority", item.priority.rawValue),
                ("status", item.status),
                ("source_path", sourcePath.path),
                ("destination_path", destPath.path)
            ]
        )
        AppLogger.shared.logPathState("数据目录迁移前-本地源[\(operationID)]", url: sourcePath)
        AppLogger.shared.logPathState("数据目录迁移前-外部目标[\(operationID)]", url: destPath)

        // 检查是否为 macOS 受保护路径（如 ~/Library/Containers/）
        // 这些目录不允许第三方应用创建新条目，迁移会导致数据丢失
        if isProtectedContainersPath(sourcePath) || isProtectedGroupContainerRootPath(sourcePath) {
            AppLogger.shared.logError(
                "无法迁移受 macOS 保护的顶层容器目录",
                errorCode: "DATA-MIGRATE-PROTECTED-PATH",
                context: [("path", sourcePath.path), ("item_name", item.name)],
                relatedURLs: [("source", sourcePath)]
            )
            operationErrorCode = "DATA-MIGRATE-PROTECTED-PATH"
            throw DataDirError.protectedPath(sourcePath)
        }

        // 1. 确保目标父目录可写
        do {
            try checkWritePermission(at: externalBaseURL)
        } catch {
            operationErrorCode = "DATA-MIGRATE-PERMISSION-DENIED"
            throw error
        }

        // 2. 冲突检测
        if fileManager.fileExists(atPath: destPath.path) {
            if isSymbolicLink(at: destPath) {
                // 已有符号链接 → 删除后继续
                try fileManager.removeItem(at: destPath)
                AppLogger.shared.log("已删除目标位置旧符号链接")
            } else if isSymbolicLink(at: sourcePath) {
                // 源已是符号链接，说明之前已迁移成功，属于状态不一致
                operationErrorCode = "DATA-MIGRATE-ALREADY-MIGRATED"
                throw DataDirError.destinationExists(destPath)
            } else {
                // 管理标记只能证明副本归属。上次失败后本地数据可能已更新，
                // 不能仅凭标记复用旧副本并删除当前源；保留两端供用户处理冲突。
                AppLogger.shared.logError(
                    "源和目标均存在真实目录，保留两端并拒绝自动覆盖",
                    errorCode: "DATA-MIGRATE-DESTINATION-CONFLICT",
                    context: [("operation_id", operationID), ("destination_path", destPath.path)],
                    relatedURLs: [("source", sourcePath), ("destination", destPath)]
                )
                operationErrorCode = "DATA-MIGRATE-DESTINATION-CONFLICT"
                throw DataDirError.destinationExists(destPath)
            }
        }

        // 3. 复制到外部存储（带进度）
        AppLogger.shared.log("步骤1: 开始复制数据目录...")
        let copier = FileCopier()
        let totalBytes: Int64
        do {
            totalBytes = try await copier.copyDirectory(
                from: sourcePath,
                to: destPath,
                estimatedTotalBytes: item.sizeBytes,
                progressHandler: progressHandler
            )
            AppLogger.shared.log("步骤1: 复制完成")
            AppLogger.shared.logPathState("数据目录步骤1后-外部副本[\(operationID)]", url: destPath)
        } catch {
            AppLogger.shared.logError(
                "步骤1: 复制失败，清理外部半成品目录",
                error: error,
                errorCode: "DATA-MIGRATE-COPY-FAILED",
                context: [("operation_id", operationID)],
                relatedURLs: [("source", sourcePath), ("destination_root", externalBaseURL), ("destination", destPath)]
            )
            cleanupFailedMigrationDestination(at: destPath, within: externalBaseURL, operationID: operationID)
            operationErrorCode = "DATA-MIGRATE-COPY-FAILED"
            throw DataDirError.copyFailed(error)
        }

        // 3.5 写入 AppPorts 管理标记，用于后续精准识别受管链接
        await progressHandler?(FileCopier.Progress(copiedBytes: totalBytes, totalBytes: totalBytes, currentFile: "正在写入管理标记...".localized))
        do {
            try writeManagedLinkMetadata(sourcePath: sourcePath, destinationPath: destPath, type: item.type)
            AppLogger.shared.log("步骤1.5: 已写入 AppPorts 链接标记")
        } catch {
            AppLogger.shared.logError(
                "步骤1.5: 写入 AppPorts 链接标记失败，执行回滚",
                error: error,
                errorCode: "DATA-MIGRATE-METADATA-WRITE-FAILED",
                context: [("operation_id", operationID)],
                relatedURLs: [("source", sourcePath), ("destination", destPath)]
            )
            cleanupFailedMigrationDestination(at: destPath, within: externalBaseURL, operationID: operationID)
            operationErrorCode = "DATA-MIGRATE-METADATA-WRITE-FAILED"
            throw DataDirError.metadataWriteFailed(error)
        }

        // 4. 将原目录改名为同卷安全备份，避免递归删除失败造成源和目标双丢失
        AppLogger.shared.log("步骤2: 将原目录移动到本地安全备份...")
        await progressHandler?(FileCopier.Progress(copiedBytes: totalBytes, totalBytes: totalBytes, currentFile: "正在切换本地入口...".localized))
        let sourceBackupPath: URL
        do {
            sourceBackupPath = try moveSourceToMigrationBackup(sourcePath, operationID: operationID)
            AppLogger.shared.log("步骤2: 原目录已移动到本地安全备份")
            AppLogger.shared.logPathState("数据目录步骤2后-本地源[\(operationID)]", url: sourcePath)
            AppLogger.shared.logPathState("数据目录步骤2后-本地安全备份[\(operationID)]", url: sourceBackupPath)
        } catch {
            AppLogger.shared.logError(
                "步骤2: 移动原目录到本地安全备份失败，保留外部副本",
                error: error,
                errorCode: "DATA-MIGRATE-SOURCE-BACKUP-MOVE-FAILED",
                context: [("operation_id", operationID)],
                relatedURLs: [("source", sourcePath), ("destination", destPath)]
            )
            operationErrorCode = "DATA-MIGRATE-SOURCE-BACKUP-MOVE-FAILED"
            throw DataDirError.deletionFailed(error)
        }

        // 5. 在原路径创建符号链接
        AppLogger.shared.log("步骤3: 创建符号链接...")
        await progressHandler?(FileCopier.Progress(copiedBytes: totalBytes, totalBytes: totalBytes, currentFile: "正在创建符号链接...".localized))
        do {
            try createSymbolicLink(at: sourcePath, withDestinationURL: destPath)
            AppLogger.shared.log("步骤3: 符号链接创建成功: \(sourcePath.path) → \(destPath.path)")
            AppLogger.shared.logPathState("数据目录步骤3后-本地入口[\(operationID)]", url: sourcePath)
        } catch {
            AppLogger.shared.logError(
                "步骤3: 符号链接创建失败，恢复本地安全备份，保留外部副本",
                error: error,
                errorCode: "DATA-MIGRATE-SYMLINK-FAILED",
                context: [("operation_id", operationID)],
                relatedURLs: [("source", sourcePath), ("destination", destPath), ("backup", sourceBackupPath)]
            )
            restoreMigrationBackup(sourceBackupPath, to: sourcePath, operationID: operationID)
            try? removeManagedLinkMetadata(in: sourcePath)
            operationErrorCode = "DATA-MIGRATE-SYMLINK-FAILED"
            throw DataDirError.symlinkFailed(error)
        }

        do {
            try cleanupMigrationBackup(sourceBackupPath, operationID: operationID)
        } catch {
            AppLogger.shared.logError(
            
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
            description: "PyTorch 预训练模型权重缓存"
        ),
        KnownDotFolder(
            name: "Whisper 
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
        try await withCheckedThrowingContinuation { continuation in
            let process = Process()
            process.executableURL = URL(fileURLWithPath: executable)
            process.arguments = arguments
            process.standardInput = FileHandle.nullDevice
            let outputPipe = Pipe()
            let errorPipe = Pipe()
            process.standardOutput = outputPipe
            process.standardError = errorPipe

            let collector = OutputCollector()
            let readers = DispatchGroup()
            readers.enter()
            DispatchQueue.global(qos: .utility).async {
                collector.setStandardOutput(outputPipe.fileHandleForReading.readDataToEndOfFile())
                readers.leave()
            }
            readers.enter()
            DispatchQueue.global(qos: .utility).async {
                collector.setStandardError(errorPipe.fileHandleForReading.readDataToEndOfFile())
                readers.leave()
            }

            process.terminationHandler = { finished in
                // 等两个管道读完再返回结果，但不阻塞系统的高优先级退出回调线程。
                let status = finished.terminationStatus
                readers.notify(queue: .global(qos: .utility)) {
                    continuation.resume(returning: collector.result(status: status))
                }
            }

            do {
                try process.run()
            } catch {
                process.terminationHandler = nil
                // 释放写端，让两个读取任务立即结束。
                try? outputPipe.fileHandleForWriting.close()
                try? errorPipe.fileHandleForWriting.close()
                continuation.resume(throwing: error)
                return
            }

            DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + timeout) {
                guard process.isRunning else { return }
                collector.markTimedOut()
                process.terminate()
            }
        }
    }

    private final class OutputCollector: @unchecked Sendable {
        private let lock = NSLock()
        private var standardOutput = Data()
        private var standardError = Data()
        private var timedOut = false

        func setStandardOutput(_ data: Data) {
            lock.lock(); defer { lock.unlock() }
            standardOutput = data
        }

        func setStandardError(_ data: Data) {
            lock.lock(); defer { lock.unlock() }
            standardError = data
        }

        func markTimedOut() {
            lock.lock(); defer { lock.unlock() }
            timedOut = true
        }

        func result(status: Int32) -> ShellCommandResult {
            lock.lock(); defer { lock.unlock() }
            return ShellCommandResult(status: status, standardOutput: standardOutput, standardError: standardError, timedOut: timedOut)
        }
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
            || output.localizedCaseInsensitiveContains("Not privileged")
    }

    // MARK: 查询

    /// `target` 可以是挂载路径、设备标识（disk5s2）或 Volume UUID。
    func volumeInfo(for target: String) async throws -> VolumeInfo {
        let plist = try await runPlist(["info", "-plist", target])
        guard let deviceIdentifier = plist["DeviceIdentifier"] as? String else {
            throw Failure.unexpectedOutput(command: "diskutil info", output: target)
        }
        return VolumeInfo(
            deviceIdentifier: deviceIdentifier,
            volumeUUID: plist["VolumeUUID"] as? String,
            volumeName: plist["VolumeName"] as? String,
            filesystemType: plist["FilesystemType"] as? String,
            apfsContainerReference: plist["APFSContainerReference"] as? String,
            mountPoint: plist["MountPoint"] as? String,
            isEncrypted: (plist["Encrypted"] as? Bool == true) || (plist["FileVault"] as? Bool == true)
        )
    }

    // MARK: 卷操作

    /// 在已有 APFS 容器中新建一个卷；返回新卷的设备标识（如 disk5s7）。
    /// 新卷先保持未挂载，避免 Finder 突然出现一个内部数据盘。
    func createAPFSVolume(inContainer container: String, name: String) async throws -> String {
        let result = try await run(["apfs", "addVolume", container, "APFS", name, "-nomount"])
        if let device = Self.firstMatch(pattern: #"Created new APFS Volume (disk\d+s\d+)"#, in: result.stdoutText) {
            return device
        }
        // 输出格式变化时，回退为按名称在容器中查找。
        if let device = try await findAPFSVolumeDevice(named: name, inContainer: container) {
            return device
        }
        throw Failure.unexpectedOutput(command: "diskutil apfs addVolume", output: result.combinedText)
    }

    func findAPFSVolumeDevice(named name: String, inContainer container: String) async throws -> String? {
        let plist = try await runPlist(["apfs", "list", "-plist"])
        guard let containers = plist["Containers"] as? [[String: Any]] else { return nil }
        for entry in containers {
            guard entry["ContainerRefe
```

### Core Architecture Module: `AppPorts/Utils/DocumentationLink.swift`
```
//
//  DocumentationLink.swift
//  AppPorts
//

import Foundation

/// 文档站链接：按当前界面语言打开对应语言的页面。
///
/// 文档站有简体中文（根目录）、繁体中文、英语、日语、韩语、德语、法语、西班牙语八个站点；
/// 其他界面语言打开英文站。锚点使用文档里显式声明的 `{#id}`，各语言页面保持一致。
enum DocumentationLink {
    static let baseURL = URL(string: "https://docs-appports.shimoko.com/")!

    /// 语言代码 → 文档站目录前缀
    private static let sitePrefixes: [String: String] = [
        "zh-Hans": "",
        "zh-Hant": "zh-Hant/",
        "en": "en/",
        "ja": "ja/",
        "ko": "ko/",
        "de": "de/",
        "fr": "fr/",
        "es": "es/"
    ]

    /// - Parameters:
    ///   - page: 不带扩展名的页面路径，如 `why-apfs`、`datamigrae/mount-migration`
    ///   - anchor: 页面内的显式锚点
    ///   - language: 界面语言代码；默认取当前设置
    static func url(page: String, anchor: String? = nil, language: String = currentLanguage) -> URL {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        components.path = "/" + sitePrefix(for: language) + page + ".html"
        components.fragment = anchor
        return components.url ?? baseURL
    }

    /// 当前界面语言；跟随系统时取应用实际使用的本地化。
    static var currentLanguage: String {
        let selected = LanguageManager.shared.language
        guard selected == "system" else { return selected }
        return Bundle.main.preferredLocalizations.first ?? "en"
    }

    static func sitePrefix(for language: String) -> String {
        if let prefix = sitePrefixes[language] { return prefix }
        let lowered = language.lowercased()
        if lowered.hasPrefix("zh-hant") || lowered.hasPrefix("zh-tw") || lowered.hasPrefix("zh-hk") || lowered.hasPrefix("zh-mo") {
            return "zh-Hant/"
        }
        // 简体中文及其变体（包括火星文）都用中文站。
        if lowered.hasPrefix("zh") { return "" }
        let base = String(lowered.prefix { $0 != "-" && $0 != "_" })
        return sitePrefixes[base] ?? "en/"
    }
}

```

### Core Architecture Module: `AppPorts/Utils/FileCopier.swift`
```
//
//  FileCopier.swift
//  AppPorts
//
//  Created by shimoko.com on 2026/2/6.
//

import Darwin
import Foundation

/// 单次遍历的文件复制器。网络卷最多同时复制 4 个普通文件，避免小文件的
/// 元数据往返完全串行，也避免为整棵目录树预先创建任务或统计大小。
actor FileCopier {
    struct Progress: Sendable {
        let copiedBytes: Int64
        /// 复制期间为调用者已有的大小估算（0 表示未知），完成时为实际复制字节数。
        let totalBytes: Int64
        let currentFile: String

        var percentage: Double {
            totalBytes > 0 ? min(1, max(0, Double(copiedBytes) / Double(totalBytes))) : 0
        }
    }

    typealias ProgressHandler = @Sendable (Progress) async -> Void
    typealias CopyOperation = @Sendable (URL, URL) async throws -> Void
    typealias NetworkVolumeDetector = @Sendable (URL) -> Bool
    typealias Clock = @Sendable () -> TimeInterval

    private let fileManager = FileManager.default
    private let networkVolumeDetector: NetworkVolumeDetector
    private let copyOperation: CopyOperation
    private let clock: Clock
    private let progressUpdateThreshold: Int64 = 5 * 1024 * 1024
    private let itemCountThreshold = 50
    private let progressUpdateInterval: TimeInterval = 0.2

    init(
        networkVolumeDetector: @escaping NetworkVolumeDetector = { FileCopier.isNetworkVolume(at: $0) },
        copyOperation: @escaping CopyOperation = { try await FileCopier.copyWithRetry(at: $0, to: $1) },
        clock: @escaping Clock = { ProcessInfo.processInfo.systemUptime }
    ) {
        self.networkVolumeDetector = networkVolumeDetector
        self.copyOperation = copyOperation
        self.clock = clock
    }

    /// estimatedTotalBytes 可复用扫描列表已有的大小，复制器不会为了进度另扫一遍目录。
    /// removeQuarantine 仅供应用迁移使用，不影响其他扩展属性或源文件。
    @discardableResult
    func copyDirectory(
        from source: URL,
        to destination: URL,
        estimatedTotalBytes: Int64? = nil,
        removeQuarantine: Bool = false,
        progressHandler: ProgressHandler?
    ) async throws -> Int64 {
        try Task.checkCancellation()
        let source = source.standardizedFileURL
        let destination = destination.standardizedFileURL
        let operationID = AppLogger.shared.makeOperationID(prefix: "file-copy")
        var state = CopyState(totalBytes: max(0, estimatedTotalBytes ?? 0), lastReportedAt: clock())

        // 在读取源目录之前先让界面显示当前操作；NAS 目录查询本身也可能较慢。
        await progressHandler?(Progress(copiedBytes: 0, totalBytes: state.totalBytes, currentFile: source.lastPathComponent))

        do {
            let sourceValues = try source.resourceValues(forKeys: [.fileResourceTypeKey, .fileSizeKey])
            guard source != destination else {
                throw CocoaError(.fileWriteFileExists, userInfo: [NSFilePathErrorKey: destination.path])
            }

            let concurrentCopies = networkVolumeDetector(source) || networkVolumeDetector(destination) ? 4 : 1
            AppLogger.shared.logContext(
                "FileCopier 开始复制",
                details: [
                    ("operation_id", operationID),
                    ("source", source.path),
                    ("destination", destination.path),
                    ("max_concurrent_copies", String(concurrentCopies)),
                    ("estimated_total_bytes", String(state.totalBytes)),
                    ("remove_quarantine", removeQuarantine ? "true" : "false")
                ],
                level: "TRACE"
            )

            switch sourceValues.fileResourceType {
            case .directory:
                let resolvedSource = source.resolvingSymlinksInPath().path
                let resolvedDestination = destination.resolvingSymlinksInPath().path
                guard resolvedDestination != resolvedSource,
                      !resolvedDestination.hasPrefix(resolvedSource == "/" ? "/" : resolvedSource + "/") else {
                    throw CocoaError(.fileWriteInvalidFileName, userInfo: [NSFilePathErrorKey: destination.path])
                }
                try await copyContents(
                    from: source,
                    to: destination,
                    concurrentCopies: concurrentCopies,
                    removeQuarantine: removeQuarantine,
                    state: &state,
                    progressHandler: progressHandler
                )
            case .regular:
                var destinationInfo = stat()
                guard lstat(destination.path, &destinationInfo) != 0 else {
                    throw CocoaError(.fileWriteFileExists, userInfo: [NSFilePathErrorKey: destination.path])
                }
                state.totalBytes = Int64(sourceValues.fileSize ?? 0)
                await progressHandler?(Progress(copiedBytes: 0, totalBytes: state.totalBytes, currentFile: source.lastPathComponent))
                try fileManager.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
                let result = try await Self.copyFile(
                    from: source,
                    to: destination,
                    size: state.totalBytes,
                    removeQuarantine: removeQuarantine,
                    operation: copyOperation
                )
                state.copiedBytes = result.bytes
                state.copiedItems = 1
            case .symbolicLink:
                try fileManager.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
                try Self.copySymbolicLink(from: source, to: destination, removeQuarantine: removeQuarantine)
                state.copiedItems = 1
            case .socket:
                break
            default:
                throw CocoaError(.fileReadUnknown, userInfo: [NSFilePathErrorKey: source.path])
            }

            try Task.checkCancellation()
            await progressHandler?(Progress(copiedBytes: state.copiedBytes, totalBytes: state.copiedBytes, currentFile: ""))
            AppLogger.shared.logContext(
                "FileCopier 完成复制",
                details: [
                    ("operation_id", operationID),
                    ("copied_bytes", String(state.copiedBytes)),
                    ("copied_items", String(state.copiedItems)),
                    ("source", source.path),
                    ("destination", destination.path)
                ],
                level: "TRACE"
            )
            return state.copiedBytes
        } catch {
            AppLogger.shared.logError(
                "FileCopier 复制失败",
                error: error,
                context: [("operation_id", operationID), ("source", source.path), ("destination", destination.path)]
            )
            throw error
        }
    }

    /// 对尚未创建的目标逐级查询父目录；statfs 会解析挂载点与父路径中的符号链接。
    nonisolated static func isNetworkVolume(at url: URL) -> Bool {
        var current = url.standardizedFileURL
        while true {
            var fileSystem = statfs()
            if statfs(current.path, &fileSystem) == 0 {
                return fileSystem.f_flags & UInt32(MNT_LOCAL) == 0
            }
            guard errno == ENOENT || errno == ENOTDIR else { return false }
            let parent = current.deletingLastPathComponent()
            guard parent != current else { return false }
            current = parent
        }
    }

    /// 仅用于调用者明确拥有的迁移副本。源目录的只读权限也会被复制，
    /// 清理时临时允许其所有者遍历和删除；不改变符号链接指向的项目。
    nonisolated static func removeCopy(at url: URL) throws {
        let url = url.standardizedFileURL
        let fileManager = FileManager.default
        var rootInfo = stat()
        guard lstat(url.path, &rootInfo) == 0 else {
            throw NSError(domain: NSPOSIXErrorDomain, code: Int(errno), userInfo: [NSFilePathErrorKey: url.path])
        }
        guard rootInfo.st_mode & S_IFMT == S_IFDIR else {
            try fileManager.removeItem(at: url)
            return
        }

        var changedDirectories: [DirectoryPermissions] = []
        do {
            try prepareDirectoryForRemoval(at: url, info: rootInfo, changedDirectories: &changedDirectories)
            var enumerationError: Error?
            guard let enumerator = fileManager.enumerator(
                at: url,
                includingPropertiesForKeys: [],
                options: [],
                errorHandler: { _, error in
                    enumerationError = error
                    return false
                }
            ) else {
                throw CocoaError(.fileReadUnknown, userInfo: [NSFilePathErrorKey: url.path])
            }
            for case let item as URL in enumerator {
                var info = stat()
                guard lstat(item.path, &info) == 0 else {
                    throw NSError(domain: NSPOSIXErrorDomain, code: Int(errno), userInfo: [NSFilePathErrorKey: item.path])
                }
                if info.st_mode & S_IFMT == S_IFDIR {
                    try prepareDirectoryForRemoval(at: item, info: info, changedDirectories: &changedDirectories)
                }
            }
            if let enumerationError { throw enumerationError }
            try fileManager.removeItem(at: url)
        } catch {
            // 部分删除失败时，先恢复仍存在的子目录，再恢复父目录。
            // 用 inode/device 确认仍是原项目，避免修改同一路径下的替换文件。
            for directory in changedDirectories.reversed() {
                var info = stat()
                if lstat(directory.url.path, &info) == 0,
                   info.st_mode & S_IFMT == S_IFDIR,
                   info.st_ino == directory.inode,
                   info.st_dev == directory.device {
                    _ = lchmod(directory.url.path, directory.mode)
                }
            }
            throw error
        }
    }

    private struct DirectoryPermissions {
        let url: URL
        let mode: mode_t
        let inode: ino_t
        let device: dev_t
    }

    nonisolated private static func prepareDirectoryForRemoval(
        at url: URL,
        info: stat,
        changedDirectories: inout [DirectoryPermissions]
    ) throws {
        let originalMode = info.st_mode
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

### Incident Patch 1: `4616d28c` (2026-09-30)
**Commit Message**: fix: 移除 README 中的多余信息并添加新赞助者 VC

**File**: `README.md` (modified, +1/-1)
```diff
@@ -6,7 +6,6 @@
 
 Move apps and data to an external drive. Open them as usual.
 
-Free & open source · Native SwiftUI · macOS 12.0+
 
 [English](README.md)｜[简体中文](README_CN.md)｜[Official Website](https://appports.shimoko.com/)｜[Documentation](https://docs-appports.shimoko.com/)｜[DeepWiki](https://deepwiki.com/wzh4869/AppPorts)
 
@@ -175,6 +174,7 @@ Thanks to the following sponsors (this list is kept in sync with `sponsors.json`
 
 - **师杀** · [space.bilibili.com/396481888](https://space.bilibili.com/396481888)
 - **符华**
+- **VC**
 
 ## Advanced Storage Management
 
```

**File**: `README_CN.md` (modified, +2/-2)
```diff
@@ -6,7 +6,6 @@
 
 应用和数据迁往外置硬盘，熟悉的打开方式依然在。
 
-免费开源 · 原生 SwiftUI · macOS 12.0+
 
 [English](README.md)｜[简体中文](README_CN.md)｜[官方网站](https://appports.shimoko.com/)｜[使用文档](https://docs-appports.shimoko.com/)｜[DeepWiki](https://deepwiki.com/wzh4869/AppPorts)
 
@@ -175,7 +174,8 @@ AppPorts 完全免费、开源、无广告，项目由个人在业余时间维
 
 - **师杀** · [space.bilibili.com/396481888](https://space.bilibili.com/396481888)
 - **符华**
-
+- **VC**
+ 
 ## 🔗 进阶存储管理
 
 * [LazyMount-Mac](https://github.com/yuanweize/LazyMount-Mac)：轻松扩展 Mac 存储空间 —— 开机自动挂载 SMB 共享与云存储，无需任何手动操作。
```

---

### Incident Patch 2: `3ecef13c` (2026-09-30)
**Commit Message**: fix: 更新赞助者符华的日期并添加新赞助者VC

**File**: `sponsors.json` (modified, +7/-1)
```diff
@@ -14,7 +14,13 @@
       "name": "符华",
       "link": "",
       "amount": 0.63,
-      "date": "2026-09-16"
+      "date": "2026-09-28"
+    },
+    {
+      "name": "VC",
+      "link": "",
+      "amount": 8.80,
+      "date": "2026-09-30"
     }
   ]
 }
```

---

### Incident Patch 3: `ef823d13` (2026-09-29)
**Commit Message**: fix: avoid blocking process completion callbacks

**File**: `.github/workflows/build.yml` (modified, +1/-0)
```diff
@@ -53,6 +53,7 @@ jobs:
             -only-testing:"AppPortsTests/AppIdentityResolverTests" \
             -only-testing:"AppPortsTests/AppIdentityScannerTests" \
             -only-testing:"AppPortsTests/DataDirSpaceSummaryTests" \
+            -only-testing:"AppPortsTests/ProcessCommandRunnerTests" \
             CODE_SIGN_IDENTITY="" \
             CODE_SIGNING_REQUIRED=NO \
             CODE_SIGN_ENTITLEMENTS="" \
```

**File**: `.github/workflows/post-merge-validation.yml` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@ jobs:
             -only-testing:"AppPortsTests/AppIdentityResolverTests" \
             -only-testing:"AppPortsTests/AppIdentityScannerTests" \
             -only-testing:"AppPortsTests/DataDirSpaceSummaryTests" \
+            -only-testing:"AppPortsTests/ProcessCommandRunnerTests" \
             CODE_SIGN_IDENTITY="" \
             CODE_SIGNING_REQUIRED=NO \
             CODE_SIGN_ENTITLEMENTS="" \
```

**File**: `AppPorts/Utils/DiskUtility.swift` (modified, +5/-3)
```diff
@@ -53,9 +53,11 @@ struct ProcessCommandRunner: ShellCommandRunning {
             }
 
             process.terminationHandler = { finished in
-                // 进程退出后管道写端关闭，两个读取任务随之结束。
-                readers.wait()
-                continuation.resume(returning: collector.result(status: finished.terminationStatus))
+                // 等两个管道读完再返回结果，但不阻塞系统的高优先级退出回调线程。
+                let status = finished.terminationStatus
+                readers.notify(queue: .global(qos: .utility)) {
+                    continuation.resume(returning: collector.result(status: status))
+                }
             }
 
             do {
```

**File**: `AppPortsTests/ProcessCommandRunnerTests.swift` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+import Foundation
+import Testing
+@testable import AppPorts
+
+@Suite("Process command completion")
+struct ProcessCommandRunnerTests {
+    @Test("Keeps stdout, stderr and the original exit status", arguments: [0, 23])
+    func preservesOutputAndStatus(status: Int) async throws {
+        let result = try await ProcessCommandRunner().run(
+            executable: "/bin/sh",
+            arguments: ["-c", "printf 'output\\n'; printf 'error\\n' >&2; exit \"$1\"", "runner-test", String(status)],
+            timeout: 10
+        )
+
+        #expect(result.status == Int32(status))
+        #expect(result.stdoutText == "output\n")
+        #expect(result.stderrText == "error\n")
+        #expect(!result.timedOut)
+    }
+
+    @Test("An empty command result still completes")
+    func emptyOutput() async throws {
+        let result = try await ProcessCommandRunner().run(executable: "/usr/bin/true", arguments: [], timeout: 10)
+
+        #expect(result.status == 0)
+        #expect(result.standardOutput.isEmpty)
+        #expect(result.standardError.isEmpty)
+        #expect(!result.timedOut)
+    }
+
+    @Test("Drains both streams beyond pipe capacity without truncation or deadlock")
+    func largeConcurrentOutput() async throws {
+        let result = try await ProcessCommandRunner().run(
+            executable: "/bin/sh",
+            arguments: ["-c", "/usr/bin/head -c 1048576 /dev/zero & /usr/bin/head -c 786432 /dev/zero >&2 & wait"],
+            timeout: 15
+        )
+
+        #expect(result.status == 0)
+        #expect(result.standardOutput == Data(repeating: 0, count: 1_048_576))
+        #expect(result.standardError == Data(repeating: 0, count: 786_432))
+        #expect(!result.timedOut)
+    }
+
+    @Test("Waits for trailing output after the immediate child exits")
+    func trailingOutputAfterExit() async throws {
+        // A descendant keeps the pipes open briefly after the shell exits. Completion
+        // must wait for EOF on both streams, rather than return on process exit alone.
+        let result = try await ProcessCommandRunner().run(
+            executable: "/bin/sh",
+            arguments: ["-c", "(sleep 0.1; printf 'tail-out'; printf 'tail-err' >&2) & exit 7"],
+            timeout: 10
+        )
+
+        #expect(result.status == 7)
+        #expect(result.stdoutText == "tail-out")
+        #expect(result.stderrText == "tail-err")
+        #expect(!result.timedOut)
+    }
+
+    @Test("A launch failure throws and does not prevent a later command")
+    func launchFailure() async throws {
+        let runner = ProcessCommandRunner()
+        let nonexistent = FileManager.default.temporaryDirectory
+            .appendingPathComponent("AppPorts-missing-executable-\(UUID().uuidString)")
+
+        await #expect(throws: (any Error).self) {
+            try await runner.run(executable: nonexistent.path, arguments: [], timeout: 10)
+        }
+
+        let result = try await runner.run(executable: "/usr/bin/printf", arguments: ["recovered"], timeout: 10)
+        #expect(result.status == 0)
+        #expect(result.stdoutText == "recovered")
+        #expect(result.standardError.isEmpty)
+        #expect(!result.timedOut)
+    }
+
+    @Test("Timeout terminates a running process and completes the result")
+    func timeout() async throws {
+        let result = try await ProcessCommandRunner().run(
+            executable: "/bin/sleep", arguments: ["30"], timeout: 0.2
+        )
+
+        #expect(result.timedOut)
+        #expect(result.status != 0)
+        #expect(result.standardOutput.isEmpty)
+        #expect(result.standardError.isEmpty)
+    }
+
+    @Test("Concurrent commands keep their outputs and exit statuses separate")
+    func concurrentCommands() async throws {
+        try await withThrowingTaskGroup(of: Void.self) { group in
+            for index in 0..<16 {
+                group.addTask {
+                    let result = try await ProcessCommandRunner().run(
+                        executable: "/bin/sh",
+                        arguments: ["-c", "printf 'out:%s' \"$1\"; printf 'err:%s' \"$1\" >&2; exit \"$1\"",
+                                    "runner-test", String(index)],
+                        timeout: 10
+                    )
+                    #expect(result.status == Int32(index))
+                    #expect(result.stdoutText == "out:\(index)")
+                    #expect(result.stderrText == "err:\(index)")
+                    #expect(!result.timedOut)
+                }
+            }
+            try await group.waitForAll()
+        }
+    }
+}
```

---

### Incident Patch 4: `04e70ccd` (2026-09-29)
**Commit Message**: fix: resolve real app identities when scanning data

**File**: `.github/workflows/build.yml` (modified, +3/-0)
```diff
@@ -50,6 +50,9 @@ jobs:
             -derivedDataPath build \
             -only-testing:"AppPortsTests/DataDirMoverTests" \
             -only-testing:"AppPortsTests/DataDirScannerTests" \
+            -only-testing:"AppPortsTests/AppIdentityResolverTests" \
+            -only-testing:"AppPortsTests/AppIdentityScannerTests" \
+            -only-testing:"AppPortsTests/DataDirSpaceSummaryTests" \
             CODE_SIGN_IDENTITY="" \
             CODE_SIGNING_REQUIRED=NO \
             CODE_SIGN_ENTITLEMENTS="" \
```

**File**: `.github/workflows/post-merge-validation.yml` (modified, +3/-0)
```diff
@@ -25,6 +25,9 @@ jobs:
             -derivedDataPath build \
             -only-testing:"AppPortsTests/DataDirMoverTests" \
             -only-testing:"AppPortsTests/DataDirScannerTests" \
+            -only-testing:"AppPortsTests/AppIdentityResolverTests" \
+            -only-testing:"AppPortsTests/AppIdentityScannerTests" \
+            -only-testing:"AppPortsTests/DataDirSpaceSummaryTests" \
             CODE_SIGN_IDENTITY="" \
             CODE_SIGNING_REQUIRED=NO \
             CODE_SIGN_ENTITLEMENTS="" \
```

**File**: `AppPorts/Localizable.xcstrings` (modified, +411/-0)
```diff
@@ -1,6 +1,417 @@
 {
   "sourceLanguage" : "zh-Hans",
   "strings" : {
+    "无法完整识别应用数据" : {
+      "extractionState" : "manual",
+      "localizations" : {
+        "ar" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "تعذّر تحديد بيانات التطبيق بالكامل"
+          }
+        },
+        "br" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "⠠⠥⠝⠁⠃⠇⠑ ⠞⠕ ⠋⠥⠇⠇⠽ ⠊⠙⠑⠝⠞⠊⠋⠽ ⠁⠏⠏ ⠙⠁⠞⠁"
+          }
+        },
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "App-Daten konnten nicht vollständig erkannt werden"
+          }
+        },
+        "en" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Unable to fully identify app data"
+          }
+        },
+        "eo" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Ne eblas plene identigi la datumojn de la aplikaĵo"
+          }
+        },
+        "es" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "No se pudieron identificar todos los datos de la app"
+          }
+        },
+        "fr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Impossible d’identifier toutes les données de l’app"
+          }
+        },
+        "hi" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "ऐप डेटा की पूरी तरह पहचान नहीं हो सकी"
+          }
+        },
+        "id" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Tidak dapat mengidentifikasi seluruh data aplikasi"
+          }
+        },
+        "it" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Impossibile identificare tutti i dati dell’app"
+          }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "アプリのデータを完全に識別できません"
+          }
+        },
+        "ko" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "앱 데이터를 완전히 식별할 수 없습니다"
+          }
+        },
+        "nl" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Appgegevens konden niet volledig worden geïdentificeerd"
+          }
+        },
+        "pl" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Nie można w pełni zidentyfikować danych aplikacji"
+          }
+        },
+        "pt" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Não foi possível identificar todos os dados do app"
+          }
+        },
+        "ru" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Не удалось полностью определить данные приложения"
+          }
+        },
+        "th" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "ไม่สามารถระบุข้อมูลแอปได้ครบถ้วน"
+          }
+        },
+        "tr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Uygulama verileri tamamen belirlenemedi"
+          }
+        },
+        "vi" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Không thể xác định đầy đủ dữ liệu ứng dụng"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "无法完整识别应用数据"
+          }
+        },
+        "zh-Hant" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "無法完整識別應用程式資料"
+          }
+        },
+        "zh-martian" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "無法完整識別應甪數據"
+          }
+        }
+      }
+    },
+    "应用信息读取失败，以下结果可能不完整。" : {
+      "extractionState" : "manual",
+      "localizations" : {
+        "ar" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "تعذّرت قراءة معلومات التطبيق. قد تكون النتائج أدناه غير مكتملة."
+          }
+        },
+        "br" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "⠠⠥⠝⠁⠃⠇⠑ ⠞⠕ ⠗⠑⠁⠙ ⠁⠏⠏ ⠊⠝⠋⠕⠗⠍⠁⠞⠊⠕⠝⠲ ⠠⠞⠓⠑ ⠗⠑⠎⠥⠇⠞⠎ ⠃⠑⠇⠕⠺ ⠍⠁⠽ ⠃⠑ ⠊⠝⠉⠕⠍⠏⠇⠑⠞⠑⠲"
+          }
+        },
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "App-Informationen konnten nicht gelesen werden. Die folgenden Ergebnisse sind möglicherweise unvollständig."
+          }
+        },
+        "en" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Unable to read app information. The results below may be incomplete."
+          }
+        },
+        "eo" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "v
```

**File**: `AppPorts/Models/DataDirScanResult.swift` (modified, +1/-0)
```diff
@@ -33,6 +33,7 @@ struct DataDirReadIssue: Equatable, Sendable {
 struct DataDirScanResult: Sendable {
     let items: [DataDirItem]
     let readIssues: [DataDirReadIssue]
+    var identityIssue: AppIdentityIssue? = nil
 }
 
 struct DirectorySizeResult: Sendable {
```

**File**: `AppPorts/Models/DataDirSpaceSummary.swift` (modified, +2/-2)
```diff
@@ -6,7 +6,7 @@ struct DataDirSpaceSummary {
     let isCalculating: Bool
     let isIncomplete: Bool
 
-    init(items: [DataDirItem], allItems: [DataDirItem], hasReadIssues: Bool = false) {
+    init(items: [DataDirItem], allItems: [DataDirItem], hasReadIssues: Bool = false, hasIdentityIssue: Bool = false) {
         let nonLocalItems = allItems.filter { $0.status != DataDirStatus.local }
         let candidates = items.filter { item in
             item.status == DataDirStatus.local && item.isMigratable
@@ -16,7 +16,7 @@ struct DataDirSpaceSummary {
         // DirectoryEnumerator 不跨挂载卷，也不跟随软链，父项的测量已经排除了外置子目录。
         reclaimableBytes = roots.reduce(0) { $0 + $1.sizeBytes }
         isCalculating = roots.contains { $0.size == nil }
-        isIncomplete = hasReadIssues || roots.contains { $0.sizeIsIncomplete }
+        isIncomplete = hasReadIssues || hasIdentityIssue || roots.contains { $0.sizeIsIncomplete }
     }
 
     private static func isDescendant(_ item: DataDirItem, of ancestor: DataDirItem) -> Bool {
```

**File**: `AppPorts/Utils/AppIdentityResolver.swift` (added, +176/-0)
```diff
@@ -0,0 +1,176 @@
+import Foundation
+import Darwin
+
+enum AppIdentitySource: String, Sendable {
+    case macOSBundle, rootBundle, wrappedBundle, wrapperChild
+}
+
+struct ResolvedAppIdentity: Sendable {
+    /// The outer real application remains distinct from the iOS identity bundle.
+    let realAppURL: URL
+    let identityBundleURL: URL
+    let bundleIdentifier: String
+    let source: AppIdentitySource
+}
+
+struct AppIdentityIssue: Error, Equatable, Sendable {
+    enum Reason: String, Sendable {
+        case realAppUnavailable, unreadableInfoPlist, invalidInfoPlist
+        case invalidIdentifier, missingInfoPlist, wrappedBundleUnavailable
+        case ambiguousWrapper, outsideWrapper, wrapperCycle, wrapperDepthExceeded
+    }
+
+    let url: URL
+    let reason: Reason
+}
+
+/// Read-only application identity lookup. Portal interpretation stays with the existing resolver;
+/// wrapper traversal only selects metadata and never changes the target of a signing operation.
+enum AppIdentityResolver {
+    static func resolve(at appURL: URL) -> Result<ResolvedAppIdentity, AppIdentityIssue> {
+        let realAppURL: URL
+        do {
+            realAppURL = try CodeSigner.resolveAppURL(at: appURL).resolvingSymlinksInPath()
+        } catch {
+            return .failure(AppIdentityIssue(url: appURL, reason: .realAppUnavailable))
+        }
+
+        var visited = Set<String>()
+        do {
+            return .success(try readBundle(at: realAppURL, realAppURL: realAppURL,
+                                           source: nil, depth: 0, visited: &visited))
+        } catch let issue as AppIdentityIssue {
+            return .failure(issue)
+        } catch {
+            return .failure(AppIdentityIssue(url: realAppURL, reason: .unreadableInfoPlist))
+        }
+    }
+
+    private static func readBundle(
+        at url: URL, realAppURL: URL, source: AppIdentitySource?, depth: Int, visited: inout Set<String>
+    ) throws -> ResolvedAppIdentity {
+        let bundleURL = url.resolvingSymlinksInPath().standardizedFileURL
+        guard isInside(bundleURL, root: realAppURL) else {
+            throw AppIdentityIssue(url: url, reason: .outsideWrapper)
+        }
+        guard visited.insert(bundleURL.path).inserted else {
+            throw AppIdentityIssue(url: url, reason: .wrapperCycle)
+        }
+        guard depth <= 8 else {
+            throw AppIdentityIssue(url: url, reason: .wrapperDepthExceeded)
+        }
+
+        for (relativePath, defaultSource) in [
+            ("Contents/Info.plist", AppIdentitySource.macOSBundle), ("Info.plist", .rootBundle)
+        ] {
+            let plistURL = bundleURL.appendingPathComponent(relativePath)
+            if try entryExists(plistURL) {
+                // Wrapped metadata may itself be a symlink (including Contents). Validate the
+                // file we will actually read, while preserving ordinary native metadata links.
+                if source != nil, !isInside(plistURL.resolvingSymlinksInPath(), root: realAppURL) {
+                    throw AppIdentityIssue(url: plistURL, reason: .outsideWrapper)
+                }
+                // A broken or invalid higher-priority plist must not select a different identity.
+                let identifier = try readIdentifier(at: plistURL)
+                return ResolvedAppIdentity(realAppURL: realAppURL, identityBundleURL: bundleURL,
+                                           bundleIdentifier: identifier, source: source ?? defaultSource)
+            }
+        }
+
+        let wrapped = bundleURL.appendingPathComponent("WrappedBundle")
+        if try entryExists(wrapped) {
+            let target = try wrapperTarget(wrapped)
+            guard isInside(target, root: realAppURL) else {
+                throw AppIdentityIssue(url: wrapped, reason: .outsideWrapper)
+            }
+            var isDirectory: ObjCBool = false
+            guard FileManager.default.fileExists(atPath: target.path, isDirectory: &isDirectory),
+                  isDirectory.boolValue else {
+                throw AppIdentityIssue(url: wrapped, reason: .wrappedBundleUnavailable)
+            }
+            return try readBundle(at: target, realAppURL: realAppURL, source: source ?? .wrappedBundle,
+                                  depth: depth + 1, visited: &visited)
+        }
+
+        let wrapper = bundleURL.appendingPathComponent("Wrapper")
+        guard try entryExists(wrapper) else {
+            throw AppIdentityIssue(url: bundleURL, reason: .missingInfoPlist)
+        }
+        guard isInside(wrapper.resolvingSymlinksInPath(), root: realAppURL) else {
+            throw AppIdentityIssue(url: wrapper, reason: .outsideWrapper)
+        }
+        let candidates: [URL]
+        do {
+            candidates = try FileManager.default.contentsOfDirectory(
+                at: wrapper, includingPropertiesForKeys: [.isDirectoryKey], options: .skipsHiddenFiles
+            ).filter { candidate in
+        
```

**File**: `AppPorts/Utils/DataDirScanner.swift` (modified, +18/-15)
```diff
@@ -530,9 +530,18 @@ actor DataDirScanner {
         let scanID = AppLogger.shared.makeOperationID(prefix: "scanner-library-dirs")
         refreshMountRecords()
 
-        // 从 Info.plist 读取 BundleID
-        let bundleID = readBundleID(from: app.path)
-        let appName = app.name.replacingOccurrences(of: ".app", with: "")
+        let identity: ResolvedAppIdentity?
+        let identityIssue: AppIdentityIssue?
+        switch AppIdentityResolver.resolve(at: app.displayURL) {
+        case .success(let resolved):
+            identity = resolved
+            identityIssue = nil
+        case .failure(let issue):
+            identity = nil
+            identityIssue = issue
+        }
+        let bundleID = identity?.bundleIdentifier
+        let appName = app.displayName.replacingOccurrences(of: ".app", with: "")
         let matchProfile = buildMatchProfile(bundleID: bundleID, appName: appName)
         let appIsSandboxed = isSandboxedApplication(app.displayURL)
         AppLogger.shared.logContext(
@@ -542,6 +551,10 @@ actor DataDirScanner {
                 ("app_name", appName),
                 ("app_path", app.path.path),
                 ("bundle_id", bundleID),
+                ("identity_source", identity?.source.rawValue),
+                ("identity_bundle_path", identity?.identityBundleURL.path),
+                ("real_app_path", identity?.realAppURL.path),
+                ("identity_error", identityIssue?.reason.rawValue),
                 ("external_root", externalRootURL?.path),
                 ("sandboxed", appIsSandboxed ? "true" : "false"),
                 ("exact_match_count", String(matchProfile.exactMatches.count)),
@@ -676,7 +689,7 @@ actor DataDirScanner {
             ],
             level: "TRACE"
         )
-        return DataDirScanResult(items: sortedResults, readIssues: readIssues)
+        return DataDirScanResult(items: sortedResults, readIssues: readIssues, identityIssue: identityIssue)
     }
 
     /// 异步计算单个目录大小
@@ -1532,7 +1545,7 @@ actor DataDirScanner {
             }
         }
 
-        if let bundleID, !bundleID.isEmpty {
+        if let bundleID, !bundleID.isEmpty, !bundleID.lowercased().hasSuffix(".appports.stub") {
             exactMatches.insert(bundleID)
 
             let components = bundleID.split(separator: ".").map(String.init)
@@ -1941,16 +1954,6 @@ actor DataDirScanner {
         return false
     }
 
-    /// 从 Info.plist 读取 BundleID
-    private func readBundleID(from appURL: URL) -> String? {
-        let infoPlistURL = appURL.appendingPathComponent("Contents/Info.plist")
-        guard let data = try? Data(contentsOf: infoPlistURL),
-              let plist = try? PropertyListSerialization.propertyList(from: data, options: [], format: nil) as? [String: Any] else {
-            return nil
-        }
-        return plist["CFBundleIdentifier"] as? String
-    }
-
     /// 检测目录当前状态，并区分 AppPorts 受管链接、挂载迁移项和已有符号链接。
     private func inspectItem(at url: URL, type: DataDirType) -> (status: String, linkedDestination: URL?) {
         if let record = mountRecord(for: url) {
```

**File**: `AppPorts/Views/DataDirsView.swift` (modified, +46/-5)
```diff
@@ -65,6 +65,7 @@ struct DataDirsView: View {
     @State private var libraryItems:   [DataDirItem] = []
     @State private var dotFolderReadIssues: [DataDirReadIssue] = []
     @State private var libraryReadIssues: [DataDirReadIssue] = []
+    @State private var libraryIdentityIssue: AppIdentityIssue?
     @State private var showReadinessCheck = false
     @AppStorage("showZeroByteDataDirectories") private var showZeroByteDirectories = false
 
@@ -362,6 +363,7 @@ struct DataDirsView: View {
                     libraryScanToken = UUID()
                     libraryItems = []
                     libraryReadIssues = []
+                    libraryIdentityIssue = nil
                     selectedAppIsSandboxed = false
                     isScanning = false
                 }
@@ -398,12 +400,20 @@ struct DataDirsView: View {
                     if selectedApp != nil {
                         directorySearchField
                         if hasActiveAppDataFilters { appDataFilterSummary }
-                        if !libraryItems.isEmpty || !libraryReadIssues.isEmpty {
+                        if !libraryItems.isEmpty || !libraryReadIssues.isEmpty || libraryIdentityIssue != nil {
                             HStack(spacing: 12) {
-                                statsSummary(items: filteredLibraryItems, allItems: libraryItems, readIssues: libraryReadIssues)
+                                statsSummary(
+                                    items: filteredLibraryItems,
+                                    allItems: libraryItems,
+                                    readIssues: libraryReadIssues,
+                                    hasIdentityIssue: libraryIdentityIssue != nil
+                                )
                                 zeroByteDirectoriesToggle
                             }
                         }
+                        if let issue = libraryIdentityIssue {
+                            appIdentityWarning(issue: issue)
+                        }
                         if !libraryReadIssues.isEmpty {
                             directoryReadWarning(issues: libraryReadIssues)
                         }
@@ -428,7 +438,13 @@ struct DataDirsView: View {
                     } else if isScanning && libraryItems.isEmpty {
                         loadingView
                     } else if libraryItems.isEmpty {
-                        ContentView.EmptyStateView(icon: "folder.badge.questionmark", text: "未找到关联数据目录".localized)
+                        if libraryIdentityIssue != nil {
+                            ContentView.EmptyStateView(icon: "exclamationmark.circle", text: "无法完整识别应用数据".localized)
+                        } else if !libraryReadIssues.isEmpty {
+                            ContentView.EmptyStateView(icon: "exclamationmark.circle", text: "部分目录无法读取，请检查后刷新。".localized)
+                        } else {
+                            ContentView.EmptyStateView(icon: "folder.badge.questionmark", text: "未找到关联数据目录".localized)
+                        }
                     } else if sortedFilteredLibraryItems.isEmpty {
                         ContentView.EmptyStateView(icon: "line.3.horizontal.decrease.circle", text: "没有匹配当前筛选条件的数据目录".localized)
                     } else {
@@ -770,8 +786,31 @@ struct DataDirsView: View {
         .font(.system(size: 12))
     }
 
-    private func statsSummary(items: [DataDirItem], allItems: [DataDirItem], readIssues: [DataDirReadIssue]) -> some View {
-        let summary = DataDirSpaceSummary(items: items, allItems: allItems, hasReadIssues: !readIssues.isEmpty)
+    private func appIdentityWarning(issue: AppIdentityIssue) -> some View {
+        HStack(alignment: .top, spacing: 8) {
+            Image(systemName: "exclamationmark.circle")
+                .foregroundColor(.orange)
+                .accessibilityHidden(true)
+            VStack(alignment: .leading, spacing: 4) {
+                Text("应用信息读取失败，以下结果可能不完整。".localized)
+                if issue.reason == .realAppUnavailable {
+                    Text("请检查应用路径；若应用位于外置磁盘，请连接磁盘后刷新。".localized)
+                }
+            }
+            .foregroundColor(.secondary)
+            .fixedSize(horizontal: false, vertical: true)
+        }
+        .font(.system(size: 12))
+        .help(issue.url.path.replacingOccurrences(of: NSHomeDirectory(), with: "~"))
+        .accessibilityElement(children: .combine)
+    }
+
+    private func statsSummary(
+        items: [DataDirItem], allItems: [DataDirItem], readIssues: [DataDirReadIssue], hasIdentityIssue: Bool = false
+    ) -> some View {
+        let summary = DataDirSpaceSummary(
+            items: items, allItems: allItems, hasReadIssues: !readIssues.isEmpty, hasIdentityIssue: hasIdentityIssue
+        )
         let linked = items.filter { $0.status == "已链接" }.count
         let mounted = items.filter { DataDirStatus.mountStatuses.contains($0.status) }.count
         let needsNormalization = items.filter { $0.status == "待规范" }
```

---

### Incident Patch 5: `c69d1573` (2026-09-29)
**Commit Message**: fix: correct link in README_CN.md

**File**: `README_CN.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 
 免费开源 · 原生 SwiftUI · macOS 12.0+
 
-[English](README.mdmd)｜[简体中文](README_CN.md)｜[官方网站](https://appports.shimoko.com/)｜[使用文档](https://docs-appports.shimoko.com/)｜[DeepWiki](https://deepwiki.com/wzh4869/AppPorts)
+[English](README.md)｜[简体中文](README_CN.md)｜[官方网站](https://appports.shimoko.com/)｜[使用文档](https://docs-appports.shimoko.com/)｜[DeepWiki](https://deepwiki.com/wzh4869/AppPorts)
 
 <a href="https://github.com/wzh4869/AppPorts/releases"><img src="https://img.shields.io/github/v/release/wzh4869/AppPorts?style=flat-square&label=release&color=blue" alt="Release"></a>
 <a href="https://github.com/wzh4869/AppPorts/stargazers"><img src="https://img.shields.io/github/stars/wzh4869/AppPorts?style=flat-square&color=yellow" alt="Stars"></a>
```

---

### Incident Patch 6: `31f9e224` (2026-09-29)
**Commit Message**: fix: update sponsor details and timestamp in sponsors.json

**File**: `sponsors.json` (modified, +8/-2)
```diff
@@ -2,12 +2,18 @@
   "sponsorPage": "https://docs-appports.shimoko.com/sponsor.html",
   "qrCode": "https://pic.cdn.shimoko.com/thanks.png",
   "currency": "CNY",
-  "updatedAt": "2026-09-17",
+  "updatedAt": "2026-09-29T04:39:01Z",
   "sponsors": [
     {
       "name": "师杀",
       "link": "https://space.bilibili.com/396481888",
-      "amount": 300,
+      "amount": 350,
+      "date": "2026-09-16"
+    },
+    {
+      "name": "符华",
+      "link": "",
+      "amount": 0.63,
       "date": "2026-09-16"
     }
   ]
```

---

### Incident Patch 7: `48f88258` (2026-09-26)
**Commit Message**: docs: prioritize macOS 27 recovery and upgrade guidance

Move repair steps ahead of background details in all eight localized guides, explain login re-signing protection and pre-upgrade preparation, and record the migration onboarding review.

**File**: `User_docs/docs/de/macos-27.md` (modified, +62/-67)
```diff
@@ -5,126 +5,121 @@ outline: deep
 # Hinweise zum Upgrade auf macOS 27
 
 ::: tip Kurz erklärt
-Wenn du mit AppPorts Containerdaten etwa von WeChat migriert und dabei dem erneuten Signieren zugestimmt hast, können diese Apps nach dem Upgrade auf macOS 27 **möglicherweise** direkt nach dem Doppelklick schließen. Bei WeChat passiert dies; QQ Music ließ sich im Test weiterhin öffnen. **Die Daten sind nicht beschädigt** und müssen nicht erneut migriert werden. Stelle die Daten lokal wieder her und installiere die App aus offizieller Quelle neu. Danach kannst du sie mit der neuen [Mount-Migration](/de/datamigrae/mount-migration) wieder extern ablegen.
+Wenn WeChat oder eine andere App nach einer Neusignierung in einer älteren oder Testversion von AppPorts unter macOS 27 nicht mehr über Finder / Dock startet, beginne mit der Reparatur unten. Stelle alte Containerverknüpfungen zurück und danach die Original-App wieder her, oder installiere die offizielle Version neu. **Lösche keine Datenordner und signiere nicht erneut.** Ein Signaturfehler allein belegt keinen Datenverlust.
 :::
 
+## Reparatur
+
+Klicke direkt auf **„Reparieren“** in der App-Zeile oder wähle „Reparaturschritte anzeigen“ im Kontextmenü. Terminalbefehle sind nicht erforderlich. Diese Anleitung beschreibt die aktuelle Entwicklungsversion; ohne Reparaturfenster kannst du die Schritte manuell ausführen. Verbinde das ursprüngliche externe Laufwerk, beende die App vollständig und bewahre Daten und Sicherungen auf.
+
+::: tip Automatisches Neusignieren bei der Anmeldung
+Die aktuelle Entwicklungsversion deaktiviert das automatische Neusignieren bei der Anmeldung unter macOS 27 oder neuer und beendet und entfernt die bisherige Anmeldeaufgabe. Falls die Bereinigung nicht abgeschlossen wurde, können Sie sie in den Einstellungen erneut versuchen.
+
+**Aktualisieren und öffnen Sie AppPorts einmal, bevor Sie macOS aktualisieren**, damit die installierte Hintergrundaufgabe die Versionsprüfung erhält. Das Herunterladen der neuen Version allein aktualisiert die alte Aufgabe nicht.
+:::
+
+### 1. Über alte Links migrierte Containerdaten zurückholen
+
+Findet das Fenster Containerverknüpfungen zum externen Laufwerk, wähle „Alle wiederherstellen“. Sonst entfällt dieser Schritt. Manuell: Datenverzeichnisse → App-Daten → App auswählen → verknüpfte Container zurückholen. Daten mit APFS-Mount-Migration müssen für eine Signaturreparatur nicht zurückgeholt werden.
+
+### 2. Original-App wiederherstellen oder offiziell neu installieren
+
+- **Vollständige Original-App gesichert:** Nutze „Originalsignatur wiederherstellen“. Auch die echte App auf dem externen Laufwerk lässt sich direkt wiederherstellen. Sie muss dafür nicht zurück auf den Mac. AppPorts prüft, ob die aktuelle App zur Sicherung passt. Eine aktualisierte oder veränderte App benötigt ein passendes offizielles Original.
+- **Nur ein alter Identitätsnachweis vorhanden:** Wähle eine offizielle `.app` derselben Version oder installiere über App Store / Entwicklerwebsite neu. Ein Zertifikatsname allein stellt keine Entwicklersignatur wieder her.
+- **Externe App durch Installation ersetzen:** Hole sie zuerst lokal zurück, damit der Installer nicht nur den lokalen Starter ersetzt.
+
+**Lösche keine Containerdaten.** Sichere wichtige Daten separat. Der Zugriff auf Chats und Anmeldungen hängt auch von Versionen, Berechtigungen und dem Datenzustand ab. Siehe [Signatursicherung und Wiederherstellung](/de/datamigrae/resign).
+
+### 3. Erneut prüfen und über Finder / Dock starten
+
+Klicke auf „Erneut prüfen“ und öffne die App nach erfolgreicher Signaturprüfung über Finder / Dock. Prüfe auch die vorhandenen Daten. Eine nicht mögliche Prüfung bedeutet weder „ersetzt“ noch „repariert“: Laufwerk verbinden und erneut versuchen. Scans erhalten die Sicherungen. Eine noch startende App kannst du später behandeln; ihr Start beweist keine wiederhergestellte Originalsignatur.
+
+### 4. Optional: Daten weiter migrieren
+
+Wähle nach der Reparatur unter App-Daten das Verzeichnis und „Migrieren“. AppPorts prüft das Ziel und nutzt für Container [APFS-Mount-Migration](/de/datamigrae/mount-migration), ohne die Signatur zu ersetzen. Aktuell ist ein **unverschlüsseltes externes APFS-Laufwerk** erforderlich. Du kannst ein anderes Laufwerk wählen oder die Daten lokal lassen. Erlaube den Zugriff auf Wechselmedien, wenn macOS danach fragt, und verbinde das Laufwerk vor der App-Nutzung. Siehe [APFS vorbereiten](/de/why-apfs#what-to-do).
+
 ## Wer ist betroffen?
 
 | Punkt | Beschreibung |
 |------|------|
 | Auslöser | Upgrade auf macOS 27 |
 | Betroffene Apps | Apps, deren Daten unter `~/Library/Containers/` oder `~/Library/Group Containers/` migriert und mit Ad-hoc neu signiert wurden; außerdem manuell per Kontextmenü neu signierte Sandbox-Apps |
 | Typisches Verhalten | Doppelklick im Finder / Dock zeigt keine Reaktion; das Symbol erscheint kurz und verschwindet ohne Fehlermeldung. Nicht jede neu signierte App ist betroffen: QQ Music läuft a
```

**File**: `User_docs/docs/en/macos-27.md` (modified, +62/-67)
```diff
@@ -5,126 +5,121 @@ outline: deep
 # Upgrading to macOS 27
 
 ::: tip The key point
-If you migrated container data for an app such as WeChat with AppPorts and agreed to re-sign it, the app **may** quit immediately after upgrading to macOS 27. WeChat does; QQ Music still opened in our tests. **The data is not damaged**, and you do not need to migrate it again. Restore the data locally and reinstall the app from an official source. If you then want the data on an external drive, use the new [mount migration](/en/datamigrae/mount-migration).
+If an app such as WeChat stopped opening from Finder or the Dock after you agreed to re-sign it in an older or test version of AppPorts, follow the repair steps below. Restore old container links first, then restore the original app or reinstall from an official source. **Keep the data directories and do not re-sign again.** A signature error alone does not mean your data is damaged.
 :::
 
+## Repair
+
+Click **Repair** directly in the app’s row, or choose “Show repair steps” from its context menu. Terminal commands are not required. This guide describes the current development version; the manual steps also apply if your version has no repair panel. Connect the original external drive, quit the affected app completely, and keep your data and backups.
+
+::: tip Automatic re-signing at login
+The current development version disables automatic re-signing at login on macOS 27 or later and stops and removes the old login task. If cleanup is incomplete, retry in Settings.
+
+**Update and open AppPorts once before upgrading macOS** so the installed background task receives the version check. Downloading the new version without opening it does not update the old task.
+:::
+
+### 1. Restore container data migrated through old links
+
+If the panel finds container directories linked to the external drive, click “Restore all”. Otherwise skip this step. The manual route is Data Directories → App Data → select the app → restore the linked container directories. Directories already using APFS mount migration do not need restoration just to repair a signature.
+
+### 2. Restore the original app or reinstall officially
+
+- **Full original-app backup available:** use “Restore Original Signature”. This restores the backed-up app version and its signature, including when the real app is on the external drive. Moving it back first is unnecessary. AppPorts checks that the current app matches the backup; an updated or changed app requires a matching official original.
+- **Only a legacy identity record:** supply an official original `.app` of the same version, or reinstall from the App Store or developer’s website. An identity name alone cannot recreate a developer signature.
+- **Installing over an app on the external drive:** first use “Move back” so the installer replaces the real local app rather than just its launcher.
+
+**Do not remove the container data directories.** Keep a separate backup of important data. Continued access to chat history and login sessions also depends on app versions, permissions, and the data itself. See [Signature Backups and Restoration](/en/datamigrae/resign#signature-backups-and-restoration).
+
+### 3. Check again and open from Finder or the Dock
+
+Click “Check again”, then open the app from Finder or the Dock and confirm that its data is accessible. “Signature check unavailable” is not a confirmed replacement or a successful repair; reconnect the drive and retry. Scanning preserves recovery backups. An app that still opens can be handled later, but opening successfully does not prove its original signature has been restored.
+
+### 4. Optional: continue migrating the data
+
+After repair, select the data in App Data and click “Migrate”. AppPorts checks the destination and uses [APFS mount migration](/en/datamigrae/mount-migration) for container data, preserving the app’s signature. The current method requires an **unencrypted APFS external drive**. You can choose another drive or leave the data on this Mac. Allow removable-volume access if macOS requests it, and connect the drive before using the app. See [APFS preparation](/en/why-apfs#what-to-do).
+
 ## Who Is Affected?
 
 | Item | Description |
 |------|-------------|
 | Trigger | Upgrading to macOS 27 |
 | Affected apps | Apps whose `~/Library/Containers/` or `~/Library/Group Containers/` data was migrated and which were re-signed Ad-hoc; or sandboxed apps manually re-signed from the right-click menu |
 | Typical symptom | Opening from Finder / Dock does nothing, or the icon appears briefly and disappears without an error dialog. Not all re-signed apps behave this way: QQ Music runs normally on the same Mac with 27 |
-| Data | Intact, including chat history and login sessions |
+| Data | A signature error alone does not establish data corruption; preserve the original data and backups |
 | Confirmed case | WeChat 4.1.15, macOS 27.0 (26A428) |
 
 Re-signing removes the app's sandbox identity. When 
```

**File**: `User_docs/docs/es/macos-27.md` (modified, +62/-67)
```diff
@@ -5,126 +5,121 @@ outline: deep
 # Guía de actualización a macOS 27
 
 ::: tip Lo esencial
-Si migró datos de contenedores de WeChat u otras apps con AppPorts y aceptó volver a firmarlas, tras actualizar a macOS 27 **pueden** cerrarse inmediatamente al hacer doble clic. Ocurre con WeChat; QQ Music y otras siguen abriéndose en las pruebas. **Los datos no están dañados** y no hay que migrarlos de nuevo. Restáurelos en el Mac y reinstale la app desde una fuente oficial. Para volver a guardarlos en el disco externo, use la nueva [migración por montaje](/es/datamigrae/mount-migration).
+Si WeChat u otra app deja de abrirse desde Finder / Dock en macOS 27 tras aceptar una nueva firma en una versión antigua o de prueba de AppPorts, siga la reparación de abajo. Restaure los enlaces de contenedores antiguos y después la app original, o reinstale su versión oficial. **No borre las carpetas de datos ni vuelva a firmar la app.** Un error de firma no demuestra que los datos estén dañados.
 :::
 
+## Reparación
+
+Pulse **«Reparar»** directamente en la fila de la app, o «Ver los pasos de reparación» en su menú contextual. No necesita comandos de Terminal. Esta guía corresponde a la versión en desarrollo; las versiones sin panel también permiten seguir los pasos manuales. Conecte el disco original, cierre completamente la app y conserve datos y copias de seguridad.
+
+::: tip Firma automática al iniciar sesión
+La versión de desarrollo actual desactiva la firma automática al iniciar sesión en macOS 27 o posterior, y detiene y elimina la tarea anterior. Si la limpieza no se completa, vuelve a intentarlo en Ajustes.
+
+**Actualiza y abre AppPorts una vez antes de actualizar macOS** para que la tarea en segundo plano instalada reciba la comprobación de versión. Descargar la nueva versión sin abrirla no actualiza la tarea anterior.
+:::
+
+### 1. Restaurar los datos trasladados mediante enlaces antiguos
+
+Si el panel encuentra enlaces de contenedores hacia el disco externo, pulse «Restaurar todo». Si no existen, omita este paso. Ruta manual: Directorios de datos → Datos de apps → seleccionar la app → restaurar los contenedores enlazados. Los datos que ya usan montaje APFS no necesitan volver al Mac solo para reparar la firma.
+
+### 2. Restaurar la app original o reinstalar oficialmente
+
+- **Copia completa de la app original:** use «Restaurar firma original». Puede restaurar directamente la app real del disco externo, sin moverla antes al Mac. AppPorts comprueba que la app actual coincida con la copia. Si se ha actualizado o modificado, necesita un original oficial coincidente.
+- **Solo un registro antiguo de identidad:** seleccione una `.app` oficial de la misma versión o reinstale desde App Store / la web del desarrollador. El nombre del certificado no puede reconstruir la firma.
+- **Instalación encima de una app externa:** devuélvala primero al Mac para que el instalador no sustituya únicamente el lanzador local.
+
+**No borre las carpetas de datos de contenedores.** Guarde aparte una copia de los datos importantes. El acceso al historial y a las sesiones también depende de versiones, permisos y estado de los datos. Véase [Copias y restauración de firmas](/es/datamigrae/resign).
+
+### 3. Comprobar de nuevo y abrir desde Finder / Dock
+
+Pulse «Comprobar de nuevo» y después abra la app desde Finder / Dock y verifique sus datos. Una comprobación no disponible no significa firma sustituida ni reparación completa: conecte el disco y repita. Los análisis conservan las copias. Puede atender más tarde una app que aún se abre, pero abrirse no demuestra que haya recuperado su firma original.
+
+### 4. Opcional: continuar la migración de datos
+
+Tras reparar, seleccione el directorio en Datos de apps y pulse «Migrar». AppPorts comprueba el destino y usa [migración APFS mediante montaje](/es/datamigrae/mount-migration) para los contenedores, conservando la firma. Actualmente se requiere un **disco externo APFS sin cifrar**. Puede elegir otro disco o dejar los datos en el Mac. Permita el acceso a volúmenes extraíbles si macOS lo solicita y conecte el disco antes de usar la app. Véase [Preparar APFS](/es/why-apfs#what-to-do).
+
 ## A quién afecta
 
 | Elemento | Explicación |
 |------|------|
 | Desencadenante | Actualización a macOS 27 |
 | Apps afectadas | Apps cuyos datos de `~/Library/Containers/` o `~/Library/Group Containers/` se migraron y que se volvieron a firmar con Ad-hoc, o apps aisladas firmadas manualmente desde el menú contextual |
 | Síntomas habituales | Doble clic en Finder / Dock sin respuesta; el icono aparece y desaparece sin diálogo de error. No ocurre con todas las apps: QQ Music funciona en el mismo Mac con 27 |
-| Datos | Intactos, incluidos historial y sesión |
+| Datos | Un error de firma no demuestra daños en los datos; conserve los originales y sus copias |
 | Caso confirmado | WeChat 4.1.15, macOS 27.0 (26A428) |
 
 Volver a firmar elimina la identidad aislada. Cuando macOS 27 comprueba si la app 
```

**File**: `User_docs/docs/fr/macos-27.md` (modified, +62/-67)
```diff
@@ -5,126 +5,121 @@ outline: deep
 # Guide de mise à niveau vers macOS 27
 
 ::: tip L’essentiel
-Si vous avez migré les données de conteneur de WeChat ou d’une autre application avec AppPorts et accepté la re-signature, ces applications **peuvent** quitter immédiatement après un double-clic sous macOS 27. C’est le cas de WeChat ; QQ Music et d’autres s’ouvrent encore lors des essais. **Les données ne sont pas endommagées** et il n’est pas nécessaire de les migrer de nouveau. Restaurez-les localement, puis réinstallez l’application depuis une source officielle. Pour les remettre ensuite sur le disque externe, utilisez la nouvelle [migration par montage](/fr/datamigrae/mount-migration).
+Si WeChat ou une autre app ne s’ouvre plus depuis Finder / Dock sous macOS 27 après une re-signature acceptée dans une ancienne version ou une version de test d’AppPorts, commencez par la réparation ci-dessous. Restaurez les anciens liens de conteneur, puis l’app d’origine, ou réinstallez sa version officielle. **Ne supprimez pas les dossiers de données et ne re-signez pas à nouveau.** Une erreur de signature ne prouve pas que les données sont endommagées.
 :::
 
+## Réparation
+
+Cliquez directement sur **« Réparer »** dans la ligne de l’app, ou choisissez « Voir les étapes de réparation » dans le menu contextuel. Aucune commande Terminal n’est nécessaire. Ce guide décrit la version en développement ; les étapes manuelles conviennent aussi aux versions sans panneau de réparation. Branchez le disque d’origine, quittez complètement l’app et conservez données et sauvegardes.
+
+::: tip Re-signature automatique à l’ouverture de session
+La version de développement actuelle désactive la re-signature automatique à l’ouverture de session sous macOS 27 ou version ultérieure, puis arrête et supprime l’ancienne tâche. Si le nettoyage est incomplet, réessayez dans les réglages.
+
+**Mettez à jour et ouvrez AppPorts une fois avant de mettre macOS à niveau**, afin d’ajouter la vérification de version à la tâche d’arrière-plan installée. Télécharger la nouvelle version sans l’ouvrir ne met pas à jour l’ancienne tâche.
+:::
+
+### 1. Restaurer les données migrées par d’anciens liens
+
+Si le panneau trouve des liens de conteneur vers le disque externe, cliquez sur « Tout restaurer ». Sinon, passez cette étape. Manuellement : Répertoires de données → Données des apps → sélectionner l’app → restaurer ses conteneurs liés. Une migration APFS par montage n’a pas besoin d’être annulée pour réparer uniquement la signature.
+
+### 2. Restaurer l’app d’origine ou réinstaller la version officielle
+
+- **Sauvegarde complète de l’app d’origine :** utilisez « Restaurer la signature d’origine ». L’app réelle sur le disque externe peut être restaurée directement, sans revenir d’abord sur le Mac. AppPorts vérifie que l’app actuelle correspond à la sauvegarde. Une app mise à jour ou modifiée nécessite un original officiel correspondant.
+- **Ancien enregistrement d’identité seulement :** sélectionnez une `.app` officielle de même version ou réinstallez depuis l’App Store / le site du développeur. Le nom du certificat ne suffit pas à recréer une signature.
+- **Réinstallation par-dessus une app externe :** ramenez d’abord l’app sur le Mac pour ne pas remplacer uniquement son lanceur local.
+
+**Ne supprimez pas les dossiers de données de conteneur.** Sauvegardez séparément les données importantes. L’accès aux conversations et aux sessions dépend aussi des versions, des autorisations et des données. Voir [Sauvegarde et restauration des signatures](/fr/datamigrae/resign).
+
+### 3. Vérifier à nouveau et ouvrir depuis Finder / Dock
+
+Cliquez sur « Vérifier à nouveau », puis ouvrez l’app depuis Finder / Dock et vérifiez ses données. Une vérification impossible ne signifie ni signature remplacée ni réparation terminée : rebranchez le disque et réessayez. Les analyses conservent les sauvegardes. Une app qui s’ouvre encore peut être traitée plus tard ; cela ne prouve pas le retour de sa signature d’origine.
+
+### 4. Facultatif : poursuivre la migration des données
+
+Après réparation, sélectionnez le répertoire dans Données des apps et cliquez sur « Migrer ». AppPorts vérifie la destination et utilise la [migration APFS par montage](/fr/datamigrae/mount-migration) pour les conteneurs, en conservant la signature. Il faut actuellement un **disque externe APFS non chiffré**. Vous pouvez choisir un autre disque ou garder les données sur le Mac. Autorisez l’accès aux volumes amovibles si macOS le demande et branchez le disque avant d’utiliser l’app. Voir [Préparer APFS](/fr/why-apfs#what-to-do).
+
 ## Qui est concerné ?
 
 | Élément | Explication |
 |------|------|
 | Déclencheur | Mise à niveau vers macOS 27 |
 | Applications concernées | Applications dont les données de `~/Library/Containers/` ou `~/Library/Group Containers/` ont été migrées puis re-signées avec Ad-hoc, ou applications en bac à sable re-signées manuellement par le menu contextuel |
 | Symptômes t
```

**File**: `User_docs/docs/ja/macos-27.md` (modified, +62/-67)
```diff
@@ -5,126 +5,121 @@ outline: deep
 # macOS 27 へのアップグレード
 
 ::: tip 要点
-AppPorts で WeChat などのコンテナデータを移行し、そのとき再署名に同意した場合、macOS 27 へのアップグレード後に、ダブルクリックしてもアプリがすぐ終了する**可能性があります**。WeChat では発生し、QQ Music などは実測では引き続き開けました。**データは壊れていません**。移行をやり直す必要もありません。データをローカルに復元し、公式の配布元からアプリを再インストールすれば復旧できます。その後も外部ドライブに置きたい場合は、新しい[マウント移行](/ja/datamigrae/mount-migration)を使ってください。
+旧版やテスト版の AppPorts で再署名を許可した後、macOS 27 で WeChat などが Finder / Dock から開けなくなった場合は、以下の修復手順に進んでください。古いコンテナリンクを復元してから、元のアプリを復元するか公式版を再インストールします。**データフォルダを削除したり、再び署名し直したりしないでください。** 署名エラーだけでデータ破損とは判断できません。
 :::
 
+## 修復
+
+アプリ一覧の **「修復」** を直接クリックするか、右クリックで「修復手順を表示」を選びます。ターミナル操作は不要です。この説明は現在の開発版に対応しています。修復パネルがない旧版でも、以下の手動手順を利用できます。元の外部ドライブを接続し、アプリを完全に終了して、データとバックアップを保管してください。
+
+::: tip ログイン時の自動再署名
+現在の開発版では、macOS 27 以降でログイン時の自動再署名を無効にし、以前のログインタスクを停止して削除します。処理が完了していない場合は、設定画面から再試行できます。
+
+**macOS をアップグレードする前に、AppPorts を更新して一度開いてください。** インストール済みのバックグラウンドタスクにバージョンチェックが追加されます。新版をダウンロードしただけでは、以前のタスクは更新されません。
+:::
+
+### 1. 古いリンクで移行したコンテナデータを復元する
+
+外部ドライブへのコンテナリンクが見つかった場合は「すべて復元」を選びます。なければこの手順は不要です。手動では「データディレクトリ」→「アプリデータ」でアプリを選び、リンク済みのコンテナを復元します。APFS マウント移行済みのデータは、署名修復のためだけに戻す必要はありません。
+
+### 2. 元のアプリを復元するか公式版を再インストールする
+
+- **完全な元アプリのバックアップがある場合：**「元の署名を復元」を使います。外部ドライブ上の実際のアプリも直接復元できます。先にローカルへ戻す必要はありません。AppPorts は現在のアプリとバックアップの一致を確認します。更新や内容の変更がある場合は、対応する公式の元アプリが必要です。
+- **古い署名情報だけの場合：** 同じバージョンの公式 `.app` を指定するか、App Store / 開発元サイトから再インストールします。証明書名だけでは元の署名は再作成できません。
+- **外部アプリに上書きインストールする場合：** 先に「ローカルに戻す」を使い、ローカルの起動用アプリだけが置き換わる状態を避けます。
+
+**コンテナのデータフォルダは削除しないでください。** 重要なデータは別途バックアップします。履歴やログイン状態の利用可否は、バージョン、権限、データの状態にも依存します。[署名のバックアップと復元](/ja/datamigrae/resign)も参照してください。
+
+### 3. 再確認して Finder / Dock から開く
+
+「再確認」で署名を確認した後、Finder / Dock から開き、元のデータが使えるか確認します。「署名を確認できません」は、置換済みとも修復済みとも判断できない状態です。ドライブを接続して再試行してください。スキャンで復元用バックアップは削除されません。現在開けるアプリは後で対応できますが、それだけで元の署名が復元されたとはいえません。
+
+### 4. 任意：データの移行を続ける
+
+修復後、「アプリデータ」で対象を選び「移行」をクリックします。AppPorts は保存先を確認し、コンテナには署名を保持する [APFS マウント移行](/ja/datamigrae/mount-migration)を使用します。現在は**暗号化されていない APFS 外部ドライブ**が必要です。別のドライブを選ぶか、ローカルに残すこともできます。macOS がリムーバブルボリュームへのアクセスを求めたら許可し、以後はアプリ使用前にドライブを接続してください。[APFS の準備](/ja/why-apfs#what-to-do)を参照してください。
+
 ## 影響を受けるケース
 
 | 項目 | 説明 |
 |------|------|
 | 発生条件 | macOS 27 へのアップグレード |
 | 対象アプリ | `~/Library/Containers/` または `~/Library/Group Containers/` のデータを移行し、Ad-hoc 再署名を行ったアプリ。または右クリックから手動で再署名したサンドボックスアプリ |
 | 典型的な症状 | Finder / Dock から開いても反応せず、アイコンが一瞬表示されて消え、エラーダイアログも出ない。ただし、再署名したすべてのアプリで起きるわけではなく、同じ macOS 27 で QQ Music は正常に動作した |
-| データ | チャット履歴、ログイン状態を含めて正常 |
+| データ | 署名エラーだけでデータ破損とは判断できません。元データとバックアップを保管してください |
 | 確認済みの例 | WeChat 4.1.15、macOS 27.0 (26A428) |
 
 再署名によってアプリのサンドボックス ID が取り除かれたことが原因です。macOS 27 が「このアプリにこのコンテナを使う資格があるか」を確認するとき、システムに元の署名の許可記録が残っていると、新しい署名が一致せず拒否されます。WeChat のログには `Failed to match existing code requirement` と出ます。QQ Music など、古い記録がないアプリは現在は許可されますが、キーチェーンのログイン状態など、失われたエンタイトルメントは同様に戻りません。仕組みは[コンテナデータ、サンドボックスと署名 ID](/ja/datamigrae/container-identity)を参照してください。
 
+元の開発者署名のバックアップ記録があり、実際のアプリが現在 Ad-hoc と確認できた場合にだけ署名の置換を表示します。タイムアウトやドライブへのアクセス失敗は再確認が必要です。元から Ad-hoc のアプリ、移行済みであること、ローカルの起動用アプリは、再署名が必要な根拠にはなりません。
+
+## 避けるべき対処
+
+| 対処 | 解決しない理由 |
+|------|-----------|
+| データをローカルに戻すだけで修復完了とする | 復元は外部データを読めない問題だけを解決し、署名は直さない。再署名したアプリは復元後もすぐ終了する |
+| 「Resign This App」をもう一度実行 | 再署名自体が原因であり、エンタイトルメントを再び消すだけ |
+| アプリにフルディスクアクセスを付与 | コンテナの検証を回避できる場合もあるが、キーチェーンの権限は失われており、ログイン状態の問題は残る。一時的な手段にすぎない |
+| ターミナルから開ければ修復済みと判断 | ターミナルの権限を借りて起動しているため、修復できたように見えるだけ。Finder / Dock から開けるかで判断する |
+
 ## アップグレード前の確認
 
-次のスクリプトで、AppPorts が署名を置き換えたアプリを一覧にできます。表示されたアプリは、アップグレード後に問題が起きる可能性があります。
+まず AppPorts の「署名置換済み」を確認し、[修復](#修復)に進みます。表示がないことは macOS 27 対応の保証ではありません。補助スクリプトは古いバックアップに残るアクセス可能なパスだけを確認するため、移動済みアプリ、未接続ドライブ、起動用アプリでは見落とすことがあります。
 
+::: details 詳細：任意の技術的な確認
 ```bash
 BACKUP_DIR="$HOME/Library/Application Support/AppPorts/signature-backups"
 for plist in "$BACKUP_DIR"/*.plist; do
   [ -f "$plist" ] || continue
   original=$(/usr/libexec/PlistBuddy -c "Print :signingIdentity" "$plist" 2>/dev/null)
   app=$(/usr/libexec/PlistBuddy -c "Print :originalPath" "$plist" 2>/dev/null)
-  case "$original" in ""|ad-hoc) continue ;; esac   # 本来就是 ad-hoc 的跳过
+  case "$original" in ""|ad-hoc) continue ;; esac
   [ -d "$app" ] || continue
   if codesign -dv "$app" 2>&1 | grep -q "Signature=adhoc"; then
-    printf "%s\n    原始签名: %s\n" "$app" "$original"
+    printf "%s\n    %s\n" "$app" "$original"
   fi
 done
 ```
-
-アップグレード前に、下の[修復](#修復)を済ませることをお勧めします。少なくとも一覧を控えておけば、アップグレード後にどのアプリを確認すべきか分かります。
+:::
 
 ## アップグレード後の症状確認
 
-```bash
-# 1. 签名（出现 Signature=adhoc 且 TeamIdentifier=not set 即已被重签名）
-codesign -dv --verbose=4 /Applications/WeChat.app 2>&1 | grep -E "Authority|TeamIdentifier|Signature"
-
-# 2. 复现并看系统日志
-open -a /Applications/WeChat.app; sleep 3
-log show --last 1m --style compact 2>/dev/null | grep -i "rejected approval request"
-```
-
-2 番目の手順で `kTCCServiceSystemPolicyAppData ... denied` が表示されれば確認できます。より詳しい確認表は[コンテナデータ、サンドボックスと署名 ID](/ja/datamigrae/container-identity#自分で確認する)を参照してください。
-
-## 修復
-
-AppPor
```

**File**: `User_docs/docs/ko/macos-27.md` (modified, +62/-67)
```diff
@@ -5,126 +5,121 @@ outline: deep
 # macOS 27 업그레이드 안내
 
 ::: tip 핵심 내용
-AppPorts로 WeChat 등의 컨테이너 데이터를 옮기며 재서명에 동의했다면 macOS 27로 업그레이드한 뒤 앱이 이중 클릭 직후 종료될 **수 있습니다**. WeChat은 해당되지만 QQ Music 등은 시험에서 계속 열렸습니다. **데이터는 손상되지 않았으며** 다시 마이그레이션할 필요도 없습니다. 데이터를 이 Mac으로 복원하고 공식 경로에서 앱을 재설치하면 복구됩니다. 이후에도 외장 드라이브에 두려면 새 [마운트 마이그레이션](/ko/datamigrae/mount-migration)을 사용하세요.
+이전 버전이나 테스트 버전의 AppPorts에서 재서명에 동의한 뒤 macOS 27에서 WeChat 등이 Finder / Dock으로 열리지 않는다면 아래 복구 절차를 따르세요. 기존 컨테이너 링크를 먼저 복원하고 원본 앱을 복구하거나 공식 버전을 다시 설치합니다. **데이터 폴더를 삭제하거나 다시 재서명하지 마세요.** 서명 오류만으로 데이터 손상을 판단할 수는 없습니다.
 :::
 
+## 복구
+
+앱 목록 행의 **‘복구’** 버튼을 누르거나 우클릭 메뉴에서 ‘복구 단계 보기’를 선택하세요. 터미널 명령은 필요하지 않습니다. 이 안내는 현재 개발 버전을 기준으로 합니다. 이전 버전에 복구 패널이 없어도 아래 수동 절차를 사용할 수 있습니다. 원래 외장 드라이브를 연결하고 앱을 완전히 종료한 뒤 데이터와 백업을 보관하세요.
+
+::: tip 로그인 시 자동 재서명
+현재 개발 버전은 macOS 27 이상에서 로그인 시 자동 재서명을 비활성화하고 기존 로그인 작업을 중지한 뒤 제거합니다. 처리가 완료되지 않으면 설정에서 다시 시도할 수 있습니다.
+
+**macOS를 업그레이드하기 전에 AppPorts를 업데이트하고 한 번 실행하세요.** 설치된 백그라운드 작업에 버전 확인 기능이 적용됩니다. 새 버전을 다운로드만 하고 실행하지 않으면 기존 작업은 업데이트되지 않습니다.
+:::
+
+### 1. 기존 링크로 옮긴 컨테이너 데이터 복원
+
+외장 드라이브를 가리키는 컨테이너 링크가 있으면 ‘모두 복원’을 누르세요. 없으면 건너뜁니다. 수동 경로는 ‘데이터 디렉터리’ → ‘앱 데이터’ → 앱 선택 → 연결된 컨테이너 복원입니다. 이미 APFS 마운트 마이그레이션을 사용 중인 디렉터리는 서명 복구만을 위해 되돌릴 필요가 없습니다.
+
+### 2. 원본 앱 복구 또는 공식 버전 재설치
+
+- **전체 원본 앱 백업이 있는 경우:** ‘원본 서명 복원’을 사용합니다. 외장 드라이브의 실제 앱도 직접 복구할 수 있어 먼저 Mac으로 옮길 필요가 없습니다. AppPorts는 현재 앱과 백업이 일치하는지 확인합니다. 앱이 업데이트되었거나 내용이 달라졌다면 일치하는 공식 원본이 필요합니다.
+- **이전 서명 기록만 있는 경우:** 동일 버전의 공식 `.app`을 선택하거나 App Store / 개발자 웹사이트에서 다시 설치하세요. 인증서 이름만으로 개발자 서명을 복원할 수는 없습니다.
+- **외장 앱에 덮어쓰기로 설치하는 경우:** 먼저 ‘로컬로 이동’을 실행해 로컬 실행기만 덮어쓰지 않도록 합니다.
+
+**컨테이너 데이터 폴더를 삭제하지 마세요.** 중요한 데이터는 별도로 백업하세요. 채팅 기록과 로그인 유지 여부는 앱 버전, 권한, 데이터 상태에도 영향을 받습니다. [서명 백업과 복원](/ko/datamigrae/resign)을 참고하세요.
+
+### 3. 다시 확인하고 Finder / Dock에서 실행
+
+‘다시 확인’으로 서명을 확인한 뒤 Finder / Dock에서 열어 기존 데이터에 접근할 수 있는지 확인합니다. ‘서명을 확인할 수 없음’은 교체나 복구 완료를 뜻하지 않습니다. 드라이브를 연결한 뒤 재시도하세요. 검사 중 복구 백업은 삭제되지 않습니다. 지금 열리는 앱은 나중에 처리할 수 있지만, 실행 성공이 원본 서명 복원을 의미하지는 않습니다.
+
+### 4. 선택 사항: 데이터 마이그레이션 계속하기
+
+복구 후 ‘앱 데이터’에서 디렉터리를 선택하고 ‘마이그레이션’을 누르세요. AppPorts는 저장 위치를 확인하고 컨테이너에 [APFS 마운트 마이그레이션](/ko/datamigrae/mount-migration)을 사용해 서명을 유지합니다. 현재 **암호화되지 않은 APFS 외장 드라이브**가 필요합니다. 다른 드라이브를 선택하거나 데이터를 Mac에 둘 수도 있습니다. macOS가 이동식 볼륨 접근을 요청하면 허용하고, 이후 앱 사용 전에 드라이브를 연결하세요. [APFS 준비](/ko/why-apfs#what-to-do)를 참고하세요.
+
 ## 영향을 받는 경우
 
 | 항목 | 설명 |
 |------|------|
 | 발생 조건 | macOS 27로 업그레이드 |
 | 대상 앱 | `~/Library/Containers/` 또는 `~/Library/Group Containers/` 데이터를 옮기고 Ad-hoc 재서명한 앱, 또는 우클릭 메뉴로 수동 재서명한 샌드박스 앱 |
 | 대표 증상 | Finder / Dock에서 이중 클릭해도 반응이 없고 아이콘만 잠깐 나타났다 사라짐. 오류 창은 없음. 모든 재서명 앱이 그런 것은 아니며 같은 27에서 QQ Music은 정상 실행 |
-| 데이터 | 채팅 기록과 로그인 상태를 포함해 온전함 |
+| 데이터 | 서명 오류만으로 데이터 손상을 판단할 수 없습니다. 원본 데이터와 백업을 보관하세요 |
 | 확인된 사례 | WeChat 4.1.15, macOS 27.0 (26A428) |
 
 간단히 말해 재서명이 앱의 샌드박스 신원을 제거했기 때문입니다. macOS 27이 앱의 컨테이너 접근 자격을 확인할 때 이전 서명의 권한 기록이 이미 저장돼 있으면 새 서명이 일치하지 않아 거부됩니다. WeChat 로그에는 `Failed to match existing code requirement`가 나옵니다. QQ Music처럼 이전 기록이 없는 앱은 현재 허용되지만 키체인 로그인 상태 등 이미 잃은 권한이 복구되는 것은 아닙니다. 원리는 [컨테이너 데이터, 샌드박스와 서명 신원](/ko/datamigrae/container-identity)을 참고하세요.
 
+원래 개발자 서명의 백업 기록이 있고 실제 앱의 현재 서명이 Ad-hoc으로 확인될 때만 교체로 표시합니다. 시간 초과나 외장 앱 읽기 실패는 재검사가 필요합니다. 원래 Ad-hoc인 앱, 마이그레이션 여부 또는 로컬 실행기만으로 재서명이 필요하다고 판단하지 않습니다.
+
+## 도움이 되지 않는 방법
+
+| 방법 | 효과가 없는 이유 |
+|------|-----------|
+| 데이터만 복원하고 해결됐다고 생각하기 | 복원은 외장 데이터 접근 문제만 해결하며 서명을 고치지 않음. 재서명한 앱은 계속 즉시 종료됨 |
+| 다시 재서명하기 | 재서명 자체가 원인이므로 권한만 다시 지움 |
+| 앱에 전체 디스크 접근 권한 부여 | 컨테이너 검사를 우회할 수 있지만 키체인 권한이 사라져 로그인 상태는 여전히 문제. 임시 수단일 뿐 |
+| 터미널에서 열린다고 해결됐다고 판단 | 터미널 권한을 빌려 실행된 것. Finder / Dock 이중 클릭을 기준으로 판단 |
+
 ## 업그레이드 전 확인
 
-다음 스크립트는 AppPorts가 서명을 교체한 앱을 나열합니다. 출력된 앱은 업그레이드 후 문제가 생길 수 있습니다.
+먼저 AppPorts의 ‘서명 교체됨’ 표시를 확인하고 [복구](#복구) 절차를 따르세요. 표시가 없다고 macOS 27 호환성이 보장되지는 않습니다. 보조 스크립트는 이전 백업의 접근 가능한 경로만 확인하므로 이동된 앱, 연결되지 않은 드라이브, 실행기 경로는 누락될 수 있습니다.
 
+::: details 고급: 선택적인 기술 검사
 ```bash
 BACKUP_DIR="$HOME/Library/Application Support/AppPorts/signature-backups"
 for plist in "$BACKUP_DIR"/*.plist; do
   [ -f "$plist" ] || continue
   original=$(/usr/libexec/PlistBuddy -c "Print :signingIdentity" "$plist" 2>/dev/null)
   app=$(/usr/libexec/PlistBuddy -c "Print :originalPath" "$plist" 2>/dev/null)
-  case "$original" in ""|ad-hoc) continue ;; esac   # 本来就是 ad-hoc 的跳过
+  case "$original" in ""|ad-hoc) continue ;; esac
   [ -d "$app" ] || continue
   if codesign -dv "$app" 2>&1 | grep -q "Signature=adhoc"; then
-    printf "%s\n    原始签名: %s\n" "$app" "$original"
+    printf "%s\n    %s\n" "$app" "$original"
   fi
 done
 ```
-
-업그레이드 전에 아래 [복구](#복구)를 마치는 것이 좋습니다. 최소한 목록을 기록해 두면 업그레이드 후 무엇을 확인해야 하는지 알 수 있습니다.
+:::
 
 ## 업그레이드 후 증상 확인
 
-```bash
-# 1. 签名（出现 Signature=adhoc 且 TeamIdentifier=not set 即已被重签名）
-codesign -dv --verbose=4 /Applications/WeChat.app 2>&1 | grep -E "Authority|TeamIdentifier|Signature"
-
-# 2. 复现并看系统日志
-open -a /Applications/WeChat.app; sleep 3
-log show --last 1m --style compact 2>/dev/null | grep -i "rejected approval request"
-```
-
-2단계에 `kTCCServiceSystemPo
```

**File**: `User_docs/docs/macos-27.md` (modified, +87/-75)
```diff
@@ -4,131 +4,143 @@ outline: deep
 
 # macOS 27 升级说明
 
-::: tip 一句话结论
-用 AppPorts 迁移过微信等应用的容器数据、并且当时选了「同意重签名」的用户，升级到 macOS 27 后这些应用**可能**双击秒退（微信会，QQ 音乐等实测仍能打开）。**数据没有坏**，也不需要重新迁移。把数据还原回本地、从官方渠道重装应用即可恢复；之后想继续放外置盘，用新的[挂载迁移](/datamigrae/mount-migration)。
+::: tip 应用打不开？先按下面的步骤修复
+如果你曾在 AppPorts 的旧版或测试版中同意重签名，升级到 macOS 27 后，微信等应用可能无法从 Finder / Dock 打开。先还原旧方式迁移的容器数据，再恢复原始签名或从官方渠道重装。**不要删除数据目录，也不要再次重签名。** 签名错误本身不代表聊天记录等数据已经损坏。
 :::
 
-## 谁会受影响
+## 修复
 
-| 项目 | 说明 |
-|------|------|
-| 触发条件 | 升级到 macOS 27 |
-| 受影响应用 | 迁移过 `~/Library/Containers/` 或 `~/Library/Group Containers/` 数据，且执行过 Ad-hoc 重签名的应用；或者手动右键重签名过的沙盒应用 |
-| 典型表现 | Finder / Dock 双击无反应，图标闪一下就消失，没有报错弹窗。并非所有重签名过的应用都会这样：QQ 音乐在同一台 27 上正常运行 |
-| 数据 | 完好，包括聊天记录和登录态 |
-| 已确认案例 | 微信 4.1.15，macOS 27.0 (26A428) |
+在 AppPorts 应用列表中，找到带「签名已替换」标记的应用，直接点行内的 **「修复」**；也可以右键选择「查看修复步骤」。不需要先运行终端命令。
 
-原因简单说：重签名把应用的沙盒身份拆掉了，macOS 27 核对"这个应用有没有资格碰这个容器"时，如果系统里已经存着这个应用原来签名的授权记录，新签名对不上就被拒绝（微信的日志：`Failed to match existing code requirement`）。没有旧记录的应用（如 QQ 音乐）目前能放行，但钥匙串登录态等丢失的授权同样找不回来。原理见[容器数据、沙盒与签名身份](/datamigrae/container-identity)。
+本文的新引导对应当前开发版本。使用较早版本、还没有修复面板时，也可以按下面的方法手动处理。开始前连接原来的外置盘，完全退出要修复的应用，并保留现有数据和备份。
 
-## 还没升级：先检查
+::: tip 开机自动重签名
+当前开发版会在 macOS 27 及以上停用「开机自动重签名」，停止并移除旧登录任务；关闭未完成时，可在设置页重试。
 
-下面的脚本会列出被 AppPorts 替换过签名的应用。有输出的都是升级后可能出问题的对象。
+**升级系统前，请先更新并打开一次 AppPorts**，让已安装的后台任务获得版本保护。只下载新版、尚未打开时，旧后台任务不会自动更新。
+:::
 
-```bash
-BACKUP_DIR="$HOME/Library/Application Support/AppPorts/signature-backups"
-for plist in "$BACKUP_DIR"/*.plist; do
-  [ -f "$plist" ] || continue
-  original=$(/usr/libexec/PlistBuddy -c "Print :signingIdentity" "$plist" 2>/dev/null)
-  app=$(/usr/libexec/PlistBuddy -c "Print :originalPath" "$plist" 2>/dev/null)
-  case "$original" in ""|ad-hoc) continue ;; esac   # 本来就是 ad-hoc 的跳过
-  [ -d "$app" ] || continue
-  if codesign -dv "$app" 2>&1 | grep -q "Signature=adhoc"; then
-    printf "%s\n    原始签名: %s\n" "$app" "$original"
-  fi
-done
-```
+### 第 1 步：还原旧方式迁移的容器数据
 
-建议升级前就按下面的[修复](#修复)步骤处理完。至少把名单记下来，升级后知道该修哪些。
+修复面板会检查容器目录。存在指向外置盘的旧符号链接时，点「全部还原」；没有此类目录时，跳过这一步。手动操作路径是「数据目录」→「应用数据」→ 选择应用 → 还原状态为「已链接」的容器目录。
 
-## 已升级：确认症状
+恢复原始应用后，沙盒限制也会恢复，因此要先处理旧符号链接，否则应用可能读不到原来的数据。已经使用 APFS 挂载迁移的目录不需要为了签名修复而还原。
 
-```bash
-# 1. 签名（出现 Signature=adhoc 且 TeamIdentifier=not set 即已被重签名）
-codesign -dv --verbose=4 /Applications/WeChat.app 2>&1 | grep -E "Authority|TeamIdentifier|Signature"
+### 第 2 步：恢复原始签名，或从官方渠道重装
 
-# 2. 复现并看系统日志
-open -a /Applications/WeChat.app; sleep 3
-log show --last 1m --style compact 2>/dev/null | grep -i "rejected approval request"
-```
+按备份情况选择一种方式：
 
-第 2 步出现 `kTCCServiceSystemPolicyAppData ... denied` 即可确认。更完整的自查表见[容器数据、沙盒与签名身份](/datamigrae/container-identity#自查)。
+- **有完整原始应用备份：** 点「恢复原始签名」，按提示恢复原始应用及其签名。AppPorts 会定位真实应用，应用本体在外置盘时也可恢复，不必先搬回本机。AppPorts 会校验当前应用与备份是否匹配；当前应用已更新或内容不匹配时，会要求提供匹配的官方原版。
+- **只有旧的签名记录：** 可选择同版本的官方原版 `.app` 补救，或从 App Store / 开发者官网下载重装。仅有证书名称的记录不能重建开发者签名。
+- **准备覆盖安装，且应用本体在外置盘：** 先点「迁回本地」，再安装官方版本，避免只覆盖本地启动入口而留下外置副本。
 
-## 修复
+**不要卸载或清理容器数据目录。** 这里要恢复的是应用本体和签名。聊天记录、登录状态是否能继续使用，还取决于数据本身、应用版本和原有授权；重要数据应另有备份。详见[签名备份与恢复](/datamigrae/resign#签名备份与恢复)。
 
-AppPorts 1.8.2 会自动找出这类应用：应用列表里带红色「签名已替换」徽章，启动时弹一次提醒。右键应用选择「查看修复步骤」会打开修复面板，面板按下面的顺序列出每一步的状态和按钮，全程不删除任何数据。手动操作也是同样的顺序，**顺序不能变**。
+### 第 3 步：重新检查，并从 Finder / Dock 打开
 
-### 第 1 步：把容器数据还原回本地
+回到修复面板点「重新检查」，确认签名检查通过，再从 Finder 或 Dock 打开应用，检查原有数据是否能访问。终端里能启动不能替代这一步。
 
-修复面板里点「全部还原」；或者打开「数据目录」→「应用数据」，选中该应用，把所有状态为「已链接」的容器目录逐个点「还原」。应用本来就打不开，不会被"正在运行"拦住。
+「暂时无法检查签名」表示这次检查没有得出结果，应连接外置盘后重试，不能算作「签名已替换」或「已经修好」。普通扫描不会删除恢复备份。
 
-为什么必须先做这一步：重装完的应用是正常的沙盒应用，它读不到符号链接后面的数据，你会看到"重装了还是空白"，误以为没修好。
+如果应用目前仍能打开，可以稍后处理；这不等于原始签名已经恢复。准备继续迁移容器数据时，应先完成修复。
 
-还原完成后可以确认一下：
+### 第 4 步（可选）：继续把数据放到外置盘
 
-```bash
-find ~/Library/Containers/<Bundle ID> -maxdepth 6 -type l -exec readlink {} \; 2>/dev/null
-# 没有输出，或输出里没有 /Volumes/... 就对了
-```
+修复后，到「应用数据」页选择要迁移的目录，点「迁移」。AppPorts 会先检查目标存储，容器数据使用 [APFS 挂载迁移](/datamigrae/mount-migration)，不需要重签名。
+
+当前方案需要**未加密的 APFS 外置盘**。目标不合适时，可以更换存储，也可以让数据继续留在本机。第一次打开应用时，如果 macOS 询问是否允许访问可移动宗卷，点「允许」。以后使用应用前，先连接外置盘。准备方法见[为什么外置盘必须是 APFS](/why-apfs#what-to-do)。
+
+## 谁会受影响
+
+| 情况 | 如何判断 |
+|------|----------|
+| 签名可能被替换 | AppPorts 留有原始开发者签名的备份记录，且真实应用当前明确为 Ad-hoc 签名 |
+| macOS 27 兼容性风险 | 曾对沙盒应用重签名，尤其是迁移过 `~/Library/Containers/` 或 `~/Library/Group Containers/` 数据的应用 |
+| 典型表现 | 从 Finder / Dock 打开时无反应，或图标一闪即退出 |
+| 现有测试记录 | 微信 4.1.15、macOS 27.0 (26A428) 出现过此问题；同机的 QQ 音乐仍可打开，不能推断所有应用都会失败 |
+| 无法检查 | 外置盘未连接、读取失败或检查超时；应重试，不应直接判定签名损坏 |
 
-### 第 2 步：应用本体迁回本地
+仅有 Ad-hoc 签名不代表应用被 AppPorts 改坏：有些应用本来就采用这种签名。也不能因为应用已迁移、位于容器目录或尚未能检查签名，就提示用户重新签名。
 
-只有应用本体已经迁移到外置盘时才需要这一步。此时 `/Applications` 里的是 AppPorts 的启动壳，直接覆盖安装会把壳盖掉，外置盘上的副本变成孤儿。修复面板里点「迁回本地」，或在「外部应用库」里选中它点「迁回本地」。装完想继续放外置盘，再迁移一次应用本体即可。
+重签名可能移除原有沙盒身份和授权。macOS 27 核对容器访问资格时，已有的签名授权记录可能不再匹配。微信的相关日志包含 `Failed to match existing code requirement`。原理和测试限制见[容器数据、沙盒与签名身份](/datamigrae/container-identity)。
+
+## 不要做的事
 
-### 第 3 步：重装应用（打不开时才需要）
+| 做法 | 原因 |
+|------|------|
+| 只还原数据，就认为修复完成 | 数据路径和应用签名是两个检查项，恢复路径不会恢复开发者签名 |
+| 再点一次「重签名」 | 不能找回原有开发者签名，还可能再次
```

**File**: `User_docs/docs/zh-Hant/macos-27.md` (modified, +62/-67)
```diff
@@ -5,126 +5,121 @@ outline: deep
 # macOS 27 升級說明
 
 ::: tip 一句話結論
-用 AppPorts 遷移過微信等應用程式的容器資料、並且當時選了「同意重簽名」的使用者，升級到 macOS 27 後這些應用程式**可能**按兩下秒退（微信會，QQ 音樂等實測仍能開啟）。**資料沒有壞**，也不需要重新遷移。把資料還原回本機、從官方管道重新安裝應用程式即可恢復；之後想繼續放在外接磁碟，用新的[掛載遷移](/zh-Hant/datamigrae/mount-migration)。
+如果你曾在 AppPorts 舊版或測試版中同意重簽名，升級 macOS 27 後，微信等應用程式可能無法從 Finder / Dock 開啟。先還原舊方式遷移的容器資料，再恢復原始應用程式或從官方管道重新安裝。**不要刪除資料目錄，也不要再次重簽名。** 簽名錯誤本身不代表資料已損壞。
 :::
 
+## 修復
+
+在應用程式清單直接點選行內的 **「修復」**，或右鍵選擇「檢視修復步驟」。不需要先執行終端機命令。本文的新引導對應目前開發版本；較早版本沒有面板時，也能依下面的方法手動處理。開始前連接原本的外接磁碟，完全結束應用程式，並保留資料與備份。
+
+::: tip 登入時自動重新簽署
+目前開發版會在 macOS 27 及以上停用「登入時自動重新簽署」，停止並移除舊登入工作；若尚未完全關閉，可在設定頁重試。
+
+**升級系統前，請先更新並開啟一次 AppPorts**，讓已安裝的背景工作取得版本保護。僅下載新版而尚未開啟，不會自動更新舊背景工作。
+:::
+
+### 1. 還原舊連結遷移的容器資料
+
+面板找到指向外接磁碟的容器連結時，點「全部還原」；沒有則跳過。手動路徑是「資料目錄」→「應用程式資料」→ 選擇應用程式 → 還原已連結的容器目錄。已使用 APFS 掛載遷移的目錄，不必只為修復簽名而還原。
+
+### 2. 恢復原始應用程式或從官方管道重新安裝
+
+- **有完整原始應用程式備份：** 點「恢復原始簽名」，還原備份中的版本及簽名。真實應用程式在外接磁碟時也可恢復，不必先遷回本機；AppPorts 會檢查目前應用程式與備份是否相符；已更新或內容不同時，需要提供相符的官方原版。
+- **只有舊簽名記錄：** 選擇同版本官方原版 `.app`，或從 App Store / 開發者官網重新安裝。只有憑證名稱的記錄無法重建開發者簽名。
+- **準備覆蓋安裝外接磁碟上的應用程式：** 先點「遷回本機」，避免只覆蓋本機啟動入口。
+
+**不要刪除容器資料目錄。** 重要資料應另有備份；聊天記錄與登入狀態能否繼續使用，也取決於版本、權限及資料本身。詳見[簽名備份與恢復](/zh-Hant/datamigrae/resign#簽名備份與恢復)。
+
+### 3. 重新檢查，並從 Finder / Dock 開啟
+
+點「重新檢查」，確認簽名檢查通過，再從 Finder / Dock 開啟應用程式，確認原有資料可用。「暫時無法檢查簽名」不代表已替換或已修好，應連接磁碟後重試；掃描會保留恢復備份。目前仍能開啟的應用程式可以稍後處理，但這不等於原始簽名已恢復。
+
+### 4. 可選：繼續遷移資料
+
+修復後，在「應用程式資料」中選擇目錄並點「遷移」。AppPorts 先檢查目的地，再以 [APFS 掛載遷移](/zh-Hant/datamigrae/mount-migration)處理容器資料，保留原始簽名。目前需要**未加密的 APFS 外接磁碟**；也可以換磁碟或讓資料留在本機。首次開啟時若系統詢問可移除卷宗存取權，請允許；之後使用前先連接磁碟。見[APFS 準備方法](/zh-Hant/why-apfs#what-to-do)。
+
 ## 誰會受影響
 
 | 項目 | 說明 |
 |------|------|
 | 觸發條件 | 升級到 macOS 27 |
 | 受影響應用程式 | 遷移過 `~/Library/Containers/` 或 `~/Library/Group Containers/` 資料，且執行過 Ad-hoc 重簽名的應用程式；或者手動右鍵重簽名過的沙盒應用程式 |
 | 典型表現 | Finder / Dock 按兩下無反應，圖示閃一下就消失，沒有報錯對話框。並非所有重簽名過的應用程式都會這樣：QQ 音樂在同一臺 27 上正常執行 |
-| 資料 | 完好，包括聊天記錄和登入狀態 |
+| 資料 | 簽名錯誤本身不代表資料損壞；請保留原始資料和備份 |
 | 已確認案例 | 微信 4.1.15，macOS 27.0 (26A428) |
 
 原因簡單說：重簽名把應用程式的沙盒身分拆掉了，macOS 27 核對"這個應用程式有沒有資格碰這個容器"時，如果系統裡已經存著這個應用程式原來簽名的授權記錄，新簽名對不上就被拒絕（微信的日誌：`Failed to match existing code requirement`）。沒有舊記錄的應用程式（如 QQ 音樂）目前能放行，但鑰匙圈登入狀態等遺失的授權同樣找不回來。原理見[容器資料、沙盒與簽名身分](/zh-Hant/datamigrae/container-identity)。
 
+只有備份記錄為原始開發者簽名，而且真實應用程式目前明確為 Ad-hoc，才標記「簽名已替換」。逾時或外接磁碟無法讀取時應重新檢查。本來就採用 Ad-hoc、曾經遷移或本機啟動入口，都不能單獨作為需要重簽名的判斷。
+
+## 不要做的事
+
+| 做法 | 為什麼沒用 |
+|------|-----------|
+| 只把資料還原回本機就當修好了 | 還原只解決"讀不到外接磁碟資料"，無法修復簽名。重簽名過的應用程式還原後照樣秒退 |
+| 再按一下「重簽名此應用」 | 重簽名就是病因，只會再抹一次授權 |
+| 把應用程式加進「完整磁碟取用權限」 | 可能繞過容器驗證，但鑰匙圈授權已丟，登入狀態照樣有問題。只能當暫時措施 |
+| 用"終端裡能開啟"當作修好了 | 終端啟動時借用了終端的權限，是假象。以 Finder / Dock 按兩下為準 |
+
 ## 還沒升級：先檢查
 
-下面的指令碼會列出被 AppPorts 替換過簽名的應用程式。有輸出的都是升級後可能出問題的物件。
+優先查看 AppPorts 的「簽名已替換」標記並按[修復](#修復)處理。沒有標記不保證 macOS 27 相容性。下面的輔助腳本只檢查舊備份中仍可存取的路徑；應用程式移動、磁碟離線或啟動入口都可能造成漏報。
 
+::: details 進階：選用的技術檢查
 ```bash
 BACKUP_DIR="$HOME/Library/Application Support/AppPorts/signature-backups"
 for plist in "$BACKUP_DIR"/*.plist; do
   [ -f "$plist" ] || continue
   original=$(/usr/libexec/PlistBuddy -c "Print :signingIdentity" "$plist" 2>/dev/null)
   app=$(/usr/libexec/PlistBuddy -c "Print :originalPath" "$plist" 2>/dev/null)
-  case "$original" in ""|ad-hoc) continue ;; esac   # 本来就是 ad-hoc 的跳过
+  case "$original" in ""|ad-hoc) continue ;; esac
   [ -d "$app" ] || continue
   if codesign -dv "$app" 2>&1 | grep -q "Signature=adhoc"; then
-    printf "%s\n    原始签名: %s\n" "$app" "$original"
+    printf "%s\n    %s\n" "$app" "$original"
   fi
 done
 ```
-
-建議升級前就按下面的[修復](#修復)步驟處理完。至少把名單記下來，升級後知道該修哪些。
+:::
 
 ## 已升級：確認症狀
 
-```bash
-# 1. 签名（出现 Signature=adhoc 且 TeamIdentifier=not set 即已被重签名）
-codesign -dv --verbose=4 /Applications/WeChat.app 2>&1 | grep -E "Authority|TeamIdentifier|Signature"
-
-# 2. 复现并看系统日志
-open -a /Applications/WeChat.app; sleep 3
-log show --last 1m --style compact 2>/dev/null | grep -i "rejected approval request"
-```
-
-第 2 步出現 `kTCCServiceSystemPolicyAppData ... denied` 即可確認。更完整的自查表見[容器資料、沙盒與簽名身分](/zh-Hant/datamigrae/container-identity#自查)。
-
-## 修復
-
-AppPorts 1.8.2 會自動找出這類應用程式：應用程式清單裡帶紅色「簽名已替換」徽章，啟動時彈一次提醒。右鍵應用程式選擇「檢視修復步驟」會開啟修復面板，面板按下面的順序列出每一步的狀態和按鈕，全程不刪除任何資料。手動操作也是同樣的順序，**順序不能變**。
+先從 Finder / Dock 開啟應用程式。失敗且確認簽名已替換時，按[修復](#修復)處理；否則也應檢查版本相容性、權限和外接磁碟。
 
-### 第 1 步：把容器資料還原回本機
-
-修復面板裡按一下「全部還原」；或者開啟「資料目錄」→「應用程式資料」，選取該應用程式，把所有狀態為「已連結」的容器目錄逐個按一下「還原」。應用程式本來就打不開，不會被"正在執行"攔住。
-
-為什麼必須先做這一步：重新安裝完的應用程式是正常的沙盒應用程式，它讀不到符號連結後面的資料，你會看到"重新安裝了還是空白"，誤以為沒修好。
-
-還原完成後可以確認一下：
+::: details 進階：選用的技術檢查
+將範例改成**真實應用程式路徑**，不要使用本機啟動入口。以下命令只讀取資訊。Ad-hoc 需與原始簽名記錄一起判斷；存取被拒絕的日誌只是線索，不能單獨確認原因。
 
 ```bash
-find ~/Library/Containers/<Bundle ID> -maxdepth 6 -type l -exec readlink {} \; 2>/dev/null
-# 没有输出，或输出里没有 /Volumes/... 就对了
+codesign -dv --verbose=4 "/Applications/WeChat.app" 2>&1 | grep -E "Authority|TeamIdentifier|Signature"
+log show --last 1m --style compact 2>/dev/null | grep -i "rejected approval request"
 ```
-
-### 第 2 步：應用程式本體遷回本機
-
-只有應用程式本體已經遷移到外接磁碟時才需要這一步。此時 `/Applications` 裡的是 AppPorts 的啟動殼，直接覆蓋安裝會把殼蓋掉，外接磁碟上的副本變成孤兒。修復面板裡按一下
```

---

### Incident Patch 8: `aa8602e2` (2026-09-26)
**Commit Message**: feat: improve migration UI and macOS 27 compatibility

Make data directories easier to browse and operate, correct size and icon presentation, and clarify migration and signature-repair guidance.

Disable login re-signing on macOS 27 and later, harden upgrade cleanup, and add regression coverage and localized settings links. Advance the app build to 20.

**File**: `AppPorts.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -359,7 +359,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 2;
+				CURRENT_PROJECT_VERSION = 20;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = MQ7XG7WM3F;
 				ENABLE_APP_INTENTS_METADATA_PROVIDER = NO;
@@ -395,7 +395,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 2;
+				CURRENT_PROJECT_VERSION = 20;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = MQ7XG7WM3F;
 				ENABLE_APP_INTENTS_METADATA_PROVIDER = NO;
```

**File**: `AppPorts/AppPorts-ReSign.sh` (modified, +10/-1)
```diff
@@ -3,11 +3,20 @@
 # Runs at user login to re-sign migrated apps whose ad-hoc signatures
 # may have been invalidated by macOS Gatekeeper after restart.
 #
-# Installed by AppPorts → ~/Library/Application Support/AppPorts/re-sign-at-login.sh
+# Installed by AppPorts → ~/Library/Application Support/AppPorts/AppPorts-ReSign.sh
 # Triggered by      → ~/Library/LaunchAgents/com.shimoko.AppPorts.re-sign.plist
 
 set -euo pipefail
 
+# 登录任务可能先于 AppPorts 启动；必须在读取偏好、备份或修改文件前检查系统版本。
+# 无法识别版本时也跳过。经典模式不能绕过开机重签的版本限制。
+SYSTEM_VERSION=$(/usr/bin/sw_vers -productVersion 2>/dev/null) || exit 0
+SYSTEM_MAJOR="${SYSTEM_VERSION%%.*}"
+case "$SYSTEM_MAJOR" in
+    [1-9]|1[0-9]|2[0-6]) ;;
+    *) exit 0 ;;
+esac
+
 BACKUP_DIR="$HOME/Library/Application Support/AppPorts/signature-backups"
 LOG_DIR="$HOME/Library/Application Support/AppPorts"
 
```

**File**: `AppPorts/Appports.swift` (modified, +7/-1)
```diff
@@ -37,7 +37,13 @@ class AppDelegate: NSObject, NSApplicationDelegate {
         // 应用可能被移动过：校准登录代理指向的程序，免得它指向一个已经不存在的路径。
         Task.detached(priority: .utility) {
             do { try await AutoResignInstaller.refreshInstalledScriptIfNeeded() }
-            catch { AppLogger.shared.logError("更新开机重签脚本失败", error: error) }
+            catch {
+                AppLogger.shared.logError(
+                    "更新开机重签设置失败",
+                    error: error,
+                    errorCode: "AUTO-RESIGN-POLICY-FAILED"
+                )
+            }
             await ContainerMountAgentInstaller.refreshAtLaunch()
         }
     }
```

**File**: `AppPorts/ContentView.swift` (modified, +6/-3)
```diff
@@ -862,7 +862,7 @@ struct ContentView: View {
                 subtitle: externalDriveURL?.path ?? "未选择".localized,
                 icon: "externaldrive.fill",
                 actionButtonText: "选择文件夹".localized,
-                onAction: openPanelForExternalDrive,
+                onAction: { _ = openPanelForExternalDrive() },
                 onRefresh: { scanExternalApps() }
             )
 
@@ -1447,7 +1447,8 @@ struct ContentView: View {
         await computeAndStoreSizes(misses: misses, isLocal: isLocal, scanner: scanner, request: request)
     }
 
-    func openPanelForExternalDrive() {
+    @discardableResult
+    func openPanelForExternalDrive() -> URL? {
         let openPanel = NSOpenPanel()
         openPanel.prompt = "选择文件夹".localized
         openPanel.allowsMultipleSelection = false
@@ -1459,8 +1460,10 @@ struct ContentView: View {
             AppLogger.shared.logContext("用户选择外部路径", details: [("path", url.path)])
             // 记录外接硬盘信息
             AppLogger.shared.logExternalDriveInfo(at: url)
+            return url
         } else {
             AppLogger.shared.log("用户取消选择外部路径", level: "TRACE")
+            return nil
         }
     }
 
@@ -2794,7 +2797,7 @@ struct ContentView: View {
 
     private func signatureRepairSheet(for app: AppItem) -> some View {
         SignatureRepairSheet(
-            app: app,
+            app: localApps.first(where: { $0.id == app.id }) ?? app,
             onRestoreSignature: { performRestoreSignature(app: $0) },
             onMoveBack: { performMoveBack(app: $0) },
             onOpenDataDirs: { target in
```

**File**: `AppPorts/Models/AppModels.swift` (modified, +8/-2)
```diff
@@ -115,14 +115,18 @@ struct AppItem: Identifiable, Equatable, Sendable {
     /// - Note: iOS 应用通常包含 WrappedBundle 或特定的 Info.plist 标识
     var isIOSApp: Bool = false
 
-    /// 是否已被 AppPorts 重签名
-    /// - Note: 通过检测签名备份 plist 是否存在来判断
+    /// 有 AppPorts 签名备份，且当前签名已确认为 Ad-hoc。
     var isResigned: Bool = false
 
     /// 原始开发者签名已被 Ad-hoc 签名替换：备份记录的原始身份是开发者证书，当前签名却是 ad-hoc。
     /// 这类应用在 macOS 27 上可能无法打开，修复路径是还原数据、重装后再挂载迁移。
     var signatureReplaced: Bool = false
 
+    /// 有恢复记录，但本次无法检查真实应用的签名。不能解释为已替换或已恢复。
+    var signatureCheckUnavailable: Bool = false
+
+    var needsSignatureAttention: Bool { signatureReplaced || signatureCheckUnavailable }
+
     /// 是否为 Electron 应用（含 Electron Framework）
     var isElectronApp: Bool = false
 
@@ -200,6 +204,8 @@ struct AppItem: Identifiable, Equatable, Sendable {
         lhs.isMASExternal == rhs.isMASExternal &&
         lhs.isIOSApp == rhs.isIOSApp &&
         lhs.isResigned == rhs.isResigned &&
+        lhs.signatureReplaced == rhs.signatureReplaced &&
+        lhs.signatureCheckUnavailable == rhs.signatureCheckUnavailable &&
         lhs.isElectronApp == rhs.isElectronApp &&
         lhs.isSparkleApp == rhs.isSparkleApp &&
         lhs.hasSelfUpdater == rhs.hasSelfUpdater &&
```

**File**: `AppPorts/Models/DataDirTree.swift` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
+import Foundation
+
+/// Presentation-only hierarchy. Input order is preserved within each sibling list.
+enum DataDirTree {
+    struct Row: Identifiable {
+        let item: DataDirItem
+        let level: Int
+        let parentID: String?
+
+        var id: String { item.id }
+
+        /// Only show the part of the parent path that the indentation does not explain.
+        var contextPath: String? {
+            let parentPath = item.path.standardizedFileURL.deletingLastPathComponent().path
+            if let parentID {
+                guard parentPath != parentID else { return nil }
+                return String(parentPath.dropFirst(parentID.count + 1))
+            }
+            let home = NSHomeDirectory()
+            return parentPath.hasPrefix(home + "/")
+                ? "~" + parentPath.dropFirst(home.count)
+                : parentPath
+        }
+    }
+
+    static func build(from items: [DataDirItem]) -> [DataDirItem] {
+        var seen = Set<String>()
+        let uniqueItems = items.filter { seen.insert($0.id).inserted }
+        let paths = Set(uniqueItems.map(\.id))
+        var roots: [DataDirItem] = []
+        var children: [String: [DataDirItem]] = [:]
+
+        for item in uniqueItems {
+            var ancestor = item.path.standardizedFileURL.deletingLastPathComponent()
+            var parentID: String?
+            while ancestor.path != item.id {
+                if paths.contains(ancestor.path) {
+                    parentID = ancestor.path
+                    break
+                }
+                guard ancestor.path != "/" else { break }
+                ancestor.deleteLastPathComponent()
+            }
+            if let parentID {
+                children[parentID, default: []].append(item)
+            } else {
+                roots.append(item)
+            }
+        }
+
+        func populate(_ item: DataDirItem) -> DataDirItem {
+            var result = item
+            result.children = (children[item.id] ?? []).map(populate)
+            return result
+        }
+        return roots.map(populate)
+    }
+
+    /// Keep ancestors of matches so a search never hides the directory's context.
+    static func retainingMatches(in items: [DataDirItem], matchingIDs: Set<String>) -> [DataDirItem] {
+        items.compactMap { item in
+            var result = item
+            result.children = retainingMatches(in: item.children, matchingIDs: matchingIDs)
+            return matchingIDs.contains(item.id) || !result.children.isEmpty ? result : nil
+        }
+    }
+
+    static func rows(in items: [DataDirItem], collapsedIDs: Set<String> = []) -> [Row] {
+        func visit(_ items: [DataDirItem], level: Int, parentID: String?) -> [Row] {
+            items.flatMap { item in
+                let row = Row(item: item, level: level, parentID: parentID)
+                return [row] + (collapsedIDs.contains(item.id)
+                    ? []
+                    : visit(item.children, level: level + 1, parentID: item.id))
+            }
+        }
+        return visit(items, level: 0, parentID: nil)
+    }
+}
```

**File**: `AppPorts/Services/AutoResignInstaller.swift` (modified, +82/-3)
```diff
@@ -11,6 +11,8 @@ import Foundation
 /// 用户每次登录时自动对签名已失效的已迁移应用执行 ad-hoc 重签名。
 enum AutoResignInstaller {
 
+    static let enabledDefaultsKey = "autoResignAtLogin"
+    static let policyErrorDefaultsKey = "autoResignSystemPolicyError"
     private static let label = "com.shimoko.AppPorts.re-sign"
     private static let scriptName = "AppPorts-ReSign.sh"
     private static let backgroundTaskStopper = BackgroundTaskStopper()
@@ -29,12 +31,31 @@ enum AutoResignInstaller {
         appSupportDir.appendingPathComponent(scriptName)
     }
 
+    static var isSupported: Bool {
+        supportsLoginResigning(macOSMajorVersion: ProcessInfo.processInfo.operatingSystemVersion.majorVersion)
+    }
+
+    static func supportsLoginResigning(macOSMajorVersion: Int) -> Bool {
+        macOSMajorVersion > 0 && macOSMajorVersion < 27
+    }
+
     // MARK: - Install
 
-    /// 升级时先停止旧任务再同步脚本；保留 plist，下次登录仍按用户设置运行。
+    /// macOS 27 起停用旧任务；较早系统先停止旧脚本，再同步带版本保护的新脚本。
     static func refreshInstalledScriptIfNeeded() async throws {
-        guard isInstalled,
-              ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] == nil else { return }
+        // 测试宿主启动时不能修改开发机的真实登录任务或偏好。
+        guard ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] == nil else { return }
+        if try await disableIfUnsupported(
+            macOSMajorVersion: ProcessInfo.processInfo.operatingSystemVersion.majorVersion,
+            defaults: .standard,
+            agentPlistURL: agentPlistURL,
+            scriptURL: scriptURL,
+            stopTask: { try await stopBackgroundTask() }
+        ) {
+            return
+        }
+
+        guard isInstalled else { return }
         guard let bundledScript = Bundle.main.url(forResource: scriptName, withExtension: nil) else {
             throw InstallError.scriptNotFound
         }
@@ -44,6 +65,60 @@ enum AutoResignInstaller {
         try synchronizeScript(from: bundledScript, to: scriptURL)
     }
 
+    /// 先把旧脚本改为空操作，再确认整个进程组退出，最后删除登录任务。
+    /// 路径、偏好和停止动作可注入，测试不会接触真实登录项或签名备份。
+    @discardableResult
+    static func disableIfUnsupported(
+        macOSMajorVersion: Int,
+        defaults: UserDefaults,
+        agentPlistURL: URL,
+        scriptURL: URL,
+        stopTask: () async throws -> Void
+    ) async throws -> Bool {
+        guard !supportsLoginResigning(macOSMajorVersion: macOSMajorVersion) else { return false }
+
+        let fm = FileManager.default
+        let hadInstallation = fm.fileExists(atPath: agentPlistURL.path) || fm.fileExists(atPath: scriptURL.path)
+        let wasEnabled = defaults.bool(forKey: enabledDefaultsKey)
+        defaults.set(false, forKey: enabledDefaultsKey)
+
+        if hadInstallation {
+            do {
+                // 即使本次停止/清理失败，下一次登录也不能再执行旧脚本。
+                try fm.createDirectory(at: scriptURL.deletingLastPathComponent(), withIntermediateDirectories: true)
+                try Data("#!/bin/bash\n# Login re-signing has been disabled by AppPorts.\nexit 0\n".utf8)
+                    .write(to: scriptURL, options: .atomic)
+                try fm.setAttributes([.posixPermissions: 0o755], ofItemAtPath: scriptURL.path)
+            } catch {
+                // 写入失败仍要尝试停止并卸载；只有后面的完整清理成功才算关闭完成。
+                AppLogger.shared.logError("预先停用旧重签脚本失败，将继续停止并卸载任务", error: error)
+            }
+        }
+
+        do {
+            // plist 可能已经被删除，但对应任务仍在运行，不能按文件是否存在跳过此屏障。
+            try await stopTask()
+            try removeIfPresent(agentPlistURL)
+            try removeIfPresent(scriptURL)
+            defaults.removeObject(forKey: policyErrorDefaultsKey)
+            if hadInstallation || wasEnabled {
+                AppLogger.shared.log("当前系统不支持开机自动重签名，旧登录任务已停止并卸载")
+            }
+            return true
+        } catch {
+            defaults.set(error.localizedDescription, forKey: policyErrorDefaultsKey)
+            throw error
+        }
+    }
+
+    private static func removeIfPresent(_ url: URL) throws {
+        do {
+            try FileManager.default.removeItem(at: url)
+        } catch let error as CocoaError where error.code == .fileNoSuchFile {
+            // 幂等清理，也允许启动检查与签名操作同时等待同一个停止屏障。
+        }
+    }
+
     /// 旧脚本可能已读完记录并准备原地重签。仅更新脚本或记录不能取消它，
     /// 手动签名事务开始前必须确认本次登录任务及其子进程已退出。
     /// 不删除 plist，也不在当前会话重新 bootstrap，避免刚恢复就再次后台重签。
@@ -120,6 +195,7 @@ enum AutoResignInstaller {
     }
 
     static func install() throws {
+        guard isSupported else { throw InstallError.unsupportedSystem }
         let fm = FileManager.default
         let appSupportDirURL = appSupportDir
 
@@ -216,12 +292,15 @@ enum AutoResignInstaller {
     }
 
     enum InstallError: LocalizedError {
+        case unsupportedSystem
         case scriptNotFound
         case launchAgentLoadFailed
         case backgroundTaskStillRunning
 
         var errorDescription: String? {
             switch self {
+            case .unsupportedSystem:
+                return "macOS 27 及以上不支持开机自动重签名，以免影响应用启动。请在
```

**File**: `AppPorts/Utils/AppScanner.swift` (modified, +29/-18)
```diff
@@ -239,6 +239,7 @@ actor AppScanner {
                     isIOSApp: isIOS,
                     isResigned: signing.isResigned,
                     signatureReplaced: signing.signatureReplaced,
+                    signatureCheckUnavailable: signing.signatureCheckUnavailable,
                     isElectronApp: isElectron,
                     isSparkleApp: isSparkle,
                     hasSelfUpdater: hasUpdater,
@@ -283,6 +284,7 @@ actor AppScanner {
                             isIOSApp: isIOS,
                             isResigned: signing.isResigned,
                             signatureReplaced: signing.signatureReplaced,
+                            signatureCheckUnavailable: signing.signatureCheckUnavailable,
                             version: version,
                             containerKind: .singleAppContainer,
                             appCount: 1
@@ -939,6 +941,7 @@ actor AppScanner {
                     isRunning: false,
                     isResigned: signing.isResigned,
                     signatureReplaced: signing.signatureReplaced,
+                    signatureCheckUnavailable: signing.signatureCheckUnavailable,
                     isElectronApp: isElectron,
                     isSparkleApp: isSparkle,
                     hasSelfUpdater: hasUpdater,
@@ -982,6 +985,7 @@ actor AppScanner {
                             isIOSApp: isIOS,
                             isResigned: signing.isResigned,
                             signatureReplaced: signing.signatureReplaced,
+                            signatureCheckUnavailable: signing.signatureCheckUnavailable,
                             containerKind: .singleAppContainer,
                             appCount: 1
                         )
@@ -1043,6 +1047,7 @@ actor AppScanner {
                     isIOSApp: isIOS,
                     isResigned: signing.isResigned,
                     signatureReplaced: signing.signatureReplaced,
+                    signatureCheckUnavailable: signing.signatureCheckUnavailable,
                     containerKind: .standaloneApp
                 )
                 candidates.append(makeCandidate(for: app, bundleURL: externalTargetURL, priority: 40))
@@ -1073,6 +1078,7 @@ actor AppScanner {
                     isIOSApp: isIOS,
                     isResigned: signing.isResigned,
                     signatureReplaced: signing.signatureReplaced,
+                    signatureCheckUnavailable: signing.signatureCheckUnavailable,
                     containerKind: .singleAppContainer,
                     appCount: 1
                 )
@@ -1118,6 +1124,7 @@ actor AppScanner {
                     isIOSApp: isIOS,
                     isResigned: signing.isResigned,
                     signatureReplaced: signing.signatureReplaced,
+                    signatureCheckUnavailable: signing.signatureCheckUnavailable,
                     containerKind: .standaloneApp
                 )
                 candidates.append(makeCandidate(for: app, bundleURL: itemURL, priority: 15))
@@ -1239,10 +1246,12 @@ actor AppScanner {
         return appSupport.appendingPathComponent("AppPorts/signature-backups")
     }
 
-    struct SigningStatus {
+    struct SigningStatus: Equatable, Sendable {
         static let clean = SigningStatus(isResigned: false, signatureReplaced: false)
+        static let unavailable = SigningStatus(isResigned: false, signatureReplaced: false, signatureCheckUnavailable: true)
         let isResigned: Bool
         let signatureReplaced: Bool
+        var signatureCheckUnavailable = false
     }
 
     private func checkResignedStatus(bundleURL: URL?) -> Bool {
@@ -1251,33 +1260,33 @@ actor AppScanner {
 
     /// 结合签名备份与当前签名判断：是否被 AppPorts 重签过、原始开发者签名是否已被替换。
     /// 只观察当前状态，恢复材料由显式的恢复事务清理。
-    private func checkSigningStatus(bundleURL: URL?) -> SigningStatus {
+    func checkSigningStatus(bundleURL: URL?) -> SigningStatus {
         guard let bundleURL else { return .clean }
 
-        // 先用本地 bundle ID 检查
-        if let bundleID = readBundleIdentifier(from: bundleURL),
-           let status = signingStatus(realAppURL: bundleURL, bundleID: bundleID) {
-            return status
-        }
-
-        // 已链接应用：备份保存在真实应用的 bundle ID 下，需要解析外部路径
-        if let externalURL = resolveExternalRealApp(from: bundleURL),
-           let realBundleID = readBundleIdentifier(from: externalURL),
-           let status = signingStatus(realAppURL: externalURL, bundleID: realBundleID) {
-            return status
+        // 与签名操作共用解析规则，绝不把本地启动壳的 Ad-hoc 签名当作真实应用的签名。
+        guard let realURL = try? CodeSigner.resolveAppURL(at: bundleURL),
+              let bundleID = readBundleIdentifier(from: realURL) else {
+            // 外置盘离线时仍保留检查入口；备份也始终由显式恢复事务管理。
+            if let localID = readBundleIdentifier(from: bundleURL) {
+                let originalID = localID.hasSuffix(".appports.stub")
+                    ? String(localID.dropLast(".appports.stub".count)) : localID
+              
```

---

### Incident Patch 9: `0cb3ed23` (2026-09-26)
**Commit Message**: docs(es): sync mount migration and recovery guides

**File**: `User_docs/docs/es/AppPorts.md` (modified, +45/-45)
```diff
@@ -2,43 +2,43 @@
 outline: deep
 ---
 
-# Guía del Usuario de AppPorts
+# Guía del usuario de AppPorts
 
-Esta guía presenta de forma sistemática las características, principios de diseño e implementación técnica de AppPorts. Para más detalles técnicos, consulte [DeepWiki](https://deepwiki.com/wzh4869/AppPorts). Para sugerencias de mejora, envíelas a los [Issues](https://github.com/wzh4869/AppPorts/issues) del proyecto.
+Esta guía presenta las funciones principales de AppPorts, sus principios de diseño y su implementación técnica. Para conocer más detalles técnicos, consulta [DeepWiki](https://deepwiki.com/wzh4869/AppPorts). Puedes enviar sugerencias de mejora a los [Issues](https://github.com/wzh4869/AppPorts/issues) del proyecto.
 
-## Visión General
+## Introducción
 
-AppPorts es una herramienta de migración y vinculación de aplicaciones diseñada para [macOS](https://www.apple.com/macos/), que admite la migración de aplicaciones grandes a dispositivos de almacenamiento externo manteniendo toda la funcionalidad y consistencia del sistema.
+AppPorts es una herramienta de migración y enlace de aplicaciones diseñada para [macOS](https://www.apple.com/macos/). Permite trasladar aplicaciones grandes al almacenamiento externo, manteniendo en lo posible un comportamiento coherente en Finder, Launchpad, los menús de aplicaciones y las actualizaciones del sistema.
 
 ### Filosofía de AppPorts
 
 | Principio | Descripción |
-|-----------|-------------|
-| **Experiencia Transparente** | Garantiza que la experiencia del usuario y el sistema operativo perciban la aplicación como si aún se ejecutara desde el almacenamiento interno |
-| **Estrategia Estable** | Prioriza enfoques de migración probados y más estables |
-| **Baja Carga del Sistema** | Sin demonios, evita el consumo continuo de recursos del sistema |
-| **Amplia Internacionalización** | Prioriza cubrir más idiomas; amplitud de traducción sobre precisión |
-| **Accesible** | Soporte integral de accesibilidad |
+|------|------|
+| **Experiencia transparente** | Procurar que tanto el usuario como el sistema utilicen las aplicaciones migradas como si fueran locales |
+| **Estrategias estables** | Priorizar los métodos probados que ofrecen mayor estabilidad en la migración |
+| **Baja carga del sistema** | Evitar la dependencia de demonios y el consumo continuo de recursos del sistema |
+| **Amplia internacionalización** | Cubrir más idiomas y mejorar continuamente la calidad de las traducciones |
+| **Accesibilidad** | Ofrecer una compatibilidad con las funciones de accesibilidad lo más completa posible |
 
-## Características Principales
+## Funciones principales
 
-- **Migración sin Marcadores**: Migración con un solo clic de aplicaciones grandes a discos externos. Localmente solo se retiene un shell lanzador ligero; Finder no muestra flechas de acceso directo; Launchpad y el menú de aplicaciones de macOS funcionan normalmente.
-- **Protección de Actualización Automática**: Detecta automáticamente aplicaciones con soporte de actualización automática (Sparkle, Electron, Chrome, etc.), proporcionando una opción de "Migración Bloqueada" para evitar que los actualizadores automáticos eliminen o sobrescriban aplicaciones en el disco externo.
-- **Sincronización de Versión Stub Portal**: Cuando las aplicaciones externas se actualizan a través de App Store, la información de versión del Stub Portal local se sincroniza automáticamente, manteniendo el menú "Abrir con" preciso.
-- **Directorios de Escaneo Personalizados**: Agregue directorios de escaneo de aplicaciones locales adicionales (por ejemplo, JetBrains Toolbox, Steam). Los directorios se guardan y monitorean automáticamente.
-- **Gestión de Firma de Código**: Después de la migración, si aparece un mensaje de "Dañado", se puede volver a firmar con un solo clic mediante el menú contextual. Admite copia de seguridad y restauración de firmas originales; refirmado automático después de la migración del directorio de datos.
-- **Soporte App Store en macOS 15.1+**: Admite la instalación de aplicaciones de App Store directamente en discos externos con actualizaciones in situ en el disco externo.
-- **Restauración con Un Solo Clic**: Admite la migración de aplicaciones de vuelta al almacenamiento local con eliminación automática de enlaces. Recuperación automática en caso de migración interrumpida.
-- **Gestión del Directorio de Datos**: Admite la migración de directorios de datos de aplicaciones (subdirectorios de `~/Library/`, `~/.npm`, etc.) al almacenamiento externo, con vista de árbol, búsqueda y ordenación.
-- **Migración de Directorios**: Mueva carpetas reales arbitrarias bajo el directorio home del usuario al almacenamiento externo, útil para proyectos grandes, modelos, bibliotecas de recursos y cachés de herramientas, con revinculación, restauración y validación de solapamiento de rutas.
+- **Migración sin flecha de acceso directo**: traslada aplicaciones grandes al almacenamiento externo con un clic. Solo 
```

**File**: `User_docs/docs/es/badges.md` (modified, +65/-51)
```diff
@@ -2,83 +2,97 @@
 outline: deep
 ---
 
-# Marcadores de Estado
+# Guía de insignias de estado
 
-AppPorts muestra el estado actual de las aplicaciones y directorios de datos mediante marcadores de colores en forma de cápsula. Algunos marcadores son clicables para obtener información detallada.
+AppPorts utiliza insignias de colores con forma de cápsula para mostrar el estado de las aplicaciones y los directorios de datos. Algunas permiten hacer clic para ver más detalles o recomendaciones.
 
-## Marcadores de Estado de Aplicaciones
+## Insignias de las aplicaciones
 
-### Estado de Vinculación
+### Estado del enlace
 
-| Marcador | Icono | Color | Significado |
-|----------|-------|-------|-------------|
-| Vinculado | `link` | Verde | Aplicación migrada al almacenamiento externo con entrada local |
-| Migración Bloqueada | `lock.fill` | Verde | Vinculada y bloqueada con `uchg`, evitando que las auto-actualizaciones dañen la aplicación externa |
-| Migración Desbloqueada | `lock.open` | Naranja | Vinculada pero no bloqueada; las actualizaciones dentro de la app pueden eliminar la aplicación externa |
-| Vinculación Parcial | `link.badge.plus` | Amarillo | Componentes parciales de la app vinculados (ej., algunos archivos `.app` en un directorio) |
-| Enlace Huérfano | `link.badge.exclamationmark` | Rojo | Aplicación del almacenamiento externo perdida pero la entrada local aún existe |
-| Desvinculado | `externaldrive.badge.xmark` | Naranja | Aplicación en almacenamiento externo pero no vinculada localmente |
-| Externo | `externaldrive` | Naranja | Aplicación en almacenamiento externo sin entrada local |
-| Pendiente de mover fuera | `arrow.up.right.circle` | Cian | La app local real es más reciente que la copia externa antigua y puede moverse fuera para reemplazarla |
-| Local | `macmini` | Color secundario | Aplicación local regular, no migrada; se muestra cuando no hay otras etiquetas |
+| Insignia | Icono | Color | Significado |
+|------|------|------|------|
+| Enlazado | `link` | Verde | La aplicación se ha migrado al almacenamiento externo y tiene una entrada local |
+| Migración bloqueada | `lock.fill` | Verde | La aplicación está enlazada y bloqueada mediante `uchg` para proteger la copia externa frente a las actualizaciones automáticas |
+| Migración no bloqueada | `lock.open` | Naranja | La aplicación está enlazada pero no bloqueada; sus actualizaciones pueden eliminar o sobrescribir la copia externa |
+| Parcialmente enlazado | `link.badge.plus` | Amarillo | Algunos componentes están enlazados, como parte de los paquetes `.app` de un directorio |
+| Enlace huérfano | `link.badge.exclamationmark` | Rojo | La aplicación externa ha desaparecido, pero su entrada local aún existe |
+| No enlazado | `externaldrive.badge.xmark` | Naranja | La aplicación está en el almacenamiento externo y aún no se ha enlazado al Mac |
+| Externo | `externaldrive` | Naranja | Aplicación externa sin entrada local |
+| Pendiente de mover fuera | `arrow.up.right.circle` | Cian | La aplicación real local es más reciente que la copia externa del mismo nombre; se puede trasladar para sustituir esa copia antigua |
+| Local | `macmini` | Color secundario | Aplicación local normal, sin migrar; se muestra cuando no hay otras etiquetas |
 
-::: tip Cómo se detecta Pendiente de mover fuera
-AppPorts empareja primero las apps locales y externas por Bundle ID y, si es necesario, usa el nombre normalizado de la app como respaldo. El estado solo aparece cuando ambas versiones se pueden comparar y la versión local es más reciente.
+::: tip Cómo se determina «Pendiente de mover fuera»
+AppPorts compara primero las aplicaciones locales y externas por Bundle ID y, si hace falta, por su nombre normalizado. «Pendiente de mover fuera» solo aparece cuando ambas versiones se pueden comparar y la local es más reciente. Si falta una versión, el formato no permite compararlas o las aplicaciones con el mismo nombre tienen distintos Bundle ID, AppPorts conserva el estado local normal para evitar sobrescribir una aplicación externa por error.
 :::
 
-### Etiquetas de Framework
+### Frameworks
 
-| Marcador | Icono | Color | Significado | Acción al Hacer Clic |
-|----------|-------|-------|-------------|---------------------|
-| Sparkle | `arrow.triangle.2.circlepath` | Cian | Usa el framework Sparkle para actualizaciones automáticas | Después de migrar al almacenamiento externo, las actualizaciones dentro de la app pueden causar pérdida de la aplicación externa; se recomienda migración bloqueada |
-| Electron | `atom` | Índigo | Basado en el framework Electron con soporte de actualización automática | Después de migrar al almacenamiento externo, las actualizaciones dentro de la app pueden causar pérdida de la aplicación externa; se recomienda migración bloqueada |
+| Insignia | Icono | Color | Significado | Explicación al hacer clic |
+|------|------|------|------|----------|
+| Sparkle | `arrow.triangle.2.circlepath` | Cian | Usa Sparkle para las a
```

**File**: `User_docs/docs/es/changelog.md` (modified, +33/-0)
```diff
@@ -4,6 +4,39 @@ outline: deep
 
 # Registro de Cambios
 
+## v1.8.2 (en desarrollo)
+
+### Cambios importantes
+
+- **Los datos de contenedores pasan a la migración por montaje**: los directorios de `~/Library/Containers/` y `~/Library/Group Containers/` ya no se migran mediante enlaces simbólicos. AppPorts crea un volumen dedicado en un disco externo APFS y lo monta en el directorio original, sin modificar la firma de la aplicación. Se requiere un disco externo APFS; la primera vez que se abra la aplicación hay que permitir el acceso a «Volúmenes extraíbles». Consulta la [migración por montaje](/es/datamigrae/mount-migration).
+- **Las aplicaciones aisladas ya no se vuelven a firmar en ningún caso**: el menú contextual, la opción «Volver a firmar después de la migración» y el script de firma al iniciar sesión las omiten. La firma aplicada por versiones anteriores a una aplicación aislada puede impedir que se abra en macOS 27. Consulta la [guía de actualización a macOS 27](/es/macos-27).
+- **Corrección de «Restaurar firma original»**: antes de volver a firmar se guarda una copia completa de la aplicación original, y la sustitución se realiza de forma segura tras verificar una copia de trabajo. Se pueden restaurar la firma y las autorizaciones originales sin la clave privada del desarrollador. Para registros antiguos se puede seleccionar una copia oficial de la misma versión como solución; no se fuerzan sustituciones cuando la aplicación se ha actualizado o la copia de seguridad está dañada.
+- **Detección automática de firmas sustituidas y guía de reparación**: la lista muestra la insignia roja «Firma sustituida» y se presenta un aviso una vez al inicio. «Ver los pasos de reparación» en el menú contextual abre un panel que guía, en este orden, la restauración de datos, la devolución de la aplicación al Mac, la reinstalación y la migración por montaje, sin eliminar datos. Tras reinstalar y recuperar la firma, la insignia desaparece. El análisis conserva los materiales de restauración; las copias de seguridad se limpian una vez completada la restauración mediante AppPorts.
+- **Modo clásico de migración de datos**: una nueva opción en la configuración está desactivada de forma predeterminada y exige confirmar los riesgos antes de activarla. Recupera el método de la versión 1.8.1, con enlaces simbólicos y nueva firma, solo para quienes ya dependen del método anterior. Si el disco externo no es APFS, se recomienda conservar la situación actual en lugar de activar este modo.
+- «Re-firmado al iniciar sesión» está desactivado de forma predeterminada en instalaciones nuevas; quienes ya tienen instalado el agente de inicio de sesión conservan su ajuste.
+- Fuera del modo clásico, «Normalizar», «Volver a enlazar» y «Detalles del enlace» están desactivados para los directorios de contenedores, para evitar que se vuelvan a crear enlaces simbólicos.
+
+### Mejoras
+
+- **Al hacer clic en «Migración por montaje» se realiza primero una comprobación de solo lectura y después se ofrecen indicaciones según el caso**: si el almacenamiento es APFS sin cifrar, AppPorts explica la migración, cuánto espacio se puede liberar, el permiso de la primera apertura y la necesidad de mantener el disco conectado. Si es exFAT / NTFS / HFS+, está cifrado, falta espacio o no está conectado, explica el motivo y ofrece opciones como «Dejar como está», «Elegir otra ubicación» y «Ver cómo prepararlo», sin cambiar nada. Las comprobaciones de preparación de la bienvenida y la configuración siguen los mismos criterios y ya no dirigen al modo clásico a quienes no tienen APFS.
+- **Los volúmenes de datos ya no aparecen en Finder**: los nuevos volúmenes no se montan automáticamente en `/Volumes` y se montan con `nobrowse`. Los volúmenes montados por versiones anteriores se ocultarán en su ubicación actual en el próximo inicio o conexión del disco, sin desmontarlos.
+- **La migración por montaje todavía no admite discos APFS cifrados**: un volumen de datos nuevo no hereda la contraseña del volumen original. AppPorts se detiene y lo explica, en vez de crear silenciosamente un volumen sin cifrar.
+- **Se comprueba el espacio libre antes de migrar y restaurar**: si falta espacio en el disco externo o el Mac, la operación se detiene antes de crear el volumen o copiar los datos.
+- **Restauración más segura**: tras desmontar, solo se eliminan los puntos de montaje vacíos, sin borrado recursivo. Los directorios temporales usan nombres ocultos. Si no se completa el último paso, el volumen externo y su registro se conservan, y AppPorts indica dónde está la copia local.
+- **AppPorts solo actúa sobre sus propios volúmenes**: antes de montar, desmontar o restaurar, comprueba la identidad del volumen en el punto de montaje. La operación no comienza si no obtiene el bloqueo compartido con el agente de inicio de sesión. Un archivo de registros ilegible no se interpreta como una lista vacía ni se sobrescribe.
+- **Corrección automática de la ruta del agente de in
```

**File**: `User_docs/docs/es/datamigrae/baseinfo.md` (modified, +64/-65)
```diff
@@ -2,98 +2,97 @@
 outline: deep
 ---
 
-# Implementación Básica de Migración de Datos
+# Funcionamiento de la migración de datos
 
 ![](https://pic.cdn.shimoko.com/appports/%E6%88%AA%E5%B1%8F2026-05-08%2008.38.05.png)
 
-La función de migración de datos de AppPorts migra los directorios de datos asociados a las aplicaciones (como `~/Library/Application Support`, `~/Library/Caches`, etc.) al almacenamiento externo para liberar espacio en el disco local.
+La migración de datos de AppPorts mueve los directorios asociados a las apps a un disco externo para liberar espacio local. Usa dos estrategias según su ubicación:
 
-## Estrategia Principal: Enlace Simbólico
+| Directorio | Estrategia | Motivo |
+|------|------|------|
+| `~/Library/Containers/`, `~/Library/Group Containers/` | Migración por montaje | El entorno aislado comprueba la ruta real resuelta y rechaza enlaces simbólicos que salen del contenedor |
+| Otros subdirectorios de `~/Library/`, directorios de herramientas y carpetas personalizadas | Enlace simbólico | Es la opción más sencilla y no está sujeta a las restricciones del entorno aislado |
 
-La migración del directorio de datos utiliza la estrategia **Whole Symlink**:
+Esta página explica la estrategia de enlaces simbólicos. Para la otra estrategia, consulte [Migración por montaje](/es/datamigrae/mount-migration).
 
-1. Copia el directorio local original completo al almacenamiento externo
-2. Escribe metadatos de enlace gestionado (`.appports-link-metadata.plist`) en el directorio externo
-3. Renombra el directorio local original como una copia de seguridad oculta en el mismo volumen
-4. Crea un enlace simbólico en la ruta original apuntando a la copia externa
-5. Limpia la copia de seguridad local cuando el enlace simbólico se crea correctamente
+## Estrategia de enlaces simbólicos
+
+1. Copiar todo el directorio local al disco externo.
+2. Escribir el marcador de gestión `.appports-link-metadata.plist` en el directorio externo.
+3. Renombrar el directorio local original como copia de seguridad oculta en el mismo volumen.
+4. Crear en la ruta original un enlace simbólico que apunte a la copia externa.
+5. Eliminar la copia de seguridad cuando el enlace se haya creado correctamente.
 
 ```
 ~/Library/Application Support/SomeApp
-    → /Volumes/External/AppPortsData/SomeApp  (symlink)
+    → /Volumes/External/AppPortsData/SomeApp  （符号链接）
 ```
 
-## Flujo de Migración
-
 ```mermaid
 flowchart TD
-    A[Seleccionar directorio de datos] --> B{Verificación de permisos y protección}
-    B -->|Falló| Z[Terminar]
-    B -->|Aprobado| C{Detección de conflicto de ruta destino}
-    C -->|Tiene metadatos gestionados| D[Modo de recuperación automática]
-    C -->|Sin conflicto| E[Copiar al almacenamiento externo]
+    A[Seleccionar directorio de datos] --> B{Comprobar permisos y protecciones}
+    B -->|Fallo| Z[Detener]
+    B -->|Correcto| C{Comprobar conflictos de destino}
+    C -->|Marcador de gestión idéntico| D[Modo de recuperación automática]
+    C -->|Conflicto con directorio real| Y[Detener e indicar el conflicto]
+    C -->|Sin conflicto| E[Copiar al disco externo]
     D --> E
-    E --> F[Escribir metadatos de enlace gestionado]
-    F --> G[Renombrar directorio local como copia de seguridad]
-    G -->|Falló| H[Conservar copia externa y detener]
-    G -->|Éxito| I[Crear enlace simbólico]
-    I -->|Falló| J[Restaurar copia de seguridad local y conservar copia externa]
-    I -->|Éxito| K[Limpiar copia de seguridad local]
-    K -->|Éxito| L[Migración completada]
-    K -->|Falló| M[Migración completada; se conserva la copia de seguridad]
+    E --> F[Escribir marcador de gestión]
+    F --> G[Renombrar como copia de seguridad local]
+    G -->|Fallo| H[Conservar copia externa y detener]
+    G -->|Correcto| I[Crear enlace simbólico]
+    I -->|Fallo| J[Restaurar copia local y conservar copia externa]
+    I -->|Correcto| K[Eliminar copia de seguridad local]
+    K -->|Correcto| L[Migración completada]
+    K -->|Fallo| M[Migración completada con copia de seguridad conservada]
 ```
 
-## Metadatos de Enlace Gestionado
+## Marcador de gestión
 
-AppPorts escribe un archivo `.appports-link-metadata.plist` en el directorio externo para identificar que el directorio es gestionado por AppPorts. Los metadatos incluyen:
+El archivo `.appports-link-metadata.plist` del directorio externo indica que AppPorts lo gestiona:
 
 | Campo | Descripción |
-|-------|-------------|
-| `schemaVersion` | Número de versión de metadatos (actualmente 1) |
-| `managedBy` | Identificador del gestor (`com.shimoko.AppPorts`) |
+|------|------|
+| `schemaVersion` | Número de versión, actualmente 1 |
+| `managedBy` | `com.shimoko.AppPorts` |
 | `sourcePath` | Ruta local original |
-| `destinationPath` | Ruta destino del almacenamiento externo |
+| `destinationPath` | Ruta de destino externa |
 | `dataDirType` | Tipo de directorio de datos |
 
-Estos metadatos se utilizan durante el escaneo para distinguir los enlaces 
```

**File**: `User_docs/docs/es/datamigrae/container-identity.md` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+---
+outline: deep
+---
+
+# Datos de contenedores, aislamiento e identidad de firma
+
+::: tip Lo esencial
+Los datos de `~/Library/Containers/` y `~/Library/Group Containers/` pertenecen a **apps aisladas**. Moverlos al disco externo con un «acceso directo», o enlace simbólico, impide que la app los lea. Antes, AppPorts lo evitaba volviendo a firmar la app, a costa de que pudiera dejar de abrirse en macOS 27 y perder su sesión.
+
+Desde la versión 1.8.2, los contenedores usan [migración por montaje](/es/datamigrae/mount-migration), sin modificar ni un byte de la firma. Las apps ya firmadas de nuevo necesitan reinstalarse; consulte la [guía de actualización a macOS 27](/es/macos-27).
+:::
+
+Esta página explica el origen del problema. Si la app ya no se abre, consulte directamente la reparación en la [guía de macOS 27](/es/macos-27).
+
+## Qué es un contenedor
+
+La mayoría de las apps de macOS se ejecutan aisladas. El sistema asigna a cada una una carpeta exclusiva, `~/Library/Containers/<Bundle ID>/`, donde puede leer y escribir. Es obligatorio para App Store y habitual en apps descargadas de su web, como WeChat o QQ Music. Los datos compartidos se guardan en `~/Library/Group Containers/`.
+
+Para saber si una app está aislada, busque `com.apple.security.app-sandbox` en sus derechos:
+
+```bash
+codesign -d --entitlements - --xml /Applications/WeChat.app 2>/dev/null | grep -c app-sandbox
+# 输出 1 就是沙盒应用
+```
+
+**Que el programa principal no esté aislado no significa que se puedan mover libremente sus contenedores.** Los programas principales de Chrome y Edge no están aislados, pero sus widgets y extensiones tienen contenedores propios que pertenecen a procesos aislados. AppPorts trata todos los directorios de `Containers` por igual, sin basarse en el programa principal.
+
+## Tres formas de mover datos de contenedores
+
+| Método | Resultado | Motivo |
+|------|------|------|
+| Copiar al disco externo y dejar un enlace simbólico | La app se abre, pero no lee los datos; WeChat indica que la ubicación de almacenamiento no se puede usar | El aislamiento comprueba **adónde apunta** el enlace y rechaza cualquier destino fuera del contenedor, tanto un disco externo como el escritorio |
+| Enlace simbólico y nueva firma Ad-hoc | Funciona hasta macOS 26; en 27 puede cerrarse tras el doble clic, confirmado en WeChat aunque QQ Music sigue abriéndose | El enlace «funciona» porque se elimina la identidad aislada. También se borra la relación de pertenencia entre app y contenedor, que 27 comprueba |
+| Montar un volumen APFS externo en el directorio original | Funciona y conserva la firma | La ruta sigue dentro del contenedor y supera el control. El almacenamiento externo provoca un permiso del sistema que se acepta una vez |
+
+Las tres opciones se han comprobado en macOS 27. Los registros originales están en los experimentos de [enlaces simbólicos](/en/research/sandbox-symlink) y [puntos de montaje](/en/research/sandbox-mountpoint).
+
+## Qué cambia realmente al volver a firmar
+
+La firma Ad-hoc mediante `codesign --force --deep --sign -` elimina:
+
+| Elemento perdido | Consecuencia |
+|------|------|
+| `com.apple.security.app-sandbox` | La app deja de ejecutarse con identidad aislada |
+| `com.apple.security.application-groups` | No puede leer los datos compartidos de `Group Containers` |
+| `keychain-access-groups` | No puede leer la sesión ni las claves de bases de datos del llavero |
+| Team ID | La identidad no coincide al comprobar la propiedad del contenedor |
+
+La app no falla inmediatamente. Lee su contenedor como un proceso normal, permitido hasta macOS 26. En 27, si existe una autorización de la firma antigua, se rechaza por no coincidir el requisito de código:
+
+```
+sandboxd rejected approval request from WeChat for kTCCServiceSystemPolicyAppData
+  (/Users/<user>/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files): denied
+runningboardd: termination reported by launchd (0, 0, 65280)
+```
+
+El mismo WeChat firmado de nuevo en la misma máquina:
+
+| Sistema | Comportamiento |
+|------|------|
+| macOS 26.6.2 | Uso normal durante dos días y medio |
+| macOS 27.0 | Se cierra unos 0.4 segundos después de cada arranque |
+
+::: warning Haber funcionado antes no demuestra que sea seguro
+Una app firmada de nuevo puede funcionar semanas o meses y fallar en la siguiente actualización importante, sin avisos antes ni después. Además, el certificado original del desarrollador no está en su Mac; no se pueden recrear los derechos eliminados firmando otra vez. Hay que reinstalar.
+:::
+
+## Por qué se abre desde Terminal
+
+Esto puede confundir el diagnóstico. El sistema atribuye permisos al «proceso responsable». Desde Finder o Dock, la propia app solicita acceso con su identidad y se rechaza. Desde Terminal u otra app que ya tiene acceso total al disco, la responsabilidad se atribuye al anfitrión y la app toma prestados sus permisos.
+
+Por tanto, abrir desde Terminal n
```

**File**: `User_docs/docs/es/datamigrae/mount-migration.md` (added, +176/-0)
```diff
@@ -0,0 +1,176 @@
+---
+outline: deep
+---
+
+# Migración por montaje: llevar los datos de contenedores al disco externo
+
+::: tip Lo esencial
+Los datos de `~/Library/Containers/` y `~/Library/Group Containers/`, como el historial de WeChat, la caché de QQ Music y los datos de apps de App Store, no se pueden trasladar mediante enlaces simbólicos. Desde AppPorts 1.8.2, se crea un volumen APFS de datos dedicado en el disco externo, se copian los datos y el volumen se **monta en el directorio original**. La app ve la misma ruta y su firma no cambia.
+
+Tres requisitos: disco APFS sin encriptar, aceptar el permiso al abrir la app por primera vez y conectar el disco antes de usarla.
+:::
+
+## Cuándo se utiliza
+
+En «Directorios de datos» → «App Data», seleccione una app. Los directorios de `Containers` y `Group Containers` muestran «Migración por montaje» en vez de «Migrate». Otros grupos, como `Application Support` y cachés, y los directorios de herramientas o personalizados siguen usando enlaces simbólicos.
+
+Para saber por qué los contenedores son especiales y por qué no se toma como criterio el aislamiento del programa principal, consulte [Datos de contenedores, aislamiento e identidad de firma](/es/datamigrae/container-identity).
+
+## Después de pulsar «Migración por montaje» {#preflight}
+
+AppPorts primero comprueba el almacenamiento externo en modo de solo lectura, sin cambiar nada, y después propone el siguiente paso:
+
+| Resultado | Qué se muestra | Opciones |
+|---|---|---|
+| APFS sin encriptar y con espacio suficiente | Espacio que se liberará en el Mac, permiso de la primera apertura y necesidad de mantener el disco conectado | «Migrar datos» para empezar |
+| exFAT, NTFS, HFS+, etc. | «Este almacenamiento externo tiene formato exFAT» | «Dejar como está», «Elegir otra ubicación», «Ver cómo prepararlo» |
+| APFS encriptado | «Este almacenamiento externo está encriptado» | Dejar como está o elegir una ubicación APFS sin encriptar |
+| Espacio insuficiente | Espacio necesario y disponible | Liberar espacio y volver a comprobar, o elegir otra ubicación |
+| No hay almacenamiento seleccionado o conectado | Indicación para seleccionarlo o conectarlo | Seleccionar almacenamiento y volver a comprobar |
+
+**Si no puede migrar, no necesita cambiar nada.** La app, `Application Support`, las cachés y los directorios de herramientas pueden seguir migrándose a ese disco. Solo quedan los datos de contenedores en el Mac y la app se usa con normalidad. Para migrarlos más adelante, siga [Preparar un disco externo APFS](/es/why-apfs#prepare-apfs).
+
+::: info Por qué aún no se admiten discos APFS encriptados
+El nuevo volumen de datos no hereda la contraseña del original. Migrar normalmente dejaría en un volumen sin contraseña un historial antes protegido localmente por FileVault. AppPorts no reduce esa protección de forma silenciosa mientras no estén resueltos el desbloqueo automático y la gestión de contraseñas. Consulte [Discos externos encriptados](/es/why-apfs#encrypted-drives).
+:::
+
+## Antes de migrar
+
+- **Coloque AppPorts en Aplicaciones y ábralo desde allí.** El agente necesita una ruta permanente. Al ejecutarlo desde Descargas o un DMG, macOS puede usar una ruta temporal de App Translocation; si se detecta, AppPorts bloquea nuevas migraciones por montaje y pide instalarse. Tras mover o actualizar AppPorts, ábralo una vez para ajustar la ruta del agente. Si la ruta no cambia, el agente no se recarga.
+- **Cierre completamente la app que va a migrar.** AppPorts lo comprueba e impide migrar mientras esté ejecutándose.
+- **AppPorts necesita acceso total al disco.** El sistema controla el montaje en rutas de contenedores y lo rechaza sin permiso.
+- **Piense en las copias de seguridad.** Como en cualquier migración, haga una copia independiente de los datos importantes. Después estarán en el disco externo, que Time Machine normalmente no incluye. Compruebe su inclusión en las opciones de Ajustes del Sistema › General › Time Machine si lo necesita.
+
+## Qué ocurre durante la migración
+
+1. Se crea un volumen en el contenedor APFS externo sin montarlo automáticamente en `/Volumes`. Su nombre sigue el patrón `AppPorts-<Bundle ID>-<目录名>-xxxxxx` y comparte el espacio libre con los demás volúmenes, sin tamaño fijo.
+2. Se monta temporalmente bajo `~/Library/Application Support/AppPorts/mounts/`, se copia el contenido con el copiador de AppPorts, se escribe `.appports-mount-metadata.plist` en la raíz y se desmonta.
+3. Se renombra el directorio original como copia de seguridad en el mismo volumen, se crea un directorio vacío en la ruta original, se monta el volumen allí y se verifica su identidad.
+4. Se escribe el registro en `~/Library/Application Support/AppPorts/container-mounts.plist`, se instala el agente de montaje automático al iniciar sesión y se elimina la copia de seguridad.
+
+Si falta espacio externo, AppPorts se detiene antes de crear el volumen. Si se produce un fallo antes de completar la
```

**File**: `User_docs/docs/es/datamigrae/operation.md` (modified, +71/-105)
```diff
@@ -2,145 +2,111 @@
 outline: deep
 ---
 
-# Guía de Operación de Migración de Datos
+# Guía práctica de migración de datos
 
-Esta página cubre el flujo de trabajo práctico para la migración de directorios de datos. Para detalles de implementación técnica, consulte [Implementación Básica](/es/datamigrae/baseinfo).
+Esta página explica cómo migrar directorios de datos. Para los detalles técnicos, consulte el [funcionamiento](/es/datamigrae/baseinfo).
 
-## Encontrar Directorios de Datos Asociados a Aplicaciones
+## Buscar los directorios asociados a una app
 
-1. Cambie a la pestaña "Directorios de Datos" en la ventana principal de AppPorts
-2. El panel izquierdo muestra todas las aplicaciones instaladas
-3. Haga clic en una aplicación; el panel derecho muestra sus directorios de datos asociados bajo `~/Library/`
+1. Abra la pestaña «Directorios de datos» en la ventana principal de AppPorts.
+2. En la parte superior, cambie entre «Directorios de herramientas» y «App Data».
+3. Para los datos de apps, seleccione una app a la izquierda. A la derecha aparecerán sus directorios asociados en `~/Library/`.
 
-AppPorts escanea automáticamente los siguientes directorios, haciendo coincidir por Bundle ID o nombre de la aplicación:
+AppPorts busca las siguientes ubicaciones mediante el Bundle ID o el nombre de la app:
 
-| Ruta de Escaneo | Método de Coincidencia |
-|-----------------|----------------------|
-| `~/Library/Application Support/` | Bundle ID o nombre de app |
-| `~/Library/Preferences/` | Bundle ID o nombre de app |
-| `~/Library/Containers/` | Bundle ID |
-| `~/Library/Group Containers/` | Bundle ID |
-| `~/Library/Caches/` | Bundle ID o nombre de app |
-| `~/Library/WebKit/` | Bundle ID |
-| `~/Library/HTTPStorages/` | Bundle ID |
-| `~/Library/Application Scripts/` | Bundle ID |
-| `~/Library/Logs/` | Nombre de app |
-| `~/Library/Saved Application State/` | Nombre de app |
+| Ruta analizada | Coincidencia | Método de migración |
+|------|------|------|
+| `~/Library/Application Support/` | Bundle ID o nombre de la app | Enlace simbólico |
+| `~/Library/Preferences/` | Bundle ID o nombre de la app | Enlace simbólico |
+| `~/Library/Containers/` | Bundle ID | **Migración por montaje** |
+| `~/Library/Group Containers/` | Bundle ID | **Migración por montaje** |
+| `~/Library/Caches/` | Bundle ID o nombre de la app | Enlace simbólico |
+| `~/Library/WebKit/` | Bundle ID | Enlace simbólico |
+| `~/Library/HTTPStorages/` | Bundle ID | Enlace simbólico |
+| `~/Library/Application Scripts/` | Bundle ID | Enlace simbólico |
+| `~/Library/Logs/` | Nombre de la app | Enlace simbólico |
+| `~/Library/Saved Application State/` | Nombre de la app | Enlace simbólico |
 
-## Directorios de Herramientas (Dot-Folders)
+Para saber por qué los contenedores son distintos, consulte [Migración por montaje](/es/datamigrae/mount-migration).
 
-AppPorts puede detectar automáticamente dot-folders creados por herramientas de desarrollo comunes en el directorio home del usuario:
+## Directorios de herramientas
 
-1. Cambie a la subpestaña "Directorios de Herramientas" en la pestaña Directorios de Datos
-2. La página lista todos los directorios de herramientas detectados con sus tamaños
-3. Cada directorio muestra un marcador de prioridad (recommended/optional) y estado
+AppPorts reconoce los directorios que crean las herramientas de desarrollo habituales en la carpeta de inicio, como `~/.npm` y `~/.gradle`:
 
-Si falta un directorio de herramienta local pero la ubicación canónica del almacenamiento externo seleccionado todavía contiene un directorio gestionado por AppPorts, el elemento aparece como "Necesita Revinculación". Al cambiar de almacenamiento externo, AppPorts vuelve a escanear los directorios de herramientas y actualiza este estado. Los archivos normales no se tratan como directorios revinculables.
+1. En «Directorios de datos», cambie a «Directorios de herramientas».
+2. La lista muestra los directorios reconocidos, su tamaño, prioridad y estado.
 
-Para la lista completa soportada, consulte [Detección de Directorios de Herramientas](/es/datamigrae/tools).
+Si no existe el directorio local pero sigue habiendo un directorio gestionado por AppPorts en la ubicación canónica externa, aparece «Pendiente de reenlace». Consulte la lista en [Reconocimiento de directorios de herramientas](/es/datamigrae/tools).
 
-## Migración de Directorios (Carpetas Personalizadas)
+## Migración de carpetas personalizadas
 
-La pestaña "Migración de Directorios" migra carpetas de usuario arbitrarias. Es útil para proyectos grandes, modelos, bibliotecas de recursos o cachés de herramientas que desea mover al almacenamiento externo.
+La pestaña «Directory Migration» permite migrar cualquier carpeta dentro de la carpeta de inicio y resulta útil para proyectos grandes, modelos y bibliotecas de recursos.
 
-1. Cambie a "Migración de Directorios" en la ventana principal
-2. Haga clic en el botón "+" del encabezado "Carpetas Locales"
-3. Elija la
```

**File**: `User_docs/docs/es/datamigrae/resign.md` (modified, +58/-108)
```diff
@@ -2,145 +2,95 @@
 outline: deep
 ---
 
-# Re-firmado y Prevención de Fallos
+# Firma y prevención de cierres inesperados
 
 ![](https://pic.cdn.shimoko.com/appports/%E6%88%AA%E5%B1%8F2026-05-08%2008.38.37.png)
 
-## Por Qué las Aplicaciones Pueden Fallar Después de la Migración de Datos
+::: warning Volver a firmar no es una solución universal
+Volver a firmar con Ad-hoc sustituye la firma del desarrollador y elimina los derechos de aislamiento, grupos de apps y llavero. Una app aislada, como WeChat o una app de App Store, podría no abrirse en macOS 27 y perder su sesión. La nueva versión guarda primero la app original completa para restaurar su firma y derechos; restaurar la firma no garantiza recuperar una sesión que ya se haya perdido.
 
-El mecanismo de firma de código de macOS (`codesign`) verifica la integridad del paquete de la aplicación, incluyendo la estructura de rutas de archivos. Cuando AppPorts migra el directorio de datos de una aplicación al almacenamiento externo y lo reemplaza con un enlace simbólico, el sello de firma se rompe, causando los siguientes problemas:
-
-- **Bloqueo de Gatekeeper**: `codesign --verify --deep --strict` detecta un fallo de firma; el sistema muestra un diálogo de "Dañado" o "de desarrollador no identificado", bloqueando el inicio de la aplicación
-- **Interrupción del Acceso a Keychain**: Las aplicaciones que dependen de grupos de acceso a Keychain no pueden leer las credenciales almacenadas debido a cambios en la identidad de firma
-- **Fallo de Entitlements**: Algunos entitlements de aplicaciones están vinculados a la identidad de firma; después de cambios de firma, los entitlements no coinciden
+Desde la versión 1.8.2, AppPorts rechaza por defecto volver a firmar apps aisladas. Solo se permite al activar el modo clásico y confirmar los riesgos. Los datos de contenedores usan [migración por montaje](/es/datamigrae/mount-migration), sin modificar la firma. Consulte [Datos de contenedores, aislamiento e identidad de firma](/es/datamigrae/container-identity).
+:::
 
-### Tipos de Aplicaciones de Alto Riesgo
+## Qué problema resuelve volver a firmar
 
-| Tipo de App | Nivel de Riesgo | Razón |
-|-------------|----------------|-------|
-| Apps con auto-actualización Sparkle | **Alto** | El actualizador puede eliminar o reemplazar la app, dañando los enlaces simbólicos |
-| Apps con auto-actualización Electron | **Alto** | `electron-updater` también puede interferir con las apps en almacenamiento externo |
-| Apps dependientes de Keychain | **Alto** | El firmado Ad-hoc cambia la identidad de firma; los grupos de acceso a Keychain fallan |
-| Apps de Mac App Store | **Alto** | Protección SIP; no se pueden re-firmar |
-| Apps con auto-actualización nativa (Chrome, Edge) | Medio | La auto-actualización puede reemplazar la copia externa, invalidando la entrada local |
-| Apps iOS (versión Mac) | Bajo | Usa Stub Portal o whole symlink; menos problemas de firma |
+macOS comprueba la integridad de las apps mediante la firma de código. Tras mover la app al disco externo y dejar un lanzador local, a veces el sistema considera que se ha modificado y rechaza abrirla con un aviso de que está dañada o procede de un desarrollador no identificado. En ese caso, volver a firmar con Ad-hoc **la app real del disco externo** puede permitir que supere la comprobación.
 
-### Tipos de Directorios de Datos de Alto Riesgo
+Ese es su único propósito. No guarda relación con migrar directorios de datos; asociarlo a la migración de contenedores en versiones antiguas originó los problemas de macOS 27.
 
-| Tipo de Datos | Nivel de Riesgo | Razón |
-|---------------|----------------|-------|
-| `~/Library/Application Support/` | Medio | La app puede usar bloqueos de archivos, registros WAL de SQLite o atributos extendidos; puede comportarse anormalmente a través de enlaces simbólicos |
-| `~/Library/Group Containers/` | Medio | Compartido por múltiples apps bajo el mismo Team; los enlaces simbólicos pueden interferir con otras apps |
-| `~/Library/Preferences/` | Bajo-Medio | `cfprefsd` cachea archivos plist; los enlaces simbólicos pueden causar lectura de datos obsoletos |
-| `~/Library/Caches/` | Bajo | Los cachés son reconstruibles; la mayoría de las apps manejan la ausencia de caché con gracia |
+## Cuándo no usarlo
 
-## Mecanismo de Re-firmado
+| Situación | Explicación |
+|------|------|
+| App aislada | Se rechaza por defecto; el modo clásico lo permite tras confirmar los riesgos, pero se debe priorizar la migración por montaje |
+| App de App Store | SIP la protege y no se puede volver a firmar |
+| App cuya sesión depende del llavero | Volver a firmar hace perder la sesión |
+| App con widgets o extensiones de compartir | La pérdida de derechos de grupos impide a las extensiones leer datos compartidos |
+| App que se abre normalmente | Si no hay problema, no vuelva a firmarla |
 
-### Firmado Ad-hoc
+Considérelo únicamente si aparece realmente un aviso de app dañada tras migrarla al di
```

---

### Incident Patch 10: `b34f1736` (2026-09-26)
**Commit Message**: docs(fr): sync mount migration and recovery guides

**File**: `User_docs/docs/fr/AppPorts.md` (modified, +45/-45)
```diff
@@ -2,43 +2,43 @@
 outline: deep
 ---
 
-# Guide Utilisateur AppPorts
+# Guide utilisateur AppPorts
 
-Ce guide présente de manière systématique les fonctionnalités, les principes de conception et l'implémentation technique d'AppPorts. Pour plus de détails techniques, consultez [DeepWiki](https://deepwiki.com/wzh4869/AppPorts). Pour des suggestions d'amélioration, veuillez les soumettre sur la page [Issues](https://github.com/wzh4869/AppPorts/issues) du projet.
+Ce guide présente les principales fonctionnalités d’AppPorts, ses principes de conception et son fonctionnement technique. Pour plus de détails techniques, consultez [DeepWiki](https://deepwiki.com/wzh4869/AppPorts). Les suggestions d’amélioration sont les bienvenues dans les [Issues](https://github.com/wzh4869/AppPorts/issues) du projet.
 
-## Vue d'ensemble
+## Présentation
 
-AppPorts est un outil de migration et de liaison d'applications conçu pour [macOS](https://www.apple.com/macos/), prenant en charge la migration d'applications volumineuses vers des périphériques de stockage externes tout en maintenant une fonctionnalité et une cohérence système complètes.
+AppPorts est un outil de migration et de liaison d’applications conçu pour [macOS](https://www.apple.com/macos/). Il permet de déplacer les applications volumineuses vers un périphérique de stockage externe, en préservant autant que possible leur comportement dans Finder, Launchpad, les menus d’applications et les mises à jour du système.
 
-### Philosophie d'AppPorts
+### Philosophie d’AppPorts
 
 | Principe | Description |
-|----------|-------------|
-| **Expérience transparente** | Garantit que l'expérience utilisateur et le système d'exploitation perçoivent l'application comme étant toujours exécutée depuis le stockage interne |
-| **Stratégie stable** | Privilégie les approches de migration éprouvées et plus stables |
-| **Faible charge système** | Pas de démons, évite la consommation continue de ressources système |
-| **Internationalisation étendue** | Privilégie la couverture de plus de langues ; largeur de traduction plutôt que précision |
-| **Accessibilité conviviale** | Support complet de l'accessibilité |
+|------|------|
+| **Expérience transparente** | Faire en sorte que l’utilisateur et le système utilisent les applications migrées comme des applications locales |
+| **Stratégies stables** | Privilégier les méthodes éprouvées offrant une migration plus stable |
+| **Faible charge système** | Ne pas dépendre de démons et éviter de consommer des ressources système en permanence |
+| **Internationalisation étendue** | Couvrir davantage de langues et améliorer continuellement la qualité des traductions |
+| **Accessibilité** | Offrir une prise en charge de l’accessibilité aussi complète que possible |
 
 ## Fonctionnalités principales
 
-- **Migration sans badge** : Migration en un clic d'applications volumineuses vers des disques externes. Seul un shell de lancement léger est conservé localement ; le Finder n'affiche pas de flèches de raccourci ; le Launchpad et le menu des applications macOS fonctionnent normalement.
-- **Protection des mises à jour automatiques** : Détecte automatiquement les applications avec support de mise à jour automatique (Sparkle, Electron, Chrome, etc.), fournissant une option « Migration verrouillée » pour empêcher les mises à jour automatiques de supprimer ou d'écraser les applications sur le disque externe.
-- **Synchronisation de version Stub Portal** : Lorsqu'une application externe est mise à jour via l'App Store, les informations de version du Stub Portal local sont automatiquement synchronisées, gardant le menu « Ouvrir avec » précis.
-- **Répertoires de scan personnalisés** : Ajoutez des répertoires de scan d'applications locales supplémentaires (par ex. JetBrains Toolbox, Steam). Les répertoires sont sauvegardés et automatiquement surveillés.
-- **Gestion des signatures de code** : Après la migration, si un message « Endommagé » apparaît, re-signature en un clic via le menu contextuel. Supporte la sauvegarde et la restauration des signatures originales ; re-signature automatique après la migration du répertoire de données.
-- **Support App Store macOS 15.1+** : Prend en charge l'installation directe d'applications App Store sur des disques externes avec mises à jour in situ sur le disque externe.
-- **Restauration en un clic** : Prend en charge la remigration des applications vers le stockage interne avec suppression automatique des liens. Récupération automatique en cas d'interruption de la migration.
-- **Gestion des répertoires de données** : Prend en charge la migration des répertoires de données d'applications (sous-répertoires `~/Library/`, `~/.npm`, etc.) vers le stockage externe, avec regroupement en arborescence, recherche et tri.
-- **Migration de répertoires** : Déplace des dossiers réels arbitraires du dossier personnel de l'utilisateur vers le stockage externe, utile pour grands projets, modèles, bibliothèques de ressources et
```

**File**: `User_docs/docs/fr/badges.md` (modified, +63/-49)
```diff
@@ -2,83 +2,97 @@
 outline: deep
 ---
 
-# Badges de statut
+# Guide des badges d’état
 
-AppPorts affiche le statut actuel des applications et des répertoires de données à l'aide de badges colorés en forme de capsule. Certains badges sont cliquables pour obtenir des informations détaillées.
+AppPorts utilise des badges colorés en forme de capsule pour indiquer l’état des applications et des répertoires de données. Certains badges sont cliquables et affichent des explications ou des conseils supplémentaires.
 
-## Badges de statut des applications
+## Badges des applications
 
-### Statut de liaison
+### État du lien
 
 | Badge | Icône | Couleur | Signification |
-|-------|-------|---------|---------------|
-| Lié | `link` | Vert | Application migrée vers le stockage externe avec entrée locale |
-| Migration verrouillée | `lock.fill` | Vert | Liée et verrouillée avec `uchg`, empêchant les mises à jour automatiques d'endommager l'application externe |
-| Migration déverrouillée | `lock.open` | Orange | Liée mais non verrouillée ; les mises à jour dans l'application peuvent supprimer l'application externe |
-| Lien partiel | `link.badge.plus` | Jaune | Composants partiels de l'application liés (par ex., certains fichiers `.app` dans un répertoire) |
-| Lien orphelin | `link.badge.exclamationmark` | Rouge | Application externe perdue mais entrée locale toujours existante |
-| Non liée | `externaldrive.badge.xmark` | Orange | Application sur le stockage externe mais non liée en retour localement |
-| Externe | `externaldrive` | Orange | Application sur le stockage externe sans entrée locale |
-| Migration sortante en attente | `arrow.up.right.circle` | Cyan | La vraie application locale est plus récente que l'ancienne copie externe et peut la remplacer |
-| Locale | `macmini` | Couleur secondaire | Application locale régulière, non migrée ; affichée quand aucun autre tag n'est présent |
-
-::: tip Détection de la migration sortante en attente
-AppPorts associe d'abord les applications locales et externes par Bundle ID, puis utilise le nom d'application normalisé si nécessaire. Le statut n'apparaît que si les deux versions sont comparables et que la version locale est plus récente.
+|------|------|------|------|
+| Lié | `link` | Vert | L’application a été migrée vers le stockage externe et possède une entrée locale |
+| Migration verrouillée | `lock.fill` | Vert | L’application est liée et verrouillée avec `uchg` pour protéger la copie externe des mises à jour automatiques |
+| Migration non verrouillée | `lock.open` | Orange | L’application est liée mais non verrouillée ; une mise à jour depuis l’application peut supprimer ou écraser la copie externe |
+| Partiellement lié | `link.badge.plus` | Jaune | Certains composants de l’application sont liés, par exemple certains paquets `.app` d’un répertoire |
+| Lien orphelin | `link.badge.exclamationmark` | Rouge | L’application externe est introuvable, mais son entrée locale existe toujours |
+| Non lié | `externaldrive.badge.xmark` | Orange | L’application se trouve sur le stockage externe et n’a pas encore été reliée au Mac |
+| Externe | `externaldrive` | Orange | Application externe sans entrée locale |
+| Sortie en attente | `arrow.up.right.circle` | Cyan | La véritable application locale est plus récente que sa copie externe du même nom ; elle peut être déplacée pour remplacer cette ancienne copie |
+| Local | `macmini` | Couleur secondaire | Application locale ordinaire, non migrée ; affiché en l’absence d’autre badge |
+
+::: tip Comment « Sortie en attente » est déterminé
+AppPorts rapproche d’abord les applications locales et externes par Bundle ID, puis, si nécessaire, par leur nom normalisé. « Sortie en attente » n’apparaît que si les deux numéros de version sont comparables et que la version locale est plus récente. Si une version manque, si son format ne permet pas la comparaison ou si deux applications de même nom ont des Bundle ID différents, AppPorts conserve l’état local ordinaire pour éviter d’écraser la mauvaise application externe.
 :::
 
-### Labels de framework
+### Frameworks
 
-| Badge | Icône | Couleur | Signification | Action au clic |
-|-------|-------|---------|---------------|----------------|
-| Sparkle | `arrow.triangle.2.circlepath` | Cyan | Utilise le framework Sparkle pour les mises à jour automatiques | Après migration vers le stockage externe, les mises à jour dans l'application peuvent causer la perte de l'application externe ; migration verrouillée recommandée |
-| Electron | `atom` | Indigo | Basé sur le framework Electron avec support de mise à jour automatique | Après migration vers le stockage externe, les mises à jour dans l'application peuvent causer la perte de l'application externe ; migration verrouillée recommandée |
+| Badge | Icône | Couleur | Signification | Explication au clic |
+|------|------|------|------|----------|
+| Sparkle | `arrow.triangle.2.circlepath` | Cyan | Utilise le framework Sparkle pour les mise
```

**File**: `User_docs/docs/fr/changelog.md` (modified, +33/-0)
```diff
@@ -4,6 +4,39 @@ outline: deep
 
 # Journal des modifications
 
+## v1.8.2 (en développement)
+
+### Changements importants
+
+- **Les données de conteneur passent à la migration par montage** : les répertoires sous `~/Library/Containers/` et `~/Library/Group Containers/` ne sont plus migrés par lien symbolique. AppPorts crée un volume dédié sur un disque externe APFS et le monte à l’emplacement d’origine, sans modifier la signature de l’application. Un disque externe APFS est nécessaire ; à la première ouverture de l’application, autorisez l’accès aux « Volumes amovibles ». Voir la [migration par montage](/fr/datamigrae/mount-migration).
+- **Les applications en bac à sable ne sont plus jamais resignées** : le menu contextuel, l’option « Re-signer après la migration » et le script de nouvelle signature à la connexion les ignorent tous. Une signature appliquée à une application en bac à sable par une ancienne version peut l’empêcher de s’ouvrir sous macOS 27. Voir le [guide de mise à niveau vers macOS 27](/fr/macos-27).
+- **Correction de « Restaurer la signature originale »** : l’application d’origine est sauvegardée intégralement avant toute nouvelle signature, puis remplacée en sécurité après vérification d’une copie de travail. La signature et les autorisations d’origine peuvent être restaurées sans la clé privée du développeur. Pour les anciens enregistrements, une copie officielle de la même version peut servir à la réparation ; une application mise à jour ou une sauvegarde endommagée ne provoquera pas de remplacement forcé.
+- **Détection automatique des signatures remplacées et assistance à la réparation** : la liste affiche le badge rouge « Signature remplacée » et un rappel est présenté une fois au démarrage. Le menu contextuel « Voir les étapes de réparation » ouvre un panneau qui guide successivement la restauration des données, le retour de l’application sur le Mac, sa réinstallation et la migration par montage, sans supprimer de données. Le badge disparaît après réinstallation et rétablissement de la signature. L’analyse conserve les éléments nécessaires à la restauration ; les sauvegardes sont nettoyées une fois la restauration effectuée par AppPorts.
+- **Mode classique de migration des données** : une nouvelle option dans les paramètres est désactivée par défaut et demande de confirmer les risques avant activation. Elle rétablit la méthode de la version 1.8.1, avec lien symbolique et nouvelle signature, uniquement pour les utilisateurs qui dépendent déjà de cette ancienne méthode. Si le disque externe n’est pas APFS, il est recommandé de garder la situation actuelle plutôt que de l’activer.
+- « Re-signature à la connexion » est désactivé par défaut pour les nouvelles installations ; les utilisateurs ayant déjà installé l’agent de connexion conservent leur réglage.
+- Pour les répertoires de conteneur, « Normaliser », « Relier » et « Détails du lien » sont désactivés hors du mode classique afin d’éviter de recréer des liens symboliques.
+
+### Améliorations
+
+- **Un clic sur « Migration par montage » lance d’abord une vérification en lecture seule, puis des explications adaptées** : avec un stockage APFS non chiffré, AppPorts présente la migration, l’espace libérable, l’autorisation nécessaire à la première ouverture et la nécessité de garder le disque connecté. Avec exFAT / NTFS / HFS+, un disque chiffré, un espace insuffisant ou un disque déconnecté, il explique la raison et propose notamment « Garder en l’état », « Choisir un autre emplacement » et « Voir la préparation », sans rien modifier. Les vérifications de préparation de l’accueil et des paramètres suivent les mêmes règles et n’orientent plus les utilisateurs sans APFS vers le mode classique.
+- **Les volumes de données n’apparaissent plus dans Finder** : les nouveaux volumes ne sont pas montés automatiquement sous `/Volumes` et utilisent `nobrowse` au montage. Les volumes montés par une version antérieure seront masqués sur place au prochain démarrage ou branchement, sans démontage.
+- **La migration par montage ne prend pas encore en charge les disques APFS chiffrés** : un nouveau volume de données n’hérite pas du mot de passe du volume d’origine. AppPorts s’arrête et l’explique au lieu de créer silencieusement un volume non chiffré.
+- **L’espace disponible est vérifié avant migration et restauration** : si le disque externe ou le Mac manque d’espace, l’opération s’arrête avant de créer le volume ou de copier les données.
+- **Restauration plus sûre** : après démontage, seuls les points de montage vides sont supprimés, sans suppression récursive. Les répertoires temporaires portent désormais un nom masqué. Si la dernière étape échoue, le volume externe et son enregistrement restent intacts, et AppPorts indique où se trouve la copie locale.
+- **AppPorts n’intervient que sur ses propres volumes** : l’identité du volume au point de montage est vérifiée avant montage, démontage ou restauration. L’opération ne démarre pas sans le 
```

**File**: `User_docs/docs/fr/datamigrae/baseinfo.md` (modified, +63/-64)
```diff
@@ -2,98 +2,97 @@
 outline: deep
 ---
 
-# Implémentation de base de la migration des données
+# Fonctionnement de la migration des données
 
 ![](https://pic.cdn.shimoko.com/appports/%E6%88%AA%E5%B1%8F2026-05-08%2008.38.05.png)
 
-La fonctionnalité de migration des données d'AppPorts migre les répertoires de données associés aux applications (tels que `~/Library/Application Support`, `~/Library/Caches`, etc.) vers le stockage externe pour libérer de l'espace disque local.
+La migration des données d’AppPorts déplace les répertoires associés aux applications vers un disque externe pour libérer de l’espace local. Deux stratégies sont utilisées selon leur emplacement :
 
-## Stratégie principale : Lien symbolique
+| Répertoire | Stratégie | Raison |
+|------|------|------|
+| `~/Library/Containers/`, `~/Library/Group Containers/` | Migration par montage | Le bac à sable vérifie le chemin réel résolu et refuse les liens symboliques qui sortent du conteneur |
+| Autres sous-répertoires de `~/Library/`, répertoires d’outils et dossiers personnalisés | Lien symbolique | La solution la plus simple, sans restriction du bac à sable |
 
-La migration des répertoires de données utilise la stratégie **Whole Symlink** :
+Cette page décrit les liens symboliques. Pour l’autre stratégie, consultez [Migration par montage](/fr/datamigrae/mount-migration).
 
-1. Copier l'intégralité du répertoire local original vers le stockage externe
-2. Écrire les métadonnées de lien géré (`.appports-link-metadata.plist`) dans le répertoire externe
-3. Renommer le répertoire local original en sauvegarde de sécurité cachée sur le même volume
-4. Créer un lien symbolique à l'emplacement d'origine pointant vers la copie externe
-5. Nettoyer la sauvegarde locale après la création réussie du lien symbolique
+## Stratégie des liens symboliques
+
+1. Copier intégralement le répertoire local sur le disque externe.
+2. Écrire le marqueur de gestion `.appports-link-metadata.plist` dans le répertoire externe.
+3. Renommer le répertoire local d’origine en sauvegarde de sécurité masquée sur le même volume.
+4. Créer au chemin d’origine un lien symbolique vers la copie externe.
+5. Supprimer la sauvegarde de sécurité une fois le lien créé.
 
 ```
 ~/Library/Application Support/SomeApp
-    → /Volumes/External/AppPortsData/SomeApp  (symlink)
+    → /Volumes/External/AppPortsData/SomeApp  （符号链接）
 ```
 
-## Flux de migration
-
 ```mermaid
 flowchart TD
-    A[Sélectionner le répertoire de données] --> B{Vérification des permissions et de la protection}
-    B -->|Échec| Z[Terminer]
-    B -->|Réussi| C{Détection de conflit de chemin cible}
-    C -->|Métadonnées gérées présentes| D[Mode de récupération automatique]
-    C -->|Pas de conflit| E[Copier vers le stockage externe]
+    A[Choisir un répertoire de données] --> B{Vérifier les permissions et protections}
+    B -->|Échec| Z[Arrêter]
+    B -->|Réussite| C{Rechercher un conflit de destination}
+    C -->|Marqueur de gestion identique| D[Mode de reprise automatique]
+    C -->|Conflit avec un répertoire réel| Y[Arrêter et signaler le conflit]
+    C -->|Aucun conflit| E[Copier sur le disque externe]
     D --> E
-    E --> F[Écrire les métadonnées de lien géré]
-    F --> G[Renommer le répertoire local en sauvegarde]
+    E --> F[Écrire le marqueur de gestion]
+    F --> G[Renommer en sauvegarde locale de sécurité]
     G -->|Échec| H[Conserver la copie externe et arrêter]
-    G -->|Réussi| I[Créer le lien symbolique]
+    G -->|Réussite| I[Créer le lien symbolique]
     I -->|Échec| J[Restaurer la sauvegarde locale et conserver la copie externe]
-    I -->|Réussi| K[Nettoyer la sauvegarde locale]
-    K -->|Réussi| L[Migration terminée]
-    K -->|Échec| M[Migration terminée ; sauvegarde conservée]
+    I -->|Réussite| K[Supprimer la sauvegarde locale]
+    K -->|Réussite| L[Migration terminée]
+    K -->|Échec| M[Migration terminée avec sauvegarde conservée]
 ```
 
-## Métadonnées de lien géré
+## Marqueur de gestion
 
-AppPorts écrit un fichier `.appports-link-metadata.plist` dans le répertoire externe pour identifier que le répertoire est géré par AppPorts. Les métadonnées incluent :
+Le fichier `.appports-link-metadata.plist` dans le répertoire externe indique qu’AppPorts le gère :
 
 | Champ | Description |
-|-------|-------------|
-| `schemaVersion` | Numéro de version des métadonnées (actuellement 1) |
-| `managedBy` | Identifiant du gestionnaire (`com.shimoko.AppPorts`) |
-| `sourcePath` | Chemin local original |
-| `destinationPath` | Chemin cible du stockage externe |
+|------|------|
+| `schemaVersion` | Numéro de version, actuellement 1 |
+| `managedBy` | `com.shimoko.AppPorts` |
+| `sourcePath` | Chemin local d’origine |
+| `destinationPath` | Chemin de destination externe |
 | `dataDirType` | Type de répertoire de données |
 
-Ces métadonnées sont utilisées lors de l'analyse pour distinguer les liens gérés par AppPorts des liens symboliques créés par l'utilisateur, et supportent la ré
```

**File**: `User_docs/docs/fr/datamigrae/container-identity.md` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+---
+outline: deep
+---
+
+# Données de conteneur, bac à sable et identité de signature
+
+::: tip L’essentiel
+Les données de `~/Library/Containers/` et `~/Library/Group Containers/` appartiennent à des **applications en bac à sable**. Les déplacer sur un disque externe avec un « raccourci », ou lien symbolique, les rend illisibles pour l’application. AppPorts contournait cela en re-signant l’application, au prix d’échecs d’ouverture possibles sous macOS 27 et d’une perte de session.
+
+Depuis la version 1.8.2, les conteneurs utilisent la [migration par montage](/fr/datamigrae/mount-migration), sans modifier un octet de signature. Les applications déjà re-signées doivent être réinstallées ; voir le [guide de mise à niveau vers macOS 27](/fr/macos-27).
+:::
+
+Cette page explique l’origine du problème. Si votre application ne s’ouvre plus, consultez directement les réparations du [guide macOS 27](/fr/macos-27).
+
+## Qu’est-ce qu’un conteneur ?
+
+La plupart des applications macOS fonctionnent dans un bac à sable. Le système réserve à chacune un dossier `~/Library/Containers/<Bundle ID>/` dans lequel elle peut lire et écrire. C’est obligatoire pour l’App Store et courant aussi pour les applications téléchargées sur leur site, comme WeChat ou QQ Music. Les données partagées entre applications se trouvent dans `~/Library/Group Containers/`.
+
+Pour reconnaître une application en bac à sable, cherchez `com.apple.security.app-sandbox` dans ses autorisations :
+
+```bash
+codesign -d --entitlements - --xml /Applications/WeChat.app 2>/dev/null | grep -c app-sandbox
+# 输出 1 就是沙盒应用
+```
+
+**Un programme principal non isolé ne signifie pas que ses conteneurs peuvent être déplacés librement.** Chrome et Edge n’isolent pas leur programme principal, mais leurs widgets et extensions ont leurs propres conteneurs, appartenant à des processus isolés. AppPorts traite donc tous les répertoires sous `Containers` de la même manière, indépendamment du programme principal.
+
+## Trois façons de déplacer les données de conteneur
+
+| Méthode | Résultat | Raison |
+|------|------|------|
+| Copier sur le disque externe et laisser un lien symbolique | L’application s’ouvre mais ne lit pas les données ; WeChat indique que l’emplacement de stockage est inutilisable | Le bac à sable vérifie **la destination** du lien et refuse toute sortie du conteneur, vers un disque externe comme vers le bureau |
+| Lien symbolique et re-signature Ad-hoc | Fonctionne sous macOS 26 et antérieurs ; peut quitter immédiatement après double-clic sous 27, confirmé avec WeChat mais pas QQ Music | Le lien « fonctionne » parce que la signature retire l’identité de bac à sable. Elle supprime aussi le lien d’appartenance entre application et conteneur, vérifié à partir de 27 |
+| Monter un volume APFS externe sur le répertoire d’origine | Fonctionnement normal, signature inchangée | Le chemin reste dans le conteneur et passe le contrôle. Le stockage externe provoque une demande d’autorisation à accepter une fois |
+
+Les trois méthodes ont été vérifiées sous macOS 27. Les journaux originaux figurent dans les expériences sur les [liens symboliques](/en/research/sandbox-symlink) et les [points de montage](/en/research/sandbox-mountpoint).
+
+## Ce que la re-signature modifie réellement
+
+Une re-signature Ad-hoc avec `codesign --force --deep --sign -` retire :
+
+| Élément perdu | Conséquence |
+|------|------|
+| `com.apple.security.app-sandbox` | L’application ne s’exécute plus avec une identité de bac à sable |
+| `com.apple.security.application-groups` | Les données partagées dans `Group Containers` ne sont plus lisibles |
+| `keychain-access-groups` | La session et les clés de base de données du trousseau ne sont plus accessibles |
+| Team ID | L’identité ne correspond plus lors de la vérification de propriété du conteneur |
+
+L’application ne tombe pas immédiatement en panne. Elle lit son conteneur comme un processus ordinaire, ce que macOS 26 et antérieurs autorisent. Sous 27, si une autorisation liée à son ancienne signature existe déjà, l’accès est refusé pour non-correspondance de l’exigence de code :
+
+```
+sandboxd rejected approval request from WeChat for kTCCServiceSystemPolicyAppData
+  (/Users/<user>/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files): denied
+runningboardd: termination reported by launchd (0, 0, 65280)
+```
+
+Pour le même WeChat re-signé sur la même machine :
+
+| Système | Comportement |
+|------|------|
+| macOS 26.6.2 | Utilisation normale pendant deux jours et demi |
+| macOS 27.0 | Fermeture environ 0.4 seconde après chaque lancement |
+
+::: warning Avoir fonctionné auparavant ne prouve pas l’absence de risque
+Une application re-signée peut fonctionner plusieurs semaines ou mois, puis échouer à la prochaine mise à niveau majeure, sans avertissement avant ou après. Le certificat d’origine du développeur n’est pas sur votre Mac ; les autorisations retirées ne peuvent pas être recréé
```

**File**: `User_docs/docs/fr/datamigrae/mount-migration.md` (added, +176/-0)
```diff
@@ -0,0 +1,176 @@
+---
+outline: deep
+---
+
+# Migration par montage : placer les données de conteneur sur un disque externe
+
+::: tip L’essentiel
+Les données de `~/Library/Containers/` et `~/Library/Group Containers/`, comme l’historique WeChat, le cache QQ Music et les données des applications App Store, ne peuvent pas être déplacées par lien symbolique. Depuis AppPorts 1.8.2, un volume de données APFS dédié est créé sur le disque externe. Les données y sont copiées, puis le volume est **monté sur le répertoire d’origine**. Le chemin vu par l’application et sa signature restent identiques.
+
+Trois conditions : un disque APFS non chiffré, accepter l’autorisation à la première ouverture de l’application et connecter le disque avant de l’utiliser.
+:::
+
+## Quand cette méthode s’applique
+
+Dans « Répertoires de données » → « App Data », sélectionnez une application. Pour les répertoires des groupes `Containers` et `Group Containers`, le bouton affiche « Migration par montage » au lieu de « Migrate ». Les autres groupes, comme `Application Support` et les caches, ainsi que les répertoires d’outils et personnalisés, continuent à utiliser les liens symboliques.
+
+Pour comprendre pourquoi les conteneurs sont particuliers et pourquoi le bac à sable du programme principal n’est pas le critère, consultez [Données de conteneur, bac à sable et identité de signature](/fr/datamigrae/container-identity).
+
+## Après avoir cliqué sur « Migration par montage » {#preflight}
+
+AppPorts effectue d’abord une vérification en lecture seule du stockage externe, sans rien modifier, puis propose la suite adaptée :
+
+| Résultat | Affichage | Options |
+|---|---|---|
+| APFS non chiffré avec assez d’espace | Espace libéré sur ce Mac, autorisation à accepter à la première ouverture et nécessité de garder le disque connecté | « Migrer les données » pour commencer |
+| exFAT, NTFS, HFS+, etc. | « Ce stockage externe utilise le format exFAT » | « Garder en l’état », « Choisir un autre emplacement », « Voir la préparation » |
+| APFS chiffré | « Ce stockage externe est chiffré » | Garder en l’état ou choisir un emplacement APFS non chiffré |
+| Espace insuffisant | Espace nécessaire et espace restant | Libérer de l’espace et vérifier à nouveau, ou choisir un autre emplacement |
+| Aucun stockage choisi ou disque déconnecté | Invitation à choisir ou connecter un stockage externe | Choisir un stockage et vérifier à nouveau |
+
+**Si la migration est impossible, vous n’avez rien à changer.** L’application, `Application Support`, les caches et les répertoires d’outils peuvent toujours être migrés sur ce disque. Seules les données de conteneur restent sur ce Mac, sans gêner l’utilisation. Pour les migrer plus tard, suivez [Préparer un disque externe APFS](/fr/why-apfs#prepare-apfs).
+
+::: info Pourquoi les disques APFS chiffrés ne sont pas encore pris en charge
+Le nouveau volume de données n’hérite pas du mot de passe du volume d’origine. Migrer ainsi placerait sur un volume sans mot de passe un historique de discussion auparavant protégé localement par FileVault. AppPorts ne réduit pas discrètement cette protection tant que le déverrouillage automatique et la gestion des mots de passe ne sont pas prêts. Voir [Disques externes chiffrés](/fr/why-apfs#encrypted-drives).
+:::
+
+## Avant la migration
+
+- **Placez AppPorts dans le dossier Applications et ouvrez-le depuis ce dossier.** L’agent de connexion a besoin d’un chemin durable. Depuis Téléchargements ou un DMG, macOS peut utiliser un chemin temporaire App Translocation ; AppPorts bloque alors les nouvelles migrations par montage et demande son installation. Après avoir déplacé ou mis à jour AppPorts, ouvrez-le une fois pour corriger le chemin de l’agent. Si le chemin ne change pas, l’agent n’est pas rechargé.
+- **Quittez complètement l’application concernée.** AppPorts vérifie qu’elle n’est plus en cours d’exécution.
+- **AppPorts doit disposer de l’accès complet au disque.** Le système contrôle le montage sur un chemin de conteneur et le refuse sans cette autorisation.
+- **Pensez à la sauvegarde.** Comme pour toute migration, sauvegardez d’abord les données importantes. Ensuite, ces données sont sur le disque externe, que Time Machine ne sauvegarde généralement pas. Au besoin, vérifiez son inclusion dans les options de Réglages Système › Général › Time Machine.
+
+## Ce qui se passe pendant la migration
+
+1. Créer un volume dans le conteneur APFS du disque externe, sans montage automatique dans `/Volumes`. Son nom suit le modèle `AppPorts-<Bundle ID>-<目录名>-xxxxxx`. Il partage l’espace libre avec les autres volumes et ne nécessite pas de taille fixe.
+2. Monter temporairement le volume sous `~/Library/Application Support/AppPorts/mounts/`, y copier le contenu avec le copieur d’AppPorts, écrire `.appports-mount-metadata.plist` à sa racine, puis le démonter.
+3. Renommer le répertoire original en sauvegarde de sécurité sur le même volume, créer un répertoire vide à son ancien 
```

**File**: `User_docs/docs/fr/datamigrae/operation.md` (modified, +71/-105)
```diff
@@ -2,145 +2,111 @@
 outline: deep
 ---
 
-# Guide d'opération de migration des données
+# Guide pratique de migration des données
 
-Cette page couvre le flux de travail pratique pour la migration des répertoires de données. Pour les détails d'implémentation technique, voir [Implémentation de base](/fr/datamigrae/baseinfo).
+Cette page décrit les opérations de migration des répertoires de données. Pour les détails techniques, consultez le [fonctionnement](/fr/datamigrae/baseinfo).
 
-## Trouver les répertoires de données associés aux applications
+## Trouver les répertoires associés à une application
 
-1. Basculer vers l'onglet « Répertoires de données » dans la fenêtre principale d'AppPorts
-2. Le panneau gauche affiche toutes les applications installées
-3. Cliquer sur une application ; le panneau droit affiche ses répertoires de données associés sous `~/Library/`
+1. Dans la fenêtre principale d’AppPorts, ouvrez l’onglet « Répertoires de données ».
+2. En haut, choisissez « Répertoires d'outils » ou « App Data ».
+3. Pour les données d’application, sélectionnez une application à gauche. Ses répertoires associés dans `~/Library/` apparaissent à droite.
 
-AppPorts analyse automatiquement les répertoires suivants, en les associant par Bundle ID ou nom de l'application :
+AppPorts utilise le Bundle ID ou le nom de l’application pour trouver les emplacements suivants :
 
-| Chemin d'analyse | Méthode d'association |
-|------------------|-----------------------|
-| `~/Library/Application Support/` | Bundle ID ou nom de l'application |
-| `~/Library/Preferences/` | Bundle ID ou nom de l'application |
-| `~/Library/Containers/` | Bundle ID |
-| `~/Library/Group Containers/` | Bundle ID |
-| `~/Library/Caches/` | Bundle ID ou nom de l'application |
-| `~/Library/WebKit/` | Bundle ID |
-| `~/Library/HTTPStorages/` | Bundle ID |
-| `~/Library/Application Scripts/` | Bundle ID |
-| `~/Library/Logs/` | Nom de l'application |
-| `~/Library/Saved Application State/` | Nom de l'application |
+| Chemin analysé | Correspondance | Méthode de migration |
+|------|------|------|
+| `~/Library/Application Support/` | Bundle ID ou nom de l’application | Lien symbolique |
+| `~/Library/Preferences/` | Bundle ID ou nom de l’application | Lien symbolique |
+| `~/Library/Containers/` | Bundle ID | **Migration par montage** |
+| `~/Library/Group Containers/` | Bundle ID | **Migration par montage** |
+| `~/Library/Caches/` | Bundle ID ou nom de l’application | Lien symbolique |
+| `~/Library/WebKit/` | Bundle ID | Lien symbolique |
+| `~/Library/HTTPStorages/` | Bundle ID | Lien symbolique |
+| `~/Library/Application Scripts/` | Bundle ID | Lien symbolique |
+| `~/Library/Logs/` | Nom de l’application | Lien symbolique |
+| `~/Library/Saved Application State/` | Nom de l’application | Lien symbolique |
 
-## Répertoires d'outils (Dot-Folders)
+Pour comprendre le cas particulier des conteneurs, consultez [Migration par montage](/fr/datamigrae/mount-migration).
 
-AppPorts peut détecter automatiquement les dot-folders créés par les outils de développement courants dans le répertoire personnel de l'utilisateur :
+## Répertoires d’outils
 
-1. Basculer vers le sous-onglet « Répertoires d'outils » dans l'onglet Répertoires de données
-2. La page liste tous les répertoires d'outils détectés avec leurs tailles
-3. Chaque répertoire affiche un badge de priorité (recommended/optional) et un statut
+AppPorts reconnaît les répertoires créés par les outils de développement courants dans le dossier personnel, comme `~/.npm` ou `~/.gradle` :
 
-Si un répertoire d'outil local est absent mais que l'emplacement canonique du stockage externe sélectionné contient encore un répertoire géré par AppPorts, l'élément apparaît comme « Nécessite une re-liaison ». Changer de stockage externe déclenche une nouvelle analyse et actualise cet état. Les fichiers ordinaires ne sont pas traités comme des répertoires pouvant être reliés.
+1. Dans « Répertoires de données », choisissez « Répertoires d'outils ».
+2. La liste affiche les répertoires reconnus, leur taille, leur priorité et leur état.
 
-Pour la liste complète supportée, voir [Détection des répertoires d'outils](/fr/datamigrae/tools).
+Si le répertoire local n’existe plus, mais qu’un répertoire géré par AppPorts reste à l’emplacement canonique du disque externe, son état est « En attente de reconnexion ». Voir la liste dans [Reconnaissance des répertoires d’outils](/fr/datamigrae/tools).
 
-## Migration de répertoires (dossiers personnalisés)
+## Migration de dossiers personnalisés
 
-L'onglet « Migration de répertoires » migre des dossiers utilisateur arbitraires. Il convient aux grands projets, modèles, bibliothèques de ressources ou caches d'outils à déplacer vers le stockage externe.
+L’onglet « Directory Migration » déplace n’importe quel dossier du dossier personnel. Il convient aux grands projets, modèles et bibliothèques de ressources.
 
-1. Ouvrir « Migration de répertoires » dans la fenêtre p
```

**File**: `User_docs/docs/fr/datamigrae/resign.md` (modified, +57/-107)
```diff
@@ -6,141 +6,91 @@ outline: deep
 
 ![](https://pic.cdn.shimoko.com/appports/%E6%88%AA%E5%B1%8F2026-05-08%2008.38.37.png)
 
-## Pourquoi les applications peuvent planter après la migration des données
+::: warning Re-signer n’est pas une réparation universelle
+Une re-signature Ad-hoc remplace la signature du développeur et retire les autorisations de bac à sable, de groupes d’applications et de trousseau. Une application en bac à sable, comme WeChat ou une application App Store, peut alors ne plus s’ouvrir sous macOS 27 et perdre sa session de connexion. La nouvelle version conserve d’abord l’application d’origine complète afin de restaurer sa signature et ses autorisations ; la restauration de la signature ne garantit pas celle d’une session déjà perdue.
 
-Le mécanisme de signature de code de macOS (`codesign`) vérifie l'intégrité du package applicatif, y compris la structure des chemins de fichiers. Quand AppPorts migre le répertoire de données d'une application vers le stockage externe et le remplace par un lien symbolique, le sceau de signature est rompu, provoquant les problèmes suivants :
-
-- **Blocage Gatekeeper** : `codesign --verify --deep --strict` détecte un échec de signature ; le système affiche une boîte de dialogue « Endommagé » ou « d'un développeur non identifié », bloquant le lancement de l'application
-- **Perturbation d'accès Keychain** : Les applications dépendant des groupes d'accès Keychain ne peuvent pas lire les identifiants stockés en raison des changements d'identité de signature
-- **Échec des droits (Entitlements)** : Certains droits d'application sont liés à l'identité de signature ; après un changement de signature, les droits ne correspondent plus
+Depuis la version 1.8.2, AppPorts refuse par défaut de re-signer les applications en bac à sable. Il faut activer le mode classique et confirmer les risques. Les données de conteneur utilisent désormais la [migration par montage](/fr/datamigrae/mount-migration), sans modification de signature. Voir [Données de conteneur, bac à sable et identité de signature](/fr/datamigrae/container-identity).
+:::
 
-### Types d'applications à haut risque
+## Quel problème la re-signature résout-elle ?
 
-| Type d'application | Niveau de risque | Raison |
-|---------------------|------------------|--------|
-| Applications avec mise à jour automatique Sparkle | **Élevé** | Le programme de mise à jour peut supprimer ou remplacer l'application, endommageant les liens symboliques |
-| Applications avec mise à jour automatique Electron | **Élevé** | `electron-updater` peut également interférer avec les applications sur le stockage externe |
-| Applications dépendant de Keychain | **Élevé** | La signature Ad-hoc change l'identité de signature ; les groupes d'accès Keychain échouent |
-| Applications Mac App Store | **Élevé** | Protection SIP ; ne peut pas être re-signée |
-| Applications avec mise à jour automatique native (Chrome, Edge) | Moyen | La mise à jour automatique peut remplacer la copie externe, invalidant l'entrée locale |
-| Applications iOS (version Mac) | Faible | Utilise Stub Portal ou whole symlink ; moins de problèmes de signature |
+macOS vérifie l’intégrité des applications par leur signature de code. Après avoir déplacé l’application sur un disque externe et laissé un lanceur local, le système peut parfois la considérer comme modifiée et refuser son ouverture avec « endommagée » ou « développeur non identifié ». Une re-signature Ad-hoc de **l’application réelle sur le disque externe** peut alors lui permettre de passer la vérification.
 
-### Types de répertoires de données à haut risque
+C’est le seul rôle de la re-signature. Elle n’a pas de rapport avec la migration des répertoires de données ; son association à la migration des conteneurs dans les anciennes versions est à l’origine des problèmes sous macOS 27.
 
-| Type de données | Niveau de risque | Raison |
-|-----------------|------------------|--------|
-| `~/Library/Application Support/` | Moyen | L'application peut utiliser des verrous de fichiers, des journaux SQLite WAL ou des attributs étendus ; peut se comporter anormalement à travers les liens symboliques |
-| `~/Library/Group Containers/` | Moyen | Partagé par plusieurs applications sous la même équipe ; les liens symboliques peuvent interférer avec d'autres applications |
-| `~/Library/Preferences/` | Faible-Moyen | `cfprefsd` met en cache les fichiers plist ; les liens symboliques peuvent provoquer la lecture de données obsolètes |
-| `~/Library/Caches/` | Faible | Les caches sont reconstituables ; la plupart des applications gèrent gracieusement l'absence de cache |
+## Quand ne pas l’utiliser
 
-## Mécanisme de re-signature
+| Situation | Explication |
+|------|------|
+| Application en bac à sable | Refusée par défaut ; autorisée en mode classique après confirmation, mais privilégiez la migration par montage |
+| Application App Store | Protégée par SIP, elle ne peut pas être re-signée |
+| Application utili
```

---

### Incident Patch 11: `a759308c` (2026-09-26)
**Commit Message**: docs(de): sync mount migration and recovery guides

**File**: `User_docs/docs/de/AppPorts.md` (modified, +44/-44)
```diff
@@ -4,41 +4,41 @@ outline: deep
 
 # AppPorts Benutzerhandbuch
 
-Dieses Handbuch stellt systematisch die Funktionen, Designprinzipien und technische Umsetzung von AppPorts vor. Weitere technische Details finden Sie unter [DeepWiki](https://deepwiki.com/wzh4869/AppPorts). Verbesserungsvorschläge bitte über die Projekt-[Issues](https://github.com/wzh4869/AppPorts/issues) einreichen.
+Dieses Handbuch beschreibt die Kernfunktionen, Designprinzipien und technische Umsetzung von AppPorts. Weitere technische Details finden Sie im [DeepWiki](https://deepwiki.com/wzh4869/AppPorts). Verbesserungsvorschläge können Sie in den [Issues](https://github.com/wzh4869/AppPorts/issues) des Projekts einreichen.
 
 ## Überblick
 
-AppPorts ist ein Anwendungsmigrations- und Verknüpfungstool für [macOS](https://www.apple.com/macos/), das die Migration großer Anwendungen auf externe Speichergeräte unterstützt, während die vollständige Systemfunktionalität und Konsistenz erhalten bleibt.
+AppPorts ist ein Werkzeug für [macOS](https://www.apple.com.cn/os/macos/), mit dem Sie Apps auf externe Speichergeräte migrieren und lokal verknüpfen können. Große Apps lassen sich so auslagern, während das Verhalten von Finder, Launchpad, App-Menüs und Systemupdates möglichst unverändert bleibt.
 
-### AppPorts-Philosophie
+### Die Philosophie von AppPorts
 
 | Prinzip | Beschreibung |
-|---------|--------------|
-| **Transparente Erfahrung** | Stellt sicher, dass die Benutzererfahrung und das Betriebssystem die App weiterhin als vom internen Speicher ausgeführt wahrnehmen |
-| **Stabile Strategie** | Bevorzugt erprobte, stabilere Migrationsansätze |
-| **Geringe Systemlast** | Keine Daemons, vermeidet kontinuierliche Systemressourcenverbrauch |
-| **Breite Internationalisierung** | Bevorzugt die Abdeckung vieler Sprachen; Übersetzungsbreite vor Präzision |
-| **Barrierefreiheitsfreundlich** | Umfassende Barrierefreiheitsunterstützung |
+|------|------|
+| **Vertraute Nutzung** | Migrierte Apps sollen sich für Benutzer und Betriebssystem möglichst wie lokale Apps verhalten |
+| **Stabile Verfahren** | Erprobte Verfahren mit höherer Migrationsstabilität haben Vorrang |
+| **Geringe Systemlast** | Keine Abhängigkeit von Daemons, um eine dauerhafte Belegung von Systemressourcen zu vermeiden |
+| **Breite Internationalisierung** | Möglichst viele Sprachen unterstützen und die Übersetzungsqualität laufend verbessern |
+| **Barrierefreiheit** | Möglichst umfassende Unterstützung für Bedienungshilfen bieten |
 
 ## Kernfunktionen
 
-- **Badge-freie Migration**: Ein-Klick-Migration großer Apps auf externe Laufwerke. Lokal bleibt nur eine leichte Launcher-Hülle übrig; der Finder zeigt keine Verknüpfungspfeile an; Launchpad und macOS-App-Menü funktionieren normal.
-- **Auto-Update-Schutz**: Erkennt automatisch Apps mit Auto-Update-Unterstützung (Sparkle, Electron, Chrome usw.) und bietet eine Option „Gesperrte Migration", um zu verhindern, dass Auto-Updater Apps auf dem externen Laufwerk löschen oder überschreiben.
-- **Stub Portal Versions-Synchronisierung**: Wenn externe Apps über den App Store aktualisiert werden, werden die Versionsinformationen des lokalen Stub Portals automatisch synchronisiert, sodass das Menü „Öffnen mit" stets die korrekte Version anzeigt.
-- **Benutzerdefinierte Scan-Verzeichnisse**: Zusätzliche lokale App-Scan-Verzeichnisse (z. B. JetBrains Toolbox, Steam) können hinzugefügt werden. Verzeichnisse werden gespeichert und automatisch überwacht.
-- **Code-Signatur-Verwaltung**: Falls nach der Migration eine „Beschädigt"-Meldung erscheint, Ein-Klick-Neuzeichnung über das Rechtsklickmenü. Unterstützt das Sichern und Wiederherstellen der ursprünglichen Signaturen; automatische Neuzeichnung nach Datenverzeichnismigration.
-- **macOS 15.1+ App Store-Unterstützung**: Unterstützt die Installation von App Store-Apps direkt auf externe Laufwerke mit In-Place-Updates auf dem externen Laufwerk.
-- **Ein-Klick-Wiederherstellung**: Unterstützt die Rückmigration von Apps in den lokalen Speicher mit automatischer Linkentfernung. Automatische Wiederherstellung bei unterbrochener Migration.
-- **Datenverzeichnisverwaltung**: Unterstützt die Migration von App-Datenverzeichnissen (`~/Library/`-Unterverzeichnisse, `~/.npm` usw.) in den externen Speicher, mit Baumansicht-Gruppierung, Suche und Sortierung.
-- **Verzeichnismigration**: Verschiebt beliebige echte Ordner unter dem Benutzer-Home in externen Speicher, nützlich für große Projekte, Modelle, Asset-Bibliotheken und Tool-Caches, mit Neuverlinkung, Wiederherstellung und Pfadüberschneidungsprüfung.
+- **Migration ohne Verknüpfungspfeil**: Große Apps mit einem Klick auf externen Speicher migrieren. Lokal bleibt nur eine schlanke Launcher-Hülle. Finder zeigt keinen Verknüpfungspfeil an; Launchpad und die macOS-App-Menüs zeigen die App weiterhin normal an.
+- **Schutz vor automatischen Updates**: Erkennt Apps mit eigenen Updatern wie Sparkle, Electron und Chrome und bietet „Gesperrte Migration“ an, dam
```

**File**: `User_docs/docs/de/badges.md` (modified, +73/-55)
```diff
@@ -4,81 +4,99 @@ outline: deep
 
 # Status-Badges
 
-AppPorts zeigt den aktuellen Status von Apps und Datenverzeichnissen mit kapselförmigen farbigen Badges an. Einige Badges sind anklickbar für detaillierte Informationen.
-
-## App-Status-Badges
-
-### Linkstatus
-
-| Badge | Icon | Farbe | Bedeutung |
-|-------|------|-------|-----------|
-| Verknüpft | `link` | Grün | App in den externen Speicher migriert mit lokalem Eintrag |
-| Gesperrte Migration | `lock.fill` | Grün | Verknüpft und mit `uchg` gesperrt, verhindert Beschädigung der externen App durch Selbstupdates |
-| Entsperre Migration | `lock.open` | Orange | Verknüpft aber nicht gesperrt; In-App-Updates können die externe App löschen |
-| Teilweise verknüpft | `link.badge.plus` | Gelb | Teilweise App-Komponenten verknüpft (z. B. einige `.app`-Dateien in einem Verzeichnis) |
-| Verwaister Link | `link.badge.exclamationmark` | Rot | Externe Speicher-App verloren, aber lokaler Eintrag vorhanden |
-| Nicht verknüpft | `externaldrive.badge.xmark` | Orange | App auf externem Speicher, aber lokal nicht verknüpft |
-| Extern | `externaldrive` | Orange | App auf externem Speicher ohne lokalen Eintrag |
-| Ausstehendes Herausverschieben | `arrow.up.right.circle` | Cyan | Die echte lokale App ist neuer als die alte externe Kopie und kann nach extern verschoben werden, um sie zu ersetzen |
-| Lokal | `macmini` | Sekundärfarbe | Normale lokale App, nicht migriert; wird angezeigt, wenn keine anderen Tags vorhanden sind |
-
-::: tip Erkennung von ausstehendem Herausverschieben
-AppPorts gleicht lokale und externe Apps zuerst per Bundle ID ab und nutzt bei Bedarf den normalisierten App-Namen als Fallback. Der Status erscheint nur, wenn beide Versionen vergleichbar sind und die lokale Version neuer ist.
+AppPorts zeigt den Status von Apps und Datenverzeichnissen mit farbigen, kapselförmigen Badges an. Einige Badges lassen sich anklicken, um weitere Erklärungen oder Handlungsempfehlungen zu öffnen.
+
+## App-Status
+
+### Verknüpfungsstatus
+
+| Badge | Symbol | Farbe | Bedeutung |
+|------|------|------|------|
+| Verknüpft | `link` | Grün | Die App wurde auf externen Speicher migriert und ein lokaler Zugang erstellt |
+| Gesperrte Migration | `lock.fill` | Grün | Die App ist verknüpft und mit `uchg` gesperrt, damit eigene Updater die externe Kopie nicht beschädigen |
+| Ungesperrte Migration | `lock.open` | Orange | Die App ist verknüpft, aber nicht gesperrt. Updates innerhalb der App können die externe Kopie löschen oder überschreiben |
+| Teilweise verknüpft | `link.badge.plus` | Gelb | Nur einige Bestandteile sind verknüpft, etwa einzelne `.app`-Pakete in einem Verzeichnis |
+| Verwaister Link | `link.badge.exclamationmark` | Rot | Die App auf dem externen Speicher fehlt, doch der lokale Zugang existiert noch |
+| Nicht verknüpft | `externaldrive.badge.xmark` | Orange | Die App liegt auf externem Speicher und ist noch nicht lokal verknüpft |
+| Extern | `externaldrive` | Orange | Die App liegt auf externem Speicher und hat keinen lokalen Zugang |
+| Ausstehende Auslagerung | `arrow.up.right.circle` | Cyan | Die echte lokale App ist neuer als die gleichnamige externe Kopie und kann diese durch eine erneute Migration ersetzen |
+| Lokal | `macmini` | Sekundärfarbe | Normale lokale, nicht migrierte App. Wird angezeigt, wenn keine anderen Badges zutreffen |
+
+::: tip Wann erscheint „Ausstehende Auslagerung“?
+AppPorts gleicht lokale und externe Apps zuerst anhand der Bundle ID ab und verwendet bei Bedarf den normalisierten App-Namen als Rückfallmethode. „Ausstehende Auslagerung“ erscheint nur, wenn beide Versionsnummern vergleichbar sind und die lokale Version neuer ist. Fehlen Versionsangaben, sind ihre Formate nicht vergleichbar oder unterscheiden sich die Bundle IDs gleichnamiger Apps, bleibt der normale lokale Status bestehen. So wird ein versehentliches Überschreiben der externen App vermieden.
 :::
 
-### Framework-Labels
+### Framework-Badges
 
-| Badge | Icon | Farbe | Bedeutung | Klickaktion |
-|-------|------|-------|-----------|-------------|
-| Sparkle | `arrow.triangle.2.circlepath` | Cyan | Verwendet Sparkle-Framework für Auto-Updates | Nach Migration in den externen Speicher können In-App-Updates zum Verlust der externen App führen; gesperrte Migration empfohlen |
-| Electron | `atom` | Indigo | Basiert auf Electron-Framework mit Auto-Update-Unterstützung | Nach Migration in den externen Speicher können In-App-Updates zum Verlust der externen App führen; gesperrte Migration empfohlen |
+| Badge | Symbol | Farbe | Bedeutung | Erklärung beim Anklicken |
+|------|------|------|------|----------|
+| Sparkle | `arrow.triangle.2.circlepath` | Cyan | Verwendet Sparkle für automatische Updates | Nach der Migration können Updates innerhalb der App zum Verlust der externen Kopie führen. „Gesperrte Migration“ wird empfohlen |
+| Electron | `atom` | Indigo | Basiert auf Electron und unterstützt möglicherweise automatische Updates | Nach der Migration können U
```

**File**: `User_docs/docs/de/changelog.md` (modified, +33/-0)
```diff
@@ -4,6 +4,39 @@ outline: deep
 
 # Changelog
 
+## v1.8.2 (in Entwicklung)
+
+### Wichtige Änderungen
+
+- **Containerdaten verwenden jetzt die Mount-Migration**: Verzeichnisse unter `~/Library/Containers/` und `~/Library/Group Containers/` werden nicht mehr per symbolischem Link migriert. Stattdessen erstellt AppPorts ein eigenes Volume auf einem externen APFS-Laufwerk und bindet es am ursprünglichen Verzeichnis ein. Die App-Signatur bleibt unverändert. Ein externes APFS-Laufwerk ist erforderlich; beim ersten Öffnen der App müssen Sie den Zugriff auf „Wechselmedien“ erlauben. Siehe [Mount-Migration](/de/datamigrae/mount-migration).
+- **Sandbox-Apps werden grundsätzlich nicht mehr neu signiert**: Kontextmenü, „Nach Migration neu signieren“ und das automatische Anmeldeskript überspringen Sandbox-Apps. Eine erneute Signierung durch ältere Versionen kann dazu führen, dass sie unter macOS 27 nicht mehr starten. Abhilfe finden Sie unter [Upgrade auf macOS 27](/de/macos-27).
+- **„Originalsignatur wiederherstellen“ repariert**: Vor dem erneuten Signieren wird die Original-App vollständig gesichert. Die Signierung erfolgt in einer Arbeitskopie, die nach erfolgreicher Prüfung sicher eingesetzt wird. Originalsignatur und Berechtigungen können ohne privaten Entwicklerschlüssel wiederhergestellt werden. Für ältere Einträge lässt sich eine offizielle Original-App derselben Version auswählen. Bereits aktualisierte Apps und beschädigte Sicherungen werden nicht durch ein erzwungenes Ersetzen übergangen.
+- **Apps mit ersetzter Signatur automatisch erkennen und reparieren**: Die App-Liste zeigt das rote Badge „Signatur ersetzt“, und beim Start erscheint einmalig ein Hinweis. „Reparaturschritte anzeigen“ im Kontextmenü öffnet die Reparaturansicht und führt durch Datenwiederherstellung, Zurückholen auf den Mac, Neuinstallation und Mount-Migration, ohne Daten zu löschen. Nach einer Neuinstallation ist die Originalsignatur wieder vorhanden und das Badge verschwindet. Scans bewahren Wiederherstellungsmaterial auf; erst nach einer erfolgreichen Wiederherstellung durch AppPorts werden die Sicherungen aufgeräumt.
+- **Klassischer Datenmigrationsmodus**: Neuer, standardmäßig ausgeschalteter Schalter in den Einstellungen mit Risikobestätigung vor dem Aktivieren. Er stellt das Verfahren aus 1.8.1 mit symbolischen Links und erneutem Signieren wieder her und ist nur für Benutzer vorgesehen, die bereits davon abhängig sind. Verwendet das externe Laufwerk kein APFS, wird empfohlen, den aktuellen Zustand beizubehalten.
+- „Automatische Neuzeichnung bei Anmeldung“ ist bei Neuinstallationen standardmäßig ausgeschaltet. Bei Benutzern mit bereits installiertem Anmeldeagenten bleibt die bisherige Einstellung erhalten.
+- „Normalisieren“, „Erneut verlinken“ und „Linkdetails“ sind für Containerverzeichnisse außerhalb des klassischen Modus deaktiviert, damit keine symbolischen Links neu erstellt werden.
+
+### Verbesserungen
+
+- **„Mount-Migration“ prüft zuerst lesend und führt dann passend weiter**: Bei unverschlüsseltem APFS-Speicher erklärt AppPorts, wie viel Platz frei wird, dass beim ersten Öffnen der Zugriff erlaubt werden muss und dass das Laufwerk im Alltag angeschlossen bleiben muss. Bei exFAT / NTFS / HFS+, Verschlüsselung, zu wenig Platz oder fehlender Verbindung wird der Grund erklärt. Optionen wie „So belassen“, „Anderen Ort auswählen“ und „Vorbereitung ansehen“ stehen bereit, ohne Änderungen vorzunehmen. Die Bereitschaftsprüfung auf der Willkommensseite und in den Einstellungen verwendet dieselbe Anleitung und verweist Benutzer ohne APFS nicht mehr auf den klassischen Modus.
+- **Datenvolumes erscheinen nicht mehr im Finder**: Neue Volumes werden nicht automatisch unter `/Volumes` eingebunden und erhalten beim Einbinden `nobrowse`. Volumes früherer Versionen werden beim nächsten Start oder Anschließen direkt an ihrem bestehenden Mountpunkt ausgeblendet, ohne sie auszuhängen.
+- **Verschlüsselte APFS-Laufwerke unterstützen die Mount-Migration vorerst nicht**: Neue Datenvolumes übernehmen das Passwort des ursprünglichen Volumes nicht. AppPorts stoppt und erklärt dies, statt unbemerkt ein unverschlüsseltes Volume anzulegen.
+- **Freien Platz vor Migration und Wiederherstellung prüfen**: Reicht der Platz auf dem externen Laufwerk oder dem Mac nicht aus, stoppt AppPorts vor der Volume-Erstellung oder dem Kopieren.
+- **Sicherere Wiederherstellung**: Nach dem Aushängen wird nur ein leerer Mountpunkt gelöscht, nicht mehr rekursiv. Temporäre Verzeichnisse erhalten versteckte Namen. Scheitert der letzte Schritt, bleiben externes Volume und Eintrag unverändert, und AppPorts zeigt den Speicherort der lokalen Kopie an.
+- **Nur eigene Volumes verändern**: Vor Einbinden, Aushängen und Wiederherstellen wird die Identität des Volumes am Mountpunkt geprüft. Ohne die gemeinsame Sperre mit dem Anmeldeagenten beginnt kein Vorgang. Eine unlesbare Migrationsdatei wird nicht als leer behandelt und überschrieben.
+- **Pfad des Anmeldeagenten automatisc
```

**File**: `User_docs/docs/de/datamigrae/baseinfo.md` (modified, +74/-75)
```diff
@@ -2,98 +2,97 @@
 outline: deep
 ---
 
-# Datenmigration - Grundlegende Implementierung
+# Grundlagen der Datenmigration
 
 ![](https://pic.cdn.shimoko.com/appports/%E6%88%AA%E5%B1%8F2026-05-08%2008.38.05.png)
 
-Die Datenmigrationsfunktion von AppPorts migriert app-assoziierte Datenverzeichnisse (wie `~/Library/Application Support`, `~/Library/Caches` usw.) in den externen Speicher, um lokalen Speicherplatz freizugeben.
+AppPorts verschiebt zu Apps gehörende Datenordner auf ein externes Laufwerk und gibt lokalen Speicher frei. Je nach Speicherort verwendet es zwei Verfahren:
 
-## Kernstrategie: Symbolischer Link
+| Ordner | Verfahren | Grund |
+|------|------|------|
+| `~/Library/Containers/`, `~/Library/Group Containers/` | Mount-Migration | Die Sandbox prüft den aufgelösten tatsächlichen Pfad und verweigert symbolische Links nach außerhalb des Containers |
+| Andere Unterordner von `~/Library/`, Tool-Verzeichnisse und eigene Ordner | Symbolischer Link | Keine Sandbox-Beschränkung; einfachste Lösung |
 
-Die Datenverzeichnismigration verwendet die **Whole Symlink**-Strategie:
+Diese Seite erklärt symbolische Links. Das andere Verfahren steht unter [Mount-Migration](/de/datamigrae/mount-migration).
 
-1. Das gesamte ursprüngliche lokale Verzeichnis in den externen Speicher kopieren
-2. Verwaltete Link-Metadaten (`.appports-link-metadata.plist`) im externen Verzeichnis schreiben
-3. Das ursprüngliche lokale Verzeichnis auf demselben Volume in eine versteckte Sicherheitskopie umbenennen
-4. Einen symbolischen Link am ursprünglichen Pfad erstellen, der auf die externe Kopie verweist
-5. Die lokale Sicherheitskopie nach erfolgreicher Link-Erstellung bereinigen
+## Verfahren mit symbolischen Links
+
+1. Den lokalen Ordner vollständig extern kopieren.
+2. Die Verwaltungsmarkierung `.appports-link-metadata.plist` im externen Ordner schreiben.
+3. Den ursprünglichen lokalen Ordner als versteckte Sicherheitskopie auf demselben Volume umbenennen.
+4. Am ursprünglichen Pfad einen symbolischen Link zur externen Kopie erstellen.
+5. Nach erfolgreicher Linkerstellung die Sicherheitskopie bereinigen.
 
 ```
 ~/Library/Application Support/SomeApp
-    → /Volumes/External/AppPortsData/SomeApp  (symlink)
+    → /Volumes/External/AppPortsData/SomeApp  （符号链接）
 ```
 
-## Migrationsablauf
-
 ```mermaid
 flowchart TD
-    A[Datenverzeichnis auswählen] --> B[Berechtigungs- & Schutzprüfung]
-    B -->|Fehlgeschlagen| Z[Beenden]
-    B -->|Bestanden| C[Zielpfad-Konflikterkennung]
-    C -->|Hat verwaltete Metadaten| D[Auto-Wiederherstellungsmodus]
-    C -->|Kein Konflikt| E[In externen Speicher kopieren]
+    A[Datenordner auswählen] --> B{Berechtigungen und Schutz prüfen}
+    B -->|Fehler| Z[Abbrechen]
+    B -->|Bestanden| C{Zielpfad auf Konflikte prüfen}
+    C -->|Markierung vollständig passend| D[Automatische Wiederherstellung]
+    C -->|Konflikt mit echtem Ordner| Y[Anhalten und Konflikt melden]
+    C -->|Kein Konflikt| E[Extern kopieren]
     D --> E
-    E --> F[Verwaltete Link-Metadaten schreiben]
-    F --> G[Lokales Verzeichnis in Sicherheitskopie umbenennen]
-    G -->|Fehlgeschlagen| H[Externe Kopie behalten und stoppen]
-    G -->|Erfolgreich| I[Symbolischen Link erstellen]
-    I -->|Fehlgeschlagen| J[Lokale Sicherheitskopie wiederherstellen und externe Kopie behalten]
-    I -->|Erfolgreich| K[Lokale Sicherheitskopie bereinigen]
-    K -->|Erfolgreich| L[Migration abgeschlossen]
-    K -->|Fehlgeschlagen| M[Migration abgeschlossen; Sicherheitskopie bleibt erhalten]
+    E --> F[Verwaltungsmarkierung schreiben]
+    F --> G[Zur lokalen Sicherheitskopie umbenennen]
+    G -->|Fehler| H[Externe Kopie behalten und stoppen]
+    G -->|Erfolg| I[Symbolischen Link erstellen]
+    I -->|Fehler| J[Lokale Sicherheitskopie zurücksetzen und externe Kopie behalten]
+    I -->|Erfolg| K[Lokale Sicherheitskopie bereinigen]
+    K -->|Erfolg| L[Migration abgeschlossen]
+    K -->|Fehler| M[Migration abgeschlossen und Sicherheitskopie behalten]
 ```
 
-## Verwaltete Link-Metadaten
+## Verwaltungsmarkierung
 
-AppPorts schreibt eine `.appports-link-metadata.plist`-Datei im externen Verzeichnis, um zu kennzeichnen, dass das Verzeichnis von AppPorts verwaltet wird. Die Metadaten enthalten:
+`.appports-link-metadata.plist` im externen Ordner kennzeichnet ihn als von AppPorts verwaltet:
 
 | Feld | Beschreibung |
-|------|--------------|
-| `schemaVersion` | Metadaten-Versionsnummer (aktuell 1) |
-| `managedBy` | Verwaltungskennung (`com.shimoko.AppPorts`) |
+|------|------|
+| `schemaVersion` | Version, derzeit 1 |
+| `managedBy` | `com.shimoko.AppPorts` |
 | `sourcePath` | Ursprünglicher lokaler Pfad |
-| `destinationPath` | Externer Speicher-Zielpfad |
-| `dataDirType` | Datenverzeichnistyp |
-
-Diese Metadaten werden beim Scannen verwendet, um von AppPorts verwaltete Links von benutzererstellten symbolischen Links zu unterscheiden, und unterstützen die automatische Wiederherstellung bei unterbrochener Migration.
-
-Die automat
```

**File**: `User_docs/docs/de/datamigrae/container-identity.md` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+---
+outline: deep
+---
+
+# Containerdaten, Sandbox und Signaturidentität
+
+::: tip Kurz erklärt
+Daten in `~/Library/Containers/` und `~/Library/Group Containers/` gehören zu **Sandbox-Apps**. Werden sie über „Verknüpfungen“ (symbolische Links) extern ausgelagert, kann die App sie nicht lesen. AppPorts umging dies früher durch erneutes Signieren. Dadurch können Apps unter macOS 27 nicht mehr öffnen und Anmeldesitzungen verloren gehen.
+
+Seit 1.8.2 verwenden Containerdaten [Mount-Migration](/de/datamigrae/mount-migration), ohne ein Byte der Signatur zu ändern. Bereits neu signierte Apps müssen neu installiert werden. Siehe [Hinweise zum Upgrade auf macOS 27](/de/macos-27).
+:::
+
+Diese Seite erklärt die Hintergründe. Öffnet sich deine App bereits nicht mehr, gehe direkt zu den Reparaturschritten in den [Hinweisen zum Upgrade auf macOS 27](/de/macos-27).
+
+## Was ist ein Container?
+
+Die meisten macOS-Apps laufen in einer Sandbox. Das System gibt jeder App einen eigenen Ordner unter `~/Library/Containers/<Bundle ID>/`, in dem sie lesen und schreiben darf. Für App Store-Apps ist dies vorgeschrieben; auch direkt heruntergeladene Apps wie WeChat und QQ Music verwenden meist eine Sandbox. Gemeinsam genutzte Daten mehrerer Apps liegen in `~/Library/Group Containers/`.
+
+Ob eine App eine Sandbox verwendet, zeigt der Eintrag `com.apple.security.app-sandbox` in ihren Berechtigungen:
+
+```bash
+codesign -d --entitlements - --xml /Applications/WeChat.app 2>/dev/null | grep -c app-sandbox
+# 输出 1 就是沙盒应用
+```
+
+Leicht übersehen wird: **Eine Haupt-App ohne Sandbox bedeutet nicht, dass ihre Container beliebig verändert werden dürfen.** Die Hauptprogramme von Chrome und Edge laufen nicht in einer Sandbox, ihre Widgets und Erweiterungen haben aber eigene Container, die Sandbox-Prozessen gehören. AppPorts behandelt deshalb alle Ordner unter `Containers` gleich und richtet sich nicht nach der Haupt-App.
+
+## Drei Wege zum Auslagern von Containerdaten
+
+| Vorgehen | Ergebnis | Grund |
+|------|------|------|
+| Extern kopieren und am ursprünglichen Ort einen symbolischen Link hinterlassen | Die App öffnet sich, liest aber keine Daten; WeChat meldet einen nicht verwendbaren Speicherort | Die Sandbox prüft das **Ziel** des Links und verweigert Ziele außerhalb des Containers. Externes Laufwerk und Schreibtisch machen keinen Unterschied |
+| Symbolischer Link plus Ad-hoc-Neusignierung | Unter macOS 26 und älter nutzbar; unter 27 kann die App direkt nach dem Doppelklick schließen. Für WeChat bestätigt, QQ Music öffnet sich noch | Erst die entfernte Sandbox-Identität macht den Link nutzbar. Gleichzeitig geht die Zuordnung zwischen App und Container verloren, die das System ab 27 prüft |
+| Ein externes APFS-Volume am ursprünglichen Ordner einbinden | Funktioniert, Signatur bleibt unverändert | Der Pfad bleibt im Container, also erlaubt die Sandbox den Zugriff. Für die externen Daten erscheint einmal eine Systemabfrage, die du erlauben musst |
+
+Alle drei Wege wurden unter macOS 27 getestet. Die Originalprotokolle stehen in den [Versuchen mit symbolischen Links](/en/research/sandbox-symlink) und [Mountpunkten](/en/research/sandbox-mountpoint).
+
+## Was ändert erneutes Signieren genau?
+
+Ad-hoc-Neusignierung mit `codesign --force --deep --sign -` entfernt aus der App:
+
+| Verlorener Inhalt | Folge |
+|------------|------|
+| `com.apple.security.app-sandbox` | Die App läuft nicht mehr mit einer Sandbox-Identität |
+| `com.apple.security.application-groups` | Gemeinsame Daten in `Group Containers` sind nicht mehr lesbar |
+| `keychain-access-groups` | Anmeldedaten und Datenbankschlüssel im Schlüsselbund sind nicht mehr zugänglich |
+| Team ID | Die Systemprüfung, ob dieser Container der App gehört, stimmt nicht mehr |
+
+Die App fällt nicht sofort aus. Als normaler Prozess kann sie unter macOS 26 und älter ihren Container lesen. Unter 27 wird sie bei bereits gespeicherten Zugriffsregeln für ihre alte Signatur wegen nicht übereinstimmender Code-Anforderungen abgewiesen:
+
+```
+sandboxd rejected approval request from WeChat for kTCCServiceSystemPolicyAppData
+  (/Users/<user>/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files): denied
+runningboardd: termination reported by launchd (0, 0, 65280)
+```
+
+Dasselbe neu signierte WeChat auf demselben Rechner:
+
+| System | Verhalten |
+|------|------|
+| macOS 26.6.2 | Zweieinhalb Tage durchgehend normal genutzt |
+| macOS 27.0 | Beendet sich bei jedem Start nach etwa 0.4 Sekunden |
+
+::: warning „Bisher ging es immer“ belegt keine Sicherheit
+Nach der Neusignierung kann die App wochen- oder monatelang normal funktionieren und erst beim nächsten großen Systemupgrade ausfallen, ohne vorherige oder nachträgliche Warnung. Das Zertifikat des ursprünglichen Entwicklers liegt zudem nicht auf deinem Mac. Die entfernten Berechtigungen lassen sich nicht einfach zurücksignieren; die App muss neu installiert werden.
+:::
+
+## Warum öffnet sich die 
```

**File**: `User_docs/docs/de/datamigrae/mount-migration.md` (added, +176/-0)
```diff
@@ -0,0 +1,176 @@
+---
+outline: deep
+---
+
+# Mount-Migration: Containerdaten auf ein externes Laufwerk verschieben
+
+::: tip Kurz erklärt
+Daten in `~/Library/Containers/` und `~/Library/Group Containers/`, etwa WeChat-Chats, QQ Music-Caches und Daten von App Store-Apps, lassen sich nicht über symbolische Links auslagern. Seit AppPorts 1.8.2 wird dafür ein eigenes APFS-Datenvolume auf dem externen Laufwerk erstellt. AppPorts kopiert die Daten hinein und **bindet das Volume im ursprünglichen Ordner ein**. Der sichtbare Pfad und die App-Signatur bleiben unverändert.
+
+Drei Voraussetzungen: Das externe Laufwerk verwendet unverschlüsseltes APFS; beim ersten Öffnen der App erlaubst du den Zugriff; vor dem Öffnen schließt du das Laufwerk an.
+:::
+
+## Wann wird diese Methode verwendet?
+
+Wähle unter „Datenverzeichnisse“ → „App Data“ eine App. Bei Ordnern in den Gruppen `Containers` und `Group Containers` heißt die Schaltfläche „Mount-Migration“ statt „Migrate“. Andere Gruppen wie `Application Support` und Caches sowie Tool-Verzeichnisse und eigene Ordner verwenden weiterhin symbolische Links.
+
+Warum Containerordner besonders sind und warum nicht nur die Sandbox-Eigenschaft der Haupt-App zählt, erklärt [Containerdaten, Sandbox und Signaturidentität](/de/datamigrae/container-identity).
+
+## Nach dem Klick auf „Mount-Migration“ {#preflight}
+
+AppPorts prüft den externen Speicher zuerst nur lesend und verändert nichts. Das Ergebnis bestimmt den nächsten Schritt:
+
+| Prüfergebnis | Anzeige | Möglichkeiten |
+|---|---|---|
+| Unverschlüsseltes APFS, genügend Platz | Erklärung der Migration: freigegebener lokaler Speicher, Zugriffsabfrage beim ersten Öffnen, Laufwerk im Alltag angeschlossen halten | Mit „Daten migrieren“ starten |
+| exFAT, NTFS, HFS+ usw. | „Dieser externe Speicher verwendet exFAT“ | „So belassen“, „Anderen Ort auswählen“ oder „Vorbereitung ansehen“ |
+| Verschlüsseltes APFS | „Dieser externe Speicher ist verschlüsselt“ | So belassen oder einen unverschlüsselten APFS-Ort wählen |
+| Zu wenig Platz | Benötigter und verfügbarer Speicher | Platz schaffen und erneut prüfen oder einen anderen Ort wählen |
+| Kein externer Speicher ausgewählt / nicht verbunden | Aufforderung zum Auswählen oder Anschließen | „Externen Speicher auswählen“, „Erneut prüfen“ |
+
+**Wenn die Migration nicht möglich ist, musst du nichts ändern.** Apps, `Application Support`, Caches und Tool-Verzeichnisse lassen sich weiterhin auf dieses Laufwerk migrieren. Nur die Containerdaten bleiben lokal, und die App funktioniert wie gewohnt. Bei Bedarf kannst du später ein [APFS-Laufwerk vorbereiten](/de/why-apfs#prepare-apfs).
+
+::: info Warum verschlüsselte APFS-Laufwerke noch nicht unterstützt werden
+Das neue Datenvolume übernimmt das Passwort des ursprünglichen Volumes nicht. Lokal durch FileVault geschützte Chats würden sonst auf einem Volume ohne Passwort landen. Solange automatisches Entsperren und Passwortverwaltung nicht fertig sind, nimmt AppPorts diese unbemerkte Abschwächung nicht vor. Siehe [Verschlüsselte externe Laufwerke](/de/why-apfs#encrypted-drives).
+:::
+
+## Vor der Migration
+
+- **Verschiebe AppPorts zuerst in den Ordner „Programme“ und öffne es dort.** Der Anmeldeagent benötigt einen dauerhaft gültigen Programmpfad. Beim direkten Start aus Downloads oder einem DMG kann macOS einen temporären App Translocation-Pfad verwenden. Erkennt AppPorts diesen, blockiert es neue Mount-Migrationen und bittet um Installation. Öffne AppPorts nach dem Verschieben oder Aktualisieren einmal, damit der Agentenpfad angepasst wird. Bei unverändertem Pfad wird der Agent nicht neu geladen.
+- **Beende die zu migrierende App vollständig.** AppPorts prüft dies und erlaubt keine Migration laufender Apps.
+- **AppPorts benötigt Festplattenvollzugriff.** Das Einbinden an einem Containerpfad selbst wird vom System kontrolliert und schlägt ohne Berechtigung fehl.
+- **Denke an ein Backup.** Sichere wichtige Daten wie bei jeder Migration vorher selbst. Anschließend liegen diese Daten extern. Time Machine sichert externe Laufwerke normalerweise nicht; prüfe bei Bedarf unter „Systemeinstellungen › Allgemein › Time Machine“ in den Optionen, ob das Laufwerk enthalten ist.
+
+## Was während der Migration geschieht
+
+1. Im APFS-Container des externen Laufwerks wird ein Volume erstellt, das nicht automatisch unter `/Volumes` eingebunden wird. Sein Name hat die Form `AppPorts-<Bundle ID>-<目录名>-xxxxxx`. Es teilt sich den freien Speicher mit anderen Volumes; eine Größe muss nicht angegeben werden.
+2. Das Volume wird vorübergehend unter `~/Library/Application Support/AppPorts/mounts/` eingebunden. AppPorts kopiert den Ordnerinhalt hinein, schreibt `.appports-mount-metadata.plist` in die Volumewurzel und hängt das Volume wieder aus.
+3. Der ursprüngliche Ordner wird als Sicherheitskopie auf demselben Volume umbenannt. Am alten Pfad wird ein leerer Ordner angelegt, das Volume dort eingebunden und seine Identität geprüft.
+4. AppPorts schreibt de
```

**File**: `User_docs/docs/de/datamigrae/operation.md` (modified, +70/-104)
```diff
@@ -2,145 +2,111 @@
 outline: deep
 ---
 
-# Datenmigrations-Betriebshandbuch
+# Anleitung zur Datenmigration
 
-Diese Seite behandelt den praktischen Arbeitsablauf für die Datenverzeichnismigration. Technische Implementierungsdetails finden Sie unter [Grundlegende Implementierung](/de/datamigrae/baseinfo).
+Diese Seite beschreibt die praktische Datenmigration. Die technische Umsetzung steht unter [Grundlagen](/de/datamigrae/baseinfo).
 
-## App-assoziierte Datenverzeichnisse finden
+## Datenordner einer App finden
 
-1. Wechseln Sie im Hauptfenster von AppPorts zum Reiter „Datenverzeichnisse"
-2. Das linke Panel zeigt alle installierten Apps
-3. Klicken Sie auf eine App; das rechte Panel zeigt die zugehörigen Datenverzeichnisse unter `~/Library/` an
+1. Öffne im AppPorts-Hauptfenster „Datenverzeichnisse“.
+2. Wechsle oben zwischen „Tool-Verzeichnisse“ und „App Data“.
+3. Für App-Daten wählst du links eine App; rechts erscheinen ihre zugehörigen Ordner unter `~/Library/`.
 
-AppPorts scannt automatisch die folgenden Verzeichnisse und gleicht sie anhand der App Bundle ID oder des Namens ab:
+AppPorts gleicht diese Orte anhand der Bundle ID oder des App-Namens ab:
 
-| Scan-Pfad | Abgleichmethode |
-|-----------|-----------------|
-| `~/Library/Application Support/` | Bundle ID oder App-Name |
-| `~/Library/Preferences/` | Bundle ID oder App-Name |
-| `~/Library/Containers/` | Bundle ID |
-| `~/Library/Group Containers/` | Bundle ID |
-| `~/Library/Caches/` | Bundle ID oder App-Name |
-| `~/Library/WebKit/` | Bundle ID |
-| `~/Library/HTTPStorages/` | Bundle ID |
-| `~/Library/Application Scripts/` | Bundle ID |
-| `~/Library/Logs/` | App-Name |
-| `~/Library/Saved Application State/` | App-Name |
+| Durchsuchter Pfad | Abgleich | Migrationsverfahren |
+|----------|----------|----------|
+| `~/Library/Application Support/` | Bundle ID oder App-Name | Symbolischer Link |
+| `~/Library/Preferences/` | Bundle ID oder App-Name | Symbolischer Link |
+| `~/Library/Containers/` | Bundle ID | **Mount-Migration** |
+| `~/Library/Group Containers/` | Bundle ID | **Mount-Migration** |
+| `~/Library/Caches/` | Bundle ID oder App-Name | Symbolischer Link |
+| `~/Library/WebKit/` | Bundle ID | Symbolischer Link |
+| `~/Library/HTTPStorages/` | Bundle ID | Symbolischer Link |
+| `~/Library/Application Scripts/` | Bundle ID | Symbolischer Link |
+| `~/Library/Logs/` | App-Name | Symbolischer Link |
+| `~/Library/Saved Application State/` | App-Name | Symbolischer Link |
 
-## Tool-Verzeichnisse (Dot-Folders)
+Warum Container anders behandelt werden, erklärt [Mount-Migration](/de/datamigrae/mount-migration).
 
-AppPorts kann automatisch Dot-Folders erkennen, die von gängigen Entwicklungstools im Home-Verzeichnis des Benutzers erstellt wurden:
+## Tool-Verzeichnisse
 
-1. Wechseln Sie zum Unterreiter „Tool-Verzeichnisse" im Reiter Datenverzeichnisse
-2. Die Seite listet alle erkannten Tool-Verzeichnisse mit ihren Größen auf
-3. Jedes Verzeichnis zeigt ein Prioritäts-Badge (recommended/optional) und den Status
+AppPorts erkennt Ordner verbreiteter Entwicklungswerkzeuge im Benutzerordner, etwa `~/.npm` und `~/.gradle`:
 
-Wenn ein lokales Tool-Verzeichnis fehlt, aber der kanonische Ort auf dem ausgewählten externen Speicher noch ein von AppPorts verwaltetes Verzeichnis enthält, erscheint der Eintrag als „Neuverlinkung erforderlich". Beim Wechsel des externen Speichers scannt AppPorts die Tool-Verzeichnisse erneut und aktualisiert diesen Status. Normale Dateien werden nicht als neu verlinkbare Verzeichnisse behandelt.
+1. Wechsle unter „Datenverzeichnisse“ zu „Tool-Verzeichnisse“.
+2. Die Liste zeigt erkannte Ordner, Größe, Priorität und Status.
 
-Für die vollständige unterstützte Liste siehe [Tool-Verzeichnis-Erkennung](/de/datamigrae/tools).
+Fehlt der lokale Ordner, existiert am vorgesehenen externen Ort aber noch ein verwalteter AppPorts-Ordner, erscheint „Wartet auf erneute Verknüpfung“. Die Liste unterstützter Tools steht unter [Tool-Verzeichnisse erkennen](/de/datamigrae/tools).
 
-## Verzeichnismigration (benutzerdefinierte Ordner)
+## Eigene Ordner migrieren
 
-Der Tab „Verzeichnismigration" migriert beliebige Benutzerordner. Das ist nützlich für große Projekte, Modelle, Asset-Bibliotheken oder Tool-Caches, die in den externen Speicher verschoben werden sollen.
+„Directory Migration“ migriert beliebige Ordner unter deinem Benutzerordner, etwa große Projekte, Modelle und Mediensammlungen.
 
-1. Wechseln Sie im Hauptfenster zu „Verzeichnismigration"
-2. Klicken Sie im Header „Lokale Ordner" auf den „+"-Button
-3. Wählen Sie den lokalen Ordner und anschließend das Ziel-Stammverzeichnis im externen Speicher
-4. AppPorts verwendet `Zielstamm/lokaler Ordnername` als externes Ziel, speichert die Konfiguration und startet die Migration
+1. Öffne „Directory Migration“.
+2. Klicke neben „Local Folders“ auf „+“.
+3. Wähle den lokalen Ordner und anschließend den Zielstammordner auf dem externen Laufwerk. Das Ziel lautet `目标根目录/文件夹名
```

**File**: `User_docs/docs/de/datamigrae/resign.md` (modified, +58/-108)
```diff
@@ -2,145 +2,95 @@
 outline: deep
 ---
 
-# Neuzeichnung & Absturzprävention
+# Neusignierung und Schutz vor Abstürzen
 
 ![](https://pic.cdn.shimoko.com/appports/%E6%88%AA%E5%B1%8F2026-05-08%2008.38.37.png)
 
-## Warum Apps nach der Datenmigration abstürzen können
+::: warning Neusignierung ist keine allgemeine Reparatur
+Ad-hoc-Neusignierung ersetzt die Entwicklersignatur und entfernt Rechte für Sandbox, App-Gruppen und Schlüsselbund. Sandbox-Apps wie WeChat oder App Store-Apps können dadurch unter macOS 27 nicht mehr öffnen oder ihre Anmeldesitzung verlieren. Die neue Version speichert zuerst die vollständige Original-App, damit Signatur und ursprüngliche Rechte später wiederhergestellt werden können. Bereits verlorene Anmeldesitzungen kehren mit der Signatur nicht garantiert zurück.
 
-Der Code-Signing-Mechanismus von macOS (`codesign`) überprüft die Integrität des Anwendungspakets, einschließlich der Dateipfadstruktur. Wenn AppPorts das Datenverzeichnis einer App in den externen Speicher migriert und durch einen symbolischen Link ersetzt, wird die Signatur aufgebrochen, was folgende Probleme verursacht:
-
-- **Gatekeeper-Blockierung**: `codesign --verify --deep --strict` erkennt Signaturfehler; das System zeigt einen „Beschädigt"- oder „Von nicht identifiziertem Entwickler"-Dialog an und blockiert den App-Start
-- **Keychain-Zugriffsstörung**: Apps, die auf Keychain-Zugriffsgruppen angewiesen sind, können gespeicherte Anmeldedaten aufgrund von Signaturidentitätsänderungen nicht lesen
-- **Entitlements-Fehler**: Einige App-Entitlements sind an die Signaturidentität gebunden; nach Signaturänderungen stimmen die Entitlements nicht überein
+Seit 1.8.2 lehnt AppPorts die Neusignierung von Sandbox-Apps standardmäßig ab. Sie ist nur im klassischen Modus nach Risikobestätigung erlaubt. Containerdaten verwenden [Mount-Migration](/de/datamigrae/mount-migration) ohne Signaturänderung. Hintergründe: [Containerdaten, Sandbox und Signaturidentität](/de/datamigrae/container-identity).
+:::
 
-### Hochrisiko-App-Typen
+## Welches Problem löst Neusignierung?
 
-| App-Typ | Risikostufe | Grund |
-|---------|-------------|-------|
-| Sparkle-Selbstupdate-Apps | **Hoch** | Updater kann App löschen oder ersetzen und symbolische Links beschädigen |
-| Electron-Selbstupdate-Apps | **Hoch** | `electron-updater` kann ebenfalls externe Speicher-Apps stören |
-| Keychain-abhängige Apps | **Hoch** | Ad-hoc-Signierung ändert die Signaturidentität; Keychain-Zugriffsgruppen schlagen fehl |
-| Mac App Store-Apps | **Hoch** | SIP-Schutz; kann nicht neu signiert werden |
-| Native Selbstupdate-Apps (Chrome, Edge) | Mittel | Selbstupdate kann externe Kopie ersetzen und lokalen Eintrag ungültig machen |
-| iOS-Apps (Mac-Version) | Niedrig | Verwendet Stub Portal oder Whole Symlink; weniger Signaturprobleme |
+macOS prüft die Integrität von App-Paketen anhand ihrer Codesignatur. Nach dem Auslagern der App mit einer lokalen Startapp kann das System die App unter bestimmten Umständen für verändert halten und mit „beschädigt“ oder „nicht verifizierter Entwickler“ den Start verweigern. Eine Ad-hoc-Neusignierung der **tatsächlichen App auf dem externen Laufwerk** kann dann die Prüfung ermöglichen.
 
-### Hochrisiko-Datenverzeichnistypen
+Das ist der einzige Zweck. Mit der Migration von Datenordnern hat es nichts zu tun. Dass frühere Versionen beides bei Containerdaten verknüpften, verursachte die Probleme unter macOS 27.
 
-| Daten-Typ | Risikostufe | Grund |
-|-----------|-------------|-------|
-| `~/Library/Application Support/` | Mittel | App kann Dateisperrungen, SQLite WAL-Logs oder erweiterte Attribute verwenden; kann sich über symbolische Links abnormal verhalten |
-| `~/Library/Group Containers/` | Mittel | Von mehreren Apps unter demselben Team gemeinsam genutzt; symbolische Links können andere Apps stören |
-| `~/Library/Preferences/` | Niedrig-Mittel | `cfprefsd` cached plist-Dateien; symbolische Links können veraltete Daten verursachen |
-| `~/Library/Caches/` | Niedrig | Caches sind wiederherstellbar; die meisten Apps gehen mit fehlenden Caches um |
+## Wann du es nicht verwenden solltest
 
-## Neuzeichnungsmechanismus
+| Situation | Erklärung |
+|------|------|
+| Sandbox-App | Standardmäßig abgelehnt; nach Risikobestätigung im klassischen Modus erlaubt. Mount-Migration ist vorzuziehen |
+| App Store-App | Durch SIP geschützt; nicht signierbar |
+| App mit Anmeldedaten im Schlüsselbund | Anmeldesitzung geht durch Neusignierung verloren |
+| App mit Widgets oder Teilen-Erweiterungen | App-Gruppenrechte gehen verloren; Erweiterungen können gemeinsame Daten nicht lesen |
+| App öffnet sich normal | Ohne Problem nicht neu signieren |
 
-### Ad-hoc-Signierung
+Erwäge es nur, wenn nach der externen Migration tatsächlich „beschädigt“ erscheint. Versuche zuerst eine Neuinstallation oder einen erneuten Download von der offiziellen Website.
 
-AppPorts verwendet **Ad-hoc-Signierung** (zertifikatslose lokale Signierung), um App-Signaturen n
```

---

### Incident Patch 12: `219890fe` (2026-09-26)
**Commit Message**: docs(ko): sync mount migration and recovery guides

**File**: `User_docs/docs/ko/AppPorts.md` (modified, +42/-42)
```diff
@@ -4,41 +4,41 @@ outline: deep
 
 # AppPorts 사용자 가이드
 
-이 가이드는 AppPorts의 기능, 설계 원칙 및 기술 구현을 체계적으로 소개합니다. 더 자세한 기술 정보는 [DeepWiki](https://deepwiki.com/wzh4869/AppPorts)를 참조하세요. 개선 사항은 프로젝트 [Issues](https://github.com/wzh4869/AppPorts/issues)에 제출해 주세요.
+이 가이드는 AppPorts의 핵심 기능, 설계 원칙과 기술 구현을 설명합니다. 자세한 기술 정보는 [DeepWiki](https://deepwiki.com/wzh4869/AppPorts)를 참조하세요. 개선 의견은 프로젝트 [Issues](https://github.com/wzh4869/AppPorts/issues)에 남겨 주세요.
 
 ## 개요
 
-AppPorts는 [macOS](https://www.apple.com/macos/)를 위해 설계된 애플리케이션 마이그레이션 및 연결 도구로, 대용량 애플리케이션을 외장 저장소로 마이그레이션하면서 전체 시스템 기능과 일관성을 유지합니다.
+AppPorts는 [macOS](https://www.apple.com.cn/os/macos/)용 앱 마이그레이션 및 연결 도구입니다. 대용량 앱을 외장 저장 장치로 옮기면서 Finder, Launchpad, 앱 메뉴와 시스템 업데이트의 동작을 가능한 한 일관되게 유지합니다.
 
-### AppPorts 철학
+### AppPorts의 철학
 
 | 원칙 | 설명 |
 |------|------|
-| **투명한 경험** | 사용자 경험과 운영 체제가 앱이 여전히 내부 저장소에서 실행되는 것처럼 인식하도록 보장 |
-| **안정적 전략** | 검증된, 더 안정적인 마이그레이션 접근 방식을 우선시 |
-| **낮은 시스템 부하** | 데몬 없음, 지속적인 시스템 리소스 소비 방지 |
-| **폭넓은 국제화** | 더 많은 언어를 우선적으로 커버; 번역의 정확성보다 폭넓은 범위를 우선 |
-| **접근성 친화적** | 포괄적인 접근성 지원 |
+| **익숙한 사용 경험** | 사용자와 운영 체제가 마이그레이션한 앱을 로컬 앱처럼 사용할 수 있도록 함 |
+| **안정적인 전략** | 검증을 거쳐 마이그레이션 안정성이 높은 방식을 우선함 |
+| **낮은 시스템 부하** | 데몬에 의존하지 않아 시스템 리소스를 계속 점유하지 않음 |
+| **폭넓은 국제화** | 더 많은 언어를 지원하면서 번역 품질을 지속적으로 개선함 |
+| **손쉬운 사용 지원** | 폭넓은 손쉬운 사용 기능을 제공함 |
 
 ## 핵심 기능
 
-- **Badge 없는 마이그레이션**: 대용량 앱을 외장 드라이브로 한 번의 클릭으로 마이그레이션. 로컬에는 가벼운 런처 셸만 유지; Finder에 바로가기 화살표가 표시되지 않음; Launchpad와 macOS 앱 메뉴가 정상적으로 동작.
-- **자동 업데이트 보호**: 자동 업데이트를 지원하는 앱(Sparkle, Electron, Chrome 등)을 자동으로 감지하여, "잠금 마이그레이션" 옵션을 제공하여 자동 업데이트 프로그램이 외장 드라이브의 앱을 삭제하거나 덮어쓰는 것을 방지.
-- **Stub Portal 버전 동기화**: 외장 드라이브의 앱이 App Store에서 업데이트되면 로컬 Stub Portal의 버전 정보가 자동으로 동기화되어 "다음으로 열기" 메뉴에 정확한 버전이 표시됩니다.
-- **사용자 지정 스캔 디렉토리**: 추가 로컬 앱 스캔 디렉토리(예: JetBrains Toolbox, Steam)를 지정 가능. 디렉토리는 저장되며 변경 사항이 자동으로 모니터링됩니다.
-- **코드 서명 관리**: 마이그레이션 후 "손상됨" 메시지가 나타나면, 우클릭 메뉴를 통해 한 번의 클릭으로 재서명. 원본 서명의 백업 및 복원 지원; 데이터 디렉토리 마이그레이션 후 자동 재서명.
-- **macOS 15.1+ App Store 지원**: App Store 앱을 외장 드라이브에 직접 설치하고 외장 드라이브에서 제자리 업데이트를 지원.
-- **한 번의 클릭으로 복원**: 앱을 로컬 저장소로 다시 마이그레이션하고 자동으로 링크를 제거. 마이그레이션 중단 시 자동 복구.
-- **데이터 디렉토리 관리**: 앱 데이터 디렉토리(`~/Library/` 하위 디렉토리, `~/.npm` 등)를 외장 저장소로 마이그레이션하며, 트리 뷰 그룹화, 검색, 정렬을 지원.
-- **디렉토리 마이그레이션**: 사용자 홈 아래의 임의 실제 폴더를 외장 저장소로 이동합니다. 대형 프로젝트, 모델, 에셋 라이브러리, 도구 캐시에 유용하며 재링크, 복원, 경로 중복 검사를 지원합니다.
+- **바로가기 화살표 없는 마이그레이션**: 클릭 한 번으로 대용량 앱을 외장 저장 장치로 옮깁니다. 로컬에는 가벼운 실행 셸만 남기며 Finder에 바로가기 화살표가 표시되지 않습니다. Launchpad와 macOS 앱 메뉴에도 정상적으로 표시됩니다.
+- **자동 업데이트 보호**: Sparkle, Electron, Chrome 등 자체 업데이트 기능이 있는 앱을 자동으로 감지합니다. “잠금 마이그레이션”을 선택하면 업데이터가 외장 저장 장치의 앱을 삭제하거나 덮어쓰는 것을 막을 수 있습니다.
+- **버전 동기화 안내**: 로컬의 실제 앱이 외장 저장 장치의 이전 사본보다 최신 버전이면 “내보내기 대기”로 표시합니다. 로컬의 새 버전을 마이그레이션하여 외장 저장 장치의 이전 버전을 교체할 수 있습니다.
+- **Stub Portal 버전 동기화**: 외장 드라이브의 앱이 App Store에서 업데이트되면 로컬 Stub Portal의 버전 정보도 자동으로 동기화되어 “다음으로 열기” 메뉴에 올바른 버전이 표시됩니다.
+- **사용자 지정 스캔 디렉토리**: JetBrains Toolbox, Steam 등의 로컬 앱 디렉토리를 추가할 수 있습니다. 추가한 디렉토리는 자동으로 저장되며 변경 사항을 감시합니다.
+- **코드 서명 관리**: 앱 본체를 마이그레이션한 뒤 손상되었다는 메시지가 표시되면 오른쪽 클릭 메뉴에서 재서명할 수 있습니다. 원본 서명의 백업과 복원을 지원합니다. 샌드박스 앱은 어떤 경우에도 재서명하지 않습니다.
+- **macOS 15.1+ App Store 지원**: App Store 앱을 외장 저장 장치에 직접 설치하고, Mac으로 되돌리지 않고도 그 위치에서 업데이트할 수 있습니다.
+- **클릭 한 번으로 복원**: 앱을 로컬로 되돌리면서 링크를 자동으로 제거합니다. 마이그레이션이 중단되면 자동 복구할 수 있습니다.
+- **데이터 디렉토리 관리**: `~/Library/` 하위 디렉토리, `~/.npm` 등의 앱 데이터 디렉토리를 외장 저장 장치로 마이그레이션합니다. 트리 형태의 그룹 보기, 검색과 정렬을 지원하며 AppPorts 메타데이터로 복원 대상을 엄격히 검증합니다.
+- **컨테이너 데이터 마운트 마이그레이션**: WeChat 채팅 기록과 같은 샌드박스 컨테이너 데이터는 외장 APFS 드라이브에 별도 볼륨을 만들고 원래 디렉토리에 마운트하여 옮깁니다. 앱 서명은 변경하지 않습니다.
+- **디렉토리 마이그레이션**: 사용자 홈 디렉토리의 실제 폴더를 외장 저장 장치로 마이그레이션할 수 있습니다. 대형 프로젝트, 모델, 미디어 라이브러리와 도구 캐시에 적합하며 다시 연결, 복원과 경로 중복 검사를 지원합니다.
 
-## 용어집
+## 마이그레이션 전략
 
-### 마이그레이션 전략
+### Deep Contents Wrapper (Contents 디렉토리 마이그레이션)
 
-#### Deep Contents Wrapper (Contents 디렉토리 마이그레이션)
-
-macOS 애플리케이션의 표준 파일 구조는 다음과 같습니다:
+macOS 앱의 일반적인 파일 구조는 다음과 같습니다.
 
 ```text
 /Applications/Safari.app/
@@ -50,40 +50,40 @@ macOS 애플리케이션의 표준 파일 구조는 다음과 같습니다:
 └── ...
 ```
 
-Deep Contents Wrapper 전략은 모든 애플리케이션 콘텐츠를 외장 저장소로 마이그레이션하고, 로컬에 빈 `.app` 디렉토리를 생성하여 외부의 `Contents` 디렉토리를 가리키는 심볼릭 링크만 포함합니다. macOS가 완전한 `.app` 패키지(바로가기가 아닌)를 감지하므로, Finder에 화살표 표시가 나타나지 않고; 아이콘, Launchpad, 앱 메뉴가 정상적으로 동작합니다.
+Deep Contents Wrapper는 앱의 모든 내용을 외장 저장 장치로 옮기고, 로컬에 같은 이름의 빈 `.app` 디렉토리를 만듭니다. 이 디렉토리에는 외장 저장 장치의 `Contents` 디렉토리를 가리키는 심볼릭 링크만 들어 있습니다. macOS가 이를 완전한 `.app` 번들로 인식하므로 Finder에 바로가기 화살표가 표시되지 않으며 아이콘, Launchpad와 앱 메뉴가 정상적으로 작동합니다.
 
-::: warning ⚠️ 이 전략은 현재 버전에서 더 이상 사용되지 않습니다
-Deep Contents Wrapper의 주요 결함은 자동 업데이트 프로그램이 심볼릭 링크를 따라 외장 저장소의 파일을 직접 수정하여 애플리케이션을 손상시킬 수 있다는 점입니다.
+::: warning 현재 버전에서는 이 전략을 더 이상 사용하지 않습니다
+Deep Contents Wrapper의 주요 단점은 자동 업데이터가 심볼릭 링크를 따라 외장 저장 장치의 파일을 직접 변경하여 앱 본체를 손상시킬 수 있다는 점입니다.
 :::
 
-#### Stub Portal
+### Stub Portal (실행 셸 방식)
 
-Stub Portal 방식은 로컬에 최소한의 `.app` 셸을 생성하며, 다음 네 가지 항목만 포함합니다:
+Stub Portal은 다음 네 가지 구성 요소만 포함하는 최소한의 `.app` 셸을 로컬에 만듭니다.
 
 | 구성 요소 | 설명 |
-|-----------|------|
-| `Contents/MacOS/launcher` | `open "/Volumes/
```

**File**: `User_docs/docs/ko/badges.md` (modified, +65/-47)
```diff
@@ -2,83 +2,101 @@
 outline: deep
 ---
 
-# 상태 배지
+# 상태 배지 안내
 
-AppPorts는 캡슐 형태의 컬러 배지를 사용하여 앱과 데이터 디렉토리의 현재 상태를 표시합니다. 일부 배지를 클릭하면 상세 정보를 확인할 수 있습니다.
+AppPorts는 색상이 있는 캡슐 모양 배지로 앱과 데이터 디렉토리의 상태를 표시합니다. 일부 배지는 클릭하여 자세한 설명이나 권장 조치를 볼 수 있습니다.
 
 ## 앱 상태 배지
 
-### 링크 상태
+### 연결 상태
 
 | 배지 | 아이콘 | 색상 | 의미 |
-|------|--------|------|------|
-| Linked | `link` | 녹색 | 앱이 외장 저장소로 마이그레이션되었으며 로컬 엔트리가 있음 |
-| Locked Migration | `lock.fill` | 녹색 | 링크됨 및 `uchg`로 잠금, 자체 업데이트가 외부 앱을 손상시키는 것을 방지 |
-| Unlocked Migration | `lock.open` | 주황색 | 링크되었으나 잠기지 않음; 앱 내부 업데이트가 외부 앱을 삭제할 수 있음 |
-| Partial Link | `link.badge.plus` | 노란색 | 일부 앱 구성 요소만 링크됨 (예: 디렉토리 내 일부 `.app` 파일) |
-| Orphan Link | `link.badge.exclamationmark` | 빨간색 | 외장 저장소 앱이 손실되었지만 로컬 엔트리가 여전히 존재 |
-| Unlinked | `externaldrive.badge.xmark` | 주황색 | 외장 저장소에 앱이 있지만 로컬에 링크되지 않음 |
-| External | `externaldrive` | 주황색 | 외장 저장소에 앱이 있고 로컬 엔트리가 없음 |
-| 이동 대기 | `arrow.up.right.circle` | 청록색 | 로컬 실제 앱이 외장 저장소의 오래된 복사본보다 최신이며, 외부로 이동해 교체할 수 있음 |
-| Local | `macmini` | 보조 색상 | 일반 로컬 앱, 마이그레이션되지 않음; 다른 태그가 없을 때 표시 |
-
-::: tip 이동 대기 판정 방식
-AppPorts는 먼저 Bundle ID로 로컬 앱과 외부 앱을 매칭하고, 필요하면 정규화된 앱 이름으로 보완합니다. 양쪽 버전을 비교할 수 있고 로컬 버전이 더 높을 때만 표시됩니다.
+|------|------|------|------|
+| 연결됨 | `link` | 초록색 | 앱을 외장 저장 장치로 마이그레이션하고 로컬 실행 경로를 생성함 |
+| 잠금 마이그레이션 | `lock.fill` | 초록색 | 앱이 연결되어 있고 `uchg`로 잠겨 있어 자체 업데이트가 외부 사본을 손상시키지 못함 |
+| 비잠금 마이그레이션 | `lock.open` | 주황색 | 앱이 연결되어 있지만 잠겨 있지 않아 앱 내부 업데이트가 외부 사본을 삭제하거나 덮어쓸 수 있음 |
+| 부분적으로 연결됨 | `link.badge.plus` | 노란색 | 디렉토리 안의 일부 `.app` 등 앱의 일부 구성 요소만 연결됨 |
+| 고아 링크 | `link.badge.exclamationmark` | 빨간색 | 외장 저장 장치의 앱은 없어졌지만 로컬 실행 경로는 남아 있음 |
+| 연결되지 않음 | `externaldrive.badge.xmark` | 주황색 | 앱이 외장 저장 장치에 있지만 아직 로컬에 연결되지 않음 |
+| 외부 | `externaldrive` | 주황색 | 외장 저장 장치의 앱으로, 로컬 실행 경로가 없음 |
+| 내보내기 대기 | `arrow.up.right.circle` | 청록색 | 로컬의 실제 앱이 외장 저장 장치의 같은 이름 사본보다 최신 버전이며, 마이그레이션하여 이전 외부 버전을 교체할 수 있음 |
+| 로컬 | `macmini` | 보조 색상 | 마이그레이션하지 않은 일반 로컬 앱. 다른 배지가 없을 때 표시 |
+
+::: tip “내보내기 대기”는 어떻게 판단하나요?
+AppPorts는 먼저 Bundle ID로 로컬 앱과 외부 앱을 대조하고, 필요하면 정규화한 앱 이름을 보조 기준으로 사용합니다. 양쪽 버전 번호를 비교할 수 있고 로컬 버전이 더 높을 때만 “내보내기 대기”를 표시합니다. 버전 정보가 없거나 형식을 비교할 수 없거나, 같은 이름의 앱이라도 Bundle ID가 다르면 일반 로컬 상태를 유지하여 외부 앱을 잘못 덮어쓰지 않도록 합니다.
 :::
 
-### 프레임워크 라벨
+### 프레임워크 배지
 
-| 배지 | 아이콘 | 색상 | 의미 | 클릭 동작 |
-|------|--------|------|------|----------|
-| Sparkle | `arrow.triangle.2.circlepath` | 청록색 | 자동 업데이트를 위해 Sparkle 프레임워크 사용 | 외장 저장소로 마이그레이션 후 앱 내부 업데이트가 외부 앱 손실을 유발할 수 있으므로 잠금 마이그레이션 권장 |
-| Electron | `atom` | 남보라색 | 자동 업데이트를 지원하는 Electron 프레임워크 기반 | 외장 저장소로 마이그레이션 후 앱 내부 업데이트가 외부 앱 손실을 유발할 수 있으므로 잠금 마이그레이션 권장 |
+| 배지 | 아이콘 | 색상 | 의미 | 클릭 시 설명 |
+|------|------|------|------|----------|
+| Sparkle | `arrow.triangle.2.circlepath` | 청록색 | Sparkle 프레임워크로 자동 업데이트 | 외장 저장 장치로 마이그레이션한 뒤 앱 내부 업데이트로 외부 사본이 없어질 수 있으므로 잠금 마이그레이션 권장 |
+| Electron | `atom` | 남색 | Electron 기반 앱으로, 자동 업데이트를 지원할 수 있음 | 외장 저장 장치로 마이그레이션한 뒤 앱 내부 업데이트로 외부 사본이 없어질 수 있으므로 잠금 마이그레이션 권장 |
 
-### 유형 라벨
+### 유형 배지
 
 | 배지 | 아이콘 | 색상 | 의미 |
-|------|--------|------|------|
-| Running | `play.fill` | 보라색 | 현재 실행 중인 앱 |
-| System | `lock.fill` | 회색 | macOS 시스템 애플리케이션 |
-| Non-native | `iphone` | 분홍색 | iOS/iPadOS 앱 (Apple Silicon을 통해 실행) |
-| Store | `applelogo` | 파란색 | Mac App Store 애플리케이션 |
+|------|------|------|------|
+| 실행 중 | `play.fill` | 보라색 | 앱이 현재 실행 중 |
+| 시스템 | `lock.fill` | 회색 | macOS 시스템 앱 |
+| 비기본 | `iphone` | 분홍색 | Apple Silicon에서 실행하는 iOS/iPadOS 앱 |
+| 스토어 | `applelogo` | 파란색 | Mac App Store 앱 |
 
-### 특수 라벨
+### 특수 배지
 
 | 배지 | 아이콘 | 색상 | 의미 |
-|------|--------|------|------|
-| Re-signed | `seal.fill` | 청록색 | 앱이 Ad-hoc 재서명됨 (마이그레이션 후 "손상됨"이 나타날 때 실행) |
+|------|------|------|------|
+| 재서명됨 | `seal.fill` | 청록색 | 앱이 현재 Ad-hoc 서명을 사용하고 AppPorts에 서명 백업이 있음 |
+| 서명 교체됨 | `exclamationmark.shield.fill` | 빨간색 | AppPorts가 개발자 서명을 Ad-hoc 서명으로 교체한 앱. macOS 27에서 열리지 않을 수 있습니다. 클릭하면 설명을 볼 수 있고 오른쪽 클릭 메뉴의 “복구 단계 보기”를 선택하면 복구 패널이 열립니다. [macOS 27 업그레이드 안내](/ko/macos-27) 참조 |
 
-::: tip 💡 Store 라벨에 대한 특별 참고
-앱이 다음 조건을 충족하면 "Store" 라벨이 클릭 가능해지며 macOS 15.1+ 네이티브 설치 안내가 표시됩니다:
-- 앱이 외장 저장소의 `/Volumes/{drive}/Applications/` 디렉토리에 위치
-- macOS에 의해 네이티브하게 관리됨; App Store가 이 디렉토리에서 직접 증분 업데이트를 수행할 수 있음
+::: tip “재서명됨”과 “서명 교체됨”의 차이
+둘 다 현재 앱이 Ad-hoc 서명을 사용한다는 뜻이며, **원래 어떤 서명이었는지**가 다릅니다. “재서명됨”은 원래 개발자 서명이 없었거나 더 이상 확인할 수 없는 앱으로, 재서명은 앱을 정상적으로 열 수 있게 하는 역할을 합니다. “서명 교체됨”은 원래 있던 개발자 서명을 Ad-hoc 서명으로 바꾼 앱입니다. 샌드박스 앱은 이로 인해 macOS 27에서 열리지 않을 수 있으므로 빨간색으로 표시하고 복구 경로를 제공합니다.
+:::
+
+::: tip “스토어” 배지의 특별 안내
+다음 조건을 충족하면 “스토어” 배지를 클릭하여 macOS 15.1+의 외장 저장 장치 기본 설치 기능을 안내받을 수 있습니다.
+
+- 앱이 외장 저장 장치의 `/Volumes/{drive}/Applications/` 디렉토리에 있습니다.
+- macOS가 앱을 기본 기능으로 관리하며, App Store가 해당 디렉토리에서 직접 증분 업데이트를 실행할 수 있습니다.
 :::
 
 ## 데이터 디렉토리 상태 배지
 
 | 상태 | 색상 | 의미 |
 |------|------|------|
-| Local | 보조 색상 | 로컬 저장소의 디렉토리, 마이그레이션되지 않음 |
-| Linked | 녹색 | 외장 저장소로 마이그레이션됨; 로컬은 심볼릭 링크 |
-| Needs Normalization | 노란색 | AppPorts가 관리하는 링크이지만 외부 경로가 표준 위치에 있지 않음; "정규화" 작업 권장 |
-| Needs Relinking | 주황색 | 외장 저장소 데이터가 존재하지만 로컬 심볼릭 링크가 손실됨; "재링크" 작업 권장 |
-| E
```

**File**: `User_docs/docs/ko/changelog.md` (modified, +33/-0)
```diff
@@ -4,6 +4,39 @@ outline: deep
 
 # 변경 이력
 
+## v1.8.2(개발 중)
+
+### 주요 변경 사항
+
+- **컨테이너 데이터에 마운트 마이그레이션 사용**: `~/Library/Containers/`와 `~/Library/Group Containers/` 아래의 디렉토리는 더 이상 심볼릭 링크로 옮기지 않습니다. 외장 APFS 드라이브에 별도 볼륨을 만들어 원래 디렉토리에 마운트하며 앱 서명은 변경하지 않습니다. 외장 APFS 드라이브가 필요하고 앱을 처음 열 때 “이동식 볼륨” 접근을 허용해야 합니다. [마운트 마이그레이션](/ko/datamigrae/mount-migration)을 참조하세요.
+- **샌드박스 앱 재서명 중단**: 오른쪽 클릭 메뉴, “마이그레이션 후 재서명” 스위치와 로그인 시 자동 재서명 스크립트가 모두 샌드박스 앱을 건너뜁니다. 이전 버전에서 샌드박스 앱을 재서명했다면 macOS 27에서 열리지 않을 수 있습니다. 처리 방법은 [macOS 27 업그레이드 안내](/ko/macos-27)를 참조하세요.
+- **“원본 서명 복원” 수정**: 재서명 전에 원본 앱 전체를 백업하고, 작업용 사본을 검증한 뒤 안전하게 교체합니다. 개발자의 개인 키 없이 원본 서명과 권한을 복원할 수 있습니다. 이전 기록은 같은 버전의 공식 원본 앱을 선택하여 복구할 수 있으며, 업데이트된 앱이나 손상된 백업을 강제로 덮어쓰지 않습니다.
+- **서명이 교체된 앱 자동 감지 및 복구 안내**: 앱 목록에 빨간색 “서명 교체됨” 배지를 표시하고 시작할 때 한 번 알려 줍니다. 오른쪽 클릭 메뉴의 “복구 단계 보기”에서 복구 패널을 열면 데이터 복원, Mac으로 되돌리기, 재설치, 마운트 마이그레이션 순서로 안내하며 데이터를 삭제하지 않습니다. 사용자가 재설치하여 서명이 복원되면 배지가 사라집니다. 스캔은 복구 자료를 보존하고 AppPorts에서 복원을 완료한 뒤 백업을 정리합니다.
+- **클래식 데이터 마이그레이션 모드**: 설정에 기본적으로 꺼져 있는 스위치를 추가했습니다. 켜기 전에 위험을 확인해야 하며, 켜면 1.8.1의 심볼릭 링크와 재서명 방식을 복원합니다. 이미 이전 방식에 의존하는 사용자를 위해서만 남겨 둡니다. 외장 드라이브가 APFS가 아니면 이 모드를 켜기보다 현재 상태를 유지하는 것이 좋습니다.
+- 새로 설치하면 “로그인 시 자동 재서명”은 기본적으로 꺼져 있습니다. 이미 로그인 에이전트를 설치한 사용자의 설정은 유지됩니다.
+- 클래식 모드가 아닐 때는 심볼릭 링크가 다시 만들어지지 않도록 컨테이너 디렉토리의 “정리”, “다시 연결”, “링크 세부 정보”를 비활성화합니다.
+
+### 개선 사항
+
+- **“마운트 마이그레이션”을 누르면 먼저 읽기 전용 검사 후 상황에 맞게 안내**: 암호화하지 않은 APFS 외장 저장 장치라면 확보할 공간, 처음 앱을 열 때 접근 허용이 필요하다는 점, 평소에도 드라이브를 연결해야 한다는 점을 설명합니다. exFAT / NTFS / HFS+이거나 암호화, 공간 부족, 연결 안 됨 상태라면 이유와 함께 “그대로 유지”, “다른 위치 선택”, “준비 안내 보기” 등의 선택지를 제공하며 아무것도 변경하지 않습니다. 환영 페이지와 설정의 준비 상태 안내도 같은 기준으로 바뀌어 APFS가 아닌 사용자에게 클래식 모드를 권하지 않습니다.
+- **데이터 볼륨을 Finder에서 숨김**: 새 볼륨은 `/Volumes`에 자동으로 마운트하지 않으며, 마운트할 때 `nobrowse`를 적용합니다. 이전 버전에서 마운트한 볼륨은 다음 시작 또는 드라이브 연결 때 마운트를 해제하지 않고 현재 위치에서 숨깁니다.
+- **암호화된 APFS 드라이브는 당분간 마운트 마이그레이션 미지원**: 새 데이터 볼륨은 원래 볼륨의 암호를 상속하지 않습니다. AppPorts는 암호화하지 않은 볼륨을 몰래 만드는 대신 작업을 중지하고 이유를 설명합니다.
+- **마이그레이션 및 복원 전 남은 공간 확인**: 외장 드라이브나 Mac의 공간이 부족하면 볼륨 생성이나 복사 전에 중지합니다.
+- **더 안전한 복원**: 마운트 해제 후에는 빈 마운트 지점만 삭제하며 재귀적으로 삭제하지 않습니다. 임시 디렉토리는 숨겨진 이름을 사용합니다. 마지막 단계를 완료하지 못하면 외부 볼륨과 기록을 그대로 유지하고 로컬 사본의 위치를 알려 줍니다.
+- **자신이 관리하는 볼륨만 변경**: 마운트, 마운트 해제, 복원 전에 마운트 지점의 볼륨 신원을 확인합니다. 로그인 에이전트와 공유하는 잠금을 얻지 못하면 작업을 시작하지 않습니다. 마이그레이션 기록 파일을 읽을 수 없을 때 빈 기록으로 취급하여 덮어쓰지 않습니다.
+- **로그인 에이전트 경로 자동 조정**: AppPorts를 시작할 때마다 로그인 에이전트가 가리키는 실행 파일 경로를 확인하고, AppPorts를 옮기거나 업데이트한 뒤 자동으로 갱신합니다. DMG나 “다운로드” 폴더에서 바로 실행하여 임시 App Translocation 경로를 사용하는 경우에는 새 마운트 마이그레이션을 막고 먼저 “응용 프로그램”에 넣도록 안내합니다.
+- macOS 12 등 관리자 권한이 필요한 시스템에서는 마운트 마이그레이션 중 시스템 암호 대화상자를 표시하고 다시 시도합니다.
+- 로그인 후 컨테이너 볼륨을 자동으로 다시 마운트합니다. AppPorts가 실행 중일 때 드라이브를 연결해도 자동으로 다시 마운트합니다. 로그인 에이전트는 `/Volumes`도 감시하여 로그인 항목의 앱이 시작되기 전에 마운트를 완료합니다. 에이전트와 AppPorts는 프로세스 간 잠금으로 상호 배제하므로 마이그레이션이나 복원 중 마운트 지점을 서로 차지하려 하지 않습니다.
+- **로그인 에이전트가 로그인 항목 뒤로 밀리지 않도록 수정**: 에이전트가 `KeepAlive`로 실행 필요 상태를 알리며 실패할 때만 재시작하도록 하고, `ProcessType: Background`를 제거했습니다. 로그인 직후 한동안 사용자 도메인은 on-demand-only 모드에 있습니다. 이전 정의에서는 launchd가 에이전트 시작을 약 20초 늦추는 동안 로그인 항목의 앱은 3초 만에 시작되었습니다.
+- **시스템이 볼륨을 먼저 자동 마운트한 경우 다시 마운트**: 볼륨이 이미 `/Volumes`에 마운트되어 있으면 `diskutil mount -mountPoint`는 오류를 내지 않습니다. 마운트 지점 인수를 무시하고도 `mounted`를 출력하며 0을 반환합니다. 2026-09-21과 09-23에 각각 한 번 발생했으며, 명령은 성공했지만 대상 마운트 지점은 비어 있어 WeChat이 빈 디렉토리를 읽었습니다. 이제 매번 마운트 후 실제 대상 경로에 볼륨이 있는지 확인합니다. 그렇지 않으면 `/Volumes`에서 마운트를 해제한 후 다시 마운트하며 최대 3회 시도합니다.
+- **시동 시 가장 오래 걸리던 `diskutil` 조회 제거**: 시동하거나 드라이브를 연결하면 시스템이 먼저 `/Volumes/<卷名>`에 볼륨을 마운트합니다. 에이전트는 이제 `statfs`와 볼륨 루트 표식으로 마이크로초 단위에 바로 식별하여 실제로 9초 걸리던 `diskutil info` 조회를 하지 않습니다. 실제 기기에서는 마운트 지점 조회부터 완료까지 `unmount`와 `mount` 두 명령만 남아 약 1초가 걸렸습니다.
+- **외장 드라이브가 늦게 나타나도 로그인 에이전트가 재시도**: 프로세스 안에서 `/Volumes`를 감시하고 다음 실제 변경이 일어나면 다시 시도합니다. 실측으로 볼륨이 나타난 뒤 마운트 완료까지 약 1초가 걸렸습니다. 이벤트가 전혀 없으면 20초마다 다시 확인하며 전체 대기 시간은 180초입니다. 볼륨을 기다리는 동안 AppPorts와 공유하는 프로세스 간 잠금을 점유하지 않습니다.
+- **할 일 없는 로그인 에이전트 실행의 로그 축소**: launchd의 `WatchPaths`는 FSEvents 경로 접두사로 대조하므로 외장 드라이브에 쓰기가 발생할 때마다 에이전트가 깨어나지만 대부분 할 일이 없습니다. 이제 할 일 없는 실행은 3줄만 기록합니다. 항목별 상세 내용은 실제 마운트, 볼륨 연결 끊김 또는 실패가 발생할 때만 기록합니다.
+- **마운트 과정의 diskutil 호출 절반으로 감소**: 볼륨당 조회를 4회에서 2회로 줄였습니다. 볼륨 연결 여부와 현재 마운트 위치를 한 번의 `diskutil info`에서 확인합니다. 시동 중에는 시스템이 바빠 조회 한 번에 약 1초가 걸리므로 이 변경만으로 몇 초를 줄입니다.
+- **Spotlight의 볼륨 인덱싱 중지**: 볼륨 생성 후 루트에 `.metadata_never_index`를 기록하고 시스템이 이미 만든 `.Spotlight-V100`을 정리합니다. 실측한 WeChat 볼륨 2개의 해당 디렉토리 합계는 110 MB였습니다. 이전에 마이그레이션한 볼륨은 다음 마운트 때 표식을 추가합니다. 표식은 볼륨에 남으며 복원할 때 로컬 디렉토리로 가져오지 않습니다.
+- Bundle ID의 마지막 부분이 `mac`, `desktop` 같은 일반적인 단어일 때 다른 앱의 컨테이너를 잘못 연결하는 문제를 수정했습니다. 예를 들어 Termius에 QQ Music 컨테이너가 표시되던 경우입니다.
+- 컨테이너 경로가 `/private/var` 형태이면 하위 디렉토리를 스캔하지 못하던 문제를 수정했습니다.
+
 ## v1.8.0
 
 ### 새로운 기능
```

**File**: `User_docs/docs/ko/datamigrae/baseinfo.md` (modified, +60/-61)
```diff
@@ -6,94 +6,93 @@ outline: deep
 
 ![](https://pic.cdn.shimoko.com/appports/%E6%88%AA%E5%B1%8F2026-05-08%2008.38.05.png)
 
-AppPorts의 데이터 마이그레이션 기능은 앱과 관련된 데이터 디렉토리(예: `~/Library/Application Support`, `~/Library/Caches` 등)를 외장 저장소로 마이그레이션하여 로컬 디스크 공간을 확보합니다.
+AppPorts는 앱과 연결된 데이터 디렉토리를 외장 드라이브로 옮겨 로컬 공간을 확보합니다. 디렉토리 위치에 따라 두 방식을 사용합니다.
 
-## 핵심 전략: 심볼릭 링크
+| 디렉토리 | 방식 | 이유 |
+|------|------|------|
+| `~/Library/Containers/`, `~/Library/Group Containers/` | 마운트 마이그레이션 | 샌드박스가 해석된 실제 경로를 확인하므로 컨테이너 밖을 가리키는 심볼릭 링크를 거부 |
+| 그 밖의 `~/Library/` 하위 디렉토리, 도구 디렉토리, 사용자 지정 폴더 | 심볼릭 링크 | 샌드박스 제한이 없으며 가장 간단한 방식 |
 
-데이터 디렉토리 마이그레이션은 **Whole Symlink** 전략을 사용합니다:
+이 페이지는 심볼릭 링크 방식을 설명합니다. 다른 방식은 [마운트 마이그레이션](/ko/datamigrae/mount-migration)을 참고하세요.
 
-1. 원본 로컬 디렉토리 전체를 외장 저장소로 복사
-2. 관리 링크 메타데이터(`.appports-link-metadata.plist`)를 외부 디렉토리에 기록
-3. 원본 로컬 디렉토리를 같은 볼륨의 숨겨진 안전 백업으로 이름 변경
-4. 원본 경로에 외부 복사본을 가리키는 심볼릭 링크 생성
-5. 심볼릭 링크 생성 후 로컬 안전 백업 정리
+## 심볼릭 링크 방식
+
+1. 로컬 디렉토리를 외장 드라이브에 완전히 복사합니다.
+2. 외장 디렉토리에 관리 표식 `.appports-link-metadata.plist`를 기록합니다.
+3. 원래 로컬 디렉토리의 이름을 바꾸어 같은 볼륨의 숨김 안전 백업으로 만듭니다.
+4. 원래 경로에 외장 사본을 가리키는 심볼릭 링크를 만듭니다.
+5. 링크 생성에 성공하면 안전 백업을 정리합니다.
 
 ```
 ~/Library/Application Support/SomeApp
-    → /Volumes/External/AppPortsData/SomeApp  (symlink)
+    → /Volumes/External/AppPortsData/SomeApp  （符号链接）
 ```
 
-## 마이그레이션 흐름
-
 ```mermaid
 flowchart TD
-    A[데이터 디렉토리 선택] --> B{권한 및 보호 검사}
-    B -->|실패| Z[종료]
-    B -->|통과| C{대상 경로 충돌 감지}
-    C -->|관리 메타데이터 있음| D[자동 복구 모드]
-    C -->|충돌 없음| E[외장 저장소로 복사]
+    A[데이터 디렉토리 선택] --> B{권한과 보호 검사}
+    B -->|실패| Z[중단]
+    B -->|통과| C{대상 경로 충돌 검사}
+    C -->|관리 표식 완전 일치| D[자동 복구 모드]
+    C -->|실제 디렉토리 충돌| Y[중단하고 충돌 알림]
+    C -->|충돌 없음| E[외장 드라이브로 복사]
     D --> E
-    E --> F[관리 링크 메타데이터 기록]
-    F --> G[로컬 디렉토리를 안전 백업으로 이름 변경]
-    G -->|실패| H[외부 복사본을 유지하고 중지]
+    E --> F[관리 표식 기록]
+    F --> G[로컬 안전 백업으로 이름 변경]
+    G -->|실패| H[외장 사본 보존 후 중단]
     G -->|성공| I[심볼릭 링크 생성]
-    I -->|실패| J[로컬 안전 백업 복원 및 외부 복사본 유지]
+    I -->|실패| J[로컬 안전 백업 복원 및 외장 사본 보존]
     I -->|성공| K[로컬 안전 백업 정리]
     K -->|성공| L[마이그레이션 완료]
-    K -->|실패| M[마이그레이션 완료; 안전 백업 유지]
+    K -->|실패| M[마이그레이션 완료 및 안전 백업 보존]
 ```
 
-## 관리 링크 메타데이터
+## 관리 표식
 
-AppPorts는 외부 디렉토리에 `.appports-link-metadata.plist` 파일을 기록하여 해당 디렉토리가 AppPorts에 의해 관리됨을 식별합니다. 메타데이터에는 다음이 포함됩니다:
+외장 디렉토리의 `.appports-link-metadata.plist`는 AppPorts가 관리하는 디렉토리임을 나타냅니다.
 
 | 필드 | 설명 |
 |------|------|
-| `schemaVersion` | 메타데이터 버전 번호 (현재 1) |
-| `managedBy` | 관리자 식별자 (`com.shimoko.AppPorts`) |
-| `sourcePath` | 원본 로컬 경로 |
-| `destinationPath` | 외장 저장소 대상 경로 |
+| `schemaVersion` | 버전 번호. 현재 1 |
+| `managedBy` | `com.shimoko.AppPorts` |
+| `sourcePath` | 원래 로컬 경로 |
+| `destinationPath` | 외장 대상 경로 |
 | `dataDirType` | 데이터 디렉토리 유형 |
 
-이 메타데이터는 스캔 시 AppPorts가 관리하는 링크와 사용자가 생성한 심볼릭 링크를 구분하는 데 사용되며, 마이그레이션 중단 시 자동 복구를 지원합니다.
-
-자동 복구는 엄격한 일치를 사용합니다. 외부 대상이 이미 존재하는 경우 AppPorts는 `schemaVersion`, `managedBy`, `sourcePath`, `destinationPath`, `dataDirType`이 현재 작업과 모두 일치할 때만 복구 가능한 대상으로 간주합니다. 일치하는 메타데이터가 없는 실제 디렉토리는 충돌로 처리되며, 디렉토리 크기가 비슷하다는 이유만으로 복구하거나 관리 전환하지 않습니다.
-
-재링크와 정규화는 디렉토리에만 적용됩니다. AppPorts는 외부 일반 파일을 데이터 디렉토리로 재링크하거나 이동하지 않고 거부하여, 파일이 로컬 심볼릭 링크로 대체되는 상황을 방지합니다.
-
-## 지원되는 데이터 디렉토리 유형
+스캔할 때 AppPorts가 만든 링크와 사용자가 직접 만든 링크를 구분하며, 중단된 마이그레이션을 자동으로 복구할 때도 사용합니다. 다섯 필드가 모두 일치해야 이어서 처리할 수 있는 관리 디렉토리로 인정합니다. 그 외에는 충돌로 간주하며, 크기가 비슷하다는 이유만으로 관리하거나 덮어쓰지 않습니다.
 
-| 유형 | 경로 예시 |
-|------|----------|
-| `applicationSupport` | `~/Library/Application Support/` |
-| `preferences` | `~/Library/Preferences/` |
-| `containers` | `~/Library/Containers/` |
-| `groupContainers` | `~/Library/Group Containers/` |
-| `caches` | `~/Library/Caches/` |
-| `webKit` | `~/Library/WebKit/` |
-| `httpStorages` | `~/Library/HTTPStorages/` |
-| `applicationScripts` | `~/Library/Application Scripts/` |
-| `logs` | `~/Library/Logs/` |
-| `savedState` | `~/Library/Saved Application State/` |
-| `dotFolder` | `~/.npm`, `~/.vscode` 등 |
-| `custom` | 사용자 정의 경로 |
+다시 연결과 정리는 디렉토리에만 적용됩니다. 일반 외장 파일을 디렉토리로 취급해 다시 연결하지 않습니다.
 
-## 복원 흐름
+## 지원하는 데이터 디렉토리 유형
 
-1. 로컬 경로가 유효한 외부 디렉토리를 가리키는 심볼릭 링크인지 확인
-2. 로컬 심볼릭 링크 제거
-3. 외부 디렉토리를 로컬로 다시 복사
-4. 외부 디렉토리 삭제 (최대한 시도)
+| 유형 | 경로 | 방식 |
+|------|------|------|
+| `applicationSupport` | `~/Library/Application Support/` | 심볼릭 링크 |
+| `preferences` | `~/Library/Preferences/` | 심볼릭 링크 |
+| `containers` | `~/Library/Containers/` | 마운트 |
+| `groupContainers` | `~/Library/Group Containers/` | 마운트 |
+| `caches` | `~/Library/Caches/` | 심볼릭 링크 |
+| `webKit` | `~/Library/WebKit/` | 심볼릭 링크 |
+| `httpStorages` | `~/Library/HTTPStorages/` | 심볼릭 링크 |
+| `applicationScripts` | `~/Library/Application Scripts/` | 심볼릭 링크 |
+| `logs` | `~/Library/Logs/` | 심볼릭 링크 |
+| `savedState` | `~/Library/Saved Application State/` | 심볼릭 링크 |
+| `dotFolder` | `~/.npm`, `~/.vscode` 등 | 심볼릭 링크 |
+| `custom` | 사용자 지정 경로 | 심볼릭 링크 |
 
-복사가 실패하면 일관성을 유지하기 위해 심볼릭 링크를 자동으로 재구성합니다.
+## 복원 과정
 
-## 오류 처리 및 롤백
+1. 로컬 경로가 유효한 외장 디렉토리를 가리키는 심볼릭 링크인지 확인합니다.
+2. 외장 디렉토리를 로컬 임시 디렉
```

**File**: `User_docs/docs/ko/datamigrae/container-identity.md` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+---
+outline: deep
+---
+
+# 컨테이너 데이터, 샌드박스와 서명 신원
+
+::: tip 핵심 내용
+`~/Library/Containers/`와 `~/Library/Group Containers/`의 데이터는 **샌드박스 앱**의 데이터입니다. ‘바로가기’(심볼릭 링크)로 외장 드라이브에 옮기면 앱이 읽지 못합니다. 예전 AppPorts는 재서명으로 우회했지만 그 결과 macOS 27에서 앱이 열리지 않거나 로그인 상태를 잃을 수 있습니다.
+
+1.8.2부터 컨테이너 데이터는 [마운트 마이그레이션](/ko/datamigrae/mount-migration)을 사용하며 서명을 한 바이트도 변경하지 않습니다. 이미 재서명한 앱은 재설치해야 합니다. [macOS 27 업그레이드 안내](/ko/macos-27)를 참고하세요.
+:::
+
+이 문서는 배경을 설명합니다. 이미 앱이 열리지 않는다면 [macOS 27 업그레이드 안내](/ko/macos-27)의 복구 단계로 바로 이동하세요.
+
+## 컨테이너란 무엇인가요?
+
+대부분의 macOS 앱은 샌드박스에서 실행됩니다. 시스템이 앱마다 `~/Library/Containers/<Bundle ID>/`라는 전용 폴더를 배정하며 앱은 그 안에서만 읽고 쓸 수 있습니다. App Store 앱은 필수이며 공식 사이트에서 받는 WeChat, QQ Music 같은 앱도 대부분 그렇습니다. 여러 앱이 공유하는 데이터는 `~/Library/Group Containers/`에 저장합니다.
+
+앱의 권한 정보에 `com.apple.security.app-sandbox`가 있는지 보면 샌드박스 앱인지 알 수 있습니다.
+
+```bash
+codesign -d --entitlements - --xml /Applications/WeChat.app 2>/dev/null | grep -c app-sandbox
+# 输出 1 就是沙盒应用
+```
+
+놓치기 쉬운 점이 있습니다. **주 프로그램이 샌드박스가 아니어도 컨테이너를 마음대로 옮겨도 된다는 뜻은 아닙니다.** Chrome과 Edge의 주 프로그램은 샌드박스 밖에 있지만 위젯과 확장 프로그램은 각각 자신의 컨테이너를 가지며, 그 소유자는 샌드박스 프로세스입니다. 따라서 AppPorts는 주 프로그램을 기준으로 삼지 않고 `Containers` 아래 모든 디렉토리를 동일하게 취급합니다.
+
+## 컨테이너 데이터를 옮기는 세 가지 방법
+
+| 방법 | 결과 | 이유 |
+|------|------|------|
+| 외장 드라이브에 복사하고 원래 위치에 심볼릭 링크 남기기 | 앱은 열리지만 데이터를 읽지 못함. WeChat은 저장 위치를 사용할 수 없다고 표시 | 샌드박스가 확인하는 것은 링크의 **대상**입니다. 컨테이너 밖이면 거부하므로 외장 드라이브와 데스크탑 모두 같은 결과 |
+| 심볼릭 링크 + Ad-hoc 재서명 | macOS 26 이하에서는 사용 가능. 27에서는 이중 클릭 직후 종료될 수 있음. WeChat에서 확인했으며 QQ Music은 아직 열림 | 재서명이 샌드박스 신원을 제거해 링크가 작동하게 하지만, 앱과 컨테이너의 소유 관계도 지웁니다. 27부터 시스템이 그 관계를 확인 |
+| 외장 드라이브의 APFS 볼륨을 원래 디렉토리에 마운트 | 정상 동작하며 서명 유지 | 경로가 컨테이너를 벗어나지 않아 샌드박스가 허용. 외장 데이터 접근 권한 창이 한 번 뜨면 허용하면 됨 |
+
+세 방법 모두 macOS 27에서 직접 검증했습니다. 원본 로그는 [실험 기록: 심볼릭 링크](/en/research/sandbox-symlink)와 [실험 기록: 마운트 지점](/en/research/sandbox-mountpoint)에 있습니다.
+
+## 재서명이 실제로 바꾸는 것
+
+Ad-hoc 재서명(`codesign --force --deep --sign -`)은 앱에서 다음을 제거합니다.
+
+| 사라지는 항목 | 결과 |
+|------------|------|
+| `com.apple.security.app-sandbox` | 앱이 더 이상 샌드박스 신원으로 실행되지 않음 |
+| `com.apple.security.application-groups` | `Group Containers`의 공유 데이터를 읽지 못함 |
+| `keychain-access-groups` | 키체인의 로그인 상태와 데이터베이스 키를 읽지 못함 |
+| Team ID | 시스템이 컨테이너 소유자를 확인할 때 일치하지 않음 |
+
+앱이 즉시 고장 나는 것은 아닙니다. 일반 프로세스로 자신의 컨테이너를 읽으면 macOS 26 이하는 허용합니다. 27에서는 이전 서명에 대한 권한 기록이 시스템에 남아 있으면 코드 요구 사항 불일치로 거부합니다.
+
+```
+sandboxd rejected approval request from WeChat for kTCCServiceSystemPolicyAppData
+  (/Users/<user>/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files): denied
+runningboardd: termination reported by launchd (0, 0, 65280)
+```
+
+같은 컴퓨터의 동일하게 재서명된 WeChat에서 확인한 결과입니다.
+
+| 시스템 | 동작 |
+|------|------|
+| macOS 26.6.2 | 이틀 반 동안 계속 정상 사용 |
+| macOS 27.0 | 실행할 때마다 약 0.4초 후 종료 |
+
+::: warning ‘지금까지 괜찮았다’는 안전의 증거가 아닙니다
+재서명 후 몇 주나 몇 달 정상 사용하다가 다음 주요 시스템 업그레이드에서 문제가 발생할 수 있습니다. 업그레이드 전후에 별도 경고도 없습니다. 원 개발자의 인증서가 이 Mac에 없으므로 제거한 권한을 다시 서명해 되돌릴 수 없고 재설치해야 합니다.
+:::
+
+## 터미널에서는 왜 열리나요?
+
+문제 해결 중 이 점에 속기 쉽습니다. 시스템은 ‘책임 프로세스’를 기준으로 권한을 판단합니다. Finder나 Dock에서 이중 클릭하면 앱 자신이 책임 프로세스이며 자신의 신원으로 권한을 요청하다 거부됩니다. 터미널이나 이미 전체 디스크 접근 권한이 있는 프로그램에서 시작하면 호스트가 책임 프로세스로 취급되어 앱이 그 권한을 빌려 쓰게 됩니다.
+
+따라서 터미널에서 열린다고 해결된 것이 아닙니다. 기준은 Finder / Dock에서 이중 클릭해 여는 것입니다.
+
+## 직접 확인
+
+`/Applications/WeChat.app`을 확인할 앱으로 바꾸세요.
+
+```bash
+# 1. 签名身份
+codesign -dv --verbose=4 /Applications/WeChat.app 2>&1 | grep -E "Authority|TeamIdentifier|Signature"
+
+# 2. 授权（正常输出一段 XML；只有 Executable= 一行说明已被抹掉）
+codesign -d --entitlements - /Applications/WeChat.app
+
+# 3. 容器里有没有指向外置盘的符号链接
+find ~/Library/Containers/<Bundle ID> -maxdepth 6 -type l -exec readlink {} \; 2>/dev/null
+
+# 4. 复现一次，看系统有没有拒绝
+open -a /Applications/WeChat.app; sleep 3
+log show --last 1m --style compact 2>/dev/null | grep -iE "rejected approval request|deny\(1\) file-read-data"
+```
+
+| 확인 결과 | 의미 |
+|----------|------|
+| `Signature=adhoc`이며 `TeamIdentifier=not set` | 재서명된 상태. 열리지 않으면 앱 재설치 필요 |
+| 3단계 출력이 `/Volumes/...`를 가리킴 | 컨테이너에 이전 심볼릭 링크가 남아 있으므로 먼저 복원 필요 |
+| 로그에 `kTCCServiceSystemPolicyAppData ... denied` | 재서명 때문에 자신의 컨테이너 접근이 거부됨 |
+| 로그에 `deny(1) file-read-data /Volumes/...` | 외장 데이터로 향하는 심볼릭 링크를 샌드박스가 거부함 |
+
+두 로그가 동시에 나타날 수도 있습니다. 서로 독립된 문제이므로 각각 해결해야 합니다.
+
+## 복구
+
+순서를 바꾸면 재설치한 앱도 여전히 심볼릭 링크를 보게 되어 재설치가 소용없는 것처럼 보입니다.
+
+1. **컨테이너 데이터 복원:** AppPorts의 ‘앱 데이터’에서 해당 앱의 ‘연결됨’ 상태 컨테이너 디렉토리를 하나씩 ‘복원’하여 이 Mac으로 돌려놓습니다.
+2. **앱 재설치:** 공식 경로에서 덮어 설치해 원본 서명과 샌드박스를 복구합니다. 컨테이너 데이터는 삭제되지 않습니다.
+3. **필요하면 마운트 마이그레이션:** 재설치 후 컨테이너 디렉토리에 ‘마운트 마이그레이션’이 표시됩니다. 계속 외장 드라이브에 두고 싶으면 이 방식으로 다시 옮깁니다.
+
+새 AppPorts의 ‘원본 서명 복원’은 개발자 개인 키 없이 전체 백업에서 원래 앱을 복원할 수 있습니다. 신원 이름만 남은 이전 기록은 같은 버전의 공식 원본 앱을 선택하거나 공식 경로에서 재설치해야 합니다. [서명 백업과 복원](/ko/datamigrae/resign#서명-백업과-복원)을 참고하세요. 서명을 복원하기 전에 클래식 모드로 옮긴 컨테이너 디렉토리를 먼저 복원해야 합니다.
+
+자세한 단계와 이미 외장 드라이브로 옮긴 앱 처리 방법은 [macOS 27 업그레이드 안내](/ko/macos-27#복구)를 참고하세요.
+
+## 실제 사례
+
+2026년 9월 실제 컴퓨터에서 발생한 전체 과정입니다.
+
+| 시각 | 사건 |
+|------|------|
+| 9/15 04:46 | AppPorts가 WeChat 채팅 디렉토리를 
```

**File**: `User_docs/docs/ko/datamigrae/mount-migration.md` (added, +176/-0)
```diff
@@ -0,0 +1,176 @@
+---
+outline: deep
+---
+
+# 마운트 마이그레이션: 컨테이너 데이터를 외장 드라이브로 옮기기
+
+::: tip 핵심 내용
+`~/Library/Containers/`와 `~/Library/Group Containers/`의 데이터(WeChat 채팅 기록, QQ Music 캐시, App Store 앱 데이터)는 심볼릭 링크로 옮길 수 없습니다. AppPorts 1.8.2부터는 외장 드라이브에 전용 APFS 데이터 볼륨을 만들고 데이터를 복사한 뒤 **그 볼륨을 원래 디렉토리에 마운트**합니다. 앱에 보이는 경로와 서명은 그대로입니다.
+
+조건은 세 가지입니다. 암호화되지 않은 APFS 외장 드라이브를 사용하고, 앱을 처음 열 때 권한 창에서 허용하며, 앱을 열기 전에 드라이브를 연결해야 합니다.
+:::
+
+## 언제 사용하나요?
+
+‘데이터 디렉토리’ → ‘앱 데이터’에서 앱을 선택하면 `Containers`와 `Group Containers` 그룹 아래 디렉토리의 버튼이 ‘마이그레이션’ 대신 ‘마운트 마이그레이션’으로 표시됩니다. `Application Support`, 캐시 같은 다른 그룹과 도구 디렉토리, 사용자 지정 디렉토리는 기존 심볼릭 링크 방식을 그대로 사용합니다.
+
+컨테이너 디렉토리가 특별한 이유와 주 실행 프로그램의 샌드박스 여부만 보지 않는 이유는 [컨테이너 데이터, 샌드박스와 서명 신원](/ko/datamigrae/container-identity)을 참고하세요.
+
+## ‘마운트 마이그레이션’을 누르면 {#preflight}
+
+AppPorts는 먼저 외장 저장 장치를 읽기 전용으로 검사합니다. 아무것도 변경하지 않고 결과에 따라 다음 단계를 안내합니다.
+
+| 검사 결과 | 표시 내용 | 가능한 작업 |
+|---|---|---|
+| 암호화되지 않은 APFS이며 공간 충분 | 이 Mac에서 확보할 공간, 첫 실행 시 권한 허용, 평소 드라이브 연결 등 마이그레이션 설명 | ‘데이터 마이그레이션’으로 시작 |
+| exFAT, NTFS, HFS+ 등 | ‘이 외장 저장 장치의 포맷은 exFAT입니다’ | ‘그대로 유지’, ‘다른 위치 선택’, ‘준비 안내 보기’ |
+| 암호화된 APFS | ‘이 외장 저장 장치는 암호화되어 있습니다’ | 그대로 유지하거나 암호화되지 않은 APFS 위치 선택 |
+| 공간 부족 | 필요한 공간과 남은 공간 | 공간을 확보한 뒤 다시 확인하거나 다른 위치 선택 |
+| 외장 저장 장치를 선택하지 않았거나 연결하지 않음 | 저장 장치 선택 또는 연결 안내 | ‘외장 저장 장치 선택’, ‘다시 확인’ |
+
+**마이그레이션할 수 없어도 아무것도 바꿀 필요는 없습니다.** 실제 앱, `Application Support`, 캐시, 도구 디렉토리는 이 드라이브에 그대로 옮길 수 있습니다. 컨테이너 데이터만 이 Mac에 두면 앱을 평소처럼 사용할 수 있습니다. 나중에 옮기려면 [APFS 외장 드라이브 준비](/ko/why-apfs#prepare-apfs)를 따르세요.
+
+::: info 암호화된 APFS 드라이브를 아직 지원하지 않는 이유
+새 데이터 볼륨은 원래 볼륨의 암호를 상속하지 않습니다. 그대로 옮기면 이 Mac에서 FileVault로 보호되던 채팅 기록이 암호 없는 볼륨에 저장됩니다. 자동 잠금 해제와 암호 관리가 완성되기 전까지 AppPorts는 몰래 보호 수준을 낮추지 않습니다. [암호화된 외장 드라이브](/ko/why-apfs#encrypted-drives)를 참고하세요.
+:::
+
+## 마이그레이션 전
+
+- **AppPorts를 먼저 ‘응용 프로그램’ 폴더에 넣고 그곳에서 여세요.** 로그인 에이전트에는 지속적으로 유효한 프로그램 경로가 필요합니다. 다운로드 폴더나 DMG에서 바로 실행하면 macOS가 임시 App Translocation 경로를 사용할 수 있습니다. 이 경로를 감지하면 새 마운트 마이그레이션을 차단하고 설치를 안내합니다. AppPorts를 이동하거나 업데이트한 뒤 한 번 열면 에이전트 경로를 맞춥니다. 경로가 같으면 에이전트를 다시 로드하지 않습니다.
+- **옮길 앱을 완전히 종료하세요.** AppPorts가 확인하며 실행 중인 앱은 마이그레이션할 수 없습니다.
+- **AppPorts에 전체 디스크 접근 권한이 필요합니다.** 컨테이너 경로에 볼륨을 마운트하는 작업 자체가 시스템의 통제를 받으므로 권한이 없으면 실패합니다.
+- **백업을 고려하세요.** 모든 데이터 마이그레이션과 마찬가지로 중요한 데이터는 먼저 별도로 백업하는 것이 좋습니다. 옮긴 데이터는 외장 드라이브에 저장되며 Time Machine은 보통 외장 드라이브를 백업하지 않습니다. 필요하면 ‘시스템 설정 › 일반 › Time Machine’의 옵션에서 이 드라이브가 백업 대상인지 확인하세요.
+
+## 마이그레이션 중 일어나는 일
+
+1. 외장 드라이브의 APFS 컨테이너에 새 볼륨을 만들며 `/Volumes`에 자동으로 마운트하지 않습니다. 이름은 `AppPorts-<Bundle ID>-<目录名>-xxxxxx` 형식이고, 다른 볼륨과 남은 공간을 공유하므로 크기를 지정할 필요가 없습니다.
+2. 새 볼륨을 `~/Library/Application Support/AppPorts/mounts/` 아래에 임시 마운트하고 AppPorts 복사기로 디렉토리 내용을 복사합니다. 볼륨 루트에 `.appports-mount-metadata.plist` 표식을 기록한 뒤 마운트를 해제합니다.
+3. 원래 디렉토리의 이름을 바꾸어 같은 볼륨의 안전 백업으로 남깁니다. 원래 경로에 빈 디렉토리를 만들고 볼륨을 마운트한 뒤 올바른 볼륨인지 확인합니다.
+4. `~/Library/Application Support/AppPorts/container-mounts.plist`에 마운트 기록을 저장하고 로그인 시 자동 재마운트하는 에이전트를 설치합니다. 마지막에 안전 백업을 삭제합니다.
+
+외장 드라이브 공간이 부족하면 볼륨을 만들기 전에 중단합니다. 마이그레이션이 끝나기 전에 실패하면 AppPorts가 롤백을 시도합니다. 안전하게 롤백을 마칠 수 없으면 사본을 보존하고 남겨 둔 경로를 알려 줍니다.
+
+마이그레이션은 완료했지만 마지막에 로컬 안전 백업을 정리하지 못한 경우에도 마운트된 데이터는 계속 사용할 수 있습니다. AppPorts가 아직 정리하지 못한 백업 경로를 명확히 표시하므로 다시 마이그레이션할 필요가 없습니다.
+
+완료 후 `mount` 명령으로 볼륨이 컨테이너 경로에 직접 마운트된 것을 볼 수 있습니다.
+
+```
+/dev/disk7s5 on /Users/<user>/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files (apfs, local, nodev, nosuid, journaled, noowners, nobrowse)
+```
+
+## 마이그레이션 후 앱을 처음 열 때
+
+시스템이 앱의 이동식 볼륨 파일 접근을 허용할지 묻습니다. **‘허용’을 누르세요.** 외장 드라이브의 데이터에 대한 정상적인 macOS 검사이며 한 번만 표시됩니다.
+
+거부하면 앱은 데이터가 없는 것으로 처리해 빈 화면을 표시합니다. 해결하려면 시스템 설정 → 개인정보 보호 및 보안 → 파일 및 폴더(또는 ‘이동식 볼륨’)에서 해당 앱을 찾아 켜세요. 터미널에서 `tccutil reset SystemPolicyRemovableVolumes <Bundle ID>`를 실행해 다음에 다시 묻게 할 수도 있습니다.
+
+`/System/Applications` 아래의 시스템 앱에는 권한 창이 나타나지 않고 조용히 거부됩니다. AppPorts는 원래 이런 앱을 마이그레이션하지 않습니다.
+
+## 일상 사용
+
+**앱을 열기 전에 외장 드라이브를 연결하세요.** 드라이브가 없으면 마운트 지점은 잠긴 빈 디렉토리(권한 000)입니다. 앱에는 빈 데이터가 보이며 오류를 내거나 새 데이터를 이 Mac에 써서 두 사본을 만들지 않습니다. 연결하면 AppPorts가 볼륨을 자동으로 다시 마운트해 데이터가 돌아옵니다.
+
+**이 데이터 볼륨은 평소 Finder에 보이지 않습니다.** AppPorts가 `nobrowse` 옵션으로 마운트하므로 Finder 사이드바와 데스크탑에 표시되지 않습니다. 연결 직후 1~2초 동안 macOS가 먼저 `/Volumes`에 자동 마운트해 아이콘이 잠깐 보일 수 있지만 AppPorts가 다시 연결하면 사라집니다. 초기 버전으로 옮겨 Finder에 계속 보이는 볼륨은 다음 AppPorts 실행이나 드라이브 연결 때 제자리에서 숨겨지며, 마운트를 해제할 필요가 없습니다. ‘디스크 유틸리티’에서는 `AppPorts-…` 볼륨이 계속 보입니다. **거기서 지우거나 삭제하지 마세요.** 마이그레이션한 데이터가 들어 있는 볼륨입니다.
+
+**드라이브를 뽑기 전 앱을 종료한 뒤 AppPorts에서 ‘마운트 해제’를 누르거나 Finder에서 외장 드라이브를 추출하세요.** 바로 뽑으면 마지막 몇 초의 쓰기가 손실되고 데이터베이스를 복구해야 할 수 있습니다. 분리 시험에서 APFS 볼륨은 이런 상황에서 마지막 몇 개의 트랜잭션만 잃었습니다. [실험 기록: 드라이브 분리 시험](/en/research/unplug-test)을 참고하세요.
+
+**자동으로 다시 연결되는 시점:**
+
+- AppPorts 실행 중: 시작할 때와 새 볼륨이 시스템에 연결될 때마다 온라인이지만 마운트되지 않은 기록을 다시 마운트합니다.
+- AppPorts가 열려 있지 않을 때: 성공적인 마이그레이션 후 로그인 에이전트를 설치합니다. 로그인 시와 외장 드라이브를 연결할 때 조용히 다시 마운트한 뒤 종료합니다. 마지막 기록을 복원하면 에이전트가 자동으로 제거됩니다.
+- 부팅 직후 앱을 열면 10여 초 동안 빈 디렉토리를 볼 수 있습니다. 시스템이 로그인 항목 뒤에 에이전트를 실행하기 때문입니다. 앱을 종료했다가 다시 여세요. 마운트 지점은 계속 비어 있어 앱이 먼저 실행돼도 빈 디렉토리만 읽으며, 새 로컬 데이터
```

**File**: `User_docs/docs/ko/datamigrae/operation.md` (modified, +70/-104)
```diff
@@ -2,145 +2,111 @@
 outline: deep
 ---
 
-# 데이터 마이그레이션 작업 가이드
+# 데이터 마이그레이션 사용 안내
 
-이 페이지는 데이터 디렉토리 마이그레이션의 실용적인 작업 흐름을 다룹니다. 기술 구현 세부 사항은 [기본 구현](/ko/datamigrae/baseinfo)을 참조하세요.
+데이터 디렉토리를 실제로 마이그레이션하는 방법을 설명합니다. 기술적인 구현은 [기본 구현](/ko/datamigrae/baseinfo)을 참고하세요.
 
-## 앱 관련 데이터 디렉토리 찾기
+## 앱의 데이터 디렉토리 찾기
 
-1. AppPorts 메인 창에서 "데이터 디렉토리" 탭으로 전환합니다
-2. 왼쪽 패널에 설치된 모든 앱이 표시됩니다
-3. 앱을 클릭하면 오른쪽 패널에 `~/Library/` 하위의 관련 데이터 디렉토리가 표시됩니다
+1. AppPorts 기본 창에서 ‘데이터 디렉토리’ 탭으로 이동합니다.
+2. 상단에서 ‘도구 디렉토리 / 앱 데이터’를 전환합니다.
+3. 앱 데이터를 볼 때 왼쪽에서 앱을 선택하면 오른쪽에 `~/Library/` 아래 연결된 디렉토리가 표시됩니다.
 
-AppPorts는 앱의 Bundle ID 또는 이름으로 매칭하여 다음 디렉토리를 자동으로 스캔합니다:
+AppPorts는 Bundle ID 또는 앱 이름으로 다음 위치를 찾습니다.
 
-| 스캔 경로 | 매칭 방법 |
-|-----------|-----------|
-| `~/Library/Application Support/` | Bundle ID 또는 앱 이름 |
-| `~/Library/Preferences/` | Bundle ID 또는 앱 이름 |
-| `~/Library/Containers/` | Bundle ID |
-| `~/Library/Group Containers/` | Bundle ID |
-| `~/Library/Caches/` | Bundle ID 또는 앱 이름 |
-| `~/Library/WebKit/` | Bundle ID |
-| `~/Library/HTTPStorages/` | Bundle ID |
-| `~/Library/Application Scripts/` | Bundle ID |
-| `~/Library/Logs/` | 앱 이름 |
-| `~/Library/Saved Application State/` | 앱 이름 |
+| 스캔 경로 | 일치 기준 | 마이그레이션 방식 |
+|----------|----------|----------|
+| `~/Library/Application Support/` | Bundle ID 또는 앱 이름 | 심볼릭 링크 |
+| `~/Library/Preferences/` | Bundle ID 또는 앱 이름 | 심볼릭 링크 |
+| `~/Library/Containers/` | Bundle ID | **마운트 마이그레이션** |
+| `~/Library/Group Containers/` | Bundle ID | **마운트 마이그레이션** |
+| `~/Library/Caches/` | Bundle ID 또는 앱 이름 | 심볼릭 링크 |
+| `~/Library/WebKit/` | Bundle ID | 심볼릭 링크 |
+| `~/Library/HTTPStorages/` | Bundle ID | 심볼릭 링크 |
+| `~/Library/Application Scripts/` | Bundle ID | 심볼릭 링크 |
+| `~/Library/Logs/` | 앱 이름 | 심볼릭 링크 |
+| `~/Library/Saved Application State/` | 앱 이름 | 심볼릭 링크 |
 
-## 도구 디렉토리 (Dot-Folder)
+컨테이너 디렉토리를 다르게 처리하는 이유는 [마운트 마이그레이션](/ko/datamigrae/mount-migration)을 참고하세요.
 
-AppPorts는 사용자의 홈 디렉토리에 있는 일반적인 개발 도구가 생성한 dot-folder를 자동으로 감지합니다:
+## 도구 디렉토리
 
-1. 데이터 디렉토리 탭에서 "도구 디렉토리" 하위 탭으로 전환합니다
-2. 페이지에 감지된 모든 도구 디렉토리와 크기가 표시됩니다
-3. 각 디렉토리에 우선순위 배지(recommended/optional)와 상태가 표시됩니다
+AppPorts는 개발 도구가 사용자 폴더에 만드는 일반적인 디렉토리(`~/.npm`, `~/.gradle` 등)를 인식합니다.
 
-로컬 도구 디렉토리가 없지만 선택한 외장 저장소의 표준 위치에 AppPorts가 관리하는 디렉토리가 남아 있으면 항목이 "재링크 필요"로 표시됩니다. 외장 저장소를 바꾸면 AppPorts가 도구 디렉토리를 다시 스캔하고 이 상태를 갱신합니다. 일반 파일은 재링크 가능한 디렉토리로 취급하지 않습니다.
+1. ‘데이터 디렉토리’에서 ‘도구 디렉토리’로 전환합니다.
+2. 인식한 디렉토리의 크기, 우선순위, 상태가 표시됩니다.
 
-전체 지원 목록은 [도구 디렉토리 감지](/ko/datamigrae/tools)를 참조하세요.
+로컬 디렉토리는 없지만 외장 드라이브의 표준 위치에 AppPorts가 관리하는 디렉토리가 남아 있으면 ‘다시 연결 대기’로 표시합니다. 지원 목록은 [도구 디렉토리 인식](/ko/datamigrae/tools)을 참고하세요.
 
-## 디렉토리 마이그레이션 (사용자 지정 폴더)
+## 디렉토리 마이그레이션 — 사용자 지정 폴더
 
-"디렉토리 마이그레이션" 탭은 임의의 사용자 폴더를 마이그레이션합니다. 대형 프로젝트, 모델, 에셋 라이브러리 또는 도구 캐시를 외장 저장소로 옮길 때 유용합니다.
+‘Directory Migration’ 탭은 사용자 폴더 아래 임의의 폴더를 옮깁니다. 대형 프로젝트, 모델, 자료 라이브러리에 적합합니다.
 
-1. 메인 창에서 "디렉토리 마이그레이션"으로 전환합니다
-2. "로컬 폴더" 헤더의 "+" 버튼을 클릭합니다
-3. 마이그레이션할 로컬 폴더를 선택한 뒤 외장 저장소의 대상 루트 디렉토리를 선택합니다
-4. AppPorts는 `대상 루트/로컬 폴더 이름`을 외부 대상으로 사용하고 설정을 저장한 뒤 마이그레이션을 시작합니다
+1. ‘Directory Migration’으로 전환합니다.
+2. ‘Local Folders’ 제목 옆의 ‘+’를 누릅니다.
+3. 로컬 폴더를 선택한 뒤 외장 드라이브의 대상 루트 디렉토리를 선택합니다. 대상은 `目标根目录/文件夹名`입니다.
 
-재귀 복사, 시스템 디렉토리 마이그레이션 또는 잘못된 경로 관리 전환을 피하기 위해 다음 검사를 수행합니다:
+검증 규칙: 로컬 폴더는 사용자 폴더 안에 있어야 하지만 사용자 폴더 자체는 안 됩니다. 경로와 상위 경로가 심볼릭 링크여서는 안 되고, 관리 중인 다른 디렉토리와 서로 포함해서도 안 됩니다. 외장 대상은 사용자 폴더 안에 있을 수 없으며 로컬 폴더와도 서로 포함 관계가 될 수 없습니다.
 
-- 로컬 폴더는 현재 사용자 홈 디렉토리 아래에 있어야 하며 홈 디렉토리 전체는 선택할 수 없습니다
-- 로컬 경로와 상위 경로는 심볼릭 링크가 아니어야 합니다
-- 로컬 폴더는 이미 관리 중인 데이터 디렉토리나 디렉토리 마이그레이션 항목과 겹치면 안 됩니다
-- 외부 대상 루트는 폴더여야 하며 현재 사용자 홈 디렉토리 안에 있으면 안 됩니다
-- 최종 외부 대상은 로컬 폴더 내부에 있으면 안 되고, 로컬 폴더도 최종 외부 대상 내부에 있으면 안 됩니다
+마이그레이션 후 로컬 패널은 원래 경로의 상태, 외장 패널은 사본의 상태를 표시합니다. ‘다시 연결’ 또는 ‘복원’을 사용할 수 있습니다. 설정 제거는 기록만 지우며 데이터를 삭제하지 않습니다.
 
-마이그레이션 후 로컬 패널은 원래 경로 상태를, 외부 패널은 외부 복사본 상태를 표시합니다. 외부 패널에서 항목을 선택해 "폴더 재링크" 또는 "폴더 복원"을 실행할 수 있습니다. 설정 제거는 디렉토리 마이그레이션 목록에서만 항목을 제거하며 실제 데이터를 자동으로 삭제하지 않습니다.
+## 심볼릭 링크 마이그레이션
 
-## 마이그레이션 작업
+컨테이너 밖의 모든 디렉토리에 적용됩니다.
 
-### 단일 디렉토리 마이그레이션
+1. 디렉토리를 찾아 ‘마이그레이션’을 누릅니다.
+2. AppPorts가 외장으로 복사하고 관리 표식을 기록한 뒤 원래 디렉토리를 안전 백업으로 이름 변경합니다. 원래 경로에 심볼릭 링크를 만들고 마지막에 백업을 정리합니다.
+3. 완료 후 상태가 ‘연결됨’으로 바뀝니다.
 
-1. 데이터 디렉토리 목록에서 마이그레이션할 디렉토리를 찾습니다
-2. 오른쪽의 "마이그레이션" 버튼을 클릭합니다
-3. AppPorts가 다음 단계를 수행합니다:
-   - 디렉토리를 외장 저장소로 복사
-   - 관리 링크 메타데이터 기록
-   - 원본 로컬 디렉토리 삭제
-   - 심볼릭 링크 생성
-
-### 자동 재서명
-
-설정에서 '자동 재서명'을 활성화하면, 데이터 디렉토리 마이그레이션이 관련 앱의 서명을 자동으로 트리거합니다:
-
-1. **마이그레이션 전**: 관련 앱의 **실제 외부 경로**에서 원본 서명 백업 (로컬 셸이 아닌)
-2. **마이그레이션 후**: **실제 외부 앱**에 대해 Ad-hoc 재서명 실행 (무음 모드; 실패 시 대화상자 표시 안 함)
-
-연결된 앱의 경우, AppPorts는 Stub Portal 셸이나 심볼릭 링크 뒤의 실제 앱 경로를 자동으로 해결하여 무효한 로컬 셸이 아닌 실제 애플리케이션 패키지에 서명 변경이 적용되도록 보장합니다.
-
-::: tip 💡 수동 작업 불필요
-자동 재서명을 활성화하면 데이터 디렉토리 마이그레이션 워크플로우가 완전히 자동화됩니다. 서명 백업과 재서명 모두 실제 앱 경로를 대상으로 하므로 수동 개입이 필요 없습니다.
+::: tip 마이그레이션 후 재서명
+데이터 디렉토리 페이지 상단의 ‘마이그레이션 후 재서명’은 기본적으로 꺼져 있습니다. 켜면 완료 후 연결된 앱을 Ad-hoc 재서명합니다. 마이그레이션 뒤 손상 메시지가 나타나는 경우만을 위한 기능이며 샌드박스 앱은 건너뜁니다. 보통 켤 필요가 없습니다. [재서명과 충돌 방지](/ko/datamigrae/resign)를 참고하
```

**File**: `User_docs/docs/ko/datamigrae/resign.md` (modified, +58/-108)
```diff
@@ -2,145 +2,95 @@
 outline: deep
 ---
 
-# 재서명 및 충돌 방지
+# 재서명과 충돌 방지
 
 ![](https://pic.cdn.shimoko.com/appports/%E6%88%AA%E5%B1%8F2026-05-08%2008.38.37.png)
 
-## 데이터 마이그레이션 후 앱이 충돌하는 이유
+::: warning 재서명은 범용 복구 수단이 아닙니다
+Ad-hoc 재서명은 개발자 서명을 교체하고 샌드박스, 앱 그룹, 키체인 권한을 제거합니다. WeChat이나 App Store 앱 같은 샌드박스 앱은 macOS 27에서 열리지 않거나 로그인 상태를 잃을 수 있습니다. 새 버전은 원본 앱 전체를 먼저 보관하므로 나중에 서명과 기존 권한을 복원할 수 있습니다. 이미 잃은 로그인 상태까지 복구된다고 보장하지는 않습니다.
 
-macOS의 코드 서명 메커니즘(`codesign`)은 애플리케이션 패키지의 무결성을 검증하며, 파일 경로 구조를 포함합니다. AppPorts가 앱의 데이터 디렉토리를 외장 저장소로 마이그레이션하고 심볼릭 링크로 대체하면 서명 봉인이 깨져 다음 문제가 발생합니다:
-
-- **Gatekeeper 차단**: `codesign --verify --deep --strict`가 서명 실패를 감지; 시스템에 "손상됨" 또는 "확인되지 않은 개발자" 대화 상자가 표시되어 앱 실행이 차단
-- **Keychain 접근 장애**: Keychain 접근 그룹에 의존하는 앱이 서명 ID 변경으로 인해 저장된 자격 증명을 읽을 수 없음
-- **Entitlements 실패**: 일부 앱 entitlements는 서명 ID에 바인딩됨; 서명 변경 후 entitlements 불일치 발생
+1.8.2부터 샌드박스 앱 재서명은 기본적으로 거부하며 클래식 모드를 켜고 위험을 확인한 경우에만 허용합니다. 컨테이너 데이터는 서명 변경 없이 [마운트 마이그레이션](/ko/datamigrae/mount-migration)으로 옮깁니다. 배경은 [컨테이너 데이터, 샌드박스와 서명 신원](/ko/datamigrae/container-identity)을 참고하세요.
+:::
 
-### 고위험 앱 유형
+## 재서명이 해결하는 문제
 
-| 앱 유형 | 위험 수준 | 이유 |
-|---------|----------|------|
-| Sparkle 자체 업데이트 앱 | **높음** | 업데이터가 앱을 삭제하거나 대체하여 심볼릭 링크를 손상시킬 수 있음 |
-| Electron 자체 업데이트 앱 | **높음** | `electron-updater`도 외장 저장소의 앱을 방해할 수 있음 |
-| Keychain 의존 앱 | **높음** | Ad-hoc 서명이 서명 ID를 변경; Keychain 접근 그룹이 실패 |
-| Mac App Store 앱 | **높음** | SIP 보호; 재서명 불가 |
-| 네이티브 자체 업데이트 앱 (Chrome, Edge) | 중간 | 자체 업데이트가 외부 복사본을 대체하여 로컬 엔트리를 무효화할 수 있음 |
-| iOS 앱 (Mac 버전) | 낮음 | Stub Portal 또는 whole symlink 사용; 서명 문제가 적음 |
+macOS는 코드 서명으로 앱 번들의 무결성을 검사합니다. 실제 앱을 외장 드라이브로 옮기고 로컬에 실행 껍데기만 두면 일부 상황에서 시스템이 앱을 수정된 것으로 판단해 손상되었거나 확인되지 않은 개발자의 앱이라는 안내와 함께 실행을 거부할 수 있습니다. 이때 **외장 드라이브의 실제 앱**을 Ad-hoc 재서명하면 검사를 통과할 수 있습니다.
 
-### 고위험 데이터 디렉토리 유형
+이것이 재서명의 유일한 용도입니다. 데이터 디렉토리 마이그레이션과는 관계없습니다. 이전 버전이 이를 컨테이너 데이터 마이그레이션과 묶은 것이 macOS 27 문제의 원인이었습니다.
 
-| 데이터 유형 | 위험 수준 | 이유 |
-|------------|----------|------|
-| `~/Library/Application Support/` | 중간 | 앱이 파일 잠금, SQLite WAL 로그 또는 확장 속성을 사용할 수 있음; 심볼릭 링크를 통해 비정상적으로 동작할 수 있음 |
-| `~/Library/Group Containers/` | 중간 | 동일 Team 하위의 여러 앱이 공유; 심볼릭 링크가 다른 앱을 방해할 수 있음 |
-| `~/Library/Preferences/` | 낮음~중간 | `cfprefsd`가 plist 파일을 캐싱; 심볼릭 링크가 오래된 데이터를 읽을 수 있음 |
-| `~/Library/Caches/` | 낮음 | 캐시는 재구성 가능; 대부분의 앱이 캐시 부재를 우아하게 처리 |
+## 사용하지 말아야 할 경우
 
-## 재서명 메커니즘
+| 상황 | 설명 |
+|------|------|
+| 샌드박스 앱 | 기본적으로 거부. 클래식 모드에서 위험 확인 후 가능하지만 마운트 마이그레이션 우선 |
+| App Store 앱 | SIP 보호로 서명 불가 |
+| 키체인 로그인 상태에 의존하는 앱 | 재서명 후 로그인 상태 손실 |
+| 위젯이나 공유 확장이 있는 앱 | 앱 그룹 권한이 사라져 확장이 공유 데이터를 읽지 못함 |
+| 정상적으로 열리는 앱 | 문제가 없다면 서명하지 않기 |
 
-### Ad-hoc 서명
+외장 드라이브로 옮긴 뒤 실제로 손상 메시지가 뜨는 경우에만 고려하세요. 그전에도 재설치나 공식 사이트에서 다시 다운로드하는 방법을 먼저 시도하세요.
 
-AppPorts는 마이그레이션 후 앱 서명을 수정하기 위해 **Ad-hoc 서명**(인증서 없는 로컬 서명)을 사용합니다. 실행 명령:
+## 진입점과 설정
 
-```bash
-codesign --force --deep --sign - <앱 경로>
-```
+| 항목 | 위치 | 기본값 | 동작 |
+|------|------|------|------|
+| 이 앱 재서명 | 앱 목록 우클릭 메뉴 | 수동 | 전체 백업 후 작업 사본에 서명. 기본적으로 샌드박스 앱 거부, 클래식 모드는 위험 확인 필요 |
+| 마이그레이션 후 재서명 | 데이터 디렉토리 상단 도구 막대, 클래식 모드에만 표시 | 꺼짐 | 심볼릭 링크 마이그레이션 후 연결된 앱 재서명 |
+| 로그인 시 자동 재서명 | 설정 | 새 설치 시 꺼짐 | 이전 기록만 처리. 전체 스냅샷이 있는 새 기록은 건너뛰어 서명 트랜잭션 우회 방지 |
+| 원본 서명 복원 | 앱 우클릭 메뉴, 데이터 페이지 도구 막대, 복구 패널 | 수동 | 전체 백업에서 원래 앱 복원. 이전 기록은 같은 버전의 공식 원본 선택 가능. 개발자 개인 키 불필요 |
 
-여기서 `-`는 Ad-hoc 서명(개발자 인증서 없이)을 나타냅니다.
+샌드박스 판정은 로컬 실행 껍데기가 아닌 **실제 앱**의 권한을 읽습니다. `com.apple.security.app-sandbox`가 true면 거부합니다. [클래식 데이터 마이그레이션 모드](/ko/settings#classic-data-migration-mode)에서는 매번 추가 확인을 거쳐 허용합니다.
 
-### 서명 흐름
+## 서명 과정
 
 ```mermaid
 flowchart TD
-    A[재서명 시작] --> B[원본 서명 ID 백업]
-    B --> C{앱이 잠겨 있나?}
-    C -->|예| D[uchg 플래그를 일시적으로 해제]
-    C -->|아니오| E{앱이 쓰기 가능한가?}
-    D --> E
-    E =>|쓰기 불가 & root 소유| F[관리자 권한으로 소유권 변경 시도]
-    E =>|쓰기 가능| G[확장 속성 정리]
-    F --> G
-    F -->|실패 & MAS 앱| H[서명 건너뜀 - SIP 보호]
-    G --> I[번들 루트 디렉토리 잔여 파일 정리]
-    I --> J{Contents가 심볼릭 링크인가?}
-    J =>|예| K[실제 디렉토리 복사본으로 일시 교체]
-    J =>|아니오| L[딥 서명 실행]
-    K --> L
-    L =>|실패| M[얕은 서명으로 대체]
-    L =>|성공| N{Contents가 일시 교체되었나?}
-    M --> N
-    N =>|예| O[심볼릭 링크 복원]
-    N =>|아니오| P[uchg 플래그 재잠금]
-    O --> P
-    P => Q[서명 완료]
+    A[실제 앱 경로와 클래식 모드 권한 확인] --> B[원본 앱 전체 저장 및 내용 검사]
+    B --> C[같은 볼륨에 작업 사본 생성]
+    C --> D[사본 재서명 및 검증]
+    D --> E[원본과 재서명 내용 해시 저장]
+    E --> F[현재 앱이 변경되지 않았는지 확인]
+    F --> G[작업 사본과 현재 앱 원자적 교환]
+    D -->|실패| H[현재 앱과 백업 보존]
+    F -->|내용 변경| H
+    G -->|저장 장치가 안전한 교환을 지원하지 않음| H
 ```
 
-### 핵심 단계
-
-1. **원본 서명 ID 백업**: 서명 전 앱의 현재 서명 ID를 읽고(`codesign -dvv`로 `Authority=` 라인 파싱), `~/Library/Application Support/AppPorts/signature-backups/<BundleID>.plist`에 저장
-
-2. **확장 속성 정리**: `xattr -cr`를 실행하여 리소스 포크, Finder 정보 등을 제거하고 서명 시 "detritus not allowed" 오류 방지
-
-3. **번들 루트 디렉토리 정리**: `.DS_Store`, `__MACOSX`, `.git`, `.svn` 등의 잔여 파일 제거
+로컬 실행 껍데기는 먼저 실제 앱 경로로 해석합니다. 서명과 복원은 실제 `.app`에 적용하며 껍데기를 덮어쓰지 않습니다. 작업 사본의 서명이나 검증이 실패하면 현재 앱은 바뀌지 않으며 기존 잠금 상태도 보존합니다.
 
-4. **심볼릭 링크 Contents 처리**: `Contents/`가 심볼릭 링크인 경우(Deep Contents Wrapper 전략), 실제 디렉토리 복사본
```

---

### Incident Patch 13: `09ea97a4` (2026-09-26)
**Commit Message**: docs(ja): sync mount migration and recovery guides

**File**: `User_docs/docs/ja/AppPorts.md` (modified, +43/-43)
```diff
@@ -4,41 +4,41 @@ outline: deep
 
 # AppPorts ユーザーガイド
 
-本ガイドでは、AppPorts の機能、設計思想、技術実装について体系的に紹介します。より詳細な技術情報は[DeepWiki](https://deepwiki.com/wzh4869/AppPorts)をご参照ください。改善提案はプロジェクトの[Issues](https://github.com/wzh4869/AppPorts/issues)までご提出ください。
+このガイドでは、AppPorts の主な機能、設計方針、技術的な実装を説明します。詳しい技術情報は [DeepWiki](https://deepwiki.com/wzh4869/AppPorts) を参照してください。改善の提案は、プロジェクトの [Issues](https://github.com/wzh4869/AppPorts/issues) にお寄せください。
 
 ## 概要
 
-AppPorts は[macOS](https://www.apple.com/macos/)向けに設計されたアプリケーション移行・リンクツールで、大容量アプリケーションを外部ストレージデバイスに移行しつつ、システムの機能と一貫性を完全に維持します。
+AppPorts は [macOS](https://www.apple.com.cn/os/macos/) 向けのアプリ移行・リンクツールです。大きなアプリを外部ストレージに移しながら、Finder、Launchpad、アプリメニュー、システムによる更新の動作をできるだけ維持します。
 
 ### AppPorts の設計思想
 
-| 原則 | 説明 |
+| 方針 | 説明 |
 |------|------|
-| **透過的な体験** | ユーザー体験とOSが、アプリが依然として内部ストレージから動作していると認識できるようにする |
-| **安定した戦略** | 実績のある、より安定した移行アプローチを優先する |
-| **低いシステム負荷** | デーモンを使用せず、システムリソースの継続的な消費を回避する |
-| **広い国際化** | より多くの言語をカバーすることを優先し、翻訳の網羅性を精度より重視する |
-| **アクセシビリティ対応** | 包括的なアクセシビリティサポート |
+| **自然な使用感** | ユーザーにも OS にも、移行したアプリがローカルのアプリと同じように使えることを目指します |
+| **安定した方式** | 検証済みで、移行の安定性が高い方式を優先します |
+| **システム負荷の抑制** | デーモンに依存せず、システムリソースを常時消費しません |
+| **幅広い言語対応** | より多くの言語に対応し、翻訳の品質を継続的に改善します |
+| **アクセシビリティへの配慮** | 幅広いアクセシビリティ機能を提供します |
 
 ## 主な機能
 
-- **バッジなし移行**: 大容量アプリをワンクリックで外付けドライブに移行。ローカルには軽量なランチャーシェルのみを保持し、Finder にショートカット矢印を表示せず、Launchpad と macOS アプリメニューが正常に機能します。
-- **自動更新保護**: 自動更新に対応したアプリ（Sparkle、Electron、Chrome など）を自動検出し、「ロック移行」オプションを提供して、自動更新プログラムが外付けドライブ上のアプリを削除または上書きするのを防止します。
-- **Stub Portal バージョン同期**: 外付けドライブのアプリが App Store で更新されると、ローカル Stub Portal のバージョン情報が自動的に同期され、「開く方式」メニューに正確なバージョンが表示されます。
-- **カスタムスキャンディレクトリ**: 追加のローカルアプリスキャンディレクトリ（JetBrains Toolbox、Steam など）を指定可能。ディレクトリは保存され、変更を自動監視します。
-- **コード署名管理**: 移行後に「破損」プロンプトが表示された場合、右クリックメニューからワンクリックで再署名が可能です。元の署名のバックアップと復元をサポートし、データディレクトリ移行後の自動再署名にも対応しています。
-- **macOS 15.1+ App Store 対応**: App Store アプリを外付けドライブに直接インストールし、外付けドライブ上でインプレース更新をサポートします。
-- **ワンクリック復元**: アプリをローカルストレージに戻し、自動的にリンクを削除します。移行中断時の自動回復にも対応。
-- **データディレクトリ管理**: アプリのデータディレクトリ（`~/Library/` サブディレクトリ、`~/.npm` など）を外部ストレージに移行し、ツリービューでのグループ化、検索、ソートをサポートします。
-- **ディレクトリ移行**: ユーザーのホームディレクトリ配下にある任意の実フォルダを外部ストレージへ移動できます。大きなプロジェクト、モデル、素材ライブラリ、ツールキャッシュに適しており、再リンク、復元、パス重複検証に対応します。
+- **矢印アイコンのない移行**：大きなアプリをワンクリックで外部ストレージに移行します。ローカルには軽量な起動用のシェルだけを残し、Finder にショートカットの矢印は表示されません。Launchpad と macOS のアプリメニューにも通常どおり表示されます。
+- **自動アップデートへの対策**：Sparkle、Electron、Chrome など、自動更新機能を持つアプリを検出します。「Locked Migration」を使うと、更新プログラムによる外部コピーの削除や上書きを防げます。
+- **バージョン同期の案内**：ローカルの実体アプリが外部ストレージのコピーより新しい場合、「移行待ち」と表示します。新しいローカル版を移行して外部の旧版を置き換えられます。
+- **Stub Portal のバージョン同期**：外部ドライブのアプリが App Store で更新されると、ローカルの Stub Portal のバージョン情報も自動で同期されます。「このアプリケーションで開く」メニューにも正しいバージョンが表示されます。
+- **スキャン場所の追加**：JetBrains Toolbox や Steam など、追加のローカルアプリフォルダを登録できます。設定を保存し、変更も監視します。
+- **コード署名の管理**：アプリ本体の移行後に「壊れています」と表示される場合、コンテキストメニューから再署名できます。元の署名のバックアップと復元にも対応します。サンドボックスアプリは再署名しません。
+- **macOS 15.1 以降の App Store に対応**：App Store アプリを外部ストレージへ直接インストールし、ローカルに戻さずその場所で更新できます。
+- **ワンクリックで復元**：アプリをローカルに戻し、リンクを自動で削除します。移行が中断した場合は自動復旧できます。
+- **データディレクトリの管理**：`~/Library/` のサブディレクトリや `~/.npm` などを外部ストレージに移行できます。ツリー表示、検索、並べ替えに対応し、AppPorts の metadata で復元先を厳密に検証します。
+- **コンテナデータのマウント移行**：WeChat のチャット履歴などのサンドボックス内データは、外部 APFS ドライブに専用ボリュームを作成し、元のディレクトリにマウントして移行します。アプリの署名は変更しません。
+- **フォルダの移行**：ホームフォルダ内の実体フォルダを外部ストレージに移行できます。大きなプロジェクト、モデル、素材ライブラリ、ツールのキャッシュなどに適しています。再リンク、復元、パスの重複チェックにも対応します。
 
-## 用語集
+## 移行方式
 
-### 移行戦略
+### Deep Contents Wrapper（Contents ディレクトリの移行）
 
-#### Deep Contents Wrapper（Contents ディレクトリ移行）
-
-macOS アプリケーションの標準的なファイル構造は以下の通りです：
+macOS アプリの標準的なファイル構成は次のとおりです。
 
 ```text
 /Applications/Safari.app/
@@ -50,40 +50,40 @@ macOS アプリケーションの標準的なファイル構造は以下の通
 └── ...
 ```
 
-Deep Contents Wrapper 戦略は、アプリケーションの全コンテンツを外部ストレージに移行し、ローカルには外部の `Contents` ディレクトリを指すシンボリックリンクのみを持つ空の `.app` ディレクトリを作成します。macOS は完全な `.app` パッケージ（ショートカットではなく）を検出するため、Finder には矢印マークが表示されず、アイコン、Launchpad、アプリメニューが正常に機能します。
+Deep Contents Wrapper は、アプリの内容をすべて外部ストレージに移し、ローカルには同名の空の `.app` ディレクトリを作成します。その中には、外部ストレージの `Contents` ディレクトリを指すシンボリックリンクだけを置きます。macOS はショートカットではなく完全な `.app` パッケージとして認識するため、Finder に矢印は表示されず、アイコン、Launchpad、アプリメニューも通常どおり動作します。
 
-::: warning ⚠️ この戦略は現在のバージョンでは非推奨です
-Deep Contents Wrapper の主な欠点は、自動更新プログラムがシンボリックリンクをたどって外部ストレージ上のファイルを直接変更し、アプリケーションを破損する可能性があることです。
+::: warning 現在のバージョンでは廃止された方式です
+Deep Contents Wrapper の主な問題は、更新プログラムがシンボリックリンクをたどり、外部ストレージのファイルを直接操作してアプリ本体を壊す可能性があることです。
 :::
 
-#### Stub Portal
+### Stub Portal（起動用シェル）
 
-Stub Portal アプローチは、ローカルに最小限の `.app` シェルを作成し、以下の4つのアイテムのみを含みます：
+Stub Portal は、次の 4 項目だけを含む最小限の `.app` シェルをローカルに作成します。
 
-| コンポーネント | 説明 |
-|---------------|------|
-| `Contents/MacOS/launcher` | `open "/Volumes/External/SomeApp.app"` を実行する Bash 起動スクリプト |
-| `Contents/Resources/` | 外部アプリケーションからコピーしたアイコンファイル |
-| `Contents/Info.plist` | 外部アプリの `Info.plist` を簡略化したもの。`CFBundleExecutable` を `launcher` に設定、`LSUIElement=true`（Dock に非表示）、更新関連の設定キーをすべて削除 |
-| `Contents/PkgInfo` | 標準の4バイト識別子ファイル |
+| 要素 | 説明 |

```

**File**: `User_docs/docs/ja/badges.md` (modified, +68/-50)
```diff
@@ -4,81 +4,99 @@ outline: deep
 
 # ステータスバッジ
 
-AppPorts は、カプセル型のカラーバッジを使用してアプリとデータディレクトリの現在のステータスを表示します。一部のバッジはクリックすると詳細情報を表示します。
+AppPorts は、色付きのカプセル形バッジでアプリやデータディレクトリの状態を表示します。一部のバッジはクリックすると詳しい説明や対処方法を確認できます。
 
-## アプリステータスバッジ
+## アプリのステータスバッジ
 
-### リンクステータス
+### リンクの状態
 
 | バッジ | アイコン | 色 | 意味 |
-|--------|---------|-----|------|
-| Linked（リンク済み） | `link` | 緑 | アプリが外部ストレージに移行され、ローカルにエントリが存在する |
-| Locked Migration（ロック移行） | `lock.fill` | 緑 | リンク済みかつ `uchg` でロックされ、自動更新による外部アプリの破損を防止 |
-| Unlocked Migration（ロック解除移行） | `lock.open` | オレンジ | リンク済みだがロックされていない；アプリ内更新により外部アプリが削除される可能性がある |
-| Partial Link（部分リンク） | `link.badge.plus` | 黄 | アプリコンポーネントの一部がリンクされている（例：ディレクトリ内の一部の `.app` ファイル） |
-| Orphan Link（孤立リンク） | `link.badge.exclamationmark` | 赤 | 外部ストレージのアプリが失われたが、ローカルエントリが残存している |
-| Unlinked（未リンク） | `externaldrive.badge.xmark` | オレンジ | 外部ストレージにアプリが存在するが、ローカルにリンクされていない |
-| External（外部） | `externaldrive` | オレンジ | 外部ストレージにアプリが存在し、ローカルエントリがない |
-| Pending Move Out（移行待ち・外へ） | `arrow.up.right.circle` | シアン | ローカルの実アプリが外部ストレージの古いコピーより新しく、外部へ移行して置き換え可能 |
-| Local（ローカル） | `macmini` | セカンダリ色 | 通常のローカルアプリで、移行されていない；他のタグがない場合に表示 |
-
-::: tip Pending Move Out の判定
-AppPorts はまず Bundle ID でローカルアプリと外部アプリを照合し、必要に応じて正規化したアプリ名で補完します。双方のバージョンを比較でき、ローカルの方が新しい場合のみ表示されます。
+|------|------|------|------|
+| Linked | `link` | 緑 | 外部ストレージへ移行済みで、ローカルの起動用エントリも作成済み |
+| Locked Migration | `lock.fill` | 緑 | リンク済みで `uchg` によりロックされています。自動更新による外部コピーの破損を防ぎます |
+| Unlocked Migration | `lock.open` | オレンジ | リンク済みですが未ロック。アプリ内更新が外部コピーを削除または上書きする可能性があります |
+| 部分的にリンク | `link.badge.plus` | 黄 | 一部の構成要素だけがリンク済み（ディレクトリ内の一部の `.app` など） |
+| 孤立リンク | `link.badge.exclamationmark` | 赤 | 外部ストレージのアプリがなくなっていますが、ローカルの起動用エントリは残っています |
+| 未リンク | `externaldrive.badge.xmark` | オレンジ | 外部ストレージにあるアプリが、まだローカルにリンクされていません |
+| 外部 | `externaldrive` | オレンジ | 外部ストレージにあるアプリで、ローカルに起動用エントリがありません |
+| 移行待ち | `arrow.up.right.circle` | シアン | ローカルの実体アプリが外部の同名コピーより新しく、外部の旧版を置き換えて移行できます |
+| ローカル | `macmini` | セカンダリ | 未移行の通常のローカルアプリ。ほかのラベルがない場合に表示します |
+
+::: tip 「移行待ち」の判定方法
+AppPorts はまず Bundle ID でローカルと外部のアプリを照合し、必要に応じて正規化したアプリ名で補います。両方のバージョンを比較でき、ローカル版が新しい場合だけ「移行待ち」を表示します。バージョンがない、形式を比較できない、同名でも Bundle ID が異なる場合は通常のローカル状態を維持し、外部アプリの誤った上書きを防ぎます。
 :::
 
-### フレームワークラベル
+### フレームワークのラベル
 
-| バッジ | アイコン | 色 | 意味 | クリック時の動作 |
-|--------|---------|-----|------|-----------------|
-| Sparkle | `arrow.triangle.2.circlepath` | シアン | Sparkle フレームワークを使用して自動更新 | 外部ストレージに移行後、アプリ内更新により外部アプリが失われる可能性があるため、ロック移行を推奨 |
-| Electron | `atom` | インディゴ | Electron フレームワークベースで自動更新対応 | 外部ストレージに移行後、アプリ内更新により外部アプリが失われる可能性があるため、ロック移行を推奨 |
+| バッジ | アイコン | 色 | 意味 | クリック時の説明 |
+|------|------|------|------|----------|
+| Sparkle | `arrow.triangle.2.circlepath` | シアン | Sparkle フレームワークで自動更新します | 外部ストレージへの移行後、アプリ内更新で外部コピーが失われる可能性があるため、ロック付き移行を推奨します |
+| Electron | `atom` | インディゴ | Electron ベースで、自動更新に対応する場合があります | 外部ストレージへの移行後、アプリ内更新で外部コピーが失われる可能性があるため、ロック付き移行を推奨します |
 
-### タイプラベル
+### 種類のラベル
 
 | バッジ | アイコン | 色 | 意味 |
-|--------|---------|-----|------|
-| Running（実行中） | `play.fill` | 紫 | 現在実行中のアプリ |
-| System（システム） | `lock.fill` | グレー | macOS システムアプリケーション |
-| Non-native（非ネイティブ） | `iphone` | ピンク | iOS/iPadOS アプリ（Apple Silicon 経由で実行） |
-| Store（ストア） | `applelogo` | 青 | Mac App Store アプリケーション |
+|------|------|------|------|
+| 実行中 | `play.fill` | 紫 | アプリが実行中です |
+| システム | `lock.fill` | グレー | macOS のシステムアプリ |
+| 非ネイティブ | `iphone` | ピンク | Apple Silicon で動作する iOS/iPadOS アプリ |
+| ストア | `applelogo` | 青 | Mac App Store アプリ |
 
-### 特殊ラベル
+### 特別なラベル
 
 | バッジ | アイコン | 色 | 意味 |
-|--------|---------|-----|------|
-| Re-signed（再署名済み） | `seal.fill` | シアン | アプリが Ad-hoc 再署名された（移行後に「破損」が表示された際に実行） |
+|------|------|------|------|
+| Resigned | `seal.fill` | シアン | 現在の署名が Ad-hoc で、AppPorts に署名のバックアップがあります |
+| 署名置換済み | `exclamationmark.shield.fill` | 赤 | AppPorts が開発元の署名を Ad-hoc に置き換えました。macOS 27 で開けない場合があります。クリックで説明を表示し、コンテキストメニューの「修復手順を表示」で修復パネルを開けます。[macOS 27 へのアップグレード](/ja/macos-27)を参照してください |
 
-::: tip 💡 Store ラベルについての特別な備考
-アプリが以下の条件を満たす場合、「Store」ラベルはクリック可能になり、macOS 15.1+ のネイティブインストール手順が表示されます：
-- アプリが外部ストレージの `/Volumes/{drive}/Applications/` ディレクトリに存在する
-- macOS によりネイティブに管理されており、App Store がこのディレクトリでインクリメンタル更新を直接実行可能
+::: tip 「Resigned」と「署名置換済み」の違い
+どちらも現在の署名が Ad-hoc であることを示します。違いは**元の署名**です。「Resigned」のアプリには元から開発元の署名がなかったか、確認できなくなっており、再署名は通常どおり開けるようにするための処理です。「署名置換済み」は元の開発元署名が Ad-hoc に置き換えられたアプリです。サンドボックスアプリはその影響で macOS 27 で開けなくなる場合があるため、赤で表示し、修復への入口を用意しています。
 :::
 
-## データディレクトリステータスバッジ
+::: tip ストアラベルについて
+次の条件を満たす場合、「ストア」をクリックすると macOS 15.1 以降の標準の外部インストール機能の説明を表示します。
 
-| ステータス | 色 | 意味 |
-|-----------|-----|------|
-| Local（ローカル） | セカンダリ色 | ローカルストレージ上のディレクトリで、移行されていない |
-| Linked（リンク済み） | 緑 | 外部ストレージに移行済み；ローカルはシンボリックリンク |
-| Needs Normalization（正規化が必要） | 黄 | AppPorts 管理のリンクだが、外部パスが正規の場所にない；「正規化」操作を推奨 |
-| Needs Relinking（再リンクが必要） | オレンジ | 外部ストレージデータが存在するが、ローカルのシンボリックリンクが失われている；「再リンク」操作を推奨 |
-| Existing Soft Link（既存のソフトリンク） | 青 | ユーザーが作成したシンボリックリンク（AppPorts が作成したものではない）；管理引き継ぎのオプションあり |
+- アプリが外部ストレージの `/Volumes/{drive}
```

**File**: `User_docs/docs/ja/changelog.md` (modified, +33/-0)
```diff
@@ -4,6 +4,39 @@ outline: deep
 
 # 変更履歴
 
+## v1.8.2（開発中）
+
+### 重要な変更
+
+- **コンテナデータをマウント移行へ変更**：`~/Library/Containers/` と `~/Library/Group Containers/` 内のディレクトリはシンボリックリンクで移さず、APFS の外部ドライブに独立したボリュームを作成し、元のディレクトリへマウントします。アプリの署名は変更しません。APFS の外部ドライブが必要で、アプリの初回起動時にリムーバブルボリュームへのアクセスを許可してください。[マウント移行](/ja/datamigrae/mount-migration)を参照してください。
+- **サンドボックスアプリを再署名しないように変更**：右クリックメニュー、「Re-sign after migration」、ログイン時の自動再署名スクリプトのすべてで、サンドボックスアプリをスキップします。旧版で再署名したアプリは macOS 27 で開けなくなる可能性があります。[macOS 27 へのアップグレード](/ja/macos-27)に対処方法をまとめています。
+- **「Restore Original Signature」を修正**：再署名前に元のアプリ全体をバックアップし、作業用コピーで検証してから安全に置き換えます。元の署名とエンタイトルメントの復元に開発元の秘密鍵は不要です。旧形式の記録では同じバージョンの公式の元アプリを選択できます。更新済みのアプリや破損したバックアップを使って強制的に上書きすることはありません。
+- **署名を置き換えたアプリの自動検出と修復案内**：アプリ一覧に赤い「署名置換済み」バッジを表示し、起動時に一度通知します。右クリックの「修復手順を表示」で修復パネルを開き、データの復元、ローカルへの移動、再インストール、マウント移行の順に案内します。データは削除しません。再インストールで署名が戻るとバッジが消えます。スキャンでは復元用のデータを保持し、AppPorts で復元を完了したらバックアップを削除します。
+- **クラシックデータ移行モード**：設定にデフォルトでオフのスイッチを追加しました。有効化にはリスクの確認が必要です。1.8.1 のシンボリックリンク + 再署名方式を復活させるもので、旧方式に依存するユーザー向けに残しています。APFS でない場合は、このモードを有効にせず、そのまま使うことをお勧めします。
+- 「ログイン時自動再署名」は新規インストール時にデフォルトでオフになります。ログインエージェントをすでにインストールしているユーザーは、以前の設定を維持します。
+- クラシックモード以外では、コンテナディレクトリの「整理」「再リンク」「リンクの詳細」を無効にし、シンボリックリンクの再作成を防ぎます。
+
+### 改善
+
+- **「マウント移行」で最初に読み取り専用の確認を行い、状況に応じて案内**：外部ストレージが未暗号化の APFS なら、解放できる容量、初回アクセスの許可、通常使用時のドライブ接続について説明します。exFAT / NTFS / HFS+、暗号化済み、容量不足、未接続の場合は理由を説明し、「このままにする」「別の場所を選択」「準備方法を見る」などを提供します。何も変更しません。ようこそ画面と設定の準備状況も同じ方針に揃え、APFS 以外のユーザーをクラシックモードへ誘導しないようにしました。
+- **データボリュームを Finder に表示しないように変更**：新しいボリュームは `/Volumes` に自動マウントせず、`nobrowse` でマウントします。初期バージョンでマウントしたボリュームは、次回の起動または接続時にその場で非表示にし、マウント解除は不要です。
+- **暗号化された APFS ドライブでのマウント移行は現在非対応**：新しいボリュームは元のパスワードを引き継がないため、未暗号化のボリュームを黙って作成せず、停止して理由を説明します。
+- **移行と復元の前に空き容量を確認**：外部ドライブまたはローカルの容量が不足していれば、ボリューム作成やコピーの前に停止します。
+- **復元の安全性を向上**：マウント解除後は空のマウントポイントだけを削除し、再帰的な削除は行いません。一時ディレクトリは隠し名に変更しました。最終段階で完了しなければ外部ボリュームと記録をそのまま保持し、ローカルのコピーの場所を案内します。
+- **管理対象のボリュームだけを操作**：マウント、マウント解除、復元の前に、マウントポイントのボリュームの ID を照合します。ログインエージェントと共有するロックを取得できなければ操作を開始しません。移行記録が読めない場合、空の記録として上書きしません。
+- **ログインエージェントのパスを自動調整**：AppPorts の起動ごとにエージェントの参照先を確認し、移動や更新後に自動で変更します。DMG や「ダウンロード」フォルダから直接実行した際の一時的な App Translocation パスでは、新しいマウント移行をブロックし、先に「アプリケーション」へ移すよう案内します。
+- macOS 12 など、管理者権限が必要なシステムでのマウント移行は、システムのパスワードダイアログを表示して再試行します。
+- ログイン後にコンテナボリュームを自動で再マウントします。AppPorts の実行中に接続した場合も同様です。ログインエージェントは `/Volumes` も監視し、ログイン項目のアプリが起動する前にマウントを完了します。エージェントと AppPorts はプロセス間ロックで排他制御し、移行や復元中にマウントポイントを奪い合いません。
+- **ログインエージェントがログイン項目の後に回されないように変更**：`KeepAlive`（失敗時のみ再起動）で実行が必要なことを宣言し、`ProcessType: Background` を削除しました。ログイン直後はユーザードメインがしばらく on-demand-only モードになるため、以前の定義では launchd により約 20 秒後まで遅延され、ログイン項目のアプリは 3 秒で起動していました。
+- **システムが先に自動マウントした場合は、自動で再マウント**：`diskutil mount -mountPoint` は、ボリュームが先に `/Volumes` にマウントされていてもエラーにせず、指定を無視して `mounted` を出力し、0 を返します。2026-09-21 と 09-23 にそれぞれ一度、コマンドは成功したのにマウントポイントが空で、WeChat が空のディレクトリを読む事象がありました。現在は毎回、目的のパスに実際にマウントされたか検証し、違う場合は `/Volumes` から解除して再マウントします。最大 3 回試行します。
+- **起動時に最も時間がかかる `diskutil` 問い合わせを削減**：システムが先に `/Volumes/<卷名>` にマウントしたボリュームを、`statfs` とルートのマーカーでマイクロ秒単位に識別します。実測で 9 秒かかっていた `diskutil info` を省けます。実機では、マウント先の確認から完了まで `unmount` と `mount` の 2 コマンドだけとなり、約 1 秒でした。
+- **ドライブがすぐに現れなくても、ログインエージェントが一度で終了しないように変更**：プロセス内で `/Volumes` の実際の変化を待って再試行します。実測ではボリュームの出現からマウント完了まで約 1 秒でした。イベントが一切ない場合にも 20 秒ごとに再確認し、待機期間は合計 180 秒です。待機中は AppPorts と共有するプロセス間ロックを保持しません。
+- **何もすることがないエージェント実行時のログを削減**：launchd の `WatchPaths` は FSEvents のパスプレフィックスで一致を判定するため、外部ドライブへの書き込みごとにエージェントを起動しますが、その大半では処理がありません。そのような回のログを 3 行だけにし、項目ごとの詳細は実際のマウント、オフライン、失敗時のみ記録します。
+- **マウント処理の diskutil 呼び出しを半減**：ボリュームの接続状態と現在のマウント先を同じ `diskutil info` で取得し、1 ボリュームあたりの問い合わせを 4 回から 2 回に減らしました。起動時は 1 回に約 1 秒かかるため、数秒の短縮になります。
+- **Spotlight によるボリュームのインデックス作成を停止**：作成時にルートへ `.metadata_never_index` を書き込み、システムがすでに作成した `.Spotlight-V100` を削除します。WeChat の 2 ボリュームで合計 110 MB でした。既存の移行済みボリュームには次回マウント時に追加します。マーカーはボリュームに保持され、復元時にローカルへ戻しません。
+- Bundle ID の末尾が `mac`、`desktop` などの一般的な語の場合に、別のアプリのコンテナへ誤一致する問題を修正しました。Termius に QQ Music のコンテナが表示される例がありました。
+- コンテナのパスが `/private/var` 形式の場合に、サブディレクトリがスキャンされない問題を修正しました。
+
 ## v1.8.0
 
 ### 新機能
```

**File**: `User_docs/docs/ja/datamigrae/baseinfo.md` (modified, +71/-72)
```diff
@@ -6,94 +6,93 @@ outline: deep
 
 ![](https://pic.cdn.shimoko.com/appports/%E6%88%AA%E5%B1%8F2026-05-08%2008.38.05.png)
 
-AppPorts のデータ移行機能は、アプリに関連するデータディレクトリ（`~/Library/Application Support`、`~/Library/Caches` など）を外部ストレージに移行し、ローカルのディスク容量を解放します。
+AppPorts のデータ移行は、アプリに関連するデータディレクトリを外部ドライブに移し、ローカルの空き容量を増やします。ディレクトリの場所に応じて 2 つの方式を使います。
 
-## コア戦略：シンボリックリンク
+| ディレクトリ | 方式 | 理由 |
+|------|------|------|
+| `~/Library/Containers/`、`~/Library/Group Containers/` | マウント移行 | サンドボックスは解決後の実際のパスを検査するため、コンテナ外へのシンボリックリンクは拒否されます |
+| その他の `~/Library/` サブディレクトリ、ツールディレクトリ、カスタムフォルダ | シンボリックリンク | サンドボックスの制限を受けず、最も単純な方式です |
 
-データディレクトリの移行には**Whole Symlink**戦略を使用します：
+このページではシンボリックリンク方式を説明します。マウント方式は[マウント移行](/ja/datamigrae/mount-migration)を参照してください。
 
-1. 元のローカルディレクトリ全体を外部ストレージにコピー
-2. 管理リンクメタデータ（`.appports-link-metadata.plist`）を外部ディレクトリに書き込む
-3. 元のローカルディレクトリを同じボリューム上の隠し安全バックアップにリネーム
-4. 元のパスに外部コピーを指すシンボリックリンクを作成
-5. シンボリックリンク作成後にローカル安全バックアップを削除
+## シンボリックリンク方式
+
+1. ローカルのディレクトリを外部ドライブにすべてコピーします。
+2. 外部のディレクトリに管理マーカー `.appports-link-metadata.plist` を書き込みます。
+3. ローカルの元ディレクトリを、同じボリューム上の非表示の安全用バックアップに名前変更します。
+4. 元のパスに、外部コピーを指すシンボリックリンクを作成します。
+5. リンクの作成に成功したら、安全用バックアップを削除します。
 
 ```
 ~/Library/Application Support/SomeApp
-    → /Volumes/External/AppPortsData/SomeApp  (symlink)
+    → /Volumes/External/AppPortsData/SomeApp  （符号链接）
 ```
 
-## 移行フロー
-
 ```mermaid
 flowchart TD
-    A[データディレクトリを選択] --> B{権限と保護チェック}
-    B -->|失敗| Z[終了]
-    B -->|成功| C{ターゲットパスの競合検出}
-    C -->|管理メタデータあり| D[自動回復モード]
-    C -->|競合なし| E[外部ストレージにコピー]
+    A[データディレクトリを選択] --> B{権限と保護状態を確認}
+    B -->|失敗| Z[中止]
+    B -->|成功| C{移行先のパス競合を確認}
+    C -->|管理マーカーが完全一致| D[自動復旧モード]
+    C -->|実体ディレクトリと競合| Y[中止して競合を通知]
+    C -->|競合なし| E[外部ドライブにコピー]
     D --> E
-    E --> F[管理リンクメタデータを書き込み]
-    F --> G[ローカルディレクトリを安全バックアップにリネーム]
-    G -->|失敗| H[外部コピーを保持して停止]
+    E --> F[管理マーカーを書き込む]
+    F --> G[ローカルの安全用バックアップに名前変更]
+    G -->|失敗| H[外部コピーを残して停止]
     G -->|成功| I[シンボリックリンクを作成]
-    I -->|失敗| J[ローカル安全バックアップを復元し外部コピーを保持]
-    I -->|成功| K[ローカル安全バックアップを削除]
+    I -->|失敗| J[ローカルを復旧して外部コピーを保持]
+    I -->|成功| K[安全用バックアップを削除]
     K -->|成功| L[移行完了]
-    K -->|失敗| M[移行完了、ただし安全バックアップは残る]
+    K -->|失敗| M[移行完了しバックアップは保持]
 ```
 
-## 管理リンクメタデータ
+## 管理マーカー
 
-AppPorts は、そのディレクトリが AppPorts によって管理されていることを識別するために、外部ディレクトリに `.appports-link-metadata.plist` ファイルを書き込みます。メタデータには以下の情報が含まれます：
+外部ディレクトリの `.appports-link-metadata.plist` は、AppPorts がそのディレクトリを管理していることを示します。
 
 | フィールド | 説明 |
-|-----------|------|
-| `schemaVersion` | メタデータバージョン番号（現在は1） |
-| `managedBy` | 管理者識別子（`com.shimoko.AppPorts`） |
+|------|------|
+| `schemaVersion` | バージョン番号。現在は 1 |
+| `managedBy` | `com.shimoko.AppPorts` |
 | `sourcePath` | 元のローカルパス |
-| `destinationPath` | 外部ストレージのターゲットパス |
-| `dataDirType` | データディレクトリタイプ |
-
-このメタデータはスキャン時に使用され、AppPorts 管理のリンクとユーザーが作成したシンボリックリンクを区別し、移行中断時の自動回復をサポートします。
-
-自動回復では厳密な一致を使用します。外部ターゲットがすでに存在する場合、`schemaVersion`、`managedBy`、`sourcePath`、`destinationPath`、`dataDirType` が現在の操作とすべて一致するときだけ、AppPorts は回復可能な対象として扱います。一致するメタデータがない実ディレクトリは競合として扱われ、ディレクトリサイズが近いだけでは回復や引き継ぎを行いません。
-
-再リンクと正規化はディレクトリだけを対象にします。AppPorts は外部の通常ファイルをデータディレクトリとして再リンクまたは移動することを拒否し、ファイルがローカルのシンボリックリンクに置き換わることを防ぎます。
-
-## サポートされるデータディレクトリタイプ
-
-| タイプ | パスの例 |
-|--------|---------|
-| `applicationSupport` | `~/Library/Application Support/` |
-| `preferences` | `~/Library/Preferences/` |
-| `containers` | `~/Library/Containers/` |
-| `groupContainers` | `~/Library/Group Containers/` |
-| `caches` | `~/Library/Caches/` |
-| `webKit` | `~/Library/WebKit/` |
-| `httpStorages` | `~/Library/HTTPStorages/` |
-| `applicationScripts` | `~/Library/Application Scripts/` |
-| `logs` | `~/Library/Logs/` |
-| `savedState` | `~/Library/Saved Application State/` |
-| `dotFolder` | `~/.npm`、`~/.vscode` など |
-| `custom` | ユーザー定義パス |
-
-## 復元フロー
-
-1. ローカルパスが有効な外部ディレクトリを指すシンボリックリンクであることを確認
-2. ローカルのシンボリックリンクを削除
-3. 外部ディレクトリをローカルにコピー
-4. 外部ディレクトリを削除（ベストエフォート）
-
-コピーに失敗した場合、一貫性を維持するためにシンボリックリンクを自動的に再構築します。
-
-## エラーハンドリングとロールバック
-
-移行プロセスの各重要なステップには、ロールバックメカニズムが含まれています：
-
-- **コピー失敗**: それ以上のアクションは実行されない；コピーされた外部ファイルをクリーンアップ
-- **ローカル安全バックアップへの移動失敗**: 移行を停止し、外部コピーを保持します。ローカルの元ディレクトリは削除されません
-- **シンボリックリンク作成失敗**: 可能な場合はローカル安全バックアップを元のパスへ復元し、外部コピーも保持して両側のデータ消失を避けます
-- **安全バックアップ削除失敗**: 移行自体は完了扱いです。ローカルに `.appports-migration-backup-*` フォルダが残るため、確認後に手動削除できます
-
-この設計により、どの段階で失敗が発生してもデータの損失がなく、システム状態の一貫性が保証されます。
+| `destinationPath` | 外部の移行先パス |
+| `dataDirType` | データディレクトリの種類 |
+
+スキャン時には AppPorts が作ったリンクと手動作成のリンクを区別し、移行中断時には自動復旧に使います。照合は厳密で、5 つのフィールドがすべて一致する場合だけ処理を再開できる管理対象とみなします。それ以外は競合として扱い、サイズが似ているだけで管理を引き継いだり上書きしたりすることはありません。
+
+再リンクと整理の対象はディレクトリだけです。外部の通常ファイルをディレクトリとして再リンクしません。
+
+## 対応するデータディレクトリ
+
+| 種類 | パス | 方式 |
+|------|------|------|
+| `applicationSupport` | `~/Library/Application Support/` | シンボリックリンク |
+| `preferences` | `~/Library/Preferences/` | シンボリックリンク |
+| `containers` | `~/Library/Containers/` | マウント |
+| `groupContainers` | `~/Library/Group Containers/` | マウント |
+| `caches` | `~/Library/Caches/` | シンボリックリンク 
```

**File**: `User_docs/docs/ja/datamigrae/container-identity.md` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+---
+outline: deep
+---
+
+# コンテナデータ、サンドボックスと署名 ID
+
+::: tip 要点
+`~/Library/Containers/` と `~/Library/Group Containers/` のデータは、**サンドボックスアプリ**のものです。「ショートカット」（シンボリックリンク）で外部ドライブへ移すと読めなくなります。以前の AppPorts は再署名でこの制約を回避していましたが、macOS 27 でアプリが開けなくなったり、ログイン状態が失われたりする可能性があります。
+
+1.8.2 以降はコンテナデータに[マウント移行](/ja/datamigrae/mount-migration)を使い、署名を 1 バイトも変更しません。すでに再署名したアプリは再インストールが必要です。[macOS 27 へのアップグレード](/ja/macos-27)に手順をまとめています。
+:::
+
+このページでは経緯と仕組みを説明します。すでにアプリを開けない場合は、[macOS 27 へのアップグレード](/ja/macos-27)の修復手順へ進んでください。
+
+## コンテナとは
+
+macOS の多くのアプリはサンドボックス内で動作します。システムは各アプリに `~/Library/Containers/<Bundle ID>/` という専用フォルダを割り当て、アプリはその中でのみ読み書きできます。App Store のアプリには必須で、WeChat や QQ Music など公式サイトから入手するアプリにも多く採用されています。複数のアプリで共有するデータは `~/Library/Group Containers/` に置かれます。
+
+サンドボックスアプリかどうかは、エンタイトルメントに `com.apple.security.app-sandbox` があるかで確認できます。
+
+```bash
+codesign -d --entitlements - --xml /Applications/WeChat.app 2>/dev/null | grep -c app-sandbox
+# 输出 1 就是沙盒应用
+```
+
+見落としやすい点があります。**メインプログラムがサンドボックスでなくても、そのコンテナを自由に移せるとは限りません。** Chrome や Edge のメインプログラムはサンドボックス内にありませんが、ウィジェットや機能拡張にはそれぞれコンテナがあり、それらの所有者はサンドボックスプロセスです。そのため AppPorts はメインプログラムに関係なく、`Containers` 内のすべてのディレクトリを同じように扱います。
+
+## コンテナデータを移す 3 つの方法
+
+| 方法 | 結果 | 理由 |
+|------|------|------|
+| 外部ドライブにコピーし、元の場所にシンボリックリンクを残す | アプリは開くがデータを読めない。WeChat は保存場所を使用できないと表示する | サンドボックスはリンクの**参照先**を検証し、コンテナ外なら拒否する。外部ドライブでもデスクトップでも結果は同じ |
+| シンボリックリンク + Ad-hoc 再署名 | macOS 26 以前では使えるが、27 では起動直後に終了する場合がある。WeChat で確認済み、QQ Music は引き続き開ける | 再署名でサンドボックス ID を取り除いたためリンクが機能する。しかしアプリとコンテナの所有関係も消し、macOS 27 ではその関係が確認される |
+| 外部ドライブの APFS ボリュームを元のディレクトリにマウントする | 正常に動作し、署名も変更しない | パスがコンテナ外に出ないためサンドボックスの検証を通過する。外部ドライブのデータに対するシステムの許可を一度求められるので、許可すればよい |
+
+3 つとも macOS 27 で実測済みです。元のログは[実験記録：シンボリックリンク](/en/research/sandbox-symlink)と[実験記録：マウントポイント](/en/research/sandbox-mountpoint)を参照してください。
+
+## 再署名が変更するもの
+
+Ad-hoc 再署名（`codesign --force --deep --sign -`）は、アプリから次の情報を取り除きます。
+
+| 失われる情報 | 影響 |
+|------------|------|
+| `com.apple.security.app-sandbox` | サンドボックスの ID で動作しなくなる |
+| `com.apple.security.application-groups` | `Group Containers` 内の共有データを読めなくなる |
+| `keychain-access-groups` | キーチェーンのログイン状態やデータベースの鍵を読めなくなる |
+| Team ID | コンテナの所有者をシステムが確認するときに一致しなくなる |
+
+直後に問題が起きるとは限りません。通常のプロセスとして自分のコンテナを読む動作は、macOS 26 以前では許可されます。macOS 27 では、システムに元の署名の許可記録があると、コード要件の不一致によって拒否されます。
+
+```
+sandboxd rejected approval request from WeChat for kTCCServiceSystemPolicyAppData
+  (/Users/<user>/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files): denied
+runningboardd: termination reported by launchd (0, 0, 65280)
+```
+
+同じマシン上の、同じ再署名済みの WeChat での結果です。
+
+| システム | 動作 |
+|------|------|
+| macOS 26.6.2 | 2 日半継続して正常に使用 |
+| macOS 27.0 | 起動するたびに約 0.4 秒で終了 |
+
+::: warning 以前問題がなかったことは、安全の証拠にはなりません
+再署名後に数週間、数か月正常に使えていても、次のメジャーアップグレードで初めて問題が起きることがあります。アップグレードの前後に警告はありません。元の開発元の証明書は手元のコンピュータにはなく、消したエンタイトルメントを再署名で元に戻すことはできないため、再インストールが必要です。
+:::
+
+## ターミナルからは開ける理由
+
+調査中に誤解しやすい点です。システムは「責任を負うプロセス」を基準に判定します。Finder や Dock から開く場合はアプリ自身がそのプロセスになり、自分の ID でアクセスを要求して拒否されます。ターミナルやフルディスクアクセスを持つ別のプログラムから起動すると、起動元が責任を負うため、アプリはそのアクセス権を借りる形になります。
+
+ターミナルで起動できても、修復できたとは言えません。Finder / Dock から開けるかどうかで判断してください。
+
+## 自分で確認する
+
+`/Applications/WeChat.app` を調べたいアプリに置き換えてください。
+
+```bash
+# 1. 签名身份
+codesign -dv --verbose=4 /Applications/WeChat.app 2>&1 | grep -E "Authority|TeamIdentifier|Signature"
+
+# 2. 授权（正常输出一段 XML；只有 Executable= 一行说明已被抹掉）
+codesign -d --entitlements - /Applications/WeChat.app
+
+# 3. 容器里有没有指向外置盘的符号链接
+find ~/Library/Containers/<Bundle ID> -maxdepth 6 -type l -exec readlink {} \; 2>/dev/null
+
+# 4. 复现一次，看系统有没有拒绝
+open -a /Applications/WeChat.app; sleep 3
+log show --last 1m --style compact 2>/dev/null | grep -iE "rejected approval request|deny\(1\) file-read-data"
+```
+
+| 確認結果 | 意味 |
+|----------|------|
+| `Signature=adhoc` かつ `TeamIdentifier=not set` | 再署名されている。開けない場合はアプリの再インストールが必要 |
+| 手順 3 に出力があり、`/Volumes/...` を指している | コンテナ内に古いシンボリックリンクが残っているため、先に復元が必要 |
+| ログに `kTCCServiceSystemPolicyAppData ... denied` | 自分のコンテナへのアクセスが拒否されている。再署名が原因 |
+| ログに `deny(1) file-read-data /Volumes/...` | シンボリックリンクの追跡をサンドボックスが拒否している。データが外部ドライブにあることが原因 |
+
+2 種類のログが同時に出る場合もあります。それぞれ別の問題なので、個別に対処する必要があります。
+
+## 修復
+
+順序は変えないでください。先に再インストールすると、アプリには依然としてシンボリックリンクが見えるため、再インストールが効かなかったように見えます。
+
+1. **コンテナデータを復元**：AppPorts の「アプリデータ」で、そのアプリの「Linked」状態のコンテナディレクトリをすべて一つずつ「Restore」し、ローカルに戻します。
+2. **アプリを再インストール**：公式の配布元から上書きインストールし、元の署名とサンドボックスを復元します。再インストールでコンテナデータは削除されません。
+3. **必要に応じてマウント移行**：再インストール後、コンテナディレクトリに「マウント移行」が表示されます。外部ドライブで使い続けたい場合は、もう一度移行してください。
+
+新しい AppPorts の「Restore Original Signature」は、完全なバックアップから元のアプリを復元でき、開発元の秘密鍵は不要です。旧形式の ID の名前しかない記録では、同じバージョンの公式アプリを選択するか、公式の配布元から再インストールする必要があります。[署名のバックアップと復元](/ja/datamigrae/resign#署名のバックアップと復元)を参照してください。署名を復元する前には、クラシックモードで移行したコンテナディレクトリを先に復元してください。
+
+詳しい手順と、アプリ本体も外部ドライブへ移行している場合の対処は、[macOS 27 の修復手順](/ja/macos-27#修復)を参照してください。
+
+## 実際の事例
+
+2026 年 9 月、実機で確認した一連の経過です。
+
+| 日時 | 出来事 |
+|------|------|
+| 9/15 04:46 | AppPorts が WeChat のチャ
```

**File**: `User_docs/docs/ja/datamigrae/mount-migration.md` (added, +176/-0)
```diff
@@ -0,0 +1,176 @@
+---
+outline: deep
+---
+
+# マウント移行：コンテナデータを外部ドライブに置く
+
+::: tip 要点
+`~/Library/Containers/` と `~/Library/Group Containers/` のデータ（WeChat のチャット履歴、QQ Music のキャッシュ、App Store アプリのデータ）は、シンボリックリンクでは移せません。AppPorts 1.8.2 以降は、外部ドライブに専用の APFS データボリュームを作成し、データをコピーしてから、**元のディレクトリにマウント**します。アプリから見えるパスも署名も変わりません。
+
+必要な条件は 3 つです。暗号化されていない APFS の外部ドライブを使うこと、移行後の初回起動時にアクセスを許可すること、アプリを開く前にドライブを接続することです。
+:::
+
+## 使用する場面
+
+「データディレクトリ」→「アプリデータ」でアプリを選択すると、`Containers` と `Group Containers` グループ内のディレクトリには「Migrate」の代わりに「マウント移行」ボタンが表示されます。ほかのグループ（`Application Support`、キャッシュなど）、ツールディレクトリ、カスタムディレクトリは、従来どおりシンボリックリンクで移行できます。
+
+コンテナディレクトリが特別な理由と、メインアプリがサンドボックスかどうかで判断しない理由は、[コンテナデータ、サンドボックスと署名 ID](/ja/datamigrae/container-identity)を参照してください。
+
+## 「マウント移行」をクリックした後 {#preflight}
+
+AppPorts は最初に外部ストレージを読み取り専用で確認します。何も変更せず、結果に応じて次の操作を案内します。
+
+| 確認結果 | 表示内容 | 選択できる操作 |
+|---|---|---|
+| 暗号化されていない APFS で、空き容量が十分 | ローカルで解放できる容量、初回アクセスの許可、通常使用時にドライブの接続が必要なこと | 「データを移行」で開始 |
+| exFAT、NTFS、HFS+ など | 「この外部ストレージは exFAT フォーマットです」 | このままにする、別の場所を選択、準備方法を見る |
+| 暗号化された APFS | 「この外部ストレージは暗号化されています」 | このままにする、暗号化されていない APFS の場所を選択 |
+| 空き容量不足 | 必要な容量と現在の空き容量 | 空き容量を増やして再チェック、または別の場所を選択 |
+| 外部ストレージ未選択 / 未接続 | 外部ストレージの選択または接続の案内 | 外部ストレージを選択、再チェック |
+
+**移行できなくても、何も変更する必要はありません。** アプリ本体、`Application Support`、キャッシュ、ツールディレクトリは、そのドライブに引き続き移行できます。コンテナデータだけをローカルに残せば、アプリは通常どおり使えます。後で移行したくなったら、[APFS の外部ドライブを準備する](/ja/why-apfs#prepare-apfs)に従って準備してください。
+
+::: info 暗号化した APFS ドライブが現在非対応の理由
+マウント移行で作成するデータボリュームは、元のボリュームのパスワードを引き継ぎません。そのまま移行すると、ローカルで FileVault に保護されていたチャット履歴が、パスワードのないボリュームに保存されます。自動ロック解除とパスワード管理を実装するまでは、AppPorts はこのように保護を黙って弱めることはしません。[暗号化した外部ドライブ](/ja/why-apfs#encrypted-drives)を参照してください。
+:::
+
+## 移行前の準備
+
+- **AppPorts を「アプリケーション」フォルダに入れ、そこから開いてください。** ログインエージェントには、継続して有効なアプリのパスが必要です。ダウンロードフォルダや DMG から直接実行すると、macOS が一時的な App Translocation のパスを使う場合があります。AppPorts はこのパスを検出すると新しいマウント移行をブロックし、インストールを案内します。AppPorts を移動または更新したら一度開いて、エージェントのパスを更新してください。パスが変わらなければエージェントを再読み込みしません。
+- **移行するアプリを完全に終了してください。** AppPorts は実行状態を確認し、起動中の移行を許可しません。
+- **AppPorts にフルディスクアクセスが必要です。** コンテナのパスへのマウント自体がシステムで管理されているため、許可がないと失敗します。
+- **バックアップを検討してください。** どのデータ移行でも、重要なデータは先に別途バックアップすることをお勧めします。移行後のデータは外部ドライブにあり、Time Machine は通常外部ドライブをバックアップしません。必要に応じて「システム設定 › 一般 › Time Machine」のオプションで、対象のドライブがバックアップに含まれることを確認してください。
+
+## 移行中に行う処理
+
+1. 外部ドライブの APFS コンテナに新しいボリュームを作成します。作成直後は `/Volumes` に自動マウントしません。名前は `AppPorts-<Bundle ID>-<目录名>-xxxxxx` の形式で、同じドライブのほかのボリュームと空き容量を共有するため、サイズ指定は不要です。
+2. 新しいボリュームを `~/Library/Application Support/AppPorts/mounts/` 内に一時マウントし、AppPorts のコピー機能でディレクトリの内容をコピーします。ルートに `.appports-mount-metadata.plist` を書き込んでから、マウントを解除します。
+3. 元のディレクトリを同じボリューム上の安全用バックアップへ名前変更し、元のパスに空のディレクトリを作成します。新しいボリュームをそこにマウントし、実際に正しいボリュームであることを検証します。
+4. `~/Library/Application Support/AppPorts/container-mounts.plist` にマウント記録を書き込み、ログイン時に自動で再マウントするエージェントをインストールします。最後に安全用バックアップを削除します。
+
+外部ドライブの空き容量が不足していれば、ボリューム作成前に停止します。移行が完了する前に失敗した場合、AppPorts はロールバックを試みます。安全に完了できない場合はコピーを保持し、その保存先パスを示します。
+
+移行は完了したものの、最後にローカルの安全用バックアップを削除できなかった場合、マウント済みのデータは引き続き使用できます。AppPorts は削除が残っているバックアップのパスを明示します。再度移行する必要はありません。
+
+移行後は、`mount` コマンドでコンテナのパスへの直接マウントを確認できます。
+
+```
+/dev/disk7s5 on /Users/<user>/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files (apfs, local, nodev, nosuid, journaled, noowners, nobrowse)
+```
+
+## 移行後に初めてアプリを開くとき
+
+システムが、アプリによるリムーバブルボリューム上のファイルへのアクセス許可を求めます。**許可してください**。外部ドライブ上のデータに対する macOS の通常の確認で、一度だけ表示されます。
+
+拒否すると、アプリはデータがないものとして扱い、空の表示になります。「システム設定」→「プライバシーとセキュリティ」→「ファイルとフォルダ」（または「リムーバブルボリューム」）でそのアプリのアクセスを有効にしてください。あるいはターミナルで `tccutil reset SystemPolicyRemovableVolumes <Bundle ID>` を実行すると、次回に再度確認されます。
+
+`/System/Applications` 内のシステムアプリはダイアログが出ず、通知なく拒否されます。AppPorts はもともとこれらのアプリを移行しません。
+
+## 日常の使い方
+
+**アプリを開く前に外部ドライブを接続してください。** ドライブがないとき、マウントポイントはロックされた空のディレクトリ（アクセス権 000）になります。アプリには空のデータが見え、エラーは出ません。ローカルに新しいデータを書き込んで二重化することもありません。接続すると AppPorts がボリュームを自動で再マウントし、データが戻ります。
+
+**通常、データボリュームは Finder に表示されません。** AppPorts は `nobrowse` オプションでマウントするため、Finder のサイドバーやデスクトップには表示されません。接続直後の 1〜2 秒は、macOS が先に `/Volumes` に自動マウントし、アイコンが一瞬表示される場合がありますが、AppPorts の再マウント後に消えます。初期バージョンで移行したため今も Finder に表示されるボリュームは、次回の AppPorts 起動時またはドライブ接続時に、その場で非表示にします。マウント解除や再マウントは不要です。「ディスクユーティリティ」には `AppPorts-…` というボリュームが残ります。移行したデータそのものなので、**そこで消去や削除をしないでください**。
+
+**取り外す前にアプリを終了し、AppPorts の「マウント解除」をクリックするか、Finder で外部ドライブを取り出してください。** 直接抜くと、直前数秒の書き込みが失われたり、データベースの修復が必要になったりする可能性があります。取り外しテストでは、APFS ボリュームで失われたのは最後の数トランザクションでした。[実験記録：ドライブの取り外しテスト](/en/research/unplug-test)を参照してください。
+
+**自動で再マウントするタイミング：**
+
+- AppPorts の実行中：起動時とボリュームが接続されたときに、接続済みで未マウントの記録を自動で再マウントします。
+- AppPorts を開いていないとき：移行成功後にインストールするログインエージェントが、ログイン時と外部ドライブの接続時にバックグラウンドで再マウントし、終了します。最後の記録を復元すると、エージェントを自動的にアンインストールします。
+- 起動直後にアプリを開くと、十数秒間は空のディレクトリを読む場合があります。システムがログイン項目より後にエージェントを起動するためです。一度アプリを終了して開き直してください。マウントポイントを空のまま維持することが最後の保護になります。アプリが先に起動しても空のディレクトリだけを読み、ローカルに新しいデータを書いて分岐することはありません。ボリュームが戻ると自然に復旧します。WeChat では 3 回の実測すべてで復旧しました。
+
+::: warning macOS 12 などの旧システムでは管理者パスワードが必要
```

**File**: `User_docs/docs/ja/datamigrae/operation.md` (modified, +70/-104)
```diff
@@ -4,143 +4,109 @@ outline: deep
 
 # データ移行操作ガイド
 
-このページでは、データディレクトリ移行の実際のワークフローについて説明します。技術的な実装詳細については、[基本実装](/ja/datamigrae/baseinfo)をご参照ください。
+このページでは、データディレクトリ移行の操作を説明します。技術的な実装は[基本実装](/ja/datamigrae/baseinfo)を参照してください。
 
-## アプリ関連データディレクトリの検索
+## アプリに関連するデータディレクトリを探す
 
-1. AppPorts メインウィンドウで「データディレクトリ」タブに切り替え
-2. 左パネルにインストール済みのすべてのアプリが表示されます
-3. アプリをクリック；右パネルに `~/Library/` 以下の関連データディレクトリが表示されます
+1. AppPorts のメインウインドウで「データディレクトリ」タブに切り替えます。
+2. 上部で「ツールディレクトリ」と「アプリデータ」を切り替えられます。
+3. アプリデータを見る場合は左側でアプリを選びます。右側に、そのアプリに関連する `~/Library/` 内のディレクトリが表示されます。
 
-AppPorts は、アプリの Bundle ID または名前でマッチングしながら、以下のディレクトリを自動スキャンします：
+AppPorts は Bundle ID またはアプリ名で次の場所を照合します。
 
-| スキャンパス | マッチング方法 |
-|-------------|---------------|
-| `~/Library/Application Support/` | Bundle ID またはアプリ名 |
-| `~/Library/Preferences/` | Bundle ID またはアプリ名 |
-| `~/Library/Containers/` | Bundle ID |
-| `~/Library/Group Containers/` | Bundle ID |
-| `~/Library/Caches/` | Bundle ID またはアプリ名 |
-| `~/Library/WebKit/` | Bundle ID |
-| `~/Library/HTTPStorages/` | Bundle ID |
-| `~/Library/Application Scripts/` | Bundle ID |
-| `~/Library/Logs/` | アプリ名 |
-| `~/Library/Saved Application State/` | アプリ名 |
+| スキャンするパス | 照合方法 | 移行方式 |
+|----------|----------|----------|
+| `~/Library/Application Support/` | Bundle ID またはアプリ名 | シンボリックリンク |
+| `~/Library/Preferences/` | Bundle ID またはアプリ名 | シンボリックリンク |
+| `~/Library/Containers/` | Bundle ID | **マウント移行** |
+| `~/Library/Group Containers/` | Bundle ID | **マウント移行** |
+| `~/Library/Caches/` | Bundle ID またはアプリ名 | シンボリックリンク |
+| `~/Library/WebKit/` | Bundle ID | シンボリックリンク |
+| `~/Library/HTTPStorages/` | Bundle ID | シンボリックリンク |
+| `~/Library/Application Scripts/` | Bundle ID | シンボリックリンク |
+| `~/Library/Logs/` | アプリ名 | シンボリックリンク |
+| `~/Library/Saved Application State/` | アプリ名 | シンボリックリンク |
 
-## ツールディレクトリ（ドットフォルダ）
+コンテナだけ方式が異なる理由は[マウント移行](/ja/datamigrae/mount-migration)を参照してください。
 
-AppPorts は、ユーザーのホームディレクトリにある一般的な開発ツールが作成したドットフォルダを自動検出します：
+## ツールディレクトリ
 
-1. データディレクトリタブの「ツールディレクトリ」サブタブに切り替え
-2. ページには検出されたすべてのツールディレクトリとそのサイズが一覧表示されます
-3. 各ディレクトリには優先度バッジ（推奨/任意）とステータスが表示されます
+AppPorts は、よく使われる開発ツールがホームフォルダに作成するディレクトリ（`~/.npm`、`~/.gradle` など）を検出します。
 
-ローカルのツールディレクトリが存在しない一方で、選択中の外部ストレージの正規位置に AppPorts 管理のディレクトリが残っている場合、その項目は「Needs Relinking（再リンクが必要）」として表示されます。外部ストレージを切り替えると、AppPorts はツールディレクトリを再スキャンしてこの状態を更新します。通常ファイルは再リンク可能なディレクトリとして扱われません。
+1. 「データディレクトリ」タブで「ツールディレクトリ」に切り替えます。
+2. 検出したディレクトリ、サイズ、優先度、状態が表示されます。
 
-サポートされている完全なリストについては、[ツールディレクトリ検出](/ja/datamigrae/tools)をご参照ください。
+ローカルのディレクトリがなくても、外部ドライブの標準位置に AppPorts が管理するディレクトリがあれば「再リンク待ち」と表示します。対応一覧は[ツールディレクトリの検出](/ja/datamigrae/tools)を参照してください。
 
-## ディレクトリ移行（カスタムフォルダ）
+## フォルダの移行（カスタムフォルダ）
 
-「ディレクトリ移行」タブでは任意のユーザーフォルダを移行できます。大きなプロジェクト、モデル、素材ライブラリ、ツールキャッシュを外部ストレージへ移す用途に適しています。
+「Directory Migration」タブではホームフォルダ内の任意のフォルダを移行できます。大きなプロジェクト、モデル、素材ライブラリなどに適しています。
 
-1. メインウィンドウで「ディレクトリ移行」に切り替えます
-2. 「ローカルフォルダ」ヘッダーの「+」ボタンをクリックします
-3. 移行するローカルフォルダを選び、外部ストレージ上のターゲットルートを選びます
-4. AppPorts は `ターゲットルート/ローカルフォルダ名` を外部移行先として使い、設定を保存して移行を開始します
+1. 「Directory Migration」に切り替えます。
+2. 「Local Folders」の見出しにある「+」をクリックします。
+3. ローカルフォルダ、外部ドライブの移行先ルートの順に選びます。移行先は `目标根目录/文件夹名` です。
 
-再帰コピー、システムディレクトリの移行、誤ったパスの引き継ぎを避けるため、以下を検証します：
+ローカルフォルダはホームフォルダ内に置く必要があり、ホームフォルダそのものは指定できません。そのパスや親パスにシンボリックリンクを含めることもできません。管理中のディレクトリと包含関係にあってはいけません。外部の移行先はホームフォルダの外に置き、ローカルフォルダとの包含関係も避けてください。
 
-- ローカルフォルダは現在のユーザーのホームディレクトリ配下にある必要があり、ホーム全体は選べません
-- ローカルパスおよびその親パスはシンボリックリンクであってはいけません
-- ローカルフォルダは、既に管理されているデータディレクトリやディレクトリ移行項目と重なってはいけません
-- 外部ターゲットルートはフォルダであり、現在のユーザーのホームディレクトリ内に置けません
-- 最終的な外部ターゲットはローカルフォルダ内に置けず、ローカルフォルダも最終的な外部ターゲット内に置けません
+移行後、ローカル側には元のパスの状態、外部側にはコピーの状態が表示され、「再リンク」や「Restore」を実行できます。設定を削除しても記録だけが削除され、データは削除されません。
 
-移行後、ローカルペインには元のパスの状態、外部ペインには外部コピーの状態が表示されます。外部ペインで項目を選択すると「フォルダを再リンク」または「フォルダを復元」を実行できます。設定を削除しても移行リストから外れるだけで、実データは自動削除されません。
+## シンボリックリンクによる移行
 
-## 移行操作
+コンテナ外のすべてのディレクトリが対象です。
 
-### 単一ディレクトリの移行
+1. ディレクトリを探し、「Migrate」をクリックします。
+2. AppPorts が外部ドライブへコピーし、管理マーカーを書き込みます。元ディレクトリを安全用バックアップに名前変更し、元のパスにシンボリックリンクを作成して、最後にバックアップを削除します。
+3. 完了すると「Linked」になります。
 
-1. データディレクトリリストで移行するディレクトリを見つける
-2. 右側の「移行」ボタンをクリック
-3. AppPorts は以下のステップを実行します：
-   - ディレクトリを外部ストレージにコピー
-   - 管理リンクメタデータを書き込み
-   - 元のローカルディレクトリを削除
-   - シンボリックリンクを作成
-
-### 自動再署名
-
-設定で「自動再署名」を有効にすると、データディレクトリ移行が関連アプリの署名を自動的にトリガーします：
-
-1. **移行前**：関連アプリの**実外部パス**の元の署名をバックアップ（ローカルシェルではなく）
-2. **移行後**：**実外部アプリ**に対して Ad-hoc 再署名を実行（サイレントモード；失敗時はダイアログを表示しない）
-
-リンク済みアプリの場合、AppPorts は Stub Portal シェルやシンボリックリンクの背後にある実アプリパスを自動的に解決し、無効なローカルシェルではなく実際のアプリケーションパッケージに署名変更が適用されることを保証します。
-
-::: tip 💡 手動操作は不要
-自動再署名を有効にすると、データディレクトリ移行ワークフローは完全に自動化されます。署名バックアップと再署名はどちらも実アプリパスを対象とするため、手動介入は不要です。
+::: tip 移行後の再署名
+データディレクトリページ上部の「Re-sign after migration」はデフォルトでオフです。オンにすると、移行後に関連アプリへ Ad-hoc 再署名を行います。移行後に「壊れています」と表示される場合の対処に使うもので、サンドボックスアプリはスキップします。通常は有効にする必要はありません。[再署名とクラッシュ対策](/ja/datamigrae/resign)を参照してください。
 :::
 
-### ログコンテキスト
-
-データディレクトリ操作（移行、復元、正規化、再リンク）のログには、関連アプリのコンテキスト情報が自動的に含まれます：
-
-| フィールド | 説明 |
-|-----------|------|
-| `app_n
```

**File**: `User_docs/docs/ja/datamigrae/resign.md` (modified, +58/-108)
```diff
@@ -2,145 +2,95 @@
 outline: deep
 ---
 
-# 再署名とクラッシュ防止
+# 再署名とクラッシュ対策
 
 ![](https://pic.cdn.shimoko.com/appports/%E6%88%AA%E5%B1%8F2026-05-08%2008.38.37.png)
 
-## データ移行後にアプリがクラッシュする理由
+::: warning 再署名ですべての問題を解決できるわけではありません
+Ad-hoc 再署名はアプリの開発元の署名を置き換え、サンドボックス、アプリグループ、キーチェーンのエンタイトルメントを削除します。サンドボックスアプリ（WeChat、App Store アプリなど）は、macOS 27 で開けなくなったり、ログイン状態が失われたりする可能性があります。新しいバージョンでは元のアプリ全体を先に保存するため、後から署名と元のエンタイトルメントを復元できます。ただし、失われたログイン状態まで戻るとは限りません。
 
-macOS のコード署名メカニズム（`codesign`）は、ファイルパス構造を含むアプリケーションパッケージの完全性を検証します。AppPorts がアプリのデータディレクトリを外部ストレージに移行し、シンボリックリンクに置き換えると、署名シールが壊れ、以下の問題が発生します：
-
-- **Gatekeeper ブロック**: `codesign --verify --deep --strict` が署名失敗を検出し、システムが「破損」または「身元不明の開発者からのアプリ」というダイアログを表示し、アプリの起動をブロック
-- **Keychain アクセスの中断**: Keychain アクセスグループに依存するアプリは、署名アイデンティティの変更により保存された認証情報を読み取れなくなる
-- **Entitlements 失敗**: 一部のアプリ Entitlements は署名アイデンティティに紐づいており、署名変更後に Entitlements の不整合が発生
+1.8.2 以降、AppPorts はサンドボックスアプリの再署名をデフォルトで拒否します。クラシックモードを有効にしてリスクを確認した場合のみ許可します。コンテナデータには、署名を変更しない[マウント移行](/ja/datamigrae/mount-migration)を使用します。経緯は[コンテナデータ、サンドボックスと署名 ID](/ja/datamigrae/container-identity)を参照してください。
+:::
 
-### 高リスクアプリタイプ
+## 再署名で解決できる問題
 
-| アプリタイプ | リスクレベル | 理由 |
-|-------------|------------|------|
-| Sparkle 自動更新アプリ | **高** | アップデーターがアプリを削除または置換し、シンボリックリンクを破損する可能性がある |
-| Electron 自動更新アプリ | **高** | `electron-updater` も外部ストレージ上のアプリに干渉する可能性がある |
-| Keychain 依存アプリ | **高** | Ad-hoc 署名により署名アイデンティティが変更され、Keychain アクセスグループが失敗する |
-| Mac App Store アプリ | **高** | SIP 保護；再署名不可 |
-| ネイティブ自動更新アプリ（Chrome、Edge） | 中 | 自動更新により外部コピーが置換され、ローカルエントリが無効化される可能性がある |
-| iOS アプリ（Mac 版） | 低 | Stub Portal または全体シンボリックリンクを使用；署名の問題が少ない |
+macOS はコード署名でアプリバンドルの整合性を検証します。アプリ本体を外部ドライブに移し、ローカルに起動用シェルだけを残すと、状況によってはアプリが変更されたと判定され、「壊れている」または「開発元が未確認」という警告で起動できなくなります。その場合、**外部ドライブにあるアプリの実体**を Ad-hoc で再署名すると、検証を通過できることがあります。
 
-### 高リスクデータディレクトリタイプ
+再署名の用途はこれだけです。データディレクトリの移行とは関係ありません。旧バージョンが再署名をコンテナデータの移行と組み合わせたことが、macOS 27 での問題の原因になりました。
 
-| データタイプ | リスクレベル | 理由 |
-|-------------|------------|------|
-| `~/Library/Application Support/` | 中 | アプリがファイルロック、SQLite WAL ログ、または拡張属性を使用している可能性があり、シンボリックリンクをまたぐと異常動作する場合がある |
-| `~/Library/Group Containers/` | 中 | 同じ Team 下の複数のアプリで共有されており、シンボリックリンクが他のアプリに干渉する可能性がある |
-| `~/Library/Preferences/` | 低～中 | `cfprefsd` が plist ファイルをキャッシュしており、シンボリックリンクにより古いデータを読み取る可能性がある |
-| `~/Library/Caches/` | 低 | キャッシュは再構築可能；ほとんどのアプリはキャッシュの不在を適切に処理する |
+## 使用すべきでない場合
 
-## 再署名メカニズム
+| 状況 | 説明 |
+|------|------|
+| サンドボックスアプリ | デフォルトで拒否します。クラシックモードでリスクを確認すれば許可されますが、マウント移行を優先してください |
+| App Store アプリ | SIP によって保護されているため、署名できません |
+| ログイン状態をキーチェーンに保存するアプリ | 再署名するとログイン状態が失われます |
+| ウィジェットや共有機能拡張を持つアプリ | アプリグループのエンタイトルメントが失われ、機能拡張が共有データを読めなくなります |
+| 正常に開けるアプリ | 問題がなければ再署名は不要です |
 
-### Ad-hoc 署名
+検討するのは「外部ドライブへの移行後に、実際に破損の警告が出た」場合だけです。その場合も、まず再インストールや公式サイトからの再ダウンロードを試してください。
 
-AppPorts は移行後のアプリ署名を修正するために**Ad-hoc 署名**（証明書なしローカル署名）を使用します。実行コマンド：
+## 操作場所と設定
 
-```bash
-codesign --force --deep --sign - <app path>
-```
+| 操作 | 場所 | デフォルト | 動作 |
+|------|------|------|------|
+| Resign This App | アプリ一覧の右クリックメニュー | 手動 | アプリ全体をバックアップし、作業用コピーで署名します。サンドボックスアプリはデフォルトで拒否し、クラシックモードではリスクの確認が必要です |
+| Re-sign after migration | データディレクトリページ上部のツールバー。クラシックモードでのみ表示 | オフ | シンボリックリンク移行の完了後、関連するアプリを再署名します |
+| ログイン時自動再署名 | 設定ページ | 新規インストールではオフ | 旧形式の記録のみ処理します。署名のトランザクションを迂回しないよう、完全なスナップショットを持つ新形式の記録はスキップします |
+| Restore Original Signature | アプリ一覧の右クリックメニュー、データページのツールバー、修復パネル | 手動 | 完全なバックアップから元のアプリを復元します。旧形式の記録では同じバージョンの公式アプリを選択できます。開発元の秘密鍵は不要です |
 
-ここで `-` は Ad-hoc 署名（開発者証明書なし）を示します。
+サンドボックスの判定には、ローカルの起動用シェルではなく、**アプリの実体**のエンタイトルメントを使用します。`com.apple.security.app-sandbox` が true なら拒否します。[クラシックデータ移行モード](/ja/settings#classic-data-migration-mode)を有効にするとサンドボックスアプリも再署名できますが、毎回追加の確認が表示されます。
 
-### 署名フロー
+## 署名の流れ
 
 ```mermaid
 flowchart TD
-    A[再署名開始] --> B[元の署名アイデンティティをバックアップ]
-    B --> C{アプリはロックされていますか？}
-    C -->|はい| D[uchg フラグを一時的に解除]
-    C -->|いいえ| E{アプリは書き込み可能ですか？}
-    D --> E
-    E =>|書き込み不可 & root 所有| F[管理者権限で所有権変更を試行]
-    E =>|書き込み可能| G[拡張属性をクリーンアップ]
-    F --> G
-    F -->|失敗 & MAS アプリ| H[署名をスキップ - SIP 保護]
-    G --> I[バンドルルートディレクトリの雑多なファイルをクリーンアップ]
-    I --> J{Contents はシンボリックリンクですか？}
-    J =>|はい| K[一時的に実ディレクトリコピーに置換]
-    J =>|いいえ| L[deep 署名を実行]
-    K --> L
-    L =>|失敗| M[shallow 署名にフォールバック]
-    L =>|成功| N{Contents が一時置換されましたか？}
-    M --> N
-    N =>|はい| O[シンボリックリンクを復元]
-    N =>|いいえ| P[uchg フラグを再ロック]
-    O --> P
-    P => Q[署名完了]
+    A[アプリの実体を特定しクラシックモードの許可を確認] --> B[元のアプリ全体を保存して内容を検証]
+    B --> C[同じボリュームに作業用コピーを作成]
+    C --> D[コピーを再署名して検証]
+    D --> E[元の内容と再署名後の内容のダイジェストを保存]
+    E --> F[現在のアプリが変更されていないことを確認]
+    F --> G[作業用コピーと現在のアプリをアトミックに交換]
+    D -->|失敗| H[現在のアプリとバックアップを保持]
+    F -->|内容の変更| H
+    G -->|ストレージが安全な交換に非対応| H
 ```
 
-### 重要なステップ
-
-1. **元の署名アイデンティティのバックアップ**: 署名前に、アプリの現在の署名アイデンティティを読み取り（`codesign -dvv` で `Authority=` 行を解析）、`~/Library/Application Support/AppPorts/signature-backups/<BundleID>.plist` に保存
-
-2. **拡張属性のクリーンアップ**: `xattr -cr` を実行してリソースフォーク、Finder 情報などを削除し、署名中の「detritus not allowed」エラーを
```

---

### Incident Patch 14: `74fbb6df` (2026-09-26)
**Commit Message**: docs(zh-Hant): sync mount migration and recovery guides

**File**: `User_docs/docs/zh-Hant/AppPorts.md` (modified, +41/-40)
```diff
@@ -2,43 +2,44 @@
 outline: deep
 ---
 
-# AppPorts 用戶指南
+# AppPorts 使用者指南
 
-本指南旨在系統性地介紹 AppPorts 的功能、設計原理與技術實現。更多技術細節請參見 [DeepWiki](https://deepwiki.com/wzh4869/AppPorts)，如有改進建議請提交至項目 [Issues](https://github.com/wzh4869/AppPorts/issues)。
+本指南系統介紹 AppPorts 的核心功能、設計原則與技術實作。更多技術細節可參閱 [DeepWiki](https://deepwiki.com/wzh4869/AppPorts)。如有改進建議，歡迎在專案 [Issues](https://github.com/wzh4869/AppPorts/issues) 中回報。
 
 ## 概述
 
-AppPorts 是專爲 [macOS](https://www.apple.com.cn/os/macos/) 設計的應用程序遷移與鏈接工具，支持將大型應用程序遷移至外部存儲設備，同時保持系統功能的完整性和一致性。
+AppPorts 是專為 [macOS](https://www.apple.com.cn/os/macos/) 設計的應用程式遷移與連結工具。它可以將大型應用程式遷移到外接儲存裝置，並儘量保持 Finder、Launchpad、應用程式選單和系統更新行為的一致性。
 
 ### AppPorts 哲學
 
 | 原則 | 說明 |
 |------|------|
-| **透明體驗** | 確保用戶體驗與操作系統均感知爲應用仍在內部存儲運行 |
-| **策略穩定** | 優先採用經過驗證的、遷移穩定性更高的方案 |
-| **低系統負擔** | 不依賴守護進程，避免持續佔用系統資源 |
-| **廣泛國際化** | 優先覆蓋更多語言種類，翻譯廣度優先於精度 |
-| **無障礙友好** | 完善的無障礙訪問支持 |
+| **透明體驗** | 儘量讓使用者和作業系統都像使用本機應用程式一樣使用已遷移應用程式 |
+| **策略穩定** | 優先採用經過驗證、遷移穩定性更高的方案 |
+| **低系統負擔** | 不依賴背景常駐行程，避免持續佔用系統資源 |
+| **廣泛國際化** | 優先覆蓋更多語言，持續改進翻譯質量 |
+| **無障礙友好** | 提供較完整的無障礙取用支援 |
 
 ## 核心功能
 
-- **無角標遷移**：一鍵將大型應用遷移至外置硬盤。本地僅保留輕量啓動器殼，Finder 不顯示快捷方式箭頭，Launchpad 與 macOS 應用菜單正常顯示。
-- **自動更新保護**：自動識別支持自動更新的應用（Sparkle、Electron、Chrome 等），提供「鎖定遷移」選項，防止外置硬盤上的應用被自動更新程序刪除或覆蓋。
-- **Stub Portal 版本同步**：外接硬碟上的應用透過 App Store 更新後，本機 Stub Portal 的版本資訊會自動同步，「打開方式」選單始終顯示正確版本。
-- **自訂掃描目錄**：支援額外新增本機應用掃描目錄（如 JetBrains Toolbox、Steam 等），自動儲存並監控變化。
-- **代碼簽名管理**：遷移後如出現「已損壞」提示，可通過右鍵菜單一鍵重簽名。支持備份、恢復原始簽名，數據目錄遷移後可自動執行重簽名。
-- **macOS 15.1+ App Store 支持**：支持將 App Store 應用直接安裝至外置硬盤，並在外置硬盤上原地更新，無需遷回本地。
-- **一鍵還原**：支持將應用遷回本地並自動移除鏈接。遷移中斷時可自動恢復。
-- **數據目錄管理**：支持將應用數據目錄（`~/Library/` 子目錄、`~/.npm` 等）遷移至外部存儲，提供樹形分組視圖、搜索與排序功能。
-- **目錄遷移**：支持將用戶目錄下的任意真實文件夾遷移到外部存儲，適合大型項目、模型、素材庫和工具緩存，並提供接回、還原和路徑重疊校驗。
+- **無角標遷移**：一鍵將大型應用程式遷移至外接儲存裝置。本機僅保留輕量啟動器殼，Finder 不顯示捷徑箭頭，Launchpad 與 macOS 應用程式選單正常顯示。
+- **自動更新保護**：自動辨識支援自更新的應用程式（Sparkle、Electron、Chrome 等），提供「锁定遷移」選項，防止外接儲存裝置上的應用程式被自動更新程式刪除或覆蓋。
+- **版本同步提示**：當本機真實應用程式版本高於外接儲存裝置中的舊副本時，標記為「待遷出」，提示可將本機新版遷出並替換外部舊版本。
+- **Stub Portal 版本同步**：外接硬碟上的應用程式透過 App Store 更新後，本機 Stub Portal 的版本資訊會自動同步，「開啟方式」選單始終顯示正確版本。
+- **自訂掃描目錄**：支援新增額外的本機應用程式掃描目錄（如 JetBrains Toolbox、Steam 等），自動儲存並監控變化。
+- **程式碼簽名管理**：應用程式本體遷移後如出現「已損壞」提示，可透過右鍵選單重簽名，支援備份與恢復原始簽名。沙盒應用程式一律不重簽名。
+- **macOS 15.1+ App Store 支援**：支援將 App Store 應用程式直接安裝至外接儲存裝置，並在外接儲存裝置上原地更新，無需遷回本機。
+- **一鍵還原**：支援將應用程式遷回本機並自動移除連結。遷移中斷時可自動恢復。
+- **資料目錄管理**：支援將應用程式資料目錄（`~/Library/` 子目錄、`~/.npm` 等）遷移至外接儲存裝置，提供樹狀群組檢視、搜尋與排序功能，並透過 AppPorts metadata 嚴格驗證恢復目標。
+- **容器資料掛載遷移**：微信聊天記錄等沙盒容器資料透過在 APFS 外接磁碟上建立獨立卷宗並掛載到原目錄的方式遷移，應用程式簽名不做任何修改。
+- **目錄遷移**：支援將使用者目錄下的任意真實資料夾遷移到外接儲存裝置，適合大型專案、模型、素材庫和工具快取，並提供接回、還原和路徑重疊驗證。
 
-## 術語表
 
-### 遷移策略
+## 遷移策略
 
-#### Deep Contents Wrapper（Contents 目錄遷移）
+### Deep Contents Wrapper（Contents 目錄遷移）
 
-macOS 應用的標準文件結構如下：
+macOS 應用程式的標準檔案結構如下：
 
 ```text
 /Applications/Safari.app/
@@ -50,40 +51,40 @@ macOS 應用的標準文件結構如下：
 └── ...
 ```
 
-Deep Contents Wrapper 策略將應用的全部內容遷移至外置硬盤，在本地創建同名的空 `.app` 目錄，其中僅包含指向外置硬盤 `Contents` 目錄的符號鏈接。由於 macOS 檢測到的是一個完整的 `.app` 包（而非快捷方式），Finder 不會顯示箭頭標記，圖標、Launchpad 與應用菜單均可正常工作。
+Deep Contents Wrapper 策略會將應用程式的全部內容遷移至外接儲存裝置，並在本機建立同名的空 `.app` 目錄，其中僅包含指向外接儲存裝置 `Contents` 目錄的符號連結。由於 macOS 偵測到的是一個完整的 `.app` 套件（而非捷徑），Finder 不會顯示箭頭標記，圖示、Launchpad 與應用程式選單均可正常工作。
 
-::: warning ⚠️ 此策略已在當前版本中棄用
-Deep Contents Wrapper 的主要缺陷在於：自動更新程序運行時會沿符號鏈接直接操作外置硬盤上的文件，可能導致應用本體被破壞。
+::: warning 此策略已在目前版本中棄用
+Deep Contents Wrapper 的主要缺陷在於：自動更新程式執行時可能沿符號連結直接操作外接儲存裝置上的檔案，從而破壞應用程式本體。
 :::
 
-#### Stub Portal（殼門方案）
+### Stub Portal（殼門方案）
 
-Stub Portal 方案在本地創建一個最小化的 `.app` 殼，僅包含以下四項內容：
+Stub Portal 方案在本機建立一個最小化的 `.app` 殼，僅包含以下四項內容：
 
-| 組件 | 說明 |
+| 元件 | 說明 |
 |------|------|
-| `Contents/MacOS/launcher` | Bash 啓動腳本，執行 `open "/Volumes/External/SomeApp.app"` |
-| `Contents/Resources/` | 從外部應用複製的圖標文件 |
-| `Contents/Info.plist` | 基於外部應用的 `Info.plist` 精簡生成，將 `CFBundleExecutable` 設爲 `launcher`，添加 `LSUIElement=true`（不在 Dock 顯示），移除所有更新相關配置鍵 |
-| `Contents/PkgInfo` | 標準的 4 字節標識文件 |
+| `Contents/MacOS/launcher` | 啟動器，執行 `open "/Volumes/External/SomeApp.app"` |
+| `Contents/Resources/` | 從外部應用程式複製的圖示檔案 |
+| `Contents/Info.plist` | 基於外部應用程式的 `Info.plist` 精簡產生，將 `CFBundleExecutable` 設為 `launcher`，新增 `LSUIElement=true`（不在 Dock 顯示），移除所有更新相關設定鍵 |
+| `Contents/PkgInfo` | 標準的 4 位元組識別檔案 |
 
-用戶點擊此殼時，macOS 執行 `launcher` 腳本，通過 `open` 命令啓動外置硬盤上的真實應用。本地不包含任何符號鏈接，自動更新程序無法穿透。
+使用者按一下此殼時，macOS 會執行 `launcher`，並透過 `open` 命令啟動外接儲存裝置上的真實應用程式。本機不包含符號連結，因此自動更新程式無法沿連結穿透到外部應用程式。
 
-##### iOS Stub Portal（iOS 殼門方案）
+### iOS Stub Portal（iOS 殼門方案）
 
-基本原理與標準 Stub Portal 一致，但圖標處理方式不同。iOS 應用的圖標不在 `Info.plist` 中指定，而是存儲在 `Wrapper/` 或 `WrappedBundle/` 目錄下的多個 `AppIcon.png` 文件中。處理流程如下：
+基本原理與標準 Stub Portal 一致，但圖示處理方式不同。iOS 應用程式的圖示不在 `Info.plist` 中指定，而是儲存在 `Wrapper/` 或 `WrappedBundle/` 目錄下的多個 `AppIcon.png` 檔案中。處理流程如下：
 
-1. 查找分辨率最大的 `AppIcon.png` 文件
+1. 查詢解析度最大的 `AppIcon.png` 檔案
 2. 使用 `sips` 縮放至 256×256 像素
-3. 使用 `sips` 轉換爲 `.icns` 格式
-4. 基於 `iTunesMetadata.plist` 生成 `Info.plist`（iOS 應用不包含標準 `Info.plist`）
+3. 使用 `sips` 轉換為 `.icns` 格式
+
```

**File**: `User_docs/docs/zh-Hant/badges.md` (modified, +56/-42)
```diff
@@ -4,81 +4,95 @@ outline: deep
 
 # 狀態徽章說明
 
-AppPorts 通過膠囊形狀的彩色徽章顯示應用和數據目錄的當前狀態。點擊部分徽章可查看詳細說明。
+AppPorts 使用膠囊形狀的彩色徽章展示應用程式和資料目錄的狀態。部分徽章支援按一下，可檢視更詳細的說明或處理建議。
 
-## 應用狀態徽章
+## 應用程式狀態徽章
 
-### 鏈接狀態
+### 連結狀態
 
-| 徽章 | 圖標 | 顏色 | 含義 |
+| 徽章 | 圖示 | 顏色 | 意義 |
 |------|------|------|------|
-| 已鏈接 | `link` | 綠色 | 應用已遷移到外部存儲並創建了本地入口 |
-| 鎖定遷移 | `lock.fill` | 綠色 | 已鏈接且被 `uchg` 鎖定，防止自更新破壞外部應用 |
-| 非鎖定遷移 | `lock.open` | 橙色 | 已鏈接但未鎖定，應用內更新可能刪除外部應用 |
-| 部分鏈接 | `link.badge.plus` | 黃色 | 應用的部分組件已鏈接（如目錄中的部分 `.app`） |
-| 孤立鏈接 | `link.badge.exclamationmark` | 紅色 | 外部存儲上的應用已丟失，但本地入口仍存在 |
-| 未鏈接 | `externaldrive.badge.xmark` | 橙色 | 應用在外部存儲但未鏈接回本地 |
-| 外部 | `externaldrive` | 橙色 | 外部存儲上的應用，本地無入口 |
-| 待遷出 | `arrow.up.right.circle` | 青色 | 本地真實應用版本高於外部存儲中的舊副本，可遷出並替換外部舊版本 |
-| 本地 | `macmini` | 次要色 | 普通本地應用，未遷移，無其他標籤時顯示 |
+| 已連結 | `link` | 綠色 | 應用程式已遷移到外接儲存裝置，並已建立本機入口 |
+| 锁定遷移 | `lock.fill` | 綠色 | 應用程式已連結且被 `uchg` 鎖定，可防止自更新破壞外部副本 |
+| 非锁定遷移 | `lock.open` | 橙色 | 應用程式已連結但未鎖定，應用程式內更新可能刪除或覆蓋外部副本 |
+| 部分連結 | `link.badge.plus` | 黃色 | 應用程式的部分元件已連結（如目錄中的部分 `.app`） |
+| 孤立連結 | `link.badge.exclamationmark` | 紅色 | 外接儲存裝置上的應用程式已遺失，但本機入口仍存在 |
+| 未連結 | `externaldrive.badge.xmark` | 橙色 | 應用程式位於外接儲存裝置，但尚未連結回本機 |
+| 外部 | `externaldrive` | 橙色 | 外接儲存裝置上的應用程式，本機無入口 |
+| 待遷出 | `arrow.up.right.circle` | 青色 | 本機真實應用程式版本高於外接儲存裝置中的同名舊副本，可遷出並替換外部舊版本 |
+| 本地 | `macmini` | 次要色 | 一般本機應用程式，未遷移，無其他標籤時顯示 |
 
 ::: tip 待遷出如何判斷
-AppPorts 會優先按 Bundle ID 匹配本地與外部應用，必要時再按規範化名稱兜底。只有雙方版本可比較且本地版本較高時，才會顯示「待遷出」。
+AppPorts 會優先按 Bundle ID 比對本機應用程式與外部應用程式，必要時再以正規化後的應用程式名稱補充比對。只有雙方版本號可比較且本機版本更高時，才會顯示「待遷出」。如果版本缺失、格式無法比較，或同名應用程式的 Bundle ID 不一致，AppPorts 會保持一般本機狀態，避免誤覆蓋外部應用程式。
 :::
 
 ### 框架標籤
 
-| 徽章 | 圖標 | 顏色 | 含義 | 點擊說明 |
+| 徽章 | 圖示 | 顏色 | 意義 | 按一下說明 |
 |------|------|------|------|----------|
-| Sparkle | `arrow.triangle.2.circlepath` | 青色 | 使用 Sparkle 框架自動更新 | 遷移到外部存儲後，應用內更新可能導致外部應用丟失，建議使用鎖定遷移 |
-| Electron | `atom` | 靛藍 | 基於 Electron 框架，支持自動更新 | 遷移到外部存儲後，應用內更新可能導致外部應用丟失，建議使用鎖定遷移 |
+| Sparkle | `arrow.triangle.2.circlepath` | 青色 | 使用 Sparkle 框架自動更新 | 遷移到外接儲存裝置後，應用程式內更新可能導致外部副本遺失，建議使用鎖定遷移 |
+| Electron | `atom` | 靛藍 | 基於 Electron 框架，可能支援自動更新 | 遷移到外接儲存裝置後，應用程式內更新可能導致外部副本遺失，建議使用鎖定遷移 |
 
 ### 類型標籤
 
-| 徽章 | 圖標 | 顏色 | 含義 |
+| 徽章 | 圖示 | 顏色 | 意義 |
 |------|------|------|------|
-| 運行中 | `play.fill` | 紫色 | 應用當前正在運行 |
-| 系統 | `lock.fill` | 灰色 | macOS 系統應用 |
-| 非原生 | `iphone` | 粉色 | iOS/iPadOS 應用（通過 Apple Silicon 運行） |
-| 商店 | `applelogo` | 藍色 | Mac App Store 應用 |
+| 執行中 | `play.fill` | 紫色 | 應用程式目前正在執行 |
+| 系統 | `lock.fill` | 灰色 | macOS 系統應用程式 |
+| 非原生 | `iphone` | 粉色 | iOS/iPadOS 應用程式（透過 Apple Silicon 執行） |
+| 商店 | `applelogo` | 藍色 | Mac App Store 應用程式 |
 
 ### 特殊標籤
 
-| 徽章 | 圖標 | 顏色 | 含義 |
+| 徽章 | 圖示 | 顏色 | 意義 |
 |------|------|------|------|
-| 已重簽名 | `seal.fill` | 青色 | 應用已被 Ad-hoc 重簽名（遷移後出現「已損壞」時執行） |
+| 已重簽名 | `seal.fill` | 青色 | 應用程式目前是 Ad-hoc 簽名，且 AppPorts 有它的簽名備份 |
+| 簽名已替換 | `exclamationmark.shield.fill` | 紅色 | AppPorts 曾用 Ad-hoc 簽名替換了它的開發者簽名。在 macOS 27 上可能無法開啟，按一下檢視說明，右鍵「檢視修復步驟」開啟修復面板。見 [macOS 27 升級說明](/zh-Hant/macos-27) |
 
-::: tip 💡 商店標籤的特殊說明
-當應用滿足以下條件時，「商店」標籤可點擊並顯示 macOS 15.1+ 原生安裝說明：
-- 應用位於外部存儲的 `/Volumes/{drive}/Applications/` 目錄
-- 由 macOS 原生管理，App Store 可直接在此目錄進行增量更新
+::: tip 「已重簽名」和「簽名已替換」的區別
+兩者都表示應用程式目前是 Ad-hoc 簽名，區別在於**原來是什麼簽名**。「已重簽名」的應用程式原本就沒有開發者簽名（或已無法確認），重簽名只是讓它能照常開啟。「簽名已替換」的應用程式原本有開發者簽名，被換成了 Ad-hoc，沙盒應用程式在 macOS 27 上可能因此打不開，所以用紅色標出並提供修復入口。
 :::
 
-## 數據目錄狀態徽章
+::: tip 商店標籤的特殊說明
+當應用程式滿足以下條件時，「商店」標籤可按一下，並顯示 macOS 15.1+ 原生外接安裝說明：
 
-| 狀態 | 顏色 | 含義 |
+- 應用程式位於外接儲存裝置的 `/Volumes/{drive}/Applications/` 目錄。
+- 應用程式由 macOS 原生管理，App Store 可直接在該目錄中執行增量更新。
+:::
+
+## 資料目錄狀態徽章
+
+| 狀態 | 顏色 | 意義 |
 |------|------|------|
-| 本地 | 次要色 | 目錄在本地存儲，未遷移 |
-| 已鏈接 | 綠色 | 已遷移到外部存儲，本地爲符號鏈接 |
-| 待規範 | 黃色 | AppPorts 託管鏈接，但外部路徑不在規範位置，建議執行「規範化」操作 |
-| 待接回 | 橙色 | 外部存儲上的數據仍在，但本地符號鏈接已丟失，建議執行「重新鏈接」操作 |
-| 現有軟鏈 | 藍色 | 非 AppPorts 創建的用戶自定義符號鏈接，可選擇接管管理權 |
+| 本地 | 次要色 | 目錄在本機，未遷移。容器目錄旁邊帶一個盾牌圖示，表示它用掛載遷移 |
+| 已連結 | 綠色 | 符號連結遷移完成，本機是指向外接磁碟的連結 |
+| 已掛載 | 紫色 | 掛載遷移完成，外接磁碟上的卷宗掛在原目錄上 |
+| 待掛載 | 橙色 | 掛載遷移的卷宗線上但沒掛上，按一下「掛載」 |
+| 外接磁碟未連接 | 紅色 | 找不到掛載遷移的資料卷宗，多半是外接磁碟未連接；連上後 AppPorts 會自動接回 |
+| 待規範 | 黃色 | AppPorts 管理的連結，但外部路徑不在規範位置，可執行「整理」 |
+| 待接回 | 橙色 | 外接磁碟上的資料還在，本機連結丟了，可執行「接回」 |
+| 現有軟連結 | 藍色 | 不是 AppPorts 建的符號連結，可選擇納入管理 |
 
-## 應用狀態組合示例
+## 應用程式狀態組合示例
 
-一個應用可能同時顯示多個徽章：
+一個應用程式可能同時顯示多個徽章：
 
 ```text
-[已鏈接] [Sparkle] [運行中]
+[已链接] [Sparkle] [运行中]
 ```
-含義：應用已遷移到外部存儲，使用 Sparkle 自動更新框架，當前正在運行。
+意義：應用程式已遷移到外接儲存裝置，使用 Sparkle 自動更新框架，並且目前正在執行。
 
 ```text
 [外部] [商店] [非原生]
 ```
-含義：外部存儲上的 iOS 應用（Mac 版），由 App Store 安裝。
+意義：外接儲存裝置上的 iOS 應用程式（Mac 版），由 App Store 安裝。
+
+```text
+[孤立链接]
+```
+意義：外接儲存裝置上的應用程式已遺失或被移除，但本機仍保留入口，需要手動解除連結。
 
 ```text
-[孤立鏈接]
+[待迁出]
 ```
-含義：外部存儲上的應用已丟失或被移除，但本地仍保留入口。需要手動解除鏈接。
+意義：本機存在新版真實應用程式，外接儲存裝置中仍是舊副本。可重新執行遷移，將本機新版遷出並替換外部舊版本。
```

**File**: `User_docs/docs/zh-Hant/changelog.md` (modified, +33/-0)
```diff
@@ -4,6 +4,39 @@ outline: deep
 
 # 更新日誌
 
+## v1.8.2（開發中）
+
+### 重要變更
+
+- **容器資料改用掛載遷移**：`~/Library/Containers/` 與 `~/Library/Group Containers/` 下的目錄不再用符號連結遷移，改為在 APFS 外接磁碟上建立獨立卷宗並掛載到原目錄，應用程式簽名不做任何修改。需要 APFS 外接磁碟，首次開啟應用程式需允許「可移除式卷宗」授權。見[掛載遷移](/zh-Hant/datamigrae/mount-migration)。
+- **沙盒應用程式一律不再重簽名**：右鍵選單、「遷移后重签名」開關和開機自動重簽名指令碼都會跳過沙盒應用程式。舊版本對沙盒應用程式的重簽名可能導致其在 macOS 27 上無法開啟，處理辦法見 [macOS 27 升級說明](/zh-Hant/macos-27)。
+- **修復「恢復原始簽名」**：重簽名前完整備份原應用程式，在工作副本驗證後安全替換；恢復原始簽名和授權無需開發者私鑰。舊記錄可選擇同版本官方原版補救，更新過的應用程式和損壞的備份不會被強行覆蓋。
+- **簽名被替換的應用程式自動辨識與修復引導**：應用程式清單顯示紅色「簽名已替換」徽章，啟動時提醒一次，右鍵「檢視修復步驟」開啟修復面板，按還原資料、遷回本機、重新安裝、掛載遷移的順序引導，全程不刪除資料。使用者重新安裝後簽名恢復，徽章消失；掃描保留恢復材料，透過 AppPorts 完成恢復後清理備份。
+- **經典資料遷移模式**：設定裡新增開關，預設關閉，開啟前需確認風險。開啟後恢復 1.8.1 的符號連結 + 重簽名做法，只為已經依賴舊方案的使用者保留；外接磁碟不是 APFS 時建議維持現狀，而不是開啟它。
+- 「開機自動重簽名」新安裝預設關閉；已經裝過登入代理的使用者保持原設定。
+- 容器目錄的「整理」「接回」「連結詳情」在非經典模式下禁用，避免重建符號連結。
+
+### 改進
+
+- **按一下「掛載遷移」先做唯讀檢查，再按情況引導**：外接儲存裝置是未加密的 APFS 就顯示遷移說明（能釋放多少空間、第一次開啟要按一下允許、平時要連接磁碟）；是 exFAT / NTFS / HFS+、已加密、空間不足或未連接時，說明原因並給出「維持現狀」「選擇其他位置」「檢視準備方法」等選項，不改動任何東西。歡迎頁和設定裡的準備情況也改為同樣的口徑，不再把非 APFS 使用者引向經典模式。
+- **資料卷宗不再出現在 Finder 裡**：建立的卷宗不自動掛到 `/Volumes`，掛載時帶 `nobrowse`；早期版本掛上的卷宗會在下次啟動或連接磁碟時在原位置隱藏，不需要卸載。
+- **加密的 APFS 磁碟暫不支援掛載遷移**：建立的資料卷宗不會繼承原卷宗的密碼，AppPorts 會停下說明，而不是悄悄建一個未加密的卷宗。
+- **遷移和還原前檢查剩餘空間**：外接磁碟或本機空間不夠時，在建立卷宗或複製之前就停下。
+- **還原更安全**：卸載後只刪除空的掛載點，不再遞迴刪除；暫存目錄改為隱藏名稱；最後一步沒完成時，外接卷宗和記錄保持不變，並告訴你本機副本在哪。
+- **只動自己的卷宗**：掛載、卸載、還原前核對掛載點上的卷宗身分；拿不到與登入代理共用的鎖時不開始操作；遷移記錄檔案讀不出來時不會被當成空記錄覆蓋。
+- **登入代理路徑自動校準**：每次啟動 AppPorts 都會檢查登入代理指向的程式路徑，移動或更新 AppPorts 後自動更新；從 DMG 或「下載」資料夾直接執行（App Translocation 暫存路徑）時，阻止新的掛載遷移並提示先放進「應用程式」。
+- 掛載遷移在 macOS 12 等要求管理者權限的系統上會顯示系統密碼對話框重試。
+- 登入後自動重掛容器卷宗；AppPorts 執行時連接磁碟也會自動重掛。登入代理同時監聽 `/Volumes`，在登入項裡的應用程式啟動前就完成掛載；代理和 AppPorts 之間用跨行程鎖互斥，不會在遷移或還原過程中互相搶掛載點。
+- **登入代理不再排在登入項後面**：代理改用 `KeepAlive`（僅失敗時重啟）宣告自己「需要執行」，並去掉 `ProcessType: Background`。登入後一段時間使用者域處於 on-demand-only 模式，舊定義會被 launchd 壓後約 20 秒才啟動，而登入項裡的應用程式 3 秒就起來了。
+- **卷宗被系統搶先自動掛載時會自動重掛**：`diskutil mount -mountPoint` 在卷宗已被系統搶先掛到 `/Volumes` 時不會報錯，而是忽略掛載點參數、照樣輸出 `mounted` 並回傳 0（2026-09-21、09-23 各出過一次：命令成功、掛載點是空的，微信隨後讀到空目錄）。現在每次掛載後都會驗證卷宗是否真的落在目標路徑上，沒落到位就把它從 `/Volumes` 卸下來重掛，最多 3 輪。
+- **掛載鏈路省掉開機時最貴的一次 `diskutil` 查詢**：開機/連接磁碟時系統會先把卷宗掛到 `/Volumes/<卷名>`，代理現在用 `statfs` + 卷宗根目錄標記直接認出來（微秒級），不再呼叫那次實測要 9 秒的 `diskutil info`。真機實測：一輪從「查掛載點」到「掛好」只剩 `unmount` + `mount` 兩條命令，約 1 秒。
+- **外接磁碟遲遲沒出現時，登入代理不再只試一遍**：代理在行程內監聽 `/Volumes`，等下一次真實變化再重試（實測卷宗出現到掛載完成約 1 秒），完全沒有事件時每 20 秒補做一次檢查，總等待時間 180 秒；等卷宗期間不佔用與 AppPorts 之間的跨行程鎖。
+- **登入代理的空跑不再刷日誌**：`WatchPaths` 在 launchd 裡是按 FSEvents 路徑字首比對的，外接磁碟上任何一次寫入都會叫醒代理，而絕大多數時候無事可做。一輪空跑現在只寫 3 行，逐條詳單隻在真的掛載、卷宗離線或失敗時才寫。
+- **掛載路徑上的 diskutil 呼叫減半**：每卷宗從 4 次查詢減到 2 次 —— 「卷宗在不線上」和「現在掛在哪」合併成同一次 `diskutil info`。開機時系統繁忙，一次查詢要一秒上下，這一步直接省掉幾秒。
+- **卷宗不再被 Spotlight 索引**：建立卷宗後在卷宗根目錄寫入 `.metadata_never_index`，並清掉系統已經建好的 `.Spotlight-V100`（兩個微信卷宗實測共 110 MB）。在這之前遷移過的卷宗會在下次掛載時自動補上標記；標記跟著卷宗走，還原時不會被帶回本機目錄。
+- 修復 Bundle ID 末段為 `mac`、`desktop` 等通用詞時誤比對其他應用程式容器的問題（如 Termius 列出 QQ 音樂的容器）。
+- 修復容器路徑以 `/private/var` 形式出現時子目錄未被掃描的問題。
+
 ## v1.8.0
 
 ### 新功能
```

**File**: `User_docs/docs/zh-Hant/core.md` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 # 核心功能
-此頁面介紹軟件的基本核心功能，即爲應用 App 包遷移，如需對應用內的數據進行遷移，請參閱[數據遷移](datamigrae/baseinfo.md)。
+此頁面介紹軟件的基本核心功能，即爲應用 App 包遷移，如需對應用內的數據進行遷移，請參閱[數據遷移](/zh-Hant/datamigrae/baseinfo)。
 ## 遷移應用至外部存儲 
   
 1. 選擇單個應用或鼠標左鍵長按拖動多個應用（或 command+鼠標左鍵單擊選擇應用）     
```

**File**: `User_docs/docs/zh-Hant/datamigrae/baseinfo.md` (modified, +66/-65)
```diff
@@ -2,96 +2,97 @@
 outline: deep
 ---
 
-# 數據遷移基礎實現
+# 資料遷移基礎實作
+
 ![](https://pic.cdn.shimoko.com/appports/%E6%88%AA%E5%B1%8F2026-05-08%2008.38.05.png)
-AppPorts 的數據遷移功能負責將應用關聯的數據目錄（如 `~/Library/Application Support`、`~/Library/Caches` 等）遷移至外部存儲，以釋放本地磁盤空間。
 
-## 核心策略：符號鏈接
+AppPorts 的資料遷移把應用程式關聯的資料目錄搬到外接磁碟，釋放本機空間。按目錄所在位置用兩種策略：
+
+| 目錄 | 策略 | 原因 |
+|------|------|------|
+| `~/Library/Containers/`、`~/Library/Group Containers/` | 掛載遷移 | 沙盒檢查解析後的真實路徑，符號連結指向容器外會被拒絕 |
+| 其他 `~/Library/` 子目錄、工具目錄、自訂資料夾 | 符號連結 | 不受沙盒限制，最簡單 |
+
+本頁講符號連結策略。掛載遷移見[掛載遷移](/zh-Hant/datamigrae/mount-migration)。
 
-數據目錄遷移採用**整體符號鏈接**策略，流程如下：
+## 符號連結策略
 
-1. 將原始本地目錄完整複製到外部存儲
-2. 在外部目錄寫入托管鏈接元數據（`.appports-link-metadata.plist`）
-3. 將本地原始目錄改名為同卷隱藏安全備份
-4. 在原始路徑創建符號鏈接，指向外部存儲中的副本
-5. 符號鏈接創建成功後，清理本地安全備份
+1. 把本機目錄完整複製到外接磁碟。
+2. 在外部目錄寫入管理標記 `.appports-link-metadata.plist`。
+3. 把本機原目錄改名為同一卷宗上的隱藏安全備份。
+4. 在原路徑建立指向外部副本的符號連結。
+5. 連結建立成功後清理安全備份。
 
 ```
 ~/Library/Application Support/SomeApp
-    → /Volumes/External/AppPortsData/SomeApp  （符號鏈接）
+    → /Volumes/External/AppPortsData/SomeApp  （符号链接）
 ```
 
-## 遷移流程
-
 ```mermaid
 flowchart TD
-    A[選擇數據目錄] --> B{權限與保護檢查}
+    A[選擇資料目錄] --> B{權限與保護檢查}
     B -->|失敗| Z[終止]
     B -->|通過| C{目標路徑衝突檢測}
-    C -->|存在託管元數據| D[自動恢復模式]
-    C -->|無衝突| E[複製到外部存儲]
+    C -->|管理標記完全一致| D[自動恢復模式]
+    C -->|真實目錄衝突| Y[終止並提示衝突]
+    C -->|無衝突| E[複製到外接磁碟]
     D --> E
-    E --> F[寫入托管鏈接元數據]
-    F --> G[改名為本地安全備份]
+    E --> F[寫入管理標記]
+    F --> G[改名為本機安全備份]
     G -->|失敗| H[保留外部副本並停止]
-    G -->|成功| I[創建符號鏈接]
-    I -->|失敗| J[恢復本地安全備份並保留外部副本]
-    I -->|成功| K[清理本地安全備份]
+    G -->|成功| I[建立符號連結]
+    I -->|失敗| J[恢復本機安全備份並保留外部副本]
+    I -->|成功| K[清理本機安全備份]
     K -->|成功| L[遷移完成]
     K -->|失敗| M[遷移完成但保留安全備份]
 ```
 
-## 託管鏈接元數據
+## 管理標記
 
-AppPorts 在外部目錄中寫入 `.appports-link-metadata.plist` 文件，用於標識該目錄由 AppPorts 管理。元數據包含：
+外部目錄裡的 `.appports-link-metadata.plist` 標示該目錄由 AppPorts 管理：
 
-| 字段 | 說明 |
+| 欄位 | 說明 |
 |------|------|
-| `schemaVersion` | 元數據版本號（當前爲 1） |
-| `managedBy` | 管理者標識（`com.shimoko.AppPorts`） |
-| `sourcePath` | 原始本地路徑 |
-| `destinationPath` | 外部存儲目標路徑 |
-| `dataDirType` | 數據目錄類型 |
-
-該元數據在掃描階段用於區分 AppPorts 創建的託管鏈接與用戶手動創建的符號鏈接，並在遷移中斷時支持自動恢復。
-
-自動恢復採用嚴格匹配策略。外部目標目錄已存在時，AppPorts 只有在 `schemaVersion`、`managedBy`、`sourcePath`、`destinationPath` 和 `dataDirType` 全部與當前任務一致時，才會認為這是可接續的 AppPorts 託管目錄。沒有 metadata、metadata 不完整或路徑/類型不一致的真實目錄都會被視為衝突，AppPorts 不會僅憑目錄大小相近就接管或覆蓋。
-
-接回與規範化都只面向目錄。AppPorts 會拒絕把外部普通文件當作數據目錄重新鏈接或移動，避免誤把文件替換為本地符號鏈接。
-
-## 支持的數據目錄類型
-
-| 類型 | 路徑示例 |
-|------|----------|
-| `applicationSupport` | `~/Library/Application Support/` |
-| `preferences` | `~/Library/Preferences/` |
-| `containers` | `~/Library/Containers/` |
-| `groupContainers` | `~/Library/Group Containers/` |
-| `caches` | `~/Library/Caches/` |
-| `webKit` | `~/Library/WebKit/` |
-| `httpStorages` | `~/Library/HTTPStorages/` |
-| `applicationScripts` | `~/Library/Application Scripts/` |
-| `logs` | `~/Library/Logs/` |
-| `savedState` | `~/Library/Saved Application State/` |
-| `dotFolder` | `~/.npm`、`~/.vscode` 等 |
-| `custom` | 用戶自定義路徑 |
+| `schemaVersion` | 版本號，目前為 1 |
+| `managedBy` | `com.shimoko.AppPorts` |
+| `sourcePath` | 原始本機路徑 |
+| `destinationPath` | 外部目標路徑 |
+| `dataDirType` | 資料目錄類型 |
+
+掃描時用它區分 AppPorts 建的連結和使用者自己建的連結；遷移中斷時用它自動恢復。比對是嚴格的：五個欄位全部一致才算可接續的管理目錄，否則視為衝突，不會因為目錄大小相近就接管或覆蓋。
+
+接回和整理只對目錄有效，不會把外部一般檔案當作目錄重新連結。
+
+## 支援的資料目錄類型
+
+| 類型 | 路徑 | 策略 |
+|------|------|------|
+| `applicationSupport` | `~/Library/Application Support/` | 符號連結 |
+| `preferences` | `~/Library/Preferences/` | 符號連結 |
+| `containers` | `~/Library/Containers/` | 掛載 |
+| `groupContainers` | `~/Library/Group Containers/` | 掛載 |
+| `caches` | `~/Library/Caches/` | 符號連結 |
+| `webKit` | `~/Library/WebKit/` | 符號連結 |
+| `httpStorages` | `~/Library/HTTPStorages/` | 符號連結 |
+| `applicationScripts` | `~/Library/Application Scripts/` | 符號連結 |
+| `logs` | `~/Library/Logs/` | 符號連結 |
+| `savedState` | `~/Library/Saved Application State/` | 符號連結 |
+| `dotFolder` | `~/.npm`、`~/.vscode` 等 | 符號連結 |
+| `custom` | 使用者自訂路徑 | 符號連結 |
 
 ## 還原流程
 
-1. 驗證本地路徑爲符號鏈接且指向有效外部目錄
-2. 移除本地符號鏈接
-3. 將外部目錄複製回本地
-4. 刪除外部目錄（盡力而爲）
-
-若複製失敗，自動重建符號鏈接以保證一致性。
-
-## 錯誤處理與回滾
+1. 確認本機路徑是符號連結，且指向有效的外部目錄。
+2. 把外部目錄複製到本機暫存目錄。
+3. 刪除符號連結，把暫存目錄改名為原路徑。
+4. 刪除外部目錄（盡力而為）。
 
-遷移過程中的每個關鍵步驟均包含回滾機制：
+複製失敗時不變更符號連結；改名失敗時重建符號連結並保留暫存目錄供手動恢復。
 
-- **複製失敗**：不執行後續操作，清理已複製的外部文件
-- **移動本地安全備份失敗**：停止遷移並保留外部副本，不刪除本地源目錄
-- **創建符號鏈接失敗**：優先將本地安全備份恢復到原路徑，同時保留外部副本，避免兩端數據同時丟失
-- **清理安全備份失敗**：遷移仍視為完成，本地會保留 `.appports-migration-backup-*` 備份，用戶確認數據無誤後可手動清理
+## 錯誤處理與回復
 
-這種設計確保在任何階段發生故障時，數據不會丟失且系統狀態保持一致。
+- **複製失敗**：清理已複製的外部檔案，不做後續操作。
+- **目標衝突**：外部已有真實目錄且標記不比對，停止並保留雙方資料。
+- **改名安全備份失敗**：停止並保留外部副本，本機源目錄不變更。
+- **建立符號連結失敗**：把安全備份恢復回原路徑，同時保留外部副本。
+- **清理安全備份失敗**：遷移算完成，本機保留 `.appports-migration-backup-*`，確認無誤後可手動刪除。
```

**File**: `User_docs/docs/zh-Hant/datamigrae/container-identity.md` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+---
+outline: deep
+---
+
+# 容器資料、沙盒與簽名身分
+
+::: tip 一句話結論
+`~/Library/Containers/` 和 `~/Library/Group Containers/` 裡的資料屬於**沙盒應用程式**。這類資料用"捷徑"（符號連結）搬到外接磁碟是讀不到的；AppPorts 以前靠「重簽名此應用」繞過這一點，代價是應用程式在 macOS 27 上可能無法開啟，登入狀態也可能遺失。
+
+從 1.8.2 起，容器資料改用[掛載遷移](/zh-Hant/datamigrae/mount-migration)，簽名一個位元組都不變更。已經被重簽名過的應用程式需要重新安裝，步驟見 [macOS 27 升級說明](/zh-Hant/macos-27)。
+:::
+
+這篇文件解釋來龍去脈。如果你的應用程式已經打不開了，直接去 [macOS 27 升級說明](/zh-Hant/macos-27) 看修復步驟。
+
+## 容器是什麼
+
+macOS 上大部分應用程式執行在"沙盒"裡：系統給每個應用程式分配一個專屬資料夾，就是 `~/Library/Containers/<Bundle ID>/`，應用程式只能在裡面讀寫。App Store 上架的應用程式必須這樣，微信、QQ 音樂這類官網下載的應用程式也大多這樣。多個應用程式共享的資料放在 `~/Library/Group Containers/`。
+
+判斷一個應用程式是不是沙盒應用程式，看它的授權資訊裡有沒有 `com.apple.security.app-sandbox`：
+
+```bash
+codesign -d --entitlements - --xml /Applications/WeChat.app 2>/dev/null | grep -c app-sandbox
+# 输出 1 就是沙盒应用
+```
+
+有一點容易被忽略：**主程式不沙盒，不代表它的容器可以隨便動。** Chrome、Edge 的主程式不在沙盒裡，但它們的小工具和延伸功能各有自己的容器；那些容器的主人是沙盒行程。所以 AppPorts 對 `Containers` 下的所有目錄一視同仁，不看主程式。
+
+## 搬走容器資料的三條路
+
+| 做法 | 結果 | 原因 |
+|------|------|------|
+| 複製到外接磁碟，原地留符號連結 | 應用程式能開啟，但讀不到資料；微信會報「儲存位置不能使用」 | 沙盒檢查的是連結**指向哪裡**，指向容器外就拒絕。指向外接磁碟和指向桌面結果一樣 |
+| 符號連結 + Ad-hoc 重簽名 | macOS 26 及以下能用；升到 27 後可能按兩下秒退（微信已確認，QQ 音樂仍能開） | 重簽名把沙盒身分拆了，符號連結才"生效"。但它同時清除了應用程式和容器之間的歸屬關係，27 起系統要核對這層關係 |
+| 把外接磁碟上的一個 APFS 卷宗掛載到原目錄 | 正常，簽名不變更 | 路徑沒有離開容器，沙盒放行；資料在外接磁碟上會彈一次系統授權對話框，按一下允許即可 |
+
+前兩條已經在 macOS 27 上實測確認，第三條也是。原始日誌見[實驗紀錄：符號連結](/research/sandbox-symlink)和[實驗紀錄：掛載點](/research/sandbox-mountpoint)。
+
+## 重簽名到底動了什麼
+
+Ad-hoc 重簽名（`codesign --force --deep --sign -`）會從應用程式裡清除：
+
+| 遺失的內容 | 後果 |
+|------------|------|
+| `com.apple.security.app-sandbox` | 應用程式不再以沙盒身分執行 |
+| `com.apple.security.application-groups` | 讀不到 `Group Containers` 裡的共享資料 |
+| `keychain-access-groups` | 讀不到鑰匙圈裡的登入狀態、資料庫金鑰 |
+| Team ID | 系統核對"這個容器是不是你的"時對不上 |
+
+應用程式不會當場出問題。它以一般行程身分去讀自己的容器，macOS 26 及以下放行；27 上如果系統裡已存有它舊簽名的授權記錄，就會因為"程式碼要求不比對"被拒絕：
+
+```
+sandboxd rejected approval request from WeChat for kTCCServiceSystemPolicyAppData
+  (/Users/<user>/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files): denied
+runningboardd: termination reported by launchd (0, 0, 65280)
+```
+
+同一臺機器、同一個重簽名過的微信：
+
+| 系統 | 表現 |
+|------|------|
+| macOS 26.6.2 | 連續用了兩天半，正常 |
+| macOS 27.0 | 每次啟動約 0.4 秒後退出 |
+
+::: warning "以前一直沒事"不是安全的證據
+重簽名後能正常用幾週甚至幾個月，問題只在下一次大版本升級時爆發，升級前後沒有任何提示。而且原始開發者的憑證不在你的電腦上，清除的授權沒法重新簽回去，只能重新安裝。
+:::
+
+## 為什麼從終端能開啟
+
+排查時容易被這一點誤導。系統按"責任行程"記賬：從 Finder 或 Dock 按兩下時，應用程式自己是責任行程，用自己的身分申請權限，被拒；從終端或某個已有完整磁碟取用權限的程式裡啟動時，責任行程算在宿主頭上，應用程式相當於借用了宿主的權限。
+
+所以"終端裡能起來"不算修好。判斷標準只有 Finder / Dock 按兩下。
+
+## 自查
+
+把 `/Applications/WeChat.app` 換成你要查的應用程式：
+
+```bash
+# 1. 签名身份
+codesign -dv --verbose=4 /Applications/WeChat.app 2>&1 | grep -E "Authority|TeamIdentifier|Signature"
+
+# 2. 授权（正常输出一段 XML；只有 Executable= 一行说明已被抹掉）
+codesign -d --entitlements - /Applications/WeChat.app
+
+# 3. 容器里有没有指向外置盘的符号链接
+find ~/Library/Containers/<Bundle ID> -maxdepth 6 -type l -exec readlink {} \; 2>/dev/null
+
+# 4. 复现一次，看系统有没有拒绝
+open -a /Applications/WeChat.app; sleep 3
+log show --last 1m --style compact 2>/dev/null | grep -iE "rejected approval request|deny\(1\) file-read-data"
+```
+
+| 觀察結果 | 意義 |
+|----------|------|
+| `Signature=adhoc` 且 `TeamIdentifier=not set` | 已被重簽名；打不開時需要重新安裝應用程式 |
+| 第 3 步有輸出且指向 `/Volumes/...` | 容器裡還有舊的符號連結，需要先還原 |
+| 日誌有 `kTCCServiceSystemPolicyAppData ... denied` | 正在被拒絕取用自己的容器（重簽名導致） |
+| 日誌有 `deny(1) file-read-data /Volumes/...` | 沙盒拒絕跟隨符號連結（資料在外接磁碟導致） |
+
+兩種日誌可能同時出現，對應兩個獨立的問題，要分別處理。
+
+## 修復
+
+順序不能亂，否則重新安裝完的應用程式看到的仍是符號連結，會誤以為重新安裝沒用：
+
+1. **還原容器資料**：在 AppPorts「應用程式資料」頁把該應用程式所有「已連結」的容器目錄逐個「還原」回本機。
+2. **重新安裝應用程式**：從官方管道覆蓋安裝，恢復原始簽名和沙盒。容器資料不會被重新安裝刪除。
+3. **需要的話再掛載遷移**：重新安裝後容器目錄會顯示「掛載遷移」，想繼續放到外接磁碟就再遷一次。
+
+新版 AppPorts 的「恢復原始簽名」可以從完整備份恢復原應用程式，無需開發者私鑰。舊版只有身分名稱的記錄需要選擇同版本官方原版，或從官方管道重新安裝；詳見[簽名備份與恢復](/zh-Hant/datamigrae/resign#簽名備份與恢復)。恢復簽名前仍需先還原經典模式遷移的容器目錄。
+
+詳細步驟和已遷移到外接磁碟的應用程式怎麼處理，見 [macOS 27 升級說明](/zh-Hant/macos-27#修復)。
+
+## 真實案例
+
+2026 年 9 月，一臺真實機器上的完整過程：
+
+| 時間 | 事件 |
+|------|------|
+| 9/15 04:46 | AppPorts 把微信聊天資料目錄遷移到外接磁碟，原地留符號連結 |
+| 9/15 04:47 | AppPorts 對微信執行 Ad-hoc 重簽名 |
+| 9/16 至 9/18 | macOS 26.6.2 下微信正常使用兩天半 |
+| 9/18 04:46 | 升級到 macOS 27.0 |
+| 9/18 起 | 每次啟動約 0.4 秒後退出 |
+| 9/18 05:04 | 使用者還原資料並再次重簽名，問題依舊 |
+| 9/18 | 還原資料 + 從官網重新安裝微信，恢復正常，聊天記錄完整 |
+
+資料從頭到尾沒有損壞。真正的埋伏是重簽名，它在升級前沒有任何症狀。
+
+## 相關文件
+
+- [macOS 27 升級說明](/zh-Hant/macos-27)：升級前檢查清單和修復步驟
+- [掛載遷移](/zh-Hant/datamigrae/mount-migration)：新方案怎麼用
+- [為什麼外接磁碟必須是 APFS](/zh-Hant/why-apfs)
+- [重簽名與當機防護](/zh-Hant/datamigrae/resign)：重簽名功能現在的邊界
```

**File**: `User_docs/docs/zh-Hant/datamigrae/mount-migration.md` (added, +176/-0)
```diff
@@ -0,0 +1,176 @@
+---
+outline: deep
+---
+
+# 掛載遷移：容器資料怎麼放到外接磁碟
+
+::: tip 一句話結論
+`~/Library/Containers/` 和 `~/Library/Group Containers/` 裡的資料（微信聊天記錄、QQ 音樂快取、App Store 應用程式的資料）不能用符號連結搬走。AppPorts 1.8.2 起改為：在外接磁碟上建立一個專用的 APFS 資料卷宗，把資料複製進去，再把這個卷宗**掛載到原來的目錄上**。應用程式看到的路徑沒變，簽名沒動。
+
+前提三條：外接磁碟是未加密的 APFS；第一次開啟應用程式時，在授權對話框中按一下「允許」；開啟應用程式前先連接外接磁碟。
+:::
+
+## 什麼時候會用到
+
+在「資料目錄」→「應用程式資料」裡選取一個應用程式，`Containers` 和 `Group Containers` 群組下的目錄，按鈕是「掛載遷移」而不是「遷移」。其他群組（`Application Support`、快取等）和工具目錄、自訂目錄照舊用符號連結遷移，不受影響。
+
+為什麼容器目錄特殊、為什麼不看主程式是不是沙盒，見[容器資料、沙盒與簽名身分](/zh-Hant/datamigrae/container-identity)。
+
+## 按一下「掛載遷移」之後 {#preflight}
+
+AppPorts 先唯讀檢查一次外接儲存裝置，不改動任何東西，再按結果給出下一步：
+
+| 檢查結果 | 你會看到 | 可以怎麼做 |
+|---|---|---|
+| 未加密的 APFS，空間足夠 | 遷移說明：本機能釋放多少空間、第一次開啟要按一下允許、平時要連接磁碟 | 按一下「遷移資料」開始 |
+| exFAT、NTFS、HFS+ 等 | 「這個外接儲存裝置是 exFAT 格式」 | 維持現狀；選擇其他位置；檢視準備方法 |
+| 加密的 APFS | 「這個外接儲存裝置已加密」 | 維持現狀；改選未加密的 APFS 位置 |
+| 空間不足 | 需要多少、還剩多少 | 清理空間後重新檢查，或選擇其他位置 |
+| 沒選外接儲存裝置 / 未連接 | 提示選擇或連接外接儲存裝置 | 選擇外接儲存裝置、重新檢查 |
+
+**不能遷移時什麼都不用改。** 應用程式本體、`Application Support`、快取、工具目錄照常可以遷移到這個磁碟，只有容器資料留在本機，應用程式照常使用。以後想遷移時，按[準備 APFS 外接磁碟](/zh-Hant/why-apfs#prepare-apfs)的方法準備好再來。
+
+::: info 為什麼加密的 APFS 磁碟暫不支援
+掛載遷移建立的資料卷宗不會繼承原卷宗的密碼。照常遷移的話，原本在本機受 FileVault 保護的聊天記錄會落在一個沒有密碼的卷宗上。自動解鎖和密碼管理完成之前，AppPorts 不做這種悄悄降級。詳見[加密的外接磁碟](/zh-Hant/why-apfs#encrypted-drives)。
+:::
+
+## 遷移前
+
+- **請先把 AppPorts 放進「應用程式」資料夾，再從那裡開啟。** 登入代理需要一個持久有效的程式路徑。從下載目錄或 DMG 直接執行時，macOS 可能使用暫存的 App Translocation 路徑；偵測到這種路徑時，AppPorts 會阻止新的掛載遷移並提示安裝。移動或更新 AppPorts 後請開啟一次，讓它校準代理路徑；路徑不變時不會重新載入代理。
+- **完全退出要遷移的應用程式。** AppPorts 會檢查，正在執行時不允許遷移。
+- **AppPorts 需要完整磁碟取用權限。** 把卷宗掛到容器路徑這個動作本身受系統管控，沒有權限會失敗。
+- **想想備份。** 和所有資料遷移一樣，重要資料建議先自行備份一份。遷移後這部分資料在外接磁碟上，而 Time Machine 通常不備份外接磁碟，需要時請在「系統設定 › 一般 › Time Machine」的選項裡確認這個磁碟在備份範圍內。
+
+## 遷移過程中發生了什麼
+
+1. 在外接磁碟的 APFS 容器裡建立一個卷宗，建好後不自動掛到 `/Volumes`。卷宗名稱形如 `AppPorts-<Bundle ID>-<目录名>-xxxxxx`，和磁碟上其他卷宗共用剩餘空間，不用指定大小。
+2. 把新卷宗暫存掛到 `~/Library/Application Support/AppPorts/mounts/` 下，用 AppPorts 的複製器把目錄內容複製進去，在卷宗根目錄寫一個 `.appports-mount-metadata.plist` 標記，然後卸載。
+3. 把原目錄改名為同一卷宗上的安全備份，在原路徑建立一個空目錄，把卷宗掛上去，驗證掛上的確實是這個卷宗。
+4. 寫入掛載記錄 `~/Library/Application Support/AppPorts/container-mounts.plist`，安裝登入時自動重掛的代理，最後刪除安全備份。
+
+外接磁碟空間不夠時，在建立卷宗之前就停下。遷移尚未完成就失敗時，AppPorts 會嘗試回復原狀；若無法安全完成，會保留副本並說明保留路徑。
+
+如果遷移已經完成，只是最後清理本機安全備份失敗，掛載的資料仍可正常使用。AppPorts 會明確顯示尚未清理的備份路徑，不必重新遷移。
+
+遷移完成後，`mount` 命令能看到卷宗直接掛在容器路徑上：
+
+```
+/dev/disk7s5 on /Users/<user>/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files (apfs, local, nodev, nosuid, journaled, noowners, nobrowse)
+```
+
+## 遷移後第一次開啟應用程式
+
+系統會詢問是否允許應用程式取用可移除式卷宗上的檔案，請按一下**「允許」**。這是 macOS 對資料落在外接磁碟上的正常檢查，只彈一次。
+
+按了拒絕，應用程式會當作沒有資料，顯示空白。補救：系統設定 → 隱私權與安全性 → 檔案與資料夾（或「可移除式卷宗」），找到該應用程式開啟開關，或者在終端執行 `tccutil reset SystemPolicyRemovableVolumes <Bundle ID>` 讓它下次重新詢問。
+
+`/System/Applications` 下的系統應用程式不會顯示授權對話框，直接靜默拒絕。AppPorts 本來就不遷移它們。
+
+## 日常使用
+
+**開啟應用程式前先連接外接磁碟。** 磁碟未連接時，掛載點只是一個被鎖住的空目錄（權限 000），應用程式會看到空資料，不會報錯，也不會把新資料寫到本機形成兩份。連上外接磁碟後 AppPorts 會自動把卷宗接回來，資料就回來了。
+
+**Finder 裡平時看不到這些資料卷宗。** AppPorts 掛載時帶 `nobrowse` 選項，資料卷宗不出現在 Finder 側邊欄和桌面。外接磁碟剛接入的一兩秒內，macOS 可能先把卷宗自動掛到 `/Volumes` 並短暫顯示圖示，AppPorts 接回後就會消失。用早期版本遷移、目前仍顯示在 Finder 裡的卷宗，AppPorts 下次啟動或外接磁碟下次接入時會在原位置隱藏，不需要卸載重掛。「磁碟工具程式」裡仍能看到名為 `AppPorts-…` 的卷宗，**不要在那裡清除或刪除它們**，那就是遷移過去的資料。
+
+**拔除磁碟前先退出應用程式，再在 AppPorts 裡按一下「卸載」或在 Finder 裡退出外接磁碟。** 直接拔除磁碟的話，最後幾秒鐘的寫入可能遺失，資料庫檔案可能需要修復；我們做過拔除磁碟測試，APFS 卷宗這種情況下遺失的只是最後幾個交易，見[實驗紀錄：拔除磁碟測試](/research/unplug-test)。
+
+**什麼時候自動接回：**
+
+- AppPorts 執行時：啟動時以及每次有卷宗接入系統時，自動把線上但沒掛載的記錄掛回去。
+- 沒開 AppPorts 時：遷移成功後 AppPorts 會安裝一個登入代理，登入時以及每次外接磁碟接入時靜默掛回，然後退出。最後一條記錄還原後，代理會自動移除。
+- 開機後立刻開啟應用程式，仍可能讀到十幾秒的空目錄（系統把登入代理排在登入項之後啟動），退出應用程式再開啟即可。確保資料安全的關鍵是掛載點一直保持為空：應用程式就算先起來了，也唯讀到空目錄，不會把新資料寫到本機形成分叉，等卷宗掛回來自己就恢復了（微信實測三次都能恢復）。
+
+::: warning macOS 12 等舊系統需要輸入管理者密碼
+macOS 27 允許一般使用者把卷宗掛到自己目錄下的路徑；macOS 12 實測不允許。AppPorts 遇到這個錯誤會顯示系統的管理者密碼對話框重試，一次遷移通常只問一次。登入代理沒有介面，無法顯示密碼對話框，所以在這類系統上登入後不能自動重掛，需要開啟 AppPorts（它會提示輸密碼）或在「應用程式資料」頁手動按一下「掛載」。13 到 26 之間從哪一版開始放開，還沒有逐一驗證。
+:::
+
+## 狀態與操作 {#statuses}
+
+| 狀態 | 意義 | 可用操作 |
+|------|------|----------|
+| 已掛載 | 卷宗掛在原目錄上，應用程式正常讀寫 | 卸載、還原 |
+| 待掛載 | 卷宗線上但沒掛載（剛連接磁碟、或手動卸載過） | 掛載、還原 |
+| 外接磁碟未連接 | 找不到這個資料卷宗，多半是外接磁碟未連接 | 連上外接磁碟，AppPorts 會自動接回；已經連接仍顯示時，見下方[排查](#troubleshooting) |
+
+**還原**會把卷宗上的資料複製回本機，然後刪除卷宗和記錄，外接磁碟要保持連接：
+
+- 開始前檢查本機剩餘空間，不夠時直接停下，卷宗和記錄原樣保留。
+- 複製完成後，AppPorts 先把掛載記錄轉為待清理資訊，防止自動重掛，再切換回本機目錄。它只刪除卸載後留下的空掛載點，不會遞迴刪除任何目錄。
+- 如果切換回本機目錄尚未完成，暫存的本機副本和外接卷宗都會保留。本機副本仍在同一目錄下名為 `.appports-restore-staging-…` 的隱藏資料夾裡；請依 AppPorts 顯示的保留路徑與提示處理。
+- 如果本機目錄已經還原，只是刪除外接卷宗或更新清理記錄失敗，AppPorts 會明確提示還原完成但清理尚未完成。可在資料目錄頁重試清理，不要重複遷移或還原。
+
+無法確認副本是否仍在時，可選擇「僅移除清理記錄」；這不會刪除本機備份或外接卷宗，也不會重新掛載，仍存在的副本需自行清理。
+
+如果掛載點目錄裡出現了本機檔案（比如應用程式在磁碟未連接時想辦法寫了東西），AppPorts 會拒絕在上面掛載，免得蓋住這份資料。把檔案移走再掛載。
+
+## 移除或移動 AppPorts 之前
+
+掛載遷移靠 AppPorts 的登入代理在每次登入後把卷宗接回來。**刪除 AppPorts 之前，先在「應用程式資料」裡把掛載遷移的目錄「還原」回本機。** 不還原就刪除 AppPorts 的話，資料仍完好地留在外接卷宗上，但登入後沒人把它接回來，應用程式會看到空目錄；重新安裝 AppPorts 並開啟一次即可恢復。
+
+只是更新或移動 AppPorts 的話，開啟一次新版 AppPorts即可，它會自動把代理指向新的程式位置。
+
+## 排查 {#troubleshooting}
+
+| 現象 | 處理 |
+|---|---|
+| 狀態是「外接磁碟
```

**File**: `User_docs/docs/zh-Hant/datamigrae/operation.md` (modified, +70/-104)
```diff
@@ -2,145 +2,111 @@
 outline: deep
 ---
 
-# 數據遷移操作指南
+# 資料遷移操作指南
 
-本頁面介紹數據目錄遷移的實際操作流程。如需瞭解技術實現細節，請參閱[基礎實現](/datamigrae/baseinfo)。
+本頁介紹資料目錄遷移的實際操作。技術實作見[基礎實作](/zh-Hant/datamigrae/baseinfo)。
 
-## 查找應用關聯的數據目錄
+## 尋找應用程式關聯的資料目錄
 
-1. 在 AppPorts 主窗口切換到「數據目錄」標籤
-2. 左側面板顯示所有已安裝的應用列表
-3. 點擊某個應用，右側面板會顯示該應用在 `~/Library/` 下關聯的數據目錄
+1. 在 AppPorts 主視窗切換到「資料目錄」標籤。
+2. 頂部在「工具目錄 / 應用程式資料」之間切換。
+3. 檢視應用程式資料時，在左側選一個應用程式，右側列出它在 `~/Library/` 下關聯的目錄。
 
-AppPorts 會自動掃描以下目錄，按應用 Bundle ID 或名稱匹配：
+AppPorts 按應用程式的 Bundle ID 或名稱比對下面這些位置：
 
-| 掃描路徑 | 匹配方式 |
-|----------|----------|
-| `~/Library/Application Support/` | Bundle ID 或應用名稱 |
-| `~/Library/Preferences/` | Bundle ID 或應用名稱 |
-| `~/Library/Containers/` | Bundle ID |
-| `~/Library/Group Containers/` | Bundle ID |
-| `~/Library/Caches/` | Bundle ID 或應用名稱 |
-| `~/Library/WebKit/` | Bundle ID |
-| `~/Library/HTTPStorages/` | Bundle ID |
-| `~/Library/Application Scripts/` | Bundle ID |
-| `~/Library/Logs/` | 應用名稱 |
-| `~/Library/Saved Application State/` | 應用名稱 |
+| 掃描路徑 | 比對方式 | 遷移方式 |
+|----------|----------|----------|
+| `~/Library/Application Support/` | Bundle ID 或應用程式名稱 | 符號連結 |
+| `~/Library/Preferences/` | Bundle ID 或應用程式名稱 | 符號連結 |
+| `~/Library/Containers/` | Bundle ID | **掛載遷移** |
+| `~/Library/Group Containers/` | Bundle ID | **掛載遷移** |
+| `~/Library/Caches/` | Bundle ID 或應用程式名稱 | 符號連結 |
+| `~/Library/WebKit/` | Bundle ID | 符號連結 |
+| `~/Library/HTTPStorages/` | Bundle ID | 符號連結 |
+| `~/Library/Application Scripts/` | Bundle ID | 符號連結 |
+| `~/Library/Logs/` | 應用程式名稱 | 符號連結 |
+| `~/Library/Saved Application State/` | 應用程式名稱 | 符號連結 |
 
-## 工具目錄（Dot-Folder）
+容器目錄為什麼不同，見[掛載遷移](/zh-Hant/datamigrae/mount-migration)。
 
-AppPorts 可自動識別常見開發工具在用戶目錄下創建的 dot-folder：
+## 工具目錄
 
-1. 在數據目錄標籤中切換到「工具目錄」子標籤
-2. 頁面會列出所有已識別的工具目錄及其大小
-3. 每個目錄顯示優先級徽章（推薦/可選）和狀態
+AppPorts 會辨識常見開發工具在使用者目錄下建的目錄（`~/.npm`、`~/.gradle` 等）：
 
-如果本地工具目錄已不存在，但目前外部存儲的規範位置仍有 AppPorts 管理的目錄，列表會顯示為「待接回」。切換外部存儲後，AppPorts 會重新掃描工具目錄並刷新該狀態；普通文件不會被識別為可接回目錄。
+1. 在「資料目錄」標籤中切換到「工具目錄」。
+2. 清單顯示已辨識的目錄、大小、優先順序和狀態。
 
-詳細支持列表請參閱[工具目錄識別](/datamigrae/tools)。
+本機目錄不存在、但外接磁碟的規範位置還有 AppPorts 管理的目錄時，顯示為「待接回」。支援清單見[工具目錄辨識](/zh-Hant/datamigrae/tools)。
 
-## 目錄遷移（自訂文件夾）
+## 目錄遷移（自訂資料夾）
 
-「目錄遷移」標籤用於遷移任意用戶文件夾，適合將大型項目、模型、素材庫或工具緩存移動到外部存儲。
+「目錄遷移」標籤用於遷移使用者目錄下的任意資料夾，適合大型專案、模型、素材庫。
 
-1. 在主窗口切換到「目錄遷移」
-2. 點擊「本地文件夾」標題列的「+」按鈕
-3. 選擇要遷移的本地文件夾，再選擇外部存儲中的目標根目錄
-4. AppPorts 會把外部目標設為 `目標根目錄/本地文件夾名`，保存配置並開始遷移
+1. 切換到「目錄遷移」。
+2. 按一下「本地資料夾」標題欄的「+」。
+3. 選本機資料夾，再選外接磁碟上的目標根目錄。目標是 `目标根目录/文件夹名`。
 
-為避免遞歸複製、誤遷移系統目錄或接管錯誤路徑，目錄遷移會執行以下校驗：
+驗證規則：本機資料夾必須在使用者目錄下且不能是使用者目錄本身；路徑及其上級不能是符號連結；不能與已管理的目錄互相包含；外部目標不能在使用者目錄內，也不能與本機資料夾互相包含。
 
-- 本地文件夾必須位於當前用戶目錄下，不能是整個用戶目錄
-- 本地路徑本身及其上級路徑不能是符號鏈接
-- 本地文件夾不能與已管理的數據目錄或目錄遷移項存在包含關係
-- 外部目標根目錄必須是文件夾，且不能位於當前用戶目錄內
-- 外部最終目標不能位於本地文件夾內部，本地文件夾也不能位於外部最終目標內部
+遷移後本機面板顯示原路徑狀態，外部面板顯示副本狀態，可執行「接回」或「還原」。移除設定只刪除記錄，不刪除資料。
 
-遷移後，本地面板顯示原始路徑狀態，外部面板顯示外部副本狀態。可在外部面板中選擇項目執行「接回文件夾」或「還原文件夾」；移除配置只會從目錄遷移列表中刪除記錄，不會自動刪除真實數據。
+## 符號連結遷移
 
-## 遷移操作
+適用於容器之外的所有目錄。
 
-### 單個目錄遷移
+1. 找到目錄，按一下「遷移」。
+2. AppPorts 複製到外接磁碟，寫入管理標記，把原目錄改名為安全備份，在原路徑建符號連結，最後清理備份。
+3. 遷移完成後狀態變為「已連結」。
 
-1. 在數據目錄列表中找到要遷移的目錄
-2. 點擊右側的「遷移」按鈕
-3. AppPorts 會執行以下步驟：
-   - 將目錄複製到外部存儲
-   - 寫入托管鏈接元數據
-   - 刪除本地原始目錄
-   - 創建符號鏈接
-
-### 自動重簽名
-
-在設定中開啟「自動重簽名」後，數據目錄遷移會自動觸發關聯應用的簽名操作：
-
-1. **遷移前**：備份關聯應用的**外部真實路徑**的原始簽名（而非本地殼）
-2. **遷移完成後**：對**外部真實應用**執行 Ad-hoc 重簽名（靜默模式，失敗不彈窗）
-
-對於已連結應用，AppPorts 會自動解析 Stub Portal 殼或符號鏈接背後的真實應用路徑，確保簽名變更作用於實際的應用包，而非無效的本地殼。
-
-::: tip 💡 無需手動操作
-開啟自動重簽名後，數據目錄遷移流程完全自動化。簽名備份和重簽名均作用於真實應用路徑，無需手動干預。
+::: tip 遷移後重簽名
+資料目錄頁頂部有「遷移后重签名」開關，預設關。開啟後，遷移完成會對關聯應用程式執行 Ad-hoc 重簽名，只用於處理遷移後彈「已損壞」的情況；沙盒應用程式會跳過。通常不需要開，詳見[重簽名與當機防護](/zh-Hant/datamigrae/resign)。
 :::
 
-### 日誌上下文
-
-數據目錄操作（遷移、恢復、規範化、重新連結）的日誌中會自動包含關聯應用的上下文信息：
+## 掛載遷移
 
-| 字段 | 說明 |
-|------|------|
-| `app_name` | 關聯應用名稱 |
-| `app_status` | 應用狀態（已連結、本地等） |
-| `app_is_resigned` | 應用是否已被重簽名 |
-| `app_bundle_id` | 應用的 Bundle ID（基於真實路徑讀取） |
-| `app_real_path` | 應用的真實外部路徑 |
-
-這些字段幫助在導出診斷包時更精確地定位問題。
-
-### 批量遷移
+適用於 `Containers` 和 `Group Containers` 下的目錄，按鈕顯示為「掛載遷移」。
 
-1. 在工具目錄列表中勾選多個目錄
-2. 點擊底部的「批量遷移」按鈕
-3. AppPorts 按順序逐個執行遷移
+1. 確認外接磁碟是 APFS，退出關聯應用程式。
+2. 按一下「掛載遷移」，看清確認對話框中的三條提示後繼續。
+3. AppPorts 在外接磁碟建立一個卷宗，複製資料，把卷宗掛到原目錄上。
+4. 完成後狀態為「已掛載」。第一次開啟應用程式時系統彈授權對話框，按一下允許。
 
-::: tip 💡 優先級建議
-數據目錄按優先級分爲三級：
+完整說明見[掛載遷移](/zh-Hant/datamigrae/mount-migration)。
 
-- **重要**（`critical`）：遷移後必須正常工作，影響應用核心功能
-- **推薦**（`recommended`）：佔用空間大，遷移收益高
-- **可選**（`optional`）：空間較小或可重建
+## 還原
 
-建議優先遷移標記爲「推薦」的目錄。
-:::
+**符號連結遷移的目錄**（狀態「已連結」）：按一下「還原」，AppPorts 把資料複製回本機，刪除符號連結，再刪除外接磁碟副本。
 
-## 恢復操作
+**掛載遷移的目錄**（狀態「已掛載」或「待掛載」）：按一下「還原」，AppPorts 把卷宗上的資料複製回本機，卸載並刪除卷宗。外接磁碟需保持連接。
 
-1. 在數據目錄列表中找到已遷移的目錄（狀態爲「已鏈接」）
-2. 點擊右側的「恢復」按鈕
-3. AppPorts 會執行以下步驟：
-   - 刪除本地符號鏈接
-   - 將數據從外部存儲複製回本地
-   - 刪除外部目錄（盡力而爲）
+兩種還原都先複製、後切換，中途失敗不會丟資料。
 
 ## 處理異常狀態
 
-### 待規範
-
-目錄由 AppPorts 管理，但外部路徑不在規範位置。點擊「規範化」按鈕，AppPorts 會將外部數據移動到規範路徑並重建符號鏈接。
+| 狀態 | 意義 | 操作 |
+|------|------|------|
+| 待規範 | AppPorts 管理的連結，但外部路徑不在規範位置 | 「整理」，把外部資料移到規範路徑並重建連結 |
+| 待接回 | 外接磁碟上的資料還在，本機連結丟了 | 「接回」，重建符號連結 |
+| 現有軟
```

---

### Incident Patch 15: `bc1e47b4` (2026-09-26)
**Commit Message**: docs(en): sync mount migration and recovery guides

**File**: `User_docs/docs/en/AppPorts.md` (modified, +12/-12)
```diff
@@ -8,35 +8,35 @@ This guide systematically introduces AppPorts' features, design principles, and
 
 ## Overview
 
-AppPorts is an application migration and linking tool designed for [macOS](https://www.apple.com/macos/), supporting the migration of large applications to external storage devices while maintaining full system functionality and consistency.
+AppPorts is an app migration and linking tool designed for [macOS](https://www.apple.com/macos/). It moves large apps to external storage while keeping Finder, Launchpad, app menus, and system updates as consistent as possible.
 
 ### AppPorts Philosophy
 
 | Principle | Description |
 |-----------|-------------|
-| **Transparent Experience** | Ensures the user experience and operating system perceive the app as still running from internal storage |
+| **Transparent Experience** | Aims to let users and the operating system use migrated apps much like local apps |
 | **Stable Strategy** | Prioritizes proven, more stable migration approaches |
 | **Low System Burden** | No daemons, avoids continuous system resource consumption |
-| **Broad Internationalization** | Prioritizes covering more languages; translation breadth over precision |
+| **Broad Internationalization** | Prioritizes broad language coverage and continually improves translation quality |
 | **Accessibility Friendly** | Comprehensive accessibility support |
 
 ## Core Features
 
 - **Badge-free Migration**: One-click migration of large apps to external drives. Locally retains only a lightweight launcher shell; Finder does not display shortcut arrows; Launchpad and macOS app menu work normally.
 - **Auto-Update Protection**: Automatically detects apps with auto-update support (Sparkle, Electron, Chrome, etc.), providing a "Locked Migration" option to prevent auto-updaters from deleting or overwriting apps on the external drive.
+- **Version Sync Indicators**: When the real local app is newer than the external copy, "Pending Move Out" indicates that the local version can be migrated to replace the older external version.
 - **Stub Portal Version Sync**: When external apps are updated via the App Store, the local Stub Portal's version info is automatically synced, keeping the "Open With" menu accurate.
 - **Custom Scan Directories**: Add extra local app scan directories (e.g., JetBrains Toolbox, Steam). Directories are persisted and automatically monitored for changes.
-- **Code Signature Management**: After migration, if a "Damaged" prompt appears, one-click re-signing via right-click menu. Supports backing up and restoring original signatures; auto re-signing after data directory migration.
+- **Code Signature Management**: If a "damaged" message appears after migrating the app itself, re-sign it from the right-click menu. Original signatures can be backed up and restored. Sandboxed apps are not re-signed.
 - **macOS 15.1+ App Store Support**: Supports installing App Store apps directly to external drives with in-place updates on the external drive.
 - **One-Click Restore**: Supports migrating apps back to local storage with automatic link removal. Automatic recovery on interrupted migration.
-- **Data Directory Management**: Supports migrating app data directories (`~/Library/` subdirectories, `~/.npm`, etc.) to external storage, with tree view grouping, search, and sorting.
+- **Data Directory Management**: Move app data directories (`~/Library/` subdirectories, `~/.npm`, etc.) to external storage, with tree grouping, search, sorting, and strict validation of restore targets using AppPorts metadata.
+- **Mount Migration for Container Data**: Move sandbox container data, such as WeChat chat history, by creating a dedicated volume on an APFS external drive and mounting it at the original directory, without changing the app's signature.
 - **Directory Migration**: Move arbitrary real folders under the user's home directory to external storage, useful for large projects, models, asset libraries, and tool caches, with relink, restore, and path-overlap validation.
 
-## Glossary
+## Migration Strategies
 
-### Migration Strategies
-
-#### Deep Contents Wrapper (Contents Directory Migration)
+### Deep Contents Wrapper (Contents Directory Migration)
 
 The standard file structure of a macOS application is as follows:
 
@@ -56,7 +56,7 @@ The Deep Contents Wrapper strategy migrates all application content to external
 The main flaw of Deep Contents Wrapper is that auto-updaters follow symbolic links and directly modify files on external storage, potentially corrupting the application.
 :::
 
-#### Stub Portal
+### Stub Portal
 
 The Stub Portal approach creates a minimal `.app` shell locally, containing only these four items:
 
@@ -69,7 +69,7 @@ The Stub Portal approach creates a minimal `.app` shell locally, containing only
 
 When the user clicks this shell, macOS executes the `launcher` script, opening the real application on the external drive via the `open` command. No symbolic links are present 
```

**File**: `User_docs/docs/en/badges.md` (modified, +18/-10)
```diff
@@ -46,7 +46,12 @@ AppPorts matches local and external apps by Bundle ID first, then falls back to
 
 | Badge | Icon | Color | Meaning |
 |-------|------|-------|---------|
-| Re-signed | `seal.fill` | Cyan | App has been Ad-hoc re-signed (executed when "Damaged" appears after migration) |
+| Resigned | `seal.fill` | Cyan | The app currently has an Ad-hoc signature, and AppPorts has a signature backup for it |
+| Signature replaced | `exclamationmark.shield.fill` | Red | AppPorts replaced the developer signature with an Ad-hoc signature. The app may not open on macOS 27. Click for details, or right-click and choose "Show repair steps" to open the repair panel. See [Upgrading to macOS 27](/en/macos-27) |
+
+::: tip "Resigned" and "Signature replaced"
+Both mean the app currently has an Ad-hoc signature. The difference is **its original signature**. An app marked "Resigned" originally had no developer signature, or its original signature can no longer be confirmed; re-signing simply lets it open normally. An app marked "Signature replaced" originally had a developer signature that was replaced with Ad-hoc. This may prevent sandboxed apps from opening on macOS 27, so AppPorts highlights them in red and provides repair steps.
+:::
 
 ::: tip 💡 Special Note on Store Label
 When an app meets the following conditions, the "Store" label becomes clickable and displays macOS 15.1+ native installation instructions:
@@ -58,32 +63,35 @@ When an app meets the following conditions, the "Store" label becomes clickable
 
 | Status | Color | Meaning |
 |--------|-------|---------|
-| Local | Secondary color | Directory on local storage, not migrated |
-| Linked | Green | Migrated to external storage; local is a symbolic link |
-| Needs Normalization | Yellow | AppPorts-managed link, but external path not at canonical location; "Normalize" operation recommended |
-| Needs Relinking | Orange | External storage data exists but local symbolic link lost; "Relink" operation recommended |
-| Existing Soft Link | Blue | User-created symbolic link (not created by AppPorts); option to take over management |
+| Local | Secondary color | The directory is local and has not been migrated. A shield beside a container directory indicates that it uses mount migration |
+| Linked | Green | Symbolic-link migration is complete; the local link points to the external drive |
+| Mounted | Purple | Mount migration is complete; the external volume is mounted at the original directory |
+| Awaiting mount | Orange | The volume is online but is not mounted; click "Mount" |
+| Drive Not Connected | Red | The data volume cannot be found, usually because the external drive is disconnected. AppPorts reconnects it automatically when the drive is connected |
+| Needs Normalization | Yellow | An AppPorts-managed link whose external path is not in the standard location; use "Normalize" |
+| Awaiting Relink | Orange | The external data still exists but the local link is missing; use "Relink" |
+| Existing Symlink | Blue | A symbolic link created outside AppPorts; you can choose to bring it under AppPorts management |
 
 ## App Status Combinations
 
 An app may display multiple badges simultaneously:
 
 ```text
-[Linked] [Sparkle] [Running]
+[已链接] [Sparkle] [运行中]
 ```
 Meaning: App migrated to external storage, uses Sparkle auto-update framework, currently running.
 
 ```text
-[External] [Store] [Non-native]
+[外部] [商店] [非原生]
 ```
 Meaning: iOS app (Mac version) on external storage, installed via App Store.
 
 ```text
-[Orphan Link]
+[孤立链接]
 ```
 Meaning: External storage app lost or removed, but local entry still retained. Manual unlinking required.
 
 ```text
-[Pending Move Out]
+[待迁出]
 ```
 Meaning: A newer real app exists locally while the external storage still has an older copy. Re-run migration to move the local version out and replace the old external copy.
```

**File**: `User_docs/docs/en/changelog.md` (modified, +33/-0)
```diff
@@ -4,6 +4,39 @@ outline: deep
 
 # Changelog
 
+## v1.8.2 (In Development)
+
+### Important Changes
+
+- **Container data now uses mount migration**: directories under `~/Library/Containers/` and `~/Library/Group Containers/` no longer use symbolic links. AppPorts creates dedicated volumes on an APFS external drive and mounts them at the original directories, without changing app signatures. An APFS drive is required; allow Removable Volumes access on first launch. See [Mount Migration](/en/datamigrae/mount-migration).
+- **Sandboxed apps are no longer re-signed**: the right-click menu, "Re-sign after migration" switch, and login re-signing script skip sandboxed apps. Re-signing by older versions may prevent them from opening on macOS 27; see [Upgrading to macOS 27](/en/macos-27).
+- **Fixed "Restore Original Signature"**: a complete original app is backed up before re-signing, and a verified working copy safely replaces the current app. Original signatures and entitlements can be restored without the developer's private key. Legacy records can use an official original copy of the same version. Updated apps and damaged backups are not forcibly overwritten.
+- **Automatic detection and repair guidance for replaced signatures**: the app list shows a red "Signature replaced" badge and reminds you once at startup. "Show repair steps" opens a panel guiding you through restoring data, moving the app back, reinstalling, and optionally using mount migration, without deleting data. The badge disappears after reinstallation restores the signature. Scans preserve recovery materials; successful restoration through AppPorts cleans up the backup.
+- **Classic data migration mode**: a new switch in Settings is off by default and requires risk confirmation. It restores the 1.8.1 symbolic-link and re-signing workflow for users already relying on it. If your drive is not APFS, keeping things as they are is recommended instead of enabling this mode.
+- "Auto Re-sign at Login" is off for new installations. Existing users with an installed login agent keep their setting.
+- "Normalize", "Relink", and "Link Details" are disabled for container directories outside classic mode, preventing symbolic links from being recreated.
+
+### Improvements
+
+- **"Mount migration" starts with a check that makes no changes, then gives relevant guidance**: unencrypted APFS storage shows the space you can free, the first-launch permission prompt, and the need to keep the drive connected. For exFAT / NTFS / HFS+, encryption, insufficient space, or a disconnected drive, AppPorts explains the reason and offers actions such as "Keep As Is", "Choose Another Location", and "View Preparation Guide" without changing anything. Readiness checks in the welcome screen and Settings use the same guidance and no longer steer non-APFS users toward classic mode.
+- **Data volumes are hidden in Finder**: newly created volumes do not automatically mount under `/Volumes`, and mounting uses `nobrowse`. Volumes mounted by earlier versions are hidden in place at the next launch or drive connection, without unmounting.
+- **Encrypted APFS drives are not yet supported for mount migration**: new volumes do not inherit the original volume's password. AppPorts stops and explains instead of silently creating an unencrypted volume.
+- **Free-space checks before migration and restoration**: insufficient external or local space stops the operation before volume creation or copying.
+- **Safer restoration**: only the empty mount point is deleted after unmounting, without recursive deletion. Staging directories now use hidden names. If the final step cannot complete, the external volume and record remain intact and AppPorts reports the local copy's location.
+- **Only operate on AppPorts volumes**: mount, unmount, and restore verify the volume identity at the mount point. Operations do not start without the lock shared with the login agent. An unreadable migration record file is never treated as an empty record and overwritten.
+- **Automatic login-agent path updates**: each launch checks the agent's executable path and updates it after AppPorts is moved or upgraded. Running directly from a DMG or Downloads through a temporary App Translocation path blocks new mount migrations and asks you to move AppPorts to Applications first.
+- Mount migration retries with the system administrator password prompt on systems requiring elevated privileges, such as macOS 12.
+- Container volumes remount after login and when a drive connects while AppPorts is running. The login agent also watches `/Volumes` to mount before login apps start. A cross-process lock prevents the agent and AppPorts from competing for mount points during migration or restoration.
+- **The login agent is no longer deferred behind login items**: it uses `KeepAlive` to declare that it needs to run, restarting only after failure, and removes `ProcessType: Background`. The user domain stays in on-demand-only mode for a per
```

**File**: `User_docs/docs/en/datamigrae/baseinfo.md` (modified, +64/-67)
```diff
@@ -2,100 +2,97 @@
 outline: deep
 ---
 
-# Data Migration Basic Implementation
+# How Data Migration Works
 
 ![](https://pic.cdn.shimoko.com/appports/%E6%88%AA%E5%B1%8F2026-05-08%2008.38.05.png)
 
-AppPorts' data migration feature migrates app-associated data directories (such as `~/Library/Application Support`, `~/Library/Caches`, etc.) to external storage to free up local disk space.
+AppPorts moves an app's associated data directories to an external drive to free up local space. It uses two strategies, depending on the directory's location:
 
-## Core Strategy: Symbolic Link
+| Directory | Strategy | Reason |
+|-----------|----------|--------|
+| `~/Library/Containers/`, `~/Library/Group Containers/` | Mount migration | The sandbox checks the resolved path and rejects symbolic links that lead outside the container |
+| Other `~/Library/` subdirectories, tool directories, and custom folders | Symbolic links | These are not restricted by the sandbox, so symbolic links are the simplest approach |
 
-Data directory migration uses the **Whole Symlink** strategy:
+This page covers symbolic links. For the other strategy, see [Mount Migration](/en/datamigrae/mount-migration).
 
-1. Copy the entire original local directory to external storage
-2. Write managed link metadata (`.appports-link-metadata.plist`) to the external directory
-3. Rename the original local directory to a hidden safety backup on the same volume
-4. Create a symbolic link at the original path pointing to the external copy
-5. Clean up the local safety backup after the symbolic link is created successfully
+## Symbolic-Link Strategy
+
+1. Copy the entire local directory to the external drive.
+2. Write the management marker `.appports-link-metadata.plist` to the external directory.
+3. Rename the original local directory to a hidden safety backup on the same volume.
+4. Create a symbolic link at the original path, pointing to the external copy.
+5. Remove the safety backup after the link is created successfully.
 
 ```
 ~/Library/Application Support/SomeApp
-    → /Volumes/External/AppPortsData/SomeApp  (symlink)
+    → /Volumes/External/AppPortsData/SomeApp  （符号链接）
 ```
 
-## Migration Flow
-
 ```mermaid
 flowchart TD
-    A[Select data directory] --> B{Permission & protection check}
-    B -->|Failed| Z[Terminate]
-    B -->|Passed| C{Target path conflict detection}
-    C -->|Managed metadata fully matches| D[Auto-recovery mode]
+    A[Select data directory] --> B{Check permissions and protection}
+    B -->|Failed| Z[Stop]
+    B -->|Passed| C{Check destination conflicts}
+    C -->|Management marker matches fully| D[Automatic recovery mode]
     C -->|Real directory conflict| Y[Stop and report conflict]
-    C -->|No conflict| E[Copy to external storage]
+    C -->|No conflict| E[Copy to external drive]
     D --> E
-    E --> F[Write managed link metadata]
-    F --> G[Rename local directory to safety backup]
+    E --> F[Write management marker]
+    F --> G[Rename to local safety backup]
     G -->|Failed| H[Keep external copy and stop]
-    G -->|Success| I[Create symbolic link]
+    G -->|Succeeded| I[Create symbolic link]
     I -->|Failed| J[Restore local safety backup and keep external copy]
-    I -->|Success| K[Clean local safety backup]
-    K -->|Success| L[Migration complete]
-    K -->|Failed| M[Migration complete; safety backup remains]
+    I -->|Succeeded| K[Remove local safety backup]
+    K -->|Succeeded| L[Migration complete]
+    K -->|Failed| M[Migration complete with safety backup retained]
 ```
 
-## Managed Link Metadata
+## Management Marker
 
-AppPorts writes a `.appports-link-metadata.plist` file in the external directory to identify that the directory is managed by AppPorts. The metadata includes:
+The `.appports-link-metadata.plist` file in the external directory identifies it as managed by AppPorts:
 
 | Field | Description |
 |-------|-------------|
-| `schemaVersion` | Metadata version number (currently 1) |
-| `managedBy` | Manager identifier (`com.shimoko.AppPorts`) |
+| `schemaVersion` | Format version, currently 1 |
+| `managedBy` | `com.shimoko.AppPorts` |
 | `sourcePath` | Original local path |
-| `destinationPath` | External storage target path |
+| `destinationPath` | External destination path |
 | `dataDirType` | Data directory type |
 
-This metadata is used during scanning to distinguish AppPorts-managed links from user-created symbolic links, and supports automatic recovery when migration is interrupted.
-
-Automatic recovery uses strict matching. When the external target already exists, AppPorts only treats it as recoverable if `schemaVersion`, `managedBy`, `sourcePath`, `destinationPath`, and `dataDirType` all match the current operation. A real directory without matching metadata is treated as a conflict; AppPorts no longer recovers or takes over based on similar directory size.
+The scanner uses this marker to distinguish AppPorts links from user-created links, and to resume interrupted m
```

**File**: `User_docs/docs/en/datamigrae/container-identity.md` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+---
+outline: deep
+---
+
+# Container Data, Sandboxing, and Signing Identity
+
+::: tip The key point
+Data in `~/Library/Containers/` and `~/Library/Group Containers/` belongs to **sandboxed apps**. Moving it to an external drive with a "shortcut" (symbolic link) makes it unreadable to those apps. AppPorts previously used re-signing to bypass this, at the cost of apps potentially failing to open on macOS 27 and losing login sessions.
+
+Starting with 1.8.2, container data uses [mount migration](/en/datamigrae/mount-migration), without changing a single byte of the signature. Apps that have already been re-signed need to be reinstalled; see [Upgrading to macOS 27](/en/macos-27).
+:::
+
+This page explains the background. If your app already fails to open, go directly to the repair steps in [Upgrading to macOS 27](/en/macos-27).
+
+## What Is a Container?
+
+Most macOS apps run in a sandbox. The system assigns each app a dedicated folder, `~/Library/Containers/<Bundle ID>/`, and confines its reads and writes there. App Store apps must use this model, and apps downloaded from developers, such as WeChat and QQ Music, often use it too. Data shared by multiple apps lives in `~/Library/Group Containers/`.
+
+To determine whether an app is sandboxed, look for `com.apple.security.app-sandbox` in its entitlements:
+
+```bash
+codesign -d --entitlements - --xml /Applications/WeChat.app 2>/dev/null | grep -c app-sandbox
+# 输出 1 就是沙盒应用
+```
+
+An easily missed detail: **an unsandboxed main app does not mean its containers can be moved freely.** Chrome and Edge do not sandbox their main executables, but their widgets and extensions have containers owned by sandboxed processes. AppPorts therefore handles all directories under `Containers` consistently, regardless of the main executable.
+
+## Three Ways to Move Container Data
+
+| Approach | Result | Reason |
+|----------|--------|--------|
+| Copy to the external drive and leave a symbolic link | The app opens but cannot read the data; WeChat reports that the storage location cannot be used | The sandbox checks **where the link points** and denies targets outside the container. An external drive and the Desktop produce the same result |
+| Symbolic link plus Ad-hoc re-signing | Works on macOS 26 and earlier; may quit immediately after upgrading to 27, confirmed for WeChat while QQ Music still opens | Removing the sandbox identity makes the link usable, but also removes the ownership relationship between the app and container, which macOS 27 checks |
+| Mount an APFS volume from the external drive at the original directory | Works without signature changes | The path stays inside the container and passes the sandbox check. Allow the one-time system prompt for data on external storage |
+
+All three approaches have been tested on macOS 27. Original logs are in [Experiment: Symbolic Links](/en/research/sandbox-symlink) and [Experiment: Mount Points](/en/research/sandbox-mountpoint).
+
+## What Re-signing Changes
+
+Ad-hoc re-signing (`codesign --force --deep --sign -`) removes the following from the app:
+
+| Removed Item | Consequence |
+|--------------|-------------|
+| `com.apple.security.app-sandbox` | The app no longer runs with a sandbox identity |
+| `com.apple.security.application-groups` | Shared data in `Group Containers` becomes inaccessible |
+| `keychain-access-groups` | Keychain login sessions and database keys become inaccessible |
+| Team ID | The identity no longer matches when the system checks container ownership |
+
+The app does not necessarily fail immediately. It accesses its container as an ordinary process, which macOS 26 and earlier allow. On 27, if the system already holds permission records for its previous signature, access is denied because the code requirement no longer matches:
+
+```
+sandboxd rejected approval request from WeChat for kTCCServiceSystemPolicyAppData
+  (/Users/<user>/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files): denied
+runningboardd: termination reported by launchd (0, 0, 65280)
+```
+
+The same re-signed WeChat app on the same Mac behaved as follows:
+
+| System | Behavior |
+|--------|----------|
+| macOS 26.6.2 | Worked normally for two and a half days |
+| macOS 27.0 | Quit about 0.4 seconds after every launch |
+
+::: warning "It always worked before" is not evidence of safety
+An app can work for weeks or months after re-signing, then fail at the next major system upgrade without any warning before or after it. The original developer's certificate is not on your Mac, so you cannot sign the removed entitlements back into place; reinstalling is required.
+:::
+
+## Why It Can Open from Terminal
+
+This can be misleading during diagnosis. The system attributes access to a "responsible process". When opened from Finder or the Dock, the app is responsible for itself and its own identity is denied. When started from Terminal or another program with Full Disk Access, the host is 
```

**File**: `User_docs/docs/en/datamigrae/mount-migration.md` (added, +176/-0)
```diff
@@ -0,0 +1,176 @@
+---
+outline: deep
+---
+
+# Mount Migration: Move Container Data to an External Drive
+
+::: tip The key point
+Data in `~/Library/Containers/` and `~/Library/Group Containers/`, including WeChat chat history, QQ Music caches, and App Store app data, cannot be moved using symbolic links. Starting with AppPorts 1.8.2, AppPorts creates a dedicated APFS data volume on the external drive, copies the data into it, and **mounts that volume at the original directory**. The app sees the same path, and its signature stays unchanged.
+
+Three requirements: use an unencrypted APFS external drive, allow the permission prompt the first time you open the app, and connect the drive before opening the app.
+:::
+
+## When to Use It
+
+Select an app under "Data Directories" → "App Data". Directories in the `Containers` and `Group Containers` groups show "Mount migration" instead of "Migrate". Other groups, such as `Application Support` and caches, as well as tool directories and custom directories, continue to use symbolic links.
+
+For why containers are different, and why the main executable's sandbox status is not decisive, see [Container Data, Sandboxing, and Signing Identity](/en/datamigrae/container-identity).
+
+## After Clicking "Mount migration" {#preflight}
+
+AppPorts first checks external storage without making changes, then offers the next step based on the result:
+
+| Check Result | What You See | What You Can Do |
+|--------------|--------------|-----------------|
+| Unencrypted APFS with enough space | An explanation of the local space you can free, the first-launch permission prompt, and keeping the drive connected | Click "Migrate Data" to begin |
+| exFAT, NTFS, HFS+, or another format | A message identifying the external storage format | "Keep As Is", "Choose Another Location", or "View Preparation Guide" |
+| Encrypted APFS | A message explaining that the external storage is encrypted | "Keep As Is" or select an unencrypted APFS location |
+| Not enough space | Required and available space | Free some space and check again, or choose another location |
+| No external storage selected or connected | A prompt to select or connect external storage | Select external storage and check again |
+
+**If migration is unavailable, you do not need to change anything.** Apps, `Application Support`, caches, and tool directories can still be migrated to this drive. Leave container data on this Mac and use the app normally. When you want to migrate it later, follow [Prepare an APFS External Drive](/en/why-apfs#prepare-apfs).
+
+::: info Why encrypted APFS drives are not supported yet
+A new data volume does not inherit the original volume's password. Migrating normally would place chat history protected by FileVault on this Mac onto a volume with no password. AppPorts avoids silently reducing that protection until automatic unlocking and password management are ready. See [Encrypted External Drives](/en/why-apfs#encrypted-drives).
+:::
+
+## Before Migration
+
+- **Move AppPorts to the Applications folder and open it from there first.** The login agent needs a persistent app path. Running directly from Downloads or a DMG may use a temporary App Translocation path; AppPorts blocks new mount migrations from such paths and asks you to install it. Open AppPorts once after moving or updating it so it can update the agent's path. It does not reload the agent when the path is unchanged.
+- **Quit the app completely.** AppPorts checks and refuses migration while the app is running.
+- **Give AppPorts Full Disk Access.** Mounting a volume at a container path is controlled by the system and fails without permission.
+- **Consider backups.** As with any data migration, back up important data first. After migration it lives on the external drive. Time Machine usually excludes external drives; if needed, check that this drive is included in the backup options under System Settings → General → Time Machine.
+
+## What Happens During Migration
+
+1. Create a volume in the external drive's APFS container without automatically mounting it under `/Volumes`. Its name resembles `AppPorts-<Bundle ID>-<目录名>-xxxxxx`. It shares the container's free space with other volumes; no size needs to be specified.
+2. Temporarily mount it under `~/Library/Application Support/AppPorts/mounts/`, copy the directory contents with the AppPorts copier, write `.appports-mount-metadata.plist` at the volume root, and unmount it.
+3. Rename the original directory to a safety backup on the same volume, create an empty directory at the original path, mount the new volume there, and verify its identity.
+4. Save the mount record in `~/Library/Application Support/AppPorts/container-mounts.plist`, install the automatic remount agent, and finally remove the safety backup.
+
+If external space is insufficient, AppPorts stops before creating a volume. If a failure occurs before migration is complete, AppPorts attempts to roll back. If rollback cann
```

**File**: `User_docs/docs/en/datamigrae/operation.md` (modified, +70/-106)
```diff
@@ -2,147 +2,111 @@
 outline: deep
 ---
 
-# Data Migration Operation Guide
+# Data Migration Guide
 
-This page covers the practical workflow for data directory migration. For technical implementation details, see [Basic Implementation](/en/datamigrae/baseinfo).
+This page explains how to migrate data directories. For the technical implementation, see [How Data Migration Works](/en/datamigrae/baseinfo).
 
-## Finding App-Associated Data Directories
+## Find an App's Data Directories
 
-1. Switch to the "Data Directories" tab in the main AppPorts window
-2. The left panel shows all installed apps
-3. Use the top toolbar to switch between "Tool Directories" and "App Data"; when viewing app data, click an app and the right panel displays its associated directories under `~/Library/`
+1. Open the "Data Directories" tab in the AppPorts main window.
+2. Switch between "Tool Directories" and "App Data" at the top.
+3. In App Data, select an app on the left. Its associated directories under `~/Library/` appear on the right.
 
-AppPorts automatically scans the following directories, matching by app Bundle ID or name:
+AppPorts matches these locations using the app's Bundle ID or name:
 
-| Scan Path | Matching Method |
-|-----------|-----------------|
-| `~/Library/Application Support/` | Bundle ID or app name |
-| `~/Library/Preferences/` | Bundle ID or app name |
-| `~/Library/Containers/` | Bundle ID |
-| `~/Library/Group Containers/` | Bundle ID |
-| `~/Library/Caches/` | Bundle ID or app name |
-| `~/Library/WebKit/` | Bundle ID |
-| `~/Library/HTTPStorages/` | Bundle ID |
-| `~/Library/Application Scripts/` | Bundle ID |
-| `~/Library/Logs/` | App name |
-| `~/Library/Saved Application State/` | App name |
+| Scanned Path | Matching Method | Migration Method |
+|--------------|-----------------|------------------|
+| `~/Library/Application Support/` | Bundle ID or app name | Symbolic link |
+| `~/Library/Preferences/` | Bundle ID or app name | Symbolic link |
+| `~/Library/Containers/` | Bundle ID | **Mount migration** |
+| `~/Library/Group Containers/` | Bundle ID | **Mount migration** |
+| `~/Library/Caches/` | Bundle ID or app name | Symbolic link |
+| `~/Library/WebKit/` | Bundle ID | Symbolic link |
+| `~/Library/HTTPStorages/` | Bundle ID | Symbolic link |
+| `~/Library/Application Scripts/` | Bundle ID | Symbolic link |
+| `~/Library/Logs/` | App name | Symbolic link |
+| `~/Library/Saved Application State/` | App name | Symbolic link |
 
-## Tool Directories (Dot-Folders)
+For why containers need a different method, see [Mount Migration](/en/datamigrae/mount-migration).
 
-AppPorts can automatically detect dot-folders created by common development tools in the user's home directory:
+## Tool Directories
 
-1. Switch to the "Tool Directories" sub-tab in the Data Directories tab
-2. The page lists all detected tool directories with their sizes
-3. Each directory shows a priority badge (recommended/optional) and status
+AppPorts recognizes directories created by common development tools under your home directory, such as `~/.npm` and `~/.gradle`:
 
-If a local tool directory is missing but the canonical location on the selected external storage still contains an AppPorts-managed directory, the item appears as "Needs Relinking". Switching external storage triggers a new scan and refreshes this state. Regular files are not treated as relinkable directories.
+1. Select "Tool Directories" in the "Data Directories" tab.
+2. The list shows recognized directories, their sizes, priorities, and statuses.
 
-For the full supported list, see [Tool Directory Detection](/en/datamigrae/tools).
+If the local directory is missing but an AppPorts-managed directory remains at the standard external location, it is shown as "Awaiting Relink". See [Tool Directory Detection](/en/datamigrae/tools) for the supported list.
 
-## Directory Migration (Custom Folders)
+## Directory Migration for Custom Folders
 
-The "Directory Migration" tab migrates arbitrary user folders. It is useful for large projects, model files, asset libraries, or tool caches that you want to move to external storage.
+Use the "Directory Migration" tab to move arbitrary folders under your home directory, such as large projects, models, and asset libraries.
 
-1. Switch to "Directory Migration" in the main window
-2. Click the "+" button in the "Local Folders" header
-3. Choose the local folder to migrate, then choose the target root directory on external storage
-4. AppPorts uses `target root/local folder name` as the external destination, saves the configuration, and starts migration
+1. Open "Directory Migration".
+2. Click "+" in the "Local Folders" heading.
+3. Select a local folder, then a destination root on the external drive. The destination is `目标根目录/文件夹名`.
 
-To avoid recursive copies, system-directory migration, or taking over the wrong path, directory migration applies these checks:
+Validation rules: the local folder must be inside your home d
```

**File**: `User_docs/docs/en/datamigrae/resign.md` (modified, +58/-114)
```diff
@@ -2,151 +2,95 @@
 outline: deep
 ---
 
-# Re-signing & Crash Prevention
+# Re-signing and Crash Prevention
 
 ![](https://pic.cdn.shimoko.com/appports/%E6%88%AA%E5%B1%8F2026-05-08%2008.38.37.png)
 
-## Why Apps May Crash After Data Migration
+::: warning Re-signing is not a general repair tool
+Ad-hoc re-signing replaces the developer signature and removes sandbox, app group, and Keychain entitlements. For sandboxed apps such as WeChat and App Store apps, this can prevent opening on macOS 27 and may lose login sessions. The new version first saves a complete original app, allowing the signature and entitlements to be restored later. Restoring a signature does not guarantee recovery of login sessions already lost.
 
-macOS's code signing mechanism (`codesign`) verifies the integrity of the application package, including file path structure. When AppPorts migrates an app's data directory to external storage and replaces it with a symbolic link, the signing seal is broken, causing the following issues:
-
-- **Gatekeeper Block**: `codesign --verify --deep --strict` detects signature failure; the system displays a "Damaged" or "from an unidentified developer" dialog, blocking app launch
-- **Keychain Access Disruption**: Apps relying on Keychain access groups cannot read stored credentials due to signature identity changes
-- **Entitlements Failure**: Some app entitlements are bound to the signing identity; after signature changes, entitlements mismatch
-
-### High-Risk App Types
-
-| App Type | Risk Level | Reason |
-|----------|------------|--------|
-| Sparkle self-updating apps | **High** | Updater may delete or replace the app, damaging symbolic links |
-| Electron self-updating apps | **High** | `electron-updater` may also interfere with apps on external storage |
-| Keychain-dependent apps | **High** | Ad-hoc signing changes the signature identity; Keychain access groups fail |
-| Mac App Store apps | **High** | SIP protection; cannot be re-signed |
-| Native self-updating apps (Chrome, Edge) | Medium | Self-update may replace external copy, invalidating local entry |
-| iOS apps (Mac version) | Low | Uses Stub Portal or whole symlink; fewer signing issues |
-
-### High-Risk Data Directory Types
+Starting with 1.8.2, AppPorts refuses to re-sign sandboxed apps by default. It is allowed only after enabling classic mode and confirming the risks. Container data now uses [mount migration](/en/datamigrae/mount-migration), without signature changes. See [Container Data, Sandboxing, and Signing Identity](/en/datamigrae/container-identity) for the background.
+:::
 
-| Data Type | Risk Level | Reason |
-|-----------|------------|--------|
-| `~/Library/Application Support/` | Medium | App may use file locks, SQLite WAL logs, or extended attributes; may behave abnormally across symbolic links |
-| `~/Library/Group Containers/` | Medium | Shared by multiple apps under the same Team; symbolic links may interfere with other apps |
-| `~/Library/Preferences/` | Low-Medium | `cfprefsd` caches plist files; symbolic links may cause reading stale data |
-| `~/Library/Caches/` | Low | Caches are rebuildable; most apps handle cache absence gracefully |
+## What Re-signing Solves
 
-## Re-signing Mechanism
+macOS uses code signatures to verify app bundle integrity. After the app itself is moved to an external drive and only a launcher remains locally, the system may sometimes treat it as modified, show "damaged" or "unidentified developer", and refuse to open it. Applying an Ad-hoc signature to the **real app on the external drive** can let it pass verification.
 
-### Post-Migration Re-sign Confirmation
+This is the purpose of re-signing. It is separate from data directory migration; coupling it to container migration in older versions caused the macOS 27 problem.
 
-When migrating app data under `Containers` or `Group Containers`, AppPorts asks whether to Ad-hoc re-sign the associated app after migration. Accepting backs up the original signature and re-signs the real app path after migration; declining migrates the data only.
+## When Not to Use It
 
-This confirmation reduces the chance that an app fails to recognize moved container data, shows an abnormal prompt, or fails to launch after migration. For apps that rely heavily on containers or Keychain access, make an independent backup before choosing.
+| Situation | Explanation |
+|-----------|-------------|
+| Sandboxed apps | Refused by default; classic mode allows it after risk confirmation, but mount migration is preferred |
+| App Store apps | Protected by SIP and cannot be re-signed |
+| Apps relying on Keychain login sessions | Re-signing loses those sessions |
+| Apps with widgets or sharing extensions | App group entitlements are lost, preventing extensions from reading shared data |
+| Apps that already open normally | Do not re-sign an app that has no problem |
 
-### Ad-hoc Signing
+Consider it only when a "damaged" message actually appears after migration 
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
