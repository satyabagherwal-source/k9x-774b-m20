# Forensic Learning Record (Deep Inspection): margelo/react-native-vision-camera

> **Canonical Artifact**: `07_PROJECT_LEARNING/margelo-react-native-vision-camera-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/margelo/react-native-vision-camera](https://github.com/margelo/react-native-vision-camera))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:40:01.495Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `margelo/react-native-vision-camera`
- **Description**: 📸 A powerful, high-performance React Native Camera library.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9642 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/simple-camera/babel.config.js`
```
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-worklets/plugin'],
}

```

### Core Architecture Module: `apps/simple-camera/index.js`
```
/**
 * @format
 */

import { AppRegistry } from 'react-native'
import { name as appName } from './app.json'
import App from './src/App'

AppRegistry.registerComponent(appName, () => App)

```

### Core Architecture Module: `apps/simple-camera/jest.harness.config.mjs`
```
const config = {
  preset: 'react-native-harness',
  testMatch: ['<rootDir>/__tests__/**/*.harness.{js,jsx,ts,tsx}'],
}

export default config

```

### Core Architecture Module: `apps/simple-camera/metro.config.js`
```
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const path = require('node:path')

const root = path.resolve(__dirname, '..', '..')

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [root],
}

module.exports = mergeConfig(getDefaultConfig(__dirname), config)

```

### Core Architecture Module: `apps/simple-camera/rn-harness.config.mjs`
```
import {
  androidEmulator,
  androidPlatform,
  physicalAndroidDevice,
} from '@react-native-harness/platform-android'
import {
  applePhysicalDevice,
  applePlatform,
  appleSimulator,
} from '@react-native-harness/platform-apple'

const androidEmulatorName =
  process.env.HARNESS_ANDROID_EMULATOR ?? 'Pixel_API_35'
const androidApiLevel = Number.parseInt(
  process.env.HARNESS_ANDROID_API_LEVEL ?? '35',
  10,
)
const androidDeviceProfile =
  process.env.HARNESS_ANDROID_DEVICE_PROFILE ?? 'pixel'
const androidDiskSize = process.env.HARNESS_ANDROID_DISK_SIZE ?? '1G'
const androidHeapSize = process.env.HARNESS_ANDROID_HEAP_SIZE ?? '1G'
const androidBundleId =
  process.env.HARNESS_ANDROID_BUNDLE_ID ??
  'com.margelo.nitro.camera.example.simple'
const androidPhysicalManufacturer =
  process.env.HARNESS_ANDROID_DEVICE_MANUFACTURER ?? 'Pixel'
const androidPhysicalModel = process.env.HARNESS_ANDROID_DEVICE_MODEL ?? 'Pro 7'
const androidDeviceMode =
  process.env.HARNESS_ANDROID_DEVICE_MODE?.trim().toLowerCase() ?? 'physical'

const iosBundleId =
  process.env.HARNESS_IOS_BUNDLE_ID ?? 'com.margelo.nitro.camera.example.simple'
const iosSimulatorName = process.env.HARNESS_IOS_SIMULATOR ?? 'iPhone 16 Pro'
const iosSimulatorVersion = process.env.HARNESS_IOS_SIMULATOR_VERSION ?? '18.5'
const iosPhysicalDeviceIdentifier =
  process.env.HARNESS_IOS_DEVICE_ID?.trim() || 'iPhone'
const iosMetroHostInput = process.env.HARNESS_IOS_METRO_HOST?.trim() ?? ''
const iosMetroPort = process.env.HARNESS_IOS_METRO_PORT ?? '8081'

const formatIosMetroHostPort = (input, port) => {
  if (input === '') {
    return ''
  }

  const bracketedIpv6Match = input.match(/^\[([^\]]+)\](?::(\d+))?$/)
  if (bracketedIpv6Match != null) {
    const [, host, explicitPort] = bracketedIpv6Match
    return explicitPort == null ? `[${host}]:${port}` : input
  }

  const colonCount = [...input].filter((char) => char === ':').length
  if (colonCount > 1) {
    return `[${input}]:${port}`
  }

  return input.includes(':') ? input : `${input}:${port}`
}

const iosMetroHostPort = formatIosMetroHostPort(iosMetroHostInput, iosMetroPort)
const metroBindHost = process.env.HARNESS_METRO_BIND_HOST?.trim() ?? ''
const iosAppLaunchOptions = iosMetroHostPort
  ? {
      arguments: [
        '-RCT_jsLocation',
        iosMetroHostPort,
        '-RCT_packager_scheme',
        'http',
      ],
    }
  : undefined

const isCI = process.env.CI === 'true'
const bundleStartTimeout = isCI ? 90_000 : 15_000
const bridgeTimeout = isCI ? 120_000 : 45_000
const maxAppRestarts = isCI ? 4 : 2

const useEmulator = androidDeviceMode === 'emulator'

const androidDevice = useEmulator
  ? androidEmulator(androidEmulatorName, {
      apiLevel: androidApiLevel,
      profile: androidDeviceProfile,
      diskSize: androidDiskSize,
      heapSize: androidHeapSize,
    })
  : physicalAndroidDevice(androidPhysicalManufacturer, androidPhysicalModel)

const iosDevice = isCI
  ? applePhysicalDevice(iosPhysicalDeviceIdentifier, {
      codeSign: {
        teamId: 'TheTeamHereDoesntMatterOnCiButWeHaveToPassItStillIthink',
      },
    })
  : appleSimulator(iosSimulatorName, iosSimulatorVersion)

const config = {
  entryPoint: './index.js',
  appRegistryComponentName: 'SimpleCamera',
  host: metroBindHost === '' ? undefined : metroBindHost,
  runners: [
    androidPlatform({
      name: 'android',
      device: androidDevice,
      bundleId: androidBundleId,
    }),
    applePlatform({
      name: 'ios',
      device: iosDevice,
      bundleId: iosBundleId,
      appLaunchOptions: iosAppLaunchOptions,
    }),
  ],
  defaultRunner: 'android',
  bridgeTimeout,
  bundleStartTimeout,
  maxAppRestarts,
  detectNativeCrashes: true,
  resetEnvironmentBetweenTestFiles: true,
  forwardClientLogs: true,
  permissions: true,
}

export default config

```

### Core Architecture Module: `apps/simple-camera/src/App.tsx`
```
import {
  createStaticNavigation,
  type StaticParamList,
} from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { VisionCamera } from 'react-native-vision-camera'
import { CameraScreen } from './screens/CameraScreen'
import { PermissionsScreen } from './screens/PermissionsScreen'
import { PhotoScreen } from './screens/PhotoScreen'
import { VideoScreen } from './screens/VideoScreen'

const RootStack = createNativeStackNavigator({
  initialRouteName:
    VisionCamera.cameraPermissionStatus === 'authorized'
      ? 'Camera'
      : 'Permissions',
  screens: {
    Permissions: PermissionsScreen,
    Camera: {
      screen: CameraScreen,
      options: {
        orientation: 'portrait_up',
      },
    },
    Photo: {
      screen: PhotoScreen,
      options: {
        animation: 'none',
        presentation: 'transparentModal',
      },
    },
    Video: {
      screen: VideoScreen,
      options: {
        animation: 'none',
        presentation: 'transparentModal',
      },
    },
  },
  screenOptions: {
    navigationBarHidden: true,
    headerShown: false,
    contentStyle: {
      backgroundColor: 'black',
    },
  },
})

type RootStackParamList = StaticParamList<typeof RootStack>

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

const Navigation = createStaticNavigation(RootStack)

function App() {
  return (
    <GestureHandlerRootView>
      <Navigation />
    </GestureHandlerRootView>
  )
}

export default App

```

### Core Architecture Module: `apps/simple-camera/src/components/BlurContainer.tsx`
```
import { BlurView } from '@react-native-community/blur'
import type React from 'react'
import { Platform, StyleSheet, View, type ViewProps } from 'react-native'

export interface BlurContainerProps extends ViewProps {
  tint?: 'dark' | 'light'
}

export function BlurContainer({
  tint = 'dark',
  style,
  children,
  ...props
}: BlurContainerProps): React.ReactElement {
  if (Platform.OS === 'ios') {
    return (
      <View style={style} {...props}>
        <BlurView
          style={StyleSheet.absoluteFill}
          blurRadius={15}
          blurAmount={15}
          blurType={tint}
        />
        {children}
      </View>
    )
  } else {
    const bgStyle = tint === 'dark' ? styles.dark : styles.light
    return (
      <View style={[bgStyle, style]} {...props}>
        {children}
      </View>
    )
  }
}

const styles = StyleSheet.create({
  dark: {
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  light: {
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
})

```

### Core Architecture Module: `apps/simple-camera/src/components/CameraSelectorButton.tsx`
```
import {
  type MenuAction,
  MenuView,
  type NativeActionEvent,
} from '@react-native-menu/menu'
import type React from 'react'
import { useCallback, useMemo } from 'react'
import { Animated } from 'react-native'
import type { CameraDevice, CameraPosition } from 'react-native-vision-camera'
import { IconButton } from './IconButton'

interface Props {
  devices: CameraDevice[]
  setDevice: (device: CameraDevice) => void
  uiRotation: Animated.Value
}

export function CameraSelectorButton({
  devices,
  setDevice,
  uiRotation,
}: Props): React.ReactElement {
  const menuActions = useMemo<MenuAction[]>(() => {
    const positions = ['back', 'front', 'external'].filter<CameraPosition>(
      (p): p is CameraPosition => devices.some((d) => d.position === p),
    )
    return positions.map((pos) => {
      const devicesAtPosition = devices.filter((d) => d.position === pos)
      return {
        title: pos,
        preferredElementSize: 'small',
        displayInline: true,
        subactions: devicesAtPosition.map((d) => {
          return {
            id: d.id,
            subtitle: d.mediaTypes.join(' + '),
            title: d.localizedName,
          }
        }),
      }
    })
  }, [devices])

  const onMenuItemPressed = useCallback(
    (event: NativeActionEvent) => {
      const cameraId = event.nativeEvent.event
      const targetDevice = devices.find((d) => d.id === cameraId)
      if (targetDevice != null) {
        setDevice(targetDevice)
      }
    },
    [devices, setDevice],
  )

  const rotate = uiRotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <MenuView actions={menuActions} onPressAction={onMenuItemPressed}>
      <Animated.View
        style={{
          transform: [
            {
              rotate: rotate,
            },
          ],
        }}
      >
        <IconButton iconName="camera" onPress={() => {}} />
      </Animated.View>
    </MenuView>
  )
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4176** (2026-08-29): **chore: Update links for the move to the margelo org**
  *Symptoms*: VisionCamera moved from `mrousavy/react-native-vision-camera` to `margelo/react-native-vision-camera`. GitHub keeps the old paths redirecting, so nothing is broken today, but the metadata should point at the canonical repo.  ## What changed  | Area | Change | | --- | --- | | `packages/*/package.json` (6) | `repository.url` + `bugs.url` -> margelo | | `docs/src/lib/site-config.ts` | `repositoryUrl` -> margelo. This one feeds the "Edit on GitHub" links on every docs page and the `codeRepository`/`sameAs` fields in the JSON-LD, so it was the highest-leverage single line | | `.github/ISSUE_TEMPLATE/*.yml` (4) | Repro instructions, releases links, issue-search links | | `apps/simple-camera/__tests__/*` (2) | Issue/PR links in regression-test comments | | `packages/*/*.podspec` (5) | `s.source` pointed at `github.com/mrousavy/nitro.git` - a copy-paste leftover from the nitro podspec template. Now points at this repo | | docs + `packages/react-native-vision-camera/README.md` | Nitro links, since `mrousavy/nitro` also moved to `margelo/nitro` | | `ViewGroup+installHierarchyFitter.kt` | Declared `package com.mrousavy.camera.react.extensions` while sitting in `com/margelo/nitro/camera/extensions/`. Renamed to match the directory, and updated the one import in `HybridPreviewView.kt` |  ## Deliberately left alone  - `github.com/mrousavy/react-native-nitro-image` and `github.com/mrousavy/react-native-data-scanner` - both verified still under `mrousavy` via the GitHub API. - `nitrogen/gene
  **Post-Mortem & Fix Analysis**:
  > [vc]: #V7dUrHvYDTMbjT4i6SLnXUO8fbv9DQZzUMQyPaHp1Ic=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzIiwicHJvamVjdElkIjoicHJqX1JJb09mcEZmTkl5ZTI0WWRlV1JUOWloV2xubHoiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbWFyZ2Vsby9yZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzL2hGN1V1ZDIxZTY1VmI2SGlKVnRRSG56Y3JycWgiLCJwcmV2aWV3VXJsIjoicmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEtZG9jcy1naXQtY2hvcmUtbWlncmF0LTI3ZWRiNS1tYXJnZWxvLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoicmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEtZG9jcy1naXQtY2hvcmUtbWlncmF0LTI3ZWRiNS1tYXJnZWxvLnZlcmNlbC5hcHAifSwicm9vdERpcmVjdG9yeSI6ImRvY3MifV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPW1hcmdlbG8mcmVwbz1yZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYSZwcj00MTc2In0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://v

- **Issue #4175** (2026-08-29): **fix: align iOS frame coordinates with camera sensor**
  *Symptoms*: ## Summary\n\n- align iOS Frame and Depth coordinate conversion with the unrotated AVFoundation sensor space used by PreviewView\n- retain absolute buffer orientation and mirroring separately from the existing public output-relative metadata\n- preserve the legacy transform for Photo depth data, where no AVCaptureConnection is available\n\nThe regression test was already merged in #4113 and is red on main for iOS while Android passes.\n\n## Verification\n\n- bun camera typecheck\n- swift format lint on all six changed Swift files (exit 0; two pre-existing warnings)\n- xcodebuild -project Pods/Pods.xcodeproj -scheme VisionCamera -sdk iphonesimulator -destination generic/platform=iOS Simulator (arm64 and x86_64)\n- git diff --check\n- affine proof for all four buffer orientations, mirrored and unmirrored, including inverse round-trips\n\nThe full SimpleCamera build is not available locally because the installed Xcode lacks the optional Metal Toolchain required by the unrelated VisionCameraResizer shader target. The existing AWS Device Farm coordinate harness remains the end-to-end oracle for this PR.\n\nFixes #4114
  **Post-Mortem & Fix Analysis**:
  > @huytdps13400 is attempting to deploy a commit to the **Margelo** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=Margelo&slug=margelo&teamId=team_NDNToN8DidHGkAb1NjLet2gV&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%228d4b1c2922e762c5dfbe30617a8098187676e24c%22%7D%2C%22id%22%3A%22QmZBmNciQq8MAkbbwTGLfYxU3HL8d7NXQD3URrXWyjdSsS%22%2C%22org%22%3A%22mrousavy%22%2C%22prId%22%3A4175%2C%22repo%22%3A%22react-native-vision-camera%22%7D).  
  > Reworked in #4177.  The fixed `.left` sensor-orientation assumption and the unnecessary converter rewrite from this PR are removed. The replacement reads each delivered buffer's actual `AVCaptureConnection.videoRotationAngle` on iOS 17+, keeps the existing fallback on older targets, and leaves public `Frame.orientation` / `isMirrored` semantics unchanged.  The replacement is limited to six iOS files. The existing converter is reused without modification. Local verification covers the old 3.16049 anisotropy versus the corrected 1.0 composition, the device-specific 180° default, typecheck, Swift formatting, and the VisionCamera simulator pod build for arm64/x86_64. 

- **Issue #4173** (2026-08-26): **feat: Add native tap-to-focus reset listener**
  *Symptoms*: ## Summary  - add `addOnFocusResetListener` to the native tap-to-focus gesture controller - emit after `MeteringTask` successfully performs its automatic reset on iOS - explicitly schedule and await CameraX focus cancellation on Android so reset completion is observable - invalidate pending automatic resets when a newer focus or manual reset supersedes the gesture  This PR is stacked on #4172. It intentionally reports automatic resets from native tap-to-focus gestures only; failed or superseded resets do not emit.  ## Test plan  - `bun camera specs` - `bun run lint-all` - `bun camera typecheck` - `bun camera build` - `./apps/simple-camera/android/gradlew -p apps/simple-camera/android :react-native-vision-camera:assembleDebug --no-daemon --console=plain` - `xcodebuild -workspace SimpleCamera.xcworkspace -scheme VisionCamera -sdk iphonesimulator -configuration Debug -destination 'generic/platform=iOS Simulator' -derivedDataPath build CODE_SIGNING_ALLOWED=NO build -quiet` 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #7/6mdcHwysvqPqKEN9b8gX3OP6a7MdLak0lkQ8bgutw=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzIiwicHJvamVjdElkIjoicHJqX1JJb09mcEZmTkl5ZTI0WWRlV1JUOWloV2xubHoiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbWFyZ2Vsby9yZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzLzRMTHBjZnlGS1VuNHkyam9yQ3JrUEFjZVpwMm0iLCJwcmV2aWV3VXJsIjoicmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEtZG9jcy1naXQtZmVhdC1uYXRpdmUtMjc3YWY3LW1hcmdlbG8udmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzLWdpdC1mZWF0LW5hdGl2ZS0yNzdhZjctbWFyZ2Vsby52ZXJjZWwuYXBwIn0sInJvb3REaXJlY3RvcnkiOiJkb2NzIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1tcm91c2F2eSZyZXBvPXJlYWN0LW5hdGl2ZS12aXNpb24tY2FtZXJhJnByPTQxNzMifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://v
  > Too overcomplicated. Let's just not have this feature now, the code got too complex to support this. We can ask the CameraX team to add a on focus reset event

- **Issue #4172** (2026-08-26): **feat: Add native tap-to-focus lifecycle listeners**
  *Symptoms*: ## Summary  - expose addOnTapListener(...) and addOnFocusCompletedListener(...) on TapToFocusGestureController - emit the native MeteringPoint immediately before focusing starts - emit focus completion after iOS MeteringTask or CameraX focus resolves - report Android tap coordinates in React Native logical units - leave focus-reset events out of this PR  ## Test plan  - bun camera specs - bun run lint-all - bun camera typecheck - bun camera build - ./apps/simple-camera/android/gradlew -p apps/simple-camera/android :react-native-vision-camera:assembleDebug --no-daemon --console=plain - bun example pods - xcodebuild -workspace SimpleCamera.xcworkspace -scheme VisionCamera -sdk iphonesimulator -configuration Debug -destination generic/platform=iOS\ Simulator -derivedDataPath build CODE_SIGNING_ALLOWED=NO build -quiet
  **Post-Mortem & Fix Analysis**:
  > [vc]: #uy96+3qdoCdfVbUDRz3vgaKZ0HtYGYXzQeTzEAMUMmI=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzIiwicHJvamVjdElkIjoicHJqX1JJb09mcEZmTkl5ZTI0WWRlV1JUOWloV2xubHoiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbWFyZ2Vsby9yZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzLzRpRFFOS3pCR0h2QUNQeXRrOVhZZ245a01WZUciLCJwcmV2aWV3VXJsIjoicmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEtZG9jcy1naXQtZmVhdC1uYXRpdmUtZDNkNzdmLW1hcmdlbG8udmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzLWdpdC1mZWF0LW5hdGl2ZS1kM2Q3N2YtbWFyZ2Vsby52ZXJjZWwuYXBwIn0sInJvb3REaXJlY3RvcnkiOiJkb2NzIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1tcm91c2F2eSZyZXBvPXJlYWN0LW5hdGl2ZS12aXNpb24tY2FtZXJhJnByPTQxNzIifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://v

- **Issue #4171** (2026-08-26): **feat: Add native zoom gesture change listener**
  *Symptoms*: ## Summary  - expose addOnZoomChangedListener(...) on ZoomGestureController - emit each clamped target zoom update from the native pinch recognizer on iOS and Android - regenerate the Nitro bindings for the new listener API  ## Test plan  - bun camera specs - bun run lint-all - bun camera typecheck - bun camera build - bun example build:android - xcodebuild -workspace SimpleCamera.xcworkspace -scheme VisionCamera -sdk iphonesimulator -configuration Debug -destination generic/platform=iOS\ Simulator -derivedDataPath build CODE_SIGNING_ALLOWED=NO build -quiet
  **Post-Mortem & Fix Analysis**:
  > [vc]: #toBVYc9z5ct7QpJip9CU7i+pDKV6CnbNArv/bfH6O8I=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzIiwicHJvamVjdElkIjoicHJqX1JJb09mcEZmTkl5ZTI0WWRlV1JUOWloV2xubHoiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbWFyZ2Vsby9yZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzLzR4eDJUb3RnUW11anFDNm4yaGs4RTZORlBXeHEiLCJwcmV2aWV3VXJsIjoicmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEtZG9jcy1naXQtZmVhdC1uYXRpdmUtNDZmMDBlLW1hcmdlbG8udmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzLWdpdC1mZWF0LW5hdGl2ZS00NmYwMGUtbWFyZ2Vsby52ZXJjZWwuYXBwIn0sInJvb3REaXJlY3RvcnkiOiJkb2NzIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1tcm91c2F2eSZyZXBvPXJlYWN0LW5hdGl2ZS12aXNpb24tY2FtZXJhJnByPTQxNzEifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://v

- **Issue #4170** (2026-08-23): **feat: expose metadata from capturePhotoToFile**
  *Symptoms*: ## Summary  - extend PhotoFile with width, height, orientation, mirroring, timestamp, RAW status, and container format - populate the same metadata on Android and iOS, with Android reading the saved file EXIF for its final dimensions and orientation - add focused Harness coverage that compares capturePhotoToFile metadata with an in-memory Photo  ## Validation  - bun camera specs - bun camera typecheck - bunx tsc -p apps/simple-camera/tsconfig.json --noEmit - bun lint-kotlin - bun lint-swift - bun lint-js (passes with 16 existing warnings) - bun example build:android - focused Android emulator Harness test (passes) - iOS SimpleCamera simulator xcodebuild (passes) - focused iOS Harness launch reached the app, but the simulator exposes no back camera, so the existing suite setup assertion stopped the test before execution
  **Post-Mortem & Fix Analysis**:
  > [vc]: #F8Rx6EKkGW7e9pp12aS8qi3IgUducQdln8lvJJL84D4=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzIiwicHJvamVjdElkIjoicHJqX1JJb09mcEZmTkl5ZTI0WWRlV1JUOWloV2xubHoiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbWFyZ2Vsby9yZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzL0E5VFpIOVFzaldMS1VySkFTOHVUbVBYS1JUNWoiLCJwcmV2aWV3VXJsIjoicmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEtZG9jcy1naXQtZmVhdC1waG90by1mLTRlMTkyMC1tYXJnZWxvLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoicmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEtZG9jcy1naXQtZmVhdC1waG90by1mLTRlMTkyMC1tYXJnZWxvLnZlcmNlbC5hcHAifSwicm9vdERpcmVjdG9yeSI6ImRvY3MifV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPW1yb3VzYXZ5JnJlcG89cmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEmcHI9NDE3MCJ9 The latest updates on your projects. Learn more about [Vercel for GitHub](https://v

- **Issue #4167** (2026-08-21): **fix: Deep-compare `constraints` instead of `JSON.stringify`-ing them**
  *Symptoms*: ## What  `useCameraController` kept the user's `constraints` stable by putting `JSON.stringify(constraints)` into the `useMemo` dependency array:  ```ts // biome-ignore lint/correctness/useExhaustiveDependencies: It's an array of objects, we either have to deep-memo or just stringify. const stableConstraints = useMemo<Constraint[]>(() => { ... }, [JSON.stringify(constraints), stableOutputs]) ```  That works for plain constraints like `{ fps: 60 }`, but it silently breaks for `{ resolutionBias: someOutput }`.  Nitro `HybridObject`s are created via `Object.create(prototype)` and hold every property on their shared prototype, so the JS object itself has **no own keys**. `JSON.stringify(...)` therefore serializes *every* `CameraOutput` to the same string:  | build | `JSON.stringify(photoOutput)` | |---|---| | release | `{}` | | debug | `{"__type":"HybridObject<CameraPhotoOutput>"}` |  Two different outputs of the same type are indistinguishable. So this, which is the documented way to express capture priority:  ```tsx constraints={photoFirst   ? [{ resolutionBias: photoOutput }, { resolutionBias: videoOutput }]   : [{ resolutionBias: videoOutput }, { resolutionBias: photoOutput }]} ```  is invisible to the memo in release builds, and the session is never re-configured.  ## How  Replaces the stringification with an explicit deep comparison (`useMemoizedConstraints(...)`) that compares object literals and arrays by value, and everything else (i.e. `HybridObject`s) by identity. It a
  **Post-Mortem & Fix Analysis**:
  > [vc]: #K/bwXp0beN6Hpwi5EqCMOVKeEGG6dPYqeQSIyDSf/UY=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzIiwicHJvamVjdElkIjoicHJqX1JJb09mcEZmTkl5ZTI0WWRlV1JUOWloV2xubHoiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbWFyZ2Vsby9yZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzLzlHTWRKYnVtSHBmQU4ySFFpb0g3VVVRTDRiZXciLCJwcmV2aWV3VXJsIjoicmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEtZG9jcy1naXQtZml4LW1lbW9pemUtODI5NGUxLW1hcmdlbG8udmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzLWdpdC1maXgtbWVtb2l6ZS04Mjk0ZTEtbWFyZ2Vsby52ZXJjZWwuYXBwIn0sInJvb3REaXJlY3RvcnkiOiJkb2NzIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1tcm91c2F2eSZyZXBvPXJlYWN0LW5hdGl2ZS12aXNpb24tY2FtZXJhJnByPTQxNjcifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://v

- **Issue #4166** (2026-08-21): **fix: Memoize `targetResolution` in output hooks**
  *Symptoms*: ## What  `targetResolution` (and `previewImageTargetSize`) are `Size` objects, and users almost always write them as inline object literals:  ```tsx const photoOutput = usePhotoOutput({   targetResolution: { width: 1920, height: 1080 }, }) ```  An inline literal gets a fresh identity on every render, so the `useMemo(...)` inside `usePhotoOutput` / `useVideoOutput` / `useFrameOutput` / `useDepthOutput` misses its cache and creates a **brand new `CameraOutput` on every render**.  That isn't just wasteful, it self-perpetuates:  1. New output -> the `outputs` array changes 2. -> `useCameraController`'s effect re-runs and re-configures the `CameraSession` 3. -> `setController(...)` -> re-render 4. -> back to 1.  The session ends up in an endless reconfigure loop and takes the app down within seconds.  ## How  Adds an internal `useMemoizedSize(...)` hook that memoizes a `Size` by its `width`/`height` values instead of by object identity, and uses it in all four output hooks. Outputs are now only re-created when the requested resolution actually changes.  This also covers `<SkiaCamera targetResolution={...} />`, which forwards straight into `useFrameOutput(...)`.  ## Test  Adds a Harness test in `visioncamera.hooks.harness.tsx` that:  - renders a component whose `targetResolution`s are inline object literals, - re-renders it three times with the same values, asserting the `CameraPhotoOutput` / `CameraVideoOutput` keep their identity and that `onConfigured` fired exactly **once**, - 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #qyvPXoM752Fx337+w9f5C9/4Mxh66gWcfyPAnswkqgs=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzIiwicHJvamVjdElkIjoicHJqX1JJb09mcEZmTkl5ZTI0WWRlV1JUOWloV2xubHoiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbWFyZ2Vsby9yZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzLzdQaG5KdlRucXlZUE1IMVBEMm44Ym1pM3hmemgiLCJwcmV2aWV3VXJsIjoicmVhY3QtbmF0aXZlLXZpc2lvbi1jYW1lcmEtZG9jcy1naXQtZml4LW1lbW9pemUtMjg2MTI0LW1hcmdlbG8udmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyZWFjdC1uYXRpdmUtdmlzaW9uLWNhbWVyYS1kb2NzLWdpdC1maXgtbWVtb2l6ZS0yODYxMjQtbWFyZ2Vsby52ZXJjZWwuYXBwIn0sInJvb3REaXJlY3RvcnkiOiJkb2NzIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1tcm91c2F2eSZyZXBvPXJlYWN0LW5hdGl2ZS12aXNpb24tY2FtZXJhJnByPTQxNjYifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://v

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

### Incident Patch 1: `8015396b` (2026-08-21)
**Commit Message**: fix: Deep-compare `constraints` instead of `JSON.stringify`-ing them (#4167)

`useCameraController` kept the user's `constraints` stable by putting
`JSON.stringify(constraints)` into the `useMemo` dependency array. That
works for plain constraints like `{ fps: 60 }`, but it silently breaks for
`{ resolutionBias: someOutput }`.

Nitro `HybridObject`s are created via `Object.create(prototype)` and hold
every property on their shared prototype, so the JS object itself has no own
keys. `JSON.stringify(...)` therefore serializes *every* `CameraOutput` to
`{}` (release) or `{"__type":"HybridObject<CameraPhotoOutput>"}` (debug) -
two different outputs of the same type produce the exact same string. Any
change that only re-points a `resolutionBias` at a different output is
invisible to the memo, and the session is never re-configured.

Replace the stringification with an explicit deep comparison that compares
object literals and arrays by value and everything else (i.e. `HybridObject`s)
by identity. That also drops a full JSON serialization from every render.

Also adds two Harness tests: one that re-renders with an inline `constraints`
array and asserts the session is configured exactly o

**File**: `apps/simple-camera/__tests__/visioncamera.hooks.harness.tsx` (modified, +174/-0)
```diff
@@ -469,4 +469,178 @@ describe('VisionCamera - Hooks', () => {
 
     expect(onError).not.toHaveBeenCalled()
   })
+
+  it('does not re-configure the session when constraints are passed as an inline array', async () => {
+    const onConfigured = fn<() => void>()
+    const onError = fn<(error: Error) => void>()
+    const onRendered = fn<(renderIndex: number) => void>()
+
+    function TestCamera({
+      renderIndex,
+      fps,
+    }: {
+      renderIndex: number
+      fps: number
+    }): null {
+      // CameraX requires at least one use case when configuring a session.
+      const previewOutput = usePreviewOutput()
+      useCamera({
+        isActive: false,
+        device: 'back',
+        outputs: [previewOutput],
+        // An inline array of inline object literals, so `constraints` has a
+        // fresh identity on every single render even though its values never
+        // change. It must not re-configure the session.
+        constraints: [{ fps: fps }],
+        onConfigured,
+        onError,
+      })
+
+      useEffect(() => {
+        onRendered(renderIndex)
+      }, [renderIndex])
+
+      return null
+    }
+
+    const waitForRender = async (renderIndex: number): Promise<void> => {
+      await waitFor(
+        () => {
+          const error = onError.mock.lastCall?.[0]
+          if (error != null) throw error
+          expect(onRendered).toHaveBeenLastCalledWith(renderIndex)
+        },
+        { timeout: 10_000 },
+      )
+    }
+
+    const { rerender } = await render(<TestCamera renderIndex={0} fps={30} />, {
+      timeout: 10_000,
+    })
+    await waitForRender(0)
+    await waitFor(
+      () => {
+        const error = onError.mock.lastCall?.[0]
+        if (error != null) throw error
+        expect(onConfigured).toHaveBeenCalledTimes(1)
+      },
+      { timeout: 15_000 },
+    )
+
+    // Re-rendering with the same constraint values must not re-configure.
+    for (const renderIndex of [1, 2, 3]) {
+      await rerender(<TestCamera renderIndex={renderIndex} fps={30} />)
+      await waitForRender(renderIndex)
+      expect(onConfigured).toHaveBeenCalledTimes(1)
+    }
+
+    // Changing the actual constraint values must re-configure exactly once more.
+    await rerender(<TestCamera renderIndex={4} fps={24} />)
+    await waitForRender(4)
+    await waitFor(
+      () => {
+        const error = onError.mock.lastCall?.[0]
+        if (error != null) throw error
+        expect(onConfigured).toHaveBeenCalledTimes(2)
+      },
+      { timeout: 15_000 },
+    )
+
+    expect(onError).not.toHaveBeenCalled()
+  })
+
+  it('re-configures the session when a resolutionBias constraint points at a different output', async () => {
+    // Two outputs of the same HybridObject type. They are only used as
+    // resolution hints, so the attached `outputs` stay identical across every
+    // re-render and the `constraints` are the only thing that changes.
+    const lowResolutionBias = VisionCamera.createPhotoOutput({
+      targetResolution: CommonResolutions.VGA_4_3,
+      containerFormat: 'jpeg',
+      quality: 0.8,
+      qualityPrioritization: 'balanced',
+    })
+    const highResolutionBias = VisionCamera.createPhotoOutput({
+      targetResolution: CommonResolutions.UHD_4_3,
+      containerFormat: 'jpeg',
+      quality: 0.8,
+      qualityPrioritization: 'balanced',
+    })
+    const onConfigured = fn<() => void>()
+    const onError = fn<(error: Error) => void>()
+    const onRendered = fn<(renderIndex: number) => void>()
+
+    function TestCamera({
+      renderIndex,
+      resolutionBias,
+    }: {
+      renderIndex: number
+      resolutionBias: CameraPhotoOutput
+    }): null {
+      // CameraX requires at least one use case when configuring a session.
+      const previewOutput = usePreviewOutput()
+      useCamera({
+        isActive: false,
+        device: 'back',
+        outputs: [previewOutput],
+        constraints: [{ resolutionBias: resolutionBias }],
+       
```

**File**: `packages/react-native-vision-camera/src/hooks/internal/useCameraController.ts` (modified, +4/-4)
```diff
@@ -9,6 +9,7 @@ import type { CameraSession } from '../../specs/session/CameraSession.nitro'
 import type { CameraSessionConfig } from '../../specs/session/CameraSessionConfig.nitro'
 import type { CameraSessionConfiguration } from '../../specs/session/CameraSessionConfiguration'
 import { useMemoizedArray } from './useMemoizedArray'
+import { useMemoizedConstraints } from './useMemoizedConstraints'
 import { useStableCallback } from './useStableCallback'
 
 interface Config extends CameraSessionConfiguration {
@@ -61,14 +62,13 @@ export function useCameraController(
   )
   const stableOnError = useStableCallback(onError)
 
-  // TODO: Can we use something like useSyncExternalStore or whatever to avoid "wrong" dependencies?
-  // biome-ignore lint/correctness/useExhaustiveDependencies: It's an array of objects, we either have to deep-memo or just stringify.
+  const stableUserConstraints = useMemoizedConstraints(constraints)
   const stableConstraints = useMemo<Constraint[]>(() => {
     return [
-      ...constraints,
+      ...stableUserConstraints,
       ...stableOutputs.map<Constraint>((o) => ({ resolutionBias: o })),
     ]
-  }, [JSON.stringify(constraints), stableOutputs])
+  }, [stableUserConstraints, stableOutputs])
 
   // This effect re-configures the CameraSession and returns a `controller`.
   // This is expensive and should only be done if any inputs change.
```

**File**: `packages/react-native-vision-camera/src/hooks/internal/useMemoizedConstraints.ts` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+import { useRef } from 'react'
+import type {
+  Constraint,
+  ResolutionBiasConstraint,
+} from '../../specs/common-types/Constraint'
+import type { CameraOutput } from '../../specs/outputs/CameraOutput.nitro'
+import type { CameraSession } from '../../specs/session/CameraSession.nitro'
+
+/**
+ * Returns whether the given {@linkcode value} is a plain JS object
+ * (i.e. an object literal like `{ fps: 60 }`), and not a class instance,
+ * an `Array`, or a Nitro `HybridObject`.
+ */
+function isPlainObject(value: unknown): value is Record<string, unknown> {
+  if (typeof value !== 'object' || value === null) return false
+  const prototype = Object.getPrototypeOf(value)
+  return prototype === Object.prototype || prototype === null
+}
+
+/**
+ * Deep-compares two {@linkcode Constraint} values.
+ *
+ * Object literals (e.g. `{ fps: 60 }`, or a `TargetDynamicRange`) and
+ * `Array`s are compared by value, everything else - most importantly the
+ * {@linkcode CameraOutput} of a {@linkcode ResolutionBiasConstraint} - is
+ * compared by identity.
+ *
+ * Nitro `HybridObject`s cannot be compared by value at all; they are created
+ * via `Object.create(prototype)` and hold every property on their shared
+ * prototype, so the actual JS object has no own keys (which is also why
+ * `JSON.stringify(...)` serializes every `CameraOutput` to the exact same
+ * string).
+ */
+function isEqual(left: unknown, right: unknown): boolean {
+  if (Object.is(left, right)) return true
+
+  if (Array.isArray(left) || Array.isArray(right)) {
+    if (!Array.isArray(left) || !Array.isArray(right)) return false
+    if (left.length !== right.length) return false
+    return left.every((item, index) => isEqual(item, right[index]))
+  }
+
+  if (!isPlainObject(left) || !isPlainObject(right)) return false
+  const leftKeys = Object.keys(left)
+  const rightKeys = Object.keys(right)
+  if (leftKeys.length !== rightKeys.length) return false
+  return leftKeys.every((key) => key in right && isEqual(left[key], right[key]))
+}
+
+/**
+ * Memoizes the given {@linkcode Constraint}s by value instead of by identity.
+ *
+ * {@linkcode Constraint}s are usually written as an inline array of object
+ * literals (e.g. `constraints={[{ fps: 60 }]}`), which allocates a new array
+ * and new objects on every render. Using those as a `useEffect` dependency
+ * would re-configure the {@linkcode CameraSession} on every single render,
+ * which renders again, and so on.
+ */
+export function useMemoizedConstraints(
+  constraints: Constraint[],
+): Constraint[] {
+  const memoized = useRef(constraints)
+  if (!isEqual(memoized.current, constraints)) {
+    memoized.current = constraints
+  }
+  return memoized.current
+}
```

---

### Incident Patch 2: `2ae908ab` (2026-08-21)
**Commit Message**: fix: Memoize `targetResolution` in output hooks (#4166)

`targetResolution` (and `previewImageTargetSize`) are `Size` objects that
users almost always pass as inline object literals:

```tsx
const photoOutput = usePhotoOutput({
  targetResolution: { width: 1920, height: 1080 },
})
```

Those literals get a fresh identity on every render, so the `useMemo(...)`
inside `usePhotoOutput` / `useVideoOutput` / `useFrameOutput` /
`useDepthOutput` misses its cache and creates a brand new `CameraOutput`
every time.

That is not just wasteful, it self-perpetuates: a new output changes the
`outputs` array, which re-runs the `useCameraController` effect, which
re-configures the `CameraSession`, which calls `setController(...)`, which
renders again, which creates yet another output. The session ends up in an
endless reconfigure loop and takes the app down with it within seconds.

Memoize `Size` props by value (`width`/`height`) via a new
`useMemoizedSize(...)` internal hook so the outputs are only re-created
when the requested resolution actually changes.

Also adds a Harness test that re-renders a component with inline
`targetResolution` literals and asserts that the outputs keep their
identity

**File**: `apps/simple-camera/__tests__/visioncamera.hooks.harness.tsx` (modified, +128/-0)
```diff
@@ -19,16 +19,21 @@ import type {
   CameraDevice,
   CameraDeviceFactory,
   CameraOrientation,
+  CameraPhotoOutput,
   CameraPosition,
+  CameraVideoOutput,
   DeviceFilter,
   TargetCameraPosition,
 } from 'react-native-vision-camera'
 import {
+  CommonResolutions,
   getUIRotation,
   useCamera,
   useCameraDevice,
   useOrientation,
+  usePhotoOutput,
   usePreviewOutput,
+  useVideoOutput,
   VisionCamera,
 } from 'react-native-vision-camera'
 
@@ -341,4 +346,127 @@ describe('VisionCamera - Hooks', () => {
 
     expect(onError).not.toHaveBeenCalled()
   })
+
+  it('keeps outputs stable when targetResolution is passed as an inline object literal', async () => {
+    const onConfigured = fn<() => void>()
+    const onError = fn<(error: Error) => void>()
+    const onRendered =
+      fn<
+        (
+          renderIndex: number,
+          photoOutput: CameraPhotoOutput,
+          videoOutput: CameraVideoOutput,
+        ) => void
+      >()
+
+    function TestCamera({
+      renderIndex,
+      width,
+      height,
+    }: {
+      renderIndex: number
+      width: number
+      height: number
+    }): null {
+      // CameraX requires at least one use case when configuring a session.
+      const previewOutput = usePreviewOutput()
+      // Both `targetResolution`s are inline object literals, so they have a
+      // fresh identity on every single render even though their values never
+      // change. They must not re-create the outputs.
+      const photoOutput = usePhotoOutput({
+        targetResolution: { width: width, height: height },
+      })
+      const videoOutput = useVideoOutput({
+        targetResolution: { width: width, height: height },
+        enableAudio: false,
+      })
+      useCamera({
+        isActive: false,
+        device: 'back',
+        outputs: [previewOutput, photoOutput, videoOutput],
+        onConfigured,
+        onError,
+      })
+
+      useEffect(() => {
+        onRendered(renderIndex, photoOutput, videoOutput)
+      }, [renderIndex, photoOutput, videoOutput])
+
+      return null
+    }
+
+    const waitForRender = async (renderIndex: number): Promise<void> => {
+      await waitFor(
+        () => {
+          const error = onError.mock.lastCall?.[0]
+          if (error != null) throw error
+          expect(onRendered.mock.lastCall?.[0]).toBe(renderIndex)
+        },
+        { timeout: 10_000 },
+      )
+    }
+
+    const stableResolution = CommonResolutions.HD_4_3
+    const changedResolution = CommonResolutions.VGA_4_3
+
+    const { rerender } = await render(
+      <TestCamera
+        renderIndex={0}
+        width={stableResolution.width}
+        height={stableResolution.height}
+      />,
+      { timeout: 10_000 },
+    )
+    await waitForRender(0)
+    await waitFor(
+      () => {
+        const error = onError.mock.lastCall?.[0]
+        if (error != null) throw error
+        expect(onConfigured).toHaveBeenCalledTimes(1)
+      },
+      { timeout: 15_000 },
+    )
+
+    const initialPhotoOutput = onRendered.mock.lastCall?.[1]
+    const initialVideoOutput = onRendered.mock.lastCall?.[2]
+    expect(initialPhotoOutput).toBeDefined()
+    expect(initialVideoOutput).toBeDefined()
+
+    // Re-rendering with the same resolution values must reuse the same outputs.
+    for (const renderIndex of [1, 2, 3]) {
+      await rerender(
+        <TestCamera
+          renderIndex={renderIndex}
+          width={stableResolution.width}
+          height={stableResolution.height}
+        />,
+      )
+      await waitForRender(renderIndex)
+      expect(onRendered.mock.lastCall?.[1]).toBe(initialPhotoOutput)
+      expect(onRendered.mock.lastCall?.[2]).toBe(initialVideoOutput)
+    }
+
+    // Changing the actual resolution values must re-create the outputs and
+    // re-configure the session exactly once more.
+    await rerender(
+      <TestCamera
+        renderIndex={4}
+        width={changedResolution.width}
+        height={changedResolution.height}

```

**File**: `packages/react-native-vision-camera/src/hooks/internal/useMemoizedSize.ts` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+import { useMemo } from 'react'
+import type { Size } from '../../specs/common-types/Size'
+import type { CameraOutput } from '../../specs/outputs/CameraOutput.nitro'
+import type { CameraSession } from '../../specs/session/CameraSession.nitro'
+
+/**
+ * Memoizes the given {@linkcode Size} by value instead of by identity.
+ *
+ * {@linkcode Size}s are usually written as inline object literals
+ * (e.g. `useVideoOutput({ targetResolution: { width: 1920, height: 1080 } })`),
+ * which allocates a new object on every render. Using such a {@linkcode Size}
+ * as a `useMemo` dependency would re-create the {@linkcode CameraOutput} on
+ * every render, and re-creating an output re-configures the
+ * {@linkcode CameraSession} - which renders again, which re-creates the
+ * output again, and so on.
+ */
+export function useMemoizedSize(size: Size): Size
+export function useMemoizedSize(size: Size | undefined): Size | undefined
+export function useMemoizedSize(size: Size | undefined): Size | undefined {
+  const width = size?.width
+  const height = size?.height
+
+  return useMemo(() => {
+    if (width == null || height == null) return undefined
+    return { width: width, height: height }
+  }, [width, height])
+}
```

**File**: `packages/react-native-vision-camera/src/hooks/useDepthOutput.ts` (modified, +11/-7)
```diff
@@ -8,6 +8,7 @@ import type {
 import { VisionCameraWorkletsProxy } from '../third-party/VisionCameraWorkletsProxy'
 import { CommonResolutions } from '../utils/CommonResolutions'
 import { VisionCamera } from '../VisionCamera'
+import { useMemoizedSize } from './internal/useMemoizedSize'
 
 type BaseDepthOptions = Pick<
   DepthFrameOutputOptions,
@@ -75,25 +76,28 @@ export function useDepthOutput({
   dropFramesWhileBusy = true,
   allowDeferredStart = true,
 }: UseDepthOutputProps): CameraDepthFrameOutput {
-  // 1. Create depth output
+  // 1. `targetResolution` is usually an inline object literal - memoize it by value.
+  const memoizedTargetResolution = useMemoizedSize(targetResolution)
+
+  // 2. Create depth output
   const depthOutput = useMemo(
     () =>
       VisionCamera.createDepthFrameOutput({
-        targetResolution: targetResolution,
+        targetResolution: memoizedTargetResolution,
         enableFiltering: enableFiltering,
         enablePhysicalBufferRotation: false,
         dropFramesWhileBusy: dropFramesWhileBusy,
         allowDeferredStart: allowDeferredStart,
       }),
     [
-      targetResolution,
+      memoizedTargetResolution,
       enableFiltering,
       dropFramesWhileBusy,
       allowDeferredStart,
     ],
   )
 
-  // 2. Add Frame dropped warner
+  // 3. Add Frame dropped warner
   const onDepthFrameDroppedRef = useRef(onDepthFrameDropped)
   onDepthFrameDroppedRef.current = onDepthFrameDropped
   useEffect(() => {
@@ -104,16 +108,16 @@ export function useDepthOutput({
     })
   }, [depthOutput])
 
-  // 3. Create Worklet Runtime for NativeThread
+  // 4. Create Worklet Runtime for NativeThread
   const runtime = useMemo(
     () => VisionCameraWorkletsProxy.createRuntimeForThread(depthOutput.thread),
     [depthOutput.thread],
   )
-  // 4. Update onDepth() callback if it changed
+  // 5. Update onDepth() callback if it changed
   useEffect(() => {
     runtime.setOnDepthFrameCallback(depthOutput, onDepth)
   }, [runtime, depthOutput, onDepth])
 
-  // 5. Return :)
+  // 6. Return :)
   return depthOutput
 }
```

**File**: `packages/react-native-vision-camera/src/hooks/useFrameOutput.ts` (modified, +11/-7)
```diff
@@ -14,6 +14,7 @@ import type {
 import { VisionCameraWorkletsProxy } from '../third-party/VisionCameraWorkletsProxy'
 import { CommonResolutions } from '../utils/CommonResolutions'
 import { VisionCamera } from '../VisionCamera'
+import { useMemoizedSize } from './internal/useMemoizedSize'
 
 export interface UseFrameOutputProps extends Partial<FrameOutputOptions> {
   /**
@@ -129,11 +130,14 @@ export function useFrameOutput({
   onFrame,
   onFrameDropped,
 }: UseFrameOutputProps): CameraFrameOutput {
-  // 1. Create frame output
+  // 1. `targetResolution` is usually an inline object literal - memoize it by value.
+  const memoizedTargetResolution = useMemoizedSize(targetResolution)
+
+  // 2. Create frame output
   const frameOutput = useMemo(
     () =>
       VisionCamera.createFrameOutput({
-        targetResolution: targetResolution,
+        targetResolution: memoizedTargetResolution,
         pixelFormat: pixelFormat,
         enablePhysicalBufferRotation: enablePhysicalBufferRotation,
         enableCameraMatrixDelivery: enableCameraMatrixDelivery,
@@ -142,7 +146,7 @@ export function useFrameOutput({
         dropFramesWhileBusy: dropFramesWhileBusy,
       }),
     [
-      targetResolution,
+      memoizedTargetResolution,
       pixelFormat,
       dropFramesWhileBusy,
       enableCameraMatrixDelivery,
@@ -152,7 +156,7 @@ export function useFrameOutput({
     ],
   )
 
-  // 2. Add Frame dropped warner
+  // 3. Add Frame dropped warner
   const onFrameDroppedRef = useRef(onFrameDropped)
   onFrameDroppedRef.current = onFrameDropped
   useEffect(() => {
@@ -163,16 +167,16 @@ export function useFrameOutput({
     })
   }, [frameOutput])
 
-  // 3. Create Worklet Runtime for NativeThread
+  // 4. Create Worklet Runtime for NativeThread
   const runtime = useMemo(
     () => VisionCameraWorkletsProxy.createRuntimeForThread(frameOutput.thread),
     [frameOutput.thread],
   )
-  // 4. Update onFrame() callback if it changed
+  // 5. Update onFrame() callback if it changed
   useEffect(() => {
     runtime.setOnFrameCallback(frameOutput, onFrame)
   }, [runtime, frameOutput, onFrame])
 
-  // 5. Return :)
+  // 6. Return :)
   return frameOutput
 }
```

**File**: `packages/react-native-vision-camera/src/hooks/usePhotoOutput.ts` (modified, +10/-5)
```diff
@@ -7,6 +7,7 @@ import type {
 import { CommonResolutions } from '../utils/CommonResolutions'
 import { VisionCamera } from '../VisionCamera'
 import type { Camera } from '../views/Camera'
+import { useMemoizedSize } from './internal/useMemoizedSize'
 
 /**
  * Use a {@linkcode CameraPhotoOutput} for capturing {@linkcode Photo}s.
@@ -35,22 +36,26 @@ export function usePhotoOutput({
   qualityPrioritization = 'balanced',
   previewImageTargetSize = undefined,
 }: Partial<PhotoOutputOptions> = {}): CameraPhotoOutput {
-  // 1. Create photo output
+  // 1. `Size`s are usually inline object literals - memoize them by value.
+  const memoizedTargetResolution = useMemoizedSize(targetResolution)
+  const memoizedPreviewImageTargetSize = useMemoizedSize(previewImageTargetSize)
+
+  // 2. Create photo output
   const photoOutput = useMemo(
     () =>
       VisionCamera.createPhotoOutput({
-        targetResolution: targetResolution,
+        targetResolution: memoizedTargetResolution,
         containerFormat: containerFormat,
         quality: quality,
         qualityPrioritization: qualityPrioritization,
-        previewImageTargetSize: previewImageTargetSize,
+        previewImageTargetSize: memoizedPreviewImageTargetSize,
       }),
     [
-      targetResolution,
+      memoizedTargetResolution,
       containerFormat,
       quality,
       qualityPrioritization,
-      previewImageTargetSize,
+      memoizedPreviewImageTargetSize,
     ],
   )
 
```

---

### Incident Patch 3: `98aef293` (2026-08-20)
**Commit Message**: fix: Mark react-native-nitro-modules peer dependency as optional (#4165)

Semver ranges never match pre-releases, so a required peer of "*" does
not match e.g. 0.37.0-beta.0. Package managers then install a second,
stable copy of Nitro next to the pre-release, and the native/JS version
guard throws "Nitro was installed twice" at runtime.

Marking the peer optional leaves the consuming app in full control of
the installed Nitro version.

**File**: `bun.lock` (modified, +15/-0)
```diff
@@ -119,6 +119,9 @@
         "react-native-nitro-image": "*",
         "react-native-nitro-modules": "*",
       },
+      "optionalPeers": [
+        "react-native-nitro-modules",
+      ],
     },
     "packages/react-native-vision-camera-barcode-scanner": {
       "name": "react-native-vision-camera-barcode-scanner",
@@ -140,6 +143,9 @@
         "react-native-nitro-modules": "*",
         "react-native-vision-camera": "*",
       },
+      "optionalPeers": [
+        "react-native-nitro-modules",
+      ],
     },
     "packages/react-native-vision-camera-location": {
       "name": "react-native-vision-camera-location",
@@ -159,6 +165,9 @@
         "react-native-nitro-modules": "*",
         "react-native-vision-camera": "*",
       },
+      "optionalPeers": [
+        "react-native-nitro-modules",
+      ],
     },
     "packages/react-native-vision-camera-resizer": {
       "name": "react-native-vision-camera-resizer",
@@ -178,6 +187,9 @@
         "react-native-nitro-modules": "*",
         "react-native-vision-camera": "*",
       },
+      "optionalPeers": [
+        "react-native-nitro-modules",
+      ],
     },
     "packages/react-native-vision-camera-skia": {
       "name": "react-native-vision-camera-skia",
@@ -224,6 +236,9 @@
         "react-native-vision-camera": "*",
         "react-native-worklets": "*",
       },
+      "optionalPeers": [
+        "react-native-nitro-modules",
+      ],
     },
   },
   "trustedDependencies": [
```

**File**: `packages/react-native-vision-camera-barcode-scanner/package.json` (modified, +5/-0)
```diff
@@ -81,6 +81,11 @@
     "react-native-nitro-modules": "*",
     "react-native-vision-camera": "*"
   },
+  "peerDependenciesMeta": {
+    "react-native-nitro-modules": {
+      "optional": true
+    }
+  },
   "release-it": {
     "npm": {
       "publish": true
```

**File**: `packages/react-native-vision-camera-location/package.json` (modified, +5/-0)
```diff
@@ -78,6 +78,11 @@
     "react-native-nitro-modules": "*",
     "react-native-vision-camera": "*"
   },
+  "peerDependenciesMeta": {
+    "react-native-nitro-modules": {
+      "optional": true
+    }
+  },
   "release-it": {
     "npm": {
       "publish": true
```

**File**: `packages/react-native-vision-camera-resizer/package.json` (modified, +5/-0)
```diff
@@ -83,6 +83,11 @@
     "react-native-nitro-modules": "*",
     "react-native-vision-camera": "*"
   },
+  "peerDependenciesMeta": {
+    "react-native-nitro-modules": {
+      "optional": true
+    }
+  },
   "release-it": {
     "npm": {
       "publish": true
```

**File**: `packages/react-native-vision-camera-worklets/package.json` (modified, +5/-0)
```diff
@@ -81,6 +81,11 @@
     "react-native-vision-camera": "*",
     "react-native-worklets": "*"
   },
+  "peerDependenciesMeta": {
+    "react-native-nitro-modules": {
+      "optional": true
+    }
+  },
   "release-it": {
     "npm": {
       "publish": true
```

---

### Incident Patch 4: `425ce298` (2026-08-19)
**Commit Message**: fix: Migrate CameraX 1.7.0-alpha03 APIs (#4162)

fix: migrate CameraX alpha03 APIs

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/HybridCameraDeviceFactory.kt` (modified, +2/-2)
```diff
@@ -4,7 +4,6 @@ import android.content.Context
 import android.content.SharedPreferences
 import android.util.Log
 import androidx.annotation.OptIn
-import androidx.camera.camera2.adapter.CameraInfoAdapter.Companion.cameraId
 import androidx.camera.core.CameraIdentifier
 import androidx.camera.core.CameraPresenceListener
 import androidx.camera.core.CameraSelector
@@ -15,6 +14,7 @@ import androidx.camera.lifecycle.ProcessCameraProvider
 import androidx.core.content.edit
 import com.facebook.react.bridge.ReactApplicationContext
 import com.margelo.nitro.NitroModules
+import com.margelo.nitro.camera.extensions.cameraIdOrNull
 import com.margelo.nitro.camera.extensions.getDefaultCamera
 import com.margelo.nitro.camera.extensions.mapToArray
 import com.margelo.nitro.camera.hybrids.inputs.HybridCameraDevice
@@ -87,7 +87,7 @@ class HybridCameraDeviceFactory(
   override fun getCameraForId(id: String): HybridCameraDeviceSpec? {
     val cameraInfo =
       cameraProvider.availableCameraInfos.firstOrNull { cameraInfo ->
-        cameraInfo.cameraId?.value == id
+        cameraInfo.cameraIdOrNull == id
       }
     if (cameraInfo == null) {
       return null
```

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/extensions/Camera2CameraInfo+fromOrNull.kt` (removed, +0/-16)
```diff
@@ -1,16 +0,0 @@
-package com.margelo.nitro.camera.extensions
-
-import android.util.Log
-import androidx.annotation.OptIn
-import androidx.camera.camera2.interop.Camera2CameraInfo
-import androidx.camera.core.CameraInfo
-
-@OptIn(androidx.camera.camera2.interop.ExperimentalCamera2Interop::class)
-fun Camera2CameraInfo.Companion.fromSafe(cameraInfo: CameraInfo): Camera2CameraInfo? {
-  try {
-    return Camera2CameraInfo.from(cameraInfo)
-  } catch (e: Throwable) {
-    Log.w("VisionCamera", "Camera Device $cameraInfo is not a Camera2 device!")
-    return null
-  }
-}
```

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/extensions/Camera2CameraInfo+getOutputImageFormats.kt` (removed, +0/-12)
```diff
@@ -1,12 +0,0 @@
-package com.margelo.nitro.camera.extensions
-
-import android.hardware.camera2.CameraCharacteristics
-import androidx.annotation.OptIn
-import androidx.camera.camera2.interop.Camera2CameraInfo
-
-@OptIn(androidx.camera.camera2.interop.ExperimentalCamera2Interop::class)
-fun Camera2CameraInfo.getOutputImageFormats(): IntArray {
-  val streamMap = this.getCameraCharacteristic(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
-  if (streamMap == null) return intArrayOf()
-  return streamMap.outputFormats
-}
```

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/extensions/Camera2CameraInfo+getSupportedAperture.kt` (removed, +0/-20)
```diff
@@ -1,20 +0,0 @@
-package com.margelo.nitro.camera.extensions
-
-import android.hardware.camera2.CameraCharacteristics
-import androidx.annotation.OptIn
-import androidx.camera.camera2.interop.Camera2CameraInfo
-import com.margelo.nitro.camera.Range
-
-@OptIn(androidx.camera.camera2.interop.ExperimentalCamera2Interop::class)
-fun Camera2CameraInfo.getSupportedApertures(): FloatArray {
-  val apertures =
-    getCameraCharacteristic(CameraCharacteristics.LENS_INFO_AVAILABLE_APERTURES)
-      ?: return floatArrayOf()
-  return apertures
-}
-
-@OptIn(androidx.camera.camera2.interop.ExperimentalCamera2Interop::class)
-fun Camera2CameraInfo.getDefaultSimulatedAperture(): Double? {
-  val apertures = getSupportedApertures()
-  return apertures.firstOrNull()?.toDouble()
-}
```

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/extensions/CameraCharacteristics+getDepthSizes.kt` (renamed, +2/-5)
```diff
@@ -2,14 +2,11 @@ package com.margelo.nitro.camera.extensions
 
 import android.hardware.camera2.CameraCharacteristics
 import android.util.Size
-import androidx.annotation.OptIn
-import androidx.camera.camera2.interop.Camera2CameraInfo
 import com.margelo.nitro.camera.utils.ImageFormatUtils
 
-@OptIn(androidx.camera.camera2.interop.ExperimentalCamera2Interop::class)
-fun Camera2CameraInfo.getDepthSizes(): Array<Size> {
+fun CameraCharacteristics.getDepthSizes(): Array<Size> {
   val streams =
-    this.getCameraCharacteristic(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
+    this[CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP]
       ?: return emptyArray()
   val depthFormats = streams.outputFormats.filter { ImageFormatUtils.isDepthFormat(it) }
   val sizes = depthFormats.flatMap { streams.getOutputSizes(it).toListOrEmpty() }
```

---

### Incident Patch 5: `2cacb537` (2026-08-19)
**Commit Message**: fix: Use callback `setPreparedPhotoSettingsArray` overload to fix `EXC_BREAKPOINT` on cancel (#4161)

* fix: Use callback `setPreparedPhotoSettingsArray` overload to fix `EXC_BREAKPOINT` on cancel

* test it

* Update visioncamera.photo.harness.ts

* move into finally

**File**: `apps/simple-camera/__tests__/visioncamera.photo.harness.ts` (modified, +47/-0)
```diff
@@ -1,3 +1,4 @@
+import { Platform } from 'react-native'
 import {
   assert,
   beforeAll,
@@ -20,6 +21,7 @@ import type {
   Size,
 } from 'react-native-vision-camera'
 import { CommonResolutions, VisionCamera } from 'react-native-vision-camera'
+import { withTimeout } from './test-utils'
 
 const sleep = (ms: number) =>
   new Promise<void>((resolve) => setTimeout(resolve, ms))
@@ -789,6 +791,51 @@ describe('VisionCamera - Photo', () => {
     }
   })
 
+  it('rejects a superseded Photo settings preparation', async (context) => {
+    if (Platform.OS !== 'ios') {
+      return context.skip('Photo settings preparation cancellation: iOS only')
+    }
+
+    const session = await VisionCamera.createCameraSession(false)
+    const photoOutput = VisionCamera.createPhotoOutput({
+      targetResolution: CommonResolutions.HD_4_3,
+      containerFormat: 'jpeg',
+      quality: 0.8,
+      qualityPrioritization: 'balanced',
+    })
+    try {
+      await session.configure([
+        {
+          input: backDevice,
+          outputs: [{ output: photoOutput, mirrorMode: 'auto' }],
+          constraints: [],
+        },
+      ])
+
+      // iOS defers preparation while the session is stopped. Submitting a new
+      // request must cancel the pending request without crashing the process.
+      const firstPreparation = photoOutput.prepareSettings([{}])
+      const firstPreparationRejection = expect(
+        withTimeout(
+          firstPreparation,
+          10_000,
+          'superseded Photo settings preparation',
+        ),
+      ).rejects.toThrow('Settings preparation has been canceled!')
+      const replacementPreparation = photoOutput.prepareSettings([{}])
+
+      await session.start()
+      await firstPreparationRejection
+      await withTimeout(
+        replacementPreparation,
+        10_000,
+        'replacement Photo settings preparation',
+      )
+    } finally {
+      await session.stop()
+    }
+  })
+
   it('toggles enableShutterSound and enableRedEyeReduction without error', async () => {
     const session = await VisionCamera.createCameraSession(false)
     const photoOutput = VisionCamera.createPhotoOutput({
```

**File**: `packages/react-native-vision-camera/ios/Hybrid Objects/Outputs/HybridCameraPhotoOutput.swift` (modified, +14/-4)
```diff
@@ -185,11 +185,21 @@ final class HybridCameraPhotoOutput: HybridCameraPhotoOutputSpec, NativeCameraOu
   }
 
   func prepareSettings(settings: [CapturePhotoSettings]) throws -> Promise<Void> {
-    return Promise.async {
-      let captureSettings = try settings.map {
-        try $0.toAVCapturePhotoSettings(for: self.output, withOptions: self.options)
+    let promise = Promise<Void>()
+    let captureSettings = try settings.map {
+      try $0.toAVCapturePhotoSettings(for: self.output, withOptions: self.options)
+    }
+    self.output.setPreparedPhotoSettingsArray(captureSettings) { prepared, error in
+      if let error {
+        promise.reject(withError: error)
+      } else {
+        if prepared {
+          promise.resolve()
+        } else {
+          promise.reject(withError: RuntimeError("Settings preparation has been canceled!"))
+        }
       }
-      try await self.output.setPreparedPhotoSettingsArray(captureSettings)
     }
+    return promise
   }
 }
```

---

### Incident Patch 6: `c0374a25` (2026-08-12)
**Commit Message**: fix: Emit current orientation on subscribe (#4150)

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/hybrids/orientation/HybridDeviceOrientationManager.kt` (modified, +5/-1)
```diff
@@ -32,9 +32,11 @@ class HybridDeviceOrientationManager : HybridOrientationManagerSpec() {
 
   override fun startOrientationUpdates(onChanged: (orientation: CameraOrientation) -> Unit) {
     orientationListener?.disable()
+    currentOrientation?.let(onChanged)
     orientationListener =
       object : OrientationEventListener(context) {
         override fun onOrientationChanged(rotationDegrees: Int) {
+          if (orientationListener !== this) return
           if (rotationDegrees == ORIENTATION_UNKNOWN) {
             // phone is laying flat - orientation is unknown! Avoid sending out event.
             return
@@ -51,6 +53,8 @@ class HybridDeviceOrientationManager : HybridOrientationManagerSpec() {
   }
 
   override fun stopOrientationUpdates() {
-    orientationListener?.disable()
+    val listener = orientationListener
+    orientationListener = null
+    listener?.disable()
   }
 }
```

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/hybrids/orientation/HybridInterfaceOrientationManager.kt` (modified, +8/-3)
```diff
@@ -32,13 +32,19 @@ class HybridInterfaceOrientationManager : HybridOrientationManagerSpec() {
     listener?.let { listener ->
       displayManager.unregisterDisplayListener(listener)
     }
+    val defaultDisplay = displayManager.displays.firstOrNull()
+    if (defaultDisplay != null) {
+      currentOrientation = CameraOrientation.fromSurfaceRotation(defaultDisplay.rotation)
+    }
+    currentOrientation?.let(onChanged)
     val listener =
       object : DisplayManager.DisplayListener {
         override fun onDisplayAdded(displayId: Int) = Unit
 
         override fun onDisplayRemoved(displayId: Int) = Unit
 
         override fun onDisplayChanged(displayId: Int) {
+          if (this@HybridInterfaceOrientationManager.listener !== this) return
           val display = displayManager.getDisplay(displayId) ?: return
           val surfaceRotation = display.rotation
           val orientation = CameraOrientation.fromSurfaceRotation(surfaceRotation)
@@ -54,9 +60,8 @@ class HybridInterfaceOrientationManager : HybridOrientationManagerSpec() {
   }
 
   override fun stopOrientationUpdates() {
-    listener?.let { listener ->
-      displayManager.unregisterDisplayListener(listener)
-    }
+    val currentListener = listener
     listener = null
+    currentListener?.let(displayManager::unregisterDisplayListener)
   }
 }
```

**File**: `packages/react-native-vision-camera/ios/Hybrid Objects/Orientation/HybridDeviceOrientationManager.swift` (modified, +3/-0)
```diff
@@ -29,6 +29,9 @@ final class HybridDeviceOrientationManager: HybridOrientationManagerSpec {
     if motionManager.isAccelerometerActive {
       motionManager.stopAccelerometerUpdates()
     }
+    if let currentOrientation {
+      onChanged(currentOrientation)
+    }
 
     if motionManager.isAccelerometerAvailable {
       motionManager.startAccelerometerUpdates(to: operationQueue) {
```

**File**: `packages/react-native-vision-camera/ios/Hybrid Objects/Orientation/HybridInterfaceOrientationManager.swift` (modified, +8/-0)
```diff
@@ -34,6 +34,13 @@ final class HybridInterfaceOrientationManager: HybridOrientationManagerSpec {
       // Start new listener (beginGeneratingDeviceOrientationNotifications() can be nested)
       UIDevice.current.beginGeneratingDeviceOrientationNotifications()
 
+      let interfaceOrientation = UIApplication.shared.interfaceOrientation
+      if interfaceOrientation != .unknown {
+        let orientation = CameraOrientation(interfaceOrientation: interfaceOrientation)
+        self.currentOrientation = orientation
+        onChanged(orientation)
+      }
+
       self.observer = NotificationCenter.default.addObserver(
         forName: UIDevice.orientationDidChangeNotification,
         object: nil,
@@ -60,6 +67,7 @@ final class HybridInterfaceOrientationManager: HybridOrientationManagerSpec {
       if let observer = self.observer {
         logger.info("Stopping interface orientation updates...")
         NotificationCenter.default.removeObserver(observer)
+        self.observer = nil
         UIDevice.current.endGeneratingDeviceOrientationNotifications()
       }
     }
```

**File**: `packages/react-native-vision-camera/src/hooks/useOrientation.ts` (modified, +1/-0)
```diff
@@ -20,6 +20,7 @@ export function useOrientation(
 ): CameraOrientation | undefined {
   const orientationManager = useOrientationManager(source)
   const currentOrientation = useRef(orientationManager?.currentOrientation)
+  currentOrientation.current = orientationManager?.currentOrientation
 
   const subscribe = useCallback(
     (onStoreChange: () => void) => {
```

---

### Incident Patch 7: `53330199` (2026-08-10)
**Commit Message**: fix: compose `Photo.toImage()` rotation before mirroring (#4143)

Matrix.preScale right-multiplies and postRotate left-multiplies, so the
mirror was applied before the rotation. A reflection conjugates a rotation
into its inverse, so that ordering leaves the Image a half turn from what
`orientation` and `isMirrored` describe, and 180 degrees away from the EXIF
file path and the live preview.

The same composition is in ImageProxy.toBitmap, which the Frame and Depth
converters go through, so both are fixed here.

Adds the harness coverage that pins it: one front-camera capture, compared
point by point against the stored frame read through the reported rotation.

Co-authored-by: Claude Opus 5 (1M context) <noreply@anthropic.com>

**File**: `apps/simple-camera/__tests__/visioncamera.photo.harness.ts` (modified, +123/-0)
```diff
@@ -9,6 +9,7 @@ import {
   waitUntil,
 } from 'react-native-harness'
 import type { Image } from 'react-native-nitro-image'
+import { Images } from 'react-native-nitro-image'
 import type {
   CameraDevice,
   CameraDeviceFactory,
@@ -990,4 +991,126 @@ describe('VisionCamera - Photo', () => {
       await session.stop()
     }
   })
+
+  it('renders toImage() the same way the reported orientation describes', async (context) => {
+    // Regression: `HybridPhoto.toImage()` composed the mirror with `preScale` and
+    // the rotation with `postRotate`, which applies the mirror first. A reflection
+    // conjugates a rotation into its inverse, so the two orderings differ by twice
+    // the rotation - a half turn at a quarter-turn orientation. At `up` and `down`
+    // both orderings are the same matrix, so only quarter turns expose it.
+    const frontDevice = factory.getDefaultCamera('front')
+    assert.exists(frontDevice, 'no front camera')
+
+    const session = await VisionCamera.createCameraSession(false)
+    const photoOutput = VisionCamera.createPhotoOutput({
+      targetResolution: CommonResolutions.HD_4_3,
+      containerFormat: 'jpeg',
+      quality: 1,
+      qualityPrioritization: 'balanced',
+    })
+    await session.configure([
+      {
+        input: frontDevice,
+        outputs: [{ output: photoOutput, mirrorMode: 'auto' }],
+        constraints: [],
+      },
+    ])
+    await session.start()
+
+    try {
+      // Taken as the pipeline reports it. Forcing `outputOrientation` does not help:
+      // CameraX then rotates the pixels itself and reports no rotation at all.
+      const photo = await photoOutput.capturePhoto(
+        { flashMode: 'off', enableShutterSound: false },
+        {},
+      )
+      try {
+        const quarterTurns = { left: 90, right: 270 } as const
+        const rotation =
+          quarterTurns[photo.orientation as keyof typeof quarterTurns]
+        if (rotation == null) {
+          return context.skip(
+            `photo.orientation is "${photo.orientation}": this device does not report a quarter turn, so the mirror and rotation never compose`,
+          )
+        }
+        if (!photo.isMirrored) {
+          return context.skip(
+            'photo.isMirrored is false: without a mirror both orderings are the same matrix',
+          )
+        }
+
+        const storedPath = await photo.saveToTemporaryFileAsync()
+        const storedImage = await Images.loadFromFileAsync(storedPath)
+        const renderedImage = await photo.toImageAsync()
+        try {
+          const stored = await storedImage.toRawPixelDataAsync(false)
+          const rendered = await renderedImage.toRawPixelDataAsync(false)
+          if (
+            stored.width !== rendered.height ||
+            stored.height !== rendered.width
+          ) {
+            return context.skip(
+              `stored ${stored.width}x${stored.height} against rendered ${rendered.width}x${rendered.height}: this platform's decoder already applied the orientation, so the two cannot be compared point by point`,
+            )
+          }
+
+          const readChannelAverage = (
+            pixels: typeof stored,
+            x: number,
+            y: number,
+          ) => {
+            const bytes = new Uint8Array(pixels.buffer)
+            const bytesPerPixel = Math.floor(
+              bytes.length / (pixels.width * pixels.height),
+            )
+            const offset = (y * pixels.width + x) * bytesPerPixel
+            let sum = 0
+            for (let channel = 0; channel < 3; channel++) {
+              sum += bytes[offset + channel] ?? 0
+            }
+            return sum / 3
+          }
+
+          // Where a rendered point came from in the stored frame, if the rotation
+          // the Photo reports is applied first and the mirror after it.
+          const toStoredPoint = (x: number, y: number): [number, number] => {
+            const mirroredX = rendered.width - 1 - x
+     
```

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/extensions/ImageProxy+toBitmap.kt` (modified, +3/-3)
```diff
@@ -13,12 +13,12 @@ fun ImageProxy.toBitmap(
 
   val matrix =
     Matrix().apply {
-      if (isMirrored) {
-        preScale(-1f, 1f)
-      }
       if (orientation != CameraOrientation.UP) {
         postRotate(orientation.degrees.toFloat())
       }
+      if (isMirrored) {
+        postScale(-1f, 1f)
+      }
     }
   if (matrix.isIdentity) {
     // No transforms needed! Just return
```

**File**: `packages/react-native-vision-camera/android/src/main/java/com/margelo/nitro/camera/hybrids/instances/HybridPhoto.kt` (modified, +3/-3)
```diff
@@ -156,13 +156,13 @@ class HybridPhoto(
 
     val matrix =
       Matrix().apply {
-        if (isMirrored) {
-          preScale(-1f, 1f)
-        }
         if (orientation != CameraOrientation.UP) {
           val orientationToApply = orientation.counterRotated()
           postRotate(orientationToApply.degrees.toFloat())
         }
+        if (isMirrored) {
+          postScale(-1f, 1f)
+        }
       }
     if (matrix.isIdentity) {
       // No transforms needed! Just return
```

---

### Incident Patch 8: `a55096f6` (2026-08-05)
**Commit Message**: fix: Remove preview layers as well in `updateOutputs(..)` (#4134)

* fix: Remove preview layers as well in `updateOutputs(..)`

* Update HybridCameraSession.swift

* fix: Do it before updateInputs/updateOutputs

* remove -> detach

* Update HybridCameraSession.swift

**File**: `packages/react-native-vision-camera/ios/Hybrid Objects/HybridCameraSession.swift` (modified, +22/-0)
```diff
@@ -66,6 +66,8 @@ final class HybridCameraSession: HybridCameraSessionSpec {
         )
       }
 
+      // Detach all unwanted preview layers before touching inputs/outputs
+      self.detachUnwantedPreviewLayers(connections)
       // Remove all unwanted inputs and add all new inputs
       try self.updateInputs(connections)
       // Remove all unwanted outputs and add all new outputs
@@ -228,6 +230,25 @@ final class HybridCameraSession: HybridCameraSessionSpec {
   }
 
   // pragma MARK: Helpers
+  /**
+   * Detach all preview layers that are not listed in the [targetConnections] array
+   * from this [AVCaptureSession].
+   * This must run before [updateInputs] or [updateOutputs], as those methods kill
+   * preview connections without unsetting the `session`.
+   */
+  private func detachUnwantedPreviewLayers(_ targetConnections: [ResolvedCameraSessionConnection]) {
+    let currentlyAttachedPreviewLayers = self.session.connections.compactMap { $0.videoPreviewLayer }
+    for currentlyAttachedPreviewLayer in currentlyAttachedPreviewLayers {
+      let containsAttachedPreviewLayer = targetConnections.contains { connection in
+        return connection.isConnectedTo(preview: currentlyAttachedPreviewLayer)
+      }
+      if !containsAttachedPreviewLayer {
+        logger.info("Removing preview \(currentlyAttachedPreviewLayer)...")
+        currentlyAttachedPreviewLayer.session = nil
+      }
+    }
+  }
+
   /**
    * Adds all inputs on the given [targetConnections] if they haven't been added yet,
    * and removes all current inputs that aren't listed in the [connections] array.
@@ -289,6 +310,7 @@ final class HybridCameraSession: HybridCameraSessionSpec {
       }
     }
   }
+
   /**
    * Adds all outputs on the given [targetConnections] if they haven't been added yet,
    * and removes all current outputs that aren't listed in the [targetConnections] array.
```

---

### Incident Patch 9: `cbcc80a6` (2026-08-05)
**Commit Message**: fix: Cap the `AHardwareBuffer` import cache at maximum 12 images (#4129)

Importing an AHardwareBuffer into Vulkan acquires a reference on it, so the
unbounded import cache pinned every camera buffer the Resizer had ever seen.
Cap it at 12 entries, evicting oldest-inserted first.

Co-authored-by: Claude Fable 5 <noreply@anthropic.com>

**File**: `packages/react-native-vision-camera-resizer/android/src/main/cpp/vulkan/VulkanHardwareBufferInterop.cpp` (modified, +8/-0)
```diff
@@ -73,6 +73,14 @@ const VulkanHardwareBufferInterop::ImportedImage& VulkanHardwareBufferInterop::i
     iterator = _cachedImages.erase(iterator);
   }
 
+  // Evict the oldest entries before inserting so old camera sessions' buffers get released.
+  // Safe to destroy here: run() holds _stateMutex across import -> dispatch -> submit-and-wait,
+  // so no imported image is in flight on the GPU at this point.
+  while (_cachedImages.size() >= kMaxCachedImages) {
+    destroyImportedImage(_cachedImages.front().importedImage);
+    _cachedImages.erase(_cachedImages.begin());
+  }
+
   // No suitable ImportedImage was found in our cache - we have to create a new one.
   CachedImage cachedImage{
       .hardwareBuffer = hardwareBuffer,
```

**File**: `packages/react-native-vision-camera-resizer/android/src/main/cpp/vulkan/VulkanHardwareBufferInterop.hpp` (modified, +9/-0)
```diff
@@ -70,6 +70,15 @@ class VulkanHardwareBufferInterop final {
     ImportedImage importedImage{};
   };
 
+  /**
+   * Upper bound on cached imported images (oldest-inserted evicted first).
+   * Importing an AHardwareBuffer into Vulkan acquires a reference on it, so every cached entry
+   * pins a whole camera buffer - each camera session restart allocates a fresh buffer set, and
+   * an unbounded cache pins the old sets forever. A streaming session cycles through ~4-6
+   * buffers, so 12 leaves plenty of slack.
+   */
+  static inline constexpr size_t kMaxCachedImages = 12;
+
   static inline constexpr VkFormatFeatureFlags kRequiredExternalFormatFeatures = VK_FORMAT_FEATURE_SAMPLED_IMAGE_BIT;
   static inline constexpr VkFormatFeatureFlags kLinearFilterFeatureMask =
       VK_FORMAT_FEATURE_SAMPLED_IMAGE_FILTER_LINEAR_BIT | VK_FORMAT_FEATURE_SAMPLED_IMAGE_YCBCR_CONVERSION_LINEAR_FILTER_BIT;
```

---

### Incident Patch 10: `1e28058e` (2026-08-03)
**Commit Message**: chore: Test Preview position regression via Harness UI (#4124)

* chore: Test Preview position regression via Harness UI

* actually tap elements

**File**: `apps/simple-camera/__tests__/visioncamera.nativepreviewview.harness.tsx` (modified, +132/-0)
```diff
@@ -1,3 +1,4 @@
+import { screen, userEvent } from '@react-native-harness/ui'
 import {
   type LayoutChangeEvent,
   PixelRatio,
@@ -219,6 +220,119 @@ describe('VisionCamera - NativePreviewView', () => {
     }
   })
 
+  it('keeps a positioned NativePreviewView at its React layout after preview starts', async () => {
+    const session = await VisionCamera.createCameraSession(false)
+    const previewOutput = VisionCamera.createPreviewOutput()
+    await session.configure([
+      {
+        input: backDevice,
+        outputs: [{ output: previewOutput, mirrorMode: 'auto' }],
+        constraints: [],
+      },
+    ])
+
+    const previewRef = deferred<PreviewView>()
+    const rootLayout = deferred<Layout>()
+    const previewLayout = deferred<Layout>()
+    const previewStarted = deferred()
+    const errorSub = session.addOnErrorListener((error) => {
+      previewRef.reject(error)
+      rootLayout.reject(error)
+      previewLayout.reject(error)
+      previewStarted.reject(error)
+    })
+    const pressedPoints: Point[] = []
+
+    try {
+      await render(
+        <View
+          testID={POSITIONED_ROOT_TEST_ID}
+          style={styles.positionedRoot}
+          onLayout={(event) => {
+            rootLayout.resolve(toLayout(event))
+          }}
+          onStartShouldSetResponderCapture={() => true}
+          onResponderRelease={(event) => {
+            pressedPoints.push({
+              x: event.nativeEvent.pageX,
+              y: event.nativeEvent.pageY,
+            })
+          }}
+        >
+          <NativePreviewView
+            testID={POSITIONED_PREVIEW_TEST_ID}
+            style={styles.positionedPreview}
+            hybridRef={callback((preview: PreviewView) => {
+              previewRef.resolve(preview)
+            })}
+            onLayout={(event) => {
+              previewLayout.resolve(toLayout(event))
+            }}
+            onPreviewStarted={callback(previewStarted.resolve)}
+          />
+        </View>,
+      )
+
+      const preview = await withTimeout(
+        previewRef.promise,
+        10_000,
+        'positioned NativePreviewView hybridRef',
+      )
+      const rootFrame = await withTimeout(
+        rootLayout.promise,
+        10_000,
+        'positioned root onLayout',
+      )
+      const previewFrame = await withTimeout(
+        previewLayout.promise,
+        10_000,
+        'positioned NativePreviewView onLayout',
+      )
+
+      // Connect only after the initial native layout so attaching the native
+      // preview cannot race with a later React layout transaction.
+      preview.previewOutput = previewOutput
+      await session.start()
+      await withTimeout(
+        previewStarted.promise,
+        15_000,
+        'positioned NativePreviewView onPreviewStarted',
+      )
+
+      // Harness element references are intentionally opaque. userEvent.press
+      // taps each element's real native center, so the delta between these two
+      // public touch events reveals the preview's actual native offset while
+      // cancelling out the root's unknown screen origin.
+      const rootElement = await screen.findByTestId(POSITIONED_ROOT_TEST_ID)
+      const previewElement = await screen.findByTestId(
+        POSITIONED_PREVIEW_TEST_ID,
+      )
+      await userEvent.press(rootElement)
+      await userEvent.press(previewElement)
+
+      expect(pressedPoints).toHaveLength(2)
+      const rootCenter = pressedPoints[0]
+      const previewCenter = pressedPoints[1]
+      if (rootCenter == null || previewCenter == null) {
+        throw new Error('positioned preview touches were not received')
+      }
+
+      const actualLeft =
+        previewCenter.x -
+        rootCenter.x +
+        (rootFrame.width - previewFrame.width) / 2
+      const actualTop =
+        previewCenter.y -
+        rootCenter.y +
+        (rootFrame.height - previewFrame.height) / 2
+      expect(actualLeft).toBeCloseTo(POSITIONED_PREVIEW_LEFT, 0)
+      expect(actua
```

**File**: `apps/simple-camera/ios/Podfile.lock` (modified, +26/-0)
```diff
@@ -23,6 +23,28 @@ PODS:
     - GoogleUtilities/Logger
     - GoogleUtilities/Privacy
   - GTMSessionFetcher/Core (3.5.0)
+  - HarnessUI (1.4.0-rc.1):
+    - hermes-engine
+    - RCTRequired
+    - RCTTypeSafety
+    - React-Core
+    - React-Core-prebuilt
+    - React-debug
+    - React-Fabric
+    - React-featureflags
+    - React-graphics
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
+    - ReactNativeDependencies
+    - Yoga
   - hermes-engine (250829098.0.10):
     - hermes-engine/Pre-built (= 250829098.0.10)
   - hermes-engine/Pre-built (250829098.0.10)
@@ -2454,6 +2476,7 @@ PODS:
 
 DEPENDENCIES:
   - FBLazyVector (from `../../../node_modules/react-native/Libraries/FBLazyVector`)
+  - "HarnessUI (from `../../../node_modules/@react-native-harness/ui`)"
   - hermes-engine (from `../../../node_modules/react-native/sdks/hermes-engine/hermes-engine.podspec`)
   - NitroImage (from `../../../node_modules/react-native-nitro-image`)
   - NitroModules (from `../../../node_modules/react-native-nitro-modules`)
@@ -2564,6 +2587,8 @@ SPEC REPOS:
 EXTERNAL SOURCES:
   FBLazyVector:
     :path: "../../../node_modules/react-native/Libraries/FBLazyVector"
+  HarnessUI:
+    :path: "../../../node_modules/@react-native-harness/ui"
   hermes-engine:
     :podspec: "../../../node_modules/react-native/sdks/hermes-engine/hermes-engine.podspec"
     :tag: hermes-v250829098.0.10
@@ -2755,6 +2780,7 @@ SPEC CHECKSUMS:
   GoogleToolboxForMac: d1a2cbf009c453f4d6ded37c105e2f67a32206d8
   GoogleUtilities: 00c88b9a86066ef77f0da2fab05f65d7768ed8e1
   GTMSessionFetcher: 5aea5ba6bd522a239e236100971f10cb71b96ab6
+  HarnessUI: 873456a372d247aea2e8ec9a6439a35bbb1253c9
   hermes-engine: 691752261227b9de03faf08561f47f2e2b5b52e9
   MLImage: 0de5c6c2bf9e93b80ef752e2797f0836f03b58c0
   MLKitBarcodeScanning: 39de223e7b1b8a8fbf10816a536dd292d8a39343
```

**File**: `apps/simple-camera/package.json` (modified, +1/-0)
```diff
@@ -49,6 +49,7 @@
     "@react-native-community/cli-platform-ios": "20.1.3",
     "@react-native-harness/platform-android": "1.4.0-rc.1",
     "@react-native-harness/platform-apple": "1.4.0-rc.1",
+    "@react-native-harness/ui": "1.4.0-rc.1",
     "@react-native/babel-preset": "0.85.3",
     "@react-native/metro-config": "0.85.3",
     "@react-native/typescript-config": "0.85.3",
```

**File**: `bun.lock` (modified, +3/-0)
```diff
@@ -56,6 +56,7 @@
         "@react-native-community/cli-platform-ios": "20.1.3",
         "@react-native-harness/platform-android": "1.4.0-rc.1",
         "@react-native-harness/platform-apple": "1.4.0-rc.1",
+        "@react-native-harness/ui": "1.4.0-rc.1",
         "@react-native/babel-preset": "0.85.3",
         "@react-native/metro-config": "0.85.3",
         "@react-native/typescript-config": "0.85.3",
@@ -938,6 +939,8 @@
 
     "@react-native-harness/tools": ["@react-native-harness/tools@1.4.0-rc.1", "", { "dependencies": { "@clack/prompts": "1.0.0-alpha.9", "nano-spawn": "^1.0.2", "picocolors": "^1.1.1", "tslib": "^2.3.0" }, "peerDependencies": { "react-native": "*" } }, "sha512-A/Zj865TCX2XDIiLwdkxNFEwsjbnvVjJ5vjShu0Y2wpFAlFy6d1epACfQ9EDqhJi+1v3mUavZ6vhkqWEUuoUUA=="],
 
+    "@react-native-harness/ui": ["@react-native-harness/ui@1.4.0-rc.1", "", { "dependencies": { "@react-native-harness/runtime": "1.4.0-rc.1", "tslib": "^2.3.0" }, "peerDependencies": { "react-native": "*" } }, "sha512-BoggdQuPeyg6zoc3kYq8fRtsvoNw4/wpKIRSlhCdFwzKslGOr9KFCZlxZu13JdmeByUIAseGb3aAJfPlOxEAjw=="],
+
     "@react-native-menu/menu": ["@react-native-menu/menu@2.0.0", "", { "peerDependencies": { "react": "*", "react-native": "*" } }, "sha512-hb8Mirw6aKPGONhgo52IiNpwHtISVrgCT3rMdFX1qS7eOFNzOcQh8d2UDnaH5zVpxN+QuvWtaaiRMGFpIjzdtA=="],
 
     "@react-native-vector-icons/common": ["@react-native-vector-icons/common@13.0.1", "", { "dependencies": { "find-up": "^8.0.0", "picocolors": "^1.1.1", "plist": "^3.1.0" }, "peerDependencies": { "@react-native-vector-icons/get-image": "^13.0.0", "@react-native/assets-registry": "*", "expo-font": "*", "react": "*", "react-native": "*" }, "optionalPeers": ["@react-native-vector-icons/get-image", "@react-native/assets-registry", "expo-font"], "bin": { "rnvi-update-plist": "lib/commonjs/scripts/updatePlist.js" } }, "sha512-UPC6L3tW5rXCjBn4kgw9RPURUILIg8tFpEY2uaYwU8aCjEHkywNCMcAO8+PvMCDkR6aICPeHYA0OXvMgrjsF4g=="],
```

#### Recent Merged Pull Requests:
- **PR #4176** (2026-08-29): chore: Update links for the move to the margelo org (@mrousavy)
- **PR #4175** (closed): fix: align iOS frame coordinates with camera sensor (@huytdps13400)
- **PR #4173** (closed): feat: Add native tap-to-focus reset listener (@mrousavy)
- **PR #4172** (2026-08-26): feat: Add native tap-to-focus lifecycle listeners (@mrousavy)
- **PR #4171** (2026-08-26): feat: Add native zoom gesture change listener (@mrousavy)
- **PR #4170** (2026-08-23): feat: expose metadata from capturePhotoToFile (@mrousavy)
- **PR #4167** (2026-08-21): fix: Deep-compare `constraints` instead of `JSON.stringify`-ing them (@mrousavy)
- **PR #4166** (2026-08-21): fix: Memoize `targetResolution` in output hooks (@mrousavy)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
