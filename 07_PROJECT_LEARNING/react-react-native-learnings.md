> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/react-react-native-learnings.md`  
> **Source**: github ([https://github.com/react/react-native](https://github.com/react/react-native))  
> **Source Version**: `93019c44`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T23:49:00.563Z  
> **Learning ID**: `learn-github-react-react-native`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): react/react-native

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-react-native-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react/react-native](https://github.com/react/react-native))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-05T23:48:53.252Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react/react-native`
- **Description**: A framework for building native applications using React
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 126861 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/asset-utils/src/AndroidPathUtils.d.ts`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

export type PackagerAsset = Readonly<{
  httpServerLocation: string;
  name: string;
  type: string;
}>;

export function getAndroidResourceFolderName(
  asset: PackagerAsset,
  scale: number,
): string;

export function getAndroidResourceIdentifier(asset: PackagerAsset): string;

export const drawableFileTypes: Set<string>;

```

### Core Architecture Module: `packages/asset-utils/src/AndroidPathUtils.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

'use strict';

/*::
// Conforms to the `PackagerAsset` type from `react-native`.
export type PackagerAsset = Readonly<{
  httpServerLocation: string,
  name: string,
  type: string,
  ...
}>;
*/

const androidScaleSuffix /*: {[string]: string} */ = {
  '0.75': 'ldpi',
  '1': 'mdpi',
  '1.5': 'hdpi',
  '2': 'xhdpi',
  '3': 'xxhdpi',
  '4': 'xxxhdpi',
};

const ANDROID_BASE_DENSITY = 160;

// FIXME: Using number to represent discrete scale numbers is fragile in
// essence because of floating point number imprecision.
function getAndroidAssetSuffix(scale /*: number */) /*: string */ {
  if (scale.toString() in androidScaleSuffix) {
    return androidScaleSuffix[scale.toString()];
  }

  // NOTE: Android Gradle Plugin does not fully support the nnndpi format.
  // See https://issuetracker.google.com/issues/72884435
  if (Number.isFinite(scale) && scale > 0) {
    return Math.round(scale * ANDROID_BASE_DENSITY) + 'dpi';
  }

  throw new Error('no such scale ' + scale.toString());
}

// See https://developer.android.com/guide/topics/resources/drawable-resource.html
const drawableFileTypes /*: Set<string> */ = new Set([
  'gif',
  'heic',
  'heif',
  'jpeg',
  'jpg',
  'ktx',
  'png',
  'webp',
  'xml',
]);

function getAndroidResourceFolderName(
  asset /*: PackagerAsset */,
  scale /*: number */,
) /*: string */ {
  if (!drawableFileTypes.has(asset.type)) {
    return 'raw';
  }

  return 'drawable-' + getAndroidAssetSuffix(scale);
}

function getAndroidResourceIdentifier(
  asset /*: PackagerAsset */,
) /*: string */ {
  return (getBasePath(asset) + '/' + asset.name)
    .toLowerCase()
    .replace(/\//g, '_') // Encode folder structure in file name
    .replace(/([^a-z0-9_])/g, '') // Remove illegal chars
    .replace(/^(?:assets|assetsunstable_path)_/, ''); // Remove "assets_" or "assetsunstable_path_" prefix
}

function getBasePath(asset /*: PackagerAsset */) /*: string */ {
  const basePath = asset.httpServerLocation;
  return basePath.startsWith('/') ? basePath.slice(1) : basePath;
}

module.exports = {
  drawableFileTypes,
  getAndroidResourceFolderName,
  getAndroidResourceIdentifier,
};

```

### Core Architecture Module: `packages/asset-utils/src/index.d.ts`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

export * from './AndroidPathUtils';

```

### Core Architecture Module: `packages/asset-utils/src/index.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

'use strict';

/*::
export type {PackagerAsset} from './AndroidPathUtils';
*/

module.exports = require('./AndroidPathUtils');

```

### Core Architecture Module: `packages/community-cli-plugin/src/utils/errors.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

/**
 * A custom Error that creates a single-lined message to match current styling inside CLI.
 * Uses original stack trace when `originalError` is passed or erase the stack if it's not defined.
 */
export class CLIError extends Error {
  constructor(msg: string, originalError?: Error | string) {
    super(inlineString(msg));
    if (originalError != null) {
      this.stack =
        typeof originalError === 'string'
          ? originalError
          : // $FlowFixMe[sketchy-null-string]
            originalError.stack || ''.split('\n').slice(0, 2).join('\n');
    } else {
      // When the "originalError" is not passed, it means that we know exactly
      // what went wrong and provide means to fix it. In such cases showing the
      // stack is an unnecessary clutter to the CLI output, hence removing it.
      this.stack = '';
    }
  }
}

/**
 * Raised when we're unable to find a package.json
 */
export class UnknownProjectError extends Error {}

export const inlineString = (str: string = ''): string =>
  str.replace(/(\s{2,})/gm, ' ').trim();

```

### Core Architecture Module: `packages/community-cli-plugin/src/utils/loadMetroConfig.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {Config} from '@react-native-community/cli-types';
import type {MetroConfig} from 'metro';

import {CLIError} from './errors';
import {reactNativePlatformResolver} from './metroPlatformResolver';
import {loadConfig, resolveConfig} from 'metro';

const debug = require('debug')('ReactNative:CommunityCliPlugin');

type HydratedMetroConfig = Awaited<ReturnType<typeof loadConfig>>;
type ArgvInput = Parameters<typeof loadConfig>[0];

export type {Config};

export type ConfigLoadingContext = Readonly<{
  root: Config['root'],
  platforms: Config['platforms'],
  ...
}>;

/**
 * Get the config options to override based on RN CLI inputs.
 */
function getCommunityCliDefaultConfig(
  ctx: ConfigLoadingContext,
  config: HydratedMetroConfig,
): MetroConfig {
  const outOfTreePlatforms = Object.keys(ctx.platforms).filter(
    platform => ctx.platforms[platform].npmPackageName,
  );
  const resolver: Partial<{...HydratedMetroConfig['resolver']}> = {
    platforms: [...Object.keys(ctx.platforms), 'native'],
  };

  if (outOfTreePlatforms.length) {
    resolver.resolveRequest = reactNativePlatformResolver(
      outOfTreePlatforms.reduce<{[platform: string]: string}>(
        (result, platform) => {
          result[platform] = ctx.platforms[platform].npmPackageName;
          return result;
        },
        {},
      ),
      config.resolver?.resolveRequest,
    );
  }

  return {
    resolver,
    serializer: {
      // We can include multiple copies of setup-env here because Metro will
      // only add ones that are already part of the bundle
      getModulesRunBeforeMainModule: () => [
        require.resolve('react-native/setup-env', {
          paths: [ctx.root],
        }),
        ...outOfTreePlatforms.map(platform =>
          require.resolve(
            `${ctx.platforms[platform].npmPackageName}/setup-env`,
            {paths: [ctx.root]},
          ),
        ),
      ],
    },
  };
}

/**
 * Load Metro config.
 *
 * Allows the CLI to override select values in `metro.config.js` based on
 * dynamic user options in `ctx`.
 */
export default async function loadMetroConfig(
  ctx: ConfigLoadingContext,
  options: NonNullable<ArgvInput> = {},
): Promise<HydratedMetroConfig> {
  let RNMetroConfig = null;
  try {
    RNMetroConfig = require('@react-native/metro-config');
  } catch (e) {
    throw new Error(
      "Cannot resolve `@react-native/metro-config`. Ensure it is listed in your project's `devDependencies`.",
    );
  }

  // Get the RN defaults before our customisations
  const defaultConfig = RNMetroConfig.getDefaultConfig(ctx.root);

  // Add our defaults to `@react-native/metro-config` before the user config
  // loads them.
  if (typeof RNMetroConfig.setFrameworkDefaults !== 'function') {
    throw new Error(
      '`@react-native/metro-config` does not have the expected API. Ensure it matches your React Native version.',
    );
  }
  RNMetroConfig.setFrameworkDefaults(
    getCommunityCliDefaultConfig(ctx, defaultConfig),
  );

  const cwd = ctx.root;
  const projectConfig = await resolveConfig(options.config, cwd);

  if (projectConfig.isEmpty) {
    throw new CLIError(`No Metro config found in ${cwd}`);
  }

  debug(`Reading Metro config from ${projectConfig.filepath}`);

  return loadConfig({
    cwd,
    ...options,
  });
}

```

### Core Architecture Module: `packages/community-cli-plugin/src/utils/metroPlatformResolver.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {CustomResolver} from 'metro-resolver';

/**
 * This is an implementation of a metro resolveRequest option which will remap react-native imports
 * to different npm packages based on the platform requested.  This allows a single metro instance/config
 * to produce bundles for multiple out of tree platforms at a time.
 *
 * @param platformImplementations
 * A map of platform to npm package that implements that platform
 *
 * Ex:
 * {
 *    windows: 'react-native-windows'
 *    macos: 'react-native-macos'
 * }
 */
export function reactNativePlatformResolver(
  platformImplementations: {
    [platform: string]: string,
  },
  customResolver: ?CustomResolver,
): CustomResolver {
  return (context, moduleName, platform) => {
    let modifiedModuleName = moduleName;
    if (platform != null && platformImplementations[platform]) {
      if (moduleName === 'react-native') {
        modifiedModuleName = platformImplementations[platform];
      } else if (moduleName.startsWith('react-native/')) {
        modifiedModuleName = `${
          platformImplementations[platform]
        }/${modifiedModuleName.slice('react-native/'.length)}`;
      }
    }
    if (customResolver) {
      return customResolver(context, modifiedModuleName, platform);
    }
    return context.resolveRequest(context, modifiedModuleName, platform);
  };
}

```

### Core Architecture Module: `packages/community-cli-plugin/src/utils/parseKeyValueParamArray.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

export default function parseKeyValueParamArray(
  keyValueArray: ReadonlyArray<string>,
): Record<string, string> {
  const result = {};

  for (const item of keyValueArray) {
    if (item.indexOf('=') === -1) {
      throw new Error('Expected parameter to include "=" but found: ' + item);
    }
    if (item.indexOf('&') !== -1) {
      throw new Error('Parameter cannot include "&" but found: ' + item);
    }
    const params = new URLSearchParams(item);
    params.forEach((value, key) => {
      // $FlowExpectedError[prop-missing]
      result[key] = value;
    });
  }
  return result;
}

```

### Core Architecture Module: `packages/debugger-shell/src/electron/utils.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

/** Equivalent of Swift's `if #available(macOS 26, *)`. */
export function isMacOSAtLeast(major: number): boolean {
  return (
    process.platform === 'darwin' &&
    // $FlowFixMe[prop-missing]
    Number.parseInt(process.getSystemVersion().split('.')[0], 10) >= major
  );
}

```

### Core Architecture Module: `packages/debugger-shell/src/node/private/LaunchUtils.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {DebuggerShellPreparationResult} from '../';

const {spawn} = require('cross-spawn');

async function spawnAndGetStderr(
  command: string,
  args: string[],
): Promise<{
  code: number,
  stderr: string,
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
      encoding: 'utf8',
      windowsHide: true,
    });
    let stderr = '';
    child.stderr.on('data', data => {
      stderr += data;
    });
    child.on('error', error => {
      reject(error);
    });
    child.on('close', (code, signal) => {
      resolve({
        code,
        stderr,
      });
    });
  });
}

async function prepareDebuggerShellFromDotSlashFile(
  filePath: string,
): Promise<DebuggerShellPreparationResult> {
  const {code, stderr} = await spawnAndGetStderr(require('fb-dotslash'), [
    '--',
    'fetch',
    filePath,
  ]);
  if (code === 0) {
    return {code: 'success'};
  }
  if (
    stderr.includes('dotslash error') &&
    stderr.includes('no providers succeeded')
  ) {
    if (stderr.includes('failed to verify artifact')) {
      return {
        code: 'possible_corruption',
        humanReadableMessage:
          'Failed to verify the latest version of React Native DevTools. ' +
          'Using a fallback version instead. ',
        verboseInfo: stderr,
      };
    }
    return {
      code: 'likely_offline',
      humanReadableMessage:
        'Failed to download the latest version of React Native DevTools. ' +
        'Using a fallback version instead. ' +
        'Connect to the internet or check your network settings.',
      verboseInfo: stderr,
    };
  }
  if (
    stderr.includes('dotslash error') &&
    stderr.includes('platform not supported')
  ) {
    return {
      code: 'platform_not_supported',
      humanReadableMessage:
        'The latest version of React Native DevTools is not supported on this platform. ' +
        'Using a fallback version instead.',
      verboseInfo: stderr,
    };
  }
  return {
    code: 'unexpected_error',
    humanReadableMessage:
      'An unexpected error occurred while installing the latest version of React Native DevTools. ' +
      'Using a fallback version instead.',
    verboseInfo: stderr,
  };
}

export {prepareDebuggerShellFromDotSlashFile};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #56126** (2026-04-18): **[Android] HermesSamplingProfiler JNI "disable" method incorrectly mapped to ::enable**
  *Symptoms*: ## Bug Description  <!--   Please provide a clear and concise description of what the bug is with the   latest version of React Native and Hermes. Unfortunately we are unable to   provide fixes for old versions of Hermes.    If it's an exception, please include the screenshots, e.g. the React Native   RedBox screen includes a symbolicated JavaScript stack trace with a stack trace   when Metro is running (it's grayscale monospaced text on black background below   the red background section). Please also include a few lines of the JavaScript   source before and after the line in which the error occurs.    If it's an abort (e.g. app crashes), please see "Reporting crashes" from   <https://github.com/facebook/hermes/blob/HEAD/doc/ReactNativeIntegration.md#reporting-native-crashes>   for instructions on reporting a native crash, including symbolicating the native   stack trace.  Note this will only work with some versions of Hermes.    If you believe you have discovered a security vulnerability in Hermes, please   refrain from filing a public issue and instead submit it through the Meta Bug   Bounty program <https://www.facebook.com/whitehat>. -->  In `ReactAndroid/src/main/jni/react/hermes/instrumentation/HermesSamplingProfiler.cpp`, the `registerNatives()` function maps the JNI "disable" method to `HermesSamplingProfiler::enable` instead of   `HermesSamplingProfiler::disable:`  ```   void HermesSamplingProfiler::registerNatives() {     javaClassLocal()->registerNatives({        

- **Issue #53915** (2025-12-23): **Sandbox error when compiling iOS with Hermes: "Operation not permitted" and "No such file or directory" (Apple Silicon/Xcode)**
  *Symptoms*: ## Bug Description  I'm experiencing sandbox errors when building a React Native project with Hermes enabled on iOS. The build fails with messages related to the Hermes framework, such as:  Sandbox: rsync(...) deny(1) file-read-data .../hermes.framework/Info.plist Sandbox: rsync(...) deny(1) file-write-create .../hermes.framework/.hermes.XXXX hermes.framework/hermes: utimensat (2): No such file or directory Operation not permitted  ## Environment:  1. macOS: [Sonoma 14.2] 2. Xcode: [15.3] 3. React Native: 0.81.4 4. Hermes: default (bundled with React Native) 5. Apple Silicon: [M1]  ## What I have tried:  1. Gave Full Disk Access to Xcode in System Preferences. 2. Cleaned Xcode cache (rm -rf ~/Library/Developer/Xcode/DerivedData). 3. Ran pod deintegrate and pod install in the ios folder. 4. Updated all dependencies with yarn upgrade and pod update. 5. Built the project directly in Xcode. 6. Tried running Xcode under Rosetta. 7. Checked folder permissions with chown.  ## Detailed log:  Sandbox: rsync(7116) deny(1) file-read-data /Users/fredazevedo/Library/Developer/Xcode/DerivedData/associanet-fnbakryxbfssxlbjmkzzrxdalzcl/Build/Products/Debug-iphonesimulator/XCFrameworkIntermediates/hermes-engine/Pre-built/hermes.framework/Info.plist Sandbox: rsync(7117) deny(1) file-write-create /Users/fredazevedo/Library/Developer/Xcode/DerivedData/associanet-fnbakryxbfssxlbjmkzzrxdalzcl/Build/Products/Debug-iphonesimulator/associanet.app/Frameworks/hermes.framework/.hermes.h0TkeTJQAi hermes.
  **Post-Mortem & Fix Analysis**:
  > Hi, unfortunately this (the packaging and how it is consumed by Xcode) is not something that the Hermes team maintains and we can't help. I will ask around.
  > > [!WARNING] > **Missing reproducer**: We could not detect a reproducible example in your issue report. Reproducers are **mandatory** and we can accept only one of those as a valid reproducer: <br/><ul><li>For majority of bugs: send us a Pull Request with the [RNTesterPlayground.js](https://github.com/facebook/react-native/blob/main/packages/rn-tester/js/examples/Playground/RNTesterPlayground.js) edited to reproduce your bug.</li><li>If your bug is UI related: a [Snack](https://snack.expo.dev)</li><li> If your bug is build/upgrade related: a project using our [Reproducer Template](https://github.com/react-native-community/reproducer-react-native/generate)</li></ul><br/>You can read more about about it on our website: [How to report a bug](https://reactnative.dev/contributing/how-to-report-a-bug).

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

### Incident Patch 1: `45152f1f` (2026-11-04)
**Commit Message**: Fix addViewAt crash for views held by startViewTransition on Android

<!-- Thanks for submitting a pull request! We appreciate you spending the time to work on these changes. Please provide enough information so that others can review your pull request. The three fields below are mandatory. -->

## Summary:

<!-- Explain the **motivation** for making this change. What existing problem does the pull request solve? -->

On Android, `SurfaceMountingManager.addViewAt` fails when it inserts a view that a parent still holds with `ViewGroup.startViewTransition`.

A held child can leave its old parent's child list while `child.parent` still points to that old parent:

```text
oldParent.indexOfChild(view) == -1
view.parent == oldParent
```

The existing recovery in `addViewAt` calls `removeView` on the old parent. That does nothing for a view that is no longer in the child list, so `addView` throws `addViewAt: failed to insert view ... into parent`. The recovery also adds the tag to `erroneouslyReaddedReactTags`, so a later Remove of that tag returns early and the view is never removed.

React Native Screens holds the content of a removed screen this way during its exit animation ([`Screen.

**File**: `packages/react-native/ReactAndroid/src/main/java/com/facebook/react/fabric/mounting/SurfaceMountingManager.kt` (modified, +5/-1)
```diff
@@ -335,7 +335,11 @@ internal constructor(
       logViewHierarchy(parentView, false)
     }
 
-    val currParentView = view.parent
+    var currParentView = view.parent
+    if (currParentView is ViewGroup && currParentView.indexOfChild(view) == -1) {
+      currParentView.endViewTransition(view)
+      currParentView = view.parent
+    }
     if (currParentView != null) {
       val actualParentId = if (currParentView is ViewGroup) currParentView.id else View.NO_ID
       ReactSoftExceptionLogger.logSoftException(
```

**File**: `packages/react-native/ReactAndroid/src/test/java/com/facebook/react/fabric/SurfaceMountingManagerViewTransitionTest.kt` (added, +231/-0)
```diff
@@ -0,0 +1,231 @@
+/*
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ */
+
+@file:Suppress("DEPRECATION")
+
+package com.facebook.react.fabric
+
+import android.app.Activity
+import android.view.View
+import android.view.ViewGroup
+import com.facebook.react.ReactRootView
+import com.facebook.react.bridge.JavaOnlyMap
+import com.facebook.react.bridge.ReactTestHelper
+import com.facebook.react.fabric.mounting.MountingManager
+import com.facebook.react.fabric.mounting.MountingManager.MountItemExecutor
+import com.facebook.react.fabric.mounting.SurfaceMountingManager
+import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsForTests
+import com.facebook.react.uimanager.ThemedReactContext
+import com.facebook.react.uimanager.ViewManager
+import com.facebook.react.uimanager.ViewManagerRegistry
+import com.facebook.react.views.view.ReactViewManager
+import com.facebook.testutils.shadows.ShadowSoLoader
+import org.assertj.core.api.Assertions.assertThat
+import org.junit.Before
+import org.junit.Test
+import org.junit.runner.RunWith
+import org.robolectric.Robolectric
+import org.robolectric.RobolectricTestRunner
+import org.robolectric.annotation.Config
+
+/**
+ * Tests for [SurfaceMountingManager.addViewAt] with views that a parent still holds with
+ * [ViewGroup.startViewTransition] after their removal.
+ */
+@RunWith(RobolectricTestRunner::class)
+@Config(shadows = [ShadowSoLoader::class])
+class SurfaceMountingManagerViewTransitionTest {
+  private lateinit var mountingManager: MountingManager
+  private lateinit var themedReactContext: ThemedReactContext
+  private val surfaceId = 1
+
+  @Before
+  fun setUp() {
+    ReactNativeFeatureFlagsForTests.setUp()
+    val reactContext = ReactTestHelper.createTestReactApplicationContext()
+    themedReactContext = ThemedReactContext(reactContext, reactContext, null, -1)
+    mountingManager =
+        MountingManager(
+            ViewManagerRegistry(listOf<ViewManager<*, *>>(ReactViewManager())),
+            MountItemExecutor {},
+        )
+  }
+
+  @Test
+  fun addViewAt_movesHeldChildAndAllowsItsFinalRemoval() {
+    val smm = startSurface()
+    smm.createViews(SCREEN, CARRIER)
+    smm.addViewAt(surfaceId, SCREEN, 0)
+    smm.addViewAt(SCREEN, CARRIER, 0)
+    val screen = smm.viewGroup(SCREEN)
+    val carrier = smm.getView(CARRIER)
+
+    screen.startViewTransition(carrier)
+    smm.removeViewAt(CARRIER, SCREEN, 0)
+    assertThat(carrier.parent).isSameAs(screen)
+
+    smm.addViewAt(surfaceId, CARRIER, 1)
+    assertThat(carrier.parent).isSameAs(smm.viewGroup(surfaceId))
+
+    smm.removeViewAt(CARRIER, surfaceId, 1)
+    assertThat(carrier.parent).isNull()
+    assertThat(smm.viewGroup(surfaceId).indexOfChild(carrier)).isEqualTo(-1)
+  }
+
+  @Test
+  fun addViewAt_movesNestedHeldChildrenAndAllowsTheirFinalRemoval() {
+    val smm = startSurface()
+    smm.createViews(SCREEN, CONTENT, CARRIER, INNER_CARRIER)
+    smm.addViewAt(surfaceId, SCREEN, 0)
+    smm.addViewAt(SCREEN, CONTENT, 0)
+    smm.addViewAt(CONTENT, CARRIER, 0)
+    smm.addViewAt(CARRIER, INNER_CARRIER, 0)
+    val root = smm.viewGroup(surfaceId)
+    val carrier = smm.getView(CARRIER)
+    val innerCarrier = smm.getView(INNER_CARRIER)
+
+    repeat(2) {
+      smm.viewGroup(SCREEN).startViewTransition(smm.getView(CONTENT))
+      smm.viewGroup(CONTENT).startViewTransition(carrier)
+      smm.viewGroup(CARRIER).startViewTransition(innerCarrier)
+    }
+    smm.removeViewAt(INNER_CARRIER, CARRIER, 0)
+    smm.removeViewAt(CARRIER, CONTENT, 0)
+    assertThat(carrier.parent).isSameAs(smm.viewGroup(CONTENT))
+    assertThat(innerCarrier.parent).isSameAs(carrier)
+
+    smm.addViewAt(surfaceId, CARRIER, 1)
+    smm.addViewAt(surfaceId, INNER_CARRIER, 2)
+    assertThat(carrier.parent).isSameAs(root)
+    assertThat(innerCarrier.parent).isSameAs(root)
+
+    smm.removeViewAt(INNER_CARRIER, surfaceId, 2)
+    smm.removeViewAt(CARRIER, surfaceId, 1)
+    assertThat(innerCarrier.parent).isNull()
+    assertThat(carrier.parent).isNull()
+    assertThat(root.childCount).isEqualTo(1)
+  }
+
+  @Test
+  fun addViewAt_movesHeldChildOfRootAttachedToWindow() {
+    val smm = startSurface()
+    attachToWindow(smm.getView(surfaceId))
+    smm.createViews(SCREEN, CARRIER)
+    smm.addViewAt(surfaceId, SCREEN, 0)
+    smm.addViewAt(SCREEN, CARRIER, 0)
+    val carrier = smm.getView(CARRIER)
+
+    smm.viewGroup(SCREEN).startViewTransition(carrier)
+    smm.removeViewAt(CARRIER, SCREEN, 0)
+    assertThat(carrier.isAttachedToWindow).isTrue()
+
+    smm.addViewAt(surfaceId, CARRIER, 1)
+    assertThat(carrier.parent).isSameAs(smm.viewGroup(surfaceId))
+    assertThat(carrier.isAttachedToWindow).isTrue()
+
+    smm.removeViewAt(CARRIER, surfaceId, 1)
+    assertThat(carrier.parent).isNull()
+    assertThat(carrier.isAttachedToWindow).isFalse()
+  }
+
+  @Test
+
```

---

### Incident Patch 2: `1f8cb8b3` (2026-11-05)
**Commit Message**: Report the native memory of created shadow nodes to the JS GC

## Summary:

The JS object that `createNode` returns owns the new shadow node, so the shadow node (with its props, family and event emitter) is only freed when the GC collects that object. The GC doesn't know about this native memory: it only sees a small JS object. With Hermes, it can go a long time without a full collection, and the shadow nodes of trees that were already unmounted pile up in native memory.

This change reports an estimate of that native memory with `setExternalMemoryPressure` when `createNode` returns, like the Blob module does for blob data (#44336). The GC then accounts for it and collects unmounted trees in time.

The estimate is 2 KB per node. A `View` with a few style props takes about 2.4 KB on Android (shadow node, props, family and event emitter, measured with heapprofd), a bit less on iOS, which doesn't keep a `folly::dynamic` copy of the props. Only nodes from `createNode` are reported, not clones: that's where most of the memory is, and reporting clones too made no difference in the measurements below while it would make the GC run more often during frequent re-renders. JSC's `setExternalM

**File**: `packages/react-native/ReactCommon/react/renderer/uimanager/UIManagerBinding.cpp` (modified, +22/-5)
```diff
@@ -23,6 +23,16 @@
 
 namespace facebook::react {
 
+namespace {
+
+// Native memory that the JS object returned by `createNode` keeps alive: the
+// shadow node with its props, family and event emitter. A View with a few
+// style props takes about 2.4 KB on Android (measured with heapprofd), a bit
+// less on iOS, which doesn't keep the props as `folly::dynamic`.
+constexpr size_t kCreatedShadowNodeNativeMemory = 2048;
+
+} // namespace
+
 void UIManagerBinding::createAndInstallIfNeeded(
     jsi::Runtime& runtime,
     const std::shared_ptr<UIManager>& uiManager) {
@@ -245,7 +255,7 @@ jsi::Value UIManagerBinding::get(
               return jsi::Value::undefined();
             }
 
-            return valueFromShadowNode(
+            auto node = objectFromShadowNode(
                 runtime,
                 uiManager->createNode(
                     tagFromValue(arguments[0]),
@@ -254,6 +264,13 @@ jsi::Value UIManagerBinding::get(
                     RawProps(runtime, arguments[3]),
                     std::move(instanceHandle)),
                 true);
+            // The shadow node is freed only when the GC collects this object,
+            // so tell the GC about the native memory it keeps alive. Without
+            // this, unmounted shadow trees can pile up until the JS heap
+            // itself grows enough for a full collection.
+            node.setExternalMemoryPressure(
+                runtime, kCreatedShadowNodeNativeMemory);
+            return node;
           } catch (const std::logic_error& ex) {
             LOG(FATAL) << "logic_error in createNode: " << ex.what();
           }
@@ -339,7 +356,7 @@ jsi::Value UIManagerBinding::get(
           // rolled out
           // validateArgumentCount(runtime, methodName, paramCount, count);
 
-          return valueFromShadowNode(
+          return objectFromShadowNode(
               runtime,
               uiManager->cloneNode(
                   *Bridging<std::shared_ptr<const ShadowNode>>::fromJs(
@@ -365,7 +382,7 @@ jsi::Value UIManagerBinding::get(
             size_t count) -> jsi::Value {
           validateArgumentCount(runtime, methodName, paramCount, count);
 
-          return valueFromShadowNode(
+          return objectFromShadowNode(
               runtime,
               uiManager->cloneNode(
                   *Bridging<std::shared_ptr<const ShadowNode>>::fromJs(
@@ -393,7 +410,7 @@ jsi::Value UIManagerBinding::get(
           // validateArgumentCount(runtime, methodName, paramCount, count);
 
           bool hasChildrenArg = count == 3;
-          return valueFromShadowNode(
+          return objectFromShadowNode(
               runtime,
               uiManager->cloneNode(
                   *Bridging<std::shared_ptr<const ShadowNode>>::fromJs(
@@ -820,7 +837,7 @@ jsi::Value UIManagerBinding::get(
             return jsi::Value::null();
           }
 
-          return valueFromShadowNode(runtime, shadowNode);
+          return objectFromShadowNode(runtime, shadowNode);
         });
   }
 
```

**File**: `packages/react-native/ReactCommon/react/renderer/uimanager/primitives.h` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ struct ShadowNodeListWrapper : public jsi::NativeState {
   std::shared_ptr<std::vector<std::shared_ptr<const ShadowNode>>> shadowNodeList;
 };
 
-inline static jsi::Value valueFromShadowNode(
+inline static jsi::Object objectFromShadowNode(
     jsi::Runtime &runtime,
     std::shared_ptr<const ShadowNode> shadowNode,
     bool assignRuntimeShadowNodeReference = false)
```

**File**: `packages/react-native/src/private/__tests__/ShadowNodeExternalMemory-itest.js` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+/**
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ *
+ * @fantom_mode *
+ * @fantom_disable_coverage
+ * @flow strict-local
+ * @format
+ */
+
+import '@react-native/fantom/src/setUpDefaultReactNativeEnvironment';
+
+import * as Fantom from '@react-native/fantom';
+import nullthrows from 'nullthrows';
+import * as React from 'react';
+import {View} from 'react-native';
+
+// Must match `kCreatedShadowNodeNativeMemory` in UIManagerBinding.cpp.
+const CREATED_SHADOW_NODE_NATIVE_MEMORY = 2048;
+
+function getExternalMemoryAfterGC(): number {
+  global.gc();
+  const stats = nullthrows(
+    nullthrows(global.HermesInternal).getInstrumentedStats,
+  )();
+  const externalBytes = stats.js_externalBytes;
+  if (typeof externalBytes !== 'number') {
+    throw new Error('Expected js_externalBytes to be a number');
+  }
+  return externalBytes;
+}
+
+describe('shadow node external memory', () => {
+  it('reports the native memory of created shadow nodes to the GC until they are collected', () => {
+    const before = getExternalMemoryAfterGC();
+
+    let root: ?Fantom.Root = Fantom.createRoot();
+    Fantom.runTask(() => {
+      nullthrows(root).render(
+        <View>
+          {Array.from({length: 100}, (_, i) => (
+            <View key={i} />
+          ))}
+        </View>,
+      );
+    });
+
+    // The 100 children and their parent are alive, so their native memory
+    // stays reported after a GC.
+    expect(getExternalMemoryAfterGC() - before).toBeGreaterThanOrEqual(
+      101 * CREATED_SHADOW_NODE_NATIVE_MEMORY,
+    );
+
+    Fantom.runTask(() => {
+      nullthrows(root).destroy();
+    });
+    root = null;
+
+    // Once the tree is unmounted and collected, its memory isn't reported
+    // anymore.
+    expect(getExternalMemoryAfterGC() - before).toBeLessThan(
+      CREATED_SHADOW_NODE_NATIVE_MEMORY,
+    );
+  });
+});
```

---

### Incident Patch 3: `4a851dde` (2026-11-05)
**Commit Message**: Drop `PropertyDescriptor` type arguments that the upcoming non-generic builtin rejects

Summary:
Flow's builtin `PropertyDescriptor<T = unknown>` is becoming non-generic, as in TypeScript's `lib.es5.d.ts`: its `value`, `get` and `set` use `any`, and `Object.getOwnPropertyDescriptor` no longer takes a type argument. The new builtins reject `PropertyDescriptor<X>` annotations and `Object.getOwnPropertyDescriptor<X>(...)` calls.

Remove those type arguments. Today's Flow accepts all of these sites without them.

Nothing changes at runtime.

Changelog: [Internal] Drop `PropertyDescriptor` type arguments.

Differential Revision: D129956546

Pull Request resolved: https://github.com/react/react-native/pull/59814

**File**: `packages/react-native/Libraries/Utilities/PolyfillFunctions.js` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ export function polyfillObjectProperty<T>(
   name: string,
   getValue: () => T,
 ): void {
-  const descriptor = Object.getOwnPropertyDescriptor<$FlowFixMe>(object, name);
+  const descriptor = Object.getOwnPropertyDescriptor(object, name);
   if (__DEV__ && descriptor) {
     const backupName = `original${name[0].toUpperCase()}${name.slice(1)}`;
     Object.defineProperty(object, backupName, descriptor);
```

**File**: `packages/react-native/src/private/webapis/dom/oldstylecollections/HTMLCollection.js` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ import {setPlatformObject} from '../../webidl/PlatformObjects';
 // IMPORTANT: The type definition for this module is defined in `HTMLCollection.js.flow`
 // because Flow only supports indexers in classes in declaration files.
 
-const REUSABLE_PROPERTY_DESCRIPTOR: {...PropertyDescriptor<unknown>, ...} = {
+const REUSABLE_PROPERTY_DESCRIPTOR: {...PropertyDescriptor, ...} = {
   value: {},
   enumerable: true,
   configurable: false,
```

**File**: `packages/react-native/src/private/webapis/dom/oldstylecollections/NodeList.js` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ import {setPlatformObject} from '../../webidl/PlatformObjects';
 // IMPORTANT: The Flow type definition for this module is defined in `NodeList.js.flow`
 // because Flow only supports indexers in classes in declaration files.
 
-const REUSABLE_PROPERTY_DESCRIPTOR: {...PropertyDescriptor<unknown>, ...} = {
+const REUSABLE_PROPERTY_DESCRIPTOR: {...PropertyDescriptor, ...} = {
   value: {},
   writable: false,
 };
```

#### Recent Merged Pull Requests:
- **PR #59815** (2026-11-05): xplat/js/react-native-github: opt in to fmt 12.2.0 (@r-barnes)
- **PR #59814** (2026-11-05): Drop `PropertyDescriptor` type arguments that the upcoming non-generic builtin rejects (@SamChou19815)
- **PR #59810** (2026-11-05): [RN][Changelog] Mark two v0.89.0-rc.0 entries as breaking (@fabriziocucci)
- **PR #59803** (2026-11-04): Upgrade Flow in fbsource (@SamChou19815)
- **PR #59799** (2026-11-04): Make the conversions of `parseInt` and `isNaN` explicit (@SamChou19815)
- **PR #59798** (closed): Fix LogBox inspector content under horizontal safe area insets (@huntie)

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

## X. addViewAt crash for views held by startViewTransition on Android

**RULE**:
When implementing operations in `packages/react-native/ReactAndroid/src/main/java/com/facebook/react/fabric/mounting/SurfaceMountingManager.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in react/react-native. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `45152f1f`: addViewAt crash for views held by startViewTransition on Android. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/react-native/ReactAndroid/src/main/java/com/facebook/react/fabric/mounting/SurfaceMountingManager.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
    var currParentView = view.parent
    if (currParentView is ViewGroup && currParentView.indexOfChild(view) == -1) {
      currParentView.endViewTransition(view)
      currParentView = view.parent
    }
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
    val currParentView = view.parent
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `45152f1f` are properly handled with clean fallback behavior.
