# Forensic Learning Record (Deep Inspection): ivpusic/react-native-image-crop-picker

> **Canonical Artifact**: `07_PROJECT_LEARNING/ivpusic-react-native-image-crop-picker-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ivpusic/react-native-image-crop-picker](https://github.com/ivpusic/react-native-image-crop-picker))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:47:33.729Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ivpusic/react-native-image-crop-picker`
- **Description**: iOS/Android image picker with support for camera, video, configurable compression, multiple images and cropping
- **Primary Language / Ecosystem**: Objective-C
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6352 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `AwesomeExample/.eslintrc.js`
```
module.exports = {
  root: true,
  extends: '@react-native',
};

```

### Core Architecture Module: `AwesomeExample/.prettierrc.js`
```
module.exports = {
  arrowParens: 'avoid',
  bracketSameLine: true,
  bracketSpacing: false,
  singleQuote: true,
  trailingComma: 'all',
};

```

### Core Architecture Module: `AwesomeExample/App.tsx`
```
/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, {Component} from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';
import Video from 'react-native-video';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    backgroundColor: 'blue',
    marginBottom: 10,
  },
  text: {
    color: 'white',
    fontSize: 20,
    textAlign: 'center',
  },
});

interface ImageState {
  uri: string;
  width: number;
  height: number;
  mime: string;
}

interface AppState {
  image: ImageState | null;
  images: ImageState[] | null;
}

export default class App extends Component<{}, AppState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      image: null,
      images: null,
    };
  }

  pickSingleWithCamera(
    cropping: boolean,
    mediaType: 'photo' | 'video' = 'photo',
  ) {
    ImagePicker.openCamera({
      cropping: cropping,
      width: 500,
      height: 500,
      includeExif: true,
      mediaType,
    })
      .then(image => {
        this.setState({
          image: {
            uri: image.path,
            width: image.width,
            height: image.height,
            mime: image.mime,
          },
          images: null,
        });
      })
      .catch(e => Alert.alert('Error', e.message));
  }

  pickSingleBase64(cropit: boolean) {
    ImagePicker.openPicker({
      width: 300,
      height: 300,
      cropping: cropit,
      includeBase64: true,
      includeExif: true,
    })
      .then(image => {
        console.log('received base64 image');
        this.setState({
          image: {
            uri: `data:${image.mime};base64,` + (image as any).data,
            width: image.width,
            height: image.height,
            mime: image.mime,
          },
          images: null,
        });
      })
      .catch(e => Alert.alert('Error', e.message));
  }

  cleanupImages() {
    ImagePicker.clean()
      .then(() => {
        console.log('removed tmp images from tmp directory');
      })
      .catch(e => {
        Alert.alert('Error', e.message);
      });
  }

  cleanupSingleImage() {
    let image =
      this.state.image ||
      (this.state.images && this.state.images.length
        ? this.state.images[0]
        : null);
    console.log('will cleanup image', image);

    ImagePicker.cleanSingle(image?.uri || '')
      .then(() => {
        console.log(`removed tmp image ${image?.uri} from tmp directory`);
      })
      .catch(e => {
        Alert.alert('Error', e.message);
      });
  }

  cropLast() {
    if (!this.state.image) {
      return Alert.alert(
        'No image',
        'Before open cropping only, please select image',
      );
    }

    ImagePicker.openCropper({
      path: this.state.image.uri,
      width: 200,
      height: 200,
      mediaType: 'photo',
    })
      .then(image => {
        console.log('received cropped image', image);
        this.setState({
          image: {
            uri: image.path,
            width: image.width,
            height: image.height,
            mime: image.mime,
          },
          images: null,
        });
      })
      .catch(e => {
        console.log(e);
        Alert.alert('Error', e.message);
      });
  }

  pickSingle(cropit: boolean, circular: boolean = false) {
    ImagePicker.openPicker({
      width: 500,
      height: 500,
      cropping: cropit,
      cropperCircleOverlay: circular,
      sortOrder: 'none',
      compressImageMaxWidth: 1000,
      compressImageMaxHeight: 1000,
      compressImageQuality: 1,
      compressVideoPreset: 'MediumQuality',
      includeExif: true,
      cropperStatusBarLight: true,
      cropperNavigationBarLight: false,
      cropperToolbarColor: 'white',
      cropperActiveWidgetColor: 'white',
      cropperToolbarWidgetColor: '#3498DB',
    })
      .then(image => {
        console.log('received image', image);
        this.setState({
          image: {
            uri: image.path,
            width: image.width,
            height: image.height,
            mime: image.mime,
          },
          images: null,
        });
      })
      .catch(e => {
        console.log(e);
        Alert.alert('Error', e.message);
      });
  }

  pickMultiple() {
    ImagePicker.openPicker({
      multiple: true,
      waitAnimationEnd: false,
      sortOrder: 'desc',
      includeExif: true,
      forceJpg: true,
    })
      .then(images => {
        this.setState({
          image: null,
          images: images.map(i => {
            console.log('received image', i);
            return {
              uri: i.path,
              width: i.width,
              height: i.height,
              mime: i.mime,
            };
          }),
        });
      })
      .catch(e => Alert.alert('Error', e.message));
  }

  scaledHeight(oldW: number, oldH: number, newW: number) {
    return (oldH / oldW) * newW;
  }

  renderVideo(video: ImageState) {
    console.log('rendering video');
    return (
      <View style={{height: 300, width: 300}}>
        <Video
          source={{uri: video.uri, type: video.mime}}
          style={{position: 'absolute', top: 0, left: 0, bottom: 0, right: 0}}
          rate={1}
          paused={false}
          volume={1}
          muted={false}
          resizeMode={'cover'}
          onError={e => console.log(e)}
          onLoad={load => console.log(load)}
          repeat={true}
        />
      </View>
    );
  }

  renderImage(image: ImageState) {
    return (
      <Image
        style={{width: 300, height: 300, resizeMode: 'contain'}}
        source={image}
      />
    );
  }

  renderAsset(image: ImageState) {
    if (image.mime && image.mime.toLowerCase().indexOf('video/') !== -1) {
      return this.renderVideo(image);
    }

    return this.renderImage(image);
  }

  render() {
    return (
      <View style={styles.container}>
        <ScrollView>
          {this.state.image ? this.renderAsset(this.state.image) : null}
          {this.state.images
            ? this.state.images.map(i => (
                <View key={i.uri}>{this.renderAsset(i)}</View>
              ))
            : null}
        </ScrollView>

        <TouchableOpacity
          onPress={() => this.pickSingleWithCamera(false)}
          style={styles.button}>
          <Text style={styles.text}>Select Single Image With Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => this.pickSingleWithCamera(false, 'video')}
          style={styles.button}>
          <Text style={styles.text}>Select Single Video With Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => this.pickSingleWithCamera(true)}
          style={styles.button}>
          <Text style={styles.text}>
            Select Single With Camera With Cropping
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => this.pickSingle(false)}
          style={styles.button}>
          <Text style={styles.text}>Select Single</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => this.cropLast()} style={styles.button}>
          <Text style={styles.text}>Crop Last Selected Image</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => this.pickSingleBase64(false)}
          style={styles.button}>
          <Text style={styles.text}>Select Single Returning Base64</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => this.pickSingle(true)}
          style={styles.button}>
          <Text style={styles.text}>Select Single With Cropping</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => this.pickSingle(true, true)}
          style={styles.button}>
          <Text style={styles.text}>Select Single With Circular Cropping</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={this.pickMultiple.bind(this)}
          style={styles.button}>
          <Text style={styles.text}>Select Multiple</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={this.cleanupImages.bind(this)}
          style={styles.button}>
          <Text style={styles.text}>Cleanup All Images</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={this.cleanupSingleImage.bind(this)}
          style={styles.button}>
          <Text style={styles.text}>Cleanup Single Image</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

```

### Core Architecture Module: `AwesomeExample/android/app/src/main/java/com/awesomeexample/MainActivity.kt`
```
package com.awesomeexample

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "AwesomeExample"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}

```

### Core Architecture Module: `AwesomeExample/android/app/src/main/java/com/awesomeexample/MainApplication.kt`
```
package com.awesomeexample

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, OpenSourceMergedSoMapping)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
  }
}

```

### Core Architecture Module: `AwesomeExample/babel.config.js`
```
module.exports = {
  presets: ['module:@react-native/babel-preset'],
};

```

### Core Architecture Module: `AwesomeExample/index.js`
```
/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);

```

### Core Architecture Module: `AwesomeExample/ios/AwesomeExample/AppDelegate.swift`
```
import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "AwesomeExample",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

```

### Core Architecture Module: `AwesomeExample/jest.config.js`
```
module.exports = {
  preset: 'react-native',
};

```

### Core Architecture Module: `AwesomeExample/metro.config.js`
```
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

```

### Core Architecture Module: `index.d.ts`
```
declare module "react-native-image-crop-picker" {
    /**
     * AVAssetExportPreset presets.
     *
     * @see https://developer.apple.com/documentation/avfoundation/avassetexportsession/export_preset_names_for_quicktime_files_of_a_given_size
     */
    type CompressVideoPresets =
        | '640x480'
        | '960x540'
        | '1280x720'
        | '1920x1080'
        | 'HEVC3840x2160'
        | 'LowQuality'
        | 'MediumQuality'
        | 'HighestQuality'
        | 'Passthrough';

    /**
     * iOS smart album types
     *
     * @see https://developer.apple.com/documentation/photokit/phassetcollectionsubtype
     */
    type SmartAlbums =
        | 'Regular'
        | 'SyncedEvent'
        | 'SyncedFaces'
        | 'SyncedAlbum'
        | 'Imported'
        | 'PhotoStream'
        | 'CloudShared'
        | 'Generic'
        | 'Panoramas'
        | 'Videos'
        | 'Favorites'
        | 'Timelapses'
        | 'AllHidden'
        | 'RecentlyAdded'
        | 'Bursts'
        | 'SlomoVideos'
        | 'UserLibrary'
        | 'Screenshots'
        | 'SelfPortraits'
        /** >= iOS 10.2 */
        | 'DepthEffect'
        /** >= iOS 10.3 */
        | 'LivePhotos'
        /** >= iOS 11 */
        | 'Animated'
        | 'LongExposure';

    export interface CommonOptions {
        /**
         * Enable or disable multiple image selection.
         *
         * @default false
         */
        multiple?: boolean;

        /**
         * Min number of files to select when using `multiple` option.
         *
         * @platform iOS only
         * @default 1
         */
        minFiles?: number;

        /**
         * Max number of files to select when using `multiple` option.
         *
         * @platform iOS only
         * @default 5
         */
        maxFiles?: number;

        /**
         * Promise will resolve/reject once ViewController completion block is called.
         *
         * @platform iOS only
         * @default true
         */
        waitAnimationEnd?: boolean;

        /**
         * List of smart albums to choose from.
         *
         * @platform iOS only
         * @default ['UserLibrary', 'PhotoStream', 'Panoramas', 'Videos', 'Bursts']
         */
        smartAlbums?: SmartAlbums[];

        /**
         * Whether to default to the front camera when opened. Please note that not all
         * Android devices handle this parameter, see
         * [issue #1058](https://github.com/ivpusic/react-native-image-crop-picker/issues/1058).
         *
         * @default false
         */
        useFrontCamera?: boolean;

        /**
         * Text displayed while photo is loading in picker.
         *
         * @default 'Processing assets...'
         */
        loadingLabelText?: string;

        /**
         * Whether to show the number of selected assets.
         *
         * @default true
         */
        showsSelectedCount?: boolean;

        /**
         * Applies a sort order on the creation date on how media is displayed within the
         * albums/detail photo views when opening the image picker.
         *
         * @platform iOS only
         * @default 'none'
         */
        sortOrder?: 'none' | 'asc' | 'desc';

        /**
         * Whether to display bottom controls.
         *
         * @platform Android only
         * @default false
         */
        hideBottomControls?: boolean;

        /**
         * When set to false, does not write temporary files for the selected images. This is useful
         * to improve performance when you are retrieving file contents with the includeBase64 option
         * and don't need to read files from disk.
         *
         * @platform iOS only
         * @default true
         */
        writeTempFile?: boolean;
    }

    type ImageOptions = CommonOptions & {
        mediaType: 'photo';

        /**
         * Width of result image when used with `cropping` option.
         */
        width?: number;

        /**
         * Height of result image when used with `cropping` option.
         */
        height?: number;

        /**
         * When set to true, the image file content will be available as a base64-encoded string in
         * the data property. Hint: To use this string as an image source, use it like:
         * <Image source={{uri: `data:${image.mime};base64,${image.data}`}} />
         *
         * @default false
         */
        includeBase64?: boolean;

        /**
         * Include image exif data in the response.
         *
         * @default false
         */
        includeExif?: boolean;

        /**
         * Whether to convert photos to JPG. This will also convert any Live Photo into its JPG representation.
         *
         * @default false
         */
        forceJpg?: boolean;

        /**
         * Enable or disable cropping.
         *
         * @default false
         */
        cropping?: boolean;

        /**
         * When set to true, the image will always fill the mask space.
         *
         * @default true
         */
        avoidEmptySpaceAroundImage?: boolean;

        /**
         * When cropping image, determines ActiveWidget color.
         *
         * @platform Android only
         * @default '#424242'
         */
        cropperActiveWidgetColor?: string;

        /**
         * When cropping image, true for light status bar (dark icons), false for dark status bar (light icons).
         *
         * @platform Android only
         * @default true
         */
        cropperStatusBarLight?: boolean;

        /**
         * When cropping image, true for light navigation bar (dark icons), false for dark navigation bar (light icons).
         *
         * @platform Android only
         * @default false
         */
        cropperNavigationBarLight?: boolean;

        /**
         * When cropping image, determines the color of Toolbar.
         *
         * @platform Android only
         * @default '#424242'
         */
        cropperToolbarColor?: string;

        /**
         * When cropping image, determines the color of Toolbar text and buttons.
         *
         * @platform Android only
         * @default 'darker orange'
         */
        cropperToolbarWidgetColor?: string;

        /**
         * When cropping image, determines the title of Toolbar.
         *
         * @default 'Edit Photo'
         */
        cropperToolbarTitle?: string;

        /**
         * Enables user to apply custom rectangle area for cropping.
         *
         * @platform iOS only
         * @default false
         */
        freeStyleCropEnabled?: boolean;

        /**
         * cropperTintColor
         */
        cropperTintColor?: string;

        /**
         * Enable or disable circular cropping mask.
         *
         * @default false
         */
        cropperCircleOverlay?: boolean;

        /**
         * Cancel button text.
         *
         * @default 'Cancel'
         */
        cropperCancelText?: string;

        /**
         * Cancel button color. HEX-like string color.
         *
         * @example '#ff00ee'
         * @platform iOS only
         */
        cropperCancelColor?: string;

        /**
         * Choose button text.
         *
         * @default 'Choose'
         */
        cropperChooseText?: string;

        /**
         * Choose button color. HEX-like string color.
         *
         * @example '#EE00DD'
         * @platform iOS only
         */
        cropperChooseColor?: string;

         /**
         * Enable or disable cropper rotate buttons.
         *
         * @platform iOS only
         * @default false
         */
          cropperRotateButtonsHidden?: boolean

        /**
         * Whether to show the 3x3 grid on top of the image during cropping.
         *
         * @platform Android only
         * @default true
         */
        showCropGuidelines?: boolean;

        /**
         * Whether to show the square crop frame during cropping
         *
         * @platform Android only
         * @default true
         */
        showCropFrame?: boolean;

        /**
         * Whether to enable rotating the image by hand gesture.
         *
         * @platform Android only
         * @default false
         */
        enableRotationGesture?: boolean;

        /**
         * When cropping image, disables the color setters for cropping library.
         *
         * @platform Android only
         * @default false
         */
        disableCropperColorSetters?: boolean;

        /**
         * Compress image with maximum width.
         *
         * @default null
         */
        compressImageMaxWidth?: number;

        /**
         * Compress image with maximum height.
         *
         * @default null
         */
        compressImageMaxHeight?: number;

        /**
         * Compress image with quality (from 0 to 1, where 1 is best quality). On iOS, values larger
         * than 0.8 don't produce a noticeable quality increase in most images, while a value of 0.8
         * will reduce the file size by about half or less compared to a value of 1.
         *
         * @default Android: 1, iOS: 0.8
         */
        compressImageQuality?: number;
    }

    type CropperOptions = ImageOptions & {
        /**
         * Selected image location
         */
        path: string;
    }

    type VideoOptions = CommonOptions & {
        mediaType: 'video';

        /**
         * Choose which preset will be used for video compression.
         *
         * @platform iOS only
         * @default 'MediumQuality'
         */
        compressVideoPreset?: CompressVideoPresets;
    };

    type AnyOptions = Omit<ImageOptions, 'mediaType'> & Omit<VideoOptions, 'mediaType'> & {
        mediaType?: 'any';
    };

    export type Options = AnyOptions | VideoOptions | ImageOptions;

    interface ImageVideoCommon {
        /**
         * Selected image location. This is null when the `writeTempFile` opti
```

### Core Architecture Module: `index.js`
```
import ImageCropPicker from "./src/NativeImageCropPicker";

export default ImageCropPicker;
export const openPicker = ImageCropPicker.openPicker;
export const openCamera = ImageCropPicker.openCamera;
export const openCropper = ImageCropPicker.openCropper;
export const clean = ImageCropPicker.clean;
export const cleanSingle = ImageCropPicker.cleanSingle;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2253** (2026-09-25): **iOS: present the cropper from a controller that is not being dismissed**
  *Symptoms*: Fixes https://github.com/ivpusic/react-native-image-crop-picker/issues/1631  `getRootVC` walks `presentedViewController` to the top of the stack, including a controller that is being dismissed. When `openCropper` runs right after another picker resolves, for example `expo-image-picker`'s `launchImageLibraryAsync`, which resolves while its `PHPickerViewController` is still animating out, the cropper is presented on that picker:  ``` [Presentation] Attempt to present <TOCropViewController: 0x10a8e0a00> on <PHPickerViewController: 0x10d814400> (from <PHPickerViewController: 0x10d814400>) whose view is not in the window hierarchy. ```  UIKit drops the presentation without an error, so the `openCropper` promise never settles and the caller waits forever. This stops the walk at a controller that is being dismissed, so the cropper is presented on the controller that stays on screen.  This is the change in https://github.com/ivpusic/react-native-image-crop-picker/pull/2118 by @gaearon, which no longer applies because `ImageCropPicker.m` became `ImageCropPicker.mm`. If you would rather land that one, this can be closed.  ## Test plan  On the iOS 26 simulator, with React Native 0.86.3 on the New Architecture and Expo SDK 57: pick a photo with `expo-image-picker`, then call `openCropper({ path: asset.uri, width: 5, height: 2, mediaType: 'photo' })` as soon as it resolves.  - Before: the log line above, no cropper, and the promise never settles. - After: the cropper opens on the picked p
  **Post-Mortem & Fix Analysis**:
  > Hi @ivpusic 👋   Any chance you can cut a release so we don't need to live with a patch in our repo?  Many thanks!

- **Issue #2251** (2026-09-29): **fix(ios): drop imports of RCTImageShadowView/RCTImageView removed in RN 0.87**
  *Symptoms*: React Native 0.87 removed the legacy Paper image views, so `React/RCTImageShadowView.h` and `React/RCTImageView.h` no longer exist and the pod fails to compile with "file not found" (#2248). Neither symbol is referenced anywhere in the module — the two imports were unused — so removing them is the whole fix. Verified on RN 0.87.1; older versions are unaffected because nothing used them.  Fixes #2248 
  **Post-Mortem & Fix Analysis**:
  > Hi @ivpusic ,  Thank you for this library   Do you have a moment to take a look at this PR? Without this change, the migration to RN 0.87 requires a patch for this library.

- **Issue #2249** (2026-07-29): **fix(ios): bump TOCropViewController to 2.8.0 for iOS 26 toolbar alignment**
  *Symptoms*: ....

- **Issue #2248** (2026-09-29): **RCTImageShadowView and RCTImageView is removed in RN 0.87**
  *Symptoms*: When I build a test app with RN 0.87.0-rc.2, it throws build error at these 2 lines  https://github.com/ivpusic/react-native-image-crop-picker/blob/79d62be01650e583963cddfbfe6dd6aeb82f5c06/ios/src/ImageCropPicker.h#L16-L17  See this commit https://github.com/react/react-native/commit/86350ab988472025d60e192c54e115caf6756295
  **Post-Mortem & Fix Analysis**:
  > @pnthach95 Can you try this patch?  [react-native-image-crop-picker+0.51.1.patch](https://github.com/user-attachments/files/30931633/react-native-image-crop-picker%2B0.51.1.patch)
  > > [@pnthach95](https://github.com/pnthach95) Can you try this patch? >  > [react-native-image-crop-picker+0.51.1.patch](https://github.com/user-attachments/files/30931633/react-native-image-crop-picker%2B0.51.1.patch)  Build OK. The patch fixed this issue
  > RN 0.87 has been released. Thanks for the patch while waiting for an update to this library.

- **Issue #2246** (2026-07-23): **[BUG] [iOS26] Image manipulation controls are cropped and partially off-screen**
  *Symptoms*: ### Version  - react-native-image-crop-picker v0.51.0 - react-native v0.77.3  ### Platform  - iOS  ### Expected behaviour The image manipulation controls (crop, rotate etc.) are visible and tappable.  ### Actual behaviour The image manipulation controls are cropped and partially off-screen. They don't respond well to taps either. I can confirm they look and work as expected on iOS 18.  ### Steps to reproduce  1. Open an image in crop mode 2. Note the bottom controls (see attached screenshot)  ### Attachments  Expected:  <img width="1666" height="418" alt="Image" src="https://github.com/user-attachments/assets/4e919d94-274f-4174-af91-34f953b29066" />  Actual:  <img width="672" height="452" alt="Image" src="https://github.com/user-attachments/assets/057dffab-c5bf-4bb3-badd-7bf78ff658cd" />
  **Post-Mortem & Fix Analysis**:
  > me too
  > <img width="354" height="244" alt="Image" src="https://github.com/user-attachments/assets/296c5355-e5b4-4b83-a838-6f3dd7fd22e0" />  the same with android. Not respecting the safe area

- **Issue #2243** (2026-09-29): **fix: return creationDate for videos picked from gallery**
  *Symptoms*: ## Summary  This adds video `creationDate` for both iOS and Android videos selected from gallery.  - iOS: forwards `PHAsset.creationDate` / `modificationDate` - Android: queries `MediaStore.MediaColumns.DATE_TAKEN`.  It already returns `modificationDate`  Output format matches the existing iOS picker convention: Unix seconds as a string (e.g. `"1714932000"`), so `creationDate` is type-stable across platforms and across photo/video selections.  ## Steps to reproduce / verify  Pick a video from the gallery via `openPicker({ mediaType: 'video' })`; logged response has `creationDate: null` on both platforms.  **Android before the fix** <img width="1166" height="78" alt="Screenshot 2026-05-05 at 4 30 45 PM" src="https://github.com/user-attachments/assets/28d88177-d5bf-44bd-9eb7-abe78462968f" />   **Android after the fix**  <img width="1166" height="77" alt="Screenshot 2026-05-05 at 4 35 49 PM" src="https://github.com/user-attachments/assets/43f083e0-b38f-4ba9-8365-d98fe42fdc4b" />   **iOS before the fix** <img width="1168" height="181" alt="Screenshot 2026-05-05 at 5 17 15 PM" src="https://github.com/user-attachments/assets/ac62b870-e291-48f9-aa88-253e0789bb51" />    **iOS after the fix**  <img width="1170" height="180" alt="Screenshot 2026-05-05 at 5 08 26 PM" src="https://github.com/user-attachments/assets/ef144585-7bc4-4b1b-842b-5afdbbaf34fd" />   ## Related  - Builds on the approach in https://github.com/ivpusic/react-native-image-crop-picker/

- **Issue #2241** (2026-04-18): **Pampa horror**
  *Symptoms*: Pampa Horror*

- **Issue #2236** (2026-03-03): **There's an additional preview button**
  *Symptoms*: <!-- Failed to upload "Screenrecorder-2026-03-03-09-26-06-133.mp4" -->  When I select an image from the library, a Preview button appears. When I click Preview and then Select, an error message appears: E_PICKER_CANCELLED react-native-image-crop-picker: ^0.51.1 react-native: 0.80.2 device: POCO X4 GT MIUI version: 14.0.7

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

### Incident Patch 1: `2d7ea57d` (2026-09-29)
**Commit Message**: fix: return creationDate for videos picked from gallery (#2243)

* fix: return creationDate for videos picked from gallery

Videos selected from the photo library returned `creationDate: null` on
both iOS and Android, causing callers to lose the original recording
timestamp. Photos already populate `creationDate` correctly — this
restores parity for videos.

iOS: forward `PHAsset.creationDate` / `modificationDate` from
`getVideoAsset:` through `handleVideo:` to `createAttachmentResponse:`.
The PHAsset already exposes these fields; the picker was discarding them
by passing `nil` literals at the call site. The camera-recorded path
(`UIImagePickerController` callback) preserves its existing `nil`
behavior since there's no PHAsset there.

Android: read `MediaMetadataRetriever.METADATA_KEY_DATE` from the video
file in `getVideo`. Returned as Unix-seconds string to mirror iOS's
`creationDate` format. Falls through silently when the container has no
recording date or an unrecognized format, leaving the existing
`modificationDate` as the only date field (current behavior).

Closes #2079

* android: read creationDate from MediaStore DATE_TAKEN

MediaMetadataRetriever.METADATA_KEY_DATE was u

**File**: `android/src/main/java/com/reactnative/ivpusic/imagepicker/ImageCropPicker.java` (modified, +35/-3)
```diff
@@ -472,7 +472,7 @@ private WritableMap getSelection(Activity activity, Uri uri, boolean isCamera) t
 
         String mime = getMimeType(path);
         if (mime != null && mime.startsWith("video/")) {
-            getVideo(activity, path, mime);
+            getVideo(activity, uri, path, mime);
             return null;
         }
 
@@ -488,7 +488,7 @@ private void getAsyncSelection(final Activity activity, Uri uri, boolean isCamer
 
         String mime = getMimeType(path);
         if (mime != null && mime.startsWith("video/")) {
-            getVideo(activity, path, mime);
+            getVideo(activity, uri, path, mime);
             return;
         }
 
@@ -519,7 +519,35 @@ private static Long getVideoDuration(String path) {
         }
     }
 
-    private void getVideo(final Activity activity, final String path, final String mime) throws Exception {
+    // MediaStore DATE_TAKEN is the canonical recording timestamp (ms). Preferred over
+    // File.lastModified() (bumped by syncs/copies/edits) for matching iOS PHAsset.creationDate.
+    // Returns Unix seconds as a string to align with the iOS picker's `creationDate` field.
+    private static String getVideoCreationDateSeconds(Activity activity, Uri sourceUri) {
+        if (sourceUri == null) {
+            return null;
+        }
+        try (android.database.Cursor cursor = activity.getContentResolver().query(
+                sourceUri,
+                new String[] { MediaStore.MediaColumns.DATE_TAKEN },
+                null, null, null)) {
+            if (cursor == null || !cursor.moveToFirst()) {
+                return null;
+            }
+            int idx = cursor.getColumnIndex(MediaStore.MediaColumns.DATE_TAKEN);
+            if (idx < 0 || cursor.isNull(idx)) {
+                return null;
+            }
+            long dateTakenMs = cursor.getLong(idx);
+            if (dateTakenMs <= 0) {
+                return null;
+            }
+            return String.valueOf(dateTakenMs / 1000L);
+        } catch (Exception e) {
+            return null;
+        }
+    }
+
+    private void getVideo(final Activity activity, final Uri sourceUri, final String path, final String mime) throws Exception {
         validateVideo(Uri.parse(path));
         final String compressedVideoPath = getTmpDir(activity) + "/" + UUID.randomUUID().toString() + ".mp4";
 
@@ -530,6 +558,7 @@ private void getVideo(final Activity activity, final String path, final String m
                 Bitmap bmp = validateVideo(Uri.fromFile(new File(videoPath)));
                 long modificationDate = new File(videoPath).lastModified();
                 long duration = getVideoDuration(videoPath);
+                String creationDateSeconds = getVideoCreationDateSeconds(activity, sourceUri);
 
                 WritableMap video = new WritableNativeMap();
                 video.putInt("width", bmp.getWidth());
@@ -539,6 +568,9 @@ private void getVideo(final Activity activity, final String path, final String m
                 video.putInt("duration", (int) duration);
                 video.putString("path", "file://" + videoPath);
                 video.putString("modificationDate", String.valueOf(modificationDate));
+                if (creationDateSeconds != null) {
+                    video.putString("creationDate", creationDateSeconds);
+                }
 
                 resultCollector.notifySuccess(video);
             } catch (Exception e) {
```

**File**: `ios/src/ImageCropPicker.mm` (modified, +7/-3)
```diff
@@ -197,6 +197,8 @@ - (void)imagePickerController:(UIImagePickerController *)picker didFinishPicking
         [self handleVideo:asset
              withFileName:fileName
       withLocalIdentifier:nil
+         withCreationDate:nil
+     withModificationDate:nil
                completion:^(NSDictionary* video) {
             dispatch_async(dispatch_get_main_queue(), ^{
                 if (video == nil) {
@@ -421,7 +423,7 @@ - (void)showActivityIndicator:(void (^)(UIActivityIndicatorView*, UIView*))handl
     });
 }
 
-- (void) handleVideo:(AVAsset*)asset withFileName:(NSString*)fileName withLocalIdentifier:(NSString*)localIdentifier completion:(void (^)(NSDictionary* image))completion {
+- (void) handleVideo:(AVAsset*)asset withFileName:(NSString*)fileName withLocalIdentifier:(NSString*)localIdentifier withCreationDate:(NSDate*)creationDate withModificationDate:(NSDate*)modificationDate completion:(void (^)(NSDictionary* image))completion {
     NSURL *sourceURL = [(AVURLAsset *)asset URL];
     
     // create temp file
@@ -456,8 +458,8 @@ - (void) handleVideo:(AVAsset*)asset withFileName:(NSString*)fileName withLocalI
                                          withDuration:[NSNumber numberWithFloat:milliseconds]
                                              withData:nil
                                              withRect:CGRectNull
-                                     withCreationDate:nil
-                                 withModificationDate:nil
+                                     withCreationDate:creationDate
+                                 withModificationDate:modificationDate
                         ]);
         } else {
             completion(nil);
@@ -480,6 +482,8 @@ - (void) getVideoAsset:(PHAsset*)forAsset completion:(void (^)(NSDictionary* ima
         [self handleVideo:asset
              withFileName:[forAsset valueForKey:@"filename"]
       withLocalIdentifier:forAsset.localIdentifier
+         withCreationDate:forAsset.creationDate
+     withModificationDate:forAsset.modificationDate
                completion:completion
          ];
     }];
```

---

### Incident Patch 2: `098fb951` (2026-09-29)
**Commit Message**: fix(ios): drop imports of RCTImageShadowView/RCTImageView removed in RN 0.87 (#2251)

**File**: `ios/src/ImageCropPicker.h` (modified, +0/-4)
```diff
@@ -13,14 +13,10 @@
 #if __has_include(<React/RCTBridgeModule.h>)
 #import <React/RCTBridgeModule.h>
 #import <React/RCTImageURLLoader.h>
-#import <React/RCTImageShadowView.h>
-#import <React/RCTImageView.h>
 #import <React/RCTImageLoaderProtocol.h>
 #else
 #import "RCTBridgeModule.h"
 #import "RCTImageURLLoader.h"
-#import "RCTImageShadowView.h"
-#import "RCTImageView.h"
 #import "RCTImageLoaderProtocol.h"
 #endif
 
```

---

### Incident Patch 3: `64f65819` (2025-09-26)
**Commit Message**: fix: Update TOCropViewController to resolve iOS 26 alignment issue (#2209)

**File**: `AwesomeExample/ios/Podfile.lock` (modified, +87/-9)
```diff
@@ -1332,6 +1332,80 @@ PODS:
     - React-jsiexecutor
     - React-RCTFBReactNativeSpec
     - ReactCommon/turbomodule/core
+  - react-native-video (6.14.1):
+    - DoubleConversion
+    - glog
+    - hermes-engine
+    - RCT-Folly (= 2024.11.18.00)
+    - RCTRequired
+    - RCTTypeSafety
+    - React-Core
+    - React-debug
+    - React-Fabric
+    - React-featureflags
+    - React-graphics
+    - React-hermes
+    - React-ImageManager
+    - React-jsi
+    - react-native-video/Video (= 6.14.1)
+    - React-NativeModulesApple
+    - React-RCTFabric
+    - React-renderercss
+    - React-rendererdebug
+    - React-utils
+    - ReactCodegen
+    - ReactCommon/turbomodule/bridging
+    - ReactCommon/turbomodule/core
+    - Yoga
+  - react-native-video/Fabric (6.14.1):
+    - DoubleConversion
+    - glog
+    - hermes-engine
+    - RCT-Folly (= 2024.11.18.00)
+    - RCTRequired
+    - RCTTypeSafety
+    - React-Core
+    - React-debug
+    - React-Fabric
+    - React-featureflags
+    - React-graphics
+    - React-hermes
+    - React-ImageManager
+    - React-jsi
+    - React-NativeModulesApple
+    - React-RCTFabric
+    - React-renderercss
+    - React-rendererdebug
+    - React-utils
+    - ReactCodegen
+    - ReactCommon/turbomodule/bridging
+    - ReactCommon/turbomodule/core
+    - Yoga
+  - react-native-video/Video (6.14.1):
+    - DoubleConversion
+    - glog
+    - hermes-engine
+    - RCT-Folly (= 2024.11.18.00)
+    - RCTRequired
+    - RCTTypeSafety
+    - React-Core
+    - React-debug
+    - React-Fabric
+    - React-featureflags
+    - React-graphics
+    - React-hermes
+    - React-ImageManager
+    - React-jsi
+    - react-native-video/Fabric
+    - React-NativeModulesApple
+    - React-RCTFabric
+    - React-renderercss
+    - React-rendererdebug
+    - React-utils
+    - ReactCodegen
+    - ReactCommon/turbomodule/bridging
+    - ReactCommon/turbomodule/core
+    - Yoga
   - React-NativeModulesApple (0.79.2):
     - glog
     - hermes-engine
@@ -1654,7 +1728,7 @@ PODS:
     - React-logger (= 0.79.2)
     - React-perflogger (= 0.79.2)
     - React-utils (= 0.79.2)
-  - RNImageCropPicker (0.42.0):
+  - RNImageCropPicker (0.51.0):
     - DoubleConversion
     - glog
     - hermes-engine
@@ -1678,10 +1752,10 @@ PODS:
     - ReactCodegen
     - ReactCommon/turbomodule/bridging
     - ReactCommon/turbomodule/core
-    - RNImageCropPicker/QBImagePickerController (= 0.42.0)
-    - TOCropViewController (~> 2.7.4)
+    - RNImageCropPicker/QBImagePickerController (= 0.51.0)
+    - TOCropViewController (~> 2.8.0)
     - Yoga
-  - RNImageCropPicker/QBImagePickerController (0.42.0):
+  - RNImageCropPicker/QBImagePickerController (0.51.0):
     - DoubleConversion
     - glog
     - hermes-engine
@@ -1705,10 +1779,10 @@ PODS:
     - ReactCodegen
     - ReactCommon/turbomodule/bridging
     - ReactCommon/turbomodule/core
-    - TOCropViewController (~> 2.7.4)
+    - TOCropViewController (~> 2.8.0)
     - Yoga
   - SocketRocket (0.7.1)
-  - TOCropViewController (2.7.4)
+  - TOCropViewController (2.8.0)
   - Yoga (0.0.0)
 
 DEPENDENCIES:
@@ -1752,6 +1826,7 @@ DEPENDENCIES:
   - React-logger (from `../node_modules/react-native/ReactCommon/logger`)
   - React-Mapbuffer (from `../node_modules/react-native/ReactCommon`)
   - React-microtasksnativemodule (from `../node_modules/react-native/ReactCommon/react/nativemodule/microtasks`)
+  - react-native-video (from `../node_modules/react-native-video`)
   - React-NativeModulesApple (from `../node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios`)
   - React-oscompat (from `../node_modules/react-native/ReactCommon/oscompat`)
   - React-perflogger (from `../node_modules/react-native/ReactCommon/reactperflogger`)
@@ -1869,6 +1944,8 @@ EXTERNAL SOURCES:
     :path: "../node_modules/react-native/ReactCommon"
   React-microtasksnativemodule:
     :path: "../node_modules/react-native/ReactCommon/react/nativemodule/microtasks"
+  react-native-video:
+    :path: "../node_modules/react-native-video"
   React-NativeModulesApple:
     :path: "../node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios"
   React-oscompat:
@@ -1975,6 +2052,7 @@ SPEC CHECKSUMS:
   React-logger: 8edfcedc100544791cd82692ca5a574240a16219
   React-Mapbuffer: c3f4b608e4a59dd2f6a416ef4d47a14400194468
   React-microtasksnativemodule: 054f34e9b82f02bd40f09cebd4083828b5b2beb6
+  react-native-video: 83c69342ee367aa83b37850001bb195d8b9dd695
   React-NativeModulesApple: 2c4377e139522c3d73f5df582e4f051a838ff25e
   React-oscompat: ef5df1c734f19b8003e149317d041b8ce1f7d29c
   React-perflogger: 9a151e0b4c933c9205fd648c246506a83f31395d
@@ -2006,11 +2084,11 @@ SPEC CHECKSUMS:
   ReactAppDependencyProvider: 04d5eb15eb46be6720e17a4a7fa92940a776e584
   ReactCodegen: c63eda03ba1d94353fb97b031fc84f75a0d125ba
   ReactCommon: 76d2dc87136d0a667678668b86f0fca0c16fdeb0
-  RNImageCropPicker: e28bb8a4c7fce5f3a4e5aa87aa59d855cbf5928a
+  RNImageCropPicker: f6d0f8d05202547b3d2cd8775ba41bf6f0fbf0a
```

**File**: `RNImageCropPicker.podspec` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ Pod::Spec.new do |s|
   s.platform     = :ios, "8.0"
   s.dependency 'React-Core'
   s.dependency 'React-RCTImage'
-  s.dependency 'TOCropViewController', '~> 2.7.4'
+  s.dependency 'TOCropViewController', '~> 2.8.0'
   s.resource_bundles = {
     'RNImageCropPickerPrivacyInfo' => ['ios/PrivacyInfo.xcprivacy'],
   }
```

---

### Incident Patch 4: `c49d51ab` (2025-09-17)
**Commit Message**: Android: Fix maxFiles=1 and multiple={true} behavior (#2202)

**File**: `android/src/main/java/com/reactnative/ivpusic/imagepicker/ImageCropPicker.java` (modified, +1/-1)
```diff
@@ -368,7 +368,7 @@ private void initiatePicker(final Activity activity) {
             }
 
             Intent intent;
-            if (multiple) {
+            if (multiple && maxFiles > 1) {
                 intent = new ActivityResultContracts.PickMultipleVisualMedia(maxFiles).createIntent(activity, builder.build());
             } else {
                 intent = new ActivityResultContracts.PickVisualMedia().createIntent(activity, builder.build());
```

---

### Incident Patch 5: `3d5776c4` (2025-07-28)
**Commit Message**: Notch Issue Fix 08-05-2025 (#2168)

**File**: `android/src/main/AndroidManifest.xml` (modified, +2/-1)
```diff
@@ -24,7 +24,8 @@
 
         <activity
             android:name="com.yalantis.ucrop.UCropActivity"
-            android:theme="@style/Theme.AppCompat.Light.NoActionBar" />
+            android:theme="@style/UCropTheme"
+            android:exported="false" />
 
 
         <!-- Prompt Google Play services to install the backported photo picker module -->
```

**File**: `android/src/main/res/values/styles.xml` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+<resources>
+    <style name="UCropTheme" parent="Theme.AppCompat.Light.NoActionBar">
+        <item name="android:windowIsFloating">true</item>
+        <item name="android:windowMinWidthMajor">100%</item>
+        <item name="android:windowMinWidthMinor">100%</item>
+        <item name="android:windowContentOverlay">@null</item>
+    </style>
+</resources>
\ No newline at end of file
```

---

### Incident Patch 6: `4823a97f` (2025-03-13)
**Commit Message**: Fix the issure in Android where the photo picker does not support a maxFiles selection limit. (#2147)

Co-authored-by: BruceWang <[REDACTED_EMAIL]>

**File**: `android/src/main/java/com/reactnative/ivpusic/imagepicker/PickerModule.java` (modified, +4/-1)
```diff
@@ -104,6 +104,8 @@ class PickerModule extends ReactContextBaseJavaModule implements ActivityEventLi
     private int width = 0;
     private int height = 0;
 
+    private int maxFiles = 5;
+
     private Uri mCameraCaptureURI;
     private String mCurrentMediaPath;
     private ResultCollector resultCollector = new ResultCollector();
@@ -135,6 +137,7 @@ private void setConfiguration(final ReadableMap options) {
         includeExif = options.hasKey("includeExif") && options.getBoolean("includeExif");
         width = options.hasKey("width") ? options.getInt("width") : 0;
         height = options.hasKey("height") ? options.getInt("height") : 0;
+        maxFiles = options.hasKey("maxFiles") ? options.getInt("maxFiles") : 0;
         cropping = options.hasKey("cropping") && options.getBoolean("cropping");
         cropperActiveWidgetColor = options.hasKey("cropperActiveWidgetColor") ? options.getString("cropperActiveWidgetColor") : null;
         cropperStatusBarColor = options.hasKey("cropperStatusBarColor") ? options.getString("cropperStatusBarColor") : null;
@@ -381,7 +384,7 @@ private void initiatePicker(final Activity activity) {
 
             Intent intent;
             if (multiple) {
-                intent = new ActivityResultContracts.PickMultipleVisualMedia().createIntent(activity, builder.build());
+                intent = new ActivityResultContracts.PickMultipleVisualMedia(maxFiles).createIntent(activity, builder.build());
             } else {
                 intent = new ActivityResultContracts.PickVisualMedia().createIntent(activity, builder.build());
             }
```

---

### Incident Patch 7: `1b9081e4` (2025-02-17)
**Commit Message**: Fix: Preserve selection order in iOS image and video picker (#2099)

**File**: `ios/src/ImageCropPicker.m` (modified, +27/-23)
```diff
@@ -521,8 +521,7 @@ - (NSString *)determineMimeTypeFromImageData:(NSData *)data {
     return @"";
 }
 
-- (void)qb_imagePickerController:
-(QBImagePickerController *)imagePickerController
+- (void)qb_imagePickerController:(QBImagePickerController *)imagePickerController
           didFinishPickingAssets:(NSArray *)assets {
     
     PHImageManager *manager = [PHImageManager defaultManager];
@@ -531,14 +530,19 @@ - (void)qb_imagePickerController:
     options.networkAccessAllowed = YES;
     
     if ([[[self options] objectForKey:@"multiple"] boolValue]) {
-        NSMutableArray *selections = [[NSMutableArray alloc] init];
+        NSMutableArray *selections = [NSMutableArray arrayWithCapacity:assets.count];
         
+        for (int i = 0; i < assets.count; i++) {
+            [selections addObject:[NSNull null]];
+        }
+
         [self showActivityIndicator:^(UIActivityIndicatorView *indicatorView, UIView *overlayView) {
             NSLock *lock = [[NSLock alloc] init];
             __block int processed = 0;
-            
-            for (PHAsset *phAsset in assets) {
-                
+
+            for (int index = 0; index < assets.count; index++) {
+                PHAsset *phAsset = assets[index];
+
                 if (phAsset.mediaType == PHAssetMediaTypeVideo) {
                     [self getVideoAsset:phAsset completion:^(NSDictionary* video) {
                         dispatch_async(dispatch_get_main_queue(), ^{
@@ -553,7 +557,7 @@ - (void)qb_imagePickerController:
                                 return;
                             }
                             
-                            [selections addObject:video];
+                            [selections replaceObjectAtIndex:index withObject:video];
                             processed++;
                             [lock unlock];
                             
@@ -626,22 +630,22 @@ - (void)qb_imagePickerController:
                                     if([[self.options objectForKey:@"includeExif"] boolValue]) {
                                         exif = [[CIImage imageWithData:imageData] properties];
                                     }
-                                    
-                                    [selections addObject:[self createAttachmentResponse:filePath
-                                                                                withExif: exif
-                                                                           withSourceURL:[sourceURL absoluteString]
-                                                                     withLocalIdentifier: phAsset.localIdentifier
-                                                                            withFilename: [phAsset valueForKey:@"filename"]
-                                                                               withWidth:imageResult.width
-                                                                              withHeight:imageResult.height
-                                                                                withMime:imageResult.mime
-                                                                                withSize:[NSNumber numberWithUnsignedInteger:imageResult.data.length]
-                                                                            withDuration: nil
-                                                                                withData:[[self.options objectForKey:@"includeBase64"] boolValue] ? [imageResult.data base64EncodedStringWithOptions:0]: nil
-                                                                                withRect:CGRectNull
-                                                                        withCreationDate:phAsset.creationDate
-                                                                    withModificationDate:phAsset.modificationDate
-                                                           ]];
+
+                                    [selections replaceObjectAtIndex:index withObject:[self createAttachmentResponse:filePath
+                                                                                                            withExif: exif
+                                                                                                       withSourceURL:[sourceURL absoluteString]
+                                                                                                 withLocalIdentifier: phAsset.localIdentifier
+                                                                                                        withFilename: [phAsset valueForKey:@"filename"]
+                                                                                                           withWidth:imageResult.width
+                                                                                                          withHeight:imageResult.height
+                                                                                                           
```

---

### Incident Patch 8: `3ae287c0` (2025-02-17)
**Commit Message**: fix: Resolve OutOfMemoryError in image/video processing (#2137)

* fix: Resolve OutOfMemoryError in image/video processing

* fix: resolve OutOfMemoryError in media processing

* fix: preserve file modification date during media processing

**File**: `android/src/main/java/com/reactnative/ivpusic/imagepicker/Compression.java` (modified, +2/-2)
```diff
@@ -35,7 +35,7 @@ File resize(
             int maxWidth,
             int maxHeight,
             int quality
-    ) throws IOException {
+    ) throws IOException,OutOfMemoryError {
         Pair<Integer, Integer> targetDimensions =
                 this.calculateTargetDimensions(originalWidth, originalHeight, maxWidth, maxHeight);
 
@@ -105,7 +105,7 @@ private boolean shouldSetOrientation(String orientation) {
                 && !orientation.equals(String.valueOf(ExifInterface.ORIENTATION_UNDEFINED));
     }
 
-    File compressImage(final Context context, final ReadableMap options, final String originalImagePath, final BitmapFactory.Options bitmapOptions) throws IOException {
+    File compressImage(final Context context, final ReadableMap options, final String originalImagePath, final BitmapFactory.Options bitmapOptions) throws IOException,OutOfMemoryError {
         Integer maxWidth = options.hasKey("compressImageMaxWidth") ? options.getInt("compressImageMaxWidth") : null;
         Integer maxHeight = options.hasKey("compressImageMaxHeight") ? options.getInt("compressImageMaxHeight") : null;
         Double quality = options.hasKey("compressImageQuality") ? options.getDouble("compressImageQuality") : null;
```

**File**: `android/src/main/java/com/reactnative/ivpusic/imagepicker/PickerModule.java` (modified, +33/-25)
```diff
@@ -73,6 +73,7 @@ class PickerModule extends ReactContextBaseJavaModule implements ActivityEventLi
     private static final String E_CAMERA_IS_NOT_AVAILABLE = "E_CAMERA_IS_NOT_AVAILABLE";
     private static final String E_CANNOT_LAUNCH_CAMERA = "E_CANNOT_LAUNCH_CAMERA";
     private static final String E_ERROR_WHILE_CLEANING_FILES = "E_ERROR_WHILE_CLEANING_FILES";
+    private static final String E_LOW_MEMORY_ERROR = "E_LOW_MEMORY_ERROR";
 
     private static final String E_NO_LIBRARY_PERMISSION_KEY = "E_NO_LIBRARY_PERMISSION";
     private static final String E_NO_LIBRARY_PERMISSION_MSG = "User did not grant library permission.";
@@ -368,28 +369,21 @@ private void initiateCamera(Activity activity) {
     private void initiatePicker(final Activity activity) {
         try {
             PickVisualMediaRequest.Builder builder = new PickVisualMediaRequest.Builder();
-            PickVisualMediaRequest request = new PickVisualMediaRequest();
-
-            if (cropping || mediaType.equals("photo")) {
-                request = builder.setMediaType(new ActivityResultContracts.PickVisualMedia.SingleMimeType("image/*")).build();
-            }
-            else{
-                if (cropping) {
-                    request = builder.setMediaType(ActivityResultContracts.PickVisualMedia.ImageOnly.INSTANCE).build();
-                }
-             else if (mediaType.equals("video")) {
-                request = builder.setMediaType(ActivityResultContracts.PickVisualMedia.VideoOnly.INSTANCE).build();
+            // Simplified media type handling
+            if (mediaType.equals("video")) {
+                builder.setMediaType(ActivityResultContracts.PickVisualMedia.VideoOnly.INSTANCE);
+            } else if (mediaType.equals("photo") || cropping) {
+                // Force image-only for cropping
+                builder.setMediaType(ActivityResultContracts.PickVisualMedia.ImageOnly.INSTANCE);
             } else {
-                    request = builder.setMediaType(ActivityResultContracts.PickVisualMedia.ImageAndVideo.INSTANCE).build();
-                }
+                builder.setMediaType(ActivityResultContracts.PickVisualMedia.ImageAndVideo.INSTANCE);
             }
 
             Intent intent;
-
             if (multiple) {
-                intent = new ActivityResultContracts.PickMultipleVisualMedia().createIntent(activity, request);
+                intent = new ActivityResultContracts.PickMultipleVisualMedia().createIntent(activity, builder.build());
             } else {
-                intent = new ActivityResultContracts.PickVisualMedia().createIntent(activity, request);
+                intent = new ActivityResultContracts.PickVisualMedia().createIntent(activity, builder.build());
             }
 
             activity.startActivityForResult(intent, IMAGE_PICKER_REQUEST);
@@ -515,15 +509,16 @@ private void getAsyncSelection(final Activity activity, Uri uri, boolean isCamer
         resultCollector.notifySuccess(getImage(activity, path));
     }
 
-    private Bitmap validateVideo(String path) throws Exception {
+    private Bitmap validateVideo(Uri uri) throws Exception {
         MediaMetadataRetriever retriever = new MediaMetadataRetriever();
-        retriever.setDataSource(path);
+        retriever.setDataSource(getCurrentActivity(), uri);
         Bitmap bmp = retriever.getFrameAtTime();
 
         if (bmp == null) {
             throw new Exception("Cannot retrieve video data");
         }
 
+        retriever.release();
         return bmp;
     }
 
@@ -540,7 +535,7 @@ private static Long getVideoDuration(String path) {
     }
 
     private void getVideo(final Activity activity, final String path, final String mime) throws Exception {
-        validateVideo(path);
+        validateVideo(Uri.parse(path));
         final String compressedVideoPath = getTmpDir(activity) + "/" + UUID.randomUUID().toString() + ".mp4";
 
         new Thread(new Runnable() {
@@ -550,21 +545,24 @@ public void run() {
                     @Override
                     public void invoke(Object... args) {
                         String videoPath = (String) args[0];
-
                         try {
-                            Bitmap bmp = validateVideo(videoPath);
-                            long modificationDate = new File(videoPath).lastModified();
+                            File file = new File(videoPath);
+                            Uri videoUri = Uri.fromFile(file);
+                            MediaMetadataRetriever retriever = new MediaMetadataRetriever();
+                            retriever.setDataSource(activity, videoUri);
+                            Bitmap bmp = retriever.getFrameAtTime();
                             long duration = getVideoDuration(videoPath);
 
                             WritableMap video = new WritableNativeMap();
                             video.putInt("width", bmp.getWidth());
                             video.putInt("height", bmp.getHeight());
                  
```

---

### Incident Patch 9: `174f609a` (2024-11-26)
**Commit Message**: Fix openCamera reported dimensions for portrait photos on Android (#2110)

**File**: `android/src/main/java/com/reactnative/ivpusic/imagepicker/PickerModule.java` (modified, +12/-2)
```diff
@@ -21,6 +21,7 @@
 
 import androidx.core.app.ActivityCompat;
 import androidx.core.content.FileProvider;
+import androidx.exifinterface.media.ExifInterface;
 
 import com.facebook.react.bridge.ActivityEventListener;
 import com.facebook.react.bridge.Callback;
@@ -678,6 +679,15 @@ private WritableMap getImage(final Activity activity, String path) throws Except
             throw new Exception("Cannot select remote files");
         }
         BitmapFactory.Options original = validateImage(path);
+        ExifInterface originalExif = new ExifInterface(path);
+        int orientation = originalExif.getAttributeInt(ExifInterface.TAG_ORIENTATION, 1);
+        boolean invertDimensions = (
+                orientation == ExifInterface.ORIENTATION_ROTATE_90 ||
+                        orientation == ExifInterface.ORIENTATION_ROTATE_270 ||
+                        orientation == ExifInterface.ORIENTATION_TRANSPOSE ||
+                        orientation == ExifInterface.ORIENTATION_TRANSVERSE
+        );
+
 
         // if compression options are provided image will be compressed. If none options is provided,
         // then original image will be returned
@@ -687,8 +697,8 @@ private WritableMap getImage(final Activity activity, String path) throws Except
         long modificationDate = new File(path).lastModified();
 
         image.putString("path", "file://" + compressedImagePath);
-        image.putInt("width", options.outWidth);
-        image.putInt("height", options.outHeight);
+        image.putInt("width", invertDimensions ? options.outHeight : options.outWidth);
+        image.putInt("height", invertDimensions ? options.outWidth : options.outHeight);
         image.putString("mime", options.outMimeType);
         image.putInt("size", (int) new File(compressedImagePath).length());
         image.putString("modificationDate", String.valueOf(modificationDate));
```

---

### Incident Patch 10: `69c70d8e` (2024-11-12)
**Commit Message**: fix: [iOS] Image is being resized up instead of down & Error "User did not grant library permission." in Android 10 (#2103)

* fix: [iOS] Image is being resized up instead of down

* Fix: Error "User did not grant library permission." in Android 10

**File**: `android/src/main/AndroidManifest.xml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
     </queries>
 
     <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
-        android:maxSdkVersion="28" />
+        android:maxSdkVersion="29" />
 
     <application>
 
```

**File**: `ios/src/Compression.m` (modified, +15/-14)
```diff
@@ -40,27 +40,28 @@ - (ImageResult*) compressImageDimensions:(UIImage*)image
     
     CGFloat oldWidth = image.size.width;
     CGFloat oldHeight = image.size.height;
+
+    CGFloat widthScale = maxWidth / oldWidth;
+    CGFloat heightScale = maxHeight / oldHeight;
+    CGFloat scaleFactor = MIN(widthScale, heightScale);
+
+    CGFloat newWidth = oldWidth * scaleFactor;
+    CGFloat newHeight = oldHeight * scaleFactor;
     
-    int newWidth = 0;
-    int newHeight = 0;
-    
-    if (maxWidth < maxHeight) {
-        newWidth = maxWidth;
-        newHeight = (oldHeight / oldWidth) * newWidth;
-    } else {
-        newHeight = maxHeight;
-        newWidth = (oldWidth / oldHeight) * newHeight;
-    }
     CGSize newSize = CGSizeMake(newWidth, newHeight);
-    
-    UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc] initWithSize:newSize];
+
+    UIGraphicsImageRendererFormat *format = [[UIGraphicsImageRendererFormat alloc] init];
+    format.scale = image.scale;
+
+    UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc] initWithSize:newSize format:format];
     UIImage *resizedImage = [renderer imageWithActions:^(UIGraphicsImageRendererContext * _Nonnull rendererContext) {
         [image drawInRect:CGRectMake(0, 0, newSize.width, newSize.height)];
     }];
     
-    result.width = [NSNumber numberWithFloat:newWidth];
-    result.height = [NSNumber numberWithFloat:newHeight];
+    result.width = @(newWidth);
+    result.height = @(newHeight);
     result.image = resizedImage;
+    
     return result;
 }
 
```

---

### Incident Patch 11: `2e3fc690` (2024-10-12)
**Commit Message**: Revert "feat(android):RN-0.73 and AGP 8.0 Compatibility (#2018)"

This reverts commit 47fcfeaa419f9511201d6a21a5cdab4200d75623.

**File**: `android/build.gradle` (modified, +0/-4)
```diff
@@ -17,10 +17,6 @@ android {
     lintOptions {
         abortOnError false
     }
-    def agpVersion = com.android.Version.ANDROID_GRADLE_PLUGIN_VERSION
-    if (agpVersion.tokenize('.')[0].toInteger() >= 7) {
-        namespace "com.reactnative.ivpusic.imagepicker"
-    }    
 }
 
 dependencies {
```

**File**: `android/src/main/AndroidManifest.xml` (modified, +2/-1)
```diff
@@ -1,4 +1,5 @@
-<manifest xmlns:android="http://schemas.android.com/apk/res/android">
+<manifest xmlns:android="http://schemas.android.com/apk/res/android"
+    package="com.reactnative.ivpusic.imagepicker">
 
     <queries>
         <intent>
```

---

### Incident Patch 12: `e7f8129a` (2024-06-14)
**Commit Message**: Fixes an issue that would cause the compiler to crash in Xcode 15 beta (#2068)

**File**: `ios/src/ImageCropPicker.h` (modified, +0/-1)
```diff
@@ -31,7 +31,6 @@
 #elif __has_include("QBImagePickerController.h") // local QBImagePickerController subspec
 #import "QBImagePickerController.h"
 #else
-#import
 #import "QBImagePicker/QBImagePicker.h"
 #endif
 
```

---

### Incident Patch 13: `b8084fd5` (2024-05-04)
**Commit Message**: fix(ios): replace UIGraphicsBeginImageContext in Compression.m (#2055)

Fixes #2054

**File**: `ios/src/Compression.m` (modified, +4/-4)
```diff
@@ -53,10 +53,10 @@ - (ImageResult*) compressImageDimensions:(UIImage*)image
     }
     CGSize newSize = CGSizeMake(newWidth, newHeight);
     
-    UIGraphicsBeginImageContext(newSize);
-    [image drawInRect:CGRectMake(0, 0, newSize.width, newSize.height)];
-    UIImage *resizedImage = UIGraphicsGetImageFromCurrentImageContext();
-    UIGraphicsEndImageContext();
+    UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc] initWithSize:newSize];
+    UIImage *resizedImage = [renderer imageWithActions:^(UIGraphicsImageRendererContext * _Nonnull rendererContext) {
+        [image drawInRect:CGRectMake(0, 0, newSize.width, newSize.height)];
+    }];
     
     result.width = [NSNumber numberWithFloat:newWidth];
     result.height = [NSNumber numberWithFloat:newHeight];
```

---

### Incident Patch 14: `e7768780` (2023-11-13)
**Commit Message**: Fix handling of deleted photos on iOS (#1556)

* Fix crash on iOS when images are deleted

Fixes a crash on iOS when a displayed image is deleted in the
background:

    NSInternalInconsistencyException
    reason: 'attempt to delete and reload the same index path <snip>'

According to
https://developer.apple.com/documentation/photokit/phfetchresultchangedetails?language=objc

    ...changedIndexes can't be used safely inside
    performBatchUpdates:completion: Instead, use changedIndexes after and
    outside the performBatchUpdates:completion: call...

* Update selection when assets are removed from collection

If a selected photo is deleted from the photo library, it needs to be
removed from `selectedAssets` or the UI will hang when the user taps
"Done". Also, the UI needs to be updated to reflect the new selection.

* Update counts in footer when collection changes

When the number of photos or videos in the collection changes, update
the footer to reflect the new counts.

**File**: `ios/QBImagePicker/QBImagePicker/QBAssetsViewController.m` (modified, +89/-44)
```diff
@@ -417,15 +417,31 @@ - (void)photoLibraryDidChange:(PHChange *)changeInstance
                     if ([insertedIndexes count]) {
                         [self.collectionView insertItemsAtIndexPaths:[insertedIndexes qb_indexPathsFromIndexesWithSection:0]];
                     }
-
-                    NSIndexSet *changedIndexes = [collectionChanges changedIndexes];
-                    if ([changedIndexes count]) {
-                        [self.collectionView reloadItemsAtIndexPaths:[changedIndexes qb_indexPathsFromIndexesWithSection:0]];
-                    }
                 } completion:NULL];
+
+                NSIndexSet *changedIndexes = [collectionChanges changedIndexes];
+                if ([changedIndexes count]) {
+                    [self.collectionView reloadItemsAtIndexPaths:[changedIndexes qb_indexPathsFromIndexesWithSection:0]];
+                }
             }
 
             [self resetCachedAssets];
+
+            // Update the selection to remove any assets that have been removed from the collection
+            NSMutableSet *removedAssets = [NSMutableSet new];
+            for (PHAsset *asset in self.imagePickerController.selectedAssets) {
+                if(![self.fetchResult containsObject:asset]) {
+                    [removedAssets addObject:asset];
+                }
+            }
+            [self removeAssetsFromSelection:removedAssets];
+
+            // Update the footer to show the current photo/video counts
+            NSArray<UICollectionReusableView *> *footers =
+                [self.collectionView visibleSupplementaryViewsOfKind:UICollectionElementKindSectionFooter];
+            if (footers.count) {
+                [self updateFooterView:footers[0]];
+            }
         }
     });
 }
@@ -507,57 +523,60 @@ - (UICollectionReusableView *)collectionView:(UICollectionView *)collectionView
         UICollectionReusableView *footerView = [collectionView dequeueReusableSupplementaryViewOfKind:UICollectionElementKindSectionFooter
                                                                                   withReuseIdentifier:@"FooterView"
                                                                                          forIndexPath:indexPath];
+        [self updateFooterView:footerView];
 
-        // Number of assets
-        UILabel *label = (UILabel *)[footerView viewWithTag:1];
+        return footerView;
+    }
 
-        NSBundle *bundle = self.imagePickerController.assetBundle;
-        NSUInteger numberOfPhotos = [self.fetchResult countOfAssetsWithMediaType:PHAssetMediaTypeImage];
-        NSUInteger numberOfVideos = [self.fetchResult countOfAssetsWithMediaType:PHAssetMediaTypeVideo];
+    return nil;
+}
 
-        switch (self.imagePickerController.mediaType) {
-            case QBImagePickerMediaTypeAny:
-            {
-                NSString *format;
-                if (numberOfPhotos == 1) {
-                    if (numberOfVideos == 1) {
-                        format = NSLocalizedStringFromTableInBundle(@"assets.footer.photo-and-video", @"QBImagePicker", bundle, nil);
-                    } else {
-                        format = NSLocalizedStringFromTableInBundle(@"assets.footer.photo-and-videos", @"QBImagePicker", bundle, nil);
-                    }
-                } else if (numberOfVideos == 1) {
-                    format = NSLocalizedStringFromTableInBundle(@"assets.footer.photos-and-video", @"QBImagePicker", bundle, nil);
+- (void)updateFooterView:(UICollectionReusableView *)footerView {
+    // Number of assets
+    UILabel *label = (UILabel *)[footerView viewWithTag:1];
+
+    NSBundle *bundle = self.imagePickerController.assetBundle;
+    NSUInteger numberOfPhotos = [self.fetchResult countOfAssetsWithMediaType:PHAssetMediaTypeImage];
+    NSUInteger numberOfVideos = [self.fetchResult countOfAssetsWithMediaType:PHAssetMediaTypeVideo];
+
+    switch (self.imagePickerController.mediaType) {
+        case QBImagePickerMediaTypeAny:
+        {
+            NSString *format;
+            if (numberOfPhotos == 1) {
+                if (numberOfVideos == 1) {
+                    format = NSLocalizedStringFromTableInBundle(@"assets.footer.photo-and-video", @"QBImagePicker", bundle, nil);
                 } else {
-                    format = NSLocalizedStringFromTableInBundle(@"assets.footer.photos-and-videos", @"QBImagePicker", bundle, nil);
+                    format = NSLocalizedStringFromTableInBundle(@"assets.footer.photo-and-videos", @"QBImagePicker", bundle, nil);
                 }
-
-                label.text = [NSString stringWithFormat:format, numberOfPhotos, numberOfVideos];
+            } else if (numberOfVideos == 1) {
+                format = NSLocalizedStringFromTableInBundle(@"assets.footer.photos-and-video", @"QBImagePicker", bundle, nil);
+            } else {
+                format = NSLocalizedStringFromTableInBundle(@"assets.footer.photos-and-videos", @"QBImagePicker", bundle, nil);
             }
- 
```

---

### Incident Patch 15: `fbffd23f` (2023-10-26)
**Commit Message**: [revert] Fix for openPicker not working when app targets Android 13 (#1973)

**File**: `android/src/main/java/com/reactnative/ivpusic/imagepicker/PickerModule.java` (modified, +2/-2)
```diff
@@ -403,7 +403,7 @@ public void openPicker(final ReadableMap options, final Promise promise) {
         setConfiguration(options);
         resultCollector.setup(promise, multiple);
 
-        permissionsCheck(activity, promise, Collections.singletonList(Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ? Manifest.permission.WRITE_EXTERNAL_STORAGE : Manifest.permission.READ_MEDIA_IMAGES), new Callable<Void>() {
+        permissionsCheck(activity, promise, Collections.singletonList(Manifest.permission.WRITE_EXTERNAL_STORAGE), new Callable<Void>() {
             @Override
             public Void call() {
                 initiatePicker(activity);
@@ -938,4 +938,4 @@ private static WritableMap getCroppedRectMap(Intent data) {
 
         return map;
     }
-}
\ No newline at end of file
+}
```

#### Recent Merged Pull Requests:
- **PR #2253** (2026-09-25): iOS: present the cropper from a controller that is not being dismissed (@ddelange)
- **PR #2251** (2026-09-29): fix(ios): drop imports of RCTImageShadowView/RCTImageView removed in RN 0.87 (@jslok)
- **PR #2249** (closed): fix(ios): bump TOCropViewController to 2.8.0 for iOS 26 toolbar alignment (@Rohit3523)
- **PR #2243** (2026-09-29): fix: return creationDate for videos picked from gallery (@milevy1)
- **PR #2230** (2026-09-29): Bump lodash from 4.17.21 to 4.17.23 in /AwesomeExample (@dependabot[bot])
- **PR #2228** (closed): feat: support for android edge to edge (@Rohit3523)
- **PR #2220** (closed): Bump @react-native-community/cli from 18.0.0 to 20.0.0 in /AwesomeExample (@dependabot[bot])
- **PR #2209** (2025-09-26): Update TOCropViewController to resolve iOS 26 alignment issue (@darshan09200)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
