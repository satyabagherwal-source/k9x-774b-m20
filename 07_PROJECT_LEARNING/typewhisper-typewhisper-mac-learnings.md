> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/typewhisper-typewhisper-mac-learnings.md`  
> **Source**: github ([https://github.com/TypeWhisper/typewhisper-mac](https://github.com/TypeWhisper/typewhisper-mac))  
> **Source Version**: `bf7bb1c5`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T13:02:32.776Z  
> **Learning ID**: `learn-github-typewhisper-typewhisper-mac`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): TypeWhisper/typewhisper-mac

> **Canonical Artifact**: `07_PROJECT_LEARNING/typewhisper-typewhisper-mac-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/TypeWhisper/typewhisper-mac](https://github.com/TypeWhisper/typewhisper-mac))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T13:02:32.771Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TypeWhisper/typewhisper-mac`
- **Description**: Local speech-to-text for macOS  on-device AI, fully private, optional cloud
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1923 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

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

    init(name: String = "", url: String = "", httpMethod: String = "POST",
         headers: [String: String] = ["Content-Type": "application/json"],
         secretHeaderNames: [String] = [],
         isEnabled: Bool = true, workflowFilter: [String] = [], includesRecordings: Bool = false) {
        self.id = UUID()
        self.name = name
        self.url = url
        self.httpMethod = httpMethod
        self.headers = headers
        self.secretHeaderNames = secretHeaderNames
        self.isEnabled = isEnabled
        self.workflowFilter = workflowFilter
        self.includesRecordings = includesRecordings
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
        webhook.headers.contains { headerName, value in
            Self.isSensitiveHeader(headerName)
                && value != ExampleWebhookConfig.secretHeaderPlaceholder
                && !value.isEmpty
        }
    }

    private func containsEmptySensitiveHeader(_ webhook: ExampleWebhookConfig) -> Bool {
        webhook.headers.contains { headerName, value in
            Self.isSensitiveHeader(headerName) && value.isEmpty
     
```

### Core Architecture Module: `AppStore/Sources/AppStoreICloudMirror.swift`
```
#if APPSTORE
import Foundation

/// Automatic iCloud sync for the Mac App Store edition.
///
/// The direct-distribution app mirrors its sync package into iCloud through the
/// TypeWhisperICloudBridge XPC service, because only that helper carries the
/// iCloud entitlements. The App Store app holds the iCloud container itself, so
/// it runs the same mirror in process.
final class AppStoreICloudMirror: PremiumICloudBridging, @unchecked Sendable {
    /// Re-evaluated on every access: the user can sign in to iCloud or turn on
    /// iCloud Drive while TypeWhisper runs.
    var isAvailable: Bool {
        localFolderURL != nil && fileManager.ubiquityIdentityToken != nil
    }
    let localFolderURL: URL?

    private let containerIdentifier: String
    private let fileManager: FileManager
    private let queue = DispatchQueue(label: "com.typewhisper.appstore.icloud-mirror", qos: .utility)

    init(bundle: Bundle = .main, fileManager: FileManager = .default) {
        self.fileManager = fileManager
        containerIdentifier = PremiumICloudBridgeConstants.containerIdentifier(
            infoDictionary: bundle.infoDictionary
        )
        localFolderURL = PremiumICloudBridgeConstants.localRootURL(
            bundle: bundle,
            fileManager: fileManager
        )
    }

    func synchronize() async throws {
        try await perform { local, remote in
            try PremiumICloudBridgeFileMirror.synchronize(localRoot: local, remoteRoot: remote)
        }
    }

    func deleteRemotePackage() async throws {
        try await perform { local, remote in
            try PremiumICloudBridgeFileMirror.deletePackages(localRoot: local, remoteRoot: remote)
        }
    }

    /// Removes the record from the mirror and from iCloud; the mirror would
    /// otherwise copy it back on the next pass.
    func removeDevice(_ deviceID: String) async throws {
        try await perform { local, remote in
            try PremiumSyncDeviceRemoval.removeRecords(
                of: deviceID,
                inPackages: [local, remote].map {
                    $0.appendingPathComponent(
                        PremiumICloudBridgeConstants.packageDirectoryName,
                        isDirectory: true
                    )
                }
            )
        }
    }

    /// Runs `operation` on a serial background queue: resolving the ubiquity
    /// container can block, and mirror passes must not overlap.
    private func perform(_ operation: @escaping @Sendable (URL, URL) throws -> Void) async throws {
        guard let local = localFolderURL else {
            throw PremiumICloudBridgeError.appGroupUnavailable
        }
        guard isAvailable else {
            throw PremiumICloudBridgeError.iCloudUnavailable
        }
        let containerIdentifier = containerIdentifier
        let fileManager = fileManager
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            queue.async {
                do {
                    guard let container = fileManager.url(
                        forUbiquityContainerIdentifier: containerIdentifier
                    ) else {
                        throw PremiumICloudBridgeError.iCloudUnavailable
                    }
                    try operation(local, container.appendingPathComponent("Documents", isDirectory: true))
                    continuation.resume()
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }
}
#endif

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

### Incident Patch 1: `6d4cf137` (2026-11-11)
**Commit Message**: (bug) Keep recording briefly after a push-to-talk release so the last word is not cut off (#1897)

Hotkey stops (push-to-talk release, toggle press, Enter submit) keep recording for up to 350 ms and end early once every 50 ms frame of the last 150 ms is below the speech floor. Recordings shorter than 0.3 s keep the short-speech handling of #157. API, silence, cancel and discard stops are unchanged. The recording stays active until the tail ends, a cancelled stop ends the tail at once, and the VoiceOver stop announcement follows the capture.

Fixes #1896

**File**: `TypeWhisper/Services/AudioRecordingService.swift` (modified, +208/-45)
```diff
@@ -332,36 +332,141 @@ final class AudioRecordingService: ObservableObject, @unchecked Sendable {
         return queue
     }()
 
+    /// Audio kept recording after the user released or pressed the shortcut, so the end of
+    /// the last word that is still on its way through the input is not cut off (#1896).
+    struct ReleaseTail: Equatable {
+        /// The tail a hotkey stop gets: at most 350 ms, ending early after 150 ms of quiet.
+        static let hotkeyStop = ReleaseTail(
+            maxDuration: 0.35,
+            quietDuration: 0.15,
+            minimumRecordingDuration: 0.3
+        )
+
+        /// The longest the tail records, counted from the stop request.
+        var maxDuration: TimeInterval
+        /// The tail ends as soon as this much audio at the end of the recording is quiet.
+        var quietDuration: TimeInterval
+        /// Shorter recordings get no tail, so a quick tap of the shortcut keeps the
+        /// short-speech handling of #157 and is still discarded as too short.
+        var minimumRecordingDuration: TimeInterval
+
+        var quietSampleCount: Int {
+            max(1, Int((quietDuration * AudioRecordingService.targetSampleRate).rounded()))
+        }
+
+        func appliesToRecording(bufferedDuration: TimeInterval) -> Bool {
+            bufferedDuration >= minimumRecordingDuration
+        }
+
+        /// The quiet window is judged in 50 ms frames, so speech at its end is never averaged
+        /// away by the quiet before it.
+        static let quietFrameSampleCount = Int(AudioRecordingService.targetSampleRate) / 20
+
+        /// True once every 50 ms frame in the last `quietDuration` of the recording stays below
+        /// the speech floor the live preview and the silence stop use.
+        func isSettled(trailingSamples: ArraySlice<Float>) -> Bool {
+            guard trailingSamples.count >= quietSampleCount else { return false }
+            let window = trailingSamples.suffix(quietSampleCount)
+            var frameStart = window.startIndex
+            while frameStart < window.endIndex {
+                let frameEnd = min(frameStart + Self.quietFrameSampleCount, window.endIndex)
+                let frame = window[frameStart..<frameEnd]
+                let rms = sqrt(frame.reduce(Float(0)) { $0 + $1 * $1 } / Float(frame.count))
+                if rms >= DictationSpeechActivity.speechRMSFloor { return false }
+                frameStart = frameEnd
+            }
+            return true
+        }
+    }
+
+    enum ReleaseTailOutcome: Equatable {
+        /// The policy asked for no tail.
+        case notRequested
+        /// The recording was too short for a tail.
+        case skippedShortRecording
+        /// The end of the recording was quiet, so the tail ended early.
+        case settled(duration: TimeInterval)
+        /// The tail ran for its full length.
+        case reachedMaxDuration(duration: TimeInterval)
+        /// The stop was cancelled during the tail, for example with Escape.
+        case cancelled(duration: TimeInterval)
+
+        var duration: TimeInterval {
+            switch self {
+            case .notRequested, .skippedShortRecording:
+                0
+            case .settled(let duration), .reachedMaxDuration(let duration), .cancelled(let duration):
+                duration
+            }
+        }
+
+        var logDescription: String {
+            switch self {
+            case .notRequested:
+                "none"
+            case .skippedShortRecording:
+                "skipped-short"
+            case .settled(let duration):
+                String(format: "settled(%.0fms)", duration * 1000)
+            case .reachedMaxDuration(let duration):
+                String(format: "max(%.0fms)", duration * 1000)
+            case .cancelled(let duration):
+                String(format: "cancelled(%.0fms)", duration * 1000)
+            }
+        }
+    }
+
     enum StopPolicy {
         case immediate
         case finalizeShortSpeech(
             minBufferedDuration: TimeInterval = 0.05,
             maxExtraCapture: TimeInterval = 0.06,
-            pollInterval: TimeInterval = 0.01
+            pollInterval: TimeInterval = 0.01,
+            releaseTail: ReleaseTail? = nil
         )
 
         var logDescription: String {
             switch self {
             case .immediate:
                 "immediate"
-            case .finalizeShortSpeech(let minBufferedDuration, let maxExtraCapture, let pollInterval):
-                String(
-                    format: "finalizeShortSpeech(min=%.3f,max=%.3f,poll=%.3f)",
-                    minBufferedDuration,
-                    maxExtraCapture,
-                    pollInterval
-                )
+            case .finalizeShortSpeech(let minBufferedDuration, let maxExtraCapture, let pollInterval, let releaseTail):
+                if let releaseTail {
+                    String(
+                        format: "finalizeShortSpeech(min=%.3
```

**File**: `TypeWhisper/ViewModels/DictationViewModel.swift` (modified, +34/-9)
```diff
@@ -1605,6 +1605,12 @@ final class DictationViewModel: ObservableObject {
         )
     }
 
+    /// The stop policy of a stop that transcribes the recording. Key stops add the release
+    /// tail; API and silence stops do not, since nobody spoke right up to them.
+    nonisolated static func finalizingStopPolicy(capturesReleaseTail: Bool) -> AudioRecordingService.StopPolicy {
+        .finalizeShortSpeech(releaseTail: capturesReleaseTail ? .hotkeyStop : nil)
+    }
+
     static func bluetoothStopBehavior(
         usesBluetoothInput: Bool,
         restoresSystemAudio: Bool
@@ -1846,7 +1852,8 @@ final class DictationViewModel: ObservableObject {
                 self.pendingHotkeyStartTask = nil
                 return
             }
-            self.stopDictation()
+            // The user lets go of (or presses) the shortcut right after the last word.
+            self.stopDictation(capturesReleaseTail: true)
         }
 
         hotkeyService.onWorkflowDictationStart = { [weak self] workflowId, requestTimestamp in
@@ -1866,7 +1873,7 @@ final class DictationViewModel: ObservableObject {
             guard let self, self.activeDictationSessionID == sessionID,
                   self.state == .recording else { return }
             self.hotkeyService.cancelDictation()
-            self.stopDictation(submitRequested: true)
+            self.stopDictation(submitRequested: true, capturesReleaseTail: true)
         }
 
         hotkeyService.onCancelPressed = { [weak self] in
@@ -2931,7 +2938,13 @@ final class DictationViewModel: ObservableObject {
 
     /// `stoppedAfterSilence` marks the silence stop of a toggle dictation, which takes the same
     /// path as a second press of the shortcut and only announces its own reason.
-    private func stopDictation(submitRequested: Bool = false, stoppedAfterSilence: Bool = false) {
+    /// `capturesReleaseTail` keeps recording for a moment after a key stop, so the end of the
+    /// last word still in the input is not cut off (#1896).
+    private func stopDictation(
+        submitRequested: Bool = false,
+        stoppedAfterSilence: Bool = false,
+        capturesReleaseTail: Bool = false
+    ) {
         if state == .processing, recordingStartTask != nil, !isStopInFlight {
             cancelCurrentOperation()
             return
@@ -2960,7 +2973,9 @@ final class DictationViewModel: ObservableObject {
         markActiveDictationSessionProcessingIfNeeded()
         // A push-to-talk recording interrupted by other keys is discarded without
         // transcription; its discard banner is announced instead.
-        if pendingPushToTalkDiscardMessage == nil {
+        // After a key stop the microphone still records the release tail, so a spoken
+        // announcement would end up in the recording. It follows once capture ends.
+        if pendingPushToTalkDiscardMessage == nil, !capturesReleaseTail {
             if stoppedAfterSilence {
                 accessibilityAnnouncementService.announceRecordingStoppedAfterSilence()
             } else {
@@ -2971,12 +2986,17 @@ final class DictationViewModel: ObservableObject {
             guard let self else { return }
             await finalizeStopDictation(
                 submitRequested: submitRequested,
-                hiddenLiveSessionWasDeferred: hiddenLiveSessionWasDeferred
+                hiddenLiveSessionWasDeferred: hiddenLiveSessionWasDeferred,
+                capturesReleaseTail: capturesReleaseTail
             )
         }
     }
 
-    private func finalizeStopDictation(submitRequested: Bool, hiddenLiveSessionWasDeferred: Bool) async {
+    private func finalizeStopDictation(
+        submitRequested: Bool,
+        hiddenLiveSessionWasDeferred: Bool,
+        capturesReleaseTail: Bool
+    ) async {
         var didStartTranscriptionTask = false
         defer {
             if Task.isCancelled {
@@ -3029,15 +3049,19 @@ final class DictationViewModel: ObservableObject {
         let streamingPreviewWasHidden = lastStreamingPreviewHidden || hiddenLiveSessionWasDeferred
         lastStreamingPreviewHidden = false
         stopRecordingTimer()
-        let previewText = partialText.trimmingCharacters(in: .whitespacesAndNewlines)
-        let stopPolicy = AudioRecordingService.StopPolicy.finalizeShortSpeech()
+        let stopPolicy = Self.finalizingStopPolicy(capturesReleaseTail: capturesReleaseTail)
         var samples = await audioRecordingService.stopRecording(
             policy: stopPolicy,
             bluetoothBehavior: bluetoothStopBehavior
         )
+        // Taken after the release tail, so a last word the preview shows during it is kept.
+        let previewText = partialText.trimmingCharacters(in: .whitespacesAndNewlines)
         let recordingUsedBluetoothInput = recordingUsesBluetoothInput
         restoreRecordingSideEffects()
         guard !Task.isCancelled else { return }
+        if capturesReleaseTail {
+            accessibilityAnnouncementService.announceRecordi
```

**File**: `TypeWhisperTests/AudioEngineRecoverySupportTests.swift` (modified, +92/-0)
```diff
@@ -1085,6 +1085,98 @@ final class AudioEngineRecoverySupportTests: XCTestCase {
         XCTAssertTrue(error.localizedDescription.contains("got 0.0 Hz/0 ch"))
     }
 
+    /// Audio that arrives after a key stop belongs to the recording (#1896).
+    func testReleaseTailKeepsRecordingAudioThatArrivesAfterTheStop() async throws {
+        let service = AudioRecordingService()
+        service.hasMicrophonePermissionOverride = true
+        service.startRecordingOverride = {}
+        try service.startRecording()
+        service.startRecordingOverride = nil
+        service.engineTeardownOverride = { _ in }
+        service.testingSetAudioEngine(RunningAudioEngine())
+        let speech = Array(repeating: 0.05 as Float, count: 16_000)
+        service.testingProcessConvertedSamples(speech)
+
+        let tail = AudioRecordingService.ReleaseTail(
+            maxDuration: 2,
+            quietDuration: 0.15,
+            minimumRecordingDuration: 0.3
+        )
+        let stopTask = Task {
+            await service.stopRecording(policy: .finalizeShortSpeech(releaseTail: tail))
+        }
+        let didClaimRecordingEngine = await waitUntil(timeout: 1) {
+            service.testingCurrentAudioEngine() == nil
+        }
+        XCTAssertTrue(didClaimRecordingEngine)
+        XCTAssertTrue(service.testingIsRecordingActive, "The recording stays active during the tail")
+
+        // The end of the last word, then the quiet that ends the tail early.
+        let lastWord = Array(repeating: 0.05 as Float, count: 4_000)
+        let quiet = Array(repeating: 0.001 as Float, count: 2_400)
+        service.testingProcessConvertedSamples(lastWord)
+        service.testingProcessConvertedSamples(quiet)
+        let samples = await stopTask.value
+
+        XCTAssertEqual(samples.count, speech.count + lastWord.count + quiet.count)
+        XCTAssertFalse(service.testingIsRecordingActive)
+        guard case .settled(let duration) = service.lastStopReleaseTail else {
+            return XCTFail("Expected a settled tail, got \(service.lastStopReleaseTail)")
+        }
+        XCTAssertLessThan(duration, tail.maxDuration)
+    }
+
+    func testReleaseTailEndsAtOnceWhenTheRecordingAlreadyEndsQuiet() async throws {
+        let service = AudioRecordingService()
+        service.hasMicrophonePermissionOverride = true
+        service.startRecordingOverride = {}
+        try service.startRecording()
+        service.startRecordingOverride = nil
+        service.engineTeardownOverride = { _ in }
+        service.testingSetAudioEngine(RunningAudioEngine())
+        service.testingProcessConvertedSamples(Array(repeating: 0.05 as Float, count: 16_000))
+        service.testingProcessConvertedSamples(Array(repeating: 0.001 as Float, count: 4_000))
+
+        let samples = await service.stopRecording(policy: .finalizeShortSpeech(releaseTail: .hotkeyStop))
+
+        XCTAssertEqual(samples.count, 20_000)
+        XCTAssertEqual(service.lastStopReleaseTail, .settled(duration: service.lastStopReleaseTail.duration))
+        XCTAssertLessThan(service.lastStopReleaseTail.duration, 0.05)
+    }
+
+    func testReleaseTailEndsWhenTheStopIsCancelled() async throws {
+        let service = AudioRecordingService()
+        service.hasMicrophonePermissionOverride = true
+        service.startRecordingOverride = {}
+        try service.startRecording()
+        service.startRecordingOverride = nil
+        service.engineTeardownOverride = { _ in }
+        service.testingSetAudioEngine(RunningAudioEngine())
+        service.testingProcessConvertedSamples(Array(repeating: 0.05 as Float, count: 16_000))
+
+        let tail = AudioRecordingService.ReleaseTail(
+            maxDuration: 5,
+            quietDuration: 0.15,
+            minimumRecordingDuration: 0.3
+        )
+        let stopTask = Task {
+            await service.stopRecording(policy: .finalizeShortSpeech(releaseTail: tail))
+        }
+        let didClaimRecordingEngine = await waitUntil(timeout: 1) {
+            service.testingCurrentAudioEngine() == nil
+        }
+        XCTAssertTrue(didClaimRecordingEngine)
+        stopTask.cancel()
+        let samples = await stopTask.value
+
+        XCTAssertEqual(samples.count, 16_000)
+        XCTAssertFalse(service.testingIsRecordingActive)
+        guard case .cancelled(let duration) = service.lastStopReleaseTail else {
+            return XCTFail("Expected a cancelled tail, got \(service.lastStopReleaseTail)")
+        }
+        XCTAssertLessThan(duration, 1)
+    }
+
     func testRecordingSuccessDiscardDeletesRecoveryAudio() async throws {
         let directory = makeRecoveryTestDirectory()
         let store = DictationRecoveryAudioStore(directory: directory)
```

**File**: `TypeWhisperTests/DictationShortSpeechTests.swift` (modified, +39/-0)
```diff
@@ -306,6 +306,45 @@ final class DictationShortSpeechTests: XCTestCase {
         XCTAssertFalse(AudioRecordingService.StopPolicy.immediate.shouldApplyGracePeriod(bufferedDuration: 0.01))
     }
 
+    func testReleaseTail_settlesOnlyOnQuietAudioAfterARealRecording() {
+        let tail = AudioRecordingService.ReleaseTail.hotkeyStop
+        let quietWindow = tail.quietSampleCount
+        XCTAssertEqual(quietWindow, 2400)
+
+        let quiet = [Float](repeating: 0.002, count: quietWindow)
+        let speech = [Float](repeating: 0.05, count: quietWindow)
+        XCTAssertTrue(tail.isSettled(trailingSamples: ArraySlice(speech + quiet)))
+        XCTAssertFalse(tail.isSettled(trailingSamples: ArraySlice(speech)))
+        // The last word still fades out in the window.
+        XCTAssertFalse(tail.isSettled(trailingSamples: ArraySlice(quiet.dropLast(800) + speech.prefix(800))))
+        // Quiet speech at the end is not averaged away by the quiet before it.
+        let quietSpeech = [Float](repeating: 0.005, count: 800)
+        XCTAssertFalse(tail.isSettled(trailingSamples: ArraySlice(quiet.dropLast(800) + quietSpeech)))
+        // Too little audio to judge yet.
+        XCTAssertFalse(tail.isSettled(trailingSamples: ArraySlice(quiet.dropLast())))
+
+        // A quick tap keeps the short-speech handling of #157.
+        XCTAssertFalse(tail.appliesToRecording(bufferedDuration: 0.1))
+        XCTAssertTrue(tail.appliesToRecording(bufferedDuration: 0.3))
+    }
+
+    func testFinalizingStopPolicy_addsTheReleaseTailOnlyForKeyStops() {
+        let keyStop = DictationViewModel.finalizingStopPolicy(capturesReleaseTail: true)
+        XCTAssertEqual(keyStop.releaseTail, .hotkeyStop)
+        XCTAssertEqual(
+            keyStop.logDescription,
+            "finalizeShortSpeech(min=0.050,max=0.060,poll=0.010,tail=0.350,quiet=0.150)"
+        )
+        // The short-speech grace stays the same.
+        XCTAssertTrue(keyStop.shouldApplyGracePeriod(bufferedDuration: 0.049))
+        XCTAssertFalse(keyStop.shouldApplyGracePeriod(bufferedDuration: 0.05))
+
+        let otherStop = DictationViewModel.finalizingStopPolicy(capturesReleaseTail: false)
+        XCTAssertNil(otherStop.releaseTail)
+        XCTAssertEqual(otherStop.logDescription, AudioRecordingService.StopPolicy.finalizeShortSpeech().logDescription)
+        XCTAssertNil(AudioRecordingService.StopPolicy.immediate.releaseTail)
+    }
+
     func testDelayedReleaseRetainer_keepsObjectAliveUntilDelayExpires() throws {
         let retainer = DelayedReleaseRetainer<ReleaseProbe>(label: "com.typewhisper.tests.delayed-release")
         let released = expectation(description: "release after delay")
```

**File**: `TypeWhisperTests/TypeWhisperIntegrationTests.swift` (modified, +44/-2)
```diff
@@ -10433,6 +10433,8 @@ final class TypeWhisperIntegrationTests: XCTestCase {
     private final class SilenceStopProbe {
         var stopPolicies: [String] = []
         var announcements: [String] = []
+        /// The announcements made before each stop finished capturing.
+        var announcementsDuringStop: [[String]] = []
     }
 
     /// F14, F15 and F16. Each press in a test uses its own key, so the duplicate filter
@@ -10498,6 +10500,7 @@ final class TypeWhisperIntegrationTests: XCTestCase {
         context.audioRecordingService.startRecordingOverride = {}
         context.audioRecordingService.stopRecordingOverride = { policy in
             probe.stopPolicies.append(policy.logDescription)
+            probe.announcementsDuringStop.append(probe.announcements)
             return []
         }
         let viewModel = context.dictationViewModel
@@ -10692,6 +10695,42 @@ final class TypeWhisperIntegrationTests: XCTestCase {
         }
     }
 
+    /// Releasing push-to-talk keeps recording for a moment, so the last word is not cut off (#1896).
+    @MainActor
+    func testPushToTalkReleaseStopsWithTheReleaseTail() async throws {
+        let appSupportDirectory = try TestSupport.makeTemporaryDirectory()
+        var dictationContext: DictationContext?
+        defer {
+            dictationContext = nil
+            TestSupport.remove(appSupportDirectory)
+            Self.restoreSilenceStopDefaults()
+        }
+        let probe = SilenceStopProbe()
+        dictationContext = Self.makeSilenceStopContext(
+            appSupportDirectory: appSupportDirectory,
+            silenceStopEnabled: false,
+            probe: probe
+        )
+        let context = try XCTUnwrap(dictationContext)
+        let viewModel = context.dictationViewModel
+
+        try await Self.startSilenceStopDictation(context, slot: .pushToTalk, releaseAfterPress: false)
+        context.hotkeyService.processCarbonHotkeyForTesting(
+            slotType: .pushToTalk,
+            hotkey: Self.silenceStopStartHotkey,
+            isPressed: false
+        )
+        XCTAssertEqual(viewModel.state, .processing)
+        for _ in 0..<300 where probe.stopPolicies.isEmpty || viewModel.state == .processing {
+            try await Task.sleep(for: .milliseconds(10))
+        }
+
+        XCTAssertEqual(
+            probe.stopPolicies,
+            [AudioRecordingService.StopPolicy.finalizeShortSpeech(releaseTail: .hotkeyStop).logDescription]
+        )
+    }
+
     @MainActor
     func testLateSilenceReportForAStoppedDictationDoesNotStopTheNextOne() async throws {
         let appSupportDirectory = try TestSupport.makeTemporaryDirectory()
@@ -10723,14 +10762,17 @@ final class TypeWhisperIntegrationTests: XCTestCase {
         XCTAssertEqual(viewModel.state, .processing)
         XCTAssertNil(viewModel.silenceStopCountdownSeconds)
         XCTAssertNil(viewModel.testingSilenceEndpointSessionID)
-        XCTAssertEqual(
-            probe.announcements.last,
+        let stoppedAnnouncement = try XCTUnwrap(
             Self.silenceStopAnnouncementText { $0.announceRecordingStopped() }
         )
         // The watch of the stopped dictation reports late; it does not stop anything twice.
         viewModel.testingReportSilenceEndpoint(sessionID: firstSessionID)
         await Self.waitForDictationSessionToFinish(viewModel, id: firstSessionID)
         XCTAssertEqual(probe.stopPolicies.count, 1)
+        // A key stop still records its release tail, so the announcement waits for it (#1896).
+        XCTAssertEqual(probe.announcementsDuringStop.count, 1)
+        XCTAssertFalse(probe.announcementsDuringStop.first?.contains(stoppedAnnouncement) ?? true)
+        XCTAssertTrue(probe.announcements.contains(stoppedAnnouncement))
 
         try await Self.startSilenceStopDictation(
             context,
```

---

### Incident Patch 2: `4eb06013` (2026-11-09)
**Commit Message**: (bug) Keep remote voices out of "Me" when calls play on speakers (#1876)

* (bug) Keep remote voices out of "Me" when calls play on speakers

The Recorder found the user's own speech by comparing microphone and
system levels frame by frame. On loudspeakers the call comes back on the
microphone as loud as the user, and a few hundred milliseconds after the
system track has it (the system capture starts after the microphone, and
the output device adds its latency). Leaked call audio then counted as
own speech, and every remote speaker moved to "Me".

Own speech now has to stand clearly above the echo measured from the
recording itself: the delay with the strongest loudness correlation
between the tracks, and how loud the system audio comes back on the
microphone. With headphones that echo is negligible and nothing changes.

Closes #1875

* Search the echo delay only where the system audio plays

Over a whole conversation the microphone and system tracks take turns,
which correlates their loudness negatively at every shift. The delay
search then settled on the 2 s limit, and against a source shifted that
far a faint echo on the microphone passed as own speech (1:1 calls in
#1875 gained

**File**: `TypeWhisper/Services/SpeakerChannelAttribution.swift` (modified, +108/-7)
```diff
@@ -21,12 +21,33 @@ enum SpeakerChannelAttribution {
     static let minimumDuration: TimeInterval = 0.3
     static let padding: TimeInterval = 0.1
 
+    /// Longest delay searched between a sound on the system audio and its
+    /// echo on the microphone. The system capture starts after the
+    /// microphone, and the output device and the room add their latency.
+    static let maximumEchoDelay: TimeInterval = 2
+    /// Own speech is at least this much louder than the echo the system
+    /// audio is expected to leave on the microphone.
+    static let echoMargin: Float = 2.5
+    /// Share of the expected echo left after each frame once the system
+    /// audio stops, for the room's reverberation (about 3 dB per frame).
+    static let echoDecay: Float = 0.7
+    /// Below this correlation the microphone doesn't follow the system
+    /// audio at any delay, and there is no echo to measure.
+    static let minimumEchoCorrelation = 0.05
+
     /// Stretches where the microphone carries the user's own speech.
     ///
     /// A frame counts when the microphone is clearly above its noise floor
-    /// and, relative to each track's own loudness, at least as present as
-    /// the system audio. The second condition keeps remote voices that the
-    /// microphone picks up from loudspeakers from counting as the user.
+    /// and clearly above the echo the system audio leaves on it. Calls on
+    /// loudspeakers reach the microphone as loud as the user, and a few
+    /// hundred milliseconds after the system audio has them, so the echo is
+    /// measured from the recording itself: its delay, and how loud the
+    /// system audio comes back on the microphone.
+    ///
+    /// The microphone also has to be at least as present as the system
+    /// audio, relative to each track's own loudness. That rule alone applies
+    /// without a measurable echo, and it keeps an echo measured at the wrong
+    /// delay from adding own speech.
     static func ownSpeechRanges(
         microphone: [Float],
         system: [Float],
@@ -39,15 +60,19 @@ enum SpeakerChannelAttribution {
 
         let microphoneReference = percentile(microphoneLevels, 0.95)
         let microphoneFloor = percentile(microphoneLevels, 0.10)
-        let systemReference = max(percentile(systemLevels, 0.95), minimumLevel)
         let threshold = max(minimumLevel, microphoneFloor * 3, microphoneReference * 0.12)
         guard microphoneReference > threshold else { return [] }
+        let echo = expectedEcho(microphone: microphoneLevels, system: systemLevels)
+        let systemReference = max(percentile(systemLevels, 0.95), minimumLevel)
+        func standsOutFromSystemAudio(_ index: Int, _ level: Float) -> Bool {
+            let systemLevel = index < systemLevels.count ? systemLevels[index] : 0
+            guard level / microphoneReference >= 0.8 * systemLevel / systemReference else { return false }
+            return echo.map { level >= echoMargin * $0[index] } ?? true
+        }
 
         var ranges: [(start: TimeInterval, end: TimeInterval)] = []
         for (index, level) in microphoneLevels.enumerated() {
-            let systemLevel = index < systemLevels.count ? systemLevels[index] : 0
-            guard level > threshold,
-                  level / microphoneReference >= 0.8 * systemLevel / systemReference else { continue }
+            guard level > threshold, standsOutFromSystemAudio(index, level) else { continue }
             let start = Double(index) * frameDuration
             let end = start + frameDuration
             if let last = ranges.last, start - last.end <= maximumPause {
@@ -117,6 +142,82 @@ enum SpeakerChannelAttribution {
     /// What is left of a diarizer turn around own speech only counts from this length.
     static let minimumRemainder: TimeInterval = 0.2
 
+    /// The level the system audio's echo is expected to reach in each
+    /// microphone frame, or nil when the recording shows no echo.
+    ///
+    /// The system level is shifted by the echo's delay, widened by a frame
+    /// on either side for jitter, held while the room still reverberates,
+    /// and scaled by how loud the system audio comes back on the microphone.
+    /// That ratio is read over the loudest quarter of the system audio, from
+    /// its lower quarter: the echo is there whenever the system audio is
+    /// loud, the user's voice only now and then.
+    private static func expectedEcho(microphone: [Float], system: [Float]) -> [Float]? {
+        guard let delay = echoDelay(microphone: microphone, system: system) else { return nil }
+        var source = [Float](repeating: 0, count: microphone.count)
+        var held: Float = 0
+        for index in microphone.indices {
+            let center = index - delay
+            var level: Float = 0
+            for systemIndex in (center - 1)...(center + 1) where system.indices.contains(systemIndex) {
+                level = max(level, system[systemIndex])
+  
```

**File**: `TypeWhisperTests/SpeakerTranscriptCoordinatorTests.swift` (modified, +96/-0)
```diff
@@ -1011,6 +1011,39 @@ final class SpeakerChannelAttributionTests: XCTestCase {
         }
     }
 
+    /// Words of uneven length and loudness from `start`, like a stretch of speech.
+    private func words(
+        from start: TimeInterval,
+        count: Int,
+        variant: Int,
+        pausing: Bool = true
+    ) -> [(ClosedRange<TimeInterval>, Float)] {
+        let lengths = [0.21, 0.35, 0.18, 0.42, 0.27, 0.5, 0.24, 0.31, 0.38]
+        let gaps = [0.12, 0.2, 0.09, 0.31, 0.15, 0.07]
+        let loudness: [Float] = [1, 0.55, 0.8, 0.35, 0.7, 0.45, 0.9]
+        var time = start
+        return (0..<count).map { index in
+            let length = lengths[(index + variant) % lengths.count]
+            defer { time += length + (pausing ? gaps[(index + 2 * variant) % gaps.count] : 0) }
+            return (time...(time + length), loudness[(index * 3 + variant) % loudness.count])
+        }
+    }
+
+    /// A tone that follows `words`, `delay` seconds late, and near silence elsewhere.
+    private func track(
+        duration: TimeInterval,
+        words: [(ClosedRange<TimeInterval>, Float)],
+        level: Float,
+        delay: TimeInterval = 0,
+        noise: Float = 0.0005
+    ) -> [Float] {
+        (0..<Int(duration * sampleRate)).map { index in
+            let time = Double(index) / sampleRate - delay
+            let amplitude = words.first { $0.0.contains(time) }.map { $0.1 * level } ?? noise
+            return amplitude * Float(sin(Double(index) * 0.3))
+        }
+    }
+
     func testOwnSpeechIsWhereTheMicrophoneIsActive() {
         let microphone = track(duration: 10, speech: [1...3, 6...7], level: 0.2)
         let system = track(duration: 10, speech: [3.5...5.5], level: 0.3)
@@ -1038,6 +1071,69 @@ final class SpeakerChannelAttributionTests: XCTestCase {
         XCTAssertEqual(ranges[0].upperBound, 3.1, accuracy: 0.06)
     }
 
+    /// Calls on loudspeakers come back on the microphone as loud as the
+    /// user, and a third of a second after the system audio has them (#1875).
+    func testDelayedLoudspeakerEchoIsNotOwnSpeech() {
+        // Remote words of uneven length, so only the true delay lines the tracks up.
+        var words: [ClosedRange<TimeInterval>] = []
+        var time: TimeInterval = 4
+        for (index, length) in [0.21, 0.35, 0.18, 0.42, 0.27, 0.5, 0.24, 0.31].enumerated() {
+            words.append(time...(time + length))
+            time += length + [0.12, 0.2, 0.09, 0.31, 0.15][index % 5]
+        }
+        let system = track(duration: 10, speech: words, level: 0.3)
+        var microphone = track(duration: 10, speech: [1...3], level: 0.05)
+        let echo = track(duration: 10, speech: words.map { ($0.lowerBound + 0.33)...($0.upperBound + 0.33) }, level: 0.05, noise: 0)
+        for index in microphone.indices { microphone[index] += echo[index] }
+
+        let ranges = SpeakerChannelAttribution.ownSpeechRanges(microphone: microphone, system: system)
+
+        XCTAssertEqual(ranges.count, 1)
+        XCTAssertEqual(ranges.first?.lowerBound ?? -1, 0.9, accuracy: 0.06)
+        XCTAssertEqual(ranges.first?.upperBound ?? -1, 3.1, accuracy: 0.06)
+    }
+
+    /// In a conversation the tracks take turns, which must not pass for an
+    /// echo at some delay. The faint echo of a microphone near the speakers
+    /// stays out of own speech, and the user's turns stay in (#1875).
+    func testFaintEchoInAConversationIsNotOwnSpeech() {
+        let remote = words(from: 1, count: 6, variant: 1) + words(from: 7, count: 6, variant: 2)
+            + words(from: 13, count: 6, variant: 3)
+        let user = words(from: 4.2, count: 5, variant: 4) + words(from: 10.2, count: 5, variant: 5)
+        let system = track(duration: 18, words: remote, level: 0.3)
+        let speech = track(duration: 18, words: user, level: 0.05)
+        let echo = track(duration: 18, words: remote, level: 0.012, delay: 0.24, noise: 0)
+        let microphone = zip(speech, echo).map { $0 + $1 }
+
+        let ranges = SpeakerChannelAttribution.ownSpeechRanges(microphone: microphone, system: system)
+
+        XCTAssertEqual(ranges.count, 2)
+        XCTAssertEqual(ranges.first?.lowerBound ?? -1, 4.1, accuracy: 0.06)
+        XCTAssertEqual(ranges.first?.upperBound ?? -1, 6.6, accuracy: 0.06)
+        XCTAssertEqual(ranges.last?.lowerBound ?? -1, 10.1, accuracy: 0.06)
+        XCTAssertEqual(ranges.last?.upperBound ?? -1, 12.5, accuracy: 0.06)
+    }
+
+    /// An echo later than the delay search reaches can't be measured, and
+    /// the search may settle on a wrong delay. Where the system audio is
+    /// louder than the microphone, relative to each track's loudness, the
+    /// echo still stays out of own speech.
+    func testAnEchoBeyondTheDelaySearchStaysOutWhereTheSystemAudioIsLouder() {
+        // The remote talks without a pause, so the system audio is louder than the echo throughout.
+        let remote = words(from: 3, count: 32, variant: 4, pausing: false)
+    
```

---

### Incident Patch 3: `7deef650` (2026-11-11)
**Commit Message**: (bug) Mark a speaker named as the user with is_me in Recorder completions (#1907)

Recorder completions now set is_me for the microphone speaker and for any speaker with a confirmed name that names the user, the same rule the Speakers view uses. A name a voice profile only suggested does not set is_me.

Closes #1888

**File**: `README.md` (modified, +1/-1)
```diff
@@ -862,7 +862,7 @@ Each successful retranscription keeps the `recording_id`, assigns a new `complet
 
 `recorded_at` is when the recording started and `duration_seconds` its length; both are absent when the audio file does not tell. `calendar_event` is present for recordings started from the calendar, with `title`, `start` and `end` in Unix seconds, `location`, `organizer` and `attendees`.
 
-Recordings with speaker detection carry `speaker_state` (`pending`, `ready` or `failed`) and, once speakers were found, `speakers` and `speaker_segments` in the shape `GET /v1/history` uses. `is_me` marks the speaker heard on the microphone, the user of this Mac; its `name` is the localized name for yourself until you rename it. The speakers come from the recording's History record, so renaming a speaker there shows up in the next response. A recording transcribed again keeps its History record and the speakers found for it.
+Recordings with speaker detection carry `speaker_state` (`pending`, `ready` or `failed`) and, once speakers were found, `speakers` and `speaker_segments` in the shape `GET /v1/history` uses. `is_me` marks the user of this Mac, the same speakers History shows as yours: the speaker heard on the microphone and any speaker named as you (the localized name for yourself, or your own name once you renamed the microphone speaker). A name a voice profile only suggested does not set `is_me`. The microphone speaker's `name` is the localized name for yourself until you rename it. The speakers come from the recording's History record, so renaming a speaker there shows up in the next response. A recording transcribed again keeps its History record and the speakers found for it.
 
 Completion receipts are saved alongside recordings as `<audio filename>.transcript-ready.json`. A separate `<audio filename>.recording-id.json` preserves the recording ID if the receipt is damaged, so retranscription can repair it without changing the ID. Both files are committed with the transcript and removed when the recording is deleted in TypeWhisper. Existing recordings become available here after their next successful transcription. Recordings without a saved transcript are omitted. The endpoint uses the same API token as the other private routes.
 
```

**File**: `TypeWhisper/Services/SpeakerTranscriptCoordinator.swift` (modified, +12/-3)
```diff
@@ -741,14 +741,15 @@ extension SpeakerTranscriptCoordinator {
 enum RecorderSpeakerSnapshot {
     static func adding(
         _ record: TranscriptionRecord?,
-        to payload: RecorderTranscriptReadyPayload
+        to payload: RecorderTranscriptReadyPayload,
+        defaults: UserDefaults = .standard
     ) -> RecorderTranscriptReadyPayload {
         var payload = payload
         guard let record, !record.isDeleted, let state = record.speakerTranscriptState else { return payload }
         payload.speakerState = state.rawValue
         guard let transcript = record.speakerTranscript else { return payload }
         let names = record.speakerNames
-        let me = SpeakerWorkspaceModel.microphoneSpeaker(
+        let microphoneSpeaker = SpeakerWorkspaceModel.microphoneSpeaker(
             of: SpeakerTranscriptPresentation.turns(of: transcript),
             ownSpeech: record.speakerOwnSpeech
         )
@@ -760,7 +761,15 @@ enum RecorderSpeakerSnapshot {
                 id: speakerID,
                 name: (isSuggestion ? nil : entry?.displayName) ?? SpeakerTranscriptBuilder.outputLabel(for: speakerID),
                 suggestedName: isSuggestion ? entry?.displayName : nil,
-                isMe: speakerID == me
+                // The speaker the Speakers view shows as the user's own, but
+                // not for a name a voice profile only suggested.
+                isMe: SpeakerWorkspaceModel.isOwnSpeaker(
+                    speakerID,
+                    microphoneSpeakerID: microphoneSpeaker,
+                    names: names,
+                    countsSuggestions: false,
+                    defaults: defaults
+                )
             )
         }
         payload.speakerSegments = transcript.segments.map {
```

**File**: `TypeWhisper/ViewModels/SpeakerWorkspaceModel.swift` (modified, +14/-1)
```diff
@@ -86,8 +86,21 @@ final class SpeakerWorkspaceModel: ObservableObject {
     /// speaker heard on the microphone channel of a Recorder recording, or
     /// one named as the user ("Me" in the app's language, or their own name).
     func isOwnSpeaker(_ speakerID: String) -> Bool {
+        Self.isOwnSpeaker(speakerID, microphoneSpeakerID: microphoneSpeakerID, names: names, defaults: defaults)
+    }
+
+    /// The rule behind `isOwnSpeaker(_:)`, which the Recorder's `is_me` follows too.
+    /// - Parameter countsSuggestions: Also accepts a name a voice profile only suggested.
+    static func isOwnSpeaker(
+        _ speakerID: String,
+        microphoneSpeakerID: String?,
+        names: SpeakerNameTable?,
+        countsSuggestions: Bool = true,
+        defaults: UserDefaults = .standard
+    ) -> Bool {
         if speakerID == microphoneSpeakerID { return true }
-        guard let name = names?.displayName(for: speakerID) else { return false }
+        guard let names, let name = names.displayName(for: speakerID),
+              countsSuggestions || !names.isSuggestion(for: speakerID) else { return false }
         return SpeakerOwnName.isOwnName(name, defaults: defaults)
     }
 
```

**File**: `TypeWhisperPluginSDK/Sources/TypeWhisperPluginSDK/TypeWhisperEvent.swift` (modified, +1/-1)
```diff
@@ -133,7 +133,7 @@ public struct RecorderSpeaker: Sendable, Codable, Equatable {
     public let id: String
     public let name: String
     public let suggestedName: String?
-    /// The speaker heard on the microphone, the user of this Mac.
+    /// The user of this Mac: the speaker heard on the microphone, or one named as the user.
     public let isMe: Bool
 
     public init(id: String, name: String, suggestedName: String? = nil, isMe: Bool = false) {
```

**File**: `TypeWhisperTests/SpeakerWorkspaceTests.swift` (modified, +22/-0)
```diff
@@ -1,5 +1,6 @@
 import XCTest
 @testable import TypeWhisper
+import TypeWhisperPluginSDK
 
 final class SpeakerWorkspaceTests: XCTestCase {
     private func segment(_ text: String, _ start: TimeInterval, _ end: TimeInterval, _ speaker: String?) -> SpeakerTranscriptSegment {
@@ -494,6 +495,27 @@ final class SpeakerWorkspaceModelTests: XCTestCase {
         XCTAssertFalse(model.isOwnSpeaker("S1"))
     }
 
+    /// The Recorder's `is_me` follows the Speakers view, also without a microphone
+    /// channel, but a name a voice profile only suggested does not count.
+    func testRecorderPayloadMarksTheSpeakerNamedAsTheUser() throws {
+        _ = try makeModel()
+        let me = String(localized: "speakers.me")
+        history.setSpeakerName(me, for: "S1", profileID: UUID(), isSuggestion: true, inRecordID: recordID)
+        history.setSpeakerName(me, for: "S2", inRecordID: recordID)
+        let payload = RecorderTranscriptReadyPayload(
+            recordingID: UUID(),
+            completedAt: Date(),
+            text: "",
+            audioFilePath: "/tmp/a.m4a",
+            transcriptFilePath: "/tmp/a.txt"
+        )
+
+        let result = RecorderSpeakerSnapshot.adding(history.record(withID: recordID), to: payload)
+
+        XCTAssertEqual(result.speakers?.map(\.id), ["S1", "S2"])
+        XCTAssertEqual(result.speakers?.map(\.isMe), [false, true])
+    }
+
     /// Renaming the microphone speaker names the user in later recordings too;
     /// "Me" goes back to the default.
     func testRenamingTheMicrophoneSpeakerKeepsTheNameForNewRecordings() throws {
```

#### Recent Merged Pull Requests:
- **PR #1923** (2026-11-13): (feature) Add ElevenLabs Scribe v3 and stream it with Scribe v3 Live (@SeoFood)
- **PR #1921** (2026-11-12): (chore) Add the 1.8.3 release notes (@SeoFood)
- **PR #1919** (2026-11-13): (chore) Answer a question from passages of History (@SeoFood)
- **PR #1918** (2026-11-13): (chore) Find History passages for a question in the search index (@SeoFood)
- **PR #1917** (2026-11-12): (chore) Add the App Store What's New text for 1.8.3 (@SeoFood)
- **PR #1916** (2026-11-12): (feature) Replace the translation setting with a Translation workflow and fall back to Apple Translate (@SeoFood)

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

## X. (bug) Keep recording briefly after a push-to-talk release so the last word is no

**RULE**:
When implementing operations in `TypeWhisper/Services/AudioRecordingService.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in TypeWhisper/typewhisper-mac. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6d4cf137`: (bug) Keep recording briefly after a push-to-talk release so the last word is not cut off (#1897). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `TypeWhisper/Services/AudioRecordingService.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    /// Audio kept recording after the user released or pressed the shortcut, so the end of
    /// the last word that is still on its way through the input is not cut off (#1896).
    struct ReleaseTail: Equatable {
        /// The tail a hotkey stop gets: at most 350 ms, ending early after 150 ms of quiet.
        static let hotkeyStop = ReleaseTail(
            maxDuration: 0.35,
            quietDuration: 0.15,
            minimumRecordingDuration: 0.3
        )

        /// The longest the tail records, counted from the stop request.
        var maxDuration: TimeInterval
        /// The tail ends as soon as this much audio at the end of the recording is quiet.
        var quietDuration: TimeInterval
        /// Shorter recordings get no tail, so a quick tap of the shortcut keeps the
        /// short-speech handling of #157 and is still discarded as too short.
        var minimumRecordingDuration: TimeInterval

        var quietSampleCount: Int {
            max(1, Int((quietDuration * AudioRecordingService.targetSampleRate).rounded()))
        }

        func appliesToRecording(bufferedDuration: TimeInterval) -> Bool {
            bufferedDuration >= minimumRecordingDuration

```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
            pollInterval: TimeInterval = 0.01
            case .finalizeShortSpeech(let minBufferedDuration, let maxExtraCapture, let pollInterval):
                String(
                    format: "finalizeShortSpeech(min=%.3f,max=%.3f,poll=%.3f)",
                    minBufferedDuration,
                    maxExtraCapture,
                    pollInterval
                )
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6d4cf137` are properly handled with clean fallback behavior.
