# Forensic Learning Record (Deep Inspection): lottie-react-native/lottie-react-native

> **Canonical Artifact**: `07_PROJECT_LEARNING/lottie-react-native-lottie-react-native-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lottie-react-native/lottie-react-native](https://github.com/lottie-react-native/lottie-react-native))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T22:49:33.333Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lottie-react-native/lottie-react-native`
- **Description**: Lottie wrapper for React Native.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 17207 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `example-v8/App.tsx`
```
import LottieView from "lottie-react-native-nitro";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width: screenWidth } = Dimensions.get("window");

// Enhanced color scheme
const colors = {
  primary: "#1652f0",
  secondary: "#64E9FF",
  background: "#f8f9fa",
  surface: "#ffffff",
  text: "#2c3e50",
  textLight: "#7f8c8d",
  success: "#27ae60",
  warning: "#f39c12",
  error: "#e74c3c",
  shadow: "rgba(0, 0, 0, 0.1)",
};

// Animation sources
const animationSources = {
  local: require("./animations/LottieLogo1.json"),
  remote: {
    uri: "https://raw.githubusercontent.com/lottie-react-native/lottie-react-native/master/example/animations/Watermelon.json",
  },
  dotLottie: require("./animations/animation_lkekfrcl.lottie"),
};

// Enhanced color filters with more comprehensive mapping
const colorFilters = [
  { keypath: "BG", color: colors.primary },
  { keypath: "O-B", color: colors.secondary },
  { keypath: "L-B", color: colors.secondary },
  { keypath: "T1a-Y 2", color: colors.secondary },
  { keypath: "T1b-Y", color: colors.secondary },
  { keypath: "T2b-B", color: colors.secondary },
  { keypath: "T2a-B", color: colors.secondary },
  { keypath: "I-Y", color: colors.secondary },
  { keypath: "E1-Y", color: colors.secondary },
  { keypath: "E2-Y", color: colors.secondary },
  { keypath: "E3-Y", color: colors.secondary },
];

// Animation speed options
const speedOptions = [0.5, 1, 1.5, 2];

const App: React.FC = () => {
  const lottieRef = useRef<LottieView>(null);
  const [currentSource, setCurrentSource] = useState(animationSources.local);
  const [isLooping, setIsLooping] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Enhanced animation control methods
  const playAnimation = useCallback(() => {
    lottieRef.current?.play();
    setIsPlaying(true);
  }, []);

  const pauseAnimation = useCallback(() => {
    lottieRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const resetAnimation = useCallback(() => {
    lottieRef.current?.reset();
    setIsPlaying(false);
    setProgress(0);
  }, []);

  const playFromFrames = useCallback(() => {
    lottieRef.current?.play(40, 179);
    setIsPlaying(true);
  }, []);

  const changeSource = useCallback((source: any, sourceName: string) => {
    setIsLoading(true);
    setCurrentSource(source);
    setIsPlaying(false);
    setProgress(0);

    // Simulate loading time for better UX
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  }, []);

  const toggleLoop = useCallback(() => {
    setIsLooping((prev) => !prev);
  }, []);

  const changeSpeed = useCallback(() => {
    const currentIndex = speedOptions.indexOf(animationSpeed);
    const nextIndex = (currentIndex + 1) % speedOptions.length;
    setAnimationSpeed(speedOptions[nextIndex]);
  }, [animationSpeed]);

  const handleAnimationFinish = useCallback(() => {
    console.log("Animation finished");
    setIsPlaying(false);
    if (!isLooping) {
      setProgress(1);
    }
  }, [isLooping]);

  const handleAnimationFailure = useCallback((error: any) => {
    console.error("Animation error:", error);
    Alert.alert(
      "Animation Error",
      "Failed to load or play the animation. Please try again.",
      [{ text: "OK" }]
    );
    setIsLoading(false);
    setIsPlaying(false);
  }, []);

  const Button: React.FC<{
    title: string;
    onPress: () => void;
    variant?: "primary" | "secondary" | "success" | "warning";
    disabled?: boolean;
  }> = ({ title, onPress, variant = "primary", disabled = false }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.button,
        styles[`button-${variant}`],
        disabled && styles.buttonDisabled,
      ]}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Lottie Animation Player</Text>
          <Text style={styles.subtitle}>Interactive animation controls</Text>
        </View>

        {/* Animation Container */}
        <View style={styles.animationContainer}>
          <View style={styles.animationWrapper}>
            {isLoading && (
              <View style={styles.loadingOverlay}>
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            )}
            <LottieView
              ref={lottieRef}
              key={`${JSON.stringify(
                currentSource
              )}-${isLooping}-${animationSpeed}`}
              source={currentSource}
              autoPlay={false}
              loop={isLooping}
              speed={animationSpeed}
              containerStyle={styles.lottieContainer}
              style={styles.lottie}
              resizeMode="contain"
              colorFilters={colorFilters}
              enableMergePathsAndroidForKitKatAndAbove
              enableSafeModeAndroid
              onAnimationFinish={handleAnimationFinish}
              onAnimationFailure={handleAnimationFailure}
              onAnimationLoaded={() => setIsLoading(false)}
            />
          </View>

          {/* Animation Info */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              Speed: {animationSpeed}x | Loop: {isLooping ? "ON" : "OFF"} |
              Status: {isPlaying ? "Playing" : "Paused"}
            </Text>
          </View>
        </View>

        {/* Control Sections */}
        <View style={styles.controlsContainer}>
          {/* Animation Sources */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Animation Sources</Text>
            <View style={styles.buttonRow}>
              <Button
                title="Local Animation"
                onPress={() => changeSource(animationSources.local, "Local")}
                variant="primary"
              />
              <Button
                title="Remote Animation"
                onPress={() => changeSource(animationSources.remote, "Remote")}
                variant="secondary"
              />
            </View>
            <Button
              title="DotLottie Animation"
              onPress={() =>
                changeSource(animationSources.dotLottie, "DotLottie")
              }
              variant="success"
            />
          </View>

          {/* Playback Controls */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Playback Controls</Text>
            <View style={styles.buttonRow}>
              <Button
                title={isPlaying ? "Pause" : "Play"}
                onPress={isPlaying ? pauseAnimation : playAnimation}
                variant={isPlaying ? "warning" : "success"}
              />
              <Button
                title="Reset"
                onPress={resetAnimation}
                variant="secondary"
              />
            </View>
            <Button
              title="Play from Frames (40-179)"
              onPress={playFromFrames}
              variant="primary"
            />
          </View>

          {/* Animation Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Animation Settings</Text>
            <View style={styles.buttonRow}>
              <Button
                title={`Speed: ${an
```

### Core Architecture Module: `example-v8/babel.config.js`
```
module.exports = {
  presets: ['module:@react-native/babel-preset'],
};

```

### Core Architecture Module: `example-v8/index.js`
```
/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);

```

### Core Architecture Module: `example-v8/index.web.js`
```
import {AppRegistry} from 'react-native';
import App from './App';

AppRegistry.registerComponent('lottie-nitro-example', () => App);
AppRegistry.runApplication('lottie-nitro-example', {
  rootTag: document.getElementById('root'),
});

```

### Core Architecture Module: `example-v8/metro.config.js`
```
const path = require("path");
const { makeMetroConfig } = require("@rnx-kit/metro-config");
const { getDefaultConfig } = require("@react-native/metro-config");

const defaultConfig = getDefaultConfig(__dirname);

const root = path.resolve(__dirname, "../packages/nitro/");
const pack = require("../packages/nitro/package.json");

const modules = Object.keys(pack.peerDependencies);

module.exports = makeMetroConfig({
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
  },
  resolver: {
    assetExts: [...defaultConfig.resolver.assetExts, "lottie"],
    unstable_enableSymlinks: true,
    extraNodeModules: modules.reduce((acc, name) => {
      acc[name] = path.join(__dirname, "node_modules", name);
      return acc;
    }, {}),
  },
  watchFolders: [root],
});

```

### Core Architecture Module: `example-v8/react-native.config.js`
```
const project = (() => {
  try {
    const { configureProjects } = require("react-native-test-app");
    return configureProjects({
      android: {
        sourceDir: "android",
      },
      ios: {
        sourceDir: "ios",
      },
    });
  } catch (_) {
    return undefined;
  }
})();

module.exports = {
  ...(project ? { project } : undefined),
};

```

### Core Architecture Module: `example-v8/webpack.config.js`
```
const path = require('path');

const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const appDirectory = path.resolve(__dirname);

const {presets} = require(`${appDirectory}/babel.config.js`);
const {resolver} = require('./metro.config.js');

const compileNodeModules = ['lottie-react-native-nitro', 'react-native'].map(
	moduleName => path.resolve(appDirectory, `node_modules/${moduleName}`),
);

const babelLoaderConfiguration = {
	test: /\.js$|tsx?$/,
	include: [
		path.resolve(__dirname, 'index.web.js'),
		path.resolve(__dirname, 'App.tsx'),
		path.resolve(__dirname, 'src'),
		...compileNodeModules,
	],
	use: {
		loader: 'babel-loader',
		options: {
			cacheDirectory: true,
			presets,
			plugins: ['react-native-web'],
		},
	},
};

module.exports = {
	mode: 'development',
	entry: {
		app: './index.web.js',
	},
	stats: {warnings: false},
	output: {
		path: path.resolve(appDirectory, 'dist'),
		publicPath: '/',
		filename: 'output.bundle.js',
	},
	resolve: {
		mainFields: ['react-native', 'main'],
		extensions: [
			'.web.tsx',
			'.web.ts',
			'.tsx',
			'.ts',
			'.web.js',
			'.js',
			'.lottie',
			'.json',
		],
		alias: {
			...resolver.extraNodeModules,
			'react-native': 'react-native-web',
		},
		symlinks: false,
		modules: ['node_modules', 'src'],
	},
	module: {
		rules: [
			babelLoaderConfiguration,
			{
				test: /\.lottie$/,
				type: 'asset/resource',
			},
			{
				test: /\.(png|svg|jpg|jpeg|gif)$/i,
				type: 'asset/resource',
			},
		],
	},
	watch: true,
	watchOptions: {
		followSymlinks: true,
	},
	plugins: [
		new HtmlWebpackPlugin({
			template: path.join(__dirname, 'public', 'index.html'),
		}),
		new webpack.HotModuleReplacementPlugin(),
		new webpack.DefinePlugin({
			__DEV__: JSON.stringify(true),
		}),
	],
};

```

### Core Architecture Module: `example/App.tsx`
```
import LottieView from "lottie-react-native";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width: screenWidth } = Dimensions.get("window");

// Enhanced color scheme
const colors = {
  primary: "#1652f0",
  secondary: "#64E9FF",
  background: "#f8f9fa",
  surface: "#ffffff",
  text: "#2c3e50",
  textLight: "#7f8c8d",
  success: "#27ae60",
  warning: "#f39c12",
  error: "#e74c3c",
  shadow: "rgba(0, 0, 0, 0.1)",
};

// Animation sources
const animationSources = {
  local: require("./animations/LottieLogo1.json"),
  remote: {
    uri: "https://raw.githubusercontent.com/lottie-react-native/lottie-react-native/master/example/animations/Watermelon.json",
  },
  dotLottie: require("./animations/animation_lkekfrcl.lottie"),
};

// Enhanced color filters with more comprehensive mapping
const colorFilters = [
  { keypath: "BG", color: colors.primary },
  { keypath: "O-B", color: colors.secondary },
  { keypath: "L-B", color: colors.secondary },
  { keypath: "T1a-Y 2", color: colors.secondary },
  { keypath: "T1b-Y", color: colors.secondary },
  { keypath: "T2b-B", color: colors.secondary },
  { keypath: "T2a-B", color: colors.secondary },
  { keypath: "I-Y", color: colors.secondary },
  { keypath: "E1-Y", color: colors.secondary },
  { keypath: "E2-Y", color: colors.secondary },
  { keypath: "E3-Y", color: colors.secondary },
];

// Animation speed options
const speedOptions = [0.5, 1, 1.5, 2];

const App: React.FC = () => {
  const lottieRef = useRef<LottieView>(null);
  const [currentSource, setCurrentSource] = useState(animationSources.local);
  const [isLooping, setIsLooping] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Enhanced animation control methods
  const playAnimation = useCallback(() => {
    lottieRef.current?.play();
    setIsPlaying(true);
  }, []);

  const pauseAnimation = useCallback(() => {
    lottieRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const resetAnimation = useCallback(() => {
    lottieRef.current?.reset();
    setIsPlaying(false);
    setProgress(0);
  }, []);

  const playFromFrames = useCallback(() => {
    lottieRef.current?.play(40, 179);
    setIsPlaying(true);
  }, []);

  const changeSource = useCallback((source: any, sourceName: string) => {
    setIsLoading(true);
    setCurrentSource(source);
    setIsPlaying(false);
    setProgress(0);

    // Simulate loading time for better UX
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  }, []);

  const toggleLoop = useCallback(() => {
    setIsLooping((prev) => !prev);
  }, []);

  const changeSpeed = useCallback(() => {
    const currentIndex = speedOptions.indexOf(animationSpeed);
    const nextIndex = (currentIndex + 1) % speedOptions.length;
    setAnimationSpeed(speedOptions[nextIndex]);
  }, [animationSpeed]);

  const handleAnimationFinish = useCallback(() => {
    console.log("Animation finished");
    setIsPlaying(false);
    if (!isLooping) {
      setProgress(1);
    }
  }, [isLooping]);

  const handleAnimationFailure = useCallback((error: any) => {
    console.error("Animation error:", error);
    Alert.alert(
      "Animation Error",
      "Failed to load or play the animation. Please try again.",
      [{ text: "OK" }]
    );
    setIsLoading(false);
    setIsPlaying(false);
  }, []);

  const Button: React.FC<{
    title: string;
    onPress: () => void;
    variant?: "primary" | "secondary" | "success" | "warning";
    disabled?: boolean;
  }> = ({ title, onPress, variant = "primary", disabled = false }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.button,
        styles[`button-${variant}`],
        disabled && styles.buttonDisabled,
      ]}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Lottie Animation Player</Text>
          <Text style={styles.subtitle}>Interactive animation controls</Text>
        </View>

        {/* Animation Container */}
        <View style={styles.animationContainer}>
          <View style={styles.animationWrapper}>
            {isLoading && (
              <View style={styles.loadingOverlay}>
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            )}
            <LottieView
              ref={lottieRef}
              key={`${JSON.stringify(
                currentSource
              )}-${isLooping}-${animationSpeed}`}
              source={currentSource}
              autoPlay={false}
              loop={isLooping}
              speed={animationSpeed}
              containerStyle={styles.lottieContainer}
              style={styles.lottie}
              resizeMode="contain"
              colorFilters={colorFilters}
              enableMergePathsAndroidForKitKatAndAbove
              enableSafeModeAndroid
              onAnimationFinish={handleAnimationFinish}
              onAnimationFailure={handleAnimationFailure}
              onAnimationLoaded={() => setIsLoading(false)}
            />
          </View>

          {/* Animation Info */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              Speed: {animationSpeed}x | Loop: {isLooping ? "ON" : "OFF"} |
              Status: {isPlaying ? "Playing" : "Paused"}
            </Text>
          </View>
        </View>

        {/* Control Sections */}
        <View style={styles.controlsContainer}>
          {/* Animation Sources */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Animation Sources</Text>
            <View style={styles.buttonRow}>
              <Button
                title="Local Animation"
                onPress={() => changeSource(animationSources.local, "Local")}
                variant="primary"
              />
              <Button
                title="Remote Animation"
                onPress={() => changeSource(animationSources.remote, "Remote")}
                variant="secondary"
              />
            </View>
            <Button
              title="DotLottie Animation"
              onPress={() =>
                changeSource(animationSources.dotLottie, "DotLottie")
              }
              variant="success"
            />
          </View>

          {/* Playback Controls */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Playback Controls</Text>
            <View style={styles.buttonRow}>
              <Button
                title={isPlaying ? "Pause" : "Play"}
                onPress={isPlaying ? pauseAnimation : playAnimation}
                variant={isPlaying ? "warning" : "success"}
              />
              <Button
                title="Reset"
                onPress={resetAnimation}
                variant="secondary"
              />
            </View>
            <Button
              title="Play from Frames (40-179)"
              onPress={playFromFrames}
              variant="primary"
            />
          </View>

          {/* Animation Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Animation Settings</Text>
            <View style={styles.buttonRow}>
              <Button
                title={`Speed: ${animatio
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1363** (2025-08-04): **[Android]: borderRadius not respected with backgroundColor**
  *Symptoms*: ### Description  When defining a lottie component with `backgroundColor` and `borderRadius`, On android, the borderRadius is not applied. See screenshots: - on right, ios does correctly apply borderRadius - on left, android doesn't apply borderRadius  <img width="840" height="724" alt="Image" src="https://github.com/user-attachments/assets/bfcbe7cb-9ba3-4d01-bbf9-1fdcc1e092e8" />   ### Steps to reproduce  defined a LottieView ```JS       <LottieView         ref={ref}         source={source}         style={{            width: 400,            height: 400,            borderRadius: 200,            backgroundColor: 'yellow',         }}         enableMergePathsAndroidForKitKatAndAbove         enableSafeModeAndroid       /> ```  I created a reproduction sample directly in the sample app from the repository, here is the patch:  https://github.com/freeboub/bug-lottie-react-native-background-border-radius/commit/e5c62bcb65530f8f7aa44949fa23e5084f39e8ec  ### Snack or a link to a repository  https://github.com/freeboub/bug-lottie-react-native-background-border-radius/commit/e5c62bcb65530f8f7aa44949fa23e5084f39e8ec  ### Lottie React Native version  7.2.4  ### React Native version  0.73.8 (sample) but also reproduced in 0.79.3 (my full integrated app)  ### Platforms  Android  ### Workflow  React Native  ### Architecture  Fabric (New Architecture)  ### Build type  None  ### Device  None  ### Acknowledgements  Yes

- **Issue #1138** (2023-12-21): **Build issue in react-native v0.73 new architecture.**
  *Symptoms*: ### Description The following build commands failed: 	CompileC /Users/niteshrajkhanal/Library/Developer/Xcode/DerivedData/singlecustomerapp-ggsyyaqexacwdkfzzmjannnihwfm/Build/Intermediates.noindex/Pods.build/Debug-iphoneos/lottie-react-native.build/Objects-normal/arm64/LottieAnimationViewComponentView.o /Users/niteshrajkhanal/Desktop/development/sca-mobile-app/node_modules/lottie-react-native/ios/Fabric/LottieAnimationViewComponentView.mm normal arm64 objective-c++ com.apple.compilers.llvm.clang.1_0.compiler (in target 'lottie-react-native' from project 'Pods') (1 failure)  ### Steps to Reproduce  1. Create a new react native application. 2. Package.json  {   "name": "singlecustomerapp",   "version": "0.0.1",   "private": true,   "scripts": {     "android": "react-native run-android",     "ios": "react-native run-ios",     "ios-15": "npx react-native run-ios --simulator='iPhone 15 Pro'",     "lint": "eslint .",     "start": "react-native start",     "test": "jest",     "type-check": "tsc",     "test:report": "jest --collectCoverage --coverageDirectory=\"./coverage\" --ci --reporters=default --reporters=jest-junit --coverage",     "pod-install": "cd ios && RCT_NEW_ARCH_ENABLED=1 bundle exec pod install && cd ..",     "gen-release-apk": "cd android && ./gradlew assembleRelease && cd ..",     "gen-release-bundle": "cd android && ./gradlew bundleRelease && cd ..",     "bundle-android": "react-native bundle --platform android --dev false --entry-file index
  **Post-Mortem & Fix Analysis**:
  > This may be an issue with react-native itself (assuming this is the same problem I am running into).  Here's the actual error output from the failed compilation: ``` In file included from /redacted-path/AwesomeProject/node_modules/lottie-react-native/ios/Fabric/LottieAnimationViewComponentView.mm:1: In file included from /redacted-path/AwesomeProject/node_modules/lottie-react-native/ios/Fabric/LottieAnimationViewComponentView.h:2: In file included from /redacted-path/AwesomeProject/ios/Pods/Headers/Public/React-RCTFabric/React/RCTViewComponentView.h:15: In file included from /redacted-path/AwesomeProject/ios/Pods/Headers/Public/React-Fabric/react/renderer/components/view/ViewProps.h:10: In file included from /redacted-path/AwesomeProject/ios/Pods/Headers/Public/React-Fabric/react/renderer/components/view/HostPlatformViewProps.h:10: In file included from /redacted-path/AwesomeProject/ios/Pods/Headers/Public/React-Fabric/react/renderer/components/view/BaseViewProps.h:11: /redac
  > > This may be an issue with react-native itself (assuming this is the same problem I am running into). >  > Here's the actual error output from the failed compilation: >  > ``` > In file included from /redacted-path/AwesomeProject/node_modules/lottie-react-native/ios/Fabric/LottieAnimationViewComponentView.mm:1: > In file included from /redacted-path/AwesomeProject/node_modules/lottie-react-native/ios/Fabric/LottieAnimationViewComponentView.h:2: > In file included from /redacted-path/AwesomeProject/ios/Pods/Headers/Public/React-RCTFabric/React/RCTViewComponentView.h:15: > In file included from /redacted-path/AwesomeProject/ios/Pods/Headers/Public/React-Fabric/react/renderer/components/view/ViewProps.h:10: > In file included from /redacted-path/AwesomeProject/ios/Pods/Headers/Public/React-Fabric/react/renderer/components/view/HostPlatformViewProps.h:10: > In file included from /redacted-path/AwesomeProject/ios/Pods/Headers/Public/React-Fabric/react/renderer/components/view/Bas
  > no not yet.  I did make a repro project though: https://github.com/heath-clink/rn73-lottie-repro  That's just RN0.73 template project with lottie added, and exhibits this build error when using new architecture.

- **Issue #1114** (2023-12-30): **resizeMode cover not working in IOS (Dot Lottie)**
  *Symptoms*: Hey, i am using below version "lottie-ios": "4.3.0", "lottie-react-native": "6.3.0",  passing resizeMode "cover" is not working. Also we have tried downgrading/upgrading both packages, but resizeMode cover is not working.  ![File](https://github.com/lottie-react-native/lottie-react-native/assets/26677033/5ae469e0-8d42-4267-97ca-547cc40e60b1) 
  **Post-Mortem & Fix Analysis**:
  > Also its only happening for IOS. And working fine when we are using .json file. But for .lottie its not working in ios.
  > ![Screenshot 2023-10-05 at 11 52 53 PM](https://github.com/lottie-react-native/lottie-react-native/assets/26677033/01e507ce-69be-45fb-84e7-e0686c982a64)  Although sometime its working as expected, when i save my file.
  > Same issue here (only iOS), it works for the first time, then when getting back to the page it doesn't recognize the `resizeMode`.

- **Issue #1111** (2023-11-02): **Lottie Animations not playing on iOS 17**
  *Symptoms*: On some iOS devices running iOS 17 the lottie animations are not playing and therefore the onAnimationFinish callback is not being called. This issue started manifesting itself quite randomly on devices running iOS 17, and frankly I haven't had a chance to reproduce it yet, but was able to verify that this was the issue after a user reached out to us with a video where the lottie animation was frozen, and this users device it would always happen.  After performing a reset of settings on the device (Settings -> General -> Transfer or Reset iPhone -> Reset -> Reset All Settings) the animations start running normally again, but obviously this is not the ideal scenario.  Starting this as a discussion and a possible bug report in case anyone is facing the same problem.  As a work around, what we've done on our side is to set a timeout on the screens that depend on animation completion to trigger something else
  **Post-Mortem & Fix Analysis**:
  > we are facing the same exact issue. we use a lottie animation for our splash screen and trigger it to hide on the onAnimationFinished event. unfortunately the animation never plays so the splash screen is stuck for those ios17 users affected by the issue. we implemented an alternative animation using RN Animated as a workaround for now.
  > Just ran into this as well. We ended up implementing a timeout like @jeffersontpadua did but it's a poor user experience obviously. :(
  > Hi @jeffersontpadua   We are facing the same issue. On what version did you notice this issue? We are seeing this on 5.1.6; However, since 6.1.0, there is an onAnimationFailure.  Are you using a version >= 6.1.0 and are you using the onAnimationFailure and still getting the mentioned issue? 

- **Issue #1090** (2023-08-16): **6.1.2 DotLottie's not working for Android Release mode**
  *Symptoms*: ### Description  When building a release version of a RN app, the `.lottie` files will not load.  ### Steps to Reproduce  1. react-native run-android --variant=release 2. install release version of app on device  **Expected behavior:** [What you expected to happen]  The lotties should load  **Actual behavior:** [What actually happened]  The lotties will not load, and you get an error in `onAnimationFailure` of `no protocol`  ### Minimal reproduction  <!-- A link to a minimal reproduction of the issue -->  ### React Native Environment ``` System:     OS: macOS 13.3.1     CPU: (10) arm64 Apple M1 Pro     Memory: 84.34 MB / 16.00 GB     Shell: 5.9 - /bin/zsh   Binaries:     Node: 18.16.1 - ~/.nvm/versions/node/v18.16.1/bin/node     Yarn: 1.22.19 - /opt/homebrew/bin/yarn     npm: 9.5.1 - ~/.nvm/versions/node/v18.16.1/bin/npm     Watchman: 2023.07.10.00 - /opt/homebrew/bin/watchman   Managers:     CocoaPods: 1.12.1 - /opt/homebrew/bin/pod   SDKs:     iOS SDK:       Platforms: DriverKit 22.4, iOS 16.4, macOS 13.3, tvOS 16.4, watchOS 9.4     Android SDK: Not Found   IDEs:     Android Studio: 2022.2 AI-222.4459.24.2221.9862592     Xcode: 14.3.1/14E300c - /usr/bin/xcodebuild   Languages:     Java: 11.0.12 - /usr/local/opt/openjdk@11/bin/javac   npmPackages:     @react-native-community/cli: Not Found     react: 18.2.0 => 18.2.0      react-native: 0.71.12 => 0.71.12      react-native-macos: Not Found   npmGlobalPackages:     *react-nativ
  **Post-Mortem & Fix Analysis**:
  > I also just tested out the `paper` example app in the repo, and the local Dot Lottie example is also broken in Release mode on Android
  > @matinzd happy to jump on a call with you to help debug, I spent a lot of time yesterday trying to figure out whats happening, but it seem to be with how the `.lottie` files are getting bundled into the .apk when building for release. Once they are bundled then the `lottie-android` is unable to access them from the bundled assets and returns back the "no protocol" error  For now we have reverted back to using the `.json` files
  > Is it working properly on iOS release? 

- **Issue #1018** (2023-06-22): **Build crashing on React native macos**
  *Symptoms*: ### Description I have installed react-native-macos in my project. Android and IOS are working fine with react-native-lotte. But when i am trying to build the macos project, the build is crashing.   [Description of the bug] The following build commands failed: 	SwiftEmitModule normal arm64 Emitting\ module\ for\ lottie_react_native (in target 'lottie-react-native-macOS' from project 'Pods') (1 failure)  Also when I see my XCODE, getting this error Cannot find type 'UITraitCollection' in scope ### Steps to Reproduce  react-native run-macos  **Expected behavior:** [What you expected to happen] App should work as it is working for android and ios **Actual behavior:** [What actually happened] App is crashing <img width="1181" alt="Screenshot 2023-05-01 at 3 14 17 PM" src="https://user-images.githubusercontent.com/37023744/235439478-0860f6e3-3e66-4ee6-a0da-0e1c583dfa6e.png">  ### Versions react native: 0.71 react native macos: 0.71  You can get this information from executing `npm version`. 
  **Post-Mortem & Fix Analysis**:
  > What version of lottie are you using?
  > @matinzd  > What version of lottie are you using?  "lottie-react-native": "^5.1.5", "react": "18.2.0", "react-native": "0.71.7", "react-native-macos": "^0.71.0-0",
  > React Native macOS maintainer here, if we ifdef out the iOS block for macOS, are there any other issues? I took a quick look at the code and it seems to be implemented cross platform

- **Issue #999** (2023-08-10): **Cannot get any Lottie animations to show in an Expo SDK 48 React Native app.**
  *Symptoms*: ### Description  Cannot get any Lottie animations to show in an Expo SDK 48 React Native app.  ### Steps to Reproduce  1. Install `lottie-react-native` as described by Expo docs [here](https://docs.expo.dev/versions/latest/sdk/lottie/) (we are using the managed workflow) 2. Add LottieView as described within the Expo docs:  `      <LottieView         autoPlay         ref={animation}         style={{           width: 200,           height: 200,           backgroundColor: '#eee',         }}         source={require('./assets/gradientBall.json')}       />` 3. I have tried the various solutions suggested by this [thread](https://github.com/lottie-react-native/lottie-react-native/issues/832) to no luck or avail.  **Expected behavior:** See Lottie Animation on screen. One thing to mention is that we are using [development-client](https://docs.expo.dev/development/create-development-builds/) builds for Expo, so NOT the Expo Go app. We're also using the **hermes** engine if that means anything.  **Actual behavior:** Expect to see Lottie animation on screen but the area is occupied and I can see the background but there is no animation. It never plays and never appears.  ### Versions `  "lottie-react-native": "5.1.4",     "react": "18.2.0",     "react-dom": "18.2.0",     "react-native": "0.71.3",`  
  **Post-Mortem & Fix Analysis**:
  > I am working on releasing v6 and communicating with expo to increase the recommended version and that should fix all the issues for all expo users.  Stay tuned! 
  > > I am working on releasing v6 and communicating with expo to increase the recommended version and that should fix all the issues for all expo users. Stay tuned!  Thanks, man! Appreciate your effort!
  > > I am working on releasing v6 and communicating with expo to increase the recommended version and that should fix all the issues for all expo users.  > Stay tuned!  When can we expect v6 to be released? Can you give us an estimated time frame? 

- **Issue #989** (2023-04-15): **[Windows] Styles with positional attributes are applied twice, resulting in incorrect positioning.**
  *Symptoms*: ### Description LottieView is implemented as:  ``` <View style={[aspectRatioStyle, sizeStyle, style]}>     <AnimatedNativeLottieView style={[             aspectRatioStyle,             sizeStyle || { width: '100%', height: '100%' },             style,           ]}     /> </View> ```  Here we can see the incoming style property is applied twice, once to outer view and again to the native control. This means that if the style contains positional settings, such as `{ left: 50 }`, they first cause the outer View container to be translated relative to its parent, and then the animation itself to be translated further.  ### Steps to Reproduce ``` <View style={{ backgroundColor: "blue"}}>     <LottieView style={ { left: 50, width: 50, height: 50, backgroundColor: "red" } } /> </View> ``` **Expected behavior:** Animation is positioned 50 units way from the left side of the surrounding blue box, and the red color is only behind the animation. ![image](https://user-images.githubusercontent.com/1130900/219801161-876f5a06-42d1-4960-bd42-6f8b78f9608b.png)  **Actual behavior:** Red box is positioned 50 units from the left of the surrounding blue box top-left corner, animation is positioned a further 50 units to the right. ![image](https://user-images.githubusercontent.com/1130900/219801083-72f4281a-8ca1-49c6-8234-fbaca7776d78.png)  ### Versions lottie-react-native: 5.1.5 react: 18.0 react-native: 0.69.3 react-native-windows: 0.69.19  Tested on Windows only
  **Post-Mortem & Fix Analysis**:
  > This should get fixed in v6. I will close this for now.  Feel free to reopen it.
  > same issue here in v6, my code:  ``` <View       style={{         paddingHorizontal: 30,         paddingTop: insets.top ,         flex:1,         paddingBottom: insets.bottom + 10,         backgroundColor: colors.background,       }}     >       <LottieView       source={require("../../../../assets/lottie/error.json")}       style={{width: 100, height: 100, backgroundColor: "blue"}}       autoPlay       loop     /> </View> ```  <img width="434" alt="Screenshot 2023-08-01 alle 11 23 07" src="https://github.com/lottie-react-native/lottie-react-native/assets/56274206/1d24fe70-02c0-42b8-9b2d-418d58bda5c7">  

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

### Incident Patch 1: `3ac0a0cb` (2026-08-22)
**Commit Message**: fix: support static animation sources (#1466)

* fix: support static animation sources

Keep the v7 and v8 source prop types aligned with the existing numeric asset runtime path.

Closes #1403.

* test: remove static source type test

---------

Co-authored-by: Parsa Nasirimehr <40071952+TheRogue76@users.noreply.github.com>

**File**: `packages/core/src/types.ts` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ export interface LottieViewProps {
    * animation, obtained (for example) with something like
    * `require('../path/to/animation.json')`
    */
-  source: string | AnimationObject | { uri: string };
+  source: string | AnimationObject | { uri: string } | number;
 
   /**
    * A number between 0 and 1, or an `Animated` number between 0 and 1. This number
```

**File**: `packages/nitro/src/types.ts` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ export interface LottieViewProps {
    * animation, obtained (for example) with something like
    * `require('../path/to/animation.json')`
    */
-  source: string | AnimationObject | { uri: string };
+  source: string | AnimationObject | { uri: string } | number;
 
   /**
    * A number between 0 and 1, or an `Animated` number between 0 and 1. This number
```

---

### Incident Patch 2: `6c265d7d` (2026-08-14)
**Commit Message**: fix(android): skip explicit kotlin-android plugin when AGP 9 built-in Kotlin is enabled (#1463)

* fix(android): skip explicit kotlin-android plugin when AGP 9 built-in Kotlin is enabled

Android Gradle Plugin 9.0 compiles Kotlin sources itself and turns that
built-in support on by default. Applying the standalone Kotlin Android
plugin on top of it fails at configuration time, so every consumer app
that upgrades to AGP 9 cannot build this library unless it opts out of
built-in Kotlin globally.

Apply 'kotlin-android' only when AGP's built-in Kotlin is not in effect,
that is on AGP below 9 or when the consumer sets
'android.builtInKotlin=false'. Behaviour is unchanged on every AGP the
library supported before.

* fix(android): apply the built-in Kotlin guard to the nitro package too

Address review: drop the explanatory comment in `packages/core` and mirror the
same conditional in `packages/nitro`, which applies
`org.jetbrains.kotlin.android` and hits the identical AGP 9 failure.

---------

Co-authored-by: kimchi-developer <214411186+kimchi-developer@users.noreply.github.com>

**File**: `packages/core/android/build.gradle` (modified, +13/-1)
```diff
@@ -25,8 +25,20 @@ def isNewArchitectureEnabled() {
     return project.hasProperty("newArchEnabled") && project.newArchEnabled == "true"
 }
 
+def isBuiltInKotlinEnabled() {
+    def agpMajorVersion = com.android.Version.ANDROID_GRADLE_PLUGIN_VERSION.tokenize('.')[0].toInteger()
+    if (agpMajorVersion < 9) {
+        return false
+    }
+    def builtInKotlinProperty = project.findProperty('android.builtInKotlin')
+    return builtInKotlinProperty == null || builtInKotlinProperty.toString().toBoolean()
+}
+
 apply plugin: 'com.android.library'
-apply plugin: 'kotlin-android'
+
+if (!isBuiltInKotlinEnabled()) {
+    apply plugin: 'kotlin-android'
+}
 
 if (isNewArchitectureEnabled()) {
     apply plugin: 'com.facebook.react'
```

**File**: `packages/nitro/android/build.gradle` (modified, +13/-1)
```diff
@@ -32,8 +32,20 @@ def getExtOrIntegerDefault(name) {
         : (project.properties["LottieNitro_" + name]).toInteger()
 }
 
+def isBuiltInKotlinEnabled() {
+    def agpMajorVersion = com.android.Version.ANDROID_GRADLE_PLUGIN_VERSION.tokenize(".")[0].toInteger()
+    if (agpMajorVersion < 9) {
+        return false
+    }
+    def builtInKotlinProperty = project.findProperty("android.builtInKotlin")
+    return builtInKotlinProperty == null || builtInKotlinProperty.toString().toBoolean()
+}
+
 apply plugin: "com.android.library"
-apply plugin: "org.jetbrains.kotlin.android"
+
+if (!isBuiltInKotlinEnabled()) {
+    apply plugin: "org.jetbrains.kotlin.android"
+}
 
 // Adds nitrogen/generated/android/kotlin to java.srcDirs. Without this the
 // generated HybridLottieViewSpec, HybridLottieViewManager and LottieNitroOnLoad
```

---

### Incident Patch 3: `03b74c47` (2026-08-13)
**Commit Message**: docs: fix dead links to the Metro and React Native docs (#1462)

Both links point at the retired facebook.github.io domain and return 404:

- The Metro configuration link in the metro.config.js snippet now points at
  metrobundler.dev, matching the URL React Native ships in its own template.
- The View layout props link now points at reactnative.dev.

Both replacements were verified to return 200.

Co-authored-by: Claude <noreply@anthropic.com>

**File**: `README.md` (modified, +2/-2)
```diff
@@ -232,7 +232,7 @@ const defaultConfig = getDefaultConfig(__dirname);
 
 /**
  * Metro configuration
- * https://facebook.github.io/metro/docs/configuration
+ * https://metrobundler.dev/docs/configuration
  *
  * @type {import('metro-config').MetroConfig}
  */
@@ -273,7 +273,7 @@ You can find the full list of props and methods available in our [API document](
 | Prop               | Description                                                                                                                                                                                                                                                                     | Default                                                                                                                         |
 | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
 | **`source`**       | **Mandatory** - The source of animation. Can be referenced as a local asset by a string, or remotely with an object with a `uri` property, or it can be an actual JS object of an animation, obtained (for example) with something like `require('../path/to/animation.json')`. | _None_                                                                                                                          |
-| **`style`**        | Style attributes for the view, as expected in a standard [`View`](https://facebook.github.io/react-native/docs/layout-props.html).                                                                                                                                              | You need to set it manually. Refer to this [pull request](https://github.com/lottie-react-native/lottie-react-native/pull/992). |
+| **`style`**        | Style attributes for the view, as expected in a standard [`View`](https://reactnative.dev/docs/layout-props).                                                                                                                                              | You need to set it manually. Refer to this [pull request](https://github.com/lottie-react-native/lottie-react-native/pull/992). |
 | **`loop`**         | A boolean flag indicating whether or not the animation should loop.                                                                                                                                                                                                             | `true`                                                                                                                          |
 | **`autoPlay`**     | A boolean flag indicating whether or not the animation should start automatically when mounted. This only affects the imperative API.                                                                                                                                           | `false`                                                                                                                         |
 | **`colorFilters`** | An array of objects denoting layers by KeyPath and a new color filter value (as hex string).                                                                                                                                                                                    | `[]`                                                                                                                            |
```

---

### Incident Patch 4: `815fd4ee` (2026-08-05)
**Commit Message**: feat: require React Native 0.84, upgrade react-native-test-app to 5.4.7 and fix iOS ci (#1453)

* feat!: require React Native 0.84, upgrade react-native-test-app to 5.4.7

Raises the minimum supported React Native version to 0.84, the oldest
release still receiving upstream support (0.86/0.85 are Active, 0.84 is
End of Cycle, 0.83 and earlier are Unsupported), and upgrades
`react-native-test-app` from 4.1.4 to 5.4.7.

These two bumps have to land together. RNTA 5.4.7 pins
`androidx.camera:*` to 1.6.1, which requires compileSdk 36 and AGP
8.9.1+; RNTA derives both from React Native's version catalog, and 0.78
supplies compileSdk 35 / AGP 8.8.0, so the Android build fails in
`checkDebugAarMetadata`. Conversely RNTA 4.1.4 caps `react-native` at
0.78, so neither version can move on its own. RN 0.84 ships compileSdk
36 and AGP 8.12.0, which clears the CameraX floor.

The stale 3.8.7 devDependency is also dropped from the monorepo root;
nothing outside `example/` referenced it, and keeping a second major
around meant yarn installed two copies.

Notable knock-on changes:

- `example/tsconfig.json` extended
  `@react-native/typescript-config/tsconfig.json`, but 0.84 added an
  `exports` ma

**File**: `.github/workflows/android-fabric-build.yml` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ jobs:
       - name: Set up Node.js
         uses: actions/setup-node@v3
         with:
-          node-version: 18
+          node-version: 22
 
       - name: Enable corepack
         run: corepack enable
```

**File**: `.github/workflows/android-paper-build.yml` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ jobs:
       - name: Set up Node.js
         uses: actions/setup-node@v3
         with:
-          node-version: 18
+          node-version: 22
 
       - name: Enable corepack
         run: corepack enable
```

**File**: `.github/workflows/ios-fabric-build.yml` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ jobs:
       - name: Set up Node.js
         uses: actions/setup-node@v3
         with:
-          node-version: 18
+          node-version: 22
 
       - name: Enable corepack
         run: corepack enable
```

**File**: `.github/workflows/ios-paper-build.yml` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ jobs:
       - name: Set up Node.js
         uses: actions/setup-node@v3
         with:
-          node-version: 18
+          node-version: 22
 
       - name: Enable corepack
         run: corepack enable
```

**File**: `.github/workflows/lint-test.yml` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ jobs:
       - name: Set up Node.js
         uses: actions/setup-node@v3
         with:
-          node-version: 18
+          node-version: 22
 
       - name: Enable corepack
         run: corepack enable
```

---

### Incident Patch 5: `5cb225d8` (2026-08-03)
**Commit Message**: fix(ci): use macos-latest, drop Xcode version matrix and xcode-select (#1448)

* fix: pin iOS CI workflows to macos-15 to fix Xcode 16.4 availability

Co-authored-by: matinzd <24797481+matinzd@users.noreply.github.com>

* fix: use macos-latest, remove xcode matrix and xcode-select steps

Co-authored-by: matinzd <24797481+matinzd@users.noreply.github.com>

---------

Co-authored-by: copilot-swe-agent[bot] <198982749+Copilot@users.noreply.github.com>
Co-authored-by: matinzd <24797481+matinzd@users.noreply.github.com>

**File**: `.github/workflows/ios-fabric-build.yml` (modified, +0/-10)
```diff
@@ -14,17 +14,7 @@ jobs:
   build-example:
     runs-on: macos-latest
 
-    strategy:
-      matrix:
-        xcode-version: [16.4]
-
     steps:
-      - name: List all available XCode versions
-        run: ls -n /Applications/ | grep Xcode*
-
-      - name: Switch XCode Version
-        run: sudo xcode-select -s /Applications/Xcode_${{ matrix.xcode-version }}.app/Contents/Developer
-
       - name: Cache cocoapods
         uses: actions/cache@v3
         with:
```

**File**: `.github/workflows/ios-paper-build.yml` (modified, +0/-10)
```diff
@@ -14,17 +14,7 @@ jobs:
   build-example:
     runs-on: macos-latest
 
-    strategy:
-      matrix:
-        xcode-version: [16.4]
-
     steps:
-      - name: List all available XCode versions
-        run: ls -n /Applications/ | grep Xcode*
-
-      - name: Switch XCode Version
-        run: sudo xcode-select -s /Applications/Xcode_${{ matrix.xcode-version }}.app/Contents/Developer
-
       - name: Checkout Repository
         uses: actions/checkout@v3
 
```

---

### Incident Patch 6: `91f174cf` (2026-08-01)
**Commit Message**: docs: fix stale org clone URL and package name references (#1430)

Co-authored-by: Patrick Wehbe <patrick.wehbe.applications@gmail.com>
Co-authored-by: Matin Zadeh Dolatabad <24797481+matinzd@users.noreply.github.com>

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ After forking to your own github org, do the following steps to get started:
 
 ```bash
 # clone your fork to your local machine
-git clone https://github.com/airbnb/lottie-react-native.git
+git clone https://github.com/lottie-react-native/lottie-react-native.git
 
 # step into local repo
 cd lottie-react-native
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -268,7 +268,7 @@ module.exports = {
 
 ## API
 
-You can find the full list of props and methods available in our [API document](https://github.com/airbnb/lottie-react-native/blob/master/docs/api.md). These are the most common ones:
+You can find the full list of props and methods available in our [API document](https://github.com/lottie-react-native/lottie-react-native/blob/master/docs/api.md). These are the most common ones:
 
 | Prop               | Description                                                                                                                                                                                                                                                                     | Default                                                                                                                         |
 | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
@@ -278,7 +278,7 @@ You can find the full list of props and methods available in our [API document](
 | **`autoPlay`**     | A boolean flag indicating whether or not the animation should start automatically when mounted. This only affects the imperative API.                                                                                                                                           | `false`                                                                                                                         |
 | **`colorFilters`** | An array of objects denoting layers by KeyPath and a new color filter value (as hex string).                                                                                                                                                                                    | `[]`                                                                                                                            |
 
-[More...](https://github.com/airbnb/lottie-react-native/blob/master/docs/api.md)
+[More...](https://github.com/lottie-react-native/lottie-react-native/blob/master/docs/api.md)
 
 ## Troubleshooting
 
```

**File**: `docs/api.md` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ When creating animations using AfterEffects and bodymovin, the exported json may
   ...
 ```
 
-To make `react-native-lottie` use those assets properly, it is necessary to go for the native route: so remember that you need to **fully** rebuild your application if you modify the images / add new ones.
+To make `lottie-react-native` use those assets properly, it is necessary to go for the native route: so remember that you need to **fully** rebuild your application if you modify the images / add new ones.
 
 ### Android
 
```

---

### Incident Patch 7: `6deeab0d` (2026-05-14)
**Commit Message**: fix: CAlayer ambiguous expression on macOS (#1414)

* fix: CAlayer ambiguous expression on macOS

* Add platform check

---------

Co-authored-by: Matin Zadeh Dolatabad <24797481+matinzd@users.noreply.github.com>

**File**: `packages/core/ios/LottieReactNative/ContainerView.swift` (modified, +6/-2)
```diff
@@ -286,8 +286,12 @@ class ContainerView: RCTView {
         if let current = animationView {
             // Remove from view hierarchy
             current.removeFromSuperview()
-            // Clear layer contents to prevent any rendering artifacts
-            current.layer.contents = nil
+            // Clear layer contents to prevent any rendering artifacts 
+            #if !os(macOS) 
+                current.layer.contents = nil
+            #else
+                current.layer?.contents = nil
+            #endif
             // Clear the reference
             animationView = nil
         }
```

---

### Incident Patch 8: `d556c002` (2026-05-14)
**Commit Message**: fix: audit deps

**File**: `package.json` (modified, +3/-1)
```diff
@@ -34,7 +34,9 @@
   },
   "resolutions": {
     "@types/react": "^18.2.12",
-    "@types/react-native": "^0.70.14"
+    "@types/react-native": "^0.70.14",
+    "lodash": "4.17.12",
+    "fast-xml-parser": "4.5.4"
   },
   "workspaces": [
     "./packages/*",
```

**File**: `packages/core/windows/LottieReactNativeWindows/LottieReactNativeWindows.csproj` (modified, +1/-1)
```diff
@@ -139,7 +139,7 @@
       <Version>2.6.0</Version>
     </PackageReference>
     <PackageReference Include="System.Drawing.Common">
-      <Version>4.7.0</Version>
+      <Version>4.7.2</Version>
     </PackageReference>
   </ItemGroup>
   <ItemGroup>
```

**File**: `yarn.lock` (modified, +93/-1298)
```diff
@@ -114,28 +114,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@babel/code-frame@npm:^7.0.0, @babel/code-frame@npm:^7.12.13, @babel/code-frame@npm:^7.24.7":
-  version: 7.24.7
-  resolution: "@babel/code-frame@npm:7.24.7"
-  dependencies:
-    "@babel/highlight": ^7.24.7
-    picocolors: ^1.0.0
-  checksum: 830e62cd38775fdf84d612544251ce773d544a8e63df667728cc9e0126eeef14c6ebda79be0f0bc307e8318316b7f58c27ce86702e0a1f5c321d842eb38ffda4
-  languageName: node
-  linkType: hard
-
-"@babel/code-frame@npm:^7.26.2, @babel/code-frame@npm:^7.27.1":
-  version: 7.27.1
-  resolution: "@babel/code-frame@npm:7.27.1"
-  dependencies:
-    "@babel/helper-validator-identifier": ^7.27.1
-    js-tokens: ^4.0.0
-    picocolors: ^1.1.1
-  checksum: 5874edc5d37406c4a0bb14cf79c8e51ad412fb0423d176775ac14fc0259831be1bf95bdda9c2aa651126990505e09a9f0ed85deaa99893bc316d2682c5115bdc
-  languageName: node
-  linkType: hard
-
-"@babel/code-frame@npm:^7.28.6, @babel/code-frame@npm:^7.29.0":
+"@babel/code-frame@npm:^7.0.0, @babel/code-frame@npm:^7.12.13, @babel/code-frame@npm:^7.24.7, @babel/code-frame@npm:^7.26.2, @babel/code-frame@npm:^7.27.1, @babel/code-frame@npm:^7.28.6, @babel/code-frame@npm:^7.29.0":
   version: 7.29.0
   resolution: "@babel/code-frame@npm:7.29.0"
   dependencies:
@@ -146,44 +125,14 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@babel/compat-data@npm:^7.20.5, @babel/compat-data@npm:^7.22.6, @babel/compat-data@npm:^7.24.7":
-  version: 7.24.7
-  resolution: "@babel/compat-data@npm:7.24.7"
-  checksum: 1fc276825dd434fe044877367dfac84171328e75a8483a6976aa28bf833b32367e90ee6df25bdd97c287d1aa8019757adcccac9153de70b1932c0d243a978ae9
-  languageName: node
-  linkType: hard
-
-"@babel/compat-data@npm:^7.27.2, @babel/compat-data@npm:^7.27.7":
+"@babel/compat-data@npm:^7.20.5, @babel/compat-data@npm:^7.24.7, @babel/compat-data@npm:^7.27.2, @babel/compat-data@npm:^7.27.7":
   version: 7.28.0
   resolution: "@babel/compat-data@npm:7.28.0"
   checksum: 37a40d4ea10a32783bc24c4ad374200f5db864c8dfa42f82e76f02b8e84e4c65e6a017fc014d165b08833f89333dff4cb635fce30f03c333ea3525ea7e20f0a2
   languageName: node
   linkType: hard
 
-"@babel/core@npm:^7.11.6, @babel/core@npm:^7.12.3, @babel/core@npm:^7.13.16, @babel/core@npm:^7.14.0, @babel/core@npm:^7.18.5, @babel/core@npm:^7.20.0, @babel/core@npm:^7.23.9":
-  version: 7.24.7
-  resolution: "@babel/core@npm:7.24.7"
-  dependencies:
-    "@ampproject/remapping": ^2.2.0
-    "@babel/code-frame": ^7.24.7
-    "@babel/generator": ^7.24.7
-    "@babel/helper-compilation-targets": ^7.24.7
-    "@babel/helper-module-transforms": ^7.24.7
-    "@babel/helpers": ^7.24.7
-    "@babel/parser": ^7.24.7
-    "@babel/template": ^7.24.7
-    "@babel/traverse": ^7.24.7
-    "@babel/types": ^7.24.7
-    convert-source-map: ^2.0.0
-    debug: ^4.1.0
-    gensync: ^1.0.0-beta.2
-    json5: ^2.2.3
-    semver: ^6.3.1
-  checksum: 017497e2a1b4683a885219eef7d2aee83c1c0cf353506b2e180b73540ec28841d8ef1ea1837fa69f8c561574b24ddd72f04764b27b87afedfe0a07299ccef24d
-  languageName: node
-  linkType: hard
-
-"@babel/core@npm:^7.24.7, @babel/core@npm:^7.25.2":
+"@babel/core@npm:^7.11.6, @babel/core@npm:^7.12.3, @babel/core@npm:^7.13.16, @babel/core@npm:^7.14.0, @babel/core@npm:^7.18.5, @babel/core@npm:^7.20.0, @babel/core@npm:^7.23.9, @babel/core@npm:^7.24.7, @babel/core@npm:^7.25.2":
   version: 7.28.0
   resolution: "@babel/core@npm:7.28.0"
   dependencies:
@@ -220,32 +169,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@babel/generator@npm:^7.14.0, @babel/generator@npm:^7.20.0, @babel/generator@npm:^7.24.7, @babel/generator@npm:^7.7.2":
-  version: 7.24.7
-  resolution: "@babel/generator@npm:7.24.7"
-  dependencies:
-    "@babel/types": ^7.24.7
-    "@jridgewell/gen-mapping": ^0.3.5
-    "@jridgewell/trace-mapping": ^0.3.25
-    jsesc: ^2.5.1
-  checksum: 0ff31a73b15429f1287e4d57b439bba4a266f8c673bb445fe313b82f6d110f586776997eb723a777cd7adad9d340edd162aea4973a90112c5d0cfcaf6686844b
-  languageName: 
```

---

### Incident Patch 9: `8827c001` (2026-02-12)
**Commit Message**: fix: update native libs (#1398)

* chore: update android deps

* chore: update ios deps

* chore: update android deps to latest

**File**: `packages/core/android/build.gradle` (modified, +1/-1)
```diff
@@ -124,7 +124,7 @@ dependencies {
     //noinspection GradleDynamicVersion
     implementation 'com.facebook.react:react-native:+' // From node_modules
 
-    implementation "com.airbnb.android:lottie:6.5.2"
+    implementation "com.airbnb.android:lottie:6.7.1"
 }
 
 if (isNewArchitectureEnabled()) {
```

**File**: `packages/core/lottie-react-native.podspec` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ Pod::Spec.new do |s|
     'Lottie_React_Native_Privacy' => ['ios/PrivacyInfo.xcprivacy'],
   }
 
-  s.dependency 'lottie-ios', '4.5.0'
+  s.dependency 'lottie-ios', '4.6.0'
 
   s.swift_version = '5.9'
 
```

---

### Incident Patch 10: `b7a0e3c0` (2026-01-09)
**Commit Message**: fix: improve animation loading by clearing previous view (#1385)

**File**: `packages/core/ios/LottieReactNative/ContainerView.swift` (modified, +19/-1)
```diff
@@ -168,6 +168,9 @@ class ContainerView: RCTView {
             return
         }
 
+        // Immediately clear the previous animation view so the region is blank while loading
+        removeCurrentAnimationView()
+
         _ = LottieAnimationView(
             dotLottieUrl: url,
             configuration: lottieConfiguration,
@@ -196,6 +199,9 @@ class ContainerView: RCTView {
 
         guard let url = url else { return }
 
+        // Immediately clear the previous animation view so the region is blank while loading
+        removeCurrentAnimationView()
+
         self.fetchRemoteAnimation(from: url)
     }
 
@@ -276,8 +282,20 @@ class ContainerView: RCTView {
     }
 
     // MARK: Private
+    private func removeCurrentAnimationView() {
+        if let current = animationView {
+            // Remove from view hierarchy
+            current.removeFromSuperview()
+            // Clear layer contents to prevent any rendering artifacts
+            current.layer.contents = nil
+            // Clear the reference
+            animationView = nil
+        }
+    }
+
     func replaceAnimationView(next: LottieAnimationView) {
-        super.removeReactSubview(animationView)
+        // Ensure any existing view is properly detached from UIKit hierarchy
+        removeCurrentAnimationView()
 
         animationView = next
 
```

#### Recent Merged Pull Requests:
- **PR #1466** (2026-08-22): fix: support static animation sources (@huytdps13400)
- **PR #1465** (2026-08-22): switch to lottie spm for our SPM support (@TheRogue76)
- **PR #1464** (2026-08-17): feat(core): add Swift Package Manager support for React Native 0.87 (@TheRogue76)
- **PR #1463** (2026-08-14): fix(android): skip explicit kotlin-android plugin when AGP 9 built-in Kotlin is enabled (@kimchi-developer)
- **PR #1462** (2026-08-13): docs: fix dead links to the Metro and React Native docs (@luccasfraga)
- **PR #1461** (2026-08-13): chore(deps): bump concurrent-ruby from 1.3.3 to 1.3.7 in /example-v8 (@dependabot[bot])
- **PR #1460** (2026-08-13): chore(deps): bump concurrent-ruby from 1.3.3 to 1.3.7 in /example (@dependabot[bot])
- **PR #1459** (2026-08-17): feat: implement the imperative commands, add CI, and close out the v8 port (@TheRogue76)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
