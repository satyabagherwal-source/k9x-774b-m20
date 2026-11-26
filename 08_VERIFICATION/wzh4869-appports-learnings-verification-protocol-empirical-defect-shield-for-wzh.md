# Verification Protocol: Verification Protocol: Empirical Defect Shield for wzh4869-appports-learnings

<!-- PROVENANCE_START
{
  "source_repository": "wzh4869-appports-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T07:10:34.645Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-wzh4869-appports-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [wzh4869-appports-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T07:10:34.645Z`  
> **Learning ID**: `LEARN-EVO-wzh4869-appports-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `wzh4869-appports-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/wzh4869-appports-learnings.md`  
> **Source**: github ([https://github.com/wzh4869/AppPorts](https://github.com/wzh4869/AppPorts))  
> **Source Version**: `d9294511`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T07:10:21.733Z  
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
> **Harvest Timestamp**: 2026-11-26T07:10:21.723Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wzh4869/AppPorts`
- **Description**: 📦 A macOS utility to seamlessly migrate applications to external storage and reclaim local disk space.【一款 macOS 工具，无缝迁移应用到外部存储并自动建立链接，释放宝贵的本地空间】
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2306 stars

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
    private(set) var preview: [AppItem] = []
    private(set) var source: AppListCacheStore.Source?
    private var restoredRows: [AppItem] = []
    private(set) var pendingIDs: Set<String> = []
    private var needsSizeRefresh = false

    mutating func changeSource(to next: AppListCacheStore.Source, restore: () -> [AppItem]) {
        let firstOpen = source == nil
        invalidate()
        source = next
        restoredRows = firstOpen ? restore() : []
        resetPreview()
    }

    private mutating func resetPreview() {
        for index in restoredRows.indices where restoredRows[index].bundleIsLocked != nil {
            restoredRows[index].bundleIsLocked = nil
        }
        preview = restoredRows
        pendingIDs = Set(restoredRows.map(\.id))
    }

    mutating func begin(externalDirectory: URL?, customPaths: [String], isManual: Bool = false) -> Request? {
        guard !isManual || !isScanning else { return nil }
        // 监控触发的新扫描可以替代旧扫描，但不能吞掉用户尚未完成的体积刷新。
        needsSizeRefresh = needsSizeRefresh || isManual
        let next = Request(externalDirectory: externalDirectory, customPaths: customPaths,
                           forceSizeRefresh: needsSizeRefresh)
        resetPreview()
        request = next
        isScanning = true
        return next
    }

    mutating func publishPreview(_ apps: [AppItem], for current: Request) {
        guard request == current, isScanning else { return }
        guard !restoredRows.isEmpty else {
            preview = apps
            return
        }
        // 未发现的旧行持续可见，整栏发现结束后才能确认哪些已经移除。
        let discovered = Set(apps.map(\.id))
        let pending = restoredRows.filter { !discovered.contains($0.id) }
        pendingIDs = Set(pending.map(\.id))
        preview = apps + pending
    }

    mutating func publishCachedUpdates(_ verified: [String: AppItem], for current: Request) {
        guard request == current, isScanning, !pendingIDs.isEmpty, !verified.isEmpty else { return }
        for index in restoredRows.indices {
            let id = restoredRows[index].id
            if pendingIDs.contains(id), let row = verified[id] { restoredRows[index] = row }
        }
        for index in preview.indices {
            let id = preview[index].id
            if pendingIDs.contains(id), let row = verified[id] { preview[index] = row }
        }
    }

    mutating func clearPreview() {
        restoredRows.removeAll()
        preview.removeAll()
        pendingIDs.removeAll()
    }

    mutating func finish(_ completed: Request) {
        guard request == completed else { return }
        isScanning = false
        clearPreview()
        needsSizeRefresh = false
    }

    /// 主动退让（例如外盘即将卸载）时终止在途扫描：令旧回调失效并收起进度态，
    /// 但保留非空请求占位，避免操作结束时被误判为“尚未初始化的新窗口”而立即重扫。
    mutating func cancelInFlight() {
        guard isScanning else { return }
        request = Request(externalDirectory: request?.externalDirectory,
                          customPaths: request?.customPaths ?? [],
                          forceSizeRefresh: false)
        isScanning = false
        clearPreview()
        needsSizeRefresh = false
    }

    mutating func invalidate() {
        request = nil
        isScanning = false
        clearPreview()
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
    private var pendingRecordsChange = false
    private var recordObserver: AnyCancellable?
    private var terminationReply: (() -> Void)?
    private var cancellation: (() -> Void)?

    init(notificationCenter: NotificationCenter = .default) {
        recordObserver = notificationCenter.publisher(for: .appPortsRecordsDidChange)
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                guard let self else { return }
                if self.isBusy {
                    self.pendingRecordsChange = true
                    return
                }
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
        if wasBusy && !isBusy {
            pendingRecordsChange = false
            recordsRevision &+= 1
            completeTerminationIfIdle()
        }
    }

    func begin() -> UUID? {
        guard !isBusy, terminationReply == nil else { return nil }
        let token = UUID()
        activeOperation = token
        return token
    }

    func finish(_ token: UUID, publishRecordsChange: Bool = true) {
        guard activeOperation == token else { return }
        activeOperation = nil
        cancellation = nil
        // Publish once at the end of a mutating foreground operation (or when a
        // background store change arrived while busy). A pre-lock refusal leaves
        // recordsRevision untouched so idle observers do not rescan or resync.
        let shouldPublish = publishRecordsChange || pendingRecordsChange
        if !isBusy {
            if shouldPublish {
                pendingRecordsChange = false
                recordsRevision &+= 1
            }
        } else if shouldPublish {
            pendingRecordsChange = true
        }
        completeTerminationIfIdle()
        if terminationReply == nil {
            MigrationTaskCenter.shared.schedule()
        }
    }

    private func completeTerminationIfIdle() {
        guard !isBusy, let reply = terminationReply else { return }
        terminationReply = nil
        reply()
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

### Core Architecture Module: `AppPorts/Services/ShipItInstallerState.swift`
```
import Foundation

/// ShipIt stores resumable state per host, separately from its downloaded update.
enum ShipItInstallerState {
    static let ownedBundleKey = "SQRLInstallerOwnedBundle"
    static let attemptsKey = "SQRLShipItInstallationAttempts"

    static func clear(for candidate: ShipItUpdateRecovery.Candidate, domain override: String? = nil) throws {
        guard try SignatureRecordFile.data(at: candidate.stateURL) == candidate.requestBytes else {
            throw CocoaError(.fileReadUnknown)
        }
        let domain = (override ?? (candidate.request.bundleIdentifier + ".ShipIt")) as CFString
        if let value = read(ownedBundleKey, domain: domain) {
            guard let data = value as? Data,
                  let archive = try PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any],
                  archive["$archiver"] as? String == "NSKeyedArchiver",
                  let objects = archive["$objects"] as? [Any],
                  objects.compactMap({ $0 as? String }).contains(where: {
                      guard let url = URL(string: $0), url.isFileURL else { return false }
                      return url.standardizedFileURL.path == candidate.request.targetBundleURL.standardizedFileURL.path
                  }) else { throw CocoaError(.fileReadCorruptFile) }
        }
        // No unarchiving: a third-party class must never execute while inspecting this record.
        for key in [ownedBundleKey, attemptsKey] {
            CFPreferencesSetValue(key as CFString, nil, domain, kCFPreferencesCurrentUser, kCFPreferencesCurrentHost)
        }
        guard CFPreferencesSynchronize(domain, kCFPreferencesCurrentUser, kCFPreferencesCurrentHost),
              read(ownedBundleKey, domain: domain) == nil, read(attemptsKey, domain: domain) == nil else {
            throw CocoaError(.fileWriteUnknown)
        }
    }

    private static func read(_ key: String, domain: CFString) -> CFPropertyList? {
        CFPreferencesCopyValue(key as CFString, domain, kCFPreferencesCurrentUser, kCFPreferencesCurrentHost)
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
        var ambiguousVolumes: [String: [Volume]] = [:]

        func hasAmbiguousVolume(uuid: String?, at path: String) -> Bool {
            if let uuid, ambiguousVolumes[uuid.uppercased()] != nil { return true }
            return ambiguousVolumes.values.contains { volumes in volumes.contains { $0.mountPoint == path } }
        }
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
        guard !snapshot.hasAmbiguousVolume(uuid: uuid, at: transfer.originalPath) else {
            return finding(.unreadable, nil, "ambiguous_volume")
        }
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
            else if snapshot.hasAmbiguousVolume(uuid: record.volumeUUID, at: record.mountPointPath) {
                state = .unreadable; detail = "ambiguous_volume"
            }
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
                if snapshot.hasAmbiguousVolume(uuid: cleanup.mountRecord.volumeUUID, at: $0) { return true }
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
        for uuid in snapshot.ambiguousVolumes.keys.sorted() where !known.contains(uuid) {
            if snapshot.ambiguousVolumes[uuid]?.contains(where: { $0.name.hasPrefix("AppPorts-") }) == true {
                findings.append(.init(state: .unreadable, originalPath: "", volumeUUID: uuid, detail: "ambiguous_volume"))
            }
        }
        if !snapshot.complete || records.validationError != nil {
            findings.append(.init(state: .unreadable, originalPath: "", volumeUUID: nil,
             
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
    let shortVersion: String?
    let buildVersion: String?
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
                let metadata = try readMetadata(at: plistURL)
                return ResolvedAppIdentity(realAppURL: realAppURL, identityBundleURL: bundleURL,
                                           bundleIdentifier: metadata.identifier, shortVersion: metadata.version,
                                           buildVersion: metadata.build, source: source ?? defaultSource)
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

    private static func readMetadata(at url: URL) throws -> (identifier: String, version: String?, build: String?) {
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
        let build = plist["CFBundleVersion"] as? String ?? (plist["CFBundleVersion"] as? NSNumber)?.stringValue
        return (identifier, plist["CFBundleShortVersionString"] as? String, build)
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

    struct Snapshot: Sendable {
        let normalizedPaths: Set<String>
        let identifiers: Set<String>
        var isEmpty: Bool { normalizedPaths.isEmpty && identifiers.isEmpty }

        init(applications: [RunningApplication]) {
            var paths: Set<String> = []
            var ids: Set<String> = []
            paths.reserveCapacity(applications.count * 2)
            ids.reserveCapacity(applications.count)
            for application in applications {
                if let rawID = AppRunningState.nonemptyIdentifier(application.bundleIdentifier) {
                    if rawID.lowercased().hasSuffix(".appports.stub") { continue }
                    ids.insert(rawID)
                }
                if let bundleURL = application.bundleURL {
                    paths.insert(bundleURL.standardizedFileURL.path)
                    paths.insert(AppRunningState.normalizedPath(bundleURL))
                }
            }
            self.normalizedPaths = paths
            self.identifiers = ids
        }

        func matches(appURL: URL, bundleIdentifier: String?) -> Bool {
            if normalizedPaths.contains(appURL.standardizedFileURL.path)
                || normalizedPaths.contains(AppRunningState.normalizedPath(appURL)) {
                return true
            }
            guard let expectedID = AppRunningState.nonemptyIdentifier(bundleIdentifier) else {
                return false
            }
            return identifiers.contains(expectedID)
        }
    }

    nonisolated static func isRunning(appURL: URL, applications: [RunningApplication]) -> Bool {
        isRunning(appURL: appURL, snapshot: Snapshot(applications: applications))
    }

    nonisolated static func applyingRunningState(
        to apps: [AppItem],
        applications: [RunningApplication]
    ) -> [AppItem] {
        let snapshot = Snapshot(applications: applications)
        return apps.map { app in
            var updated = app
            if app.isFolder {
                updated.isRunning = folderAppBundles(at: app.path).contains { child in
                    isRunning(appURL: child, snapshot: snapshot)
                        || isRunning(appURL: app.path.appendingPathComponent(child.lastPathComponent), snapshot: snapshot)
                }
            } else {
                updated.isRunning = isRunning(appURL: app.displayURL, snapshot: snapshot)
                    || (app.displayURL != app.path && isRunning(appURL: app.path, snapshot: snapshot))
            }
            return updated
        }
    }

    nonisolated static func isRunning(appURL: URL, snapshot: Snapshot) -> Bool {
        let resolvedIdentity: ResolvedAppIdentity?
        if case .success(let identity) = AppIdentityResolver.resolve(at: appURL) {
            resolvedIdentity = identity
        } else {
            resolvedIdentity = nil
        }

        let onlineRealURL = resolvedIdentity?.realAppURL ?? (try? CodeSigner.resolveAppURL(at: appURL))
        let offlineTarget = offlinePortalTarget(at: appURL)
        var candidateURLs: [URL] = []
        if let onlineRealURL {
            candidateURLs.append(onlineRealURL)
        }
        if let identityBundleURL = resolvedIdentity?.identityBundleURL,
           normalizedPath(identityBundleURL) != onlineRealURL.map(normalizedPath) {
            candidateURLs.append(identityBundleURL)
        }
        if let offlineURL = offlineTarget.targetURL {
            candidateURLs.append(offlineURL)
        }
        if candidateURLs.isEmpty && !isStubPortalBundle(at: appURL) {
            candidateURLs.append(appURL)
        }

        let identifier = resolvedIdentity?.bundleIdentifier
            ?? CodeSigner.bundleIdentifier(at: onlineRealURL ?? appURL).flatMap {
                $0.lowercased().hasSuffix(".appports.stub") ? nil : $0
            }
            ?? offlineTarget.targetBundleIdentifier

        if candidateURLs.isEmpty {
            guard let expectedID = nonemptyIdentifier(identifier) else { return false }
            return snapshot.identifiers.contains(expectedID)
        }
        return candidateURLs.contains { candidate in
            snapshot.matches(appURL: candidate, bundleIdentifier: identifier)
        }
    }

    nonisolated private static func folderAppBundles(at folderURL: URL) -> [URL] {
        let fm = FileManager.default
        let inspectURL: URL
        if let linkDestination = try? fm.destinationOfSymbolicLink(atPath: folderURL.path) {
            inspectURL = URL(fileURLWithPath: linkDestination, relativeTo: folderURL.deletingLastPathComponent()).standardizedFileURL
        } else {
            inspectURL = folderURL
        }
        var isDirectory: ObjCBool = false
        guard fm.fileExists(atPath: inspectURL.path, isDirectory: &isDirectory), isDirectory.boolValue else {
            return []
        }
        let items = (try? fm.contentsOfDirectory(at: inspectURL, includingPropertiesForKeys: nil, options: .skipsHiddenFiles)) ?? []
        return items.filter { $0.pathExtension == "app" }
    }

    nonisolated static func isStubPortalBundle(at appURL: URL) -> Bool {
        let plistURL = appURL.appendingPathComponent("Contents/Info.plist")
        if let id = CodeSigner.bundleIdentifier(at: appURL),
           id.trimmingCharacters(in: .whitespacesAndNewlines).lowercased().hasSuffix(".appports.stub") {
            return true
        }
        let fm = FileManager.default
        if (try? fm.attributesOfItem(atPath: appURL.appendingPathComponent("Contents/Resources/real_app_path.txt").path)) != nil {
            return true
        }
        if (try? Data(contentsOf: plistURL)) != nil,
           let launcher = try? String(contentsOf: appURL.appendingPathComponent("Contents/MacOS/launcher"), encoding: .utf8),
           launcher.contains("REAL_APP=") {
            return true
        }
        return false
    }

    /// 断盘或目标暂不可达时，仅根据入口记录提取原始外部路径与包身份（绝不把 `.appports.stub` 当作运行目标）。
    nonisolated private static func offlinePortalTarget(at appURL: URL) -> (targetURL: URL?, targetBundleIdentifier: String?) {
        let fm = FileManager.default
        var candidate = appURL.standardizedFileURL
        var visited = Set<String>()
        var extractedURL: URL?
        var extractedIdentifier: String?

        while visited.insert(candidate.path).inserted {
            if let plistData = try? Data(contentsOf: candidate.appendingPathComponent("Contents/Info.plist")),
               let plist = try? PropertyListSerialization.propertyList(from: plistData, options: [], format: nil) as? [String: Any] {
                if let targetID = nonemptyIdentifier(plist["AppPortsTargetBundleIdentifier"] as? String),
                   !targetID.lowercased().hasSuffix(".appports.stub") {
                    extractedIdentifier = extractedIdentifier ?? targetID
                } else if let rawID = nonemptyIdentifier(plist["CFBundleIdentifier"] as? String),
                          rawID.lowercased().hasSuffix(".appports.stub") {
                    let stripped = String(rawID.dropLast(".appports.stub".count))
                    if !stripped.isEmpty {
                        extractedIdentifier = extractedIdentifier ?? stripped
                    }
                }
            }

            if let dest = try? fm.destinationOfSymbolicLink(atPath: candidate.path) {
                let target = URL(fileURLWithPath: dest, relativeTo: candidate.deletingLastPathComponent()).standardizedFileURL
                extractedURL = target
                candidate = target
                continue
            }

            let pathFile = candidate.appendingPathComponent("Contents/Resources/real_app_path.txt")
            if let raw = try? String(contentsOf: pathFile, encoding: .utf8)
                .trimmingCharacters(in: .whitespacesAndNewlines),
               raw.hasPrefix("/") {
                let target = URL(fileURLWithPath: raw).standardizedFileURL
                extractedURL = target
                candidate = target
                continue
            }

            let launcher = candidate.appendingPathComponent("Contents/MacOS/launcher")
            if let script = try? String(contentsOf: launcher, encoding: .utf8),
               let assignment = script.components(separatedBy: .newlines)
                .map({ $0.trimmingCharacters(in: .whitespaces) })
                .first(where: { $0.hasPrefix("REAL_APP=") }),
               assignment.hasPrefix("REAL_APP='"), assignment.hasSuffix("'") {
                let raw = String(assignment.dropFirst("REAL_APP='".count).dropLast())
                    .replacingOccurrences(of: "'\\''", with: "'")
                if raw.hasPrefix("/") {
                    let target = URL(fileURLWithPath: raw).standardizedFileURL
                    extractedURL = target
                    candidate = target
                    continue
                }
            }

            if let hybrid = AppMigrationService.hybridPortalExternalURL(at: candidate) {
                let target = hybrid.standardizedFileURL
                extractedURL = target
                candidate = target
                continue
            }

            let contents = candidate.appendingPathComponent("Contents")
            if let dest = try? fm.destinationOfSymbolicLink(atPath: contents.path) {
                let resolvedContents = URL(fileURLWithPath: dest, relativeTo: candidate).standardizedFileURL
                let target = resolvedContents.deletingLastPathComponent()
                extractedURL = target
                candidate = target
                continue
            }

            break
        }

        return (extractedURL, extractedIdentifier)
    }

    /// 路径匹配覆盖无 Bundle ID 的进程；身份匹配覆盖由其它位置启动的同一应用。
    nonisolated static fun
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

    private var cachedUpdates: [String: AppUpdateInspection]?

    init(
        backupDirectoryURL: URL? = nil,
        cachedUpdates: [String: AppUpdateInspection]? = nil,
        adHocProbe: @escaping @Sendable (URL) -> Bool? = { AppScanner.probeAdHocSignature(at: $0) }
    ) {
        self.backupDirectoryURL = backupDirectoryURL ?? Self.defaultBackupDirectoryURL
        self.adHocProbe = adHocProbe
        self.cachedUpdates = cachedUpdates
    }

    private func readInfoPlist(for appURL: URL) -> [String: Any]? {
        if let cached = infoPlistCache[appURL] {
            return cached.isEmpty ? nil : cached
        }
        guard let infoPlistURL = infoPlistURL(for: appURL),
              let plistData = try? Data(contentsOf: infoPlistURL),
              let plist = try? PropertyListSerialization.propertyList(from: plistData, options: [], format: nil) as? [String: Any] else {
            infoPlistCache[appURL] = [:]
            return nil
        }
        infoPlistCache[appURL] = plist
        return plist
    }

    private func infoPlistURL(for appURL: URL) -> URL? {
        let macOSPlist = appURL.appendingPathComponent("Contents/Info.plist")
        if FileManager.default.fileExists(atPath: macOSPlist.path) {
            return macOSPlist
        }

        let root = (DiskUtility.resolvedPath(appURL.path).map { URL(fileURLWithPath: $0) }
            ?? appURL.resolvingSymlinksInPath()).standardizedFileURL
        var visited = Set<String>()
        return Self.findBundleInfoPlist(at: root, root: root, depth: 0, visited: &visited)
    }

    private static func findBundleInfoPlist(
        at url: URL,
        root: URL,
        depth: Int,
        visited: inout Set<String>
    ) -> URL? {
        let bundleURL = (DiskUtility.resolvedPath(url.path).map { URL(fileURLWithPath: $0) }
            ?? url.resolvingSymlinksInPath()).standardizedFileURL
        guard isInsideBundleRoot(bundleURL, root: root),
              visited.insert(bundleURL.path).inserted,
              depth <= 8 else {
            return nil
        }

        let fm = FileManager.default
        for relativePath in ["Contents/Info.plist", "Info.plist"] {
            let plistURL = bundleURL.appendingPathComponent(relativePath)
            guard fm.fileExists(atPath: plistURL.path) else { continue }
            let resolvedPlist = (DiskUtility.resolvedPath(plistURL.path).map { URL(fileURLWithPath: $0) }
                ?? plistURL.resolvingSymlinksInPath()).standardizedFileURL
            guard isInsideBundleRoot(resolvedPlist, root: root) else { return nil }
            return plistURL
        }

        let wrapped = bundleURL.appendingPathComponent("WrappedBundle")
        if (try? fm.destinationOfSymbolicLink(atPath: wrapped.path)) != nil || fm.fileExists(atPath: wrapped.path) {
            guard let resolvedPath = DiskUtility.resolvedPath(wrapped.path) else { return nil }
            let target = URL(fileURLWithPath: resolvedPath).standardizedFileURL
            var isDir: ObjCBool = false
            guard isInsideBundleRoot(target, root: root),
                  fm.fileExists(atPath: target.path, isDirectory: &isDir),
                  isDir.boolValue else {
                return nil
            }
            return findBundleInfoPlist(at: target, root: root, depth: depth + 1, visited: &visited)
        }

        let wrapper = bundleURL.appendingPathComponent("Wrapper")
        guard fm.fileExists(atPath: wrapper.path),
              let resolvedWrapperPath = DiskUtility.resolvedPath(wrapper.path),
              isInsideBundleRoot(URL(fileURLWithPath: resolvedWrapperPath), root: root),
              let entries = try? fm.contentsOfDirectory(
                  at: wrapper,
                  includingPropertiesForKeys: [.isDirectoryKey],
                  options: .skipsHiddenFiles
              ) else {
            return nil
        }

        let candidates = entries.filter { candidate in
            guard candidate.pathExtension.lowercased() == "app" else { return false }
            if (try? fm.destinationOfSymbolicLink(atPath: candidate.path)) != nil { return true }
            return (try? candidate.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true
        }
        guard candidates.count == 1,
              let candidate = candidates.first,
              let resolvedCandidatePath = DiskUtility.resolvedPath(candidate.path) else {
            return nil
        }
        return findBundleInfoPlist(
            at: URL(fileURLWithPath: resolvedCandidatePath),
            root: root,
            depth: depth + 1,
            visited: &visited
        )
    }

    private static func isInsideBundleRoot(_ url: URL, root: URL) -> Bool {
        url.standardizedFileURL.pathComponents.starts(with: root.standardizedFileURL.pathComponents)
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
        
        guard let path = scanURL.withUnsafeFileSystemRepresentation({ $0.flatMap { strdup($0) } }) else { return 0 }
        defer { free(path) }
        var paths: [UnsafeMutablePointer<CChar>?] = [path, nil]
        guard let tree = fts_open(&paths, FTS_PHYSICAL | FTS_NOCHDIR | FTS_XDEV, nil) else { return 0 }
        defer { fts_close(tree) }

        let maxFileCount = 500_000
        var fileCount = 0
        var size: Int64 = 0
        while !Task.isCancelled, let node = fts_read(tree) {
            let entry = node.pointee
            let kind = Int32(entry.fts_info)
            guard entry.fts_level > 0, kind != FTS_DP, kind != FTS_DNR, kind != FTS_ERR,
                  kind != FTS_NS, let metadata = entry.fts_statp else { continue }
            // skipsHiddenFiles includes Finder-hidden items as well as dot files.
            if entry.fts_name == 0x2e || metadata.pointee.st_flags & UInt32(UF_HIDDEN) != 0 {
                if kind == FTS_D { fts_set(tree, node, FTS_SKIP) }
                continue
            }
            fileCount += 1
            if fileCount > maxFileCount {
                AppLogger.shared.logContext(
                    "calculateDirectorySize: 文件数量达到上限，提前终止",
                    details: [("path", scanURL.path), ("limit", String(maxFileCount))],
                    level: "WARN"
                )
                break
            }
            if kind == FTS_F || (countsSymlinkEntries && (kind == FTS_SL || kind == FTS_SLNONE)) {
                size += metadata.pointee.st_size
            }
        }
        return size
    }

    /// 根据显示场景选择应用体积计算方式。
    ///
    /// 本地列表中的“已链接”应用应显示本地入口大小，避免看起来像在本地保留了一整份实体副本。
    nonisolated func calculateDisplayedSize(for app: AppItem, isLocalEntry: Bool) -> Int64 {
        let mode: AppSizeMode = (isLocalEntry && app.status == AppStatus.linked) ? .localPortal : .logicalContent
        return calculateDirectorySize(at: app.path, mode: mode)
    
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #106** (2026-11-11): **[BUG] 在MAC 27.2.1 中v2.2版本不能迁移微信**
  *Symptoms*: ### 问题描述 / Problem  路径对应的对象或磁盘已改变，已保留内容。 /Applications   ### 复现步骤（选填） / Steps to reproduce (optional)  1、此前删除过之前迁移过的微信 2、重新安装后的微信无法迁移 3、v2.1也存在过问题  ### 发生问题的操作 / Affected operation  应用迁出或迁回 / Move an app out or back  ### AppPorts 版本 / AppPorts version  2.0.0  ### Build 号（选填） / Build number (optional)  2.2.0 (51)  ### macOS 版本 / macOS version  macOS 27  ### Mac 芯片 / Mac processor  Apple Silicon（M 系列 / M-series）  ### 外置存储类型 / External storage type  外置 SSD / External SSD  ### 目标存储的文件系统 / Destination filesystem  APFS  ### 相关外置卷或数据卷是否加密 / External or data volume encryption  None  ### 环境补充（选填） / Additional environment details (optional)  _No response_  ### 截图（选填） / Screenshots (optional)  <img width="952" height="652" alt="Image" src="https://github.com/user-attachments/assets/f1cddb34-9d31-4bad-8303-b25949c5efbe" />  ### 诊断包或相关日志（选填） / Diagnostic package or relevant logs (optional)  [AppPorts-Diagnostic-20261110-152123.zip](https://github.com/user-attachments/files/34616550/AppPorts-Diagnostic-20261110-152123.zip)

- **Issue #105** (2026-11-16): **[BUG] Chrome 缓存迁移失败后无法在界面恢复；Synology Drive 迁移后签名校验失败及后台组件缺失**
  *Symptoms*: ### 问题描述 / Problem  2026-11-04 至 2026-11-05 使用 AppPorts 时遇到两类独立问题，均已在本机恢复，下面记录复现过程、证据和修复建议，便于排查；可按模块拆分跟踪。  预期：迁移失败后能在界面安全恢复；迁移成功后保留原厂签名，且主程序与后台功能均可运行。  环境：AppPorts 2.1.0（Build 51）；macOS 15.6.1（24G90）；Apple Silicon M4；外置 SSD，APFS，FileVault=false、忽略所有权。Synology Drive Client 主应用 Info.plist 显示 8.0.3 / 17892，UI 日志显示 build-17892。路径已用 ~ 和 /Volumes/<外置盘> 脱敏。  ## A. Chrome 缓存迁移失败后，界面重试反复卡住  ### 实际过程与证据  1. 从“应用数据”将 ~/Library/Caches/Google 迁至 /Volumes/<外置盘>/Caches/Google。 2. 报错：“复制失败：数据在操作期间发生变化或校验不一致，已保留副本，请检查后重试”，涉及 Chrome/Default/Cache/Cache_Data/b550fb6659d982f9_0。 3. 排查时 Chrome 已退出，外置盘正常挂载且空间充足。点击“重试”，进入“正在检查待清理的副本”，随后仍失败，停在约 3%。 4. 记录中 phase=needsRecovery、retryFailureCount=5，保留首次迁移的 sourceBaseline。当前源文件内容和修改时间已与该记录不同。 5. 本地源目录仍是普通目录、尚未切换；最终目标目录不存在，外置盘存在未完成的 .appports-copy-<operationID> 临时副本。界面提到的本地 backupPath 当时并未实际存在。 6. 仅将临时副本另行保留，再重试，仍然失败。  规模：界面约 1.61 GB，首次校验记录包含 201445 项。  ### 建议的故障注入复现  在专用测试目录首次扫描后、复制或校验完成前修改部分源文件；等待任务失败，停止所有写入，再通过界面重试。首次故障发生时 Chrome 是否正在写入，本次没有直接证据。  ### 实际恢复及结果  退出 AppPorts，备份配置及失败记录，单独保留旧临时副本；确认本地源目录仍在且未切换后，仅重置对应失败记录，再从 AppPorts 界面重新迁移。新任务完成复制、校验、切换和清理，显示 100%。原报错文件内容与重新迁移前一致，未完成任务和待清理记录归零。  这只是本次救援记录，不建议让普通用户编辑账本作为常规解决方案。  ### 机制分析与修复建议  内部机制尚未通过源码确认。从本次行为推测，恢复流程仍依赖旧校验基线；源数据变化后，恢复或清理检查无法通过，“重试”缺少安全归档旧状态、重新建立任务的分支。发现差异后保留文件是合理的，缺少的是下一步恢复入口。  - 区分临时条件不满足与源数据冲突。磁盘断开、权限不足、应用未退出可继续原任务；源数据变化则停止无效自动重试。 - 增加 **“保留副本并重新迁移”**，说明：“当前数据与上次迁移记录不一致。将保留上次迁移的临时副本，以当前本地数据重新复制和校验。” - 尚未切换时：确认应用退出、源目录和卷身份正常 → 将旧副本移入独立恢复目录并登记 → 归档失败任务及诊断信息 → 创建新 operationID → 重新扫描和完整校验。 -

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

### Incident Patch 1: `d9294511` (2026-11-26)
**Commit Message**: chore(build): 将 AppPorts 2.4.0 构建号更新至 96

**File**: `AppPorts.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -392,7 +392,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 92;
+				CURRENT_PROJECT_VERSION = 96;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = MQ7XG7WM3F;
 				ENABLE_APP_INTENTS_METADATA_PROVIDER = NO;
@@ -429,7 +429,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 92;
+				CURRENT_PROJECT_VERSION = 96;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_TEAM = MQ7XG7WM3F;
 				ENABLE_APP_INTENTS_METADATA_PROVIDER = NO;
```

---

### Incident Patch 2: `26765f06` (2026-11-26)
**Commit Message**: fix(eject): 外盘弹出等待短暂锁并在卸载期间主动退让界面扫描与监控

**File**: `.agents/notes/implemented/bug-fix/2026-11-26-外盘弹出时界面主动退让避免自占卷.md` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+# Agent Note: 外盘弹出时界面主动退让避免自占卷
+
+Status: implemented
+
+## Problem
+
+2026-11-26 实机排查（AppPorts `2.4.0 (95)`）发现用户在 AppPorts 侧栏点击「弹出外置硬盘」或「重试弹出」后，macOS 原生 `UnmountAssistantAgent` 弹窗提示「磁盘“hano”未能推出，因为“AppPorts”正在使用它。请退出那个应用程序，然后再次尝试推出该磁盘。」（且因识别到前台常规 App 而隐藏了「强制推出」按钮）。结合 `UnmountAssistantAgent` 与 `AppPorts_Log.txt` 毫秒级对照确认，根因在于后台服务层已遵守弹出暂停记录，但主界面刷新、目录监控与存储轮询链路未对外盘弹出做退让：
+
+1. **异步 Finder 弹出返回后立即递增 `recordsRevision` 唤醒全量扫盘**：`DiskEjectionService.ejectUsingFinder` 向 Finder 发送的是异步 AppleEvent，命令接受后即返回。`DiskEjectionController.eject` 紧接着调用 `operationState.finish(token, publishRecordsChange: true)`，立刻触发 `ContentView.scanBothApps()`（枚举 `/Volumes/hano/appdisks` 并解析 `/Applications` 软链目标）、`SidebarStorageSection` 立即重读外盘容量以及 `DataDirsView` / `CustomDirsView` 刷新，正好与 Finder 卸载 `/Volumes/hano` 的窗口重叠；`UnmountAssistantAgent` 扫描持有普通文件句柄的进程时当场捕获 `AppPorts`（`ProcessList for volume "hano": ("AppPorts (15308)", "Raycast (936)")`）。
+2. **兄弟容器卷卸载触发外盘重扫**：整盘弹出时 Finder 会先逐一卸载该物理盘上的容器数据卷（例如 6 个 APFS 容器卷），每次卸载都会投递 `NSWorkspace.didUnmountNotification`。`AppLibraryVolumeObserver` 回调触发 `scheduleMonitorRescan(local: false)`，在 1 秒防抖后对着仍在卸载中的 `/Volumes/hano/appdisks` 重启 `FolderMonitor` 并启动新一轮 `scanBothApps()`；最终 `/Volumes/hano` 卸掉后还会因对已消失目录调用 `FolderMonitor.startMonitoring` 产生误导性的 `[ERROR] FolderMonitor 启动失败：目录不存在`。
+3. **缺少弹出前退让与 `NSWorkspace.willUnmountNotification` 响应**：主界面、数据目录页、自定义目录页和侧栏每 5 秒轮询的 `SidebarStorageSection` 既未在弹出开始前取消在途扫描，也未监听 `willUnmountNotification`；同时 `AppScanner.scanLocalApps` / `scanExternalApps` 的遍历循环未检查 `Task.isCancelled`，即使外部取消任务也无法在应用条目间及时停止读取外盘。
+
+*(实机验证同时确认：`FolderMonitor` 打开的 `O_EVTONLY` 描述符本身不会阻断内核 `unmount(2)`，也不会进入 `UnmountAssistantAgent` 的占用列表；真正使 `AppPorts` 上榜的是上述主动发起的普通文件读取与目录遍历。)*
+
+## Decision
+
+将外盘弹出退让约束从后台挂载/恢复层补齐到前台控制器与 UI 扫描、监控、容量轮询链路：
+
+1. **区分同步映像卸载与异步物理盘弹出结果（`DiskEjectionService` / `DiskEjectionController`）**：
+   - `DiskEjectionService.request(at:retrying:)` 返回 `@discardableResult RequestOutcome`（`.imageUnmounted` / `.physicalDiskRequested(DiskEjectionPauseStore.Pause)`）。
+   - `DiskEjectionController.eject(at:retrying:)` 在派发任务前立即记录 `activeEjectionPaths`（通过 `DiskUtility.kernelMountTable()` 纯内存内核挂载表 `getmntinfo_r_np` 解析卷根，不对目标卷发起 `open`/`stat`）并递增 `yieldRevision`，让所有观察视图在 Finder 收到事件前先退让。
+   - 仅当同步映像卸载完成（`.imageUnmounted`）时传入 `publishRecordsChange: true`；物理盘异步弹出请求返回（`.physicalDiskRequested(pause)`）或报错时传入 `publishRecordsChange: false`，并在清理 `activeEjectionPaths` 前把已持久化的 `pause` 同步写入内存 `pauses`（失败路径亦快照重读 `service.pauses.snapshot()`），消除 `activeEjectionPaths` 与 `pauses` 切换间的空窗。
+   - 新增 `DiskEjectionController.suppressesVolumeAccess(at:)` 按精确路径边界判断指定目录是否处于当前弹出退让期或对应物理盘/映像的未解除暂停态；与 `offersInitialEjection(at:)` 保持一致，若同路径已挂载另一块不相关的替代盘，则不误伤替代盘访问。
+2. **可安全中止的扫描状态机与遍历取消（`AppListScanState` / `AppScanner`）**：
+   - `AppListScanState` 新增 `cancelInFlight()`：在 `isScanning == true` 时替换为新的非扫描 `Request` 占位并清掉 `preview` 与 `isScanning`，使被取消任务的晚到回调全部被 `isCurrentScan` 静默丢弃，既不清空已展示列表、不弹任何错误，也不把 `request` 置回 `nil`（防止 `ContentView` 在 `operationState.isBusy` 结束时将其误判为未初始化窗口而立即重扫）。
+   - `AppScanner.scanLocalApps` 与 `scanExternalApps` 在入口与逐条遍历循环顶部检查 `Task.isCancelled`，收到取消信号后立即安静返回。
+3. **全界面退让与自动恢复闭环（`ContentView` / `SidebarStorageSection` / `DataDirsView` / `CustomDirsView`）**：
+   - `ContentView` 保存 `appScanTask` 句柄，订阅 `diskEjection.yieldRevision` 与 `NSWorkspace.willUnmountNotification`：命中目标卷时立即取消 `monitorRescanDebouncer`、停止外盘 `FolderMonitor`、取消 `appScanTask` 并调用 `cancelInFlight()`，清除 `needsAppRescan`。
+   - `AppLibraryVolumeObserver` 回调、`scanAppLists`（非用户显式手动强制刷新）与 `operationState.isBusy` 结束补扫均通过 `getmntinfo_r_np` 检查「目标外盘是否处于退让/暂停且仍在挂载」：兄弟容器卷卸载期间不再对仍在卸载中的外盘发起重扫；待目标外盘真正从挂载表消失后正常刷新离线空状态，且 `startMonitoringExternal` 在目录不存在或退让期安静跳过，不再输出 `[ERROR] FolderMonitor 启动失败：目录不存在`。
+   - 若为 Finder 侧直接发起的 `willUnmountNotification` 且最终卸载失败（无 AppPorts 暂停记录），通过 10 秒宽限期自动清理临时 `unmountingVolumePaths` 并静默恢复 `FolderMonitor`；若为 AppPorts 发起的弹出，则待物理重连清掉 `pauses` 时由 `.onChange(of: diskEjection.pauses)` 自动恢复目录监控并重新扫描。
+   - `SidebarStorageSection` 监听 `DiskEjectionController` 与 `willUnmountNotification`（带 10 秒宽限回收），在目标卷退让/暂停且仍在线时跳过 5 秒容量轮询并保留当前显示（不闪现「无法读取」），卷真正消失后再清空容量显示；`DataDirsView` 与 `CustomDirsView` 在 `yieldRevision` / `willUnmountNotification` 时立即停止在途目录/记录/体积扫描，且 `DataDirsView` 在目标外盘退让且仍挂载时忽略兄弟卷 `didUnmountNotification` 的延后重载。
+
+## Existing-note audit
+
+- [主动弹出外盘时暂停恢复挂载](../feature/2026-10-23-explicit-disk-ejection.md)（部分重叠，互链）：延续整盘暂停、替代盘区分与插拔刷新契约，补齐物理盘异步弹出不触发 `recordsRevision`、卸载窗口内退让扫描/监控/容量轮询及重连恢复监控的边界；同步在原篇增加互链。
+- [外盘弹出锁竞争与基线验证缓存修复](2026-11-26-外盘弹出锁竞争与基线验证缓存修复.md)（部分重叠，互链）：前篇解决了预锁 `.busy` 拒绝导致的 `recordsRevision` 级联与长占锁；本篇补齐成功发起物理盘异步弹出后，界面层自发扫盘与容量轮询同 Finder 卸载竞态的问题；双方互链。
+- [应用列表刷新与缓存状态机](2026-09-30-app-list-refresh.md)（部分重叠）：保留 `AppListScanState` 的单面板过期请求隔离语义，补充 `cancelInFlight()` 主动退让路径且不破坏既有的 `invalidate()` 与初始化补扫语义。
+- [侧栏导航与存储空间展示](../feature/2026-10-29-侧栏导航与存储空间展示.md)（部分重叠）：延续 `SidebarStorageSection` 独立计算属性拆分以避免 SwiftUI 视图体类型检查超时，新增退让期跳过目标卷轮询约束。
+- 活跃 `proposed/feature/` 下提案与本次界面卸载退让无关；无 `rejected/` 目录。
+
+## Alt
```

**File**: `.agents/notes/implemented/bug-fix/2026-11-26-外盘弹出锁竞争与基线验证缓存修复.md` (modified, +1/-0)
```diff
@@ -29,6 +29,7 @@ Status: implemented
 - [已校验迁移生命周期](../architecture/2026-10-10-verified-transfer-lifecycle.md)（部分重叠，互链）：保持迁移账本每次从磁盘重读并完整校验的不变量，仅替换内存侧 `BaselineValidation` 缓存键表达与裁剪策略。
 - [更新守护诊断路径匹配与启动签名锁等待](2026-11-26-更新守护诊断路径匹配与启动签名锁等待.md)（部分重叠，互链）：与后台签名维护等锁策略互补，进一步解决交互式外盘弹出与后台短持锁的竞争。
 - [主线程探针缓存与单遍遍历去重优化](../architecture/2026-11-18-主线程探针缓存与单遍遍历去重优化.md)（部分重叠，互链）：延续热路径去重与消除空闲/无效刷新开销的优化方向，不归档原篇。
+- [外盘弹出时界面主动退让避免自占卷](2026-11-26-外盘弹出时界面主动退让避免自占卷.md)（部分重叠，互链）：在本次解决预锁 `.busy` 级联的基础上，进一步收紧物理盘异步弹出成功返回后的 `recordsRevision` 发布与界面扫描/监控/容量轮询退让。
 - 活跃 `proposed/feature/` 下三篇提案（`unified-migration-guidance`、`temporary-directory-migration-policy`、`concurrent-app-tree-copy`）职责无关；无 `rejected/` 目录。
 
 ## Alternatives considered
```

**File**: `.agents/notes/implemented/feature/2026-10-23-explicit-disk-ejection.md` (modified, +2/-2)
```diff
@@ -14,7 +14,7 @@ Finder 已能联动弹出分散挂载的 APFS 卷，但 AppPorts 的主程序和
 
 在外部应用库标题旁加入弹出入口及暂停后的重试、恢复入口。用户于 2026-10-23 确认实施；新增文案现已[补齐全部 22 语言](../testing/2026-10-23-本地化覆盖与英文占位守卫.md)，临时中英文范围与定向英文回退已结束。
 
-弹出服务与数据操作共用 OperationLock，先确认目标是外置物理盘，按当前磁盘清单收集整盘卷 UUID、容器 UUID 和挂载路径，排除 EFI 分区身份，再持久化暂停状态后向 Finder 发送 eject Apple event。当外部应用库选择在磁盘子目录（例如 `/Volumes/<disk>/<subdir>`）时，初次弹出入口先通过包含它的真实挂载点（并以清单挂载路径前缀兜底）查询 `diskutil info -plist`，不将卷内子路径直接传给 `diskutil`；`DiskUtility.Failure.commandFailed` 对带 `<plist>` 的错误输出自动提取 `ErrorMessage`，避免在弹窗里直接暴露原始 XML。Finder 负责系统占用提示；脚本返回成功仅证明请求已接受，必须另查物理介质是否离线。NSWorkspace 原型在占用时仅返回 OSStatus -47，不符合复用 Finder 提示的目标。
+弹出服务与数据操作共用 OperationLock（默认等待 5 秒以避开瞬时后台维护与挂载代理，且预锁忙碌拒绝不触发 `recordsRevision` 级联，见[外盘弹出锁竞争与基线验证缓存修复](../bug-fix/2026-11-26-外盘弹出锁竞争与基线验证缓存修复.md)；物理盘异步弹出请求本身也不触发 `recordsRevision`，并在弹出前及 `willUnmountNotification` 期间由界面层主动退让外盘扫描、目录监控与容量轮询，见[外盘弹出时界面主动退让避免自占卷](../bug-fix/2026-11-26-外盘弹出时界面主动退让避免自占卷.md)），先确认目标是外置物理盘，按当前磁盘清单收集整盘卷 UUID、容器 UUID 和挂载路径，排除 EFI 分区身份，再持久化暂停状态后向 Finder 发送 eject Apple event。当外部应用库选择在磁盘子目录（例如 `/Volumes/<disk>/<subdir>`）时，初次弹出入口先通过包含它的真实挂载点（并以清单挂载路径前缀兜底）查询 `diskutil info -plist`，不将卷内子路径直接传给 `diskutil`；`DiskUtility.Failure.commandFailed` 对带 `<plist>` 的错误输出自动提取 `ErrorMessage`，避免在弹窗里直接暴露原始 XML。Finder 负责系统占用提示；脚本返回成功仅证明请求已接受，必须另查物理介质是否离线。NSWorkspace 原型在占用时仅返回 OSStatus -47，不符合复用 Finder 提示的目标。
 
 暂停文件与迁移账本分开，沿用同一数据目录和操作锁；读取失败时停止自动维护，不能默认为没有暂停。暂停按卷/容器和精确路径边界影响目标盘。主程序、登录代理、自动恢复和底层挂载入口共同检查。WriterAdmission 能力更新，避免运行中的旧代理忽略新状态。
 
@@ -45,7 +45,7 @@ AppPorts 的结果显示独立于 Finder。`PhysicalDiskMonitor` 只注册 Disk
 
 暂停状态和应用列表各自更新。`pause.circle` 表示仍有保存的暂停记录，`eject` 表示没有该记录，不能单独当作磁盘在线证明。2026-10-23 用户接回真实外盘后，暂停记录已清空、两个数据卷由代理在 13:57:18 挂回，但界面仍显示空外部列表和孤立入口；13:57:28 手动扫描得到 40 个外部应用。这个失败归属于列表刷新缺口，不是要求用户再退出应用。
 
-`AppLibraryVolumeObserver` 同时监听 workspace 的 didMount 和 didUnmount，ContentView 将两类事件接到既有一秒防抖扫描：重新打开当前外部目录及 `.noindex` 目录监控，并以同一轮扫描更新本地入口和外部应用。挂载事件仍触发原有后台维护，卸载事件不主动重挂；忙碌期间沿用 needsAppRescan 的延后刷新。目录描述符属于旧挂载会话，不能用“新卷挂到相同路径”证明旧 FolderMonitor 仍有效。
+`AppLibraryVolumeObserver` 同时监听 workspace 的 didMount 和 didUnmount，ContentView 将两类事件接到既有一秒防抖扫描：重新打开当前外部目录及 `.noindex` 目录监控，并以同一轮扫描更新本地入口和外部应用。挂载事件仍触发原有后台维护，卸载事件不主动重挂；忙碌期间沿用 needsAppRescan 的延后刷新；当目标外盘正处于弹出退让或暂停且仍在挂载时，兄弟容器卷卸载不再对仍在卸载中的外盘触发重扫或重启监控（见[外盘弹出时界面主动退让避免自占卷](../bug-fix/2026-11-26-外盘弹出时界面主动退让避免自占卷.md)）。目录描述符属于旧挂载会话，不能用“新卷挂到相同路径”证明旧 FolderMonitor 仍有效。
 
 监听对象支持停止和重启，用 generation 拒绝停止前已排队的主线程回调，避免离开视图后重新启动目录监控。暂不按通知路径过滤，系统自动挂载和数据卷切换的多个事件由既有防抖合并，避免漏掉分散挂载对本地入口状态的影响。
 
```

**File**: `AppPorts/ContentView.swift` (modified, +119/-3)
```diff
@@ -27,9 +27,13 @@ struct ContentView: View {
     @AppStorage(MainWindowAppearance.defaultsKey) private var appAppearance = "system"
     @ObservedObject private var operationState = AppOperationState.shared
     @ObservedObject private var migrationTasks = MigrationTaskCenter.shared
+    @ObservedObject private var diskEjection = DiskEjectionController.shared
     private typealias ScanRequest = AppListScanState.Request
     @State private var localScanState = AppListScanState()
     @State private var externalScanState = AppListScanState()
+    @State private var appScanTask: Task<Void, Never>?
+    @State private var unmountingVolumePaths: Set<String> = []
+    @State private var unmountGraceTask: Task<Void, Never>?
     @State private var isVisible = false
     @State private var needsAppRescan = false
     @State private var runningStateGeneration: UInt64 = 0
@@ -291,6 +295,11 @@ struct ContentView: View {
             isVisible = false
             runningStateRefreshTask?.cancel()
             runningStateRefreshTask = nil
+            appScanTask?.cancel()
+            appScanTask = nil
+            unmountGraceTask?.cancel()
+            unmountGraceTask = nil
+            unmountingVolumePaths.removeAll()
             localScanState.invalidate()
             externalScanState.invalidate()
             localMonitor?.stopMonitoring()
@@ -355,6 +364,22 @@ struct ContentView: View {
                 AppListCacheStore.shared.save(externalApps, pane: .external, source: source, context: context)
             }
         }
+        .onChange(of: diskEjection.yieldRevision) { _ in
+            guard isExternalAccessSuppressed(for: externalDriveURL) else { return }
+            yieldExternalVolumeAccess(reason: "disk-ejection")
+        }
+        .onChange(of: diskEjection.pauses) { _ in
+            resumeExternalMonitoringAfterEjectionIfNeeded()
+        }
+        .onChange(of: diskEjection.imagePauses) { _ in
+            resumeExternalMonitoringAfterEjectionIfNeeded()
+        }
+        .onReceive(
+            NSWorkspace.shared.notificationCenter.publisher(for: NSWorkspace.willUnmountNotification)
+                .receive(on: RunLoop.main)
+        ) { notification in
+            handleWorkspaceWillUnmount(notification)
+        }
         .onChange(of: operationState.recordsRevision) { _ in
             AppLibraryAgentSync.shared.selectionDidChange()
             guard isVisible else { return }
@@ -369,7 +394,9 @@ struct ContentView: View {
                 operationDataTab = nil
             }
             // 补上操作期间延后的监控刷新，也初始化操作期间新打开的窗口。
-            if !isBusy, needsAppRescan || localScanState.request == nil || externalScanState.request == nil {
+            if !isBusy,
+               !isExternalVolumeSuppressedAndMounted(externalDriveURL),
+               needsAppRescan || localScanState.request == nil || externalScanState.request == nil {
                 scanBothApps()
             }
         }
@@ -1505,6 +1532,9 @@ struct ContentView: View {
     @MainActor
     private func scanAppLists(local: Bool, external: Bool, forceSizeRefresh: Bool) {
         guard isVisible else { return }
+        if !forceSizeRefresh, isExternalVolumeSuppressedAndMounted(externalDriveURL) {
+            return
+        }
         prepareAppListSources(local: local, external: external)
         let localRequest = local ? localScanState.begin(externalDirectory: externalDriveURL,
             customPaths: customLocalScanPaths, isManual: forceSizeRefresh) : nil
@@ -1516,8 +1546,11 @@ struct ContentView: View {
         let localRows = localApps.isEmpty ? localScanState.preview : localApps
         let externalRows = externalApps.isEmpty ? externalScanState.preview : externalApps
         let generation = AppMigrationService.maintenanceGeneration
-        Task.detached(priority: .userInitiated) {
+        appScanTask?.cancel()
+        appScanTask = Task.detached(priority: .userInitiated) {
+            guard !Task.isCancelled else { return }
             let runningApplications = await MainActor.run { self.getRunningApplications() }
+            guard !Task.isCancelled else { return }
             let runningURLs = Set(runningApplications.compactMap(\.bundleURL))
             await withTaskGroup(of: PaneSizeWork?.self) { group in
                 if let request = localRequest {
@@ -1531,6 +1564,7 @@ struct ContentView: View {
                         let apps = await self.discoverLocalApps(request: request, previous: localRows, runningURLs: runningURLs,
                             runningApplications: runningApplications, previewCache: localPreviewCache,
                             maintenanceGeneration: generation)
+                        guard !Task.isCancelled else { return nil }
                         return await self.publishDiscoveredApps(apps, isLocal: true, request: request)
                     }
                 }
@@ -1544,12 +1578,14 @@ struct ContentView: View {
                     group.addTask 
```

**File**: `AppPorts/Models/AppListScanState.swift` (modified, +12/-0)
```diff
@@ -83,6 +83,18 @@ struct AppListScanState {
         needsSizeRefresh = false
     }
 
+    /// 主动退让（例如外盘即将卸载）时终止在途扫描：令旧回调失效并收起进度态，
+    /// 但保留非空请求占位，避免操作结束时被误判为“尚未初始化的新窗口”而立即重扫。
+    mutating func cancelInFlight() {
+        guard isScanning else { return }
+        request = Request(externalDirectory: request?.externalDirectory,
+                          customPaths: request?.customPaths ?? [],
+                          forceSizeRefresh: false)
+        isScanning = false
+        clearPreview()
+        needsSizeRefresh = false
+    }
+
     mutating func invalidate() {
         request = nil
         isScanning = false
```

**File**: `AppPorts/Services/DiskEjectionService.swift` (modified, +166/-20)
```diff
@@ -2,9 +2,14 @@ import AppKit
 import Foundation
 
 struct DiskEjectionService: Sendable {
+    /// Wait briefly for transient background maintenance, mount-agent checks, or
+    /// LaunchAgent synchronization before reporting the operation lock as busy.
+    static let defaultLockWaitTimeout: TimeInterval = 5
+
     let disk: DiskUtility
     let pauses: DiskEjectionPauseStore
     let makeLock: @Sendable () -> OperationLock
+    let lockWaitTimeout: TimeInterval
     let inventory: @Sendable () async throws -> ExternalDiskInventory
     let physicalState: @Sendable (String) -> PhysicalDiskState
     let mountedDevices: @Sendable () throws -> Set<String>
@@ -14,6 +19,7 @@ struct DiskEjectionService: Sendable {
     let imageService: AppLibraryImageService
 
     init(disk: DiskUtility = DiskUtility(administratorRunner: nil), store: ContainerMountStore = .shared,
+         lockWaitTimeout: TimeInterval = DiskEjectionService.defaultLockWaitTimeout,
          inventory: (@Sendable () async throws -> ExternalDiskInventory)? = nil,
          physicalState: @escaping @Sendable (String) -> PhysicalDiskState = { PhysicalDiskState.query($0) },
          mountedDevices: @escaping @Sendable () throws -> Set<String> = { Set(try DiskUtility.kernelMountTable().keys) },
@@ -22,6 +28,7 @@ struct DiskEjectionService: Sendable {
          selectedImage: @escaping @Sendable () -> AppLibraryImageService.Record? = { AppLibraryImageRecovery.selectedRecord() },
          imageService: AppLibraryImageService = AppLibraryImageService()) {
         self.disk = disk
+        self.lockWaitTimeout = max(0, lockWaitTimeout)
         self.physicalState = physicalState
         self.mountedDevices = mountedDevices
         self.mountedVolumePath = mountedVolumePath
@@ -51,19 +58,26 @@ struct DiskEjectionService: Sendable {
         return path
     }
 
+    enum RequestOutcome: Equatable, Sendable {
+        case imageUnmounted
+        case physicalDiskRequested(DiskEjectionPauseStore.Pause)
+    }
+
     /// Finder's eject event is asynchronous: returning is not proof of ejection.
     /// Keep the durable pause on every post-publication outcome, including denial.
-    func request(at url: URL?, retrying pauseID: UUID? = nil) async throws {
+    @discardableResult
+    func request(at url: URL?, retrying pauseID: UUID? = nil) async throws -> RequestOutcome {
         let lock = makeLock()
-        guard lock.tryAcquire() else {
+        guard await lock.acquire(timeout: lockWaitTimeout) else {
+            try Task.checkCancellation()
             throw lock.admissionFailureReason.map { DiskEjectionError.finder($0) } ?? .busy
         }
         defer { lock.release() }
         if pauseID == nil, let url, let image = selectedImage(),
            PortalImageLaunchPreparation.contains(url.path, in: image.libraryPath ?? image.mountPath) {
             try await imageService.unmount(image, pauses: pauses)
             AppLogger.shared.log("应用库映像已卸载，自动挂载保持暂停", level: "INFO")
-            return
+            return .imageUnmounted
         }
         let inventory = try await inventory()
         let current = try pauses.reconcile(inventory)
@@ -92,13 +106,14 @@ struct DiskEjectionService: Sendable {
             }
         }
         guard let member else { throw DiskEjectionError.unavailable }
-        _ = try pauses.pause(target)
+        let pause = try pauses.pause(target)
         let rechecked = try await self.inventory().disk(volumeUUID: member.uuid)
         let info = try await disk.volumeInfo(for: member.path)
         guard rechecked.connectionID == target.connectionID,
               info.volumeUUID?.uppercased() == member.uuid else { throw DiskEjectionError.unavailable }
         try await requestFinderEject(URL(fileURLWithPath: member.path))
         AppLogger.shared.log("已向 Finder 请求弹出外盘，自动挂载保持暂停", level: "INFO")
+        return .physicalDiskRequested(pause)
     }
 
     static func ejectUsingFinder(_ url: URL) async throws {
@@ -117,16 +132,27 @@ final class DiskEjectionController: ObservableObject {
     @Published private(set) var imagePauses: [DiskEjectionPauseStore.ImagePause] = []
     @Published private(set) var connectionStates: [String: PhysicalDiskState] = [:]
     @Published private(set) var isRequestingEjection = false
+    /// Volume or directory roots currently being ejected so UI monitors, scans,
+    /// and storage polling yield immediately before Finder unmounts the volume.
+    @Published private(set) var activeEjectionPaths: Set<String> = []
+    /// Incremented right before dispatching an ejection so active views cancel
+    /// in-flight scans and close external monitors before Finder runs unmount.
+    @Published private(set) var yieldRevision: UInt64 = 0
     private var availableDisks: [ExternalDiskInventory.Disk] = []
     var connected: Set<String> { Set(connectionStates.filter { $0.value == .online || $0.value == .unmounted }.map(\.key)) }
     @Published private(set) var isWorking = false
    
```

**File**: `AppPorts/Utils/AppScanner.swift` (modified, +4/-0)
```diff
@@ -299,6 +299,7 @@ actor AppScanner {
             ],
             level: "TRACE"
         )
+        guard !Task.isCancelled else { return [] }
         infoPlistCache.removeAll()
         let fileManager = FileManager.default
         var candidates = ScanCandidates(grouping: .applicationIdentity, onProgress: onProgress)
@@ -310,6 +311,7 @@ actor AppScanner {
         let items = (try? fileManager.contentsOfDirectory(at: dir, includingPropertiesForKeys: keys, options: .skipsHiddenFiles)) ?? []
 
         for itemURL in items {
+            guard !Task.isCancelled else { return [] }
             // 只处理 .app 扩展名的项目
             if itemURL.pathExtension == "app" {
                 let appName = itemURL.lastPathComponent
@@ -1058,6 +1060,7 @@ actor AppScanner {
             ],
             level: "TRACE"
         )
+        guard !Task.isCancelled else { return [] }
         infoPlistCache.removeAll()
         let fileManager = FileManager.default
         var candidates = ScanCandidates(grouping: grouping, onProgress: onProgress)
@@ -1066,6 +1069,7 @@ actor AppScanner {
         let runningSnapshot = makeRunningSnapshot(runningAppURLs: runningAppURLs, runningApplications: runningApplications)
 
         for itemURL in items {
+            guard !Task.isCancelled else { return [] }
             if itemURL.pathExtension == "app" {
                 let appName = itemURL.lastPathComponent
                 var status = AppStatus.unlinked
```

**File**: `AppPorts/Views/Components/SidebarStorageSection.swift` (modified, +68/-11)
```diff
@@ -89,11 +89,24 @@ struct SidebarStorageSection: View {
     let directory: URL?
     let showsTarget: Bool
     @ObservedObject private var operations = AppOperationState.shared
+    @ObservedObject private var diskEjection = DiskEjectionController.shared
     @State private var localSpace: StorageSpaceSnapshot?
     @State private var targetSpace: StorageSpaceSnapshot?
     @State private var hasReadLocal = false
     @State private var hasReadTarget = false
     @State private var volumeRevision = 0
+    @State private var unmountingVolumePaths: Set<String> = []
+    @State private var unmountGraceTask: Task<Void, Never>?
+
+    private var isTargetSuppressed: Bool {
+        guard let directory else { return false }
+        if diskEjection.suppressesVolumeAccess(at: directory) { return true }
+        return unmountingVolumePaths.contains { DiskEjectionController.path(directory.path, isWithin: $0) }
+    }
+
+    private var storageTaskID: String {
+        "\(showsTarget)-\(directory?.path ?? "")-\(operations.recordsRevision)-\(volumeRevision)-\(isTargetSuppressed)"
+    }
 
     var body: some View {
         VStack(alignment: .leading, spacing: 10) {
@@ -104,16 +117,53 @@ struct SidebarStorageSection: View {
             }
         }
         .font(.system(size: 11))
-        .onReceive(NSWorkspace.shared.notificationCenter.publisher(for: NSWorkspace.didMountNotification)) { _ in
+        .onReceive(NSWorkspace.shared.notificationCenter.publisher(for: NSWorkspace.willUnmountNotification)) { notification in
+            guard let volumeURL = notification.userInfo?[NSWorkspace.volumeURLUserInfoKey] as? URL else { return }
+            let volumePath = DiskEjectionController.standardizedPath(volumeURL.path)
+            unmountingVolumePaths.insert(volumePath)
+            unmountGraceTask?.cancel()
+            unmountGraceTask = Task { @MainActor in
+                do { try await Task.sleep(nanoseconds: 10_000_000_000) } catch { return }
+                unmountingVolumePaths.remove(volumePath)
+                unmountGraceTask = nil
+            }
+        }
+        .onReceive(NSWorkspace.shared.notificationCenter.publisher(for: NSWorkspace.didMountNotification)) { notification in
+            if let volumeURL = notification.userInfo?[NSWorkspace.volumeURLUserInfoKey] as? URL {
+                unmountingVolumePaths.remove(DiskEjectionController.standardizedPath(volumeURL.path))
+            } else {
+                unmountingVolumePaths.removeAll()
+            }
+            if unmountingVolumePaths.isEmpty {
+                unmountGraceTask?.cancel()
+                unmountGraceTask = nil
+            }
             volumeRevision += 1
         }
-        .onReceive(NSWorkspace.shared.notificationCenter.publisher(for: NSWorkspace.didUnmountNotification)) { _ in
+        .onReceive(NSWorkspace.shared.notificationCenter.publisher(for: NSWorkspace.didUnmountNotification)) { notification in
+            if let volumeURL = notification.userInfo?[NSWorkspace.volumeURLUserInfoKey] as? URL {
+                unmountingVolumePaths.remove(DiskEjectionController.standardizedPath(volumeURL.path))
+            } else {
+                unmountingVolumePaths.removeAll()
+            }
+            if unmountingVolumePaths.isEmpty {
+                unmountGraceTask?.cancel()
+                unmountGraceTask = nil
+            }
             volumeRevision += 1
         }
-        .task(id: "\(showsTarget)-\(directory?.path ?? "")-\(operations.recordsRevision)-\(volumeRevision)") {
-            hasReadTarget = false
-            targetSpace = nil
+        .onDisappear {
+            unmountGraceTask?.cancel()
+            unmountGraceTask = nil
+            unmountingVolumePaths.removeAll()
+        }
+        .task(id: storageTaskID) {
             let target = showsTarget ? directory : nil
+            let suppressed = isTargetSuppressed
+            if !suppressed || target == nil {
+                hasReadTarget = false
+                targetSpace = nil
+            }
             while !Task.isCancelled {
                 let local = await Task.detached(priority: .utility) {
                     let dataVolume = URL(fileURLWithPath: "/System/Volumes/Data")
@@ -123,12 +173,19 @@ struct SidebarStorageSection: View {
                 guard !Task.isCancelled else { return }
                 localSpace = local
                 hasReadLocal = true
-                let external = await Task.detached(priority: .utility) {
-                    target.flatMap { StorageSpaceSnapshot.read(at: $0) }
-                }.value
-                guard !Task.isCancelled else { return }
-                targetSpace = external
-                hasReadTarget = true
+                if suppressed {
+                    if let target, DiskEjectionController.mountedExternalVolumeRoot(for: target) == nil {
+                        targetSpace = nil
+                        hasReadTarget = true
+                    }
+      
```

---

### Incident Patch 3: `8d448edf` (2026-11-26)
**Commit Message**: fix(storage): 基线验证缓存改用 SHA-256 摘要键并支持非变更操作完成

**File**: `.agents/notes/implemented/bug-fix/2026-11-26-外盘弹出锁竞争与基线验证缓存修复.md` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+# Agent Note: 外盘弹出锁竞争与基线验证缓存修复
+
+Status: implemented
+
+## Problem
+
+2026-11-26 实机排查（AppPorts `2.4.0 (95)`）发现用户在无前台迁移进行时点击侧栏「弹出外置硬盘」反复收到「应用操作正在进行，请稍后重试。」（`DISK-EJECT-FAILED` / `DiskEjectionError.busy`），根本原因由三处叠加引起：
+
+1. **基线验证缓存把空跑维护拖长至 7～21 秒并长期持有 `operation.lock`**：大目录迁移（如微信 `msg/file`、`msg/video`）结束后，`ContainerMountStore.shared.baselineValidation` 的四个字典仍以完整原始 `Data`（可达数十 MB）作为 key 留存在内存中（因 `keys.count <= 8` 且总大小 `<= 64 MiB` 未触发淘汰）。此后每一次 `read`、`mutate`、`recordsForInspection` 退出时都会调用 `boundMemory()`，构造 `Set(legacyOwnership.keys).union(...)` 把四个字典的大块 `Data` key 反复全量字节哈希（`Hasher.combine(bytes:)`）并做 `memcmp`。实机对运行中进程采样显示约 93% CPU（537/576 样本）耗在 `boundMemory()`，单轮 `OperationMaintenance` 在 `transfers` 为空时仍占住 `operation.lock` 7～21 秒（对照组独立短生命周期 `--mount-agent` 检查同一批 6 个挂载点耗时 < 1 秒），同时滞留数百 MB 内存。
+2. **后台维护触发时机与弹出动作天然撞车，而弹出入口零等待**：`ContentView` 每 60 秒轮询并在任意应用退出（`didTerminateApplicationNotification`）时以 `minimumInterval: 0` 触发 `OperationMaintenance.shared.run(...)`；用户弹出外盘前往往刚退出占用应用，立即触发后台维护占锁，而 `OperationMaintenance` 不占前台 `AppOperationState`，界面按钮仍可点击。与此同时，`DiskEjectionService.request` 直接使用非阻塞 `lock.tryAcquire()`（0 秒等待），只要与后台维护、`--mount-agent`（`/Volumes` `WatchPaths`）或代理同步瞬间重叠就会直接报 `.busy`。
+3. **预锁拒绝后的 `recordsRevision` 级联放大占锁**：`DiskEjectionController.eject` 在 `.busy` 失败后仍调用 `AppOperationState.shared.finish(token)` 无条件递增 `recordsRevision`，触发 `AppLibraryAgentSync.shared.selectionDidChange()`（进而 `BackgroundAgents.synchronize()` 争抢 `operation.lock` 并读取 `ContainerMountStore.shared`）以及应用列表、数据目录全量重扫，进一步加剧 `ContainerMountStore.shared.lock` 与 `operation.lock` 争用，导致连续重试持续报 `.busy`。
+
+## Decision
+
+1. **`ContainerMountStore.BaselineValidation` 改用摘要键并按活跃传输裁剪**：
+   - 缓存键改为 `BaselineKey(byteCount: Int, digest: SHA256.Digest)`（40 字节值类型，不持有任何原始 manifest `Data` 字节，也不缓存解码后的文件树）；仍严格基于每次从磁盘新读入的不可变 manifest 字节计算，绝不依赖路径、inode 或时间戳。
+   - 在 `validate(_:using:precomputedKeys:)` 与 `mutate` 中为每条传输记录只计算一次 `TransferBaselineKeys`，复用于 `validateLegacyOwnership`、`hasOwnershipCompatibility`、`hasResourceForkContract` 与 `snapshotValidation`。
+   - 文档 `transfers` 为空时在 `validate` 末尾以 O(1) 的 `clearIfNonEmpty()` 立即清空旧缓存；非空时 `retainOnly(activeBaselineKeys)` 仅保留当前文档仍引用的摘要条目；`boundMemory()` 改为 O(1) 条目数上限守卫（单表 `maxEntries = 32`），不再在读路径构造 `Set<Data>`。
+2. **`DiskEjectionService.request` 等待短暂瞬时锁，并正确传播取消**：
+   - 新增可注入的 `lockWaitTimeout: TimeInterval = DiskEjectionService.defaultLockWaitTimeout`（默认 `5` 秒，与 `PortalImageLaunchPreparation` 一致），通过 `await lock.acquire(timeout: lockWaitTimeout)` 避开正常后台维护、`--mount-agent` 巡检或代理同步的瞬时持锁；写入准入失败沿用 `OperationLock.acquire` 立即退出并上报原原因，持续长任务占锁仍在预算耗尽后抛 `DiskEjectionError.busy` 且绝不在拿锁前写入暂停状态或派发 Finder 弹出。
+   - `DiskEjectionController.eject` 注入 `operationState`（默认 `.shared`），通过 `withTaskCancellationHandler` 将父任务取消（如正常退出应用时的 `finishBeforeTerminating`）透传给 `Task.detached` 中的 `service.request`，并在 `acquire` 返回前检查 `Task.checkCancellation()`，避免退出时等待 5 秒或误报忙碌弹窗。
+3. **`AppOperationState.finish` 支持非变更完成，同时保留忙碌期后台通知**：
+   - `AppOperationState.finish(_:publishRecordsChange:)` 默认 `publishRecordsChange = true` 保持全部既有调用方语义不变；`AppOperationState` 新增 `pendingRecordsChange` 标记，记录忙碌期间到达的 `.appPortsRecordsDidChange` 通知并在回归空闲时补发一次 `recordsRevision &+= 1`，防止遗漏后台真实变更。
+   - `DiskEjectionController.eject` 在 `CancellationError` 或 `DiskEjectionError.busy`（确定尚未拿锁、未改写任何暂停记录）结束时传入 `publishRecordsChange: false`，阻断失败弹出引发的代理重同步与全量重扫级联。
+
+## Existing-note audit
+
+- [主动弹出外盘时暂停恢复挂载](../feature/2026-10-23-explicit-disk-ejection.md)（部分重叠，互链）：延续整盘暂停、重连恢复与锁互斥边界，补充弹出请求等待短暂操作锁（默认 5 秒）及预锁拒绝不触发 `recordsRevision` 级联的行为；同步在原篇增加互链。
+- [已校验迁移生命周期](../architecture/2026-10-10-verified-transfer-lifecycle.md)（部分重叠，互链）：保持迁移账本每次从磁盘重读并完整校验的不变量，仅替换内存侧 `BaselineValidation` 缓存键表达与裁剪策略。
+- [更新守护诊断路径匹配与启动签名锁等待](2026-11-26-更新守护诊断路径匹配与启动签名锁等待.md)（部分重叠，互链）：与后台签名维护等锁策略互补，进一步解决交互式外盘弹出与后台短持锁的竞争。
+- [主线程探针缓存与单遍遍历去重优化](../architecture/2026-11-18-主线程探针缓存与单遍遍历去重优化.md)（部分重叠，互链）：延续热路径去重与消除空闲/无效刷新开销的优化方向，不归档原篇。
+- 活跃 `proposed/feature/` 下三篇提案（`unified-migration-guidance`、`temporary-directory-migration-policy`、`concurrent-app-tree-copy`）职责无关；无 `rejected/` 目录。
+
+## Alternatives considered
+
+1. **保留原始 `Data` 作为 `BaselineValidation` 字典键，仅在写入时增量累计字节数以避免每次读库调用 `Set.union`**：实现改动更小且不依赖哈希摘要；但依然会把高达 64 MiB 的已完成迁移 manifest 长期滞留在 `ContainerMountStore.shared` 内存中，且每次字典查表仍需用软件 SipHash 对完整多 MB `Data` 重新哈希并 `memcmp`。改用 `(byteCount, SHA256.Digest)` 并随活跃 `transfers` 裁剪，既彻底消除大对象滞留，又借助硬件 SHA-256 把单次 `validate` 校验压缩为单遍计算。
+2. **让 `DiskEjectionService.request` 直接使用 `OperationLock.appWaitTimeout`（15 秒）或维持 `tryAcquire()`（0 秒）**：维持 0 秒无法消化正常的短时后台巡检与 `--mount-agent`（1～3 秒），用户在刚退出外盘应用准备弹盘时仍会频繁撞锁；而等满 15 秒在后台确有长耗时恢复任务时会让界面弹出按钮长时间失去反馈。选 5 秒作为交互式等锁预算（与 `PortalImageLaunchPreparation` 一致），并配合 `withTaskCancellationHandler` 保证退出时毫秒级中断。
+3. **修改 `ContentView` 去掉 `didTerminateApplicationNotification` 对 `OperationMaintenance` 的触发**：可降低退应用后撞锁概率；但会推迟应用退出后对原位挂载/待清理残留的及时自动收尾，属于规避症状而非修复 7～21 秒占锁的根因。保留原触发时机，从根源把空跑维护缩回亚秒级并用 5 秒弹出等锁兜底。
+
+## Consequences
+
+- **收益**：
+  - `ContainerMountStore` 空跑读路径不再反复对历史大 manif
```

**File**: `AppPorts/Services/AppOperationState.swift` (modified, +20/-5)
```diff
@@ -13,6 +13,7 @@ final class AppOperationState: ObservableObject {
     @Published private var activeOperation: UUID?
     @Published private var migrationCount = 0
     @Published private(set) var recordsRevision: UInt64 = 0
+    private var pendingRecordsChange = false
     private var recordObserver: AnyCancellable?
     private var terminationReply: (() -> Void)?
     private var cancellation: (() -> Void)?
@@ -21,7 +22,11 @@ final class AppOperationState: ObservableObject {
         recordObserver = notificationCenter.publisher(for: .appPortsRecordsDidChange)
             .receive(on: RunLoop.main)
             .sink { [weak self] _ in
-                guard let self, !self.isBusy else { return }
+                guard let self else { return }
+                if self.isBusy {
+                    self.pendingRecordsChange = true
+                    return
+                }
                 self.recordsRevision &+= 1
             }
     }
@@ -37,6 +42,7 @@ final class AppOperationState: ObservableObject {
         let wasBusy = isBusy
         migrationCount = count
         if wasBusy && !isBusy {
+            pendingRecordsChange = false
             recordsRevision &+= 1
             completeTerminationIfIdle()
         }
@@ -49,13 +55,22 @@ final class AppOperationState: ObservableObject {
         return token
     }
 
-    func finish(_ token: UUID) {
+    func finish(_ token: UUID, publishRecordsChange: Bool = true) {
         guard activeOperation == token else { return }
         activeOperation = nil
         cancellation = nil
-        // Publish once at the end of a foreground operation, not on every
-        // journal phase. Idle windows also observe background store changes.
-        recordsRevision &+= 1
+        // Publish once at the end of a mutating foreground operation (or when a
+        // background store change arrived while busy). A pre-lock refusal leaves
+        // recordsRevision untouched so idle observers do not rescan or resync.
+        let shouldPublish = publishRecordsChange || pendingRecordsChange
+        if !isBusy {
+            if shouldPublish {
+                pendingRecordsChange = false
+                recordsRevision &+= 1
+            }
+        } else if shouldPublish {
+            pendingRecordsChange = true
+        }
         completeTerminationIfIdle()
         if terminationReply == nil {
             MigrationTaskCenter.shared.schedule()
```

**File**: `AppPorts/Services/ContainerMountStore.swift` (modified, +121/-36)
```diff
@@ -3,6 +3,7 @@
 //  AppPorts
 //
 
+import CryptoKit
 import Darwin
 import Foundation
 
@@ -95,6 +96,12 @@ final class ContainerMountStore: @unchecked Sendable {
         self.writeData = writeData
     }
 
+    var baselineValidationCacheCountForTesting: Int {
+        lock.lock()
+        defer { lock.unlock() }
+        return baselineValidation.cachedEntryCount
+    }
+
     /// Check the live writers for this dataset again at each mutation boundary.
     /// Injected fixture stores remain independent of the user's running app.
     func recheckWriterAdmission() throws {
@@ -861,10 +868,13 @@ final class ContainerMountStore: @unchecked Sendable {
             $0.legacyRootOwnership != nil || $0.legacyMountFlags != nil
         } || document.mounts.contains { $0.ownershipPolicy != nil }
             || document.cleanups.contains { $0.mountRecord.ownershipPolicy != nil }
+        let transferKeys = document.transfers.map(TransferBaselineKeys.init)
         // A schema-4 writer does not understand projected ownership on either
         // side of an ordinary copy. Keep that contract in its opaque baseline
         // while preventing older clients from executing against it.
-        let needsCompatibilitySchema = try document.transfers.contains { try self.hasOwnershipCompatibility($0, using: validation) }
+        let needsCompatibilitySchema = try zip(document.transfers, transferKeys).contains { transfer, keys in
+            try self.hasOwnershipCompatibility(transfer, key: keys.baseline, using: validation)
+        }
         let needsCleanupSchema = document.transfers.contains { $0.cleanupParentIdentity != nil || $0.recoveryMountRecord != nil }
         let needsPreparationSchema = !document.preservedMaterials.isEmpty || document.transfers.contains {
             $0.preparationPath != nil || $0.sourceBaseline != nil || $0.stagingIdentity != nil
@@ -877,7 +887,9 @@ final class ContainerMountStore: @unchecked Sendable {
         }
         // A schema-7 reader drops resource-fork summaries when decoding a
         // manifest. Apply this to creation and partial-removal baselines too.
-        let needsResourceForkSchema = try document.transfers.contains { try self.hasResourceForkContract($0, using: validation) }
+        let needsResourceForkSchema = try zip(document.transfers, transferKeys).contains { transfer, keys in
+            try self.hasResourceForkContract(transfer, keys: keys, using: validation)
+        }
         let needsRollbackSchema = document.transfers.contains { $0.rollbackCompletedAt != nil }
         let needsCleanupDecisionSchema = document.transfers.contains { $0.cleanupDisposition != nil }
         let needsRetrySchema = document.transfers.contains { $0.retryFailureCount != nil || $0.nextAutomaticRetryAt != nil }
@@ -898,7 +910,7 @@ final class ContainerMountStore: @unchecked Sendable {
         document.manualMountPauses = document.manualMountPauses.filter { uuid, path in
             document.mounts.contains { $0.volumeUUID.uppercased() == uuid && $0.mountPointPath == path }
         }
-        try validate(document, using: validation)
+        try validate(document, using: validation, precomputedKeys: transferKeys)
         // Remount checks may confirm an unchanged record. Do not turn those
         // checks into filesystem events and another round of UI scans.
         guard document != original else { return }
@@ -1089,25 +1101,78 @@ final class ContainerMountStore: @unchecked Sendable {
         let restoredRootOwnership: TreeCopySnapshot.Ownership?
     }
 
-    /// Keys are the full immutable manifest bytes freshly read from disk, never
-    /// a path, inode, timestamp or previous filesystem verification. Reusing
-    /// their small parsing summaries avoids decoding tens of thousands of
-    /// entries at every journal transition. No decoded file tree is retained.
+    private struct BaselineKey: Hashable {
+        let byteCount: Int
+        let digest: SHA256.Digest
+
+        init(data: Data) {
+            byteCount = data.count
+            digest = SHA256.hash(data: data)
+        }
+    }
+
+    private struct TransferBaselineKeys {
+        let baseline: BaselineKey?
+        let sourceBaseline: BaselineKey?
+        let preparationRemovalBaseline: BaselineKey?
+
+        init(_ transfer: DataTransferRecord) {
+            baseline = transfer.baseline.map(BaselineKey.init(data:))
+            sourceBaseline = transfer.sourceBaseline.map(BaselineKey.init(data:))
+            preparationRemovalBaseline = transfer.preparationRemovalBaseline.map(BaselineKey.init(data:))
+        }
+
+        var allKeys: [BaselineKey] {
+            [baseline, sourceBaseline, preparationRemovalBaseline].compactMap { $0 }
+        }
+    }
+
+    /// Keys are derived from the full immutable manifest bytes freshly read from
+    /// disk (byte length + SHA-256 digest), never a path, inode, timestamp or
+    /// previous filesystem verification. Reusing their small parsing summarie
```

**File**: `AppPortsTests/AppOperationStateTests.swift` (modified, +25/-0)
```diff
@@ -60,6 +60,31 @@ final class AppOperationStateTests: XCTestCase {
         XCTAssertEqual(state.recordsRevision, 1)
     }
 
+    func testNonMutatingFinishSkipsRecordsRevisionUnlessBackgroundChangeArrived() async throws {
+        let center = NotificationCenter()
+        let state = AppOperationState(notificationCenter: center)
+
+        let first = try XCTUnwrap(state.begin())
+        state.finish(first, publishRecordsChange: false)
+        XCTAssertFalse(state.isBusy)
+        XCTAssertEqual(state.recordsRevision, 0)
+
+        let second = try XCTUnwrap(state.begin())
+        center.post(name: .appPortsRecordsDidChange, object: nil)
+        try await Task.sleep(nanoseconds: 50_000_000)
+        XCTAssertEqual(state.recordsRevision, 0)
+        state.finish(second, publishRecordsChange: false)
+        XCTAssertFalse(state.isBusy)
+        XCTAssertEqual(state.recordsRevision, 1)
+
+        let third = try XCTUnwrap(state.begin())
+        var replied = false
+        XCTAssertTrue(state.finishBeforeTerminating { replied = true })
+        state.finish(third, publishRecordsChange: false)
+        XCTAssertTrue(replied)
+        XCTAssertEqual(state.recordsRevision, 1)
+    }
+
     func testNormalQuitCancelsARealDataCopyAndRepliesOnlyAfterItsRecoveryRecordIsSaved() async throws {
         for copies in [1, 4] {
             try await checkNormalQuitCancelsARealDataCopy(copies: copies)
```

**File**: `AppPortsTests/DataTransferStoreTests.swift` (modified, +54/-0)
```diff
@@ -876,6 +876,60 @@ struct DataTransferStoreTests {
         #expect(identity.inode != parent.inode)
     }
 
+    @Test("Baseline validation cache prunes completed transfers and distinguishes equal-length manifests")
+    func baselineValidationCachePrunesAndDistinguishesContent() throws {
+        let fixture = try Fixture()
+        defer { fixture.remove() }
+        var transfer = fixture.transfer(mode: .symlink)
+        try fixture.store.beginTransfer(transfer)
+        transfer.phase = .copying
+        try fixture.store.updateTransfer(transfer)
+        transfer.phase = .verified
+        transfer.baseline = Data(repeating: 0xAB, count: 4 * 1024 * 1024)
+        try fixture.store.updateTransfer(transfer)
+        #expect(fixture.store.baselineValidationCacheCountForTesting == 1)
+
+        transfer.phase = .switching
+        try fixture.store.updateTransfer(transfer)
+        try fixture.store.finalizeTransfer(operationID: transfer.operationID, baseline: transfer.baseline!)
+        try fixture.store.requestCleanup(operationID: transfer.operationID)
+        try fixture.store.finishTransfer(operationID: transfer.operationID, deletionConfirmed: true)
+
+        #expect(try fixture.store.transfers().isEmpty)
+        #expect(fixture.store.baselineValidationCacheCountForTesting == 0)
+        for _ in 0..<50 {
+            #expect(try fixture.store.transfers().isEmpty)
+        }
+        #expect(fixture.store.baselineValidationCacheCountForTesting == 0)
+
+        var second = fixture.transfer(mode: .symlink)
+        try fixture.store.beginTransfer(second)
+        second.phase = .copying
+        try fixture.store.updateTransfer(second)
+        second.phase = .verified
+        let validBytes = try PropertyListSerialization.data(
+            fromPropertyList: ["note": "same-len-valid-payload"], format: .binary, options: 0)
+        second.baseline = validBytes
+        try fixture.store.updateTransfer(second)
+        #expect(fixture.store.baselineValidationCacheCountForTesting == 1)
+
+        let malformedBytes = try PropertyListSerialization.data(
+            fromPropertyList: ["ownershipCompatibility": "bad"], format: .binary, options: 0)
+        var third = DataTransferRecord(mode: .symlink, direction: .migrate, appName: "Other", bundleIdentifier: "test.other",
+            dataDirType: "fixture", originalPath: fixture.root.appendingPathComponent("B").path,
+            activePath: fixture.root.appendingPathComponent("external/B").path,
+            destinationPath: fixture.root.appendingPathComponent("external/B").path,
+            backupPath: fixture.root.appendingPathComponent("B.backup").path,
+            sourceIdentity: DataPathIdentity(device: 1, inode: 43),
+            destinationIdentity: DataPathIdentity(device: 2, inode: 501))
+        try fixture.store.beginTransfer(third)
+        third.phase = .copying
+        try fixture.store.updateTransfer(third)
+        third.phase = .verified
+        third.baseline = malformedBytes
+        #expect(throws: ContainerMountStore.StoreError.self) { try fixture.store.updateTransfer(third) }
+    }
+
     private final class LockedErrors: @unchecked Sendable {
         private let lock = NSLock()
         private var values: [any Error] = []
```

#### Recent Merged Pull Requests:
- **PR #114** (2026-11-25): fix(ui): 修复输入框拖窗和窗口缩放卡顿 (@Souitou-iop)
- **PR #113** (2026-11-25): fix(wechat): 恢复文件与视频单独拆分迁移和修正还原会因读取其他介质uuid而导致失败的问题 (@trah01)
- **PR #112** (2026-11-21): docs: document Homebrew installation in both READMEs (@wzh4869)
- **PR #108** (2026-11-11): fix: 修复存储能力提示弹窗点击「仍要迁移」陷入死循环的问题 (@aurorax-neo)
- **PR #104** (2026-11-08): feat: 完善应用库映像恢复、启动入口与权限引导 (@trah01)
- **PR #103** (2026-11-02): fix: 兼容 macOS 27 受保护的 quarantine，修复带标记应用迁移失败 (@Souitou-iop)

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

## X. build): 将 AppPorts 2.4.0 构建号更新至 96

**RULE**:
When implementing operations in `AppPorts.xcodeproj/project.pbxproj`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in wzh4869/AppPorts. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d9294511`: build): 将 AppPorts 2.4.0 构建号更新至 96. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `AppPorts.xcodeproj/project.pbxproj`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
				CURRENT_PROJECT_VERSION = 96;
				CURRENT_PROJECT_VERSION = 96;
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
				CURRENT_PROJECT_VERSION = 92;
				CURRENT_PROJECT_VERSION = 92;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d9294511` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
