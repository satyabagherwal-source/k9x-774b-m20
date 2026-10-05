# Forensic Learning Record (Deep Inspection): react/react-native

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-react-native-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react/react-native](https://github.com/react/react-native))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:07:41.684Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react/react-native`
- **Description**: A framework for building native applications using React
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 126800 stars

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

### Core Architecture Module: `packages/dev-middleware/src/utils/DefaultToolLauncher.js`
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

import type {DebuggerShellPreparationResult} from '../types/DevToolLauncher';

const {
  unstable_prepareDebuggerShell,
  unstable_spawnDebuggerShellWithArgs,
} = require('@react-native/debugger-shell');
const open = require('open');

const {apps, openApp} = open;

/**
 * Default `DevToolLauncher` implementation which handles opening apps on the
 * local machine.
 */
const DefaultToolLauncher = {
  launchDebuggerAppWindow: async (url: string): Promise<void> => {
    if (process.env.NODE_ENV === 'test') {
      assertMockedInTests();
    }

    // NOTE: Since 0.88 this is a simplified approach, since app launching is
    // now handled by `launchDebuggerShell`. Frameworks may still override
    // `DevToolLauncher` with an improved fallback stack.
    try {
      const subprocess = await openApp(apps.chrome, {
        arguments: [`--app=${url}`],
        newInstance: true,
      });
      await new Promise<void>((resolve, reject) => {
        subprocess.once('error', reject);
        subprocess.once('exit', code => {
          code === 0
            ? resolve()
            : reject(new Error(`openApp exited with code ${code}`));
        });
      });
    } catch (e: unknown) {
      // Fall back to default browser - the frontend will warn if the browser
      // is not supported.
      await open(url);
    }
  },

  async launchDebuggerShell(url: string, windowKey: string): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      assertMockedInTests();
    }

    return await unstable_spawnDebuggerShellWithArgs([
      '--frontendUrl=' + url,
      '--windowKey=' + windowKey,
    ]);
  },

  async prepareDebuggerShell(
    prebuiltBinaryPath?: ?string,
  ): Promise<DebuggerShellPreparationResult> {
    if (process.env.NODE_ENV === 'test') {
      assertMockedInTests();
    }

    return await unstable_prepareDebuggerShell();
  },
};

function assertMockedInTests(): void {
  if (process.env.NODE_ENV === 'test') {
    throw new Error(
      'DefaultToolLauncher must be mocked or overridden in tests. ' +
        "Add jest.mock('../utils/DefaultAppLauncher') to test setup.",
    );
  }
}

export default DefaultToolLauncher;

```

### Core Architecture Module: `packages/dev-middleware/src/utils/__mocks__/DefaultToolLauncher.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @noflow
 * @format
 */

/**
 * Mock implementation of DefaultToolLauncher to prevent actual browser
 * and debugger-shell launches during tests.
 */
const DefaultToolLauncher = {
  launchDebuggerAppWindow: jest
    .fn()
    .mockImplementation(() => Promise.resolve()),
  launchDebuggerShell: jest.fn().mockImplementation(() => Promise.resolve()),
  prepareDebuggerShell: jest.fn().mockResolvedValue({code: 'not_implemented'}),
};

export default DefaultToolLauncher;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #56126** (2026-04-18): **[Android] HermesSamplingProfiler JNI "disable" method incorrectly mapped to ::enable**
  *Symptoms*: ## Bug Description  <!--   Please provide a clear and concise description of what the bug is with the   latest version of React Native and Hermes. Unfortunately we are unable to   provide fixes for old versions of Hermes.    If it's an exception, please include the screenshots, e.g. the React Native   RedBox screen includes a symbolicated JavaScript stack trace with a stack trace   when Metro is running (it's grayscale monospaced text on black background below   the red background section). Please also include a few lines of the JavaScript   source before and after the line in which the error occurs.    If it's an abort (e.g. app crashes), please see "Reporting crashes" from   <https://github.com/facebook/hermes/blob/HEAD/doc/ReactNativeIntegration.md#reporting-native-crashes>   for instructions on reporting a native crash, including symbolicating the native   stack trace.  Note this will only work with some versions of Hermes.    If you believe you have discovered a security vulnerability in Hermes, please   refrain from filing a public issue and instead submit it through the Meta Bug   Bounty program <https://www.facebook.com/whitehat>. -->  In `ReactAndroid/src/main/jni/react/hermes/instrumentation/HermesSamplingProfiler.cpp`, the `registerNatives()` function maps the JNI "disable" method to `HermesSamplingProfiler::enable` instead of   `HermesSamplingProfiler::disable:`  ```   void HermesSamplingProfiler::registerNatives() {     javaClassLocal()->registerNatives({        
  **Post-Mortem & Fix Analysis**:
  > > [!WARNING] > **Missing reproducer**: We could not detect a reproducible example in your issue report. Reproducers are **mandatory** and we can accept only one of those as a valid reproducer: <br/><ul><li>For majority of bugs: send us a Pull Request with the [RNTesterPlayground.js](https://github.com/facebook/react-native/blob/main/packages/rn-tester/js/examples/Playground/RNTesterPlayground.js) edited to reproduce your bug.</li><li>If your bug is UI related: a [Snack](https://snack.expo.dev)</li><li> If your bug is build/upgrade related: a project using our [Reproducer Template](https://github.com/react-native-community/reproducer-react-native/generate)</li></ul><br/>You can read more about about it on our website: [How to report a bug](https://reactnative.dev/contributing/how-to-report-a-bug).
  > This issue is waiting for author's feedback since 24 days. Please provide the requested feedback or this will be closed in 7 days.
  > This issue was closed because it has been stalled for 7 days with no activity.

- **Issue #53915** (2025-12-23): **Sandbox error when compiling iOS with Hermes: "Operation not permitted" and "No such file or directory" (Apple Silicon/Xcode)**
  *Symptoms*: ## Bug Description  I'm experiencing sandbox errors when building a React Native project with Hermes enabled on iOS. The build fails with messages related to the Hermes framework, such as:  Sandbox: rsync(...) deny(1) file-read-data .../hermes.framework/Info.plist Sandbox: rsync(...) deny(1) file-write-create .../hermes.framework/.hermes.XXXX hermes.framework/hermes: utimensat (2): No such file or directory Operation not permitted  ## Environment:  1. macOS: [Sonoma 14.2] 2. Xcode: [15.3] 3. React Native: 0.81.4 4. Hermes: default (bundled with React Native) 5. Apple Silicon: [M1]  ## What I have tried:  1. Gave Full Disk Access to Xcode in System Preferences. 2. Cleaned Xcode cache (rm -rf ~/Library/Developer/Xcode/DerivedData). 3. Ran pod deintegrate and pod install in the ios folder. 4. Updated all dependencies with yarn upgrade and pod update. 5. Built the project directly in Xcode. 6. Tried running Xcode under Rosetta. 7. Checked folder permissions with chown.  ## Detailed log:  Sandbox: rsync(7116) deny(1) file-read-data /Users/fredazevedo/Library/Developer/Xcode/DerivedData/associanet-fnbakryxbfssxlbjmkzzrxdalzcl/Build/Products/Debug-iphonesimulator/XCFrameworkIntermediates/hermes-engine/Pre-built/hermes.framework/Info.plist Sandbox: rsync(7117) deny(1) file-write-create /Users/fredazevedo/Library/Developer/Xcode/DerivedData/associanet-fnbakryxbfssxlbjmkzzrxdalzcl/Build/Products/Debug-iphonesimulator/associanet.app/Frameworks/hermes.framework/.hermes.h0TkeTJQAi hermes.
  **Post-Mortem & Fix Analysis**:
  > Hi, unfortunately this (the packaging and how it is consumed by Xcode) is not something that the Hermes team maintains and we can't help. I will ask around.
  > > [!WARNING] > **Missing reproducer**: We could not detect a reproducible example in your issue report. Reproducers are **mandatory** and we can accept only one of those as a valid reproducer: <br/><ul><li>For majority of bugs: send us a Pull Request with the [RNTesterPlayground.js](https://github.com/facebook/react-native/blob/main/packages/rn-tester/js/examples/Playground/RNTesterPlayground.js) edited to reproduce your bug.</li><li>If your bug is UI related: a [Snack](https://snack.expo.dev)</li><li> If your bug is build/upgrade related: a project using our [Reproducer Template](https://github.com/react-native-community/reproducer-react-native/generate)</li></ul><br/>You can read more about about it on our website: [How to report a bug](https://reactnative.dev/contributing/how-to-report-a-bug).
  > cc @cipolleschi 

- **Issue #51378** (2025-05-20): **Views with a specific non-transparent background color are being incorrectly flattened**
  *Symptoms*: ### Description  I noticed that, when using `rgba(255, 255, 255, ${127/256})` as the background color of a view that just has dimensions and background color, the view is being flattened by Fabric and not mounted on the host platform.  In this image, the black rectangle in the middle of the gradient is the one using that color:  ![Image](https://github.com/user-attachments/assets/12820470-c3bf-4e31-90f2-efc64c80b86b)  ### Steps to reproduce  Render a view using that color:  ```javascript return (   <View style={{     backgroundColor: `rgba(255, 255, 255, ${127/256})`,     width: 50,     height: 50,   }} /> ) ```  ### React Native Version  All  ### Affected Platforms  Runtime - Desktop, Runtime - iOS, Runtime - Android  ### Output of `npx @react-native-community/cli info`  ```text N/A ```  ### Stacktrace or Logs  ```text N/A ```  ### MANDATORY Reproducer  N/A  ### Screenshots and Videos  Already attached
  **Post-Mortem & Fix Analysis**:
  > > [!WARNING] > **Missing reproducer**: We could not detect a reproducible example in your issue report. Reproducers are **mandatory** and we can accept only one of those as a valid reproducer: <br/><ul><li>For majority of bugs: send us a Pull Request with the [RNTesterPlayground.js](https://github.com/facebook/react-native/blob/main/packages/rn-tester/js/examples/Playground/RNTesterPlayground.js) edited to reproduce your bug.</li><li>If your bug is UI related: a [Snack](https://snack.expo.dev)</li><li> If your bug is build/upgrade related: a project using our [Reproducer Template](https://github.com/react-native-community/reproducer-react-native/generate)</li></ul><br/>You can read more about about it on our website: [How to report a bug](https://reactnative.dev/contributing/how-to-report-a-bug).

- **Issue #49158** (2025-10-13): **[0.77][Android] Memory Profiling not working, causing dev tools to disconnect**
  *Symptoms*: ### Description  Hi folks, I've been trying to profile my apps memory usage using React Native DevTools but anytime I try to take a heap snapshot I get the following error:  ``` An error occurred when a call to method 'buildSnapshot' was requested  TypeError: Cannot read properties of undefined (reading 'length')     at b.initialize (http://127.0.0.1:8081/debugger-frontend/entrypoints/heap_snapshot_worker/heap_snapshot_worker.js:1:13359)     at new b (http://127.0.0.1:8081/debugger-frontend/entrypoints/heap_snapshot_worker/heap_snapshot_worker.js:1:33684)     at A.buildSnapshot (http://127.0.0.1:8081/debugger-frontend/entrypoints/heap_snapshot_worker/heap_snapshot_worker.js:1:43578)     at HeapSnapshotWorkerDispatcher.dispatchMessage (http://127.0.0.1:8081/debugger-frontend/entrypoints/heap_snapshot_worker/heap_snapshot_worker.js:1:47247) ```  This issue is not isolated to my android device, other people on my team are facing the same issue using other android devices and even on emulator.  ### Steps to reproduce  1. Create a new app using expo. 2. Upgrade it to RN 0.77 3. Connect a physical device using a wire. 4. Run the app, open dev tools, go to memory tab and click on `Take Snapshot` 5. Error  ### React Native Version  0.77.0  ### Output of `npx react-native info`  ```text System:   OS: macOS 14.5   CPU: (8) arm64 Apple M1   Memory: 63.67 MB / 16.00 GB   Shell:     version: "5.9"     path: /bin/zsh Binaries:   Node:     version: 18.20.4     path: ~/.nvm/versions/node/v18
  **Post-Mortem & Fix Analysis**:
  > > [!WARNING] > **Missing reproducer**: We could not detect a reproducible example in your issue report. Please provide either: <br/><ul><li>If your bug is UI related: a [Snack](https://snack.expo.dev)</li><li> If your bug is build/upgrade related: a project using our [Reproducer Template](https://github.com/react-native-community/reproducer-react-native/generate)</li><li>Otherwise send us a Pull Request with the [RNTesterPlayground.js](https://github.com/facebook/react-native/blob/main/packages/rn-tester/js/examples/Playground/RNTesterPlayground.js) edited to reproduce your bug.</li></ul>
  > Hi @Kartik4152!  - This looks valid, but I need more info / a reproducer. (Can you confirm this is an *empty* new Expo app, and what command was used to create?) - **Ideally**, I need the content of the failed Heap Snapshot in your app — this can be done by enabling the [Protocol Monitor](https://developer.chrome.com/docs/devtools/protocol-monitor#clear_and_download_cdp_messages) (link to a guide + how to download all messages).  **Pointer** (for maintainers): Stack trace appears to be one of the `.length` reads in [`HeapSnapshot#initialize`](https://github.com/ChromeDevTools/devtools-frontend/blob/c9afdb4745a76866f7486be0e5cdd4e2b270d8af/front_end/entrypoints/heap_snapshot_worker/HeapSnapshot.ts#L680).
  > Same exact issue on 0.76.x.  This is not an empty Expo app in our case, but identical issue.  Hermes with newArch.

- **Issue #48005** (2025-06-04): **requestAnimationFrame callback order is nondeterministic**
  *Symptoms*: ### Description  In my experience, the order of rAF callbacks is always deterministic on web. It [seems](https://stackoverflow.com/a/34905490) like it's deterministic per spec. In other words, this:  ```js requestAnimationFrame(() => {   console.log('1') })  requestAnimationFrame(() => {   console.log('2') })  requestAnimationFrame(() => {   console.log('3') }) ```  should produce  ``` 1 2 3 ```  That *is* the case on the web, but it's not in React Native.  Instead, on React Native, it's seemingly non-deterministic  ### Steps to reproduce  See this snack: https://snack.expo.dev/PsXPlo457DmfjCIEzRIsp?platform=ios  Expected:  ``` 1,2,3 ```  Actual:  <img width="435" alt="Screenshot 2024-11-28 at 14 16 09" src="https://github.com/user-attachments/assets/82824338-b2d7-40e3-a495-fd72fd13da25">  <img width="411" alt="Screenshot 2024-11-28 at 14 16 31" src="https://github.com/user-attachments/assets/2bd7ed08-2908-420a-8757-4d9f818bcf07">  I believe this is the case for:  - Both platforms on 0.74.* - Seemingly, only for Android on 0.76.* (maybe due to New Architecture being a default?)  ### React Native Version  0.76.0  ### Affected Platforms  Runtime - Android, Runtime - iOS  ### Output of `npx react-native info`  ```text System:   OS: macOS 14.6.1   CPU: (16) arm64 Apple M3 Max   Memory: 60.87 GB / 128.00 GB   Shell:     version: "5.9"     path: /bin/zsh Binaries:   Node:     version: 22.8.0     path: /opt/home
  **Post-Mortem & Fix Analysis**:
  > > [!TIP] > **Newer version available**: You are on a supported minor version, but it looks like there's a newer patch available - 0.76.3. Please [upgrade](https://reactnative.dev/docs/upgrading) to the highest patch for your minor or latest and verify if the issue persists (alternatively, create a new project and repro the issue in it). If it does not repro, please let us know so we can close out this issue. This helps us ensure we are looking at issues that still exist in the most recent releases.
  > > [!TIP] > **Newer version available**: You are on a supported minor version, but it looks like there's a newer patch available - undefined. Please [upgrade](https://reactnative.dev/docs/upgrading) to the highest patch for your minor or latest and verify if the issue persists (alternatively, create a new project and repro the issue in it). If it does not repro, please let us know so we can close out this issue. This helps us ensure we are looking at issues that still exist in the most recent releases.
  > The issue *is* present on the newest version. The problem is that the GitHub issue template forces me to output the result of running `npx react-native info` which is local but the reproducing case I'm using (an Expo Snack) is running 0.76. 

- **Issue #47905** (2024-11-26): **[Android] borderRadius & border(Top|Right|LeftBottom)Color='transparent' don't work properly together **
  *Symptoms*: ### Description  Hello,   When both `borderRadius` and on the borderRightColor (or any other edge) is set to transparent then Android ignores other borderColors set resulting with no borders being rendered.  Bug is only reproducible on Android. It works perfectly fine on iOS. We encountered this issue after bumping react-native version from `0.74.3` -> `0.76.2`. Bug still exists in RN `0.76.3`.  ## Example Example says more than 1000 words so here it is: https://snack.expo.dev/@adamfromattio/borderradius-and-transparent-borderright-bug?platform=android  ```     borderTopColor: 'orange',     borderBottomColor: 'magenta',     borderLeftColor: 'transparent',     borderRightColor: 'blue',     borderRadius: 10, ```  | iOS | Android | | ---- | ------- | |   ![CleanShot 2024-11-22 at 14 35 11](https://github.com/user-attachments/assets/979e7edd-a834-408a-987d-555a5a07e236) |  ![CleanShot 2024-11-22 at 14 32 21](https://github.com/user-attachments/assets/e8df2b25-3bbb-4d84-9dce-ac75e4cb2edc) |     ### Steps to reproduce  Set styles of a view to: ```     borderTopColor: 'orange',     borderBottomColor: 'magenta',     borderLeftColor: 'transparent',     borderRightColor: 'blue',     borderRadius: 10, ```  ### React Native Version  0.76.3  ### Affected Platforms  Runtime - Android  ### Output of `npx react-native info`  ```text info Fetching system and libraries information... System:   OS: macOS 14.7   CPU: (12) arm64 Apple M2 Max   M
  **Post-Mortem & Fix Analysis**:
  > Hey @TheAdamBorek,  Thank you for reporting this. Does this same issue occur with the new architecture enabled?
  > @jorge-cab 
  > Looking into it

- **Issue #47211** (2024-10-25): **[0.76][Regression] Resolved $NODE_BINARY with spaces fails Xcode build**
  *Symptoms*: ### Description  Building a new 0.76 project on iOS from Xcode is no longer completing, for particular system Node paths.  This is due to something we've changed in our Xcode script handling (apologies that I had to stop short of fixing this during today!).  - On my system, under [fnm](https://github.com/Schniz/fnm), the result of `with-environment.sh` is `~/Library/Application\ Support/fnm/node-versions/v20.12.0/installation/bin/node` — a path which contains a space character.     - This has come up before for other users (https://github.com/facebook/react-native/pull/21383). - When executed as part of the Xcode build phase `[Hermes] Replace Hermes for the right configuration, if needed`, the build fails due to this space breaking the executed command.  <img width="1360" alt="image" src="https://github.com/user-attachments/assets/f0f430aa-35bf-48d2-8869-0d384b0784c9">  | 0.75 | 0.76 | | - | - | | <img width="1440" alt="image" src="https://github.com/user-attachments/assets/4029e298-a645-4020-9f09-a4416ae3a651"> | <img width="861" alt="image" src="https://github.com/user-attachments/assets/aa2cbf57-494d-4afc-8384-ca27464b17e6"> | | ✅ Builds from Xcode | ❌ Fails |  Potentially related to https://github.com/facebook/react-native/issues/32984.   ### Steps to reproduce  Init new project and build with Xcode.  ```sh npx @react-native-community/cli@latest init RN076 --version 0.76.0 cd RN076/ xed ios ```  ### React Native Version  0.76.0  ### Affect
  **Post-Mortem & Fix Analysis**:
  > | :warning: | Missing Reproducible Example | | --- | --- | | :information_source: | We could not detect a reproducible example in your issue report. Please provide either: <br /><ul><li>If your bug is UI related: a [Snack](https://snack.expo.dev)</li><li> If your bug is build/update related: use our [Reproducer Template](https://github.com/react-native-community/reproducer-react-native/generate). A reproducer needs to be in a GitHub repository under your username.</li></ul> |
  > | :warning: | Missing Reproducible Example | | --- | --- | | :information_source: | We could not detect a reproducible example in your issue report. Please provide either: <br /><ul><li>If your bug is UI related: a [Snack](https://snack.expo.dev)</li><li> If your bug is build/update related: use our [Reproducer Template](https://github.com/react-native-community/reproducer-react-native/generate)</li></ul> |
  > Fixed by https://github.com/facebook/react-native/commit/eeaa3ff458a3e5c902075bb45161d6ccde31fe53  Pick request already lined up here: - https://github.com/reactwg/react-native-releases/issues/592

- **Issue #46966** (2024-10-22): **CDP Runtime.evaluate does not drain async tasks **
  *Symptoms*: ## Bug Description  I'm trying to run some automated testing scripts through the Hermes CDP interface using [Runtime.evaluate](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#method-evaluate).  First off, the `awaitPromises` flag does not seem to be supported at all. There are some work-arounds to this, so that's fine.  A bigger issue seems to be that after `Runtime.evaluate`, planned Promise tasks are not executed. What I see is usually after a second or 5-10, the queue is triggered and drained again. (I also tried to workaround this by running `HermesInternal.drainJobs` after every command, but [this is unexposed](https://github.com/facebook/hermes/blob/add4115869df5b78914fab0ca15d71ab958e8588/lib/VM/JSLib/HermesInternal.cpp#L815) without hermes-internal-test-methods flag see; I didn't manage to enable that flag in an otherwise vanilla RN project either.)  Tried to create a simple case to replicate, but the overall setup is pretty involving.
  **Post-Mortem & Fix Analysis**:
  > hi @EmielM,  The current Hermes CDP implementation is scoped to enable the set of features needed by the new RN debugger coming in 0.76. We specifically only meant for it to support the exact version of that RN DevTools.  Unfortunately `awaitPromises` isn't supported yet. We do want to close the gap but don't have timeline for that.  > There are some work-arounds to this  In terms of the workarounds you talked about, could you please elaborate what that is?  > planned Promise tasks are not executed  What RN version are you using?  The draining of microtask queue may be the responsibility of the code on the RN side and not something Hermes the engine controls. What are these promise tasks you're talking about? How are you creating them and what's the code you're using that's noticing them resolving after 5-10 seconds.  Having code speaks most clearly. Thanks.
  > Apologies, I c/should have been a bit more detailed, indeed. Thanks for your patience.  I attach a chrome inspector via CDP, then evaluate `(new Promise((resolve) => resolve('hey'))).then((x) => console.log(x));`.  Here's a screenshot that illustrates the (timing) issue: <img width="528" alt="hermes-lagging-promise-queue" src="https://github.com/user-attachments/assets/5db4344c-7016-4326-a5e1-5ab8ecf63178">  My hypothesis is that the task queue is simply not drained in the Hermes CDP client, and after a while some other message goes over the RN bridge or so and that triggers the pending queue to flush.  Logging the backend CDP interaction: ``` > {"id":552,"method":"Runtime.evaluate","params":{"expression":"(new Promise((resolve) =\u003e resolve('hey'))).then((x) =\u003e console.log(x ));","objectGroup":"console","includeCommandLineAPI":true,"silent":false,"returnByValue":false,"generatePreview":true,"userGesture":true,"awaitPromise":false,"replMode":true,"allowUnsafeEvalBlo
  > > One little update: I did find out that HermesInternal.useEngineQueue() is false in my set  @EmielM Right. That is only enabled with the New Architecture. But either way, Hermes doesn't control the event loop and the draining of the queue. I think we should transfer this issue to React Native.

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

### Incident Patch 1: `4e6bf240` (2026-10-05)
**Commit Message**: Include utils umbrella from renderer CSS headers (#58789)

Summary:
Pull Request resolved: https://github.com/react/react-native/pull/58789

The renderer CSS headers are framework-tier APIs, but several of them included fine-grained public `react/utils/*` headers directly. Those headers are guarded by the public umbrella guard, so a strict consumer that includes a CSS header without first including `<React/Utils.h>` hit a hard error even after acknowledging framework-tier usage with `RN_ALLOW_FRAMEWORKS`.

Include `<React/Utils.h>` from the affected CSS headers instead of the fine-grained utils headers, matching how other exported headers reach public modules. Export the utils dependency from the CSS Buck target, since utils is now part of the CSS headers' public interface; CMake and CocoaPods already expose it.

Changelog: [Internal]

Reviewed By: cipolleschi

Differential Revision: D122337018

fbshipit-source-id: 2ca13b7e730116676404f744770e7c1b68c99d32

**File**: `packages/react-native/ReactCommon/react/renderer/css/CSSAngleUnit.h` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 #include <optional>
 #include <string_view>
 
-#include <react/utils/fnv1a.h>
+#include <React/Utils.h>
 
 namespace facebook::react {
 
```

**File**: `packages/react-native/ReactCommon/react/renderer/css/CSSBackgroundImage.h` (modified, +1/-3)
```diff
@@ -12,6 +12,7 @@
 #include <optional>
 #include <variant>
 
+#include <React/Utils.h>
 #include <react/renderer/css/CSSAngle.h>
 #include <react/renderer/css/CSSColor.h>
 #include <react/renderer/css/CSSCompoundDataType.h>
@@ -21,9 +22,6 @@
 #include <react/renderer/css/CSSList.h>
 #include <react/renderer/css/CSSPercentage.h>
 #include <react/renderer/css/CSSValueParser.h>
-#include <react/utils/TemplateStringLiteral.h>
-#include <react/utils/fnv1a.h>
-#include <react/utils/iequals.h>
 
 namespace facebook::react {
 
```

**File**: `packages/react-native/ReactCommon/react/renderer/css/CSSColorFunction.h` (modified, +1/-2)
```diff
@@ -16,12 +16,11 @@
 #include <string_view>
 #include <tuple>
 
+#include <React/Utils.h>
 #include <react/renderer/css/CSSAngle.h>
 #include <react/renderer/css/CSSNumber.h>
 #include <react/renderer/css/CSSPercentage.h>
 #include <react/renderer/css/CSSValueParser.h>
-#include <react/utils/PackTraits.h>
-#include <react/utils/fnv1a.h>
 
 namespace facebook::react {
 
```

**File**: `packages/react-native/ReactCommon/react/renderer/css/CSSFilter.h` (modified, +1/-2)
```diff
@@ -13,6 +13,7 @@
 #include <optional>
 #include <variant>
 
+#include <React/Utils.h>
 #include <react/renderer/css/CSSColor.h>
 #include <react/renderer/css/CSSCompoundDataType.h>
 #include <react/renderer/css/CSSDataType.h>
@@ -21,8 +22,6 @@
 #include <react/renderer/css/CSSNumber.h>
 #include <react/renderer/css/CSSPercentage.h>
 #include <react/renderer/css/CSSZero.h>
-#include <react/utils/TemplateStringLiteral.h>
-#include <react/utils/iequals.h>
 
 namespace facebook::react {
 
```

**File**: `packages/react-native/ReactCommon/react/renderer/css/CSSFontVariant.h` (modified, +1/-1)
```diff
@@ -9,10 +9,10 @@
 
 #include <react/cxxstableapi/FrameworksGuard.h>
 
+#include <React/Utils.h>
 #include <react/renderer/css/CSSDataType.h>
 #include <react/renderer/css/CSSKeyword.h>
 #include <react/renderer/css/CSSList.h>
-#include <react/utils/to_underlying.h>
 
 namespace facebook::react {
 
```

**File**: `packages/react-native/ReactCommon/react/renderer/css/CSSHexColor.h` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 #include <optional>
 #include <string_view>
 
-#include <react/utils/toLower.h>
+#include <React/Utils.h>
 
 namespace facebook::react {
 
```

**File**: `packages/react-native/ReactCommon/react/renderer/css/CSSKeyword.h` (modified, +1/-2)
```diff
@@ -13,9 +13,8 @@
 #include <optional>
 #include <string_view>
 
+#include <React/Utils.h>
 #include <react/renderer/css/CSSDataType.h>
-#include <react/utils/fnv1a.h>
-#include <react/utils/to_underlying.h>
 
 namespace facebook::react {
 
```

**File**: `packages/react-native/ReactCommon/react/renderer/css/CSSLengthUnit.h` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
 #include <optional>
 #include <string_view>
 
-#include <react/utils/fnv1a.h>
+#include <React/Utils.h>
 
 namespace facebook::react {
 
```

---

### Incident Patch 2: `0aadc942` (2026-10-05)
**Commit Message**: Reclassify renderer CSS as for-frameworks (#58788)

Summary:
Pull Request resolved: https://github.com/react/react-native/pull/58788

Reclassify the renderer CSS headers (`react/renderer/css/*.h`) as framework-tier APIs by switching them from the public umbrella guard to the for-frameworks guard. Framework integrations keep access to the fine-grained headers and acknowledge that usage by defining `RN_ALLOW_FRAMEWORKS`.

Remove the `React/CSS.h` umbrella and stop publishing it from Buck, CocoaPods, Android prefab, the iOS prebuild header config, and the iOS prebuild header linking step. Its only consumer, the attributed string conversions header (itself framework-tier), now includes the CSS headers it uses (`CSSFontVariant.h` and `CSSValueParser.h`) directly.

Changelog: [Internal]

Reviewed By: cipolleschi

Differential Revision: D119642784

fbshipit-source-id: 676c78f396b4f6a23d118168a8a2a0e8121c0b4b

**File**: `packages/react-native/ReactAndroid/build.gradle.kts` (modified, +0/-1)
```diff
@@ -143,7 +143,6 @@ val preparePrefab by
                       Pair("../ReactCommon/react/renderer/core/React/", "React/"),
                       // react_renderer_css
                       Pair("../ReactCommon/react/renderer/css/", "react/renderer/css/"),
-                      Pair("../ReactCommon/react/renderer/css/React/", "React/"),
                       // react_debug
                       Pair("../ReactCommon/react/debug/", "react/debug/"),
                       Pair("../ReactCommon/react/debug/React/", "React/"),
```

**File**: `packages/react-native/ReactCommon/react/renderer/attributedstring/conversions.h` (modified, +2/-1)
```diff
@@ -9,7 +9,6 @@
 
 #include <react/cxxstableapi/FrameworksGuard.h>
 
-#include <React/CSS.h>
 #include <React/Debug.h>
 #include <React/RendererCore.h>
 #include <React/View.h>
@@ -18,6 +17,8 @@
 #include <react/renderer/attributedstring/ParagraphAttributes.h>
 #include <react/renderer/attributedstring/TextAttributes.h>
 #include <react/renderer/attributedstring/primitives.h>
+#include <react/renderer/css/CSSFontVariant.h>
+#include <react/renderer/css/CSSValueParser.h>
 #include <unordered_map>
 
 #ifdef RN_SERIALIZABLE_STATE
```

**File**: `packages/react-native/ReactCommon/react/renderer/css/CSSAngle.h` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 
 #pragma once
 
-#include <react/cxxstableapi/UmbrellaGuard.h>
+#include <react/cxxstableapi/FrameworksGuard.h>
 
 #include <optional>
 
```

**File**: `packages/react-native/ReactCommon/react/renderer/css/CSSAngleUnit.h` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 
 #pragma once
 
-#include <react/cxxstableapi/UmbrellaGuard.h>
+#include <react/cxxstableapi/FrameworksGuard.h>
 
 #include <cmath>
 #include <cstdint>
```

**File**: `packages/react-native/ReactCommon/react/renderer/css/CSSBackgroundImage.h` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 
 #pragma once
 
-#include <react/cxxstableapi/UmbrellaGuard.h>
+#include <react/cxxstableapi/FrameworksGuard.h>
 
 #include <optional>
 #include <variant>
```

**File**: `packages/react-native/ReactCommon/react/renderer/css/CSSColor.h` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 
 #pragma once
 
-#include <react/cxxstableapi/UmbrellaGuard.h>
+#include <react/cxxstableapi/FrameworksGuard.h>
 
 #include <optional>
 
```

**File**: `packages/react-native/ReactCommon/react/renderer/css/CSSColorFunction.h` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 
 #pragma once
 
-#include <react/cxxstableapi/UmbrellaGuard.h>
+#include <react/cxxstableapi/FrameworksGuard.h>
 
 #include <algorithm>
 #include <cmath>
```

**File**: `packages/react-native/ReactCommon/react/renderer/css/CSSCompoundDataType.h` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 
 #pragma once
 
-#include <react/cxxstableapi/UmbrellaGuard.h>
+#include <react/cxxstableapi/FrameworksGuard.h>
 
 #include <react/renderer/css/CSSDataType.h>
 
```

---

### Incident Patch 3: `f25e1881` (2026-10-05)
**Commit Message**: Use module umbrella headers in react/renderer/animated headers (#58729)

Summary:
Pull Request resolved: https://github.com/react/react-native/pull/58729

Replace direct includes of umbrella-guarded headers in the public and internal headers of `react/renderer/animated` with the module umbrellas: `<React/Debug.h>`, `<React/RendererCore.h>`, `<React/Graphics.h>`, `<React/Bridging.h>` and `<React/NativeModuleCore.h>`.

`react/bridging` and `react/nativemodule/core` are added as explicit dependencies in Buck and CMake, and the `animated` CocoaPods subspec now depends on the `React-Fabric/coreUmbrella` and `ReactCommon/turbomodule/coreUmbrella` subspecs so the umbrella paths resolve.

Changelog: [Internal]

Reviewed By: christophpurrer

Differential Revision: D122315385

fbshipit-source-id: fb9e316d3b42af31390ab8f3fcf00fa37922845d

**File**: `packages/react-native/ReactCommon/React-Fabric.podspec` (modified, +2/-0)
```diff
@@ -60,6 +60,8 @@ Pod::Spec.new do |s|
 
   s.subspec "animated" do |ss|
     ss.dependency             "React-Fabric/animationbackend"
+    ss.dependency             "React-Fabric/coreUmbrella"
+    ss.dependency             "ReactCommon/turbomodule/coreUmbrella"
     ss.source_files         = podspec_sources("react/renderer/animated/**/*.{m,mm,cpp,h}", "react/renderer/animated/**/*.{h}")
     ss.exclude_files        = "react/renderer/animated/tests"
     ss.header_dir           = "react/renderer/animated"
```

**File**: `packages/react-native/ReactCommon/react/renderer/animated/AnimatedModule.h` (modified, +2/-2)
```diff
@@ -14,11 +14,11 @@
 #else
 #include <FBReactNativeSpec/FBReactNativeSpecJSI.h>
 #endif
-#include <ReactCommon/TurboModuleWithJSIBindings.h>
+#include <React/NativeModuleCore.h>
+#include <React/RendererCore.h>
 #include <folly/dynamic.h>
 #include <react/renderer/animated/NativeAnimatedNodesManager.h>
 #include <react/renderer/animated/NativeAnimatedNodesManagerProvider.h>
-#include <react/renderer/core/ReactPrimitives.h>
 #include <memory>
 #include <string>
 #include <variant>
```

**File**: `packages/react-native/ReactCommon/react/renderer/animated/CMakeLists.txt` (modified, +2/-0)
```diff
@@ -28,6 +28,8 @@ target_link_libraries(react_renderer_animated
       react_renderer_uimanager
       react_renderer_scheduler
       react_renderer_animationbackend
+      react_bridging
+      react_nativemodule_core
       glog
       folly_runtime
 )
```

**File**: `packages/react-native/ReactCommon/react/renderer/animated/EventEmitterListener.h` (modified, +1/-2)
```diff
@@ -12,8 +12,7 @@
 #include <mutex>
 #include <shared_mutex>
 
-#include <react/renderer/core/EventPayload.h>
-#include <react/renderer/core/ReactPrimitives.h>
+#include <React/RendererCore.h>
 
 namespace facebook::react {
 
```

**File**: `packages/react-native/ReactCommon/react/renderer/animated/MergedValueDispatcher.h` (modified, +1/-1)
```diff
@@ -9,8 +9,8 @@
 
 #include <react/cxxstableapi/FrameworksGuard.h>
 
+#include <React/RendererCore.h>
 #include <folly/dynamic.h>
-#include <react/renderer/core/ReactPrimitives.h>
 #include <functional>
 #include <mutex>
 
```

**File**: `packages/react-native/ReactCommon/react/renderer/animated/NativeAnimatedNodesManager.h` (modified, +3/-4)
```diff
@@ -14,15 +14,14 @@
 #else
 #include <FBReactNativeSpec/FBReactNativeSpecJSI.h>
 #endif
+#include <React/Bridging.h>
+#include <React/Debug.h>
+#include <React/RendererCore.h>
 #include <folly/dynamic.h>
-#include <react/bridging/Function.h>
-#include <react/debug/flags.h>
 #include <react/renderer/animated/EventEmitterListener.h>
 #include <react/renderer/animated/event_drivers/EventAnimationDriver.h>
 #include <react/renderer/animationbackend/AnimatedPropsBuilder.h>
 #include <react/renderer/animationbackend/AnimationBackend.h>
-#include <react/renderer/core/ReactPrimitives.h>
-#include <react/renderer/core/ShadowNode.h>
 #include <react/renderer/uimanager/UIManagerAnimationBackend.h>
 #include <chrono>
 #include <memory>
```

**File**: `packages/react-native/ReactCommon/react/renderer/animated/drivers/AnimationDriver.h` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
 
 #pragma once
 
-#include <react/debug/flags.h>
+#include <React/Debug.h>
 #include <react/renderer/animated/NativeAnimatedNodesManager.h>
 
 namespace facebook::react {
```

**File**: `packages/react-native/ReactCommon/react/renderer/animated/event_drivers/EventAnimationDriver.h` (modified, +1/-2)
```diff
@@ -13,8 +13,7 @@
 
 #pragma once
 
-#include <react/renderer/core/EventPayload.h>
-#include <react/renderer/core/ReactPrimitives.h>
+#include <React/RendererCore.h>
 #include <optional>
 #include <string>
 #include <vector>
```

---

### Incident Patch 4: `024b474c` (2026-10-03)
**Commit Message**: Fix use-after-free race in RCTInstance callFunctionOnJSModule (#58816)

Summary:
Pull Request resolved: https://github.com/react/react-native/pull/58816

## Changelog:

[Internal]

Reviewed By: zeyap

Differential Revision: D122831570

fbshipit-source-id: 924ffa228cadc454069b268a0fd1c1126953ba33

**File**: `packages/react-native/ReactCommon/react/runtime/platform/ios/ReactCommon/RCTInstance.mm` (modified, +7/-3)
```diff
@@ -171,10 +171,14 @@ - (void)dealloc
 
 - (void)callFunctionOnJSModule:(NSString *)moduleName method:(NSString *)method args:(NSArray *)args
 {
-  if (_valid) {
-    _reactInstance->callFunctionOnModule(
-        [moduleName UTF8String], [method UTF8String], convertIdToFollyDynamic(args ? args : @[]));
+  // This is called from arbitrary threads, while -invalidate destroys _reactInstance on
+  // the JS thread, so checking _valid and dereferencing have to happen as one step.
+  std::lock_guard<std::mutex> lock(_invalidationMutex);
+  if (!_valid || !_reactInstance) {
+    return;
   }
+  _reactInstance->callFunctionOnModule(
+      [moduleName UTF8String] ?: "", [method UTF8String] ?: "", convertIdToFollyDynamic(args ? args : @[]));
 }
 
 - (void)invalidate
```

---

### Incident Patch 5: `3928a43d` (2026-10-02)
**Commit Message**: Seal renderer View public boundary (#58787)

Summary:
Pull Request resolved: https://github.com/react/react-native/pull/58787

Reclassify the CSS-dependent View conversion headers as private implementation details:

- `BackgroundImagePropsConversions.h`
- `BoxShadowPropsConversions.h`
- `CSSConversions.h`
- `FilterPropsConversions.h`
- `propsConversions.h`

These headers now use the private guard and are removed from the `<React/View.h>` umbrella, along with `conversions.h`. The public `accessibilityPropsConversions.h` stays in the umbrella: it is CSS-free, and framework-tier headers such as the attributed string conversions reach the accessibility role parsers through it. `LayoutConformanceProps.h` now includes the public `conversions.h` and core `propsConversions.h` instead of the private View `propsConversions.h`, so the umbrella stays self-contained under the strict API.

Following the Graphics module, renderer CSS becomes an implementation dependency of View in Buck instead of an exported one. Header publishing in Buck, CocoaPods, SwiftPM, and Gradle prefab is unchanged, consistent with other private headers, and the C++ API snapshots are unchanged.

Changelog: [Internal]

Rev

**File**: `packages/react-native/ReactCommon/react/renderer/components/view/BackgroundImagePropsConversions.h` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 
 #pragma once
 
-#include <react/cxxstableapi/UmbrellaGuard.h>
+#include <react/cxxstableapi/PrivateGuard.h>
 
 #include <react/featureflags/ReactNativePublicFeatureFlags.h>
 #include <react/renderer/core/PropsParserContext.h>
```

**File**: `packages/react-native/ReactCommon/react/renderer/components/view/BoxShadowPropsConversions.h` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 
 #pragma once
 
-#include <react/cxxstableapi/UmbrellaGuard.h>
+#include <react/cxxstableapi/PrivateGuard.h>
 
 #include <react/renderer/core/PropsParserContext.h>
 #include <react/renderer/core/RawValue.h>
```

**File**: `packages/react-native/ReactCommon/react/renderer/components/view/CSSConversions.h` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 
 #pragma once
 
-#include <react/cxxstableapi/UmbrellaGuard.h>
+#include <react/cxxstableapi/PrivateGuard.h>
 
 #include <react/renderer/core/PropsParserContext.h>
 #include <react/renderer/core/RawValue.h>
```

**File**: `packages/react-native/ReactCommon/react/renderer/components/view/FilterPropsConversions.h` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 
 #pragma once
 
-#include <react/cxxstableapi/UmbrellaGuard.h>
+#include <react/cxxstableapi/PrivateGuard.h>
 
 #include <react/renderer/core/PropsParserContext.h>
 #include <react/renderer/core/RawValue.h>
```

**File**: `packages/react-native/ReactCommon/react/renderer/components/view/LayoutConformanceProps.h` (modified, +2/-1)
```diff
@@ -10,7 +10,8 @@
 #include <react/cxxstableapi/UmbrellaGuard.h>
 
 #include <react/renderer/components/view/YogaStylableProps.h>
-#include <react/renderer/components/view/propsConversions.h>
+#include <react/renderer/components/view/conversions.h>
+#include <react/renderer/core/propsConversions.h>
 
 namespace facebook::react {
 
```

**File**: `packages/react-native/ReactCommon/react/renderer/components/view/React/View.h` (modified, +0/-6)
```diff
@@ -33,14 +33,10 @@
 
 #include <react/renderer/components/view/AccessibilityPrimitives.h>
 #include <react/renderer/components/view/AccessibilityProps.h>
-#include <react/renderer/components/view/BackgroundImagePropsConversions.h>
 #include <react/renderer/components/view/BaseTouch.h>
 #include <react/renderer/components/view/BaseViewEventEmitter.h>
 #include <react/renderer/components/view/BaseViewProps.h>
-#include <react/renderer/components/view/BoxShadowPropsConversions.h>
-#include <react/renderer/components/view/CSSConversions.h>
 #include <react/renderer/components/view/ConcreteViewShadowNode.h>
-#include <react/renderer/components/view/FilterPropsConversions.h>
 #include <react/renderer/components/view/HostPlatformTouch.h>
 #include <react/renderer/components/view/HostPlatformViewEventEmitter.h>
 #include <react/renderer/components/view/HostPlatformViewProps.h>
@@ -60,9 +56,7 @@
 #include <react/renderer/components/view/YogaLayoutableShadowNode.h>
 #include <react/renderer/components/view/YogaStylableProps.h>
 #include <react/renderer/components/view/accessibilityPropsConversions.h>
-#include <react/renderer/components/view/conversions.h>
 #include <react/renderer/components/view/primitives.h>
-#include <react/renderer/components/view/propsConversions.h>
 
 #undef RN_UMBRELLA_CONTEXT
 #pragma pop_macro("RN_UMBRELLA_CONTEXT")
```

**File**: `packages/react-native/ReactCommon/react/renderer/components/view/propsConversions.h` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 
 #pragma once
 
-#include <react/cxxstableapi/UmbrellaGuard.h>
+#include <react/cxxstableapi/PrivateGuard.h>
 
 #include <react/renderer/components/view/conversions.h>
 #include <react/renderer/core/PropsParserContext.h>
```

---

### Incident Patch 6: `791835ef` (2026-10-02)
**Commit Message**: Make renderer View conversions CSS-free (#58786)

Summary:
Pull Request resolved: https://github.com/react/react-native/pull/58786

Move CSS-dependent View conversion implementations for Yoga lengths, value units, transforms, transform origins, and aspect ratios from the exported `conversions.h` header into `conversions.cpp`. Keep the supported conversion declarations public and preserve existing parsing behavior. This change is necessary to remove CSS headers leaks as visibility of CSS module will be changed to `for frameworks` eventually.

Update existing conversion tests to exercise the same paths through supported public entry points, and regenerate the C++ API snapshots to remove private helper declarations.

Changelog: [Internal]

Reviewed By: javache

Differential Revision: D119507215

fbshipit-source-id: 1d39e6099fdd07d08b3c0759f55904b2992476f2

**File**: `packages/react-native/ReactCommon/react/renderer/components/view/conversions.cpp` (added, +779/-0)
```diff
@@ -0,0 +1,779 @@
+/*
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ */
+
+#include "conversions.h"
+
+#include <react/debug/react_native_expect.h>
+#include <react/featureflags/ReactNativeFeatureFlags.h>
+#include <react/renderer/css/CSSAngle.h>
+#include <react/renderer/css/CSSNumber.h>
+#include <react/renderer/css/CSSPercentage.h>
+#include <react/renderer/css/CSSRatio.h>
+#include <react/renderer/css/CSSTransform.h>
+#include <react/renderer/css/CSSTransformOrigin.h>
+#include <react/renderer/css/CSSValueParser.h>
+#include <cmath>
+#include <optional>
+#include <string>
+#include <type_traits>
+#include <unordered_map>
+#include <variant>
+#include <vector>
+
+namespace facebook::react {
+
+void fromRawValue(
+    const PropsParserContext& /*context*/,
+    const RawValue& value,
+    yoga::Style::SizeLength& result) {
+  if (value.hasType<Float>()) {
+    result = yoga::StyleSizeLength::points((float)value);
+    return;
+  } else if (value.hasType<std::string>()) {
+    const auto stringValue = (std::string)value;
+    if (stringValue == "auto") {
+      result = yoga::StyleSizeLength::ofAuto();
+      return;
+    } else if (stringValue == "max-content") {
+      result = yoga::StyleSizeLength::ofMaxContent();
+      return;
+    } else if (stringValue == "stretch") {
+      result = yoga::StyleSizeLength::ofStretch();
+      return;
+    } else if (stringValue == "fit-content") {
+      result = yoga::StyleSizeLength::ofFitContent();
+      return;
+    } else {
+      auto parsed = parseCSSProperty<CSSNumber, CSSPercentage>(stringValue);
+      if (std::holds_alternative<CSSPercentage>(parsed)) {
+        result = yoga::StyleSizeLength::percent(
+            std::get<CSSPercentage>(parsed).value);
+        return;
+      } else if (std::holds_alternative<CSSNumber>(parsed)) {
+        result =
+            yoga::StyleSizeLength::points(std::get<CSSNumber>(parsed).value);
+        return;
+      }
+    }
+  }
+  result = yoga::StyleSizeLength::undefined();
+}
+
+void fromRawValue(
+    const PropsParserContext& context,
+    const RawValue& value,
+    yoga::Style::Length& result) {
+  if (value.hasType<Float>()) {
+    result = yoga::StyleLength::points((float)value);
+    return;
+  } else if (value.hasType<std::string>()) {
+    const auto stringValue = (std::string)value;
+    if (stringValue == "auto") {
+      result = yoga::StyleLength::ofAuto();
+      return;
+    } else {
+      auto parsed = parseCSSProperty<CSSNumber, CSSPercentage>(stringValue);
+      if (std::holds_alternative<CSSPercentage>(parsed)) {
+        result =
+            yoga::StyleLength::percent(std::get<CSSPercentage>(parsed).value);
+        return;
+      } else if (std::holds_alternative<CSSNumber>(parsed)) {
+        result = yoga::StyleLength::points(std::get<CSSNumber>(parsed).value);
+        return;
+      }
+    }
+  }
+  result = yoga::StyleLength::undefined();
+}
+
+void fromRawValue(
+    const PropsParserContext& context,
+    const RawValue& value,
+    YGValue& result) {
+  yoga::Style::Length length{};
+  fromRawValue(context, value, length);
+  result = (YGValue)length;
+}
+
+yoga::FloatOptional convertAspectRatio(
+    const PropsParserContext& /*context*/,
+    const RawValue& value) {
+  if (value.hasType<float>()) {
+    return yoga::FloatOptional((float)value);
+  }
+  if (ReactNativeFeatureFlags::enableNativeCSSParsing() &&
+      value.hasType<std::string>()) {
+    auto ratio = parseCSSProperty<CSSRatio>((std::string)value);
+    if (std::holds_alternative<CSSRatio>(ratio)) {
+      auto r = std::get<CSSRatio>(ratio);
+      if (!r.isDegenerate()) {
+        return yoga::FloatOptional(r.numerator / r.denominator);
+      }
+    }
+  }
+  return {};
+}
+
+namespace {
+
+std::optional<Float> toRadians(const RawValue& value) {
+  if (value.hasType<Float>()) {
+    return (Float)value;
+  }
+  if (!value.hasType<std::string>()) {
+    return {};
+  }
+
+  auto angle = parseCSSProperty<CSSAngle>((std::string)value);
+  if (std::holds_alternative<CSSAngle>(angle)) {
+    return static_cast<float>(
+        std::get<CSSAngle>(angle).degrees * M_PI / 180.0f);
+  }
+
+  return {};
+}
+
+} // namespace
+
+ValueUnit toValueUnit(const RawValue& value) {
+  if (value.hasType<Float>()) {
+    return ValueUnit((Float)value, UnitType::Point);
+  }
+  if (!value.hasType<std::string>()) {
+    return {};
+  }
+
+  auto pct = parseCSSProperty<CSSPercentage>((std::string)value);
+  if (std::holds_alternative<CSSPercentage>(pct)) {
+    return ValueUnit(std::get<CSSPercentage>(pct).value, UnitType::Percent);
+  }
+
+  return {};
+}
+
+void fromRawValue(
+    const PropsParserContext& /*context*/,
+    const RawValue& value,
+    ValueUnit& result) {
+  result = toValueUnit(value);
+}
+
+namespace {
+
+ValueUnit cssLengthPercentageToValueUnit(
+    const std::variant<CSSLengt
```

**File**: `packages/react-native/ReactCommon/react/renderer/components/view/conversions.h` (modified, +8/-636)
```diff
@@ -11,19 +11,11 @@
 
 #include <glog/logging.h>
 #include <react/debug/react_native_expect.h>
-#include <react/featureflags/ReactNativePublicFeatureFlags.h>
 #include <react/renderer/components/view/primitives.h>
 #include <react/renderer/core/LayoutMetrics.h>
 #include <react/renderer/core/PropsParserContext.h>
 #include <react/renderer/core/RawProps.h>
 #include <react/renderer/core/graphicsConversions.h>
-#include <react/renderer/css/CSSAngle.h>
-#include <react/renderer/css/CSSNumber.h>
-#include <react/renderer/css/CSSPercentage.h>
-#include <react/renderer/css/CSSRatio.h>
-#include <react/renderer/css/CSSTransform.h>
-#include <react/renderer/css/CSSTransformOrigin.h>
-#include <react/renderer/css/CSSValueParser.h>
 #include <react/renderer/debug/DebugStringConvertible.h>
 #include <react/renderer/debug/flags.h>
 #include <react/renderer/graphics/BackgroundPosition.h>
@@ -32,7 +24,6 @@
 #include <react/renderer/graphics/BlendMode.h>
 #include <react/renderer/graphics/Isolation.h>
 #include <react/renderer/graphics/LinearGradient.h>
-#include <react/renderer/graphics/PlatformColorParser.h>
 #include <react/renderer/graphics/Transform.h>
 #include <react/renderer/graphics/ValueUnit.h>
 #include <yoga/YGEnums.h>
@@ -446,645 +437,26 @@ inline void fromRawValue(const PropsParserContext &context, const RawValue &valu
   LOG(ERROR) << "Could not parse yoga::Display: " << stringValue;
 }
 
-inline void fromRawValue(const PropsParserContext & /*context*/, const RawValue &value, yoga::Style::SizeLength &result)
-{
-  if (value.hasType<Float>()) {
-    result = yoga::StyleSizeLength::points((float)value);
-    return;
-  } else if (value.hasType<std::string>()) {
-    const auto stringValue = (std::string)value;
-    if (stringValue == "auto") {
-      result = yoga::StyleSizeLength::ofAuto();
-      return;
-    } else if (stringValue == "max-content") {
-      result = yoga::StyleSizeLength::ofMaxContent();
-      return;
-    } else if (stringValue == "stretch") {
-      result = yoga::StyleSizeLength::ofStretch();
-      return;
-    } else if (stringValue == "fit-content") {
-      result = yoga::StyleSizeLength::ofFitContent();
-      return;
-    } else {
-      auto parsed = parseCSSProperty<CSSNumber, CSSPercentage>(stringValue);
-      if (std::holds_alternative<CSSPercentage>(parsed)) {
-        result = yoga::StyleSizeLength::percent(std::get<CSSPercentage>(parsed).value);
-        return;
-      } else if (std::holds_alternative<CSSNumber>(parsed)) {
-        result = yoga::StyleSizeLength::points(std::get<CSSNumber>(parsed).value);
-        return;
-      }
-    }
-  }
-  result = yoga::StyleSizeLength::undefined();
-}
+void fromRawValue(const PropsParserContext & /*context*/, const RawValue &value, yoga::Style::SizeLength &result);
 
-inline void fromRawValue(const PropsParserContext &context, const RawValue &value, yoga::Style::Length &result)
-{
-  if (value.hasType<Float>()) {
-    result = yoga::StyleLength::points((float)value);
-    return;
-  } else if (value.hasType<std::string>()) {
-    const auto stringValue = (std::string)value;
-    if (stringValue == "auto") {
-      result = yoga::StyleLength::ofAuto();
-      return;
-    } else {
-      auto parsed = parseCSSProperty<CSSNumber, CSSPercentage>(stringValue);
-      if (std::holds_alternative<CSSPercentage>(parsed)) {
-        result = yoga::StyleLength::percent(std::get<CSSPercentage>(parsed).value);
-        return;
-      } else if (std::holds_alternative<CSSNumber>(parsed)) {
-        result = yoga::StyleLength::points(std::get<CSSNumber>(parsed).value);
-        return;
-      }
-    }
-  }
-  result = yoga::StyleLength::undefined();
-}
+void fromRawValue(const PropsParserContext &context, const RawValue &value, yoga::Style::Length &result);
 
-inline void fromRawValue(const PropsParserContext &context, const RawValue &value, YGValue &result)
-{
-  yoga::Style::Length length{};
-  fromRawValue(context, value, length);
-  result = (YGValue)length;
-}
+void fromRawValue(const PropsParserContext &context, const RawValue &value, YGValue &result);
 
 inline void fromRawValue(const PropsParserContext &context, const RawValue &value, yoga::FloatOptional &result)
 {
   result = value.hasType<float>() ? yoga::FloatOptional((float)value) : yoga::FloatOptional();
 }
 
-inline yoga::FloatOptional convertAspectRatio(const PropsParserContext & /*context*/, const RawValue &value)
-{
-  if (value.hasType<float>()) {
-    return yoga::FloatOptional((float)value);
-  }
-  if (ReactNativeFeatureFlags_DO_NOT_USE::enableNativeCSSParsing() && value.hasType<std::string>()) {
-    auto ratio = parseCSSProperty<CSSRatio>((std::string)value);
-    if (std::holds_alternative<CSSRatio>(ratio)) {
-      auto r = std::get<CSSRatio>(ratio);
-      if (!r.isDegenerate()) {
-        return yoga::FloatOptional(r.numerator / r.denominator);
-      }
-    }
-  }
-  return {};
-}
-
-inline std::optional<Float> toRadians(const RawValue &value)
-{
-  if (value.hasTy
```

**File**: `packages/react-native/ReactCommon/react/renderer/components/view/tests/ConversionsTest.cpp` (modified, +61/-54)
```diff
@@ -379,10 +379,10 @@ TEST_F(NativeCSSConversionsTest, unprocessed_filter_objects_unknown_type) {
   EXPECT_TRUE(filters.empty());
 }
 
-TEST(ConversionsTest, unprocessed_transform_css_string) {
+TEST_F(NativeCSSConversionsTest, unprocessed_transform_css_string) {
+  RawValue value{folly::dynamic("rotate(45deg) scale(2) translateX(10px)")};
   Transform result;
-  parseUnprocessedTransformString(
-      "rotate(45deg) scale(2) translateX(10px)", result);
+  fromRawValue(PropsParserContext{-1, ContextContainer{}}, value, result);
 
   EXPECT_EQ(result.operations.size(), 3);
 
@@ -405,9 +405,10 @@ TEST(ConversionsTest, unprocessed_transform_css_string) {
   EXPECT_EQ(result.operations[2].y.value, 0.0f);
 }
 
-TEST(ConversionsTest, unprocessed_transform_css_translate_percent) {
+TEST_F(NativeCSSConversionsTest, unprocessed_transform_css_translate_percent) {
+  RawValue value{folly::dynamic("translate(10px, 50%)")};
   Transform result;
-  parseUnprocessedTransformString("translate(10px, 50%)", result);
+  fromRawValue(PropsParserContext{-1, ContextContainer{}}, value, result);
 
   EXPECT_EQ(result.operations.size(), 1);
   EXPECT_EQ(result.operations[0].type, TransformOperationType::Translate);
@@ -417,27 +418,28 @@ TEST(ConversionsTest, unprocessed_transform_css_translate_percent) {
   EXPECT_EQ(result.operations[0].y.unit, UnitType::Percent);
 }
 
-TEST(ConversionsTest, unprocessed_transform_css_perspective) {
+TEST_F(NativeCSSConversionsTest, unprocessed_transform_css_perspective) {
+  RawValue value{folly::dynamic("perspective(500px)")};
   Transform result;
-  parseUnprocessedTransformString("perspective(500px)", result);
+  fromRawValue(PropsParserContext{-1, ContextContainer{}}, value, result);
 
   EXPECT_EQ(result.operations.size(), 1);
   EXPECT_EQ(result.operations[0].type, TransformOperationType::Perspective);
   EXPECT_EQ(result.operations[0].x.value, 500.0f);
 }
 
-TEST(ConversionsTest, unprocessed_transform_css_invalid_string) {
+TEST_F(NativeCSSConversionsTest, unprocessed_transform_css_invalid_string) {
+  RawValue value{folly::dynamic("not-a-transform")};
   Transform result;
-  parseUnprocessedTransformString("not-a-transform", result);
+  fromRawValue(PropsParserContext{-1, ContextContainer{}}, value, result);
 
   EXPECT_TRUE(result.operations.empty());
 }
 
-TEST(ConversionsTest, unprocessed_transform_rawvalue_string) {
+TEST_F(NativeCSSConversionsTest, unprocessed_transform_rawvalue_string) {
   RawValue value{folly::dynamic("rotate(45deg) scale(2)")};
   Transform result;
-  parseUnprocessedTransform(
-      PropsParserContext{-1, ContextContainer{}}, value, result);
+  fromRawValue(PropsParserContext{-1, ContextContainer{}}, value, result);
 
   EXPECT_EQ(result.operations.size(), 2);
   EXPECT_EQ(result.operations[0].type, TransformOperationType::Rotate);
@@ -449,8 +451,7 @@ TEST(ConversionsTest, unprocessed_transform_rawvalue_array) {
       folly::dynamic::object("rotate", "45deg"),
       folly::dynamic::object("scale", 2))};
   Transform result;
-  parseUnprocessedTransform(
-      PropsParserContext{-1, ContextContainer{}}, value, result);
+  fromRawValue(PropsParserContext{-1, ContextContainer{}}, value, result);
 
   EXPECT_EQ(result.operations.size(), 2);
   EXPECT_EQ(result.operations[0].type, TransformOperationType::Rotate);
@@ -465,8 +466,7 @@ TEST(ConversionsTest, unprocessed_transform_rawvalue_matrix) {
           folly::dynamic::array(
               1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)))};
   Transform result;
-  parseUnprocessedTransform(
-      PropsParserContext{-1, ContextContainer{}}, value, result);
+  fromRawValue(PropsParserContext{-1, ContextContainer{}}, value, result);
 
   EXPECT_EQ(result.operations.size(), 1);
   EXPECT_EQ(result.operations[0].type, TransformOperationType::Arbitrary);
@@ -476,18 +476,18 @@ TEST(ConversionsTest, unprocessed_transform_rawvalue_translate_percent) {
   RawValue value{
       folly::dynamic::array(folly::dynamic::object("translateX", "50%"))};
   Transform result;
-  parseUnprocessedTransform(
-      PropsParserContext{-1, ContextContainer{}}, value, result);
+  fromRawValue(PropsParserContext{-1, ContextContainer{}}, value, result);
 
   EXPECT_EQ(result.operations.size(), 1);
   EXPECT_EQ(result.operations[0].type, TransformOperationType::Translate);
   EXPECT_EQ(result.operations[0].x.value, 50.0f);
   EXPECT_EQ(result.operations[0].x.unit, UnitType::Percent);
 }
 
-TEST(ConversionsTest, unprocessed_transform_origin_css_top_left) {
+TEST_F(NativeCSSConversionsTest, unprocessed_transform_origin_css_top_left) {
+  RawValue value{folly::dynamic("top left")};
   TransformOrigin result;
-  parseUnprocessedTransformOriginString("top left", result);
+  fromRawValue(PropsParserContext{-1, ContextContainer{}}, value, result);
 
   EXPECT_EQ(result.xy[0].value, 0.0f);
   EXPECT_EQ(result.xy[0].unit, UnitType::Percent);
@@ -496,9 +496,10 @@ TEST(ConversionsTest, unprocessed_transform_origin_css_top_left) {
   EXPECT_EQ(resu
```

**File**: `scripts/cxx-api/api-snapshots/ReactAndroidDebugCxx.api` (modified, +0/-9)
```diff
@@ -900,7 +900,6 @@ facebook::react::Size facebook::react::ModalHostViewScreenSize(void);
 facebook::react::Size facebook::react::yogaMeassureToSize(int64_t value);
 facebook::react::SurfaceId facebook::react::getNextRootViewTag() noexcept;
 facebook::react::TurboModuleMethodValueKind facebook::react::getTurboModuleMethodValueKind(facebook::jsi::Runtime& rt, const facebook::jsi::Value* value);
-facebook::react::ValueUnit facebook::react::cssLengthPercentageToValueUnit(const std::variant<facebook::react::CSSLength, facebook::react::CSSPercentage>& value);
 facebook::react::ValueUnit facebook::react::toValueUnit(const facebook::react::RawValue& value);
 facebook::yoga::FloatOptional facebook::react::convertAspectRatio(const facebook::react::PropsParserContext&, const facebook::react::RawValue& value);
 facebook::yoga::FloatOptional facebook::react::yogaOptionalFloatFromFloat(facebook::react::Float value);
@@ -948,10 +947,8 @@ std::optional<facebook::react::BlendMode> facebook::react::blendModeFromString(s
 std::optional<facebook::react::FilterType> facebook::react::filterTypeFromString(std::string_view filterName);
 std::optional<facebook::react::Float> facebook::react::coerceLength(const facebook::react::RawValue& value);
 std::optional<facebook::react::Float> facebook::react::optionalFloatFromYogaValue(const facebook::yoga::Style::Length& length, std::optional<facebook::react::Float> base = {});
-std::optional<facebook::react::Float> facebook::react::toRadians(const facebook::react::RawValue& value);
 std::optional<facebook::react::FontVariant> facebook::react::fontVariantFromCSSFontVariant(facebook::react::CSSFontVariant cssVariant);
 std::optional<facebook::react::Isolation> facebook::react::isolationFromString(std::string_view isolationSetting);
-std::optional<facebook::react::TransformOperation> facebook::react::fromCSSTransformFunction(const facebook::react::CSSTransformFunction& cssTransform);
 std::pair<facebook::react::Float, facebook::react::Float> facebook::react::calculateAnimationProgress(uint64_t now, const facebook::react::LayoutAnimation& animation, const facebook::react::AnimationConfig& mutationConfig);
 std::string facebook::react::base64Encode(const std::string_view s);
 std::string facebook::react::componentNameByReactViewName(std::string viewName);
@@ -1144,16 +1141,10 @@ void facebook::react::g_setNativeAnimatedNowTimestampFunction(facebook::react::T
 void facebook::react::handleJSError(facebook::jsi::Runtime& runtime, const facebook::jsi::JSError& error, bool isFatal);
 void facebook::react::parseProcessedBackgroundImage(const facebook::react::PropsParserContext& context, const facebook::react::RawValue& value, std::vector<facebook::react::BackgroundImage>& result);
 void facebook::react::parseProcessedFontVariant(const facebook::react::PropsParserContext&, const facebook::react::RawValue& value, facebook::react::FontVariant& result);
-void facebook::react::parseProcessedTransform(const facebook::react::PropsParserContext&, const facebook::react::RawValue& value, facebook::react::Transform& result);
-void facebook::react::parseProcessedTransformOrigin(const facebook::react::PropsParserContext&, const facebook::react::RawValue& value, facebook::react::TransformOrigin& result);
 void facebook::react::parseUnprocessedBackgroundImageList(const facebook::react::PropsParserContext& context, const std::vector<facebook::react::RawValue>& value, std::vector<facebook::react::BackgroundImage>& result);
 void facebook::react::parseUnprocessedBackgroundImageString(const std::string& value, std::vector<facebook::react::BackgroundImage>& result);
 void facebook::react::parseUnprocessedFontVariant(const facebook::react::PropsParserContext& context, const facebook::react::RawValue& value, facebook::react::FontVariant& result);
 void facebook::react::parseUnprocessedFontVariantString(const std::string& value, facebook::react::FontVariant& result);
-void facebook::react::parseUnprocessedTransform(const facebook::react::PropsParserContext& context, const facebook::react::RawValue& value, facebook::react::Transform& result);
-void facebook::react::parseUnprocessedTransformOrigin(const facebook::react::PropsParserContext& context, const facebook::react::RawValue& value, facebook::react::TransformOrigin& result);
-void facebook::react::parseUnprocessedTransformOriginString(const std::string& value, facebook::react::TransformOrigin& result);
-void facebook::react::parseUnprocessedTransformString(const std::string& value, facebook::react::Transform& result);
 void facebook::react::reactAndroidLoggingHook(const std::string& message, unsigned int logLevel);
 void facebook::react::registerCxxModuleToGlobalModuleMap(std::string name, std::function<std::shared_ptr<facebook::react::TurboModule>(std::shared_ptr<facebook::react::CallInvoker> jsInvoker)> moduleProviderFunc);
 void facebook::react::serializeTransformAxis(const facebook::react::TransformOperation& operation, const std::string& operationName, float defau
```

**File**: `scripts/cxx-api/api-snapshots/ReactAndroidNewarchCxx.api` (modified, +0/-9)
```diff
@@ -899,7 +899,6 @@ facebook::react::Size facebook::react::ModalHostViewScreenSize(void);
 facebook::react::Size facebook::react::yogaMeassureToSize(int64_t value);
 facebook::react::SurfaceId facebook::react::getNextRootViewTag() noexcept;
 facebook::react::TurboModuleMethodValueKind facebook::react::getTurboModuleMethodValueKind(facebook::jsi::Runtime& rt, const facebook::jsi::Value* value);
-facebook::react::ValueUnit facebook::react::cssLengthPercentageToValueUnit(const std::variant<facebook::react::CSSLength, facebook::react::CSSPercentage>& value);
 facebook::react::ValueUnit facebook::react::toValueUnit(const facebook::react::RawValue& value);
 facebook::yoga::FloatOptional facebook::react::convertAspectRatio(const facebook::react::PropsParserContext&, const facebook::react::RawValue& value);
 facebook::yoga::FloatOptional facebook::react::yogaOptionalFloatFromFloat(facebook::react::Float value);
@@ -946,10 +945,8 @@ std::optional<facebook::react::BlendMode> facebook::react::blendModeFromString(s
 std::optional<facebook::react::FilterType> facebook::react::filterTypeFromString(std::string_view filterName);
 std::optional<facebook::react::Float> facebook::react::coerceLength(const facebook::react::RawValue& value);
 std::optional<facebook::react::Float> facebook::react::optionalFloatFromYogaValue(const facebook::yoga::Style::Length& length, std::optional<facebook::react::Float> base = {});
-std::optional<facebook::react::Float> facebook::react::toRadians(const facebook::react::RawValue& value);
 std::optional<facebook::react::FontVariant> facebook::react::fontVariantFromCSSFontVariant(facebook::react::CSSFontVariant cssVariant);
 std::optional<facebook::react::Isolation> facebook::react::isolationFromString(std::string_view isolationSetting);
-std::optional<facebook::react::TransformOperation> facebook::react::fromCSSTransformFunction(const facebook::react::CSSTransformFunction& cssTransform);
 std::pair<facebook::react::Float, facebook::react::Float> facebook::react::calculateAnimationProgress(uint64_t now, const facebook::react::LayoutAnimation& animation, const facebook::react::AnimationConfig& mutationConfig);
 std::string facebook::react::base64Encode(const std::string_view s);
 std::string facebook::react::componentNameByReactViewName(std::string viewName);
@@ -1140,16 +1137,10 @@ void facebook::react::g_setNativeAnimatedNowTimestampFunction(facebook::react::T
 void facebook::react::handleJSError(facebook::jsi::Runtime& runtime, const facebook::jsi::JSError& error, bool isFatal);
 void facebook::react::parseProcessedBackgroundImage(const facebook::react::PropsParserContext& context, const facebook::react::RawValue& value, std::vector<facebook::react::BackgroundImage>& result);
 void facebook::react::parseProcessedFontVariant(const facebook::react::PropsParserContext&, const facebook::react::RawValue& value, facebook::react::FontVariant& result);
-void facebook::react::parseProcessedTransform(const facebook::react::PropsParserContext&, const facebook::react::RawValue& value, facebook::react::Transform& result);
-void facebook::react::parseProcessedTransformOrigin(const facebook::react::PropsParserContext&, const facebook::react::RawValue& value, facebook::react::TransformOrigin& result);
 void facebook::react::parseUnprocessedBackgroundImageList(const facebook::react::PropsParserContext& context, const std::vector<facebook::react::RawValue>& value, std::vector<facebook::react::BackgroundImage>& result);
 void facebook::react::parseUnprocessedBackgroundImageString(const std::string& value, std::vector<facebook::react::BackgroundImage>& result);
 void facebook::react::parseUnprocessedFontVariant(const facebook::react::PropsParserContext& context, const facebook::react::RawValue& value, facebook::react::FontVariant& result);
 void facebook::react::parseUnprocessedFontVariantString(const std::string& value, facebook::react::FontVariant& result);
-void facebook::react::parseUnprocessedTransform(const facebook::react::PropsParserContext& context, const facebook::react::RawValue& value, facebook::react::Transform& result);
-void facebook::react::parseUnprocessedTransformOrigin(const facebook::react::PropsParserContext& context, const facebook::react::RawValue& value, facebook::react::TransformOrigin& result);
-void facebook::react::parseUnprocessedTransformOriginString(const std::string& value, facebook::react::TransformOrigin& result);
-void facebook::react::parseUnprocessedTransformString(const std::string& value, facebook::react::Transform& result);
 void facebook::react::reactAndroidLoggingHook(const std::string& message, unsigned int logLevel);
 void facebook::react::registerCxxModuleToGlobalModuleMap(std::string name, std::function<std::shared_ptr<facebook::react::TurboModule>(std::shared_ptr<facebook::react::CallInvoker> jsInvoker)> moduleProviderFunc);
 void facebook::react::serializeTransformAxis(const facebook::react::TransformOperation& operation, const std::string& operationName, float defau
```

**File**: `scripts/cxx-api/api-snapshots/ReactAndroidReleaseCxx.api` (modified, +0/-9)
```diff
@@ -900,7 +900,6 @@ facebook::react::Size facebook::react::ModalHostViewScreenSize(void);
 facebook::react::Size facebook::react::yogaMeassureToSize(int64_t value);
 facebook::react::SurfaceId facebook::react::getNextRootViewTag() noexcept;
 facebook::react::TurboModuleMethodValueKind facebook::react::getTurboModuleMethodValueKind(facebook::jsi::Runtime& rt, const facebook::jsi::Value* value);
-facebook::react::ValueUnit facebook::react::cssLengthPercentageToValueUnit(const std::variant<facebook::react::CSSLength, facebook::react::CSSPercentage>& value);
 facebook::react::ValueUnit facebook::react::toValueUnit(const facebook::react::RawValue& value);
 facebook::yoga::FloatOptional facebook::react::convertAspectRatio(const facebook::react::PropsParserContext&, const facebook::react::RawValue& value);
 facebook::yoga::FloatOptional facebook::react::yogaOptionalFloatFromFloat(facebook::react::Float value);
@@ -948,10 +947,8 @@ std::optional<facebook::react::BlendMode> facebook::react::blendModeFromString(s
 std::optional<facebook::react::FilterType> facebook::react::filterTypeFromString(std::string_view filterName);
 std::optional<facebook::react::Float> facebook::react::coerceLength(const facebook::react::RawValue& value);
 std::optional<facebook::react::Float> facebook::react::optionalFloatFromYogaValue(const facebook::yoga::Style::Length& length, std::optional<facebook::react::Float> base = {});
-std::optional<facebook::react::Float> facebook::react::toRadians(const facebook::react::RawValue& value);
 std::optional<facebook::react::FontVariant> facebook::react::fontVariantFromCSSFontVariant(facebook::react::CSSFontVariant cssVariant);
 std::optional<facebook::react::Isolation> facebook::react::isolationFromString(std::string_view isolationSetting);
-std::optional<facebook::react::TransformOperation> facebook::react::fromCSSTransformFunction(const facebook::react::CSSTransformFunction& cssTransform);
 std::pair<facebook::react::Float, facebook::react::Float> facebook::react::calculateAnimationProgress(uint64_t now, const facebook::react::LayoutAnimation& animation, const facebook::react::AnimationConfig& mutationConfig);
 std::string facebook::react::base64Encode(const std::string_view s);
 std::string facebook::react::componentNameByReactViewName(std::string viewName);
@@ -1144,16 +1141,10 @@ void facebook::react::g_setNativeAnimatedNowTimestampFunction(facebook::react::T
 void facebook::react::handleJSError(facebook::jsi::Runtime& runtime, const facebook::jsi::JSError& error, bool isFatal);
 void facebook::react::parseProcessedBackgroundImage(const facebook::react::PropsParserContext& context, const facebook::react::RawValue& value, std::vector<facebook::react::BackgroundImage>& result);
 void facebook::react::parseProcessedFontVariant(const facebook::react::PropsParserContext&, const facebook::react::RawValue& value, facebook::react::FontVariant& result);
-void facebook::react::parseProcessedTransform(const facebook::react::PropsParserContext&, const facebook::react::RawValue& value, facebook::react::Transform& result);
-void facebook::react::parseProcessedTransformOrigin(const facebook::react::PropsParserContext&, const facebook::react::RawValue& value, facebook::react::TransformOrigin& result);
 void facebook::react::parseUnprocessedBackgroundImageList(const facebook::react::PropsParserContext& context, const std::vector<facebook::react::RawValue>& value, std::vector<facebook::react::BackgroundImage>& result);
 void facebook::react::parseUnprocessedBackgroundImageString(const std::string& value, std::vector<facebook::react::BackgroundImage>& result);
 void facebook::react::parseUnprocessedFontVariant(const facebook::react::PropsParserContext& context, const facebook::react::RawValue& value, facebook::react::FontVariant& result);
 void facebook::react::parseUnprocessedFontVariantString(const std::string& value, facebook::react::FontVariant& result);
-void facebook::react::parseUnprocessedTransform(const facebook::react::PropsParserContext& context, const facebook::react::RawValue& value, facebook::react::Transform& result);
-void facebook::react::parseUnprocessedTransformOrigin(const facebook::react::PropsParserContext& context, const facebook::react::RawValue& value, facebook::react::TransformOrigin& result);
-void facebook::react::parseUnprocessedTransformOriginString(const std::string& value, facebook::react::TransformOrigin& result);
-void facebook::react::parseUnprocessedTransformString(const std::string& value, facebook::react::Transform& result);
 void facebook::react::reactAndroidLoggingHook(const std::string& message, unsigned int logLevel);
 void facebook::react::registerCxxModuleToGlobalModuleMap(std::string name, std::function<std::shared_ptr<facebook::react::TurboModule>(std::shared_ptr<facebook::react::CallInvoker> jsInvoker)> moduleProviderFunc);
 void facebook::react::serializeTransformAxis(const facebook::react::TransformOperation& operation, const std::string& operationName, float defau
```

**File**: `scripts/cxx-api/api-snapshots/ReactAppleDebugCxx.api` (modified, +0/-9)
```diff
@@ -3714,7 +3714,6 @@ facebook::react::Size facebook::react::ModalHostViewScreenSize(void);
 facebook::react::Size facebook::react::yogaMeassureToSize(int64_t value);
 facebook::react::SurfaceId facebook::react::getNextRootViewTag() noexcept;
 facebook::react::TurboModuleMethodValueKind facebook::react::getTurboModuleMethodValueKind(facebook::jsi::Runtime& rt, const facebook::jsi::Value* value);
-facebook::react::ValueUnit facebook::react::cssLengthPercentageToValueUnit(const std::variant<facebook::react::CSSLength, facebook::react::CSSPercentage>& value);
 facebook::react::ValueUnit facebook::react::toValueUnit(const facebook::react::RawValue& value);
 facebook::yoga::FloatOptional facebook::react::convertAspectRatio(const facebook::react::PropsParserContext&, const facebook::react::RawValue& value);
 facebook::yoga::FloatOptional facebook::react::yogaOptionalFloatFromFloat(facebook::react::Float value);
@@ -3746,10 +3745,8 @@ std::optional<facebook::react::BlendMode> facebook::react::blendModeFromString(s
 std::optional<facebook::react::FilterType> facebook::react::filterTypeFromString(std::string_view filterName);
 std::optional<facebook::react::Float> facebook::react::coerceLength(const facebook::react::RawValue& value);
 std::optional<facebook::react::Float> facebook::react::optionalFloatFromYogaValue(const facebook::yoga::Style::Length& length, std::optional<facebook::react::Float> base = {});
-std::optional<facebook::react::Float> facebook::react::toRadians(const facebook::react::RawValue& value);
 std::optional<facebook::react::FontVariant> facebook::react::fontVariantFromCSSFontVariant(facebook::react::CSSFontVariant cssVariant);
 std::optional<facebook::react::Isolation> facebook::react::isolationFromString(std::string_view isolationSetting);
-std::optional<facebook::react::TransformOperation> facebook::react::fromCSSTransformFunction(const facebook::react::CSSTransformFunction& cssTransform);
 std::pair<facebook::react::Float, facebook::react::Float> facebook::react::calculateAnimationProgress(uint64_t now, const facebook::react::LayoutAnimation& animation, const facebook::react::AnimationConfig& mutationConfig);
 std::string facebook::react::base64Encode(const std::string_view s);
 std::string facebook::react::componentNameByReactViewName(std::string viewName);
@@ -3944,16 +3941,10 @@ void facebook::react::handleJSError(facebook::jsi::Runtime& runtime, const faceb
 void facebook::react::installLegacyUIManagerConstantsProviderBinding(facebook::jsi::Runtime& runtime);
 void facebook::react::parseProcessedBackgroundImage(const facebook::react::PropsParserContext& context, const facebook::react::RawValue& value, std::vector<facebook::react::BackgroundImage>& result);
 void facebook::react::parseProcessedFontVariant(const facebook::react::PropsParserContext&, const facebook::react::RawValue& value, facebook::react::FontVariant& result);
-void facebook::react::parseProcessedTransform(const facebook::react::PropsParserContext&, const facebook::react::RawValue& value, facebook::react::Transform& result);
-void facebook::react::parseProcessedTransformOrigin(const facebook::react::PropsParserContext&, const facebook::react::RawValue& value, facebook::react::TransformOrigin& result);
 void facebook::react::parseUnprocessedBackgroundImageList(const facebook::react::PropsParserContext& context, const std::vector<facebook::react::RawValue>& value, std::vector<facebook::react::BackgroundImage>& result);
 void facebook::react::parseUnprocessedBackgroundImageString(const std::string& value, std::vector<facebook::react::BackgroundImage>& result);
 void facebook::react::parseUnprocessedFontVariant(const facebook::react::PropsParserContext& context, const facebook::react::RawValue& value, facebook::react::FontVariant& result);
 void facebook::react::parseUnprocessedFontVariantString(const std::string& value, facebook::react::FontVariant& result);
-void facebook::react::parseUnprocessedTransform(const facebook::react::PropsParserContext& context, const facebook::react::RawValue& value, facebook::react::Transform& result);
-void facebook::react::parseUnprocessedTransformOrigin(const facebook::react::PropsParserContext& context, const facebook::react::RawValue& value, facebook::react::TransformOrigin& result);
-void facebook::react::parseUnprocessedTransformOriginString(const std::string& value, facebook::react::TransformOrigin& result);
-void facebook::react::parseUnprocessedTransformString(const std::string& value, facebook::react::Transform& result);
 void facebook::react::registerCxxModuleToGlobalModuleMap(std::string name, std::function<std::shared_ptr<facebook::react::TurboModule>(std::shared_ptr<facebook::react::CallInvoker> jsInvoker)> moduleProviderFunc);
 void facebook::react::serializeTransformAxis(const facebook::react::TransformOperation& operation, const std::string& operationName, float defaultValue, folly::dynamic& resultTranslateArray);
 void facebook::react::serializeTransformOperationValue(const std
```

**File**: `scripts/cxx-api/api-snapshots/ReactAppleNewarchCxx.api` (modified, +0/-9)
```diff
@@ -3705,7 +3705,6 @@ facebook::react::Size facebook::react::ModalHostViewScreenSize(void);
 facebook::react::Size facebook::react::yogaMeassureToSize(int64_t value);
 facebook::react::SurfaceId facebook::react::getNextRootViewTag() noexcept;
 facebook::react::TurboModuleMethodValueKind facebook::react::getTurboModuleMethodValueKind(facebook::jsi::Runtime& rt, const facebook::jsi::Value* value);
-facebook::react::ValueUnit facebook::react::cssLengthPercentageToValueUnit(const std::variant<facebook::react::CSSLength, facebook::react::CSSPercentage>& value);
 facebook::react::ValueUnit facebook::react::toValueUnit(const facebook::react::RawValue& value);
 facebook::yoga::FloatOptional facebook::react::convertAspectRatio(const facebook::react::PropsParserContext&, const facebook::react::RawValue& value);
 facebook::yoga::FloatOptional facebook::react::yogaOptionalFloatFromFloat(facebook::react::Float value);
@@ -3736,10 +3735,8 @@ std::optional<facebook::react::BlendMode> facebook::react::blendModeFromString(s
 std::optional<facebook::react::FilterType> facebook::react::filterTypeFromString(std::string_view filterName);
 std::optional<facebook::react::Float> facebook::react::coerceLength(const facebook::react::RawValue& value);
 std::optional<facebook::react::Float> facebook::react::optionalFloatFromYogaValue(const facebook::yoga::Style::Length& length, std::optional<facebook::react::Float> base = {});
-std::optional<facebook::react::Float> facebook::react::toRadians(const facebook::react::RawValue& value);
 std::optional<facebook::react::FontVariant> facebook::react::fontVariantFromCSSFontVariant(facebook::react::CSSFontVariant cssVariant);
 std::optional<facebook::react::Isolation> facebook::react::isolationFromString(std::string_view isolationSetting);
-std::optional<facebook::react::TransformOperation> facebook::react::fromCSSTransformFunction(const facebook::react::CSSTransformFunction& cssTransform);
 std::pair<facebook::react::Float, facebook::react::Float> facebook::react::calculateAnimationProgress(uint64_t now, const facebook::react::LayoutAnimation& animation, const facebook::react::AnimationConfig& mutationConfig);
 std::string facebook::react::base64Encode(const std::string_view s);
 std::string facebook::react::componentNameByReactViewName(std::string viewName);
@@ -3933,16 +3930,10 @@ void facebook::react::handleJSError(facebook::jsi::Runtime& runtime, const faceb
 void facebook::react::installLegacyUIManagerConstantsProviderBinding(facebook::jsi::Runtime& runtime);
 void facebook::react::parseProcessedBackgroundImage(const facebook::react::PropsParserContext& context, const facebook::react::RawValue& value, std::vector<facebook::react::BackgroundImage>& result);
 void facebook::react::parseProcessedFontVariant(const facebook::react::PropsParserContext&, const facebook::react::RawValue& value, facebook::react::FontVariant& result);
-void facebook::react::parseProcessedTransform(const facebook::react::PropsParserContext&, const facebook::react::RawValue& value, facebook::react::Transform& result);
-void facebook::react::parseProcessedTransformOrigin(const facebook::react::PropsParserContext&, const facebook::react::RawValue& value, facebook::react::TransformOrigin& result);
 void facebook::react::parseUnprocessedBackgroundImageList(const facebook::react::PropsParserContext& context, const std::vector<facebook::react::RawValue>& value, std::vector<facebook::react::BackgroundImage>& result);
 void facebook::react::parseUnprocessedBackgroundImageString(const std::string& value, std::vector<facebook::react::BackgroundImage>& result);
 void facebook::react::parseUnprocessedFontVariant(const facebook::react::PropsParserContext& context, const facebook::react::RawValue& value, facebook::react::FontVariant& result);
 void facebook::react::parseUnprocessedFontVariantString(const std::string& value, facebook::react::FontVariant& result);
-void facebook::react::parseUnprocessedTransform(const facebook::react::PropsParserContext& context, const facebook::react::RawValue& value, facebook::react::Transform& result);
-void facebook::react::parseUnprocessedTransformOrigin(const facebook::react::PropsParserContext& context, const facebook::react::RawValue& value, facebook::react::TransformOrigin& result);
-void facebook::react::parseUnprocessedTransformOriginString(const std::string& value, facebook::react::TransformOrigin& result);
-void facebook::react::parseUnprocessedTransformString(const std::string& value, facebook::react::Transform& result);
 void facebook::react::registerCxxModuleToGlobalModuleMap(std::string name, std::function<std::shared_ptr<facebook::react::TurboModule>(std::shared_ptr<facebook::react::CallInvoker> jsInvoker)> moduleProviderFunc);
 void facebook::react::serializeTransformAxis(const facebook::react::TransformOperation& operation, const std::string& operationName, float defaultValue, folly::dynamic& resultTranslateArray);
 void facebook::react::serializeTransformOperationValue(const std
```

---

### Incident Patch 7: `148a6e0a` (2026-10-02)
**Commit Message**: Use umbrellas instead of direct includes in renderer core module (#58654)

Summary:
Pull Request resolved: https://github.com/react/react-native/pull/58654

Changelog: [Internal]

Update `react/renderer/core` to use the `React/Debug.h`, `React/FeatureFlags.h`, `React/Graphics.h`, `React/MapBuffer.h`, `React/RendererDebug.h`, `React/Timing.h` and `React/Utils.h` umbrellas instead of direct includes.

`debugStringConvertibleUtils.h` is an implementation helper, not public API, and is no longer re-exported from `React/RendererDebug.h`. Public API surface is unchanged.

Reviewed By: cipolleschi

Differential Revision: D121395742

fbshipit-source-id: a49a5fbcd220c580537cb7370f1d7441b704b4f8

**File**: `packages/react-native/ReactCommon/React-Fabric.podspec` (modified, +1/-0)
```diff
@@ -44,6 +44,7 @@ Pod::Spec.new do |s|
   s.dependency "React-debug"
   s.dependency "React-cxxstableapi"
   s.dependency "React-featureflags"
+  s.dependency "React-timing"
   s.dependency "React-runtimescheduler"
   s.dependency "React-cxxreact"
   s.dependency "React-bridging"
```

**File**: `packages/react-native/ReactCommon/react/renderer/core/CMakeLists.txt` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@ target_link_libraries(react_renderer_core
         react_renderer_graphics
         react_renderer_mapbuffer
         react_renderer_runtimescheduler
+        react_timing
         react_utils
         runtimeexecutor
         yoga)
```

**File**: `packages/react-native/ReactCommon/react/renderer/core/ConcreteComponentDescriptor.h` (modified, +2/-2)
```diff
@@ -12,7 +12,8 @@
 #include <memory>
 #include <vector>
 
-#include <react/debug/react_native_assert.h>
+#include <React/Debug.h>
+#include <React/Graphics.h>
 #include <react/featureflags/ReactNativePublicFeatureFlags.h>
 #include <react/renderer/core/ComponentDescriptor.h>
 #include <react/renderer/core/EventDispatcher.h>
@@ -21,7 +22,6 @@
 #include <react/renderer/core/ShadowNode.h>
 #include <react/renderer/core/ShadowNodeFragment.h>
 #include <react/renderer/core/State.h>
-#include <react/renderer/graphics/Float.h>
 
 namespace facebook::react {
 
```

**File**: `packages/react-native/ReactCommon/react/renderer/core/ConcreteShadowNode.h` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
 
 #include <react/cxxstableapi/UmbrellaGuard.h>
 
-#include <react/debug/react_native_assert.h>
+#include <React/Debug.h>
 #include <react/renderer/core/ConcreteState.h>
 #include <react/renderer/core/Props.h>
 #include <react/renderer/core/PropsParserContext.h>
```

**File**: `packages/react-native/ReactCommon/react/renderer/core/ConcreteState.h` (modified, +2/-3)
```diff
@@ -12,13 +12,12 @@
 #include <functional>
 #include <memory>
 
-#include <react/debug/react_native_assert.h>
+#include <React/Debug.h>
 #include <react/renderer/core/State.h>
 
 #ifdef RN_SERIALIZABLE_STATE
+#include <React/MapBuffer.h>
 #include <fbjni/fbjni.h>
-#include <react/renderer/mapbuffer/MapBuffer.h>
-#include <react/renderer/mapbuffer/MapBufferBuilder.h>
 #endif
 
 namespace facebook::react {
```

**File**: `packages/react-native/ReactCommon/react/renderer/core/EventEmitter.h` (modified, +1/-1)
```diff
@@ -12,13 +12,13 @@
 #include <memory>
 #include <mutex>
 
+#include <React/Timing.h>
 #include <folly/dynamic.h>
 #include <react/renderer/core/EventDispatcher.h>
 #include <react/renderer/core/EventPayload.h>
 #include <react/renderer/core/EventTarget.h>
 #include <react/renderer/core/ReactPrimitives.h>
 #include <react/renderer/core/ValueFactoryEventPayload.h>
-#include <react/timing/primitives.h>
 
 namespace facebook::react {
 
```

**File**: `packages/react-native/ReactCommon/react/renderer/core/EventLogger.h` (modified, +1/-1)
```diff
@@ -9,8 +9,8 @@
 
 #include <react/cxxstableapi/UmbrellaGuard.h>
 
+#include <React/Timing.h>
 #include <react/renderer/core/EventTarget.h>
-#include <react/timing/primitives.h>
 
 #include <optional>
 #include <string_view>
```

**File**: `packages/react-native/ReactCommon/react/renderer/core/EventPipe.h` (modified, +1/-1)
```diff
@@ -12,12 +12,12 @@
 #include <functional>
 #include <string>
 
+#include <React/Timing.h>
 #include <jsi/jsi.h>
 #include <react/renderer/core/EventPayload.h>
 #include <react/renderer/core/EventTarget.h>
 #include <react/renderer/core/ReactEventPriority.h>
 #include <react/renderer/core/ValueFactory.h>
-#include <react/timing/primitives.h>
 
 namespace facebook::react {
 
```

---

### Incident Patch 8: `b7357896` (2026-10-02)
**Commit Message**: Fix `minimumFontScale` with `adjustsFontSizeToFit` in the New Architecture (#58492)

Summary:
`minimumFontScale` has no effect when used with `adjustsFontSizeToFit` under the New Architecture on either platform (https://github.com/react/react-native/issues/50248). Text shrinks all the way down to the hard-coded floor regardless of the requested scale.

The root cause is the same on both platforms. Fabric's `ParagraphAttributes` carries `minimumFontSize`, but no `<Text>` or `<TextInput>` prop ever sets it, so it is always `NaN`:

- **iOS**: `RCTTextLayoutManager` falls back to a 4pt minimum whenever `minimumFontSize` is `NaN`, so the floor is always 4pt.
- **Android**: the C++ side serializes `minimumFontSize` into MapBuffer key 6, and `TextLayoutManager.adjustSpannableFontToFit()` treats that value as an absolute minimum font size, falling back to 4dp when it is `NaN`. Same result: the floor is always 4dp.

This PR serializes `minimumFontScale` (the field already existed) into a new MapBuffer key (10). Each platform then derives the minimum font size from that scale. `minimumFontSize` and MapBuffer key 6 are left as they are and deprecated in favor of `minimumFontScale`; an explici

**File**: `packages/react-native/Libraries/Text/TextProps.js` (modified, +0/-2)
```diff
@@ -122,8 +122,6 @@ export type TextPropsAndroid = {
   /**
    * Smallest possible font scale when `adjustsFontSizeToFit` is enabled
    * (values 0.01-1.0).
-   *
-   * @platform ios
    */
   minimumFontScale?: ?number,
 };
```

**File**: `packages/react-native/ReactAndroid/api/ReactAndroid.api` (modified, +1/-0)
```diff
@@ -6040,6 +6040,7 @@ public class com/facebook/react/views/text/ReactTextView : androidx/appcompat/wi
 	public fun setIncludeFontPadding (Z)V
 	public fun setLetterSpacing (F)V
 	public fun setLinkifyMask (I)V
+	public fun setMinimumFontScale (F)V
 	public fun setMinimumFontSize (F)V
 	public fun setNumberOfLines (I)V
 	public fun setOverflow (Ljava/lang/String;)V
```

**File**: `packages/react-native/ReactAndroid/src/main/java/com/facebook/react/views/text/ReactTextView.java` (modified, +12/-0)
```diff
@@ -72,6 +72,7 @@ public class ReactTextView extends AppCompatTextView implements ReactCompoundVie
   private boolean mAdjustsFontSizeToFit;
   private float mFontSize;
   private float mMinimumFontSize;
+  private float mMinimumFontScale;
   private float mLetterSpacing;
   private int mLinkifyMaskType;
   private boolean mTextIsSelectable;
@@ -133,6 +134,7 @@ private void initView() {
     mEllipsizeLocation = TextUtils.TruncateAt.END;
     mFontSize = Float.NaN;
     mMinimumFontSize = Float.NaN;
+    mMinimumFontScale = Float.NaN;
     mLetterSpacing = 0.f;
     mOverflow = Overflow.VISIBLE;
     mSpanned = null;
@@ -239,6 +241,7 @@ protected void onDraw(Canvas canvas) {
             getHeight(),
             YogaMeasureMode.EXACTLY,
             mMinimumFontSize,
+            mMinimumFontScale,
             mNumberOfLines,
             getIncludeFontPadding(),
             getBreakStrategy(),
@@ -540,11 +543,20 @@ public void setFontSize(float fontSize) {
     applyTextAttributes();
   }
 
+  /**
+   * @deprecated Use {@link #setMinimumFontScale(float)} instead.
+   */
+  @Deprecated
   public void setMinimumFontSize(float minimumFontSize) {
     mMinimumFontSize = minimumFontSize;
     mShouldAdjustSpannableFontSize = true;
   }
 
+  public void setMinimumFontScale(float minimumFontScale) {
+    mMinimumFontScale = minimumFontScale;
+    mShouldAdjustSpannableFontSize = true;
+  }
+
   @Override
   public void setIncludeFontPadding(boolean includepad) {
     super.setIncludeFontPadding(includepad);
```

**File**: `packages/react-native/ReactAndroid/src/main/java/com/facebook/react/views/text/ReactTextViewManager.kt` (modified, +6/-1)
```diff
@@ -171,7 +171,12 @@ public constructor(
 
     val minimumFontSize: Float =
         paragraphAttributes.getDouble(TextLayoutManager.PA_KEY_MINIMUM_FONT_SIZE).toFloat()
-    view.setMinimumFontSize(minimumFontSize)
+    @Suppress("DEPRECATION") view.setMinimumFontSize(minimumFontSize)
+    val minimumFontScale: Float =
+        if (paragraphAttributes.contains(TextLayoutManager.PA_KEY_MINIMUM_FONT_SCALE))
+            paragraphAttributes.getDouble(TextLayoutManager.PA_KEY_MINIMUM_FONT_SCALE).toFloat()
+        else Float.NaN
+    view.setMinimumFontScale(minimumFontScale)
 
     // Clear any stale PreparedLayout from a previous update
     view.setPreparedLayout(null)
```

**File**: `packages/react-native/ReactAndroid/src/main/java/com/facebook/react/views/text/TextLayoutManager.kt` (modified, +20/-5)
```diff
@@ -98,6 +98,7 @@ internal object TextLayoutManager {
   const val PA_KEY_MINIMUM_FONT_SIZE: Int = 6
   const val PA_KEY_TEXT_ALIGN_VERTICAL: Int = 8
   const val PA_KEY_TEXT_WIDTH_MODE: Int = 9
+  const val PA_KEY_MINIMUM_FONT_SCALE: Int = 10
 
   private val TAG: String = TextLayoutManager::class.java.simpleName
 
@@ -1171,6 +1172,10 @@ internal object TextLayoutManager {
           if (paragraphAttributes.contains(PA_KEY_MINIMUM_FONT_SIZE))
               paragraphAttributes.getDouble(PA_KEY_MINIMUM_FONT_SIZE).toFloat()
           else Float.NaN
+      val minimumFontScale =
+          if (paragraphAttributes.contains(PA_KEY_MINIMUM_FONT_SCALE))
+              paragraphAttributes.getDouble(PA_KEY_MINIMUM_FONT_SCALE).toFloat()
+          else Float.NaN
 
       adjustSpannableFontToFit(
           text,
@@ -1179,6 +1184,7 @@ internal object TextLayoutManager {
           height,
           heightYogaMeasureMode,
           minimumFontSize,
+          minimumFontScale,
           maximumNumberOfLines,
           includeFontPadding,
           textBreakStrategy,
@@ -1338,6 +1344,7 @@ internal object TextLayoutManager {
       height: Float,
       heightYogaMeasureMode: YogaMeasureMode,
       minimumFontSizeAttr: Float,
+      minimumFontScale: Float,
       maximumNumberOfLines: Int,
       includeFontPadding: Boolean,
       textBreakStrategy: Int,
@@ -1349,17 +1356,25 @@ internal object TextLayoutManager {
     var boring = isBoring(text, paint)
     var layout: Layout
 
-    // Minimum font size is 4pts to match the iOS implementation.
-    val minimumFontSize =
-        (if (minimumFontSizeAttr.isNaN()) 4.dpToPx() else minimumFontSizeAttr).toInt()
-
     // Find the largest font size used in the spannable to use as a starting point.
-    var currentFontSize = minimumFontSize
+    var currentFontSize = 0
     val spans = text.getSpans(0, text.length, ReactAbsoluteSizeSpan::class.java)
     for (span in spans) {
       currentFontSize = max(currentFontSize, span.size)
     }
 
+    // An explicit minimum font size wins over minimumFontScale, which is applied to the largest
+    // font size in the spannable. The 4dp floor matches the iOS implementation.
+    val absoluteMinimumFontSize = 4.dpToPx().toInt()
+    val minimumFontSize =
+        when {
+          !minimumFontSizeAttr.isNaN() -> minimumFontSizeAttr.toInt()
+          !minimumFontScale.isNaN() && minimumFontScale > 0f ->
+              max((minimumFontScale * currentFontSize).toInt(), absoluteMinimumFontSize)
+          else -> absoluteMinimumFontSize
+        }
+    currentFontSize = max(currentFontSize, minimumFontSize)
+
     var intervalStart = minimumFontSize
     var intervalEnd = currentFontSize
     var previousFontSize = currentFontSize
```

**File**: `packages/react-native/ReactAndroid/src/test/java/com/facebook/react/views/text/ReactTextViewTest.kt` (modified, +14/-1)
```diff
@@ -21,8 +21,11 @@ import android.view.View
 import android.view.ViewGroup
 import androidx.core.graphics.createBitmap
 import androidx.core.graphics.get
+import com.facebook.react.uimanager.DisplayMetricsHolder
 import com.facebook.react.views.text.internal.span.ReactAbsoluteSizeSpan
 import org.assertj.core.api.Assertions.assertThat
+import org.junit.After
+import org.junit.Before
 import org.junit.Test
 import org.junit.runner.RunWith
 import org.robolectric.RobolectricTestRunner
@@ -32,6 +35,16 @@ import org.robolectric.annotation.Config
 @RunWith(RobolectricTestRunner::class)
 class ReactTextViewTest {
 
+  @Before
+  fun setUp() {
+    DisplayMetricsHolder.initDisplayMetricsIfNotInitialized(RuntimeEnvironment.getApplication())
+  }
+
+  @After
+  fun tearDown() {
+    DisplayMetricsHolder.setScreenDisplayMetrics(null)
+  }
+
   @Test
   fun drawsGlyphInkOutsideLineHeightWhenOverflowIsVisible() {
     val bitmap = drawReactTextViewWithOverflow(null)
@@ -70,7 +83,7 @@ class ReactTextViewTest {
             ViewGroup.LayoutParams.WRAP_CONTENT,
         )
     view.setTextColor(Color.BLACK)
-    view.setMinimumFontSize(4f)
+    view.setMinimumFontScale(0.1f)
     view.setNumberOfLines(0)
     view.setAdjustFontSizeToFit(true)
     view.setSpanned(text)
```

**File**: `packages/react-native/ReactAndroid/src/test/java/com/facebook/react/views/text/TextLayoutManagerMinimumFontScaleTest.kt` (added, +174/-0)
```diff
@@ -0,0 +1,174 @@
+/*
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ */
+
+package com.facebook.react.views.text
+
+import android.text.Layout
+import android.text.SpannableString
+import android.text.Spanned
+import android.text.TextPaint
+import com.facebook.react.common.ReactConstants
+import com.facebook.react.uimanager.DisplayMetricsHolder
+import com.facebook.react.uimanager.PixelUtil.dpToPx
+import com.facebook.react.views.text.internal.span.ReactAbsoluteSizeSpan
+import com.facebook.yoga.YogaMeasureMode
+import org.assertj.core.api.Assertions.assertThat
+import org.junit.After
+import org.junit.Before
+import org.junit.Test
+import org.junit.runner.RunWith
+import org.robolectric.RobolectricTestRunner
+import org.robolectric.RuntimeEnvironment
+
+@RunWith(RobolectricTestRunner::class)
+class TextLayoutManagerMinimumFontScaleTest {
+
+  @Before
+  fun setUp() {
+    DisplayMetricsHolder.initDisplayMetricsIfNotInitialized(RuntimeEnvironment.getApplication())
+  }
+
+  @After
+  fun tearDown() {
+    DisplayMetricsHolder.setScreenDisplayMetrics(null)
+  }
+
+  @Test
+  fun `minimumFontScale limits how far the font shrinks relative to the largest font size`() {
+    val text = spannableWithFontSize(LARGE_FONT_SIZE)
+
+    adjustToUnsatisfiableHeight(text, minimumFontScale = 0.5f)
+
+    assertThat(largestFontSize(text)).isEqualTo((LARGE_FONT_SIZE * 0.5f).toInt())
+  }
+
+  @Test
+  fun `minimumFontScale is applied to the largest font size in the spannable`() {
+    val text = SpannableString("Small text and LARGE TEXT")
+    text.setSpan(ReactAbsoluteSizeSpan(SMALL_FONT_SIZE), 0, 14, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
+    text.setSpan(
+        ReactAbsoluteSizeSpan(LARGE_FONT_SIZE),
+        15,
+        text.length,
+        Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
+    )
+
+    adjustToUnsatisfiableHeight(text, minimumFontScale = 0.5f)
+
+    assertThat(largestFontSize(text)).isEqualTo((LARGE_FONT_SIZE * 0.5f).toInt())
+  }
+
+  @Test
+  fun `missing minimumFontScale shrinks down to the 4dp floor`() {
+    val text = spannableWithFontSize(LARGE_FONT_SIZE)
+
+    adjustToUnsatisfiableHeight(text, minimumFontScale = Float.NaN)
+
+    assertThat(largestFontSize(text)).isEqualTo(4.dpToPx().toInt())
+  }
+
+  @Test
+  fun `zero minimumFontScale shrinks down to the 4dp floor`() {
+    val text = spannableWithFontSize(LARGE_FONT_SIZE)
+
+    adjustToUnsatisfiableHeight(text, minimumFontScale = 0f)
+
+    assertThat(largestFontSize(text)).isEqualTo(4.dpToPx().toInt())
+  }
+
+  @Test
+  fun `minimumFontScale never shrinks below the 4dp floor`() {
+    val text = spannableWithFontSize(LARGE_FONT_SIZE)
+
+    adjustToUnsatisfiableHeight(text, minimumFontScale = 0.01f)
+
+    assertThat(largestFontSize(text)).isEqualTo(4.dpToPx().toInt())
+  }
+
+  @Test
+  fun `explicit minimumFontSize is used as the floor`() {
+    val text = spannableWithFontSize(LARGE_FONT_SIZE)
+
+    adjustToUnsatisfiableHeight(text, minimumFontSize = 12f, minimumFontScale = Float.NaN)
+
+    assertThat(largestFontSize(text)).isEqualTo(12)
+  }
+
+  @Test
+  fun `explicit minimumFontSize takes precedence over minimumFontScale`() {
+    val text = spannableWithFontSize(LARGE_FONT_SIZE)
+
+    adjustToUnsatisfiableHeight(text, minimumFontSize = 12f, minimumFontScale = 0.5f)
+
+    assertThat(largestFontSize(text)).isEqualTo(12)
+  }
+
+  @Test
+  fun `text that already fits is not shrunk`() {
+    val text = spannableWithFontSize(LARGE_FONT_SIZE)
+
+    TextLayoutManager.adjustSpannableFontToFit(
+        text,
+        10_000f,
+        YogaMeasureMode.EXACTLY,
+        10_000f,
+        YogaMeasureMode.EXACTLY,
+        Float.NaN,
+        0.5f,
+        ReactConstants.UNSET,
+        true,
+        Layout.BREAK_STRATEGY_SIMPLE,
+        Layout.HYPHENATION_FREQUENCY_NONE,
+        Layout.Alignment.ALIGN_NORMAL,
+        0,
+        newPaint(),
+    )
+
+    assertThat(largestFontSize(text)).isEqualTo(LARGE_FONT_SIZE)
+  }
+
+  // Uses a height no font size can satisfy so the text is shrunk all the way to the minimum.
+  private fun adjustToUnsatisfiableHeight(
+      text: SpannableString,
+      minimumFontScale: Float,
+      minimumFontSize: Float = Float.NaN,
+  ) {
+    TextLayoutManager.adjustSpannableFontToFit(
+        text,
+        10_000f,
+        YogaMeasureMode.EXACTLY,
+        1f,
+        YogaMeasureMode.EXACTLY,
+        minimumFontSize,
+        minimumFontScale,
+        ReactConstants.UNSET,
+        true,
+        Layout.BREAK_STRATEGY_SIMPLE,
+        Layout.HYPHENATION_FREQUENCY_NONE,
+        Layout.Alignment.ALIGN_NORMAL,
+        0,
+        newPaint(),
+    )
+  }
+
+  private fun spannableWithFontSize(fontSize: Int): SpannableString {
+    val text = SpannableString("Hello")
+    text.setSpan(ReactAbsoluteSizeSpan(fontSize), 0, text.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
+  
```

**File**: `packages/react-native/ReactCommon/react/renderer/attributedstring/ParagraphAttributes.cpp` (modified, +4/-0)
```diff
@@ -59,6 +59,10 @@ SharedDebugStringConvertibleList ParagraphAttributes::getDebugProps() const {
           "adjustsFontSizeToFit",
           adjustsFontSizeToFit,
           paragraphAttributes.adjustsFontSizeToFit),
+      debugStringConvertibleItem(
+          "minimumFontScale",
+          minimumFontScale,
+          paragraphAttributes.minimumFontScale),
       debugStringConvertibleItem(
           "minimumFontSize",
           minimumFontSize,
```

---

### Incident Patch 9: `e69f61b0` (2026-10-02)
**Commit Message**: Keep ImageManager primitives free of private debug headers (#58792)

Summary:
Pull Request resolved: https://github.com/react/react-native/pull/58792

The public `react/renderer/imagemanager/primitives.h` header included the private `react/renderer/debug/debugStringConvertibleUtils.h` for the inline body of `ImageSource::getDebugProps()`. Because the include was unconditional, any strict consumer of `<React/ImageManager.h>` or `<React/Image.h>` (which reaches `primitives.h` through the Image event emitter) hit the private header guard and failed to compile.

Include the public `DebugStringConvertible.h` and `flags.h` headers instead, which provide `SharedDebugStringConvertibleList` and `RN_DEBUG_STRING_CONVERTIBLE`, and keep only the `getDebugProps()` declaration in the header under the existing `RN_DEBUG_STRING_CONVERTIBLE` guard. Move its unchanged implementation into a new `primitives.cpp`, the only place that needs the private debug helpers. Buck, CMake, and CocoaPods already compile every `imagemanager/*.cpp`, so no build-file changes are needed.

Changelog: [Internal]

___

Reviewed By: cortinico

Differential Revision: D122534446

fbshipit-source-id: 61759cd5041c4ac7571ae2d5

**File**: `packages/react-native/ReactCommon/react/renderer/imagemanager/primitives.cpp` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+/*
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ */
+
+#include <react/renderer/imagemanager/primitives.h>
+
+#if RN_DEBUG_STRING_CONVERTIBLE
+#include <react/renderer/debug/debugStringConvertibleUtils.h>
+#endif
+
+namespace facebook::react {
+
+#if RN_DEBUG_STRING_CONVERTIBLE
+SharedDebugStringConvertibleList ImageSource::getDebugProps(
+    const std::string& prefix) const {
+  ImageSource imageSource{};
+
+  SharedDebugStringConvertibleList headersList;
+  for (const auto& header : headers) {
+    headersList.push_back(debugStringConvertibleItem(
+        prefix + "-header-" + header.first, header.second));
+  }
+
+  return headersList +
+      SharedDebugStringConvertibleList{
+          debugStringConvertibleItem(
+              prefix + "-type", toString(type), toString(imageSource.type)),
+          debugStringConvertibleItem(prefix + "-uri", uri, imageSource.uri),
+          debugStringConvertibleItem(
+              prefix + "-bundle", bundle, imageSource.bundle),
+          debugStringConvertibleItem(
+              prefix + "-scale", scale, imageSource.scale),
+          debugStringConvertibleItem(
+              prefix + "-size",
+              react::toString(size),
+              react::toString(imageSource.size)),
+          debugStringConvertibleItem(prefix + "-body", body, imageSource.body),
+          debugStringConvertibleItem(
+              prefix + "-method", method, imageSource.method),
+          debugStringConvertibleItem(
+              prefix + "-cache", toString(cache), toString(imageSource.cache)),
+      };
+}
+#endif
+
+} // namespace facebook::react
```

**File**: `packages/react-native/ReactCommon/react/renderer/imagemanager/primitives.h` (modified, +3/-22)
```diff
@@ -16,7 +16,8 @@
 #include <React/Graphics.h>
 #include <React/RendererCore.h>
 #include <React/RendererDebug.h>
-#include <react/renderer/debug/debugStringConvertibleUtils.h>
+#include <react/renderer/debug/DebugStringConvertible.h>
+#include <react/renderer/debug/flags.h>
 
 namespace facebook::react {
 
@@ -96,27 +97,7 @@ class ImageSource {
 #endif
 
 #if RN_DEBUG_STRING_CONVERTIBLE
-  SharedDebugStringConvertibleList getDebugProps(const std::string &prefix) const
-  {
-    ImageSource imageSource{};
-
-    SharedDebugStringConvertibleList headersList;
-    for (const auto &header : headers) {
-      headersList.push_back(debugStringConvertibleItem(prefix + "-header-" + header.first, header.second));
-    }
-
-    return headersList +
-        SharedDebugStringConvertibleList{
-            debugStringConvertibleItem(prefix + "-type", toString(type), toString(imageSource.type)),
-            debugStringConvertibleItem(prefix + "-uri", uri, imageSource.uri),
-            debugStringConvertibleItem(prefix + "-bundle", bundle, imageSource.bundle),
-            debugStringConvertibleItem(prefix + "-scale", scale, imageSource.scale),
-            debugStringConvertibleItem(prefix + "-size", react::toString(size), react::toString(imageSource.size)),
-            debugStringConvertibleItem(prefix + "-body", body, imageSource.body),
-            debugStringConvertibleItem(prefix + "-method", method, imageSource.method),
-            debugStringConvertibleItem(prefix + "-cache", toString(cache), toString(imageSource.cache)),
-        };
-  }
+  SharedDebugStringConvertibleList getDebugProps(const std::string &prefix) const;
 
   std::string toString(const Type &typeValue) const
   {
```

---

### Incident Patch 10: `550aadd2` (2026-10-01)
**Commit Message**: Fix setLayoutAnimationEnabled assigning variable to itself (#56387)

Summary:
`setLayoutAnimationEnabled()` in `LayoutAnimation.js` assigns `isLayoutAnimationEnabled` back to itself instead of the `value` parameter:

```js
// Before (bug)
function setLayoutAnimationEnabled(value: boolean) {
  isLayoutAnimationEnabled = isLayoutAnimationEnabled; // no-op
}

// After (fixed)
function setLayoutAnimationEnabled(value: boolean) {
  isLayoutAnimationEnabled = value;
}
```

This makes the function a complete no-op, meaning LayoutAnimation can never be toggled at runtime once initialized from the feature flag.

## Changelog:

[GENERAL] [FIXED] - Fix setLayoutAnimationEnabled not applying the value parameter

Pull Request resolved: https://github.com/react/react-native/pull/56387

Test Plan:
1. Call `LayoutAnimation.setLayoutAnimationEnabled(false)` and verify layout animations are disabled
2. Call `LayoutAnimation.setLayoutAnimationEnabled(true)` and verify they re-enable
3. Previously both calls had no effect due to the self-assignment bug

Reviewed By: Abbondanzo

Differential Revision: D122803610

Pulled By: cortinico

fbshipit-source-id: 7ed2ab77b36ef61fa397778e048be70f2d0ca370

**File**: `packages/react-native/Libraries/LayoutAnimation/LayoutAnimation.js` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ let isLayoutAnimationEnabled: boolean =
   ReactNativeFeatureFlags.isLayoutAnimationEnabled();
 
 function setLayoutAnimationEnabled(value: boolean) {
-  isLayoutAnimationEnabled = isLayoutAnimationEnabled;
+  isLayoutAnimationEnabled = value;
 }
 
 /**
```

---

### Incident Patch 11: `ba57eaba` (2026-10-01)
**Commit Message**: Fix flaky ScrollView Maestro navigation with deep links (#58794)

Summary:
The Android Maestro run for `5954b12400d` failed in `scrollview-threshold-maintainvisible`: `scrollUntilVisible` could not find the RNTester example in the Components list, before the flow reached any ScrollView assertions. See the [failed job](https://github.com/react/react-native/actions/runs/36841367720/job/110306957110). The same flow passed on the next main commit, suggesting intermittent list-navigation failure.

Open the ScrollView maintain-visible-content-position module with RNTester deep links in both the threshold and min-index Maestro flows, and wait for the example control before proceeding. This bypasses scrolling through the RNTester catalog; the ScrollView checks themselves are unchanged.

## Changelog:

[INTERNAL] - Use deep links to avoid flaky RNTester list navigation in ScrollView Maestro tests.

Pull Request resolved: https://github.com/react/react-native/pull/58794

Test Plan:
- `yarn prettier --check packages/rn-tester/.maestro/scrollview-threshold-maintainvisible.yml packages/rn-tester/.maestro/scrollview-minindex-maintainvisible.yml` — passed.
- `git diff --check` — passed.
- `node -

**File**: `packages/rn-tester/.maestro/scrollview-minindex-maintainvisible.yml` (modified, +7/-11)
```diff
@@ -3,21 +3,17 @@
 appId: ${APP_ID}
 ---
 - launchApp
+- stopApp
+- openLink: rntester://example/ScrollViewMaintainVisibleContentPositionExample
+- runFlow: ./helpers/confirm-open-link.yml
 # Change to portrait
 - setOrientation: portrait
 - waitForAnimationToEnd:
     timeout: 3000
-# Find test
-- assertVisible: 'Components'
-- scrollUntilVisible:
-    element:
-      id: 'ScrollViewMaintainVisibleContentPositionExample'
-    direction: DOWN
-    speed: 80
-- tapOn:
-    id: 'ScrollViewMaintainVisibleContentPositionExample'
-- waitForAnimationToEnd:
-    timeout: 2000
+- extendedWaitUntil:
+    visible:
+      id: 'scroll-offset-display'
+    timeout: 120000
 # Set minIndexForVisible to 0
 - tapOn:
     text: 'minIndex: 0'
```

**File**: `packages/rn-tester/.maestro/scrollview-threshold-maintainvisible.yml` (modified, +7/-11)
```diff
@@ -3,21 +3,17 @@
 appId: ${APP_ID}
 ---
 - launchApp
+- stopApp
+- openLink: rntester://example/ScrollViewMaintainVisibleContentPositionExample
+- runFlow: ./helpers/confirm-open-link.yml
 # Change to portrait
 - setOrientation: portrait
 - waitForAnimationToEnd:
     timeout: 3000
-# Find test
-- assertVisible: 'Components'
-- scrollUntilVisible:
-    element:
-      id: 'ScrollViewMaintainVisibleContentPositionExample'
-    direction: DOWN
-    speed: 80
-- tapOn:
-    id: 'ScrollViewMaintainVisibleContentPositionExample'
-- waitForAnimationToEnd:
-    timeout: 2000
+- extendedWaitUntil:
+    visible:
+      id: 'scroll-offset-display'
+    timeout: 120000
 # Disable threshold
 - tapOn:
     text: 'Threshold: OFF'
```

---

### Incident Patch 12: `d7878263` (2026-10-01)
**Commit Message**: fix(iOS): embed the dynamic frameworks of spm_dependency Swift packages (#58781)

Summary:
`spm_dependency` links a pod against Swift package products, but CocoaPods only embeds the frameworks of pods. Dynamic frameworks from Swift packages (binary targets like rive-ios' `RiveRuntime`, or `type: .dynamic` products like `AlamofireDynamic`) never reach the app bundle, so the app builds but fails at launch with `dyld: Library not loaded: rpath/RiveRuntime.framework/RiveRuntime`. Separately, Xcode 26 archives fail on the duplicate signature Xcode writes for a binary target used by a pod: `"RiveRuntime.xcframework-ios.signature" couldn't be copied to "Signatures" because an item with the same name already exists.`

This PR:

1. Adds an `install_spm_framework <name>` call per framework to the app's `[CP] Embed Pods Frameworks` script, which embeds the framework from where Xcode builds it, unless it is static.
2. Adds `embed_frameworks:` to `spm_dependency`, defaulting to `products`, for frameworks named differently from their product (`Sentry-Dynamic` is `Sentry.framework`) or coming from the packages a product depends on (`MapboxMaps` loads `MapboxCommon`, `MapboxCoreMaps` and `Turf`).


**File**: `packages/react-native/scripts/cocoapods/__tests__/spm-test.rb` (modified, +106/-1)
```diff
@@ -13,7 +13,17 @@
 # from how `Pod::Project` hands out UUIDs, and cannot be observed against a mock.
 class SPMTests < Test::Unit::TestCase
   PodSpecStub = Struct.new(:name)
-  InstallerStub = Struct.new(:pods_project)
+  InstallerStub = Struct.new(:pods_project, :aggregate_targets) do
+    def initialize(pods_project, aggregate_targets = [])
+      super
+    end
+  end
+  PodTargetStub = Struct.new(:name)
+  AggregateTargetStub = Struct.new(:name, :pod_targets, :embed_frameworks_script_path) do
+    def xcconfigs
+      {}
+    end
+  end
 
   POD_NAME = "ReactNativeEnrichedMarkdown"
   TMP_DIR = File.join(Dir.tmpdir, "rn-spm-test")
@@ -58,6 +68,46 @@ def simulate_reload(project)
     project.instance_variable_set(:@available_uuids, [])
   end
 
+  EMBED_SCRIPT = <<~'SH'
+    #!/bin/sh
+    install_framework()
+    {
+      echo "$1"
+    }
+    if [[ "$CONFIGURATION" == "Debug" ]]; then
+      install_framework "${PODS_XCFRAMEWORKS_BUILD_DIR}/hermes-engine/Pre-built/hermes.framework"
+    fi
+    if [ "${COCOAPODS_PARALLEL_CODE_SIGN}" == "true" ]; then
+      wait
+    fi
+  SH
+
+  def apply_with_embed_script(manager, project)
+    script_path = File.join(TMP_DIR, "Pods-App-frameworks.sh")
+    File.write(script_path, EMBED_SCRIPT) unless File.exist?(script_path)
+    aggregate_target = AggregateTargetStub.new("Pods-App", [PodTargetStub.new(POD_NAME)], script_path)
+    manager.apply_on_post_install(InstallerStub.new(project, [aggregate_target]))
+    File.read(script_path)
+  end
+
+  def spm_manager(**embed_frameworks)
+    manager = SPMManager.new
+    manager.dependency(
+      PodSpecStub.new(POD_NAME),
+      url: "https://github.com/rive-app/rive-ios.git",
+      requirement: { kind: "exactVersion", version: "6.26.0" },
+      products: ["RiveRuntime"]
+    )
+    manager.dependency(
+      PodSpecStub.new(POD_NAME),
+      url: "https://github.com/getsentry/sentry-cocoa.git",
+      requirement: { kind: "exactVersion", version: "9.29.2" },
+      products: ["Sentry-Dynamic"],
+      **embed_frameworks
+    )
+    manager
+  end
+
   def assert_loadable_project(path)
     reopened = nil
     assert_nothing_raised("Pods project must reload cleanly after SPM injection") do
@@ -97,4 +147,59 @@ def test_injected_uuids_are_unique_across_all_objects
     uuids = reopened.objects.map(&:uuid)
     assert_equal(uuids.length, uuids.uniq.length, "all object UUIDs must be unique")
   end
+
+  def test_embeds_frameworks_of_swift_packages_before_the_code_sign_wait
+    script = apply_with_embed_script(spm_manager(embed_frameworks: ["Sentry"]), build_project(1))
+    calls = script.lines.grep(/^install_spm_framework "/).map(&:strip)
+    assert_equal(['install_spm_framework "RiveRuntime"', 'install_spm_framework "Sentry"'], calls)
+    assert_operator(script.index("install_spm_framework \"Sentry\""), :<, script.index("COCOAPODS_PARALLEL_CODE_SIGN"))
+    assert_includes(script, '# https://github.com/getsentry/sentry-cocoa.git {kind: "exactVersion", version: "9.29.2"}')
+  end
+
+  def test_embed_frameworks_defaults_to_the_products
+    script = apply_with_embed_script(spm_manager, build_project(1))
+    assert_includes(script, 'install_spm_framework "Sentry-Dynamic"')
+  end
+
+  def test_embed_script_is_patched_once
+    manager = spm_manager
+    project = build_project(1)
+    apply_with_embed_script(manager, project)
+    script = apply_with_embed_script(manager, project)
+    assert_equal(1, script.scan("install_spm_framework()").length)
+    assert_equal(1, script.scan('install_spm_framework "RiveRuntime"').length)
+  end
+
+  def test_repeated_podspec_evaluation_records_a_dependency_once
+    manager = spm_manager
+    manager.dependency(
+      PodSpecStub.new(POD_NAME),
+      url: "https://github.com/rive-app/rive-ios.git",
+      requirement: { kind: "exactVersion", version: "6.26.0" },
+      products: ["RiveRuntime"]
+    )
+    script = apply_with_embed_script(manager, build_project(1))
+    assert_equal(1, script.scan('install_spm_framework "RiveRuntime"').length)
+    assert_equal(1, script.scan("# https://github.com/rive-app/rive-ios.git").length)
+  end
+
+  def test_signature_cleanup_is_added_only_to_pods_not_built_into_the_shared_products_dir
+    project = build_project(0)
+    project.new_target(:framework, "DynamicPod", :ios)
+    project.save
+    manager = SPMManager.new
+    ["DynamicPod", POD_NAME].each do |pod_name|
+      manager.dependency(
+        PodSpecStub.new(pod_name),
+        url: "https://github.com/rive-app/rive-ios.git",
+        requirement: { kind: "exactVersion", version: "6.26.0" },
+        products: ["RiveRuntime"]
+      )
+    end
+    manager.apply_on_post_install(InstallerStub.new(project))
+    phase_names = ->(name) { project.targets.find { |t| t.name == name }.shell_script_build_phases.map(&:name) }
+    assert_equal([SPMManager::SIGNATURE_PHASE_NAME], phase_names.call("DynamicPod"))
+    assert_empty(phase_names.call(POD_NAME))
+    assert_loadable_proje
```

**File**: `packages/react-native/scripts/cocoapods/spm.rb` (modified, +72/-2)
```diff
@@ -4,13 +4,36 @@
 # LICENSE file in the root directory of this source tree.
 
 class SPMManager
+  EMBED_FUNCTION = 'install_spm_framework'
+  SIGNATURE_PHASE_NAME = '[RN] Remove duplicate Swift package xcframework signatures'
+
+  # Embeds framework $1 from where Xcode builds binary targets (the shared products dir) and source packages
+  # (PackageFrameworks, or UninstalledProducts when archiving); static frameworks are linked into their
+  # consumer and a framework that is not found is skipped, so a misspelled name fails only at launch.
+  EMBED_FUNCTION_SOURCE = <<~'SH'
+    install_spm_framework()
+    {
+      local dir
+      for dir in "${PODS_CONFIGURATION_BUILD_DIR}" "${PODS_CONFIGURATION_BUILD_DIR}/PackageFrameworks" "${OBJROOT}/UninstalledProducts/${PLATFORM_NAME}"; do
+        if [ -d "$dir/$1.framework" ]; then
+          if file -b "$dir/$1.framework/$1" | grep -q "dynamically linked"; then
+            install_framework "$dir/$1.framework"
+          fi
+          return
+        fi
+      done
+    }
+  SH
+
   def initialize()
      @dependencies_by_pod = {}
   end
 
-  def dependency(pod_spec, url:, requirement:,  products:)
+  def dependency(pod_spec, url:, requirement:,  products:, embed_frameworks: products)
     @dependencies_by_pod[pod_spec.name] ||= []
-    @dependencies_by_pod[pod_spec.name] << { url: url, requirement: requirement, products: products}
+    dependency = { url: url, requirement: requirement, products: products, embed_frameworks: embed_frameworks }
+    # CocoaPods can evaluate a podspec several times during one install.
+    @dependencies_by_pod[pod_spec.name] << dependency unless @dependencies_by_pod[pod_spec.name].include?(dependency)
   end
 
   def apply_on_post_install(installer)
@@ -60,6 +83,10 @@ def apply_on_post_install(installer)
     rewrite_aggregate_modulemap_references(installer, flattened_pod_names) unless flattened_pod_names.empty?
 
     unless @dependencies_by_pod.empty?
+      log 'Embedding dynamic frameworks of Swift packages'
+      add_embed_frameworks(installer)
+      add_signature_cleanup(project, @dependencies_by_pod.keys - flattened_pod_names)
+
       log_warning "If you're using Xcode 15 or earlier you might need to close and reopen the Xcode workspace"
       unless ENV["USE_FRAMEWORKS"] == "dynamic"
         @dependencies_by_pod.each do |pod_name, dependencies|
@@ -71,6 +98,49 @@ def apply_on_post_install(installer)
 
   private
 
+  # CocoaPods' "[CP] Embed Pods Frameworks" script only embeds the frameworks of pods, so without these
+  # calls the app fails at launch with dyld "Library not loaded" for a Swift package framework.
+  def add_embed_frameworks(installer)
+    installer.aggregate_targets.each do |aggregate_target|
+      pod_names = aggregate_target.pod_targets.map(&:name) & @dependencies_by_pod.keys
+      script_path = aggregate_target.embed_frameworks_script_path
+      next if pod_names.empty? || !File.exist?(script_path)
+
+      script = File.read(script_path)
+      next if script.include?("#{EMBED_FUNCTION}()")
+      anchor = /^if \[ "\$\{COCOAPODS_PARALLEL_CODE_SIGN\}" == "true" \]; then$/
+      unless script.match?(anchor)
+        log_warning "Could not embed Swift package frameworks in #{script_path}, the app might fail to launch"
+        next
+      end
+
+      dependencies = pod_names.flat_map { |pod_name| @dependencies_by_pod[pod_name] }
+      frameworks = dependencies.flat_map { |d| d[:embed_frameworks] }.uniq
+      # Listing the requirements makes a version change rewrite this script, an input of the embed phase,
+      # so the phase runs again and copies the new frameworks.
+      requirements = dependencies.map { |d| "# #{d[:url]} #{d[:requirement]}\n" }.uniq.join
+      calls = frameworks.map { |framework| "#{EMBED_FUNCTION} \"#{framework}\"\n" }.join
+      File.write(script_path, script.sub(anchor) { "#{EMBED_FUNCTION_SOURCE}#{requirements}#{calls}#{$&}" })
+      log " Embedding #{frameworks.join(', ')} in #{aggregate_target.name}"
+    end
+  end
+
+  # Xcode writes a binary target's xcframework signature both to the shared products dir and to the build dir
+  # of the pod using it, and Xcode 26 archives fail on the duplicate ("couldn't be copied to Signatures because
+  # an item with the same name already exists"), so the pod's copy is removed.
+  def add_signature_cleanup(project, pod_names)
+    pod_names.each do |pod_name|
+      target = project.targets.find { |t| t.name == pod_name }
+      next if target.nil? || target.shell_script_build_phases.any? { |phase| phase.name == SIGNATURE_PHASE_NAME }
+
+      phase = new_object(project, Xcodeproj::Project::Object::PBXShellScriptBuildPhase)
+      phase.name = SIGNATURE_PHASE_NAME
+      phase.shell_script = 'rm -f "${CONFIGURATION_BUILD_DIR}"/*.xcframework-*.signature'
+      phase.always_out_of_date = '1'
+      target.build_phases << phase
+    end
+  end
+
   # Flattening a pod's build dir moves its generated modulemap from
   # "<Pod>
```

**File**: `packages/react-native/scripts/react_native_pods.rb` (modified, +5/-2)
```diff
@@ -397,8 +397,11 @@ def podspec_sources(original_sources, sources_for_prebuilds)
 # - url: The URL of the Swift Package Manager dependency
 # - requirement: The version requirement of the Swift Package Manager dependency (eg. ` {kind: 'upToNextMajorVersion', minimumVersion: '5.9.1'},`)
 # - products: The product/target of the Swift Package Manager dependency (eg. AlamofireDynamic)
-def spm_dependency(spec, url:, requirement:, products:)
-  SPM.dependency(spec, url: url, requirement: requirement, products: products)
+# - embed_frameworks: The names of the dynamic frameworks the products load, including those of the packages they depend
+#   on, embedded in the app (eg. Sentry for the Sentry-Dynamic product; MapboxCommon, MapboxCoreMaps and Turf for
+#   MapboxMaps). Defaults to the product names. A name that matches no framework is not reported
+def spm_dependency(spec, url:, requirement:, products:, embed_frameworks: products)
+  SPM.dependency(spec, url: url, requirement: requirement, products: products, embed_frameworks: embed_frameworks)
 end
 
 # It returns the default flags.
```

---

### Incident Patch 13: `b47915d1` (2026-10-01)
**Commit Message**: Seal renderer Graphics public boundary (#58523)

Summary:
Pull Request resolved: https://github.com/react/react-native/pull/58523

Keep the CSS-free color parsing helpers (`parsePlatformColorFn`, `fromRawValueShared`, and `parsePlatformColor`) in the public Graphics API so the platform `fromRawValue` wrappers remain inline. Move `hashGetColourArguments` and `configurePlatformColorCacheInvalidationHook` into private implementation scope.

Stop exporting CSS, fbjni, and the Android cache library from the Buck target, and express implementation-only dependencies privately in Buck and CMake. The retained shared helper header depends only on `RawValue`, `Color`, and `ContextContainer`; CSS parsing headers remain confined to the implementation file.

Regenerate C++ API snapshots to remove the private hash and cache declarations while retaining the public color parser helpers and inline `fromRawValue` entry point.

Changelog: [Internal]

Reviewed By: cipolleschi

Differential Revision: D119500886

fbshipit-source-id: c69b51454f3586b5fc7784c66bc7e6065228c13b

**File**: `packages/react-native/ReactCommon/react/renderer/graphics/CMakeLists.txt` (modified, +11/-8)
```diff
@@ -27,14 +27,17 @@ target_include_directories(react_renderer_graphics INTERFACE ${REACT_COMMON_DIR}
 
 react_native_android_selector(fbjni fbjni "")
 target_link_libraries(react_renderer_graphics
-        glog
-        ${fbjni}
-        folly_runtime
-        react_cxxstableapi
-        react_debug
-        react_renderer_css
-        react_renderer_debug
-        react_utils
+        PUBLIC
+          ${fbjni}
+          folly_runtime
+          react_cxxstableapi
+          react_renderer_debug
+          react_utils
+        PRIVATE
+          glog
+          react_debug
+          react_featureflags
+          react_renderer_css
 )
 target_compile_reactnative_options(react_renderer_graphics PRIVATE)
 target_compile_options(react_renderer_graphics PRIVATE -Wpedantic)
```

**File**: `packages/react-native/ReactCommon/react/renderer/graphics/platform/android/react/renderer/graphics/PlatformColorParser.cpp` (modified, +19/-2)
```diff
@@ -7,8 +7,7 @@
 
 #include <react/renderer/graphics/PlatformColorParser.h>
 
-#include "configurePlatformColorCacheInvalidationHook.h"
-
+#include <fbjni/NativeRunnable.h>
 #include <fbjni/fbjni.h>
 #include <folly/container/EvictingCacheMap.h>
 #include <react/renderer/css/CSSColor.h>
@@ -20,6 +19,22 @@
 
 namespace facebook::react {
 
+namespace {
+
+void configurePlatformColorCacheInvalidationHook(std::function<void()>&& hook) {
+  auto appearanceModuleClass = jni::findClassLocal(
+      "com/facebook/react/modules/appearance/AppearanceModule");
+  if (appearanceModuleClass) {
+    auto callbackField =
+        appearanceModuleClass->getStaticField<jni::JRunnable::javaobject>(
+            "invalidatePlatformColorCache");
+    jni::local_ref<jni::JRunnable> invalidationCallback =
+        jni::JNativeRunnable::newObjectCxxArgs(std::move(hook));
+    appearanceModuleClass->setStaticFieldValue(
+        callbackField, invalidationCallback.get());
+  }
+}
+
 size_t hashGetColourArguments(
     int32_t surfaceId,
     const std::vector<std::string>& resourcePaths) {
@@ -31,6 +46,8 @@ size_t hashGetColourArguments(
   return seed;
 }
 
+} // namespace
+
 SharedColor parsePlatformColor(
     const ContextContainer& contextContainer,
     int32_t surfaceId,
```

**File**: `packages/react-native/ReactCommon/react/renderer/graphics/platform/android/react/renderer/graphics/PlatformColorParser.h` (modified, +0/-5)
```diff
@@ -12,14 +12,9 @@
 #include <react/renderer/graphics/Color.h>
 #include <react/renderer/graphics/fromRawValueShared.h>
 #include <react/utils/ContextContainer.h>
-#include <cstddef>
-#include <string>
-#include <vector>
 
 namespace facebook::react {
 
-size_t hashGetColourArguments(int32_t surfaceId, const std::vector<std::string> &resourcePaths);
-
 SharedColor parsePlatformColor(const ContextContainer &contextContainer, int32_t surfaceId, const RawValue &value);
 
 inline void
```

**File**: `packages/react-native/ReactCommon/react/renderer/graphics/platform/android/react/renderer/graphics/configurePlatformColorCacheInvalidationHook.cpp` (removed, +0/-27)
```diff
@@ -1,27 +0,0 @@
-/*
- * Copyright (c) Meta Platforms, Inc. and affiliates.
- *
- * This source code is licensed under the MIT license found in the
- * LICENSE file in the root directory of this source tree.
- */
-
-#include "configurePlatformColorCacheInvalidationHook.h"
-
-#include <fbjni/NativeRunnable.h>
-#include <fbjni/fbjni.h>
-
-namespace facebook::react {
-void configurePlatformColorCacheInvalidationHook(std::function<void()>&& hook) {
-  auto appearanceModuleClass = jni::findClassLocal(
-      "com/facebook/react/modules/appearance/AppearanceModule");
-  if (appearanceModuleClass) {
-    auto callbackField =
-        appearanceModuleClass->getStaticField<jni::JRunnable::javaobject>(
-            "invalidatePlatformColorCache");
-    jni::local_ref<jni::JRunnable> invalidationCallback =
-        jni::JNativeRunnable::newObjectCxxArgs(std::move(hook));
-    appearanceModuleClass->setStaticFieldValue(
-        callbackField, invalidationCallback.get());
-  }
-}
-} // namespace facebook::react
```

**File**: `packages/react-native/ReactCommon/react/renderer/graphics/platform/android/react/renderer/graphics/configurePlatformColorCacheInvalidationHook.h` (removed, +0/-14)
```diff
@@ -1,14 +0,0 @@
-/*
- * Copyright (c) Meta Platforms, Inc. and affiliates.
- *
- * This source code is licensed under the MIT license found in the
- * LICENSE file in the root directory of this source tree.
- */
-
-#include <react/cxxstableapi/UmbrellaGuard.h>
-
-#include <functional>
-
-namespace facebook::react {
-void configurePlatformColorCacheInvalidationHook(std::function<void()> &&hook);
-} // namespace facebook::react
```

**File**: `scripts/cxx-api/api-snapshots/ReactAndroidDebugCxx.api` (modified, +0/-2)
```diff
@@ -943,7 +943,6 @@ size_t facebook::react::attributedStringFragmentHashDisplayWise(const facebook::
 size_t facebook::react::attributedStringFragmentHashLayoutWise(const facebook::react::AttributedString::Fragment& fragment);
 size_t facebook::react::attributedStringHashDisplayWise(const facebook::react::AttributedString& attributedString);
 size_t facebook::react::attributedStringHashLayoutWise(const facebook::react::AttributedString& attributedString);
-size_t facebook::react::hashGetColourArguments(int32_t surfaceId, const std::vector<std::string>& resourcePaths);
 size_t facebook::react::textAttributesHashLayoutWise(const facebook::react::TextAttributes& textAttributes);
 std::function<void(folly::dynamic)> facebook::react::makeCallback(std::weak_ptr<facebook::react::Instance> instance, const folly::dynamic& callbackId);
 std::optional<facebook::react::BlendMode> facebook::react::blendModeFromString(std::string_view blendModeName);
@@ -1073,7 +1072,6 @@ void facebook::react::bindHasComponentProvider(facebook::jsi::Runtime& runtime,
 void facebook::react::bindNativeLogger(facebook::jsi::Runtime& runtime, facebook::react::Logger logger);
 void facebook::react::bindNativePerformanceNow(facebook::jsi::Runtime& runtime);
 void facebook::react::cloneProp(facebook::react::BaseViewProps& viewProps, const facebook::react::AnimatedPropBase& animatedProp);
-void facebook::react::configurePlatformColorCacheInvalidationHook(std::function<void()>&& hook);
 void facebook::react::defineReadOnlyGlobal(facebook::jsi::Runtime& runtime, const std::string& propName, facebook::jsi::Value&& value);
 void facebook::react::ensureThreadDurationJNIEnvAttached();
 void facebook::react::fromRawValue(const facebook::react::ContextContainer& contextContainer, int32_t surfaceId, const facebook::react::RawValue& value, facebook::react::SharedColor& result);
```

**File**: `scripts/cxx-api/api-snapshots/ReactAndroidNewarchCxx.api` (modified, +0/-2)
```diff
@@ -942,7 +942,6 @@ size_t facebook::react::attributedStringFragmentHashDisplayWise(const facebook::
 size_t facebook::react::attributedStringFragmentHashLayoutWise(const facebook::react::AttributedString::Fragment& fragment);
 size_t facebook::react::attributedStringHashDisplayWise(const facebook::react::AttributedString& attributedString);
 size_t facebook::react::attributedStringHashLayoutWise(const facebook::react::AttributedString& attributedString);
-size_t facebook::react::hashGetColourArguments(int32_t surfaceId, const std::vector<std::string>& resourcePaths);
 size_t facebook::react::textAttributesHashLayoutWise(const facebook::react::TextAttributes& textAttributes);
 std::optional<facebook::react::BlendMode> facebook::react::blendModeFromString(std::string_view blendModeName);
 std::optional<facebook::react::BoxShadow> facebook::react::fromCSSShadow(const facebook::react::CSSShadow& cssShadow);
@@ -1069,7 +1068,6 @@ void facebook::react::bindHasComponentProvider(facebook::jsi::Runtime& runtime,
 void facebook::react::bindNativeLogger(facebook::jsi::Runtime& runtime, facebook::react::Logger logger);
 void facebook::react::bindNativePerformanceNow(facebook::jsi::Runtime& runtime);
 void facebook::react::cloneProp(facebook::react::BaseViewProps& viewProps, const facebook::react::AnimatedPropBase& animatedProp);
-void facebook::react::configurePlatformColorCacheInvalidationHook(std::function<void()>&& hook);
 void facebook::react::defineReadOnlyGlobal(facebook::jsi::Runtime& runtime, const std::string& propName, facebook::jsi::Value&& value);
 void facebook::react::ensureThreadDurationJNIEnvAttached();
 void facebook::react::fromRawValue(const facebook::react::ContextContainer& contextContainer, int32_t surfaceId, const facebook::react::RawValue& value, facebook::react::SharedColor& result);
```

**File**: `scripts/cxx-api/api-snapshots/ReactAndroidReleaseCxx.api` (modified, +0/-2)
```diff
@@ -943,7 +943,6 @@ size_t facebook::react::attributedStringFragmentHashDisplayWise(const facebook::
 size_t facebook::react::attributedStringFragmentHashLayoutWise(const facebook::react::AttributedString::Fragment& fragment);
 size_t facebook::react::attributedStringHashDisplayWise(const facebook::react::AttributedString& attributedString);
 size_t facebook::react::attributedStringHashLayoutWise(const facebook::react::AttributedString& attributedString);
-size_t facebook::react::hashGetColourArguments(int32_t surfaceId, const std::vector<std::string>& resourcePaths);
 size_t facebook::react::textAttributesHashLayoutWise(const facebook::react::TextAttributes& textAttributes);
 std::function<void(folly::dynamic)> facebook::react::makeCallback(std::weak_ptr<facebook::react::Instance> instance, const folly::dynamic& callbackId);
 std::optional<facebook::react::BlendMode> facebook::react::blendModeFromString(std::string_view blendModeName);
@@ -1073,7 +1072,6 @@ void facebook::react::bindHasComponentProvider(facebook::jsi::Runtime& runtime,
 void facebook::react::bindNativeLogger(facebook::jsi::Runtime& runtime, facebook::react::Logger logger);
 void facebook::react::bindNativePerformanceNow(facebook::jsi::Runtime& runtime);
 void facebook::react::cloneProp(facebook::react::BaseViewProps& viewProps, const facebook::react::AnimatedPropBase& animatedProp);
-void facebook::react::configurePlatformColorCacheInvalidationHook(std::function<void()>&& hook);
 void facebook::react::defineReadOnlyGlobal(facebook::jsi::Runtime& runtime, const std::string& propName, facebook::jsi::Value&& value);
 void facebook::react::ensureThreadDurationJNIEnvAttached();
 void facebook::react::fromRawValue(const facebook::react::ContextContainer& contextContainer, int32_t surfaceId, const facebook::react::RawValue& value, facebook::react::SharedColor& result);
```

---

### Incident Patch 14: `6d309546` (2026-10-01)
**Commit Message**: Move renderer color parsing out of headers (#58521)

Summary:
Pull Request resolved: https://github.com/react/react-native/pull/58521

Move shared and platform-specific Graphics color-parsing implementations from exported headers into owned source files across generic C++, Android, Apple, and Windows targets. Preserve the existing public entry points and parsing behavior.

Update Buck source selection so default configurations link the generic C++ parser, and keep the React Native macOS and Windows mirrors synchronized.

Changelog: [Internal]

Reviewed By: javache

Differential Revision: D119500849

fbshipit-source-id: 97dcbe2efd9434e39e6cdafd67b68c55ef62b6f3

**File**: `packages/react-native/ReactCommon/react/renderer/graphics/fromRawValueShared.cpp` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+/*
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ */
+
+#include <react/renderer/graphics/fromRawValueShared.h>
+
+#include <react/debug/react_native_expect.h>
+#include <react/featureflags/ReactNativeFeatureFlags.h>
+#include <react/renderer/css/CSSColor.h>
+#include <react/renderer/css/CSSValueParser.h>
+
+namespace facebook::react {
+
+void fromRawValueShared(
+    const ContextContainer& contextContainer,
+    int32_t surfaceId,
+    const RawValue& value,
+    SharedColor& result,
+    parsePlatformColorFn parsePlatformColor) {
+  ColorComponents colorComponents = {
+      .red = 0, .green = 0, .blue = 0, .alpha = 0};
+
+  if (ReactNativeFeatureFlags::enableNativeCSSParsing() &&
+      value.hasType<std::string>()) {
+    auto cssColor = parseCSSProperty<CSSColor>((std::string)value);
+    if (std::holds_alternative<CSSColor>(cssColor)) {
+      auto c = std::get<CSSColor>(cssColor);
+      result = hostPlatformColorFromRGBA(c.r, c.g, c.b, c.a);
+      return;
+    }
+    // Unparseable string - fall through to parsePlatformColor
+    result = parsePlatformColor(contextContainer, surfaceId, value);
+  } else if (value.hasType<int>()) {
+    auto argb = (int64_t)value;
+    auto ratio = 255.f;
+    colorComponents.alpha = ((argb >> 24) & 0xFF) / ratio;
+    colorComponents.red = ((argb >> 16) & 0xFF) / ratio;
+    colorComponents.green = ((argb >> 8) & 0xFF) / ratio;
+    colorComponents.blue = (argb & 0xFF) / ratio;
+
+    result = colorFromComponents(colorComponents);
+  } else if (value.hasType<std::vector<float>>()) {
+    auto items = (std::vector<float>)value;
+    auto length = items.size();
+    react_native_expect(length == 3 || length == 4);
+    colorComponents.red = items.at(0);
+    colorComponents.green = items.at(1);
+    colorComponents.blue = items.at(2);
+    colorComponents.alpha = length == 4 ? items.at(3) : 1.0f;
+
+    result = colorFromComponents(colorComponents);
+  } else {
+    if (value.hasType<std::unordered_map<std::string, RawValue>>()) {
+      const auto& items = (std::unordered_map<std::string, RawValue>)value;
+      if (items.find("space") != items.end()) {
+        colorComponents.red = (float)items.at("r");
+        colorComponents.green = (float)items.at("g");
+        colorComponents.blue = (float)items.at("b");
+        colorComponents.alpha = (float)items.at("a");
+        colorComponents.colorSpace = getDefaultColorSpace();
+        std::string space = (std::string)items.at("space");
+        if (space == "display-p3") {
+          colorComponents.colorSpace = ColorSpace::DisplayP3;
+        } else if (space == "srgb") {
+          colorComponents.colorSpace = ColorSpace::sRGB;
+        }
+        result = colorFromComponents(colorComponents);
+        return;
+      }
+    }
+    result = parsePlatformColor(contextContainer, surfaceId, value);
+  }
+}
+
+} // namespace facebook::react
```

**File**: `packages/react-native/ReactCommon/react/renderer/graphics/fromRawValueShared.h` (modified, +3/-58)
```diff
@@ -8,74 +8,19 @@
 #pragma once
 
 #include <react/cxxstableapi/UmbrellaGuard.h>
-#include <react/debug/react_native_expect.h>
-#include <react/featureflags/ReactNativePublicFeatureFlags.h>
 #include <react/renderer/core/RawValue.h>
-#include <react/renderer/css/CSSColor.h>
-#include <react/renderer/css/CSSValueParser.h>
 #include <react/renderer/graphics/Color.h>
 #include <react/utils/ContextContainer.h>
 
 namespace facebook::react {
+
 using parsePlatformColorFn = SharedColor (*)(const ContextContainer &, int32_t, const RawValue &);
 
-inline void fromRawValueShared(
+void fromRawValueShared(
     const ContextContainer &contextContainer,
     int32_t surfaceId,
     const RawValue &value,
     SharedColor &result,
-    parsePlatformColorFn parsePlatformColor)
-{
-  ColorComponents colorComponents = {0, 0, 0, 0};
-
-  if (ReactNativeFeatureFlags_DO_NOT_USE::enableNativeCSSParsing() && value.hasType<std::string>()) {
-    auto cssColor = parseCSSProperty<CSSColor>((std::string)value);
-    if (std::holds_alternative<CSSColor>(cssColor)) {
-      auto c = std::get<CSSColor>(cssColor);
-      result = hostPlatformColorFromRGBA(c.r, c.g, c.b, c.a);
-      return;
-    }
-    // Unparseable string - fall through to parsePlatformColor
-    result = parsePlatformColor(contextContainer, surfaceId, value);
-  } else if (value.hasType<int>()) {
-    auto argb = (int64_t)value;
-    auto ratio = 255.f;
-    colorComponents.alpha = ((argb >> 24) & 0xFF) / ratio;
-    colorComponents.red = ((argb >> 16) & 0xFF) / ratio;
-    colorComponents.green = ((argb >> 8) & 0xFF) / ratio;
-    colorComponents.blue = (argb & 0xFF) / ratio;
-
-    result = colorFromComponents(colorComponents);
-  } else if (value.hasType<std::vector<float>>()) {
-    auto items = (std::vector<float>)value;
-    auto length = items.size();
-    react_native_expect(length == 3 || length == 4);
-    colorComponents.red = items.at(0);
-    colorComponents.green = items.at(1);
-    colorComponents.blue = items.at(2);
-    colorComponents.alpha = length == 4 ? items.at(3) : 1.0f;
+    parsePlatformColorFn parsePlatformColor);
 
-    result = colorFromComponents(colorComponents);
-  } else {
-    if (value.hasType<std::unordered_map<std::string, RawValue>>()) {
-      const auto &items = (std::unordered_map<std::string, RawValue>)value;
-      if (items.find("space") != items.end()) {
-        colorComponents.red = (float)items.at("r");
-        colorComponents.green = (float)items.at("g");
-        colorComponents.blue = (float)items.at("b");
-        colorComponents.alpha = (float)items.at("a");
-        colorComponents.colorSpace = getDefaultColorSpace();
-        std::string space = (std::string)items.at("space");
-        if (space == "display-p3") {
-          colorComponents.colorSpace = ColorSpace::DisplayP3;
-        } else if (space == "srgb") {
-          colorComponents.colorSpace = ColorSpace::sRGB;
-        }
-        result = colorFromComponents(colorComponents);
-        return;
-      }
-    }
-    result = parsePlatformColor(contextContainer, surfaceId, value);
-  }
-}
 } // namespace facebook::react
```

**File**: `packages/react-native/ReactCommon/react/renderer/graphics/platform/android/react/renderer/graphics/PlatformColorParser.cpp` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+/*
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ */
+
+#include <react/renderer/graphics/PlatformColorParser.h>
+
+#include "configurePlatformColorCacheInvalidationHook.h"
+
+#include <fbjni/fbjni.h>
+#include <folly/container/EvictingCacheMap.h>
+#include <react/renderer/css/CSSColor.h>
+#include <react/renderer/css/CSSValueParser.h>
+#include <functional>
+#include <mutex>
+#include <optional>
+#include <unordered_map>
+
+namespace facebook::react {
+
+size_t hashGetColourArguments(
+    int32_t surfaceId,
+    const std::vector<std::string>& resourcePaths) {
+  size_t seed = std::hash<int32_t>{}(surfaceId);
+  for (const auto& path : resourcePaths) {
+    seed ^=
+        std::hash<std::string>{}(path) + 0x9e3779b9 + (seed << 6) + (seed >> 2);
+  }
+  return seed;
+}
+
+SharedColor parsePlatformColor(
+    const ContextContainer& contextContainer,
+    int32_t surfaceId,
+    const RawValue& value) {
+  Color color{};
+  if (value.hasType<std::unordered_map<std::string, RawValue>>()) {
+    // Mixed array + string values, so read as a map of RawValue (a map of
+    // vector<string> would assert on the fallback string).
+    auto map = (std::unordered_map<std::string, RawValue>)value;
+
+    std::vector<std::string> resourcePaths;
+    auto resourcePathsIt = map.find("resource_paths");
+    if (resourcePathsIt != map.end() &&
+        resourcePathsIt->second.hasType<std::vector<std::string>>()) {
+      resourcePaths = (std::vector<std::string>)resourcePathsIt->second;
+    }
+
+    bool resolved = false;
+    if (!resourcePaths.empty()) {
+      // Cache the (costly) JNI results. A cached nullopt is an explicit miss,
+      // distinct from a path that resolves to transparent (ARGB 0).
+      static std::mutex getColorCacheMutex;
+      static folly::EvictingCacheMap<size_t, std::optional<Color>>
+          getColorCache(64);
+
+      // Listen for appearance changes, which should invalidate the cache
+      static std::once_flag setupCacheInvalidation;
+      std::call_once(
+          setupCacheInvalidation,
+          configurePlatformColorCacheInvalidationHook,
+          [&] {
+            std::scoped_lock lock(getColorCacheMutex);
+            getColorCache.clear();
+          });
+
+      auto hash = hashGetColourArguments(surfaceId, resourcePaths);
+      std::optional<Color> resolvedColor;
+      {
+        std::scoped_lock lock(getColorCacheMutex);
+        auto iterator = getColorCache.find(hash);
+        if (iterator != getColorCache.end()) {
+          resolvedColor = iterator->second;
+        } else {
+          const auto& fabricUIManager =
+              contextContainer.at<jni::global_ref<jobject>>("FabricUIManager");
+          // Boxed Integer: null is an explicit miss; a non-null value may be 0
+          // (transparent black).
+          static auto getColorFromJava =
+              fabricUIManager->getClass()
+                  ->getMethod<jni::JInteger::javaobject(
+                      jint, jni::JArrayClass<jni::JString>)>("getColor");
+          auto javaResourcePaths =
+              jni::JArrayClass<jni::JString>::newArray(resourcePaths.size());
+
+          for (int i = 0; i < resourcePaths.size(); i++) {
+            javaResourcePaths->setElement(
+                i, *jni::make_jstring(resourcePaths[i]));
+          }
+          auto boxedColor =
+              getColorFromJava(fabricUIManager, surfaceId, *javaResourcePaths);
+          if (boxedColor) {
+            resolvedColor = static_cast<Color>(boxedColor->value());
+          }
+          getColorCache.set(hash, resolvedColor);
+        }
+      }
+      if (resolvedColor.has_value()) {
+        color = *resolvedColor;
+        resolved = true;
+      }
+    }
+
+    // No path resolved: parse the raw fallback with the shared CSS parser (the
+    // same parser iOS Fabric uses).
+    if (!resolved) {
+      auto fallbackIt = map.find("fallback");
+      if (fallbackIt != map.end() &&
+          fallbackIt->second.hasType<std::string>()) {
+        auto cssColor =
+            parseCSSProperty<CSSColor>((std::string)fallbackIt->second);
+        if (std::holds_alternative<CSSColor>(cssColor)) {
+          const auto& c = std::get<CSSColor>(cssColor);
+          color = hostPlatformColorFromRGBA(c.r, c.g, c.b, c.a);
+        }
+      }
+    }
+  }
+
+  return color;
+}
+
+} // namespace facebook::react
```

**File**: `packages/react-native/ReactCommon/react/renderer/graphics/platform/android/react/renderer/graphics/PlatformColorParser.h` (modified, +3/-96)
```diff
@@ -8,112 +8,19 @@
 #pragma once
 
 #include <react/cxxstableapi/UmbrellaGuard.h>
-
-#include "configurePlatformColorCacheInvalidationHook.h"
-
-#include <fbjni/fbjni.h>
-#include <folly/container/EvictingCacheMap.h>
 #include <react/renderer/core/RawValue.h>
-#include <react/renderer/css/CSSColor.h>
-#include <react/renderer/css/CSSValueParser.h>
 #include <react/renderer/graphics/Color.h>
 #include <react/renderer/graphics/fromRawValueShared.h>
 #include <react/utils/ContextContainer.h>
-#include <functional>
-#include <mutex>
-#include <optional>
+#include <cstddef>
 #include <string>
-#include <unordered_map>
 #include <vector>
 
 namespace facebook::react {
 
-inline size_t hashGetColourArguments(int32_t surfaceId, const std::vector<std::string> &resourcePaths)
-{
-  size_t seed = std::hash<int32_t>{}(surfaceId);
-  for (const auto &path : resourcePaths) {
-    seed ^= std::hash<std::string>{}(path) + 0x9e3779b9 + (seed << 6) + (seed >> 2);
-  }
-  return seed;
-}
-
-inline SharedColor
-parsePlatformColor(const ContextContainer &contextContainer, int32_t surfaceId, const RawValue &value)
-{
-  Color color{};
-  if (value.hasType<std::unordered_map<std::string, RawValue>>()) {
-    // Mixed array + string values, so read as a map of RawValue (a map of
-    // vector<string> would assert on the fallback string).
-    auto map = (std::unordered_map<std::string, RawValue>)value;
-
-    std::vector<std::string> resourcePaths;
-    auto resourcePathsIt = map.find("resource_paths");
-    if (resourcePathsIt != map.end() && resourcePathsIt->second.hasType<std::vector<std::string>>()) {
-      resourcePaths = (std::vector<std::string>)resourcePathsIt->second;
-    }
+size_t hashGetColourArguments(int32_t surfaceId, const std::vector<std::string> &resourcePaths);
 
-    bool resolved = false;
-    if (!resourcePaths.empty()) {
-      // Cache the (costly) JNI results. A cached nullopt is an explicit miss,
-      // distinct from a path that resolves to transparent (ARGB 0).
-      static std::mutex getColorCacheMutex;
-      static folly::EvictingCacheMap<size_t, std::optional<Color>> getColorCache(64);
-
-      // Listen for appearance changes, which should invalidate the cache
-      static std::once_flag setupCacheInvalidation;
-      std::call_once(setupCacheInvalidation, configurePlatformColorCacheInvalidationHook, [&] {
-        std::scoped_lock lock(getColorCacheMutex);
-        getColorCache.clear();
-      });
-
-      auto hash = hashGetColourArguments(surfaceId, resourcePaths);
-      std::optional<Color> resolvedColor;
-      {
-        std::scoped_lock lock(getColorCacheMutex);
-        auto iterator = getColorCache.find(hash);
-        if (iterator != getColorCache.end()) {
-          resolvedColor = iterator->second;
-        } else {
-          const auto &fabricUIManager = contextContainer.at<jni::global_ref<jobject>>("FabricUIManager");
-          // Boxed Integer: null is an explicit miss; a non-null value may be 0
-          // (transparent black).
-          static auto getColorFromJava =
-              fabricUIManager->getClass()->getMethod<jni::JInteger::javaobject(jint, jni::JArrayClass<jni::JString>)>(
-                  "getColor");
-          auto javaResourcePaths = jni::JArrayClass<jni::JString>::newArray(resourcePaths.size());
-
-          for (int i = 0; i < resourcePaths.size(); i++) {
-            javaResourcePaths->setElement(i, *jni::make_jstring(resourcePaths[i]));
-          }
-          auto boxedColor = getColorFromJava(fabricUIManager, surfaceId, *javaResourcePaths);
-          if (boxedColor) {
-            resolvedColor = static_cast<Color>(boxedColor->value());
-          }
-          getColorCache.set(hash, resolvedColor);
-        }
-      }
-      if (resolvedColor.has_value()) {
-        color = *resolvedColor;
-        resolved = true;
-      }
-    }
-
-    // No path resolved: parse the raw fallback with the shared CSS parser (the
-    // same parser iOS Fabric uses).
-    if (!resolved) {
-      auto fallbackIt = map.find("fallback");
-      if (fallbackIt != map.end() && fallbackIt->second.hasType<std::string>()) {
-        auto cssColor = parseCSSProperty<CSSColor>((std::string)fallbackIt->second);
-        if (std::holds_alternative<CSSColor>(cssColor)) {
-          const auto &c = std::get<CSSColor>(cssColor);
-          color = hostPlatformColorFromRGBA(c.r, c.g, c.b, c.a);
-        }
-      }
-    }
-  }
-
-  return color;
-}
+SharedColor parsePlatformColor(const ContextContainer &contextContainer, int32_t surfaceId, const RawValue &value);
 
 inline void
 fromRawValue(const ContextContainer &contextContainer, int32_t surfaceId, const RawValue &value, SharedColor &result)
```

**File**: `packages/react-native/ReactCommon/react/renderer/graphics/platform/cxx/react/renderer/graphics/PlatformColorParser.cpp` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+/*
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ */
+
+#include <react/renderer/graphics/PlatformColorParser.h>
+
+namespace facebook::react {
+
+SharedColor parsePlatformColor(
+    const ContextContainer& /*contextContainer*/,
+    int32_t /*surfaceId*/,
+    const RawValue& /*value*/) {
+  float alpha = 0;
+  float red = 0;
+  float green = 0;
+  float blue = 0;
+
+  return {colorFromComponents(
+      {.red = red, .green = green, .blue = blue, .alpha = alpha})};
+}
+
+} // namespace facebook::react
```

**File**: `packages/react-native/ReactCommon/react/renderer/graphics/platform/cxx/react/renderer/graphics/PlatformColorParser.h` (modified, +1/-12)
```diff
@@ -8,25 +8,14 @@
 #pragma once
 
 #include <react/cxxstableapi/UmbrellaGuard.h>
-
-#include <react/debug/react_native_expect.h>
 #include <react/renderer/core/RawValue.h>
 #include <react/renderer/graphics/Color.h>
 #include <react/renderer/graphics/fromRawValueShared.h>
 #include <react/utils/ContextContainer.h>
 
 namespace facebook::react {
 
-inline SharedColor
-parsePlatformColor(const ContextContainer & /*contextContainer*/, int32_t /*surfaceId*/, const RawValue & /*value*/)
-{
-  float alpha = 0;
-  float red = 0;
-  float green = 0;
-  float blue = 0;
-
-  return {colorFromComponents({red, green, blue, alpha})};
-}
+SharedColor parsePlatformColor(const ContextContainer &contextContainer, int32_t surfaceId, const RawValue &value);
 
 inline void
 fromRawValue(const ContextContainer &contextContainer, int32_t surfaceId, const RawValue &value, SharedColor &result)
```

**File**: `packages/react-native/ReactCommon/react/renderer/graphics/platform/ios/react/renderer/graphics/PlatformColorParser.h` (modified, +0/-2)
```diff
@@ -8,8 +8,6 @@
 #pragma once
 
 #include <react/cxxstableapi/UmbrellaGuard.h>
-
-#include <react/debug/react_native_expect.h>
 #include <react/renderer/core/RawValue.h>
 #include <react/renderer/graphics/Color.h>
 #include <react/renderer/graphics/fromRawValueShared.h>
```

---

### Incident Patch 15: `3d3f919c` (2026-10-01)
**Commit Message**: Add explicit renderer CSS dependencies (#58522)

Summary:
Pull Request resolved: https://github.com/react/react-native/pull/58522

Declare direct CSS dependencies for renderer targets that consume CSS headers instead of relying on View or Graphics to expose them transitively. Cover Buck, CMake, CocoaPods, and SwiftPM without changing header visibility or runtime behavior.

Changelog: [Internal]

Reviewed By: javache

Differential Revision: D119489856

fbshipit-source-id: 2220e625cbde051466c836407fdabd0fcd7bf62f

**File**: `packages/react-native/Package.swift` (modified, +12/-3)
```diff
@@ -288,21 +288,29 @@ let reactJsErrorHandler = RNTarget(
   dependencies: [.reactNativeDependencies, .jsi, .reactFeatureFlags, .reactDebug, .reactTurboModuleBridging]
 )
 
+/// React-renderercss.podspec
+let reactRendererCss = RNTarget(
+  name: .reactRendererCss,
+  path: "ReactCommon/react/renderer/css",
+  excludedPaths: ["tests"],
+  dependencies: [.reactNativeDependencies, .reactDebug, .reactUtils]
+)
+
 /// React-graphicsApple
 /// This represents the React-graphicsApple BUCK module
 let reactGraphicsApple = RNTarget(
   name: .reactGraphicsApple,
   path: "ReactCommon/react/renderer/graphics/platform/ios",
   linkedFrameworks: ["UIKit", "CoreGraphics"],
-  dependencies: [.reactDebug, .jsi, .reactUtils, .reactNativeDependencies]
+  dependencies: [.reactDebug, .jsi, .reactUtils, .reactNativeDependencies, .reactRendererCss]
 )
 
 /// React-graphics.podspec
 let reactGraphics = RNTarget(
   name: .reactGraphics,
   path: "ReactCommon/react/renderer/graphics",
   excludedPaths: ["platform", "tests"],
-  dependencies: [.reactNativeDependencies, .jsi, .reactJsiExecutor, .reactRendererDebug, .reactUtils, .reactGraphicsApple]
+  dependencies: [.reactNativeDependencies, .jsi, .reactJsiExecutor, .reactRendererDebug, .reactUtils, .reactGraphicsApple, .reactRendererCss]
 )
 
 /// ReactCommon.podspec
@@ -492,7 +500,7 @@ let reactFabric = RNTarget(
     "observers/resize/tests",
     "scheduler/tests",
   ],
-  dependencies: [.reactNativeDependencies, .reactJsiExecutor, .rctTypesafety, .reactTurboModuleCore, .jsi, .logger, .reactDebug, .reactFeatureFlags, .reactUtils, .reactRuntimeScheduler, .reactCxxReact, .reactRendererDebug, .reactGraphics, .yoga, .reactJsInspectorTracing],
+  dependencies: [.reactNativeDependencies, .reactJsiExecutor, .rctTypesafety, .reactTurboModuleCore, .jsi, .logger, .reactDebug, .reactFeatureFlags, .reactUtils, .reactRuntimeScheduler, .reactCxxReact, .reactRendererDebug, .reactGraphics, .reactRendererCss, .yoga, .reactJsInspectorTracing],
   sources: ["animated", "animationbackend", "animations", "attributedstring", "core", "componentregistry", "componentregistry/native", "components/root", "components/view", "components/view/platform/cxx", "components/scrollview", "components/scrollview/platform/cxx", "components/scrollview/platform/ios", "components/legacyviewmanagerinterop", "components/legacyviewmanagerinterop/platform/ios", "dom", "scheduler", "mounting", "observers/events", "observers/intersection", "observers/mutation", "observers/resize", "telemetry", "consistency", "leakchecker", "uimanager", "uimanager/consistency", "viewtransition"]
 )
 
@@ -714,6 +722,7 @@ let targets = [
   reactPerformanceTimeline,
   reactRuntimeScheduler,
   rctTypesafety,
+  reactRendererCss,
   reactGraphics,
   reactGraphicsApple,
   reactImageManager,
```

**File**: `packages/react-native/ReactCommon/React-Fabric.podspec` (modified, +2/-0)
```diff
@@ -81,6 +81,7 @@ Pod::Spec.new do |s|
   end
 
   s.subspec "attributedstring" do |ss|
+    ss.dependency           "React-renderercss"
     ss.source_files         = podspec_sources("react/renderer/attributedstring/**/*.{m,mm,cpp,h}", "react/renderer/attributedstring/**/*.{h}")
     ss.exclude_files        = "react/renderer/attributedstring/tests"
     ss.header_dir           = "react/renderer/attributedstring"
@@ -229,6 +230,7 @@ Pod::Spec.new do |s|
     end
 
     ss.subspec "intersection" do |sss|
+      sss.dependency           "React-renderercss"
       sss.source_files         = podspec_sources("react/renderer/observers/intersection/**/*.{m,mm,cpp,h}", "react/renderer/observers/intersection/**/*.h")
       sss.exclude_files        = "react/renderer/observers/intersection/tests"
       sss.header_dir           = "react/renderer/observers/intersection"
```

**File**: `packages/react-native/ReactCommon/react/renderer/attributedstring/CMakeLists.txt` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@ target_link_libraries(react_renderer_attributedstring
         react_debug
         rrc_view
         react_renderer_core
+        react_renderer_css
         react_renderer_debug
         react_renderer_graphics
         react_renderer_mapbuffer
```

**File**: `packages/react-native/ReactCommon/react/renderer/graphics/CMakeLists.txt` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@ target_link_libraries(react_renderer_graphics
         folly_runtime
         react_cxxstableapi
         react_debug
+        react_renderer_css
         react_renderer_debug
         react_utils
 )
```

**File**: `packages/react-native/ReactCommon/react/renderer/graphics/React-graphics.podspec` (modified, +1/-0)
```diff
@@ -57,6 +57,7 @@ Pod::Spec.new do |s|
   s.dependency "React-utils"
   s.dependency "React-rendererdebug"
   s.dependency "React-cxxstableapi"
+  s.dependency "React-renderercss"
 
   depend_on_js_engine(s)
   add_rn_third_party_dependencies(s)
```

**File**: `packages/react-native/ReactCommon/react/renderer/observers/intersection/CMakeLists.txt` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ target_link_libraries(react_renderer_observers_intersection
       react_cxxstableapi
       react_debug
       react_renderer_core
+      react_renderer_css
       react_renderer_graphics
       react_renderer_mounting
       react_renderer_runtimescheduler
```

#### Recent Merged Pull Requests:
- **PR #58845** (closed): Disable folly coroutines for library pods in install_modules_dependencies (@cipolleschi)
- **PR #58841** (closed): Retry transient artifact download failures (#58841) (@cortinico)
- **PR #58816** (closed): Fix use-after-free race in RCTInstance callFunctionOnJSModule (#58816) (@zeyap)
- **PR #58815** (closed): Upgrade flow binary to latest in fbsource (@SamChou19815)
- **PR #58814** (closed): Use module umbrella headers in attributedstring (#58814) (@j-piasecki)
- **PR #58809** (closed): Harden iOS CI retries for runner and gem flakes (@cortinico)
- **PR #58805** (closed): Annotate signatures affected by precise template literal types (#58805) (@panagosg7)
- **PR #58804** (closed): Log unrecognized font family on Android (@mosab-nasrallah)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
