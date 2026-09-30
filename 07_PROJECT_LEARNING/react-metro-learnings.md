# Forensic Learning Record (Deep Inspection): react/metro

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-metro-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react/metro](https://github.com/react/metro))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:22:40.913Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react/metro`
- **Description**: 🚇 The JavaScript bundler for React Native
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5642 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.eslintrc.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @oncall react_native
 */

'use strict';

module.exports = {
  extends: './scripts/eslint/base',
  overrides: [
    {
      files: ['flow-typed/**/*.js'],
      rules: {
        'babel/quotes': 'off',
        'lint/flow-function-shape': 'off',
        'no-unused-vars': 'off',
      },
    },
    {
      files: ['package.json'],
      parser: 'jsonc-eslint-parser',
    },
    {
      files: ['packages/*/types/**/*.d.ts'],
      extends: './scripts/eslint/typescript',
    },
    {
      files: ['packages/metro-source-map/**/*.js'],
      rules: {
        'operator-assignment': ['error', 'never'],
      },
    },
    {
      files: ['scripts/**/*.js'],
      rules: {
        'babel/func-params-comma-dangle': 'off',
        'import/no-extraneous-dependencies': 'off',
      },
    },
    {
      files: ['packages/**/*.js'],
      rules: {
        'import/no-commonjs': 'error',
      },
    },
    {
      files: [
        'packages/metro/src/integration_tests/**/*.js',
        'packages/metro-runtime/**/*.js',
        '**/__tests__/**/*.js',
        '**/__mocks__/**/*.js',
        '**/__fixtures__/**/*.js',
      ],
      rules: {
        'import/no-commonjs': 'off',
      },
    },
    {
      files: [
        // flow-api-translator doesn't support translating `empty`
        'packages/metro-file-map/types/flow-types.d.ts',
      ],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};

```

### Core Architecture Module: `.prettierrc.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

module.exports = {
  arrowParens: 'avoid',
  bracketSameLine: true,
  bracketSpacing: false,
  requirePragma: true,
  singleQuote: true,
  trailingComma: 'all',
  overrides: [
    {
      files: ['*.js', '*.flow'],
      options: {
        parser: 'flow',
      },
    },
  ],
};

```

### Core Architecture Module: `babel.config.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 * @oncall react_native
 */

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

/*::
import type {BabelCoreOptions} from '@babel/core';
*/
const plugins = [
  'flow-parser/babel-plugin',
  'babel-plugin-transform-flow-enums',
  '@babel/plugin-transform-flow-strip-types',
  '@babel/plugin-transform-modules-commonjs',
  '@babel/plugin-transform-react-jsx',
];

const presets /*: Array<string> */ = [];

function getConfig(api /*: any */) /*: BabelCoreOptions */ {
  api.cache.never();

  return {
    babelrc: false,
    browserslistConfigFile: false,
    presets: presets.map(preset => require.resolve(preset)),
    plugins: plugins.map(plugin => require.resolve(plugin)),
  };
}

getConfig.getCacheKey = () /*: string */ => {
  const dependencies = [...plugins, ...presets].map(dependency =>
    require.resolve(`${dependency}/package.json`),
  );

  const hash = crypto.createHash('md5');
  dependencies.forEach(dependency =>
    hash.update('\0', 'utf8').update(fs.readFileSync(dependency)),
  );
  return hash.digest('hex');
};

module.exports = getConfig;

```

### Core Architecture Module: `flow-typed/accepts.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 * @format
 * @oncall react_native
 */

declare module 'accepts' {
  import type {IncomingMessage} from 'http';
  declare module.exports: (req: IncomingMessage) => {
    types: () => string[],
  };
}

```

### Core Architecture Module: `flow-typed/environment/node.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

// Adapted from https://github.com/flow-typed/flow-typed/blob/main/definitions/environments/node/flow_v0.261.x-/node.js

interface ErrnoError extends Error {
  address?: string;
  code?: string;
  dest?: string;
  errno?: string | number;
  info?: Object;
  path?: string;
  port?: number;
  syscall?: string;
}

type Node$Conditional<T extends boolean, IfTrue, IfFalse> = T extends true
  ? IfTrue
  : T extends false
    ? IfFalse
    : IfTrue | IfFalse;

type buffer$NonBufferEncoding =
  | 'hex'
  | 'HEX'
  | 'utf8'
  | 'UTF8'
  | 'utf-8'
  | 'UTF-8'
  | 'ascii'
  | 'ASCII'
  | 'binary'
  | 'BINARY'
  | 'base64'
  | 'BASE64'
  | 'ucs2'
  | 'UCS2'
  | 'ucs-2'
  | 'UCS-2'
  | 'utf16le'
  | 'UTF16LE'
  | 'utf-16le'
  | 'UTF-16LE'
  | 'latin1';
type buffer$Encoding = buffer$NonBufferEncoding | 'buffer';
type buffer$ToJSONRet = {
  type: string,
  data: Array<number>,
  ...
};

declare class Buffer extends Uint8Array {
  constructor(
    value: Array<number> | number | string | Buffer | ArrayBuffer,
    encoding?: buffer$Encoding,
  ): void;
  [i: number]: number;
  length: number;

  compare(otherBuffer: Buffer): number;
  copy(
    targetBuffer: Buffer,
    targetStart?: number,
    sourceStart?: number,
    sourceEnd?: number,
  ): number;
  entries(): IteratorObject<[number, number]>;
  equals(otherBuffer: Buffer): boolean;
  fill(
    value: string | Buffer | number,
    offset?: number,
    end?: number,
    encoding?: string,
  ): this;
  fill(value: string, encoding?: string): this;
  includes(
    value: string | Buffer | number,
    offsetOrEncoding?: number | buffer$Encoding,
    encoding?: buffer$Encoding,
  ): boolean;
  indexOf(
    value: string | Buffer | number,
    offsetOrEncoding?: number | buffer$Encoding,
    encoding?: buffer$Encoding,
  ): number;
  inspect(): string;
  keys(): IteratorObject<number>;
  lastIndexOf(
    value: string | Buffer | number,
    offsetOrEncoding?: number | buffer$Encoding,
    encoding?: buffer$Encoding,
  ): number;
  readDoubleBE(offset?: number, noAssert?: boolean): number;
  readDoubleLE(offset?: number, noAssert?: boolean): number;
  readFloatBE(offset?: number, noAssert?: boolean): number;
  readFloatLE(offset?: number, noAssert?: boolean): number;
  readInt16BE(offset?: number, noAssert?: boolean): number;
  readInt16LE(offset?: number, noAssert?: boolean): number;
  readInt32BE(offset?: number, noAssert?: boolean): number;
  readInt32LE(offset?: number, noAssert?: boolean): number;
  readInt8(offset?: number, noAssert?: boolean): number;
  readIntBE(offset: number, byteLength: number, noAssert?: boolean): number;
  readIntLE(offset: number, byteLength: number, noAssert?: boolean): number;
  readUInt16BE(offset?: number, noAssert?: boolean): number;
  readUInt16LE(offset?: number, noAssert?: boolean): number;
  readUInt32BE(offset?: number, noAssert?: boolean): number;
  readUInt32LE(offset?: number, noAssert?: boolean): number;
  readUInt8(offset?: number, noAssert?: boolean): number;
  readUIntBE(offset: number, byteLength: number, noAssert?: boolean): number;
  readUIntLE(offset: number, byteLength: number, noAssert?: boolean): number;
  slice(start?: number, end?: number): this;
  swap16(): Buffer;
  swap32(): Buffer;
  swap64(): Buffer;
  toJSON(): buffer$ToJSONRet;
  toString(encoding?: buffer$Encoding, start?: number, end?: number): string;
  values(): IteratorObject<number>;
  write(
    string: string,
    offset?: number,
    length?: number,
    encoding?: buffer$Encoding,
  ): number;
  writeDoubleBE(value: number, offset?: number, noAssert?: boolean): number;
  writeDoubleLE(value: number, offset?: number, noAssert?: boolean): number;
  writeFloatBE(value: number, offset?: number, noAssert?: boolean): number;
  writeFloatLE(value: number, offset?: number, noAssert?: boolean): number;
  writeInt16BE(value: number, offset?: number, noAssert?: boolean): number;
  writeInt16LE(value: number, offset?: number, noAssert?: boolean): number;
  writeInt32BE(value: number, offset?: number, noAssert?: boolean): number;
  writeInt32LE(value: number, offset?: number, noAssert?: boolean): number;
  writeInt8(value: number, offset?: number, noAssert?: boolean): number;
  writeIntBE(
    value: number,
    offset: number,
    byteLength: number,
    noAssert?: boolean,
  ): number;
  writeIntLE(
    value: number,
    offset: number,
    byteLength: number,
    noAssert?: boolean,
  ): number;
  writeUInt16BE(value: number, offset?: number, noAssert?: boolean): number;
  writeUInt16LE(value: number, offset?: number, noAssert?: boolean): number;
  writeUInt32BE(value: number, offset?: number, noAssert?: boolean): number;
  writeUInt32LE(value: number, offset?: number, noAssert?: boolean): number;
  writeUInt8(value: number, offset?: number, noAssert?: boolean): number;
  writeUIntBE(
    value: number,
    offset: number,
    byteLength: number,
    noAssert?: boolean,
  ): number;
  writeUIntLE(
    value: number,
    offset: number,
    byteLength: number,
    noAssert?: boolean,
  ): number;

  static alloc(
    size: number,
    fill?: string | number,
    encoding?: buffer$Encoding,
  ): Buffer;
  static allocUnsafe(size: number): Buffer;
  static allocUnsafeSlow(size: number): Buffer;
  static byteLength(
    string: string | Buffer | $TypedArray | DataView | ArrayBuffer,
    encoding?: buffer$Encoding,
  ): number;
  static compare(buf1: Buffer, buf2: Buffer): number;
  static concat(list: Array<Buffer>, totalLength?: number): Buffer;

  static from(value: ArrayLike<number> | Iterable<number>): Buffer;
  static from(value: string, encoding?: buffer$Encoding): Buffer;
  static from(
    value: ArrayBuffer | SharedArrayBuffer,
    byteOffset?: number,
    length?: number,
  ): Buffer;
  static isBuffer(obj: any): boolean;
  static isEncoding(encoding: string): boolean;
}

declare type Node$Buffer = typeof Buffer;

declare module 'buffer' {
  declare var kMaxLength: number;
  declare var INSPECT_MAX_BYTES: number;

  declare var constants: Readonly<{
    MAX_LENGTH: number,
    MAX_STRING_LENGTH: number,
  }>;

  declare function transcode(
    source: Node$Buffer,
    fromEnc: buffer$Encoding,
    toEnc: buffer$Encoding,
  ): Node$Buffer;

  declare function isUtf8(input: Buffer | ArrayBuffer | $TypedArray): boolean;

  declare function isAscii(input: Buffer | ArrayBuffer | $TypedArray): boolean;

  declare function resolveObjectURL(id: string): globalThis.Blob | void;

  declare var Buffer: Node$Buffer;
  declare var Blob: typeof globalThis.Blob;
  declare var File: typeof globalThis.File;
}

type child_process$execOpts = Readonly<{
  cwd?: string,
  env?: Readonly<{[key: string]: string | number | void}>,
  encoding?: buffer$NonBufferEncoding | 'buffer' | string,
  shell?: string,
  timeout?: number,
  maxBuffer?: number,
  killSignal?: string | number,
  uid?: number,
  gid?: number,
  windowsHide?: boolean,
  signal?: AbortSignal,
}>;

declare class child_process$Error extends Error {
  code: number | string | null;
  errno?: string;
  syscall?: string;
  path?: string;
  spawnargs?: Array<string>;
  killed?: boolean;
  signal?: string | null;
  cmd: string;
}

type child_process$execCallback<T = string | Buffer> = (
  error: ?child_process$Error,
  stdout: T,
  stderr: T,
) => void;

type child_process$execSyncOpts = Readonly<{
  cwd?: string,
  input?: string | Buffer | $TypedArray | DataView,
  stdio?: string | Array<any>,
  env?: Readonly<{[key: string]: string | number | void}>,
  shell?: string,
  uid?: number,
  gid?: number,
  timeout?: number,
  killSignal?: string | number,
  maxBuffer?: number,
  encoding?: buffer$NonBufferEncoding | 'buffer' | string,
  windowsHide?: boolean,
}>;

type child_process$execFileOpts = Readonly<{
  cwd?: string,
  env?: Readonly<{[key: strin
```

### Core Architecture Module: `flow-typed/environment/utility-types.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @oncall react_native
 */

/**
 * Flow allows optional properties ({foo?: number}) to be present and set to
 * undefined, but does not distinguish that case from an omitted prop.
 *
 * In particular, when a var with type {foo?: number} is spread over a
 * {foo: number}, the resulting type is {foo: number}, even though
 * {...{foo: 42}, ...{foo: undefined}} is {foo: undefined} at runtime,
 *
 * This utility turns {foo?: number} into {foo?: void | number}, which
 * can be safely spread, forcing handling of potentially present but undefined
 * props.
 */
declare type SafeOptionalProps<T extends {...}> = {
  [K in keyof T]: T[K] extends void ? void | T[K] : T[K],
};

```

### Core Architecture Module: `flow-typed/fb-watchman.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 * @format
 * @oncall react_native
 */

declare module 'fb-watchman' {
  declare type WatchmanBaseResponse = Readonly<{
    version: string,
    clock: string,
  }>;

  declare type WatchmanClockResponse = Readonly<{
    ...WatchmanBaseResponse,
    warning?: string,
  }>;

  declare type WatchmanSubscribeResponse = Readonly<{
    ...WatchmanBaseResponse,
    subscribe: string,
    warning?: string,
    'asserted-states'?: ReadonlyArray<string>,
  }>;

  declare type WatchmanWatchResponse = Readonly<{
    ...WatchmanBaseResponse,
    watch: string,
    watcher: string,
    relative_path: string,
    warning?: string,
  }>;

  declare type WatchmanWatchListResponse = Readonly<{
    ...WatchmanBaseResponse,
    roots: ReadonlyArray<string>,
  }>;

  declare type WatchmanSubscriptionEvent = {
    subscription: string,
    is_fresh_instance: boolean,
    files: ReadonlyArray<WatchmanFileChange>,
    'state-enter'?: ?string,
    'state-leave'?: ?string,
    clock?: Readonly<{
      scm: {
        'mergebase-with'?: string,
        mergebase?: string,
      },
      clock: string,
    }>,
  };

  declare type WatchmanLogEvent = unknown;

  declare type SavedStateInfo = Readonly<{
    'manifold-path': ?string,
    'manifold-bucket': ?string,
    error: ?string,
  }>;

  declare type WatchmanFileType =
    | 'b' // block special file
    | 'c' // character special file
    | 'd' // directory
    | 'f' // regular file
    | 'l' // symbolic link
    | 'p' // named pipe (fifo)
    | 's' // socket
    | 'D' // Solaris Door
    | '?'; // An unknown file type

  declare type WatchmanFile = Readonly<{
    name: string,
    exists: boolean,
    dev?: number,
    cclock?: string,
    gid?: number,
    ino?: number,
    type?: WatchmanFileType,
    mode?: number,
    mtime_ms?: number | Readonly<{toNumber: () => number}>,
    mtime?: number,
    mtime_us?: number,
    mtime_ns?: number,
    mtime_f?: number,
    new?: boolean,
    nlink?: number,
    size?: number,
    uid?: number,
    'content.sha1hex'?: string,
    symlink_target?: string,
  }>;

  declare type WatchmanFileChange = Readonly<{
    ...WatchmanFile,
    new: boolean,
  }>;

  declare type WatchmanQueryResponse = Readonly<{
    'saved-state-info'?: SavedStateInfo,
    files: ReadonlyArray<WatchmanFile>,
    clock: {
      scm: {'mergebase-with': string, mergebase: string},
      clock: string,
    },
    is_fresh_instance: boolean,
    version: string,
    warning?: string,
  }>;

  declare type WatchmanDirnameExpression = ['dirname' | 'idirname', string];

  declare type WatchmanMatchExpression =
    | ['match' | 'imatch', string]
    | ['match' | 'imatch', string, 'basename' | 'wholename']
    | [
        'match' | 'imatch',
        string,
        'basename' | 'wholename',
        Readonly<{includedotfiles?: boolean, noescape?: boolean}>,
      ];

  declare type WatchmanNotExpression = ['not', WatchmanExpression];

  declare type WatchmanSuffixExpression = [
    'suffix',
    string | ReadonlyArray<string>,
  ];
  declare type WatchmanNameExpression =
    | ['name' | 'iname', string | ReadonlyArray<string>]
    | [
        'name' | 'iname',
        string | ReadonlyArray<string>,
        'basename' | 'wholename',
      ];

  declare type WatchmanTypeExpression = ['type', WatchmanFileType];

  // Would be ['allof' | 'anyof', ...WatchmanExpression] if Flow supported
  // variadic tuples
  declare type WatchmanVariadicExpression = Array<
    'allof' | 'anyof' | WatchmanExpression,
  >;

  declare type WatchmanExpression =
    | WatchmanDirnameExpression
    | WatchmanMatchExpression
    | WatchmanNotExpression
    | WatchmanNameExpression
    | WatchmanSuffixExpression
    | WatchmanTypeExpression
    | WatchmanVariadicExpression;

  declare type WatchmanQuerySince =
    | string
    | Readonly<{
        clock?: string,
        scm: Readonly<{
          'mergebase-with': string,
          'saved-state'?: {
            storage: string,
            config: {project: string, ...},
          },
        }>,
      }>;

  declare type WatchmanQuery = {
    defer?: ReadonlyArray<string>,
    expression?: WatchmanExpression,
    fields: ReadonlyArray<string>,
    glob?: ReadonlyArray<string>,
    glob_includedotfiles?: boolean,
    path?: ReadonlyArray<string>,
    // A repo-root-relative path to a subdirectory within which
    // the query will be constrained.  Returned file names in
    // WatchmanFile will be relative to this location.
    relative_root?: string,
    since?: WatchmanQuerySince,
    suffix?: string | ReadonlyArray<string>,
  };

  declare class Client {
    capabilityCheck(
      config: Readonly<{
        optional?: ReadonlyArray<string>,
        required?: ReadonlyArray<string>,
      }>,
      callback: (
        error: ?Error,
        response: ?{
          version: string,
          capabilities: Readonly<{[string]: boolean}>,
        },
      ) => void,
    ): void;
    command(
      config: ['watch-project', string],
      callback: (
        error: ?Error,
        response: WatchmanWatchResponse,
      ) => void | Promise<void>,
    ): void;
    command(
      config: ['watch-list'],
      callback: (error: ?Error, response: WatchmanWatchListResponse) => void,
    ): void;
    command(
      config: ['query', string, WatchmanQuery],
      callback: (error: ?Error, response: WatchmanQueryResponse) => void,
    ): void;
    command(
      config: ['find', string, string],
      callback: (error: ?Error, response: WatchmanQueryResponse) => void,
    ): void;
    command(
      config: ['clock', string],
      callback: (error: ?Error, response: WatchmanClockResponse) => void,
    ): void;
    command(
      config: ['subscribe', string, string, WatchmanQuery],
      callback: (error: ?Error, response: WatchmanSubscribeResponse) => void,
    ): void;
    command(
      config: ['state-enter', string, string],
      callback: (error: ?Error, response: WatchmanBaseResponse) => void,
    ): void;
    command(
      config: ['state-leave', string, string],
      callback: (error: ?Error, response: WatchmanBaseResponse) => void,
    ): void;
    end(): void;

    on('connect', () => void): void;
    on('end', () => void): void;
    on('error', (error: Error) => void): void;
    on('subscription', (event: WatchmanSubscriptionEvent) => void): void;
    on('log', (event: WatchmanLogEvent) => void): void;
    removeAllListeners: (eventName?: string) => void;
  }

  declare module.exports: {Client: Class<Client>};
}

```

### Core Architecture Module: `flow-typed/graceful-fs.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @oncall react_native
 */

declare module 'graceful-fs' {
  declare module.exports: {
    ...$Exports<'fs'>,
    gracefulify(fs: {...}): void,
  };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1347** (2024-09-07): **[0.80.11] breaks package exports with symlinks**
  *Symptoms*: Hello, having an issue with `0.80.11` and `pnpm` + `expo` + symlinks + package exports  In `0.80.10` package exports are resolved correctly. In `0.80.11` package exports are not resolved.  I have created a reproduction of this issue here: https://github.com/franksmule/expo-repo/tree/main   Symlinks are enabled, although I've enabled `shamefully-hoist=true` - I believe local packages are still symlinked - so it seems to be an issue with the combination of symlinks and package exports?  Metro Config: (https://github.com/franksmule/expo-repo/blob/main/expo-app/metro.config.js) ``` config.resolver.unstable_enablePackageExports = true; config.resolver.unstable_enableSymlinks = true; ```  ``` iOS Bundling failed 756ms index.js (1013 modules) Unable to resolve "@internal/another-dep/hi" from "app/(tabs)/index.tsx" ```  Reproduction: https://github.com/franksmule/expo-repo - change https://github.com/franksmule/expo-repo/blob/main/package.json#L5 - to `0.80.10` and notice bundle will load.
  **Post-Mortem & Fix Analysis**:
  > Huge thanks for the report @franksmule - confirmed this is a bug with the new `TreeFS.hierarchicalLookup` and I can repro in a unit test (f409bde4).  Working on it...
  > Should be fixed in [v0.80.12](https://github.com/facebook/metro/releases/tag/v0.80.12)

- **Issue #1197** (2024-01-23): **[0.80.4] Metro bundle duplicated code when use unstable_enablePackageExports and unstable_enableSymlinks**
  *Symptoms*: <!-- *Before creating an issue please make sure you are using the latest version of Metro, try re-installing your node_modules folder and run Metro once with `--reset-cache` to see if that fixes the problem you are experiencing.* -->  **Do you want to request a *feature* or report a *bug*?**  bug  **What is the current behavior?**  My project uses `pnpm` + `monorepo` + `react-native`, and other self-developed libraries.  In my example project, I have three sub-projects, of which tool-demo is the react-native project, tool-runtime and tool-utils are other function libraries.  In the metro.config.js, unstable_enablePackageExports and unstable_enableSymlinks are true.  The dependencies are like this: 1. tool-demo use tool-utils 2. tool-utils uses tool-runtime/index and tool-runtime/setget. 3. tool-runtime/index also uses  tool-runtime/setget  When I bundle the react-native project，the code of tool-runtime/setget has been bundled twice.  **If the current behavior is a bug, please provide the steps to reproduce and a minimal repository on GitHub that we can `yarn install` and `yarn test`.**  Here is my example project: https://github.com/orochi97/monorepo/tree/main  steps:  1. `pnpm install` 2. `cd packages/tool-demo` and `pnpm run build:ios`, then will output the `index.bundle.ios.js` in the tool-demo dir. 3.  search the keyword `console.log('setRuntimeHelper');` in the `index.bundle.ios.js`, will find that the code is duplicated.  This will cause f
  **Post-Mortem & Fix Analysis**:
  > Huge thanks @orochi97 for the detailed report and repro - confirmed this is a previously-unknown bug due to a non-real absolute path ending up in the dependency graph, which [shouldn't happen](https://github.com/facebook/metro/blob/19f4c65fc56902d44616df488f81b0070f78c646/packages/metro-resolver/src/resolve.js#L491).   I'm looking into this now - in the mean time your commented out `realPathSync` custom resolver looks like a good workaround.
  > This turned out to be an issue with the package exports resolver, and the fix also ended up reducing bundle size by ~5% in the case of your demo. Thanks again for the report.  https://github.com/facebook/metro/pull/1198
  > @robhogan  Thank you for your reply and fix  :)

- **Issue #1015** (2023-09-14): **metro-file-map: Got unexpected null error (in `onTimeout`)**
  *Symptoms*: <!-- *Before creating an issue please make sure you are using the latest version of Metro, try re-installing your node_modules folder and run Metro once with `--reset-cache` to see if that fixes the problem you are experiencing.* -->  **Do you want to request a *feature* or report a *bug*?** Bug report  **What is the current behavior?** This started to happen after updating from RN 0.71 to 0.72.  Metro crashes with the following error: ``` /Users/renchap/dev/notos/node_modules/.pnpm/nullthrows@1.1.1/node_modules/nullthrows/nullthrows.js:9   throw error;   ^  Error: Got unexpected null     at nullthrows (/Users/renchap/dev/notos/node_modules/.pnpm/nullthrows@1.1.1/node_modules/nullthrows/nullthrows.js:7:15)     at Timeout.emitChange [as _onTimeout] (/Users/renchap/dev/notos/node_modules/.pnpm/metro-file-map@0.76.5/node_modules/metro-file-map/src/index.js:823:48)     at listOnTimeout (node:internal/timers:569:17)     at process.processTimers (node:internal/timers:512:7) {   framesToPop: 1 } ```  This seems to be happening what I start a build, or when I run `pnpm`.  This was not happening when running RN 0.71 (Metro 0.73.9).  **If the current behavior is a bug, please provide the steps to reproduce and a minimal repository on GitHub that we can `yarn install` and `yarn test`.** I do not have a repro, this happens randomly  **What is the expected behavior?** Metro does not crash  **Please provide your exact Metro configuration and mention your Me
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. I've seen this a very intermittently as well - just noting for now that the offending assertion is this one https://github.com/facebook/metro/blob/6d46078e74ae9a43aa90bed46dbd6610e2696cd0/packages/metro-file-map/src/index.js#L921  So `eventStartTimestamp` is `null` for some reason, possibly a parallel Fast Refresh race - pretty sure it's unrelated to `unstable_enableSymlinks` or PNPM. We'll backport a fix once we pin this down.
  > I have this issue consistently since upgrading to 0.72.4 from 0.71.6. I also have `unstable_enableSymlinks = true`, and have watchman configured to watch folders outside the yarn workspace my RN project is in.  I use a custom bash script that detects existing instances of metro and launches a new instance if necessary before building and running the Android and iOS emulator/sim (in that order, by chance). This error always occurs while the Android emulator is connected and building on-device.  It doesn't happen if I launch the sims manually.  I'm running metro `v0.76.7`.  Here's the output from `npx react-native info`:  ``` bash System:   OS: macOS 13.5.1   CPU: (8) arm64 Apple M1   Memory: 135.63 MB / 16.00 GB   Shell:     version: "5.9"     path: /bin/zsh Binaries:   Node:     version: 18.16.1     path: ~/.nvm/versions/node/v18.16.1/bin/node   Yarn:     version: 3.2.2     path: ~/.yarn/bin/yarn   npm:     version: 9.5.1     path: ~/.nvm/versions/node/v18.16
  > In my case this bug seems to be triggered by operations in `node_modules` such as when you `yarn add something`.

- **Issue #660** (2026-08-30): **Symbolicate fails when using metro CLI directly**
  *Symptoms*: <!-- *Before creating an issue please make sure you are using the latest version of Metro, try re-installing your node_modules folder and run Metro once with `--reset-cache` to see if that fixes the problem you are experiencing.* -->  **Do you want to request a *feature* or report a *bug*?**  Bug 🐛   **What is the current behavior?**  When running the metro CLI directly there are many errors like:  ``` SyntaxError: Unexpected token u in JSON at position 0     at JSON.parse (<anonymous>)     at node_modules/metro/src/Server.js:1025:28     at Generator.next (<anonymous>)     at asyncGeneratorStep (node_modules/metro/src/Server.js:99:24)     at _next (node_modules/metro/src/Server.js:119:9) ```  Some debugging shows that rawBody is `undefined` and it's trying to be json parsed.  There is a comment in the code about not understanding where `rawBody` comes from:  https://github.com/facebook/metro/blob/af23a1b27bcaaff2e43cb795744b003e145e78dd/packages/metro/src/Server.js#L1028-L1029 I believe this isn't a bigger issue because the react native CLI provides this middleware automatically:  https://github.com/react-native-community/cli/blob/760708fc3216aee565f59877a103a7e35df2d77d/packages/cli-server-api/src/index.ts#L60  Should that middleware be moved down a layer or the code rewritten to not use this field?  <!-- **If the current behavior is a bug, please provide the steps to reproduce and a minimal repository on GitHub that we can `yarn install` and 
  **Post-Mortem & Fix Analysis**:
  > I had a similar issue in my codebase. It is a little bit strange, bc this problem is not reproducible on the fresh react native app.  In my codebase I had a below error:  `Unable to symbolicate stack trace: JSON Parse error: Unexpected EOF`  I was comparing both JSON (from the fresh app and from my app) and they are identical. so I don't know, where the issue can be.  
  > Just bumped into this issue today when trying to run metro manually from JS.  As @rockwotj pointed out, seems that metro assumes that it will always be used with a middleware that's added from the react-native cli which is not always the case.
  > We’re triaging older issues. Metro now parses the `/symbolicate` request body itself rather than depending on middleware from the React Native CLI. This was fixed in #1475 and released in Metro 0.82.2.

- **Issue #625** (2023-05-20): **Filename in babel plugins wrong in metro server**
  *Symptoms*: <!-- *Before creating an issue please make sure you are using the latest version of Metro, try re-installing your node_modules folder and run Metro once with `--reset-cache` to see if that fixes the problem you are experiencing.* -->   **Do you want to request a *feature* or report a *bug*?** bug **What is the current behavior?** When using a custom --projectRoot or --entry-file babel plugins have a different path for `state.file.opts.filename` with the one passed in when running `start` being incorrect, missing the entire path of whatever was passed in with `projectRoot`. I made a simple test repo [here](https://github.com/imownbey/babelwrongpath) and you can see my babel plugin [here](https://github.com/imownbey/babelwrongpath/blob/master/babel.config.js) it just outputs `state.file.opts.filename` to console.  The resulting console log is: `yarn react-native start --projectRoot src/packages/app --reset-cache` results in: ``` transform[stdout]: /Users/ianownbey/src/babelPathWRong/index.js ```  `npx react-native bundle --entry-file src/packages/app/index.js --platform ios --bundle-output foo` results in: ``` transform[stdout]: /Users/ianownbey/src/babelPathWRong/src/packages/app/index.js ```  **If the current behavior is a bug, please provide the steps to reproduce and a minimal repository on GitHub that we can `yarn install` and `yarn test`.** ``` git clone git@github.com:imownbey/babelwrongpath.git cd babelwrongpath npx react-native start --projectRoot
  **Post-Mortem & Fix Analysis**:
  > Applied the following and it seems to resolve our issues. ``` diff --git a/node_modules/metro-react-native-babel-transformer/src/index.js b/node_modules/metro-react-native-babel-transformer/src/index.js index c34c047..9c9348a 100644 --- a/node_modules/metro-react-native-babel-transformer/src/index.js +++ b/node_modules/metro-react-native-babel-transformer/src/index.js @@ -170,8 +170,9 @@ function buildBabelConfig(      ...config,    };  } -function transform({ filename, options, src, plugins }) { +function transform({ filename: relativeFileName, options, src, plugins }) {    const OLD_BABEL_ENV = process.env.BABEL_ENV; +  const filename = path.join(options.projectRoot, relativeFileName)    process.env.BABEL_ENV = options.dev      ? "development"      : process.env.BABEL_ENV || "production"; ```
  > I hadn’t seen this issue but it looks like the one fixed in https://github.com/facebook/metro/commit/de19bbd33f239de1b29aac5db290ffffe26ec468 (Metro 0.76.1 / RN 72). Thanks @asherLZR for the pointer for folks on previous versions.  I’m going to close this as fixed, but please open a new issue if anyone sees this in RN 0.72+

- **Issue #18** (2017-08-17): **NPM modules being preferred over Haste modules**
  *Symptoms*: I've debugged https://github.com/facebook/react-native/issues/13765#issuecomment-312557021 down to an issue where RN's `var merge = require('merge')` will import `node_modules/merge`, instead of the expected `react-native/Libraries/vendor/core/merge.js` (which contains a `@providesModule merge` directive).  According to the dozens of users affected, it seems to be non-deterministic behavior that sometimes resolves itself with reinstallation, different versions of node, or recreation of the directory and node_modules directory. I'm not yet sure if this nondeterminisim is a bug in React-Native library code layout, or a bug in the RN packager (aka metro-bundler?) itself...but I'm leaning towards the latter, since it seems to violate my expectations for Haste module imports.     
  **Post-Mortem & Fix Analysis**:
  > I think Haste modules are always preferred, but it's possible it is a problem in `jest-haste-map` that make it not detect the existence of the `merge` Haste module as expected in particular conditions. The resolution logic wasn't changed so I'm surprised it appears to be a recent regression. We did add some bug fixes to `jest-haste-map`, possibly one could have caused a regression.
  > So another few hours of debugging, and I found that resetting the cache fixes things. Posted a follow-up with my analysis of why various voodoo magic fixes worked: https://github.com/facebook/react-native/issues/13765#issuecomment-312609314  No idea what led to a corrupted cache in the first place. I have my [old "busted" cache](https://gist.github.com/mikelambert/8430f24daec0366ea2997753dbb04478), if you are interested still.  The relevant merge bit, which explains why it was skipping the haste resolution and falling back on node module resolution: ``` "mergeInto":{"g":["/fullpath/mobile/node_modules/react-native/Libraries/vendor/core/mergeInto.js",0]}, "mergeHelpers":{"g":["/fullpath/mobile/node_modules/react-native/Libraries/vendor/core/mergeHelpers.js",0]}, "merge":{} ```  And the `"duplicates"` property, which included: ``` "merge":{"g":{   "/fullpath/mobile/node_modules/react-native/node_modules/merge/package.json":1,   "/fullpath/mobile/node_modules/react-native/L
  > Ohhh! This is very useful, thank you. Unfortunately, I expect thing to get broken again. This is actually a legitimate problem, and it needs to generate an error more proeminently. The duplication of modules stored in the `duplicates` field is real. I think there are 2 action items from there:  1. we need to make the `HasteMap#getModule` function crash immediately if there is module duplication for the requested module name. Right now, it's silent, so callsites believe the module is just not there. This is incorrect. 2. we may want to ignore "haste packages" contained inside `node_modules`, and/or the duplication detection system should keep packages and modules separate, that it doesn't look like to do right now.

- **Issue #2** (2017-08-14): **watchman: support any flavor of slashes on Windows**
  *Symptoms*: **Do you want to request a *feature* or report a *bug*?**  `metro-bundler`, and its dependency `jest-haste-map`, should support any flavor of slashes coming from watchman on Windows. On non-windows OSes we probabyl should still consider `\` as a non-special character.  This would solve https://github.com/facebook/watchman/issues/479  
  **Post-Mortem & Fix Analysis**:
  > Trying to solve this in https://github.com/facebook/jest/pull/3887.
  > https://github.com/facebook/jest/pull/4018 should have been the final fix needed. Please feel free to reopen if the problem is still happening on the latest version of jest/metro.

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

### Incident Patch 1: `c857f0f6` (2026-09-30)
**Commit Message**: Fix symbolication of stack traces with Windows absolute paths (#1939)

Summary:
`metro-symbolicate` parses stack frames with a regex that doesn't allow `:` in file names, so a frame with a Windows absolute path is misparsed at the drive letter:

```
someFunc@D:\app\foo.js:4:0
```

is read as function `D`, file `\app\foo.js`. The match starts at the drive letter, so `someFunc@` is left in the output, and the file name loses its drive - which matters for directory contexts (`symbolicate <dir>`), where the file name is used to find the source map.

This allows an optional `X:\` drive prefix on the function-name-or-file slot and the file slot. Posix paths, module IDs (`123.js`), Android (`bar:4:18063`, `bar:123.js:4:18063`) and `[native code]` frames parse exactly as before - the prefix requires a backslash, so e.g. a single-letter function before a posix path (`a:/js/foo.js:4:1`) is unaffected.

Changelog: [Fix] Fix `metro-symbolicate` stack trace parsing of Windows absolute paths

Test Plan:
Adds a platform-independent test that symbolicates `testfile.stack` with `C:\app\` prefixed file names, and expects the same output as the original. Without this change it fails on all platforms:

**File**: `packages/metro-symbolicate/src/Symbolication.js` (modified, +3/-1)
```diff
@@ -160,11 +160,13 @@ class SymbolicationContext<ModuleIdsT> {
   //  IOS: foo@123.js:4:18131, Android: bar:123.js:4:18063
   // sample stack trace without function name:
   //  123.js:4:18131
+  // sample stack trace with a Windows absolute path:
+  //  foo@C:\app\123.js:4:18131
   // sample result:
   //  IOS: foo.js:57:foo, Android: bar.js:75:bar
   symbolicate(stackTrace: string): string {
     return stackTrace.replace(
-      /(?:([^@: \n(]+)(@|:))?(?:(?:([^@: \n(]+):)?(\d+):(\d+)|\[native code\](?::\d+:\d+)?)/g,
+      /(?:((?:[A-Za-z]:\\)?[^@: \n(]+)(@|:))?(?:(?:((?:[A-Za-z]:\\)?[^@: \n(]+):)?(\d+):(\d+)|\[native code\](?::\d+:\d+)?)/g,
       (match, func, delimiter, fileName, line, column) => {
         if (delimiter === ':' && func && !fileName) {
           fileName = func;
```

**File**: `packages/metro-symbolicate/src/__tests__/symbolicate-test.js` (modified, +12/-0)
```diff
@@ -210,6 +210,18 @@ test('symbolicating a stack trace', async () =>
     execute([TESTFILE_MAP], read('testfile.stack')),
   ).resolves.toMatchSnapshot());
 
+test('symbolicating a stack trace with Windows absolute paths', async () => {
+  const stack = read('testfile.stack');
+  const windowsStack = stack.replaceAll(
+    /(^|@)(thrower\.min\.js)/gm,
+    '$1C:\\app\\$2',
+  );
+  expect(windowsStack).not.toEqual(stack);
+  expect(await execute([TESTFILE_MAP], windowsStack)).toEqual(
+    await execute([TESTFILE_MAP], stack),
+  );
+});
+
 test('symbolicating a stack trace in Node format', async () =>
   await expect(
     execute([TESTFILE_MAP], read('testfile.node.stack')),
```

**File**: `scripts/jestFilter.js` (modified, +0/-4)
```diff
@@ -15,10 +15,6 @@ const SKIPPED_ON_WINDOWS = [
   // flow-api-translator emits os.EOL line endings in generated comments.
   // Snapshots are generated and verified on posix only.
   'scripts/__tests__/api-snapshots-sync-test.js',
-
-  // TODO: Windows product bugs
-  // Stack trace parsing does not support drive letters
-  'packages/metro-symbolicate/src/__tests__/symbolicate-test.js',
 ];
 
 const SKIPPED_PATHS = process.platform === 'win32' ? SKIPPED_ON_WINDOWS : [];
```

---

### Incident Patch 2: `d52ee797` (2026-09-29)
**Commit Message**: Fix backslashes in async bundle paths on Windows (#1938)

Summary:
With `includeAsyncPaths`, Metro writes a server-relative URL for each async dependency into the `paths` argument of `__d(...)`, which the client uses to fetch the split bundle. `getDefaultAsyncDependencyPath` builds that URL with `path.relative` and `path.join`, and never converts separators, so on Windows a dependency at `C:\root\src\bar.js` under server root `C:\root` produces:

```
/src\bar.bundle?modulesOnly=true&runModule=false
```

This is a URL, and Metro's own parsing of bundle URLs treats the pathname as posix (`split('/')` in `parseBundleOptionsFromBundleRequestUrl`), so it should be `/src/bar.bundle?...` on every platform. This passes the joined path through `normalizePathSeparatorsToPosix`, already used in the same file for module debug names. No change on posix.

Changelog: [Fix] Fix backslashes in async bundle paths on Windows (`includeAsyncPaths`)

Test Plan:
Removes `js-test.js` from the Windows skip list. Its three async `paths` tests already assert forward-slash URLs from Windows-style inputs.

Before this change, on Windows CI:

```
  ✕ includes the paths of async dependencies when requested
  - "

**File**: `packages/metro/src/DeltaBundler/Serializers/helpers/js.js` (modified, +7/-5)
```diff
@@ -108,11 +108,13 @@ function getDefaultAsyncDependencyPath(
   const bundlePath = path.relative(options.serverRoot, dependency.absolutePath);
   return (
     '/' +
-    path.join(
-      // TODO: This is not the proper Metro URL encoding of a file path
-      path.dirname(bundlePath),
-      // Strip the file extension
-      path.basename(bundlePath, path.extname(bundlePath)),
+    normalizePathSeparatorsToPosix(
+      path.join(
+        // TODO: This is not the proper Metro URL encoding of a file path
+        path.dirname(bundlePath),
+        // Strip the file extension
+        path.basename(bundlePath, path.extname(bundlePath)),
+      ),
     ) +
     '.bundle?' +
     searchParams.toString()
```

**File**: `scripts/jestFilter.js` (modified, +0/-2)
```diff
@@ -17,8 +17,6 @@ const SKIPPED_ON_WINDOWS = [
   'scripts/__tests__/api-snapshots-sync-test.js',
 
   // TODO: Windows product bugs
-  // Async bundle paths are built with platform path separators
-  'packages/metro/src/DeltaBundler/Serializers/helpers/__tests__/js-test.js',
   // Stack trace parsing does not support drive letters
   'packages/metro-symbolicate/src/__tests__/symbolicate-test.js',
 ];
```

---

### Incident Patch 3: `13604e02` (2026-09-29)
**Commit Message**: Fix Windows-incompatible Jest tests (#1937)

Summary:
`scripts/jestFilter.js` skipped 30 test suites on Windows. Most were failing because of posix assumptions in the tests themselves, not Metro. This fixes those tests and removes them from the skip list, so they run in Windows CI.

The fixes remove posix assumptions without weakening what's asserted:
- Filesystem paths in inputs and expectations are written as posix and made portable with the existing `p()` helpers (`posixToSystemPath`, `createPathNormalizer`), so tests use realistic `C:\...` paths on Windows.
- Client-facing values - URLs, `httpServerLocation`, `sourceURL`s, specifiers, package.json keys - stay asserted with forward slashes on every platform.
- Suites parameterised over `posix`/`win32` now mock `node:path` with `path.posix` for the posix half, rather than the host's `path`, which on Windows is `path.win32`.
- `metro-resolver`'s `getPackageForModule` test helper looped forever on Windows (`path.win32.parse('/root').root` is `/` but `dirname` returns `\`), hanging three suites.
- Some inline and file snapshots embedding absolute paths are replaced by exact assertions built with `p()`.

Still skipped on Windows:
- `

**File**: `packages/buck-worker-tool/src/__tests__/worker-test.js` (modified, +3/-2)
```diff
@@ -111,13 +111,14 @@ describe('Buck worker:', () => {
       writeFiles(files, '/');
     }
 
+    // The mocked fs is a posix memory fs on every platform.
     function writeFiles(files, dirPath) {
       for (const key in files) {
         const entry = files[key];
         if (entry == null || typeof entry === 'string') {
-          fs.writeFileSync(path.join(dirPath, key), entry || '');
+          fs.writeFileSync(path.posix.join(dirPath, key), entry || '');
         } else {
-          const subDirPath = path.join(dirPath, key);
+          const subDirPath = path.posix.join(dirPath, key);
           fs.mkdirSync(subDirPath, {recursive: true});
           writeFiles(entry, subDirPath);
         }
```

**File**: `packages/metro-file-map/src/__tests__/index-test.js` (modified, +176/-294)
```diff
@@ -38,6 +38,20 @@ import {serialize} from 'node:v8';
 
 jest.useRealTimers();
 
+// Convenience function to write paths with posix separators but convert them
+// to system separators
+const p = (filePath: string): string =>
+  process.platform === 'win32'
+    ? filePath.replace(/\//g, '\\').replace(/^\\/, 'C:\\')
+    : filePath;
+
+// The inverse of `p` for messages containing system paths, for portable
+// snapshots
+const toPosixMessage = (message: string): string =>
+  process.platform === 'win32'
+    ? message.replaceAll('C:\\', '/').replaceAll('\\', '/')
+    : message;
+
 function mockHashContents(contents: string | Buffer) {
   return crypto.createHash('sha1').update(contents).digest('hex');
 }
@@ -291,26 +305,26 @@ describe('FileMap', () => {
 
     mockEmitters = Object.create(null);
     mockFs = object({
-      [path.join('/', 'project', 'fruits', 'Banana.js')]: `
+      [p('/project/fruits/Banana.js')]: `
         const Strawberry = require("Strawberry");
       `,
-      [path.join('/', 'project', 'fruits', 'Pear.js')]: `
+      [p('/project/fruits/Pear.js')]: `
         const Banana = require("Banana");
         const Strawberry = require("Strawberry");
       `,
-      [path.join('/', 'project', 'fruits', 'Strawberry.js')]: `
+      [p('/project/fruits/Strawberry.js')]: `
         // Strawberry!
       `,
-      [path.join('/', 'project', 'fruits', '__mocks__', 'Pear.js')]: `
+      [p('/project/fruits/__mocks__/Pear.js')]: `
         const Melon = require("Melon");
       `,
-      [path.join('/', 'project', 'vegetables', 'Melon.js')]: `
+      [p('/project/vegetables/Melon.js')]: `
         // Melon!
       `,
-      [path.join('/', 'project', 'video', 'video.mp4')]: Buffer.from([
+      [p('/project/video/video.mp4')]: Buffer.from([
         0xfa, 0xce, 0xb0, 0x0c,
       ]).toString(),
-      [path.join('/', 'project', 'fruits', 'LinkToStrawberry.js')]: {
+      [p('/project/fruits/LinkToStrawberry.js')]: {
         link: 'Strawberry.js',
       },
     });
@@ -363,11 +377,8 @@ describe('FileMap', () => {
       maxWorkers: 1,
       resetCache: false,
       retainAllFiles: false,
-      rootDir: path.join('/', 'project'),
-      roots: [
-        path.join('/', 'project', 'fruits'),
-        path.join('/', 'project', 'vegetables'),
-      ],
+      rootDir: p('/project'),
+      roots: [p('/project/fruits'), p('/project/vegetables')],
       useWatchman: true,
       cacheManagerFactory: () => mockCacheManager,
     };
@@ -435,26 +446,26 @@ describe('FileMap', () => {
   });
 
   test('ignores files given a pattern', async () => {
-    mockFs[path.join('/', 'project', 'fruits', 'Kiwi.js')] = `
+    mockFs[p('/project/fruits/Kiwi.js')] = `
       // Kiwi!
     `;
     const {fileSystem} = await buildNewFileMap({ignorePattern: /Kiwi/});
     expect([...fileSystem.matchFiles({filter: /Kiwi/})]).toEqual([]);
   });
 
   test('ignores vcs directories without ignore pattern', async () => {
-    mockFs[path.join('/', 'project', 'fruits', '.git', 'fruit-history.js')] = `
+    mockFs[p('/project/fruits/.git/fruit-history.js')] = `
       // test
     `;
     const {fileSystem} = await buildNewFileMap();
     expect([...fileSystem.matchFiles({filter: /\.git/})]).toEqual([]);
   });
 
   test('ignores vcs directories with ignore pattern regex', async () => {
-    mockFs[path.join('/', 'project', 'fruits', 'Kiwi.js')] = `
+    mockFs[p('/project/fruits/Kiwi.js')] = `
       // Kiwi!
     `;
-    mockFs[path.join('/', 'project', 'fruits', '.git', 'fruit-history.js')] = `
+    mockFs[p('/project/fruits/.git/fruit-history.js')] = `
       // test
     `;
     const {fileSystem} = await buildNewFileMap({ignorePattern: /Kiwi/});
@@ -463,7 +474,7 @@ describe('FileMap', () => {
   });
 
   test('throw on ignore pattern except for regex', async () => {
-    mockFs['/project/fruits/Kiwi.js'] = `
+    mockFs[p('/project/fruits/Kiwi.js')] = `
       // Kiwi!
     `;
 
@@ -479,79 +490,35 @@ describe('FileMap', () => {
 
   t
```

**File**: `packages/metro-file-map/src/crawlers/__tests__/node-test.js` (modified, +73/-57)
```diff
@@ -8,7 +8,13 @@
  * @oncall react_native
  */
 
-import TreeFS from '../../lib/TreeFS';
+import type TreeFSType from '../../lib/TreeFS';
+
+let mockPathModule;
+jest.mock('node:path', () => mockPathModule);
+
+// The platform-specific path helper `p` for the graceful-fs mock
+let mockP: string => string;
 
 jest.useRealTimers();
 
@@ -49,7 +55,7 @@ jest.mock('graceful-fs', () => {
         throw new Error('readdir: callback is not a function!');
       }
 
-      if (slash(dir) === '/project/fruits') {
+      if (dir === mockP('/project/fruits')) {
         setTimeout(
           () =>
             callback(null, [
@@ -71,7 +77,7 @@ jest.mock('graceful-fs', () => {
             ]),
           0,
         );
-      } else if (slash(dir) === '/project/fruits/directory') {
+      } else if (dir === mockP('/project/fruits/directory')) {
         setTimeout(
           () =>
             callback(null, [
@@ -83,7 +89,7 @@ jest.mock('graceful-fs', () => {
             ]),
           0,
         );
-      } else if (slash(dir) === '/project/prototype') {
+      } else if (dir === mockP('/project/prototype')) {
         setTimeout(
           () =>
             callback(
@@ -102,7 +108,7 @@ jest.mock('graceful-fs', () => {
             ),
           0,
         );
-      } else if (slash(dir) === '/project') {
+      } else if (dir === mockP('/project')) {
         setTimeout(
           () =>
             callback(null, [
@@ -114,7 +120,7 @@ jest.mock('graceful-fs', () => {
             ]),
           0,
         );
-      } else if (slash(dir) === '/') {
+      } else if (dir === mockP('/')) {
         setTimeout(
           () =>
             callback(null, [
@@ -126,7 +132,7 @@ jest.mock('graceful-fs', () => {
             ]),
           0,
         );
-      } else if (slash(dir) == '/error') {
+      } else if (dir === mockP('/error')) {
         setTimeout(() => callback({code: 'ENOTDIR'}, undefined), 0);
       }
     }),
@@ -135,19 +141,30 @@ jest.mock('graceful-fs', () => {
 });
 
 const pearMatcher = path => /pear/.test(path);
-const normalize = path =>
-  process.platform === 'win32' ? path.replace(/\//g, '\\') : path;
-const createMap = obj =>
-  new Map(Object.keys(obj).map(key => [normalize(key), obj[key]]));
 
-const rootDir = '/project';
-const emptyFS = new TreeFS({rootDir, files: new Map()});
-const getFS = (files: FileData) => new TreeFS({rootDir, files});
-let nodeCrawl;
+describe.each([['win32'], ['posix']])('node crawler on %s', platform => {
+  // Convenience function to write paths with posix separators but convert them
+  // to system separators
+  const p: string => string = filePath =>
+    platform === 'win32'
+      ? filePath.replace(/\//g, '\\').replace(/^\\/, 'C:\\')
+      : filePath;
+  const createMap = obj =>
+    new Map(Object.keys(obj).map(key => [p(key), obj[key]]));
+
+  const rootDir = p('/project');
+  let TreeFS: Class<TreeFSType>;
+  let emptyFS: TreeFSType;
+  let getFS: (files: FileData) => TreeFSType;
+  let nodeCrawl;
 
-describe('node crawler', () => {
   beforeEach(() => {
     jest.resetModules();
+    mockPathModule = jest.requireActual<{}>('path')[platform];
+    mockP = p;
+    TreeFS = require('../../lib/TreeFS').default;
+    emptyFS = new TreeFS({rootDir, files: new Map()});
+    getFS = files => new TreeFS({rootDir, files});
   });
 
   test('updates only changed files', async () => {
@@ -167,7 +184,7 @@ describe('node crawler', () => {
       extensions: ['js'],
       ignore: pearMatcher,
       rootDir,
-      roots: ['/project/fruits'],
+      roots: [p('/project/fruits')],
     });
 
     // Tomato is not included because its mtime is unchanged
@@ -197,11 +214,11 @@ describe('node crawler', () => {
       extensions: ['js'],
       ignore: pearMatcher,
       rootDir,
-      roots: ['/project/fruits'],
+      roots: [p('/project/fruits')],
     });
 
     expect(changedFiles).toEqual(new Map());
-    expect(removedFiles).toEqual(new Set(['fruits/previouslyExisted.js']))
```

**File**: `packages/metro-resolver/src/__tests__/__snapshots__/index-test.js.snap` (removed, +0/-8)
```diff
@@ -1,8 +0,0 @@
-// Jest Snapshot v1, https://goo.gl/fbAQLP
-
-exports[`throws on invalid package name 1`] = `
-"The package \`/root/node_modules/invalid/package.json\` is invalid because it specifies a \`main\` module field that could not be resolved (\`/root/node_modules/invalid/main\`. None of these files exist:
-
-  * /root/node_modules/invalid/main(.js|.jsx|.json|.ts|.tsx)
-  * /root/node_modules/invalid/main/index(.js|.jsx|.json|.ts|.tsx)"
-`;
```

**File**: `packages/metro-resolver/src/__tests__/assets-test.js` (modified, +11/-11)
```diff
@@ -10,19 +10,19 @@
  */
 
 import * as Resolver from '../index';
-import {createResolutionContext} from './utils';
+import {createResolutionContext, posixToSystemPath as p} from './utils';
 import path from 'node:path';
 
 describe('asset resolutions', () => {
   const baseContext = {
     ...createResolutionContext({
-      '/root/project/index.js': '',
-      '/root/project/src/data.json': '',
-      '/root/project/assets/example.asset.json': '',
-      '/root/project/assets/icon.png': '',
-      '/root/project/assets/icon@2x.png': '',
+      [p('/root/project/index.js')]: '',
+      [p('/root/project/src/data.json')]: '',
+      [p('/root/project/assets/example.asset.json')]: '',
+      [p('/root/project/assets/icon.png')]: '',
+      [p('/root/project/assets/icon@2x.png')]: '',
     }),
-    originModulePath: '/root/project/index.js',
+    originModulePath: p('/root/project/index.js'),
   };
   const assetResolutions = ['1', '2'];
   const resolveAsset = (
@@ -53,8 +53,8 @@ describe('asset resolutions', () => {
     expect(Resolver.resolve(context, './assets/icon.png', null)).toEqual({
       type: 'assetFiles',
       filePaths: [
-        '/root/project/assets/icon.png',
-        '/root/project/assets/icon@2x.png',
+        p('/root/project/assets/icon.png'),
+        p('/root/project/assets/icon@2x.png'),
       ],
     });
   });
@@ -70,15 +70,15 @@ describe('asset resolutions', () => {
     // Source file matching `sourceExts`
     expect(Resolver.resolve(context, './src/data.json', null)).toEqual({
       type: 'sourceFile',
-      filePath: '/root/project/src/data.json',
+      filePath: p('/root/project/src/data.json'),
     });
 
     // Asset file matching more specific asset ext
     expect(
       Resolver.resolve(context, './assets/example.asset.json', null),
     ).toEqual({
       type: 'assetFiles',
-      filePaths: ['/root/project/assets/example.asset.json'],
+      filePaths: [p('/root/project/assets/example.asset.json')],
     });
   });
 });
```

---

### Incident Patch 4: `5d6eaeab` (2026-09-29)
**Commit Message**: fix: skip errors that occurred on virtual lines (#1226)

* skip errors that occurred on virtual lines

* Update ModuleResolution.js

* Add regression test for resolution errors past the end of the source

This fix has had no test since the PR was opened, which is what the review asked for in 2024. Adds one at the integration level, in `build-errors-test.js`, so it exercises the real transform and resolution path rather than constructing the error directly.

`injectImportPastEndOfFileTransformer.js` wraps `@react-native/metro-babel-transformer` and, for one fixture, appends `import './does-not-exist';` parsed with `startLine` one line past the end of the source — which is what a plugin that generates and appends code does. The dependency Metro collects then reports a location with no counterpart in the file on disk, so building the code frame for the resolution error walks off the end of `lines`.

Without the guard, the build rejects with `TypeError: Cannot read properties of undefined (reading 'length')` in place of the resolution error. With it, the error survives and the code frame degrades to the lines that do exist.

The assertion is deliberately not a snapshot: the resolver's 

**File**: `packages/metro/src/integration_tests/__tests__/build-errors-test.js` (modified, +33/-0)
```diff
@@ -113,6 +113,39 @@ describe('formatting edge cases', () => {
     await expect(buildPromise).rejects.toMatchSnapshot();
   });
 
+  test('reports resolution errors on locations past the end of the source', async () => {
+    // A Babel plugin appends an unresolvable import whose source location is
+    // past the end of the file on disk. The resolution error must survive:
+    // before, building the code frame threw a TypeError that replaced it.
+    const config = await Metro.loadConfig({
+      config: require.resolve('../metro.config.js'),
+    });
+
+    const buildPromise = Metro.runBuild(
+      {
+        ...config,
+        transformer: {
+          ...config.transformer,
+          babelTransformerPath:
+            require.resolve('../injectImportPastEndOfFileTransformer'),
+        },
+      },
+      {entry: 'build-errors/transform-injected-import.js'},
+    );
+
+    // Deliberately not a snapshot: the resolver's list of candidate paths
+    // varies between versions, and what matters here is only that the
+    // resolution error survives with a code frame of the lines that do exist.
+    const error = await buildPromise.then(
+      () => null,
+      (e: Error) => e,
+    );
+    expect(error?.message).toMatch(
+      /^Unable to resolve module \.\/does-not-exist/,
+    );
+    expect(error?.message).toContain('13 | global.x = 1;');
+  });
+
   test('reports resolution errors with embedded comment after the specifier', async () => {
     const config = await Metro.loadConfig({
       config: require.resolve('../metro.config.js'),
```

**File**: `packages/metro/src/integration_tests/basic_bundle/build-errors/transform-injected-import.js` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
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
+// The unresolvable import in this module is added by a Babel plugin, not
+// written here - see injectImportPastEndOfFileTransformer.js.
+global.x = 1;
```

**File**: `packages/metro/src/integration_tests/injectImportPastEndOfFileTransformer.js` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+/**
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ *
+ * @flow
+ * @format
+ * @oncall react_native
+ */
+
+'use strict';
+
+import type {PluginObj} from '@babel/core';
+import type {
+  BabelTransformer,
+  BabelTransformerArgs,
+} from 'metro-babel-transformer';
+
+const {parse} = require('@babel/parser');
+const baseTransformer = require('@react-native/metro-babel-transformer');
+
+const TARGET_FILE = 'transform-injected-import.js';
+const INJECTED_SPECIFIER = './does-not-exist';
+
+/**
+ * Returns a Babel plugin that appends `import './does-not-exist';` to the
+ * module, parsed at `startLine` - which is what a plugin that generates and
+ * appends code does, so that the generated code's locations do not overlap the
+ * author's.
+ *
+ * Given a `startLine` past the end of the file, the dependency Metro collects
+ * reports a source location that has no counterpart in the file on disk, which
+ * is what the resolution error's code frame has to tolerate.
+ */
+function injectImportAt(startLine: number): () => PluginObj<> {
+  return () => ({
+    name: 'metro-test-inject-import-past-end-of-file',
+    visitor: {
+      Program(path) {
+        const generated = parse(`import '${INJECTED_SPECIFIER}';`, {
+          sourceType: 'module',
+          startLine,
+        });
+        path.node.body.push(...generated.program.body);
+      },
+    },
+  });
+}
+
+function transform(args: BabelTransformerArgs) {
+  if (!args.filename.endsWith(TARGET_FILE)) {
+    return baseTransformer.transform(args);
+  }
+  // One line past the last line of the source, so the injected import's
+  // location does not exist in the file on disk.
+  const startLine = args.src.split('\n').length + 1;
+  return baseTransformer.transform({
+    ...args,
+    plugins: [...(args.plugins ?? []), injectImportAt(startLine)],
+  });
+}
+
+module.exports = {
+  transform,
+  getCacheKey: baseTransformer.getCacheKey,
+} as BabelTransformer;
```

**File**: `packages/metro/src/node-haste/DependencyGraph/ModuleResolution.js` (modified, +5/-0)
```diff
@@ -373,6 +373,11 @@ function refineDependencyLocation(
   // Note that module names may not always be found in the source code verbatim,
   // whether because of escaping or because of exotic dependency APIs.
   for (let line = loc.end.line - 1; line >= loc.start.line - 1; line--) {
+    // The error occurred in code that was added by a transform, then it
+    // won't be present in the original source code.
+    if (lines[line] == null) {
+      continue;
+    }
     const maxColumn =
       line === loc.end.line ? loc.end.column + 2 : lines[line].length;
     const minColumn = line === loc.start.line ? loc.start.column - 1 : 0;
```

---

### Incident Patch 5: `f8269d5f` (2026-09-27)
**Commit Message**: Fix exact "exports" and "imports" keys with no target falling back to a pattern (#1987)

**File**: `packages/metro-resolver/src/__tests__/package-exports-test.js` (modified, +39/-0)
```diff
@@ -655,6 +655,45 @@ describe('with package exports resolution enabled', () => {
       });
     });
 
+    test.each([
+      ['null', 'internal'],
+      ['no matching condition', 'server'],
+    ])(
+      'exact subpath with %s target does not fall back to a pattern',
+      (_, subpath) => {
+        const logWarning = jest.fn();
+        const context = {
+          ...createResolutionContext({
+            '/root/src/main.js': '',
+            '/root/node_modules/test-pkg/package.json': JSON.stringify({
+              name: 'test-pkg',
+              exports: {
+                './*': './lib/*.js',
+                './internal': null,
+                './server': {browser: './server-browser.js'},
+              },
+            }),
+            '/root/node_modules/test-pkg/lib/internal.js': '',
+            '/root/node_modules/test-pkg/lib/server.js': '',
+            '/root/node_modules/test-pkg/internal.js': '',
+            '/root/node_modules/test-pkg/server.js': '',
+          }),
+          originModulePath: '/root/src/main.js',
+          unstable_enablePackageExports: true,
+          unstable_logWarning: logWarning,
+        };
+
+        expect(Resolver.resolve(context, `test-pkg/${subpath}`, null)).toEqual({
+          type: 'sourceFile',
+          filePath: `/root/node_modules/test-pkg/${subpath}.js`,
+        });
+        expect(logWarning).toHaveBeenCalledTimes(1);
+        expect(logWarning.mock.calls[0][0]).toContain(
+          `"/root/node_modules/test-pkg/${subpath}" which is listed in the "exports"`,
+        );
+      },
+    );
+
     describe('package encapsulation', () => {
       test('[nonstrict] should fall back to "browser" spec resolution and log inaccessible import warning', () => {
         const logWarning = jest.fn();
```

**File**: `packages/metro-resolver/src/__tests__/package-imports-test.js` (modified, +25/-0)
```diff
@@ -84,6 +84,31 @@ describe('import subpath patterns resolution support', () => {
       filePath: p('/root/node_modules/test-pkg/src/features/foo.js.js'),
     });
   });
+
+  test('exact subpath with a null or unmatched target does not fall back to a pattern', () => {
+    const logWarning = jest.fn();
+    const context = {
+      ...createResolutionContext({
+        [p('/root/node_modules/test-pkg/package.json')]: JSON.stringify({
+          name: 'test-pkg',
+          imports: {
+            '#features/*': './src/features/*.js',
+            '#features/foo': null,
+            '#features/bar': {browser: './src/features/bar.web.js'},
+          },
+        }),
+        [p('/root/node_modules/test-pkg/src/index.js')]: '',
+        [p('/root/node_modules/test-pkg/src/features/foo.js')]: '',
+        [p('/root/node_modules/test-pkg/src/features/bar.js')]: '',
+      }),
+      originModulePath: p('/root/node_modules/test-pkg/src/index.js'),
+      unstable_logWarning: logWarning,
+    };
+
+    expect(() => Resolver.resolve(context, '#features/foo', null)).toThrow();
+    expect(() => Resolver.resolve(context, '#features/bar', null)).toThrow();
+    expect(logWarning).toHaveBeenCalledTimes(2);
+  });
 });
 
 describe('import subpath conditional imports resolution', () => {
```

**File**: `packages/metro-resolver/src/utils/matchSubpathFromExportsLike.js` (modified, +8/-3)
```diff
@@ -49,11 +49,16 @@ export function matchSubpathFromExportsLike(
     createConfigError,
   );
 
-  let target = exportsLikeMapAfterConditions.get(subpath);
+  let target = null;
   let patternMatch = null;
 
-  // Attempt to match after expanding any subpath pattern keys
-  if (target == null) {
+  // Attempt to match subpath pattern keys only if there is no exact key. An
+  // exact key takes precedence even when its target is null. See step 2 of
+  // `PACKAGE_IMPORTS_EXPORTS_RESOLVE` in:
+  // https://nodejs.org/api/esm.html#resolution-algorithm-specification
+  if (exportsLikeMapAfterConditions.has(subpath)) {
+    target = exportsLikeMapAfterConditions.get(subpath);
+  } else {
     // Gather keys which are subpath patterns in descending order of specificity
     // For ordering, see `PATTERN_KEY_COMPARE` in:
     // https://nodejs.org/api/esm.html#resolution-algorithm-specification
```

---

### Incident Patch 6: `b7c20552` (2026-09-26)
**Commit Message**: Fix typos, grammatical errors, and misspelled identifiers (#1975)

**File**: `docs/API.md` (modified, +1/-1)
```diff
@@ -76,4 +76,4 @@ Starts a full Metro HTTP server. It will listen on the specified `host:port`, an
 
 **Basic options:** `port`, `onBundleBuilt`
 
-Instead of creating the full server, creates a Connect middleware that answers to bundle requests. This middleware can then be plugged into your own servers. The `port` parameter is optional and only used for logging purposes. The `onBundleBuilt` function is optional, is passed the bundle name, and is called when the server has finishing creating the bundle.
+Instead of creating the full server, creates a Connect middleware that answers to bundle requests. This middleware can then be plugged into your own servers. The `port` parameter is optional and only used for logging purposes. The `onBundleBuilt` function is optional, is passed the bundle name, and is called when the server has finished creating the bundle.
```

**File**: `docs/GettingStarted.md` (modified, +2/-2)
```diff
@@ -140,7 +140,7 @@ Given a configuration and a set of options that you would typically pass to a se
 * `platform ('web' | 'android' | 'ios')`: Which platform to bundle for if a list of platforms is provided.
 * `sourceMap (boolean)`: Whether Metro should generate source maps.
 * `sourceMapOut (string)`: Where to save the source map, if `sourceMap == true`. No extension will be added.
-* `sourceMapUrl (string)`: URL where the source map can be found. It defaults to the same same URL as the bundle, but changing the extension from `.bundle` to `.map`. When `inlineSourceMap` is `true`, this property has no effect.
+* `sourceMapUrl (string)`: URL where the source map can be found. It defaults to the same URL as the bundle, but changing the extension from `.bundle` to `.map`. When `inlineSourceMap` is `true`, this property has no effect.
 
 ```js
 const config = await Metro.loadConfig();
@@ -226,7 +226,7 @@ module.exports.transform = (file: {filename: string, src: string}) => {
 };
 ```
 
-If you would like to plug-in Babel, you can simply do that by passing the code to it:
+If you would like to plug in Babel, you can simply do that by passing the code to it:
 
 ```js
 const {transformSync} = require('@babel/core');
```

**File**: `docs/LocalDevelopment.md` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ Our recommended workflow is to use [`yarn link`][1] to register local `metro` pa
     yarn link metro metro-config metro-runtime
     ```
 
-    Note: At mininum, the `metro` and `metro-runtime` packages need to be linked.
+    Note: At minimum, the `metro` and `metro-runtime` packages need to be linked.
 
 3. **Configure Metro `watchFolders` to work with our linked packages**
 
```

**File**: `docs/PackageExports.md` (modified, +2/-2)
```diff
@@ -172,7 +172,7 @@ The Node.js spec gives guidance on migrating to `"exports"` in a non-breaking ma
 
 Each subpath is an exact specifier ([see section in RFC](https://github.com/react-native-community/discussions-and-proposals/blob/main/proposals/0534-metro-package-exports-support.md#exact-path-specifiers)).
 
-We recommend continuing to use **extensionless specifiers** for subpaths in packages targeting React Native — or **defining both extensioned and extensionless specifiers**. This will match matching existing user expectations.
+We recommend continuing to use **extensionless specifiers** for subpaths in packages targeting React Native — or **defining both extensioned and extensionless specifiers**. This will match existing user expectations.
 
 ```json
   "exports": {
@@ -262,7 +262,7 @@ Using subpath patterns can be a convenient method to export many assets. We reco
 
 ## Troubleshooting
 
-### Package/ESM incompatibilites
+### Package/ESM incompatibilities
 Some issues that can come from Metro resolving to a file not designed for React Native include:
  - *"`import.meta` can not be used outside a module"*. `import.meta` support is coming.
  - Errors relating to `document` or other web globals in your mobile app.
```

**File**: `docs/Resolution.md` (modified, +2/-2)
```diff
@@ -64,7 +64,7 @@ Parameters: (*context*, *moduleName*, *platform*)
 1. If a [custom resolver](#resolverequest-customresolver) is defined, then
     1. Return the result of the custom resolver.
 2. If *moduleName* is an absolute path, or equal to `'.'` or `'..'`, or begins `'./'` or `'../'`
-    1. Let *absoluteModuleName* be *moduleName* if it is absolute path, otherwise the result of prepending the current directory (i.e. parent of [`context.originModulePath`](#originmodulepath-string)) with *moduleName*.
+    1. Let *absoluteModuleName* be *moduleName* if it is an absolute path, otherwise the result of prepending the current directory (i.e. parent of [`context.originModulePath`](#originmodulepath-string)) with *moduleName*.
     2. Return the result of [**RESOLVE_MODULE**](#resolve_module)(*context*, *absoluteModuleName*, *platform*), or continue.
 3. If *moduleName* begins `'#'`
     1. Throw an error. This will be replaced with subpath imports support in a non-breaking future release.
@@ -301,7 +301,7 @@ Any custom options passed to the resolver. By default, Metro populates this base
 
 #### `resolveRequest: CustomResolver`
 
-A alternative resolver function to which the current request may be delegated. Defaults to [`resolver.resolveRequest`](./Configuration.md#resolverequest).
+An alternative resolver function to which the current request may be delegated. Defaults to [`resolver.resolveRequest`](./Configuration.md#resolverequest).
 
 Metro expects `resolveRequest` to have the following signature:
 
```

---

### Incident Patch 7: `ab82c6a2` (2026-09-26)
**Commit Message**: Fix section offsets in generatedMappings() for indexed source maps (#1976)

**File**: `packages/metro-source-map/src/Consumer/SectionsConsumer.js` (modified, +6/-6)
```diff
@@ -69,8 +69,8 @@ export default class SectionsConsumer
           (get1(mapping.generatedLine) > 1 || get0(mapping.generatedColumn) > 0)
         ) {
           yield {
-            generatedLine: FIRST_LINE,
-            generatedColumn: FIRST_COLUMN,
+            generatedLine: add(FIRST_LINE, generatedOffset.lines),
+            generatedColumn: add(FIRST_COLUMN, generatedOffset.columns),
             source: null,
             name: null,
             originalLine: null,
@@ -81,10 +81,10 @@ export default class SectionsConsumer
         yield {
           ...mapping,
           generatedLine: add(mapping.generatedLine, generatedOffset.lines),
-          generatedColumn: add(
-            mapping.generatedColumn,
-            generatedOffset.columns,
-          ),
+          generatedColumn:
+            mapping.generatedLine === FIRST_LINE
+              ? add(mapping.generatedColumn, generatedOffset.columns)
+              : mapping.generatedColumn,
         };
       }
     }
```

**File**: `packages/metro-source-map/src/__tests__/Consumer-test.js` (modified, +42/-0)
```diff
@@ -527,6 +527,48 @@ describe('indexed (sectioned) maps', () => {
     });
   });
 
+  describe('generatedMappings()', () => {
+    test('applies the section offset to generated positions', () => {
+      const consumer = new Consumer({
+        version: 3,
+        sections: [
+          {
+            offset: {line: 0, column: 0},
+            map: {
+              version: 3,
+              names: [],
+              sources: ['section0_source0'],
+              mappings: 'AAAA',
+            },
+          },
+          {
+            offset: {line: 0, column: 4},
+            map: {
+              version: 3,
+              names: [],
+              sources: ['section1_source0'],
+              mappings: 'CAAA;AACA',
+            },
+          },
+        ],
+      });
+      expect(
+        [...consumer.generatedMappings()].map(mapping => [
+          mapping.generatedLine,
+          mapping.generatedColumn,
+          mapping.source,
+        ]),
+      ).toEqual([
+        [1, 0, 'section0_source0'],
+        // Unmapped from the start of section 1 until its first mapping
+        [1, 4, null],
+        [1, 5, 'section1_source0'],
+        // The column offset only applies to the first line of a section
+        [2, 0, 'section1_source0'],
+      ]);
+    });
+  });
+
   describe('sourceContentFor', () => {
     test('empty map', () => {
       const consumer = new Consumer({
```

**File**: `packages/metro-source-map/src/__tests__/composeSourceMaps-test.js` (modified, +34/-0)
```diff
@@ -329,6 +329,40 @@ describe('composeSourceMaps', () => {
     `);
   });
 
+  test('composes a last map with multi-line sections at a column offset', () => {
+    const indexedMap: IndexMap = {
+      version: 3,
+      sections: [
+        {
+          offset: {line: 0, column: 0},
+          map: {version: 3, names: [], sources: ['a.js'], mappings: 'AAAA'},
+        },
+        {
+          offset: {line: 0, column: 4},
+          map: {
+            version: 3,
+            names: [],
+            sources: ['b.js'],
+            mappings: 'CAAA;AACA',
+          },
+        },
+      ],
+    };
+    const composed = new Consumer(composeSourceMaps([indexedMap]));
+    const indexed = new Consumer(indexedMap);
+    for (const [line, column] of [
+      [1, 0],
+      [1, 4],
+      [1, 5],
+      [2, 0],
+    ]) {
+      const position = {line: add1(line - 1), column: add0(column)};
+      expect(composed.originalPositionFor(position)).toEqual(
+        indexed.originalPositionFor(position),
+      );
+    }
+  });
+
   test('Propagate x_hermes_function_offsets', () => {
     const map1 = {
       version: 3,
```

---

### Incident Patch 8: `88f95b09` (2026-09-25)
**Commit Message**: NativeWatcher: Emit events in the order fs.watch reported them - fix flaky integration tests (#1974)

**File**: `packages/metro-file-map/src/watchers/NativeWatcher.js` (modified, +44/-14)
```diff
@@ -8,6 +8,7 @@
  * @format
  */
 
+import type {WatcherBackendChangeEvent} from '../flow-types';
 import type {FSWatcher} from 'node:fs';
 
 import {AbstractWatcher} from './AbstractWatcher';
@@ -46,6 +47,11 @@ const RECRAWL_EVENT = 'recrawl';
 export default class NativeWatcher extends AbstractWatcher {
   #fsWatcher: ?FSWatcher;
 
+  /**
+   * Promise chain to emit events in the order they were received.
+   */
+  #emitQueue: Promise<void> = Promise.resolve();
+
   static isSupported(): boolean {
     return platform() === 'darwin';
   }
@@ -59,7 +65,7 @@ export default class NativeWatcher extends AbstractWatcher {
       ...
     }>,
   ) {
-    if (!NativeWatcher.isSupported) {
+    if (!NativeWatcher.isSupported()) {
       throw new Error('This watcher can only be used on macOS');
     }
     super(dir, opts);
@@ -76,7 +82,26 @@ export default class NativeWatcher extends AbstractWatcher {
         recursive: true,
       },
       (event, relativePath) => {
-        this._handleEvent(event, relativePath).catch(error => {
+        // Start handling immediately so that stats are gathered concurrently
+        // and as close as possible to the event, but emit in arrival order.
+        const settled = this.#handleEvent(event, relativePath).then(
+          change => ({change, error: null}),
+          (error: Error) => ({change: null, error}),
+        );
+        const emitted = this.#emitQueue.then(() =>
+          settled.then(({change, error}) => {
+            if (error != null) {
+              throw error;
+            }
+            if (change != null) {
+              this.emitFileEvent(change);
+            }
+          }),
+        );
+        // Report failures outside the queue, so that a throwing emitError
+        // (e.g. with no error listener) can't suppress later events.
+        this.#emitQueue = emitted.catch(() => {});
+        emitted.catch(error => {
           this.emitError(error);
         });
       },
@@ -95,7 +120,14 @@ export default class NativeWatcher extends AbstractWatcher {
     }
   }
 
-  async _handleEvent(event: string, relativePath: string) {
+  /**
+   * Resolve a raw `fs.watch` event into the event to emit for it, or `null` if
+   * it should be dropped.
+   */
+  async #handleEvent(
+    event: string,
+    relativePath: string,
+  ): Promise<?Omit<WatcherBackendChangeEvent, 'root'>> {
     const absolutePath = path.resolve(this.root, relativePath);
     if (this.doIgnore(relativePath)) {
       debug(
@@ -104,7 +136,7 @@ export default class NativeWatcher extends AbstractWatcher {
         relativePath,
         this.root,
       );
-      return;
+      return null;
     }
     debug(
       'Handling event "%s" on %s (root: %s)',
@@ -119,11 +151,11 @@ export default class NativeWatcher extends AbstractWatcher {
 
       // Ignore files of an unrecognized type
       if (!type) {
-        return;
+        return null;
       }
 
       if (!includedByGlob(type, this.globs, this.dot, relativePath)) {
-        return;
+        return null;
       }
 
       // For directory "rename" events, notify that we need a recrawl since we
@@ -136,29 +168,27 @@ export default class NativeWatcher extends AbstractWatcher {
           'Directory rename detected on %s, requesting recrawl',
           relativePath,
         );
-        this.emitFileEvent({
+        return {
           event: RECRAWL_EVENT,
           relativePath,
-        });
-        return;
+        };
       }
 
-      this.emitFileEvent({
+      return {
         event: TOUCH_EVENT,
         relativePath,
         metadata: {
           type,
           modifiedTime: stat.mtime.getTime(),
           size: stat.size,
         },
-      });
+      };
     } catch (error) {
       if (error?.code !== 'ENOENT') {
-        this.emitError(error);
-        return;
+        throw error;
       }
 
-      this.emitFileEvent({event: DELETE_EVENT, relativePath});
+      return {event: DELETE_EVENT, relativePath};
     }
   }
 }
```

**File**: `packages/metro-file-map/src/watchers/__tests__/NativeWatcher-test.js` (added, +164/-0)
```diff
@@ -0,0 +1,164 @@
+/**
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ *
+ * @flow strict-local
+ * @format
+ * @oncall react_native
+ */
+
+import type {WatcherBackendChangeEvent} from '../../flow-types';
+
+import NativeWatcher from '../NativeWatcher';
+import fs from 'node:fs';
+import os from 'node:os';
+import {join, resolve} from 'node:path';
+
+jest.useRealTimers();
+
+// Absolute on every platform, with a drive letter on Windows, as the watcher
+// resolves its root.
+const ROOT = resolve('/', 'project');
+
+type Deferred<T> = {
+  promise: Promise<T>,
+  resolve: T => void,
+  reject: Error => void,
+};
+
+function deferred<T>(): Deferred<T> {
+  let resolve: T => void = () => {};
+  let reject: Error => void = () => {};
+  const promise = new Promise<T>((res, rej) => {
+    resolve = res;
+    reject = rej;
+  });
+  return {promise, resolve, reject};
+}
+
+function fileStat(mtimeMs: number): fs.Stats {
+  // $FlowFixMe[incompatible-type] - only the fields NativeWatcher reads
+  return {
+    isSymbolicLink: () => false,
+    isDirectory: () => false,
+    isFile: () => true,
+    mtime: new Date(mtimeMs),
+    size: 42,
+  };
+}
+
+function enoent(): Error {
+  const error = new Error('ENOENT: no such file or directory');
+  // $FlowFixMe[prop-missing] - Node system errors carry a code
+  error.code = 'ENOENT';
+  return error;
+}
+
+// Run every pending promise continuation, including those queued by others.
+const flush = () => new Promise(resolve => setImmediate(resolve));
+
+describe('NativeWatcher', () => {
+  let watcher: NativeWatcher;
+  let emitFsEvent: (event: string, relativePath: string) => void;
+  let pendingStats: Map<string, Deferred<fs.Stats>>;
+  let events: Array<WatcherBackendChangeEvent>;
+
+  beforeEach(async () => {
+    jest.spyOn(os, 'platform').mockReturnValue('darwin');
+    jest.spyOn(fs, 'watch').mockImplementation((_root, _opts, listener) => {
+      emitFsEvent = listener;
+      return {close: () => {}};
+    });
+    pendingStats = new Map();
+    jest.spyOn(fs.promises, 'lstat').mockImplementation(absolutePath => {
+      const stat = deferred<fs.Stats>();
+      pendingStats.set(String(absolutePath), stat);
+      return stat.promise;
+    });
+
+    watcher = new NativeWatcher(ROOT, {dot: true, globs: [], ignored: null});
+    events = [];
+    watcher.onFileEvent(event => {
+      events.push(event);
+    });
+    await watcher.startWatching();
+  });
+
+  afterEach(async () => {
+    await watcher.stopWatching();
+    jest.restoreAllMocks();
+  });
+
+  function settleStat(relativePath: string, result: fs.Stats | Error): void {
+    const stat = pendingStats.get(join(ROOT, relativePath));
+    if (stat == null) {
+      throw new Error(`No lstat pending for ${relativePath}`);
+    }
+    if (result instanceof Error) {
+      stat.reject(result);
+    } else {
+      stat.resolve(result);
+    }
+  }
+
+  test('emits events in the order fs.watch reported them, however their stats settle', async () => {
+    emitFsEvent('rename', join('app', 'moved-in', 'file.js'));
+    emitFsEvent('rename', join('app', 'moved-in'));
+    emitFsEvent('change', join('app', 'other.js'));
+
+    // All stats start immediately, before any has settled.
+    expect([...pendingStats.keys()]).toEqual([
+      join(ROOT, 'app', 'moved-in', 'file.js'),
+      join(ROOT, 'app', 'moved-in'),
+      join(ROOT, 'app', 'other.js'),
+    ]);
+
+    // Settle in reverse order. Nothing can be emitted until the first settles.
+    settleStat(join('app', 'other.js'), fileStat(1000));
+    settleStat(join('app', 'moved-in'), enoent());
+    await flush();
+    expect(events).toEqual([]);
+
+    settleStat(join('app', 'moved-in', 'file.js'), enoent());
+    await flush();
+    expect(events).toEqual([
+      {
+        event: 'delete',
+        relativePath: join('app', 'moved-in
```

---

### Incident Patch 9: `a95869a0` (2026-09-25)
**Commit Message**: Fix SVG dimension parsing treating stroke-width as width (#1972)

**File**: `packages/metro/src/lib/__tests__/imageSize-test.js` (modified, +26/-0)
```diff
@@ -53,6 +53,32 @@ describe('getImageDimensions', () => {
     ).toEqual({width: WIDTH, height: HEIGHT});
   });
 
+  test.each([
+    [
+      'stroke-width after width and height',
+      `<svg width="${WIDTH}" height="${HEIGHT}" stroke-width="2"/>`,
+    ],
+    [
+      'stroke-width with only a viewBox',
+      `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" stroke-width="1.5"/>`,
+    ],
+    [
+      'other hyphenated attributes',
+      `<svg width="${WIDTH}" height="${HEIGHT}" data-width="7" border-height="9"/>`,
+    ],
+    [
+      'a namespaced attribute after width and height',
+      `<svg width="${WIDTH}" height="${HEIGHT}" xlink:width="5"/>`,
+    ],
+  ])(
+    'ignores SVG attributes that only end in a dimension name: %s',
+    (_, svg) => {
+      expect(
+        getImageDimensions('svg', Buffer.from(svg), '/root/icon.svg'),
+      ).toEqual({width: WIDTH, height: HEIGHT});
+    },
+  );
+
   test('rejects unsupported SVG units', () => {
     expect(() =>
       getImageDimensions(
```

**File**: `packages/metro/src/lib/imageSize.js` (modified, +1/-1)
```diff
@@ -312,7 +312,7 @@ function parseSvg(content: Buffer): ?Dimensions {
   const root = header.slice(rootStart, rootEnd + 1);
   const attributes: {[string]: string} = {};
   const attributePattern =
-    /\b(width|height|viewBox)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
+    /(?<![\w:-])(width|height|viewBox)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
   let match = attributePattern.exec(root);
   while (match != null) {
     const name = match[1];
```

---

### Incident Patch 10: `5e87b2ca` (2026-09-25)
**Commit Message**: metro-file-map: Fix missed changes and a stop hang in FallbackWatcher (#1967)

**File**: `packages/metro-file-map/src/watchers/FallbackWatcher.js` (modified, +46/-50)
```diff
@@ -31,6 +31,7 @@ const fsPromises = fs.promises;
 
 const TOUCH_EVENT = common.TOUCH_EVENT;
 const DELETE_EVENT = common.DELETE_EVENT;
+const RECRAWL_EVENT = common.RECRAWL_EVENT;
 
 /**
  * This setting delays all events. It suppresses 'change' events that
@@ -196,7 +197,15 @@ export default class FallbackWatcher extends AbstractWatcher {
     }
     this.#watched[dir] = watcher;
 
-    watcher.on('error', this.#checkedEmitError);
+    watcher.on('error', error => {
+      // Node has already closed the watcher, and will not emit 'close'. Forget
+      // it, so that stopping doesn't wait on it and the path can be watched
+      // again.
+      if (this.#watched[dir] === watcher) {
+        delete this.#watched[dir];
+      }
+      this.#checkedEmitError(error);
+    });
 
     if (this.root !== dir) {
       this.#register(dir, 'd');
@@ -228,67 +237,48 @@ export default class FallbackWatcher extends AbstractWatcher {
     await Promise.all(promises);
   }
 
-  /**
-   * On some platforms, as pointed out on the fs docs (most likely just win32)
-   * the file argument might be missing from the fs event. Try to detect what
-   * change by detecting if something was deleted or the most recent file change.
-   */
-  #detectChangedFile(
-    dir: string,
-    event: string,
-    callback: (file: string) => void,
-  ) {
-    if (!this.#dirRegistry[dir]) {
-      return;
-    }
-
-    let found = false;
-    let closest: ?Readonly<{file: string, mtime: Stats['mtime']}> = null;
-    let c = 0;
-    Object.keys(this.#dirRegistry[dir]).forEach((file, i, arr) => {
-      fs.lstat(path.join(dir, file), (error, stat) => {
-        if (found) {
-          return;
-        }
-
-        if (error) {
-          if (isIgnorableFileError(error)) {
-            found = true;
-            callback(file);
-          } else {
-            this.emitError(error);
-          }
-        } else {
-          if (closest == null || stat.mtime > closest.mtime) {
-            closest = {file, mtime: stat.mtime};
-          }
-          if (arr.length === ++c) {
-            callback(closest.file);
-          }
-        }
-      });
-    });
-  }
-
   /**
    * Normalize fs events and pass it on to be processed.
    */
   #normalizeChange(dir: string, event: string, file: string) {
     if (!file) {
-      this.#detectChangedFile(dir, event, actualFile => {
-        if (actualFile) {
-          this.#processChange(dir, event, actualFile).catch(error =>
-            this.emitError(error),
-          );
-        }
-      });
+      this.#processUnnamedChange(dir).catch(error => this.emitError(error));
     } else {
       this.#processChange(dir, event, path.normalize(file)).catch(error =>
         this.emitError(error),
       );
     }
   }
 
+  /**
+   * Process an event that doesn't name the changed entry. Windows sends these
+   * when changes to a directory overflow the buffer they're reported through,
+   * so any number of entries under `dir` may have been added, changed or
+   * removed.
+   */
+  async #processUnnamedChange(dir: string) {
+    // Watch and register anything new, so that later changes are reported.
+    await recReaddir(
+      dir,
+      subdir => {
+        this.#watchdir(subdir);
+      },
+      filename => {
+        this.#register(filename, 'f');
+      },
+      symlink => {
+        this.#register(symlink, 'l');
+      },
+      this.#checkedEmitError,
+      this.ignored,
+    );
+    // Then have the file map reconcile everything under `dir`.
+    this.#emitEvent({
+      event: RECRAWL_EVENT,
+      relativePath: path.relative(this.root, dir),
+    });
+  }
+
   /**
    * Process changes.
    */
@@ -356,6 +346,12 @@ export default class FallbackWatcher extends AbstractWatcher {
           this.#checkedEmitError,
           this.ignored,
         );
+        // A directory we already knew about has been replaced, so entries we
+        // registered under it may since have changed or been removed. Have the
+        // fi
```

**File**: `packages/metro-file-map/src/watchers/__tests__/FallbackWatcher-test.js` (modified, +137/-2)
```diff
@@ -9,8 +9,11 @@
  * @oncall react_native
  */
 
+import type {WatcherBackendChangeEvent} from '../../flow-types';
+
 import FallbackWatcher from '../FallbackWatcher';
 import {createTempWatchRoot} from './helpers';
+import EventEmitter from 'node:events';
 import fs from 'node:fs';
 import {join} from 'node:path';
 
@@ -19,11 +22,22 @@ jest.setTimeout(10 * 1000);
 
 const {mkdir, rm, writeFile} = fs.promises;
 
+// An `FSWatcher` after it has reported an error: Node closes the handle before
+// emitting 'error', so a subsequent `close()` returns early and emits nothing.
+class ErroredFSWatcher extends EventEmitter {
+  close() {}
+}
+
 describe('FallbackWatcher', () => {
   let watchRoot: string;
   let watcher: ?FallbackWatcher;
   let calls: Array<string>;
   let watchFailure: ?{code: string, path: string};
+  let watchOverride: ?{path: string, watcher: ErroredFSWatcher};
+  // The listener passed to `fs.watch` for each directory, and the directories
+  // whose events are withheld from it.
+  let listeners: Map<string, (event: string, filename: ?string) => void>;
+  let mutedDirs: Set<string>;
 
   const indexOfCall = (op: 'watch' | 'readdir', dir: string) =>
     calls.indexOf(`${op}:${dir}`);
@@ -37,18 +51,32 @@ describe('FallbackWatcher', () => {
     watchRoot = await createTempWatchRoot('Fallback', false);
     calls = [];
     watchFailure = null;
+    watchOverride = null;
+    listeners = new Map();
+    mutedDirs = new Set();
 
     const {watch} = fs;
-    jest.spyOn(fs, 'watch').mockImplementation((dir, ...args) => {
+    jest.spyOn(fs, 'watch').mockImplementation((dir, options, listener) => {
       calls.push(`watch:${String(dir)}`);
+      const override = watchOverride;
+      if (override != null && dir === override.path) {
+        watchOverride = null;
+        // $FlowFixMe[incompatible-type] - models an errored FSWatcher
+        return override.watcher;
+      }
       const failure = watchFailure;
       if (failure != null && dir === failure.path) {
         const error = new Error(`Cannot watch path '${String(dir)}'.`);
         // $FlowFixMe[prop-missing] code
         error.code = failure.code;
         throw error;
       }
-      return watch(dir, ...args);
+      listeners.set(String(dir), listener);
+      return watch(dir, options, (event, filename) => {
+        if (!mutedDirs.has(String(dir))) {
+          listener(event, filename);
+        }
+      });
     });
     const {readdir} = fs.promises;
     jest.spyOn(fs.promises, 'readdir').mockImplementation((dir, ...args) => {
@@ -126,8 +154,115 @@ describe('FallbackWatcher', () => {
       }
     },
   );
+
+  describe('after a directory watcher errors', () => {
+    let erroredWatcher: ErroredFSWatcher;
+
+    beforeEach(async () => {
+      await mkdir(join(watchRoot, 'a'));
+      erroredWatcher = new ErroredFSWatcher();
+      watchOverride = {path: join(watchRoot, 'a'), watcher: erroredWatcher};
+      await watcher?.startWatching();
+      erroredWatcher.emit('error', fsError('ENOENT', join(watchRoot, 'a')));
+    });
+
+    test('stopWatching resolves', async () => {
+      await expect(
+        Promise.race([
+          watcher?.stopWatching().then(() => 'stopped'),
+          new Promise(resolve => setTimeout(resolve, 1000, 'timed out')),
+        ]),
+      ).resolves.toBe('stopped');
+    });
+
+    // The directory is replaced before we process the change, so we never see
+    // it missing and there is no deletion to clear the old watch.
+    test('watches a directory replaced at the same path', async () => {
+      calls = [];
+      fs.rmSync(join(watchRoot, 'a'), {recursive: true});
+      fs.mkdirSync(join(watchRoot, 'a'));
+      fs.writeFileSync(join(watchRoot, 'a', 'file.js'), '');
+
+      await waitFor(() => indexOfCall('readdir', join(watchRoot, 'a')) >= 0);
+      expectWatchedBeforeListed(join(watchRoot, 'a'));
+    });
+
+    // Entries registered under the old directory may be gone or changed.
+    test('requests
```

#### Recent Merged Pull Requests:
- **PR #2001** (2026-09-30): Label PRs touching package.json, yarn.lock or Flow config as needs-meta-import (@vzaidman)
- **PR #1994** (2026-09-29): Restore incompatible-exact suppression in node.js libdef (@vzaidman)
- **PR #1993** (closed): Fix crash when import error points past the end of the file (#1993) (@vzaidman)
- **PR #1992** (2026-09-29): Add missing copyright headers to Metro Flow libdefs (@cipolleschi)
- **PR #1991** (2026-09-28): Add missing copyright headers to Metro Flow libdefs (#1991) (@cipolleschi)
- **PR #1989** (2026-09-28): Align OSS Flow config with lib.dom.d.ts (@vzaidman)
- **PR #1988** (2026-09-29): API snapshots: Report CommonJS entry points (@robhogan)
- **PR #1987** (2026-09-27): Fix exact "exports" and "imports" keys with no target falling back to a pattern (@kwy404)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
