# Forensic Learning Record (Deep Inspection): ronitsingh10/FineTune

> **Canonical Artifact**: `07_PROJECT_LEARNING/ronitsingh10-finetune-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ronitsingh10/FineTune](https://github.com/ronitsingh10/FineTune))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:22:19.837Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ronitsingh10/FineTune`
- **Description**: FineTune, a macOS menu bar app for per-app volume control, multi-device output, audio routing, and 10-band EQ. Free and open-source alternative to SoundSource.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9562 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `FineTune/Audio/Engine/AppListCoordinator.swift`
```
// FineTune/Audio/Engine/AppListCoordinator.swift
import Foundation

/// Owns the app-list surface that is pure `SettingsManager` persistence: pinning,
/// the persistence half of ignoring, and per-inactive-app settings. Live tap/engine
/// state (tap teardown on ignore, re-provisioning on unignore) stays in `AudioEngine`,
/// which holds this coordinator and forwards its public app-list API here.
@MainActor
final class AppListCoordinator {
    private let settingsManager: SettingsManager

    init(settingsManager: SettingsManager) {
        self.settingsManager = settingsManager
    }

    // MARK: - Pinning

    func pinApp(_ app: AudioApp) {
        let info = PinnedAppInfo(
            persistenceIdentifier: app.persistenceIdentifier,
            displayName: app.name,
            bundleID: app.bundleID
        )
        settingsManager.pinApp(app.persistenceIdentifier, info: info)
    }

    func unpinApp(_ identifier: String) {
        settingsManager.unpinApp(identifier)
    }

    func isPinned(_ app: AudioApp) -> Bool {
        settingsManager.isPinned(app.persistenceIdentifier)
    }

    func isPinned(identifier: String) -> Bool {
        settingsManager.isPinned(identifier)
    }

    func pinnedAppInfo() -> [PinnedAppInfo] {
        settingsManager.getPinnedAppInfo()
    }

    // MARK: - Ignored Apps (persistence half; tap teardown stays in AudioEngine)

    func recordIgnore(_ app: AudioApp) {
        let info = IgnoredAppInfo(
            persistenceIdentifier: app.persistenceIdentifier,
            displayName: app.name,
            bundleID: app.bundleID
        )
        settingsManager.ignoreApp(app.persistenceIdentifier, info: info)
    }

    func clearIgnore(_ identifier: String) {
        settingsManager.unignoreApp(identifier)
    }

    func isIgnored(identifier: String) -> Bool {
        settingsManager.isIgnored(identifier)
    }

    // MARK: - Inactive App Settings (by persistence identifier)

    func getVolumeForInactive(identifier: String) -> Float {
        settingsManager.getVolume(for: identifier) ?? 1.0
    }

    func setVolumeForInactive(identifier: String, to volume: Float) {
        settingsManager.setVolume(for: identifier, to: volume)
    }

    func getBoostForInactive(identifier: String) -> BoostLevel {
        settingsManager.getBoost(for: identifier) ?? .x1
    }

    func setBoostForInactive(identifier: String, to boost: BoostLevel) {
        settingsManager.setBoost(for: identifier, to: boost)
    }

    func getMuteForInactive(identifier: String) -> Bool {
        settingsManager.getMute(for: identifier) ?? false
    }

    func setMuteForInactive(identifier: String, to muted: Bool) {
        settingsManager.setMute(for: identifier, to: muted)
    }

    func getEQSettingsForInactive(identifier: String) -> EQSettings {
        settingsManager.getEQSettings(for: identifier)
    }

    func setEQSettingsForInactive(_ settings: EQSettings, identifier: String) {
        settingsManager.setEQSettings(settings, for: identifier)
    }

    func getDeviceRoutingForInactive(identifier: String) -> String? {
        settingsManager.getDeviceRouting(for: identifier)
    }

    func setDeviceRoutingForInactive(identifier: String, deviceUID: String?) {
        if let deviceUID = deviceUID {
            settingsManager.setDeviceRouting(for: identifier, deviceUID: deviceUID)
        } else {
            settingsManager.setFollowDefault(for: identifier)
        }
    }

    func isFollowingDefaultForInactive(identifier: String) -> Bool {
        settingsManager.isFollowingDefault(for: identifier)
    }

    func getDeviceSelectionModeForInactive(identifier: String) -> DeviceSelectionMode {
        settingsManager.getDeviceSelectionMode(for: identifier) ?? .single
    }

    func setDeviceSelectionModeForInactive(identifier: String, to mode: DeviceSelectionMode) {
        settingsManager.setDeviceSelectionMode(for: identifier, to: mode)
    }

    func getSelectedDeviceUIDsForInactive(identifier: String) -> Set<String> {
        settingsManager.getSelectedDeviceUIDs(for: identifier) ?? []
    }

    func setSelectedDeviceUIDsForInactive(identifier: String, to uids: Set<String>) {
        settingsManager.setSelectedDeviceUIDs(for: identifier, to: uids)
    }
}

```

### Core Architecture Module: `FineTune/Audio/Engine/AudioEngine.swift`
```
// FineTune/Audio/Engine/AudioEngine.swift
import AudioToolbox
import Foundation
import os
import UserNotifications

@Observable
@MainActor
final class AudioEngine {
    let processMonitor: any AudioProcessMonitoring
    let deviceMonitor: any AudioDeviceProviding
    let bluetoothDeviceMonitor: BluetoothDeviceMonitor
    let deviceVolumeMonitor: any DeviceVolumeProviding
    let volumeState: VolumeState
    let settingsManager: SettingsManager
    let autoEQProfileManager: AutoEQProfileManager
    let permission: AudioRecordingPermission
    let appListCoordinator: AppListCoordinator

    #if !APP_STORE
    let ddcController: DDCController
    #endif

    private var taps: [pid_t: any ProcessTapControlling] = [:]

    /// Factory for creating tap controllers. Overridable for testing.
    private let tapFactory: @MainActor (AudioApp, [String], String?) throws -> any ProcessTapControlling

    /// Closure to check if a device is alive. Overridable for testing.
    private let isAliveCheck: (AudioDeviceID) -> Bool

    /// One-shot HAL listeners for devices that were present but not alive during priority resolution.
    /// Keyed by AudioDeviceID. Each entry holds the device UID, listener block, and a timeout task.
    private var aliveWatchers: [AudioDeviceID: (uid: String, block: AudioObjectPropertyListenerBlock, timeout: Task<Void, Never>)] = [:]

    /// Number of pending alive watchers (exposed for testing).
    var pendingAliveWatcherCount: Int { aliveWatchers.count }

    private var appliedPIDs: Set<pid_t> = []
    private var appDeviceRouting: [pid_t: String] = [:]  // pid → deviceUID (always explicit)
    private var followsDefault: Set<pid_t> = []  // Apps that follow system default
    /// The last output default confirmed by FineTune (user change or programmatic switch).
    /// Used to restore after macOS auto-switches to a lower-priority device.
    private var lastConfirmedDefaultUID: String?
    /// Timestamp of the last auto-switch override. Used to distinguish rapid BT auto-switches
    /// (< 1s apart) from deliberate user changes (> 1s after last override).
    private var lastAutoSwitchOverrideTime: Date?
    private var pendingCleanup: [pid_t: Task<Void, Never>] = [:]  // Grace period for stale tap cleanup
    private var staleCleanupTask: Task<Void, Never>?  // Debounced cleanup scheduling
    private var healthMonitorTask: Task<Void, Never>?  // Periodic tap health monitor
    private var tapRecoveryCooldownUntil: [pid_t: Date] = [:]  // Prevents tap recreation thrashing
    private let logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "FineTune", category: "AudioEngine")

    // MARK: - Priority State Machine

    /// Tracks whether we're waiting for macOS to potentially auto-switch after a device connect.
    private enum PriorityState {
        case stable
        case pendingAutoSwitch(connectedDeviceUID: String, timeoutTask: Task<Void, Never>)
    }

    private var outputPriorityState: PriorityState = .stable
    private var inputPriorityState: PriorityState = .stable

    /// Grace period for auto-switch detection (wired devices)
    private let autoSwitchGracePeriod: TimeInterval = 2.0

    /// Extended grace period for Bluetooth devices (firmware handshake takes longer)
    private let btAutoSwitchGracePeriod: TimeInterval = 5.0

    // MARK: - Echo Suppression

    private let outputEchoTracker = EchoTracker(label: "Output")
    private let inputEchoTracker = EchoTracker(label: "Input")

    var outputDevices: [AudioDevice] {
        deviceMonitor.outputDevices
    }

    func outputVolumeBackend(for deviceID: AudioDeviceID) -> VolumeControlTier {
        deviceVolumeMonitor.outputVolumeBackend(for: deviceID)
    }

    var inputDevices: [AudioDevice] {
        deviceMonitor.inputDevices
    }

    /// Output devices sorted by user-defined priority order.
    /// Devices in the priority list appear in that order; new/unknown devices are appended alphabetically.
    var prioritySortedOutputDevices: [AudioDevice] {
        let devices = outputDevices
        let priorityOrder = settingsManager.devicePriorityOrder
        let devicesByUID = Dictionary(devices.map { ($0.uid, $0) }, uniquingKeysWith: { _, latest in latest })

        // Collect devices in priority order (skip stale UIDs)
        var sorted: [AudioDevice] = []
        var seen = Set<String>()
        for uid in priorityOrder {
            if let device = devicesByUID[uid] {
                sorted.append(device)
                seen.insert(uid)
            }
        }

        // Append new devices alphabetically
        let remaining = devices
            .filter { !seen.contains($0.uid) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        sorted.append(contentsOf: remaining)

        return sorted
    }

    /// Input devices sorted by user-defined priority order.
    var prioritySortedInputDevices: [AudioDevice] {
        let devices = inputDevices
        let priorityOrder = settingsManager.inputDevicePriorityOrder
        let devicesByUID = Dictionary(devices.map { ($0.uid, $0) }, uniquingKeysWith: { _, latest in latest })

        var sorted: [AudioDevice] = []
        var seen = Set<String>()
        for uid in priorityOrder {
            if let device = devicesByUID[uid] {
                sorted.append(device)
                seen.insert(uid)
            }
        }

        let remaining = devices
            .filter { !seen.contains($0.uid) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        sorted.append(contentsOf: remaining)

        return sorted
    }

    /// Registers any output devices not yet in the priority list.
    /// Call this when devices change (not from computed properties).
    func registerNewDevicesInPriority() {
        for device in outputDevices {
            settingsManager.ensureDeviceInPriority(device.uid)
        }
        for device in inputDevices {
            settingsManager.ensureInputDeviceInPriority(device.uid)
        }
    }

    /// Returns the highest-priority device that is both connected and alive.
    /// `isDeviceAlive()` is checked internally — callers never need to check separately.
    static func resolveHighestPriority(
        priorityOrder: [String],
        connectedDevices: [AudioDevice],
        excluding: String? = nil,
        isAlive: ((AudioDeviceID) -> Bool)? = nil
    ) -> AudioDevice? {
        let aliveCheck = isAlive ?? { $0.isDeviceAlive() }
        let connected = Dictionary(
            connectedDevices.map { ($0.uid, $0) },
            uniquingKeysWith: { _, latest in latest }
        )
        for uid in priorityOrder {
            guard uid != excluding,
                  let device = connected[uid],
                  aliveCheck(device.id) else { continue }
            return device
        }
        // Fallback: any alive connected device not excluded
        return connectedDevices.first {
            $0.uid != excluding && aliveCheck($0.id)
        }
    }


    init(
        permission: AudioRecordingPermission,
        settingsManager: SettingsManager,
        autoEQProfileManager: AutoEQProfileManager,
        deviceProvider: (any AudioDeviceProviding)? = nil,
        processMonitor: (any AudioProcessMonitoring)? = nil,
        deviceVolumeMonitor: (any DeviceVolumeProviding)? = nil,
        tapFactory: (@MainActor (AudioApp, [String], String?) throws -> any ProcessTapControlling)? = nil,
        isAlive: ((AudioDeviceID) -> Bool)? = nil,
        startMonitorsAutomatically: Bool = true
    ) {
        self.permission = permission
        let manager = settingsManager
        self.settingsManager = manager
        self.appListCoordinator = AppListCoordinator(settingsManager: manager)
        self.autoEQProfileManager = autoEQProfileManager
        self.volumeState = VolumeState(settingsManager: manager)
        self.isAliveCheck = isAlive ?? { $0.isDeviceAlive() }

        // If a custom deviceProvider is given, use it directly.
        // Otherwise create a real AudioDeviceMonitor (needed by DeviceVolumeMonitor and default tap factory).
        let realDeviceMonitor: AudioDeviceMonitor?
        if let provider = deviceProvider {
            realDeviceMonitor = provider as? AudioDeviceMonitor
            self.deviceMonitor = provider
        } else {
            let monitor = AudioDeviceMonitor()
            realDeviceMonitor = monitor
            self.deviceMonitor = monitor
        }
        self.processMonitor = processMonitor ?? AudioProcessMonitor()
        self.bluetoothDeviceMonitor = BluetoothDeviceMonitor()

        #if !APP_STORE
        let ddc = DDCController(settingsManager: manager)
        self.ddcController = ddc
        if let dvMonitor = deviceVolumeMonitor {
            self.deviceVolumeMonitor = dvMonitor
        } else {
            guard let realDeviceMonitor else {
                preconditionFailure("AudioEngine: must provide deviceVolumeMonitor when deviceProvider is not AudioDeviceMonitor")
            }
            self.deviceVolumeMonitor = DeviceVolumeMonitor(deviceMonitor: realDeviceMonitor, settingsManager: manager, ddcController: ddc)
        }
        #else
        if let dvMonitor = deviceVolumeMonitor {
            self.deviceVolumeMonitor = dvMonitor
        } else {
            guard let realDeviceMonitor else {
                preconditionFailure("AudioEngine: must provide deviceVolumeMonitor when deviceProvider is not AudioDeviceMonitor")
            }
            self.deviceVolumeMonitor = DeviceVolumeMonitor(deviceMonitor: realDeviceMonitor, settingsManager: manager)
        }
        #endif

        // Tap factory: use provided factory or default to ProcessTapController
        if let factory = tapFactory {
            self.tapFactory = factory
        } else {
            self.tapFactory = { app, deviceUIDs, preferredSource in
                if deviceUIDs.count == 1 {
                
```

### Core Architecture Module: `FineTune/Audio/Engine/CrashGuard.swift`
```
// FineTune/Audio/Engine/CrashGuard.swift
import AudioToolbox
import os

// MARK: - Signal-Safe Globals

// Fixed-size buffer for async-signal-safe access from crash handler.
// Allocated once at install(), never freed (process-lifetime).
// Written from main/utility threads under lock, read from signal handler (single execution).
private nonisolated(unsafe) var gDeviceSlots: UnsafeMutablePointer<AudioObjectID>?
private nonisolated(unsafe) var gDeviceCount: Int32 = 0
private nonisolated(unsafe) var gDeviceLock = os_unfair_lock()
private nonisolated let gMaxDeviceSlots = 64

// MARK: - Crash Signal Handler

/// C-compatible crash signal handler. Destroys all tracked aggregate devices
/// via IPC to coreaudiod, then re-raises the signal for default crash behavior.
///
/// ASYNC-SIGNAL-SAFETY: AudioHardwareDestroyAggregateDevice is a Mach IPC call
/// to coreaudiod and doesn't depend on in-process heap state. The fixed-size C
/// buffer avoids any Swift or libc heap operations.
private nonisolated func crashSignalHandler(_ sig: Int32) {
    // Reset to default FIRST to prevent infinite recursion if cleanup itself crashes
    signal(sig, SIG_DFL)

    if let slots = gDeviceSlots {
        let n = Int(gDeviceCount)
        for i in 0..<n {
            let deviceID = slots[i]
            if deviceID != AudioObjectID(kAudioObjectUnknown) {
                AudioHardwareDestroyAggregateDevice(deviceID)
            }
        }
    }

    // Re-raise with default handler for normal crash behavior (crash report, core dump)
    raise(sig)
}

private nonisolated let logger = Logger(subsystem: "com.finetuneapp.FineTune", category: "CrashGuard")

// MARK: - Public API

/// Tracks live aggregate device IDs and destroys them on crash signals
/// (SIGABRT, SIGSEGV, SIGBUS, SIGTRAP).
///
/// Uses a fixed-size C buffer (not Swift collections) so the signal handler
/// only touches async-signal-safe memory.
nonisolated enum CrashGuard {
    /// Allocates the tracking buffer and installs crash signal handlers.
    /// Call once on app startup, before creating any taps.
    static func install() {
        let buffer = UnsafeMutablePointer<AudioObjectID>.allocate(capacity: gMaxDeviceSlots)
        buffer.initialize(repeating: AudioObjectID(kAudioObjectUnknown), count: gMaxDeviceSlots)
        gDeviceSlots = buffer

        signal(SIGABRT, crashSignalHandler)
        signal(SIGSEGV, crashSignalHandler)
        signal(SIGBUS, crashSignalHandler)
        signal(SIGTRAP, crashSignalHandler)
    }

    /// Registers an aggregate device for crash-safe cleanup.
    /// Call immediately after successful `AudioHardwareCreateAggregateDevice`.
    static func trackDevice(_ deviceID: AudioObjectID) {
        os_unfair_lock_lock(&gDeviceLock)
        guard let slots = gDeviceSlots else {
            os_unfair_lock_unlock(&gDeviceLock)
            return
        }
        let idx = Int(gDeviceCount)
        guard idx < gMaxDeviceSlots else {
            os_unfair_lock_unlock(&gDeviceLock)
            logger.error("Slot limit (\(gMaxDeviceSlots)) reached — device \(deviceID) not tracked for crash cleanup")
            return
        }
        slots[idx] = deviceID
        gDeviceCount += 1
        os_unfair_lock_unlock(&gDeviceLock)
    }

    /// Removes an aggregate device from crash-safe tracking.
    /// Call immediately before `AudioHardwareDestroyAggregateDevice`.
    static func untrackDevice(_ deviceID: AudioObjectID) {
        os_unfair_lock_lock(&gDeviceLock)
        defer { os_unfair_lock_unlock(&gDeviceLock) }
        guard let slots = gDeviceSlots else { return }
        let n = Int(gDeviceCount)
        for i in 0..<n {
            if slots[i] == deviceID {
                let lastIdx = n - 1
                slots[i] = slots[lastIdx]
                slots[lastIdx] = AudioObjectID(kAudioObjectUnknown)
                gDeviceCount -= 1
                return
            }
        }
    }
}

```

### Core Architecture Module: `FineTune/Audio/Engine/CrossfadeOrchestrator.swift`
```
// FineTune/Audio/Engine/CrossfadeOrchestrator.swift
import AudioToolbox
import os

/// Error types for crossfade and tap operations
enum CrossfadeError: LocalizedError {
    case tapCreationFailed(OSStatus)
    case aggregateCreationFailed(OSStatus)
    case deviceNotReady
    case secondaryTapFailed
    case noTapDescription

    var errorDescription: String? {
        switch self {
        case .tapCreationFailed(let status):
            return "Failed to create process tap: \(status)"
        case .aggregateCreationFailed(let status):
            return "Failed to create aggregate device: \(status)"
        case .deviceNotReady:
            return "Device not ready within timeout"
        case .secondaryTapFailed:
            return "Secondary tap invalid after timeout"
        case .noTapDescription:
            return "No tap description available"
        }
    }
}

/// Configuration for crossfade behavior during device switching.
/// The crossfade overlaps audio from old and new devices using equal-power curves
/// to maintain perceived loudness during the transition.
enum CrossfadeConfig {
    /// 50ms is short enough to feel instantaneous but long enough to avoid clicks.
    /// Shorter durations risk audible artifacts; longer durations feel sluggish.
    /// Can be overridden via UserDefaults for testing/debugging.
    static let defaultDuration: TimeInterval = 0.050  // 50ms

    static var duration: TimeInterval {
        let custom = UserDefaults.standard.double(forKey: "FineTuneCrossfadeDuration")
        return custom > 0 ? custom : defaultDuration
    }

    static func totalSamples(at sampleRate: Double) -> Int64 {
        max(1, Int64(sampleRate * duration))
    }
}

```

### Core Architecture Module: `FineTune/Audio/Engine/CrossfadeState.swift`
```
// FineTune/Audio/Engine/CrossfadeState.swift
import Foundation

/// State machine phases for device switching crossfade.
enum CrossfadePhase: Int, Equatable {
    case idle = 0
    case warmingUp = 1
    case crossfading = 2
}

/// RT-safe crossfade state container.
/// All fields are designed for lock-free access from audio callbacks.
///
/// **Threading model:**
/// - Main thread writes via `beginWarmup()`, `beginCrossfading()`, `complete()`
/// - Secondary audio callback writes via `updateProgress(samples:)` (single-writer)
/// - Both audio callbacks read `phase`, `primaryMultiplier`, `secondaryMultiplier`
///
/// **Memory ordering:** Uses aligned Float/Int reads which are atomic on Apple platforms
/// (ARM64/x86-64). `OSMemoryBarrier()` ensures cross-core visibility at phase transitions.
nonisolated struct CrossfadeState: @unchecked Sendable {
    /// Current crossfade progress (0 = full primary, 1 = full secondary)
    nonisolated(unsafe) var progress: Float = 0

    /// RT-safe phase storage (Int for atomic reads on audio thread)
    nonisolated(unsafe) private var _phaseRawValue: Int = 0

    /// Current crossfade phase
    var phase: CrossfadePhase {
        get { CrossfadePhase(rawValue: _phaseRawValue) ?? .idle }
        set { _phaseRawValue = newValue.rawValue }
    }

    /// Backward-compatible: true when warmingUp OR crossfading
    var isActive: Bool {
        _phaseRawValue != CrossfadePhase.idle.rawValue
    }

    /// Sample count from secondary callback (drives crossfade timing)
    nonisolated(unsafe) var secondarySampleCount: Int64 = 0

    /// Total samples for the crossfade duration
    nonisolated(unsafe) var totalSamples: Int64 = 0

    /// Samples processed by secondary (for warmup tracking)
    nonisolated(unsafe) var secondarySamplesProcessed: Int = 0

    /// Minimum samples secondary must process before destroying primary
    static let minimumWarmupSamples: Int = 2048  // ~43ms at 48kHz

    init() {}

    // MARK: - Phase Transitions (called from main thread)

    /// Resets all state and enters warmingUp phase without setting totalSamples.
    /// Call before secondary tap creation so audio callbacks see correct phase.
    /// Set `totalSamples` separately after reading the new device's sample rate.
    mutating func beginWarmup() {
        progress = 0
        secondarySampleCount = 0
        secondarySamplesProcessed = 0
        totalSamples = 0
        OSMemoryBarrier()    // Flush data stores before publishing phase
        phase = .warmingUp
    }

    /// Transitions from warmingUp to crossfading.
    /// Call after warmup is confirmed (secondary has processed enough samples).
    mutating func beginCrossfading() {
        secondarySampleCount = 0
        progress = 0
        OSMemoryBarrier()    // Flush data stores before publishing phase
        phase = .crossfading
    }

    /// Completes the crossfade and resets all state to idle.
    mutating func complete() {
        progress = 0
        secondarySampleCount = 0
        secondarySamplesProcessed = 0
        totalSamples = 0
        OSMemoryBarrier()    // Flush data stores before publishing phase
        phase = .idle
    }

    // MARK: - Audio Thread Access

    /// Updates progress based on samples processed.
    /// **Called only from the secondary audio callback** (single-writer pattern).
    ///
    /// - Parameter samples: Number of samples just processed this buffer
    /// - Returns: New progress value (0.0 to 1.0)
    @inline(__always)
    mutating func updateProgress(samples: Int) -> Float {
        secondarySamplesProcessed += samples
        if phase == .crossfading {
            secondarySampleCount += Int64(samples)
            progress = min(1.0, Float(secondarySampleCount) / Float(max(1, totalSamples)))
        }
        return progress
    }

    /// Checks if warmup is complete (enough samples processed by secondary)
    var isWarmupComplete: Bool {
        secondarySamplesProcessed >= Self.minimumWarmupSamples
    }

    /// Checks if the crossfade animation is complete (progress reached 1.0)
    var isCrossfadeComplete: Bool {
        progress >= 1.0
    }

    /// Equal-power fade-out multiplier for primary tap.
    /// cos(0) = 1.0 (full volume), cos(pi/2) = 0.0 (silent)
    @inline(__always)
    var primaryMultiplier: Float {
        switch phase {
        case .idle:
            return progress >= 1.0 ? 0.0 : 1.0
        case .warmingUp:
            return 1.0
        case .crossfading:
            return cos(progress * .pi / 2.0)
        }
    }

    /// Equal-power fade-in multiplier for secondary tap.
    /// sin(0) = 0.0 (silent), sin(pi/2) = 1.0 (full volume)
    @inline(__always)
    var secondaryMultiplier: Float {
        switch phase {
        case .idle:
            return 1.0  // After promotion, full volume
        case .warmingUp:
            return 0.0  // Muted during warmup
        case .crossfading:
            return sin(progress * .pi / 2.0)
        }
    }
}

```

### Core Architecture Module: `FineTune/Audio/Engine/EchoTracker.swift`
```
import Foundation
import os

/// Reference-counted echo suppression for CoreAudio default-device changes.
///
/// When we programmatically set the system default device, CoreAudio fires a
/// property-changed callback with the same UID. Without suppression, we'd
/// interpret our own change as an external event and re-route apps.
///
/// The tracker is reference-counted (not boolean) so rapid reconnects of the
/// same device increment independently, and each echo is consumed separately.
///
/// Each increment creates a unique token stored in a per-UID set. Timeouts
/// check their own token; consume removes one token. This ensures timeouts
/// are invalidated individually, not en masse.
@MainActor
final class EchoTracker {

    /// Fired when a timeout expires without the echo being consumed.
    /// The caller should re-evaluate the default device.
    var onTimeout: ((_ uid: String) -> Void)?

    private let label: String
    private let logger: Logger
    private let timeoutDuration: TimeInterval

    /// Per-UID set of active timeout tokens. Each increment adds one;
    /// each consume or successful timeout removes one.
    private var activeTimeouts: [String: Set<Int>] = [:]
    private var nextToken: Int = 0

    init(label: String, timeoutDuration: TimeInterval = 2.0,
         logger: Logger = Logger(subsystem: "com.finetuneapp.FineTune", category: "EchoTracker")) {
        self.label = label
        self.timeoutDuration = timeoutDuration
        self.logger = logger
    }

    /// Record that we're about to programmatically change the default device.
    /// Must be called *after* confirming the HAL call succeeded.
    func increment(_ uid: String) {
        let token = nextToken
        nextToken += 1
        activeTimeouts[uid, default: []].insert(token)
        let duration = timeoutDuration
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(duration))
            guard let self, !Task.isCancelled else { return }
            guard self.activeTimeouts[uid]?.remove(token) != nil else { return }
            if self.activeTimeouts[uid]?.isEmpty == true {
                self.activeTimeouts.removeValue(forKey: uid)
            }
            self.logger.warning("\(self.label) echo for \(uid) timed out")
            self.onTimeout?(uid)
        }
    }

    /// Try to consume one pending echo for this UID.
    /// Returns `true` if an echo was pending (caller should ignore the callback).
    func consume(_ uid: String) -> Bool {
        guard let token = activeTimeouts[uid]?.min() else { return false }
        activeTimeouts[uid]?.remove(token)
        if activeTimeouts[uid]?.isEmpty == true {
            activeTimeouts.removeValue(forKey: uid)
        }
        return true
    }

    /// Whether any echo is pending for any device.
    /// Used to skip interim routing when an override is in flight.
    var hasPending: Bool {
        !activeTimeouts.isEmpty
    }
}

```

### Core Architecture Module: `FineTune/Audio/Engine/OrphanedTapCleanup.swift`
```
// FineTune/Audio/Engine/OrphanedTapCleanup.swift
import AudioToolbox
import os

private let logger = Logger(subsystem: "com.finetuneapp.FineTune", category: "OrphanedTapCleanup")

/// Scans CoreAudio for orphaned FineTune aggregate devices and destroys them.
/// Orphans occur when FineTune crashes or is force-killed (`kill -9`), leaving
/// aggregate devices with `.mutedWhenTapped` process taps that silently mute apps.
enum OrphanedTapCleanup {
    /// Destroys any aggregate devices named "FineTune-*" left over from a previous session.
    /// Call on startup before creating any new taps.
    static func destroyOrphanedDevices() {
        let devices: [AudioDeviceID]
        do {
            devices = try AudioObjectID.readDeviceList()
        } catch {
            logger.error("[CLEANUP] Failed to read device list: \(error.localizedDescription)")
            return
        }

        var destroyedCount = 0

        for device in devices {
            let transportType = device.readTransportType()
            guard transportType == .aggregate else { continue }

            guard let name = try? device.readDeviceName(),
                  name.hasPrefix("FineTune-") else { continue }

            let err = AudioHardwareDestroyAggregateDevice(device)
            if err == noErr {
                destroyedCount += 1
                logger.info("[CLEANUP] Destroyed orphaned aggregate device: \(name) (ID \(device))")
            } else {
                logger.error("[CLEANUP] Failed to destroy \(name) (ID \(device)): OSStatus \(err)")
            }
        }

        if destroyedCount == 0 {
            logger.info("[CLEANUP] No orphaned FineTune devices found")
        } else {
            logger.info("[CLEANUP] Destroyed \(destroyedCount) orphaned device(s)")
        }
    }
}

```

### Core Architecture Module: `FineTune/Audio/Engine/ProcessTapController.swift`
```
// FineTune/Audio/Engine/ProcessTapController.swift
import AudioToolbox
import Foundation
import os

// MARK: - Threading Model
//
// ProcessTapController bridges two execution domains:
//
// 1. **Main thread / @MainActor**: All setup, teardown, and state management.
//    - activate(), invalidate(), updateDevices(), performCrossfadeSwitch()
//    - Property writes to nonisolated(unsafe) vars (_volume, _isMuted, etc.)
//    - The class is @MainActor; the HAL callback is explicitly nonisolated.
//
// 2. **HAL I/O thread (real-time)**: Audio processing callback.
//    - processAudioCallback() — unified callback with runtime role via callbackID
//    - Reads nonisolated(unsafe) vars; writes _peakLevel/_secondaryPeakLevel,
//      _primaryCurrentVolume/_secondaryCurrentVolume, _lastRenderHostTime, _hasRenderedAudio
//    - MUST NOT allocate, lock, log, or call ObjC. See .claude/rules/rt-safety.md
//
// The nonisolated(unsafe) annotation marks variables that cross the thread boundary.
// Aligned Float32/Bool/Int reads/writes are atomic on Apple ARM64/x86-64.

@MainActor
final class ProcessTapController: ProcessTapControlling {
    let app: AudioApp
    private let logger: Logger
    // Note: This queue is passed to AudioDeviceCreateIOProcIDWithBlock but the actual
    // audio callback runs on CoreAudio's real-time HAL I/O thread, not this queue.
    private let queue = DispatchQueue(label: "ProcessTapController", qos: .userInitiated)

    /// Weak reference to device monitor for O(1) device lookups during crossfade
    private weak var deviceMonitor: AudioDeviceMonitor?
    /// Optional device UID to use for stream-specific tap capture.
    /// When nil, tap creation always uses stereo mixdown capture.
    private var preferredTapSourceDeviceUID: String?

    /// Exposes the current tap source device UID for diagnostics and tap source refresh logic.
    /// Non-nil means stream-specific tap; nil means stereo mixdown.
    var tapSourceDeviceUID: String? { preferredTapSourceDeviceUID }

    // MARK: - RT-Safe State (nonisolated(unsafe) for lock-free audio thread access)
    //
    // These variables are accessed from CoreAudio's real-time thread without locks.
    // SAFETY: Aligned Float32/Bool reads/writes are atomic on Apple ARM/Intel platforms.
    // The audio callback reads these values; the main thread writes them.
    // No lock is needed because single-word aligned loads/stores are atomic.

    /// Target gain set by AudioEngine (volume × boost). Range 0.0-4.0 (1.0 = unity, 4.0 = +12dB).
    private nonisolated(unsafe) var _volume: Float = 1.0
    /// Current ramped volume for primary tap (smoothly approaches _volume)
    private nonisolated(unsafe) var _primaryCurrentVolume: Float = 1.0
    /// Current ramped volume for secondary tap during crossfade
    private nonisolated(unsafe) var _secondaryCurrentVolume: Float = 1.0
    /// Emergency silence flag - zeroes output immediately (used during destructive device switch)
    /// Unlike _isMuted, this bypasses all processing including VU metering
    private nonisolated(unsafe) var _forceSilence: Bool = false
    /// User-controlled mute - still tracks VU levels but outputs silence
    private nonisolated(unsafe) var _isMuted: Bool = false
    // Device volume compensation removed — was dead code (always 1.0).
    // If implementing, ensure both primary and secondary callbacks disable
    // compensation during crossfade to avoid gain jumps (RT-013).
    /// Smoothed peak level for VU meter display (exponential moving average)
    private nonisolated(unsafe) var _peakLevel: Float = 0.0
    /// Separate peak level for secondary tap during crossfade (avoids torn RMW from concurrent callbacks)
    private nonisolated(unsafe) var _secondaryPeakLevel: Float = 0.0
    private nonisolated(unsafe) var _currentDeviceVolume: Float = 1.0
    private nonisolated(unsafe) var _isDeviceMuted: Bool = false
    private nonisolated(unsafe) var _primaryPreferredStereoLeftChannel: Int = 0
    private nonisolated(unsafe) var _primaryPreferredStereoRightChannel: Int = 1
    private nonisolated(unsafe) var _secondaryPreferredStereoLeftChannel: Int = 0
    private nonisolated(unsafe) var _secondaryPreferredStereoRightChannel: Int = 1
    /// Monotonic host tick of the last audio callback execution.
    private nonisolated(unsafe) var _lastRenderHostTime: UInt64 = 0
    /// Monotonic host tick of successful activation.
    private nonisolated(unsafe) var _activationHostTime: UInt64 = 0
    /// Set once any audio callback has rendered at least one buffer.
    private nonisolated(unsafe) var _hasRenderedAudio: Bool = false

    /// Callback role identification — RT-safe via atomic UInt32 reads.
    /// Each IO proc closure captures an immutable callbackID at creation.
    /// The callback compares against these to determine primary/secondary role.
    /// After promotion, _primaryCallbackID is reassigned so the promoted callback
    /// seamlessly switches to primary-role behavior on its next invocation.
    private nonisolated(unsafe) var _primaryCallbackID: UInt32 = 0
    private nonisolated(unsafe) var _secondaryCallbackID: UInt32 = 0
    /// Monotonic counter for unique callback IDs. Only written from main thread.
    private var nextCallbackID: UInt32 = 0

    /// Crossfade state machine (RT-safe).
    /// During device switch, we run two taps simultaneously with complementary gain curves:
    /// - Primary uses cos(progress * π/2) → fades from 1.0 to 0.0
    /// - Secondary uses sin(progress * π/2) → fades from 0.0 to 1.0
    /// This "equal power" crossfade maintains perceived loudness throughout the transition.
    /// See CrossfadeState for phase machine details.
    private nonisolated(unsafe) var crossfadeState = CrossfadeState()

    /// Output-gate state machine for silent→non-silent soft-start. Phases:
    ///   0 = armed (output muted, waiting for first non-silent input)
    ///   1 = ramping (half-cosine fade-in over `_outputGateRampSamples`)
    ///   2 = open   (passthrough)
    /// After sustained input silence ≥ `_outputGateSilenceHoldSamples`, re-arms to 0.
    /// UInt8 / Float / Int32 reads/writes are atomic on Apple ARM64/x86-64. Only the
    /// primary callback advances this state; the secondary callback uses crossfadeState.
    private nonisolated(unsafe) var _outputGateRawPhase: UInt8 = 0
    private nonisolated(unsafe) var _outputGateProgress: Float = 0
    private nonisolated(unsafe) var _outputGateSilentSamples: Int32 = 0
    /// Sample count for the 40 ms half-cosine ramp (recomputed in activate from device rate).
    private nonisolated(unsafe) var _outputGateRampSamples: Float = 1920
    /// Sample count for the 200 ms silence-hold before re-arming (recomputed in activate).
    private nonisolated(unsafe) var _outputGateSilenceHoldSamples: Int32 = 9600
    /// Input below this peak magnitude is treated as silence (≈ -80 dBFS).
    nonisolated private static let outputGateSilenceThreshold: Float = 0.0001

    // MARK: - Non-RT State (modified only from main thread)

    /// VU meter smoothing factor. 0.3 gives ~30ms attack/decay at typical 30fps UI refresh.
    /// Lower = smoother but slower response; higher = jittery but more responsive.
    private let levelSmoothingFactor: Float = 0.3
    /// Volume ramp coefficient computed as: 1 - exp(-1 / (sampleRate * rampTime))
    /// Default 0.0007 corresponds to ~30ms ramp at 48kHz. Prevents clicks on volume changes.
    private nonisolated(unsafe) var rampCoefficient: Float = 0.0007
    private nonisolated(unsafe) var secondaryRampCoefficient: Float = 0.0007
    private nonisolated(unsafe) var eqProcessor: EQProcessor?
    private nonisolated(unsafe) var autoEQProcessor: AutoEQProcessor?
    private nonisolated(unsafe) var loudnessCompensator: LoudnessCompensator?
    private nonisolated(unsafe) var loudnessEqualizerProcessor: LoudnessEqualizer?
    /// Last effective loudness volume (device × app) passed to updateLoudnessCompensation.
    /// Used by createSecondaryTap to initialize secondary compensator with the correct volume.
    private var _lastLoudnessVolume: Float = 1.0
    /// Independent EQ processors for secondary tap during crossfade.
    /// Each tap needs its own biquad delay buffers — sharing would corrupt filter state
    /// because both callbacks write concurrently from different HAL I/O threads.
    private nonisolated(unsafe) var secondaryEQProcessor: EQProcessor?
    private nonisolated(unsafe) var secondaryAutoEQProcessor: AutoEQProcessor?
    private nonisolated(unsafe) var secondaryLoudnessCompensator: LoudnessCompensator?
    private nonisolated(unsafe) var secondaryLoudnessEqualizerProcessor: LoudnessEqualizer?

    // Target device UIDs for synchronized multi-output (first is clock source)
    private var targetDeviceUIDs: [String]
    // Current active device UIDs
    private(set) var currentDeviceUIDs: [String] = []

    /// Primary device UID (clock source, first in array) - for backward compatibility
    var currentDeviceUID: String? { currentDeviceUIDs.first }

    // Core Audio resources (primary tap) — TapResources enforces correct teardown order
    private var primaryResources = TapResources()
    private var activated = false

    // Secondary tap for crossfade
    private var secondaryResources = TapResources()

    /// Guard against re-entrant crossfade (ORCH-001)
    private var isSwitching = false
    /// Cancellable crossfade task — cancelled when a new switch starts
    private var crossfadeTask: Task<Void, Error>?
    private var didLogEQBypassForMultichannel = false

    // MARK: - Public Properties

    var audioLevel: Float { crossfadeState.isActive ? max(_peakLevel, _secondaryPeakLevel) : _peakLevel }

    private static let hostTimeNanosScale: Double = {
        var info = mach_timebase_info_data_t()
        mach_timebase_info(&info)
        guard info.denom != 0 else { return 1.0 }
        return Double(info.numer) / Double(info.denom)
    }()

    /// Retu
```

### Core Architecture Module: `FineTune/Audio/Engine/ProcessTapControlling.swift`
```
/// Abstraction over process tap controllers for testability.
///
/// **Threading:** The protocol surface is `@MainActor` — AudioEngine and tests
/// interact with controllers from main. The concrete class straddles main and the
/// CoreAudio HAL I/O thread, but the audio callback never goes through this
/// protocol; it reads `nonisolated(unsafe)` atomic fields directly on the concrete
/// type via a `void *` userdata pointer.
@MainActor
protocol ProcessTapControlling: AnyObject, Sendable {
    var app: AudioApp { get }
    var volume: Float { get set }
    var isMuted: Bool { get set }
    var currentDeviceVolume: Float { get set }
    var isDeviceMuted: Bool { get set }
    var audioLevel: Float { get }
    var currentDeviceUID: String? { get }
    var currentDeviceUIDs: [String] { get }

    func activate(initial: TapInitialState) throws
    func invalidate()
    func invalidateAsync() async
    func updateEQSettings(_ settings: EQSettings)
    func updateAutoEQProfile(_ profile: AutoEQProfile?)
    func setAutoEQPreampEnabled(_ enabled: Bool)
    func updateLoudnessCompensation(volume: Float, enabled: Bool)
    func updateLoudnessEqualization(_ settings: LoudnessEqualizerSettings)
    func switchDevice(to newDeviceUID: String, preferredTapSourceDeviceUID: String?, sourceDeviceDead: Bool) async throws
    func updateDevices(to newDeviceUIDs: [String], preferredTapSourceDeviceUID: String?, sourceDeviceDead: Bool) async throws
    func hasRecentAudioCallback(within seconds: Double) -> Bool
    func isHealthCheckEligible(minActiveSeconds: Double) -> Bool

    var tapSourceDeviceUID: String? { get }
    func refreshTapSource(_ preferredDeviceUID: String?) async throws
    func recreateForOutputRateChange() async throws
}

extension ProcessTapControlling {
    /// Convenience activation with default state. Production callers must pass an
    /// `initial:` populated from persisted settings — defaults leave the first audio
    /// callbacks running with no EQ/AutoEQ/Loudness and unity volume ramp.
    func activate() throws {
        try activate(initial: TapInitialState())
    }

    /// Convenience: defaults sourceDeviceDead to false.
    func switchDevice(to newDeviceUID: String, preferredTapSourceDeviceUID: String?) async throws {
        try await switchDevice(to: newDeviceUID, preferredTapSourceDeviceUID: preferredTapSourceDeviceUID, sourceDeviceDead: false)
    }

    /// Convenience: defaults sourceDeviceDead to false.
    func updateDevices(to newDeviceUIDs: [String], preferredTapSourceDeviceUID: String?) async throws {
        try await updateDevices(to: newDeviceUIDs, preferredTapSourceDeviceUID: preferredTapSourceDeviceUID, sourceDeviceDead: false)
    }

    func invalidateAsync() async {
        invalidate()
    }

    func refreshTapSource(_ preferredDeviceUID: String?) async throws {
        // Default no-op for mocks that don't override
    }

    func recreateForOutputRateChange() async throws {
        // Default no-op for mocks that don't override
    }
}

```

### Core Architecture Module: `FineTune/Audio/Engine/SoftLimiter.swift`
```
// FineTune/Audio/Engine/SoftLimiter.swift
import Accelerate

/// RT-safe soft-knee limiter using asymptotic compression.
/// Prevents harsh clipping when audio is boosted above unity gain.
///
/// **RT-safety:** All methods are pure arithmetic with no allocation, locks, or I/O.
/// `processBuffer()` uses vDSP_maxmgv for fast peak detection (skips processing
/// when the entire buffer is below threshold).
///
/// **Behavior:**
/// - Below 0.95: passes through unchanged (transparent)
/// - Above 0.95: smooth compression approaching 1.0 asymptotically
/// - Never exceeds ±1.0 for any finite input
enum SoftLimiter {

    /// Threshold where limiting begins (below this, audio passes through)
    static let threshold: Float = 0.95

    /// Maximum output level (asymptotic ceiling)
    static let ceiling: Float = 1.0

    /// Available headroom above threshold
    @inline(__always)
    static var headroom: Float { ceiling - threshold }  // 0.05

    /// Applies soft-knee limiting to a single sample.
    ///
    /// Formula: output = threshold + headroom * (overshoot / (overshoot + headroom))
    /// As overshoot -> infinity, output -> ceiling asymptotically.
    ///
    /// - Parameter sample: Input sample (may exceed ±1.0 when boosted)
    /// - Returns: Limited sample, guaranteed <= ±ceiling for any finite input
    @inline(__always)
    static func apply(_ sample: Float) -> Float {
        let absSample = abs(sample)

        // Below threshold: pass through unchanged
        if absSample <= threshold {
            return sample
        }

        // Above threshold: asymptotic compression
        let overshoot = absSample - threshold
        let compressed = threshold + headroom * (overshoot / (overshoot + headroom))

        return sample >= 0 ? compressed : -compressed
    }

    /// Applies soft limiting to an entire buffer of interleaved stereo samples.
    ///
    /// Uses vDSP_maxmgv as a fast path: if the buffer peak is at or below threshold,
    /// the entire buffer is skipped (zero per-sample overhead for normal-level audio).
    ///
    /// - Parameters:
    ///   - buffer: Pointer to interleaved Float32 samples (modified in-place)
    ///   - sampleCount: Total number of samples (frames * channels)
    @inline(__always)
    static func processBuffer(_ buffer: UnsafeMutablePointer<Float>, sampleCount: Int) {
        // Fast path: if peak is at or below threshold, no limiting needed
        var bufferPeak: Float = 0
        vDSP_maxmgv(buffer, 1, &bufferPeak, vDSP_Length(sampleCount))
        guard bufferPeak > threshold else { return }

        for i in 0..<sampleCount {
            buffer[i] = apply(buffer[i])
        }
    }
}

```

### Core Architecture Module: `FineTune/Audio/Engine/TapInitialState.swift`
```
// FineTune/Audio/Engine/TapInitialState.swift
import Foundation

/// Persisted settings applied to a fresh ProcessTapController before its IOProc starts.
struct TapInitialState {
    var eqSettings: EQSettings = .flat
    var autoEQProfile: AutoEQProfile? = nil
    var autoEQPreampEnabled: Bool = false
    var loudnessVolume: Float = 1.0
    var loudnessCompensationEnabled: Bool = false
    var loudnessEqualizerSettings: LoudnessEqualizerSettings = .init()
}

```

### Core Architecture Module: `FineTune/Audio/Engine/TapResources.swift`
```
// FineTune/Audio/Engine/TapResources.swift
import AudioToolbox
import os

/// Encapsulates Core Audio tap and aggregate device resources.
/// Provides safe cleanup with correct teardown order.
///
/// **Teardown order is critical:**
/// 1. Stop device proc (AudioDeviceStop)
/// 2. Destroy IO proc ID (AudioDeviceDestroyIOProcID) — blocks until callback finishes
/// 3. Destroy aggregate device (AudioHardwareDestroyAggregateDevice)
/// 4. Destroy process tap (AudioHardwareDestroyProcessTap)
///
/// Violating this order can leak HAL resources or crash on shutdown.
nonisolated struct TapResources {
    private static let logger = Logger(subsystem: "com.finetuneapp.FineTune", category: "TapResources")

    var tapID: AudioObjectID = .unknown
    var aggregateDeviceID: AudioObjectID = .unknown
    var deviceProcID: AudioDeviceIOProcID?
    var tapDescription: CATapDescription?

    /// Whether these resources are currently active
    var isActive: Bool {
        tapID.isValid || aggregateDeviceID.isValid
    }

    /// Destroys all resources in the correct order to prevent leaks and crashes.
    /// Safe to call multiple times — invalid IDs are skipped.
    mutating func destroy() {
        // Capture IDs before mutation (os.Logger autoclosure can't capture mutating self)
        let aggID = aggregateDeviceID
        let tID = tapID

        // Step 1 & 2: Stop and destroy IO proc
        if aggID.isValid {
            if let procID = deviceProcID {
                let stopErr = AudioDeviceStop(aggID, procID)
                if stopErr != noErr {
                    Self.logger.error("AudioDeviceStop failed for aggregate \(aggID): OSStatus \(stopErr)")
                }
                let destroyProcErr = AudioDeviceDestroyIOProcID(aggID, procID)
                if destroyProcErr != noErr {
                    Self.logger.error("AudioDeviceDestroyIOProcID failed for aggregate \(aggID): OSStatus \(destroyProcErr)")
                }
            }
        }
        deviceProcID = nil

        // Step 3: Destroy aggregate device
        if aggID.isValid {
            CrashGuard.untrackDevice(aggID)
            let aggErr = AudioHardwareDestroyAggregateDevice(aggID)
            if aggErr != noErr {
                Self.logger.error("AudioHardwareDestroyAggregateDevice failed for \(aggID): OSStatus \(aggErr)")
            }
        }
        aggregateDeviceID = .unknown

        // Step 4: Destroy process tap
        if tID.isValid {
            let tapErr = AudioHardwareDestroyProcessTap(tID)
            if tapErr != noErr {
                Self.logger.error("AudioHardwareDestroyProcessTap failed for \(tID): OSStatus \(tapErr)")
            }
        }
        tapID = .unknown

        tapDescription = nil
    }

    /// Destroys resources asynchronously on a background queue.
    /// Clears instance state immediately so new resources can be created without waiting.
    ///
    /// Use this when destruction might block (e.g., AudioDeviceDestroyIOProcID
    /// blocks until the current IO cycle completes).
    ///
    /// - Parameters:
    ///   - queue: Queue to perform destruction on (default: global utility)
    ///   - completion: Optional callback invoked after all resources are destroyed
    mutating func destroyAsync(on queue: DispatchQueue = .global(qos: .utility), completion: (@Sendable () -> Void)? = nil) {
        // Capture values before clearing
        let capturedTapID = tapID
        let capturedAggregateID = aggregateDeviceID
        let capturedProcID = deviceProcID

        // Clear instance state immediately
        tapID = .unknown
        aggregateDeviceID = .unknown
        deviceProcID = nil
        tapDescription = nil

        // Dispatch blocking teardown to background
        queue.async {
            // Step 1 & 2: Stop and destroy IO proc
            if capturedAggregateID.isValid, let procID = capturedProcID {
                let stopErr = AudioDeviceStop(capturedAggregateID, procID)
                if stopErr != noErr {
                    Self.logger.error("AudioDeviceStop failed for aggregate \(capturedAggregateID): OSStatus \(stopErr)")
                }
                let destroyProcErr = AudioDeviceDestroyIOProcID(capturedAggregateID, procID)
                if destroyProcErr != noErr {
                    Self.logger.error("AudioDeviceDestroyIOProcID failed for aggregate \(capturedAggregateID): OSStatus \(destroyProcErr)")
                }
            }

            // Step 3: Destroy aggregate device
            if capturedAggregateID.isValid {
                CrashGuard.untrackDevice(capturedAggregateID)
                let aggErr = AudioHardwareDestroyAggregateDevice(capturedAggregateID)
                if aggErr != noErr {
                    Self.logger.error("AudioHardwareDestroyAggregateDevice failed for \(capturedAggregateID): OSStatus \(aggErr)")
                }
            }

            // Step 4: Destroy process tap
            if capturedTapID.isValid {
                let tapErr = AudioHardwareDestroyProcessTap(capturedTapID)
                if tapErr != noErr {
                    Self.logger.error("AudioHardwareDestroyProcessTap failed for \(capturedTapID): OSStatus \(tapErr)")
                }
            }

            completion?()
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #106** (2026-04-03): **[Bug] 25% volume cap**
  *Symptoms*: When connecting Kanto Yu speaker (shows as USB Audio DAC),  the volume is capped at 25%. When trying to increase the volume, the slider slides back to 25%. You can hear the increase when clicking fast on the volume slider but it slides back to 25%. With FineTune closed, the volume can be increased normally to full volume.
  **Post-Mortem & Fix Analysis**:
  > I am experiencing the same issue when routing to a Behringer UM2 USB audio interface / DAC with the host running macOS Tahoe 26.3 on M4.  I've attached the console log output sample when adjusting volume and it defaults back if that helps with troubleshooting.  Let me know and I can collect more info.  [FineTuneVolumeAdjust.txt](https://github.com/user-attachments/files/25705922/FineTuneVolumeAdjust.txt)
  > same here using AKG N9 Hybrid with USB dongle. when connected via bluetooth everything works fine
  > I’m experiencing the same issue on my M2 Pro macOS 26.4 laptop with the Corsair HS55 dongle. Bluetooth is functioning normally, but the volume cap remains at 25%. When I type “100” and “99” on FineTune, the volume doesn’t drop to 25%.

- **Issue #105** (2026-03-18): **[Bug] Low output on Topping E2x2 OTG (8ch) while FineTune is active; normal when FineTune is off**
  *Symptoms*: ## Summary With **Topping E2x2 OTG** as the default output device (reported as 8 channels), output level drops noticeably **when FineTune is running**. When FineTune is quit, output immediately returns to normal level.  This reproduces consistently and appears to be tied to the FineTune processing/routing path for this interface topology.  ## Environment - FineTune version: **v1.3.1** - macOS: **26.3 (25D125)** - Interface: **Topping E2x2 OTG** - Interface stream layout observed: **8ch output**  ## Reproduction 1. Set **E2x2 OTG** as macOS default output. 2. Play audio from Music (or any app). 3. Observe baseline level with FineTune **not running**. 4. Launch FineTune and keep routing on E2x2 OTG. 5. Compare level immediately.  ## Expected - Output level should be consistent whether FineTune is running or not.  ## Actual - **FineTune ON**: E2x2 output becomes quieter. - **FineTune OFF**: E2x2 output returns to normal.  ## Routing Diagnostics Collected from: `log stream --style compact --predicate 'process == "FineTune" AND composedMessage CONTAINS "[ROUTING-DIAG]"' --level debug`  ```text [ROUTING-DIAG] reason=activate app=음악 target=E2x2 OTG uid=AppleUSBAudioEngine:Topping:E2x2 OTG:2142100:1,2 prefStereo=1,2 [ROUTING-DIAG] targetStream=buffers=1 [b0:ch=8,bytes=16384] aggregateStream=buffers=1 [b0:ch=8,bytes=16384] [ROUTING-DIAG] targetVol=1.000 targetSettable=true aggregateVol=1.000 aggregateSettable=false [ROUTING-DIAG] callbackLayout inBuffers=2 outBuffers=1 in0Ch=10 in1Ch=
  **Post-Mortem & Fix Analysis**:
  > @MixedSystem Not a real solution, but I have the same device and you can switch (in the software) to "Mobile Applications" mode and everything works as intended. This mode doesn't limit anything except reducing the I/O from 8ch to 2ch.
  > Thanks for the detailed report and routing diagnostics. Could you try updating to v1.3.2? It includes audio engine improvements that may help with multi-channel device handling.  https://github.com/ronitsingh10/FineTune/releases/tag/v1.3.2  If the issue persists, please share FineTune's logs so we can investigate the 8-channel buffer routing:  ``` log stream --style compact --predicate 'subsystem == "com.finetuneapp.FineTune"' --level debug ```  Start the log, launch FineTune with the E2x2 as default output, play some audio, then paste the output here.
  > @ronitsingh10 Just tested with this latest version, and the issue is still present. Below is the log I gathered:  ``` 2026-02-21 19:31:47.640 I  FineTune[16527:39c15] [com.finetuneapp.FineTune:OrphanedTapCleanup] [CLEANUP] No orphaned FineTune devices found 2026-02-21 19:31:47.641 Db FineTune[16527:39c15] [com.finetuneapp.FineTune:SettingsManager] Loaded settings with 1 volumes, 0 device routings, 0 mutes, 0 EQ settings 2026-02-21 19:31:47.647 E  FineTune[16527:39c1e] [com.finetuneapp.FineTune:App] Notification authorization error: <private> 2026-02-21 19:31:47.788 Db FineTune[16527:39c15] [com.finetuneapp.FineTune:AudioProcessMonitor] Starting audio process monitor 2026-02-21 19:31:47.793 Db FineTune[16527:39c15] [com.finetuneapp.FineTune:AudioDeviceMonitor] Starting audio device monitor 2026-02-21 19:31:47.803 Db FineTune[16527:39c15] [com.finetuneapp.FineTune:DeviceVolumeMonitor] Starting device volume monitor 2026-02-21 19:31:47.803 I  FineTune[16527:39c1e] [com.finetuneapp.FineTun

- **Issue #103** (2026-03-18): **Chrome output sound issue**
  *Symptoms*: Hi, I just downloaded your app and it worked perfectly thank's !  But for now I'm not able anymore to use google chrome with it idk why...  I tried desinstalling and downloading chrome again, same with finetune.  Restart the laptop also.  But I'm not able to fix the issue, any idea ?   PS : I'm on an M5 Mac Book Pro with Chrome 145.0.7632.76 
  **Post-Mortem & Fix Analysis**:
  > <img width="1025" height="498" alt="Image" src="https://github.com/user-attachments/assets/2f5fe430-9bfd-4d43-ac3a-3477dffb8ad3" />  I can see spotify playing but not chrome here anymore
  > Hello, any update ?  
  > Resolved in v1.4.0.  Helper process merging (`5818618`) groups all Chrome helper processes under the parent app with a single process tap capturing all PIDs. This directly addresses Chrome's multi-process architecture where audio runs in renderer child processes.  If anyone still experiences Chrome audio issues on v1.4.0, please open a new issue with details.

- **Issue #102** (2026-02-22): **App makes speakers crackle and produces weird sound during calls**
  *Symptoms*: On taking any calls either using FaceTime or WhatsApp Desktop Client, the speakers crackle and produce a weird sound and you cannot hear the person on the other end.
  **Post-Mortem & Fix Analysis**:
  > Same issue on Discord
  > Fixed in v1.3.2. This release includes Bluetooth HFP distortion fixes for voice calls, a soft limiter to prevent crackling from clipping, and improved device switching that eliminates glitches during crossfade.  https://github.com/ronitsingh10/FineTune/releases/tag/v1.3.2  Please reopen if you still experience this after updating.

- **Issue #99** (2026-02-20): **[Bug] App produces static noise on headphones**
  *Symptoms*: I was trying to regulate the volume between zoom and a whatsapp call, and after a few seconds it starts producing static. If I quit and restart the app the noise comes back in around 10 seconds and only goes away if I close the app.  Headphones - BT Sony WH1000XM5 Hardware - Mac M4 air Sequoia 15.7.1
  **Post-Mortem & Fix Analysis**:
  > Closing as duplicate of #52 — same root cause: Bluetooth headphones produce static/distortion when microphone is activated during calls.

- **Issue #96** (2026-03-18): **[Feature request & Bug] Settings reset after update + device-based volume control suggestion**
  *Symptoms*: Hi,  After the latest update, my settings were reset: 	•	Volume level 	•	Favorites (marked apps) 	•	Selected icon  All of them were cleared after updating.  Also, it would be nice if volume level could be remembered per audio device.  For example: When using AirPods, Spotify volume could be 30. When using speakers, it could be 60.  If the app remembered volume separately for each output device, it would improve the experience for users who switch between devices frequently.
  **Post-Mortem & Fix Analysis**:
  > Fixed in v1.4.0.  `7f22d91` — Settings decoding is now fully resilient: all fields use `decodeIfPresent` with safe defaults, corrupted settings files are backed up before reset, and `resetAllSettings` clears all 22 setting categories. Additionally, `7bac2a1` filters non-finite volumes (NaN/Inf) on decode, and `29dd976` validates EQ band gains.  Settings should no longer be lost on update. If anyone still experiences this on v1.4.0, please open a new issue.

- **Issue #84** (2026-02-22): **Robotic high pitch sound when output is thunderbolt universal audio**
  *Symptoms*: The sound comes out high pitch and robotic sounding when universal audio is selected as the output. With completely fine when macbook speakers is the selected output   https://github.com/user-attachments/assets/9f5d5696-21d2-4cc0-a671-02e9e483b22c
  **Post-Mortem & Fix Analysis**:
  > Fixed in v1.3.2. This release adds a Nyquist guard that prevents unstable biquad filters on high sample rate devices, which was the cause of robotic/high-pitch distortion on Thunderbolt and USB audio interfaces.  https://github.com/ronitsingh10/FineTune/releases/tag/v1.3.2  Please reopen if you still experience this after updating.

- **Issue #79** (2026-02-20): **High-pitched sound when using FineTune with Facetime.**
  *Symptoms*: Connected to Sony XM6 while calling, completely could not hear Facetime audio, only a terrible high pitched sound. Sound did not occur after I quit FineTune.  Did anyone else experience this?
  **Post-Mortem & Fix Analysis**:
  > I confirm. I have a similar problem with AirPods Pro when starting a Zoom conference.  
  > same here!
  > Closing as duplicate of #52 — same root cause: Bluetooth headphones produce distortion/static when microphone is activated during calls.

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

### Incident Patch 1: `06b34eca` (2026-07-09)
**Commit Message**: fix(menu-bar): fall back when a device icon override no longer resolves

A stale override (hand-edited settings, symbol dropped by macOS) produced
a nil NSImage and froze the status item. Override precedence now lives in
resolveSymbol so validation exists once, and the launch fallback renders
on the shared canvas so the item width can't jump.

**File**: `FineTune/FineTuneApp.swift` (modified, +4/-7)
```diff
@@ -183,16 +183,13 @@ struct FineTuneApp: App {
                 priorityOrder: settings.devicePriorityOrder,
                 outputDevices: engine.deviceMonitor.outputDevices,
                 defaultDeviceID: launchID,
-                symbolForDevice: { device in
-                    MenuBarDeviceIconResolver.symbol(for: device, override: settings.getDeviceIconOverride(for: device.uid))
-                },
-                symbolForDefaultID: { id in
-                    MenuBarDeviceIconResolver.symbol(forDefaultID: id, override: { settings.getDeviceIconOverride(for: $0) })
-                }
+                overrideForUID: { settings.getDeviceIconOverride(for: $0) }
             )
         )
+        // The fallback must go through the shared canvas too, or the status
+        // item launches at natural symbol width and jumps on the first apply().
         launchIconImage = launchState.image.nsImage()
-            ?? NSImage(systemSymbolName: "speaker.wave.2", accessibilityDescription: "FineTune")!
+            ?? MenuBarIconImage.systemSymbol("speaker.wave.2").nsImage()!
 
         // Start Accessibility polling immediately so `isTrustedCached` is live
         // before the user first opens Settings. The trust-flip callback wires
```

**File**: `FineTune/Views/MenuBar/MenuBarDeviceIconResolver.swift` (modified, +19/-16)
```diff
@@ -1,56 +1,59 @@
 // FineTune/Views/MenuBar/MenuBarDeviceIconResolver.swift
 
+import AppKit
 import AudioToolbox
 
 struct MenuBarDeviceIconResolver {
     // Neutral "unknown output" glyph, sourced from the transport-type convention
     // so it stays in sync with the rest of the app rather than a private literal.
     static let fallbackSymbol = TransportType.unknown.defaultIconSymbol
 
+    /// An override symbol that fails to resolve (hand-edited settings.json,
+    /// symbol removed in a future macOS) falls back to the derived symbol —
+    /// a nil NSImage downstream would freeze the status item on its last image.
     static func resolveSymbol(
         priorityOrder: [String],
         outputDevices: [AudioDevice],
         defaultDeviceID: AudioDeviceID,
+        overrideForUID: (String) -> String? = { _ in nil },
+        isSymbolResolvable: (String) -> Bool = {
+            NSImage(systemSymbolName: $0, accessibilityDescription: nil) != nil
+        },
         isDeviceAvailable: (AudioDevice) -> Bool = { $0.id.isDeviceAlive() },
+        uidForDefaultID: (AudioDeviceID) -> String? = { try? $0.readDeviceUID() },
         symbolForDevice: (AudioDevice) -> String = { $0.id.suggestedIconSymbol() },
         symbolForDefaultID: (AudioDeviceID) -> String = { id in
             guard id.isValid else { return Self.fallbackSymbol }
             return id.suggestedIconSymbol()
         }
     ) -> String {
+        func overrideSymbol(forUID uid: String) -> String? {
+            guard let symbol = overrideForUID(uid), isSymbolResolvable(symbol) else { return nil }
+            return symbol
+        }
+
         let devicesByUID = Dictionary(outputDevices.map { ($0.uid, $0) }, uniquingKeysWith: { _, latest in latest })
 
         // Match macOS's sound menu: the persistent icon represents the device
         // currently receiving system audio, even if FineTune's saved priority
         // order has another connected device above it.
         if let defaultDevice = outputDevices.first(where: { $0.id == defaultDeviceID }),
            isDeviceAvailable(defaultDevice) {
-            return symbolForDevice(defaultDevice)
+            return overrideSymbol(forUID: defaultDevice.uid) ?? symbolForDevice(defaultDevice)
         }
 
         for uid in priorityOrder {
             guard let device = devicesByUID[uid], isDeviceAvailable(device) else { continue }
-            return symbolForDevice(device)
+            return overrideSymbol(forUID: uid) ?? symbolForDevice(device)
         }
 
         if defaultDeviceID.isValid {
+            if let uid = uidForDefaultID(defaultDeviceID), let symbol = overrideSymbol(forUID: uid) {
+                return symbol
+            }
             return symbolForDefaultID(defaultDeviceID)
         }
 
         return fallbackSymbol
     }
-
-    static func symbol(for device: AudioDevice, override: String?) -> String {
-        override ?? device.id.suggestedIconSymbol()
-    }
-
-    /// Same precedence for the bare default-device-ID path, where the UID
-    /// must be read from the HAL before the override can be looked up.
-    static func symbol(forDefaultID id: AudioDeviceID, override: (String) -> String?) -> String {
-        guard id.isValid else { return fallbackSymbol }
-        if let uid = try? id.readDeviceUID(), let symbol = override(uid) {
-            return symbol
-        }
-        return id.suggestedIconSymbol()
-    }
 }
```

**File**: `FineTune/Views/MenuBar/MenuBarIconCoordinator.swift` (modified, +1/-6)
```diff
@@ -94,12 +94,7 @@ final class MenuBarIconCoordinator: MediaKeyIconFlashing {
             priorityOrder: settings.devicePriorityOrder,
             outputDevices: deviceProvider.outputDevices,
             defaultDeviceID: deviceVolumeMonitor.defaultDeviceID,
-            symbolForDevice: { [settings] device in
-                MenuBarDeviceIconResolver.symbol(for: device, override: settings.getDeviceIconOverride(for: device.uid))
-            },
-            symbolForDefaultID: { [settings] id in
-                MenuBarDeviceIconResolver.symbol(forDefaultID: id, override: { settings.getDeviceIconOverride(for: $0) })
-            }
+            overrideForUID: { [settings] in settings.getDeviceIconOverride(for: $0) }
         )
     }
 
```

**File**: `FineTuneTests/MenuBarDeviceIconResolverTests.swift` (modified, +110/-31)
```diff
@@ -127,54 +127,133 @@ struct MenuBarDeviceIconResolverTests {
         #expect(symbol == MenuBarDeviceIconResolver.fallbackSymbol)
     }
 
-    @Test("Override-aware device symbol wins over the derived symbol")
-    func overrideAwareSymbolWins() {
-        let d = device(id: 2, uid: "airpods", name: "AirPods Pro")
-        #expect(MenuBarDeviceIconResolver.symbol(for: d, override: "gamecontroller.fill") == "gamecontroller.fill")
-    }
-
-    @Test("Nil override falls back to the device-derived symbol")
-    func nilOverrideFallsBack() {
-        // 0xFFFFFFFE is never assigned by the HAL, so the fake ID deterministically
-        // reads as unreadable name + unknown transport on any machine.
-        let d = device(id: 0xFFFF_FFFE, uid: "airpods", name: "AirPods Pro")
-        #expect(
-            MenuBarDeviceIconResolver.symbol(for: d, override: nil)
-                == AudioDeviceID.iconSymbol(forName: "", transport: .unknown)
+    @Test("Resolvable override wins over the derived symbol")
+    func resolvableOverrideWins() {
+        let devices = [device(id: 2, uid: "airpods", name: "AirPods Pro")]
+        let symbol = MenuBarDeviceIconResolver.resolveSymbol(
+            priorityOrder: ["airpods"],
+            outputDevices: devices,
+            defaultDeviceID: 2,
+            overrideForUID: { ["airpods": "gamecontroller.fill"][$0] },
+            isSymbolResolvable: { _ in true },
+            isDeviceAvailable: { _ in true },
+            symbolForDevice: { _ in "headphones" },
+            symbolForDefaultID: { _ in "speaker.wave.2" }
         )
+        #expect(symbol == "gamecontroller.fill")
     }
 
-    @Test("resolveSymbol surfaces an override through the injected closure")
-    func resolveSymbolWithOverrideClosure() {
-        let overrides = ["airpods": "gamecontroller.fill"]
+    @Test("Unresolvable override falls back to the derived symbol")
+    func unresolvableOverrideFallsBack() {
         let devices = [device(id: 2, uid: "airpods", name: "AirPods Pro")]
         let symbol = MenuBarDeviceIconResolver.resolveSymbol(
             priorityOrder: ["airpods"],
             outputDevices: devices,
             defaultDeviceID: 2,
+            overrideForUID: { _ in "not.a.real.symbol" },
+            isSymbolResolvable: { _ in false },
             isDeviceAvailable: { _ in true },
-            symbolForDevice: { MenuBarDeviceIconResolver.symbol(for: $0, override: overrides[$0.uid]) },
+            symbolForDevice: { _ in "headphones" },
             symbolForDefaultID: { _ in "speaker.wave.2" }
         )
-        #expect(symbol == "gamecontroller.fill")
+        #expect(symbol == "headphones")
     }
 
-    @Test("Invalid default ID returns the fallback without consulting the override")
-    func defaultIDInvalidReturnsFallback() {
-        var consulted = false
-        let symbol = MenuBarDeviceIconResolver.symbol(forDefaultID: .unknown, override: { _ in
-            consulted = true
-            return "nope"
-        })
-        #expect(symbol == MenuBarDeviceIconResolver.fallbackSymbol)
-        #expect(!consulted)
+    @Test("The default validator accepts a real SF Symbol and rejects a bogus name")
+    func defaultValidatorChecksRealSymbols() {
+        let devices = [device(id: 2, uid: "airpods", name: "AirPods Pro")]
+        func resolve(override: String) -> String {
+            MenuBarDeviceIconResolver.resolveSymbol(
+                priorityOrder: ["airpods"],
+                outputDevices: devices,
+                defaultDeviceID: 2,
+                overrideForUID: { _ in override },
+                isDeviceAvailable: { _ in true },
+                symbolForDevice: { _ in "headphones" },
+                symbolForDefaultID: { _ in "speaker.wave.2" }
+            )
+        }
+        #expect(resolve(override: "gamecontroller.fill") == "gamecontroller.fill")
+        #expect(resolve(override: "not.a.real.symbol") == "headphones")
+    }
+
+    @Test("Priority-path device consults the override too")
+    func priorityPathConsultsOverride() {
+        let devices = [device(id: 2, uid: "homepod", name: "HomePod")]
+        let symbol = MenuBarDeviceIconResolver.resolveSymbol(
+            priorityOrder: ["homepod"],
+            outputDevices: devices,
+            defaultDeviceID: 999,
+            overrideForUID: { ["homepod": "tv.fill"][$0] },
+            isSymbolResolvable: { _ in true },
+            isDeviceAvailable: { _ in true },
+            symbolForDevice: { _ in "homepod" },
+            symbolForDefaultID: { _ in "speaker.wave.2" }
+        )
+        #expect(symbol == "tv.fill")
+    }
+
+    @Test("Default-ID path surfaces a resolvable override")
+    func defaultIDOverrideWins() {
+        let symbol = MenuBarDeviceIconResolver.resolveSymbol(
+            priorityOrder: [],
+            outputDevices: [],
+            defaultDeviceID: 42,
+            overrideForUID: { ["monitor-uid": "tv.fill"][$0] },
+            isSymbolResolvable: { _ in 
```

---

### Incident Patch 2: `0c93216f` (2026-07-09)
**Commit Message**: fix(ddc): count any successful DDC write cycle as success

A transient error on the second duplicated cycle (#362) reported failure
for a value the display had already applied, burning retries and stalling
the DDC queue. Matches i2cWriteRead's semantics.

**File**: `FineTune/Audio/DDC/DDCService.swift` (modified, +5/-1)
```diff
@@ -139,16 +139,20 @@ final class DDCService: @unchecked Sendable {
     /// Writes a DDC packet without reading a response.
     ///
     /// Send all write cycles; some displays only apply the second write.
+    /// Any cycle succeeding counts as success (matching i2cWriteRead) — the
+    /// display already applied the value even if a later cycle errors.
     private func i2cWrite(packet: [UInt8]) throws {
         var lastResult: IOReturn = kIOReturnError
+        var anySucceeded = false
         for _ in 0..<numWriteCycles {
             usleep(writeSleepTime)
             lastResult = packet.withUnsafeBufferPointer { buf in
                 IOAVServiceLoader.writeI2C(service: service, chipAddress: chipAddress,
                                            dataAddress: writeAddress, buffer: buf.baseAddress!, size: UInt32(buf.count))
             }
+            if lastResult == kIOReturnSuccess { anySucceeded = true }
         }
-        guard lastResult == kIOReturnSuccess else { throw DDCError.writeFailed(lastResult) }
+        guard anySucceeded else { throw DDCError.writeFailed(lastResult) }
     }
 
     // MARK: - VCP Commands
```

---

### Incident Patch 3: `67e4687f` (2026-07-09)
**Commit Message**: fix(menu-bar): render all icons on a shared fixed-size canvas

Differing symbol widths made the variable-length status item resize and
shift neighboring menu bar items on every volume, mute, or device change.

Fixes #367

**File**: `FineTune/Views/MenuBar/MenuBarIconImage+NSImage.swift` (modified, +23/-4)
```diff
@@ -7,14 +7,33 @@ import AppKit
 
 @MainActor
 extension MenuBarIconImage {
+    /// The status item is variable-length: icons of differing sizes resize it and shift every neighboring menu bar item.
+    static let canvasSize = NSSize(width: 22, height: 18)
+
     func nsImage(accessibilityDescription: String = "FineTune") -> NSImage? {
+        let source: NSImage?
         switch self {
         case .systemSymbol(let name):
-            let image = NSImage(systemSymbolName: name, accessibilityDescription: accessibilityDescription)
-            image?.isTemplate = true
-            return image
+            source = NSImage(systemSymbolName: name, accessibilityDescription: accessibilityDescription)
         case .asset(let name):
-            return NSImage(named: name)
+            source = NSImage(named: name)
+        }
+        guard let source else { return nil }
+
+        let canvas = Self.canvasSize
+        let scale = min(1, canvas.width / source.size.width, canvas.height / source.size.height)
+        let drawRect = NSRect(
+            x: (canvas.width - source.size.width * scale) / 2,
+            y: (canvas.height - source.size.height * scale) / 2,
+            width: source.size.width * scale,
+            height: source.size.height * scale
+        )
+        let image = NSImage(size: canvas, flipped: false) { _ in
+            source.draw(in: drawRect)
+            return true
         }
+        image.isTemplate = true
+        image.accessibilityDescription = accessibilityDescription
+        return image
     }
 }
```

**File**: `FineTuneTests/MenuBarIconImageSizeTests.swift` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+// FineTuneTests/MenuBarIconImageSizeTests.swift
+// Size invariance for menu bar icons — the status item is variable-length,
+// so icons of differing sizes resize it and shift neighboring items.
+
+import AppKit
+import Testing
+@testable import FineTune
+
+@Suite("MenuBarIconImage — size invariance")
+@MainActor
+struct MenuBarIconImageSizeTests {
+
+    /// Every image the coordinator can put on the status bar button.
+    private var reachableImages: [MenuBarIconImage] {
+        var images: [MenuBarIconImage] = [MenuBarIconState.speakerMuted.image]
+        images += [VolumeBucket.zero, .low, .mid, .high].map { .systemSymbol($0.symbolName) }
+        images += MenuBarIconStyle.allCases.map {
+            MenuBarIconState.baseline(style: $0, volume: 0.5, muted: false).image
+        }
+        images += DeviceIconCatalog.categories.flatMap(\.entries).map { .systemSymbol($0.symbol) }
+        // Resolver fallbacks not in the catalog (AudioDeviceID.iconSymbol / TransportType.defaultIconSymbol).
+        images += [
+            "macstudio.fill", "macmini.fill", "macbook", "desktopcomputer", "display",
+            "appletv", "homepod", "homepodmini", "airplayaudio", "bolt.horizontal",
+            "tv", "speaker.wave.2", "hifispeaker",
+        ].map { .systemSymbol($0) }
+        return images
+    }
+
+    @Test("every reachable icon renders at one shared size")
+    func allIconsShareOneSize() throws {
+        let canonical = try #require(MenuBarIconState.speakerVolume(.high).image.nsImage()).size
+        for image in reachableImages {
+            let rendered = try #require(image.nsImage(), "\(image) produced no NSImage")
+            #expect(rendered.size == canonical, "\(image) is \(rendered.size), canonical is \(canonical)")
+        }
+    }
+
+    @Test("shared size never downscales the widest speaker symbol")
+    func sharedSizeCoversNaturalSymbolSize() throws {
+        let shared = try #require(MenuBarIconState.speakerVolume(.high).image.nsImage()).size
+        let natural = try #require(NSImage(systemSymbolName: "speaker.wave.3.fill", accessibilityDescription: nil)).size
+        #expect(shared.width >= natural.width)
+        #expect(shared.height >= natural.height)
+    }
+
+    @Test("template rendering and accessibility description survive")
+    func templateAndAccessibilitySurvive() throws {
+        for image in [MenuBarIconImage.systemSymbol("speaker.fill"), .asset("MenuBarIcon")] {
+            let rendered = try #require(image.nsImage())
+            #expect(rendered.isTemplate, "\(image) lost template rendering")
+            #expect(rendered.accessibilityDescription == "FineTune", "\(image) lost accessibility description")
+        }
+    }
+}
```

---

### Incident Patch 4: `4f7c0e10` (2026-07-07)
**Commit Message**: fix(ddc): send VCP writes twice (#362)

Do not stop after the first successful I2C write;
MonitorControl's Arm64 DDC path also runs the configured write cycles.

**File**: `FineTune/Audio/DDC/DDCService.swift` (modified, +5/-3)
```diff
@@ -137,16 +137,18 @@ final class DDCService: @unchecked Sendable {
     }
 
     /// Writes a DDC packet without reading a response.
+    ///
+    /// Send all write cycles; some displays only apply the second write.
     private func i2cWrite(packet: [UInt8]) throws {
+        var lastResult: IOReturn = kIOReturnError
         for _ in 0..<numWriteCycles {
             usleep(writeSleepTime)
-            let result = packet.withUnsafeBufferPointer { buf in
+            lastResult = packet.withUnsafeBufferPointer { buf in
                 IOAVServiceLoader.writeI2C(service: service, chipAddress: chipAddress,
                                            dataAddress: writeAddress, buffer: buf.baseAddress!, size: UInt32(buf.count))
             }
-            if result == kIOReturnSuccess { return }
         }
-        throw DDCError.writeFailed(kIOReturnError)
+        guard lastResult == kIOReturnSuccess else { throw DDCError.writeFailed(lastResult) }
     }
 
     // MARK: - VCP Commands
```

---

### Incident Patch 5: `8855c96e` (2026-07-07)
**Commit Message**: fix(devices): hide picker scroll bar and add cell hover feedback

**File**: `FineTune/Views/Components/DeviceIconPicker.swift` (modified, +51/-27)
```diff
@@ -38,6 +38,7 @@ struct DeviceIconPicker: View {
                 }
             }
             .frame(height: 300)
+            .scrollIndicators(.never)
 
             Button("Restore Default") {
                 onSelect(nil)
@@ -91,35 +92,13 @@ struct DeviceIconPicker: View {
     private func grid(symbols: [String], highlighted: String?) -> some View {
         LazyVGrid(columns: Self.columns, spacing: DesignTokens.Spacing.xs) {
             ForEach(symbols, id: \.self) { symbol in
-                cell(symbol, isHighlighted: symbol == highlighted)
-            }
-        }
-    }
-
-    private func cell(_ symbol: String, isHighlighted: Bool) -> some View {
-        Button {
-            onSelect(symbol)
-        } label: {
-            Image(systemName: symbol)
-                .font(.system(size: 15))
-                .symbolRenderingMode(.hierarchical)
-                .frame(maxWidth: .infinity, minHeight: 34)
-                .background(
-                    RoundedRectangle(cornerRadius: 7)
-                        .fill(isHighlighted ? DesignTokens.Colors.glassFillStrong : Color.clear)
+                IconCell(
+                    symbol: symbol,
+                    isHighlighted: symbol == highlighted,
+                    onSelect: { onSelect(symbol) }
                 )
-                .overlay(
-                    RoundedRectangle(cornerRadius: 7)
-                        .strokeBorder(
-                            isHighlighted ? DesignTokens.Colors.accentPrimary : Color.clear,
-                            lineWidth: 1.5
-                        )
-                )
-                .contentShape(RoundedRectangle(cornerRadius: 7))
+            }
         }
-        .buttonStyle(.plain)
-        .help(symbol)
-        .accessibilityLabel(DeviceIconCatalog.entry(for: symbol)?.keywords.first?.capitalized ?? symbol)
     }
 
     private var searchField: some View {
@@ -184,6 +163,51 @@ struct DeviceIconPicker: View {
     }
 }
 
+// MARK: - Icon Cell
+
+/// One grid cell with its own hover state. Per-cell state (not a shared
+/// hovered-symbol on the picker) because the Suggested section repeats
+/// catalog symbols — identity by symbol would light up both twins at once.
+private struct IconCell: View {
+    let symbol: String
+    let isHighlighted: Bool
+    let onSelect: () -> Void
+
+    @State private var isHovered = false
+
+    var body: some View {
+        Button(action: onSelect) {
+            Image(systemName: symbol)
+                .font(.system(size: 15))
+                .symbolRenderingMode(.hierarchical)
+                .frame(maxWidth: .infinity, minHeight: 34)
+                .background(
+                    RoundedRectangle(cornerRadius: 7)
+                        .fill(fill)
+                )
+                .overlay(
+                    RoundedRectangle(cornerRadius: 7)
+                        .strokeBorder(
+                            isHighlighted ? DesignTokens.Colors.accentPrimary : Color.clear,
+                            lineWidth: 1.5
+                        )
+                )
+                .contentShape(RoundedRectangle(cornerRadius: 7))
+        }
+        .buttonStyle(.plain)
+        .onHover { isHovered = $0 }
+        .animation(DesignTokens.Animation.hover, value: isHovered)
+        .help(symbol)
+        .accessibilityLabel(DeviceIconCatalog.entry(for: symbol)?.keywords.first?.capitalized ?? symbol)
+    }
+
+    private var fill: Color {
+        if isHighlighted { return DesignTokens.Colors.glassFillStrong }
+        if isHovered { return DesignTokens.Colors.hoverSurface }
+        return .clear
+    }
+}
+
 // MARK: - Previews
 
 #Preview("DeviceIconPicker") {
```

---

### Incident Patch 6: `ccf5c030` (2026-07-07)
**Commit Message**: feat(devices): render user icon overrides across device surfaces

Adds a single DeviceIconResolver precedence helper (override symbol wins,
falls back to the auto-assigned icon on nil or an unresolvable symbol) and
threads deviceIconOverrides/iconOverrideSymbol through every popup surface
that draws a device icon, so a saved override shows up everywhere without
each view re-deriving the precedence rule.

**File**: `FineTune/Utilities/DeviceIconResolver.swift` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+// FineTune/Utilities/DeviceIconResolver.swift
+import AppKit
+
+/// Applies the device-icon display precedence:
+/// user override → automatic icon (driver image or suggested SF Symbol).
+enum DeviceIconResolver {
+    /// An override symbol that fails to resolve (hand-edited settings.json,
+    /// symbol removed in a future macOS) falls back to the automatic icon
+    /// rather than producing a blank glyph.
+    static func displayIcon(
+        overrideSymbol: String?,
+        automatic: NSImage?,
+        deviceName: String
+    ) -> NSImage? {
+        if let overrideSymbol,
+           let image = NSImage(systemSymbolName: overrideSymbol, accessibilityDescription: deviceName) {
+            return image
+        }
+        return automatic
+    }
+}
```

**File**: `FineTune/Views/Components/DevicePicker.swift` (modified, +22/-11)
```diff
@@ -12,6 +12,7 @@ struct DevicePicker: View {
     }
 
     let devices: [AudioDevice]
+    var deviceIconOverrides: [String: String] = [:]
     let selectedDeviceUID: String  // For single mode
     let selectedDeviceUIDs: Set<String>  // For multi mode
     let isFollowingDefault: Bool
@@ -58,13 +59,6 @@ struct DevicePicker: View {
             case .device(let device): return device.name
             }
         }
-
-        var icon: NSImage? {
-            switch self {
-            case .systemAudio: return nil
-            case .device(let device): return device.icon
-            }
-        }
     }
 
     private var menuItems: [MenuItem] {
@@ -124,9 +118,17 @@ struct DevicePicker: View {
         }
     }
 
+    private func displayIcon(for device: AudioDevice) -> NSImage? {
+        DeviceIconResolver.displayIcon(
+            overrideSymbol: deviceIconOverrides[device.uid],
+            automatic: device.icon,
+            deviceName: device.name
+        )
+    }
+
     @ViewBuilder
     private func deviceIcon(_ device: AudioDevice) -> some View {
-        if let icon = device.icon {
+        if let icon = displayIcon(for: device) {
             Image(nsImage: icon)
                 .resizable()
                 .aspectRatio(contentMode: .fit)
@@ -145,7 +147,7 @@ struct DevicePicker: View {
                 .font(.system(size: 15))
                 .symbolRenderingMode(.hierarchical)
         } else if let device = devices.first(where: { $0.uid == selectedDeviceUID }),
-                  let icon = device.icon {
+                  let icon = displayIcon(for: device) {
             Image(nsImage: icon)
                 .resizable()
                 .aspectRatio(contentMode: .fit)
@@ -343,6 +345,12 @@ struct DevicePicker: View {
 
         DevicePickerRow(
             item: item,
+            resolvedIcon: {
+                if case .device(let device) = item {
+                    return displayIcon(for: device)
+                }
+                return nil
+            }(),
             isSelected: isSelected,
             isDisabled: isDisabled,
             isMultiMode: currentMode == .multi,
@@ -407,6 +415,7 @@ struct DevicePicker: View {
 
 private struct DevicePickerRow: View {
     let item: DevicePicker.MenuItem
+    let resolvedIcon: NSImage?
     let isSelected: Bool
     let isDisabled: Bool
     let isMultiMode: Bool
@@ -482,8 +491,8 @@ private struct DevicePickerRow: View {
                 .font(.system(size: 13))
                 .frame(width: 16)
                 .foregroundStyle(isDisabled ? DesignTokens.Colors.textQuaternary : DesignTokens.Colors.textSecondary)
-        case .device(let device):
-            if let icon = device.icon {
+        case .device:
+            if let icon = resolvedIcon {
                 Image(nsImage: icon)
                     .resizable()
                     .aspectRatio(contentMode: .fit)
@@ -551,6 +560,7 @@ extension DevicePicker {
     /// Convenience initializer for single-mode only usage (backward compatible)
     init(
         devices: [AudioDevice],
+        deviceIconOverrides: [String: String] = [:],
         selectedDeviceUID: String,
         isFollowingDefault: Bool,
         defaultDeviceUID: String?,
@@ -559,6 +569,7 @@ extension DevicePicker {
         onSelectFollowDefault: @escaping () -> Void
     ) {
         self.devices = devices
+        self.deviceIconOverrides = deviceIconOverrides
         self.selectedDeviceUID = selectedDeviceUID
         self.selectedDeviceUIDs = []
         self.isFollowingDefault = isFollowingDefault
```

**File**: `FineTune/Views/MenuBarPopupView.swift` (modified, +7/-2)
```diff
@@ -562,7 +562,8 @@ struct MenuBarPopupView: View {
                             let currentMute = deviceVolumeMonitor.inputMuteStates[device.id] ?? false
                             deviceVolumeMonitor.setInputMute(for: device.id, to: !currentMute)
                         },
-                        isFocused: hasKeyboardEngaged && selectedRow == .device(uid: device.uid)
+                        isFocused: hasKeyboardEngaged && selectedRow == .device(uid: device.uid),
+                        iconOverrideSymbol: audioEngine.settingsManager.getDeviceIconOverride(for: device.uid)
                     )
                     .id(PopupKeyboardNavModel.RowID.device(uid: device.uid))
                 }
@@ -617,7 +618,8 @@ struct MenuBarPopupView: View {
                         onAutoEQPreampToggle: {
                             audioEngine.setAutoEQPreampEnabled(!audioEngine.autoEQPreampEnabled)
                         },
-                        isFocused: hasKeyboardEngaged && selectedRow == .device(uid: device.uid)
+                        isFocused: hasKeyboardEngaged && selectedRow == .device(uid: device.uid),
+                        iconOverrideSymbol: audioEngine.settingsManager.getDeviceIconOverride(for: device.uid)
                     )
                     .id(PopupKeyboardNavModel.RowID.device(uid: device.uid))
                 }
@@ -641,6 +643,7 @@ struct MenuBarPopupView: View {
 
         DeviceEditRow(
             device: device,
+            iconOverrideSymbol: audioEngine.settingsManager.getDeviceIconOverride(for: device.uid),
             priorityIndex: index,
             isDefault: device.id == defaultDeviceID,
             isInputDevice: showingInputDevices,
@@ -860,6 +863,7 @@ struct MenuBarPopupView: View {
                 volume: audioEngine.getVolume(for: app),
                 isMuted: audioEngine.getMute(for: app),
                 devices: sortedDevices,
+                deviceIconOverrides: audioEngine.settingsManager.deviceIconOverrides,
                 selectedDeviceUID: deviceUID,
                 selectedDeviceUIDs: audioEngine.getSelectedDeviceUIDs(for: app),
                 isFollowingDefault: audioEngine.isFollowingDefault(for: app),
@@ -931,6 +935,7 @@ struct MenuBarPopupView: View {
             icon: displayableApp.icon,
             volume: audioEngine.getVolumeForInactive(identifier: identifier),
             devices: sortedDevices,
+            deviceIconOverrides: audioEngine.settingsManager.deviceIconOverrides,
             selectedDeviceUID: audioEngine.getDeviceRoutingForInactive(identifier: identifier),
             selectedDeviceUIDs: audioEngine.getSelectedDeviceUIDsForInactive(identifier: identifier),
             isFollowingDefault: audioEngine.isFollowingDefaultForInactive(identifier: identifier),
```

**File**: `FineTune/Views/Rows/AppRow.swift` (modified, +4/-0)
```diff
@@ -8,6 +8,7 @@ struct AppRow: View {
     let volume: Float  // Linear gain 0-1 (boost applied separately)
     let audioLevel: Float
     let devices: [AudioDevice]
+    let deviceIconOverrides: [String: String]
     let selectedDeviceUID: String  // For single mode
     let selectedDeviceUIDs: Set<String>  // For multi mode
     let isFollowingDefault: Bool
@@ -42,6 +43,7 @@ struct AppRow: View {
         volume: Float,
         audioLevel: Float = 0,
         devices: [AudioDevice],
+        deviceIconOverrides: [String: String] = [:],
         selectedDeviceUID: String,
         selectedDeviceUIDs: Set<String> = [],
         isFollowingDefault: Bool = true,
@@ -72,6 +74,7 @@ struct AppRow: View {
         self.volume = volume
         self.audioLevel = audioLevel
         self.devices = devices
+        self.deviceIconOverrides = deviceIconOverrides
         self.selectedDeviceUID = selectedDeviceUID
         self.selectedDeviceUIDs = selectedDeviceUIDs
         self.isFollowingDefault = isFollowingDefault
@@ -156,6 +159,7 @@ struct AppRow: View {
                     volume: volume,
                     isMuted: isMutedExternal,
                     devices: devices,
+                    deviceIconOverrides: deviceIconOverrides,
                     selectedDeviceUID: selectedDeviceUID,
                     selectedDeviceUIDs: selectedDeviceUIDs,
                     isFollowingDefault: isFollowingDefault,
```

**File**: `FineTune/Views/Rows/AppRowControls.swift` (modified, +2/-0)
```diff
@@ -7,6 +7,7 @@ struct AppRowControls: View {
     let volume: Float
     let isMuted: Bool
     let devices: [AudioDevice]
+    var deviceIconOverrides: [String: String] = [:]
     let selectedDeviceUID: String
     let selectedDeviceUIDs: Set<String>
     let isFollowingDefault: Bool
@@ -113,6 +114,7 @@ struct AppRowControls: View {
 
             DevicePicker(
                 devices: devices,
+                deviceIconOverrides: deviceIconOverrides,
                 selectedDeviceUID: selectedDeviceUID,
                 selectedDeviceUIDs: selectedDeviceUIDs,
                 isFollowingDefault: isFollowingDefault,
```

**File**: `FineTune/Views/Rows/AppRowWithLevelPolling.swift` (modified, +4/-0)
```diff
@@ -7,6 +7,7 @@ struct AppRowWithLevelPolling: View {
     let volume: Float
     let isMuted: Bool
     let devices: [AudioDevice]
+    let deviceIconOverrides: [String: String]
     let selectedDeviceUID: String
     let selectedDeviceUIDs: Set<String>
     let isFollowingDefault: Bool
@@ -42,6 +43,7 @@ struct AppRowWithLevelPolling: View {
         volume: Float,
         isMuted: Bool,
         devices: [AudioDevice],
+        deviceIconOverrides: [String: String] = [:],
         selectedDeviceUID: String,
         selectedDeviceUIDs: Set<String> = [],
         isFollowingDefault: Bool = true,
@@ -73,6 +75,7 @@ struct AppRowWithLevelPolling: View {
         self.volume = volume
         self.isMuted = isMuted
         self.devices = devices
+        self.deviceIconOverrides = deviceIconOverrides
         self.selectedDeviceUID = selectedDeviceUID
         self.selectedDeviceUIDs = selectedDeviceUIDs
         self.isFollowingDefault = isFollowingDefault
@@ -107,6 +110,7 @@ struct AppRowWithLevelPolling: View {
             volume: volume,
             audioLevel: displayLevel,
             devices: devices,
+            deviceIconOverrides: deviceIconOverrides,
             selectedDeviceUID: selectedDeviceUID,
             selectedDeviceUIDs: selectedDeviceUIDs,
             isFollowingDefault: isFollowingDefault,
```

**File**: `FineTune/Views/Rows/DeviceEditRow.swift` (modified, +10/-1)
```diff
@@ -8,6 +8,7 @@ import AppKit
 /// expand — siblings keep their own gestures.
 struct DeviceEditRow<ExpandedContent: View>: View {
     let device: AudioDevice
+    var iconOverrideSymbol: String? = nil
     let priorityIndex: Int
     let isDefault: Bool
     let isInputDevice: Bool
@@ -21,6 +22,14 @@ struct DeviceEditRow<ExpandedContent: View>: View {
 
     @State private var isInfoButtonHovered = false
 
+    private var displayIcon: NSImage? {
+        DeviceIconResolver.displayIcon(
+            overrideSymbol: iconOverrideSymbol,
+            automatic: device.icon,
+            deviceName: device.name
+        )
+    }
+
     var body: some View {
         ExpandableGlassRow(isExpanded: isExpanded) {
             headerRow
@@ -56,7 +65,7 @@ struct DeviceEditRow<ExpandedContent: View>: View {
 
             HStack(spacing: DesignTokens.Spacing.sm) {
                 Group {
-                    if let icon = device.icon {
+                    if let icon = displayIcon {
                         Image(nsImage: icon)
                             .resizable()
                             .aspectRatio(contentMode: .fit)
```

**File**: `FineTune/Views/Rows/DeviceRow.swift` (modified, +13/-2)
```diff
@@ -42,6 +42,7 @@ struct DeviceRow: View {
     let autoEQPreampEnabled: Bool
     let onAutoEQPreampToggle: (() -> Void)?
     let isFocused: Bool
+    let iconOverrideSymbol: String?
 
     @State private var sliderValue: Double
     @State private var isEditing = false
@@ -63,6 +64,14 @@ struct DeviceRow: View {
     /// Default slider position to restore when unmuting from 0 (50%)
     private let defaultUnmuteVolume: Double = 0.5
 
+    private var displayIcon: NSImage? {
+        DeviceIconResolver.displayIcon(
+            overrideSymbol: iconOverrideSymbol,
+            automatic: device.icon,
+            deviceName: device.name
+        )
+    }
+
     init(
         device: AudioDevice,
         isDefault: Bool,
@@ -84,7 +93,8 @@ struct DeviceRow: View {
         autoEQImportError: String? = nil,
         autoEQPreampEnabled: Bool = true,
         onAutoEQPreampToggle: (() -> Void)? = nil,
-        isFocused: Bool = false
+        isFocused: Bool = false,
+        iconOverrideSymbol: String? = nil
     ) {
         self.device = device
         self.isDefault = isDefault
@@ -107,6 +117,7 @@ struct DeviceRow: View {
         self.autoEQPreampEnabled = autoEQPreampEnabled
         self.onAutoEQPreampToggle = onAutoEQPreampToggle
         self.isFocused = isFocused
+        self.iconOverrideSymbol = iconOverrideSymbol
         self._sliderValue = State(initialValue: Self.volumeToSlider(volume, backend: volumeBackend))
     }
 
@@ -134,7 +145,7 @@ struct DeviceRow: View {
             // Selection is now signalled by accent-colored gradient on the
             // badge plus bold device name; the row-level gesture in `body`
             // handles tap-to-set-default.
-            DeviceBadge(icon: device.icon, isSelected: isDefault)
+            DeviceBadge(icon: displayIcon, isSelected: isDefault)
 
             // Device name + optional AutoEQ profile subtitle + AutoEQ picker
             HStack(spacing: DesignTokens.Spacing.xs) {
```

---

### Incident Patch 7: `52d3663f` (2026-07-07)
**Commit Message**: fix(ddc): stop crash on DDC volume change (#361)

Swift 6 language mode (new in v1.8.0) gave the debounced write closure inherited @MainActor isolation, so the executor check trapped when it ran on ddcQueue.

Fixes #340, fixes #348, fixes #353, fixes #356

**File**: `FineTune/Audio/DDC/DDCController.swift` (modified, +5/-3)
```diff
@@ -81,14 +81,16 @@ final class DDCController {
             settingsManager.setDDCVolume(for: uid, to: clamped)
         }
 
-        // Debounce DDC write
+        // Keep the work item @Sendable and avoid `self`; otherwise it inherits
+        // @MainActor isolation here and traps when run on `ddcQueue`.
         debounceTimers[deviceID]?.cancel()
         let service = services[deviceID]
-        let item = DispatchWorkItem { [weak self] in
+        let logger = self.logger
+        let item = DispatchWorkItem { @Sendable in
             do {
                 try service?.setAudioVolume(clamped)
             } catch {
-                self?.logger.error("DDC write failed for device \(deviceID): \(error)")
+                logger.error("DDC write failed for device \(deviceID): \(error)")
             }
         }
         debounceTimers[deviceID] = item
```

---

### Incident Patch 8: `f4d9e82c` (2026-06-14)
**Commit Message**: fix(audio): honour aggregate device channel assignment, e.g. stereo on 3/4 (#327)

Flattens user-aggregate targets into the wrapping aggregate and goes non-stacked only for a single flattened sub-device with one output stream, so the IO callback places audio on the device's preferred 3/4 pair. The stream-usage map leaves the duplex device's hardware inputs unpowered. Validated on a Scarlett 4i4 (macOS 26.5.1).

Co-authored-by: Rocco Lucia <[REDACTED_EMAIL]>

**File**: `FineTune/Audio/Engine/ProcessTapController.swift` (modified, +148/-8)
```diff
@@ -10,7 +10,7 @@ import os
 // 1. **Main thread / @MainActor**: All setup, teardown, and state management.
 //    - activate(), invalidate(), updateDevices(), performCrossfadeSwitch()
 //    - Property writes to nonisolated(unsafe) vars (_volume, _isMuted, etc.)
-//    - This class is NOT @MainActor itself because the HAL I/O callback is not on main.
+//    - The class is @MainActor; the HAL callback is explicitly nonisolated.
 //
 // 2. **HAL I/O thread (real-time)**: Audio processing callback.
 //    - processAudioCallback() — unified callback with runtime role via callbackID
@@ -290,14 +290,92 @@ final class ProcessTapController: ProcessTapControlling {
 
     // MARK: - Multi-Device Aggregate Configuration
 
+    /// Resolved plan for FineTune's private wrapping aggregate: which hardware sub-devices
+    /// to include, whether to stack them, and which one is the clock/main device.
+    struct AggregatePlan: Equatable {
+        var subDeviceUIDs: [String]
+        var isStacked: Bool
+        var clockDeviceUID: String
+    }
+
+    /// Pure planning step for `buildAggregateDescription`.
+    ///
+    /// Three CoreAudio constraints drive this:
+    ///   1. An aggregate device cannot be nested as a sub-device of another aggregate (the
+    ///      wrapping aggregate would report 0 output channels). User-created aggregates are
+    ///      therefore *flattened* into their hardware sub-devices via `expand`.
+    ///   2. A *stacked* aggregate collapses a multichannel sub-device's output to a single
+    ///      stereo pair, which discards the device's preferred (e.g. 3/4) stereo channel
+    ///      assignment. A flattened single output is therefore kept *non-stacked*, exposing
+    ///      every channel so the IO callback can place audio on the preferred channels.
+    ///   3. The IO callback can only honour that placement when the wrapper exposes exactly
+    ///      ONE output stream: preferred-channel indices are device-global, and the callback
+    ///      locates the tap as the trailing input buffer(s). A flatten that yields several
+    ///      sub-devices (or one device with several output streams) produces a multi-stream
+    ///      wrapper where neither holds, so those stay stacked — which also makes
+    ///      Multi-Output Device targets mirror correctly instead of playing one sub-device.
+    ///
+    /// - Parameters:
+    ///   - outputUIDs: The user-selected output device UIDs (1 = single, >1 = mirroring).
+    ///   - expand: Returns an aggregate's hardware sub-device UIDs, or `nil` for non-aggregates.
+    ///   - outputStreamCount: Returns a device's output-stream count (0 if unknown).
+    static func planAggregate(
+        outputUIDs: [String],
+        expand: (String) -> [String]?,
+        outputStreamCount: (String) -> Int
+    ) -> AggregatePlan {
+        precondition(!outputUIDs.isEmpty, "Must have at least one output device")
+
+        var flatUIDs: [String] = []
+        var didFlatten = false
+        for uid in outputUIDs {
+            if let subDevices = expand(uid), !subDevices.isEmpty {
+                flatUIDs.append(contentsOf: subDevices)
+                didFlatten = true
+            } else {
+                flatUIDs.append(uid)
+            }
+        }
+
+        // De-duplicate while preserving order (a device could appear in more than one aggregate).
+        var seen = Set<String>()
+        flatUIDs = flatUIDs.filter { seen.insert($0).inserted }
+
+        let isMirroring = outputUIDs.count > 1
+        let isSingleFlatten = didFlatten && !isMirroring && flatUIDs.count == 1
+        let isStacked = !(isSingleFlatten && outputStreamCount(flatUIDs[0]) == 1)
+
+        return AggregatePlan(
+            subDeviceUIDs: flatUIDs,
+            isStacked: isStacked,
+            clockDeviceUID: flatUIDs[0]
+        )
+    }
+
     /// Builds aggregate device description for synchronized multi-device output.
     /// First device is clock source (no drift compensation), others sync to it via drift compensation.
     private func buildAggregateDescription(outputUIDs: [String], tapUUID: UUID, name: String) -> [String: Any] {
         precondition(!outputUIDs.isEmpty, "Must have at least one output device")
 
+        let plan = Self.planAggregate(
+            outputUIDs: outputUIDs,
+            expand: { uid in
+                // If this output is a user aggregate, return its hardware sub-devices so they can
+                // be flattened into FineTune's aggregate (nested aggregates aren't supported).
+                audioDeviceID(for: uid)?.aggregateSubDeviceUIDs()
+            },
+            outputStreamCount: { uid in
+                audioDeviceID(for: uid)?.streamCount(scope: kAudioObjectPropertyScopeOutput) ?? 0
+            }
+        )
+
+        if plan.subDeviceUIDs != outputUIDs {
+            logger.info("Flattened output \(outputUIDs, privacy: .public) → sub-devices \(plan.subDeviceUIDs, privacy: .public) (stacked=\(plan.isStacke
```

**File**: `FineTune/Audio/Extensions/AudioDeviceID+Classification.swift` (modified, +30/-0)
```diff
@@ -22,6 +22,36 @@ nonisolated extension AudioDeviceID {
         readTransportType() == .virtual
     }
 
+    /// Returns the UIDs of an aggregate device's constituent hardware sub-devices,
+    /// in the aggregate's channel order, or `nil` if this is not an aggregate.
+    ///
+    /// Used to *flatten* a user-created aggregate before wrapping it in FineTune's own
+    /// private aggregate: CoreAudio does not allow an aggregate device to contain another
+    /// aggregate as a sub-device (the wrapping aggregate ends up reporting 0 output
+    /// channels), so the sub-devices must be expanded into FineTune's aggregate directly.
+    func aggregateSubDeviceUIDs() -> [String]? {
+        guard isAggregateDevice() else { return nil }
+
+        var address = AudioObjectPropertyAddress(
+            mSelector: kAudioAggregateDevicePropertyFullSubDeviceList,
+            mScope: kAudioObjectPropertyScopeGlobal,
+            mElement: kAudioObjectPropertyElementMain
+        )
+        guard AudioObjectHasProperty(self, &address) else { return nil }
+
+        var size: UInt32 = 0
+        guard AudioObjectGetPropertyDataSize(self, &address, 0, nil, &size) == noErr else { return nil }
+
+        // kAudioAggregateDevicePropertyFullSubDeviceList returns a +1-retained CFArray of
+        // CFString UIDs; takeRetainedValue transfers ownership to ARC.
+        var unmanaged: Unmanaged<CFArray>?
+        let err = AudioObjectGetPropertyData(self, &address, 0, nil, &size, &unmanaged)
+        guard err == noErr, let uids = unmanaged?.takeRetainedValue() as? [String], !uids.isEmpty else {
+            return nil
+        }
+        return uids
+    }
+
     func isBluetoothDevice() -> Bool {
         let t = readTransportType()
         return t == .bluetooth || t == .bluetoothLE
```

**File**: `FineTune/Audio/Extensions/AudioDeviceID+Streams.swift` (modified, +12/-0)
```diff
@@ -54,6 +54,18 @@ nonisolated extension AudioDeviceID {
         return streams
     }
 
+    /// Number of streams in the given scope (input/output). Counts streams, not channels.
+    func streamCount(scope: AudioObjectPropertyScope) -> Int {
+        var address = AudioObjectPropertyAddress(
+            mSelector: kAudioDevicePropertyStreams,
+            mScope: scope,
+            mElement: kAudioObjectPropertyElementMain
+        )
+        var size: UInt32 = 0
+        guard AudioObjectGetPropertyDataSize(self, &address, 0, nil, &size) == noErr else { return 0 }
+        return Int(size) / MemoryLayout<AudioObjectID>.size
+    }
+
     /// Returns the first output stream index in the device's global stream list.
     /// CATapDescription(deviceUID:stream:) expects this global index, not an output-only index.
     func firstOutputStreamIndex() throws -> UInt {
```

**File**: `FineTuneTests/AggregatePlanTests.swift` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+// FineTuneTests/AggregatePlanTests.swift
+//
+// Tests ProcessTapController.planAggregate() — the pure planning step that decides which
+// hardware sub-devices FineTune's private wrapping aggregate contains and whether it is
+// "stacked".
+//
+// Background (the bug these tests guard against): a user-created aggregate device whose
+// stereo speaker is assigned to channels other than 1/2 (e.g. 3/4) was not honoured.
+// Three CoreAudio constraints shape the plan:
+//   1. Aggregates can't be nested — wrapping one yields 0 output channels, so user
+//      aggregates must be flattened into their hardware sub-devices.
+//   2. A stacked aggregate collapses a multichannel sub-device to a single stereo pair,
+//      hiding channels 3+ so the preferred-channel placement could never reach them.
+//   3. The IO callback can only place audio on preferred channels when the wrapper
+//      exposes exactly one output stream, so multi-sub-device and multi-stream
+//      flattens stay stacked.
+
+import Testing
+@testable import FineTune
+
+@Suite("ProcessTapController — Aggregate Planning")
+struct AggregatePlanTests {
+
+    @Test("Single plain device: unchanged, stays stacked")
+    func singlePlainDevice() {
+        let plan = ProcessTapController.planAggregate(
+            outputUIDs: ["builtin"],
+            expand: { _ in nil },
+            outputStreamCount: { _ in 1 }
+        )
+        #expect(plan.subDeviceUIDs == ["builtin"])
+        #expect(plan.isStacked == true)
+        #expect(plan.clockDeviceUID == "builtin")
+    }
+
+    @Test("Single aggregate around a single-stream device: flattened and NOT stacked")
+    func singleAggregateFlattened() {
+        let plan = ProcessTapController.planAggregate(
+            outputUIDs: ["agg"],
+            expand: { $0 == "agg" ? ["scarlett"] : nil },
+            outputStreamCount: { _ in 1 }
+        )
+        #expect(plan.subDeviceUIDs == ["scarlett"])
+        // Non-stacked is the crux: it exposes all of the device's channels so the IO
+        // callback can place audio on the aggregate's preferred (3/4) channels.
+        #expect(plan.isStacked == false)
+        #expect(plan.clockDeviceUID == "scarlett")
+    }
+
+    @Test("Single aggregate around a multi-stream device: stays stacked")
+    func singleAggregateMultiStreamDevice() {
+        // A device exposing several output streams (stream-per-pair interfaces) breaks the
+        // callback's single-stream assumptions — the plan must fall back to stacked.
+        let plan = ProcessTapController.planAggregate(
+            outputUIDs: ["agg"],
+            expand: { $0 == "agg" ? ["motu"] : nil },
+            outputStreamCount: { _ in 2 }
+        )
+        #expect(plan.subDeviceUIDs == ["motu"])
+        #expect(plan.isStacked == true)
+    }
+
+    @Test("Single aggregate with multiple sub-devices: flattened, stays stacked, order preserved")
+    func singleAggregateMultipleSubDevices() {
+        // Multiple sub-devices ⇒ one output stream per sub-device ⇒ the callback cannot
+        // honour global preferred-channel placement, so the wrapper stays stacked
+        // (mirrors to all sub-devices, which also makes Multi-Output Devices work).
+        let plan = ProcessTapController.planAggregate(
+            outputUIDs: ["agg"],
+            expand: { $0 == "agg" ? ["devA", "devB"] : nil },
+            outputStreamCount: { _ in 1 }
+        )
+        #expect(plan.subDeviceUIDs == ["devA", "devB"])
+        #expect(plan.isStacked == true)
+        #expect(plan.clockDeviceUID == "devA")
+    }
+
+    @Test("Multi-device mirroring: stays stacked, order preserved")
+    func multiDeviceMirroring() {
+        let plan = ProcessTapController.planAggregate(
+            outputUIDs: ["a", "b"],
+            expand: { _ in nil },
+            outputStreamCount: { _ in 1 }
+        )
+        #expect(plan.subDeviceUIDs == ["a", "b"])
+        #expect(plan.isStacked == true)
+        #expect(plan.clockDeviceUID == "a")
+    }
+
+    @Test("Mirroring that includes an aggregate: aggregate flattened but stays stacked (mirror)")
+    func mirroringWithAggregate() {
+        let plan = ProcessTapController.planAggregate(
+            outputUIDs: ["agg", "speaker"],
+            expand: { $0 == "agg" ? ["scarlett"] : nil },
+            outputStreamCount: { _ in 1 }
+        )
+        #expect(plan.subDeviceUIDs == ["scarlett", "speaker"])
+        #expect(plan.isStacked == true)
+        #expect(plan.clockDeviceUID == "scarlett")
+    }
+
+    @Test("Duplicate hardware devices across flattening are de-duplicated, order preserved")
+    func deduplicatesSubDevices() {
+        let plan = ProcessTapController.planAggregate(
+            outputUIDs: ["agg", "scarlett"],
+            expand: { $0 == "agg" ? ["scarlett", "canton"] : nil },
+            outputStreamCount: { _ in 1 }
+        )
+        #expect(plan.subDeviceUIDs == ["scarlett", "canton"])
+        // count > 1 user s
```

**File**: `FineTuneTests/ProcessingPipelineTests.swift` (modified, +34/-0)
```diff
@@ -348,6 +348,40 @@ struct BufferMappingTests {
         }
     }
 
+    @Test("Stereo input to 6ch output: signal placed on preferred channels 3/4 (aggregate regression)")
+    func stereoToChannels3and4() {
+        // Regression for: aggregate device with its stereo speaker assigned to channels 3/4.
+        // After flattening + non-stacked wrapping, the output buffer exposes all 6 channels and
+        // the IO callback must place L/R on the preferred (zero-based 2/3 ⇒ channels 3/4) pair.
+        let frames = 64
+        let input = TestABL(buffers: [(channels: 2, frames: frames)])
+        let output = TestABL(buffers: [(channels: 6, frames: frames)])
+
+        let inData = input.data(at: 0)
+        for f in 0..<frames {
+            inData[f * 2] = 0.6      // left
+            inData[f * 2 + 1] = 0.4  // right
+        }
+
+        var vol: Float = 1.0
+        processWithDefaults(
+            input: input, output: output,
+            preferredStereoLeft: 2, preferredStereoRight: 3,
+            currentVol: &vol
+        )
+
+        let outData = output.data(at: 0)
+        for f in 0..<frames {
+            let base = f * 6
+            #expect(outData[base + 2] == 0.6, "Left should be on channel 3 (index 2) at frame \(f)")
+            #expect(outData[base + 3] == 0.4, "Right should be on channel 4 (index 3) at frame \(f)")
+            // Channels 1/2 (and 5/6) must be silent — this is exactly what was broken.
+            for ch in [0, 1, 4, 5] {
+                #expect(outData[base + ch] == 0.0, "Channel \(ch) at frame \(f) should be silent")
+            }
+        }
+    }
+
     @Test("Zero-frame buffer: output zeroed, no crash")
     func zeroFrameBuffer() {
         // frameCount = 0 should hit the guard and memset output to zero.
```

---

### Incident Patch 9: `4f27a28c` (2026-06-14)
**Commit Message**: fix(loudness): tune leveler defaults to reduce volume pumping (#304)

Larger analysis window/hop align the detector with BS.1770 momentary metering; the pumping reduction comes from the gain-smoother release time.

Co-authored-by: Iscle <[REDACTED_EMAIL]>

**File**: `FineTune/Audio/Loudness/LoudnessEqualizerSettings.swift` (modified, +8/-8)
```diff
@@ -1,22 +1,22 @@
 nonisolated struct LoudnessEqualizerSettings: Codable, Equatable, Sendable {
     var targetLoudnessDb: Float = -12
-    var maxBoostDb: Float = 15
+    var maxBoostDb: Float = 6
     var maxCutDb: Float = 4
     var compressionThresholdOffsetDb: Float = 6
     var compressionRatio: Float = 1.6
     var compressionKneeDb: Float = 8
 
-    var analysisWindowMs: Float = 30
-    var analysisHopMs: Float = 15
+    var analysisWindowMs: Float = 400
+    var analysisHopMs: Float = 100
 
     var detectorAttackMs: Float = 25
-    var detectorReleaseMs: Float = 400
+    var detectorReleaseMs: Float = 600
 
-    var gainAttackMs: Float = 180
-    var gainReleaseMs: Float = 5000
+    var gainAttackMs: Float = 250
+    var gainReleaseMs: Float = 3000
 
-    var noiseFloorThresholdDb: Float = -48
-    var lowLevelMaxBoostDb: Float = 1.5
+    var noiseFloorThresholdDb: Float = -40
+    var lowLevelMaxBoostDb: Float = 0.5
 
     var enabled: Bool = false
 }
```

**File**: `FineTuneTests/LoudnessEqualizerTests.swift` (modified, +8/-8)
```diff
@@ -14,19 +14,19 @@ struct LoudnessEqualizerTests {
     func settingsDefaults() {
         let s = LoudnessEqualizerSettings()
         #expect(s.targetLoudnessDb == -12)
-        #expect(s.maxBoostDb == 15)
+        #expect(s.maxBoostDb == 6)
         #expect(s.maxCutDb == 4)
         #expect(s.compressionThresholdOffsetDb == 6)
         #expect(s.compressionRatio == 1.6)
         #expect(s.compressionKneeDb == 8)
-        #expect(s.analysisWindowMs == 30)
-        #expect(s.analysisHopMs == 15)
+        #expect(s.analysisWindowMs == 400)
+        #expect(s.analysisHopMs == 100)
         #expect(s.detectorAttackMs == 25)
-        #expect(s.detectorReleaseMs == 400)
-        #expect(s.gainAttackMs == 180)
-        #expect(s.gainReleaseMs == 5000)
-        #expect(s.noiseFloorThresholdDb == -48)
-        #expect(s.lowLevelMaxBoostDb == 1.5)
+        #expect(s.detectorReleaseMs == 600)
+        #expect(s.gainAttackMs == 250)
+        #expect(s.gainReleaseMs == 3000)
+        #expect(s.noiseFloorThresholdDb == -40)
+        #expect(s.lowLevelMaxBoostDb == 0.5)
         #expect(s.enabled == false)
     }
 
```

**File**: `FineTuneTests/ProcessingPipelineTests.swift` (modified, +2/-2)
```diff
@@ -1050,7 +1050,7 @@ struct LoudnessIntegrationTests {
 
     @Test("Loudness equalizer modifies output vs nil-processor baseline when enabled")
     func loudnessEqualizerModifiesOutput() {
-        let frames = 4096
+        let frames = 48000  // 1 s: the momentary leveler (400 ms window, 100 ms hop) needs > one hop to produce a gain change
         let sampleRate: Float = 48000
 
         // Create stereo input with moderate amplitude
@@ -1100,7 +1100,7 @@ struct LoudnessIntegrationTests {
 
     @Test("Loudness chain ordering: compensator shapes frequency, equalizer adjusts level")
     func loudnessChainOrdering() {
-        let frames = 4096
+        let frames = 48000  // 1 s: the momentary leveler (400 ms window, 100 ms hop) needs > one hop to produce a gain change
         let sampleRate = 48000.0
 
         // Create a low-frequency stereo signal that compensator will boost
```

---

### Incident Patch 10: `993a2fce` (2026-06-05)
**Commit Message**: docs(zh): translate guide/autoeq.md to Simplified Chinese (#298)

- New: guide/autoeq.zh-CN.md, hand translation mirroring section order, headings, code blocks, tables, and links exactly. Brand names (AutoEQ, FineTune, EqualizerAPO, MiniDSP EARS, Sony, Sennheiser, etc.), UI labels ('Import ParametricEQ.txt...', 'Correction', 'No correction'), filter codes (PK / LS / HSC ...), and the example block are kept verbatim. Top-of-file community-maintained banner matches the README's wording.
- guide/autoeq.md: add 'English · 简体中文' switcher line under the title, matching the README convention.
- README.zh-CN.md: point the AutoEQ documentation link at the new zh-CN guide.

**File**: `README.zh-CN.md` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ brew install --cask finetune
 
 ## 文档
 
-- **[AutoEQ 与耳机校正](guide/autoeq.md)** —— 应用来自 [AutoEQ](https://github.com/jaakkopasanen/AutoEq) 项目的频响校正、导入 [EqualizerAPO](https://sourceforge.net/projects/equalizerapo/) 配置，或浏览 [autoeq.app](https://www.autoeq.app/)
+- **[AutoEQ 与耳机校正](guide/autoeq.zh-CN.md)** —— 应用来自 [AutoEQ](https://github.com/jaakkopasanen/AutoEq) 项目的频响校正、导入 [EqualizerAPO](https://sourceforge.net/projects/equalizerapo/) 配置，或浏览 [autoeq.app](https://www.autoeq.app/)
 - **[URL Scheme](guide/url-schemes.md)** —— 通过终端、[快捷指令](https://support.apple.com/guide/shortcuts-mac)、[Raycast](https://raycast.com) 或脚本自动化 FineTune
 - **[排查指引](guide/troubleshooting.md)** —— 权限问题、应用未出现、声音异常等
 
```

**File**: `guide/autoeq.md` (modified, +2/-0)
```diff
@@ -1,5 +1,7 @@
 # AutoEQ & Headphone Correction
 
+**English** · [简体中文](autoeq.zh-CN.md)
+
 FineTune can apply headphone-specific frequency response corrections using profiles from the [AutoEQ](https://github.com/jaakkopasanen/AutoEq) project. This compensates for your headphones' natural frequency curve, giving you a flatter, more accurate sound.
 
 ## How It Works
```

**File**: `guide/autoeq.zh-CN.md` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+# AutoEQ 与耳机校正
+
+[English](autoeq.md) · **简体中文**
+
+> 本翻译由社区维护，更新可能晚于英文版。最新内容请以 [English version](autoeq.md) 为准。
+> *This translation is community-maintained and may lag the English version. See the [English version](autoeq.md) for the most current information.*
+
+FineTune 可以使用来自 [AutoEQ](https://github.com/jaakkopasanen/AutoEq) 项目的耳机专属频响校正配置。它会针对你耳机本身的频率曲线做补偿，让声音更平直、更准确。
+
+## 工作原理
+
+每副耳机对声音的染色都不一样：有的低频偏多，有的高频刺耳。AutoEQ 测量出这些偏离，并生成对应的修正 EQ 滤波器。FineTune 会按设备分别应用这些滤波器，所以每副耳机都拥有自己独立的校正配置。
+
+校正会叠加在 FineTune 的 10 段 EQ 之上，因此应用一份配置之后，你仍然可以按个人口味继续微调。
+
+## 浏览内置配置
+
+1. 点击 FineTune 中任一耳机设备旁的 **魔棒图标**
+2. 按型号搜索你的耳机
+3. 选中一个配置，立即生效
+
+配置会按需从 AutoEQ 数据库拉取，并在本地缓存以便离线使用。数据库覆盖了主流厂商上千款耳机（Sony、Sennheiser、Apple、Bose、Audio-Technica、Beyerdynamic 等）。
+
+> **小贴士：** 如果你的具体型号没出现在列表里，可以试着搜索同一产品线 —— 相近型号的频响特性往往相近。
+
+## 导入自定义配置
+
+如果你有自己的测量结果，或者想用其他来源的配置：
+
+1. 点击 AutoEQ 面板底部的 **"Import ParametricEQ.txt..."**
+2. 选择你的 `.txt` 文件
+3. 配置会被导入并应用到当前选中的设备
+4. 使用选择器中的 **Correction** 开关，可以在不删除配置的前提下做 A/B 对比
+
+FineTune 接受 [EqualizerAPO](https://sourceforge.net/projects/equalizerapo/) 的 ParametricEQ.txt 文件：
+
+```
+Preamp: -6.2 dB
+Filter 1: ON PK Fc 100 Hz Gain -2.3 dB Q 1.41
+Filter 2: ON LSC Fc 105 Hz Gain 7.0 dB Q 0.71
+Filter 3: ON HSC Fc 8000 Hz Gain 2.1 dB Q 0.71
+```
+
+### 支持的滤波器类型
+
+| 代码 | 类型 | 说明 |
+|------|------|-------------|
+| `PK` / `PEQ` | Peaking | 在某段窄频带上提升或衰减 |
+| `LS` / `LSC` | Low shelf | 提升或衰减某频率以下的所有内容 |
+| `HS` / `HSC` | High shelf | 提升或衰减某频率以上的所有内容 |
+
+每份配置最多 10 个滤波器。`Preamp` 行设定一个全局增益偏移，用于避免削波。
+
+## 在哪里获取配置
+
+- **内置搜索** —— 最方便的方式。FineTune 直接内置了上千款耳机
+- **[autoeq.app](https://www.autoeq.app/)** —— 网页版工具，选项更丰富。把 equalizer app 选成 **EqualizerAPO ParametricEq**，下载文件后导入 FineTune 即可
+- **[AutoEQ GitHub](https://github.com/jaakkopasanen/AutoEq)** —— 完整的测量数据与生成配置仓库
+- **自行测量** —— 如果你自己测量了耳机（例如用 MiniDSP EARS 之类的设备），可以按上面的格式在任意文本编辑器里手写一个 ParametricEQ.txt 文件
+
+## 管理配置
+
+- 每台设备都会独立记住自己绑定的配置
+- 要临时旁路一个配置，点击魔棒图标并把 **Correction** 关掉
+- 要彻底移除一个配置，点击魔棒图标并选择 **No correction**
+- 用星标图标把常用的配置加入收藏，方便快速访问 —— 收藏过的配置会出现在搜索结果顶部，搜索框为空时也会一并显示
```

---

### Incident Patch 11: `6a6c1737` (2026-06-05)
**Commit Message**: fix(menu-bar): let Return commit a focused text field instead of activating a row

.onKeyPress on the popup root also fires while a descendant TextField is
editing, so Return was swallowed before onSubmit could run.

**File**: `FineTune/Views/MenuBarPopupView.swift` (modified, +2/-0)
```diff
@@ -1185,6 +1185,8 @@ struct MenuBarPopupView: View {
     }
 
     private func handleKeyPress(_ keyPress: KeyPress) -> KeyPress.Result {
+        // `.onKeyPress` also fires for focused descendants; yield while a TextField is editing so its Return commits via onSubmit instead of activating a row.
+        if NSApp.keyWindow?.firstResponder is NSTextView { return .ignored }
         let mods = keyPress.modifiers
         let isM = keyPress.key == KeyEquivalent("m")
         let isRecognized: Bool = {
```

---

### Incident Patch 12: `638175df` (2026-06-03)
**Commit Message**: fix(audio): stop Bluetooth call-mode crackling on A2DP↔SCO switches

Sub-tap drift compensation made the HAL insert/delete a sample on the ~50ppm
BT-vs-crystal offset every ~0.7s during calls; disable it for Bluetooth and
virtual outputs. A running aggregate's IOProc can't be re-rated in place, so on
a BT A2DP↔SCO nominal-rate change recreate each affected tap's aggregate at the
new rate (force-silenced first, then ramped — a brief clean dip, no crackle).

Original report and approach by @olujicz (#324).

**File**: `FineTune/Audio/Engine/AudioEngine.swift` (modified, +22/-0)
```diff
@@ -362,6 +362,11 @@ final class AudioEngine {
             realMonitor.inputPriorityOrder = { [weak self] in
                 self?.settingsManager.inputDevicePriorityOrder ?? []
             }
+            realMonitor.onBTDeviceSampleRateChanged = { [weak self] uid, newRate in
+                Task { @MainActor [weak self] in
+                    await self?.handleBTDeviceSampleRateChanged(uid: uid, newRate: newRate)
+                }
+            }
         }
 
         deviceMonitor.onDeviceDisconnected = { [weak self] deviceUID, deviceName in
@@ -1975,6 +1980,23 @@ final class AudioEngine {
         }
     }
 
+    /// Recreates the aggregate at the device's new rate for every tap on a BT output that changed
+    /// sample rate (A2DP↔SCO), so each tap's IOProc re-rates to match. Falls back to a full tap
+    /// recreate if the in-controller recreation throws.
+    private func handleBTDeviceSampleRateChanged(uid: String, newRate: Double) async {
+        logger.info("[RATE] BT output \(uid, privacy: .public) → \(newRate, format: .fixed(precision: 0)) Hz — recreating affected taps (clean dip)")
+        let affected = taps.filter { $0.value.currentDeviceUIDs.contains(uid) }
+        for (pid, tap) in affected {
+            do {
+                logger.info("[RATE] Recreating tap for PID \(pid)")
+                try await tap.recreateForOutputRateChange()
+            } catch {
+                logger.error("[RATE] Recreate failed for PID \(pid): \(error.localizedDescription) — falling back to full recreate")
+                await recreateTap(for: pid)
+            }
+        }
+    }
+
     // MARK: - Input Device Lock
 
     /// Handles changes to the default input device.
```

**File**: `FineTune/Audio/Engine/ProcessTapController.swift` (modified, +29/-1)
```diff
@@ -308,6 +308,14 @@ final class ProcessTapController: ProcessTapControlling {
 
         let clockDeviceUID = outputUIDs[0]  // Primary = clock source
 
+        // Sub-tap drift comp must be OFF when the tap source and output share a clock domain:
+        // Bluetooth (tap and output both follow the BT clock — enabling it makes the HAL insert/
+        // delete a sample on the ~50ppm BT-vs-crystal offset every ~0.7s, the rhythmic call crackle)
+        // and virtual sources (burst delivery looks like drift). ON for wired/USB where the crystal
+        // domains genuinely differ. Defaults OFF on an unresolvable device (less wrong on unknown BT).
+        let isPrimaryBTOutput = audioDeviceID(for: outputUIDs[0])?.isBluetoothDevice() ?? true
+        let tapDriftCompensation = !isTapSourceVirtual() && !isPrimaryBTOutput
+
         return [
             kAudioAggregateDeviceNameKey: name,
             kAudioAggregateDeviceUIDKey: UUID().uuidString,
@@ -319,13 +327,33 @@ final class ProcessTapController: ProcessTapControlling {
             kAudioAggregateDeviceSubDeviceListKey: subDevices,
             kAudioAggregateDeviceTapListKey: [
                 [
-                    kAudioSubTapDriftCompensationKey: true,
+                    kAudioSubTapDriftCompensationKey: tapDriftCompensation,
                     kAudioSubTapUIDKey: tapUUID.uuidString
                 ]
             ]
         ]
     }
 
+    private func isTapSourceVirtual() -> Bool {
+        guard let uid = preferredTapSourceDeviceUID,
+              let deviceID = audioDeviceID(for: uid) else { return false }
+        return deviceID.isVirtualDevice()
+    }
+
+    /// Recreates the aggregate at the device's new rate on a Bluetooth A2DP↔SCO change. Recreation is
+    /// the only reliable way to re-rate the IOProc — in-place nominal-rate or buffer-size writes
+    /// silence a running aggregate's IOProc, which can't be reconfigured live. Routed through the
+    /// destructive switch with `sourceAlreadySilent: true` so the old aggregate is force-silenced
+    /// first (cutting the rate-mismatched garbage) before the rebuild, then volume ramps back up — a
+    /// brief clean dip rather than a crackle. The switch can't be fully gapless: the BT link itself
+    /// renegotiates across the profile change.
+    func recreateForOutputRateChange() async throws {
+        guard activated, let primaryUID = currentDeviceUIDs.first else { return }
+        guard primaryResources.tapDescription != nil else { throw CrossfadeError.noTapDescription }
+        logger.info("[RATE] \(self.app.name): recreating aggregate at new rate")
+        try await performDestructiveDeviceSwitch(to: primaryUID, allDeviceUIDs: currentDeviceUIDs, sourceAlreadySilent: true)
+    }
+
     private func preferredStereoChannels(for deviceUID: String?) -> (left: Int, right: Int) {
         guard let deviceUID, let deviceID = audioDeviceID(for: deviceUID) else {
             return (0, 1)
```

**File**: `FineTune/Audio/Engine/ProcessTapControlling.swift` (modified, +5/-0)
```diff
@@ -31,6 +31,7 @@ protocol ProcessTapControlling: AnyObject, Sendable {
 
     var tapSourceDeviceUID: String? { get }
     func refreshTapSource(_ preferredDeviceUID: String?) async throws
+    func recreateForOutputRateChange() async throws
 }
 
 extension ProcessTapControlling {
@@ -58,4 +59,8 @@ extension ProcessTapControlling {
     func refreshTapSource(_ preferredDeviceUID: String?) async throws {
         // Default no-op for mocks that don't override
     }
+
+    func recreateForOutputRateChange() async throws {
+        // Default no-op for mocks that don't override
+    }
 }
```

**File**: `FineTune/Audio/Extensions/AudioDeviceID+Classification.swift` (modified, +5/-0)
```diff
@@ -22,6 +22,11 @@ nonisolated extension AudioDeviceID {
         readTransportType() == .virtual
     }
 
+    func isBluetoothDevice() -> Bool {
+        let t = readTransportType()
+        return t == .bluetooth || t == .bluetoothLE
+    }
+
     func isHidden() -> Bool {
         (try? readBool(kAudioDevicePropertyIsHidden)) ?? false
     }
```

**File**: `FineTune/Audio/Monitors/AudioDeviceMonitor.swift` (modified, +104/-0)
```diff
@@ -59,11 +59,29 @@ final class AudioDeviceMonitor: AudioDeviceProviding {
     /// Listeners for kAudioDevicePropertyDataSource changes on built-in devices (headphone jack detection)
     @ObservationIgnored private var dataSourceListeners: [AudioDeviceID: AudioObjectPropertyListenerBlock] = [:]
 
+    /// Called when a BT output device crosses the A2DP ↔ SCO/HFP sample-rate boundary (44.1 kHz).
+    /// Off-protocol (on the concrete monitor) — wired via the `as? AudioDeviceMonitor` cast, like the
+    /// priority-order closures; no-ops under a non-AudioDeviceMonitor provider.
+    var onBTDeviceSampleRateChanged: ((_ uid: String, _ newRate: Double) -> Void)?
+
+    /// Listeners for kAudioDevicePropertyNominalSampleRate changes on BT output devices (A2DP↔SCO).
+    @ObservationIgnored private var sampleRateListeners: [AudioDeviceID: AudioObjectPropertyListenerBlock] = [:]
+    @ObservationIgnored private var lastKnownSampleRates: [AudioDeviceID: Double] = [:]
+    @ObservationIgnored private var sampleRateDebounce: [AudioDeviceID: Task<Void, Never>] = [:]
+
     /// Debounces rapid HAL device-list notifications (e.g. Bluetooth connect fires 2-3 in ~20ms).
     /// Querying device properties during the burst produces HALC_ShellObject errors because
     /// HAL proxy objects are mid-transition. 50ms lets the HAL stabilize before we enumerate.
     private var deviceListDebounceTask: Task<Void, Never>?
 
+    /// True when the BT output's nominal rate changed to a different valid rate, so each affected
+    /// tap's aggregate must be recreated to match. Pure, for testability. `newRate <= 0` is a transient/failed read
+    /// (never act, and the caller must not store it as the baseline or the next real read looks like
+    /// no change). Fires on ANY change (A2DP↔SCO and within-band) — the aggregate must always match.
+    nonisolated static func isMeaningfulRateChange(oldRate: Double, newRate: Double) -> Bool {
+        newRate > 0 && newRate != oldRate
+    }
+
     func start() {
         guard deviceListListenerBlock == nil else { return }
 
@@ -100,6 +118,7 @@ final class AudioDeviceMonitor: AudioDeviceProviding {
             deviceListListenerBlock = nil
         }
         removeAllDataSourceListeners()
+        removeAllSampleRateListeners()
     }
 
     /// O(1) lookup by device UID (output devices)
@@ -199,6 +218,8 @@ final class AudioDeviceMonitor: AudioDeviceProviding {
             inputDevicesByID = Dictionary(uniqueKeysWithValues: inputDevices.map { ($0.id, $0) })
 
             syncDataSourceListeners(outputDeviceIDs: outputDeviceList.map(\.id))
+            let btOutputIDs = Set(outputDeviceList.filter { $0.id.isBluetoothDevice() }.map(\.id))
+            syncSampleRateListeners(btOutputDeviceIDs: btOutputIDs)
 
         } catch {
             logger.error("Failed to refresh device list: \(error.localizedDescription)")
@@ -257,6 +278,89 @@ final class AudioDeviceMonitor: AudioDeviceProviding {
         }
     }
 
+    // MARK: - Bluetooth Sample-Rate Listeners (A2DP ↔ SCO/HFP)
+
+    /// Installs/removes kAudioDevicePropertyNominalSampleRate listeners on BT output devices so
+    /// A2DP ↔ SCO/HFP mode switches (which keep the same AudioObjectID, only changing the nominal
+    /// rate) trigger tap re-evaluation.
+    private func syncSampleRateListeners(btOutputDeviceIDs: Set<AudioDeviceID>) {
+        let currentIDs = Set(sampleRateListeners.keys)
+
+        for deviceID in currentIDs.subtracting(btOutputDeviceIDs) {
+            removeSampleRateListener(for: deviceID)
+        }
+
+        for deviceID in btOutputDeviceIDs.subtracting(currentIDs) {
+            guard let uid = devicesByID[deviceID]?.uid else { continue }
+            var address = AudioObjectPropertyAddress(
+                mSelector: kAudioDevicePropertyNominalSampleRate,
+                mScope: kAudioObjectPropertyScopeGlobal,
+                mElement: kAudioObjectPropertyElementMain
+            )
+            let block: AudioObjectPropertyListenerBlock = { [weak self] _, _ in
+                Task { @MainActor [weak self] in
+                    self?.scheduleSampleRateCheck(forDeviceID: deviceID, uid: uid)
+                }
+            }
+            let status = AudioObjectAddPropertyListenerBlock(deviceID, &address, .main, block)
+            if status == noErr {
+                sampleRateListeners[deviceID] = block
+                lastKnownSampleRates[deviceID] = (try? deviceID.readNominalSampleRate()) ?? 0
+            } else {
+                logger.warning("Failed to add sample rate listener for BT device \(deviceID): \(status)")
+            }
+        }
+    }
+
+    /// 150 ms debounce — the HAL fires several nominal-rate notifications while SCO settles.
+    private func scheduleSampleRateCheck(forDeviceID deviceID: AudioDeviceID, uid: String) {
+        sampleRateDebounce[deviceID]?.cancel()
+        sampleRateDebounce[deviceID] = Task { @MainActor [weak self] in
+            try? await Task
```

**File**: `FineTuneTests/BTCallModeTransitionTests.swift` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+import Testing
+@testable import FineTune
+
+/// Coverage for the pure decision behind recreating a tap's aggregate on a Bluetooth output's
+/// nominal-rate change (A2DP ↔ SCO/HFP). This helper decides when the rate-change listener fires.
+@Suite("BT rate-change detection")
+struct BTCallModeTransitionTests {
+
+    @Test("Fires on any change to a different valid rate")
+    func firesOnChange() {
+        #expect(AudioDeviceMonitor.isMeaningfulRateChange(oldRate: 48_000, newRate: 24_000)) // join call
+        #expect(AudioDeviceMonitor.isMeaningfulRateChange(oldRate: 24_000, newRate: 48_000)) // leave call
+        #expect(AudioDeviceMonitor.isMeaningfulRateChange(oldRate: 44_100, newRate: 48_000)) // within A2DP
+        #expect(AudioDeviceMonitor.isMeaningfulRateChange(oldRate: 24_000, newRate: 16_000)) // within call mode
+        #expect(AudioDeviceMonitor.isMeaningfulRateChange(oldRate: 0, newRate: 48_000))      // first valid read
+    }
+
+    @Test("Does not fire when the rate is unchanged")
+    func noFireOnSameRate() {
+        #expect(!AudioDeviceMonitor.isMeaningfulRateChange(oldRate: 48_000, newRate: 48_000))
+        #expect(!AudioDeviceMonitor.isMeaningfulRateChange(oldRate: 24_000, newRate: 24_000))
+    }
+
+    /// Regression (M2): a transient/failed read arrives as `newRate <= 0`. It must never fire, and
+    /// the caller must not store it as the baseline — otherwise the next real read looks like
+    /// "no change" (oldRate == newRate after a clobber) and the A2DP↔SCO retune is missed,
+    /// re-introducing the crackle.
+    @Test("Transient/failed read (rate 0) never fires")
+    func transientZeroNeverFires() {
+        #expect(!AudioDeviceMonitor.isMeaningfulRateChange(oldRate: 48_000, newRate: 0))
+        #expect(!AudioDeviceMonitor.isMeaningfulRateChange(oldRate: 24_000, newRate: 0))
+        #expect(!AudioDeviceMonitor.isMeaningfulRateChange(oldRate: 0, newRate: 0))
+    }
+}
```

---

### Incident Patch 13: `cc21d442` (2026-06-01)
**Commit Message**: fix(device-volume): stop software tier freezing in the bottom 10%

The <0.01 store floor plus the x² slider curve trapped the bottom 10%: the step path re-derives the slider from the floored-to-0 gain, so Volume-Up never escaped it. Silence still comes from the auto-mute path.

**File**: `FineTune/Audio/Monitors/DeviceVolumeMonitor.swift` (modified, +18/-6)
```diff
@@ -342,22 +342,34 @@ final class DeviceVolumeMonitor: DeviceVolumeProviding {
         defaultInputDeviceUID = nil
     }
 
-    /// Threshold clamp: sub-1% scalar → true silence.
-    /// On audio-tapered devices, scalar 0.01 ≈ -99 dB (empirically measured on built-in output).
-    /// On software-volume devices, 0.01 gain = -40 dB (linear). Either way, inaudible.
+    /// Sub-1% floor for hardware/DDC scalar readbacks → true silence (scalar 0.01 ≈ -99 dB,
+    /// empirically measured on built-in output). Software writes use `storedVolume` instead.
     private func clampedVolume(_ volume: Float) -> Float {
         volume < 0.01 ? 0 : volume
     }
 
+    /// Software gain rides the x² curve (`VolumeMapping`), so sub-1% is the bottom ~10%
+    /// of slider travel; flooring it would trap that range, since the step path re-derives
+    /// the slider from the stored gain. Hardware/DDC scalars are ~linear — safe to floor.
+    nonisolated static func storedVolume(_ volume: Float, tier: VolumeControlTier) -> Float {
+        switch tier {
+        case .software:
+            return volume
+        case .hardware, .ddc:
+            return volume < 0.01 ? 0 : volume
+        }
+    }
+
     /// Sets the volume for a specific device
     func setVolume(for deviceID: AudioDeviceID, to volume: Float) {
         guard deviceID.isValid else {
             logger.warning("Cannot set volume: invalid device ID")
             return
         }
 
-        let clamped = clampedVolume(volume)
-        switch outputVolumeBackend(for: deviceID) {
+        let backend = outputVolumeBackend(for: deviceID)
+        let clamped = Self.storedVolume(volume, tier: backend)
+        switch backend {
         case .hardware:
             let success = deviceID.setOutputVolumeScalar(clamped)
             if success {
@@ -953,7 +965,7 @@ final class DeviceVolumeMonitor: DeviceVolumeProviding {
             let muted = settingsManager.getSoftwareDeviceMuteState(for: device.uid)
             let defaultVolume: Float = muted ? 0 : 1.0
             let visibleVolume = settingsManager.getSoftwareDeviceVolume(for: device.uid) ?? defaultVolume
-            volumes[deviceID] = clampedVolume(visibleVolume)
+            volumes[deviceID] = Self.storedVolume(visibleVolume, tier: backend)
             muteStates[deviceID] = muted
             return
         }
```

**File**: `FineTuneTests/DeviceVolumeTierTests.swift` (modified, +43/-0)
```diff
@@ -419,3 +419,46 @@ struct SettingsManagerDeviceVolumeTierOverrideRoundTrip {
     }
 }
 
+// MARK: - storedVolume tier-aware silence floor (issue #295)
+
+@Suite("DeviceVolumeMonitor.storedVolume — tier-aware silence floor")
+struct DeviceVolumeStoredVolumeTests {
+    @Test("Hardware/DDC floor sub-1% scalar to true silence")
+    func hardwareDdcFloorBelowOnePercent() {
+        #expect(DeviceVolumeMonitor.storedVolume(0.005, tier: .hardware) == 0)
+        #expect(DeviceVolumeMonitor.storedVolume(0.009, tier: .ddc) == 0)
+        #expect(DeviceVolumeMonitor.storedVolume(0.0039, tier: .hardware) == 0)
+    }
+
+    @Test("Hardware/DDC keep values at or above the 1% floor")
+    func hardwareDdcKeepAboveFloor() {
+        #expect(DeviceVolumeMonitor.storedVolume(0.01, tier: .hardware) == 0.01)
+        #expect(DeviceVolumeMonitor.storedVolume(0.5, tier: .ddc) == 0.5)
+    }
+
+    @Test("Software tier is never floored — preserves sub-1% gain (issue #295)")
+    func softwareNeverFloored() {
+        #expect(DeviceVolumeMonitor.storedVolume(0.0039, tier: .software) == 0.0039)
+        #expect(DeviceVolumeMonitor.storedVolume(0.0001, tier: .software) == 0.0001)
+        #expect(DeviceVolumeMonitor.storedVolume(0.5, tier: .software) == 0.5)
+        #expect(DeviceVolumeMonitor.storedVolume(0.0, tier: .software) == 0.0)
+    }
+
+    /// Issue #295: pre-fix the < 0.01 floor zeroed software gain, so each step re-derived
+    /// a 0 slider and froze. Mirrors `handleCore`'s slider-space step + `storedVolume`.
+    @Test("Software volume steps up out of silence instead of freezing at 0",
+          arguments: [VolumeHotkeyStep.coarse, .normal, .fine, .extraFine])
+    func softwareStepRecoversFromZero(step: VolumeHotkeyStep) {
+        let tier = VolumeControlTier.software
+        let delta = step.sliderDelta
+        var stored: Float = 0
+
+        let currentSlider = VolumeMapping.sliderFraction(forSystemGain: stored, tier: tier)
+        let nextSlider = min(1.0, currentSlider + delta)
+        let newVolume = VolumeMapping.systemGain(forSliderFraction: nextSlider, tier: tier)
+        stored = DeviceVolumeMonitor.storedVolume(newVolume, tier: tier)
+
+        #expect(stored > 0, "\(step) software step-up stuck at silence — issue #295 regression")
+    }
+}
+
```

---

### Incident Patch 14: `5943154b` (2026-05-31)
**Commit Message**: refactor(settings): move UI enums out of SettingsManager into Settings/Types

Separates view-shaped types (MenuBarIconStyle, HUDStyle, AppearancePreference, MenuBarPopupSize, PopupDimensions, VolumeHotkeyStep) from the persistence owner; JSON wire format unchanged. (F-ARCH-003)

**File**: `FineTune/Settings/SettingsManager.swift` (modified, +0/-153)
```diff
@@ -20,159 +20,6 @@ struct IgnoredAppInfo: Codable, Equatable {
     let bundleID: String?
 }
 
-// MARK: - App-Wide Settings Enums
-
-enum MenuBarIconStyle: String, Codable, CaseIterable, Identifiable {
-    case `default` = "Default"
-    case speaker = "Speaker"
-    case waveform = "Waveform"
-    case equalizer = "Equalizer"
-
-    var id: String { rawValue }
-
-    /// The icon name - either asset catalog name or SF Symbol
-    var iconName: String {
-        switch self {
-        case .default: return "MenuBarIcon"
-        case .speaker: return "speaker.wave.2.fill"
-        case .waveform: return "waveform"
-        case .equalizer: return "slider.vertical.3"
-        }
-    }
-
-    /// Whether this uses an SF Symbol (vs asset catalog image)
-    var isSystemSymbol: Bool {
-        self != .default
-    }
-}
-
-// MARK: - HUD Style
-
-/// Style of the on-screen HUD shown when media keys drive FineTune's volume.
-/// `.tahoe` renders a small top-right pill; `.classic` renders a center-bottom panel
-/// with 16 segment tiles matching Apple's pre-Tahoe HUD aesthetic.
-enum HUDStyle: String, Codable, CaseIterable, Identifiable {
-    case tahoe
-    case classic
-
-    var id: String { rawValue }
-}
-
-// MARK: - Appearance Preference
-
-/// User preference for app appearance. `.system` follows macOS appearance live;
-/// `.light` and `.dark` lock the override regardless of system setting.
-enum AppearancePreference: String, Codable, CaseIterable, Identifiable, CustomStringConvertible {
-    case system
-    case light
-    case dark
-
-    var id: String { rawValue }
-
-    var description: String {
-        switch self {
-        case .system: return "System"
-        case .light: return "Light"
-        case .dark: return "Dark"
-        }
-    }
-}
-
-extension AppearancePreference {
-    /// AppKit appearance override. `nil` means "inherit from window or app".
-    /// Apply via `nsView.window?.appearance = value` for any `NSWindow`/`NSPanel`
-    /// the app hosts (popup, popover, HUD).
-    /// `.aqua` available since macOS 10.9; `.darkAqua` since 10.14.
-    var nsAppearance: NSAppearance? {
-        switch self {
-        case .system: return nil
-        case .light: return NSAppearance(named: .aqua)
-        case .dark: return NSAppearance(named: .darkAqua)
-        }
-    }
-}
-
-// MARK: - Menu Bar Popup Size
-
-enum MenuBarPopupSize: String, Codable, CaseIterable, Identifiable, CustomStringConvertible {
-    case compact
-    case comfortable
-    case spacious
-
-    var id: String { rawValue }
-
-    var description: String {
-        switch self {
-        case .compact: return "Compact"
-        case .comfortable: return "Comfortable"
-        case .spacious: return "Spacious"
-        }
-    }
-}
-
-struct PopupDimensions: Equatable {
-    let width: CGFloat
-    let contentPadding: CGFloat
-    /// Ceiling on the scrollable body. Sized to stay within a 13" MacBook Air's
-    /// usable height after the menu bar, since FluidMenuBarExtra does not clamp
-    /// the popup against `screen.visibleFrame` vertically.
-    let maxContentHeight: CGFloat
-}
-
-extension MenuBarPopupSize {
-    var dimensions: PopupDimensions {
-        switch self {
-        case .compact:
-            return PopupDimensions(
-                width: 470,
-                contentPadding: 12,
-                maxContentHeight: 560
-            )
-        case .comfortable:
-            return PopupDimensions(
-                width: 510,
-                contentPadding: 16,
-                maxContentHeight: 660
-            )
-        case .spacious:
-            return PopupDimensions(
-                width: 560,
-                contentPadding: 20,
-                maxContentHeight: 760
-            )
-        }
-    }
-}
-
-// MARK: - Volume Hotkey Step Size
-
-enum VolumeHotkeyStep: String, Codable, CaseIterable, Identifiable, CustomStringConvertible {
-    case coarse
-    case normal
-    case fine
-    case extraFine
-
-    var id: String { rawValue }
-
-    var sliderDelta: Double {
-        switch self {
-        case .coarse:    return 1.0 / 8.0
-        case .normal:    return 1.0 / 16.0
-        case .fine:      return 1.0 / 32.0
-        case .extraFine: return 1.0 / 64.0
-        }
-    }
-
-    var description: String {
-        switch self {
-        case .coarse:    return "Coarse (12.5%)"
-        case .normal:    return "Normal (6.25%)"
-        case .fine:      return "Fine (3.13%)"
-        case .extraFine: return "Extra-Fine (1.56%)"
-        }
-    }
-}
-
 // MARK: - App-Wide Settings Model
 
 nonisolated struct AppSettings: Codable, Equatable {
```

**File**: `FineTune/Settings/Types/SettingsUITypes.swift` (added, +156/-0)
```diff
@@ -0,0 +1,156 @@
+// FineTune/Settings/Types/SettingsUITypes.swift
+import Foundation
+import AppKit
+
+// MARK: - App-Wide Settings Enums
+
+enum MenuBarIconStyle: String, Codable, CaseIterable, Identifiable {
+    case `default` = "Default"
+    case speaker = "Speaker"
+    case waveform = "Waveform"
+    case equalizer = "Equalizer"
+
+    var id: String { rawValue }
+
+    /// The icon name - either asset catalog name or SF Symbol
+    var iconName: String {
+        switch self {
+        case .default: return "MenuBarIcon"
+        case .speaker: return "speaker.wave.2.fill"
+        case .waveform: return "waveform"
+        case .equalizer: return "slider.vertical.3"
+        }
+    }
+
+    /// Whether this uses an SF Symbol (vs asset catalog image)
+    var isSystemSymbol: Bool {
+        self != .default
+    }
+}
+
+// MARK: - HUD Style
+
+/// Style of the on-screen HUD shown when media keys drive FineTune's volume.
+/// `.tahoe` renders a small top-right pill; `.classic` renders a center-bottom panel
+/// with 16 segment tiles matching Apple's pre-Tahoe HUD aesthetic.
+enum HUDStyle: String, Codable, CaseIterable, Identifiable {
+    case tahoe
+    case classic
+
+    var id: String { rawValue }
+}
+
+// MARK: - Appearance Preference
+
+/// User preference for app appearance. `.system` follows macOS appearance live;
+/// `.light` and `.dark` lock the override regardless of system setting.
+enum AppearancePreference: String, Codable, CaseIterable, Identifiable, CustomStringConvertible {
+    case system
+    case light
+    case dark
+
+    var id: String { rawValue }
+
+    var description: String {
+        switch self {
+        case .system: return "System"
+        case .light: return "Light"
+        case .dark: return "Dark"
+        }
+    }
+}
+
+extension AppearancePreference {
+    /// AppKit appearance override. `nil` means "inherit from window or app".
+    /// Apply via `nsView.window?.appearance = value` for any `NSWindow`/`NSPanel`
+    /// the app hosts (popup, popover, HUD).
+    /// `.aqua` available since macOS 10.9; `.darkAqua` since 10.14.
+    var nsAppearance: NSAppearance? {
+        switch self {
+        case .system: return nil
+        case .light: return NSAppearance(named: .aqua)
+        case .dark: return NSAppearance(named: .darkAqua)
+        }
+    }
+}
+
+// MARK: - Menu Bar Popup Size
+
+enum MenuBarPopupSize: String, Codable, CaseIterable, Identifiable, CustomStringConvertible {
+    case compact
+    case comfortable
+    case spacious
+
+    var id: String { rawValue }
+
+    var description: String {
+        switch self {
+        case .compact: return "Compact"
+        case .comfortable: return "Comfortable"
+        case .spacious: return "Spacious"
+        }
+    }
+}
+
+struct PopupDimensions: Equatable {
+    let width: CGFloat
+    let contentPadding: CGFloat
+    /// Ceiling on the scrollable body. Sized to stay within a 13" MacBook Air's
+    /// usable height after the menu bar, since FluidMenuBarExtra does not clamp
+    /// the popup against `screen.visibleFrame` vertically.
+    let maxContentHeight: CGFloat
+}
+
+extension MenuBarPopupSize {
+    var dimensions: PopupDimensions {
+        switch self {
+        case .compact:
+            return PopupDimensions(
+                width: 470,
+                contentPadding: 12,
+                maxContentHeight: 560
+            )
+        case .comfortable:
+            return PopupDimensions(
+                width: 510,
+                contentPadding: 16,
+                maxContentHeight: 660
+            )
+        case .spacious:
+            return PopupDimensions(
+                width: 560,
+                contentPadding: 20,
+                maxContentHeight: 760
+            )
+        }
+    }
+}
+
+// MARK: - Volume Hotkey Step Size
+
+enum VolumeHotkeyStep: String, Codable, CaseIterable, Identifiable, CustomStringConvertible {
+    case coarse
+    case normal
+    case fine
+    case extraFine
+
+    var id: String { rawValue }
+
+    var sliderDelta: Double {
+        switch self {
+        case .coarse:    return 1.0 / 8.0
+        case .normal:    return 1.0 / 16.0
+        case .fine:      return 1.0 / 32.0
+        case .extraFine: return 1.0 / 64.0
+        }
+    }
+
+    var description: String {
+        switch self {
+        case .coarse:    return "Coarse (12.5%)"
+        case .normal:    return "Normal (6.25%)"
+        case .fine:      return "Fine (3.13%)"
+        case .extraFine: return "Extra-Fine (1.56%)"
+        }
+    }
+}
```

---

### Incident Patch 15: `ca89e0cb` (2026-05-31)
**Commit Message**: refactor(engine): require AudioEngine's collaborators instead of nil-defaulting

The settingsManager nil-default silently built a second manager writing the same on-disk file; tests now inject their temp-dir manager. Also drops a permission optional-chain that skipped activation. (F-ARCH-005)

**File**: `FineTune/Audio/Engine/AudioEngine.swift` (modified, +7/-7)
```diff
@@ -171,20 +171,20 @@ final class AudioEngine {
 
 
     init(
-        permission: AudioRecordingPermission? = nil,
-        settingsManager: SettingsManager? = nil,
-        autoEQProfileManager: AutoEQProfileManager? = nil,
+        permission: AudioRecordingPermission,
+        settingsManager: SettingsManager,
+        autoEQProfileManager: AutoEQProfileManager,
         deviceProvider: (any AudioDeviceProviding)? = nil,
         processMonitor: (any AudioProcessMonitoring)? = nil,
         deviceVolumeMonitor: (any DeviceVolumeProviding)? = nil,
         tapFactory: (@MainActor (AudioApp, [String], String?) throws -> any ProcessTapControlling)? = nil,
         isAlive: ((AudioDeviceID) -> Bool)? = nil,
         startMonitorsAutomatically: Bool = true
     ) {
-        self.permission = permission ?? AudioRecordingPermission()
-        let manager = settingsManager ?? SettingsManager()
+        self.permission = permission
+        let manager = settingsManager
         self.settingsManager = manager
-        self.autoEQProfileManager = autoEQProfileManager ?? AutoEQProfileManager()
+        self.autoEQProfileManager = autoEQProfileManager
         self.volumeState = VolumeState(settingsManager: manager)
         self.isAliveCheck = isAlive ?? { $0.isDeviceAlive() }
 
@@ -288,7 +288,7 @@ final class AudioEngine {
         }
 
         // Start process monitor when permission is granted
-        if startMonitorsAutomatically && permission?.status != .authorized {
+        if startMonitorsAutomatically && permission.status != .authorized {
             observePermissionGranted()
         }
     }
```

**File**: `FineTuneTests/AudioEngineTapInitialStateTests.swift` (modified, +1/-0)
```diff
@@ -175,6 +175,7 @@ private func makeFixture(
     let engine = AudioEngine(
         permission: permission,
         settingsManager: settings,
+        autoEQProfileManager: AutoEQProfileManager(),
         deviceProvider: deviceMonitor,
         processMonitor: processMonitor,
         deviceVolumeMonitor: mockVolume,
```

**File**: `FineTuneTests/AudioEngineToggleMuteTests.swift` (modified, +2/-0)
```diff
@@ -44,7 +44,9 @@ struct AudioEngineToggleMuteTests {
         let deviceMonitor = MockAudioDeviceMonitor()
         let mockVolume = MockDeviceVolumeProviding(deviceMonitor: deviceMonitor)
         let engine = AudioEngine(
+            permission: AudioRecordingPermission(),
             settingsManager: settings,
+            autoEQProfileManager: AutoEQProfileManager(),
             deviceProvider: deviceMonitor,
             deviceVolumeMonitor: mockVolume,
             startMonitorsAutomatically: false
```

**File**: `FineTuneTests/MediaKeyMonitorHandlerTests.swift` (modified, +3/-0)
```diff
@@ -41,6 +41,9 @@ struct MediaKeyMonitorHandlerTests {
         let deviceMonitor = MockAudioDeviceMonitor()
         let mockVolume = MockDeviceVolumeProviding(deviceMonitor: deviceMonitor)
         let engine = AudioEngine(
+            permission: AudioRecordingPermission(),
+            settingsManager: settings,
+            autoEQProfileManager: AutoEQProfileManager(),
             deviceProvider: deviceMonitor,
             deviceVolumeMonitor: mockVolume,
             startMonitorsAutomatically: false
```

**File**: `FineTuneTests/MediaKeyMonitorLifecycleTests.swift` (modified, +3/-0)
```diff
@@ -28,6 +28,9 @@ struct MediaKeyMonitorLifecycleTests {
         let deviceMonitor = MockAudioDeviceMonitor()
         let mockVolume = MockDeviceVolumeProviding(deviceMonitor: deviceMonitor)
         let engine = AudioEngine(
+            permission: AudioRecordingPermission(),
+            settingsManager: settings,
+            autoEQProfileManager: AutoEQProfileManager(),
             deviceProvider: deviceMonitor,
             deviceVolumeMonitor: mockVolume,
             startMonitorsAutomatically: false
```

**File**: `FineTuneTests/MediaKeyTapDisabledTests.swift` (modified, +3/-0)
```diff
@@ -26,6 +26,9 @@ struct MediaKeyTapDisabledTests {
         let deviceMonitor = MockAudioDeviceMonitor()
         let mockVolume = MockDeviceVolumeProviding(deviceMonitor: deviceMonitor)
         let engine = AudioEngine(
+            permission: AudioRecordingPermission(),
+            settingsManager: settings,
+            autoEQProfileManager: AutoEQProfileManager(),
             deviceProvider: deviceMonitor,
             deviceVolumeMonitor: mockVolume,
             startMonitorsAutomatically: false
```

#### Recent Merged Pull Requests:
- **PR #450** (closed): feat(i18n): add Brazilian Portuguese localization (@luizpassaroni)
- **PR #425** (closed): NID-501: Add MenuBarIconStyle.monochrome for minimalist volume-independent icon (@jfcanon)
- **PR #400** (closed): Phase A: third-party Audio Unit layout compatibility (@joshan-kana)
- **PR #366** (closed): Feature/per app smart volume (@djbob2000)
- **PR #365** (closed): Feature/harmonic exciter (@djbob2000)
- **PR #362** (2026-07-07): DDC: send VCP writes twice (@maleadt)
- **PR #361** (2026-07-07): DDC: stop crash on volume change with DDC output (@maleadt)
- **PR #354** (closed): fix(audio): prewarm process taps, apply AutoEQ during crossfade, cut startup CPU, and improve streaming detection (@FelikZ)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
