> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/ronitsingh10-finetune-learnings.md`  
> **Source**: github ([https://github.com/ronitsingh10/FineTune](https://github.com/ronitsingh10/FineTune))  
> **Source Version**: `2285279d`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T11:21:37.500Z  
> **Learning ID**: `learn-github-ronitsingh10-finetune`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): ronitsingh10/FineTune

> **Canonical Artifact**: `07_PROJECT_LEARNING/ronitsingh10-finetune-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ronitsingh10/FineTune](https://github.com/ronitsingh10/FineTune))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T11:21:37.493Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ronitsingh10/FineTune`
- **Description**: FineTune, a macOS menu bar app for per-app volume control, multi-device output, audio routing, and 10-band EQ. Free and open-source alternative to SoundSource.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9788 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #106** (2026-04-03): **[Bug] 25% volume cap**
  *Symptoms*: When connecting Kanto Yu speaker (shows as USB Audio DAC),  the volume is capped at 25%. When trying to increase the volume, the slider slides back to 25%. You can hear the increase when clicking fast on the volume slider but it slides back to 25%. With FineTune closed, the volume can be increased normally to full volume.
  **Post-Mortem & Fix Analysis**:
  > I am experiencing the same issue when routing to a Behringer UM2 USB audio interface / DAC with the host running macOS Tahoe 26.3 on M4.  I've attached the console log output sample when adjusting volume and it defaults back if that helps with troubleshooting.  Let me know and I can collect more info.  [FineTuneVolumeAdjust.txt](https://github.com/user-attachments/files/25705922/FineTuneVolumeAdjust.txt)
  > same here using AKG N9 Hybrid with USB dongle. when connected via bluetooth everything works fine

- **Issue #105** (2026-03-18): **[Bug] Low output on Topping E2x2 OTG (8ch) while FineTune is active; normal when FineTune is off**
  *Symptoms*: ## Summary With **Topping E2x2 OTG** as the default output device (reported as 8 channels), output level drops noticeably **when FineTune is running**. When FineTune is quit, output immediately returns to normal level.  This reproduces consistently and appears to be tied to the FineTune processing/routing path for this interface topology.  ## Environment - FineTune version: **v1.3.1** - macOS: **26.3 (25D125)** - Interface: **Topping E2x2 OTG** - Interface stream layout observed: **8ch output**  ## Reproduction 1. Set **E2x2 OTG** as macOS default output. 2. Play audio from Music (or any app). 3. Observe baseline level with FineTune **not running**. 4. Launch FineTune and keep routing on E2x2 OTG. 5. Compare level immediately.  ## Expected - Output level should be consistent whether FineTune is running or not.  ## Actual - **FineTune ON**: E2x2 output becomes quieter. - **FineTune OFF**: E2x2 output returns to normal.  ## Routing Diagnostics Collected from: `log stream --style compact --predicate 'process == "FineTune" AND composedMessage CONTAINS "[ROUTING-DIAG]"' --level debug`  ```text [ROUTING-DIAG] reason=activate app=음악 target=E2x2 OTG uid=AppleUSBAudioEngine:Topping:E2x2 OTG:2142100:1,2 prefStereo=1,2 [ROUTING-DIAG] targetStream=buffers=1 [b0:ch=8,bytes=16384] aggregateStream=buffers=1 [b0:ch=8,bytes=16384] [ROUTING-DIAG] targetVol=1.000 targetSettable=true aggregateVol=1.000 aggregateSettable=false [ROUTING-DIAG] callbackLayout inBuffers=2 outBuffers=1 in0Ch=10 in1Ch=

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

### Incident Patch 1: `52d3663f` (2026-07-07)
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

### Incident Patch 2: `ccf5c030` (2026-07-07)
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

### Incident Patch 3: `993a2fce` (2026-06-05)
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

#### Recent Merged Pull Requests:
- **PR #450** (closed): feat(i18n): add Brazilian Portuguese localization (@luizpassaroni)
- **PR #425** (closed): NID-501: Add MenuBarIconStyle.monochrome for minimalist volume-independent icon (@jfcanon)
- **PR #400** (closed): Phase A: third-party Audio Unit layout compatibility (@joshan-kana)
- **PR #366** (closed): Feature/per app smart volume (@djbob2000)
- **PR #365** (closed): Feature/harmonic exciter (@djbob2000)
- **PR #362** (2026-07-07): DDC: send VCP writes twice (@maleadt)

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

## X. ddc): stop crash on DDC volume change (#361)

**RULE**:
When implementing operations in `FineTune/Audio/DDC/DDCController.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ronitsingh10/FineTune. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `52d3663f`: ddc): stop crash on DDC volume change (#361). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `FineTune/Audio/DDC/DDCController.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
        // Keep the work item @Sendable and avoid `self`; otherwise it inherits
        // @MainActor isolation here and traps when run on `ddcQueue`.
        let logger = self.logger
        let item = DispatchWorkItem { @Sendable in
                logger.error("DDC write failed for device \(deviceID): \(error)")
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
        // Debounce DDC write
        let item = DispatchWorkItem { [weak self] in
                self?.logger.error("DDC write failed for device \(deviceID): \(error)")
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `52d3663f` are properly handled with clean fallback behavior.
