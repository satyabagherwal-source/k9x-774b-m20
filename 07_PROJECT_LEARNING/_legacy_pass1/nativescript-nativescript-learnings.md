# Forensic Learning Record (Deep Inspection): NativeScript/NativeScript

> **Canonical Artifact**: `07_PROJECT_LEARNING/nativescript-nativescript-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NativeScript/NativeScript](https://github.com/NativeScript/NativeScript))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:36:57.877Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NativeScript/NativeScript`
- **Description**: ⚡ Write Native with TypeScript ✨ Best of all worlds (TypeScript, Swift, Objective C, Kotlin, Java, Dart). Use what you love ❤️ Angular, React, Solid, Svelte, Vue with: iOS (UIKit, SwiftUI), Android (View, Jetpack Compose), Flutter and you name it compatible.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 25662 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/automated/nativescript.config.ts`
```
import { NativeScriptConfig } from '@nativescript/core';

export default {
	id: 'org.nativescript.UnitTestApp',
	appPath: 'src',
	appResourcesPath: '../../tools/assets/App_Resources',
	android: {
		v8Flags: '--expose_gc',
	},
	cli: {
		packageManager: 'npm',
		additionalPathsToClean: ['.ns-vite-build'],
	},
	// bundler: 'vite',
	// bundlerConfigPath: 'vite.config.ts',
} as NativeScriptConfig;

```

### Core Architecture Module: `apps/automated/reference.d.ts`
```
/// <reference path="../../packages/core/references.d.ts" />

```

### Core Architecture Module: `apps/automated/src/animation-frame/animation-frame.ts`
```
import * as TKUnit from '../tk-unit';
import * as animationFrame from '@nativescript/core/animation-frame';
import * as fpsNative from '@nativescript/core/fps-meter/fps-native';

export function test_requestAnimationFrame_isDefined() {
	TKUnit.assertNotEqual(animationFrame.requestAnimationFrame, undefined, 'Method animationFrame.requestAnimationFrame() should be defined!');
}

export function test_cancelAnimationFrame_isDefined() {
	TKUnit.assertNotEqual(animationFrame.cancelAnimationFrame, undefined, 'Method animationFrame.cancelAnimationFrame() should be defined!');
}

export function test_requestAnimationFrame() {
	let completed: boolean;

	const id = animationFrame.requestAnimationFrame(() => {
		completed = true;
	});

	TKUnit.waitUntilReady(() => completed, 0.5, false);
	animationFrame.cancelAnimationFrame(id);
	TKUnit.assert(completed, 'Callback should be called!');
}

export function test_requestAnimationFrame_callbackCalledInCurrentFrame() {
	let completed: boolean;
	let currentFrameTime = 0;
	const frameCb = new fpsNative.FPSCallback((time) => {
		currentFrameTime = time;
	});
	frameCb.start();

	TKUnit.waitUntilReady(() => currentFrameTime > 0, 0.5);
	let calledTime = 0;
	animationFrame.requestAnimationFrame((frameTime) => {
		calledTime = frameTime;
		completed = calledTime >= frameTime;
	});

	TKUnit.waitUntilReady(() => completed, 0.5, false);
	frameCb.stop();
	TKUnit.assert(completed, 'Callback should be called in current frame!');
}

export function test_requestAnimationFrame_nextCallbackCalledInNextFrame() {
	let completed: boolean;
	let currentFrameTime = 0;
	const frameCb = new fpsNative.FPSCallback((time) => {
		currentFrameTime = time;
	});
	frameCb.start();

	TKUnit.waitUntilReady(() => currentFrameTime > 0, 0.5);
	animationFrame.requestAnimationFrame((firstFrameTime) => {
		animationFrame.requestAnimationFrame((frameTime) => {
			frameCb.stop();
			completed = frameTime > firstFrameTime && frameTime === currentFrameTime;
		});
	});

	TKUnit.waitUntilReady(() => completed, 0.5, false);
	frameCb.stop();
	TKUnit.assert(completed, 'Callback should be called in next frame!');
}

export function test_requestAnimationFrame_shouldBeCancelled() {
	let completed: boolean;
	let currentFrameTime = 0;
	const frameCb = new fpsNative.FPSCallback((time) => {
		currentFrameTime = time;
	});
	frameCb.start();

	TKUnit.waitUntilReady(() => currentFrameTime > 0, 0.5);
	animationFrame.requestAnimationFrame((firstFrameTime) => {
		const cbId = animationFrame.requestAnimationFrame((frameTime) => {
			completed = true;
		});
		animationFrame.cancelAnimationFrame(cbId);
	});

	TKUnit.wait(1);
	frameCb.stop();
	TKUnit.assert(!completed, 'Callback should not be called');
}

```

### Core Architecture Module: `apps/automated/src/app-root.ts`
```
import { Application, Frame, Page } from '@nativescript/core';

export function onLoaded(args) {
	try {
		console.log('[automated] app-root onLoaded');
		const rootPage = args.object as Page;
		// Create a Frame and navigate to main-page to ensure code-behind is bound
		const frame = new Frame();
		try {
			frame.navigate('main-page');
		} catch (e) {
			try {
				console.error('[automated] app-root onLoaded: navigate to main-page failed', e);
			} catch {}
		}
		// Replace the temporary Page root with the Frame containing the page
		try {
			if ((Application as any).resetRootView) {
				(Application as any).resetRootView({ create: () => frame });
			}
		} catch (e) {
			try {
				console.error('[automated] app-root onLoaded: resetRootView failed', e);
			} catch {}
		}
	} catch (e) {
		try {
			console.error('[automated] app-root onLoaded failed', e);
		} catch {}
	}
}

```

### Core Architecture Module: `apps/automated/src/globals.d.ts`
```
declare var __CI__;

```

### Core Architecture Module: `apps/automated/src/http/http-string-worker.ts`
```
postMessage('stub');

// todo: figure out why this worker is including the whole core and not just the Http module
// ie. tree-shaking is not working as expected here. (same setup works in a separate app)
//
// import { getString } from '@nativescript/core/http';
//
// getString('https://http-echo.nativescript.org/get').then(
// 	function (r) {
// 		postMessage(r);
// 	},
// 	function (e) {
// 		throw e;
// 	}
// );

```

### Core Architecture Module: `apps/automated/src/image-source/image-source-snippet.ts`
```
import { ImageSource } from '@nativescript/core/image-source';
import * as fs from '@nativescript/core/file-system';
// >> imagesource-from-imageasset-save-to

export function imageSourceFromAsset(imageAsset) {
	ImageSource.fromAsset(imageAsset).then((imageSource) => {
		let folder = fs.knownFolders.documents().path;
		let fileName = 'test.png';
		let path = fs.path.join(folder, fileName);
		let saved = imageSource.saveToFile(path, 'png');
		if (saved) {
			console.log('Image saved successfully!');
		}
	});
}
// << imagesource-from-imageasset-save-to

```

### Core Architecture Module: `apps/automated/src/livesync/livesync-button-page.ts`
```
export function onLoaded() {
	console.log('Button page loaded!');
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #11238** (2026-06-08): **When making use of axios CancelToken, `ReferenceError: exports is not defined at xhr.onabort` error occurs**
  *Symptoms*: ### Issue Description  When making use of axios' `CancelToken`, `ReferenceError: exports is not defined at xhr.onabort` error occurs.  In my code base I've had this issue due to a production issue and fixed it via patching the `packages/core/fetch/index.mjs` file. I replaced `exports.DOMException` with `DOMException` in these two instances:  https://github.com/NativeScript/NativeScript/blob/71d2203e1c95d009fd1daa1a15c52b9e8c10db8b/packages/core/fetch/index.mjs#L457-L463  https://github.com/NativeScript/NativeScript/blob/71d2203e1c95d009fd1daa1a15c52b9e8c10db8b/packages/core/fetch/index.mjs#L492-L496  I believe with the changes done here: https://github.com/NativeScript/NativeScript/commit/cc0b5034c4042418aa5b54f0b1f448430a9d0297, `DOMException` can be accessed from the exported classes.  If it helps I have a branch ready with the changes which I can push too :)  ### Reproduction  Sample code:  ```js // service.js let requestSource;  getData() {   if (requestSource) {     requestSource.cancel('Request cancelled!');   }    const currentSource = axios.CancelToken.source();   requestSource = currentSource;    const config = {     cancelToken: requestSource.token   };    return axios.get('api/get-data', undefined, config).finally(() => {     if (requestSource === currentSource) {       requestSource = undefined;     }   }); } ``` ```js // somewhere in app call function try {   getData(); } catch (e) {   console.log('Error ::', e); // results in ReferenceError: exports is not defin
  **Post-Mortem & Fix Analysis**:
  > By the way I forgot to mention that to trigger the issue the "cancel request" logic needs to be triggered. Meaning that making a single request will work fine, however if you trigger a request whilst an initial request was triggered the error mentioned above would occur.

- **Issue #11001** (2025-12-10): **Android targetSdkVersion 36: app is getting closed when using back-button or back-swipe gesture**
  *Symptoms*: ### Issue Description  When setting Android targetSdkVersion to 36 (Android 16), I am not able to "navigate back" anymore using the Android back button or the back-swipe gesture, as the app is getting closed (or at least suspended).  https://github.com/user-attachments/assets/9faa3ef3-a137-40d7-bed7-eee6c223471f  This is not related to NativeScript 9, I already experienced that during some short tests using the NativeScript 8.9 modules some months ago.  ### Reproduction  Sample app:  [ns9test.zip](https://github.com/user-attachments/files/23931705/ns9test.zip) It's a newly generated NS 9 app, I just added a second page.  - tap the button to navigate to the second page - use the Android back button (or swipe-gesture) to navigate back  --> app is closed  ### Relevant log output (if applicable)  ```shell  ```  ### Environment  <!-- COPY START --> ```yaml OS: macOS 26.1 CPU: (12) x64 Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz Shell: /bin/zsh node: 22.19.0 npm: 11.6.2 nativescript: 9.0.1  # android java: 17.0.11 ndk: Not Found apis: 29, 33, 34, 35, 36, 36 build_tools: 25.0.2, 27.0.3, 28.0.3, 29.0.2, 30.0.2, 30.0.3, 32.0.0, 33.0.0, 33.0.1, 33.0.2, 34.0.0, 35.0.0, 35.0.1, 36.0.0, 36.1.0 system_images:    - android-29 | Google Play Intel x86_64 Atom   - android-35 | Google Play Intel x86_64 Atom   - android-35 | Google Play Tablet Intel x86_64 Atom   - android-36.1 | Google Play Intel x86_64 Atom   - android-36.1 | Pre-Release 16 KB Page Size Google Play Intel x86_64 Atom  # ios xcode:

- **Issue #10764** (2025-07-20): **Animation of transition rotate not working**
  *Symptoms*: ### Issue Description  Animation of transition rotate does not work on iOS, when using NativeScript >= 8.9.0. This happens when using css keyframe animation or when using the Animation class. We are only developing for iOS, I do not know if this is an issue on Android. Animating other properties works as expected.  Also fails on latest pre-release: 8.9.3-next-07-11-2025-16231435223  Lowering @nativescript/core to 8.8.6 fixes the problem.  Thank You to anyone who can look into this and save our spinny.  ### Reproduction  This works: ```scss @keyframes move {   from {     transform: translate(0, 0);   }   to {     transform: translate(100, 100);   } }  .move {   animation: move 2s linear infinite forwards; } ```  This fails (nothing happens):  ```scss @keyframes spin {   from {     transform: rotate(0deg);   }   to {     transform: rotate(359deg);   } }  .spin {   animation: spin 2s linear infinite forwards; } ```  As mentioned above, this also fails (nothing happens), but animating other properties work: ``` const spinAnimation = new Animation([{   target: this.iconEl.nativeElement,   rotate: 359,   duration: 2000,   iterations: Number.POSITIVE_INFINITY,   curve: CoreTypes.AnimationCurve.linear }]);  spinAnimation.play(); ```  ### Relevant log output (if applicable)  ```shell  ```  ### Environment  ```yaml OS: macOS 15.5 CPU: (8) arm64 Apple M2 Shell: /opt/homebrew/bin/zsh node: 22.13.1 npm: 11.0.0 nativescript: 8.9.2  # android java: Not Found ndk: Not Found apis: Not Found b
  **Post-Mortem & Fix Analysis**:
  > Hey, thanks for reporting this. It seemed to work after the last improvements but there might be a corner case here. Can you try applying different values to iterations and rotate?  EDITED: We have already prepared a pull request to revert the faulty changes.
  > Sorry for the late reply. I tried a few different values for itterations and rotation. Itteration seems to work well. There must be a bit of a math misshap with the rotate value though.  transform: rotate(**X**deg);  0 < X < 180 Rotate X degrees **clockwise**  180 <= X < 360 Also rotate X degrees **counter clockwise**  -180 <= X < 0 Rotate X degrees **counter clockwise**.  -360 < X < -180 Rotate X degrees **clockwise**.  Both 0 and 360 produce no rotation and 180 produces most rotation.  I tried both the shorthand animation and expanded properties.  Sorry if this is not clear. 

- **Issue #10717** (2025-06-30): **Android 8.9 error on clip-path**
  *Symptoms*: ### Issue Description  The following code crashes the app. The problem is the last semicolon in  _clipPathTopVolume. As I just learned it should not be there at all. However, app should not crash but throw an exception instead.  <Label row="1" class="top-volume" [style.width]="_scaleX" [style.height]="_scaleY" [style.clip-path]="_clipPathTopVolume"></Label>  public _clipPathTopVolume = 'polygon(27.5% 45%, 50% 0%, 50% 0%, 72.5% 45%);';  ### Reproduction  _No response_  ### Relevant log output (if applicable)  ```shell  ```  ### Environment  <!-- COPY START --> ```yaml OS: macOS 15.3.1 CPU: (10) arm64 Apple M1 Pro Shell: /bin/zsh node: 22.14.0 npm: 10.9.2 nativescript: 8.9.1  # android java: 17.0.14 ndk: Not Found apis: Not Found build_tools: Not Found system_images: Not Found  # ios xcode: 16.2/16C5032a cocoapods: 1.16.2 python: 3.13.2 python3: 3.13.2 ruby: 3.4.2 platforms:    - DriverKit 24.2   - iOS 18.2   - macOS 15.2   - tvOS 18.2   - visionOS 2.2   - watchOS 11.2 ```  ### Dependencies  ```json "dependencies": {   "@angular/animations": "19.2.2",   "@angular/common": "19.2.2",   "@angular/compiler": "19.2.2",   "@angular/core": "19.2.2",   "@angular/forms": "19.2.2",   "@angular/platform-browser": "19.2.2",   "@angular/platform-browser-dynamic": "19.2.2",   "@angular/router": "19.2.2",   "@apollo/client": "3.13.4",   "@mnd/external-web-view": "file:../app-plugins/dist/packages/external-web-view/mnd-external-web-view-2.0.0.tgz",   "@nativescript/angular": "19.0.1",   "@nati
  **Post-Mortem & Fix Analysis**:
  > Hi @cjohn001 I would love to work on this issue! I am a full stack engineer with expertise in JavaScript, TypeScript and React. It looks like it is still up for grabs - may I work on it?

- **Issue #10702** (2025-02-21): **Android: App crash on Android version ≤ 8 when using FormattedString**
  *Symptoms*: ### Issue Description  App crashes on older devices because of `<FormattedString>`   ### Reproduction  Create a new app, use the `<FormattedString>` and run it on older Android device. I tested with Android 8.  ### Relevant log output (if applicable)  ```shell Error: Calling js method onCreateView failed Error: java.lang.NoSuchMethodError: No direct method <init>(Landroid/graphics/Typeface;)V in class Landroid/text/style/TypefaceSpan; or its super classes (declaration of 'android.text.style.TypefaceSpan' ```  ### Environment  ⚠ Update available for component nativescript. Your current version is 8.8.2 and the latest available version is 8.8.3. ⚠ Update available for component @nativescript/core. Your current version is 8.9.0-next-02-20-2025-13443308496 and the latest available version is 8.8.6. ✔ Component @nativescript/ios has 8.8.2 version and is up to date. ✔ Component @nativescript/android has 8.8.6 version and is up to date.  ### Please accept these terms  - [x] I have searched the [existing issues](https://github.com/NativeScript/NativeScript/issues) as well as [StackOverflow](https://stackoverflow.com/questions/tagged/nativescript) and this has not been posted before - [x] This is a bug report - [x] I agree to follow this project's [Code of Conduct](https://github.com/NativeScript/NativeScript/blob/master/tools/notes/CONTRIBUTING.md#coc)
  **Post-Mortem & Fix Analysis**:
  > @asharghi I suspect a 8.9 PR broke this. Can you check if it happens with 8.8?

- **Issue #10625** (2026-01-05): **Image disposal removes ImageSource content event when directly passed to the component.**
  *Symptoms*: ### Issue Description  On iOS, I have an `ImageSource` that I want to pass to some `Image` components:  ``` <Image *ngIf="cond" [src]="myImageSource"></Image> <Image *ngIf="otherCond" [src]="myImageSource"></Image> ```  But when `Image` is disposed, it clears the content of the provided `ImageSource` (`this.imageSource.ios = null; `), which makes it not reusable!  https://github.com/NativeScript/NativeScript/blob/050601232ac4f424e9d3ba6b711f3ada4afe253b/packages/core/ui/image/index.ios.ts#L29-L41  Note that when `src` is an `ImageSource`, the `_createImageSourceFromSrc` function does not create but just use the provided `ImageSource`  https://github.com/NativeScript/NativeScript/blob/050601232ac4f424e9d3ba6b711f3ada4afe253b/packages/core/ui/image/image-common.ts#L124-L127   ### Reproduction  _No response_  ### Relevant log output (if applicable)  _No response_  ### Environment  _No response_  ### Please accept these terms  - [X] I have searched the [existing issues](https://github.com/NativeScript/NativeScript/issues) as well as [StackOverflow](https://stackoverflow.com/questions/tagged/nativescript) and this has not been posted before - [X] This is a bug report - [X] I agree to follow this project's [Code of Conduct](https://github.com/NativeScript/NativeScript/blob/master/tools/notes/CONTRIBUTING.md#coc)
  **Post-Mortem & Fix Analysis**:
  > Interesting. Does android behave as expected?
  > Yep
  > How can we reproduce this? 

- **Issue #10587** (2024-07-19): **using separate id's for ios/android in nativescript.config**
  *Symptoms*: ### Issue Description  In my app I have different app identifiers for Android and iOS. After updating to Nativescript 8.8.0, Android build fails with this Gradle error:  ``` Execution failed for task ':app:processDebugGoogleServices'. No matching client found for package name 'com.tns.testapplication'  Command ./gradlew failed with exit code 1 ```  My NativeScript config: ```js {   appPath: 'app',   appResourcesPath: 'App_Resources',   android: {     id: "com.company.androidapp",     v8Flags: "--nolazy --expose_gc",     markingMode: 'none'   },   ios: {     id: "com.company.iosapp",   } } ```  If i move the id to the root of the object, the build succedes.  ```js {   id: "com.company.androidapp",   appPath: 'app',   appResourcesPath: 'App_Resources',   android: {     v8Flags: "--nolazy --expose_gc",     markingMode: 'none'   } } ```  Seems to me it doesn't parse correctly the NativeScript config in @nativescript/android/framework/app/build.gradle. Works fine on iOS.  {N} CLI: 8.0.0 @nativescript/core: 8.8.1 @nativescript/android": "8.8.0"  ### Reproduction  _No response_  ### Relevant log output (if applicable)  NativeScript build output: ``` (node:32723) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead. (Use `node --trace-deprecation ...` to show where the warning was created) Preparing project... assets by path fonts/*.ttf 2.35 MiB   asset fonts/fa-solid-90
  **Post-Mortem & Fix Analysis**:
  > Hi @tommag21 could you include the full stacktrace/build output? 
  > @NathanWalker included in the first post, is it fine?
  > Thank you, your output mentions this: > Incorrect package="com.company.androidapp" found in source AndroidManifest.xml > Setting the namespace via the package attribute in the source AndroidManifest.xml is no longer supported.  If using 8.8+ cli (`npm i -g nativescript@latest`), you can remove `AndroidManifest.xml` settings: ```xml <manifest xmlns:android="http://schemas.android.com/apk/res/android" 	package="__PACKAGE__" <--- remove this ``` so just this: ```xml <manifest xmlns:android="http://schemas.android.com/apk/res/android"> ``` and it should set it properly. Confirmed here that nativescript.config multi level bundle id is working well.

- **Issue #10515** (2024-04-15): **[android] Image tintColor set to null will cause a throwable**
  *Symptoms*: ### Issue Description  When using `<Image [tintColor]="null" ...` a throwable will occur: ```bash java.lang.Throwable Cannot read properties of null (reading 'android') .[tintColor:setNative] (vendor.js) .Style.<anonymous> (vendor.js) .set tintColor [as tintColor] (vendor.js) .ViewUtil.setPropertyInternal (vendor.js) .ViewUtil.setProperty (vendor.js) .EmulatedRenderer.setProperty (vendor.js) ```  ### Reproduction  Setting Image with `null` tintColor on Android.  ### Relevant log output (if applicable)  _No response_  ### Environment  _No response_  ### Please accept these terms  - [X] I have searched the [existing issues](https://github.com/NativeScript/NativeScript/issues) as well as [StackOverflow](https://stackoverflow.com/questions/tagged/nativescript) and this has not been posted before - [X] This is a bug report - [X] I agree to follow this project's [Code of Conduct](https://github.com/NativeScript/NativeScript/blob/master/tools/notes/CONTRIBUTING.md#coc)

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

### Incident Patch 1: `648cff75` (2026-09-30)
**Commit Message**: fix(vite): decode percent-encoded /ns/m request paths (#11483)

[skip ci]

**File**: `packages/vite/hmr/frameworks/vue/server/sfc-route-serve.ts` (modified, +4/-0)
```diff
@@ -57,6 +57,10 @@ export function registerSfcServeRoute(server: ViteDevServer, options: RegisterSf
 			}
 			if (pathStyle && pathStyle !== '/' && !pathParam) {
 				if (!pathStyle.startsWith('/')) pathStyle = '/' + pathStyle;
+				// URL.pathname stays percent-encoded; decode before the query is appended.
+				try {
+					pathStyle = decodeURI(pathStyle);
+				} catch {}
 				// Include endpoint query for variant-style requests (e.g. /ns/sfc/Comp.vue?vue&type=template)
 				pathParam = pathStyle + (urlObj.search || '');
 			}
```

**File**: `packages/vite/hmr/frameworks/vue/server/websocket-sfc.spec.ts` (modified, +11/-0)
```diff
@@ -88,6 +88,17 @@ describe('registerSfcHandlers', () => {
 			expect(res.body).toContain('export { default } from "/ns/asm?path=%2Fsrc%2FApp.vue";');
 		});
 
+		it('decodes percent-encoded path-style specs (device-encoded bracketed files)', async () => {
+			const { sfc, transformRequest } = mount();
+			transformRequest.mockResolvedValue({ code: 'export default {}' });
+			const res = makeRes();
+			await sfc({ url: '/ns/sfc/src/pages/%5Bid%5D.vue' }, res, vi.fn());
+			expect(transformRequest).toHaveBeenCalledWith('/src/pages/[id].vue?vue');
+			expect(res.statusCode).toBe(200);
+			expect(res.body).toContain('path=/src/pages/[id].vue');
+			expect(res.body).toContain(`export * from "/ns/asm?path=${encodeURIComponent('/src/pages/[id].vue')}";`);
+		});
+
 		it('returns an empty module for style variants', async () => {
 			const { sfc, transformRequest } = mount();
 			transformRequest.mockResolvedValue({ code: '/* css */' });
```

**File**: `packages/vite/hmr/server/websocket-ns-m-request.spec.ts` (modified, +36/-0)
```diff
@@ -19,6 +19,42 @@ describe('createNsMRequestContext', () => {
 		expect(result.value.bootTaggedRequest).toBe(false);
 	});
 
+	it('decodes percent-encoded pathname specs (device-encoded bracketed files)', () => {
+		const encoded = createNsMRequestContext('/ns/m/packages/app/src/app/demo/%5Bid%5D.tsrx?import', '/workspace', '/src/');
+		const raw = createNsMRequestContext('/ns/m/packages/app/src/app/demo/[id].tsrx?import', '/workspace', '/src/');
+
+		expect(encoded.kind).toBe('context');
+		expect(raw.kind).toBe('context');
+		if (encoded.kind !== 'context' || raw.kind !== 'context') {
+			return;
+		}
+
+		expect(encoded.value.spec).toBe('/packages/app/src/app/demo/[id].tsrx');
+		expect(encoded.value.spec).toBe(raw.value.spec);
+	});
+
+	it('does not double-decode the already-decoded ?path= spec', () => {
+		const result = createNsMRequestContext('/ns/m/?path=/app/demo/%255Bid%255D.tsrx', '/workspace', '/src/');
+
+		expect(result.kind).toBe('context');
+		if (result.kind !== 'context') {
+			return;
+		}
+
+		expect(result.value.spec).toBe('/app/demo/%5Bid%5D.tsrx');
+	});
+
+	it('leaves encoded reserved characters encoded, matching Vite', () => {
+		const result = createNsMRequestContext('/ns/m/app/a%3Fb%23c%2Fd.ts', '/workspace', '/src/');
+
+		expect(result.kind).toBe('context');
+		if (result.kind !== 'context') {
+			return;
+		}
+
+		expect(result.value.spec).toBe('/app/a%3Fb%23c%2Fd.ts');
+	});
+
 	it('returns a response module for blocked build-time node_modules imports', () => {
 		const result = createNsMRequestContext('/ns/m/node_modules/vite/dist/index.js', '/workspace', '/src/');
 
```

**File**: `packages/vite/hmr/server/websocket-ns-m-request.ts` (modified, +9/-0)
```diff
@@ -89,12 +89,14 @@ export function createNsMRequestContext(requestUrl: string, serverRoot: string,
 		let spec = urlObj.searchParams.get('path') || '';
 		let forcedVer = urlObj.searchParams.get('v');
 		let bootTaggedRequest = false;
+		let specFromPathname = false;
 
 		if (!spec) {
 			const base = '/ns/m';
 			const rest = urlObj.pathname.slice(base.length);
 			if (rest && rest !== '/') {
 				spec = rest;
+				specFromPathname = true;
 			}
 		}
 
@@ -115,6 +117,13 @@ export function createNsMRequestContext(requestUrl: string, serverRoot: string,
 		}
 
 		spec = spec.replace(/[?#].*$/, '');
+		// URL.pathname stays percent-encoded (URLSearchParams already decoded
+		// `path`). decodeURI matches Vite's transform middleware.
+		if (specFromPathname) {
+			try {
+				spec = decodeURI(spec);
+			} catch {}
+		}
 		const decorated = collapseLegacyNsMTags(spec, 'inbound-request-spec');
 		spec = decorated.cleanedSpec;
 		bootTaggedRequest = decorated.bootTaggedRequest;
```

---

### Incident Patch 2: `35521728` (2026-09-30)
**Commit Message**: fix(core): iOS child index mapping skips the glass effect subview (#11410)

[skip ci]

**File**: `packages/core/ui/core/view/index.ios.ts` (modified, +13/-0)
```diff
@@ -1003,6 +1003,19 @@ export class View extends ViewCommon {
 		IOSHelper.invalidateStatusBarAppearance(ownerController, `View.updateStatusBarStyle:${value}`);
 	}
 
+	public _childIndexToNativeChildIndex(index?: number): number {
+		if (typeof index !== 'number') {
+			return index;
+		}
+		// The glass effect view is a subview but not a child: it sits at subview
+		// 0, so every child's subview index is one past its child index.
+		const effectView = this._glassEffectView;
+		if (effectView && effectView.superview === this.nativeViewProtected) {
+			return index + 1;
+		}
+		return index;
+	}
+
 	[iosGlassEffectProperty.setNative](value: GlassEffectType) {
 		if (!this.nativeViewProtected || !supportsGlass()) {
 			return;
```

**File**: `packages/core/ui/layouts/layout-base-common.ts` (modified, +2/-1)
```diff
@@ -147,7 +147,8 @@ export class LayoutBaseCommon extends CustomLayoutView implements LayoutBaseDefi
 			result += this._subViews[i]._getNativeViewsCount();
 		}
 
-		return result;
+		// The platform base accounts for native subviews that are not children.
+		return super._childIndexToNativeChildIndex(result);
 	}
 
 	public eachChildView(callback: (child: View) => boolean): void {
```

---

### Incident Patch 3: `c9250ecb` (2026-09-30)
**Commit Message**: fix(core): iOS scrollToVerticalOffset lands past the offset when there is a content inset (#11409)

[skip ci]

**File**: `packages/core/ui/scroll-view/index.ios.ts` (modified, +16/-6)
```diff
@@ -153,17 +153,27 @@ export class ScrollView extends ScrollViewBase {
 		this.updateContentInsetAdjustmentBehavior(value);
 	}
 
+	// The offset is set directly rather than through scrollRectToVisible with a
+	// viewport-sized rect: that rect cannot fit inside a content inset, so UIKit
+	// would land contentInset.bottom (or .right) past the requested offset. The
+	// value is clamped to the range a user scroll can reach.
 	public scrollToVerticalOffset(value: number, animated: boolean) {
-		if (this.nativeViewProtected && this.orientation === 'vertical' && this.isScrollEnabled) {
-			const bounds = this.nativeViewProtected.bounds.size;
-			this.nativeViewProtected.scrollRectToVisibleAnimated(CGRectMake(0, value, bounds.width, bounds.height), animated);
+		const nativeView = this.nativeViewProtected;
+		if (nativeView && this.orientation === 'vertical' && this.isScrollEnabled) {
+			const inset = nativeView.adjustedContentInset;
+			const min = -inset.top;
+			const max = Math.max(min, nativeView.contentSize.height + inset.bottom - nativeView.bounds.size.height);
+			nativeView.setContentOffsetAnimated(CGPointMake(nativeView.contentOffset.x, Math.min(Math.max(value, min), max)), animated);
 		}
 	}
 
 	public scrollToHorizontalOffset(value: number, animated: boolean) {
-		if (this.nativeViewProtected && this.orientation === 'horizontal' && this.isScrollEnabled) {
-			const bounds = this.nativeViewProtected.bounds.size;
-			this.nativeViewProtected.scrollRectToVisibleAnimated(CGRectMake(value, 0, bounds.width, bounds.height), animated);
+		const nativeView = this.nativeViewProtected;
+		if (nativeView && this.orientation === 'horizontal' && this.isScrollEnabled) {
+			const inset = nativeView.adjustedContentInset;
+			const min = -inset.left;
+			const max = Math.max(min, nativeView.contentSize.width + inset.right - nativeView.bounds.size.width);
+			nativeView.setContentOffsetAnimated(CGPointMake(Math.min(Math.max(value, min), max), nativeView.contentOffset.y), animated);
 		}
 	}
 
```

---

### Incident Patch 4: `5fa2a5bd` (2026-09-30)
**Commit Message**: fix(core): insert iOS child views relative to their sibling, not by raw index (#11406)

[skip ci]

**File**: `packages/core/ui/action-bar/index.android.ts` (modified, +1/-5)
```diff
@@ -385,11 +385,7 @@ export class ActionBar extends ActionBarBase {
 		super._addViewToNativeVisualTree(child);
 
 		if (this.nativeViewProtected && child.nativeViewProtected) {
-			if (atIndex >= this.nativeViewProtected.getChildCount()) {
-				this.nativeViewProtected.addView(child.nativeViewProtected);
-			} else {
-				this.nativeViewProtected.addView(child.nativeViewProtected, atIndex);
-			}
+			AndroidHelper.insertNativeSubview(this.nativeViewProtected, child.nativeViewProtected, atIndex);
 
 			return true;
 		}
```

**File**: `packages/core/ui/core/view/index.android.ts` (modified, +1/-1)
```diff
@@ -1826,7 +1826,7 @@ export class CustomLayoutView extends ContainerView {
 			if (Trace.isEnabled()) {
 				Trace.write(`${this}.nativeView.addView(${child}.nativeView, ${atIndex})`, Trace.categories.VisualTreeEvents);
 			}
-			this.nativeViewProtected.addView(child.nativeViewProtected, atIndex);
+			AndroidHelper.insertNativeSubview(this.nativeViewProtected, child.nativeViewProtected, atIndex);
 			if (child instanceof View) {
 				this._updateNativeLayoutParams(child);
 			}
```

**File**: `packages/core/ui/core/view/index.ios.ts` (modified, +1/-5)
```diff
@@ -1270,11 +1270,7 @@ export class CustomLayoutView extends ContainerView {
 		const childNativeView: NativeScriptUIView = <NativeScriptUIView>child.nativeViewProtected;
 
 		if (parentNativeView && childNativeView) {
-			if (typeof atIndex !== 'number' || atIndex >= parentNativeView.subviews.count) {
-				parentNativeView.addSubview(childNativeView);
-			} else {
-				parentNativeView.insertSubviewAtIndex(childNativeView, atIndex);
-			}
+			IOSHelper.insertNativeSubview(parentNativeView, childNativeView, atIndex);
 
 			// Add outer shadow layer manually as it belongs to parent layer tree (this is needed for reusable views)
 			if (childNativeView.outerShadowContainerLayer && !childNativeView.outerShadowContainerLayer.superlayer) {
```

**File**: `packages/core/ui/core/view/view-helper/index.android.spec.ts` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+import { describe, it, expect, vi } from 'vitest';
+
+vi.hoisted(() => {
+	(globalThis as any).androidx = { core: { graphics: {} } };
+});
+
+import { AndroidHelper } from './index.android';
+
+/** Models android.view.ViewGroup, including its IndexOutOfBoundsException for out-of-range indexes. */
+class FakeViewGroup {
+	readonly children: string[] = [];
+
+	getChildCount(): number {
+		return this.children.length;
+	}
+
+	addView(view: string, index?: number): void {
+		if (index === undefined || index === -1) {
+			this.children.push(view);
+			return;
+		}
+		if (index < 0 || index > this.children.length) {
+			throw new Error(`IndexOutOfBoundsException: index=${index} count=${this.children.length}`);
+		}
+		this.children.splice(index, 0, view);
+	}
+}
+
+function parentWith(...views: string[]): FakeViewGroup {
+	const parent = new FakeViewGroup();
+	parent.children.push(...views);
+	return parent;
+}
+
+describe('AndroidHelper.insertNativeSubview', () => {
+	it('inserts at the child index', () => {
+		const parent = parentWith('a', 'b', 'c');
+		AndroidHelper.insertNativeSubview(parent as any, 'x' as any, 1);
+		expect(parent.children).toEqual(['a', 'x', 'b', 'c']);
+	});
+
+	it('appends when the index is absent, negative, or out of range', () => {
+		const parent = parentWith('a', 'b');
+		AndroidHelper.insertNativeSubview(parent as any, 'x' as any);
+		AndroidHelper.insertNativeSubview(parent as any, 'y' as any, -1);
+		AndroidHelper.insertNativeSubview(parent as any, 'z' as any, Number.MAX_SAFE_INTEGER);
+		expect(parent.children).toEqual(['a', 'b', 'x', 'y', 'z']);
+	});
+});
```

**File**: `packages/core/ui/core/view/view-helper/index.android.ts` (modified, +8/-0)
```diff
@@ -51,6 +51,14 @@ export class AndroidHelper {
 		}
 	}
 
+	static insertNativeSubview(parentNativeView: android.view.ViewGroup, childNativeView: android.view.View, atIndex?: number): void {
+		if (typeof atIndex !== 'number' || atIndex < 0 || atIndex >= parentNativeView.getChildCount()) {
+			parentNativeView.addView(childNativeView);
+		} else {
+			parentNativeView.addView(childNativeView, atIndex);
+		}
+	}
+
 	static getCopyOrDrawable(drawable: android.graphics.drawable.Drawable, resources?: android.content.res.Resources): android.graphics.drawable.Drawable {
 		if (drawable) {
 			const constantState = drawable.getConstantState();
```

---

### Incident Patch 5: `282205d2` (2026-09-30)
**Commit Message**: fix(vite): start HMR graph population after every plugin's configureServer (#11479)

[skip ci]

**File**: `packages/vite/hmr/server/websocket-populate-order.spec.ts` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
+import { tmpdir } from 'node:os';
+import { join } from 'node:path';
+import { createServer, type Plugin } from 'vite';
+import { afterEach, describe, expect, it } from 'vitest';
+
+import { getProjectAppPath } from '../../helpers/utils.js';
+import { hmrWebSocketPluginForFlavor } from './websocket.js';
+
+describe('HMR graph population start', () => {
+	let root: string;
+
+	afterEach(() => {
+		rmSync(root, { recursive: true, force: true });
+	});
+
+	it('waits until every plugin has run configureServer before transforming app modules', async () => {
+		root = realpathSync(mkdtempSync(join(tmpdir(), 'ns-hmr-populate-order-')));
+		mkdirSync(join(root, getProjectAppPath()), { recursive: true });
+		writeFileSync(join(root, getProjectAppPath(), 'probe.ts'), 'export const probe = 1;\n');
+
+		// Stands in for plugins ordered between the HMR plugin and the framework
+		// plugin whose configureServer awaits (the vue config's type-check plugins).
+		const slowPlugin: Plugin = {
+			name: 'slow-configure-server',
+			async configureServer() {
+				await new Promise((resolve) => setTimeout(resolve, 150));
+			},
+		};
+		// Stands in for @vitejs/plugin-vue, which only receives the dev server in
+		// its own configureServer and compiles SFCs differently before that.
+		let configured = false;
+		const transformsBeforeConfigured: string[] = [];
+		const transformsAfterConfigured: string[] = [];
+		const lateFrameworkPlugin: Plugin = {
+			name: 'late-framework-plugin',
+			configureServer() {
+				configured = true;
+			},
+			transform(_code, id) {
+				(configured ? transformsAfterConfigured : transformsBeforeConfigured).push(id);
+			},
+		};
+
+		const server = await createServer({
+			root,
+			configFile: false,
+			logLevel: 'silent',
+			server: { port: 0, hmr: false },
+			plugins: [hmrWebSocketPluginForFlavor('typescript', {})!, slowPlugin, lateFrameworkPlugin],
+		});
+		try {
+			await new Promise((resolve) => setTimeout(resolve, 300));
+			expect(configured).toBe(true);
+			expect(transformsBeforeConfigured).toEqual([]);
+			expect(transformsAfterConfigured).toContain(join(root, getProjectAppPath(), 'probe.ts'));
+		} finally {
+			await server.close();
+		}
+	});
+});
```

**File**: `packages/vite/hmr/server/websocket.ts` (modified, +22/-18)
```diff
@@ -531,24 +531,16 @@ function createHmrWebSocketPlugin(opts: { verbose?: boolean }, strategy: Framewo
 				next();
 			});
 
-			// Give `populateInitialGraph` a head start: kicking it off at
-			// `configureServer` time gives populate the full app build/launch
-			// window (typically 2-3s on simulator), so more of its work lands
-			// before the device even connects and starts competing for the
-			// transform slots. Disable via `NS_VITE_HMR_DISABLE_POPULATE=1`
-			// when profiling whether populate is helping or hurting a
-			// specific app.
-			try {
-				const disablePopulate = process.env.NS_VITE_HMR_DISABLE_POPULATE === '1' || process.env.NS_VITE_HMR_DISABLE_POPULATE === 'true';
-				if (disablePopulate) {
-					if (verbose) console.info('[hmr-ws][populate] disabled via NS_VITE_HMR_DISABLE_POPULATE');
-					// Short-circuit: mark as resolved so /ns/m never schedules it and
-					// HMR still works (handleHotUpdate just has no pre-warmed graph).
-					graphInitialPopulationPromise = Promise.resolve();
-				} else {
-					ensureInitialGraphPopulationStarted(server);
-				}
-			} catch {}
+			// Populate is started from the post hook returned below, not here.
+			// Disable via `NS_VITE_HMR_DISABLE_POPULATE=1` when profiling whether
+			// populate is helping or hurting a specific app.
+			const disablePopulate = process.env.NS_VITE_HMR_DISABLE_POPULATE === '1' || process.env.NS_VITE_HMR_DISABLE_POPULATE === 'true';
+			if (disablePopulate) {
+				if (verbose) console.info('[hmr-ws][populate] disabled via NS_VITE_HMR_DISABLE_POPULATE');
+				// Short-circuit: mark as resolved so /ns/m never schedules it and
+				// HMR still works (handleHotUpdate just has no pre-warmed graph).
+				graphInitialPopulationPromise = Promise.resolve();
+			}
 
 			// Attempt early vendor manifest bootstrap once per server.
 			if (!vendorBootstrapDone) {
@@ -801,6 +793,18 @@ function createHmrWebSocketPlugin(opts: { verbose?: boolean }, strategy: Framewo
 				}
 				moduleGraph.emitFullGraph(ws as any);
 			});
+
+			// Vite runs post hooks after every plugin's `configureServer`. Starting
+			// populate any earlier transforms modules before framework plugins hold
+			// the dev server (@vitejs/plugin-vue then emits SFCs without HMR code
+			// and with their script imports split out of the graph), and the shared
+			// transform cache serves those results to the device. It still gets the
+			// whole app build/launch window as a head start.
+			return () => {
+				try {
+					ensureInitialGraphPopulationStarted(server);
+				} catch {}
+			};
 		},
 
 		async handleHotUpdate(ctx) {
```

---

### Incident Patch 6: `e3719ada` (2026-09-29)
**Commit Message**: fix(vite): hot-update vue screens on plain .ts edits (#11478)

[skip ci]

**File**: `packages/vite/hmr/frameworks/angular/server/strategy.ts` (modified, +1/-1)
```diff
@@ -822,7 +822,7 @@ export const angularServerStrategy: FrameworkServerStrategy = {
 			}
 		}
 
-		walkForTemplates(path.join(root, 'src'));
+		walkForTemplates(path.join(root, ANGULAR_APP_DIR));
 		try {
 			for (const abs of templateFiles) {
 				try {
```

**File**: `packages/vite/hmr/frameworks/vue/client/index.ts` (modified, +1/-1)
```diff
@@ -539,7 +539,7 @@ function openHmrReplaceNavWindow(): () => void {
  * that matches no live instances is a no-op (component not currently
  * displayed); the caller treats that as handled.
  */
-function tryInPlaceVueReload(comp: any, rerenderOnly = false): boolean {
+export function tryInPlaceVueReload(comp: any, rerenderOnly = false): boolean {
 	try {
 		const rt: any = (getGlobalScope() as any).__VUE_HMR_RUNTIME__;
 		const id = comp && comp.__hmrId;
```

**File**: `packages/vite/hmr/frameworks/vue/client/strategy.spec.ts` (modified, +34/-0)
```diff
@@ -24,6 +24,7 @@ function makeDeps(overrides: Partial<VueDepPropagationDeps> = {}): VueDepPropaga
 	return {
 		findBoundaries: findNearestSfcBoundaries,
 		loadComponent: vi.fn(async () => ({ name: 'FreshComponent' })),
+		reloadInPlace: vi.fn(() => false),
 		sfcChangedInVersion: () => false,
 		getVersion: () => 42,
 		driveOverlay: driveVueSfcUpdateOverlay,
@@ -65,6 +66,39 @@ describe('propagateDepChangeToSfcBoundary', () => {
 		expect(stages).toEqual(['evicting', 'reimporting', 'rebooting', 'complete']);
 	});
 
+	it('reloads every importing .vue boundary in place, keeping the mounted root', async () => {
+		const graph = makeGraph([
+			['/app/app.ts', ['/app/components/Home.vue']],
+			['/app/components/Home.vue', ['/app/screens/ListenNow.vue', '/app/screens/AlbumDetail.vue']],
+			['/app/screens/AlbumDetail.vue', ['/app/music.ts']],
+			['/app/screens/ListenNow.vue', ['/app/music.ts']],
+			['/app/music.ts', []],
+		]);
+		const stages: string[] = [];
+		const ctx = makeCtx({ graph, getOverlay: () => ({ setUpdateStage: (stage: string) => stages.push(stage) }) });
+		const deps = makeDeps({ loadComponent: vi.fn(async (target: string) => ({ target })), reloadInPlace: vi.fn(() => true) });
+
+		expect(await propagateDepChangeToSfcBoundary(['/app/music.ts'], ctx, deps)).toBe(true);
+		expect(deps.reloadInPlace).toHaveBeenCalledWith({ target: '/app/screens/AlbumDetail.vue' });
+		expect(deps.reloadInPlace).toHaveBeenCalledWith({ target: '/app/screens/ListenNow.vue' });
+		expect(ctx.performResetRoot).not.toHaveBeenCalled();
+		expect(stages).toEqual(['evicting', 'reimporting', 'complete']);
+	});
+
+	it('remounts only the nearest boundary as root when in-place reload is unavailable', async () => {
+		const graph = makeGraph([
+			['/app/screens/AlbumDetail.vue', ['/app/music.ts']],
+			['/app/screens/ListenNow.vue', ['/app/music.ts']],
+			['/app/music.ts', []],
+		]);
+		const ctx = makeCtx({ graph });
+		const deps = makeDeps({ loadComponent: vi.fn(async (target: string) => ({ target })) });
+
+		expect(await propagateDepChangeToSfcBoundary(['/app/music.ts'], ctx, deps)).toBe(true);
+		expect(deps.loadComponent).toHaveBeenCalledTimes(1);
+		expect(ctx.performResetRoot).toHaveBeenCalledWith({ target: '/app/screens/AlbumDetail.vue' });
+	});
+
 	it('falls back when no .vue boundary imports the changed module', async () => {
 		const ctx = makeCtx({ graph: makeGraph([['/src/app.ts', ['/src/util.ts']]]) });
 		const deps = makeDeps();
```

**File**: `packages/vite/hmr/frameworks/vue/client/strategy.ts` (modified, +27/-20)
```diff
@@ -1,8 +1,8 @@
 import type { FrameworkClientStrategy, FrameworkClientMountContext, FrameworkClientBatchContext, FrameworkClientMessageContext } from '../../../client/framework-client-strategy.js';
 import { ENV_VERBOSE as VERBOSE, getGraphVersion } from '../../../client/utils.js';
-import { installNsVueDevShims, ensureBackWrapperInstalled, getRootForVue, loadSfcComponent, ensureVueGlobals, recordVuePayloadChanges, handleVueSfcRegistry, handleVueSfcRegistryUpdate, sfcArtifactMap, sfcChangedInVersion } from './index.js';
+import { installNsVueDevShims, ensureBackWrapperInstalled, getRootForVue, loadSfcComponent, ensureVueGlobals, recordVuePayloadChanges, handleVueSfcRegistry, handleVueSfcRegistryUpdate, sfcArtifactMap, sfcChangedInVersion, tryInPlaceVueReload } from './index.js';
 import { installVueNavigateUsingApp } from './navigate-app.js';
-import { driveVueSfcUpdateOverlay } from './vue-sfc-update-overlay.js';
+import { APPLIED_IN_PLACE, driveVueSfcUpdateOverlay } from './vue-sfc-update-overlay.js';
 import { findNearestSfcBoundaries } from './dep-propagation.js';
 
 const VUE_SFC_RE = /\.vue$/i;
@@ -11,6 +11,7 @@ const VUE_SFC_RE = /\.vue$/i;
 export interface VueDepPropagationDeps {
 	findBoundaries: typeof findNearestSfcBoundaries;
 	loadComponent: (targetVuePath: string) => Promise<any | null>;
+	reloadInPlace: (component: any) => boolean;
 	sfcChangedInVersion: (version: number) => boolean;
 	getVersion: () => number;
 	driveOverlay: typeof driveVueSfcUpdateOverlay;
@@ -19,22 +20,25 @@ export interface VueDepPropagationDeps {
 const defaultPropagationDeps: VueDepPropagationDeps = {
 	findBoundaries: findNearestSfcBoundaries,
 	loadComponent: loadSfcComponent,
+	reloadInPlace: (component) => tryInPlaceVueReload(component),
 	sfcChangedInVersion,
 	getVersion: getGraphVersion,
 	driveOverlay: driveVueSfcUpdateOverlay,
 };
 
 /**
  * Non-SFC dependency propagation. When a plain `.ts`/`.js` module changes, the
- * shared queue evicts + re-imports it, but the live component instance still
- * holds bindings to the OLD module instance — nothing on the Vue side remounts
+ * shared queue evicts + re-imports it, but the live component instances still
+ * hold bindings to the OLD module instance — nothing on the Vue side remounts
  * (the server only emits `ns:vue-sfc-registry-update` for `.vue` edits). Walk
- * the reverse import graph to the nearest `.vue` boundary and remount it the
- * same way the registry-update path does: `loadSfcComponent` re-assembles the
- * SFC at the bumped graph version, whose rewritten static imports resolve to
- * the freshly re-imported dep modules.
+ * the reverse import graph to every `.vue` boundary, re-assemble each one
+ * (`loadSfcComponent` links the freshly re-imported deps) and reload its
+ * mounted instances in place, as the registry-update path does. Boundaries
+ * with no mounted instance are a no-op for Vue's HMR runtime, so only visible
+ * components re-render and the app shell and navigation stay put. Without the
+ * runtime, the nearest boundary is remounted as the root instead.
  *
- * Returns true when a boundary remount cycle ran (and drove the overlay to
+ * Returns true when a propagation cycle ran (and drove the overlay to
  * 'complete' itself); false when the caller should fall through to the plain
  * overlay-complete frame (no boundary found, mixed batch handled by the
  * registry-update path, or missing context).
@@ -48,20 +52,23 @@ export async function propagateDepChangeToSfcBoundary(drained: string[], ctx: Fr
 		}
 		const boundaries = deps.findBoundaries(drained, ctx.graph);
 		if (!boundaries.length) return false;
-		// Remount the NEAREST boundary only — resetRoot replaces the whole root,
-		// so multiple resets would be wasted work with last-wins semantics. This
-		// mirrors the registry-update policy of remounting the SFC closest to the
-		// change. Surface skipped boundaries so multi-importer cases are diagnosable.
-		const target = boundaries[0];
-		if
```

**File**: `packages/vite/hmr/server/runtime-graph-filter.spec.ts` (modified, +28/-1)
```diff
@@ -1,6 +1,9 @@
+import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
+import { tmpdir } from 'node:os';
+import { join } from 'node:path';
 import { describe, expect, it } from 'vitest';
 
-import { isRuntimeGraphExcludedPath, matchesRuntimeGraphModuleId, shouldIncludeRuntimeGraphFile } from './runtime-graph-filter.js';
+import { isRuntimeGraphExcludedPath, listRuntimeGraphSourceFiles, matchesRuntimeGraphModuleId, shouldIncludeRuntimeGraphFile } from './runtime-graph-filter.js';
 
 const TS_PATTERN = /\.(ts|js|tsx|jsx|mjs)$/i;
 
@@ -45,3 +48,27 @@ describe('shouldIncludeRuntimeGraphFile / matchesRuntimeGraphModuleId', () => {
 		expect(matchesRuntimeGraphModuleId('/src/main.ts', '/src/', TS_PATTERN)).toBe(true);
 	});
 });
+
+describe('listRuntimeGraphSourceFiles', () => {
+	it('lists runtime source files under the app dir and skips dependency, hidden and test dirs', () => {
+		const root = realpathSync(mkdtempSync(join(tmpdir(), 'ns-runtime-graph-walk-')));
+		try {
+			const write = (rel: string) => {
+				mkdirSync(join(root, rel, '..'), { recursive: true });
+				writeFileSync(join(root, rel), '');
+			};
+			for (const rel of ['app/music.ts', 'app/screens/ListenNow.vue', 'app/app.css', 'app/types.d.ts', 'app/music.spec.ts', 'app/__mocks__/x.ts', 'app/node_modules/pkg/index.js', 'app/.cache/x.ts', 'src/other.ts']) {
+				write(rel);
+			}
+
+			const files = listRuntimeGraphSourceFiles(join(root, 'app'), /\.(vue|ts|js|mjs|tsx|jsx)$/i).sort();
+			expect(files).toEqual([join(root, 'app/music.ts'), join(root, 'app/screens/ListenNow.vue')]);
+		} finally {
+			rmSync(root, { recursive: true, force: true });
+		}
+	});
+
+	it('returns nothing for a missing dir', () => {
+		expect(listRuntimeGraphSourceFiles(join(tmpdir(), 'ns-runtime-graph-missing-dir'), TS_PATTERN)).toEqual([]);
+	});
+});
```

---

### Incident Patch 7: `19b70712` (2026-09-29)
**Commit Message**: fix: keep escaped commas inside CSS selectors (#11463)

[skip ci]

**File**: `packages/core/css/css-tree-parser.spec.ts` (modified, +7/-0)
```diff
@@ -13,6 +13,13 @@ describe('CssTreeParser', () => {
 		expect(reworkAST.stylesheet.rules[0].declarations[0].value).toBe('red');
 	});
 
+	it('keeps escaped commas inside a selector', () => {
+		const testCase = '.grid-cols-\\[repeat\\(auto-fill\\,minmax\\(260px\\,1fr\\)\\)\\], .a\\\\, .b { color: red; }';
+		const expected = ['.grid-cols-\\[repeat\\(auto-fill\\,minmax\\(260px\\,1fr\\)\\)\\]', '.a\\\\', '.b'];
+		expect(reworkCssParse(testCase, { source: 'file.css' }).stylesheet.rules[0].selectors).toEqual(expected);
+		expect(cssTreeParse(testCase, 'file.css').stylesheet.rules[0].selectors).toEqual(expected);
+	});
+
 	it('empty rule', () => {
 		const css = `.test {
 	        color: red;
```

**File**: `packages/core/css/css-tree-parser.ts` (modified, +5/-1)
```diff
@@ -5,7 +5,11 @@ function mapSelectors(selector: string): string[] {
 		return [];
 	}
 
-	return selector.split(/\s*(?![^(]*\)),\s*/).map((s) => s.replace(/\u200C/g, ','));
+	// escaped commas (Tailwind arbitrary values) are part of the selector
+	return selector
+		.replace(/\\[\s\S]/g, (m) => (m === '\\,' ? '\\\u200C' : m))
+		.split(/\s*(?![^(]*\)),\s*/)
+		.map((s) => s.replace(/\u200C/g, ','));
 }
 
 function mapPosition(node, css) {
```

**File**: `packages/core/css/lib/parse/index.ts` (modified, +5/-1)
```diff
@@ -195,12 +195,16 @@ export function parse(css, options) {
 		var m = match(/^([^{]+)/);
 		if (!m) return;
 		/* @fix Remove all comments from selectors
-		 * http://ostermiller.org/findcomment.html */
+		 * http://ostermiller.org/findcomment.html
+		 * Escaped commas (Tailwind arbitrary values) are masked like quoted ones. */
 		return trim(m[0])
 			.replace(/\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*\/+/g, '')
 			.replace(/"(?:\\"|[^"])*"|'(?:\\'|[^'])*'/g, function (m) {
 				return m.replace(/,/g, '\u200C');
 			})
+			.replace(/\\[\s\S]/g, function (m) {
+				return m === '\\,' ? '\\\u200C' : m;
+			})
 			.split(/\s*(?![^(]*\)),\s*/)
 			.map(function (s) {
 				return s.replace(/\u200C/g, ',');
```

**File**: `packages/vite/helpers/css-ast.spec.ts` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+import { describe, expect, it } from 'vitest';
+
+import { joinEscapedSelectorCommas, parseCssAst } from './css-ast.js';
+
+describe('parseCssAst', () => {
+	it('keeps an escaped comma inside a class name', () => {
+		const ast = parseCssAst('.grid-cols-\\[repeat\\(auto-fill\\,minmax\\(260\\,1fr\\)\\)\\] { grid-template-columns: repeat(auto-fill,minmax(260,1fr)); }');
+		expect(ast.stylesheet.rules[0].selectors).toEqual(['.grid-cols-\\[repeat\\(auto-fill\\,minmax\\(260\\,1fr\\)\\)\\]']);
+	});
+
+	it('still splits a real selector list', () => {
+		const ast = parseCssAst('.a\\,b, .c { color: red; }');
+		expect(ast.stylesheet.rules[0].selectors).toEqual(['.a\\,b', '.c']);
+	});
+
+	it('repairs rules nested in at-rules', () => {
+		const ast = parseCssAst('@media (min-width: 1px) { .x-\\[a\\,b\\] { color: red; } }');
+		expect(ast.stylesheet.rules[0].rules[0].selectors).toEqual(['.x-\\[a\\,b\\]']);
+	});
+});
+
+describe('joinEscapedSelectorCommas', () => {
+	it('does not join after an escaped backslash', () => {
+		// `.a\\` ends in an escaped backslash, so the comma after it is a real separator.
+		expect(joinEscapedSelectorCommas(['.a\\\\', '.b'])).toEqual(['.a\\\\', '.b']);
+	});
+});
```

**File**: `packages/vite/helpers/css-ast.ts` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+import { parse } from 'css';
+
+/**
+ * Rejoins selectors that `css` split at an escaped comma.
+ *
+ * `css` splits a rule's selector list on every comma outside parentheses, and
+ * treats an escaped `\(` as a parenthesis for that purpose, so an escaped
+ * `\,` inside a class name splits the class: Tailwind's
+ * `.grid-cols-\[repeat\(auto-fill\,minmax\(260\,1fr\)\)\]` became
+ * `.grid-cols-\[repeat\(auto-fill\` and `minmax\(260\,1fr\)\)\]`, neither of
+ * which matches anything. A piece that ends in an odd number of backslashes
+ * ended on an escaped comma, so it is glued back to the next one.
+ */
+export function joinEscapedSelectorCommas(selectors: string[]): string[] {
+	const joined: string[] = [];
+	for (const selector of selectors) {
+		const previous = joined[joined.length - 1];
+		if (previous !== undefined && /(?:^|[^\\])(?:\\\\)*\\$/.test(previous)) {
+			joined[joined.length - 1] = `${previous},${selector}`;
+		} else {
+			joined.push(selector);
+		}
+	}
+	return joined;
+}
+
+function repairRules(rules: any[] | undefined): void {
+	if (!Array.isArray(rules)) return;
+	for (const rule of rules) {
+		if (Array.isArray(rule?.selectors)) {
+			rule.selectors = joinEscapedSelectorCommas(rule.selectors);
+		}
+		// @media, @supports, @document, @host, ... nest their rules.
+		repairRules(rule?.rules);
+	}
+}
+
+/** `css`'s parse, with selector lists repaired (see joinEscapedSelectorCommas). */
+export function parseCssAst(code: string, options?: { silent?: boolean; source?: string }): any {
+	const ast: any = parse(code, options);
+	repairRules(ast?.stylesheet?.rules);
+	return ast;
+}
```

---

### Incident Patch 8: `89014ecb` (2026-09-29)
**Commit Message**: fix(vite): resolve a file before a same-named directory (#11464)

[skip ci]

**File**: `packages/vite/helpers/resolver.ts` (modified, +10/-14)
```diff
@@ -1,6 +1,6 @@
 import type { Plugin } from 'vite';
 import path from 'path';
-import { resolveNativeScriptPlatformFile } from './utils.js';
+import { resolveNativeScriptPlatformModule } from './utils.js';
 import { normalizeModuleId } from './normalize-id.js';
 
 const normalizeImporterId = (importer: string): string => {
@@ -25,19 +25,15 @@ export default function NativeScriptPlugin(options: { platform: 'ios' | 'android
 			}
 
 			const resolved = path.resolve(path.dirname(normalizeImporterId(importer)), source);
-			const extVariants = ['.ts', '.js'];
-
-			for (const ext of extVariants) {
-				const file = resolveNativeScriptPlatformFile(resolved + ext, platform);
-				if (file) {
-					// Canonicalize before handing the id to Rolldown. `path.resolve`
-					// emits backslashes on Windows; the @nativescript/core alias and
-					// Vite's own resolver emit forward slashes. Returning the raw
-					// backslash form here makes Rolldown treat the same core file as a
-					// second module, double-evaluating widthProperty.register. No-op on
-					// POSIX. See normalize-id.ts for the full rationale.
-					return normalizeModuleId(file);
-				}
+			const file = resolveNativeScriptPlatformModule(resolved, ['.ts', '.js'], platform);
+			if (file) {
+				// Canonicalize before handing the id to Rolldown. `path.resolve`
+				// emits backslashes on Windows; the @nativescript/core alias and
+				// Vite's own resolver emit forward slashes. Returning the raw
+				// backslash form here makes Rolldown treat the same core file as a
+				// second module, double-evaluating widthProperty.register. No-op on
+				// POSIX. See normalize-id.ts for the full rationale.
+				return normalizeModuleId(file);
 			}
 
 			return null;
```

**File**: `packages/vite/helpers/utils.spec.ts` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+import fs from 'fs';
+import os from 'os';
+import path from 'path';
+import { afterAll, describe, expect, it } from 'vitest';
+
+import { resolveNativeScriptPlatformFile, resolveNativeScriptPlatformModule } from './utils.js';
+
+describe('resolveNativeScriptPlatformFile', () => {
+	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-resolve-'));
+	const write = (file: string) => {
+		const full = path.join(root, file);
+		fs.mkdirSync(path.dirname(full), { recursive: true });
+		fs.writeFileSync(full, '');
+		return full;
+	};
+
+	afterAll(() => fs.rmSync(root, { recursive: true, force: true }));
+
+	it('prefers a file over a directory of the same name, as Node does', () => {
+		const file = write('pkg/platform.js');
+		write('pkg/platform/index.ios.js');
+		expect(resolveNativeScriptPlatformFile(path.join(root, 'pkg/platform.js'), 'ios')).toBe(file);
+	});
+
+	it('prefers the platform file over the plain one', () => {
+		write('a/view.js');
+		const platform = write('a/view.ios.js');
+		expect(resolveNativeScriptPlatformFile(path.join(root, 'a/view.js'), 'ios')).toBe(platform);
+	});
+
+	it('falls back to the directory barrel', () => {
+		const index = write('b/application/index.ios.js');
+		expect(path.normalize(resolveNativeScriptPlatformFile(path.join(root, 'b/application.js'), 'ios')!)).toBe(index);
+	});
+
+	it('returns undefined when nothing matches', () => {
+		expect(resolveNativeScriptPlatformFile(path.join(root, 'missing.js'), 'ios')).toBeUndefined();
+	});
+});
+
+describe('resolveNativeScriptPlatformModule', () => {
+	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-resolve-module-'));
+	const write = (file: string) => {
+		const full = path.join(root, file);
+		fs.mkdirSync(path.dirname(full), { recursive: true });
+		fs.writeFileSync(full, '');
+		return full;
+	};
+
+	afterAll(() => fs.rmSync(root, { recursive: true, force: true }));
+
+	it('prefers a file with a later extension over a directory barrel with an earlier one', () => {
+		const file = write('pkg/platform.js');
+		write('pkg/platform/index.ios.ts');
+		expect(resolveNativeScriptPlatformModule(path.join(root, 'pkg/platform'), ['.ts', '.js'], 'ios')).toBe(file);
+	});
+
+	it('falls back to the directory barrel', () => {
+		const index = write('b/application/index.ios.js');
+		expect(resolveNativeScriptPlatformModule(path.join(root, 'b/application'), ['.ts', '.js'], 'ios')).toBe(index);
+	});
+});
```

**File**: `packages/vite/helpers/utils.ts` (modified, +30/-10)
```diff
@@ -39,21 +39,41 @@ export function nsConfigToJson() {
  */
 export function resolveNativeScriptPlatformFile(id: string, platform: string): string | undefined {
 	const ext = path.extname(id);
-	const base = id.slice(0, -ext.length);
+	return resolveNativeScriptPlatformModule(id.slice(0, -ext.length), [ext], platform);
+}
 
-	let platformFile = `${base}.${platform}${ext}`;
-	if (fs.existsSync(platformFile)) {
-		return platformFile;
+/**
+ * Resolves an extensionless module path the way Node and webpack do: every
+ * file candidate (`base.<platform>.ext`, then `base.ext`, per extension)
+ * before any directory barrel (`base/index.<platform>.ext`), so a package
+ * shipping both `platform.js` and a `platform/` directory gets the file.
+ */
+export function resolveNativeScriptPlatformModule(base: string, extensions: readonly string[], platform: string): string | undefined {
+	for (const ext of extensions) {
+		const platformFile = `${base}.${platform}${ext}`;
+		if (isFile(platformFile)) {
+			return platformFile;
+		}
+		if (isFile(base + ext)) {
+			return base + ext;
+		}
 	}
-
 	// core uses indices for many barrels
-	platformFile = `${base}/index.${platform}${ext}`;
-	if (fs.existsSync(platformFile)) {
-		return platformFile;
+	for (const ext of extensions) {
+		const platformIndex = `${base}/index.${platform}${ext}`;
+		if (isFile(platformIndex)) {
+			return platformIndex;
+		}
 	}
+	return undefined;
+}
 
-	// fallback to non-platform file
-	return fs.existsSync(id) ? id : undefined;
+function isFile(file: string): boolean {
+	try {
+		return fs.statSync(file).isFile();
+	} catch {
+		return false;
+	}
 }
 
 /**
```

**File**: `packages/vite/helpers/workers.ts` (modified, +6/-13)
```diff
@@ -1,6 +1,6 @@
 import path from 'path';
 import type { Plugin } from 'vite';
-import { nsConfigToJson, resolveNativeScriptPlatformFile } from './utils.js';
+import { nsConfigToJson, resolveNativeScriptPlatformModule } from './utils.js';
 import { createTsConfigPathsResolver, getTsConfigData } from './ts-config-paths.js';
 import { packagePlatformResolverPlugin } from './package-platform-aliases.js';
 import { nativescriptPackageResolver } from './nativescript-package-resolver.js';
@@ -131,18 +131,11 @@ export function getWorkerPlugins(platformOrOpts: string | WorkerPluginsOptions)
 				if (importer) {
 					const resolvedPath = path.resolve(path.dirname(importer), id);
 
-					// Try different extensions with platform-specific resolution
-					const extensions = ['.js', '.mjs', '.ts'];
-
-					for (const ext of extensions) {
-						const testPath = resolvedPath + ext;
-						// Use the existing NativeScript platform file resolver
-						const platformResolvedFile = resolveNativeScriptPlatformFile(testPath, platform);
-						if (platformResolvedFile) {
-							// Canonicalize so the worker bundle dedupes core the same way
-							// the main bundle does (forward slash + uppercase Windows drive).
-							return normalizeModuleId(platformResolvedFile);
-						}
+					const platformResolvedFile = resolveNativeScriptPlatformModule(resolvedPath, ['.js', '.mjs', '.ts'], platform);
+					if (platformResolvedFile) {
+						// Canonicalize so the worker bundle dedupes core the same way
+						// the main bundle does (forward slash + uppercase Windows drive).
+						return normalizeModuleId(platformResolvedFile);
 					}
 
 					return null;
```

---

### Incident Patch 9: `ef297bc0` (2026-09-29)
**Commit Message**: fix(vite): evaluate transitively bundled deps on first use (#11465)

[skip ci]

**File**: `packages/vite/hmr/server/deps-bundle.spec.ts` (modified, +54/-0)
```diff
@@ -1,6 +1,7 @@
 import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
 import { tmpdir } from 'node:os';
 import * as path from 'node:path';
+import { pathToFileURL } from 'node:url';
 import { afterAll, describe, expect, it } from 'vitest';
 
 import { setUserDefineEntries } from '../../helpers/global-defines.js';
@@ -63,6 +64,20 @@ describe('buildDepsBundleEntryCode', () => {
 		expect(code).toContain('globalThis.__NS_DEPS_MODULES__');
 		expect(code).toContain(`__nsDepsReg["node_modules/pkg-a/index.js"] = __ns_dep_0__;`);
 		expect(code).toContain(`__nsDepsReg["node_modules/pkg-b/lib/x.js"] = __ns_dep_1__;`);
+		expect(code).not.toContain('__nsDepsLazy');
+	});
+
+	it('registers lazy files behind a getter instead of importing them', () => {
+		const code = buildDepsBundleEntryCode([
+			{ key: 'node_modules/pkg-a/index.js', absPath: '/proj/node_modules/pkg-a/index.js' },
+			{ key: 'node_modules/pkg-a/esm.js', absPath: '/proj/node_modules/pkg-a/esm.js', lazy: true },
+			{ key: 'node_modules/pkg-a/cjs.js', absPath: '/proj/node_modules/pkg-a/cjs.js', lazy: true, cjs: true },
+		]);
+		expect(code).toContain(`import * as __ns_dep_0__ from "/proj/node_modules/pkg-a/index.js";`);
+		expect(code).not.toContain('from "/proj/node_modules/pkg-a/esm.js"');
+		expect(code).not.toContain('from "/proj/node_modules/pkg-a/cjs.js"');
+		expect(code).toContain(`__nsDepsLazy("node_modules/pkg-a/esm.js", () => require("/proj/node_modules/pkg-a/esm.js"));`);
+		expect(code).toContain(`__nsDepsLazy("node_modules/pkg-a/cjs.js", () => __nsDepsCjsNamespace(require("/proj/node_modules/pkg-a/cjs.js")));`);
 	});
 });
 
@@ -286,6 +301,14 @@ function createFixtureProject(): string {
 	// Dep code reading app-level `__FOO__` defines (Vue feature-flag shape).
 	write('node_modules/pkg-flags/package.json', JSON.stringify({ name: 'pkg-flags', version: '1.0.0', module: 'index.js' }));
 	write('node_modules/pkg-flags/index.js', `export const optionsApi = typeof __VUE_OPTIONS_API__ === 'boolean' ? __VUE_OPTIONS_API__ : 'unset';\nexport const bad = typeof __BAD_DEFINE__ === 'undefined' ? 'unset' : __BAD_DEFINE__;\n`);
+	// A package probing an optional dependency with a guarded require. The dependency throws on
+	// evaluation, by design.
+	write('node_modules/pkg-guard/package.json', JSON.stringify({ name: 'pkg-guard', version: '1.0.0', module: 'index.js' }));
+	write('node_modules/pkg-guard/index.js', `export { helper } from './helper.js';\nexport function probe() {\n  try {\n    return require('pkg-media').Audio;\n  } catch (e) {\n    return 'caught';\n  }\n}\n`);
+	write('node_modules/pkg-guard/helper.js', `exports.helper = () => 'helped';\n`);
+	write('node_modules/pkg-media/package.json', JSON.stringify({ name: 'pkg-media', version: '1.0.0', module: 'index.js' }));
+	write('node_modules/pkg-media/index.js', `export { Audio } from './audio';\n`);
+	write('node_modules/pkg-media/audio.js', `throw new Error('pkg-media is not supported here');\n`);
 	return projectRoot;
 }
 
@@ -357,6 +380,37 @@ describe('generateDepsBundle', () => {
 		expect(second!.keys).toEqual(first!.keys);
 	});
 
+	it('evaluates transitive files on first use, so a guarded require of a throwing module stays guarded', async () => {
+		const state = await generateDepsBundle({ projectRoot, platform: 'ios', mode: 'development', flavor: 'typescript', recordedPaths: ['/ns/m/node_modules/pkg-guard/index.js'] });
+		expect(state).not.toBeNull();
+		expect(state!.keys).toContain('node_modules/pkg-media/index.js');
+		expect(state!.keys).toContain('node_modules/pkg-media/audio.js');
+
+		// Each copy evaluates as its own module instance: esbuild's CommonJS wrapper remembers a
+		// module whose first evaluation threw, so each check needs a fresh one.
+		const evaluate = async (name: string) => {
+			const file = path.join(projectRoot, `deps-bundle-${name}-${Date.now()}.mjs`);
+			writeFileSync(file, state!.code);
+			(globalThis as any
```

**File**: `packages/vite/hmr/server/deps-bundle.ts` (modified, +52/-8)
```diff
@@ -341,20 +341,63 @@ export function resolveDepsEntriesFromVendorCollection(projectRoot: string, work
 // Bundle generation — two esbuild passes
 // ============================================================================
 
+export interface DepsBundleEntryFile {
+	key: string;
+	absPath: string;
+	/**
+	 * Registered behind a getter that evaluates the file on first read instead
+	 * of an eager `import *`. Transitive files must not run up front: packages
+	 * `require()` some of them inside a try/catch, and those may throw by
+	 * design on an unsupported platform.
+	 */
+	lazy?: boolean;
+	/** CommonJS (no ESM syntax): its lazy namespace is built the way esbuild's `import *` builds it. */
+	cjs?: boolean;
+}
+
 /**
  * Synthetic esbuild entry: evaluate the dep closure once and expose every
  * bundled file's live namespace through `globalThis.__NS_DEPS_MODULES__`,
  * keyed by node_modules-relative file path.
  */
-export function buildDepsBundleEntryCode(files: readonly { key: string; absPath: string }[]): string {
+export function buildDepsBundleEntryCode(files: readonly DepsBundleEntryFile[]): string {
 	const lines: string[] = [];
-	files.forEach(({ absPath }, i) => {
-		lines.push(`import * as __ns_dep_${i}__ from ${JSON.stringify(absPath)};`);
+	files.forEach(({ absPath, lazy }, i) => {
+		if (!lazy) lines.push(`import * as __ns_dep_${i}__ from ${JSON.stringify(absPath)};`);
 	});
 	lines.push('');
 	lines.push('const __nsDepsReg = (globalThis.__NS_DEPS_MODULES__ || (globalThis.__NS_DEPS_MODULES__ = Object.create(null)));');
-	files.forEach(({ key }, i) => {
-		lines.push(`__nsDepsReg[${JSON.stringify(key)}] = __ns_dep_${i}__;`);
+	if (files.some((f) => f.lazy)) {
+		// What `import * as ns` gives for a CommonJS module (esbuild's __toESM): its exports as named
+		// bindings and itself as `default`, unless it is transpiled ESM (`__esModule`).
+		lines.push('function __nsDepsCjsNamespace(m) {');
+		lines.push('  const ns = Object.create(null);');
+		lines.push("  if (m != null && (typeof m === 'object' || typeof m === 'function')) {");
+		lines.push("    for (const k of Object.keys(m)) if (k !== 'default') Object.defineProperty(ns, k, { enumerable: true, get: () => m[k] });");
+		lines.push('  }');
+		lines.push("  Object.defineProperty(ns, 'default', { enumerable: true, value: m != null && m.__esModule ? m.default : m });");
+		lines.push('  return ns;');
+		lines.push('}');
+		lines.push('function __nsDepsLazy(key, load) {');
+		lines.push('  Object.defineProperty(__nsDepsReg, key, {');
+		lines.push('    configurable: true,');
+		lines.push('    enumerable: true,');
+		lines.push('    get() {');
+		lines.push('      const ns = load();');
+		lines.push('      Object.defineProperty(__nsDepsReg, key, { configurable: true, enumerable: true, writable: true, value: ns });');
+		lines.push('      return ns;');
+		lines.push('    },');
+		lines.push('  });');
+		lines.push('}');
+	}
+	files.forEach(({ key, absPath, lazy, cjs }, i) => {
+		if (!lazy) {
+			lines.push(`__nsDepsReg[${JSON.stringify(key)}] = __ns_dep_${i}__;`);
+		} else if (cjs) {
+			lines.push(`__nsDepsLazy(${JSON.stringify(key)}, () => __nsDepsCjsNamespace(require(${JSON.stringify(absPath)})));`);
+		} else {
+			lines.push(`__nsDepsLazy(${JSON.stringify(key)}, () => require(${JSON.stringify(absPath)}));`);
+		}
 	});
 	lines.push('export {};');
 	lines.push('');
@@ -738,15 +781,16 @@ export async function generateDepsBundle(options: GenerateDepsBundleOptions): Pr
 		plugins: buildPlugins(),
 	});
 
-	const files: { key: string; absPath: string }[] = entries.map(({ key, absPath }) => ({ key, absPath }));
-	for (const input of Object.keys(discovery.metafile?.inputs ?? {})) {
+	const files: DepsBundleEntryFile[] = entries.map(({ key, absPath }) => ({ key, absPath }));
+	for (const [input, meta] of Object.entries(discovery.metafile?.inputs ?? {})) {
 		if (input === '<stdin>' || input.includes(':') || !input.includes('node_modules/')) continue;
 		const ab
```

---

### Incident Patch 10: `fbd4cedf` (2026-09-29)
**Commit Message**: fix(vite): decode dots in prebundled subpath specifiers (#11466)

[skip ci]

**File**: `packages/vite/hmr/server/device-transform-helpers.ts` (modified, +11/-22)
```diff
@@ -6,7 +6,7 @@ import * as path from 'path';
 import { existsSync } from 'fs';
 import * as PAT from './constants.js';
 import { getProjectRootPath } from '../../helpers/project.js';
-import { isLikelyNativeScriptRuntimePluginSpecifier, isNativeScriptCoreModule, isNativeScriptPluginModule, normalizeNativeScriptCoreSpecifier, normalizeNodeModulesSpecifier, resolveNodeModulesPackageBoundary, resolveVendorFromCandidate, viteDepsPathToBareSpecifier } from './websocket-module-specifiers.js';
+import { decodeFlattenedId, isLikelyNativeScriptRuntimePluginSpecifier, isNativeScriptCoreModule, isNativeScriptPluginModule, normalizeNativeScriptCoreSpecifier, normalizeNodeModulesSpecifier, resolveNodeModulesPackageBoundary, resolveVendorFromCandidate, viteDepsPathToBareSpecifier } from './websocket-module-specifiers.js';
 import { collectTopLevelImportRecords } from './websocket-served-module-helpers.js';
 
 // Bare specifiers and special skip patterns (virtual, data:, etc.)
@@ -17,6 +17,15 @@ const SKIP_PATTERNS = /^(?:data:|blob:|node:|virtual:|vite:|\0|\/@@?id|\/__vite|
 // the console on every served module.
 const warnedVendorMisses = new Set<string>();
 
+function packageIsInstalled(packageName: string): boolean {
+	if (!packageName) return false;
+	try {
+		return existsSync(path.join(getProjectRootPath(), 'node_modules', ...packageName.split('/'), 'package.json'));
+	} catch {
+		return false;
+	}
+}
+
 /**
  * Vendor-manifest miss fallback — e.g. `emoji-regex`, a transitive dep of
  * @nativescript/core that is never part of the vendor bundle. Dropping the
@@ -32,26 +41,6 @@ const warnedVendorMisses = new Set<string>();
  * being committed; if nothing resolves, the first candidate is used anyway —
  * a loud 404 on device beats a silent undefined binding.
  */
-function decodeFlattenedDepId(flat: string): string {
-	// Reverse Vite's flattenId, which encodes '.' as '__' and '/' (and ':') as
-	// '_'. Split on the '__' (dot) boundaries first so a single '_' inside each
-	// segment becomes a '/', then rejoin the segments with '.'. This avoids any
-	// placeholder sentinel (a literal NUL would corrupt the served module).
-	return flat
-		.split('__')
-		.map((segment) => segment.replace(/_/g, '/'))
-		.join('.');
-}
-
-function packageIsInstalled(packageName: string): boolean {
-	if (!packageName) return false;
-	try {
-		return existsSync(path.join(getProjectRootPath(), 'node_modules', ...packageName.split('/'), 'package.json'));
-	} catch {
-		return false;
-	}
-}
-
 function bareSpecifierFromFlatDepPath(depPath: string): string {
 	const flat = depPath.split('?')[0].replace(/\.m?js$/, '');
 	// flattenId is lossy (names may contain '_'), so build candidates from the
@@ -64,7 +53,7 @@ function bareSpecifierFromFlatDepPath(depPath: string): string {
 	const pushCandidate = (c: string) => {
 		if (c && !candidates.includes(c)) candidates.push(c);
 	};
-	pushCandidate(decodeFlattenedDepId(flat));
+	pushCandidate(decodeFlattenedId(flat));
 	if (flat.startsWith('@')) {
 		// Scope-only decode: just the first '_' is the scope separator.
 		pushCandidate(flat.replace('_', '/'));
```

**File**: `packages/vite/hmr/server/websocket-module-specifiers.prebundle.spec.ts` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+import { afterEach, beforeEach, describe, expect, it } from 'vitest';
+
+import { clearVendorManifest, registerVendorManifest } from '../shared/vendor/registry.js';
+import { viteDepsPathToBareSpecifier } from './websocket-module-specifiers.js';
+
+describe('viteDepsPathToBareSpecifier', () => {
+	beforeEach(() => {
+		registerVendorManifest({ hash: 'test', modules: { pkg: {}, '@scope/pkg': {} } } as any);
+	});
+	afterEach(() => clearVendorManifest());
+
+	it('decodes the dots in a subpath under a vendored package', () => {
+		expect(viteDepsPathToBareSpecifier('pkg_addons_env_file__js.js')).toBe('pkg/addons/env/file.js');
+	});
+
+	it('decodes an extensionless subpath and a scoped package', () => {
+		expect(viteDepsPathToBareSpecifier('pkg_examples_controls_orbit.js')).toBe('pkg/examples/controls/orbit');
+		expect(viteDepsPathToBareSpecifier('@scope_pkg_lib_x__min.js')).toBe('@scope/pkg/lib/x.min');
+	});
+
+	it('returns the package itself for its own prebundle', () => {
+		expect(viteDepsPathToBareSpecifier('pkg.js')).toBe('pkg');
+	});
+});
```

**File**: `packages/vite/hmr/server/websocket-module-specifiers.ts` (modified, +15/-6)
```diff
@@ -27,6 +27,18 @@ export function extractVitePrebundleId(spec: string): string | null {
 	return null;
 }
 
+/**
+ * Reverses Vite's flattenId, which encodes '.' as '__' and '/' as '_'. The
+ * dots are split out first so `lib_file__js` decodes to `lib/file.js`, not
+ * `lib/file//js`. Lossy for names that themselves contain '_'.
+ */
+export function decodeFlattenedId(flat: string): string {
+	return flat
+		.split('__')
+		.map((segment) => segment.replace(/_/g, '/'))
+		.join('.');
+}
+
 export function getFlattenedManifestMap(manifest: VendorManifest): Map<string, string> {
 	const map = new Map<string, string>();
 	const mods = Object.keys(manifest.modules || {});
@@ -280,8 +292,7 @@ export function resolveVendorFromCandidate(specifier: string | null | undefined)
 				return canonical;
 			}
 			if (flattenedId.startsWith(`${flatKey}_`)) {
-				const flatSuffix = flattenedId.slice(flatKey.length + 1);
-				const subpath = flatSuffix.replace(/_/g, '/');
+				const subpath = decodeFlattenedId(flattenedId.slice(flatKey.length + 1));
 				if (isFileDistSubpath(subpath)) {
 					return canonical;
 				}
@@ -291,7 +302,7 @@ export function resolveVendorFromCandidate(specifier: string | null | undefined)
 				}
 			}
 		}
-		const guessedId = flattenedId.replace(/__/g, '.').replace(/_/g, '/');
+		const guessedId = decodeFlattenedId(flattenedId);
 		if (guessedId && guessedId !== flattenedId) {
 			const guessedCanonical = resolveVendorSpecifier(guessedId);
 			if (guessedCanonical) {
@@ -640,9 +651,7 @@ export function viteDepsPathToBareSpecifier(depPath: string): string | null {
 	}
 
 	if (bestKey && bestCanonical) {
-		const flatSuffix = flatId.slice(bestKey.length + 1);
-		const subpath = flatSuffix.replace(/_/g, '/');
-		return `${bestCanonical}/${subpath}`;
+		return `${bestCanonical}/${decodeFlattenedId(flatId.slice(bestKey.length + 1))}`;
 	}
 
 	return null;
```

#### Recent Merged Pull Requests:
- **PR #11483** (2026-09-30): fix(vite): decode percent-encoded /ns/m request paths (@aleclarson)
- **PR #11479** (2026-09-30): fix(vite): start HMR graph population after every plugin's configureServer (@NathanWalker)
- **PR #11478** (2026-09-29): fix(vite): hot-update vue screens on plain .ts edits (@NathanWalker)
- **PR #11477** (2026-09-29): fix(vite): inline release bundle css with minified sentinel, in import order (@NathanWalker)
- **PR #11475** (2026-09-29): fix(vite): serve pnpm-isolated transitive deps over /ns/m (@aleclarson)
- **PR #11474** (2026-09-29): fix(vite): resolve workspace css specs to /@fs before ?inline transform (@aleclarson)
- **PR #11473** (2026-09-29): fix(vite): mask comments before scanning module export names (@aleclarson)
- **PR #11466** (2026-09-29): fix(vite): decode dots in prebundled subpath specifiers (@triniwiz)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
