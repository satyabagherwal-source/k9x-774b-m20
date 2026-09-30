# Forensic Learning Record (Deep Inspection): aws-amplify/amplify-js

> **Canonical Artifact**: `07_PROJECT_LEARNING/aws-amplify-amplify-js-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/aws-amplify/amplify-js](https://github.com/aws-amplify/amplify-js))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:40:01.925Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aws-amplify/amplify-js`
- **Description**: A declarative JavaScript library for application development using cloud services.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9556 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.lintstagedrc.mjs`
```
export default {
	"*.{ts,tsx}": "eslint --fix"
}

```

### Core Architecture Module: `eslint.config.mjs`
```
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fixupConfigRules, fixupPluginRules } from '@eslint/compat';
import stylistic from '@stylistic/eslint-plugin';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import unusedImports from 'eslint-plugin-unused-imports';
import _import from 'eslint-plugin-import';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

import customClientDtsBundlerConfig from './scripts/dts-bundler/dts-bundler.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
});
const customClientDtsFiles = customClientDtsBundlerConfig.entries
	.map(clientBundlerConfig => clientBundlerConfig.outFile)
	.filter(outFile => outFile?.length > 0)
	.map(outFile => outFile.replace(__dirname + path.sep, '')); // Convert absolute path to relative path

export default [
	{
		ignores: [
			'**/dist',
			'**/node_modules',
			'**/.eslintrc.*',
			'**/rollup',
			'**/rollup.config.*',
			'**/.rollup.cache',
			'**/setupTests.ts',
			'**/jest.setup.*',
			'**/jest.config.*',
			'packages/api/__tests__',
			'packages/api-graphql/__tests__',
			'packages/datastore/__tests__',
			'packages/datastore-storage-adapter/__tests__',
			'packages/interactions/__tests__',
			'packages/predictions/__tests__',
			'packages/pubsub/__tests__',
			...customClientDtsFiles,
		],
	},
	...fixupConfigRules(
		compat.extends(
			'eslint:recommended',
			'standard',
			'plugin:import/errors',
			'plugin:import/recommended',
			'plugin:import/typescript',
			'plugin:@typescript-eslint/stylistic',
			'plugin:@typescript-eslint/recommended',
			'plugin:prettier/recommended',
		),
	),
	{
		plugins: {
			'@stylistic': stylistic,
			'@typescript-eslint': fixupPluginRules(typescriptEslint),
			'unused-imports': unusedImports,
			import: fixupPluginRules(_import),
			jsdoc,
		},

		languageOptions: {
			globals: {
				...globals.node,
			},

			parser: tsParser,
			ecmaVersion: 5,
			sourceType: 'commonjs',

			parserOptions: {
				project: './tsconfig.json',
			},
		},

		settings: {
			'import/parsers': {
				'@typescript-eslint/parser': ['.ts', '.tsx'],
			},

			'import/resolver': {
				typescript: {
					alwaysTryTypes: true,
					project: ['packages/*/tsconfig.json', 'tsconfig.json'],
				},
			},

			'import/ignore': ['react-native'],
		},

		rules: {
			camelcase: [
				'error',
				{
					allow: [
						// exceptions for core package
						'phone_number',
						'search_indices',
						// exceptions for api packages
						'graphql_headers',
						// exceptions for the legacy config
						'^(aws_|amazon_)',
						'access_key',
						'secret_key',
						'session_token',
						// exceptions for the auth package
						'redirect_uri',
						'response_type',
						'client_id',
						'identity_provider',
						'code_challenge',
						'code_challenge_method',
						'grant_type',
						'code_verifier',
						'logout_uri',
						'id_token',
						'access_token',
						'refresh_token',
						'token_type',
						'expires_in',
						'error_description',
						'error_message',
						// exceptions for the notifications package
						'campaign_id',
						'delivery_type',
						'treatment_id',
						'campaign_activity_id',
						'journey_activity_id',
						'journey_run_id',
						'journey_id',
					],
				},
			],

			'import/no-deprecated': 'warn',
			'import/no-empty-named-blocks': 'error',
			'import/no-mutable-exports': 'error',
			'import/no-relative-packages': 'error',
			'import/newline-after-import': 'error',

			'import/order': [
				'error',
				{
					'newlines-between': 'always',
				},
			],

			'no-eval': 'error',
			'no-param-reassign': 'error',
			'no-shadow': 'off',
			'no-use-before-define': 'off',
			'no-useless-constructor': 'off',
			'no-unused-expressions': 'off',
			'no-trailing-spaces': 'error',
			'no-return-await': 'error',
			'n/no-callback-literal': 'off',
			'object-shorthand': 'error',
			'prefer-destructuring': 'off',
			'no-console': 'error',

			'promise/catch-or-return': [
				'error',
				{
					terminationMethod: ['then', 'catch', 'asCallback', 'finally'],
				},
			],

			'sort-imports': [
				'error',
				{
					ignoreDeclarationSort: true,
				},
			],

			'unused-imports/no-unused-imports': 'error',

			'unused-imports/no-unused-vars': [
				'error',
				{
					vars: 'all',
					varsIgnorePattern: '^_',
					args: 'after-used',
					argsIgnorePattern: '^_',
					caughtErrors: 'none',
				},
			],

			'valid-typeof': [
				'error',
				{
					requireStringLiterals: false,
				},
			],

			'@stylistic/comma-dangle': [
				'error',
				{
					arrays: 'always-multiline',
					objects: 'always-multiline',
					imports: 'always-multiline',
					exports: 'always-multiline',
					functions: 'always-multiline',
					enums: 'always-multiline',
					generics: 'always-multiline',
					tuples: 'always-multiline',
				},
			],

			'@stylistic/function-call-argument-newline': ['error', 'consistent'],
			'@stylistic/indent': 'off',

			'@stylistic/max-len': [
				'error',
				{
					code: 120,
					ignoreComments: true,
					ignoreUrls: true,
					ignoreStrings: true,
					ignoreTemplateLiterals: true,
					ignoreRegExpLiterals: true,
				},
			],

			'@stylistic/padding-line-between-statements': [
				'error',
				{
					blankLine: 'always',
					prev: '*',
					next: 'return',
				},
			],

			'@stylistic/space-before-function-paren': [
				'error',
				{
					anonymous: 'never',
					named: 'never',
					asyncArrow: 'always',
				},
			],

			'@typescript-eslint/method-signature-style': ['error', 'method'],
			'@typescript-eslint/no-confusing-void-expression': 'error',
			'@typescript-eslint/no-explicit-any': 'off',

			'@typescript-eslint/no-namespace': [
				'error',
				{
					allowDeclarations: true,
				},
			],

			'@typescript-eslint/no-shadow': 'error',
			'@typescript-eslint/no-var-requires': 'off',
			'@typescript-eslint/no-unused-vars': 'off',

			'@typescript-eslint/no-unused-expressions': [
				'error',
				{
					allowShortCircuit: true,
					allowTernary: true,
				},
			],

			'@typescript-eslint/no-use-before-define': [
				'error',
				{
					functions: false,
					variables: false,
					classes: false,
				},
			],

			'@typescript-eslint/no-useless-constructor': 'error',
			'@typescript-eslint/no-require-imports': 'off',

			'@typescript-eslint/prefer-destructuring': [
				'error',
				{
					object: true,
					array: false,
				},
			],

			'jsdoc/no-undefined-types': 1,
		},
	},
	{
		ignores: [
			'**/**.{native,android,ios}.**',
			'**/__tests__/**',
			'**/packages/adapter-nextjs/**',
			'**/packages/react-native/example/**',
			'**/packages/rtn-passkeys/example/**',
		],
		rules: {
			'import/no-extraneous-dependencies': 'error',
		},
	},
];

```

### Core Architecture Module: `jest.config.js`
```
/** @type {import('jest').Config} */
module.exports = {
	workerIdleMemoryLimit: '512MB',
	coveragePathIgnorePatterns: ['/node_modules/', 'dist', '__tests__'],
	setupFiles: ['../../jest.setup.js'],
	testEnvironment: 'jsdom',
	testRegex: '/__tests__/.*\\.(test|spec)\\.[jt]sx?$',
	transform: {
		'^.+\\.(js|jsx|ts|tsx)$': [
			'ts-jest',
			{
				tsconfig: {
					allowJs: true,
					lib: ['dom', 'es2020'],
					noImplicitAny: false,
					types: ['jest', 'jsdom'],
				},
			},
		],
	},
};

```

### Core Architecture Module: `jest.setup.js`
```
// Suppress console messages printing during unit tests.
// Comment out log level as necessary (e.g. while debugging tests)
global.console = {
	...console,
	log: jest.fn(),
	debug: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
};

// React Native global
global['__DEV__'] = true;

/* this is available according to
	https://developer.mozilla.org/en-US/docs/Web/API/URL

	for react-native use:
	import { loadUrlPolyfill } from '@aws-amplify/react-native';
 */
Object.defineProperty(URL, 'parse', {
	value: (path, origin) => {
		try {
			return new URL(path, origin);
		} catch {
			return null;
		}
	},
});

Object.defineProperty(URL, 'canParse', {
	value: (path, origin) => {
		const out = URL.parse(path, origin);
		return null !== out;
	},
});

```

### Core Architecture Module: `packages/adapter-nextjs/jest.config.js`
```
module.exports = {
	...require('../../jest.config'),
	testEnvironment: 'node',
	coverageThreshold: {
		global: {
			branches: 88,
			functions: 90,
			lines: 92,
			statements: 93,
		},
	},
};

```

### Core Architecture Module: `packages/adapter-nextjs/rollup.config.mjs`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import { getInputForGlob } from '../../rollup/utils.mjs';
import {
	cjsOutput,
	cjsTSOptions,
	esmOutput,
	esmTSOptions,
} from '../../rollup/common.mjs';

const input = getInputForGlob('src/**/*.ts');

const config = defineConfig([
	// CJS config
	{
		input: input,
		output: cjsOutput,
		plugins: [typescript(cjsTSOptions)],
	},
	// ESM config
	{
		input: input,
		output: esmOutput,
		plugins: [typescript(esmTSOptions)],
	},
]);

export default config;

```

### Core Architecture Module: `packages/adapter-nextjs/src/api/createServerRunnerForAPI.ts`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ResourcesConfig } from 'aws-amplify';
import { parseAmplifyConfig } from 'aws-amplify/utils';

import { createRunWithAmplifyServerContext, globalSettings } from '../utils';
import { NextServer } from '../types';

export const createServerRunnerForAPI = ({
	config,
}: NextServer.CreateServerRunnerInput): Omit<
	NextServer.CreateServerRunnerOutput,
	'createAuthRouteHandlers'
> & {
	resourcesConfig: ResourcesConfig;
} => {
	const amplifyConfig = parseAmplifyConfig(config);

	return {
		runWithAmplifyServerContext: createRunWithAmplifyServerContext({
			config: amplifyConfig,
			globalSettings,
		}),
		resourcesConfig: amplifyConfig,
	};
};

```

### Core Architecture Module: `packages/adapter-nextjs/src/api/generateServerClient.ts`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
	CommonPublicClientOptions,
	DefaultCommonClientOptions,
	V6ClientSSRCookies,
	V6ClientSSRRequest,
	generateClientWithAmplifyInstance,
} from 'aws-amplify/api/internals';
import { generateClient } from 'aws-amplify/api/server';
import {
	AMPLIFY_CONTEXT_BRAND,
	AmplifyContext,
	AmplifyError,
	createAmplifyContextToken,
} from 'aws-amplify/adapter-core/internals';
import { parseAmplifyConfig } from 'aws-amplify/utils';

import { NextServer } from '../types';

import { createServerRunnerForAPI } from './createServerRunnerForAPI';

interface CookiesClientParams {
	cookies: NextServer.ServerComponentContext['cookies'];
	config: NextServer.CreateServerRunnerInput['config'];
}

interface ReqClientParams {
	config: NextServer.CreateServerRunnerInput['config'];
}

/**
 * Generates an API client that can be used inside a Next.js Server Component with Dynamic Rendering
 *
 * @example
 * import { cookies } from "next/headers"
 *
 * const client = generateServerClientUsingCookies({ cookies });
 * const result = await client.graphql({ query: listPosts });
 */
export function generateServerClientUsingCookies<
	T extends Record<any, any> = never,
	Options extends CommonPublicClientOptions &
		CookiesClientParams = DefaultCommonClientOptions & CookiesClientParams,
>(options: Options): V6ClientSSRCookies<T, Options> {
	if (typeof options.cookies !== 'function') {
		throw new AmplifyError({
			name: 'InvalidCookiesError',
			message:
				'generateServerClientUsingCookies is only compatible with the `cookies` Dynamic Function available in Server Components.',
			// TODO: link to docs
			recoverySuggestion:
				'Use `generateServerClient` inside of `runWithAmplifyServerContext` with the `request` object.',
		});
	}

	const { runWithAmplifyServerContext, resourcesConfig } =
		createServerRunnerForAPI({ config: options.config });

	// Client-bound, branded `AmplifyContext` stored as the client's internal
	// `amplify` instance (replacing main's closure form). Configuration is
	// static per client, while every auth operation delegates per call into
	// `runWithAmplifyServerContext` so it reads the CURRENT request's cookies —
	// per-request isolation is preserved because the runner builds a fresh
	// per-request context (with cookie-backed token/credentials providers) on
	// every invocation.
	//
	// Carrying the brand + token also keeps this client compatible with
	// `@aws-amplify/data-schema`, which duck-types contexts structurally via
	// `typeof arg?.token?.value === 'symbol'`.
	const runWithPerRequestContext = <OperationResult>(
		operation: (contextSpec: AmplifyContext) => Promise<OperationResult>,
	): Promise<OperationResult> =>
		runWithAmplifyServerContext({
			nextServerContext: { cookies: options.cookies },
			operation,
		});

	const cookiesContext: AmplifyContext = {
		resourcesConfig,
		libraryOptions: {},
		// Unique, frozen per-context identity handle (see AmplifyContextToken).
		// Attached before the brand/freeze below so the frozen context carries it.
		token: createAmplifyContextToken(),
		fetchAuthSession: fetchOptions =>
			runWithPerRequestContext(ctx => ctx.fetchAuthSession(fetchOptions)),
		clearCredentials: () =>
			runWithPerRequestContext(ctx => ctx.clearCredentials()),
		getTokens: tokenOptions =>
			runWithPerRequestContext(ctx => ctx.getTokens(tokenOptions)),
	};

	// Brand the context for runtime identification by isAmplifyContext(),
	// mirroring the core producers.
	Object.defineProperty(cookiesContext, AMPLIFY_CONTEXT_BRAND, {
		value: true,
		enumerable: false,
		configurable: false,
		writable: false,
	});

	Object.freeze(cookiesContext);

	const { cookies: _cookies, config: _config, ...params } = options;

	// The spread `...params` prevents TS from structurally verifying the argument
	// against the generation params type, so we assert the (correct) shape using
	// the factory's own parameter type — no `any` involved.
	return generateClientWithAmplifyInstance<T, V6ClientSSRCookies<T, Options>>({
		amplify: cookiesContext,
		config: resourcesConfig,
		...params,
	} as Parameters<typeof generateClientWithAmplifyInstance>[0]);
}

/**
 * Generates an API client that can be used with both Pages Router and App Router
 *
 * @example
 * import config from './amplifyconfiguration.json';
 * import { listPosts } from './graphql/queries';
 *
 * const client = generateServerClientUsingReqRes({ config });
 *
 * const result = await runWithAmplifyServerContext({
 *   nextServerContext: { request, response },
 *   operation: (contextSpec) => client.graphql(contextSpec, {
 *     query: listPosts,
 *   }),
 * });
 */
export function generateServerClientUsingReqRes<
	T extends Record<any, any> = never,
	Options extends CommonPublicClientOptions &
		ReqClientParams = DefaultCommonClientOptions & ReqClientParams,
>(options: Options): V6ClientSSRRequest<T, Options> {
	const amplifyConfig = parseAmplifyConfig(options.config);

	const { config: _config, ...params } = options;

	return generateClient<T>({
		config: amplifyConfig,
		...params,
	}) as any;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #14961** (2026-09-25): **getAmplifyDataClientConfig() custom IAM Auth.credentialsProvider broken since 6.21.0 (fetchAuthSession() returns no credentials)**
  *Symptoms*: ### Before opening, please confirm:   - [x] I have [searched for duplicate or closed issues](https://github.com/aws-amplify/amplify-js/issues?q=is%3Aissue+) and [discussions](https://github.com/aws-amplify/amplify-js/discussions). - [x] I have read the guide for [submitting bug reports](https://github.com/aws-amplify/amplify-js/blob/main/CONTRIBUTING.md#bug-reports). - [x] I have done my best to include a minimal, self-contained set of instructions for consistently reproducing the issue.  ### JavaScript Framework  React  ### Amplify APIs  Authentication  ### Amplify Version  v6  ### Amplify Categories  auth  ### Backend  Amplify Gen 2  ### Environment information  <details>  ``` # Put output below this line System:     OS: macOS 26.6.2     CPU: (8) arm64 Apple M1 Pro     Memory: 120.11 MB / 16.00 GB     Shell: 5.9 - /bin/zsh   Binaries:     Node: 24.15.0 - /Users/andrei.muresianu/.nvm/versions/node/v24.15.0/bin/node     Yarn: 1.22.22 - /opt/homebrew/bin/yarn     npm: 11.19.0 - /Users/andrei.muresianu/Documents/workspaces/devops-dashboard/node_modules/.bin/npm   Browsers:     Chrome: 153.0.8010.54     Safari: 26.6.2   npmPackages:     @atlaskit/eslint-plugin-design-system: 16.13.0 => 16.13.0      @aws-amplify/backend: 1.23.0 => 1.23.0      @aws-amplify/backend-cli: 1.10.0 => 1.10.0      @aws-sdk/client-appsync: 3.1137.0 => 3.1137.0      @aws-sdk/client-dynamodb: 3.1137.0 => 3.1137.0      @aws-sdk/client-resource-groups-tagging-api: 3.1137.0 => 3.1137.0      @commitlint/cli: 21
  **Post-Mortem & Fix Analysis**:
  > hey @amuresia   thanks for reporting this issue. that is clearly a bug and regression for which we had no test coverage. We will work on this and quickly open up a PR.  sorry for the trouble 🙇🏻  Cheers Philipp

- **Issue #14947** (2026-09-17): **Events: an onSubscribe util.unauthorized() deny closes the whole socket and loops (kills sibling subscriptions)**
  *Symptoms*: ### Before opening, please confirm:  - [x] I have searched for duplicate or closed issues.  ### JavaScript Framework  Not applicable (Node.js)  ### Amplify APIs  Events (AppSync Events API)  ### Amplify Version  v6  ### Amplify Categories  api  ### Backend  AppSync Events API with an `onSubscribe` authorization handler (APPSYNC_JS)  ## Describe the bug  `aws-amplify` **6.20.0** / `@aws-amplify/api-graphql` **4.8.10**.  When an `onSubscribe` handler denies a single subscription using `util.unauthorized()`, AppSync returns an error frame whose `errorType` is `Unauthorized`. Amplify's `AUTH_ERROR_TYPES` check classifies that as a credentials problem and tears down the **entire WebSocket**, rather than failing just the one subscription.  The socket then reconnects, re-establishes all subscriptions including the one that is legitimately denied, is denied again, and closes again — an unbounded deny/reconnect loop. Every unrelated subscription multiplexed onto that socket is destroyed on each cycle.  The same classification also triggers on an error frame whose **message** contains `Token expired`, even when the credentials are valid.  ## Expected behavior  A per-subscription authorization denial should fail that subscription's observable (`error` callback) and leave the socket and all sibling subscriptions intact. Only an actual connection-level credentials failure should tear down the socket.  At minimum, the reconnect should be bounded so a permanently-denied subscription cannot 
  **Post-Mortem & Fix Analysis**:
  > Hi @ataran-dev,   Thank you for creating this issue. We will look into that and get back to you as soon as we have more information or need additional details.

- **Issue #14946** (2026-09-17): **Events: a publish is rejected by an unrelated subscription's error frame (message is actually delivered)**
  *Symptoms*: ### Before opening, please confirm:  - [x] I have searched for duplicate or closed issues.  ### JavaScript Framework  Not applicable (Node.js)  ### Amplify APIs  Events (AppSync Events API)  ### Amplify Version  v6  ### Amplify Categories  api  ### Backend  Amplify Gen 2 / AppSync Events API (created directly)  ## Describe the bug  `aws-amplify` **6.20.0** / `@aws-amplify/api-graphql` **4.8.10**.  The Events client multiplexes every channel onto a single WebSocket. In `AWSWebSocketProvider`'s `_publishMessage`, the **resolve** branch is keyed to the publish's own subscription id, but the **reject** branch is keyed to nothing:  ```js // dist/esm/Providers/AWSWebSocketProvider/index.mjs, _publishMessage if (data.id === subscriptionId && data.type === 'publish_success') {     resolve();                       // correctly scoped to this publish } ... if (data.errors && data.errors.length > 0) {     reject(new Error(`Publish errors: ...`));   // no id check, no type check } ```  The result is that **any** frame carrying `errors` on that socket rejects whatever publish happens to be in flight — including a `subscribe_error` belonging to a completely unrelated subscription on a different channel.  The caller is therefore told its publish failed for a message that was in fact **accepted, persisted and fanned out**. A client that retries on that rejection duplicates the message.  ## Expected behavior  A publish promise should only be rejected by an error frame that belongs to that pub
  **Post-Mortem & Fix Analysis**:
  > Hi @ataran-dev,   Thank you for creating this issue. We will look into that and get back to you as soon as we have more information or need additional details.

- **Issue #14909** (2026-08-20): **NewDeviceMetadata not returned when using a CUSTOM_AUTH flow.**
  *Symptoms*: ### Before opening, please confirm:   - [x] I have [searched for duplicate or closed issues](https://github.com/aws-amplify/amplify-js/issues?q=is%3Aissue+) and [discussions](https://github.com/aws-amplify/amplify-js/discussions). - [x] I have read the guide for [submitting bug reports](https://github.com/aws-amplify/amplify-js/blob/main/CONTRIBUTING.md#bug-reports). - [x] I have done my best to include a minimal, self-contained set of instructions for consistently reproducing the issue.  ### JavaScript Framework  React  ### Amplify APIs  Authentication  ### Amplify Version  v6  ### Amplify Categories  auth  ### Backend  Amplify CLI  ### Environment information  <details>  ``` # Put output below this line  System:     OS: Windows 10 10.0.19045     CPU: (12) x64 Intel(R) Core(TM) i7-10750H CPU @ 2.60GHz     Memory: 2.35 GB / 15.83 GB   Binaries:     Node: 24.11.0 - C:\Program Files\nodejs\node.EXE     npm: 11.6.1 - C:\Program Files\nodejs\npm.CMD   Browsers:     Chrome: 151.0.7922.76     Edge: Chromium (151.0.4129.72)     Internet Explorer: 11.0.19041.5794   npmPackages:     @carbon/icons-react: 11.80.0 => 11.80.0      @carbon/react: 1.107.1 => 1.107.1      @casl/ability: ^6.3.3 => 6.8.0      @casl/ability/extra:  undefined ()     @casl/react: ^3.1.0 => 3.1.0      @embedpdf/core: ^2.14.0 => 2.14.0      @embedpdf/engines: ^2.14.0 => 2.14.0      @embedpdf/plugin-document-manager: ^2.14.0 => 2.14.0      @embedpdf/plugin-interaction-manager: ^2.14.0 => 2.14.0      @embedpdf/plugin
  **Post-Mortem & Fix Analysis**:
  > Hey @rexidecimal9  Looking at the issue and the description, it looks like a bug. I will classify it as such and will take a look into it.  I will let you know of any outcome
  >  Thanks for reaching out @rexidecimal9.    Cognito does not issue `NewDeviceMetadata` for the native `CUSTOM_AUTH` flow. Device tracking is only bootstrapped through the SRP/password-verifier path (`USER_SRP_AUTH` with the `PASSWORD_VERIFIER` challenge, or `USER_PASSWORD_AUTH`). Because `CUSTOM_AUTH` runs the Define/Create/Verify Auth Challenge Lambda triggers and bypasses SRP verification, the `AuthenticationResult` comes back without `NewDeviceMetadata` (no DeviceKey/DeviceGroupKey), so "Remember devices" is not established through a pure custom auth flow.    If you need device tracking specifically within a pure CUSTOM_AUTH flow, that isn't currently supported by Cognito. For a feature request or a deeper account-specific investigation, please [open a case with AWS Support](https://support.console.aws.amazon.com/support/home#/case/create). I will be closing this issue as this is a limitation on Cognito's side.

- **Issue #14897** (2026-08-03): **signInWithRedirect always sends identity_provider=COGNITO, preventing Cognito from resuming a federated session**
  *Symptoms*: ### Before opening, please confirm:   - [x] I have [searched for duplicate or closed issues](https://github.com/aws-amplify/amplify-js/issues?q=is%3Aissue+) and [discussions](https://github.com/aws-amplify/amplify-js/discussions). - [x] I have read the guide for [submitting bug reports](https://github.com/aws-amplify/amplify-js/blob/main/CONTRIBUTING.md#bug-reports). - [x] I have done my best to include a minimal, self-contained set of instructions for consistently reproducing the issue.  ### JavaScript Framework  Angular  ### Amplify APIs  Authentication  ### Amplify Version  v6  ### Amplify Categories  auth  ### Backend  None  ### Environment information  <details>  ``` # Put output below this line System:     OS: Windows 11 10.0.26200     CPU: (24) x64 13th Gen Intel(R) Core(TM) i7-13700HX   Binaries:     Node: 24.0.0     npm: 11.3.0   Browsers:     Chrome: 150.0.7871.184   npmPackages:     @angular/core: ^21.1.0 => 21.1.0     aws-amplify: ^6.16.2 => 6.16.2     typescript: ~5.9.3 => 5.9.3  @aws-amplify/auth resolves to 6.19.1   ```  </details>   ### Describe the bug  <html> <body> <!--StartFragment--><html><head></head><body><h2>Description</h2><p><code inline="">signInWithRedirect()</code> unconditionally adds an <code inline="">identity_provider</code> parameter to the <code inline="">/oauth2/authorize</code> request. When the caller does not specify a provider, Amplify defaults the value to <code inline="">COGNITO</code>.</p><p>Cognito treats <code inline="">identity_pr
  **Post-Mortem & Fix Analysis**:
  > Hi @jeremyswensen,  Thanks for the detailed writeup and the test matrix. We will investigate and update here as soon as we have more information.

- **Issue #14863** (2026-07-08): **Amplify has not been configured warning when opening app in a new browser tab while already logged In.**
  *Symptoms*: ### Before opening, please confirm:   - [x] I have [searched for duplicate or closed issues](https://github.com/aws-amplify/amplify-js/issues?q=is%3Aissue+) and [discussions](https://github.com/aws-amplify/amplify-js/discussions). - [x] I have read the guide for [submitting bug reports](https://github.com/aws-amplify/amplify-js/blob/main/CONTRIBUTING.md#bug-reports). - [x] I have done my best to include a minimal, self-contained set of instructions for consistently reproducing the issue.  ### JavaScript Framework  Angular  ### Amplify APIs  Authentication  ### Amplify Version  v6  ### Amplify Categories  auth  ### Backend  None  ### Environment information  aws-amplify: 6.17.0 Framework: Angular with Module Federation (NX monorepo) Auth: Amazon Cognito (custom auth flow / magic link)  ### Describe the bug  When the application is already open and authenticated in one browser tab, opening a new tab triggers a console warning:  **Amplify has not been configured. Please call Amplify.configure() before using this service.**  This occurs even though `Amplify.configure()` is called during app initialization. The warning fires during the auth flow (`sigOut` / `signIn` calls)  ### Expected behavior  No warning should appear. The Amplify configuration applied during app startup should persist and be available across the entire session, including flows triggered in new tabs.  ### Reproduction steps  1. Open the app in a browser tab and log in 2. While still logged in, open a new tab in
  **Post-Mortem & Fix Analysis**:
  > Hi @osama-rizk / @Simone319 , could someone please take a look at this issue and help ?
  >  Hey @ashishrawat-19 ,    Thank you for creating this issue. We will investigate and get back to you as soon as we have more information or need additional details. 
  > After further investigation, I found for Basic Auth login it is working, issue only in SSO flow. Here's the complete picture: Our SSO Auth Flow We do not use Amplify's signInWithRedirect(). Instead: 1. App redirects to Cognito Hosted UI (authorize endpoint) 2. Cognito creates a session 3. App calls Cognito's /oauth2/token endpoint directly to get tokens 4. App manually feeds those tokens into Amplify using a custom tokenProvider: ```typescript configureAmplify(): void {     const isSsoFromSession =       sessionStorage.getItem(authorization.AuthConstants.LoginVia) ===       authorization.AuthConstants.SSO;      const isSsoFromCookie = this.isSsoUserFromAccessTokenCookie();     const isSsoUser = isSsoFromSession || isSsoFromCookie;      if (isSsoUser) {       // Rehydrate sessionStorage so downstream checks stay compatible       if (!isSsoFromSession) {         sessionStorage.setItem(           authorization.AuthConstants.LoginVia,           authorization.AuthConstants.SSO         );   

- **Issue #14827** (2026-07-07): **uuid, js-cookie and axios updates for v5**
  *Symptoms*: ### Before opening, please confirm:   - [x] I have [searched for duplicate or closed issues](https://github.com/aws-amplify/amplify-js/issues?q=is%3Aissue+) and [discussions](https://github.com/aws-amplify/amplify-js/discussions). - [x] I have read the guide for [submitting bug reports](https://github.com/aws-amplify/amplify-js/blob/main/CONTRIBUTING.md#bug-reports). - [x] I have done my best to include a minimal, self-contained set of instructions for consistently reproducing the issue.  ### JavaScript Framework  Not applicable  ### Amplify APIs  Not applicable  ### Amplify Version  v5  ### Amplify Categories  Not applicable  ### Backend  None  ### Environment information  <details>  ``` # Put output below this line   System:     OS: macOS 26.5     CPU: (10) arm64 Apple M4     Memory: 218.36 MB / 16.00 GB     Shell: 5.9 - /bin/zsh   Binaries:     Node: 24.13.0 - /Users/brendan/.nvm/versions/node/v24.13.0/bin/node     Yarn: 1.22.22 - /Users/brendan/.nvm/versions/node/v24.13.0/bin/yarn     npm: 11.12.1 - /Users/brendan/.nvm/versions/node/v24.13.0/bin/npm   Browsers:     Chrome: 148.0.7778.179     Safari: 26.5   npmPackages:     aws-amplify: ^5.0.0 => 5.3.33   npmGlobalPackages:     corepack: 0.34.5     http-server: 14.1.1     npm: 11.12.1     yarn: 1.22.22  ```  </details>   ### Describe the bug  I can see there are current PRs open for v6 to address the recent high severity CVEs for uuid ([GHSA-w5hq-g745-h8pq)](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745
  **Post-Mortem & Fix Analysis**:
  > Looking again, I think axios might also be in need of a bump up to at least 1.16.1 to address the security issues patched as mentioned in [the tag](https://github.com/axios/axios/releases/tag/v1.16.1) and some critical/highs in the intervening releases: ``` % npm why axios | grep axios axios@1.13.6 node_modules/axios   axios@"1.13.6" from @aws-amplify/api-rest@3.5.18 ```
  > Hi @brendanqshuttleid ,   Thank you for creating this issue. We will look into that and provide any updates here.
  > Hi @soberm,  I can see you've done some work around this, which is very much appreciated, some of which has been merged.  Just wondering if you have a timescale on when we might see a release to address the updates?  Thanks again.

- **Issue #14820** (2026-06-04): **fix(aws-amplify): refresh default Cognito auth config on DefaultAmplify reconfigure**
  *Symptoms*: ### Before opening, please confirm:   - [x] I have [searched for duplicate or closed issues](https://github.com/aws-amplify/amplify-js/issues?q=is%3Aissue+) and [discussions](https://github.com/aws-amplify/amplify-js/discussions). - [x] I have read the guide for [submitting bug reports](https://github.com/aws-amplify/amplify-js/blob/main/CONTRIBUTING.md#bug-reports). - [x] I have done my best to include a minimal, self-contained set of instructions for consistently reproducing the issue.  ### JavaScript Framework  Next.js  ### Amplify APIs  Authentication, Storage  ### Amplify Version  v6  ### Amplify Categories  auth, storage  ### Backend  Amplify Gen 2  ### Environment information  <details>  ``` # Put output below this line  System:   OS: Windows 11 10.0.26200   CPU: (8) x64 Intel(R) Core(TM) Ultra 7 256V   Memory: 1.94 GB / 15.54 GB Binaries:   Node: 22.17.0   npm: 10.9.2 Browsers:   Edge: Chromium (140.0.3485.54) npmPackages:   aws-amplify: 6.x (latest on npm at time of report)  ```  </details>   ### Describe the bug  When using Amplify.configure from the aws-amplify package (DefaultAmplify.configure in packages/aws-amplify/src/initSingleton.ts), subsequent configure calls can behave incorrectly in two ways:  1. Non-Auth libraryOptions are dropped on reconfigure @aws-amplify/core replaces libraryOptions when a new object is passed (no merge). DefaultAmplify is responsible for merging before calling core, but several reconfigure paths did not:  Passing libraryOptions.Auth
  **Post-Mortem & Fix Analysis**:
  > I have already worked on the solution for this issue Please review below pr: https://github.com/aws-amplify/amplify-js/pull/14819
  > hey @ShrutiPundir17   thanks for reporting this issue. I think this is a bug too, but might not be possible to fix without a breaking change.   See this example: ```ts // first configure Amplify.configure({   Auth: {     Cognito: {       userPoolId: 'us-east-1_poolA',       userPoolClientId: 'client-a',     },   },   API: {     endpoint: "https://my-auth-website.com"   } }, {   API: {     REST: {       headers: () => new Headers({ auth: `Bearer ${myToken}` })     }   } });  // second configure Amplify.configure({   Auth: {     Cognito: {       userPoolId: 'us-east-1_poolB',       userPoolClientId: 'client-b',     },   },   API: {     endpoint: "https://sketchy-anon-website-where-i-dont-want-tokens-to-leak.com"   } }, {   Auth: {     headers: () => new Headers({ `x-do-not-track`: true })   } }) ```  the second configure - since it has `Auth` libraryOptions, would inherit the API libraryOptions (through `Amplify.libraryOptions`) from the first configure, potentially leaking sensitive inf
  > Let's discuss this in this issue. if we come to the conclusion that the PR makes sense, we can move forward with it.

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

### Incident Patch 1: `58609d9e` (2026-09-25)
**Commit Message**: fix(core): honor custom Auth providers when the resource config has no Auth block (#14962)

createAmplifyContext() only called AuthClass.configure() when resourcesConfig.Auth was present. That call is the sole place AuthClass stores libraryOptions.Auth, so a resource config with no Auth block left custom token/credentials providers unregistered: fetchAuthSession() resolved with credentials: undefined and the iam GraphQL auth mode threw "No credentials".

This is the shape @aws-amplify/backend-function's getAmplifyDataClientConfig() produces for IAM-authorized Data access inside a Lambda. It worked through the pre-context singleton, whose AmplifyClass.configure() calls this.Auth.configure() unconditionally, and broke when Amplify.configure() moved onto the context factory.

Fixes #14961

**File**: `.changeset/fix-core-context-custom-auth-providers.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@aws-amplify/core': patch
+---
+
+fix(core): honor custom `libraryOptions.Auth` providers when the resource config carries no `Auth` block
```

**File**: `packages/core/__tests__/context/createAmplifyContext.test.ts` (modified, +103/-0)
```diff
@@ -155,6 +155,109 @@ describe('createAmplifyContext', () => {
 			const ctx2 = createAmplifyContext(resourcesConfig);
 			expect(ctx1).not.toBe(ctx2);
 		});
+
+		it('still hands the real Auth config to a custom provider when the resource config HAS an Auth block', async () => {
+			// Guards the path that already worked before the guard was removed:
+			// with `Auth` present, the provider must receive that config rather
+			// than `undefined`.
+			const { tokenProvider, credentialsProvider } = buildProviders();
+			const ctx = createAmplifyContext(resourcesConfig, {
+				Auth: { tokenProvider, credentialsProvider },
+			});
+
+			await ctx.fetchAuthSession();
+
+			expect(
+				credentialsProvider.getCredentialsAndIdentityId,
+			).toHaveBeenCalledWith(
+				expect.objectContaining({
+					authConfig: resourcesConfig.Auth,
+					authenticated: true,
+				}),
+			);
+			expect(
+				credentialsProvider.getCredentialsAndIdentityId.mock.calls[0][0]
+					.authConfig?.Cognito?.userPoolId,
+			).toBe('us-east-1_test');
+		});
+	});
+
+	describe('custom Auth providers with no Auth resource config', () => {
+		// Regression: the Lambda IAM shape produced by
+		// `getAmplifyDataClientConfig()` — an `API.GraphQL`-only resource config
+		// plus a custom `credentialsProvider` that returns the function's own
+		// execution-role credentials. Wiring the per-context AuthClass only when
+		// `resourcesConfig.Auth` was present left `libraryOptions.Auth`
+		// unregistered, so `fetchAuthSession()` resolved without credentials and
+		// the `iam` GraphQL auth mode threw "No credentials".
+		const iamResourcesConfig: ResourcesConfig = {
+			API: {
+				GraphQL: {
+					endpoint: 'https://test.appsync-api.us-east-1.amazonaws.com/graphql',
+					region: 'us-east-1',
+					defaultAuthMode: 'iam',
+				},
+			},
+		};
+
+		it('invokes a custom credentialsProvider from fetchAuthSession', async () => {
+			const { credentialsProvider } = buildProviders();
+			const ctx = createAmplifyContext(iamResourcesConfig, {
+				Auth: { credentialsProvider },
+			});
+
+			const session = await ctx.fetchAuthSession();
+
+			// `authConfig: undefined` is the point, not an oversight: with no
+			// `Auth` block there is no auth resource config to hand the provider,
+			// and a custom provider that sources its own credentials does not
+			// need one. Pinning it here keeps the contract explicit.
+			expect(
+				credentialsProvider.getCredentialsAndIdentityId,
+			).toHaveBeenCalledWith({
+				authConfig: undefined,
+				authenticated: false,
+				forceRefresh: undefined,
+			});
+			expect(session.credentials).toEqual({ accessKeyId: 'AKIA' });
+		});
+
+		it('invokes a custom tokenProvider from getTokens', async () => {
+			const { tokenProvider } = buildProviders();
+			const ctx = createAmplifyContext(iamResourcesConfig, {
+				Auth: { tokenProvider },
+			});
+
+			await ctx.getTokens({ forceRefresh: false });
+
+			expect(tokenProvider.getTokens).toHaveBeenCalledWith({
+				forceRefresh: false,
+			});
+		});
+
+		it('invokes a custom credentialsProvider from clearCredentials', async () => {
+			const { credentialsProvider } = buildProviders();
+			const ctx = createAmplifyContext(iamResourcesConfig, {
+				Auth: { credentialsProvider },
+			});
+
+			await ctx.clearCredentials();
+
+			expect(
+				credentialsProvider.clearCredentialsAndIdentityId,
+			).toHaveBeenCalledTimes(1);
+		});
+
+		it('resolves an empty session when no Auth providers are supplied', async () => {
+			const ctx = createAmplifyContext(iamResourcesConfig);
+
+			await expect(ctx.fetchAuthSession()).resolves.toEqual({
+				tokens: undefined,
+				credentials: undefined,
+				identityId: undefined,
+				userSub: undefined,
+			});
+		});
 	});
 
 	describe('skipConfigParse (internal single-parse option)', () => {
```

**File**: `packages/core/src/context/createAmplifyContext.ts` (modified, +15/-3)
```diff
@@ -93,10 +93,22 @@ export function createAmplifyContext(
 
 	// Fresh, per-context Auth instance (not the global singleton) so that
 	// multiple contexts remain isolated from one another.
+	//
+	// `configure()` is called UNCONDITIONALLY, exactly as the pre-context
+	// `AmplifyClass.configure()` does (see singleton/Amplify.ts). It is the only
+	// place `AuthClass` stores `libraryOptions.Auth`, so gating it on the
+	// presence of `resourcesConfig.Auth` would silently drop caller-supplied
+	// token/credentials providers whenever the resource config carries no `Auth`
+	// block — the shape `getAmplifyDataClientConfig()` produces for IAM-authed
+	// Data access from a Lambda (`API.GraphQL` only, plus a custom
+	// `credentialsProvider`). `AuthClass.configure()` tolerates an undefined
+	// auth resource config.
+	//
+	// The `Auth!` assertion is deliberately false: in the very case this fixes,
+	// `Auth` IS undefined at runtime. It mirrors the identical assertion in the
+	// singleton rather than widening `AuthClass.configure()`'s parameter type.
 	const auth = new AuthClass();
-	if (resolvedResourceConfig.Auth) {
-		auth.configure(resolvedResourceConfig.Auth, resolvedLibraryOptions.Auth);
-	}
+	auth.configure(resolvedResourceConfig.Auth!, resolvedLibraryOptions.Auth);
 
 	const ctx: AmplifyContext = {
 		// Already deep-frozen above (both parse paths).
```

---

### Incident Patch 2: `dd20d261` (2026-09-25)
**Commit Message**: fix(core): externalize tslib to fix SSR module resolution (#14956)

fix(core): mark tslib external to fix SSR module resolution

**File**: `.changeset/tslib-external-ssr-resolution.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@aws-amplify/core': patch
+---
+
+fix(core): mark tslib as external in the rollup build so ESM/CJS output imports the bare `tslib` specifier instead of a vendored nested copy, fixing SSR module resolution (ERR_MODULE_NOT_FOUND) under bundlers like Nitro/Nuxt
```

**File**: `packages/core/rollup.config.mjs` (modified, +9/-0)
```diff
@@ -13,16 +13,25 @@ import {
 
 const input = getInputForGlob('src/**/*.ts');
 
+// Keep `tslib` a bare external specifier. With `importHelpers` enabled,
+// downleveled helpers (e.g. for native `#private` fields) import from
+// `tslib`; without this, rollup would bundle it and `preserveModules` would
+// emit a nested `node_modules/tslib` copy that SSR bundlers (Nitro/Nuxt)
+// fail to trace, causing ERR_MODULE_NOT_FOUND. tslib is a runtime dependency.
+const external = [/^tslib(\/.*)?$/];
+
 const config = defineConfig([
 	// CJS config
 	{
 		input: input,
+		external,
 		output: cjsOutput,
 		plugins: [typescript(cjsTSOptions)],
 	},
 	// ESM config
 	{
 		input: input,
+		external,
 		output: esmOutput,
 		plugins: [typescript(esmTSOptions)],
 	},
```

---

### Incident Patch 3: `d8f5356d` (2026-09-18)
**Commit Message**: fix(auth): local AmplifyContext sign-in without Amplify.configure() (#14948)

* fix(core): restore Amplify.getConfig() empty-config behavior before configure()

The aws-amplify umbrella Amplify.getConfig() was rewritten in #14931 to route through getGlobalContext(), which throws NoAmplifyContextError when Amplify.configure() has not been called. Released 6.20.0 behavior was to warn and return an empty config ({}). This unintended regression crashed the storage/local-context e2e (the sample renders Amplify.getConfig() before configure and expects {}), gating the 6.21.0 release.

Restore the pre-configure contract: getConfig() now warns and returns {} when there is no global context (via the existing hasGlobalContext() guard), and returns the real resourcesConfig once configured. Category fn(ctx, input) APIs and the getGlobalContext()/NoAmplifyContextError guard are unchanged; the adapter-nextjs InvalidServerContextError SSR guard is untouched.

* fix(auth): persist sign-in tokens to the per-context orchestrator for local AmplifyContext

Sign-in flows persisted Cognito tokens via a module-level singleton tokenOrchestrator whose authConfig/storage are set only by Amplify.configure(). 

**File**: `.changeset/local-context-auth.md` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+---
+"aws-amplify": patch
+"@aws-amplify/auth": patch
+"@aws-amplify/core": patch
+---
+
+fix(auth): support user-pool sign-in through a local `createAmplifyContext()` without `Amplify.configure()`
+
+Makes a locally created `AmplifyContext` (`createAmplifyContext()`, without calling `Amplify.configure()`) usable end-to-end for Cognito user-pool auth:
+
+- `Amplify.getConfig()` again returns an empty config (`{}`) with a warning before `configure()` instead of throwing `NoAmplifyContextError`, restoring the released 6.20.0 contract that the explicit-AmplifyContext migration (#14931) unintentionally changed.
+- Cognito sign-in, `fetchAuthSession`, and the device APIs now resolve the per-context token orchestrator at the flow entry point (falling back to the global singleton for the `Amplify.configure()` path), so tokens persist to and are read from the same per-context store. The global `Amplify.configure()` path is unchanged.
+- Known limitation: OAuth (`signInWithRedirect`) sign-in tokens still cache to the **global** orchestrator, because OAuth completion runs after a full-page redirect via `enableOAuthListener`, at which point no `AmplifyContext` survives — so a local `createAmplifyContext()` that initiates `signInWithRedirect` cannot read its OAuth tokens back per-context. This fix covers user-pool (non-redirect) sign-in.
```

**File**: `packages/auth/__tests__/providers/cognito/deleteUser.test.ts` (modified, +10/-1)
```diff
@@ -9,7 +9,10 @@ import {
 
 import { AuthError } from '../../../src/errors/AuthError';
 import { deleteUser } from '../../../src/providers/cognito';
-import { tokenOrchestrator } from '../../../src/providers/cognito/tokenProvider';
+import {
+	resolveTokenOrchestrator,
+	tokenOrchestrator,
+} from '../../../src/providers/cognito/tokenProvider';
 import { DeleteUserException } from '../../../src/providers/cognito/types/errors';
 import { signOut } from '../../../src/providers/cognito/apis/signOut';
 import { createDeleteUserClient } from '../../../src/foundation/factories/serviceClients/cognitoIdentityProvider';
@@ -24,6 +27,12 @@ jest.mock(
 );
 jest.mock('../../../src/providers/cognito/factories');
 
+// The barrel is auto-mocked, so `resolveTokenOrchestrator` returns undefined by
+// default. Point it at the auto-mocked singleton so these suites keep
+// asserting against `tokenOrchestrator` as they did before the entry-point
+// orchestrator threading.
+jest.mocked(resolveTokenOrchestrator).mockReturnValue(tokenOrchestrator);
+
 describe('deleteUser', () => {
 	// assert mocks
 	const mockDeleteUser = jest.fn();
```

**File**: `packages/auth/__tests__/providers/cognito/forgetDevice.test.ts` (modified, +10/-1)
```diff
@@ -11,7 +11,10 @@ import { AuthError } from '../../../src/errors/AuthError';
 import { DEVICE_METADATA_NOT_FOUND_EXCEPTION } from '../../../src/errors/constants';
 import { forgetDevice } from '../../../src/providers/cognito';
 import { ForgetDeviceException } from '../../../src/providers/cognito/types/errors';
-import { tokenOrchestrator } from '../../../src/providers/cognito/tokenProvider';
+import {
+	resolveTokenOrchestrator,
+	tokenOrchestrator,
+} from '../../../src/providers/cognito/tokenProvider';
 import { createForgetDeviceClient } from '../../../src/foundation/factories/serviceClients/cognitoIdentityProvider';
 import { createCognitoUserPoolEndpointResolver } from '../../../src/providers/cognito/factories';
 
@@ -23,6 +26,12 @@ jest.mock(
 );
 jest.mock('../../../src/providers/cognito/factories');
 
+// The barrel is auto-mocked, so `resolveTokenOrchestrator` returns undefined by
+// default. Point it at the auto-mocked singleton so these suites keep
+// asserting against `tokenOrchestrator` as they did before the entry-point
+// orchestrator threading.
+jest.mocked(resolveTokenOrchestrator).mockReturnValue(tokenOrchestrator);
+
 describe('fetchMFAPreference', () => {
 	const mockDeviceMetadata = {
 		deviceKey: 'deviceKey',
```

**File**: `packages/auth/__tests__/providers/cognito/rememberDevice.test.ts` (modified, +10/-1)
```diff
@@ -10,7 +10,10 @@ import {
 import { AuthError } from '../../../src/errors/AuthError';
 import { rememberDevice } from '../../../src/providers/cognito';
 import { UpdateDeviceStatusException } from '../../../src/providers/cognito/types/errors';
-import { tokenOrchestrator } from '../../../src/providers/cognito/tokenProvider';
+import {
+	resolveTokenOrchestrator,
+	tokenOrchestrator,
+} from '../../../src/providers/cognito/tokenProvider';
 import { DeviceMetadata } from '../../../src/providers/cognito/tokenProvider/types';
 import { createUpdateDeviceStatusClient } from '../../../src/foundation/factories/serviceClients/cognitoIdentityProvider';
 import { createCognitoUserPoolEndpointResolver } from '../../../src/providers/cognito/factories';
@@ -23,6 +26,12 @@ jest.mock(
 jest.mock('../../../src/providers/cognito/factories');
 jest.mock('../../../src/providers/cognito/tokenProvider');
 
+// The barrel is auto-mocked, so `resolveTokenOrchestrator` returns undefined by
+// default. Point it at the auto-mocked singleton so these suites keep
+// asserting against `tokenOrchestrator` as they did before the entry-point
+// orchestrator threading.
+jest.mocked(resolveTokenOrchestrator).mockReturnValue(tokenOrchestrator);
+
 describe('rememberDevice', () => {
 	const mockDeviceMetadata: DeviceMetadata = {
 		deviceKey: 'deviceKey',
```

**File**: `packages/auth/__tests__/providers/cognito/signInEntryPointOrchestrator.test.ts` (added, +321/-0)
```diff
@@ -0,0 +1,321 @@
+// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
+// SPDX-License-Identifier: Apache-2.0
+
+import { AmplifyContext, KeyValueStorageInterface } from '@aws-amplify/core';
+import { registerContextTokenOrchestrator } from '@aws-amplify/core/internals/utils';
+import { createMockAmplifyContext } from '@aws-amplify/core/internals/testing';
+
+import { signInWithSRP } from '../../../src/providers/cognito/apis/signInWithSRP';
+import { signInWithUserPassword } from '../../../src/providers/cognito/apis/signInWithUserPassword';
+import { signInWithCustomAuth } from '../../../src/providers/cognito/apis/signInWithCustomAuth';
+import { signInWithCustomSRPAuth } from '../../../src/providers/cognito/apis/signInWithCustomSRPAuth';
+import { signInWithUserAuth } from '../../../src/providers/cognito/apis/signInWithUserAuth';
+import { confirmSignIn } from '../../../src/providers/cognito/apis/confirmSignIn';
+import { handleWebAuthnSignInResult } from '../../../src/client/flows/userAuth/handleWebAuthnSignInResult';
+import { handleUserAuthFlow } from '../../../src/client/flows/userAuth/handleUserAuthFlow';
+import * as signInHelpers from '../../../src/providers/cognito/utils/signInHelpers';
+import {
+	resetActiveSignInState,
+	setActiveSignInState,
+} from '../../../src/client/utils/store/signInStore';
+import { DefaultTokenStore } from '../../../src/providers/cognito/tokenProvider/TokenStore';
+import { TokenOrchestrator } from '../../../src/providers/cognito/tokenProvider/TokenOrchestrator';
+import { tokenOrchestrator as globalTokenOrchestrator } from '../../../src/providers/cognito/tokenProvider';
+import { refreshAuthTokensWithoutDedupe } from '../../../src/providers/cognito/utils/refreshAuthTokens';
+import { createRespondToAuthChallengeClient } from '../../../src/foundation/factories/serviceClients/cognitoIdentityProvider';
+import { RespondToAuthChallengeCommandOutput } from '../../../src/foundation/factories/serviceClients/cognitoIdentityProvider/types';
+
+import { authAPITestParams } from './testUtils/authApiTestParams';
+
+jest.mock('../../../src/providers/cognito/utils/dispatchSignedInHubEvent');
+jest.mock('../../../src/providers/cognito/utils/getNewDeviceMetadata', () => ({
+	getNewDeviceMetadata: jest.fn().mockResolvedValue(undefined),
+}));
+jest.mock('../../../src/client/flows/userAuth/handleUserAuthFlow');
+jest.mock('../../../src/client/utils/passkey', () => ({
+	getPasskey: jest.fn().mockResolvedValue({ id: 'mock-credential' }),
+}));
+jest.mock(
+	'../../../src/foundation/factories/serviceClients/cognitoIdentityProvider',
+	() => ({
+		...jest.requireActual(
+			'../../../src/foundation/factories/serviceClients/cognitoIdentityProvider',
+		),
+		createRespondToAuthChallengeClient: jest.fn(),
+	}),
+);
+
+const authConfig = {
+	Cognito: {
+		userPoolClientId: '111111-aaaaa-42d8-891d-ee81a1549398',
+		userPoolId: 'us-west-2_zzzzz',
+	},
+};
+
+const createMemoryStorage = (): KeyValueStorageInterface => {
+	const store = new Map<string, string>();
+
+	return {
+		setItem: async (key, value) => {
+			store.set(key, value);
+		},
+		getItem: async key => store.get(key) ?? null,
+		removeItem: async key => {
+			store.delete(key);
+		},
+		clear: async () => {
+			store.clear();
+		},
+	};
+};
+
+/**
+ * Builds the write-capable per-context orchestrator exactly the way
+ * `createUserPoolsTokenProvider` does for a local `AmplifyContext`.
+ */
+const createContextOrchestrator = (): TokenOrchestrator => {
+	const tokenStore = new DefaultTokenStore();
+	tokenStore.setAuthConfig(authConfig);
+	tokenStore.setKeyValueStorage(createMemoryStorage());
+
+	const orchestrator = new TokenOrchestrator();
+	orchestrator.setAuthConfig(authConfig);
+	orchestrator.setAuthTokenStore(tokenStore);
+	orchestrator.setTokenRefresher(refreshAuthTokensWithoutDedupe);
+
+	return orchestrator;
+};
+
+/**
+ * Regression guard for the local-context sign-in defect: token WRITES were
+ * per-context but every `signIn
```

---

### Incident Patch 4: `fb070dd3` (2026-09-17)
**Commit Message**: fix(api-graphql): correlate Events publish errors by operation id (#14950)

* fix(api-graphql): correlate Events publish errors by operation id (#14946)

The Events WebSocket is multiplexed across operations. A publish promise
was rejecting on any error frame carrying `data.errors`, including
subscribe_error frames belonging to unrelated operations on other
channels. Gate rejection on `data.id === subscriptionId` so a publish
only settles on error frames correlated to its own operation id.

Adds regression coverage verifying unrelated subscribe_error frames no
longer reject a publish and matching publish_error frames still reject.

Fixes #14946

* chore(changeset): add patch changeset for api-graphql Events publish error correlation

* fix(api-graphql): gate Events publish errors on publish_error type (#14946)

Mirror the publish_success gate on the publish error branch so only the terminal publish_error frame correlated by operation id settles a pending publish. Document that AppSync Events guarantees every publish response frame carries the operation id, so uncorrelated or id-less error frames are intentionally ignored for the publish. Add a test pinning the id-less case.

**File**: `.changeset/fix-api-graphql-events-publish-error-correlation.md` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+---
+'@aws-amplify/api-graphql': patch
+---
+
+fix(api-graphql): correlate Events publish errors by operation id
+
+The AppSync Events WebSocket is multiplexed across operations, so a single
+socket carries error frames for many channels at once. A publish promise
+previously rejected on any incoming error frame that carried `data.errors` —
+including `subscribe_error` frames belonging to unrelated operations on other
+channels — causing publishes to fail spuriously.
+
+Rejection is now gated on `data.id === subscriptionId`, so a publish only
+settles on error frames correlated to its own operation id. Error frames for
+unrelated operations are ignored, while matching `publish_error` frames still
+reject the publish as before.
```

**File**: `packages/api-graphql/__tests__/AWSAppSyncEventProvider.test.ts` (modified, +201/-0)
```diff
@@ -721,6 +721,207 @@ describe('AppSyncEventProvider', () => {
 		});
 	});
 
+	describe('publish error-frame correlation (issue #14946)', () => {
+		let provider: AWSAppSyncEventProvider;
+		let reachabilityObserver: Observer<{ online: boolean }>;
+		let messageListeners: EventListener[];
+		let capturedPublishId: string | undefined;
+
+		beforeEach(() => {
+			// Set the network to "online" for these tests
+			jest
+				.spyOn(Reachability.prototype, 'networkMonitor')
+				.mockImplementationOnce(
+					() =>
+						new Observable(observer => {
+							reachabilityObserver = observer;
+						}),
+				)
+				// Twice because we subscribe to get the initial state then again to monitor reachability
+				.mockImplementationOnce(
+					() =>
+						new Observable(observer => {
+							reachabilityObserver = observer;
+						}),
+				);
+
+			provider = new AWSAppSyncEventProvider();
+
+			messageListeners = [];
+			capturedPublishId = undefined;
+
+			// Minimal controllable socket: it records the 'message' listener the
+			// provider registers for the publish and captures the id of the frame
+			// it sends, so the test can replay arbitrary server frames and assert
+			// how the publish promise correlates them. (The shared
+			// FakeWebSocketInterface no-ops addEventListener, so it cannot exercise
+			// the publish listener path.)
+			const controllableSocket = {
+				onclose: (_event: CloseEvent) => {},
+				onerror: (_event: Event) => {},
+				addEventListener: (type: string, listener: EventListener) => {
+					if (type === 'message') {
+						messageListeners.push(listener);
+					}
+				},
+				removeEventListener: (type: string, listener: EventListener) => {
+					if (type === 'message') {
+						messageListeners = messageListeners.filter(l => l !== listener);
+					}
+				},
+				send: (data: string) => {
+					capturedPublishId = JSON.parse(String(data)).id;
+				},
+				close: () => {
+					controllableSocket.onclose(new CloseEvent('close'));
+				},
+			};
+
+			Object.defineProperty(provider, 'socketStatus', {
+				value: constants.SOCKET_STATUS.READY,
+			});
+			Object.defineProperty(provider, 'awsRealTimeSocket', {
+				value: controllableSocket,
+				writable: true,
+				configurable: true,
+			});
+		});
+
+		afterEach(async () => {
+			provider?.close();
+		});
+
+		const deliverFrame = (frame: Record<string, unknown>) => {
+			const event = new MessageEvent('message', {
+				data: JSON.stringify(frame),
+			});
+			messageListeners.forEach(listener => listener(event));
+		};
+
+		const waitForPublishSent = async () => {
+			for (let i = 0; i < 200 && capturedPublishId === undefined; i++) {
+				await delay(5);
+			}
+			if (capturedPublishId === undefined) {
+				throw new Error('publish frame was never sent');
+			}
+		};
+
+		test('a pending publish is not rejected by an unrelated subscription error frame', async () => {
+			expect.assertions(1);
+
+			const pub = provider.publish({
+				appSyncGraphqlEndpoint: 'ws://localhost:8080',
+				query: 'events/allowed-channel',
+				variables: { some: 'data' },
+				authenticationType: 'iam',
+				region: 'us-east-1',
+			});
+
+			// Wait until the publish frame has been sent and its id captured.
+			await waitForPublishSent();
+
+			// An error frame for a DIFFERENT operation id (e.g. a subscribe_error
+			// on an unrelated channel) arrives while this publish is in flight.
+			// It must not settle this publish's promise.
+			deliverFrame({
+				id: 'unrelated-subscription-id',
+				type: MESSAGE_TYPES.EVENT_SUBSCRIBE_ERROR,
+				errors: [
+					{
+						errorType: 'AuthorizationError',
+						message: 'Not authorized to access channel',
+					},
+				],
+			});
+
+			// The correlated publish_success then arrives for this publish.
+			deliverFrame({
+				id: capturedPublishId,
+				type: MESSAGE_TYPES.EVENT_PUBLISH_ACK,
+			});
+
+			// The publish was accepted, so the promise must resolve — the
+			// unrelated error frame must not have rejected it.
+			awai
```

**File**: `packages/api-graphql/src/Providers/AWSWebSocketProvider/index.ts` (modified, +15/-0)
```diff
@@ -271,6 +271,21 @@ export abstract class AWSWebSocketProvider {
 					}
 
 					if (data.errors && data.errors.length > 0) {
+						// Only reject on the terminal `publish_error` frame correlated to
+						// THIS publish's operation id. AppSync Events guarantees that every
+						// publish response frame (`publish_success`/`publish_error`) carries
+						// the operation `id`, so error frames are correlated by `id` exactly
+						// like the `publish_success` branch above, and the `data.type` gate
+						// mirrors that branch's specificity. The socket is multiplexed, so an
+						// error frame (e.g. a `subscribe_error`) can belong to an unrelated
+						// operation on another channel; likewise an uncorrelated or id-less
+						// error frame is not this publish's response. Such frames are
+						// intentionally ignored for this publish and must not settle its
+						// promise.
+						if (data.id !== subscriptionId || data.type !== 'publish_error') {
+							return;
+						}
+
 						const errorTypes = data.errors.map((error: any) => error.errorType);
 						cleanup();
 						reject(new Error(`Publish errors: ${errorTypes.join(', ')}`));
```

---

### Incident Patch 5: `f87199a0` (2026-09-17)
**Commit Message**: fix(api-graphql): keep Events subscribe authorization errors scoped to a single subscription (#14951)

**File**: `.changeset/quick-mangos-wave.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+---
+'@aws-amplify/api-graphql': patch
+---
+
+fix(api-graphql): keep Events subscribe authorization errors scoped to a single subscription
+
+An authorization error on an Events subscribe (for example a per-subscription `util.unauthorized()` deny, surfaced as errorType `Unauthorized`) is no longer treated as a connection-level auth failure. Previously it closed the shared WebSocket, which tore down sibling subscriptions and, for a permanently denied channel, produced an unbounded deny/reconnect loop. The error is now delivered only to the affected subscription; other active subscriptions and the shared socket stay connected. Connection-level `GQL_ERROR` auth failures still trigger a reconnect as before.
+
+Fixes https://github.com/aws-amplify/amplify-js/issues/14947
```

**File**: `packages/api-graphql/__tests__/AWSAppSyncEventProvider.test.ts` (modified, +108/-0)
```diff
@@ -280,6 +280,114 @@ describe('AppSyncEventProvider', () => {
 					);
 				});
 
+				test('a subscribe_error with errorType "Unauthorized" (util.unauthorized) fails only that subscription and does NOT close the shared socket', async () => {
+					expect.assertions(2);
+
+					// Do not call through: we only want to observe whether the provider
+					// initiates a socket close, not drive the reconnect machinery.
+					const socketCloseSpy = jest
+						.spyOn(fakeWebSocketInterface.webSocket, 'close')
+						.mockImplementation(() => {});
+
+					const observer = provider.subscribe({
+						appSyncGraphqlEndpoint: 'ws://localhost:8080',
+					});
+
+					const errorSpy = jest.fn();
+					observer.subscribe({
+						error: errorSpy,
+					});
+
+					await fakeWebSocketInterface?.standardConnectionHandshake();
+					await fakeWebSocketInterface?.startAckMessage({
+						connectionTimeoutMs: 100,
+					});
+
+					// A per-subscription authorization denial: AppSync's util.unauthorized()
+					// surfaces as an errorType "Unauthorized" subscribe_error frame.
+					await fakeWebSocketInterface?.sendDataMessage({
+						id: fakeWebSocketInterface?.webSocket.subscriptionId,
+						type: MESSAGE_TYPES.EVENT_SUBSCRIBE_ERROR,
+						errors: [
+							{
+								errorType: 'Unauthorized',
+								message: 'You are not authorized to make this call.',
+							},
+						],
+					});
+
+					// The denied subscription's observable errors out (terminal to just it)
+					expect(errorSpy).toHaveBeenCalledWith(
+						expect.objectContaining({
+							errors: [
+								expect.objectContaining({
+									message:
+										'Connection failed: Unauthorized: You are not authorized to make this call.',
+								}),
+							],
+						}),
+					);
+
+					// The shared socket must stay open so sibling subscriptions survive
+					expect(socketCloseSpy).not.toHaveBeenCalledWith(
+						1000,
+						'Auth error - reconnecting',
+					);
+				});
+
+				test('a subscribe_error whose message contains "Token expired" does NOT close the shared socket', async () => {
+					expect.assertions(2);
+
+					const socketCloseSpy = jest
+						.spyOn(fakeWebSocketInterface.webSocket, 'close')
+						.mockImplementation(() => {});
+
+					const observer = provider.subscribe({
+						appSyncGraphqlEndpoint: 'ws://localhost:8080',
+					});
+
+					const errorSpy = jest.fn();
+					observer.subscribe({
+						error: errorSpy,
+					});
+
+					await fakeWebSocketInterface?.standardConnectionHandshake();
+					await fakeWebSocketInterface?.startAckMessage({
+						connectionTimeoutMs: 100,
+					});
+
+					// Incidental "Token expired" text on a per-subscription error frame
+					// must not be classified as a connection-level credentials failure.
+					await fakeWebSocketInterface?.sendDataMessage({
+						id: fakeWebSocketInterface?.webSocket.subscriptionId,
+						type: MESSAGE_TYPES.EVENT_SUBSCRIBE_ERROR,
+						errors: [
+							{
+								errorType: 'AuthorizationError',
+								message: 'Token expired for this channel',
+							},
+						],
+					});
+
+					// The denied subscription's observable errors out (terminal to just it)
+					expect(errorSpy).toHaveBeenCalledWith(
+						expect.objectContaining({
+							errors: [
+								expect.objectContaining({
+									message:
+										'Connection failed: AuthorizationError: Token expired for this channel',
+								}),
+							],
+						}),
+					);
+
+					// The shared socket must stay open so sibling subscriptions survive
+					expect(socketCloseSpy).not.toHaveBeenCalledWith(
+						1000,
+						'Auth error - reconnecting',
+					);
+				});
+
 				test('subscription observer error is not triggered when a connection is formed and a retriable connection_error data message is received', async () => {
 					expect.assertions(2);
 
```

**File**: `packages/api-graphql/src/Providers/AWSWebSocketProvider/index.ts` (modified, +10/-3)
```diff
@@ -715,9 +715,16 @@ export abstract class AWSWebSocketProvider {
 					if (Array.isArray(errors) && errors.length > 0) {
 						const error = errors[0];
 						errorMessage = `${error.errorType}: ${error.message}`;
-						isAuthError =
-							AUTH_ERROR_TYPES.includes(error.errorType) ||
-							error.message?.includes('Token expired');
+						// An Events subscribe_error (e.g. a per-subscription
+						// util.unauthorized() deny, which surfaces as errorType
+						// 'Unauthorized', or an error whose message incidentally
+						// contains 'Token expired') is terminal to only this
+						// subscription. It must NOT close the shared socket: doing so
+						// tears down sibling subscriptions and, for a permanently
+						// denied channel, produces an unbounded deny/reconnect loop.
+						// So isAuthError stays false here — only connection-level
+						// GQL_ERROR auth failures below trigger a socket-closing
+						// reconnect.
 					}
 				} else if (
 					type === MESSAGE_TYPES.GQL_ERROR &&
```

---

### Incident Patch 6: `b3fa3570` (2026-09-16)
**Commit Message**: fix(deps): remediate open Dependabot alerts (#14949)

* fix(deps): remediate open Dependabot alerts

Upgrade vulnerable transitive/dev dependencies to close all 7 open Dependabot alerts across 5 packages (upgrades only, no new resolutions/overrides):

- next: 2 critical alerts -> ^16.3.4 (resolves 16.3.5)
- sharp: 1 alert -> 0.35.4 (via next optional dep)
- js-yaml: 1 alert -> 4.3.2
- joi: 2 low alerts -> 18.2.9
- baseline-browser-mapping: 1 alert -> 2.11.20

Published peerDependency range for next is intentionally unchanged.

* chore(adapter-nextjs): remove changeset for non-releasable dependabot fix

The dependency bumps remediate Dependabot alerts and do not require a
package release, so the release changeset is unnecessary.

**File**: `packages/adapter-nextjs/package.json` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
 		"@types/react-dom": "^18.2.6",
 		"aws-amplify": "6.21.0",
 		"jest-fetch-mock": "3.0.3",
-		"next": ">= 13.5.0 <17.0.0"
+		"next": "^16.3.4"
 	},
 	"publishConfig": {
 		"access": "public"
```

**File**: `yarn.lock` (modified, +220/-225)
```diff
@@ -2637,10 +2637,10 @@
     "@emnapi/wasi-threads" "1.0.4"
     tslib "^2.4.0"
 
-"@emnapi/runtime@^1.11.1":
-  version "1.11.2"
-  resolved "https://registry.yarnpkg.com/@emnapi/runtime/-/runtime-1.11.2.tgz#eb22f04d76febfdf4f87fdaff54c8a53f6bf0dbd"
-  integrity sha512-kyOl3X0DuTiT1h2ft8r2fYO8JYtU9a9Xis/zBSiGArNaagCOWx90N1k2wxp18czFDH+OgcWGb5ZP/XMt3dcyPA==
+"@emnapi/runtime@^1.11.3":
+  version "1.11.3"
+  resolved "https://registry.yarnpkg.com/@emnapi/runtime/-/runtime-1.11.3.tgz#84257ae3b0531eb2aec1ffa23d70700da007ba95"
+  integrity sha512-Xz4Tpyki7XyrpbUK1jR1AhdAdaXyhhY4lZ3neLodmhpuWfy2PAQN5B46sAiU4liOXGLkHypn/qU+jvfWSCYYLA==
   dependencies:
     tslib "^2.4.0"
 
@@ -2840,161 +2840,161 @@
   resolved "https://registry.yarnpkg.com/@img/colour/-/colour-1.1.0.tgz#b0c2c2fa661adf75effd6b4964497cd80010bb9d"
   integrity sha512-Td76q7j57o/tLVdgS746cYARfSyxk8iEfRxewL9h4OMzYhbW4TAcppl0mT4eyqXddh6L/jwoM75mo7ixa/pCeQ==
 
-"@img/sharp-darwin-arm64@0.35.3":
-  version "0.35.3"
-  resolved "https://registry.yarnpkg.com/@img/sharp-darwin-arm64/-/sharp-darwin-arm64-0.35.3.tgz#8b2740884bc58b127fc3020479a01294fa1095cb"
-  integrity sha512-RMnFX7YQsMoh7lWfcM4NEHHymBX/rLuKNPVM84XE9ONPcaSCDgE7CHIHpSgPcO2xcRthgBy1HfNO319mwhIAkg==
+"@img/sharp-darwin-arm64@0.35.4":
+  version "0.35.4"
+  resolved "https://registry.yarnpkg.com/@img/sharp-darwin-arm64/-/sharp-darwin-arm64-0.35.4.tgz#bc10b262de2fc80088013f5f998298d1c8909fbf"
+  integrity sha512-Uhfl4V4lhP2nbUVF9+hyH1+luj86f1gUFeo8ALYxFoULoU+G87D43BfeMP8XHsk9boxAnCY/bf2EHwhA7MuGsA==
   optionalDependencies:
-    "@img/sharp-libvips-darwin-arm64" "1.3.2"
+    "@img/sharp-libvips-darwin-arm64" "1.3.3"
 
-"@img/sharp-darwin-x64@0.35.3":
-  version "0.35.3"
-  resolved "https://registry.yarnpkg.com/@img/sharp-darwin-x64/-/sharp-darwin-x64-0.35.3.tgz#92df91320faf57cc54b331185770d5a93d510049"
-  integrity sha512-Xo+5uFBtLN0BKqieTxiFzFPQAUlBbbH5iBKyRX/z1JrbnYsHTfKJnUfL8+p2TPXr1pXqao4eeL4Rl144uDpK9w==
+"@img/sharp-darwin-x64@0.35.4":
+  version "0.35.4"
+  resolved "https://registry.yarnpkg.com/@img/sharp-darwin-x64/-/sharp-darwin-x64-0.35.4.tgz#76c49ff04fb3f9d846b0d0575841b7ee59beec68"
+  integrity sha512-hWniXY3bG5qKpkKrAwPe4y+VTPmf086YQAnkxWh7uA1YrlRouWGa0M0Mxj3ZjnXFkv7/TD1bTy9lGUK26vRvWw==
   optionalDependencies:
-    "@img/sharp-libvips-darwin-x64" "1.3.2"
+    "@img/sharp-libvips-darwin-x64" "1.3.3"
 
-"@img/sharp-freebsd-wasm32@0.35.3":
-  version "0.35.3"
-  resolved "https://registry.yarnpkg.com/@img/sharp-freebsd-wasm32/-/sharp-freebsd-wasm32-0.35.3.tgz#48018c1379a8f507d681d6cd8dbe43d9795dc809"
-  integrity sha512-lUxcqWIj2wMQ9BrwNjngcr1gWUr5xgaGThBRqPPalIC2n67Cqj1uPh8NnA/ZhAg8hUbKl+kVHKwgUIwe6ZYPrg==
+"@img/sharp-freebsd-wasm32@0.35.4":
+  version "0.35.4"
+  resolved "https://registry.yarnpkg.com/@img/sharp-freebsd-wasm32/-/sharp-freebsd-wasm32-0.35.4.tgz#ba55fd603c5d1d01a1cb14ffb4d970bc6ced80e1"
+  integrity sha512-lIsKw/BU+kjB4eZjxrYrZmwOJYi3Ajrv66iAlBmUPyKc3HpnloevB1g3wxGD9P/5BbQ1brBGl65VRRrCvQDEqA==
   dependencies:
-    "@img/sharp-wasm32" "0.35.3"
+    "@img/sharp-wasm32" "0.35.4"
 
-"@img/sharp-libvips-darwin-arm64@1.3.2":
-  version "1.3.2"
-  resolved "https://registry.yarnpkg.com/@img/sharp-libvips-darwin-arm64/-/sharp-libvips-darwin-arm64-1.3.2.tgz#227b41ffc6c99612bceaba56f994a1933d779573"
-  integrity sha512-9J6ypZFpQBj4YnePGoq/S38w6nz+vqg5WZLrLGY4YuSemdMq47GMLBPO42MzwdGwpg/agZ7xzZcFHa48xlywfg==
+"@img/sharp-libvips-darwin-arm64@1.3.3":
+  version "1.3.3"
+  resolved "https://registry.yarnpkg.com/@img/sharp-libvips-darwin-arm64/-/sharp-libvips-darwin-arm64-1.3.3.tgz#08a6cf4fb4ee8d45f99404a569dcaa6b29391d97"
+  integrity sha512-suTBPTDGrI9WodccaDdwZItTSaBYASlBk1NSfElSHrUfzu3szG6lvIF58+WiFvnfzuK8ZBFS5zE00PxqxnRiPg==
 
-"@img/sharp-libvips-darwin-x64@1.3.2":
-  version "1.3.2"
-  resolved "https://registry.yarnpkg.com/@img/sharp-libvips-darwin-x64/-/sharp-libvips-darwin-x64-1.3.2.tgz#694903ec410c00945ce5b0c26dac83d7184c8b86"
-  integrity sha512-m2pW1n6cns9VaubNwsZ+c3CRYjxNQWgJ5gPlnL1n
```

---

### Incident Patch 7: `556185e7` (2026-09-09)
**Commit Message**: fix(auth): bound waiting on inflight OAuth flow with read-time deadline (#14942)

* fix(auth): bound waiting on an inflight OAuth flow with a read-time deadline

fetchAuthSession/getCurrentUser could hang forever when another tab started
signInWithRedirect and abandoned the Hosted UI page: the shared inflightOAuth
flag has no expiry and parked waiters were only released by the tab that
completes the flow.

- signInWithRedirect now records a blocking deadline in a sibling storage key
  (inflightOAuthDeadline, 5 min), written before the flag so racing readers
  never misclassify the writer as legacy
- TokenOrchestrator.waitForInflightOAuth evaluates the deadline at read time
  and arms a singleton backstop timer on every park (covers the release-race,
  missing storage events, and abandoned flows)
- a cross-tab storage listener releases parked waiters as soon as the owning
  tab settles the flow (requires the crossTab storage listener machinery)
- the completion gate keeps ignoring the deadline and no tab ever mutates
  another tab's flow state, so slow-but-successful logins still complete
- flags written by older library versions get a persisted default deadline
  from first observa

**File**: `.changeset/oauth-inflight-deadline.md` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+---
+'@aws-amplify/auth': patch
+---
+
+fix(auth): bound waiting on an inflight OAuth flow with a read-time deadline
+
+`fetchAuthSession` / `getCurrentUser` could previously hang forever when another
+tab started `signInWithRedirect` and abandoned the Hosted UI page: the shared
+`inflightOAuth` flag has no expiry and the parked promise was only released by
+the tab completing the flow.
+
+The flow now records a blocking deadline next to the flag (`inflightOAuthDeadline`,
+5 minutes). Token consumers evaluate it at read time and park with a backstop
+timer, and a cross-tab storage listener releases waiters as soon as the owning
+tab settles the flow. The deadline bounds only how long other work may block —
+the completion path deliberately ignores it, and no tab ever mutates another
+tab's flow state, so a slow-but-successful login still completes. Flags written
+by older library versions are handled by persisting a default deadline on first
+observation.
```

**File**: `packages/auth/__tests__/providers/cognito/tokenOrchestrator.test.ts` (modified, +18/-1)
```diff
@@ -42,6 +42,7 @@ const validAuthConfig: ResourcesConfig = {
 
 jest.mock('../../../src/providers/cognito/utils/oauth/inflightPromise', () => ({
 	addInflightPromise: jest.fn(),
+	armInflightDeadline: jest.fn(),
 }));
 
 const currentDate = new Date();
@@ -143,13 +144,29 @@ describe('TokenOrchestrator', () => {
 
 		it('Should call addInflightPromise when OAuth is inflight', async () => {
 			mockAuthTokenStore.loadTokens.mockResolvedValue(validAuthTokens);
-			(oAuthStore.loadOAuthInFlight as jest.Mock).mockResolvedValue(true);
+			(oAuthStore.loadOAuthInFlightDeadline as jest.Mock).mockResolvedValue(
+				Date.now() + 60_000,
+			);
 
 			const tokens = await tokenOrchestrator.getTokens();
 
 			expect(addInflightPromise).toHaveBeenCalledWith(expect.any(Function));
 			expect(tokens?.accessToken).toEqual(validAuthTokens.accessToken);
 		});
+
+		it('Should not block when the inflight OAuth blocking deadline has passed', async () => {
+			mockAuthTokenStore.loadTokens.mockResolvedValue(validAuthTokens);
+			// An absent or expired deadline is reported as `undefined` by the store.
+			(oAuthStore.loadOAuthInFlightDeadline as jest.Mock).mockResolvedValue(
+				undefined,
+			);
+			mockAddInflightPromise.mockClear();
+
+			const tokens = await tokenOrchestrator.getTokens();
+
+			expect(addInflightPromise).not.toHaveBeenCalled();
+			expect(tokens?.accessToken).toEqual(validAuthTokens.accessToken);
+		});
 	});
 
 	describe('setClientMetadataProvider', () => {
```

**File**: `packages/auth/__tests__/providers/cognito/utils/oauth/inflightOAuthDeadline.test.ts` (added, +276/-0)
```diff
@@ -0,0 +1,276 @@
+// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
+// SPDX-License-Identifier: Apache-2.0
+
+import { defaultStorage } from '@aws-amplify/core';
+
+import { TokenOrchestrator } from '../../../../../src/providers/cognito/tokenProvider/TokenOrchestrator';
+import { AUTH_KEY_PREFIX } from '../../../../../src/providers/cognito/tokenProvider/constants';
+import {
+	DefaultOAuthStore,
+	OAUTH_INFLIGHT_TTL_MS,
+} from '../../../../../src/providers/cognito/utils/signInWithRedirectStore';
+import { oAuthStore } from '../../../../../src/providers/cognito/utils/oauth/oAuthStore';
+import { resolveAndClearInflightPromises } from '../../../../../src/providers/cognito/utils/oauth/inflightPromise';
+
+// Registers the browser-only side effects at module load — including the
+// cross-tab storage listener that releases parked token consumers when the
+// inflight flag is removed in another tab.
+import '../../../../../src/providers/cognito/utils/oauth/enableOAuthListener';
+
+// Per repo convention only the boundaries are mocked: `isBrowser` (so the
+// browser-only branches are taken deterministically). The real oAuthStore,
+// defaultStorage (jsdom localStorage), inflightPromise module, and
+// TokenOrchestrator internals are exercised.
+jest.mock('@aws-amplify/core/internals/utils', () => ({
+	...jest.requireActual('@aws-amplify/core/internals/utils'),
+	isBrowser: jest.fn(() => true),
+}));
+
+const userPoolClientId = 'test-client-id';
+const authConfig = {
+	Cognito: {
+		userPoolId: 'us-east-1_test-id',
+		userPoolClientId,
+	},
+};
+
+const inflightKey = `${AUTH_KEY_PREFIX}.${userPoolClientId}.inflightOAuth`;
+const deadlineKey = `${AUTH_KEY_PREFIX}.${userPoolClientId}.inflightOAuthDeadline`;
+const pkceKey = `${AUTH_KEY_PREFIX}.${userPoolClientId}.oauthPKCE`;
+const stateKey = `${AUTH_KEY_PREFIX}.${userPoolClientId}.oauthState`;
+
+// Bounded microtask drain, used ONLY ahead of NEGATIVE (`isSettled() === false`)
+// assertions, where it is safe by construction: draining too little can only
+// make the assertion weaker, never flaky-pass a regression, and extra passes
+// only strengthen it. POSITIVE assertions never rely on this — they `await`
+// the parked promise itself, which is deterministic at any async-chain depth
+// and turns a regression into a hard jest timeout instead of a silent
+// under-drain (jest's jsdom provides neither setImmediate nor MessageChannel
+// for a true macrotask boundary).
+const drainMicrotasks = async () => {
+	for (let i = 0; i < 25; i++) {
+		await Promise.resolve();
+	}
+};
+
+const createOrchestrator = () => {
+	const orchestrator = new TokenOrchestrator();
+	orchestrator.setAuthConfig(authConfig as any);
+
+	return orchestrator;
+};
+
+const park = (orchestrator: TokenOrchestrator) => {
+	let settled = false;
+	const promise = orchestrator.waitForInflightOAuth().then(() => {
+		settled = true;
+	});
+
+	return { promise, isSettled: () => settled };
+};
+
+describe('inflight OAuth blocking deadline', () => {
+	beforeEach(() => {
+		jest.useFakeTimers();
+		window.localStorage.clear();
+	});
+
+	afterEach(async () => {
+		// Drain any parked waiters and clear the singleton backstop timer so
+		// module-level state never leaks between tests.
+		resolveAndClearInflightPromises();
+		await drainMicrotasks();
+		jest.clearAllTimers();
+		jest.useRealTimers();
+	});
+
+	it('does not block when no OAuth flow is in flight', async () => {
+		const orchestrator = createOrchestrator();
+
+		// Deterministic positive assertion: resolves without any timer advance,
+		// or times out the test on regression.
+		await park(orchestrator).promise;
+	});
+
+	it('parks while a flow is in flight and releases once the deadline passes, without mutating shared state', async () => {
+		await oAuthStore.storeOAuthInFlight(true);
+		await defaultStorage.setItem(pkceKey, 'test-pkce');
+		await defaultStorage.setItem(stateKey, 'test-state');
+
+		const orchestrator = createOrchestrator(
```

**File**: `packages/auth/src/providers/cognito/tokenProvider/TokenOrchestrator.ts` (modified, +44/-5)
```diff
@@ -18,7 +18,10 @@ import {
 import { assertServiceError } from '../../../errors/utils/assertServiceError';
 import { AuthError } from '../../../errors/AuthError';
 import { oAuthStore } from '../utils/oauth/oAuthStore';
-import { addInflightPromise } from '../utils/oauth/inflightPromise';
+import {
+	addInflightPromise,
+	armInflightDeadline,
+} from '../utils/oauth/inflightPromise';
 import { ClientMetadata, CognitoAuthSignInDetails } from '../types';
 
 import {
@@ -38,20 +41,53 @@ export class TokenOrchestrator implements AuthTokenOrchestrator {
 	inflightPromise: Promise<void> | undefined;
 	waitForInflightOAuth: () => Promise<void> = isBrowser()
 		? async () => {
-				if (!(await oAuthStore.loadOAuthInFlight())) {
+				// Read-time evaluation of the blocking deadline: absent flag, an
+				// expired deadline, or a flag value other than 'true' all mean
+				// "do not block". An abandoned flow in another tab can therefore
+				// never park token consumers indefinitely.
+				// (`loadOAuthInFlightDeadline` is optional on the OAuthStore
+				// interface for custom-implementation compatibility, but this
+				// singleton is always the concrete DefaultOAuthStore, which
+				// implements it.)
+				const deadline = await oAuthStore.loadOAuthInFlightDeadline();
+				if (deadline === undefined) {
 					return;
 				}
 
 				if (this.inflightPromise) {
+					// Keep the backstop aligned with the current deadline for waiters
+					// piggybacking on the existing park.
+					armInflightDeadline(deadline, () =>
+						oAuthStore.loadOAuthInFlightDeadline(),
+					);
+
 					return this.inflightPromise;
 				}
 
 				// when there is valid oauth config and there is an inflight oauth flow, try
 				// to block async calls that require fetching tokens before the oauth flow completes
 				// e.g. getCurrentUser, fetchAuthSession etc.
 
-				this.inflightPromise = new Promise<void>((resolve, _reject) => {
-					addInflightPromise(resolve);
+				this.inflightPromise = new Promise<void>(resolve => {
+					// Invariant: `this.inflightPromise` is owned by the park lifecycle —
+					// created here and reset by the very resolver that releases it
+					// (drained by the backstop timer, the cross-tab listener, or
+					// in-process completion). Resetting BEFORE resolving closes the
+					// post-release hole where a caller for a NEW flow could observe a
+					// stale, already-resolved promise and skip blocking on it.
+					addInflightPromise(() => {
+						this.inflightPromise = undefined;
+						resolve();
+					});
+					// Arm the deadline backstop in the same synchronous step as the
+					// park: it releases this waiter even when the cross-tab release
+					// fired between the deadline read above and this park (that storage
+					// event never re-fires), when storage events are unavailable
+					// (Safari private mode), or when the flow is simply never
+					// completed anywhere.
+					armInflightDeadline(deadline, () =>
+						oAuthStore.loadOAuthInFlightDeadline(),
+					);
 				});
 
 				return this.inflightPromise;
@@ -115,7 +151,10 @@ export class TokenOrchestrator implements AuthTokenOrchestrator {
 			return null;
 		}
 		await this.waitForInflightOAuth();
-		this.inflightPromise = undefined;
+		// NOTE: `this.inflightPromise` is reset by the resolver registered in
+		// `waitForInflightOAuth` (co-located with the release), NOT here — a reset
+		// here could clobber a newer flow's park created between the release and
+		// this line resuming.
 		tokens = await this.getTokenStore().loadTokens();
 		const username = await this.getTokenStore().getLastAuthUser();
 
```

**File**: `packages/auth/src/providers/cognito/utils/oauth/enableOAuthListener.ts` (modified, +30/-0)
```diff
@@ -3,13 +3,19 @@
 
 import {
 	Hub,
+	KeyValueStorageEvent,
 	ResourcesConfig,
+	defaultStorage,
 	getGlobalContext,
 	hasGlobalContext,
 } from '@aws-amplify/core';
 import { isBrowser } from '@aws-amplify/core/internals/utils';
 
+import { AUTH_KEY_PREFIX } from '../../tokenProvider/constants';
+import { OAuthStorageKeys } from '../types';
+
 import { attemptCompleteOAuthFlow } from './attemptCompleteOAuthFlow';
+import { resolveAndClearInflightPromises } from './inflightPromise';
 
 // Synchronous re-entry guard for the OAuth completion side effect (PR #14925).
 //
@@ -71,6 +77,30 @@ if (isBrowser()) {
 		}
 	});
 
+	// Cross-tab release of parked token consumers: when the tab owning an
+	// inflight OAuth flow settles it (success, failure, or cancellation), it
+	// removes the `inflightOAuth` flag from shared storage — `completeOAuthFlow`
+	// on success, `handleFailure` otherwise. Observing that transition here
+	// releases this tab's waiters (`fetchAuthSession`, `getCurrentUser`, ...)
+	// immediately instead of leaving them parked until the blocking-deadline
+	// backstop fires. The release is purely local; no shared state is mutated.
+	// Registered for the module (page) lifetime, mirroring the Hub subscription
+	// above — deliberately never unsubscribed.
+	defaultStorage.addListener?.(async (event: KeyValueStorageEvent) => {
+		const { key, newValue } = event;
+		// Match by prefix/suffix rather than positional `split('.')`, consistent
+		// with the cross-tab token listener (key shape:
+		// `${AUTH_KEY_PREFIX}.<clientId>.inflightOAuth`).
+		if (
+			!!key &&
+			key.startsWith(`${AUTH_KEY_PREFIX}.`) &&
+			key.endsWith(`.${OAuthStorageKeys.inflightOAuth}`) &&
+			newValue !== 'true'
+		) {
+			resolveAndClearInflightPromises();
+		}
+	});
+
 	// Catch-up: `Amplify.configure()` may have run before this module was
 	// imported (dynamic imports / code-splitting), in which case the 'configure'
 	// Hub event already fired and was missed. If a global context configured with
```

---

### Incident Patch 8: `ca44980d` (2026-09-07)
**Commit Message**: fix(interactions): bump fflate to 0.7.5 to fix unzipSync DoS (resolves #308/#309) (#14939)

fix(interactions): bump fflate to 0.7.5 to fix unzipSync infinite-loop DoS

Resolves Dependabot alerts #308 (packages/interactions) and #309 (yarn.lock).
fflate 0.7.3 -> 0.7.5 (patched); direct runtime dependency of @aws-amplify/interactions.

Co-authored-by: Osama Rizk <osama-rizk@users.noreply.github.com>

**File**: `.changeset/fix-interactions-fflate-dos.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@aws-amplify/interactions': patch
+---
+
+fix(interactions): bump fflate to 0.7.5 to address unzipSync infinite-loop DoS (GHSA)
```

**File**: `packages/interactions/package.json` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@
 		"@aws-sdk/client-lex-runtime-service": "^3.1012.0",
 		"@aws-sdk/client-lex-runtime-v2": "^3.1012.0",
 		"base-64": "1.0.0",
-		"fflate": "0.7.3",
+		"fflate": "0.7.5",
 		"pako": "2.0.4",
 		"tslib": "^2.5.0"
 	},
```

**File**: `yarn.lock` (modified, +4/-4)
```diff
@@ -7988,10 +7988,10 @@ fdir@^6.5.0:
   resolved "https://registry.yarnpkg.com/fdir/-/fdir-6.5.0.tgz#ed2ab967a331ade62f18d077dae192684d50d350"
   integrity sha512-tIbYtZbucOs0BRGqPJkshJUYdL+SDH7dVM8gjy+ERp3WAUjLEFJE+02kanyHtwjWOnwrKYBiwAmM0p4kLJAnXg==
 
-fflate@0.7.3:
-  version "0.7.3"
-  resolved "https://registry.yarnpkg.com/fflate/-/fflate-0.7.3.tgz#288b034ff0e9c380eaa2feff48c787b8371b7fa5"
-  integrity sha512-0Zz1jOzJWERhyhsimS54VTqOteCNwRtIlh8isdL0AXLo0g7xNTfTL7oWrkmCnPhZGocKIkWHBistBrrpoNH3aw==
+fflate@0.7.5:
+  version "0.7.5"
+  resolved "https://registry.yarnpkg.com/fflate/-/fflate-0.7.5.tgz#1dfcb7189bc104d599da0436eace14ed26de879f"
+  integrity sha512-QieYf//cis6ywHNi5qW1+PXPQ4bC+XVJAtS4AXIML8P76GroEiOxm/oQtn1f02UkJY1+KsXMJcC+R2v/Eg4G3g==
 
 file-entry-cache@^8.0.0:
   version "8.0.0"
```

---

### Incident Patch 9: `b44e0183` (2026-09-04)
**Commit Message**: fix(datastore): apply pagination when only one record matches (#14926)

`inMemoryPagination` guarded its pagination branch on `records.length > 1`,
so a result set of exactly one record was returned verbatim for any `page`.
Querying page 0 and then page 1 of a single-record table therefore yielded
the same item twice instead of an empty second page.

Only an empty result set is genuinely unaffected by pagination, so the
guard now checks `records.length > 0`. A single record follows exactly the
same slicing path as any larger set rather than taking a size-dependent
special case; the 0-record and multi-record paths are unchanged.

Adds unit coverage for inMemoryPagination over 0/1/multiple records,
pages past the end, and an absent sort predicate.

Fixes #12049

**File**: `.changeset/fix-datastore-single-record-pagination.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@aws-amplify/datastore': patch
+---
+
+fix(datastore): apply pagination when only one record matches a query
```

**File**: `packages/datastore/__tests__/util.test.ts` (modified, +56/-0)
```diff
@@ -20,6 +20,7 @@ import {
 	isIdOptionallyManaged,
 	indexNameFromKeys,
 	keysEqual,
+	inMemoryPagination,
 } from '../src/util';
 
 import { testSchema } from './helpers';
@@ -841,4 +842,59 @@ describe('datastore util', () => {
 			});
 		});
 	});
+
+	// See https://github.com/aws-amplify/amplify-js/issues/12049
+	describe('inMemoryPagination', () => {
+		const buildRecords = (count: number) =>
+			Array.from({ length: count }, (_, index) => ({ id: `id-${index}` }));
+
+		test('should return an empty page when there are no records', () => {
+			expect(
+				inMemoryPagination(buildRecords(0), { page: 1, limit: 20 }),
+			).toEqual([]);
+		});
+
+		test('should return the only record on the first page', () => {
+			expect(
+				inMemoryPagination(buildRecords(1), { page: 0, limit: 20 }),
+			).toEqual([{ id: 'id-0' }]);
+		});
+
+		test('should return an empty page for the page after a single record', () => {
+			expect(
+				inMemoryPagination(buildRecords(1), { page: 1, limit: 20 }),
+			).toEqual([]);
+		});
+
+		test('should return an empty page for any page past a single record', () => {
+			expect(
+				inMemoryPagination(buildRecords(1), { page: 2, limit: 1 }),
+			).toEqual([]);
+		});
+
+		test('should page through multiple records', () => {
+			expect(
+				inMemoryPagination(buildRecords(3), { page: 0, limit: 2 }),
+			).toEqual([{ id: 'id-0' }, { id: 'id-1' }]);
+			expect(
+				inMemoryPagination(buildRecords(3), { page: 1, limit: 2 }),
+			).toEqual([{ id: 'id-2' }]);
+		});
+
+		test('should return an empty page past the end of multiple records', () => {
+			expect(
+				inMemoryPagination(buildRecords(3), { page: 2, limit: 2 }),
+			).toEqual([]);
+		});
+
+		test('should not require a sort predicate', () => {
+			expect(
+				inMemoryPagination(buildRecords(3), {
+					page: 1,
+					limit: 2,
+					sort: undefined,
+				}),
+			).toEqual([{ id: 'id-2' }]);
+		});
+	});
 });
```

**File**: `packages/datastore/src/util.ts` (modified, +3/-1)
```diff
@@ -621,7 +621,9 @@ export function inMemoryPagination<T extends PersistentModel>(
 	records: T[],
 	pagination?: PaginationInput<T>,
 ): T[] {
-	if (pagination && records.length > 1) {
+	// Only an empty set is unaffected by pagination: with one record a page
+	// beyond the first must still resolve to no records.
+	if (pagination && records.length > 0) {
 		if (pagination.sort) {
 			const sortPredicates = ModelSortPredicateCreator.getPredicates(
 				pagination.sort,
```

---

### Incident Patch 10: `340ecd38` (2026-09-03)
**Commit Message**: fix(deps): bump qs 6.16.0, fast-uri 3.1.7, @humanfs/node 0.16.8 (resolves #302-#305) (#14936)

fix(deps): bump qs, fast-uri, @humanfs/node to patched versions

Resolves Dependabot alerts:
- qs 6.15.3 -> 6.16.0: array-limit bypass (#305)
- fast-uri 3.1.5 -> 3.1.7: SSRF (#304) & host confusion (#303)
- @humanfs/node 0.16.6 -> 0.16.8: recursive copy follows symlinks (#302)

Co-authored-by: Osama Rizk <osama-rizk@users.noreply.github.com>

**File**: `package.json` (modified, +4/-2)
```diff
@@ -135,14 +135,16 @@
 		"**/glob/minipass": "6.0.2",
 		"xml2js": "0.5.0",
 		"**/form-data": "4.0.6",
-		"qs": "^6.14.1",
+		"qs": "^6.16.0",
 		"js-yaml": "^4.3.1",
 		"launch-editor": "^2.14.1",
 		"serialize-javascript": "^7.0.5",
 		"@tootallnate/once": "3.0.1",
 		"uuid": "^11.1.1",
 		"joi": "^18.2.1",
-		"**/next/sharp": "^0.35.0"
+		"**/next/sharp": "^0.35.0",
+		"fast-uri": "^3.1.6",
+		"@humanfs/node": "^0.16.8"
 	},
 	"packageManager": "yarn@1.22.22+sha512.a6b2f7906b721bba3d67d4aff083df04dad64c399707841b7acf00f6b133b7ac24255f2652fa22ae3534329dc6180534e98d17432037ff6fd140556e2bb3137e"
 }
```

**File**: `yarn.lock` (modified, +27/-24)
```diff
@@ -2796,30 +2796,33 @@
   dependencies:
     "@hapi/hoek" "^11.0.2"
 
-"@humanfs/core@^0.19.1":
-  version "0.19.1"
-  resolved "https://registry.yarnpkg.com/@humanfs/core/-/core-0.19.1.tgz#17c55ca7d426733fe3c561906b8173c336b40a77"
-  integrity sha512-5DyQ4+1JEUzejeK1JGICcideyfUbGixgS9jNgex5nqkW+cY7WZhxBigmieN5Qnw9ZosSNVC9KQKyb+GUaGyKUA==
+"@humanfs/core@^0.19.2":
+  version "0.19.2"
+  resolved "https://registry.yarnpkg.com/@humanfs/core/-/core-0.19.2.tgz#a8272ca03b2acf492670222b2320b6c421bfde60"
+  integrity sha512-UhXNm+CFMWcbChXywFwkmhqjs3PRCmcSa/hfBgLIb7oQ5HNb1wS0icWsGtSAUNgefHeI+eBrA8I1fxmbHsGdvA==
+  dependencies:
+    "@humanfs/types" "^0.15.0"
 
-"@humanfs/node@^0.16.6":
-  version "0.16.6"
-  resolved "https://registry.yarnpkg.com/@humanfs/node/-/node-0.16.6.tgz#ee2a10eaabd1131987bf0488fd9b820174cd765e"
-  integrity sha512-YuI2ZHQL78Q5HbhDiBA1X4LmYdXCKCMQIfw0pw7piHJwyREFebJUvrQN4cMssyES6x+vfUbx1CIpaQUKYdQZOw==
+"@humanfs/node@^0.16.6", "@humanfs/node@^0.16.8":
+  version "0.16.8"
+  resolved "https://registry.yarnpkg.com/@humanfs/node/-/node-0.16.8.tgz#8f800cccc13f4f8cd3116e2d9c0a94939da3e3ed"
+  integrity sha512-gE1eQNZ3R++kTzFUpdGlpmy8kDZD/MLyHqDwqjkVQI0JMdI1D51sy1H958PNXYkM2rAac7e5/CnIKZrHtPh3BQ==
   dependencies:
-    "@humanfs/core" "^0.19.1"
-    "@humanwhocodes/retry" "^0.3.0"
+    "@humanfs/core" "^0.19.2"
+    "@humanfs/types" "^0.15.0"
+    "@humanwhocodes/retry" "^0.4.0"
+
+"@humanfs/types@^0.15.0":
+  version "0.15.0"
+  resolved "https://registry.yarnpkg.com/@humanfs/types/-/types-0.15.0.tgz#f2a09f62012390b2bff3fc6fb248ddec8c09a090"
+  integrity sha512-ZZ1w0aoQkwuUuC7Yf+7sdeaNfqQiiLcSRbfI08oAxqLtpXQr9AIVX7Ay7HLDuiLYAaFPu8oBYNq/QIi9URHJ3Q==
 
 "@humanwhocodes/module-importer@^1.0.1":
   version "1.0.1"
   resolved "https://registry.yarnpkg.com/@humanwhocodes/module-importer/-/module-importer-1.0.1.tgz#af5b2691a22b44be847b0ca81641c5fb6ad0172c"
   integrity sha512-bxveV4V8v5Yb4ncFTT3rPSgZBOpCkjfK0y4oVVVJwIuDVBRMDXrPyXRL988i5ap9m9bnyEEjWfm5WkBmtffLfA==
 
-"@humanwhocodes/retry@^0.3.0":
-  version "0.3.1"
-  resolved "https://registry.yarnpkg.com/@humanwhocodes/retry/-/retry-0.3.1.tgz#c72a5c76a9fbaf3488e231b13dc52c0da7bab42a"
-  integrity sha512-JBxkERygn7Bv/GbN5Rv8Ul6LVknS+5Bp6RgDC/O8gEBU/yeH5Ui5C/OlWrTb6qct7LjjfT6Re2NxB0ln0yYybA==
-
-"@humanwhocodes/retry@^0.4.2":
+"@humanwhocodes/retry@^0.4.0", "@humanwhocodes/retry@^0.4.2":
   version "0.4.3"
   resolved "https://registry.yarnpkg.com/@humanwhocodes/retry/-/retry-0.4.3.tgz#c2b9d2e374ee62c586d3adbea87199b1d7a7a6ba"
   integrity sha512-bV0Tgo9K4hfPCek+aMAn81RppFKv2ySDQeMoSZuvTASywNTnVJCArCZE2FWqpvIatKu7VMRLWlR1EazvVhDyhQ==
@@ -7923,10 +7926,10 @@ fast-levenshtein@^2.0.6:
   resolved "https://registry.yarnpkg.com/fast-levenshtein/-/fast-levenshtein-2.0.6.tgz#3d8a5c66883a16a30ca8643e851f19baa7797917"
   integrity sha512-DCXu6Ifhqcks7TZKY3Hxp3y6qphY5SJZmrWMDrKcERSOXWQdMhU9Ig/PYrzyw/ul9jOIyh0N4M0tbC5hodg8dw==
 
-fast-uri@^3.0.1:
-  version "3.1.5"
-  resolved "https://registry.yarnpkg.com/fast-uri/-/fast-uri-3.1.5.tgz#610f37419a030270430cecd68d74e3d4d96725d0"
-  integrity sha512-gHwA1O9LDIcKunMKhObS/HimwtehO1nPUECKAu5TpKgaO19fcWEl4bliWe1jWxVFvIXztJjjQ4L8XQ1EU9f7Jw==
+fast-uri@^3.0.1, fast-uri@^3.1.6:
+  version "3.1.7"
+  resolved "https://registry.yarnpkg.com/fast-uri/-/fast-uri-3.1.7.tgz#743157d957f3cbb4c65310e033dc2ad4ad7dc60a"
+  integrity sha512-dOvZVzjdZdz7phd9v6jCbwxrBW3fK6n8Rc0CtdmM4bumzMnxywBYhuph6J819RRw/ku+rLbelwfMunktuzVVHg==
 
 fast-xml-builder@^1.1.5:
   version "1.2.0"
@@ -11123,10 +11126,10 @@ pure-rand@^6.0.0:
   resolved "https://registry.yarnpkg.com/pure-rand/-/pure-rand-6.1.0.tgz#d173cf23258231976ccbdb05247c9787957604f2"
   integrity sha512-bVWawvoZoBYpp6yIoQtQXHZjmz35RSVHnUOTefl8Vcjr8snTPY1wnpSPMWekcFwbxI6gtmT7rSYPFvz71ldiOA==
 
-qs@^6.14.1, qs@~6.15.1:
-  version "6.15.3"
-  resolved "https://registry.yarnpkg.com/qs/-/qs-6.15.3.tgz#76852132a58ed5c7c0ef67e4441b9bb5d6061b3b"
-  integrity sha512-O9gl3zCl5h5blw1KGUzQKhA5oUXSl8rwUIM5o0S3nCXMliS
```

#### Recent Merged Pull Requests:
- **PR #14970** (closed): fix(api-rest): feature-detect URL.canParse in resolveApiUrl (@ahmedhamouda78)
- **PR #14963** (2026-09-28): Version Packages (main) (@github-actions[bot])
- **PR #14962** (2026-09-25): fix(core): honor custom Auth providers when the resource config has no Auth block (@bobbor)
- **PR #14959** (closed): fix(datastore): prevent stop() from hanging while sync queries are in progress (@nghiatranhnl)
- **PR #14956** (2026-09-25): fix(core): externalize tslib to fix SSR module resolution (@soberm)
- **PR #14954** (2026-09-18): feat(events): observe subscription readiness via channel.subscribe().ready (@soberm)
- **PR #14952** (2026-09-21): Version Packages (main) (@github-actions[bot])
- **PR #14951** (2026-09-17): fix(api-graphql): keep Events subscribe authorization errors scoped to a single subscription (@soberm)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
