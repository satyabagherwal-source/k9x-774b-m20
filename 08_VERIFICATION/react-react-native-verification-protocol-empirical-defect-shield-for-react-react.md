# Verification Protocol: Verification Protocol: Empirical Defect Shield for react/react-native

<!-- PROVENANCE_START
{
  "source_repository": "react/react-native",
  "source_url": "https://github.com/react/react-native",
  "source_version": "cf7f3f39",
  "license": "MIT",
  "timestamp": "2026-11-18T09:28:34.167Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-react-react-native",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [react/react-native](https://github.com/react/react-native) (Revision: `cf7f3f39`).  
> **License**: MIT | **Timestamp**: `2026-11-18T09:28:34.167Z`  
> **Learning ID**: `learn-github-react-react-native`


## 1. Scope & Verification Target
- **Target Repository**: `react/react-native` (Commit: `cf7f3f39`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): react/react-native

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-react-native-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react/react-native](https://github.com/react/react-native))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-18T09:28:32.693Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react/react-native`
- **Description**: A framework for building native applications using React
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 126951 stars

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

const androidScaleSuffix /*: {[key: string]: string} */ = {
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
      if (typeof originalError === 'string') {
        this.stack = originalError;
      } else {
        const originalStack = originalError.stack;
        this.stack =
          originalStack == null || originalStack === ''
            ? ''.split('\n').slice(0, 2).join('\n')
            : originalStack;
      }
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

### Incident Patch 1: `2b60e633` (2026-11-17)
**Commit Message**: fix(android): don't preallocate a view that a commit already created

## Summary:

Fixes #60018, and I believe #58526 too.

The preallocation queue is drained on the UI thread, so a commit can get there first. If the commit creates a view and the next commit deletes it again (a View that is flattened right after it mounts, e.g. `opacity` set and cleared in a layout effect), `executeMount` adds the tag to `allocatedViewTags` and erases it before the drain runs. The drain then finds the tag missing, registers it as preallocated and creates the Java view, which the queued `DELETE` removes. The tag stays allocated in C++ with no view behind it. The next `CREATE` for that family is skipped, the inserts land in a view that doesn't exist, and the next `REMOVE` crashes with `Unable to find parentView for tag`.

This skips the drain for a family that is already part of a committed tree (`ShadowNodeFamily::hasBeenMounted()`). Its view belongs to `executeMount` from then on. The check runs under `allocatedViewsMutex_`, which `executeMount` takes after the commit has marked the family, so the two can't interleave in a way that brings the tag back. Views that haven't been committed yet are stil

**File**: `packages/react-native/ReactAndroid/src/main/jni/react/fabric/FabricMountingManager.cpp` (modified, +11/-1)
```diff
@@ -1092,7 +1092,17 @@ void FabricMountingManager::drainPreallocateViewsQueue() {
   {
     std::lock_guard allocatedViewsLock(allocatedViewsMutex_);
     for (auto& [shadowView, family] : queuedViews) {
-      if (pullModel && family.expired()) {
+      auto queuedFamily = family.lock();
+      if (pullModel && queuedFamily == nullptr) {
+        continue;
+      }
+      // Once a family is part of a committed tree, its view is executeMount's
+      // to create. The commit can run before this drain and both create and
+      // delete the view, e.g. when it is flattened again by the next commit;
+      // registering the tag now would leave it allocated with no view behind
+      // it, and its next Create would be skipped. executeMount takes
+      // allocatedViewsMutex_ after the commit has marked the family mounted.
+      if (queuedFamily != nullptr && queuedFamily->hasBeenMounted()) {
         continue;
       }
       auto allocatedViewsIterator =
```

**File**: `packages/react-native/ReactAndroid/src/main/jni/react/fabric/test_helper/FabricMountingManagerTestHelper.cpp` (modified, +29/-7)
```diff
@@ -222,9 +222,9 @@ void FabricMountingManagerTestHelper::drainPreallocationQueue() {
   mountingManager_->drainPreallocateViewsQueue();
 }
 
-void FabricMountingManagerTestHelper::executeCreateMutation(
+void FabricMountingManagerTestHelper::executeMutation(
     jint surfaceId,
-    jint tag) {
+    ShadowViewMutation mutation) {
   auto telemetry = TransactionTelemetry{};
   telemetry.willCommit();
   telemetry.willDiff();
@@ -233,11 +233,27 @@ void FabricMountingManagerTestHelper::executeCreateMutation(
   telemetry.didLayout();
   telemetry.didCommit();
   mountingManager_->executeMount(
-      MountingTransaction{
-          surfaceId,
-          0,
-          {ShadowViewMutation::CreateMutation(makeShadowView(surfaceId, tag))},
-          telemetry});
+      MountingTransaction{surfaceId, 0, {std::move(mutation)}, telemetry});
+}
+
+void FabricMountingManagerTestHelper::executeCreateMutation(
+    jint surfaceId,
+    jint tag) {
+  executeMutation(
+      surfaceId,
+      ShadowViewMutation::CreateMutation(makeShadowView(surfaceId, tag)));
+}
+
+void FabricMountingManagerTestHelper::executeDeleteMutation(
+    jint surfaceId,
+    jint tag) {
+  executeMutation(
+      surfaceId,
+      ShadowViewMutation::DeleteMutation(makeShadowView(surfaceId, tag)));
+}
+
+void FabricMountingManagerTestHelper::commitQueuedView(jint tag) {
+  queuedShadowNodes_.at(tag)->setMounted(true);
 }
 
 void FabricMountingManagerTestHelper::dropFamily(jint tag) {
@@ -495,6 +511,12 @@ void FabricMountingManagerTestHelper::registerNatives() {
       makeNativeMethod(
           "executeCreateMutation",
           FabricMountingManagerTestHelper::executeCreateMutation),
+      makeNativeMethod(
+          "executeDeleteMutation",
+          FabricMountingManagerTestHelper::executeDeleteMutation),
+      makeNativeMethod(
+          "commitQueuedView",
+          FabricMountingManagerTestHelper::commitQueuedView),
       makeNativeMethod(
           "dropFamily", FabricMountingManagerTestHelper::dropFamily),
       makeNativeMethod(
```

**File**: `packages/react-native/ReactAndroid/src/main/jni/react/fabric/test_helper/FabricMountingManagerTestHelper.h` (modified, +6/-0)
```diff
@@ -35,6 +35,10 @@ class FabricMountingManagerTestHelper : public jni::HybridClass<FabricMountingMa
   void queuePreallocation(jint surfaceId, jint tag);
   void drainPreallocationQueue();
   void executeCreateMutation(jint surfaceId, jint tag);
+  void executeDeleteMutation(jint surfaceId, jint tag);
+  // Marks the family of a view queued by queuePreallocation as part of a
+  // committed tree, as ShadowTree's commit does.
+  void commitQueuedView(jint tag);
   void dropFamily(jint tag);
   void destroyUnmountedView(jint surfaceId, jint tag);
   void destroyCommittedView(jint surfaceId, jint tag);
@@ -66,6 +70,8 @@ class FabricMountingManagerTestHelper : public jni::HybridClass<FabricMountingMa
 
   explicit FabricMountingManagerTestHelper(jni::alias_ref<JFabricUIManager::javaobject> jFabricUIManager);
 
+  void executeMutation(jint surfaceId, ShadowViewMutation mutation);
+
   static void initHybrid(
       jni::alias_ref<jhybridobject> jobj,
       jni::alias_ref<JFabricUIManager::javaobject> jFabricUIManager);
```

**File**: `packages/react-native/ReactAndroid/src/test/java/com/facebook/react/fabric/FabricMountingManagerInstrumentationTest.kt` (modified, +31/-0)
```diff
@@ -459,6 +459,37 @@ class FabricMountingManagerInstrumentationTest {
     assertThat(helper.isTagAllocated(surfaceId, 42)).isFalse()
   }
 
+  /**
+   * A commit can create and delete a view before the queue drains, when the view is flattened again
+   * by the next commit. The drain must not register the tag again: its next Create would be skipped
+   * and the view would never exist.
+   */
+  @Test
+  fun native_drainPreallocationQueue_skipsViewThatACommitCreatedAndDeleted() {
+    val helper = createTestHelper()
+    helper.startSurface(surfaceId)
+    helper.queuePreallocation(surfaceId, 42)
+    helper.commitQueuedView(42)
+    helper.executeCreateMutation(surfaceId, 42)
+    helper.executeDeleteMutation(surfaceId, 42)
+
+    helper.drainPreallocationQueue()
+
+    assertThat(helper.isTagAllocated(surfaceId, 42)).isFalse()
+  }
+
+  /** A view that no commit has taken yet is still preallocated. */
+  @Test
+  fun native_drainPreallocationQueue_preallocatesViewNotYetCommitted() {
+    val helper = createTestHelper()
+    helper.startSurface(surfaceId)
+    helper.queuePreallocation(surfaceId, 42)
+
+    helper.drainPreallocationQueue()
+
+    assertThat(helper.isTagAllocated(surfaceId, 42)).isTrue()
+  }
+
   /** Without the pull model, a committed family does not destroy its view. */
   @Test
   fun native_destroyCommittedView_keepsPreallocatedView() {
```

**File**: `packages/react-native/ReactAndroid/src/test/java/com/facebook/react/fabric/FabricMountingManagerTestHelper.kt` (modified, +4/-0)
```diff
@@ -41,6 +41,10 @@ private constructor(fabricUIManager: FabricUIManager) : HybridClassBase() {
 
   external fun executeCreateMutation(surfaceId: Int, tag: Int)
 
+  external fun executeDeleteMutation(surfaceId: Int, tag: Int)
+
+  external fun commitQueuedView(tag: Int)
+
   external fun dropFamily(tag: Int)
 
   external fun destroyUnmountedView(surfaceId: Int, tag: Int)
```

---

### Incident Patch 2: `bfea95fb` (2026-11-17)
**Commit Message**: Keep the iOS renderer scheduler alive through instance shutdown

## Summary

Fixes #59721.

During a normal bridgeless reload, `RCTInstance::invalidate` suspends the surface presenter before JS-thread cleanup runs. Suspension can destroy the renderer scheduler and its delegate proxy while the current JS task still has rendering updates capturing the proxy by raw pointer.

Retain the scheduler through that cleanup, and clear its Objective-C delegate after stopping surfaces. Before dispatching cleanup, permanently remove its layout-animation run-loop observer on main. Scheduler destruction then stays in the same JS cleanup block as runtime destruction, with the scheduler released first. This prevents both an observer callout racing teardown and queued JSI handles outliving the runtime. It adds no per-rendering-callback guard, synchronous main wait, or JS-to-main-to-JS destruction round trip.

Add three native lifecycle tests, the required CocoaPods Yoga header dependency for the scheduler import, and regenerated Apple API snapshots.

## Changelog

[IOS] [FIXED] - Prevent a queued view command from accessing a destroyed scheduler delegate during a normal bridgeless reload

## Test Pla

**File**: `packages/react-native/React/Fabric/RCTScheduler.h` (modified, +3/-0)
```diff
@@ -62,6 +62,9 @@ NS_ASSUME_NONNULL_BEGIN
 
 - (void)setupAnimationDriver:(const facebook::react::SurfaceHandler &)surfaceHandler;
 
+// Permanently removes the layout-animation observer. Call on the main queue.
+- (void)stopObservingLayoutAnimations;
+
 - (void)onAnimationStarted;
 
 - (void)onAllAnimationsComplete;
```

**File**: `packages/react-native/React/Fabric/RCTScheduler.mm` (modified, +7/-0)
```diff
@@ -8,6 +8,7 @@
 #import "RCTScheduler.h"
 
 #import <QuartzCore/CADisplayLink.h>
+#import <React/RCTAssert.h>
 #import <cxxreact/TraceSection.h>
 #import <react/featureflags/ReactNativeFeatureFlags.h>
 #import <react/renderer/animations/LayoutAnimationDriver.h>
@@ -258,6 +259,12 @@ - (void)setupAnimationDriver:(const facebook::react::SurfaceHandler &)surfaceHan
   surfaceHandler.getMountingCoordinator()->setMountingOverrideDelegate(_animationDriver);
 }
 
+- (void)stopObservingLayoutAnimations
+{
+  RCTAssertMainQueue();
+  _uiRunLoopObserver.reset();
+}
+
 - (void)onAnimationStarted
 {
   if (_uiRunLoopObserver) {
```

**File**: `packages/react-native/React/Fabric/RCTSurfacePresenter.mm` (modified, +1/-0)
```diff
@@ -234,6 +234,7 @@ - (BOOL)suspend
   }
 
   [self _stopAllSurfacesWithScheduler:scheduler];
+  scheduler.delegate = nil;
 
   return YES;
 }
```

**File**: `packages/react-native/ReactCommon/react/runtime/platform/ios/React-RuntimeApple.podspec` (modified, +2/-0)
```diff
@@ -18,6 +18,7 @@ end
 
 header_search_paths = [
   "$(PODS_ROOT)/Headers/Private/React-Core",
+  "$(PODS_ROOT)/Headers/Private/Yoga",
   "$(PODS_TARGET_SRCROOT)/../../../..",
   "$(PODS_TARGET_SRCROOT)/../../../../..",
 ]
@@ -50,6 +51,7 @@ Pod::Spec.new do |s|
   s.dependency "React-CoreModules"
   s.dependency "React-NativeModulesApple"
   s.dependency "React-RCTFabric"
+  s.dependency "Yoga"
   s.dependency "React-RuntimeCore"
   s.dependency "React-Mapbuffer"
   s.dependency "React-jserrorhandler"
```

**File**: `packages/react-native/ReactCommon/react/runtime/platform/ios/ReactCommon/RCTInstance.mm` (modified, +30/-21)
```diff
@@ -29,6 +29,7 @@
 #import <React/RCTLogBox.h>
 #import <React/RCTPerformanceLogger.h>
 #import <React/RCTRedBox.h>
+#import <React/RCTScheduler.h>
 #import <React/RCTSurfacePresenter.h>
 #import <ReactCommon/RCTTurboModule.h>
 #import <ReactCommon/RCTTurboModuleManager.h>
@@ -206,28 +207,36 @@ - (void)invalidate
   }
   // suspend shouldn't be called under _invalidationMutex: it notifies surface observers,
   // which can call callFunctionOnJSModule and deadlock on the same mutex.
+  // Queued rendering updates capture the scheduler's delegate by raw pointer.
+  // Stop its run-loop observer on main, but keep it alive until queued JS work
+  // has drained. Release it before the runtime so its queued JSI handles remain valid.
+  __block RCTScheduler *scheduler = _surfacePresenter.scheduler;
   [_surfacePresenter suspend];
-  [_jsThreadManager dispatchToJSThread:^{
-    /**
-     * Every TurboModule is invalidated on its own method queue.
-     * TurboModuleManager invalidate blocks the calling thread until all TurboModules are invalidated.
-     */
-    [self->_turboModuleManager invalidate];
-
-    // Clean up all the Resources
-    self->_reactInstance = nullptr;
-    self->_jsRuntimeFactory = nullptr;
-    self->_appTMMDelegate = nil;
-    self->_delegate = nil;
-    [self->_displayLink invalidate];
-    self->_displayLink = nil;
-
-    self->_turboModuleManager = nil;
-    self->_performanceLogger = nil;
-
-    // Terminate the JavaScript thread, so that no other work executes after this block.
-    self->_jsThreadManager = nil;
-  }];
+  RCTExecuteOnMainQueue(^{
+    [scheduler stopObservingLayoutAnimations];
+    [self->_jsThreadManager dispatchToJSThread:^{
+      /**
+       * Every TurboModule is invalidated on its own method queue.
+       * TurboModuleManager invalidate blocks the calling thread until all TurboModules are invalidated.
+       */
+      [self->_turboModuleManager invalidate];
+
+      // Clean up all the Resources
+      scheduler = nil;
+      self->_reactInstance = nullptr;
+      self->_jsRuntimeFactory = nullptr;
+      self->_appTMMDelegate = nil;
+      self->_delegate = nil;
+      [self->_displayLink invalidate];
+      self->_displayLink = nil;
+
+      self->_turboModuleManager = nil;
+      self->_performanceLogger = nil;
+
+      // Terminate the JavaScript thread, so that no other work executes after this block.
+      self->_jsThreadManager = nil;
+    }];
+  });
 }
 
 - (std::shared_ptr<CallInvoker>)jsCallInvoker
```

**File**: `packages/rn-tester/RNTesterPods.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -51,6 +51,7 @@
 		F0D621C32BBB9E38005960AC /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = F0D621C22BBB9E38005960AC /* PrivacyInfo.xcprivacy */; };
 		F1A0B1C23D4E5F6071829302 /* RCTTurboModuleArrayBufferTests.mm in Sources */ = {isa = PBXBuildFile; fileRef = F1A0B1C23D4E5F6071829301 /* RCTTurboModuleArrayBufferTests.mm */; };
 		F1A0B1C23D4E5F6071829322 /* RCTTurboModuleStringConversionTests.mm in Sources */ = {isa = PBXBuildFile; fileRef = F1A0B1C23D4E5F6071829321 /* RCTTurboModuleStringConversionTests.mm */; };
+		F1A0B1C23D4E5F6071829342 /* RCTInstanceInvalidationTests.mm in Sources */ = {isa = PBXBuildFile; fileRef = F1A0B1C23D4E5F6071829341 /* RCTInstanceInvalidationTests.mm */; };
 		D1A60AD11B9247A080734F02 /* RCTDevLoadingViewTests.m in Sources */ = {isa = PBXBuildFile; fileRef = D1A60AD11B9247A080734F01 /* RCTDevLoadingViewTests.m */; };
 /* End PBXBuildFile section */
 
@@ -150,6 +151,7 @@
 		F0D621C22BBB9E38005960AC /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };
 		F1A0B1C23D4E5F6071829301 /* RCTTurboModuleArrayBufferTests.mm */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.cpp.objcpp; path = RCTTurboModuleArrayBufferTests.mm; sourceTree = "<group>"; };
 		F1A0B1C23D4E5F6071829321 /* RCTTurboModuleStringConversionTests.mm */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.cpp.objcpp; path = RCTTurboModuleStringConversionTests.mm; sourceTree = "<group>"; };
+		F1A0B1C23D4E5F6071829341 /* RCTInstanceInvalidationTests.mm */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.cpp.objcpp; path = RCTInstanceInvalidationTests.mm; sourceTree = "<group>"; };
 		D1A60AD11B9247A080734F01 /* RCTDevLoadingViewTests.m */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.objc; path = RCTDevLoadingViewTests.m; sourceTree = "<group>"; };
 /* End PBXFileReference section */
 
@@ -311,6 +313,7 @@
 				E7DB20CB22B2BAA5005AC45F /* RCTModuleMethodTests.mm */,
 				F1A0B1C23D4E5F6071829301 /* RCTTurboModuleArrayBufferTests.mm */,
 				F1A0B1C23D4E5F6071829321 /* RCTTurboModuleStringConversionTests.mm */,
+				F1A0B1C23D4E5F6071829341 /* RCTInstanceInvalidationTests.mm */,
 				E7DB20CF22B2BAA5005AC45F /* RCTMultipartStreamReaderTests.m */,
 				A975CA6B2C05EADE0043F72A /* RCTNetworkTaskTests.m */,
 				E7DB20BE22B2BAA4005AC45F /* RCTNativeAnimatedNodesManagerTests.m */,
@@ -623,6 +626,7 @@
 				E7DB20E822B2BAA6005AC45F /* RCTModuleMethodTests.mm in Sources */,
 				F1A0B1C23D4E5F6071829302 /* RCTTurboModuleArrayBufferTests.mm in Sources */,
 				F1A0B1C23D4E5F6071829322 /* RCTTurboModuleStringConversionTests.mm in Sources */,
+				F1A0B1C23D4E5F6071829342 /* RCTInstanceInvalidationTests.mm in Sources */,
 				E7DB20E222B2BAA6005AC45F /* RCTGzipTests.m in Sources */,
 				E7DB20ED22B2BAA6005AC45F /* RCTURLUtilsTests.m in Sources */,
 				E7DB20D322B2BAA6005AC45F /* RCTBlobManagerTests.m in Sources */,
```

**File**: `packages/rn-tester/RNTesterUnitTests/RCTInstanceInvalidationTests.mm` (added, +196/-0)
```diff
@@ -0,0 +1,196 @@
+/*
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ */
+
+#import <CoreFoundation/CoreFoundation.h>
+#import <XCTest/XCTest.h>
+
+#import <React/RCTSurfacePresenter.h>
+#import <ReactCommon/RCTInstance.h>
+
+@interface RCTSchedulerLifetimeProbe : NSObject
+@property (nonatomic, weak) id delegate;
+@property (nonatomic, copy) void (^onDealloc)(BOOL onMainThread);
+@property (nonatomic, copy) void (^onStopObserving)(BOOL onMainThread);
+@property (nonatomic, copy) dispatch_block_t onTick;
+- (void)startObserving;
+- (void)stopObservingLayoutAnimations;
+@end
+
+@implementation RCTSchedulerLifetimeProbe {
+  CFRunLoopObserverRef _observer;
+}
+
+- (void)startObserving
+{
+  void *unretainedSelf = (__bridge void *)self;
+  _observer = CFRunLoopObserverCreateWithHandler(
+      kCFAllocatorDefault, kCFRunLoopBeforeWaiting, true, 0, ^(CFRunLoopObserverRef, CFRunLoopActivity) {
+        __unsafe_unretained RCTSchedulerLifetimeProbe *probe = (__bridge RCTSchedulerLifetimeProbe *)unretainedSelf;
+        dispatch_block_t tick = probe.onTick;
+        if (tick) {
+          tick();
+        }
+      });
+  CFRunLoopAddObserver(CFRunLoopGetMain(), _observer, kCFRunLoopCommonModes);
+}
+
+- (void)stopObservingLayoutAnimations
+{
+  if (_observer) {
+    CFRunLoopRemoveObserver(CFRunLoopGetMain(), _observer, kCFRunLoopCommonModes);
+    CFRelease(_observer);
+    _observer = nullptr;
+  }
+  if (_onStopObserving) {
+    _onStopObserving([NSThread isMainThread]);
+  }
+}
+
+- (void)dealloc
+{
+  if (_observer) {
+    CFRunLoopRemoveObserver(CFRunLoopGetMain(), _observer, kCFRunLoopCommonModes);
+    CFRelease(_observer);
+  }
+  if (_onDealloc) {
+    _onDealloc([NSThread isMainThread]);
+  }
+}
+@end
+
+@interface RCTJSThreadManagerStub : NSObject
+@property (nonatomic, copy) dispatch_block_t pendingWork;
+@end
+
+@implementation RCTJSThreadManagerStub
+- (void)dispatchToJSThread:(dispatch_block_t)work
+{
+  self.pendingWork = work;
+}
+@end
+
+@interface RCTInstanceInvalidationTests : XCTestCase
+@end
+
+@implementation RCTInstanceInvalidationTests
+
+- (void)runJSWork:(dispatch_block_t)work
+{
+  dispatch_semaphore_t finished = dispatch_semaphore_create(0);
+  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
+    @autoreleasepool {
+      work();
+    }
+    dispatch_semaphore_signal(finished);
+  });
+  XCTAssertEqual(dispatch_semaphore_wait(finished, dispatch_time(DISPATCH_TIME_NOW, 3 * NSEC_PER_SEC)), 0);
+}
+
+- (void)testInvalidateStopsObserverOnMainAndReleasesSchedulerDuringJSCleanup
+{
+  XCTAssertTrue([NSThread isMainThread]);
+  RCTSurfacePresenter *presenter = [RCTSurfacePresenter new];
+  RCTJSThreadManagerStub *jsThreadManager = [RCTJSThreadManagerStub new];
+  RCTInstance *instance = [RCTInstance new];
+  [instance setValue:presenter forKey:@"surfacePresenter"];
+  [instance setValue:jsThreadManager forKey:@"jsThreadManager"];
+
+  XCTestExpectation *released = [self expectationWithDescription:@"Scheduler released during JS cleanup"];
+  __block BOOL observerStoppedOnMain = NO;
+  __block BOOL releasedBeforeJSThreadCleanup = NO;
+  __weak RCTInstance *weakInstance = instance;
+  __weak RCTSchedulerLifetimeProbe *weakScheduler;
+  @autoreleasepool {
+    RCTSchedulerLifetimeProbe *scheduler = [RCTSchedulerLifetimeProbe new];
+    scheduler.delegate = presenter;
+    scheduler.onStopObserving = ^(BOOL onMainThread) {
+      observerStoppedOnMain = onMainThread;
+    };
+    scheduler.onDealloc = ^(BOOL) {
+      releasedBeforeJSThreadCleanup = [weakInstance valueForKey:@"jsThreadManager"] != nil;
+      [released fulfill];
+    };
+    weakScheduler = scheduler;
+    // Exercise real instance invalidation and presenter suspension without a JS VM.
+    [presenter setValue:scheduler forKey:@"scheduler"];
+  }
+
+  @autoreleasepool {
+    [instance invalidate];
+    XCTAssertNil(presenter.scheduler);
+    XCTAssertNotNil(weakScheduler);
+    XCTAssertNil(weakScheduler.delegate);
+    XCTAssertNotNil(jsThreadManager.pendingWork);
+    XCTAssertTrue(observerStoppedOnMain);
+  }
+
+  dispatch_block_t drainWork = jsThreadManager.pendingWork;
+  [self runJSWork:drainWork];
+
+  [self waitForExpectations:@[ released ] timeout:3];
+  XCTAssertTrue(releasedBeforeJSThreadCleanup);
+  // Keeping the cleanup block itself must not keep the scheduler alive.
+  XCTAssertNil(weakScheduler);
+  XCTAssertNil([instance valueForKey:@"jsThreadManager"]);
+  jsThreadManager.pendingWork = nil;
+}
+
+- (void)testStoppedObserverDoesNotRunWhileWaitingForJSCleanup
+{
+  XCTAssertTrue([NSThread isMainThread]);
+  RCTSurfacePresenter *presenter = [RCTSurfacePresenter new];
+  RCTJSThreadManagerStub *jsThreadManager = [RCTJSThreadManagerStub new];
+  RCTInstance *instance = [RCTInstance new];
+  [instance setValue:presenter forKey:@"surfacePresenter"];
+  [i
```

**File**: `scripts/cxx-api/api-snapshots/ReactAppleDebugCxx.api` (modified, +1/-0)
```diff
@@ -1614,6 +1614,7 @@ interface RCTScheduler : public NSObject {
   public virtual void removeEventListener:(const std::shared_ptr<facebook::react::EventListener>& listener);
   public virtual void reportMount:(facebook::react::SurfaceId surfaceId);
   public virtual void setupAnimationDriver:(const facebook::react::SurfaceHandler& surfaceHandler);
+  public virtual void stopObservingLayoutAnimations();
   public virtual void unregisterSurface:(const facebook::react::SurfaceHandler& surfaceHandler);
 }
 
```

---

### Incident Patch 3: `2a7b305c` (2026-11-17)
**Commit Message**: [visual testing] open-example: Wait for RNTester to render before linking

RNTester ignores a deep link until its JS has rendered, but `open-example.yml` only waits for animations to end - which on a fresh iOS simulator happens ~1.4s after relaunch, before RNTester takes links at ~2.7s. Since #59994 sent the link once on iOS, 17 of 25 iOS capture jobs had a flow fail its first attempt this way (29 failures across almost every flow), and in one job the retries ran out.

This waits for the "Components" label in RNTester's tab bar, which is on every screen including a restored example, before linking. The five button and switch flows that only waited for `example-container` - which a restored previous example also has, so a missed link could screenshot the wrong screen - now wait for an element only their example has.

Changelog: [Internal]

Test plan:
Ran every visual flow once (no Maestro retries) on a freshly erased iPhone 17 Pro simulator (iOS 27) with RNTester Release from CI. Locally the drop is deterministic:

| Before the link | Result |
|---|---|
| `main` (wait for animations) | All 12 flows failed |
| This PR (wait for "Components") | All 12 flows passed, 3/3 runs, ~8 min ea

**File**: `packages/rn-tester/visual-tests/README.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ The baseline for a PR is the one for the commit it's based on, or the nearest ea
          id: 'text-width-mode-example'
    ```
 
-   `open-example.yml` deep-links to `rntester://example/<module>/<example>`. Wait for something that's only visible once the example has rendered, and crop to the example's `testID` so that the status bar and surrounding UI aren't part of the screenshot.
+   `open-example.yml` deep-links to `rntester://example/<module>/<example>`. Wait for something that's only visible once the example has rendered, and that only this example has (not the generic `example-container`, which a restored previous example also has), and crop to the example's `testID` so that the status bar and surrounding UI aren't part of the screenshot.
 
 3. Open a PR. The new test has no baseline yet, so the report lists it as new, and like any other difference it needs a maintainer's approval (see below). Once the PR lands, `main` is captured with it and later PRs are compared against that.
 
```

**File**: `packages/rn-tester/visual-tests/flows/button.yml` (modified, +4/-4)
```diff
@@ -6,7 +6,7 @@ appId: ${APP_ID}
       EXAMPLE_URL: rntester://example/ButtonExample/default-styling
 - extendedWaitUntil:
     visible:
-      id: 'example-container'
+      id: 'button_default_styling'
     timeout: 15000
 - waitForAnimationToEnd:
     timeout: 5000
@@ -20,7 +20,7 @@ appId: ${APP_ID}
       EXAMPLE_URL: rntester://example/ButtonExample/disabled
 - extendedWaitUntil:
     visible:
-      id: 'example-container'
+      id: 'disabled_button'
     timeout: 15000
 - waitForAnimationToEnd:
     timeout: 5000
@@ -34,7 +34,7 @@ appId: ${APP_ID}
       EXAMPLE_URL: rntester://example/ButtonExample/color-red
 - extendedWaitUntil:
     visible:
-      id: 'example-container'
+      id: 'cancel_button'
     timeout: 15000
 - waitForAnimationToEnd:
     timeout: 5000
@@ -48,7 +48,7 @@ appId: ${APP_ID}
       EXAMPLE_URL: rntester://example/ButtonExample/two-buttons-flexbox
 - extendedWaitUntil:
     visible:
-      id: 'example-container'
+      id: 'two_cancel_button'
     timeout: 15000
 - waitForAnimationToEnd:
     timeout: 5000
```

**File**: `packages/rn-tester/visual-tests/flows/switch.yml` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ appId: ${APP_ID}
       EXAMPLE_URL: rntester://example/SwitchExample/disabled
 - extendedWaitUntil:
     visible:
-      id: 'example-container'
+      id: 'disabled-initial-off'
     timeout: 15000
 - assertVisible:
     id: 'disabled-initial-off'
```

**File**: `packages/rn-tester/visual-tests/helpers/open-example.yml` (modified, +7/-12)
```diff
@@ -2,20 +2,15 @@ appId: ${APP_ID} # iOS: com.meta.RNTester.localDevelopment | Android: com.facebo
 ---
 - launchApp:
     stopApp: true
-- waitForAnimationToEnd:
+# RNTester ignores links until its JS has rendered, which waiting for
+# animations to end doesn't guarantee. Its tab bar shows "Components" on every
+# screen, including a restored example. Optional, so that a missed link fails
+# at the flow's own check for its example instead.
+- extendedWaitUntil:
+    visible: 'Components'
     timeout: 30000
+    optional: true
 - openLink: ${EXAMPLE_URL}
-# On a slow Android emulator, the first link can arrive before the JS Linking
-# listener is registered and be dropped, so Android sends it again once settled.
-# On iOS, each link raises an "Open in RNTester?" dialog, so it's sent once and
-# accepted. A second, unaccepted dialog leaves RNTester on the previous screen.
-- runFlow:
-    when:
-      platform: Android
-    commands:
-      - waitForAnimationToEnd:
-          timeout: 15000
-      - openLink: ${EXAMPLE_URL}
 - runFlow:
     when:
       platform: iOS
```

#### Recent Merged Pull Requests:
- **PR #60103** (closed): Reuse parsed text attributes on Android behind a feature flag (@hryhoriiK97)
- **PR #60101** (2026-11-18): Name function type params and label dictionary keys in Flow libdefs (@SamChou19815)
- **PR #60096** (2026-11-17): Tolerate unchanged layout metrics on sealed shared nodes (@adityasharat)
- **PR #60088** (2026-11-17): Preserve the original Fantom spawn error (@jipeng6036-del)
- **PR #60082** (2026-11-17): Release Yoga ownership of children an unowned node shares with its clone (@javache)
- **PR #60078** (2026-11-17): [iOS] Sync drifted internal fixes for the status bar stub and scroll content view (@javache)

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

## X. android): don't preallocate a view that a commit already created

**RULE**:
When implementing operations in `packages/react-native/ReactAndroid/src/main/jni/react/fabric/FabricMountingManager.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in react/react-native. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2b60e633`: android): don't preallocate a view that a commit already created. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/react-native/ReactAndroid/src/main/jni/react/fabric/FabricMountingManager.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
      auto queuedFamily = family.lock();
      if (pullModel && queuedFamily == nullptr) {
        continue;
      }
      // Once a family is part of a committed tree, its view is executeMount's
      // to create. The commit can run before this drain and both create and
      // delete the view, e.g. when it is flattened again by the next commit;
      // registering the tag now would leave it allocated with no view behind
      // it, and its next Create would be skipped. executeMount takes
      // allocatedViewsMutex_ after the commit has marked the family mounted.
      if (queuedFamily != nullptr && queuedFamily->hasBeenMounted()) {
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
      if (pullModel && family.expired()) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2b60e633` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
