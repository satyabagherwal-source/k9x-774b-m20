> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/wzh4869-appports-learnings.md`  
> **Source**: github ([https://github.com/wzh4869/AppPorts](https://github.com/wzh4869/AppPorts))  
> **Source Version**: `8ef2dad3`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T01:21:12.900Z  
> **Learning ID**: `learn-github-wzh4869-appports`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): wzh4869/AppPorts

> **Canonical Artifact**: `07_PROJECT_LEARNING/wzh4869-appports-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wzh4869/AppPorts](https://github.com/wzh4869/AppPorts))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T01:21:12.894Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wzh4869/AppPorts`
- **Description**: 📦 A macOS utility to seamlessly migrate applications to external storage and reclaim local disk space.【一款 macOS 工具，无缝迁移应用到外部存储并自动建立链接，释放宝贵的本地空间】
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2133 stars

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

extension Notification.Name {
    static let appPortsRecordsDidChange = Notification.Name("AppPorts.recordsDidChange")
}

/// 跨页面、跨窗口保留文件操作的生命周期，阻止重建视图或重复启动迁移。
@MainActor
final class AppOperationState: ObservableObject {
    static let shared = AppOperationState()

    @Published private var activeOperation: UUID?
    @Published private(set) var recordsRevision: UInt64 = 0
    private var recordObserver: AnyCancellable?
    private var terminationReply: (() -> Void)?
    private var cancellation: (() -> Void)?

    init(notificationCenter: NotificationCenter = .default) {
        recordObserver = notificationCenter.publisher(for: .appPortsRecordsDidChange)
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                guard let self, !self.isBusy else { return }
                self.recordsRevision &+= 1
            }
    }

    var isBusy: Bool { activeOperation != nil }

    func begin() -> UUID? {
        guard activeOperation == nil, terminationReply == nil else { return nil }
        let token = UUID()
        activeOperation = token
        return token
    }

    func finish(_ token: UUID) {
        guard activeOperation == token else { return }
        activeOperation = nil
        cancellation = nil
        // Publish once at the end of a foreground operation, not on every
        // journal phase. Idle windows also observe background store changes.
        recordsRevision &+= 1
        let reply = terminationReply
        terminationReply = nil
        reply?()
    }

    func registerCancellation(for token: UUID, _ cancel: @escaping () -> Void) {
        guard activeOperation == token else { return }
        cancellation = cancel
    }

    /// Keep every UI mutation's task reachable during a normal Quit. The
    /// caller still finishes its token after accounting for the operation.
    @discardableResult
    func startTask(for token: UUID, operation: @escaping @MainActor () async -> Void) -> Task<Void, Never>? {
        guard activeOperation == token else { return nil }
        let task = Task { @MainActor in await operation() }
        registerCancellation(for: token) { task.cancel() }
        return task
    }

    /// The operation keeps ownership until its current filesystem boundary is
    /// accounted for. A forced quit remains recoverable from its own journal.
    func finishBeforeTerminating(_ reply: @escaping () -> Void) -> Bool {
        guard isBusy else { return false }
        terminationReply = reply
        cancellation?()
        return true
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

    enum ExternalGrouping: Sendable {
        /// The main list shows one preferred candidate for each application identity.
        case applicationIdentity
        /// Storage checks must see each copy, including copies with the same bundle identifier.
        case filePath
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
                        let status = statu
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

### Core Architecture Module: `AppPorts/Utils/ContainerVolumeMigrator+Recovery.swift`
```
import Darwin
import Foundation
import CoreData

extension ContainerVolumeMigrator {
    enum AutomaticRecoveryError: LocalizedError, CustomNSError {
        case restored(operation: Error, retainedDetails: String?)
        case incomplete(operation: Error, recovery: Error)
        case timedOut

        static var errorDomain: String { "AppPorts.AutomaticRecovery" }
        var errorCode: Int {
            switch self {
            case .restored: return 1
            case .incomplete: return 2
            case .timedOut: return 3
            }
        }
        var errorUserInfo: [String: Any] {
            var result: [String: Any] = [NSLocalizedDescriptionKey: errorDescription ?? ""]
            switch self {
            case .restored(let operation, _):
                result[NSUnderlyingErrorKey] = operation as NSError
            case .incomplete(let operation, let recovery):
                result[NSUnderlyingErrorKey] = operation as NSError
                result[NSDetailedErrorsKey] = [recovery as NSError]
            case .timedOut: break
            }
            return result
        }

        var errorDescription: String? {
            switch self {
            case .restored(let operation, let details):
                return ["本次操作未完成，已撤回本次变更，原数据已保留，可以直接重试。".localized,
                        operation.localizedDescription, details].compactMap { $0 }.joined(separator: "\n\n")
            case .incomplete(let operation, let recovery):
                return ["本次操作未完成，数据已保留。AppPorts 会在条件恢复后继续处理，也可以重试。".localized,
                        operation.localizedDescription, recovery.localizedDescription].joined(separator: "\n\n")
            case .timedOut:
                return "自动恢复暂未完成，已保留恢复记录；再次操作时会继续检查实际数据位置。".localized
            }
        }
    }

    enum AutomaticRecoveryResult: Sendable {
        case completed
        case rolledBack(retainedDetails: String?)
    }

    func pendingMountTransfer(at path: String, direction: DataTransferRecord.Direction) throws -> DataTransferRecord? {
        let pending = try store.transfers().filter {
            $0.mode == .mount && $0.direction == direction && $0.originalPath == path
                && !$0.isDataSwitchComplete && $0.rollbackCompletedAt == nil
        }
        guard pending.count <= 1 else { throw DataOperationSafety.Failure.conflict(path) }
        return pending.first
    }

    /// Called while the outer operation still owns its process-wide lock. A
    /// cancellation stops copying, but must not cancel the work that restores
    /// an application entry. Disk commands have individual recovery deadlines.
    func recoverWithIndependentBudget(_ transfer: DataTransferRecord,
                                      finishPreparedRestore: Bool = true,
                                      timeoutNanoseconds: UInt64 = 0) async throws -> AutomaticRecoveryResult {
        let transfer = try store.adoptLegacyRestoreOwnership(transfer)
        let progress = DataTransferSession.progress
        // Disk commands have their own deadlines. A dataset-sized verification
        // must not restart forever because it exceeds a fixed 10/90s budget.
        if timeoutNanoseconds == 0 {
            return try await Task.detached(priority: .userInitiated) {
                try await DataTransferSession.$progress.withValue(progress) {
                    try await DataTransferSession.run {
                        progress?.begin(.recovering)
                        return try await self.recoverMountOperation(transfer, finishPreparedRestore: finishPreparedRestore)
                    }
                }
            }.value
        }
        return try await Task.detached(priority: .userInitiated) {
            try await DataTransferSession.$progress.withValue(progress) {
                progress?.begin(.recovering)
                return try await withThrowingTaskGroup(of: AutomaticRecoveryResult.self) { group in
                    group.addTask { try await self.recoverMountOperation(transfer, finishPreparedRestore: finishPreparedRestore) }
                    group.addTask {
                        try await Task.sleep(nanoseconds: timeoutNanoseconds)
                        throw AutomaticRecoveryError.timedOut
                    }
                    defer { group.cancelAll() }
                    return try await group.next()!
                }
            }
        }.value
    }

    func recoverFailedMountOperation(at path: String, direction: DataTransferRecord.Direction,
                                     operation error: Error) async throws -> DataTransferRecord {
        guard let transfer = try pendingMountTransfer(at: path, direction: direction) else { throw error }
        let result: AutomaticRecoveryResult
        do {
            result = try await recoverWithIndependentBudget(transfer,
                finishPreparedRestore: !Self.operationWasCancelled(error))
        } catch let recovery {
            throw AutomaticRecoveryError.incomplete(operation: error, recovery: recovery)
        }
        switch result {
        case .completed:
            guard let completed = try store.transfer(operationID: transfer.operationID), completed.isDataSwitchComplete else {
                throw AutomaticRecoveryError.incomplete(operation: error,
                    recovery: DataOperationSafety.Failure.inspection(path))
            }
            return completed
        case .rolledBack(let details):
            throw AutomaticRecoveryError.restored(operation: error, retainedDetails: details)
        }
    }

    static func operationWasCancelled(_ error: Error) -> Bool {
        if error is CancellationError { return true }
        if case MigrationError.ownershipRollbackFailed(_, let operation, _) = error {
            return operationWasCancelled(operation)
        }
        if case MigrationError.copyFailed(let operation) = error { return operationWasCancelled(operation) }
        if case DiskUtility.Failure.administratorPromptCancelled = error { return true }
        let cocoa = error as NSError
        return cocoa.domain == NSCocoaErrorDomain && cocoa.code == NSUserCancelledError
    }

    private func requireRecoveryJournal(_ expected: DataTransferRecord) throws {
        try Task.checkCancellation()
        guard try store.transfer(operationID: expected.operationID) == expected,
              !(try store.transfers()).contains(where: { $0.priorOperationID == expected.operationID }) else {
            throw RecoveryJournalChanged(operation: DataOperationSafety.Failure.conflict(expected.originalPath))
        }
    }

    private func finishVerifiedRecovery(_ transfer: DataTransferRecord) async throws {
        guard transfer.isVerifiedSwitchRecoverable, let encoded = transfer.baseline else {
            throw DataOperationSafety.Failure.inspection(transfer.originalPath)
        }
        var state = VerifiedMountResume(transfer: transfer, transfers: try store.transfers(),
            mounts: try store.recordsStrict(), links: try store.managedLinks(), cleanups: try store.pendingCleanups())
        try requireVerifiedResumeLedger(state)
        try requireVerifiedResumeTopology(state)
        let baseline = try PropertyListDecoder().decode(TreeCopySnapshot.self, from: encoded)
        do {
            if transfer.direction == .migrate { try await resumeVerifiedMountMigration(&state, baseline: baseline) }
            else { try await resumeVerifiedMountRestore(&state, baseline: baseline) }
        } catch {
            do { try requireVerifiedResumeLedger(state) }
            catch { throw RecoveryJournalChanged(operation: error) }
            throw error
        }
        synchronizeAgent(store)
    }

    private func recoverMountOperation(_ expected: DataTransferRecord,
                                       finishPreparedRestore: Bool) async throws -> AutomaticRecoveryResult {
        try requireRecoveryJournal(expected)
        if expected.isDataSwitchComplete { return .completed }
        if expected.rollbackCompletedAt != nil {
            return try await cleanupRolledBackOperation(expected)
        }
        let local = URL(fileURLWithPath: expected.originalPath)
        if expected.direction == .migrate, isMountPoint(local) {
            // A live destination can contain newer data. Never replace it with
            // the old local backup merely because the final journal write failed.
            try await finishVerifiedRecovery(expected)
            return .completed
        }
        if expected.direction == .migrate, expected.isVerifiedSwitchRecoverable, expected.backupIdentity != nil {
            do {
                try await finishVerifiedRecovery(expected)
                return .completed
            } catch {
                try Task.checkCancellation()
                guard !RecoveryJournalChanged.isContained(in: error), !isMountPoint(local) else { throw error }
                // The final mount can fail repeatedly (busy/permissions). If
                // the candidate never became active, restore the local entry.
                // rollBackMountMigration proves its contents before doing so.
            }
        }
        if expected.direction == .restore, !isMountPoint(local), !isSymbolicLink(at: local),
           let identity = try? DataPathIdentity.capture(local),
           expected.destinationIdentity.map({ identity.matchesFilesystemObject($0) }) == true {
            try await finishVerifiedRecovery(expected)
            return .completed
        }
        if expected.direction == .restore, expected.isVerifiedSwitchRecoverable, finishPreparedRestore {
            do {
                try await finishVerifiedRecovery(expected)
                return .completed
            } catch {
                try Task.checkCancellation()
                guard !RecoveryJournalChanged.isContained(in: error) else { throw error }
                // The source is still authoritative. A move/mount failure must
                //
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
/// - **迁移**：建卷 → 复制并核验 → 切换原路径 → 持久化记录 → 自动清理已核验的旧数据
/// - **还原**：定位当前卷 → 复制最新数据并核验 → 切回原路径 → 自动清理旧卷
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
        case cleanupRecordLocalUnavailable(URL)
        case cleanupRecordStillMounted(URL)
        case cleanupRecordStagingExists(URL)

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
                return ["数据入口无法安全切换，现有数据已保留。".localized, url.path, details].joined(separator: "\n")
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
                return ["数据入口无法安全切换，现有数据已保留。".localized,
                    backup.path, volumeName, volumeUUID, error.localizedDescription].joined(separator: "\n")
            case .restoreIncomplete(let staging, let error):
                return String(
                    format: "还原没有完成：外置卷上的数据和迁移记录保持不变，已复制到本机的副本保留在「%@」。%@".localized,
                    staging.path,
                    error.localizedDescription
                )
            case .restoreRecordRecovery(let staging, let error):
                return ["数据入口无法安全切换，现有数据已保留。".localized,
                    staging.path, error.localizedDescription].joined(separator: "\n")
            case .ownershipRollbackFailed(let url, let operation, let rollback):
                return ["自动恢复暂未完成，已保留恢复记录；再次操作时会继续检查实际数据位置。".localized,
                    url.path, operation.localizedDescription, rollback.localizedDescription].joined(separator: "\n")
            case .cleanupRecordLocalUnavailable(let url):
                return "未确认本地还原目录，未移除记录：".localized + url.path
            case .cleanupRecordStillMounted(let url):
                return ["数据入口无法安全切换，现有数据已保留。".localized, url.path].joined(separator: "\n")
            case .cleanupRecordStagingExists(let url):
                return ["暂存对象归属无法确认，已保留。".localized, url.path].joined(separator: "\n")
            }
        }
    }

    struct MigrationResult: Sendable {
        let record: ContainerMountRecord
        let cleanupWarning: CleanupWarning?
        let operationID: UUID
    }

    /// 主操作已完成，副本或记录清理尚未完成；调用方须按部分成功呈现。
    struct CleanupWarning: Sendable {
        let cleanup: ContainerCleanupRecord
        let details: String
        var needsRecordUpdateOnly = false
        var transferOperationID: UUID? = nil

        var message: String {
            if transferOperationID != nil {
                let format = cleanup.kind == .restoredVolume
                    ? "数据已还原到本地，但旧副本尚未全部清理。%@".localized
                    : "迁移已完成，但旧副本尚未全部清理。%@".localized
                return String(format: format, "\n" + details)
            }
            return (["旧版操作的安全收尾尚未完成，数据已保留。AppPorts 会继续检查；当前未完成的原因：".localized,
                     cleanup.localPath, "APFS · " + cleanup.mountRecord.volumeName + " · " + cleanup.mountRecord.volumeUUID]
                + [cleanup.restoreStagingPath, details.isEmpty ? nil : details].compactMap { $0 }).joined(separator: "\n")
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
    static let volumeSystemArtifacts: Set<String> = [
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
    // Shared with the actor's automatic-recovery extension.
    let disk: DiskUtility
    let store: ContainerMountStore
    let isMountPoint: @Sendable (URL) -> Bool
    private let mountedVolumePath: @Sendable (URL) -> String?
    private let mountedVolumeUUID: @Sendable (URL) -> String?
    /// 读卷根迁移标记里的 Volume UUID。挂载前用它确认 `/Volumes/<卷名>` 上挂的就是我们要的卷，
    /// 测试注入假实现，避免真去读磁盘。
    private let volumeUUIDMarker: @Sendable (URL) -> String?
    /// 记录增删后同步登录代理的安装状态；测试注入空实现，避免动真实 LaunchAgents。
    let synchronizeAgent: @Sendable (ContainerMountStore) -> Void
    /// 路径所在卷的可用空间；返回 nil 表示查不到，此时不拦截。测试注入固定值。
    private let availableCapacity: @Sendable (URL) -> Int64?
    /// 挂载点的挂载标志，用来发现早期版本挂上、仍会显示在 Finder 里的卷。测试注入固定值。
    let mountFlags: @Sendable (URL) -> UInt32?
    let stagingMountRootURL: URL
    let safety: DataOperationSafety
    private let makeMountPointLease: @Sendable (URL) throws -> any MountPointLeasing
    private let synchronizeCleanupParent: @Sendable (URL) throws -> Void
    private var completingPaths: Set<String> = []
    private var runningCleanups: Set<UUID> = []

    init(
        disk: DiskUtility = DiskUtility(),
        store: ContainerMountStore = .shared,
        stagingMountRootURL: URL? = nil,
        isMountPoint: @escaping @Sendable (URL) -> Bool = { DiskUtility.isMo
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

/// Low-level data-tree operations retain originals; complete user flows clean
/// their verified copies after the successful switch has been committed.
/// UI flags never authorize execution; every entry point evaluates real paths and durable topology.
actor DataDirMover {
    struct CompletionResult: Sendable {
        /// The data switch succeeded. A warning refers only to retained-copy cleanup.
        let cleanupWarning: String?
    }

    enum CompletionError: LocalizedError {
        case previousRestoreNeedsCleanup(String)

        var errorDescription: String? {
            switch self {
            case .previousRestoreNeedsCleanup(let details):
                return String(format: "上次还原的旧副本尚未清理，新的迁移尚未开始。AppPorts 会继续完成清理，条件恢复后可直接重试。%@".localized, "\n" + details)
            }
        }
    }

    private let fileManager = FileManager.default
    private let homeDir: URL
    private let store: ContainerMountStore
    private let safety: DataOperationSafety
    private let mountMigrator: ContainerVolumeMigrator?
    private let failSymlinkCreation: Bool
    private let synchronizeDirectory: @Sendable (URL, Bool) throws -> Void
    private var runningMigrations: Set<UUID> = []
    private var runningRestores: Set<UUID> = []
    private var runningCleanups: Set<UUID> = []
    private var completingPaths: Set<String> = []
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
         store: ContainerMountStore = .shared, runner: any ShellCommandRunning = ProcessCommandRunner(),
         mountMigrator: ContainerVolumeMigrator? = nil,
         synchronizeDirectory: @escaping @Sendable (URL, Bool) throws -> Void = {
             try DurableFileIO.syncDirectory(at: $0, resolvingAlias: $1)
         }) {
        self.homeDir = homeDir.standardizedFileURL
        self.store = store
        self.safety = DataOperationSafety(homeDirectory: homeDir, store: store, runner: runner)
        self.mountMigrator = mountMigrator
        self.failSymlinkCreation = failSymlinkCreation
        self.synchronizeDirectory = synchronizeDirectory
        // Kept source-compatible with older callers. Success now always retains the original.
        _ = failSourceBackupCleanup
    }

    /// Complete the ordinary user flow while keeping cleanup failures separate
    /// from a successful data switch. The caller holds the shared operation lock.
    func migrateAndComplete(item: DataDirItem, to externalBaseURL: URL,
                            progressHandler: FileCopier.ProgressHandler?) async throws -> CompletionResult {
        let path = item.path.standardizedFileURL.path
        guard completingPaths.insert(path).inserted else { throw DataOperationSafety.Failure.occupied(path) }
        defer { completingPaths.remove(path) }
        try await completePreviousRestoreIfNeeded(item: item, externalBaseURL: externalBaseURL, progressHandler: progressHandler)
        let operationID = try await migrateRetainingOriginal(item: item, to: externalBaseURL, progressHandler: progressHandler)
        return await completeSuccessfulTransfer(operationID: operationID, direction: .migrate, progressHandler: progressHandler)
    }

    func restoreAndComplete(item: DataDirItem,
                            progressHandler: FileCopier.ProgressHandler?) async throws -> CompletionResult {
        try await completeInterruptedMigrationBeforeRestore(at: item.path, progressHandler: progressHandler)
        let path = item.path.standardizedFileURL.path
        guard completingPaths.insert(path).inserted else { throw DataOperationSafety.Failure.occupied(path) }
        defer { completingPaths.remove(path) }
        let operationID = try await restoreRetainingOriginal(item: item, progressHandler: progressHandler)
        return await completeSuccessfulTransfer(operationID: operationID, direction: .restore,
            progressHandler: progressHandler, requireUnchangedActive: false)
    }

    /// Low-level recovery callers may deliberately retain the verified original.
    func migrate(item: DataDirItem, to externalBaseURL: URL, progressHandler: FileCopier.ProgressHandler?) async throws {
        _ = try await migrateRetainingOriginal(item: item, to: externalBaseURL, progressHandler: progressHandler)
    }

    private func migrateRetainingOriginal(item: DataDirItem, to externalBaseURL: URL,
                                          progressHandler: FileCopier.ProgressHandler?, reusingOperationID: UUID? = nil) async throws -> UUID {
        await progressHandler?(.working(.preparing))
        let source = item.path.standardizedFileURL
        let destination = externalBaseURL.appendingPathComponent(source.lastPathComponent).standardizedFileURL
        try requirePolicy(source)
        guard !isSymbolicLink(at: source) else { throw DataDirError.destinationExists(source) }
        guard !DiskUtility.isMountPoint(source) else { throw DataOperationSafety.Failure.conflict(source.path) }
        guard try !entryExists(destination) else { throw DataDirError.destinationExists(destination) }
        try requireMarker(at: source, for: source, type: item.type, allowOwned: false)
        let restored = try completedRestoreLineage(at: source)
        try await safety.requireNewMigration(at: source, destination: destination,
            bundleIdentifier: item.associatedBundleIdentifier, ownedTransferIDs: Set(restored.map(\.operationID)))
        // Reject known permission failures before reserving a recovery record.
        // Directory creation still happens only after the durable intent below.
        let destinationVolumeUUID = try preflightWritePermission(at: externalBaseURL)
        let id = reusingOperationID ?? UUID()
        let candidate = externalBaseURL.appendingPathComponent(".appports-copy-\(id.uuidString)").standardizedFileURL
        let backup = source.deletingLastPathComponent().appendingPathComponent(".appports-migration-backup-\(source.lastPathComponent)-\(id)")
        var transfer = DataTransferRecord(operationID: id, mode: .symlink, direction: .migrate, sourceID: item.id,
            appName: item.associatedAppName ?? item.name, bundleIdentifier: item.associatedBundleIdentifier,
            dataDirType: item.type.rawValue, originalPath: source.path, activePath: source.path,
            destinationPath: destination.path, backupPath: backup.path,
            sourceIdentity: try DataPathIdentity.capture(source), destinationVolumeUUID: destinationVolumeUUID,
            priorOperationID: restored.last?.operationID)
        transfer.preparationPath = candidate.path
        try store.beginTransfer(transfer)
        runningMigrations.insert(id)
        defer { runningMigrations.remove(id) }
        do {
            try checkWritePermission(at: externalBaseURL)
            if let destinationVolumeUUID {
                try requireDestinationVolume(at: externalBaseURL, expected: destinationVolumeUUID)
            }
            transfer.phase = .copying
            try store.updateTransfer(transfer)
            let baseline = try await copy(from: source, to: candidate, final: destination, operationID: id, progress: progressHandler)
            transfer = try store.transfer(operationID: id) ?? transfer
            try requireMarker(at: source, for: source, type: item.type, allowOwned: false)
            transfer.baseline = try PropertyListEncoder().encode(baseline)
            transfer.phase = .verified
            try store.updateTransfer(transfer)
            try moveTree(candidate, to: destination)
            try syncDirectory(at: destination.deletingLastPathComponent())
            try installMarker(source: source, destination: destination, type: item.type, baseline: baseline)
            try syncTree(at: destination)
            await progressHandler?(.init(copiedBytes: baseline.logicalBytes, totalBytes: baseline.logicalBytes, currentFile: "正在切换本地入口...".localized, showsByteProgress: false, stage: .switching))
            try await safety.requireNoKnownWriters(at: source, bundleIdentifier: item.associatedBundleIdentifier)
            try requireIdentity(source, transfer.sourceIdentity)
            try requireMarker(at: source, for: source, type: item.type, allowOwned: false)
            try TreeCopySession.verifyUnchanged(at: source, against: baseline)
            try TreeCopySession.verifyCopy(at: destination, against: baseline)
            transfer.phase = .switching
            try store.updateTransfer(transfer)
            try moveTree(source, to: backup)
            try syncDirectory(at: source.deletingLastPathComponent())
            transfer.backupIdentity = try DataPathIdentity.capture(backup)
            try requireIdentity(backup, transfer.sourceIdentity)
            try store.updateTransfer(transfer)
            await progressHandler?(.init(copiedBytes: baseline.logicalBytes, totalBytes: baseline.logicalBytes, currentFile: "正在创建符号链接...".localized, showsByteProgress: false, stage: .switching))
            try requireMarker(at: backup, for: source, type: item.type, allowOwned: false)
            try TreeCopySession.verifyUnchanged(at: backup, against: baseline)
            do { try createSymbolicLink(at: source, withDestinationURL: destination) }
            catch {
                // The backup is still complete; never overwrite a competing entry during rollback.
                if try !entryExists(source) { try moveTree(backup, to: sou
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #77** (2026-10-18): **[BUG] 1.9.0升级1.9.1后 微信迁回本地失败**
  *Symptoms*: ### 问题描述 / Problem  1.9.0升级1.9.1后 微信迁回本地失败,只要是图标中带锁的应用都迁入本地失败。  ### 复现步骤 / Steps to Reproduce  无  ### 设备系统版本 / OS Version  macOS 27.0.1  ### 软件版本 / App Version  1.9.1  ### 诊断信息确认 / Diagnostics    - [x] 我已附上诊断包；如无法提供，已在下方说明原因。 / I attached a diagnostic package or explained why it is unavailable.  ### 诊断包 / Diagnostic Package  [AppPorts-Diagnostic-20261017-033531.zip](https://github.com/user-attachments/files/33570648/AppPorts-Diagnostic-20261017-033531.zip)  ### 外置存储设备类型 / External Storage Type  - [ ] NAS - [ ] 移动硬盘 / Portable External Drive - [x] 移动硬盘盒 / Drive Enclosure - [ ] 其他 / Other  ### 外置存储设备产品名 / External Storage Product Name  _No response_  ### 截图（可选） / Screenshots (Optional)  <img width="1700" height="1280" alt="Image" src="https://github.com/user-attachments/assets/6fa20fd5-f7cb-4b80-808a-82f67f1c0d0d" />  <img width="60" height="409" alt="Image" src="https://github.com/user-attachments/assets/b242cd87-7204-4c8d-8a43-40cc69629159" />  ### 日志（可选，仅在无诊断包时填写） / Logs (Optional, only if no diagnostic package)  ```shell  ```

- **Issue #67** (2026-10-15): **[BUG] 在macOS 26执行迁移后，部分App图标显示异常，重复显示**
  *Symptoms*: ### 问题描述 / Problem  部分App迁移后图标显示异常，如图  <img width="94" height="95" alt="Image" src="https://github.com/user-attachments/assets/88046496-1801-445c-b9cf-56871624a06d" />  <img width="890" height="623" alt="Image" src="https://github.com/user-attachments/assets/0f30cf8a-0629-4f14-a47a-5b6d9f70bc08" />  <img width="890" height="623" alt="Image" src="https://github.com/user-attachments/assets/b6d359c0-0b27-42d3-b71f-46934e11f310" />  <img width="890" height="623" alt="Image" src="https://github.com/user-attachments/assets/683bd84c-6cf0-4f6e-a262-d3d7aef56ac0" />  <img width="1012" height="764" alt="Image" src="https://github.com/user-attachments/assets/c7417b8d-aad7-47af-9b81-c7df495fce07" />  <img width="1069" height="1017" alt="Image" src="https://github.com/user-attachments/assets/0272ba7c-ffbc-4c89-9bd9-852a4df72b20" />  ### 复现步骤 / Steps to Reproduce  1，迁移App 2，打开Spotlight  ### 设备系统版本 / OS Version  macOS Tahoe 26.6.2 (25G83) x86_64  ### 软件版本 / App Version  1.9.0 (22)  ### 诊断信息确认 / Diagnostics  - [x] 我已附上诊断包；如无法提供，已在下方说明原因。 / I attached a diagnostic package or explained why it is unavailable.  ### 诊断包 / Diagnostic Package  [AppPorts-Diagnostic-20261005-140721.zip](https://github.com/user-attachments/files/33044661/AppPorts-Diagnostic-20261005-140721.zip)  ### 外置存储设备类型 / External Storage Type  - [ ] NAS - [ ] 移动硬盘 / Portable External Drive - [ ] 移动硬盘盒 / Drive Enclosure - [x] 其他 / Other  ### 外置存储设备产品名 / External Storage Product Name  内置硬盘：WD10EZEX  ### 截图（可选） / Screenshots (Optio

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

### Incident Patch 1: `66d8f7cd` (2026-10-18)
**Commit Message**: fix: clear update protection locks on any app location change

1.9.0 locked every self-updating external copy with `chflags -R uchg` and
recorded nothing, so 1.9.1 saw those bits as a user's own lock and failed
closed before copying. Restoring such an app reported "无法完整保留此项目的
内容或权限" and left a journal that repeated the same error forever.

Every attempt to prove which bits AppPorts wrote blocks real restores: an
app that was updated or repaired after being locked keeps some flags and
loses others, so a tree can end up locked only at its root or only in
places. A location change now records and clears the immutable bit over the
whole tree, whatever shape it has. The record is still written before any
flag changes so an interruption can reapply exactly those bits; only
`UF_IMMUTABLE` is attributed, every other flag still fails closed.

Also records a replaced target's baseline before any content moves, and
persists it, so a resume can never face a record whose only outcome is the
refusal on the next attempt.

**File**: `AppPorts/Models/AppTransferRecord.swift` (modified, +23/-0)
```diff
@@ -108,6 +108,29 @@ struct AppTransferRecord: Codable, Identifiable, Sendable {
     }
 }
 
+/// Resume verifies against recorded manifests. A journal whose manifest was lost
+/// (v1.9.1 removed manifests before its record) can never be verified again, so
+/// every caller must hear that instead of a raw file error. Reported as one
+/// actionable message; the caller decides whether to retry or end the record.
+enum AppTransferJournalIntegrity {
+    static func missingManifests(for record: AppTransferRecord, store: AppTransferStore) -> Bool {
+        var required = record.hasCandidateBaseline ? ["candidate"] : []
+        if record.hasSourceBaseline { required.append("source") }
+        if record.hasExistingDestinationBaseline { required.append("existing") }
+        for item in record.cleanupItems where !item.completed { required.append(item.baselineName) }
+        // Legacy portals embed their baseline in the record itself, so they never
+        // require a manifest file and must not be reported as missing here.
+        return Set(required).contains { (try? store.baseline($0, operationID: record.operationID)) == nil }
+    }
+
+    static func requireVerifiedManifests(for record: AppTransferRecord, store: AppTransferStore) throws {
+        guard missingManifests(for: record, store: store) else { return }
+        throw AppTransferTransaction.failure("这条记录缺少校验清单，无法再次验证副本。".localized
+            + "\n" + "已保留的内容需要你确认；可以结束这条记录并保留所有副本，再重新发起操作。".localized,
+            at: URL(fileURLWithPath: record.activeDestinationPath))
+    }
+}
+
 struct AppTransferActivation: Codable, Equatable, Sendable {
     let operationID: UUID
     let path: String
```

**File**: `AppPorts/Services/AppTransferStore.swift` (modified, +108/-6)
```diff
@@ -151,16 +151,49 @@ final class AppTransferStore: @unchecked Sendable {
     func remove(_ id: UUID) throws {
         lock.lock(); defer { lock.unlock() }
         try recheckWriterAdmission()
-        // Delete manifests first. A record is only removed after all effects
-        // have completed; a retry of its final bookkeeping does not need them.
-        for url in try FileManager.default.contentsOfDirectory(at: directoryURL, includingPropertiesForKeys: nil)
-        where url.lastPathComponent.hasPrefix(id.uuidString + "-") && url.pathExtension == "manifest" {
-            try FileManager.default.removeItem(at: url)
-        }
+        // The record is the authority. Removing it first makes a retry of this
+        // bookkeeping harmless: leftover manifests are ignored by every reader,
+        // while a record that outlived its manifests could never be verified or
+        // completed again and would keep blocking its paths forever.
         let url = recordURL(id)
         if try Self.exists(url) { try FileManager.default.removeItem(at: url) }
+        try removeManifests(id)
+        try DurableFileIO.syncDirectory(at: directoryURL)
+        NotificationCenter.default.post(name: .appPortsRecordsDidChange, object: nil)
+    }
+
+    /// Archive only bookkeeping: the journal and its manifests leave the live
+    /// directory, so the operation stops owning its paths. Applications,
+    /// retained copies and staging objects are deliberately left untouched and
+    /// remain the user's to inspect. Callers decide when work is unrecoverable.
+    @discardableResult
+    func archive(_ id: UUID) throws -> URL? {
+        lock.lock(); defer { lock.unlock() }
+        try recheckWriterAdmission()
+        let recordURL = recordURL(id)
+        let recordExists = try Self.exists(recordURL)
+        let manifests = try manifestURLs(id)
+        guard recordExists || !manifests.isEmpty else { return nil }
+        let archive = directoryURL.appendingPathComponent("archived", isDirectory: true)
+        try FileManager.default.createDirectory(at: archive, withIntermediateDirectories: true)
+        for url in [recordURL] + manifests where try Self.exists(url) {
+            try FileManager.default.moveItem(at: url, to: archive.appendingPathComponent(url.lastPathComponent))
+        }
+        try DurableFileIO.syncDirectory(at: archive)
         try DurableFileIO.syncDirectory(at: directoryURL)
         NotificationCenter.default.post(name: .appPortsRecordsDidChange, object: nil)
+        return archive
+    }
+
+    private func manifestURLs(_ id: UUID) throws -> [URL] {
+        guard try Self.exists(directoryURL) else { return [] }
+        return try FileManager.default.contentsOfDirectory(at: directoryURL, includingPropertiesForKeys: nil)
+            .filter { $0.lastPathComponent.hasPrefix(id.uuidString + "-") && $0.pathExtension == "manifest" }
+            .sorted { $0.path < $1.path }
+    }
+
+    private func removeManifests(_ id: UUID) throws {
+        for url in try manifestURLs(id) { try FileManager.default.removeItem(at: url) }
     }
 
     private func prepareDirectory() throws {
@@ -202,6 +235,29 @@ struct AppUpdateProtectionRelocation: Codable, Equatable, Sendable {
     let path: String
     let identity: DataPathIdentity
     let entries: [Entry]
+    /// Old records written before 1.9.1 decode without this field and mean
+    /// `.managed`. Only adoption of a v1.9.0 `chflags -R uchg` tree sets it.
+    var adoptedLegacyLock: Bool? = nil
+
+    /// Why AppPorts believes it may revoke the immutable bits listed above.
+    var origin: AppUpdateProtectionOrigin { adoptedLegacyLock == true ? .adoptedV1_9_0 : .managed }
+}
+
+/// `managed` records name bits AppPorts set itself. `adoptedV1_9_0` records name
+/// bits v1.9.0 set with `chflags -R uchg` and never recorded; the transfer still
+/// only ever clears the immutable bit, never other flags.
+enum AppUpdateProtectionOrigin: Equatable, Sendable {
+    case managed
+    case adoptedV1_9_0
+}
+
+/// What the caller knows about the object it is about to move. Kept only for
+/// logging: locking is AppPorts' own bookkeeping, so a move always clears it.
+struct AppUpdateProtectionAdoption: Sendable {
+    /// A local entry AppPorts created still resolves to this exact object.
+    let managedLocalEntry: URL?
+    /// The incoming source is provably the same application.
+    let sameApplicationSource: URL?
 }
 
 struct AppUpdateProtectionRecordIssue: Identifiable, Sendable {
@@ -371,6 +427,52 @@ final class AppUpdateProtectionStore {
         return true
     }
 
+    /// The update lock is AppPorts' own protection, and 1.9.0 wrote it with
+    /// `chflags -R uchg` without recording anything. Every attempt to tell those
+    /// bits from a user's own lock ends up blocking ordinary restores, because a
+    /// bundle that was updated or repaired after 1.9.0 locked it keeps some flags
+    /// and loses others. So a move clears the im
```

**File**: `AppPorts/Services/AppTransferTransaction.swift` (modified, +54/-5)
```diff
@@ -94,6 +94,9 @@ final class AppTransferTransaction {
             if pending.sourcePath == source.path && pending.destinationPath == destination.path {
                 if !pending.isSwitchComplete
                     || (pending.successorActivation == nil && (try? observeActivation(pending)) == true) {
+                    // A resume would fail on its first manifest read with a raw
+                    // file error; report the actionable reason instead.
+                    try AppTransferJournalIntegrity.requireVerifiedManifests(for: pending, store: store)
                     return try await resume(pending.operationID, progress: progress)
                 }
             }
@@ -183,7 +186,27 @@ final class AppTransferTransaction {
         let journal = Journal(record, store: store)
         do {
             try checkpoint(.intentSaved, journal)
+            // Suspend only the protection bits first: a locked tree cannot be
+            // walked for a baseline, so this must precede every read. The tokens
+            // for it are already durable in the record.
             try suspendPreparationProtection(journal)
+            // With flags suspended, everything that reads the tree happens now.
+            // The replaced target's baseline in particular must be durable before
+            // any content moves: a resume cannot tell its authorized contents from
+            // later writes to the same inode, so it would have to refuse, and
+            // refusing with a copy already in flight strands both sides.
+            if existing {
+                do {
+                    try store.writeBaseline(try captureBaseline(destination), named: "existing", operationID: id)
+                } catch {
+                    // Nothing was copied yet: end this intent instead of leaving a
+                    // record whose only outcome is the refusal on the next attempt.
+                    throw Self.failure("无法记录替换目标的初始状态，本次操作尚未开始，未改动任何一方：".localized
+                        + error.localizedDescription, at: destination)
+                }
+                journal.record.hasExistingDestinationBaseline = true
+                try journal.save()
+            }
             for relative in record.applicationPaths {
                 let url = relative.isEmpty ? source : source.appendingPathComponent(relative)
                 let valid = try signatureIsValid(at: url)
@@ -192,10 +215,6 @@ final class AppTransferTransaction {
                 }
                 journal.record.signatureChecks[relative] = valid
             }
-            if existing {
-                try store.writeBaseline(try captureBaseline(destination), named: "existing", operationID: id)
-                journal.record.hasExistingDestinationBaseline = true
-            }
             try journal.save()
             return try await continueTransfer(journal, progress: progress)
         } catch { return try handle(error, journal: journal) }
@@ -253,6 +272,7 @@ final class AppTransferTransaction {
 
     func resume(_ id: UUID, progress: FileCopier.ProgressHandler?) async throws -> AppTransferResult {
         let journal = Journal(try store.record(id), store: store)
+        try AppTransferJournalIntegrity.requireVerifiedManifests(for: journal.record, store: store)
         if journal.record.phase == .cancelled { return try reconcileCancelled(journal) }
         do { return try await continueTransfer(journal, progress: progress) }
         catch { return try handle(error, journal: journal) }
@@ -451,6 +471,7 @@ final class AppTransferTransaction {
     }
 
     private func captureProtectionRecovery(for record: AppTransferRecord) throws -> AppTransferProtectionRecovery {
+        try adoptLegacyLockIfNeeded(for: record)
         let source = URL(fileURLWithPath: record.sourcePath)
         try requireIdentity(record.sourceIdentity, at: source)
         let sourceToken = try protection.captureForExchange(at: source)
@@ -467,8 +488,36 @@ final class AppTransferTransaction {
         return recovery
     }
 
+    /// v1.9.0 locked external copies with `chflags -R uchg` and recorded nothing,
+    /// so 1.9.1 saw those bits as somebody else's and the verified copier failed
+    /// closed on them. Only a restore needs this: a migration reads the local app,
+    /// which AppPorts never locks. Record the whole tree's immutable bits first,
+    /// then clear them through the normal suspension path.
+    private func adoptLegacyLockIfNeeded(for record: AppTransferRecord) throws {
+        guard record.direction == .restore else { return }
+        let source = URL(fileURLWithPath: record.sourcePath)
+        // The root is not a reliable indicator: an app that was updated after
+        // being locked can have an unlocked root with locked children. Record the
+        // whole tree whenever anything in it is still locked.
+        let destination = URL(fileURLWithPath: record.destinationPath)
+        _ = try protection.adoptLegacyLock(so
```

---

### Incident Patch 2: `1c6eae1f` (2026-10-18)
**Commit Message**: fix: copy transparently compressed files as their logical content

macOS compresses installed files on its own (`UF_COMPRESSED`), notably App
Store executables and idle binaries. The verified copier read physical
extents with SEEK_DATA/SEEK_HOLE, but for a compressed file those describe
the compressed stream and SEEK_DATA returns ENXIO, so the whole file looked
like a hole. The copy then held compressed bytes, verification failed, and a
single such file blocked migrating an entire application — a 572 MB app
failed over one GPU helper.

`UF_COMPRESSED` is now accepted and such sources skip the extent fast path,
reading sequentially so the kernel decodes them like any ordinary read. The
flag itself is not replayed, so the destination holds the logical bytes.
Every other flag still fails closed. Verified against a real 572 MB app:
the copied helper's hash matches the original and it stays executable.

**File**: `AppPorts/Utils/FileDataCopyStream.swift` (modified, +8/-1)
```diff
@@ -20,13 +20,20 @@ struct FileDataCopyStream {
     private var finished = false
     private(set) var usesExtentFallback = false
 
+    /// A transparently compressed file (UF_COMPRESSED) stores a compressed
+    /// data stream, and SEEK_DATA/SEEK_HOLE describe those physical extents.
+    /// Reading them positionally hands back compressed bytes, so the logical
+    /// content never arrives and verification fails. Such files take the plain
+    /// sequential path, which decodes on read like any ordinary read(2).
     init(from source: Int32, to destination: Int32, size: Int64, path: String,
-         extentSeek: @escaping ExtentSeek = { lseek($0, $1, $2) }) {
+         extentSeek: @escaping ExtentSeek = { lseek($0, $1, $2) },
+         isCompressed: Bool = false) {
         self.source = source
         self.destination = destination
         self.size = size
         self.path = path
         self.extentSeek = extentSeek
+        usesExtentFallback = isCompressed
         buffer = [UInt8](repeating: 0, count: max(1, min(Self.bufferByteCount, Int(clamping: size))))
     }
 
```

**File**: `AppPorts/Utils/TreeCopySession.swift` (modified, +16/-4)
```diff
@@ -755,6 +755,9 @@ actor TreeCopySession {
         try assertStable(before, try status(fd), path: path)
         DataTransferSession.current?.didReadContent(bytes: (kind == .file ? before.st_size : 0) + (resourceFork?.size ?? 0))
         return TreeCopySnapshot.Entry(path: path, kind: kind, identity: identity(before), mode: before.st_mode & 0o7777,
+                                      // `UF_COMPRESSED` is storage detail, not content: the
+                                      // destination is written uncompressed, so replaying it
+                                      // would both fail to apply and break verification.
                                       uid: before.st_uid, gid: before.st_gid, flags: before.st_flags & UInt32(UF_HIDDEN | UF_NODUMP),
                                       birthTime: timestamp(before.st_birthtimespec), modificationTime: timestamp(before.st_mtimespec),
                                       extendedAttributes: attributes, resourceFork: resourceFork, acl: acl, size: kind == .file ? before.st_size : 0,
@@ -861,7 +864,12 @@ actor TreeCopySession {
     nonisolated private static func copyData(from source: Int32, to destination: Int32, size: Int64, path: String,
                                            extentSeek: @escaping ExtentSeek,
                                            progress: @Sendable (Int64) async -> Void) async throws {
-        var stream = FileDataCopyStream(from: source, to: destination, size: size, path: path, extentSeek: extentSeek)
+        // Pass the source's compression state so the stream decodes instead of
+        // copying physical extents (see FileDataCopyStream.init).
+        var info = stat()
+        let compressed = fstat(source, &info) == 0 && info.st_flags & UInt32(UF_COMPRESSED) != 0
+        var stream = FileDataCopyStream(from: source, to: destination, size: size, path: path,
+                                        extentSeek: extentSeek, isCompressed: compressed)
         while let offset = try stream.copyNextChunk() {
             // Preserve the verified data copier's existing progress behavior:
             // fallback files yield between chunks; native extents report once
@@ -1078,9 +1086,13 @@ actor TreeCopySession {
     nonisolated private static func validateFlags(_ value: stat, path: String) throws {
         // Validate before opening: opening a dataless item can hydrate it, and
         // opening an unsupported compression representation can alter flags.
-        // Compressed files fail closed until logical resource-fork handling is
-        // independently verified. Physical compression is not copied blindly.
-        let supported = UInt32(UF_HIDDEN | UF_NODUMP)
+        // `UF_COMPRESSED` is accepted: macOS compresses installed files on its
+        // own (App Store executables, idle binaries), and a decmpfs stream is
+        // decoded by an ordinary read. The data stream below reads such files
+        // sequentially instead of trusting physical extents, and the flag is not
+        // replayed, so the copy is stored as its logical bytes. Every other flag
+        // still fails closed.
+        let supported = UInt32(UF_HIDDEN | UF_NODUMP | UF_COMPRESSED)
         guard value.st_flags & ~supported == 0 else { throw TreeCopyError.unsupportedMetadata(path) }
     }
     nonisolated private static func contains(_ root: String, _ path: String) -> Bool { path == root || path.hasPrefix(root == "/" ? "/" : root + "/") }
```

---

### Incident Patch 3: `534d9b70` (2026-10-18)
**Commit Message**: fix: retire unrecoverable transfer journals instead of asking the user

A journal whose manifest is gone, whose external object was replaced, or
whose attempt already ended can never advance, yet it keeps its paths
blocked and maintenance retried it on every launch. The first attempt at
this surfaced a panel asking the user to choose between retry, cancel and
end — but a committed transfer can neither be cancelled nor safely ended,
so the panel offered two buttons that could only fail.

Both outcomes are AppPorts' own bookkeeping and neither needs information
only the user has. Maintenance now retries everything that can still
advance, then archives the rest to `app-transfers/archived/`, moving only
the record and its manifests; every application, retained copy and staging
object stays where it is. A committed transfer is never retired, because
its remaining work is deleting a copy under its own verified manifest.

`remove` now deletes the record before its manifests: the record is the
authority, and the old order left records that could never be verified or
completed again.

**File**: `AppPorts/Services/AppMigrationService.swift` (modified, +114/-5)
```diff
@@ -114,6 +114,15 @@ struct AppMigrationService {
         return operationLock
     }
 
+    /// The object at a path is still the recorded filesystem object. Used after
+    /// adoption, where reading and rewriting protection facts must not span a
+    /// replacement or a remount.
+    private func requireIdentity(_ expected: DataPathIdentity, at url: URL) throws {
+        guard try expected.matchesFilesystemObject(DataPathIdentity.capture(url)) else {
+            throw AppTransferTransaction.failure("路径对应的对象或磁盘已改变，已保留内容。".localized, at: url)
+        }
+    }
+
     private func recheckWriterAdmission() throws {
         if let writerAdmissionCheck { try writerAdmissionCheck() }
         else { try transferStore.recheckWriterAdmission() }
@@ -256,12 +265,16 @@ struct AppMigrationService {
             throw Exclusion.failure("无法确认真实应用身份，未更改存储位置。".localized)
         }
         let protection = AppUpdateProtectionStore(transferStore: transferStore)
+        // The lock is AppPorts' own, and older versions never recorded it. Record
+        // what is locked here so the relocation can suspend and restore exactly
+        // those bits; a tree with no lock simply has nothing to record.
+        let identityBeforeAdoption = try DataPathIdentity.capture(source)
+        _ = try protection.adoptLegacyLock(source, evidence: .init(
+            managedLocalEntry: localURLs.sorted(by: { $0.path < $1.path })
+                .first { localPortalKind(at: $0, linkedTo: source) != nil },
+            sameApplicationSource: nil))
+        try requireIdentity(identityBeforeAdoption, at: source)
         let protectionRelocation = try protection.captureForExchange(at: source)
-        let sourceFlags = try SignatureSnapshot.info(at: source).st_flags
-        if sourceFlags & UInt32(UF_IMMUTABLE) != 0,
-           protectionRelocation?.entries.contains(where: { $0.relativePath.isEmpty }) != true {
-            throw AppTransferTransaction.failure("应用更新保护来源无法确认。".localized, at: source)
-        }
         let signatureRelocation = try signatureFactStore.captureRelocation(from: source, transferStore: transferStore)
         var portals: [Exclusion.Journal.Portal] = []
         var kinds: [URL: LocalPortalKind] = [:]
@@ -503,6 +516,12 @@ struct AppMigrationService {
         } else { confirmedReplacement = nil }
         let mayReplace = externalTargetReplacementReason(for: appToMove, destinationURL: destinationURL) != nil
             || confirmedReplacement != nil
+        // Re-migrating over a v1.9.0-locked external copy needs the same adoption
+        // as a restore: without a provenance record the replacement's copy step
+        // fails closed on the very lock this app already carries.
+        if confirmedReplacement != nil {
+            try adoptLegacyLockOnReplacement(of: appToMove.path, at: destinationURL)
+        }
         let kind: LocalPortalKind = portalCreationOverride != nil ? .wholeAppSymlink
             : appToMove.usesFolderOperation ? .folderMirror : preferredPortalKind(for: appToMove.path)
         let result = try await transferTransaction().start(app: appToMove, destination: destinationURL, direction: .migrate,
@@ -515,6 +534,18 @@ struct AppMigrationService {
         return result
     }
 
+    /// A retained external copy still carries AppPorts' update lock and is about
+    /// to be replaced by a verified copy of the same application. Record what is
+    /// locked so the replacement's removal step can proceed.
+    private func adoptLegacyLockOnReplacement(of sourceURL: URL, at destinationURL: URL) throws {
+        guard (try? SignatureSnapshot.info(at: destinationURL).st_flags & UInt32(UF_IMMUTABLE)) ?? 0 != 0 else { return }
+        let protection = AppUpdateProtectionStore(transferStore: transferStore)
+        let identity = try DataPathIdentity.capture(destinationURL)
+        _ = try protection.adoptLegacyLock(destinationURL, evidence: .init(managedLocalEntry: nil,
+            sameApplicationSource: sourceURL))
+        try requireIdentity(identity, at: destinationURL)
+    }
+
     private func needsUpdateProtection(_ app: AppItem) -> Bool {
         if !app.usesFolderOperation { return needsUchgLock(at: app.path) }
         return ((try? fileManager.contentsOfDirectory(at: app.path, includingPropertiesForKeys: nil)) ?? [])
@@ -562,6 +593,84 @@ struct AppMigrationService {
         return try transferTransaction().cancel(operationID)
     }
 
+    /// What maintenance should do with one journal. A record that can still
+    /// advance is retried; one whose facts already contradict the disk cannot
+    /// advance, so it is retired automatically.
+    enum TransferRetryDisposition: Sendable {
+        case retry
+        /// Retrying cannot change the outcome. The caller retires the record
+        /// itself — it is never handed to the user as a task.
+        case terminal(String)
+
+        var isTerminal: Bool {
+            if case .terminal = self { return true }
+   
```

**File**: `AppPorts/Services/OperationMaintenance.swift` (modified, +6/-0)
```diff
@@ -43,12 +43,18 @@ actor OperationMaintenance {
         do {
             let inventory = try applications.pendingTransferInspection()
             warnings += inventory.issues.map(\.message)
+            // Retry everything that can still advance, then close out whatever
+            // provably cannot. Both are AppPorts' own bookkeeping: a stuck record
+            // keeps its paths blocked, so leaving it for the user would hand them
+            // a state they cannot act on and an app they cannot operate.
             for record in inventory.records {
+                guard !applications.retryDisposition(for: record).isTerminal else { continue }
                 do {
                     let result = try await applications.retryTransfer(operationID: record.operationID)
                     if let message = result.pendingMessage { warnings.append(message) }
                 } catch { warnings.append(record.appName + ": " + error.localizedDescription) }
             }
+            warnings += applications.retireUnrecoverableTransfers()
         } catch { warnings.append(error.localizedDescription) }
         // Signature work acquires its own locks, after data/app locks release.
         warnings += await CodeSigner().performAutomaticMaintenance()
```

#### Recent Merged Pull Requests:
- **PR #85** (2026-10-19): feat: warn when restoring a bundle that was already degraded on its volume (@wzh4869)
- **PR #84** (closed): feat: warn when restoring a bundle that was already degraded on its volume (@wzh4869)
- **PR #83** (2026-10-19): feat: relax app bundle migration to a product-integrity copy profile (@wzh4869)
- **PR #76** (2026-10-14): docs: add Agent Notes guide and Codex skill discovery (@wzh4869)
- **PR #75** (2026-10-14): docs: vendor Agent Notes skill and migrate decision records (@wzh4869)
- **PR #74** (2026-10-08): docs: resolve GitBook cross-space links and anchors (@wzh4869)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. clear update protection locks on any app location change

**RULE**:
When implementing operations in `AppPorts/Models/AppTransferRecord.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in wzh4869/AppPorts. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `66d8f7cd`: clear update protection locks on any app location change. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `AppPorts/Models/AppTransferRecord.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
/// Resume verifies against recorded manifests. A journal whose manifest was lost
/// (v1.9.1 removed manifests before its record) can never be verified again, so
/// every caller must hear that instead of a raw file error. Reported as one
/// actionable message; the caller decides whether to retry or end the record.
enum AppTransferJournalIntegrity {
    static func missingManifests(for record: AppTransferRecord, store: AppTransferStore) -> Bool {
        var required = record.hasCandidateBaseline ? ["candidate"] : []
        if record.hasSourceBaseline { required.append("source") }
        if record.hasExistingDestinationBaseline { required.append("existing") }
        for item in record.cleanupItems where !item.completed { required.append(item.baselineName) }
        // Legacy portals embed their baseline in the record itself, so they never
        // require a manifest file and must not be reported as missing here.
        return Set(required).contains { (try? store.baseline($0, operationID: record.operationID)) == nil }
    }

    static func requireVerifiedManifests(for record: AppTransferRecord, store: AppTransferStore) throws {
        guard missingManifests(for: record, st
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `66d8f7cd` are properly handled with clean fallback behavior.
