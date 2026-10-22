> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/wzh4869-appports-learnings.md`  
> **Source**: github ([https://github.com/wzh4869/AppPorts](https://github.com/wzh4869/AppPorts))  
> **Source Version**: `5a36d344`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-22T19:22:41.171Z  
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
> **Harvest Timestamp**: 2026-10-22T19:22:41.163Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wzh4869/AppPorts`
- **Description**: 📦 A macOS utility to seamlessly migrate applications to external storage and reclaim local disk space.【一款 macOS 工具，无缝迁移应用到外部存储并自动建立链接，释放宝贵的本地空间】
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2144 stars

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

### Core Architecture Module: `AppPorts/Models/VolumeStateClass.swift`
```
import Foundation

/// Stable diagnostic codes. No classification authorizes deletion or adoption.
enum VolumeStateClass: String, CaseIterable, Sendable {
    case normal = "A", pendingMount = "B", volumeMissing = "C", pendingCleanup = "D"
    case interrupted = "E", rolledBack = "F", legacyBackup = "G"
    case orphanIdentified = "H", orphanUnidentified = "I", unreadable = "J"
}

enum InterruptedResidueKind: String, Sendable {
    case entryAvailable = "E1", awaitingRecovery = "E2"
}

struct VolumeStateFinding: Equatable, Sendable {
    let state: VolumeStateClass
    let originalPath: String
    let volumeUUID: String?
    var residue: InterruptedResidueKind? = nil
    var detail: String? = nil
}

struct VolumeStateInventory: Equatable, Sendable {
    let findings: [VolumeStateFinding]
    let scannedAt: Date
    let complete: Bool

    var counts: [VolumeStateClass: Int] {
        findings.reduce(into: [:]) { $0[$1.state, default: 0] += 1 }
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
    @Published private var migrationCount = 0
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

    var isBusy: Bool { activeOperation != nil || migrationCount > 0 }
    var blocksInteraction: Bool { activeOperation != nil }

    func setMigrationCount(_ count: Int) {
        let wasBusy = isBusy
        migrationCount = count
        if wasBusy && !isBusy { recordsRevision &+= 1 }
    }

    func begin() -> UUID? {
        guard !isBusy, terminationReply == nil else { return nil }
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
        MigrationTaskCenter.shared.schedule()
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

### Core Architecture Module: `AppPorts/Services/VolumeStateClassifier.swift`
```
import Darwin
import Foundation

/// Observation only. The operation services retain their own locks, identity
/// checks and content proofs; this snapshot can become stale immediately.
struct VolumeStateClassifier: Sendable {
    struct Volume: Sendable {
        let uuid: String
        let name: String
        let mountPoint: String?
        let locked: Bool
    }

    struct Snapshot: Sendable {
        let volumes: [String: Volume]
        var complete = true
    }

    enum PathState: Sendable {
        case missing, unreadable, other, placeholder
        case directory(DataPathIdentity)
    }

    var observe: @Sendable (URL) -> PathState = { VolumePathProbe.observe($0) }
    var markerMatches: @Sendable (URL, String) -> Bool = { root, uuid in
        VolumePathProbe.markerMatches(root, uuid: uuid)
    }

    func classify(_ transfer: DataTransferRecord, snapshot: Snapshot) -> VolumeStateFinding {
        let uuid = transfer.direction == .migrate ? transfer.createdVolumeUUID : transfer.sourceIdentity.volumeUUID
        func finding(_ state: VolumeStateClass, _ residue: InterruptedResidueKind? = nil,
                     _ detail: String? = nil) -> VolumeStateFinding {
            .init(state: state, originalPath: transfer.originalPath, volumeUUID: uuid, residue: residue, detail: detail)
        }
        guard snapshot.complete else { return finding(.unreadable, nil, "inventory_unavailable") }
        let volume = uuid.flatMap { snapshot.volumes[$0.uppercased()] }
        let mountedAtOriginal = snapshot.volumes.values.first { $0.mountPoint == transfer.originalPath }
        if let mountedAtOriginal, mountedAtOriginal.uuid.caseInsensitiveCompare(uuid ?? "") != .orderedSame {
            return finding(.unreadable, nil, "unexpected_mounted_volume")
        }
        if volume?.locked == true && !(transfer.isDataSwitchComplete && transfer.direction == .restore) {
            return finding(.pendingMount, nil, "waiting_for_unlock")
        }
        for path in Set([transfer.backupPath, transfer.stagingPath, transfer.preparationPath].compactMap { $0 }) {
            if case .unreadable = observe(URL(fileURLWithPath: path)) {
                return finding(.unreadable, nil, "material_path_unreadable")
            }
        }
        let original = observe(URL(fileURLWithPath: transfer.originalPath))
        if case .unreadable = original { return finding(.unreadable, nil, "entry_unreadable") }
        if let mountedAtOriginal {
            guard let uuid, mountedAtOriginal.uuid.caseInsensitiveCompare(uuid) == .orderedSame,
                  transfer.direction == .migrate || !transfer.isDataSwitchComplete else {
                return finding(.unreadable, nil, "unexpected_mounted_volume")
            }
            guard case .directory(let identity) = original else { return finding(.unreadable, nil, "entry_unreadable") }
            if transfer.direction == .restore, transfer.sourceIdentity.matchesFilesystemObject(identity) {
                return transfer.rollbackCompletedAt == nil ? finding(.interrupted, .entryAvailable) : finding(.rolledBack)
            }
            return transfer.isDataSwitchComplete ? finding(.pendingCleanup)
                : finding(.interrupted, .awaitingRecovery, "entry_commit_or_restore_pending")
        }
        if transfer.isDataSwitchComplete, transfer.direction == .migrate {
            return finding(volume == nil ? .volumeMissing : .pendingMount, nil, "volume_not_at_entry")
        }
        if transfer.isDataSwitchComplete {
            guard case .directory(let identity) = original,
                  transfer.destinationIdentity?.matchesFilesystemObject(identity) == true else {
                return finding(.unreadable, nil, "restored_entry_not_confirmed")
            }
            return finding(.pendingCleanup)
        }
        let available: Bool
        if transfer.direction == .migrate, case .directory(let identity) = original {
            available = transfer.sourceIdentity.matchesFilesystemObject(identity)
        } else {
            available = false
        }
        if available {
            return transfer.rollbackCompletedAt == nil ? finding(.interrupted, .entryAvailable) : finding(.rolledBack)
        }
        // A placeholder, a replacement inode or a vanished entry never means
        // recovery is finished, regardless of the persisted phase.
        return finding(.interrupted, .awaitingRecovery, "entry_recovery_required")
    }

    func inventory(_ records: ContainerMountStore.Inspection, snapshot: Snapshot, now: Date = Date()) -> VolumeStateInventory {
        var findings = records.transfers.filter { $0.mode == .mount }.map { classify($0, snapshot: snapshot) }
        var known: Set<String> = []
        func remember(_ uuid: String?) { if let uuid { known.insert(uuid.uppercased()) } }
        for transfer in records.transfers where transfer.mode == .mount {
            remember(transfer.createdVolumeUUID)
            remember(transfer.sourceIdentity.volumeUUID)
            remember(transfer.recoveryMountRecord?.volumeUUID)
        }
        for record in records.mounts {
            remember(record.volumeUUID)
            let volume = snapshot.volumes[record.volumeUUID.uppercased()]
            let entry = observe(record.mountPointURL)
            let state: VolumeStateClass
            var detail: String?
            let occupant = snapshot.volumes.values.first { $0.mountPoint == record.mountPointPath }
            if !snapshot.complete { state = .unreadable }
            else if let occupant, occupant.uuid.caseInsensitiveCompare(record.volumeUUID) != .orderedSame {
                state = .unreadable; detail = "unexpected_mounted_volume"
            }
            else if case .unreadable = entry { state = .unreadable; detail = "entry_unreadable" }
            else if volume?.locked == true { state = .pendingMount; detail = "waiting_for_unlock" }
            else if volume == nil { state = .volumeMissing; detail = "volume_unavailable_not_proven_deleted" }
            else if volume?.mountPoint == record.mountPointPath {
                if case .directory = entry { state = .normal }
                else { state = .unreadable }
            } else { state = .pendingMount }
            findings.append(.init(state: state, originalPath: record.mountPointPath, volumeUUID: record.volumeUUID, detail: detail))
        }
        for cleanup in records.cleanups {
            remember(cleanup.mountRecord.volumeUUID)
            let unreadable = [cleanup.localPath, cleanup.mountRecord.mountPointPath, cleanup.restoreStagingPath].compactMap { $0 }.contains {
                if case .unreadable = observe(URL(fileURLWithPath: $0)) { return true }
                return false
            }
            findings.append(.init(state: !snapshot.complete || unreadable ? .unreadable : cleanup.restoreStagingPath != nil ? .interrupted
                : cleanup.kind == .migrationBackup ? .legacyBackup : .pendingCleanup,
                originalPath: cleanup.mountRecord.mountPointPath, volumeUUID: cleanup.mountRecord.volumeUUID,
                residue: cleanup.restoreStagingPath == nil || unreadable || !snapshot.complete ? nil : .awaitingRecovery))
        }
        for material in records.preservedMaterials where material.mode == .mount {
            remember(material.volumeUUID)
            remember(material.recoveryRecord?.sourceIdentity.volumeUUID)
            remember(material.recoveryRecord?.recoveryMountRecord?.volumeUUID)
            var finding = material.recoveryRecord.map { classify($0, snapshot: snapshot) }
                ?? .init(state: .unreadable, originalPath: material.originalPath, volumeUUID: material.volumeUUID)
            finding.detail = "preserved_material"
            findings.append(finding)
        }
        for volume in snapshot.volumes.values.sorted(by: { $0.uuid < $1.uuid })
            where !known.contains(volume.uuid.uppercased()) && volume.name.hasPrefix("AppPorts-") {
            let state: VolumeStateClass
            if !snapshot.complete { state = .unreadable }
            else if let path = volume.mountPoint {
                switch observe(URL(fileURLWithPath: path)) {
                case .directory:
                    state = markerMatches(URL(fileURLWithPath: path), volume.uuid) ? .orphanIdentified : .orphanUnidentified
                default: state = .unreadable
                }
            } else { state = .orphanUnidentified }
            findings.append(.init(state: state, originalPath: volume.mountPoint ?? "", volumeUUID: volume.uuid,
                                  detail: volume.locked ? "waiting_for_unlock" : "report_only"))
        }
        if !snapshot.complete || records.validationError != nil {
            findings.append(.init(state: .unreadable, originalPath: "", volumeUUID: nil,
                                  detail: records.validationError == nil ? "inventory_unavailable" : "journal_invalid"))
        }
        return .init(findings: findings, scannedAt: now, complete: snapshot.complete && records.validationError == nil)
    }
}

enum VolumePathProbe {
    static func observe(_ url: URL) -> VolumeStateClassifier.PathState {
        var info = stat()
        guard lstat(url.path, &info) == 0 else { return errno == ENOENT ? .missing : .unreadable }
        guard info.st_mode & S_IFMT == S_IFDIR else { return .other }
        guard info.st_mode & 0o777 != 0 else { return .placeholder }
        guard isReadableDirectory(url), let identity = try? DataPathIdentity.capture(url) else { return .unreadable }
        return .directory(identity)
    }

    static func isReadableDirectory(_ url: URL) -> Bool {
        let fd = open(url.path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
        guard fd >= 0 else { return false }
        var info = stat()
        guard fstat(fd, &info) == 0, info.st_mode & 0o777 != 0 else { close(fd); return false }
        guard let directory = fdopendir(fd) else { close(fd); 
```

### Core Architecture Module: `AppPorts/Services/VolumeStateReporting.swift`
```
import Foundation

enum VolumeStateReporting {
    private static let lock = NSLock()
    private static var recent: VolumeStateInventory?

    static func remember(_ inventory: VolumeStateInventory) {
        lock.lock()
        let changed = recent?.findings != inventory.findings || recent?.complete != inventory.complete
        recent = inventory
        lock.unlock()
        if changed {
            AppLogger.shared.logContext("数据卷状态盘点", details: [
                ("categories", VolumeStateClass.allCases.map { "\($0.rawValue)=\(inventory.counts[$0] ?? 0)" }.joined(separator: ", ")),
                ("complete", String(inventory.complete)), ("total", String(inventory.findings.count))
            ], level: "INFO")
        }
    }

    static func lastInventory() -> VolumeStateInventory? {
        lock.lock()
        defer { lock.unlock() }
        return recent
    }

    static func collect(store: ContainerMountStore = .shared,
                        disk: DiskUtility = DiskUtility(runner: ProcessCommandRunner(captureLimit: 1_048_576),
                                                       commandTimeout: 5, administratorRunner: nil)) async {
        let snapshot = (try? await disk.volumeStateSnapshot()) ?? .init(volumes: [:], complete: false)
        do {
            let records = try store.recordsForInspection()
            remember(VolumeStateClassifier().inventory(records, snapshot: snapshot))
        } catch {
            remember(.init(findings: [.init(state: .unreadable, originalPath: "", volumeUUID: nil,
                                           detail: "journal_unreadable")], scannedAt: Date(), complete: false))
        }
    }

    /// Aggregate counts contain no paths, application names or credentials.
    static func diagnosticSection(_ inventory: VolumeStateInventory?) -> [String] {
        guard let inventory else { return ["volume_state_inventory", "  state: not_scanned"] }
        var lines = ["volume_state_inventory", "  state: \(inventory.complete ? "scanned" : "incomplete")",
                     "  scanned_at: \(ISO8601DateFormatter().string(from: inventory.scannedAt))"]
        lines += VolumeStateClass.allCases.map { "  \($0.rawValue): \(inventory.counts[$0] ?? 0)" }
        for residue in [InterruptedResidueKind.entryAvailable, .awaitingRecovery] {
            lines.append("  \(residue.rawValue): \(inventory.findings.filter { $0.residue == residue }.count)")
        }
        lines.append("  total: \(inventory.findings.count)")
        return lines
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
    struct RecoveryPaused: LocalizedError {
        var errorDescription: String? {
            "此操作已暂停，现有文件已保留。请在“处理异常”中点击“重试”后继续。".localized
        }
    }

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
        guard transfer.needsAutomaticCompletion else { throw RecoveryPaused() }
        let transfer = try store.adoptLegacyRestoreOwnership(transfer)
        let progress = DataTransferSession.progress
        let session = DataTransferSession.current
        let automatic = CleanupRetryContext.automatic
        let retryClock = CleanupRetryContext.now
        // Disk commands have their own deadlines. A dataset-sized verification
        // must not restart forever because it exceeds a fixed 10/90s budget.
        if timeoutNanoseconds == 0 {
            return try await Task.detached(priority: .userInitiated) {
                try await DataTransferSession.$current.withValue(session) {
                    try await DataTransferSession.$progress.withValue(progress) {
                        try await DataTransferSession.run {
                            progress?.begin(.recovering)
                            return try await CleanupRetryContext.$automatic.withValue(automatic) {
                                try await CleanupRetryContext.$now.withValue(retryClock) {
                                    try await self.recoverMountOperation(transfer, finishPreparedRestore: finishPreparedRestore)
                                }
                            }
                        }
                    }
                }
            }.value
        }
        return try await Task.detached(priority: .userInitiated) {
            try await DataTransferSession.$current.withValue(session) {
                try await DataTransferSession.$progress.withValue(progress) {
                    progress?.begin(.recovering)
                    return try await withThrowingTaskGroup(of: AutomaticRecoveryResult.self) { group in
                        group.addTask {
                            try await CleanupRetryContext.$automatic.withValue(automatic) {
                                try await CleanupRetryContext.$now.withValue(retryClock) {
                                    try await self.recoverMountOperation(transfer, finishPreparedRestore: finishPreparedRestore)
                                }
                            }
                        }
                        group.addTask {
                            try await Task.sleep(nanoseconds: timeoutNanoseconds)
                            throw AutomaticRecoveryError.timedOut
                        }
                        defer { group.cancelAll() }
                        return try await group.next()!
                    }
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
        guard expected.needsAutomaticCompletion else { throw RecoveryPaused() }
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
        DataTransferSession.progress?.setDirectory(URL(fileURLWithPath: expected.originalPath))
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
        if expected.direction == .migrate, expected.isVerifiedSwitchRecoverable, expected.backupId
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #82** (2026-10-20): **[BUG] App Store 装在外置硬盘上的软件（微软家的Word办公套件）无法正常检测签名**
  *Symptoms*: ### 问题描述 / Problem  如图，从官方安装的无法检验签名 <img width="1483" height="332" alt="Image" src="https://github.com/user-attachments/assets/10cedcf0-bb6b-4a6a-b4dc-66fec58cfa39" />  <img width="560" height="484" alt="Image" src="https://github.com/user-attachments/assets/a9773496-713f-4a4a-b95b-2c675967ac9a" />  ### 复现步骤 / Steps to Reproduce  1、在1.9.2版本前链接外置硬盘的软件 2、更新最新版后出现签名待检查，未对应用数据进行迁移 3、目前只有微软的套件存在问题 ps：只迁移过 Edge 的数据  ### 设备系统版本 / OS Version  macOS 27.0.1  ### 软件版本 / App Version  v1.9.2  ### 诊断信息确认 / Diagnostics  - [x] 我已附上诊断包；如无法提供，已在下方说明原因。 / I attached a diagnostic package or explained why it is unavailable.  ### 诊断包 / Diagnostic Package  [AppPorts-Diagnostic-20261019-104416.zip](https://github.com/user-attachments/files/33646535/AppPorts-Diagnostic-20261019-104416.zip)  ### 外置存储设备类型 / External Storage Type  - [ ] NAS - [ ] 移动硬盘 / Portable External Drive - [x] 移动硬盘盒 / Drive Enclosure - [ ] 其他 / Other  ### 外置存储设备产品名 / External Storage Product Name  _No response_  ### 截图（可选） / Screenshots (Optional)  _No response_  ### 日志（可选，仅在无诊断包时填写） / Logs (Optional, only if no diagnostic package)  ```shell  ```

- **Issue #77** (2026-10-18): **[BUG] 1.9.0升级1.9.1后 微信迁回本地失败**
  *Symptoms*: ### 问题描述 / Problem  1.9.0升级1.9.1后 微信迁回本地失败,只要是图标中带锁的应用都迁入本地失败。  ### 复现步骤 / Steps to Reproduce  无  ### 设备系统版本 / OS Version  macOS 27.0.1  ### 软件版本 / App Version  1.9.1  ### 诊断信息确认 / Diagnostics    - [x] 我已附上诊断包；如无法提供，已在下方说明原因。 / I attached a diagnostic package or explained why it is unavailable.  ### 诊断包 / Diagnostic Package  [AppPorts-Diagnostic-20261017-033531.zip](https://github.com/user-attachments/files/33570648/AppPorts-Diagnostic-20261017-033531.zip)  ### 外置存储设备类型 / External Storage Type  - [ ] NAS - [ ] 移动硬盘 / Portable External Drive - [x] 移动硬盘盒 / Drive Enclosure - [ ] 其他 / Other  ### 外置存储设备产品名 / External Storage Product Name  _No response_  ### 截图（可选） / Screenshots (Optional)  <img width="1700" height="1280" alt="Image" src="https://github.com/user-attachments/assets/6fa20fd5-f7cb-4b80-808a-82f67f1c0d0d" />  <img width="60" height="409" alt="Image" src="https://github.com/user-attachments/assets/b242cd87-7204-4c8d-8a43-40cc69629159" />  ### 日志（可选，仅在无诊断包时填写） / Logs (Optional, only if no diagnostic package)  ```shell  ```

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

### Incident Patch 1: `e0302b07` (2026-10-21)
**Commit Message**: fix(应用数据): 「锁定目录结构」只补回可操作项的上游祖先

原先两个开关各守一道门，任何单独勾选都不放行：

    if isMigrationUnsupported && !showNonMigratableDirectories { return false }
    if !isMigratable { return showLockedStructure }

isMigrationUnsupported 是 !isMigratable 的子集，其余不可迁移行又被
needsRecoveryOrAttention 强制显示，于是「锁定目录结构」能多显示的内容是空集——
勾了没反应。

现在按用途拆开：
- 锁定目录结构：在树层补回“可操作项之上的锁定祖先”，只用于交代层级，
  没有可操作子项的锁定目录不会出现（DataDirTree.visibleItems）；
- 不支持迁移：仍由 matchesVisibility 单条判断决定，全量放出。

matchesVisibility 相应回到两个参数，不再依赖兄弟节点。表头计数改按最终
渲染行数统计，补回的祖先行也算进去。

测试同步：DataDirTreeTests 新增“只开锁定结构不会放出孤立锁定目录”和
“打开不支持迁移后全量出现”两组断言；其余用例改用新参数。

决定记录见 .agents/notes/implemented/bug-fix/2026-10-22-locked-structure-shows-actionable-ancestors.md

**File**: `.agents/notes/implemented/bug-fix/2026-10-22-locked-structure-shows-actionable-ancestors.md` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+# Agent Note: 「锁定目录结构」改为只补回可操作项之上的锁定祖先
+
+Status: implemented
+
+## Problem
+
+应用数据页的两个可见性开关单独勾选时都没有效果，只有同时勾上才会出现锁定行：
+
+```swift
+if isMigrationUnsupported && !showNonMigratableDirectories { return false }  // 第三道门
+if !isMigratable { return showLockedStructure }                              // 第二道门
+```
+
+`isMigrationUnsupported` 是 `!isMigratable` 的子集，而子集之外那些“不能迁移但还能接回/挂载/恢复”的行本来就被 `needsRecoveryOrAttention` 强制显示。于是「显示锁定目录结构」能多显示的内容只剩空集：勾上它，列表纹丝不动，用户只会怀疑开关坏了。
+
+同时两个开关的语义也没有区分开：它们覆盖的行完全重叠，等于同一个过滤器的两道锁。
+
+## Decision
+
+把两个开关拆成两种不同的问题：
+
+- **显示锁定目录结构**（`showLockedStructure`）只在树层生效：补回**可操作项之上的锁定祖先**，用来交代层级。没有可操作子项的锁定目录不会因为打开它而出现。判定在 `DataDirTree.visibleItems`：
+
+  ```swift
+  guard showLockedStructure, !showNonMigratableDirectories else { return base }
+  let prefix = item.path.standardizedFileURL.path + "/"
+  return basePaths.contains { $0.hasPrefix(prefix) }
+  ```
+
+- **显示不支持迁移目录**（`showNonMigratableDirectories`）保持“全量放出”的语义，作用在 `DataDirItem.matchesVisibility` 的单条判断上。
+
+`matchesVisibility` 因此回到两个参数：它只回答“这一条本身该不该出现”，祖先补充交给树层，避免让单条判断依赖兄弟节点。
+
+表头计数改为按最终渲染的行数统计（`visibleLibraryItemCount`），否则补回的祖先行会让“显示 X / 67”和列表对不上。
+
+`DataDirTree.visibleTree` 的 `showNonMigratableDirectories` 默认值改为 `false`：默认只显示可操作内容，需要更多内容由调用方显式打开。
+
+## Verification
+
+- 独立 harness 编译真实模型文件（`DataDirItem.swift`、`DataDirTree.swift`、`DataPathPolicy.swift`、`PartialWeChatMigrationPolicy.swift`）验证 13 条规则：默认隐藏锁定行、打开「锁定结构」只补可操作项的祖先、无子项的锁定目录不出现、打开「不支持迁移」全量出现、零字节开关互不影响。全部通过。
+- Release `xcodebuild clean build` 通过，无编译错误。
+- 测试调用点已同步：`DataDirPresentationTests`、`DataDirTreeTests`、`DataPathPolicyTests`、`DataDirScannerTests`、`MigrationSafetyRenderTests`；`DataDirTreeTests` 的可见性矩阵新增了“只开锁定结构不放出孤立锁定目录”和“打开不支持迁移后全量出现”两组断言。
+
+## Alternatives considered
+
+- **合并成一个开关**：行为最简单，但用户明确需要“看层级”和“看全部”两种不同的浏览方式，合并会丢失前者。
+- **保持原状，只让第三个开关自动打开第二个**：仍然没有解决「锁定结构」本身没有内容可显示的问题，等于留一个装饰性开关。
+- **在单条判断里补祖先**：`matchesVisibility` 只能看到自己，判断“是否有可操作子项”需要遍历兄弟节点，会把树结构的知识塞进单条模型。
+- **把祖先补充放在视图层**：可见性规则会分散到 View 和 Model 两处，测试也只能覆盖一半。
+
+## Consequences
+
+收益：两个开关各自回答一个问题——“这层结构是什么”与“还有哪些不能迁移的东西”。单独勾任何一个都有可见效果。
+
+代价与边界：
+
+- 「锁定结构」补回的祖先行没有独立操作，只用于展示；它们的大小仍按行统计，父行与子行不能相加。
+- 祖先判定按路径前缀在**当前分组内**计算，跨类型分组（例如 Application Support 与 Containers）之间的层级不会被补回。
+- 用户目录快捷入口（Desktop/Downloads 等）即使作为祖先也不会补回，避免把个人目录当成应用数据展示。
+- `visibleTree` 的默认参数由 `true` 改为 `false`，未显式传参的调用方（主要是测试）行为随之收紧。
```

**File**: `AppPorts/Models/DataDirItem.swift` (modified, +6/-2)
```diff
@@ -317,12 +317,16 @@ struct DataDirItem: Identifiable, Equatable, Sendable {
             || pathPolicy?.reason == .runtimeConflict || pathPolicy?.reason == .readFailure
     }
 
-    func matchesVisibility(showZeroByteDirectories: Bool, showLockedStructure: Bool,
+    /// 单条目录的基础可见性：可操作项、需要处理的行，以及按开关决定的空目录与不可迁移目录。
+    ///
+    /// “可操作项之上的锁定祖先”不属于单条判断能回答的问题，由 `DataDirTree.visibleItems` 补回；
+    /// `showNonMigratableDirectories` 才是把全部不可迁移目录一并放出的开关。
+    func matchesVisibility(showZeroByteDirectories: Bool,
                            showNonMigratableDirectories: Bool = true) -> Bool {
         if isMigrationUnsupported && !showNonMigratableDirectories { return false }
         if needsRecoveryOrAttention || hasMountTransferRecord { return true }
         if isUserDirectoryLink { return false }
-        if !isMigratable { return showLockedStructure }
+        if !isMigratable { return showNonMigratableDirectories }
         return showZeroByteDirectories || !isEmptyLocalDirectory
     }
 
```

**File**: `AppPorts/Models/DataDirTree.swift` (modified, +26/-4)
```diff
@@ -111,13 +111,35 @@ enum DataDirTree {
     /// Row.contextPath supplies the intermediate path that indentation no longer represents.
     static func visibleTree(from items: [DataDirItem], showZeroByteDirectories: Bool,
                             showLockedStructure: Bool, matchingIDs: Set<String>,
-                            showNonMigratableDirectories: Bool = true) -> [DataDirItem] {
-        let visibleItems = items.filter {
+                            showNonMigratableDirectories: Bool = false) -> [DataDirItem] {
+        let included = visibleItems(from: items,
+                                    showZeroByteDirectories: showZeroByteDirectories,
+                                    showLockedStructure: showLockedStructure,
+                                    showNonMigratableDirectories: showNonMigratableDirectories)
+        return retainingMatches(in: build(from: included), matchingIDs: matchingIDs)
+    }
+
+    /// 一屏里应当出现的目录集合。
+    ///
+    /// `showNonMigratableDirectories` 打开时，所有不可迁移目录都算可见；
+    /// 只勾「锁定目录结构」时，仅补回**可操作项之上的锁定祖先**——
+    /// 它们的唯一作用是交代层级，不会把没有可操作子项的锁定目录一并放出。
+    static func visibleItems(from items: [DataDirItem], showZeroByteDirectories: Bool,
+                             showLockedStructure: Bool,
+                             showNonMigratableDirectories: Bool) -> [DataDirItem] {
+        let base = items.filter {
             $0.matchesVisibility(showZeroByteDirectories: showZeroByteDirectories,
-                                 showLockedStructure: showLockedStructure,
                                  showNonMigratableDirectories: showNonMigratableDirectories)
         }
-        return retainingMatches(in: build(from: visibleItems), matchingIDs: matchingIDs)
+        guard showLockedStructure, !showNonMigratableDirectories else { return base }
+        let baseIDs = Set(base.map(\.id))
+        let basePaths = base.map { $0.path.standardizedFileURL.path }
+        return items.filter { item in
+            if baseIDs.contains(item.id) { return true }
+            guard !item.isMigratable, !item.isUserDirectoryLink else { return false }
+            let prefix = item.path.standardizedFileURL.path + "/"
+            return basePaths.contains { $0.hasPrefix(prefix) }
+        }
     }
 
     /// Keep ancestors of matches so a search never hides the directory's context.
```

**File**: `AppPorts/Views/DataDirsView.swift` (modified, +8/-3)
```diff
@@ -646,7 +646,7 @@ struct DataDirsView: View {
                 .buttonStyle(.plain)
                 .accessibilityLabel("清除搜索".localized)
             }
-            Text(String(format: "显示 %lld / %lld".localized, Int64(filteredLibraryItems.count), Int64(libraryItems.count)))
+            Text(String(format: "显示 %lld / %lld".localized, Int64(visibleLibraryItemCount), Int64(libraryItems.count)))
                 .font(.system(size: 11))
                 .foregroundColor(.secondary)
                 .fixedSize()
@@ -708,7 +708,7 @@ struct DataDirsView: View {
     private var appDataFilterSummary: some View {
         VStack(alignment: .leading, spacing: 8) {
             HStack(spacing: 10) {
-                Text(String(format: "显示 %lld / %lld".localized, Int64(sortedFilteredLibraryItems.count), Int64(libraryItems.count)))
+                Text(String(format: "显示 %lld / %lld".localized, Int64(visibleLibraryItemCount), Int64(libraryItems.count)))
                     .font(.system(size: 11, weight: .medium))
                     .foregroundColor(.secondary)
 
@@ -1046,6 +1046,12 @@ struct DataDirsView: View {
         }
     }
 
+    private var visibleLibraryItemCount: Int {
+        groupedLibraryItems.reduce(0) { count, group in
+            count + DataDirTree.rows(in: group.items).count
+        }
+    }
+
     private var hasActiveAppDataFilters: Bool {
         summaryFilter != nil || !selectedPriorityFilters.isEmpty || !selectedStatusFilters.isEmpty || !selectedTypeFilters.isEmpty
     }
@@ -1083,7 +1089,6 @@ struct DataDirsView: View {
             && (selectedStatusFilters.isEmpty || selectedStatusFilters.contains(item.displayedStatus))
             && (selectedTypeFilters.isEmpty || selectedTypeFilters.contains(item.type))
             && item.matchesVisibility(showZeroByteDirectories: showZeroByteDirectories,
-                                      showLockedStructure: showLockedDirectoryStructure,
                                       showNonMigratableDirectories: showNonMigratableDirectories)
     }
 
```

**File**: `AppPortsTests/DataDirPresentationTests.swift` (modified, +6/-6)
```diff
@@ -12,9 +12,9 @@ struct DataDirPresentationTests {
                                    type: .containers, priority: .optional, description: "",
                                    status: status, isMigratable: false)
             item.sizeIsIncomplete = true
-            #expect(!item.matchesVisibility(showZeroByteDirectories: true, showLockedStructure: true,
+            #expect(!item.matchesVisibility(showZeroByteDirectories: true,
                                            showNonMigratableDirectories: false))
-            #expect(item.matchesVisibility(showZeroByteDirectories: true, showLockedStructure: true,
+            #expect(item.matchesVisibility(showZeroByteDirectories: true,
                                           showNonMigratableDirectories: true))
 
             var child = item
@@ -41,7 +41,7 @@ struct DataDirPresentationTests {
         var item = shortcut()
         item.applyPathPolicy(.init(role: .systemDirectory, reason: reason, canMigrate: false, mayDiscoverChildren: false))
         #expect(item.needsRecoveryOrAttention)
-        #expect(item.matchesVisibility(showZeroByteDirectories: false, showLockedStructure: false))
+        #expect(item.matchesVisibility(showZeroByteDirectories: false, showNonMigratableDirectories: false))
         #expect(item.sizeMeasurementURL == nil)
     }
 
@@ -70,7 +70,7 @@ struct DataDirPresentationTests {
     func shortcutVisibility(showZero: Bool, showStructure: Bool) {
         let item = shortcut()
         #expect(!item.matchesVisibility(showZeroByteDirectories: showZero,
-                                        showLockedStructure: showStructure))
+                                        showNonMigratableDirectories: showStructure))
     }
 
     @Test("Similar folder names and nested paths remain ordinary existing links",
@@ -81,7 +81,7 @@ struct DataDirPresentationTests {
         #expect(!item.isUserDirectoryLink)
         #expect(item.sizeMeasurementURL == item.linkedDestination)
         #expect(item.displayedStatus == DataDirStatus.existingSymlink)
-        #expect(item.matchesVisibility(showZeroByteDirectories: false, showLockedStructure: false))
+        #expect(item.matchesVisibility(showZeroByteDirectories: false, showNonMigratableDirectories: false))
     }
 
     @Test("Only the matching personal folder target qualifies",
@@ -126,7 +126,7 @@ struct DataDirPresentationTests {
             #expect(item.sizeMeasurementURL == item.linkedDestination)
             #expect(item.displayedStatus == item.status)
             #expect(item.needsRecoveryOrAttention)
-            #expect(item.matchesVisibility(showZeroByteDirectories: false, showLockedStructure: false))
+            #expect(item.matchesVisibility(showZeroByteDirectories: false, showNonMigratableDirectories: false))
         }
         #expect(managed.canRestore)
         #expect(linked.canRestore)
```

**File**: `AppPortsTests/DataDirScannerTests.swift` (modified, +6/-6)
```diff
@@ -1223,8 +1223,8 @@ final class DataDirScannerTests: XCTestCase {
                 XCTAssertEqual(row.sizeBytes, 0)
                 let measured = await scanner.calculateSize(for: row)
                 XCTAssertEqual(measured, 0)
-                XCTAssertFalse(row.matchesVisibility(showZeroByteDirectories: true, showLockedStructure: false))
-                XCTAssertFalse(row.matchesVisibility(showZeroByteDirectories: false, showLockedStructure: true))
+                XCTAssertFalse(row.matchesVisibility(showZeroByteDirectories: true, showNonMigratableDirectories: false))
+                XCTAssertFalse(row.matchesVisibility(showZeroByteDirectories: false, showNonMigratableDirectories: true))
                 XCTAssertEqual(try String(contentsOf: workspace.homeURL.appendingPathComponent(name + "/payload.txt")), "payload")
             }
         }
@@ -1326,7 +1326,7 @@ final class DataDirScannerTests: XCTestCase {
             for: AppItem(name: "WeChat.app", path: appURL, status: "本地"))
         let item = try XCTUnwrap(items.first { $0.path.standardizedFileURL == source.standardizedFileURL })
         XCTAssertFalse(item.isMigratable)
-        XCTAssertTrue(item.matchesVisibility(showZeroByteDirectories: false, showLockedStructure: false))
+        XCTAssertTrue(item.matchesVisibility(showZeroByteDirectories: false, showNonMigratableDirectories: false))
     }
 
     func testUnresolvedRetainedMigrationBlocksRemigrationAndRemainsVisible() async throws {
@@ -1356,7 +1356,7 @@ final class DataDirScannerTests: XCTestCase {
         let item = try XCTUnwrap(items.first { $0.path.standardizedFileURL == source.standardizedFileURL })
         XCTAssertFalse(item.isMigratable)
         XCTAssertEqual(item.pathPolicy?.reason, .retainedOriginal)
-        XCTAssertTrue(item.matchesVisibility(showZeroByteDirectories: false, showLockedStructure: false))
+        XCTAssertTrue(item.matchesVisibility(showZeroByteDirectories: false, showNonMigratableDirectories: false))
     }
 
     func testCompletedRestoreIsMigratableWithTwoRetainedCopiesUnlessEntryChangedOrRecoveryIsPending() async throws {
@@ -1405,7 +1405,7 @@ final class DataDirScannerTests: XCTestCase {
             XCTAssertEqual(scanned.isMigratable, ["restored", "used-after-restore", "cleanup-retry"].contains(state), state)
             XCTAssertEqual(scanned.recoveryOperationID, restored.operationID, state)
             XCTAssertNil(scanned.linkedDestination, state)
-            XCTAssertTrue(scanned.matchesVisibility(showZeroByteDirectories: false, showLockedStructure: false), state)
+            XCTAssertTrue(scanned.matchesVisibility(showZeroByteDirectories: false, showNonMigratableDirectories: false), state)
             XCTAssertEqual(try store.transfers().count, 2, "Scanning must not delete retained data")
         }
     }
@@ -1452,7 +1452,7 @@ final class DataDirScannerTests: XCTestCase {
         XCTAssertFalse(item.isMigratable)
         XCTAssertTrue(item.canRestore)
         XCTAssertEqual(item.linkedDestination?.standardizedFileURL, target.standardizedFileURL)
-        XCTAssertTrue(item.matchesVisibility(showZeroByteDirectories: false, showLockedStructure: false))
+        XCTAssertTrue(item.matchesVisibility(showZeroByteDirectories: false, showNonMigratableDirectories: false))
     }
 
     func testWeChatSplitDiscoveryAddsOnlyTwoMembersAndGroupsActionsAtAccount() async throws {
```

**File**: `AppPortsTests/DataDirTreeTests.swift` (modified, +19/-5)
```diff
@@ -180,20 +180,34 @@ final class DataDirTreeTests: XCTestCase {
         let items = [root, locked, empty, business, managed, unreadable]
         for zeros in [false, true] {
             for locks in [false, true] {
-                let matches = Set(items.filter { $0.matchesVisibility(showZeroByteDirectories: zeros, showLockedStructure: locks) }.map(\.id))
+                let matches = Set(items.filter {
+                    $0.matchesVisibility(showZeroByteDirectories: zeros, showNonMigratableDirectories: false)
+                }.map(\.id))
                 let tree = DataDirTree.visibleTree(from: items, showZeroByteDirectories: zeros,
-                                                   showLockedStructure: locks, matchingIDs: matches)
+                                                   showLockedStructure: locks, matchingIDs: matches,
+                                                   showNonMigratableDirectories: false)
                 let visible = Set(DataDirTree.rows(in: tree).map(\.id))
-                XCTAssertTrue(visible.isSuperset(of: [business.id, managed.id, unreadable.id]))
+                XCTAssertTrue(visible.isSuperset(of: [business.id, managed.id]))
+                // root 是 business 的祖先：只有“显示锁定目录结构”会把它作为层级补回来。
                 XCTAssertEqual(visible.contains(root.id), locks)
                 XCTAssertEqual(visible.contains(empty.id), zeros)
-                XCTAssertEqual(visible.contains(locked.id), locks)
+                // locked 没有可操作的子项，单靠“锁定结构”不会出现在列表里。
+                XCTAssertFalse(visible.contains(locked.id))
+                // 不支持迁移且读取失败的行，仍然只跟随“显示不支持迁移目录”。
+                XCTAssertFalse(visible.contains(unreadable.id))
                 // Search preserves only ancestors that survived visibility filtering.
                 let explicitMatches = matches.intersection([business.id])
                 let explicitTree = DataDirTree.visibleTree(from: items, showZeroByteDirectories: zeros,
-                                                           showLockedStructure: locks, matchingIDs: explicitMatches)
+                                                           showLockedStructure: locks, matchingIDs: explicitMatches,
+                                                           showNonMigratableDirectories: false)
                 XCTAssertEqual(DataDirTree.rows(in: explicitTree).map(\.id), locks ? [root.id, business.id] : [business.id])
             }
+            // “显示不支持迁移目录”把这一类全部放出，不要求它们有可操作子项。
+            let allTree = DataDirTree.visibleTree(from: items, showZeroByteDirectories: zeros,
+                                                  showLockedStructure: false, matchingIDs: Set(items.map(\.id)),
+                                                  showNonMigratableDirectories: true)
+            let allVisible = Set(DataDirTree.rows(in: allTree).map(\.id))
+            XCTAssertTrue(allVisible.isSuperset(of: [root.id, locked.id, managed.id, unreadable.id]))
         }
     }
 
```

**File**: `AppPortsTests/DataPathPolicyTests.swift` (modified, +2/-2)
```diff
@@ -61,13 +61,13 @@ final class DataPathPolicyTests: XCTestCase {
                        DataDirStatus.pendingMount, DataDirStatus.volumeMissing] {
             item.status = status
             XCTAssertTrue(item.canRestore, status)
-            XCTAssertTrue(item.matchesVisibility(showZeroByteDirectories: false, showLockedStructure: false), status)
+            XCTAssertTrue(item.matchesVisibility(showZeroByteDirectories: false, showNonMigratableDirectories: false), status)
         }
         item.status = DataDirStatus.local
         XCTAssertFalse(item.canRestore)
         for zeros in [false, true] {
             for locked in [false, true] {
-                XCTAssertEqual(item.matchesVisibility(showZeroByteDirectories: zeros, showLockedStructure: locked), locked)
+                XCTAssertEqual(item.matchesVisibility(showZeroByteDirectories: zeros, showNonMigratableDirectories: locked), locked)
             }
         }
     }
```

---

### Incident Patch 2: `805fc4ea` (2026-10-20)
**Commit Message**: fix: stabilize portal startup and resume permission-blocked migrations

**File**: `AppPorts/ContentView.swift` (modified, +3/-3)
```diff
@@ -1873,8 +1873,8 @@ struct ContentView: View {
         operationState.registerCancellation(for: activityToken) { task.cancel() }
     }
 
-    func linkApp(appToLink: AppItem, destinationURL: URL) throws {
-        try AppMigrationService().linkApp(appToLink: appToLink, destinationURL: destinationURL)
+    func linkApp(appToLink: AppItem, destinationURL: URL) async throws {
+        try await AppMigrationService().linkAppWhenReady(appToLink: appToLink, destinationURL: destinationURL)
     }
     
     func deleteLink(app: AppItem) throws {
@@ -2439,7 +2439,7 @@ struct ContentView: View {
                 )
                 
                 do {
-                    try linkApp(appToLink: tempAppItem, destinationURL: destination)
+                    try await linkApp(appToLink: tempAppItem, destinationURL: destination)
                     // 锁定外部 app（仅 Sparkle/Electron 有更新器的应用）
                     if lockExternal && item.app.needsLock {
                         AppMigrationService().lockExternalApp(at: item.sourcePath)
```

**File**: `AppPorts/Services/AppMigrationService.swift` (modified, +52/-0)
```diff
@@ -808,11 +808,33 @@ struct AppMigrationService {
         return .same
     }
 
+    /// Foreground actions wait for maintenance, then resume the exact unfinished
+    /// migration with permission to show an administrator prompt.
+    func linkAppWhenReady(appToLink: AppItem, destinationURL: URL) async throws {
+        try await Self.mutationCoordinator.begin()
+        defer { Self.mutationCoordinator.end() }
+        let operationLock = makeOperationLock()
+        guard await operationLock.acquire(timeout: OperationLock.appWaitTimeout) else {
+            throw AppTransferTransaction.failure(operationLock.admissionFailureReason
+                ?? "其他操作正在使用应用记录，请稍后重试。".localized, at: destinationURL)
+        }
+        defer { operationLock.release() }
+        let resumed = try await finishPendingMigration(external: appToLink.path, local: destinationURL)
+        // Resuming may already have installed the requested entry. Do not
+        // replace an entry still owned by its transfer's cleanup journal.
+        if resumed && localPortalKind(at: destinationURL, linkedTo: appToLink.path) != nil { return }
+        try linkAppWhileLocked(appToLink: appToLink, destinationURL: destinationURL)
+    }
+
     func linkApp(appToLink: AppItem, destinationURL: URL) throws {
         try Self.mutationCoordinator.beginSynchronously()
         defer { Self.mutationCoordinator.end() }
         let operationLock = try acquireOperationLock(at: destinationURL)
         defer { operationLock.release() }
+        try linkAppWhileLocked(appToLink: appToLink, destinationURL: destinationURL)
+    }
+
+    private func linkAppWhileLocked(appToLink: AppItem, destinationURL: URL) throws {
         let operationID = AppLogger.shared.makeOperationID(prefix: "app-link")
         let startedAt = Date()
         var operationResult = "failed"
@@ -1047,6 +1069,7 @@ struct AppMigrationService {
                 ?? "其他操作正在使用应用记录，请稍后重试。".localized, at: app.path)
         }
         defer { operationLock.release() }
+        _ = try await finishPendingMigration(external: app.path, local: localDestinationURL, progress: progressHandler)
         try Self.checkWritePermission(at: localDestinationURL, fileManager: fileManager)
         let existing = localPortalKind(at: localDestinationURL, linkedTo: app.path)
         if existing == .folderMirror {
@@ -1067,6 +1090,28 @@ struct AppMigrationService {
                              externalSourceRemains: result.externalSourceRemains, transferResult: result)
     }
 
+    /// Caller holds the coordinator and operation lock. Only the exact inverse
+    /// migration is eligible; unrelated/overlapping records stay fail-closed.
+    private func finishPendingMigration(external: URL, local: URL,
+                                        progress: FileCopier.ProgressHandler? = nil) async throws -> Bool {
+        _ = retireUnrecoverableTransfersWhileLocked()
+        var resumed = false
+        for record in try transferStore.inventory().records where record.direction == .migrate
+            && !record.isSwitchComplete && record.phase != .cancelled
+            && record.sourcePath == local.standardizedFileURL.path
+            && record.destinationPath == external.standardizedFileURL.path {
+            try AppTransferJournalIntegrity.requireVerifiedManifests(for: record, store: transferStore)
+            let result = try await transferTransaction().resume(record.operationID, progress: progress)
+            guard result.isSwitchComplete else {
+                throw AppTransferTransaction.failure(result.pendingMessage ?? record.recoverableReason ??
+                    "此位置的上次操作尚未完成。AppPorts 已保留数据并会继续尝试，请根据下面的原因处理后重试。".localized,
+                    at: external)
+            }
+            resumed = true
+        }
+        return resumed
+    }
+
     /// A folder marker identifies the entry, but does not authorize deleting
     /// personal real files later placed beside the managed links and app stubs.
     private func requireOnlyManagedFolderEntries(at localFolder: URL, externalFolder: URL) throws {
@@ -2106,6 +2151,13 @@ struct AppMigrationService {
             defer { stage.cleanup() }
             // Copy bytes into independent files. Never inherit uchg or hard links from the old portal.
             try stage.copyContents(from: localURL, snapshot: original)
+            let stagedContents = stageURL.appendingPathComponent("Contents")
+            let stagedMacOS = stagedContents.appendingPathComponent("MacOS")
+            try fileManager.removeItem(at: stagedMacOS.appendingPathComponent("launcher"))
+            try copyNativeLauncher(to: stagedMacOS,
+                                   resourcesDir: stagedContents.appendingPathComponent("Resources"),
+                                   externalURL: externalURL)
+            try stage.recordGeneratedFiles(replacing: ["Contents/MacOS/launcher", "Contents/Resources/real_app_path.txt"])
             for warning in try PortalPresent
```

**File**: `AppPorts/Utils/PortalPresentation.swift` (modified, +8/-1)
```diff
@@ -3,7 +3,7 @@ import Foundation
 /// Produces only the display metadata of a macOS portal. Call on a private staging
 /// bundle, then sign and install the bundle before registering it with the system.
 enum PortalPresentation {
-    static let formatVersion = 1
+    static let formatVersion = 3
     static let versionKey = "AppPortsPortalFormatVersion"
 
     static func needsRefresh(local: [String: Any], external: [String: Any]) -> Bool {
@@ -150,6 +150,13 @@ enum PortalPresentation {
         for key in ["SUFeedURL", "SUPublicDSAKeyFile", "SUPublicEDKey", "SUScheduledCheckInterval", "SUAllowsAutomaticUpdates", "ElectronDefaultApp", "electron"] {
             plist.removeValue(forKey: key)
         }
+        // The portal runs its own NSApplication delegate, not the target's UI,
+        // scripting, extension or system-service implementation.
+        for key in ["NSPrincipalClass", "NSMainNibFile", "NSMainStoryboardFile", "NSServices",
+                    "NSAppleScriptEnabled", "OSAScriptingDefinition", "NSExtension", "NSExtensionSDK",
+                    "NSSupportsAutomaticTermination", "NSSupportsSuddenTermination"] {
+            plist.removeValue(forKey: key)
+        }
         plist[versionKey] = formatVersion
         plist["AppPortsPresentationResources"] = copiedResources.sorted()
         let output = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
```

**File**: `AppPortsTests/AppTransferTransactionTests.swift` (modified, +65/-0)
```diff
@@ -98,6 +98,71 @@ final class AppTransferTransactionTests: XCTestCase {
         XCTAssertTrue(recovered.isComplete)
     }
 
+    func testForegroundLinkAndRestoreResumePermissionBlockedMigration() async throws {
+        for restore in [false, true] {
+            let w = try Workspace(); defer { w.cleanup() }
+            let local = w.local.appendingPathComponent("App.app")
+            let external = w.external.appendingPathComponent("App.app")
+            try makeApp(local)
+            do {
+                _ = try await w.service(exchange: { _, _ in throw POSIXError(.EACCES) },
+                    administratorOperation: { _ in throw CancellationError() })
+                    .moveAndLink(appToMove: item(local), destinationURL: external,
+                                 isRunning: false, progressHandler: nil)
+                XCTFail("Expected pending authorization")
+            } catch is CancellationError {}
+            let pending = try XCTUnwrap(w.store.records().first)
+            var prompts = 0
+            let foreground = w.service(exchange: { _, _ in throw POSIXError(.EACCES) },
+                administratorOperation: { request in
+                    prompts += 1
+                    try PrivilegedAppTransfer.perform(request)
+                })
+            if restore {
+                let result = try await foreground.moveBack(app: item(external, status: AppStatus.unlinked),
+                                                          localDestinationURL: local, progressHandler: nil)
+                XCTAssertTrue(result.transferResult.isComplete, result.transferResult.pendingMessage ?? "")
+                XCTAssertEqual(try payload(local), "payload")
+                XCTAssertFalse(FileManager.default.fileExists(atPath: external.path))
+            } else {
+                try await foreground.linkAppWhenReady(appToLink: item(external, status: AppStatus.unlinked),
+                                                     destinationURL: local)
+                XCTAssertEqual(try CodeSigner.resolveAppURL(at: local).path, external.path)
+                XCTAssertEqual(try payload(external), "payload")
+            }
+            XCTAssertEqual(prompts, 1)
+            XCTAssertFalse(try w.store.records().contains { $0.id == pending.id })
+            try assertNoStages(w)
+        }
+    }
+
+    func testForegroundRecoveryDoesNotAdoptReplacedExternalApplication() async throws {
+        let w = try Workspace(); defer { w.cleanup() }
+        let local = w.local.appendingPathComponent("App.app")
+        let external = w.external.appendingPathComponent("App.app")
+        try makeApp(local)
+        do {
+            _ = try await w.service(exchange: { _, _ in throw POSIXError(.EACCES) },
+                administratorOperation: { _ in throw CancellationError() })
+                .moveAndLink(appToMove: item(local), destinationURL: external,
+                             isRunning: false, progressHandler: nil)
+            XCTFail("Expected pending authorization")
+        } catch is CancellationError {}
+        let retained = w.external.appendingPathComponent("Retained.app")
+        try FileManager.default.moveItem(at: external, to: retained)
+        try makeApp(external, payload: "replacement")
+        var prompts = 0
+        do {
+            try await w.service(administratorOperation: { _ in prompts += 1 })
+                .linkAppWhenReady(appToLink: item(external, status: AppStatus.unlinked), destinationURL: local)
+            XCTFail("An unrelated replacement must not be linked over the original")
+        } catch {}
+        XCTAssertEqual(prompts, 0)
+        XCTAssertEqual(try payload(local), "payload")
+        XCTAssertEqual(try payload(retained), "payload")
+        XCTAssertEqual(try payload(external), "replacement")
+    }
+
     func testAuthorizedExchangeRejectsChangesDuringPasswordPrompt() async throws {
         for changed in ["source", "destination", "portal", "parent"] {
             let w = try Workspace(); defer { w.cleanup() }
```

**File**: `AppPortsTests/PortalPresentationTests.swift` (modified, +27/-0)
```diff
@@ -112,10 +112,37 @@ final class PortalPresentationTests: XCTestCase {
         let external: [String: Any] = ["CFBundleVersion": "42", "CFBundleShortVersionString": "1"]
         XCTAssertTrue(PortalPresentation.needsRefresh(local: external, external: external))
         var current = external
+        for oldVersion in 1..<PortalPresentation.formatVersion {
+            current[PortalPresentation.versionKey] = oldVersion
+            XCTAssertTrue(PortalPresentation.needsRefresh(local: current, external: external))
+        }
         current[PortalPresentation.versionKey] = PortalPresentation.formatVersion
         XCTAssertFalse(PortalPresentation.needsRefresh(local: current, external: external))
     }
 
+    func testPortalDoesNotInheritTargetApplicationStartupConfiguration() throws {
+        try withFixture { source, destination in
+            let startup: [String: Any] = [
+                "NSPrincipalClass": "IDEApplication", "NSMainNibFile": "MainMenu",
+                "NSMainStoryboardFile": "Main", "NSServices": [["NSPortName": "Xcode"]],
+                "NSAppleScriptEnabled": true, "OSAScriptingDefinition": "Xcode.sdef",
+                "NSExtension": [:], "NSExtensionSDK": [:],
+                "NSSupportsAutomaticTermination": true, "NSSupportsSuddenTermination": true
+            ]
+            var original = startup
+            original["CFBundleIdentifier"] = "org.example.app"
+            original["CFBundleDocumentTypes"] = [["CFBundleTypeName": "Project"]]
+            original["CFBundleURLTypes"] = [["CFBundleURLSchemes": ["example"]]]
+            try writePlist(original, to: source.appendingPathComponent("Info.plist"))
+            _ = try PortalPresentation.write(from: source, to: destination)
+            let portal = try readPlist(destination.appendingPathComponent("Info.plist"))
+            for key in startup.keys { XCTAssertNil(portal[key], key) }
+            XCTAssertNotNil(portal["CFBundleDocumentTypes"])
+            XCTAssertNotNil(portal["CFBundleURLTypes"])
+            XCTAssertEqual(try readPlist(source.appendingPathComponent("Info.plist"))["NSPrincipalClass"] as? String, "IDEApplication")
+        }
+    }
+
     private func withFixture(_ body: (URL, URL) throws -> Void) throws {
         let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
         defer { try? FileManager.default.removeItem(at: root) }
```

**File**: `Tools/StubLauncher/StubLauncherSource.swift` (modified, +77/-36)
```diff
@@ -1,4 +1,5 @@
 import Cocoa
+import os
 
 /// AppPorts Stub Portal Native Launcher
 ///
@@ -62,56 +63,93 @@ enum DiskMissingStrings {
 }
 
 final class AppDelegate: NSObject, NSApplicationDelegate {
-    var realAppPath: String?
+    private let logger = Logger(subsystem: "com.shimoko.AppPorts.StubLauncher", category: "launch")
+    private var canTerminate = false
+    private var receivedOpenRequest = false
+    private var pendingRequests = 0
+    private var failed = false
 
     func readRealAppPath() -> String {
-        guard let resURL = Bundle.main.resourceURL else {
-            return ""
-        }
+        guard let resURL = Bundle.main.resourceURL else { return "" }
         let pathFile = resURL.appendingPathComponent("real_app_path.txt")
-        if let str = try? String(contentsOf: pathFile, encoding: .utf8) {
-            let trimmed = str.trimmingCharacters(in: .whitespacesAndNewlines)
-            if !trimmed.isEmpty { return trimmed }
-        }
-        return ""
+        return (try? String(contentsOf: pathFile, encoding: .utf8))?
+            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
     }
 
-    func applicationDidFinishLaunching(_ notification: Notification) {
-        realAppPath = readRealAppPath()
-        guard let path = realAppPath, !path.isEmpty,
-              FileManager.default.fileExists(atPath: path) else {
-            showExternalDiskMissing()
-            NSApp.terminate(nil)
-            return
+    func start() {
+        // Some launchers start the process without delivering an initial open
+        // event. AppKit can then defer didFinishLaunching until a second click.
+        // Bootstrap from the event loop itself, independently of that event.
+        DispatchQueue.main.async {
+            self.canTerminate = true
+            if !self.receivedOpenRequest { self.openRealApplication(urls: []) }
+            self.terminateIfFinished()
         }
-        launchApp(at: path)
-        NSApp.terminate(nil)
     }
 
     func application(_ sender: NSApplication, openFiles filenames: [String]) {
-        realAppPath = readRealAppPath()
-        guard let realPath = realAppPath, !realPath.isEmpty,
-              FileManager.default.fileExists(atPath: realPath) else {
+        openRealApplication(urls: filenames.map { URL(fileURLWithPath: $0) }, replyToFiles: true)
+    }
+
+    func application(_ application: NSApplication, open urls: [URL]) {
+        openRealApplication(urls: urls)
+    }
+
+    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
+        // An in-flight launch already activates the real app. Repeated clicks
+        // must not enqueue competing launches while it is starting.
+        if pendingRequests == 0 && !failed { openRealApplication(urls: []) }
+        return false
+    }
+
+    private func openRealApplication(urls: [URL], replyToFiles: Bool = false) {
+        receivedOpenRequest = true
+        logger.info("Opening target; forwarded URLs: \(urls.count)")
+        let path = readRealAppPath()
+        guard !path.isEmpty, FileManager.default.fileExists(atPath: path) else {
+            failed = true
+            logger.error("Target missing: \(path, privacy: .public)")
             showExternalDiskMissing()
-            NSApp.reply(toOpenOrPrint: .failure)
-            NSApp.terminate(nil)
+            if replyToFiles { NSApp.reply(toOpenOrPrint: .failure) }
+            terminateIfFinished()
             return
         }
-        for file in filenames {
-            let proc = Process()
-            proc.executableURL = URL(fileURLWithPath: "/usr/bin/open")
-            proc.arguments = ["-a", realPath, file]
-            try? proc.run()
+        pendingRequests += 1
+        let configuration = NSWorkspace.OpenConfiguration()
+        configuration.activates = true
+        let completion: (NSRunningApplication?, Error?) -> Void = { application, error in
+            DispatchQueue.main.async {
+                self.pendingRequests -= 1
+                let succeeded = application != nil && error == nil
+                if replyToFiles { NSApp.reply(toOpenOrPrint: succeeded ? .success : .failure) }
+                if !succeeded && !self.failed {
+                    self.failed = true
+                    self.logger.error("Launch failed: \(String(describing: error), privacy: .public)")
+                    let alert = NSAlert()
+                    alert.alertStyle = .warning
+                    let chinese = Locale.preferredLanguages.first?.hasPrefix("zh") == true
+                    alert.messageText = chinese ? "无法打开应用" : "Unable to open application"
+                    alert.informativeText = path + "\n\n" + (error?.localizedDescription ??
+                        (chinese ? "系统未能完成启动，请重试。" : "The system could not complete the launch. Try again."))
+                    alert.runModal()
+                }
+                self.terminateIfFinished()
+            }
```

---

### Incident Patch 3: `6bc4a582` (2026-10-20)
**Commit Message**: fix: authorize protected application migration and verified cleanup

**File**: `.agents/notes/implemented/architecture/2026-10-10-verified-transfer-lifecycle.md` (modified, +2/-0)
```diff
@@ -35,6 +35,8 @@ Status: implemented
 
 ## Related decisions
 
+- root 应用的位置交换与已验证原件清理使用[一次性受限管理员授权](../bug-fix/2026-10-20-root应用迁移授权.md)，事务记账仍由普通用户进程持有。
+
 - 复制结束后校验与清理的界面反馈见[按真实工作阶段显示进度](../feature/2026-10-14-data-transfer-progress.md)，界面百分比不替代持久化完成事实。
 - 严格旧还原的根映射、同 ID 重试与私有恢复点见[历史严格还原只映射目标根所有权](../bug-fix/2026-10-02-legacy-volume-restore-ownership.md)。
 
```

**File**: `.agents/notes/implemented/bug-fix/2026-10-20-root应用迁移授权.md` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+# Agent Note: root 所有的应用只授权位置交换和已验证旧副本清理
+
+Status: implemented
+
+## Problem
+
+Xcode 的根目录属于 root、模式为 0755。用户能在 `/Applications` 创建文件，不代表能把这个目录交换到 `.appports-entry-<UUID>/`；跨父目录交换需要移动目录的写权限，`renameatx_np(RENAME_SWAP)` 返回 EACCES。复制和入口准备都已完成才失败，后台恢复重复同样的错误。即使交换成功，root 所有的内部目录仍可能阻止旧副本清理。
+
+## Decision
+
+普通用户进程继续持有操作锁、校验应用、读写 journal 并完成 Dock 等后续步骤。仅在前台迁移的本地交换或原件清理实际返回 EACCES/EPERM，且受阻对象属于 root 时，复用 `DiskUtility.runWithAdministratorPrivileges` 的系统授权框，调用当前 AppPorts 可执行文件的一次性 `--privileged-app-transfer` 入口。启动分流在 SwiftUI、writer 登记、默认设置及登录代理初始化之前完成；不启动管理员 GUI，也不安装特权服务。
+
+授权请求是随机临时目录中的 0600 二进制 plist，目录为 0700，使用后删除。辅助进程要求有效 UID 为 root，以 O_NOFOLLOW 打开请求并核对原调用用户的所有者、普通文件类型、单硬链接、权限和大小上限。它只支持迁移 journal 的入口交换和原件清理，不执行任意命令、不重新签名、不 chown 应用、不写 journal。
+
+密码输入可能很久。交换前辅助进程重新验证源应用、外置候选和入口的原基线、原有有效签名、卷及父目录身份，以及运行状态；对象改变就退出。应用复制 profile 不逐文件哈希，因此授权请求另外使用 SignatureSnapshot 的完整内容指纹绑定密码输入前后的源、候选和入口，避免同长度修改穿过授权边界。清理同样绑定授权前后的保留副本指纹，只接受已提交、签名关联已完成且 deletionStarted 已保存的原件，核对活动外置副本、本地入口、暂存目录、清理身份及原基线，复用 TreeCopySession 的无跟随、可续删清理。权限失败不会降级为无校验 rm；取消授权保留两边副本。
+
+`retryTransfer` 是后台维护路径，不弹授权框。用户主动重试迁移会通过 start/resume 再次获得授权机会；交换完成但清理待授权的事务仍保留原记录和基线。恢复格式与原件位置不变。
+
+## Related decisions
+
+- 部分重叠并保留：[迁移以持久化切换和可重试清理为完成依据](../architecture/2026-10-10-verified-transfer-lifecycle.md)。本修复增加受限授权执行边界，保留其原基线、切换意图和清理记账规则。
+- 部分重叠并保留：[位置变更统一清除旧版更新保护锁](2026-10-17-legacy-update-lock-adoption.md)。授权不接管额外标志，不改变无法恢复记录的收束规则。
+- 其余 ownership、容器挂载、签名修复和数据迁移相关笔记不涉及应用入口的 RENAME_SWAP 授权边界，不修改其决定。
+
+## Alternatives considered
+
+- **递归 chown 本地应用**：可让普通进程完成移动与删除，但持久改变第三方应用所有权，并可能影响内部受保护组件；不采用。
+- **在同一父目录交换**：只读目录的跨父目录限制消失，权限面更小，但仍不能删除 root 所有的内部文件，还要迁移既有 journal 的原件位置；不作为本修复路线。
+- **Finder 删除或先移走本地应用再放入口**：系统提供授权，但两次操作之间本地应用路径缺失，且移到废纸篓不等于释放空间；保留既有原子交换及真实清理。
+- **以管理员启动整个 GUI**：实现简单，但扫描、配置、Dock 和后台代理都获得不必要的权限；只提升一次受限文件操作。
+
+## Consequences
+
+受保护应用的迁移可通过系统密码框继续，不再要求用户改所有者或手改记录。授权可能分别发生在交换和清理，系统通常短时缓存凭据；后台不会反复弹密码框。输入密码期间仍可能出现文件系统竞态，辅助进程沿用现有身份及无跟随校验，并在长校验后、实际交换前重新检查身份，不把管理员权限当成覆盖已变更对象的许可。
+
+新增入口不引入证书或公证要求，采用当前构建的可执行文件；旧安装不会自动获得修复，需要安装新构建。授权边界的完整指纹增加受保护应用的读取开销，只在普通权限已经失败、确需授权时执行。故障注入测试覆盖授权交换、取消、后台不提示、密码框期间同长度内容或路径变更拒绝、原基线清理及冷恢复。自动测试不输入真实管理员密码，也不修改用户已安装的 Xcode。
+
+## Testing
+
+本次本地执行 AppMigrationServiceTests 与 AppTransferTransactionTests 共 128 项通过；最终使用无跟随目录句柄的交换实现另外复验五项授权回归，全部通过。管理员交换使用已打开的父目录和暂存目录句柄，以 fstat/fstatat 核对身份，再执行相对句柄的原子交换，拒绝通过替换暂存目录软链重定向操作。真实系统密码框及 root 所有的 Xcode 迁移没有自动执行，仍需安装新构建后人工确认。
```

**File**: `AppPorts/Appports.swift` (modified, +0/-1)
```diff
@@ -55,7 +55,6 @@ class AppDelegate: NSObject, NSApplicationDelegate {
     }
 }
 
-@main
 struct AppMoverApp: App {
     /// 全局语言管理器
     @StateObject private var languageManager = LanguageManager.shared
```

**File**: `AppPorts/Services/AppMigrationService.swift` (modified, +1/-1)
```diff
@@ -705,7 +705,7 @@ struct AppMigrationService {
                 }
             }, portalMatches: { self.localPortalKind(at: $0, linkedTo: $1) != nil },
             updateDock: retrying ? dockShortcutRetryUpdater : dockShortcutUpdater,
-            runningApplications: runningApplications, hooks: transferHooks)
+            runningApplications: runningApplications, hooks: transferHooks, allowsAdministratorPrompt: !retrying)
     }
 
     private func sameApplicationContainer(_ source: URL, _ destination: URL, folder: Bool) -> Bool {
```

**File**: `AppPorts/Services/AppTransferTransaction.swift` (modified, +43/-8)
```diff
@@ -10,6 +10,8 @@ struct AppTransferHooks {
     var checkpoint: ((Checkpoint, AppTransferRecord) throws -> Void)?
     var synchronizeCleanupParent: (URL) throws -> Void = { try DurableFileIO.syncDirectory(at: $0) }
     var synchronizeStagingParent: (URL) throws -> Void = { try DurableFileIO.syncDirectory(at: $0) }
+    var exchange: (URL, URL) throws -> Void = { try AppTransferTransaction.exchange($0, $1) }
+    var administratorOperation: ((PrivilegedAppTransfer.Request) throws -> Void)?
 }
 
 /// Executes the application's own location journal. It never signs real code.
@@ -30,15 +32,18 @@ final class AppTransferTransaction {
     private let facts: SignatureFactStore
     private let hooks: AppTransferHooks
     private let protection: AppUpdateProtectionStore
+    private let allowsAdministratorPrompt: Bool
 
     init(store: AppTransferStore, fileManager: FileManager, facts: SignatureFactStore,
          buildPortal: @escaping PortalBuilder, portalMatches: @escaping PortalMatcher,
          updateDock: @escaping AppMigrationService.DockShortcutUpdater,
-         runningApplications: @escaping () -> [AppRunningState.RunningApplication], hooks: AppTransferHooks) {
+         runningApplications: @escaping () -> [AppRunningState.RunningApplication], hooks: AppTransferHooks,
+         allowsAdministratorPrompt: Bool = true) {
         self.store = store; self.fileManager = fileManager; self.facts = facts
         self.buildPortal = buildPortal; self.portalMatches = portalMatches; self.updateDock = updateDock
         self.runningApplications = runningApplications; self.hooks = hooks
         self.protection = AppUpdateProtectionStore(transferStore: store)
+        self.allowsAdministratorPrompt = allowsAdministratorPrompt
     }
 
     /// A later signature/location operation must not strand developer evidence
@@ -214,7 +219,7 @@ final class AppTransferTransaction {
             }
             for relative in record.applicationPaths {
                 let url = relative.isEmpty ? source : source.appendingPathComponent(relative)
-                let valid = try signatureIsValid(at: url)
+                let valid = try Self.signatureIsValid(at: url)
                 if let relocation = try facts.captureRelocation(from: url, transferStore: store) {
                     journal.record.signatureRelocations.append(.init(relativePath: relative, relocation: relocation))
                 }
@@ -383,7 +388,7 @@ final class AppTransferTransaction {
         if journal.record.applicationPaths.contains(where: { journal.record.signatureChecks[$0] == nil }) {
             for relative in journal.record.applicationPaths where journal.record.signatureChecks[relative] == nil {
                 let url = relative.isEmpty ? source : source.appendingPathComponent(relative)
-                let valid = try signatureIsValid(at: url)
+                let valid = try Self.signatureIsValid(at: url)
                 if let relocation = try facts.captureRelocation(from: url, transferStore: store) {
                     journal.record.signatureRelocations.append(.init(relativePath: relative, relocation: relocation))
                 }
@@ -426,7 +431,14 @@ final class AppTransferTransaction {
                 throw Self.failure("暂存入口已改变，未切换应用。".localized, at: portal)
             }
             try store.recheckWriterAdmission()
-            try Self.exchange(source, portal)
+            do { try hooks.exchange(source, portal) }
+            catch {
+                guard mayAuthorize(error, at: source) else { throw error }
+                try authorize(.init(action: .exchange, record: journal.record,
+                    sourceBaseline: store.baseline("source", operationID: journal.record.operationID),
+                    candidateBaseline: store.baseline("candidate", operationID: journal.record.operationID),
+                    portalBaseline: captureBaseline(portal)))
+            }
         } else {
             let destination = URL(fileURLWithPath: journal.record.destinationPath)
             try verifyExistingDestination(journal.record)
@@ -800,7 +812,14 @@ final class AppTransferTransaction {
             try checkpoint(.beforeCleanup, journal)
             try requireActive(journal.record)
             try requireOldCopyNotRunning(item, record: journal.record)
-            try remove(baseline, at: url, identity: item.identity, removalID: item.id, partial: true)
+            do { try remove(baseline, at: url, identity: item.identity, removalID: item.id, partial: true) }
+            catch {
+                let retained = try TreeCopySession.retainedRemovalURL(at: url, removalID: item.id) ?? url
+                guard item.role == .source, journal.record.direction == .migrate,
+                      mayAuthorize(error, at: retained) else { throw error }
+                try authorize(.init(action: .remove, record: journal.record, sourceBaseline: baseline,
+                                    cleanupItem: item))
+          
```

**File**: `AppPorts/Services/PrivilegedAppTransfer.swift` (added, +250/-0)
```diff
@@ -0,0 +1,250 @@
+import AppKit
+import Darwin
+import Foundation
+
+/// A one-shot administrator operation, not an elevated GUI or a persistent helper.
+/// The ordinary process keeps its operation lock and owns all journal writes.
+enum PrivilegedAppTransfer {
+    static let argument = "--privileged-app-transfer"
+
+    struct Request: Codable {
+        enum Action: String, Codable { case exchange, remove }
+        let action: Action
+        let record: AppTransferRecord
+        let sourceBaseline: AppTransferBaseline
+        var candidateBaseline: AppTransferBaseline?
+        var portalBaseline: AppTransferBaseline?
+        var cleanupItem: AppTransferCleanupItem?
+        var contentFingerprints: [String: String] = [:]
+
+        func preparedForAuthorization() throws -> Self {
+            var request = self
+            for url in try verificationRoots() {
+                request.contentFingerprints[url.path] = try SignatureSnapshot.fingerprint(of: url)
+            }
+            return request
+        }
+
+        func verificationRoots() throws -> [URL] {
+            guard let portal = record.stagedPortalURL else { throw CocoaError(.fileReadCorruptFile) }
+            if action == .exchange {
+                return [URL(fileURLWithPath: record.sourcePath), URL(fileURLWithPath: record.destinationPath), portal]
+            }
+            guard let item = cleanupItem,
+                  let retained = try TreeCopySession.retainedRemovalURL(at: portal, removalID: item.id) else {
+                throw CocoaError(.fileReadCorruptFile)
+            }
+            return [retained]
+        }
+    }
+
+    static func authorize(_ request: Request) throws {
+        guard let executable = Bundle.main.executableURL else { throw CocoaError(.executableNotLoadable) }
+        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("AppPorts-authorization-" + UUID().uuidString)
+        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false,
+                                               attributes: [.posixPermissions: 0o700])
+        defer { try? FileManager.default.removeItem(at: directory) }
+        let url = directory.appendingPathComponent("request.plist")
+        let encoder = PropertyListEncoder()
+        encoder.outputFormat = .binary
+        let data = try encoder.encode(request)
+        guard FileManager.default.createFile(atPath: url.path, contents: data, attributes: [.posixPermissions: 0o600]) else {
+            throw CocoaError(.fileWriteUnknown)
+        }
+        let result: ShellCommandResult
+        do {
+            result = try DiskUtility.runWithAdministratorPrivileges(executable: executable.path,
+                arguments: [argument, url.path, String(getuid())])
+        } catch DiskUtility.Failure.administratorPromptCancelled {
+            throw CancellationError()
+        }
+        guard result.status == 0 else {
+            throw NSError(domain: "AppPorts.AdministratorTransfer", code: Int(result.status), userInfo: [
+                NSLocalizedDescriptionKey: String(data: result.standardError, encoding: .utf8) ?? ""])
+        }
+    }
+
+    /// Executed before SwiftUI, user defaults, writer registration or login agents initialize.
+    static func runIfRequested() -> Bool {
+        let args = CommandLine.arguments
+        guard args.dropFirst().first == argument else { return false }
+        do {
+            guard geteuid() == 0, args.count == 4, let owner = uid_t(args[3]), owner != 0 else {
+                throw POSIXError(.EPERM)
+            }
+            let fd = open(args[2], O_RDONLY | O_NOFOLLOW)
+            guard fd >= 0 else { throw POSIXError(.EACCES) }
+            let handle = FileHandle(fileDescriptor: fd, closeOnDealloc: true)
+            defer { try? handle.close() }
+            var info = stat()
+            guard fstat(fd, &info) == 0, info.st_mode & S_IFMT == S_IFREG,
+                  info.st_uid == owner, info.st_mode & 0o777 == 0o600, info.st_nlink == 1,
+                  info.st_size > 0, info.st_size <= 256 * 1024 * 1024 else { throw POSIXError(.EPERM) }
+            let request = try PropertyListDecoder().decode(Request.self, from: handle.readToEnd() ?? Data())
+            try perform(request)
+            return true
+        } catch {
+            FileHandle.standardError.write(Data((error.localizedDescription + "\n").utf8))
+            exit(1)
+        }
+    }
+
+    /// Internal for isolated fixtures. The command-line entry above always requires root.
+    static func perform(_ request: Request) throws {
+        let record = request.record
+        let source = URL(fileURLWithPath: record.sourcePath)
+        let destination = URL(fileURLWithPath: record.destinationPath)
+        let parent = source.deletingLastPathComponent()
+        let stage = parent.appendingPathComponent(".appports-entry-" + record.operationID.uuidString)
+        guard record.direction
```

**File**: `AppPortsTests/AppTransferTransactionTests.swift` (modified, +126/-2)
```diff
@@ -27,10 +27,13 @@ final class AppTransferTransactionTests: XCTestCase {
                      running: @escaping () -> [AppRunningState.RunningApplication] = { [] },
                      storeOverride: AppTransferStore? = nil,
                      synchronizeCleanupParent: @escaping (URL) throws -> Void = { try DurableFileIO.syncDirectory(at: $0) },
-                     synchronizeStagingParent: @escaping (URL) throws -> Void = { try DurableFileIO.syncDirectory(at: $0) }) -> AppMigrationService {
+                     synchronizeStagingParent: @escaping (URL) throws -> Void = { try DurableFileIO.syncDirectory(at: $0) },
+                     exchange: @escaping (URL, URL) throws -> Void = { try AppTransferTransaction.exchange($0, $1) },
+                     administratorOperation: ((PrivilegedAppTransfer.Request) throws -> Void)? = nil) -> AppMigrationService {
             AppMigrationService(dockShortcutUpdater: dock, transferStore: storeOverride ?? store, signatureFactStore: facts,
                                 transferHooks: .init(checkpoint: hook, synchronizeCleanupParent: synchronizeCleanupParent,
-                                                     synchronizeStagingParent: synchronizeStagingParent),
+                                                     synchronizeStagingParent: synchronizeStagingParent,
+                                                     exchange: exchange, administratorOperation: administratorOperation),
                                 runningApplications: running)
         }
 
@@ -49,6 +52,127 @@ final class AppTransferTransactionTests: XCTestCase {
         }
     }
 
+    func testPermissionDeniedExchangeUsesAuthorizedVerifiedOperation() async throws {
+        let w = try Workspace(); defer { w.cleanup() }
+        let source = w.local.appendingPathComponent("App.app")
+        let destination = w.external.appendingPathComponent("App.app")
+        try makeApp(source)
+        var prompts = 0
+        let result = try await w.service(exchange: { _, _ in throw POSIXError(.EACCES) }, administratorOperation: {
+            prompts += 1
+            try PrivilegedAppTransfer.perform($0)
+        }).moveAndLink(appToMove: item(source), destinationURL: destination, isRunning: false, progressHandler: nil)
+        XCTAssertTrue(result.isComplete, result.pendingMessage ?? "")
+        XCTAssertEqual(prompts, 1)
+        XCTAssertEqual(try payload(destination), "payload")
+        XCTAssertEqual(try CodeSigner.resolveAppURL(at: source).path, destination.path)
+        XCTAssertTrue(try w.store.records().isEmpty)
+        try assertNoStages(w)
+    }
+
+    func testCancelledAuthorizationPreservesBothCopiesAndBackgroundRetryDoesNotPrompt() async throws {
+        let w = try Workspace(); defer { w.cleanup() }
+        let source = w.local.appendingPathComponent("App.app")
+        let destination = w.external.appendingPathComponent("App.app")
+        try makeApp(source)
+        var prompts = 0
+        let service = w.service(exchange: { _, _ in throw POSIXError(.EACCES) }, administratorOperation: { _ in
+            prompts += 1
+            throw CancellationError()
+        })
+        do {
+            _ = try await service.moveAndLink(appToMove: item(source), destinationURL: destination,
+                                            isRunning: false, progressHandler: nil)
+            XCTFail("Expected cancelled authorization")
+        } catch is CancellationError {} catch { XCTFail("Unexpected error: \(error)") }
+        let record = try XCTUnwrap(w.store.records().first)
+        XCTAssertFalse(record.isSwitchComplete)
+        XCTAssertEqual(try payload(source), "payload")
+        XCTAssertEqual(try payload(destination), "payload")
+        do {
+            _ = try await service.retryTransfer(operationID: record.id)
+            XCTFail("Background retry must leave the permission error pending")
+        } catch { XCTAssertEqual((error as NSError).code, Int(EACCES)) }
+        XCTAssertEqual(prompts, 1)
+        let recovered = try await w.service().retryTransfer(operationID: record.id)
+        XCTAssertTrue(recovered.isComplete)
+    }
+
+    func testAuthorizedExchangeRejectsChangesDuringPasswordPrompt() async throws {
+        for changed in ["source", "destination", "portal", "parent"] {
+            let w = try Workspace(); defer { w.cleanup() }
+            let source = w.local.appendingPathComponent("App.app")
+            let destination = w.external.appendingPathComponent("App.app")
+            try makeApp(source)
+            let service = w.service(exchange: { _, _ in throw POSIXError(.EPERM) }, administratorOperation: { request in
+                switch changed {
+                case "source": try Data("changed".utf8).write(to: source.appendingPathComponent("Contents/Resources/payload"))
+                case "destination": try Data("changed".utf8).write(to: destination.appendingPathComponent("Contents/Resources/payload"))
+                case "
```

#### Recent Merged Pull Requests:
- **PR #86** (2026-10-21): 修正bug，调整UI，引入后台任务、微信拆分与加密卷恢复等多项功能，具体见commit (@trah01)
- **PR #85** (2026-10-19): feat: warn when restoring a bundle that was already degraded on its volume (@wzh4869)
- **PR #84** (closed): feat: warn when restoring a bundle that was already degraded on its volume (@wzh4869)
- **PR #83** (2026-10-19): feat: relax app bundle migration to a product-integrity copy profile (@wzh4869)
- **PR #76** (2026-10-14): docs: add Agent Notes guide and Codex skill discovery (@wzh4869)
- **PR #75** (2026-10-14): docs: vendor Agent Notes skill and migrate decision records (@wzh4869)

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

## X. 应用数据): 「锁定目录结构」只补回可操作项的上游祖先

**RULE**:
When implementing operations in `.agents/notes/implemented/bug-fix/2026-10-22-locked-structure-shows-actionable-ancestors.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in wzh4869/AppPorts. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e0302b07`: 应用数据): 「锁定目录结构」只补回可操作项的上游祖先. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `.agents/notes/implemented/bug-fix/2026-10-22-locked-structure-shows-actionable-ancestors.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
# Agent Note: 「锁定目录结构」改为只补回可操作项之上的锁定祖先

Status: implemented

## Problem

应用数据页的两个可见性开关单独勾选时都没有效果，只有同时勾上才会出现锁定行：

```swift
if isMigrationUnsupported && !showNonMigratableDirectories { return false }  // 第三道门
if !isMigratable { return showLockedStructure }                              // 第二道门
```

`isMigrationUnsupported` 是 `!isMigratable` 的子集，而子集之外那些“不能迁移但还能接回/挂载/恢复”的行本来就被 `needsRecoveryOrAttention` 强制显示。于是「显示锁定目录结构」能多显示的内容只剩空集：勾上它，列表纹丝不动，用户只会怀疑开关坏了。

同时两个开关的语义也没有区分开：它们覆盖的行完全重叠，等于同一个过滤器的两道锁。

## Decision

把两个开关拆成两种不同的问题：

- **显示锁定目录结构**（`showLockedStructure`）只在树层生效：补回**可操作项之上的锁定祖先**，用来交代层级。没有可操作子项的锁定目录不会因为打开它而出现。判定在 `DataDirTree.visibleItems`：

  ```swift
  guard showLockedStructure, !showNonMigratableDirectories else { return base }
  let prefix = item.path.standardizedFileURL.path + "/"
  return basePaths.contains { $0.hasPrefix(prefix) }
  ```

- **显示不支持迁移目录**（`showNonMigratableDirectories`）保持“全量放出”的语义，作用在 `DataDirItem.matchesVisibility` 的单条判断上。

`matchesVisibility` 因此回到两个参数：它只回答“这一条本身该不该出现”，祖先补充交给树层，避免让单条判断依赖兄弟节点。

表头计数改为按最终渲染的行数统计（`visibleLibraryItemCount`），否则补回的祖先行会让“显示 X / 67”和列表对不上。

`DataDirTree.visibleTree` 的 `showNonMigratableDirectories` 默认值改为 `false`：默认只显示可操作内容，需要更多内容由调
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e0302b07` are properly handled with clean fallback behavior.
