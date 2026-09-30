# Forensic Learning Record (Deep Inspection): DylanVann/react-native-fast-image

> **Canonical Artifact**: `07_PROJECT_LEARNING/dylanvann-react-native-fast-image-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/DylanVann/react-native-fast-image](https://github.com/DylanVann/react-native-fast-image))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:48:54.156Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `DylanVann/react-native-fast-image`
- **Description**: Performant React Native image component.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8411 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1077** (2026-09-24): **can anyone add support for React 19, i don't want to ruin my package.json with peer deps**
  *Symptoms*: **Describe the bug** A clear and concise description of what the bug is.  **To Reproduce** Steps to reproduce the behavior if possible, or a link to a reproduction repo: 1. Go to '...' 2. Click on '....' 3. Scroll down to '....' 4. See error  **Expected behavior** A clear and concise description of what you expected to happen.  **Screenshots** If applicable, add screenshots to help explain your problem.  **Dependency versions**  - React Native version: - React version: - React Native Fast Image version:  **Note:** if these are not the latest versions of each I recommend updating as extra effort will not be taken to be backwards compatible, and updating might resolving your issue. 
  **Post-Mortem & Fix Analysis**:
  > +1
  > I updated my RN version from 0.76.5 to 0.79.0. At the time, we installed React 19 as the default supported React version. From that point on, react-native-fast-image has been triggering issues with peer dependencies.  Steps to reproduce:  Update your RN version to greater than 0.78 You have the react-native-fast-image package. Try to update a third-party SDK or any other dependency   Dependency versions React Native version: 0.79.0 React version: 19 React Native Fast Image version: 8.6.3
  > Ran into the same issue, is there any alternative package you've found for this issue?

- **Issue #1069** (2025-07-21): **Tried to access a JS module before the React instance was fully set up.**
  *Symptoms*: Hi everyone,  I've been trying to fix this issue but nothing work.  Tried to access a JS module before the React instance was fully set up. Calls to ReactContext#getJSModule should only happen once initialize() has been called on your native module. 07-21 11:53:22.790 19288 19373 E AndroidRuntime: at com.facebook.react.bridge.BridgeReactContext.getJSModule(BridgeReactContext.java:106) 07-21 11:53:22.790 19288 19373 E AndroidRuntime: at com.mrousavy.camera.react.CameraDevicesManager.sendAvailableDevicesChangedEvent(CameraDevicesManager.kt:102) 07-21 11:53:22.790 19288 19373 E AndroidRuntime: at com.mrousavy.camera.react.CameraDevicesManager<span>1.invokeSuspend(CameraDevicesManager.kt:74) 07-21 11:53:22.790 19288 19373 E AndroidRuntime: at kotlin.coroutines.jvm.internal.BaseContinuationImpl.resumeWith(ContinuationImpl.kt:33) 07-21 11:53:22.790 19288 19373 E AndroidRuntime: at kotlinx.coroutines.DispatchedTask.run(DispatchedTask.kt:101) 07-21 11:53:22.790 19288 19373 E AndroidRuntime: at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1145) 07-21 11:53:22.790 19288 19373 E AndroidRuntime: at java.util.concurrent.ThreadPoolExecutor</span>Worker.run(ThreadPoolExecutor.java:644) 07-21 11:53:22.790 19288 19373 E AndroidRuntime: at java.lang.Thread.run(Thread.java:1012) 07-21 11:53:22.790 19288 19373 E AndroidRuntime: Suppressed: kotlinx.coroutines.internal.DiagnosticCoroutineContextException: [StandaloneCoroutine{Cancelling}@89dd266, java.util.concurrent.T

- **Issue #1068** (2026-09-25): **Doesn't support asset:/ on Android**
  *Symptoms*: **Describe the bug** On Android, files inside `android/app/src/main/assets` directory are usually accessed via `assets:/` but they don't work with FastImage.  Local images don't show at all for me on release builds so the only way I can access them is by using the assets directory.  To be honest if anyone can help me solve why release versions aren't showing images - that'd be a huge help too. But this is still a bug!  **To Reproduce** Steps to reproduce the behavior if possible, or a link to a reproduction repo: 1. Add a file to `android/app/src/main/assets` 2. Add <FastImage source={{uri: 'assets:/myfile.png'}} /> 3. See no image and logcat error `java.lang.IllegalArgumentException: Expected URL scheme 'http' or 'https' but was 'asset'`  **Expected behavior** It should show the image, like the native image component does  **Screenshots** If applicable, add screenshots to help explain your problem.  **Dependency versions**  - React Native version: 0.76.5 - React version: 18.3.1 - React Native Fast Image version: 8.9.2  **Note:** if these are not the latest versions of each I recommend updating as extra effort will not be taken to be backwards compatible, and updating might resolving your issue. 
  **Post-Mortem & Fix Analysis**:
  > @JamesMahy This repo is not actively maintained, you can try out [@d11/react-native-fast-image](https://github.com/dream-sports-labs/react-native-fast-image) which is actively maintained.
  > :tada: This issue has been resolved in version 8.6.30 :tada:  The release is available on [GitHub release](https://github.com/DylanVann/react-native-fast-image/releases/tag/v8.6.30)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #1065** (2026-09-24): **Broken BUILD STATUS badge in README**
  *Symptoms*: SCREENSHOT-  ![Image](https://github.com/user-attachments/assets/49b7365b-3eb9-4274-950c-5bc4b9c68af8)
  **Post-Mortem & Fix Analysis**:
  > :tada: This issue has been resolved in version 8.6.13 :tada:  The release is available on [GitHub release](https://github.com/DylanVann/react-native-fast-image/releases/tag/v8.6.13)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #1058** (2025-11-06): **error load image on IOS**
  *Symptoms*: react-native-fast-image 8.6.3.  react-native: 0.70.13 if i exit the app and re-enter it works The problem here is that I was using it normally and then it suddenly got an error even though I didn't update anything.
  **Post-Mortem & Fix Analysis**:
  > is there any update?
  > no. i switched to https://github.com/candlefinance/faster-image. base performance is almost same as fast image  > is there any update?  

- **Issue #1054** (2024-10-24): **Warning: TypeError: Cannot read property 'bubblingEventTypes' of null**
  *Symptoms*: **Describe the bug** Warning: TypeError: Cannot read property 'bubblingEventTypes' of null  **Dependency versions**  - React Native version: 0.75.4 - React version: 18.3.1 - React Native Fast Image version: ^8.6.3  **Note:** if these are not the latest versions of each I recommend updating as extra effort will not be taken to be backwards compatible, and updating might resolving your issue. 
  **Post-Mortem & Fix Analysis**:
  > I also encountered this issue, but reopening my emulators fixed it.Try closing and opening your simulator and android emulator.
  > I encountered same issue with same version, Solution -  1. delete node module and reinstall it 2. cd android && ./gradlew clean 3. npm run android  <-- this is the main step
  > @mlcpro You've closed the issue. How have you solved the problem ?

- **Issue #1052** (2026-09-25): **Error load image in android**
  *Symptoms*: Preview: ![Untitled](https://github.com/user-attachments/assets/1655dc60-78a0-4a56-9f6f-c9962d6b7aa3) Log: ![Untitled](https://github.com/user-attachments/assets/59c68da4-c672-446c-9d0c-5287dfd84df6)     "react-native": "0.70.6",     "react-native-fast-image": "^8.6.3",  Code:   ![image](https://github.com/user-attachments/assets/a07f1d69-a235-44ff-b315-08b2df2f8052) Description: When I download the app for the first time on Android devices with low or average configurations, this issue occurs. Even on the Android Studio emulator, I experience the same problem. It loads for a while but remains the same.""When I download the app for the first time on Android devices with low or average configurations (v9 ,10, 11), this issue occurs. Even on the Android Studio emulator (v12 13 14), I experience the same problem. It loads for a while but remains the same.  Thank you !  
  **Post-Mortem & Fix Analysis**:
  > i have same problem However if I trigger a state update on purpose during the image load ``` onLoadStart={() => {         setReRender(true); }} ``` it draw image well here's my component   ```import {useEffect, useState} from 'react'; import {Image, Platform} from 'react-native'; import FastImage, {FastImageProps} from 'react-native-fast-image'; import etcApiController from '../../api/controller/etc';  const CustomFastImage = (props: FastImageProps) => {   if (!props?.source) {     return;   }   if (Platform.OS === 'ios') {     return <FastImage {...props} />;   }   let source = null;   if (typeof props.source !== 'string') {     source = {       uri: Image.resolveAssetSource(props.source as any).uri,     };   } else {     source = props.source;   }   const _props = {     ...props,     source,   };    const [reRender, setReRender] = useState(false);    return (     <FastImage       onLoadStart={() => {         setReRender(true);       }}       
  > Closing as a duplicate of #974, which tracks remote images in lists not loading on Android.

- **Issue #1044** (2026-09-24): **When fallback is set to true, images cannot be imported using require.**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > There's also a new alternative, Faster Image, https://github.com/candlefinance/faster-image
  > :tada: This issue has been resolved in version 8.6.17 :tada:  The release is available on [GitHub release](https://github.com/DylanVann/react-native-fast-image/releases/tag/v8.6.17)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:
  > Fixed in 8.6.17 (#1101): with `fallback`, a `require()`d source is now passed to `Image` as is, so it loads again. Please open a new issue if you still see this on the latest version.

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

### Incident Patch 1: `64743cfe` (2026-09-30)
**Commit Message**: fix(ios): tint images with the view's tintColor, and tint animated images' frames (#1195)

**File**: `ReactNativeFastImageExample/src/RegressionExample.tsx` (modified, +101/-0)
```diff
@@ -1048,6 +1048,77 @@ function KeepPreviousCase({
     )
 }
 
+const GREEN = '#008000'
+
+// Tint over time (a video sample, see RunnerContext.tsx): shows an image
+// tinted green (a GIF paused on its first frame), then, while the screen is
+// recorded, plays the GIF, changes the tint to cyan, or removes it.
+// blink-once.gif plays once: opaque (magenta), transparent, opaque, 400 ms
+// each, so tinted it goes green, blank, green (iOS showed its first frame
+// tinted, without playing it).
+function TintSampleCase({
+    id,
+    uri,
+    change,
+    expect,
+    description,
+}: {
+    id: string
+    uri: string
+    change: 'play' | 'recolor' | 'clear'
+    expect: string[]
+    description: string
+}) {
+    const sample = useContext(SampleContext)
+    const view = useRef<React.ComponentRef<typeof View>>(null)
+    const started = useRef(false)
+    const [changed, setChanged] = useState(false)
+    const [status, setStatus] = useState('loading')
+    const onLoad = async () => {
+        if (started.current) return
+        started.current = true
+        const area = await measureView(view.current)
+        if (!area) return setStatus('not on screen')
+        setStatus('recording')
+        const result = await sample(
+            {
+                name: id,
+                area,
+                durationMs: 4000,
+                expect,
+                palette: [GREEN, CYAN, MAGENTA, BLANK],
+            },
+            (done) => {
+                setChanged(true)
+                // The GIF takes 1.2 s to play.
+                setTimeout(done, change === 'play' ? 2000 : 500)
+            },
+        )
+        setStatus(sampleStatus(result, expect))
+    }
+    const tintColor = !changed
+        ? GREEN
+        : change === 'recolor'
+          ? CYAN
+          : change === 'clear'
+            ? undefined
+            : GREEN
+    return (
+        <View style={styles.row}>
+            <View ref={view} collapsable={false}>
+                <FastImage
+                    style={styles.image}
+                    source={{ uri: imageUrl(`${uri}?${id}=${RUN}`) }}
+                    tintColor={tintColor}
+                    paused={!(changed && change === 'play')}
+                    onLoad={onLoad}
+                />
+            </View>
+            <CaseStatus id={id} status={status} description={description} />
+        </View>
+    )
+}
+
 // Clears the source while a slow image (cyan) is still loading. The load is
 // cancelled: no onLoad, and the view stays blank (on Android the load kept
 // going, and showed the image when it finished).
@@ -3200,6 +3271,36 @@ export const REGRESSION_GROUPS: RegressionGroup[] = [
             />,
         ],
     },
+    {
+        // Recorded (video samples).
+        name: 'tint',
+        cases: [
+            <TintSampleCase
+                key="tint-gif"
+                id="tint-gif"
+                uri="blink-once.gif"
+                change="play"
+                expect={[GREEN, BLANK, GREEN]}
+                description="A tinted GIF plays, tinted (recorded: green, blank, green)"
+            />,
+            <TintSampleCase
+                key="tint-change"
+                id="tint-change"
+                uri="magenta.png"
+                change="recolor"
+                expect={[GREEN, CYAN]}
+                description="tintColor changed after load (recorded: green, then cyan)"
+            />,
+            <TintSampleCase
+                key="tint-gif-clear"
+                id="tint-gif-clear"
+                uri="blink-once.gif"
+                change="clear"
+                expect={[GREEN, MAGENTA]}
+                description="tintColor removed from a paused GIF (recorded: green, then its magenta first frame)"
+            />,
+        ],
+    },
     {
         name: 'image-background',
         cases: [<ImageBackgroundCase key="image-background" />],
```

**File**: `ios/FastImage/FFFastImageView.m` (modified, +37/-39)
```diff
@@ -3,6 +3,7 @@
 #import <SDWebImage/UIView+WebCache.h>
 #import <React/RCTUtils.h>
 #import <SDWebImage/SDWebImageError.h>
+#import <SDWebImage/SDImageTransformer.h>
 #import "FFFDownsampledImage.h"
 
 @interface FFFastImageView ()
@@ -58,6 +59,9 @@ - (id) init {
     self = [super init];
     self.resizeMode = RCTResizeModeCover;
     self.clipsToBounds = YES;
+    // The tint (tintColor) stays as it is while an alert or sheet is shown,
+    // rather than dimming like the system's controls.
+    self.tintAdjustmentMode = UIViewTintAdjustmentModeNormal;
     _loopCount = -1;
     return self;
 }
@@ -197,53 +201,47 @@ - (void) setImageColor: (UIColor*)imageColor {
     // Re-apply to the untinted image, so the tint can change or be removed.
     UIImage* image = self.untintedImage ?: super.image;
     if (image) {
+        // SDAnimatedImageView ignores the image it already shows, which would
+        // keep an animated image's frames as they were tinted.
+        super.image = nil;
         [self setImage: image];
     }
 }
 
-- (UIImage*) makeImage: (UIImage*)image withTint: (UIColor*)color {
-    // FIX: Prevent crash on zero/invalid image dimensions
-    if (!image || image.size.width <= 0 || image.size.height <= 0) {
-        return image;
-    }
-
-    UIImage* templateImage = [image imageWithRenderingMode: UIImageRenderingModeAlwaysTemplate];
-    CGRect rect = CGRectMake(0, 0, image.size.width, image.size.height);
-    UIImage* newImage;
-    if (@available(iOS 10.0, tvOS 10.0, *)) {
-        // UIGraphicsBeginImageContextWithOptions is deprecated since iOS 17.
-        // Keep the source image's scale and a standard-range (8-bit) bitmap,
-        // matching what it produced.
-        UIGraphicsImageRendererFormat* format = [[UIGraphicsImageRendererFormat alloc] init];
-        format.scale = image.scale;
-        format.opaque = NO;
-        if (@available(iOS 12.0, tvOS 12.0, *)) {
-            format.preferredRange = UIGraphicsImageRendererFormatRangeStandard;
-        } else {
-            format.prefersExtendedRange = NO;
-        }
-        UIGraphicsImageRenderer* renderer = [[UIGraphicsImageRenderer alloc] initWithSize: image.size format: format];
-        newImage = [renderer imageWithActions: ^(UIGraphicsImageRendererContext* context) {
-            [color set];
-            [templateImage drawInRect: rect];
-        }];
-    } else {
-        // iOS/tvOS 9. Remove this branch once the minimum is iOS 10+.
-        UIGraphicsBeginImageContextWithOptions(image.size, NO, image.scale);
-        [color set];
-        [templateImage drawInRect: rect];
-        newImage = UIGraphicsGetImageFromCurrentImageContext();
-        UIGraphicsEndImageContext();
-    }
-    return newImage;
+// Whether SDAnimatedImageView can tint the frames of an animated image as
+// they're decoded (animationTransformer, SDWebImage 5.20+).
+- (BOOL) tintsFrames {
+    return [self respondsToSelector: @selector(setAnimationTransformer:)];
 }
 
 - (void) setImage: (UIImage*)image {
-    if (self.imageColor != nil) {
-        self.untintedImage = image;
-        super.image = [self makeImage: image withTint: self.imageColor];
+    // Tinted as React Native's Image does it: UIKit draws a template image in
+    // the view's tintColor, so no tinted copy of the image is made.
+    // SDAnimatedImageView draws the frames of an animated image itself,
+    // without the tint, so each frame is tinted as it's decoded (source-in,
+    // as the template is), or, before SDWebImage 5.20, the first frame shows.
+    UIColor* tint = image ? self.imageColor : nil;
+    BOOL animated = [image conformsToProtocol: @protocol(SDAnimatedImage)] && [(id<SDAnimatedImage>)image animatedImageFrameCount] > 1;
+    self.untintedImage = tint ? image : nil;
+    self.tintColor = tint;
+    if ([self tintsFrames]) {
+        [self setValue: tint && animated ? [SDImageTintTransformer transformerWithColor: tint] : nil forKey: @"animationTransformer"];
+    }
+    if (
```

---

### Incident Patch 2: `9c38246b` (2026-09-30)
**Commit Message**: docs: rewrite the caching guide and fix stale cache docs (#1184)

**File**: `README.md` (modified, +3/-1)
```diff
@@ -125,8 +125,10 @@ Indicates the load order priority of an image. Images with `FastImage.priority.h
 
 ### `source.cache?: enum`
 
+How fresh the image must be. See [how caching is handled](docs/how-is-caching-handled.md) for how the options fit together.
+
 - `FastImage.cacheControl.immutable` - **(Default)** - Only updates if url changes.
-- `FastImage.cacheControl.web` - Use headers and follow normal caching procedures. On Android these responses are kept in a 50 MB HTTP cache (or the app's own, if its OkHttp client has one).
+- `FastImage.cacheControl.web` - Use headers and follow normal caching procedures. These responses are kept in their own HTTP cache (50 MB on each platform), which `clearDiskCache` also clears.
 - `FastImage.cacheControl.cacheOnly` - Only show images from cache, do not make any network requests.
 
 ---
```

**File**: `docs/app-glide-module.md` (modified, +9/-0)
```diff
@@ -10,3 +10,12 @@ project.ext {
     excludeAppGlideModule = true
 }
 ```
+
+Your `AppGlideModule` then sets Glide's cache sizes too: FastImage's `maxDiskSize` (from the manifest, the Expo plugin or `FastImage.configureCache`) isn't applied on Android, since FastImage applies it in its own module. Set the disk cache size in your module's `applyOptions`, as described in [Glide's configuration docs](https://bumptech.github.io/glide/doc/configuration.html):
+
+```java
+@Override
+public void applyOptions(@NonNull Context context, @NonNull GlideBuilder builder) {
+    builder.setDiskCache(new InternalCacheDiskCacheFactory(context, 200 * 1024 * 1024));
+}
+```
```

**File**: `docs/how-is-caching-handled.md` (modified, +32/-17)
```diff
@@ -1,28 +1,43 @@
 # How is caching handled?
 
-In the readme it says "Aggressively cache images.". What does this mean?
+FastImage keeps the images it downloads, so an image it has shown before shows again without being downloaded. This page explains how, and how to control it. Each function and option is described in the [README](../README.md).
 
-This library treats image urls as immutable.
-That means it assumes the data located at a given url will not change.
-This is ideal for performance.
+## Where images are kept
 
-The way this would work in practice for something like a user profile picture is:
+|                                                  | iOS (SDWebImage)                                                                                                     | Android (Glide)                                                                                                |
+| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
+| **Memory**: decoded images, shown at once        | No limit by default; emptied when the system is low on memory.                                                       | Sized from the screen. Images are kept at the size a view shows them, so a view of another size decodes again. |
+| **Disk**: the downloaded files                   | No size limit, and images unused for a week are removed (counted from when they were stored before SDWebImage 5.21). | 250 MB, removing the least recently used images first. No age limit.                                           |
+| **`cache: 'web'` images**: an HTTP cache instead | 50 MB, following the server's cache headers.                                                                         | 50 MB, following the server's cache headers.                                                                   |
 
-- Request user from API.
-- Receive JSON representing the user containing a `profilePicture` property that is the url of the profile picture.
-- Display the profile picture.
+Set the limits your app starts with in its native config (or with the Expo plugin), and change them while it runs with [`FastImage.configureCache`](../README.md#fastimageconfigurecache-limits-cachelimits--promisecachestate), which saves the change; call it without limits to see the ones in effect and how much the disk cache uses. [`source.memoryCache: false`](../README.md#sourcememorycache-boolean) keeps an image on disk only, e.g. a large photo shown once.
 
-So what happens if the user wants to change their profile picture?
+## What an image is cached under
 
-- User uploads a new profile picture, it gets a new url on the backend.
-- Update a field in a database.
+An image is cached under its url. If the url changes while the image stays the same, as with signed urls that carry a token or an expiry, give it a [`source.cacheKey`](../README.md#sourcecachekey-string) that identifies the image instead, e.g. its id. Headers aren't part of the key.
 
-Next time the app is opened:
+## When an image changes
 
-- Display the cached profile picture immediately.
-- Request the user json again (this time it will have the new profile picture url).
-- Display the new profile picture.
+FastImage treats an image at a url (or `cacheKey`) as never changing: that's what makes it fast. When an image changes:
 
-## How is the cache cleared?
+- **Give it a new url or `cacheKey`**, e.g. `` `avatar-${user.id}-${user.avatarUpdatedAt}` `` with a version or date from your API. The app shows the cached image until it has the new key, then loads the new image. The old one is removed from the cache in time, by its limits.
+- **Or use [`cache: 'web'`](../README.md#sourcecache-enum)** to follow the server's HTTP cache headers, as a browser does: the image is checked with the serv
```

**File**: `docs/roadmap.md` (modified, +0/-8)
```diff
@@ -1,13 +1,5 @@
 # Roadmap / Ideas
 
-## Add `onProgress` and `onComplete` to preload.
-
-- [Add onProgress and onComplete to preload.](https://github.com/DylanVann/react-native-fast-image/pull/268)
-- Blocked by: [Consider switching to a different iOS image loading library.](https://github.com/DylanVann/react-native-fast-image/issues/13)
-- Preload API should include returning the cache path of the images.
-- Something like `.preload(images: {uri, ...otherOptions}[]): Promise<[{path: string}]>`
-- Maybe something like: [Make it possible to obtain the cache path of an image.](https://github.com/DylanVann/react-native-fast-image/pull/351)
-
 ## Add `blurRadius` prop.
 
 - [Add blurRadius property.](https://github.com/DylanVann/react-native-fast-image/pull/157)
```

---

### Incident Patch 3: `3ec8d604` (2026-09-30)
**Commit Message**: fix(ios): don't store web responses that aren't images in the HTTP cache (#1181)

**File**: `ios/FastImage/FFFastImageSource.h` (modified, +6/-3)
```diff
@@ -62,9 +62,12 @@ typedef NS_ENUM(NSInteger, FFFCacheControl) {
 + (NSURLCache *)webURLCache;
 
 // After a load of this source failed: for a `cache: 'web'` image whose data
-// isn't an image (e.g. a captive portal's HTML page), removes the response
-// from the HTTP cache, which stored it as it downloaded. Otherwise the next
-// loads would get it from there until it expires, and fail again.
+// isn't an image, removes the response from the HTTP cache, which stored it as
+// it downloaded. Otherwise the next loads would get it from there until it
+// expires, and fail again. The web loader already doesn't store responses
+// that aren't images (e.g. a captive portal's HTML page); this is for data
+// that looks like an image but can't be decoded, or an app's own operation
+// class.
 - (void)forgetResponseAfterError:(NSError *)error;
 
 @end
```

**File**: `ios/FastImage/FFFastImageSource.m` (modified, +30/-0)
```diff
@@ -3,9 +3,35 @@
 #import <SDWebImage/SDWebImageDownloaderResponseModifier.h>
 #import <SDWebImage/SDWebImageDownloaderDecryptor.h>
 #import <SDWebImage/SDWebImageError.h>
+#import <SDWebImage/SDWebImageDownloaderOperation.h>
+#import <SDWebImage/NSData+ImageContentType.h>
 
 static NSUInteger const FFFWebCacheSize = 50 * 1024 * 1024;
 
+// Downloads `cache: 'web'` images. The HTTP cache only stores a response whose
+// body is an image: a page sent instead (e.g. a captive portal's, with status
+// 200) would be served from there until it expired, and each load would fail.
+// Removing it after a load failed (forgetResponseAfterError:) could still be
+// in progress when the next load started.
+@interface FFFWebDownloaderOperation : SDWebImageDownloaderOperation
+@end
+
+@implementation FFFWebDownloaderOperation
+
+- (void)URLSession:(NSURLSession *)session
+          dataTask:(NSURLSessionDataTask *)dataTask
+ willCacheResponse:(NSCachedURLResponse *)proposedResponse
+ completionHandler:(void (^)(NSCachedURLResponse *cachedResponse))completionHandler
+{
+    if ([NSData sd_imageFormatForImageData:proposedResponse.data] == SDImageFormatUndefined) {
+        completionHandler(nil);
+        return;
+    }
+    [super URLSession:session dataTask:dataTask willCacheResponse:proposedResponse completionHandler:completionHandler];
+}
+
+@end
+
 @implementation FFFastImageSource
 
 - (instancetype)initWithURL:(NSURL *)url
@@ -62,6 +88,10 @@ - (SDWebImageOptions)cacheOptions
         NSURLSessionConfiguration *session = [(config.sessionConfiguration ?: NSURLSessionConfiguration.defaultSessionConfiguration) copy];
         session.URLCache = [FFFastImageSource webURLCache];
         config.sessionConfiguration = session;
+        // Unless the app set its own operation class.
+        if (!config.operationClass || config.operationClass == [SDWebImageDownloaderOperation class]) {
+            config.operationClass = [FFFWebDownloaderOperation class];
+        }
         downloader = [[SDWebImageDownloader alloc] initWithConfig:config];
         // The shared downloader's response modifier and decryptor, when it
         // has them (as they are at each download). Its request modifier
```

---

### Incident Patch 4: `ab3d9a5f` (2026-09-30)
**Commit Message**: fix(android): keep React Native's event dispatcher in release builds (#1188)

**File**: `android/consumer-rules.pro` (modified, +8/-0)
```diff
@@ -33,3 +33,11 @@
   **[] $VALUES;
   public *;
 }
+
+# React Native's event dispatcher, which FastImage looks up by name
+# (FastImageEvents), so it still compiles against React Native 0.60-0.62,
+# which don't have it. R8 would rename it, and on the New Architecture every
+# event (onLoad, onError, ...) would then be dropped.
+-keep class com.facebook.react.uimanager.UIManagerHelper {
+  public static *** getEventDispatcherForReactTag(com.facebook.react.bridge.ReactContext, int);
+}
```

---

### Incident Patch 5: `604d1211` (2026-09-30)
**Commit Message**: fix(android): keep Glide modules' constructors in release builds (#1187)

**File**: `android/build.gradle` (modified, +1/-0)
```diff
@@ -70,6 +70,7 @@ repositories {
     mavenCentral()
 }
 
+// When changing the default, revisit the Glide rules in consumer-rules.pro.
 def glideVersion = safeExtGet('glideVersion', '4.12.0')
 
 dependencies {
```

**File**: `android/consumer-rules.pro` (modified, +22/-4)
```diff
@@ -7,10 +7,28 @@
 -keep public class com.dylanvann.fastimage.* {*;}
 -keep public class com.dylanvann.fastimage.** {*;}
 
-# Glide's modules (FastImage's, and the one Glide generates from them) and
-# its image header types.
--keep public class * implements com.bumptech.glide.module.GlideModule
--keep public class * extends com.bumptech.glide.module.AppGlideModule
+# The Glide rules below cover what Glide's own rules (its library's
+# proguard-rules.txt) didn't at the version FastImage uses by default
+# (glideVersion in build.gradle, 4.12.0) and older ones apps may pick. When
+# updating Glide, revisit which are still needed: whether Glide's rules now
+# keep modules' constructors, and whether its integrations still register
+# old-style modules in their manifests (the OkHttp integration's
+# OkHttpGlideModule still did in 5.0.9).
+
+# Glide's modules and their constructors: FastImage's, the one Glide
+# generates from them, and old-style modules Glide finds in the app's manifest
+# and creates by reflection (e.g. its OkHttp integration's OkHttpGlideModule,
+# which FastImage uses). R8's full mode (the default from the Android Gradle
+# plugin 8.0) removes a constructor a rule doesn't name, and Glide then
+# crashes when it starts ("Unable to instantiate GlideModule implementation").
+-keep public class * implements com.bumptech.glide.module.GlideModule {
+  <init>();
+}
+-keep public class * extends com.bumptech.glide.module.AppGlideModule {
+  <init>(...);
+}
+
+# Glide's image header types.
 -keep public enum com.bumptech.glide.load.ImageHeaderParser$** {
   **[] $VALUES;
   public *;
```

---

### Incident Patch 6: `58dc5b2d` (2026-09-30)
**Commit Message**: fix(android): ship the ProGuard rules with the library (#1185)

**File**: `README.md` (modified, +0/-15)
```diff
@@ -91,21 +91,6 @@ const YourImage = () => (
 
 - [Are you using Glide already using an AppGlideModule?](docs/app-glide-module.md) (you might have problems if you don't read this)
 
-## Are you using Proguard?
-
-If you use Proguard you will need to add these lines to `android/app/proguard-rules.pro`:
-
-```
--keep public class com.dylanvann.fastimage.* {*;}
--keep public class com.dylanvann.fastimage.** {*;}
--keep public class * implements com.bumptech.glide.module.GlideModule
--keep public class * extends com.bumptech.glide.module.AppGlideModule
--keep public enum com.bumptech.glide.load.ImageHeaderParser$** {
-  **[] $VALUES;
-  public *;
-}
-```
-
 ## Properties
 
 ### `source?: object`
```

**File**: `android/build.gradle` (modified, +2/-0)
```diff
@@ -35,6 +35,8 @@ android {
         targetSdkVersion safeExtGet('targetSdkVersion', 28)
         versionCode 1
         versionName "1.0"
+        // Applied to the app's release build, so apps don't need to add them.
+        consumerProguardFiles 'consumer-rules.pro'
     }
     sourceSets {
         main {
```

**File**: `android/consumer-rules.pro` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+# ProGuard/R8 rules for apps that use FastImage: the Android Gradle plugin
+# applies them to the app's release build (consumerProguardFiles in
+# build.gradle), so apps don't need to copy them.
+
+# FastImage's classes: its view manager, native module, Glide modules and
+# events.
+-keep public class com.dylanvann.fastimage.* {*;}
+-keep public class com.dylanvann.fastimage.** {*;}
+
+# Glide's modules (FastImage's, and the one Glide generates from them) and
+# its image header types.
+-keep public class * implements com.bumptech.glide.module.GlideModule
+-keep public class * extends com.bumptech.glide.module.AppGlideModule
+-keep public enum com.bumptech.glide.load.ImageHeaderParser$** {
+  **[] $VALUES;
+  public *;
+}
```

**File**: `package.json` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@
     "typings": "dist/index.d.ts",
     "files": [
         "android/build.gradle",
+        "android/consumer-rules.pro",
         "android/src/main",
         "ios/FastImage",
         "ios/FastImage.xcodeproj/project.pbxproj",
```

---

### Incident Patch 7: `051d5838` (2026-09-30)
**Commit Message**: test: fix the example apps' Android release builds (#1186) [skip ci]

**File**: `ReactNativeFastImageExample/src/LocalImagesExample.tsx` (modified, +2/-2)
```diff
@@ -16,11 +16,11 @@ import BulletText from './BulletText'
 // @ts-ignore
 import FieldsImage from './images/fields.jpg'
 // @ts-ignore
-import FieldsWebP from './images/fields.webp'
+import FieldsWebP from './images/fields-webp.webp'
 // @ts-ignore
 import JellyfishGIF from './images/jellyfish.gif'
 // @ts-ignore
-import JellyfishWebP from './images/jellyfish.webp'
+import JellyfishWebP from './images/jellyfish-webp.webp'
 import { Masked, useLoads } from './RunnerContext'
 
 const Image = ({ source, ...p }: FastImageProps) => (
```

---

### Incident Patch 8: `22fafe6c` (2026-09-29)
**Commit Message**: fix: don't keep responses that aren't images in the disk cache (#1178)

**File**: `ReactNativeFastImageExample/src/RegressionExample.tsx` (modified, +138/-17)
```diff
@@ -1263,26 +1263,27 @@ function CacheKeyCase({
     )
 }
 
-// Preloads a url that first gets data that isn't an image (which SDWebImage
-// remembers as a failed url), then preloads it again: the second preload
-// downloads it and succeeds. iOS failed it without a request until the app
-// was relaunched (#394), since views retry failed urls but preloads didn't.
-// iOS only for now: Android keeps the first response (not an image) in
-// Glide's disk cache, so the second preload fails too (to fix next).
-const PRELOAD_RETRY_PATH = `/bad-once/picsum/1025-200x200.jpg?retry=${RUN}`
-function PreloadRetryCase() {
+// Preloads a url that first gets an HTML page (status 200, as from a captive
+// portal), then preloads it again: the second preload downloads it and
+// succeeds. iOS failed it without a request until the app was relaunched
+// (#394), since views retry failed urls but preloads didn't. Android kept the
+// page in Glide's disk cache (and `web` images' HTTP cache), so every later
+// load failed; iOS kept it in `web` images' HTTP cache.
+function PreloadRetryCase({ id, web }: { id: string; web?: boolean }) {
+    const path = `/bad-once/picsum/1025-200x200.jpg?${id}=${RUN}`
     const [status, setStatus] = useState('waiting')
     const [shown, setShown] = useState(false)
-    const source = { uri: imageUrl(PRELOAD_RETRY_PATH.slice(1)) }
+    const source = {
+        uri: imageUrl(path.slice(1)),
+        cache: web ? FastImage.cacheControl.web : undefined,
+    }
     useEffect(() => {
         const run = async () => {
             const [first] = await FastImage.preload([source])
             if (first.ok) return setStatus('the first preload loaded')
             const [second] = await FastImage.preload([source])
             const response = await fetch(
-                imageUrl(
-                    `requests?path=${encodeURIComponent(PRELOAD_RETRY_PATH)}`,
-                ),
+                imageUrl(`requests?path=${encodeURIComponent(path)}`),
             )
             const { count } = (await response.json()) as { count: number }
             if (!second.ok) return setStatus(`retry failed: ${second.error}`)
@@ -1305,9 +1306,118 @@ function PreloadRetryCase() {
                 <View style={styles.image} />
             )}
             <CaseStatus
-                id="preload-retry"
+                id={id}
+                status={status}
+                description={
+                    web
+                        ? "a url whose first response was an HTML page (with cache 'web') loads the next time"
+                        : '#394: a url whose first response was an HTML page is downloaded again by the next preload'
+                }
+            />
+        </View>
+    )
+}
+
+// Shows a url whose first response is an HTML page (status 200): the view
+// fails, then a new view of the same url downloads it again and shows it.
+// Android kept the page in Glide's disk cache, so the second view failed too.
+function ViewRetryCase() {
+    const path = `/bad-once/picsum/1025-200x200.jpg?view-retry=${RUN}`
+    const [attempt, setAttempt] = useState(1)
+    const [status, setStatus] = useState('waiting')
+    const onLoad = async () => {
+        const response = await fetch(
+            imageUrl(`requests?path=${encodeURIComponent(path)}`),
+        )
+        const { count } = (await response.json()) as { count: number }
+        setStatus(
+            attempt === 1
+                ? 'the first view loaded'
+                : count === 2
+                  ? 'OK'
+                  : `${count} requests`,
+        )
+    }
+    return (
+        <View style={styles.row}>
+            <FastImage
+                // A new view for the second attempt.
+                key={attempt}
+                style={styles.image}
+                source={{ uri: imageUrl(path.slice(1)) }}
+                onError={() =>
+                    attempt === 1
+                        ? setAttempt(2)
+                
```

**File**: `ReactNativeFastImageExampleServer/server.ts` (modified, +18/-5)
```diff
@@ -15,8 +15,10 @@
 //   /cookie/    403 unless the request has both cookies from /set-cookie with
 //               the same `run` query parameter; the image is sent with its own
 //               cookie (`fast-image-image=<run>`).
-//   /bad-once/  The first request for a path and query gets data that isn't an
-//               image (with an image type), later ones the image.
+//   /bad-once/  The first request for a path and query gets an HTML page
+//               (status 200, cacheable for an hour, like a captive portal's),
+//               later ones the image.
+//   /mislabeled/ The image, sent as `Content-Type: text/plain`.
 //
 // GET /set-cookie?run=<run> sets two cookies (`fast-image-a=<run>` and
 // `fast-image-b=<run>`; a new run value each time, so cookies kept from
@@ -123,6 +125,7 @@ const server = Bun.serve({
         let cacheControl: string | undefined
         let chunked = false
         let setCookie: string | undefined
+        let contentType: string | undefined
         const token = request.headers.get('x-token')
         if (pathname.startsWith('/private/')) {
             if (token !== 'fast-image') {
@@ -157,11 +160,20 @@ const server = Bun.serve({
             pathname = pathname.slice('/cookie'.length)
         } else if (pathname.startsWith('/bad-once/')) {
             if (requests.get(key) === 1) {
-                return new Response('not an image', {
-                    headers: { 'Content-Type': 'image/jpeg' },
-                })
+                return new Response(
+                    '<html><body>Sign in to continue</body></html>',
+                    {
+                        headers: {
+                            'Content-Type': 'text/html; charset=utf-8',
+                            'Cache-Control': 'max-age=3600',
+                        },
+                    },
+                )
             }
             pathname = pathname.slice('/bad-once'.length)
+        } else if (pathname.startsWith('/mislabeled/')) {
+            contentType = 'text/plain'
+            pathname = pathname.slice('/mislabeled'.length)
         }
         const file = path.join(IMAGES, decodeURIComponent(pathname))
         if (!file.startsWith(IMAGES + path.sep)) {
@@ -189,6 +201,7 @@ const server = Bun.serve({
         const headers = new Headers()
         if (cacheControl) headers.set('Cache-Control', cacheControl)
         if (setCookie) headers.append('Set-Cookie', setCookie)
+        if (contentType) headers.set('Content-Type', contentType)
         return new Response(image, { headers })
     },
     websocket: {
```

**File**: `android/src/main/java/com/dylanvann/fastimage/FastImageOkHttpProgressGlideModule.java` (modified, +87/-3)
```diff
@@ -7,6 +7,9 @@
 import com.bumptech.glide.Glide;
 import com.bumptech.glide.Registry;
 import com.bumptech.glide.annotation.GlideModule;
+import com.bumptech.glide.load.ImageHeaderParser;
+import com.bumptech.glide.load.ImageHeaderParserUtils;
+import com.bumptech.glide.load.engine.bitmap_recycle.ArrayPool;
 import com.bumptech.glide.integration.okhttp3.OkHttpUrlLoader;
 import com.bumptech.glide.load.Options;
 import com.bumptech.glide.load.model.GlideUrl;
@@ -21,6 +24,7 @@
 import java.io.IOException;
 import java.io.InputStream;
 import java.util.HashMap;
+import java.util.Locale;
 import java.util.Map;
 import java.util.WeakHashMap;
 
@@ -62,7 +66,10 @@ public void registerComponents(
         OkHttpClient sharedClient = OkHttpClientProvider.getOkHttpClient();
         OkHttpClient.Builder builder = sharedClient
                 .newBuilder()
-                .addInterceptor(createInterceptor(progressListener));
+                .addInterceptor(createInterceptor(progressListener))
+                // A network interceptor, so it runs before the HTTP cache of
+                // `web` images stores the response (checking it reads it).
+                .addNetworkInterceptor(createNonImageInterceptor(registry, glide.getArrayPool()));
         // React Native's shared client comes with an empty cookie jar (React
         // Native only fills it in for its networking and Image clients), so
         // images were loaded without the app's cookies, unlike on iOS. Use the
@@ -71,8 +78,7 @@ public void registerComponents(
             builder.cookieJar(new JavaNetCookieJar(new FastImageCookieHandler(context)));
         }
         OkHttpClient client = builder.build();
-        OkHttpUrlLoader.Factory factory = new OkHttpUrlLoader.Factory(client);
-        registry.replace(GlideUrl.class, InputStream.class, factory);
+        registry.replace(GlideUrl.class, InputStream.class, new UrlLoaderFactory(client));
 
         // `cache: 'web'` skips Glide's caches and relies on HTTP caching, so
         // those urls get a client with an HTTP cache (#280): one of their own,
@@ -85,6 +91,40 @@ public void registerComponents(
         registry.prepend(FastImageWebGlideUrl.class, InputStream.class, new WebUrlLoaderFactory(webClient));
     }
 
+    // Loads GlideUrls with the given client, except `web` ones
+    // (FastImageWebGlideUrls): Glide gives a model to the loaders of its
+    // superclasses too, and tries the next one when a load fails, so a `web`
+    // image that failed (e.g. a 404) was requested again with this client,
+    // without the HTTP cache, which also hid the failure.
+    private static class UrlLoaderFactory implements ModelLoaderFactory<GlideUrl, InputStream> {
+        private final OkHttpClient client;
+
+        UrlLoaderFactory(OkHttpClient client) {
+            this.client = client;
+        }
+
+        @NonNull
+        @Override
+        public ModelLoader<GlideUrl, InputStream> build(@NonNull MultiModelLoaderFactory multiFactory) {
+            final OkHttpUrlLoader loader = new OkHttpUrlLoader(client);
+            return new ModelLoader<GlideUrl, InputStream>() {
+                @Override
+                public LoadData<InputStream> buildLoadData(@NonNull GlideUrl model, int width, int height, @NonNull Options options) {
+                    return loader.buildLoadData(model, width, height, options);
+                }
+
+                @Override
+                public boolean handles(@NonNull GlideUrl model) {
+                    return !(model instanceof FastImageWebGlideUrl);
+                }
+            };
+        }
+
+        @Override
+        public void teardown() {
+        }
+    }
+
     // Loads FastImageWebGlideUrls with the given client.
     private static class WebUrlLoaderFactory implements ModelLoaderFactory<FastImageWebGlideUrl, InputStream> {
         private final OkHttpClient client;
@@ -115,6 +155,50 @@ public void teardown() {
         }
     }
 
+    // Fails a succes
```

**File**: `ios/FastImage/FFFastImageSource.h` (modified, +6/-0)
```diff
@@ -61,4 +61,10 @@ typedef NS_ENUM(NSInteger, FFFCacheControl) {
 // responses. 50 MB, as on Android.
 + (NSURLCache *)webURLCache;
 
+// After a load of this source failed: for a `cache: 'web'` image whose data
+// isn't an image (e.g. a captive portal's HTML page), removes the response
+// from the HTTP cache, which stored it as it downloaded. Otherwise the next
+// loads would get it from there until it expires, and fail again.
+- (void)forgetResponseAfterError:(NSError *)error;
+
 @end
```

**File**: `ios/FastImage/FFFastImageSource.m` (modified, +12/-0)
```diff
@@ -2,6 +2,7 @@
 #import <SDWebImage/SDWebImageDownloader.h>
 #import <SDWebImage/SDWebImageDownloaderResponseModifier.h>
 #import <SDWebImage/SDWebImageDownloaderDecryptor.h>
+#import <SDWebImage/SDWebImageError.h>
 
 static NSUInteger const FFFWebCacheSize = 50 * 1024 * 1024;
 
@@ -79,6 +80,17 @@ - (SDWebImageOptions)cacheOptions
     return downloader;
 }
 
+- (void)forgetResponseAfterError:(NSError *)error
+{
+    if (_cacheControl != FFFCacheControlWeb || !_url) {
+        return;
+    }
+    if (![error.domain isEqualToString:SDWebImageErrorDomain] || error.code != SDWebImageErrorBadImageData) {
+        return;
+    }
+    [[FFFastImageSource webURLCache] removeCachedResponseForRequest:[NSURLRequest requestWithURL:_url]];
+}
+
 + (NSURLCache *)webURLCache
 {
     static NSURLCache *cache;
```

---

### Incident Patch 9: `12e626df` (2026-09-29)
**Commit Message**: fix(ios): try failed urls again in preload (#1177)

**File**: `ReactNativeFastImageExample/src/RegressionExample.tsx` (modified, +53/-0)
```diff
@@ -1263,6 +1263,56 @@ function CacheKeyCase({
     )
 }
 
+// Preloads a url that first gets data that isn't an image (which SDWebImage
+// remembers as a failed url), then preloads it again: the second preload
+// downloads it and succeeds. iOS failed it without a request until the app
+// was relaunched (#394), since views retry failed urls but preloads didn't.
+// iOS only for now: Android keeps the first response (not an image) in
+// Glide's disk cache, so the second preload fails too (to fix next).
+const PRELOAD_RETRY_PATH = `/bad-once/picsum/1025-200x200.jpg?retry=${RUN}`
+function PreloadRetryCase() {
+    const [status, setStatus] = useState('waiting')
+    const [shown, setShown] = useState(false)
+    const source = { uri: imageUrl(PRELOAD_RETRY_PATH.slice(1)) }
+    useEffect(() => {
+        const run = async () => {
+            const [first] = await FastImage.preload([source])
+            if (first.ok) return setStatus('the first preload loaded')
+            const [second] = await FastImage.preload([source])
+            const response = await fetch(
+                imageUrl(
+                    `requests?path=${encodeURIComponent(PRELOAD_RETRY_PATH)}`,
+                ),
+            )
+            const { count } = (await response.json()) as { count: number }
+            if (!second.ok) return setStatus(`retry failed: ${second.error}`)
+            if (count !== 2) return setStatus(`${count} requests`)
+            setShown(true)
+        }
+        run().catch((e) => setStatus(`error: ${e}`))
+        // Only on mount.
+        // eslint-disable-next-line react-hooks/exhaustive-deps
+    }, [])
+    return (
+        <View style={styles.row}>
+            {shown ? (
+                <FastImage
+                    style={styles.image}
+                    source={source}
+                    onLoad={() => setStatus('OK')}
+                />
+            ) : (
+                <View style={styles.image} />
+            )}
+            <CaseStatus
+                id="preload-retry"
+                status={status}
+                description="#394: a url that failed once (bad data) is downloaded again by the next preload"
+            />
+        </View>
+    )
+}
+
 // Preloads an image that isn't cached with `cache: 'cacheOnly'`: it fails
 // without a request to the server, as a view with it does. iOS downloaded it
 // (preload didn't follow `cache`, #406).
@@ -2541,6 +2591,9 @@ export const REGRESSION_GROUPS: RegressionGroup[] = [
             <PreloadLimitCase key="preload-limit" />,
             <PreloadDiskCase key="preload-disk" />,
             <PreloadCacheOnlyCase key="preload-cache-only" />,
+            ...(Platform.OS === 'ios'
+                ? [<PreloadRetryCase key="preload-retry" />]
+                : []),
         ],
     },
     {
```

**File**: `ReactNativeFastImageExampleServer/server.ts` (modified, +9/-0)
```diff
@@ -15,6 +15,8 @@
 //   /cookie/    403 unless the request has both cookies from /set-cookie with
 //               the same `run` query parameter; the image is sent with its own
 //               cookie (`fast-image-image=<run>`).
+//   /bad-once/  The first request for a path and query gets data that isn't an
+//               image (with an image type), later ones the image.
 //
 // GET /set-cookie?run=<run> sets two cookies (`fast-image-a=<run>` and
 // `fast-image-b=<run>`; a new run value each time, so cookies kept from
@@ -153,6 +155,13 @@ const server = Bun.serve({
             }
             setCookie = `fast-image-image=${run}; Path=/`
             pathname = pathname.slice('/cookie'.length)
+        } else if (pathname.startsWith('/bad-once/')) {
+            if (requests.get(key) === 1) {
+                return new Response('not an image', {
+                    headers: { 'Content-Type': 'image/jpeg' },
+                })
+            }
+            pathname = pathname.slice('/bad-once'.length)
         }
         const file = path.join(IMAGES, decodeURIComponent(pathname))
         if (!file.startsWith(IMAGES + path.sep)) {
```

**File**: `ios/FastImage/FFFastImageViewManager.m` (modified, +4/-1)
```diff
@@ -107,7 +107,10 @@ static void FFFStartPendingPreloads(void)
             }
             [results addObject:[NSNull null]];
             // A source's own priority replaces the prefetcher's, as on Android.
-            SDWebImageOptions options = prefetcherOptions;
+            // Failed urls are tried again, as views do (SDWebImage otherwise
+            // fails a url that failed before, e.g. with data that isn't an
+            // image, without a request until the app is relaunched, #394).
+            SDWebImageOptions options = prefetcherOptions | SDWebImageRetryFailed;
             if (source.hasPriority) {
                 options &= ~(SDWebImageLowPriority | SDWebImageHighPriority);
                 if (source.priority == FFFPriorityLow) {
```

---

### Incident Patch 10: `fb9b4a66` (2026-09-28)
**Commit Message**: feat: add source.memoryCache to keep images on disk only (#1176)

**File**: `README.md` (modified, +12/-0)
```diff
@@ -163,6 +163,12 @@ Not used with `cache: 'web'`, which follows the HTTP cache (keyed by url).
 
 ---
 
+### `source.memoryCache?: boolean`
+
+Whether the decoded image is kept in the memory cache. **Default: true.** With `false` it's only kept on disk: a view doesn't leave it in memory once it stops showing it, and `FastImage.preload` downloads it without decoding it. Use it for large images that are shown once or rarely, like a full-screen photo: a decoded photo can take tens of MB of memory. Images shown again, like a list scrolled back, are decoded from disk again.
+
+---
+
 ### `defaultSource?: number`
 
 - An asset loaded with `require(...)`.
@@ -351,6 +357,12 @@ for (const result of results) {
 
 Each source's `cache` applies, as for a view: with `web` the preload follows the HTTP cache, and with `cacheOnly` it doesn't download. A `cacheOnly` preload resolves `ok` only if the image is cached, and loads it from the disk cache into memory, so a view shows it at once.
 
+A source with `memoryCache: false` is only downloaded to the disk cache, without being decoded into memory, and is decoded when it's shown. Use it to preload many images, or large ones, e.g. the next pages of a feed: a decoded photo can take tens of MB of memory. Other sources are also kept decoded in memory, so they show at once.
+
+```js
+await FastImage.preload(photos.map((uri) => ({ uri, memoryCache: false })))
+```
+
 ### `FastImage.clearMemoryCache: () => Promise<void>`
 
 Clear all images from memory cache.
```

**File**: `ReactNativeFastImageExample/src/RegressionExample.tsx` (modified, +133/-3)
```diff
@@ -15,6 +15,7 @@ import FastImage, {
     FastImageBackground,
     FastImageProps,
     LoadResult,
+    PreloadResult,
     Source,
 } from 'react-native-fast-image'
 import { useStatusBarHeight } from './StatusBarUnderlay'
@@ -971,8 +972,18 @@ const BLANK = '#eeeeee'
 // recorded (a video sample, see RunnerContext.tsx). The view should go from
 // magenta to cyan without showing blank in between (it flashed blank, #747);
 // with `recycle`, recyclingKey changes too, and it should be blank while cyan
-// loads (for views reused for other content).
-function KeepPreviousCase({ id, recycle }: { id: string; recycle?: boolean }) {
+// loads (for views reused for other content). With `memoryCache` false the
+// images aren't kept in memory, so the one shown comes from the disk cache
+// while cyan loads (Android shows it from its cache).
+function KeepPreviousCase({
+    id,
+    recycle,
+    memoryCache,
+}: {
+    id: string
+    recycle?: boolean
+    memoryCache?: boolean
+}) {
     const sample = useContext(SampleContext)
     const view = useRef<React.ComponentRef<typeof View>>(null)
     const [second, setSecond] = useState(false)
@@ -1010,8 +1021,12 @@ function KeepPreviousCase({ id, recycle }: { id: string; recycle?: boolean }) {
                                       `cyan.png?${id}=${RUN}&delay=150`,
                                   ),
                                   headers: BACKGROUND_SLOW_HEADERS,
+                                  memoryCache,
+                              }
+                            : {
+                                  uri: imageUrl(`magenta.png?${id}=${RUN}`),
+                                  memoryCache,
                               }
-                            : { uri: imageUrl(`magenta.png?${id}=${RUN}`) }
                     }
                     recyclingKey={
                         recycle ? (second ? 'second' : 'first') : null
@@ -1288,6 +1303,114 @@ function PreloadCacheOnlyCase() {
     )
 }
 
+// Shows an image with memoryCache false, then shows it in a second view: it
+// comes from the disk cache (the server gets one request). (That it isn't
+// kept in memory isn't visible here.)
+const NO_MEMORY_PATH = `/picsum/1025-200x200.jpg?no-memory=${RUN}`
+function MemoryCacheOffCase() {
+    const [second, setSecond] = useState(false)
+    const [requests, setRequests] = useState<number>()
+    const source = {
+        uri: imageUrl(NO_MEMORY_PATH.slice(1)),
+        memoryCache: false,
+    }
+    return (
+        <View style={styles.row}>
+            <FastImage
+                style={styles.image}
+                source={source}
+                onLoad={() => setSecond(true)}
+            />
+            {second ? (
+                <FastImage
+                    style={[styles.image, styles.gap]}
+                    source={source}
+                    onLoad={() =>
+                        fetch(
+                            imageUrl(
+                                `requests?path=${encodeURIComponent(NO_MEMORY_PATH)}`,
+                            ),
+                        )
+                            .then((response) => response.json())
+                            .then((json) => setRequests(json.count))
+                            .catch(() => setRequests(-1))
+                    }
+                />
+            ) : (
+                <View style={[styles.image, styles.gap]} />
+            )}
+            <CaseStatus
+                id="memory-cache-off"
+                status={
+                    requests === undefined
+                        ? 'waiting'
+                        : requests === 1
+                          ? 'OK'
+                          : `requested ${requests} times`
+                }
+                description="memoryCache false: the image shows, and a second view gets it from the disk cache"
+            />
+        </View>
+    )
+}
+
+// Preloads an image with memoryCache false (to disk only, without decoding
+/
```

**File**: `android/src/main/java/com/dylanvann/fastimage/FastImageSource.java` (modified, +21/-0)
```diff
@@ -124,6 +124,27 @@ void setWebCache(boolean webCache) {
         mWebCache = webCache;
     }
 
+    boolean isWebCache() {
+        return mWebCache;
+    }
+
+    // `memoryCache`: whether the decoded image is kept in the memory cache.
+    private boolean mMemoryCache = true;
+
+    void setMemoryCache(boolean memoryCache) {
+        mMemoryCache = memoryCache;
+    }
+
+    boolean isMemoryCache() {
+        return mMemoryCache;
+    }
+
+    // An http(s) url.
+    boolean isRemote() {
+        String scheme = mUri == null ? null : mUri.getScheme();
+        return "http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme);
+    }
+
     // `cacheKey`: the key to cache the image under instead of its url.
     @Nullable
     private String mCacheKey = null;
```

**File**: `android/src/main/java/com/dylanvann/fastimage/FastImageViewConverter.java` (modified, +5/-1)
```diff
@@ -64,6 +64,9 @@ FastImageSource getImageSource(Context context, @Nullable ReadableMap source) {
         if (source == null) return null;
         FastImageSource imageSource = new FastImageSource(context, source.getString("uri"), getHeaders(source));
         imageSource.setWebCache(getCacheControl(source) == FastImageCacheControl.WEB);
+        if (source.hasKey("memoryCache") && source.getType("memoryCache") == ReadableType.Boolean) {
+            imageSource.setMemoryCache(source.getBoolean("memoryCache"));
+        }
         if (source.hasKey("cacheKey") && source.getType("cacheKey") == ReadableType.String) {
             imageSource.setCacheKey(source.getString("cacheKey"));
         }
@@ -116,7 +119,8 @@ static RequestOptions getOptions(Context context, @Nullable FastImageSource imag
         RequestOptions options = new RequestOptions()
                 .diskCacheStrategy(diskCacheStrategy)
                 .onlyRetrieveFromCache(onlyFromCache)
-                .skipMemoryCache(skipMemoryCache)
+                // memoryCache false: only kept on disk.
+                .skipMemoryCache(skipMemoryCache || (imageSource != null && !imageSource.isMemoryCache()))
                 .priority(priority)
                 .placeholder(TRANSPARENT_DRAWABLE);
 
```

**File**: `android/src/main/java/com/dylanvann/fastimage/FastImageViewModule.java` (modified, +103/-12)
```diff
@@ -1,6 +1,8 @@
 package com.dylanvann.fastimage;
 
 import android.app.Activity;
+import android.content.Context;
+import android.graphics.BitmapFactory;
 import android.graphics.drawable.Drawable;
 
 import androidx.annotation.NonNull;
@@ -9,6 +11,8 @@
 import com.bumptech.glide.Glide;
 import com.bumptech.glide.Priority;
 import com.bumptech.glide.load.DataSource;
+import com.bumptech.glide.load.ImageHeaderParser;
+import com.bumptech.glide.load.ImageHeaderParserUtils;
 import com.bumptech.glide.load.engine.GlideException;
 import com.bumptech.glide.request.RequestListener;
 import com.bumptech.glide.request.RequestOptions;
@@ -24,8 +28,13 @@
 import com.facebook.react.bridge.WritableArray;
 import com.facebook.react.bridge.WritableMap;
 
+import java.io.File;
+import java.io.FileInputStream;
 import java.io.IOException;
+import java.io.InputStream;
 import java.util.ArrayDeque;
+import java.util.concurrent.Executor;
+import java.util.concurrent.Executors;
 
 class FastImageViewModule extends ReactContextBaseJavaModule {
 
@@ -63,8 +72,44 @@ private static void startPendingPreloads() {
         }
     }
 
+    // Reads the size of images preloaded to disk only, off the UI thread.
+    private static final Executor sizeExecutor = Executors.newSingleThreadExecutor();
+
+    // The image's size from its file's header, as a decoded image has it (with
+    // its EXIF orientation), or null if it can't be read.
+    @Nullable
+    private static int[] imageSize(Context context, File file) {
+        BitmapFactory.Options bounds = new BitmapFactory.Options();
+        bounds.inJustDecodeBounds = true;
+        BitmapFactory.decodeFile(file.getPath(), bounds);
+        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;
+        int orientation = ImageHeaderParser.UNKNOWN_ORIENTATION;
+        Glide glide = Glide.get(context);
+        try (InputStream stream = new FileInputStream(file)) {
+            orientation = ImageHeaderParserUtils.getOrientation(
+                    glide.getRegistry().getImageHeaderParsers(), stream, glide.getArrayPool());
+        } catch (IOException e) {
+            // Taken as not rotated.
+        }
+        // 5 to 8 turn the image by 90 degrees.
+        boolean transposed = orientation >= 5 && orientation <= 8;
+        return transposed
+                ? new int[] {bounds.outHeight, bounds.outWidth}
+                : new int[] {bounds.outWidth, bounds.outHeight};
+    }
+
+    private static WritableMap success(int width, int height) {
+        WritableMap result = Arguments.createMap();
+        result.putBoolean("ok", true);
+        result.putInt("width", width);
+        result.putInt("height", height);
+        return result;
+    }
+
     // Resolves with a result per source, in order, once all have loaded or
     // failed: { ok, width, height } or { ok: false, error }. Never rejects.
+    // A remote source with memoryCache false is only downloaded to the disk
+    // cache, without decoding it (its size comes from the header).
     @ReactMethod
     public void preload(final ReadableArray sources, final Promise promise) {
         final ReactApplicationContext context = getReactApplicationContext();
@@ -111,6 +156,58 @@ public void run() {
                     final RequestOptions preloadOptions = source.hasKey("priority") && !source.isNull("priority")
                             ? options
                             : options.priority(Priority.LOW);
+                    // A source's result, which frees its slot.
+                    final ResultCallback done = new ResultCallback() {
+                        @Override
+                        public void run(WritableMap result) {
+                            results[index] = result;
+                            preloadsInFlight--;
+                            finishOne.run();
+                            startPendingPreloads();
+                        }
+                    };
+                    // Remote images (web
```

#### Recent Merged Pull Requests:
- **PR #1204** (2026-09-30): test: reinstall pods in verify.mts when the Podfile changed [skip ci] (@DylanVann)
- **PR #1202** (2026-09-30): test: add an Expo example app (iOS, Android and web) to verify.mts --app expo (@DylanVann)
- **PR #1197** (2026-09-30): feat: add a minimal web version for react-native-web (@DylanVann)
- **PR #1195** (2026-09-30): fix(ios): tint images with the view's tintColor, and tint animated images' frames (@DylanVann)
- **PR #1194** (2026-09-30): feat: add a 0–1 progress to onProgress's event (@DylanVann)
- **PR #1193** (2026-09-30): feat: add blurRadius to blur the image (@DylanVann)
- **PR #1192** (2026-09-30): test: rebuild the Android JS bundle in verify.mts --release [skip ci] (@DylanVann)
- **PR #1191** (2026-09-30): test: add a --release option to verify.mts (@DylanVann)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
