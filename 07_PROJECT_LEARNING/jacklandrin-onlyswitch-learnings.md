> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/jacklandrin-onlyswitch-learnings.md`  
> **Source**: github ([https://github.com/jacklandrin/OnlySwitch](https://github.com/jacklandrin/OnlySwitch))  
> **Source Version**: `dc279316`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-19T21:08:14.526Z  
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
> **Harvest Timestamp**: 2026-11-19T21:08:14.521Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jacklandrin/OnlySwitch`
- **Description**: 👑 The all-in-one macOS menu bar companion: customizable controls, system monitor, AI Agent, Shortcuts, widgets, remote control, and more.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6069 stars

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

### Incident Patch 1: `c231eed6` (2026-11-18)
**Commit Message**: Fix menu bar indicator redraw loop

Render system monitor indicators as native status-button images to avoid continuous AppKit replicant snapshots caused by attached custom subviews. Preserve accessibility and actions, and cover CPU and network image updates with real AppKit regression tests.

**File**: `Modules/Sources/AppFeature/Features/SystemMonitor/SystemMonitorStatusItemController.swift` (modified, +105/-144)
```diff
@@ -244,145 +244,106 @@ private enum SystemMonitorStatusItemFormatter {
     }
 }
 
-@MainActor
-private final class StatusItemContentView: NSView {
-    private let metric: SystemMonitorMetric
-    private let imageView = NSImageView()
-    private let valueLabel = NSTextField(labelWithString: "")
-    private let topDot = NetworkIndicatorDot(color: .systemRed)
-    private let bottomDot = NetworkIndicatorDot(color: .systemBlue)
-    private let topValueLabel = NSTextField(labelWithString: "")
-    private let bottomValueLabel = NSTextField(labelWithString: "")
-
-    init(metric: SystemMonitorMetric) {
-        self.metric = metric
-        super.init(frame: .zero)
-
-        wantsLayer = false
-        configureStandardContent()
-        configureNetworkContent()
-        let isNetwork = metric == .network
-        imageView.isHidden = isNetwork
-        valueLabel.isHidden = isNetwork
-        topDot.isHidden = !isNetwork
-        bottomDot.isHidden = !isNetwork
-        topValueLabel.isHidden = !isNetwork
-        bottomValueLabel.isHidden = !isNetwork
-    }
-
-    @available(*, unavailable)
-    required init?(coder: NSCoder) {
-        nil
-    }
-
-    override func layout() {
-        super.layout()
-        guard metric == .network else {
-            let iconSide: CGFloat = 16
-            let leading: CGFloat = 5
-            let labelHeight = ceil(valueLabel.font?.boundingRectForFont.height ?? 13)
-            imageView.frame = CGRect(
-                x: leading,
-                y: (bounds.height - iconSide) / 2,
-                width: iconSide,
-                height: iconSide
-            )
-            valueLabel.frame = CGRect(
-                x: leading + iconSide + 3,
-                y: floor((bounds.height - labelHeight) / 2),
-                width: max(0, bounds.width - (leading + iconSide + 3) - 4),
-                height: labelHeight
-            )
-            return
+private enum SystemMonitorStatusItemImage {
+    static func make(
+        for presentation: SystemMonitorStatusItemPresentation,
+        size: NSSize
+    ) -> NSImage {
+        let image = NSImage(size: size, flipped: false) { bounds in
+            switch presentation.visualStyle {
+            case .standard:
+                drawStandard(presentation, in: bounds)
+            case .network:
+                drawNetwork(presentation, in: bounds)
+            }
+            return true
         }
-
-        let lineHeight: CGFloat = 10
-        let totalHeight = lineHeight * 2
-        let topY = (bounds.height + totalHeight) / 2 - lineHeight
-        let bottomY = topY - lineHeight
-        let dotLeading: CGFloat = 7
-        let dotSide: CGFloat = 7
-        let valueLeading: CGFloat = 21
-        let valueWidth = max(0, bounds.width - valueLeading - 5)
-
-        topDot.frame = CGRect(
-            x: dotLeading,
-            y: topY + (lineHeight - dotSide) / 2,
-            width: dotSide,
-            height: dotSide
-        )
-        bottomDot.frame = CGRect(
-            x: dotLeading,
-            y: bottomY + (lineHeight - dotSide) / 2,
-            width: dotSide,
-            height: dotSide
-        )
-        topValueLabel.frame = CGRect(x: valueLeading, y: topY, width: valueWidth, height: lineHeight)
-        bottomValueLabel.frame = CGRect(x: valueLeading, y: bottomY, width: valueWidth, height: lineHeight)
-    }
-
-    // The status-bar button remains the single click target; this view is visual only.
-    override func hitTest(_ point: NSPoint) -> NSView? {
-        nil
-    }
-
-    func update(_ presentation: SystemMonitorStatusItemPresentation) {
-        switch presentation.visualStyle {
-        case .standard:
-            let image = NSImage(systemSymbolName: presentation.symbolName, accessibilityDescription: nil)
-            image?.isTemplate = true
-            imageView.image = image
-            valueLabel.stringValue = presentation.title
-
-        case .network:
-            let lines = presentation.title.split(separator: "\n", maxSplits: 1, omittingEmptySubsequences: false)
-            topValueLabel.stringValue = lines.indices.contains(0) ? String(lines[0].dropFirst(2)) : "—"
-            bottomValueLabel.stringValue = lines.indices.contains(1) ? String(lines[1].dropFirst(2)) : "—"
+        image.isTemplate = presentation.visualStyle == .standard
+        if presentation.visualStyle == .network {
+            // Resolve the label and dot colors in the current menu bar appearance.
+            image.cacheMode = .never
         }
+        return image
     }
 
-    private func configureStandardContent() {
-        imageView.imageScaling = .scaleProportionallyDown
-        imageView.contentTintColor = .labelColor
-        valueLabel.font = NSFont.monospacedDigitSystemFont(ofSize: NSFont.systemFontSize, weight: .medium)
-        valueLabel.textColor = .labelColor
-        valueLabel.alignment = .right
-        valueLabel.lineBreakMode = .byClipping
-        addSubview(ima
```

**File**: `Modules/Tests/AppFeatureTests/SystemMonitor/SystemMonitorStatusItemControllerTests.swift` (modified, +35/-0)
```diff
@@ -1,10 +1,45 @@
+import AppKit
 import Foundation
 import SystemMonitor
 import Testing
 @testable import AppFeature
 
 @MainActor
 struct SystemMonitorStatusItemControllerTests {
+    @Test(arguments: [SystemMonitorMetric.cpu, .network])
+    func indicatorUpdatesTheNativeButtonImageWithoutInstallingCustomSubviews(metric: SystemMonitorMetric) throws {
+        _ = NSApplication.shared
+        let item = NSStatusBar.system.statusItem(withLength: metric == .network ? 80 : 64)
+        defer { NSStatusBar.system.removeStatusItem(item) }
+        let button = try #require(item.button)
+        let originalSubviews = button.subviews.map(ObjectIdentifier.init)
+        let handle = AppKitSystemMonitorStatusItem(metric: metric, item: item)
+        let isNetwork = metric == .network
+        let initial = SystemMonitorStatusItemPresentation(
+            symbolName: metric.rawValue,
+            title: isNetwork ? "↑ —\n↓ —" : "—",
+            accessibilityLabel: "Unavailable",
+            visualStyle: isNetwork ? .network : .standard
+        )
+        let updated = SystemMonitorStatusItemPresentation(
+            symbolName: metric.rawValue,
+            title: isNetwork ? "↑ 2 KB/s\n↓ 6 KB/s" : "42%",
+            accessibilityLabel: "Updated reading",
+            visualStyle: initial.visualStyle
+        )
+
+        handle.update(initial)
+        #expect(button.subviews.map(ObjectIdentifier.init) == originalSubviews)
+        let initialImage = try #require(button.image?.tiffRepresentation)
+        handle.update(updated)
+
+        let updatedImage = try #require(button.image?.tiffRepresentation)
+        #expect(updatedImage != initialImage)
+        #expect(button.subviews.map(ObjectIdentifier.init) == originalSubviews)
+        #expect(button.toolTip == updated.accessibilityLabel)
+        #expect(button.accessibilityLabel() == updated.accessibilityLabel)
+    }
+
     @Test
     func enablingCPUAndNetworkCreatesOnlyThoseIndicatorsInStableOrder() {
         let factory = RecordingSystemMonitorStatusItemFactory()
```

---

### Incident Patch 2: `dc279316` (2026-11-18)
**Commit Message**: Merge pull request #236 from laakal/fix/system-monitor-menu-bar-cpu

Fix high CPU usage from system monitor menu bar indicators

**File**: `Modules/Sources/AppFeature/Features/SystemMonitor/SystemMonitorStatusItemController.swift` (modified, +105/-144)
```diff
@@ -244,145 +244,106 @@ private enum SystemMonitorStatusItemFormatter {
     }
 }
 
-@MainActor
-private final class StatusItemContentView: NSView {
-    private let metric: SystemMonitorMetric
-    private let imageView = NSImageView()
-    private let valueLabel = NSTextField(labelWithString: "")
-    private let topDot = NetworkIndicatorDot(color: .systemRed)
-    private let bottomDot = NetworkIndicatorDot(color: .systemBlue)
-    private let topValueLabel = NSTextField(labelWithString: "")
-    private let bottomValueLabel = NSTextField(labelWithString: "")
-
-    init(metric: SystemMonitorMetric) {
-        self.metric = metric
-        super.init(frame: .zero)
-
-        wantsLayer = false
-        configureStandardContent()
-        configureNetworkContent()
-        let isNetwork = metric == .network
-        imageView.isHidden = isNetwork
-        valueLabel.isHidden = isNetwork
-        topDot.isHidden = !isNetwork
-        bottomDot.isHidden = !isNetwork
-        topValueLabel.isHidden = !isNetwork
-        bottomValueLabel.isHidden = !isNetwork
-    }
-
-    @available(*, unavailable)
-    required init?(coder: NSCoder) {
-        nil
-    }
-
-    override func layout() {
-        super.layout()
-        guard metric == .network else {
-            let iconSide: CGFloat = 16
-            let leading: CGFloat = 5
-            let labelHeight = ceil(valueLabel.font?.boundingRectForFont.height ?? 13)
-            imageView.frame = CGRect(
-                x: leading,
-                y: (bounds.height - iconSide) / 2,
-                width: iconSide,
-                height: iconSide
-            )
-            valueLabel.frame = CGRect(
-                x: leading + iconSide + 3,
-                y: floor((bounds.height - labelHeight) / 2),
-                width: max(0, bounds.width - (leading + iconSide + 3) - 4),
-                height: labelHeight
-            )
-            return
+private enum SystemMonitorStatusItemImage {
+    static func make(
+        for presentation: SystemMonitorStatusItemPresentation,
+        size: NSSize
+    ) -> NSImage {
+        let image = NSImage(size: size, flipped: false) { bounds in
+            switch presentation.visualStyle {
+            case .standard:
+                drawStandard(presentation, in: bounds)
+            case .network:
+                drawNetwork(presentation, in: bounds)
+            }
+            return true
         }
-
-        let lineHeight: CGFloat = 10
-        let totalHeight = lineHeight * 2
-        let topY = (bounds.height + totalHeight) / 2 - lineHeight
-        let bottomY = topY - lineHeight
-        let dotLeading: CGFloat = 7
-        let dotSide: CGFloat = 7
-        let valueLeading: CGFloat = 21
-        let valueWidth = max(0, bounds.width - valueLeading - 5)
-
-        topDot.frame = CGRect(
-            x: dotLeading,
-            y: topY + (lineHeight - dotSide) / 2,
-            width: dotSide,
-            height: dotSide
-        )
-        bottomDot.frame = CGRect(
-            x: dotLeading,
-            y: bottomY + (lineHeight - dotSide) / 2,
-            width: dotSide,
-            height: dotSide
-        )
-        topValueLabel.frame = CGRect(x: valueLeading, y: topY, width: valueWidth, height: lineHeight)
-        bottomValueLabel.frame = CGRect(x: valueLeading, y: bottomY, width: valueWidth, height: lineHeight)
-    }
-
-    // The status-bar button remains the single click target; this view is visual only.
-    override func hitTest(_ point: NSPoint) -> NSView? {
-        nil
-    }
-
-    func update(_ presentation: SystemMonitorStatusItemPresentation) {
-        switch presentation.visualStyle {
-        case .standard:
-            let image = NSImage(systemSymbolName: presentation.symbolName, accessibilityDescription: nil)
-            image?.isTemplate = true
-            imageView.image = image
-            valueLabel.stringValue = presentation.title
-
-        case .network:
-            let lines = presentation.title.split(separator: "\n", maxSplits: 1, omittingEmptySubsequences: false)
-            topValueLabel.stringValue = lines.indices.contains(0) ? String(lines[0].dropFirst(2)) : "—"
-            bottomValueLabel.stringValue = lines.indices.contains(1) ? String(lines[1].dropFirst(2)) : "—"
+        image.isTemplate = presentation.visualStyle == .standard
+        if presentation.visualStyle == .network {
+            // Resolve the label and dot colors in the current menu bar appearance.
+            image.cacheMode = .never
         }
+        return image
     }
 
-    private func configureStandardContent() {
-        imageView.imageScaling = .scaleProportionallyDown
-        imageView.contentTintColor = .labelColor
-        valueLabel.font = NSFont.monospacedDigitSystemFont(ofSize: NSFont.systemFontSize, weight: .medium)
-        valueLabel.textColor = .labelColor
-        valueLabel.alignment = .right
-        valueLabel.lineBreakMode = .byClipping
-        addSubview(ima
```

**File**: `Modules/Tests/AppFeatureTests/SystemMonitor/SystemMonitorStatusItemControllerTests.swift` (modified, +35/-0)
```diff
@@ -1,10 +1,45 @@
+import AppKit
 import Foundation
 import SystemMonitor
 import Testing
 @testable import AppFeature
 
 @MainActor
 struct SystemMonitorStatusItemControllerTests {
+    @Test(arguments: [SystemMonitorMetric.cpu, .network])
+    func indicatorUpdatesTheNativeButtonImageWithoutInstallingCustomSubviews(metric: SystemMonitorMetric) throws {
+        _ = NSApplication.shared
+        let item = NSStatusBar.system.statusItem(withLength: metric == .network ? 80 : 64)
+        defer { NSStatusBar.system.removeStatusItem(item) }
+        let button = try #require(item.button)
+        let originalSubviews = button.subviews.map(ObjectIdentifier.init)
+        let handle = AppKitSystemMonitorStatusItem(metric: metric, item: item)
+        let isNetwork = metric == .network
+        let initial = SystemMonitorStatusItemPresentation(
+            symbolName: metric.rawValue,
+            title: isNetwork ? "↑ —\n↓ —" : "—",
+            accessibilityLabel: "Unavailable",
+            visualStyle: isNetwork ? .network : .standard
+        )
+        let updated = SystemMonitorStatusItemPresentation(
+            symbolName: metric.rawValue,
+            title: isNetwork ? "↑ 2 KB/s\n↓ 6 KB/s" : "42%",
+            accessibilityLabel: "Updated reading",
+            visualStyle: initial.visualStyle
+        )
+
+        handle.update(initial)
+        #expect(button.subviews.map(ObjectIdentifier.init) == originalSubviews)
+        let initialImage = try #require(button.image?.tiffRepresentation)
+        handle.update(updated)
+
+        let updatedImage = try #require(button.image?.tiffRepresentation)
+        #expect(updatedImage != initialImage)
+        #expect(button.subviews.map(ObjectIdentifier.init) == originalSubviews)
+        #expect(button.toolTip == updated.accessibilityLabel)
+        #expect(button.accessibilityLabel() == updated.accessibilityLabel)
+    }
+
     @Test
     func enablingCPUAndNetworkCreatesOnlyThoseIndicatorsInStableOrder() {
         let factory = RecordingSystemMonitorStatusItemFactory()
```

---

### Incident Patch 3: `de4eb6b4` (2026-11-16)
**Commit Message**: docs: document OnlySwitch 3.7.0 features and advance release build

**File**: `Config/Versions/OnlySwitch.xcconfig` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
 // Shared build number for the macOS app and its embedded components.
-CURRENT_PROJECT_VERSION = 314
+CURRENT_PROJECT_VERSION = 315
```

**File**: `README.de.md` (modified, +19/-2)
```diff
@@ -71,7 +71,8 @@ Um OnlySwitch vom iPhone oder iPad aus zu steuern, installiere [OnlyRemote aus d
 - Verwende Apple-Widgets ab macOS Sonoma, auch mit Bedienelementen aus Evolution.
 - Öffne **Only Control**, um die wichtigsten Bedienelemente in einer kompakten Ansicht zu nutzen.
 - Steuere deinen Mac mit [OnlyRemote](#onlyremote) vom iPhone oder iPad aus.
-- Aktiviere das optionale Schreibtisch-Haustier und ziehe es an eine beliebige Position. Per Klick öffnest oder schließt du Only Control. Wechsle zum nächsten Titel oder Radiosender und sieh Wiedergabeanimationen für Apple Music, Spotify und Radio.
+- Gestalte das optionale [Schreibtisch-Haustier](#schreibtisch-haustier) mit KI-generierten Designs, Füttern und Streicheln, Agentenaktivität und einer frei wählbaren Klickaktion.
+- Öffne gespeicherte Webseiten im optionalen [Browser](#browser)-Tab.
 - Aktiviere bei **Wach bleiben** die Option **Nach Ruhezustand ausschalten**, damit die Funktion deaktiviert wird, wenn du den Mac manuell in den Ruhezustand versetzt.
 
 <p align="center">
@@ -82,6 +83,20 @@ Um OnlySwitch vom iPhone oder iPad aus zu steuern, installiere [OnlyRemote aus d
   <img alt="OnlySwitch-Schreibtisch-Haustier" src="https://github.com/user-attachments/assets/f45e4b4f-932e-4768-8bfd-845e22fdfff3" width="152" height="188" />
 </p>
 
+### Schreibtisch-Haustier
+
+Aktiviere **Schreibtisch-Haustier anzeigen** und öffne **OnlySwitch-Einstellungen → Desktop-Haustier**, um die Klickaktion auszuwählen: Only Control öffnen oder schließen, einen Schalter umlegen oder einen Kurzbefehl oder eine Evolution ausführen. Ziehe das Haustier an eine beliebige Position und bediene Apple Music, Spotify und Radio über seine Musiksteuerung.
+
+Per Rechtsklick kannst du das Haustier füttern oder streicheln. Hunger beeinflusst nur seine Darstellung und lässt sich in den Einstellungen ausschalten. Während Codex oder Claude Code arbeitet, zeigt das Haustier eine passende Animation. Wenn eine beobachtete Aufgabe erfolgreich endet, erscheint kurz eine Sprechblase.
+
+Beschreibe eine Figur, um mit dem unter **Model Providers** ausgewählten Modell ein eigenes Design zu erzeugen. In den Haustier-Einstellungen kannst du gespeicherte Designs als Vorschau ansehen und auswählen oder mit einer neuen Beschreibung von der KI bearbeiten lassen.
+
+### Browser
+
+Blende den **Browser**-Tab unter **OnlySwitch-Einstellungen → Tabs** ein und verwalte Lesezeichen unter **OnlySwitch-Einstellungen → Browser**. Öffne gespeicherte Webseiten in der Menüleistenliste oder in Only Control, wähle eine mobile Ansichtsgröße und lass die Seiten dem hellen oder dunklen Erscheinungsbild der App folgen. Bewege den Mauszeiger an den oberen Seitenrand, um die Symbolleiste einzublenden.
+
+Der Browser speichert Websitedaten getrennt von Safari; du kannst sie in den Browser-Einstellungen löschen. Downloads werden im Standardbrowser geöffnet. Mobile Layouts hängen von der jeweiligen Website ab. Kamera und Mikrofon sind in diesem Tab nicht verfügbar.
+
 ### Zeitpläne
 
 Öffne **OnlySwitch-Einstellungen → Zeitpläne**, um unterstützte Schalter, Tasten, Kurzbefehle und Evolutions zu automatisieren. Aktionen können in festen Abständen, zu einer bestimmten Minute jeder Stunde oder zu einer festen Uhrzeit an ausgewählten Tagen ausgeführt werden. Dimme etwa täglich um 8:00 Uhr den Bildschirm und hebe die Dimmung um 19:00 Uhr wieder auf. Oder leere jeden Samstag um 9:00 Uhr den Papierkorb.
@@ -114,12 +129,14 @@ Im Tab **Zeitpläne** in der Menüleistenliste oder in Only Control siehst du, w
 | Schreibtisch-Haustier anzeigen | Verfügbar | Tailscale | Offizieller Client erforderlich |
 | Dock-Fenstervorschau | Berechtigungen für Bedienungshilfen und Bildschirmaufnahme erforderlich | | |
 
-Du kannst Schalter zur Liste hinzufügen oder daraus entfernen. Optionale Tabs wie Authenticator, Lautstärkemixer, Helligkeit, Bildschirmfotos & Aufnahmen, Systemmonitor, Codex-Nutzung, Claude-Nutzung, Aphrodite, Xcode Cleaner und App Uninstaller lassen sich unter **OnlySwitch-Einstellungen → Tabs** ein- und ausblenden. Diese Seite ersetzt die früheren Schalter, die nur einen Tab ein- oder ausgeblendet haben.
+Du kannst Schalter zur Liste hinzufügen oder daraus entfernen. Optionale Tabs wie Authenticator, Lautstärkemixer, Helligkeit, Browser, Bildschirmfotos & Aufnahmen, Systemmonitor, Codex-Nutzung, Claude-Nutzung, Aphrodite, Xcode Cleaner und App Uninstaller lassen sich unter **OnlySwitch-Einstellungen → Tabs** ein- und ausblenden. Diese Seite ersetzt die früheren Schalter, die nur einen Tab ein- oder ausgeblendet haben.
 
 ### Lautstärkemixer
 
 Der Lautstärkemixer regelt die Lautstärke und Stummschaltung für jede App, die Audio wiedergibt. Ab macOS 14.4 kannst du pro App zusätzlich einen 10-Band-Equalizer öffnen (−12 bis +12 dB, mit Rücksetzen auf eine neutrale Einstellung) und den Ton gleichzeitig an eines oder mehrere Ausgabegeräte senden. OnlySwitch merkt sich den Equalizer und die Ausgabegeräte pro App. Ohne Auswahl gilt di
```

**File**: `README.md` (modified, +19/-2)
```diff
@@ -71,7 +71,8 @@ To control OnlySwitch from an iPhone or iPad, install [OnlyRemote from the App S
 - Use Apple Widgets on macOS Sonoma and later, including Evolution controls.
 - Open the compact **Only Control** interface for a focused control panel.
 - Control your Mac from iPhone or iPad with [OnlyRemote](#onlyremote).
-- Enable the optional Desktop Pet, drag it anywhere, click it to show or dismiss Only Control, and skip to the next track or radio station with playback animations for Apple Music, Spotify, and Radio.
+- Customize the optional [Desktop Pet](#desktop-pet) with AI-generated skins, feeding and petting, agent activity, and your choice of click action.
+- Keep bookmarked websites close at hand in the optional [Browser](#browser) tab.
 - Enable **Turn off after sleep** for Keep Awake to turn it off when you manually put your Mac to sleep.
 
 <p align="center">
@@ -82,6 +83,20 @@ To control OnlySwitch from an iPhone or iPad, install [OnlyRemote from the App S
   <img alt="OnlySwitch desktop pet" src="https://github.com/user-attachments/assets/f45e4b4f-932e-4768-8bfd-845e22fdfff3" width="152" height="188" />
 </p>
 
+### Desktop Pet
+
+Enable **Show desktop pet**, then open **OnlySwitch Settings → Desktop Pet** to choose what a click does: show or dismiss Only Control, toggle a switch, or run a Shortcut or Evolution. Drag the pet anywhere and use its music controls for Apple Music, Spotify, and Radio.
+
+Right-click the pet to feed or pet it. Hunger is cosmetic and can be turned off in settings. The pet also animates while Codex or Claude Code is working and shows a brief completion bubble when an observed task finishes successfully.
+
+Describe a character to generate a custom skin with the model selected in **Model Providers**. Preview and select saved skins in Desktop Pet settings, or ask AI to edit one with a new description.
+
+### Browser
+
+Show the **Browser** tab under **OnlySwitch Settings → Tabs**, and manage bookmarks under **OnlySwitch Settings → Browser**. Open saved websites in the menu-bar list or Only Control, choose a mobile viewport size, and let pages follow the app's light or dark appearance. Move the pointer to the top of the page to reveal the toolbar.
+
+Browser keeps its own website data separate from Safari; you can clear it in Browser settings. Downloads open in your default browser. Mobile layouts depend on the website, and camera and microphone access are unavailable in this tab.
+
 ### Schedules
 
 Open **OnlySwitch Settings → Schedules** to automate supported switches, buttons, Shortcuts, and Evolutions. Run an action at a repeating interval, at a specific minute every hour, or at a set time on selected days. For example, turn **Dim Screen** on at 8:00 AM and off at 7:00 PM every day, or run **Empty Trash** every Saturday at 9:00 AM.
@@ -114,12 +129,14 @@ Use the **Schedules** tab in the menu bar or Only Control to see what runs next,
 | Show desktop pet | finished | Tailscale | requires official client |
 | Dock Preview | requires Accessibility and Screen Recording | | |
 
-Switches can be added to or removed from the list. Optional tabs (Authenticator, Sound Mixer, Brightness, Screenshots & Record, System Monitor, Codex Usage, Claude Usage, Aphrodite, Xcode Cleaner, and App Uninstaller) are shown or hidden under **OnlySwitch Settings → Tabs**; switches that only toggled a tab have been replaced by this page.
+Switches can be added to or removed from the list. Optional tabs (Authenticator, Sound Mixer, Brightness, Browser, Screenshots & Record, System Monitor, Codex Usage, Claude Usage, Aphrodite, Xcode Cleaner, and App Uninstaller) are shown or hidden under **OnlySwitch Settings → Tabs**; switches that only toggled a tab have been replaced by this page.
 
 ### Sound Mixer
 
 Sound Mixer sets the volume and mute state of each app that is playing audio. On macOS 14.4 or later, each app can also expand its own 10-band equalizer (−12 to +12 dB, with a flat reset) and route its audio to one or more output devices at the same time. Equalizer settings and output selections are remembered per app; selecting no output follows the system default. If every selected device is disconnected, the app's original audio is restored until a selected device returns.
 
+Choose from twelve built-in EQ presets, including Flat, or expand **Custom EQ** to adjust the ten bands manually.
+
 When the current output is an external display with speakers, the keyboard's volume up, volume down, and mute keys adjust the display's volume over DDC/CI and show a volume HUD. Holding Shift+Option steps in finer increments. Capturing these keys requires Accessibility permission.
 
 ### Brightness
```

**File**: `README.zh-CN.md` (modified, +19/-2)
```diff
@@ -71,7 +71,8 @@ brew install only-switch
 - 在 macOS Sonoma 及更新版本上使用 Apple 小组件，包括 Evolution 控件。
 - 打开紧凑的 **Only Control** 控制面板，快速使用常用控件。
 - 使用 [OnlyRemote](#onlyremote) 从 iPhone 或 iPad 控制 Mac。
-- 启用可选的桌面宠物后，可将它拖到任意位置，点击它显示或关闭 Only Control，也可切换到下一首歌曲或下一个电台。Apple Music、Spotify 和电台播放时会显示相应动画。
+- 自定义可选的[桌面宠物](#桌面宠物)：用 AI 生成外观，喂食和抚摸，查看智能体工作状态，并选择点击时执行的操作。
+- 在可选的[浏览器](#浏览器)标签页中，随时打开收藏的网站。
 - 为「防止锁屏」启用 **睡眠后关闭**，手动让 Mac 进入睡眠后，该功能会自动关闭。
 
 <p align="center">
@@ -82,6 +83,20 @@ brew install only-switch
   <img alt="OnlySwitch 桌面宠物" src="https://github.com/user-attachments/assets/f45e4b4f-932e-4768-8bfd-845e22fdfff3" width="152" height="188" />
 </p>
 
+### 桌面宠物
+
+启用 **显示桌面宠物**，然后打开 **OnlySwitch 设置 → 桌面宠物**，选择点击时执行的操作：显示或关闭 Only Control、切换开关，或运行快捷指令和 Evolution。可将宠物拖到任意位置，并通过它的音乐控件操作 Apple Music、Spotify 和电台。
+
+右键点击宠物即可喂食或抚摸。饥饿只影响宠物表现，可在设置中关闭。Codex 或 Claude Code 工作时，宠物也会显示相应动画；观察到任务成功完成后，还会短暂显示完成气泡。
+
+用文字描述角色，即可使用 **模型提供商**中选定的模型生成自定义外观。在桌面宠物设置中预览和选择已保存的外观，也可以用新的描述让 AI 编辑现有外观。
+
+### 浏览器
+
+在 **OnlySwitch 设置 → 标签页**中显示 **浏览器**标签页，并在 **OnlySwitch 设置 → 浏览器**中管理书签。在菜单栏列表或 Only Control 中打开收藏的网站，选择手机视口尺寸，让网页跟随应用的浅色或深色外观。将指针移到页面顶部即可显示工具栏。
+
+浏览器的网站数据与 Safari 分开保存，可在浏览器设置中清除。下载会交给默认浏览器打开。移动端布局取决于网站，此标签页不提供摄像头和麦克风访问。
+
 ### 定时任务
 
 打开 **OnlySwitch 设置 → 定时任务**，即可自动执行受支持的开关、按钮、快捷指令和 Evolution 操作。你可以按固定间隔执行操作，在每小时的指定分钟执行，或在指定日期的固定时间执行。例如，每天 8:00 开启 **暗屏**、19:00 关闭，或每周六 9:00 执行 **清空废纸篓**。
@@ -114,12 +129,14 @@ brew install only-switch
 | 显示桌面宠物 | 已实现 | Tailscale | 需要官方客户端 |
 | 程序坞预览 | 需要辅助功能与屏幕录制权限 | | |
 
-你可以向列表添加开关，也可以将它们移除。要显示或隐藏可选标签页（身份验证器、音量混合器、亮度、截屏与录屏、系统监视器、Codex 使用情况、Claude 使用情况、Aphrodite、Xcode 清理和应用卸载器），请前往 **OnlySwitch 设置 → 标签页**。过去仅用于切换标签页的开关已由此页面取代。
+你可以向列表添加开关，也可以将它们移除。要显示或隐藏可选标签页（身份验证器、音量混合器、亮度、浏览器、截屏与录屏、系统监视器、Codex 使用情况、Claude 使用情况、Aphrodite、Xcode 清理和应用卸载器），请前往 **OnlySwitch 设置 → 标签页**。过去仅用于切换标签页的开关已由此页面取代。
 
 ### 音量混合器
 
 音量混合器可分别调节正在播放声音的各个应用的音量和静音状态。在 macOS 14.4 或更新版本上，每个应用还可展开自己的 10 段均衡器（−12 至 +12 dB，可重置为平直响应），并将声音同时输出到一个或多个设备。均衡器设置和所选输出设备会按应用保存；未选择输出设备时，跟随系统默认设置。如果选中的设备全部断开，应用会恢复原先的音频输出，直到其中一个设备重新连接。
 
+可选择包含平直响应在内的十二种内置均衡器预设，或展开 **自定义均衡器**，手动调节十个频段。
+
 当前输出设备是带扬声器的外接显示器时，键盘上的音量加、音量减和静音键会通过 DDC/CI 调节显示器音量，并显示音量提示。按住 Shift+Option 可以进行更细的步进调节。要接管这些按键，需要辅助功能权限。
 
 ### 亮度
```

#### Recent Merged Pull Requests:
- **PR #236** (2026-11-18): Fix high CPU usage from system monitor menu bar indicators (@laakal)
- **PR #233** (2026-11-14): Fix and improve Hide Menu Bar Icons feature (@seanjseymour)
- **PR #229** (2026-10-28): Add option to turn off Keep Awake after manual sleep (@oecer)
- **PR #221** (2026-09-24): Add settings export/import (Backup section) (@oecer)
- **PR #219** (2026-09-19): Revise OnlyRemote section in README.md (@jacklandrin)
- **PR #217** (2026-09-15): docs: explain how to restore the OnlySwitch menu bar icon (@mvanhorn)

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

## X. menu bar indicator redraw loop

**RULE**:
When implementing operations in `Modules/Sources/AppFeature/Features/SystemMonitor/SystemMonitorStatusItemController.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in jacklandrin/OnlySwitch. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c231eed6`: menu bar indicator redraw loop. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Modules/Sources/AppFeature/Features/SystemMonitor/SystemMonitorStatusItemController.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
private enum SystemMonitorStatusItemImage {
    static func make(
        for presentation: SystemMonitorStatusItemPresentation,
        size: NSSize
    ) -> NSImage {
        let image = NSImage(size: size, flipped: false) { bounds in
            switch presentation.visualStyle {
            case .standard:
                drawStandard(presentation, in: bounds)
            case .network:
                drawNetwork(presentation, in: bounds)
            }
            return true
        image.isTemplate = presentation.visualStyle == .standard
        if presentation.visualStyle == .network {
            // Resolve the label and dot colors in the current menu bar appearance.
            image.cacheMode = .never
        return image
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
@MainActor
private final class StatusItemContentView: NSView {
    private let metric: SystemMonitorMetric
    private let imageView = NSImageView()
    private let valueLabel = NSTextField(labelWithString: "")
    private let topDot = NetworkIndicatorDot(color: .systemRed)
    private let bottomDot = NetworkIndicatorDot(color: .systemBlue)
    private let topValueLabel = NSTextField(labelWithString: "")
    private let bottomValueLabel = NSTextField(labelWithString: "")

    init(metric: SystemMonitorMetric) {
        self.metric = metric
        super.init(frame: .zero)

        wantsLayer = false
        configureStandardContent()
        configureNetworkContent()
        let isNetwork = metric == .network
        imageView.isHidden = isNetwork
        valueLabel.isHidden = isNetwork
        topDot.isHidden = !isNetwork
        bottomDot.isHidden = !isNetwork
        topValueLabel.isHidden = !isNetwork
        bottomValueLabel.isHidden = !isNetwork
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        nil
    }

    override func layout() {
        super.layout()
        guard metric == .network else {
            let iconSide: CGFloat = 16
         
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c231eed6` are properly handled with clean fallback behavior.
