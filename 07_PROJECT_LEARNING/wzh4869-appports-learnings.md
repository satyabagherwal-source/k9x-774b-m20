> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/wzh4869-appports-learnings.md`  
> **Source**: github ([https://github.com/wzh4869/AppPorts](https://github.com/wzh4869/AppPorts))  
> **Source Version**: `c5d2026b`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-09T01:01:25.022Z  
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
> **Harvest Timestamp**: 2026-11-09T01:01:25.014Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wzh4869/AppPorts`
- **Description**: 📦 A macOS utility to seamlessly migrate applications to external storage and reclaim local disk space.【一款 macOS 工具，无缝迁移应用到外部存储并自动建立链接，释放宝贵的本地空间】
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2213 stars

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

    func isOnlyOperation(_ token: UUID) -> Bool {
        activeOperation == token && migrationCount == 0
    }

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

### Core Architecture Module: `AppPorts/Utils/AppLibraryVolumeObserver.swift`
```
import AppKit

/// Directory descriptors belong to one mount session. A workspace volume event
/// must rebuild library monitoring and refresh both sides of the app list.
@MainActor
final class AppLibraryVolumeObserver {
    private let center: NotificationCenter
    private var observers: [NSObjectProtocol] = []
    private var generation = UUID()

    init(center: NotificationCenter) { self.center = center }

    func start(onChange: @escaping @MainActor (_ isMount: Bool) -> Void) {
        stop()
        let generation = generation
        for (name, isMount) in [(NSWorkspace.didMountNotification, true), (NSWorkspace.didUnmountNotification, false)] {
            observers.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor [weak self] in
                    guard let self, self.generation == generation else { return }
                    onChange(isMount)
                }
            })
        }
    }

    func stop() {
        generation = UUID()
        observers.forEach { center.removeObserver($0) }
        observers.removeAll()
    }

    deinit { observers.forEach { center.removeObserver($0) } }
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
/// - Note: Actor 串行维护应用身份信息；只读大小统计可在后台独立并发，不阻塞 UI。
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

    enum AppSizeMode: Sendable {
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
    nonisolated func calculateDirectorySize(at url: URL, mode: AppSizeMode = .logicalContent) -> Int64 {
        guard !Task.isCancelled else { return 0 }
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
            guard !Task.isCancelled else { return size }
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
    nonisolated func calculateDisplayedSize(for app: AppItem, isLocalEntry: Bool) -> Int64 {
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
                            || runningAppURLs.contains(itemURL.appendingPathComponent(bundleURL.lastPathCompo
```

### Core Architecture Module: `AppPorts/Utils/ApplicationLaunchGate.swift`
```
import CryptoKit
import Darwin
import Foundation

/// Shared by AppPorts and its native portal launcher. Never unlink lock files:
/// all participants must keep referring to the same inode.
enum ApplicationLaunchGate {
    enum Failure: Error, Equatable { case busy, inspection }

    final class Lease: @unchecked Sendable {
        private let descriptor: Int32
        fileprivate init(_ descriptor: Int32) { self.descriptor = descriptor }
        deinit { close(descriptor) }
    }

    static var defaultDirectory: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("AppPorts/launch-locks", isDirectory: true)
    }

    static func acquire(bundleIdentifier: String, migrating: Bool,
                        directory: URL = defaultDirectory) throws -> Lease {
        guard !bundleIdentifier.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw Failure.inspection }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700])
        let parent = open(directory.path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
        guard parent >= 0 else { throw Failure.inspection }
        defer { close(parent) }
        var info = stat()
        guard fstat(parent, &info) == 0, info.st_uid == getuid(), info.st_mode & 0o077 == 0 else { throw Failure.inspection }
        let name = SHA256.hash(data: Data(bundleIdentifier.utf8)).map { String(format: "%02x", $0) }.joined() + ".lock"
        let fd = openat(parent, name, O_CREAT | O_RDWR | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK, 0o600)
        guard fd >= 0 else { throw Failure.inspection }
        guard fstat(fd, &info) == 0, info.st_mode & S_IFMT == S_IFREG,
              info.st_uid == getuid(), info.st_nlink == 1, info.st_mode & 0o077 == 0 else {
            close(fd)
            throw Failure.inspection
        }
        guard flock(fd, (migrating ? LOCK_EX : LOCK_SH) | LOCK_NB) == 0 else {
            let code = errno
            close(fd)
            throw code == EWOULDBLOCK ? Failure.busy : .inspection
        }
        return Lease(fd)
    }

    static let busyMessage = "正在迁移或迁回应用数据，请等待完成后再打开。"
    static let unavailableMessage = "无法确认应用数据迁移状态，请打开 AppPorts 检查后重试。"
    static func message(busy: Bool, languages: [String] = Locale.preferredLanguages) -> String {
        PortalLocalizedStrings.text(busy ? busyMessage : unavailableMessage, languages: languages)
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #93** (2026-10-28): **[BUG] 文件很多的目录做挂载迁移时，lsof +D 超过 30 秒导致「无法完成数据安全检查」**
  *Symptoms*: ### 问题描述 / Problem  **环境** - AppPorts 2.0.0 (50) - Mac17,14（M5 Max），macOS 27.2 - 微信 4.1.15，拆分迁移（msg + business）到外置 APFS 盘  **现象** 迁移微信 msg 目录（约 140 万个文件，约 228GB）时，任务在 0% 失败，提示「无法完成数据安全检查」。重试多次都一样。  **原因** DataOperationSafety.swift 中 requireNoKnownWriters（约第 141 行）调用： `/usr/sbin/lsof -nP -F pcfa +D <path>，timeout: 30` 在这台机器上，对 msg 目录单独执行这条命令需要约 32 秒（缓存已热），超过 30 秒就会被当作检查失败抛出 .inspection。文件越多越容易触发。  **验证** 我把 timeout 从 30 改为 1800，本地编译（ad-hoc 签名），重新授予完全磁盘访问权限和 App 管理权限后重试，同一目录迁移成功。  **建议** 1. 放宽这一步的超时，或按文件数量动态计算； 2. 或者改为不带 +D，执行一次 lsof -F 取全量输出，再在代码里按路径前缀过滤，速度会快很多； 3. 超时的时候，错误提示里最好写明是“检查超时”，而不是笼统的“无法完成数据安全检查”。  ### 复现步骤（选填） / Steps to reproduce (optional)  _No response_  ### 发生问题的操作 / Affected operation  微信账号全部或拆分迁移 / Whole or split WeChat account migration  ### AppPorts 版本 / AppPorts version  2.0.0  ### Build 号（选填） / Build number (optional)  50  ### macOS 版本 / macOS version  macOS 27  ### Mac 芯片 / Mac processor  Apple Silicon（M 系列 / M-series）  ### 外置存储类型 / External storage type  None  ### 目标存储的文件系统 / Destination filesystem  APFS  ### 相关外置卷或数据卷是否加密 / External or data volume encryption  None  ### 环境补充（选填） / Additional environment details (optional)  macOS 27.2；Mac17,14（M5 Max）；微信 4.1.15  ### 截图（选填） / Screenshots (optional)  _No response_  ### 诊断包或相关日志（选填） / Diagnostic package or relevant logs (optional)  _No response_

- **Issue #88** (2026-10-24): **[BUG] Cursor 在迁移了应用数据后无法正常更新**
  *Symptoms*: ### 问题描述 / Problem  点击 Update 按钮后显示无法完成更新  ![](https://i.imgur.com/nqVvUwr.png) ![](https://i.imgur.com/Z3MayWA.png)  ### 复现步骤（选填） / Steps to reproduce (optional)  _No response_  ### 发生问题的操作 / Affected operation  应用链接、启动或更新 / App linking, launching or updating  ### AppPorts 版本 / AppPorts version  1.9.3  ### Build 号（选填） / Build number (optional)  _No response_  ### macOS 版本 / macOS version  macOS 27  ### Mac 芯片 / Mac processor  Apple Silicon（M 系列 / M-series）  ### 外置存储类型 / External storage type  外置 SSD / External SSD  ### 目标存储的文件系统 / Destination filesystem  APFS  ### 相关外置卷或数据卷是否加密 / External or data volume encryption  已加密 / Encrypted  ### 环境补充（选填） / Additional environment details (optional)  _No response_  ### 截图（选填） / Screenshots (optional)  _No response_  ### 诊断包或相关日志（选填） / Diagnostic package or relevant logs (optional)  _No response_

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

### Incident Patch 1: `1d86020e` (2026-11-08)
**Commit Message**: fix: 支持应用库映像卸载并暂停自动挂载

**File**: `.agents/notes/implemented/bug-fix/2026-11-08-应用库映像主动卸载.md` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+# Agent Note: 应用库映像主动卸载与自动恢复暂停
+
+Status: implemented
+
+## Problem
+
+应用库位于 NAS 或 U 盘内的 APFS sparsebundle 时，工具栏弹出入口只查询物理外盘清单，映像没有物理磁盘身份，因此操作被拒绝。单独卸载而不保存暂停状态，又会被后台映像恢复或映像内数据卷重挂立即接回。
+
+## Decision
+
+弹出服务在持有 OperationLock 后读取当前选中的映像记录，按应用库路径边界识别目标。映像由共享 AppLibraryImageService 通过 hdiutil 设备清单和 APFS UUID 核对，使用非强制 detach 卸载映像根设备；不请求 Finder 弹出承载磁盘，也不卸载 SMB 共享。已经没有附件时保留暂停并按完成处理。未确认退出的写命令继续持锁等待。
+
+DiskEjectionPauseStore 在发出 detach 前持久化独立的映像暂停，包含映像文件路径、映像内卷 UUID 和挂载路径。共享 Snapshot.blocks 同时约束容器挂载、迁移与恢复；后台映像恢复、主窗口自动恢复和原生启动入口（包括已就绪的只读快速检查）均检查暂停。失败或文件占用保留暂停，只有明确打开或重新挂载映像成功后才移除该映像暂停；底层磁盘重新连接不解除映像暂停。物理磁盘暂停仍独立生效。
+
+暂停文件含映像状态时采用 schemaVersion 2，读取兼容原 schemaVersion 1；旧程序拒绝版本 2，避免把新状态当作无暂停。无映像暂停时继续写版本 1，物理盘状态保存与重连核对均保留映像状态。这不是迁移账本格式变更。旧后台程序仍需退出并使用新版，不能据此保证任意旧版前台显式映像挂载都遵守新增状态。
+
+映像目标的工具栏按钮显示“卸载映像”，暂停后显示现有暂停状态；恢复使用原“重新挂载映像”入口。两个新文案和该恢复按钮覆盖全部 22 种语言。
+
+## Existing-note audit
+
+- [主动弹出外盘](../feature/2026-10-23-explicit-disk-ejection.md)：部分重叠，物理盘流程保留；映像使用独立设备核对与暂停生命周期。
+- [SMB 上的 APFS 应用库映像](../feature/2026-10-29-SMB上的APFS应用库映像.md)：部分重叠，增加主动卸载入口，创建与迁移边界保留。
+- [应用库映像后台自动挂载](../feature/2026-11-03-应用库映像后台自动挂载.md)：部分重叠，主动卸载暂停优先于自动恢复。
+- [启动迁移应用时静默接回映像](../feature/2026-11-03-启动迁移应用时静默接回映像.md)：部分重叠，显式暂停时不通过启动入口接回。
+- 关键词检索未发现 proposed/rejected 中相同卸载方案；并行复制提案与本次无关，不变更其状态。
+
+## Alternatives considered
+
+- 让 Finder 弹出承载卷能沿用现有入口，但会影响 U 盘其他文件或断开整个 NAS 共享，超出卸载映像的范围。
+- 只在映像记录内增加暂停标志改动较少，但容器重挂和其他恢复入口不会读取它，尤其无法约束部分卸载后的数据卷，因此复用共享暂停快照。
+- 强制 detach 能绕过文件占用，但可能中断仍在写入的应用，保留系统拒绝与重试路径更合适。
+
+## Consequences
+
+NAS 和本地外盘上的受管映像共用卸载流程，承载存储保持连接。卸载失败也暂停自动恢复，用户需先关闭占用映像的应用后再次卸载，或明确重新挂载恢复。挂载位置被替代、卷身份不匹配或暂停记录无法读取时停止操作。仅处理当前选中且已记录 UUID 的应用库映像，不接管任意 Finder 映像；网络失联与系统占用仍可能导致非强制卸载失败。
+
+## Verification
+
+补充隔离回归用例：NAS/USB 路由绕过物理清单、整映像设备卸载与子数据卷暂停、占用失败保留暂停、底层重连接不解除暂停、物理暂停独立保存，以及后台和原生启动恢复拒绝接回。
+
+6 个修改的应用源文件及新增回归测试文件通过 swiftc -frontend -parse 语法检查；字符串目录 JSON 解析、3 个相关键的全部 22 种语言覆盖检查通过；笔记的结构、格式与相对链接门禁通过。
+
+未构建或运行测试，未操作真实 NAS、U 盘和用户映像。语法解析不代表类型检查或完整编译通过；需使用新版实机确认忙碌提示、主动卸载、退出重开后的暂停和明确重新挂载。
```

**File**: `.agents/notes/implemented/feature/2026-10-23-explicit-disk-ejection.md` (modified, +2/-0)
```diff
@@ -8,6 +8,8 @@ Finder 已能联动弹出分散挂载的 APFS 卷，但 AppPorts 的主程序和
 
 ## Decision
 
+映像的主动卸载及持久化自动恢复暂停见[应用库映像主动卸载](../bug-fix/2026-11-08-应用库映像主动卸载.md)，物理磁盘重连不会解除该暂停。
+
 本篇显式“取消弹出并恢复挂载”的决定由[仅通过重连接恢复](../simplification/2026-10-24-disk-reconnect-only.md)取代；以下保留该选择的原理由和对应验证，其余主动弹出与暂停规则继续适用。
 
 在外部应用库标题旁加入弹出入口及暂停后的重试、恢复入口。用户于 2026-10-23 确认实施；新增文案现已[补齐全部 22 语言](../testing/2026-10-23-本地化覆盖与英文占位守卫.md)，临时中英文范围与定向英文回退已结束。
```

**File**: `.agents/notes/implemented/feature/2026-10-29-SMB上的APFS应用库映像.md` (modified, +2/-0)
```diff
@@ -8,6 +8,8 @@ Status: implemented
 
 ## Decision
 
+映像的主动卸载及持久化自动恢复暂停见[应用库映像主动卸载](../bug-fix/2026-11-08-应用库映像主动卸载.md)，物理磁盘重连不会解除该暂停。
+
 单卷限制由[按所选映像使用应用库卷](../bug-fix/2026-11-03-按所选映像使用应用库卷.md)部分取代，多卷映像按保存 UUID 或首次选择优先级定位，其他创建和恢复规则继续适用。
 
 外部应用库提供创建、打开、重新挂载映像入口。复用系统映像工具和现有命令执行器；创建不覆盖已有路径。创建时探测 `diskutil image create blank --help` 是否支持 UDSB，支持时使用现代创建接口和精确字节容量，否则使用旧系统的 hdiutil。挂载同样探测 DiskImages2，否则使用 hdiutil；现代接口执行失败不自动切换后端。通过 hdiutil 的映像设备关系及 diskutil 的 APFS UUID 核对目标，不按卷名称接受目标。
```

**File**: `.agents/notes/implemented/feature/2026-11-03-启动迁移应用时静默接回映像.md` (modified, +2/-0)
```diff
@@ -10,6 +10,8 @@ Status: implemented
 
 入口辅助程序依赖及安装位置要求由[按操作检查安装位置与普通入口独立启动](../bug-fix/2026-11-04-按操作检查安装位置与普通入口独立启动.md)收窄：只在应用或其数据关联映像时保存 helper；普通入口独立启动，既有入口随数据记录变化刷新元数据。
 
+映像的主动卸载及持久化自动恢复暂停见[应用库映像主动卸载](../bug-fix/2026-11-08-应用库映像主动卸载.md)，物理磁盘重连不会解除该暂停。
+
 原生 portal 在转发启动前运行 AppPorts 的无窗口 `--prepare-image-launch` 入口。成功时直接继续 NSWorkspace 启动，不展示准备界面；失败后才显示既有存储提示。启动、文件和 URL 请求在准备阶段排队，共用一次准备任务；启动共享租约从准备前保持到真实启动完成，避免数据迁移在准备和转发之间开始。
 
 portal 格式升级到 8，保存本机 AppPorts 可执行路径；应用来自当前已记录应用库映像时，在入口保存映像记录。现有已迁移入口沿用完整 staging、签名与原子替换刷新机制升级，不修改外部真实应用。主程序与 SMB 连接子进程都在 SwiftUI 初始化之前分派，无需显示 AppPorts 主窗口。
```

**File**: `.agents/notes/implemented/feature/2026-11-03-应用库映像后台自动挂载.md` (modified, +2/-0)
```diff
@@ -10,6 +10,8 @@ Status: implemented
 
 前台创建、打开、手动重挂以及自动恢复的运行位置检查见[按操作检查安装位置与普通入口独立启动](../bug-fix/2026-11-04-按操作检查安装位置与普通入口独立启动.md)。后台代理的恢复调度职责保持不变。
 
+映像的主动卸载及持久化自动恢复暂停见[应用库映像主动卸载](../bug-fix/2026-11-08-应用库映像主动卸载.md)，物理磁盘重连不会解除该暂停。
+
 原生启动入口的按需准备见[启动迁移应用时静默接回映像](2026-11-03-启动迁移应用时静默接回映像.md)，独立于登录代理定时重试，只接回本次应用所需的映像及数据。
 
 映像内卷定位沿用[按所选映像使用应用库卷](../bug-fix/2026-11-03-按所选映像使用应用库卷.md)，不再要求只有一个可写 APFS 卷，已有未挂载附件也可直接定位使用。
```

**File**: `AppPorts/Localizable.xcstrings` (modified, +404/-10)
```diff
@@ -223756,19 +223756,413 @@
         }
       }
     },
+    "卸载映像" : {
+      "extractionState": "manual",
+      "localizations": {
+        "ar": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "إلغاء تحميل الصورة"
+          }
+        },
+        "br": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "⠠⠥⠝⠍⠕⠥⠝⠞ ⠠⠊⠍⠁⠛⠑"
+          }
+        },
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Image aushängen"
+          }
+        },
+        "en": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Unmount Image"
+          }
+        },
+        "eo": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Malmunti diskobildon"
+          }
+        },
+        "es": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Desmontar imagen"
+          }
+        },
+        "fr": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Démonter l’image"
+          }
+        },
+        "hi": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "इमेज अनमाउंट करें"
+          }
+        },
+        "id": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Lepas image"
+          }
+        },
+        "it": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Smonta immagine"
+          }
+        },
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "イメージをアンマウント"
+          }
+        },
+        "ko": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "이미지 마운트 해제"
+          }
+        },
+        "nl": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Schijfkopie ontkoppelen"
+          }
+        },
+        "pl": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Odłącz obraz"
+          }
+        },
+        "pt": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Desmontar imagem"
+          }
+        },
+        "ru": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Отключить образ"
+          }
+        },
+        "th": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "เลิกเมานต์อิมเมจ"
+          }
+        },
+        "tr": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "İmajın bağlantısını kes"
+          }
+        },
+        "vi": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Ngắt kết nối ảnh đĩa"
+          }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "卸载映像"
+          }
+        },
+        "zh-Hant": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "卸載映像"
+          }
+        },
+        "zh-martian": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "卸載映像"
+          }
+        }
+      }
+    },
+    "卸载映像并暂停自动挂载，选择“重新挂载映像”可恢复。" : {
+      "extractionState": "manual",
+      "localizations": {
+        "ar": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "يلغي تحميل الصورة ويوقف التحميل التلقائي مؤقتًا. اختر «تحميل الصورة مجددًا» للاستئناف."
+          }
+        },
+        "br": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "⠠⠥⠝⠍⠕⠥⠝⠞ ⠞⠓⠑ ⠊⠍⠁⠛⠑ ⠁⠝⠙ ⠏⠁⠥⠎⠑ ⠁⠥⠞⠕⠍⠁⠞⠊⠉ ⠍⠕⠥⠝⠞⠊⠝⠛⠲ ⠠⠉⠓⠕⠕⠎⠑ ⠦⠠⠍⠕⠥⠝⠞ ⠠⠊⠍⠁⠛⠑ ⠠⠁⠛⠁⠊⠝⠴ ⠞⠕ ⠗⠑⠎⠥⠍⠑⠲"
+          }
+        },
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Hängt das Image aus und pausiert das automatische Einbinden. Wähle „Image erneut einbinden“, um es fortzusetzen."
+          }
+        },
+        "en": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Unmount the image and pause automatic mounting. Choose “Mount Image Again” to resume."
+          }
+        },
+        "eo": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Malmuntu la diskobildon kaj paŭzigu aŭtomatan muntadon. Elektu “Remunti diskobildon” por daŭrigi."
+          }
+        },
+        "es": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Desmonta la imagen y pausa el montaje automático. Elige «Volver a montar imagen» para reanudarlo."
+          }
+        },
+        "fr": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Démonte l’image et suspend le montage automatique. Choisissez «Remonter l’image» pour le réactiver."
+     
```

**File**: `AppPorts/Services/AppLibraryImageRecovery.swift` (modified, +6/-6)
```diff
@@ -115,7 +115,7 @@ enum AppLibraryImageRecovery {
         var record = original
         let expectedRecord = original
         do {
-            guard !ejection.blocks(volumeUUIDs: [record.backingVolumeUUID], paths: [record.imagePath]) else { return }
+            guard !ejection.blocksImage(record) else { return }
             let shareLocation = findShare ?? { try await service.files.mountedShare(for: $0) }
             if let address = record.networkShareURL, let remote = URL(string: address),
                sanitizedShareURL(remote)?.absoluteString == address,
@@ -135,7 +135,7 @@ enum AppLibraryImageRecovery {
             let alreadyMounted = record.volumeUUID.map { actualUUID?.caseInsensitiveCompare($0) == .orderedSame } ?? false
             if alreadyMounted, record.backingVolumeUUID != nil || record.networkShareURL != nil { return }
             record = try await service.files.resolved(record)
-            guard !ejection.blocks(volumeUUIDs: [record.backingVolumeUUID], paths: [record.imagePath]) else { return }
+            guard !ejection.blocksImage(record) else { return }
             if record.imagePath != expectedRecord.imagePath {
                 // Both USB and SMB may reappear at another /Volumes path.
                 // An old device attachment must not become a second writer.
@@ -177,8 +177,8 @@ enum AppLibraryImageRecovery {
     static func restoreForLaunch(_ original: AppLibraryImageService.Record,
                                  service: AppLibraryImageService,
                                  ejection: DiskEjectionPauseStore.Snapshot) async throws -> AppLibraryImageService.Record {
-        guard !ejection.blocks(volumeUUIDs: [original.backingVolumeUUID], paths: [original.imagePath]) else {
-            throw DiskEjectionError.paused
+        guard !ejection.blocksImage(original) else {
+            throw ManualMountPauseError.retryPaused
         }
         var record = original
         if let address = record.networkShareURL {
@@ -193,7 +193,7 @@ enum AppLibraryImageRecovery {
             record.imagePath = root.appendingPathComponent(relative).path
         }
         record = try await service.files.resolved(record)
-        guard !ejection.blocks(volumeUUIDs: [record.backingVolumeUUID], paths: [record.imagePath]) else { throw DiskEjectionError.paused }
+        guard !ejection.blocksImage(record) else { throw ManualMountPauseError.retryPaused }
         if record.imagePath != original.imagePath {
             let inventory = try await AppLibraryImageFileAccess.readCommand(runner: service.runner,
                 executable: "/usr/bin/hdiutil", arguments: ["info", "-plist"], timeout: 10)
@@ -218,7 +218,7 @@ enum AppLibraryImageRecovery {
                                    service: AppLibraryImageService,
                                    ejection: DiskEjectionPauseStore.Snapshot) async throws -> Bool {
         guard let uuid = record.volumeUUID,
-              !ejection.blocks(volumeUUIDs: [record.backingVolumeUUID], paths: [record.imagePath]) else { return false }
+              !ejection.blocksImage(record) else { return false }
         var current = record
         if let address = record.networkShareURL {
             guard let remote = URL(string: address), sanitizedShareURL(remote)?.absoluteString == address,
```

**File**: `AppPorts/Services/AppLibraryImageService.swift` (modified, +26/-0)
```diff
@@ -229,6 +229,32 @@ struct AppLibraryImageService: Sendable {
         return result
     }
 
+    /// Caller holds OperationLock. Detach only the selected image, never its backing disk/share.
+    func unmount(_ record: Record, pauses: DiskEjectionPauseStore) async throws {
+        guard let expected = record.volumeUUID, UUID(uuidString: expected) != nil else { throw identityFailure() }
+        let image = URL(fileURLWithPath: record.imagePath)
+        guard let devices = try await imageDevices(for: image) else {
+            try pauses.pauseImage(record, volumeUUIDs: [], mountPaths: [])
+            return
+        }
+        _ = try await identifiedVolume(devices, expectedUUID: expected,
+                                      preferredMount: record.libraryPath ?? record.mountPath)
+        let uuids = try await volumeUUIDs(in: record)
+        // Persist before dispatch: denial, busy files and partial unmounts must not trigger remount.
+        try pauses.pauseImage(record, volumeUUIDs: uuids, mountPaths: Set(devices.compactMap(\.mount)))
+        do {
+            try await detachOwnedImage(image, devices: devices)
+        } catch let pending as ShellCommandUnconfirmedTermination {
+            // A timed-out detach may still be writing. Keep the caller's lock
+            // until it exits, just as attachment and creation do.
+            while (try? ProcessCommandRunner.isRunning(pending.process)) != false {
+                await Task.detached { try? await Task.sleep(nanoseconds: 1_000_000_000) }.value
+            }
+            throw pending
+        }
+        guard try await imageDevices(for: image) == nil else { throw identityFailure() }
+    }
+
     private func detachOwnedImage(_ image: URL, devices: [ImageDevice]) async throws {
         guard let current = try await imageDevices(for: image) else { return }
         guard Set(current.map(\.device)) == Set(devices.map(\.device)),
```

---

### Incident Patch 2: `0de95d95` (2026-11-06)
**Commit Message**: fix(l10n): complete image library and permission guide translations

**File**: `.agents/notes/implemented/feature/2026-10-29-SMB上的APFS应用库映像.md` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ Status: implemented
 
 ## Consequences
 
-外部应用库的“磁盘映像”菜单提供创建、打开及重新挂载入口。底层仍使用现有应用迁移事务，应用通过 APFS 保存文件元数据；用户需要管理映像容量与挂载生命周期。命令使用参数数组，不拼 shell；已有目标不覆盖；只有来自选定映像的单个可写 APFS 卷且 UUID 符合记录才成为应用库；失败保留文件并显示错误；共享不可用时不创建本地替代目录。新文案提供中英文，其他语言沿用既有回退，翻译审计只对这批明确列出的键放宽到中英文，不填英文占位。
+外部应用库的“磁盘映像”菜单提供创建、打开及重新挂载入口。底层仍使用现有应用迁移事务，应用通过 APFS 保存文件元数据；用户需要管理映像容量与挂载生命周期。命令使用参数数组，不拼 shell；已有目标不覆盖；只有来自选定映像的单个可写 APFS 卷且 UUID 符合记录才成为应用库；失败保留文件并显示错误；共享不可用时不创建本地替代目录。映像文案覆盖全部 22 种语言；翻译补齐后移除临时中英文审计豁免，继续遵循[本地化覆盖规则](../testing/2026-10-23-本地化覆盖与英文占位守卫.md)。
 
 创建失败可能留下部分映像，需要用户在 Finder 检查或重新命名；不会替用户判断残留文件是否可以删除。
 
```

**File**: `.agents/notes/implemented/feature/2026-11-04-完全磁盘访问拖拽引导.md` (modified, +2/-2)
```diff
@@ -12,7 +12,7 @@ Status: implemented
 
 借用 dogsc 提交 567fd6ed3bf113227dcf3e815f87ce60f0b69497 中 RecorderPermissionView.swift 的图标拖拽、NSPanel 生命周期和窗口定位代码；保留 MIT 版权声明与仓库来源，并将声明打包进应用资源。无需引入 dogsc 的录屏模块或依赖。视图复用 AppDialogTypography，明亮背景白色、暗色中性色，无渐变或装饰图标。
 
-拖入成功只表示系统接收文件，不能设为已授权。继续沿用 LaunchReadinessChecker 的完全磁盘访问探针及返回应用后的刷新。新文案沿用本次用户选择：仅简体中文和英文，其他语言回退并记录。
+拖入成功只表示系统接收文件，不能设为已授权。继续沿用 LaunchReadinessChecker 的完全磁盘访问探针及返回应用后的刷新。新文案覆盖语言目录中的全部 22 种语言，遵循[本地化覆盖规则](../testing/2026-10-23-本地化覆盖与英文占位守卫.md)。
 
 ## Existing-note audit
 
@@ -35,7 +35,7 @@ Status: implemented
 
 系统设置窗口接近占满屏幕高度、上下空间均不足时，浮窗贴着窗口底边内侧显示，可能遮住窗口底部的部分内容，但不覆盖标题栏及三个窗口控制按钮。修正前，实机出现过浮窗被限制在屏幕顶部、覆盖标题栏的情况。
 
-浮窗新增三个 key：`找不到 AppPorts？`、`把图标拖入“完全磁盘访问权限”列表，再打开开关。`、`将 AppPorts 图标拖入系统设置的应用列表`，仅补 zh-Hans 和 en；其余 20 种语言沿用现有回退，留待补译，不复制英文伪装完成。连同安装位置提示，本次相对 PR 基线共新增六个 key，旧条目内容不变。
+浮窗新增三个 key：`找不到 AppPorts？`、`把图标拖入“完全磁盘访问权限”列表，再打开开关。`、`将 AppPorts 图标拖入系统设置的应用列表`，现已补齐全部 22 种语言，不再依赖其余语言的临时回退。连同安装位置提示，本次相对 PR 基线共新增六个 key，旧条目内容不变。
 
 ## Verification
 
```

**File**: `.agents/notes/implemented/testing/2026-10-23-本地化覆盖与英文占位守卫.md` (modified, +11/-0)
```diff
@@ -123,3 +123,14 @@ macOS portal 格式为 7，使已使用格式 6 的入口在外部应用版本
 命令、最终日志、结果摘要、目录统计及源码哈希位于 `build/Validation/localization-completion-20261024/REPORT.md`；结果包为 `/tmp/AppPortsLocalizationCompletion-Final.xcresult`。此次构建保留在本地，旧 iOS 入口重链接和实际业务盘操作仍由上面的验收范围约束。
 
 公开贡献入口中的验证责任与同步要求见[贡献流程入口](../process/2026-10-25-contributor-workflow-entrypoints.md)；本篇原有决定保持适用。
+
+
+### 2026-11-06 PR #104 localization completion
+
+维护者确认补齐 PR 工作树全部语言。39 条仍使用的界面文案补齐其余 20 种语言（780 个槽位），涵盖权限浮窗、安装位置、映像操作、存储状态与待处理项。18 种普通语言以机器翻译生成初稿，随后校对品牌、磁盘空间、挂载/卸载语义和单位；br 与 zh-martian 沿用上面的生成约定。没有把英文占位当完成翻译，也不声称获得母语审校。
+
+仍使用的 22 个 stale 条目改为 manual，保留现有译文；无调用的逗号分隔词条和已删除的“已迁出（估算）”词条移除。审计中的整组映像回退白名单移除，所有可翻译词条统一要求 22 语言。权限引导的可选离屏渲染增加德语、法语、日语和阿拉伯语，检查长文本及 RTL 呈现；不改变产品布局或磁盘行为。
+
+本轮验证结果见本地忽略目录 build/Validation/pr104-localization-20261106/REPORT.md；构建不替代授权或迁移实机验收。
+
+最终本地化审计 19 项及权限引导 6 项测试通过（25 项，无失败或跳过）。六语言明暗共 12 张离屏截图确认文字完整，阿拉伯语显式 RTL 下图标与文字排列正确。Release clean build 包含 arm64/x86_64；最终文案另做增量重编译及资源核对。98 篇笔记的结构、链接、格式和 git diff --check 通过。未运行全量测试，未更换安装版，未提交或推送。
```

**File**: `AppPortsTests/FullDiskAccessGuideTests.swift` (modified, +4/-2)
```diff
@@ -84,13 +84,15 @@ final class FullDiskAccessGuideTests: XCTestCase {
         try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
         let originalLanguage = LanguageManager.shared.language
         defer { LanguageManager.shared.language = originalLanguage }
-        for language in ["zh-Hans", "en"] {
+        for language in ["zh-Hans", "en", "de", "fr", "ja", "ar"] {
             LanguageManager.shared.language = language
             for dark in [false, true] {
                 let appearance = try XCTUnwrap(NSAppearance(named: dark ? .darkAqua : .aqua))
                 let host = NSHostingView(rootView: FullDiskAccessGuideView(applicationURL: Bundle.main.bundleURL,
                     onDragEnded: { _ in XCTFail("Rendering must not perform a drag") })
-                    .environment(\.colorScheme, dark ? .dark : .light))
+                    .environment(\.colorScheme, dark ? .dark : .light)
+                    .environment(\.locale, Locale(identifier: language))
+                    .environment(\.layoutDirection, language == "ar" ? .rightToLeft : .leftToRight))
                 let window = NSWindow(contentRect: NSRect(x: -10_000, y: 0, width: 480, height: FullDiskAccessGuide.panelSize.height),
                     styleMask: [.borderless], backing: .buffered, defer: false)
                 window.isReleasedWhenClosed = false
```

**File**: `AppPortsTests/LocalizationAuditTests.swift` (modified, +1/-42)
```diff
@@ -102,46 +102,6 @@ final class LocalizationAuditTests: XCTestCase {
         }
     }
 
-    // Image-library copy currently ships in Chinese and English; other locales use fallback.
-    private let imageTranslationFallbackKeys: Set<String> = [
-        "重试所有待处理项",
-        "侧边栏宽度",
-
-        "外观",
-        "跟随系统",
-        "浅色",
-        "深色",
-        "已迁出（估算）",
-
-        "本机磁盘",
-        "所在磁盘",
-        "映像内空间",
-        "使用率",
-        "已用",
-        "空余",
-        "目标存储",
-        "更换位置",
-        "请输入有效的磁盘名称和 1–65536 GiB 的最大容量。",
-        "请选择已挂载的外部存储或 SMB 共享目录。",
-        "该位置已有同名文件，请更换名称或打开已有映像。",
-        "映像记录无效，请重新打开映像。",
-        "映像挂载位置已被占用，请在 Finder 中检查后重试。",
-        "无法核对映像对应的磁盘，请在 Finder 中检查后重试。",
-        "无法访问所选目录或映像，请先在 Finder 中连接共享。",
-        "无法确认映像中的唯一可写 APFS 磁盘，未更改迁移目标。",
-        "映像操作未完成，已有文件会保留。",
-        "打开已有映像…",
-        "重新挂载映像",
-        "磁盘映像",
-        "创建 APFS 映像",
-        "存放位置",
-        "磁盘名称",
-        "最大容量（GiB）",
-        "映像按实际写入占用空间，可存放在已挂载的 SMB 共享中。同一映像请只在一台 Mac 上写入。",
-        "以后使用映像中的应用前，请先打开 AppPorts 挂载映像。退出 AppPorts 不会卸载映像。",
-        "创建并使用",
-    ]
-
     func testStringCatalogContainsTranslationsForAllSupportedLanguages() throws {
         let supportedLocales = Set(AppLanguageCatalog.selectableLanguages.map(\.code))
         let catalogURL = try repositoryRootURL()
@@ -164,8 +124,7 @@ final class LocalizationAuditTests: XCTestCase {
             }
 
             let localizations = entry["localizations"] as? [String: Any] ?? [:]
-            let requiredLocales = imageTranslationFallbackKeys.contains(key)
-                ? supportedLocales.intersection(["en", "zh-Hans"]) : supportedLocales
+            let requiredLocales = supportedLocales
             for locale in requiredLocales.sorted() {
                 guard let localization = localizations[locale],
                       localizationHasTranslatedValue(localization) else {
```

---

### Incident Patch 3: `c9fc119a` (2026-11-05)
**Commit Message**: fix: 后台代理先接回映像再挂载其中的数据卷

数据卷位于尚未接回的应用库映像中时，代理先在容器卷重挂循环里等满 180 秒，之后才恢复映像，且本轮不再重试。现在第一轮挂载后若仍在等的卷位于选中映像内，立即接回映像并在同一轮重试；其他卷保持容器卷优先的原顺序，每轮最多恢复一次映像。

**File**: `.agents/notes/implemented/feature/2026-11-03-应用库映像后台自动挂载.md` (modified, +4/-1)
```diff
@@ -48,14 +48,15 @@ Status: implemented
 - 按磁盘名称或旧路径找文件无需保存卷身份，但外盘改名及同名 U 盘会使路径失效或指向另一个存储，因此按 UUID 查找，不能唯一确认时停止。
 - 用 Task 取消或竞速超时包裹同步文件属性查询无需额外进程，但不能中断阻塞在内核中的 NAS 读取，也无法保证释放原任务持有的操作锁。独立只读进程增加启动成本，但能将读取失败与仍在写入的挂载命令分开处理。
 - 在接收端跳过日志、截取 JSON 可以兼容混合输出，但会掩盖启动副作用并放宽响应格式；将只读入口提前可以直接保证响应独立，同时避免不必要的写入登记。
+- 把映像恢复整体移到容器卷恢复之前实现最简单，也能让映像内的容器卷第一轮就出现；但慢速或离线 NAS 会推迟物理盘上容器卷的恢复。因此只在仍在等待的容器卷位于选中映像内时提前恢复映像。
 
 ## Consequences
 
 仅映像也会保留代理，主程序退出后仍可重试。SMB 地址不落盘密码，重新连接后按相对路径定位；未选中的映像不自动挂载。即使 APFS 设备仍显示挂载，也检查其已记录的 SMB 共享是否存在，缺失时恢复共享。前台映像操作与后台共用 OperationLock，残留旧附件不重复附加；写进程未确认退出时继续持锁。创建、打开成功先持久化当前选中路径再注册代理，避免 SwiftUI 延后保存导致代理被误卸载。
 
 每次文件检查可能额外启动一个只读进程，正常恢复需要多次检查，存在进程启动和注册开销；10 秒是单次读取上限，不是整轮创建或挂载操作的总时限。失联后设备仍残留挂载记录的情况继续保守处理，不通过强制卸载来伪装恢复成功。
 
-容器卷原有恢复优先执行，NAS 操作随后进行，因此容器卷仍在等待恢复时，映像检查可能晚于系统定时触发。退出的代理由 launchd 再次触发，运行期间的定时触发不叠加进程。代价是最多每分钟产生一次后台检查，网络恢复和唤醒后不保证立即就位。没有选中映像的代理定义不增加定时触发。
+容器卷原有恢复优先执行，NAS 操作随后进行，因此容器卷仍在等待恢复时，映像检查可能晚于系统定时触发。例外是仍在等待的容器卷位于当前选中映像的应用库路径内：这类卷在映像附加前不会出现，代理在该轮挂载后立即恢复映像，并在同一轮重试挂载，不再等满 180 秒窗口。每轮最多恢复一次映像，其他容器卷的顺序不变；映像恢复失败时仍按原窗口等待，下一轮再试。退出的代理由 launchd 再次触发，运行期间的定时触发不叠加进程。代价是最多每分钟产生一次后台检查，网络恢复和唤醒后不保证立即就位。没有选中映像的代理定义不增加定时触发。
 
 系统凭据不可用时需在 Finder 重新连接；旧记录需要存储在线时运行一次新版以补齐身份。本地底层磁盘由 macOS 挂载，代理不负责强行挂载未加载的分区或解锁加密设备。无法取得底层卷 UUID 的本地记录仅能按原路径尝试，不能保证改名后的恢复；仍核对映像内部 APFS UUID。残留设备需要人工检查，不能把自动挂载视为断线期间的数据保护。当前仅支持一个选中的应用库，不自动恢复任意历史映像。
 
@@ -70,3 +71,5 @@ Status: implemented
 审查后的回归用例补充旧映像核对失败不保存身份、成功才补齐身份、只读检查超时不按未退出写进程处理、后台重定位后前台刷新及等待锁后按最新选择重新生成代理定时配置。既有映像测试显式注入本地文件检查边界，避免测试宿主启动真实检查进程。
 
 本次 7 个应用源文件及 3 个相关测试文件通过 Swift 语法解析。隔离依赖桩下的类型检查覆盖映像服务、恢复模块、只读检查模块、前台 controller、代理选择同步及新增回归用例，使用真实 macOS SDK 的 Foundation / NetFS / SwiftUI 接口及 Swift Testing 宏；检查没有生成应用或测试二进制，不代表完整应用编译或测试执行通过。94 篇笔记通过目录、链接及格式门禁。新增测试尚未执行，未构建、安装或访问真实 NAS；登录、休眠唤醒、系统凭据、真实断网恢复和 U 盘插拔仍需实机验收。
+
+恢复顺序补充隔离用例：映像内容器卷第一轮未就位时先恢复映像，再在同一轮重试；映像外的卷、已就位的卷、需人工处理的卷及让路轮次不触发恢复；每轮最多恢复一次，且只针对选中映像；重挂循环在映像接回后直接结束，不等待目录变化。代理源码接线审计用例继续通过。真实登录时映像内数据卷的恢复耗时尚未实机验证。
```

**File**: `AppPorts/Services/ContainerMountAgentInstaller.swift` (modified, +45/-11)
```diff
@@ -315,6 +315,7 @@ enum ContainerMountAgentInstaller {
 
     /// 代理入口：恢复容器卷后恢复选中的应用库映像；容器卷没就位就等 `/Volumes` 的真实变化再试，
     /// 直到全部就位、或用完等待窗口（`ContainerRemountLoop.Policy.window`）。
+    /// 还在等的容器卷位于选中映像内时，第一轮后立即接回映像并在同一轮重试，不等满窗口。
     static func runAgentAndExit() -> Never {
         // 启动行：既是排障锚点，也是「开机时序」自查脚本判定代理何时被 launchd 拉起的依据，
         // 所以无论这一轮有没有活干都要留下（pid 行里的 `[pid:…]` 已经有进程号了）。
@@ -333,27 +334,24 @@ enum ContainerMountAgentInstaller {
             // 后台代理没有界面，不能弹管理员授权框；旧系统上会以 privilegeRequired 失败并留给 AppPorts 启动时处理。
             let migrator = ContainerVolumeMigrator(disk: DiskUtility(administratorRunner: nil))
             var attemptIndex = 0
+            var imageRecovered = false
             let result = await ContainerRemountLoop.run(
                 attempt: {
                     defer { attemptIndex += 1 }
                     // 第一轮可能碰上主应用正在做挂载迁移，值得等满；之后的轮次只象征性等一下，
                     // 免得代理和主应用互相让路谁都不动。
                     let timeout = attemptIndex == 0 ? OperationLock.agentWaitTimeout : Self.retryLockTimeout
-                    return await remountAttempt(migrator: migrator, lockTimeout: timeout)
+                    let image = AppLibraryImageRecovery.selectedRecord()
+                    return await remountRecoveringLibraryImage(
+                        libraryRoot: image.map { $0.libraryPath ?? $0.mountPath },
+                        imageRecovered: &imageRecovered,
+                        remount: { await remountAttempt(migrator: migrator, lockTimeout: timeout) },
+                        recoverImage: { await recoverSelectedLibraryImage() })
                 },
                 waitForChange: { await monitor.waitForNextChange(timeout: $0) }
             )
             // A slow/offline NAS must not delay the existing container recovery.
-            let imageLock = OperationLock()
-            if await imageLock.acquire(timeout: OperationLock.agentWaitTimeout) {
-                do {
-                    let ejection = try DiskEjectionPauseStore().snapshot()
-                    await AppLibraryImageRecovery.recoverSelected(ejection: ejection)
-                } catch {
-                    AppLogger.shared.logError("读取弹出暂停状态失败，跳过映像恢复", error: error)
-                }
-                imageLock.release()
-            }
+            if !imageRecovered { await recoverSelectedLibraryImage() }
             reportAgentResult(result)
             semaphore.signal()
         }
@@ -364,6 +362,42 @@ enum ContainerMountAgentInstaller {
         exit(0)
     }
 
+    /// Container volumes created inside the selected library image appear only
+    /// after the image is attached. When a pass still waits for such a volume,
+    /// recover the image once and retry within the same cycle instead of waiting
+    /// out the remount window. Other pending volumes keep the original order.
+    static func remountRecoveringLibraryImage(
+        libraryRoot: String?,
+        imageRecovered: inout Bool,
+        remount: () async -> ContainerRemountLoop.Attempt,
+        recoverImage: () async -> Void
+    ) async -> ContainerRemountLoop.Attempt {
+        let attempt = await remount()
+        guard !imageRecovered, let libraryRoot, case .results(let outcomes) = attempt else { return attempt }
+        let waiting = ContainerRemountLoop.pendingRecords(in: outcomes).filter {
+            PortalImageLaunchPreparation.contains($0.record.externalRootPath, in: libraryRoot)
+        }
+        guard !waiting.isEmpty else { return attempt }
+        imageRecovered = true
+        AppLogger.shared.logContext("容器卷位于应用库映像中，先接回映像再重试挂载",
+            details: [("pending", String(waiting.count)), ("library_path", libraryRoot)])
+        await recoverImage()
+        return await remount()
+    }
+
+    /// Hold OperationLock only around recovery of the selected library image.
+    private static func recoverSelectedLibraryImage() async {
+        let imageLock = OperationLock()
+        guard await imageLock.acquire(timeout: OperationLock.agentWaitTimeout) else { return }
+        defer { imageLock.release() }
+        do {
+            let ejection = try DiskEjectionPauseStore().snapshot()
+            await AppLibraryImageRecovery.recoverSelected(ejection: ejection)
+        } catch {
+            AppLogger.shared.logError("读取弹出暂停状态失败，跳过映像恢复", error: error)
+        }
+    }
+
     /// 重试轮次里拿锁的等待时长。
     private static let retryLockTimeout: TimeInterval = 10
 
```

**File**: `AppPortsTests/ContainerMountAgentTests.swift` (modified, +97/-0)
```diff
@@ -369,3 +369,100 @@ struct ContainerMountAgentExecutablePathTests {
         )
     }
 }
+
+private actor AgentOrderingEvents {
+    private(set) var values: [String] = []
+    func add(_ value: String) { values.append(value) }
+}
+
+@Suite("Container mount agent library image ordering")
+struct ContainerMountAgentImageOrderingTests {
+    private static let library = "/Volumes/Apps"
+
+    private static func outcome(_ state: ContainerVolumeMigrator.RemountOutcome.State,
+                                root: String = library) -> ContainerVolumeMigrator.RemountOutcome {
+        ContainerVolumeMigrator.RemountOutcome(
+            record: ContainerMountRecord(appName: "Video", bundleIdentifier: "org.example.video",
+                dataDirType: DataDirType.containers.rawValue, mountPointPath: "/fixture/Containers/\(UUID().uuidString)",
+                volumeUUID: UUID().uuidString, volumeName: "Video Data", externalRootPath: root),
+            state: state)
+    }
+
+    private static func run(first: ContainerRemountLoop.Attempt, retry: ContainerRemountLoop.Attempt = .results([]),
+                            libraryRoot: String? = library, alreadyRecovered: Bool = false)
+        async -> (attempt: ContainerRemountLoop.Attempt, recovered: Bool, events: [String]) {
+        let events = AgentOrderingEvents()
+        var recovered = alreadyRecovered
+        var remounts = 0
+        let attempt = await ContainerMountAgentInstaller.remountRecoveringLibraryImage(
+            libraryRoot: libraryRoot, imageRecovered: &recovered,
+            remount: {
+                remounts += 1
+                await events.add("remount")
+                return remounts == 1 ? first : retry
+            },
+            recoverImage: { await events.add("image") })
+        return (attempt, recovered, await events.values)
+    }
+
+    @Test("A volume inside the selected image recovers the image and retries in the same cycle",
+          arguments: [ContainerVolumeMigrator.RemountOutcome.State.unavailable, .failed("not found")])
+    func imageHostedVolumeRecoversImageFirst(state: ContainerVolumeMigrator.RemountOutcome.State) async {
+        let settled = Self.outcome(.mounted)
+        let result = await Self.run(first: .results([Self.outcome(state)]), retry: .results([settled]))
+        #expect(result.events == ["remount", "image", "remount"])
+        #expect(result.recovered)
+        guard case .results(let outcomes) = result.attempt else {
+            Issue.record("The retried pass must be returned to the loop")
+            return
+        }
+        #expect(outcomes.map(\.state) == [.mounted])
+    }
+
+    @Test("Volumes outside the image, settled volumes and deferred passes keep the original order")
+    func otherOutcomesDoNotRecoverTheImage() async {
+        let cases: [ContainerRemountLoop.Attempt] = [
+            .results([Self.outcome(.unavailable, root: "/Volumes/Physical")]),
+            .results([Self.outcome(.unavailable, root: "/Volumes/Apps-other")]),
+            .results([Self.outcome(.alreadyMounted), Self.outcome(.mounted)]),
+            .results([Self.outcome(.requiresIntervention("conflict"))]),
+            .results([]),
+            .deferred
+        ]
+        for first in cases {
+            let result = await Self.run(first: first)
+            #expect(result.events == ["remount"])
+            #expect(!result.recovered)
+        }
+    }
+
+    @Test("The image is recovered at most once per agent round and only while selected")
+    func recoveryIsBoundedToTheSelectedImage() async {
+        let pending = ContainerRemountLoop.Attempt.results([Self.outcome(.unavailable)])
+        let repeated = await Self.run(first: pending, alreadyRecovered: true)
+        #expect(repeated.events == ["remount"])
+        let unselected = await Self.run(first: pending, libraryRoot: nil)
+        #expect(unselected.events == ["remount"])
+        #expect(!unselected.recovered)
+    }
+
+    @Test("The remount loop settles without waiting once the image exposes the volume")
+    func loopDoesNotWaitOutTheWindow() async {
+        var recovered = false
+        var imageAttached = false
+        let result = await ContainerRemountLoop.run(
+            attempt: {
+                await ContainerMountAgentInstaller.remountRecoveringLibraryImage(
+                    libraryRoot: Self.library, imageRecovered: &recovered,
+                    remount: { .results([Self.outcome(imageAttached ? .mounted : .unavailable)]) },
+                    recoverImage: { imageAttached = true })
+            },
+            waitForChange: { _ in
+                Issue.record("An image-hosted volume must not wait for /Volumes changes")
+                return nil
+            })
+        #expect(result.reason == .settled)
+        #expect(result.cycles == 1)
+        #expect(recovered)
+    }
+}
```

#### Recent Merged Pull Requests:
- **PR #104** (2026-11-08): feat: 完善应用库映像恢复、启动入口与权限引导 (@trah01)
- **PR #103** (2026-11-02): fix: 兼容 macOS 27 受保护的 quarantine，修复带标记应用迁移失败 (@Souitou-iop)
- **PR #102** (2026-10-31): feat: 新增磁盘映像应用库并优化扫描与迁移 (@trah01)
- **PR #101** (2026-10-29): fix: 离线挂载点改为只读访问并保留写入保护 (@wzh4869)
- **PR #100** (2026-10-28): fix: 支持旧数据副本授权清理并修正签名锁回归测试 (@wzh4869)
- **PR #99** (2026-10-28): fix: 保留手动卸载意图，补齐旧软链恢复和操作受阻诊断 (@wzh4869)

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

## X. 支持应用库映像卸载并暂停自动挂载

**RULE**:
When implementing operations in `.agents/notes/implemented/bug-fix/2026-11-08-应用库映像主动卸载.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in wzh4869/AppPorts. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1d86020e`: 支持应用库映像卸载并暂停自动挂载. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `.agents/notes/implemented/bug-fix/2026-11-08-应用库映像主动卸载.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
# Agent Note: 应用库映像主动卸载与自动恢复暂停

Status: implemented

## Problem

应用库位于 NAS 或 U 盘内的 APFS sparsebundle 时，工具栏弹出入口只查询物理外盘清单，映像没有物理磁盘身份，因此操作被拒绝。单独卸载而不保存暂停状态，又会被后台映像恢复或映像内数据卷重挂立即接回。

## Decision

弹出服务在持有 OperationLock 后读取当前选中的映像记录，按应用库路径边界识别目标。映像由共享 AppLibraryImageService 通过 hdiutil 设备清单和 APFS UUID 核对，使用非强制 detach 卸载映像根设备；不请求 Finder 弹出承载磁盘，也不卸载 SMB 共享。已经没有附件时保留暂停并按完成处理。未确认退出的写命令继续持锁等待。

DiskEjectionPauseStore 在发出 detach 前持久化独立的映像暂停，包含映像文件路径、映像内卷 UUID 和挂载路径。共享 Snapshot.blocks 同时约束容器挂载、迁移与恢复；后台映像恢复、主窗口自动恢复和原生启动入口（包括已就绪的只读快速检查）均检查暂停。失败或文件占用保留暂停，只有明确打开或重新挂载映像成功后才移除该映像暂停；底层磁盘重新连接不解除映像暂停。物理磁盘暂停仍独立生效。

暂停文件含映像状态时采用 schemaVersion 2，读取兼容原 schemaVersion 1；旧程序拒绝版本 2，避免把新状态当作无暂停。无映像暂停时继续写版本 1，物理盘状态保存与重连核对均保留映像状态。这不是迁移账本格式变更。旧后台程序仍需退出并使用新版，不能据此保证任意旧版前台显式映像挂载都遵守新增状态。

映像目标的工具栏按钮显示“卸载映像”，暂停后显示现有暂停状态；恢复使用原“重新挂载映像”入口。两个新文案和该恢复按钮覆盖全部 22 种语言。

## Existing-note audit

- [主动弹出外盘](../feature/2026-10-23-explicit-disk-ejection.md)：部分重叠，物理盘流程保留；映像使用独立设备核对与暂停生命周期。
- [SMB 上的 APFS 应用库映像](../feature/2026-10-29-SMB上的APFS应用库映像.md)：部分重叠，增加主动卸载入口，创建与迁移边界保留。
- [应用库映像后台自动挂载](../feature/2026-11-03-应用库映像后台自动挂载.md)：部分重叠，主动卸载暂停优先于自动恢复。
- [启动迁移应用时静默接回映像](../feature/2026-11-03-启动迁移应用时静默接回映像.md)：部分重叠，显式暂停时不通过启动入口接回。
- 关键词检索未发现 p
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1d86020e` are properly handled with clean fallback behavior.
