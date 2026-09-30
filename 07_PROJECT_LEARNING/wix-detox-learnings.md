# Forensic Learning Record (Deep Inspection): wix/Detox

> **Canonical Artifact**: `07_PROJECT_LEARNING/wix-detox-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wix/Detox](https://github.com/wix/Detox))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:29:45.522Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wix/Detox`
- **Description**: Gray box end-to-end testing and automation framework for mobile apps
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12031 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.remarkrc.mjs`
```
import fs from 'fs';

import dictionary_en from 'dictionary-en';
import remark_frontmatter from 'remark-frontmatter';
import remark_gfm from 'remark-gfm';
import remark_github from 'remark-github';
import remark_retext from 'remark-retext';
import remark_validate_links from 'remark-validate-links';
import retext_contractions from 'retext-contractions';
import retext_diacritics from 'retext-diacritics';
import retext_english from 'retext-english';
import retext_indefinite_article from 'retext-indefinite-article';
import retext_profanities from 'retext-profanities';
import retext_redundant_acronyms from 'retext-redundant-acronyms';
import retext_repeated_words from 'retext-repeated-words';
import retext_sentence_spacing from 'retext-sentence-spacing';
import retext_spell from 'retext-spell';
import retext_syntax_mentions from 'retext-syntax-mentions';
import retext_syntax_urls from 'retext-syntax-urls';
import {unified} from 'unified';

export default {
  frail: true,
  silentlyIgnore: true,
  settings: {
    bullet: '-',
    bulletOther: '*',
    bulletOrdered: '.',
    closeAtx: false,
    emphasis: '_',
    fence: '`',
    fences: true,
    incrementListMarker: false,
    listItemIndent: 1,
    quote: '"',
    resourceLink: false,
    rule: '-',
    ruleRepetition: 3,
    ruleSpaces: false,
    setext: false,
    strong: '*'
  },
  plugins: [
    [remark_frontmatter, {
      type: 'yaml',
      marker: '-',
    }],
    // GitHub and its flavored markdown integration
    [remark_gfm, {
      tablePipeAlign: true,
    }],
    remark_github,
    // Links integrity.
    remark_validate_links, // TODO: check how to validate footnotes
    // Spelling and style.
    [ remark_retext,
      unified()
        .use(retext_english)
        .use(retext_syntax_mentions)
        .use(retext_syntax_urls)
        .use(retext_spell, {
          dictionary: dictionary_en,
          personal: fs.readFileSync('.retext-spell.dic'),
        })
        .use(retext_contractions)
        .use(retext_diacritics)
        .use(retext_indefinite_article)
        .use(retext_profanities, { sureness: 1, ignore: ['black'] })
        .use(retext_redundant_acronyms)
        .use(retext_repeated_words)
        .use(retext_sentence_spacing)
    ],
  ],
};

```

### Core Architecture Module: `.remarkrc.nightly.mjs`
```
import preset from './.remarkrc.mjs';
import remark_lint_no_dead_urls from 'remark-lint-no-dead-urls';

export default {
  ...preset,

  plugins: [
    [remark_lint_no_dead_urls, {
      gotOptions: { concurrency: 2 },
      skipUrlPatterns: [/^https:\/\/developer\.android\.com(?:\/.*)?/],
    }]
  ]
};

```

### Core Architecture Module: `detox-cli/cli.js`
```
#!/usr/bin/env node
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

/**
 * @param {string} msg
 */
function log(msg) {
  console.error(chalk.red(msg));
}

function main([_$0, _detox, ...cliArgs]) {
  const [command] = cliArgs;

  if (command === 'recorder' && process.platform === 'darwin') {
    return spawnRecorder(cliArgs);
  } else {
    return spawnDetoxBinary(cliArgs);
  }
}

function spawnDetoxBinary(cliArgs) {
  const isWin32 = process.platform === 'win32';
  const nodeBinariesPath = path.join(process.cwd(), 'node_modules/.bin');
  const binaryPath = path.join(nodeBinariesPath, `detox${isWin32 ? '.cmd' : ''}`);

  if (!fs.existsSync(binaryPath)) {
    log(`Failed to find Detox executable at path: ${binaryPath}`);
    log(`\nPossible solutions:`);
    log(`1. Make sure your current working directory is correct.`);
    log(`2. Run "npm install" to ensure your "node_modules" directory is up-to-date.`);
    log(`3. Run "npm install detox --save-dev" for the fresh Detox installation in your project.\n`);

    return 1;
  }

  const PATH = isWin32 ? findPathKey() : 'PATH';
  const spawnOptions = {
    stdio: 'inherit',
    env: {
      ...process.env,
      [PATH]: [nodeBinariesPath, process.env.PATH].join(path.delimiter),
    }
  };

  const result = isWin32
    // { shell: true } option seems to break quoting on windows? Otherwise this would be much simpler.
    ? cp.spawnSync('cmd', ['/c', binaryPath, ...cliArgs], spawnOptions)
    : cp.spawnSync(binaryPath, cliArgs, spawnOptions);

  return result.status;
}

function spawnRecorder([_recorder, ...recorderArgs]) {
  const detoxRecorderPath = path.join(process.cwd(), 'node_modules/detox-recorder');
  const detoxRecorderCLIPath = path.join(detoxRecorderPath, 'DetoxRecorderCLI');

  if (!fs.existsSync(detoxRecorderCLIPath)) {
    log(`Detox Recorder is not installed in this directory: ${detoxRecorderPath}`);
    return 1;
  }

  const result = cp.spawnSync(detoxRecorderCLIPath, recorderArgs, { stdio: 'inherit' });
  return result.status;
}

function findPathKey() {
  return Object.keys(process.env).find(isCaseInsensitivePath);
}

function isCaseInsensitivePath(key) {
  return key.toLowerCase() === 'path';
}

process.exit(main(process.argv));

```

### Core Architecture Module: `detox/.eslintrc.js`
```
module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:import/recommended',
    'plugin:node/recommended',
    'plugin:ecmascript-compat/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: [
    'unicorn',
    'import',
    'node',
    '@typescript-eslint/eslint-plugin',
  ],
  env: {
    node: true
  },
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_' },
    ],
    'array-bracket-spacing': [
      'error',
      'never'
    ],
    'computed-property-spacing': [
      'error',
      'never'
    ],
    'import/order': [
      'error',
      {
        'alphabetize': {
          'order': 'asc'
        },
        'newlines-between': 'always'
      }
    ],
    'no-case-declarations': 'off',
    'no-debugger': 'error',
    'no-empty': 'off',
    'no-mixed-spaces-and-tabs': 'error',
    'no-multiple-empty-lines': [
      'error',
      {
        'max': 2,
        'maxBOF': 1
      }
    ],
    'no-prototype-builtins': 'off',
    'no-unused-vars': 'off',
    'node/no-unpublished-require': 'warn',
    'object-curly-spacing': [
      'error',
      'always'
    ],
    'semi': [
      'error',
      'always'
    ],
    'quotes': ['error', 'single', {
      'avoidEscape': true,
      'allowTemplateLiterals': true
    }],
    'unicorn/expiring-todo-comments': ['warn',
      {
        allowWarningComments: false,
      }
    ],
  },

  overrides: [
    {
      files: ['*.test.{js,ts}', '**/{__mocks__,__tests__}/*.{js, ts}'],
      plugins: [
        'no-only-tests',
      ],
      env: {
        jest: true
      },
      rules: {
        'no-only-tests/no-only-tests': 'error',
      }
    }
  ]
};

```

### Core Architecture Module: `detox/detox.d.ts`
```
// TypeScript definitions for Detox
// Original authors (from DefinitelyTyped):
// * Jane Smith <jsmith@example.com>
// * Tareq El-Masri <https://github.com/TareqElMasri>
// * Steve Chun <https://github.com/stevechun>
// * Hammad Jutt <https://github.com/hammadj>
// * pera <https://github.com/santiagofm>
// * Max Komarychev <https://github.com/maxkomarychev>
// * Dor Ben Baruch <https://github.com/Dor256>

import { BunyanDebugStreamOptions } from 'bunyan-debug-stream';
import type { Config as PilotConfig, Pilot, PromptHandler as _PromptHandler } from '@wix-pilot/core'

declare global {
    namespace Detox {
        //#region DetoxConfig

        interface DetoxConfig extends DetoxConfigurationCommon {
            /**
             * @example extends: './relative/detox.config'
             * @example extends: '@my-org/detox-preset'
             */
            extends?: string;

            apps?: Record<string, DetoxAppConfig>;
            devices?: Record<string, DetoxDeviceConfig>;
            selectedConfiguration?: string;
            configurations: Record<string, DetoxConfiguration>;
        }

        type DetoxConfigurationCommon = {
            artifacts?: false | DetoxArtifactsConfig;
            behavior?: DetoxBehaviorConfig;
            logger?: DetoxLoggerConfig;
            session?: DetoxSessionConfig;
            testRunner?: DetoxTestRunnerConfig;
            /** Build command for the entire configuration, overriding individual app build commands. */
            build?: string;
            /** Start command for the entire configuration, overriding individual app start commands. */
            start?: string;
        };

        interface DetoxArtifactsConfig {
            rootDir?: string;
            pathBuilder?: string;
            plugins?: {
                log?: 'none' | 'failing' | 'all' | DetoxLogArtifactsPluginConfig;
                screenshot?: 'none' | 'manual' | 'failing' | 'all' | DetoxScreenshotArtifactsPluginConfig;
                video?: 'none' | 'failing' | 'all' | DetoxVideoArtifactsPluginConfig;
                instruments?: 'none' | 'all' | DetoxInstrumentsArtifactsPluginConfig;
                uiHierarchy?: 'disabled' | 'enabled' | DetoxUIHierarchyArtifactsPluginConfig;

                [pluginId: string]: unknown;
            };
        }

        interface DetoxBehaviorConfig {
            init?: {
                /**
                 * By default, Detox exports `device`, `expect`, `element`, `by` and `waitFor`
                 * as global variables. If you want to control their initialization manually,
                 * set this property to `false`.
                 *
                 * This is useful when during E2E tests you also need to run regular expectations
                 * in Node.js. Jest's `expect` for instance, will not be overridden by Detox when
                 * this option is used.
                 */
                exposeGlobals?: boolean;
                /**
                 * By default, Detox will uninstall and install the app upon initialization.
                 * If you wish to reuse the existing app for a faster run, set the property to
                 * `false`.
                 */
                reinstallApp?: boolean;
                /**
                 * When false, `detox test` command always deletes the shared lock file on start,
                 * assuming it had been left from the previous, already finished test session.
                 * The lock file contains information about busy and free devices and ensures
                 * no device can be used simultaneously by multiple test workers.
                 *
                 * Setting it to **true** might be useful when if you need to run multiple
                 * `detox test` commands in parallel, e.g. test a few configurations at once.
                 *
                 * @default false
                 */
                keepLockFile?: boolean;
            };
            launchApp?: 'auto' | 'manual';
            cleanup?: {
                shutdownDevice?: boolean;
            };
        }

        type _DetoxLoggerOptions = Omit<BunyanDebugStreamOptions, 'out'>;

        interface DetoxLoggerConfig {
            /**
             * Log level filters the messages printed to your terminal,
             * and it does not affect the logs written to the artifacts.
             *
             * Use `info` by default.
             * Use `error` or warn when you want to make the output as silent as possible.
             * Use `debug` to control what generally is happening under the hood.
             * Use `trace` when troubleshooting specific issues.
             *
             * @default 'info'
             */
            level?: DetoxLogLevel;
            /**
             * When enabled, hijacks all the console methods (console.log, console.warn, etc)
             * so that the messages printed via them are formatted and saved as Detox logs.
             *
             * @default true
             */
            overrideConsole?: boolean;
            /**
             * Since Detox is using
             * {@link https://www.npmjs.com/package/bunyan-debug-stream bunyan-debug-stream}
             * for printing logs, all its options are exposed for sake of simplicity
             * of customization.
             *
             * The only exception is {@link BunyanDebugStreamOptions#out} option,
             * which is always set to `process.stdout`.
             *
             * You can also pass a callback function to override the logger config
             * programmatically, e.g. depending on the selected log level.
             *
             * @see {@link BunyanDebugStreamOptions}
             */
            options?: _DetoxLoggerOptions | ((config: Partial<DetoxLoggerConfig>) => _DetoxLoggerOptions);
        }

        interface DetoxSessionConfig {
            autoStart?: boolean;
            debugSynchronization?: number;
            ignoreUnexpectedMessages?: boolean;
            server?: string;
            sessionId?: string;
        }

        interface DetoxTestRunnerConfig {
            args?: {
                /**
                 * The command to use for runner: 'jest', 'nyc jest',
                 */
                $0: string;
                /**
                 * The positional arguments to pass to the runner.
                 */
                _?: string[];
                /**
                 * Any other properties recognized by test runner
                 */
                [prop: string]: unknown;
            };

            /**
             * This is an add-on section used by our Jest integration code (but not Detox core itself).
             * In other words, if you’re implementing (or using) a custom integration with some other test runner, feel free to define a section for yourself (e.g. `testRunner.mocha`)
             */
            jest?: {
                /**
                 * Environment setup timeout
                 *
                 * As a part of the environment setup, Detox boots the device and installs the apps.
                 * If that takes longer than the specified value, the entire test suite will be considered as failed, e.g.:
                 * ```plain text
                 * FAIL  e2e/starter.test.js
                 * ● Test suite failed to run
                 *
                 * Exceeded timeout of 300000ms while setting up Detox environment
                 * ```
                 *
                 * The default value is 5 minutes.
                 *
                 * @default 300000
                 * @see {@link https://jestjs.io/docs/configuration/#testenvironment-string}
                 */
                setupTimeout?: number | undefined;
                /**
                 * Environemnt teardown timeout
                 *
                 * If the environment teardown takes longer than the specified value, Detox will throw a timeout error.
         
```

### Core Architecture Module: `detox/globals.d.ts`
```
import Detox = require('./detox');

declare global {
  const detox: Detox.DetoxExportWrapper;
  const device: Detox.DetoxExportWrapper['device'];
  const element: Detox.DetoxExportWrapper['element'];
  const waitFor: Detox.DetoxExportWrapper['waitFor'];
  const expect: Detox.DetoxExportWrapper['expect'];
  const by: Detox.DetoxExportWrapper['by'];
  const web: Detox.DetoxExportWrapper['web'];
  const system: Detox.DetoxExportWrapper['system'];
  const copilot: Detox.DetoxExportWrapper['copilot'];
  const pilot: Detox.DetoxExportWrapper['pilot'];

  namespace NodeJS {
    interface Global {
      detox: Detox.DetoxExportWrapper;
      device: Detox.DetoxExportWrapper['device'];
      element: Detox.DetoxExportWrapper['element'];
      waitFor: Detox.DetoxExportWrapper['waitFor'];
      expect: Detox.DetoxExportWrapper['expect'];
      by: Detox.DetoxExportWrapper['by'];
      web: Detox.DetoxExportWrapper['web'];
      system: Detox.DetoxExportWrapper['system'];
      copilot: Detox.DetoxExportWrapper['copilot'];
      pilot: Detox.DetoxExportWrapper['pilot'];
    }
  }
}

```

### Core Architecture Module: `detox/index.d.ts`
```
/// <reference path="detox.d.ts" />
/// <reference path="globals.d.ts" />

declare const detox: Detox.DetoxExportWrapper;
export = detox;

```

### Core Architecture Module: `detox/index.js`
```
function create() {
  if (process.env.DETOX_CONFIG_SNAPSHOT_PATH) {
    return require('./src/realms/secondary');
  } else {
    return require('./src/realms/primary');
  }
}

/** @type {Detox.DetoxExportWrapper} */
module.exports = global['__detox__']
  ? global['__detox__'].clientApi
  : create();

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4960** (2026-06-16): **Update package.json version to 20.51.4**
  *Symptoms*: Automated version bump to 20.51.4 from CI release.

- **Issue #4959** (2026-06-16): **feat: accept RegExp and arrays for URL blacklist (setURLBlacklist / detoxURLBlacklistRegex)**
  *Symptoms*: ## Summary  - `device.setURLBlacklist()` and the `detoxURLBlacklistRegex` launch arg now accept `RegExp` objects and mixed arrays of `string | RegExp`, in addition to plain string arrays. - `RegExp` values are converted to portable inline-flag syntax (e.g. `(?i:pattern)`) so they work identically on both iOS and Android. Flags `g`, `y`, `d`, `u`, and `v` are rejected with a clear error since they have no cross-platform equivalent. - TypeScript types updated: `setURLBlacklist(urls: Array<string | RegExp>)`.  ## Test plan  - [x] Unit tests added for the new `urlBlacklist.js` utility (flag stripping, error cases, serialization for iOS/Android). - [x] Unit tests added for `instrumentationArgs.js` (Android) and `AppleSimUtils.js` (iOS) serialization paths. - [x] Manually verify `setURLBlacklist([/.*my\.api\.*/i])` suppresses synchronization on a matching URL on both platforms.  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #4957** (2026-05-30): **Update package.json version to 20.51.3**
  *Symptoms*: Automated version bump to 20.51.3 from CI release.

- **Issue #4955** (2026-05-30): **feat(ios): add regex support for toHaveText**
  *Symptoms*: ## Summary  - Builds on #4951 (cherry-picked @omribz156's type declaration commit) - Wires up the existing `matchesJSRegex` utility (already used by `ValuePredicate` for `by.text`/`by.id`/`by.label`) to the `ValueExpectation` path so `toHaveText(/regex/)` works on iOS, matching Android behaviour - JS side: `toHaveText` now serialises a `RegExp` as `text.toString()` + a boolean `isRegex` flag in params — same convention as `by.*` matchers - Swift side: `ValueExpectation` gains an `isRegex` field; `evaluate` branches to `matchesJSRegex` when set; factory reads the flag from `params[1]` - Docs updated: regex example, link to supported flags, and a note that the regex must match the **entire** element text on both platforms (no partial matching)  ## Test plan  - [x] `yarn jest src/ios/expectTwo.test.js` — unit test for invocation serialisation - [x] New e2e tests in `04.assertions.test.js`: `toHaveText(/regex/)` (positive) and `not.toHaveText(/regex/)` (negative) against a real element  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #4954** (2026-05-30): **Update package.json version to 20.51.3-smoke.0**
  *Symptoms*: Automated version bump to 20.51.3-smoke.0 from CI release.

- **Issue #4953** (2026-05-29): **Update package.json version to 20.51.2**
  *Symptoms*: Automated version bump to 20.51.2 from CI release.

- **Issue #4952** (2026-05-30): **chore: bump DetoxSync to latest commit**
  *Symptoms*: Bump the DetoxSync submodule from 3660cfa to c89e418 (DetoxSync origin/master).\n\nThis updates wix/Detox to the latest upstream DetoxSync commit currently available.

- **Issue #4951** (2026-05-30): **fix(types): allow regex in toHaveText**
  *Symptoms*: ## Description  - This pull request addresses the issue described here: #4914  This updates the native `toHaveText` TypeScript declaration to accept `RegExp` as well as `string`. The Android expectation path already has runtime coverage for `toHaveText(/text/)`, so this keeps the public typings aligned with existing behavior and adds type-test coverage for both global and module import styles.  ---  > _For features/enhancements:_  - [ ] I have added/updated the relevant references in the [documentation](https://github.com/wix/Detox/tree/master/docs) files. Not applicable: this is a typings parity fix for already-covered runtime behavior.  > _For API changes:_  - [x] I have made the necessary changes in the [types index](https://github.com/wix/Detox/blob/master/detox/index.d.ts) file.  ## Verification  - `yarn install --immutable --mode=skip-build` (completed with existing peer dependency warnings) - `yarn --cwd detox/test test:types` - `yarn --cwd detox/test eslint types/detox-global-tests.ts types/detox-module-tests.ts` - `yarn --cwd detox jest src/android/AndroidExpect.test.js --runInBand` - `git diff --check`  This was implemented with Codex assistance, with the patch kept focused and manually reviewed against the existing matcher/type path.
  **Post-Mortem & Fix Analysis**:
  > Thanks for the contribution! The type change is correct for Android, but `toHaveText` with regex wouldn't have worked on iOS as-is — I had to add the native implementation there too. Superseded by #4955 which includes the full cross-platform support.

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

### Incident Patch 1: `4b84d9c0` (2026-05-20)
**Commit Message**: fix(types): allow regex in toHaveText

**File**: `detox/detox.d.ts` (modified, +3/-2)
```diff
@@ -1516,9 +1516,10 @@ declare global {
             /**
              * In React Native apps, expect UI component of type <Text> to have text.
              * In native iOS apps, expect UI elements of type UIButton, UILabel, UITextField or UITextViewIn to have inputText with text.
-             * @example await expect(element(by.id('mainTitle'))).toHaveText('Welcome back!);
+             * @example await expect(element(by.id('mainTitle'))).toHaveText('Welcome back!');
+             * @example await expect(element(by.id('dynamicTitle'))).toHaveText(/^Welcome back/);
              */
-            toHaveText(text: string): R;
+            toHaveText(text: string | RegExp): R;
 
             /**
              * Expects a specific accessibilityLabel, as specified via the `accessibilityLabel` prop in React Native.
```

**File**: `detox/test/types/detox-global-tests.ts` (modified, +2/-0)
```diff
@@ -80,9 +80,11 @@ describe("Test", () => {
         await expectElement.toBeFocused();
         await expectElement.not.toBeFocused();
         await expectElement.toBeNotFocused();
+        await expectElement.toHaveText(/dynamic text/);
 
         const waitForElement = waitFor(element(by.id("element")));
         await waitForElement.toBeVisible().withTimeout(2000);
+        await waitForElement.toHaveText(/dynamic text/).withTimeout(2000);
 
         await device.pressBack();
         await device.reverseTcpPort(32167);
```

**File**: `detox/test/types/detox-module-tests.ts` (modified, +4/-0)
```diff
@@ -60,6 +60,7 @@ describe('Test', () => {
     await element(by.id('element')).scroll(50, 'down', 0.5, 0.5);
     await element(by.id('scrollView')).scrollTo('bottom');
     await expect(element(by.id('element')).atIndex(0)).toNotExist();
+    await expect(element(by.id('element'))).toHaveText(/dynamic text/);
     await element(by.id('scrollView')).swipe('down', 'fast', 0.2, 0.5, 0.5);
     await element(by.type('UIPickerView')).setColumnToValue(1, '6');
 
@@ -69,6 +70,9 @@ describe('Test', () => {
     await waitFor(element(by.id('element')))
       .toBeVisible()
       .withTimeout(2000);
+    await waitFor(element(by.id('element')))
+      .toHaveText(/dynamic text/)
+      .withTimeout(2000);
     await device.pressBack();
     await waitFor(element(by.text('Text5')))
       .toBeVisible()
```

---

### Incident Patch 2: `68402287` (2026-05-30)
**Commit Message**: chore: bump DetoxSync to 90f9935 (fixes verbose sync logging deadlock on serial queue)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

**File**: `detox/ios/DetoxSync` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 763e8c0282187d5fdf146f623fcda777a3728ffd
+Subproject commit 90f993520d8076ba42c089527d236f8cd86b123b
```

---

### Incident Patch 3: `5a46f173` (2026-05-29)
**Commit Message**: chore: bump DetoxSync to 763e8c0 (PR#100: thread-safe URLSession untrack, fixes Signal 11)

**File**: `detox/ios/DetoxSync` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit c89e418f6e720a2aeeca54d078fb9ce48697836f
+Subproject commit 763e8c0282187d5fdf146f623fcda777a3728ffd
```

---

### Incident Patch 4: `4cdea564` (2026-05-30)
**Commit Message**: fix(android): quote adb device serials (#4950)

**File**: `detox/src/devices/common/drivers/android/exec/ADB.js` (modified, +1/-1)
```diff
@@ -388,7 +388,7 @@ class ADB {
   }
 
   async adbCmd(deviceId, params, options = {}) {
-    const serial = `${deviceId ? `-s ${deviceId}` : ''}`;
+    const serial = `${deviceId ? `-s "${escape.inQuotedString(deviceId)}"` : ''}`;
     const cmd = `"${this.adbBin}" ${serial} ${params}`;
     const _options = {
       ...this.defaultExecOptions,
```

**File**: `detox/src/devices/common/drivers/android/exec/ADB.test.js` (modified, +22/-12)
```diff
@@ -108,7 +108,17 @@ describe('ADB', () => {
     await adb.waitForDevice(deviceId);
 
     expect(execWithRetriesAndLogs).toHaveBeenCalledWith(
-      expect.stringContaining(`"${adbBinPath}" -s ${deviceId} wait-for-device`),
+      expect.stringContaining(`"${adbBinPath}" -s "${deviceId}" wait-for-device`),
+      expect.any(Object));
+  });
+
+  it('should quote device serials used in shell commands', async () => {
+    const mdnsDeviceId = 'adb-5721009297-Rq3U4s (2)._adb-tls-connect._tcp';
+
+    await adb.waitForDevice(mdnsDeviceId);
+
+    expect(execWithRetriesAndLogs).toHaveBeenCalledWith(
+      expect.stringContaining(`"${adbBinPath}" -s "${mdnsDeviceId}" wait-for-device`),
       expect.any(Object));
   });
 
@@ -196,11 +206,11 @@ describe('ADB', () => {
     await adb.setLocation(deviceId, lat, lon);
 
     expect(execWithRetriesAndLogs).toHaveBeenCalledWith(
-      expect.stringContaining(`-s mockEmulator emu "geo fix -70.5 30.5"`),
+      expect.stringContaining(`-s "mockEmulator" emu "geo fix -70.5 30.5"`),
       expect.anything());
 
     expect(execWithRetriesAndLogs).toHaveBeenCalledWith(
-      expect.stringContaining(`-s mockEmulator emu "geo fix -70,5 30,5"`),
+      expect.stringContaining(`-s "mockEmulator" emu "geo fix -70,5 30,5"`),
       expect.anything());
   });
 
@@ -222,7 +232,7 @@ describe('ADB', () => {
     await adb.push(deviceId, sourceFile, destFile);
 
     expect(execWithRetriesAndLogs).toHaveBeenCalledWith(
-      expect.stringContaining(`-s mockEmulator push "${sourceFile}" "${destFile}"`),
+      expect.stringContaining(`-s "mockEmulator" push "${sourceFile}" "${destFile}"`),
       expect.anything());
   });
 
@@ -266,7 +276,7 @@ describe('ADB', () => {
     const expectedText = 'some-text-with%sspaces';
     await adb.typeText(deviceId, text);
     expect(execWithRetriesAndLogs).toHaveBeenCalledWith(
-      expect.stringContaining(`-s mockEmulator shell "input text ${expectedText}"`),
+      expect.stringContaining(`-s "mockEmulator" shell "input text ${expectedText}"`),
       expect.anything());
   });
 
@@ -393,37 +403,37 @@ describe('ADB', () => {
   describe('animation disabling', () => {
     it('should disable animator (e.g. ObjectAnimator) animations', async () => {
       await adb.disableAndroidAnimations(deviceId);
-      expect(execWithRetriesAndLogs).toHaveBeenCalledWith(`"${adbBinPath}" -s ${deviceId} shell "settings put global animator_duration_scale 0"`, { retries: 1 });
+      expect(execWithRetriesAndLogs).toHaveBeenCalledWith(`"${adbBinPath}" -s "${deviceId}" shell "settings put global animator_duration_scale 0"`, { retries: 1 });
     });
 
     it('should disable window animations', async () => {
       await adb.disableAndroidAnimations(deviceId);
-      expect(execWithRetriesAndLogs).toHaveBeenCalledWith(`"${adbBinPath}" -s ${deviceId} shell "settings put global window_animation_scale 0"`, { retries: 1 });
+      expect(execWithRetriesAndLogs).toHaveBeenCalledWith(`"${adbBinPath}" -s "${deviceId}" shell "settings put global window_animation_scale 0"`, { retries: 1 });
     });
 
     it('should disable transition (e.g. activity launch) animations', async () => {
       await adb.disableAndroidAnimations(deviceId);
-      expect(execWithRetriesAndLogs).toHaveBeenCalledWith(`"${adbBinPath}" -s ${deviceId} shell "settings put global transition_animation_scale 0"`, { retries: 1 });
+      expect(execWithRetriesAndLogs).toHaveBeenCalledWith(`"${adbBinPath}" -s "${deviceId}" shell "settings put global transition_animation_scale 0"`, { retries: 1 });
     });
   });
 
   describe('WiFi toggle', () => {
     it('should enable wifi', async () => {
       await adb.setWiFiToggle(deviceId, true);
-      expect(execWithRetriesAndLogs).toHaveBeenCalledWith(`"${adbBinPath}" -s ${deviceId} shell "svc wifi enable"`, { retries: 1 });
+      expect(execWithRetriesAndLogs).toHaveBeenCalledWith(`"${adbBinPath}" -s "${deviceId}" shell "svc wifi enable"`, { retries: 1 });
     });

```

---

### Incident Patch 5: `cf6402c5` (2026-05-30)
**Commit Message**: fix(sync): accept null one-time event objects (#4949)

**File**: `detox/src/client/actions/SyncStatusSchema.json` (modified, +4/-1)
```diff
@@ -114,7 +114,10 @@
                         "type":"string"
                       },
                       "object":{
-                        "type":"string"
+                        "type":[
+                          "string",
+                          "null"
+                        ]
                       }
                     },
                     "required":[
```

**File**: `detox/src/client/actions/formatters/SyncStatusFormatter.test.js` (modified, +17/-0)
```diff
@@ -150,6 +150,23 @@ describe('Sync Status Formatter', () => {
       await expect(format(busyStatus)).toMatchSnapshot();
     });
 
+    it('should format "one_time_events" correctly when object is null', async () => {
+      let busyStatus = {
+        app_status: 'busy',
+        busy_resources: [
+          {
+            name: 'one_time_events',
+            description: {
+              event: 'foo',
+              object: null
+            }
+          }
+        ]
+      };
+
+      await expect(format(busyStatus)).toMatchSnapshot();
+    });
+
     it('should format "one_time_events" correctly', async () => {
       let busyStatus = {
         app_status: 'busy',
```

**File**: `detox/src/client/actions/formatters/__snapshots__/SyncStatusFormatter.test.js.snap` (modified, +5/-0)
```diff
@@ -176,6 +176,11 @@ exports[`Sync Status Formatter busy status should format "one_time_events" corre
 • The event "foo" is taking place with object: "bar"."
 `;
 
+exports[`Sync Status Formatter busy status should format "one_time_events" correctly when object is null 1`] = `
+"The app is busy with the following tasks:
+• The event "foo" is taking place."
+`;
+
 exports[`Sync Status Formatter busy status should format "one_time_events" correctly when there is no object 1`] = `
 "The app is busy with the following tasks:
 • The event "foo" is taking place."
```

**File**: `detox/src/client/actions/formatters/sync-resources/OneTimeEventsFormatter.js` (modified, +1/-1)
```diff
@@ -3,6 +3,6 @@ const { makeResourceTitle } = require('./utils');
 module.exports = function(properties) {
   const objectName = properties.object;
   return makeResourceTitle(
-    `The event "${properties.event}" is taking place${(objectName === undefined) ? `.` : ` with object: "${objectName}".`}`
+    `The event "${properties.event}" is taking place${(objectName == null) ? `.` : ` with object: "${objectName}".`}`
   );
 };
```

---

### Incident Patch 6: `27ddf83c` (2026-05-12)
**Commit Message**: fix(android): Catch errors in WebView injection (#4943)

Co-authored-by: mark.dev <50657916+markdevocht@users.noreply.github.com>

**File**: `detox/android/detox/src/full/java/com/wix/detox/espresso/hierarchy/ViewHierarchyGenerator.kt` (modified, +5/-1)
```diff
@@ -19,6 +19,7 @@ import kotlin.coroutines.resume
 
 private const val GET_HTML_SCRIPT = """
 (function() {
+  try {
     const blacklistedTags = ['script', 'style', 'head', 'meta'];
     const blackListedTagsSelector = blacklistedTags.join(',');
 
@@ -38,7 +39,10 @@ private const val GET_HTML_SCRIPT = """
     var serializedHtml = serializer.serializeToString(clonedDoc);
 
     // Return the serialized HTML as a string
-    return serializedHtml;
+    return serializedHtml;       
+  } catch {
+    return '<html xmlns="http://www.w3.org/1999/xhtml"><body></body></html>';    
+  }
 })();
 """
 
```

---

### Incident Patch 7: `650e4c5e` (2026-05-12)
**Commit Message**: fix(ios): use --booted flag for biometric commands on iOS 26+ (#4932)

Co-authored-by: jon-albert_landg <jon.albert@landg.com>
Co-authored-by: mark.dev <50657916+markdevocht@users.noreply.github.com>

**File**: `detox/src/devices/common/drivers/ios/tools/AppleSimUtils.js` (modified, +40/-18)
```diff
@@ -311,14 +311,24 @@ class AppleSimUtils {
       return;
     }
 
-    const options = {
-      args: `--byId ${udid} --match${matchType}`,
-      retries: 1,
-      statusLogs: {
-        trying: `Trying to match ${matchType}...`,
-        successful: `Matched ${matchType}!`
-      },
-    };
+    const isIOS26Plus = (await this._getMajorIOSVersion(udid)) >= 26;
+    const options = isIOS26Plus
+      ? {
+          args: `--booted --biometricMatch`,
+          retries: 1,
+          statusLogs: {
+            trying: `Trying to match ${matchType}...`,
+            successful: `Matched ${matchType}!`
+          }
+        }
+      : {
+          args: `--byId ${udid} --match${matchType}`,
+          retries: 1,
+          statusLogs: {
+            trying: `Trying to match ${matchType}...`,
+            successful: `Matched ${matchType}!`
+          }
+        };
     await this._execAppleSimUtils(options);
   }
 
@@ -327,14 +337,24 @@ class AppleSimUtils {
       return;
     }
 
-    const options = {
-      args: `--byId ${udid} --unmatch${matchType}`,
-      retries: 1,
-      statusLogs: {
-        trying: `Trying to unmatch ${matchType}...`,
-        successful: `Unmatched ${matchType}!`
-      },
-    };
+    const isIOS26Plus = (await this._getMajorIOSVersion(udid)) >= 26;
+    const options = isIOS26Plus
+      ? {
+          args: `--booted --biometricNonmatch`,
+          retries: 1,
+          statusLogs: {
+            trying: `Trying to unmatch ${matchType}...`,
+            successful: `Unmatched ${matchType}!`
+          }
+        }
+      : {
+          args: `--byId ${udid} --unmatch${matchType}`,
+          retries: 1,
+          statusLogs: {
+            trying: `Trying to unmatch ${matchType}...`,
+            successful: `Unmatched ${matchType}!`
+          }
+        };
     await this._execAppleSimUtils(options);
   }
 
@@ -344,13 +364,15 @@ class AppleSimUtils {
     }
 
     const toggle = yesOrNo === 'YES';
+    const isIOS26Plus = (await this._getMajorIOSVersion(udid)) >= 26;
+    const byIdOrBooted = isIOS26Plus ? `--booted` : `--byId ${udid}`;
     const options = {
-      args: `--byId ${udid} --biometricEnrollment ${yesOrNo}`,
+      args: `${byIdOrBooted} --biometricEnrollment ${yesOrNo}`,
       retries: 1,
       statusLogs: {
         trying: `Turning ${toggle ? 'on' : 'off'} biometric enrollment...`,
         successful: toggle ? 'Activated!' : 'Deactivated!'
-      },
+      }
     };
     await this._execAppleSimUtils(options);
   }
```

---

### Incident Patch 8: `acc545fe` (2026-05-12)
**Commit Message**: Bugfix/ascii swift fix (#4948)

* fix for ascii

* test update

* test removal

**File**: `detox/test/e2e/33.attributes.test.js` (modified, +0/-10)
```diff
@@ -230,16 +230,6 @@ describe('Attributes', () => {
         visible: true,
       });
     });
-
-    it(':ios: @new-arch should return attributes of a single element when using atIndex', async () => {
-      const result = await element(by.type('RCTViewComponentView')).atIndex(0).getAttributes();
-
-      expect(result).not.toHaveProperty('elements');
-      expect(result).toMatchObject({
-        enabled: true,
-        visible: true,
-      });
-    });
   });
 
   describe('of multiple views', () => {
```

---

### Incident Patch 9: `2852c0ba` (2026-05-11)
**Commit Message**: fix for ascii (#4947)

**File**: `detox/ios/Detox/Invocation/Element.swift` (modified, +1/-1)
```diff
@@ -316,7 +316,7 @@ class Element : NSObject {
 
 		if let index = index {
 			guard index < views.count else {
-				dtx_fatalError("Index \(index) beyond bounds \(views.count > 0 ? "[0 .. \(views.count - 1)] " : " ")for "\(self.description)"", viewDescription: failDebugAttributes)
+				dtx_fatalError("Index \(index) beyond bounds \(views.count > 0 ? "[0 .. \(views.count - 1)] " : " ")for “\(self.description)”", viewDescription: failDebugAttributes)
 			}
 			return views[index].dtx_attributes
 		} else if views.count == 1 {
```

---

### Incident Patch 10: `f831cd20` (2026-05-11)
**Commit Message**: fix(ios): respect atIndex in getAttributes (#4912)

The `attributes` property on `Element` was ignoring `self.index`,
causing `element(...).atIndex(N).getAttributes()` to return all
matching elements instead of the one at the specified index.

This aligns the `attributes` property with the existing `view` property,
which already correctly handles `self.index`.

Fixes #4633

Co-authored-by: mark.dev <50657916+markdevocht@users.noreply.github.com>

**File**: `detox/ios/Detox/Invocation/Element.swift` (modified, +8/-3)
```diff
@@ -313,14 +313,19 @@ class Element : NSObject {
 	@objc
 	var attributes: [String : Any] {
 		let views = self.views
-		
-		if views.count == 1 {
+
+		if let index = index {
+			guard index < views.count else {
+				dtx_fatalError("Index \(index) beyond bounds \(views.count > 0 ? "[0 .. \(views.count - 1)] " : " ")for "\(self.description)"", viewDescription: failDebugAttributes)
+			}
+			return views[index].dtx_attributes
+		} else if views.count == 1 {
 			return views.first!.dtx_attributes
 		} else {
 			let elements = views.map {
 				return $0.dtx_attributes
 			}
-			
+
 			return ["elements": elements]
 		}
 	}
```

**File**: `detox/test/e2e/33.attributes.test.js` (modified, +22/-0)
```diff
@@ -220,6 +220,28 @@ describe('Attributes', () => {
     });
   });
 
+  describe('of multiple views with atIndex', () => {
+    it(':ios: @legacy should return attributes of a single element when using atIndex', async () => {
+      const result = await element(by.type('RCTView').withAncestor(by.id('attrScrollView'))).atIndex(0).getAttributes();
+
+      expect(result).not.toHaveProperty('elements');
+      expect(result).toMatchObject({
+        enabled: true,
+        visible: true,
+      });
+    });
+
+    it(':ios: @new-arch should return attributes of a single element when using atIndex', async () => {
+      const result = await element(by.type('RCTViewComponentView')).atIndex(0).getAttributes();
+
+      expect(result).not.toHaveProperty('elements');
+      expect(result).toMatchObject({
+        enabled: true,
+        visible: true,
+      });
+    });
+  });
+
   describe('of multiple views', () => {
     it(':ios: @legacy should return an object with .elements array', async () => {
       await useMatcher(by.type('RCTView').withAncestor(by.id('attrScrollView')));
```

#### Recent Merged Pull Requests:
- **PR #4960** (2026-06-16): Update package.json version to 20.51.4 (@mobileoss)
- **PR #4959** (2026-06-16): feat: accept RegExp and arrays for URL blacklist (setURLBlacklist / detoxURLBlacklistRegex) (@noomorph)
- **PR #4957** (2026-05-30): Update package.json version to 20.51.3 (@mobileoss)
- **PR #4955** (2026-05-30): feat(ios): add regex support for toHaveText (@noomorph)
- **PR #4954** (closed): Update package.json version to 20.51.3-smoke.0 (@mobileoss)
- **PR #4953** (closed): Update package.json version to 20.51.2 (@mobileoss)
- **PR #4952** (2026-05-30): chore: bump DetoxSync to latest commit (@noomorph)
- **PR #4951** (closed): fix(types): allow regex in toHaveText (@omribz156)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
