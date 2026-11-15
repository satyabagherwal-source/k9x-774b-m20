# Verification Protocol: Verification Protocol: Empirical Defect Shield for jacklandrin-onlyswitch-learnings

<!-- PROVENANCE_START
{
  "source_repository": "jacklandrin-onlyswitch-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T17:04:42.698Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-jacklandrin-onlyswitch-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [jacklandrin-onlyswitch-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T17:04:42.698Z`  
> **Learning ID**: `LEARN-EVO-jacklandrin-onlyswitch-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `jacklandrin-onlyswitch-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/jacklandrin-onlyswitch-learnings.md`  
> **Source**: github ([https://github.com/jacklandrin/OnlySwitch](https://github.com/jacklandrin/OnlySwitch))  
> **Source Version**: `ff711c47`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-15T17:03:56.127Z  
> **Learning ID**: `learn-github-jacklandrin-onlyswitch`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): jacklandrin/OnlySwitch

> **Canonical Artifact**: `07_PROJECT_LEARNING/jacklandrin-onlyswitch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jacklandrin/OnlySwitch](https://github.com/jacklandrin/OnlySwitch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-15T17:03:56.116Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jacklandrin/OnlySwitch`
- **Description**: 👑 The all-in-one macOS menu bar companion: customizable controls, system monitor, AI Agent, Shortcuts, widgets, remote control, and more.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6058 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Modules/Sources/AppFeature/CoreData/EvolutionCommandEntityLive.swift`
```
//
//  EvolutionCommandEntityLive.swift
//  OnlySwitch
//
//  Created by Jacklandrin on 2024/6/9.
//

import Extensions
import Foundation
import Switches
import OnlySwitchPersistence
import PrivilegedHelperCore

extension EvolutionCommandEntity {
    @MainActor static func backupCommands() throws -> [[String: String]] {
        try fetchResult().map { entity in
            var command: [String: String] = [:]
            for key in EvolutionBackup.commandKeys {
                switch entity.value(forKey: key) {
                case let uuid as UUID: command[key] = uuid.uuidString
                case let string as String: command[key] = string
                default: break
                }
            }
            return command
        }
    }

    /// Stores commands without running them. The privileged operation is re-derived from the
    /// compiled allowlist, so an imported file can't grant itself privileged-helper access.
    static func restore(_ commands: [[String: String]]) throws {
        try PersistenceController.shared.requireStore()
        for command in commands {
            guard
                let id = command["id"].flatMap(UUID.init(uuidString:)),
                let name = command["name"], !name.isEmpty,
                let controlType = command["itemType"].flatMap(ControlType.init(rawValue:))
            else {
                continue
            }
            let entity = try fetchRequest(by: id) ?? EvolutionCommandEntity(context: context)
            for key in EvolutionBackup.commandKeys where key != "id" && key != "privilegedOperationIdentifier" {
                entity.setValue(command[key], forKey: key)
            }
            entity.id = id
            entity.privilegedOperationIdentifier = EvolutionItem.trustedPrivilegedOperation(
                id: id,
                controlType: controlType,
                requestedOperation: command["privilegedOperationIdentifier"].flatMap(PrivilegedOperation.init(rawValue:))
            )?.rawValue
            entity.timestamp = Date()
        }
        if context.hasChanges {
            try context.save()
        }
    }

    static func addItem(item: EvolutionItem) throws {
        try PersistenceController.shared.requireStore()
        let entity = try EvolutionCommandEntity.fetchRequest(by: item.id) ?? EvolutionCommandEntity(context: context)

        if item.controlType == .Button {
            guard
                let singleCommand = item.singleCommand?.commandString,
                !singleCommand.isEmpty,
                let singleCommandTypeStr = item.singleCommand?.executeType.rawValue,
                item.singleCommand?.debugStatus == .success else {
                    context.reset()
                    throw EvolutionError.wrongCommand
                }
            entity.singleCommand = singleCommand
            entity.singleCommandType = singleCommandTypeStr

            entity.turnOnCommand = ""
            entity.turnOnCommandType = CommandExecuteType.shell.rawValue

            entity.turnOffCommand = ""
            entity.turnOffCommandType = CommandExecuteType.shell.rawValue

            entity.statusCommand = ""
            entity.statusCommandType = CommandExecuteType.shell.rawValue

            entity.trueCondition = ""

        } else {
            guard
                let onCommand = item.onCommand?.commandString,
                !onCommand.isEmpty,
                let onCommandTypeStr = item.onCommand?.executeType.rawValue,
                item.onCommand?.debugStatus == .success else {
                context.reset()
                throw EvolutionError.wrongCommand
            }
            entity.turnOnCommand = onCommand
            entity.turnOnCommandType = onCommandTypeStr

            guard
                let offCommand = item.offCommand?.commandString,
                !offCommand.isEmpty,
                let offCommandTypeStr = item.offCommand?.executeType.rawValue,
                item.offCommand?.debugStatus == .success else {
                context.reset()
                throw EvolutionError.wrongCommand
            }

            entity.turnOffCommand = offCommand
            entity.turnOffCommandType = offCommandTypeStr

            guard
                let statusCommand = item.statusCommand?.commandString,
                !statusCommand.isEmpty,
                let statusCommandTypeStr = item.statusCommand?.executeType.rawValue,
                let trueCondition = item.statusCommand?.trueCondition else {
                context.reset()
                throw EvolutionError.wrongCommand
            }
            entity.statusCommand = statusCommand
            entity.statusCommandType = statusCommandTypeStr
            entity.trueCondition = trueCondition

            entity.singleCommand = ""
            entity.singleCommandType = CommandExecuteType.shell.rawValue
        }

        if let iconName = item.iconName {
            entity.iconName = iconName
        }

        entity.name = item.name
        entity.itemType = item.controlType.rawValue
        entity.privilegedOperationIdentifier = EvolutionItem.trustedPrivilegedOperation(
            id: item.id,
            controlType: item.controlType,
            requestedOperation: item.privilegedOperation
        )?.rawValue
        entity.timestamp = Date()
        entity.id = item.id


        try context.save()
    }

    static func updateIcon(name: String, by id: UUID) throws {
        try PersistenceController.shared.requireStore()
        let entity = try EvolutionCommandEntity.fetchRequest(by: id)
        guard let entity else {
            throw EvolutionError.noneEntity
        }
        entity.iconName = name
        try context.save()
    }

    static func removeItem(by id: UUID) throws {
        try PersistenceController.shared.requireStore()
        guard let entity = try fetchRequest(by: id) else {
            throw EvolutionError.deleteFailed
        }

        context.delete(entity)
        try context.save()
    }
}

```

### Core Architecture Module: `Modules/Sources/AppFeature/Define/MusicPlaybackState.swift`
```
//
//  MusicPlaybackState.swift
//  OnlySwitch
//
//  Created by Jacklandrin on 2022/2/19.
//

import Foundation
enum MusicPlaybackState {
    case stopped
    case playing
    case paused
    case fastForwarding
    case rewinding
    case reposition
    
    var isActiveState: Bool {
        switch self {
        case .stopped, .paused:
            return false
        default:
            return true
        }
    }
}

```

### Core Architecture Module: `Modules/Sources/AppFeature/Features/RemoteAccess/Host/RemoteHostLifecycle.swift`
```
import Foundation

struct RemotePairingSnapshot: Codable, Equatable, Sendable {
    let deviceID: UUID
    let epoch: UInt64
    let generation: UInt64
    let wasRevoked: Bool
}

struct RemoteHostLifecycle: Sendable {
    private enum Phase: Sendable {
        case stopped
        case starting(UInt64)
        case listening(UInt64)
    }

    let maximumPendingHandshakes: Int
    let maximumAuthenticatedSessions: Int

    private(set) var generation: UInt64 = 0
    private var phase: Phase = .stopped
    private var pendingSessions: Set<UUID> = []
    private var authenticatedDevices: [UUID: UUID] = [:]
    private var revokedDevices: Set<UUID> = []
    private var deviceEpochs: [UUID: UInt64] = [:]

    var pendingCount: Int { pendingSessions.count }
    var authenticatedCount: Int { authenticatedDevices.count }

    func isActive(generation candidate: UInt64) -> Bool {
        guard candidate == generation else { return false }
        switch phase {
        case let .starting(active), let .listening(active): return active == candidate
        case .stopped: return false
        }
    }

    init(maximumPendingHandshakes: Int = 8, maximumAuthenticatedSessions: Int = 8) {
        self.maximumPendingHandshakes = max(1, maximumPendingHandshakes)
        self.maximumAuthenticatedSessions = max(1, maximumAuthenticatedSessions)
    }

    mutating func beginStart() -> UInt64 {
        generation &+= 1
        phase = .starting(generation)
        pendingSessions.removeAll()
        authenticatedDevices.removeAll()
        return generation
    }

    mutating func markListening(generation candidate: UInt64) -> Bool {
        guard case let .starting(active) = phase,
              active == candidate,
              candidate == generation else { return false }
        phase = .listening(candidate)
        return true
    }

    func isListening(generation candidate: UInt64) -> Bool {
        guard case let .listening(active) = phase else { return false }
        return active == candidate && candidate == generation
    }

    mutating func acceptPending(sessionID: UUID, generation candidate: UInt64) -> Bool {
        guard isListening(generation: candidate),
              pendingSessions.count < maximumPendingHandshakes,
              authenticatedDevices[sessionID] == nil else { return false }
        return pendingSessions.insert(sessionID).inserted
    }

    func mayAuthorize(sessionID: UUID, deviceID: UUID, generation candidate: UInt64) -> Bool {
        isListening(generation: candidate)
            && pendingSessions.contains(sessionID)
            && revokedDevices.contains(deviceID) == false
            && authenticatedDevices.count < maximumAuthenticatedSessions
    }

    func isAuthorized(sessionID: UUID, deviceID: UUID, generation candidate: UInt64) -> Bool {
        isListening(generation: candidate)
            && authenticatedDevices[sessionID] == deviceID
            && revokedDevices.contains(deviceID) == false
    }

    mutating func authorize(
        sessionID: UUID,
        deviceID: UUID,
        generation candidate: UInt64,
        credentialExists: Bool
    ) -> Bool {
        guard credentialExists,
              mayAuthorize(sessionID: sessionID, deviceID: deviceID, generation: candidate) else { return false }
        pendingSessions.remove(sessionID)
        authenticatedDevices[sessionID] = deviceID
        return true
    }

    func pairingEpoch(for deviceID: UUID) -> UInt64 { deviceEpochs[deviceID, default: 0] }

    func pairingSnapshot(for deviceID: UUID, generation candidate: UInt64) -> RemotePairingSnapshot? {
        guard isListening(generation: candidate) else { return nil }
        return RemotePairingSnapshot(
            deviceID: deviceID,
            epoch: pairingEpoch(for: deviceID),
            generation: candidate,
            wasRevoked: revokedDevices.contains(deviceID)
        )
    }

    func validateRepair(_ snapshot: RemotePairingSnapshot) -> Bool {
        isListening(generation: snapshot.generation)
            && pairingEpoch(for: snapshot.deviceID) == snapshot.epoch
    }

    mutating func commitRepair(_ snapshot: RemotePairingSnapshot) -> Bool {
        guard validateRepair(snapshot) else { return false }
        revokedDevices.remove(snapshot.deviceID)
        return true
    }

    mutating func rollbackRepair(_ snapshot: RemotePairingSnapshot) -> Bool {
        guard pairingEpoch(for: snapshot.deviceID) == snapshot.epoch else { return false }
        if snapshot.wasRevoked {
            revokedDevices.insert(snapshot.deviceID)
        } else {
            revokedDevices.remove(snapshot.deviceID)
        }
        return true
    }

    func isRevoked(_ deviceID: UUID) -> Bool { revokedDevices.contains(deviceID) }

    mutating func allowRepairedDevice(
        _ deviceID: UUID,
        pairingEpoch: UInt64,
        generation candidate: UInt64
    ) -> Bool {
        let snapshot = RemotePairingSnapshot(
            deviceID: deviceID,
            epoch: pairingEpoch,
            generation: candidate,
            wasRevoked: revokedDevices.contains(deviceID)
        )
        return commitRepair(snapshot)
    }

    mutating func revoke(deviceID: UUID) -> [UUID] {
        revokedDevices.insert(deviceID)
        deviceEpochs[deviceID, default: 0] &+= 1
        let affected = authenticatedDevices.compactMap { $0.value == deviceID ? $0.key : nil }
        affected.forEach { authenticatedDevices[$0] = nil }
        return affected.sorted { $0.uuidString < $1.uuidString }
    }

    mutating func end(sessionID: UUID) -> Bool {
        let wasAuthenticated = authenticatedDevices.removeValue(forKey: sessionID) != nil
        let wasPending = pendingSessions.remove(sessionID) != nil
        return wasAuthenticated || wasPending
    }

    mutating func stop() -> [UUID] {
        generation &+= 1
        phase = .stopped
        let sessions = Set(pendingSessions).union(authenticatedDevices.keys)
        pendingSessions.removeAll()
        authenticatedDevices.removeAll()
        return sessions.sorted { $0.uuidString < $1.uuidString }
    }

    mutating func fail(generation candidate: UInt64) -> [UUID] {
        guard candidate == generation else { return [] }
        switch phase {
        case let .starting(active) where active == candidate:
            return stop()
        case let .listening(active) where active == candidate:
            return stop()
        default:
            return []
        }
    }
}

```

### Core Architecture Module: `Modules/Sources/AppFeature/Features/Settings/Evolution/EvolutionEditor/EvolutionEditorReducer+State.swift`
```
//
//  EvolutionEditorReducer+State.swift
//  OnlySwitch
//

import Foundation
import Switches

extension EvolutionEditorReducer.State {
    var isDirty: Bool {
        Self.normalized(makeItem()) != Self.normalized(original)
    }

    var missingRequirements: [EvolutionEditorReducer.Requirement] {
        var missing: [EvolutionEditorReducer.Requirement] = []
        if evolution.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            missing.append(.name)
        }
        for state in commandStates {
            let command = state.command
            if command.commandString.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                missing.append(.script(command.commandType))
            } else if command.commandType != .status, !isVerified(command) {
                missing.append(.test(command.commandType))
            }
            if command.commandType == .status, needsOnOutput(command) {
                missing.append(.statusOnOutput)
            }
        }
        return missing
    }

    var canSave: Bool {
        !isSaving && (isNew || isDirty) && missingRequirements.isEmpty
    }

    var hasScripts: Bool {
        commandStates.contains { !$0.command.commandString.isEmpty }
    }

    /// The item to persist. Commands that are unchanged from the saved version
    /// count as verified: they passed a test when they were first saved, and
    /// re-testing would toggle the user's system just to rename an Evolution.
    func makeItem() -> EvolutionItem {
        var item = evolution
        for state in commandStates {
            var command = state.command
            let saved = savedCommand(command.commandType)
            if saved == nil, command.commandString.isEmpty, command.trueCondition?.isEmpty ?? true {
                assign(nil, to: command.commandType, in: &item)
                continue
            }
            if command.debugStatus != .failed, isUnchanged(command) {
                command.debugStatus = .success
            }
            assign(command, to: command.commandType, in: &item)
        }
        return item
    }

    func savedCommand(_ type: CommandType) -> EvolutionCommand? {
        guard original.controlType == evolution.controlType else { return nil }
        switch type {
        case .on: return original.onCommand
        case .off: return original.offCommand
        case .status: return original.statusCommand
        case .single: return original.singleCommand
        }
    }

    func isUnchanged(_ command: EvolutionCommand) -> Bool {
        guard !isNew, let saved = savedCommand(command.commandType) else { return false }
        return saved.commandString == command.commandString && saved.executeType == command.executeType
    }

    func isVerified(_ command: EvolutionCommand) -> Bool {
        command.debugStatus == .success || (command.debugStatus != .failed && isUnchanged(command))
    }

    private func needsOnOutput(_ command: EvolutionCommand) -> Bool {
        let condition = command.trueCondition ?? ""
        guard condition.isEmpty else { return false }
        // A legacy switch may deliberately treat empty output as "on".
        return !(savedCommand(.status)?.trueCondition == "" && isUnchanged(command))
    }

    private func assign(_ command: EvolutionCommand?, to type: CommandType, in item: inout EvolutionItem) {
        switch type {
        case .on: item.onCommand = command
        case .off: item.offCommand = command
        case .status: item.statusCommand = command
        case .single: item.singleCommand = command
        }
    }

    private static func normalized(_ item: EvolutionItem) -> EvolutionItem {
        var item = item
        for keyPath in [\EvolutionItem.onCommand, \.offCommand, \.statusCommand, \.singleCommand] {
            item[keyPath: keyPath]?.debugStatus = .unknow
        }
        return item
    }
}

```

### Core Architecture Module: `Modules/Sources/AppFeature/Features/Settings/Evolution/EvolutionEmptyStateView.swift`
```
//
//  EvolutionEmptyStateView.swift
//  OnlySwitch
//

import ComposableArchitecture
import SwiftUI

/// Shown when there are no Evolutions: three ways to get the first one.
struct EvolutionEmptyStateView: View {
    let store: StoreOf<EvolutionReducer>

    var body: some View {
        ContentUnavailableView {
            Label("No Evolutions yet".localized(), systemImage: "wand.and.rays")
        } description: {
            Text("Build your own switches and buttons with Shell or AppleScript.".localized())
        } actions: {
            // Side by side when the labels fit; otherwise stacked so no title gets truncated.
            ViewThatFits(in: .horizontal) {
                HStack { buttons }
                VStack { buttons }
            }
        }
    }

    @ViewBuilder
    private var buttons: some View {
        Button("New Evolution".localized(), systemImage: "plus") {
            store.send(.newTapped)
        }
        .evolutionProminentButtonStyle()
        .fixedSize()
        Button("Browse Gallery".localized(), systemImage: "square.grid.2x2") {
            store.send(.tabChanged(.gallery))
        }
        .fixedSize()
        if store.isOnlyAgentAvailable {
            Button("Create with Only Agent".localized(), systemImage: "sparkles") {
                store.send(.openOnlyAgent)
            }
            .fixedSize()
        }
    }
}

```

### Core Architecture Module: `Modules/Sources/AppFeature/Features/SoundMixer/SystemAudioMixer+CoreAudio.swift`
```
import AppKit
import CoreAudio
import Darwin

@available(macOS 14.4, *)
extension SystemAudioMixer {
    // MARK: - Process ownership

    /// The app a given audio process belongs to: the process itself when it is a normal app, or
    /// the app that spawned it when it is a helper process. `nil` for daemons with no user-facing app.
    static func owningApplication(of pid: pid_t) -> NSRunningApplication? {
        if let app = NSRunningApplication(processIdentifier: pid), app.activationPolicy == .regular {
            return app
        }
        // XPC services are children of launchd, so only the responsible process leads back to the app.
        if let responsible = responsiblePID(of: pid), responsible != pid,
           let app = NSRunningApplication(processIdentifier: responsible), app.activationPolicy == .regular {
            return app
        }
        // Helpers spawned by their app directly (Chrome's renderers) are found by walking up.
        var current = parentPID(of: pid)
        var hops = 0
        while let candidate = current, candidate > 1, hops < 4 {
            if let app = NSRunningApplication(processIdentifier: candidate), app.activationPolicy == .regular {
                return app
            }
            current = parentPID(of: candidate)
            hops += 1
        }
        return nil
    }

    static func parentPID(of pid: pid_t) -> pid_t? {
        var info = kinfo_proc()
        var size = MemoryLayout<kinfo_proc>.stride
        var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, pid]
        guard sysctl(&mib, 4, &info, &size, nil, 0) == 0, size > 0 else { return nil }
        let ppid = info.kp_eproc.e_ppid
        return ppid > 0 ? ppid : nil
    }

    /// `responsibility_get_pid_responsible_for_pid` is SPI, so it is looked up at runtime; if it
    /// ever disappears the parent-chain walk above still covers the common cases.
    private static let responsibleForPID: (@convention(c) (pid_t) -> pid_t)? = {
        guard let symbol = dlsym(UnsafeMutableRawPointer(bitPattern: -2), // RTLD_DEFAULT
                                 "responsibility_get_pid_responsible_for_pid") else { return nil }
        return unsafeBitCast(symbol, to: (@convention(c) (pid_t) -> pid_t).self)
    }()

    private static func responsiblePID(of pid: pid_t) -> pid_t? {
        guard let resolve = responsibleForPID else { return nil }
        let responsible = resolve(pid)
        return responsible > 0 ? responsible : nil
    }

    // MARK: - Core Audio helpers

    static func processObjectIDs() -> [AudioObjectID] {
        var address = AudioObjectPropertyAddress(
            mSelector: kAudioHardwarePropertyProcessObjectList,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain)
        var dataSize: UInt32 = 0
        let system = AudioObjectID(kAudioObjectSystemObject)
        guard AudioObjectGetPropertyDataSize(system, &address, 0, nil, &dataSize) == noErr else { return [] }
        let count = Int(dataSize) / MemoryLayout<AudioObjectID>.size
        guard count > 0 else { return [] }
        var ids = [AudioObjectID](repeating: 0, count: count)
        guard AudioObjectGetPropertyData(system, &address, 0, nil, &dataSize, &ids) == noErr else { return [] }
        return ids
    }

    static func pidProperty(of object: AudioObjectID) -> pid_t? {
        var address = AudioObjectPropertyAddress(
            mSelector: kAudioProcessPropertyPID,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain)
        var dataSize = UInt32(MemoryLayout<pid_t>.size)
        var pid: pid_t = -1
        guard AudioObjectGetPropertyData(object, &address, 0, nil, &dataSize, &pid) == noErr, pid > 0 else { return nil }
        return pid
    }

    static func boolProperty(_ selector: AudioObjectPropertySelector, of object: AudioObjectID) -> Bool {
        var address = AudioObjectPropertyAddress(
            mSelector: selector,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain)
        var dataSize = UInt32(MemoryLayout<UInt32>.size)
        var value: UInt32 = 0
        guard AudioObjectGetPropertyData(object, &address, 0, nil, &dataSize, &value) == noErr else { return false }
        return value != 0
    }

    nonisolated static func stringProperty(_ selector: AudioObjectPropertySelector,
                                                   of object: AudioObjectID) -> String? {
        var address = AudioObjectPropertyAddress(
            mSelector: selector,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain)
        var dataSize = UInt32(MemoryLayout<CFString?>.size)
        var value: CFString?
        let status = withUnsafeMutablePointer(to: &value) {
            AudioObjectGetPropertyData(object, &address, 0, nil, &dataSize, $0)
        }
        guard status == noErr, let value else { return nil }
        let string = value as String
        return string.isEmpty ? nil : string
    }

    /// The tap's stream format. Used to confirm the samples really are Float32 before scaling them.
    nonisolated static func tapFormat(of tapID: AudioObjectID) -> AudioStreamBasicDescription? {
        var address = AudioObjectPropertyAddress(
            mSelector: kAudioTapPropertyFormat,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain)
        var format = AudioStreamBasicDescription()
        var dataSize = UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
        guard AudioObjectGetPropertyData(tapID, &address, 0, nil, &dataSize, &format) == noErr else { return nil }
        return format
    }

    private nonisolated static func defaultOutputDevice() -> AudioObjectID? {
        var address = AudioObjectPropertyAddress(
            mSelector: kAudioHardwarePropertyDefaultOutputDevice,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain)
        var dataSize = UInt32(MemoryLayout<AudioObjectID>.size)
        var device = AudioObjectID(kAudioObjectUnknown)
        guard AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil,
                                         &dataSize, &device) == noErr,
              device != kAudioObjectUnknown else { return nil }
        return device
    }
}

```

### Core Architecture Module: `Modules/Sources/AppFeature/Player/CommonPlayer/AudioStreamer/Download/DownloadingState.swift`
```
//
//  DownloadingState.swift
//  AudioStreamer
//
//  Created by Syed Haris Ali on 1/6/18.
//  Copyright © 2018 Ausome Apps LLC. All rights reserved.
//

import Foundation

/// The various states of a download request.
///
/// - completed: The download has completed
/// - started: The download has yet to start
/// - paused: The download is paused
/// - notStarted: The download has not started yet
/// - stopped: The download has been stopped/cancelled
public enum DownloadingState: String {
    case completed
    case started
    case paused
    case notStarted
    case stopped
}

```

### Core Architecture Module: `Modules/Sources/AppFeature/Player/CommonPlayer/AudioStreamer/Stream/StreamingState.swift`
```
//
//  StreamingState.swift
//  AudioStreamer
//
//  Created by Syed Haris Ali on 6/5/18.
//  Copyright © 2018 Ausome Apps LLC. All rights reserved.
//

import Foundation

/// The various playback states of a `Streaming`.
///
/// - stopped: Audio playback and download operations are all stopped
/// - paused: Audio playback is paused
/// - playing: Audio playback is playing
public enum StreamingState: String {
    case stopped
    case paused
    case playing
}

```

### Core Architecture Module: `Modules/Sources/AppFeature/Player/CommonPlayer/PlaybackHelperEngine.swift`
```
import AVFoundation
import Foundation
import os

/// Only the helper constructs audible AVFoundation players. The host retains UI, Now Playing,
/// track navigation and user preferences, while metadata and waveform samples return over stdout.
@MainActor
final class PlaybackHelperEngine: NSObject, @preconcurrency AVPlayerItemMetadataOutputPushDelegate, StreamingDelegate {
    private var player: AVPlayer?
    private var noise: AVAudioPlayer?
    private var streamer: Streamer?
    private var playbackObservation: NSKeyValueObservation?
    private var itemObservation: NSKeyValueObservation?
    private var receivedStreamAudio = false
    private var desiredPlaybackActive = false
    private var playbackID: UUID?
    private let output: FileHandle
    private var volume: Float = 1
    nonisolated private let visible = OSAllocatedUnfairLock(initialState: false)
    private let analyzer = RealtimeAnalyzer(fftSize: bufferSize)

    init(output: FileHandle) { self.output = output; super.init() }

    func announceReady() { emit(.init(isReady: true)) }

    func perform(_ command: PlaybackHelperCommand) {
        switch command.action {
        case .play:
            guard let raw = command.url, raw.utf8.count <= 8_192,
                  let url = URL(string: raw), ["http", "https", "file"].contains(url.scheme?.lowercased() ?? "") else { return }
            stop()
            playbackID = command.playbackID
            desiredPlaybackActive = true
            setVolume(command.volume ?? volume)
            if command.isNoise == true {
                guard let sound = try? AVAudioPlayer(contentsOf: url) else {
                    emit(.init(isBuffering: false, hasFailed: true)); return
                }
                noise = sound
                sound.numberOfLoops = -1
                sound.volume = volume
                emit(.init(isBuffering: false, hasFailed: !sound.play()))
            } else {
                let item = AVPlayerItem(url: url)
                item.audioTimePitchAlgorithm = .spectral
                item.allowedAudioSpatializationFormats = .monoStereoAndMultichannel
                let metadata = AVPlayerItemMetadataOutput(identifiers: nil)
                metadata.setDelegate(self, queue: .main)
                item.add(metadata)
                let av = AVPlayer(playerItem: item)
                player = av
                itemObservation = item.observe(\.status, options: [.new]) { [weak self] item, _ in
                    guard item.status == .failed else { return }
                    DispatchQueue.main.async { [weak self] in
                        guard let self, self.player?.currentItem === item else { return }
                        self.emit(.init(isBuffering: false, hasFailed: true))
                    }
                }
                playbackObservation = av.observe(\.timeControlStatus, options: [.new]) { [weak self] player, _ in
                    let isBuffering = player.timeControlStatus != .playing
                    DispatchQueue.main.async { [weak self] in
                        guard let self, self.player === player, self.desiredPlaybackActive else { return }
                        self.emit(.init(isBuffering: isBuffering))
                    }
                }
                av.volume = volume
                let path = raw.lowercased()
                let useStreamer = command.usesWaveform == true && !path.hasSuffix(".m3u")
                    && !path.hasSuffix(".m3u8") && !path.hasSuffix(".aac")
                av.isMuted = useStreamer
                av.play()
                if useStreamer {
                    let stream = Streamer()
                    stream.delegate = self
                    stream.volume = volume
                    streamer = stream
                    stream.url = url
                    // Preserve incremental live-radio startup before the download ever completes.
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self, weak stream] in
                        guard let self, let stream, self.streamer === stream, self.desiredPlaybackActive else { return }
                        stream.play()
                    }
                }
                emit(.init(isBuffering: true))
            }
        case .pause:
            desiredPlaybackActive = false
            player?.pause(); noise?.pause(); streamer?.pause()
            emit(.init(isBuffering: false))
        case .stop:
            stop()
        case .volume:
            setVolume(command.volume ?? volume)
        case .visible:
            visible.withLock { $0 = command.isVisible == true }
        case .shutdown:
            shutdown()
        }
    }

    private func setVolume(_ value: Float) {
        volume = value.isFinite ? min(1, max(0, value)) : 0
        player?.volume = volume
        noise?.volume = volume
        streamer?.setUserVolume(volume)
    }

    private func stop(emitStatus: Bool = true) {
        desiredPlaybackActive = false
        player?.pause()
        player?.replaceCurrentItem(with: nil)
        noise?.stop()
        streamer?.dispose()
        playbackObservation = nil
        itemObservation = nil
        receivedStreamAudio = false
        player = nil; noise = nil; streamer = nil
        if emitStatus { emit(.init(isBuffering: false)) }
    }

    func shutdown() -> Never { stop(emitStatus: false); exit(EXIT_SUCCESS) }

    private func emit(_ event: PlaybackHelperEvent) {
        var event = event
        event.playbackID = playbackID
        guard var data = try? JSONEncoder().encode(event), data.count <= PlaybackHelperLineFramer.maximumFrameSize else { return }
        data.append(10)
        do { try output.write(contentsOf: data) } catch { shutdown() }
    }

    func metadataOutput(_ output: AVPlayerItemMetadataOutput, didOutputTimedMetadataGroups groups: [AVTimedMetadataGroup], from track: AVPlayerItemTrack?) {
        guard player?.currentItem?.outputs.contains(where: { $0 === output }) == true,
              let item = groups.first?.items.first, let title = item.value(forKeyPath: "value") as? String else { return }
        emit(.init(trackInfo: title.trimmingCharacters(in: .newlines), isBuffering: false))
    }

    nonisolated func streamer(_ streamer: Streaming, downloadComplete url: URL) {
        guard let stream = streamer as? Streamer else { return }
        Task { @MainActor [weak self] in
            guard let self, self.streamer === stream, self.desiredPlaybackActive else { return }
            stream.play()
        }
    }

    nonisolated func streamer(_ streamer: Streaming, failedDownloadWithError error: Error, forURL url: URL) {
        guard let stream = streamer as? Streamer else { return }
        Task { @MainActor [weak self] in
            guard let self, self.streamer === stream else { return }
            stream.dispose()
            self.streamer = nil
            self.player?.isMuted = false
            if self.desiredPlaybackActive { self.emit(.init(isBuffering: false, isReady: true)) }
        }
    }

    nonisolated func streamer(_ streamer: Streaming, updateBuffer buffer: AVAudioPCMBuffer) {
        guard let stream = streamer as? Streamer else { return }
        let channelCount = Int(buffer.format.channelCount)
        let sampleRate = buffer.format.sampleRate
        let interleaved = buffer.format.isInterleaved
        let samples: [[Float]]?
        if visible.withLock({ $0 }), buffer.frameLength >= AVAudioFrameCount(bufferSize),
           channelCount > 0, channelCount <= 8, let channels = buffer.floatChannelData {
            // Copy only samples across the actor boundary; the engine owns and reuses its buffer.
            samples = (0..<channelCount).map { channel in
                (0..<bufferSize).map { frame in
                    interleaved ? channels[0][frame * channelCount + channel] : channels[channel][frame]
                }
            }
        } else { samples = nil }
        Task { @MainActor [weak self] in
            guard let self, self.streamer === stream else { return }
            var spectra: [[Float]]?
            if let samples,
               let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: AVAudioChannelCount(channelCount)),
               let copy = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(bufferSize)),
               let channels = copy.floatChannelData {
                copy.frameLength = AVAudioFrameCount(bufferSize)
                for channel in 0..<channelCount {
                    samples[channel].withUnsafeBufferPointer { source in
                        channels[channel].update(from: source.baseAddress!, count: bufferSize)
                    }
                }
                spectra = self.analyzer.analyse(with: copy)
            }
            let firstAudio = !self.receivedStreamAudio
            self.receivedStreamAudio = true
            if firstAudio || spectra != nil {
                self.emit(.init(spectra: spectra, isBuffering: false, isReady: firstAudio))
            }
        }
    }
    nonisolated func streamer(_ streamer: Streaming, updatedDownloadProgress progress: Float, forURL url: URL) {}
    nonisolated func streamer(_ streamer: Streaming, changedState state: StreamingState) {}
    nonisolated func streamer(_ streamer: Streaming, updatedCurrentTime currentTime: TimeInterval) {}
    nonisolated func streamer(_ streamer: Streaming, updatedDuration duration: TimeInterval) {}
}

```

### Core Architecture Module: `Modules/Sources/AppFeature/Utilities/BluetoothDevicesManager.swift`
```
//
//  BluetoothDevicesManager.swift
//  OnlySwitch
//
//  Created by Jacklandrin on 2021/12/6.
//

import Foundation
import IOBluetooth
import CoreBluetooth
import Switches
import OnlySwitchObjC
import OSLog
import Extensions

enum AirPodsBattery:String {
    case left = "BatteryPercentLeft"
    case right = "BatteryPercentRight"
    case `case` = "BatteryPercentCase"
}

class BluetoothDevicesManager:NSObject, @unchecked Sendable {
    static let shared = BluetoothDevicesManager()
    private let classOfAirpods:UInt32 = 2360344
    private var disconnectComplete:(_ success:Bool, _ errorInfo:String) -> Void = {_,_ in}
    private var connectComplete:(_ success:Bool, _ errorInfo:String) -> Void = {_,_ in}
    private let concurrentQueue = DispatchQueue(label: "concurrentQueue", attributes: .concurrent)
    var centralManager:CBCentralManager!
    override init() {
        super.init()
        self.centralManager = CBCentralManager(delegate: self, queue: nil)
    }
    
    var allPairedDevices:[IOBluetoothDevice] {
        IOBluetoothDevice.pairedDevices().filter{ $0 is IOBluetoothDevice }.map{ $0 as! IOBluetoothDevice }
    }
    
    var allPairedAirpods:[IOBluetoothDevice] {
        allPairedDevices.filter{ $0.classOfDevice == classOfAirpods }
    }
    
    func setBluetooth(isOn:Bool) {
        IOBluetoothPreferenceSetControllerPowerState(isOn ? 1 : 0)
    }
    
    func getAirPodsBattery(deviceAddress: String) async -> String {
        let command = "sh \(scriptDiskFilePath(scriptName: getAirpodsBatteryShell))"
        do {
            let value = try await command.runAppleScript(isShellCMD: true)
            let valueGroupedBySpaces = value.split(separator: "\n")
            guard valueGroupedBySpaces.count > 0 else {
                return ""
            }
            var currentAirPodsBattery = ""
            for item in valueGroupedBySpaces {
                let datas = String(item).components(separatedBy: "@@")
                guard datas.count > 1,
                      let address = datas.first,
                      let batteryInfo = datas.last else {
                          continue
                      }
                if address.trimmingCharacters(in: .whitespaces) == deviceAddress.convertMacAdrress() {
                    currentAirPodsBattery = batteryInfo
                    break
                }
            }
            return currentAirPodsBattery
        } catch {
            return ""
        }

    }
    
    
    func connect(addressStr:String) -> (Bool, String) {
        if let device = IOBluetoothDevice(addressString: addressStr) {
            return connect(device: device)
        } else {
            return (false, "wrong address")
        }
    }
    
    func connect(device:IOBluetoothDevice) -> (Bool, String) {
        guard device.isPaired() else {
            return (false, "unpaired device")
        }
        
        guard !device.isConnected() else {
            return (false, "device is connected")
            
        }
        
        let result = device.openConnection(nil, withPageTimeout: 20, authenticationRequired: false)
        if result == kIOReturnSuccess {
            return (true, "")
        } else {
            return (false, "connect failed:\(result)")
        }
    }
    
    func disconnect(addressStr:String) -> (Bool, String){
        if let device = IOBluetoothDevice(addressString: addressStr) {
            return disconnect(device: device)
        } else {
            return (false, "wrong address")
        }
    }
    
    func disconnect(device:IOBluetoothDevice) -> (Bool, String) {
        guard device.isPaired() else {
            return (false, "unpaired device")
        }
        
        guard device.isConnected() else {
            return (false, "device is disconnected")
        }
        
        let result = device.closeConnection()
        if result == kIOReturnSuccess {
            return (true, "")
        } else {
            return (false, "disconnect failed:\(result)")
        }
    }
    
}

extension BluetoothDevicesManager:CBCentralManagerDelegate {
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        switch central.state {
        case .poweredOn:
            Logger.bluetooth.debug("Power on")
        case .poweredOff:
            Logger.bluetooth.debug("Power off")
        case .unsupported:
            Logger.bluetooth.debug("Unsupported")
        default:
            break
        }
    }
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

### Incident Patch 1: `c2731435` (2026-11-14)
**Commit Message**: fix: post the desktop pet hunger setting change on the main actor

The settings reducer saved from a TCA effect on the cooperative pool, so
NotificationCenter delivered .desktopPetNeedsSettingsChanged to the
main-actor AppDelegate off the main thread, tripping Swift 6 dynamic
isolation checks. Make save async and post from the main actor.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `Modules/Sources/AppFeature/Features/Settings/DesktopPet/DesktopPetHungerSetting.swift` (modified, +6/-2)
```diff
@@ -6,7 +6,7 @@ import Foundation
 /// Reads and writes whether the desktop pet gets hungry, and tells the running pet about changes.
 struct DesktopPetHungerSetting: Sendable {
     var load: @Sendable () -> Bool
-    var save: @Sendable (Bool) -> Void
+    var save: @Sendable (Bool) async -> Void
 
     static func userDefaults(_ defaults: UserDefaults, notificationCenter: NotificationCenter = .default) -> Self {
         // Both types are documented as thread-safe but are not declared `Sendable`.
@@ -17,7 +17,11 @@ struct DesktopPetHungerSetting: Sendable {
             load: { defaults.value.object(forKey: key) as? Bool ?? true },
             save: { isEnabled in
                 defaults.value.set(isEnabled, forKey: key)
-                center.value.post(name: .desktopPetNeedsSettingsChanged, object: nil)
+                // Observers such as `AppDelegate` are main-actor isolated, and notifications are
+                // delivered on the posting thread, so post from the main actor.
+                await MainActor.run {
+                    center.value.post(name: .desktopPetNeedsSettingsChanged, object: nil)
+                }
             }
         )
     }
```

**File**: `Modules/Sources/AppFeature/Features/Settings/DesktopPet/DesktopPetSettingsFeature.swift` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ struct DesktopPetSettingsFeature {
 
             case .binding(\.isHungerEnabled):
                 let isEnabled = state.isHungerEnabled
-                return .run { [hungerSetting] _ in hungerSetting.save(isEnabled) }
+                return .run { [hungerSetting] _ in await hungerSetting.save(isEnabled) }
 
             case .binding:
                 return .none
```

**File**: `Modules/Tests/AppFeatureTests/DesktopPet/DesktopPetHungerSettingTests.swift` (modified, +5/-5)
```diff
@@ -17,21 +17,21 @@ struct DesktopPetHungerSettingTests {
         #expect(!UserDefaults.Key.exportableKeys.contains(UserDefaults.Key.desktopPetNeeds))
     }
 
-    @Test func savesAndPostsChange() throws {
+    @Test func savesAndPostsChangeOnTheMainThread() async throws {
         let suite = "DesktopPetHungerSettingTests.\(UUID().uuidString)"
         let defaults = try #require(UserDefaults(suiteName: suite))
         defer { defaults.removePersistentDomain(forName: suite) }
         let center = NotificationCenter()
-        let posted = LockIsolated(0)
+        let posted = LockIsolated<[Bool]>([])
         let token = center.addObserver(forName: .desktopPetNeedsSettingsChanged, object: nil, queue: nil) { _ in
-            posted.withValue { $0 += 1 }
+            posted.withValue { $0.append(Thread.isMainThread) }
         }
         defer { center.removeObserver(token) }
         let setting = DesktopPetHungerSetting.userDefaults(defaults, notificationCenter: center)
 
         #expect(setting.load())
-        setting.save(false)
+        await setting.save(false)
         #expect(!setting.load())
-        #expect(posted.value == 1)
+        #expect(posted.value == [true])
     }
 }
```

---

### Incident Patch 2: `8dbe2fe3` (2026-11-14)
**Commit Message**: fix: fence the current pet markup in the edit prompt and polish edit translations

Fence the current skin in an html code block so it matches the reply format
and stays clearly separated from the instructions. Cover replacing a skin
while the library is full. Fix the Filipino, Italian, Russian and Ukrainian
examples and use the Dutch infinitive button style.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `Localization/Localizable.xcstrings` (modified, +5/-5)
```diff
@@ -129740,7 +129740,7 @@
         "nl" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Bewerk met AI…"
+            "value" : "Bewerken met AI…"
           }
         },
         "pl" : {
@@ -129829,7 +129829,7 @@
         "fil" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Maglarawan ng pagbabago, hal. “bigyan ng sombrero ng wizard”"
+            "value" : "Maglarawan ng pagbabago, hal. “bigyan ito ng sombrero ng wizard”"
           }
         },
         "fr" : {
@@ -129847,7 +129847,7 @@
         "it" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Descrivi una modifica, ad es. «dagli un cappello da mago»"
+            "value" : "Descrivi una modifica, ad es. «mettile un cappello da mago»"
           }
         },
         "ja" : {
@@ -129883,7 +129883,7 @@
         "ru" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Опишите изменение, например: «добавь волшебную шляпу»"
+            "value" : "Опишите изменение, например: «надень на него шляпу волшебника»"
           }
         },
         "sk" : {
@@ -129907,7 +129907,7 @@
         "uk" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Опишіть зміну, наприклад: «додай чарівницький капелюх»"
+            "value" : "Опишіть зміну, наприклад: «одягни йому капелюх чарівника»"
           }
         },
         "zh-Hans" : {
```

**File**: `Modules/Sources/DesktopPetSkinKit/DesktopPetSkinPromptBuilder.swift` (modified, +2/-0)
```diff
@@ -56,7 +56,9 @@ public enum DesktopPetSkinPromptBuilder {
         Keep NAME: as the current name unless the request asks you to rename the pet.
 
         Current skin:
+        ```html
         \(currentMarkup)
+        ```
         """
     }
 
```

**File**: `Modules/Tests/ModulesTests/DesktopPetSkinLibraryTests.swift` (modified, +14/-0)
```diff
@@ -58,6 +58,20 @@ struct DesktopPetSkinLibraryTests {
         await #expect(throws: DesktopPetSkinLibraryError.full) { _ = try await client.save(skin("extra")) }
     }
 
+    @Test func replacingAnExistingSkinIsAllowedWhenFull() async throws {
+        let (client, _) = try makeClient()
+        var skins: [DesktopPetSkin] = []
+        for index in 0..<DesktopPetSkinLibraryClient.maximumSkins {
+            let next = skin("\(index)")
+            skins.append(next)
+            _ = try await client.save(next)
+        }
+        var edited = skins[3]
+        edited.name = "Edited"
+        skins[3] = edited
+        #expect(try await client.save(edited) == skins)
+    }
+
     @Test func deletingSelectedSkinClearsSelection() async throws {
         let (client, _) = try makeClient()
         let cat = skin()
```

**File**: `Modules/Tests/ModulesTests/DesktopPetSkinPromptTests.swift` (modified, +8/-0)
```diff
@@ -36,6 +36,14 @@ struct DesktopPetSkinPromptTests {
         #expect(prompt.contains("give it a wizard hat"))
     }
 
+    @Test func editPromptFencesTheCurrentMarkupLast() {
+        let markup = "<style>#pet{color:red}</style><div id=\"pet\"></div>"
+        let prompt = DesktopPetSkinPromptBuilder.editPrompt(
+            instruction: "make it blue", currentName: "Cat", currentMarkup: markup
+        )
+        #expect(prompt.hasSuffix("```html\n\(markup)\n```"))
+    }
+
     @Test func editPromptAsksForAMinimalCompleteChange() {
         let prompt = DesktopPetSkinPromptBuilder.editPrompt(
             instruction: "make it blue", currentName: "Cat", currentMarkup: "<div id=\"pet\"></div>"
```

---

### Incident Patch 3: `4f51d6c3` (2026-11-14)
**Commit Message**: fix: tear down the skin web view while the desktop pet is hidden

Also let only the latest skin change apply when several arrive while the
library loads.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `Modules/Sources/AppFeature/AppDelegate.swift` (modified, +5/-1)
```diff
@@ -43,6 +43,7 @@ class AppDelegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDele
     }
     var checkUpdatePresenter = GitHubPresenter.shared
     private var desktopPetController: DesktopPetController?
+    private var desktopPetSkinTask: Task<Void, Never>?
     private var desktopPetPomodoroRefreshTask: Task<Void, Never>?
     private let remoteAccessController = RemoteAccessController()
     private lazy var crashReportPrompt = CrashReportPrompt()
@@ -249,8 +250,11 @@ class AppDelegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDele
     /// Shows the selected custom skin, or the built-in pet when none is selected or it no longer exists.
     @objc private func applySelectedDesktopPetSkin() {
         let library = DesktopPetSkinLibraryClient.liveValue
-        Task { @MainActor [weak self] in
+        // Only the latest change wins when several arrive while the library is loading.
+        desktopPetSkinTask?.cancel()
+        desktopPetSkinTask = Task { @MainActor [weak self] in
             let skins = await library.load()
+            guard !Task.isCancelled else { return }
             let selected = library.selectedID().flatMap { id in skins.first { $0.id == id } }
             self?.desktopPetController?.setSkin(selected)
         }
```

**File**: `Modules/Sources/DesktopPet/DesktopPetController.swift` (modified, +2/-0)
```diff
@@ -106,6 +106,7 @@ public final class DesktopPetController: NSObject {
         constrainPanelToVisibleScreen()
         saveFrame()
         presentation.isActive = true
+        presentation.isShown = true
         isVisible = true
         activityStore.send(.start)
         needsStore.send(.start)
@@ -127,6 +128,7 @@ public final class DesktopPetController: NSObject {
         saveFrame()
         presentation.isActive = false
         presentation.isDragging = false
+        presentation.isShown = false
         isVisible = false
         panel.orderOut(nil)
     }
```

**File**: `Modules/Sources/DesktopPet/DesktopPetPresentation.swift` (modified, +4/-0)
```diff
@@ -10,6 +10,10 @@ final class DesktopPetPresentation {
     var pomodoroState: DesktopPetPomodoroState?
     /// Lean in degrees while the pet peeks out from behind a screen edge.
     var edgeTilt: Double = 0
+    /// Whether the pet panel is on screen; edge docking may still pause it via `isActive`.
+    var isShown = false
     /// The custom skin to show instead of the built-in pet.
     var skin: DesktopPetSkin?
+    /// The skin to render. `nil` while hidden, so the skin's web view exists only while it is shown.
+    var renderedSkin: DesktopPetSkin? { isShown ? skin : nil }
 }
```

**File**: `Modules/Sources/DesktopPet/DesktopPetRootView.swift` (modified, +1/-1)
```diff
@@ -75,7 +75,7 @@ struct DesktopPetRootView: View {
             isHungry: needsStore.isHungry,
             reaction: needsStore.reaction,
             reactionStartedAt: needsStore.reactionStartedAt,
-            skin: presentation.skin
+            skin: presentation.renderedSkin
         )
         .rotationEffect(.degrees(presentation.edgeTilt))
         .animation(
```

**File**: `Modules/Tests/ModulesTests/DesktopPetSkinDocumentTests.swift` (modified, +12/-0)
```diff
@@ -1,7 +1,19 @@
+import DesktopPetSkinKit
+import Foundation
 import Testing
 @testable import DesktopPet
 
 struct DesktopPetSkinDocumentTests {
+    @MainActor @Test func skinRendersOnlyWhileThePetIsShown() {
+        let presentation = DesktopPetPresentation()
+        presentation.skin = DesktopPetSkin(
+            id: UUID(), name: "Cat", summary: "", createdAt: .distantPast, contractVersion: 1, markup: ""
+        )
+        #expect(presentation.renderedSkin == nil)
+        presentation.isShown = true
+        #expect(presentation.renderedSkin == presentation.skin)
+    }
+
     @Test func attributesReflectState() {
         let state = DesktopPetAnimationState(pomodoroPhase: .breakTime, isHungry: true, isControlPresented: true)
         let values = Dictionary(uniqueKeysWithValues: DesktopPetSkinAttributes.values(
```

#### Recent Merged Pull Requests:
- **PR #233** (2026-11-14): Fix and improve Hide Menu Bar Icons feature (@seanjseymour)
- **PR #229** (2026-10-28): Add option to turn off Keep Awake after manual sleep (@oecer)
- **PR #221** (2026-09-24): Add settings export/import (Backup section) (@oecer)
- **PR #219** (2026-09-19): Revise OnlyRemote section in README.md (@jacklandrin)
- **PR #217** (2026-09-15): docs: explain how to restore the OnlySwitch menu bar icon (@mvanhorn)
- **PR #215** (2026-08-11): Fix Show List shortcut being treated as a right-click (@EhsanAzish80)

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

## X. post the desktop pet hunger setting change on the main actor

**RULE**:
When implementing operations in `Modules/Sources/AppFeature/Features/Settings/DesktopPet/DesktopPetHungerSetting.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in jacklandrin/OnlySwitch. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c2731435`: post the desktop pet hunger setting change on the main actor. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Modules/Sources/AppFeature/Features/Settings/DesktopPet/DesktopPetHungerSetting.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    var save: @Sendable (Bool) async -> Void
                // Observers such as `AppDelegate` are main-actor isolated, and notifications are
                // delivered on the posting thread, so post from the main actor.
                await MainActor.run {
                    center.value.post(name: .desktopPetNeedsSettingsChanged, object: nil)
                }
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
    var save: @Sendable (Bool) -> Void
                center.value.post(name: .desktopPetNeedsSettingsChanged, object: nil)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c2731435` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
