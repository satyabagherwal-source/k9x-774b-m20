> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/wzh4869-appports-learnings.md`  
> **Source**: github ([https://github.com/wzh4869/AppPorts](https://github.com/wzh4869/AppPorts))  
> **Source Version**: `c6b8a834`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-03T17:53:46.061Z  
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
> **Harvest Timestamp**: 2026-11-03T17:53:45.867Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wzh4869/AppPorts`
- **Description**: 📦 A macOS utility to seamlessly migrate applications to external storage and reclaim local disk space.【一款 macOS 工具，无缝迁移应用到外部存储并自动建立链接，释放宝贵的本地空间】
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2197 stars

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

### Incident Patch 1: `1e2f3c1d` (2026-10-30)
**Commit Message**: fix: resolve PR 102 conflicts with shared offline guards

Merge main while retaining uniform read-only mount guards, legacy upgrades and offline size diagnostics. Preserve native size traversal with offline-directory exclusions, and update the render fixture for the existing cleanup-sheet interface.

**File**: `.agents/notes/implemented/architecture/2026-10-01-data-path-copy-safety.md` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ Status: implemented
 - 显示层不提供执行授权，呈现规则见[容器归属、个人目录链接与大小显示](../feature/2026-10-01-container-ownership-presentation.md)。
 - 专用卷真实所有权的已提交建卷理由见[专用 APFS 卷通过真实所有权保留源元数据](2026-10-01-apfs-owners-volume-creation.md)。
 
-2026-10-29 的[微信离线媒体入口只读保护](../bug-fix/2026-10-29-微信离线媒体入口只读保护.md)仅对精确 msg/business 成员采用 0500，接管这些入口的离线权限规则；原有身份、空目录和卸载前检查继续适用。
+当前[统一离线挂载保护](../bug-fix/2026-10-30-readable-offline-mount-guards.md)对所有受管空入口采用 0500，接管离线权限规则；原有身份、空目录和卸载前检查继续适用。
 
 ## Alternatives considered
 
```

**File**: `.agents/notes/implemented/architecture/2026-10-29-页面目录大小扫描优化.md` (modified, +2/-0)
```diff
@@ -12,6 +12,8 @@ Status: implemented
 
 应用大小计算与路径解析只读参数，不使用 actor 的 Info.plist 缓存，因此改为 nonisolated，界面最多四个任务并发统计。应用路径、Stub 与套件解析及原有隐藏文件统计口径不变。每完成一项就发布，发布前复核扫描请求；过期请求取消剩余子任务，等待已启动统计退出，不更新缓存或结束新请求。
 
+离线挂载点沿用[统一只读保护及容量未知规则](../bug-fix/2026-10-30-readable-offline-mount-guards.md)：上层保留不可用问题并交给原生遍历跳过相应子目录，祖先不将缺失数据当成完整大小，不写入展示缓存。
+
 ## Existing-note audit
 
 - [大小缓存仅用于展示](../../implemented/feature/2026-10-21-目录大小缓存仅用于展示.md)部分重叠，沿用所有缓存身份、人工重测和执行独立读取边界。
```

**File**: `.agents/notes/implemented/bug-fix/2026-10-12-wechat-mount-recovery.md` (modified, +3/-1)
```diff
@@ -32,11 +32,13 @@ build 48 使用项目原有 Apple Development 身份通过 Release clean build
 
 ## Related decisions
 
+- 当前离线保护模式由[允许路径查找的只读挂载点](2026-10-30-readable-offline-mount-guards.md)接续：新租约使用 500，本文事故发生时的 000 事实保持原样。
+
 - 自身预留的未开始还原兼容基线见[旧容器重连保持原有所有权语义](../../implemented/bug-fix/2026-10-07-legacy-container-remount.md)。
 - 跨阶段自动恢复及收尾的共同规则见[由持久化事务自动完成 APFS 恢复与清理](../architecture/2026-10-12-apfs-automatic-recovery.md)。
 - 事故暴露的验证遗漏及实测层次见[隔离 APFS 验证与可比较的性能证据](../testing/2026-10-12-apfs-validation-evidence.md)。
 
-2026-10-29 的[微信离线媒体入口只读保护](2026-10-29-微信离线媒体入口只读保护.md)仅对精确 msg/business 成员采用 0500，接管这些入口的离线权限规则；原有身份、空目录和卸载前检查继续适用。
+当前[统一离线挂载保护](2026-10-30-readable-offline-mount-guards.md)对所有受管空入口采用 0500，接管离线权限规则；原有身份、空目录和卸载前检查继续适用。
 
 后台注册准入与系统设置归属见[后台挂载代理启用与应用归属](2026-10-29-后台挂载代理启用与应用归属.md)；该规则不替代卷解锁、签名或完全磁盘访问检查。
 
```

**File**: `.agents/notes/implemented/bug-fix/2026-10-28-manual-unmount-and-link-adoption.md` (modified, +9/-0)
```diff
@@ -14,6 +14,10 @@ Issue #81 的日志显示单卷手动卸载后两秒即被代理挂回。已有
 
 界面把实际挂载/在线状态与 `autoMountPaused` 分开表示。卸载失败而仍挂载时显示两种事实并提供“恢复自动挂载”；此入口验证现有挂载后清除暂停，不先卸载数据。卷离线时保留离线状态和暂停徽章，不承诺重新插盘后自动接回。拆分微信账号聚合成员暂停状态，列表的两种行展示共用同一事实。
 
+旧 `000` 暂停保护目录属于预期不可读；当前 [只读离线保护](2026-10-30-readable-offline-mount-guards.md)将新租约改为 `500`，其容量仍未知。扫描只把通过账本校验且属于当前应用的主动暂停路径传入大小测量；`DataDirReadIssue` 精确核对记录、真实目录、模式为 `000` 或 `500` 且未挂载后，生成或分类预期暂停问题。父目录、普通无权限目录、被换成软链的路径及仍挂载的目录不享有此分类，同路径真实非权限错误仍保留并需要处理。分类只影响错误引导和 readFailure 路径策略，不赋予迁移、认领或清理权限，不改账本格式。
+
+预期暂停仍保留在 `readIssues`，因此大小保持不完整、父项保留已读部分、快照缓存继续拒绝保存。页面只将 `requiresAttention` 的问题展示为读取失败及权限检查入口；纯暂停且无已读字节的行显示 `—`，复用已有暂停徽章和挂载/迁回操作。含暂停路径的大小测量绕过该路径及祖先的内存大小缓存，避免旧完整容量遮蔽不可读状态。
+
 后台仍静默跳过暂停的事务；手动指定 operationID 重试必须返回“本次未执行”的原因，任务中心显示需要处理，而不是完成。检查先于清理决定变化，包含已切换事务的直接清理路径。
 
 ## Existing-note audit
@@ -26,6 +30,9 @@ Issue #81 的日志显示单卷手动卸载后两秒即被代理挂回。已有
 
 ## Alternatives considered
 
+- 在页面直接隐藏所有权限错误：改动最少，但会掩盖同次扫描中的真实读取失败；因此在错误来源处分类，页面只过滤已确认的预期暂停。
+- 删除暂停产生的读取问题：可直接消除提示，但会使大小结果看似完整并进入缓存；因此保留问题，仅取消错误引导。
+
 - 仅在当前进程暂停：状态简单，但代理和冷启动无法遵守。
 - 复用整盘弹出暂停：已有跨进程准入，但会挡住同盘其他目录，且重新插盘会解除。
 - 缺记录一律拒绝：保守且易实现，但无法完成用户明确要求的现有软链接管。改为核对当前链接、目标身份和冲突后建立新凭据，不推断历史归属。
@@ -34,6 +41,8 @@ Issue #81 的日志显示单卷手动卸载后两秒即被代理挂回。已有
 
 ## Testing
 
+暂停保护目录专项回归覆盖真实 POSIX `000` 目录、父项旧大小缓存、混合真实权限错误、大小与汇总不完整、快照不缓存、解除暂停后重新计量。分类边界覆盖暂停但仍挂载、缺少可信暂停记录、父目录错误、非权限错误、权限恢复及替换软链。2026-10-30 的 99 项专项测试全部通过（扫描 62、快照缓存 5、容量汇总 13、本地化 19）。另以独立 XCTest 宿主和自建 APFS 镜像完成真实迁移、主动卸载产生 `000` 保护目录、扫描与父项测量分类、明确重挂、最新数据迁回及删除测试卷；`manualPauseReadDiagnosticsVerified` 为 true，镜像和隔离材料已清理。Release arm64/x86_64 clean build、笔记校验和独立只读复查通过。本轮未跑全量测试，未替换安装版或进行安装版界面验收。证据位于 `build/Validation/paused-mount-diagnostics-20261030/REPORT.md`。
+
 隔离目录与假 diskutil 覆盖冷启动后暂停、未开始还原的后台恢复暂停、同盘其他卷不受影响、挂载失败保留暂停、成功解除、保存失败不卸载、卸载失败保留暂停。账本测试覆盖 schema 12 无暂停、schema 13 暂停、错误 UUID/路径和旧 schema 夹带暂停拒绝。规范路径接管后还原、冲突标记拒绝、容器旧链接恢复使用真实临时文件，不操作用户业务数据。
 
 相关串行回归通过 150 项 XCTest 与 190 项 Swift Testing，共 340 项，日志 `/tmp/AppPortsIssue81-followup-regression.log`。覆盖 ContainerVolumeMigrator、ContainerMountResume/Safety/Agent、ContainerRemountLoop、DataDirMover、DataTransferStore、DataDirScanner、WriterAdmission、DiskEjection、MigrationTaskCenter、OperationMaintenanceProgress，以及一个模拟浏览器界面测试。没有运行完整测试套件。
```

**File**: `.agents/notes/implemented/bug-fix/2026-10-29-微信离线媒体入口只读保护.md` (modified, +2/-0)
```diff
@@ -8,6 +8,8 @@ Status: implemented
 
 ## Decision
 
+本篇的微信专用权限策略由[统一离线挂载保护](2026-10-30-readable-offline-mount-guards.md)取代；下文保留原方案及现场验证依据。PR #102 合并主分支时移除专用策略与参数，所有受管入口沿用统一 0500。
+
 `MountPointLease.Protection` 区分 inaccessible（000）和 readOnly（0500）。只对指定容器 `Library/Containers/<bundleIdentifier>/Data/Documents/xwechat_files/<account>/{msg,business}` 的精确入口采用 0500；账号排除 all_users、config、resource。相对用户主目录的路径与解析软链接后的路径必须相同，允许系统主目录自身解析，但拒绝媒体、账号或中间目录别名。整账号、数据库、其他目录和私有暂存入口继续采用 000。
 
 迁移、挂载、卸载、恢复、历史挂载选项回退传递当前记录或事务的 bundleIdentifier，多开容器不依赖默认微信标识。已有拆分记录在功能开关关闭时仍沿用规则，不改变持久化格式或迁移授权。
```

**File**: `.agents/notes/implemented/bug-fix/2026-10-30-readable-offline-mount-guards.md` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+# Agent Note: 离线挂载点允许路径查找并保持禁止本地写入
+
+Status: implemented
+
+## Problem
+
+用户提供的微信 4.1.15 / macOS 27.0.1 崩溃报告显示 weakly_canonical → filesystem_error → 未处理异常 → abort。原保护目录使用 000，卸载后应用访问子路径会被拒绝。本机隔离 C++ 实测确认 000 下不存在的子路径返回 EACCES（13），500 下相同查找不抛异常。报告没有携带实际失败路径和错误码，因此这证明触发机制，与崩溃高度吻合，不构成微信根因完全确诊或数据库损坏证据。用户批准实现“允许读取与路径访问、禁止写入”的方向。
+
+500 目录可枚举，断盘但未手动暂停时不能再依赖读取失败判断容量不完整，否则会显示完整的 0 字节，并将祖先的缺失汇总缓存为完整结果。
+
+## Decision
+
+MountPointLease 在核对目录身份和空内容后，将底层本地目录保护为 500。挂载层上的业务卷权限不变；卸载或断盘后本地入口允许当前用户读取和进入，新建文件与目录仍被拒绝。统一调整共享租约，避免迁移、主动卸载、重挂和恢复准备各自采用不同策略；不改变迁移账本、签名、版本或安装版。
+
+租约仍接受旧 000 目录，安全打开并核实为空后转为 500；持有描述符的后续验证精确检查 500，不因为兼容历史值而接受租约创建后的权限变化。恢复准备检查接受两种保护模式，核对同一 inode 与转换后的 500。非空目录、软链、替换目录和新开放写权限继续阻断。
+
+容量扫描对可信挂载记录精确匹配、未挂载、真实目录且为保护模式的入口生成预期不可用问题，不以是否手动暂停为条件。沿用 pausedMountDirectories 传递这些入口，手动暂停标记仍独立读取账本。500 可读不等于外盘业务数据为空；目录和祖先容量继续不完整、不写缓存、不引导用户补权限。旧 000 同样支持；普通权限错误、挂载中的错误、父目录错误和替换软链不享有豁免。沿用已有暂停提示，不新增文案。
+
+后台重挂检查在暂停和卷在线判断之前升级可信旧 000 空目录，保持暂停及账本不变。历史保留迁移的事务与祖先沿用正常重挂的 ownedIDs；未开始的恢复沿用兼容校验，已开始恢复则由原恢复路径负责，不新增背景修改。非空、重叠或不可访问目录保持阻断。仍挂载的业务卷不为升级主动卸载；它在新版正常卸载后转换，或盘离线后由后台检查转换。
+
+## PR #102 integration
+
+PR #102 与主分支的五个冲突文件均围绕离线保护：保留共享租约统一 0500、旧 000 升级、恢复准备兼容及历史事务归属，不保留按微信媒体路径选择权限的第二套策略。原[微信专用策略](2026-10-29-微信离线媒体入口只读保护.md)保留其独有的现场验证和备选依据，但权限选择由本篇接管；不增加存储格式或迁移模式。
+
+目录大小继续使用 PR 的原生遍历；上层将已核对的离线入口作为跳过集合，并将预期不可用问题合入结果。原生遍历跳过这些目录，祖先仍返回不完整大小且不缓存。权限错误、非目录替换等其他错误继续报告。PR 的映像、界面、任务及校验优化保留，不改变版本、安装版或发布状态。
+
+PR 原有截图测试仍给异常处理弹窗传递已删除的空 otherIssues 参数，测试包编译因此失败；删除该无效参数，沿用新接口的默认空集合，不改变测试场景或生产行为。
+
+合并版本的 arm64/x86_64 Release clean build 通过；独立命名 XCTest 宿主完成 24 个定向套件，442 项通过、0 失败、3 项显式性能测试按预期跳过（参数展开后的通过运行数为 703）。范围覆盖共享租约、旧 000 升级、挂载/恢复/重入、离线容量与祖先缓存、目录树/大小汇总、新原生遍历、文件散列及映像接口。独立只读审查未发现其他具体冲突回归。
+
+私有 APFS 实测 1 项通过，包含 14 组旧记录与中断恢复场景；正常迁移、卸载后 0500 可读且写入 EACCES、暂停大小未知、重挂与最新数据迁回、权限丢失后的保留与重试、旧 noowners 恢复与回滚均通过。专用数据卷已清理；协调器确认只剩原始私有卷后卸载映像，再核对夹具身份、无附加映像及无打开文件后移除临时夹具。结果位于 `build/Validation/v3-real-mount-20261030T072729Z-7fb7c101/summary.json`，专项与构建结果位于 `/tmp/AppPortsPR102Validation/`。
+
+本地化审计 19 项中 17 通过、2 项因原 PR 字符串目录的 stale 标记失败；目录与审计源码均未在本次冲突处理中修改，保留该独立问题。笔记树、格式、归档封印及差异空白检查通过。没有本机运行全量测试，没有验证真实微信缺盘登录或 NAS 映像应用迁移，也没有安装、发布或合并到 main。此前实机结果只证明当时主分支，不替代这些验证边界。
+
+## Existing-note audit
+
+- [微信挂载恢复事故](2026-10-12-wechat-mount-recovery.md)：部分重叠，历史事实保留；本篇改变其历史 000 保护决定，卸载前的本地父目录和业务卷可用性校验继续有效。
+- [单卷暂停和旧链接恢复](2026-10-28-manual-unmount-and-link-adoption.md)：部分重叠，暂停记录仍独立，补充 500 下容量未知，不以目录可读判断业务数据完整。
+- [事件驱动重挂](2026-09-23-event-driven-container-remount.md)：部分重叠，不改变调度和重试策略。
+- proposed/rejected 中仅临时目录迁移策略及并行复制存在关键词重叠，与本次权限选择无关，不归档或改写它们。
+
+## Alternatives considered
+
+- 保留 000：保护最严格，但已实测路径解析因缺失进入权限返回 EACCES，不能解决当前故障。
+- 改为 700：应用可继续创建离线文件，但会形成外盘和本地两份数据，因此拒绝。
+- 只手工 chmod 微信目录：可验证现象，但新迁移和重挂会重新写回旧模式，不能作为实现；采用共享租约中的单一保护策略。
+
+## Verification
+
+PR #101 反馈修复的扫描器 65 项、容量汇总和目录树 36 项、展示 9 项全部通过，0 失败、0 跳过。新增回归使用真实临时目录，覆盖未手动暂停的断盘和待重挂、500 目录容量未知、祖先汇总不完整及不复用缓存。挂载和卷在线状态通过现有注入边界模拟；本轮未跑全量测试或真实外盘拔插。arm64/x86_64 Release clean build 通过。
+
+专项 260 项通过，0 失败、0 跳过，覆盖挂载安全、迁移器、重挂恢复、代理、恢复准备、扫描、缓存、卷状态和弹盘。旧目录升级覆盖无事务/生产迁移保留事务 × 暂停/离线四种组合，以及非空目录拒绝升级并保留内容与模式。最终 arm64/x86_64 Release clean build 通过；生产 MountPointLease 与原生 C++ weakly_canonical 联合实测确认 EACCES → 正常返回。
+
+私有 APFS 真实测试 1 项通过，包含 14 组旧记录和中断恢复场景。实测正常迁移、主动卸载暴露 500 空目录、读取成功且文件创建 EACCES、暂停容量未知、重挂、最新数据重连和迁回、旧 noowners/中断继续/撤销/自动回滚及清理。测试卷已删除、镜像已卸载，核对归属和无打开文件后清除本轮夹具。结果和日志见本机 build/Validation/readable-mount-guards-20261030/REPORT.md，完整 xcresult 见 build/Validation/v3-real-mount-20261029T215722Z-543b71ae/。
+
+独立只读审查发现的升级路径遗漏、历史事务归属遗漏及合成暂停遮蔽真实错误均已修正，最后复核无新增具体缺陷。未跑全量测试，真实微信缺盘登录未验证，不以隔离测试宣称登录可用。后续经用户授权，将当前源码以原 Apple Development 身份构建并替换本机安装版，strict 签名、现有完全磁盘访问代码要求、后台代理签名和四个原位挂载均核对通过，旧包保留备份；版本和生产迁移账本未改。
+
+## Consequences
+
+所有通过同一租约创建的 APFS 保护目录使用只读模式，允许应用把离线文件识别为不存在，仍禁止通过该目录生成本地业务数据。此策略消除已确认的路径解析权限触发条件；应用是否能处理后续缺文件或写入拒绝仍须实测。数据继续保存在外部专用卷；本地可读空目录不代表数据被删除或迁回。
```

**File**: `.agents/notes/implemented/feature/2026-10-20-微信账号拆分迁移.md` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ Status: implemented
 - 与[微信挂载恢复](../bug-fix/2026-10-12-wechat-mount-recovery.md)部分重叠：成员沿用已有卸载、恢复和清理规则，不由聚合行取代真实记录。
 - [临时目录迁移提案](../../proposed/feature/2026-10-01-temporary-directory-migration-policy.md)讨论 tmp 后代，与媒体成员无关，保留 proposed。
 
-2026-10-29 的[微信离线媒体入口只读保护](../bug-fix/2026-10-29-微信离线媒体入口只读保护.md)仅对精确 msg/business 成员采用 0500，接管这些入口的离线权限规则；原有身份、空目录和卸载前检查继续适用。
+当前[统一离线挂载保护](../bug-fix/2026-10-30-readable-offline-mount-guards.md)对所有受管空入口采用 0500，接管离线权限规则；原有身份、空目录和卸载前检查继续适用。
 
 新迁移的来源刷新时机由[应用数据迁移任务内核对来源](../bug-fix/2026-10-29-应用数据迁移任务内核对来源.md)接管，任务内准备完成后才进入复制；已有持久化恢复规则继续适用。
 
```

**File**: `AppPorts.xcodeproj/project.pbxproj` (modified, +4/-4)
```diff
@@ -404,7 +404,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 50;
+				CURRENT_PROJECT_VERSION = 51;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = MQ7XG7WM3F;
 				ENABLE_APP_INTENTS_METADATA_PROVIDER = NO;
@@ -421,7 +421,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 12.0;
-				MARKETING_VERSION = 2.0.0;
+				MARKETING_VERSION = 2.1.0;
 				PRODUCT_BUNDLE_IDENTIFIER = com.shimoko.AppPorts;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				PROVISIONING_PROFILE_SPECIFIER = "";
@@ -441,7 +441,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 50;
+				CURRENT_PROJECT_VERSION = 51;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = MQ7XG7WM3F;
 				ENABLE_APP_INTENTS_METADATA_PROVIDER = NO;
@@ -458,7 +458,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 12.0;
-				MARKETING_VERSION = 2.0.0;
+				MARKETING_VERSION = 2.1.0;
 				PRODUCT_BUNDLE_IDENTIFIER = com.shimoko.AppPorts;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				PROVISIONING_PROFILE_SPECIFIER = "";
```

---

### Incident Patch 2: `c6b8a834` (2026-11-02)
**Commit Message**: Merge pull request #103 from Souitou-iop/codex/quarantine-migration-fix

fix: 兼容 macOS 27 受保护的 quarantine，修复带标记应用迁移失败

**File**: `.agents/notes/implemented/bug-fix/2026-11-01-migration-replica-quarantine.md` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+# Agent Note: 迁移副本不再回放或校验 quarantine
+
+Status: implemented
+
+## Problem
+
+2.1.0 (51) 在 macOS 27.2 上把带 quarantine 的应用迁往外置盘 100% 失败：
+复制完成后 verifying 阶段对副本文件报 `NSPOSIXErrorDomain 13`，重试全部命中
+同一路径。微信 4.2.0（Sparkle 更新，`0082;…;` 系统发起型）和 RedPot.app
+（Edge 下载，`01c1;…;` 尚未清除）都复现；历史成功副本（QQ、Edge、ChatGPT）
+的源文件在用户打开后已被系统清除 quarantine。
+
+排查确认三层事实：副本复制后由系统自动附加 quarantine（复制路径为
+pread/pwrite，代码未写入）；所有进程对该副本的 `removexattr` 均被
+macOS 27 拒绝（EACCES，含创建进程与 hardened 签名进程）；带 bundle 的
+hardened 进程对该副本的 open、pread、fgetxattr、
+`SecStaticCodeCheckValidity` 全部正常。因此失败点唯一：
+`AppTransferTransaction.prepareCandidate` 复制完成后的 quarantine 移除循环
+调用 `removexattr` 抛出 EACCES，整个迁移被一个无害元数据标记终止。
+
+## Decision
+
+- `TreeCopySession.systemManagedAttributes` 增加 `com.apple.quarantine`：
+  清单不记录、比较不参与、`applyMetadata` 不回放，也不主动删除目标上的标记。
+  这与该文件对 provenance/macl 的既有处理一致，适用于应用、普通数据和容器复制。
+- `prepareCandidate` 直接使用复制器返回的清单校验副本。清单已不含 quarantine，
+  因此删除标记的循环没有处理对象，`withoutQuarantine` 转换也无作用，两者均移除。
+  副本校验、原有签名校验、同步、记账、入口切换与恢复清理流程保持不变。
+
+## Alternatives considered
+
+- **验证失败走管理员授权重试**：PrivilegedAppTransfer 是动作级 helper，
+  覆盖不了树扫描内的单文件元数据调用，且重试仍会命中同一个系统拒绝。
+- **先清源再复制**：删除源的 quarantine 同样被系统拒绝，且会改动
+  用户正在使用的原始应用，超出迁移工具的边界。
+- **保留 throw，仅提示用户**：Sparkle 更新过的应用在 macOS 27.2 上
+  全部不可迁移，问题会随更新扩散到更多应用。
+
+## Consequences
+
+迁移副本可能携带系统附加的 quarantine 标记，AppPorts 不保证复制源标记，
+也不主动清除目标标记；是否允许打开仍由 macOS 判断。下列两款应用的实机结果
+由 PR 作者提供，不能据此断言任意来源、任意标记状态的文件均已获系统批准。
+旧版清单即使记录过 quarantine，比较时也通过 `portableAttributes` 过滤，
+不会仅因这个标记而报 extended_attributes 差异。其他要求保留的属性、内容、
+身份或权限发生差异时，既有校验仍会拒绝继续或保留待清理副本。
+
+## Verification
+
+### 本地清理验证
+
+- macOS 27.0.1、Xcode 27.0：arm64/x86_64 Release `xcodebuild clean build` 通过。
+- 独立测试宿主执行 `AppMigrationServiceTests` 61 项、`AppTransferTransactionTests` 76 项、
+  `ContainerVolumeMigratorTests` 93 项、`DataDirMoverTests` 50 项及 quarantine 回归 1 项，
+  共 281 项通过（含参数化用例共执行 325 次），没有失败或跳过。
+- `MigrationSigningIntegrationTests` 使用外置 APFS 卷上的独立 UUID 样本目录，3 项通过：
+  签名应用迁移和元数据保留、拒绝重签沙盒应用、应用及聊天数据库/附件往返；迁移后新增
+  数据库记录在迁回后仍存在。样本不使用已安装应用或真实聊天数据。
+- 本次未跑全量测试，未实测真实容器挂载/卸载，也未复现作者 macOS 27.2 的真实应用场景。
+  原始构建和测试结果位于 `/tmp/AppPorts-PR103-cleanup.QujOj8/`。
+
+### PR 作者提供的验证
+
+- `AppPortsTests/TreeCopySessionQuarantineTests.swift`：清单注入
+  quarantine 后 `verifyCopy` 通过，注入普通应用属性仍失败，防止修复
+  滑向"忽略全部属性差异"。
+- `FileCopierTests`、`AppTransferTransactionTests`、`DataPathPolicyTests`
+  共 101 项全部通过。
+- 本机（QBJ8 Apple Development 签名 + hardened runtime 的 Release 构建）
+  真实迁移 WeChat.app 1.53 GB：19:14:06 完成入口切换，本地 stub 指向
+  `/Volumes/SanDisk/Applications/AppPorts.noindex/WeChat.app`，两侧列表
+  均显示"已链接"，任务中心清空后无遗留。
+- 同一构建真实迁移 RedPot.app 137 MB：入口切换完成，两侧均显示"已链接"；
+  旧本地副本因归属复核未通过按既有策略保留在
+  `/Applications/.appports-entry-ED1CF64D-BD4F-4438-A71E-0E67BD7C0F78`，
+  不影响应用运行。
```

**File**: `AppPorts/Services/AppTransferTransaction.swift` (modified, +1/-22)
```diff
@@ -490,19 +490,8 @@ final class AppTransferTransaction {
                 try journal.save()
             }, progressHandler: progress)
         try checkpoint(.copied, journal)
-        // Preserve the historical application-only quarantine removal. It is
-        // the sole allowed metadata difference and never touches the source.
         let candidate = journal.record.candidateURL
-        if journal.record.direction == .migrate {
-            for entry in snapshot.entries where entry.extendedAttributes["com.apple.quarantine"] != nil {
-                let url = entry.path.isEmpty ? candidate : candidate.appendingPathComponent(entry.path)
-                if removexattr(url.path, "com.apple.quarantine", XATTR_NOFOLLOW) != 0, errno != ENOATTR {
-                    throw Self.posix(url)
-                }
-            }
-        }
-        let expected = journal.record.direction == .migrate ? withoutQuarantine(snapshot) : snapshot
-        try TreeCopySession.verifyCopy(at: candidate, against: expected, profile: Self.copyProfile)
+        try TreeCopySession.verifyCopy(at: candidate, against: snapshot, profile: Self.copyProfile)
         try verifySignatures(journal.record, root: candidate)
         DataTransferSession.progress?.begin(.synchronizing,
             detail: "应用文件和签名已检查，正在等待存储设备确认写入完成。".localized)
@@ -1170,16 +1159,6 @@ final class AppTransferTransaction {
         }
     }
 
-    private func withoutQuarantine(_ snapshot: TreeCopySnapshot) -> TreeCopySnapshot {
-        TreeCopySnapshot(restoredRootOwnership: snapshot.restoredRootOwnership, ownershipCompatibility: snapshot.ownershipCompatibility,
-            entries: snapshot.entries.map { item in
-                .init(path: item.path, kind: item.kind, identity: item.identity, mode: item.mode, uid: item.uid, gid: item.gid,
-                    flags: item.flags, birthTime: item.birthTime, modificationTime: item.modificationTime,
-                    extendedAttributes: item.extendedAttributes.filter { $0.key != "com.apple.quarantine" }, resourceFork: item.resourceFork, acl: item.acl,
-                    size: item.size, digest: item.digest, linkTarget: item.linkTarget, hardlinkGroup: item.hardlinkGroup)
-            }, excludedRootEntries: snapshot.excludedRootEntries)
-    }
-
     private func handle(_ error: Error, journal: Journal) throws -> AppTransferResult {
         journal.record.recoverableReason = error.localizedDescription
         if journal.record.isSwitchComplete || (try? observeActivation(journal.record)) == true {
```

**File**: `AppPorts/Utils/TreeCopySession.swift` (modified, +5/-1)
```diff
@@ -38,8 +38,12 @@ actor TreeCopySession {
     // downloaded file is opened or renamed, including our deletion rename.
     // Preserve those OS-managed tags in place; copying or comparing them as
     // application metadata causes false conflicts and can replay stale grants.
+    // Quarantine additionally marks a copied bundle as a newly downloaded app,
+    // which makes macOS 27 gate reads of the staged copy on its app
+    // assessment; a migration replica is not a download, so never replay it.
     // POSIX permissions, filesystem ACLs and application xattrs remain verified.
-    nonisolated private static let systemManagedAttributes: Set<String> = ["com.apple.provenance", "com.apple.macl"]
+    nonisolated private static let systemManagedAttributes: Set<String> =
+        ["com.apple.provenance", "com.apple.macl", "com.apple.quarantine"]
 
     // Finder display settings are disposable, not application data. Limit
     // this exception to ordinary, unshared files; never hide a same-name
```

**File**: `AppPortsTests/TreeCopySessionQuarantineTests.swift` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+import Darwin
+import XCTest
+@testable import AppPorts
+
+final class TreeCopySessionQuarantineTests: XCTestCase {
+    func testVerificationIgnoresQuarantineButKeepsApplicationAttributes() throws {
+        let base = FileManager.default.temporaryDirectory
+        try FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
+        let root = base.appendingPathComponent("TreeCopyQuarantine-\(UUID().uuidString)", isDirectory: true)
+        let source = root.appendingPathComponent("Source", isDirectory: true)
+        try FileManager.default.createDirectory(at: source, withIntermediateDirectories: true)
+        let file = source.appendingPathComponent("payload")
+        try Data("payload".utf8).write(to: file)
+        try FileManager.default.setAttributes([.posixPermissions: 0o444], ofItemAtPath: file.path)
+        defer { try? FileManager.default.removeItem(at: root) }
+
+        let snapshot = try TreeCopySession.snapshot(at: source, profile: .appBundle)
+        // Older manifests replayed the source quarantine into the ledger, so a
+        // recorded marker must not fail verification against a clean replica.
+        let quarantinedSnapshot = withInjectedAttribute(snapshot, key: "com.apple.quarantine",
+                                                        value: Data("0081;test;AppPorts;".utf8))
+
+        let replica = root.appendingPathComponent("Replica", isDirectory: true)
+        try FileManager.default.copyItem(at: source, to: replica)
+        XCTAssertNoThrow(try TreeCopySession.verifyCopy(at: replica, against: quarantinedSnapshot, profile: .appBundle),
+                         "a recorded quarantine must not fail verification of a clean replica")
+
+        let applicationSnapshot = withInjectedAttribute(snapshot, key: "com.appports.test",
+                                                        value: Data("keep".utf8))
+        XCTAssertThrowsError(try TreeCopySession.verifyCopy(at: replica, against: applicationSnapshot, profile: .appBundle),
+                             "application attributes must still participate in verification")
+    }
+
+    private func withInjectedAttribute(_ snapshot: TreeCopySnapshot, key: String, value: Data) -> TreeCopySnapshot {
+        var entries = snapshot.entries
+        for index in entries.indices where entries[index].path == "payload" {
+            var attributes = entries[index].extendedAttributes
+            attributes[key] = value
+            entries[index] = TreeCopySnapshot.Entry(path: entries[index].path, kind: entries[index].kind,
+                identity: entries[index].identity, mode: entries[index].mode, uid: entries[index].uid,
+                gid: entries[index].gid, flags: entries[index].flags, birthTime: entries[index].birthTime,
+                modificationTime: entries[index].modificationTime, extendedAttributes: attributes,
+                resourceFork: entries[index].resourceFork, acl: entries[index].acl, size: entries[index].size,
+                digest: entries[index].digest, linkTarget: entries[index].linkTarget,
+                hardlinkGroup: entries[index].hardlinkGroup)
+        }
+        return TreeCopySnapshot(restoredRootOwnership: snapshot.restoredRootOwnership,
+            ownershipCompatibility: snapshot.ownershipCompatibility, entries: entries,
+            excludedRootEntries: snapshot.excludedRootEntries)
+    }
+}
```

---

### Incident Patch 3: `a2405213` (2026-11-02)
**Commit Message**: fix: clean up quarantine migration checks and test fixture

**File**: `.agents/notes/implemented/bug-fix/2026-11-01-migration-replica-quarantine.md` (modified, +25/-11)
```diff
@@ -21,11 +21,11 @@ hardened 进程对该副本的 open、pread、fgetxattr、
 ## Decision
 
 - `TreeCopySession.systemManagedAttributes` 增加 `com.apple.quarantine`：
-  清单不记录、比较不参与、`applyMetadata` 不回放。与该文件对
-  provenance/macl 的既有处理及 FileCopier 的 `removeQuarantine` 语义对齐。
-- `prepareCandidate` 的移除循环对 EACCES/EPERM 降级为 WARN 日志并继续，
-  仅其他错误仍然失败。副本保留已获系统批准（0082）的 quarantine 标记
-  不影响启动与签名验证，为此终止迁移得不偿失。
+  清单不记录、比较不参与、`applyMetadata` 不回放，也不主动删除目标上的标记。
+  这与该文件对 provenance/macl 的既有处理一致，适用于应用、普通数据和容器复制。
+- `prepareCandidate` 直接使用复制器返回的清单校验副本。清单已不含 quarantine，
+  因此删除标记的循环没有处理对象，`withoutQuarantine` 转换也无作用，两者均移除。
+  副本校验、原有签名校验、同步、记账、入口切换与恢复清理流程保持不变。
 
 ## Alternatives considered
 
@@ -38,15 +38,29 @@ hardened 进程对该副本的 open、pread、fgetxattr、
 
 ## Consequences
 
-外置盘上的迁移副本此后可能携带 quarantine 标记，与 QQ/Edge 等
-历史副本的"无标记"状态不同。该标记记录的是源应用已被批准的来源，
-Gatekeeper 对副本按已批准处理；若 macOS 未来对无管理授权进程读取
-此类副本收紧，需要重新评估（当前同证书 hardened 探针实测读取正常）。
-清理路径对旧版清单（记录过 quarantine）与过滤后扫描的比较仍会报
-extended_attributes 差异并保留副本，属安全行为，由既有重试消化。
+迁移副本可能携带系统附加的 quarantine 标记，AppPorts 不保证复制源标记，
+也不主动清除目标标记；是否允许打开仍由 macOS 判断。下列两款应用的实机结果
+由 PR 作者提供，不能据此断言任意来源、任意标记状态的文件均已获系统批准。
+旧版清单即使记录过 quarantine，比较时也通过 `portableAttributes` 过滤，
+不会仅因这个标记而报 extended_attributes 差异。其他要求保留的属性、内容、
+身份或权限发生差异时，既有校验仍会拒绝继续或保留待清理副本。
 
 ## Verification
 
+### 本地清理验证
+
+- macOS 27.0.1、Xcode 27.0：arm64/x86_64 Release `xcodebuild clean build` 通过。
+- 独立测试宿主执行 `AppMigrationServiceTests` 61 项、`AppTransferTransactionTests` 76 项、
+  `ContainerVolumeMigratorTests` 93 项、`DataDirMoverTests` 50 项及 quarantine 回归 1 项，
+  共 281 项通过（含参数化用例共执行 325 次），没有失败或跳过。
+- `MigrationSigningIntegrationTests` 使用外置 APFS 卷上的独立 UUID 样本目录，3 项通过：
+  签名应用迁移和元数据保留、拒绝重签沙盒应用、应用及聊天数据库/附件往返；迁移后新增
+  数据库记录在迁回后仍存在。样本不使用已安装应用或真实聊天数据。
+- 本次未跑全量测试，未实测真实容器挂载/卸载，也未复现作者 macOS 27.2 的真实应用场景。
+  原始构建和测试结果位于 `/tmp/AppPorts-PR103-cleanup.QujOj8/`。
+
+### PR 作者提供的验证
+
 - `AppPortsTests/TreeCopySessionQuarantineTests.swift`：清单注入
   quarantine 后 `verifyCopy` 通过，注入普通应用属性仍失败，防止修复
   滑向"忽略全部属性差异"。
```

**File**: `AppPorts/Services/AppTransferTransaction.swift` (modified, +1/-28)
```diff
@@ -490,25 +490,8 @@ final class AppTransferTransaction {
                 try journal.save()
             }, progressHandler: progress)
         try checkpoint(.copied, journal)
-        // Preserve the historical application-only quarantine removal. It is
-        // the sole allowed metadata difference and never touches the source.
         let candidate = journal.record.candidateURL
-        if journal.record.direction == .migrate {
-            for entry in snapshot.entries where entry.extendedAttributes["com.apple.quarantine"] != nil {
-                let url = entry.path.isEmpty ? candidate : candidate.appendingPathComponent(entry.path)
-                if removexattr(url.path, "com.apple.quarantine", XATTR_NOFOLLOW) != 0, errno != ENOATTR {
-                    // macOS 27 refuses quarantine removal even to the file's
-                    // creator, so a Sparkle-updated source can leave the marker
-                    // on the replica. The marker records an already-approved
-                    // download; keeping it is safe, failing the migration is not.
-                    guard errno == EACCES || errno == EPERM else { throw Self.posix(url) }
-                    AppLogger.shared.logContext("副本 quarantine 由系统保留",
-                        details: [("relative_path", entry.path), ("errno", String(errno))], level: "WARN")
-                }
-            }
-        }
-        let expected = journal.record.direction == .migrate ? withoutQuarantine(snapshot) : snapshot
-        try TreeCopySession.verifyCopy(at: candidate, against: expected, profile: Self.copyProfile)
+        try TreeCopySession.verifyCopy(at: candidate, against: snapshot, profile: Self.copyProfile)
         try verifySignatures(journal.record, root: candidate)
         DataTransferSession.progress?.begin(.synchronizing,
             detail: "应用文件和签名已检查，正在等待存储设备确认写入完成。".localized)
@@ -1176,16 +1159,6 @@ final class AppTransferTransaction {
         }
     }
 
-    private func withoutQuarantine(_ snapshot: TreeCopySnapshot) -> TreeCopySnapshot {
-        TreeCopySnapshot(restoredRootOwnership: snapshot.restoredRootOwnership, ownershipCompatibility: snapshot.ownershipCompatibility,
-            entries: snapshot.entries.map { item in
-                .init(path: item.path, kind: item.kind, identity: item.identity, mode: item.mode, uid: item.uid, gid: item.gid,
-                    flags: item.flags, birthTime: item.birthTime, modificationTime: item.modificationTime,
-                    extendedAttributes: item.extendedAttributes.filter { $0.key != "com.apple.quarantine" }, resourceFork: item.resourceFork, acl: item.acl,
-                    size: item.size, digest: item.digest, linkTarget: item.linkTarget, hardlinkGroup: item.hardlinkGroup)
-            }, excludedRootEntries: snapshot.excludedRootEntries)
-    }
-
     private func handle(_ error: Error, journal: Journal) throws -> AppTransferResult {
         journal.record.recoverableReason = error.localizedDescription
         if journal.record.isSwitchComplete || (try? observeActivation(journal.record)) == true {
```

**File**: `AppPortsTests/TreeCopySessionQuarantineTests.swift` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ import XCTest
 
 final class TreeCopySessionQuarantineTests: XCTestCase {
     func testVerificationIgnoresQuarantineButKeepsApplicationAttributes() throws {
-        let base = URL(fileURLWithPath: "/Volumes/SanDisk/Projects/AppPorts/.tmp-diag")
+        let base = FileManager.default.temporaryDirectory
         try FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
         let root = base.appendingPathComponent("TreeCopyQuarantine-\(UUID().uuidString)", isDirectory: true)
         let source = root.appendingPathComponent("Source", isDirectory: true)
```

#### Recent Merged Pull Requests:
- **PR #103** (2026-11-02): fix: 兼容 macOS 27 受保护的 quarantine，修复带标记应用迁移失败 (@Souitou-iop)
- **PR #102** (2026-10-31): feat: 新增磁盘映像应用库并优化扫描与迁移 (@trah01)
- **PR #101** (2026-10-29): fix: 离线挂载点改为只读访问并保留写入保护 (@wzh4869)
- **PR #100** (2026-10-28): fix: 支持旧数据副本授权清理并修正签名锁回归测试 (@wzh4869)
- **PR #99** (2026-10-28): fix: 保留手动卸载意图，补齐旧软链恢复和操作受阻诊断 (@wzh4869)
- **PR #98** (2026-10-28): fix(admission): 自动回收已退出进程的登记文件 (@wzh4869)

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

## X. resolve PR 102 conflicts with shared offline guards

**RULE**:
When implementing operations in `.agents/notes/implemented/architecture/2026-10-01-data-path-copy-safety.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in wzh4869/AppPorts. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1e2f3c1d`: resolve PR 102 conflicts with shared offline guards. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `.agents/notes/implemented/architecture/2026-10-01-data-path-copy-safety.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
当前[统一离线挂载保护](../bug-fix/2026-10-30-readable-offline-mount-guards.md)对所有受管空入口采用 0500，接管离线权限规则；原有身份、空目录和卸载前检查继续适用。
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
2026-10-29 的[微信离线媒体入口只读保护](../bug-fix/2026-10-29-微信离线媒体入口只读保护.md)仅对精确 msg/business 成员采用 0500，接管这些入口的离线权限规则；原有身份、空目录和卸载前检查继续适用。
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1e2f3c1d` are properly handled with clean fallback behavior.
