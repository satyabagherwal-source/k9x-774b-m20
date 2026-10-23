> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/react-react-native-learnings.md`  
> **Source**: github ([https://github.com/react/react-native](https://github.com/react/react-native))  
> **Source Version**: `bbee89c5`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-23T06:02:53.809Z  
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
> **Harvest Timestamp**: 2026-10-23T06:02:53.232Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react/react-native`
- **Description**: A framework for building native applications using React
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 126758 stars

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

### Incident Patch 1: `ba0b3dbd` (2026-10-22)
**Commit Message**: Babel preset: Remove regenerator from Hermes dev builds (#59303)

Summary:
## Motivation

 - Dev/release consistency in correctness and performance shape.
 - ~10% faster dev cold builds
 - More responsive dev apps (~2x faster promise handling)
 - Improved debugging support

Since https://github.com/react/react-native/pull/52651, Hermes profiles have lowered generators (with `enableBabelRuntime: false`), `for...of`, `?.`, `??` and optional catch binding in dev builds only, because Hermes couldn't show local variables when paused on a breakpoint in a native generator.

That turned out to be a Hermes bug: a breakpoint on that a `yield` line resolved to scope-less entry code before the body had even run. It was fixed in https://github.com/facebook/hermes/commit/d1238c8c61907ad41caadf579f6739f724e959a3 (hermes-v260318099.0.2), which main has used since https://github.com/react/react-native/pull/58397.

This removes `enableRegenerator`, so Hermes-profile dev output matches release. It also fixes a dev-only divergence - loose `for-of` never calls `iterator.return()`, so breaking out of a `for...of` over a generator skipped its `finally` in dev but not release.

Note that with the default 

**File**: `packages/react-native-babel-preset/package.json` (modified, +0/-5)
```diff
@@ -39,19 +39,14 @@
     "@babel/plugin-transform-classes": "^7.25.4",
     "@babel/plugin-transform-destructuring": "^7.24.8",
     "@babel/plugin-transform-flow-strip-types": "^7.25.2",
-    "@babel/plugin-transform-for-of": "^7.24.7",
     "@babel/plugin-transform-modules-commonjs": "^7.24.8",
     "@babel/plugin-transform-named-capturing-groups-regex": "^7.24.7",
-    "@babel/plugin-transform-nullish-coalescing-operator": "^7.24.7",
-    "@babel/plugin-transform-optional-catch-binding": "^7.24.7",
-    "@babel/plugin-transform-optional-chaining": "^7.24.8",
     "@babel/plugin-transform-private-methods": "^7.24.7",
     "@babel/plugin-transform-private-property-in-object": "^7.24.7",
     "@babel/plugin-transform-react-display-name": "^7.24.7",
     "@babel/plugin-transform-react-jsx": "^7.25.2",
     "@babel/plugin-transform-react-jsx-self": "^7.24.7",
     "@babel/plugin-transform-react-jsx-source": "^7.24.7",
-    "@babel/plugin-transform-regenerator": "^7.24.7",
     "@babel/plugin-transform-runtime": "^7.24.7",
     "@babel/plugin-transform-typescript": "^7.25.2",
     "@babel/plugin-transform-unicode-regex": "^7.24.7",
```

**File**: `packages/react-native-babel-preset/src/__tests__/__fixtures__/output/hermes-canary-dev.js` (modified, +5/-10)
```diff
@@ -53,9 +53,6 @@ var _dataUtils = require("./data-utils");
 var _jsxFileName = "/absolute/path/to/input.js";
 function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (var _t in e) "default" !== _t && {}.hasOwnProperty.call(e, _t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, _t)) && (i.get || i.set) ? o(f, _t, i) : f[_t] = e[_t]); return f; })(e, t); }
 function _wrapRegExp() { _wrapRegExp = function (e, r) { return new BabelRegExp(e, void 0, r); }; var e = RegExp.prototype, r = new WeakMap(); function BabelRegExp(e, t, p) { var o = RegExp(e, t); return r.set(o, p || r.get(e)), (0, _setPrototypeOf2.default)(o, BabelRegExp.prototype); } function buildGroups(e, t) { var p = r.get(t); return Object.keys(p).reduce(function (r, t) { var o = p[t]; if ("number" == typeof o) r[t] = e[o];else { for (var i = 0; void 0 === e[o[i]] && i + 1 < o.length;) i++; r[t] = e[o[i]]; } return r; }, Object.create(null)); } return (0, _inherits2.default)(BabelRegExp, RegExp), BabelRegExp.prototype.exec = function (r) { var t = e.exec.call(this, r); if (t) { t.groups = buildGroups(t, this); var p = t.indices; p && (p.groups = buildGroups(p, this)); } return t; }, BabelRegExp.prototype[Symbol.replace] = function (t, p) { if ("string" == typeof p) { var o = r.get(this); return e[Symbol.replace].call(this, t, p.replace(/\$<([^>]+)(>|$)/g, function (e, r, t) { if ("" === t) return e; var p = o[r]; return Array.isArray(p) ? "$" + p.join("$") : "number" == typeof p ? "$" + p : ""; })); } if ("function" == typeof p) { var i = this; return e[Symbol.replace].call(this, t, function () { var e = arguments; return "object" != typeof e[e.length - 1] && (e = [].slice.call(e)).push(buildGroups(e, i)), p.apply(this, e); }); } return e[Symbol.replace].call(this, t, p); }, _wrapRegExp.apply(this, arguments); }
-function _createForOfIteratorHelperLoose(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (t) return (t = t.call(r)).next.bind(t); if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var o = 0; return function () { return o >= r.length ? { done: !0 } : { done: !1, value: r[o++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
-function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
-function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
 var _count = (0, _classPrivateFieldLooseKey2.default)("count");
 var _instances = (0, _classPrivateFieldLooseKey2.default)("instances");
 var _increment = (0, _classPrivateFieldLooseKey2.default)("increment");
@@ -114,8 +111,7 @@ function _fetchData() {
   return _fetchData.apply(this, arguments);
 }
 function getNestedValue(obj) {
-  var _obj$a$b$c, _obj$a;
-  return (_obj$a$b$c = obj == null || (_obj$a = obj.a) == null || (_obj$a = _obj$a.b) == null ? void 0 : _obj$a.c) != null ? _obj$a$b$c : 42;
+  return obj?.a?.b?.c ?? 42;
 }
 class Animal {
   #age;
@@ -168,8 +164,7 @@ function mergeConfigs(base, ...overrides) {
 }
 function sumPairs(pairs) {
   var total = 0;
-  for (var _iterator = _createForOfIteratorHelperLoose(pairs), _step; !(_step = _iterator()).done;) {
-    var [a, b] = _step.value;
+  for (var [a, b] of pairs) {
     total += a + b;
   }
   return total;
@@ -181,7 +176,7 @@ function parseDate(dateString) {
     day: 3
   });
   var match = dateString.match(regex);
-  if (match != null && match.groups) {
+  if (match?.groups) {
     return {
       year: match.groups.year,
       month: match.groups.month,
@@ -193,13 +188,13 @@ function parseDate(dateString) {
 function safeJsonParse(input) {
   try {
     return JSON.parse(input);
-  } catch (_unused) {
+  } catch {
     return null;
   }
 }
 function matchEmoji(text) {
   var match = text.match(/(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2
```

**File**: `packages/react-native-babel-preset/src/__tests__/__fixtures__/output/hermes-stable-dev-preserve-async.js` (modified, +5/-10)
```diff
@@ -50,9 +50,6 @@ var _dataUtils = require("./data-utils");
 var _jsxFileName = "/absolute/path/to/input.js";
 function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (var _t in e) "default" !== _t && {}.hasOwnProperty.call(e, _t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, _t)) && (i.get || i.set) ? o(f, _t, i) : f[_t] = e[_t]); return f; })(e, t); }
 function _wrapRegExp() { _wrapRegExp = function (e, r) { return new BabelRegExp(e, void 0, r); }; var e = RegExp.prototype, r = new WeakMap(); function BabelRegExp(e, t, p) { var o = RegExp(e, t); return r.set(o, p || r.get(e)), (0, _setPrototypeOf2.default)(o, BabelRegExp.prototype); } function buildGroups(e, t) { var p = r.get(t); return Object.keys(p).reduce(function (r, t) { var o = p[t]; if ("number" == typeof o) r[t] = e[o];else { for (var i = 0; void 0 === e[o[i]] && i + 1 < o.length;) i++; r[t] = e[o[i]]; } return r; }, Object.create(null)); } return (0, _inherits2.default)(BabelRegExp, RegExp), BabelRegExp.prototype.exec = function (r) { var t = e.exec.call(this, r); if (t) { t.groups = buildGroups(t, this); var p = t.indices; p && (p.groups = buildGroups(p, this)); } return t; }, BabelRegExp.prototype[Symbol.replace] = function (t, p) { if ("string" == typeof p) { var o = r.get(this); return e[Symbol.replace].call(this, t, p.replace(/\$<([^>]+)(>|$)/g, function (e, r, t) { if ("" === t) return e; var p = o[r]; return Array.isArray(p) ? "$" + p.join("$") : "number" == typeof p ? "$" + p : ""; })); } if ("function" == typeof p) { var i = this; return e[Symbol.replace].call(this, t, function () { var e = arguments; return "object" != typeof e[e.length - 1] && (e = [].slice.call(e)).push(buildGroups(e, i)), p.apply(this, e); }); } return e[Symbol.replace].call(this, t, p); }, _wrapRegExp.apply(this, arguments); }
-function _createForOfIteratorHelperLoose(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (t) return (t = t.call(r)).next.bind(t); if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var o = 0; return function () { return o >= r.length ? { done: !0 } : { done: !1, value: r[o++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
-function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
-function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
 var _count = (0, _classPrivateFieldLooseKey2.default)("count");
 var _instances = (0, _classPrivateFieldLooseKey2.default)("instances");
 var _increment = (0, _classPrivateFieldLooseKey2.default)("increment");
@@ -99,8 +96,7 @@ async function fetchData(url) {
   };
 }
 function getNestedValue(obj) {
-  var _obj$a$b$c, _obj$a;
-  return (_obj$a$b$c = obj == null || (_obj$a = obj.a) == null || (_obj$a = _obj$a.b) == null ? void 0 : _obj$a.c) != null ? _obj$a$b$c : 42;
+  return obj?.a?.b?.c ?? 42;
 }
 class Animal {
   #age;
@@ -151,8 +147,7 @@ function mergeConfigs(base, ...overrides) {
 }
 function sumPairs(pairs) {
   var total = 0;
-  for (var _iterator = _createForOfIteratorHelperLoose(pairs), _step; !(_step = _iterator()).done;) {
-    var [a, b] = _step.value;
+  for (var [a, b] of pairs) {
     total += a + b;
   }
   return total;
@@ -164,7 +159,7 @@ function parseDate(dateString) {
     day: 3
   });
   var match = dateString.match(regex);
-  if (match != null && match.groups) {
+  if (match?.groups) {
     return {
       year: match.groups.year,
       month: match.groups.month,
@@ -176,13 +171,13 @@ function parseDate(dateString) {
 function safeJsonParse(input) {
   try {
     return JSON.parse(input);
-  } catch (_unused) {
+  } catch {
     return null;
   }
 }
 function matchEmoji(text) {
   var match = text.match(/(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1
```

**File**: `packages/react-native-babel-preset/src/__tests__/__fixtures__/output/hermes-stable-dev-preserve-block-scoping.js` (modified, +5/-10)
```diff
@@ -53,9 +53,6 @@ var _dataUtils = require("./data-utils");
 var _jsxFileName = "/absolute/path/to/input.js";
 function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
 function _wrapRegExp() { _wrapRegExp = function (e, r) { return new BabelRegExp(e, void 0, r); }; var e = RegExp.prototype, r = new WeakMap(); function BabelRegExp(e, t, p) { var o = RegExp(e, t); return r.set(o, p || r.get(e)), (0, _setPrototypeOf2.default)(o, BabelRegExp.prototype); } function buildGroups(e, t) { var p = r.get(t); return Object.keys(p).reduce(function (r, t) { var o = p[t]; if ("number" == typeof o) r[t] = e[o];else { for (var i = 0; void 0 === e[o[i]] && i + 1 < o.length;) i++; r[t] = e[o[i]]; } return r; }, Object.create(null)); } return (0, _inherits2.default)(BabelRegExp, RegExp), BabelRegExp.prototype.exec = function (r) { var t = e.exec.call(this, r); if (t) { t.groups = buildGroups(t, this); var p = t.indices; p && (p.groups = buildGroups(p, this)); } return t; }, BabelRegExp.prototype[Symbol.replace] = function (t, p) { if ("string" == typeof p) { var o = r.get(this); return e[Symbol.replace].call(this, t, p.replace(/\$<([^>]+)(>|$)/g, function (e, r, t) { if ("" === t) return e; var p = o[r]; return Array.isArray(p) ? "$" + p.join("$") : "number" == typeof p ? "$" + p : ""; })); } if ("function" == typeof p) { var i = this; return e[Symbol.replace].call(this, t, function () { var e = arguments; return "object" != typeof e[e.length - 1] && (e = [].slice.call(e)).push(buildGroups(e, i)), p.apply(this, e); }); } return e[Symbol.replace].call(this, t, p); }, _wrapRegExp.apply(this, arguments); }
-function _createForOfIteratorHelperLoose(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (t) return (t = t.call(r)).next.bind(t); if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var o = 0; return function () { return o >= r.length ? { done: !0 } : { done: !1, value: r[o++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
-function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
-function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
 var _count = (0, _classPrivateFieldLooseKey2.default)("count");
 var _instances = (0, _classPrivateFieldLooseKey2.default)("instances");
 var _increment = (0, _classPrivateFieldLooseKey2.default)("increment");
@@ -114,8 +111,7 @@ function _fetchData() {
   return _fetchData.apply(this, arguments);
 }
 function getNestedValue(obj) {
-  var _obj$a$b$c, _obj$a;
-  return (_obj$a$b$c = obj == null || (_obj$a = obj.a) == null || (_obj$a = _obj$a.b) == null ? void 0 : _obj$a.c) != null ? _obj$a$b$c : 42;
+  return obj?.a?.b?.c ?? 42;
 }
 class Animal {
   #age;
@@ -168,8 +164,7 @@ function mergeConfigs(base, ...overrides) {
 }
 function sumPairs(pairs) {
   let total = 0;
-  for (var _iterator = _createForOfIteratorHelperLoose(pairs), _step; !(_step = _iterator()).done;) {
-    const [a, b] = _step.value;
+  for (const [a, b] of pairs) {
     total += a + b;
   }
   return total;
@@ -181,7 +176,7 @@ function parseDate(dateString) {
     day: 3
   });
   const match = dateString.match(regex);
-  if (match != null && match.groups) {
+  if (match?.groups) {
     return {
       year: match.groups.year,
       month: match.groups.month,
@@ -193,13 +188,13 @@ function parseDate(dateString) {
 function safeJsonParse(input) {
   try {
     return JSON.parse(input);
-  } catch (_unused) {
+  } catch {
     return null;
   }
 }
 function matchEmoji(text) {
   const match = text.match(/(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-
```

**File**: `packages/react-native-babel-preset/src/__tests__/__fixtures__/output/hermes-stable-dev-preserve-class-private.js` (modified, +5/-10)
```diff
@@ -51,9 +51,6 @@ var _dataUtils = require("./data-utils");
 var _jsxFileName = "/absolute/path/to/input.js";
 function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (var _t in e) "default" !== _t && {}.hasOwnProperty.call(e, _t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, _t)) && (i.get || i.set) ? o(f, _t, i) : f[_t] = e[_t]); return f; })(e, t); }
 function _wrapRegExp() { _wrapRegExp = function (e, r) { return new BabelRegExp(e, void 0, r); }; var e = RegExp.prototype, r = new WeakMap(); function BabelRegExp(e, t, p) { var o = RegExp(e, t); return r.set(o, p || r.get(e)), (0, _setPrototypeOf2.default)(o, BabelRegExp.prototype); } function buildGroups(e, t) { var p = r.get(t); return Object.keys(p).reduce(function (r, t) { var o = p[t]; if ("number" == typeof o) r[t] = e[o];else { for (var i = 0; void 0 === e[o[i]] && i + 1 < o.length;) i++; r[t] = e[o[i]]; } return r; }, Object.create(null)); } return (0, _inherits2.default)(BabelRegExp, RegExp), BabelRegExp.prototype.exec = function (r) { var t = e.exec.call(this, r); if (t) { t.groups = buildGroups(t, this); var p = t.indices; p && (p.groups = buildGroups(p, this)); } return t; }, BabelRegExp.prototype[Symbol.replace] = function (t, p) { if ("string" == typeof p) { var o = r.get(this); return e[Symbol.replace].call(this, t, p.replace(/\$<([^>]+)(>|$)/g, function (e, r, t) { if ("" === t) return e; var p = o[r]; return Array.isArray(p) ? "$" + p.join("$") : "number" == typeof p ? "$" + p : ""; })); } if ("function" == typeof p) { var i = this; return e[Symbol.replace].call(this, t, function () { var e = arguments; return "object" != typeof e[e.length - 1] && (e = [].slice.call(e)).push(buildGroups(e, i)), p.apply(this, e); }); } return e[Symbol.replace].call(this, t, p); }, _wrapRegExp.apply(this, arguments); }
-function _createForOfIteratorHelperLoose(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (t) return (t = t.call(r)).next.bind(t); if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var o = 0; return function () { return o >= r.length ? { done: !0 } : { done: !1, value: r[o++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
-function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
-function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
 class Counter {
   #count = 0;
   static #instances = 0;
@@ -100,8 +97,7 @@ function _fetchData() {
   return _fetchData.apply(this, arguments);
 }
 function getNestedValue(obj) {
-  var _obj$a$b$c, _obj$a;
-  return (_obj$a$b$c = obj == null || (_obj$a = obj.a) == null || (_obj$a = _obj$a.b) == null ? void 0 : _obj$a.c) != null ? _obj$a$b$c : 42;
+  return obj?.a?.b?.c ?? 42;
 }
 class Animal {
   #age;
@@ -154,8 +150,7 @@ function mergeConfigs(base, ...overrides) {
 }
 function sumPairs(pairs) {
   var total = 0;
-  for (var _iterator = _createForOfIteratorHelperLoose(pairs), _step; !(_step = _iterator()).done;) {
-    var [a, b] = _step.value;
+  for (var [a, b] of pairs) {
     total += a + b;
   }
   return total;
@@ -167,7 +162,7 @@ function parseDate(dateString) {
     day: 3
   });
   var match = dateString.match(regex);
-  if (match != null && match.groups) {
+  if (match?.groups) {
     return {
       year: match.groups.year,
       month: match.groups.month,
@@ -179,13 +174,13 @@ function parseDate(dateString) {
 function safeJsonParse(input) {
   try {
     return JSON.parse(input);
-  } catch (_unused) {
+  } catch {
     return null;
   }
 }
 function matchEmoji(text) {
   var match = text.match(/(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26A7\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7
```

**File**: `packages/react-native-babel-preset/src/__tests__/__fixtures__/output/hermes-stable-dev-preserve-destructuring.js` (modified, +5/-10)
```diff
@@ -53,9 +53,6 @@ var _dataUtils = require("./data-utils");
 var _jsxFileName = "/absolute/path/to/input.js";
 function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (var _t in e) "default" !== _t && {}.hasOwnProperty.call(e, _t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, _t)) && (i.get || i.set) ? o(f, _t, i) : f[_t] = e[_t]); return f; })(e, t); }
 function _wrapRegExp() { _wrapRegExp = function (e, r) { return new BabelRegExp(e, void 0, r); }; var e = RegExp.prototype, r = new WeakMap(); function BabelRegExp(e, t, p) { var o = RegExp(e, t); return r.set(o, p || r.get(e)), (0, _setPrototypeOf2.default)(o, BabelRegExp.prototype); } function buildGroups(e, t) { var p = r.get(t); return Object.keys(p).reduce(function (r, t) { var o = p[t]; if ("number" == typeof o) r[t] = e[o];else { for (var i = 0; void 0 === e[o[i]] && i + 1 < o.length;) i++; r[t] = e[o[i]]; } return r; }, Object.create(null)); } return (0, _inherits2.default)(BabelRegExp, RegExp), BabelRegExp.prototype.exec = function (r) { var t = e.exec.call(this, r); if (t) { t.groups = buildGroups(t, this); var p = t.indices; p && (p.groups = buildGroups(p, this)); } return t; }, BabelRegExp.prototype[Symbol.replace] = function (t, p) { if ("string" == typeof p) { var o = r.get(this); return e[Symbol.replace].call(this, t, p.replace(/\$<([^>]+)(>|$)/g, function (e, r, t) { if ("" === t) return e; var p = o[r]; return Array.isArray(p) ? "$" + p.join("$") : "number" == typeof p ? "$" + p : ""; })); } if ("function" == typeof p) { var i = this; return e[Symbol.replace].call(this, t, function () { var e = arguments; return "object" != typeof e[e.length - 1] && (e = [].slice.call(e)).push(buildGroups(e, i)), p.apply(this, e); }); } return e[Symbol.replace].call(this, t, p); }, _wrapRegExp.apply(this, arguments); }
-function _createForOfIteratorHelperLoose(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (t) return (t = t.call(r)).next.bind(t); if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var o = 0; return function () { return o >= r.length ? { done: !0 } : { done: !1, value: r[o++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
-function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
-function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
 var _count = (0, _classPrivateFieldLooseKey2.default)("count");
 var _instances = (0, _classPrivateFieldLooseKey2.default)("instances");
 var _increment = (0, _classPrivateFieldLooseKey2.default)("increment");
@@ -114,8 +111,7 @@ function _fetchData() {
   return _fetchData.apply(this, arguments);
 }
 function getNestedValue(obj) {
-  var _obj$a$b$c, _obj$a;
-  return (_obj$a$b$c = obj == null || (_obj$a = obj.a) == null || (_obj$a = _obj$a.b) == null ? void 0 : _obj$a.c) != null ? _obj$a$b$c : 42;
+  return obj?.a?.b?.c ?? 42;
 }
 class Animal {
   #age;
@@ -168,8 +164,7 @@ function mergeConfigs(base, ...overrides) {
 }
 function sumPairs(pairs) {
   var total = 0;
-  for (var _iterator = _createForOfIteratorHelperLoose(pairs), _step; !(_step = _iterator()).done;) {
-    var [a, b] = _step.value;
+  for (var [a, b] of pairs) {
     total += a + b;
   }
   return total;
@@ -181,7 +176,7 @@ function parseDate(dateString) {
     day: 3
   });
   var match = dateString.match(regex);
-  if (match != null && match.groups) {
+  if (match?.groups) {
     return {
       year: match.groups.year,
       month: match.groups.month,
@@ -193,13 +188,13 @@ function parseDate(dateString) {
 function safeJsonParse(input) {
   try {
     return JSON.parse(input);
-  } catch (_unused) {
+  } catch {
     return null;
   }
 }
 function matchEmoji(text) {
   var match = text.match(/(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2
```

**File**: `packages/react-native-babel-preset/src/__tests__/__fixtures__/output/hermes-stable-dev.js` (modified, +5/-10)
```diff
@@ -53,9 +53,6 @@ var _dataUtils = require("./data-utils");
 var _jsxFileName = "/absolute/path/to/input.js";
 function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (var _t in e) "default" !== _t && {}.hasOwnProperty.call(e, _t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, _t)) && (i.get || i.set) ? o(f, _t, i) : f[_t] = e[_t]); return f; })(e, t); }
 function _wrapRegExp() { _wrapRegExp = function (e, r) { return new BabelRegExp(e, void 0, r); }; var e = RegExp.prototype, r = new WeakMap(); function BabelRegExp(e, t, p) { var o = RegExp(e, t); return r.set(o, p || r.get(e)), (0, _setPrototypeOf2.default)(o, BabelRegExp.prototype); } function buildGroups(e, t) { var p = r.get(t); return Object.keys(p).reduce(function (r, t) { var o = p[t]; if ("number" == typeof o) r[t] = e[o];else { for (var i = 0; void 0 === e[o[i]] && i + 1 < o.length;) i++; r[t] = e[o[i]]; } return r; }, Object.create(null)); } return (0, _inherits2.default)(BabelRegExp, RegExp), BabelRegExp.prototype.exec = function (r) { var t = e.exec.call(this, r); if (t) { t.groups = buildGroups(t, this); var p = t.indices; p && (p.groups = buildGroups(p, this)); } return t; }, BabelRegExp.prototype[Symbol.replace] = function (t, p) { if ("string" == typeof p) { var o = r.get(this); return e[Symbol.replace].call(this, t, p.replace(/\$<([^>]+)(>|$)/g, function (e, r, t) { if ("" === t) return e; var p = o[r]; return Array.isArray(p) ? "$" + p.join("$") : "number" == typeof p ? "$" + p : ""; })); } if ("function" == typeof p) { var i = this; return e[Symbol.replace].call(this, t, function () { var e = arguments; return "object" != typeof e[e.length - 1] && (e = [].slice.call(e)).push(buildGroups(e, i)), p.apply(this, e); }); } return e[Symbol.replace].call(this, t, p); }, _wrapRegExp.apply(this, arguments); }
-function _createForOfIteratorHelperLoose(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (t) return (t = t.call(r)).next.bind(t); if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var o = 0; return function () { return o >= r.length ? { done: !0 } : { done: !1, value: r[o++] }; }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
-function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
-function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
 var _count = (0, _classPrivateFieldLooseKey2.default)("count");
 var _instances = (0, _classPrivateFieldLooseKey2.default)("instances");
 var _increment = (0, _classPrivateFieldLooseKey2.default)("increment");
@@ -114,8 +111,7 @@ function _fetchData() {
   return _fetchData.apply(this, arguments);
 }
 function getNestedValue(obj) {
-  var _obj$a$b$c, _obj$a;
-  return (_obj$a$b$c = obj == null || (_obj$a = obj.a) == null || (_obj$a = _obj$a.b) == null ? void 0 : _obj$a.c) != null ? _obj$a$b$c : 42;
+  return obj?.a?.b?.c ?? 42;
 }
 class Animal {
   #age;
@@ -168,8 +164,7 @@ function mergeConfigs(base, ...overrides) {
 }
 function sumPairs(pairs) {
   var total = 0;
-  for (var _iterator = _createForOfIteratorHelperLoose(pairs), _step; !(_step = _iterator()).done;) {
-    var [a, b] = _step.value;
+  for (var [a, b] of pairs) {
     total += a + b;
   }
   return total;
@@ -181,7 +176,7 @@ function parseDate(dateString) {
     day: 3
   });
   var match = dateString.match(regex);
-  if (match != null && match.groups) {
+  if (match?.groups) {
     return {
       year: match.groups.year,
       month: match.groups.month,
@@ -193,13 +188,13 @@ function parseDate(dateString) {
 function safeJsonParse(input) {
   try {
     return JSON.parse(input);
-  } catch (_unused) {
+  } catch {
     return null;
   }
 }
 function matchEmoji(text) {
   var match = text.match(/(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2
```

**File**: `packages/react-native-babel-preset/src/__tests__/transform-snapshot-test.js` (modified, +29/-4)
```diff
@@ -354,22 +354,47 @@ describe('react-native-babel-preset transform snapshots', () => {
       expect(result).toContain('_wrapAsyncGenerator');
     });
 
-    it('handles optional chaining', () => {
+    it('preserves optional chaining in dev with hermes-stable profile', () => {
       const code = `const x = obj?.a?.b?.c;`;
       const result = transformCode(code, {
         dev: true,
         unstable_transformProfile: 'hermes-stable',
       });
-      expect(result).not.toContain('?.');
+      expect(result).toContain('obj?.a?.b?.c');
     });
 
-    it('handles nullish coalescing', () => {
+    it('preserves nullish coalescing in dev with hermes-stable profile', () => {
       const code = `const x = a ?? b;`;
       const result = transformCode(code, {
         dev: true,
         unstable_transformProfile: 'hermes-stable',
       });
-      expect(result).not.toContain('??');
+      expect(result).toContain('a ?? b');
+    });
+
+    it('preserves generators, for-of and optional catch binding in dev without Babel runtime', () => {
+      const code = `
+        function* gen() {
+          try {
+            yield 1;
+          } catch {
+            yield 2;
+          }
+        }
+        for (const x of gen()) {
+          console.log(x);
+        }
+      `;
+      const result = transformCode(code, {
+        dev: true,
+        unstable_transformProfile: 'hermes-stable',
+        enableBabelRuntime: false,
+      });
+      expect(result).toContain('function* gen()');
+      expect(result).toContain('x of gen()');
+      expect(result).toContain('catch {');
+      expect(result).not.toContain('_regenerator');
+      expect(result).not.toContain('_createForOfIteratorHelperLoose');
     });
 
     it('handles flow enums', () => {
```

---

### Incident Patch 2: `b1755a38` (2026-10-22)
**Commit Message**: Add visual regression testing for RNTester (#59115)

Summary:
RNTester's rendering coverage, particularly text, currently lives in Meta's internal jest-e2e suite. To move it into public CI we need screenshot comparison that works for fork PRs and doesn't add PNGs to the repo. This adds that, as a separate set of visual flows alongside the existing Maestro E2E.

### How it works

Visual tests are Maestro flows in `packages/rn-tester/visual-tests/flows/`. Each one deep-links to an RNTester example, waits for it to be ready and captures a screenshot cropped to a `testID`. Maestro only captures - it never decides pass or fail.

The work is split across a trust boundary, so a fork PR never runs with credentials:

- **Visual capture** runs as two jobs in Test All, reusing its RNTester Release builds: `test_visual_android_rntester` after `build_android` and `test_visual_ios_rntester` after `test_ios_rntester`. Each runs every flow in one Maestro invocation, on a Pixel 7 API 35 emulator (1080x2400, 420dpi) or an iPhone 17 Pro on iOS 26.2, and uploads the PNGs and a manifest recording the commit and device environment as an artifact. They have no secrets.
- **Visual Compare RNTester** (`wor

**File**: `.github/workflow-scripts/__tests__/__fixtures__/visual.js` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+/**
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ *
+ * @noflow
+ * @format
+ */
+
+const SHA_A = 'a'.repeat(40);
+const SHA_B = 'b'.repeat(40);
+
+const ANDROID_ENVIRONMENT = {
+  apiLevel: 35,
+  abi: 'x86_64',
+  nativeBridge: 'libndk_translation.so',
+  systemImage:
+    'google/sdk_gphone64_x86_64/emu64xa:15/AE3A/1:userdebug/dev-keys',
+  screenSize: '1080x2400',
+  density: 420,
+  fontScale: '1.0',
+  locale: 'en-US',
+  animatorDurationScale: '0.0',
+  emulatorVersion: '37.2.12',
+};
+
+module.exports = {ANDROID_ENVIRONMENT, SHA_A, SHA_B};
```

**File**: `.github/workflow-scripts/__tests__/visual-capture-test.js` (added, +146/-0)
```diff
@@ -0,0 +1,146 @@
+/**
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ *
+ * @noflow
+ * @format
+ */
+
+const {
+  collectFlows,
+  failedFlowsFromJUnit,
+  maestroArgs,
+} = require('../visual/capture');
+const {environmentKey} = require('../visual/manifest');
+const {ANDROID_ENVIRONMENT} = require('./__fixtures__/visual');
+const fs = require('node:fs');
+const os = require('node:os');
+const path = require('node:path');
+
+describe('visual capture', () => {
+  let directory;
+
+  beforeEach(() => {
+    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-test-'));
+  });
+
+  afterEach(() => {
+    fs.rmSync(directory, {recursive: true, force: true});
+  });
+
+  describe('environmentKey', () => {
+    test('is readable and stable', () => {
+      expect(environmentKey('android', ANDROID_ENVIRONMENT)).toMatch(
+        /^android-api35-x86-64-1080x2400-420dpi-[0-9a-f]{8}$/,
+      );
+      expect(environmentKey('android', {...ANDROID_ENVIRONMENT})).toBe(
+        environmentKey('android', ANDROID_ENVIRONMENT),
+      );
+    });
+
+    test.each([
+      ['fontScale', '1.15'],
+      ['emulatorVersion', '37.3.1'],
+    ])('changes when %s drifts', (property, value) => {
+      expect(
+        environmentKey('android', {...ANDROID_ENVIRONMENT, [property]: value}),
+      ).not.toBe(environmentKey('android', ANDROID_ENVIRONMENT));
+    });
+
+    test('ignores properties that are only recorded', () => {
+      expect(
+        environmentKey('ios', {
+          runtime: 'iOS-26-2',
+          deviceType: 'iPhone-17-Pro',
+          appearance: 'light',
+          contentSizeCategory: 'large',
+          locale: 'en_US',
+          xcode: 'Xcode 26.2',
+        }),
+      ).toBe(
+        environmentKey('ios', {
+          runtime: 'iOS-26-2',
+          deviceType: 'iPhone-17-Pro',
+          appearance: 'light',
+          contentSizeCategory: 'large',
+          locale: 'en_US',
+          xcode: 'Xcode 26.3',
+        }),
+      );
+    });
+    test('names iOS keys by runtime and device', () => {
+      expect(
+        environmentKey('ios', {
+          runtime: 'iOS-26-2',
+          deviceType: 'iPhone-17-Pro',
+        }),
+      ).toMatch(/^ios-26-2-iphone-17-pro-[0-9a-f]{8}$/);
+    });
+  });
+
+  describe('capture', () => {
+    test('collects top-level flows in order and ignores other files', () => {
+      fs.writeFileSync(path.join(directory, 'b.yml'), '');
+      fs.writeFileSync(path.join(directory, 'a.yaml'), '');
+      fs.writeFileSync(path.join(directory, 'notes.md'), '');
+      fs.mkdirSync(path.join(directory, 'helpers'));
+      fs.writeFileSync(path.join(directory, 'helpers/open.yml'), '');
+      expect(collectFlows(directory)).toEqual([
+        path.join(directory, 'a.yaml'),
+        path.join(directory, 'b.yml'),
+      ]);
+    });
+
+    test('rejects flows Maestro would report under the same name', () => {
+      fs.writeFileSync(path.join(directory, 'a.yml'), '');
+      fs.writeFileSync(path.join(directory, 'a.yaml'), '');
+      expect(() => collectFlows(directory)).toThrow("both report as 'a'");
+    });
+
+    test('reads failed flows from a Maestro JUnit report', () => {
+      const flows = ['/flows/text-a.yml', '/flows/text-b.yml', '/flows/c.yml'];
+      const report = [
+        '<testcase id="text-b" name="text-b" file="/flows/text-b.yml" status="ERROR">',
+        '<testcase id="text-a" name="text-a" file="/flows/text-a.yml" status="SUCCESS"/>',
+        '<testcase id="c" name="c" status="ERROR">',
+      ].join('\n');
+      expect(failedFlowsFromJUnit(report, flows)).toEqual([
+        '/flows/text-b.yml',
+        '/flows/c.yml',
+      ]);
+      expect(() =>
+        failedFlowsFromJUnit('<testcase name="other" status="ERROR">', flows),
+      ).toThrow("unknown flow 'other'");
+      expect(failedFlowsFromJUnit('', flows)).toEqual([]);
+    });
+
+    test.each([
+      [1, undefined, false],
+      [2, 'UDID', true],
+    ])('builds Maestro arguments for attempt %d', (attempt, udid, reuse) => {
+      const args = maestroArgs({
+        flows: ['/f/a.yml', '/f/b.yml'],
+        appId: 'com.example',
+        outputDir: '/out',
+        reportPath: '/r.xml',
+        udid,
+        attempt,
+      });
+      expect(
+        args.slice(args.indexOf('test'), args.indexOf('test') + 3),
+      ).toEqual(['test', '/f/a.yml', '/f/b.yml']);
+      expect(args).toEqual(
+        expect.arrayContaining([
+          '--format=junit',
+          '--output=/r.xml',
+          'APP_ID=com.example',
+          'VISUAL_OUTPUT_DIR=/out',
+        ]),
+      );
+      expect(args.includes('--no-reinstall-driver')).toBe(reuse);
+      expect(args.includes('--udid=UDID')).toBe(udid != null);
+    });
+  });
+});
```

**File**: `.github/workflow-scripts/__tests__/visual-compare-test.js` (added, +316/-0)
```diff
@@ -0,0 +1,316 @@
+/**
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ *
+ * @noflow
+ * @format
+ */
+
+const {compareCapture, compareImages, policyFor} = require('../visual/compare');
+const {resolveContext} = require('../visual/compare-run');
+const {buildManifest, sha256} = require('../visual/manifest');
+const {readPngDimensions} = require('../visual/png');
+const {validateCapture} = require('../visual/validate');
+const {ANDROID_ENVIRONMENT, SHA_A, SHA_B} = require('./__fixtures__/visual');
+const fs = require('node:fs');
+const os = require('node:os');
+const path = require('node:path');
+const {PNG} = require('pngjs');
+
+function makePng(width, height, paint = () => [255, 255, 255, 255]) {
+  const png = new PNG({width, height});
+  for (let y = 0; y < height; y++) {
+    for (let x = 0; x < width; x++) {
+      const offset = (y * width + x) * 4;
+      const [r, g, b, a] = paint(x, y);
+      png.data[offset] = r;
+      png.data[offset + 1] = g;
+      png.data[offset + 2] = b;
+      png.data[offset + 3] = a;
+    }
+  }
+  return PNG.sync.write(png);
+}
+
+function writeCapture(directory, images, overrides = {}) {
+  for (const [id, buffer] of Object.entries(images)) {
+    const filePath = path.join(directory, `${id}.png`);
+    fs.mkdirSync(path.dirname(filePath), {recursive: true});
+    fs.writeFileSync(filePath, buffer);
+  }
+  const manifest = buildManifest({
+    captureDir: directory,
+    platform: 'android',
+    environment: ANDROID_ENVIRONMENT,
+    git: {testedSha: SHA_A, baseSha: SHA_B, headSha: SHA_A},
+  });
+  const finalManifest = {...manifest, ...overrides};
+  fs.writeFileSync(
+    path.join(directory, 'manifest.json'),
+    JSON.stringify(finalManifest),
+  );
+  return finalManifest;
+}
+
+describe('visual comparison', () => {
+  let directory;
+
+  beforeEach(() => {
+    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-test-'));
+  });
+
+  afterEach(() => {
+    fs.rmSync(directory, {recursive: true, force: true});
+  });
+
+  describe('readPngDimensions', () => {
+    test('reads the IHDR dimensions', () => {
+      expect(readPngDimensions(makePng(3, 2))).toEqual({width: 3, height: 2});
+    });
+
+    test.each([
+      [Buffer.from('not a png at all, but long enough')],
+      [Buffer.alloc(0)],
+    ])('rejects non-PNG data', buffer => {
+      expect(readPngDimensions(buffer)).toBeNull();
+    });
+  });
+
+  describe('validateCapture', () => {
+    test('accepts a well-formed capture', () => {
+      const manifest = writeCapture(directory, {
+        'text/width-mode/default': makePng(4, 4),
+      });
+      expect(validateCapture(directory)).toEqual(manifest);
+    });
+
+    test.each([
+      ['../escape/a/b'],
+      ['/absolute/a/b'],
+      ['Text/Upper/case'],
+      ['too/few'],
+      ['a/b/c/d'],
+    ])('rejects test ID %s', id => {
+      writeCapture(directory, {'text/width-mode/default': makePng(4, 4)});
+      const manifest = JSON.parse(
+        fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'),
+      );
+      manifest.images[0] = {...manifest.images[0], id, path: `${id}.png`};
+      fs.writeFileSync(
+        path.join(directory, 'manifest.json'),
+        JSON.stringify(manifest),
+      );
+      expect(() => validateCapture(directory)).toThrow('Invalid test ID');
+    });
+
+    test('rejects a path that does not match the ID', () => {
+      const manifest = writeCapture(directory, {
+        'text/width-mode/default': makePng(4, 4),
+      });
+      manifest.images[0].path = '../../etc/passwd';
+      fs.writeFileSync(
+        path.join(directory, 'manifest.json'),
+        JSON.stringify(manifest),
+      );
+      expect(() => validateCapture(directory)).toThrow('path must be');
+    });
+
+    test('rejects duplicates, mismatched hashes and unlisted files', () => {
+      const manifest = writeCapture(directory, {
+        'text/width-mode/default': makePng(4, 4),
+      });
+      manifest.images.push({...manifest.images[0]});
+      manifest.images[0] = {...manifest.images[0], sha256: '0'.repeat(64)};
+      fs.writeFileSync(
+        path.join(directory, 'manifest.json'),
+        JSON.stringify(manifest),
+      );
+      fs.writeFileSync(path.join(directory, 'extra.sh'), 'echo hi');
+      let message = '';
+      try {
+        validateCapture(directory);
+      } catch (error) {
+        message = error.message;
+      }
+      expect(message).toContain('Duplicate test ID');
+      expect(message).toContain('does not match its manifest entry');
+      expect(message).toContain('Files not in the manifest: extra.sh');
+    });
+
+    test('rejects non-PNG content and oversized images', () => {
+      writeCapture(directory, {
+        'text/width-mode/default': makePng(4, 4),
+        'text/width-mode/large': makePng(20, 4),
+      });
+      fs.writeFileSync(
+ 
```

**File**: `.github/workflow-scripts/__tests__/visual-report-test.js` (added, +245/-0)
```diff
@@ -0,0 +1,245 @@
+/**
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ *
+ * @noflow
+ * @format
+ */
+
+const {
+  APPROVAL_LABEL,
+  differenceFingerprint,
+  gateDecision,
+} = require('../visual/approval');
+const {
+  COMMENT_MARKER,
+  renderCheckOutput,
+  renderPullRequestComment,
+} = require('../visual/report');
+const {
+  approvalKey,
+  baselinePrefix,
+  publicUrl,
+  reportPrefix,
+} = require('../visual/storage');
+const {SHA_A, SHA_B} = require('./__fixtures__/visual');
+
+describe('visual reports and approval', () => {
+  describe('storage keys', () => {
+    test('builds write-once keys', () => {
+      expect(baselinePrefix('ios-x-0123abcd', SHA_A)).toBe(
+        `baselines/ios-x-0123abcd/${SHA_A}`,
+      );
+      expect(
+        reportPrefix({prNumber: 12, headSha: SHA_A, runId: 34, runAttempt: 2}),
+      ).toBe(`reports/pull/12/${SHA_A}/34-2`);
+      expect(
+        reportPrefix({
+          prNumber: null,
+          headSha: SHA_A,
+          runId: 34,
+          runAttempt: 1,
+        }),
+      ).toBe(`reports/main/${SHA_A}/34-1`);
+      expect(approvalKey(12, '0123456789abcdef')).toBe(
+        'approvals/pull/12/0123456789abcdef.json',
+      );
+    });
+
+    test.each([
+      [() => baselinePrefix('k', 'main')],
+      [
+        () =>
+          reportPrefix({prNumber: -1, headSha: SHA_A, runId: 1, runAttempt: 1}),
+      ],
+      [
+        () =>
+          reportPrefix({
+            prNumber: 1,
+            headSha: SHA_A,
+            runId: 1.5,
+            runAttempt: 1,
+          }),
+      ],
+      [() => approvalKey(1, '../x')],
+    ])('rejects invalid input', build => {
+      expect(build).toThrow('Invalid');
+    });
+
+    test('encodes each path segment of public URLs', () => {
+      expect(publicUrl('https://cdn.example/bucket/', 'a b/c#d.png')).toBe(
+        'https://cdn.example/bucket/a%20b/c%23d.png',
+      );
+    });
+  });
+
+  describe('approval', () => {
+    const platform = results => ({
+      platform: 'ios',
+      environmentKey: 'ios-x-0123abcd',
+      results,
+    });
+    const changed = (sha, expectedSha = 'e') => ({
+      id: 'a/b/c',
+      status: 'changed',
+      expected: {sha256: expectedSha},
+      captured: {sha256: sha},
+    });
+
+    test('has no fingerprint without differences', () => {
+      expect(
+        differenceFingerprint([platform([{id: 'a/b/c', status: 'unchanged'}])]),
+      ).toBeNull();
+    });
+
+    test('fingerprints the exact captured images', () => {
+      const first = differenceFingerprint([platform([changed('1')])]);
+      expect(first).toMatch(/^[0-9a-f]{16}$/);
+      expect(differenceFingerprint([platform([changed('1')])])).toBe(first);
+      expect(differenceFingerprint([platform([changed('2')])])).not.toBe(first);
+      expect(differenceFingerprint([platform([changed('1', 'f')])])).not.toBe(
+        first,
+      );
+    });
+
+    test.each([
+      [null, false, null, 'success', false],
+      ['f', false, null, 'failure', false],
+      ['f', true, {fingerprint: 'f', approver: 'x'}, 'success', false],
+      ['f', true, {fingerprint: 'g', approver: 'x'}, 'failure', true],
+      ['f', true, null, 'failure', true],
+    ])(
+      'gate for fingerprint %s, label %s, approval %j',
+      (fingerprint, labelPresent, approval, conclusion, staleLabel) => {
+        const decision = gateDecision({fingerprint, labelPresent, approval});
+        expect(decision.conclusion).toBe(conclusion);
+        expect(decision.staleLabel ?? false).toBe(staleLabel);
+        if (conclusion === 'failure' && !staleLabel) {
+          expect(decision.summary).toContain(APPROVAL_LABEL);
+        }
+      },
+    );
+  });
+
+  describe('renderPullRequestComment', () => {
+    const changed = id => ({
+      id,
+      status: 'changed',
+      diffPixels: 3,
+      diffRatio: 0.03,
+      expected: {},
+      captured: {},
+      hasDiffImage: true,
+    });
+    const platform = (name, results, error = null) => ({
+      platform: name,
+      environmentKey: `${name}-x-0123abcd`,
+      baseline: {sha: SHA_B, distance: 0},
+      results,
+      error,
+      checkUrl: `https://github.example/checks/${name}`,
+      imageUrl: (kind, id) => `https://cdn.example/${name}/${kind}/${id}.png`,
+    });
+
+    test('shows each diff with expected and captured collapsed', () => {
+      const body = renderPullRequestComment({
+        platforms: [
+          platform('android', [
+            {id: 'a/b/same', status: 'unchanged'},
+            changed('a/b/changed'),
+          ]),
+          platform('ios', [{id: 'a/b/new', status: 'added', captured: {}}]),
+        ],
+        headSha: SHA_A,
+        gateSummary: 'Needs approval.',
+      });
+      expect(body.startsWith(COMMENT_MARKER)).toBe(true);
+      expect(body).toContain(
+        '**2 visual differe
```

**File**: `.github/workflow-scripts/visual/approval.js` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+/**
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ *
+ * @noflow
+ * @format
+ */
+
+const {sha256} = require('./manifest');
+
+const APPROVAL_LABEL = 'visual-change-approved';
+const CHECK_NAME_PREFIX = 'Visual regression';
+const GATE_CHECK_NAME = 'Visual regression approval';
+const APPROVER_PERMISSIONS = ['admin', 'maintain', 'write'];
+
+/**
+ * Identifies a set of visual differences: which tests differ, how, and the
+ * exact expected and captured images. An approval applies to one fingerprint,
+ * so a push that changes any difference needs a new approval. The baseline
+ * commit isn't part of it: a rebase that leaves the expected images unchanged
+ * keeps the approval. Returns null when there are no differences.
+ */
+function differenceFingerprint(platforms) {
+  const lines = [];
+  for (const {platform, environmentKey, results} of platforms) {
+    for (const result of results) {
+      if (result.status === 'unchanged') {
+        continue;
+      }
+      lines.push(
+        [
+          platform,
+          environmentKey,
+          result.id,
+          result.status,
+          result.expected?.sha256 ?? '',
+          result.captured?.sha256 ?? '',
+        ].join('\t'),
+      );
+    }
+  }
+  if (lines.length === 0) {
+    return null;
+  }
+  return sha256(Buffer.from(lines.sort().join('\n'))).slice(0, 16);
+}
+
+/**
+ * The approval gate passes when there is nothing to approve, or when the
+ * approval label is present and an approval was recorded for this exact
+ * fingerprint.
+ */
+function gateDecision({fingerprint, labelPresent, approval}) {
+  if (fingerprint == null) {
+    return {conclusion: 'success', summary: 'No visual differences.'};
+  }
+  if (labelPresent && approval?.fingerprint === fingerprint) {
+    return {
+      conclusion: 'success',
+      summary: `Visual differences approved by @${approval.approver}.`,
+    };
+  }
+  if (labelPresent) {
+    return {
+      conclusion: 'failure',
+      summary: `The visual differences changed after approval. A maintainer must review the new report and re-apply \`${APPROVAL_LABEL}\`.`,
+      staleLabel: true,
+    };
+  }
+  return {
+    conclusion: 'failure',
+    summary: `Visual differences need maintainer approval. Review the report, then apply \`${APPROVAL_LABEL}\`.`,
+  };
+}
+
+module.exports = {
+  APPROVAL_LABEL,
+  APPROVER_PERMISSIONS,
+  CHECK_NAME_PREFIX,
+  GATE_CHECK_NAME,
+  differenceFingerprint,
+  gateDecision,
+};
```

**File**: `.github/workflow-scripts/visual/approve-run.js` (added, +183/-0)
```diff
@@ -0,0 +1,183 @@
+/**
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ *
+ * @noflow
+ * @format
+ */
+
+/**
+ * Records a maintainer's approval of a PR's visual differences and updates
+ * the approval gate. Runs from the default branch on `pull_request_target`
+ * when the approval label is added or removed. It never checks out or runs
+ * pull request code.
+ *
+ *   node approve-run.js prepare  Decide, and stage an approval record to
+ *                                upload under OUT_DIR.
+ *   node approve-run.js report   After the upload, update the gate check.
+ */
+
+const {
+  APPROVAL_LABEL,
+  APPROVER_PERMISSIONS,
+  GATE_CHECK_NAME,
+  gateDecision,
+} = require('./approval');
+const {createGitHubClient} = require('./github');
+const {
+  approvalKey,
+  fetchJsonOrNull,
+  listPrefixes,
+  publicUrl,
+} = require('./storage');
+const fs = require('node:fs');
+const path = require('node:path');
+
+function requireEnv(name) {
+  const value = process.env[name];
+  if (value == null || value === '') {
+    throw new Error(`${name} is required`);
+  }
+  return value;
+}
+
+/** The results of the most recent comparison for a PR head, or null. */
+async function latestResults({bucket, publicBaseUrl, prNumber, headSha}) {
+  const runs = await listPrefixes(
+    bucket,
+    `reports/pull/${prNumber}/${headSha}/`,
+  );
+  const latest = runs
+    .map(prefix => {
+      const match = /\/(\d+)-(\d+)\/$/.exec(prefix);
+      return match == null
+        ? null
+        : {prefix, runId: Number(match[1]), attempt: Number(match[2])};
+    })
+    .filter(Boolean)
+    .sort((a, b) => b.runId - a.runId || b.attempt - a.attempt)[0];
+  return latest == null
+    ? null
+    : fetchJsonOrNull(publicUrl(publicBaseUrl, `${latest.prefix}results.json`));
+}
+
+async function prepare() {
+  const github = createGitHubClient();
+  const outDir = requireEnv('OUT_DIR');
+  const event = JSON.parse(
+    fs.readFileSync(requireEnv('GITHUB_EVENT_PATH'), 'utf8'),
+  );
+  const writeState = state =>
+    fs.writeFileSync(
+      path.join(outDir, 'state.json'),
+      `${JSON.stringify(state)}\n`,
+    );
+  fs.mkdirSync(outDir, {recursive: true});
+
+  if (event.label?.name !== APPROVAL_LABEL) {
+    writeState(null);
+    return;
+  }
+
+  const prNumber = event.pull_request.number;
+  const headSha = event.pull_request.head.sha;
+  const results = await latestResults({
+    bucket: requireEnv('VISUAL_BUCKET'),
+    publicBaseUrl: requireEnv('VISUAL_PUBLIC_BASE_URL'),
+    prNumber,
+    headSha,
+  });
+  const fingerprint = results?.fingerprint ?? null;
+
+  if (event.action === 'labeled') {
+    const approver = event.sender.login;
+    const permission = await github.permission(approver);
+    if (!APPROVER_PERMISSIONS.includes(permission)) {
+      await github.removeLabel(prNumber, APPROVAL_LABEL);
+      await github.comment(
+        prNumber,
+        `@${approver} \`${APPROVAL_LABEL}\` needs write access to this repository, so it was removed.`,
+      );
+      writeState(null);
+      return;
+    }
+    if (results == null) {
+      await github.removeLabel(prNumber, APPROVAL_LABEL);
+      await github.comment(
+        prNumber,
+        `There is no visual report for \`${headSha.slice(0, 12)}\` yet, so \`${APPROVAL_LABEL}\` was removed. Apply it again once the report is posted.`,
+      );
+      writeState(null);
+      return;
+    }
+    if (fingerprint != null) {
+      const key = approvalKey(prNumber, fingerprint);
+      const record = {
+        fingerprint,
+        approver,
+        approvedAt: new Date().toISOString(),
+        headSha,
+      };
+      const recordPath = path.join(outDir, 'upload', key);
+      fs.mkdirSync(path.dirname(recordPath), {recursive: true});
+      fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);
+    }
+  }
+
+  writeState({
+    prNumber,
+    headSha,
+    fingerprint,
+    labelPresent: event.action === 'labeled',
+  });
+}
+
+async function report() {
+  const github = createGitHubClient();
+  const outDir = requireEnv('OUT_DIR');
+  const state = JSON.parse(
+    fs.readFileSync(path.join(outDir, 'state.json'), 'utf8'),
+  );
+  if (state == null) {
+    return;
+  }
+  const {prNumber, headSha, fingerprint, labelPresent} = state;
+  const approval =
+    fingerprint == null
+      ? null
+      : await fetchJsonOrNull(
+          publicUrl(
+            requireEnv('VISUAL_PUBLIC_BASE_URL'),
+            approvalKey(prNumber, fingerprint),
+          ),
+        );
+  const decision = gateDecision({fingerprint, labelPresent, approval});
+  await github.createCheckRun({
+    name: GATE_CHECK_NAME,
+    headSha,
+    conclusion: decision.conclusion,
+    output: {title: decision.summary, summary: decision.summary},
+  });
+  console.info(decision.summary);
+}
+
+async function main(command = pr
```

**File**: `.github/workflow-scripts/visual/capture.js` (added, +206/-0)
```diff
@@ -0,0 +1,206 @@
+/**
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ *
+ * @noflow
+ * @format
+ */
+
+/**
+ * Captures every visual flow in one Maestro invocation, so the JVM and
+ * driver startup (around two minutes on an iOS simulator) is paid once per
+ * job rather than once per flow. Flows that fail are rerun, and only those,
+ * on later attempts.
+ */
+
+const childProcess = require('node:child_process');
+const fs = require('node:fs');
+const path = require('node:path');
+
+const MAESTRO = path.join(process.env.HOME ?? '', '.maestro/bin/maestro');
+const DEFAULT_ATTEMPTS = 3;
+const ATTEMPT_TIMEOUT_MS = 30 * 60 * 1000;
+
+const usage = `
+node capture.js <platform> <app_path> <app_id> <flows_dir> <output_dir> [ios_udid]
+
+Installs the app, then runs every flow in <flows_dir> in one Maestro
+invocation, writing screenshots under <output_dir>. Failed flows are retried
+up to ${DEFAULT_ATTEMPTS} attempts in total (VISUAL_CAPTURE_ATTEMPTS).
+`;
+
+/** The flows directly inside `flowsDir`, sorted. Helpers live elsewhere. */
+function collectFlows(flowsDir) {
+  const flows = fs
+    .readdirSync(flowsDir, {withFileTypes: true})
+    .filter(entry => entry.isFile() && /\.ya?ml$/.test(entry.name))
+    .map(entry => path.join(flowsDir, entry.name))
+    .sort();
+  flowsByReportName(flows);
+  return flows;
+}
+
+/**
+ * Maps Maestro's report names to flow paths. Maestro reports a flow under its
+ * file name without the extension, so names must be unique.
+ */
+function flowsByReportName(flows) {
+  const byName = new Map();
+  for (const flow of flows) {
+    const name = path.basename(flow).replace(/\.ya?ml$/, '');
+    const existing = byName.get(name);
+    if (existing != null) {
+      throw new Error(
+        `${existing} and ${flow} would both report as '${name}'. Rename one.`,
+      );
+    }
+    byName.set(name, flow);
+  }
+  return byName;
+}
+
+/**
+ * The flows a Maestro JUnit report marks as anything but SUCCESS, in report
+ * order, matched by the report's file path or, failing that, its name. Throws
+ * on a report entry that matches none of `flows`.
+ */
+function failedFlowsFromJUnit(report, flows) {
+  const byName = flowsByReportName(flows);
+  const failed = [];
+  for (const [, attributes] of report.matchAll(/<testcase\b([^>]*)>/g)) {
+    const name = /\bname="([^"]*)"/.exec(attributes)?.[1];
+    const file = /\bfile="([^"]*)"/.exec(attributes)?.[1];
+    const status = /\bstatus="([^"]*)"/.exec(attributes)?.[1];
+    if (name == null || status === 'SUCCESS') {
+      continue;
+    }
+    const flow =
+      flows.find(candidate => path.resolve(candidate) === file) ??
+      byName.get(name);
+    if (flow == null) {
+      throw new Error(`The Maestro report has an unknown flow '${name}'`);
+    }
+    failed.push(flow);
+  }
+  return failed;
+}
+
+function maestroArgs({flows, appId, outputDir, reportPath, udid, attempt}) {
+  return [
+    ...(udid != null ? [`--udid=${udid}`] : []),
+    'test',
+    ...flows,
+    '--format=junit',
+    `--output=${reportPath}`,
+    '-e',
+    `APP_ID=${appId}`,
+    '-e',
+    `VISUAL_OUTPUT_DIR=${outputDir}`,
+    // The first attempt installs the driver. Retries reuse it.
+    ...(attempt > 1 ? ['--no-reinstall-driver'] : []),
+  ];
+}
+
+function installApp(platform, appPath, udid) {
+  if (platform === 'android') {
+    childProcess.execFileSync('adb', ['install', '-r', appPath], {
+      stdio: 'inherit',
+    });
+  } else {
+    childProcess.execFileSync('xcrun', ['simctl', 'install', udid, appPath], {
+      stdio: 'inherit',
+    });
+  }
+}
+
+function runAttempt(args) {
+  const result = childProcess.spawnSync(MAESTRO, args, {
+    stdio: 'inherit',
+    timeout: ATTEMPT_TIMEOUT_MS,
+    env: {
+      ...process.env,
+      MAESTRO_CLI_NO_ANALYTICS: '1',
+      MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
+      MAESTRO_DRIVER_STARTUP_TIMEOUT: '180000',
+    },
+  });
+  if (result.error != null) {
+    throw result.error;
+  }
+  return result.status;
+}
+
+function writeSummary(lines) {
+  const text = `${lines.join('\n')}\n`;
+  console.info(text);
+  if (process.env.GITHUB_STEP_SUMMARY) {
+    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
+  }
+}
+
+function main(args = process.argv.slice(2)) {
+  const [platform, appPath, appId, flowsDir, outputDir, udid] = args;
+  if (
+    !['android', 'ios'].includes(platform) ||
+    outputDir == null ||
+    (platform === 'ios' && udid == null)
+  ) {
+    throw new Error(usage);
+  }
+  const attempts = Number(
+    process.env.VISUAL_CAPTURE_ATTEMPTS ?? DEFAULT_ATTEMPTS,
+  );
+  const allFlows = collectFlows(flowsDir);
+  fs.mkdirSync(outputDir, {recursive: true});
+  installApp(platform, appPath, udid);
+
+  const summary = [`### Visual capture (${platform})`, ''];
+  let pending = allFlows;
+  for (let attempt = 1;
```

**File**: `.github/workflow-scripts/visual/compare-run.js` (added, +469/-0)
```diff
@@ -0,0 +1,469 @@
+/**
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ *
+ * @noflow
+ * @format
+ */
+
+/**
+ * Trusted half of the visual regression pipeline. Runs from the default
+ * branch on `workflow_run`, after the untrusted capture workflow finishes.
+ *
+ *   node compare-run.js prepare  Validate captures, compare with baselines,
+ *                                and lay out files to upload under OUT_DIR.
+ *   node compare-run.js report   After the upload, create check runs and
+ *                                evaluate the approval gate.
+ */
+
+const {
+  APPROVAL_LABEL,
+  CHECK_NAME_PREFIX,
+  GATE_CHECK_NAME,
+  differenceFingerprint,
+  gateDecision,
+} = require('./approval');
+const {compareCapture, summarize} = require('./compare');
+const {createGitHubClient} = require('./github');
+const {
+  COMMENT_MARKER,
+  renderCheckOutput,
+  renderPullRequestComment,
+} = require('./report');
+const {
+  approvalKey,
+  baselinePrefix,
+  fetchBuffer,
+  fetchJsonOrNull,
+  findBaseline,
+  publicUrl,
+  reportPrefix,
+} = require('./storage');
+const {validateCapture} = require('./validate');
+const fs = require('node:fs');
+const path = require('node:path');
+
+const BASELINE_SEARCH_DEPTH = 20;
+const PLATFORMS = ['android', 'ios'];
+// The default Actions token posts as this bot. Only its comments are edited.
+const COMMENT_AUTHOR = 'github-actions[bot]';
+
+function requireEnv(name) {
+  const value = process.env[name];
+  if (value == null || value === '') {
+    throw new Error(`${name} is required`);
+  }
+  return value;
+}
+
+function writeFile(filePath, contents) {
+  fs.mkdirSync(path.dirname(filePath), {recursive: true});
+  fs.writeFileSync(filePath, contents);
+}
+
+async function resolveContext(github) {
+  const event = requireEnv('CAPTURE_EVENT');
+  const headSha = requireEnv('CAPTURE_HEAD_SHA');
+  const headBranch = requireEnv('CAPTURE_HEAD_BRANCH');
+  const headRepository = requireEnv('CAPTURE_HEAD_REPOSITORY');
+  const defaultBranch = requireEnv('DEFAULT_BRANCH');
+  const runId = Number(requireEnv('CAPTURE_RUN_ID'));
+  const runAttempt = Number(requireEnv('CAPTURE_RUN_ATTEMPT'));
+
+  if (event === 'pull_request') {
+    const pull = await github.findPullRequest(headSha, headRepository);
+    // Baselines only exist for the default branch, so pull requests into
+    // other branches have nothing to compare with.
+    if (pull == null || pull.base.ref !== defaultBranch) {
+      return null;
+    }
+    return {
+      kind: 'pull',
+      prNumber: pull.number,
+      headSha,
+      runId,
+      runAttempt,
+      defaultBranch,
+    };
+  }
+  if (
+    event === 'push' &&
+    headBranch === defaultBranch &&
+    headRepository === github.repository
+  ) {
+    return {
+      kind: 'main',
+      prNumber: null,
+      headSha,
+      runId,
+      runAttempt,
+      defaultBranch,
+    };
+  }
+  return null;
+}
+
+async function comparePlatform({
+  github,
+  context,
+  captureDir,
+  config,
+  publicBaseUrl,
+  outDir,
+  prefix,
+}) {
+  const manifest = validateCapture(captureDir);
+  const {platform, environmentKey, git} = manifest;
+  if (git.headSha !== context.headSha) {
+    throw new Error(
+      `${platform}: manifest head ${git.headSha} does not match run head ${context.headSha}`,
+    );
+  }
+  if (!(await github.isOnBranch(git.baseSha, context.defaultBranch))) {
+    return {
+      platform,
+      environmentKey,
+      manifest,
+      baseline: null,
+      results: [],
+      error: {
+        title: 'base commit is not on the default branch',
+        summary: `The capture's base commit \`${git.baseSha}\` is not on \`${context.defaultBranch}\`, so there is no baseline to compare with. Rebase or merge \`${context.defaultBranch}\` and push again.`,
+      },
+    };
+  }
+
+  const candidateShas = await github.ancestry(
+    git.baseSha,
+    BASELINE_SEARCH_DEPTH,
+  );
+  const baseline = await findBaseline({
+    publicBaseUrl,
+    environmentKey,
+    candidateShas,
+  });
+  if (baseline == null) {
+    return {
+      platform,
+      environmentKey,
+      manifest,
+      baseline: null,
+      results: [],
+      error: {
+        title: 'no baseline for this environment',
+        summary: `No baseline for environment \`${environmentKey}\` was published for \`${git.baseSha.slice(0, 12)}\` or its ${BASELINE_SEARCH_DEPTH - 1} preceding commits on \`${context.defaultBranch}\`. If the environment key is new, the CI device image changed: the next push to \`${context.defaultBranch}\` publishes a baseline for it. Otherwise check that baseline publication on \`${context.defaultBranch}\` is succeeding.`,
+      },
+    };
+  }
+
+  const expectedUrl = id =>
+    publicUrl(
+      publicBaseUrl,
+      `${baselinePrefix(environmentKey, baseline.sha)}/${id}.png`,
+    );
+  const results = await com
```

---

### Incident Patch 3: `99fca5fc` (2026-10-23)
**Commit Message**: Fix TextInput absorbing scroll gestures on Android (#58678)

Summary:
Pull Request resolved: https://github.com/react/react-native/pull/58678

Fixes the issue described in [#25594](https://github.com/react/react-native/issues/25594) and [#12167](https://github.com/react/react-native/issues/12167), where TextInputs on Android absorb scroll gestures when textAlign is set to "center" or "right". For TextInputs inside a ScrollView, starting a scroll gesture on the TextInput would not scroll the ScrollView.

### Root Cause

The root cause is the `onTouchEvent()` function introduced in [commit 372d001](https://github.com/react/react-native/commit/372d001a5d5e24b68d194e01c356d973642fac86). The smart scroll implementation checks if the TextInput can itself scroll in any direction. If it cannot, then the parent can intercept the gesture to apply normal scroll behavior.

However, when textAlign is set to "center" or "right", `canScrollHorizontally()` returns true, as Android treats the TextInput as capable of scrolling left/right. In these cases, the existing conditional logic blocks all scroll gestures, even if a vertical swipe is applied.

### This PR

Modify `ReactEditText` so that we onl

**File**: `packages/react-native/ReactAndroid/src/main/java/com/facebook/react/views/textinput/ReactEditText.kt` (modified, +28/-9)
```diff
@@ -36,6 +36,7 @@ import android.view.Menu
 import android.view.MenuItem
 import android.view.MotionEvent
 import android.view.View
+import android.view.ViewConfiguration
 import android.view.ViewGroup
 import android.view.accessibility.AccessibilityNodeInfo
 import android.view.inputmethod.EditorInfo
@@ -91,6 +92,7 @@ import com.facebook.react.views.text.internal.span.ReactStrikethroughSpan
 import com.facebook.react.views.text.internal.span.ReactTextPaintHolderSpan
 import com.facebook.react.views.text.internal.span.ReactUnderlineSpan
 import java.util.concurrent.CopyOnWriteArrayList
+import kotlin.math.abs
 import kotlin.math.max
 import kotlin.math.min
 
@@ -132,6 +134,9 @@ public open class ReactEditText public constructor(context: Context) : AppCompat
   private var scrollWatcher: ScrollWatcher?
   private var keyListener: InternalKeyListener? = null
   private var detectScrollMovement = false
+  private var touchDownX = 0f
+  private var touchDownY = 0f
+  private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
   private var onKeyPress = false
   private val textAttributes: TextAttributes
   private var typefaceDirty = false
@@ -316,6 +321,8 @@ public open class ReactEditText public constructor(context: Context) : AppCompat
   override fun onTouchEvent(ev: MotionEvent): Boolean {
     when (ev.action) {
       MotionEvent.ACTION_DOWN -> {
+        touchDownX = ev.x
+        touchDownY = ev.y
         detectScrollMovement = true
         // Disallow parent views to intercept touch events, until we can detect if we should be
         // capturing these touches or not.
@@ -324,21 +331,33 @@ public open class ReactEditText public constructor(context: Context) : AppCompat
 
       MotionEvent.ACTION_MOVE ->
           if (detectScrollMovement) {
-            if (
-                !canScrollVertically(-1) &&
-                    !canScrollVertically(1) &&
-                    !canScrollHorizontally(-1) &&
-                    !canScrollHorizontally(1)
-            ) {
-              // We cannot scroll, let parent views take care of these touches.
-              this.parent.requestDisallowInterceptTouchEvent(false)
+            val deltaX = ev.x - touchDownX
+            val deltaY = ev.y - touchDownY
+            val dominantAxisDistance = max(abs(deltaX), abs(deltaY))
+            if (dominantAxisDistance > touchSlop) {
+              if (!canScrollInGestureDirection(deltaX, deltaY)) {
+                // We cannot scroll, let parent views take care of these touches.
+                this.parent.requestDisallowInterceptTouchEvent(false)
+              }
+              detectScrollMovement = false
             }
-            detectScrollMovement = false
           }
     }
     return super.onTouchEvent(ev)
   }
 
+  private fun canScrollInGestureDirection(deltaX: Float, deltaY: Float): Boolean {
+    if (abs(deltaY) > abs(deltaX)) {
+      val canScrollUp = deltaY > 0 && canScrollVertically(-1)
+      val canScrollDown = deltaY <= 0 && canScrollVertically(1)
+      return canScrollUp || canScrollDown
+    } else {
+      val canScrollLeft = deltaX > 0 && canScrollHorizontally(-1)
+      val canScrollRight = deltaX <= 0 && canScrollHorizontally(1)
+      return canScrollLeft || canScrollRight
+    }
+  }
+
   // Consume 'Enter' key events: TextView tries to give focus to the next TextInput, but it can't
   // since we only allow JS to change focus, which in turn causes TextView to crash.
   override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
```

**File**: `packages/rn-tester/js/examples/ScrollView/ScrollViewExample.js` (modified, +18/-2)
```diff
@@ -471,6 +471,7 @@ const examples: Array<RNTesterModuleExample> = [
     },
   },
   {
+    name: 'scrollTextInputsVertical',
     title: '<ScrollView> TextInputs\n',
     description:
       'Vertical scroll gestures on a TextInput should scroll the ScrollView unless the input can also scroll vertically.',
@@ -479,6 +480,7 @@ const examples: Array<RNTesterModuleExample> = [
     },
   },
   {
+    name: 'scrollTextInputsHorizontal',
     title: '<ScrollView> TextInputs (horizontal = true)\n',
     description:
       'Horizontal scroll gestures on a TextInput should scroll the ScrollView unless the input can also scroll horizontally.',
@@ -634,7 +636,7 @@ const VerticalScrollTextInputs = () => {
 
   return (
     <View>
-      <RNTesterText style={styles.text}>
+      <RNTesterText style={styles.text} testID="vertical_status">
         scrolled = {verticalScrolled ? 'true' : 'false'}
       </RNTesterText>
       <ScrollView
@@ -645,23 +647,30 @@ const VerticalScrollTextInputs = () => {
         onScroll={event => {
           setVerticalScrolled(event.nativeEvent.contentOffset.y > 0);
         }}>
-        <TextInput placeholder="TextInput" style={styles.textInput} />
+        <TextInput
+          placeholder="TextInput"
+          style={styles.textInput}
+          testID="text_input_vertical"
+        />
         <TextInput
           placeholder="TextInput (center)"
           style={styles.textInput}
           textAlign="center"
+          testID="text_input_vertical_center"
         />
         <TextInput
           placeholder="TextInput (right)"
           style={styles.textInput}
           textAlign="right"
+          testID="text_input_vertical_right"
         />
         <TextInput
           defaultValue={
             'A TextInput with a value that overflows the input width so it can be scrolled horizontally.'
           }
           placeholder="TextInput"
           style={styles.textInput}
+          testID="text_input_vertical_overflow_width"
         />
         <TextInput
           defaultValue={
@@ -670,6 +679,7 @@ const VerticalScrollTextInputs = () => {
           placeholder="TextInput"
           style={styles.textInput}
           multiline
+          testID="text_input_vertical_overflow_height"
         />
         <View
           style={[styles.textInput, {backgroundColor: '#cccccc', height: 200}]}
@@ -682,6 +692,7 @@ const VerticalScrollTextInputs = () => {
             y: 0,
           });
         }}
+        testID="scroll_to_top_button"
       />
     </View>
   );
@@ -711,18 +722,21 @@ const HorizontalScrollTextInputs = () => {
             styles.textInput,
             {backgroundColor: '#cccccc', width: 100, height: '100%'},
           ]}
+          testID="left_filler"
         />
         <View style={{gap: 20}}>
           <TextInput
             placeholder="TextInput"
             style={[styles.textInput, {width: 200}]}
+            testID="text_input_horizontal"
           />
           <TextInput
             defaultValue={
               'A TextInput with a value that overflows the input width so it can be scrolled horizontally.'
             }
             placeholder="TextInput"
             style={[styles.textInput, {width: 200}]}
+            testID="text_input_horizontal_overflow_width"
           />
           <TextInput
             defaultValue={
@@ -731,6 +745,7 @@ const HorizontalScrollTextInputs = () => {
             placeholder="TextInput"
             style={[styles.textInput, {width: 200}]}
             multiline
+            testID="text_input_horizontal_overflow_height"
           />
         </View>
         <View
@@ -747,6 +762,7 @@ const HorizontalScrollTextInputs = () => {
             x: 0,
           });
         }}
+        testID="scroll_to_start_button"
       />
     </View>
   );
```

#### Recent Merged Pull Requests:
- **PR #59367** (closed): Register selectable paragraphs in the iOS component factory (@christophpurrer)
- **PR #59363** (closed): Read hover callbacks from the live Pressability config at invocation (#59363) (@rozele)
- **PR #59359** (closed): Upgrade Flow in fbsource (@SamChou19815)
- **PR #59351** (closed): Upgrade Markdown lint dependencies (@cortinico)
- **PR #59349** (closed): Add `--help` to the Fantom CLI (@rubennorte)
- **PR #59347** (closed): Add Transform visual regression tests (#59347) (@cortinico)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
