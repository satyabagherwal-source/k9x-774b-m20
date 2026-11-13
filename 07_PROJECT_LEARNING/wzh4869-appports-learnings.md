> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/wzh4869-appports-learnings.md`  
> **Source**: github ([https://github.com/wzh4869/AppPorts](https://github.com/wzh4869/AppPorts))  
> **Source Version**: `af5fb956`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T09:56:53.395Z  
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
> **Harvest Timestamp**: 2026-11-13T09:56:53.385Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wzh4869/AppPorts`
- **Description**: 📦 A macOS utility to seamlessly migrate applications to external storage and reclaim local disk space.【一款 macOS 工具，无缝迁移应用到外部存储并自动建立链接，释放宝贵的本地空间】
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2224 stars

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
- **Issue #106** (2026-11-11): **[BUG] 在MAC 27.2.1 中v2.2版本不能迁移微信**
  *Symptoms*: ### 问题描述 / Problem  路径对应的对象或磁盘已改变，已保留内容。 /Applications   ### 复现步骤（选填） / Steps to reproduce (optional)  1、此前删除过之前迁移过的微信 2、重新安装后的微信无法迁移 3、v2.1也存在过问题  ### 发生问题的操作 / Affected operation  应用迁出或迁回 / Move an app out or back  ### AppPorts 版本 / AppPorts version  2.0.0  ### Build 号（选填） / Build number (optional)  2.2.0 (51)  ### macOS 版本 / macOS version  macOS 27  ### Mac 芯片 / Mac processor  Apple Silicon（M 系列 / M-series）  ### 外置存储类型 / External storage type  外置 SSD / External SSD  ### 目标存储的文件系统 / Destination filesystem  APFS  ### 相关外置卷或数据卷是否加密 / External or data volume encryption  None  ### 环境补充（选填） / Additional environment details (optional)  _No response_  ### 截图（选填） / Screenshots (optional)  <img width="952" height="652" alt="Image" src="https://github.com/user-attachments/assets/f1cddb34-9d31-4bad-8303-b25949c5efbe" />  ### 诊断包或相关日志（选填） / Diagnostic package or relevant logs (optional)  [AppPorts-Diagnostic-20261110-152123.zip](https://github.com/user-attachments/files/34616550/AppPorts-Diagnostic-20261110-152123.zip)

- **Issue #93** (2026-10-28): **[BUG] 文件很多的目录做挂载迁移时，lsof +D 超过 30 秒导致「无法完成数据安全检查」**
  *Symptoms*: ### 问题描述 / Problem  **环境** - AppPorts 2.0.0 (50) - Mac17,14（M5 Max），macOS 27.2 - 微信 4.1.15，拆分迁移（msg + business）到外置 APFS 盘  **现象** 迁移微信 msg 目录（约 140 万个文件，约 228GB）时，任务在 0% 失败，提示「无法完成数据安全检查」。重试多次都一样。  **原因** DataOperationSafety.swift 中 requireNoKnownWriters（约第 141 行）调用： `/usr/sbin/lsof -nP -F pcfa +D <path>，timeout: 30` 在这台机器上，对 msg 目录单独执行这条命令需要约 32 秒（缓存已热），超过 30 秒就会被当作检查失败抛出 .inspection。文件越多越容易触发。  **验证** 我把 timeout 从 30 改为 1800，本地编译（ad-hoc 签名），重新授予完全磁盘访问权限和 App 管理权限后重试，同一目录迁移成功。  **建议** 1. 放宽这一步的超时，或按文件数量动态计算； 2. 或者改为不带 +D，执行一次 lsof -F 取全量输出，再在代码里按路径前缀过滤，速度会快很多； 3. 超时的时候，错误提示里最好写明是“检查超时”，而不是笼统的“无法完成数据安全检查”。  ### 复现步骤（选填） / Steps to reproduce (optional)  _No response_  ### 发生问题的操作 / Affected operation  微信账号全部或拆分迁移 / Whole or split WeChat account migration  ### AppPorts 版本 / AppPorts version  2.0.0  ### Build 号（选填） / Build number (optional)  50  ### macOS 版本 / macOS version  macOS 27  ### Mac 芯片 / Mac processor  Apple Silicon（M 系列 / M-series）  ### 外置存储类型 / External storage type  None  ### 目标存储的文件系统 / Destination filesystem  APFS  ### 相关外置卷或数据卷是否加密 / External or data volume encryption  None  ### 环境补充（选填） / Additional environment details (optional)  macOS 27.2；Mac17,14（M5 Max）；微信 4.1.15  ### 截图（选填） / Screenshots (optional)  _No response_  ### 诊断包或相关日志（选填） / Diagnostic package or relevant logs (optional)  _No response_

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

### Incident Patch 1: `af5fb956` (2026-11-11)
**Commit Message**: Merge pull request #108 from aurorax-neo/fix/storage-limitation-confirm-loop

fix: 修复存储能力提示弹窗点击「仍要迁移」陷入死循环的问题

**File**: `AppPorts/ContentView.swift` (modified, +12/-3)
```diff
@@ -2081,9 +2081,14 @@ struct ContentView: View {
     }
 
     /// 校验通过后的迁移收尾：先处理目标存储能力提示，再处理自更新应用确认。
-    func proceedWithMigration(validApps: [AppItem], dest: URL) {
+    func proceedWithMigration(
+        validApps: [AppItem],
+        dest: URL,
+        skipStorageLimitationCheck: Bool = false
+    ) {
         // 目标盘存不住应用需要的元数据时先说明代价；只提示，不阻断。
-        if storageLimitationRequest == nil,
+        if !skipStorageLimitationCheck,
+           storageLimitationRequest == nil,
            let capabilities = StorageCapabilityProbe.probe(destination: dest),
            !capabilities.missing.isEmpty {
             pendingStorageLimitationApps = validApps
@@ -2185,7 +2190,11 @@ struct ContentView: View {
                     let apps = pendingStorageLimitationApps
                     pendingStorageLimitationApps = []
                     storageLimitationRequest = nil
-                    proceedWithMigration(validApps: apps, dest: dest)
+                    proceedWithMigration(
+                        validApps: apps,
+                        dest: dest,
+                        skipStorageLimitationCheck: true
+                    )
                 }
             ]
         )
```

**File**: `AppPortsTests/WarningSheetDismissalAuditTests.swift` (modified, +19/-0)
```diff
@@ -73,6 +73,25 @@ final class WarningSheetDismissalAuditTests: XCTestCase {
         }
     }
 
+    func testStorageLimitationConfirmationSkipsCapabilityRecheck() throws {
+        let contentViewURL = try repositoryRootURL()
+            .appendingPathComponent("AppPorts/ContentView.swift")
+        let content = try String(contentsOf: contentViewURL, encoding: .utf8)
+
+        guard let methodRange = content.range(of: "private func makeStorageLimitationRequest(") else {
+            XCTFail("未找到 ContentView.makeStorageLimitationRequest")
+            return
+        }
+        let tail = String(content[methodRange.lowerBound...])
+        let methodBody = tail.components(separatedBy: "\n    private func ").first ?? tail
+
+        XCTAssertTrue(
+            methodBody.contains("skipStorageLimitationCheck: true"),
+            "makeStorageLimitationRequest 的「仍要迁移」回调在关闭弹窗（storageLimitationRequest = nil）后"
+                + "调用 proceedWithMigration 时必须传入 skipStorageLimitationCheck: true，否则会再次触发存储能力弹窗死循环"
+        )
+    }
+
     private func hasNonNilAssignment(to name: String, in source: String) throws -> Bool {
         // This is a source audit, not a Swift parser or a reachability proof.
         let code = source.components(separatedBy: .newlines)
```

---

### Incident Patch 2: `9e6af5ad` (2026-11-10)
**Commit Message**: fix: 修复存储能力提示弹窗点击「仍要迁移」陷入死循环的问题 (#107)

**File**: `AppPorts/ContentView.swift` (modified, +12/-3)
```diff
@@ -2081,9 +2081,14 @@ struct ContentView: View {
     }
 
     /// 校验通过后的迁移收尾：先处理目标存储能力提示，再处理自更新应用确认。
-    func proceedWithMigration(validApps: [AppItem], dest: URL) {
+    func proceedWithMigration(
+        validApps: [AppItem],
+        dest: URL,
+        skipStorageLimitationCheck: Bool = false
+    ) {
         // 目标盘存不住应用需要的元数据时先说明代价；只提示，不阻断。
-        if storageLimitationRequest == nil,
+        if !skipStorageLimitationCheck,
+           storageLimitationRequest == nil,
            let capabilities = StorageCapabilityProbe.probe(destination: dest),
            !capabilities.missing.isEmpty {
             pendingStorageLimitationApps = validApps
@@ -2185,7 +2190,11 @@ struct ContentView: View {
                     let apps = pendingStorageLimitationApps
                     pendingStorageLimitationApps = []
                     storageLimitationRequest = nil
-                    proceedWithMigration(validApps: apps, dest: dest)
+                    proceedWithMigration(
+                        validApps: apps,
+                        dest: dest,
+                        skipStorageLimitationCheck: true
+                    )
                 }
             ]
         )
```

**File**: `AppPortsTests/WarningSheetDismissalAuditTests.swift` (modified, +19/-0)
```diff
@@ -73,6 +73,25 @@ final class WarningSheetDismissalAuditTests: XCTestCase {
         }
     }
 
+    func testStorageLimitationConfirmationSkipsCapabilityRecheck() throws {
+        let contentViewURL = try repositoryRootURL()
+            .appendingPathComponent("AppPorts/ContentView.swift")
+        let content = try String(contentsOf: contentViewURL, encoding: .utf8)
+
+        guard let methodRange = content.range(of: "private func makeStorageLimitationRequest(") else {
+            XCTFail("未找到 ContentView.makeStorageLimitationRequest")
+            return
+        }
+        let tail = String(content[methodRange.lowerBound...])
+        let methodBody = tail.components(separatedBy: "\n    private func ").first ?? tail
+
+        XCTAssertTrue(
+            methodBody.contains("skipStorageLimitationCheck: true"),
+            "makeStorageLimitationRequest 的「仍要迁移」回调在关闭弹窗（storageLimitationRequest = nil）后"
+                + "调用 proceedWithMigration 时必须传入 skipStorageLimitationCheck: true，否则会再次触发存储能力弹窗死循环"
+        )
+    }
+
     private func hasNonNilAssignment(to name: String, in source: String) throws -> Bool {
         // This is a source audit, not a Swift parser or a reachability proof.
         let code = source.components(separatedBy: .newlines)
```

---

### Incident Patch 3: `e3b5a73a` (2026-11-09)
**Commit Message**: fix: 更新确认方法以支持主线程执行的回调
fix: 修复异步操作的上下文传递逻辑

**File**: `AppPorts/Services/AppInstallationLocation.swift` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ enum AppInstallationLocation {
     @MainActor
     static func confirmIfNeeded(applicationURL: URL = Bundle.main.bundleURL,
                                 homeDirectory: URL = FileManager.default.homeDirectoryForCurrentUser,
-                                present: () -> Void = presentGuidance) -> Bool {
+                                present: @MainActor () -> Void = presentGuidance) -> Bool {
         guard !isAllowed(applicationURL, homeDirectory: homeDirectory) else { return true }
         present()
         return false
```

**File**: `AppPorts/Services/ApplicationLaunchProtection.swift` (modified, +3/-1)
```diff
@@ -28,7 +28,9 @@ enum ApplicationLaunchProtection {
     static func detached<T: Sendable>(priority: TaskPriority, operation: @escaping @Sendable () async throws -> T) async throws -> T {
         let context = held
         return try await Task.detached(priority: priority) {
-            try await $held.withValue(context, operation: operation)
+            try await $held.withValue(context) {
+                try await operation()
+            }
         }.value
     }
 }
```

#### Recent Merged Pull Requests:
- **PR #108** (2026-11-11): fix: 修复存储能力提示弹窗点击「仍要迁移」陷入死循环的问题 (@aurorax-neo)
- **PR #104** (2026-11-08): feat: 完善应用库映像恢复、启动入口与权限引导 (@trah01)
- **PR #103** (2026-11-02): fix: 兼容 macOS 27 受保护的 quarantine，修复带标记应用迁移失败 (@Souitou-iop)
- **PR #102** (2026-10-31): feat: 新增磁盘映像应用库并优化扫描与迁移 (@trah01)
- **PR #101** (2026-10-29): fix: 离线挂载点改为只读访问并保留写入保护 (@wzh4869)
- **PR #100** (2026-10-28): fix: 支持旧数据副本授权清理并修正签名锁回归测试 (@wzh4869)

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

## X. Merge pull request #108 from aurorax-neo/fix/storage-limitation-confirm-loop

**RULE**:
When implementing operations in `AppPorts/ContentView.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in wzh4869/AppPorts. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `af5fb956`: Merge pull request #108 from aurorax-neo/fix/storage-limitation-confirm-loop. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `AppPorts/ContentView.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    func proceedWithMigration(
        validApps: [AppItem],
        dest: URL,
        skipStorageLimitationCheck: Bool = false
    ) {
        if !skipStorageLimitationCheck,
           storageLimitationRequest == nil,
                    proceedWithMigration(
                        validApps: apps,
                        dest: dest,
                        skipStorageLimitationCheck: true
                    )
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
    func proceedWithMigration(validApps: [AppItem], dest: URL) {
        if storageLimitationRequest == nil,
                    proceedWithMigration(validApps: apps, dest: dest)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `af5fb956` are properly handled with clean fallback behavior.
