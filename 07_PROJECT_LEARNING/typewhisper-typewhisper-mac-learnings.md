# Forensic Learning Record (Deep Inspection): TypeWhisper/typewhisper-mac

> **Canonical Artifact**: `07_PROJECT_LEARNING/typewhisper-typewhisper-mac-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/TypeWhisper/typewhisper-mac](https://github.com/TypeWhisper/typewhisper-mac))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:33:54.731Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TypeWhisper/typewhisper-mac`
- **Description**: Local speech-to-text for macOS  on-device AI, fully private, optional cloud
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1821 stars

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
    ]

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
        if nsError.domain == NSOSStatusErrorDomain {
            return OSStatus(nsError.code)
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
        route: AudioInputCaptureRoute,
        currentEngineDeviceID: AudioDeviceID?
    ) -> Bool {
        switch (armedInput, route) {
        case (.engine(let armedID), .avAudioEngine(let preferredDeviceID)):
            return preferredDeviceID == nil && currentEngineDeviceID == armedID
        case (.inputOnly(let armedID), .inputOnlyDevice(let routeID)):
            return armedID == routeID
        default:
            return false
        }
    }

    /// True when a prepared streaming input exists and does not match the selected route.
    static func shouldInvalidate(
        armedInput: ArmedInput?,
        route: AudioInputCaptureRoute,
        currentEngineDeviceID: AudioDeviceID?
    ) -> Bool {
        guard let armedInput else { return false }
        return !armedInputMa
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

    init(
        deviceId: String,
        historyOriginDeviceID: String? = nil,
        platform: String,
        appVersion: String,
        updatedAt: Date,
        name: String? = nil
    ) {
        self.deviceId = deviceId
        self.historyOriginDeviceID = historyOriginDeviceID
        self.platform = platform
        self.appVersion = appVersion
        self.updatedAt = updatedAt
        self.name = name
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
    let itemId: String
    let kind: Kind
    let updatedAt: Date
    let deletedAt: Date?
    let dictionary: UserDataSyncDictionaryEntry?
    let snippet: UserDataSyncSnippet?
    let historyPayloadVersion: Int?
    let historyGeneration: String?
    let historyComponent: UserDataSyncHistoryComponent?
    let historyContent: UserDataSyncHistoryContentV1?
    let historyInbox: UserDataSyncHistoryInboxV1?
    let historyAudio: UserDataSyncHistoryAudioV1?

    static func upsertDictionary(
        _ entry: UserDataSyncDictionaryEntry,
        itemID: String,
        deviceId: String,
        operationId: String = UUID().uuidString
    ) -> CloudFolderSyncOperation {
        CloudFolderSyncOperation(
            schemaVersion: 1,
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
        operationId: String = UUID().uuidString
    ) -> CloudFolderSyncOperation {
        let updatedAt = content?.updatedAt ?? inbox?.updatedAt ?? audio?.updatedAt ?? .distantPast
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
            historyAudio: audio
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
            schemaVersion: 1,
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
            historyComponent: nil,
            historyContent: nil,
            historyInbox: nil,
            historyAudio: nil
        )
    }

    static func deleteHistory(
        recordID: UUID,
        generation: String,
        deviceId: String,
        deletedAt: Date,
        operationId: String = UUID().uuidString
    ) -> CloudFolderSyncOperation {
        let itemID = UserDataSyncIdentity.historyItemID(recordID: recordID)
        return CloudFolderSyncOperation(
            schemaVersion: 1,
            operationId: operationId,
            deviceId: deviceId,
            collection: .history,
            itemId: itemID,
            kind: .delete,
            updatedAt: deletedAt,
            deletedAt: deletedAt,
            dictionary: nil,
            snippet: nil,
            historyPayloadVersion: 1,
            historyGeneration: generation,
            historyComponent: nil,
            historyContent: nil,
            historyInbox: nil,
      
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

### Core Architecture Module: `AppStore/Sources/AppStoreInputAccess.swift`
```
#if APPSTORE
import AppKit
import CoreGraphics

/// Keyboard and mouse access of the Mac App Store edition.
///
/// The App Sandbox has no access to the Accessibility API of other apps, Apple
/// Events or event-suppressing taps. Two TCC services remain available:
///
/// - PostEvent (`CGEvent.post`) pastes text with a synthetic Cmd+V and reads
///   selected text with Cmd+C. System Settings lists it under Accessibility.
/// - ListenEvent (listen-only event tap) observes modifier-only, Fn,
///   double-tap and mouse-button shortcuts. System Settings lists it under
///   Input Monitoring.
///
/// Carbon hotkeys need neither. Without PostEvent, text is copied to the
/// clipboard for a manual paste.
enum AppStoreInputAccess {
    /// Build-time switch for synthetic paste (`TYPEWHISPER_APPSTORE_AUTOPASTE`).
    /// A clipboard-only build never posts events, in case App Review rejects
    /// synthetic paste under guideline 2.4.5.
    static let isAutoPasteEnabled: Bool = {
        switch Bundle.main.object(forInfoDictionaryKey: "TypeWhisperAutoPasteEnabled") {
        case let value as Bool:
            return value
        case let value as String:
            return ["yes", "true", "1"].contains(value.lowercased())
        default:
            return false
        }
    }()

    static let accessibilitySettingsURL = URL(
        string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
    )
    static let inputMonitoringSettingsURL = URL(
        string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent"
    )

    /// Whether the app may post keyboard events to other apps.
    static var canPostEvents: Bool {
        isAutoPasteEnabled && CGPreflightPostEventAccess()
    }

    /// Whether the app may observe keyboard and mouse events of other apps.
    static var canListenToEvents: Bool {
        CGPreflightListenEventAccess()
    }

    /// Name of the System Settings list that holds PostEvent access. macOS 27
    /// renamed Privacy & Security > Accessibility to Device Control and Data Access.
    static var postEventSettingsName: String {
        if ProcessInfo.processInfo.isOperatingSystemAtLeast(OperatingSystemVersion(majorVersion: 27, minorVersion: 0, patchVersion: 0)) {
            return localizedAppText(
                "Device Control and Data Access",
                de: "Gerätesteuerung und Datenzugriff",
                ja: "デバイスの制御とデータへのアクセス",
                zh: "设备控制和数据访问"
            )
        }
        return localizedAppText("Accessibility", de: "Bedienungshilfen", ja: "アクセシビリティ", zh: "辅助功能")
    }

    static var listenEventSettingsName: String {
        localizedAppText("Input Monitoring", de: "Eingabeüberwachung", ja: "入力監視", zh: "输入监控")
    }

    /// Feedback after text was copied instead of pasted.
    static var manualPasteMessage: String {
        if isAutoPasteEnabled {
            return localizedAppText(
                "Copied to clipboard. Press ⌘V to paste, or allow TypeWhisper under \u{201C}\(postEventSettingsName)\u{201D} to paste automatically.",
                de: "In die Zwischenablage kopiert. Füge den Text mit ⌘V ein oder erlaube TypeWhisper unter „\(postEventSettingsName)“, um automatisch einzufügen."
            )
        }
        return localizedAppText(
            "Copied to clipboard. Press ⌘V to paste.",
            de: "In die Zwischenablage kopiert. Füge den Text mit ⌘V ein."
        )
    }

    /// Set once access was requested in this session. macOS may apply a newly
    /// granted Accessibility or Input Monitoring permission only after the app
    /// restarts, so the UI then offers a restart instead of waiting forever.
    nonisolated(unsafe) private(set) static var hasRequestedPostEventAccess = false
    nonisolated(unsafe) private(set) static var hasRequestedListenEventAccess = false

    /// Whether requested PostEvent access is still not in effect.
    static var postEventAccessPending: Bool {
        hasRequestedPostEventAccess && isAutoPasteEnabled && !CGPreflightPostEventAccess()
    }

    /// Whether requested ListenEvent access is still not in effect.
    static var listenEventAccessPending: Bool {
        hasRequestedListenEventAccess && !CGPreflightListenEventAccess()
    }

    /// Asks for PostEvent access. macOS 27 neither prompts for it nor lists a
    /// sandboxed app, so System Settings opens with a guide to drag the app in.
    @MainActor
    static func requestPostEventAccess() {
        guard isAutoPasteEnabled else { return }
        hasRequestedPostEventAccess = true
        guard !CGRequestPostEventAccess() else { return }
        openSettings(accessibilitySettingsURL)
        offerRestartOnReturn { postEventAccessPending }
    }

    /// Asks for ListenEvent access, opening System Settings with the same guide
    /// while it is missing.
    @MainActor
    static func requestListenEventAccess() {
        hasRequestedListenEventAccess = true
        guard !CGRequestListenEventAccess() else { return }
        openSettings(inputMonitoringSettingsURL)
        offerRestartOnReturn { listenEventAccessPending }
    }

    nonisolated(unsafe) private static var returnObserver: NSObjectProtocol?

    /// The running process cannot notice the grant: CoreGraphics caches its
    /// answer, so only a relaunched TypeWhisper gets it. When the user comes
    /// back from System Settings, ask once whether to restart.
    @MainActor
    private static func offerRestartOnReturn(isPending: @escaping @MainActor () -> Bool) {
        if let returnObserver {
            NotificationCenter.default.removeObserver(returnObserver)
        }
        returnObserver = NotificationCenter.default.addObserver(
            forName: NSApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { _ in
            MainActor.assumeIsolated {
                if let returnObserver {
                    NotificationCenter.default.removeObserver(returnObserver)
                }
                returnObserver = nil
                guard isPending() else { return }

                let alert = NSAlert()
                alert.messageText = localizedAppText(
                    "Did you turn on TypeWhisper?",
                    de: "Hast du TypeWhisper eingeschaltet?"
                )
                alert.informativeText = localizedAppText(
                    "macOS applies the permission after TypeWhisper restarts.",
                    de: "macOS übernimmt die Berechtigung erst nach einem Neustart von TypeWhisper."
                )
                alert.addButton(withTitle: localizedAppText("Restart TypeWhisper", de: "TypeWhisper neu starten"))
                alert.addButton(withTitle: localizedAppText("Later", de: "Später"))
                if alert.runModal() == .alertFirstButtonReturn {
                    ApplicationRelauncher.relaunch()
                }
            }
        }
    }

    private static func openSettings(_ url: URL?) {
        guard let url else { return }
        NSWorkspace.shared.open(url)
    }
}
#endif

```

### Core Architecture Module: `AppStore/Sources/AppStorePermissionRestartHint.swift`
```
#if APPSTORE
import AppKit
import SwiftUI

/// Shown when a requested input permission is still not in effect after the
/// user returned to TypeWhisper. macOS may apply a newly granted permission
/// only to a new process, so this offers the restart.
struct AppStorePermissionRestartHint: View {
    @ObservedObject var dictation: DictationViewModel
    let kind: AppStorePermissionRow.Kind

    private var isPending: Bool {
        switch kind {
        case .accessibility: AppStoreInputAccess.postEventAccessPending
        case .inputMonitoring: AppStoreInputAccess.listenEventAccessPending
        }
    }

    var body: some View {
        Group {
            if isPending {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(localizedAppText(
                        "Turned it on? Restart TypeWhisper to finish.",
                        de: "Eingeschaltet? Starte TypeWhisper neu, damit es wirkt."
                    ))
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                    Spacer()

                    Button(localizedAppText("Restart", de: "Neu starten")) {
                        ApplicationRelauncher.relaunch()
                    }
                    .controlSize(.small)
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            dictation.refreshInputPermissions()
        }
    }
}
#endif

```

### Core Architecture Module: `AppStore/Sources/AppStorePermissionRow.swift`
```
#if APPSTORE
import SwiftUI

/// A missing input permission of the App Store edition with a button that requests it.
struct AppStorePermissionRow: View {
    enum Kind {
        /// PostEvent access, listed under Accessibility in System Settings.
        case accessibility
        /// ListenEvent access, listed under Input Monitoring in System Settings.
        case inputMonitoring
    }

    enum TitleStyle {
        case short
        case explanatory
    }

    @ObservedObject var dictation: DictationViewModel
    let kind: Kind
    var titleStyle: TitleStyle = .explanatory
    var labelColor: Color?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                if let labelColor {
                    label.foregroundStyle(labelColor)
                } else {
                    label
                }

                Spacer()

                Button(String(localized: "Grant Access")) {
                    switch kind {
                    case .accessibility:
                        dictation.requestAccessibilityPermission()
                    case .inputMonitoring:
                        dictation.requestInputMonitoringPermission()
                    }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }

            AppStorePermissionRestartHint(dictation: dictation, kind: kind)
        }
    }

    private var label: some View {
        Label(title, systemImage: systemImage)
    }

    private var systemImage: String {
        switch kind {
        case .accessibility: "lock.shield"
        case .inputMonitoring: "keyboard"
        }
    }

    private var title: String {
        switch (kind, titleStyle) {
        case (.accessibility, .short):
            AppStoreInputAccess.postEventSettingsName
        case (.accessibility, .explanatory):
            localizedAppText(
                "\(AppStoreInputAccess.postEventSettingsName) needed to paste automatically",
                de: "\(AppStoreInputAccess.postEventSettingsName) zum automatischen Einfügen nötig"
            )
        case (.inputMonitoring, .short):
            AppStoreInputAccess.listenEventSettingsName
        case (.inputMonitoring, .explanatory):
            localizedAppText(
                "Input Monitoring needed for your shortcuts",
                de: "Eingabeüberwachung für deine Kurzbefehle nötig"
            )
        }
    }
}
#endif

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1501** (2026-10-05): **Vercel AI Gateway: microsoft/mai-transcribe-2 always fails with HTTP 400 Bad Request**
  *Symptoms*: ### Platform  macOS  ### Description  @SeoFood  With the Vercel AI Gateway plugin and `microsoft/mai-transcribe-2`, every transcription fails with `Transcription failed: API error: HTTP 400: Bad Request`. The same key and model work when the audio reaches the gateway as WAV, MP3 or FLAC.  What I found: - The plugin uploads a compressed M4A first (`VercelAIGatewayPlugin.swift:210`). It retries as WAV only when the error text reads like a format rejection (`HostServices.swift:784-798`, `:859-872`). *(read in code, main `a0541bb`)* - For M4A the gateway answers a bare `"Bad Request"` (`AI_APICallError`, routed to Azure), so the WAV retry never fires. *(measured via API)* - Microsoft lists WAV, MP3 and FLAC as the input formats for MAI-Transcribe ([docs](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/mai-transcribe), updated 2026-09-24). - The OpenRouter plugin already uploads WAV for this model (`OpenRouterPlugin.swift:180`, from #1289). *(read in code)*  Direct requests to `POST https://ai-gateway.vercel.sh/v4/ai/transcription-model`, same key, 2026-10-05 *(measured via API)*:  | audio | `mediaType` | model | result | |---|---|---|---| | 4.7 s clip, M4A, AAC 48 kbps mono 16 kHz (the plugin's encoder settings) | `audio/mp4`, `audio/m4a`, `audio/x-m4a` | `microsoft/mai-transcribe-2` | 400 `Bad Request` (each) | | a second M4A clip | `audio/mp4` | `microsoft/mai-transcribe-2` | 400 `Bad Request` | | the same M4A | `audio/mp4` | `google/gemini-3.5-transcribe` | 
  **Post-Mortem & Fix Analysis**:
  > @SeoFood  Thanks for 1.0.1. MAI-Transcribe-2 now works through the gateway for short audio: WAV, MP3 and M4A clips, and 5, 10, 20 and 30-min cuts of a meeting through `/v1/transcribe/local-file` *(observed)*.  The full 36-min meeting still fails. The gateway answers 413 and the app shows `Transcription failed: Audio file too large for the API.`  - The app's request body for that file was 104,704,448 bytes (CFNetwork log: `sent request, body S 104704448`, then `status 413`) *(observed)*. - The same audio as 16 kHz 16-bit WAV in a JSON body of 92,693,479 bytes returns 200 in 34 s. Write every `/` in that body as `\/` and it grows to 106,116,190 bytes, which gets 413 `FUNCTION_PAYLOAD_TOO_LARGE` *(measured via API, 2026-10-05)*. The gateway's cap is somewhere between those two sizes. - The base64 of this WAV contains 13.4 M `/` characters. `JSONSerialization` writes each one as `\/` (`VercelAIGatewayPlugin.swift:280`), which adds about 14 % to the body *(measured; code read on main `12a1f
  > @assanskiy Vercel AI Gateway plugin 1.0.2 is out and should handle the 36-minute meeting. Thanks for the size measurements, the fix follows them directly.  - MAI-Transcribe now gets 16-bit mono FLAC instead of WAV. It's lossless and about half the size. - Request bodies no longer escape `/` in the base64 audio. That saves about 14% for every model. - If the gateway still answers 413, recordings longer than 20 minutes are retried in chunks of up to 20 minutes, cut at quiet points.  With FLAC and the smaller body, one request should cover roughly 75 minutes. Anything longer goes through the chunked retry.  Speaker labels are tracked in #1504. With chunking, speaker IDs restart in each chunk, so that needs a decision before diarization ships.  Could you rerun the 36-minute meeting with 1.0.2, and a longer recording if you have one? 

- **Issue #1492** (2026-10-04): **A cut-off LLM reply (hit max tokens) gets pasted as if it were the full text**
  *Symptoms*: ### Platform macOS  ### Problem / Motivation A long dictation can get cut by the LLM step and the partial text pasted as the result. The Groq and Gemini LLM calls go through the shared chat helper with `max_tokens: 4096` (HostServices.swift), and nothing on main reads `finish_reason` (read in code).  I sent TypeWhisper's request shape (system + user message, `max_tokens` 4096, no temperature) with my Russian cleanup prompt to both my models (measured via API):  - Groq `qwen/qwen3.8-27b`, 3,064 words in: `finish_reason: "length"`, 1,974 words out, cut mid-word. - Gemini `gemini-3.1-flash-lite`, same input: `"length"`, 1,975 words out, cut mid-sentence. - With 1,529 words in, both finish normally.  So Russian output tops out near 2,000 words. Models that think by default share that budget: `gemini-3-flash-preview` spent 1,532 of 4,092 tokens on hidden thinking on the 1,529-word input and also stopped with `"length"`. OpenWhispr shipped a fix for the same thing in 1.10.1 (OpenWhispr/openwhispr#2092).  The raw transcript is still in History, but nothing flags the cut.  ### Proposed Solution Treat `finish_reason: "length"` as a failure: next fallback provider, or the raw transcript with a notice.  ### Alternatives Considered Raising `max_tokens` moves the limit. Segmented post-processing is a per-workflow switch I'd need to set before knowing a dictation runs long.  Drafted with help from Claude Code; measurements are API calls made on 2026-10-04. 

- **Issue #1486** (2026-10-04): **Gemini Live: up to 10 s wait after release, and a new socket on every dictation**
  *Symptoms*: ### Platform  macOS  ### Problem / Motivation  I'm moving my Russian dictation (⌥Space) to Gemini Live: `gemini-3.5-transcribe` with its live model, ru-RU, 63 dictionary terms as customVocabulary, Groq cleanup after. On 15 jargon-heavy Russian test phrases (TTS, my API script) Gemini Live got 2.1% WER with my vocabulary and 20.0% without; Groq whisper-large-v3-turbo without a prompt got 26.2%.  Reading the code before relying on it daily, two timing things stand out. Every press opens a new WebSocket and waits for `setupComplete` before the preview starts (StreamingHandler.swift ~144). And the finish can wait much longer than needed: in my API tests with a 3 s pause before release, 11 of 12 runs waited the full 10 s.  I think I see why. `finish()` (GeminiPlugin.swift ~1151–1176) waits up to `finishTimeout = .seconds(10)` for a new `inputTranscription` or a `turnComplete`. The live-transcribe model marks the end with `generationComplete`, which `ServerContent` doesn't decode. If I pause before releasing, the final text is already in, nothing follows `audioStreamEnd`, and the loop runs to the 10 s deadline.  ### Proposed Solution  Decode `generationComplete` as the end of the turn, also when it arrived just before release. Cap the wait at about 3 s from `audioStreamEnd`, and on timeout return the committed plus interim text instead of throwing.  Open the session on hotkey-down, or pre-open one after each dictation. Close it after a few idle minutes and replace it well before th
  **Post-Mortem & Fix Analysis**:
  > @SeoFood follow-ups from API tests against Gemini Live (my own script mirroring the plugin's protocol, Russian clips, not inside the app). Edited after re-measuring: two of my original points were wrong.  1. Empty results: on 2 short far-field clips Gemini returned empty text and the 10 s finish wait ran out. I first tied this to `generationComplete`, which was wrong. Re-run 5 times, the server sent nothing at all after `audioStreamEnd` for those clips, and the same happened with room noise only (6 of 6). A shorter cap covers this case; decoding `generationComplete` doesn't. 2. Withdrawn: the first-word point. With leading room noise, as in a real hotkey press, Gemini missed more first words, not fewer (26 vs 19 of 39). The misses were wake words it mishears whatever the onset.  Still stands: the plugin allows up to 1,000 vocabulary terms (`dictionaryTermsMaxCount`). Google's live-transcribe docs allow up to 1,000 phrases but give best results up to 100, and OpenWhispr caps at 100. A w
  > The fix in #1494 has passed CI and review and is being merged for Gemini plugin **1.1.2**. It bounds finalization to three seconds, uses settled completion events when safe, retains available transcript text on timeout, and prepares a fresh connection for the next dictation. It requires TypeWhisper 1.7.0 or newer; no host SDK upgrade is needed.  The plugin release is still pending. I will confirm here once the signed update is published and verified.  Thanks for updating the API measurements and withdrawing the first-word observation. The suggested vocabulary-quality warning above 100 terms remains a separate follow-up; it is not part of this latency fix. 
  > [Gemini plugin 1.1.2 is now published](https://github.com/TypeWhisper/typewhisper-mac/releases/tag/plugin-gemini-v1.1.2) and available through the plugin catalog.  The release contains #1494 and requires TypeWhisper 1.7.0 or newer on macOS 14 or newer. No Plugin SDK upgrade is required. The downloaded public ZIP passed signature and notarization checks, all 45 SDK imports resolve against the published TypeWhisper 1.7.0 SDK, and the bundle loads on both Intel and Apple Silicon. Both plugin registries now offer 1.1.2 to compatible hosts and retain the older releases for older hosts.  Finalization now uses settled completion when safe and otherwise falls back after three seconds, retaining available text. The next dictation can claim a fresh prepared connection with matching settings. The provider measurements and the distinction between digital silence and microphone background noise are documented in the PR. 

- **Issue #1462** (2026-10-02): **UX improvement for recovery recording deletion**
  *Symptoms*: ### Platform  macOS  ### Description  <img width="1246" height="158" alt="Image" src="https://github.com/user-attachments/assets/8a29eab4-2311-4a03-9dc8-26aa4825337b" />  See screenshot. On multiple recordings I only got one button to remove it. You have to select another recording in the dropdown list, then u have to click the button below to remove it. I was confused in first way, not ux friendly.   ### Steps to Reproduce  Go to recovery settings, see section recordings  ### Expected Behavior  Make all recordings as a list with a remove button in each row instead of current view.  ### OS Version  macOS 14.7.2  ### TypeWhisper Version  1.7.0  ### Diagnostics / Logs  ```shell  ```

- **Issue #1454** (2026-10-02): **Release workflow cannot update the Homebrew tap: direct push to main is rejected**
  *Symptoms*: ## Summary  The `update-homebrew` job of the release workflow failed for `v1.7.0`. It commits the new version and checksum and pushes straight to `main` of `TypeWhisper/homebrew-tap`, and that push is now rejected:  ``` remote: error: GH013: Repository rule violations found for refs/heads/main. remote: - Required status check "TypeWhisper CLA v1.0 (...)" is expected.  ! [remote rejected] main -> main (push declined due to repository rule violations) ```  Run: https://github.com/TypeWhisper/typewhisper-mac/actions/runs/37001413742  The GitHub release, the appcast, and the website were published before this job ran, so the release itself is complete. The failed job marks the whole workflow run as failed.  ## What was done for 1.7.0  The cask was updated by hand through TypeWhisper/homebrew-tap#4, where the CLA check and the cask validation ran and passed.  ## What needs to change  The next stable release will fail the same way. Options:  1. Let the job open a pull request in the tap and merge it once the required checks pass. 2. Add a bypass for the release token to the ruleset that requires the CLA check on the tap's `main`.  Option 1 keeps the cask validation in front of every update. 

- **Issue #1446** (2026-10-03): **Paste last transcription shortcut reports "Text inserted" but inserts nothing when the shortcut uses V**
  *Symptoms*: ## Summary  The `Paste last transcription shortcut` can show "Text inserted" while nothing is inserted into the focused field. Reported on Discord (#bug-reports) with two screen recordings from the Discord desktop app: the message box and the message edit box stay unchanged, the success popup still appears. Inserting the same entry through the recent transcriptions palette with Enter works.  The cause below comes from reading the code. It is not reproduced yet and depends on the reporter's shortcut, which is still unknown.  ## Findings  ### 1. The success popup is unconditional  `RecentTranscriptionPaletteHandler.insert` shows "Text inserted" as soon as `insertText` returns:  https://github.com/TypeWhisper/typewhisper-mac/blob/418b6cfb4/TypeWhisper/ViewModels/RecentTranscriptionPaletteHandler.swift#L93-L104  This path calls `insertText` without `awaitPasteVerification` and without `autoEnter`, so a synthetic paste returns `.pasted(verification: .notAwaited)`. The popup carries no information about whether the text landed.  ### 2. Likely cause: the hotkey tap swallows TypeWhisper's own ⌘V  The shortcut fires on key down, and `simulatePaste()` posts ⌘V a few milliseconds later, while the shortcut's key is still physically held.  For `.keyWithModifiers` hotkeys, `detectKeyEvent` treats every key down with the hotkey's key code as a repeat while `keyWasDown` is set, regardless of modifiers:  https://github.com/TypeWhisper/typewhisper-mac/blob/418b6cfb4/TypeWhisper/Services/Hotkey

- **Issue #1441** (2026-10-01): **Crash in window layout while recording with the Overlay indicator**
  *Symptoms*: ## Summary  The app aborted once while a dictation was recording with the Overlay indicator. The exception is the one described for the notch panel in #1229: `NSHostingView` resizes its window from `windowDidLayout`, AppKit raises from `_postWindowNeedsUpdateConstraints`, and the display-cycle observer rethrows.  ## Environment  - Dev build of `main` at `d677209275dc1c017679f2d6dfafdba179c1b49e` (includes #1409 and #1438) - macOS 27.0.1 (26A434), Apple silicon - Indicator style: Overlay - The machine was under heavy load at the time (load average around 90)  ## What happened  1. Dictated into TextEdit, then chose Last Transcription → Undo Last Dictation. The undo worked and its feedback was shown. 2. A few seconds later, started the next dictation through the local API. 3. The app aborted about three seconds into the recording, 65 seconds after launch.  The same sequence did not crash in 16 further dictations, including eight where the next dictation started while the undo feedback was still visible. I have one occurrence and no reliable reproduction.  ## Exception backtrace  ``` CoreFoundation  __exceptionPreprocess libobjc.A.dylib objc_exception_throw CoreFoundation  +[NSException exceptionWithName:reason:userInfo:] AppKit          -[NSWindow(NSDisplayCycle) _postWindowNeedsUpdateConstraints] AppKit          -[NSView _informContainerThatSubviewsNeedUpdateConstraints] AppKit          -[NSView setNeedsUpdateConstraints:] SwiftUI         NSHostingView.setNeedsUpdate() SwiftUI 

- **Issue #1437** (2026-10-01): **Rate limit exceeded msg on zero balance**
  *Symptoms*: ### Platform  macOS  ### Description  On zero balance the info msg is too general. (Not a real bug, just a improvement)  <img width="466" height="83" alt="Image" src="https://github.com/user-attachments/assets/10491e37-0323-457e-8d79-2d2c7ed99bf5" />  ### Steps to Reproduce  Open Typewhisper, get api key with zero balance on this trigger type whisper and speak, see the screenshot  ### Expected Behavior  Better naming (at least inform the user that this could be a problem with credit balance). I know that open ai respond with this on zero balance, so you can't really divide into real rate limiting or just zero balance. But maybe some other users don't know.  ### OS Version  Mac OS 14.7.2  ### TypeWhisper Version  1.6.1  ### Diagnostics / Logs  ```shell  ```

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

### Incident Patch 1: `59614d28` (2026-10-05)
**Commit Message**: Name Debug builds TypeWhisper Dev.app and use the macOS 27 Device Control pane name (#1506)

* Name the Debug app TypeWhisper Dev.app

Debug builds already use their own bundle ID (com.typewhisper.mac.dev),
but the bundle was still called TypeWhisper.app. macOS privacy lists show
the bundle file name, so a Debug build and the release app were
indistinguishable there.

Set PRODUCT_NAME to "TypeWhisper Dev" for the Debug configuration only
and pin PRODUCT_MODULE_NAME to TypeWhisper so `@testable import
TypeWhisper`, the bridging header and TypeWhisper-Swift.h keep working.
Point the Debug TEST_HOST at the renamed executable. Release still
produces TypeWhisper.app.

Update the dev build script (including its process matching, which still
recognizes pre-rename dev builds), the screenshot lane and CONTRIBUTING.

* Name the macOS 27 Device Control and Data Access pane in permission hints

macOS 27 renamed System Settings > Privacy & Security > Accessibility to
"Device Control and Data Access". Permission hints that send users to the
Accessibility pane pointed at a pane that no longer exists under that name.

Add AccessibilityPermissionPane, which picks the pane name and related
texts for

**File**: `CONTRIBUTING.md` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@ echo 'DEVELOPMENT_TEAM = YOUR_TEAM_ID' > CodeSigning.local.xcconfig
 - **Contributor machine:** macOS 15.0+ recommended for the current Xcode toolchain
 - **Swift 6** with strict concurrency
 - Debug builds use a separate data directory (`TypeWhisper-Dev`) and keychain prefix, so they don't interfere with release builds
+- Debug builds produce `TypeWhisper Dev.app` (bundle ID `com.typewhisper.mac.dev`, Swift module still `TypeWhisper`), so macOS privacy lists show them separately from the release `TypeWhisper.app`
 
 ## Pull Requests
 
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -217,7 +217,7 @@ Installed builds can switch channels in `Settings -> About` via the `Update Chan
 ## Quick Start
 
 1. Install TypeWhisper from Homebrew or the latest DMG.
-2. Open Settings and grant Microphone plus Accessibility access.
+2. Open Settings and grant Microphone plus Accessibility access (System Settings > Privacy & Security > Accessibility, named Device Control and Data Access on macOS 27 and later).
 3. Pick an engine and, if needed, download a local model.
 4. Trigger the global hotkey and complete your first dictation.
 
```

**File**: `TypeWhisper.xcodeproj/project.pbxproj` (modified, +11/-2)
```diff
@@ -140,6 +140,7 @@
 		91B4D7E2C5A809F1632E4B7C /* PluginRegistryServiceTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 91B4D7E2C5A809F1632E4B7D /* PluginRegistryServiceTests.swift */; };
 		545000000000000000000002 /* SetupWizardRecommendationAvailabilityTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 545000000000000000000001 /* SetupWizardRecommendationAvailabilityTests.swift */; };
 		545000000000000000000004 /* SetupWizardTrialSignalTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 545000000000000000000003 /* SetupWizardTrialSignalTests.swift */; };
+		AA00000000000000000367 /* AccessibilityPermissionPaneTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000367 /* AccessibilityPermissionPaneTests.swift */; };
 		91B4D7E2C5A809F1632E4B7E /* StreamingHandlerTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 91B4D7E2C5A809F1632E4B7F /* StreamingHandlerTests.swift */; };
 		9A584149706C7567496E0100 /* XAIPluginTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9A584149706C7567496E0101 /* XAIPluginTests.swift */; };
 		9A584149706C7567496E0200 /* XAIPlugin.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9A584149706C7567496E0210 /* XAIPlugin.swift */; };
@@ -206,6 +207,7 @@
 		AA00000000000000000030 /* AudioRecordingService.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000030 /* AudioRecordingService.swift */; };
 		AA00000000000000000031 /* HotkeyService.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000031 /* HotkeyService.swift */; };
 		AA00000000000000000362 /* SecureInputDiagnostics.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000362 /* SecureInputDiagnostics.swift */; };
+		AA00000000000000000366 /* AccessibilityPermissionPane.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000366 /* AccessibilityPermissionPane.swift */; };
 		CC88800000000000000001 /* ClamshellStateProvider.swift in Sources */ = {isa = PBXBuildFile; fileRef = CC88800000000000000002 /* ClamshellStateProvider.swift */; };
 		AA00000000000000000361 /* ClipboardContentFormatter.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000361 /* ClipboardContentFormatter.swift */; };
 		AA00000000000000000032 /* TextInsertionService.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000032 /* TextInsertionService.swift */; };
@@ -816,6 +818,7 @@
 		BB00000000000000000030 /* AudioRecordingService.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AudioRecordingService.swift; sourceTree = "<group>"; };
 		BB00000000000000000031 /* HotkeyService.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = HotkeyService.swift; sourceTree = "<group>"; };
 		BB00000000000000000362 /* SecureInputDiagnostics.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SecureInputDiagnostics.swift; sourceTree = "<group>"; };
+		BB00000000000000000366 /* AccessibilityPermissionPane.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AccessibilityPermissionPane.swift; sourceTree = "<group>"; };
 		CC88800000000000000002 /* ClamshellStateProvider.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ClamshellStateProvider.swift; sourceTree = "<group>"; };
 		BB00000000000000000361 /* ClipboardContentFormatter.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ClipboardContentFormatter.swift; sourceTree = "<group>"; };
 		BB00000000000000000032 /* TextInsertionService.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = TextInsertionService.swift; sourceTree = "<group>"; };
@@ -1197,6 +1200,7 @@
 		91B4D7E2C5A809F1632E4B7D /* PluginRegistryServiceTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = PluginRegistryServiceTests.swift; sourceTree = "<group>"; };
 		545000000000000000000001 /* SetupWizardRecommendationAvailabilityTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = SetupWizardRecommendationAvailabilityTests.swift; sourceTree = "<group>"; };
 		545000000000000000000003 /* SetupWizardTrialSignalTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = SetupWizardTrialSignalTests.swift; sourceTree = "<group>"; };
+		BB00000000000000000367 /* AccessibilityPermissionPaneTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = AccessibilityPermissionPaneTests.swift; sourceTree = "<group>"; };
 		D4A100000000000000000004 /* RecorderTranscriptionBufferTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = RecorderTranscriptionBufferTests.swift; sourceTree = "<group>"; };
 		91B4D7E2C5A809F1632E4B7F /* StreamingHandlerTests
```

**File**: `TypeWhisper/Services/AccessibilityPermissionPane.swift` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+import Foundation
+
+/// User-facing naming for the System Settings > Privacy & Security pane that
+/// grants the Accessibility (AX) permission.
+///
+/// macOS 27 renamed the pane from "Accessibility" to "Device Control and Data
+/// Access". The permission and the AX API are unchanged, so only texts that tell
+/// the user where to enable TypeWhisper should use this helper.
+enum AccessibilityPermissionPane {
+    /// The major macOS version that introduced the "Device Control and Data Access" name.
+    static let deviceControlRenameMajorVersion = 27
+
+    static func usesDeviceControlName(
+        osVersion: OperatingSystemVersion = ProcessInfo.processInfo.operatingSystemVersion
+    ) -> Bool {
+        osVersion.majorVersion >= deviceControlRenameMajorVersion
+    }
+
+    /// Picks the text that matches the pane name on the running macOS version.
+    static func text(
+        legacy: @autoclosure () -> String,
+        deviceControl: @autoclosure () -> String,
+        osVersion: OperatingSystemVersion = ProcessInfo.processInfo.operatingSystemVersion
+    ) -> String {
+        usesDeviceControlName(osVersion: osVersion) ? deviceControl() : legacy()
+    }
+
+    /// The pane name as shown in System Settings > Privacy & Security.
+    static func localizedName(
+        osVersion: OperatingSystemVersion = ProcessInfo.processInfo.operatingSystemVersion
+    ) -> String {
+        text(
+            legacy: String(localized: "Accessibility"),
+            deviceControl: localizedAppText(
+                "Device Control and Data Access",
+                de: "Gerätesteuerung und Datenzugriff",
+                ja: "デバイスの制御とデータへのアクセス",
+                zh: "设备控制和数据访问"
+            ),
+            osVersion: osVersion
+        )
+    }
+
+    /// Short status line shown when the permission is missing.
+    static func accessRequiredText(
+        osVersion: OperatingSystemVersion = ProcessInfo.processInfo.operatingSystemVersion
+    ) -> String {
+        text(
+            legacy: String(localized: "Accessibility access required"),
+            deviceControl: localizedAppText(
+                "Device Control and Data Access permission required",
+                de: "Berechtigung „Gerätesteuerung und Datenzugriff“ erforderlich",
+                ja: "「デバイスの制御とデータへのアクセス」の権限が必要です",
+                zh: "需要“设备控制和数据访问”权限"
+            ),
+            osVersion: osVersion
+        )
+    }
+
+    /// Full instruction naming the System Settings path to the pane.
+    static func enableInSystemSettingsText(
+        osVersion: OperatingSystemVersion = ProcessInfo.processInfo.operatingSystemVersion
+    ) -> String {
+        text(
+            legacy: localizedAppText(
+                "Accessibility permission not granted. Please enable it in System Settings → Privacy & Security → Accessibility.",
+                de: "Die Berechtigung für Bedienungshilfen wurde nicht erteilt. Bitte aktiviere sie unter Systemeinstellungen → Datenschutz & Sicherheit → Bedienungshilfen.",
+                ja: "アクセシビリティの権限が許可されていません。システム設定 → プライバシーとセキュリティ → アクセシビリティで有効にしてください。",
+                zh: "未授予辅助功能权限。请在“系统设置”→“隐私与安全性”→“辅助功能”中启用。"
+            ),
+            deviceControl: localizedAppText(
+                "Device Control and Data Access permission not granted. Please enable it in System Settings → Privacy & Security → Device Control and Data Access.",
+                de: "Die Berechtigung „Gerätesteuerung und Datenzugriff“ wurde nicht erteilt. Bitte aktiviere sie unter Systemeinstellungen → Datenschutz & Sicherheit → Gerätesteuerung und Datenzugriff.",
+                ja: "「デバイスの制御とデータへのアクセス」の権限が許可されていません。システム設定 → プライバシーとセキュリティ → デバイスの制御とデータへのアクセスで有効にしてください。",
+                zh: "未授予“设备控制和数据访问”权限。请在“系统设置”→“隐私与安全性”→“设备控制和数据访问”中启用。"
+            ),
+            osVersion: osVersion
+        )
+    }
+}
```

**File**: `TypeWhisper/Services/TextInsertionService.swift` (modified, +1/-1)
```diff
@@ -323,7 +323,7 @@ final class TextInsertionService {
         var errorDescription: String? {
             switch self {
             case .accessibilityNotGranted:
-                "Accessibility permission not granted. Please enable it in System Settings → Privacy & Security → Accessibility."
+                AccessibilityPermissionPane.enableInSystemSettingsText()
             case .pasteFailed(let detail):
                 "Failed to paste text: \(detail)"
             }
```

**File**: `TypeWhisper/ViewModels/DictationViewModel.swift` (modified, +11/-3)
```diff
@@ -2452,9 +2452,17 @@ final class DictationViewModel: ObservableObject {
 
     private func ensureSubmitKeySuppressionAvailable() -> Bool {
         guard effectiveAutoEnterMode == .duringDictation, !hotkeyService.canSuppressExternalKeyEvents else { return true }
-        let message = localizedAppText(
-            "Enter submission is unavailable. Check Accessibility access and restart TypeWhisper, or choose another Enter option.",
-            de: "Absenden mit Enter ist nicht verfügbar. Prüfe die Bedienungshilfen und starte TypeWhisper neu oder wähle eine andere Enter-Option."
+        let message = AccessibilityPermissionPane.text(
+            legacy: localizedAppText(
+                "Enter submission is unavailable. Check Accessibility access and restart TypeWhisper, or choose another Enter option.",
+                de: "Absenden mit Enter ist nicht verfügbar. Prüfe die Bedienungshilfen und starte TypeWhisper neu oder wähle eine andere Enter-Option."
+            ),
+            deviceControl: localizedAppText(
+                "Enter submission is unavailable. Check the Device Control and Data Access permission and restart TypeWhisper, or choose another Enter option.",
+                de: "Absenden mit Enter ist nicht verfügbar. Prüfe die Berechtigung „Gerätesteuerung und Datenzugriff“ und starte TypeWhisper neu oder wähle eine andere Enter-Option.",
+                ja: "Enter キーで送信できません。「デバイスの制御とデータへのアクセス」の権限を確認して TypeWhisper を再起動するか、別の Enter オプションを選択してください。",
+                zh: "无法使用 Enter 发送。请检查“设备控制和数据访问”权限并重启 TypeWhisper，或选择其他 Enter 选项。"
+            )
         )
         abortActiveRecordingImmediately(sessionMessage: message)
         showError(message, category: "recording")
```

**File**: `TypeWhisper/Views/HomeSettingsView.swift` (modified, +1/-1)
```diff
@@ -337,7 +337,7 @@ struct HomeSettingsView: View {
             if dictation.needsAccessibilityPermission {
                 HStack {
                     Label(
-                        String(localized: "Accessibility access required"),
+                        AccessibilityPermissionPane.accessRequiredText(),
                         systemImage: "lock.shield"
                     )
                     Spacer()
```

**File**: `TypeWhisper/Views/SettingsView.swift` (modified, +2/-2)
```diff
@@ -1361,7 +1361,7 @@ struct RecordingSettingsView: View {
                     if dictation.needsAccessibilityPermission {
                         HStack {
                             Label(
-                                String(localized: "Accessibility"),
+                                AccessibilityPermissionPane.localizedName(),
                                 systemImage: "lock.shield"
                             )
                             .foregroundStyle(.orange)
@@ -1548,7 +1548,7 @@ struct PermissionsBanner: View {
             if dictation.needsAccessibilityPermission {
                 HStack {
                     Label(
-                        String(localized: "Accessibility access required"),
+                        AccessibilityPermissionPane.accessRequiredText(),
                         systemImage: "lock.shield"
                     )
                     .foregroundStyle(.red)
```

---

### Incident Patch 2: `50707251` (2026-10-04)
**Commit Message**: Fix Gemini Live finalization and prewarm the next dictation (#1494)

Bound Gemini Live finalization to three seconds and prewarm a fresh configuration-matched session after each successful dictation. Preserve available text on timeout and reject stale sessions after settings changes.

**File**: `TypeWhisperPluginSDK/Plugins/GeminiPlugin/GeminiPlugin.swift` (modified, +475/-123)
```diff
@@ -60,6 +60,7 @@ final class GeminiPlugin: NSObject,
         var llmTemperatureValue = 0.3
         var fetchedLLMModels: [GeminiFetchedModel] = []
         var fetchedTranscriptionModels: [GeminiFetchedTranscriptionModel] = []
+        var liveSessionPool: GeminiLiveSessionPool? = GeminiLiveSessionPool()
     }
 
     private let state = OSAllocatedUnfairLock(initialState: State())
@@ -96,13 +97,25 @@ final class GeminiPlugin: NSObject,
         set { state.withLock { $0.fetchedTranscriptionModels = newValue } }
     }
     private var modelCatalogRefreshTask: Task<Void, Never>?
+    typealias LiveSessionCheckout = @Sendable (
+        GeminiLiveSessionPool, GeminiLiveConfiguration, @Sendable @escaping (String) -> Bool
+    ) async throws -> GeminiLiveTranscriptionSession
+    private let liveSessionCheckout: LiveSessionCheckout
 
     private let chatHelper = PluginOpenAIChatHelper(
         baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
         chatEndpoint: "/chat/completions"
     )
 
     required override init() {
+        liveSessionCheckout = { pool, configuration, onProgress in
+            try await pool.checkout(configuration: configuration, onProgress: onProgress)
+        }
+        super.init()
+    }
+
+    init(liveSessionCheckout: @escaping LiveSessionCheckout) {
+        self.liveSessionCheckout = liveSessionCheckout
         super.init()
     }
 
@@ -139,13 +152,15 @@ final class GeminiPlugin: NSObject,
             host: host
         )
         normalizeSelectedModel()
+        resetLiveSessionPool()
         refreshModelCatalogIfNeeded()
     }
 
     func deactivate() {
         modelCatalogRefreshTask?.cancel()
         modelCatalogRefreshTask = nil
         host = nil
+        resetLiveSessionPool()
     }
 
     // MARK: - LLMProviderPlugin
@@ -298,7 +313,9 @@ final class GeminiPlugin: NSObject,
         let resolvedModelId = supportedIds.contains(trimmedModelId)
             ? trimmedModelId
             : Self.defaultTranscriptionModelId
+        let modelChanged = selectedModelId != resolvedModelId
         _selectedTranscriptionModelId = resolvedModelId
+        if modelChanged { resetLiveSessionPool() }
         host?.setUserDefault(resolvedModelId, forKey: Self.selectedTranscriptionModelKey)
         host?.notifyCapabilitiesChanged()
     }
@@ -310,7 +327,12 @@ final class GeminiPlugin: NSObject,
     }
 
     func setTranscriptionMode(_ mode: GeminiTranscriptionMode) {
-        state.withLock { $0.transcriptionMode = mode }
+        let changed = state.withLock {
+            let changed = $0.transcriptionMode != mode
+            $0.transcriptionMode = mode
+            return changed
+        }
+        if changed { resetLiveSessionPool() }
         host?.setUserDefault(mode.rawValue, forKey: Self.transcriptionModeKey)
     }
 
@@ -462,10 +484,14 @@ final class GeminiPlugin: NSObject,
         guard !translate else {
             throw PluginTranscriptionError.apiError("Gemini speech transcription does not support translation yet.")
         }
-        guard let apiKey = _apiKey, !apiKey.isEmpty else {
+        let snapshot = state.withLock {
+            (apiKey: $0.apiKey, modelId: $0.selectedTranscriptionModelId ?? Self.defaultTranscriptionModelId,
+             mode: $0.transcriptionMode, pool: $0.liveSessionPool)
+        }
+        guard let apiKey = snapshot.apiKey, !apiKey.isEmpty else {
             throw PluginTranscriptionError.notConfigured
         }
-        guard let liveModelId = liveTranscriptionModelId(for: selectedModelId) else {
+        guard let liveModelId = liveTranscriptionModelId(for: snapshot.modelId) else {
             throw PluginTranscriptionError.apiError("The selected Gemini model does not support live transcription.")
         }
 
@@ -475,14 +501,22 @@ final class GeminiPlugin: NSObject,
             budget: dictionaryTermsBudget
         ).map(\.text)
 
-        return try await GeminiLiveTranscriptionSession.connect(
+        let configuration = GeminiLiveConfiguration(
             apiKey: apiKey,
             modelId: liveModelId,
-            mode: transcriptionMode,
+            mode: snapshot.mode,
             languageCodes: Self.resolvedLanguageCodes(from: languageSelection),
-            customVocabulary: vocabulary,
-            onProgress: onProgress
+            customVocabulary: vocabulary
         )
+        guard let pool = snapshot.pool else {
+            throw CancellationError()
+        }
+        let session = try await liveSessionCheckout(pool, configuration, onProgress)
+        guard state.withLock({ $0.liveSessionPool === pool }) else {
+            await session.cancel()
+            throw CancellationError()
+        }
+        return session
     }
 
     nonisolated static func resolvedLanguageCodes(
@@ -816,7 +850,9 @@ final class GeminiPlugin: NSObject,
 
     // Internal methods for settings
     func setApiKey(_ key: String) {
+        let changed = _apiKey != key
         _apiKey 
```

**File**: `TypeWhisperPluginSDK/Plugins/GeminiPlugin/Tests/GeminiLiveProviderTests.swift` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+import AVFoundation
+import Foundation
+import os
+import XCTest
+@testable import GeminiPlugin
+
+/// Opt-in provider smoke using synthetic 16 kHz mono WAV fixtures. Credentials
+/// come from the test process environment and are never printed by this test.
+final class GeminiLiveProviderTests: XCTestCase {
+    func testLiveProviderColdAndWarmDictations() async throws {
+        let environment = ProcessInfo.processInfo.environment
+        guard environment["TYPEWHISPER_GEMINI_LIVE_TEST"] == "1",
+              let apiKey = environment["TYPEWHISPER_GEMINI_LIVE_API_KEY"], !apiKey.isEmpty,
+              let firstPath = environment["TYPEWHISPER_GEMINI_LIVE_FIRST_WAV"],
+              let secondPath = environment["TYPEWHISPER_GEMINI_LIVE_SECOND_WAV"] else {
+            throw XCTSkip("Opt-in Gemini provider test requires an API key and two synthetic WAV fixtures.")
+        }
+        // Fixture sentences: "Blue umbrellas keep the rain away."
+        // and "Seven orange bicycles are waiting outside."
+        let fixtures = try [firstPath, secondPath].map(Self.samples)
+        let trailingSilenceSeconds = Double(environment["TYPEWHISPER_GEMINI_LIVE_SILENCE_SECONDS"] ?? "1") ?? 1
+        guard (0...5).contains(trailingSilenceSeconds) else {
+            throw XCTSkip("Synthetic trailing silence must be between zero and five seconds.")
+        }
+        for mode in [GeminiTranscriptionMode.verbatim, .smart] {
+            let sockets = OSAllocatedUnfairLock(initialState: [GeminiRecordingWebSocket]())
+            let pool = GeminiLiveSessionPool { configuration in
+                let socket = try GeminiRecordingWebSocket(apiKey: configuration.apiKey)
+                sockets.withLock { $0.append(socket) }
+                return try await GeminiLiveTranscriptionSession.connect(
+                    apiKey: configuration.apiKey, modelId: configuration.modelId, mode: configuration.mode,
+                    languageCodes: configuration.languageCodes, customVocabulary: configuration.customVocabulary,
+                    socket: socket
+                )
+            }
+            let configuration = GeminiLiveConfiguration(
+                apiKey: apiKey, modelId: "gemini-3.5-transcribe-live", mode: mode,
+                languageCodes: ["en-US"], customVocabulary: ["TypeWhisper"]
+            )
+            do {
+                for index in fixtures.indices {
+                    let connectStart = ContinuousClock.now
+                    let session = try await pool.checkout(configuration: configuration, onProgress: { _ in true })
+                    let connectDuration = connectStart.duration(to: .now)
+                    let socket = sockets.withLock { $0[index] }
+                    // Send at microphone cadence, including trailing silence to
+                    // exercise provider completion before hotkey release.
+                    let samples = fixtures[index] + [Float](repeating: 0, count: Int(16_000 * trailingSilenceSeconds))
+                    for offset in stride(from: 0, to: samples.count, by: 1_600) {
+                        try await session.appendAudio(samples: Array(samples[offset..<min(offset + 1_600, samples.count)]))
+                        try await Task.sleep(for: .milliseconds(100))
+                    }
+                    let eventsBeforeRelease = socket.events
+                    let finishStart = ContinuousClock.now
+                    let result = try await session.finish()
+                    let finishDuration = finishStart.duration(to: .now)
+                    print("[Gemini live] mode=\(mode.rawValue) dictation=\(index + 1) connect=\(connectDuration) finish=\(finishDuration) beforeRelease=\(eventsBeforeRelease) events=\(socket.events) text=\(result.text)")
+                    XCTAssertLessThan(finishDuration, .milliseconds(3_300))
+                    if eventsBeforeRelease.contains("generationComplete") || eventsBeforeRelease.contains("turnComplete") {
+                        XCTAssertLessThan(finishDuration, .milliseconds(750), "Digital silence after completion must not trigger the timeout")
+                    }
+                    XCTAssertTrue(result.text.lowercased().contains(index == 0 ? "umbrella" : "bicycle"))
+                    XCTAssertFalse(result.text.lowercased().contains(index == 0 ? "bicycle" : "umbrella"))
+                    if index == 0 {
+                        let deadline = ContinuousClock.now.advanced(by: .seconds(10))
+                        while !sockets.withLock({ $0.count > 1 && $0[1].setupComplete }), ContinuousClock.now < deadline {
+                            try await Task.sleep(for: .milliseconds(25))
+                        }
+                        XCTAssertTrue(sockets.withLock { $0.count == 2 && $0[1].setupComplete })
+                    } else {
+                        XCTAssertLessThan(connectDuration, .milliseconds(100), "The second dictation must use the ready connection")
+    
```

**File**: `TypeWhisperPluginSDK/Plugins/GeminiPlugin/Tests/GeminiLiveSessionPoolTests.swift` (added, +288/-0)
```diff
@@ -0,0 +1,288 @@
+import Foundation
+import os
+import XCTest
+import TypeWhisperPluginSDK
+@testable import GeminiPlugin
+
+final class GeminiLiveSessionPoolTests: XCTestCase {
+    func testSuccessfulDictationPreparesFreshSessionWithoutTranscriptCarryover() async throws {
+        let factory = GeminiTestSessionFactory()
+        let pool = GeminiLiveSessionPool(factory: factory.connect)
+        let first = try await pool.checkout(configuration: configuration(), onProgress: { _ in true })
+        try await first.handle(.string(#"{"serverContent":{"inputTranscription":{"text":"First dictation"},"turnComplete":true}}"#))
+        _ = try await first.finish()
+        try await waitUntil { factory.sessions.count == 2 }
+        XCTAssertTrue(factory.sockets[0].isClosed)
+        XCTAssertEqual(factory.sockets[1].sentMessages.count, 1, "Standby must send only setup, never audio")
+
+        let second = try await pool.checkout(configuration: configuration(), onProgress: { _ in true })
+        XCTAssertTrue(second === factory.sessions[1])
+        XCTAssertEqual(factory.sockets.count, 2)
+        try await second.handle(.string(#"{"serverContent":{"inputTranscription":{"text":"Second dictation"},"turnComplete":true}}"#))
+        let result = try await second.finish()
+        XCTAssertEqual(result.text, "Second dictation")
+        await pool.shutdown()
+    }
+
+    func testCheckoutUsesPendingWarmSetupInsteadOfOpeningAnotherSocket() async throws {
+        let factory = GeminiTestSessionFactory(automaticallyCompleteSetup: false)
+        let pool = GeminiLiveSessionPool(factory: factory.connect)
+        await pool.prewarm(configuration: configuration())
+        try await waitUntil { factory.sockets.count == 1 }
+        let checkout = Task { try await pool.checkout(configuration: configuration(), onProgress: { _ in true }) }
+        factory.sockets[0].enqueue(#"{"setupComplete":{}}"#)
+        let session = try await checkout.value
+        XCTAssertEqual(factory.sockets.count, 1)
+        XCTAssertTrue(session === factory.sessions[0])
+        await session.cancel()
+        await pool.shutdown()
+    }
+
+    func testEveryConfigurationChangeDiscardsStandby() async throws {
+        let alternatives = [
+            configuration(apiKey: "another-key"), configuration(modelId: "another-model"),
+            configuration(mode: .smart), configuration(languageCodes: ["de-DE"]),
+            configuration(vocabulary: ["Another term"]),
+        ]
+        for alternative in alternatives {
+            let factory = GeminiTestSessionFactory()
+            let pool = GeminiLiveSessionPool(factory: factory.connect)
+            await pool.prewarm(configuration: configuration())
+            try await waitUntil { factory.sessions.count == 1 }
+            let session = try await pool.checkout(configuration: alternative, onProgress: { _ in true })
+            try await waitUntil { factory.sockets[0].isClosed }
+            XCTAssertEqual(factory.sockets.count, 2)
+            XCTAssertTrue(session === factory.sessions[1])
+            await session.cancel()
+            await pool.shutdown()
+        }
+    }
+
+    func testStandbyPingsButStillExpiresAndReconnects() async throws {
+        let factory = GeminiTestSessionFactory()
+        let pool = GeminiLiveSessionPool(
+            idleTimeout: .milliseconds(100), pingInterval: .milliseconds(10), factory: factory.connect
+        )
+        await pool.prewarm(configuration: configuration())
+        try await waitUntil { factory.sockets.first?.isClosed == true }
+        XCTAssertGreaterThan(factory.sockets[0].pingCount, 0)
+        let session = try await pool.checkout(configuration: configuration(), onProgress: { _ in true })
+        XCTAssertEqual(factory.sockets.count, 2)
+        XCTAssertTrue(session === factory.sessions[1])
+        await session.cancel()
+        await pool.shutdown()
+    }
+
+    func testAgingStandbyIsReplacedBeforeItsIdleTimeout() async throws {
+        let clock = GeminiTestClock()
+        let factory = GeminiTestSessionFactory(now: clock.now)
+        let pool = GeminiLiveSessionPool(factory: factory.connect)
+        await pool.prewarm(configuration: configuration())
+        try await waitUntil { factory.sessions.count == 1 }
+        clock.advance(by: .seconds(61))
+
+        let session = try await pool.checkout(configuration: configuration(), onProgress: { _ in true })
+        XCTAssertTrue(factory.sockets[0].isClosed)
+        XCTAssertEqual(factory.sockets.count, 2)
+        XCTAssertTrue(session === factory.sessions[1])
+        await session.cancel()
+        await pool.shutdown()
+    }
+
+    func testRecentStandbyStillUsesWarmConnection() async throws {
+        let clock = GeminiTestClock()
+        let factory = GeminiTestSessionFactory(now: clock.now)
+        let pool = GeminiLiveSessionPool(factory: factory.connect)
+        await pool.prewarm(configuration: configuration())
+        try await waitUnt
```

**File**: `TypeWhisperPluginSDK/Plugins/GeminiPlugin/Tests/GeminiLiveTranscriptionTests.swift` (added, +431/-0)
```diff
@@ -0,0 +1,431 @@
+import Foundation
+import os
+import XCTest
+import TypeWhisperPluginSDK
+@testable import GeminiPlugin
+
+final class GeminiLiveTranscriptionTests: XCTestCase {
+    func testCompletionReceivedBeforeReleaseDoesNotWaitForAnotherTurn() async throws {
+        let socket = GeminiTestWebSocket()
+        let session = try await makeSession(socket: socket)
+        try await session.handle(.string(#"{"serverContent":{"inputTranscription":{"text":"Already complete"},"generationComplete":true}}"#))
+
+        let start = ContinuousClock.now
+        let result = try await session.finish()
+
+        XCTAssertEqual(result.text, "Already complete")
+        XCTAssertLessThan(start.duration(to: .now), .milliseconds(250))
+        XCTAssertTrue(socket.isClosed)
+    }
+
+    func testGenerationCompleteAfterReleaseEndsWait() async throws {
+        let socket = GeminiTestWebSocket()
+        let session = try await makeSession(socket: socket)
+        try await session.handle(.string(#"{"serverContent":{"inputTranscription":{"text":"Complete"}}}"#))
+        socket.onSend = { message in
+            if case .string(let text) = message, text == GeminiLiveTranscriptionSession.audioStreamEndMessage {
+                socket.enqueue(#"{"serverContent":{"generationComplete":true}}"#)
+            }
+        }
+
+        let start = ContinuousClock.now
+        let result = try await session.finish()
+
+        XCTAssertEqual(result.text, "Complete")
+        XCTAssertLessThan(start.duration(to: .now), .milliseconds(250))
+    }
+
+    func testSilentAudioAfterCompletionDoesNotWaitForAnotherTurn() async throws {
+        for completion in ["generationComplete", "turnComplete"] {
+            let socket = GeminiTestWebSocket()
+            let clock = GeminiTestClock()
+            let session = try await makeSession(socket: socket, clock: clock)
+            try await session.appendAudio(samples: [0.1])
+            clock.advance(by: .seconds(1))
+            try await session.handle(.string("{\"serverContent\":{\"inputTranscription\":{\"text\":\"Already complete\"},\"\(completion)\":true}}"))
+            try await session.appendAudio(samples: [Float](repeating: 0, count: 4_800))
+            clock.advance(by: .milliseconds(50))
+
+            let start = ContinuousClock.now
+            let result = try await finishWithWatchdog(session)
+
+            XCTAssertEqual(result.text, "Already complete")
+            XCTAssertLessThan(start.duration(to: .now), .milliseconds(250))
+            XCTAssertTrue(socket.isClosed)
+        }
+    }
+
+    func testTimeoutReturnsCommittedAndInterimText() async throws {
+        let session = try await makeSession(socket: GeminiTestWebSocket())
+        try await session.handle(.string(#"{"serverContent":{"inputTranscription":{"text":"Hello"}}}"#))
+        try await session.handle(.string(#"{"serverContent":{"interimInputTranscription":{"text":"world"}}}"#))
+
+        let result = try await session.finish()
+
+        XCTAssertEqual(result.text, "Hello world")
+    }
+
+    func testTurnCompleteReceivedBeforeReleaseEndsWait() async throws {
+        let socket = GeminiTestWebSocket()
+        let session = try await makeSession(socket: socket)
+        try await session.handle(.string(#"{"serverContent":{"inputTranscription":{"text":"Complete"},"turnComplete":true}}"#))
+        let start = ContinuousClock.now
+        let result = try await session.finish()
+        XCTAssertEqual(result.text, "Complete")
+        XCTAssertLessThan(start.duration(to: .now), .milliseconds(250))
+    }
+
+    func testCompletionAllowsLateTranscriptToSettle() async throws {
+        let clock = GeminiTestClock()
+        let session = try await makeSession(socket: GeminiTestWebSocket(), clock: clock)
+        try await session.handle(.string(#"{"serverContent":{"inputTranscription":{"text":"Hello"}}}"#))
+        try await session.handle(.string(#"{"serverContent":{"generationComplete":true}}"#))
+        clock.advance(by: .milliseconds(30))
+        let beforeLateText = await session.hasSettledCompletion
+        XCTAssertFalse(beforeLateText)
+        try await session.handle(.string(#"{"serverContent":{"inputTranscription":{"text":"world"}}}"#))
+        clock.advance(by: .milliseconds(49))
+        let beforeTextSettles = await session.hasSettledCompletion
+        XCTAssertFalse(beforeTextSettles, "Late transcription restarts the settling interval")
+        clock.advance(by: .milliseconds(1))
+        let settled = await session.hasSettledCompletion
+        XCTAssertTrue(settled)
+        let result = try await finishWithWatchdog(session)
+        XCTAssertEqual(result.text, "Hello world")
+    }
+
+    func testFirstFinalChunkDoesNotDropFollowingTranscript() async throws {
+        let clock = GeminiTestClock()
+        let session = try await makeSession(socket: GeminiTestWebSocket(), clock: clock)
+        try await session.handle(.string(#"{"serverContent":{"inputTranscripti
```

**File**: `TypeWhisperPluginSDK/Plugins/GeminiPlugin/Tests/GeminiPluginTests.swift` (modified, +57/-0)
```diff
@@ -1,4 +1,5 @@
 import Foundation
+import os
 import XCTest
 import TypeWhisperPluginSDK
 @_spi(Testing) import TypeWhisperPluginSDKTesting
@@ -45,6 +46,62 @@ final class GeminiPluginTests: XCTestCase {
         return defaults
     }
 
+    func testLiveCheckoutRejectsSessionInvalidatedBeforeHandover() async throws {
+        let changes: [(String, Bool, @Sendable (GeminiPlugin, PluginTestHostServices) -> Void)] = [
+            ("key", true, { plugin, _ in plugin.setApiKey("replacement-key") }),
+            ("key removal", true, { plugin, _ in plugin.removeApiKey() }),
+            ("model", true, { plugin, _ in plugin.selectModel("gemini-test-transcribe") }),
+            ("mode", true, { plugin, _ in plugin.setTranscriptionMode(.smart) }),
+            ("deactivation", true, { plugin, _ in plugin.deactivate() }),
+            ("activation", true, { plugin, host in plugin.activate(host: host) }),
+            ("unchanged settings", false, { plugin, _ in
+                plugin.setApiKey("test-key")
+                plugin.selectModel("gemini-3.5-transcribe")
+                plugin.setTranscriptionMode(.verbatim)
+            }),
+        ]
+        for (name, shouldReject, change) in changes {
+            var defaults = try Self.configuredDefaults()
+            defaults[Self.cachedTranscriptionModelsKey] = try JSONEncoder().encode([
+                GeminiFetchedTranscriptionModel(
+                    id: "gemini-3.5-transcribe", displayName: nil, liveModelId: "gemini-3.5-transcribe-live"
+                ),
+                GeminiFetchedTranscriptionModel(
+                    id: "gemini-test-transcribe", displayName: nil, liveModelId: "gemini-test-transcribe-live"
+                ),
+            ])
+            let host = try PluginTestHostServices(defaults: defaults, secrets: ["api-key": "test-key"])
+            let socket = GeminiTestWebSocket()
+            let session = try await GeminiLiveTranscriptionSession.connect(
+                apiKey: "test-key", modelId: "gemini-3.5-transcribe-live", mode: .verbatim,
+                languageCodes: [], customVocabulary: [], socket: socket
+            )
+            let beforeReturn = OSAllocatedUnfairLock<(@Sendable () -> Void)?>(initialState: nil)
+            let plugin = GeminiPlugin(liveSessionCheckout: { _, _, _ in
+                // Simulate checkout winning the race with the old pool's asynchronous shutdown.
+                beforeReturn.withLock { $0 }?()
+                return session
+            })
+            plugin.activate(host: host)
+            beforeReturn.withLock { $0 = { change(plugin, host) } }
+            defer {
+                beforeReturn.withLock { $0 = nil }
+                plugin.deactivate()
+            }
+            do {
+                let returned = try await plugin.createLiveTranscriptionSession(
+                    language: "en", translate: false, prompt: nil, onProgress: { _ in true }
+                )
+                XCTAssertFalse(shouldReject, "Stale session returned after \(name)")
+                XCTAssertTrue(returned as? GeminiLiveTranscriptionSession === session)
+            } catch is CancellationError {
+                XCTAssertTrue(shouldReject, "Valid session rejected for \(name)")
+            }
+            XCTAssertEqual(socket.isClosed, shouldReject, "Socket cleanup after \(name)")
+            await session.cancel()
+        }
+    }
+
     func testPreferredModelIdReflectsSelectedLLMModel() throws {
         let host = try PluginTestHostServices()
         let plugin = GeminiPlugin()
```

**File**: `TypeWhisperPluginSDK/Plugins/GeminiPlugin/manifest.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
     "id": "com.typewhisper.gemini",
     "name": "Gemini",
-    "version": "1.1.1",
+    "version": "1.1.2",
     "minHostVersion": "1.7.0",
     "sdkCompatibilityVersion": "v1",
     "minOSVersion": "14.0",
```

**File**: `docs/release-notes/unreleased.md` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 # Unreleased
 
 - Gemini plugin: Choose Verbatim or Smart transcription for live dictation and audio files. Verbatim is now the default and preserves fillers, repetitions, and spoken corrections; select Smart to keep the previous cleanup and formatting behavior.
+- Gemini plugin 1.1.2: Reduce the wait after releasing the dictation hotkey, retain available text if finalization times out, and prepare a fresh Live connection for the next dictation. Unused connections close before they become too old to hand over safely.
 - Recorder automation: Send successfully saved transcripts to Webhook Notifications or Script Runner with a separate, default-off option for each destination. The local API can retrieve completed manual, calendar, and API recordings after a restart, including retranscriptions. Webhook and Script Runner 1.2.0 require TypeWhisper 1.8.0.
```

---

### Incident Patch 3: `af9c9cba` (2026-10-03)
**Commit Message**: Merge pull request #1480 from personaltrainerkoichan/fix/ja-settings-completion-20261003

Complete Japanese localization for new features and plugin settings

**File**: `TypeWhisper/Resources/Localizable.xcstrings` (modified, +1039/-1)
```diff
@@ -42,6 +42,12 @@
             "state": "translated",
             "value": "清除余额设置"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "残高をクリア"
+          }
         }
       }
     },
@@ -58,6 +64,12 @@
             "state": "translated",
             "value": "最近识别时间"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "前回の認識"
+          }
         }
       }
     },
@@ -74,6 +86,12 @@
             "state": "translated",
             "value": "余额更新时间"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "残高の更新日時"
+          }
         }
       }
     },
@@ -90,6 +108,12 @@
             "state": "translated",
             "value": "余额更新后已用时长"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "残高更新後の使用量"
+          }
         }
       }
     },
@@ -106,6 +130,12 @@
             "state": "translated",
             "value": "预计剩余时长"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "推定残量"
+          }
         }
       }
     },
@@ -122,6 +152,12 @@
             "state": "translated",
             "value": "授权密钥安全地存储在钥匙串中。如果验证因证书错误而失败，请安装受 macOS 信任的 SaluteSpeech 证书。"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "認証キーはキーチェーンに安全に保存されます。確認時に証明書エラーが出る場合は、SaluteSpeechの証明書をインストールし、macOSで信頼する設定にしてください。"
+          }
         }
       }
     },
@@ -138,6 +174,12 @@
             "state": "translated",
             "value": "此为本地估算值。请根据 SaluteSpeech Studio 中的数据更新。"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "このMacでの推定値です。SaluteSpeech Studioで確認した残高に更新してください。"
+          }
         }
       }
     },
@@ -154,6 +196,12 @@
             "state": "translated",
             "value": "重置已记录的用量"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "記録した使用量をリセット"
+          }
         }
       }
     },
@@ -170,6 +218,12 @@
             "state": "translated",
             "value": "保存余额"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "残高を保存"
+          }
         }
       }
     },
@@ -186,6 +240,12 @@
             "state": "translated",
             "value": "有效期至"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "有効期限"
+          }
         }
       }
     },
@@ -202,6 +262,12 @@
             "state": "translated",
             "value": "分钟"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "分"
+          }
         }
       }
     },
@@ -218,6 +284,12 @@
             "state": "translated",
             "value": "Studio 剩余时长"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Studioの残量"
+          }
         }
       }
     },
@@ -234,6 +306,12 @@
             "state": "translated",
             "value": "累计已用时长"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "記録した使用量"
+          }
         }
       }
     },
@@ -250,6 +328,12 @@
             "state": "translated",
             "value": "语音识别用量"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "音声認識の使用量"
+          }
         }
       }
     },
@@ -266,6 +350,12 @@
             "state": "translated",
             "value": "企业"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "法人"
+          }
         }
       }
     },
@@ -282,6 +372,12 @@
             "state": "translated",
             "value": "个人"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "個人"
+          }
         }
       }
     },
@@ -298,6 +394,12 @@
             "state": "translated",
             "value": "OAuth 权限范围"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "OAuthの権限範囲"
+          }
         }
       }
     },
@@ -314,6 +416,12 @@
             "state": "translated",
             "value": "授权密钥"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "認証キー"
+   
```

**File**: `TypeWhisperPluginSDK/Plugins/CanaryPlugin/Localizable.xcstrings` (modified, +6/-0)
```diff
@@ -576,6 +576,12 @@
     },
     "No folder selected": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "フォルダ未選択"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
```

**File**: `TypeWhisperPluginSDK/Plugins/CerebrasPlugin/Localizable.xcstrings` (modified, +24/-0)
```diff
@@ -3,6 +3,12 @@
   "strings": {
     "Temperature Mode": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度モード"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -19,6 +25,12 @@
     },
     "Custom": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "カスタム"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -35,6 +47,12 @@
     },
     "Provider Default": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "プロバイダーのデフォルト"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -51,6 +69,12 @@
     },
     "Temperature": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
```

**File**: `TypeWhisperPluginSDK/Plugins/ClaudePlugin/Localizable.xcstrings` (modified, +24/-0)
```diff
@@ -3,6 +3,12 @@
   "strings": {
     "Temperature Mode": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度モード"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -19,6 +25,12 @@
     },
     "Custom": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "カスタム"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -35,6 +47,12 @@
     },
     "Provider Default": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "プロバイダーのデフォルト"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -51,6 +69,12 @@
     },
     "Temperature": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
```

**File**: `TypeWhisperPluginSDK/Plugins/CohereLocalPlugin/Localizable.xcstrings` (modified, +384/-0)
```diff
@@ -3,6 +3,12 @@
   "strings": {
     "14 languages with explicit selection: English, French, German, Spanish, Italian, Portuguese, Dutch, Polish, Greek, Arabic, Japanese, Chinese, Vietnamese, and Korean.": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "対応する14言語から明示的に選択してください：英語、フランス語、ドイツ語、スペイン語、イタリア語、ポルトガル語、オランダ語、ポーランド語、ギリシャ語、アラビア語、日本語、中国語、ベトナム語、韓国語。"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -19,6 +25,12 @@
     },
     "A private on-device GGUF and Metal provider for Cohere Transcribe 03-2026. Audio stays on this Mac.": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "GGUFとMetalを使用してCohere Transcribe 03-2026をローカルで実行します。音声はこのMac内に留まります。"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -35,6 +47,12 @@
     },
     "Cancel": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "キャンセル"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -51,6 +69,12 @@
     },
     "Capabilities and limits": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "機能と制限"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -67,6 +91,12 @@
     },
     "Cohere model license": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Cohereモデルのライセンス"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -99,6 +129,12 @@
     },
     "CrispASR license and notices": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "CrispASRのライセンスと通知事項"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -115,6 +151,12 @@
     },
     "Done": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "完了"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -131,6 +173,12 @@
     },
     "Download & Load": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "ダウンロードして読み込む"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -147,6 +195,12 @@
     },
     "Downloaded": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "ダウンロード済み"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -163,6 +217,12 @@
     },
     "Downloading": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "ダウンロード中"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -179,6 +239,12 @@
     },
     "Downloading Cohere model": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Cohereモデルをダウンロード中"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -195,6 +261,12 @@
     },
     "Error": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "エラー"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -211,6 +283,12 @@
     },
     "Hugging Face Token": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Hugging Faceトークン"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -227,6 +305,12 @@
     },
     "Invalid Hugging Face Token": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "無効なHugging Faceトークン"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -243,6 +327,12 @@
     },
     "Load": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "読み込む"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -259,6 +349,12 @@
     },
     "LOCAL · BATCH": {
       "localizations": {
+        "ja": {
+          "
```

**File**: `TypeWhisperPluginSDK/Plugins/FireworksPlugin/Localizable.xcstrings` (modified, +24/-0)
```diff
@@ -3,6 +3,12 @@
   "strings": {
     "Temperature Mode": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度モード"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -19,6 +25,12 @@
     },
     "Custom": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "カスタム"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -35,6 +47,12 @@
     },
     "Provider Default": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "プロバイダーのデフォルト"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -51,6 +69,12 @@
     },
     "Temperature": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
```

**File**: `TypeWhisperPluginSDK/Plugins/GeminiPlugin/Localizable.xcstrings` (modified, +24/-0)
```diff
@@ -3,6 +3,12 @@
   "strings": {
     "Temperature Mode": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度モード"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -19,6 +25,12 @@
     },
     "Custom": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "カスタム"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -35,6 +47,12 @@
     },
     "Provider Default": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "プロバイダーのデフォルト"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -51,6 +69,12 @@
     },
     "Temperature": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
```

**File**: `TypeWhisperPluginSDK/Plugins/GranitePlugin/Localizable.xcstrings` (modified, +6/-0)
```diff
@@ -576,6 +576,12 @@
     },
     "No folder selected": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "フォルダ未選択"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
```

---

### Incident Patch 4: `5ffb3ca0` (2026-10-03)
**Commit Message**: fix: 新機能とプラグイン設定の日本語訳を補完

**File**: `TypeWhisper/Resources/Localizable.xcstrings` (modified, +1039/-1)
```diff
@@ -42,6 +42,12 @@
             "state": "translated",
             "value": "清除余额设置"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "残高をクリア"
+          }
         }
       }
     },
@@ -58,6 +64,12 @@
             "state": "translated",
             "value": "最近识别时间"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "前回の認識"
+          }
         }
       }
     },
@@ -74,6 +86,12 @@
             "state": "translated",
             "value": "余额更新时间"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "残高の更新日時"
+          }
         }
       }
     },
@@ -90,6 +108,12 @@
             "state": "translated",
             "value": "余额更新后已用时长"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "残高更新後の使用量"
+          }
         }
       }
     },
@@ -106,6 +130,12 @@
             "state": "translated",
             "value": "预计剩余时长"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "推定残量"
+          }
         }
       }
     },
@@ -122,6 +152,12 @@
             "state": "translated",
             "value": "授权密钥安全地存储在钥匙串中。如果验证因证书错误而失败，请安装受 macOS 信任的 SaluteSpeech 证书。"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "認証キーはキーチェーンに安全に保存されます。確認時に証明書エラーが出る場合は、SaluteSpeechの証明書をインストールし、macOSで信頼する設定にしてください。"
+          }
         }
       }
     },
@@ -138,6 +174,12 @@
             "state": "translated",
             "value": "此为本地估算值。请根据 SaluteSpeech Studio 中的数据更新。"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "このMacでの推定値です。SaluteSpeech Studioで確認した残高に更新してください。"
+          }
         }
       }
     },
@@ -154,6 +196,12 @@
             "state": "translated",
             "value": "重置已记录的用量"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "記録した使用量をリセット"
+          }
         }
       }
     },
@@ -170,6 +218,12 @@
             "state": "translated",
             "value": "保存余额"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "残高を保存"
+          }
         }
       }
     },
@@ -186,6 +240,12 @@
             "state": "translated",
             "value": "有效期至"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "有効期限"
+          }
         }
       }
     },
@@ -202,6 +262,12 @@
             "state": "translated",
             "value": "分钟"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "分"
+          }
         }
       }
     },
@@ -218,6 +284,12 @@
             "state": "translated",
             "value": "Studio 剩余时长"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Studioの残量"
+          }
         }
       }
     },
@@ -234,6 +306,12 @@
             "state": "translated",
             "value": "累计已用时长"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "記録した使用量"
+          }
         }
       }
     },
@@ -250,6 +328,12 @@
             "state": "translated",
             "value": "语音识别用量"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "音声認識の使用量"
+          }
         }
       }
     },
@@ -266,6 +350,12 @@
             "state": "translated",
             "value": "企业"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "法人"
+          }
         }
       }
     },
@@ -282,6 +372,12 @@
             "state": "translated",
             "value": "个人"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "個人"
+          }
         }
       }
     },
@@ -298,6 +394,12 @@
             "state": "translated",
             "value": "OAuth 权限范围"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "OAuthの権限範囲"
+          }
         }
       }
     },
@@ -314,6 +416,12 @@
             "state": "translated",
             "value": "授权密钥"
           }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "認証キー"
+   
```

**File**: `TypeWhisperPluginSDK/Plugins/CanaryPlugin/Localizable.xcstrings` (modified, +6/-0)
```diff
@@ -576,6 +576,12 @@
     },
     "No folder selected": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "フォルダ未選択"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
```

**File**: `TypeWhisperPluginSDK/Plugins/CerebrasPlugin/Localizable.xcstrings` (modified, +24/-0)
```diff
@@ -3,6 +3,12 @@
   "strings": {
     "Temperature Mode": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度モード"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -19,6 +25,12 @@
     },
     "Custom": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "カスタム"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -35,6 +47,12 @@
     },
     "Provider Default": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "プロバイダーのデフォルト"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -51,6 +69,12 @@
     },
     "Temperature": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
```

**File**: `TypeWhisperPluginSDK/Plugins/ClaudePlugin/Localizable.xcstrings` (modified, +24/-0)
```diff
@@ -3,6 +3,12 @@
   "strings": {
     "Temperature Mode": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度モード"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -19,6 +25,12 @@
     },
     "Custom": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "カスタム"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -35,6 +47,12 @@
     },
     "Provider Default": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "プロバイダーのデフォルト"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -51,6 +69,12 @@
     },
     "Temperature": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
```

**File**: `TypeWhisperPluginSDK/Plugins/CohereLocalPlugin/Localizable.xcstrings` (modified, +384/-0)
```diff
@@ -3,6 +3,12 @@
   "strings": {
     "14 languages with explicit selection: English, French, German, Spanish, Italian, Portuguese, Dutch, Polish, Greek, Arabic, Japanese, Chinese, Vietnamese, and Korean.": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "対応する14言語から明示的に選択してください：英語、フランス語、ドイツ語、スペイン語、イタリア語、ポルトガル語、オランダ語、ポーランド語、ギリシャ語、アラビア語、日本語、中国語、ベトナム語、韓国語。"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -19,6 +25,12 @@
     },
     "A private on-device GGUF and Metal provider for Cohere Transcribe 03-2026. Audio stays on this Mac.": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "GGUFとMetalを使用してCohere Transcribe 03-2026をローカルで実行します。音声はこのMac内に留まります。"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -35,6 +47,12 @@
     },
     "Cancel": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "キャンセル"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -51,6 +69,12 @@
     },
     "Capabilities and limits": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "機能と制限"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -67,6 +91,12 @@
     },
     "Cohere model license": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Cohereモデルのライセンス"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -99,6 +129,12 @@
     },
     "CrispASR license and notices": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "CrispASRのライセンスと通知事項"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -115,6 +151,12 @@
     },
     "Done": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "完了"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -131,6 +173,12 @@
     },
     "Download & Load": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "ダウンロードして読み込む"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -147,6 +195,12 @@
     },
     "Downloaded": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "ダウンロード済み"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -163,6 +217,12 @@
     },
     "Downloading": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "ダウンロード中"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -179,6 +239,12 @@
     },
     "Downloading Cohere model": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Cohereモデルをダウンロード中"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -195,6 +261,12 @@
     },
     "Error": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "エラー"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -211,6 +283,12 @@
     },
     "Hugging Face Token": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Hugging Faceトークン"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -227,6 +305,12 @@
     },
     "Invalid Hugging Face Token": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "無効なHugging Faceトークン"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -243,6 +327,12 @@
     },
     "Load": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "読み込む"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -259,6 +349,12 @@
     },
     "LOCAL · BATCH": {
       "localizations": {
+        "ja": {
+          "
```

**File**: `TypeWhisperPluginSDK/Plugins/FireworksPlugin/Localizable.xcstrings` (modified, +24/-0)
```diff
@@ -3,6 +3,12 @@
   "strings": {
     "Temperature Mode": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度モード"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -19,6 +25,12 @@
     },
     "Custom": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "カスタム"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -35,6 +47,12 @@
     },
     "Provider Default": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "プロバイダーのデフォルト"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -51,6 +69,12 @@
     },
     "Temperature": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
```

**File**: `TypeWhisperPluginSDK/Plugins/GeminiPlugin/Localizable.xcstrings` (modified, +24/-0)
```diff
@@ -3,6 +3,12 @@
   "strings": {
     "Temperature Mode": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度モード"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -19,6 +25,12 @@
     },
     "Custom": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "カスタム"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -35,6 +47,12 @@
     },
     "Provider Default": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "プロバイダーのデフォルト"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
@@ -51,6 +69,12 @@
     },
     "Temperature": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
```

**File**: `TypeWhisperPluginSDK/Plugins/GranitePlugin/Localizable.xcstrings` (modified, +6/-0)
```diff
@@ -576,6 +576,12 @@
     },
     "No folder selected": {
       "localizations": {
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "フォルダ未選択"
+          }
+        },
         "de": {
           "stringUnit": {
             "state": "translated",
```

---

### Incident Patch 5: `78e44e72` (2026-10-03)
**Commit Message**: Add menu bar quick selectors for microphone, language and model (#1471)

Closes #1334

**File**: `TypeWhisper.xcodeproj/project.pbxproj` (modified, +8/-0)
```diff
@@ -135,6 +135,7 @@
 		C2300000000000000000000F /* SpeechAnalyzerPlugin.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000160 /* SpeechAnalyzerPlugin.swift */; };
 		C23000000000000000000010 /* DeepgramPlugin.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000200 /* DeepgramPlugin.swift */; };
 		2F4D6A8B0C1E3F5A7B9D2C4E /* DictationViewModelIndicatorSettingsTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2F4D6A8B0C1E3F5A7B9D2C4F /* DictationViewModelIndicatorSettingsTests.swift */; };
+		A17C69E6B6A43880D94B24FF /* DictationQuickSelectionTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 836B1A400007048E1736246F /* DictationQuickSelectionTests.swift */; };
 		2F4D6A8B0C1E3F5A7B9D2C50 /* IndicatorTranscriptPreviewSizingTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2F4D6A8B0C1E3F5A7B9D2C51 /* IndicatorTranscriptPreviewSizingTests.swift */; };
 		91B4D7E2C5A809F1632E4B7C /* PluginRegistryServiceTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 91B4D7E2C5A809F1632E4B7D /* PluginRegistryServiceTests.swift */; };
 		545000000000000000000002 /* SetupWizardRecommendationAvailabilityTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 545000000000000000000001 /* SetupWizardRecommendationAvailabilityTests.swift */; };
@@ -368,6 +369,7 @@
 		AA00000000000000000182 /* StreamingHandler.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000172 /* StreamingHandler.swift */; };
 		AA00000000000000000183 /* PromptPaletteHandler.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000173 /* PromptPaletteHandler.swift */; };
 		AA00000000000000000184 /* DictationSettingsHandler.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000174 /* DictationSettingsHandler.swift */; };
+		BEEB1B96C554D7A639E56CFA /* DictationQuickSelection.swift in Sources */ = {isa = PBXBuildFile; fileRef = C5E6EB12C3CB1F88B36EFA3F /* DictationQuickSelection.swift */; };
 		AA00000000000000000185 /* OpenAICompatiblePlugin.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000176 /* OpenAICompatiblePlugin.swift */; };
 		A1B2C3D4E5F60718293A4B5C /* OpenAIRealtimeTranscription.swift in Sources */ = {isa = PBXBuildFile; fileRef = D1E2F3A4B5C60718293A4B5C /* OpenAIRealtimeTranscription.swift */; };
 		AA00000000000000000186 /* manifest.json in Resources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000177 /* manifest.json */; };
@@ -990,6 +992,7 @@
 		BB00000000000000000172 /* StreamingHandler.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = StreamingHandler.swift; sourceTree = "<group>"; };
 		BB00000000000000000173 /* PromptPaletteHandler.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PromptPaletteHandler.swift; sourceTree = "<group>"; };
 		BB00000000000000000174 /* DictationSettingsHandler.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = DictationSettingsHandler.swift; sourceTree = "<group>"; };
+		C5E6EB12C3CB1F88B36EFA3F /* DictationQuickSelection.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = DictationQuickSelection.swift; sourceTree = "<group>"; };
 		BB00000000000000000175 /* OpenAICompatiblePlugin.bundle */ = {isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = OpenAICompatiblePlugin.bundle; sourceTree = BUILT_PRODUCTS_DIR; };
 		BB00000000000000000176 /* OpenAICompatiblePlugin.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = OpenAICompatiblePlugin.swift; sourceTree = "<group>"; };
 		D1E2F3A4B5C60718293A4B5C /* OpenAIRealtimeTranscription.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = OpenAIRealtimeTranscription.swift; sourceTree = "<group>"; };
@@ -1179,6 +1182,7 @@
 		E6D200DCDD6580F443C5CE0A /* TypeWhisperIntegrationTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = TypeWhisperIntegrationTests.swift; sourceTree = "<group>"; };
 		E6F8E5940EF4832A7B8D735D /* TypeWhisperTests.xctest */ = {isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = TypeWhisperTests.xctest; sourceTree = BUILT_PRODUCTS_DIR; };
 		2F4D6A8B0C1E3F5A7B9D2C4F /* DictationViewModelIndicatorSettingsTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = DictationViewModelIndicatorSettingsTests.swift; sourceTree = "<group>"; };
+		836B1A400007048E1736246F /* DictationQuickSelectionTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = DictationQuickSelectionTests.swift; sourceTree = "<group>"; };
 		2F4D6A8B0C1E3F5A7B9D2C51 /* IndicatorTranscriptPreviewSizingTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = IndicatorTranscriptPreviewSizing
```

**File**: `TypeWhisper/Services/AudioDeviceService.swift` (modified, +6/-0)
```diff
@@ -348,6 +348,12 @@ final class AudioDeviceService: ObservableObject, @unchecked Sendable {
         return inputDevices.first(where: { $0.uid == selectedDeviceUID })
     }
 
+    /// Name of the macOS default input, which recording uses when no microphone is selected.
+    var systemDefaultInputDeviceName: String? {
+        guard let deviceID = defaultInputDeviceController.defaultInputDeviceID() else { return nil }
+        return inputDevices.first(where: { $0.deviceID == deviceID })?.name ?? Self.deviceName(for: deviceID)
+    }
+
     var selectedDeviceCompatibility: AudioInputDeviceCompatibility? {
         selectedDevice?.compatibility
     }
```

**File**: `TypeWhisper/Services/ModelManagerService.swift` (modified, +8/-0)
```diff
@@ -136,6 +136,14 @@ enum TranscriptionEngineReadiness {
         defaults.object(forKey: "plugin.\(pluginId).loadedModel") != nil
     }
 
+    /// The model ID local plugins persist after a successful load and restore from.
+    static func persistedRestorableModelId(
+        pluginId: String,
+        defaults: UserDefaults = .standard
+    ) -> String? {
+        defaults.string(forKey: "plugin.\(pluginId).loadedModel")
+    }
+
     /// A selected engine is actionable when authentication is available and it
     /// is already configured, can restore persisted model state, or has a
     /// provider-specific preparation fallback such as Apple Speech's catalog.
```

**File**: `TypeWhisper/ViewModels/DictationQuickSelection.swift` (added, +685/-0)
```diff
@@ -0,0 +1,685 @@
+import AppKit
+import Combine
+import Foundation
+import TypeWhisperPluginSDK
+
+/// One entry of a dictation quick-selection menu (microphone, language or model).
+struct DictationQuickSelectionOption<Value: Hashable>: Identifiable, Hashable {
+    let id: String
+    let value: Value
+    let title: String
+    var isSelected = false
+    var isEnabled = true
+}
+
+enum DictationMicrophoneChoice: Hashable {
+    case systemDefault
+    case device(uid: String)
+}
+
+struct DictationModelChoice: Hashable {
+    let providerId: String
+    let modelId: String?
+}
+
+struct DictationModelGroup: Identifiable, Equatable {
+    let id: String
+    let title: String
+    let options: [DictationQuickSelectionOption<DictationModelChoice>]
+    /// Models that need setup in Settings first. Listed separately because local engines
+    /// can offer many variants or one model per language.
+    var setupRequiredOptions: [DictationQuickSelectionOption<DictationModelChoice>] = []
+}
+
+/// The transcription engine facts the model menu needs, decoupled from the plugin
+/// instance so the selection rules can be tested without loaded plugins.
+struct DictationQuickSelectionEngine {
+    let providerId: String
+    let displayName: String
+    let isAuthAvailable: Bool
+    let isConfigured: Bool
+    /// Local engines load model weights from disk and may download them on selection.
+    let managesLocalModels: Bool
+    let selectedModelId: String?
+    /// The model the engine last loaded and restores from installed assets.
+    let restorableModelId: String?
+    let models: [PluginModelInfo]
+}
+
+struct DictationQuickSelectionSnapshot: Equatable {
+    var isLocked = false
+
+    var microphoneSummary = ""
+    var microphoneOptions: [DictationQuickSelectionOption<DictationMicrophoneChoice>] = []
+
+    var languageSummary = ""
+    var languageWorkflowNote: String?
+    var languageOptions: [DictationQuickSelectionOption<LanguageSelection>] = []
+    var moreLanguageOptions: [DictationQuickSelectionOption<LanguageSelection>] = []
+
+    var modelSummary = ""
+    var modelWorkflowNote: String?
+    var modelGroups: [DictationModelGroup] = []
+}
+
+/// Builds the quick-selection menus from the existing selection services. The functions
+/// are pure so the selection rules stay testable; `DictationQuickSelectionModel` feeds them.
+@MainActor
+enum DictationQuickSelection {
+    /// Up to this many supported languages are listed directly; larger sets move all
+    /// non-featured languages into a "More Languages" submenu.
+    static let directLanguageLimit = 12
+
+    // MARK: Lock
+
+    /// Selections are locked while a recording is captured or transcribed. Changing the
+    /// model then could unload the model the running session uses, and a microphone or
+    /// language change would only partially apply to the current session.
+    /// `isTranscribingElsewhere` covers recorder retranscription, file transcription and
+    /// recovered recordings.
+    static func isLocked(
+        dictationState: DictationViewModel.State,
+        recorderState: AudioRecorderViewModel.RecorderState,
+        isTranscribingElsewhere: Bool = false
+    ) -> Bool {
+        switch dictationState {
+        case .recording, .processing, .inserting, .promptProcessing:
+            return true
+        case .idle, .promptSelection, .error:
+            break
+        }
+        return recorderState != .idle || isTranscribingElsewhere
+    }
+
+    // MARK: Microphone
+
+    static func microphoneOptions(
+        devices: [AudioInputDevice],
+        deviceTitle: (AudioInputDevice) -> String,
+        isDeviceAvailable: (AudioInputDevice) -> Bool = { _ in true },
+        priorityList: [AudioInputDevicePriorityItem],
+        selectedDeviceUID: String?,
+        systemDefaultName: String?
+    ) -> [DictationQuickSelectionOption<DictationMicrophoneChoice>] {
+        var options: [DictationQuickSelectionOption<DictationMicrophoneChoice>] = [
+            DictationQuickSelectionOption(
+                id: "system-default",
+                value: .systemDefault,
+                title: systemDefaultTitle(deviceName: systemDefaultName),
+                isSelected: selectedDeviceUID == nil
+            )
+        ]
+
+        for device in devices {
+            // Recording skips devices it cannot use, such as the built-in microphone
+            // with the lid closed, so choosing one would only reset the priority list.
+            let isAvailable = isDeviceAvailable(device)
+            options.append(DictationQuickSelectionOption(
+                id: device.uid,
+                value: .device(uid: device.uid),
+                title: isAvailable
+                    ? deviceTitle(device)
+                    : localizedAppText(
+                        "\(deviceTitle(device)) (unavailable)",
+                        de: "\(deviceTitle(device)) (nicht verfügbar)"
+                    ),
+                isSe
```

**File**: `TypeWhisper/ViewModels/SettingsViewModel.swift` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ enum LanguageSelectionMode: String, Sendable {
     case multiple
 }
 
-enum LanguageSelection: Equatable, Sendable {
+enum LanguageSelection: Hashable, Sendable {
     case inheritGlobal
     case auto
     case exact(String)
```

**File**: `TypeWhisper/Views/MenuBarView.swift` (modified, +142/-16)
```diff
@@ -175,28 +175,16 @@ private final class MenuBarState: ObservableObject {
     }
 
     private static func idleModelStatus(from modelManager: ModelManagerService) -> (text: String, image: String) {
-        guard let name = modelManager.activeModelName else {
+        guard modelManager.activeModelName != nil else {
             return (String(localized: "No model loaded"), "exclamationmark.triangle.fill")
         }
 
-        let label = activeModelLabel(engine: modelManager.activeEngineName, model: name)
-
+        // The model itself is named by the Model quick selector below the status line.
         if modelManager.isModelReady {
-            return (String(localized: "\(label) ready"), "checkmark.circle.fill")
+            return (String(localized: "Ready"), "checkmark.circle.fill")
         }
 
-        return (String(localized: "\(label) selected"), "clock.fill")
-    }
-
-    /// Prefixes the model name with its provider/engine (e.g. "Groq • whisper-large-v3") so the
-    /// menu bar shows which provider handles transcription. Skips the prefix when it would be
-    /// redundant — e.g. local engines whose model name already contains the provider ("Parakeet").
-    static func activeModelLabel(engine: String?, model: String) -> String {
-        guard let engine, !engine.isEmpty, engine != model,
-              !model.localizedCaseInsensitiveContains(engine) else {
-            return model
-        }
-        return "\(engine) • \(model)"
+        return (localizedAppText("Model selected", de: "Modell ausgewählt"), "clock.fill")
     }
 
     private func refreshCopyAvailability() {
@@ -356,6 +344,7 @@ struct PluginAppCommands: Commands {
 struct MenuBarView: View {
     @Environment(\.openWindow) private var openWindow
     @StateObject private var status = MenuBarState()
+    @StateObject private var quickSelection = DictationQuickSelectionModel()
     @ObservedObject private var pluginManager: PluginManager
 
     init(pluginManager: PluginManager = PluginManager.shared) {
@@ -376,6 +365,12 @@ struct MenuBarView: View {
 
             Divider()
 
+            Section(localizedAppText("Dictation", de: "Diktat")) {
+                microphoneQuickSelector
+                languageQuickSelector
+                modelQuickSelector
+            }
+
             ForEach(MenuBarMenuSection.allCases, id: \.self) { section in
                 Section(String(localized: section.titleResource)) {
                     ForEach(section.items(hasRecoverableRecording: status.hasRecoverableRecording), id: \.self) { item in
@@ -532,6 +527,123 @@ struct MenuBarView: View {
         }
     }
 
+    // MARK: Dictation quick selectors
+
+    private var microphoneQuickSelector: some View {
+        let snapshot = quickSelection.snapshot
+        return Menu {
+            ForEach(snapshot.microphoneOptions) { option in
+                quickSelectionItem(option, select: quickSelection.selectMicrophone)
+            }
+            Divider()
+            dictationSettingsButton
+        } label: {
+            Label(
+                localizedAppText(
+                    "Microphone: \(snapshot.microphoneSummary)",
+                    de: "Mikrofon: \(snapshot.microphoneSummary)"
+                ),
+                systemImage: "mic"
+            )
+        }
+        .quickSelectorLock(snapshot.isLocked)
+    }
+
+    private var languageQuickSelector: some View {
+        let snapshot = quickSelection.snapshot
+        return Menu {
+            if let note = snapshot.languageWorkflowNote {
+                Text(verbatim: note)
+                Divider()
+            }
+            ForEach(snapshot.languageOptions) { option in
+                quickSelectionItem(option, select: quickSelection.selectLanguage)
+            }
+            if !snapshot.moreLanguageOptions.isEmpty {
+                Menu(localizedAppText("More Languages", de: "Weitere Sprachen")) {
+                    ForEach(snapshot.moreLanguageOptions) { option in
+                        quickSelectionItem(option, select: quickSelection.selectLanguage)
+                    }
+                }
+            }
+            Divider()
+            dictationSettingsButton
+        } label: {
+            Label(
+                localizedAppText(
+                    "Language: \(snapshot.languageSummary)",
+                    de: "Sprache: \(snapshot.languageSummary)"
+                ),
+                systemImage: "globe"
+            )
+        }
+        .quickSelectorLock(snapshot.isLocked)
+    }
+
+    private var modelQuickSelector: some View {
+        let snapshot = quickSelection.snapshot
+        return Menu {
+            if let note = snapshot.modelWorkflowNote {
+                Text(verbatim: note)
+                Divider()
+            }
+            ForEach(snapshot.modelGroups) { group in
+                if group.options.count == 1, let option = group.options.first, option.value.modelId == nil {
+                    quickSelec
```

**File**: `TypeWhisper/Views/WorkflowsSettingsView.swift` (modified, +1/-1)
```diff
@@ -3393,7 +3393,7 @@ private func workflowOutputRouteSentence(targetActionPluginId: String?) -> Strin
     )
 }
 
-private func workflowInputLanguageSummary(for selection: LanguageSelection) -> String {
+func workflowInputLanguageSummary(for selection: LanguageSelection) -> String {
     switch selection {
     case .inheritGlobal:
         return localizedAppText("Global Setting", de: "Globale Einstellung")
```

**File**: `TypeWhisperTests/DictationQuickSelectionTests.swift` (added, +389/-0)
```diff
@@ -0,0 +1,389 @@
+import XCTest
+import CoreAudio
+import TypeWhisperPluginSDK
+@testable import TypeWhisper
+
+@MainActor
+final class DictationQuickSelectionTests: XCTestCase {
+    // MARK: Lock
+
+    func testSelectionsLockWhileDictationCapturesOrTranscribes() {
+        for state: DictationViewModel.State in [.recording, .processing, .inserting, .promptProcessing("Fix")] {
+            XCTAssertTrue(
+                DictationQuickSelection.isLocked(dictationState: state, recorderState: .idle),
+                "\(state)"
+            )
+        }
+        for state: DictationViewModel.State in [.idle, .promptSelection("text"), .error("failed")] {
+            XCTAssertFalse(
+                DictationQuickSelection.isLocked(dictationState: state, recorderState: .idle),
+                "\(state)"
+            )
+        }
+    }
+
+    func testSelectionsLockWhileRecorderIsActive() {
+        XCTAssertTrue(DictationQuickSelection.isLocked(dictationState: .idle, recorderState: .recording))
+        XCTAssertTrue(DictationQuickSelection.isLocked(dictationState: .idle, recorderState: .finalizing))
+    }
+
+    func testSelectionsLockWhileAnotherTranscriptionRuns() {
+        XCTAssertTrue(DictationQuickSelection.isLocked(
+            dictationState: .idle,
+            recorderState: .idle,
+            isTranscribingElsewhere: true
+        ))
+        XCTAssertFalse(DictationQuickSelection.isLocked(
+            dictationState: .idle,
+            recorderState: .idle,
+            isTranscribingElsewhere: false
+        ))
+    }
+
+    // MARK: Microphone
+
+    func testMicrophoneOptionsMarkSelectionAndListDisconnectedPriorityDevices() {
+        let options = DictationQuickSelection.microphoneOptions(
+            devices: [
+                AudioInputDevice(deviceID: AudioDeviceID(1), name: "MacBook Pro Microphone", uid: "built-in"),
+                AudioInputDevice(deviceID: AudioDeviceID(2), name: "USB Mic", uid: "usb"),
+            ],
+            deviceTitle: \.name,
+            priorityList: [
+                AudioInputDevicePriorityItem(uid: "headset", name: "Headset"),
+                AudioInputDevicePriorityItem(uid: "usb", name: "USB Mic"),
+            ],
+            selectedDeviceUID: "usb",
+            systemDefaultName: "MacBook Pro Microphone"
+        )
+
+        XCTAssertEqual(options.map(\.id), ["system-default", "built-in", "usb", "headset"])
+        XCTAssertEqual(options.filter(\.isSelected).map(\.id), ["usb"])
+        XCTAssertEqual(options.filter { !$0.isEnabled }.map(\.id), ["headset"])
+        XCTAssertTrue(options[0].title.contains("MacBook Pro Microphone"))
+        XCTAssertTrue(options[3].title.contains("Headset"))
+    }
+
+    func testMicrophoneOptionsDisableDevicesRecordingCannotUse() {
+        let options = DictationQuickSelection.microphoneOptions(
+            devices: [
+                AudioInputDevice(deviceID: AudioDeviceID(1), name: "MacBook Pro Microphone", uid: "built-in"),
+                AudioInputDevice(deviceID: AudioDeviceID(2), name: "USB Mic", uid: "usb"),
+            ],
+            deviceTitle: \.name,
+            isDeviceAvailable: { $0.uid != "built-in" },
+            priorityList: [],
+            selectedDeviceUID: "usb",
+            systemDefaultName: nil
+        )
+
+        let builtIn = options.first { $0.id == "built-in" }
+        XCTAssertEqual(builtIn?.isEnabled, false)
+        XCTAssertNotEqual(builtIn?.title, "MacBook Pro Microphone", "the reason is shown")
+        XCTAssertEqual(options.first { $0.id == "usb" }?.isEnabled, true)
+    }
+
+    func testMicrophoneOptionsSelectSystemDefaultWithoutExplicitDevice() {
+        let options = DictationQuickSelection.microphoneOptions(
+            devices: [AudioInputDevice(deviceID: AudioDeviceID(1), name: "Built-in", uid: "built-in")],
+            deviceTitle: \.name,
+            priorityList: [],
+            selectedDeviceUID: nil,
+            systemDefaultName: nil
+        )
+
+        XCTAssertEqual(options.filter(\.isSelected).map(\.value), [.systemDefault])
+    }
+
+    func testMicrophoneSummaryShowsDeviceUsedForNextRecording() {
+        let explicit = ResolvedRecordingInputSelection(
+            deviceUID: "usb",
+            deviceID: AudioDeviceID(2),
+            deviceName: "USB Mic",
+            usesBluetoothTransport: false
+        )
+        XCTAssertEqual(
+            DictationQuickSelection.microphoneSummary(resolvedSelection: explicit, systemDefaultName: "Built-in"),
+            "USB Mic"
+        )
+
+        let fallback = DictationQuickSelection.microphoneSummary(
+            resolvedSelection: .systemDefault,
+            systemDefaultName: "Built-in"
+        )
+        XCTAssertTrue(fallback.contains("Built-in"))
+        XCTAssertNotEqual(fallback, "Built-in")
+    }
+
+    // MARK: Language
+
+    func testLanguageOptionsListOnlyModelLanguages() {
+        let menu = DictationQuickSelection.languageOptions(
+            globalS
```

---

### Incident Patch 6: `8c7aaa00` (2026-10-02)
**Commit Message**: fix(plugins): show Parakeet download progress and list local models as rows (#1457)

* fix(plugins): show Parakeet download progress and list local models as rows

Parakeet kept its progress bar at 10% until the whole download had finished.
It now follows FluidAudio's download callbacks. Parakeet and Cohere Transcribe
(Local) list their models one below another, each with its own action, instead
of a version picker.

Parakeet, Cohere Transcribe (Local), Webhook and Script Runner show their Done
button only when the host provides a close action, so it disappears when the
settings are embedded in a host page.

* fix(cohere-local): name the model in the removal confirmation

**File**: `TypeWhisperPluginSDK/Plugins/CohereLocalPlugin/CohereLocalPlugin.swift` (modified, +153/-145)
```diff
@@ -850,12 +850,12 @@ private struct CohereLocalSettingsView: View {
         string: "https://huggingface.co/ggml-org/whisper-vad"
     )!
 
-    @Environment(\.dismiss) private var dismiss
     @Environment(\.pluginSettingsClose) private var closeSettings
     @State private var modelState: CohereLocalModelState = .notLoaded
     @State private var selectedModelId = CohereLocalPlugin.fastModel.id
-    @State private var isDownloaded = false
+    @State private var downloadedModelIds: Set<String> = []
     @State private var showDeleteConfirmation = false
+    @State private var modelIdPendingRemoval: String?
     @State private var huggingFaceTokenInput = ""
     @State private var showHuggingFaceToken = false
     @State private var isValidatingHuggingFaceToken = false
@@ -874,20 +874,19 @@ private struct CohereLocalSettingsView: View {
                 .frame(maxWidth: .infinity, alignment: .leading)
             }
 
-            Divider()
+            // Embedded in the host's settings page there is nothing to close.
+            if let closeSettings {
+                Divider()
 
-            HStack {
-                Spacer()
-                Button(String(localized: "Done", bundle: bundle)) {
-                    if let closeSettings {
+                HStack {
+                    Spacer()
+                    Button(String(localized: "Done", bundle: bundle)) {
                         closeSettings()
-                    } else {
-                        dismiss()
                     }
+                    .keyboardShortcut(.defaultAction)
                 }
-                .keyboardShortcut(.defaultAction)
+                .padding(16)
             }
-            .padding(16)
         }
         .onAppear {
             refresh()
@@ -902,39 +901,49 @@ private struct CohereLocalSettingsView: View {
         }
         .alert(
             String(localized: "Remove downloaded model?", bundle: bundle),
-            isPresented: $showDeleteConfirmation
-        ) {
+            isPresented: $showDeleteConfirmation,
+            presenting: modelIdPendingRemoval
+        ) { modelId in
             Button(String(localized: "Cancel", bundle: bundle), role: .cancel) {}
             Button(String(localized: "Remove Model", bundle: bundle), role: .destructive) {
                 Task {
-                    try? await plugin.deleteDownloadedModel(selectedModelId)
+                    try? await plugin.deleteDownloadedModel(modelId)
                     refresh()
                 }
             }
-        } message: {
-            Text(
-                "This removes the selected Cohere model. Shared runtime files remain while another variant is installed.",
-                bundle: bundle
-            )
+        } message: { modelId in
+            let modelName = CohereLocalPlugin.model(for: modelId).map {
+                CohereLocalPlugin.localizedString($0.displayName, bundle: bundle)
+            } ?? modelId
+            Text(String.localizedStringWithFormat(
+                String(
+                    localized: "This removes %@. Shared runtime files remain while another variant is installed.",
+                    bundle: bundle
+                ),
+                modelName
+            ))
         }
     }
 
     private var header: some View {
         VStack(alignment: .leading, spacing: 8) {
-            HStack(spacing: 10) {
-                Image(systemName: "waveform.badge.mic")
-                    .font(.title2)
-                    .foregroundStyle(.tint)
-                Text("Cohere Transcribe (Local)", bundle: bundle)
-                    .font(.title2)
-                    .fontWeight(.semibold)
-                Spacer()
-                Text("LOCAL · BATCH", bundle: bundle)
-                    .font(.caption2)
-                    .fontWeight(.semibold)
-                    .padding(.horizontal, 8)
-                    .padding(.vertical, 4)
-                    .background(.quaternary, in: Capsule())
+            // The host's settings page already shows the name and the badges.
+            if closeSettings != nil {
+                HStack(spacing: 10) {
+                    Image(systemName: "waveform.badge.mic")
+                        .font(.title2)
+                        .foregroundStyle(.tint)
+                    Text("Cohere Transcribe (Local)", bundle: bundle)
+                        .font(.title2)
+                        .fontWeight(.semibold)
+                    Spacer()
+                    Text("LOCAL · BATCH", bundle: bundle)
+                        .font(.caption2)
+                        .fontWeight(.semibold)
+                        .padding(.horizontal, 8)
+                        .padding(.vertical, 4)
+                        .background(.quaternary, in: Capsule())
+                }
             }
 
             Text(
@@ -949,79 +958,132 @@ private struct CohereLocalSettingsView: View {
     private var modelCard: some View {
         GroupBox {
 
```

**File**: `TypeWhisperPluginSDK/Plugins/CohereLocalPlugin/Localizable.xcstrings` (modified, +3/-3)
```diff
@@ -1025,18 +1025,18 @@
         }
       }
     },
-    "This removes the selected Cohere model. Shared runtime files remain while another variant is installed.": {
+    "This removes %@. Shared runtime files remain while another variant is installed.": {
       "localizations": {
         "de": {
           "stringUnit": {
             "state": "translated",
-            "value": "Dadurch wird das ausgewählte Cohere-Modell entfernt. Gemeinsam genutzte Laufzeitdateien bleiben erhalten, solange eine andere Variante installiert ist."
+            "value": "Dadurch wird %@ entfernt. Gemeinsam genutzte Laufzeitdateien bleiben erhalten, solange eine andere Variante installiert ist."
           }
         },
         "zh-Hans": {
           "stringUnit": {
             "state": "translated",
-            "value": "这将移除选定的 Cohere 模型。如果安装了其他变体，共享运行时文件将保留。"
+            "value": "这将移除 %@。如果安装了其他变体，共享运行时文件将保留。"
           }
         }
       }
```

**File**: `TypeWhisperPluginSDK/Plugins/ParakeetPlugin/ParakeetPlugin.swift` (modified, +122/-115)
```diff
@@ -667,7 +667,17 @@ final class ParakeetPlugin: NSObject, DictionaryTermHintSourceProgressTranscript
                     : try await reserveDownloadSpace(for: version)
                 defer { spaceReservation?.release() }
                 try await ensureVocabularyAsset(for: version)
-                models = try await AsrModels.downloadAndLoad(version: version.asrModelVersion)
+                models = try await AsrModels.downloadAndLoad(
+                    version: version.asrModelVersion,
+                    progressHandler: { [weak self] progress in
+                        guard let self, self.modelState == .downloading,
+                              case .downloading = progress.phase else { return }
+                        self.downloadProgress = Self.downloadProgress(
+                            after: self.downloadProgress,
+                            downloadFraction: progress.fractionCompleted
+                        )
+                    }
+                )
             } else {
                 models = try Self.loadInstalledModels(version: version)
             }
@@ -710,6 +720,15 @@ final class ParakeetPlugin: NSObject, DictionaryTermHintSourceProgressTranscript
         }
     }
 
+    /// Maps a FluidAudio download-phase fraction onto the 10-70% band that precedes model
+    /// loading. FluidAudio spends the first half of each operation on the download and
+    /// restarts its fraction for every model file it loads, so the value never moves backwards.
+    static func downloadProgress(after current: Double, downloadFraction: Double) -> Double {
+        guard downloadFraction.isFinite else { return current }
+        let fraction = min(max(downloadFraction * 2, 0), 1)
+        return max(current, 0.1 + fraction * 0.6)
+    }
+
     /// FluidAudio's high-level loaders can delete and re-download a corrupt cache,
     /// even when every file exists. Passive restore must use local Core ML loading.
     static func loadInstalledModels(version: ParakeetVersion, directory: URL? = nil) throws -> AsrModels {
@@ -1166,7 +1185,7 @@ private struct ParakeetSettingsView: View {
     @State private var selectedVersion: ParakeetVersion = .v3
     @State private var modelState: ParakeetModelState = .notLoaded
     @State private var downloadProgress: Double = 0
-    @State private var selectedModelDownloaded = false
+    @State private var downloadedVersions: Set<ParakeetVersion> = []
     @State private var hfTokenInput = ""
     @State private var showHfToken = false
     @State private var isValidatingToken = false
@@ -1192,15 +1211,6 @@ private struct ParakeetSettingsView: View {
     var body: some View {
         VStack(spacing: 0) {
             VStack(alignment: .leading, spacing: 16) {
-                Text("Parakeet")
-                    .font(.headline)
-
-                Text(selectedVersion.settingsDescription(bundle: bundle))
-                    .font(.callout)
-                    .foregroundStyle(.secondary)
-
-                Divider()
-
                 VStack(alignment: .leading, spacing: 8) {
                     Text("Hugging Face Token", bundle: bundle)
                         .font(.subheadline)
@@ -1270,96 +1280,15 @@ private struct ParakeetSettingsView: View {
 
                 Divider()
 
-                // Model version picker
-                HStack {
+                VStack(alignment: .leading, spacing: 12) {
                     Text("Model Version", bundle: bundle)
-                    Spacer()
-                    Picker("", selection: $selectedVersion) {
-                        ForEach(ParakeetVersion.allCases, id: \.self) { version in
-                            Text(version.modelDef.displayName).tag(version)
-                        }
-                    }
-                    .labelsHidden()
-                    .pickerStyle(.segmented)
-                    .fixedSize()
-                    .disabled(modelState == .downloading)
-                }
+                        .font(.subheadline)
+                        .fontWeight(.medium)
 
-                // Model info and action
-                HStack {
-                    VStack(alignment: .leading, spacing: 2) {
-                        Text(selectedVersion.modelDef.displayName)
-                            .font(.body)
-                        Text("\(selectedVersion.modelDef.sizeDescription) - RAM: \(selectedVersion.modelDef.ramRequirement)")
-                            .font(.caption)
-                            .foregroundStyle(.secondary)
-                    }
-
-                    Spacer()
-
-                    switch modelState {
-                    case .notLoaded:
-                        Button(
-                            selectedModelDownloaded
-                                ? String(localized: "Load", bundle: bundle)
-                                : String(localized: "Download & Load", bundle: bundle)
-                        ) {
-                            modelState = 
```

**File**: `TypeWhisperPluginSDK/Plugins/ParakeetPlugin/Tests/ParakeetPluginTests.swift` (modified, +12/-0)
```diff
@@ -527,6 +527,18 @@ final class ParakeetPluginTests: XCTestCase {
         XCTAssertNil(ParakeetPlugin.sourceProgress(fromFraction: 0.5, totalDuration: 0))
     }
 
+    func testDownloadProgressFollowsDownloadWithinLoadingBand() {
+        XCTAssertEqual(ParakeetPlugin.downloadProgress(after: 0.1, downloadFraction: 0.25), 0.4, accuracy: 0.0001)
+        XCTAssertEqual(ParakeetPlugin.downloadProgress(after: 0.1, downloadFraction: 0.5), 0.7, accuracy: 0.0001)
+        XCTAssertEqual(ParakeetPlugin.downloadProgress(after: 0.1, downloadFraction: 1), 0.7, accuracy: 0.0001)
+    }
+
+    func testDownloadProgressNeverMovesBackwards() {
+        XCTAssertEqual(ParakeetPlugin.downloadProgress(after: 0.55, downloadFraction: 0), 0.55)
+        XCTAssertEqual(ParakeetPlugin.downloadProgress(after: 0.55, downloadFraction: -1), 0.55)
+        XCTAssertEqual(ParakeetPlugin.downloadProgress(after: 0.3, downloadFraction: .nan), 0.3)
+    }
+
     func testSourceProgressObservationOnlyStartsForFluidAudioProgressRange() {
         XCTAssertFalse(ParakeetPlugin.shouldObserveSourceProgress(sampleCount: 160_000))
         XCTAssertFalse(ParakeetPlugin.shouldObserveSourceProgress(sampleCount: 240_000))
```

**File**: `TypeWhisperPluginSDK/Plugins/ScriptPlugin/ScriptPlugin.swift` (modified, +8/-10)
```diff
@@ -318,7 +318,6 @@ enum ScriptError: LocalizedError {
 
 struct ScriptSettingsView: View {
     @ObservedObject var service: ScriptService
-    @Environment(\.dismiss) private var dismiss
     @Environment(\.pluginSettingsClose) private var closeSettings
     @State private var editingScript: ScriptConfig?
 
@@ -377,20 +376,19 @@ struct ScriptSettingsView: View {
                 .listStyle(.inset)
             }
 
-            Divider()
+            // Embedded in the host's settings page there is nothing to close.
+            if let closeSettings {
+                Divider()
 
-            HStack {
-                Spacer()
-                Button(String(localized: "Done", bundle: bundle)) {
-                    if let closeSettings {
+                HStack {
+                    Spacer()
+                    Button(String(localized: "Done", bundle: bundle)) {
                         closeSettings()
-                    } else {
-                        dismiss()
                     }
+                    .keyboardShortcut(.cancelAction)
                 }
-                .keyboardShortcut(.cancelAction)
+                .padding()
             }
-            .padding()
         }
         .sheet(item: $editingScript) { script in
             ScriptEditView(
```

**File**: `TypeWhisperPluginSDK/Plugins/WebhookPlugin/WebhookPlugin.swift` (modified, +8/-10)
```diff
@@ -494,7 +494,6 @@ struct ExampleWebhookEditorState {
 
 struct ExampleWebhookSettingsView: View {
     @ObservedObject var service: ExampleWebhookService
-    @Environment(\.dismiss) private var dismiss
     @Environment(\.pluginSettingsClose) private var closeSettings
     @State private var editorPresentation = ExampleWebhookEditorPresentation()
 
@@ -568,20 +567,19 @@ struct ExampleWebhookSettingsView: View {
                 .listStyle(.inset)
             }
 
-            Divider()
+            // Embedded in the host's settings page there is nothing to close.
+            if let closeSettings {
+                Divider()
 
-            HStack {
-                Spacer()
-                Button(String(localized: "Done", bundle: bundle)) {
-                    if let closeSettings {
+                HStack {
+                    Spacer()
+                    Button(String(localized: "Done", bundle: bundle)) {
                         closeSettings()
-                    } else {
-                        dismiss()
                     }
+                    .keyboardShortcut(.cancelAction)
                 }
-                .keyboardShortcut(.cancelAction)
+                .padding()
             }
-            .padding()
         }
     }
 }
```

---

### Incident Patch 7: `f9ef5f30` (2026-10-01)
**Commit Message**: Distinguish selected, installed, loaded, and tested models during setup (#1406)

Keep setup incomplete until the selected engine can prepare for transcription and microphone and Accessibility permissions are granted. Persist successful tests for the exact provider/model only after a new completed text insertion, excluding cancellation feedback and stale results. Preserve deferred setup progress and register the regression tests in the Xcode target.

Closes #1335.

**File**: `TypeWhisper.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -138,6 +138,7 @@
 		2F4D6A8B0C1E3F5A7B9D2C50 /* IndicatorTranscriptPreviewSizingTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2F4D6A8B0C1E3F5A7B9D2C51 /* IndicatorTranscriptPreviewSizingTests.swift */; };
 		91B4D7E2C5A809F1632E4B7C /* PluginRegistryServiceTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 91B4D7E2C5A809F1632E4B7D /* PluginRegistryServiceTests.swift */; };
 		545000000000000000000002 /* SetupWizardRecommendationAvailabilityTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 545000000000000000000001 /* SetupWizardRecommendationAvailabilityTests.swift */; };
+		545000000000000000000004 /* SetupWizardTrialSignalTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 545000000000000000000003 /* SetupWizardTrialSignalTests.swift */; };
 		91B4D7E2C5A809F1632E4B7E /* StreamingHandlerTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 91B4D7E2C5A809F1632E4B7F /* StreamingHandlerTests.swift */; };
 		9A584149706C7567496E0100 /* XAIPluginTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9A584149706C7567496E0101 /* XAIPluginTests.swift */; };
 		9A584149706C7567496E0200 /* XAIPlugin.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9A584149706C7567496E0210 /* XAIPlugin.swift */; };
@@ -1181,6 +1182,7 @@
 		2A7B3C4D5E6F708192A3B4C7 /* PromptActionsViewModelWizardTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = PromptActionsViewModelWizardTests.swift; sourceTree = "<group>"; };
 		91B4D7E2C5A809F1632E4B7D /* PluginRegistryServiceTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = PluginRegistryServiceTests.swift; sourceTree = "<group>"; };
 		545000000000000000000001 /* SetupWizardRecommendationAvailabilityTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = SetupWizardRecommendationAvailabilityTests.swift; sourceTree = "<group>"; };
+		545000000000000000000003 /* SetupWizardTrialSignalTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = SetupWizardTrialSignalTests.swift; sourceTree = "<group>"; };
 		D4A100000000000000000004 /* RecorderTranscriptionBufferTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = RecorderTranscriptionBufferTests.swift; sourceTree = "<group>"; };
 		91B4D7E2C5A809F1632E4B7F /* StreamingHandlerTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = StreamingHandlerTests.swift; sourceTree = "<group>"; };
 		9A584149706C7567496E0101 /* XAIPluginTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = XAIPluginTests.swift; sourceTree = "<group>"; };
@@ -2966,6 +2968,7 @@
 				103600000000000000000002 /* MLXPluginModelStorageTests.swift */,
 				91B4D7E2C5A809F1632E4B7D /* PluginRegistryServiceTests.swift */,
 				545000000000000000000001 /* SetupWizardRecommendationAvailabilityTests.swift */,
+				545000000000000000000003 /* SetupWizardTrialSignalTests.swift */,
 				B2D4F6A8C0E2143F9B7D5C1A /* PromptActionTemperaturePersistenceTests.swift */,
 				FEEDFACE00000000000000B1 /* PromptProcessingModelResolutionTests.swift */,
 				2A7B3C4D5E6F708192A3B4C7 /* PromptActionsViewModelWizardTests.swift */,
@@ -4911,6 +4914,7 @@
 				F18A00000000000000000006 /* FillerWordsPlugin.swift in Sources */,
 				91B4D7E2C5A809F1632E4B7C /* PluginRegistryServiceTests.swift in Sources */,
 				545000000000000000000002 /* SetupWizardRecommendationAvailabilityTests.swift in Sources */,
+				545000000000000000000004 /* SetupWizardTrialSignalTests.swift in Sources */,
 				A1C3E59B7D1042F9A8C6E2B1 /* PromptActionTemperaturePersistenceTests.swift in Sources */,
 				FEEDFACE00000000000000A1 /* PromptProcessingModelResolutionTests.swift in Sources */,
 				1F7A2C3D4E5B60718293A4C7 /* PromptActionsViewModelWizardTests.swift in Sources */,
```

**File**: `TypeWhisper/App/UserDefaultsKeys.swift` (modified, +3/-0)
```diff
@@ -73,6 +73,9 @@ enum UserDefaultsKeys {
     // MARK: - Home / Setup
     static let setupWizardCompleted = "setupWizardCompleted"
     static let setupWizardCurrentStep = "setupWizardCurrentStep"
+    /// Exact provider/model selections tested through the real dictation path.
+    /// Older provider-only records cannot establish which model was tested.
+    static let setupWizardTestedSelections = "setupWizardTestedSelections"
     /// Dev-tool launch mode that defers startup reads of privacy-protected app data.
     static let devPrivacyQuietMode = "devPrivacyQuietMode"
 
```

**File**: `TypeWhisper/Resources/Localizable.xcstrings` (modified, +58/-0)
```diff
@@ -13276,6 +13276,35 @@
         }
       }
     },
+    "Finish Later" : {
+      "extractionState" : "manual",
+      "localizations" : {
+        "en" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Finish Later"
+          }
+        },
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Später abschließen"
+          }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "後で完了"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "稍后完成"
+          }
+        }
+      }
+    },
     "Finish the Discord authorization flow in your browser, then refresh the status here." : {
       "comment" : "A message that instructs the user to finish the Discord authorization flow and refresh the status.",
       "isCommentAutoGenerated" : true,
@@ -22891,6 +22920,35 @@
         }
       }
     },
+    "Press Command Return to finish setup later." : {
+      "extractionState" : "manual",
+      "localizations" : {
+        "en" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Press Command Return to finish setup later."
+          }
+        },
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Drücke Befehlstaste Return, um das Setup später abzuschließen."
+          }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Command＋Returnキーを押すと、設定の完了を後回しにできます。"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "按 Command＋Return 键，稍后再完成设置。"
+          }
+        }
+      }
+    },
     "Press Enter Automatically" : {
       "localizations" : {
         "ja" : {
```

**File**: `TypeWhisper/ViewModels/DictationViewModel.swift` (modified, +13/-0)
```diff
@@ -41,6 +41,12 @@ struct DictationSessionSnapshot: Sendable, Equatable {
     let error: String?
 }
 
+struct DictationInsertionCompletion: Sendable, Equatable {
+    let id: UUID
+    let providerId: String
+    let modelId: String?
+}
+
 @MainActor
 enum DictationLanguageResolver {
     static func resolve(
@@ -314,6 +320,8 @@ final class DictationViewModel: ObservableObject {
     }
     @Published private(set) var lastTranscribedText: String?
     @Published private(set) var lastTranscriptionLanguage: String?
+    /// Updated only by the completed text-insertion path, never by indicator feedback.
+    @Published private(set) var lastSuccessfulDictationInsertion: DictationInsertionCompletion?
     @Published var hotkeyLabelsVersion = 0
     var hybridHotkeyLabel: String { Self.loadHotkeyLabel(for: .hybrid) }
     var pttHotkeyLabel: String { Self.loadHotkeyLabel(for: .pushToTalk) }
@@ -2841,6 +2849,11 @@ final class DictationViewModel: ObservableObject {
                     self.pinnedInsertionTarget = nil
 
                     if didInsertText {
+                        lastSuccessfulDictationInsertion = DictationInsertionCompletion(
+                            id: transcriptionID,
+                            providerId: result.engineUsed,
+                            modelId: transcription.modelId
+                        )
                         logger.info("Stop timing: text inserted elapsedMs=\(stopElapsedMs(), privacy: .public)")
                         EventBus.shared.emit(.textInserted(TextInsertedPayload(
                             text: insertionText,
```

**File**: `TypeWhisper/ViewModels/HomeViewModel.swift` (modified, +10/-0)
```diff
@@ -65,6 +65,16 @@ final class HomeViewModel: ObservableObject {
         showSetupWizard = false
     }
 
+    /// Dismisses the wizard without marking setup complete (issue #1335): the
+    /// wizard resurfaces on next launch at the persisted step, so explicitly
+    /// skipped model setup stays discoverable instead of implying readiness.
+    func deferSetupWizard() {
+        showSetupWizard = false
+        // The didSet above just persisted setupWizardCompleted = true;
+        // deferring is not completing, so restore the incomplete state.
+        UserDefaults.standard.set(false, forKey: UserDefaultsKeys.setupWizardCompleted)
+    }
+
     func resetSetupWizard() {
         UserDefaults.standard.set(0, forKey: UserDefaultsKeys.setupWizardCurrentStep)
         showSetupWizard = true
```

**File**: `TypeWhisper/Views/SetupWizardView.swift` (modified, +188/-16)
```diff
@@ -12,7 +12,8 @@ struct SetupWizardView: View {
 
     @State private var currentStep: Int
     @State private var selectedHotkeyMode: HotkeySlotType
-    @State private var trialSuccess = false
+    @AppStorage(UserDefaultsKeys.setupWizardTestedSelections) private var testedSelectionsData = Data()
+    @State private var trialSignal = SetupWizardTrialSignal()
     @State private var trialText = ""
     @State private var didAnnounceInitialStep = false
     @State private var isPreparingAppleSpeechFallback = false
@@ -112,7 +113,7 @@ struct SetupWizardView: View {
     }
 
     private func restartWizardFromBeginning() {
-        trialSuccess = false
+        trialSignal.reset()
         trialText = ""
         manuallySelectedSetupProviderId = nil
         UserDefaults.standard.set(0, forKey: UserDefaultsKeys.setupWizardCurrentStep)
@@ -291,9 +292,12 @@ struct SetupWizardView: View {
             return localizedAppText("Grant Microphone Access", de: "Mikrofonzugriff erlauben")
         }
 
-        return currentWizardStep == .finish
-            ? localizedAppText("Complete Setup", de: "Setup abschließen")
-            : localizedAppText("Continue", de: "Weiter")
+        if currentWizardStep == .finish {
+            return setupReadiness.canCompleteSetup
+                ? localizedAppText("Complete Setup", de: "Setup abschließen")
+                : String(localized: "Finish Later")
+        }
+        return localizedAppText("Continue", de: "Weiter")
     }
 
     private var primaryKeyboardShortcut: KeyboardShortcut {
@@ -304,7 +308,9 @@ struct SetupWizardView: View {
 
     private var primaryActionAccessibilityHint: String {
         if currentWizardStep == .finish {
-            return localizedAppText("Press Command Return to complete setup.", de: "Drücke Befehlstaste Return, um das Setup abzuschließen.")
+            return setupReadiness.canCompleteSetup
+                ? localizedAppText("Press Command Return to complete setup.", de: "Drücke Befehlstaste Return, um das Setup abzuschließen.")
+                : String(localized: "Press Command Return to finish setup later.")
         }
 
         return localizedAppText("Press Return to continue.", de: "Drücke Return, um fortzufahren.")
@@ -332,7 +338,12 @@ struct SetupWizardView: View {
     }
 
     private func completeSetupAndOpenHome() {
-        HomeViewModel.shared.completeSetupWizard()
+        // A past test never substitutes for the current engine and permissions.
+        if setupReadiness.canCompleteSetup {
+            HomeViewModel.shared.completeSetupWizard()
+        } else {
+            HomeViewModel.shared.deferSetupWizard()
+        }
         SettingsNavigationCoordinator.shared?.navigate(to: .home)
         dismiss()
 
@@ -415,7 +426,7 @@ struct SetupWizardView: View {
                 description: localizedAppText("Required to type into other apps.", de: "Erforderlich, um in andere Apps zu schreiben."),
                 systemImage: "figure.stand",
                 isGranted: !dictation.needsAccessibilityPermission,
-                isRequired: false,
+                isRequired: true,
                 action: { dictation.requestAccessibilityPermission() }
             )
 
@@ -1200,33 +1211,52 @@ struct SetupWizardView: View {
             }
         }
         .onChange(of: dictation.state) { oldValue, newValue in
-            if case .inserting = oldValue, case .idle = newValue {
+            let testedSelection = trialSignal.observe(
+                oldState: oldValue,
+                newState: newValue,
+                selection: selectedSetupModel,
+                completedInsertion: dictation.lastSuccessfulDictationInsertion
+            )
+            if let testedSelection, setupReadiness.canCompleteSetup {
                 withAnimation(.spring(duration: 0.35)) {
-                    trialSuccess = true
+                    markSetupWizardSelectionTested(testedSelection)
                 }
             }
         }
+        .onChange(of: selectedSetupModel) { _, _ in
+            // Never attribute an in-flight test to a different provider/model.
+            trialSignal.reset()
+        }
+        .onDisappear {
+            trialSignal.reset()
+        }
         .task {
             try? await Task.sleep(for: .milliseconds(50))
             isTrialFieldFocused = true
         }
     }
 
     private var readinessIcon: String {
-        hasEngineReadyForSetupTest && hasAnyTriggerHotkey ? "sparkles" : "exclamationmark.triangle.fill"
+        setupReadiness.canCompleteSetup && hasAnyTriggerHotkey ? "sparkles" : "exclamationmark.triangle.fill"
     }
 
     private var readinessColor: Color {
-        hasEngineReadyForSetupTest && hasAnyTriggerHotkey ? .blue : .orange
+        setupReadiness.canCompleteSetup && hasAnyTriggerHotkey ? .blue : .orange
     }
 
     private var readinessTitle: String {
-        hasEngineReadyForSetupTest && hasAnyTriggerHotkey
+        setupReadiness.canCompleteSetup && hasAnyT
```

**File**: `TypeWhisperTests/SetupWizardTrialSignalTests.swift` (added, +352/-0)
```diff
@@ -0,0 +1,352 @@
+import XCTest
+@testable import TypeWhisper
+
+/// Issue #1335: the setup wizard must distinguish selected, installed, loaded,
+/// and tested models instead of treating a selected model ID as readiness.
+final class SetupWizardTrialSignalTests: XCTestCase {
+    // MARK: - evaluate
+
+    func testRealInsertionCycleGrantsTestedState() {
+        let armed = SetupWizardTrialSignal.evaluate(
+            oldState: .processing, newState: .inserting,
+            enteredInsertingFromProcessing: false)
+        XCTAssertFalse(armed.granted)
+        XCTAssertTrue(armed.enteredInsertingFromProcessing)
+
+        let granted = SetupWizardTrialSignal.evaluate(
+            oldState: .inserting, newState: .idle,
+            enteredInsertingFromProcessing: armed.enteredInsertingFromProcessing)
+        XCTAssertTrue(granted.granted)
+        XCTAssertFalse(granted.enteredInsertingFromProcessing)
+    }
+
+    func testToastFeedbackCycleDoesNotGrantTestedState() {
+        // Notch/toast feedback passes through .inserting without a
+        // transcription having run.
+        let armed = SetupWizardTrialSignal.evaluate(
+            oldState: .idle, newState: .inserting,
+            enteredInsertingFromProcessing: false)
+        XCTAssertFalse(armed.granted)
+        XCTAssertFalse(armed.enteredInsertingFromProcessing)
+
+        let done = SetupWizardTrialSignal.evaluate(
+            oldState: .inserting, newState: .idle,
+            enteredInsertingFromProcessing: armed.enteredInsertingFromProcessing)
+        XCTAssertFalse(done.granted)
+    }
+
+    func testToastDuringRecordingDoesNotGrantTestedState() {
+        let armed = SetupWizardTrialSignal.evaluate(
+            oldState: .recording, newState: .inserting,
+            enteredInsertingFromProcessing: false)
+        XCTAssertFalse(armed.granted)
+
+        let done = SetupWizardTrialSignal.evaluate(
+            oldState: .inserting, newState: .idle,
+            enteredInsertingFromProcessing: armed.enteredInsertingFromProcessing)
+        XCTAssertFalse(done.granted)
+    }
+
+    func testInsertionFailureDoesNotGrantTestedState() {
+        let armed = SetupWizardTrialSignal.evaluate(
+            oldState: .processing, newState: .inserting,
+            enteredInsertingFromProcessing: false)
+        XCTAssertFalse(armed.granted)
+
+        let failed = SetupWizardTrialSignal.evaluate(
+            oldState: .inserting, newState: .error("boom"),
+            enteredInsertingFromProcessing: armed.enteredInsertingFromProcessing)
+        XCTAssertFalse(failed.granted)
+        // The flag resets so a later toast cycle cannot piggyback on it.
+        XCTAssertFalse(failed.enteredInsertingFromProcessing)
+
+        let done = SetupWizardTrialSignal.evaluate(
+            oldState: .inserting, newState: .idle,
+            enteredInsertingFromProcessing: failed.enteredInsertingFromProcessing)
+        XCTAssertFalse(done.granted)
+    }
+
+    func testReentrantInsertingSetKeepsFlagAndGrantsOnIdle() {
+        // The real insertion path can set .inserting twice (post-processing
+        // fallback toast); the second set must not clear the flag.
+        let armed = SetupWizardTrialSignal.evaluate(
+            oldState: .processing, newState: .inserting,
+            enteredInsertingFromProcessing: false)
+        let reentrant = SetupWizardTrialSignal.evaluate(
+            oldState: .inserting, newState: .inserting,
+            enteredInsertingFromProcessing: armed.enteredInsertingFromProcessing)
+        XCTAssertFalse(reentrant.granted)
+        XCTAssertTrue(reentrant.enteredInsertingFromProcessing)
+
+        let granted = SetupWizardTrialSignal.evaluate(
+            oldState: .inserting, newState: .idle,
+            enteredInsertingFromProcessing: reentrant.enteredInsertingFromProcessing)
+        XCTAssertTrue(granted.granted)
+    }
+
+    // MARK: - engineIsReadyOrRestorable (#1335 invariants)
+
+    func testSelectedModelIdAloneIsNotAnInputToReadiness() {
+        // A selected or persisted model ID alone must never produce a
+        // loaded/ready claim: without configured, restorable, or fallback
+        // state there is no readiness, regardless of selection.
+        XCTAssertFalse(TranscriptionEngineReadiness.engineIsReadyOrRestorable(
+            authAvailable: true,
+            isConfigured: false,
+            hasPersistedRestorableModel: false,
+            hasPreparationFallback: false))
+    }
+
+    func testRestorableInstalledModelCountsAsReady() {
+        // Auto-unloaded model with persisted installed assets: restorable on
+        // demand, so the setup test may run (the test itself is the proof).
+        XCTAssertTrue(TranscriptionEngineReadiness.engineIsReadyOrRestorable(
+            authAvailable: true,
+            isConfigured: false,
+            hasPersistedRestorableModel: true,
+            hasPreparationFallback: false))
+    }
+
+    func testConfiguredEngineCountsAsReady() {
+ 
```

**File**: `TypeWhisperTests/TypeWhisperIntegrationTests.swift` (modified, +5/-0)
```diff
@@ -4202,6 +4202,10 @@ final class TypeWhisperIntegrationTests: XCTestCase {
         XCTAssertEqual(workflowPlugin.restoredModelId, "beta")
         XCTAssertEqual(workflowPlugin.transcribedModelId, "beta")
         XCTAssertEqual(workflowPlugin.selectedModelId, "alpha")
+        let insertion = await MainActor.run { apiContext.dictationViewModel.lastSuccessfulDictationInsertion }
+        XCTAssertEqual(insertion?.id.uuidString, startID)
+        XCTAssertEqual(insertion?.providerId, workflowPlugin.providerId)
+        XCTAssertEqual(insertion?.modelId, "beta")
     }
 
     func testDictationEndpointsSpeakCompletedTranscriptionOnly() async throws {
@@ -16192,6 +16196,7 @@ final class TypeWhisperIntegrationTests: XCTestCase {
             context.dictationViewModel.actionFeedbackMessage,
             try TestSupport.localizedCatalogValueForCurrentLocale(for: "Cancelled")
         )
+        XCTAssertNil(context.dictationViewModel.lastSuccessfulDictationInsertion)
     }
 
     @MainActor
```

---

### Incident Patch 8: `b6529954` (2026-09-29)
**Commit Message**: Fix API target-language translation and session ownership (#1407)

Translate full transcripts and segment text consistently into the requested target language, with matching response metadata. Preserve request ownership across asynchronous translation sessions and reject invalid fallback results. Closes #1299.

**File**: `TypeWhisper.xcodeproj/project.pbxproj` (modified, +12/-0)
```diff
@@ -210,6 +210,9 @@
 		AA00000000000000000042 /* APIRouter.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000042 /* APIRouter.swift */; };
 		AA00000000000000000043 /* HTTPServer.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000043 /* HTTPServer.swift */; };
 		AA00000000000000000044 /* APIHandlers.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000044 /* APIHandlers.swift */; };
+		AA12990000000000000001 /* APITranslation.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB12990000000000000001 /* APITranslation.swift */; };
+		AA12990000000000000002 /* APIHandlersTargetLanguageTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB12990000000000000002 /* APIHandlersTargetLanguageTests.swift */; };
+		AA12990000000000000003 /* TranslationServiceBatchTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB12990000000000000003 /* TranslationServiceBatchTests.swift */; };
 		AA00000000000000000045 /* APIServerViewModel.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000045 /* APIServerViewModel.swift */; };
 		AA00000000000000000046 /* AdvancedSettingsView.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000046 /* AdvancedSettingsView.swift */; };
 		AA00000000000000000340 /* SpokenPunctuationSettingsSection.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000340 /* SpokenPunctuationSettingsSection.swift */; };
@@ -818,6 +821,9 @@
 		BB00000000000000000042 /* APIRouter.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = APIRouter.swift; sourceTree = "<group>"; };
 		BB00000000000000000043 /* HTTPServer.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = HTTPServer.swift; sourceTree = "<group>"; };
 		BB00000000000000000044 /* APIHandlers.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = APIHandlers.swift; sourceTree = "<group>"; };
+		BB12990000000000000001 /* APITranslation.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = APITranslation.swift; sourceTree = "<group>"; };
+		BB12990000000000000002 /* APIHandlersTargetLanguageTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = APIHandlersTargetLanguageTests.swift; sourceTree = "<group>"; };
+		BB12990000000000000003 /* TranslationServiceBatchTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = TranslationServiceBatchTests.swift; sourceTree = "<group>"; };
 		BB00000000000000000045 /* APIServerViewModel.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = APIServerViewModel.swift; sourceTree = "<group>"; };
 		BB00000000000000000046 /* AdvancedSettingsView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AdvancedSettingsView.swift; sourceTree = "<group>"; };
 		BB00000000000000000340 /* SpokenPunctuationSettingsSection.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SpokenPunctuationSettingsSection.swift; sourceTree = "<group>"; };
@@ -2114,6 +2120,8 @@
 				BB00000000000000000042 /* APIRouter.swift */,
 				BB00000000000000000043 /* HTTPServer.swift */,
 				BB00000000000000000044 /* APIHandlers.swift */,
+				BB12990000000000000001 /* APITranslation.swift */,
+				BB12990000000000000002 /* APIHandlersTargetLanguageTests.swift */,
 			);
 			path = HTTPServer;
 			sourceTree = "<group>";
@@ -2932,6 +2940,7 @@
 				91B4D7E2C5A809F1632E4B7F /* StreamingHandlerTests.swift */,
 				B26D2C342D877030A62CE027 /* Support */,
 				05313C25F9E79BCFC02899F2 /* TextDiffServiceTests.swift */,
+				BB12990000000000000003 /* TranslationServiceBatchTests.swift */,
 				F3B9EC248517FD4849BEF54D /* ModelManagerRestoreAfterAutoUnloadTests.swift */,
 			);
 			name = TypeWhisperTests;
@@ -4775,6 +4784,8 @@
 				24FFE19AC026C48AE32BCD7D /* SpeechPunctuationServiceTests.swift in Sources */,
 				540AE1FA22F41A63C78B89EC /* NumberWordNormalizerTests.swift in Sources */,
 				E8FB3269B522A8923134AD9A /* TranscriptionNormalizationServiceTests.swift in Sources */,
+				AA12990000000000000002 /* APIHandlersTargetLanguageTests.swift in Sources */,
+				AA12990000000000000003 /* TranslationServiceBatchTests.swift in Sources */,
 				24FFE19AC026C48AE32BCD7E /* DictationPunctuationProfileStoreTests.swift in Sources */,
 				24FFE19AC026C48AE32BCD7F /* PunctuationRulesLoaderTests.swift in Sources */,
 				24FFE19AC026C48AE32BCD80 /* PunctuationStrategyResolverTests.swift in Sources */,
@@ -4928,6 +4939,7 @@
 				AA00000000000000000042 /* APIRouter.swift in Sources */,
 				AA00000000000000000043 /* HTTPServer.swift in Sources */,
 				AA00000000000000000044 /* APIHandlers.swift in Sources */,
+				AA12990000000000000001 /* APITranslation.swift in Sources */,
 				AA00000000000000000045 /* APIServerViewModel.swift in Sources */,
 				AA00000000000000000046 /
```

**File**: `TypeWhisper/Services/HTTPServer/APIHandlers.swift` (modified, +34/-22)
```diff
@@ -394,31 +394,36 @@ final class APIHandlers: @unchecked Sendable {
             )
 
             var finalText = result.text
+            var responseLanguage = result.detectedLanguage
+            var responseSegments = result.segments
             if let targetCode = options.targetLanguage {
                 #if canImport(Translation)
                 if #available(macOS 15, *), let ts = translationService as? TranslationService {
-                    if let targetNormalized = TranslationService.normalizedLanguageIdentifier(from: targetCode) {
-                        if targetCode.caseInsensitiveCompare(targetNormalized) != .orderedSame {
-                            apiLogger.info("API translation target normalized \(targetCode, privacy: .public) -> \(targetNormalized, privacy: .public)")
-                        }
-                        let target = Locale.Language(identifier: targetNormalized)
-                        let sourceRaw = result.detectedLanguage
-                        let sourceNormalized = TranslationService.normalizedLanguageIdentifier(from: sourceRaw)
-                        if let sourceRaw {
-                            if let sourceNormalized {
-                                if sourceRaw.caseInsensitiveCompare(sourceNormalized) != .orderedSame {
-                                    apiLogger.info("API translation source normalized \(sourceRaw, privacy: .public) -> \(sourceNormalized, privacy: .public)")
-                                }
-                            } else {
-                                apiLogger.warning("API translation source language \(sourceRaw, privacy: .public) invalid, using auto source")
-                            }
-                        }
-                        let sourceLanguage = sourceNormalized.map { Locale.Language(identifier: $0) }
+                    if let translation = APITranslation.resolve(
+                        targetCode: targetCode,
+                        detectedLanguage: result.detectedLanguage
+                    ) {
                         finalText = try await ts.translate(
                             text: finalText,
-                            to: target,
-                            source: sourceLanguage
+                            to: translation.target,
+                            source: translation.source,
+                            strict: true
                         )
+                        if options.responseFormat == "verbose_json" {
+                            responseSegments = try await APITranslation.translateSegments(
+                                result.segments,
+                                translation: translation,
+                                translateBatch: { texts, target, source in
+                                    try await ts.translateBatch(
+                                        texts: texts,
+                                        to: target,
+                                        source: source,
+                                        strict: true
+                                    )
+                                }
+                            )
+                        }
+                        responseLanguage = translation.targetIdentifier
                     } else {
                         apiLogger.error("API translation target language invalid: \(targetCode, privacy: .public)")
                     }
@@ -477,7 +482,7 @@ final class APIHandlers: @unchecked Sendable {
                     let segments: [SegmentEntry]
                 }
 
-                let segments = result.segments.map {
+                let segments = responseSegments.map {
                     SegmentEntry(
                         start: $0.start,
                         end: $0.end,
@@ -489,7 +494,7 @@ final class APIHandlers: @unchecked Sendable {
 
                 return .json(VerboseResponse(
                     text: finalText,
-                    language: result.detectedLanguage,
+                    language: responseLanguage,
                     duration: result.duration,
                     processing_time: result.processingTime,
                     engine: result.engineUsed,
@@ -508,14 +513,21 @@ final class APIHandlers: @unchecked Sendable {
 
                 return .json(TranscribeResponse(
                     text: finalText,
-                    language: result.detectedLanguage,
+                    language: responseLanguage,
                     duration: result.duration,
                     processing_time: result.processingTime,
                     engine: result.engineUsed,
                     model: modelId
                 ))
             }
         } catch {
+            // A strict translation preempted by a newer request is transient:
+            // report it as retryable instead of a generic server error.
+            #if canImport(Translation)
+            if case TranslationError.cancelled = error {
+                return .er
```

**File**: `TypeWhisper/Services/HTTPServer/APIHandlersTargetLanguageTests.swift` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+#if canImport(Translation)
+import XCTest
+@testable import TypeWhisper
+
+/// Covers the `target_language` handling of the /v1/transcribe API:
+/// language resolution is shared between the full-text and per-segment
+/// passes, segments keep their timing/speaker metadata, the response
+/// `language` reflects the target, and translation failures propagate.
+@available(macOS 15, *)
+final class APIHandlersTargetLanguageTests: XCTestCase {
+
+    // MARK: - APITranslation.resolve
+
+    func testResolveMapsTargetAndSourceLanguages() {
+        let translation = APITranslation.resolve(targetCode: "de", detectedLanguage: "en")
+        XCTAssertNotNil(translation)
+        XCTAssertEqual(translation?.targetIdentifier, "de")
+        XCTAssertEqual(translation?.target.minimalIdentifier, "de")
+        XCTAssertEqual(translation?.source?.minimalIdentifier, "en")
+    }
+
+    func testResolveNormalizesTargetIdentifier() {
+        // "german" is an alias; the normalized identifier is what the
+        // response `language` field must carry.
+        let translation = APITranslation.resolve(targetCode: "german", detectedLanguage: "en")
+        XCTAssertEqual(translation?.targetIdentifier, "de")
+    }
+
+    func testResolveNilTargetReturnsNil() {
+        // No target_language: response keeps source segments and language.
+        XCTAssertNil(APITranslation.resolve(targetCode: nil, detectedLanguage: "en"))
+    }
+
+    func testResolveInvalidTargetReturnsNil() {
+        XCTAssertNil(APITranslation.resolve(targetCode: "xx-invalid", detectedLanguage: "en"))
+    }
+
+    func testResolveInvalidSourceFallsBackToAutoDetect() {
+        let translation = APITranslation.resolve(targetCode: "de", detectedLanguage: "not-a-language")
+        XCTAssertNotNil(translation)
+        XCTAssertNil(translation?.source)
+        XCTAssertEqual(translation?.targetIdentifier, "de")
+    }
+
+    func testResolveNilDetectedLanguageFallsBackToAutoDetect() {
+        let translation = APITranslation.resolve(targetCode: "de", detectedLanguage: nil)
+        XCTAssertNotNil(translation)
+        XCTAssertNil(translation?.source)
+    }
+
+    // MARK: - APITranslation.translateSegments
+
+    func testTranslateSegmentsPreservesTimingSpeakerAndOrder() async throws {
+        let translation = try XCTUnwrap(APITranslation.resolve(targetCode: "de", detectedLanguage: "en"))
+        let segments = [
+            TranscriptionSegment(text: "Hello world", start: 0.0, end: 1.5, speakerLabel: "A", speakerConfidence: 0.9),
+            TranscriptionSegment(text: "How are you", start: 1.5, end: 3.25),
+        ]
+
+        var batchedInputs: [[String]] = []
+        let out = try await APITranslation.translateSegments(segments, translation: translation) {
+            texts, target, source in
+            batchedInputs.append(texts)
+            XCTAssertEqual(target.minimalIdentifier, "de")
+            XCTAssertEqual(source?.minimalIdentifier, "en")
+            return texts.map { "[de] \($0)" }
+        }
+
+        XCTAssertEqual(batchedInputs, [["Hello world", "How are you"]], "all segments must go through one batch call")
+        XCTAssertEqual(out.count, 2)
+        XCTAssertEqual(out[0].text, "[de] Hello world")
+        XCTAssertEqual(out[0].start, 0.0, accuracy: 1e-9)
+        XCTAssertEqual(out[0].end, 1.5, accuracy: 1e-9)
+        XCTAssertEqual(out[0].speakerLabel, "A")
+        XCTAssertEqual(out[0].speakerConfidence, 0.9)
+        XCTAssertEqual(out[1].text, "[de] How are you")
+        XCTAssertEqual(out[1].start, 1.5, accuracy: 1e-9)
+        XCTAssertEqual(out[1].end, 3.25, accuracy: 1e-9)
+        XCTAssertNil(out[1].speakerLabel)
+        XCTAssertNil(out[1].speakerConfidence)
+    }
+
+    func testTranslateSegmentsSkipsEmptyText() async throws {
+        let translation = try XCTUnwrap(APITranslation.resolve(targetCode: "de", detectedLanguage: "en"))
+        let segments = [
+            TranscriptionSegment(text: "   ", start: 0.0, end: 1.0),
+            TranscriptionSegment(text: "Hi", start: 1.0, end: 2.0),
+        ]
+
+        var callCount = 0
+        var batched: [[String]] = []
+        let out = try await APITranslation.translateSegments(segments, translation: translation) {
+            texts, _, _ in
+            callCount += 1
+            batched.append(texts)
+            return texts.map { $0.uppercased() }
+        }
+
+        XCTAssertEqual(callCount, 1, "blank segment text must not hit the translation service")
+        XCTAssertEqual(batched, [["Hi"]])
+        XCTAssertEqual(out[0].text, "   ")
+        XCTAssertEqual(out[1].text, "HI")
+    }
+
+    func testTranslateSegmentsPropagatesTranslationError() async throws {
+        let translation = try XCTUnwrap(APITranslation.resolve(targetCode: "de", detectedLanguage: "en"))
+        struct TranslationBoom: Error {}
+        let segments = [TranscriptionSegment(text: "Hello", start: 0.0, end: 1.0)]
+
+        do {
+         
```

**File**: `TypeWhisper/Services/HTTPServer/APITranslation.swift` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+import Foundation
+import os
+
+private let apiTranslationLogger = Logger(
+    subsystem: Bundle.main.bundleIdentifier ?? "typewhisper-mac",
+    category: "APITranslation"
+)
+
+#if canImport(Translation)
+/// Resolved `target_language` translation context for the HTTP API.
+///
+/// The target/source language pair is resolved once and shared by the
+/// full-text and per-segment translation passes, so both translate with
+/// identical languages instead of each re-deriving them.
+@available(macOS 15, *)
+struct APITranslation {
+    /// Translation-framework target language.
+    let target: Locale.Language
+    /// Translation-framework source language; nil lets the framework auto-detect.
+    let source: Locale.Language?
+    /// Normalized target identifier, reported in the response `language` field
+    /// once translation has been applied.
+    let targetIdentifier: String
+
+    /// Resolves `targetCode` and the detected source language to framework
+    /// languages. Returns nil when `targetCode` is missing or not a valid
+    /// language identifier — callers then keep the untranslated
+    /// source-language response, matching the previous behavior.
+    static func resolve(targetCode: String?, detectedLanguage: String?) -> APITranslation? {
+        guard let targetNormalized = TranslationService.normalizedLanguageIdentifier(from: targetCode) else {
+            return nil
+        }
+        if let targetCode, targetCode.caseInsensitiveCompare(targetNormalized) != .orderedSame {
+            apiTranslationLogger.info(
+                "API translation target normalized \(targetCode, privacy: .public) -> \(targetNormalized, privacy: .public)"
+            )
+        }
+        let sourceRaw = detectedLanguage
+        let sourceNormalized = TranslationService.normalizedLanguageIdentifier(from: sourceRaw)
+        if let sourceRaw {
+            if let sourceNormalized {
+                if sourceRaw.caseInsensitiveCompare(sourceNormalized) != .orderedSame {
+                    apiTranslationLogger.info(
+                        "API translation source normalized \(sourceRaw, privacy: .public) -> \(sourceNormalized, privacy: .public)"
+                    )
+                }
+            } else {
+                apiTranslationLogger.warning(
+                    "API translation source language \(sourceRaw, privacy: .public) invalid, using auto source"
+                )
+            }
+        }
+        return APITranslation(
+            target: Locale.Language(identifier: targetNormalized),
+            source: sourceNormalized.map { Locale.Language(identifier: $0) },
+            targetIdentifier: targetNormalized
+        )
+    }
+
+    /// Translates every segment's text in a single translation session,
+    /// preserving start/end timestamps, speaker metadata, and segment order.
+    /// Segments with empty/blank text skip the service call. Batching keeps
+    /// long verbose responses from paying the per-request session setup cost
+    /// once per segment. A translation failure propagates to the caller (the
+    /// API maps it to HTTP 500) — this never returns source-language text
+    /// labeled as translated.
+    static func translateSegments(
+        _ segments: [TranscriptionSegment],
+        translation: APITranslation,
+        translateBatch: ([String], Locale.Language, Locale.Language?) async throws -> [String]
+    ) async throws -> [TranscriptionSegment] {
+        var texts: [String?] = Array(repeating: nil, count: segments.count)
+        var batchInputs: [String] = []
+        var batchIndices: [Int] = []
+        for (index, segment) in segments.enumerated() {
+            if segment.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
+                texts[index] = segment.text
+            } else {
+                batchIndices.append(index)
+                batchInputs.append(segment.text)
+            }
+        }
+        if !batchInputs.isEmpty {
+            // The batch contract preserves order; a count mismatch throws.
+            let results = try await translateBatch(batchInputs, translation.target, translation.source)
+            for (index, result) in zip(batchIndices, results) {
+                texts[index] = result
+            }
+        }
+        return segments.enumerated().map { index, segment in
+            TranscriptionSegment(
+                text: texts[index] ?? segment.text,
+                start: segment.start,
+                end: segment.end,
+                speakerLabel: segment.speakerLabel,
+                speakerConfidence: segment.speakerConfidence
+            )
+        }
+    }
+}
+#endif
```

**File**: `TypeWhisper/Services/TranslationService.swift` (modified, +413/-28)
```diff
@@ -4,6 +4,15 @@ import os
 #if canImport(Translation)
 import Translation
 
+/// Errors for strict translation requests (used by the HTTP API path).
+/// Non-strict callers keep the historical graceful fallback to the source text.
+enum TranslationError: Error, Equatable {
+    case timedOut
+    case cancelled
+    case noTranslation
+    case batchCountMismatch(expected: Int, actual: Int)
+}
+
 @available(macOS 15, *)
 @MainActor
 final class TranslationService: ObservableObject {
@@ -16,13 +25,67 @@ final class TranslationService: ObservableObject {
 
     private var sourceText = ""
     private var continuation: CheckedContinuation<String, Error>?
+    private var pendingStrict = false
     private var activeRequestId = "-"
+    private var batchRequest: BatchRequest?
+    /// Test seam: replaces the Translation-framework availability check.
+    var availabilityStub: ((String, Locale.Language?, Locale.Language) async -> LanguageAvailability.Status?)?
+    /// Test seam: overrides the batch watchdog duration.
+    var batchTimeoutOverride: Duration?
+    /// Test hook: requestId of the currently claimed batch request, if any.
+    var claimedBatchRequestId: String? { batchRequest?.requestId }
     private static let logger = Logger(subsystem: AppConstants.loggerSubsystem, category: "Translation")
 
+    /// One claimed batch request. The record is registered atomically with
+    /// the cancel-and-claim in `translateBatch` and stays registered while
+    /// the framework session runs, so the session result, the watchdog
+    /// timeout, and cancellation all funnel through `finish(with:)` and the
+    /// first terminal event wins. A late session result after a timeout or
+    /// cancellation is ignored instead of resuming twice.
+    private final class BatchRequest {
+        let requestId: String
+        let texts: [String]
+        let strict: Bool
+        private var continuation: CheckedContinuation<[String], Error>?
+        /// True only when the request completed via the framework session.
+        /// Timeout/cancellation fallbacks return the source texts terminally
+        /// and must not trigger the unchanged-result retry below.
+        private(set) var finishedBySession = false
+
+        init(requestId: String, texts: [String], strict: Bool, continuation: CheckedContinuation<[String], Error>) {
+            self.requestId = requestId
+            self.texts = texts
+            self.strict = strict
+            self.continuation = continuation
+        }
+
+        /// Resumes the continuation at most once; later calls are ignored.
+        func finish(with result: Result<[String], Error>, fromSession: Bool = false) {
+            guard let continuation else { return }
+            self.continuation = nil
+            finishedBySession = fromSession
+            switch result {
+            case .success(let values):
+                continuation.resume(returning: values)
+            case .failure(let error):
+                continuation.resume(throwing: error)
+            }
+        }
+
+        func cancel() {
+            finish(with: strict ? .failure(TranslationError.cancelled) : .success(texts))
+        }
+
+        func timeOut() {
+            finish(with: strict ? .failure(TranslationError.timedOut) : .success(texts))
+        }
+    }
+
     func translate(
         text: String,
         to target: Locale.Language,
-        source sourceLanguage: Locale.Language? = nil
+        source sourceLanguage: Locale.Language? = nil,
+        strict: Bool = false
     ) async throws -> String {
         let requestId = String(UUID().uuidString.prefix(8))
         let normalizedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
@@ -46,7 +109,8 @@ final class TranslationService: ObservableObject {
                 text: normalizedText,
                 source: sourceLanguage,
                 target: target,
-                english: english
+                english: english,
+                strict: strict
             )
         }
 
@@ -55,7 +119,8 @@ final class TranslationService: ObservableObject {
             text: normalizedText,
             source: sourceLanguage,
             target: target,
-            availabilityStatus: directStatus
+            availabilityStatus: directStatus,
+            strict: strict
         )
 
         // Some language pairs report "supported" but still produce unchanged text.
@@ -82,7 +147,8 @@ final class TranslationService: ObservableObject {
                     text: normalizedText,
                     source: sourceLanguage,
                     target: target,
-                    english: english
+                    english: english,
+                    strict: strict
                 )
             }
         }
@@ -96,7 +162,8 @@ final class TranslationService: ObservableObject {
         text: String,
         source sourceLanguage: Locale.Language?,
         target: Locale.Language,
-        english: Locale.Languag
```

**File**: `TypeWhisperTests/TranslationServiceBatchTests.swift` (added, +355/-0)
```diff
@@ -0,0 +1,355 @@
+#if canImport(Translation)
+import Translation
+import XCTest
+@testable import TypeWhisper
+
+/// Regression tests for the batch translation ownership fixes: overlapping
+/// requests must never lose a continuation, a stalled framework session
+/// must still hit its timeout with exactly-once completion, and silently
+/// untranslated segments must not ship under the target language.
+/// A controllable `BatchSessionTranslator` double stands in for the Apple
+/// framework session; availability and the watchdog duration are stubbed.
+@available(macOS 15, *)
+@MainActor
+final class TranslationServiceBatchTests: XCTestCase {
+
+    // MARK: - Doubles
+
+    /// Async gate: `wait()` suspends until `open()` is called.
+    private actor TestGate {
+        private var waiters: [CheckedContinuation<Void, Never>] = []
+        private var isOpen = false
+
+        func wait() async {
+            if isOpen { return }
+            await withCheckedContinuation { continuation in
+                waiters.append(continuation)
+            }
+        }
+
+        func open() {
+            guard !isOpen else { return }
+            isOpen = true
+            let pending = waiters
+            waiters.removeAll()
+            for waiter in pending { waiter.resume() }
+        }
+    }
+
+    /// Controllable stand-in for the framework batch session.
+    private struct ControllableBatchSession: TranslationService.BatchSessionTranslator {
+        var gate: TestGate?
+        var entered: TestGate?
+        var results: ([String]) -> [String]
+
+        func prepareTranslation() async throws {}
+        func translateTexts(_ texts: [String]) async throws -> [String] {
+            if let entered { await entered.open() }
+            if let gate { await gate.wait() }
+            return results(texts)
+        }
+    }
+
+    private enum BatchTestError: Error {
+        case timedOutWaiting
+    }
+
+    // MARK: - Helpers
+
+    private func makeService(
+        availability: ((String, Locale.Language?, Locale.Language) async -> LanguageAvailability.Status?)? = nil,
+        batchTimeout: Duration? = nil
+    ) -> TranslationService {
+        let service = TranslationService()
+        service.availabilityStub = availability ?? { _, _, _ in .installed }
+        service.batchTimeoutOverride = batchTimeout
+        return service
+    }
+
+    /// Starts a batch, returning a task for its terminal outcome.
+    private func startBatch(
+        _ service: TranslationService,
+        texts: [String],
+        target: Locale.Language,
+        strict: Bool = true
+    ) -> Task<Result<[String], Error>, Never> {
+        Task { @MainActor in
+            do {
+                return .success(try await service.translateBatch(texts: texts, to: target, strict: strict))
+            } catch {
+                return .failure(error)
+            }
+        }
+    }
+
+    /// Awaits a batch task, failing if it never settles — a hung batch is
+    /// exactly the regression these tests guard against.
+    private func awaitBatch(
+        _ task: Task<Result<[String], Error>, Never>,
+        timeout: Duration = .seconds(30)
+    ) async throws -> Result<[String], Error> {
+        try await withThrowingTaskGroup(of: Result<[String], Error>.self) { group in
+            group.addTask { await task.value }
+            group.addTask {
+                try await Task.sleep(for: timeout)
+                throw BatchTestError.timedOutWaiting
+            }
+            defer { group.cancelAll() }
+            return try await group.next() ?? .failure(BatchTestError.timedOutWaiting)
+        }
+    }
+
+    private func awaitClaim(on service: TranslationService, timeoutSeconds: Double = 10) async throws {
+        let deadline = Date(timeIntervalSinceNow: timeoutSeconds)
+        while service.claimedBatchRequestId == nil {
+            guard Date() < deadline else { throw BatchTestError.timedOutWaiting }
+            try await Task.sleep(for: .milliseconds(10))
+        }
+    }
+
+    private func assertBatchThrows(
+        _ expected: TypeWhisper.TranslationError,
+        _ result: Result<[String], Error>,
+        file: StaticString = #filePath,
+        line: UInt = #line
+    ) {
+        guard case .failure(let error) = result,
+              let translationError = error as? TypeWhisper.TranslationError,
+              translationError == expected else {
+            XCTFail("expected batch to throw \(expected), got \(result)", file: file, line: line)
+            return
+        }
+    }
+
+    // MARK: - P1: overlapping requests
+
+    func testOverlappingBatchCallsWithinResetWindowBothFinish() async throws {
+        let service = makeService()
+        let german = Locale.Language(identifier: "de")
+
+        let first = startBatch(service, texts: ["eins"], target: german)
+        // Start the second call inside the first call's 100 ms reset window.
+        try await Task.sleep(for: .milliseconds(
```

---

### Incident Patch 9: `9e5a1166` (2026-09-29)
**Commit Message**: Transcribe short quiet dictations in aggressive mode (#1410)

Extend aggressive transcription to quiet clips from 1 second to under 8 seconds while retaining the near-silence floor and strict threshold for longer recordings. Add focused regression coverage.

Closes #732

**File**: `TypeWhisper/ViewModels/DictationViewModel.swift` (modified, +26/-2)
```diff
@@ -5000,6 +5000,17 @@ enum DictationInsertionTextFormatter {
     }
 }
 
+// Upper bound of the "short dictation" window for the aggressive quiet-clip
+// policy. Issue #732: dictations of a few seconds were discarded as "no speech"
+// even with aggressive transcription enabled, because the aggressive path only
+// covered sub-second clips.
+private let aggressiveShortDictationMaxDuration: TimeInterval = 8.0
+
+// Peak level below which a clip counts as near-silence even in aggressive mode.
+// Matches the sub-second aggressive floor: the microphone boost path can still
+// make speech at this level transcribable, but anything quieter is noise.
+private let aggressiveQuietClipPeakFloor: Float = 0.003
+
 func classifyShortSpeech(
     rawDuration: TimeInterval,
     peakLevel: Float,
@@ -5012,13 +5023,26 @@ func classifyShortSpeech(
     if rawDuration < 1.0 {
         // Bias toward transcribing short clips. False negatives here are worse than
         // letting the recognizer return empty text for actual silence.
-        if peakLevel < 0.003 {
+        if peakLevel < aggressiveQuietClipPeakFloor {
             return transcribeShortQuietClipsAggressively ? .transcribe : .discardNoSpeech
         }
         return .transcribe
     }
 
-    if peakLevel < 0.006 { return .discardNoSpeech }
+    if peakLevel < 0.006 {
+        // Aggressive mode extends the short-clip bias past the sub-second window:
+        // a quiet peak on a short dictation is more likely quiet speech than
+        // silence, and the recognizer returning empty text is a cheaper failure
+        // than discarding real speech. Near-silence is still discarded, and long
+        // recordings keep the strict threshold so extended silence isn't
+        // needlessly transcribed.
+        if transcribeShortQuietClipsAggressively,
+           rawDuration < aggressiveShortDictationMaxDuration,
+           peakLevel >= aggressiveQuietClipPeakFloor {
+            return .transcribe
+        }
+        return .discardNoSpeech
+    }
     return .transcribe
 }
 
```

**File**: `TypeWhisperTests/DictationShortSpeechTests.swift` (modified, +97/-2)
```diff
@@ -102,8 +102,22 @@ final class DictationShortSpeechTests: XCTestCase {
         XCTAssertEqual(classifyShortSpeech(rawDuration: 0.885, peakLevel: 0.0069, hasConfirmedText: false), .transcribe)
     }
 
-    func testOnePointTwoSecondsVeryQuietClip_isNoSpeech() {
-        XCTAssertEqual(classifyShortSpeech(rawDuration: 1.2, peakLevel: 0.0059, hasConfirmedText: false), .discardNoSpeech)
+    func testOnePointTwoSecondsVeryQuietClip_transcribesWhenAggressivePolicyEnabled() {
+        // Issue #732: with aggressive transcription enabled, a short quiet
+        // dictation must be transcribed rather than discarded as "no speech".
+        XCTAssertEqual(classifyShortSpeech(rawDuration: 1.2, peakLevel: 0.0059, hasConfirmedText: false), .transcribe)
+    }
+
+    func testOnePointTwoSecondsVeryQuietClip_isNoSpeechWhenAggressivePolicyDisabled() {
+        XCTAssertEqual(
+            classifyShortSpeech(
+                rawDuration: 1.2,
+                peakLevel: 0.0059,
+                hasConfirmedText: false,
+                transcribeShortQuietClipsAggressively: false
+            ),
+            .discardNoSpeech
+        )
     }
 
     func testOnePointTwoSecondsBorderlineQuietClip_nowTranscribes() {
@@ -114,6 +128,87 @@ final class DictationShortSpeechTests: XCTestCase {
         XCTAssertEqual(classifyShortSpeech(rawDuration: 1.2, peakLevel: 0.0059, hasConfirmedText: true), .transcribe)
     }
 
+    // MARK: - Issue #732: aggressive mode must cover short (1-8s) quiet dictations
+
+    func testThreeSecondQuietClip_transcribesWhenAggressivePolicyEnabled() {
+        // The issue's scenario: a few seconds of quiet speech discarded as
+        // "No speech detected" despite aggressive transcription being enabled.
+        XCTAssertEqual(
+            classifyShortSpeech(
+                rawDuration: 3.0,
+                peakLevel: 0.004,
+                hasConfirmedText: false,
+                transcribeShortQuietClipsAggressively: true
+            ),
+            .transcribe
+        )
+    }
+
+    func testThreeSecondQuietClip_discardsWhenAggressivePolicyDisabled() {
+        XCTAssertEqual(
+            classifyShortSpeech(
+                rawDuration: 3.0,
+                peakLevel: 0.004,
+                hasConfirmedText: false,
+                transcribeShortQuietClipsAggressively: false
+            ),
+            .discardNoSpeech
+        )
+    }
+
+    func testSixAndAHalfSecondQuietClip_transcribesWhenAggressivePolicyEnabled() {
+        // Upper end of the duration range reported in the issue.
+        XCTAssertEqual(
+            classifyShortSpeech(
+                rawDuration: 6.5,
+                peakLevel: 0.005,
+                hasConfirmedText: false,
+                transcribeShortQuietClipsAggressively: true
+            ),
+            .transcribe
+        )
+    }
+
+    func testThreeSecondNearSilentClip_stillDiscardsWhenAggressivePolicyEnabled() {
+        // Genuinely silent recordings must keep reporting "No speech detected".
+        XCTAssertEqual(
+            classifyShortSpeech(
+                rawDuration: 3.0,
+                peakLevel: 0.002,
+                hasConfirmedText: false,
+                transcribeShortQuietClipsAggressively: true
+            ),
+            .discardNoSpeech
+        )
+    }
+
+    func testTenSecondQuietClip_staysStrictWhenAggressivePolicyEnabled() {
+        // Long recordings of near-silence are not short dictations: keep the
+        // strict threshold so extended silence isn't needlessly transcribed.
+        XCTAssertEqual(
+            classifyShortSpeech(
+                rawDuration: 10.0,
+                peakLevel: 0.004,
+                hasConfirmedText: false,
+                transcribeShortQuietClipsAggressively: true
+            ),
+            .discardNoSpeech
+        )
+    }
+
+    func testThreeSecondNormalClip_transcribesRegardlessOfPolicy() {
+        XCTAssertEqual(classifyShortSpeech(rawDuration: 3.0, peakLevel: 0.02, hasConfirmedText: false), .transcribe)
+        XCTAssertEqual(
+            classifyShortSpeech(
+                rawDuration: 3.0,
+                peakLevel: 0.02,
+                hasConfirmedText: false,
+                transcribeShortQuietClipsAggressively: false
+            ),
+            .transcribe
+        )
+    }
+
     func testConfirmedTranscriptionResultText_requiresNonEmptyResult() {
         XCTAssertFalse(hasConfirmedTranscriptionResultText(nil))
         XCTAssertFalse(hasConfirmedTranscriptionResultText(TranscriptionResult(
```

---

### Incident Patch 10: `6aa5e1c2` (2026-09-28)
**Commit Message**: Fix plugin screenshot fixtures for the website (#1422)

Add Canary ASR to the plugin screenshot lane, tag cloud integrations as Cloud and add local entries in the marketplace fixture, skip automatic provider checks in Claude and ElevenLabs screenshots, and seed example data for plugin windows that opened empty. Also keeps the File Memory list visible in its settings window, which changes shipped plugin behavior.

**File**: `TypeWhisper/Services/ScreenshotFixtureSeeder.swift` (modified, +260/-9)
```diff
@@ -105,6 +105,32 @@ extension ServiceContainer {
         default:
             break
         }
+        seedScreenshotPluginData(language: language)
+    }
+
+    private func seedScreenshotPluginData(language: ScreenshotFixtureLanguage) {
+        guard AppConstants.isScreenshotAutomation,
+              let pluginId = AppConstants.screenshotPluginId else { return }
+
+        let fixture = ScreenshotPluginDataFixture(
+            isGerman: language == .german,
+            referenceDate: AppConstants.screenshotFixtureReferenceDate
+        )
+        for (key, value) in fixture.defaults(pluginId: pluginId) {
+            UserDefaults.standard.set(value, forKey: "plugin.\(pluginId).\(key)")
+        }
+
+        let dataDirectory = AppConstants.appSupportDirectory
+            .appendingPathComponent("PluginData", isDirectory: true)
+            .appendingPathComponent(pluginId, isDirectory: true)
+        for file in fixture.files(pluginId: pluginId) {
+            let destination = dataDirectory.appendingPathComponent(file.relativePath)
+            try? FileManager.default.createDirectory(
+                at: destination.deletingLastPathComponent(),
+                withIntermediateDirectories: true
+            )
+            try? file.data.write(to: destination, options: .atomic)
+        }
     }
 
     private func seedScreenshotHistory(
@@ -195,7 +221,8 @@ extension ServiceContainer {
                     "ja": "多言語モデルに対応した高速なクラウド文字起こし。",
                     "zh": "支持多语言模型的快速云端转写。",
                 ],
-                categories: ["transcription"]
+                categories: ["transcription"],
+                hosting: .cloud
             ),
             screenshotRegistryPlugin(
                 id: "com.typewhisper.assemblyai",
@@ -206,7 +233,8 @@ extension ServiceContainer {
                     "ja": "話者識別と言語機能を備えたクラウド音声認識。",
                     "zh": "具备说话人和语言功能的云端语音识别。",
                 ],
-                categories: ["transcription"]
+                categories: ["transcription"],
+                hosting: .cloud
             ),
             screenshotRegistryPlugin(
                 id: "com.typewhisper.openrouter",
@@ -217,7 +245,8 @@ extension ServiceContainer {
                     "ja": "豊富な言語モデルをワークフローで利用できます。",
                     "zh": "在工作流中使用丰富的语言模型。",
                 ],
-                categories: ["llm"]
+                categories: ["llm"],
+                hosting: .cloud
             ),
             screenshotRegistryPlugin(
                 id: "com.typewhisper.elevenlabs",
@@ -228,7 +257,8 @@ extension ServiceContainer {
                     "ja": "読み上げフィードバック向けの自然な音声。",
                     "zh": "用于语音反馈的自然文本转语音。",
                 ],
-                categories: ["tts"]
+                categories: ["tts"],
+                hosting: .cloud
             ),
             screenshotRegistryPlugin(
                 id: "com.typewhisper.file-memory",
@@ -239,7 +269,8 @@ extension ServiceContainer {
                     "ja": "選択した書類のローカル情報をワークフローで利用できます。",
                     "zh": "让工作流使用所选文档中的本地上下文。",
                 ],
-                categories: ["memory"]
+                categories: ["memory"],
+                hosting: .local
             ),
             screenshotRegistryPlugin(
                 id: "com.typewhisper.obsidian",
@@ -250,7 +281,62 @@ extension ServiceContainer {
                     "ja": "処理したメモをObsidianの保管庫へ直接送信します。",
                     "zh": "将处理后的笔记直接发送到 Obsidian 仓库。",
                 ],
-                categories: ["action"]
+                categories: ["action"],
+                hosting: .local
+            ),
+            screenshotRegistryPlugin(
+                id: "com.typewhisper.parakeet",
+                name: "Parakeet",
+                description: "Local speech-to-text powered by NVIDIA Parakeet TDT. Fast and accurate, 25 languages.",
+                descriptions: [
+                    "de": "Lokale Spracherkennung mit NVIDIA Parakeet TDT. Schnell und präzise, 25 Sprachen.",
+                    "ja": "NVIDIA Parakeet TDTによるローカル音声認識です。高速かつ高精度で、25言語に対応します。",
+                ],
+                categories: ["transcription"],
+                hosting: .local
+            ),
+            screenshotRegistryPlugin(
+                id: "com.typewhisper.whisperkit",
+                name: "WhisperKit",
+                description: "Local speech-to-text powered by WhisperKit. 8 model sizes, 99 languages, streaming support.",
+                descriptions: [
+                    "de": "Lokale Spracherkennung mit WhisperKit. 8 Modellgrößen, 99 Sprachen, Streaming-Unterstützung.",
+                    "ja": "WhisperKitによるローカル音声認識です。8種類のモデルサイズ、99言語、ストリーミングに対応します。",
+                ],
+                categories: ["transcription"],
+                hosting: .local
+            ),
+            screenshotRegistryPlugin(
+                id: "com.typewhisper.qwen3",
+                name: "Qwen3 ASR",
+                descript
```

**File**: `TypeWhisperPluginSDK/Plugins/ClaudePlugin/ClaudePlugin.swift` (modified, +12/-1)
```diff
@@ -3,6 +3,15 @@ import os
 import SwiftUI
 import TypeWhisperPluginSDK
 
+// Screenshot automation blocks provider requests, so an automatic refresh could only fail.
+enum ClaudeAutomaticRefreshPolicy {
+    static func allowsRefreshOnAppear(
+        arguments: [String] = ProcessInfo.processInfo.arguments
+    ) -> Bool {
+        !arguments.contains("--store-screenshots")
+    }
+}
+
 // MARK: - Plugin Entry Point
 
 @objc(ClaudePlugin)
@@ -791,7 +800,9 @@ private struct ClaudeSettingsView: View {
             llmTemperatureValue = plugin.llmTemperatureValue
             lastUpdated = plugin.cacheLastUpdated
             // Serve the cache immediately; refresh in the background if stale.
-            if plugin.isAvailable, !plugin.isModelCacheFresh {
+            if plugin.isAvailable,
+               !plugin.isModelCacheFresh,
+               ClaudeAutomaticRefreshPolicy.allowsRefreshOnAppear() {
                 refresh()
             }
         }
```

**File**: `TypeWhisperPluginSDK/Plugins/ClaudePlugin/Tests/ClaudePluginTests.swift` (modified, +9/-0)
```diff
@@ -15,6 +15,15 @@ final class ClaudePluginTests: XCTestCase {
         super.tearDown()
     }
 
+    func testScreenshotAutomationSkipsAutomaticModelRefresh() {
+        XCTAssertFalse(
+            ClaudeAutomaticRefreshPolicy.allowsRefreshOnAppear(
+                arguments: ["TypeWhisper", "--store-screenshots"]
+            )
+        )
+        XCTAssertTrue(ClaudeAutomaticRefreshPolicy.allowsRefreshOnAppear(arguments: ["TypeWhisper"]))
+    }
+
     // MARK: - Existing selection behavior
 
     func testPreferredModelIdReflectsSelectedLLMModel() throws {
```

**File**: `TypeWhisperPluginSDK/Plugins/ElevenLabsPlugin/ElevenLabsPlugin.swift` (modified, +17/-6)
```diff
@@ -3,6 +3,15 @@ import SwiftUI
 import os
 import TypeWhisperPluginSDK
 
+// Screenshot automation blocks provider requests, so an automatic key check could only fail.
+enum ElevenLabsAutomaticValidationPolicy {
+    static func allowsValidationOnAppear(
+        arguments: [String] = ProcessInfo.processInfo.arguments
+    ) -> Bool {
+        !arguments.contains("--store-screenshots")
+    }
+}
+
 private let elevenLabsSupportedLanguages = [
     "af", "am", "ar", "as", "az", "ba", "be", "bg", "bn", "bo",
     "br", "bs", "ca", "cs", "cy", "da", "de", "el", "en", "es",
@@ -1010,12 +1019,14 @@ private struct ElevenLabsSettingsView: View {
         .onAppear {
             if let key = plugin._apiKey, !key.isEmpty {
                 apiKeyInput = key
-                isValidating = true
-                Task {
-                    let result = await plugin.validateApiKey(key)
-                    await MainActor.run {
-                        isValidating = false
-                        validationResult = result
+                if ElevenLabsAutomaticValidationPolicy.allowsValidationOnAppear() {
+                    isValidating = true
+                    Task {
+                        let result = await plugin.validateApiKey(key)
+                        await MainActor.run {
+                            isValidating = false
+                            validationResult = result
+                        }
                     }
                 }
             }
```

**File**: `TypeWhisperPluginSDK/Plugins/ElevenLabsPlugin/Tests/ElevenLabsPluginTests.swift` (modified, +11/-0)
```diff
@@ -11,6 +11,17 @@ final class ElevenLabsPluginTests: XCTestCase {
         super.tearDown()
     }
 
+    func testScreenshotAutomationSkipsAutomaticKeyValidation() {
+        XCTAssertFalse(
+            ElevenLabsAutomaticValidationPolicy.allowsValidationOnAppear(
+                arguments: ["TypeWhisper", "--store-screenshots"]
+            )
+        )
+        XCTAssertTrue(
+            ElevenLabsAutomaticValidationPolicy.allowsValidationOnAppear(arguments: ["TypeWhisper"])
+        )
+    }
+
     func testAPIKeyValidationAcceptsSuccessfulUserResponse() {
         XCTAssertEqual(
             ElevenLabsPlugin.apiKeyValidationResult(statusCode: 200, data: Data()),
```

**File**: `TypeWhisperPluginSDK/Plugins/FileMemoryPlugin/FileMemoryPlugin.swift` (modified, +1/-0)
```diff
@@ -216,6 +216,7 @@ private struct FileMemorySettingsView: View {
             }
         }
         .padding()
+        .frame(minHeight: 400)
         .onAppear { memories = plugin.getAllMemories() }
     }
 }
```

**File**: `TypeWhisperTests/TypeWhisperIntegrationTests.swift` (modified, +70/-0)
```diff
@@ -14029,6 +14029,76 @@ final class TypeWhisperIntegrationTests: XCTestCase {
         }
     }
 
+    func testScreenshotPluginDataFixtureProvidesLocalizedExampleData() throws {
+        let referenceDate = Date(timeIntervalSince1970: 1_787_054_400)
+
+        for isGerman in [false, true] {
+            let fixture = ScreenshotPluginDataFixture(isGerman: isGerman, referenceDate: referenceDate)
+
+            for (pluginId, fileName) in [
+                ("com.typewhisper.memory.file", "memories.json"),
+                ("com.typewhisper.memory.openai-vector", "entries.json"),
+            ] {
+                let files = fixture.files(pluginId: pluginId)
+                XCTAssertEqual(files.map(\.relativePath), [fileName])
+                let memories = try JSONDecoder.memoryDecoder.decode(
+                    [MemoryEntry].self,
+                    from: try XCTUnwrap(files.first?.data)
+                )
+                XCTAssertEqual(memories.count, 3)
+                XCTAssertTrue(memories.allSatisfy { $0.source.bundleIdentifier == nil })
+            }
+            XCTAssertEqual(
+                fixture.defaults(pluginId: "com.typewhisper.memory.openai-vector")["vectorStoreId"] as? String,
+                "vs_example_typewhisper"
+            )
+
+            let scriptFiles = fixture.files(pluginId: "com.typewhisper.script")
+            XCTAssertEqual(scriptFiles.map(\.relativePath), ["scripts.json"])
+            let scripts = try XCTUnwrap(
+                JSONSerialization.jsonObject(with: try XCTUnwrap(scriptFiles.first?.data)) as? [[String: Any]]
+            )
+            XCTAssertEqual(scripts.count, 2)
+            XCTAssertTrue(scripts.allSatisfy { UUID(uuidString: $0["id"] as? String ?? "") != nil })
+
+            let webhookFiles = fixture.files(pluginId: "com.typewhisper.webhook")
+            XCTAssertEqual(webhookFiles.map(\.relativePath), ["webhooks.json"])
+            let webhooks = try XCTUnwrap(
+                JSONSerialization.jsonObject(with: try XCTUnwrap(webhookFiles.first?.data)) as? [[String: Any]]
+            )
+            XCTAssertEqual(webhooks.count, 2)
+            for webhook in webhooks {
+                let url = try XCTUnwrap(URL(string: try XCTUnwrap(webhook["url"] as? String)))
+                XCTAssertEqual(url.host, "example.com")
+                XCTAssertEqual(webhook["headers"] as? [String: String], ["Content-Type": "application/json"])
+                XCTAssertEqual(webhook["secretHeaderNames"] as? [String], [])
+            }
+
+            let correctionFiles = fixture.files(pluginId: "com.typewhisper.improve")
+            XCTAssertEqual(correctionFiles.count, 3)
+            for file in correctionFiles {
+                let correction = try XCTUnwrap(
+                    JSONSerialization.jsonObject(with: file.data) as? [String: Any]
+                )
+                let id = try XCTUnwrap(correction["id"] as? String)
+                XCTAssertEqual(file.relativePath, "pending/\(id.lowercased()).json")
+                XCTAssertEqual(correction["status"] as? String, "local")
+                XCTAssertEqual(correction["language"] as? String, isGerman ? "de" : "en")
+                XCTAssertNotEqual(
+                    correction["originalText"] as? String,
+                    correction["correctedText"] as? String
+                )
+            }
+            XCTAssertEqual(
+                fixture.defaults(pluginId: "com.typewhisper.improve")["collectCorrections"] as? Bool,
+                true
+            )
+
+            XCTAssertTrue(fixture.files(pluginId: "com.typewhisper.groq").isEmpty)
+            XCTAssertTrue(fixture.defaults(pluginId: "com.typewhisper.groq").isEmpty)
+        }
+    }
+
     func testScreenshotAppSupportOverrideMustStayInsideTemporaryDirectory() {
         let temporaryDirectory = URL(fileURLWithPath: "/tmp/typewhisper-screenshot-root", isDirectory: true)
         let fallback = temporaryDirectory.appendingPathComponent(
```

**File**: `docs/screenshot-automation.md` (modified, +10/-1)
```diff
@@ -80,7 +80,7 @@ separate from the Settings-window matrix.
 
 ## Plugin screenshots for typewhisper.com
 
-The plugin lane covers the 47 current first-party bundles. It builds each
+The plugin lane covers the 48 current first-party bundles. It builds each
 selected bundle, stages only that bundle in a temporary Application Support
 directory, opens its native settings window, and captures English and German
 website assets:
@@ -122,6 +122,15 @@ Obsidian captures include a selected example vault, and MCP Client captures
 include an example HTTP server. Both fixtures are localized and seeded only in
 the isolated screenshot defaults. The example MCP server is not connected.
 
+File Memory, OpenAI Vector Memory, Script Runner, Webhook Notifications, and
+Improve TypeWhisper would open empty, so screenshot mode writes localized
+example data into the temporary plugin data directory before the selected
+plugin loads: three memories, two scripts, two webhooks that point to
+`example.com`, and three corrections that are ready to send. Execution and
+delivery logs only exist in memory and stay empty. Claude and ElevenLabs skip
+their automatic model refresh and key check in screenshot mode, because the
+blocked request would otherwise show an error in the window.
+
 Publishing requires `cwebp`, `oxipng`, and ImageMagick's `identify`. After
 reviewing both locale images, copy and optimize the PNG/WebP assets in a local
 website checkout:
```

---

### Incident Patch 11: `b863baba` (2026-09-28)
**Commit Message**: Fix Parakeet restore after automatic model unload (#1411)

Publish restore activity synchronously and complete it with the resulting model state. Register and repair host regression tests, and add opt-in persisted-model coverage.

Closes #840

**File**: `TypeWhisper.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -57,6 +57,7 @@
 		1F7A2C3D4E5B60718293A4C7 /* PromptActionsViewModelWizardTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2A7B3C4D5E6F708192A3B4C7 /* PromptActionsViewModelWizardTests.swift */; };
 		4D980A5CFE1A4217A10C2101 /* WhisperKitPluginLifecycleTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4D980A5CFE1A4217A10C2102 /* WhisperKitPluginLifecycleTests.swift */; };
 		4D980A5CFE1A4217A10C2104 /* WhisperKitPluginCompatibilityTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4D980A5CFE1A4217A10C2103 /* WhisperKitPluginCompatibilityTests.swift */; };
+		0B58B3B8ACBA76118C3B54C2 /* ModelManagerRestoreAfterAutoUnloadTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = F3B9EC248517FD4849BEF54D /* ModelManagerRestoreAfterAutoUnloadTests.swift */; };
 		C42900000000000000000003 /* LiveTranscriptPlugin.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000216 /* LiveTranscriptPlugin.swift */; };
 		204C804898EAE1127B62EC98 /* TestSupport.swift in Sources */ = {isa = PBXBuildFile; fileRef = E808D246301E36546EEB811F /* TestSupport.swift */; };
 		A1F000000000000000000102 /* PostUpdatePromptCoordinatorTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1F000000000000000000101 /* PostUpdatePromptCoordinatorTests.swift */; };
@@ -1144,6 +1145,7 @@
 		CE5852D6767C5FA955B84C56 /* PunctuationStrategyResolverTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = PunctuationStrategyResolverTests.swift; sourceTree = "<group>"; };
 		4D980A5CFE1A4217A10C2102 /* WhisperKitPluginLifecycleTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = WhisperKitPluginLifecycleTests.swift; sourceTree = "<group>"; };
 		4D980A5CFE1A4217A10C2103 /* WhisperKitPluginCompatibilityTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = WhisperKitPluginCompatibilityTests.swift; sourceTree = "<group>"; };
+		F3B9EC248517FD4849BEF54D /* ModelManagerRestoreAfterAutoUnloadTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = ModelManagerRestoreAfterAutoUnloadTests.swift; sourceTree = "<group>"; };
 		D63A42880A0BA4C84F36E873 /* DictionaryServiceTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = DictionaryServiceTests.swift; sourceTree = "<group>"; };
 		D8AA5F3DBFD9010D09311C40 /* Cocoa.framework */ = {isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = Cocoa.framework; path = Platforms/MacOSX.platform/Developer/SDKs/MacOSX15.0.sdk/System/Library/Frameworks/Cocoa.framework; sourceTree = DEVELOPER_DIR; };
 		DD00000000000000000098 /* typewhisper-cli */ = {isa = PBXFileReference; explicitFileType = "compiled.mach-o.executable"; includeInIndex = 0; path = "typewhisper-cli"; sourceTree = BUILT_PRODUCTS_DIR; };
@@ -2930,6 +2932,7 @@
 				91B4D7E2C5A809F1632E4B7F /* StreamingHandlerTests.swift */,
 				B26D2C342D877030A62CE027 /* Support */,
 				05313C25F9E79BCFC02899F2 /* TextDiffServiceTests.swift */,
+				F3B9EC248517FD4849BEF54D /* ModelManagerRestoreAfterAutoUnloadTests.swift */,
 			);
 			name = TypeWhisperTests;
 			path = TypeWhisperTests;
@@ -4845,6 +4848,7 @@
 				76858B5B28A121356A5D9599 /* TextDiffServiceTests.swift in Sources */,
 				4D980A5CFE1A4217A10C2101 /* WhisperKitPluginLifecycleTests.swift in Sources */,
 				4D980A5CFE1A4217A10C2104 /* WhisperKitPluginCompatibilityTests.swift in Sources */,
+				0B58B3B8ACBA76118C3B54C2 /* ModelManagerRestoreAfterAutoUnloadTests.swift in Sources */,
 				E2DA879FDEFA04FBD013E837 /* OutputFormatter.swift in Sources */,
 				BA68B1E282D5D714132FEA24 /* PortDiscovery.swift in Sources */,
 			);
```

**File**: `TypeWhisperPluginSDK/Plugins/ParakeetPlugin/ParakeetPlugin.swift` (modified, +42/-2)
```diff
@@ -849,7 +849,15 @@ final class ParakeetPlugin: NSObject, DictionaryTermHintSourceProgressTranscript
     }
 
     @objc func triggerAutoUnload() { unloadModel(clearPersistence: false) }
-    @objc func triggerRestoreModel() { Task { await restoreLoadedModel(allowDownloads: true) } }
+
+    @objc func triggerRestoreModel() {
+        markRestoreInFlight()
+        Task {
+            await restoreLoadedModel(allowDownloads: true)
+            finishRestoreTrigger()
+        }
+    }
+
     @objc(triggerRestoreModelForModel:)
     func triggerRestoreModel(forModel modelId: NSString?) {
         guard let modelId = modelId.map(String.init),
@@ -863,7 +871,39 @@ final class ParakeetPlugin: NSObject, DictionaryTermHintSourceProgressTranscript
         selectedVersion = version
         host?.setUserDefault(modelId, forKey: "selectedModel")
         host?.setUserDefault(version.rawValue, forKey: "selectedVersion")
-        Task { await loadModel() }
+        markRestoreInFlight()
+        Task {
+            await loadModel()
+            finishRestoreTrigger()
+        }
+    }
+
+    /// Marks a restore as in-flight synchronously. The host extends its restore
+    /// wait past the base window only while the plugin reports an activity, and
+    /// task scheduling can delay the unstructured task above before it publishes
+    /// its first state update. Without this mark, the host can time out and
+    /// report "no model loaded" for a restore that is still starting.
+    private func markRestoreInFlight() {
+        guard !isConfigured else { return }
+        modelState = .downloading
+        downloadProgress = 0
+    }
+
+    /// Resolves the in-flight restore mark once the restore task finishes. A
+    /// successful load already recorded `.ready` and a failed load already
+    /// recorded the underlying `.error`. Only a restore that produced nothing
+    /// (e.g. nothing was persisted to restore) needs an explicit error, so the
+    /// host surfaces it instead of polling a stale activity until its wait
+    /// expires.
+    private func finishRestoreTrigger() {
+        guard host != nil else { return }
+        switch modelState {
+        case .ready, .error:
+            return
+        case .notLoaded, .downloading:
+            break
+        }
+        modelState = isConfigured ? .ready : .error("No previously loaded model to restore.")
     }
 
     func unloadModel(clearPersistence: Bool = true) {
```

**File**: `TypeWhisperPluginSDK/Plugins/ParakeetPlugin/Tests/ParakeetPluginTests.swift` (modified, +89/-0)
```diff
@@ -702,4 +702,93 @@ final class ParakeetPluginTests: XCTestCase {
             XCTAssertEqual(getenv(key).map { String(cString: $0) }, "hf_env_parakeet")
         }
     }
+
+    // MARK: - Restore trigger activity (issue #840)
+
+    func testTriggerRestoreModelPublishesActivitySynchronously() throws {
+        let host = try PluginTestHostServices()
+        let plugin = makePlugin()
+        plugin.activate(host: host)
+
+        XCTAssertNil(plugin.currentSettingsActivity)
+
+        plugin.triggerRestoreModel()
+
+        // The activity must be visible synchronously: the host only extends its
+        // restore wait past the base window while an activity is reported, and
+        // task scheduling can delay the async restore task before it publishes
+        // its first state update.
+        let activity = try XCTUnwrap(plugin.currentSettingsActivity)
+        XCTAssertFalse(activity.isError)
+    }
+
+    func testTriggerRestoreModelWithoutPersistedModelSurfacesError() async throws {
+        let host = try PluginTestHostServices()
+        let plugin = makePlugin()
+        plugin.activate(host: host)
+
+        // No `loadedModel` persisted, so the async restore has nothing to load.
+        plugin.triggerRestoreModel()
+
+        let deadline = ContinuousClock.now.advanced(by: .seconds(5))
+        var errorActivity: PluginSettingsActivity?
+        while ContinuousClock.now < deadline {
+            if let current = plugin.currentSettingsActivity, current.isError {
+                errorActivity = current
+                break
+            }
+            try await Task.sleep(for: .milliseconds(20))
+        }
+
+        let activity = try XCTUnwrap(
+            errorActivity,
+            "a restore with nothing persisted must surface an error, not stay silent"
+        )
+        XCTAssertTrue(activity.message.contains("No previously loaded model"))
+    }
+
+    /// Opt-in Core ML regression through the user-facing restore trigger: seeds the
+    /// persisted `loadedModel` marker, goes through `triggerRestoreModel()`, and verifies
+    /// the plugin configures and transcribes. Without this, a regression in the generic
+    /// trigger could leave the persisted model unloaded while the suite stays green,
+    /// because every other Parakeet restore test calls `restoreLoadedModel(...)` directly.
+    func testTriggerRestoreModelRestoresPersistedModelBeforeTranscription() async throws {
+        let audio = try regressionAudio()
+
+        let host = try PluginTestHostServices(defaults: [
+            "loadedModel": "parakeet-tdt-0.6b-v3",
+        ])
+        let plugin = makePlugin()
+        plugin.activate(host: host)
+        defer { plugin.deactivate() }
+
+        plugin.triggerRestoreModel()
+
+        let deadline = ContinuousClock.now.advanced(by: .seconds(30))
+        while !plugin.isConfigured && ContinuousClock.now < deadline {
+            try await Task.sleep(for: .milliseconds(50))
+        }
+        guard plugin.isConfigured else {
+            XCTFail("triggerRestoreModel() left the persisted model unloaded: \(plugin.modelState)")
+            return
+        }
+        let result = try await plugin.transcribe(
+            audio: audio,
+            language: nil,
+            translate: false,
+            prompt: nil
+        )
+        XCTAssertFalse(result.text.isEmpty, "the restored persisted model must transcribe")
+    }
+
+    func testTriggerRestoreModelForModelPublishesActivitySynchronously() throws {
+        let host = try PluginTestHostServices()
+        let plugin = makePlugin()
+        plugin.activate(host: host)
+
+        plugin.triggerRestoreModel(forModel: "parakeet-tdt-0.6b-v3")
+
+        // Same synchronous-activity contract as the parameterless trigger.
+        XCTAssertNotNil(plugin.currentSettingsActivity)
+    }
 }
```

**File**: `TypeWhisperTests/ModelManagerRestoreAfterAutoUnloadTests.swift` (added, +282/-0)
```diff
@@ -0,0 +1,282 @@
+import Foundation
+import XCTest
+import TypeWhisperPluginSDK
+@testable import TypeWhisper
+
+/// Regression tests for https://github.com/TypeWhisper/typewhisper-mac/issues/840.
+///
+/// After the auto-unload timer releases a local model, the next dictation must
+/// restore the persisted model and proceed instead of throwing `modelNotLoaded`.
+/// The host only extends its restore wait past the base window while the plugin
+/// reports a settings activity, so a plugin whose restore task is slow to start
+/// (cold CoreML compile) must publish its restore activity synchronously from
+/// `triggerRestoreModel()`.
+@MainActor
+final class ModelManagerRestoreAfterAutoUnloadTests: XCTestCase {
+    override func tearDown() {
+        PluginManager.shared = nil
+        super.tearDown()
+    }
+
+    func testTranscribeRestoresAutoUnloadedEngineInsteadOfThrowingModelNotLoaded() async throws {
+        let appSupportDirectory = try TestSupport.makeTemporaryDirectory()
+        defer { TestSupport.remove(appSupportDirectory) }
+
+        // The restore takes longer than the base wait window but publishes its
+        // activity synchronously, like ParakeetPlugin does after the #840 fix.
+        // The host must extend its wait and let the restore finish.
+        let plugin = RestoreAfterUnloadMockPlugin(
+            configured: false,
+            restoreResult: .succeedAfter(.milliseconds(300)),
+            publishesActivitySynchronously: true
+        )
+        let modelManager = installPlugin(plugin, appSupportDirectory: appSupportDirectory)
+        modelManager.setPluginRestoreWaitConfigurationForTesting(
+            initialAttempts: 2,
+            busyAttempts: 200,
+            pollInterval: .milliseconds(50)
+        )
+
+        let result = try await modelManager.transcribe(
+            audioSamples: [Float](repeating: 0, count: 1_600),
+            language: nil,
+            task: .transcribe
+        )
+
+        XCTAssertEqual(result.text, "restored-transcript")
+        XCTAssertEqual(plugin.restoreCount, 1)
+    }
+
+    func testTranscribeThrowsModelNotLoadedWhenRestoreStaysSilentPastBaseWindow() async throws {
+        let appSupportDirectory = try TestSupport.makeTemporaryDirectory()
+        defer { TestSupport.remove(appSupportDirectory) }
+
+        // Old behavior: the restore only becomes visible once the load actually
+        // starts, after the base window has elapsed. The host cannot distinguish
+        // this from a dead plugin and reports the engine as not loaded.
+        let plugin = RestoreAfterUnloadMockPlugin(
+            configured: false,
+            restoreResult: .succeedAfter(.milliseconds(300)),
+            publishesActivitySynchronously: false
+        )
+        let modelManager = installPlugin(plugin, appSupportDirectory: appSupportDirectory)
+        modelManager.setPluginRestoreWaitConfigurationForTesting(
+            initialAttempts: 2,
+            busyAttempts: 200,
+            pollInterval: .milliseconds(50)
+        )
+
+        do {
+            _ = try await modelManager.transcribe(
+                audioSamples: [Float](repeating: 0, count: 1_600),
+                language: nil,
+                task: .transcribe
+            )
+            XCTFail("expected modelNotLoaded when the restore publishes no activity in time")
+        } catch let error as TranscriptionEngineError {
+            guard case .modelNotLoaded = error else {
+                XCTFail("expected modelNotLoaded, got \(error)")
+                return
+            }
+        }
+    }
+
+    func testTranscribeSurfacesRestoreErrorInsteadOfModelNotLoaded() async throws {
+        let appSupportDirectory = try TestSupport.makeTemporaryDirectory()
+        defer { TestSupport.remove(appSupportDirectory) }
+
+        let plugin = RestoreAfterUnloadMockPlugin(
+            configured: false,
+            restoreResult: .fail("No previously loaded model to restore."),
+            publishesActivitySynchronously: true
+        )
+        let modelManager = installPlugin(plugin, appSupportDirectory: appSupportDirectory)
+        modelManager.setPluginRestoreWaitConfigurationForTesting(
+            initialAttempts: 20,
+            busyAttempts: 200,
+            pollInterval: .milliseconds(50)
+        )
+
+        do {
+            _ = try await modelManager.transcribe(
+                audioSamples: [Float](repeating: 0, count: 1_600),
+                language: nil,
+                task: .transcribe
+            )
+            XCTFail("expected modelLoadFailed when the restore reports an error")
+        } catch let error as TranscriptionEngineError {
+            guard case .modelLoadFailed(let message) = error else {
+                XCTFail("expected modelLoadFailed, got \(error)")
+                return
+            }
+            XCTAssertTrue(
+                message.contains("No previously loaded model to restore."),
+                "the underlying 
```

---

### Incident Patch 12: `825c03c7` (2026-09-28)
**Commit Message**: Fix lost Stop hotkeys and complete Chinese translations (#1413)

Recover lost modifier releases and event-tap interruptions without swallowing the next Stop press. Preserve workflow bindings, modifier-combination release behavior, press identity, suppression latches, and intentional monitoring suspension.

Complete the 102 missing Simplified Chinese translations across 17 application and plugin catalogs so localization completeness checks pass on the current main baseline.

Closes #1220

**File**: `TypeWhisper/Resources/Localizable.xcstrings` (modified, +168/-0)
```diff
@@ -8,6 +8,12 @@
             "state": "translated",
             "value": "Guthaben löschen"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "清除余额"
+          }
         }
       }
     },
@@ -18,6 +24,12 @@
             "state": "translated",
             "value": "Letzte Spracherkennung"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "上次语音识别"
+          }
         }
       }
     },
@@ -28,6 +40,12 @@
             "state": "translated",
             "value": "Guthaben aktualisiert"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "余额更新时间"
+          }
         }
       }
     },
@@ -38,6 +56,12 @@
             "state": "translated",
             "value": "Verbrauch seit Guthabenaktualisierung"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "余额更新后的用量"
+          }
         }
       }
     },
@@ -48,6 +72,12 @@
             "state": "translated",
             "value": "Geschätztes Restguthaben"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "预计剩余额度"
+          }
         }
       }
     },
@@ -58,6 +88,12 @@
             "state": "translated",
             "value": "Der Autorisierungsschlüssel wird sicher im Schlüsselbund gespeichert. Falls die Prüfung wegen eines Zertifikatfehlers scheitert, installiere das von macOS als vertrauenswürdig eingestufte SaluteSpeech-Zertifikat."
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "授权密钥安全地存储在钥匙串中。如果验证因证书错误而失败，请安装受 macOS 信任的 SaluteSpeech 证书。"
+          }
         }
       }
     },
@@ -68,6 +104,12 @@
             "state": "translated",
             "value": "Lokale Schätzung. Aktualisiere sie anhand von SaluteSpeech Studio."
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "此为本地估算值。请根据 SaluteSpeech Studio 中的数据更新。"
+          }
         }
       }
     },
@@ -78,6 +120,12 @@
             "state": "translated",
             "value": "Erfassten Verbrauch zurücksetzen"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "重置已记录的用量"
+          }
         }
       }
     },
@@ -88,6 +136,12 @@
             "state": "translated",
             "value": "Guthaben speichern"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "保存余额"
+          }
         }
       }
     },
@@ -98,6 +152,12 @@
             "state": "translated",
             "value": "Gültig bis"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "有效期至"
+          }
         }
       }
     },
@@ -108,6 +168,12 @@
             "state": "translated",
             "value": "Minuten"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "分钟"
+          }
         }
       }
     },
@@ -118,6 +184,12 @@
             "state": "translated",
             "value": "Studio-Restguthaben"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Studio 剩余额度"
+          }
         }
       }
     },
@@ -128,6 +200,12 @@
             "state": "translated",
             "value": "Erfasster Verbrauch"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "已记录的用量"
+          }
         }
       }
     },
@@ -138,6 +216,12 @@
             "state": "translated",
             "value": "Spracherkennungsnutzung"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "语音识别用量"
+          }
         }
       }
     },
@@ -148,6 +232,12 @@
             "state": "translated",
             "value": "Unternehmen"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "企业"
+          }
         }
       }
     },
@@ -158,6 +248,12 @@
             "state": "translated",
             "value": "Persönlich"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "个人"
+          }
         }
       }
     },
@@ -168,6 +264,12 @@
             "state": "translated",
             "value": "OAuth-Bereich"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+
```

**File**: `TypeWhisper/Services/HotkeyService.swift` (modified, +476/-62)
```diff
@@ -243,6 +243,10 @@ final class HotkeyService: ObservableObject, @unchecked Sendable {
     var keyStateProvider: (UInt16) -> Bool = { keyCode in
         CGEventSource.keyState(.combinedSessionState, key: CGKeyCode(keyCode))
     }
+    var mouseButtonStateProvider: (UInt16) -> Bool = { button in
+        guard let mouseButton = CGMouseButton(rawValue: UInt32(button)) else { return false }
+        return CGEventSource.buttonState(.combinedSessionState, button: mouseButton)
+    }
     var workflowTextProcessingModifierPollInterval: TimeInterval = 0.05
     var workflowTextProcessingModifierReleaseTimeout: TimeInterval = 2.0
     var workflowTextProcessingPostReleaseDelay: TimeInterval = 0.15
@@ -253,7 +257,12 @@ final class HotkeyService: ObservableObject, @unchecked Sendable {
     private var activeSlotType: HotkeySlotType?
     private var activeGlobalHotkey: UnifiedHotkey?
     private(set) var activeProfileId: UUID?
-    private(set) var activeWorkflowId: UUID?
+    private(set) var activeWorkflowId: UUID? {
+        didSet {
+            if activeWorkflowId == nil { activeWorkflowHotkey = nil }
+        }
+    }
+    private var activeWorkflowHotkey: UnifiedHotkey?
     private var pushToTalkInterruptionSignaled = false
     private var pendingHybridModifierHoldWorkItem: DispatchWorkItem?
     private var pendingHybridModifierHoldHotkey: UnifiedHotkey?
@@ -285,6 +294,7 @@ final class HotkeyService: ObservableObject, @unchecked Sendable {
         var fnWasDown = false
         var fnComboKeyPressed = false
         var modifierWasDown = false
+        var lastDownTimestamp: TimeInterval?
         var keyWasDown = false
         var mouseButtonWasDown = false
         // Double-tap tracking
@@ -295,6 +305,7 @@ final class HotkeyService: ObservableObject, @unchecked Sendable {
             fnWasDown = false
             fnComboKeyPressed = false
             modifierWasDown = false
+            lastDownTimestamp = nil
             keyWasDown = false
             mouseButtonWasDown = false
             lastTapUpTime = nil
@@ -314,6 +325,7 @@ final class HotkeyService: ObservableObject, @unchecked Sendable {
         var fnWasDown = false
         var fnComboKeyPressed = false
         var modifierWasDown = false
+        var lastDownTimestamp: TimeInterval?
         var keyWasDown = false
         var mouseButtonWasDown = false
         // Double-tap tracking
@@ -324,6 +336,7 @@ final class HotkeyService: ObservableObject, @unchecked Sendable {
             fnWasDown = false
             fnComboKeyPressed = false
             modifierWasDown = false
+            lastDownTimestamp = nil
             keyWasDown = false
             mouseButtonWasDown = false
             lastTapUpTime = nil
@@ -340,6 +353,7 @@ final class HotkeyService: ObservableObject, @unchecked Sendable {
         var fnWasDown = false
         var fnComboKeyPressed = false
         var modifierWasDown = false
+        var lastDownTimestamp: TimeInterval?
         var keyWasDown = false
         var mouseButtonWasDown = false
         var lastTapUpTime: Date?
@@ -349,6 +363,7 @@ final class HotkeyService: ObservableObject, @unchecked Sendable {
             fnWasDown = false
             fnComboKeyPressed = false
             modifierWasDown = false
+            lastDownTimestamp = nil
             keyWasDown = false
             mouseButtonWasDown = false
             lastTapUpTime = nil
@@ -369,8 +384,107 @@ final class HotkeyService: ObservableObject, @unchecked Sendable {
 
     private var globalMonitor: Any?
     private var localMonitor: Any?
-    private var eventTap: CFMachPort?
+    private var hasEventMonitorFallback = false
+    /// The CGEventTap is created and torn down on the main thread but revived
+    /// from the watchdog's background queue, so the port reference and its
+    /// enable/invalidate lifecycle are guarded by one lock rather than by
+    /// `@unchecked Sendable` alone.
+    private nonisolated final class EventTapHandle: @unchecked Sendable {
+        private let lock = NSLock()
+        private var port: CFMachPort?
+        private var watchdogGeneration: UUID?
+
+        enum WatchdogAction { case none, retrySetup, recovered }
+
+        func beginWatchdog() -> UUID {
+            lock.withLock {
+                let generation = UUID()
+                watchdogGeneration = generation
+                return generation
+            }
+        }
+
+        func cancelWatchdog() {
+            lock.withLock { watchdogGeneration = nil }
+        }
+
+        func isCurrentWatchdog(_ generation: UUID) -> Bool {
+            lock.withLock { watchdogGeneration == generation }
+        }
+
+        var currentWatchdogGeneration: UUID? {
+            lock.withLock { watchdogGeneration }
+        }
+
+        var isEnabled: Bool {
+            lock.withLock { port.map { CGEvent.tapIsEnabled(tap: $0) } ?? false }
+        }
+
+        var isValid: Bool {
+            lock.withLock { port.map { CFMachPortIsV
```

**File**: `TypeWhisperPluginSDK/Plugins/CerebrasPlugin/Localizable.xcstrings` (modified, +24/-0)
```diff
@@ -8,6 +8,12 @@
             "state": "translated",
             "value": "Temperaturmodus"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度模式"
+          }
         }
       }
     },
@@ -18,6 +24,12 @@
             "state": "translated",
             "value": "Benutzerdefiniert"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "自定义"
+          }
         }
       }
     },
@@ -28,6 +40,12 @@
             "state": "translated",
             "value": "Anbieterstandard"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "提供商默认值"
+          }
         }
       }
     },
@@ -38,6 +56,12 @@
             "state": "translated",
             "value": "Temperatur"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度"
+          }
         }
       }
     },
```

**File**: `TypeWhisperPluginSDK/Plugins/ClaudePlugin/Localizable.xcstrings` (modified, +24/-0)
```diff
@@ -8,6 +8,12 @@
             "state": "translated",
             "value": "Temperaturmodus"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度模式"
+          }
         }
       }
     },
@@ -18,6 +24,12 @@
             "state": "translated",
             "value": "Benutzerdefiniert"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "自定义"
+          }
         }
       }
     },
@@ -28,6 +40,12 @@
             "state": "translated",
             "value": "Anbieterstandard"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "提供商默认值"
+          }
         }
       }
     },
@@ -38,6 +56,12 @@
             "state": "translated",
             "value": "Temperatur"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度"
+          }
         }
       }
     },
```

**File**: `TypeWhisperPluginSDK/Plugins/FireworksPlugin/Localizable.xcstrings` (modified, +24/-0)
```diff
@@ -8,6 +8,12 @@
             "state": "translated",
             "value": "Temperaturmodus"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度模式"
+          }
         }
       }
     },
@@ -18,6 +24,12 @@
             "state": "translated",
             "value": "Benutzerdefiniert"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "自定义"
+          }
         }
       }
     },
@@ -28,6 +40,12 @@
             "state": "translated",
             "value": "Anbieterstandard"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "提供商默认值"
+          }
         }
       }
     },
@@ -38,6 +56,12 @@
             "state": "translated",
             "value": "Temperatur"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度"
+          }
         }
       }
     },
```

**File**: `TypeWhisperPluginSDK/Plugins/GeminiPlugin/Localizable.xcstrings` (modified, +24/-0)
```diff
@@ -8,6 +8,12 @@
             "state": "translated",
             "value": "Temperaturmodus"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度模式"
+          }
         }
       }
     },
@@ -18,6 +24,12 @@
             "state": "translated",
             "value": "Benutzerdefiniert"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "自定义"
+          }
         }
       }
     },
@@ -28,6 +40,12 @@
             "state": "translated",
             "value": "Anbieterstandard"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "提供商默认值"
+          }
         }
       }
     },
@@ -38,6 +56,12 @@
             "state": "translated",
             "value": "Temperatur"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度"
+          }
         }
       }
     },
```

**File**: `TypeWhisperPluginSDK/Plugins/Gemma4Plugin/Localizable.xcstrings` (modified, +54/-0)
```diff
@@ -8,6 +8,12 @@
             "state": "translated",
             "value": "Temperaturmodus"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度模式"
+          }
         }
       }
     },
@@ -18,6 +24,12 @@
             "state": "translated",
             "value": "Kreativ"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "创意"
+          }
         }
       }
     },
@@ -28,6 +40,12 @@
             "state": "translated",
             "value": "Benutzerdefiniert"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "自定义"
+          }
         }
       }
     },
@@ -38,6 +56,12 @@
             "state": "translated",
             "value": "Generierung"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "生成"
+          }
         }
       }
     },
@@ -48,6 +72,12 @@
             "state": "translated",
             "value": "Laden"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "加载"
+          }
         }
       }
     },
@@ -58,6 +88,12 @@
             "state": "translated",
             "value": "Präzise"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "精准"
+          }
         }
       }
     },
@@ -68,6 +104,12 @@
             "state": "translated",
             "value": "Anbieterstandard"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "提供商默认值"
+          }
         }
       }
     },
@@ -78,6 +120,12 @@
             "state": "translated",
             "value": "Temperatur"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度"
+          }
         }
       }
     },
@@ -88,6 +136,12 @@
             "state": "translated",
             "value": "Verwendet die integrierte Standardtemperatur von Gemma 4."
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "使用 Gemma 4 内置的默认温度。"
+          }
         }
       }
     },
```

**File**: `TypeWhisperPluginSDK/Plugins/GroqPlugin/Localizable.xcstrings` (modified, +48/-0)
```diff
@@ -228,6 +228,12 @@
             "state": "translated",
             "value": "Benutzerdefiniert"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "自定义"
+          }
         }
       }
     },
@@ -238,6 +244,12 @@
             "state": "translated",
             "value": "LLM-Modell"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "LLM 模型"
+          }
         }
       }
     },
@@ -248,6 +260,12 @@
             "state": "translated",
             "value": "Anbieterstandard"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "提供商默认值"
+          }
         }
       }
     },
@@ -258,6 +276,12 @@
             "state": "translated",
             "value": "Aktualisieren"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "刷新"
+          }
         }
       }
     },
@@ -268,6 +292,12 @@
             "state": "translated",
             "value": "Temperatur"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度"
+          }
         }
       }
     },
@@ -278,6 +308,12 @@
             "state": "translated",
             "value": "Temperaturmodus"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "温度模式"
+          }
         }
       }
     },
@@ -288,6 +324,12 @@
             "state": "translated",
             "value": "Transkriptionsmodell"
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "转录模型"
+          }
         }
       }
     },
@@ -298,6 +340,12 @@
             "state": "translated",
             "value": "Standardmodelle werden verwendet. Klicke auf „Aktualisieren“, um alle verfügbaren Modelle abzurufen."
           }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "正在使用默认模型。点击刷新以获取所有可用模型。"
+          }
         }
       }
     }
```

---

### Incident Patch 13: `3b8e8953` (2026-09-28)
**Commit Message**: fix: release Bluetooth input before media resume (#1356)

Release Bluetooth recording input and finish pending preparation cleanup before restoring system audio. Preserve recording-specific side effects across preference changes and retain prepared input when no media was paused.

Validated with focused Bluetooth/media regression tests, app and SDK CI, and the release build.

**File**: `TypeWhisper/Services/AudioRecordingService.swift` (modified, +88/-5)
```diff
@@ -298,6 +298,11 @@ final class AudioRecordingService: ObservableObject, @unchecked Sendable {
         }
     }
 
+    enum BluetoothStopBehavior: Equatable {
+        case keepPrepared
+        case release
+    }
+
     enum AudioRecordingError: LocalizedError {
         case microphonePermissionDenied
         case noMicrophoneDetected
@@ -344,6 +349,10 @@ final class AudioRecordingService: ObservableObject, @unchecked Sendable {
     var inputAvailabilityOverride: ((AudioDeviceID?) -> Bool)?
     var startRecordingOverride: (() throws -> Void)?
     var stopRecordingOverride: ((StopPolicy) async -> [Float])?
+#if DEBUG
+    private(set) var testingLastBluetoothStopBehavior: BluetoothStopBehavior?
+#endif
+    var engineTeardownOverride: ((AVAudioEngine) -> Void)?
     var onFirstRecordingAudioBuffer: (() -> Void)?
 
     /// CoreAudio device ID to use for recording. nil = system default input.
@@ -614,8 +623,13 @@ final class AudioRecordingService: ObservableObject, @unchecked Sendable {
     }
 
     private func scheduleRecordingInputPreparation(after delay: TimeInterval) {
+        let scheduledGeneration = engineLock.withLock { preparedInputGeneration }
         recordingStartQueue.asyncAfter(deadline: .now() + delay) { [weak self] in
-            self?.performRecordingInputPreparationIfEligible()
+            guard let self,
+                  self.engineLock.withLock({ self.preparedInputGeneration == scheduledGeneration }) else {
+                return
+            }
+            self.performRecordingInputPreparationIfEligible()
         }
     }
 
@@ -893,7 +907,10 @@ final class AudioRecordingService: ObservableObject, @unchecked Sendable {
                 usesBluetoothTransport: true,
                 reason: "bluetooth-instant-start-prewarm",
                 readinessDeadline: readinessDeadline,
-                shouldCancel: { [self] in hasPendingRecordingStart }
+                shouldCancel: { [self] in
+                    hasPendingRecordingStart
+                        || engineLock.withLock { preparedInputGeneration != preparationGeneration }
+                }
             )
             let preparedInput = try prepareBluetoothEngine(
                 deviceID: deviceID,
@@ -1044,6 +1061,14 @@ final class AudioRecordingService: ObservableObject, @unchecked Sendable {
         logger.info("Invalidated prepared recording input: \(reason, privacy: .public)")
     }
 
+    private func waitForRecordingInputPreparationCleanup() async {
+        await withCheckedContinuation { continuation in
+            recordingStartQueue.async {
+                continuation.resume()
+            }
+        }
+    }
+
     /// Thread-safe snapshot of the current recording buffer for streaming transcription.
     func getCurrentBuffer() -> [Float] {
         bufferLock.lock()
@@ -1413,7 +1438,13 @@ final class AudioRecordingService: ObservableObject, @unchecked Sendable {
         }
     }
 
-    func stopRecording(policy: StopPolicy) async -> [Float] {
+    func stopRecording(
+        policy: StopPolicy,
+        bluetoothBehavior: BluetoothStopBehavior = .keepPrepared
+    ) async -> [Float] {
+#if DEBUG
+        testingLastBluetoothStopBehavior = bluetoothBehavior
+#endif
         if let stopRecordingOverride {
             outputVolumeGuard.captureBaseline()
             let samples = await stopRecordingOverride(policy)
@@ -1489,6 +1520,10 @@ final class AudioRecordingService: ObservableObject, @unchecked Sendable {
         }
 
         guard let engine = capture.engine else {
+            if bluetoothBehavior == .release {
+                invalidatePreparedRecordingInputs(reason: "bluetooth-recording-release-without-engine")
+                await waitForRecordingInputPreparationCleanup()
+            }
             outputVolumeGuard.clear()
             return []
         }
@@ -1511,8 +1546,16 @@ final class AudioRecordingService: ObservableObject, @unchecked Sendable {
 
         removeConfigurationObserver()
         outputVolumeGuard.captureBaseline()
-        let keptPreparedInput = keepBluetoothInputPrepared(engine)
+        if bluetoothBehavior == .release {
+            invalidatePreparedRecordingInputs(reason: "bluetooth-recording-release")
+            await waitForRecordingInputPreparationCleanup()
+        }
+        let keptPreparedInput = bluetoothBehavior == .keepPrepared
+            && keepBluetoothInputPrepared(engine)
         if !keptPreparedInput {
+            processingQueue.sync {
+                bluetoothInputStartupTracker.reset()
+            }
             teardownEngine(engine)
             // CoreAudio teardown callbacks can outlive the stopped engine.
             engineTeardownRetainer.retain(engine, for: Self.engineTeardownRetentionInterval)
@@ -1534,7 +1577,9 @@ final class AudioRecordingService: ObservableObject, @unchecked Sendable {
             self?.rawAudioLevel = 0
         }
 
-        scheduleRecordingInputPreparation(after: Self.postRecordingInput
```

**File**: `TypeWhisper/Services/MediaPlaybackService.swift` (modified, +11/-8)
```diff
@@ -216,19 +216,20 @@ class MediaPlaybackService {
     }
 
     /// Pauses active media before Bluetooth capture changes the system audio route.
-    func pauseImmediatelyIfPlaying() async {
+    @discardableResult
+    func pauseImmediatelyIfPlaying() async -> Bool {
         cancelPendingResume()
-        guard !didPause, !Task.isCancelled else { return }
+        guard !didPause, !Task.isCancelled else { return didPause }
         trackInfoRequestGeneration += 1
         let generation = trackInfoRequestGeneration
         let snapshot = await currentPlaybackSnapshot()
 
-        guard !Task.isCancelled else { return }
-        guard generation == trackInfoRequestGeneration else { return }
-        guard !didPause else { return }
+        guard !Task.isCancelled else { return false }
+        guard generation == trackInfoRequestGeneration else { return false }
+        guard !didPause else { return true }
         guard let snapshot, snapshot.isActivelyPlaying else {
             logSkippedPause(stage: "immediate", snapshot: snapshot)
-            return
+            return false
         }
 
         nowPlayingBundleID = snapshot.bundleIdentifier
@@ -241,13 +242,14 @@ class MediaPlaybackService {
             matching: snapshot,
             requestGeneration: generation
         )
-        guard !Task.isCancelled, generation == trackInfoRequestGeneration else { return }
+        guard !Task.isCancelled, generation == trackInfoRequestGeneration else { return true }
 
         if pauseConfirmed {
             logger.info("Media pause confirmed before Bluetooth capture")
         } else {
             logger.warning("Media pause confirmation timed out; continuing with Bluetooth capture")
         }
+        return true
     }
 
     /// Resumes playback only if we previously paused it.
@@ -378,7 +380,8 @@ class MediaPlaybackService {
     #else
     init(startListening: Bool = true) {}
     func pauseIfPlaying() {}
-    func pauseImmediatelyIfPlaying() async {}
+    @discardableResult
+    func pauseImmediatelyIfPlaying() async -> Bool { false }
     func resumeIfWePaused() {}
     #endif
 }
```

**File**: `TypeWhisper/ViewModels/DictationViewModel.swift` (modified, +35/-4)
```diff
@@ -485,6 +485,8 @@ final class DictationViewModel: ObservableObject {
     private var shouldPlayRecordingStartSoundWhenReady = false
     private var pendingRecordingAudioDuckingLevel: Float?
     private var pendingRecordingAudioDuckingTask: Task<Void, Never>?
+    private var recordingUsesBluetoothInput = false
+    private var recordingRestoresSystemAudio = false
     private var dictationSessions: [UUID: DictationSessionSnapshot] = [:]
     private var dictationSessionOrder: [UUID] = []
     private let maxTrackedDictationSessions = 100
@@ -1220,6 +1222,22 @@ final class DictationViewModel: ObservableObject {
     private func restoreRecordingSideEffects() {
         audioDuckingService.restoreAudio()
         mediaPlaybackService.resumeIfWePaused()
+        recordingUsesBluetoothInput = false
+        recordingRestoresSystemAudio = false
+    }
+
+    private var bluetoothStopBehavior: AudioRecordingService.BluetoothStopBehavior {
+        Self.bluetoothStopBehavior(
+            usesBluetoothInput: recordingUsesBluetoothInput,
+            restoresSystemAudio: recordingRestoresSystemAudio
+        )
+    }
+
+    static func bluetoothStopBehavior(
+        usesBluetoothInput: Bool,
+        restoresSystemAudio: Bool
+    ) -> AudioRecordingService.BluetoothStopBehavior {
+        usesBluetoothInput && restoresSystemAudio ? .release : .keepPrepared
     }
 
     private func prepareRecordingStartCue(playsSound: Bool) {
@@ -1325,7 +1343,10 @@ final class DictationViewModel: ObservableObject {
         recordingCleanupTask = Task {
             await previousCleanup?.value
             await pendingStartTask?.value
-            _ = await audioRecordingService.stopRecording(policy: .immediate)
+            _ = await audioRecordingService.stopRecording(
+                policy: .immediate,
+                bluetoothBehavior: bluetoothStopBehavior
+            )
             restoreRecordingSideEffects()
             if preserveRecoveryAudio {
                 audioRecordingService.preserveActiveRecoveryRecording()
@@ -1752,6 +1773,8 @@ final class DictationViewModel: ObservableObject {
                 await previousCleanup?.value
                 try Task.checkCancellation()
                 guard self.activeDictationSessionID == sessionID else { return }
+                self.recordingUsesBluetoothInput = selectedInputUsesBluetooth
+                self.recordingRestoresSystemAudio = false
                 var resolvedStartupApp: (name: String?, bundleId: String?, url: String?)? = needsEarlyWorkflowMatch
                     ? initialActiveApp : nil
                 if resolveWebsiteBeforeRecording {
@@ -1781,7 +1804,7 @@ final class DictationViewModel: ObservableObject {
                     return
                 }
                 if selectedInputUsesBluetooth, self.mediaPauseEnabled {
-                    await self.mediaPlaybackService.pauseImmediatelyIfPlaying()
+                    self.recordingRestoresSystemAudio = await self.mediaPlaybackService.pauseImmediatelyIfPlaying()
                     try Task.checkCancellation()
                     guard self.activeDictationSessionID == sessionID else { return }
                 }
@@ -1904,9 +1927,11 @@ final class DictationViewModel: ObservableObject {
             logger.info("Skipping recording start sound for Bluetooth input device")
         }
         if mediaPauseEnabled, !selectedInputUsesBluetooth {
+            recordingRestoresSystemAudio = true
             mediaPlaybackService.pauseIfPlaying()
         }
         if audioDuckingEnabled {
+            recordingRestoresSystemAudio = true
             pendingRecordingAudioDuckingLevel = max(0, min(1, Float(audioDuckingLevel)))
         } else {
             pendingRecordingAudioDuckingLevel = nil
@@ -2348,7 +2373,10 @@ final class DictationViewModel: ObservableObject {
             streamingHandler.stop()
             lastStreamingParams = nil
             stopRecordingTimer()
-            _ = await audioRecordingService.stopRecording(policy: .immediate)
+            _ = await audioRecordingService.stopRecording(
+                policy: .immediate,
+                bluetoothBehavior: bluetoothStopBehavior
+            )
             restoreRecordingSideEffects()
             audioRecordingService.discardActiveRecoveryRecording()
             guard !Task.isCancelled else { return }
@@ -2375,7 +2403,10 @@ final class DictationViewModel: ObservableObject {
         stopRecordingTimer()
         let previewText = partialText.trimmingCharacters(in: .whitespacesAndNewlines)
         let stopPolicy = AudioRecordingService.StopPolicy.finalizeShortSpeech()
-        var samples = await audioRecordingService.stopRecording(policy: stopPolicy)
+        var samples = await audioRecordingService.stopRecording(
+            policy: stopPolicy,
+            bluetoothBehavior: bluetoothStopBehavior
+        )
         restoreRecordingSideEffects()
         guard !Task.isCancelled else { return }
        
```

**File**: `TypeWhisperTests/AudioEngineRecoverySupportTests.swift` (modified, +210/-0)
```diff
@@ -2794,6 +2794,189 @@ final class AudioRecordingServiceSelectedDeviceTests: XCTestCase {
         activation.restore(reason: "test-finished")
     }
 
+    func testBluetoothStopReleaseTearsDownInputInsteadOfKeepingItPrepared() async {
+        let preferenceKey = UserDefaultsKeys.airPodsInstantStartEnabled
+        let originalPreference = UserDefaults.standard.object(forKey: preferenceKey)
+        UserDefaults.standard.set(true, forKey: preferenceKey)
+        defer {
+            if let originalPreference {
+                UserDefaults.standard.set(originalPreference, forKey: preferenceKey)
+            } else {
+                UserDefaults.standard.removeObject(forKey: preferenceKey)
+            }
+        }
+
+        let deviceID = AudioDeviceID(2)
+        let activation = FakeAudioInputDeviceActivator()
+        let service = AudioRecordingService(
+            inputActivationGuard: activation,
+            defaultInputController: FakeAudioInputDeviceDefaultController(defaultInputDeviceID: deviceID)
+        )
+        service.hasMicrophonePermissionOverride = true
+        service.configureInputSelection(
+            deviceID: deviceID,
+            hasExplicitDeviceSelection: true,
+            usesBluetoothTransport: true
+        )
+        let engine = AVAudioEngine()
+        var tornDownEngine: AVAudioEngine?
+        service.engineTeardownOverride = { tornDownEngine = $0 }
+        service.testingSetAudioEngine(engine)
+        let generation = service.testingBeginBluetoothInputGeneration()
+
+        _ = await service.stopRecording(
+            policy: .immediate,
+            bluetoothBehavior: .release
+        )
+
+        XCTAssertTrue(tornDownEngine === engine)
+        XCTAssertEqual(
+            service.testingConsumeBluetoothInputSamples([0.5], inputRMS: 0.5, generation: generation),
+            .ignored
+        )
+        XCTAssertFalse(service.testingHasPreparedBluetoothInput())
+        XCTAssertEqual(activation.restoreCalls, ["recording-stop"])
+    }
+
+    func testBluetoothStopReleaseInvalidatesPreparedAndInFlightInputs() async {
+        let deviceID = AudioDeviceID(2)
+        let activation = FakeAudioInputDeviceActivator()
+        let service = AudioRecordingService(
+            inputActivationGuard: activation,
+            defaultInputController: FakeAudioInputDeviceDefaultController(defaultInputDeviceID: deviceID)
+        )
+        service.hasMicrophonePermissionOverride = true
+        service.configureInputSelection(
+            deviceID: deviceID,
+            hasExplicitDeviceSelection: true,
+            usesBluetoothTransport: true
+        )
+
+        let recordingEngine = AVAudioEngine()
+        let preparedEngine = AVAudioEngine()
+        var tornDownEngines: [AVAudioEngine] = []
+        service.engineTeardownOverride = { tornDownEngines.append($0) }
+        service.testingSetAudioEngine(recordingEngine)
+        service.testingSetPreparedBluetoothInput(preparedEngine, deviceID: deviceID)
+        let preparationGeneration = service.testingPreparedInputGeneration()
+
+        _ = await service.stopRecording(
+            policy: .immediate,
+            bluetoothBehavior: .release
+        )
+
+        XCTAssertNotEqual(service.testingPreparedInputGeneration(), preparationGeneration)
+        XCTAssertFalse(service.testingHasPreparedBluetoothInput())
+        XCTAssertEqual(tornDownEngines.count, 2)
+        XCTAssertTrue(tornDownEngines.contains { $0 === preparedEngine })
+        XCTAssertTrue(tornDownEngines.contains { $0 === recordingEngine })
+        XCTAssertEqual(
+            activation.restoreCalls,
+            ["bluetooth-instant-start-prewarm-invalidated", "recording-stop"]
+        )
+    }
+
+    func testBluetoothStopReleaseInvalidatesQueuedInputPreparation() async {
+        let preferenceKey = UserDefaultsKeys.airPodsInstantStartEnabled
+        let originalPreference = UserDefaults.standard.object(forKey: preferenceKey)
+        UserDefaults.standard.set(true, forKey: preferenceKey)
+        defer {
+            if let originalPreference {
+                UserDefaults.standard.set(originalPreference, forKey: preferenceKey)
+            } else {
+                UserDefaults.standard.removeObject(forKey: preferenceKey)
+            }
+        }
+
+        let deviceID = AudioDeviceID(2)
+        let activation = FakeAudioInputDeviceActivator()
+        let queueGate = DispatchSemaphore(value: 0)
+        defer { queueGate.signal() }
+        let service = AudioRecordingService(
+            inputActivationGuard: activation,
+            bluetoothInputRouteStabilizer: FakeBluetoothInputRouteStabilizer { _, _ in false },
+            defaultInputController: FakeAudioInputDeviceDefaultController(defaultInputDeviceID: deviceID)
+        )
+        service.hasMicrophonePermissionOverride = true
+        service.configureInputSelection(
+            deviceID: deviceID,
+            hasExplicitDeviceSelection: true,
+          
```

**File**: `TypeWhisperTests/TypeWhisperIntegrationTests.swift` (modified, +171/-6)
```diff
@@ -39,6 +39,11 @@ private final class APIFakeAudioInputDeviceDefaultController: AudioInputDeviceDe
     }
 }
 
+private final class IntegrationFakeAudioInputDeviceActivator: AudioInputDeviceActivating {
+    func activate(deviceID: AudioDeviceID, reason: String) -> Bool { true }
+    func restore(reason: String) {}
+}
+
 final class WavEncoderParityTests: XCTestCase {
     func testAppAndPluginEncodersProduceIdenticalPCMAtSupportedRates() {
         for rate in [8_000, 16_000, 44_100, 48_000] {
@@ -1745,24 +1750,28 @@ final class TypeWhisperIntegrationTests: XCTestCase {
         let onPause: () -> Void
         let onImmediatePause: @MainActor () async -> Void
         let onResume: () -> Void
+        let immediatePauseResult: Bool
 
         init(
             onPause: @escaping () -> Void = {},
             onImmediatePause: (@MainActor () async -> Void)? = nil,
-            onResume: @escaping () -> Void = {}
+            onResume: @escaping () -> Void = {},
+            immediatePauseResult: Bool = true
         ) {
             self.onPause = onPause
             self.onImmediatePause = onImmediatePause ?? { onPause() }
             self.onResume = onResume
+            self.immediatePauseResult = immediatePauseResult
             super.init(startListening: false)
         }
 
         override func pauseIfPlaying() {
             onPause()
         }
 
-        override func pauseImmediatelyIfPlaying() async {
+        override func pauseImmediatelyIfPlaying() async -> Bool {
             await onImmediatePause()
+            return immediatePauseResult
         }
 
         override func resumeIfWePaused() {
@@ -10217,12 +10226,29 @@ final class TypeWhisperIntegrationTests: XCTestCase {
             controller.returnedSnapshot = FakeMediaPlaybackController.snapshot(isPlaying: false, playbackRate: 0)
         }
 
-        await service.pauseImmediatelyIfPlaying()
+        let didPause = await service.pauseImmediatelyIfPlaying()
 
         XCTAssertEqual(controller.pauseCalls, 1)
+        XCTAssertTrue(didPause)
         XCTAssertTrue(scheduler.scheduledDelays.isEmpty)
     }
 
+    @MainActor
+    func testMediaPlaybackServiceImmediatePauseReturnsFalseWhenPlaybackIsStopped() async {
+        let controller = FakeMediaPlaybackController()
+        controller.returnedSnapshot = FakeMediaPlaybackController.snapshot(
+            isPlaying: false,
+            playbackRate: nil,
+            bundleIdentifier: nil
+        )
+        let service = MediaPlaybackService(startListening: false) { controller }
+
+        let didPause = await service.pauseImmediatelyIfPlaying()
+
+        XCTAssertFalse(didPause)
+        XCTAssertEqual(controller.pauseCalls, 0)
+    }
+
     @MainActor
     func testMediaPlaybackServiceImmediatePauseWaitsForPlaybackConfirmation() async {
         let controller = FakeMediaPlaybackController()
@@ -10244,7 +10270,7 @@ final class TypeWhisperIntegrationTests: XCTestCase {
 
         XCTAssertFalse(pauseFinished)
         confirmationCallback?(FakeMediaPlaybackController.snapshot(isPlaying: false, playbackRate: 0))
-        await pauseTask.value
+        _ = await pauseTask.value
 
         XCTAssertTrue(pauseFinished)
         XCTAssertEqual(controller.pauseCalls, 1)
@@ -10288,7 +10314,7 @@ final class TypeWhisperIntegrationTests: XCTestCase {
         }
 
         pauseTask.cancel()
-        await pauseTask.value
+        _ = await pauseTask.value
 
         XCTAssertEqual(controller.pauseCalls, 1)
     }
@@ -10322,7 +10348,7 @@ final class TypeWhisperIntegrationTests: XCTestCase {
         }
 
         pauseTask.cancel()
-        await pauseTask.value
+        _ = await pauseTask.value
         deferredCallback?(FakeMediaPlaybackController.snapshot(isPlaying: true, playbackRate: 1))
 
         XCTAssertEqual(controller.pauseCalls, 0)
@@ -11791,6 +11817,7 @@ final class TypeWhisperIntegrationTests: XCTestCase {
         audioDeviceSelectionEngineValidator: AudioInputSelectionEngineValidating = AVAudioInputSelectionEngineValidator(),
         audioDeviceDefaultInputController: AudioInputDeviceDefaultControlling = CoreAudioInputDeviceDefaultController(),
         audioRecordingBluetoothInputRouteStabilizer: BluetoothInputRouteStabilizing = CoreAudioBluetoothInputRouteStabilizer(),
+        audioRecordingInputActivator: AudioInputDeviceActivating = AudioInputDeviceActivationGuard(),
         audioRecordingRecoveryAudioStore: DictationRecoveryAudioStore = DictationRecoveryAudioStore(),
         licenseService: LicenseService? = nil,
         transcriptionDeadline: TimeInterval? = nil
@@ -11834,6 +11861,7 @@ final class TypeWhisperIntegrationTests: XCTestCase {
         modelManager.selectProvider(mockPlugin.providerId)
 
         let audioRecordingService = AudioRecordingService(
+            inputActivationGuard: audioRecordingInputActivator,
             bluetoothInputRouteStabilizer: audioRecordingBluetoothInputRouteStabilizer,
             defaultInputController: APIFakeAudioI
```

---

### Incident Patch 14: `f6954a7c` (2026-09-28)
**Commit Message**: Fix localized screenshot fixtures and German settings text

**File**: `TypeWhisper/App/TypeWhisperApp.swift` (modified, +1/-1)
```diff
@@ -1047,7 +1047,7 @@ final class AppDelegate: NSObject, NSApplicationDelegate, SPUUpdaterDelegate {
             return
         }
 
-        prepareScreenshotWindow(window, contentSize: NSSize(width: 1_280, height: 780))
+        prepareScreenshotWindow(window, contentSize: NSSize(width: 1_150, height: 890))
     }
 
     private func prepareScreenshotPremiumWindow(
```

**File**: `TypeWhisper/Models/Workflow.swift` (modified, +2/-2)
```diff
@@ -42,7 +42,7 @@ enum WorkflowTemplate: String, CaseIterable, Codable, Sendable {
         case .translation:
             WorkflowTemplateDefinition(
                 template: self,
-                name: localizedAppText("Translation", de: "Uebersetzung"),
+                name: localizedAppText("Translation", de: "Übersetzung"),
                 description: localizedAppText(
                     "Translate dictated text into the target language.",
                     de: "Uebersetzt diktierten Text in die Zielsprache."
@@ -62,7 +62,7 @@ enum WorkflowTemplate: String, CaseIterable, Codable, Sendable {
         case .meetingNotes:
             WorkflowTemplateDefinition(
                 template: self,
-                name: localizedAppText("Meeting Notes", de: "Meeting Notes"),
+                name: localizedAppText("Meeting Notes", de: "Besprechungsnotizen"),
                 description: localizedAppText(
                     "Structure dictated notes into a meeting summary.",
                     de: "Strukturiert diktierte Notizen zu einer Meeting-Zusammenfassung."
```

**File**: `TypeWhisper/Resources/Localizable.xcstrings` (modified, +373/-39)
```diff
@@ -1,6 +1,286 @@
 {
   "sourceLanguage" : "en",
   "strings" : {
+    "Clear balance" : {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Guthaben löschen"
+          }
+        }
+      }
+    },
+    "Last recognition" : {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Letzte Spracherkennung"
+          }
+        }
+      }
+    },
+    "Balance updated" : {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Guthaben aktualisiert"
+          }
+        }
+      }
+    },
+    "Spent since balance update" : {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Verbrauch seit Guthabenaktualisierung"
+          }
+        }
+      }
+    },
+    "Estimated remaining" : {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Geschätztes Restguthaben"
+          }
+        }
+      }
+    },
+    "Authorization Key is stored securely in the Keychain. If validation fails with a certificate error, install the SaluteSpeech certificate trusted by macOS." : {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Der Autorisierungsschlüssel wird sicher im Schlüsselbund gespeichert. Falls die Prüfung wegen eines Zertifikatfehlers scheitert, installiere das von macOS als vertrauenswürdig eingestufte SaluteSpeech-Zertifikat."
+          }
+        }
+      }
+    },
+    "Local estimate. Update it from SaluteSpeech Studio." : {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Lokale Schätzung. Aktualisiere sie anhand von SaluteSpeech Studio."
+          }
+        }
+      }
+    },
+    "Reset tracked usage" : {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Erfassten Verbrauch zurücksetzen"
+          }
+        }
+      }
+    },
+    "Save balance" : {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Guthaben speichern"
+          }
+        }
+      }
+    },
+    "Valid until" : {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Gültig bis"
+          }
+        }
+      }
+    },
+    "Minutes" : {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Minuten"
+          }
+        }
+      }
+    },
+    "Studio remaining" : {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Studio-Restguthaben"
+          }
+        }
+      }
+    },
+    "Tracked spent" : {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Erfasster Verbrauch"
+          }
+        }
+      }
+    },
+    "Recognition Usage" : {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Spracherkennungsnutzung"
+          }
+        }
+      }
+    },
+    "Corporate" : {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Unternehmen"
+          }
+        }
+      }
+    },
+    "Personal" : {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Persönlich"
+          }
+        }
+      }
+    },
+    "OAuth Scope" : {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "OAuth-Bereich"
+          }
+        }
+      }
+    },
+    "Authorization Key" : {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Autorisierungsschlüssel"
+          }
+        }
+      }
+    },
+    "Reset Defaults" : {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Standardwerte wiederherstellen"
+          }
+        }
+      }
+    },
+    "One word per line. Commas and semicolons are also accepted." : {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Ein Wort pro Zeile. Kommas und Semikolons werden ebenfalls akzeptiert."
+          }
+        }
+      }
+    },
+    "Filler words" : {
+      "localizations": {
+        "de":
```

**File**: `TypeWhisper/Services/ScreenshotFixtureSeeder.swift` (modified, +30/-0)
```diff
@@ -71,12 +71,42 @@ extension ServiceContainer {
         pluginManager.setWorkflowProvider { [weak self] in
             self?.workflowService.workflows.map(\.pluginWorkflowInfo) ?? []
         }
+        seedScreenshotPluginSettings(language: language)
         pluginManager.scanAndLoadPlugins()
 
         statisticsViewModel.refresh()
         homeViewModel.refresh()
     }
 
+    private func seedScreenshotPluginSettings(language: ScreenshotFixtureLanguage) {
+        switch AppConstants.screenshotPluginId {
+        case "com.typewhisper.obsidian":
+            let vaultName = language == .german ? "Wissensbibliothek" : "Knowledge Library"
+            UserDefaults.standard.set(
+                "/Users/demo/Documents/Obsidian/\(vaultName)",
+                forKey: "plugin.com.typewhisper.obsidian.vaultPath"
+            )
+        case "com.typewhisper.mcp-client":
+            let configuration: [String: Any] = [
+                "servers": [[
+                    "id": "4CF83F6E-7A32-4A97-8A97-A9C4BD8CC5B3",
+                    "name": language == .german ? "Projektwissen" : "Project Knowledge",
+                    "transport": "streamableHTTP",
+                    "endpoint": "https://mcp.example.com/mcp",
+                    "launchAcknowledged": false,
+                    "createdAt": 0,
+                    "updatedAt": 0,
+                ]],
+                "actions": [],
+            ]
+            if let data = try? JSONSerialization.data(withJSONObject: configuration) {
+                UserDefaults.standard.set(data, forKey: "plugin.com.typewhisper.mcp-client.configuration-v1")
+            }
+        default:
+            break
+        }
+    }
+
     private func seedScreenshotHistory(
         _ samples: [ScreenshotHistorySample],
         languageCode: String
```

**File**: `TypeWhisper/Views/AboutSettingsView.swift` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ struct AboutSettingsView: View {
                         openSetupWizard()
                     } label: {
                         Label(
-                            localizedAppText("Open Setup Wizard", de: "Setup-Wizard öffnen"),
+                            localizedAppText("Open Setup Wizard", de: "Einrichtungsassistent öffnen"),
                             systemImage: "sparkles"
                         )
                     }
```

**File**: `TypeWhisperPluginSDK/Plugins/CartesiaPlugin/Localizable.xcstrings` (modified, +6/-6)
```diff
@@ -28,7 +28,7 @@
         "de": {
           "stringUnit": {
             "state": "translated",
-            "value": "API-Keys werden sicher im Schluesselbund gespeichert"
+            "value": "API-Keys werden sicher im Schlüsselbund gespeichert"
           }
         },
         "ja": {
@@ -50,7 +50,7 @@
         "de": {
           "stringUnit": {
             "state": "translated",
-            "value": "API-Key konnte nicht geprueft werden. Pruefe die Verbindung und versuche es erneut."
+            "value": "API-Key konnte nicht geprüft werden. Prüfe die Verbindung und versuche es erneut."
           }
         },
         "ja": {
@@ -116,7 +116,7 @@
         "de": {
           "stringUnit": {
             "state": "translated",
-            "value": "Ungueltiger API-Key"
+            "value": "Ungültiger API-Key"
           }
         },
         "ja": {
@@ -270,7 +270,7 @@
         "de": {
           "stringUnit": {
             "state": "translated",
-            "value": "Gesprochene Sprache ist die Sprache der Audioquelle. Waehle Englisch nur, wenn die Aufnahme selbst Englisch ist."
+            "value": "Gesprochene Sprache ist die Sprache der Audioquelle. Wähle Englisch nur, wenn die Aufnahme selbst Englisch ist."
           }
         },
         "ja": {
@@ -336,7 +336,7 @@
         "de": {
           "stringUnit": {
             "state": "translated",
-            "value": "Gueltiger API-Key"
+            "value": "Gültiger API-Key"
           }
         },
         "ja": {
@@ -358,7 +358,7 @@
         "de": {
           "stringUnit": {
             "state": "translated",
-            "value": "Wird geprueft..."
+            "value": "Wird geprüft..."
           }
         },
         "ja": {
```

**File**: `TypeWhisperPluginSDK/Plugins/CerebrasPlugin/CerebrasPlugin.swift` (modified, +1/-1)
```diff
@@ -359,7 +359,7 @@ private struct CerebrasSettingsView: View {
                     Text("Temperature", bundle: bundle)
                         .font(.headline)
 
-                    Picker("Temperature Mode", selection: $llmTemperatureMode) {
+                    Picker(String(localized: "Temperature Mode", bundle: bundle), selection: $llmTemperatureMode) {
                         Text("Provider Default", bundle: bundle).tag(PluginLLMTemperatureMode.providerDefault)
                         Text("Custom", bundle: bundle).tag(PluginLLMTemperatureMode.custom)
                     }
```

**File**: `TypeWhisperPluginSDK/Plugins/CerebrasPlugin/Localizable.xcstrings` (modified, +40/-0)
```diff
@@ -1,6 +1,46 @@
 {
   "sourceLanguage": "en",
   "strings": {
+    "Temperature Mode": {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Temperaturmodus"
+          }
+        }
+      }
+    },
+    "Custom": {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Benutzerdefiniert"
+          }
+        }
+      }
+    },
+    "Provider Default": {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Anbieterstandard"
+          }
+        }
+      }
+    },
+    "Temperature": {
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Temperatur"
+          }
+        }
+      }
+    },
     "API Key": {
       "localizations": {
         "de": {
```

---

### Incident Patch 15: `fe50d65f` (2026-09-27)
**Commit Message**: Fix standalone dictated value final-period cleanup (#1394)

Remove a final period from recognized standalone dictated values, with an explicit opt-out. Preserve URL paths, queries, fragments, abbreviations, and dates, including dates with spaced separators.

Closes #1333

**File**: `TypeWhisper/App/TypeWhisperApp.swift` (modified, +1/-0)
```diff
@@ -769,6 +769,7 @@ final class AppDelegate: NSObject, NSApplicationDelegate, SPUUpdaterDelegate {
             UserDefaultsKeys.dockIconBehaviorWhenMenuBarHidden: DockIconBehavior.keepVisible.rawValue,
             UserDefaultsKeys.updateChannel: AppConstants.defaultReleaseChannel.rawValue,
             UserDefaultsKeys.appFormattingEnabled: true,
+            UserDefaultsKeys.stripFinalPeriodFromStandaloneValuesEnabled: true,
             UserDefaultsKeys.transcriptionNumberNormalizationEnabled: true,
             UserDefaultsKeys.transcriptionNumberNormalizationMinimumValue: TranscriptionNormalizationService.defaultNumberNormalizationMinimumValue,
             UserDefaultsKeys.targetAppCorrectionLearningEnabled: false,
```

**File**: `TypeWhisper/App/UserDefaultsKeys.swift` (modified, +1/-0)
```diff
@@ -121,6 +121,7 @@ enum UserDefaultsKeys {
 
     // MARK: - Formatting
     static let appFormattingEnabled = "appFormattingEnabled"
+    static let stripFinalPeriodFromStandaloneValuesEnabled = "stripFinalPeriodFromStandaloneValuesEnabled"
     static let transcriptionNumberNormalizationEnabled = "transcriptionNumberNormalizationEnabled"
     static let transcriptionNumberNormalizationMinimumValue = "transcriptionNumberNormalizationMinimumValue"
     static let dictationPunctuationProfiles = "dictationPunctuationProfiles"
```

**File**: `TypeWhisper/ViewModels/DictationViewModel.swift` (modified, +139/-2)
```diff
@@ -2696,7 +2696,9 @@ final class DictationViewModel: ObservableObject {
                     let insertionText = DictationInsertionTextFormatter.textForInsertion(
                         text,
                         insertionContext: insertionContext,
-                        contextualInsertionEnabled: contextualInsertionEnabled
+                        contextualInsertionEnabled: contextualInsertionEnabled,
+                        standaloneValueFinalPeriodCleanupEnabled: DictationInsertionTextFormatter
+                            .standaloneValueFinalPeriodCleanupEnabled()
                     )
                     let shouldObservePostInsertionEdits = (
                         shouldTrackTargetAppCorrectionLearning
@@ -4570,10 +4572,15 @@ enum DictationInsertionTextFormatter {
         defaults.bool(forKey: UserDefaultsKeys.appFormattingEnabled)
     }
 
+    static func standaloneValueFinalPeriodCleanupEnabled(defaults: UserDefaults = .standard) -> Bool {
+        defaults.bool(forKey: UserDefaultsKeys.stripFinalPeriodFromStandaloneValuesEnabled)
+    }
+
     static func textForInsertion(
         _ text: String,
         insertionContext: TextInsertionService.InsertionContext? = nil,
-        contextualInsertionEnabled: Bool = true
+        contextualInsertionEnabled: Bool = true,
+        standaloneValueFinalPeriodCleanupEnabled: Bool = true
     ) -> String {
         guard contextualInsertionEnabled, let insertionContext else {
             return text
@@ -4587,6 +4594,13 @@ enum DictationInsertionTextFormatter {
         if shouldStripFinalPeriod(boundaries) {
             result = strippingSingleFinalPeriod(result)
         }
+        if shouldStripStandaloneValueFinalPeriod(
+            result,
+            boundaries: boundaries,
+            enabled: standaloneValueFinalPeriodCleanupEnabled
+        ) {
+            result = strippingSingleFinalPeriod(result)
+        }
 
         if let previous = boundaries.previousCharacter,
            let first = result.first,
@@ -4695,6 +4709,129 @@ enum DictationInsertionTextFormatter {
         return isWordLike(next) || closingPunctuation.contains(next)
     }
 
+    /// Strips a model-added final period when the whole transcript is a
+    /// standalone value (email address, URL, number, version string) dropped
+    /// into an empty field. Mutually exclusive with the mid-sentence rule
+    /// above — that one needs surrounding text, this one needs none — so a
+    /// period can only ever be stripped once.
+    private static func shouldStripStandaloneValueFinalPeriod(
+        _ text: String,
+        boundaries: InsertionBoundaries,
+        enabled: Bool
+    ) -> Bool {
+        guard enabled,
+              boundaries.previousNonWhitespaceCharacter == nil,
+              boundaries.nextNonWhitespaceCharacter == nil
+        else {
+            return false
+        }
+        return StandaloneValueFinalPeriodCleanup.shouldStripFinalPeriod(from: text)
+    }
+
+    /// Decides whether a transcript standing on its own is a value whose final
+    /// period was added by the model rather than dictated, as in
+    /// `name@example.com.` typed into an empty field.
+    ///
+    /// Conservative on purpose: only whole-text matches for email addresses,
+    /// bare-domain URLs, decimal numbers, phone numbers, and version strings
+    /// qualify. Abbreviations (`Dr.`, `U.S.`), prose, ambiguous numeric forms
+    /// such as dates, and URLs carrying a path, query, or fragment keep
+    /// their period — a dot is a legal part of those (RFC 3986 section 2.3).
+    private enum StandaloneValueFinalPeriodCleanup {
+        static func shouldStripFinalPeriod(from text: String) -> Bool {
+            guard text.hasSuffix("."), !text.hasSuffix("..") else { return false }
+            let candidate = String(text.dropLast())
+            guard !candidate.isEmpty else { return false }
+            if isAbbreviation(text) { return false }
+            if isDateLike(candidate) { return false }
+            return isEmailAddress(candidate)
+                || isWebAddress(candidate)
+                || isDecimalNumber(candidate)
+                || isVersionString(candidate)
+                || isPhoneNumber(candidate)
+        }
+
+        /// `Dr.`, `U.S.`, `e.g.`, `Dr.med.`, `Ph.D.` — never values. Each
+        /// dot-separated group is either a single letter or a known
+        /// abbreviation word, so `file.txt.` still counts as a value.
+        private static let abbreviationExpression = try? NSRegularExpression(
+            pattern: #"^(?:(?:[A-Za-z]|Dr|Mr|Mrs|Ms|No|St|Jr|Sr|Prof|Inc|Ltd|Co|etc|vs|bzw|ca|ggf|evtl|Nr|Tel|med|rer|nat|ing|dipl|phil|Ph)\.)+$"#,
+            options: [.caseInsensitive]
+        )
+
+        private static let emailExpression = try? NSRegularExpression(
+            pattern: #"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$"#
+        )
+
+        /// Bare-domain URLs only: `example.com`, `www.example.com`,
+ 
```

**File**: `TypeWhisper/Views/SettingsView.swift` (modified, +9/-0)
```diff
@@ -1153,6 +1153,15 @@ struct RecordingSettingsView: View {
                 Text(String(localized: "Smaller numbers stay as spoken words. Decimals and digit sequences still convert to digits. Existing digits stay unchanged."))
                     .font(.caption)
                     .foregroundStyle(.secondary)
+
+                Toggle(String(localized: "Strip final period from standalone values"), isOn: Binding(
+                    get: { UserDefaults.standard.bool(forKey: UserDefaultsKeys.stripFinalPeriodFromStandaloneValuesEnabled) },
+                    set: { UserDefaults.standard.set($0, forKey: UserDefaultsKeys.stripFinalPeriodFromStandaloneValuesEnabled) }
+                ))
+
+                Text(String(localized: "Removes a model-added period when a dictated email address, URL, number, or version string is inserted on its own, keeping the value usable in form fields. Abbreviations, dates, and sentences are left alone."))
+                    .font(.caption)
+                    .foregroundStyle(.secondary)
             }
 
                 Section(String(localized: "Audio Ducking")) {
```

**File**: `TypeWhisperTests/DictationShortSpeechTests.swift` (modified, +147/-0)
```diff
@@ -610,4 +610,151 @@ final class DictationInsertionTextFormatterTests: XCTestCase {
             " really? "
         )
     }
+
+    // MARK: - Standalone value final-period cleanup (#1333)
+
+    private func emptyFieldInsertionContext() -> TextInsertionService.InsertionContext {
+        TextInsertionService.InsertionContext(
+            value: "",
+            selectedRange: NSRange(location: 0, length: 0),
+            selectedText: nil,
+            previousCharacter: nil,
+            nextCharacter: nil
+        )
+    }
+
+    private func assertStandaloneCleanup(
+        _ input: String,
+        becomes expected: String,
+        enabled: Bool = true,
+        file: StaticString = #filePath,
+        line: UInt = #line
+    ) {
+        XCTAssertEqual(
+            DictationInsertionTextFormatter.textForInsertion(
+                input,
+                insertionContext: emptyFieldInsertionContext(),
+                standaloneValueFinalPeriodCleanupEnabled: enabled
+            ),
+            expected,
+            file: file,
+            line: line
+        )
+    }
+
+    func testStandaloneCleanupStripsFinalPeriodFromEmail() {
+        assertStandaloneCleanup("name@example.com.", becomes: "name@example.com")
+    }
+
+    func testStandaloneCleanupStripsFinalPeriodFromURLs() {
+        assertStandaloneCleanup("https://example.com.", becomes: "https://example.com")
+        assertStandaloneCleanup("www.example.com.", becomes: "www.example.com")
+        assertStandaloneCleanup("example.com.", becomes: "example.com")
+    }
+
+    func testStandaloneCleanupPreservesTerminalPeriodInURLPathsAndQueries() {
+        // A period is a legal part of URL paths and queries (RFC 3986
+        // section 2.3), so the dot may belong to the requested resource.
+        assertStandaloneCleanup("https://example.com/docs.", becomes: "https://example.com/docs.")
+        assertStandaloneCleanup(
+            "https://example.com/files/report.",
+            becomes: "https://example.com/files/report."
+        )
+        assertStandaloneCleanup(
+            "https://example.com/search?q=Dr.",
+            becomes: "https://example.com/search?q=Dr."
+        )
+    }
+
+    func testStandaloneCleanupPreservesSpacedDates() {
+        // Dictation often inserts whitespace around date separators; those
+        // dates must not fall through to the phone-number check.
+        assertStandaloneCleanup("27. 09. 2026.", becomes: "27. 09. 2026.")
+        assertStandaloneCleanup("27 / 09 / 2026.", becomes: "27 / 09 / 2026.")
+        assertStandaloneCleanup("2026 - 09 - 27.", becomes: "2026 - 09 - 27.")
+    }
+
+    func testStandaloneCleanupStripsFinalPeriodFromDecimalNumbers() {
+        assertStandaloneCleanup("3.14.", becomes: "3.14")
+        assertStandaloneCleanup("1,5.", becomes: "1,5")
+        assertStandaloneCleanup("1,000.50.", becomes: "1,000.50")
+        assertStandaloneCleanup("1.000,50.", becomes: "1.000,50")
+    }
+
+    func testStandaloneCleanupStripsFinalPeriodFromPhoneNumbers() {
+        assertStandaloneCleanup("+49 171 2345678.", becomes: "+49 171 2345678")
+        assertStandaloneCleanup("(030) 123456.", becomes: "(030) 123456")
+    }
+
+    func testStandaloneCleanupStripsFinalPeriodFromVersionStrings() {
+        assertStandaloneCleanup("1.2.3.", becomes: "1.2.3")
+        assertStandaloneCleanup("v2.10.4.", becomes: "v2.10.4")
+    }
+
+    func testStandaloneCleanupPreservesAbbreviations() {
+        assertStandaloneCleanup("Dr.", becomes: "Dr.")
+        assertStandaloneCleanup("U.S.", becomes: "U.S.")
+        assertStandaloneCleanup("e.g.", becomes: "e.g.")
+        assertStandaloneCleanup("Dr.med.", becomes: "Dr.med.")
+        assertStandaloneCleanup("Ph.D.", becomes: "Ph.D.")
+    }
+
+    func testStandaloneCleanupPreservesProseAndSentencesEndingInValues() {
+        assertStandaloneCleanup("Hello world.", becomes: "Hello world.")
+        assertStandaloneCleanup(
+            "Contact me at name@example.com.",
+            becomes: "Contact me at name@example.com."
+        )
+    }
+
+    func testStandaloneCleanupPreservesAmbiguousNumericForms() {
+        assertStandaloneCleanup("19.04.2026.", becomes: "19.04.2026.")
+        assertStandaloneCleanup("2026-09-27.", becomes: "2026-09-27.")
+        assertStandaloneCleanup("123.", becomes: "123.")
+    }
+
+    func testStandaloneCleanupPreservesEllipsesAndOtherPunctuation() {
+        assertStandaloneCleanup("Wait...", becomes: "Wait...")
+        assertStandaloneCleanup("Really?", becomes: "Really?")
+    }
+
+    func testStandaloneCleanupRespectsOptOut() {
+        assertStandaloneCleanup("name@example.com.", becomes: "name@example.com.", enabled: false)
+    }
+
+    func testStandaloneCleanupDoesNotApplyAtEndOfExistingSentence() {
+        let context = TextInsertionService.InsertionContext(
+            value: "Email: ",
+            selectedRange: NSRange(location: 7, length: 0),
+            selectedText: nil,
+  
```

#### Recent Merged Pull Requests:
- **PR #1512** (2026-10-06): chore(gemini): prepare plugin 1.1.4 release (@SeoFood)
- **PR #1511** (2026-10-06): Finish Gemini Live dictations when Gemini's voice activity detection reports the end of the turn (@SeoFood)
- **PR #1510** (2026-10-05): docs: refresh README for stable 1.7 and plugin host validation (@SeoFood)
- **PR #1509** (2026-10-05): Add the Mac App Store edition (@SeoFood)
- **PR #1508** (2026-10-05): Suggest enabling Parakeet Vocabulary Boosting when adding dictionary Terms (@SeoFood)
- **PR #1507** (2026-10-05): chore(vercel-ai-gateway): prepare plugin 1.0.2 release (@SeoFood)
- **PR #1506** (2026-10-05): Name Debug builds TypeWhisper Dev.app and use the macOS 27 Device Control pane name (@SeoFood)
- **PR #1505** (2026-10-05): Upload FLAC for MAI-Transcribe through Vercel AI Gateway, shrink request bodies, split on 413 (@SeoFood)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
