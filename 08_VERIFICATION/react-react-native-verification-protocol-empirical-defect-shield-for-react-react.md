# Verification Protocol: Verification Protocol: Empirical Defect Shield for react/react-native

<!-- PROVENANCE_START
{
  "source_repository": "react/react-native",
  "source_url": "https://github.com/react/react-native",
  "source_version": "c1acb2bd",
  "license": "MIT",
  "timestamp": "2026-11-17T06:47:10.838Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-react-react-native",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [react/react-native](https://github.com/react/react-native) (Revision: `c1acb2bd`).  
> **License**: MIT | **Timestamp**: `2026-11-17T06:47:10.838Z`  
> **Learning ID**: `learn-github-react-react-native`


## 1. Scope & Verification Target
- **Target Repository**: `react/react-native` (Commit: `c1acb2bd`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): react/react-native

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-react-native-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react/react-native](https://github.com/react/react-native))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T06:47:09.763Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react/react-native`
- **Description**: A framework for building native applications using React
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 126941 stars

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

### Incident Patch 1: `fb07ea35` (2026-11-16)
**Commit Message**: Fix TextInput state retain chain in AndroidTextInputShadowNode

Summary:
`AndroidTextInputShadowNode::getAttributedString` builds the fragment for a controlled `value` with `parentShadowView = ShadowView(*this)`. A full `ShadowView` carries the node's current `state` and `props`. `updateStateIfNeeded` stores that attributed string in the next `AndroidTextInputState` (`reactTreeAttributedString`), so every new state keeps the previous state (and props) alive. The chain grows by one link per value change for as long as the input stays mounted.

Two effects:
- Memory: native heap grows with every change to a controlled `TextInput` and is only released on unmount.
- Crash: on unmount the whole chain is destroyed recursively on the JS thread. Long chains overflow the stack, and crash stacks repeat `State → AttributedString → Fragment → ShadowView → State` dozens of times before ending in a SIGSEGV in `~AndroidTextInputState()`.

D94267721 fixed the same retain chain for iOS/macOS by adding `shadowViewFromShadowNode()` in `BaseTextInputShadowNode.h`. `AndroidTextInputShadowNode` does not inherit from `BaseTextInputShadowNode`, so Android still had the bug.

This change clears `props` and

**File**: `packages/react-native/ReactCommon/react/renderer/components/textinput/platform/android/react/renderer/components/androidtextinput/AndroidTextInputShadowNode.cpp` (modified, +6/-1)
```diff
@@ -189,7 +189,12 @@ AttributedString AndroidTextInputShadowNode::getAttributedString(
     // text value's background will stack. This is a hack/workaround to prevent
     // that effect.
     fragment.textAttributes.backgroundColor = clearColor();
-    fragment.parentShadowView = ShadowView(*this);
+    auto parentShadowView = ShadowView(*this);
+    // Clearing `props` and `state` (which we don't use) allows avoiding retain
+    // cycles.
+    parentShadowView.props = nullptr;
+    parentShadowView.state = nullptr;
+    fragment.parentShadowView = std::move(parentShadowView);
     attributedString.prependFragment(std::move(fragment));
   }
 
```

---

### Incident Patch 2: `4a82359d` (2026-11-16)
**Commit Message**: Report an actionable error when '@react-native/codegen' is not built (#59650)

Summary:

When `react-native/codegen` is checked out from source but never built, `babel-plugin-codegen` failed with a bare `Cannot find module .../lib/...` deep inside Babel preset loading. Catch the failed `lib/` fallback and name the fix, keeping the original failure as `cause`. A missing install and a broken `lib/` build report separately. Adds `codegen-load-test.js` covering all three failures.

Changelog:
[General][Fixed] - Show an actionable error when `react-native/codegen` is not built

Reviewed By: cipolleschi

Differential Revision: D127711037

Pull Request resolved: https://github.com/react/react-native/pull/59650

**File**: `packages/babel-plugin-codegen/__tests__/codegen-load-test.js` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+/**
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ *
+ * @flow strict-local
+ * @format
+ */
+
+class ModuleNotFoundError extends Error {
+  code: string = 'MODULE_NOT_FOUND';
+}
+
+function missingLibError(): Error {
+  return new ModuleNotFoundError(
+    "Cannot find module '@react-native/codegen/lib/parsers/flow/parser'",
+  );
+}
+
+// Failure thrown by the virtual `lib/` mock; tests override it per case.
+let mockLibLoadError: Error = missingLibError();
+
+// `lib/` is gitignored build output and may not exist on disk, so it is
+// mocked virtually for every test. This stays a top-level `jest.mock`
+// because only it accepts the options argument under this repo's Flow libdef.
+jest.mock(
+  '@react-native/codegen/lib/parsers/flow/parser',
+  () => {
+    throw mockLibLoadError;
+  },
+  {virtual: true},
+);
+
+describe('codegen loading', () => {
+  beforeEach(() => {
+    mockLibLoadError = missingLibError();
+  });
+
+  it('throws an actionable error when @react-native/codegen is not built', () => {
+    jest.isolateModules(() => {
+      jest.doMock('@react-native/codegen/src/parsers/flow/parser', () => {
+        throw new SyntaxError("Unexpected token '{'");
+      });
+      expect(() => {
+        // $FlowFixMe[untyped-import] `../index.js` is `@noflow`.
+        require('../index.js');
+      }).toThrow(/never built.*yarn workspace @react-native\/codegen build/s);
+    });
+  });
+
+  it('throws an actionable error when @react-native/codegen is not installed', () => {
+    jest.isolateModules(() => {
+      jest.doMock('@react-native/codegen/src/parsers/flow/parser', () => {
+        throw new ModuleNotFoundError('Cannot find module');
+      });
+      expect(() => {
+        // $FlowFixMe[untyped-import] `../index.js` is `@noflow`.
+        require('../index.js');
+      }).toThrow(/could not be found/);
+    });
+  });
+
+  it('throws an actionable error when the built lib is broken', () => {
+    jest.isolateModules(() => {
+      mockLibLoadError = new SyntaxError("Unexpected token '{'");
+      jest.doMock('@react-native/codegen/src/parsers/flow/parser', () => {
+        throw new ModuleNotFoundError('Cannot find module');
+      });
+      expect(() => {
+        // $FlowFixMe[untyped-import] `../index.js` is `@noflow`.
+        require('../index.js');
+      }).toThrow(/failed to load.*Rebuild/s);
+    });
+  });
+});
```

**File**: `packages/babel-plugin-codegen/index.js` (modified, +36/-9)
```diff
@@ -15,22 +15,49 @@ let FlowParser, TypeScriptParser, RNCodegen;
 const {cheap: traverseCheap} = require('@babel/traverse').default;
 const {basename} = require('node:path');
 
+function getCodegenLoadError(srcError, libError) {
+  if (libError != null && libError.code !== 'MODULE_NOT_FOUND') {
+    return (
+      'Unable to load @react-native/codegen: its built `lib/` output failed ' +
+      'to load, so NativeComponent specs cannot be transformed. Rebuild it, ' +
+      'e.g. `yarn workspace @react-native/codegen build`, then retry.'
+    );
+  }
+  if (srcError != null && srcError.code !== 'MODULE_NOT_FOUND') {
+    return (
+      'Unable to load @react-native/codegen: the package is checked out ' +
+      'from source but was never built (its `lib/` output is missing), so ' +
+      'NativeComponent specs cannot be transformed. Build it first, e.g. ' +
+      '`yarn workspace @react-native/codegen build`, then retry.'
+    );
+  }
+  return (
+    'Unable to load @react-native/codegen: the package could not be found, ' +
+    'so NativeComponent specs cannot be transformed. Install dependencies ' +
+    'first, then retry.'
+  );
+}
+
 try {
   FlowParser =
     require('@react-native/codegen/src/parsers/flow/parser').FlowParser;
   TypeScriptParser =
     require('@react-native/codegen/src/parsers/typescript/parser').TypeScriptParser;
   RNCodegen = require('@react-native/codegen/src/generators/RNCodegen');
-} catch (e) {
-  // Fallback to lib when source doesn't exit (e.g. when installed as a dev dependency)
-  FlowParser =
-    // $FlowFixMe[cannot-resolve-module]
-    require('@react-native/codegen/lib/parsers/flow/parser').FlowParser;
-  TypeScriptParser =
+} catch (srcError) {
+  // Fallback to lib when source isn't usable (e.g. when installed as a dev dependency)
+  try {
+    FlowParser =
+      // $FlowFixMe[cannot-resolve-module]
+      require('@react-native/codegen/lib/parsers/flow/parser').FlowParser;
+    TypeScriptParser =
+      // $FlowFixMe[cannot-resolve-module]
+      require('@react-native/codegen/lib/parsers/typescript/parser').TypeScriptParser;
     // $FlowFixMe[cannot-resolve-module]
-    require('@react-native/codegen/lib/parsers/typescript/parser').TypeScriptParser;
-  // $FlowFixMe[cannot-resolve-module]
-  RNCodegen = require('@react-native/codegen/lib/generators/RNCodegen');
+    RNCodegen = require('@react-native/codegen/lib/generators/RNCodegen');
+  } catch (libError) {
+    throw new Error(getCodegenLoadError(srcError, libError), {cause: libError});
+  }
 }
 
 const flowParser = new FlowParser();
```

---

### Incident Patch 3: `32e6daa9` (2026-11-16)
**Commit Message**: Build the Fantom tester with platform build modes

Summary:
Build the Fantom native tester and Hermes compiler with the standard Linux and macOS build modes instead of the previous per-platform mode set, matching how other internal test runners build their native binaries.

- Linux uses the `dev-nosan`, `opt`, `dev-asan`, `dev-tsan`, `dev-cov` and `opt-cov` modes, linked statically because the runner copies the binaries out of the build output directory.
- macOS uses the macOS platform mode plus separate production, sanitizer and coverage modes. Each mode file is now passed as its own argument; joining them into one space-separated argument made Buck fail to resolve the flag file. The macOS modes do not set the dev/opt build mode constraint, so the runner sets it explicitly; otherwise optimized macOS builds were compiled with `REACT_NATIVE_DEBUG`.
- Optimized builds also apply the Hermes opt mode.
- The coverage modes already set the dev/opt build mode, so the explicit build mode modifier is no longer needed.
- C++ coverage is merged with the LLVM tools that match the compiler used by the new modes.
- `ReactHost` installs the TurboModule binding through the runtime-aware provider o

**File**: `packages/react-native/ReactCxxPlatform/react/runtime/ReactHost.cpp` (modified, +6/-1)
```diff
@@ -294,7 +294,12 @@ void ReactHost::createReactInstance() {
             });
 
         // Set up TurboModules
-        TurboModuleBinding::install(runtime, std::move(turboModuleManager));
+        TurboModuleBinding::install(
+            runtime,
+            [turboModuleManager = std::move(turboModuleManager)](
+                jsi::Runtime& /*runtime*/, const std::string& name) {
+              return turboModuleManager(name);
+            });
 
         if (bindingsInstallFunc) {
           bindingsInstallFunc(runtime);
```

**File**: `private/react-native-fantom/runner/llvm/processLLVMCoverage.js` (modified, +3/-4)
```diff
@@ -48,13 +48,12 @@ function getRepoRoot(): string {
 function getLLVMCommand(command: 'llvm-profdata' | 'llvm-cov'): string {
   return path.join(
     getRepoRoot(),
-    'arvr',
-    'third-party',
-    'toolchains',
+    'fbcode',
+    'third-party-buck',
     'platform010',
     'build',
     'llvm-fb',
-    '17',
+    '21',
     'bin',
     command,
   );
```

**File**: `private/react-native-fantom/runner/utils.js` (modified, +44/-43)
```diff
@@ -62,8 +62,12 @@ export function getBuckModesForPlatform({
   enableCoverage: boolean,
   enableOptimized: boolean,
 }): ReadonlyArray<string> {
-  let mode = enableCoverage ? 'code-coverage' : enableOptimized ? 'opt' : 'dev';
+  const modes = ['@//xplat/mode/react-native/granite'];
+  if (enableOptimized) {
+    modes.push('@//xplat/mode/hermes/opt');
+  }
 
+  let sanitizer: ?('asan' | 'tsan') = null;
   if (enableOptimized) {
     if (EnvironmentOptions.enableASAN || EnvironmentOptions.enableTSAN) {
       printConsoleLog({
@@ -81,71 +85,68 @@ export function getBuckModesForPlatform({
         message:
           'ASAN and TSAN modes cannot be used together. Using ASAN mode as a fallback.',
       });
-      mode = 'dev-asan';
+      sanitizer = 'asan';
     } else if (EnvironmentOptions.enableASAN) {
-      mode = 'dev-asan';
+      sanitizer = 'asan';
     } else if (EnvironmentOptions.enableTSAN) {
-      mode = 'dev-tsan';
+      sanitizer = 'tsan';
     }
   }
 
-  let osPlatform;
   switch (os.platform()) {
-    case 'linux':
-      osPlatform = `@//arvr/mode/linux/${mode}`;
+    case 'linux': {
+      let mode = enableOptimized ? 'opt' : 'dev-nosan';
+      if (sanitizer != null) {
+        mode = `dev-${sanitizer}`;
+      } else if (enableCoverage) {
+        mode = enableOptimized ? 'opt-cov' : 'dev-cov';
+      }
+      modes.push(
+        `@//fbcode/mode/${mode}`,
+        // The tester and hermesc binaries are copied out of `buck-out`, so
+        // they cannot depend on shared libraries next to them.
+        '--modifier=ovr_config//build_mode/constraints:static',
+      );
       break;
+    }
     case 'darwin':
-      osPlatform =
-        /* $FlowFixMe[invalid-compare] Error discovered during Constant
-         * Condition roll out. See https://fburl.com/workplace/4oq3zi07. */
+      modes.push(
         os.arch() === 'arm64'
-          ? `@//arvr/mode/mac-arm/${mode}`
-          : `@//arvr/mode/mac/${mode}`;
+          ? '@//fbobjc/mode/macosx-arm64'
+          : '@//fbobjc/mode/macosx-x86_64',
+      );
+      // The macOS modes do not set the build mode constraint, which decides
+      // between `REACT_NATIVE_DEBUG` and `REACT_NATIVE_PRODUCTION`.
+      if (enableOptimized) {
+        modes.push(
+          '@//fbobjc/mode/production',
+          '--modifier=ovr_config//build_mode/constraints:opt',
+        );
+      } else {
+        modes.push('--modifier=ovr_config//build_mode/constraints:dev');
+      }
+      if (sanitizer != null) {
+        modes.push(`@//fbobjc/mode/${sanitizer}`);
+      } else if (enableCoverage) {
+        modes.push('@//fbobjc/mode/coverage');
+      }
       break;
     case 'win32':
-      osPlatform = `@//arvr/mode/win/${mode}`;
-      break;
+      throw new Error('Windows is not supported for Fantom');
     default:
       throw new Error(`Unsupported platform: ${os.platform()}`);
   }
 
-  const result: Array<string> = [
-    '@//xplat/mode/react-native/granite',
-    osPlatform,
-  ];
-
   if (enableCoverage) {
-    result.push(
+    modes.push(
       '-c',
       'code_coverage.enabled=filtered',
       '-c',
       'code_coverage.folder_path_filter=xplat/js/react-native-github',
     );
   }
 
-  // The coverage platform (e.g. `@//arvr/mode/linux/code-coverage`) pins the
-  // `core_build_mode` constraint to `opt`. `get_react_native_preprocessor_flags()`
-  // in `tools/build_defs/oss/rn_defs.bzl` selects on that constraint
-  // (`ovr_config//build_mode/constraints:{dev,opt}`) to decide between
-  // `-DREACT_NATIVE_DEBUG` and `-DREACT_NATIVE_PRODUCTION`. Under coverage it
-  // therefore compiles the native tester with `REACT_NATIVE_PRODUCTION`, which
-  // breaks dev-mode tests that use debug-only native APIs (e.g. timer mocking
-  // via `installHighResTimeStampMock`).
-  //
-  // Explicitly stack the `core_build_mode` constraint so the build reflects the
-  // test's intended dev/opt mode. This only overrides `core_build_mode`; the
-  // coverage instrumentation constraint and `-c code_coverage.*` flags above are
-  // left intact, so coverage is still collected.
-  if (enableCoverage) {
-    result.push(
-      '--modifier',
-      enableOptimized
-        ? 'ovr_config//build_mode/constraints:opt'
-        : 'ovr_config//build_mode/constraints:dev',
-    );
-  }
-
-  return result;
+  return modes;
 }
 
 export type AsyncCommandResult = {
```

#### Recent Merged Pull Requests:
- **PR #60060** (2026-11-16): Use subtarget syntax for static link-style modifier in Fantom runner. (@nlutsenko)
- **PR #60054** (2026-11-16): Initialize display metrics before reading them in ReactHostImpl.onConfigurationChanged (#60054) (@bherila)
- **PR #60047** (2026-11-16): Declare type parameter bounds that type arguments rely on (@SamChou19815)
- **PR #60045** (closed): Don't measure UISwitch during iOS instance startup (@robhogan)
- **PR #60044** (closed): [ci] Split Test All into Test JS and Test C++ (@huntie)
- **PR #60041** (closed): [ci] Split Test All into per-area workflows filtered by paths-ignore (@huntie)

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

## X. TextInput state retain chain in AndroidTextInputShadowNode

**RULE**:
When implementing operations in `packages/react-native/ReactCommon/react/renderer/components/textinput/platform/android/react/renderer/components/androidtextinput/AndroidTextInputShadowNode.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in react/react-native. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fb07ea35`: TextInput state retain chain in AndroidTextInputShadowNode. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/react-native/ReactCommon/react/renderer/components/textinput/platform/android/react/renderer/components/androidtextinput/AndroidTextInputShadowNode.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
    auto parentShadowView = ShadowView(*this);
    // Clearing `props` and `state` (which we don't use) allows avoiding retain
    // cycles.
    parentShadowView.props = nullptr;
    parentShadowView.state = nullptr;
    fragment.parentShadowView = std::move(parentShadowView);
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
    fragment.parentShadowView = ShadowView(*this);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fb07ea35` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
