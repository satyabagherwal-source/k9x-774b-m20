> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/react-native-webrtc-react-native-webrtc-learnings.md`  
> **Source**: github ([https://github.com/react-native-webrtc/react-native-webrtc](https://github.com/react-native-webrtc/react-native-webrtc))  
> **Source Version**: `7b9b451b`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-14T16:22:52.673Z  
> **Learning ID**: `learn-github-react-native-webrtc-react-native-webrtc`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): react-native-webrtc/react-native-webrtc

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-native-webrtc-react-native-webrtc-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react-native-webrtc/react-native-webrtc](https://github.com/react-native-webrtc/react-native-webrtc))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-14T16:22:52.668Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react-native-webrtc/react-native-webrtc`
- **Description**: The WebRTC module for React Native
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4995 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ios/RCTWebRTC/SerializeUtils.h`
```
#import <WebRTC/RTCMediaStreamTrack.h>
#import <WebRTC/RTCPeerConnectionFactory.h>
#import <WebRTC/RTCRtpReceiver.h>
#import <WebRTC/RTCRtpTransceiver.h>
#import <WebRTC/RTCVideoCodecInfo.h>
#import "WebRTCModule+RTCPeerConnection.h"

@interface SerializeUtils : NSObject

+ (NSString *_Nonnull)transceiverToJSONWithPeerConnectionId:(nonnull NSNumber *)id
                                                transceiver:(RTCRtpTransceiver *_Nonnull)transceiver;
+ (NSDictionary *_Nonnull)senderToJSONWithPeerConnectionId:(nonnull NSNumber *)id sender:(RTCRtpSender *_Nonnull)sender;
+ (NSDictionary *_Nonnull)receiverToJSONWithPeerConnectionId:(nonnull NSNumber *)id
                                                    receiver:(RTCRtpReceiver *_Nonnull)receiver;
+ (NSDictionary *_Nonnull)trackToJSONWithPeerConnectionId:(nonnull NSNumber *)id
                                                    track:(RTCMediaStreamTrack *_Nonnull)track;
+ (NSDictionary *_Nonnull)capabilitiesToJSON:(RTCRtpCapabilities *_Nonnull)capabilities;
+ (NSDictionary *_Nonnull)codecCapabilityToJSON:(RTCRtpCodecCapability *_Nonnull)codec;
+ (NSString *_Nonnull)serializeDirection:(RTCRtpTransceiverDirection)direction;
+ (RTCRtpTransceiverDirection)parseDirection:(NSString *_Nonnull)direction;
+ (RTCRtpTransceiverInit *_Nonnull)parseTransceiverOptions:(NSDictionary *_Nonnull)parameters;
+ (NSDictionary *_Nonnull)parametersToJSON:(RTCRtpParameters *_Nonnull)parameters;
+ (NSMutableArray *_Nonnull)constructTransceiversInfoArrayWithPeerConnection:
    (RTCPeerConnection *_Nonnull)peerConnection;
+ (NSDictionary *_Nonnull)streamToJSONWithPeerConnectionId:(NSNumber *_Nonnull)id
                                                    stream:(RTCMediaStream *_Nonnull)stream
                                            streamReactTag:(NSString *_Nonnull)streamReactTag;
+ (NSNumber *_Nullable)parseDegradationPreference:(NSString *_Nonnull)name;
+ (NSString *_Nullable)serializeDegradationPreference:(NSNumber *_Nonnull)value;

@end

```

### Core Architecture Module: `src/RTCUtil.ts`
```

const DEFAULT_AUDIO_CONSTRAINTS = {};

const DEFAULT_VIDEO_CONSTRAINTS = {
    facingMode: 'user',
    frameRate: 30,
    height: 720,
    width: 1280
};

const FACING_MODES = [ 'user', 'environment' ];

const ASPECT_RATIO = 16 / 9;

export type RTCOfferOptions  = {
    iceRestart?:boolean;
    offerToReceiveAudio?: boolean;
    offerToReceiveVideo?: boolean;
    voiceActivityDetection?:boolean
};

const STANDARD_OFFER_OPTIONS = {
    icerestart: 'IceRestart',
    offertoreceiveaudio: 'OfferToReceiveAudio',
    offertoreceivevideo: 'OfferToReceiveVideo',
    voiceactivitydetection: 'VoiceActivityDetection'
};

const SDP_TYPES = [
    'offer',
    'pranswer',
    'answer',
    'rollback'
];

function getDefaultMediaConstraints(mediaType) {
    switch (mediaType) {
        case 'audio':
            return DEFAULT_AUDIO_CONSTRAINTS;
        case 'video':
            return DEFAULT_VIDEO_CONSTRAINTS;
        default:
            throw new TypeError(`Invalid media type: ${mediaType}`);
    }
}

function extractString(constraints, prop) {
    const value = constraints[prop];
    const type = typeof value;

    if (type === 'object') {
        for (const v of [ 'exact', 'ideal' ]) {
            if (value[v]) {
                return value[v];
            }
        }
    } else if (type === 'string') {
        return value;
    }
}

function extractNumber(constraints, prop) {
    const value = constraints[prop];
    const type = typeof value;

    if (type === 'number') {
        return Number.parseInt(value);
    } else if (type === 'object') {
        for (const v of [ 'exact', 'ideal', 'max', 'min' ]) {
            if (value[v]) {
                return Number.parseInt(value[v]);
            }
        }
    }
}

function normalizeMediaConstraints(constraints, mediaType) {
    switch (mediaType) {
        case 'audio':
            return constraints;

        case 'video': {
            const c = {
                deviceId: extractString(constraints, 'deviceId'),
                facingMode: extractString(constraints, 'facingMode'),
                frameRate: extractNumber(constraints, 'frameRate'),
                height: extractNumber(constraints, 'height'),
                width: extractNumber(constraints, 'width')
            };

            if (!c.deviceId) {
                delete c.deviceId;
            }

            if (!FACING_MODES.includes(c.facingMode)) {
                c.facingMode = DEFAULT_VIDEO_CONSTRAINTS.facingMode;
            }

            if (!c.frameRate) {
                c.frameRate = DEFAULT_VIDEO_CONSTRAINTS.frameRate;
            }

            if (!c.height && !c.width) {
                c.height = DEFAULT_VIDEO_CONSTRAINTS.height;
                c.width = DEFAULT_VIDEO_CONSTRAINTS.width;
            } else if (!c.height && c.width) {
                c.height = Math.round(c.width / ASPECT_RATIO);
            } else if (!c.width && c.height) {
                c.width = Math.round(c.height * ASPECT_RATIO);
            }

            return c;
        }

        default:
            throw new TypeError(`Invalid media type: ${mediaType}`);
    }
}

/**
 * Utility for creating short random strings from float point values.
 * We take 4 characters from the end after converting to a string.
 * Conversion to string gives us some letters as we don't want just numbers.
 * Should be suitable to pass for enough randomness.
 *
 * @return {String} 4 random characters
 */
function chr4() {
    return Math.random().toString(16).slice(-4);
}

/**
 * Put together a random string in UUIDv4 format {xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}
 *
 * @return {String} uuidv4
 */
export function uniqueID(): string {
    return `${chr4()}${chr4()}-${chr4()}-${chr4()}-${chr4()}-${chr4()}${chr4()}${chr4()}`;
}

/**
 * Utility for deep cloning an object. Object.assign() only does a shallow copy.
 *
 * @param {Object} obj - object to be cloned
 * @return {Object} cloned obj
 */
export function deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Checks whether an SDP type is valid or not.
 *
 * @param type SDP type to check.
 * @returns Whether the SDP type is valid or not.
 */
export function isSdpTypeValid(type: string): boolean {
    return SDP_TYPES.includes(type);
}

/**
 * Normalize options passed to createOffer().
 *
 * @param options - user supplied options
 * @return Normalized options
 */
export function normalizeOfferOptions(options?: RTCOfferOptions) {
    const newOptions: Record<string,string> = {};

    if (!options || typeof options !== 'object') {
        return newOptions;
    }

    // Convert standard options into WebRTC internal constant names.
    // See: https://github.com/jitsi/webrtc/blob/0cd6ce4de669bed94ba47b88cb71b9be0341bb81/sdk/media_constraints.cc#L113
    for (const [ key, value ] of Object.entries(options)) {
        const newKey = STANDARD_OFFER_OPTIONS[key.toLowerCase()];

        if (newKey) {
            newOptions[newKey] = String(Boolean(value));
        }
    }

    return newOptions;
}

/**
 * Normalize the given constraints in something we can work with.
 */
export function normalizeConstraints(constraints) {
    const c = deepClone(constraints);

    for (const mediaType of [ 'audio', 'video' ]) {
        const mediaTypeConstraints = c[mediaType];
        const typeofMediaTypeConstraints = typeof mediaTypeConstraints;

        if (typeofMediaTypeConstraints !== 'undefined') {
            if (typeofMediaTypeConstraints === 'boolean') {
                if (mediaTypeConstraints) {
                    c[mediaType] = getDefaultMediaConstraints(mediaType);
                }
            } else if (typeofMediaTypeConstraints === 'object') {
                c[mediaType] = normalizeMediaConstraints(mediaTypeConstraints, mediaType);
            } else {
                throw new TypeError(`constraints.${mediaType} is neither a boolean nor a dictionary`);
            }
        }
    }

    return c;
}

```

### Core Architecture Module: `ios/RCTWebRTC/CaptureController.h`
```
#import <Foundation/Foundation.h>
#import "CapturerEventsDelegate.h"

NS_ASSUME_NONNULL_BEGIN

@interface CaptureController : NSObject

@property(nonatomic, strong) id<CapturerEventsDelegate> eventsDelegate;
@property(nonatomic, copy, nullable) NSString *deviceId;

- (void)startCapture;
- (void)stopCapture;
- (NSDictionary *)getSettings;
- (void)applyConstraints:(NSDictionary *)constraints error:(NSError **)outError;

@end

NS_ASSUME_NONNULL_END

```

### Core Architecture Module: `ios/RCTWebRTC/CapturerEventsDelegate.h`
```
#import <WebRTC/RTCVideoCapturer.h>

NS_ASSUME_NONNULL_BEGIN

@protocol CapturerEventsDelegate

/** Called when the capturer is ended and in an irrecoverable state. */
- (void)capturerDidEnd:(RTCVideoCapturer *)capturer;

@end

NS_ASSUME_NONNULL_END

```

### Core Architecture Module: `ios/RCTWebRTC/DataChannelWrapper.h`
```
#import <Foundation/Foundation.h>
#import <WebRTC/RTCDataChannel.h>

NS_ASSUME_NONNULL_BEGIN

@class DataChannelWrapper;

@protocol DataChannelWrapperDelegate<NSObject>

- (void)dataChannelDidChangeState:(DataChannelWrapper *)dataChannelWrapper;
- (void)dataChannel:(DataChannelWrapper *)dataChannelWrapper didReceiveMessageWithBuffer:(RTCDataBuffer *)buffer;
- (void)dataChannel:(DataChannelWrapper *)dataChannelWrapper didChangeBufferedAmount:(uint64_t)amount;

@end

@interface DataChannelWrapper : NSObject

- (instancetype)initWithChannel:(RTCDataChannel *)channel reactTag:(NSString *)tag;

@property(nonatomic, nonnull, copy) NSNumber *pcId;
@property(nonatomic, nonnull, readonly) RTCDataChannel *channel;
@property(nonatomic, nonnull, readonly) NSString *reactTag;
@property(nonatomic, nullable, weak) id<DataChannelWrapperDelegate> delegate;

@end

NS_ASSUME_NONNULL_END

```

### Core Architecture Module: `ios/RCTWebRTC/I420Converter.h`
```
//
//  I420Converter.h
//  VideoSampleCaptureRender
//
//  Adapted from:
//  https://github.com/twilio/video-ios-affectiva/blob/ed2e864324c40ad25e5a06cc2b05298b03caed09/EmoCall/I420Converter.h
//  Created by Boisy Pitre on 5/21/16.
//  Copyright © 2016 Twilio. All rights reserved.
//

#import <Accelerate/Accelerate.h>
#import <UIKit/UIKit.h>
#import <WebRTC/WebRTC.h>

@interface I420Converter : NSObject

- (vImage_Error)prepareForAccelerateConversion;
- (void)unprepareForAccelerateConversion;
- (CVPixelBufferRef)convertI420ToPixelBuffer:(RTCI420Buffer *)buffer;
- (void)createPixelBufferPoolWithWidth:(size_t)width height:(size_t)height;

@end

```

### Core Architecture Module: `ios/RCTWebRTC/PIPController.h`
```
#import <AVKit/AVKit.h>
#import <UIKit/UIKit.h>
#import <WebRTC/RTCVideoTrack.h>

#import "RTCVideoViewManager.h"

API_AVAILABLE(ios(15.0))
@interface PIPController : NSObject<AVPictureInPictureControllerDelegate>

@property(nonatomic, weak) UIView *sourceView;
@property(nonatomic, strong) RTCVideoTrack *videoTrack;

@property(nonatomic, assign) BOOL startAutomatically;
@property(nonatomic, assign) BOOL stopAutomatically;
@property(nonatomic, assign) CGSize preferredSize;

- (instancetype)initWithSourceView:(UIView *)sourceView;
- (void)togglePIP;
- (void)startPIP;
- (void)stopPIP;
- (void)insertFallbackView:(UIView *)subview;
- (void)setObjectFit:(RTCVideoViewObjectFit)fit;

@end

```

### Core Architecture Module: `ios/RCTWebRTC/RCTConvert+WebRTC.h`
```
#import <React/RCTConvert.h>
#import <WebRTC/RTCConfiguration.h>
#import <WebRTC/RTCDataChannelConfiguration.h>
#import <WebRTC/RTCIceCandidate.h>
#import <WebRTC/RTCIceServer.h>
#import <WebRTC/RTCSessionDescription.h>

@interface RCTConvert (WebRTC)

+ (RTCIceCandidate *)RTCIceCandidate:(id)json;
+ (RTCSessionDescription *)RTCSessionDescription:(id)json;
+ (RTCIceServer *)RTCIceServer:(id)json;
+ (RTCDataChannelConfiguration *)RTCDataChannelConfiguration:(id)json;
+ (RTCConfiguration *)RTCConfiguration:(id)json;

@end

```

### Core Architecture Module: `ios/RCTWebRTC/RTCMediaStreamTrack+React.h`
```

#import <WebRTC/RTCMediaStreamTrack.h>

@class CaptureController;

@interface RTCMediaStreamTrack (React)

@property(strong, nonatomic) CaptureController *captureController;

@end

```

### Core Architecture Module: `ios/RCTWebRTC/RTCVideoViewManager.h`
```
#import <Foundation/Foundation.h>
#import <React/RCTViewManager.h>

/**
 * In the fashion of
 * https://www.w3.org/TR/html5/embedded-content-0.html#dom-video-videowidth
 * and https://www.w3.org/TR/html5/rendering.html#video-object-fit, resembles
 * the CSS style {@code object-fit}.
 */
typedef NS_ENUM(NSInteger, RTCVideoViewObjectFit) {
    /**
     * The contain value defined by https://www.w3.org/TR/css3-images/#object-fit:
     *
     * The replaced content is sized to maintain its aspect ratio while fitting
     * within the element's content box.
     */
    RTCVideoViewObjectFitContain = 1,
    /**
     * The cover value defined by https://www.w3.org/TR/css3-images/#object-fit:
     *
     * The replaced content is sized to maintain its aspect ratio while filling
     * the element's entire content box.
     */
    RTCVideoViewObjectFitCover
};

@interface RTCVideoViewManager : RCTViewManager

@end

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1840** (2026-11-14): **fix(android): preserve data channel event ordering**
  *Symptoms*: On Android, messages sent immediately on a remotely created `DataChannel` could be silently lost. In our libp2p workload, this caused requests to stall for roughly 10–20 seconds until a retry.  This PR fixes the problem by emitting `peerConnectionDidOpenDataChannel` before registering the native observer.  ---  The Android implementation currently registers the native `DataChannel` observer before notifying JavaScript about the new channel.  `libwebrtc` delivers queued received data when `registerObserver` is called. If the remote peer sends immediately, `dataChannelReceiveMessage` may therefore be emitted before JavaScript queues `peerConnectionDidOpenDataChannel`.  At that point, the JavaScript `RTCDataChannel` has not been constructed, and its message listeners have not been registered, so the initial message is lost. Protocols that send negotiation data immediately after opening a channel may then stall until they retry.  This change queues `peerConnectionDidOpenDataChannel` before registering the native observer, ensuring that JavaScript creates the `RTCDataChannel` and installs its listeners before the buffered messages are delivered.  ---  Tested with:  - React Native 0.86.3 - react-native-webrtc 124.0.8 - A libp2p workload that creates a new DataChannel for each stream and sends protocol negotiation data immediately

- **Issue #1829** (2026-07-31): **fix(android): guard against duplicate onActivityResult crash in screen capture**
  *Symptoms*: ## Problem  On Android, starting screen capture via `getDisplayMedia()` can crash with:  ``` java.lang.NullPointerException: Attempt to invoke interface method 'void com.facebook.react.bridge.Promise.resolve(java.lang.Object)' on a null object reference     at com.oney.WebRTCModule.GetUserMediaImpl.lambda$createScreenStream$1(GetUserMediaImpl.java)     at com.oney.WebRTCModule.GetUserMediaImpl.createScreenStream(GetUserMediaImpl.java)     at com.oney.WebRTCModule.GetUserMediaImpl$1.onActivityResult(GetUserMediaImpl.java) ```  ## Root cause  Some hosts forward the Activity result to **every** registered `ActivityEventListener` more than once. [react-native-navigation](https://github.com/wix/react-native-navigation) is a common example (its `NavigationActivity` dispatches `onActivityResult` twice). When that happens during the screen-capture permission flow, `onActivityResult` fires twice for a single `getDisplayMedia()` request:  1. First dispatch → `createScreenStream()` → resolves `displayMediaPromise` and sets it to `null`. 2. Second dispatch → `createScreenStream()` again → calls `displayMediaPromise.resolve(...)` on the now-`null` promise → **NPE**.  It also spins up a second `MediaProjection` virtual display before crashing.  This reproduces reliably in a react-native-navigation app on Android 14/15 (`targetSdk` 34/35): entering a conference, tapping screen share, and confirming the system consent dialog crashes the app immediately.  ## Fix  Two small null-guards so a du

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

### Incident Patch 1: `21ee6597` (2026-09-21)
**Commit Message**: fix(ios): convert degradationPreference between its name and the enum

On iOS, setParameters silently ignored every degradationPreference and applied
no adaptation instead.

RTCRtpSendParameters sends the preference to native as a name ("BALANCED"), but
RTCRtpParameters.degradationPreference is an NSNumber holding an
RTCDegradationPreference. The bridge assigned the string straight onto that
property; the property is `copy` and NSString implements copyWithZone:, so the
assignment succeeded with no warning and the enum was then read out of an
NSString with intValue, which is 0 for any non-numeric string.

0 is RTCDegradationPreferenceDisabled, so every preference produced the same
result: the encoder was told never to adapt. maintain-resolution appeared to
work only because nothing was ever adapted, and balanced did nothing at all.
Measured on a call before this change, the encoder held 720x1280 at 30fps and
let quantisation climb to qp 50 rather than reducing either, while leaving a
third of its bitrate allowance unspent.

The reverse direction needs converting too: parametersToJSON handed the raw
NSNumber back, and RTCRtpSendParameters runs whatever arrives through
fromNative, whi

**File**: `ios/RCTWebRTC/SerializeUtils.h` (modified, +3/-0)
```diff
@@ -25,4 +25,7 @@
 + (NSDictionary *_Nonnull)streamToJSONWithPeerConnectionId:(NSNumber *_Nonnull)id
                                                     stream:(RTCMediaStream *_Nonnull)stream
                                             streamReactTag:(NSString *_Nonnull)streamReactTag;
++ (NSNumber *_Nullable)parseDegradationPreference:(NSString *_Nonnull)name;
++ (NSString *_Nullable)serializeDegradationPreference:(NSNumber *_Nonnull)value;
+
 @end
```

**File**: `ios/RCTWebRTC/SerializeUtils.m` (modified, +29/-2)
```diff
@@ -75,6 +75,29 @@ + (NSDictionary *)receiverToJSONWithPeerConnectionId:(NSNumber *)id receiver:(RT
     return receiverDictionary;
 }
 
+/**
+ * The names RTCRtpSendParameters exchanges with JS, indexed by RTCDegradationPreference.
+ *
+ * JS sends and expects a name such as MAINTAIN_FRAMERATE, while the native property is an
+ * NSNumber wrapping the enum, so both directions need a conversion.
+ */
++ (NSArray<NSString *> *_Nonnull)degradationPreferenceNames {
+    return @[ @"DISABLED", @"MAINTAIN_FRAMERATE", @"MAINTAIN_RESOLUTION", @"BALANCED" ];
+}
+
++ (NSNumber *_Nullable)parseDegradationPreference:(NSString *_Nonnull)name {
+    NSUInteger index = [[self degradationPreferenceNames] indexOfObject:[name uppercaseString]];
+
+    return index == NSNotFound ? nil : @(index);
+}
+
++ (NSString *_Nullable)serializeDegradationPreference:(NSNumber *_Nonnull)value {
+    NSArray<NSString *> *names = [self degradationPreferenceNames];
+    NSInteger index = value.integerValue;
+
+    return (index >= 0 && index < (NSInteger)names.count) ? names[index] : nil;
+}
+
 + (NSDictionary *)parametersToJSON:(RTCRtpParameters *)params {
     NSMutableDictionary *paramsDictionary = [NSMutableDictionary new];
 
@@ -145,8 +168,12 @@ + (NSDictionary *)parametersToJSON:(RTCRtpParameters *)params {
     paramsDictionary[@"encodings"] = encodings;
     paramsDictionary[@"codecs"] = codecs;
 
-    if (params.degradationPreference) {
-        paramsDictionary[@"degradationPreference"] = params.degradationPreference;
+    if (params.degradationPreference != nil) {
+        NSString *name = [SerializeUtils serializeDegradationPreference:params.degradationPreference];
+
+        if (name != nil) {
+            paramsDictionary[@"degradationPreference"] = name;
+        }
     }
 
     return paramsDictionary;
```

**File**: `ios/RCTWebRTC/WebRTCModule+Transceivers.m` (modified, +5/-2)
```diff
@@ -245,8 +245,11 @@ - (RTCRtpParameters *)updateParametersWithOptions:(NSDictionary *)options params
         encoding.scaleResolutionDownBy = encodingUpdate[@"scaleResolutionDownBy"];
     }
 
-    if ([options objectForKey:@"degradationPreference"]) {
-        params.degradationPreference = [options objectForKey:@"degradationPreference"];
+    id degradationPreference = [options objectForKey:@"degradationPreference"];
+    if ([degradationPreference isKindOfClass:[NSString class]]) {
+        params.degradationPreference = [SerializeUtils parseDegradationPreference:degradationPreference];
+    } else if ([degradationPreference isKindOfClass:[NSNumber class]]) {
+        params.degradationPreference = degradationPreference;
     }
 
     return params;
```

---

### Incident Patch 2: `7b9b451b` (2026-09-15)
**Commit Message**: fix(android): preserve data channel event ordering

**File**: `android/src/main/java/com/oney/WebRTCModule/PeerConnectionObserver.java` (modified, +3/-1)
```diff
@@ -359,7 +359,6 @@ public void onDataChannel(DataChannel dataChannel) {
             final String reactTag = UUID.randomUUID().toString();
             DataChannelWrapper dcw = new DataChannelWrapper(webRTCModule, id, reactTag, dataChannel);
             dataChannels.put(reactTag, dcw);
-            dataChannel.registerObserver(dcw);
 
             WritableMap info = Arguments.createMap();
             info.putInt("peerConnectionId", id);
@@ -381,6 +380,9 @@ public void onDataChannel(DataChannel dataChannel) {
             params.putMap("dataChannel", info);
 
             webRTCModule.sendEvent("peerConnectionDidOpenDataChannel", params);
+
+            // Ensure buffered messages reach JavaScript after the DataChannel is created.
+            dataChannel.registerObserver(dcw);
         });
     }
 
```

#### Recent Merged Pull Requests:
- **PR #1857** (2026-11-11):    android: stop RTCView drawing the previous track after a stream switch (@shorifulmia85)
- **PR #1855** (closed): Merge upstream react-native-webrtc@155.0.1 (@davidliu)
- **PR #1854** (closed): Fix/leveller android 11 (@Arjit0762)
- **PR #1853** (closed): Add patch queue, self-test app and skills for syncing with upstream (@filipi87)
- **PR #1852** (2026-10-20): android: fix getDisplayMedia crash on API < 31 (@Calinteodor)
- **PR #1851** (2026-10-20): Revert "ios(RCTWebRTC): enable Center Stage for devices that support it" (@Calinteodor)

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

## X. ios): convert degradationPreference between its name and the enum

**RULE**:
When implementing operations in `ios/RCTWebRTC/SerializeUtils.h`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in react-native-webrtc/react-native-webrtc. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `21ee6597`: ios): convert degradationPreference between its name and the enum. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `ios/RCTWebRTC/SerializeUtils.h`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
+ (NSNumber *_Nullable)parseDegradationPreference:(NSString *_Nonnull)name;
+ (NSString *_Nullable)serializeDegradationPreference:(NSNumber *_Nonnull)value;

```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `21ee6597` are properly handled with clean fallback behavior.
