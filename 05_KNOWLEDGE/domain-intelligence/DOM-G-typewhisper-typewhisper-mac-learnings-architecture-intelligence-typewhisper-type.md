# Domain G — Architecture Intelligence: Architecture Intelligence: typewhisper-typewhisper-mac-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "typewhisper-typewhisper-mac-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T00:44:01.377Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-typewhisper-typewhisper-mac-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [typewhisper-typewhisper-mac-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T00:44:01.377Z`  
> **Learning ID**: `LEARN-EVO-typewhisper-typewhisper-mac-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), L (Deployment & Operations Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), D (Research & Knowledge Intelligence), K (Quality & Verification Intelligence), C (Market & Business Intelligence), I (Content & Information Intelligence), J (Search & Distribution Intelligence), B (Product Intelligence), E (Creative Intelligence)
- **Confidence Rating**: 74%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from typewhisper-typewhisper-mac-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/typewhisper-typewhisper-mac-learnings.md`  
> **Source**: github ([https://github.com/TypeWhisper/typewhisper-mac](https://github.com/TypeWhisper/typewhisper-mac))  
> **Source Version**: `5162fe87`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-21T00:43:47.702Z  
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
> **Harvest Timestamp**: 2026-11-21T00:43:47.695Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TypeWhisper/typewhisper-mac`
- **Description**: Local speech-to-text for macOS  on-device AI, fully private, optional cloud
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1938 stars

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
- **Issue #1966** (2026-11-19): **Speaker diarization detects only one speaker in two-person conversations**
  *Symptoms*: ### Platform  macOS  ### Description  TypeWhisper for macOS detects only one speaker in every two-person recording I’ve tried. Both voices are clearly audible, and both people actively take turns speaking throughout the conversation. The transcript still shows a single speaker label.  ### Steps to Reproduce  1. Open TypeWhisper on macOS. 2. Import an audio recording of a conversation in which two clearly audible speakers take turns throughout. 3. Transcribe the recording with speaker detection enabled. 4. Check the speaker labels in the transcript. Only one speaker is shown. 5. Repeat with another two-person recording. The same issue occurs.  ### Expected Behavior  TypeWhisper should detect both speakers and assign each spoken segment to the correct speaker, using two distinct labels throughout the transcript.  ### OS Version  _No response_  ### TypeWhisper Version  1.8.3  ### Diagnostics / Logs  ```shell  ```

- **Issue #1898** (2026-11-11): **Diarization seems to be enabled while using Dictation which causes extra usage**
  *Symptoms*: ### Platform  macOS  ### Description  When using Reson8 with the option speaker diarization ON in the plugin diarization is also used when dictating which seems unnecessary since it's causes extra usage and cost. (visible on the usage page of reson8).   I didn't check to see if it's a general behavior or reson8 specific.    ### Steps to Reproduce  Enable speaker diarization in the Reson8 plugin and start dictating (using Rumble).  ### Expected Behavior  Not using diarization while dictating only when transcribing a recording (with multiple speakers)  ### OS Version  _No response_  ### TypeWhisper Version  v1.8.2-daily.20261110  ### Diagnostics / Logs  ```shell  ```

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

### Incident Patch 1: `9e9d0620` (2026-11-18)
**Commit Message**: (bug) Let an API dictation start replace a feedback banner (#1961)

* Let an API dictation start replace a feedback banner

POST /v1/dictation/start returned 409 while a feedback banner such as
"No speech recognized" was visible, so the Stream Deck could not start
the next dictation until the banner expired. The API now ends a
dismissible banner and starts the recording, as the dictation hotkey
does. Processing, a running Insert and a running standalone workflow
still block the start.

Fixes #1959

* Keep a queued hotkey start ahead of an API start

An API start no longer replaces a feedback banner while a hotkey start
is queued, so the queued start and its workflow are not dropped. The
new tests wait for the second dictation to finish before teardown and
check that the original recovery recording is kept.

* Block every API start while a hotkey start is queued

The queued start also wins once the reset has set the state to idle and
while the Insert offer is shown. The banner tests now fail when the
second dictation does not finish before teardown.

* Test the queued hotkey start against a real no-speech banner

The test now queues a hotkey start during processing and checks that
t

**File**: `TypeWhisper/ViewModels/DictationViewModel.swift` (modified, +11/-2)
```diff
@@ -1217,7 +1217,11 @@ final class DictationViewModel: ObservableObject {
     }
 
     var canStartAPIRecording: Bool {
-        HistoryRetranscriptionActivity.recordID == nil && (state == .idle || canReplaceUndeliveredTranscriptOffer)
+        // A queued hotkey start runs first, even after the reset has already set the state to
+        // idle, so an API start cannot drop it and its workflow.
+        HistoryRetranscriptionActivity.recordID == nil
+            && pendingHotkeyDictationStart == nil
+            && (state == .idle || canReplaceUndeliveredTranscriptOffer || canDismissActionFeedback)
     }
 
     /// The Insert offer stays up for a while, so a new dictation replaces it, as the dictation
@@ -1256,8 +1260,13 @@ final class DictationViewModel: ObservableObject {
     }
 
     func apiStartRecording(forcedWorkflowId: UUID? = nil) -> UUID {
-        if canReplaceUndeliveredTranscriptOffer {
+        // A new API dictation replaces a passive feedback banner, such as "No speech
+        // recognized", as the dictation hotkey does (#1959).
+        if canReplaceUndeliveredTranscriptOffer || canDismissActionFeedback {
             indicatorFeedbackLifetime.finishImmediately()
+            if state == .inserting {
+                resetDictationState()
+            }
         }
         let sessionID = UUID()
         startRecording(
```

**File**: `TypeWhisperTests/TypeWhisperIntegrationTests.swift` (modified, +249/-0)
```diff
@@ -5092,6 +5092,102 @@ final class TypeWhisperIntegrationTests: XCTestCase {
         XCTAssertEqual(inserting.status, 409)
     }
 
+    /// The Stream Deck toggles dictation through the API. A "No speech recognized" banner must
+    /// not block the next start, as it does not block the dictation hotkey (#1959).
+    func testDictationStartReplacesNoSpeechFeedbackBanner() async throws {
+        let appSupportDirectory = try TestSupport.makeTemporaryDirectory()
+        var context: APIContext?
+        defer {
+            context = nil
+            MockTranscriptionPlugin.reset()
+            TestSupport.remove(appSupportDirectory)
+        }
+
+        MockTranscriptionPlugin.reset()
+        MockTranscriptionPlugin.setResponseText("")
+        context = await MainActor.run {
+            let context = Self.makeAPIContext(appSupportDirectory: appSupportDirectory, withMockTranscriptionPlugin: true)
+            context.dictationViewModel.soundFeedbackEnabled = false
+            context.dictationViewModel.spokenFeedbackEnabled = false
+            context.audioRecordingService.hasMicrophonePermissionOverride = true
+            context.audioRecordingService.inputAvailabilityOverride = { _ in true }
+            context.audioRecordingService.startRecordingOverride = {}
+            context.audioRecordingService.stopRecordingOverride = { _ in
+                Array(repeating: 0.25, count: Int(AudioRecordingService.targetSampleRate))
+            }
+            context.textInsertionService.captureActiveAppOverride = { ("Notes", "com.apple.Notes", nil) }
+            context.textInsertionService.selectedTextOverride = { nil }
+            return context
+        }
+        let apiContext = try XCTUnwrap(context)
+        let router = apiContext.router
+
+        let firstStart = await router.route(HTTPRequest(
+            method: "POST", path: "/v1/dictation/start", queryParams: [:], headers: [:], body: Data()
+        ))
+        XCTAssertEqual(firstStart.status, 200)
+        await apiContext.dictationViewModel.testingWaitForRecordingStart()
+        let stop = await router.route(HTTPRequest(
+            method: "POST", path: "/v1/dictation/stop", queryParams: [:], headers: [:], body: Data()
+        ))
+        XCTAssertEqual(stop.status, 200)
+
+        let noSpeechMessage = try TestSupport.localizedCatalogValueForCurrentLocale(for: "No speech recognized")
+        for _ in 0..<80 {
+            let feedback = await MainActor.run { apiContext.dictationViewModel.actionFeedbackMessage }
+            if feedback?.hasPrefix(noSpeechMessage) == true {
+                break
+            }
+            try? await Task.sleep(for: .milliseconds(25))
+        }
+        let bannerState = await MainActor.run {
+            (
+                state: apiContext.dictationViewModel.state,
+                feedback: apiContext.dictationViewModel.actionFeedbackMessage
+            )
+        }
+        XCTAssertEqual(bannerState.state, .inserting)
+        XCTAssertTrue(bannerState.feedback?.hasPrefix(noSpeechMessage) == true)
+
+        let secondStart = await router.route(HTTPRequest(
+            method: "POST", path: "/v1/dictation/start", queryParams: [:], headers: [:], body: Data()
+        ))
+        let secondJSON = try Self.jsonObject(secondStart)
+        XCTAssertEqual(secondStart.status, 200)
+        XCTAssertEqual(secondJSON["status"] as? String, "recording")
+        await apiContext.dictationViewModel.testingWaitForRecordingStart()
+        // The banner's lifetime ended with the start, so it cannot reset the new recording later.
+        try? await Task.sleep(for: .milliseconds(100))
+        let recordingState = await MainActor.run {
+            (
+                state: apiContext.dictationViewModel.state,
+                feedback: apiContext.dictationViewModel.actionFeedbackMessage
+            )
+        }
+        XCTAssertEqual(recordingState.state, .recording)
+        XCTAssertNil(recordingState.feedback)
+
+        // Let the second dictation finish before the mock transcription is reset.
+        let secondID = try XCTUnwrap((secondJSON["id"] as? String).flatMap(UUID.init(uuidString:)))
+        await MainActor.run {
+            _ = apiContext.dictationViewModel.apiStopRecording()
+        }
+        var secondStatus: DictationSessionSnapshot.Status?
+        for _ in 0..<80 {
+            secondStatus = await MainActor.run { apiContext.dictationViewModel.apiDictationSession(id: secondID)?.status }
+            if secondStatus == .failed || secondStatus == .completed {
+                break
+            }
+            try? await Task.sleep(for: .milliseconds(25))
+        }
+        secondStatus = await MainActor.run { apiContext.dictationViewModel.apiDictationSession(id: secondID)?.status }
+        XCTAssertTrue(
+            secondStatus == .failed || secondStatus == .completed,
+            "Second dictation status: \(String(describing: secondStatus))"
+        )
+        await ap
```

---

### Incident Patch 2: `d6cdb09f` (2026-11-19)
**Commit Message**: (bug) Judge the spoken language from the first speech, not the first loud sound (#1972)

* (bug) Judge the spoken language from the first speech, not the first loud sound

Language Detection started its 30 s window at the first frame within 35 dB of the loudest one, so
a recording that opens with ringing, clicks or room noise was judged on that noise. The model hears
English in non-speech with a margin near 1, and the host accepted any margin for a selection of
several languages, so the engine got English for a Dutch file.

The plugin now finds the first second that holds speech with the system's sound classifier
(SoundAnalysis) and starts the window there; without speech it returns nil. The host needs a
margin of 0.25 for a multi-language selection and otherwise uses the first selected language, and
the language picker says so. Language Detection 1.0.2.

Closes #1970

* Keep the language window on quiet speech when louder sounds come elsewhere

The window refinement took its 35 dB threshold from the loudest frame of the whole recording, so
quiet speech in the second the classifier found could be skipped for a louder click later on. With
a detected speech second, the loudest and th

**File**: `TypeWhisper/Resources/Localizable.xcstrings` (modified, +5/-5)
```diff
@@ -51926,30 +51926,30 @@
         }
       }
     },
-    "This engine takes one language. The Language Detection plugin picks the one you speak from this list." : {
+    "This engine takes one language. The Language Detection plugin picks the one you speak from this list. When the plugin is unsure or hears no speech, the engine uses #1." : {
       "localizations" : {
         "de" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Diese Engine nimmt nur eine Sprache. Das Plugin „Language Detection“ wählt daraus die Sprache, die du sprichst."
+            "value" : "Diese Engine nimmt nur eine Sprache. Das Plugin „Language Detection“ wählt daraus die Sprache, die du sprichst. Ist das Plugin unsicher oder hört es keine Sprache, verwendet die Engine Nr. 1."
           }
         },
         "es" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Este motor admite un solo idioma. El plugin Language Detection elige de esta lista el idioma que hablas."
+            "value" : "Este motor admite un solo idioma. El plugin Language Detection elige de esta lista el idioma que hablas. Si el plugin no está seguro o no oye voz, el motor usa el n.º 1."
           }
         },
         "ja" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "このエンジンは1つの言語しか受け付けません。Language Detection プラグインがこのリストから話している言語を選びます。"
+            "value" : "このエンジンは1つの言語しか受け付けません。Language Detection プラグインがこのリストから話している言語を選びます。プラグインが判断できない場合や音声が聞き取れない場合は、1番目を使います。"
           }
         },
         "zh-Hans" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "此引擎只接受一种语言。Language Detection 插件会从此列表中选择你正在说的语言。"
+            "value" : "此引擎只接受一种语言。Language Detection 插件会从此列表中选择你正在说的语言。插件无法确定或未听到语音时，引擎会使用第一种语言。"
           }
         }
       }
```

**File**: `TypeWhisper/Services/ModelManagerService.swift` (modified, +15/-5)
```diff
@@ -1978,6 +1978,16 @@ final class ModelManagerService: ObservableObject {
     /// and keeps its old behavior.
     static let hostLanguageDetectionMinimumMargin = 0.25
 
+    /// The smallest probability gap to the runner-up for which an engine without language hints
+    /// gets the detected one of the user's selected languages; below it the engine gets the first
+    /// selected language, as without a detector. Measured on held-out speech for all pairs of 20
+    /// common languages: overall accuracy stays the same when both languages are spoken equally
+    /// often (1 s clips 82.6 % to 82.5 %, 2 s and longer unchanged) and rises when the first is
+    /// spoken more often; speech in the second language gets it 2.9 points less often in 1 s
+    /// clips and 0.2 points less often from 5 s on. Unclear answers, such as speech in loud
+    /// noise, then follow the order the user chose.
+    static let selectedLanguagesDetectionMinimumMargin = 0.25
+
     private static let allLanguageCodes = Locale.LanguageCode.isoLanguageCodes.map(\.identifier)
 
     /// Whether an engine that cannot detect languages gets the user's preferred macOS language
@@ -2012,10 +2022,10 @@ final class ModelManagerService: ObservableObject {
 
     /// A language detection plugin, when enabled, picks the spoken language for engines that would
     /// otherwise get the wrong one or none: among the user's selected languages for engines without
-    /// language hints (they used the first one), and among the engine's languages when the user asked
-    /// for automatic detection but the engine cannot detect languages itself. When nothing picks a
-    /// language for such an engine, it gets the first of the user's preferred macOS languages it
-    /// supports.
+    /// language hints (they get the first one when the answer is unclear or the plugin hears no
+    /// speech), and among the engine's languages when the user asked for automatic detection but the
+    /// engine cannot detect languages itself. When nothing picks a language for such an engine, it
+    /// gets the first of the user's preferred macOS languages it supports.
     private func spokenLanguageSelection(
         for languageSelection: LanguageSelection,
         plugin: TranscriptionEnginePlugin,
@@ -2029,7 +2039,7 @@ final class ModelManagerService: ObservableObject {
         case .hints(let codes) where !plugin.acceptsLanguageHints:
             accepted = codes
             candidates = codes
-            minimumMargin = 0
+            minimumMargin = Self.selectedLanguagesDetectionMinimumMargin
         case .auto, .inheritGlobal:
             guard let engine = plugin as? HostLanguageDetectionEnginePlugin else { return languageSelection }
             let supported = Set(plugin.supportedLanguages)
```

**File**: `TypeWhisper/Views/LanguageSelectionEditor.swift` (modified, +1/-1)
```diff
@@ -140,7 +140,7 @@ struct LanguageSelectionEditor: View {
         case .acceptsHints:
             return localizedAppText("This engine uses the ordered list as language hints.", de: "Diese Engine verwendet die sortierte Liste als Sprachhinweise.")
         case .detectsSpokenLanguage:
-            return localizedAppText("This engine takes one language. The Language Detection plugin picks the one you speak from this list.", de: "Diese Engine nimmt nur eine Sprache. Das Plugin „Language Detection“ wählt daraus die Sprache, die du sprichst.")
+            return localizedAppText("This engine takes one language. The Language Detection plugin picks the one you speak from this list. When the plugin is unsure or hears no speech, the engine uses #1.", de: "Diese Engine nimmt nur eine Sprache. Das Plugin „Language Detection“ wählt daraus die Sprache, die du sprichst. Ist das Plugin unsicher oder hört es keine Sprache, verwendet die Engine Nr. 1.")
         case .firstSelectedFallback:
             return localizedAppText("This engine does not support multiple language hints. It will use #1 as the spoken language. The Language Detection plugin can pick the one you speak instead.", de: "Diese Engine unterstützt nicht mehrere Sprachhinweise. Sie verwendet Nr. 1 als gesprochene Sprache. Das Plugin „Language Detection“ kann stattdessen die Sprache wählen, die du sprichst.")
         case .unknown:
```

**File**: `TypeWhisperPluginSDK/Plugins/LanguageDetectionPlugin/LanguageDetectionPlugin.swift` (modified, +143/-12)
```diff
@@ -1,5 +1,7 @@
+import AVFoundation
 import CoreML
 import Foundation
+import SoundAnalysis
 import TypeWhisperPluginSDK
 import os
 
@@ -48,17 +50,45 @@ actor EarModel {
 
     private var model: MLModel?
     private var labels: EarLabels?
+    private var speechRequest: SNClassifySoundRequest?
 
     func unload() {
         model = nil
+        speechRequest = nil
     }
 
     func identify(samples: [Float], among candidates: [String]) throws -> PluginSpokenLanguageIdentification? {
+        let (_, labels) = try loaded()
+        guard EarScoring.columns(for: candidates, labels: labels.languages).count >= 2 else { return nil }
+
+        // The model hears English in ringing, clicks, room noise and silence with a margin near 1,
+        // so it only judges audio from the first speech on, and nothing when there is none.
+        let speechSecond: Range<Int>?
+        do {
+            guard let start = try SpeechOnset.firstSpeech(in: samples, request: loadedSpeechRequest()) else {
+                Self.logger.info("No speech in \(samples.count / EarScoring.sampleRate) s of audio")
+                return nil
+            }
+            speechSecond = start ..< min(samples.count, start + SpeechOnset.windowSamples)
+        } catch {
+            Self.logger.error("Speech search failed, judging from the first loud sound: \(error.localizedDescription, privacy: .public)")
+            speechSecond = nil
+        }
+        return try identify(samples: samples, among: candidates, speechSecond: speechSecond)
+    }
+
+    /// The model's answer for the window at `speechSecond`, or from the first loud sound when it
+    /// is nil, without looking for speech.
+    func identify(
+        samples: [Float],
+        among candidates: [String],
+        speechSecond: Range<Int>?
+    ) throws -> PluginSpokenLanguageIdentification? {
         let (model, labels) = try loaded()
         let columns = EarScoring.columns(for: candidates, labels: labels.languages)
         guard columns.count >= 2 else { return nil }
 
-        let window = EarScoring.speechWindow(samples)
+        let window = EarScoring.speechWindow(samples, speechSecond: speechSecond)
         guard !window.isEmpty else { return nil }
 
         let audio = try MLMultiArray(shape: [1, NSNumber(value: EarScoring.windowSamples)], dataType: .float32)
@@ -92,11 +122,21 @@ actor EarModel {
         )
         let milliseconds = Int((CFAbsoluteTimeGetCurrent() - start) * 1000)
         Self.logger.info(
-            "Spoken language \(result.language, privacy: .public) among \(columns.count) known of \(candidates.count) candidates: p=\(result.confidence, format: .fixed(precision: 2)) margin=\(result.margin, format: .fixed(precision: 2)) in \(milliseconds) ms"
+            "Spoken language \(result.language, privacy: .public) among \(columns.count) known of \(candidates.count) candidates: p=\(result.confidence, format: .fixed(precision: 2)) margin=\(result.margin, format: .fixed(precision: 2)) from \((speechSecond?.lowerBound ?? 0) / EarScoring.sampleRate) s in \(milliseconds) ms"
         )
         return result
     }
 
+    /// Creating the request loads the classifier (about 65 ms), so it is kept.
+    private func loadedSpeechRequest() throws -> SNClassifySoundRequest {
+        if let speechRequest {
+            return speechRequest
+        }
+        let request = try SpeechOnset.makeRequest()
+        speechRequest = request
+        return request
+    }
+
     private func loaded() throws -> (MLModel, EarLabels) {
         if let model, let labels {
             return (model, labels)
@@ -115,6 +155,92 @@ actor EarModel {
     }
 }
 
+/// Finds the first speech with the system's sound classifier, which tells speech from ringing,
+/// clicks and noise that are as loud.
+enum SpeechOnset {
+    /// Classifier windows of one second; shorter audio is padded with silence to one window.
+    static let windowSamples = EarScoring.sampleRate
+    /// Speech scores 0.8 to 0.95 per second in clean and telephone recordings and above 0.3 in
+    /// most seconds of quiet or noisy speech; ring tones, clicks and room noise score 0.01 to 0.02.
+    static let minimumConfidence = 0.3
+    static let speechLabels = ["speech", "whispering", "shout", "yell"]
+
+    static func makeRequest() throws -> SNClassifySoundRequest {
+        let request = try SNClassifySoundRequest(classifierIdentifier: .version1)
+        request.windowDuration = CMTime(value: CMTimeValue(windowSamples), timescale: CMTimeScale(EarScoring.sampleRate))
+        request.overlapFactor = 0
+        return request
+    }
+
+    /// The first sample of the first second that holds speech, or nil when none does. Stops at
+    /// the first speech, so a long recording costs only the time until someone speaks.
+    static func firstSpeech(in samples: [Float], request: SNClassifySoundRequest) throws -> Int? {
+        guard !samples.isEmpty,
+              let format = AVAudioFormat(
+        
```

**File**: `TypeWhisperPluginSDK/Plugins/LanguageDetectionPlugin/MODEL.md` (modified, +5/-0)
```diff
@@ -18,6 +18,11 @@ the plugin the engine gets the first selected language.
   117 languages in the `languages` metadata
 - the plugin adds `fusion_beta` times Whisper's log-probs to its own only when Whisper knows every
   candidate (`whisper_languages` metadata)
+- the model hears English in non-speech (ring tones, clicks, room noise, mains hum, silence) with a
+  margin near 1, so the plugin first finds the first second that holds speech with the system's
+  sound classifier (SoundAnalysis, speech score of at least 0.3) and starts the window 0.1 s
+  before the first frame within 35 dB of the loudest frame of that second; without speech it gives
+  no answer
 
 ## Training data
 
```

**File**: `TypeWhisperPluginSDK/Plugins/LanguageDetectionPlugin/Tests/LanguageDetectionPluginTests.swift` (modified, +49/-3)
```diff
@@ -4,20 +4,66 @@ import XCTest
 
 final class LanguageDetectionPluginTests: XCTestCase {
     func testBundledModelAnswersWithOneOfTheCandidates() async throws {
-        let plugin = LanguageDetectionPlugin()
         // Two seconds of a quiet tone: the answer is meaningless, but the model must load from
         // the plugin bundle and pick a candidate as the host passed it.
         let samples = (0 ..< 32_000).map { Float(sin(Double($0) * 0.05) * 0.1) }
 
-        let result = try await plugin.identifySpokenLanguage(samples: samples, among: ["de-DE", "en"])
+        let result = try await EarModel().identify(samples: samples, among: ["de-DE", "en"], speechSecond: nil)
         let pairResult = try XCTUnwrap(result)
         XCTAssertTrue(["de-DE", "en"].contains(pairResult.language))
         XCTAssertGreaterThanOrEqual(pairResult.confidence, 0.5)
 
-        let unknown = try await plugin.identifySpokenLanguage(samples: samples, among: ["en", "tlh"])
+        let unknown = try await LanguageDetectionPlugin().identifySpokenLanguage(samples: samples, among: ["en", "tlh"])
         XCTAssertNil(unknown, "One known candidate leaves the choice to the host")
     }
 
+    func testAudioWithoutSpeechLeavesTheChoiceToTheHost() async throws {
+        // Ring-back tone, clicks and room noise, as before a call: the model would hear English
+        // in it with a margin near 1 (issue #1970).
+        var generator = SystemRandomNumberGenerator()
+        let samples = (0 ..< 40 * 16_000).map { index -> Float in
+            let seconds = Double(index) / 16_000
+            let ring = seconds.truncatingRemainder(dividingBy: 5) < 1.5 ? sin(2 * .pi * 425 * seconds) * 0.2 : 0
+            let click: Double = index % 16_000 < 80 ? 0.5 : 0
+            return Float(ring + click + Double.random(in: -0.003 ... 0.003, using: &generator))
+        }
+        let plugin = LanguageDetectionPlugin()
+
+        let speechStart = try SpeechOnset.firstSpeech(in: samples, request: SpeechOnset.makeRequest())
+        XCTAssertNil(speechStart)
+        let result = try await plugin.identifySpokenLanguage(samples: samples, among: ["nl", "en"])
+        XCTAssertNil(result, "Without speech the host uses the first selected language")
+        let silence = try await plugin.identifySpokenLanguage(samples: [Float](repeating: 0, count: 8_000), among: ["nl", "en"])
+        XCTAssertNil(silence, "A second call reuses the classifier request")
+    }
+
+    func testWindowStartsShortlyBeforeTheLoudSoundWhereSpeechStarts() {
+        var samples = [Float](repeating: 0, count: 10 * 16_000)
+        // A loud click at 0.2 s, then sound from 3.5 s on.
+        for index in 3_200 ..< 3_520 { samples[index] = 0.9 }
+        for index in 56_000 ..< samples.count { samples[index] = index.isMultiple(of: 2) ? 0.1 : -0.1 }
+
+        XCTAssertEqual(EarScoring.speechWindow(samples).count, samples.count - 1_600, "From 0.1 s before the click")
+        let window = EarScoring.speechWindow(samples, speechSecond: 48_000 ..< 64_000)
+        XCTAssertEqual(window.count, samples.count - 54_400, "From 0.1 s before the sound in the speech second")
+        XCTAssertEqual(EarScoring.speechWindow(samples, speechSecond: samples.count ..< samples.count).count, 0)
+    }
+
+    func testQuietSpeechKeepsTheWindowAgainstLouderSoundsElsewhere() {
+        var samples = [Float](repeating: 0, count: 100 * 16_000)
+        // Speech at about -46 dB from 3 to 8 s, clicks at 1 s and 90 s more than 35 dB louder.
+        for index in 48_000 ..< 128_000 { samples[index] = index.isMultiple(of: 2) ? 0.005 : -0.005 }
+        for click in [16_000, 1_440_000] {
+            for index in click ..< click + 320 { samples[index] = 0.9 }
+        }
+
+        let window = EarScoring.speechWindow(samples, speechSecond: 48_000 ..< 64_000)
+        XCTAssertEqual(
+            window, Array(samples[46_400 ..< 46_400 + EarScoring.windowSamples]),
+            "From 0.1 s before the speech, not before the click at 90 s"
+        )
+    }
+
     func testWhisperGuessOnlyJoinsWhenItKnowsEveryCandidate() {
         let labels = EarLabels(languages: ["de", "en", "zu"], whisperLanguages: ["de", "en"], whisperWeight: 1)
         let own: [Float] = [log(0.4), log(0.3), log(0.3)]
```

**File**: `TypeWhisperPluginSDK/Plugins/LanguageDetectionPlugin/manifest.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
     "id": "com.typewhisper.language-detection",
     "name": "Language Detection",
-    "version": "1.0.1",
+    "version": "1.0.2",
     "minHostVersion": "1.8.1",
     "sdkCompatibilityVersion": "v1",
     "minOSVersion": "14.0",
```

**File**: `TypeWhisperPluginSDK/README.md` (modified, +3/-2)
```diff
@@ -420,8 +420,9 @@ final class MyAction: NSObject, ActionPlugin, @unchecked Sendable {
 ### SpokenLanguageIdentificationProviderPlugin
 
 Tell which of the user's selected languages is spoken. The host asks before a transcription when
-the user selected several languages and the engine accepts only one; without a provider the engine
-gets the first selected language. Audio must stay on the Mac.
+the user selected several languages and the engine accepts only one; without a provider, or when
+the answer's `margin` is below 0.25, the engine gets the first selected language. Return nil when
+the audio holds no speech. Audio must stay on the Mac.
 
 ```swift
 var spokenLanguageIdentificationProviderId: String { "my-language-id" }
```

---

### Incident Patch 3: `3f0915ea` (2026-11-20)
**Commit Message**: (bug) Stop dictation from hanging on "Preparing microphone" after a failed microphone switch (#1979)

Keep engines with a failed input device switch alive

A failed kAudioOutputUnitProperty_CurrentDevice switch can leave the AUHAL's
listeners registered on the device it was leaving, keyed by the AUHAL's
address. Once that engine was freed, the next AUHAL allocated at the same
address could not connect to the default aggregate ('nope', "listener was
already added"), and AVAudioEngine then looped forever reading its input
format. Every later recording start hung on "Preparing microphone" until the
app was restarted.

Since #1962 the idle prewarm makes this switch after every recording, so the
failure became reachable in normal use. Engines whose switch fails are now
kept for the rest of the process, which keeps their address taken; the
recording still falls back to a cold start.

**File**: `TypeWhisper/Services/AudioDeviceService.swift` (modified, +12/-0)
```diff
@@ -3789,6 +3789,16 @@ final class AudioInputDeviceActivationGuard: AudioInputDeviceActivating, @unchec
     }
 }
 
+/// Engines whose input device switch failed; they are never released.
+///
+/// A switch can fail after the AUHAL has already left its previous device (for example
+/// AVAudioEngine's default aggregate) without removing its listeners there. CoreAudio
+/// identifies those listeners by the AUHAL's address. Once the engine is freed, the next
+/// AUHAL allocated at that address cannot connect to the same device ("listener was already
+/// added", 'nope'), and AVAudioEngine then loops forever reading its input format, so every
+/// later recording start hangs. Keeping the engine alive keeps that address taken.
+let failedInputDeviceSwitchEngines = ProcessLifetimeRetainer<AVAudioEngine>()
+
 /// Sets the CoreAudio input device on an AVAudioEngine's input node AUHAL.
 /// Checks the return status and verifies the device was actually set.
 /// Returns true if the device was set successfully.
@@ -3809,6 +3819,8 @@ func setInputDevice(_ deviceID: AudioDeviceID, on engine: AVAudioEngine, label:
 
     if setStatus != noErr {
         deviceHelperLogger.error("[\(label)] AudioUnitSetProperty failed: status=\(setStatus) (\(audioStatusString(setStatus))), deviceID=\(deviceID)")
+        let retainedCount = failedInputDeviceSwitchEngines.retain(engine)
+        deviceHelperLogger.warning("[\(label)] Keeping the engine of the failed device switch alive (\(retainedCount) kept)")
         return false
     }
 
```

**File**: `TypeWhisper/Services/AudioEngineRecoverySupport.swift` (modified, +21/-0)
```diff
@@ -406,6 +406,27 @@ final class DelayedReleaseRetainer<Object: AnyObject>: @unchecked Sendable {
     }
 }
 
+/// Keeps objects alive until the process exits.
+final class ProcessLifetimeRetainer<Object: AnyObject>: @unchecked Sendable {
+    private let lock = NSLock()
+    private var objects: [Object] = []
+
+    /// Returns how many objects are retained, including this one.
+    @discardableResult
+    func retain(_ object: Object) -> Int {
+        lock.withLock {
+            if !objects.contains(where: { $0 === object }) {
+                objects.append(object)
+            }
+            return objects.count
+        }
+    }
+
+    var count: Int {
+        lock.withLock { objects.count }
+    }
+}
+
 final class AudioEngineRecoveryCoordinator: @unchecked Sendable {
     private enum LifecycleState {
         case idle
```

**File**: `TypeWhisperTests/DictationShortSpeechTests.swift` (modified, +19/-0)
```diff
@@ -365,6 +365,25 @@ final class DictationShortSpeechTests: XCTestCase {
         wait(for: [released], timeout: 0.5)
     }
 
+    func testProcessLifetimeRetainer_neverReleasesAndCountsEachObjectOnce() throws {
+        let retainer = ProcessLifetimeRetainer<ReleaseProbe>()
+        let releaseLock = NSLock()
+        var didRelease = false
+        var probe: ReleaseProbe? = ReleaseProbe {
+            releaseLock.withLock {
+                didRelease = true
+            }
+        }
+
+        XCTAssertEqual(retainer.retain(try XCTUnwrap(probe)), 1)
+        XCTAssertEqual(retainer.retain(try XCTUnwrap(probe)), 1)
+        probe = nil
+
+        Thread.sleep(forTimeInterval: 0.05)
+        XCTAssertFalse(releaseLock.withLock { didRelease })
+        XCTAssertEqual(retainer.count, 1)
+    }
+
     private func makeSamples(duration: TimeInterval) -> [Float] {
         let count = Int(duration * AudioRecordingService.targetSampleRate)
         return [Float](repeating: 0.1, count: count)
```

#### Recent Merged Pull Requests:
- **PR #1982** (2026-11-20): (chore) Give modules the signed Premium account entitlement and refresh it daily (@SeoFood)
- **PR #1981** (2026-11-20): (bug) Keep word timing and speakers when a promoted version syncs back (@SeoFood)
- **PR #1979** (2026-11-20): (bug) Stop dictation from hanging on "Preparing microphone" after a failed microphone switch (@SeoFood)
- **PR #1978** (2026-11-20): (feature) Add a Zoom Scribe plugin with live dictation (@SeoFood)
- **PR #1977** (2026-11-19): (bug) Stop reporting a missed text field in agterm and let users add terminal apps (@SeoFood)
- **PR #1976** (2026-11-19): (feature) Label subtitle exports as subtitles with timecodes (@SeoFood)

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

## X. (bug) Let an API dictation start replace a feedback banner

**RULE**:
When implementing operations in `TypeWhisper/ViewModels/DictationViewModel.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in TypeWhisper/typewhisper-mac. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9e9d0620`: (bug) Let an API dictation start replace a feedback banner. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `TypeWhisper/ViewModels/DictationViewModel.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
        // A queued hotkey start runs first, even after the reset has already set the state to
        // idle, so an API start cannot drop it and its workflow.
        HistoryRetranscriptionActivity.recordID == nil
            && pendingHotkeyDictationStart == nil
            && (state == .idle || canReplaceUndeliveredTranscriptOffer || canDismissActionFeedback)
        // A new API dictation replaces a passive feedback banner, such as "No speech
        // recognized", as the dictation hotkey does (#1959).
        if canReplaceUndeliveredTranscriptOffer || canDismissActionFeedback {
            if state == .inserting {
                resetDictationState()
            }
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
        HistoryRetranscriptionActivity.recordID == nil && (state == .idle || canReplaceUndeliveredTranscriptOffer)
        if canReplaceUndeliveredTranscriptOffer {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9e9d0620` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
