# Forensic Learning Record (Deep Inspection): react-native-webrtc/react-native-webrtc

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-native-webrtc-react-native-webrtc-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react-native-webrtc/react-native-webrtc](https://github.com/react-native-webrtc/react-native-webrtc))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:29:32.588Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react-native-webrtc/react-native-webrtc`
- **Description**: The WebRTC module for React Native
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4994 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

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

### Incident Patch 1: `8f5428a2` (2026-09-03)
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

Signed-off-by: dependabot[bot] <support@github.com>
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

### Incident Patch 2: `78d3094d` (2026-07-29)
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

### Incident Patch 3: `78904d27` (2026-03-20)
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

### Incident Patch 4: `e5d87818` (2026-06-04)
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

### Incident Patch 5: `36554186` (2026-05-11)
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

### Incident Patch 6: `5ba65ceb` (2025-10-27)
**Commit Message**: android: fix ANR in getVideoTrackForStreamURL

We need to get the video track in the executor to make sure all
operations are serialized, but rather than blocking the UI thread to
wait for the result, post the result back to the UI thread after we get
it.

**File**: `android/src/main/java/com/oney/WebRTCModule/WebRTCModule.java` (modified, +13/-23)
```diff
@@ -395,33 +395,23 @@ public boolean peerConnectionInit(ReadableMap configuration, int id) {
         }
     }
 
+    // Must be called in the executor.
     MediaStream getStreamForReactTag(String streamReactTag) {
-        // This function _only_ gets called from WebRTCView, in the UI thread.
-        // Hence make sure we run this code in the executor or we run at the risk
-        // of being out of sync.
-        try {
-            return (MediaStream) ThreadUtils
-                    .submitToExecutor((Callable<Object>) () -> {
-                        MediaStream stream = localStreams.get(streamReactTag);
-
-                        if (stream != null) {
-                            return stream;
-                        }
+        MediaStream stream = localStreams.get(streamReactTag);
 
-                        for (int i = 0, size = mPeerConnectionObservers.size(); i < size; i++) {
-                            PeerConnectionObserver pco = mPeerConnectionObservers.valueAt(i);
-                            stream = pco.remoteStreams.get(streamReactTag);
-                            if (stream != null) {
-                                return stream;
-                            }
-                        }
+        if (stream != null) {
+            return stream;
+        }
 
-                        return null;
-                    })
-                    .get();
-        } catch (ExecutionException | InterruptedException e) {
-            return null;
+        for (int i = 0, size = mPeerConnectionObservers.size(); i < size; i++) {
+            PeerConnectionObserver pco = mPeerConnectionObservers.valueAt(i);
+            stream = pco.remoteStreams.get(streamReactTag);
+            if (stream != null) {
+                return stream;
+            }
         }
+
+        return null;
     }
 
     public MediaStreamTrack getTrack(int pcId, String trackId) {
```

**File**: `android/src/main/java/com/oney/WebRTCModule/WebRTCView.java` (modified, +56/-28)
```diff
@@ -173,28 +173,53 @@ private void cleanSurfaceViewRenderer() {
         surfaceViewRenderer.clearImage();
     }
 
-    private VideoTrack getVideoTrackForStreamURL(String streamURL) {
-        VideoTrack videoTrack = null;
+    /**
+     * Asynchronously retrieves the VideoTrack for the given streamURL.
+     * This method avoids blocking the UI thread by performing the lookup
+     * on the WebRTC executor thread and posting the result back to the UI thread.
+     *
+     * @param streamURL The stream URL to lookup
+     * @param callback Callback invoked on UI thread with the VideoTrack (or null if not found)
+     */
+    private void getVideoTrackForStreamURL(String streamURL, java.util.function.Consumer<VideoTrack> callback) {
+        if (streamURL == null) {
+            callback.accept(null);
+            return;
+        }
 
-        if (streamURL != null) {
-            ReactContext reactContext = (ReactContext) getContext();
-            WebRTCModule module = reactContext.getNativeModule(WebRTCModule.class);
-            MediaStream stream = module.getStreamForReactTag(streamURL);
+        ReactContext reactContext = (ReactContext) getContext();
+        WebRTCModule module = reactContext.getNativeModule(WebRTCModule.class);
 
-            if (stream != null) {
-                List<VideoTrack> videoTracks = stream.videoTracks;
+        // Submit lookup to executor thread to avoid blocking UI thread
+        ThreadUtils.runOnExecutor(() -> {
+            try {
+                MediaStream stream = module.getStreamForReactTag(streamURL);
+                if (stream == null) {
+                    Log.w(TAG, "Stream not found for URL: " + streamURL);
+                    post(() -> callback.accept(null));
+                    return;
+                }
 
+                VideoTrack videoTrack = null;
+                List<VideoTrack> videoTracks = stream.videoTracks;
                 if (!videoTracks.isEmpty()) {
                     videoTrack = videoTracks.get(0);
                 }
-            }
 
-            if (videoTrack == null) {
-                Log.w(TAG, "No video stream for react tag: " + streamURL);
-            }
-        }
+                if (videoTrack == null) {
+                    Log.w(TAG, "No video stream for react tag: " + streamURL);
+                    post(() -> callback.accept(null));
+                    return;
+                }
 
-        return videoTrack;
+                // Post result back to UI thread
+                final VideoTrack result = videoTrack;
+                post(() -> callback.accept(result));
+            } catch (Throwable tr) {
+                Log.e(TAG, "Error getting video track for stream URL: " + streamURL, tr);
+                post(() -> callback.accept(null));
+            }
+        });
     }
 
     @Override
@@ -452,20 +477,23 @@ private void setScalingType(ScalingType scalingType) {
      * this {@code WebRTCView} or {@code null}.
      */
     void setStreamURL(String streamURL) {
-        // Is the value of this.streamURL really changing?
-        if (!Objects.equals(streamURL, this.streamURL)) {
-            // XXX The value of this.streamURL is really changing. Before
-            // realizing/applying the change, let go of the old videoTrack. Of
-            // course, that is only necessary if the value of videoTrack will
-            // really change. Please note though that letting go of the old
-            // videoTrack before assigning to this.streamURL is vital;
-            // otherwise, removeRendererFromVideoTrack will fail to remove the
-            // old videoTrack from the associated videoRenderer, two
-            // VideoTracks (the old and the new) may start rendering and, most
-            // importantly the videoRender may eventually crash when the old
-            // videoTrack is disposed.
-            VideoTrack videoTrack = getVideoTrackForStreamURL(streamURL);
+        Log.d(TAG, "Set stream URL " + streamURL + " curre
```

---

### Incident Patch 7: `503ec7f4` (2025-10-07)
**Commit Message**: ios: fix crash in iOS 26 simulator

**File**: `ios/RCTWebRTC/WebRTCModule+RTCMediaStream.m` (modified, +7/-0)
```diff
@@ -296,6 +296,9 @@ - (RTCVideoTrack *)createScreenCaptureVideoTrack {
                                                                mediaType:AVMediaTypeVideo
                                                                 position:AVCaptureDevicePositionUnspecified];
     for (AVCaptureDevice *device in videoDevicesSession.devices) {
+        if (device.uniqueID == nil) {
+            continue;
+        }
         NSString *position = @"unknown";
         if (device.position == AVCaptureDevicePositionBack) {
             position = @"environment";
@@ -315,11 +318,15 @@ - (RTCVideoTrack *)createScreenCaptureVideoTrack {
             @"kind" : @"videoinput",
         }];
     }
+
     AVCaptureDeviceDiscoverySession *audioDevicesSession =
         [AVCaptureDeviceDiscoverySession discoverySessionWithDeviceTypes:@[ AVCaptureDeviceTypeBuiltInMicrophone ]
                                                                mediaType:AVMediaTypeAudio
                                                                 position:AVCaptureDevicePositionUnspecified];
     for (AVCaptureDevice *device in audioDevicesSession.devices) {
+        if (device.uniqueID == nil) {
+            continue;
+        }
         NSString *label = @"Unknown audio device";
         if (device.localizedName != nil) {
             label = device.localizedName;
```

---

### Incident Patch 8: `0ab26cbd` (2025-09-05)
**Commit Message**: fix: typo in _validatePermissionDescriptor method name

**File**: `src/Permissions.ts` (modified, +3/-3)
```diff
@@ -55,7 +55,7 @@ class Permissions {
     /**
      * Validates the given permission descriptor.
      */
-    _validatePermissionDescriptior(permissionDesc) {
+    _validatePermissionDescriptor(permissionDesc) {
         if (typeof permissionDesc !== 'object') {
             throw new TypeError('Argument 1 of Permissions.query is not an object.');
         }
@@ -77,7 +77,7 @@ class Permissions {
      */
     query(permissionDesc: PermissionDescriptor) {
         try {
-            this._validatePermissionDescriptior(permissionDesc);
+            this._validatePermissionDescriptor(permissionDesc);
         } catch (e) {
             return Promise.reject(e);
         }
@@ -107,7 +107,7 @@ class Permissions {
      */
     request(permissionDesc: PermissionDescriptor) {
         try {
-            this._validatePermissionDescriptior(permissionDesc);
+            this._validatePermissionDescriptor(permissionDesc);
         } catch (e) {
             return Promise.reject(e);
         }
```

---

### Incident Patch 9: `de82ad32` (2025-08-06)
**Commit Message**: android: fix NPE in gUM

As unlikely as it seems, we are observing this on Crashlytics:

```
          Fatal Exception: java.lang.NullPointerException: Attempt to invoke virtual method 'java.lang.Object android.content.Context.getSystemService(java.lang.String)' on a null object reference
       at com.oney.WebRTCModule.CameraCaptureController.createVideoCapturer(CameraCaptureController.java:103)
       at com.oney.WebRTCModule.AbstractVideoCaptureController.initializeVideoCapturer(AbstractVideoCaptureController.java)
       at com.oney.WebRTCModule.GetUserMediaImpl.createVideoTrack(GetUserMediaImpl.java)
       at com.oney.WebRTCModule.GetUserMediaImpl.getUserMedia(GetUserMediaImpl.java:197)
       at com.oney.WebRTCModule.WebRTCModule.lambda$getUserMedia$11(WebRTCModule.java:777)
       at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1145)
       at java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:644)
       at java.lang.Thread.run(Thread.java:1012)
```

**File**: `android/src/main/java/com/oney/WebRTCModule/GetUserMediaImpl.java` (modified, +7/-1)
```diff
@@ -196,8 +196,14 @@ void getUserMedia(final ReadableMap constraints, final Callback successCallback,
 
             Log.d(TAG, "getUserMedia(video): " + videoConstraintsMap);
 
+            Activity currentActivity = this.reactContext.getCurrentActivity();
+            if (currentActivity == null) {
+                errorCallback.invoke("Error", "No current Activity.");
+                return;
+            }
+
             CameraCaptureController cameraCaptureController = new CameraCaptureController(
-                    reactContext.getCurrentActivity(), getCameraEnumerator(), videoConstraintsMap);
+                    currentActivity, getCameraEnumerator(), videoConstraintsMap);
 
             videoTrack = createVideoTrack(cameraCaptureController);
         }
```

---

### Incident Patch 10: `f515ee55` (2025-07-23)
**Commit Message**: fix(android): Compatibility with RN 0.80+

**File**: `android/src/main/java/com/oney/WebRTCModule/WebRTCModule.java` (modified, +2/-1)
```diff
@@ -706,7 +706,7 @@ public void transceiverSetDirection(int id, String senderId, String direction, P
     }
 
     @ReactMethod(isBlockingSynchronousMethod = true)
-    public void transceiverSetCodecPreferences(int id, String senderId, ReadableArray codecPreferences) {
+    public boolean transceiverSetCodecPreferences(int id, String senderId, ReadableArray codecPreferences) {
         ThreadUtils.runOnExecutor(() -> {
             WritableMap identifier = Arguments.createMap();
             WritableMap params = Arguments.createMap();
@@ -765,6 +765,7 @@ public void transceiverSetCodecPreferences(int id, String senderId, ReadableArra
                 Log.d(TAG, "transceiverSetCodecPreferences(): " + e.getMessage());
             }
         });
+        return true;
     }
 
     @ReactMethod
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
