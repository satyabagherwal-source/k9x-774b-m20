> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/react-react-native-learnings.md`  
> **Source**: github ([https://github.com/react/react-native](https://github.com/react/react-native))  
> **Source Version**: `edf2b86e`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-03T23:32:16.939Z  
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
> **Harvest Timestamp**: 2026-11-03T23:32:16.774Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react/react-native`
- **Description**: A framework for building native applications using React
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 126853 stars

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
          : originalError.stack || ''.split('\n').slice(0, 2).join('\n');
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

### Incident Patch 1: `debaf42c` (2026-11-02)
**Commit Message**: Fix iOS Fabric unmount assertions for zero-sized recycled views

## Summary:

Related to #59166. This change addresses the unmount comparison; it does not reset container state during recycling.

Unmounting a zero-sized recycled `View` can fail with `Attempt to unmount a view which is mounted inside a different view`, even when the exception reports the parent's own tag as the existing parent.

A previous owner can leave the native view with a clipping container, for example when using `overflow: 'hidden'` with an outline. Fabric can mount descendants before applying the recycled parent's new props. If those props no longer require the container and the view has zero bounds, layer invalidation returns without migrating the children back.

`currentContainerView` performs that migration lazily. The unmount assertion compares `childComponentView.superview == self.currentContainerView`, so evaluation can read the child's old superview before the getter moves it. By the time the exception message is formatted, the child can already belong to the expected parent.

Resolve the container in a separate statement before reading `superview` in the assertions. The reconciliation also runs when

**File**: `packages/react-native/React/Fabric/Mounting/ComponentViews/View/RCTViewComponentView.mm` (modified, +5/-2)
```diff
@@ -243,21 +243,24 @@ - (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)childCompo
   if (_removeClippedSubviews) {
     [_reactSubviews removeObjectAtIndex:index];
   } else {
+    // This getter can migrate children from a recycled clipping container.
+    // Reconcile before reading superview, even when assertions are disabled.
+    [[maybe_unused]] UIView *containerView = self.currentContainerView;
     RCTAssert(
         childComponentView.superview != nil,
         @"Attempt to unmount a view which is not mounted. (parent: %@, child: %@, index: %@)",
         self,
         childComponentView,
         @(index));
     RCTAssert(
-        childComponentView.superview == self.currentContainerView,
+        childComponentView.superview == containerView,
         @"Attempt to unmount a view which is mounted inside a different view. (parent: %@, child: %@, index: %@, existing parent: %@)",
         self,
         childComponentView,
         @(index),
         @([childComponentView.superview tag]));
 #ifndef NS_BLOCK_ASSERTIONS
-    NSArray<UIView *> *containerSubviews = self.currentContainerView.subviews;
+    NSArray<UIView *> *containerSubviews = containerView.subviews;
     BOOL isIndexInBounds = index >= 0 && (NSUInteger)index < containerSubviews.count;
     RCTAssert(
         isIndexInBounds && [containerSubviews objectAtIndex:index] == childComponentView,
```

**File**: `packages/react-native/React/Tests/Mounting/RCTViewComponentViewUnmountTests.mm` (modified, +53/-0)
```diff
@@ -8,6 +8,9 @@
 #import <React/RCTAssert.h>
 #import <React/RCTViewComponentView.h>
 #import <XCTest/XCTest.h>
+#import <react/renderer/components/view/ViewProps.h>
+
+using namespace facebook::react;
 
 @interface RCTViewComponentViewUnmountTests : XCTestCase
 @end
@@ -83,4 +86,54 @@ - (void)testUnmountWithInBoundsMismatchStillReportsTagAtIndex
   XCTAssertNotEqualObjects(thrownName, NSRangeException);
 }
 
+// A recycled view can receive children before its own props are updated. If
+// the new owner is zero-sized, layer invalidation does not reconcile the old
+// clipping container. Unmount must do so before checking the child's parent.
+- (void)testUnmountReconcilesRecycledContainerAtZeroSize
+{
+  RCTViewComponentView *parent = [[RCTViewComponentView alloc] initWithFrame:CGRectZero];
+  auto clippingProps = std::make_shared<ViewProps>();
+  clippingProps->yogaStyle.setOverflow(facebook::yoga::Overflow::Hidden);
+  clippingProps->outlineWidth = 1;
+  [parent updateProps:clippingProps oldProps:parent.props];
+  [parent finalizeUpdates:RNComponentViewUpdateMaskAll];
+
+  RCTViewComponentView *previousChild = [RCTViewComponentView new];
+  [parent mountChildComponentView:previousChild index:0];
+  UIView *previousContainer = previousChild.superview;
+  XCTAssertNotEqual(previousContainer, parent);
+  XCTAssertNotNil(previousContainer);
+  [parent unmountChildComponentView:previousChild index:0];
+  [parent prepareForRecycle];
+
+  // Fabric mounts descendants before applying the recycled parent's new props.
+  RCTViewComponentView *child = [RCTViewComponentView new];
+  [parent mountChildComponentView:child index:0];
+  [parent updateProps:std::make_shared<ViewProps>() oldProps:parent.props];
+  [parent finalizeUpdates:RNComponentViewUpdateMaskAll];
+  XCTAssertTrue(CGSizeEqualToSize(parent.bounds.size, CGSizeZero));
+  XCTAssertEqual(child.superview, previousContainer);
+
+  NSString *message = nil;
+  NSString *thrownName = RCTUnmountAndReportAssert(parent, child, 0, &message);
+
+  XCTAssertNil(message, @"Container migration must precede the ownership check");
+  XCTAssertNil(thrownName);
+  XCTAssertNil(child.superview);
+  XCTAssertNil(previousContainer.superview, @"The stale container must be removed");
+}
+
+- (void)testUnmountStillReportsChildMountedUnderAnotherParent
+{
+  RCTViewComponentView *parent = [RCTViewComponentView new];
+  RCTViewComponentView *otherParent = [RCTViewComponentView new];
+  RCTViewComponentView *child = [RCTViewComponentView new];
+  [otherParent mountChildComponentView:child index:0];
+
+  NSString *message = nil;
+  RCTUnmountAndReportAssert(parent, child, 0, &message);
+
+  XCTAssertTrue([message containsString:@"mounted inside a different view"]);
+}
+
 @end
```

---

### Incident Patch 2: `edf2b86e` (2026-11-03)
**Commit Message**: Reland iOS 27 StatusBar fix with tvOS guards (#59542)

Summary:

Fixes https://github.com/react/react-native/issues/58758.

Apps built with the iOS 27 SDK can no longer change the status bar through the `UIApplication` setters. Restore the view-controller-based implementation: `RCTStatusBarAppearance` stores the requested style, hidden state and animation, and the default root and Fabric modal controllers return those values. The modal preserves the appearance captured before presentation until JavaScript changes it.

Apps must set `UIViewControllerBasedStatusBarAppearance` to `YES` on iOS 27. Custom root view controllers must return the `RCTStatusBarAppearance` values. Apps using `NO` retain the legacy setters on older SDKs and receive a one-time warning where those setters are ineffective.

Exclude the appearance helper and status-bar controller code on tvOS, where UIKit's status-bar types and APIs are unavailable. Guard the modal capture declaration and call as well as its state and implementation. The iOS code paths are unchanged.


Test Plan:
- Built the full `AirwaveBurbn` app and package for appletvos-arm64 with the Airwave mode, local build flavour, Pika 27 and Xcode 27.1. 

**File**: `packages/react-native/Libraries/AppDelegate/RCTDefaultReactNativeFactoryDelegate.mm` (modified, +26/-1)
```diff
@@ -15,9 +15,34 @@
 #endif
 
 #import <RCTAnimatedModuleProvider/RCTAnimatedModuleProvider.h>
+#import <React/RCTStatusBarAppearance.h>
 #import <react/featureflags/ReactNativeFeatureFlags.h>
 #import <react/nativemodule/defaults/DefaultTurboModules.h>
 
+@interface RCTRootViewController : UIViewController
+@end
+
+@implementation RCTRootViewController
+
+#if !TARGET_OS_TV
+- (UIStatusBarStyle)preferredStatusBarStyle
+{
+  return RCTStatusBarAppearance.style;
+}
+
+- (BOOL)prefersStatusBarHidden
+{
+  return RCTStatusBarAppearance.hidden;
+}
+
+- (UIStatusBarAnimation)preferredStatusBarUpdateAnimation
+{
+  return RCTStatusBarAppearance.updateAnimation;
+}
+#endif
+
+@end
+
 @implementation RCTDefaultReactNativeFactoryDelegate {
   // C++ Native Animated provider, created once on first use (getTurboModule: may be called
   // concurrently for different module names).
@@ -29,7 +54,7 @@ @implementation RCTDefaultReactNativeFactoryDelegate {
 
 - (UIViewController *)createRootViewController
 {
-  return [UIViewController new];
+  return [RCTRootViewController new];
 }
 
 - (void)setRootView:(UIView *)rootView toRootViewController:(UIViewController *)rootViewController
```

**File**: `packages/react-native/Libraries/AppDelegate/RCTUIConfiguratorProtocol.h` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ NS_ASSUME_NONNULL_BEGIN
 
 /**
  * It creates the RootViewController.
- * By default, it creates a new instance of a `UIViewController`.
+ * By default, it creates a view controller that returns the `RCTStatusBarAppearance` values.
  * You can override it to provide your own initial ViewController.
  *
  * @return: an instance of `UIViewController`.
```

**File**: `packages/react-native/React/Base/RCTStatusBarAppearance.h` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+/*
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ */
+
+#import <UIKit/UIKit.h>
+
+#if !TARGET_OS_TV
+NS_ASSUME_NONNULL_BEGIN
+
+/**
+ * The status bar state set from JavaScript. Root view controllers return these values from their status bar methods.
+ */
+@interface RCTStatusBarAppearance : NSObject
+
+@property (class, nonatomic, readonly) UIStatusBarStyle style;
+@property (class, nonatomic, readonly) BOOL hidden;
+@property (class, nonatomic, readonly) UIStatusBarAnimation updateAnimation;
+
++ (void)setStyle:(UIStatusBarStyle)style animated:(BOOL)animated;
++ (void)setHidden:(BOOL)hidden withAnimation:(UIStatusBarAnimation)animation;
+
+@end
+
+NS_ASSUME_NONNULL_END
+#endif
```

**File**: `packages/react-native/React/Base/RCTStatusBarAppearance.mm` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+/*
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ */
+
+#import "RCTStatusBarAppearance.h"
+
+#if !TARGET_OS_TV
+#import "RCTAssert.h"
+#import "RCTUtils.h"
+
+// NOLINTNEXTLINE(cppcoreguidelines-avoid-non-const-global-variables)
+static UIStatusBarStyle sStyle = UIStatusBarStyleDefault;
+// NOLINTNEXTLINE(cppcoreguidelines-avoid-non-const-global-variables)
+static BOOL sHidden = NO;
+// NOLINTNEXTLINE(cppcoreguidelines-avoid-non-const-global-variables)
+static UIStatusBarAnimation sUpdateAnimation = UIStatusBarAnimationNone;
+
+@implementation RCTStatusBarAppearance
+
++ (UIStatusBarStyle)style
+{
+  return sStyle;
+}
+
++ (BOOL)hidden
+{
+  return sHidden;
+}
+
++ (UIStatusBarAnimation)updateAnimation
+{
+  return sUpdateAnimation;
+}
+
++ (void)setStyle:(UIStatusBarStyle)style animated:(BOOL)animated
+{
+  RCTAssertMainQueue();
+  sStyle = style;
+  [self updateStatusBarAnimated:animated];
+}
+
++ (void)setHidden:(BOOL)hidden withAnimation:(UIStatusBarAnimation)animation
+{
+  RCTAssertMainQueue();
+  sHidden = hidden;
+  sUpdateAnimation = animation;
+  [self updateStatusBarAnimated:animation != UIStatusBarAnimationNone];
+}
+
++ (void)updateStatusBarAnimated:(BOOL)animated
+{
+  UIViewController *viewController = RCTPresentedViewController();
+  if (animated) {
+    [UIView animateWithDuration:UINavigationControllerHideShowBarDuration
+                     animations:^{
+                       [viewController setNeedsStatusBarAppearanceUpdate];
+                     }];
+  } else {
+    [viewController setNeedsStatusBarAppearanceUpdate];
+  }
+}
+
+@end
+#endif
```

**File**: `packages/react-native/React/CoreModules/RCTStatusBarManager.mm` (modified, +34/-9)
```diff
@@ -11,6 +11,7 @@
 #import <React/RCTEventDispatcherProtocol.h>
 #import <React/RCTInitializing.h>
 #import <React/RCTLog.h>
+#import <React/RCTStatusBarAppearance.h>
 #import <React/RCTUtils.h>
 
 #import <FBReactNativeSpec/FBReactNativeSpec.h>
@@ -68,6 +69,28 @@ static BOOL RCTViewControllerBasedStatusBarAppearance()
   return value;
 }
 
+// UIKit makes the app-level setters no-ops only for apps built with the iOS 27 SDK.
+static BOOL RCTAppLevelStatusBarIsNoOp()
+{
+#if __IPHONE_OS_VERSION_MAX_ALLOWED >= 270000
+  if (@available(iOS 27.0, *)) {
+    return YES;
+  }
+#endif
+  return NO;
+}
+
+static void RCTWarnAppLevelStatusBarUnavailable()
+{
+  static dispatch_once_t onceToken;
+  dispatch_once(&onceToken, ^{
+    RCTLogWarn(
+        @"StatusBar has no effect because UIViewControllerBasedStatusBarAppearance is NO in Info.plist. "
+        @"Apps built with the iOS 27 SDK cannot use the app-level status bar API that this setting uses. "
+        @"Set UIViewControllerBasedStatusBarAppearance to YES to control the status bar from JavaScript.");
+  });
+}
+
 RCT_EXPORT_MODULE()
 
 + (BOOL)requiresMainQueueSetup
@@ -147,30 +170,32 @@ - (void)setStyle:(NSString *)style animated:(BOOL)animated
 {
   dispatch_async(dispatch_get_main_queue(), ^{
     UIStatusBarStyle statusBarStyle = [RCTConvert UIStatusBarStyle:style];
-    if (RCTViewControllerBasedStatusBarAppearance()) {
-      RCTLogWarn(@"RCTStatusBarManager is a no-op when \
-                UIViewControllerBasedStatusBarAppearance is YES; set the status bar from your view controller instead");
-    } else {
+    [RCTStatusBarAppearance setStyle:statusBarStyle animated:animated];
+    if (!RCTViewControllerBasedStatusBarAppearance()) {
 #pragma clang diagnostic push
 #pragma clang diagnostic ignored "-Wdeprecated-declarations"
       [RCTSharedApplication() setStatusBarStyle:statusBarStyle animated:animated];
-    }
 #pragma clang diagnostic pop
+      if (RCTAppLevelStatusBarIsNoOp()) {
+        RCTWarnAppLevelStatusBarUnavailable();
+      }
+    }
   });
 }
 
 - (void)setHidden:(BOOL)hidden withAnimation:(NSString *)withAnimation
 {
   dispatch_async(dispatch_get_main_queue(), ^{
     UIStatusBarAnimation animation = [RCTConvert UIStatusBarAnimation:withAnimation];
-    if (RCTViewControllerBasedStatusBarAppearance()) {
-      RCTLogWarn(@"RCTStatusBarManager is a no-op when \
-                UIViewControllerBasedStatusBarAppearance is YES; set the status bar from your view controller instead");
-    } else {
+    [RCTStatusBarAppearance setHidden:hidden withAnimation:animation];
+    if (!RCTViewControllerBasedStatusBarAppearance()) {
 #pragma clang diagnostic push
 #pragma clang diagnostic ignored "-Wdeprecated-declarations"
       [RCTSharedApplication() setStatusBarHidden:hidden withAnimation:animation];
 #pragma clang diagnostic pop
+      if (RCTAppLevelStatusBarIsNoOp()) {
+        RCTWarnAppLevelStatusBarUnavailable();
+      }
     }
   });
 }
```

**File**: `packages/react-native/React/Fabric/Mounting/ComponentViews/Modal/RCTFabricModalHostViewController.mm` (modified, +30/-2)
```diff
@@ -8,12 +8,18 @@
 #import "RCTFabricModalHostViewController.h"
 
 #import <React/RCTLog.h>
+#import <React/RCTStatusBarAppearance.h>
 #import <React/RCTSurfaceTouchHandler.h>
 
 @implementation RCTFabricModalHostViewController {
   CGRect _lastViewBounds;
 #if !TARGET_OS_TV
   RCTSurfaceTouchHandler *_touchHandler;
+  BOOL _hasCapturedStatusBar;
+  UIStatusBarStyle _capturedStatusBarStyle;
+  BOOL _capturedStatusBarHidden;
+  UIStatusBarStyle _jsStatusBarStyleAtCapture;
+  BOOL _jsStatusBarHiddenAtCapture;
 #endif
 }
 
@@ -47,14 +53,36 @@ - (void)loadView
 }
 
 #if !TARGET_OS_TV
+- (void)captureStatusBarAppearance
+{
+  UIStatusBarManager *statusBarManager = RCTUIStatusBarManager();
+  _hasCapturedStatusBar = YES;
+  _capturedStatusBarStyle = statusBarManager.statusBarStyle;
+  _capturedStatusBarHidden = statusBarManager.isStatusBarHidden;
+  _jsStatusBarStyleAtCapture = RCTStatusBarAppearance.style;
+  _jsStatusBarHiddenAtCapture = RCTStatusBarAppearance.hidden;
+}
+
+// Keep the status bar from before the modal until JS changes it.
 - (UIStatusBarStyle)preferredStatusBarStyle
 {
-  return [RCTUIStatusBarManager() statusBarStyle];
+  if (_hasCapturedStatusBar && RCTStatusBarAppearance.style == _jsStatusBarStyleAtCapture) {
+    return _capturedStatusBarStyle;
+  }
+  return RCTStatusBarAppearance.style;
 }
 
 - (BOOL)prefersStatusBarHidden
 {
-  return [RCTUIStatusBarManager() isStatusBarHidden];
+  if (_hasCapturedStatusBar && RCTStatusBarAppearance.hidden == _jsStatusBarHiddenAtCapture) {
+    return _capturedStatusBarHidden;
+  }
+  return RCTStatusBarAppearance.hidden;
+}
+
+- (UIStatusBarAnimation)preferredStatusBarUpdateAnimation
+{
+  return RCTStatusBarAppearance.updateAnimation;
 }
 #endif
 
```

**File**: `packages/react-native/React/Fabric/Mounting/ComponentViews/Modal/RCTModalHostViewComponentView.mm` (modified, +9/-0)
```diff
@@ -17,6 +17,12 @@
 
 #import "RCTFabricModalHostViewController.h"
 
+#if !TARGET_OS_TV
+@interface RCTFabricModalHostViewController ()
+- (void)captureStatusBarAppearance;
+@end
+#endif
+
 using namespace facebook::react;
 
 #if !TARGET_OS_TV
@@ -173,6 +179,9 @@ - (void)ensurePresentedOnlyIfNeeded
     [self saveAccessibilityFocusedView];
     self.viewController.presentationController.delegate = self;
     self.viewController.modalInPresentation = _modalInPresentation;
+#if !TARGET_OS_TV
+    [self.viewController captureStatusBarAppearance];
+#endif
 
     _isPresented = YES;
     [self presentViewController:self.viewController
```

**File**: `packages/rn-tester/RNTester/Info.plist` (modified, +1/-1)
```diff
@@ -81,6 +81,6 @@
 		<string>UIInterfaceOrientationPortraitUpsideDown</string>
 	</array>
 	<key>UIViewControllerBasedStatusBarAppearance</key>
-	<false/>
+	<true/>
 </dict>
 </plist>
```

---

### Incident Patch 3: `856661ff` (2026-11-02)
**Commit Message**: fix: disconnect `AnimatedProps` before attaching a new native view

## Summary:

When an animated component replaces its underlying native view, `AnimatedProps.setNativeView()` connects the existing animated props node to the replacement without disconnecting the previous view. On Android, this causes a crash:

```text
Animated node X is already attached to a view: Y
```

Disconnect the previous target before connecting the replacement.

## Changelog:

[ANDROID] [FIXED] - Prevent native Animated crashes when an animated component replaces its underlying native view.

## Test Plan:

You can use this code to reproduce a crash:

```tsx
import React, { forwardRef, useState } from "react";
import { Animated, Button, StyleSheet, Text, View } from "react-native";

import type { ViewProps } from "react-native";

// Keep the Animated wrapper mounted while replacing its native View.
const ReplacingView = Animated.createAnimatedComponent(
  forwardRef<View, ViewProps & { generation: number }>(function ReplacingView(
    { generation, ...props },
    ref,
  ) {
    return <View {...props} key={generation} ref={ref} />;
  }),
);

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 

**File**: `packages/react-native/Libraries/Animated/nodes/AnimatedProps.js` (modified, +3/-0)
```diff
@@ -268,6 +268,9 @@ export default class AnimatedProps extends AnimatedNode {
     if (this._target?.instance === instance) {
       return;
     }
+    if (this.__isNative && this._target != null) {
+      this.#disconnectAnimatedView(this._target);
+    }
     const target = (this._target = {instance, connectedViewTag: null});
     if (this.__isNative) {
       this.#connectAnimatedView(target);
```

**File**: `packages/react-native/src/private/animated/__tests__/AnimatedNative-test.js` (modified, +93/-0)
```diff
@@ -31,6 +31,11 @@ describe('Native Animated', () => {
     };
   }
 
+  function createViewInstance(): React.ElementRef<React.ElementType> {
+    // $FlowFixMe[incompatible-type]
+    return {};
+  }
+
   beforeEach(() => {
     jest.resetModules();
     jest.restoreAllMocks();
@@ -1620,6 +1625,94 @@ describe('Native Animated', () => {
       );
     });
 
+    it('disconnects the previous native view before connecting a replacement', () => {
+      const findNodeHandle = jest
+        .fn()
+        .mockReturnValueOnce(11)
+        .mockReturnValueOnce(22);
+      jest.setMock('../../../../Libraries/ReactNative/RendererProxy', {
+        findNodeHandle,
+      });
+      const {Animated} = importModules();
+      const AnimatedProps =
+        require('../../../../Libraries/Animated/nodes/AnimatedProps').default;
+      const firstView = createViewInstance();
+      const secondView = createViewInstance();
+      const opacity = new Animated.Value(1);
+      const propsNode = new AnimatedProps({style: {opacity}}, jest.fn());
+      propsNode.__attach();
+      propsNode.setNativeView(firstView);
+      propsNode.__makeNative();
+      const propsTag = propsNode.__getNativeTag();
+
+      propsNode.setNativeView(secondView);
+
+      expect(
+        NativeAnimatedModule.connectAnimatedNodeToView,
+      ).toHaveBeenNthCalledWith(1, propsTag, 11);
+      expect(
+        NativeAnimatedModule.disconnectAnimatedNodeFromView,
+      ).toHaveBeenCalledWith(propsTag, 11);
+      expect(
+        NativeAnimatedModule.connectAnimatedNodeToView,
+      ).toHaveBeenNthCalledWith(2, propsTag, 22);
+      expect(
+        // $FlowFixMe[prop-missing]
+        NativeAnimatedModule.disconnectAnimatedNodeFromView.mock
+          .invocationCallOrder[0],
+      ).toBeLessThan(
+        // $FlowFixMe[prop-missing]
+        NativeAnimatedModule.connectAnimatedNodeToView.mock
+          .invocationCallOrder[1],
+      );
+
+      propsNode.setNativeView(secondView);
+      expect(
+        NativeAnimatedModule.connectAnimatedNodeToView,
+      ).toHaveBeenCalledTimes(2);
+      expect(
+        NativeAnimatedModule.disconnectAnimatedNodeFromView,
+      ).toHaveBeenCalledTimes(1);
+
+      propsNode.__detach();
+      expect(
+        NativeAnimatedModule.disconnectAnimatedNodeFromView,
+      ).toHaveBeenNthCalledWith(2, propsTag, 22);
+      expect(findNodeHandle).toHaveBeenCalledTimes(2);
+    });
+
+    it('only connects the latest view when switching to the native driver', () => {
+      jest.setMock('../../../../Libraries/ReactNative/RendererProxy', {
+        findNodeHandle: () => 22,
+      });
+      const {Animated} = importModules();
+      const AnimatedProps =
+        require('../../../../Libraries/Animated/nodes/AnimatedProps').default;
+      const opacity = new Animated.Value(1);
+      const propsNode = new AnimatedProps({style: {opacity}}, jest.fn());
+      propsNode.__attach();
+      propsNode.setNativeView(createViewInstance());
+      propsNode.setNativeView(createViewInstance());
+      expect(
+        NativeAnimatedModule.connectAnimatedNodeToView,
+      ).not.toHaveBeenCalled();
+      expect(
+        NativeAnimatedModule.disconnectAnimatedNodeFromView,
+      ).not.toHaveBeenCalled();
+
+      propsNode.__makeNative();
+      expect(
+        NativeAnimatedModule.connectAnimatedNodeToView,
+      ).toHaveBeenCalledTimes(1);
+      expect(
+        NativeAnimatedModule.connectAnimatedNodeToView,
+      ).toHaveBeenCalledWith(propsNode.__getNativeTag(), 22);
+      expect(
+        NativeAnimatedModule.disconnectAnimatedNodeFromView,
+      ).not.toHaveBeenCalled();
+      propsNode.__detach();
+    });
+
     it('creates new props, style and transform nodes at update', async () => {
       const {Animated} = importModules();
 
```

#### Recent Merged Pull Requests:
- **PR #59780** (2026-11-03): Upgrade Flow in fbsource (@SamChou19815)
- **PR #59779** (closed): Support text updates in the shared animation backend (@bartlomiejbloniarz)
- **PR #59777** (2026-11-03): Don't clone zeroed out `display: none` subtrees on every layout pass (#2055) (@javache)
- **PR #59775** (2026-11-03): Babel preset: Remove jsx-source and jsx-self plugins (@robhogan)
- **PR #59766** (2026-11-03): Include folly headers directly instead of via folly/dynamic.h (#59766) (@r-barnes)
- **PR #59765** (2026-11-03): Remove $FlowExpectedError[sketchy-null-string] (utils.js) (#59765) (@jcperez-ch)

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

## X. iOS Fabric unmount assertions for zero-sized recycled views

**RULE**:
When implementing operations in `packages/react-native/React/Fabric/Mounting/ComponentViews/View/RCTViewComponentView.mm`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in react/react-native. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `debaf42c`: iOS Fabric unmount assertions for zero-sized recycled views. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/react-native/React/Fabric/Mounting/ComponentViews/View/RCTViewComponentView.mm`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
    // This getter can migrate children from a recycled clipping container.
    // Reconcile before reading superview, even when assertions are disabled.
    [[maybe_unused]] UIView *containerView = self.currentContainerView;
        childComponentView.superview == containerView,
    NSArray<UIView *> *containerSubviews = containerView.subviews;
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
        childComponentView.superview == self.currentContainerView,
    NSArray<UIView *> *containerSubviews = self.currentContainerView.subviews;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `debaf42c` are properly handled with clean fallback behavior.
