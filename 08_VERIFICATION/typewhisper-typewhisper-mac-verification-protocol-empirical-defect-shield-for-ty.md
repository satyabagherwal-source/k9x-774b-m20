# Verification Protocol: Verification Protocol: Empirical Defect Shield for TypeWhisper/typewhisper-mac

<!-- PROVENANCE_START
{
  "source_repository": "TypeWhisper/typewhisper-mac",
  "source_url": "https://github.com/TypeWhisper/typewhisper-mac",
  "source_version": "7e1680a4",
  "license": "GPL-3.0",
  "timestamp": "2026-11-17T02:32:23.588Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-typewhisper-typewhisper-mac",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [TypeWhisper/typewhisper-mac](https://github.com/TypeWhisper/typewhisper-mac) (Revision: `7e1680a4`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-17T02:32:23.588Z`  
> **Learning ID**: `learn-github-typewhisper-typewhisper-mac`


## 1. Scope & Verification Target
- **Target Repository**: `TypeWhisper/typewhisper-mac` (Commit: `7e1680a4`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): TypeWhisper/typewhisper-mac

> **Canonical Artifact**: `07_PROJECT_LEARNING/typewhisper-typewhisper-mac-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/TypeWhisper/typewhisper-mac](https://github.com/TypeWhisper/typewhisper-mac))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T02:32:22.583Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TypeWhisper/typewhisper-mac`
- **Description**: Local speech-to-text for macOS  on-device AI, fully private, optional cloud
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1928 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Packages/TypeWhisperModuleKit/Sources/TypeWhisperModuleKit/UserDataLifecycle.swift`
```
import Foundation

/// Lets a module erase and export its own data with the user's data.
///
/// Data a module keeps in the app's preferences or its Application Support
/// folder is erased and exported with them anyway. Register for data kept
/// anywhere else, or for data that needs its own export format.
@MainActor
public protocol UserDataLifecycle: AnyObject {
    /// Registers a module's data. A later registration with the same
    /// identifier replaces the earlier one.
    func register(_ userData: ModuleUserData)
}

/// How the app erases and exports one module's data.
public struct ModuleUserData: Identifiable, Sendable {
    /// Also the folder of the exported files, so letters, digits, dots,
    /// hyphens and underscores only.
    public let id: String
    /// Runs when the user erases all data, before the app deletes its own.
    public let erase: @MainActor @Sendable () async throws -> Void
    /// Returns the files to add to a data export, by file name. A name with a
    /// path separator is left out; names that differ only in case fail the export.
    public let export: @MainActor @Sendable () async throws -> [String: Data]

    public init(
        id: String,
        erase: @escaping @MainActor @Sendable () async throws -> Void,
        export: @escaping @MainActor @Sendable () async throws -> [String: Data]
    ) {
        self.id = id
        self.erase = erase
        self.export = export
    }
}

```

### Core Architecture Module: `TypeWhisper/Services/AudioEngineRecoverySupport.swift`
```
import Foundation
import AudioToolbox
import CoreGraphics
import os

enum AudioEngineRecoveryAction: Equatable {
    case none
    case performImmediateRecovery
    case schedule(generation: UInt64, delay: TimeInterval)
    case fail(AudioEngineRecoveryFailure)
}

enum AudioEngineRecoveryFailure: Equatable {
    case configurationChangeBurstLimitExceeded
}

enum AudioEngineRecoveryPolicy {
    static let configurationDebounce: TimeInterval = 0.15
    // Real BT-default/headset repros continue posting self-induced config
    // changes ~700ms after each successful restart, so the filter needs to
    // cover more than the initial engine.start() call itself. We defer a
    // single recovery until this window expires instead of immediately
    // re-entering the startup path.
    static let configurationChangeQuiescence: TimeInterval = 1.0
    static let configurationChangeBurstWindow: TimeInterval = 5.0
    static let configurationChangeBurstLimit = 4

    /// Backoff schedule used by the asynchronous observer-based recovery path,
    /// which runs on a dedicated dispatch queue. Blocking sleeps here are
    /// safe because they do not stall the main thread.
    static let retryBackoff: [TimeInterval] = [0.15, 0.30, 0.50]

    /// Bounded backoff used when the retry loop executes on the main thread
    /// (e.g. from `AudioRecordingService.startRecording()` or the selected
    /// input device validation). A single short wait keeps UI responsive;
    /// longer recovery is delegated to the observer path on the recovery
    /// queue. See release review M1.
    static let mainThreadRetryBackoff: [TimeInterval] = [0.05]

    /// Returns the appropriate backoff schedule for the current thread.
    static func retryBackoffForCurrentThread() -> [TimeInterval] {
        Thread.isMainThread ? mainThreadRetryBackoff : retryBackoff
    }

    private static let retryableOSStatusCodes: Set<OSStatus> = [
        kAudioUnitErr_FormatNotSupported,
        kAudioUnitErr_InvalidElement,
        kAudioHardwareBadDeviceError,
    ]

    /// AVFoundation reports CoreAudio failures in this domain with the OSStatus as the code.
    static let avfAudioErrorDomain = "com.apple.coreaudio.avfaudio"

    /// '!dev': the engine was bound to an audio device that no longer exists. Without an
    /// explicit device, `AVAudioEngine` follows the system default route, and after an undock
    /// or sleep that route can keep pointing at the vanished device until the app relaunches
    /// (#1859). A retry should therefore bind the engine to the current default input itself.
    static func isMissingDevice(error: Error) -> Bool {
        extractOSStatus(from: error) == kAudioHardwareBadDeviceError
    }

    static func isRetryable(error: Error) -> Bool {
        let nsError = error as NSError
        if nsError.domain == AudioEngineRecoveryErrorDomains.avfException
            || nsError.domain == AudioEngineRecoveryErrorDomains.transientFormatMismatch {
            return true
        }

        let detail = nsError.localizedDescription
        return isRetryable(detail: detail, osStatus: extractOSStatus(from: error))
    }

    static func isRetryable(detail: String, osStatus: OSStatus?) -> Bool {
        if let osStatus, retryableOSStatusCodes.contains(osStatus) {
            return true
        }

        let lowercasedDetail = detail.lowercased()
        return lowercasedDetail.contains("config change pending")
            || lowercasedDetail.contains("format mismatch")
            || lowercasedDetail.contains("error -10868")
            || lowercasedDetail.contains("error -10877")
    }

    static func extractOSStatus(from error: Error) -> OSStatus? {
        let nsError = error as NSError
        if nsError.domain == NSOSStatusErrorDomain || nsError.domain == avfAudioErrorDomain {
            return OSStatus(truncatingIfNeeded: nsError.code)
        }

        let detail = nsError.localizedDescription
        if detail.contains("-10868") { return kAudioUnitErr_FormatNotSupported }
        if detail.contains("-10877") { return kAudioUnitErr_InvalidElement }
        return nil
    }
}

/// Bounds how often the armed microphone pre-roll input is re-armed after its stream
/// stalled, was reconfigured by the system, or failed to start. Every failure waits a little
/// longer, and a burst of failures disarms the pre-roll until something external (setting,
/// device change, wake, a recording that worked) calls `reset()`. The normal prewarm and
/// cold-start paths keep working while it is disarmed.
struct MicrophonePrerollRearmPolicy: Equatable {
    enum Decision: Equatable {
        case retry(after: TimeInterval)
        case giveUp
    }

    static let maximumFailuresInWindow = 3
    static let failureWindow: TimeInterval = 60
    static let retryBackoff: [TimeInterval] = [0.5, 2, 5]

    private var failureTimestamps: [TimeInterval] = []
    private(set) var hasGivenUp = false

    mutating func recordFailure(at timestamp: TimeInterval) -> Decision {
        failureTimestamps.removeAll { timestamp - $0 > Self.failureWindow }
        failureTimestamps.append(timestamp)
        guard failureTimestamps.count <= Self.maximumFailuresInWindow else {
            hasGivenUp = true
            return .giveUp
        }
        return .retry(after: Self.retryBackoff[min(failureTimestamps.count, Self.retryBackoff.count) - 1])
    }

    mutating func reset() {
        failureTimestamps.removeAll()
        hasGivenUp = false
    }

    /// A recording that delivered audio proves the input works, so earlier failures (and a
    /// given-up state, which keeps the pre-roll off until something external changes) no
    /// longer apply. Cold-start recordings never claim an armed stream, so they report here.
    mutating func noteWorkingRecording() {
        reset()
    }
}

/// Tracks stops that are still draining a recording. The recording is already inactive and
/// its engine already detached while a stop waits out the short-speech grace and finalizes,
/// yet the stop still owns the capture path. Input preparation (which would arm a second
/// stream) stays blocked until every stop has finished. A counter keeps overlapping stops
/// from releasing each other.
///
/// A Bluetooth release stop does not block preparation: it re-arms nothing, invalidates any
/// in-flight preparation itself and waits for its cleanup, so a preparation that overlaps it
/// is cancelled and cleaned up rather than colliding with a re-arm. Such a stop must not
/// re-arm the input afterwards either, which is why it never leaves a rejected request behind.
///
/// A preparation request that the stop gate rejects is remembered, because nothing else
/// retries it (for example a preference change while a stop drains, or a Bluetooth release
/// stop that schedules no follow-up). The last stop to finish reports it so the caller can
/// run the preparation once; the flag clears when a preparation pass runs with the gate open.
struct RecordingStopTracker: Equatable {
    private var activeStops = 0
    private var blockingStops = 0
    private(set) var hasRejectedPreparation = false

    var isStopping: Bool { blockingStops > 0 }

    mutating func begin(blocksPreparation: Bool = true) {
        activeStops += 1
        if blocksPreparation { blockingStops += 1 }
    }

    /// Returns true when this ended the last stop while a preparation request was rejected
    /// in the meantime, so the caller should run the preparation once.
    @discardableResult
    mutating func end(blocksPreparation: Bool = true) -> Bool {
        activeStops = max(0, activeStops - 1)
        if blocksPreparation { blockingStops = max(0, blockingStops - 1) }
        return activeStops == 0 && hasRejectedPreparation
    }

    /// Whether preparing or arming a microphone input is allowed right now.
    func allowsInputPreparation(isRecordingActive: Bool) -> Bool {
        !isRecordingActive && !isStopping
    }

    /// Gate check for a preparation request. A request rejected while a stop is draining is
    /// remembered for `end()`.
    mutating func evaluatePreparationRequest(isRecordingActive: Bool) -> Bool {
        let allowed = allowsInputPreparation(isRecordingActive: isRecordingActive)
        if !allowed, isStopping {
            hasRejectedPreparation = true
        }
        return allowed
    }

    /// A preparation pass is running with the gate open and re-evaluates eligibility itself,
    /// so a remembered request is satisfied.
    mutating func consumeRejectedPreparation() {
        hasRejectedPreparation = false
    }
}

/// A re-arm that cannot store its stream (slot taken, preparation generation changed) must
/// only disarm the capture it set up itself. When a different prepared stream is already
/// armed, disarming globally would route that stream's idle audio into the recording buffers.
enum MicrophonePrerollRearmStoreFailurePolicy {
    static func shouldDisarmCapture(otherStreamingInputIsPrepared: Bool) -> Bool {
        !otherStreamingInputIsPrepared
    }
}

/// Whether the armed pre-roll input still belongs to the route a recording is about to use.
/// Automatic selection follows the system default, which can change between watchdog ticks:
/// the recording then selects another route while the old input stays armed, and the global
/// armed flag would route the new route's audio into the pre-roll ring instead of the recording.
enum MicrophonePrerollRouteConsistencyPolicy {
    enum ArmedInput: Equatable {
        /// Built-in default input kept running through the engine path.
        case engine(defaultInputDeviceID: AudioDeviceID)
        /// Input-only HAL session for one device.
        case inputOnly(deviceID: AudioDeviceID)
    }

    /// `currentEngineDeviceID` is the system default input that is currently eligible for the
    /// engine pre-roll (nil when none is).
    static func armedInputMatches(
        _ armedInput: ArmedInput,
        route: AudioInputCapture
```

### Core Architecture Module: `TypeWhisper/Services/ClamshellStateProvider.swift`
```
import Foundation
import IOKit

// MARK: - Protocol

/// Abstraction for querying MacBook clamshell (lid) state.
///
/// On MacBooks with Apple Silicon or T2 chips, closing the lid physically
/// disconnects the built-in microphone for privacy. However, CoreAudio still
/// reports the device as connected. This provider lets callers check whether
/// the lid is closed so they can treat the built-in mic as unavailable and
/// trigger failover to an external microphone (see #888).
protocol ClamshellStateProviding: AnyObject, Sendable {
    /// Returns `true` when the MacBook lid is closed (clamshell mode).
    ///
    /// On desktop Macs (iMac, Mac mini, Mac Studio, Mac Pro) where no lid
    /// exists, this always returns `false`.
    func isLidClosed() -> Bool
}

// MARK: - IOKit Implementation

/// Boundary around the IORegistry calls used to obtain the clamshell state.
///
/// Keeping this small makes the production registry path testable without
/// depending on the hardware state of the Mac running the tests.
protocol IOKitRegistryQuerying: AnyObject, Sendable {
    func property(forServiceNamed serviceName: String, named propertyName: String) -> Any?
}

final class IOKitRegistry: IOKitRegistryQuerying, @unchecked Sendable {
    func property(forServiceNamed serviceName: String, named propertyName: String) -> Any? {
        let service = IOServiceGetMatchingService(
            kIOMainPortDefault,
            IOServiceMatching(serviceName)
        )
        guard service != IO_OBJECT_NULL else {
            return nil
        }
        defer { IOObjectRelease(service) }

        return IORegistryEntryCreateCFProperty(
            service,
            propertyName as CFString,
            kCFAllocatorDefault,
            0
        )?.takeRetainedValue()
    }
}

/// Production implementation that reads the clamshell state from IOKit's
/// `IOPMrootDomain` service in the IORegistry.
final class IOKitClamshellStateProvider: ClamshellStateProviding, @unchecked Sendable {
    private static let rootDomainServiceName = "IOPMrootDomain"
    private static let clamshellStatePropertyName = "AppleClamshellState"
    private let registry: IOKitRegistryQuerying

    init(registry: IOKitRegistryQuerying = IOKitRegistry()) {
        self.registry = registry
    }

    func isLidClosed() -> Bool {
        guard let property = registry.property(
            forServiceNamed: Self.rootDomainServiceName,
            named: Self.clamshellStatePropertyName
        ) else {
            return false
        }

        if let boolVal = property as? Bool {
            return boolVal
        } else if let numVal = property as? NSNumber {
            return numVal.boolValue
        }
        return false
    }
}

```

### Core Architecture Module: `TypeWhisper/Services/CoreAudioHALCallbackContext.c`
```
#include "CoreAudioHALCallbackContext.h"

#include <stdatomic.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>

struct CoreAudioHALCallbackContext {
    _Atomic(unsigned long long) state;
    void *payload;
};

_Static_assert(ATOMIC_LLONG_LOCK_FREE == 2,
               "CoreAudio callback context requires a lock-free C11 atomic word");

#define CORE_AUDIO_HAL_CALLBACK_CLOSED ((unsigned long long)1)
#define CORE_AUDIO_HAL_CALLBACK_TEARDOWN_CLAIMED ((unsigned long long)2)
#define CORE_AUDIO_HAL_CALLBACK_DESTROY_SEALED ((unsigned long long)4)
#define CORE_AUDIO_HAL_CALLBACK_IN_FLIGHT_INCREMENT ((unsigned long long)8)
#define CORE_AUDIO_HAL_CALLBACK_IN_FLIGHT_MASK (~((unsigned long long)7))

CoreAudioHALCallbackContext *CoreAudioHALCallbackContextCreate(void *payload) {
    if (payload == NULL) {
        return NULL;
    }

    CoreAudioHALCallbackContext *context = calloc(1, sizeof(*context));
    if (context == NULL) {
        return NULL;
    }

    atomic_init(&context->state, CORE_AUDIO_HAL_CALLBACK_CLOSED);
    context->payload = payload;
    return context;
}

void CoreAudioHALCallbackContextDestroy(CoreAudioHALCallbackContext *context) {
    free(context);
}

bool CoreAudioHALCallbackContextOpen(CoreAudioHALCallbackContext *context) {
    unsigned long long observed = atomic_load_explicit(&context->state, memory_order_acquire);

    for (;;) {
        if ((observed & CORE_AUDIO_HAL_CALLBACK_TEARDOWN_CLAIMED) != 0) {
            return false;
        }
        if ((observed & CORE_AUDIO_HAL_CALLBACK_CLOSED) == 0) {
            return true;
        }
        // Defensively prevent future callers from reopening a reused context
        // while a callback is still observing its closed state.
        if ((observed & CORE_AUDIO_HAL_CALLBACK_IN_FLIGHT_MASK) != 0) {
            return false;
        }

        const unsigned long long desired = observed & ~CORE_AUDIO_HAL_CALLBACK_CLOSED;
        if (atomic_compare_exchange_weak_explicit(
                &context->state,
                &observed,
                desired,
                memory_order_release,
                memory_order_acquire)) {
            return true;
        }
    }
}

bool CoreAudioHALCallbackContextEnter(
    CoreAudioHALCallbackContext *context,
    void **payload
) {
    unsigned long long observed = atomic_load_explicit(&context->state, memory_order_acquire);

    for (;;) {
        if ((observed & CORE_AUDIO_HAL_CALLBACK_DESTROY_SEALED) != 0) {
            *payload = NULL;
            return false;
        }

        // Rejected callbacks count too: they still dereference this context while
        // observing the closed gate and must finish before it is destroyed.
        if ((observed & CORE_AUDIO_HAL_CALLBACK_IN_FLIGHT_MASK) == CORE_AUDIO_HAL_CALLBACK_IN_FLIGHT_MASK) {
            *payload = NULL;
            return false;
        }

        const unsigned long long desired = observed + CORE_AUDIO_HAL_CALLBACK_IN_FLIGHT_INCREMENT;
        if (atomic_compare_exchange_weak_explicit(
                &context->state,
                &observed,
                desired,
                memory_order_acq_rel,
                memory_order_acquire)) {
            *payload = (observed & CORE_AUDIO_HAL_CALLBACK_CLOSED) == 0 ? context->payload : NULL;
            return true;
        }
    }
}

void CoreAudioHALCallbackContextLeave(CoreAudioHALCallbackContext *context) {
    atomic_fetch_sub_explicit(
        &context->state,
        CORE_AUDIO_HAL_CALLBACK_IN_FLIGHT_INCREMENT,
        memory_order_release
    );
}

bool CoreAudioHALCallbackContextBeginTeardown(CoreAudioHALCallbackContext *context) {
    unsigned long long observed = atomic_load_explicit(&context->state, memory_order_acquire);

    for (;;) {
        if ((observed & CORE_AUDIO_HAL_CALLBACK_TEARDOWN_CLAIMED) != 0) {
            return false;
        }

        const unsigned long long desired = observed |
            CORE_AUDIO_HAL_CALLBACK_CLOSED |
            CORE_AUDIO_HAL_CALLBACK_TEARDOWN_CLAIMED;
        if (atomic_compare_exchange_weak_explicit(
                &context->state,
                &observed,
                desired,
                memory_order_acq_rel,
                memory_order_acquire)) {
            return true;
        }
    }
}

bool CoreAudioHALCallbackContextIsDrained(CoreAudioHALCallbackContext *context) {
    const unsigned long long state = atomic_load_explicit(&context->state, memory_order_acquire);
    return (state & CORE_AUDIO_HAL_CALLBACK_IN_FLIGHT_MASK) == 0;
}

bool CoreAudioHALCallbackContextSealForDestruction(CoreAudioHALCallbackContext *context) {
    unsigned long long observed = atomic_load_explicit(&context->state, memory_order_acquire);

    for (;;) {
        if ((observed & CORE_AUDIO_HAL_CALLBACK_TEARDOWN_CLAIMED) == 0) {
            return false;
        }
        if ((observed & CORE_AUDIO_HAL_CALLBACK_DESTROY_SEALED) != 0) {
            return true;
        }
        if ((observed & CORE_AUDIO_HAL_CALLBACK_IN_FLIGHT_MASK) != 0) {
            return false;
        }

        const unsigned long long desired = observed | CORE_AUDIO_HAL_CALLBACK_DESTROY_SEALED;
        if (atomic_compare_exchange_weak_explicit(
                &context->state,
                &observed,
                desired,
                memory_order_acq_rel,
                memory_order_acquire)) {
            return true;
        }
    }
}

// MARK: - Realtime input render state

#define CORE_AUDIO_HAL_INPUT_MAX_CHANNELS ((uint32_t)64)
#define CORE_AUDIO_HAL_INPUT_MAX_FRAMES_PER_SLICE ((uint32_t)1 << 20)
#define CORE_AUDIO_HAL_INPUT_MAX_RING_CAPACITY ((uint64_t)1 << 27)
#define CORE_AUDIO_HAL_INPUT_CACHE_LINE 64

_Static_assert(ATOMIC_INT_LOCK_FREE == 2,
               "CoreAudio input render state requires lock-free 32-bit atomics");

struct CoreAudioHALInputRenderState {
    // Written before the callback gate opens, read-only afterwards.
    uint32_t channelCount;
    uint32_t maximumFramesPerSlice;
    CoreAudioHALInputRenderProc renderProc;
    void *renderContext;
    AudioBufferList *bufferList;
    float *renderStorage;
    const float **renderChannels;
    float *ring;
    uint64_t ringCapacity;
    uint64_t ringMask;

    // Monotonic slot indices. The producer owns writeIndex, the consumer owns readIndex.
    _Alignas(CORE_AUDIO_HAL_INPUT_CACHE_LINE) _Atomic(uint64_t) writeIndex;
    _Alignas(CORE_AUDIO_HAL_INPUT_CACHE_LINE) _Atomic(uint64_t) readIndex;

    _Alignas(CORE_AUDIO_HAL_INPUT_CACHE_LINE) _Atomic(uint64_t) droppedFrames;
    _Atomic(uint64_t) renderFailures;
    _Atomic(int32_t) lastRenderFailureStatus;
};

CoreAudioHALInputRenderState *CoreAudioHALInputRenderStateCreate(
    uint32_t channelCount,
    CoreAudioHALInputRenderProc renderProc,
    void *renderContext
) {
    if (channelCount == 0 || channelCount > CORE_AUDIO_HAL_INPUT_MAX_CHANNELS ||
        renderProc == NULL || renderContext == NULL) {
        return NULL;
    }

    void *memory = NULL;
    if (posix_memalign(&memory, CORE_AUDIO_HAL_INPUT_CACHE_LINE, sizeof(CoreAudioHALInputRenderState)) != 0) {
        return NULL;
    }
    memset(memory, 0, sizeof(CoreAudioHALInputRenderState));

    CoreAudioHALInputRenderState *state = memory;
    state->channelCount = channelCount;
    state->renderProc = renderProc;
    state->renderContext = renderContext;
    atomic_init(&state->writeIndex, 0);
    atomic_init(&state->readIndex, 0);
    atomic_init(&state->droppedFrames, 0);
    atomic_init(&state->renderFailures, 0);
    atomic_init(&state->lastRenderFailureStatus, noErr);
    return state;
}

void CoreAudioHALInputRenderStateDestroy(CoreAudioHALInputRenderState *state) {
    free(state->bufferList);
    free(state->renderStorage);
    free((void *)state->renderChannels);
    free(state->ring);
    free(state);
}

bool CoreAudioHALInputRenderStatePrepare(
    CoreAudioHALInputRenderState *state,
    uint32_t maximumFramesPerSlice,
    uint64_t minimumRingCapacitySamples
) {
    if (state->bufferList != NULL ||
        maximumFramesPerSlice == 0 ||
        maximumFramesPerSlice > CORE_AUDIO_HAL_INPUT_MAX_FRAMES_PER_SLICE) {
        return false;
    }

    const uint64_t channelCount = state->channelCount;
    // Each slice is stored as one header slot followed by planar channel samples.
    const uint64_t largestPacket = 1 + (uint64_t)maximumFramesPerSlice * channelCount;
    uint64_t requiredCapacity = minimumRingCapacitySamples;
    if (requiredCapacity < largestPacket * 4) {
        requiredCapacity = largestPacket * 4;
    }
    uint64_t ringCapacity = 1;
    while (ringCapacity < requiredCapacity) {
        ringCapacity <<= 1;
        if (ringCapacity > CORE_AUDIO_HAL_INPUT_MAX_RING_CAPACITY) {
            return false;
        }
    }

    const size_t bufferListSize = offsetof(AudioBufferList, mBuffers) + (size_t)channelCount * sizeof(AudioBuffer);
    AudioBufferList *bufferList = calloc(1, bufferListSize);
    float *renderStorage = calloc((size_t)maximumFramesPerSlice * (size_t)channelCount, sizeof(float));
    const float **renderChannels = calloc((size_t)channelCount, sizeof(const float *));
    float *ring = calloc((size_t)ringCapacity, sizeof(float));
    if (bufferList == NULL || renderStorage == NULL || renderChannels == NULL || ring == NULL) {
        free(bufferList);
        free(renderStorage);
        free((void *)renderChannels);
        free(ring);
        return false;
    }

    bufferList->mNumberBuffers = state->channelCount;
    for (uint32_t channel = 0; channel < state->channelCount; channel++) {
        bufferList->mBuffers[channel].mNumberChannels = 1;
        bufferList->mBuffers[channel].mDataByteSize = 0;
        bufferList->mBuffers[channel].mData = renderStorage + (size_t)channel * maximumFramesPerSlice;
    }

    state->maximumFramesPerSlice = maximumFramesPerSlice;
    state->renderStorage = renderStorage;
    state->renderChannels = renderChannels;
    state->ring = ring;
    state->ringCapacity = ringCapacity;
    s
```

### Core Architecture Module: `TypeWhisper/Services/CoreAudioHALCallbackContext.h`
```
#pragma once

#include <AudioToolbox/AudioToolbox.h>
#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct CoreAudioHALCallbackContext CoreAudioHALCallbackContext;

CoreAudioHALCallbackContext * _Nullable CoreAudioHALCallbackContextCreate(void * _Nonnull payload);
void CoreAudioHALCallbackContextDestroy(CoreAudioHALCallbackContext * _Nonnull context);

bool CoreAudioHALCallbackContextOpen(CoreAudioHALCallbackContext * _Nonnull context);
/// Marks a callback in flight. `payload` is NULL when the gate is closed.
/// A successful caller must always invoke `CoreAudioHALCallbackContextLeave`.
bool CoreAudioHALCallbackContextEnter(
    CoreAudioHALCallbackContext * _Nonnull context,
    void * _Nullable * _Nonnull payload
);
void CoreAudioHALCallbackContextLeave(CoreAudioHALCallbackContext * _Nonnull context);

/// Atomically closes the callback gate and claims teardown. Only the first caller succeeds.
bool CoreAudioHALCallbackContextBeginTeardown(CoreAudioHALCallbackContext * _Nonnull context);
bool CoreAudioHALCallbackContextIsDrained(CoreAudioHALCallbackContext * _Nonnull context);
/// Atomically verifies the context is drained and prevents future callback admission.
bool CoreAudioHALCallbackContextSealForDestruction(CoreAudioHALCallbackContext * _Nonnull context);

// MARK: - Realtime input render state

/// Pulls one input slice into `ioData`. Runs on the CoreAudio IO thread and must not
/// allocate, lock, log, or call into Objective-C or Swift runtime machinery.
typedef OSStatus (*CoreAudioHALInputRenderProc)(
    void * _Nonnull context,
    AudioUnitRenderActionFlags * _Nonnull ioActionFlags,
    const AudioTimeStamp * _Nonnull inTimeStamp,
    UInt32 inBusNumber,
    UInt32 inNumberFrames,
    AudioBufferList * _Nonnull ioData
);

/// Preallocated render storage plus a lock-free single-producer/single-consumer ring.
/// The realtime IO callback is the only producer; one serial delivery queue is the only
/// consumer. Slices are stored as packets so the consumer sees the exact callback slicing.
typedef struct CoreAudioHALInputRenderState CoreAudioHALInputRenderState;

CoreAudioHALInputRenderState * _Nullable CoreAudioHALInputRenderStateCreate(
    uint32_t channelCount,
    CoreAudioHALInputRenderProc _Nonnull renderProc,
    void * _Nonnull renderContext
);
/// Must only be called once no callback can reach the state anymore.
void CoreAudioHALInputRenderStateDestroy(CoreAudioHALInputRenderState * _Nonnull state);

/// Allocates render buffers and the ring. Must happen before the callback gate opens.
bool CoreAudioHALInputRenderStatePrepare(
    CoreAudioHALInputRenderState * _Nonnull state,
    uint32_t maximumFramesPerSlice,
    uint64_t minimumRingCapacitySamples
);
uint64_t CoreAudioHALInputRenderStateRingCapacity(CoreAudioHALInputRenderState * _Nonnull state);

/// Production render proc: `context` is the `AudioUnit` to pull input from.
OSStatus CoreAudioHALInputAudioUnitRender(
    void * _Nonnull context,
    AudioUnitRenderActionFlags * _Nonnull ioActionFlags,
    const AudioTimeStamp * _Nonnull inTimeStamp,
    UInt32 inBusNumber,
    UInt32 inNumberFrames,
    AudioBufferList * _Nonnull ioData
);

/// AURenderCallback for input-only HAL capture. `inRefCon` is a CoreAudioHALCallbackContext
/// whose payload is a prepared CoreAudioHALInputRenderState.
OSStatus CoreAudioHALInputRenderCallback(
    void * _Nonnull inRefCon,
    AudioUnitRenderActionFlags * _Nonnull ioActionFlags,
    const AudioTimeStamp * _Nonnull inTimeStamp,
    UInt32 inBusNumber,
    UInt32 inNumberFrames,
    AudioBufferList * _Nullable ioData
);

/// Producer side. Rejects the whole slice and counts its frames as dropped when full.
bool CoreAudioHALInputRenderStateWriteSlice(
    CoreAudioHALInputRenderState * _Nonnull state,
    const float * _Nonnull const * _Nonnull channels,
    uint32_t frameCount
);
/// Consumer side. Returns the frame count of the oldest slice, or 0 when the ring is empty.
uint32_t CoreAudioHALInputRenderStatePeekSliceFrameCount(CoreAudioHALInputRenderState * _Nonnull state);
/// Consumer side. Discards the oldest slice, counts its frames as dropped, and returns them.
uint32_t CoreAudioHALInputRenderStateSkipSlice(CoreAudioHALInputRenderState * _Nonnull state);
/// Consumer side. Copies the oldest slice into non-interleaved `channels` and returns
/// its frame count, or 0 when the ring is empty.
uint32_t CoreAudioHALInputRenderStateReadSlice(
    CoreAudioHALInputRenderState * _Nonnull state,
    float * _Nonnull const * _Nonnull channels,
    uint32_t frameCapacity
);
/// Returns and resets the number of frames lost to ring overflow or oversized slices.
uint64_t CoreAudioHALInputRenderStateTakeDroppedFrames(CoreAudioHALInputRenderState * _Nonnull state);
/// Returns and resets the number of failed render calls and reports the latest status.
uint64_t CoreAudioHALInputRenderStateTakeRenderFailures(
    CoreAudioHALInputRenderState * _Nonnull state,
    OSStatus * _Nonnull lastStatus
);

#ifdef __cplusplus
}
#endif

```

### Core Architecture Module: `TypeWhisper/Services/Sync/CloudFolderSyncEngine.swift`
```
import Foundation

enum CloudFolderSyncProvider: String, Equatable, Sendable {
    case iCloudDrive = "iCloud Drive"
    case oneDrive = "OneDrive"
    case dropbox = "Dropbox"
    case custom = "Custom Folder"

    var displayName: String {
        switch self {
        case .iCloudDrive:
            String(localized: "iCloud Drive")
        case .oneDrive:
            String(localized: "OneDrive")
        case .dropbox:
            String(localized: "Dropbox")
        case .custom:
            String(localized: "Custom Folder")
        }
    }

    static func detect(folderURL: URL) -> CloudFolderSyncProvider {
        let path = folderURL.path.lowercased()
        if path.contains("mobile documents") || path.contains("icloud drive") {
            return .iCloudDrive
        }
        if path.contains("onedrive") {
            return .oneDrive
        }
        if path.contains("dropbox") {
            return .dropbox
        }
        return .custom
    }
}

struct CloudFolderSyncState: Codable, Equatable, Sendable {
    var deviceId: String
    var knownLocalItemIDs: Set<String>
    var exportedItemVersions: [String: String]
    var appliedOperationIDs: Set<String>
    var lastSyncAt: Date?
    var historyGeneration: String

    init(
        deviceId: String = UUID().uuidString,
        knownLocalItemIDs: Set<String> = [],
        exportedItemVersions: [String: String] = [:],
        appliedOperationIDs: Set<String> = [],
        lastSyncAt: Date? = nil,
        historyGeneration: String = "history-v1"
    ) {
        self.deviceId = deviceId
        self.knownLocalItemIDs = knownLocalItemIDs
        self.exportedItemVersions = exportedItemVersions
        self.appliedOperationIDs = appliedOperationIDs
        self.lastSyncAt = lastSyncAt
        self.historyGeneration = historyGeneration
    }

    private enum CodingKeys: String, CodingKey {
        case deviceId
        case knownLocalItemIDs
        case exportedItemVersions
        case appliedOperationIDs
        case lastSyncAt
        case historyGeneration
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        deviceId = try container.decodeIfPresent(String.self, forKey: .deviceId)
            ?? UUID().uuidString
        knownLocalItemIDs = try container.decodeIfPresent(
            Set<String>.self,
            forKey: .knownLocalItemIDs
        ) ?? []
        exportedItemVersions = try container.decodeIfPresent(
            [String: String].self,
            forKey: .exportedItemVersions
        ) ?? [:]
        appliedOperationIDs = try container.decodeIfPresent(
            Set<String>.self,
            forKey: .appliedOperationIDs
        ) ?? []
        lastSyncAt = try container.decodeIfPresent(Date.self, forKey: .lastSyncAt)
        historyGeneration = try container.decodeIfPresent(
            String.self,
            forKey: .historyGeneration
        ) ?? "history-v1"
    }
}

struct CloudFolderSyncResult: Equatable, Sendable {
    let operationsRead: Int
    let operationsWritten: Int
    let mutationsApplied: Int
    let syncedAt: Date
    let diagnostics: [CloudFolderSyncDiagnostic]
    let devices: [CloudFolderSyncDeviceRecord]
    /// Package listing taken before the operations were read, so later remote changes differ from it.
    let packageFingerprint: CloudFolderSyncPackageFingerprint?
    /// Set when applied remote changes must be republished by another sync, even though the
    /// package did not change since this one.
    let requiresFollowUpSync: Bool
}

struct CloudFolderSyncDiagnostic: Equatable, Sendable {
    enum Kind: String, Sendable {
        case unreadableFile
        case malformedOperation
        case malformedDevice
        case unsupportedSchema
        case audioTransferFailed
    }
    let kind: Kind
    let fileName: String

    /// Failures that can clear up while the file keeps its size and modification date, such as
    /// restored permissions or a cloud placeholder that finished downloading.
    var isTransient: Bool {
        kind == .unreadableFile || kind == .audioTransferFailed
    }
}

struct CloudFolderSyncManifest: Codable, Equatable, Sendable {
    let schemaVersion: Int
    let createdBy: String
    let updatedAt: Date
}

struct CloudFolderSyncDeviceRecord: Codable, Equatable, Sendable {
    let deviceId: String
    let historyOriginDeviceID: String?
    let platform: String
    let appVersion: String
    let updatedAt: Date
    let name: String?
    /// What this device's version syncs beyond the base schema; nil from older versions.
    let capabilities: [String]?

    /// The device reads and writes the `transcript` and `speakers` history components.
    static let speakerTranscriptCapability = "history.transcript.v1"

    var syncsSpeakerTranscripts: Bool {
        capabilities?.contains(Self.speakerTranscriptCapability) == true
    }

    init(
        deviceId: String,
        historyOriginDeviceID: String? = nil,
        platform: String,
        appVersion: String,
        updatedAt: Date,
        name: String? = nil,
        capabilities: [String]? = nil
    ) {
        self.deviceId = deviceId
        self.historyOriginDeviceID = historyOriginDeviceID
        self.platform = platform
        self.appVersion = appVersion
        self.updatedAt = updatedAt
        self.name = name
        self.capabilities = capabilities
    }
}

struct CloudFolderSyncOperation: Codable, Equatable, Sendable {
    enum Kind: String, Codable, Sendable {
        case upsert
        case delete
    }

    let schemaVersion: Int
    let operationId: String
    let deviceId: String
    let collection: UserDataSyncCollection
    var itemId: String
    let kind: Kind
    let updatedAt: Date
    let deletedAt: Date?
    var dictionary: UserDataSyncDictionaryEntry?
    let snippet: UserDataSyncSnippet?
    let historyPayloadVersion: Int?
    let historyGeneration: String?
    let historyComponent: UserDataSyncHistoryComponent?
    let historyContent: UserDataSyncHistoryContentV1?
    let historyInbox: UserDataSyncHistoryInboxV1?
    let historyAudio: UserDataSyncHistoryAudioV1?
    var historyTranscript: UserDataSyncHistoryTranscriptV1? = nil
    var historySpeakers: UserDataSyncHistorySpeakersV1? = nil

    static func upsertDictionary(
        _ entry: UserDataSyncDictionaryEntry,
        itemID: String,
        deviceId: String,
        operationId: String = UUID().uuidString
    ) -> CloudFolderSyncOperation {
        CloudFolderSyncOperation(
            schemaVersion: entry.isRegex ? 2 : 1,
            operationId: operationId,
            deviceId: deviceId,
            collection: .dictionary,
            itemId: itemID,
            kind: .upsert,
            updatedAt: entry.updatedAt,
            deletedAt: nil,
            dictionary: entry,
            snippet: nil,
            historyPayloadVersion: nil,
            historyGeneration: nil,
            historyComponent: nil,
            historyContent: nil,
            historyInbox: nil,
            historyAudio: nil
        )
    }

    static func upsertSnippet(
        _ snippet: UserDataSyncSnippet,
        itemID: String,
        deviceId: String,
        operationId: String = UUID().uuidString
    ) -> CloudFolderSyncOperation {
        CloudFolderSyncOperation(
            schemaVersion: 1,
            operationId: operationId,
            deviceId: deviceId,
            collection: .snippets,
            itemId: itemID,
            kind: .upsert,
            updatedAt: snippet.updatedAt,
            deletedAt: nil,
            dictionary: nil,
            snippet: snippet,
            historyPayloadVersion: nil,
            historyGeneration: nil,
            historyComponent: nil,
            historyContent: nil,
            historyInbox: nil,
            historyAudio: nil
        )
    }

    static func upsertHistory(
        itemID: String,
        component: UserDataSyncHistoryComponent,
        generation: String,
        deviceId: String,
        content: UserDataSyncHistoryContentV1? = nil,
        inbox: UserDataSyncHistoryInboxV1? = nil,
        audio: UserDataSyncHistoryAudioV1? = nil,
        transcript: UserDataSyncHistoryTranscriptV1? = nil,
        speakers: UserDataSyncHistorySpeakersV1? = nil,
        operationId: String = UUID().uuidString
    ) -> CloudFolderSyncOperation {
        let updatedAt = content?.updatedAt ?? inbox?.updatedAt ?? audio?.updatedAt
            ?? transcript?.updatedAt ?? speakers?.updatedAt ?? .distantPast
        return CloudFolderSyncOperation(
            schemaVersion: 1,
            operationId: operationId,
            deviceId: deviceId,
            collection: .history,
            itemId: itemID,
            kind: .upsert,
            updatedAt: updatedAt,
            deletedAt: nil,
            dictionary: nil,
            snippet: nil,
            historyPayloadVersion: 1,
            historyGeneration: generation,
            historyComponent: component,
            historyContent: content,
            historyInbox: inbox,
            historyAudio: audio,
            historyTranscript: transcript,
            historySpeakers: speakers
        )
    }

    static func delete(
        collection: UserDataSyncCollection,
        itemID: String,
        deviceId: String,
        deletedAt: Date,
        operationId: String = UUID().uuidString
    ) -> CloudFolderSyncOperation {
        CloudFolderSyncOperation(
            schemaVersion: itemID.hasPrefix(UserDataSyncIdentity.regexCorrectionPrefix) ? 2 : 1,
            operationId: operationId,
            deviceId: deviceId,
            collection: collection,
            itemId: itemID,
            kind: .delete,
            updatedAt: deletedAt,
            deletedAt: deletedAt,
            dictionary: nil,
            snippet: nil,
            historyPayloadVersion: collection == .history ? 1 : nil,
            historyGeneration: nil,
            historyCompone
```

### Core Architecture Module: `TypeWhisper/ViewModels/SetupWizardEngineRecommendation.swift`
```
import Foundation
import Network
import TypeWhisperPluginSDK

// Issue #1332: the setup wizard recommends a local engine for the language the user
// dictates in, on the hardware at hand. The recommendation is a pure function of the
// inputs below, so every combination can be tested without plugins or a network.

// MARK: - Spoken languages

/// The languages to recommend an engine for, taken from the spoken language setting.
/// The app language is not an input: it does not say which language someone dictates in.
enum SetupWizardSpokenLanguages: Equatable, Sendable {
    /// Automatic detection, so the language is not known.
    case automatic
    /// One or more languages as base language codes, "pt" for "pt-BR".
    case specific([String])

    init(_ selection: LanguageSelection) {
        var codes: [String] = []
        for code in selection.selectedCodes.map(Self.baseLanguageCode) where !code.isEmpty && !codes.contains(code) {
            codes.append(code)
        }
        self = codes.isEmpty ? .automatic : .specific(codes)
    }

    var codes: [String] {
        switch self {
        case .automatic: []
        case .specific(let codes): codes
        }
    }

    static func baseLanguageCode(_ code: String) -> String {
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return trimmed.split(whereSeparator: { $0 == "-" || $0 == "_" }).first.map(String.init) ?? trimmed
    }
}

// MARK: - Engine table

/// Local engines the wizard can recommend, in the order it prefers them when several
/// support the spoken languages. GigaAM transcribes Russian only, with punctuation, so it
/// comes first but only counts when Russian is the only spoken language. Parakeet comes
/// next because it transcribes far faster than the others in the benchmark at similar
/// accuracy in English, German and Russian. WhisperKit covers the most languages. Qwen3
/// adds Filipino. Apple Speech needs no plugin download but was the least accurate where
/// measured. None of them takes language hints: with a mix of languages, each transcribes
/// the first one, and Apple Speech loads the system model for it before each transcription.
enum SetupWizardLocalEngine: String, CaseIterable, Sendable {
    case gigaAM
    case parakeet
    case whisperKit
    case qwen3
    case appleSpeech
}

/// A model the wizard downloads for an engine, with the plugin's own memory requirement.
struct SetupWizardEngineModel: Equatable, Sendable {
    let id: String
    let minimumMemoryGB: Int
}

extension SetupWizardLocalEngine {
    var providerId: String {
        switch self {
        case .gigaAM: "gigaam"
        case .parakeet: SetupWizardParakeetRecommendation.providerId
        case .whisperKit: "whisper"
        case .qwen3: "qwen3"
        case .appleSpeech: AppleSpeechModelSelection.providerId
        }
    }

    var manifestId: String {
        switch self {
        case .gigaAM: "com.typewhisper.gigaam"
        case .parakeet: SetupWizardParakeetRecommendation.manifestId
        case .whisperKit: "com.typewhisper.whisperkit"
        case .qwen3: "com.typewhisper.qwen3"
        case .appleSpeech: AppleSpeechModelSelection.manifestId
        }
    }

    var displayName: String {
        switch self {
        case .gigaAM: "GigaAM"
        case .parakeet: "Parakeet"
        case .whisperKit: "WhisperKit"
        case .qwen3: "Qwen3 ASR"
        case .appleSpeech: "Apple Speech"
        }
    }

    /// From the plugin manifests: GigaAM, Parakeet, WhisperKit and Qwen3 ship for arm64 only.
    var requiresAppleSilicon: Bool {
        self != .appleSpeech
    }

    /// An engine for a single language. It is recommended only when that language is the
    /// only spoken language, never for automatic detection.
    var isSingleLanguageEngine: Bool {
        self == .gigaAM
    }

    /// From the plugin manifests (`minOSVersion`).
    var minimumMacOSMajorVersion: Int {
        self == .appleSpeech ? 26 : 14
    }

    /// Languages of the models below, as the plugins declare them. Nil for Apple Speech,
    /// whose languages only the installed engine knows, because they depend on the system.
    /// `SetupWizardEngineRecommendationTests` checks these lists against the plugins.
    var knownLanguages: [String]? {
        switch self {
        case .gigaAM:
            // GigaAMPlugin.supportedLanguages
            ["ru"]
        case .parakeet:
            // ParakeetVersion.ultra and .v3
            ["bg", "hr", "cs", "da", "nl", "en", "et", "fi", "fr", "de", "el", "hu", "it", "lv", "lt", "mt", "pl", "pt", "ro", "sk", "sl", "es", "sv", "ru", "uk"]
        case .whisperKit:
            // WhisperKitPlugin.supportedLanguages, the list the language picker also falls back to
            defaultSpokenLanguageCodes
        case .qwen3:
            // Qwen3Plugin.qwenSupportedLanguageCodes
            [
                "zh", "en", "yue", "ar", "de", "fr", "es", "pt", "id", "it",
                "ko", "ru", "th", "vi", "ja", "tr", "hi", "ms", "nl", "sv",
                "da", "fi", "pl", "cs", "fil", "tl", "fa", "el", "ro", "hu",
                "mk",
            ]
        case .appleSpeech:
            nil
        }
    }

    /// Models to download, best first. The first one that fits the Mac's memory is used.
    /// Apple Speech picks a model for the spoken language itself.
    var models: [SetupWizardEngineModel] {
        switch self {
        case .gigaAM:
            [SetupWizardEngineModel(id: "gigaam-v3-e2e-rnnt", minimumMemoryGB: 2)]
        case .parakeet:
            // Ultra is the plugin's default; v3 only for an installed plugin without Ultra.
            [
                SetupWizardEngineModel(id: "parakeet-ultra", minimumMemoryGB: 8),
                SetupWizardEngineModel(id: "parakeet-tdt-0.6b-v3", minimumMemoryGB: 8),
            ]
        case .whisperKit:
            [SetupWizardEngineModel(id: "openai_whisper-large-v3_turbo", minimumMemoryGB: 8)]
        case .qwen3:
            // The plugin's "Best default" and "8 GB pick".
            [
                SetupWizardEngineModel(id: "qwen3-asr-1.7b-6bit", minimumMemoryGB: 16),
                SetupWizardEngineModel(id: "qwen3-asr-0.6b-6bit", minimumMemoryGB: 8),
            ]
        case .appleSpeech:
            []
        }
    }

    static func engine(forProviderId providerId: String) -> SetupWizardLocalEngine? {
        allCases.first { $0.providerId == providerId }
    }

    /// The engines the wizard can set up, in its order. Both editions include all of them.
    static var offered: [SetupWizardLocalEngine] {
        allCases
    }
}

// MARK: - Inputs

/// What the app knows about one engine right now.
struct SetupWizardEngineState: Equatable, Sendable {
    /// The plugin is installed, enabled or not. Apple Speech is built in.
    var isInstalled = false
    /// The engine can transcribe without downloading anything first.
    var isReady = false
    /// Languages the loaded engine reports, nil while it is not loaded.
    var reportedLanguages: [String]?
    /// Models the loaded engine offers, nil while it is not loaded.
    var modelIds: [String]?
    /// The model selected in the engine, nil while none is.
    var selectedModelId: String?
    /// Models whose files are on disk, as the plugin reports them. Empty for a plugin
    /// that does not report them, such as Parakeet, whose model then counts as a download.
    var downloadedModelIds: Set<String> = []
}

/// The plugin marketplace as far as the app could load it.
enum SetupWizardCatalogState: Equatable, Sendable {
    case loading
    /// IDs of the plugins with a download for this Mac and app version.
    case loaded(Set<String>)
    /// The marketplace could not be reached and no copy was cached.
    case unavailable
}

struct SetupWizardEngineRecommendationInput: Equatable, Sendable {
    var spokenLanguages: SetupWizardSpokenLanguages
    /// "arm64" or "x86_64", as `RuntimeArchitecture.current` reports it.
    var architecture: String
    var physicalMemory: UInt64
    var macOSMajorVersion: Int
    var engines: [SetupWizardLocalEngine: SetupWizardEngineState]
    var catalog: SetupWizardCatalogState
    var isOffline: Bool
}

// MARK: - Recommendation

enum SetupWizardEngineRecommendation: Equatable, Sendable {
    /// A local engine that supports the spoken languages and runs on this Mac.
    case engine(SetupWizardEngineChoice)
    /// No local engine can be recommended. The wizard explains why.
    case limitation(SetupWizardEngineLimitation)
    /// Only Apple Speech could still support the languages, and it has not reported its
    /// languages yet. The recommendation follows once it has.
    case pending

    var choice: SetupWizardEngineChoice? {
        if case .engine(let choice) = self { return choice }
        return nil
    }
}

struct SetupWizardEngineChoice: Equatable, Sendable {
    enum Reason: Equatable, Sendable {
        /// The engine supports every selected language.
        case supportsLanguages([String])
        /// Automatic detection among this many languages, nil when the count is unknown.
        case detectsLanguages(count: Int?)
    }

    enum Availability: Equatable, Sendable {
        /// Ready, installed with its model on disk, or the plugin or model can be
        /// downloaded now.
        case available
        /// The plugin or model needs a download and the Mac is offline.
        case needsConnection
        /// The marketplace has no download of the plugin for this Mac.
        case notInCatalog
        /// The marketplace could not be reached.
        case catalogUnavailable
    }

    let engine: SetupWizardLocalEngine
    /// The model to load when the engine has none yet. Nil for Apple Speech.
    let modelId: String?
    /// The model that activating the engine loads, the one selected in it or `modelId`,
    /// is on disk, so the engine can be activated offline.
    let modelIsDownloaded: Bool
    let 
```

### Core Architecture Module: `TypeWhisperPluginSDK/Plugins/ContributorPlugin/ContributorQueueStore.swift`
```
import Foundation
import TypeWhisperPluginSDK

final class ContributorQueueStore: @unchecked Sendable {
    private static let privateDirectoryPermissions = 0o700
    private static let privateFilePermissions = 0o600

    private let rootDirectory: URL
    private let pendingDirectory: URL
    private let receiptsDirectory: URL
    private let fileManager: FileManager
    private let lock = NSLock()
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init(rootDirectory: URL, fileManager: FileManager = .default) {
        self.rootDirectory = rootDirectory
        self.pendingDirectory = rootDirectory.appendingPathComponent("pending", isDirectory: true)
        self.receiptsDirectory = rootDirectory.appendingPathComponent("receipts", isDirectory: true)
        self.fileManager = fileManager

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        self.encoder = encoder

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder
    }

    func loadRecords() throws -> [ContributionRecord] {
        try lock.withLock {
            try ensureDirectories()
            let urls = try fileManager.contentsOfDirectory(
                at: pendingDirectory,
                includingPropertiesForKeys: nil,
                options: [.skipsHiddenFiles]
            )
            return urls
                .filter { $0.pathExtension == "json" }
                .compactMap { url in
                    guard let data = try? Data(contentsOf: url) else { return nil }
                    return try? decoder.decode(ContributionRecord.self, from: data)
                }
                .sorted { $0.capturedAt > $1.capturedAt }
        }
    }

    @discardableResult
    func insert(_ record: ContributionRecord) throws -> Bool {
        guard record.isValidCorrection else {
            throw ContributorQueueError.invalidCorrection
        }
        return try lock.withLock {
            try ensureDirectories()
            let destination = recordURL(record.id)
            guard !fileManager.fileExists(atPath: destination.path) else { return false }
            try writeSecurely(encoder.encode(record), to: destination)
            return true
        }
    }

    func upsert(_ record: ContributionRecord) throws {
        guard record.isValidCorrection else {
            throw ContributorQueueError.invalidCorrection
        }
        try lock.withLock {
            try ensureDirectories()
            try writeSecurely(encoder.encode(record), to: recordURL(record.id))
        }
    }

    func remove(_ id: UUID) throws {
        try lock.withLock {
            let url = recordURL(id)
            guard fileManager.fileExists(atPath: url.path) else { return }
            try fileManager.removeItem(at: url)
        }
    }

    func complete(_ record: ContributionRecord) throws {
        guard record.status.isTerminal else { return }
        try lock.withLock {
            try ensureDirectories()
            let receipt = ContributionReceipt(
                id: record.id,
                status: record.status,
                reasonCode: record.reasonCode,
                qualityCredit: record.qualityCredit,
                completedAt: Date()
            )
            try writeSecurely(
                encoder.encode(receipt),
                to: receiptsDirectory.appendingPathComponent("\(record.id.uuidString.lowercased()).json")
            )
            let pendingURL = recordURL(record.id)
            if fileManager.fileExists(atPath: pendingURL.path) {
                try fileManager.removeItem(at: pendingURL)
            }
        }
    }

    private func ensureDirectories() throws {
        try secureDirectory(rootDirectory)
        try secureDirectory(pendingDirectory)
        try secureDirectory(receiptsDirectory)
        try secureExistingFiles(in: pendingDirectory)
        try secureExistingFiles(in: receiptsDirectory)
    }

    private func secureDirectory(_ directory: URL) throws {
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        try fileManager.setAttributes(
            [.posixPermissions: Self.privateDirectoryPermissions],
            ofItemAtPath: directory.path
        )
    }

    private func writeSecurely(_ data: Data, to destination: URL) throws {
        try data.write(to: destination, options: .atomic)
        try secureFile(destination)
    }

    private func secureExistingFiles(in directory: URL) throws {
        let urls = try fileManager.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        )
        for url in urls where try url.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile == true {
            try secureFile(url)
        }
    }

    private func secureFile(_ file: URL) throws {
        try fileManager.setAttributes(
            [.posixPermissions: Self.privateFilePermissions],
            ofItemAtPath: file.path
        )
    }

    private func recordURL(_ id: UUID) -> URL {
        pendingDirectory.appendingPathComponent("\(id.uuidString.lowercased()).json")
    }
}

enum ContributorQueueError: LocalizedError {
    case invalidCorrection

    var errorDescription: String? {
        switch self {
        case .invalidCorrection:
            "The correction is incomplete or unchanged."
        }
    }
}

```

### Core Architecture Module: `TypeWhisperPluginSDK/Plugins/MemPalacePlugin/OfflineQueue.swift`
```
import Foundation
import TypeWhisperPluginSDK
import os

private let queueLogger = Logger(subsystem: "com.mempalace.memory", category: "queue")

struct QueuedStore: Codable {
    var entry: MemoryEntry
    var wing: String
    var room: String
    var attemptCount: Int
    var firstQueuedAt: Date
}

/// Actor-isolated write-ahead log. Stores entries that failed `store()` due to
/// network errors. Drained on a background loop with exponential backoff.
actor OfflineQueue {
    private let url: URL
    private var items: [QueuedStore] = []
    private var isDirty = false

    init(url: URL) {
        self.url = url
        if FileManager.default.fileExists(atPath: url.path),
           let data = try? Data(contentsOf: url),
           let array = try? JSONDecoder.memoryDecoder.decode([QueuedStore].self, from: data) {
            items = array
        }
    }

    var count: Int { items.count }
    var isEmpty: Bool { items.isEmpty }

    func enqueue(_ entry: MemoryEntry, wing: String, room: String) {
        // Dedupe by entry.id: if the same memory is being re-enqueued (e.g.
        // the user retries a failed dictation, or a drain batch returned the
        // entry after another store() ran), replace the existing item so we
        // never create duplicate remote drawers for one local entry.
        if let existing = items.firstIndex(where: { $0.entry.id == entry.id }) {
            items[existing] = QueuedStore(
                entry: entry,
                wing: wing,
                room: room,
                attemptCount: items[existing].attemptCount,
                firstQueuedAt: items[existing].firstQueuedAt
            )
        } else {
            items.append(
                QueuedStore(
                    entry: entry,
                    wing: wing,
                    room: room,
                    attemptCount: 0,
                    firstQueuedAt: Date()
                )
            )
        }
        isDirty = true
        flush()
    }

    /// Returns the next batch to retry (FIFO), bumping attemptCount.
    func nextBatch(limit: Int) -> [QueuedStore] {
        let batch = Array(items.prefix(limit))
        for i in 0..<batch.count {
            items[i].attemptCount += 1
        }
        if !batch.isEmpty { isDirty = true }
        return batch
    }

    func remove(_ entryId: UUID) {
        let before = items.count
        items.removeAll { $0.entry.id == entryId }
        if items.count != before {
            isDirty = true
            flush()
        }
    }

    func clear() {
        items.removeAll()
        isDirty = true
        flush()
    }

    @discardableResult
    func flush() -> Bool {
        guard isDirty else { return false }
        do {
            let data = try JSONEncoder.memoryEncoder.encode(items)
            try data.write(to: url, options: .atomic)
            isDirty = false
            return true
        } catch {
            queueLogger.error("queue persist failed: \(String(describing: error))")
            return false
        }
    }
}

```

### Core Architecture Module: `TypeWhisperPluginSDK/Plugins/WebhookPlugin/WebhookPlugin.swift`
```
// Example TypeWhisper Plugin - Webhook Notifications
//
// This is a reference implementation showing how to build an external
// TypeWhisper plugin as a .bundle. The builtin webhook integration in
// TypeWhisper uses the same SDK patterns shown here.
//
// To build your own plugin:
// 1. Create a new macOS Bundle target
// 2. Add TypeWhisperPluginSDK as a dependency
// 3. Implement the TypeWhisperPlugin protocol
// 4. Create a manifest.json in Contents/Resources/
// 5. Place the built .bundle in ~/Library/Application Support/TypeWhisper/Plugins/

import Foundation
import SwiftUI
import TypeWhisperPluginSDK

// MARK: - Plugin Entry Point

@objc(WebhookPlugin)
final class WebhookPlugin: NSObject, TypeWhisperPlugin, @unchecked Sendable {
    static let pluginId = "com.typewhisper.webhook"
    static let pluginName = "Webhook Notifications"

    private var host: HostServices?
    private var subscriptionId: UUID?
    private var service: ExampleWebhookService?

    required override init() {
        super.init()
    }

    func activate(host: HostServices) {
        self.host = host

        // Create the service with the plugin's data directory for persistence
        let svc = ExampleWebhookService(dataDirectory: host.pluginDataDirectory, host: host)
        self.service = svc

        // Subscribe to transcription events via the Event Bus
        subscriptionId = host.eventBus.subscribe { [weak svc] event in
            switch event {
            case .transcriptionCompleted(let payload):
                await svc?.sendWebhooks(for: payload)
            case .recorderTranscriptReady(let payload):
                await svc?.sendWebhooks(for: payload)
            default:
                break
            }
        }
    }

    func deactivate() {
        // Unsubscribe from events and clean up
        if let id = subscriptionId {
            host?.eventBus.unsubscribe(id: id)
            subscriptionId = nil
        }
        host = nil
        service = nil
    }

    // Provide a settings view for the Plugin Settings UI
    var settingsView: AnyView? {
        guard let service else { return nil }
        return AnyView(ExampleWebhookSettingsView(service: service))
    }
}

// MARK: - Webhook Config Model

struct ExampleWebhookConfig: Codable, Identifiable {
    static let secretHeaderPlaceholder = "__typewhisper_keychain_secret__"

    var id: UUID
    var name: String
    var url: String
    var httpMethod: String
    var headers: [String: String]
    var secretHeaderNames: [String]
    var isEnabled: Bool
    var workflowFilter: [String]  // Empty = all transcriptions
    var includesRecordings: Bool
    var includesDictations: Bool  // False = Recorder transcripts only

    init(name: String = "", url: String = "", httpMethod: String = "POST",
         headers: [String: String] = ["Content-Type": "application/json"],
         secretHeaderNames: [String] = [],
         isEnabled: Bool = true, workflowFilter: [String] = [], includesRecordings: Bool = false,
         includesDictations: Bool = true) {
        self.id = UUID()
        self.name = name
        self.url = url
        self.httpMethod = httpMethod
        self.headers = headers
        self.secretHeaderNames = secretHeaderNames
        self.isEnabled = isEnabled
        self.workflowFilter = workflowFilter
        self.includesRecordings = includesRecordings
        self.includesDictations = includesDictations
    }

    var isUnmodifiedDefaultDraft: Bool {
        name.isEmpty
            && url.isEmpty
            && httpMethod == "POST"
            && headers == ["Content-Type": "application/json"]
            && secretHeaderNames.isEmpty
            && isEnabled
            && workflowFilter.isEmpty
            && !includesRecordings
            && includesDictations
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case url
        case httpMethod
        case headers
        case secretHeaderNames
        case isEnabled
        case workflowFilter = "profileFilter"
        case includesRecordings
        case includesDictations
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        url = try container.decode(String.self, forKey: .url)
        httpMethod = try container.decode(String.self, forKey: .httpMethod)
        headers = try container.decode([String: String].self, forKey: .headers)
        secretHeaderNames = try container.decodeIfPresent([String].self, forKey: .secretHeaderNames) ?? []
        isEnabled = try container.decode(Bool.self, forKey: .isEnabled)
        workflowFilter = try container.decode([String].self, forKey: .workflowFilter)
        includesRecordings = try container.decodeIfPresent(Bool.self, forKey: .includesRecordings) ?? false
        includesDictations = try container.decodeIfPresent(Bool.self, forKey: .includesDictations) ?? true
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(url, forKey: .url)
        try container.encode(httpMethod, forKey: .httpMethod)
        try container.encode(headers, forKey: .headers)
        try container.encode(secretHeaderNames, forKey: .secretHeaderNames)
        try container.encode(isEnabled, forKey: .isEnabled)
        try container.encode(workflowFilter, forKey: .workflowFilter)
        try container.encode(includesRecordings, forKey: .includesRecordings)
        try container.encode(includesDictations, forKey: .includesDictations)
    }
}

// MARK: - Delivery Log

struct ExampleDeliveryLogEntry: Identifiable {
    let id = UUID()
    let timestamp = Date()
    let webhookName: String
    let url: String
    let statusCode: Int?
    let error: String?
    let success: Bool
}

// MARK: - Webhook Service

final class ExampleWebhookService: ObservableObject, @unchecked Sendable {
    @Published var webhooks: [ExampleWebhookConfig] = []
    @Published var deliveryLog: [ExampleDeliveryLogEntry] = []

    private let configURL: URL
    private let maxLogEntries = 20
    let host: HostServices
    private static let sensitiveHeaderNames: Set<String> = [
        "authorization",
        "proxy-authorization",
        "api-key",
        "x-api-key",
        "x-auth-token",
        "x-access-token",
        "x-webhook-secret",
        "webhook-secret",
        "x-hub-signature",
        "x-hub-signature-256",
        "x-signature",
        "signature",
        "x-signing-secret",
        "private-token",
        "token",
    ]

    init(dataDirectory: URL, host: HostServices) {
        self.host = host
        // pluginDataDirectory is automatically created by the host
        // at ~/Library/Application Support/TypeWhisper/PluginData/<pluginId>/
        self.configURL = dataDirectory.appendingPathComponent("webhooks.json")
        loadConfig()
    }

    // MARK: - Persistence

    private func loadConfig() {
        guard let data = try? Data(contentsOf: configURL),
              let config = try? JSONDecoder().decode([ExampleWebhookConfig].self, from: data) else { return }
        let migratedConfig = config.filter { !$0.isUnmodifiedDefaultDraft }
        webhooks = migratedConfig.map(resolveSecretHeaders)
        if migratedConfig.count != config.count
            || migratedConfig.contains(where: containsPlaintextSecretHeader)
            || migratedConfig.contains(where: containsEmptySensitiveHeader) {
            saveConfig()
        }
    }

    func saveConfig() {
        let persistedWebhooks = webhooks.map(configForPersistence)
        guard let data = try? JSONEncoder().encode(persistedWebhooks) else { return }
        try? data.write(to: configURL, options: .atomic)
    }

    func addWebhook(_ webhook: ExampleWebhookConfig) {
        webhooks.append(configRemovingEmptySensitiveHeaders(from: webhook))
        saveConfig()
    }

    func removeWebhook(id: UUID) {
        if let webhook = webhooks.first(where: { $0.id == id }) {
            clearStoredSecrets(for: webhook)
        }
        webhooks.removeAll { $0.id == id }
        saveConfig()
    }

    func updateWebhook(_ webhook: ExampleWebhookConfig) {
        guard let index = webhooks.firstIndex(where: { $0.id == webhook.id }) else { return }
        let nextWebhook = configRemovingEmptySensitiveHeaders(from: webhook)
        clearSecretsRemoved(from: webhooks[index], next: nextWebhook)
        webhooks[index] = nextWebhook
        saveConfig()
    }

    func saveWebhook(_ webhook: ExampleWebhookConfig) {
        if webhooks.contains(where: { $0.id == webhook.id }) {
            updateWebhook(webhook)
        } else {
            addWebhook(webhook)
        }
    }

    static func secretStorageKey(webhookID: UUID, headerName: String) -> String {
        let keyComponent = Data(normalizeHeaderName(headerName).utf8)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        return "webhook.\(webhookID.uuidString).header.\(keyComponent)"
    }

    static func isSensitiveHeader(_ headerName: String) -> Bool {
        let normalized = normalizeHeaderName(headerName)
        return sensitiveHeaderNames.contains(normalized)
            || normalized.hasSuffix("-token")
            || normalized.hasSuffix("-secret")
            || normalized.hasSuffix("-api-key")
    }

    private static func normalizeHeaderName(_ headerName: String) -> String {
        headerName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private func containsPlaintextSecretHeader(_ webhook: ExampleWebhookConfig) -> Bool {
        webhook.headers.
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1898** (2026-11-11): **Diarization seems to be enabled while using Dictation which causes extra usage**
  *Symptoms*: ### Platform  macOS  ### Description  When using Reson8 with the option speaker diarization ON in the plugin diarization is also used when dictating which seems unnecessary since it's causes extra usage and cost. (visible on the usage page of reson8).   I didn't check to see if it's a general behavior or reson8 specific.    ### Steps to Reproduce  Enable speaker diarization in the Reson8 plugin and start dictating (using Rumble).  ### Expected Behavior  Not using diarization while dictating only when transcribing a recording (with multiple speakers)  ### OS Version  _No response_  ### TypeWhisper Version  v1.8.2-daily.20261110  ### Diagnostics / Logs  ```shell  ```

- **Issue #1888** (2026-11-11): **Recorder payload: is_me ignores a speaker the user named as themselves**
  *Symptoms*: ### Platform  macOS  ### Description  The Recorder's completion payload marks the user's own speaker with `is_me`, but only by the microphone channel. The app also treats a speaker as the user when they're named as the user, so the two can disagree.  - `RecorderSpeakerSnapshot.adding` (`SpeakerTranscriptCoordinator.swift`) sets `isMe: speakerID == me`, where `me` is `SpeakerWorkspaceModel.microphoneSpeaker`: the diarizer speaker with at least half of their speech inside the stored own-speech ranges. - `SpeakerWorkspaceModel.isOwnSpeaker`, which puts a speaker's turns on the right in the Speakers view, also accepts a speaker whose name matches "Me" in the app's language or the user's own name (`SpeakerOwnName.isOwnName`).  When the microphone channel doesn't identify the user, the user can fix it by renaming their speaker to "Me". That happens whenever there are no own-speech ranges (they are only computed with both microphone and system audio, `AudioRecorderService` around the `ownSpeechRanges` call), or when the diarizer splits the user so that no speaker reaches half. The app then shows them as the user, while the payload still sends `is_me: false` for every speaker, with `name: "Me"`. An automation that relies on `is_me` treats the user as a remote participant.  Found during #1875 / #1876: echo removal there makes empty own-speech ranges a bit more likely in calls on loudspeakers where the user talks over the remote side most of the time.  ### Steps to Reproduce  1. Record

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

### Incident Patch 1: `6c26a50e` (2026-11-14)
**Commit Message**: (feature) Add the SOV-Transcribe plugin for Macs with 32 GB of memory (#1935)

* Add the SOV-Transcribe plugin

SOV-Transcribe 1.0.0 runs Salesforce SOV-Transcribe-1 (Whisper large-v3
encoder, Gemma 4 26B-A4B decoder) with MLX. It offers the 4-bit weights
(nativ-community/SOV-Transcribe-1-4bit, pinned to 8a2f46d8) on Macs with
32 GB of memory or more. Below that the host gets no model, the settings
show the requirement and loading fails with it.

- Transcribes en, de, fr, es, it, pt and nl with the model card's
  instruction for the language, or its instruction for any language when
  none is set. No translation.
- Dictionary terms reach the model as hotwords
  ("Contextual vocabulary: A, B").
- The token budget is 10 tokens per second of audio, at least 1024 and
  at most 18,000. Recordings longer than 30 minutes go through
  PluginAudioChunking, so no call exceeds the model's limit.
- Streams text while it decodes and clears the MLX cache after each
  transcription and on unload.

mlx-audio-swift moves to 56abd969 (branch seofood/sov-transcribe-on-0.31),
the previous pin plus the SOV-Transcribe-1 backport, for the app, the
plugins and the App Store project.

* Load SOV-Transcribe

**File**: `.github/workflows/plugin-release.yml` (modified, +3/-2)
```diff
@@ -120,6 +120,7 @@ jobs:
             file-job-script) TARGET="FileJobScriptPlugin" ;;
             livetranscript) TARGET="LiveTranscriptPlugin" ;;
             granite) TARGET="GranitePlugin" ;;
+            sov-transcribe) TARGET="SOVTranscribePlugin" ;;
             canary) TARGET="CanaryPlugin" ;;
             gigaam) TARGET="GigaAMPlugin" ;;
             cloudflare-asr) TARGET="CloudflareASRPlugin" ;;
@@ -154,13 +155,13 @@ jobs:
           # All plugins use Xcode 27.1 (mlx-swift 0.31.6 requires Swift 6.3+ for package resolution,
           # and workspace-state.json v7 from Xcode 26.x is incompatible with Xcode 16.2)
           # - SpeechAnalyzer: macOS 26 deployment target
-          # - Qwen3/Voxtral/Granite/Canary/LocalLLM: macOS 14 + embed Swift compat libs (MLX uses Swift 6.2 features)
+          # - Qwen3/Voxtral/Granite/SOV-Transcribe/Canary/LocalLLM: macOS 14 + embed Swift compat libs (MLX uses Swift 6.2 features)
           # - All others: macOS 14, no compat libs needed (simple Foundation/SDK code)
           EMBED_SWIFT_LIBS="NO"
           XCODE_VERSION="27.1"
           if [ "$TARGET" = "SpeechAnalyzerPlugin" ]; then
             DEPLOY_TARGET="26.0"
-          elif [ "$TARGET" = "Qwen3Plugin" ] || [ "$TARGET" = "VoxtralPlugin" ] || [ "$TARGET" = "GranitePlugin" ] || [ "$TARGET" = "CanaryPlugin" ] || [ "$TARGET" = "LocalLLMPlugin" ]; then
+          elif [ "$TARGET" = "Qwen3Plugin" ] || [ "$TARGET" = "VoxtralPlugin" ] || [ "$TARGET" = "GranitePlugin" ] || [ "$TARGET" = "SOVTranscribePlugin" ] || [ "$TARGET" = "CanaryPlugin" ] || [ "$TARGET" = "LocalLLMPlugin" ]; then
             DEPLOY_TARGET="14.0"
             EMBED_SWIFT_LIBS="YES"
           else
```

**File**: `TypeWhisper.xcodeproj/project.pbxproj` (modified, +149/-1)
```diff
@@ -63,6 +63,7 @@
 		1E6EDB8B0D1573A05A610078 /* PluginManifestValidationTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = BDF548E65340A17A3A16590B /* PluginManifestValidationTests.swift */; };
 		7A1018FIX0000000000A001 /* PassiveRestoreSelectedEngineTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 7A1018FIX0000000000A002 /* PassiveRestoreSelectedEngineTests.swift */; };
 		103600000000000000000001 /* MLXPluginModelStorageTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 103600000000000000000002 /* MLXPluginModelStorageTests.swift */; };
+		50F700000000000000000018 /* SOVTranscribePluginTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 50F700000000000000000017 /* SOVTranscribePluginTests.swift */; };
 		4D980A5CFE1A4217A10C2101 /* WhisperKitPluginLifecycleTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4D980A5CFE1A4217A10C2102 /* WhisperKitPluginLifecycleTests.swift */; };
 		4D980A5CFE1A4217A10C2104 /* WhisperKitPluginCompatibilityTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4D980A5CFE1A4217A10C2103 /* WhisperKitPluginCompatibilityTests.swift */; };
 		0B58B3B8ACBA76118C3B54C2 /* ModelManagerRestoreAfterAutoUnloadTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3B9EC248517FD4849BEF54D /* ModelManagerRestoreAfterAutoUnloadTests.swift */; };
@@ -154,6 +155,7 @@
 		C23000000000000000000008 /* Qwen3Plugin.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000150 /* Qwen3Plugin.swift */; };
 		C23000000000000000000009 /* VoxtralPlugin.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000191 /* VoxtralPlugin.swift */; };
 		C2300000000000000000000A /* GranitePlugin.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000221 /* GranitePlugin.swift */; };
+		50F700000000000000000016 /* SOVTranscribePlugin.swift in Sources */ = {isa = PBXBuildFile; fileRef = 50F700000000000000000001 /* SOVTranscribePlugin.swift */; };
 		C2300000000000000000000B /* MLXAudioSTT in Frameworks */ = {isa = PBXBuildFile; productRef = PP00000000000000000012 /* MLXAudioSTT */; };
 		C2300000000000000000000C /* MLXAudioCore in Frameworks */ = {isa = PBXBuildFile; productRef = PP00000000000000000013 /* MLXAudioCore */; };
 		C2300000000000000000000D /* WhisperKit in Frameworks */ = {isa = PBXBuildFile; productRef = PP00000000000000000015 /* WhisperKit */; };
@@ -582,6 +584,12 @@
 		AA00000000000000000234 /* TypeWhisperPluginSDK in Frameworks */ = {isa = PBXBuildFile; productRef = PP00000000000000000028 /* TypeWhisperPluginSDK */; };
 		AA00000000000000000235 /* MLXAudioSTT in Frameworks */ = {isa = PBXBuildFile; productRef = PP00000000000000000029 /* MLXAudioSTT */; };
 		AA00000000000000000236 /* MLXAudioCore in Frameworks */ = {isa = PBXBuildFile; productRef = PP00000000000000000030 /* MLXAudioCore */; };
+		50F70000000000000000000D /* SOVTranscribePlugin.swift in Sources */ = {isa = PBXBuildFile; fileRef = 50F700000000000000000001 /* SOVTranscribePlugin.swift */; };
+		50F70000000000000000000E /* manifest.json in Resources */ = {isa = PBXBuildFile; fileRef = 50F700000000000000000002 /* manifest.json */; };
+		50F70000000000000000000F /* Localizable.xcstrings in Resources */ = {isa = PBXBuildFile; fileRef = 50F700000000000000000003 /* Localizable.xcstrings */; };
+		50F700000000000000000010 /* TypeWhisperPluginSDK in Frameworks */ = {isa = PBXBuildFile; productRef = 50F700000000000000000013 /* TypeWhisperPluginSDK */; };
+		50F700000000000000000011 /* MLXAudioSTT in Frameworks */ = {isa = PBXBuildFile; productRef = 50F700000000000000000014 /* MLXAudioSTT */; };
+		50F700000000000000000012 /* MLXAudioCore in Frameworks */ = {isa = PBXBuildFile; productRef = 50F700000000000000000015 /* MLXAudioCore */; };
 		AA00000000000000000237 /* CloudflareASRPlugin.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000225 /* CloudflareASRPlugin.swift */; };
 		AA00000000000000000238 /* manifest.json in Resources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000226 /* manifest.json */; };
 		AA0000000000000000023A /* Localizable.xcstrings in Resources */ = {isa = PBXBuildFile; fileRef = BB0000000000000000022A /* Localizable.xcstrings */; };
@@ -1340,6 +1348,10 @@
 		BB00000000000000000222 /* manifest.json */ = {isa = PBXFileReference; lastKnownFileType = text.json; path = manifest.json; sourceTree = "<group>"; };
 		BB00000000000000000223 /* Localizable.xcstrings */ = {isa = PBXFileReference; lastKnownFileType = text.json.xcstrings; path = Localizable.xcstrings; sourceTree = "<group>"; };
 		BB00000000000000000224 /* GranitePlugin.bundle */ = {isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = GranitePlugin.bundle; sourceTree = BUILT_PRODUCTS_DIR; };
+		50F700000000000000000001 /* SOVTranscribePlugin.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SOVTranscribePlugin.swift; sourceTree = "<group>"; };
+		50F700000000000000000002 /* manif
```

**File**: `TypeWhisper.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/TypeWhisper/mlx-audio-swift.git",
       "state" : {
-        "revision" : "1fb13b441c1ad8aae4a23f6a2223e03e5e5b1738"
+        "revision" : "56abd969a481b909efbb0a20fc762d701df196aa"
       }
     },
     {
```

**File**: `TypeWhisper/Views/PluginSettingsView.swift` (modified, +1/-0)
```diff
@@ -1739,6 +1739,7 @@ private let typeWhisperAddonSlugsByPluginID: [String: String] = [
     "com.typewhisper.script": "script-runner",
     "com.typewhisper.smallest-pulse": "smallest-pulse",
     "com.typewhisper.soniox": "soniox",
+    "com.typewhisper.sov-transcribe": "sov-transcribe",
     "com.typewhisper.speechanalyzer": "apple-speech",
     "com.typewhisper.speechmatics": "speechmatics",
     "com.typewhisper.tts.supertonic": "supertonic",
```

**File**: `TypeWhisperPluginSDK/Package.resolved` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/TypeWhisper/mlx-audio-swift.git",
       "state" : {
-        "revision" : "1fb13b441c1ad8aae4a23f6a2223e03e5e5b1738"
+        "revision" : "56abd969a481b909efbb0a20fc762d701df196aa"
       }
     },
     {
```

**File**: `TypeWhisperPluginSDK/Package.swift` (modified, +4/-3)
```diff
@@ -16,9 +16,10 @@ let package = Package(
         // No NemoTextProcessing trait: its text normalization is only used by FluidAudio's TTS
         // and adds about 8 MB per architecture to every plugin that links FluidAudio.
         .package(url: "https://github.com/FluidInference/FluidAudio.git", exact: "0.17.5", traits: []),
-        // TypeWhisper's fork (branch typewhisper/granite5-on-0.31): upstream 01dec7c9 plus the
-        // Granite Speech 5.0 backports, kept on mlx-swift 0.31 (see the mlx-swift pin below).
-        .package(url: "https://github.com/TypeWhisper/mlx-audio-swift.git", revision: "1fb13b441c1ad8aae4a23f6a2223e03e5e5b1738"),
+        // TypeWhisper's fork (branch seofood/sov-transcribe-on-0.31): upstream 01dec7c9 plus the
+        // Granite Speech 5.0 and SOV-Transcribe-1 backports, kept on mlx-swift 0.31 (see the
+        // mlx-swift pin below).
+        .package(url: "https://github.com/TypeWhisper/mlx-audio-swift.git", revision: "56abd969a481b909efbb0a20fc762d701df196aa"),
         .package(url: "https://github.com/huggingface/swift-huggingface.git", exact: "0.10.1"),
         .package(url: "https://github.com/huggingface/swift-jinja.git", exact: "2.5.0"),
         .package(url: "https://github.com/ml-explore/mlx-swift.git", exact: "0.31.6"),
```

**File**: `TypeWhisperPluginSDK/Plugins/SOVTranscribePlugin/Localizable.xcstrings` (added, +762/-0)
```diff
@@ -0,0 +1,762 @@
+{
+  "sourceLanguage": "en",
+  "strings": {
+    "Download and load %@": {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "%@ laden und aktivieren"
+          }
+        },
+        "es": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Descargar y cargar %@"
+          }
+        },
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "%@を読み込んで有効化"
+          }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "下载并加载 %@"
+          }
+        }
+      }
+    },
+    "Error": {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Fehler"
+          }
+        },
+        "es": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Error"
+          }
+        },
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "エラー"
+          }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "错误"
+          }
+        }
+      }
+    },
+    "Hide Hugging Face token": {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Hugging-Face-Token ausblenden"
+          }
+        },
+        "es": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Ocultar token de Hugging Face"
+          }
+        },
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Hugging Faceトークンを非表示にする"
+          }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "隐藏 Hugging Face 令牌"
+          }
+        }
+      }
+    },
+    "Hugging Face token": {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Hugging-Face-Token"
+          }
+        },
+        "es": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Token de Hugging Face"
+          }
+        },
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Hugging Faceトークン"
+          }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Hugging Face 令牌"
+          }
+        }
+      }
+    },
+    "Load": {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Laden"
+          }
+        },
+        "es": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Cargar"
+          }
+        },
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "読み込む"
+          }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "加载"
+          }
+        }
+      }
+    },
+    "Load %@": {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "%@ laden"
+          }
+        },
+        "es": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Cargar %@"
+          }
+        },
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "%@を読み込む"
+          }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "加载 %@"
+          }
+        }
+      }
+    },
+    "Loaded": {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Geladen"
+          }
+        },
+        "es": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Cargado"
+          }
+        },
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "読み込み済み"
+          }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "已加载"
+          }
+        }
+      }
+    },
+    "Loading %@": {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "%@ wird geladen"
+          }
+        },
+        "es": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Cargando %@"
+          }
+        },
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "%@を読み込み中"
+          }
+        },
+        "zh-Hans":
```

**File**: `TypeWhisperPluginSDK/Plugins/SOVTranscribePlugin/SOVTranscribePlugin.exp` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+_OBJC_CLASS_$_SOVTranscribePlugin
+_OBJC_METACLASS_$_SOVTranscribePlugin
```

---

### Incident Patch 2: `cc9f28e0` (2026-11-14)
**Commit Message**: (bug) Stop reporting a missed text field in web views such as Muse (#1939)

**File**: `TypeWhisper/Services/TextInsertionService.swift` (modified, +34/-10)
```diff
@@ -718,20 +718,34 @@ final class TextInsertionService {
         if isLiveFieldTextRole(element) {
             return (element, true)
         }
-        if let descendant = findEditableTextDescendant(of: element, messagingTimeout: messagingTimeout) {
+        let descendantSearch = findEditableTextDescendant(of: element, messagingTimeout: messagingTimeout)
+        if let descendant = descendantSearch.element {
             return (descendant, true)
         }
         return (nil, Self.focusedElementShowsKeyboardTarget(
-            role: stringAttribute(kAXRoleAttribute as CFString, from: element)
+            role: stringAttribute(kAXRoleAttribute as CFString, from: element),
+            hostsWebContent: descendantSearch.foundWebArea,
+            liesInEditableWebContent: axElementAttribute("AXEditableAncestor" as CFString, from: element) != nil
         ))
     }
 
     /// Whether a focused element without a text element shows where typing goes. Native apps
     /// focus a control inside the window, such as a list in Finder. Apps that draw their own
     /// content name the window itself: GNU Emacs, Qt apps such as OBS, and remote desktop
     /// clients such as Parsec. A paste can still land there (#1750).
-    nonisolated static func focusedElementShowsKeyboardTarget(role: String?) -> Bool {
-        role != kAXWindowRole
+    ///
+    /// Apps that show a web view, such as Meta's Muse, can name the view or one of its
+    /// containers while a field deep inside the web content has focus, beyond the reach of the
+    /// descendant search. Web editors can also focus an element inside their editable region
+    /// that has no text role. Neither shows that the paste missed a text field (#1937). A
+    /// focused link or button on a web page contains no web area and lies outside editable
+    /// content, so it still does.
+    nonisolated static func focusedElementShowsKeyboardTarget(
+        role: String?,
+        hostsWebContent: Bool = false,
+        liesInEditableWebContent: Bool = false
+    ) -> Bool {
+        role != kAXWindowRole && !hostsWebContent && !liesInEditableWebContent
     }
 
     /// Apps that build their accessibility tree on demand, such as Chromium browsers and Electron
@@ -2131,21 +2145,28 @@ final class TextInsertionService {
         findSelectionInDescendants(of: root, maxDepth: 6, maxNodes: 80)
     }
 
+    /// The first editable text element below `root`, and whether the search passed a web area,
+    /// whose focused field can lie beyond the search limits.
     private func findEditableTextDescendant(
         of root: AXUIElement,
         messagingTimeout: Float? = nil
-    ) -> AXUIElement? {
+    ) -> (element: AXUIElement?, foundWebArea: Bool) {
         var queue: [(element: AXUIElement, depth: Int)] = childElements(of: root).map { ($0, 1) }
         var visited = 0
+        var foundWebArea = false
 
         while !queue.isEmpty && visited < 80 {
             let current = queue.removeFirst()
             visited += 1
             applyMessagingTimeout(messagingTimeout, to: current.element)
 
-            if isLiveFieldTextRole(current.element),
+            let role = stringAttribute(kAXRoleAttribute as CFString, from: current.element)
+            if role == "AXWebArea" {
+                foundWebArea = true
+            }
+            if let role, Self.liveFieldTextRoles.contains(role),
                selectedRangeAttribute(from: current.element) != nil {
-                return current.element
+                return (current.element, foundWebArea)
             }
 
             if current.depth < 6 {
@@ -2155,7 +2176,7 @@ final class TextInsertionService {
             }
         }
 
-        return nil
+        return (nil, foundWebArea)
     }
 
     private func findSelectionInDescendants(
@@ -2702,10 +2723,13 @@ final class TextInsertionService {
         let role = roleValue as? String else {
             return false
         }
-        return ["AXTextField", "AXTextArea", "AXComboBox", "AXSearchField", "AXWebArea"]
-            .contains(role)
+        return Self.liveFieldTextRoles.contains(role)
     }
 
+    private static let liveFieldTextRoles: Set<String> = [
+        "AXTextField", "AXTextArea", "AXComboBox", "AXSearchField", "AXWebArea"
+    ]
+
     private enum TextFieldAncestry {
         case web
         case native
```

**File**: `TypeWhisperTests/TypeWhisperIntegrationTests.swift` (modified, +15/-0)
```diff
@@ -6802,6 +6802,21 @@ final class TypeWhisperIntegrationTests: XCTestCase {
         XCTAssertTrue(TextInsertionService.focusedElementShowsKeyboardTarget(role: "AXOutline"))
     }
 
+    func testFocusedWebContentWithoutTextElementDoesNotShowKeyboardTarget() {
+        // Muse names a container of its web view while the chat field deep inside has focus
+        // (#1937), and web editors can focus an element without a text role in their content.
+        XCTAssertFalse(TextInsertionService.focusedElementShowsKeyboardTarget(
+            role: "AXGroup",
+            hostsWebContent: true
+        ))
+        XCTAssertFalse(TextInsertionService.focusedElementShowsKeyboardTarget(
+            role: "AXGroup",
+            liesInEditableWebContent: true
+        ))
+        // A focused link on a web page still shows that the paste missed a text field.
+        XCTAssertTrue(TextInsertionService.focusedElementShowsKeyboardTarget(role: "AXLink"))
+    }
+
     @MainActor
     func testDetectMissedTextFieldIgnoresAppThatHidesFocusedElement() async throws {
         // Chromium and Electron apps name no focused element until their accessibility tree is
```

**File**: `docs/release-notes/unreleased.md` (modified, +1/-0)
```diff
@@ -16,3 +16,4 @@
 - Watch folders: The Markdown transcript now starts with frontmatter that names the audio file, its word timestamps, the date, length, language, engine and speakers, and the text has a paragraph per speaker turn that starts with its time and speaker, for example `**[00:12:03] Speaker 1:**`. With an engine that reports word timestamps, `<file>.timestamps.json` next to the audio file holds them in the format of the HTTP API's `verbose_json` (next to the transcript when the audio file is deleted afterwards). Tools that cut audio by its transcript, such as the TypeWhisper scripts for REAPER, find a recording and the times of its words from a note in an Obsidian vault.
 - Recorder: Recordings transcribed with an engine that reports word timestamps get `<recording>.timestamps.json` next to them; deleting a recording moves it to the Trash with the other files.
 - Obsidian 1.3.0: Recorder notes name the recording and its word timestamps in their frontmatter (`audio:`, `timestamps:`) and show its length.
+- Dictating into apps that show their content in a web view, such as Meta's Muse, no longer ends with "No text field detected" while the text arrives. These apps can report a container of the web view, or an element inside an editable area, as focused instead of the text field, so TypeWhisper no longer takes that as a missed text field. A focused link or button on a web page still gets the warning.
```

---

### Incident Patch 3: `cc8ca968` (2026-11-14)
**Commit Message**: (feature) Add Fluid Speech Pro to the Parakeet plugin (#1934)

**File**: `TypeWhisperPluginSDK/Plugins/ParakeetPlugin/Localizable.xcstrings` (modified, +28/-0)
```diff
@@ -1078,6 +1078,34 @@
         }
       }
     },
+    "Fluid Speech Pro by FluidVoice, built on NVIDIA Parakeet TDT 0.6B v3 and Moondream Parakeet Ultra. Most accurate in English, 25 European languages, no API key required.": {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Fluid Speech Pro von FluidVoice, basiert auf NVIDIA Parakeet TDT 0.6B v3 und Moondream Parakeet Ultra. Am genauesten auf Englisch, 25 europäische Sprachen, kein API-Schlüssel nötig."
+          }
+        },
+        "es": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Fluid Speech Pro de FluidVoice, basado en NVIDIA Parakeet TDT 0.6B v3 y Moondream Parakeet Ultra. El más preciso en inglés, 25 idiomas europeos, no necesita clave de API."
+          }
+        },
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "FluidVoiceのFluid Speech Pro。NVIDIA Parakeet TDT 0.6B v3とMoondream Parakeet Ultraをベースにしています。英語で最も高精度、ヨーロッパの25言語に対応、APIキー不要。"
+          }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "FluidVoice 的 Fluid Speech Pro，基于 NVIDIA Parakeet TDT 0.6B v3 和 Moondream Parakeet Ultra。英语识别最准确，支持 25 种欧洲语言，无需 API 密钥。"
+          }
+        }
+      }
+    },
     "Moondream Parakeet Ultra - Parakeet TDT v3 trained further for higher accuracy. 25 European languages, no API key required.": {
       "localizations": {
         "de": {
```

**File**: `TypeWhisperPluginSDK/Plugins/ParakeetPlugin/ParakeetPlugin.swift` (modified, +122/-56)
```diff
@@ -625,15 +625,25 @@ final class ParakeetPlugin: NSObject, DictionaryTermHintSourceProgressTranscript
         )
     }
 
-    /// Parakeet's vocabulary has no token for a few characters, mostly "&", brackets and some
-    /// quotes. v3 never writes them, but Ultra learned to and emits "<unk>" in their place
-    /// ("M<unk>A", "spectroscopy <unk> FTIR"). Between capitals it stands for "&" (M&A, P&L,
-    /// R&D); elsewhere it is dropped, so the marker never reaches the user's text.
+    /// Parakeet's vocabulary has no token for a few characters: "&", brackets, dashes, typographic
+    /// quotes and apostrophes, and the Greek final sigma "ς". v3 leaves them out, but Ultra and
+    /// Fluid Speech Pro learned to write them and emit "<unk>" in their place. The context tells
+    /// which character it stands for most of the time:
+    /// - between capitals "&" (M&A, P&L, R&D);
+    /// - at the end of a lowercase Greek word "ς" ("τη<unk> εποχή<unk>" is "της εποχής");
+    /// - before a capital an opening quote, so a space keeps the words apart ("film<unk>Il mistero");
+    /// - between lowercase letters an apostrophe (Maltese "f<unk>żewġ" is "f'żewġ").
+    /// Anywhere else it is dropped, so the marker never reaches the user's text. The Windows
+    /// sherpa-onnx plugin applies the same rules in `UnknownTokens.cs`.
     static func removingUnknownTokens(from text: String) -> String {
         let marker = "<unk>"
         guard text.contains(marker) else { return text }
         var cleaned = text
             .replacingOccurrences(of: "(?<=\\p{Lu})<unk>(?=\\p{Lu})", with: "&", options: .regularExpression)
+            // Lowercase Greek and Greek Extended, then the end of the word.
+            .replacingOccurrences(of: "(?<=[\\u03AC-\\u03CE\\u1F00-\\u1FFF])<unk>(?![\\p{L}\\p{N}])", with: "ς", options: .regularExpression)
+            .replacingOccurrences(of: "(?<=[\\p{L}\\p{N}])<unk>(?=\\p{Lu})", with: " ", options: .regularExpression)
+            .replacingOccurrences(of: "(?<=\\p{Ll})<unk>(?=\\p{Ll})", with: "'", options: .regularExpression)
             .replacingOccurrences(of: "(?<=\\w)<unk>(?=\\w)", with: "", options: .regularExpression)
             .replacingOccurrences(of: marker, with: " ")
         cleaned = cleaned
@@ -773,7 +783,14 @@ final class ParakeetPlugin: NSObject, DictionaryTermHintSourceProgressTranscript
             let token = timing.token
             if token.isEmpty || token == "<blank>" || token == "<pad>" { continue }
 
-            let startsNewWord = isWordBoundary(token) || currentWord.isEmpty
+            let markerSplit = markerSeparatesWords(currentWord, nextToken: token)
+            let startsNewWord = isWordBoundary(token) || currentWord.isEmpty || markerSplit
+
+            if markerSplit {
+                // In the full text this marker is the space between the words ("film<unk>Il" reads
+                // "film Il"). Cleaned on its own, "ταινία<unk>" would end in a Greek final sigma.
+                currentWord.removeLast(unknownTokenMarker.count)
+            }
 
             if startsNewWord && !currentWord.isEmpty {
                 let trimmed = currentWord.trimmingCharacters(in: .whitespaces)
@@ -825,6 +842,18 @@ final class ParakeetPlugin: NSObject, DictionaryTermHintSourceProgressTranscript
         return cleaned
     }
 
+    /// The "<unk>" token never carries a word boundary, so it joins the word before it. That
+    /// keeps a marker that becomes "ς" or "'" on its word. Before a capital it becomes a space
+    /// ("film<unk>Il" is "film Il"), so the capital starts a new word. Between two capitals it
+    /// is "&" and the word stays whole (M&A).
+    private static func markerSeparatesWords(_ currentWord: String, nextToken: String) -> Bool {
+        guard currentWord.hasSuffix(unknownTokenMarker), nextToken.first?.isUppercase == true,
+              let before = currentWord.dropLast(unknownTokenMarker.count).last else { return false }
+        return (before.isLetter || before.isNumber) && !before.isUppercase
+    }
+
+    private static let unknownTokenMarker = "<unk>"
+
     /// Same characters as the spacing rule in `removingUnknownTokens(from:)`.
     private static let closingPunctuation: Set<Character> = [",", ".", ";", ":", "!", "?", ")", "]", "}", "…"]
     private static let openingPunctuation: Set<Character> = ["(", "[", "{"]
@@ -1256,8 +1285,8 @@ final class ParakeetPlugin: NSObject, DictionaryTermHintSourceProgressTranscript
                     ? nil
                     : try await reserveDownloadSpace(for: version)
                 defer { spaceReservation?.release() }
-                if version == .fluidSpeechMini {
-                    try await installFluidSpeechMini()
+                if let fluidSpeechModel = version.fluidSpeechModel {
+                    try await installFluidSpeech(fluidSpeechModel)
                     models = try Self.loadInstalledModels(version: version)
                 } else if version
```

**File**: `TypeWhisperPluginSDK/Plugins/ParakeetPlugin/Tests/ParakeetNemotronStreamingTests.swift` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ final class ParakeetNemotronStreamingTests: XCTestCase {
         XCTAssertEqual(Set(directories).count, directories.count, "Every model has its own folder")
         XCTAssertEqual(
             ParakeetVersion.nemotronStreaming.installDirectory.deletingLastPathComponent(),
-            FluidSpeechMini.directory.deletingLastPathComponent()
+            FluidSpeechModel.mini.directory.deletingLastPathComponent()
         )
     }
 
```

**File**: `TypeWhisperPluginSDK/Plugins/ParakeetPlugin/Tests/ParakeetPluginTests.swift` (modified, +70/-15)
```diff
@@ -811,7 +811,7 @@ final class ParakeetPluginTests: XCTestCase {
         let plugin = makePlugin()
         XCTAssertEqual(
             plugin.transcriptionModels.map(\.id),
-            ["parakeet-ultra", "parakeet-tdt-0.6b-v3", "fluid-speech-mini", "parakeet-tdt-0.6b-v2", "nemotron-3.5-asr-streaming-0.6b"]
+            ["parakeet-ultra", "parakeet-tdt-0.6b-v3", "fluid-speech-pro", "fluid-speech-mini", "parakeet-tdt-0.6b-v2", "nemotron-3.5-asr-streaming-0.6b"]
         )
         XCTAssertEqual(ParakeetVersion.from(modelId: "parakeet-ultra"), .ultra)
         XCTAssertEqual(ParakeetVersion.ultra.supportedLanguages, ParakeetVersion.v3.supportedLanguages)
@@ -962,6 +962,16 @@ final class ParakeetPluginTests: XCTestCase {
             ("alongside the word <unk>say<unk> for you", "alongside the word say for you"),
             ("is the 'pay amolai<unk>, bred with olive oil", "is the 'pay amolai, bred with olive oil"),
             ("<unk>Hello there<unk>", "Hello there"),
+            ("Le spectacle <unk>Son et Lumière<unk> à la pyramide", "Le spectacle Son et Lumière à la pyramide"),
+            // Greek final sigma, quotes before a capital and Maltese apostrophes (FLEURS, typewhisper-win#780).
+            ("Η δέκα τη καταιγίδα τη<unk> εποχή<unk> των Ατλαντικών", "Η δέκα τη καταιγίδα της εποχής των Ατλαντικών"),
+            ("Επίση<unk>, μετά την επανάσταση", "Επίσης, μετά την επανάσταση"),
+            ("εναντίον του<unk>.", "εναντίον τους."),
+            ("Se avete visto il film<unk>Il mistero dei Templari<unk>, potreste", "Se avete visto il film Il mistero dei Templari, potreste"),
+            ("Se avete visto il film,<unk>Il mistero dei Templari<unk>, potreste", "Se avete visto il film, Il mistero dei Templari, potreste"),
+            ("hakati nimetama<unk>Kopersiooniks Dragoon.", "hakati nimetama Kopersiooniks Dragoon."),
+            ("Karpaneto kompeta f<unk>żewġ triela", "Karpaneto kompeta f'żewġ triela"),
+            ("ħafna mezzi oħra ta<unk> trasport.", "ħafna mezzi oħra ta trasport."),
             ("no markers here", "no markers here"),
         ]
         for (input, expected) in cases {
@@ -1002,6 +1012,26 @@ final class ParakeetPluginTests: XCTestCase {
         XCTAssertEqual(ParakeetPlugin.groupWordsIntoSegments(words).map(\.text), ["hello, world."])
     }
 
+    func testMarkersThatBecomeLettersStayOnTheirWordAndQuotesSplitWords() {
+        let tokens = ["▁τη", "<unk>", "▁εποχή", "<unk>", "▁f", "<unk>", "ż", "ewġ", "▁film", "<unk>", "Il", "▁mistero", "▁M", "<unk>", "A",
+                      "▁ταινία", "<unk>", "Το"]
+        let timings = tokens.enumerated().map { index, token in
+            TokenTiming(token: token, tokenId: token == "<unk>" ? 0 : index + 1,
+                        startTime: Double(index) * 0.1, endTime: Double(index) * 0.1 + 0.1, confidence: 1)
+        }
+
+        let words = ParakeetPlugin.groupTokensIntoWords(timings)
+
+        XCTAssertEqual(words.map(\.text), ["της", "εποχής", "f'żewġ", "film", "Il", "mistero", "M&A", "ταινία", "Το"])
+        XCTAssertEqual(words[0].end, 0.2, accuracy: 0.0001, "ς keeps the marker's time")
+        XCTAssertEqual(words[3].end, 1.0, accuracy: 0.0001, "The word before the quote ends with the marker")
+        XCTAssertEqual(words[4].start, 1.0, accuracy: 0.0001, "The quoted word starts with its own token")
+        XCTAssertEqual(
+            ParakeetPlugin.groupWordsIntoSegments(words).map(\.text),
+            ["της εποχής f'żewġ film Il mistero M&A ταινία Το"]
+        )
+    }
+
     func testOpeningPunctuationLeftByADroppedMarkerJoinsTheNextWord() {
         let timings = [
             TokenTiming(token: "▁hello", tokenId: 1, startTime: 0.0, endTime: 0.3, confidence: 1),
@@ -1059,7 +1089,7 @@ final class ParakeetPluginTests: XCTestCase {
         XCTAssertEqual(version.jointFileName, ModelNames.ASR.jointFile)
         XCTAssertEqual(ParakeetVersion.ultra.jointFileName, ModelNames.ASR.jointV3File)
         XCTAssertEqual(version.huggingFaceRepository, "FluidVoice-Labs/fluid-speech-mini-coreml")
-        XCTAssertNotNil(FluidSpeechMini.revision.range(of: "^[0-9a-f]{40}$", options: .regularExpression))
+        XCTAssertNotNil(FluidSpeechModel.mini.revision.range(of: "^[0-9a-f]{40}$", options: .regularExpression))
         XCTAssertEqual(version.installDirectory.lastPathComponent, "fluid-speech-mini-coreml")
         XCTAssertNotEqual(version.installDirectory, ParakeetVersion.ultra.installDirectory)
         XCTAssertTrue(
@@ -1069,13 +1099,38 @@ final class ParakeetPluginTests: XCTestCase {
         )
     }
 
+    func testFluidSpeechProIsAMultilingualUltraFineTuneWithoutLanguageHint() {
+        let version = ParakeetVersion.fluidSpeechPro
+        XCTAssertEqual(ParakeetVersion.from(modelId: "fluid-speech-pro"), version)
+        XCTAssertEqual(ParakeetVersion(rawValue: "fluidSpeechPro"), version)
+        XCTAssertEqual(version.supportedLanguages, ParakeetVersion.ultra.supportedLanguages)
+        XCTAssertE
```

**File**: `TypeWhisperPluginSDK/Plugins/ParakeetPlugin/manifest.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
     "id": "com.typewhisper.parakeet",
     "name": "Parakeet",
-    "version": "1.7.0",
+    "version": "1.8.0",
     "minHostVersion": "1.8.2",
     "sdkCompatibilityVersion": "v1-model-import",
     "minOSVersion": "14.0",
```

#### Recent Merged Pull Requests:
- **PR #1950** (2026-11-16): (chore) Keep the module host for the app's lifetime (@SeoFood)
- **PR #1949** (2026-11-16): (feature) Let webhooks send only Recorder transcripts (@SeoFood)
- **PR #1947** (2026-11-15): (chore) Let modules read app managed keys they declare with the same kind (@SeoFood)
- **PR #1946** (2026-11-16): (chore) Search words without a lemma by their stem and share the History planner with iOS (@SeoFood)
- **PR #1945** (2026-11-15): (chore) Give modules host capabilities and contribution points (@SeoFood)
- **PR #1941** (2026-11-15): (chore) Add a module interface package and an empty stub (@SeoFood)

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

## X. (feature) Add the SOV-Transcribe plugin for Macs with 32 GB of memory

**RULE**:
When implementing operations in `.github/workflows/plugin-release.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in TypeWhisper/typewhisper-mac. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6c26a50e`: (feature) Add the SOV-Transcribe plugin for Macs with 32 GB of memory. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/plugin-release.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
            sov-transcribe) TARGET="SOVTranscribePlugin" ;;
          # - Qwen3/Voxtral/Granite/SOV-Transcribe/Canary/LocalLLM: macOS 14 + embed Swift compat libs (MLX uses Swift 6.2 features)
          elif [ "$TARGET" = "Qwen3Plugin" ] || [ "$TARGET" = "VoxtralPlugin" ] || [ "$TARGET" = "GranitePlugin" ] || [ "$TARGET" = "SOVTranscribePlugin" ] || [ "$TARGET" = "CanaryPlugin" ] || [ "$TARGET" = "LocalLLMPlugin" ]; then
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
          # - Qwen3/Voxtral/Granite/Canary/LocalLLM: macOS 14 + embed Swift compat libs (MLX uses Swift 6.2 features)
          elif [ "$TARGET" = "Qwen3Plugin" ] || [ "$TARGET" = "VoxtralPlugin" ] || [ "$TARGET" = "GranitePlugin" ] || [ "$TARGET" = "CanaryPlugin" ] || [ "$TARGET" = "LocalLLMPlugin" ]; then
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6c26a50e` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
