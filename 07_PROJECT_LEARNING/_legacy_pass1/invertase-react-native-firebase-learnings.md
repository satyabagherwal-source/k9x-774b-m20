# Forensic Learning Record (Deep Inspection): invertase/react-native-firebase

> **Canonical Artifact**: `07_PROJECT_LEARNING/invertase-react-native-firebase-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/invertase/react-native-firebase](https://github.com/invertase/react-native-firebase))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:29:39.459Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `invertase/react-native-firebase`
- **Description**: 🔥 A well-tested feature-rich modular Firebase implementation for React Native. Supports both iOS & Android platforms for all Firebase services.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12308 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.prettierrc.js`
```
module.exports = {
  arrowParens: 'avoid',
  trailingComma: 'all',
  useTabs: false,
  semi: true,
  singleQuote: true,
  bracketSpacing: true,
  bracketSameLine: false,
  tabWidth: 2,
  printWidth: 100,
};

```

### Core Architecture Module: `babel.config.js`
```
module.exports = {
  env: {
    test: {
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              node: 'current',
            },
          },
        ],
        'module:./tests/node_modules/@react-native/babel-preset',
      ],
    },
  },
  plugins: [
    ['@babel/plugin-proposal-private-property-in-object', { loose: true }],
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    ['@babel/plugin-proposal-private-methods', { loose: true }],
  ],
};

```

### Core Architecture Module: `eslint.config.mjs`
```
import eslintJs from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';

import eslintTypescriptParser from '@typescript-eslint/parser';

import eslintPluginJest from 'eslint-plugin-jest';
import eslintPluginMocha from 'eslint-plugin-mocha';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslintPluginReact from 'eslint-plugin-react';
import eslintPluginTypescript from 'typescript-eslint';
import * as eslintPluginMdx from 'eslint-plugin-mdx';

export default defineConfig([
  globalIgnores([
    'packages/**/dist/',
    'packages/**/android/build/',
    '**/type-test.ts',
    'packages/ai/__tests__/test-utils',
    'test-expo/ios/',
    'test-expo/android/',
    'test-expo/.expo/',
  ]),

  {
    name: 'JavaScript',
    ...eslintJs.configs.recommended,
    ...eslintJs.configs.all,
    rules: {
      'prefer-const': ['error', { destructuring: 'all' }],
      'eslint-comments/no-unlimited-disable': 0,
      'no-new': 0,
      'no-continue': 0,
      'no-extend-native': 0,
      'import/no-dynamic-require': 0,
      'global-require': 'off',
      'class-methods-use-this': 0,
      'no-console': 1,
      'no-plusplus': 0,
      'no-undef': 0,
      'no-shadow': 0,
      'no-catch-shadow': 0,
      'no-underscore-dangle': 'off',
      'no-use-before-define': 0,
      'import/no-unresolved': 0,
      'no-unused-vars': 'off',
    },
  },
  {
    name: 'Jest',
    ...eslintPluginJest.configs['flat/recommended'],
    rules: {
      'jest/expect-expect': 0,
      'jest/no-disabled-tests': 0,
      'jest/no-test-prefixes': 0,
    },
  },
  {
    name: 'Mocha',
    ...eslintPluginMocha.configs.recommended,
    rules: {
      'mocha/no-pending-tests': 'off',
      'mocha/no-top-level-hooks': 'off',
      'mocha/no-hooks-for-single-case': 'off',
      'mocha/no-setup-in-describe': 'off',
    },
  },
  {
    name: 'Prettier',
    ...eslintPluginPrettierRecommended,
  },
  {
    name: 'React',
    ...eslintPluginReact.configs.flat.recommended,
    ...eslintPluginReact.configs.flat['jsx-runtime'],
  },
  {
    name: 'Typescript',
    extends: [eslintPluginTypescript.configs.recommended],
    ignores: ['*.mdx'],
    rules: {
      'prefer-const': 0,
      'prefer-rest-params': 0,
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/camelcase': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/ban-ts-ignore': 'off',

      // Allow `{}` in type positions and empty interfaces (e.g. T extends {}, placeholder pipeline types), matches firebase-js-sdk.
      '@typescript-eslint/no-empty-object-type': [
        'error',
        { allowObjectTypes: 'always', allowInterfaces: 'always' },
      ],
    },
  },

  {
    name: 'MDX',
    files: ['**/*.mdx'],
    ...eslintPluginMdx.flat,
  },
  {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: {
        __DEV__: true,
        __RNFB__: true,
        firebase: true,
        should: true,
        Utils: true,
        window: true,
      },

      parser: eslintTypescriptParser,
      ecmaVersion: 2018,
      sourceType: 'module',
    },
    settings: {
      react: {
        version: '17.0.20',
      },
    },
  },
]);

```

### Core Architecture Module: `jest.config.js`
```
module.exports = {
  maxConcurrency: 10,
  preset: '@react-native/jest-preset',

  // This is a large departure from most react-native jest testing
  // they use a variant of 'jsdom' (tailored for react-native) so they
  // load web bundles etc.
  //
  // This is a problem during the CJS / ESM transition though - firebase
  // creates a web bundle that uses ESM modules now and defines standard
  // entry points for web bundle loaders to use them. So jest tries to load
  // the ESM bundle and Jest / ts-jest attempt to transform / use them, but
  // they don't support ESM well.
  //
  // So we just brutally alter the test environment to 'node'. No web testing
  // is possible, but that's okay for us, and it loads the non-ESM bundle now.
  testEnvironment: 'node',

  transform: {
    '^.+\\.(js)$': '<rootDir>/node_modules/babel-jest',
    '\\.(ts|tsx)$': ['ts-jest', { tsconfig: './tsconfig-jest.json' }],
  },
  setupFiles: ['./jest.setup.ts'],
  globalSetup: './scripts/jest-ai-mocks-global-setup.js',
  testMatch: ['**/packages/**/__tests__/**/*.test.(ts|js)'],
  modulePaths: ['node_modules', './tests/node_modules'],
  testPathIgnorePatterns: ['./packages/template'],
  moduleDirectories: ['node_modules', './tests/node_modules'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'mjs'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@firebase|@react-native(-community)?))',
  ],
  // Packages cross-import each other's built output (e.g. database imports
  // `@react-native-firebase/app/dist/module/common/deeps`), which resolves
  // through the workspace symlink to `packages/*/dist/**`. Without this,
  // Jest instruments both that build artifact and the original `lib/**.ts`
  // source it was compiled from, so any shared file with branches gets a
  // second, all-zero coverage entry alongside the real one, and codecov's
  // patch coverage misreports lines that are actually fully tested.
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
};

```

### Core Architecture Module: `jest.setup.ts`
```
import * as ReactNative from 'react-native';
import { jest } from '@jest/globals';

// Avoid log pollution with emulator URL remap messages during testing
// eslint-disable-next-line no-console
const logOrig = console.log;
const logWithRemapMessageRemoved = (message?: any, ...optionalParams: any[]): void => {
  if (
    // Make sure it is a string before attempting to filter it out
    (typeof message !== 'string' && !(message instanceof String)) ||
    !message.includes('android_bypass_emulator_url_remap')
  ) {
    logOrig(message, ...optionalParams);
  }
};
// eslint-disable-next-line no-console
console.log = logWithRemapMessageRemoved;

jest.doMock('react-native', () => {
  // @ts-ignore - react-native empty bridge config so native modules at least default init
  global.__fbBatchedBridgeConfig = {};

  // @ts-ignore - react-native new architecture interop flag to true
  global.RN$TurboInterop = true;

  // make sure PlatformConstants is visible otherwise turbo modules default init fails
  ReactNative.NativeModules['PlatformConstants'] = {};

  const turboModuleLookup: Record<string, unknown> = {
    ...ReactNative.NativeModules,
        NativeRNFBTurboAnalytics: {
          logEvent: jest.fn(),
          setAnalyticsCollectionEnabled: jest.fn(),
          setSessionTimeoutDuration: jest.fn(),
          getAppInstanceId: jest.fn(),
          getSessionId: jest.fn(),
          setUserId: jest.fn(),
          setUserProperty: jest.fn(),
          setUserProperties: jest.fn(),
          resetAnalyticsData: jest.fn(),
          setConsent: jest.fn(),
          setDefaultEventParameters: jest.fn(),
          logTransaction: jest.fn(),
          initiateOnDeviceConversionMeasurementWithEmailAddress: jest.fn(),
          initiateOnDeviceConversionMeasurementWithHashedEmailAddress: jest.fn(),
          initiateOnDeviceConversionMeasurementWithPhoneNumber: jest.fn(),
          initiateOnDeviceConversionMeasurementWithHashedPhoneNumber: jest.fn(),
        },
        NativeRNFBTurboApp: {
          getConstants: () => ({
            NATIVE_FIREBASE_APPS: [
              {
                appConfig: {
                  name: '[DEFAULT]',
                },
                options: {},
              },
              {
                appConfig: {
                  name: 'secondaryFromNative',
                },
                options: {},
              },
            ],
            FIREBASE_RAW_JSON: '{}',
          }),
          NATIVE_FIREBASE_APPS: [
            {
              appConfig: {
                name: '[DEFAULT]',
              },
              options: {},
            },

            {
              appConfig: {
                name: 'secondaryFromNative',
              },
              options: {},
            },
          ],
          FIREBASE_RAW_JSON: '{}',
          addListener: jest.fn(),
          eventsAddListener: jest.fn(),
          eventsNotifyReady: jest.fn(),
          eventsRemoveListener: jest.fn(),
          removeListeners: jest.fn(),
        },
        NativeRNFBTurboUtils: {
          getConstants: () => ({
            isRunningInTestLab: false,
            appVersion: '1.0.0',
            MAIN_BUNDLE: '/',
            CACHES_DIRECTORY: '/cache',
            DOCUMENT_DIRECTORY: '/documents',
            TEMP_DIRECTORY: '/tmp',
            LIBRARY_DIRECTORY: '/library',
            PICTURES_DIRECTORY: '/pictures',
            MOVIES_DIRECTORY: '/movies',
          }),
          isRunningInTestLab: false,
          appVersion: '1.0.0',
          MAIN_BUNDLE: '/',
          CACHES_DIRECTORY: '/cache',
          DOCUMENT_DIRECTORY: '/documents',
          TEMP_DIRECTORY: '/tmp',
          LIBRARY_DIRECTORY: '/library',
          PICTURES_DIRECTORY: '/pictures',
          MOVIES_DIRECTORY: '/movies',
          androidGetPlayServicesStatus: jest.fn(() =>
            Promise.resolve({
              isAvailable: true,
              status: 0,
              hasResolution: false,
              isUserResolvableError: false,
            }),
          ),
        },
        RNFBAppModule: {
          NATIVE_FIREBASE_APPS: [
            {
              appConfig: {
                name: '[DEFAULT]',
              },
              options: {},
            },

            {
              appConfig: {
                name: 'secondaryFromNative',
              },
              options: {},
            },
          ],
          FIREBASE_RAW_JSON: '{}',
          addListener: jest.fn(),
          eventsAddListener: jest.fn(),
          eventsNotifyReady: jest.fn(),
          eventsRemoveListener: jest.fn(),
          removeListeners: jest.fn(),
        },
        NativeRNFBTurboAuth: {
          getConstants: () => ({
            APP_LANGUAGE: {
              '[DEFAULT]': 'en-US',
            },
            APP_USER: {
              '[DEFAULT]': null,
            },
          }),
          APP_LANGUAGE: {
            '[DEFAULT]': 'en-US',
          },
          APP_USER: {
            '[DEFAULT]': null,
          },
          addAuthStateListener: jest.fn(),
          addIdTokenListener: jest.fn(),
          setLanguageCode: jest.fn(() => Promise.resolve()),
          setTenantId: jest.fn(() => Promise.resolve()),
          signOut: jest.fn(() => Promise.resolve()),
          signInAnonymously: jest.fn(() => Promise.resolve({ user: null })),
          createUserWithEmailAndPassword: jest.fn(() => Promise.resolve({ user: null })),
          signInWithEmailAndPassword: jest.fn(() => Promise.resolve({ user: null })),
          signInWithCustomToken: jest.fn(() => Promise.resolve({ user: null })),
          signInWithCredential: jest.fn(() => Promise.resolve({ user: null })),
          signInWithEmailLink: jest.fn(() => Promise.resolve({ user: null })),
          signInWithProvider: jest.fn(() => Promise.resolve({ user: null })),
          signInWithPhoneNumber: jest.fn(() => Promise.resolve({ verificationId: 'test-id' })),
          verifyPhoneNumberWithMultiFactorInfo: jest.fn(() => Promise.resolve()),
          verifyPhoneNumberForMultiFactor: jest.fn(() => Promise.resolve()),
          resolveTotpSignIn: jest.fn(() => Promise.resolve({})),
          revokeToken: jest.fn(() => Promise.resolve()),
          sendPasswordResetEmail: jest.fn(() => Promise.resolve()),
          sendSignInLinkToEmail: jest.fn(() => Promise.resolve()),
          isSignInWithEmailLink: jest.fn(() => false),
          applyActionCode: jest.fn(() => Promise.resolve(null)),
          checkActionCode: jest.fn(() => Promise.resolve({})),
          confirmPasswordReset: jest.fn(() => Promise.resolve()),
          fetchSignInMethodsForEmail: jest.fn(() => Promise.resolve([])),
          verifyPasswordResetCode: jest.fn(() => Promise.resolve('')),
          useUserAccessGroup: jest.fn(() => Promise.resolve()),
          useEmulator: jest.fn(),
          getCustomAuthDomain: jest.fn(() => Promise.resolve(null)),
          configureAuthDomain: jest.fn(() => Promise.resolve()),
          delete: jest.fn(() => Promise.resolve()),
          getIdToken: jest.fn(() => Promise.resolve('mock-token')),
          getIdTokenResult: jest.fn(() => Promise.resolve({ token: 'mock-token' })),
          linkWithCredential: jest.fn(() => Promise.resolve({ user: null })),
          linkWithProvider: jest.fn(() => Promise.resolve({ user: null })),
          reauthenticateWithCredential: jest.fn(() => Promise.resolve({ user: null })),
          reauthenticateWithProvider: jest.fn(() => Promise.resolve({ user: null })),
          reload: jest.fn(() => Promise.resolve(null)),
          sendEmailVerification: jest.fn(() => Promise.resolve(null)),
          unlink: jest.fn(() => Promise.resolve(null)),
          updateEmail: jest.fn(() => Promise.resolve(null)),
          updatePassword: jest.fn(() => Promise.resolve(null)),
          updatePhoneNumber: jest.fn(() => Promise.resolve(null)),
          updateProfile: jest.fn(() => Promise.resolve(null)),
          verifyBeforeUpdateEmail: jest.fn(() => P
```

### Core Architecture Module: `metro.config.js`
```
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = require('./tests/metro.config');

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

```

### Core Architecture Module: `packages/ai/e2e/fetch.e2e.js`
```
/*
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this library except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
import { getGenerativeModel } from '../lib/index';

const fakeVertexAI = {
  app: {
    name: 'DEFAULT',
    options: {
      appId: 'appId',
      projectId: 'my-project',
      apiKey: 'key',
    },
  },
  location: 'us-central1',
  backend: 'GOOGLE_AI',
};
// See emulator setup: packages/vertexai/lib/requests/request.ts
globalThis.RNFB_VERTEXAI_EMULATOR_URL = true;

// It calls firebase functions emulator that mimics responses from VertexAI server
describe('ai()', function () {
  describe('fetch requests', function () {
    it('should fetch', async function () {
      const model = getGenerativeModel(fakeVertexAI, { model: 'gemini-3.1-flash-lite' });
      const result = await model.generateContent("What is google's mission statement?");
      const text = result.response.text();
      // See vertexAI function emulator for response
      text.should.containEql(
        'Google\'s mission is to "organize the world\'s information and make it universally accessible and useful."',
      );
    });

    it('should fetch stream', async function () {
      const model = getGenerativeModel(fakeVertexAI, { model: 'gemini-3.1-flash-lite' });
      // See vertexAI function emulator for response
      const poem = [
        'The wind whispers secrets through the trees,',
        'Rustling leaves in a gentle breeze.',
        'Sunlight dances on the grass,',
        'A fleeting moment, sure to pass.',
        'Birdsong fills the air so bright,',
        'A symphony of pure delight.',
        'Time stands still, a peaceful pause,',
        "In nature's beauty, no flaws.",
      ];
      const result = await model.generateContentStream('Write me a short poem');

      const text = [];
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        text.push(chunkText);
      }
      text.should.deepEqual(poem);
    });
  });
});

```

### Core Architecture Module: `packages/ai/lib/backend.ts`
```
/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { DEFAULT_API_VERSION, DEFAULT_LOCATION, LEGACY_DEFAULT_LOCATION } from './constants';
import { BackendType } from './public-types';

/**
 * Abstract base class representing the configuration for an AI service backend.
 * This class should not be instantiated directly. Use its subclasses; {@link GoogleAIBackend} for
 * the Gemini Developer API (via {@link https://ai.google/ | Google AI}) and {@link AgentPlatformBackend}
 * for the Agent Platform Gemini API.
 *
 * @public
 */
export abstract class Backend {
  /**
   * Specifies the backend type.
   */
  readonly backendType: BackendType;

  /**
   * Protected constructor for use by subclasses.
   * @param type - The backend type.
   */
  protected constructor(type: BackendType) {
    this.backendType = type;
  }

  /**
   * @internal
   */
  abstract _getModelPath(project: string, model: string): string;

  /**
   * @internal
   */
  abstract _getTemplatePath(project: string, templateId: string): string;
}

/**
 * Configuration class for the Gemini Developer API.
 *
 * Use this with {@link AIOptions} when initializing the AI service via
 * {@link getAI | getAI()} to specify the Gemini Developer API as the backend.
 *
 * @public
 */
export class GoogleAIBackend extends Backend {
  /**
   * Creates a configuration object for the Gemini Developer API backend.
   */
  constructor() {
    super(BackendType.GOOGLE_AI);
  }

  /**
   * @internal
   */
  _getModelPath(project: string, model: string): string {
    return `/${DEFAULT_API_VERSION}/projects/${project}/${model}`;
  }

  /**
   * @internal
   */
  _getTemplatePath(project: string, templateId: string): string {
    return `/${DEFAULT_API_VERSION}/projects/${project}/templates/${templateId}`;
  }
}

/**
 * Configuration class for the Agent Platform Gemini API (formerly known as the
 * Vertex AI Gemini API).
 *
 * Use this with {@link AIOptions} when initializing the AI service via
 * {@link getAI | getAI()} to specify the Agent Platform Gemini API as the backend.
 *
 * @deprecated Use {@link AgentPlatformBackend} instead.
 *
 * @public
 */
export class VertexAIBackend extends Backend {
  /**
   * The region identifier.
   * See {@link https://firebase.google.com/docs/ai-logic/locations?api=vertex#available-locations | Agent Platform Gemini API locations}
   * for a list of supported locations.
   */
  readonly location: string = LEGACY_DEFAULT_LOCATION;

  /**
   * Creates a configuration object for the Agent Platform Gemini API (formerly
   * known as the Vertex AI Gemini API) backend.
   *
   * @param location - The region identifier, defaulting to `us-central1`;
   * see {@link https://firebase.google.com/docs/ai-logic/locations?api=vertex#available-locations | Agent Platform Gemini API locations}
   * for a list of supported locations.
   */
  constructor(location?: string) {
    super(BackendType.VERTEX_AI);
    if (location) {
      this.location = location;
    }
  }

  /**
   * @internal
   */
  _getModelPath(project: string, model: string): string {
    return `/${DEFAULT_API_VERSION}/projects/${project}/locations/${this.location}/${model}`;
  }

  /**
   * @internal
   */
  _getTemplatePath(project: string, templateId: string): string {
    return `/${DEFAULT_API_VERSION}/projects/${project}/locations/${this.location}/templates/${templateId}`;
  }
}

/**
 * Configuration class for the Agent Platform Gemini API.
 *
 * Use this with {@link AIOptions} when initializing the AI service via
 * {@link getAI | getAI()} to specify the Agent Platform Gemini API as the backend.
 *
 * @public
 */
export class AgentPlatformBackend extends Backend {
  /**
   * The region identifier.
   * See {@link https://firebase.google.com/docs/ai-logic/locations?api=vertex#available-locations | Agent Platform locations}
   * for a list of supported locations.
   */
  readonly location: string = DEFAULT_LOCATION;

  /**
   * Creates a configuration object for the Agent Platform backend.
   *
   * @param location - The region identifier, defaulting to `global`;
   * see {@link https://firebase.google.com/docs/ai-logic/locations?api=vertex#available-locations | Agent Platform locations}
   * for a list of supported locations.
   */
  constructor(location?: string) {
    super(BackendType.AGENT_PLATFORM);
    if (location) {
      this.location = location;
    }
  }

  /**
   * @internal
   */
  _getModelPath(project: string, model: string): string {
    return `/${DEFAULT_API_VERSION}/projects/${project}/locations/${this.location}/${model}`;
  }

  /**
   * @internal
   */
  _getTemplatePath(project: string, templateId: string): string {
    return `/${DEFAULT_API_VERSION}/projects/${project}/locations/${this.location}/templates/${templateId}`;
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9352** (2026-09-30): **fix(messaging): detect the iOS APNs environment from the provisioning profile**
  *Symptoms*: - Fixes #9348  Release builds signed with an Apple Development profile registered the APNs token as production, because the type came from `DEBUG`. FCM then returned `BadDeviceToken`.  `didRegisterForRemoteNotificationsWithDeviceToken:` now passes `FIRMessagingAPNSTokenTypeUnknown`. Firebase documents that `UNKNOWN` is how Messaging figures the token type out from the provisioning profile: https://firebase.google.com/docs/reference/ios/firebasemessaging/api/reference/Enums/FIRMessagingAPNSTokenType  - Debug plus development signing stays sandbox - Release plus App Store, TestFlight, or Ad Hoc stays production - Release plus development signing registers sandbox - No public API or config change. A new FCM token is requested only when that classification flips  --- Maintainer note: Fixes internal CPRN-543
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/invertase/react-native-firebase/pull/9352?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=invertase) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 69.83%. Comparing base ([`c904808`](https://app.codecov.io/gh/invertase/react-native-firebase/commit/c904808614e93d1daf7427b34a1c1b49488a4e00?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=invertase)) to head ([`fdefca8`](https://app.codecov.io/gh/invertase/react-native-firebase/commit/fdefca8acdcb123dd2ae7d3e65066b4bbc7daaed?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=invertase)).  <details><summary>Additional details and impacted files</summary>    ```diff @@             Coverage Diff              @@ ##          

- **Issue #9351** (2026-09-30): **feat: Xcode 27 / iOS 27 and UIScene compatibility**
  *Symptoms*: ## Summary - Ratchet mobile fixtures to RN **0.88.0-rc.3** / React **19.3** / Expo **58**, migrate Detox + bare to single-scene UIScene, and prove Expo 58 scene/Firebase ownership with required launch smokes. - Port iOS e2e automation to selected-Xcode **Device Hub** + explicit **iOS 27** UDIDs; pin Apple CI to **`macos-27`** with `configure-apple-ci.sh` (stable Xcode major 27). - Document Xcode 27 support; temporarily suspend Tart lab path. Local V1: iOS/Android full covers green; **macOS Jet e2e currently hangs** after Jet listen (investigation ongoing; draft opened under maintainer override of D10).  ## Test plan - [ ] Hosted `macos-27` / Xcode 27 CI: Detox iOS, archive, Expo link+launch-smoke, bare build+launch-smoke - [ ] Confirm Device Hub path on runners (no `open -a Simulator`) - [ ] Local follow-up: unblock macOS Jet slot-1 `:test-cover` hang - [ ] Maintainer review of UIScene / config-plugin / CI path-filter surface  --- Maintainer note: Fixes internal CPRN-545
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/invertase/react-native-firebase/pull/9351?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=invertase) Report :x: Patch coverage is `73.33333%` with `16 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 69.99%. Comparing base ([`c904808`](https://app.codecov.io/gh/invertase/react-native-firebase/commit/c904808614e93d1daf7427b34a1c1b49488a4e00?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=invertase)) to head ([`d6e6e5a`](https://app.codecov.io/gh/invertase/react-native-firebase/commit/d6e6e5a52b054721e93c76b972a1dec089fc40e2?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=invertase)). :warning: Report is 1 commits behind head on main.  <details><summary>Additional details and impacted files</s

- **Issue #9348** (2026-09-30): **[messaging][ios] APNs token type is inferred from DEBUG instead of the signed APNs environment**
  *Symptoms*: ## Issue  On iOS, `@react-native-firebase/messaging` currently determines the APNs token type from the `DEBUG` compilation macro in `RNFBMessaging+AppDelegate.m`:  ```objc #ifdef DEBUG   [[FIRMessaging messaging] setAPNSToken:deviceToken                                     type:FIRMessagingAPNSTokenTypeSandbox]; #else   [[FIRMessaging messaging] setAPNSToken:deviceToken                                     type:FIRMessagingAPNSTokenTypeProd]; #endif ```  This assumes that:  ```text DEBUG defined     == APNs sandbox DEBUG not defined == APNs production ```  However, the build configuration / `DEBUG` macro and the APNs environment of the signed application are independent.  A valid Release build can be signed using Apple Development provisioning and therefore have:  ```text aps-environment = development ```  while `DEBUG` is not defined.  I reproduced this configuration on a physical iPhone.  ### Reproduction  Environment used for the runtime reproduction:  ```text @react-native-firebase/messaging: 21.14.0 Firebase Messaging iOS SDK: 11.11.0 GoogleUtilities: 8.1.0 Xcode: 27.0 Device: iPhone 16e iOS: 26.5 ```  The application was:  ```text Build configuration: Release Signing: Apple Development Signed aps-environment: development DEBUG macro in RNFBMessaging: not defined FirebaseAppDelegateProxyEnabled: not explicitly disabled ```  The signed application entitlement was verified from the built `.app`, rather than inferred from the Xcode build configuration.  With the standard RNF

- **Issue #9346** (2026-09-30): **build(deps): bump ruby/setup-ruby from 1.321.0 to 1.325.0**
  *Symptoms*: Bumps [ruby/setup-ruby](https://github.com/ruby/setup-ruby) from 1.321.0 to 1.325.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/ruby/setup-ruby/releases">ruby/setup-ruby's releases</a>.</em></p> <blockquote> <h2>v1.325.0</h2> <h2>What's Changed</h2> <ul> <li>Add jruby-10.0.7.0,jruby-10.1.2.0 by <a href="https://github.com/ruby-builder-bot"><code>@​ruby-builder-bot</code></a> in <a href="https://redirect.github.com/ruby/setup-ruby/pull/939">ruby/setup-ruby#939</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/ruby/setup-ruby/compare/v1.324.0...v1.325.0">https://github.com/ruby/setup-ruby/compare/v1.324.0...v1.325.0</a></p> <h2>v1.324.0</h2> <h2>What's Changed</h2> <ul> <li>Add truffleruby-40.0.0,truffleruby+graalvm-40.0.0 by <a href="https://github.com/ruby-builder-bot"><code>@​ruby-builder-bot</code></a> in <a href="https://redirect.github.com/ruby/setup-ruby/pull/938">ruby/setup-ruby#938</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/ruby/setup-ruby/compare/v1.323.0...v1.324.0">https://github.com/ruby/setup-ruby/compare/v1.323.0...v1.324.0</a></p> <h2>v1.323.0</h2> <h2>What's Changed</h2> <ul> <li>Update CRuby releases on Windows by <a href="https://github.com/ruby-builder-bot"><code>@​ruby-builder-bot</code></a> in <a href="https://redirect.github.com/ruby/setup-ruby/pull/937">ruby/setup-ruby#937</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://git
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/invertase/react-native-firebase?pullRequest=9346) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla-assistant.io/invertase/react-native-firebase?pullRequest=9346) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/invertase/react-native-firebase?pullRequest=9346) it.</sub>
  > Superseded by #9350.
  > In order to prioritize work in this repository, closed issues and pull requests do not regularly receive attention.  If the underlying issue or pull request still requires attention, opening a new issue with a reproduction after testing with current versions, or reposting the pull request as a new PR may be the most effective way forward.

- **Issue #9343** (2026-09-29): **fix(app, storage): link Photos framework on tvOS**
  *Symptoms*: - Fixes #9342  tvOS builds fail with undefined `PHAsset` after `RNFBUtilsModule` moved to `.mm`, which no longer autolinks Photos. PhotoKit is available on tvOS 10+, so the app and storage podspecs now link it there too.  --- Maintainer note: Fixes internal CPRN-524
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/invertase/react-native-firebase/pull/9343?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=invertase) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 69.37%. Comparing base ([`dce165d`](https://app.codecov.io/gh/invertase/react-native-firebase/commit/dce165d7283a30060c5b08066cf5841d9247105a?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=invertase)) to head ([`e296e2f`](https://app.codecov.io/gh/invertase/react-native-firebase/commit/e296e2f94a482e25493ada381b0a659f162f4afb?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=invertase)).  <details><summary>Additional details and impacted files</summary>    ```diff @@             Coverage Diff              @@ ##          

- **Issue #9342** (2026-09-29): **[🐛] [tvOS] app 26.4.0: undefined symbol PHAsset — Photos framework no longer autolinked after .m → .mm**
  *Symptoms*: ## Issue  Hi, I am getting exactly the same error as https://github.com/invertase/react-native-firebase/issues/9136 but on tvOS 27, using Xcode 27. It works fine after adding `s.tvos.frameworks = 'Photos'` in the RNFBApp.podspec. Photokit definitely should be available on tvOS as well, see: https://developer.apple.com/documentation/photokit   Tested using react-native-tvos 0.87.1-1   
  **Post-Mortem & Fix Analysis**:
  > Hey @viljamik, thanks for the report, and for confirming the podspec line.  You're right that PhotoKit is on tvOS. `RNFBUtilsModule.mm` uses `PHAsset`, and after the move to `.mm` it no longer autolinks Photos. The podspec only declared it for iOS and macOS. Fix is up in #9343, including the same link on storage.

- **Issue #9341** (2026-09-29): **ci(testing): clear small e2e and docs-lint friction**
  *Symptoms*: Three small maintainer-tooling fixes, one commit each.  - `yarn test-expo:ios:link` needs full network up front. The CocoaPods CDN returns 403 in the default agent sandbox, and the sandbox note only covered a missing exit status. - A killed `yarn tests:emulator:start` left the functions build lock behind, so the next start waited 300s. A lock whose holder pid is gone is removed. Manual remove is in the e2e recovery section. - `yarn lint:markdown:fix` runs Prettier write on `docs/**/*.mdx`. Spellcheck already fails on unparseable frontmatter via `scripts/spellcheck.mjs`.  --- Maintainer note: Fixes internal CPRN-399 Maintainer note: Fixes internal CPRN-396 Maintainer note: Fixes internal CPRN-398
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/invertase/react-native-firebase/pull/9341?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=invertase) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 69.81%. Comparing base ([`dce165d`](https://app.codecov.io/gh/invertase/react-native-firebase/commit/dce165d7283a30060c5b08066cf5841d9247105a?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=invertase)) to head ([`1de8382`](https://app.codecov.io/gh/invertase/react-native-firebase/commit/1de838202fe2cde863a21314cfaeaf49743f2877?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=invertase)).  <details><summary>Additional details and impacted files</summary>    ```diff @@             Coverage Diff              @@ ##          

- **Issue #9338** (2026-09-28): **build(deps): bump ruby/setup-ruby from 1.321.0 to 1.324.0**
  *Symptoms*: Bumps [ruby/setup-ruby](https://github.com/ruby/setup-ruby) from 1.321.0 to 1.324.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/ruby/setup-ruby/releases">ruby/setup-ruby's releases</a>.</em></p> <blockquote> <h2>v1.324.0</h2> <h2>What's Changed</h2> <ul> <li>Add truffleruby-40.0.0,truffleruby+graalvm-40.0.0 by <a href="https://github.com/ruby-builder-bot"><code>@​ruby-builder-bot</code></a> in <a href="https://redirect.github.com/ruby/setup-ruby/pull/938">ruby/setup-ruby#938</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/ruby/setup-ruby/compare/v1.323.0...v1.324.0">https://github.com/ruby/setup-ruby/compare/v1.323.0...v1.324.0</a></p> <h2>v1.323.0</h2> <h2>What's Changed</h2> <ul> <li>Update CRuby releases on Windows by <a href="https://github.com/ruby-builder-bot"><code>@​ruby-builder-bot</code></a> in <a href="https://redirect.github.com/ruby/setup-ruby/pull/937">ruby/setup-ruby#937</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/ruby/setup-ruby/compare/v1.322.0...v1.323.0">https://github.com/ruby/setup-ruby/compare/v1.322.0...v1.323.0</a></p> <h2>v1.322.0</h2> <h2>What's Changed</h2> <ul> <li>Add ruby-4.0.7 by <a href="https://github.com/ruby-builder-bot"><code>@​ruby-builder-bot</code></a> in <a href="https://redirect.github.com/ruby/setup-ruby/pull/936">ruby/setup-ruby#936</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/ruby/setup-
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/invertase/react-native-firebase?pullRequest=9338) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla-assistant.io/invertase/react-native-firebase?pullRequest=9338) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/invertase/react-native-firebase?pullRequest=9338) it.</sub>
  > Superseded by #9346.
  > In order to prioritize work in this repository, closed issues and pull requests do not regularly receive attention.  If the underlying issue or pull request still requires attention, opening a new issue with a reproduction after testing with current versions, or reposting the pull request as a new PR may be the most effective way forward.

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

### Incident Patch 1: `c1471450` (2026-09-30)
**Commit Message**: fix(app-check): drop the unused indent fallback

The capture is always a string, including empty, so the nullish branch
could not run.

**File**: `packages/app-check/plugin/src/ios/appDelegate.ts` (modified, +1/-1)
```diff
@@ -131,7 +131,7 @@ export function modifySwiftAppDelegate(contents: string): string {
   // run before that call. Do not append a second FirebaseApp.configure().
   const existingConfigure = /^([ \t]*)FirebaseApp\.configure\(\)/m.exec(contents);
   if (existingConfigure) {
-    const indent = existingConfigure[1] ?? '';
+    const indent = existingConfigure[1];
     return contents.replace(
       existingConfigure[0],
       `${indent}RNFBAppCheckModule.sharedInstance()\n${existingConfigure[0]}`,
```

---

### Incident Patch 2: `f366a640` (2026-09-30)
**Commit Message**: fix(app-check): install the provider factory before configure

Expo 58 scene AppDelegates have no factory.startReactNative, so the Swift
plugin skipped them. When configure was already present it also appended a
second FirebaseApp.configure() after the factory. Match the test app: one
sharedInstance, then a single configure.

**File**: `.github/workflows/scripts/test-expo-ios-link.sh` (modified, +11/-1)
```diff
@@ -76,6 +76,16 @@ if [[ "$firebase_configure_count" -ne 1 ]]; then
   log "ERROR: expected exactly one FirebaseApp.configure() in AppDelegate, found ${firebase_configure_count}"
   exit 1
 fi
+if ! grep -q 'RNFBAppCheckModule.sharedInstance()' "$APP_DELEGATE"; then
+  log "ERROR: App Check provider factory missing from AppDelegate (scene AppDelegate anchor was not found)"
+  exit 1
+fi
+factory_line="$(grep -n 'RNFBAppCheckModule.sharedInstance()' "$APP_DELEGATE" | head -1 | cut -d: -f1)"
+configure_line="$(grep -n 'FirebaseApp.configure()' "$APP_DELEGATE" | head -1 | cut -d: -f1)"
+if [[ -z "$factory_line" || -z "$configure_line" || "$factory_line" -gt "$configure_line" ]]; then
+  log "ERROR: App Check provider factory must be registered before FirebaseApp.configure() (factory line ${factory_line:-missing}, configure line ${configure_line:-missing})"
+  exit 1
+fi
 if ! awk '/UIApplicationSupportsMultipleScenes/{getline; if ($0 ~ /<false\/>/) found=1} END{exit !found}' "$INFO_PLIST"; then
   log "ERROR: UIApplicationSupportsMultipleScenes is not false (single-scene contract)"
   exit 1
@@ -84,7 +94,7 @@ if ! grep -q 'UISceneDelegateClassName' "$INFO_PLIST"; then
   log "ERROR: Info.plist missing UIScene manifest entries"
   exit 1
 fi
-log "PASS: Expo owns SceneDelegate; RNFB configures Firebase once in AppDelegate; single-scene manifest"
+log "PASS: Expo owns SceneDelegate; RNFB configures Firebase once in AppDelegate after App Check; single-scene manifest"
 log "--- end Expo 58 UIScene / RNFB plugin contract ---"
 
 # Diagnosis: did #9164's rnfirebase_add_spm_core_to_app_target run during
```

**File**: `packages/app-check/plugin/__tests__/fixtures/AppDelegate_sdk58.swift` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+internal import Expo
+import React
+import ReactAppDependencyProvider
+
+@main
+class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {
+  var window: UIWindow?
+
+  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
+  var reactNativeFactory: RCTReactNativeFactory?
+
+  public override func application(
+    _ application: UIApplication,
+    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
+  ) -> Bool {
+    let delegate = ReactNativeDelegate()
+    let factory = ExpoReactNativeFactory(delegate: delegate)
+    delegate.dependencyProvider = RCTAppDependencyProvider()
+
+    reactNativeDelegate = delegate
+    reactNativeFactory = factory
+
+    // The window is created and React Native is started by `SceneDelegate` under the
+    // scene-based life cycle (required by the iOS 27 SDK).
+    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
+  }
+}
```

**File**: `packages/app-check/plugin/__tests__/iosPlugin.test.ts` (modified, +50/-0)
```diff
@@ -207,4 +207,54 @@ class AppDelegate: ExpoAppDelegate {
     const secondImportCount = (twiceModifiedContents.match(/import RNFBAppCheck/g) || []).length;
     expect(secondImportCount).toBe(0);
   });
+
+  it('registers App Check before configure on an Expo 58 scene AppDelegate', async function () {
+    const appDelegate = await fs.readFile(
+      path.join(__dirname, './fixtures/AppDelegate_sdk58.swift'),
+      { encoding: 'utf8' },
+    );
+    const result = modifySwiftAppDelegate(appDelegate);
+    const factoryIndex = result.indexOf('RNFBAppCheckModule.sharedInstance()');
+    const configureIndex = result.indexOf('FirebaseApp.configure()');
+    const returnIndex = result.indexOf(
+      'return super.application(application, didFinishLaunchingWithOptions: launchOptions)',
+    );
+
+    expect(factoryIndex).toBeGreaterThan(-1);
+    expect(configureIndex).toBeGreaterThan(factoryIndex);
+    expect(returnIndex).toBeGreaterThan(configureIndex);
+    expect(result.match(/FirebaseApp\.configure\(\)/g)).toHaveLength(1);
+
+    const twice = modifySwiftAppDelegate(result);
+    expect(twice.match(/RNFBAppCheckModule\.sharedInstance\(\)/g)).toHaveLength(1);
+    expect(twice.match(/FirebaseApp\.configure\(\)/g)).toHaveLength(1);
+  });
+
+  it('inserts the App Check factory before an existing configure without a second call', function () {
+    const appDelegate = `import Expo
+import FirebaseCore
+
+class AppDelegate: ExpoAppDelegate {
+  public override func application(
+    _ application: UIApplication,
+    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
+  ) -> Bool {
+// @generated begin @react-native-firebase/app-didFinishLaunchingWithOptions
+FirebaseApp.configure()
+// @generated end @react-native-firebase/app-didFinishLaunchingWithOptions
+    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
+  }
+}
+`;
+    const result = modifySwiftAppDelegate(appDelegate);
+    const factoryIndex = result.indexOf('RNFBAppCheckModule.sharedInstance()');
+    const configureIndex = result.indexOf('FirebaseApp.configure()');
+
+    expect(factoryIndex).toBeGreaterThan(-1);
+    expect(configureIndex).toBeGreaterThan(factoryIndex);
+    expect(result.match(/FirebaseApp\.configure\(\)/g)).toHaveLength(1);
+    expect(result).toContain(
+      '// @generated end @react-native-firebase/app-didFinishLaunchingWithOptions',
+    );
+  });
 });
```

**File**: `packages/app-check/plugin/src/ios/appDelegate.ts` (modified, +13/-14)
```diff
@@ -127,27 +127,26 @@ export function modifySwiftAppDelegate(contents: string): string {
     return contents;
   }
 
-  // Find the Firebase initialization end line to insert after
-  const firebaseLine = '// @generated end @react-native-firebase/app-didFinishLaunchingWithOptions';
-
-  if (contents.includes(firebaseLine)) {
-    // Insert right after Firebase initialization
+  // App plugin (or an earlier pass) already calls configure. The provider factory must
+  // run before that call. Do not append a second FirebaseApp.configure().
+  const existingConfigure = /^([ \t]*)FirebaseApp\.configure\(\)/m.exec(contents);
+  if (existingConfigure) {
+    const indent = existingConfigure[1] ?? '';
     return contents.replace(
-      firebaseLine,
-      `${firebaseLine}
-        RNFBAppCheckModule.sharedInstance()
-        FirebaseApp.configure()
-      `,
+      existingConfigure[0],
+      `${indent}RNFBAppCheckModule.sharedInstance()\n${existingConfigure[0]}`,
     );
   }
 
-  // If Firebase initialization block not found, register the App Check provider factory
-  // then call FirebaseApp.configure(). Firebase requires the factory before configure
-  // (AppCheck-AD-3); do not reverse this order.
+  // No configure yet. Register the factory, then configure. Firebase requires the
+  // factory before configure (AppCheck-AD-3). Expo 58 scene AppDelegates start
+  // React Native from SceneDelegate, so the anchor is the didFinishLaunching return
+  // rather than factory.startReactNative.
   const methodInvocationBlock = `RNFBAppCheckModule.sharedInstance()
     FirebaseApp.configure()`;
 
-  const methodInvocationLineMatcher = /(?:factory\.startReactNative\()/;
+  const methodInvocationLineMatcher =
+    /(?:factory\.startReactNative\()|(?:return\s+super\.application\(\s*application\s*,\s*didFinishLaunchingWithOptions:\s*launchOptions\s*\))/;
 
   if (!methodInvocationLineMatcher.test(contents)) {
     WarningAggregator.addWarningIOS(
```

---

### Incident Patch 3: `9c636307` (2026-09-30)
**Commit Message**: fix(ci): unblock Yarn hardened CI and Xcode 27 iOS archive

Widen the app react-native peer so it no longer coalesces with the
RC pin under public-PR hardened mode, keep @types/react-native for
package builds, type the vendor EventEmitter import, and fail-fast
when slotted macOS Metro babel misses a non-default Jet port.

Use the GitHub `xcode-27` runner label (not `macos-27`), pin Xcode
`27.0` (latest-stable floated to 27.1 beta), and bump iOS Pods/ccache
keys so restore cannot reuse pre-0.88 hermes Local Podspecs or
objects from the 27.1 beta window. Drop LD/LDPLUSPLUS from the iOS
Release Archive (Xcode 27 Swift SPM links reject clang as LD with
-emit-library). Re-pin serial Jet/Metro env after sanitize; skip the
serial-8090 babel assert (DEFAULT_JET_SERIAL covers it). Retry
xcodebuild -version to avoid Broken-pipe aborts under concurrent load.
Cap test-expo launch-smoke xcodebuild so a hang cannot burn the job.

**File**: `.github/workflows/publish.yml` (modified, +3/-3)
```diff
@@ -8,13 +8,13 @@ jobs:
     if: "(github.repository == 'invertase/react-native-firebase') && (github.event_name == 'workflow_dispatch')"
     name: 'NPM'
     timeout-minutes: 60
-    runs-on: macos-27
+    runs-on: xcode-27
     permissions:
       id-token: write # enables OIDC for npmjs.com "Trusted Publisher" and provenance
       contents: read
     env:
-      # macos-27 + latest-stable matches tests_e2e_ios.yml; needed for CocoaPods in scripts/version.js
-      XCODE_VERSION: latest-stable
+      # xcode-27 runner (macOS 27) + 27.0 pin matches tests_e2e_ios.yml; needed for CocoaPods in scripts/version.js
+      XCODE_VERSION: '27.0'
       RNFB_CI_REQUIRE_IOS_SIM_RUNTIME: '0'
     steps:
       # https://github.com/actions/checkout/releases
```

**File**: `.github/workflows/scripts/configure-apple-ci.sh` (modified, +25/-6)
```diff
@@ -21,15 +21,34 @@ selector="${RNFB_CI_XCODE_SELECTOR:-${XCODE_VERSION:-latest-stable}}"
 
 log "selector=${selector} require_ios_sim_runtime=${require_runtime}"
 
-xcodebuild -version | sed 's/^/[configure-apple-ci] /'
-
-xcode_line="$(xcodebuild -version | head -1)"
-if echo "$xcode_line" | grep -qi beta; then
+# Capture xcodebuild -version to a var first. Piping directly into sed has crashed
+# concurrent Apple CI jobs on Xcode 27 images with NSFileHandle Broken pipe (exit 134).
+xcode_version_out=""
+for _try in 1 2 3; do
+  if xcode_version_out="$(xcodebuild -version 2>&1)"; then
+    break
+  fi
+  log "xcodebuild -version failed (attempt ${_try}); retrying..."
+  sleep 2
+done
+[[ -n "$xcode_version_out" ]] || fail "xcodebuild -version failed after retries"
+echo "$xcode_version_out" | sed 's/^/[configure-apple-ci] /'
+
+xcode_line="$(printf '%s\n' "$xcode_version_out" | head -1)"
+dev_dir="$(xcode-select -p 2>/dev/null || true)"
+if echo "$xcode_line" | grep -qiE 'beta'; then
   fail "refusing beta Xcode on Apple CI: ${xcode_line}"
 fi
+# GitHub's 27.0 image may still live under Xcode_*_Release_Candidate.app until GA; only refuse
+# explicitly beta-suffixed installs (e.g. Xcode_27.1_beta.app selected via latest-stable).
+if [[ "$dev_dir" == *_beta* ]]; then
+  fail "refusing beta Xcode path on Apple CI: ${dev_dir}"
+fi
 
-major="$(sed -E 's/Xcode ([0-9]+).*/\1/' <<<"$xcode_line")"
-[[ "$major" == "27" ]] || fail "expected stable Xcode major 27, got major=${major} (${xcode_line})"
+# D6: pin the 27.0 line (latest-stable on xcode-27 images may float to 27.1 beta).
+major_minor="$(sed -E 's/Xcode ([0-9]+\.[0-9]+).*/\1/' <<<"$xcode_line")"
+[[ "$major_minor" == "27.0" ]] || fail "expected stable Xcode 27.0.x, got ${xcode_line} (path=${dev_dir})"
+major="27"
 
 if [[ "$require_runtime" == "1" ]]; then
   runtime_label="$(rnfb_ios_sim_runtime_label)"
```

**File**: `.github/workflows/scripts/test-expo-ios-launch-smoke.sh` (modified, +47/-12)
```diff
@@ -85,20 +85,55 @@ xcrun simctl boot "$UDID" 2>/dev/null || true
 xcrun simctl bootstatus "$UDID" -b >/dev/null
 
 log "xcodebuild Debug (simulator ${UDID}, log: ${XCODEBUILD_LOG})"
+# Cap compile time: prior CI run sat silent after ~18m of xcodebuild env spam until the
+# 60m job timeout. Prefer GNU timeout when present; otherwise perl alarm.
+XCODEBUILD_TIMEOUT_SEC="${RNFB_TEST_EXPO_XCODEBUILD_TIMEOUT_SEC:-2400}"
 set +e
-xcodebuild \
-  ARCHS="$HOST_ARCH" \
-  ONLY_ACTIVE_ARCH=YES \
-  -workspace "$WORKSPACE" \
-  -scheme "$XCODE_SCHEME" \
-  -configuration Debug \
-  -destination "id=${UDID}" \
-  CODE_SIGNING_ALLOWED=NO \
-  CODE_SIGNING_REQUIRED=NO \
-  CODE_SIGN_IDENTITY="" \
-  build 2>&1 | tee "$XCODEBUILD_LOG"
-xcodebuild_status=${PIPESTATUS[0]}
+if command -v gtimeout >/dev/null 2>&1; then
+  gtimeout "$XCODEBUILD_TIMEOUT_SEC" xcodebuild \
+    ARCHS="$HOST_ARCH" \
+    ONLY_ACTIVE_ARCH=YES \
+    -workspace "$WORKSPACE" \
+    -scheme "$XCODE_SCHEME" \
+    -configuration Debug \
+    -destination "id=${UDID}" \
+    CODE_SIGNING_ALLOWED=NO \
+    CODE_SIGNING_REQUIRED=NO \
+    CODE_SIGN_IDENTITY="" \
+    build 2>&1 | tee "$XCODEBUILD_LOG"
+  xcodebuild_status=${PIPESTATUS[0]}
+elif command -v timeout >/dev/null 2>&1; then
+  timeout "$XCODEBUILD_TIMEOUT_SEC" xcodebuild \
+    ARCHS="$HOST_ARCH" \
+    ONLY_ACTIVE_ARCH=YES \
+    -workspace "$WORKSPACE" \
+    -scheme "$XCODE_SCHEME" \
+    -configuration Debug \
+    -destination "id=${UDID}" \
+    CODE_SIGNING_ALLOWED=NO \
+    CODE_SIGNING_REQUIRED=NO \
+    CODE_SIGN_IDENTITY="" \
+    build 2>&1 | tee "$XCODEBUILD_LOG"
+  xcodebuild_status=${PIPESTATUS[0]}
+else
+  perl -e 'alarm shift; exec @ARGV' "$XCODEBUILD_TIMEOUT_SEC" \
+    xcodebuild \
+    ARCHS="$HOST_ARCH" \
+    ONLY_ACTIVE_ARCH=YES \
+    -workspace "$WORKSPACE" \
+    -scheme "$XCODE_SCHEME" \
+    -configuration Debug \
+    -destination "id=${UDID}" \
+    CODE_SIGNING_ALLOWED=NO \
+    CODE_SIGNING_REQUIRED=NO \
+    CODE_SIGN_IDENTITY="" \
+    build 2>&1 | tee "$XCODEBUILD_LOG"
+  xcodebuild_status=${PIPESTATUS[0]}
+fi
 set -e
+if [[ "$xcodebuild_status" -eq 124 || "$xcodebuild_status" -eq 142 ]]; then
+  fail "xcodebuild Debug timed out after ${XCODEBUILD_TIMEOUT_SEC}s (log: ${XCODEBUILD_LOG})"
+fi
 [[ "$xcodebuild_status" -eq 0 ]] || fail "xcodebuild Debug failed (exit ${xcodebuild_status})"
 
 APP="$(
```

**File**: `.github/workflows/scripts/verify-ios-release-archive.sh` (modified, +19/-4)
```diff
@@ -39,9 +39,16 @@ rm -rf "$ARCHIVE_PATH"
 
 log "archiving scheme=${SCHEME} configuration=${CONFIGURATION} destination=generic/platform=iOS (unsigned) -> ${ARCHIVE_PATH}"
 
+# Compile via PATH `clang` so hendrikmuhs/ccache-action wrappers (/usr/local/bin/clang
+# -> ccache) still accelerate ObjC/C++. Do NOT set LD/LDPLUSPLUS at all: under Xcode 27
+# the Swift driver reuses LD for SPM product links (FirebaseSharedSwift) and passes
+# swiftc-style flags (-emit-library, -sdk, -Xclang-linker) that clang rejects.
+RAW_LOG="$(mktemp -t rnfb-ios-archive.XXXXXX)"
+trap 'rm -f "$RAW_LOG"' EXIT
+
 set -o pipefail
-xcodebuild archive \
-  CC=clang CPLUSPLUS=clang++ LD=clang LDPLUSPLUS=clang++ \
+if ! xcodebuild archive \
+  CC=clang CPLUSPLUS=clang++ \
   -workspace "$WORKSPACE" \
   -scheme "$SCHEME" \
   -configuration "$CONFIGURATION" \
@@ -51,8 +58,16 @@ xcodebuild archive \
   CODE_SIGNING_REQUIRED=NO \
   CODE_SIGNING_ALLOWED=NO \
   CODE_SIGN_ENTITLEMENTS="" \
-  | xcbeautify
-
+  2>&1 | tee "$RAW_LOG" | xcbeautify; then
+  log "ERROR: xcodebuild archive failed; filtered diagnostics:"
+  # shellcheck disable=SC2002
+  grep -E 'error:|fatal error|Undefined symbols|ld: |clang: error|SwiftDriver|ARCHIVE FAILED|The following build commands failed' "$RAW_LOG" \
+    | sed 's/^/[ios-release-archive]   /' \
+    | tail -n 80 || true
+  log "ERROR: last 40 lines of raw xcodebuild output:"
+  tail -n 40 "$RAW_LOG" | sed 's/^/[ios-release-archive]   /'
+  exit 1
+fi
 APP_DIR="$(find "${ARCHIVE_PATH}/Products/Applications" -maxdepth 1 -name '*.app' 2>/dev/null | head -1)"
 if [[ -z "$APP_DIR" || ! -d "$APP_DIR" ]]; then
   log "ERROR: no .app product found under ${ARCHIVE_PATH}/Products/Applications"
```

**File**: `.github/workflows/test_expo_ios_link.yml` (modified, +2/-2)
```diff
@@ -50,10 +50,10 @@ concurrency:
 jobs:
   test-expo-ios-link:
     name: test-expo iOS link + launch smoke
-    runs-on: macos-27
+    runs-on: xcode-27
     timeout-minutes: 60
     env:
-      XCODE_VERSION: latest-stable
+      XCODE_VERSION: '27.0'
       RNFB_IOS_SIM_RUNTIME: iOS 27.0
     steps:
       # https://github.com/actions/checkout/releases
```

---

### Incident Patch 4: `6b13c9d4` (2026-09-30)
**Commit Message**: fix(app): restore vendor EventEmitter for RN macOS 0.78

Public react-native EventEmitter is missing on macOS 0.78, so the
test app crashed before Jet connected after the 0.88 ratchet.

**File**: `packages/app/lib/internal/SharedEventEmitter.ts` (modified, +2/-1)
```diff
@@ -15,7 +15,8 @@
  *
  */
 
-import { EventEmitter } from 'react-native';
+// RN macOS 0.78 does not export EventEmitter from the public API; vendor path works on 0.78–0.88.
+import EventEmitter from 'react-native/Libraries/vendor/emitter/EventEmitter';
 import type { ReactNativeFirebaseEventEmitter } from '../types/internal';
 
 const emitter = new EventEmitter() as ReactNativeFirebaseEventEmitter;
```

**File**: `tests-macos/.jetrc.js` (modified, +2/-2)
```diff
@@ -206,8 +206,8 @@ module.exports = {
             JET_REMOTE_PORT: String(jetPort),
           },
         });
-        macApp.on('close', code => {
-          if (code === 0) {
+        macApp.on('close', (code, signal) => {
+          if (code === 0 || (code == null && signal)) {
             return;
           }
           if (macOsRetries < 3) {
```

---

### Incident Patch 5: `e0e27c09` (2026-09-30)
**Commit Message**: test: pin clang-format 1.7 for arm64 and fix bare Firebase plist

**File**: `.github/workflows/scripts/test-rn-bare-ios-launch-smoke.sh` (modified, +9/-0)
```diff
@@ -121,6 +121,15 @@ if [[ -n "$scene_ips" ]]; then
   fail "scene lifecycle runtime issue detected — see ${APP_LOG}"
 fi
 if ! grep -Fq 'Window did become application key' "$APP_LOG"; then
+  firebase_hint="$(
+    grep -Ei 'Firebase|FIRApp|GOOGLE_APP_ID|FirebaseApp\.configure|Configuration fails|terminated due to signal|abort\(\)' "$APP_LOG" \
+      | grep -Ev '^Filtering the log data using' \
+      | tail -8 \
+      || true
+  )"
+  if [[ -n "$firebase_hint" ]]; then
+    fail "app window never became key (Firebase/init crash likely) — log excerpt: ${firebase_hint} — full log: ${APP_LOG}"
+  fi
   fail "app window never became key — see ${APP_LOG}"
 fi
 if ! grep -Fq "sceneOfRecord: sceneID: sceneID:${BUNDLE_ID}-default" "$APP_LOG"; then
```

**File**: `okf-bundle/testing/validation-checklist.md` (modified, +1/-1)
```diff
@@ -146,7 +146,7 @@ Run **only** the scripts whose trees are in the diff (exit 0). Do not run the re
 | `packages/**` or `test-expo/**` JS/TS | `yarn lint:js` | ESLint `packages/*` and `test-expo/` (one script; do not invent a `test-expo` lint entrypoint). Implementation may `yarn lint:js --fix` then re-run until clean. Prefer that over `yarn format:js`. A flood under `packages/app/__tests__/vendor/` is local Bundler vendor, not product lint. Do not treat it as the lint gate. [Agent command policy § JS lint / Bundler vendor](agent-command-policy.md#js-lint-bundler-vendor). |
 | `packages/*/lib/**` | `yarn lint:deps` | Blocking. [dependency-cycle linting](../monorepo-tooling/prepare-and-cache.md#dependency-cycle-linting). |
 | Java under `packages/*/android` | `yarn lint:android` | **Implementation only.** `google-java-format --set-exit-if-changed --replace` — **mutates**. Only entrypoint ([agent command policy](agent-command-policy.md)); never invent `yarn google-java-format` / `npx google-java-format`. Can flake; rerun once/twice if failure is not clearly in diff. Commit formatter output. |
-| iOS native (`packages/*/ios` `.h` / `.cpp` / `.m` / `.mm`, not generated) | `yarn lint:ios:check` | clang-format **check** (`-n -Werror`). Implementation may `yarn lint:ios:fix` then re-check. |
+| iOS native (`packages/*/ios` `.h` / `.cpp` / `.m` / `.mm`, not generated) | `yarn lint:ios:check` | clang-format **check** (`-n -Werror`). Pin npm `clang-format@1.7.0` (1.8.0 darwin tarball is x64-only on arm64). Implementation may `yarn lint:ios:fix` then re-check. |
 | `docs/**` | `yarn lint:markdown` then `yarn lint:spellcheck` | Scripts glob `docs/**` only (CI docs job). OKF-only diffs skip these. Gotchas below. |
 
 **Docs lint gotchas** (`docs/**` only):
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -120,7 +120,7 @@
     "@types/react-native": "^0.73.0",
     "@typescript-eslint/parser": "^8.59.1",
     "babel-jest": "^30.3.0",
-    "clang-format": "^1.8.0",
+    "clang-format": "1.7.0",
     "conventional-changelog-cli": "^4.1.0",
     "cross-env": "^10.1.0",
     "dependency-cruiser": "^17.3.9",
```

**File**: `test-rn-bare/ios/testrnbare/GoogleService-Info.plist` (modified, +12/-10)
```diff
@@ -3,34 +3,36 @@
 <plist version="1.0">
 <dict>
 	<key>CLIENT_ID</key>
-	<string>000000000000-testrnbarefakefakefakefakefake.apps.googleusercontent.com</string>
+	<string>448618578101-4km55qmv55tguvnivgjdiegb3r0jquv5.apps.googleusercontent.com</string>
 	<key>REVERSED_CLIENT_ID</key>
-	<string>com.googleusercontent.apps.000000000000-testrnbarefakefakefakefakefake</string>
+	<string>com.googleusercontent.apps.448618578101-4km55qmv55tguvnivgjdiegb3r0jquv5</string>
+	<key>ANDROID_CLIENT_ID</key>
+	<string>448618578101-a9p7bj5jlakabp22fo3cbkj7nsmag24e.apps.googleusercontent.com</string>
 	<key>API_KEY</key>
-	<string>AIzaSyFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE</string>
+	<string>AIzaSyAHAsf51D0A407EklG1bs-5wA7EbyfNFg0</string>
 	<key>GCM_SENDER_ID</key>
-	<string>000000000000</string>
+	<string>448618578101</string>
 	<key>PLIST_VERSION</key>
 	<string>1</string>
 	<key>BUNDLE_ID</key>
 	<string>com.invertase.testrnbare</string>
 	<key>PROJECT_ID</key>
-	<string>test-rn-bare-fixture-fake</string>
+	<string>react-native-firebase-testing</string>
 	<key>STORAGE_BUCKET</key>
-	<string>test-rn-bare-fixture-fake.appspot.com</string>
+	<string>react-native-firebase-testing.appspot.com</string>
 	<key>IS_ADS_ENABLED</key>
 	<false></false>
 	<key>IS_ANALYTICS_ENABLED</key>
 	<false></false>
 	<key>IS_APPINVITE_ENABLED</key>
-	<false></false>
+	<true></true>
 	<key>IS_GCM_ENABLED</key>
 	<true></true>
 	<key>IS_SIGNIN_ENABLED</key>
-	<false></false>
+	<true></true>
 	<key>GOOGLE_APP_ID</key>
-	<string>1:000000000000:ios:fakefakefakefakefake</string>
+	<string>1:448618578101:ios:3e76955ab6d49ecaac3efc</string>
 	<key>DATABASE_URL</key>
-	<string>https://test-rn-bare-fixture-fake.firebaseio.com</string>
+	<string>https://react-native-firebase-testing.firebaseio.com</string>
 </dict>
 </plist>
```

**File**: `yarn.lock` (modified, +5/-5)
```diff
@@ -10884,9 +10884,9 @@ __metadata:
   languageName: node
   linkType: hard
 
-"clang-format@npm:^1.8.0":
-  version: 1.8.0
-  resolution: "clang-format@npm:1.8.0"
+"clang-format@npm:1.7.0":
+  version: 1.7.0
+  resolution: "clang-format@npm:1.7.0"
   dependencies:
     async: "npm:^3.2.3"
     glob: "npm:^7.0.0"
@@ -10895,7 +10895,7 @@ __metadata:
     check-clang-format: bin/check-clang-format.js
     clang-format: index.js
     git-clang-format: bin/git-clang-format
-  checksum: 10/d4a25ae743d09b8aecc7afb7cb29c531ae3fcc9cb3195b69cc76e1a9ada69d423f341fbccc47458ab35c1c8746856a778de8f7ba51b2886c66ef78f779c842f7
+  checksum: 10/4d45dfa155d1379fbce487550c65e33689dbfbb8e8ebd8dae5064515ae6075711bab6dba0580745d2d42340cae25f15908ea2f1fd5b6e2f02684f7ea3962bae5
   languageName: node
   linkType: hard
 
@@ -24147,7 +24147,7 @@ __metadata:
     "@types/react-native": "npm:^0.73.0"
     "@typescript-eslint/parser": "npm:^8.59.1"
     babel-jest: "npm:^30.3.0"
-    clang-format: "npm:^1.8.0"
+    clang-format: "npm:1.7.0"
     conventional-changelog-cli: "npm:^4.1.0"
     cross-env: "npm:^10.1.0"
     dependency-cruiser: "npm:^17.3.9"
```

---

### Incident Patch 6: `01f450fa` (2026-09-30)
**Commit Message**: fix(app): support Expo 58 scene lifecycle

**File**: `.github/workflows/scripts/test-expo-ios-launch-smoke.sh` (added, +160/-0)
```diff
@@ -0,0 +1,160 @@
+#!/bin/bash
+# iOS 27 UIScene launch smoke for test-expo (Expo 58 dev-client fixture).
+# Requires a prior yarn test-expo:ios:link in this checkout (ios/ generated).
+# simctl-only — no Simulator.app / Device Hub.
+set -euo pipefail
+
+cd "$(dirname "$0")/../../.."
+cd test-expo
+
+log() {
+  echo "[test-expo-ios-launch-smoke] $*"
+}
+
+fail() {
+  log "ERROR: $*"
+  exit 1
+}
+
+BUNDLE_ID="${RNFB_TEST_EXPO_BUNDLE_ID:-io.invertase.testing}"
+SCHEME_URL="${RNFB_TEST_EXPO_SCHEME:-testexpo}"
+WORKSPACE="${RNFB_TEST_EXPO_WORKSPACE:-ios/testexpo.xcworkspace}"
+XCODE_SCHEME="${RNFB_TEST_EXPO_XCODE_SCHEME:-testexpo}"
+SIM_NAME="${RNFB_TEST_EXPO_IOS27_DEVICE:-iPhone 18 Pro}"
+SIM_RUNTIME="${RNFB_TEST_EXPO_IOS27_RUNTIME:-iOS 27.0}"
+METRO_PORT="${RNFB_TEST_EXPO_METRO_PORT:-8081}"
+METRO_LOG="${RNFB_TEST_EXPO_METRO_LOG:-/tmp/test-expo-launch-smoke-metro.log}"
+APP_LOG="${RNFB_TEST_EXPO_LAUNCH_LOG:-/tmp/test-expo-launch-smoke.log}"
+XCODEBUILD_LOG="${RNFB_TEST_EXPO_LAUNCH_XCODEBUILD_LOG:-/tmp/test-expo-launch-smoke-xcodebuild.log}"
+
+if [[ ! -d "$WORKSPACE" ]]; then
+  fail "missing ${WORKSPACE} — run yarn test-expo:ios:link first"
+fi
+
+resolve_sim_udid() {
+  local line udid
+  line="$(
+    xcrun simctl list devices available 2>/dev/null \
+      | awk -v device="$SIM_NAME" -v runtime="$SIM_RUNTIME" '
+          $0 ~ "-- " runtime " --" { in_runtime = 1; next }
+          in_runtime && /^-- / { in_runtime = 0 }
+          in_runtime && index($0, device " (") { print; exit }
+        '
+  )"
+  [[ -n "$line" ]] || fail "no available simulator named \"${SIM_NAME}\" on runtime ${SIM_RUNTIME}"
+  udid="$(sed -E 's/.*\(([A-F0-9-]+)\).*/\1/' <<<"$line")"
+  [[ -n "$udid" ]] || fail "could not parse UDID from simulator line: ${line}"
+  echo "$udid"
+}
+
+cleanup() {
+  local udid="$1"
+  local metro_pid="$2"
+  xcrun simctl terminate "$udid" "$BUNDLE_ID" 2>/dev/null || true
+  if [[ -n "$metro_pid" ]]; then
+    kill "$metro_pid" 2>/dev/null || true
+  fi
+  lsof -ti:"$METRO_PORT" | xargs kill -9 2>/dev/null || true
+}
+
+UDID="$(resolve_sim_udid)"
+log "simulator udid=${UDID} name=\"${SIM_NAME}\" runtime=${SIM_RUNTIME}"
+
+lsof -ti:"$METRO_PORT" | xargs kill -9 2>/dev/null || true
+: >"$METRO_LOG"
+CI=1 npx expo start --dev-client --port "$METRO_PORT" --localhost >>"$METRO_LOG" 2>&1 &
+METRO_PID=$!
+trap 'cleanup "$UDID" "$METRO_PID"' EXIT
+
+metro_ready=0
+for _ in $(seq 1 120); do
+  if curl -sf "http://localhost:${METRO_PORT}/status" | grep -q 'packager-status:running'; then
+    metro_ready=1
+    break
+  fi
+  if ! kill -0 "$METRO_PID" 2>/dev/null; then
+    tail -40 "$METRO_LOG" >&2
+    fail "Metro exited before becoming ready"
+  fi
+  sleep 1
+done
+[[ "$metro_ready" -eq 1 ]] || fail "Metro did not become ready on :${METRO_PORT}"
+
+HOST_ARCH="$(uname -m)"
+xcrun simctl boot "$UDID" 2>/dev/null || true
+xcrun simctl bootstatus "$UDID" -b >/dev/null
+
+log "xcodebuild Debug (simulator ${UDID}, log: ${XCODEBUILD_LOG})"
+set +e
+xcodebuild \
+  ARCHS="$HOST_ARCH" \
+  ONLY_ACTIVE_ARCH=YES \
+  -workspace "$WORKSPACE" \
+  -scheme "$XCODE_SCHEME" \
+  -configuration Debug \
+  -destination "id=${UDID}" \
+  CODE_SIGNING_ALLOWED=NO \
+  CODE_SIGNING_REQUIRED=NO \
+  CODE_SIGN_IDENTITY="" \
+  build 2>&1 | tee "$XCODEBUILD_LOG"
+xcodebuild_status=${PIPESTATUS[0]}
+set -e
+[[ "$xcodebuild_status" -eq 0 ]] || fail "xcodebuild Debug failed (exit ${xcodebuild_status})"
+
+APP="$(
+  find "${HOME}/Library/Developer/Xcode/DerivedData"/testexpo-*/Build/Products/Debug-iphonesimulator \
+    -maxdepth 1 -name '*.app' 2>/dev/null | head -1
+)"
+[[ -n "$APP" && -d "$APP" ]] || fail "could not find Debug-iphonesimulator .app under DerivedData/testexpo-*"
+
+xcrun simctl install "$UDID" "$APP"
+
+: >"$APP_LOG"
+xcrun simctl spawn "$UDID" log stream --level default --style compact \
+  --predicate 'process == "testexpo" OR subsystem == "com.apple.runtime-issues" OR eventMessage CONTAINS[c] "EvaluateRuntimeIssueForNoSceneLifecycl
```

**File**: `.github/workflows/scripts/test-expo-ios-link.sh` (modified, +34/-0)
```diff
@@ -53,6 +53,40 @@ if [[ ! -d "$WORKSPACE" ]]; then
   exit 1
 fi
 
+log "--- Expo 58 UIScene / RNFB plugin contract ---"
+SCENE_DELEGATE="ios/testexpo/SceneDelegate.swift"
+APP_DELEGATE="ios/testexpo/AppDelegate.swift"
+INFO_PLIST="ios/testexpo/Info.plist"
+for generated_file in "$SCENE_DELEGATE" "$APP_DELEGATE" "$INFO_PLIST"; do
+  if [[ ! -f "$generated_file" ]]; then
+    log "ERROR: missing ${generated_file} (Expo prebuild did not emit UIScene files)"
+    exit 1
+  fi
+done
+if ! grep -q 'class SceneDelegate: ExpoAppSceneDelegate' "$SCENE_DELEGATE"; then
+  log "ERROR: SceneDelegate is not the Expo 58 ExpoAppSceneDelegate stub"
+  exit 1
+fi
+if grep -qE 'Firebase|FIRApp|FirebaseApp' "$SCENE_DELEGATE"; then
+  log "ERROR: Firebase code in SceneDelegate (RNFB must configure only in AppDelegate)"
+  exit 1
+fi
+firebase_configure_count="$(grep -c 'FirebaseApp.configure()' "$APP_DELEGATE" || true)"
+if [[ "$firebase_configure_count" -ne 1 ]]; then
+  log "ERROR: expected exactly one FirebaseApp.configure() in AppDelegate, found ${firebase_configure_count}"
+  exit 1
+fi
+if ! awk '/UIApplicationSupportsMultipleScenes/{getline; if ($0 ~ /<false\/>/) found=1} END{exit !found}' "$INFO_PLIST"; then
+  log "ERROR: UIApplicationSupportsMultipleScenes is not false (single-scene contract)"
+  exit 1
+fi
+if ! grep -q 'UISceneDelegateClassName' "$INFO_PLIST"; then
+  log "ERROR: Info.plist missing UIScene manifest entries"
+  exit 1
+fi
+log "PASS: Expo owns SceneDelegate; RNFB configures Firebase once in AppDelegate; single-scene manifest"
+log "--- end Expo 58 UIScene / RNFB plugin contract ---"
+
 # Diagnosis: did #9164's rnfirebase_add_spm_core_to_app_target run during
 # Expo CNG `pod install`, and did the resulting pbxproj keep FirebaseCore on
 # the app target? Do not "fix" a wipe by hand-editing pbxproj or adding a
```

**File**: `okf-bundle/testing/agent-command-policy.md` (modified, +2/-1)
```diff
@@ -43,6 +43,7 @@ Single source for **which shell commands agents may run** in this repo. E2e `yar
 | iOS Ruby unit tests (SPM / CocoaPods helpers)                   | `yarn lint:ruby` / `yarn tests:ios:ruby` (after root `yarn` or `yarn ruby:install` when gems are missing)                                                                                                                                                                                  | ad-hoc `ruby packages/app/__tests__/…_test.rb`, bare `ruby …/run_with_coverage.rb` without the yarn script as the agent gate                                  |
 | iOS CocoaPods provisioning before shared build                 | `yarn tests:ios:pod:install` (after root `yarn` or `yarn ruby:install` when gems are missing; required order below)                                                                                                                                                                         | bare `pod install`, `cd tests/ios && pod install`, or assuming `yarn tests:ios:build` creates CocoaPods support files                                          |
 | Expo documented-path iOS link (workspace `test-expo/`; also the user-facing Expo example) | `yarn test-expo:ios:link` (repo root; script `.github/workflows/scripts/test-expo-ios-link.sh`). **Build-only** (`xcodebuild build`; does not launch). Keep `expo.autolinking.exclude: ["@expo/ui"]` in `test-expo/package.json` — [gotcha](#expo-router-autolink-exclude-expo-ui) | ad-hoc `expo prebuild` / `xcodebuild` outside that script; `cd test-expo && …` as the agent gate (link, typecheck, or launch); `yarn test-rn-bare:ios:build` as this closer; dropping the `@expo/ui` autolink exclude |
+| Expo iOS 27 UIScene launch smoke (`test-expo/`; after link) | `yarn test-expo:ios:launch-smoke` (repo root; script `.github/workflows/scripts/test-expo-ios-launch-smoke.sh`). **Launch-only** on an iOS 27 simulator via `simctl` (starts fixture Metro internally; requires prior `yarn test-expo:ios:link` in the same checkout). Not Detox | ad-hoc `simctl` / `xcodebuild` / `cd test-expo && expo start` outside that script; `open -a Simulator`; Device Hub |
 | RN CLI prebuilt RNCore iOS build (workspace `test-rn-bare/`)    | `yarn test-rn-bare:ios:build` (repo root; script `.github/workflows/scripts/test-rn-bare-ios-build.sh`)                                                                                                                                                                                      | ad-hoc `pod` / `xcodebuild`; `cd test-rn-bare && …`; `tests/` e2e / `yarn tests:*`; `yarn test-expo:ios:link` as this closer                                  |
 | Android merged Jacoco (unit + e2e)                              | `yarn tests:android:post-e2e-coverage` (after e2e); `yarn tests:android:test:jacoco-report` when regenerating the merge report                                                                                                                                                             | `./gradlew jacocoAndroidTestReport` as Codecov path; inventing other jacoco yarn scripts                                                                      |
 | Native coverage presence guard (silent-empty fail)            | `yarn tests:coverage:assert-presence` (also invoked from `tests:android:post-e2e-coverage` and `tests:ios:test:process-coverage`; exit **2** on empty/missing when strict)                                                                                                                  | Ignoring empty LCOV/Jacoco; treating missing `.ec` / `packagesHits=0` as soft success in CI                                                                   |
@@ -243,7 +244,7 @@ Local e2e (`yarn tests:*:test-cover`), the packager, emulator start, native buil
 ```text
 RNFB agent command policy: okf-bundle/testing/agent-command-policy.md ONLY.
 E2e: okf-bundle/testing/running-e2e.md yarn tests:* ONLY.
-Expo example + documented-path iOS li
```

**File**: `package.json` (modified, +1/-0)
```diff
@@ -75,6 +75,7 @@
     "tests:ios:test-cover-and-process": "yarn tests:ios:test-cover && yarn tests:ios:test:process-coverage",
     "tests:ios:pod:install": "cd tests/ios && bundle exec pod install",
     "test-expo:ios:link": "bash .github/workflows/scripts/test-expo-ios-link.sh",
+    "test-expo:ios:launch-smoke": "bash .github/workflows/scripts/test-expo-ios-launch-smoke.sh",
     "test-expo:ios": "cd test-expo && yarn ios",
     "test-expo:android": "cd test-expo && yarn android",
     "test-rn-bare:ios:build": "bash .github/workflows/scripts/test-rn-bare-ios-build.sh",
```

---

### Incident Patch 7: `9bcea8de` (2026-09-30)
**Commit Message**: test(ios): migrate bare fixture to UIScene

**File**: `test-rn-bare/ios/testrnbare.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -13,6 +13,7 @@
 		761780ED2CA45674006654EE /* AppDelegate.swift in Sources */ = {isa = PBXBuildFile; fileRef = 761780EC2CA45674006654EE /* AppDelegate.swift */; };
 		81AB9BB82411601600AC10FF /* LaunchScreen.storyboard in Resources */ = {isa = PBXBuildFile; fileRef = 81AB9BB72411601600AC10FF /* LaunchScreen.storyboard */; };
 		A11FB8E01F1E4011B0BA0001 /* GoogleService-Info.plist in Resources */ = {isa = PBXBuildFile; fileRef = A11FB8E01F1E4011B0BA0002 /* GoogleService-Info.plist */; };
+		A1B2C3D40B00000100000001 /* SceneDelegate.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1B2C3D40B00000100000002 /* SceneDelegate.swift */; };
 		BCE02FE12AECA10CC59E355D /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = 13B07FB81A68108700A75B9A /* PrivacyInfo.xcprivacy */; };
 /* End PBXBuildFile section */
 
@@ -27,6 +28,7 @@
 		761780EC2CA45674006654EE /* AppDelegate.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = AppDelegate.swift; path = testrnbare/AppDelegate.swift; sourceTree = "<group>"; };
 		81AB9BB72411601600AC10FF /* LaunchScreen.storyboard */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = file.storyboard; name = LaunchScreen.storyboard; path = testrnbare/LaunchScreen.storyboard; sourceTree = "<group>"; };
 		A11FB8E01F1E4011B0BA0002 /* GoogleService-Info.plist */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text.plist.xml; name = "GoogleService-Info.plist"; path = "testrnbare/GoogleService-Info.plist"; sourceTree = "<group>"; };
+		A1B2C3D40B00000100000002 /* SceneDelegate.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = SceneDelegate.swift; path = testrnbare/SceneDelegate.swift; sourceTree = "<group>"; };
 		ED297162215061F000B7C4FE /* JavaScriptCore.framework */ = {isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = JavaScriptCore.framework; path = System/Library/Frameworks/JavaScriptCore.framework; sourceTree = SDKROOT; };
 /* End PBXFileReference section */
 
@@ -48,6 +50,7 @@
 			children = (
 				13B07FB51A68108700A75B9A /* Images.xcassets */,
 				761780EC2CA45674006654EE /* AppDelegate.swift */,
+				A1B2C3D40B00000100000002 /* SceneDelegate.swift */,
 				A11FB8E01F1E4011B0BA0002 /* GoogleService-Info.plist */,
 				13B07FB61A68108700A75B9A /* Info.plist */,
 				81AB9BB72411601600AC10FF /* LaunchScreen.storyboard */,
@@ -315,6 +318,7 @@
 			buildActionMask = 2147483647;
 			files = (
 				761780ED2CA45674006654EE /* AppDelegate.swift in Sources */,
+				A1B2C3D40B00000100000001 /* SceneDelegate.swift in Sources */,
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 		};
```

**File**: `test-rn-bare/ios/testrnbare/AppDelegate.swift` (modified, +1/-36)
```diff
@@ -1,51 +1,16 @@
 import UIKit
-import React
-import React_RCTAppDelegate
-import ReactAppDependencyProvider
 import Firebase
 
 @main
 class AppDelegate: UIResponder, UIApplicationDelegate {
+  /// Kept for tooling that expects AppDelegate.window; SceneDelegate creates and assigns it.
   var window: UIWindow?
 
-  var reactNativeDelegate: ReactNativeDelegate?
-  var reactNativeFactory: RCTReactNativeFactory?
-
   func application(
     _ application: UIApplication,
     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
   ) -> Bool {
     FirebaseApp.configure()
-
-    let delegate = ReactNativeDelegate()
-    let factory = RCTReactNativeFactory(delegate: delegate)
-    delegate.dependencyProvider = RCTAppDependencyProvider()
-
-    reactNativeDelegate = delegate
-    reactNativeFactory = factory
-
-    window = UIWindow(frame: UIScreen.main.bounds)
-
-    factory.startReactNative(
-      withModuleName: "testrnbare",
-      in: window,
-      launchOptions: launchOptions
-    )
-
     return true
   }
 }
-
-class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
-  override func sourceURL(for bridge: RCTBridge) -> URL? {
-    self.bundleURL()
-  }
-
-  override func bundleURL() -> URL? {
-#if DEBUG
-    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
-#else
-    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
-#endif
-  }
-}
```

**File**: `test-rn-bare/ios/testrnbare/Info.plist` (modified, +17/-0)
```diff
@@ -37,6 +37,23 @@
 	<string></string>
 	<key>RCTNewArchEnabled</key>
 	<true/>
+	<key>UIApplicationSceneManifest</key>
+	<dict>
+		<key>UIApplicationSupportsMultipleScenes</key>
+		<false/>
+		<key>UISceneConfigurations</key>
+		<dict>
+			<key>UIWindowSceneSessionRoleApplication</key>
+			<array>
+				<dict>
+					<key>UISceneConfigurationName</key>
+					<string>Default Configuration</string>
+					<key>UISceneDelegateClassName</key>
+					<string>SceneDelegate</string>
+				</dict>
+			</array>
+		</dict>
+	</dict>
 	<key>UILaunchStoryboardName</key>
 	<string>LaunchScreen</string>
 	<key>UIRequiredDeviceCapabilities</key>
```

**File**: `test-rn-bare/ios/testrnbare/SceneDelegate.swift` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+import UIKit
+import React
+import React_RCTAppDelegate
+import ReactAppDependencyProvider
+
+@objc(SceneDelegate)
+class SceneDelegate: ReactNativeDelegate, UIWindowSceneDelegate {
+  var window: UIWindow?
+
+  private var reactNativeFactory: RCTReactNativeFactory?
+
+  func scene(
+    _ scene: UIScene,
+    willConnectTo session: UISceneSession,
+    options connectionOptions: UIScene.ConnectionOptions
+  ) {
+    guard let windowScene = scene as? UIWindowScene else {
+      return
+    }
+
+    dependencyProvider = RCTAppDependencyProvider()
+    let factory = RCTReactNativeFactory(delegate: self)
+    reactNativeFactory = factory
+
+    let window = UIWindow(windowScene: windowScene)
+    self.window = window
+    (UIApplication.shared.delegate as? AppDelegate)?.window = window
+
+    factory.startReactNative(
+      withModuleName: "testrnbare",
+      in: window,
+      connectionOptions: connectionOptions
+    )
+  }
+
+  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
+    RCTLinkingManager.scene(scene, openURLContexts: URLContexts)
+  }
+
+  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
+    RCTLinkingManager.scene(scene, continue: userActivity)
+  }
+}
+
+class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
+  override func sourceURL(for bridge: RCTBridge) -> URL? {
+    self.bundleURL()
+  }
+
+  override func bundleURL() -> URL? {
+#if DEBUG
+    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
+#else
+    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
+#endif
+  }
+}
```

---

### Incident Patch 8: `38965e3d` (2026-09-30)
**Commit Message**: test: ratchet fixtures to RN 0.88 RC3 and migrate Detox to UIScene

**File**: `.github/workflows/scripts/test-rn-bare-ios-build.sh` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@ xcodebuild_args=(
   ARCHS="${HOST_ARCH}"
   VALID_ARCHS="${HOST_ARCH}"
   ONLY_ACTIVE_ARCH=YES
-  CC=clang CPLUSPLUS=clang++ LD=clang LDPLUSPLUS=clang++
+  CC=clang CPLUSPLUS=clang++
   -workspace "$WORKSPACE"
   -scheme "$SCHEME"
   -configuration Release
```

**File**: `.yarnrc.yml` (modified, +65/-0)
```diff
@@ -65,3 +65,68 @@ npmPreapprovedPackages:
   - '@react-native-firebase/*'
   - 'firebase@12.19.0' # If adopting recent firebase-js-sdk, specify directly here
   - 'react-native-coverage@0.2.0'
+  # RN 0.88.0-rc.3 / React 19.3 / CLI 20.2 / Expo 58 mobile line (younger than npmMinimalAgeGate)
+  - '@react-native/babel-preset@0.88.0-rc.3'
+  - '@react-native/metro-config@0.88.0-rc.3'
+  - 'react-native@0.88.0-rc.3'
+  - 'babel-preset-expo@~58.0.6'
+  - 'expo-build-properties@~58.0.9'
+  - 'expo-constants@~58.0.9'
+  - 'expo-dev-client@~58.0.9'
+  - 'expo-linking@~58.0.9'
+  - 'expo-router@~58.0.10'
+  - 'expo@58.0.0'
+  - '@react-native/jest-preset@0.88.0-rc.3'
+  - '@react-native/js-polyfills@0.88.0-rc.3'
+  - '@react-native/metro-babel-transformer@0.88.0-rc.3'
+  - '@expo/cli@^58.0.9'
+  - '@expo/config-plugins@~58.0.4'
+  - '@expo/config@~58.0.1'
+  - '@expo/devtools@~58.0.2'
+  - '@expo/dom-webview@~58.0.2'
+  - '@expo/fingerprint@^0.21.2'
+  - '@expo/local-build-cache-provider@^58.0.1'
+  - '@expo/log-box-utils@^58.0.1'
+  - '@expo/log-box@^58.0.7'
+  - '@expo/metro-config@~58.0.6'
+  - 'expo-asset@~58.0.9'
+  - 'expo-file-system@~58.0.4'
+  - 'expo-font@~58.0.4'
+  - 'expo-keep-awake@~58.0.2'
+  - 'expo-modules-autolinking@~58.0.6'
+  - 'expo-modules-core@~58.0.9'
+  - '@react-native/babel-plugin-codegen@0.88.0-rc.3'
+  - '@react-native/codegen@0.88.0-rc.3'
+  - '@react-native/asset-utils@0.88.0-rc.3'
+  - '@react-native/community-cli-plugin@0.88.0-rc.3'
+  - '@react-native/gradle-plugin@0.88.0-rc.3'
+  - '@react-native/normalize-colors@0.88.0-rc.3'
+  - '@react-native/virtualized-lists@0.88.0-rc.3'
+  - 'hermes-compiler@260318099.0.4'
+  - 'expo-dev-launcher@~58.0.9'
+  - '@expo/metro-runtime@^58.0.9'
+  - '@expo/schema-utils@^58.0.1'
+  - '@expo/env@~2.5.1'
+  - 'expo-dev-menu-interface@~58.0.1'
+  - 'expo-dev-menu@~58.0.9'
+  - 'expo-manifests@~58.0.1'
+  - 'expo-updates-interface@~58.0.1'
+  - '@expo/require-utils@^58.0.2'
+  - 'expo-glass-effect@^58.0.3'
+  - 'expo-server@^58.0.2'
+  - '@react-native/dev-middleware@0.88.0-rc.3'
+  - '@react-native/debugger-frontend@0.88.0-rc.3'
+  - '@react-native/debugger-shell@0.88.0-rc.3'
+  - '@expo/config-types@^58.0.2'
+  - '@expo/image-utils@^0.12.2'
+  - '@expo/json-file@~11.2.1'
+  - '@expo/plist@^0.10.1'
+  - '@expo/inline-modules@^0.2.1'
+  - 'expo-json-utils@~58.0.1'
+  - 'expo-modules-jsi@~58.0.5'
+  - '@expo/metro-file-map@^58.0.3'
+  - 'expo-modules-macros@0.14.0'
+  - '@expo/osascript@^2.8.1'
+  - '@expo/package-manager@^1.14.1'
+  - '@expo/prebuild-config@^58.0.6'
+  - '@expo/router-server@^58.0.4'
```

**File**: `okf-bundle/testing/test-app-dependency-pins.md` (modified, +18/-9)
```diff
@@ -31,12 +31,21 @@ Root `package.json` must **not** use blanket `resolutions` for `react-native`, `
 
 | Package | Pin | Where |
 |---------|-----|--------|
-| `react-native` (mobile) | **`0.86.2`** | `tests/package.json`, `test-expo/package.json`, `test-rn-bare/package.json` |
-| `react` (mobile) | **`19.2.3`** | `tests/package.json`, `test-expo/package.json`, `test-rn-bare/package.json` |
-| `@react-native-community/cli` (+ platform packages) | **`20.1.0`** | `tests/package.json`, `test-rn-bare/package.json` (and root `devDependencies` for tooling convenience) |
-| `@react-native/babel-preset` / `@react-native/metro-config` | **`0.86.2`** | `tests/package.json`, `test-rn-bare/package.json` |
-| `@react-native/jest-preset` | **`0.86.2`** | `tests/package.json` (and root `devDependencies` for Jest / toolchain lockstep with mobile RN) |
-| `@react-native/codegen` | **`0.86.2`** | Resolved with mobile `react-native` from `tests/` (no root resolution) |
+| `react-native` (mobile) | **`0.88.0-rc.3`** | `tests/package.json`, `test-expo/package.json`, `test-rn-bare/package.json` |
+| `react` (mobile) | **`19.3.0`** | `tests/package.json`, `test-expo/package.json`, `test-rn-bare/package.json` |
+| `engines.node` (mobile fixtures) | **`^22.13.0`** | `tests/package.json`, `test-expo/package.json`, `test-rn-bare/package.json` |
+| `@react-native-community/cli` (+ platform packages) | **`20.2.0`** | `tests/package.json`, `test-rn-bare/package.json` (and root `devDependencies` for tooling convenience) |
+| `@react-native/babel-preset` / `@react-native/metro-config` | **`0.88.0-rc.3`** | `tests/package.json`, `test-rn-bare/package.json` |
+| `@react-native/jest-preset` | **`0.88.0-rc.3`** | `tests/package.json` (and root `devDependencies` for Jest / toolchain lockstep with mobile RN) |
+| `@react-native/codegen` | **`0.88.0-rc.3`** | Resolved with mobile `react-native` from `tests/` (no root resolution) |
+| `expo` | **`58.0.0`** | `test-expo/package.json` |
+| `expo-build-properties` / `expo-constants` / `expo-dev-client` / `expo-linking` | **`~58.0.9`** | `test-expo/package.json` |
+| `expo-router` | **`~58.0.10`** | `test-expo/package.json` |
+| `babel-preset-expo` | **`~58.0.6`** | `test-expo/package.json` |
+| `react-native-gesture-handler` | **`~3.2.1`** | `test-expo/package.json` |
+| `react-native-reanimated` / `react-native-worklets` | **`~4.7.0`** / **`0.13.0`** | `test-expo/package.json` (expo-router 58 peers) |
+| `react-native-safe-area-context` | **`~5.9.1`** | `test-expo/package.json` |
+| `react-native-screens` | **`~4.28.0`** | `test-expo/package.json` |
 | `react-native` (macOS shell) | **`0.78.3`** | `tests-macos/package.json` |
 | `react-native-macos` | **`0.78.6`** | `tests-macos/package.json` |
 | macOS CLI band | **`15.1.3`** | `tests-macos/package.json` |
@@ -45,13 +54,13 @@ Root `package.json` must **not** use blanket `resolutions` for `react-native`, `
 | `@react-native-firebase/*` (e2e apps + `test-expo` + `test-rn-bare`) | **must match current lerna / package version** | `tests/package.json`, `tests-macos/package.json`, `test-expo/package.json`, and `test-rn-bare/package.json` — see [RNFB workspace pins](#rnfb-workspace-pins) |
 | `@react-native-firebase/app-types` | **`6.7.2`** | both apps (legacy types package; not a workspace) |
 
-**CLI rationale:** mobile CLI **`20.1.0`** matches the React Native **0.86** community template. macOS keeps the **0.78** CLI band with `react-native-macos@0.78.6`. Never add a global resolution that would pull `tests-macos` onto the mobile line.
+**CLI rationale:** mobile CLI **`20.2.0`** matches the React Native **0.88.0-rc.3** community template (`@react-native-community/template@0.88.0-rc.3-ada64d0`; the bare `0.88.0-rc.3` tag is not that template). macOS keeps the **0.78** CLI band with `react-native-macos@0.78.6`. Never add a global resolution that would pull `tests-macos` onto the mobile line.
 
-**fmt / Apple Clang:** RN **0.86.2** ships fmt **12.1.0** upstream (no mobile 
```

**File**: `package.json` (modified, +4/-4)
```diff
@@ -111,10 +111,10 @@
     "@firebase/rules-unit-testing": "^5.0.0",
     "@inquirer/prompts": "^8.4.2",
     "@octokit/core": "^7.0.6",
-    "@react-native-community/cli": "20.1.0",
-    "@react-native/jest-preset": "0.86.2",
+    "@react-native-community/cli": "20.2.0",
+    "@react-native/jest-preset": "0.88.0-rc.3",
     "@tsconfig/node-lts": "^24.0.0",
-    "@types/react": "~19.2.14",
+    "@types/react": "~19.3.0",
     "@types/react-native": "^0.73.0",
     "@typescript-eslint/parser": "^8.59.1",
     "babel-jest": "^30.3.0",
@@ -149,7 +149,7 @@
     "typescript-eslint": "^8.59.1"
   },
   "resolutions": {
-    "@types/react": "~19.2.0",
+    "@types/react": "~19.3.0",
     "mocha-remote-client@npm:^1.13.0": "patch:mocha-remote-client@npm%3A1.13.2#~/.yarn/patches/mocha-remote-client-npm-1.13.2-a2e7596aba.patch",
     "mocha-remote-server@npm:^1.13.0": "patch:mocha-remote-server@npm%3A1.13.2#~/.yarn/patches/mocha-remote-server-npm-1.13.2-619a29d2e3.patch"
   },
```

**File**: `packages/app/lib/internal/FirebaseModule.ts` (modified, +6/-3)
```diff
@@ -18,9 +18,12 @@
 import { getAppModule, getNativeModule } from './registry/nativeModule';
 import SharedEventEmitter from './SharedEventEmitter';
 import type { ReactNativeFirebase } from '../types/app';
-import type { FirebaseJsonConfig, ModuleConfig } from '../types/internal';
+import type {
+  FirebaseJsonConfig,
+  ModuleConfig,
+  ReactNativeFirebaseEventEmitter,
+} from '../types/internal';
 import type { ReactNativeFirebaseNativeModules } from './NativeModules';
-import type EventEmitter from 'react-native/Libraries/vendor/emitter/EventEmitter';
 
 let firebaseJson: FirebaseJsonConfig | null = null;
 
@@ -55,7 +58,7 @@ export default class FirebaseModule<
     return firebaseJson as FirebaseJsonConfig;
   }
 
-  get emitter(): EventEmitter {
+  get emitter(): ReactNativeFirebaseEventEmitter {
     return SharedEventEmitter;
   }
 
```

---

### Incident Patch 9: `56a41414` (2026-09-30)
**Commit Message**: fix(messaging): detect the iOS APNs environment from the provisioning profile

DEBUG is not the signed aps-environment, so a Release build with a
development profile registered a sandbox token as production.

**File**: `packages/messaging/ios/RNFBMessaging/RNFBMessaging+AppDelegate.m` (modified, +3/-5)
```diff
@@ -168,11 +168,9 @@ - (BOOL)claimPendingRegisterPromiseResolve:(RCTPromiseResolveBlock _Nullable *_N
 // called when `registerForRemoteNotifications` completes successfully
 - (void)application:(UIApplication *)application
     didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
-#ifdef DEBUG
-  [[FIRMessaging messaging] setAPNSToken:deviceToken type:FIRMessagingAPNSTokenTypeSandbox];
-#else
-  [[FIRMessaging messaging] setAPNSToken:deviceToken type:FIRMessagingAPNSTokenTypeProd];
-#endif
+  // DEBUG is not the signed aps-environment. Unknown makes Firebase Messaging
+  // read it from the provisioning profile.
+  [[FIRMessaging messaging] setAPNSToken:deviceToken type:FIRMessagingAPNSTokenTypeUnknown];
 
   RCTPromiseResolveBlock resolve = nil;
   RCTPromiseRejectBlock reject = nil;
```

---

### Incident Patch 10: `c9048086` (2026-09-24)
**Commit Message**: build(docs): add lint:markdown:fix for table padding

lint:markdown is check-only, so table padding had no allowlisted fix. Spellcheck already fails on unparseable frontmatter via scripts/spellcheck.mjs.

**File**: `okf-bundle/testing/agent-command-policy.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ Single source for **which shell commands agents may run** in this repo. E2e `yar
 | test-expo TypeScript check                                      | `yarn tsc:compile:test-expo` (repo root; `tsc --project test-expo/tsconfig.json`)                                                                                                                                                                                                          | `cd test-expo && tsc`; `cd test-expo && …` as a typecheck gate                                                                                                 |
 | JS lint (implementation / review gate)                          | `yarn lint:js`, `yarn lint:js --fix` (`eslint packages/* test-expo`; already includes `test-expo/`)                                                                                                                                                                                        | package-scoped `eslint`, `npx eslint`; a second `test-expo` lint entrypoint                                                                                   |
 | Android Java format / lint                                      | `yarn lint:android`                                                                                                                                                                                                                                                                        | `yarn google-java-format`, bare `google-java-format`, `google-java-format -i`, `npx google-java-format`, any invented format script                           |
-| Docs lint                                                       | `yarn lint:markdown`, `yarn lint:spellcheck` — when: [validation checklist § lint and formatting](validation-checklist.md#lint-and-formatting) (`docs/**` only; OKF-only skips)                                                                                                           | ad-hoc prettier/eslint on single files                                                                                                                        |
+| Docs lint                                                       | `yarn lint:markdown`, `yarn lint:markdown:fix`, `yarn lint:spellcheck` — when: [validation checklist § lint and formatting](validation-checklist.md#lint-and-formatting) (`docs/**` only; OKF-only skips). `:fix` is Prettier `--write` for table padding.                  | ad-hoc prettier/eslint on single files                                                                                                                        |
 | iOS Ruby lint (RuboCop)                                         | `yarn lint:ruby` (also runs inside `yarn tests:ios:ruby`)                                                                                                                                                                                                                                  | ad-hoc `rubocop`, `bundle exec rubocop` without the Gemfile/config                                                                                            |
 | Android JVM unit tests                                          | `yarn tests:android:unit`                                                                                                                                                                                                                                                                  | ad-hoc `./gradlew …` outside this yarn script; bare Robolectric/JUnit IDE-only as the agent gate                                                              |
 | iOS XCTest unit tests (in-package)                              | `yarn tests:ios:unit`                                                                                                                                                                                                                                    
```

**File**: `package.json` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@
     "lint:ios:check": "find packages/*/ios -type f \\( -name '*.h' -o -name '*.cpp' -o -name '*.m' -o -name '*.mm' \\) -not -path '*/generated/*' -print0 | xargs -0 clang-format --style=Google -n -Werror",
     "lint:ios:fix": "find packages/*/ios -type f \\( -name '*.h' -o -name '*.cpp' -o -name '*.m' -o -name '*.mm' \\) -not -path '*/generated/*' -print0 | xargs -0 clang-format -i --style=Google",
     "lint:markdown": "eslint \"docs/**/*.mdx\" --max-warnings=0 && prettier --check \"docs/**/*.mdx\"",
+    "lint:markdown:fix": "prettier --write \"docs/**/*.mdx\"",
     "lint:report": "eslint --output-file=eslint-report.json --format=json . --ext .js,.jsx,.ts,.tsx",
     "lint:spellcheck": "node ./scripts/spellcheck.mjs",
     "tsc:compile": "tsc --project .",
```

#### Recent Merged Pull Requests:
- **PR #9352** (2026-09-30): fix(messaging): detect the iOS APNs environment from the provisioning profile (@russellwheatley)
- **PR #9351** (2026-09-30): feat: Xcode 27 / iOS 27 and UIScene compatibility (@mikehardy)
- **PR #9346** (closed): build(deps): bump ruby/setup-ruby from 1.321.0 to 1.325.0 (@dependabot[bot])
- **PR #9343** (2026-09-29): fix(app, storage): link Photos framework on tvOS (@russellwheatley)
- **PR #9341** (2026-09-29): ci(testing): clear small e2e and docs-lint friction (@russellwheatley)
- **PR #9338** (closed): build(deps): bump ruby/setup-ruby from 1.321.0 to 1.324.0 (@dependabot[bot])
- **PR #9336** (2026-09-23): fix(app, expo): match scene-based AppDelegate for Expo SDK 58 config plugin (@russellwheatley)
- **PR #9332** (closed): build(deps): bump ruby/setup-ruby from 1.321.0 to 1.323.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
