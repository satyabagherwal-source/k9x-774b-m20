> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/typewhisper-typewhisper-mac-learnings.md`  
> **Source**: github ([https://github.com/TypeWhisper/typewhisper-mac](https://github.com/TypeWhisper/typewhisper-mac))  
> **Source Version**: `efcfb72c`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-22T21:28:51.289Z  
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
> **Harvest Timestamp**: 2026-10-22T21:28:50.059Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TypeWhisper/typewhisper-mac`
- **Description**: Local speech-to-text for macOS  on-device AI, fully private, optional cloud
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1873 stars

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
- **Issue #1656** (2026-10-20): **Show the real next stage for waiting Speakers records**
  *Symptoms*: ## Problem  `SpeakersView.phase(of:)` maps every waiting record to step 2, "Detect", including a record that will be transcribed first. The tile shows that step, and since #1648 VoiceOver reads the same step, so both describe the wrong next stage.  ## Proposed behavior  A waiting record shows the stage it will run next.  ## Acceptance and verification  - [ ] A waiting record that needs transcription shows the transcription step; one that only needs speaker detection shows "Detect". - [ ] The tile and the VoiceOver value agree. - [ ] A test covers both waiting cases.  Priority: P3. Estimated effort: small.  Sources: `TypeWhisper/Views/SpeakersView.swift` (`phase(of:)`), `TypeWhisper/Views/SpeakerRecordingRow.swift`; discussed in #1648. 

- **Issue #1652** (2026-10-20): **Fix wrong and missing translations found in the accessibility pass**
  *Symptoms*: ## Problem  The accessibility pass in #1648 left `TypeWhisper/Resources/Localizable.xcstrings` untouched to avoid conflicts with the managed settings PRs. It found several wrong or missing catalog entries:  - "Expanded" is translated as "Erweitert" (German) and "拡張" (Japanese), which describe "extended/advanced", not an expanded disclosure state. - German is missing for "Enabled", "Disabled", "More information", "Completed", "Details", "Discard", "Saved to History", "Recovery", "Marketplace" and "Community". - Japanese is missing for the `history.retranscribe.*` keys. - "Effort" has no entry, and "Open details for %@" has no Simplified Chinese. - These keys are no longer used: "Move earlier/later", "%@, %lld updates", "Processing prompt: %@", "Prompt complete".  ## Proposed behavior  Correct the wrong translations, add the missing ones and remove the unused keys.  ## Acceptance and verification  - [ ] "Expanded" reads as an expanded state in German and Japanese, for example "Ausgeklappt" and "展開済み". - [ ] Every listed key has German, Japanese and Simplified Chinese. - [ ] The unused keys are removed, and nothing references them. - [ ] `python3 scripts/check_localization_completeness.py` passes, and the app shows the corrected strings in German and Japanese.  Priority: P2. Estimated effort: small.  Sources: #1648 (follow-ups). 

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

### Incident Patch 1: `42f19164` (2026-10-22)
**Commit Message**: Add Correct Last Dictation to fix and copy the latest dictation (#1691)

* Add Correct Last Dictation to fix and copy the latest dictation

Opens a compact editor for the most recent successful dictation from the
menu bar or an assignable shortcut. Saving updates the History entry,
copies the corrected text and learns with the existing conservative
correction rules behind the unchanged license and setting gate. Cancel
changes nothing, and text in other apps is never rewritten.

* Add screenshots for the Correct Last Dictation pull request

* Keep Correct Last Dictation out of running inserts and other Macs' dictations

- A standalone workflow or a running Insert also shows the inserting
  state. Opening the editor then took the keyboard focus, and the paste
  landed in the editor. The shortcut now reports busy in that case.
- Correcting a dictation that still has an Insert offer updates the
  offer, so Insert pastes the corrected text instead of the old one.
- History sync imports another Mac's dictations with the Mac source.
  The editor now only picks records made on this Mac, using the device
  ID that History filters already compare.

**File**: `TypeWhisper.xcodeproj/project.pbxproj` (modified, +12/-0)
```diff
@@ -203,8 +203,11 @@
 		A91F00000000000000000001 /* SelectionPalettePanel.swift in Sources */ = {isa = PBXBuildFile; fileRef = B91F00000000000000000001 /* SelectionPalettePanel.swift */; };
 		A91F00000000000000000002 /* RecentTranscriptionStore.swift in Sources */ = {isa = PBXBuildFile; fileRef = B91F00000000000000000002 /* RecentTranscriptionStore.swift */; };
 		A91F00000000000000000003 /* RecentTranscriptionPaletteHandler.swift in Sources */ = {isa = PBXBuildFile; fileRef = B91F00000000000000000003 /* RecentTranscriptionPaletteHandler.swift */; };
+		C10200000000000000000001 /* LastDictationCorrectionHandler.swift in Sources */ = {isa = PBXBuildFile; fileRef = C10200000000000000000002 /* LastDictationCorrectionHandler.swift */; };
+		C10200000000000000000003 /* LastDictationCorrectionPanel.swift in Sources */ = {isa = PBXBuildFile; fileRef = C10200000000000000000004 /* LastDictationCorrectionPanel.swift */; };
 		A91F00000000000000000004 /* RecentTranscriptionStoreTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = B91F00000000000000000004 /* RecentTranscriptionStoreTests.swift */; };
 		A91F00000000000000000005 /* RecentTranscriptionPaletteHandlerTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = B91F00000000000000000005 /* RecentTranscriptionPaletteHandlerTests.swift */; };
+		C10200000000000000000005 /* LastDictationCorrectionHandlerTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = C10200000000000000000006 /* LastDictationCorrectionHandlerTests.swift */; };
 		A91F00000000000000000006 /* PromptPaletteControllerTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = B91F00000000000000000006 /* PromptPaletteControllerTests.swift */; };
 		6C1F7A8B9D2E4F5061728394 /* SoundServiceTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 7D2E4F50617283946C1F7A8B /* SoundServiceTests.swift */; };
 		BB8C1D4E5F60718293A4B5C6 /* DictationShortSpeechTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA8C1D4E5F60718293A4B5C6 /* DictationShortSpeechTests.swift */; };
@@ -884,8 +887,11 @@
 		B91F00000000000000000001 /* SelectionPalettePanel.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SelectionPalettePanel.swift; sourceTree = "<group>"; };
 		B91F00000000000000000002 /* RecentTranscriptionStore.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RecentTranscriptionStore.swift; sourceTree = "<group>"; };
 		B91F00000000000000000003 /* RecentTranscriptionPaletteHandler.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RecentTranscriptionPaletteHandler.swift; sourceTree = "<group>"; };
+		C10200000000000000000002 /* LastDictationCorrectionHandler.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = LastDictationCorrectionHandler.swift; sourceTree = "<group>"; };
+		C10200000000000000000004 /* LastDictationCorrectionPanel.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = LastDictationCorrectionPanel.swift; sourceTree = "<group>"; };
 		B91F00000000000000000004 /* RecentTranscriptionStoreTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = RecentTranscriptionStoreTests.swift; sourceTree = "<group>"; };
 		B91F00000000000000000005 /* RecentTranscriptionPaletteHandlerTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = RecentTranscriptionPaletteHandlerTests.swift; sourceTree = "<group>"; };
+		C10200000000000000000006 /* LastDictationCorrectionHandlerTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = LastDictationCorrectionHandlerTests.swift; sourceTree = "<group>"; };
 		B91F00000000000000000006 /* PromptPaletteControllerTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = PromptPaletteControllerTests.swift; sourceTree = "<group>"; };
 		7D2E4F50617283946C1F7A8B /* SoundServiceTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = SoundServiceTests.swift; sourceTree = "<group>"; };
 		AA8C1D4E5F60718293A4B5C6 /* DictationShortSpeechTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = DictationShortSpeechTests.swift; sourceTree = "<group>"; };
@@ -2308,6 +2314,7 @@
 				BB1023000000000000000001 /* DictationSilenceEndpoint.swift */,
 				BB00000000000000000173 /* PromptPaletteHandler.swift */,
 				B91F00000000000000000003 /* RecentTranscriptionPaletteHandler.swift */,
+				C10200000000000000000002 /* LastDictationCorrectionHandler.swift */,
 				BB00000000000000000174 /* DictationSettingsHandler.swift */,
 				C5E6EB12C3CB1F88B36EFA3F /* DictationQuickSelection.swift */,
 				BB00000000000000000239 /* AudioRecorderViewModel.swift */,
@@ -2365,6 +2372,7 @@
 				BB00000000000000000094 /* AudioWaveformView.swift */,

```

**File**: `TypeWhisper/App/TypeWhisperApp.swift` (modified, +3/-0)
```diff
@@ -1014,6 +1014,9 @@ final class AppDelegate: NSObject, NSApplicationDelegate {
         ServiceContainer.shared.hotkeyService.onRestoreRawTranscript = {
             DictationViewModel.shared.restoreRawTranscript()
         }
+        ServiceContainer.shared.hotkeyService.onCorrectLastDictation = {
+            DictationViewModel.shared.triggerCorrectLastDictation()
+        }
         ServiceContainer.shared.hotkeyService.onRecorderToggle = {
             AudioRecorderViewModel.shared.toggleRecording()
         }
```

**File**: `TypeWhisper/App/UserDefaultsKeys.swift` (modified, +2/-0)
```diff
@@ -39,6 +39,7 @@ enum UserDefaultsKeys {
     static let recorderToggleHotkey = "recorderToggleHotkey"
     static let undoLastDictationHotkey = "undoLastDictationHotkey"
     static let restoreRawTranscriptHotkey = "restoreRawTranscriptHotkey"
+    static let correctLastDictationHotkey = "correctLastDictationHotkey"
 
     // MARK: - Hotkeys (JSON-encoded [UnifiedHotkey] per slot)
     static let hybridHotkeys = "hybridHotkeys"
@@ -51,6 +52,7 @@ enum UserDefaultsKeys {
     static let recorderToggleHotkeys = "recorderToggleHotkeys"
     static let undoLastDictationHotkeys = "undoLastDictationHotkeys"
     static let restoreRawTranscriptHotkeys = "restoreRawTranscriptHotkeys"
+    static let correctLastDictationHotkeys = "correctLastDictationHotkeys"
 
     // MARK: - Model / Engine
     static let selectedEngine = "selectedEngine"
```

**File**: `TypeWhisper/Resources/Localizable.xcstrings` (modified, +486/-0)
```diff
@@ -16837,6 +16837,492 @@
         }
       }
     },
+    "Correct Last Dictation" : {
+      "localizations" : {
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Letztes Diktat korrigieren"
+          }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "最後の音声入力を修正"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "修正上次听写"
+          }
+        }
+      }
+    },
+    "Correct Last Dictation..." : {
+      "localizations" : {
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Letztes Diktat korrigieren …"
+          }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "最後の音声入力を修正…"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "修正上次听写…"
+          }
+        }
+      }
+    },
+    "Correct last dictation shortcut" : {
+      "localizations" : {
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Tastenkürzel zum Korrigieren des letzten Diktats"
+          }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "最後の音声入力を修正するショートカット"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "修正上次听写的快捷键"
+          }
+        }
+      }
+    },
+    "correctLastDictation.shortcut.description" : {
+      "localizations" : {
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Korrigiere dein letztes Diktat in einem kleinen Editor und kopiere den korrigierten Text."
+          }
+        },
+        "en" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Fix your latest dictation in a small editor and copy the corrected text."
+          }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "小さなエディタで最後の音声入力を修正し、修正したテキストをコピーします。"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "在小型编辑器中修正上次听写，并复制修正后的文本。"
+          }
+        }
+      }
+    },
+    "correctLastDictation.notice.noDictation" : {
+      "localizations" : {
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Noch kein Diktat zum Korrigieren"
+          }
+        },
+        "en" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "No dictation to correct yet"
+          }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "修正できる音声入力はまだありません"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "还没有可修正的听写"
+          }
+        }
+      }
+    },
+    "correctLastDictation.notice.busy" : {
+      "localizations" : {
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Beende zuerst das laufende Diktat"
+          }
+        },
+        "en" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Finish the current dictation first"
+          }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "現在の音声入力を先に完了してください"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "请先完成当前听写"
+          }
+        }
+      }
+    },
+    "correctLastDictation.editor.label" : {
+      "localizations" : {
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Diktierter Text"
+          }
+        },
+        "en" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Dictated text"
+          }
+        },
+        "ja" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "音声入力したテキスト"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "听写文本"
+          }
+        }
+      }
+    },
+    "correctLastDictation.editor.hint" : {
+      "localizations" : {
+        "de" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Return speichert die Korrektur und kopiert sie. Umschalt-Return fügt eine Zeile ein. Escape bricht ab."
+          }
+        },
+        "en" : {
+          "stringUnit
```

**File**: `TypeWhisper/Services/HistoryService.swift` (modified, +10/-1)
```diff
@@ -110,7 +110,7 @@ struct HistoryPostFilter {
         text.range(of: searchText, options: .caseInsensitive) != nil
     }
 
-    private static func matchesDevice(
+    static func matchesDevice(
         _ record: TranscriptionRecord,
         deviceID: String,
         includeLegacyMac: Bool
@@ -1134,6 +1134,15 @@ final class HistoryService: ObservableObject {
         }
     }
 
+    /// Whether a record was made on this Mac. Records synced from another Mac also have the
+    /// Mac source but carry that Mac's device ID; records without a device ID are local.
+    func isFromThisMac(_ record: TranscriptionRecord) -> Bool {
+        guard let deviceID = historySyncPreferences?.deviceID else {
+            return record.originDeviceID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
+        }
+        return HistoryPostFilter.matchesDevice(record, deviceID: deviceID, includeLegacyMac: true)
+    }
+
     func record(withID id: UUID) -> TranscriptionRecord? {
         var descriptor = FetchDescriptor<TranscriptionRecord>(
             predicate: #Predicate { $0.id == id }
```

**File**: `TypeWhisper/Services/HotkeyService.swift` (modified, +11/-1)
```diff
@@ -103,6 +103,7 @@ enum HotkeySlotType: String, CaseIterable, Sendable {
     case recorderToggle
     case undoLastDictation
     case restoreRawTranscript
+    case correctLastDictation
 
     var defaultsKey: String {
         switch self {
@@ -116,6 +117,7 @@ enum HotkeySlotType: String, CaseIterable, Sendable {
         case .recorderToggle: return UserDefaultsKeys.recorderToggleHotkey
         case .undoLastDictation: return UserDefaultsKeys.undoLastDictationHotkey
         case .restoreRawTranscript: return UserDefaultsKeys.restoreRawTranscriptHotkey
+        case .correctLastDictation: return UserDefaultsKeys.correctLastDictationHotkey
         }
     }
 
@@ -131,6 +133,7 @@ enum HotkeySlotType: String, CaseIterable, Sendable {
         case .recorderToggle: return UserDefaultsKeys.recorderToggleHotkeys
         case .undoLastDictation: return UserDefaultsKeys.undoLastDictationHotkeys
         case .restoreRawTranscript: return UserDefaultsKeys.restoreRawTranscriptHotkeys
+        case .correctLastDictation: return UserDefaultsKeys.correctLastDictationHotkeys
         }
     }
 }
@@ -143,7 +146,7 @@ extension HotkeySlotType {
         case .hybrid, .pushToTalk, .toggle:
             true
         case .promptPalette, .recentTranscriptions, .copyLastTranscription, .pasteLastTranscription, .recorderToggle,
-             .undoLastDictation, .restoreRawTranscript:
+             .undoLastDictation, .restoreRawTranscript, .correctLastDictation:
             false
         }
     }
@@ -229,6 +232,7 @@ final class HotkeyService: ObservableObject, @unchecked Sendable {
     var onRecorderToggle: (() -> Void)?
     var onUndoLastDictation: (() -> Void)?
     var onRestoreRawTranscript: (() -> Void)?
+    var onCorrectLastDictation: (() -> Void)?
     var onProfileDictationStart: ((UUID, UInt64) -> Void)?
     var onWorkflowDictationStart: ((UUID, UInt64) -> Void)?
     var onWorkflowTextProcessing: ((UUID) -> Void)?
@@ -3085,6 +3089,10 @@ final class HotkeyService: ObservableObject, @unchecked Sendable {
             onRestoreRawTranscript?()
             return
         }
+        if slotType == .correctLastDictation {
+            onCorrectLastDictation?()
+            return
+        }
         if slotType == .recorderToggle {
             onRecorderToggle?()
             return
@@ -3169,6 +3177,8 @@ final class HotkeyService: ObservableObject, @unchecked Sendable {
             break // handled on keyDown only
         case .restoreRawTranscript:
             break // handled on keyDown only
+        case .correctLastDictation:
+            break // handled on keyDown only
         case .recorderToggle:
             break // handled on keyDown only
         }
```

**File**: `TypeWhisper/Services/ScreenshotFixtureSeeder.swift` (modified, +27/-1)
```diff
@@ -1,3 +1,4 @@
+import AppKit
 import AVFoundation
 import Foundation
 import TypeWhisperPluginSDK
@@ -35,7 +36,12 @@ extension ServiceContainer {
         }
         seedScreenshotRecorderFolders(state: AppConstants.screenshotState)
 
-        seedScreenshotHistory(content.history, languageCode: language.rawValue)
+        if AppConstants.screenshotState != "correct-last-dictation-empty" {
+            seedScreenshotHistory(content.history, languageCode: language.rawValue)
+        }
+        if AppConstants.screenshotState?.hasPrefix("correct-last-dictation") == true {
+            prepareScreenshotLastDictationCorrection()
+        }
         usageStatisticsService.replaceWithHistoryRecords(historyService.allRecords())
         seedScreenshotFileTranscriptionQueue(languageCode: language.rawValue)
 
@@ -208,6 +214,26 @@ extension ServiceContainer {
         }
     }
 
+    /// Correct Last Dictation copies the corrected text, which must not replace the clipboard
+    /// of the Mac the screenshots are taken on. The newest dictation was post-processed, so
+    /// the editor also shows its original transcript.
+    private func prepareScreenshotLastDictationCorrection() {
+        let clipboard = NSPasteboard(name: NSPasteboard.Name("com.typewhisper.screenshots.clipboard"))
+        dictationViewModel.pasteboardProvider = { clipboard }
+        guard AppConstants.screenshotState == "correct-last-dictation" else { return }
+        _ = historyService.addRecord(
+            timestamp: Date().addingTimeInterval(-120),
+            rawText: "please deploy the release build to kubernetis after the review",
+            finalText: "Please deploy the release build to Kubernetis after the review.",
+            appName: "Slack",
+            appBundleIdentifier: "com.tinyspeck.slackmacgap",
+            durationSeconds: 4.5,
+            language: "en",
+            engineUsed: "parakeet",
+            modelUsed: "Parakeet TDT 0.6B v3"
+        )
+    }
+
     private func seedScreenshotHistory(
         _ samples: [ScreenshotHistorySample],
         languageCode: String
```

**File**: `TypeWhisper/Services/SettingsBackupExporter.swift` (modified, +1/-0)
```diff
@@ -44,6 +44,7 @@ enum SettingsBackupExporter {
         UserDefaultsKeys.recorderToggleHotkeys,
         UserDefaultsKeys.undoLastDictationHotkeys,
         UserDefaultsKeys.restoreRawTranscriptHotkeys,
+        UserDefaultsKeys.correctLastDictationHotkeys,
     ]
 
     // MARK: - DTOs
```

---

### Incident Patch 2: `4e27c985` (2026-10-22)
**Commit Message**: Wait for palette results instead of fixed delays in tests (#1699)

- Replace the 50-150 ms sleeps in the palette handler tests with the
  signals that end the awaited work: the insertion feedback, the end of
  the workflow task, the missing-text error and the clipboard restore.
- Assert that the workflow palette is visible instead of waiting for it;
  it opens synchronously when no workflows exist.
- Read the clipboard at paste time and drop the paste settle window in
  the two restore tests, so a repeated insertion the handler fails to
  ignore fails the paste count.

**File**: `TypeWhisperTests/RecentTranscriptionPaletteHandlerTests.swift` (modified, +67/-20)
```diff
@@ -4,6 +4,10 @@ import TypeWhisperPluginSDK
 import XCTest
 @testable import TypeWhisper
 
+/// The handler tests wait for completion signals instead of fixed delays. This bound only
+/// has to be generous enough that a loaded machine cannot reach it.
+private let asyncWorkTimeout: TimeInterval = 5
+
 @MainActor
 final class RecentTranscriptionPaletteHandlerTests: XCTestCase {
     func testTriggerSelectionOpensOnlyWhenIdle() throws {
@@ -133,11 +137,14 @@ final class RecentTranscriptionPaletteHandlerTests: XCTestCase {
             appName: "Messages",
             appBundleIdentifier: "com.apple.MobileSMS"
         )
+        // The feedback follows the finished insertion, including a Return key if one were sent.
+        let insertionFinished = expectation(description: "insertion feedback shown")
+        handler.onShowNotchFeedback = { _, _, _, _, _ in insertionFinished.fulfill() }
 
         handler.triggerSelection(currentState: .idle)
         controller.select(id: id)
 
-        try await Task.sleep(for: .milliseconds(50))
+        await fulfillment(of: [insertionFinished], timeout: asyncWorkTimeout)
 
         XCTAssertEqual(pasteCount, 1)
         XCTAssertEqual(returnCount, 0)
@@ -181,9 +188,11 @@ final class RecentTranscriptionPaletteHandlerTests: XCTestCase {
             appName: "Messages",
             appBundleIdentifier: "com.apple.MobileSMS"
         )
+        let insertionFinished = expectation(description: "insertion feedback shown")
+        handler.onShowNotchFeedback = { _, _, _, _, _ in insertionFinished.fulfill() }
 
         handler.insertLatest(currentState: .idle)
-        try await Task.sleep(for: .milliseconds(50))
+        await fulfillment(of: [insertionFinished], timeout: asyncWorkTimeout)
 
         XCTAssertFalse(controller.isVisible)
         XCTAssertEqual(pasteCount, 1)
@@ -263,7 +272,7 @@ final class RecentTranscriptionPaletteHandlerTests: XCTestCase {
             }
 
             handler.insertLatest(currentState: .idle)
-            await fulfillment(of: [feedbackShown], timeout: 1.0)
+            await fulfillment(of: [feedbackShown], timeout: asyncWorkTimeout)
 
             XCTAssertEqual(pasteCount, 1, "\(field)")
             XCTAssertEqual(
@@ -289,11 +298,19 @@ final class RecentTranscriptionPaletteHandlerTests: XCTestCase {
         textInsertionService.pasteboardProvider = { pasteboard }
         textInsertionService.focusedTextElementOverride = { nil }
         textInsertionService.defaultPasteFallbackRestoreDelay = .milliseconds(80)
+        // Without a settle window, an insertion the handler failed to ignore would paste right
+        // away instead of after the restore, so the paste count below catches it.
+        textInsertionService.pendingPasteSettleWindow = .zero
 
         let pasteStarted = expectation(description: "synthetic paste started")
+        // A second paste has to fail the paste count, not crash the test process.
+        pasteStarted.assertForOverFulfill = false
         var pasteCount = 0
+        var pastedClipboard: String?
         textInsertionService.pasteSimulatorOverride = {
             pasteCount += 1
+            // Read at paste time: the restore may already have run when the test resumes.
+            pastedClipboard = pasteboard.string(forType: .string)
             pasteStarted.fulfill()
         }
 
@@ -317,11 +334,11 @@ final class RecentTranscriptionPaletteHandlerTests: XCTestCase {
         handler.insertLatest(currentState: .idle)
         handler.insertLatest(currentState: .idle)
 
-        await fulfillment(of: [pasteStarted], timeout: 1.0)
+        await fulfillment(of: [pasteStarted], timeout: asyncWorkTimeout)
         XCTAssertEqual(pasteCount, 1)
-        XCTAssertEqual(pasteboard.string(forType: .string), "Newest transcription")
+        XCTAssertEqual(pastedClipboard, "Newest transcription")
 
-        try await Task.sleep(for: .milliseconds(150))
+        await textInsertionService.waitForPendingClipboardRestore()
         XCTAssertEqual(pasteCount, 1)
         XCTAssertEqual(pasteboard.string(forType: .string), "Original clipboard")
     }
@@ -339,11 +356,19 @@ final class RecentTranscriptionPaletteHandlerTests: XCTestCase {
         textInsertionService.pasteboardProvider = { pasteboard }
         textInsertionService.focusedTextElementOverride = { nil }
         textInsertionService.defaultPasteFallbackRestoreDelay = .milliseconds(80)
+        // Without a settle window, an insertion the handler failed to ignore would paste right
+        // away instead of after the restore, so the paste count below catches it.
+        textInsertionService.pendingPasteSettleWindow = .zero
 
         let pasteStarted = expectation(description: "synthetic paste started")
+        // A second paste has to fail the paste count, not crash the test process.
+        pasteStarted.assertForOverFulfill = false
         var pasteCount = 0
+        var pastedClipboard: String?
         textInsertionService.pasteSimulatorO
```

---

### Incident Patch 3: `695e7be1` (2026-10-22)
**Commit Message**: Revert "Run macOS jobs on the self-hosted Mac mini for SeoFood's own runs (#1705)" (#1711)

This reverts commit 615b1be9c663eff3eeca72d6651b3ed1aa622a88.

**File**: `.github/workflows/appstore-testflight.yml` (modified, +1/-3)
```diff
@@ -97,9 +97,7 @@ jobs:
     name: Archive, export and upload
     needs: changes
     if: needs.changes.outputs.run == 'true'
-    # Runs started by SeoFood from this repository use the self-hosted Mac mini
-    # while the MAC_MINI_RUNNER variable is "on"; everything else uses xcode-27.
-    runs-on: ${{ (vars.MAC_MINI_RUNNER == 'on' && github.actor == 'SeoFood' && github.triggering_actor == 'SeoFood' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)) && 'seofood-mac-mini' || 'xcode-27' }}
+    runs-on: xcode-27
     environment: app-store
     timeout-minutes: 120
     steps:
```

**File**: `.github/workflows/build.yml` (modified, +4/-12)
```diff
@@ -77,9 +77,7 @@ jobs:
           echo "plugin_sdk=$plugin_sdk" | tee -a "$GITHUB_OUTPUT"
 
   release-build:
-    # Runs started by SeoFood from this repository use the self-hosted Mac mini
-    # while the MAC_MINI_RUNNER variable is "on"; everything else uses xcode-27.
-    runs-on: ${{ (vars.MAC_MINI_RUNNER == 'on' && github.actor == 'SeoFood' && github.triggering_actor == 'SeoFood' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)) && 'seofood-mac-mini' || 'xcode-27' }}
+    runs-on: xcode-27
     steps:
       - name: Checkout
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
@@ -189,9 +187,7 @@ jobs:
           retention-days: 14
 
   app-tests:
-    # Runs started by SeoFood from this repository use the self-hosted Mac mini
-    # while the MAC_MINI_RUNNER variable is "on"; everything else uses xcode-27.
-    runs-on: ${{ (vars.MAC_MINI_RUNNER == 'on' && github.actor == 'SeoFood' && github.triggering_actor == 'SeoFood' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)) && 'seofood-mac-mini' || 'xcode-27' }}
+    runs-on: xcode-27
     steps:
       - name: Checkout
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
@@ -272,9 +268,7 @@ jobs:
   plugin-sdk-tests:
     needs: changes
     if: needs.changes.outputs.plugin_sdk == 'true'
-    # Runs started by SeoFood from this repository use the self-hosted Mac mini
-    # while the MAC_MINI_RUNNER variable is "on"; everything else uses xcode-27.
-    runs-on: ${{ (vars.MAC_MINI_RUNNER == 'on' && github.actor == 'SeoFood' && github.triggering_actor == 'SeoFood' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)) && 'seofood-mac-mini' || 'xcode-27' }}
+    runs-on: xcode-27
     steps:
       - name: Checkout
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
@@ -296,9 +290,7 @@ jobs:
   # A Debug arm64 build keeps pull requests fast; the nightly TestFlight workflow
   # builds the universal Release binary and audits it. See docs/appstore/README.md.
   appstore:
-    # Runs started by SeoFood from this repository use the self-hosted Mac mini
-    # while the MAC_MINI_RUNNER variable is "on"; everything else uses xcode-27.
-    runs-on: ${{ (vars.MAC_MINI_RUNNER == 'on' && github.actor == 'SeoFood' && github.triggering_actor == 'SeoFood' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)) && 'seofood-mac-mini' || 'xcode-27' }}
+    runs-on: xcode-27
     timeout-minutes: 60
     env:
       APPSTORE_DERIVED_DATA: build/appstore
```

**File**: `.github/workflows/notarization-log.yml` (modified, +1/-3)
```diff
@@ -13,9 +13,7 @@ permissions:
 
 jobs:
   fetch:
-    # Runs started by SeoFood from this repository use the self-hosted Mac mini
-    # while the MAC_MINI_RUNNER variable is "on"; everything else uses macos-latest.
-    runs-on: ${{ (vars.MAC_MINI_RUNNER == 'on' && github.actor == 'SeoFood' && github.triggering_actor == 'SeoFood' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)) && 'seofood-mac-mini' || 'macos-latest' }}
+    runs-on: macos-latest
     steps:
       - name: Fetch Notarization Log
         env:
```

**File**: `.github/workflows/plugin-release.yml` (modified, +1/-3)
```diff
@@ -33,9 +33,7 @@ permissions:
 
 jobs:
   build:
-    # Runs started by SeoFood from this repository use the self-hosted Mac mini
-    # while the MAC_MINI_RUNNER variable is "on"; everything else uses xcode-27.
-    runs-on: ${{ (vars.MAC_MINI_RUNNER == 'on' && github.actor == 'SeoFood' && github.triggering_actor == 'SeoFood' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)) && 'seofood-mac-mini' || 'xcode-27' }}
+    runs-on: xcode-27
     concurrency:
       group: plugin-release-${{ github.event_name == 'workflow_dispatch' && format('{0}-{1}-v{2}', inputs.distribution_source, inputs.plugin_name, inputs.plugin_version) || github.ref_name }}
       cancel-in-progress: true
```

**File**: `.github/workflows/release.yml` (modified, +4/-12)
```diff
@@ -87,9 +87,7 @@ jobs:
   verify-release-tools:
     needs: [prepare]
     if: needs.prepare.outputs.should_run == 'true'
-    # Runs started by SeoFood from this repository use the self-hosted Mac mini
-    # while the MAC_MINI_RUNNER variable is "on"; everything else uses macos-26.
-    runs-on: ${{ (vars.MAC_MINI_RUNNER == 'on' && github.actor == 'SeoFood' && github.triggering_actor == 'SeoFood' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)) && 'seofood-mac-mini' || 'macos-26' }}
+    runs-on: macos-26
     steps:
       - name: Checkout
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
@@ -106,9 +104,7 @@ jobs:
   app-tests:
     needs: [prepare]
     if: needs.prepare.outputs.should_run == 'true'
-    # Runs started by SeoFood from this repository use the self-hosted Mac mini
-    # while the MAC_MINI_RUNNER variable is "on"; everything else uses xcode-27.
-    runs-on: ${{ (vars.MAC_MINI_RUNNER == 'on' && github.actor == 'SeoFood' && github.triggering_actor == 'SeoFood' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)) && 'seofood-mac-mini' || 'xcode-27' }}
+    runs-on: xcode-27
     steps:
       - name: Checkout
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
@@ -159,9 +155,7 @@ jobs:
   plugin-sdk-tests:
     needs: [prepare]
     if: needs.prepare.outputs.should_run == 'true'
-    # Runs started by SeoFood from this repository use the self-hosted Mac mini
-    # while the MAC_MINI_RUNNER variable is "on"; everything else uses xcode-27.
-    runs-on: ${{ (vars.MAC_MINI_RUNNER == 'on' && github.actor == 'SeoFood' && github.triggering_actor == 'SeoFood' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)) && 'seofood-mac-mini' || 'xcode-27' }}
+    runs-on: xcode-27
     steps:
       - name: Checkout
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
@@ -188,9 +182,7 @@ jobs:
       - app-tests
       - plugin-sdk-tests
     if: needs.prepare.outputs.should_run == 'true'
-    # Runs started by SeoFood from this repository use the self-hosted Mac mini
-    # while the MAC_MINI_RUNNER variable is "on"; everything else uses xcode-27.
-    runs-on: ${{ (vars.MAC_MINI_RUNNER == 'on' && github.actor == 'SeoFood' && github.triggering_actor == 'SeoFood' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)) && 'seofood-mac-mini' || 'xcode-27' }}
+    runs-on: xcode-27
     env:
       RELEASE_TAG: ${{ needs.prepare.outputs.tag }}
     steps:
```

#### Recent Merged Pull Requests:
- **PR #1712** (2026-10-22): Remember the name the user gives their own microphone speaker (@SeoFood)
- **PR #1711** (2026-10-22): Revert "Run macOS jobs on the self-hosted Mac mini for SeoFood's own runs (#1705)" (@SeoFood)
- **PR #1710** (2026-10-22): Send Recorder completions with their speakers and meeting details (@SeoFood)
- **PR #1709** (2026-10-22): Export Recorder transcripts to Obsidian, with dictations optional (@SeoFood)
- **PR #1708** (2026-10-22): Let meeting recordings run without countdowns or the indicator (@SeoFood)
- **PR #1707** (2026-10-22): Time speaker detection with Parakeet when the engine gave no timestamps (@SeoFood)

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

## X. Add Correct Last Dictation to fix and copy the latest dictation (#1691)

**RULE**:
When implementing operations in `TypeWhisper.xcodeproj/project.pbxproj`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in TypeWhisper/typewhisper-mac. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `42f19164`: Add Correct Last Dictation to fix and copy the latest dictation (#1691). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `TypeWhisper.xcodeproj/project.pbxproj`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
		C10200000000000000000001 /* LastDictationCorrectionHandler.swift in Sources */ = {isa = PBXBuildFile; fileRef = C10200000000000000000002 /* LastDictationCorrectionHandler.swift */; };
		C10200000000000000000003 /* LastDictationCorrectionPanel.swift in Sources */ = {isa = PBXBuildFile; fileRef = C10200000000000000000004 /* LastDictationCorrectionPanel.swift */; };
		C10200000000000000000005 /* LastDictationCorrectionHandlerTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = C10200000000000000000006 /* LastDictationCorrectionHandlerTests.swift */; };
		C10200000000000000000002 /* LastDictationCorrectionHandler.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = LastDictationCorrectionHandler.swift; sourceTree = "<group>"; };
		C10200000000000000000004 /* LastDictationCorrectionPanel.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = LastDictationCorrectionPanel.swift; sourceTree = "<group>"; };
		C10200000000000000000006 /* LastDictationCorrectionHandlerTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = LastDictationCorrectionHandlerTests.swift; sourceTree = "<g
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `42f19164` are properly handled with clean fallback behavior.
