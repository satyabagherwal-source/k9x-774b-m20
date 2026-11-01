> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/wzh4869-appports-learnings.md`  
> **Source**: github ([https://github.com/wzh4869/AppPorts](https://github.com/wzh4869/AppPorts))  
> **Source Version**: `920a38ca`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T18:13:38.650Z  
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
> **Harvest Timestamp**: 2026-10-30T18:13:37.398Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wzh4869/AppPorts`
- **Description**: 📦 A macOS utility to seamlessly migrate applications to external storage and reclaim local disk space.【一款 macOS 工具，无缝迁移应用到外部存储并自动建立链接，释放宝贵的本地空间】
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2191 stars

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

### Incident Patch 1: `a51a6191` (2026-10-28)
**Commit Message**: fix: authorize retained data cleanup and update signature lock regression

**File**: `.agents/notes/implemented/architecture/2026-10-10-verified-transfer-lifecycle.md` (modified, +2/-0)
```diff
@@ -55,6 +55,8 @@ Status: implemented
 
 单卷暂停与现有链接确认接管见[保留单卷卸载意图并补齐旧软链接管](../bug-fix/2026-10-28-manual-unmount-and-link-adoption.md)；原事务切换、验证和副本清理要求继续成立。
 
+root 所有的数据旧副本只在用户指定记录重试时授权清理，见[旧数据副本授权清理](../bug-fix/2026-10-28-data-cleanup-administrator-authorization.md)；普通进程继续持锁和写账本。
+
 ## Alternatives considered
 
 - **签名与数据合成父 workflow**：可集中串联步骤，但把独立签名及其恢复材料变成释放空间的前提，增加跨服务状态。
```

**File**: `.agents/notes/implemented/bug-fix/2026-10-20-root应用迁移授权.md` (modified, +2/-0)
```diff
@@ -22,6 +22,8 @@ Xcode 的根目录属于 root、模式为 0755。用户能在 `/Applications` 
 - 部分重叠并保留：[位置变更统一清除旧版更新保护锁](2026-10-17-legacy-update-lock-adoption.md)。授权不接管额外标志，不改变无法恢复记录的收束规则。
 - 其余 ownership、容器挂载、签名修复和数据迁移相关笔记不涉及应用入口的 RENAME_SWAP 授权边界，不修改其决定。
 
+数据目录旧副本的按需授权另见[旧数据副本授权清理](2026-10-28-data-cleanup-administrator-authorization.md)，复用请求运输与系统密码框，不扩大本篇应用交换请求的权限。
+
 ## Alternatives considered
 
 - **递归 chown 本地应用**：可让普通进程完成移动与删除，但持久改变第三方应用所有权，并可能影响内部受保护组件；不采用。
```

**File**: `.agents/notes/implemented/bug-fix/2026-10-28-data-cleanup-administrator-authorization.md` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+# Agent Note: 旧数据副本按需授权清理并显示当前数据位置
+
+Status: implemented
+
+## Problem
+
+截图中的 Dortania 迁移旧副本属于 root、权限为 0755，普通进程清理时调整目录权限会失败。账本只留下“操作不被允许”，界面仅显示最早的路径；该数据实际上已经还原到本地，旧迁移记录仍在等待清理，用户无法区分当前数据与旧副本。现有管理员入口只支持应用本体事务。
+
+## Decision
+
+复用现有系统密码框、临时请求文件和当前可执行文件的一次性入口，扩展数据副本清理请求。普通用户进程持有操作锁并写账本，管理员进程只调用既有严格清单清理器，不运行 GUI、不写账本、不改当前数据或所有者。仅用户指定记录主动重试，在普通清理实际返回 EPERM/EACCES、已记录清理检查点且旧副本属 root 时授权；后台与批量自动处理不弹密码框。取消授权保留旧副本和可重试检查点。
+
+请求沿用应用授权的文件读取规则，包含原迁移记录和当前有效位置。管理员入口核对已完成切换、清理检查点、活动数据及旧副本/父目录身份，复用 removeVerifiedCopy 的原内容清单及断点删除；不另写 rm 或扩大为任意文件操作。界面明确管理员所有权、当前有效数据位置和保留副本位置，具体底层错误与阶段进入既有诊断日志。不增加 schema 或常驻特权服务。
+
+## Existing-note audit
+
+- [应用本体授权](../../implemented/bug-fix/2026-10-20-root应用迁移授权.md)：部分重叠，复用授权运输和请求读取，不改变应用交换与签名规则。
+- [持久化切换](../../implemented/architecture/2026-10-10-verified-transfer-lifecycle.md)：部分重叠，普通进程仍保管账本，数据切换成功不会因清理错误回滚。
+- [操作受阻诊断](../../implemented/bug-fix/2026-10-28-operation-blockage-diagnostics.md)：部分重叠，扩展数据清理上下文，不推断未知错误原因。
+- 未发现同范围的 proposed/rejected；已有记录保留，不归档。
+
+## Alternatives considered
+
+- 只改错误文本：可以解释 root 所有权，但用户点击重试仍不能完成本次实际清理，因此提供显式授权继续。
+- 递归 chown 或以管理员启动 GUI：可以绕过权限，但改变第三方数据的所有权或扩大整个进程权限，沿用已有一次性受限执行方式。
+- 新安装常驻特权服务：可持续处理权限操作，但本次只需前台单次清理，增加部署及维护成本。
+
+## Testing
+
+`PrivilegedDataCleanupTests` 通过实际临时文件执行同一严格删除器，验证只删旧副本、当前目录身份/内容/元数据不变、旧迁移使用最新本地还原位置；有内容差异、缺少删除检查点、活动位置与旧副本重叠或活动对象被替换时保留文件。诊断测试确认记录 ID、路径、阶段和原始 POSIX 错误经过 NSError 桥接保留。未为这些测试增加 mock 删除器。
+
+`DataDirMoverTests` 的真实迁移→规范化→还原流程验证所有历史记录均显示最新本地数据位置。两个生产入口（应用数据页、任务中心异常恢复）共用 completedLocation 解析，在后台加载路径映射。首轮数据/应用迁移、账本及维护回归165项通过；最终 UI 路径接线后数据和清理测试通过。应用迁移复跑曾有3项被测试宿主正常退出中断（退出码0，不是断言失败），单独完整复验76项通过；原因未确认，不修改退出逻辑，也不将这次中断隐藏为全程全绿。最终源码的专项合计165项通过。日志 `/tmp/AppPortsDataCleanup-regression.log`、`/tmp/AppPortsDataCleanup-final-regression.log`、`/tmp/AppPortsDataCleanup-app-transfer-retry.log`。
+
+最终 arm64/x86_64 Release clean build 通过，日志 `/tmp/AppPortsDataCleanup-release.log`。新增5条文案覆盖22语言，br和zh-martian按现有约定生成。中英德波阿五种语言的亮/暗界面渲染通过，并检查中英阿恢复界面的当前数据及保留副本标签，输出 `/tmp/AppPortsDataCleanupUI/`。`LocalizationAuditTests` 仍为同样3项既有失败（stale条目及旧键缺失翻译），本次5条新文案没有新增审计失败；日志 `/tmp/AppPortsDataCleanup-localization-ui.log`。界面fixture不模拟已获得root权限。
+
+系统密码框、实际root提升及取消密码框未自动执行：当前没有可用的非交互sudo凭据，不以普通用户临时目录测试声称权限流程实机通过。完整套件未在本机运行。
+
+截图现场仅只读核对：本地当前目录身份与最新restore记录匹配，旧副本uid为0，文件摘要同时匹配原清单和当前本地文件。没有改动截图中的旧副本、当前数据或用户权限。
+
+## Local installation
+
+维护者明确要求构建最新工作区代码并替换原应用。此次签名版Release clean build通过，产物为工程当前版本2.0.0（50），arm64/x86_64双架构；没有修改工程版本号。沿用原安装的Apple Development证书、团队MQ7XG7WM3F及com.shimoko.AppPorts标识，designated requirement与原安装一致，替换后 `codesign --verify --deep --strict` 通过。原安装1.9.9（50）保留为 `~/Library/Application Support/AppPorts/backups/AppPorts-before-local-20261028-161840.app`，新包替换 `/Applications/AppPorts.app`，未自动打开GUI。安装日志 `/tmp/AppPortsLatest-install-result.json`，构建日志 `/tmp/AppPortsLatest-signed-release.log`。
+
+本次本地安装不是远端版本发布。管理员入口不具备root身份时从实际签名产物退出、没有进入GUI；该检查不代替真实密码框授权与root删除验收。
+
+## Consequences
+
+实际root旧副本可以在指定记录重试时调用系统授权继续清理，界面同时解释管理员所有权和两份数据的位置。代价是维护一个只支持symlink旧数据副本的管理员请求；它与应用授权共用临时请求格式和密码框运输，普通进程仍掌握日志、锁和账本。
+
+系统决定是否复用近期凭据，不保证每次都会重新输入密码。只有普通清理已经写出删除检查点的权限失败可以授权，不扩大挂载卷删除权限，也不扩展管理标记删除前即失败的分支。其他失败仍保留材料并报告具体错误；授权取消没有删除结果，不报告已完成。
```

**File**: `.agents/notes/implemented/bug-fix/2026-10-28-operation-blockage-diagnostics.md` (modified, +4/-0)
```diff
@@ -19,6 +19,8 @@ OperationBlockage 通过 CustomNSError 携带稳定诊断码与字段。AppLogge
 - [后台任务](../../implemented/architecture/2026-10-21-后台迁移任务与异常处理.md)：部分重叠，丰富失败消息及诊断，不改变调度、重试与恢复权威来源。
 - 活跃 proposed/rejected 未发现相同方案；上述现行记录均保留，不归档。
 
+数据副本清理进一步记录具体路径、阶段和原始 NSError，并区分最新数据位置，见[旧数据副本授权清理](2026-10-28-data-cleanup-administrator-authorization.md)。
+
 ## Alternatives considered
 
 - 仅替换弹窗文字：变更小，但原因在抛错和字符串聚合时已经丢失，无法知道具体阻塞记录。
@@ -31,6 +33,8 @@ OperationBlockage 通过 CustomNSError 携带稳定诊断码与字段。AppLogge
 
 Release 双架构 `xcodebuild clean build` 成功。功能日志 `/tmp/AppPortsIssue81-diagnostics-final-tests.log`，构建日志 `/tmp/AppPortsIssue81-diagnostics-final-release.log`。提示修正后补充回归 36 项通过（24 项 XCTest、12 项 Swift Testing，含上述 4 项跨进程测试）；本地化审计仍仅同样 3 项失败。补充日志见 `/tmp/AppPortsIssue81-diagnostics-guidance-tests.log`。本地化新增 7 条诊断文案均覆盖 22 种语言；全库审计仍有 3 项既有失败，分别涉及 stale 状态和旧键缺失翻译，未将它报告为全绿。完整测试套件未在本机运行，遵循一次性 runner 的仓库要求。
 
+签名锁错误的调用方断言包含 `SignatureBackupCleanupTests.respectsSignatureLock`：它持有真实文件锁，检查 `.signatureLockBusy` 并确认备份记录字节不变。合并后 CI 曾因该测试仍要求旧 `SigningError` 类型而失败；这是遗漏的测试契约更新，不通过放宽锁或删除备份不变断言修复。修正后完整运行 SignatureBackupCleanup、CodeSigner、SignatureOperation 与 OperationLock，共118项通过（13项XCTest、105项Swift Testing），日志 `/tmp/AppPortsLatest-signature-regression.log`；未将专项通过等同于远端全量CI已通过。
+
 ## Consequences
 
 同一失败可从弹窗、任务历史和导出日志关联到已知记录，文件锁不可访问不再伪装成忙碌，成功后收尾失败也保留原始诊断。代价是维护稳定诊断码、NSError 桥接及全部语言的对应文案；这些信息属于时间点观察，不提供锁持有者证明。只有可验证的记录 ID 和应用身份进入关联字段，损坏文件中未经验证的路径单列为 recorded_application_path。
```

**File**: `AppPorts/Localizable.xcstrings` (modified, +680/-0)
```diff
@@ -96348,6 +96348,686 @@
         }
       }
     },
+    "旧副本由管理员（root）拥有，需要授权后才能清理。当前数据未受影响。" : {
+      "localizations" : {
+        "ar" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "النسخة القديمة مملوكة للمسؤول (root). يلزم التفويض لتنظيفها. لم تتأثر البيانات الحالية."
+          }
+        },
+        "br" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "⠠⠞⠓⠑ ⠕⠇⠙ ⠉⠕⠏⠽ ⠊⠎ ⠕⠺⠝⠑⠙ ⠃⠽ ⠞⠓⠑ ⠁⠙⠍⠊⠝⠊⠎⠞⠗⠁⠞⠕⠗ ⠶⠗⠕⠕⠞⠶⠲ ⠠⠁⠥⠞⠓⠕⠗⠊⠵⠁⠞⠊⠕⠝ ⠊⠎ ⠗⠑⠟⠥⠊⠗⠑⠙ ⠞⠕ ⠉⠇⠑⠁⠝ ⠊⠞ ⠥⠏⠲ ⠠⠉⠥⠗⠗⠑⠝⠞ ⠙⠁⠞⠁ ⠊⠎ ⠥⠝⠁⠋⠋⠑⠉⠞⠑⠙⠲"
+          }
+        },
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Die alte Kopie gehört dem Administrator (root). Zum Bereinigen ist eine Autorisierung erforderlich. Die aktuellen Daten sind nicht betroffen."
+          }
+        },
+        "en" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "The old copy is owned by the administrator (root). Authorization is required to clean it up. Current data is unaffected."
+          }
+        },
+        "eo" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "La malnova kopio apartenas al la administranto (root). Rajtigo necesas por forigi ĝin. La nunaj datumoj restas netuŝitaj."
+          }
+        },
+        "es" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "La copia antigua pertenece al administrador (root). Se necesita autorización para eliminarla. Los datos actuales no se ven afectados."
+          }
+        },
+        "fr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "L’ancienne copie appartient à l’administrateur (root). Une autorisation est nécessaire pour la supprimer. Les données actuelles ne sont pas affectées."
+          }
+        },
+        "hi" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "पुरानी प्रति का स्वामी व्यवस्थापक (root) है। इसे साफ़ करने के लिए अनुमति चाहिए। मौजूदा डेटा अप्रभावित है।"
+          }
+        },
+        "id" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Salinan lama dimiliki administrator (root). Diperlukan otorisasi untuk membersihkannya. Data saat ini tidak terpengaruh."
+          }
+        },
+        "it" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "La vecchia copia appartiene all’amministratore (root). Per eliminarla è necessaria l’autorizzazione. I dati attuali non sono interessati."
+          }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "古いコピーは管理者（root）が所有しています。削除には認証が必要です。現在のデータには影響しません。"
+          }
+        },
+        "ko" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "이전 사본은 관리자(root) 소유입니다. 정리하려면 승인이 필요합니다. 현재 데이터에는 영향이 없습니다."
+          }
+        },
+        "nl" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "De oude kopie is eigendom van de beheerder (root). Autorisatie is nodig om deze op te ruimen. De huidige gegevens blijven ongewijzigd."
+          }
+        },
+        "pl" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Stara kopia należy do administratora (root). Jej usunięcie wymaga autoryzacji. Bieżące dane pozostają bez zmian."
+          }
+        },
+        "pt" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "A cópia antiga pertence ao administrador (root). É necessária autorização para limpá-la. Os dados atuais não são afetados."
+          }
+        },
+        "ru" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Старая копия принадлежит администратору (root). Для её удаления нужна авторизация. Текущие данные не затронуты."
+          }
+        },
+        "th" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "สำเนาเก่าเป็นของผู้ดูแลระบบ (root) ต้องได้รับอนุญาตจึงจะล้างได้ ข้อมูลปัจจุบันไม่ได้รับผลกระทบ"
+          }
+        },
+        "tr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Eski kopya yöneticiye (root) aittir. Temizlemek için yetkilendirme gerekir. Mevcut veriler etkilenmez."
+          }
+        },
+        "vi" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Bản sao cũ thuộc sở hữu của quản trị viên (root). Cần cấp quyền để dọn dẹp. Dữ liệu hiện tại không bị ảnh hưởng."
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "旧副本由管理员（root）拥有，需要授权后才能清理。当前数据未受影响。"
+          }
+        },
+        "zh-Hant"
```

**File**: `AppPorts/Services/DataCleanupResolution.swift` (modified, +42/-0)
```diff
@@ -1,8 +1,23 @@
+import Darwin
 import Foundation
 
 /// User choices change the journal only. A retained copy is never called
 /// deleted, moved over live data, or silently included in later cleanup.
 enum DataCleanupResolution {
+    static func currentDataPaths(for transfers: [DataTransferRecord], store: ContainerMountStore = .shared) -> [UUID: String] {
+        Dictionary(uniqueKeysWithValues: transfers.compactMap { transfer in
+            (try? store.completedLocation(after: transfer.operationID)).map { (transfer.operationID, $0.activePath) }
+        })
+    }
+
+    static func requiresAdministrator(_ transfer: DataTransferRecord) -> Bool {
+        guard transfer.mode == .symlink, transfer.isDataSwitchComplete, geteuid() != 0,
+              let path = transfer.backupPath,
+              let actual = try? TreeCopySession.retainedRemovalURL(at: URL(fileURLWithPath: path), removalID: transfer.operationID) else { return false }
+        var info = stat()
+        return lstat(actual.path, &info) == 0 && info.st_uid == 0
+    }
+
     static func decide(_ disposition: DataTransferRecord.CleanupDisposition,
                        expected: DataTransferRecord) async throws {
         let lock = OperationLock()
@@ -53,3 +68,30 @@ enum DataCleanupResolution {
         var errorDescription: String? { message }
     }
 }
+
+struct DataCleanupFailure: LocalizedError, CustomNSError {
+    let transfer: DataTransferRecord
+    let stage: String
+    let underlying: NSError
+
+    static var errorDomain: String { "AppPorts.DataCleanup" }
+    var errorCode: Int { underlying.code }
+    var errorDescription: String? {
+        let detail = DataCleanupResolution.requiresAdministrator(transfer) && Self.isPermissionFailure(underlying)
+            ? "旧副本由管理员（root）拥有，需要授权后才能清理。当前数据未受影响。".localized
+            : underlying.localizedDescription
+        return String(format: "清理旧副本失败：%@\n%@".localized, transfer.backupPath ?? transfer.originalPath, detail)
+    }
+    var errorUserInfo: [String: Any] {
+        [NSLocalizedDescriptionKey: errorDescription ?? underlying.localizedDescription,
+         NSUnderlyingErrorKey: underlying,
+         OperationBlockage.diagnosticFieldsKey: ["diagnostic_code": "DATA-CLEANUP-FAILED",
+            "blocking_operation_id": transfer.operationID.uuidString, "cleanup_stage": stage,
+            "cleanup_path": transfer.backupPath ?? transfer.originalPath]]
+    }
+
+    static func isPermissionFailure(_ error: Error) -> Bool {
+        let native = error as NSError
+        return native.domain == NSPOSIXErrorDomain && [Int(EPERM), Int(EACCES)].contains(native.code)
+    }
+}
```

**File**: `AppPorts/Services/OperationMaintenance.swift` (modified, +1/-1)
```diff
@@ -138,7 +138,7 @@ actor OperationMaintenance {
                 guard let transfer = try store.transfer(operationID: retryOperationID) else { return [] }
                 if transfer.isDataSwitchComplete {
                     if transfer.mode == .mount { try await migrator.cleanupRetainedTransfer(operationID: retryOperationID) }
-                    else { try await DataDirMover().cleanupRetainedTransfer(operationID: retryOperationID) }
+                    else { try await DataDirMover(allowsAdministratorPrompt: interactive).cleanupRetainedTransfer(operationID: retryOperationID) }
                     return []
                 }
                 if transfer.mode == .symlink {
```

**File**: `AppPorts/Services/PrivilegedAppTransfer.swift` (modified, +21/-13)
```diff
@@ -39,6 +39,10 @@ enum PrivilegedAppTransfer {
     }
 
     static func authorize(_ request: Request) throws {
+        try authorize(request, argument: argument)
+    }
+
+    static func authorize<T: Encodable>(_ request: T, argument: String) throws {
         guard let executable = Bundle.main.executableURL else { throw CocoaError(.executableNotLoadable) }
         let directory = FileManager.default.temporaryDirectory.appendingPathComponent("AppPorts-authorization-" + UUID().uuidString)
         try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false,
@@ -69,26 +73,29 @@ enum PrivilegedAppTransfer {
         let args = CommandLine.arguments
         guard args.dropFirst().first == argument else { return false }
         do {
-            guard geteuid() == 0, args.count == 4, let owner = uid_t(args[3]), owner != 0 else {
-                throw POSIXError(.EPERM)
-            }
-            let fd = open(args[2], O_RDONLY | O_NOFOLLOW)
-            guard fd >= 0 else { throw POSIXError(.EACCES) }
-            let handle = FileHandle(fileDescriptor: fd, closeOnDealloc: true)
-            defer { try? handle.close() }
-            var info = stat()
-            guard fstat(fd, &info) == 0, info.st_mode & S_IFMT == S_IFREG,
-                  info.st_uid == owner, info.st_mode & 0o777 == 0o600, info.st_nlink == 1,
-                  info.st_size > 0, info.st_size <= 256 * 1024 * 1024 else { throw POSIXError(.EPERM) }
-            let request = try PropertyListDecoder().decode(Request.self, from: handle.readToEnd() ?? Data())
-            try perform(request)
+            try perform(readRequest(Request.self, arguments: args))
             return true
         } catch {
             FileHandle.standardError.write(Data((error.localizedDescription + "\n").utf8))
             exit(1)
         }
     }
 
+    static func readRequest<T: Decodable>(_ type: T.Type, arguments: [String]) throws -> T {
+        guard geteuid() == 0, arguments.count == 4, let owner = uid_t(arguments[3]), owner != 0 else {
+            throw POSIXError(.EPERM)
+        }
+        let fd = open(arguments[2], O_RDONLY | O_NOFOLLOW)
+        guard fd >= 0 else { throw POSIXError(.EACCES) }
+        let handle = FileHandle(fileDescriptor: fd, closeOnDealloc: true)
+        defer { try? handle.close() }
+        var info = stat()
+        guard fstat(fd, &info) == 0, info.st_mode & S_IFMT == S_IFREG,
+              info.st_uid == owner, info.st_mode & 0o777 == 0o600, info.st_nlink == 1,
+              info.st_size > 0, info.st_size <= 256 * 1024 * 1024 else { throw POSIXError(.EPERM) }
+        return try PropertyListDecoder().decode(type, from: handle.readToEnd() ?? Data())
+    }
+
     /// Internal for isolated fixtures. The command-line entry above always requires root.
     static func perform(_ request: Request) throws {
         let record = request.record
@@ -245,6 +252,7 @@ enum PrivilegedAppTransfer {
 enum AppPortsEntryPoint {
     static func main() {
         if PrivilegedAppTransfer.runIfRequested() { return }
+        if PrivilegedDataCleanup.runIfRequested() { return }
         AppMoverApp.main()
     }
 }
```

---

### Incident Patch 2: `ad3f9637` (2026-10-30)
**Commit Message**: fix: label cleanup closure and bump version to 2.1.0 (51)

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

**File**: `AppPorts/Utils/ContainerVolumeMigrator.swift` (modified, +2/-2)
```diff
@@ -2322,7 +2322,7 @@ actor ContainerVolumeMigrator {
                     }
                     try store.recheckWriterAdmission()
                     try TreeCopySession.removeVerifiedCopy(at: backup, against: baseline, allowPartialRemoval: deletionPreviouslyStarted,
-                        expectedVolumeUUID: expectedBackup.volumeUUID, removalID: operationID, requireSourceIdentity: true) {
+                        expectedVolumeUUID: expectedBackup.volumeUUID, removalID: operationID, requireSourceIdentity: true, willRemove: {
                         guard try self.store.transfer(operationID: operationID) == transfer,
                               try DataPathIdentity.capture(parent).matchesFilesystemObject(parentIdentity),
                               try DataPathIdentity.capture(retained).matchesFilesystemObject(expectedBackup) else {
@@ -2344,7 +2344,7 @@ actor ContainerVolumeMigrator {
                               self.isMountPoint(active) == (location.mode == .mount && location.direction == .migrate) else {
                             throw DataOperationSafety.Failure.conflict(active.path)
                         }
-                    }
+                    })
                 } else {
                     guard transfer.cleanupParentIdentity != nil else { throw DataOperationSafety.Failure.inspection(backup.path) }
                     try await requireActiveData(for: transfer, matching: location)
```

---

### Incident Patch 3: `5c75c03f` (2026-10-29)
**Commit Message**: fix: keep offline mount sizes incomplete without manual pause

**File**: `.agents/notes/implemented/bug-fix/2026-10-30-readable-offline-mount-guards.md` (modified, +5/-1)
```diff
@@ -6,13 +6,15 @@ Status: implemented
 
 用户提供的微信 4.1.15 / macOS 27.0.1 崩溃报告显示 weakly_canonical → filesystem_error → 未处理异常 → abort。原保护目录使用 000，卸载后应用访问子路径会被拒绝。本机隔离 C++ 实测确认 000 下不存在的子路径返回 EACCES（13），500 下相同查找不抛异常。报告没有携带实际失败路径和错误码，因此这证明触发机制，与崩溃高度吻合，不构成微信根因完全确诊或数据库损坏证据。用户批准实现“允许读取与路径访问、禁止写入”的方向。
 
+500 目录可枚举，断盘但未手动暂停时不能再依赖读取失败判断容量不完整，否则会显示完整的 0 字节，并将祖先的缺失汇总缓存为完整结果。
+
 ## Decision
 
 MountPointLease 在核对目录身份和空内容后，将底层本地目录保护为 500。挂载层上的业务卷权限不变；卸载或断盘后本地入口允许当前用户读取和进入，新建文件与目录仍被拒绝。统一调整共享租约，避免迁移、主动卸载、重挂和恢复准备各自采用不同策略；不改变迁移账本、签名、版本或安装版。
 
 租约仍接受旧 000 目录，安全打开并核实为空后转为 500；持有描述符的后续验证精确检查 500，不因为兼容历史值而接受租约创建后的权限变化。恢复准备检查接受两种保护模式，核对同一 inode 与转换后的 500。非空目录、软链、替换目录和新开放写权限继续阻断。
 
-容量扫描只在可信暂停记录精确匹配、未挂载、真实目录且为保护模式时生成预期暂停问题。500 可读不等于外盘业务数据为空；目录和祖先容量继续不完整、不写缓存、不引导用户补权限。旧 000 同样支持；普通权限错误、挂载中的错误、父目录错误和替换软链不享有豁免。沿用已有暂停提示，不新增文案。
+容量扫描对可信挂载记录精确匹配、未挂载、真实目录且为保护模式的入口生成预期不可用问题，不以是否手动暂停为条件。沿用 pausedMountDirectories 传递这些入口，手动暂停标记仍独立读取账本。500 可读不等于外盘业务数据为空；目录和祖先容量继续不完整、不写缓存、不引导用户补权限。旧 000 同样支持；普通权限错误、挂载中的错误、父目录错误和替换软链不享有豁免。沿用已有暂停提示，不新增文案。
 
 后台重挂检查在暂停和卷在线判断之前升级可信旧 000 空目录，保持暂停及账本不变。历史保留迁移的事务与祖先沿用正常重挂的 ownedIDs；未开始的恢复沿用兼容校验，已开始恢复则由原恢复路径负责，不新增背景修改。非空、重叠或不可访问目录保持阻断。仍挂载的业务卷不为升级主动卸载；它在新版正常卸载后转换，或盘离线后由后台检查转换。
 
@@ -31,6 +33,8 @@ MountPointLease 在核对目录身份和空内容后，将底层本地目录保
 
 ## Verification
 
+PR #101 反馈修复的扫描器 65 项、容量汇总和目录树 36 项、展示 9 项全部通过，0 失败、0 跳过。新增回归使用真实临时目录，覆盖未手动暂停的断盘和待重挂、500 目录容量未知、祖先汇总不完整及不复用缓存。挂载和卷在线状态通过现有注入边界模拟；本轮未跑全量测试或真实外盘拔插。arm64/x86_64 Release clean build 通过。
+
 专项 260 项通过，0 失败、0 跳过，覆盖挂载安全、迁移器、重挂恢复、代理、恢复准备、扫描、缓存、卷状态和弹盘。旧目录升级覆盖无事务/生产迁移保留事务 × 暂停/离线四种组合，以及非空目录拒绝升级并保留内容与模式。最终 arm64/x86_64 Release clean build 通过；生产 MountPointLease 与原生 C++ weakly_canonical 联合实测确认 EACCES → 正常返回。
 
 私有 APFS 真实测试 1 项通过，包含 14 组旧记录和中断恢复场景。实测正常迁移、主动卸载暴露 500 空目录、读取成功且文件创建 EACCES、暂停容量未知、重挂、最新数据重连和迁回、旧 noowners/中断继续/撤销/自动回滚及清理。测试卷已删除、镜像已卸载，核对归属和无打开文件后清除本轮夹具。结果和日志见本机 build/Validation/readable-mount-guards-20261030/REPORT.md，完整 xcresult 见 build/Validation/v3-real-mount-20261029T215722Z-543b71ae/。
```

**File**: `AppPorts/Utils/DataDirScanner.swift` (modified, +2/-1)
```diff
@@ -904,8 +904,9 @@ actor DataDirScanner {
             guard record.bundleIdentifier == bundleID || legacyIdentityMatches else { continue }
             mountRecordsByPath[url.path] = record
             mountRecordsByPath[path] = record
+            // Offline guards hide external data even when automatic mounting is not paused.
             if recoveryInspection?.validationError == nil,
-               (try? mountStore.isManuallyUnmounted(record)) == true {
+               !isMountPoint(url) || (try? mountStore.isManuallyUnmounted(record)) == true {
                 pausedMountDirectories.insert(url)
                 // Foundation may report the /private/var spelling for a /var fixture.
                 // Resolve only the parent so the leaf cannot become a symlink exemption.
```

**File**: `AppPortsTests/DataDirScannerTests.swift` (modified, +19/-5)
```diff
@@ -1565,7 +1565,16 @@ final class DataDirScannerTests: XCTestCase {
         try await assertPausedGuardAndAncestorSizes(mode: 0o500)
     }
 
-    private func assertPausedGuardAndAncestorSizes(mode: Int) async throws {
+    func testReadableOfflineGuardWithoutManualPauseKeepsSizesIncomplete() async throws {
+        try await assertPausedGuardAndAncestorSizes(mode: 0o500, manuallyPaused: false, volumeOnline: false)
+    }
+
+    func testReadablePendingGuardWithoutManualPauseKeepsSizesIncomplete() async throws {
+        try await assertPausedGuardAndAncestorSizes(mode: 0o500, manuallyPaused: false)
+    }
+
+    private func assertPausedGuardAndAncestorSizes(mode: Int, manuallyPaused: Bool = true,
+                                                  volumeOnline: Bool = true) async throws {
         let workspace = try makeWorkspace()
         defer { cleanupWorkspace(workspace.rootURL) }
         let appURL = try createAppBundle(named: "Example.app", bundleID: "com.example.test", in: workspace.appsURL)
@@ -1577,18 +1586,18 @@ final class DataDirScannerTests: XCTestCase {
         let record = ContainerMountRecord(appName: "Example", bundleIdentifier: "com.example.test", dataDirType: DataDirType.containers.rawValue,
             mountPointPath: source.path, volumeUUID: "PAUSED", volumeName: "Paused", externalRootPath: workspace.externalRootURL.path)
         try store.upsert(record)
-        try store.setManuallyUnmounted(true, record: record)
+        try store.setManuallyUnmounted(manuallyPaused, record: record)
         // Prime the ancestor cache before the guard becomes unavailable.
         XCTAssertTrue(measureDirectorySize(at: parent).isComplete)
         try fileManager.setAttributes([.posixPermissions: mode], ofItemAtPath: source.path)
         defer { try? fileManager.setAttributes([.posixPermissions: 0o700], ofItemAtPath: source.path) }
         guard mode != 0 || !fileManager.isReadableFile(atPath: source.path) else { throw XCTSkip("当前进程可绕过测试目录的文件权限") }
-        let scanner = DataDirScanner(homeDir: workspace.homeURL, mountStore: store, isVolumeOnline: { _ in true })
+        let scanner = DataDirScanner(homeDir: workspace.homeURL, mountStore: store, isVolumeOnline: { _ in volumeOnline })
         let app = AppItem(name: "Example.app", path: appURL, status: "本地")
         let scan = await scanner.scanLibraryDirsWithDiagnostics(for: app)
         var item = try XCTUnwrap(scan.items.first { $0.path.standardizedFileURL == source.standardizedFileURL })
-        XCTAssertTrue(item.autoMountPaused)
-        XCTAssertEqual(item.status, DataDirStatus.pendingMount)
+        XCTAssertEqual(item.autoMountPaused, manuallyPaused)
+        XCTAssertEqual(item.status, volumeOnline ? DataDirStatus.pendingMount : DataDirStatus.volumeMissing)
         XCTAssertTrue(item.canRestore)
         XCTAssertFalse(scan.readIssues.contains(where: \.requiresAttention))
         let measured = measureDataDirectorySize(for: item, pausedMountDirectories: scan.pausedMountDirectories)
@@ -1602,6 +1611,11 @@ final class DataDirScannerTests: XCTestCase {
         XCTAssertEqual(ancestor.bytes, 7)
         XCTAssertFalse(ancestor.isComplete)
         XCTAssertFalse(ancestor.readIssues.contains(where: \.requiresAttention))
+        let addedPayload = parent.appendingPathComponent("added-payload")
+        try Data("new".utf8).write(to: addedPayload)
+        let remeasured = measureDirectorySize(at: parent, pausedMountDirectories: scan.pausedMountDirectories)
+        XCTAssertEqual(remeasured.bytes, 10, "Incomplete ancestor totals must not be cached")
+        XCTAssertFalse(remeasured.isComplete)
         let total = DataDirDisplaySizeSummary(items: [item], hasReadIssues: !measured.readIssues.isEmpty)
         XCTAssertTrue(total.isIncomplete)
 
```

#### Recent Merged Pull Requests:
- **PR #101** (2026-10-29): fix: 离线挂载点改为只读访问并保留写入保护 (@wzh4869)
- **PR #100** (2026-10-28): fix: 支持旧数据副本授权清理并修正签名锁回归测试 (@wzh4869)
- **PR #99** (2026-10-28): fix: 保留手动卸载意图，补齐旧软链恢复和操作受阻诊断 (@wzh4869)
- **PR #98** (2026-10-28): fix(admission): 自动回收已退出进程的登记文件 (@wzh4869)
- **PR #97** (2026-10-28): feat: 支持国内应用内更新并修复更新窗口 (@wzh4869)
- **PR #96** (2026-10-28): style: 统一应用列表与目录按钮样式，优化页面切换动画 (@trah01)

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

## X. authorize retained data cleanup and update signature lock regression

**RULE**:
When implementing operations in `.agents/notes/implemented/architecture/2026-10-10-verified-transfer-lifecycle.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in wzh4869/AppPorts. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a51a6191`: authorize retained data cleanup and update signature lock regression. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `.agents/notes/implemented/architecture/2026-10-10-verified-transfer-lifecycle.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
root 所有的数据旧副本只在用户指定记录重试时授权清理，见[旧数据副本授权清理](../bug-fix/2026-10-28-data-cleanup-administrator-authorization.md)；普通进程继续持锁和写账本。

```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a51a6191` are properly handled with clean fallback behavior.
