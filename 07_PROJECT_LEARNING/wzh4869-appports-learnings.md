> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/wzh4869-appports-learnings.md`  
> **Source**: github ([https://github.com/wzh4869/AppPorts](https://github.com/wzh4869/AppPorts))  
> **Source Version**: `412290e7`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-26T18:25:34.831Z  
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
> **Harvest Timestamp**: 2026-10-26T18:25:34.824Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wzh4869/AppPorts`
- **Description**: 📦 A macOS utility to seamlessly migrate applications to external storage and reclaim local disk space.【一款 macOS 工具，无缝迁移应用到外部存储并自动建立链接，释放宝贵的本地空间】
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2179 stars

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
- **Issue #88** (2026-10-24): **[BUG] Cursor 在迁移了应用数据后无法正常更新**
  *Symptoms*: ### 问题描述 / Problem  点击 Update 按钮后显示无法完成更新  ![](https://i.imgur.com/nqVvUwr.png) ![](https://i.imgur.com/Z3MayWA.png)  ### 复现步骤（选填） / Steps to reproduce (optional)  _No response_  ### 发生问题的操作 / Affected operation  应用链接、启动或更新 / App linking, launching or updating  ### AppPorts 版本 / AppPorts version  1.9.3  ### Build 号（选填） / Build number (optional)  _No response_  ### macOS 版本 / macOS version  macOS 27  ### Mac 芯片 / Mac processor  Apple Silicon（M 系列 / M-series）  ### 外置存储类型 / External storage type  外置 SSD / External SSD  ### 目标存储的文件系统 / Destination filesystem  APFS  ### 相关外置卷或数据卷是否加密 / External or data volume encryption  已加密 / Encrypted  ### 环境补充（选填） / Additional environment details (optional)  _No response_  ### 截图（选填） / Screenshots (optional)  _No response_  ### 诊断包或相关日志（选填） / Diagnostic package or relevant logs (optional)  _No response_

- **Issue #82** (2026-10-20): **[BUG] App Store 装在外置硬盘上的软件（微软家的Word办公套件）无法正常检测签名**
  *Symptoms*: ### 问题描述 / Problem  如图，从官方安装的无法检验签名 <img width="1483" height="332" alt="Image" src="https://github.com/user-attachments/assets/10cedcf0-bb6b-4a6a-b4dc-66fec58cfa39" />  <img width="560" height="484" alt="Image" src="https://github.com/user-attachments/assets/a9773496-713f-4a4a-b95b-2c675967ac9a" />  ### 复现步骤 / Steps to Reproduce  1、在1.9.2版本前链接外置硬盘的软件 2、更新最新版后出现签名待检查，未对应用数据进行迁移 3、目前只有微软的套件存在问题 ps：只迁移过 Edge 的数据  ### 设备系统版本 / OS Version  macOS 27.0.1  ### 软件版本 / App Version  v1.9.2  ### 诊断信息确认 / Diagnostics  - [x] 我已附上诊断包；如无法提供，已在下方说明原因。 / I attached a diagnostic package or explained why it is unavailable.  ### 诊断包 / Diagnostic Package  [AppPorts-Diagnostic-20261019-104416.zip](https://github.com/user-attachments/files/33646535/AppPorts-Diagnostic-20261019-104416.zip)  ### 外置存储设备类型 / External Storage Type  - [ ] NAS - [ ] 移动硬盘 / Portable External Drive - [x] 移动硬盘盒 / Drive Enclosure - [ ] 其他 / Other  ### 外置存储设备产品名 / External Storage Product Name  _No response_  ### 截图（可选） / Screenshots (Optional)  _No response_  ### 日志（可选，仅在无诊断包时填写） / Logs (Optional, only if no diagnostic package)  ```shell  ```

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

### Incident Patch 1: `3d0c1d58` (2026-10-24)
**Commit Message**: fix(migration): 修正进度阶段与重试范围并优化微小文件复制

进度显示与实际入口切换
- 将全任务估算百分比与当前目录的六阶段步骤分开显示，多目录任务补充目录索引，避免用总体条的终点点亮当前目录阶段。
- 在私有准备挂载前声明目录观察范围，最终证明完成后、正式入口提交前记录 observeEntrySwitch；提前的 switching 通知仍按准备或校验呈现。
- 正式切换开始后的内部校验保持切换步骤，清理中的挂载和校验保持收尾步骤，修复复制后在校验/切换之间反复跳动的问题。
- 冷恢复接续已验证与已切换事实；同路径前驱清理后的新复制重置显示状态。应用包保留原 switching 语义，底层实际阶段统计和关键区间保护不变。

有界微小文件复制
- strictData 对同目录连续普通文件启用最多四路复制，资格限定为不超过 16 KiB、无硬链接组、无资源叉；其余节点及 appBundle 沿原串行路径处理。
- 每个工作任务使用独立计数与链接表，复用原节点复制逻辑；父描述符保持打开至所有任务退出，结果与进度回调按原词法顺序归并。
- Task 取消或单任务 I/O 故障先停止并收齐所有工作，唤醒暂停控制，保证返回或独立恢复后没有在途写入。
- 资格从更宽范围收窄至 16 KiB，依据外置 APFS 对比中较大文件的写入/同步回退；不将合成微小文件收益推广为真实微信全任务的固定比例提速。

应用重试与 CI 失败修复
- retryTransfer 持锁后按 operationID 严格读取当前记录，再执行原弹盘暂停检查，避免 records().first 的整库解码被无关损坏 plist 阻塞。
- 选中的损坏或缺失记录仍拒绝恢复，无关损坏记录继续保留字节和诊断；目标盘暂停仍阻止重试。
- 保留原 SHA-256/内容证明、基线、元数据、同步、切换凭据、清理授权、操作锁、写入者准入和失败恢复流程；不修改旧副本删除算法。

回归与验证
- 数据迁移、树复制、准备恢复、完成、进度和工作流相关 335 项通过：106 项 XCTest、229 项 Swift Testing；显式性能用例默认跳过 1 项。
- 应用迁移及弹盘相关 164 项通过：AppMigrationServiceTests 61 项、AppTransferTransactionTests 76 项、DiskEjectionTests 27 项。
- 保留 CI 原失败用例的全部断言，新增选中损坏记录拒绝、暂停时记录和目标指纹不变、解除暂停后完成清理的覆盖。
- 28 组中英文、明暗与阶段渲染通过；arm64/x86_64 Release clean build 和 deep/strict 签名验证通过。
- 完成同构建内外盘 ABBA 微小文件对比，以及已授权微信 bus

**File**: `.agents/notes/implemented/architecture/2026-10-21-后台迁移任务与异常处理.md` (modified, +2/-0)
```diff
@@ -39,6 +39,8 @@ APFS 失败弹窗的显式重试携带 `MigrationJob.RetryToken`，继续使用
 
 从未启用且有独占归属的失败迁移卷改为可丢弃候选，内容相等要求的局部替代见[失败迁移卷自动收尾](../bug-fix/2026-10-22-failed-migration-candidate-disposal.md)；已启用目标、还原暂存与未知材料仍遵循原保护规则。
 
+总体估算与当前目录阶段的呈现见[进度显示范围](../bug-fix/2026-10-24-migration-progress-scopes.md)，任务合算及持久化完成语义保留。
+
 ## Alternatives considered
 
 - **继续由各页面持有任务**：实现局部且无需调度器，但切换页面、资源冲突与跨页面取消无法由一个持有者协调。
```

**File**: `.agents/notes/implemented/architecture/2026-10-24-bounded-data-scan-reads.md` (modified, +2/-0)
```diff
@@ -22,6 +22,8 @@ Status: implemented
 - [数据进度](../../implemented/feature/2026-10-14-data-transfer-progress.md)部分重叠：显式传递现有观察器，计数对应实际完整读取，不新增扫描。
 - [同层并发应用复制](../../proposed/feature/2026-10-20-concurrent-app-tree-copy.md)属于复制调度，本篇只并发只读扫描，没有目标写入、硬链接创建或发布协议的交叉。
 
+普通小文件的写入调度见[有界小文件复制](2026-10-24-small-file-copy-batches.md)，本篇的读取证明和预算保持不变。
+
 ## Alternatives considered
 
 - 直接使用原始缓冲区更新 SHA-256：改动更窄，但本机 Release 优化微基准中 2 GiB 内存散列约 0.68–0.74 秒，与当前 ArraySlice 更新没有稳定差异，因此不把它作为主要性能方案。
```

**File**: `.agents/notes/implemented/architecture/2026-10-24-small-file-copy-batches.md` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+# Agent Note: 普通小文件以有界批次复制并在返回前收齐写入
+
+Status: implemented
+
+## Problem
+
+完整扫描并发化之后，实际复制仍逐文件串行。保存的微信 msg 基线含 163,704 个普通文件，其中 131,323 个不超过 64 KiB；大量文件的打开、内容写入和完整元数据回放仍逐个等待。用户要求进一步优化，同时保留所有基线、同步、核验、清理授权和恢复逻辑。
+
+## Decision
+
+strictData 对同目录内连续的普通小文件使用最多四个工作任务，每个文件不超过 16 KiB、没有硬链接组和资源叉。目录、大文件、硬链接、资源叉、FIFO 和符号链接在批次收齐后沿原路径串行处理，appBundle 保持串行。
+
+工作任务共享不可变清单和索引，各自持有独立复制计数和硬链接表；只调用原节点复制逻辑，不增加内容证明缓存。源和目标父描述符保持打开直到批次全部退出。成功结果按原词法顺序归并，外部进度回调仍由调用者逐项等待。取消和错误先停止批次并收齐所有工作，再允许抛错或独立恢复；Task 取消唤醒原暂停控制，批次状态不传入独立恢复。
+
+## Existing-note audit
+
+- [完整扫描并发](../../implemented/architecture/2026-10-24-bounded-data-scan-reads.md)部分重叠：本篇增加写入调度，扫描的证明预算和调度不变。
+- [同层并发应用树复制](../../proposed/feature/2026-10-20-concurrent-app-tree-copy.md)部分重叠：本篇只处理 strictData 普通小文件；应用树、大文件及跨目录硬链接提案继续保留。
+- [严格数据复制](../../implemented/architecture/2026-10-01-data-path-copy-safety.md)、[持久化事务](../../implemented/architecture/2026-10-10-verified-transfer-lifecycle.md)和[自动恢复](../../implemented/architecture/2026-10-12-apfs-automatic-recovery.md)继续约束所有检查与独立恢复，不被替代。
+
+## Alternatives considered
+
+- 增大数据缓冲区：对大文件有可能有益，但当前缓冲区已按文件大小分配，上述多数文件小于 64 KiB，不能消除逐文件元数据等待。
+- 并发整棵树和全部节点：可能覆盖更多延迟，但目录描述符和跨目录硬链接会增加同步范围，本轮限制为连续普通小文件。
+- 打包复制或减少核验：能减少部分文件系统往返，但改变可恢复材料及删除依据，不满足用户保留现有兜底的要求。
+
+## Threshold evidence
+
+初始1 MiB资格在内盘合成ABBA中有收益；解锁后外盘ABBA发现64 KiB文件四路复制约3.295秒，串行约1.408秒，含原同步与校验总时间约4.366秒对2.361秒。进一步按1/2/4/4/2/1复测，4/8/16 KiB的四路结果稳定快于串行；64 KiB两路约3.280秒，四路一轮3.329秒、一轮0.670秒，串行两轮约1.35秒。不能将更宽资格作为该外盘的稳定收益。
+
+资格收窄为16 KiB，保留四路对大量微小文件的收益，并让64 KiB等更大的文件沿原串行路径。保存的msg基线中107,489/163,704个普通文件不超过16 KiB；该历史分布只解释覆盖范围，不证明当前微信总任务提速。原始外盘对比为build/Validation/small-copy-external.json，尺寸/宽度矩阵为small-copy-external-matrix.json。
+
+## Verification
+
+隔离 XCTest 宿主使用最终 16 KiB 资格源码。树复制、资源叉、所有权、目录迁移、挂载迁移、准备恢复、完成、进度、冷恢复、重入、维护、任务中心和工作流审计共 331 项通过；测速用例默认跳过并单独启用。最终结果为 build/Validation/SmallCopyTinyRegression.xcresult，日志 /tmp/AppPorts-small-copy-tiny-regression.log。补充应用事务此前 75 项通过，一项损坏无关记录测试失败；修改前的既有扫描优化测试产品中同一测试也在损坏记录解码时失败，证据为 SmallCopyBaselineFailure.xcresult。没有删除或放宽该断言。该重试路径的整库读取缺陷现由[弹盘暂停准入](../feature/2026-10-23-explicit-disk-ejection.md)记录修复，应用事务 76 项和相关暂停回归均已通过。
+
+新增用例比较串行/四路完整清单、元数据、跨目录硬链接、资源叉和完整有序回调序列，并用实际数据 seek barrier 证明工作重叠且不超过四路，TaskLocal 测量继承及三倍完整散列读取保持一致。Task 取消与单工作 I/O 故障后，全部工作收齐且候选停止变化，源不变，独立重试仍成功。首文件回调可能发生在同批第二文件完成后，准备恢复测试同时跑 1/4 路：串行保留真正部分副本，四路检查已写文件的完整内容；两者都验证返回后不再写入、基线未完成、事务未切换，并在冷账本上取消或继续恢复。16 KiB/16 KiB+1/64 KiB 实际 seek 重叠边界用例保证资格两边分别并发和串行；元数据/取消夹具为 4 KiB，继续覆盖真正的工作重叠。
+
+Xcode 在报告夹具异常时卡在 CoreSymbolicationDT；临时 xctestrun 去掉 libRPAC/PERFC 性能诊断注入并以 XCTDisableAggressiveSymbolication 禁止进程内积极符号化，保留 XCTest、MainThreadChecker、所有测试和断言。以上配置只修改忽略的构建产品，没有改系统访问保护、FDA 或测试宿主写入用户账本的拒绝条件。
+
+最终普通产品的 arm64/x86_64 Release clean build 成功，未注入 get-task-allow，deep/strict 签名验证及原安装版指定要求核对通过；构建日志 /tmp/AppPorts-small-copy-tiny-release.log。
+
+最终同一 Debug 构建使用 6,000 个 4 KiB、16 KiB 或 64 KiB 文件，每组按 1/4/4/1 路运行，完整预读、原同步和三遍散列保留。内盘 4/16 KiB 复制阶段中位数分别为 1.308 → 0.830 秒、1.494 → 0.961 秒，含扫描、同步、校验的总时间为 2.019 → 1.516 秒、2.334 → 1.813 秒。外盘相应复制时间为 1.532 → 1.041 秒、1.735 → 1.023 秒，总时间为 2.329 → 1.744 秒、2.622 → 1.868 秒。64 KiB 在两种宽度设置下实际都串行；内盘总时间为 3.130/3.208 秒，外盘为 3.475/3.325 秒，没有初始宽资格测试的显著回退。
+
+夹具都位于自建 UUID 目录并在完成后移除，原始结果为 build/Validation/small-copy-tiny-internal.json 和 small-copy-tiny-external.json，测试结果为 SmallCopyTinyInternal.xcresult 和 SmallCopyTinyExternal.xcresult。这些是同构建合成文件组，不能据此承诺整个真实微信任务固定比例提速。锁屏时外盘试运行停在自有夹具的 mkdir 并停止；解锁后的正式外盘测试成功。
+
+微信 business 卷使用最终 Release 诊断宿主，以 1/4/4/1 路执行四轮生产 restoreAndComplete/migrateAndComplete。每轮 1,766 个节点、134,607,593 字节，迁回和迁出后均另行完整核验内容与元数据；其他卷及链账本、保留材料、重挂阻断记录和弹盘暂停文件均核对不变，待恢复/待清理为空。复制阶段迁回中位数 0.585/0.624 秒、迁出 0.536/0.505 秒；总时间相应为 5.982/5.931 秒、6.765/5.955 秒。该混合小目录总时间主要由 APFS 准备、切换、收尾决定，四轮的总时间差不能全部归因于复制调度。报告为 build/Validation/small-copy-real-wechat-20261024-064459/results.json。
+
+诊断宿主位于忽略的构建目录，只将当前产品入口替换为已授权的实盘测试入口；其余生产源码逐文件核对相同，签名及指定要求与安装版一致，没有 get-task-allow。操作仍持有 OperationLock、WriterAdmission 和 ApplicationLaunchProtection，拒绝加密/锁定卷和运行中的写入者；每轮从当前账本解析 UUID，不复用已删除卷的 UUID。微信通过应用菜单正常退出，测试前已确认相关进程与卷上 lsof 均为空。失败即停止并保留生产恢复账本，不手工恢复旧 plist 或删除材料。
+
+微信 msg 卷使用同一最终 Release 宿主完成四路资格的一轮完整往返，172,982 个节点、33,528,214,034 字节；当前基线 163,704 个普通文件中 107,479 个符合 16 KiB 且无硬链接/资源叉的资格。迁回复制 168.369 秒、核验 184.883 秒、总时间 480.950 秒；迁出复制 312.871 秒、核验 119.246 秒、收尾 194.617 秒、总时间 712.171 秒。迁回和迁出均另行完整核验内容与元数据，结果 passed，清理完成；最终 msg UUID 为 A85C3B50-2842-40A7-8D1D-7283EB1342E2。其他账本集合及弹盘暂停文件核对不变，其他两个卷保持挂载，待恢复/待清理/保留材料均为空。报告为 build/Validation/small-copy-real-wechat-20261024-064645/msg-1-copies4/result.json。
+
+msg 这一轮没有同构建串行对照，不用于宣称整体提速。大文件字节量与原有完整读取校验、清理仍占明显时间；不能把合成微小文件组的比例推广到这个完整任务。
+
+最终普通新版在 operation.lock 互斥保护下原子替换 /Applications/AppPorts.app；替换前的完整安装包保存在 build/Validation/small-copy-install-20261024-071046/AppPorts-previous.app。安装包可执行文件 SHA-256 为 d1cbcdd117bca081f3ed12429d36589ceaa1024ba656261041a9f850d90d8f73，登录代理刷新到 CDHash a33601c4ec40fae4494116a779ef720b4d893b5d，代理退出 0。安装及正常启动前后挂载账本和弹盘暂停文件逐字节一致，三个卷保持挂载，待恢复/待清理为空。已观察最终安装版正常主窗口及空闲任务中心；微信已重新启动到原登录窗口。报告为同目录 install-report.json，阶段界面另有 28 个组合渲染验证。
+
+## Conseque
```

**File**: `.agents/notes/implemented/bug-fix/2026-10-24-migration-progress-scopes.md` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+# Agent Note: 总体进度与当前目录阶段使用独立显示范围
+
+Status: implemented
+
+## Problem
+
+微信拆分操作将 msg 和 business 的分组进度合成任务百分比，界面却按该百分比点亮当前目录的六阶段标签。标签等距、进度权重不等距，使蓝色终点与阶段不对应。准备新卷时的临时挂载被测量为 switching，将尚未开始复制的分组提前推到 88%，两目录任务因此刚扫描就显示 44%。复制后的切换准备通知、私有卷卸载同样早于最终源/目标证明，若直接用这些事件高亮，就会在切换和校验之间反复跳动。
+
+## Decision
+
+总体条只展示全任务估算百分比；当前目录的阶段单独显示为六个等宽步骤，使用实际阶段高亮，并在多目录任务中显示目录索引。准备中的挂载、同步、核验及清理只推进准备范围，实际复制开始后沿用原阶段权重。正式入口切换由调用者在最后证明之后、入口提交之前以 observeEntrySwitch 单独观察；此前的 switching 仅显示为校验，不推进切换权重。真实入口切换开始后的内部核验仍属于切换；清理中的挂载与核验均保持收尾步骤。底层 stage 和每轮统计继续记录实际活动，视图用 presentationStage 呈现所属工作步骤。独立恢复观察器在原验证门禁之后记录已验证/已切换事实，仅更新显示；准备副本提升后无需重复制也能显示实际切换，独立旧副本清理显示收尾。
+
+目录工作流在私有准备挂载前声明 tracksEntrySwitchBoundaries；只有接入正式入口观察的目录流程应用这一映射，应用包保留原 switching 事件语义。新复制在源清单扫描之前以 observeNewCopy 清空同目录前驱清理、已切换及复制进度事实，内部 preparing 不触发重置。normalizeManagedLink 的实际入口交换同样记录 observeEntrySwitch。
+
+显示修正只作用于观察快照和视图。DataTransferProgress.begin 原有关键区间标记、MigrationExecution、操作锁、持久化状态机和完成依据保持原行为。
+
+## Existing-note audit
+
+- [后台任务](../../implemented/architecture/2026-10-21-后台迁移任务与异常处理.md)部分重叠：任务合算和历史语义保留，本篇替代以总体百分比点亮目录阶段的呈现。
+- [真实工作阶段](../../implemented/feature/2026-10-14-data-transfer-progress.md)部分重叠：实际活动计数、速率和观察器的执行保护继续保留。
+
+## Alternatives considered
+
+- 按权重重排原标签：更接近单目录条的比例，但准备和扫描标签会挤在一起，且两个目录合算仍无法表示当前目录阶段。
+- 把总体进度改成当前目录进度：蓝色条可以对应当前阶段，但切换到 business 时会归零，丢失全任务范围。
+- 将挂载测量改为 preparing：能修正显示，却同时改变分阶段测量和观察器的关键区间标记，本篇只修正呈现与估算。
+
+## Verification
+
+DataTransferProgressTests 验证双目录全任务合算、下一目录重置、准备挂载不跳到后半程、关键区间保护保持原行为，以及新观察器接续已验证或已切换事务。DataPreparationRecoveryTests.completeCandidateSurvivesBaselineSave 使用 mount/symlink 两模式的真实恢复夹具，区分最终证明前的原保护通知（步骤3）与正式切换，末尾清理为步骤5，同时保留无重复制的目录身份与 addVolume 断言。DataTransferCompletionTests 用全新观察器清理保留链，检查收尾步骤与原身份、内容、清理顺序。
+
+最终相关 331 项回归通过；普通 arm64/x86_64 Release clean build 和签名验证通过。构建日志 /tmp/AppPorts-small-copy-tiny-release.log；最终恢复回归结果位于 build/Validation/SmallCopyTinyRegression.xcresult。完整元数据、基线、同步、清理授权及独立恢复没有改变。
+
+MigrationSafetyRenderTests/testRenderDataTransferProgressStages 渲染28个中英文/明暗/阶段组合。总体条与当前目录步骤独立，双目录切换时总体44%且步骤高亮切换，清理时高亮收尾，长路径与正文布局可读。最终渲染结果在 build/Validation/small-copy-progress-renders，测试结果 SmallCopyRender3.xcresult。安装及代理验证见[有界小文件复制](../architecture/2026-10-24-small-file-copy-batches.md)。
+
+## Follow-up verification
+
+新增顺序用例覆盖复制结束后的提前切换通知、私有卸载、源/目标证明、正式入口提交，以及切换/清理内部继续核验。应用包的 switching 原语义、私有准备挂载前的范围声明、同目录前驱清理后新复制重置和 normalize 实际入口交换均有回归。此类观察事件只改变显示，不调用执行控制或修改持久化事务；既有关键区间保护用例保留。
+
+本轮隔离宿主回归 106 项 XCTest 与 229 项 Swift Testing（共335项）通过，另1项小文件性能对照 XCTest 因未设置测速目录而跳过。结果位于 build/Validation/EntryProgressRegressionFinal.xcresult，日志 /tmp/AppPorts-entry-progress-tests-final.log。独立复审未发现剩余 P1/P2；完整校验、删除授权与持久化顺序保持原行为。此轮仅修正阶段显示，没有修改旧副本删除算法或测得清理提速。
+
+本轮 arm64/x86_64 Release clean build 与 deep/strict 签名验证通过，日志 /tmp/AppPorts-entry-progress-release-final.log。28组中英文、明暗及阶段渲染通过，结果 build/Validation/EntryProgressRender.xcresult 与 entry-progress-renders；已检查校验、切换、收尾布局。
+
+当前任务结束且账本无待处理项后，安装版正常退出并原子替换为本轮产品。安装与启动验证位于 build/Validation/small-copy-install-20261024-075946/，旧产品保留为 AppPorts-previous.app。新安装可执行文件 SHA256 为 04b2aedc062f9157445bebd49e276f50cb26122a8afad7fd5c359b4fe275db54，CDHash 为 b46d6a4ba8f05c608943baccf998c64543697c42。代理签名身份已刷新至该 CDHash，运行路径为 /Applications/AppPorts.app/Contents/MacOS/AppPorts，代理退出0。账本与弹盘暂停文件逐字节保持不变，现场三个记录卷仍挂载，待恢复/清理为0。微信 msg/business 的 UUID 采用用户最新完成任务后的现场记录，未用前一轮测试 UUID 代替。新版界面已回到微信应用数据页面并识别 msg + business 已挂载。
+
+## Consequences
+
+总体百分比仍是阶段与目录合算的估值，无法承诺剩余时间。独立阶段条增加少量高度，需要在固定弹窗中检查内容及操作按钮。
```

**File**: `.agents/notes/implemented/feature/2026-10-14-data-transfer-progress.md` (modified, +2/-0)
```diff
@@ -27,6 +27,8 @@ Status: implemented
 - 与[APFS 自动恢复与清理](../../implemented/architecture/2026-10-12-apfs-automatic-recovery.md)部分重叠：只补齐脱离取消任务后的可见进度，保留其独立恢复预算。
 - 其余命中“校验／清理”的签名备份、所有权和旧基线重试决定属于执行安全约束，不被此呈现改动吸收或替代。
 
+全任务估算与当前目录步骤的独立显示见[进度显示范围](../bug-fix/2026-10-24-migration-progress-scopes.md)，本篇的观察和执行保护继续成立。
+
 ## Alternatives considered
 
 - **只补旋转动画和计时器**：改动小、没有跨模块观察器，但无法解释当前文件工作，也容易把界面仍在刷新误认为存储仍有进展。
```

**File**: `.agents/notes/implemented/feature/2026-10-23-explicit-disk-ejection.md` (modified, +4/-0)
```diff
@@ -64,17 +64,21 @@ AppPorts 的结果显示独立于 Finder。`PhysicalDiskMonitor` 只注册 Disk
 - **IOMedia 存在即认定卷仍在线**：身份稳定，适合防止把部分卸载误认作整盘消失；但桥接盒可在全部卷卸载后继续保留介质对象。增加内核挂载状态，并使用“全部卸载但仍连接”的独立状态，而不放宽物理重连接识别。
 - **根据 Finder 窗口、脚本退出码或超时推断取消/成功**：接近用户操作，但退出码只证明请求已接受，仍在线也可能只是原生对话框等待，无法可靠判定取消；独立观察内核物理连接，并保留明确恢复入口。
 - **捕获全部外部弹出请求**：覆盖用户直接操作 Finder，但引入常驻仲裁、内部请求区分和原请求替换。本轮只覆盖 AppPorts 入口。
+- **重试前严格读取全部应用记录**：可以一次得到整库合法性，但一条无关损坏 plist 会阻塞已切换事务的清理；单条严格读取已足够取得当前事务的暂停范围，其他诊断继续由 inventory 展示。
 
 ## Recovery and compatibility
 
 暂停覆盖整盘已知卷、容器和原挂载路径，并在自动应用/数据事务重试、签名历史备份搬迁、材料删除、原位挂载入口共同生效。签名备份的新目的地在准备目录前过滤，选址后也核对，避免尚未保存目的地的旧记录绕过暂停。多物理成员的 APFS 构造拒绝全部已知成员，即使其中一个还有普通分区。
 
+`AppMigrationService.retryTransfer` 持锁后按请求的 operationID 严格读取单条应用记录，再检查其卷身份与源、目标、暂存路径是否暂停。无关损坏记录继续由 inventory 隔离并显示，不能在暂停检查时通过严格整库 records() 阻塞合法事务；选中的损坏或缺失记录仍拒绝重试，暂停文件无法读取仍拒绝恢复。原有内容基线、切换凭据和旧副本清理规则继续由事务执行器验证。
+
 EFI FAT UUID 在本机两块无关外盘上实际相同，因此只保留物理分区映射，不将 EFI 的 UUID 或路径作为数据盘身份。其他重复数据卷 UUID 保持歧义拒绝，不能仅凭同名或 diskN 恢复。
 
 界面初次刷新遇到操作锁竞争会持续重试；磁盘清单查询失败仍显示可读的暂停记录和手动恢复入口，连接状态保持未知。后台查询成功才据物理连接清除暂停。旧主程序/登录代理不具备新 writer capability 时必须重新启动到支持暂停的版本，不能让旧进程忽略暂停状态。
 
 ## Verification
 
+- CI run `40027290368` 的应用账本回归在重试 `Pending.app` 时因无关截断 plist 抛出 `DecodingError.dataCorrupted`；同一用例在本机修改前复现。单条读取修正后，隔离宿主的 `AppMigrationServiceTests` 61 项、`AppTransferTransactionTests` 76 项及 `DiskEjectionTests` 27 项全部通过（137 项 XCTest、27 项 Swift Testing），结果位于 `build/Validation/CIRetryRecordAfter.xcresult`。原失败用例还验证选中损坏记录拒绝、目标路径暂停时记录及目标指纹不变、暂停记录保留、解除暂停后完成清理，并保留两条无关损坏记录的原始字节和诊断。没有删除测试或放宽清理断言。最终 arm64/x86_64 Release `xcodebuild clean build` 及 bundle 签名验证通过；63 篇笔记目录、格式、归档校验与 `git diff --check` 通过。旧 CI run 对应修正前的提交 dc0e9de，不能作为修正后的验证结果；本轮 CI 修复没有替换安装版。
 - 桥接盒卸载状态修正通过 15 项 XCTest 和 39 项 Swift Testing，覆盖隐藏卷、EFI、快照来源、相似 BSD 前缀、挂载表读取失败以及三种 APFS 映射缺失。显式启用的真实桥接盒测试只读当前 hano：逐卷确认无挂载点，确认原 IOMedia 在线，并验证最终分类为 unmounted；不写暂停账本、不发起挂载或弹出。相关内核挂载表诊断和本地化回归同时通过。
 - 该修正的最终版本为 2.0.0 (47)，Debug/Release 产品配置同步递增 build。Release clean build 通过，备份后替换安装版；安装 Info.plist 与二进制哈希核对一致，原生主窗口启动通过。只删除已核对备份的临时旧安装副本，保留更新备份。
 - build 47 的安装验收未覆盖实际 TCC 代码要求，用户随后发现微信卷无法原位接回。build 48 改用原开发签名并经用户更新授权后，两个卷自动原位挂载且带 nobrowse；签名失配证据、安装约束和应用验收边界见[微信挂载恢复事故](../bug-fix/2026-10-12-wechat-mount-recovery.md)。这不改变上述隔离与只读测试的覆盖范围。
```

**File**: `.agents/notes/proposed/feature/2026-10-20-concurrent-app-tree-copy.md` (modified, +2/-0)
```diff
@@ -40,6 +40,8 @@ case .directory:
 - **进度与取消语义**：并发后 `copiedBytes` 需要原子累加，取消要能中断在途任务而不只是不再发新任务。
 - **错误传播**：一个文件失败后，其余在途任务需要等待结束再抛错，否则上层会在清理时遇到仍在写入的目标（现有串行实现有同样的顾虑，`FileCopier` 里已有先例可循）。
 
+strictData 普通小文件的局部并发已由[有界小文件复制](../../implemented/architecture/2026-10-24-small-file-copy-batches.md)实现；本提案的应用包、大文件和跨目录调度仍未启用。
+
 ## Alternatives considered
 
 - **换成 `copyfile(COPYFILE_RECURSIVE)`**：实测仅 1.6 倍，且静默丢硬链接，见 Problem。
```

**File**: `AppPorts/Models/DataTransferProgress.swift` (modified, +76/-2)
```diff
@@ -89,6 +89,30 @@ final class DataTransferProgress: @unchecked Sendable {
             (Double(unitIndex) + unitFraction) / Double(max(1, unitCount))
         }
         var hasStartedCopy = false
+        var tracksEntrySwitchBoundaries = false
+        var hasEnteredEntrySwitch = false
+        var hasEnteredCleanup = false
+        /// Low-level mount operations and protective notifications do not mean
+        /// the effective entry is being replaced. Keep their execution stage,
+        /// but present the directory workflow's actual commit boundary.
+        var presentationStage: DataTransferStage {
+            if hasEnteredCleanup { return .cleaning }
+            if hasEnteredEntrySwitch { return .switching }
+            if stage == .switching, tracksEntrySwitchBoundaries {
+                return hasStartedCopy ? .verifying : .preparing
+            }
+            return stage
+        }
+        var directoryStep: Int {
+            switch presentationStage {
+            case .waiting, .preparing, .recovering: return 0
+            case .scanning: return 1
+            case .copying, .synchronizing: return hasStartedCopy ? 2 : 0
+            case .verifying: return hasStartedCopy ? 3 : 0
+            case .switching: return hasStartedCopy || hasEnteredEntrySwitch ? 4 : 0
+            case .cleaning: return hasStartedCopy ? 5 : 0
+            }
+        }
         var startedAt: TimeInterval
         var stageStartedAt: TimeInterval
         var lastActivityAt: TimeInterval
@@ -158,6 +182,9 @@ final class DataTransferProgress: @unchecked Sendable {
                 state.unitIndex = index
                 state.unitFraction = 0
                 state.hasStartedCopy = false
+                state.tracksEntrySwitchBoundaries = false
+                state.hasEnteredEntrySwitch = false
+                state.hasEnteredCleanup = false
             }
         }
     }
@@ -175,6 +202,49 @@ final class DataTransferProgress: @unchecked Sendable {
         if state.hasStartedCopy { state.unitFraction = max(state.unitFraction, verificationStart) }
     }
 
+    /// A resumed durable transaction can already have verified data even though
+    /// this observer never copied it. This changes presentation only.
+    func observeResumedCopy(cleanup: Bool) {
+        lock.lock(); defer { lock.unlock() }
+        state.tracksEntrySwitchBoundaries = true
+        state.hasStartedCopy = true
+        if cleanup { state.hasEnteredCleanup = true }
+        state.unitFraction = max(state.unitFraction, cleanup ? 0.94 : 0.60)
+    }
+
+    /// Declare directory presentation before private preparation mounts. This
+    /// does not reset a predecessor's cleanup or alter execution protection.
+    func observeDirectoryWorkflow() {
+        lock.lock(); defer { lock.unlock() }
+        state.tracksEntrySwitchBoundaries = true
+    }
+
+    /// Presentation only: callers report this after final proof, immediately
+    /// before committing the effective entry. Original critical-section events
+    /// and durable transaction phases retain their existing ordering.
+    func observeEntrySwitch() {
+        lock.lock(); defer { lock.unlock() }
+        state.tracksEntrySwitchBoundaries = true
+        state.hasEnteredEntrySwitch = true
+        state.unitFraction = max(state.unitFraction, 0.88)
+    }
+
+    /// A predecessor may have been cleaned using this same observer and path.
+    /// Reset presentation at a new copy, never at an internal preparation stage.
+    /// App-bundle callers keep their existing switching events as the boundary.
+    func observeNewCopy(tracksEntrySwitchBoundaries: Bool) {
+        lock.lock(); defer { lock.unlock() }
+        state.tracksEntrySwitchBoundaries = tracksEntrySwitchBoundaries
+        state.hasStartedCopy = false
+        state.hasEnteredEntrySwitch = false
+        state.hasEnteredCleanup = false
+        state.unitFraction = 0
+        state.copiedBytes = 0
+        state.totalBytes = 0
+        rateSampleBytes = 0
+        transition(to: .preparing, detail: "", at: clock())
+    }
+
     func begin(_ stage: DataTransferStage, detail: String = "", currentFile: String = "", title: String = "") {
         if stage == .switching || stage == .recovering {
             MigrationExecution.control?.setCriticalSection(true)
@@ -253,8 +323,12 @@ final class DataTransferProgress: @unchecked Sendable {
         case .copying: state.hasStartedCopy = true; floor = 0.20
         case .synchronizing: floor = state.hasStartedCopy ? 0.55 : 0.03
         case .verifying: floor = state.hasStartedCopy ? 0.60 : 0.03
-        case .switching: floor = 0.88
-        case .cleaning: floor = 0.94
+        case .switching:
+            floor = state.hasEnteredEntrySwitch || (!state.tracksEntrySwitchBoundaries && state.hasStartedCopy)
+                ? 0.88 : (state.hasStartedCopy ? state.unitFraction : 0.03)
+        case .cleaning:
+            if state.hasStartedCopy { state.hasEnteredCleanup = true
```

---

### Incident Patch 2: `e9be40a8` (2026-10-23)
**Commit Message**: fix(tests): restore visibility contracts and pre-switch baseline checks

**File**: `.agents/notes/implemented/bug-fix/2026-10-22-locked-structure-shows-actionable-ancestors.md` (modified, +10/-0)
```diff
@@ -29,6 +29,8 @@ if !isMigratable { return showLockedStructure }                              //
 
 - **显示不支持迁移目录**（`showNonMigratableDirectories`）保持“全量放出”的语义，作用在 `DataDirItem.matchesVisibility` 的单条判断上。
 
+明确的路径冲突、策略读取失败和非个人快捷入口的现有软链先保留检查入口，不被“不支持迁移”过滤器隐藏。普通个人目录入口仍隐藏；没有显式故障或可恢复记录、仅大小读取不全的真正锁定目录仍跟随“不支持迁移”开关。显示例外不授予迁移权限。
+
 `matchesVisibility` 因此回到两个参数：它只回答“这一条本身该不该出现”，祖先补充交给树层，避免让单条判断依赖兄弟节点。
 
 表头计数改为按最终渲染的行数统计（`visibleLibraryItemCount`），否则补回的祖先行会让“显示 X / 67”和列表对不上。
@@ -58,3 +60,11 @@ if !isMigratable { return showLockedStructure }                              //
 - 祖先判定按路径前缀在**当前分组内**计算，跨类型分组（例如 Application Support 与 Containers）之间的层级不会被补回。
 - 用户目录快捷入口（Desktop/Downloads 等）即使作为祖先也不会补回，避免把个人目录当成应用数据展示。
 - `visibleTree` 的默认参数由 `true` 改为 `false`，未显式传参的调用方（主要是测试）行为随之收紧。
+
+## 2026-10-23 CI regression verification
+
+GitHub Actions [39878791223 / 120170860283](https://github.com/wzh4869/AppPorts/actions/runs/39878791223/job/120170860283) 的必需回归步骤在 `DataDirPresentationTests` 记录 10 个问题：旧测试把已链接目录也当作应隐藏项，并在启用锁定结构时仍期待祖先消失；同时真正的冲突/读取失败和普通现有软链被过早的不支持迁移判断隐藏。原失败在本机相同源码快照复现后，修复过滤优先级，测试分别断言关闭/开启祖先补回与可检查链接的行为，保留个人快捷入口隐藏和大小排除断言。
+
+定向执行 86 项 XCTest（含还原父路径安全、56 项扫描、目录树与路径策略）和 9 项 Swift Testing，全部通过；日志位于本机 `build/Validation/ci-fix-20261023/targeted.log`。全量业务回归仍由推送后的隔离 CI runner 运行，不在开发机执行真实磁盘集成矩阵。
+
+本轮最终源码另执行 14 项本地化审计全部通过，普通 Release clean build（arm64/x86_64）成功，笔记结构与 diff 检查通过；日志见本机 `build/Validation/ci-fix-20261023/`。
```

**File**: `.agents/notes/implemented/simplification/2026-10-12-apfs-verification-reuse.md` (modified, +8/-0)
```diff
@@ -62,3 +62,11 @@ Status: implemented
 三组的散列读取量均为迁出 6 → 5 倍、迁回 6 → 4 倍；2 GiB 组迁回验证阶段为 5.54 s → 3.63 s，但复制/同步与建卷波动仍影响总耗时。结果证明读取量下降，不支持宣称所有数据集整体更快；2 GiB 组迁出总时间基本持平，迁回约缩短 6.8%。镜像位于内置 SSD，不能外推 30 GB 微信外盘耗时。12 次往返均确认当前内容恢复、旧卷清理和测试镜像卸载。
 
 逐轮阶段数据保存在本机 `build/Validation/lifecycle-benchmark-20261022T223000Z.json` 与 `build/Validation/lifecycle-benchmark-20261022T224844Z.json`（文件名使用 UTC，测试日期为本地 10 月 23 日）；它们是本轮工作区实测，不能归到历史 build 27/30。成功夹具在核对 nonce、目录/镜像身份及已卸载后清理，报告和测试日志保留。
+
+## Interrupted restore regression
+
+2026-10-23 CI 的 `ContainerRestoreParentSafetyTests` 在切换前回调替换父路径后，仍要求事务已有完成 `baseline`。目标验证延迟到切换前后，这一拒绝点只保证准备 `sourceBaseline` 已持久化，不得提前声称副本已验证。回归现在显式要求完成基线为 nil，并使用准备基线独立验证保留的暂存副本；原件身份/内容、挂载记录仍在、事务为 needsRecovery、未调用任何磁盘命令的断言全部保留。测试不修改生产验证时序，也不把准备基线用作删除或切换授权。
+
+原失败本机复现，修复后两项父路径 XCTest 以及相关目录扫描、树、策略与呈现测试共 95 项通过；日志为本机 `build/Validation/ci-fix-20261023/targeted.log`。该补充与上方历史 391 项性能验收属于不同运行，不合并统计。
+
+本轮最终源码另执行 14 项本地化审计全部通过，普通 Release clean build（arm64/x86_64）成功，笔记结构与 diff 检查通过；日志见本机 `build/Validation/ci-fix-20261023/`。
```

**File**: `AppPorts/Models/DataDirItem.swift` (modified, +4/-0)
```diff
@@ -323,6 +323,10 @@ struct DataDirItem: Identifiable, Equatable, Sendable {
     /// `showNonMigratableDirectories` 才是把全部不可迁移目录一并放出的开关。
     func matchesVisibility(showZeroByteDirectories: Bool,
                            showNonMigratableDirectories: Bool = true) -> Bool {
+        // Explicit problems and ordinary existing links need an inspection entry,
+        // even when the directory is not eligible for a new migration.
+        if pathPolicy?.reason == .runtimeConflict || pathPolicy?.reason == .readFailure { return true }
+        if status == DataDirStatus.existingSymlink && !isUserDirectoryLink { return true }
         if isMigrationUnsupported && !showNonMigratableDirectories { return false }
         if needsRecoveryOrAttention || hasMountTransferRecord { return true }
         if isUserDirectoryLink { return false }
```

**File**: `AppPortsTests/ContainerRestoreParentSafetyTests.swift` (modified, +2/-1)
```diff
@@ -41,7 +41,8 @@ final class ContainerRestoreParentSafetyTests: XCTestCase {
         XCTAssertEqual(try DataPathIdentity.capture(retainedSource), originalIdentity)
         try TreeCopySession.verifyUnchanged(at: retainedSource, against: original)
         let stagedCopy = moved.appendingPathComponent(URL(fileURLWithPath: try XCTUnwrap(pending.stagingPath)).lastPathComponent)
-        let copied = try PropertyListDecoder().decode(TreeCopySnapshot.self, from: XCTUnwrap(pending.baseline))
+        XCTAssertNil(pending.baseline, "An interrupted pre-switch check must not claim a verified copy")
+        let copied = try PropertyListDecoder().decode(TreeCopySnapshot.self, from: XCTUnwrap(pending.sourceBaseline))
         try TreeCopySession.verifyCopy(at: stagedCopy, against: copied)
     }
 
```

**File**: `AppPortsTests/DataDirPresentationTests.swift` (modified, +9/-5)
```diff
@@ -5,25 +5,29 @@ import Testing
 struct DataDirPresentationTests {
     private let home = URL(fileURLWithPath: "/fixture/presentation-home")
 
-    @Test("Unsupported directories obey their visibility toggle even with links or read errors")
+    @Test("Unsupported directories hide while inspectable links and requested ancestors remain visible")
     func unsupportedDirectoryVisibility() {
         for status in [DataDirStatus.local, DataDirStatus.existingSymlink, DataDirStatus.linked] {
             var item = DataDirItem(name: "AddressBook", path: home.appendingPathComponent("AddressBook"),
                                    type: .containers, priority: .optional, description: "",
                                    status: status, isMigratable: false)
             item.sizeIsIncomplete = true
-            #expect(!item.matchesVisibility(showZeroByteDirectories: true,
-                                           showNonMigratableDirectories: false))
+            let inspectable = status != DataDirStatus.local
+            #expect(item.matchesVisibility(showZeroByteDirectories: true,
+                                          showNonMigratableDirectories: false) == inspectable)
             #expect(item.matchesVisibility(showZeroByteDirectories: true,
                                           showNonMigratableDirectories: true))
 
             var child = item
             child.path = item.path.appendingPathComponent("Business")
             child.isMigratable = true
             let tree = DataDirTree.visibleTree(from: [item, child], showZeroByteDirectories: true,
-                                              showLockedStructure: true, matchingIDs: [item.id, child.id],
+                                              showLockedStructure: false, matchingIDs: [item.id, child.id],
                                               showNonMigratableDirectories: false)
-            #expect(DataDirTree.rows(in: tree).map(\.id) == [child.id])
+            #expect(DataDirTree.rows(in: tree).map(\.id) == (inspectable ? [item.id, child.id] : [child.id]))
+            let withAncestors = DataDirTree.visibleTree(from: [item, child], showZeroByteDirectories: true,
+                showLockedStructure: true, matchingIDs: [item.id, child.id], showNonMigratableDirectories: false)
+            #expect(DataDirTree.rows(in: withAncestors).map(\.id) == [item.id, child.id])
         }
     }
 
```

---

### Incident Patch 3: `925dee83` (2026-10-23)
**Commit Message**: fix(localization): complete 22-language coverage and sheet layouts

**File**: `.agents/notes/implemented/architecture/2026-10-21-后台迁移任务与异常处理.md` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ APFS 失败弹窗的显式重试携带 `MigrationJob.RetryToken`，继续使用
 
 ## Localization follow-up
 
-维护者于 2026-10-22 选择本次先使用简体中文回退。“处理异常”和历史任务无待处理记录的说明已登记在 `Localizable.xcstrings`，暂以 `shouldTranslate: false` 明确表示不声称完成翻译；待办是补齐 22 种支持语言并移除该字段。现有其他任务中心文案的翻译缺口不在本次扩展范围内。
+2026-10-22 曾以 `shouldTranslate: false` 让“处理异常”和历史任务无待处理记录的说明回退到简体中文，避免声称已完成翻译。该临时状态已于 2026-10-23 结束：两条文案补齐 21 种语言，字段与 TODO 注释一并移除；任务中心其余新增文案同样补齐 22 种语言。覆盖范围、`br` / `zh-martian` 的生成约定与英文占位守卫见[本地化覆盖与英文占位守卫](../testing/2026-10-23-本地化覆盖与英文占位守卫.md)。
 
 ## Verification
 
```

**File**: `.agents/notes/implemented/feature/2026-10-18-ownership-storage-advisory.md` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ AppPorts 之前对普通数据目录与自选文件夹的迁移不检查目标
 
 用户在迁移前就知道目标盘存不住归属，以及哪些做法真的有用；误报范围被限制在确实不保存所有者的文件系统上。代价是多一次 `statfs`（只读、忽略失败）与一条新增用户可见文案；非 APFS 用户会看到一条不阻断的提示，需要在弹窗里多点一次「继续迁移」（自选文件夹汇总提示）。
 
-已知缺口：新文案目前只有简体中文与英文，其余 20 种语言填的是英文原文，属于待补翻译，`LocalizationAuditTests` 只校验存在性与占位符一致，不校验是否为英文占位。存量迁移不做回溯提示；应用本体迁移（stub portal）不写应用数据，因此不在这条提示的范围内。
+提示现已覆盖全部 22 种语言，英文占位由[本地化覆盖与占位守卫](../../implemented/testing/2026-10-23-本地化覆盖与英文占位守卫.md)补齐并审计。存量迁移不做回溯提示；应用本体迁移（stub portal）不写应用数据，因此不在这条提示的范围内。
 
 ## Verification
 
```

**File**: `.agents/notes/implemented/testing/2026-10-23-本地化覆盖与英文占位守卫.md` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+# Agent Note: 22 种语言按简中语义补齐，英文占位不再算完成
+
+Status: implemented
+
+## Problem
+
+字符串目录登记了 22 种语言，但“有值”长期被当成“有翻译”。审计脚本只比较空值、`needs_review` 和英文同值，漏掉了两种真实缺口：
+
+- 169 个 `.localized` / `NSLocalizedString` key 根本没进目录，所有语言都回退到 key 本身（简中）。
+- 日语的 187 条译文直接等于中文 key（`AppLog` 和迁移日志文案）。它们既不是空值，也不等于英文，因此任何“与英文相同”的检查都看不见。
+
+同时，544 个 key 在 17 种普通语言里与英文逐字相同（7775 个语言槽位，`迁移` → `Migrate`），27 个微信账号 key 只有 3 种语言，29 个 Spotlight key 在 19 种语言里是 `needs_review` 的英文原文（551 个槽位），2 条文案靠 `shouldTranslate: false` 顶着。繁中有 206 条从未做完简繁转换。
+
+## Decision
+
+**以简中语义为唯一事实来源，英文只作参考。** 每批译文先按 key、语言、缺陷类型分类，再按批次写入目录；写入时只覆盖确有缺陷的（key, 语言）对，已正确的译文不动。
+
+**目录结构保持原样。** 169 个缺失 key 及渲染时发现的 6 个动态阶段 key 按现有 `extractionState: manual` + 22 个 `localizations` 补齐；两条 `shouldTranslate: false` 在补齐 21 种语言后移除字段与 TODO 注释。
+
+**重复 key 合并，而不是关掉符号生成。** `正在迁移应用` 与既有 `正在迁移应用...` 会被 Xcode 归一到同一个生成符号，构建直接失败。合并为无省略号的 `正在迁移应用`，`ContentView.progressTitle` 同步改用该 key，旧 key 从目录删除。
+
+**`br` 仍是一级无缩写英文盲文。** 现有 1103 条 braille 值已确立约定：逐字母盲文单元、大写符号 `⠠`、数字符号 `⠼`、ASCII 空格分隔、占位符原样保留。新值与修复值由英文按该约定生成，并用既有条目做回归比对（1042 条可比条目中 903 条逐字节一致，其余为历史上漏大写符号、夹中文或拼写错误的条目）。不声称达到标准盲文转写认证。
+
+**`zh-martian` 从既有条目反推替换表再外推。** 简繁混排 + 视觉近似字（应→應、用→詠、的→の、留→畱）是既有风格；替换表取共现频次最高的映射，保证新条目与旧条目同一套写法。
+
+**`zh-Hant` 按台湾用语逐条改写**，不是字形替换：資料、檔案、應用程式、設定、使用者、磁碟、權限、批次。`批量` 在繁中统一为 `批次`。
+
+**英文同值不是错误，但必须有理由。** 品牌（AppPorts、GitHub、App Store）、真实的 `~/Library` 目录名（Caches、Containers、Preferences…）、单位（MB、%@/秒）、纯占位符、语言自称、以及目标语言本来就同形的词（es `Local`、de `Status`、it `Password`）保留英文，其余一律翻译。
+
+**加三条守卫测试，只加严不放宽。** `testTranslationsAreNotEnglishPlaceholders`、`testNonChineseTranslationsDoNotReuseTheSourceKey`、`testLatinLocalesDoNotContainHanCharacters` 用显式白名单约束上面几类例外；白名单按 key 或 `key|locale` 精确到项，新增缺口不会被静默放过。
+
+**语言自称的豁免绑定到具体值。** `日本語`、`日本語 (AI)`、`繁體中文`、`煋仌呅` 在 `en`/`zh-Hans`/`zh-Hant`/`ja`/`ko`/`zh-martian` 的部分语言里必须保持原名，因此豁免写成 `key → locale → 期望值` 的三元组（`protectedSelfNames`），而不是 key 级白名单；`testLanguageSelfNamesKeepTheirNativeSpelling` 再正向断言这些值未被改写。改名、翻译或换成别的文字都会失败，而不会因为“在豁免名单里”被放过。
+
+**按实际界面截断调整文案，而不是先改布局。** 德语、波兰语、俄语、法语的底栏按钮与搜索框占位在 900pt 宽窗口里被截断；只在确有截断处缩短译文（`Zurück nach lokal verschieben` → `Nach lokal verschieben`，`Przenieś z powrotem na dysk lokalny` → `Przenieś na dysk lokalny` 等），并给两个底栏按钮加 `lineLimit(1) + minimumScaleFactor(0.85)` 作为其他语言的余量。阿拉伯语「链接回本地」原文 `الرابط العودة إلى المحلي` 是名词堆叠的错误阿拉伯语，改为 `ربط مرة أخرى بالمحلي`。
+
+## Render acceptance and isolation
+
+任务列表、任务行和详情接受显式的 `MigrationTaskCenter`，默认仍使用共享实例。离屏渲染测试注入临时历史记录与合成任务，不提交操作、不实例化迁移服务。密码框的确认回调和数据清理操作回调一旦被调用即令测试失败；审计与本轮渲染结束后恢复原语言偏好，包括原先未持久化该键的情况。
+
+五种语言（简中、英文、德语、波兰语、阿拉伯语）各渲染明暗两套任务列表、任务详情、数据异常处理、创建密码和解锁密码，共 50 张。真实截图暴露的截断通过两行任务/清理操作与允许密码说明、钥匙串标签纵向展开修复；清理的条件、确认和回调不变。阶段名“准备/扫描/复制/校验/切换/收尾”补齐 22 种语言。任务行时间和完整日期提示显式使用环境 locale，阿拉伯语截图覆盖真实 RTL 排布。
+
+## Alternatives considered
+
+**只补主语言，其余标记 `needs_review`。** 最快，但 `needs_review` 对用户没有意义，且下一次审计仍会把它当成待办；问题只是被推迟。
+
+**继续用 `shouldTranslate: false` 顶住缺翻译的条目。** 这会让审计通过而界面显示中文，等于把缺口藏进配置。已删除这两条文案的临时字段；语言自称例外另外绑定具体语言和预期值。
+
+**手写盲文。** 盲文是编码而非语言，手写 1500 条既慢又难以复核；机械生成能用既有条目做逐字节回归，反而更容易证明一致性。
+
+**为重复 key 关闭 Swift 符号生成。** 会削弱整个项目的编译期 key 校验，代价远大于合并一个重复 key。
+
+**把英文同值全部重译（含品牌与目录名）。** 会把 `~/Library/Caches` 译成 `缓存`，用户反而找不到对应目录。
+
+## Consequences
+
+- 目录从 1342 条增至 1516 条，新增 175 条并合并 1 条重复 key；全部 33,352 个语言槽位有译文。渲染验收发现的六个阶段名原先经变量调用 `.localized`，没有被字面量审计发现；现在在阶段声明处显式本地化，既有缺 key 审计可以直接覆盖。
+- 白名单是这套守卫的维护成本：新增品牌、目录名或同形词时要同步加一行，否则测试会失败。这是有意的——失败提示比静默漏译便宜。
+- `br` 与 `zh-martian` 是工程近似：前者是与现状一致的英文盲文，不是经过认证的转写；后者是替换表产物，与人工撰写的措辞不完全相同。
+- 德语正式体（Sie）只在新译文里统一；历史条目仍有 du/Sie 混用，属于既有状态，未在本次批量改写。
+- 为放进 900pt 窗口，德语、波兰语、俄语、法语的 4 处底栏/搜索框文案被改短（如 `Przenieś z powrotem na dysk lokalny` → `Przenieś na dysk lokalny`）。这些译文比直译少一层修饰，但动作与方向未变；若后续加宽布局，可以再改回完整说法。
+- 盲文与火星文对语言自称（日本語、繁體中文、煋仌呅）改用英文名转写（Japanese / Traditional Chinese / Martian Chinese），因为这三条的英文值本身是汉字，无法直接转盲文。
+
+## Verification
+
+2026-10-23，Xcode 27.0（27A266a），实际执行 `LocalizationAuditTests` 全部 14 项和 `MigrationSafetyRenderTests/testRenderLocalizationSheets` 1 项：15 项通过、0 失败、0 跳过。不是 Python 对 XCTest 的替代执行。
+
+最初在工作区启动测试时，字节格式化测试已通过，随后文件枚举停在文稿目录的 `open`；进程采样定位到 `swiftSourceFiles(in:)`，不再笼统归因为宿主未连接或宏插件问题。测试使用复制到 `/tmp/AppPortsLocalizationFinishSource` 的源码快照重新构建运行，避免测试宿主需要文稿目录权限，不修改系统授权。219 个 Swift/catalog 文件经 SHA-256 与最终工作区逐项一致。当前环境普通编译成功，不需要 `OTHER_SWIFT_FLAGS=-disable-sandbox`。
+
+| 指标 | 原始基线 | 最终 |
+|---|---|---|
+| key 总数 | 1342 | 1516 |
+| 已登记可翻译 key 缺失语言槽位（不含暂不翻译的两条） | 513 | 0 |
+| `needs_review` 槽位 / key / 涉及语言 | 551 / 29 / 19 | 0 / 0 / 0 |
+| 临时 `shouldTranslate: false` 条目 | 2 | 0 |
+| 22 语言槽位 | — | 33,352，全部 translated、非空 |
+| 占位符不一致 / stale / 字面量引用缺 key | 0 / 0 / 169 key | 0 / 0 / 0 |
+
+修复前后的真实 SwiftUI 截图验证德语任务底栏与保留副本操作不再截断，英文/德语/波兰语/阿拉伯语密码说明和钥匙串标签完整展开，波兰语进度阶段不再回退到中文，阿拉伯语时间采用所选 locale。截图使用合成记录，只验证呈现，不证明真实磁盘迁移、密钥保存或故障恢复业务。
+
+验证日志、50 张最终截图和源码哈希清单位于 `build/Validation/localization-finish-20261023/`（本地忽略产物）；测试结果包位于 `/tmp/AppPortsLocalizationFinish-Final.xcresult`。真实工作区 Release `xcodebuild clean build` 成功，产物包含 arm64 与 x86_64 及 22 种语言资源；笔记树、格式、归档检查和 `git diff --check` 全部通过。命令及日志详见该目录的 `REPORT.md`。
```

**File**: `AppPorts/ContentView.swift` (modified, +5/-1)
```diff
@@ -257,7 +257,7 @@ struct ContentView: View {
     
     // 进度弹窗状态
     @State private var showProgress = false
-    @State private var progressTitle = "正在迁移应用...".localized
+    @State private var progressTitle = "正在迁移应用".localized
     @State private var progressCurrent = 0
     @State private var progressTotal = 0
     @State private var progressAppName = ""
@@ -1174,6 +1174,8 @@ struct ContentView: View {
                         Text(getLinkButtonTitle())
                             .fontWeight(.medium)
                             .font(.system(size: 13))
+                            .lineLimit(1)
+                            .minimumScaleFactor(0.85)
                     }
                     .frame(maxWidth: .infinity)
                     .frame(height: 28)
@@ -1189,6 +1191,8 @@ struct ContentView: View {
                         Text(getMoveBackButtonTitle())
                             .fontWeight(.medium)
                             .font(.system(size: 13))
+                            .lineLimit(1)
+                            .minimumScaleFactor(0.85)
                     }
                     .frame(maxWidth: .infinity)
                     .frame(height: 28)
```

**File**: `AppPorts/Views/Components/APFSVolumePasswordSheet.swift` (modified, +5/-1)
```diff
@@ -19,12 +19,16 @@ struct APFSVolumePasswordSheet: View {
                  ? "新数据卷独立加密，不会继承外置盘密码。微信拆分迁移的多个数据卷共用本次设置。".localized
                  : "输入迁移时设置的数据卷密码。30 分钟内可复用，正在执行的操作会保持到结束。".localized)
                 .font(.callout).foregroundStyle(.secondary)
+                .fixedSize(horizontal: false, vertical: true)
             SecureField("密码".localized, text: $passphrase)
                 .focused($passwordFocused)
             if isCreating {
                 SecureField("确认密码".localized, text: $confirmation)
             }
-            Toggle("保存到本机钥匙串，连接外置盘后自动解锁".localized, isOn: $saveToKeychain)
+            Toggle(isOn: $saveToKeychain) {
+                Text("保存到本机钥匙串，连接外置盘后自动解锁".localized)
+                    .fixedSize(horizontal: false, vertical: true)
+            }
             if isCreating && !saveToKeychain {
                 Text("请妥善保存密码，遗忘后无法恢复这些数据。".localized)
                     .font(.caption).foregroundStyle(.secondary)
```

**File**: `AppPorts/Views/Components/MigrationTaskViews.swift` (modified, +30/-17)
```diff
@@ -2,10 +2,10 @@ import SwiftUI
 
 struct MigrationOverallProgress: View {
     let fraction: Double
-    private let stages: [(String, Double)] = [
-        ("准备", 0), ("扫描", 0.05), ("复制", 0.20),
-        ("校验", 0.60), ("切换", 0.88), ("收尾", 0.94)
-    ]
+    private var stages: [(String, Double)] {
+        [("准备".localized, 0), ("扫描".localized, 0.05), ("复制".localized, 0.20),
+         ("校验".localized, 0.60), ("切换".localized, 0.88), ("收尾".localized, 0.94)]
+    }
 
     var body: some View {
         VStack(spacing: 5) {
@@ -22,7 +22,7 @@ struct MigrationOverallProgress: View {
             HStack {
                 ForEach(stages.indices, id: \.self) { index in
                     if index > 0 { Spacer(minLength: 4) }
-                    Text(stages[index].0.localized)
+                    Text(stages[index].0)
                         .foregroundStyle(fraction >= stages[index].1 ? .primary : .secondary)
                 }
             }
@@ -96,10 +96,14 @@ private struct MigrationTaskListHeightKey: PreferenceKey {
 @MainActor
 struct MigrationTaskList: View {
     @Environment(\.colorScheme) private var colorScheme
-    @ObservedObject private var center = MigrationTaskCenter.shared
+    @ObservedObject private var center: MigrationTaskCenter
     @State private var selection: Set<UUID> = []
     @State private var contentHeight: CGFloat = 90
 
+    init(center: MigrationTaskCenter? = nil) {
+        self.center = center ?? .shared
+    }
+
     var body: some View {
         VStack(spacing: 0) {
             HStack {
@@ -122,7 +126,7 @@ struct MigrationTaskList: View {
                 ScrollView {
                     VStack(spacing: 6) {
                         ForEach(Array(center.jobs.reversed())) { job in
-                            MigrationTaskRow(job: job, selected: Binding(
+                            MigrationTaskRow(job: job, center: center, selected: Binding(
                                 get: { selection.contains(job.id) },
                                 set: { value in
                                     if value { selection.insert(job.id) } else { selection.remove(job.id) }
@@ -138,17 +142,20 @@ struct MigrationTaskList: View {
                 .onPreferenceChange(MigrationTaskListHeightKey.self) { contentHeight = $0 }
             }
             Divider()
-            HStack(spacing: 8) {
-                Group {
+            VStack(alignment: .leading, spacing: 8) {
+                HStack(spacing: 8) {
                     Button("暂停".localized) { center.pause(selection) }
                     Button("继续".localized) { center.resume(selection) }
                     Button("取消任务".localized) { center.cancel(selection) }
+                    Spacer(minLength: 0)
                 }
                 .disabled(selection.isEmpty)
-                Spacer()
-                Button("清空已完成".localized) { center.clearCompleted() }
-                    .disabled(!center.jobs.contains { $0.status == .completed })
-                    .help("只清空已完成的任务记录，不删除文件".localized)
+                HStack {
+                    Spacer(minLength: 0)
+                    Button("清空已完成".localized) { center.clearCompleted() }
+                        .disabled(!center.jobs.contains { $0.status == .completed })
+                        .help("只清空已完成的任务记录，不删除文件".localized)
+                }
             }
             .padding(10)
         }
@@ -163,8 +170,9 @@ struct MigrationTaskList: View {
 
 @MainActor
 private struct MigrationTaskRow: View {
+    @Environment(\.locale) private var locale
     @ObservedObject var job: MigrationJob
-    @ObservedObject private var center = MigrationTaskCenter.shared
+    @ObservedObject var center: MigrationTaskCenter
     @Binding var selected: Bool
 
     private var appIconURL: URL? {
@@ -231,8 +239,8 @@ private struct MigrationTaskRow: View {
                     }
                     HStack {
                         if let startedAt = job.startedAt {
-                            Text("开始".localized + "：" + startedAt.formatted(.dateTime.hour().minute().second()))
-                                .help(startedAt.formatted(date: .numeric, time: .standard))
+                            Text("开始".localized + "：" + startedAt.formatted(.dateTime.hour().minute().second().locale(locale)))
+                                .help(startedAt.formatted(Date.FormatStyle(date: .numeric, time: .standard).locale(locale)))
                         } else {
                             Text("尚未开始".localized)
                         }
@@ -291,7 +299,12 @@ struct MigrationTaskDetail: View {
     @State private var showsDataRecovery = false
     @Environment(\.colorScheme) private var colorScheme
     @ObservedObject var job: MigrationJob
-    @ObservedObject private var center = MigrationTaskCenter.shared
+    @ObservedObject private var center: MigrationTaskCenter
+
+    init(job: MigrationJob, center: MigrationTaskCenter? = nil) {
+        self.job = job
+        self.center = cent
```

**File**: `AppPorts/Views/DataCleanupResolutionSheet.swift` (modified, +13/-9)
```diff
@@ -85,18 +85,22 @@ struct DataCleanupResolutionSheet: View {
             if let path = transfer.backupPath {
                 Text(verbatim: path).font(.caption).foregroundStyle(.secondary).textSelection(.enabled)
             }
-            HStack {
-                Button(disposition == .keep ? "重新尝试清理".localized : "重试".localized) {
-                    dismiss(); onRetry(transfer.id)
+            VStack(alignment: .leading, spacing: 8) {
+                HStack {
+                    Button(disposition == .keep ? "重新尝试清理".localized : "重试".localized) {
+                        dismiss(); onRetry(transfer.id)
+                    }
+                    if transfer.isDataSwitchComplete {
+                        Button("打开旧副本".localized) { openRetained(transfer) }
+                    }
                 }
-                if transfer.isDataSwitchComplete {
-                    Button("打开旧副本".localized) { openRetained(transfer) }
-                    if disposition != .keep {
+                HStack {
+                    if transfer.isDataSwitchComplete, disposition != .keep {
                         Button("保留副本并结束清理".localized) { keepRequest = transfer; confirmKeep = true }
                     }
-                }
-                if disposition == nil {
-                    Button("稍后处理".localized) { decide(.deferred, for: transfer) }
+                    if disposition == nil {
+                        Button("稍后处理".localized) { decide(.deferred, for: transfer) }
+                    }
                 }
             }
             .controlSize(.small)
```

**File**: `AppPortsTests/LocalizationAuditTests.swift` (modified, +225/-1)
```diff
@@ -12,9 +12,23 @@ final class LocalizationAuditTests: XCTestCase {
         let key: String
     }
 
+    private var originalLanguage = "system"
+    private var originalLanguagePreference: Any?
+
+    override func setUp() {
+        super.setUp()
+        originalLanguage = LanguageManager.shared.language
+        originalLanguagePreference = UserDefaults.standard.object(forKey: "selectedLanguage")
+    }
+
     override func tearDown() {
+        LanguageManager.shared.language = originalLanguage
+        if let originalLanguagePreference {
+            UserDefaults.standard.set(originalLanguagePreference, forKey: "selectedLanguage")
+        } else {
+            UserDefaults.standard.removeObject(forKey: "selectedLanguage")
+        }
         super.tearDown()
-        LanguageManager.shared.language = "system"
     }
 
     func testSupportedLanguageCodesAreUnique() {
@@ -301,6 +315,205 @@ final class LocalizationAuditTests: XCTestCase {
         )
     }
 
+    /// Keys whose text is deliberately identical in every language: brand names,
+    /// real `~/Library` folder names that users must recognise on disk, size units,
+    /// and strings that consist only of placeholders or punctuation.
+    private let identicalInEveryLanguage: Set<String> = [
+        "%lld",
+        "1 MB", "2 MB", "5 MB", "10 MB", "50 MB", "100 MB",
+        "App Store", "AppPorts", "GitHub", "Mac", "WebKit",
+        "Application Scripts", "Application Support", "Caches", "Containers",
+        "Group Containers", "HTTPStorages", "Logs", "Preferences", "Saved State",
+        ", ", ", %@",
+    ]
+
+    /// Native cognates: the target language spells this word exactly like English,
+    /// so an identical value is correct rather than a missing translation.
+    private let allowedEnglishLookalikes: Set<String> = [
+        "%@ (%lld 个应用)|de",
+        "%@/秒|es", "%@/秒|fr", "%@/秒|pt", "%@/秒|it", "%@/秒|de",
+        "%@/秒|nl", "%@/秒|pl", "%@/秒|eo",
+        "Auto|fr",
+        "Version %@|fr", "Version %@|de",
+        "• 资源叉|nl",
+        "以后再说|nl", "稍后|nl", "更新|nl", "项目|nl",
+        "可选|de", "名称|de", "应用|de", "应用|nl", "应用: %@|de", "应用: %@|nl",
+        "状态|de", "状态|nl", "状态|id",
+        "筛选|de", "筛选|nl", "筛选|id",
+        "系统|de", "系统|pl", "日志|pt", "日志|nl",
+        "否|es", "否|it", "错误|es", "密码|it",
+        "好|ja", "好的|ja",
+        "操作|fr", "注意|fr", "用户文档|fr",
+        "本地|es", "本地|fr", "本地|pt",
+    ]
+
+    /// Language self-names the picker must always show in their own script, keyed by
+    /// catalog key, then by the locale that has to keep that exact spelling.
+    ///
+    /// These entries are the only place where a value may equal both the English value
+    /// and the Chinese key. The exemption is bound to the expected string: if one of
+    /// them is reworded, translated, or replaces the name with another script, the two
+    /// placeholder guards no longer recognise it, and
+    /// `testLanguageSelfNamesKeepTheirNativeSpelling` fails directly.
+    private let protectedSelfNames: [String: [String: String]] = [
+        "日本語": [
+            "en": "日本語", "zh-Hans": "日本語", "zh-Hant": "日本語", "ja": "日本語",
+        ],
+        "日本語 (AI)": [
+            "en": "日本語 (AI)", "zh-Hans": "日本語 (AI)", "zh-Hant": "日本語 (AI)", "ja": "日本語 (AI)",
+        ],
+        "繁體中文": [
+            "en": "繁體中文", "zh-Hans": "繁體中文", "zh-Hant": "繁體中文",
+            "ja": "繁體中文", "ko": "繁體中文",
+        ],
+        "煋仌呅": [
+            "en": "煋仌呅", "zh-Hans": "煋仌呅", "zh-Hant": "煋仌呅", "zh-martian": "煋仌呅",
+        ],
+    ]
+
+    private func protectedSelfName(key: String, locale: String, value: String) -> Bool {
+        protectedSelfNames[key]?[locale] == value
+    }
+
+    /// Guards against regressing to English placeholders. `br` and `zh-martian` are
+    /// excluded: Braille is derived from the English text by design, and Martian
+    /// Chinese shares symbols with English.
+    func testTranslationsAreNotEnglishPlaceholders() throws {
+        let strings = try stringCatalog()
+        let auditedLocales = Set(AppLanguageCatalog.selectableLanguages.map(\.code))
+            .subtracting(["en", "br", "zh-martian"])
+
+        var findings: [String] = []
+
+        for key in strings.keys.sorted() {
+            guard !key.isEmpty,
+                  let entry = strings[key] as? [String: Any],
+                  entry["shouldTranslate"] as? Bool != false,
+                  let localizations = entry["localizations"] as? [String: Any],
+                  let english = localizedStringValue(localizations["en"]),
+                  english.unicodeScalars.contains(where: CharacterSet.letters.contains) else {
+                continue
+            }
+
+            for locale in auditedLocales.sorted() {
+                guard let value = localizedStringValue(localizations[locale]),
+                      value == english else {
+                    continue
+                }
+                if identicalInEveryLanguage.contai
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

## X. migration): 修正进度阶段与重试范围并优化微小文件复制

**RULE**:
When implementing operations in `.agents/notes/implemented/architecture/2026-10-21-后台迁移任务与异常处理.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in wzh4869/AppPorts. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3d0c1d58`: migration): 修正进度阶段与重试范围并优化微小文件复制. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `.agents/notes/implemented/architecture/2026-10-21-后台迁移任务与异常处理.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
总体估算与当前目录阶段的呈现见[进度显示范围](../bug-fix/2026-10-24-migration-progress-scopes.md)，任务合算及持久化完成语义保留。

```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3d0c1d58` are properly handled with clean fallback behavior.
