# Forensic Learning Record (Deep Inspection): react-native-webrtc/react-native-webrtc

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-native-webrtc-react-native-webrtc-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react-native-webrtc/react-native-webrtc](https://github.com/react-native-webrtc/react-native-webrtc))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:09:49.015Z  
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

### Core Architecture Module: `ios/RCTWebRTC/SampleBufferVideoCallView.h`
```
#import <AVKit/AVKit.h>
#import <Foundation/Foundation.h>
#import <React/RCTViewManager.h>
#import <WebRTC/RTCVideoRenderer.h>

@interface SampleBufferVideoCallView : UIView<RTCVideoRenderer>

@property(nonnull, nonatomic, readonly) AVSampleBufferDisplayLayer *sampleBufferLayer;
@property(nonatomic, assign) BOOL shouldRender;

- (void)requestScaleRecalculation;
@end

```

### Core Architecture Module: `ios/RCTWebRTC/ScreenCaptureController.h`
```
#import <Foundation/Foundation.h>
#import "CaptureController.h"
#import "CapturerEventsDelegate.h"

NS_ASSUME_NONNULL_BEGIN

extern NSString *const kRTCScreensharingSocketFD;
extern NSString *const kRTCAppGroupIdentifier;

@class ScreenCapturer;

@interface ScreenCaptureController : CaptureController

- (instancetype)initWithCapturer:(nonnull ScreenCapturer *)capturer;
- (void)startCapture;
- (void)stopCapture;

@end

NS_ASSUME_NONNULL_END

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1829** (2026-07-31): **fix(android): guard against duplicate onActivityResult crash in screen capture**
  *Symptoms*: ## Problem  On Android, starting screen capture via `getDisplayMedia()` can crash with:  ``` java.lang.NullPointerException: Attempt to invoke interface method 'void com.facebook.react.bridge.Promise.resolve(java.lang.Object)' on a null object reference     at com.oney.WebRTCModule.GetUserMediaImpl.lambda$createScreenStream$1(GetUserMediaImpl.java)     at com.oney.WebRTCModule.GetUserMediaImpl.createScreenStream(GetUserMediaImpl.java)     at com.oney.WebRTCModule.GetUserMediaImpl$1.onActivityResult(GetUserMediaImpl.java) ```  ## Root cause  Some hosts forward the Activity result to **every** registered `ActivityEventListener` more than once. [react-native-navigation](https://github.com/wix/react-native-navigation) is a common example (its `NavigationActivity` dispatches `onActivityResult` twice). When that happens during the screen-capture permission flow, `onActivityResult` fires twice for a single `getDisplayMedia()` request:  1. First dispatch → `createScreenStream()` → resolves `displayMediaPromise` and sets it to `null`. 2. Second dispatch → `createScreenStream()` again → calls `displayMediaPromise.resolve(...)` on the now-`null` promise → **NPE**.  It also spins up a second `MediaProjection` virtual display before crashing.  This reproduces reliably in a react-native-navigation app on Android 14/15 (`targetSdk` 34/35): entering a conference, tapping screen share, and confirming the system consent dialog crashes the app immediately.  ## Fix  Two small null-guards so a du

- **Issue #1828** (2026-07-30): **android: fix frame leak with multiple video processors**
  *Symptoms*: This affects the multi-processor pipeline introduced in #1681.  `VideoFrameProcessor.process()` returns a caller-owned frame. With a single processor, the current implementation releases both the retained input and the final output. With two or more processors, each loop iteration overwrites `outputFrame` without releasing the previous returned frame.  | Reference | Acquired from | Released by the current code | | --- | --- | --- | | `F0` | Initial `frame.retain()` | `frame.release()` | | `F1` | First processor result | No | | `F2` | Second processor result | `outputFrame.release()` |  As a result, the intermediate `F1` reference remains retained after each captured frame.  This change keeps the current input in a local variable and releases it after the processor returns. The returned frame then becomes the single owned reference carried to the next stage.  Returning the same frame remains supported when the processor calls `retain()` before returning it, as required by the existing [`VideoFrameProcessor` ownership contract](https://github.com/react-native-webrtc/react-native-webrtc/blob/cf6101cdfecff24ad2f57374dccd3026e5a11e4d/android/src/main/java/com/oney/WebRTCModule/videoEffects/VideoFrameProcessor.java#L6-L18).  This also keeps an empty processor list balanced: the final `outputFrame.release()` matches the initial `frame.retain()`.  ### Validation  - `git diff --check` - Compiled `VideoFrameProcessor.java` and `VideoEffectProcessor.java` against   the WebRTC M124 Java 

- **Issue #1808** (2026-05-11): **fix: preserve facing mode in applyConstraints**
  *Symptoms*: Fixes #1807
  **Post-Mortem & Fix Analysis**:
  > This needs review.  This is the fix I have used in my code. Feel free to close it and provide a different fix if this is not adequate.
  > Please don't format the entire file, it makes it much harder to review.
  > > Please don't format the entire file, it makes it much harder to review.  Oh Sorry. Fixed it.

- **Issue #1805** (2026-09-18): **fix(android): resolve D8 nest mates dex error with AGP 8.12+**
  *Symptoms*: ## Summary  Fixes Android build failure with AGP 8.12 (Gradle 9), which ships with Expo SDK 55 / React Native 0.82+.  The anonymous `TimerTask` inner class in `VideoTrackAdapter.TrackMuteUnmuteImpl` creates a nest mate class (`VideoTrackAdapter$TrackMuteUnmuteImpl$1`) that D8's `DexingNoClasspathTransform` cannot resolve:  ``` D8: Compilation of classes com.oney.WebRTCModule.VideoTrackAdapter, com.oney.WebRTCModule.VideoTrackAdapter$TrackMuteUnmuteImpl requires its nest mates com.oney.WebRTCModule.VideoTrackAdapter$TrackMuteUnmuteImpl$1 (unavailable) to be on program or class path ```  ## Fix  - Replace the anonymous `TimerTask` with a named static `MuteCheckTask` inner class - Relax field visibility on `disposed`, `frameCounter`, `mutedState` from `private` to package-private so the static class can access them - No behavioral changes — same logic, just restructured to avoid the anonymous nest mate  ## Tested with  - AGP 8.12.0 / Gradle 9.0.0 - Expo SDK 55 / React Native 0.82 - react-native-webrtc 124.0.7 - Physical Android device (API 34)
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically marked as stale because it has not had recent activity. It will be closed if no further activity occurs. Thank you for your contributions. 

- **Issue #1800** (2026-07-21): **android: fix race condition in getDisplayMedia**
  *Symptoms*: Fixes: https://github.com/react-native-webrtc/react-native-webrtc/issues/1799 

- **Issue #1799** (2026-07-21): **Android: Blank screen share due to race condition between MediaProjectionService.launch() and startCapture()**
  *Symptoms*: Bug Description On Android 13–16, screen sharing intermittently shows a blank screen (~40–60% of the time). The root cause is a race condition between `MediaProjectionService.launch()` and `startCapture()` in `GetUserMediaImpl.java`.  `startForegroundService()` is async — the service's `onStartCommand()` runs on the main thread at a later time. However, `createScreenStream()` (and subsequently `startCapture()`) runs immediately on a background thread without waiting for the foreground service to be ready. When `startCapture()` executes before `startForeground()` completes, Android throws: > Media projections require a foreground service of type ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION  This exception is silently swallowed in `AbstractVideoCaptureController.startCapture()`, resulting in a blank/dead screen share track being published.  ### Steps to Reproduce  - Join a meeting on an Android 13+ device - Start screen sharing - Stop screen sharing - Start screen sharing again - Repeat multiple times — blank screen occurs ~40–60% of the time  ### Logs  ✅ Successful attempt (service ready before capture): ``` 17:27:02.702  Thread-9247  createScreenStream() starts 17:27:02.719  Thread-8061  onStartCommand() ENTERED         ← Service starts 17:27:02.720  Thread-8061  startForeground() completed       ← Service ready ✅ 17:27:02.746  Thread-9247  startCapture() called             ← Capture AFTER service ready ✅ 17:27:02.810  Thread-9247  startCapture() completed          ← 
  **Post-Mortem & Fix Analysis**:
  > Sounds reasonable, would you like to send a patch?
  > I think it would probably be better to use a Future, like the executor APIs we use?
  > PR: https://github.com/react-native-webrtc/react-native-webrtc/pull/1800

- **Issue #1722** (2025-07-24): **Error on Android on React Native v0.80.0 when importing anything from `react-native-webrtc`**
  *Symptoms*: When importing from "react-native-webrtc" on React Native v0.80 (currently on RN@0.80.0) the following error is thrown:  ``` 	Error: Exception in HostObject::get for prop 'WebRTCModule': com.facebook.react.internal.turbomodule.core.TurboModuleInteropUtils$ParsingException: Unable to parse @ReactMethod annotations from native module: WebRTCModule. Details: TurboModule system assumes returnType == void iff the method is synchronous.         at com.facebook.react.internal.turbomodule.core.TurboModuleInteropUtils.getMethodDescriptorsFromModule(TurboModuleInteropUtils.kt:61)         at com.facebook.react.internal.turbomodule.core.TurboModuleManager$Companion.getMethodDescriptorsFromModule(TurboModuleManager.kt:403)         at com.facebook.react.internal.turbomodule.core.TurboModuleManager$Companion.access$getMethodDescriptorsFromModule(TurboModuleManager.kt:389)         at com.facebook.react.internal.turbomodule.core.TurboModuleManager.getMethodDescriptorsFromModule(Unknown Source:2)         at com.facebook.jni.NativeRunnable.run(Native Method)         at android.os.Handler.handleCallback(Handler.java:959)         at android.os.Handler.dispatchMessage(Handler.java:100)         at com.facebook.react.bridge.queue.MessageQueueThreadHandler.dispatchMessage(MessageQueueThreadHandler.kt:21)         at android.os.Looper.loopOnce(Looper.java:232)         at android.os.Looper.loop(Looper.java:317)         at com.facebook.react.bridge.queue.MessageQueueThreadImpl$Companion.startNewBackgroun
  **Post-Mortem & Fix Analysis**:
  > Will investigate but wasn't aware of any outstanding issues as this module still works under the compatibility layer. So unless some of them systems have changed with RN 0.80, everything should be fine.
  > After setting up a clean project with RN 0.80, I can confirm things are not working as expected. So it would appear something has changed with the compatibility layer. Time to start moving with the New Arch.
  > I also encountered this problem, the simplest use would trigger this error ```js const stream = await mediaDevices.getUserMedia({   audio: true,   video: false, }); ```

- **Issue #1702** (2025-09-20): **Type Error with MediaStream Properties in react-native-webrtc**
  *Symptoms*: # Type Error with MediaStream Properties in react-native-webrtc  `"react-native-webrtc": "^124.0.5"`  <img width="320" alt="Image" src="https://github.com/user-attachments/assets/e8721279-595d-4f3c-bfdc-c1f417d89523" /> <img width="320" alt="Image" src="https://github.com/user-attachments/assets/bee4e8c2-c578-454b-8de1-c2143b48ffd5" />   ## Description When using the MediaStream type from react-native-webrtc, TypeScript reports missing properties that should be available on the MediaStream interface.  ## Error Message  ``` Type 'MediaStream' is missing the following properties from type 'MediaStream': _tracks, _id, _reactTag, toURL, release ````  ## Sample Code   ```tsx import { useState } from "react"; import { View } from "react-native"; import { MediaStream, mediaDevices } from "react-native-webrtc";  const configuration = {   iceServers: [     {       urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],     },   ],   iceCandidatePoolSize: 10, };  export default function HomeScreen() {   const [localStream, setLocalStream] = useState<MediaStream | null>(null);   const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);    const [peerConnection, setPeerConnection] =     useState<RTCPeerConnection | null>(null);    const initializePeerConnection = (): RTCPeerConnection => {     const peerConnection = new RTCPeerConnection(configuration);      // Handle incoming remote stream     peerConnection.ontrack = (event) => {       console.log("R
  **Post-Mortem & Fix Analysis**:
  > Use like this   Either import everything from  'react-native-webrtc' or use [registerGlobals()](https://github.com/react-native-webrtc/react-native-webrtc/blob/master/Documentation/BasicUsage.md#registering-globals)  ```ts import { useState } from 'react'; import { View } from 'react-native'; import { MediaStream, mediaDevices, RTCPeerConnection } from 'react-native-webrtc';  const configuration = {     iceServers: [         {             urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],         },     ],     iceCandidatePoolSize: 10, };  export default function HomeScreen() {     const [localStream, setLocalStream] = useState<MediaStream | null>(null);     const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);      const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);      const initializePeerConnection = (): RTCPeerConnection => {         const peerConnection = new RTCPeerConnection(configuration);          
  > By the way, i always import from `react-native-webrtc` directly.  Because, if i use `navigator.mediaDevices.getDisplayMedia()`, vscode will tell you that, you can pass these [options](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia#options)  But in internally, its not taking any args [getDisplayMedia()](https://github.com/react-native-webrtc/react-native-webrtc/blob/master/src/MediaDevices.ts#L28) 🫠
  >  did you use expo 53 for this project?

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

### Incident Patch 1: `7266a9b2` (2026-09-09)
**Commit Message**: build(deps-dev): bump js-yaml from 4.3.0 to 4.3.2

Bumps [js-yaml](https://github.com/nodeca/js-yaml) from 4.3.0 to 4.3.2.
- [Changelog](https://github.com/nodeca/js-yaml/blob/4.3.2/CHANGELOG.md)
- [Commits](https://github.com/nodeca/js-yaml/compare/4.3.0...4.3.2)

---
updated-dependencies:
- dependency-name: js-yaml
  dependency-version: 4.3.2
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `package-lock.json` (modified, +7/-6)
```diff
@@ -4231,9 +4231,9 @@
       "dev": true
     },
     "node_modules/js-yaml": {
-      "version": "4.3.0",
-      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.0.tgz",
-      "integrity": "sha512-1td788aAnnZ5qs7V2QIRl1owjtYpbKt749Y3xauqQgwIIGF/xXWz1wMTEBx5O3LK3lXLVuqXPdPxj2BoFHaW9Q==",
+      "version": "4.3.2",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.2.tgz",
+      "integrity": "sha512-SFNOvSJ+Dgf/9An904Yx+CgSlIPCkIpao4qo51lpee25TIRejdH3rhR4EZMGoNx3/TP3O+wzWuiTFl4sqbltzA==",
       "dev": true,
       "funding": [
         {
@@ -4245,6 +4245,7 @@
           "url": "https://github.com/sponsors/nodeca"
         }
       ],
+      "license": "MIT",
       "dependencies": {
         "argparse": "^2.0.1"
       },
@@ -8810,9 +8811,9 @@
       "dev": true
     },
     "js-yaml": {
-      "version": "4.3.0",
-      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.0.tgz",
-      "integrity": "sha512-1td788aAnnZ5qs7V2QIRl1owjtYpbKt749Y3xauqQgwIIGF/xXWz1wMTEBx5O3LK3lXLVuqXPdPxj2BoFHaW9Q==",
+      "version": "4.3.2",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.2.tgz",
+      "integrity": "sha512-SFNOvSJ+Dgf/9An904Yx+CgSlIPCkIpao4qo51lpee25TIRejdH3rhR4EZMGoNx3/TP3O+wzWuiTFl4sqbltzA==",
       "dev": true,
       "requires": {
         "argparse": "^2.0.1"
```

---

### Incident Patch 2: `8f5428a2` (2026-09-03)
**Commit Message**: build(deps-dev): bump brace-expansion from 1.1.11 to 1.1.18 (#1835)

Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion) from 1.1.11 to 1.1.18.
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/1.1.11...v1.1.18)

---
updated-dependencies:
- dependency-name: brace-expansion
  dependency-version: 1.1.18
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `package-lock.json` (modified, +7/-6)
```diff
@@ -2449,10 +2449,11 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "1.1.11",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.11.tgz",
-      "integrity": "sha512-iCuPHDFgrHX7H2vEI/5xpz07zSHB00TpugqhmYtVmMO6518mCuRMoOYFldEBl0g187ufozdaHgWKcYFb61qGiA==",
+      "version": "1.1.18",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.18.tgz",
+      "integrity": "sha512-Edep/X9fGqVNmzKBVsDYIOtD+z1tuezV70LBjdCst9Tqu76lsnvRiZ6oTic1n+/BIwX6QDGAO94PN4N2SADvtw==",
       "dev": true,
+      "license": "MIT",
       "dependencies": {
         "balanced-match": "^1.0.0",
         "concat-map": "0.0.1"
@@ -7507,9 +7508,9 @@
       "dev": true
     },
     "brace-expansion": {
-      "version": "1.1.11",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.11.tgz",
-      "integrity": "sha512-iCuPHDFgrHX7H2vEI/5xpz07zSHB00TpugqhmYtVmMO6518mCuRMoOYFldEBl0g187ufozdaHgWKcYFb61qGiA==",
+      "version": "1.1.18",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.18.tgz",
+      "integrity": "sha512-Edep/X9fGqVNmzKBVsDYIOtD+z1tuezV70LBjdCst9Tqu76lsnvRiZ6oTic1n+/BIwX6QDGAO94PN4N2SADvtw==",
       "dev": true,
       "requires": {
         "balanced-match": "^1.0.0",
```

---

### Incident Patch 3: `d062e9b6` (2026-09-03)
**Commit Message**: build(deps-dev): bump browserslist from 4.24.3 to 4.28.8 (#1836)

Bumps [browserslist](https://github.com/browserslist/browserslist) from 4.24.3 to 4.28.8.
- [Release notes](https://github.com/browserslist/browserslist/releases)
- [Changelog](https://github.com/browserslist/browserslist/blob/main/CHANGELOG.md)
- [Commits](https://github.com/browserslist/browserslist/compare/4.24.3...4.28.8)

---
updated-dependencies:
- dependency-name: browserslist
  dependency-version: 4.28.8
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `package-lock.json` (modified, +72/-43)
```diff
@@ -2435,6 +2435,19 @@
         }
       ]
     },
+    "node_modules/baseline-browser-mapping": {
+      "version": "2.11.20",
+      "resolved": "https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.11.20.tgz",
+      "integrity": "sha512-H0ulySigv6icDJ1F7SjtdCD6PrhTpdYCmP0CactWy1+ekh0AFd0o1Wn5T8b+hnTmdBx19u9yhL6wvCylXMY7zw==",
+      "dev": true,
+      "license": "Apache-2.0",
+      "bin": {
+        "baseline-browser-mapping": "dist/cli.cjs"
+      },
+      "engines": {
+        "node": ">=6.0.0"
+      }
+    },
     "node_modules/brace-expansion": {
       "version": "1.1.11",
       "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.11.tgz",
@@ -2458,9 +2471,9 @@
       }
     },
     "node_modules/browserslist": {
-      "version": "4.24.3",
-      "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.24.3.tgz",
-      "integrity": "sha512-1CPmv8iobE2fyRMV97dAcMVegvvWKxmq94hkLiAkUGwKVTyDLw33K+ZxiFrREKmmps4rIw6grcCFCnTMSZ/YiA==",
+      "version": "4.28.8",
+      "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.28.8.tgz",
+      "integrity": "sha512-V2NpofLblG64mfOtSgDhOJESZEGogzDMBv/q+W6oc4LXWP/q75eOXoOaaOu1EOadB9U4Bwx/e0yzbvwKH8zalA==",
       "dev": true,
       "funding": [
         {
@@ -2476,11 +2489,13 @@
           "url": "https://github.com/sponsors/ai"
         }
       ],
+      "license": "MIT",
       "dependencies": {
-        "caniuse-lite": "^1.0.30001688",
-        "electron-to-chromium": "^1.5.73",
-        "node-releases": "^2.0.19",
-        "update-browserslist-db": "^1.1.1"
+        "baseline-browser-mapping": "^2.11.12",
+        "caniuse-lite": "^1.0.30001809",
+        "electron-to-chromium": "^1.5.402",
+        "node-releases": "^2.0.53",
+        "update-browserslist-db": "^1.3.0"
       },
       "bin": {
         "browserslist": "cli.js"
@@ -2512,9 +2527,9 @@
       }
     },
     "node_modules/caniuse-lite": {
-      "version": "1.0.30001690",
-      "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001690.tgz",
-      "integrity": "sha512-5ExiE3qQN6oF8Clf8ifIDcMRCRE/dMGcETG/XGMD8/XiXm6HXQgQTh1yZYLXXpSOsEUlJm1Xr7kGULZTuGtP/w==",
+      "version": "1.0.30001810",
+      "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001810.tgz",
+      "integrity": "sha512-TITQPUkaz+aVk5GL6NhOdwk1aEaNTSDPsGFWrTuhKGtjTF70jL/Oht2W4c6rXUe5fu7Ie19VIahAXHIIiWWNeg==",
       "dev": true,
       "funding": [
         {
@@ -2529,7 +2544,8 @@
           "type": "github",
           "url": "https://github.com/sponsors/ai"
         }
-      ]
+      ],
+      "license": "CC-BY-4.0"
     },
     "node_modules/clean-stack": {
       "version": "2.2.0",
@@ -2749,10 +2765,11 @@
       }
     },
     "node_modules/electron-to-chromium": {
-      "version": "1.5.78",
-      "resolved": "https://registry.npmjs.org/electron-to-chromium/-/electron-to-chromium-1.5.78.tgz",
-      "integrity": "sha512-UmwIt7HRKN1rsJfddG5UG7rCTCTAKoS9JeOy/R0zSenAyaZ8SU3RuXlwcratxhdxGRNpk03iq8O7BA3W7ibLVw==",
-      "dev": true
+      "version": "1.5.420",
+      "resolved": "https://registry.npmjs.org/electron-to-chromium/-/electron-to-chromium-1.5.420.tgz",
+      "integrity": "sha512-2yD6XreGusOfNV+dUcvipJEXc3n/n7fgr7996aszTG+YY5E4mqM4tOq/3uhP129cazL9YHbVWSpc79ePotWtPA==",
+      "dev": true,
+      "license": "ISC"
     },
     "node_modules/emoji-regex": {
       "version": "8.0.0",
@@ -4541,10 +4558,14 @@
       "dev": true
     },
     "node_modules/node-releases": {
-      "version": "2.0.19",
-      "resolved": "https://registry.npmjs.org/node-releases/-/node-releases-2.0.19.tgz",
-      "integrity": "sha512-xxOWJsBKtzAq7DY0J+DTzuz58K8e7sJbdgwkbMWQe8UYB6ekmsQ45q0M/tJDsGaZmbC+l7n57UV8Hl5tHxO9uw==",
-      "dev": true
+      "version": "2.0.54",
+      "resolved": "https://registry.npmjs.org/node-releases/-/node-releases-2.0.54.tgz",
+      "integrity": "sha512-YHs7BmmcsdAI5Ozuf8JZo6PT0mv2GIWC9vMfvUC3dp65M8hn7Ux8CPL+2oBI7juNuj9d0ndhTcznq2ODBps9cQ==",
+      "dev": true,
+      "license": "MIT",
+      "engines": {
+        "node": ">=18"
+      }
     },
     "node_modules/normalize-path": {
       "version": "3.0.0",
@@ -5641,9 +5662,9 @@
       }
     },
     "node_modules/update-browserslist-db": {
-      "version": "1.1.1",
-      "resolved": "https://registry.npmjs.org/update-browserslist-db/-/update-browserslist-db-1.1.1.tgz",
-      "integrity": "sha512-R8UzCaa9Az+38REPiJ1tXlImTJXlVfgHZsglwBD/k6nj76ctsH1E3q4doGrukiLQd3sGQYu56r5+lo5r94l29A==",
+      "version": "1.3.2",
+      "resolved": "https://registry.npmjs.org/update-browserslist-db/-/update-browserslist-db-1.3.2.tgz",
+      "integrity": "sha512-UQ+MSxlhRm1bzjhU+DcuXfjFO1FzNtqhK5+9Yvlp90ItDLk5vT932A0rFu619nf7RVS+Y/VeaUW1jaRDqZ8VJw==",
       "dev": true,
       "funding": [
         {
@@ -5659,9 +5680,10 @@
           "url": "https://github.com/sponsors/ai"
         }
       ],
+      "license": "MIT",
       "dep
```

---

### Incident Patch 4: `014a8cf0` (2026-07-31)
**Commit Message**: build: ship the vendored declarations in the typescript build

The typescript target builds with `tsc --emitDeclarationOnly`, and tsc never
emits output for .d.ts inputs, so src/vendor/event-target-shim/index.d.ts never
made it into lib/typescript. Every `import from './vendor/event-target-shim'` in
the shipped declarations then failed to resolve, which silently stripped the
EventTarget members off our classes for consumers using the declaration files:

    error TS2339: Property 'addEventListener' does not exist on type
    'RTCPeerConnection'.

skipLibCheck (on by default in react-native's tsconfig) hides the resolution
error itself, so it only ever surfaced at the call sites.

The commonjs and module targets mishandle the same file in the other direction:
they compile every source file and rewrite the extension to .js, emitting an
index.d.js which holds no code and which nothing imports.

Fix both in a postbuild step, since bob 0.18.2 can neither copy extra files into
the typescript output nor exclude files from the babel targets.

Fixes #1830

**File**: `package.json` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@
   "scripts": {
     "lint": "eslint --max-warnings 0 . && tsc --noEmit",
     "lintfix": "eslint --max-warnings 0 --fix . && tsc --noEmit",
-    "prepare": "husky install && bob build",
+    "prepare": "husky install && bob build && node tools/postbuild.mjs",
     "format": "tools/format.sh"
   },
   "bugs": {
```

**File**: `tools/postbuild.mjs` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+#!/usr/bin/env node
+
+/**
+ * Fixes up the bob build output for the declaration files which are shipped as-is
+ * (currently the ones for the vendored event-target-shim). bob mishandles them in
+ * both directions, so for every .d.ts file in src/ we:
+ *
+ * - Copy it into the typescript output. That target builds with
+ *   `tsc --emitDeclarationOnly`, and tsc never emits output for .d.ts inputs, so the
+ *   relative imports pointing at them fail to resolve for consumers using the
+ *   declaration files, which silently strips the EventTarget members off our classes.
+ *
+ * - Delete the empty module babel emitted for it in the commonjs and module outputs.
+ *   Those targets compile every source file and rewrite the extension to .js, turning
+ *   index.d.ts into an index.d.js which holds no code and which nothing imports.
+ */
+
+import fs from 'node:fs';
+import path from 'node:path';
+import process from 'node:process';
+
+const root = path.resolve(import.meta.dirname, '..');
+const source = path.join(root, 'src');
+const output = path.join(root, 'lib');
+const declarationsOutput = path.join(output, 'typescript');
+const compiledOutputs = [ path.join(output, 'commonjs'), path.join(output, 'module') ];
+
+/**
+ * Finds every declaration file below the given directory, as paths relative to it.
+ */
+function findDeclarations(directory, prefix = '') {
+    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
+        const entryPath = path.join(prefix, entry.name);
+
+        if (entry.isDirectory()) {
+            return findDeclarations(path.join(directory, entry.name), entryPath);
+        }
+
+        return entry.name.endsWith('.d.ts') ? [ entryPath ] : [];
+    });
+}
+
+if (!fs.existsSync(output)) {
+    console.error(`${path.relative(root, output)} not found, run "bob build" first.`);
+    process.exit(1);
+}
+
+for (const declaration of findDeclarations(source)) {
+    const target = path.join(declarationsOutput, declaration);
+
+    fs.mkdirSync(path.dirname(target), { recursive: true });
+    fs.copyFileSync(path.join(source, declaration), target);
+
+    console.info(`Copied src/${declaration} -> ${path.relative(root, target)}`);
+
+    for (const compiledOutput of compiledOutputs) {
+        const compiled = path.join(compiledOutput, declaration.replace(/\.ts$/, '.js'));
+
+        for (const artifact of [ compiled, `${compiled}.map` ]) {
+            if (fs.existsSync(artifact)) {
+                fs.rmSync(artifact);
+
+                console.info(`Removed ${path.relative(root, artifact)}`);
+            }
+        }
+    }
+}
```

---

### Incident Patch 5: `78d3094d` (2026-07-29)
**Commit Message**: fix(android): guard against duplicate onActivityResult in screen capture

Some hosts forward Activity results to every registered ActivityEventListener
more than once (react-native-navigation is a common example). During the
getDisplayMedia() screen-capture permission flow this makes onActivityResult
fire twice for a single request: the first pass consumes displayMediaPromise
(resolving it and nulling it) and the second pass calls resolve()/reject() on
the now-null promise, crashing with a NullPointerException. It also spins up a
second MediaProjection virtual display.

Add null-guards so a duplicate dispatch is ignored: one at the top of the
PERMISSION_REQUEST_CODE branch (covers the cancel path, which nulls the promise
synchronously) and one at the top of createScreenStream() (covers the success
path, since the single-threaded executor runs the duplicated callbacks in order).

**File**: `android/src/main/java/com/oney/WebRTCModule/GetUserMediaImpl.java` (modified, +17/-0)
```diff
@@ -75,6 +75,15 @@ class GetUserMediaImpl {
             public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
                 super.onActivityResult(activity, requestCode, resultCode, data);
                 if (requestCode == PERMISSION_REQUEST_CODE) {
+                    // Guard against a duplicate onActivityResult dispatch. Some hosts (e.g.
+                    // react-native-navigation) forward the activity result to every registered
+                    // ActivityEventListener more than once, so this callback can fire twice for a
+                    // single getDisplayMedia() request. The first pass consumes displayMediaPromise;
+                    // a second pass would call reject()/resolve() on a null promise and crash.
+                    if (displayMediaPromise == null) {
+                        return;
+                    }
+
                     if (resultCode != Activity.RESULT_OK) {
                         displayMediaPromise.reject("DOMException", "NotAllowedError");
                         displayMediaPromise = null;
@@ -357,6 +366,14 @@ public void run() {
     }
 
     private void createScreenStream() {
+        // A duplicate onActivityResult dispatch (see onActivityResult above) can schedule this more
+        // than once. The single-threaded executor runs them in order, so by the time a duplicate
+        // runs the first has already consumed displayMediaPromise. Bail out instead of dereferencing
+        // a null promise or creating a second screen stream.
+        if (displayMediaPromise == null) {
+            return;
+        }
+
         VideoTrack track = createScreenTrack();
 
         if (track == null) {
```

---

### Incident Patch 6: `cf6101cd` (2026-07-21)
**Commit Message**: build(deps-dev): bump js-yaml from 4.2.0 to 4.3.0

Bumps [js-yaml](https://github.com/nodeca/js-yaml) from 4.2.0 to 4.3.0.
- [Changelog](https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md)
- [Commits](https://github.com/nodeca/js-yaml/compare/4.2.0...4.3.0)

---
updated-dependencies:
- dependency-name: js-yaml
  dependency-version: 4.3.0
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `package-lock.json` (modified, +6/-6)
```diff
@@ -4213,9 +4213,9 @@
       "dev": true
     },
     "node_modules/js-yaml": {
-      "version": "4.2.0",
-      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.2.0.tgz",
-      "integrity": "sha512-ePWsvanv0DWuDRsW8dnt+R4jQ31SCRCQ7hhNcPXZPsoBZiemuZNYGf7adZdqX2D86j6rvKp3RpCxVTSb8WQlOw==",
+      "version": "4.3.0",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.0.tgz",
+      "integrity": "sha512-1td788aAnnZ5qs7V2QIRl1owjtYpbKt749Y3xauqQgwIIGF/xXWz1wMTEBx5O3LK3lXLVuqXPdPxj2BoFHaW9Q==",
       "dev": true,
       "funding": [
         {
@@ -8780,9 +8780,9 @@
       "dev": true
     },
     "js-yaml": {
-      "version": "4.2.0",
-      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.2.0.tgz",
-      "integrity": "sha512-ePWsvanv0DWuDRsW8dnt+R4jQ31SCRCQ7hhNcPXZPsoBZiemuZNYGf7adZdqX2D86j6rvKp3RpCxVTSb8WQlOw==",
+      "version": "4.3.0",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.0.tgz",
+      "integrity": "sha512-1td788aAnnZ5qs7V2QIRl1owjtYpbKt749Y3xauqQgwIIGF/xXWz1wMTEBx5O3LK3lXLVuqXPdPxj2BoFHaW9Q==",
       "dev": true,
       "requires": {
         "argparse": "^2.0.1"
```

---

### Incident Patch 7: `78904d27` (2026-03-20)
**Commit Message**: android: fix race condition in getDisplayMedia

Fixes: https://github.com/react-native-webrtc/react-native-webrtc/issues/1799

**File**: `android/src/main/java/com/oney/WebRTCModule/AbstractVideoCaptureController.java` (modified, +5/-3)
```diff
@@ -1,5 +1,7 @@
 package com.oney.WebRTCModule;
 
+import android.util.Log;
+
 import androidx.annotation.Nullable;
 import androidx.core.util.Consumer;
 
@@ -10,6 +12,8 @@
 import org.webrtc.VideoCapturer;
 
 public abstract class AbstractVideoCaptureController {
+    private static final String TAG = AbstractVideoCaptureController.class.getSimpleName();
+
     protected int targetWidth;
     protected int targetHeight;
     protected int targetFps;
@@ -78,9 +82,7 @@ public void startCapture() {
         try {
             videoCapturer.startCapture(targetWidth, targetHeight, targetFps);
         } catch (RuntimeException e) {
-            // XXX This can only fail if we initialize the capturer incorrectly,
-            // which we don't. Thus, ignore any failures here since we trust
-            // ourselves.
+            Log.e(TAG, "Failed to start capture", e);
         }
     }
 
```

**File**: `android/src/main/java/com/oney/WebRTCModule/GetUserMediaImpl.java` (modified, +14/-4)
```diff
@@ -34,6 +34,7 @@
 import java.util.Map;
 import java.util.Objects;
 import java.util.UUID;
+import java.util.concurrent.TimeUnit;
 import java.util.stream.Collectors;
 
 /**
@@ -82,10 +83,19 @@ public void onActivityResult(Activity activity, int requestCode, int resultCode,
 
                     mediaProjectionPermissionResultData = data;
 
-                    ThreadUtils.runOnExecutor(() -> {
-                        MediaProjectionService.launch(activity);
-                        createScreenStream();
-                    });
+                    MediaProjectionService.launch(activity)
+                        .orTimeout(10, TimeUnit.SECONDS)
+                        .whenCompleteAsync((value, error) -> {
+                            if (error != null) {
+                                Log.e(TAG, "Failed to start MediaProjection service", error);
+                                displayMediaPromise.reject("DOMException", "AbortError");
+                                displayMediaPromise = null;
+                                mediaProjectionPermissionResultData = null;
+                                return;
+                            }
+
+                            createScreenStream();
+                        }, ThreadUtils.getExecutor());
                 }
             }
         });
```

**File**: `android/src/main/java/com/oney/WebRTCModule/MediaProjectionService.java` (modified, +24/-3)
```diff
@@ -11,6 +11,7 @@
 import android.util.Log;
 
 import java.util.Random;
+import java.util.concurrent.CompletableFuture;
 
 /**
  * This class implements an Android {@link Service}, a foreground one specifically, and it's
@@ -24,11 +25,17 @@ public class MediaProjectionService extends Service {
 
     static final int NOTIFICATION_ID = new Random().nextInt(99999) + 10000;
 
-    public static void launch(Context context) {
+    private static volatile CompletableFuture<Void> startFuture;
+
+    public static CompletableFuture<Void> launch(Context context) {
         if (!WebRTCModuleOptions.getInstance().enableMediaProjectionService) {
-            return;
+            return CompletableFuture.completedFuture(null);
         }
 
+        CompletableFuture<Void> future = new CompletableFuture<>();
+
+        startFuture = future;
+
         MediaProjectionNotification.createNotificationChannel(context);
         Intent intent = new Intent(context, MediaProjectionService.class);
         ComponentName componentName;
@@ -43,14 +50,21 @@ public static void launch(Context context) {
             // Avoid crashing due to ForegroundServiceStartNotAllowedException (API level 31).
             // See: https://developer.android.com/guide/components/foreground-services#background-start-restrictions
             Log.w(TAG, "Media projection service not started", e);
-            return;
+            startFuture = null;
+            future.completeExceptionally(e);
+
+            return future;
         }
 
         if (componentName == null) {
             Log.w(TAG, "Media projection service not started");
+            startFuture = null;
+            future.completeExceptionally(new RuntimeException("Media projection service not started"));
         } else {
             Log.i(TAG, "Media projection service started");
         }
+
+        return future;
     }
 
     public static void abort(Context context) {
@@ -77,6 +91,13 @@ public int onStartCommand(Intent intent, int flags, int startId) {
             startForeground(NOTIFICATION_ID, notification);
         }
 
+        CompletableFuture<Void> fut = startFuture;
+
+        if (fut != null) {
+            startFuture = null;
+            fut.complete(null);
+        }
+
         return START_NOT_STICKY;
     }
 }
```

**File**: `android/src/main/java/com/oney/WebRTCModule/ThreadUtils.java` (modified, +8/-0)
```diff
@@ -13,6 +13,14 @@ final class ThreadUtils {
      */
     private static final ExecutorService executor = Executors.newSingleThreadExecutor();
 
+    /**
+     * Gets the executor used to run all WebRTC PeerConnection APIs.
+     * @return ExecutorService.
+     */
+    public static ExecutorService getExecutor() {
+        return executor;
+    }
+
     /**
      * Runs the given {@link Runnable} on the executor.
      * @param runnable
```

---

### Incident Patch 8: `3537d389` (2026-07-05)
**Commit Message**: build(deps-dev): bump @babel/core in /examples/GumTestApp_macOS (#1817)

Bumps [@babel/core](https://github.com/babel/babel/tree/HEAD/packages/babel-core) from 7.12.8 to 7.29.6.
- [Release notes](https://github.com/babel/babel/releases)
- [Changelog](https://github.com/babel/babel/blob/main/CHANGELOG.md)
- [Commits](https://github.com/babel/babel/commits/v7.29.6/packages/babel-core)

---
updated-dependencies:
- dependency-name: "@babel/core"
  dependency-version: 7.29.6
  dependency-type: direct:development
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `examples/GumTestApp_macOS/package.json` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@
     "react-native-webrtc": "*"
   },
   "devDependencies": {
-    "@babel/core": "7.12.8",
+    "@babel/core": "7.29.6",
     "@babel/runtime": "7.12.5",
     "@react-native-community/eslint-config": "0.0.5",
     "babel-jest": "24.9.0",
```

---

### Incident Patch 9: `c4ea2d37` (2026-06-23)
**Commit Message**: build(deps-dev): bump js-yaml from 4.1.1 to 4.2.0 (#1818)

Bumps [js-yaml](https://github.com/nodeca/js-yaml) from 4.1.1 to 4.2.0.
- [Changelog](https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md)
- [Commits](https://github.com/nodeca/js-yaml/compare/4.1.1...4.2.0)

---
updated-dependencies:
- dependency-name: js-yaml
  dependency-version: 4.2.0
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `package-lock.json` (modified, +16/-6)
```diff
@@ -4213,10 +4213,20 @@
       "dev": true
     },
     "node_modules/js-yaml": {
-      "version": "4.1.1",
-      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.1.1.tgz",
-      "integrity": "sha512-qQKT4zQxXl8lLwBtHMWwaTcGfFOZviOJet3Oy/xmGk2gZH677CJM9EvtfdSkgWcATZhj/55JZ0rmy3myCT5lsA==",
+      "version": "4.2.0",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.2.0.tgz",
+      "integrity": "sha512-ePWsvanv0DWuDRsW8dnt+R4jQ31SCRCQ7hhNcPXZPsoBZiemuZNYGf7adZdqX2D86j6rvKp3RpCxVTSb8WQlOw==",
       "dev": true,
+      "funding": [
+        {
+          "type": "github",
+          "url": "https://github.com/sponsors/puzrin"
+        },
+        {
+          "type": "github",
+          "url": "https://github.com/sponsors/nodeca"
+        }
+      ],
       "dependencies": {
         "argparse": "^2.0.1"
       },
@@ -8770,9 +8780,9 @@
       "dev": true
     },
     "js-yaml": {
-      "version": "4.1.1",
-      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.1.1.tgz",
-      "integrity": "sha512-qQKT4zQxXl8lLwBtHMWwaTcGfFOZviOJet3Oy/xmGk2gZH677CJM9EvtfdSkgWcATZhj/55JZ0rmy3myCT5lsA==",
+      "version": "4.2.0",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.2.0.tgz",
+      "integrity": "sha512-ePWsvanv0DWuDRsW8dnt+R4jQ31SCRCQ7hhNcPXZPsoBZiemuZNYGf7adZdqX2D86j6rvKp3RpCxVTSb8WQlOw==",
       "dev": true,
       "requires": {
         "argparse": "^2.0.1"
```

---

### Incident Patch 10: `e5d87818` (2026-06-04)
**Commit Message**: ios: fix trigger broadcast picker on new arch

**File**: `ios/RCTWebRTC/ScreenCapturePickerViewManager.m` (modified, +22/-23)
```diff
@@ -1,6 +1,6 @@
 #if TARGET_OS_IOS
 
-#import <React/RCTUIManager.h>
+#import <React/RCTLog.h>
 #import <ReplayKit/ReplayKit.h>
 
 #import "ScreenCapturePickerViewManager.h"
@@ -30,29 +30,28 @@ - (NSString *)preferredExtension {
 }
 
 RCT_EXPORT_METHOD(show : (nonnull NSNumber *)reactTag) {
-    [self.bridge.uiManager
-        addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
-            id view = viewRegistry[reactTag];
-            if (![view isKindOfClass:[RPSystemBroadcastPickerView class]]) {
-                RCTLogError(@"Invalid view returned from registry, expecting "
-                            @"RPSystemBroadcastPickerView, got: %@",
-                            view);
-            } else {
-                // Simulate a click
-                UIButton *btn = nil;
-
-                for (UIView *subview in ((RPSystemBroadcastPickerView *)view).subviews) {
-                    if ([subview isKindOfClass:[UIButton class]]) {
-                        btn = (UIButton *)subview;
-                    }
-                }
-                if (btn != nil) {
-                    [btn sendActionsForControlEvents:UIControlEventTouchUpInside];
-                } else {
-                    RCTLogError(@"RPSystemBroadcastPickerView button not found");
-                }
+    dispatch_async(dispatch_get_main_queue(), ^{
+        RPSystemBroadcastPickerView *picker = self->_broadcastPickerView;
+        if (![picker isKindOfClass:[RPSystemBroadcastPickerView class]]) {
+            RCTLogError(@"Invalid broadcast picker view, expecting "
+                        @"RPSystemBroadcastPickerView, got: %@",
+                        picker);
+            return;
+        }
+
+        UIButton *btn = nil;
+
+        for (UIView *subview in picker.subviews) {
+            if ([subview isKindOfClass:[UIButton class]]) {
+                btn = (UIButton *)subview;
             }
-        }];
+        }
+        if (btn != nil) {
+            [btn sendActionsForControlEvents:UIControlEventTouchUpInside];
+        } else {
+            RCTLogError(@"RPSystemBroadcastPickerView button not found");
+        }
+    });
 }
 
 @end
```

---

### Incident Patch 11: `36554186` (2026-05-11)
**Commit Message**: fix: preserve facing mode in applyConstraints

**File**: `src/MediaStreamTrack.ts` (modified, +5/-0)
```diff
@@ -210,6 +210,11 @@ export default class MediaStreamTrack extends EventTarget<MediaStreamTrackEventM
             throw new Error('Only implemented for video tracks');
         }
 
+        // Preserve current facing mode when user doesn't specify one
+        if (constraints && !constraints?.facingMode && this._settings?.facingMode) {
+            constraints.facingMode = this._settings.facingMode;
+        }
+
         const normalized = normalizeConstraints({ video: constraints ?? true });
 
         this._settings = await WebRTCModule.mediaStreamTrackApplyConstraints(this.id, normalized.video);
```

---

### Incident Patch 12: `7f851d57` (2026-05-09)
**Commit Message**: build(deps-dev): bump js-yaml from 4.1.0 to 4.1.1 (#1773)

Bumps [js-yaml](https://github.com/nodeca/js-yaml) from 4.1.0 to 4.1.1.
- [Changelog](https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md)
- [Commits](https://github.com/nodeca/js-yaml/compare/4.1.0...4.1.1)

---
updated-dependencies:
- dependency-name: js-yaml
  dependency-version: 4.1.1
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `package-lock.json` (modified, +6/-6)
```diff
@@ -4213,9 +4213,9 @@
       "dev": true
     },
     "node_modules/js-yaml": {
-      "version": "4.1.0",
-      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.1.0.tgz",
-      "integrity": "sha512-wpxZs9NoxZaJESJGIZTyDEaYpl0FKSA+FB9aJiyemKhMwkxQg63h4T1KJgUGHpTqPDNRcmmYLugrRjJlBtWvRA==",
+      "version": "4.1.1",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.1.1.tgz",
+      "integrity": "sha512-qQKT4zQxXl8lLwBtHMWwaTcGfFOZviOJet3Oy/xmGk2gZH677CJM9EvtfdSkgWcATZhj/55JZ0rmy3myCT5lsA==",
       "dev": true,
       "dependencies": {
         "argparse": "^2.0.1"
@@ -8770,9 +8770,9 @@
       "dev": true
     },
     "js-yaml": {
-      "version": "4.1.0",
-      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.1.0.tgz",
-      "integrity": "sha512-wpxZs9NoxZaJESJGIZTyDEaYpl0FKSA+FB9aJiyemKhMwkxQg63h4T1KJgUGHpTqPDNRcmmYLugrRjJlBtWvRA==",
+      "version": "4.1.1",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.1.1.tgz",
+      "integrity": "sha512-qQKT4zQxXl8lLwBtHMWwaTcGfFOZviOJet3Oy/xmGk2gZH677CJM9EvtfdSkgWcATZhj/55JZ0rmy3myCT5lsA==",
       "dev": true,
       "requires": {
         "argparse": "^2.0.1"
```

---

### Incident Patch 13: `fdc47719` (2026-05-09)
**Commit Message**: build(deps-dev): bump @babel/plugin-transform-modules-systemjs (#1809)

Bumps [@babel/plugin-transform-modules-systemjs](https://github.com/babel/babel/tree/HEAD/packages/babel-plugin-transform-modules-systemjs) from 7.16.7 to 7.29.4.
- [Release notes](https://github.com/babel/babel/releases)
- [Changelog](https://github.com/babel/babel/blob/main/CHANGELOG.md)
- [Commits](https://github.com/babel/babel/commits/v7.29.4/packages/babel-plugin-transform-modules-systemjs)

---
updated-dependencies:
- dependency-name: "@babel/plugin-transform-modules-systemjs"
  dependency-version: 7.29.4
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `package-lock.json` (modified, +179/-379)
```diff
@@ -43,13 +43,14 @@
       }
     },
     "node_modules/@babel/code-frame": {
-      "version": "7.22.13",
-      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.22.13.tgz",
-      "integrity": "sha512-XktuhWlJ5g+3TJXc5upd9Ks1HutSArik6jf2eAjYFyIOf4ej3RN+184cZbzDvbPnuTJIUhPKKJE3cIsYTiAT3w==",
+      "version": "7.29.0",
+      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.29.0.tgz",
+      "integrity": "sha512-9NhCeYjq9+3uxgdtp20LSiJXJvN0FeCtNGpJxuMFZ1Kv3cWUNb6DOhJwUvcVCzKGR66cw4njwM6hrJLqgOwbcw==",
       "dev": true,
       "dependencies": {
-        "@babel/highlight": "^7.22.13",
-        "chalk": "^2.4.2"
+        "@babel/helper-validator-identifier": "^7.28.5",
+        "js-tokens": "^4.0.0",
+        "picocolors": "^1.1.1"
       },
       "engines": {
         "node": ">=6.9.0"
@@ -95,15 +96,16 @@
       }
     },
     "node_modules/@babel/generator": {
-      "version": "7.23.0",
-      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.23.0.tgz",
-      "integrity": "sha512-lN85QRR+5IbYrMWM6Y4pE/noaQtg4pNiqeNGX60eqOfo6gtEj6uw/JagelB8vVztSd7R6M5n1+PQkDbHbBRU4g==",
+      "version": "7.29.1",
+      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.29.1.tgz",
+      "integrity": "sha512-qsaF+9Qcm2Qv8SRIMMscAvG4O3lJ0F1GuMo5HR/Bp02LopNgnZBC/EkbevHFeGs4ls/oPz9v+Bsmzbkbe+0dUw==",
       "dev": true,
       "dependencies": {
-        "@babel/types": "^7.23.0",
-        "@jridgewell/gen-mapping": "^0.3.2",
-        "@jridgewell/trace-mapping": "^0.3.17",
-        "jsesc": "^2.5.1"
+        "@babel/parser": "^7.29.0",
+        "@babel/types": "^7.29.0",
+        "@jridgewell/gen-mapping": "^0.3.12",
+        "@jridgewell/trace-mapping": "^0.3.28",
+        "jsesc": "^3.0.2"
       },
       "engines": {
         "node": ">=6.9.0"
@@ -242,14 +244,11 @@
         "node": ">=6.9.0"
       }
     },
-    "node_modules/@babel/helper-hoist-variables": {
-      "version": "7.22.5",
-      "resolved": "https://registry.npmjs.org/@babel/helper-hoist-variables/-/helper-hoist-variables-7.22.5.tgz",
-      "integrity": "sha512-wGjk9QZVzvknA6yKIUURb8zY3grXCcOZt+/7Wcy8O2uctxhplmUPkOdlgoNhmdVee2c92JXbf1xpMtVNbfoxRw==",
+    "node_modules/@babel/helper-globals": {
+      "version": "7.28.0",
+      "resolved": "https://registry.npmjs.org/@babel/helper-globals/-/helper-globals-7.28.0.tgz",
+      "integrity": "sha512-+W6cISkXFa1jXsDEdYA8HeevQT/FULhxzR99pxphltZcVaugps53THCeiWA8SguxxpSp3gKPiuYfSWopkLQ4hw==",
       "dev": true,
-      "dependencies": {
-        "@babel/types": "^7.22.5"
-      },
       "engines": {
         "node": ">=6.9.0"
       }
@@ -267,34 +266,33 @@
       }
     },
     "node_modules/@babel/helper-module-imports": {
-      "version": "7.16.7",
-      "resolved": "https://registry.npmjs.org/@babel/helper-module-imports/-/helper-module-imports-7.16.7.tgz",
-      "integrity": "sha512-LVtS6TqjJHFc+nYeITRo6VLXve70xmq7wPhWTqDJusJEgGmkAACWwMiTNrvfoQo6hEhFwAIixNkvB0jPXDL8Wg==",
+      "version": "7.28.6",
+      "resolved": "https://registry.npmjs.org/@babel/helper-module-imports/-/helper-module-imports-7.28.6.tgz",
+      "integrity": "sha512-l5XkZK7r7wa9LucGw9LwZyyCUscb4x37JWTPz7swwFE/0FMQAGpiWUZn8u9DzkSBWEcK25jmvubfpw2dnAMdbw==",
       "dev": true,
       "dependencies": {
-        "@babel/types": "^7.16.7"
+        "@babel/traverse": "^7.28.6",
+        "@babel/types": "^7.28.6"
       },
       "engines": {
         "node": ">=6.9.0"
       }
     },
     "node_modules/@babel/helper-module-transforms": {
-      "version": "7.17.7",
-      "resolved": "https://registry.npmjs.org/@babel/helper-module-transforms/-/helper-module-transforms-7.17.7.tgz",
-      "integrity": "sha512-VmZD99F3gNTYB7fJRDTi+u6l/zxY0BE6OIxPSU7a50s6ZUQkHwSDmV92FfM+oCG0pZRVojGYhkR8I0OGeCVREw==",
+      "version": "7.28.6",
+      "resolved": "https://registry.npmjs.org/@babel/helper-module-transforms/-/helper-module-transforms-7.28.6.tgz",
+      "integrity": "sha512-67oXFAYr2cDLDVGLXTEABjdBJZ6drElUSI7WKp70NrpyISso3plG9SAGEF6y7zbha/wOzUByWWTJvEDVNIUGcA==",
       "dev": true,
       "dependencies": {
-        "@babel/helper-environment-visitor": "^7.16.7",
-        "@babel/helper-module-imports": "^7.16.7",
-        "@babel/helper-simple-access": "^7.17.7",
-        "@babel/helper-split-export-declaration": "^7.16.7",
-        "@babel/helper-validator-identifier": "^7.16.7",
-        "@babel/template": "^7.16.7",
-        "@babel/traverse": "^7.17.3",
-        "@babel/types": "^7.17.0"
+        "@babel/helper-module-imports": "^7.28.6",
+        "@babel/helper-validator-identifier": "^7.28.5",
+        "@babel/traverse": "^7.28.6"
       },
       "engines": {
         "node": ">=6.9.0"
+      },
+      "peerDependencies": {
+        "@babel/core": "^7.0.0"
       }
     },
     "node_modules/@babel/helper-optimise-call-expression": {
@@ -310,9 +308,9 @@
       }
     },
     "node_modules/@babel/helper-plugin-utils": {
-      "version": "7.1
```

---

### Incident Patch 14: `bc486dfc` (2026-04-30)
**Commit Message**: build(deps-dev): bump minimatch from 3.1.2 to 3.1.5 (#1791)

Bumps [minimatch](https://github.com/isaacs/minimatch) from 3.1.2 to 3.1.5.
- [Changelog](https://github.com/isaacs/minimatch/blob/main/changelog.md)
- [Commits](https://github.com/isaacs/minimatch/compare/v3.1.2...v3.1.5)

---
updated-dependencies:
- dependency-name: minimatch
  dependency-version: 3.1.5
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `package-lock.json` (modified, +6/-6)
```diff
@@ -4604,9 +4604,9 @@
       }
     },
     "node_modules/minimatch": {
-      "version": "3.1.2",
-      "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-3.1.2.tgz",
-      "integrity": "sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw==",
+      "version": "3.1.5",
+      "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-3.1.5.tgz",
+      "integrity": "sha512-VgjWUsnnT6n+NUk6eZq77zeFdpW2LWDzP6zFGrCbHXiYNul5Dzqk2HHQ5uFH2DNW5Xbp8+jVzaeNt94ssEEl4w==",
       "dev": true,
       "dependencies": {
         "brace-expansion": "^1.1.7"
@@ -9181,9 +9181,9 @@
       "dev": true
     },
     "minimatch": {
-      "version": "3.1.2",
-      "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-3.1.2.tgz",
-      "integrity": "sha512-J7p63hRiAjw1NDEww1W7i37+ByIrOWO5XQQAzZ3VOcL0PNybwpfmV/N05zFAzwQ9USyEcX6t3UO+K5aqBQOIHw==",
+      "version": "3.1.5",
+      "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-3.1.5.tgz",
+      "integrity": "sha512-VgjWUsnnT6n+NUk6eZq77zeFdpW2LWDzP6zFGrCbHXiYNul5Dzqk2HHQ5uFH2DNW5Xbp8+jVzaeNt94ssEEl4w==",
       "dev": true,
       "requires": {
         "brace-expansion": "^1.1.7"
```

---

### Incident Patch 15: `a243f5ea` (2026-03-25)
**Commit Message**: build(deps-dev): bump picomatch from 2.3.1 to 2.3.2

Bumps [picomatch](https://github.com/micromatch/picomatch) from 2.3.1 to 2.3.2.
- [Release notes](https://github.com/micromatch/picomatch/releases)
- [Changelog](https://github.com/micromatch/picomatch/blob/master/CHANGELOG.md)
- [Commits](https://github.com/micromatch/picomatch/compare/2.3.1...2.3.2)

---
updated-dependencies:
- dependency-name: picomatch
  dependency-version: 2.3.2
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `package-lock.json` (modified, +6/-6)
```diff
@@ -4877,9 +4877,9 @@
       "dev": true
     },
     "node_modules/picomatch": {
-      "version": "2.3.1",
-      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-2.3.1.tgz",
-      "integrity": "sha512-JU3teHTNjmE2VCGFzuY8EXzCDVwEqB2a8fsIvwaStHhAWJEeVd1o1QD80CU6+ZdEXXSLbSsuLwJjkCBWqRQUVA==",
+      "version": "2.3.2",
+      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-2.3.2.tgz",
+      "integrity": "sha512-V7+vQEJ06Z+c5tSye8S+nHUfI51xoXIXjHQ99cQtKUkQqqO1kO/KCJUfZXuB47h/YBlDhah2H3hdUGXn8ie0oA==",
       "dev": true,
       "engines": {
         "node": ">=8.6"
@@ -9379,9 +9379,9 @@
       "dev": true
     },
     "picomatch": {
-      "version": "2.3.1",
-      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-2.3.1.tgz",
-      "integrity": "sha512-JU3teHTNjmE2VCGFzuY8EXzCDVwEqB2a8fsIvwaStHhAWJEeVd1o1QD80CU6+ZdEXXSLbSsuLwJjkCBWqRQUVA==",
+      "version": "2.3.2",
+      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-2.3.2.tgz",
+      "integrity": "sha512-V7+vQEJ06Z+c5tSye8S+nHUfI51xoXIXjHQ99cQtKUkQqqO1kO/KCJUfZXuB47h/YBlDhah2H3hdUGXn8ie0oA==",
       "dev": true
     },
     "please-upgrade-node": {
```

#### Recent Merged Pull Requests:
- **PR #1839** (2026-09-10): build(deps-dev): bump js-yaml from 4.3.0 to 4.3.2 (@dependabot[bot])
- **PR #1837** (closed): docs: add architecture overview for new contributors (@nirajmatere)
- **PR #1836** (2026-09-03): build(deps-dev): bump browserslist from 4.24.3 to 4.28.8 (@dependabot[bot])
- **PR #1835** (2026-09-03): build(deps-dev): bump brace-expansion from 1.1.11 to 1.1.18 (@dependabot[bot])
- **PR #1833** (closed): build(deps-dev): bump js-yaml from 4.3.0 to 4.3.1 (@dependabot[bot])
- **PR #1831** (2026-08-04): build: ship the vendored declarations in the typescript build (@saghul)
- **PR #1829** (2026-07-31): fix(android): guard against duplicate onActivityResult crash in screen capture (@harcorp)
- **PR #1828** (2026-07-30): android: fix frame leak with multiple video processors (@HanSeonWoo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
