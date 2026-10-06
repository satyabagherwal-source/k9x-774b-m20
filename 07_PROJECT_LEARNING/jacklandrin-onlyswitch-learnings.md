# Forensic Learning Record (Deep Inspection): jacklandrin/OnlySwitch

> **Canonical Artifact**: `07_PROJECT_LEARNING/jacklandrin-onlyswitch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jacklandrin/OnlySwitch](https://github.com/jacklandrin/OnlySwitch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:29:45.332Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jacklandrin/OnlySwitch`
- **Description**: ⚙️ All-in-One menu bar app, hide 💻MacBook Pro's notch, dark mode, AirPods, Shortcuts
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5965 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Modules/Sources/DesktopPet/DesktopPetPomodoroState.swift`
```
public enum DesktopPetPomodoroPhase: Equatable, Sendable {
    case focus
    case breakTime
}

public struct DesktopPetPomodoroState: Equatable, Sendable {
    public let phase: DesktopPetPomodoroPhase
    public let remainingTime: String

    public init(phase: DesktopPetPomodoroPhase, remainingTime: String) {
        self.phase = phase
        self.remainingTime = remainingTime
    }
}

```

### Core Architecture Module: `Modules/Sources/OnlyAgent/Observation/StateObserver.swift`
```
//
//  StateObserver.swift
//  Modules
//
//  Created by Bo Liu on 18.11.25.
//

import Foundation
import AppKit

@available(macOS 26.0, *)
@MainActor
public final class StateObserver {
    public static let shared = StateObserver()
    
    private init() {}
    
    public func captureSystemState() -> SystemState {
        let runningApps = getRunningApplications()
        let activeWindows = getActiveWindows()
        let fileChanges: [String] = [] // Can be enhanced with file system monitoring
        let systemSettings: [String: String] = [:] // Can be enhanced with settings monitoring
        
        return SystemState(
            runningApplications: runningApps,
            activeWindows: activeWindows,
            recentFileChanges: fileChanges,
            systemSettings: systemSettings,
            timestamp: Date()
        )
    }
    
    public func compareStates(before: SystemState, after: SystemState) -> StateDiff {
        let newApps = Set(after.runningApplications).subtracting(before.runningApplications)
        let closedApps = Set(before.runningApplications).subtracting(after.runningApplications)
        let newWindows = Set(after.activeWindows).subtracting(before.activeWindows)
        let closedWindows = Set(before.activeWindows).subtracting(after.activeWindows)
        let fileChanges = Set(after.recentFileChanges).subtracting(before.recentFileChanges)
        
        var settingChanges: [String: String] = [:]
        for (key, value) in after.systemSettings {
            if before.systemSettings[key] != value {
                settingChanges[key] = value
            }
        }
        
        return StateDiff(
            newApplications: Array(newApps),
            closedApplications: Array(closedApps),
            newWindows: Array(newWindows),
            closedWindows: Array(closedWindows),
            fileChanges: Array(fileChanges),
            settingChanges: settingChanges
        )
    }
    
    private func getRunningApplications() -> [String] {
        let workspace = NSWorkspace.shared
        return workspace.runningApplications.compactMap { app in
            app.localizedName
        }
    }
    
    private func getActiveWindows() -> [String] {
        var windowNames: [String] = []
        let workspace = NSWorkspace.shared
        for app in workspace.runningApplications {
            if let name = app.localizedName {
                windowNames.append(name)
            }
        }
        return windowNames
    }
}

```

### Core Architecture Module: `Modules/Sources/OnlyControl/ControlItemViewState.swift`
```
//
//  ControlItemReducer.swift
//
//
//  Created by Jacklandrin on 2024/8/24.
//

import AppKit
import Foundation
import Switches
import Defines

public struct ControlItemViewState: Equatable, Hashable, Identifiable {
    public var id: String
    public var title: String
    public var subtitle: String?
    public var detail: ControlItemDetail?
    public var weight: Int
    public var unitType: UnitType
    public var status: Bool
    public var iconData: Data
    var controlType: ControlType
    var opacity: Double = 1

    public init(
        id: String,
        title: String,
        subtitle: String? = nil,
        detail: ControlItemDetail? = nil,
        iconData: Data,
        controlType: ControlType,
        status: Bool = false,
        weight: Int = 0,
        unitType: UnitType = .builtIn
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.detail = detail
        self.iconData = iconData
        self.controlType = controlType
        self.status = status
        self.weight = weight
        self.unitType = unitType
    }

    public var interaction: ControlItemInteraction {
        detail.map(ControlItemInteraction.presentDetail) ?? .performControl
    }

    /// Shortcut icons are user-provided artwork, rather than glyphs. Preserve their
    /// original colors instead of applying the tile tint as a template image.
    public var usesTemplateIconRendering: Bool {
        unitType != .shortcuts
    }
}

public extension ControlItemViewState {
    static func preview(id: String = "") -> Self {
        .init(
            id: id,
            title: "Long Long Control Item",
            iconData: NSImage(systemSymbolName: "gear")
                .resizeMaintainingAspectRatio(withSize: NSSize(width: 50, height: 50))!
                .pngData!,
            controlType: .Switch
        )
    }
}

```

### Core Architecture Module: `Modules/Sources/RemoteCore/CodexUsageModels.swift`
```
import Foundation

public struct RemoteCodexUsageRequest: Codable, Equatable, Sendable {
    public let requestID: UUID
    public let includeLocalActivity: Bool
    public init(requestID: UUID, includeLocalActivity: Bool) {
        self.requestID = requestID
        self.includeLocalActivity = includeLocalActivity
    }
}

public struct CodexUsageAccountDTO: Codable, Equatable, Sendable {
    public let email: String?
    public let plan: String?
    public init(email: String?, plan: String?) { self.email = email; self.plan = plan }
}

public struct CodexQuotaWindowDTO: Codable, Equatable, Sendable {
    public let remainingPercent: Int
    public let resetAt: Date?
    public init(remainingPercent: Int, resetAt: Date?) {
        self.remainingPercent = min(max(remainingPercent, 0), 100)
        self.resetAt = resetAt
    }
}

public enum CodexResetCreditsDTO: Codable, Equatable, Sendable {
    case unavailable
    case unlimited
    case available(count: Int, expiresAt: Date?)
}

public enum CodexCreditBalanceDTO: Codable, Equatable, Sendable {
    case unavailable
    case unlimited
    case available(remaining: Double, limit: Double?, unit: String)
}

public enum CodexUsageSourceDTO: String, Codable, Equatable, Sendable { case oauth, cli }

public struct CodexDailyUsageDTO: Codable, Equatable, Sendable, Identifiable {
    public let date: Date
    public let tokenCount: Int
    public var id: Date { date }
    public init(date: Date, tokenCount: Int) { self.date = date; self.tokenCount = tokenCount }
}

public struct CodexActivityEstimateDTO: Codable, Equatable, Sendable {
    public let dailyUsage: [CodexDailyUsageDTO]
    public let isPartial: Bool
    public init(dailyUsage: [CodexDailyUsageDTO], isPartial: Bool) {
        self.dailyUsage = dailyUsage; self.isPartial = isPartial
    }
}

public struct RemoteCodexUsageSnapshot: Codable, Equatable, Sendable {
    public let account: CodexUsageAccountDTO
    public let session: CodexQuotaWindowDTO?
    public let weekly: CodexQuotaWindowDTO?
    public let resetCredits: CodexResetCreditsDTO
    public let creditBalance: CodexCreditBalanceDTO
    public let source: CodexUsageSourceDTO
    public let fetchedAt: Date
    public let activity: CodexActivityEstimateDTO?
    public init(account: CodexUsageAccountDTO, session: CodexQuotaWindowDTO?, weekly: CodexQuotaWindowDTO?, resetCredits: CodexResetCreditsDTO, creditBalance: CodexCreditBalanceDTO, source: CodexUsageSourceDTO, fetchedAt: Date, activity: CodexActivityEstimateDTO?) {
        self.account = account; self.session = session; self.weekly = weekly
        self.resetCredits = resetCredits; self.creditBalance = creditBalance
        self.source = source; self.fetchedAt = fetchedAt; self.activity = activity
    }
}

public struct RemoteCodexUsageResult: Codable, Equatable, Sendable {
    public let requestID: UUID
    public let result: Result<RemoteCodexUsageSnapshot, RemoteProtocolError>
    public init(requestID: UUID, result: Result<RemoteCodexUsageSnapshot, RemoteProtocolError>) {
        self.requestID = requestID; self.result = result
    }
    private enum CodingKeys: String, CodingKey { case requestID, success, failure }
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        requestID = try container.decode(UUID.self, forKey: .requestID)
        let hasSuccess = container.contains(.success), hasFailure = container.contains(.failure)
        guard hasSuccess != hasFailure else {
            throw DecodingError.dataCorruptedError(forKey: .success, in: container, debugDescription: "Result must contain exactly one of success or failure.")
        }
        result = hasSuccess
            ? .success(try container.decode(RemoteCodexUsageSnapshot.self, forKey: .success))
            : .failure(try container.decode(RemoteProtocolError.self, forKey: .failure))
    }
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(requestID, forKey: .requestID)
        switch result {
        case let .success(value): try container.encode(value, forKey: .success)
        case let .failure(error): try container.encode(error, forKey: .failure)
        }
    }
}

```

### Core Architecture Module: `Modules/Sources/RemoteCore/RemoteAction.swift`
```
import Foundation

public enum RemoteControlAction: Codable, Equatable, Sendable {
    case setState(Bool)
    case trigger

    private enum CodingKeys: String, CodingKey {
        case type
        case value
    }

    private enum Kind: String, Codable {
        case setState
        case trigger
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(Kind.self, forKey: .type) {
        case .setState:
            self = .setState(try container.decode(Bool.self, forKey: .value))
        case .trigger:
            self = .trigger
        }
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .setState(isOn):
            try container.encode(Kind.setState, forKey: .type)
            try container.encode(isOn, forKey: .value)
        case .trigger:
            try container.encode(Kind.trigger, forKey: .type)
        }
    }
}

public struct RemoteActionRequest: Codable, Equatable, Sendable {
    public let requestID: UUID
    public let controlID: RemoteControlID
    public let action: RemoteControlAction

    public init(requestID: UUID, controlID: RemoteControlID, action: RemoteControlAction) {
        self.requestID = requestID
        self.controlID = controlID
        self.action = action
    }
}

public struct RemoteActionResult: Codable, Equatable, Sendable {
    public let requestID: UUID
    public let result: Result<RemoteControlStatus?, RemoteProtocolError>

    private enum CodingKeys: String, CodingKey {
        case requestID
        case success
        case failure
    }

    public init(requestID: UUID, result: Result<RemoteControlStatus?, RemoteProtocolError>) {
        self.requestID = requestID
        self.result = result
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        requestID = try container.decode(UUID.self, forKey: .requestID)

        let hasSuccess = container.contains(.success)
        let hasFailure = container.contains(.failure)
        guard hasSuccess != hasFailure else {
            throw DecodingError.dataCorruptedError(
                forKey: .success,
                in: container,
                debugDescription: "Action result must contain exactly one of success or failure."
            )
        }

        if hasSuccess {
            result = .success(try container.decodeIfPresent(RemoteControlStatus.self, forKey: .success))
        } else {
            result = .failure(try container.decode(RemoteProtocolError.self, forKey: .failure))
        }
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(requestID, forKey: .requestID)
        switch result {
        case let .success(status):
            try container.encodeIfPresent(status, forKey: .success)
            if status == nil {
                try container.encodeNil(forKey: .success)
            }
        case let .failure(error):
            try container.encode(error, forKey: .failure)
        }
    }
}

```

### Core Architecture Module: `Modules/Sources/RemoteCore/RemoteControlDescriptor.swift`
```
import Foundation

public struct RemoteControlDescriptor: Codable, Equatable, Identifiable, Sendable {
    public enum Behavior: String, Codable, Sendable {
        case `switch`
        case button
        case player
    }

    public enum Icon: Codable, Equatable, Sendable {
        case systemSymbol(String)
        case png(Data)

        private enum CodingKeys: String, CodingKey {
            case type
            case value
        }

        private enum Kind: String, Codable {
            case systemSymbol
            case png
        }

        public init(from decoder: any Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            switch try container.decode(Kind.self, forKey: .type) {
            case .systemSymbol:
                self = .systemSymbol(try container.decode(String.self, forKey: .value))
            case .png:
                self = .png(try container.decode(Data.self, forKey: .value))
            }
        }

        public func encode(to encoder: any Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            switch self {
            case let .systemSymbol(name):
                try container.encode(Kind.systemSymbol, forKey: .type)
                try container.encode(name, forKey: .value)
            case let .png(data):
                try container.encode(Kind.png, forKey: .type)
                try container.encode(data, forKey: .value)
            }
        }
    }

    public let id: RemoteControlID
    public let title: String
    public let behavior: Behavior
    public let icon: Icon
    public let isAvailable: Bool
    public let unavailableReason: String?
    public let isDestructive: Bool
    public let supportsStatus: Bool
    public let supportsSecondaryInformation: Bool

    public init(
        id: RemoteControlID,
        title: String,
        behavior: Behavior,
        icon: Icon,
        isAvailable: Bool,
        unavailableReason: String?,
        isDestructive: Bool,
        supportsStatus: Bool,
        supportsSecondaryInformation: Bool
    ) {
        self.id = id
        self.title = title
        self.behavior = behavior
        self.icon = icon
        self.isAvailable = isAvailable
        self.unavailableReason = unavailableReason
        self.isDestructive = isDestructive
        self.supportsStatus = supportsStatus
        self.supportsSecondaryInformation = supportsSecondaryInformation
    }
}

```

### Core Architecture Module: `Modules/Sources/RemoteCore/RemoteControlID.swift`
```
public struct RemoteControlID: Codable, Hashable, Sendable {
    public enum Kind: String, Codable, CaseIterable, Sendable {
        case builtIn
        case shortcut
        case evolution
    }

    public let kind: Kind
    public let value: String

    public init(kind: Kind, value: String) {
        self.kind = kind
        self.value = value
    }
}

```

### Core Architecture Module: `Modules/Sources/RemoteCore/RemoteControlStatus.swift`
```
import Foundation

public struct RemoteControlStatus: Codable, Equatable, Identifiable, Sendable {
    public let id: RemoteControlID
    public let isAvailable: Bool
    public let unavailableReason: String?
    public let isOn: Bool?
    public let secondaryInformation: String?
    public let isProcessing: Bool
    public let revision: UInt64
    public let updatedAt: Date

    public init(
        id: RemoteControlID,
        isAvailable: Bool,
        unavailableReason: String?,
        isOn: Bool?,
        secondaryInformation: String?,
        isProcessing: Bool,
        revision: UInt64,
        updatedAt: Date
    ) {
        self.id = id
        self.isAvailable = isAvailable
        self.unavailableReason = unavailableReason
        self.isOn = isOn
        self.secondaryInformation = secondaryInformation
        self.isProcessing = isProcessing
        self.revision = revision
        self.updatedAt = updatedAt
    }
}

```

### Core Architecture Module: `Modules/Sources/RemoteCore/RemoteMessage.swift`
```
import Foundation

public struct ClientHello: Codable, Equatable, Sendable {
    public let version: RemoteProtocolVersion
    public let deviceID: UUID
    public let deviceName: String
    public let ephemeralPublicKey: Data

    public init(version: RemoteProtocolVersion, deviceID: UUID, deviceName: String, ephemeralPublicKey: Data) {
        self.version = version
        self.deviceID = deviceID
        self.deviceName = deviceName
        self.ephemeralPublicKey = ephemeralPublicKey
    }
}

public struct ServerHello: Codable, Equatable, Sendable {
    public let version: RemoteProtocolVersion
    public let macID: UUID
    public let macName: String
    public let ephemeralPublicKey: Data
    public let challenge: Data

    public init(version: RemoteProtocolVersion, macID: UUID, macName: String, ephemeralPublicKey: Data, challenge: Data) {
        self.version = version
        self.macID = macID
        self.macName = macName
        self.ephemeralPublicKey = ephemeralPublicKey
        self.challenge = challenge
    }
}

public struct PairingProof: Codable, Equatable, Sendable {
    public let deviceID: UUID
    public let proof: Data

    public init(deviceID: UUID, proof: Data) {
        self.deviceID = deviceID
        self.proof = proof
    }
}

public struct PairingSuccess: Codable, Equatable, Sendable {
    public let macID: UUID
    public let credential: Data

    public init(macID: UUID, credential: Data) {
        self.macID = macID
        self.credential = credential
    }
}

public struct PairingPrepared: Codable, Equatable, Sendable {
    public let transactionID: UUID
    public let macID: UUID
    public let credential: Data
    public let catalogRevision: UInt64
    public let expiresAt: Date

    public init(transactionID: UUID, macID: UUID, credential: Data, catalogRevision: UInt64, expiresAt: Date) {
        self.transactionID = transactionID
        self.macID = macID
        self.credential = credential
        self.catalogRevision = catalogRevision
        self.expiresAt = expiresAt
    }
}

public struct PairingTransactionCommand: Codable, Equatable, Sendable {
    public let transactionID: UUID

    public init(transactionID: UUID) {
        self.transactionID = transactionID
    }
}

public enum PairingTransactionState: String, Codable, Equatable, Sendable {
    case prepared, committed, aborted
}

public struct PairingTransactionStatus: Codable, Equatable, Sendable {
    public let transactionID: UUID
    public let state: PairingTransactionState

    public init(transactionID: UUID, state: PairingTransactionState) {
        self.transactionID = transactionID
        self.state = state
    }
}

public struct AuthenticationProof: Codable, Equatable, Sendable {
    public let deviceID: UUID
    public let proof: Data

    public init(deviceID: UUID, proof: Data) {
        self.deviceID = deviceID
        self.proof = proof
    }
}

public struct AuthenticationSuccess: Codable, Equatable, Sendable {
    public let sessionID: UUID
    public let catalogRevision: UInt64

    public init(sessionID: UUID, catalogRevision: UInt64) {
        self.sessionID = sessionID
        self.catalogRevision = catalogRevision
    }
}

public struct CredentialRevocationProof: Codable, Equatable, Sendable {
    public let deviceID: UUID
    public let proof: Data

    public init(deviceID: UUID, proof: Data) {
        self.deviceID = deviceID
        self.proof = proof
    }
}

public enum RemoteMessage: Codable, Equatable, Sendable {
    case clientHello(ClientHello)
    case serverHello(ServerHello)
    case pairingRequest
    case pairingProof(PairingProof)
    case pairingResult(Result<PairingSuccess, RemoteProtocolError>)
    case pairingPrepared(PairingPrepared)
    case pairingCommit(PairingTransactionCommand)
    case pairingAbort(PairingTransactionCommand)
    case pairingStatusRequest(PairingTransactionCommand)
    case pairingStatus(PairingTransactionStatus)
    case pairingCommitted(PairingTransactionCommand)
    case authenticationProof(AuthenticationProof)
    case authenticationResult(Result<AuthenticationSuccess, RemoteProtocolError>)
    case catalogRequest
    case catalogSnapshot(revision: UInt64, controls: [RemoteControlDescriptor])
    case catalogChanged(revision: UInt64)
    case subscriptionUpdate(Set<RemoteControlID>)
    case statusSnapshot([RemoteControlStatus])
    case statusChanged(RemoteControlStatus)
    case actionRequest(RemoteActionRequest)
    case actionResult(RemoteActionResult)
    case soundMixerSnapshotRequest
    case soundMixerSnapshot(RemoteSoundMixerSnapshot)
    case soundMixerCommand(RemoteSoundMixerCommand)
    case systemMonitorSubscriptionUpdate(Bool)
    case systemMonitorSnapshot(SystemMonitorSnapshot)
    case codexUsageRequest(RemoteCodexUsageRequest)
    case codexUsageResult(RemoteCodexUsageResult)
    case ping(UInt64)
    case pong(UInt64)
    case credentialRevoked
    case credentialRevocationProof(CredentialRevocationProof)
    case sessionError(RemoteProtocolError)

    private enum CodingKeys: String, CodingKey {
        case type
        case payload
        case revision
        case controls
        case success
        case failure
    }

    private enum Kind: String, Codable {
        case clientHello
        case serverHello
        case pairingRequest
        case pairingProof
        case pairingResult
        case pairingPrepared
        case pairingCommit
        case pairingAbort
        case pairingStatusRequest
        case pairingStatus
        case pairingCommitted
        case authenticationProof
        case authenticationResult
        case catalogRequest
        case catalogSnapshot
        case catalogChanged
        case subscriptionUpdate
        case statusSnapshot
        case statusChanged
        case actionRequest
        case actionResult
        case soundMixerSnapshotRequest
        case soundMixerSnapshot
        case soundMixerCommand
        case systemMonitorSubscriptionUpdate
        case systemMonitorSnapshot
        case codexUsageRequest
        case codexUsageResult
        case ping
        case pong
        case credentialRevoked
        case credentialRevocationProof
        case sessionError
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(Kind.self, forKey: .type) {
        case .clientHello:
            self = .clientHello(try container.decode(ClientHello.self, forKey: .payload))
        case .serverHello:
            self = .serverHello(try container.decode(ServerHello.self, forKey: .payload))
        case .pairingRequest:
            self = .pairingRequest
        case .pairingProof:
            self = .pairingProof(try container.decode(PairingProof.self, forKey: .payload))
        case .pairingResult:
            self = .pairingResult(try Self.decodeResult(PairingSuccess.self, from: container))
        case .pairingPrepared:
            self = .pairingPrepared(try container.decode(PairingPrepared.self, forKey: .payload))
        case .pairingCommit:
            self = .pairingCommit(try container.decode(PairingTransactionCommand.self, forKey: .payload))
        case .pairingAbort:
            self = .pairingAbort(try container.decode(PairingTransactionCommand.self, forKey: .payload))
        case .pairingStatusRequest:
            self = .pairingStatusRequest(try container.decode(PairingTransactionCommand.self, forKey: .payload))
        case .pairingStatus:
            self = .pairingStatus(try container.decode(PairingTransactionStatus.self, forKey: .payload))
        case .pairingCommitted:
            self = .pairingCommitted(try container.decode(PairingTransactionCommand.self, forKey: .payload))
        case .authenticationProof:
            self = .authenticationProof(try container.decode(AuthenticationProof.self, forKey: .payload))
        case .authenticationResult:
            self = .authenticationResult(try Self.decodeResult(AuthenticationSuccess.self, from: container))
        case .catalogRequest:
            self = .catalogRequest
        case .catalogSnapshot:
            self = .catalogSnapshot(
                revision: try container.decode(UInt64.self, forKey: .revision),
                controls: try container.decode([RemoteControlDescriptor].self, forKey: .controls)
            )
        case .catalogChanged:
            self = .catalogChanged(revision: try container.decode(UInt64.self, forKey: .revision))
        case .subscriptionUpdate:
            self = .subscriptionUpdate(try container.decode(Set<RemoteControlID>.self, forKey: .payload))
        case .statusSnapshot:
            self = .statusSnapshot(try container.decode([RemoteControlStatus].self, forKey: .payload))
        case .statusChanged:
            self = .statusChanged(try container.decode(RemoteControlStatus.self, forKey: .payload))
        case .actionRequest:
            self = .actionRequest(try container.decode(RemoteActionRequest.self, forKey: .payload))
        case .actionResult:
            self = .actionResult(try container.decode(RemoteActionResult.self, forKey: .payload))
        case .soundMixerSnapshotRequest:
            self = .soundMixerSnapshotRequest
        case .soundMixerSnapshot:
            self = .soundMixerSnapshot(try container.decode(RemoteSoundMixerSnapshot.self, forKey: .payload))
        case .soundMixerCommand:
            self = .soundMixerCommand(try container.decode(RemoteSoundMixerCommand.self, forKey: .payload))
        case .systemMonitorSubscriptionUpdate:
            self = .systemMonitorSubscriptionUpdate(try container.decode(Bool.self, forKey: .payload))
        case .systemMonitorSnapshot:
            self = .systemMonitorSnapshot(try container.decode(SystemMonitorSnapshot.self, forKey: .payload))
        case .codexUsageRequest:
            self = .codexUsageRequest(try container.decode(RemoteCodexUsageRequest.self, forKey: .payload))
       
```

### Core Architecture Module: `Modules/Sources/RemoteCore/RemotePairingTeardownPolicy.swift`
```
public enum RemotePairingTeardownPhase: Equatable, Sendable {
    case provisional
    case committing
    case authenticated
    case other
}

public enum RemotePairingTeardownAction: Equatable, Sendable {
    case preserveDurablePreparedTransaction
    case performNormalCleanup
}

public enum RemotePairingTeardownPolicy {
    public static func action(for phase: RemotePairingTeardownPhase) -> RemotePairingTeardownAction {
        phase == .provisional ? .preserveDurablePreparedTransaction : .performNormalCleanup
    }
}

```

### Core Architecture Module: `Modules/Sources/RemoteCore/RemoteProtocolError.swift`
```
public struct RemoteProtocolError: Codable, Error, Equatable, Sendable {
    public enum Code: String, Codable, Sendable {
        case upgradeRequired
        case authenticationFailed
        case pairingExpired
        case pairingRateLimited
        case controlNotFound
        case controlUnavailable
        case actionNotSupported
        case executionFailed
        case requestTimedOut
        case invalidFrame
        case replayDetected
    }

    public let code: Code
    public let message: String

    public init(code: Code, message: String) {
        self.code = code
        self.message = message
    }
}

```

### Core Architecture Module: `Modules/Sources/RemoteCore/RemoteProtocolVersion.swift`
```
public struct RemoteProtocolVersion: Codable, Equatable, Sendable {
    public static let current = Self(major: 1, minor: 5)

    public let major: UInt16
    public let minor: UInt16

    public init(major: UInt16, minor: UInt16) {
        self.major = major
        self.minor = minor
    }

    public func isCompatible(with other: Self) -> Bool {
        negotiated(with: other) != nil
    }

    public func negotiated(with other: Self) -> Self? {
        guard major == other.major else { return nil }
        return Self(major: major, minor: min(minor, other.minor))
    }

    public var supportsAuthenticatedRevocation: Bool { minor >= 1 }
    public var supportsTransactionalPairing: Bool { minor >= 2 }
    /// Mixer messages are only valid after both peers negotiated this capability.
    public var supportsSoundMixerRemote: Bool { minor >= 3 }
    /// System Monitor messages are only valid after both peers negotiated this capability.
    public var supportsSystemMonitorRemote: Bool { minor >= 4 }
    /// Codex usage messages are only valid after both peers negotiated this capability.
    public var supportsCodexUsageRemote: Bool { minor >= 5 }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #37** (2022-11-24): **Radio station not working**
  *Symptoms*: Now that I finally got my media keys to work with onlyswitch radio, it seems that my favorite radio is not compatible with onlyswitch (did not occur to me to test before) :))  This is the link: http://live.radiocafe.ro:8048/live.aac  The song title is recognized, but there is no sound. Can you please advise?  Thank you very much for your support!
  **Post-Mortem & Fix Analysis**:
  > I think it's my bug. acc stream should be played automatically switch to player without sound wave effect. There's a workaround, you can turn off the sound wave effect in onlyswitch's radio setting.
  > Perfect, you are corect! Thank you! Feel free to close the issue if you don't want to tackle it (now or anytime).

- **Issue #13** (2022-01-15): **Crashes when clicking 'check for updates' button**
  *Symptoms*: On 1.8.1 (and earlier editions as well), when clicking on 'Check for updates', the app crashes.  MacOS 12.1 / M1 Mac mini  ``` ------------------------------------- Translated Report (Full Report Below) -------------------------------------  Process:               OnlySwitch [9339] Path:                  /Applications/Only Switch.app/Contents/MacOS/OnlySwitch Identifier:            jacklandrin.OnlySwitch Version:               1.8.1 (30) Code Type:             ARM-64 (Native) Parent Process:        launchd [1] User ID:               501  Date/Time:             2022-01-09 14:54:13.6347 +0000 OS Version:            macOS 12.1 (21C52) Report Version:        12 Anonymous UUID:        6FD2585F-D562-E91A-3BB0-A9A5FE7B2407  Sleep/Wake UUID:       AADB071A-B6D0-49FB-BDC2-467129154A67  Time Awake Since Boot: 92000 seconds Time Since Wake:       6535 seconds  System Integrity Protection: enabled  Crashed Thread:        0  Dispatch queue: com.apple.main-thread  Exception Type:        EXC_BREAKPOINT (SIGTRAP) Exception Codes:       0x0000000000000001, 0x00000001e6d2b7ac Exception Note:        EXC_CORPSE_NOTIFY  Termination Reason:    Namespace SIGNAL, Code 5 Trace/BPT trap: 5 Terminating Process:   exc handler [9339]  Thread 0 Crashed::  Dispatch queue: com.apple.main-thread 0   SwiftUI                       	       0x1e6d2b7ac validateDimension #1 (min:ideal:max:) in NSView.intrinsicLayoutTraits() + 216 1   SwiftUI                       	       0x
  **Post-Mortem & Fix Analysis**:
  > Same here with M1 Mac mini but on MacOS 12.2 Beta.  ------------------------------------- Translated Report (Full Report Below) -------------------------------------  Process:               OnlySwitch [26205] Path:                  /Applications/Only Switch.app/Contents/MacOS/OnlySwitch Identifier:            jacklandrin.OnlySwitch Version:               2.0 (35) Code Type:             ARM-64 (Native) Parent Process:        launchd [1] User ID:               501  Date/Time:             2022-01-13 18:05:31.4275 -0500 OS Version:            macOS 12.2 (21D5039d) Report Version:        12 Anonymous UUID:        EC51302F-8BF8-5E71-231C-762A4AD64A1B   Time Awake Since Boot: 180000 seconds  System Integrity Protection: enabled  Crashed Thread:        0  Dispatch queue: com.apple.main-thread  Exception Type:        EXC_BREAKPOINT (SIGTRAP) Exception Codes:       0x0000000000000001, 0x00000001cc1d4798 Exception Note:        EXC_CORPSE_NOTIFY  Termination Reason:  
  > Same issue and solution. https://github.com/sindresorhus/Gifski/commit/ac180e4e76acaa9b230bbb401b8bb364c2f2f424
  > It fixed in version 2.1

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

### Incident Patch 1: `30d25c53` (2026-10-05)
**Commit Message**: fix Campaign position

**File**: `OnlySwitch/Features/RemoteAccess/Campaign/OnlyRemoteCampaignWindowController.swift` (modified, +57/-11)
```diff
@@ -3,6 +3,9 @@ import ComposableArchitecture
 import Extensions
 import SwiftUI
 
+private let campaignWindowContentSize = NSSize(width: 460, height: 395)
+private let qrCodeWindowContentSize = NSSize(width: 400, height: 440)
+
 @MainActor
 final class OnlyRemoteCampaignWindowController: NSWindowController, NSWindowDelegate {
     private let store: StoreOf<OnlyRemoteCampaignFeature>
@@ -18,7 +21,7 @@ final class OnlyRemoteCampaignWindowController: NSWindowController, NSWindowDele
         self.store = store
 
         let window = NSWindow(
-            contentRect: .zero,
+            contentRect: NSRect(origin: .zero, size: campaignWindowContentSize),
             styleMask: [.titled, .closable, .fullSizeContentView],
             backing: .buffered,
             defer: false
@@ -64,9 +67,9 @@ final class OnlyRemoteCampaignWindowController: NSWindowController, NSWindowDele
 
         window.title = "OnlyRemote for iPhone and iPad".localized()
         NSApp.activate(ignoringOtherApps: true)
-        window.center()
         showWindow(nil)
         window.makeKeyAndOrderFront(nil)
+        centerWhenPresented(window, contentSize: campaignWindowContentSize)
     }
 
     func windowWillClose(_ notification: Notification) {
@@ -81,15 +84,16 @@ final class QRCodeWindowController: NSWindowController {
     static let shared = QRCodeWindowController()
 
     private init() {
-        let window = NSWindow(
-            contentRect: NSRect(x: 0, y: 0, width: 440, height: 500),
+        let window = QRCodeWindow(
+            contentRect: NSRect(origin: .zero, size: qrCodeWindowContentSize),
             styleMask: [.borderless],
             backing: .buffered,
             defer: false
         )
         window.isMovableByWindowBackground = true
         window.isReleasedWhenClosed = false
         window.backgroundColor = .windowBackgroundColor
+        window.hasShadow = true
         super.init(window: window)
     }
 
@@ -102,9 +106,40 @@ final class QRCodeWindowController: NSWindowController {
             rootView: QRCodeView(url: url, close: { [weak self] in self?.close() })
         )
         NSApp.activate(ignoringOtherApps: true)
-        window.center()
         showWindow(nil)
         window.makeKeyAndOrderFront(nil)
+        centerWhenPresented(window, contentSize: qrCodeWindowContentSize)
+    }
+}
+
+private final class QRCodeWindow: NSWindow {
+    override var canBecomeKey: Bool { true }
+    override var canBecomeMain: Bool { true }
+}
+
+@MainActor
+private func centerOnCurrentScreen(_ window: NSWindow) {
+    let mouseLocation = NSEvent.mouseLocation
+    let screen = NSScreen.screens.first { $0.frame.contains(mouseLocation) } ?? NSScreen.main
+    guard let screen else { return }
+
+    let frame = window.frame
+    window.setFrameOrigin(
+        NSPoint(
+            x: screen.frame.midX - frame.width / 2,
+            y: screen.frame.midY - frame.height / 2
+        )
+    )
+}
+
+@MainActor
+private func centerWhenPresented(_ window: NSWindow, contentSize: NSSize) {
+    window.setContentSize(contentSize)
+    centerOnCurrentScreen(window)
+    Task { @MainActor [weak window] in
+        guard let window else { return }
+        window.setContentSize(contentSize)
+        centerOnCurrentScreen(window)
     }
 }
 
@@ -113,29 +148,40 @@ private struct QRCodeView: View {
     let close: () -> Void
 
     var body: some View {
-        ZStack(alignment: .topTrailing) {
+        VStack(spacing: 16) {
             AsyncImage(url: url) { phase in
                 if let image = phase.image {
                     image.resizable().interpolation(.none).scaledToFit()
                 } else if phase.error != nil {
-                    Image(systemName: "qrcode").font(.system(size: 180)).foregroundStyle(.secondary)
+                    Image(systemName: "qrcode").font(.system(size: 140)).foregroundStyle(.secondary)
                 } else {
                     ProgressView()
                 }
             }
-            .padding(24)
-
+            .frame(width: 260, height: 260)
+
+            VStack(spacing: 6) {
+                Text("Download OnlyRemote on the App Store".localized())
+                    .font(.headline)
+                Text("Control OnlySwitch from your iPhone or iPad".localized())
+                    .font(.subheadline)
+                    .foregroundStyle(.secondary)
+                    .multilineTextAlignment(.center)
+            }
+        }
+        .frame(maxWidth: .infinity, maxHeight: .infinity)
+        .overlay(alignment: .topTrailing) {
             Button(action: close) {
                 Image(systemName: "xmark")
                     .font(.headline.weight(.semibold))
                     .padding(8)
                     .background(.regularMaterial, in: Circle())
             }
             .buttonStyle(.plain)
-            .padding(14)
+            .padding(16)
             .accessibilityLabel("Close".localized())
         }
-        .frame(width: 
```

---

### Incident Patch 2: `f225ff81` (2026-10-05)
**Commit Message**: fix natural scolling

**File**: `AGENTS.md` (modified, +2/-1)
```diff
@@ -25,7 +25,7 @@ Skills are opt-in by task context. First inspect the task and repository; then l
 | `swiftui-pro` (`doc/skills/swiftui-pro/SKILL.md`) | Reviewing, designing, or implementing SwiftUI views, view state, navigation, accessibility, animations, or SwiftUI performance | The task does not inspect or change SwiftUI code |
 | `swift-concurrency-pro` (`doc/skills/swift-concurrency-pro/SKILL.md`) | Reviewing, designing, or implementing Swift concurrency, actors, `Sendable`, isolation, async streams, cancellation, or strict-concurrency fixes | The task does not inspect or change concurrency code |
 | `swift-testing-pro` (`doc/skills/swift-testing-pro/SKILL.md`) | Writing, migrating, reviewing, or improving Swift Testing/XCTest code or test strategy | No test code or test strategy is in scope |
-| `app-store-review` (`doc/skills/app-store-review/SKILL.md`) | Reviewing macOS app code for App Store Review Guidelines, submission readiness, safety, privacy, legal, design, business, or performance risks | The task is not related to App Store compliance or release readiness |
+| `app-store-review` (`doc/skills/app-store-review/SKILL.md`) | The user explicitly requests an App Store submission-readiness review | Any macOS app task; App Store constraints are out of scope by default for this project |
 | `writing-plans` (`doc/skills/writing-plans/SKILL.md`) | The user requests a multi-step implementation plan, or the workflow's plan step is accepted | The user declines a plan or the task is small and self-contained |
 
 Use the narrowest applicable skill. If several conditions match, load the smallest set that covers the work and state the selection in the task update. Skill instructions may route to more specific references; follow only those references needed for the current task. For the project-local `writing-plans` skill, always save plans as `doc/plan/YYYY-MM-DD-<feature-name>.md`; this project location overrides any generic default path in the skill.
@@ -39,6 +39,7 @@ Use the narrowest applicable skill. If several conditions match, load the smalle
 - Prefer focused, composable modules and reusable abstractions over expanding monolithic files.
 - Maintain Swift 6 concurrency safety, including explicit sendability and actor isolation at networking, persistence, and process-boundary crossings.
 - Treat shell commands, Apple Events, keychain access, system settings, and user permissions as security-sensitive effects that require explicit dependencies and testable failure handling.
+- Do not evaluate macOS app changes against App Store constraints unless the user explicitly requests an App Store submission-readiness review.
 - Design new or substantially changed UI with modern platform styling, adopting Liquid Glass where supported, providing compatible fallbacks, supporting light and dark modes, and adapting layouts for macOS, iPhone, and iPad sizes as applicable.
 - Translate every new user-facing string into every language supported by OnlySwitch; do not ship newly added source-only strings.
 - Avoid unrelated formatting or refactoring. Update documentation when a change alters an architectural decision or workflow.
```

**File**: `Config/Versions/OnlySwitchRemote.xcconfig` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
 // Independent build number for the iOS remote app.
-CURRENT_PROJECT_VERSION = 11
+CURRENT_PROJECT_VERSION = 12
```

**File**: `Localization/Localizable.xcstrings` (modified, +21/-21)
```diff
@@ -48234,127 +48234,127 @@
         }
       }
     },
-    "Reverse Scroll Direction" : {
+    "Natural Scrolling" : {
       "extractionState" : "manual",
       "localizations" : {
         "cs" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Obrátit směr posouvání"
+            "value" : "Přirozené posouvání"
           }
         },
         "de" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Scrollrichtung umkehren"
+            "value" : "Natürliches Scrollen"
           }
         },
         "en" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Reverse Scroll Direction"
+            "value" : "Natural Scrolling"
           }
         },
         "es" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Invertir dirección de desplazamiento"
+            "value" : "Desplazamiento natural"
           }
         },
         "fil" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Baligtarin ang Direksyon ng Pag-scroll"
+            "value" : "Natural na Pag-scroll"
           }
         },
         "fr" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Inverser le sens du défilement"
+            "value" : "Défilement naturel"
           }
         },
         "hr" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Obrni smjer pomicanja"
+            "value" : "Prirodno pomicanje"
           }
         },
         "it" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Inverti direzione di scorrimento"
+            "value" : "Scorrimento naturale"
           }
         },
         "ja" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "スクロール方向を反転"
+            "value" : "ナチュラルスクロール"
           }
         },
         "ko" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "스크롤 방향 반전"
+            "value" : "자연스러운 스크롤"
           }
         },
         "nl" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Scrollrichting omkeren"
+            "value" : "Natuurlijk scrollen"
           }
         },
         "pl" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Odwróć kierunek przewijania"
+            "value" : "Naturalne przewijanie"
           }
         },
         "pt-BR" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Inverter direção da rolagem"
+            "value" : "Rolagem natural"
           }
         },
         "ru" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Инвертировать направление прокрутки"
+            "value" : "Естественная прокрутка"
           }
         },
         "sk" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Obrátiť smer posúvania"
+            "value" : "Prirodzené posúvanie"
           }
         },
         "so" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Rog jihada rogista"
+            "value" : "Rogista dabiiciga ah"
           }
         },
         "tr" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Kaydırma Yönünü Tersine Çevir"
+            "value" : "Doğal Kaydırma"
           }
         },
         "uk" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Інвертувати напрямок прокручування"
+            "value" : "Природне прокручування"
           }
         },
         "zh-Hans" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "反转滚动方向"
+            "value" : "自然滚动"
           }
         },
         "zh-Hant" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "反轉捲動方向"
+            "value" : "自然捲動"
           }
         }
       }
```

**File**: `Modules/Sources/Extensions/UserDefaultsKeys.swift` (modified, +3/-1)
```diff
@@ -40,6 +40,8 @@ public extension UserDefaults {
         //Switch
         public static let SwitchState = "SwitchStateKey"
         public static let didInstallReverseScrollDirectionSwitch = "didInstallReverseScrollDirectionSwitchKey"
+        public static let reverseScrollDirectionEnabled = "reverseScrollDirectionEnabledKey"
+        public static let reverseScrollDirectionOriginalNaturalScrolling = "reverseScrollDirectionOriginalNaturalScrollingKey"
         //Shortcuts
         public static let shortcutsDic = "shortcutsDicKey"
         //Sort
@@ -111,7 +113,7 @@ public extension UserDefaults {
             WorkDuration, RestDuration, RestAlert, WorkAlert, AllowNotificationAlert, PTimerCycleCount,
             soundWaveEffectDisplay, volume, allowNotificationChangingStation, allowNotificationTrack, radioEnable,
             isMenubarCollapse, autoCollapseMenubarTime, menubarCollapsable,
-            SwitchState,
+            SwitchState, reverseScrollDirectionEnabled,
             shortcutsDic,
             orderWeight, onlyControlOrderWeight,
             soundMixerEnabled,
```

**File**: `Modules/Sources/Switches/ShellCommandDefine.swift` (modified, +0/-6)
```diff
@@ -137,12 +137,6 @@ public struct ShowDockRecentCMD:SwitchCMD {
     public static let status:String = "defaults read com.apple.dock show-recents"
 }
 
-public struct ReverseScrollDirectionCMD: SwitchCMD {
-    public static let status = "defaults read -g com.apple.swipescrolldirection"
-    public static let on = "defaults write -g com.apple.swipescrolldirection -bool false"
-    public static let off = "defaults write -g com.apple.swipescrolldirection -bool true"
-}
-
 public struct ShorcutsCMD {
     public static let getList = "shortcuts list"
 
```

**File**: `Modules/Sources/Switches/SwitchType.swift` (modified, +1/-1)
```diff
@@ -352,7 +352,7 @@ public enum SwitchType: UInt64, CaseIterable, Sendable {
             )
         case .reverseScrollDirection:
             return SwitchBarInfo(
-                title: "Reverse Scroll Direction",
+                title: "Natural Scrolling",
                 onImage: NSImage(systemSymbolName: "computermouse.fill"),
                 offImage: NSImage(systemSymbolName: "computermouse")
             )
```

**File**: `OnlySwitch/AppDelegate.swift` (modified, +2/-0)
```diff
@@ -206,6 +206,7 @@ class AppDelegate: NSObject, NSApplicationDelegate {
         setupDesktopPet()
 
         SwitchManager.shared.registerSwitchesShouldShow()
+        _ = ReverseScrollDirectionController.shared.currentStatus()
 
         blManager = BluetoothDevicesManager.shared
         RadioStationSwitch.shared.setDefaultRadioStations()
@@ -239,6 +240,7 @@ class AppDelegate: NSObject, NSApplicationDelegate {
     }
 
     func applicationWillTerminate(_ notification: Notification) {
+        ReverseScrollDirectionController.shared.suspendForTermination()
         stopDesktopPetPomodoroRefresh()
         OnlyControlWindow.shared.onVisibilityChanged = nil
         NotificationCenter.default.removeObserver(
```

**File**: `OnlySwitch/EverySwitch/ReverseScrollDirectionSwitch.swift` (modified, +483/-4)
```diff
@@ -1,8 +1,489 @@
+@preconcurrency import ApplicationServices
+@preconcurrency import CoreGraphics
+import Darwin
 import Defines
 import Extensions
 import Foundation
 import Switches
 
+struct ScrollWheelEventTraits: Equatable, Sendable {
+    let isContinuous: Bool
+    let scrollPhase: Int64
+    let momentumPhase: Int64
+    let tabletDeviceID: Int64
+    let sourceUserData: Int64
+    let vertical: VerticalScrollDeltas
+    let horizontal: VerticalScrollDeltas
+
+    var shouldInvert: Bool {
+        isContinuous == false
+            && scrollPhase == 0
+            && momentumPhase == 0
+            && tabletDeviceID == 0
+            && sourceUserData != ScrollDirectionEventTap.syntheticEventTag
+            && vertical.hasMovement
+            && horizontal.hasMovement == false
+    }
+}
+
+struct VerticalScrollDeltas: Equatable, Sendable {
+    let line: Int64
+    let point: Int64
+    /// `scrollWheelEventFixedPtDeltaAxis*` stores a signed 16.16 fixed-point
+    /// integer. Reading and writing it as an integer preserves the raw value
+    /// that AppKit receives from a physical wheel.
+    let fixedPoint: Int64
+
+    var hasMovement: Bool {
+        line != 0 || point != 0 || fixedPoint != 0
+    }
+
+    var inverted: Self {
+        Self(
+            line: Self.safelyNegating(line),
+            point: Self.safelyNegating(point),
+            fixedPoint: Self.safelyNegating(fixedPoint)
+        )
+    }
+
+    private static func safelyNegating(_ value: Int64) -> Int64 {
+        value == .min ? .max : -value
+    }
+}
+
+struct ReverseScrollRuntimeState: Equatable, Sendable {
+    private(set) var isRequested: Bool
+    private(set) var isRunning = false
+
+    init(isRequested: Bool) {
+        self.isRequested = isRequested
+    }
+
+    var currentStatus: Bool {
+        isRequested && isRunning
+    }
+
+    mutating func didStart() {
+        isRunning = true
+    }
+
+    mutating func didStop() {
+        isRunning = false
+    }
+
+    mutating func setRequested(_ isRequested: Bool) {
+        self.isRequested = isRequested
+        if !isRequested {
+            isRunning = false
+        }
+    }
+}
+
+struct GlobalScrollDirectionPreference: Sendable {
+    let setNatural: @MainActor @Sendable (Bool) -> Bool
+
+    static let live = Self(
+        setNatural: { isNatural in
+            let key = "com.apple.swipescrolldirection" as CFString
+            CFPreferencesSetValue(
+                key,
+                NSNumber(value: isNatural),
+                kCFPreferencesAnyApplication,
+                kCFPreferencesCurrentUser,
+                kCFPreferencesAnyHost
+            )
+            let didSynchronize = CFPreferencesSynchronize(
+                kCFPreferencesAnyApplication,
+                kCFPreferencesCurrentUser,
+                kCFPreferencesAnyHost
+            )
+            applyScrollDirectionImmediately(isNatural)
+            let storedValue = CFPreferencesCopyValue(
+                key,
+                kCFPreferencesAnyApplication,
+                kCFPreferencesCurrentUser,
+                kCFPreferencesAnyHost
+            )
+            return didSynchronize && (storedValue as? NSNumber)?.boolValue == isNatural
+        }
+    )
+
+    private static func applyScrollDirectionImmediately(_ isNatural: Bool) {
+        typealias ApplyScrollDirection = @convention(c) (Bool) -> Void
+        let frameworkPath = "/System/Library/PrivateFrameworks/PreferencePanesSupport.framework/PreferencePanesSupport"
+
+        if let handle = dlopen(frameworkPath, RTLD_LAZY | RTLD_LOCAL) {
+            defer { dlclose(handle) }
+            if let symbol = dlsym(handle, "setSwipeScrollDirection") {
+                let apply = unsafeBitCast(symbol, to: ApplyScrollDirection.self)
+                apply(isNatural)
+                return
+            }
+        }
+
+        DistributedNotificationCenter.default().post(
+            name: Notification.Name("SwipeScrollDirectionDidChangeNotification"),
+            object: nil
+        )
+    }
+}
+
+@MainActor
+@discardableResult
+func restoreLegacyScrollDirectionIfNeeded(
+    defaults: UserDefaults,
+    preference: GlobalScrollDirectionPreference
+) -> Bool {
+    let key = UserDefaults.Key.reverseScrollDirectionOriginalNaturalScrolling
+    guard let originalValue = defaults.object(forKey: key) as? Bool else {
+        return true
+    }
+    guard preference.setNatural(originalValue) else {
+        return false
+    }
+    defaults.removeObject(forKey: key)
+    return true
+}
+
+/// Owns the event tap and every one of its Core Foundation resources on one
+/// dedicated run-loop thread. `NSLock` protects only the small lifecycle
+/// snapshot that is read from the main actor.
+final class ScrollDirectionEventTap: @unchecked Sendable {
+    static let syntheticEventTag: Int64 = 0x4F53_5357_4956_4E54
+
+    private let lock = NSLock()
+    private var thread: Thread?
+    private var runLoop: CFRunLoop?
+    priv
```

---

### Incident Patch 3: `f4883b45` (2026-10-04)
**Commit Message**: fix translation

**File**: `Config/Versions/OnlySwitch.xcconfig` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
 // Shared build number for the macOS app and its embedded components.
-CURRENT_PROJECT_VERSION = 281
+CURRENT_PROJECT_VERSION = 282
```

**File**: `Localization/Localizable.xcstrings` (modified, +9/-9)
```diff
@@ -7962,7 +7962,7 @@
         "cs" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Control OnlySwitch z vašeho iPhone nebo iPad, když jsou obě zařízení ve stejné místní síti."
+            "value" : "Ovládejte OnlySwitch z iPhonu nebo iPadu, když jsou obě zařízení ve stejné místní síti."
           }
         },
         "de" : {
@@ -7992,13 +7992,13 @@
         "hr" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Control OnlySwitch s vašeg iPhonea ili iPada kada su oba uređaja na istoj lokalnoj mreži."
+            "value" : "Upravljajte aplikacijom OnlySwitch sa svog iPhonea ili iPada kada su oba uređaja na istoj lokalnoj mreži."
           }
         },
         "it" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Controlla solo il passaggio dal tuo iPhone o iPad quando entrambi i dispositivi si trovano sulla stessa rete locale."
+            "value" : "Controlla OnlySwitch dal tuo iPhone o iPad quando entrambi i dispositivi sono sulla stessa rete locale."
           }
         },
         "ja" : {
@@ -8022,7 +8022,7 @@
         "pl" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Control OnlySwitch z iPhone'a lub iPada, gdy oba urządzenia znajdują się w tej samej sieci lokalnej."
+            "value" : "Steruj OnlySwitch z iPhone’a lub iPada, gdy oba urządzenia są w tej samej sieci lokalnej."
           }
         },
         "pt-BR" : {
@@ -8046,31 +8046,31 @@
         "so" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Ka xakamee KeliyaSwitch ka iPhone-kaaga ama iPad-kaaga marka labada qalabba ay ku jiraan isku shabakad maxalli ah."
+            "value" : "Ka maamul OnlySwitch iPhone-kaaga ama iPad-kaaga marka labada qalab ay ku jiraan isla shabakadda maxalliga ah."
           }
         },
         "tr" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Her iki cihaz da aynı yerel ağda olduğunda Yalnızca Kontrol iPhone veya iPad'inizden geçiş yapın."
+            "value" : "Her iki cihaz aynı yerel ağdayken OnlySwitch’i iPhone veya iPad’inizden kontrol edin."
           }
         },
         "uk" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Control OnlySwitch з вашого iPhone або iPad, коли обидва пристрої підключені до однієї локальної мережі."
+            "value" : "Керуйте OnlySwitch з iPhone або iPad, коли обидва пристрої підключені до однієї локальної мережі."
           }
         },
         "zh-Hans" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "当 iPhone 或 iPad 位于同一本地网络时，仅控制这两个设备的切换。"
+            "value" : "当 iPhone 或 iPad 与 Mac 连接到同一局域网时，即可通过 iPhone 或 iPad 控制 OnlySwitch。"
           }
         },
         "zh-Hant" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "當 iPhone 或 iPad 位於同一本地網路時，僅控制這兩個裝置的切換。"
+            "value" : "當 iPhone 或 iPad 與 Mac 連線至同一區域網路時，即可透過 iPhone 或 iPad 控制 OnlySwitch。"
           }
         }
       }
```

---

### Incident Patch 4: `15b161a2` (2026-10-01)
**Commit Message**: bump build version

**File**: `Config/Versions/OnlySwitch.xcconfig` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
 // Shared build number for the macOS app and its embedded components.
-CURRENT_PROJECT_VERSION = 278
+CURRENT_PROJECT_VERSION = 279
```

**File**: `Config/Versions/OnlySwitchRemote.xcconfig` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
 // Independent build number for the iOS remote app.
-CURRENT_PROJECT_VERSION = 10
+CURRENT_PROJECT_VERSION = 11
```

**File**: `OnlySwitch.xcodeproj/project.pbxproj` (modified, +7/-7)
```diff
@@ -406,9 +406,6 @@
 		C0E000000000000000000004 /* RemoteSystemMonitorConfigurationView.swift in Sources */ = {isa = PBXBuildFile; fileRef = C0E000000000000000000024 /* RemoteSystemMonitorConfigurationView.swift */; };
 		C0E000000000000000000005 /* RemoteSystemMonitorConfigurationFeatureTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = C0E000000000000000000025 /* RemoteSystemMonitorConfigurationFeatureTests.swift */; };
 		C0F000000000000000000001 /* RemoteSystemMonitorWaterfallLayout.swift in Sources */ = {isa = PBXBuildFile; fileRef = C0F000000000000000000021 /* RemoteSystemMonitorWaterfallLayout.swift */; };
-		DABA00000000000000000002 /* GlobalSettingsFeature.swift in Sources */ = {isa = PBXBuildFile; fileRef = DABA00000000000000000022 /* GlobalSettingsFeature.swift */; };
-		DABA00000000000000000003 /* GlobalSettingsView.swift in Sources */ = {isa = PBXBuildFile; fileRef = DABA00000000000000000023 /* GlobalSettingsView.swift */; };
-		DABA00000000000000000004 /* RemoteIdleTimerClient.swift in Sources */ = {isa = PBXBuildFile; fileRef = DABA00000000000000000024 /* RemoteIdleTimerClient.swift */; };
 		C1A0B00118E9202600000001 /* PrivilegedOperation.swift in Sources */ = {isa = PBXBuildFile; fileRef = C1A0B00318E9202600000001 /* PrivilegedOperation.swift */; };
 		C1A0B00218E9202600000001 /* PrivilegedOperationTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = C1A0B00418E9202600000001 /* PrivilegedOperationTests.swift */; };
 		C1A0C00118E9202600000001 /* PrivilegedOperation.swift in Sources */ = {isa = PBXBuildFile; fileRef = C1A0B00318E9202600000001 /* PrivilegedOperation.swift */; };
@@ -431,6 +428,9 @@
 		D35C00012F12000100D35C01 /* DesktopPet in Frameworks */ = {isa = PBXBuildFile; productRef = D35C00022F12000100D35C01 /* DesktopPet */; };
 		D35C00042F12000100D35C01 /* DesktopPet in Frameworks */ = {isa = PBXBuildFile; productRef = D35C00032F12000100D35C01 /* DesktopPet */; };
 		D418A0C2EBC2CD7CCD451615 /* SoundMixerService.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1E43EF22E4BA4D2E63E454D7 /* SoundMixerService.swift */; };
+		DABA00000000000000000002 /* GlobalSettingsFeature.swift in Sources */ = {isa = PBXBuildFile; fileRef = DABA00000000000000000022 /* GlobalSettingsFeature.swift */; };
+		DABA00000000000000000003 /* GlobalSettingsView.swift in Sources */ = {isa = PBXBuildFile; fileRef = DABA00000000000000000023 /* GlobalSettingsView.swift */; };
+		DABA00000000000000000004 /* RemoteIdleTimerClient.swift in Sources */ = {isa = PBXBuildFile; fileRef = DABA00000000000000000024 /* RemoteIdleTimerClient.swift */; };
 		F3A300000000000000000020 /* OnlySwitchRemoteApp.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3A300000000000000000010 /* OnlySwitchRemoteApp.swift */; };
 		F3A300000000000000000021 /* RemoteAppFeature.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3A300000000000000000011 /* RemoteAppFeature.swift */; };
 		F3A300000000000000000022 /* RemoteAppView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3A300000000000000000012 /* RemoteAppView.swift */; };
@@ -912,6 +912,7 @@
 		C0E000000000000000000023 /* RemoteSystemMonitorConfigurationFeature.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RemoteSystemMonitorConfigurationFeature.swift; sourceTree = "<group>"; };
 		C0E000000000000000000024 /* RemoteSystemMonitorConfigurationView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RemoteSystemMonitorConfigurationView.swift; sourceTree = "<group>"; };
 		C0E000000000000000000025 /* RemoteSystemMonitorConfigurationFeatureTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RemoteSystemMonitorConfigurationFeatureTests.swift; sourceTree = "<group>"; };
+		C0F000000000000000000021 /* RemoteSystemMonitorWaterfallLayout.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RemoteSystemMonitorWaterfallLayout.swift; sourceTree = "<group>"; };
 		C1A0B00318E9202600000001 /* PrivilegedOperation.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PrivilegedOperation.swift; sourceTree = "<group>"; };
 		C1A0B00418E9202600000001 /* PrivilegedOperationTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PrivilegedOperationTests.swift; sourceTree = "<group>"; };
 		C1A0C10318E9202600000001 /* main.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = main.swift; sourceTree = "<group>"; };
@@ -929,6 +930,9 @@
 		C1A0F00518E9202600000001 /* PrivilegedAccessViewModel.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PrivilegedAccessViewModel.swift; sourceTree = "<group>"; };
 		C1A0F00618E9202600000001 /* PrivilegedAccessView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PrivilegedAccessView.swift; sourceTree = "<group>"; };
 		C1A0F00818E9202600000001 /* PrivilegedAccessViewModelTests.
```

---

### Incident Patch 5: `8afbe4f2` (2026-09-26)
**Commit Message**: fix battery volume position

**File**: `OnlySwitch/Features/SwitchItem/SwitchBar/SwitchBarView.swift` (modified, +0/-1)
```diff
@@ -31,7 +31,6 @@ struct SwitchBarView: View {
             
             if switchOption.switchType == .airPods {
                 AirPodsBatteryView(batteryValues: convertBattery(info: switchOption.info))
-                    .offset(x: 60)
             } else if switchOption.switchType == .pomodoroTimer {
                 TimerCountDownView(ptswitch: switchOption.switchOperator as! PomodoroTimerSwitch)
             }
```

---

### Incident Patch 6: `1934a3f5` (2026-09-25)
**Commit Message**: bump build version

**File**: `Config/Versions/OnlySwitch.xcconfig` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
 // Shared build number for the macOS app and its embedded components.
-CURRENT_PROJECT_VERSION = 275
+CURRENT_PROJECT_VERSION = 276
```

---

### Incident Patch 7: `fdd14523` (2026-09-25)
**Commit Message**: update build version

**File**: `Config/Versions/OnlySwitch.xcconfig` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
 // Shared build number for the macOS app and its embedded components.
-CURRENT_PROJECT_VERSION = 274
+CURRENT_PROJECT_VERSION = 275
```

---

### Incident Patch 8: `68ca29b5` (2026-09-24)
**Commit Message**: fix: localize network detail labels

**File**: `Localization/Localizable.xcstrings` (modified, +16/-0)
```diff
@@ -26774,6 +26774,22 @@
     "%@ model unavailable" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "%@ model unavailable" } } } },
     "%d logical cores" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "%d logical cores" } } } },
     "%d physical cores" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "%d physical cores" } } } },
+    "%d dBm" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "%d dBm" } } } },
+    "%.0f Mbps" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "%.0f Mbps" } } } },
+    "Addresses" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Addresses" } } } },
+    "Down" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Down" } } } },
+    "Hardware address" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Hardware address" } } } },
+    "Interface" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Interface" } } } },
+    "Local IPv4" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Local IPv4" } } } },
+    "Local IPv6" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Local IPv6" } } } },
+    "No active Wi-Fi or Ethernet interface" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "No active Wi-Fi or Ethernet interface" } } } },
+    "Network details unavailable" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Network details unavailable" } } } },
+    "Public IP addresses are retrieved from the ipify service." : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Public IP addresses are retrieved from the ipify service." } } } },
+    "Public IPv4" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Public IPv4" } } } },
+    "Public IPv6" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Public IPv6" } } } },
+    "Signal" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Signal" } } } },
+    "Transmit rate" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Transmit rate" } } } },
+    "Up" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Up" } } } },
     "CPU" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "CPU" } } } },
     "CPU %@" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "CPU %@" } } } },
     "Controls" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Controls" } } } },
```

**File**: `OnlySwitch/Features/SystemMonitor/SystemMonitorPanelView.swift` (modified, +2/-2)
```diff
@@ -449,12 +449,12 @@ struct SystemMonitorPanelView: View {
                 networkDetailRow("Network".localized(), value: ssid)
             }
             if let signalStrength = interface.signalStrength {
-                networkDetailRow("Signal".localized(), value: "\(signalStrength) dBm")
+                networkDetailRow("Signal".localized(), value: "%d dBm".localizedFormat(signalStrength))
             }
             if let transmitRate = interface.transmitRateMbps, transmitRate > 0 {
                 networkDetailRow(
                     "Transmit rate".localized(),
-                    value: String(format: "%.0f Mbps", transmitRate)
+                    value: "%.0f Mbps".localizedFormat(transmitRate)
                 )
             }
             if let macAddress = interface.macAddress {
```

---

### Incident Patch 9: `58632086` (2026-09-24)
**Commit Message**: fix: validate network interface sockaddr lengths

**File**: `OnlySwitch/Features/SystemMonitor/MacSystemMonitorCollector.swift` (modified, +17/-2)
```diff
@@ -295,6 +295,17 @@ enum NetworkDetailsSampler {
     }
 
     private static func numericAddress(_ address: UnsafePointer<sockaddr>) -> String? {
+        let minimumLength: Int
+        switch Int32(address.pointee.sa_family) {
+        case AF_INET:
+            minimumLength = MemoryLayout<sockaddr_in>.size
+        case AF_INET6:
+            minimumLength = MemoryLayout<sockaddr_in6>.size
+        default:
+            return nil
+        }
+        guard Int(address.pointee.sa_len) >= minimumLength else { return nil }
+
         var host = Array(repeating: CChar(0), count: Int(NI_MAXHOST))
         let result = getnameinfo(
             address,
@@ -313,12 +324,16 @@ enum NetworkDetailsSampler {
     private static func macAddress(_ address: UnsafePointer<sockaddr>) -> String? {
         let linkAddress = UnsafeRawPointer(address).assumingMemoryBound(to: sockaddr_dl.self)
         let length = Int(linkAddress.pointee.sdl_alen)
+        let nameLength = Int(linkAddress.pointee.sdl_nlen)
         guard length > 0,
-              let dataOffset = MemoryLayout<sockaddr_dl>.offset(of: \sockaddr_dl.sdl_data)
+              let dataOffset = MemoryLayout<sockaddr_dl>.offset(of: \sockaddr_dl.sdl_data),
+              Int(address.pointee.sa_len) >= dataOffset,
+              nameLength <= Int(address.pointee.sa_len) - dataOffset,
+              length <= Int(address.pointee.sa_len) - dataOffset - nameLength
         else { return nil }
 
         let bytes = UnsafeRawPointer(linkAddress)
-            .advanced(by: dataOffset + Int(linkAddress.pointee.sdl_nlen))
+            .advanced(by: dataOffset + nameLength)
             .assumingMemoryBound(to: UInt8.self)
         return (0 ..< length)
             .map { String(format: "%02X", bytes[$0]) }
```

---

### Incident Patch 10: `c3489cb4` (2026-09-24)
**Commit Message**: fix: classify M3 temperature sensors

**File**: `OnlySwitch/Features/SystemMonitor/MacSystemMonitorCollector.swift` (modified, +17/-7)
```diff
@@ -66,6 +66,13 @@ enum MemoryPressureSampler {
 enum SMCTemperatureCodec {
     private static let sp78 = fourCharacterCode("sp78")
     private static let floatingPoint = fourCharacterCode("flt ")
+    private static let m3CPUKeys: Set<String> = [
+        "Tf04", "Tf09", "Tf0A", "Tf0B", "Tf0D", "Tf0E",
+        "Tf44", "Tf49", "Tf4A", "Tf4B", "Tf4D", "Tf4E"
+    ]
+    private static let m3GPUKeys: Set<String> = [
+        "Tf14", "Tf18", "Tf19", "Tf1A", "Tf24", "Tf28", "Tf29", "Tf2A"
+    ]
 
     static func decode(dataType: UInt32, bytes: [UInt8]) -> Double? {
         switch dataType {
@@ -92,26 +99,29 @@ enum SMCTemperatureCodec {
 
     static func isCPUKey(_ key: String, chipModel: String?) -> Bool {
         if key.hasPrefix("Tp") || key.hasPrefix("Te") { return true }
-        guard key.hasPrefix("Tf"), let chipModel else { return false }
-        return chipModel.range(of: #"\bM3(?:\s|$)"#, options: .regularExpression) != nil
+        return isM3(chipModel) && m3CPUKeys.contains(key)
     }
 
-    static func isGPUKey(_ key: String) -> Bool {
-        key.hasPrefix("Tg")
+    static func isGPUKey(_ key: String, chipModel: String?) -> Bool {
+        key.hasPrefix("Tg") || (isM3(chipModel) && m3GPUKeys.contains(key))
     }
 
     static func isCPUKey(_ key: UInt32, chipModel: String?) -> Bool {
         isCPUKey(string(for: key), chipModel: chipModel)
     }
 
-    static func isGPUKey(_ key: UInt32) -> Bool {
-        isGPUKey(string(for: key))
+    static func isGPUKey(_ key: UInt32, chipModel: String?) -> Bool {
+        isGPUKey(string(for: key), chipModel: chipModel)
     }
 
     private static func fourCharacterCode(_ value: String) -> UInt32 {
         value.utf8.reduce(UInt32(0)) { ($0 << 8) | UInt32($1) }
     }
 
+    private static func isM3(_ chipModel: String?) -> Bool {
+        chipModel?.range(of: #"\bM3(?:\s|$)"#, options: .regularExpression) != nil
+    }
+
     private static func string(for value: UInt32) -> String {
         String(decoding: [
             UInt8((value >> 24) & 0xFF), UInt8((value >> 16) & 0xFF),
@@ -268,7 +278,7 @@ private struct PrivateAppleSiliconMetricsReader {
             guard let key = key(at: index) else { continue }
             let name = Self.string(for: key)
             let isCPU = SMCTemperatureCodec.isCPUKey(name, chipModel: chipModel)
-            let isGPU = SMCTemperatureCodec.isGPUKey(name)
+            let isGPU = SMCTemperatureCodec.isGPUKey(name, chipModel: chipModel)
             guard isCPU || isGPU, let keyInfo = readKeyInfo(key: key) else { continue }
 
             let sensor = TemperatureSensor(
```

**File**: `OnlySwitchTests/SystemMonitor/MacSystemMonitorCollectorTests.swift` (modified, +9/-5)
```diff
@@ -62,16 +62,20 @@ struct MacSystemMonitorCollectorTests {
     func sensorKeySelectionKeepsCPUAndGPUClassesSeparate() {
         let cpuPerformance = fourCharacterCode("Tp0P")
         let cpuEfficiency = fourCharacterCode("Te0P")
-        let cpuFrequency = fourCharacterCode("Tf0P")
+        let m3CPU = fourCharacterCode("Tf04")
+        let m3GPU = fourCharacterCode("Tf14")
         let gpu = fourCharacterCode("Tg0P")
 
         #expect(SMCTemperatureCodec.isCPUKey(cpuPerformance, chipModel: "Apple M4 Max"))
         #expect(SMCTemperatureCodec.isCPUKey(cpuEfficiency, chipModel: "Apple M4 Max"))
-        #expect(SMCTemperatureCodec.isCPUKey(cpuFrequency, chipModel: "Apple M3 Max"))
-        #expect(SMCTemperatureCodec.isCPUKey(cpuFrequency, chipModel: "Apple M4 Max") == false)
+        #expect(SMCTemperatureCodec.isCPUKey(m3CPU, chipModel: "Apple M3 Max"))
+        #expect(SMCTemperatureCodec.isCPUKey(m3GPU, chipModel: "Apple M3 Max") == false)
+        #expect(SMCTemperatureCodec.isCPUKey(m3CPU, chipModel: "Apple M4 Max") == false)
         #expect(SMCTemperatureCodec.isCPUKey(gpu, chipModel: "Apple M4 Max") == false)
-        #expect(SMCTemperatureCodec.isGPUKey(gpu))
-        #expect(SMCTemperatureCodec.isGPUKey(cpuPerformance) == false)
+        #expect(SMCTemperatureCodec.isGPUKey(m3GPU, chipModel: "Apple M3 Max"))
+        #expect(SMCTemperatureCodec.isGPUKey(m3CPU, chipModel: "Apple M3 Max") == false)
+        #expect(SMCTemperatureCodec.isGPUKey(gpu, chipModel: "Apple M4 Max"))
+        #expect(SMCTemperatureCodec.isGPUKey(cpuPerformance, chipModel: "Apple M4 Max") == false)
     }
 
     @Test
```

---

### Incident Patch 11: `a34136e6` (2026-09-24)
**Commit Message**: Fix Apple Silicon temperatures and dark monitor contrast

**File**: `OnlySwitch/Features/SystemMonitor/MacSystemMonitorCollector.swift` (modified, +181/-45)
```diff
@@ -59,36 +59,118 @@ enum MemoryPressureSampler {
     }
 }
 
-/// Reads Apple Silicon GPU counters exposed through undocumented IOKit services.
+/// Decodes the SMC temperature payload formats used by Apple Silicon Macs.
+///
+/// Keeping byte decoding and key classification separate from the private IOKit transport makes
+/// the most failure-prone part of the integration deterministic and testable.
+enum SMCTemperatureCodec {
+    private static let sp78 = fourCharacterCode("sp78")
+    private static let floatingPoint = fourCharacterCode("flt ")
+
+    static func decode(dataType: UInt32, bytes: [UInt8]) -> Double? {
+        switch dataType {
+        case sp78:
+            guard bytes.count >= 2 else { return nil }
+            let raw = Int16(bitPattern: (UInt16(bytes[0]) << 8) | UInt16(bytes[1]))
+            return Double(raw) / 256
+        case floatingPoint:
+            guard bytes.count >= 4 else { return nil }
+            let bitPattern = UInt32(bytes[0])
+                | (UInt32(bytes[1]) << 8)
+                | (UInt32(bytes[2]) << 16)
+                | (UInt32(bytes[3]) << 24)
+            let value = Double(Float(bitPattern: bitPattern))
+            return value.isFinite ? value : nil
+        default:
+            return nil
+        }
+    }
+
+    static func isPlausible(_ celsius: Double) -> Bool {
+        celsius.isFinite && (10 ..< 125).contains(celsius)
+    }
+
+    static func isCPUKey(_ key: String, chipModel: String?) -> Bool {
+        if key.hasPrefix("Tp") || key.hasPrefix("Te") { return true }
+        guard key.hasPrefix("Tf"), let chipModel else { return false }
+        return chipModel.range(of: #"\bM3(?:\s|$)"#, options: .regularExpression) != nil
+    }
+
+    static func isGPUKey(_ key: String) -> Bool {
+        key.hasPrefix("Tg")
+    }
+
+    static func isCPUKey(_ key: UInt32, chipModel: String?) -> Bool {
+        isCPUKey(string(for: key), chipModel: chipModel)
+    }
+
+    static func isGPUKey(_ key: UInt32) -> Bool {
+        isGPUKey(string(for: key))
+    }
+
+    private static func fourCharacterCode(_ value: String) -> UInt32 {
+        value.utf8.reduce(UInt32(0)) { ($0 << 8) | UInt32($1) }
+    }
+
+    private static func string(for value: UInt32) -> String {
+        String(decoding: [
+            UInt8((value >> 24) & 0xFF), UInt8((value >> 16) & 0xFF),
+            UInt8((value >> 8) & 0xFF), UInt8(value & 0xFF)
+        ], as: UTF8.self)
+    }
+}
+
+/// Reads Apple Silicon GPU counters and CPU/GPU sensors exposed through undocumented IOKit services.
 ///
 /// `AGXAccelerator`'s `PerformanceStatistics`, `gpu-core-count`, and the AppleSMC user client
 /// are implementation details rather than supported macOS APIs. They are intentionally confined
 /// to this type, only used on Apple Silicon, and treated as optional so an OS or hardware change
 /// cannot affect monitor availability or process stability. This path is unsuitable for Mac App
 /// Store distribution without separately validating Apple's current review policy.
-private struct PrivateAppleSiliconGPUReader {
+private struct PrivateAppleSiliconMetricsReader {
     struct Reading {
         let usage: Double?
-        let temperatureCelsius: Double?
+        let cpuTemperatureCelsius: Double?
+        let gpuTemperatureCelsius: Double?
+    }
+
+    private struct TemperatureSensor {
+        let key: UInt32
+        let name: String
+        let dataType: UInt32
+        let dataSize: UInt32
+    }
+
+    private struct TemperatureSensors {
+        let cpu: [TemperatureSensor]
+        let gpu: [TemperatureSensor]
     }
 
     private static let maximumSensorKeys = 4_096
     private var smcConnection: io_connect_t = IO_OBJECT_NULL
-    private var gpuTemperatureKeys: [UInt32]?
-
-    mutating func sample() -> Reading {
-        guard Self.isAppleSilicon else { return Reading(usage: nil, temperatureCelsius: nil) }
+    private var temperatureSensors: TemperatureSensors?
+
+    mutating func sample(chipModel: String?) -> Reading {
+        guard Self.isAppleSilicon else {
+            return Reading(
+                usage: nil,
+                cpuTemperatureCelsius: nil,
+                gpuTemperatureCelsius: nil
+            )
+        }
+        let temperatures = readTemperatures(chipModel: chipModel)
         return Reading(
             usage: Self.readUsage(),
-            temperatureCelsius: readTemperature()
+            cpuTemperatureCelsius: temperatures.cpu,
+            gpuTemperatureCelsius: temperatures.gpu
         )
     }
 
     mutating func close() {
         guard smcConnection != IO_OBJECT_NULL else { return }
         IOServiceClose(smcConnection)
         smcConnection = IO_OBJECT_NULL
-        gpuTemperatureKeys = nil
+        temperatureSensors = nil
     }
 
     static func coreCount() -> Int? {
@@ -149,16 +231,22 @@ private struct PrivateAppleSiliconGPUReader {
         return nil
     }
 
-    private mutating func readTemperature() -> Double? {

```

**File**: `OnlySwitch/Features/SystemMonitor/SystemMonitorPanelView.swift` (modified, +28/-6)
```diff
@@ -70,9 +70,24 @@ enum SystemMonitorMemoryPressurePresentation {
 }
 
 struct SystemMonitorSectionBar: View {
+    @Environment(\.colorScheme) private var colorScheme
     let sections: [SectionBar.Section]
     @Binding var selection: SectionBar.Section
 
+    private var selectedForeground: Color {
+        colorScheme == .dark ? .white : .primary
+    }
+
+    private var selectedFill: Color {
+        colorScheme == .dark
+            ? Color(red: 0.05, green: 0.38, blue: 0.76).opacity(0.82)
+            : Color.accentColor.opacity(0.18)
+    }
+
+    private var selectedStroke: Color {
+        colorScheme == .dark ? .white.opacity(0.34) : Color.accentColor.opacity(0.38)
+    }
+
     var body: some View {
         HStack(spacing: 4) {
             ForEach(sections, id: \.self) { section in
@@ -86,14 +101,14 @@ struct SystemMonitorSectionBar: View {
                     .contentShape(Rectangle())
                 }
                 .buttonStyle(.plain)
-                .foregroundStyle(selection == section ? .primary : .secondary)
+                .foregroundStyle(selection == section ? selectedForeground : .secondary)
                 .background {
                     Capsule()
-                        .fill(selection == section ? Color.accentColor.opacity(0.18) : .clear)
+                        .fill(selection == section ? selectedFill : .clear)
                         .overlay {
                             Capsule()
                                 .strokeBorder(
-                                    selection == section ? Color.accentColor.opacity(0.32) : .clear,
+                                    selection == section ? selectedStroke : .clear,
                                     lineWidth: 1
                                 )
                         }
@@ -133,6 +148,7 @@ struct SystemMonitorPanelContainer: View {
 }
 
 struct SystemMonitorPanelView: View {
+    @Environment(\.colorScheme) private var colorScheme
     let store: StoreOf<SystemMonitorReducer>
     @State private var preferences = Preferences.shared.systemMonitorPreferences
 
@@ -175,6 +191,12 @@ struct SystemMonitorPanelView: View {
         SystemMonitorMetric.allCases.filter(preferences.enabledPanelMetrics.contains)
     }
 
+    private var processorAccent: Color {
+        colorScheme == .dark
+            ? Color(red: 0.20, green: 0.68, blue: 1)
+            : .accentColor
+    }
+
     @ViewBuilder
     private func metricCard(
         _ metric: SystemMonitorMetric,
@@ -224,7 +246,7 @@ struct SystemMonitorPanelView: View {
         @ViewBuilder content: (Double) -> Content
     ) -> some View {
         VStack(alignment: .leading, spacing: 10) {
-            metricHeader(title, symbolName: symbolName, tint: .accentColor)
+            metricHeader(title, symbolName: symbolName, tint: processorAccent)
             processorDetails(processor, metricName: title)
             switch availability {
             case let .available(value):
@@ -250,10 +272,10 @@ struct SystemMonitorPanelView: View {
                     .foregroundStyle(.secondary)
             }
             ProgressView(value: usage)
-                .tint(.accentColor)
+                .tint(processorAccent)
             SystemMonitorChartView(
                 points: history,
-                tint: .accentColor,
+                tint: processorAccent,
                 accessibilityLabel: "Usage history".localized(),
                 valueDescription: SystemMonitorFormatter.percentage
             )
```

---

### Incident Patch 12: `775ce78f` (2026-09-24)
**Commit Message**: Fix system monitor process names

**File**: `OnlySwitch/Features/SystemMonitor/MacSystemMonitorCollector.swift` (modified, +27/-6)
```diff
@@ -682,16 +682,37 @@ private extension MacSystemMonitorCollector {
         }
 
         var nameBuffer = Array(repeating: CChar(0), count: Int(MAXCOMLEN) + 1)
-        let nameLength = proc_name(pid, &nameBuffer, UInt32(nameBuffer.count))
-        guard nameLength > 0 else { return nil }
+        let nameLength = nameBuffer.withUnsafeMutableBufferPointer { buffer in
+            guard let baseAddress = buffer.baseAddress else { return Int32(0) }
+            return proc_name(pid, baseAddress, UInt32(buffer.count))
+        }
 
-        return ProcessCounters(
-            cpuNanoseconds: values.cpuNanoseconds,
-            residentBytes: values.residentBytes,
-            name: String(
+        let name: String
+        if nameLength > 0 {
+            name = String(
                 decoding: nameBuffer.prefix(Int(nameLength)).map { UInt8(bitPattern: $0) },
                 as: UTF8.self
             )
+        } else {
+            var pathBuffer = Array(repeating: CChar(0), count: Int(MAXPATHLEN) * 4)
+            let pathLength = pathBuffer.withUnsafeMutableBufferPointer { buffer in
+                guard let baseAddress = buffer.baseAddress else { return Int32(0) }
+                return proc_pidpath(pid, baseAddress, UInt32(buffer.count))
+            }
+            if pathLength > 0 {
+                let executableName = URL(fileURLWithPath: String(cString: pathBuffer)).lastPathComponent
+                name = executableName.isEmpty ? "Process \(pid)" : executableName
+            } else {
+                // Keep otherwise valid resource counters visible even when macOS withholds the
+                // process name and path for a protected process.
+                name = "Process \(pid)"
+            }
+        }
+
+        return ProcessCounters(
+            cpuNanoseconds: values.cpuNanoseconds,
+            residentBytes: values.residentBytes,
+            name: name
         )
     }
 }
```

---

### Incident Patch 13: `430f8adc` (2026-09-24)
**Commit Message**: Fix AirPods battery header layout

**File**: `OnlySwitch/Features/OnlyControl/OnlyControlView.swift` (modified, +18/-15)
```diff
@@ -137,25 +137,28 @@ struct OnlyControlView: View {
     }
 
     private var controlHeader: some View {
-        HStack(alignment: .bottom) {
-            Text(currentDate, style: .time)
-                .font(.system(size: 60, weight: .bold, design: .rounded))
-                .foregroundStyle(colorScheme == .dark ? .white : .black)
-                .onReceive(timer) { _ in
-                    currentDate = Date()
-                }
+        VStack(alignment: .leading, spacing: 4) {
+            HStack(alignment: .bottom, spacing: 16) {
+                Text(currentDate, style: .time)
+                    .font(.system(size: 60, weight: .bold, design: .rounded))
+                    .foregroundStyle(colorScheme == .dark ? .white : .black)
+                    .layoutPriority(1)
+                    .onReceive(timer) { _ in
+                        currentDate = Date()
+                    }
 
-            if store.isAirPodsConnected && !store.airPodsBatteryValues.isEmpty {
-                AirPodsBatteryView(batteryValues: store.airPodsBatteryValues)
+                Spacer(minLength: 16)
+
+                TimerCountDownView(ptswitch: PomodoroTimerSwitch.shared, showImage: true)
+                    .font(.system(size: 20, weight: .bold, design: .rounded))
                     .padding(.bottom, 8)
-                    .padding(.leading, 24)
             }
 
-            Spacer(minLength: 16)
-
-            TimerCountDownView(ptswitch: PomodoroTimerSwitch.shared, showImage: true)
-                .font(.system(size: 20, weight: .bold, design: .rounded))
-                .padding(.bottom, 8)
+            if store.isAirPodsConnected && !store.airPodsBatteryValues.isEmpty {
+                AirPodsBatteryView(batteryValues: store.airPodsBatteryValues)
+                    .fixedSize(horizontal: true, vertical: false)
+                    .accessibilityLabel("AirPods battery levels".localized())
+            }
         }
         .frame(maxWidth: .infinity, alignment: .leading)
     }
```

**File**: `OnlySwitch/Features/SwitchItem/SwitchBar/AirPodsBatteryView.swift` (modified, +8/-9)
```diff
@@ -30,31 +30,30 @@ struct AirPodsBatteryView: View {
         HStack(spacing: 8) {
             ForEach(batteryValues.indices, id:\.self) { index in
                 HStack(spacing: 4) {
-                    ZStack{
+                    ZStack {
                         Circle()
-                            .foregroundColor(.gray)
+                            .foregroundStyle(.gray)
                             .frame(width: 10, height: 10)
                         Text(batteryText[index])
                             .font(.system(size:7))
-                            .foregroundColor(.white)
+                            .foregroundStyle(.white)
                     }
                     
                     HStack {
                         Rectangle()
-                            .foregroundColor(batteryColor(for: batteryValues[index]))
+                            .foregroundStyle(batteryColor(for: batteryValues[index]))
                             .frame(width: CGFloat(batteryValues[index]) * viewWidth, height: viewHeight)
                         Spacer()
                             .frame(width: ((1.0 - CGFloat(batteryValues[index])) * viewWidth))
                     }
                     .frame(width: viewWidth, height: viewHeight)
-                  .overlay(RoundedRectangle(cornerRadius: 2).stroke(colorScheme == .dark ? .white : .black, lineWidth: 1))
-                  .overlay(Text("\(Int(batteryValues[index] * 100))%")
-                            .font(.system(size:6)).fontWeight(.medium))
+                    .overlay(RoundedRectangle(cornerRadius: 2).stroke(colorScheme == .dark ? .white : .black, lineWidth: 1))
+                    .overlay(Text("\(Int(batteryValues[index] * 100))%")
+                        .font(.system(size: 6).weight(.medium)))
                 }
-                
             }
         }
-        .frame(width: viewWidth)
+        .fixedSize(horizontal: true, vertical: false)
     }
 }
 
```

---

### Incident Patch 14: `76d6402b` (2026-09-24)
**Commit Message**: fix list height

**File**: `OnlySwitch/Features/OnlySwitchList/OnlySwitchListView.swift` (modified, +1/-1)
```diff
@@ -114,7 +114,7 @@ struct OnlySwitchListView: View {
         .onChange(of: sections) { _ in
             reconcileSectionSelection()
         }
-        .frame(width: listWidth , height: scrollViewHeight + (switchVM.showAds ? 172 : 132))
+        .frame(width: listWidth , height: scrollViewHeight + (switchVM.showAds ? 184 : 144))
     }
     
     var singleSwitchList: some View {
```

---

### Incident Patch 15: `e8e4e7f6` (2026-09-24)
**Commit Message**: fix: coordinate system monitor background sampling

**File**: `Modules/Sources/SystemMonitor/SystemMonitorReducer.swift` (modified, +1/-10)
```diff
@@ -5,7 +5,6 @@ public struct SystemMonitorReducer {
     @ObservableState
     public struct State: Equatable {
         public var isVisible = false
-        public var enabledMenuBarMetrics: Set<SystemMonitorMetric> = []
         public var expandedMetrics: Set<SystemMonitorMetric> = []
         public var snapshot: SystemMonitorSnapshot?
         public var history = SystemMonitorHistory()
@@ -14,15 +13,13 @@ public struct SystemMonitorReducer {
 
         public init(
             isVisible: Bool = false,
-            enabledMenuBarMetrics: Set<SystemMonitorMetric> = [],
             expandedMetrics: Set<SystemMonitorMetric> = [],
             snapshot: SystemMonitorSnapshot? = nil,
             history: SystemMonitorHistory = SystemMonitorHistory(),
             lastFailure: String? = nil,
             isSampling: Bool = false
         ) {
             self.isVisible = isVisible
-            self.enabledMenuBarMetrics = enabledMenuBarMetrics
             self.expandedMetrics = expandedMetrics
             self.snapshot = snapshot
             self.history = history
@@ -31,13 +28,12 @@ public struct SystemMonitorReducer {
         }
 
         var requiresSampling: Bool {
-            isVisible || enabledMenuBarMetrics.isEmpty == false
+            isVisible
         }
     }
 
     public enum Action: Equatable {
         case visibilityChanged(Bool)
-        case menuBarMetricsChanged(Set<SystemMonitorMetric>)
         case toggleExpandedMetric(SystemMonitorMetric)
         case snapshotReceived(SystemMonitorSnapshot)
         case streamFailed(String)
@@ -58,11 +54,6 @@ public struct SystemMonitorReducer {
                 state.isVisible = isVisible
                 return samplingEffect(wasSampling: wasSampling, state: &state)
 
-            case let .menuBarMetricsChanged(metrics):
-                let wasSampling = state.requiresSampling
-                state.enabledMenuBarMetrics = metrics
-                return samplingEffect(wasSampling: wasSampling, state: &state)
-
             case let .toggleExpandedMetric(metric):
                 guard metric.supportsDisclosure else { return .none }
 
```

**File**: `OnlySwitch/Features/SystemMonitor/SystemMonitorPanelView.swift` (modified, +0/-2)
```diff
@@ -140,7 +140,6 @@ struct SystemMonitorPanelView: View {
         }
         .padding(15)
         .onAppear {
-            store.send(.menuBarMetricsChanged(preferences.menuBarMetrics))
             store.send(.visibilityChanged(true))
         }
         .onDisappear {
@@ -149,7 +148,6 @@ struct SystemMonitorPanelView: View {
         .onReceive(NotificationCenter.default.publisher(for: .systemMonitorPreferencesChanged)) { notification in
             guard let updated = notification.object as? SystemMonitorPreferences else { return }
             preferences = updated
-            store.send(.menuBarMetricsChanged(updated.menuBarMetrics))
         }
     }
 
```

**File**: `OnlySwitch/Features/SystemMonitor/SystemMonitorStatusItemController.swift` (modified, +40/-15)
```diff
@@ -22,42 +22,52 @@ protocol SystemMonitorStatusItemFactory: AnyObject {
 @MainActor
 final class SystemMonitorStatusItemController {
     private let factory: any SystemMonitorStatusItemFactory
-    private let client: SystemMonitorClient
+    private let clientFactory: @Sendable (TimeInterval) -> SystemMonitorClient
     private let onClick: @MainActor () -> Void
     private var items: [SystemMonitorMetric: any SystemMonitorStatusItemHandle] = [:]
+    private var enabledMetrics: Set<SystemMonitorMetric> = []
+    private var refreshInterval: TimeInterval?
     private var latestSnapshot: SystemMonitorSnapshot?
     private var samplingTask: Task<Void, Never>?
     private var samplingGeneration = 0
 
     init(
         factory: any SystemMonitorStatusItemFactory = AppKitSystemMonitorStatusItemFactory(),
-        client: SystemMonitorClient = MacSystemMonitorCollector.liveClient(),
+        clientFactory: @escaping @Sendable (TimeInterval) -> SystemMonitorClient = {
+            MacSystemMonitorCollector.liveClient(refreshInterval: $0)
+        },
         onClick: @escaping @MainActor () -> Void = {}
     ) {
         self.factory = factory
-        self.client = client
+        self.clientFactory = clientFactory
         self.onClick = onClick
     }
 
+    convenience init(
+        factory: any SystemMonitorStatusItemFactory,
+        client: SystemMonitorClient,
+        onClick: @escaping @MainActor () -> Void = {}
+    ) {
+        self.init(factory: factory, clientFactory: { _ in client }, onClick: onClick)
+    }
+
     func apply(_ preferences: SystemMonitorPreferences) {
         let selectedMetrics = preferences.menuBarMetrics
+        let metricsChanged = selectedMetrics != enabledMetrics
+        let intervalChanged = refreshInterval != preferences.refreshInterval
+        enabledMetrics = selectedMetrics
+        refreshInterval = preferences.refreshInterval
 
-        for metric in SystemMonitorMetric.allCases where !selectedMetrics.contains(metric) {
-            guard let item = items.removeValue(forKey: metric) else { continue }
-            item.remove()
-        }
-
-        for metric in SystemMonitorMetric.allCases where selectedMetrics.contains(metric) {
-            guard items[metric] == nil else { continue }
-            let item = factory.makeStatusItem(for: metric)
-            item.setAction(onClick)
-            item.update(Self.presentation(for: metric, snapshot: latestSnapshot))
-            items[metric] = item
+        if metricsChanged {
+            rebuildItems(for: selectedMetrics)
         }
 
         if items.isEmpty {
             stopSampling()
         } else {
+            if intervalChanged {
+                stopSampling()
+            }
             startSamplingIfNeeded()
         }
     }
@@ -78,11 +88,26 @@ final class SystemMonitorStatusItemController {
 }
 
 private extension SystemMonitorStatusItemController {
+    func rebuildItems(for selectedMetrics: Set<SystemMonitorMetric>) {
+        for item in items.values {
+            item.remove()
+        }
+        items.removeAll(keepingCapacity: true)
+
+        for metric in SystemMonitorMetric.allCases where selectedMetrics.contains(metric) {
+            let item = factory.makeStatusItem(for: metric)
+            item.setAction(onClick)
+            item.update(Self.presentation(for: metric, snapshot: latestSnapshot))
+            items[metric] = item
+        }
+    }
+
     func startSamplingIfNeeded() {
         guard samplingTask == nil else { return }
+        guard let refreshInterval else { return }
         samplingGeneration += 1
         let generation = samplingGeneration
-        let client = client
+        let client = clientFactory(refreshInterval)
 
         samplingTask = Task { @MainActor [weak self] in
             do {
```

**File**: `OnlySwitch/StatusBar/StatusBarController.swift` (modified, +0/-3)
```diff
@@ -93,9 +93,6 @@ class StatusBarController {
 
         let monitorPreferences = Preferences.shared.systemMonitorPreferences
         systemMonitorStatusItems = SystemMonitorStatusItemController(
-            client: MacSystemMonitorCollector.liveClient(
-                refreshInterval: monitorPreferences.refreshInterval
-            ),
             onClick: { [weak self] in
                 self?.togglePopover(sender: nil)
             }
```

**File**: `OnlySwitchTests/SystemMonitor/SystemMonitorStatusItemControllerTests.swift` (modified, +96/-8)
```diff
@@ -21,21 +21,29 @@ struct SystemMonitorStatusItemControllerTests {
     }
 
     @Test
-    func applyingNewPreferencesRemovesDeselectedItemsAndKeepsExistingItems() {
-        let factory = RecordingSystemMonitorStatusItemFactory()
+    func incrementalPreferenceChangesRebuildTheSameCanonicalOrderAsColdLaunch() {
+        let incrementalFactory = RecordingSystemMonitorStatusItemFactory()
         let controller = SystemMonitorStatusItemController(
-            factory: factory,
+            factory: incrementalFactory,
             client: .finished
         )
         controller.apply(.init(menuBarMetrics: [.cpu, .network]))
-        let originalNetworkItem = factory.items[.network]
+        let originalCPUItem = incrementalFactory.items[.cpu]
+        let originalNetworkItem = incrementalFactory.items[.network]
 
         controller.apply(.init(menuBarMetrics: [.memory, .network]))
 
-        #expect(factory.createdMetrics == [.cpu, .network, .memory])
-        #expect(factory.items[.cpu]?.removeCount == 1)
-        #expect(factory.items[.network] === originalNetworkItem)
-        #expect(factory.items[.network]?.removeCount == 0)
+        let coldFactory = RecordingSystemMonitorStatusItemFactory()
+        let coldController = SystemMonitorStatusItemController(
+            factory: coldFactory,
+            client: .finished
+        )
+        coldController.apply(.init(menuBarMetrics: [.memory, .network]))
+
+        #expect(originalCPUItem?.removeCount == 1)
+        #expect(originalNetworkItem?.removeCount == 1)
+        #expect(Array(incrementalFactory.createdMetrics.suffix(2)) == coldFactory.createdMetrics)
+        #expect(coldFactory.createdMetrics == [.memory, .network])
     }
 
     @Test
@@ -100,6 +108,51 @@ struct SystemMonitorStatusItemControllerTests {
         #expect(factory.items[.cpu]?.removeCount == 1)
         #expect(factory.items[.disk]?.removeCount == 1)
     }
+
+    @Test
+    func metricChangesKeepOneUpstreamAndDisablingTheLastItemCancelsIt() async {
+        let factory = RecordingSystemMonitorStatusItemFactory()
+        let clients = RecordingMonitorClientFactory()
+        let controller = SystemMonitorStatusItemController(
+            factory: factory,
+            clientFactory: clients.makeClient(refreshInterval:)
+        )
+
+        controller.apply(.init(menuBarMetrics: [.cpu]))
+        await Task.yield()
+        controller.apply(.init(menuBarMetrics: [.cpu, .network]))
+        await Task.yield()
+
+        #expect(clients.streamStartCount == 1)
+
+        controller.apply(.init(menuBarMetrics: []))
+        for _ in 0..<10 where clients.terminationCount == 0 {
+            await Task.yield()
+        }
+
+        #expect(clients.terminationCount == 1)
+    }
+
+    @Test
+    func changingRefreshIntervalRestartsTheUpstreamWithTheNewInterval() async {
+        let factory = RecordingSystemMonitorStatusItemFactory()
+        let clients = RecordingMonitorClientFactory()
+        let controller = SystemMonitorStatusItemController(
+            factory: factory,
+            clientFactory: clients.makeClient(refreshInterval:)
+        )
+
+        controller.apply(.init(menuBarMetrics: [.cpu], refreshInterval: 1))
+        await Task.yield()
+        controller.apply(.init(menuBarMetrics: [.cpu], refreshInterval: 2))
+        for _ in 0..<10 where clients.streamStartCount < 2 {
+            await Task.yield()
+        }
+
+        #expect(clients.requestedIntervals == [1, 2])
+        #expect(clients.streamStartCount == 2)
+        #expect(clients.terminationCount == 1)
+    }
 }
 
 @MainActor
@@ -145,3 +198,38 @@ private extension SystemMonitorClient {
         }
     }
 }
+
+private final class RecordingMonitorClientFactory: @unchecked Sendable {
+    private let lock = NSLock()
+    private var intervals: [TimeInterval] = []
+    private var starts = 0
+    private var terminations = 0
+
+    var requestedIntervals: [TimeInterval] {
+        lock.withLock { intervals }
+    }
+
+    var streamStartCount: Int {
+        lock.withLock { starts }
+    }
+
+    var terminationCount: Int {
+        lock.withLock { terminations }
+    }
+
+    func makeClient(refreshInterval: TimeInterval) -> SystemMonitorClient {
+        lock.withLock { intervals.append(refreshInterval) }
+        return SystemMonitorClient { [weak self] in
+            guard let self else {
+                return AsyncThrowingStream { $0.finish() }
+            }
+            self.lock.withLock { self.starts += 1 }
+            return AsyncThrowingStream { continuation in
+                continuation.onTermination = { [weak self] _ in
+                    guard let self else { return }
+                    self.lock.withLock { self.terminations += 1 }
+                }
+            }
+        }
+    }
+}
```

#### Recent Merged Pull Requests:
- **PR #221** (2026-09-24): Add settings export/import (Backup section) (@oecer)
- **PR #219** (2026-09-19): Revise OnlyRemote section in README.md (@jacklandrin)
- **PR #217** (2026-09-15): docs: explain how to restore the OnlySwitch menu bar icon (@mvanhorn)
- **PR #215** (2026-08-11): Fix Show List shortcut being treated as a right-click (@EhsanAzish80)
- **PR #213** (2026-08-10): feat: add a per-app sound mixer switch (@lou1s19)
- **PR #211** (2026-07-13): Add Desktop Pet feature information to README (@jacklandrin)
- **PR #209** (2026-07-12): docs: add TakoAPI directory badge (@oratis)
- **PR #207** (2026-07-12): feat: sync external monitor brightness via DDC/CI (F1/F2 follows on all displays) (@lou1s19)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
