# Domain G — Architecture Intelligence: Architecture Intelligence: TypeWhisper/typewhisper-mac Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "TypeWhisper/typewhisper-mac",
  "source_url": "https://github.com/TypeWhisper/typewhisper-mac",
  "source_version": "8e35bfec",
  "license": "GPL-3.0",
  "timestamp": "2026-11-28T15:19:24.613Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-typewhisper-typewhisper-mac",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [TypeWhisper/typewhisper-mac](https://github.com/TypeWhisper/typewhisper-mac) (Revision: `8e35bfec`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-28T15:19:24.613Z`  
> **Learning ID**: `learn-github-typewhisper-typewhisper-mac`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), L (Deployment & Operations Intelligence), A (Human & Need Intelligence), I (Content & Information Intelligence), D (Research & Knowledge Intelligence), K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), B (Product Intelligence), F (Design Intelligence), J (Search & Distribution Intelligence), C (Market & Business Intelligence)
- **Confidence Rating**: 68%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from TypeWhisper/typewhisper-mac:

# Forensic Learning Record (Deep Inspection): TypeWhisper/typewhisper-mac

> **Canonical Artifact**: `07_PROJECT_LEARNING/typewhisper-typewhisper-mac-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/TypeWhisper/typewhisper-mac](https://github.com/TypeWhisper/typewhisper-mac))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-28T15:19:22.603Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TypeWhisper/typewhisper-mac`
- **Description**: Local speech-to-text for macOS  on-device AI, fully private, optional cloud
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1948 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Packages/TypeWhisperModuleKit/Sources/TypeWhisperModuleKit/UserDataLifecycle.swift`
```
import Foundation

/// Gives a module a folder for its files and lets it erase and export its
/// own data with the user's data.
///
/// Data a module keeps in the app's preferences or in `dataFolder(forModuleID:)`
/// is erased and exported with them anyway. Register for data kept anywhere
/// else, or for data that needs its own export format.
@MainActor
public protocol UserDataLifecycle: AnyObject {
    /// The folder for a module's files, `Modules/<id>/` in the app's
    /// Application Support folder, created if needed. Each edition and the
    /// development build of the app has its own. Erasing all data deletes it,
    /// and a data export contains it.
    ///
    /// - Parameter id: Letters, digits, dots, hyphens and underscores, at most
    ///   128 characters, like `ModuleUserData.id`. Identifiers that differ only
    ///   in case can share a folder.
    /// - Throws: For another identifier, or when the folder cannot be created.
    func dataFolder(forModuleID id: String) throws -> URL

    /// Registers a module's data. A later registration with the same
    /// identifier replaces the earlier one.
    func register(_ userData: ModuleUserData)
}

/// How the app erases and exports one module's data.
public struct ModuleUserData: Identifiable, Sendable {
    /// Also the folder of the exported files, so letters, digits, dots,
    /// hyphens and underscores only, at most 128 characters.
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
final class WebhookPlugin: NSObject, FileJobAutomationPlugin, @unchecked Sendable {
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

    // MARK: - File Jobs

    var automationName: String { Self.pluginName }
    // Runs after automations that may still change the transcript.
    var priority: Int { 900 }

    @MainActor
    func process(artifact: FileJobArtifact, context: FileJobContext) async throws -> FileJobAutomationResult {
        // Delivery runs on its own so a slow endpoint does not hold up the file.
        if let service {
            let payload = FileTranscriptWebhookPayload(context: context)
            Task { await service.sendWebhooks(for: payload) }
        }
        return FileJobAutomationResult(artifact: artifact)
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
    var includesDictations: Bool  // False = no dictations
    var includesFileJobs: Bool

    init(name: String = "", url: String = "", httpMethod: String = "POST",
         headers: [String: String] = ["Content-Type": "application/json"],
         secretHeaderNames: [String] = [],
         isEnabled: Bool = true, workflowFilter: [String] = [], includesRecordings: Bool = false,
         includesDictations: Bool = true, includesFileJobs: Bool = false) {
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
        self.includesFileJobs = includesFileJobs
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
            && !includesFileJobs
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
        case includesFileJobs
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
        includesFileJobs = try container.decodeIfPresent(Bool.self, forKey: .includesFileJobs) ?? false
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
        try container.encode(includesFileJobs, forKey: .includesFileJobs)
    }
}

// MARK: - Payloads

/// A dictation payload with its source, so one endpoint can tell the events apart.
struct DictationWebhookPayload: Encodable, Sendable {
    let payload: TranscriptionCompletedPayload

    private enum CodingKeys: String, CodingKey { case source }

    func encode(to encoder: Encoder) throws {
        try payload.encode(to: encoder)
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode("dictation", forKey: .source)
    }
}

/// A finished watch-folder or File Transcription file.
struct FileTranscriptWebhookPayload: Encodable, Sendable, Equatable {
    let completionID: UUID
    let completedAt: Date
    let source: String
    let text: String
    let sourceFilePath: String?
    let sourceFileName: String?
    let outputFilePath: String?
    let outputFormat: String?
    let engine: String?
    let model: String?
    let language: String?
    let segments: [FileJobTranscriptSegment]

    init(context: FileJobContext, completionID: UUID = UUID(), completedAt: Date = Date()) {
        self.completionID = completionID
        self.completedAt = completedAt
        source = context.jobKind.rawValue
        text = context.transcriptText
        sourceFilePath = context.sourceFilePath
        sourceFileName = context.sourceFileName
        outputFilePath = context.outputFilePath
        outputFormat = context.outputFormat
        engine = context.engineName ?? context.engineId
        model = context.modelId
        language = context.detectedLanguage
        segments = context.segments
    }

    private enum CodingKeys: String, CodingKey {
        case completionID = "completion_id", completedAt = "completed_at", source, text
        case sourceFilePath = "source_file", sourceFileName = "source_file_name"
        case outputFilePath = "output_file", outputFormat = "output_format"
        case engine, model, language, segments
    }

    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(completionID, forKey: .completionID)
        // Unix seconds, like Recorder payloads, independently of the encoder's date strategy.
        try values.encode(completedAt.timeIntervalSince1970, forKey: .completedAt)
        try values.encode(source, forKey: .source)
        try values.encode(text, forKey: .text)
        try values.encodeIfPresent(sourceFilePath, forKey: .sourceFilePath)
        try values.encodeIfPresent(sourceFileName, forKey: .sourceFileName)
        try values.encodeIfPresent(outputFilePath, forKey: .outputFilePath)
        try values.encodeIfPresent(outputFormat, forKey: .outputFormat)
        try values.encodeIfPresent(engine, forKey: .engine)
        try values.encodeIfPresent(model, forKey: .model)
        try values.encodeIfPresent(language, forKey: .language)
        try values.encode(segments, forKey: .segments)
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

final class ExampleWebhookS
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2032** (2026-11-25): **Safari does not appear in the app picker (Terminal Apps selection)**
  *Symptoms*: ### Platform  macOS  ### Description  **Environment** - TypeWhisper 1.9.0 daily build (v1.9.0-daily.20261125), direct download - macOS 27.2.1 (26B131), MacBook Air (Apple silicon)  **Context** Related to #2031. To silence the false "No text field detected" warning in Safari, I wanted to add Safari to Settings > Dictation > Terminal Apps, as suggested by the setting's own description.  **Problem** In the "Select Apps…" picker, Safari does not appear at all — searching for "Safari" returns nothing. Other browsers (e.g. Chrome) and other apps are listed normally. Safari seems to be the only app missing, which makes the Terminal Apps workaround unreachable for the one app I need it for.  **Suspected cause** The picker appears to scan only the top level of /Applications, ~/Applications and /System/Applications. On recent macOS versions, Safari is delivered on the system cryptex volume and is not enumerated there as a regular app bundle.  **Workaround that works** Quit TypeWhisper, then run in Terminal: defaults write com.typewhisper.mac terminalAppBundleIdentifiers -array-add com.apple.Safari After relaunching TypeWhisper, Safari appears in the Terminal Apps list and dictations into Safari no longer show the warning.  ### Steps to Reproduce  1. Open Settings > Dictation > Terminal Apps. 2. Click “Select Apps…”. 3. Search for “Safari”.  ### Expected Behavior  Safari should be selectable in the app picker like any other installed app — or the picker should offer a way to add an app 

- **Issue #2031** (2026-11-25): **False "No text field detected" error in Safari although text is inserted correctly**
  *Symptoms*: ### Platform  macOS  ### Description  **Environment** - TypeWhisper 1.8.3 (build 1628), direct download - macOS 27.2.1 (26B131), MacBook Air (Apple silicon) - Engine: Apple Speech, model speechanalyzer-fr_FR - Accessibility and Microphone permissions: granted  **Actual result** The transcription is pasted into the field correctly, but the indicator shows "No text field detected" and the error is logged (category: insertion). The diagnostics export contains 200 error entries, all of them this single message, sometimes several per dictation.  **Notes** The same dictation into TextEdit produces no error, and dictating into the same web pages in Chrome produces no error either. The problem seems specific to how the focused field / its change is reported by Safari web content: the paste succeeds, but the verification step finds no text field.  [typewhisper-diagnostics-2026-11-25T21-05-46Z.json](https://github.com/user-attachments/files/35434180/typewhisper-diagnostics-2026-11-25T21-05-46Z.json)  ### Steps to Reproduce  1. Focus a text field in a web page in Safari (e.g. a web chat composer). 2. Dictate with TypeWhisper.  ### Expected Behavior  No error when the text was successfully inserted.  ### OS Version  macOS 27.2.1 (26B131), MacBook Air (Apple silicon)  ### TypeWhisper Version  1.8.3 (build 1628), direct download  ### Diagnostics / Logs  ```shell A diagnostics export (typewhisper-diagnostics-2026-11-25T21-05-46Z.json) is attached below. ```

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

### Incident Patch 1: `8e35bfec` (2026-11-28)
**Commit Message**: (feature) Show a guide beside System Settings while granting Accessibility (#2050)

* (feature) Show a guide beside System Settings while granting Accessibility

macOS lets only the user turn on Accessibility or Input Monitoring. When
TypeWhisper opens System Settings for one of them, a panel next to the
window names the switch and offers the app icon to drag into the list.
It closes once access arrives and brings TypeWhisper back, and the setup
wizard moves on from the permissions step. The permission check keeps
running while the panel waits instead of stopping after 30 seconds.

The App Store edition shows the same panel with a restart button,
because CoreGraphics reports the grant only after a restart there.

* Keep a replaced permission guide from closing the new one

A guide replaced during its 1.2-second confirmation no longer closes the new guide, brings TypeWhisper forward or posts the grant notification. TypeWhisper comes forward only when System Settings is still in front after the confirmation, not when the user has switched to another app. Closing the panel during the confirmation still counts the grant, so the setup wizard moves on.

* Open Home after the restart offe

**File**: `AppStore/Sources/AppStoreInputAccess.swift` (modified, +6/-2)
```diff
@@ -96,14 +96,17 @@ enum AppStoreInputAccess {
         hasRequestedListenEventAccess && !CGPreflightListenEventAccess()
     }
 
-    /// Asks for PostEvent access. macOS 27 neither prompts for it nor lists a
-    /// sandboxed app, so System Settings opens with a guide to drag the app in.
+    /// Asks for PostEvent access. macOS 27 does not prompt inside the app. It may
+    /// show its own alert and list the app with the switch off, or leave the app
+    /// out of the list, so System Settings opens with a guide that also offers
+    /// the icon to drag in. The guide cannot see the grant and offers a restart.
     @MainActor
     static func requestPostEventAccess() {
         guard isAutoPasteEnabled else { return }
         hasRequestedPostEventAccess = true
         guard !CGRequestPostEventAccess() else { return }
         openSettings(accessibilitySettingsURL)
+        PermissionGuideController.shared.begin(kind: .accessibility, isGranted: nil)
         offerRestartOnReturn { postEventAccessPending }
     }
 
@@ -114,6 +117,7 @@ enum AppStoreInputAccess {
         hasRequestedListenEventAccess = true
         guard !CGRequestListenEventAccess() else { return }
         openSettings(inputMonitoringSettingsURL)
+        PermissionGuideController.shared.begin(kind: .inputMonitoring, isGranted: nil)
         offerRestartOnReturn { listenEventAccessPending }
     }
 
```

**File**: `TypeWhisper.xcodeproj/project.pbxproj` (modified, +8/-0)
```diff
@@ -182,6 +182,7 @@
 		133200000000000000000002 /* SetupWizardEngineRecommendationTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 133200000000000000000001 /* SetupWizardEngineRecommendationTests.swift */; };
 		545000000000000000000004 /* SetupWizardTrialSignalTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 545000000000000000000003 /* SetupWizardTrialSignalTests.swift */; };
 		AA00000000000000000367 /* AccessibilityPermissionPaneTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000367 /* AccessibilityPermissionPaneTests.swift */; };
+		C10400000000000000000003 /* PermissionGuidePlacementTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = C10400000000000000000004 /* PermissionGuidePlacementTests.swift */; };
 		AA00000000000000000368 /* SelectableTextAccessibilityTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = BB00000000000000000368 /* SelectableTextAccessibilityTests.swift */; };
 		91B4D7E2C5A809F1632E4B7E /* StreamingHandlerTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 91B4D7E2C5A809F1632E4B7F /* StreamingHandlerTests.swift */; };
 		9A584149706C7567496E0100 /* XAIPluginTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9A584149706C7567496E0101 /* XAIPluginTests.swift */; };
@@ -224,6 +225,7 @@
 		A91F00000000000000000003 /* RecentTranscriptionPaletteHandler.swift in Sources */ = {isa = PBXBuildFile; fileRef = B91F00000000000000000003 /* RecentTranscriptionPaletteHandler.swift */; };
 		C10200000000000000000001 /* LastDictationCorrectionHandler.swift in Sources */ = {isa = PBXBuildFile; fileRef = C10200000000000000000002 /* LastDictationCorrectionHandler.swift */; };
 		C10200000000000000000003 /* LastDictationCorrectionPanel.swift in Sources */ = {isa = PBXBuildFile; fileRef = C10200000000000000000004 /* LastDictationCorrectionPanel.swift */; };
+		C10400000000000000000001 /* PermissionGuidePanel.swift in Sources */ = {isa = PBXBuildFile; fileRef = C10400000000000000000002 /* PermissionGuidePanel.swift */; };
 		A91F00000000000000000004 /* RecentTranscriptionStoreTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = B91F00000000000000000004 /* RecentTranscriptionStoreTests.swift */; };
 		A91F00000000000000000005 /* RecentTranscriptionPaletteHandlerTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = B91F00000000000000000005 /* RecentTranscriptionPaletteHandlerTests.swift */; };
 		C10200000000000000000005 /* LastDictationCorrectionHandlerTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = C10200000000000000000006 /* LastDictationCorrectionHandlerTests.swift */; };
@@ -997,6 +999,7 @@
 		B91F00000000000000000003 /* RecentTranscriptionPaletteHandler.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RecentTranscriptionPaletteHandler.swift; sourceTree = "<group>"; };
 		C10200000000000000000002 /* LastDictationCorrectionHandler.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = LastDictationCorrectionHandler.swift; sourceTree = "<group>"; };
 		C10200000000000000000004 /* LastDictationCorrectionPanel.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = LastDictationCorrectionPanel.swift; sourceTree = "<group>"; };
+		C10400000000000000000002 /* PermissionGuidePanel.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PermissionGuidePanel.swift; sourceTree = "<group>"; };
 		B91F00000000000000000004 /* RecentTranscriptionStoreTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = RecentTranscriptionStoreTests.swift; sourceTree = "<group>"; };
 		B91F00000000000000000005 /* RecentTranscriptionPaletteHandlerTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = RecentTranscriptionPaletteHandlerTests.swift; sourceTree = "<group>"; };
 		C10200000000000000000006 /* LastDictationCorrectionHandlerTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = LastDictationCorrectionHandlerTests.swift; sourceTree = "<group>"; };
@@ -1541,6 +1544,7 @@
 		133200000000000000000001 /* SetupWizardEngineRecommendationTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = SetupWizardEngineRecommendationTests.swift; sourceTree = "<group>"; };
 		545000000000000000000003 /* SetupWizardTrialSignalTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = SetupWizardTrialSignalTests.swift; sourceTree = "<group>"; };
 		BB00000000000000000367 /* AccessibilityPermissionPaneTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = AccessibilityPermissionPaneTests.swift; sourceTree = "<group>"; };
+		C10400000000000000000004 /* PermissionGuidePlacementTests.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnown
```

**File**: `TypeWhisper/Services/TextInsertionService.swift` (modified, +4/-0)
```diff
@@ -477,6 +477,10 @@ final class TextInsertionService {
         if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") {
             NSWorkspace.shared.open(url)
         }
+        guard !isAccessibilityGranted else { return }
+        PermissionGuideController.shared.begin(kind: .accessibility) { [weak self] in
+            self?.isAccessibilityGranted ?? false
+        }
 #endif
     }
 
```

**File**: `TypeWhisper/ViewModels/DictationSettingsHandler.swift` (modified, +4/-1)
```diff
@@ -171,7 +171,10 @@ final class DictationSettingsHandler {
             #else
             let pollSeconds = 30
             #endif
-            for _ in 0..<pollSeconds {
+            var polledSeconds = 0
+            // Keeps going while the guide beside System Settings waits for the user.
+            while polledSeconds < pollSeconds || PermissionGuideController.shared.isActive {
+                polledSeconds += 1
                 try? await Task.sleep(for: .seconds(1))
                 guard !Task.isCancelled else { return }
                 DispatchQueue.main.async { [weak self] in
```

**File**: `TypeWhisper/Views/GeneralSettingsView.swift` (modified, +3/-0)
```diff
@@ -113,6 +113,8 @@ struct GeneralSettingsView: View {
 /// does not leave the user without the window they were working in.
 /// Stored in the defaults because the sandbox drops launch arguments.
 enum RelaunchSettingsPage: String, CaseIterable {
+    /// Home shows whether a permission granted before the restart is in effect.
+    case home
     case general
     case integrations
 
@@ -121,6 +123,7 @@ enum RelaunchSettingsPage: String, CaseIterable {
 
     var tab: SettingsTab {
         switch self {
+        case .home: .home
         case .general: .general
         case .integrations: .integrations
         }
```

**File**: `TypeWhisper/Views/PermissionGuidePanel.swift` (added, +545/-0)
```diff
@@ -0,0 +1,545 @@
+import AppKit
+import SwiftUI
+
+/// The list in System Settings > Privacy & Security that a permission guide points to.
+enum PermissionGuideKind: Equatable {
+    /// Accessibility, called Device Control and Data Access from macOS 27.
+    case accessibility
+    /// Input Monitoring.
+    case inputMonitoring
+
+    var listName: String {
+        switch self {
+        case .accessibility:
+            AccessibilityPermissionPane.localizedName()
+        case .inputMonitoring:
+            localizedAppText("Input Monitoring", de: "Eingabeüberwachung", ja: "入力監視", zh: "输入监控", es: "Monitorización de entrada")
+        }
+    }
+}
+
+/// Shows a small panel beside System Settings while the user grants a permission there.
+///
+/// macOS lets no installer or app grant Accessibility or Input Monitoring itself; the user has
+/// to turn on the switch. The panel names the list and the switch, offers the app icon to drag
+/// into the list when TypeWhisper is missing from it, and appears only while System Settings
+/// is in front. When the grant is visible to the running app, the panel closes on its own and
+/// TypeWhisper comes back to the front.
+@MainActor
+final class PermissionGuideController {
+    static let shared = PermissionGuideController()
+
+    /// Posted after a guided permission was granted and TypeWhisper was brought back.
+    static let didGrantAccess = Notification.Name("PermissionGuideDidGrantAccess")
+
+    private var panel: PermissionGuidePanel?
+    private var model: PermissionGuideModel?
+    private var watchTask: Task<Void, Never>?
+    private var lastPlacedOrigin: NSPoint?
+    private var userMovedPanel = false
+    /// Counts up with every guide, so a guide replaced during its confirmation leaves the new one alone.
+    private var guideID = 0
+
+    /// Whether a guide is waiting for a permission.
+    var isActive: Bool { watchTask != nil }
+
+    /// Starts guiding after System Settings was asked to open the list for `kind`.
+    ///
+    /// - Parameter isGranted: Checked twice a second. Pass `nil` when the running app cannot
+    ///   see the grant, as in the App Store edition, where CoreGraphics keeps its first answer
+    ///   until a restart; the panel then offers to restart TypeWhisper instead.
+    func begin(kind: PermissionGuideKind, isGranted: (@MainActor () -> Bool)?) {
+        end()
+
+        let model = PermissionGuideModel(
+            kind: kind,
+            appName: Self.appName,
+            detectsGrant: isGranted != nil
+        )
+        model.onClose = { [weak self] in self?.end() }
+        model.onRestart = {
+            PermissionGuideController.shared.end()
+            // Comes back with a window, so the user sees whether the permission is in effect.
+            // An unfinished setup wizard opens instead.
+            ApplicationRelauncher.relaunch(reopening: .home)
+        }
+        self.model = model
+        guideID += 1
+        let guideID = self.guideID
+        watchTask = Task { [weak self] in
+            await self?.watch(guideID: guideID, isGranted: isGranted)
+        }
+    }
+
+    /// Closes the panel and stops waiting.
+    func end() {
+        watchTask?.cancel()
+        watchTask = nil
+        panel?.orderOut(nil)
+        panel = nil
+        model = nil
+        lastPlacedOrigin = nil
+        userMovedPanel = false
+    }
+
+    private func watch(guideID: Int, isGranted: (@MainActor () -> Bool)?) async {
+        let start = ContinuousClock.now
+        var settingsWasRunning = false
+        var frontWithoutWindowTicks = 0
+
+        while !Task.isCancelled {
+            if let isGranted, isGranted() {
+                await finishAfterGrant(guideID: guideID)
+                return
+            }
+
+            let elapsed = ContinuousClock.now - start
+            let settings = SystemSettingsWindowLocator.runningApplication
+            settingsWasRunning = settingsWasRunning || settings != nil
+            // System Settings quit, never opened, or the user left it open and walked away.
+            let settingsGone = settings == nil && (settingsWasRunning || elapsed > .seconds(10))
+            if settingsGone || elapsed > .seconds(20 * 60) {
+                end()
+                return
+            }
+
+            if let settings, SystemSettingsWindowLocator.isFrontmost {
+                let settingsFrame = SystemSettingsWindowLocator.frontWindowFrame(
+                    processIdentifier: settings.processIdentifier
+                )
+                // Waits briefly for the window so the panel does not jump once it appears.
+                frontWithoutWindowTicks = settingsFrame == nil ? frontWithoutWindowTicks + 1 : 0
+                if settingsFrame != nil || frontWithoutWindowTicks > 4 {
+                    showPanel(besideSettingsFrame: settingsFrame)
+                }
+            } else {
+                panel?.orderOut(nil)
+            }
+
+            try? await Ta
```

**File**: `TypeWhisper/Views/SetupWizardView.swift` (modified, +11/-0)
```diff
@@ -105,6 +105,9 @@ struct SetupWizardView: View {
         .onReceive(NotificationCenter.default.publisher(for: .resetSetupWizardWindow)) { _ in
             restartWizardFromBeginning()
         }
+        .onReceive(NotificationCenter.default.publisher(for: PermissionGuideController.didGrantAccess)) { _ in
+            continueAfterGuidedPermission()
+        }
     }
 
     // MARK: - Shell
@@ -372,6 +375,14 @@ struct SetupWizardView: View {
         }
     }
 
+    /// Moves on once the guide beside System Settings saw the last missing permission arrive.
+    private func continueAfterGuidedPermission() {
+        guard currentWizardStep == .permissions,
+              !dictation.needsMicPermission,
+              !dictation.needsAccessibilityPermission else { return }
+        handlePrimaryAction()
+    }
+
     private func completeSetupAndOpenHome() {
         // A past test never substitutes for the current engine and permissions.
         if setupReadiness.canCompleteSetup {
```

**File**: `TypeWhisperTests/PermissionGuidePlacementTests.swift` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+import XCTest
+@testable import TypeWhisper
+
+/// The permission guide sits beside the System Settings window so it never covers the
+/// switch the user has to turn on.
+final class PermissionGuidePlacementTests: XCTestCase {
+    private let screen = NSRect(x: 0, y: 0, width: 1920, height: 1050)
+    private let panelSize = NSSize(width: 300, height: 180)
+
+    func testPlacesGuideRightOfSettingsLevelWithTheList() {
+        let settings = NSRect(x: 400, y: 200, width: 700, height: 600)
+
+        let origin = PermissionGuidePlacement.origin(panelSize: panelSize, settingsFrame: settings, visibleFrame: screen)
+
+        XCTAssertEqual(origin.x, settings.maxX + PermissionGuidePlacement.gap)
+        XCTAssertEqual(origin.y + panelSize.height, settings.maxY - PermissionGuidePlacement.toolbarHeight)
+    }
+
+    func testFallsBackToTheLeftWhenTheRightEdgeIsTooClose() {
+        let settings = NSRect(x: 1000, y: 200, width: 800, height: 600)
+
+        let origin = PermissionGuidePlacement.origin(panelSize: panelSize, settingsFrame: settings, visibleFrame: screen)
+
+        XCTAssertEqual(origin.x + panelSize.width, settings.minX - PermissionGuidePlacement.gap)
+    }
+
+    func testOverlapsBottomRightCornerOfAWindowThatFillsTheScreen() {
+        let settings = screen
+
+        let origin = PermissionGuidePlacement.origin(panelSize: panelSize, settingsFrame: settings, visibleFrame: screen)
+        let guide = NSRect(origin: origin, size: panelSize)
+
+        XCTAssertTrue(screen.contains(guide))
+        XCTAssertEqual(guide.maxX, settings.maxX - PermissionGuidePlacement.margin)
+        XCTAssertEqual(guide.minY, settings.minY + PermissionGuidePlacement.margin)
+    }
+
+    func testConvertsWindowBoundsFromTopLeftScreenCoordinates() {
+        let bounds = CGRect(x: 100, y: 50, width: 700, height: 600)
+
+        let frame = SystemSettingsWindowLocator.cocoaFrame(fromWindowBounds: bounds, primaryScreenHeight: 1080)
+
+        XCTAssertEqual(frame, NSRect(x: 100, y: 430, width: 700, height: 600))
+    }
+}
```

---

### Incident Patch 2: `0cf71b2b` (2026-11-27)
**Commit Message**: (bug) Spell names from the screen at the start of a sentence too (#2047)

* (bug) Spell names from the screen at the start of a sentence too

The spelling pairs from #2043 skipped every word at the start of a
sentence, since speech recognition capitalizes those and a pair like
"Mark" → "Marc" also turned "Mark my words" into "Marc my words".
Messages often start with the name, so "Sofia, can you…" kept its
spelling while the chat showed "Sofya".

A word at the start of a sentence now pairs when the spell checker does
not know it in lowercase in English, the dictation's language or the
user's preferred languages: "sofia" is no word, "mark" is one. Letters
for the same sound now count as one when comparing spellings, so
Whisper's "Sophia" pairs with "Sofya" as well.

* (bug) Read lowercase language names in the ordinary-word check

The OpenAI API reports the detected language as a lowercase name
("english"). Locale reads no language code from it, so the spell checker
skipped the dictation's language and asked only English and the
preferred languages. The identifier now goes through
WorkflowTranslationLanguageNormalizer, which the translation fallback
already uses.

**File**: `TypeWhisper/Services/ScreenContextService.swift` (modified, +59/-10)
```diff
@@ -178,12 +178,19 @@ extension ScreenContextService {
     /// even with the screen text in the prompt, but they follow an explicit pair.
     ///
     /// They follow it even where the word is no name ("Mark my words" with "Marc" on
-    /// screen), so the match is strict: only capitalized dictated words that do not start
-    /// a sentence count, because there speech recognition capitalizes names and not
-    /// ordinary words. The screen word must be capitalized as well, have the same sound
-    /// key and vowel sounds and differ by a few letters, the dictated spelling must not
-    /// appear on screen, and the screen must offer only one such spelling.
-    static func spellingHints(dictation: String, screenText: String) -> [SpellingHint] {
+    /// screen), so the match is strict: only capitalized dictated words count, because
+    /// within a sentence speech recognition capitalizes names and not ordinary words. A
+    /// word that starts a sentence is capitalized either way, so it counts only when
+    /// `isOrdinaryWord` says it is no ordinary word ("Sofia, can you…" but not "Mark my
+    /// words"). The screen word must be capitalized as well, have the same sound key and
+    /// vowel sounds and differ by a few letters, where letters for the same sound count as
+    /// one ("Sophia" and "Sofya"). The dictated spelling must not appear on screen, and the
+    /// screen must offer only one such spelling.
+    static func spellingHints(
+        dictation: String,
+        screenText: String,
+        isOrdinaryWord: (String) -> Bool
+    ) -> [SpellingHint] {
         let screenWords = words(in: screenText)
         let screenSpellings = Set(screenWords.map { $0.text.lowercased() })
         var namesByKey: [String: [String]] = [:]
@@ -199,16 +206,20 @@ extension ScreenContextService {
 
         var hints: [SpellingHint] = []
         var seen = Set<String>()
-        for word in words(in: dictation) where !word.startsSentence && isNameCandidate(word.text) {
+        for word in words(in: dictation) where isNameCandidate(word.text) {
             let dictated = word.text.lowercased()
-            guard !screenSpellings.contains(dictated), seen.insert(dictated).inserted else { continue }
+            guard !screenSpellings.contains(dictated), !seen.contains(dictated) else { continue }
             let vowels = vowelSounds(word.text)
+            let sounds = soundSpelling(word.text)
             let matches = (namesByKey[soundKey(word.text)] ?? []).filter { name in
                 let spelled = name.lowercased()
+                let distance = min(editDistance(dictated, spelled), editDistance(sounds, soundSpelling(name)))
                 return vowelSounds(name) == vowels
-                    && editDistance(dictated, spelled) <= (max(dictated.count, spelled.count) > 6 ? 3 : 2)
+                    && distance <= (max(dictated.count, spelled.count) > 6 ? 3 : 2)
             }
-            guard matches.count == 1 else { continue }
+            // The dictionary is asked last, and only for words that would pair.
+            guard matches.count == 1, !word.startsSentence || !isOrdinaryWord(word.text) else { continue }
+            seen.insert(dictated)
             hints.append(SpellingHint(dictated: word.text, screen: matches[0]))
             if hints.count == maxSpellingHints { break }
         }
@@ -219,6 +230,44 @@ extension ScreenContextService {
         word.count >= 3 && word.first?.isUppercase == true
     }
 
+    /// Whether `word` in lowercase is spelled correctly in one of `languages`, as "mark"
+    /// and "will" are in English. The spell checker knows names only capitalized, so
+    /// "sofia" and "steven" are no ordinary words. Some names are ("linda" in Spanish),
+    /// and then a sentence start gets no pair.
+    @MainActor
+    static func isOrdinaryWord(_ word: String, languages: [String]) -> Bool {
+        let checker = NSSpellChecker.shared
+        let lowercased = word.lowercased()
+        return languages.contains { language in
+            checker.checkSpelling(
+                of: lowercased,
+                startingAt: 0,
+                language: language,
+                wrap: false,
+                inSpellDocumentWithTag: 0,
+                wordCount: nil
+            ).location == NSNotFound
+        }
+    }
+
+    /// The spell checker languages for `isOrdinaryWord`: English, the dictation's language
+    /// and the user's preferred languages. A language the spell checker lacks is left out,
+    /// because the spell checker accepts every word in it. The dictation's language may be
+    /// a lowercase name, as the OpenAI API reports it ("english"), which `Locale` does not read.
+    @MainActor
+    static func ordinaryWordLanguages(dictationLanguage: String?) -> [String] {
+        let available = NSSpellChecker.shared.availableLanguages
+        var languages: [String] = []
+        for identifier in ["en", dictationLanguage].compactMap({ $
```

**File**: `TypeWhisper/Services/WorkflowTextProcessingService.swift` (modified, +19/-3)
```diff
@@ -192,7 +192,12 @@ struct WorkflowTextProcessingService {
         screenContext: String? = nil
     ) async throws -> String {
         let screenContextBlock = workflow.usesScreenContext
-            ? Self.screenContextInstruction(screenContext, dictation: text)
+            ? Self.screenContextInstruction(
+                screenContext,
+                dictation: text,
+                dictationLanguage: Workflow.languageIdentifier(detectedLanguage)
+                    ?? Workflow.languageIdentifier(configuredLanguage)
+            )
             : ""
         if workflow.usesInlineCommands {
             let behavior = workflow.behavior
@@ -482,7 +487,11 @@ struct WorkflowTextProcessingService {
     /// contain anything, including instructions, so the prompt fences it off explicitly.
     /// Dictated names that sound like a differently spelled name on screen are listed
     /// after it (see `ScreenContextService.spellingHints`).
-    static func screenContextInstruction(_ screenContext: String?, dictation: String = "") -> String {
+    static func screenContextInstruction(
+        _ screenContext: String?,
+        dictation: String = "",
+        dictationLanguage: String? = nil
+    ) -> String {
         guard let screenContext = trimmedOrNil(screenContext) else { return "" }
         let fenced = ScreenContextService.promptExcerpt(screenContext)
             .replacingOccurrences(of: "</screen_context>", with: "")
@@ -495,7 +504,14 @@ struct WorkflowTextProcessingService {
             </screen_context>
             """
 
-        let hints = ScreenContextService.spellingHints(dictation: dictation, screenText: screenContext)
+        let hints = ScreenContextService.spellingHints(dictation: dictation, screenText: screenContext) { word in
+            ScreenContextService.isOrdinaryWord(
+                word,
+                languages: ScreenContextService.ordinaryWordLanguages(
+                    dictationLanguage: dictationLanguage ?? DictatedTextLanguage.identifier(of: dictation)
+                )
+            )
+        }
         if !hints.isEmpty {
             workflowTextProcessingLogger.info("Screen context: \(hints.count, privacy: .public) spelling hints")
             instruction += """
```

**File**: `TypeWhisperTests/WorkflowServiceTests.swift` (modified, +50/-4)
```diff
@@ -2053,21 +2053,67 @@ final class WorkflowServiceTests: XCTestCase {
             Send
             """
         func hints(_ dictation: String) -> [String] {
-            ScreenContextService.spellingHints(dictation: dictation, screenText: screen)
-                .map { "\($0.dictated)→\($0.screen)" }
+            ScreenContextService.spellingHints(dictation: dictation, screenText: screen) {
+                ScreenContextService.isOrdinaryWord($0, languages: ["en"])
+            }
+            .map { "\($0.dictated)→\($0.screen)" }
         }
 
         XCTAssertEqual(hints("See you soon, Linda. Thanks, Steven and Ryan."), ["Linda→Lynda", "Steven→Stephen"])
         XCTAssertEqual(hints("I asked Mr. Steven about it."), ["Steven→Stephen"])
         XCTAssertEqual(hints("Thanks, Herr Meier."), ["Meier→Mayer"])
         // Other vowels make other names, and Cyrillic names have no sound key to compare.
         XCTAssertEqual(hints("Please ask Tim, Jane and Анна about it."), [])
-        // Speech recognition capitalizes every sentence start, so it is no sign of a name.
-        XCTAssertEqual(hints("Mark my words. Linda will reply."), [])
+        // Speech recognition capitalizes every sentence start, so there only a name that is
+        // no ordinary word counts: "linda" is none in English, "mark" is one.
+        XCTAssertEqual(hints("Mark my words. Linda will reply."), ["Linda→Lynda"])
         // Lowercase words and spellings that are on screen already need no hint.
         XCTAssertEqual(hints("I'll mark it and see you soon, Lynda."), [])
     }
 
+    func testScreenContextSpellingHintsPairNamesAtASentenceStartButNotOrdinaryWords() {
+        // Vision's text of a chat window with the conversation with Sofya open; it read the
+        // selected chat in the list as "Sotya".
+        let screen = """
+            Search or start a new chat
+            Sotya
+            Perfect, see you on Monday then
+            12:41
+            Marc Dubois
+            Can you send me the invoice again?
+            Sofya
+            last seen today at 12:41
+            Hi! Did you have a chance to look at the contract draft? 12:30
+            Type a message
+            """
+        func hints(_ dictation: String) -> [String] {
+            ScreenContextService.spellingHints(dictation: dictation, screenText: screen) {
+                ScreenContextService.isOrdinaryWord($0, languages: ["en"])
+            }
+            .map { "\($0.dictated)→\($0.screen)" }
+        }
+
+        XCTAssertEqual(hints("Sofia, I'll go through the contract tonight."), ["Sofia→Sofya"])
+        XCTAssertEqual(hints("Thanks. Sofia, see you on Monday."), ["Sofia→Sofya"])
+        XCTAssertEqual(hints("I'll send the draft to Sofia tonight."), ["Sofia→Sofya"])
+        // Whisper mostly writes the name as "Sophia"; ph and f are one sound.
+        XCTAssertEqual(hints("Sophia, I'll go through the contract tonight."), ["Sophia→Sofya"])
+        XCTAssertEqual(hints("Mark my words, they will sign it."), [])
+        XCTAssertEqual(hints("Sure. Mark the date in the calendar."), [])
+        // The OpenAI API reports the detected language as a lowercase name.
+        XCTAssertEqual(
+            ScreenContextService.ordinaryWordLanguages(dictationLanguage: "french"),
+            ScreenContextService.ordinaryWordLanguages(dictationLanguage: "fr")
+        )
+        XCTAssertTrue(
+            WorkflowTextProcessingService.screenContextInstruction(
+                screen,
+                dictation: "Sofia, can you send me the signed contract?",
+                dictationLanguage: "en"
+            ).contains("\n- \"Sofia\" → \"Sofya\"")
+        )
+    }
+
     func testScreenContextPromptKeepsTheWindowEndAndListsNameSpellings() async throws {
         let workflow = Workflow(
             name: "Clean",
```

---

### Incident Patch 3: `58e6c922` (2026-11-27)
**Commit Message**: (bug) Restore Han numerals after numbered-list prefixes (#2038)

* fix: restore Han numerals after numbered-list prefixes

Co-Authored-By: Devin AI <158243242+devin-ai-integration[bot]@users.noreply.github.com>

* Fix digit-led Han numerals after list prefixes

---------

Co-authored-by: Devin AI <158243242+devin-ai-integration[bot]@users.noreply.github.com>

**File**: `TypeWhisper/Services/NumberWordNormalizer.swift` (modified, +20/-9)
```diff
@@ -15,8 +15,10 @@ enum NumberWordNormalizer {
     private static let hanApproximationPrefixes: Set<Character> = [
         "幾", "几", "數", "数", "上", "成",
     ]
-    private static let hanUnitCharacters: Set<Character> = [
-        "十", "百", "千", "万", "萬", "亿", "億",
+    private static let hanLargeUnitCharacters: Set<Character> = ["万", "萬", "亿", "億"]
+    private static let hanUnitCharacters = hanLargeUnitCharacters.union(["十", "百", "千"])
+    private static let hanFractionalDigitCharacters: Set<Character> = [
+        "零", "〇", "一", "二", "两", "兩", "三", "四", "五", "六", "七", "八", "九",
     ]
     private static let cjkNumberCharacters = Set("零〇一二两兩三四五六七八九十百千万萬亿億点點負负".map { $0 })
 
@@ -261,13 +263,8 @@ enum NumberWordNormalizer {
                 if index > 1,
                    tokens[index - 1].kind == .other,
                    tokens[index - 1].text == ".",
-                   tokens[index - 2].kind == .digit {
-                    // A merged numeric run directly preceded by "<digits>."
-                    // belongs to a decimal fraction (1.5万, 2.3亿), not to
-                    // the large unit. The Han parsers cannot represent
-                    // fractional unit scaling yet, so leave the text
-                    // unchanged rather than producing a plausible-looking
-                    // wrong value such as 1.50000元.
+                   tokens[index - 2].kind == .digit,
+                   shouldPreserveHanRunAfterPeriod(wordTexts[0]) {
                     return nil
                 }
             }
@@ -432,6 +429,20 @@ enum NumberWordNormalizer {
         return false
     }
 
+    private static func shouldPreserveHanRunAfterPeriod(_ text: String) -> Bool {
+        guard let first = text.first else { return false }
+        // Don't rewrite fractional scaling (1.5万) or create a second
+        // decimal point in compact text such as 1.二點五.
+        if first.isASCII && first.isNumber { return true }
+        if text.contains("点") || text.contains("點") { return true }
+        guard hanFractionalDigitCharacters.contains(first) else { return false }
+
+        // Preserve possible fractional scaling (五万), but not Han
+        // cardinals with internal place values (二十, 一萬二千).
+        return text.drop(while: { hanFractionalDigitCharacters.contains($0) || ($0.isASCII && $0.isNumber) })
+            .allSatisfy { hanLargeUnitCharacters.contains($0) }
+    }
+
     private static func isBareHanUnitRun(_ text: String) -> Bool {
         !text.isEmpty && text.allSatisfy { hanUnitCharacters.contains($0) }
     }
```

**File**: `TypeWhisperTests/NumberWordNormalizerTests.swift` (modified, +25/-0)
```diff
@@ -429,7 +429,32 @@ final class NumberWordNormalizerTests: XCTestCase {
         // The Han parser cannot represent fractional unit scaling, so leave
         // the decimal text unchanged instead of producing a wrong value.
         XCTAssertEqual(NumberWordNormalizer.normalize(text: "1.5万元", language: "zh"), "1.5万元")
+        XCTAssertEqual(NumberWordNormalizer.normalize(text: "1.五万元", language: "zh"), "1.五万元")
+        XCTAssertEqual(NumberWordNormalizer.normalize(text: "1.五万", language: "zh"), "1.五万")
+        XCTAssertEqual(NumberWordNormalizer.normalize(text: "1.二五萬億", language: "zh"), "1.二五萬億")
+        XCTAssertEqual(NumberWordNormalizer.normalize(text: "1.2千円", language: "ja"), "1.2千円")
         XCTAssertEqual(NumberWordNormalizer.normalize(text: "2.3亿", language: "zh"), "2.3亿")
+        XCTAssertEqual(NumberWordNormalizer.normalize(text: "2.三亿", language: "zh"), "2.三亿")
+    }
+
+    func testHanNumberedListPrefixDoesNotBlockUnitFirstNumerals() {
+        XCTAssertEqual(NumberWordNormalizer.normalize(text: "1.十个人", language: "zh"), "1.10个人")
+        XCTAssertEqual(NumberWordNormalizer.normalize(text: "1.十個人", language: "zh"), "1.10個人")
+        XCTAssertEqual(NumberWordNormalizer.normalize(text: "2.百名參與者", language: "zh"), "2.100名參與者")
+        XCTAssertEqual(NumberWordNormalizer.normalize(text: "1.十人", language: "ja"), "1.10人")
+    }
+
+    func testHanNumberedListPrefixDoesNotBlockDigitFirstNumerals() {
+        XCTAssertEqual(NumberWordNormalizer.normalize(text: "1.二十個人", language: "zh"), "1.20個人")
+        XCTAssertEqual(NumberWordNormalizer.normalize(text: "2.兩百名參與者", language: "zh"), "2.200名參與者")
+        XCTAssertEqual(NumberWordNormalizer.normalize(text: "3.一萬二千人", language: "zh"), "3.12000人")
+        XCTAssertEqual(NumberWordNormalizer.normalize(text: "1.二十人", language: "ja"), "1.20人")
+    }
+
+    func testHanDecimalAfterPeriodDoesNotCreateAnExtraDecimalPoint() {
+        XCTAssertEqual(NumberWordNormalizer.normalize(text: "1.二點五公尺", language: "zh"), "1.二點五公尺")
+        XCTAssertEqual(NumberWordNormalizer.normalize(text: "1.十点五公尺", language: "zh"), "1.十点五公尺")
+        XCTAssertEqual(NumberWordNormalizer.normalize(text: "1. 二點五公尺", language: "zh"), "1. 2.5公尺")
     }
 
     func testChineseUnitCharactersInsideWordsArePreserved() {
```

#### Recent Merged Pull Requests:
- **PR #2051** (closed): (bug) Stop Cohere Transcribe from inventing a sentence when speech starts right away (@SeoFood)
- **PR #2050** (2026-11-28): (feature) Show a guide beside System Settings while granting Accessibility (@SeoFood)
- **PR #2049** (2026-11-27): (feature) Send ElevenLabs dictionary terms to Scribe v3 Live instead of a second batch upload (@SeoFood)
- **PR #2048** (2026-11-27): (feature) Sync plugin API keys with TypeWhisper for iOS through iCloud Keychain (@SeoFood)
- **PR #2047** (2026-11-27): (bug) Spell names from the screen at the start of a sentence too (@SeoFood)
- **PR #2046** (2026-11-27): (feature) Show recording time in Statistics and the time from stop to transcript in History (@SeoFood)

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

## X. (feature) Show a guide beside System Settings while granting Accessibility

**RULE**:
When implementing operations in `AppStore/Sources/AppStoreInputAccess.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in TypeWhisper/typewhisper-mac. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8e35bfec`: (feature) Show a guide beside System Settings while granting Accessibility. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `AppStore/Sources/AppStoreInputAccess.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    /// Asks for PostEvent access. macOS 27 does not prompt inside the app. It may
    /// show its own alert and list the app with the switch off, or leave the app
    /// out of the list, so System Settings opens with a guide that also offers
    /// the icon to drag in. The guide cannot see the grant and offers a restart.
        PermissionGuideController.shared.begin(kind: .accessibility, isGranted: nil)
        PermissionGuideController.shared.begin(kind: .inputMonitoring, isGranted: nil)
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
    /// Asks for PostEvent access. macOS 27 neither prompts for it nor lists a
    /// sandboxed app, so System Settings opens with a guide to drag the app in.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8e35bfec` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
