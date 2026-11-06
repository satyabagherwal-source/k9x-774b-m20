> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/typewhisper-typewhisper-mac-learnings.md`  
> **Source**: github ([https://github.com/TypeWhisper/typewhisper-mac](https://github.com/TypeWhisper/typewhisper-mac))  
> **Source Version**: `9852feb1`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T20:00:10.568Z  
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
> **Harvest Timestamp**: 2026-11-05T20:00:08.977Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TypeWhisper/typewhisper-mac`
- **Description**: Local speech-to-text for macOS  on-device AI, fully private, optional cloud
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1906 stars

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
- **Issue #1838** (2026-11-03): **[iOS] Email format keeps spoken self-corrections with the local writing models**
  *Symptoms*: ### Platform  iOS app (Email format with the local writing models)  ### What happens  The Email format keeps spoken self-corrections and barely rewrites with the local models, while the Message format resolves them.  Dictation:  > Hi Lena, so quick update on the workshop. It moves to Wednesday, no sorry, Thursday at three pm, same room as last time. And could you bring the new budget and both contracts? Thanks.  - **LFM2.5 2.6B, Email:** subject "Workshop Rescheduled to Wednesday at 3 PM", body "It has been moved to Wednesday, no sorry. Thursday at 3 pm, …". The wrong day ends up in the subject. - **Gemma 4 E2B, Email:** subject "Update on the workshop schedule and requirements", body is the transcript almost word for word ("so quick update", "Wednesday, no sorry. Thursday"). - **Gemma 4 E2B, Message:** "Hi Lena, the workshop moves to Thursday at 3 pm in the same room as last time. …" The correction is resolved.  With a memo without a self-correction, Gemma 4 E2B in the Email format also only adds a subject and keeps the dictation as one paragraph, including fillers like "so" and "Oh, and". LFM2.5 writes greeting, paragraphs and sign-off. Same picture in German.  ### Expected  The Email format applies spoken corrections ("Wednesday, no sorry, Thursday" means Thursday) and drops fillers, like the Message format does, with both local models.  ### Notes  iOS 27.0 Simulator, current `main`, Fast Local speech recognition, same audio file run through File Transcription with each wr

- **Issue #1837** (2026-11-03): **[iOS] Email format with LFM2.5 writes the email as the recipient's reply**
  *Symptoms*: ### Platform  iOS app (File Transcription and History, Email format, local writing model)  ### What happens  With the Email format and the local model **LFM2.5 2.6B**, a German dictation that ends with the speaker's name is written as the **recipient's reply**. The email greets the speaker and is signed by the person being addressed.  Dictation (transcript, unchanged under Original):  > Hallo Lena, also, kurzes Update zum Workshop. Der ist jetzt am Donnerstag um 15 Uhr, im selben Raum wie letztes Mal. Kannst du das neue Budget und beide Verträge mitbringen? Ach, und frag Tom, ob er auch dazukommen will. Danke, Marco.  Result:  > Betreff: Workshop-Update und Budgetanfrage > > Hallo Marco, > > vielen Dank für das Update zum Workshop. Der Workshop ist jetzt am Donnerstag um 15 Uhr im selben Raum wie letztes Mal. Kannst du bitte das neue Budget und beide Verträge mitbringen? … > > Viele Grüße, > Lena  ### Expected  The speaker is the sender: the email starts with "Hallo Lena" and is signed by Marco, as dictated.  ### Notes  - Reproduced twice with the same memo (iOS 27.0 Simulator, current `main`, Fast Local speech recognition). Gemma 4 E2B kept "Hallo Lena … Danke, Marco." for the same memo. - The English version of the same memo ("… Thanks, Marco.") came out right with LFM2.5. - When the memo ends with "Danke dir und bis Donnerstag!" instead, LFM2.5 writes the email correctly to Lena. - The Email prompt could state explicitly that the dictating person is the sender and that a n

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

### Incident Patch 1: `6ed91e6b` (2026-11-04)
**Commit Message**: (bug) Keep input responsive when key events queue up behind a slow main thread (#1865)

* (bug) Keep input responsive when key events queue up behind a slow main thread

The hotkey tap gave the main thread 100 ms per event, counted from the
start of its callback. Events wait in front of the tap while it waits for
an earlier one, so a main thread that answered each event in 60 ms let
input lag by seconds once keys arrived faster than that, and macOS then
switched the tap off by timeout (#1513 on 1.8.2).

- Count the decision timeout from the event's own timestamp, so events
  that already waited too long pass at once.
- Keep the tap off during a timeout backoff. Switching it off makes macOS
  report a user-input disable right away, and that report re-armed it.
- Log when the watchdog finds the tap disabled. macOS drops the timeout
  report once the tap is enabled again.
- Add a lagging main thread to the input freeze smoke script.

* (bug) Release a late tap event before the main thread can claim it

An event that reaches the tap after its decision timeout passes at once.
If the main thread claimed it first, its handler ran with a claimed
deadline that had already expired, so the ev

**File**: `TypeWhisper/Services/HotkeyService.swift` (modified, +78/-15)
```diff
@@ -524,9 +524,16 @@ final class HotkeyService: ObservableObject, @unchecked Sendable {
                 // A listen-only tap never holds input back, so re-arming it is always safe.
                 let outcome = EventTapReenableBackoff.Outcome.reenable
 #else
-                let outcome = byTimeout
-                    ? reenableBackoff.recordTimeout(at: DispatchTime.now().uptimeNanoseconds)
-                    : .reenable
+                let now = DispatchTime.now().uptimeNanoseconds
+                guard byTimeout else {
+                    // Switching the tap off for a backoff makes macOS report a user-input disable
+                    // right away. Re-arming on that report ended every backoff within milliseconds.
+                    // The tap is already off, and switching it off again would trigger another report.
+                    guard reenableBackoff.allowsReenable(at: now) else { return .backingOff(seconds: nil) }
+                    if let tap = port { CGEvent.tapEnable(tap: tap, enable: true) }
+                    return .reenable
+                }
+                let outcome = reenableBackoff.recordTimeout(at: now)
 #endif
                 if let tap = port {
                     // Also switch the tap off when backing off: a watchdog tick may already have
@@ -636,6 +643,21 @@ final class HotkeyService: ObservableObject, @unchecked Sendable {
             }
         }
 
+        /// Tap thread, before the main thread gets `decision`. Releases an event that already
+        /// waited past `timeout` in the queue, so the main thread never starts a handler for an
+        /// event the tap lets through. Handing the decision over afterwards ends the stall.
+        func releaseIfLate(
+            _ decision: Decision,
+            requestedAt: UInt64,
+            timeout: TimeInterval,
+            now: UInt64 = DispatchTime.now().uptimeNanoseconds
+        ) -> Bool {
+            guard DispatchTime(uptimeNanoseconds: now) >= DispatchTime(uptimeNanoseconds: requestedAt) + timeout else {
+                return false
+            }
+            return releaseIfStillIn(.pending, decision, requestedAt: requestedAt)
+        }
+
         /// Main thread.
         func claim(_ decision: Decision, now: UInt64 = DispatchTime.now().uptimeNanoseconds) -> Claim {
             lock.withLock {
@@ -1711,6 +1733,11 @@ final class HotkeyService: ObservableObject, @unchecked Sendable {
     private nonisolated func eventTapWatchdogTick(generation: UUID) {
         let action = eventTapHandle.watchdogTick(generation: generation)
         guard action != .none else { return }
+        if action == .recovered {
+            // macOS reports a timeout with the next input event, and not at all once the tap is
+            // back on, so this line is the only trace of an outage the watchdog ends first.
+            logger.warning("CGEventTap was found disabled, re-enabling")
+        }
         DispatchQueue.main.async { [weak self] in
             guard let self, self.eventTapHandle.isCurrentWatchdog(generation) else { return }
             switch action {
@@ -1890,7 +1917,7 @@ final class HotkeyService: ObservableObject, @unchecked Sendable {
     }
 
     /// Tap thread. Asks the main thread whether to consume `event`, but lets it through if the
-    /// main thread does not pick it up within `eventTapDecisionTimeout`.
+    /// main thread does not pick it up within `eventTapDecisionTimeout` of the event.
     private nonisolated func decideEventTapEvent(_ event: CGEvent) -> Bool {
         nonisolated(unsafe) let event = event
 #if APPSTORE
@@ -1904,7 +1931,14 @@ final class HotkeyService: ObservableObject, @unchecked Sendable {
         return false
 #else
         guard let decision = eventTapMainThreadGate.makeDecision() else { return false }
-        let requestedAt = DispatchTime.now().uptimeNanoseconds
+        let now = DispatchTime.now().uptimeNanoseconds
+        let requestedAt = Self.eventTapDecisionStart(eventTimestamp: event.timestamp, now: now)
+        let late = eventTapMainThreadGate.releaseIfLate(
+            decision,
+            requestedAt: requestedAt,
+            timeout: Self.eventTapDecisionTimeout,
+            now: now
+        )
         DispatchQueue.main.async { [self] in
             switch eventTapMainThreadGate.claim(decision) {
             case .handle:
@@ -1916,31 +1950,50 @@ final class HotkeyService: ObservableObject, @unchecked Sendable {
                 if let stall { finishEventTapMainThreadStall(stall) }
             }
         }
-        switch eventTapMainThreadGate.wait(
-            for: decision,
-            requestedAt: requestedAt,
-            timeout: Self.eventTapDecisionTimeout,
-            claimedTimeout: Self.eventTapClaimedDecisionTimeout
-        ) {
+        let answer: EventTapMainThreadGate.Answer = late
+            ? .released(stallStarted: true)
+            : eventTapMainThreadGate.wait(
+                for: decision,
+        
```

**File**: `TypeWhisperTests/TypeWhisperIntegrationTests.swift` (modified, +85/-0)
```diff
@@ -22363,6 +22363,60 @@ final class HotkeyServiceCompatibilityTests: XCTestCase {
         RunLoop.main.run(until: Date().addingTimeInterval(0.05))
         XCTAssertEqual(cancelCount, 1)
     }
+
+    func testEventTapReleasesAnEventThatAlreadyWaitedInTheQueue() throws {
+        let service = HotkeyService()
+        service.suspendMonitoring()
+        defer { service.suspendMonitoring() }
+        // In #1513 the main thread answered each event in time, but the events behind it queued up
+        // until input lagged for seconds and macOS switched the tap off.
+        nonisolated(unsafe) let keyDown = try XCTUnwrap(CGEvent(keyboardEventSource: nil, virtualKey: 0x00, keyDown: true))
+        keyDown.timestamp = DispatchTime.now().uptimeNanoseconds - 150_000_000
+        final class Answer: @unchecked Sendable {
+            var suppressed: Bool?
+            var duration: TimeInterval = 0
+        }
+        let answer = Answer()
+        let finished = DispatchSemaphore(value: 0)
+        DispatchQueue.global().async {
+            let start = Date()
+            answer.suppressed = service.decideEventTapEventForTesting(keyDown)
+            answer.duration = Date().timeIntervalSince(start)
+            finished.signal()
+        }
+        // Deliberately block the main thread: only a release without waiting finishes in time.
+        XCTAssertEqual(finished.wait(timeout: .now() + 2), .success)
+        XCTAssertEqual(answer.suppressed, false)
+        XCTAssertLessThan(answer.duration, 0.05, "An event that already waited past the decision timeout must pass at once")
+        RunLoop.main.run(until: Date().addingTimeInterval(0.05))
+    }
+
+    @MainActor
+    func testReleasePassedByTheTapStillFindsItsPressInTheMonitor() throws {
+        let service = HotkeyService()
+        service.suspendMonitoring()
+        defer { service.suspendMonitoring() }
+        // A toggle Fn hotkey acts on the release, which the NSEvent monitor handles once the tap lets it through.
+        service.setHotkeyForTesting(fnHotkey(), for: .toggle)
+        service.modifierFlagsStateProvider = { [] }
+        var startCount = 0
+        service.onDictationStart = { _ in startCount += 1 }
+        _ = service.processEventForTesting(try makeFnEvent(isDown: true), source: .eventTap)
+
+        let keyUp = try makeFnEvent(isDown: false)
+        nonisolated(unsafe) let lateKeyUp = try XCTUnwrap(keyUp.cgEvent)
+        lateKeyUp.timestamp = DispatchTime.now().uptimeNanoseconds - 150_000_000
+        let finished = DispatchSemaphore(value: 0)
+        DispatchQueue.global().async {
+            _ = service.decideEventTapEventForTesting(lateKeyUp)
+            finished.signal()
+        }
+        XCTAssertEqual(finished.wait(timeout: .now() + 2), .success)
+        // The main thread ends the tap's stall before the global monitor delivers the release.
+        RunLoop.main.run(until: Date().addingTimeInterval(0.05))
+        service.processGlobalEventForTesting(keyUp)
+        XCTAssertEqual(startCount, 1)
+    }
     #endif
 
     func testEventTapGateWaitsForClaimedHandlerWithinItsOwnBound() throws {
@@ -22403,6 +22457,22 @@ final class HotkeyServiceCompatibilityTests: XCTestCase {
         XCTAssertNotNil(gate.makeDecision(), "The late handler ends the stall")
     }
 
+    func testEventTapGateReleasesALateEventBeforeTheMainThreadCanClaimIt() throws {
+        let gate = HotkeyService.EventTapMainThreadGate()
+        let now = DispatchTime.now().uptimeNanoseconds
+        let fresh = try XCTUnwrap(gate.makeDecision())
+        XCTAssertFalse(gate.releaseIfLate(fresh, requestedAt: now - 50_000_000, timeout: 0.1, now: now))
+        XCTAssertEqual(gate.claim(fresh), .handle)
+        gate.resolve(fresh, suppress: false)
+
+        // A handler acts on its own decision, so it must never start for an event the tap let through.
+        let late = try XCTUnwrap(gate.makeDecision())
+        XCTAssertTrue(gate.releaseIfLate(late, requestedAt: now - 700_000_000, timeout: 0.1, now: now))
+        guard case .skip(let stall) = gate.claim(late) else { return XCTFail("A late event must not reach its handler") }
+        XCTAssertNotNil(stall, "Handing the late event to the main thread ends the stall")
+        XCTAssertNotNil(gate.makeDecision())
+    }
+
     func testEventTapReenableBackoffAfterRepeatedTimeouts() {
         let second: UInt64 = 1_000_000_000
         var backoff = HotkeyService.EventTapReenableBackoff()
@@ -22435,6 +22505,21 @@ final class HotkeyServiceCompatibilityTests: XCTestCase {
         XCTAssertEqual(lone.recordTimeout(at: 4_002 * second), .backingOff(seconds: 30))
     }
 
+    #if !APPSTORE
+    func testEventTapBackoffIgnoresTheReportOfItsOwnDisable() {
+        let service = HotkeyService()
+        service.suspendMonitoring()
+        defer { service.suspendMonitoring() }
+        XCTAssertEqual(service.reportEventTapDisableForTesting(byTimeout: false), .reenable)
+        XCTAssertEqual(service.repo
```

**File**: `scripts/hotkey-input-freeze-smoke.sh` (modified, +50/-28)
```diff
@@ -1,7 +1,8 @@
 #!/usr/bin/env bash
 # Check that the real HotkeyService event tap keeps system input flowing while
-# its main thread stalls. Needs a locally trusted terminal. For about eight
-# seconds it posts F18 presses and repeatedly blocks the main thread for 1.5 s;
+# its main thread stalls or lags. Needs a locally trusted terminal. For about
+# fifteen seconds it posts F18 presses while it blocks the main thread, first for
+# 1.5 s at a time, then for 60 ms on each wake-up with events arriving every 20 ms;
 # typing during that time may lag by up to the tap's decision timeout.
 #   scripts/hotkey-input-freeze-smoke.sh [path/to/HotkeyService.swift]
 set -euo pipefail
@@ -33,8 +34,7 @@ source += workflow[start:end]
 source += Path(sys.argv[2]).read_text()
 source += '''
 setvbuf(stdout, nil, _IONBF, 0)
-alarm(30) // never leave a stalled filter tap behind
-nonisolated(unsafe) let duration: TimeInterval = 8
+alarm(45) // never leave a stalled filter tap behind
 nonisolated(unsafe) let probeTag: Int64 = 0x5A << 56
 
 guard CGPreflightPostEventAccess(), AXIsProcessTrusted() else {
@@ -87,40 +87,62 @@ service.setHotkeyForTesting(UnifiedHotkey(keyCode: 61, modifierFlags: 0, isFn: f
 service.resumeMonitoring()
 precondition(service.isEventTapEnabledForTesting, "The service did not install its event tap")
 
-// Stall the main thread for 1.5 s with short responsive gaps in between.
-Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { _ in usleep(1_500_000) }
-
-nonisolated(unsafe) let posted = DispatchSemaphore(value: 0)
 final class Counter: @unchecked Sendable { var value = 0 }
 nonisolated(unsafe) let sentCount = Counter()
-DispatchQueue.global(qos: .userInitiated).async {
-    let deadline = Date().addingTimeInterval(duration)
-    while Date() < deadline {
-        for down in [true, false] {
-            let event = CGEvent(keyboardEventSource: nil, virtualKey: 79 /* F18 */, keyDown: down)!
-            event.setIntegerValueField(.eventSourceUserData, value: probeTag | uptimeMicros())
-            event.post(tap: .cghidEventTap)
-            sentCount.value += 1
+
+// Posts F18 presses `spacing` apart while `load` slows down the main thread.
+func runScenario(_ name: String, spacing: useconds_t, duration: TimeInterval, load: () -> () -> Void) -> Bool {
+    latencies.lock.withLock { latencies.values.removeAll() }
+    sentCount.value = 0
+    let stopLoad = load()
+    let posted = DispatchSemaphore(value: 0)
+    DispatchQueue.global(qos: .userInitiated).async {
+        let deadline = Date().addingTimeInterval(duration)
+        while Date() < deadline {
+            for down in [true, false] {
+                let event = CGEvent(keyboardEventSource: nil, virtualKey: 79 /* F18 */, keyDown: down)!
+                event.setIntegerValueField(.eventSourceUserData, value: probeTag | uptimeMicros())
+                event.post(tap: .cghidEventTap)
+                sentCount.value += 1
+                usleep(spacing)
+            }
         }
-        usleep(100_000)
+        Thread.sleep(forTimeInterval: 2)
+        posted.signal()
+    }
+    while posted.wait(timeout: .now()) == .timedOut {
+        RunLoop.main.run(until: Date().addingTimeInterval(0.05))
     }
-    Thread.sleep(forTimeInterval: 2)
-    posted.signal()
+    stopLoad()
+    let values = latencies.lock.withLock { latencies.values.sorted() }
+    let maxLatency = values.last ?? .infinity
+    print(String(format: "%@: received %d/%d probe events, p50 %.1f ms, max %.1f ms", name,
+                 values.count, sentCount.value, values.isEmpty ? -1 : values[values.count / 2], maxLatency))
+    return values.count == sentCount.value && maxLatency < 500
 }
-while posted.wait(timeout: .now()) == .timedOut {
-    RunLoop.main.run(until: Date().addingTimeInterval(0.05))
+
+let stalled = runScenario("1.5 s main-thread stalls", spacing: 50_000, duration: 8) {
+    // Long stalls with short responsive gaps in between.
+    let timer = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { _ in usleep(1_500_000) }
+    return { timer.invalidate() }
+}
+let lagging = runScenario("60 ms per main-thread wake-up, an event every 20 ms", spacing: 20_000, duration: 3) {
+    // Each tap decision wakes the main thread, which then takes 60 ms: every event is answered
+    // within the decision timeout, but they arrive faster. Counted per event, their waits added
+    // up to seconds until macOS switched the tap off (#1513 on 1.8.2).
+    let observer = CFRunLoopObserverCreateWithHandler(nil, CFRunLoopActivity.afterWaiting.rawValue, true, 0) { _, _ in
+        usleep(60_000)
+    }
+    CFRunLoopAddObserver(CFRunLoopGetMain(), observer, .commonModes)
+    return { CFRunLoopRemoveObserver(CFRunLoopGetMain(), observer, .commonModes) }
 }
 service.suspendMonitoring()
 
-let values = latencies.lock.withLock { latencies.values.sorted() }
-let maxLatency = values.last ?? .infinity
-print(String(format: "received %d/%d probe events, p50 %.1f ms, 
```

---

### Incident Patch 2: `9852feb1` (2026-11-05)
**Commit Message**: (chore) Measure launch time and memory on every pull request and check PR descriptions (#1872)

The release-build job now also builds the base branch and compares the launch of both Release
builds on one runner: the time to the Launch.firstIdle signpost, CPU time, memory after launch
and peak memory, with a test profile of 3,000 history entries, 300 dictionary entries and 30
snippets. A metric fails when its median change exceeds both limits and at least 80% of the
rounds got worse, confirmed by a second pass; the perf-regression-accepted label lets an
intended cost through. The Launch Benchmark Report workflow writes the table into the pull
request description.

The new PR description check enforces the title prefix, screenshots or a clip for visible
changes unless "No visible UI change" is ticked, and a measurement table in (perf) pull
requests.

**File**: `.github/pull_request_template.md` (modified, +9/-1)
```diff
@@ -1,9 +1,17 @@
 ## Summary
 
-<!-- What does this PR do? -->
+<!-- What does this PR do? For an issue, add its context and "Closes #123". Start the title with (feature), (bug), (perf) or (chore). -->
+
+## Screenshots
+
+<!-- Visible changes (views, settings, menus, assets, texts) need screenshots of the final interface in English, and changes in motion a short clip. Tick the box only if nothing visible changes. The "PR description" check enforces this. -->
+
+- [ ] No visible UI change
 
 ## Test Plan
 
+<!-- (perf) PRs: add a table with the measured metric for main and this PR, and how you measured it. -->
+
 - [ ] Ran `scripts/pr-preflight.sh`
 - [ ] Built and ran locally
 - [ ] Tested the changed functionality manually
```

**File**: `.github/workflows/build.yml` (modified, +116/-0)
```diff
@@ -53,6 +53,7 @@ jobs:
     outputs:
       plugin_sdk: ${{ steps.diff.outputs.plugin_sdk }}
       app: ${{ steps.diff.outputs.app }}
+      launch_benchmark: ${{ steps.diff.outputs.launch_benchmark }}
     steps:
       - name: Checkout
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
@@ -92,15 +93,40 @@ jobs:
           fi
           echo "app=$app" | tee -a "$GITHUB_OUTPUT"
 
+          # The launch benchmark compares the app's launch with the base branch. Pull requests
+          # run it when they change the app's sources, its project or the benchmark itself.
+          launch_benchmark=false
+          if [ "$EVENT_NAME" = "pull_request" ]; then
+            status=0
+            git diff --quiet HEAD^1 HEAD -- TypeWhisper/ TypeWhisper.xcodeproj/ TypeWhisperICloudBridge/ \
+              TypeWhisperPluginSDK/ TypeWhisperTranscribeAction/ TypeWhisperWidgetExtension/ \
+              TypeWhisperWidgetShared/ typewhisper-cli/ ':(glob)*.xcconfig' \
+              scripts/performance/ .github/workflows/build.yml || status=$?
+            case "$status" in
+              0) ;;
+              1) launch_benchmark=true ;;
+              *) echo "::error::git diff failed with exit code $status"; exit "$status" ;;
+            esac
+          fi
+          echo "launch_benchmark=$launch_benchmark" | tee -a "$GITHUB_OUTPUT"
+
   release-build:
     needs: changes
     if: needs.changes.outputs.app == 'true'
     runs-on: xcode-27
+    timeout-minutes: 120
+    permissions:
+      contents: read
+      # The launch benchmark reads the pull request's labels.
+      issues: read
+      pull-requests: read
     steps:
       - name: Checkout
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
           persist-credentials: false
+          # The launch benchmark also builds the merge commit's first parent, the base branch.
+          fetch-depth: 2
 
       - name: Setup Xcode
         uses: maxim-lobanov/setup-xcode@ed7a3b1fda3918c0306d1b724322adc0b8cc0a90 # v1.7.0
@@ -204,6 +230,96 @@ jobs:
           path: build/TypeWhisper-*.dmg
           retention-days: 14
 
+      # Launch benchmark (docs/launch-performance.md): build the base branch into the same
+      # derived data, so only the targets the pull request changed compile again, then launch
+      # both Release builds alternately on this runner and compare them.
+      - name: Build the base branch for the launch benchmark
+        id: base-build
+        if: github.event_name == 'pull_request' && needs.changes.outputs.launch_benchmark == 'true'
+        run: |
+          # Spotlight would index the new build products and the benchmark's profile copies
+          # while the apps launch, and compete with them for the runner's few processors.
+          sudo mdutil -a -i off > /dev/null || echo "::warning::Could not turn off Spotlight indexing"
+          bench="$RUNNER_TEMP/launch-benchmark"
+          mkdir -p "$bench/head" "$bench/base"
+          ditto build/Build/Products/Release/TypeWhisper.app "$bench/head/TypeWhisper.app"
+          merge_commit="$(git rev-parse HEAD)"
+          git checkout --quiet --detach HEAD^1
+          # The same settings as "Build App" for a pull request.
+          if ! xcodebuild -skipPackagePluginValidation -project $PROJECT \
+            -scheme $SCHEME \
+            -configuration Release \
+            -derivedDataPath build \
+            -clonedSourcePackagesDirPath "$RUNNER_TEMP/SourcePackages" \
+            -destination 'generic/platform=macOS' \
+            ENABLE_CODE_COVERAGE=NO \
+            CODE_SIGN_IDENTITY="-" \
+            CODE_SIGNING_REQUIRED=NO \
+            CODE_SIGNING_ALLOWED=NO \
+            ARCHS=arm64 > "$bench/base-build.log" 2>&1; then
+            grep -E ' error: ' "$bench/base-build.log" | sort -u | head -50
+            tail -n 40 "$bench/base-build.log"
+            exit 1
+          fi
+          ditto build/Build/Products/Release/TypeWhisper.app "$bench/base/TypeWhisper.app"
+          git checkout --quiet --detach "$merge_commit"
+
+      - name: Run the launch benchmark
+        id: benchmark
+        if: steps.base-build.outcome == 'success'
+        env:
+          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
+          PR_NUMBER: ${{ github.event.pull_request.number }}
+        run: |
+          bench="$RUNNER_TEMP/launch-benchmark"
+          python3 scripts/performance/launch_benchmark.py run --disposable-mac \
+            --base "$bench/base/TypeWhisper.app" --head "$bench/head/TypeWhisper.app" \
+            --base-sha "$(git rev-parse HEAD^1)" --head-sha "$HEAD_SHA" \
+            --base-source-ref HEAD^1 --head-source-ref HEAD \
+            --pull-request "$PR_NUMBER" \
+            --work "$bench/work" --output build/launch-benchmark/report.json
+
+      # A regression fails the job unless the pull request has the perf-regression-accepted
+      # label. The label is read now, so re
```

**File**: `.github/workflows/launch-benchmark-report.yml` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+name: Launch Benchmark Report
+
+# Writes the launch benchmark table from a pull request's "Build DMG" run into the pull
+# request description. This workflow runs from the default branch with write access, so it
+# also works for pull requests from forks. The report is untrusted data from the pull request:
+# scripts/performance/launch_benchmark.py validates it and renders the table from its numbers.
+on:
+  workflow_run:
+    workflows: [Build DMG]
+    types: [completed]
+
+permissions:
+  contents: read
+
+jobs:
+  description:
+    name: Update the pull request description
+    if: github.event.workflow_run.event == 'pull_request'
+    runs-on: ubuntu-latest
+    timeout-minutes: 5
+    permissions:
+      actions: read
+      contents: read
+      pull-requests: write
+    steps:
+      - name: Checkout
+        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+        with:
+          persist-credentials: false
+
+      - name: Write the launch benchmark into the description
+        env:
+          GH_TOKEN: ${{ github.token }}
+          REPOSITORY: ${{ github.repository }}
+          RUN_ID: ${{ github.event.workflow_run.id }}
+          HEAD_SHA: ${{ github.event.workflow_run.head_sha }}
+          HEAD_BRANCH: ${{ github.event.workflow_run.head_branch }}
+          HEAD_REPOSITORY: ${{ github.event.workflow_run.head_repository.full_name }}
+        run: |
+          set -euo pipefail
+          dir="$RUNNER_TEMP/launch-benchmark"
+          # Runs that skipped the benchmark (documentation, tests, CI only) have no report.
+          if ! gh run download "$RUN_ID" --repo "$REPOSITORY" --name launch-benchmark --dir "$dir"; then
+            echo "Run $RUN_ID has no launch benchmark report."
+            exit 0
+          fi
+          # The number comes from the pull request's own report, so the pull request it names must
+          # also have the run's head commit, branch and repository; another pull request with the
+          # same commit gets nothing.
+          number="$(python3 scripts/performance/launch_benchmark.py pr-number "$dir/report.json")"
+          head="$(gh api "repos/$REPOSITORY/pulls/$number" --jq '[.head.sha, .head.ref, (.head.repo.full_name // "")] | @tsv')"
+          if [ "$head" != "$(printf '%s\t%s\t%s' "$HEAD_SHA" "$HEAD_BRANCH" "$HEAD_REPOSITORY")" ]; then
+            echo "Pull request #$number does not match run $RUN_ID, or it has newer commits that its own run reports."
+            exit 0
+          fi
+          gh api "repos/$REPOSITORY/pulls/$number" --jq '.body // ""' > "$dir/body.md"
+          result="$(python3 scripts/performance/launch_benchmark.py update-description "$dir/report.json" \
+            --body "$dir/body.md" --output "$dir/payload.json")"
+          if [ "$result" = "changed" ]; then
+            gh api --method PATCH "repos/$REPOSITORY/pulls/$number" --input "$dir/payload.json" > /dev/null
+            echo "Updated the launch benchmark in the description of #$number."
+          else
+            echo "The description of #$number already shows this report."
+          fi
```

**File**: `.github/workflows/pr-description.yml` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+name: PR Description
+
+# Checks the title and description against AGENTS.md: the category prefix, screenshots for
+# visible changes and a measurement table for (perf) pull requests. Editing the description
+# runs the check again without the macOS jobs.
+on:
+  pull_request:
+    types: [opened, edited, reopened, synchronize, ready_for_review]
+    branches: [main, 'release/**']
+
+concurrency:
+  group: ${{ github.workflow }}-${{ github.event.pull_request.number }}
+  cancel-in-progress: true
+
+permissions:
+  contents: read
+
+jobs:
+  description:
+    name: PR description
+    runs-on: ubuntu-latest
+    timeout-minutes: 5
+    steps:
+      - name: Checkout
+        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+        with:
+          persist-credentials: false
+          # The pull request merge commit's first parent is the base branch.
+          fetch-depth: 2
+
+      - name: Check the title and description
+        env:
+          PR_TITLE: ${{ github.event.pull_request.title }}
+          PR_BODY: ${{ github.event.pull_request.body }}
+        run: python3 scripts/check_pr_description.py --base HEAD^1 --summary "$GITHUB_STEP_SUMMARY"
```

**File**: `AGENTS.md` (modified, +6/-0)
```diff
@@ -26,6 +26,12 @@ When a change shows in motion (a flow, an animation, live updates, text inserted
 - attach it like a screenshot (GitHub CLI 2.103 or later), `gh pr edit <number> --body-file body.md --attach ./<name>.mp4` (a `![](./<name>.mp4)` reference becomes a video player), and include it in the user handoff; never commit clips to the repository
 - static changes (texts, layout, settings) keep screenshots only
 
+## Checks on Pull Requests
+
+- The `PR description` check enforces the title prefix, screenshots or a clip for visible changes (or the template's `- [x] No visible UI change`) and a measurement table in `(perf)` descriptions. Editing the description runs it again.
+- The `release-build` job compares the launch time, CPU time and memory of the pull request's Release build with its base and writes the table into the description, between the `launch-benchmark` markers. Keep that block when you rewrite the description; CI replaces it after every push.
+- A launch regression fails CI. Find and fix the cause first; the folded launch phases show where the time goes. If the cost is intended, explain why in the description, add the `perf-regression-accepted` label and re-run the `release-build` job. Details: `docs/launch-performance.md`.
+
 ## Mac App Store Edition
 
 - `APPSTORE` code must keep the direct-distribution app unchanged; verify both builds when touching shared files.
```

**File**: `CONTRIBUTING.md` (modified, +6/-1)
```diff
@@ -31,9 +31,14 @@ echo 'DEVELOPMENT_TEAM = YOUR_TEAM_ID' > CodeSigning.local.xcconfig
 1. Create a feature branch from `main`
 2. Keep changes focused - one feature or fix per PR
 3. Test your changes manually and run the automated checks
-4. Fill out the PR template (Summary + Test Plan)
+4. Start the title with `(feature)`, `(bug)`, `(perf)` or `(chore)` and fill out the PR template;
+   visible changes need screenshots, `(perf)` changes a measurement table
 5. PRs are squash-merged into `main`
 
+CI compares the launch time and memory of your build with `main` and adds the results to the
+description; a clear regression fails the build. See
+[docs/launch-performance.md](docs/launch-performance.md).
+
 Recommended checks:
 
 ```bash
```

**File**: `docs/launch-performance.md` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+# Launch performance checks
+
+Every pull request that changes the app compares how its Release build launches with the
+build of its base branch. The `release-build` job of the Build DMG workflow measures both, and
+the table appears in the pull request description.
+
+## What CI measures
+
+The job builds the base branch into the same derived data after the pull request build, so
+only the targets the pull request changed compile again. Then
+`scripts/performance/launch_benchmark.py` runs on the same runner:
+
+1. The base build imports a test profile through its local API: setup completed, update checks
+   and optional launch prompts off, and 3,000 history entries, 300 dictionary entries and 30
+   snippets. Each build then launches once on its own copy of that profile, which checks that
+   the data persisted and runs one-time work such as migrations and statistics backfills.
+2. The builds launch alternately from the same path, 10 rounds each, after the runner's
+   processors have gone idle and with Spotlight indexing off. Every launch starts from a copy of
+   the build's profile, without the local API, and records:
+   - **Time until ready:** from starting the process to the `Launch.firstIdle` signpost, the
+     first time the main thread waits after the service setup, the plugin scan and the model
+     restore.
+   - **CPU time**, **memory after launch** (physical footprint) and **peak memory**, read 6
+     seconds later.
+3. Each metric's change is the median of the paired differences, one pair per round, so a
+   runner that gets slower during the job affects both builds alike.
+
+The table also shows the app size and, folded, the launch phases from the app's signposts
+(`Launch.serviceContainer`, `Plugin.scan` and others) to find where a change comes from.
+
+The CI profile has no downloaded plugins or models, only the two plugins the app bundles, so
+the load times of other plugins do not show up here. Measure changes to plugin loading with
+plugins installed and add those numbers to the description.
+
+## When CI fails
+
+A metric fails when its change exceeds both limits and the pull request was worse in at least
+8 of the 10 rounds:
+
+| Metric | Fails above |
+| --- | --- |
+| Time until ready | +10% and +100 ms |
+| CPU time | +15% and +100 ms |
+| Memory after launch | +5% and +2 MB |
+| Peak memory | +10% and +4 MB |
+
+When the first 10 rounds show a regression, 10 more rounds confirm it; only a regression in
+both passes fails the job. App size never fails it.
+
+The limits come from comparing identical builds on the runner. The shared virtual Mac makes
+times noisy: depending on how busy its host is, the paired differences of one round spread by
+120 to 450 ms for the time until ready and 100 to 250 ms for CPU time, against 0.2 MB for
+memory. Noise moves rounds in both directions, while a real regression makes nearly all of
+them worse, which is what the 8-of-10 rule checks. So the job reliably stops memory growth of
+2 MB, and time or CPU regressions of roughly 20% on a quiet runner; on a busy one only larger
+ones. Smaller changes still show in the table, with the number of rounds that got worse.
+
+If the cost is intended, for example for a feature that has to load something at launch,
+explain why in the description, add the `perf-regression-accepted` label and re-run the
+`release-build` job. The job reads the label when it runs.
+
+Pull requests that only change documentation, tests, scripts or CI files skip the benchmark,
+unless they change the benchmark or `build.yml`.
+
+## Pull request descriptions
+
+The "PR description" check enforces the rules from `AGENTS.md`:
+
+- the title starts with `(feature)`, `(bug)`, `(perf)` or `(chore)`,
+- a pull request that changes something visible has screenshots or a clip, unless
+  `- [x] No visible UI change` is ticked,
+- a `(perf)` pull request has its own measurement table.
+
+The launch table lives between `<!-- launch-benchmark:start -->` and
+`<!-- launch-benchmark:end -->`. The Launch Benchmark Report workflow replaces it after every
+run, and it counts for none of the checks above.
+
+## Running it elsewhere
+
+`run` deletes the preferences of the app's bundle identifier, imports a test profile and
+launches the builds with their real identifier, so it refuses to run without
+`--disposable-mac`. Never run it on a Mac where TypeWhisper is installed. `render`, `check`
+and the tests (`scripts/test_launch_benchmark.py`) run anywhere.
```

**File**: `scripts/check_pr_description.py` (added, +184/-0)
```diff
@@ -0,0 +1,184 @@
+#!/usr/bin/env python3
+"""Check a pull request's title and description against the rules in AGENTS.md.
+
+    PR_TITLE=... PR_BODY=... check_pr_description.py [--base HEAD^1] [--summary FILE]
+
+The workflow sets PR_TITLE and PR_BODY from the event and checks out the merge commit, whose
+first parent is the base branch, so `git diff --base HEAD` holds the pull request's changes.
+
+- The title starts with its category: (feature), (bug), (perf) or (chore).
+- A pull request that changes something visible has a screenshot or a clip in its
+  description, unless "- [x] No visible UI change" is ticked. Visible changes are asset
+  catalogs, string catalogs, Interface Builder files, files under TypeWhisper/Views/ and the
+  widget extension, and changed lines that build views in other Swift files.
+- A (perf) pull request has a measurement table in its description.
+
+HTML comments and the launch performance section that CI writes into the description do not
+count for any rule.
+"""
+from __future__ import annotations
+
+import argparse
+import os
+import re
+import subprocess
+import sys
+
+CATEGORIES = ("feature", "bug", "perf", "chore")
+TITLE = re.compile(r"^\((?:" + "|".join(CATEGORIES) + r")\) \S")
+
+CI_SECTION = re.compile(r"<!-- launch-benchmark:start -->.*?<!-- launch-benchmark:end -->", re.S)
+HTML_COMMENT = re.compile(r"<!--.*?-->", re.S)
+MEDIA = (
+    re.compile(r"!\[[^\]]*\]\(\s*\S+?\s*\)"),
+    re.compile(r"<(?:img|video)\b", re.I),
+    re.compile(r"https://github\.com/user-attachments/assets/[0-9A-Za-z-]+"),
+    re.compile(r"https://(?:private-)?user-images\.githubusercontent\.com/\S+"),
+)
+NO_UI_CHANGE = re.compile(r"^\s*[-*]\s*\[[xX]\]\s*No visible UI change\b", re.M)
+LIST_ITEM = re.compile(r" {0,3}(?:[-*+]|\d{1,9}[.)])\s")
+
+UI_RESOURCES = re.compile(r"(?:\.xcassets/|\.icon/|\.xcstrings$|\.xib$|\.storyboard$)")
+UI_SWIFT_FOLDERS = ("TypeWhisper/Views/", "TypeWhisperWidgetExtension/")
+NOT_SHIPPED = re.compile(r"(?:^|/)[^/]*Tests?/|^(?:docs|scripts|fastlane|\.github)/")
+VIEW_CODE = re.compile(
+    r"\b(?:Text|Button|Toggle|Picker|Label|Image|TextField|SecureField|TextEditor|Slider|Stepper|Menu|"
+    r"Section|Form|List|ScrollView|VStack|HStack|ZStack|LazyVStack|LazyHStack|Grid|GridRow|Divider|"
+    r"ProgressView|DisclosureGroup|GroupBox|NavigationStack|NavigationSplitView|TabView|Link|"
+    r"ContentUnavailableView|NSAlert|NSMenuItem|NSButton|NSTextField|NSWindow|NSPanel)\s*[({]"
+    r"|\.(?:font|foregroundStyle|foregroundColor|padding|frame|background|overlay|help|tint|controlSize|"
+    r"buttonStyle|toggleStyle|pickerStyle|labelStyle|listStyle|formStyle|navigationTitle|toolbar|sheet|"
+    r"alert|confirmationDialog|popover|contextMenu|accessibilityLabel)\s*\("
+    r"|\bsome\s+View\b|:\s*View\b"
+)
+
+
+def visible_text(body):
+    """The description without HTML comments and without the CI section."""
+    return HTML_COMMENT.sub("", CI_SECTION.sub("", body or ""))
+
+
+def has_media(text):
+    return any(pattern.search(text) for pattern in MEDIA)
+
+
+def has_table(text):
+    """A Markdown table with at least two columns and a row that holds a number."""
+    lines = text.splitlines()
+    for index in range(1, len(lines)):
+        delimiter = lines[index].strip()
+        if not ("|" in lines[index - 1] and "---" in delimiter and set(delimiter) <= set("|:- \t")):
+            continue
+        if len([cell for cell in delimiter.strip("|").split("|") if cell.strip()]) < 2:
+            continue
+        # As in GitHub Markdown, a row needs no pipes; a blank line or a new block such as a
+        # heading, quote, code fence or list item ends the table.
+        for row in lines[index + 1:]:
+            if not row.strip() or row.lstrip().startswith(("#", ">", "```", "~~~")) or LIST_ITEM.match(row):
+                break
+            if re.search(r"\d", row):
+                return True
+    return False
+
+
+def changed_lines(diff):
+    """Added and removed lines per file from `git diff -U0` output, without comment-only lines."""
+    result = {}
+    current = old = None
+    in_header = False
+    for line in diff.splitlines():
+        if line.startswith("diff --git "):
+            current = old = None
+            in_header = True
+        elif in_header and line.startswith("--- "):
+            old = line[6:] if line.startswith("--- a/") else None
+        elif in_header and line.startswith("+++ "):
+            # A deleted file has no new path; its removed lines still count.
+            current = line[6:] if line.startswith("+++ b/") else old
+        elif line.startswith("@@"):
+            in_header = False
+        elif current and not in_header and line[:1] in ("+", "-"):
+            code = line[1:].split("//", 1)[0].strip()
+            if code:
+                result.setdefault(current, []).append(code)
+    return result
+
+
+def ui_files(paths, lines_by_file):
+    """The changed paths that show up in the interface."""
+    found
```

---

### Incident Patch 3: `766451b2` (2026-11-04)
**Commit Message**: (perf) Build the dictionary term prompt and hints once per load, and not at stop for a live result (#1847)

* Build the dictionary term prompt and hints only once per load and only when needed

Each recording start and each stop normalized every term four times for the
term prompt and term hints, and the stop path did so even when the live session
result was used. The normalized terms and hints and the prompt and hints
clipped per budget are now kept until the entries are loaded again or the
locale changes, and the stop path builds them only for a batch transcription.
The plugin's capability and budget are still read on every request.

* Drop the cached dictionary terms and vocabulary when entries change in place

**File**: `TypeWhisper/Services/DictionaryService.swift` (modified, +91/-19)
```diff
@@ -72,6 +72,7 @@ final class DictionaryService: ObservableObject {
     /// to rebuild.
     private var entriesGeneration = 0
     private var promptVocabularyCache: (generation: Int, localeIdentifier: String, limit: Int, vocabulary: [String])?
+    private var termsCache = TermsCache(generation: -1, localeIdentifier: "")
 
     @Published private(set) var entries: [DictionaryEntry] = [] {
         didSet { entriesByIdentity = nil }
@@ -235,6 +236,15 @@ final class DictionaryService: ObservableObject {
     /// entry in place, since a failed save keeps that change without reloading.
     private var entriesByIdentity: [String: [DictionaryEntry]]?
 
+    /// The entries are about to change in place. A failed save keeps that
+    /// change without loading the entries again, so drop everything derived
+    /// from them: the identity index and the generation-keyed term and
+    /// vocabulary caches.
+    private func invalidateEntryDerivedCaches() {
+        entriesByIdentity = nil
+        entriesGeneration &+= 1
+    }
+
     func duplicateEntry(type: DictionaryEntryType, original: String, isRegex: Bool, excluding id: UUID? = nil) -> DictionaryEntry? {
         let key = Self.entryIdentity(type: type, original: original, isRegex: isRegex)
         let index = entriesByIdentity ?? Dictionary(grouping: entries) {
@@ -299,7 +309,7 @@ final class DictionaryService: ObservableObject {
         guard duplicateEntry(type: entry.type, original: original, isRegex: isRegex ?? entry.isRegex, excluding: entry.id) == nil else {
             return false
         }
-        entriesByIdentity = nil
+        invalidateEntryDerivedCaches()
 
         let previous = (
             original: entry.original,
@@ -560,13 +570,21 @@ final class DictionaryService: ObservableObject {
     /// Get all enabled terms as a comma-separated string for Whisper prompt.
     /// Truncates at 600 characters to stay within the API's 224-token limit.
     func enabledTerms() -> [String] {
-        PluginDictionaryTerms.normalizedTerms(from: terms.map(\.original))
+        refreshTermsCacheIfStale()
+        if let terms = termsCache.terms { return terms }
+        let terms = enabledTermHints().map(\.text)
+        termsCache.terms = terms
+        return terms
     }
 
     func enabledTermHints() -> [PluginDictionaryTermHint] {
-        PluginDictionaryTerms.normalizedTermHints(from: terms.map {
+        refreshTermsCacheIfStale()
+        if let hints = termsCache.hints { return hints }
+        let hints = PluginDictionaryTerms.normalizedTermHints(from: terms.map {
             PluginDictionaryTermHint(text: $0.original, ctcMinSimilarity: $0.ctcMinSimilarity)
         })
+        termsCache.hints = hints
+        return hints
     }
 
     func setTerms(_ rawTerms: [String], replaceExisting: Bool) {
@@ -581,7 +599,7 @@ final class DictionaryService: ObservableObject {
         guard let context = modelContext else {
             throw DictionaryServiceMutationError.unavailable
         }
-        entriesByIdentity = nil
+        invalidateEntryDerivedCaches()
 
         let normalized = PluginDictionaryTerms.normalizedTerms(from: rawTerms)
         let normalizedByKey = Dictionary(uniqueKeysWithValues: normalized.map {
@@ -625,7 +643,7 @@ final class DictionaryService: ObservableObject {
         guard let context = modelContext else {
             throw DictionaryServiceMutationError.unavailable
         }
-        entriesByIdentity = nil
+        invalidateEntryDerivedCaches()
 
         let normalized = PluginDictionaryTerms.normalizedTermHints(from: rawTerms.map {
             PluginDictionaryTermHint(
@@ -727,12 +745,11 @@ final class DictionaryService: ObservableObject {
     /// `modelId` is a per-request model override, for engines whose models differ in
     /// dictionary terms support.
     func getTermsForPrompt(providerId: String?, modelId: String? = nil) -> String? {
-        let terms = enabledTerms()
-        guard !terms.isEmpty else { return nil }
+        guard !enabledTerms().isEmpty else { return nil }
 
         guard let providerId,
               let plugin = PluginManager.shared?.transcriptionEngine(for: providerId) else {
-            return PluginDictionaryTerms.prompt(from: terms)
+            return termsPrompt(budget: nil)
         }
 
         // An enforced engine and model replace any override, and the enforced model is
@@ -752,26 +769,81 @@ final class DictionaryService: ObservableObject {
         }
 
         guard let budget = (plugin as? any DictionaryTermsBudgetProviding)?.dictionaryTermsBudget else {
-            return PluginDictionaryTerms.prompt(from: terms)
+            return termsPrompt(budget: nil)
         }
 
-        return PluginDictionaryTerms.prompt(from: terms, budget: budget)
+        return termsPrompt(budget: budget)
     }
 
     func getTermHints(providerId: String?) -> [PluginDictionaryTermHint] {
-        let hints = enabledTermHints()
-        guard !hints.isEmpty else { retu
```

**File**: `TypeWhisper/ViewModels/DictationViewModel.swift` (modified, +14/-10)
```diff
@@ -3237,14 +3237,13 @@ final class DictationViewModel: ObservableObject {
                 let translationTarget = effectiveTranslationTarget
                 let primaryEngineId = engineOverride ?? modelManager.selectedProviderId
                 let dictionaryProviderId = primaryEngineId
-                let termsPrompt = dictionaryService.getTermsForPrompt(
-                    providerId: dictionaryProviderId,
-                    modelId: cloudModelOverride
-                )
-                let termHints = dictionaryService.getTermHints(providerId: dictionaryProviderId)
 
-                let transcription = if let liveSessionResult {
-                    FinalTranscriptionOutput(
+                let transcription: FinalTranscriptionOutput
+                // nil for a live result: its session got the terms when it started.
+                let primaryPromptChars: Int?
+                if let liveSessionResult {
+                    primaryPromptChars = nil
+                    transcription = FinalTranscriptionOutput(
                         result: liveSessionResult,
                         modelId: modelManager.resolvedModelId(
                             engineOverrideId: engineOverride,
@@ -3257,14 +3256,19 @@ final class DictationViewModel: ObservableObject {
                         usedRecoveryFallback: false
                     )
                 } else {
-                    try await transcribeFinalAudio(
+                    let termsPrompt = dictionaryService.getTermsForPrompt(
+                        providerId: dictionaryProviderId,
+                        modelId: cloudModelOverride
+                    )
+                    primaryPromptChars = termsPrompt?.count ?? 0
+                    transcription = try await transcribeFinalAudio(
                         audioSamples: samples,
                         languageSelection: languageSelection,
                         task: task,
                         primaryEngineId: primaryEngineId,
                         primaryCloudModelOverride: cloudModelOverride,
                         prompt: termsPrompt,
-                        dictionaryTermHints: termHints,
+                        dictionaryTermHints: dictionaryService.getTermHints(providerId: dictionaryProviderId),
                         normalizeNumbers: effectiveNumberNormalizationOverride
                     )
                 }
@@ -3276,7 +3280,7 @@ final class DictationViewModel: ObservableObject {
                     trace.model = transcription.modelId
                     trace.usedLiveResult = usedLiveSessionResult
                 }
-                logger.info("Stop timing: final transcription ready elapsedMs=\(stopElapsedMs(), privacy: .public), usedLiveResult=\(usedLiveSessionResult, privacy: .public), engine=\(result.engineUsed, privacy: .public), model=\(transcription.modelId ?? "unknown", privacy: .public), usedRecoveryFallback=\(transcription.usedRecoveryFallback, privacy: .public), primaryPromptChars=\(termsPrompt?.count ?? 0, privacy: .public), \(diagnostics, privacy: .public)")
+                logger.info("Stop timing: final transcription ready elapsedMs=\(stopElapsedMs(), privacy: .public), usedLiveResult=\(usedLiveSessionResult, privacy: .public), engine=\(result.engineUsed, privacy: .public), model=\(transcription.modelId ?? "unknown", privacy: .public), usedRecoveryFallback=\(transcription.usedRecoveryFallback, privacy: .public), primaryPromptChars=\(primaryPromptChars.map(String.init) ?? "n/a", privacy: .public), \(diagnostics, privacy: .public)")
 
                 // Bail out if a new recording started while we were transcribing
                 guard !Task.isCancelled else { return }
```

**File**: `TypeWhisperTests/DictionaryServiceTests.swift` (modified, +42/-0)
```diff
@@ -1339,6 +1339,48 @@ final class DictionaryServiceTests: XCTestCase {
         ])
     }
 
+    @MainActor
+    func testTermPromptAndHintsFollowDictionaryAndBudgetChanges() throws {
+        let appSupportDirectory = try TestSupport.makeTemporaryDirectory()
+        defer { TestSupport.remove(appSupportDirectory) }
+
+        let service = DictionaryService(appSupportDirectory: appSupportDirectory)
+        service.setTerms(["Alpha", "BetaBeta", "Gamma"], replaceExisting: true)
+
+        let plugin = BudgetedDictionaryEnginePlugin()
+        plugin.providerIdValue = "budgeted"
+        plugin.budgetValue = DictionaryTermsBudget(maxTerms: 2)
+        installPlugins([plugin], appSupportDirectory: appSupportDirectory)
+
+        XCTAssertEqual(service.getTermsForPrompt(providerId: plugin.providerId), "Alpha, BetaBeta")
+        XCTAssertEqual(service.getTermHints(providerId: plugin.providerId).map(\.text), ["Alpha", "BetaBeta"])
+
+        plugin.budgetValue = DictionaryTermsBudget(maxCharsPerTerm: 5)
+        XCTAssertEqual(service.getTermsForPrompt(providerId: plugin.providerId), "Alpha, Gamma")
+        XCTAssertEqual(service.getTermHints(providerId: plugin.providerId).map(\.text), ["Alpha", "Gamma"])
+
+        service.addEntry(type: .term, original: "Delta", ctcMinSimilarity: 0.7)
+        XCTAssertEqual(service.getTermsForPrompt(providerId: plugin.providerId), "Alpha, Delta, Gamma")
+        XCTAssertEqual(service.getTermsForPrompt(providerId: nil), "Alpha, BetaBeta, Delta, Gamma")
+        XCTAssertEqual(service.getTermHints(providerId: plugin.providerId), [
+            PluginDictionaryTermHint(text: "Alpha", ctcMinSimilarity: nil),
+            PluginDictionaryTermHint(text: "Delta", ctcMinSimilarity: 0.7),
+            PluginDictionaryTermHint(text: "Gamma", ctcMinSimilarity: nil),
+        ])
+
+        let delta = try XCTUnwrap(service.terms.first { $0.original == "Delta" })
+        XCTAssertTrue(service.setCtcMinSimilarity(0.9, forTermEntryIDs: [delta.id]))
+        XCTAssertEqual(
+            service.getTermHints(providerId: nil).first { $0.text == "Delta" },
+            PluginDictionaryTermHint(text: "Delta", ctcMinSimilarity: 0.9)
+        )
+
+        service.setEntryEnabled(delta, enabled: false)
+        XCTAssertEqual(service.enabledTerms(), ["Alpha", "BetaBeta", "Gamma"])
+        XCTAssertEqual(service.getTermsForPrompt(providerId: nil), "Alpha, BetaBeta, Gamma")
+        XCTAssertEqual(service.getTermHints(providerId: plugin.providerId).map(\.text), ["Alpha", "Gamma"])
+    }
+
     @MainActor
     func testGetTermsForPromptFallsBackToLegacyBudgetForUnknownOrUnbudgetedEngines() throws {
         let appSupportDirectory = try TestSupport.makeTemporaryDirectory()
```

#### Recent Merged Pull Requests:
- **PR #1872** (2026-11-05): (chore) Measure launch time and memory on every pull request and check PR descriptions (@SeoFood)
- **PR #1870** (2026-11-04): (chore) Stop the Reson8 short-word test from repeating the word on slow runners (@SeoFood)
- **PR #1867** (2026-11-04): (feature) Pass the calendar meeting's title, times and attendees to Recorder scripts (@SeoFood)
- **PR #1865** (2026-11-04): (bug) Keep input responsive when key events queue up behind a slow main thread (@SeoFood)
- **PR #1862** (2026-11-04): (bug) Recover from a missing audio device instead of failing every recording until relaunch (@SeoFood)
- **PR #1861** (2026-11-04): (chore) Note why the live field does not write into Chrome's web text fields (@SeoFood)

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

## X. (bug) Keep input responsive when key events queue up behind a slow main thread (

**RULE**:
When implementing operations in `TypeWhisper/Services/HotkeyService.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in TypeWhisper/typewhisper-mac. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6ed91e6b`: (bug) Keep input responsive when key events queue up behind a slow main thread (#1865). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `TypeWhisper/Services/HotkeyService.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
                let now = DispatchTime.now().uptimeNanoseconds
                guard byTimeout else {
                    // Switching the tap off for a backoff makes macOS report a user-input disable
                    // right away. Re-arming on that report ended every backoff within milliseconds.
                    // The tap is already off, and switching it off again would trigger another report.
                    guard reenableBackoff.allowsReenable(at: now) else { return .backingOff(seconds: nil) }
                    if let tap = port { CGEvent.tapEnable(tap: tap, enable: true) }
                    return .reenable
                }
                let outcome = reenableBackoff.recordTimeout(at: now)
        /// Tap thread, before the main thread gets `decision`. Releases an event that already
        /// waited past `timeout` in the queue, so the main thread never starts a handler for an
        /// event the tap lets through. Handing the decision over afterwards ends the stall.
        func releaseIfLate(
            _ decision: Decision,
            requestedAt: UInt64,
            timeout: TimeInterval,
            now: UInt64 = DispatchTime.now().uptimeNanoseconds

```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
                let outcome = byTimeout
                    ? reenableBackoff.recordTimeout(at: DispatchTime.now().uptimeNanoseconds)
                    : .reenable
    /// main thread does not pick it up within `eventTapDecisionTimeout`.
        let requestedAt = DispatchTime.now().uptimeNanoseconds
        switch eventTapMainThreadGate.wait(
            for: decision,
            requestedAt: requestedAt,
            timeout: Self.eventTapDecisionTimeout,
            claimedTimeout: Self.eventTapClaimedDecisionTimeout
        ) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6ed91e6b` are properly handled with clean fallback behavior.
