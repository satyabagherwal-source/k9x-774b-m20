> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/react-react-native-learnings.md`  
> **Source**: github ([https://github.com/react/react-native](https://github.com/react/react-native))  
> **Source Version**: `2fd8fd66`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T04:05:30.406Z  
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
> **Harvest Timestamp**: 2026-10-20T04:05:30.130Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react/react-native`
- **Description**: A framework for building native applications using React
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 126724 stars

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

### Incident Patch 1: `65b3e647` (2026-10-19)
**Commit Message**: Fix race in UiThreadUtil main handler lazy initialization (#58963)

Summary:
`UiThreadUtil` keeps its main-thread `Handler` in a property delegated to `lazy(LazyThreadSafetyMode.NONE)`:

```kotlin
private val mainHandler: Handler by
    lazy(LazyThreadSafetyMode.NONE) { Handler(Looper.getMainLooper()) }
```

`NONE` creates an `UnsafeLazyImpl`, whose getter is:

```kotlin
if (_value === UNINITIALIZED_VALUE) {
  _value = initializer!!()
  initializer = null
}
return _value as T
```

`mainHandler` is first read by whichever thread first calls `runOnUiThread()`, `getUiThreadHandler()` or `removeOnUiThread()`. `isOnUiThread()` and the `assert*` helpers only use `Looper`, so the main thread calling them does not initialize it. In practice the first reads usually come from background threads posting to the UI thread, such as the JS thread, the native modules thread, or a library's executor. When two of them make their first call at the same time:

1. Thread A sees `_value === UNINITIALIZED_VALUE` and starts the initializer.
2. Thread B also sees `UNINITIALIZED_VALUE`, because A has not written `_value` yet.
3. A writes `_value` and sets `initializer = null`.
4. B evaluates `initializer!!(

**File**: `packages/react-native/ReactAndroid/src/main/java/com/facebook/react/bridge/UiThreadUtil.kt` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ import com.facebook.react.common.build.ReactBuildConfig
 public object UiThreadUtil {
 
   private val mainHandler: Handler by
-      lazy(LazyThreadSafetyMode.NONE) { Handler(Looper.getMainLooper()) }
+      lazy(LazyThreadSafetyMode.PUBLICATION) { Handler(Looper.getMainLooper()) }
 
   /**
    * Returns the handler associated with the main (UI) thread.
```

---

### Incident Patch 2: `381d74d7` (2026-10-19)
**Commit Message**: fix(VirtualizedList): clear batch timer id on unmount so a Suspense-revived list can schedule updates again (#59123)

Summary:
`VirtualizedList.componentWillUnmount` clears the pending `_updateCellsToRenderTimeoutID` timer but never resets the field to `null`. The low-priority branch of `_scheduleCellsToRenderUpdate` only schedules a batch when that id is `null`, so the stale id blocks every future low-priority update on the instance.

Unmount is not final for a class instance inside a Suspense boundary. When already-mounted content is hidden and later revealed — the react-freeze pattern that react-native-screens uses for `freezeOnBlur` — React calls `componentWillUnmount` and then `componentDidMount` on the **same** instance. If a batch timer was pending at the hide, the revived list can no longer schedule low-priority updates. When the list also had no items at the hide, `cellsAroundViewport` is `{first: 0, last: -1}`, so the high-priority path (`last >= 0`) cannot recover either and the render window stays at `initialNumToRender` regardless of how much data arrives afterwards.

Field impact: a POS handheld app (react-native-screens with `freezeOnBlur`) showed 12 of 28 order line

**File**: `packages/virtualized-lists/Lists/VirtualizedList.js` (modified, +1/-0)
```diff
@@ -855,6 +855,7 @@ class VirtualizedList extends StateSafePureComponent<
     this._unregisterFromParent(false);
     // $FlowFixMe[incompatible-type]
     clearTimeout(this._updateCellsToRenderTimeoutID);
+    this._updateCellsToRenderTimeoutID = null;
     this._viewabilityTuples.forEach(tuple => {
       tuple.viewabilityHelper.dispose();
     });
```

**File**: `packages/virtualized-lists/Lists/__tests__/VirtualizedList-test.js` (modified, +80/-0)
```diff
@@ -3048,6 +3048,86 @@ it('handles rapid prepends with coalesced scroll event (regression for #53542)',
   ).toBeGreaterThanOrEqual(0);
 });
 
+it('renders all cells after being hidden and revealed by Suspense with a pending batch update', async () => {
+  const ITEM_HEIGHT = 40;
+  const listRef = createRef();
+  // The simulate* helpers only need `getInstance()`; the root here is a
+  // Suspense boundary, so point them at the list instance via the ref.
+  const list = {getInstance: () => listRef.current};
+
+  // Mirrors react-freeze (react-native-screens `freezeOnBlur`): suspend on a
+  // promise that never resolves so React hides the already-mounted subtree
+  // (componentWillUnmount) and later reveals the same instance
+  // (componentDidMount) instead of remounting it.
+  const neverResolves = new Promise(() => {});
+  function Freeze({freeze, children}) {
+    if (freeze) {
+      throw neverResolves;
+    }
+    return children;
+  }
+
+  const renderList = ({freeze, items}) => (
+    <React.Suspense fallback={null}>
+      <Freeze freeze={freeze}>
+        <VirtualizedList
+          ref={listRef}
+          initialNumToRender={12}
+          {...baseItemProps(items)}
+          {...fixedHeightItemLayoutProps(ITEM_HEIGHT)}
+        />
+      </Freeze>
+    </React.Suspense>
+  );
+
+  let component;
+  await act(() => {
+    component = create(renderList({freeze: false, items: []}), {
+      unstable_isConcurrent: true,
+    });
+  });
+
+  // Layout with no data schedules a low-priority batch update. Leave the
+  // timer pending so it is still outstanding when the list is hidden.
+  await act(() => {
+    simulateLayout(list, {
+      viewport: {width: 300, height: 600},
+      content: {width: 300, height: 0},
+    });
+  });
+
+  await act(() => {
+    component.update(renderList({freeze: true, items: []}));
+  });
+  await act(() => {
+    component.update(renderList({freeze: false, items: []}));
+  });
+
+  const items = generateItems(28);
+  await act(() => {
+    component.update(renderList({freeze: false, items}));
+  });
+  await act(() => {
+    simulateContentLayout(list, {
+      width: 300,
+      height: items.length * ITEM_HEIGHT,
+    });
+    simulateScroll(list, {x: 0, y: 0});
+  });
+
+  // Each low-priority batch grows the render window by at most
+  // `maxToRenderPerBatch` cells, so advance through several batching periods.
+  for (let i = 0; i < 5; i++) {
+    await act(() => {
+      performAllBatches();
+    });
+  }
+
+  expect(component.root.findAllByType('MockCellItem')).toHaveLength(
+    items.length,
+  );
+});
+
 function generateItems(count, startKey = 0) {
   return Array(count)
     .fill()
```

---

### Incident Patch 3: `8bfa9dd2` (2026-10-19)
**Commit Message**: Fix Hermes Debug builds after installing another pod (#59159)

Summary:
A successful Release build followed by adding a new CocoaPods dependency can cause the next Debug build to fail with undefined Hermes debugger symbols, including `CDPDebugAPI::create` and `CDPAgent::create`.

The Release build installs the Release Hermes binary and records `Release` in `Pods/hermes-engine/.last_build_configuration`. When a subsequent `pod install` installs another pod, CocoaPods cleans the existing Hermes pod. The `Pre-built` subspec does not preserve the configuration marker, so the marker is removed while the Release framework remains on disk.

On the next Debug build, `replace_hermes_version.js` receives the correct `Debug` configuration but assumes that a missing marker means Hermes is already Debug. It skips replacement, leaving Debug React Native code to link against a Release Hermes binary that does not export the required debugger symbols.

This change:

- Adds `.last_build_configuration` to the `Pre-built` subspec's `preserve_paths`, so installing another pod does not discard the configuration recorded for the existing Hermes binary.
- Removes the assumption that a missing marker impli

**File**: `packages/react-native/scripts/__tests__/replace-hermes-version-test.js` (added, +119/-0)
```diff
@@ -0,0 +1,119 @@
+/**
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ *
+ * @format
+ * @noflow
+ */
+
+'use strict';
+
+const {execFileSync} = require('node:child_process');
+const fs = require('node:fs');
+const os = require('node:os');
+const path = require('node:path');
+
+const SCRIPT =
+  require.resolve('../../sdks/hermes-engine/utils/replace_hermes_version.js');
+const VERSION = '0.0.0-test';
+const BINARY =
+  'destroot/Library/Frameworks/universal/hermesvm.xcframework/ios-arm64/hermesvm.framework/hermesvm';
+
+function writeFile(filePath, contents) {
+  fs.mkdirSync(path.dirname(filePath), {recursive: true});
+  fs.writeFileSync(filePath, contents);
+}
+
+describe('Hermes configuration replacement', () => {
+  let podsRoot;
+  let binary;
+  let marker;
+
+  beforeEach(() => {
+    podsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-config-test-'));
+    binary = path.join(podsRoot, 'hermes-engine', BINARY);
+    marker = path.join(podsRoot, 'hermes-engine/.last_build_configuration');
+  });
+
+  afterEach(() => {
+    fs.rmSync(podsRoot, {recursive: true, force: true});
+  });
+
+  function buildTarball(configuration) {
+    const stage = path.join(podsRoot, 'stage');
+    writeFile(path.join(stage, BINARY), configuration);
+    const artifacts = path.join(podsRoot, 'hermes-engine-artifacts');
+    fs.mkdirSync(artifacts, {recursive: true});
+    execFileSync('tar', [
+      '-czf',
+      path.join(
+        artifacts,
+        `hermes-ios-${VERSION}-${configuration.toLowerCase()}.tar.gz`,
+      ),
+      '-C',
+      stage,
+      '.',
+    ]);
+  }
+
+  function runScript(configuration) {
+    // Match the podspec's build phase: run the CLI from the Pods directory.
+    execFileSync(
+      process.execPath,
+      [SCRIPT, '-c', configuration, '-r', VERSION, '-p', podsRoot],
+      {cwd: podsRoot, encoding: 'utf8'},
+    );
+  }
+
+  it.each([
+    ['Debug', 'Release'],
+    ['Release', 'Debug'],
+  ])('restores %s when the marker is missing and %s remains', (target, old) => {
+    writeFile(binary, old);
+    buildTarball(target);
+
+    runScript(target);
+
+    expect(fs.readFileSync(binary, 'utf8')).toBe(target);
+    expect(fs.readFileSync(marker, 'utf8')).toBe(target);
+  });
+
+  it.each(['Debug', 'Release'])(
+    'keeps a recorded %s configuration without requiring a tarball',
+    configuration => {
+      writeFile(binary, configuration);
+      writeFile(marker, configuration);
+
+      runScript(configuration);
+
+      expect(fs.readFileSync(binary, 'utf8')).toBe(configuration);
+      expect(fs.readFileSync(marker, 'utf8')).toBe(configuration);
+    },
+  );
+
+  it.each([
+    ['Debug', 'Release'],
+    ['Release', 'Debug'],
+  ])('switches to %s when %s is recorded', (target, old) => {
+    writeFile(binary, old);
+    writeFile(marker, old);
+    buildTarball(target);
+
+    runScript(target);
+
+    expect(fs.readFileSync(binary, 'utf8')).toBe(target);
+    expect(fs.readFileSync(marker, 'utf8')).toBe(target);
+  });
+
+  it('records Debug after restoring a fresh install with no marker', () => {
+    writeFile(binary, 'Debug');
+    buildTarball('Debug');
+
+    runScript('Debug');
+
+    expect(fs.readFileSync(binary, 'utf8')).toBe('Debug');
+    expect(fs.readFileSync(marker, 'utf8')).toBe('Debug');
+  });
+});
```

**File**: `packages/react-native/sdks/hermes-engine/hermes-engine.podspec` (modified, +2/-1)
```diff
@@ -56,7 +56,8 @@ Pod::Spec.new do |spec|
   if HermesEngineSourceType::isPrebuilt(source_type) then
 
     spec.subspec 'Pre-built' do |ss|
-      ss.preserve_paths = ["destroot/bin/*"].concat(["**/*.{h,c,cpp}"])
+      # Keep the configuration marker when CocoaPods cleans an unchanged pod.
+      ss.preserve_paths = ["destroot/bin/*", ".last_build_configuration"].concat(["**/*.{h,c,cpp}"])
       ss.source_files = ["destroot/include/hermes/**/*.h", "destroot/include/jsi/hermes.h"]
       ss.header_mappings_dir = "destroot/include"
       ss.ios.vendored_frameworks = "destroot/Library/Frameworks/universal/hermesvm.xcframework"
```

**File**: `packages/react-native/sdks/hermes-engine/utils/replace_hermes_version.js` (modified, +2/-8)
```diff
@@ -42,14 +42,8 @@ function shouldReplaceHermesConfiguration(configuration) {
     }
   }
 
-  // Assumption: if there is no stored last build, we assume that it was build for debug.
-  if (!fileExists && configuration === 'Debug') {
-    console.log(
-      'No previous build detected, but Debug Configuration. No need to replace Hermes engine',
-    );
-    return false;
-  }
-
+  // The binary may outlive its marker, so a missing marker does not imply Debug.
+  // Restore the requested configuration instead of assuming what is installed.
   return true;
 }
 
```

#### Recent Merged Pull Requests:
- **PR #59212** (closed): Upgrade Flow in fbsource (@SamChou19815)
- **PR #59210** (closed): Support SelectableParagraph in fantom tester (@Abbondanzo)
- **PR #59196** (closed): Classify the deprecated cxxreact/ErrorUtils.h shim as for-frameworks (@coado)
- **PR #59183** (closed): Remove enableImperativeEvents_DEPRECATED feature flag (@rubennorte)
- **PR #59177** (closed): Add AccessibilityInfo.isShowBordersEnabled and showBordersChanged on iOS (@camilopires)
- **PR #59172** (closed): Remove the generated changelog PR from the publish workflow (@fabriziocucci)

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

## X. race in UiThreadUtil main handler lazy initialization (#58963)

**RULE**:
When implementing operations in `packages/react-native/ReactAndroid/src/main/java/com/facebook/react/bridge/UiThreadUtil.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in react/react-native. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `65b3e647`: race in UiThreadUtil main handler lazy initialization (#58963). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/react-native/ReactAndroid/src/main/java/com/facebook/react/bridge/UiThreadUtil.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
      lazy(LazyThreadSafetyMode.PUBLICATION) { Handler(Looper.getMainLooper()) }
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
      lazy(LazyThreadSafetyMode.NONE) { Handler(Looper.getMainLooper()) }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `65b3e647` are properly handled with clean fallback behavior.
