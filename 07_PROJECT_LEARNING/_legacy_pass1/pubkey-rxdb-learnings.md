# Forensic Learning Record (Deep Inspection): pubkey/rxdb

> **Canonical Artifact**: `07_PROJECT_LEARNING/pubkey-rxdb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pubkey/rxdb](https://github.com/pubkey/rxdb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:14:05.113Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pubkey/rxdb`
- **Description**: The local-first database that runs on every JS runtime and replicates with your existing backend - no vendor, no lock-in - https://rxdb.info/
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 23396 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/hooks/no-console-dir-storage-sqlite.mjs`
```
#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook.
 *
 * Blocks any Write/Edit/MultiEdit that would introduce `console.dir(...)`
 * into the `src/plugins/storage-sqlite` code.
 *
 * `console.dir` is `undefined` in production React Native / Hermes runtimes,
 * so calling it inside the storage-sqlite code throws
 * `TypeError: undefined is not a function` and masks the real error.
 * See https://github.com/pubkey/rxdb/issues/8635
 */

const CONSOLE_DIR_REGEX = /console\s*\.\s*dir\b/;
const STORAGE_SQLITE_PATH = 'src/plugins/storage-sqlite';

async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
}

function collectTexts(toolInput) {
    const texts = [];
    if (typeof toolInput.content === 'string') {
        texts.push(toolInput.content);
    }
    if (typeof toolInput.new_string === 'string') {
        texts.push(toolInput.new_string);
    }
    if (Array.isArray(toolInput.edits)) {
        for (const edit of toolInput.edits) {
            if (edit && typeof edit.new_string === 'string') {
                texts.push(edit.new_string);
            }
        }
    }
    return texts;
}

async function main() {
    let payload;
    try {
        payload = JSON.parse(await readStdin());
    } catch {
        // Could not parse the hook payload, do not block.
        process.exit(0);
    }

    const toolInput = payload.tool_input || {};
    const filePath = toolInput.file_path || '';

    if (!filePath.includes(STORAGE_SQLITE_PATH)) {
        process.exit(0);
    }

    const offends = collectTexts(toolInput).some(text => CONSOLE_DIR_REGEX.test(text));
    if (!offends) {
        process.exit(0);
    }

    const output = {
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason:
                'Do not use console.dir inside src/plugins/storage-sqlite. ' +
                'console.dir is undefined in production React Native / Hermes runtimes and throws ' +
                'TypeError: undefined is not a function, masking the real error (see issue #8635). ' +
                'Use console.log(JSON.stringify(...)) or errorToPlainJson(...) instead.'
        }
    };
    process.stdout.write(JSON.stringify(output));
    process.exit(0);
}

main();

```

### Core Architecture Module: `babel.config.js`
```
/**
 * The esm build targets modern browsers that support native `class` syntax.
 * Down-transpiling classes there only pulls in @babel/runtime helper imports
 * (inheritsLoose, createClass, readOnlyError, wrapNativeSuper) and extra bytes
 * for no benefit, so the class transforms only run for the es5/CJS build.
 *
 * Only the class-related transforms are made conditional. The other syntax
 * transforms (block-scoping, template-literals, ...) do not emit @babel/runtime
 * helpers, so keeping them in both builds preserves the existing runtime
 * behavior (e.g. `const`/`let` hoisting) while still dropping the helpers.
 */
const isEs5 = process.env['NODE_ENV'] === 'es5';

// only include the given class-lowering plugins for the es5/CJS build.
const classOnly = (pluginList) => (isEs5 ? pluginList : []);

const plugins = [
    '@babel/plugin-transform-explicit-resource-management',
    '@babel/plugin-transform-typescript',
    /**
     * Must run before @babel/plugin-transform-classes,
     * otherwise babel throws 'Missing class properties transform'.
     */
    ...classOnly(['@babel/plugin-transform-class-properties']),
    ['@babel/transform-template-literals', {
        'loose': true
    }],
    '@babel/transform-literals',
    '@babel/transform-block-scoped-functions',
    ...classOnly([
        ['@babel/plugin-transform-classes', {
            'loose': true
        }]
    ]),
    '@babel/transform-sticky-regex',
    '@babel/transform-unicode-regex',
    '@babel/transform-block-scoping',
    ['@babel/transform-runtime', {
        'regenerator': false
    }],
    '@babel/plugin-transform-react-jsx'
];

let presets = [
    [
        '@babel/typescript',
        {
            rewriteImportExtensions: true,
            loose: true,
            modules: false
        }
    ]
];

// console.log('babel: NODE_ENV: ' + process.env['NODE_ENV']);

if (isEs5) {
    presets = [
        [
            '@babel/typescript',
            {
                rewriteImportExtensions: true,
                loose: true,
                targets: {
                    edge: '107',
                    firefox: '107',
                    chrome: '108',
                    safari: '16.2'
                },
                useBuiltIns: false
            }]
    ];
    plugins.unshift('@babel/plugin-transform-modules-commonjs');
}

module.exports = {
    presets,
    plugins
};

```

### Core Architecture Module: `config/bundle-size.js`
```
import {
    createRxDatabase
} from '../plugins/core/index.mjs';
import {
    getRxStorageMemory,
} from '../plugins/storage-memory/index.mjs';

function run() {
    createRxDatabase({
        name: 'heroesdb',
        storage: getRxStorageMemory()
    }).then(db => {
        return db.destroy();
    });
}
run();

```

### Core Architecture Module: `config/landingpage.webpack.config.js`
```
const path = require('path');
// const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: {
        landingpage: './docs-src/landingpage.ts',
        premium: './docs-src/premium.ts'
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                exclude: [
                    '/node_modules/'
                ],
                options: {
                    transpileOnly: true,
                    compilerOptions: {
                        noEmit: false,
                        allowImportingTsExtensions: false
                    }
                }
            },
            {
                test: /\.css$/,
                use: [
                    {
                        loader: MiniCssExtractPlugin.loader
                    },
                    'css-loader'
                ]
            },
            {
                test: /\.(png|svg|jpg|gif)$/,
                use: [
                    'file-loader'
                ]
            },
            {
                test: /\.(woff|woff2|eot|ttf|otf)$/,
                use: [
                    'file-loader'
                ]
            },
            {
                test: /\.(csv|tsv)$/,
                use: [
                    'csv-loader'
                ]
            }
        ],
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: '[name].css',
            chunkFilename: '[id].css'
        }),
        new CopyPlugin({
            patterns: [{
                from: './docs-src/styles',
                to: 'styles'
            }]
        }),
        new CopyPlugin({
            patterns: [{
                from: './docs-src/files',
                to: 'files'
            }]
        })
    ],
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, '../', 'docs')
    },
    devServer: {
        static: path.join(__dirname, '../', 'docs-src'),
        compress: true,
        port: 8888,
        watchFiles: './docs-src/**'
    },
    mode: 'development',
    performance: {
        hints: false,
        maxEntrypointSize: 512000,
        maxAssetSize: 512000
    }
};

```

### Core Architecture Module: `config/rollup.config.mjs`
```
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
    input: './config/bundle-size.js',
    output: {
        sourcemap: true,
        name: 'app',
        file: './test_tmp/rollup.bundle.js'
    },
    plugins: [
        nodeResolve(),
        commonjs({
            include: 'node_modules/**',
        })
    ]
};

```

### Core Architecture Module: `config/webpack.config.js`
```
const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;


/**
 * Throw on bailouts.
 * If a dependency is causing a bailout,
 * it must be replaced!
 */
const oldConsoleLog = console.log.bind(console);
console.log = function (m1, m2, m3) {
    if (m1.includes('not an ECMAScript module')) {
        oldConsoleLog(m1);
        throw new Error('ERROR: A dependency of RxDB is causing an optimization bailout. This is not allowed.');
    } else {
        return oldConsoleLog(m1, m2, m3);
    }
};


const plugins = [];
if (process.env.NODE_ENV === 'analyze') {
    plugins.push(new BundleAnalyzerPlugin());
}

module.exports = {
    mode: 'production',
    entry: './config/bundle-size.js',
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin()
        ]
    },
    plugins,
    output: {
        path: path.resolve(__dirname, '../test_tmp'),
        filename: 'webpack.bundle.js'
    },
    stats: {
        /**
         * @link https://webpack.js.org/plugins/module-concatenation-plugin/#debugging-optimization-bailouts
         */
        optimizationBailout: true,
        warnings: true
    }
};

```

### Core Architecture Module: `eslint.config.mjs`
```
import { fixupPluginRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import _import from 'eslint-plugin-import';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';
import path from 'node:path';
import stylistic from '@stylistic/eslint-plugin';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [
    {
        ignores: [
            'test/playground/*',
            '.claude/*',
            'test/tutorials',
            '**/test_tmp/',
            '**/tmp/',
            '**/dist/',
            '**/package.json',
            '**/plugins/',
            '.transpile_state.json',
            'examples/angular',
            'examples/electron',
            'examples/graphql',
            'examples/ionic',
            'examples/flutter',
            'examples/node',
            'examples/react-native',
            'examples/vue',
            'examples/svelte',
            'examples/react/build',
            'examples/tauri',
            'examples/vite-vanilla-ts',
            '**/node_modules',
            '**/docs',
            'docs-src/static/files/logo/js.build.js',
            'docs-src/_book/',
            'docs-src/.docusaurus/',
            'docs-src/build/',
            'docs-src/docusaurus-lunr-search-main',
            'config/.mocharc.cjs',
            'config/karma.webpack.conf.cjs',
            '.chrome-profile-perf/'
        ]
    },
    ...compat.extends('eslint:recommended', 'plugin:@typescript-eslint/eslint-recommended', 'plugin:@typescript-eslint/recommended', 'plugin:@typescript-eslint/recommended-requiring-type-checking'),
    {
        plugins: {
            import: fixupPluginRules(_import),
            '@stylistic': stylistic,
            jsdoc,
            '@typescript-eslint': typescriptEslint
        },
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node
            },
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: 'module',
            parserOptions: {
                extraFileExtensions: ['.json'],
                project: './tsconfig.lint.json'
            }
        },
        rules: {
            '@stylistic/quotes': ['error', 'single'],
            '@stylistic/semi': ['error', 'always'],
            '@stylistic/type-annotation-spacing': 'error',
            '@stylistic/indent': 'off',
            '@stylistic/member-delimiter-style': [
                'error',
                {
                    multiline: {
                        delimiter: 'semi',
                        requireLast: true,
                    },
                    singleline: {
                        delimiter: 'semi',
                        requireLast: true,
                    },
                },
            ],
            '@typescript-eslint/no-redundant-type-constituents': 'off',
            '@typescript-eslint/consistent-type-definitions': 'off',
            '@typescript-eslint/dot-notation': 'off',
            '@typescript-eslint/explicit-member-accessibility': [
                'off',
                {
                    accessibility: 'explicit'
                }
            ],
            '@typescript-eslint/member-ordering': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-misused-new': 'error',
            '@typescript-eslint/no-non-null-assertion': 'error',
            '@typescript-eslint/no-shadow': [
                'error',
                {
                    hoist: 'all'
                }
            ],
            '@typescript-eslint/no-unused-expressions': 'error',
            '@typescript-eslint/prefer-function-type': 'error',
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/unified-signatures': 'error',
            'brace-style': ['error', '1tbs'],
            'constructor-super': 'error',
            curly: 'off',
            'dot-notation': 'off',
            'eol-last': 'error',
            eqeqeq: ['error', 'smart'],
            'guard-for-in': 'error',
            'id-blacklist': 'off',
            'id-match': 'off',
            'jsdoc/no-types': 'off',
            'no-bitwise': 'off',
            'no-caller': 'error',
            'no-console': [
                'error',
                {
                    allow: ['log', 'warn', 'dir', 'timeLog', 'assert', 'clear', 'count', 'countReset', 'group', 'groupEnd', 'table', 'dirxml', 'error', 'groupCollapsed', 'Console', 'profile', 'profileEnd', 'timeStamp', 'context']
                }
            ],
            'no-debugger': 'error',
            'no-empty': 'off',
            'no-empty-function': 'off',
            'no-eval': 'error',
            'no-fallthrough': 'error',
            'no-new-wrappers': 'error',
            'no-restricted-imports': ['error', 'rxjs/Rx'],
            'no-shadow': 'error',
            'no-throw-literal': 'error',
            'no-trailing-spaces': 'error',
            'no-undef-init': 'error',
            'no-underscore-dangle': 'off',
            'no-unused-expressions': 'error',
            'no-unused-labels': 'error',
            'no-var': 'error',
            'prefer-const': 'error',
            radix: 'error',
            'spaced-comment': [
                'error',
                'always',
                {
                    markers: ['/']
                }
            ],
            'require-await': 'error',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-floating-promises': 'off',
            '@typescript-eslint/no-var-requires': 'off',
            '@typescript-eslint/naming-convention': 'off',
            '@typescript-eslint/restrict-plus-operands': 'off',
            '@typescript-eslint/await-thenable': 'off',
            '@typescript-eslint/only-throw-error': 'off',
            '@typescript-eslint/no-unsafe-function-type': 'off',
            '@typescript-eslint/no-unnecessary-type-assertion': 'off',
            '@typescript-eslint/no-misused-promises': 'off',
            '@typescript-eslint/restrict-template-expressions': 'off',
            'no-prototype-builtins': 'error',
            '@typescript-eslint/ban-types': 'off',
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    ignoreClassWithStaticInitBlock: true,
                    argsIgnorePattern: '^_',
                    caughtErrors: 'none'
                }
            ],
            // https://typescript-eslint.io/rules/no-unused-vars/#how-to-use
            'no-unused-vars': 'off',
            '@typescript-eslint/triple-slash-reference': 'off',
            '@typescript-eslint/no-inferrable-types': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            indent: 'off',
            '@typescript-eslint/no-empty-interface': 'off',
            semi: 'error',
            'no-case-declarations': 'off',
            'no-self-assign': 'off',
            'no-constant-condition': 'off',
            '@typescript-eslint/no-this-alias': 'off',
            'prefer-rest-params': 'off',
            'prefer-spread': 'off',
            '@typescript-eslint/prefer-as-const': 'o
```

### Core Architecture Module: `examples/angular/capacitor.config.ts`
```
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'info.rxdb.example',
  appName: 'angular',
  webDir: 'dist/angular/capacitor/browser',
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase'
    }
  }
};

export default config;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9160** (2026-09-30): **Improve replication diagram animations and options**
  *Symptoms*: ## This PR contains: - IMPROVED DOCS (landing page component `docs-src/src/components/replication-diagram.tsx`)  ## Describe the problem you have without this PR The replication diagram on the landing page (hero, sync section, and offline section) only moved a plain dot along each line. The offline demo did not show what offline-first actually does. The component also regenerated `@keyframes` on every heartbeat and could not be configured beyond `scale`, `hasIcon`, and `demoOffline`.  ### Visual and animation changes - Connection lines are drawn in SVG. Offline lines are dashed, and a line highlights on hover. - Packets have a glow, a short trail, and eased motion. The line flashes in the packet color while a change travels. - The source device shows a send ring, the cloud pulses when it receives the change, and receiving devices show a ring and a short bump when the change arrives. - Offline demo: the offline device keeps writing locally. The blocked write bounces off the wifi-off badge and the device shows a pending-changes counter. After `offlineBeats` heartbeats the device reconnects, pushes its pending changes, and shows a synced checkmark. Then another device goes offline.  ### New props (all optional, the defaults keep the current call sites unchanged) - `devices`: custom device list and count - `showLabels` / `labels`: device labels placed outward from the cloud - `showStatus`: a text line describing the current step (`aria-live`) - `interactive` (default `true`): cli
  **Post-Mortem & Fix Analysis**:
  > `test-others-replications` failed in `replication-nats.test.js` → `base test suite` → `live replication` → `push replication to client-server` with `2 !== 3` ([job log](https://github.com/pubkey/rxdb/actions/runs/36699219344/job/109834429548)).  This PR only changes `docs-src/src/components/replication-diagram.tsx`, a docs-site component that is not part of `src/` or the `dist/` build the replication tests run against, so the failure does not come from this change. The assertion counts pushed documents after a short wait against a live NATS server, which points to a timing issue in that test. There is no existing fix to port.  I could not re-run the job myself (the integration gets a 403 on re-run), so a maintainer re-run of the failed job should confirm it.  --- _Generated by [Claude Code](https://claude.ai/code)_

- **Issue #9157** (2026-09-30): **Update dependency electron to v44.4.4**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [electron](https://redirect.github.com/electron/electron) | [`44.4.3` → `44.4.4`](https://renovatebot.com/diffs/npm/electron/44.4.3/44.4.4) | ![age](https://developer.mend.io/api/mc/badges/age/npm/electron/44.4.4?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/electron/44.4.3/44.4.4?slim=true) |  ---  ### Release Notes  <details> <summary>electron/electron (electron)</summary>  ### [`v44.4.4`](https://redirect.github.com/electron/electron/releases/tag/v44.4.4): electron v44.4.4  [Compare Source](https://redirect.github.com/electron/electron/compare/v44.4.3...v44.4.4)  ### Release Notes for v44.4.4  #### Fixes  - Fixed a `Cannot read properties of undefined (reading 'startTime')` error thrown in pages while the DevTools Performance panel's live metrics were active. [#&#8203;54162](https://redirect.github.com/electron/electron/pull/54162) - Fixed a crash when calling `setIgnoreMenuShortcuts()` on DevTools. [#&#8203;54116](https://redirect.github.com/electron/electron/pull/54116) <sup>(Also in [43](https://redirect.github.com/electron/electron/pull/54117), [45](https://redirect.github.com/electron/electron/pull/54115))</sup> - Fixed a spurious "`sandboxed_renderer.bundle.js` script failed to run" console error when DevTools attached to a sandboxed 

- **Issue #9156** (2026-09-30): **Update dependency vite to v8.3.0**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [vite](https://vite.dev) ([source](https://redirect.github.com/vitejs/vite/tree/HEAD/packages/vite)) | [`8.2.2` → `8.3.0`](https://renovatebot.com/diffs/npm/vite/8.2.2/8.3.0) | ![age](https://developer.mend.io/api/mc/badges/age/npm/vite/8.3.0?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/vite/8.2.2/8.3.0?slim=true) |  ---  ### Release Notes  <details> <summary>vitejs/vite (vite)</summary>  ### [`v8.3.0`](https://redirect.github.com/vitejs/vite/blob/HEAD/packages/vite/CHANGELOG.md#830-2026-09-10)  [Compare Source](https://redirect.github.com/vitejs/vite/compare/v8.2.2...v8.3.0)  ##### Features  - **build:** avoid settling seen preload dependencies for performance ([#&#8203;23446](https://redirect.github.com/vitejs/vite/issues/23446)) ([e6f6b3e](https://redirect.github.com/vitejs/vite/commit/e6f6b3e3119256daa837b2dc399058c8aa45b470))  ##### Bug Fixes  - handle CRLF line endings in code frame positions ([#&#8203;23219](https://redirect.github.com/vitejs/vite/issues/23219)) ([9913672](https://redirect.github.com/vitejs/vite/commit/9913672bee9c34a2df7fff4c2538783cd4f43b4e)) - only treat whole `node_modules` path segments as dependencies (fix [#&#8203;17467](https://redirect.github.com/vitejs/vite/issues/17467)) ([#&#8203;23437](https://redirect.git

- **Issue #9155** (2026-09-29): **Update dependency @supabase/supabase-js to v2.117.0**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [@supabase/supabase-js](https://redirect.github.com/supabase/supabase-js/tree/master/packages/core/supabase-js) ([source](https://redirect.github.com/supabase/supabase-js/tree/HEAD/packages/core/supabase-js)) | [`2.116.0` → `2.117.0`](https://renovatebot.com/diffs/npm/@supabase%2fsupabase-js/2.116.0/2.117.0) | ![age](https://developer.mend.io/api/mc/badges/age/npm/@supabase%2fsupabase-js/2.117.0?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/@supabase%2fsupabase-js/2.116.0/2.117.0?slim=true) |  ---  ### Release Notes  <details> <summary>supabase/supabase-js (@&#8203;supabase/supabase-js)</summary>  ### [`v2.117.0`](https://redirect.github.com/supabase/supabase-js/blob/HEAD/packages/core/supabase-js/CHANGELOG.md#21170-2026-09-22)  [Compare Source](https://redirect.github.com/supabase/supabase-js/compare/v2.116.0...v2.117.0)  ##### 🚀 Features  - **auth:** enable passkey API by default and deprecate experimental passkey opt-in ([#&#8203;2695](https://redirect.github.com/supabase/supabase-js/pull/2695))  ##### ❤️ Thank You  - fadymak  </details>  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - At any time (no schedule defined) - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Enabled.  ♻ **Rebasing**: Whene

- **Issue #9154** (2026-09-30): **ADD Nostr signaling for the WebRTC replication**
  *Symptoms*: ## This PR contains: - A NEW FEATURE - IMPROVED DOCS - IMPROVED TESTS  ## Describe the problem you have without this PR  The WebRTC replication needs a signaling server so that peers can find each other. The default one at `signaling.rxdb.info` is for demos only, so every production user has to host their own.  This PR adds `getConnectionHandlerNostr({ relays, secretKey?, eventKind? })`, which does the signaling over [Nostr](https://nostr.how/en/what-is-nostr) relays instead. There are many public relays, and you can self-host one with software like strfry.  How it works: - **Reuses the existing peer handling.** The handler wraps `getConnectionHandlerSimplePeer()` and passes in a WebSocket-like class that translates the signaling messages (`init`, `join`, `joined`, `signal`) into Nostr events. All the connect-timeout, reconnect and chunking logic stays in one place. - **Only signaling goes over the relays.** Documents still go directly over the WebRTC data channel. - **Ephemeral events.** Signaling uses kind `25050` by default (configurable within 20000–29999), so relays forward the events but don't store them. Events are tagged with a SHA-256 hash of the topic. - **Presence.** Each peer publishes presence every 10s and is dropped after 35s without one. A `leave` event is sent on close. - **Encrypted, signed signals.** Offers, answers and ICE candidates are NIP-44 encrypted to the receiver. Events with an invalid signature, a stale `created_at`, or already seen from another r
  **Post-Mortem & Fix Analysis**:
  > <!-- test-without-fix-bot --> ## ✅ Verify Test Reproduction: Tests FAILED without the fix (expected)  This confirms the changed tests correctly reproduce the bug that the source changes fix.  _This workflow runs the changed tests **without** the source fix to verify they reproduce the bug._  <details> <summary>Show output</summary>  ``` ...(truncated, showing last 200 of 265 lines)     at afterResolve (node:internal/modules/esm/loader:611:52)     at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:617:12)     ... collapsed 6 duplicate lines matching above lines ...     at node:internal/modules/esm/loader:636:32     at TracingChannel.tracePromise (node:diagnostics_channel:362:14)     at ModuleLoader.import (node:internal/modules/esm/loader:632:21)     at defaultImportModuleDynamicallyForScript (node:internal/modules/esm/utils:240:31)     at importModuleDynamicallyCallback (node:internal/modules/esm/utils:264:12)     at exports.doImport (/home/runner/work/rxdb/rxdb/nod

- **Issue #9153** (2026-09-30): **Improve performance of sortObject()**
  *Symptoms*: ## This PR contains: - IMPROVED TESTS - A BREAKING CHANGE (schema hashes change) - SOMETHING ELSE (performance improvement)  ## Describe the problem you have without this PR `sortObject()` runs for schema normalization and for every `RxQuery.toString()` cache key. It used `forEach()`/`map()` closures, checked `Array.isArray()` twice even for primitive values, and sorted with `localeCompare()`.  `localeCompare()` has two problems: - **Cold start cost**: the first call initializes the ICU collator. In Chromium this takes 5.7 to 8.8 ms (measured on 6 fresh pages), and it happens during the first `addCollections()`. - **Locale dependent**: without arguments it uses the default locale of the runtime, so the normalized schema and its hash could differ between environments. For example `s`, `z`, `t`, `y` sort as `s t y z` in `en` but as `s z t y` in `et`.  This PR: - returns primitives early and returns arrays directly when `noArraySort` is set - uses plain `for` loops - sorts object keys with the default `Array.prototype.sort()` (UTF-16 code units) and string array items with `<`/`>`. The result is deterministic across locales.  This changes the key order for common schema keys (for example `maxLength` now sorts before `maximum`), so **the schema hash of most schemas changes**.  ### Initial database load in the browser (Chromium, Dexie storage) `createRxDatabase()` + `addCollections()` with 5 collections, instrumented `sortObject()` (5 top-level calls per load), median of 6 fresh p
  **Post-Mortem & Fix Analysis**:
  > <!-- test-without-fix-bot --> ## ✅ Verify Test Reproduction: Tests FAILED without the fix (expected)  This confirms the changed tests correctly reproduce the bug that the source changes fix.  _This workflow runs the changed tests **without** the source fix to verify they reproduce the bug._  <details> <summary>Show output</summary>  ``` ...(truncated, showing last 200 of 309 lines) +   'ä',     'b', +   'B', +   'maximum',     'maxLength', -   'maximum',     's',     'z', -   'ä'   ]        + expected - actual         [       +  "A"       +  "B"          "_id"          "a"       -  "A"       -  "ä"          "b"       -  "B"       -  "maximum"          "maxLength"       +  "maximum"          "s"          "z"       +  "ä"        ]              at Context.<anonymous> (file:///home/runner/work/rxdb/rxdb/test/unit/util.test.ts:112:20)       at processImmediate (node:internal/timers:574:21)     === test:browser:dexie output ===  > rxdb@17.5.0 test:browser:dexie > npm run transpile && cross-e
  > The test-without-fix result is expected here. This PR is a performance refactor that does not change behavior, so the new `sortObject()` tests are regression tests. They have to pass both with and without the source change. They make sure the optimized version keeps the same key order and array handling, which schema hashes and query cache keys depend on.  --- _Generated by [Claude Code](https://claude.ai/code)_
  > `test-others-replications` failed on `0e15a49` in `replication-nats.test.js` → `wait for server to be reachable` with `NatsError: CONNECTION_REFUSED`. The failure happened 7ms after mocha started, while the `nats:2.9.17` Docker container was still starting.  This is not caused by this PR: - `0e15a49` only changes the changelog file. - The same job passed on `ac9646c` and `732d7e0`, which have identical source code. - The test creates `connectionStatePromise` with a single `connect()` call at module load, so it does not retry when the server is not up yet.  I could not re-run the job (403 for this integration). A maintainer re-run of the failed job should pass. Making the test robust would mean retrying `connect()` until the server answers, which is outside this PR, so I did not add it here.  --- _Generated by [Claude Code](https://claude.ai/code)_

- **Issue #9152** (2026-09-29): **Recover replication after failed start**
  *Symptoms*: A rejected replication `start()` poisoned the start queue, caused later lifecycle calls to reject, and bypassed `error$`.  - **Recovery**   - Reset failed startup state so later `start()` calls can retry.   - Close partially created metadata storage before retrying.  - **Error handling**   - Emit startup failures through `error$` as `RC_START`.   - Handle internal auto-start and visibility-triggered rejections.  - **Regression coverage**   - Move coverage into `replication.test.ts`.   - Inject the failure by overriding `_start()` instead of wrapping storage APIs.  ```ts replicationState._start = () =>     Promise.reject(new Error('start failed')); ```
  **Post-Mortem & Fix Analysis**:
  > <!-- test-without-fix-bot --> ## ✅ Verify Test Reproduction: Tests FAILED without the fix (expected)  This confirms the changed tests correctly reproduce the bug that the source changes fix.  _This workflow runs the changed tests **without** the source fix to verify they reproduce the bug._  <details> <summary>Show output</summary>  ``` ...(truncated, showing last 200 of 3138 lines)       [32m✓ [39mshould get a hook       [32m✓ [39mshould get a parallel hook     insert       pre         positive           [32m✓ [39mseries           [32m✓ [39mparallel           [32m✓ [39mshould save a modified document           [32m✓ [39masync: should save a modified document           [32m✓ [39mshould not insert if hook throws           [32m✓ [39mshould have the collection bound to the this-scope       post         positive           [32m✓ [39mseries           [32m✓ [39mparallel           [32m✓ [39mshould call post insert hook after bulkInsert     save       pre         positive 

- **Issue #9151** (2026-09-29): **Update dependency react-native-gesture-handler to v3.3.0**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [react-native-gesture-handler](https://docs.swmansion.com/react-native-gesture-handler/) ([source](https://redirect.github.com/software-mansion/react-native-gesture-handler)) | [`3.2.1` → `3.3.0`](https://renovatebot.com/diffs/npm/react-native-gesture-handler/3.2.1/3.3.0) | ![age](https://developer.mend.io/api/mc/badges/age/npm/react-native-gesture-handler/3.3.0?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/react-native-gesture-handler/3.2.1/3.3.0?slim=true) |  ---  ### Release Notes  <details> <summary>software-mansion/react-native-gesture-handler (react-native-gesture-handler)</summary>  ### [`v3.3.0`](https://redirect.github.com/software-mansion/react-native-gesture-handler/releases/tag/v3.3.0)  [Compare Source](https://redirect.github.com/software-mansion/react-native-gesture-handler/compare/v3.2.1...v3.3.0)  #### 🐛 Bug fixes  - Keep ReanimatedSwipeable native handlers stable when event callbacks change by [@&#8203;ngocdevv](https://redirect.github.com/ngocdevv) in [#&#8203;4466](https://redirect.github.com/software-mansion/react-native-gesture-handler/pull/4466) - Forward press handlers as `testOnly_*` in `PressableWithTouchable` by [@&#8203;huextrat](https://redirect.github.com/huextrat) in [#&#8203;4416](https://redirect.github.com/sof

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

### Incident Patch 1: `e6ced47a` (2026-09-25)
**Commit Message**: FIX WebRTC replication reliability (#9125)

* FIX WebRTC replication reliability

- Reconnect to the signaling server with exponential backoff instead of
  a tight loop, and handle socket errors so Node.js does not crash when
  the server is unreachable.
- Give peer connections a connect timeout, reconnect them with backoff
  from the initiator side only, and tag signals with a connectionId so
  signals of outdated attempts are ignored instead of throwing.
- Answer replication requests from one global message handler so the
  first request of a peer is not lost when it arrives before the own
  handshake finished.
- Let requests fail on disconnect, timeout (new requestTimeout option)
  and remote errors so the replication retries instead of hanging.
- Filter the master change stream by peer so that with 3+ peers the
  events of one master are not applied to other replications.
- Send a RESYNC when the change stream starts so no changes are missed.
- Split messages over the data channel size limit into chunks.
- Signaling server: notify the room when a peer leaves, fix the
  duplicate-join check, guard sends to closed sockets.
- Re-enable the WebRTC tests and add tests for unreachabl

**File**: `docs-src/docs/replication-webrtc.md` (modified, +20/-0)
```diff
@@ -222,6 +222,26 @@ const replicationPool = await replicateWebRTC(
 );
 ```
 
+## Connection Handling and Timeouts
+
+The simple-peer connection handler reconnects on its own when the connection to the signaling server or to another peer breaks. Reconnects run with an exponential backoff that starts at `500ms` and is capped at `15s`, so that an unreachable signaling server does not cause a busy loop. A peer connection that is not established within `15s` is dropped and a new attempt is started. Existing WebRTC connections keep replicating while the signaling server is offline.
+
+Messages that are bigger than the message size limit of the WebRTC data channel (which can be as low as `64 KiB` depending on the browser) are split into chunks, so you can replicate big documents.
+
+Each request to another peer fails when no answer arrives in time. The replication then retries after `retryTime`. You can change the timeout with the `requestTimeout` option:
+
+```ts
+const replicationPool = await replicateWebRTC(
+    {
+        /* ... */
+        // (optional) time in milliseconds [default=20000]
+        requestTimeout: 30000,
+        pull: {},
+        push: {}
+    }
+);
+```
+
 ## Conflict detection in WebRTC replication
 
 RxDB's conflict handling works by detecting and resolving conflicts that may arise when multiple clients in a decentralized database system attempt to modify the same data concurrently.
```

**File**: `orga/changelog/fix-webrtc-replication-reliability.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+- FIX WebRTC replication was flaky and could spin or stop syncing:
+  - The simple-peer connection handler reconnected to the signaling server in a tight loop without delay and crashed in Node.js when the server was not reachable. Reconnects now use an exponential backoff.
+  - A failed peer connection was recreated in an endless loop. Peer connections now have a connect timeout, reconnect with a backoff, and signals of outdated connection attempts are ignored instead of throwing.
+  - The first replication request of a peer could get lost when it arrived before the own handshake was done, which made the sync hang forever. Requests are now answered independently of the handshake state.
+  - Requests to a disconnected peer never resolved. They now fail on disconnect, on timeout (new `requestTimeout` option) and when the remote peer throws, so the replication retries.
+  - With three or more peers, change stream events of one master were applied to the replications of all other masters.
+  - Messages bigger than the data channel size limit failed. They are now split into chunks.
+  - The signaling server now tells the other peers of a room when a peer leaves.
+  - Re-enabled the WebRTC replication tests and added tests for an unreachable signaling server, a signaling server restart and big documents with three peers.
+  - `RxWebRTCReplicationPool.cancel()` now awaits the cancelation of all replications, so they do not write to the storage after the database was closed.
+- FIX replication-protocol: when the upstream had push conflicts, `persistToMaster()` wrote the resolved conflicts to the fork and meta instance even when the replication was canceled while the conflicts were resolved. This caused "already closed" errors when a database was closed during a replication.
```

**File**: `src/plugins/replication-webrtc/connection-handler-simple-peer.ts` (modified, +426/-119)
```diff
@@ -1,9 +1,8 @@
 import { Subject } from 'rxjs';
 import {
     ensureNotFalsy,
-    getFromMapOrThrow,
+    errorToPlainJson,
     PROMISE_RESOLVE_VOID,
-    promiseWait,
     randomToken
 } from '../../plugins/utils/index.ts';
 import type {
@@ -52,7 +51,13 @@ export type SimplePeerSignalMessage = {
     room: string;
     senderPeerId: string;
     receiverPeerId: string;
-    data: string;
+    data: any;
+    /**
+     * Identifies the connection attempt so that signals
+     * of outdated attempts are not mixed up with the current one.
+     * Optional because older RxDB versions do not send it.
+     */
+    connectionId?: string;
 };
 export type SimplePeerPingMessage = {
     type: 'ping';
@@ -66,8 +71,17 @@ export type PeerMessage =
     SimplePeerPingMessage;
 
 
-function sendMessage(ws: WebSocket, msg: PeerMessage) {
-    ws.send(JSON.stringify(msg));
+const WEBSOCKET_STATE_OPEN = 1;
+function sendMessage(ws: WebSocket | undefined, msg: PeerMessage): boolean {
+    if (!ws || ws.readyState !== WEBSOCKET_STATE_OPEN) {
+        return false;
+    }
+    try {
+        ws.send(JSON.stringify(msg));
+        return true;
+    } catch (err) {
+        return false;
+    }
 }
 
 const DEFAULT_SIGNALING_SERVER_HOSTNAME = 'signaling.rxdb.info';
@@ -122,6 +136,38 @@ export type SimplePeerConnectionHandlerOptions = {
 
 export const SIMPLE_PEER_PING_INTERVAL = 1000 * 60 * 2;
 
+/**
+ * If a peer connection is not established in this time,
+ * it is destroyed and a new connection attempt is started.
+ */
+export const SIMPLE_PEER_CONNECT_TIMEOUT = 1000 * 15;
+
+/**
+ * Min and max delay between reconnection attempts
+ * to the signaling server and to other peers.
+ * The delay doubles on each failed attempt.
+ */
+export const SIMPLE_PEER_RECONNECT_DELAY_MIN = 500;
+export const SIMPLE_PEER_RECONNECT_DELAY_MAX = 1000 * 15;
+
+/**
+ * Messages bigger than this are split into chunks
+ * because WebRTC data channels have a message size limit
+ * which can be as low as 64 KiB depending on the browser.
+ * The size is measured in string length and one character can
+ * be up to 3 bytes in UTF-8.
+ */
+export const SIMPLE_PEER_MAX_MESSAGE_LENGTH = 1024 * 16;
+
+type SimplePeerChunk = {
+    chunk: {
+        id: string;
+        index: number;
+        total: number;
+        data: string;
+    };
+};
+
 /**
  * Returns a connection handler that uses simple-peer and the signaling server.
  */
@@ -159,136 +205,356 @@ export function getConnectionHandlerSimplePeer({
         const response$ = new Subject<PeerWithResponse<SimplePeer>>();
         const error$ = new Subject<RxError | RxTypeError>();
 
-        const peers = new Map<string, SimplePeer>();
+        /**
+         * The current peer connection by remote peer id.
+         */
+        const peers = new Map<string, SimplePeerState>();
+        /**
+         * The ids of the other peers that are in the room,
+         * as reported by the signaling server.
+         */
+        let roomPeerIds = new Set<string>();
+        const peerReconnectDelay = new Map<string, number>();
+        const peerReconnectTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
+
         let closed = false;
-        let ownPeerId: string;
+        let ownPeerId: string | undefined;
         let socket: WebSocket | undefined = undefined;
-        createSocket();
-
+        let socketReconnectDelay = SIMPLE_PEER_RECONNECT_DELAY_MIN;
+        let socketReconnectTimeout: ReturnType<typeof setTimeout> | undefined;
 
         /**
          * Send ping signals to the server.
          */
-        (async () => {
-            while (true) {
-                await promiseWait(SIMPLE_PEER_PING_INTERVAL / 2);
-                if (closed) {
-                    break;
+        const pingInterval = setInterval(() => {
+            sendMessage(socket, { type: 'ping' });
+        }, SIMPLE_PEER_PING_INTERVAL / 2);
+
+        type SimplePeerState = {
+            remotePeerId: string;
+            connect
```

**File**: `src/plugins/replication-webrtc/index.ts` (modified, +174/-70)
```diff
@@ -17,19 +17,23 @@ import type {
 } from '../../types/index.d.ts';
 import {
     ensureNotFalsy,
-    getFromMapOrThrow,
+    errorToPlainJson,
+    PROMISE_RESOLVE_TRUE,
+    PROMISE_RESOLVE_VOID,
     randomToken
 } from '../../plugins/utils/index.ts';
 import { RxDBLeaderElectionPlugin } from '../leader-election/index.ts';
 import { replicateRxCollection } from '../replication/index.ts';
 import {
     isMasterInWebRTCReplication,
-    sendMessageAndAwaitAnswer
+    sendMessageAndAwaitAnswer,
+    WEBRTC_DEFAULT_REQUEST_TIMEOUT
 } from './webrtc-helper.ts';
 import type {
     PeerWithMessage,
     PeerWithResponse,
     WebRTCConnectionHandler,
+    WebRTCMessage,
     WebRTCPeerState,
     WebRTCReplicationCheckpoint,
     WebRTCResponse,
@@ -39,6 +43,15 @@ import type {
 import { newRxError } from '../../rx-error.ts';
 
 
+/**
+ * The methods of the master replication handler
+ * that remote peers are allowed to call.
+ */
+const WEBRTC_MASTER_METHODS: string[] = [
+    'masterChangesSince',
+    'masterWrite'
+];
+
 export async function replicateWebRTC<RxDocType, PeerType>(
     options: SyncOptionsWebRTC<RxDocType, PeerType>
 ): Promise<RxWebRTCReplicationPool<RxDocType, PeerType>> {
@@ -75,24 +88,68 @@ export async function replicateWebRTC<RxDocType, PeerType>(
         options,
         await options.connectionHandlerCreator(options)
     );
+    const requestTimeout = options.requestTimeout ? options.requestTimeout : WEBRTC_DEFAULT_REQUEST_TIMEOUT;
+    const masterHandler = pool.masterReplicationHandler;
 
+    function sendToPeer(peer: PeerType, messageOrResponse: WebRTCMessage | WebRTCResponse) {
+        return Promise.resolve()
+            .then(() => pool.connectionHandler.send(peer, messageOrResponse))
+            .catch(() => {
+                /**
+                 * Sending fails when the peer disconnected in the meantime.
+                 * This is handled by the disconnect$ stream so it can be ignored here.
+                 */
+            });
+    }
 
     pool.subs.push(
         pool.connectionHandler.error$.subscribe((err: RxError | RxTypeError) => pool.error$.next(err)),
-        pool.connectionHandler.disconnect$.subscribe((peer: PeerType) => pool.removePeer(peer))
+        pool.connectionHandler.disconnect$.subscribe((peer: PeerType) => {
+            pool.connectedPeers.delete(peer);
+            pool.peerValidity.delete(peer);
+            pool.removePeer(peer);
+        })
     );
 
     /**
-     * Answer if someone requests our storage token
+     * Answer the requests of other peers.
+     * This is subscribed once for all peers
+     * and independent of which side is master,
+     * so that no request gets lost when the remote peer
+     * finishes its handshake before the own side has finished it.
      */
     pool.subs.push(
-        pool.connectionHandler.message$.pipe(
-            filter((data: PeerWithMessage<PeerType>) => data.message.method === 'token')
-        ).subscribe((data: PeerWithMessage<PeerType>) => {
-            pool.connectionHandler.send(data.peer, {
-                id: data.message.id,
-                result: storageToken
-            });
+        pool.connectionHandler.message$.subscribe(async (data: PeerWithMessage<PeerType>) => {
+            const { peer, message } = data;
+            if (message.method === 'token') {
+                sendToPeer(peer, {
+                    id: message.id,
+                    result: storageToken
+                });
+                return;
+            }
+            if (!WEBRTC_MASTER_METHODS.includes(message.method)) {
+                return;
+            }
+            const isValid = await pool.isPeerValid(peer);
+            if (!isValid || pool.canceled) {
+                return;
+            }
+            let response: WebRTCResponse;
+            try {
+                const result = await (masterHandler as any)[message.method](...message.params);
+                response = {
+                    id: me
```

**File**: `src/plugins/replication-webrtc/signaling-server.ts` (modified, +41/-18)
```diff
@@ -61,17 +61,41 @@ export async function startSignalingServerSimplePeer(
     function disconnectSocket(peerId: string, reason: string) {
         console.log('# disconnect peer ' + peerId + ' reason: ' + reason);
         const peer = peerById.get(peerId);
+        peerById.delete(peerId);
         if (peer) {
-            peer.socket.close && peer.socket.close(undefined, reason);
+            try {
+                peer.socket.close && peer.socket.close(undefined, reason);
+            } catch (err) { }
             peer.rooms.forEach(roomId => {
                 const room = peersByRoom.get(roomId);
-                room?.delete(peerId);
-                if (room && room.size === 0) {
+                if (!room) {
+                    return;
+                }
+                room.delete(peerId);
+                if (room.size === 0) {
                     peersByRoom.delete(roomId);
+                } else {
+                    // tell the remaining peers about the new room state
+                    sendRoomState(room);
                 }
             });
         }
-        peerById.delete(peerId);
+    }
+
+    function sendRoomState(room: Set<string>) {
+        const otherPeerIds = Array.from(room);
+        room.forEach(otherPeerId => {
+            const otherPeer = peerById.get(otherPeerId);
+            if (otherPeer) {
+                sendMessage(
+                    otherPeer.socket,
+                    {
+                        type: 'joined',
+                        otherPeerIds
+                    }
+                );
+            }
+        });
     }
 
     wss.on('connection', function (ws: WebSocket) {
@@ -102,7 +126,13 @@ export async function startSignalingServerSimplePeer(
 
         ws.on('message', (msgEvent: any) => {
             peer.lastPing = Date.now();
-            const message = JSON.parse(msgEvent.toString());
+            let message: any;
+            try {
+                message = JSON.parse(msgEvent.toString());
+            } catch (err) {
+                disconnectSocket(peerId, 'invalid message');
+                return;
+            }
             const type = message.type;
             switch (type) {
                 case 'join':
@@ -115,7 +145,7 @@ export async function startSignalingServerSimplePeer(
                         return;
                     }
 
-                    if (peer.rooms.has(peerId)) {
+                    if (peer.rooms.has(roomId)) {
                         return;
                     }
                     peer.rooms.add(roomId);
@@ -130,18 +160,7 @@ export async function startSignalingServerSimplePeer(
                     room.add(peerId);
 
                     // tell everyone about new room state
-                    room.forEach(otherPeerId => {
-                        const otherPeer = peerById.get(otherPeerId);
-                        if (otherPeer) {
-                            sendMessage(
-                                otherPeer.socket,
-                                {
-                                    type: 'joined',
-                                    otherPeerIds: Array.from(room)
-                                }
-                            );
-                        }
-                    });
+                    sendRoomState(room);
                     break;
                 case 'signal':
                     if (
@@ -175,7 +194,11 @@ export async function startSignalingServerSimplePeer(
 }
 
 
+const WEBSOCKET_STATE_OPEN = 1;
 function sendMessage(ws: WebSocket, message: PeerMessage) {
+    if (ws.readyState !== WEBSOCKET_STATE_OPEN) {
+        return;
+    }
     const msgString = JSON.stringify(message);
     ws.send(msgString);
 }
```

---

### Incident Patch 2: `cdfaea53` (2026-09-10)
**Commit Message**: FIX migration finalize removed storages in parallel (#9024) (#9077)

The schema migration cleanup ran
Promise.all([oldStorage.remove(), metaStorage.remove()]).
Storages like SQLite share a single connection between all storage
instances of one database, so both DROP TABLE statements were sent to
that connection at the same time and bypassed TX_QUEUE_BY_DATABASE.
Async single-connection adapters like expo-sqlite then fail with
SQLITE_LOCKED "database is locked" and the collection migration blocks
the database initialization.

- remove the storages one after another instead of in parallel
- run the DROP TABLE of the SQLite RxStorage inside of a transaction so
  that it goes through TX_QUEUE_BY_DATABASE for every caller
- add a test that tracks statements which overlap on a single SQLite
  connection during a schema migration


Claude-Session: https://claude.ai/code/session_01GgQEq3csYGtYb3RYhkj1ka

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `orga/changelog/fix-migration-concurrent-storage-remove.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- FIX schema migration finalized with `Promise.all([oldStorage.remove(), metaStorage.remove()])` which removed both storage instances at the same time. Storages like SQLite share a single connection between all storage instances of one database, so the two `DROP TABLE` statements were sent to the same connection concurrently and async single-connection adapters like expo-sqlite failed with `SQLITE_LOCKED` ("database is locked"). The storages are now removed one after another and the `DROP TABLE` of the SQLite RxStorage runs inside of a transaction so that it goes through `TX_QUEUE_BY_DATABASE`. Added a test case that tracks overlapping statements on a single SQLite connection. Fixes [#9024](https://github.com/pubkey/rxdb/issues/9024).
```

**File**: `src/plugins/migration-schema/rx-migration-state.ts` (modified, +8/-4)
```diff
@@ -551,10 +551,14 @@ export class RxMigrationState {
         // cleanup old storages
         this.openStorageInstances.delete(oldStorage);
         this.openStorageInstances.delete(replicationMetaStorageInstance);
-        await Promise.all([
-            oldStorage.remove(),
-            replicationMetaStorageInstance.remove()
-        ]);
+        /**
+         * Remove the storages one after another, not in parallel.
+         * Storages like SQLite share a single connection between all
+         * storage instances of one database and can only run
+         * one operation on it at the same time.
+         */
+        await oldStorage.remove();
+        await replicationMetaStorageInstance.remove();
 
         await cancelRxStorageReplication(replicationState);
     }
```

**File**: `src/plugins/storage-sqlite/sqlite-storage-instance.ts` (modified, +27/-13)
```diff
@@ -447,20 +447,34 @@ export class RxStorageInstanceSQLite<RxDocType> implements RxStorageInstance<
             throw new Error('closed already');
         }
         const database = await this.internals.databasePromise;
-        const promises = [
-            this.run(
-                database,
-                {
-                    query: `DROP TABLE IF EXISTS "${this.tableName}"`,
-                    params: [],
-                    context: {
-                        method: 'remove',
-                        data: this.tableName
+        /**
+         * The DROP TABLE must run inside of a transaction so that it
+         * goes through TX_QUEUE_BY_DATABASE. All storage instances of one
+         * database share a single connection and adapters like expo-sqlite
+         * throw SQLITE_LOCKED when two statements run on it at the same time.
+         */
+        await sqliteTransaction(
+            database,
+            this.sqliteBasics,
+            async () => {
+                await this.run(
+                    database,
+                    {
+                        query: `DROP TABLE IF EXISTS "${this.tableName}"`,
+                        params: [],
+                        context: {
+                            method: 'remove',
+                            data: this.tableName
+                        }
                     }
-                }
-            )
-        ];
-        await Promise.all(promises);
+                );
+                return 'COMMIT';
+            },
+            {
+                databaseName: this.databaseName,
+                collectionName: this.collectionName
+            }
+        );
         return this.close();
     }
 
```

**File**: `test/unit.test.ts` (modified, +1/-0)
```diff
@@ -27,6 +27,7 @@ import './unit/rx-storage-helper.test.ts';
 
 import './unit/rx-storage-dexie.test.ts';
 import './unit/rx-storage-localstorage.test.ts';
+import './unit/rx-storage-sqlite.test.ts';
 import './unit/rx-storage-remote.test.ts';
 import './unit/instance-of-check.test.ts';
 import './unit/rx-schema.test.ts';
```

**File**: `test/unit/rx-storage-sqlite.test.ts` (added, +222/-0)
```diff
@@ -0,0 +1,222 @@
+import assert from 'assert';
+import './config.ts';
+
+import {
+    addRxPlugin,
+    createRxDatabase,
+    promiseWait,
+    randomToken
+} from '../../plugins/core/index.mjs';
+import { isNode } from '../../plugins/test-utils/index.mjs';
+import { RxDBMigrationPlugin } from '../../plugins/migration-schema/index.mjs';
+import { wrappedValidateAjvStorage } from '../../plugins/validate-ajv/index.mjs';
+import {
+    getRxStorageSQLiteTrial,
+    getSQLiteBasicsNodeNative
+} from '../../plugins/storage-sqlite/index.mjs';
+import type {
+    SQLiteBasics,
+    SQLiteQueryWithParams
+} from '../../plugins/storage-sqlite/index.mjs';
+
+type ConcurrencyTracker = {
+    basics: SQLiteBasics<any>;
+    /**
+     * Contains one entry for each statement that was started
+     * while at least one other statement was still running
+     * on the same connection.
+     */
+    overlaps: string[];
+};
+
+/**
+ * Wraps a SQLiteBasics so that every statement takes at least one tick,
+ * like it does on react-native adapters like expo-sqlite where each
+ * statement is sent over an async bridge to the native side.
+ * All statements that run at the same time on the same connection
+ * are tracked, so a test can detect statements that do not go
+ * through TX_QUEUE_BY_DATABASE.
+ */
+function getConcurrencyTrackingBasics(
+    basics: SQLiteBasics<any>
+): ConcurrencyTracker {
+    const overlaps: string[] = [];
+    const runningByConnection: WeakMap<any, Map<number, string>> = new WeakMap();
+    let statementId = 0;
+
+    function track<T>(
+        database: any,
+        queryWithParams: SQLiteQueryWithParams,
+        operation: () => Promise<T>
+    ): Promise<T> {
+        let running = runningByConnection.get(database);
+        if (!running) {
+            running = new Map();
+            runningByConnection.set(database, running);
+        }
+        const runningStatements = running;
+        const query = queryWithParams.query;
+        if (runningStatements.size > 0) {
+            overlaps.push(
+                query + ' ran at the same time as: ' +
+                Array.from(runningStatements.values()).join(' , ')
+            );
+        }
+        const id = statementId++;
+        runningStatements.set(id, query);
+        return (async () => {
+            try {
+                await promiseWait(0);
+                return await operation();
+            } finally {
+                runningStatements.delete(id);
+            }
+        })();
+    }
+
+    return {
+        overlaps,
+        basics: Object.assign({}, basics, {
+            all: (database: any, queryWithParams: SQLiteQueryWithParams) => track(
+                database,
+                queryWithParams,
+                () => basics.all(database, queryWithParams)
+            ),
+            run: (database: any, queryWithParams: SQLiteQueryWithParams) => track(
+                database,
+                queryWithParams,
+                () => basics.run(database, queryWithParams)
+            )
+        })
+    };
+}
+
+const HEROES_SCHEMA_V0 = {
+    version: 0,
+    primaryKey: 'id',
+    type: 'object',
+    properties: {
+        id: {
+            type: 'string',
+            maxLength: 100
+        },
+        name: {
+            type: 'string'
+        }
+    },
+    required: ['id', 'name']
+} as const;
+
+const HEROES_SCHEMA_V1 = {
+    version: 1,
+    primaryKey: 'id',
+    type: 'object',
+    properties: {
+        id: {
+            type: 'string',
+            maxLength: 100
+        },
+        name: {
+            type: 'string'
+        },
+        age: {
+            type: 'number'
+        }
+    },
+    required: ['id', 'name']
+} as const;
+
+describe('rx-storage-sqlite.test.ts', function () {
+    this.timeout(1000 * 60);
+
+    if (!isNode) {
+        // the node:sqlite module is only available in Node.js
+        return;
+    }
+
+    addRxPlugin(RxDBMigrationPlugin);
+
+    async function getTracker(): Pr
```

---

### Incident Patch 3: `2a126c17` (2026-09-08)
**Commit Message**: FIX replication-protocol: do not read from the fork instance after the replication was canceled (#9069)

The upstream initial sync throttles its reads from the fork instance by
awaiting the running persistToMaster() promises when the master is slower
than the fork. After that await it called getChangedDocumentsSince() on the
fork without re-checking the canceled state. When the replication was
canceled in the meantime, the fork instance could already be closed.

This happened with a fast RxStorage (rxdb-premium IndexedDB) when a schema
migration was interrupted: RxMigrationState.cancel() cancels the replication
and closes the old storage, the upstream then queried the closed instance and
the "instance is closed" error ended up as an unhandled rejection which
crashed the test suite.

Re-check the canceled state after the throttle and stop the initial sync
when the replication was canceled. Added a regression test that wraps the
fork instance and asserts that it is never read after it was closed.


Claude-Session: https://claude.ai/code/session_01WZm6nTkHmUj9QPHUjtdTbJ

Co-authored-by: Claude <noreply@anthropic.com>

**File**: `orga/changelog/fix-replication-upstream-read-fork-after-cancel.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- FIX replication-protocol: the upstream initial sync could call `getChangedDocumentsSince()` on the fork `RxStorageInstance` after the replication was canceled, because it did not re-check the canceled state after it throttled on the running `persistToMaster()` promises. With a fast storage (rxdb-premium IndexedDB) this happened when a schema migration was interrupted via `RxMigrationState.cancel()` which closes the old storage, so the "instance is closed" error ended up as an unhandled rejection. Added a testcase for it in `test/unit/replication-protocol.test.ts`.
```

**File**: `src/replication-protocol/upstream.ts` (modified, +9/-0)
```diff
@@ -161,6 +161,15 @@ export async function startReplicationUpstream<RxDocType, CheckpointType>(
              */
             if (promises.size > 3) {
                 await Promise.race(Array.from(promises));
+                /**
+                 * The replication might have been canceled while we waited
+                 * for the master, for example when a schema migration is interrupted.
+                 * The forkInstance can already be closed at this point,
+                 * so we must not read from it anymore.
+                 */
+                if (state.events.canceled.getValue()) {
+                    break;
+                }
             }
             const upResult = await getChangedDocumentsSince(
                 state.input.forkInstance,
```

**File**: `test/unit/replication-protocol.test.ts` (modified, +97/-1)
```diff
@@ -33,7 +33,8 @@ import {
     requestIdlePromise,
     promiseSeries,
     prepareQuery,
-    runXTimes
+    runXTimes,
+    ensureNotFalsy
 } from '../../plugins/core/index.mjs';
 
 
@@ -1392,5 +1393,100 @@ describe(testContext + ' (implementation: ' + config.storage.name + ')', () => {
             await awaitRxStorageReplicationFirstInSync(replicationState);
             await cleanUp(replicationState, masterInstance);
         });
+        /**
+         * The upstream initial sync throttles the reads from the fork instance
+         * by awaiting the running persistToMaster() promises when the master
+         * is slower than the fork. When the replication got canceled while it
+         * waited, the fork instance might already be closed, so it must not
+         * be read from anymore.
+         * This happened with a fast RxStorage (rxdb-premium IndexedDB) during an
+         * interrupted schema migration: RxMigrationState.cancel() canceled the
+         * replication and closed the old storage, the upstream then called
+         * getChangedDocumentsSince() on the closed instance and the
+         * "instance is closed" error ended up as an unhandled rejection.
+         */
+        it('must not read from the fork instance after the replication was canceled', async () => {
+            const masterInstance = await createRxStorageInstance(0);
+            const forkInstance = await createRxStorageInstance(100);
+            const metaInstance = await createMetaInstance(forkInstance.schema);
+
+            /**
+             * Track reads on the fork instance that happen after it was closed.
+             * Return an empty result instead of throwing so that a regression
+             * shows up as a failed assertion and not as an unhandled rejection.
+             */
+            let forkClosed = false;
+            let forkReadsAfterClose = 0;
+            const queryBefore = forkInstance.query.bind(forkInstance);
+            forkInstance.query = (preparedQuery: any) => {
+                if (forkClosed) {
+                    forkReadsAfterClose = forkReadsAfterClose + 1;
+                    return Promise.resolve({ documents: [] });
+                }
+                return queryBefore(preparedQuery);
+            };
+            if (forkInstance.getChangedDocumentsSince) {
+                const getChangedDocumentsSinceBefore = forkInstance.getChangedDocumentsSince.bind(forkInstance);
+                forkInstance.getChangedDocumentsSince = (limit: number, checkpoint?: any) => {
+                    if (forkClosed) {
+                        forkReadsAfterClose = forkReadsAfterClose + 1;
+                        return Promise.resolve({ documents: [], checkpoint });
+                    }
+                    return getChangedDocumentsSinceBefore(limit, checkpoint);
+                };
+            }
+            const closeBefore = forkInstance.close.bind(forkInstance);
+            forkInstance.close = () => {
+                forkClosed = true;
+                return closeBefore();
+            };
+
+            const baseHandler = rxStorageInstanceToReplicationHandler(
+                masterInstance,
+                THROWING_CONFLICT_HANDLER,
+                randomToken(10)
+            );
+            let cancelPromise: Promise<void> | undefined;
+            const replicationState = replicateRxStorageInstance({
+                identifier: randomToken(10),
+                replicationHandler: {
+                    masterChangeStream$: baseHandler.masterChangeStream$,
+                    masterChangesSince: baseHandler.masterChangesSince,
+                    masterWrite: async (rows) => {
+                        // a slow master makes the upstream throttle its reads from the fork
+                        await wait(20);
+                        if (!cancelPromise) {
+                            /**
+                             * Cancel while a batch is pushed and close the fork instance,
+        
```

---

### Incident Patch 4: `d1418399` (2026-09-08)
**Commit Message**: FIX typos and a stale link reported by the rxdb.info site check (#9064)

Spelling and grammar:
- dev-mode error messages: DB6 had the docs URL glued to the sentence
  ("Read thishttps://..."), GDR18 said "exxeeded", MQ4 said "instanceof"
- reactivity.md: "distinguable" -> "distinguishable"
- slow-indexeddb.md: "empscripten" -> "Emscripten", "keyrange" -> "key range"
- nodejs-database.md: "filebased" -> "file-based"
- json-database.md: "persistet" -> "persisted", "nearly-instand" -> "nearly instant"
- localstorage-indexeddb-cookies-opfs-sqlite-wasm.md: "that is has" -> "that it has"
- rx-state.md and the localstorage article: "webworkers" -> "WebWorkers"
- "pageload"/"pageloads" -> "page load"/"page loads" across five pages

Broken link:
- javascript-vector-database.md pointed at
  github.com/xenova/transformers.js/issues/894#issuecomment-2323897485.
  The repo moved to the huggingface org and the comment anchor is gone,
  so link the issue itself under its current owner.


Claude-Session: https://claude.ai/code/session_01XrLHccTueiN5SVHE2bnF3x

Co-authored-by: Claude <noreply@anthropic.com>

**File**: `docs-src/docs/articles/javascript-vector-database.md` (modified, +1/-1)
```diff
@@ -596,7 +596,7 @@ await myDatabase.addCollections({
 
 For now our vector database works and we are good to go. However there are some things to consider for the future:
 
-- **WebGPU** is [not fully supported](https://caniuse.com/webgpu) yet. When this changes, creating embeddings in the browser have the potential to become faster. You can check if your current chrome supports WebGPU by opening `chrome://gpu/`. Notice that WebGPU has been reported to sometimes be [even slower](https://github.com/xenova/transformers.js/issues/894#issuecomment-2323897485) compared to WASM but likely it will be faster in the long term.
+- **WebGPU** is [not fully supported](https://caniuse.com/webgpu) yet. When this changes, creating embeddings in the browser have the potential to become faster. You can check if your current chrome supports WebGPU by opening `chrome://gpu/`. Notice that WebGPU has been reported to sometimes be [even slower](https://github.com/huggingface/transformers.js/issues/894) compared to WASM but likely it will be faster in the long term.
 - **Cross-Modal AI Models**: While progress is being made, AI models that can understand and integrate multiple modalities are still in development. For example you could query for an **image** together with a **text** prompt to get a more detailed output.
 - **Multi-Step queries**: In this article we only talked about having a single query as input and an ordered list of outputs. But there is big potential in chaining models or queries together where you take the results of one query and input them into a different model with different embeddings or outputs.
 
```

**File**: `docs-src/docs/articles/json-database.md` (modified, +2/-2)
```diff
@@ -27,7 +27,7 @@ Storing data as **JSON documents** in a **[NoSQL](./in-memory-nosql-database.md)
 ## Storage and Access Options for JSON Documents
 When incorporating JSON documents into your application, you have several storage and access options to consider:
 
-- **Local In-App Database with In-Memory Storage**: Ideal for lightweight applications or temporary data storage, this option keeps data in memory, ensuring fast read and write operations. However, data is not persistet beyond the current application session, making it suitable for temporary data storage. With RxDB, the [memory RxStorage](../rx-storage-memory.md) can be utilized to create an in-memory database.
+- **Local In-App Database with In-Memory Storage**: Ideal for lightweight applications or temporary data storage, this option keeps data in memory, ensuring fast read and write operations. However, data is not persisted beyond the current application session, making it suitable for temporary data storage. With RxDB, the [memory RxStorage](../rx-storage-memory.md) can be utilized to create an in-memory database.
 
 - **Local In-App Database with Persistent Storage**: Suitable for applications requiring data retention across sessions. Data is stored on the user's device or inside of the Node.js application, offering persistence between application sessions. It balances speed and data retention, making it versatile for various applications. With RxDB, a whole range of persistent storages is available. As example, for browser there is the [IndexedDB storage](../rx-storage-indexeddb.md). For server side applications, the [Node.js Filesystem storage](../rx-storage-filesystem-node.md) can be used. There are [many more storages](../rx-storage.md) for React-Native, Flutter, Capacitors.js and others.
 
@@ -87,7 +87,7 @@ Certainly! Let's delve deeper into the performance aspects of RxDB when it comes
 
 2. **Scalability:** As your application grows and your [JSON dataset](./json-based-database.md) expands, RxDB scales gracefully. Its performance remains consistent, enabling you to handle increasingly larger volumes of data without compromising on speed or responsiveness. This scalability is essential for applications that need to accommodate growing user bases and evolving data needs.
 
-3. **Reduced Latency:** RxDB's streamlined data access mechanisms significantly reduce latency when working with JSON data. Whether you're reading from the database, making updates, or synchronizing data between clients and servers, RxDB's optimized operations help minimize the delays often associated with data access. Observed queries are optimized with the [EventReduce algorithm](https://github.com/pubkey/event-reduce) to provide nearly-instand UI updates on data changes.
+3. **Reduced Latency:** RxDB's streamlined data access mechanisms significantly reduce latency when working with JSON data. Whether you're reading from the database, making updates, or synchronizing data between clients and servers, RxDB's optimized operations help minimize the delays often associated with data access. Observed queries are optimized with the [EventReduce algorithm](https://github.com/pubkey/event-reduce) to provide nearly instant UI updates on data changes.
 
 4. **RxStorage Layer**: Because RxDB allows you to swap out the storage layer. A storage with the most optimal performance can be chosen for each runtime while not touching other database code. Depending on the access patterns, you can pick exactly the storage that is best:
 
```

**File**: `docs-src/docs/articles/localstorage-indexeddb-cookies-opfs-sqlite-wasm.md` (modified, +3/-3)
```diff
@@ -304,7 +304,7 @@ Here we can notice a few things:
 
 ## Performance Conclusions
 
-- LocalStorage is really fast but remember that is has some downsides:
+- LocalStorage is really fast but remember that it has some downsides:
   - It blocks the main JavaScript process and therefore should not be used for big bulk operations.
   - Only Key-Value assignments are possible, you cannot use it efficiently when you need to do index based range queries on your data.
 - OPFS is way faster when used in the WebWorker with the `createSyncAccessHandle()` method compare to using it directly in the main thread.
@@ -315,10 +315,10 @@ Here we can notice a few things:
 ## Possible Improvements
 
 There is a wide range of possible improvements and performance hacks to speed up the operations.
-- For IndexedDB I have made a list of [performance hacks here](../slow-indexeddb.md). For example you can do sharding between multiple database and webworkers or use a custom index strategy.
+- For IndexedDB I have made a list of [performance hacks here](../slow-indexeddb.md). For example you can do sharding between multiple database and WebWorkers or use a custom index strategy.
 - OPFS is slow in writing one file per document. But you do not have to do that and instead you can store everything at a single file like a normal database would do. This improves performance dramatically like it was done with the RxDB [OPFS RxStorage](../rx-storage-opfs.md).
 - You can mix up the technologies to optimize for multiple scenarios at once. For example in RxDB there is the [localstorage meta optimizer](../rx-storage-localstorage-meta-optimizer.md) which stores initial metadata in localstorage and "normal" documents inside of IndexedDB. This improves the initial startup time while still having the documents stored in a way to query them efficiently.
-- There is the [memory-mapped](../rx-storage-memory-mapped.md) storage plugin in RxDB which maps data directly to memory. Using this in combination with a shared worker can improve pageloads and query time significantly.
+- There is the [memory-mapped](../rx-storage-memory-mapped.md) storage plugin in RxDB which maps data directly to memory. Using this in combination with a shared worker can improve page loads and query time significantly.
 - [Compressing](../key-compression.md) data before storing it might improve the performance for some of the storages.
 - Splitting work up between [multiple WebWorkers](../rx-storage-worker.md) via [sharding](../rx-storage-sharding.md) can improve performance by utilizing the whole capacity of your users device.
 
```

**File**: `docs-src/docs/downsides-of-offline-first.md` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ In the following I will point out the limitations you need to know before you de
 ## It only works with small datasets
 
 Making data available offline means it must be loaded from the server and then stored at the clients device.
-You need to load the full dataset on the first pageload and on every ongoing load you need to download the new changes to that set.
+You need to load the full dataset on the first page load and on every ongoing load you need to download the new changes to that set.
 While in theory you could download in infinite amount of data, in practice you have a limit how long the user can wait before having an up-to-date state.
 You want to display chat messages like Whatsapp? No problem. Syncing all the messages a user could write, can be done with a few HTTP requests.
 Want to make a tool that displays server logs? Good luck downloading terabytes of data to the client just to search for a single string. This will not work.
```

**File**: `docs-src/docs/nodejs-database.md` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ const result = await db.users.find({
 
 ```
 
-Another alternative storage is the [SQLite RxStorage](./rx-storage-sqlite.md) that stores the data inside of a SQLite filebased database. The SQLite storage is faster than FoundationDB and does not require to set up a cluster or anything because SQLite directly stores and reads the data inside of the filesystem. The downside of that is that it only scales vertically.
+Another alternative storage is the [SQLite RxStorage](./rx-storage-sqlite.md) that stores the data inside of a SQLite file-based database. The SQLite storage is faster than FoundationDB and does not require to set up a cluster or anything because SQLite directly stores and reads the data inside of the filesystem. The downside of that is that it only scales vertically.
 
 ```ts
 import { createRxDatabase } from 'rxdb';
```

---

### Incident Patch 5: `f24fa7e8` (2026-09-08)
**Commit Message**: FIX test-others-runtimes hanging until the job timeout (#9063)

* FIX test-others-runtimes hanging until the job timeout on deno 2.9

The deno bump from 2.6.5 to 2.9.5 broke the deno part of the
test-others-runtimes job in two ways, and the job was written so that
neither of them could ever be reported as a failure.

Running the tests through the `npm:mocha` entrypoint deadlocks on deno
2.9.5. All threads sit in a futex wait before a single line of test
output is written, so the process consumes no CPU and never exits. The
deno scripts now start mocha from `./node_modules/mocha/bin/mocha.js`,
the same way the bun scripts already do. With that, the dexie suite
(1258 tests), the denokv suite (1251 tests) and the memory suite (1345
tests) all pass on deno 2.9.5.

Deno.Kv.list() no longer accepts a non-integer limit and throws
`Limit must be a positive integer: received Infinity`. A query without
a limit set `skipPlusLimit` to Infinity and passed it straight to
Deno.Kv.list(), which failed internal-indexes.test.ts. An unlimited
query now passes no limit at all, which is what the range read did
before, because `result.length === skipPlusLimit` can never match
Infinity anyway.

Both step

**File**: `.github/workflows/main.yml` (modified, +24/-4)
```diff
@@ -1073,7 +1073,7 @@ jobs:
 
   test-others-runtimes:
     runs-on: ubuntu-22.04
-    timeout-minutes: 30
+    timeout-minutes: 45
     steps:
       - uses: actions/checkout@v7
       - name: Set node version
@@ -1121,14 +1121,34 @@ jobs:
       - uses: denoland/setup-deno@v2
         with:
           # https://github.com/denoland/deno/releases
-          deno-version: "2.9.5"
+          # deno 2.6.6 and newer deadlock while resolving the module graph of
+          # the test suite, so the run produces no output and never exits.
+          # 2.6.5 is the newest version that runs the tests, renovate is
+          # capped to it in renovate.json.
+          deno-version: "2.6.5"
       - name: run deno tests:dexie
+        timeout-minutes: 12
         run: |
           sudo npm i -g cross-env
           deno info
-          timeout 30m bash -c 'until npm run test:deno:dexie; do sleep 5; done'
+          for attempt in 1 2; do
+            echo "### deno dexie tests, attempt $attempt"
+            if timeout -k 30s 5m npm run test:deno:dexie; then
+              exit 0
+            fi
+          done
+          echo "deno dexie tests did not pass in 2 attempts"
+          exit 1
       - name: run deno tests:denokv
+        timeout-minutes: 22
         run: |
           sudo npm i -g cross-env
           deno info
-          timeout 30m bash -c 'until npm run test:deno:denokv; do sleep 5; done'
+          for attempt in 1 2; do
+            echo "### deno denokv tests, attempt $attempt"
+            if timeout -k 30s 10m npm run test:deno:denokv; then
+              exit 0
+            fi
+          done
+          echo "deno denokv tests did not pass in 2 attempts"
+          exit 1
```

**File**: `orga/changelog/fix-denokv-unlimited-query-limit.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- FIX DenoKV [RxStorage](https://rxdb.info/rx-storage.html): a query without a `limit` passed `Infinity` to `Deno.Kv.list()`, which throws `Limit must be a positive integer` since Deno 2.9. Unlimited queries no longer pass a limit at all.
```

**File**: `renovate.json` (modified, +9/-0)
```diff
@@ -27,6 +27,15 @@
     "config/appwrite/backup/docker-compose.yml",
     "examples/tauri/src-tauri/"
   ],
+  "packageRules": [
+    {
+      "description": "deno 2.6.6 and newer deadlock while resolving the module graph of the test suite, which makes the test-others-runtimes job hang. Keep deno at the newest version that runs the tests.",
+      "matchPackageNames": [
+        "deno"
+      ],
+      "allowedVersions": "<2.6.6"
+    }
+  ],
   "rebaseStalePrs": true,
   "prConcurrentLimit": 10,
   "prHourlyLimit": 2,
```

**File**: `src/plugins/storage-denokv/denokv-query.ts` (modified, +9/-1)
```diff
@@ -108,7 +108,15 @@ export async function queryDenoKV<RxDocType>(
         end: [instance.keySpace, indexMeta.indexId, upperBoundString]
     }, {
         consistency: instance.settings.consistencyLevel,
-        limit: (!mustManuallyResort && queryPlan.selectorSatisfiedByIndex) ? skipPlusLimit : undefined,
+        /**
+         * Deno.Kv.list() only accepts a positive integer as limit,
+         * an unlimited query must not pass a limit at all.
+         */
+        limit: (
+            !mustManuallyResort &&
+            queryPlan.selectorSatisfiedByIndex &&
+            Number.isFinite(skipPlusLimit)
+        ) ? skipPlusLimit : undefined,
         batchSize: instance.settings.batchSize
     });
 
```

---

### Incident Patch 6: `3323fd14` (2026-09-07)
**Commit Message**: FIX document not found after cleanup() and re-insert of the same primary key (#9059)

When the cleanup purges the tombstone of a deleted document, a write to the
same primary key starts a new revision chain at height 1. The out-of-order
protection of the DocumentCache compared only revision heights, so it treated
that state as older than the cached tombstone and kept the tombstone as the
latest known state. Because findOne(primaryKey) and the primary key fast-path
of find() read through the cache, they returned null for a document that was
just inserted, while find() without a selector and count() were correct.

The cached latest state is now also allowed to be overwritten when the cached
state is deleted and the incoming state is not deleted and was written later.

Fixes https://github.com/pubkey/rxdb/pull/8948


Claude-Session: https://claude.ai/code/session_01VGzhxpqmBaCeNkqfh3tZj5

Co-authored-by: Claude <noreply@anthropic.com>

**File**: `orga/changelog/fix-doc-cache-stale-tombstone-after-cleanup.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- FIX `DocumentCache`: a document that is re-inserted after the cleanup purged its tombstone was no longer found by `findOne()` and by primary key queries, because the new revision chain starts at height `1` and the out-of-order protection kept the cached tombstone. [#8948](https://github.com/pubkey/rxdb/pull/8948)
```

**File**: `src/doc-cache.ts` (modified, +26/-1)
```diff
@@ -136,7 +136,7 @@ export class DocumentCache<RxDocType, OrmMethods> {
                         const currentLatest = cacheItem[1];
                         if (
                             !currentLatest ||
-                            !isOlderDocumentState(documentData._rev, currentLatest._rev)
+                            isNewerDocumentState(documentData, currentLatest)
                         ) {
                             cacheItem[1] = documentData;
                         }
@@ -202,6 +202,31 @@ export class DocumentCache<RxDocType, OrmMethods> {
     }
 }
 
+/**
+ * Determines if the given document state has to overwrite
+ * the currently cached latest state of that document.
+ */
+function isNewerDocumentState<RxDocType>(
+    checkState: RxDocumentData<RxDocType>,
+    currentLatest: RxDocumentData<RxDocType>
+): boolean {
+    /**
+     * When the cleanup has purged the tombstone of a deleted document,
+     * a write to the same primary key starts a new revision chain at height 1.
+     * That state has a lower revision height than the cached tombstone
+     * while still being the newer state, so here we compare by the write time
+     * instead of by the revision.
+     */
+    if (
+        currentLatest._deleted &&
+        !checkState._deleted &&
+        checkState._meta.lwt > currentLatest._meta.lwt
+    ) {
+        return true;
+    }
+    return !isOlderDocumentState(checkState._rev, currentLatest._rev);
+}
+
 /**
  * Determines if the document state of checkRev is older than the one of currentRev.
  * Compares by revision height first and falls back to a deterministic
```

**File**: `test/unit/cleanup.test.ts` (modified, +35/-0)
```diff
@@ -205,6 +205,41 @@ describe('cleanup.test.js', () => {
         });
     });
     describe('issues', () => {
+        it('#8948 must find a document that was re-inserted after the cleanup purged its tombstone', async () => {
+            const db = await createRxDatabase({
+                name: randomToken(10),
+                storage: config.storage.getStorage(),
+                eventReduce: true
+            });
+            const cols = await db.addCollections({
+                humans: {
+                    schema: schemas.human
+                }
+            });
+            const collection: RxCollection<HumanDocumentType> = cols.humans;
+
+            const docData = schemaObjects.humanData('foobar');
+            await collection.insert(docData);
+            const doc = await collection.findOne(docData.passportId).exec(true);
+            await doc.remove();
+            await collection.cleanup(0);
+
+            // the cleanup purged the tombstone, so this write starts a new revision chain
+            await collection.insert(docData);
+
+            const byId = await collection.findOne(docData.passportId).exec();
+            assert.ok(byId, 'findOne() by primary key must return the re-inserted document');
+
+            const bySelector = await collection.find({
+                selector: { passportId: docData.passportId }
+            }).exec();
+            assert.strictEqual(bySelector.length, 1);
+
+            const latest = collection._docCache.getLatestDocumentDataIfExists(docData.passportId);
+            assert.strictEqual(ensureNotFalsy(latest)._deleted, false);
+
+            await db.close();
+        });
         it('minimumDeletedTime not respected', async () => {
             const dbName = 'test-cleanup-' + Date.now() + '-' + randomToken(10);
             try {
```

**File**: `test/unit/doc-cache.test.ts` (modified, +49/-0)
```diff
@@ -240,6 +240,55 @@ describe('doc-cache.test.ts', () => {
                 assert.strictEqual(latest.name, 'Bob');
                 assert.strictEqual(latest._rev, EXAMPLE_REVISION_2);
             });
+            it('should accept a re-insert that restarts the revision chain after a cleanup', () => {
+                /**
+                 * When the cleanup purges the tombstone of a deleted document,
+                 * a re-insert of the same primary key starts a new revision chain
+                 * at height 1. The out-of-order protection must not treat that
+                 * state as older than the cached tombstone.
+                 * @link https://github.com/pubkey/rxdb/pull/8948
+                 */
+                const { cache, changes$ } = createDocumentCache();
+                const tombstone = createFakeDocData('doc1', EXAMPLE_REVISION_2, 2, 'Alice', 30);
+                tombstone._deleted = true;
+                cache.getCachedRxDocuments([tombstone]);
+
+                const reInserted = createFakeDocData('doc1', EXAMPLE_REVISION_1, 3, 'Bob', 31);
+                changes$.next([{
+                    documentId: 'doc1',
+                    documentData: reInserted,
+                    previousDocumentData: undefined,
+                    operation: 'INSERT',
+                    isLocal: false
+                } as any]);
+
+                cache.processTasks();
+                const latest = cache.getLatestDocumentData('doc1');
+                assert.strictEqual(latest._deleted, false);
+                assert.strictEqual(latest.name, 'Bob');
+                assert.strictEqual(latest._rev, EXAMPLE_REVISION_1);
+            });
+            it('should not resurrect a deleted document by an older change event', () => {
+                const { cache, changes$ } = createDocumentCache();
+                const tombstone = createFakeDocData('doc1', EXAMPLE_REVISION_2, 2, 'Alice', 30);
+                tombstone._deleted = true;
+                cache.getCachedRxDocuments([tombstone]);
+
+                // the insert happened before the delete, so it must not win
+                const staleInsert = createFakeDocData('doc1', EXAMPLE_REVISION_1, 1, 'Bob', 31);
+                changes$.next([{
+                    documentId: 'doc1',
+                    documentData: staleInsert,
+                    previousDocumentData: undefined,
+                    operation: 'INSERT',
+                    isLocal: false
+                } as any]);
+
+                cache.processTasks();
+                const latest = cache.getLatestDocumentData('doc1');
+                assert.strictEqual(latest._deleted, true);
+                assert.strictEqual(latest._rev, EXAMPLE_REVISION_2);
+            });
             it('should ignore change events for documents not in cache', () => {
                 const { cache, changes$ } = createDocumentCache();
                 const docData = createFakeDocData('unknown', EXAMPLE_REVISION_1);
```

---

### Incident Patch 7: `8f8e3a74` (2026-09-03)
**Commit Message**: fix(react): useRxDocument initial loading state is true when collection and key are provided (#8999)

* fix(react): useRxDocument initial loading state is true when collection and key are provided

* Refactor loading state initialization to use Boolean

* FIX ssr test

---------

Co-authored-by: Daniel Meyer <8926560+pubkey@users.noreply.github.com>

**File**: `orga/changelog/fix-use-rx-document-initial-loading-state.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- FIX react plugin `useRxDocument` starting with `loading: false` instead of `loading: true` when valid collection and primaryKey are provided. This caused a false "not found" flash on the first render before the subscription resolved. Added equivalent tests to the existing react-hooks test suite. Fixes #8965.
```

**File**: `src/plugins/react/hooks/use-rx-document.ts` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ export function useRxDocument<
     primaryKey: string | undefined
 ): UseRxDocumentResult<RxDocumentType, OrmMethods> {
     const [result, setResult] = useState<RxDocument<RxDocumentType, OrmMethods> | null>(null);
-    const [loading, setLoading] = useState(false);
+    const [loading, setLoading] = useState(Boolean(collection) && primaryKey !== undefined);
     const [error, setError] = useState<string | null>(null);
 
     useEffect(() => {
```

**File**: `test/react-ssr.test.ts` (modified, +2/-2)
```diff
@@ -204,7 +204,7 @@ describe('react-ssr.test.ts', () => {
         function UseRxDocumentComponent() {
             /**
              * In SSR, useEffect does not run so the subscription never starts.
-             * The hook returns its initial state: loading=false, result=null.
+             * With valid collection and primaryKey, initial loading state is true.
              */
             const { result, loading, error } = useRxDocument(collection, 'some-id');
             return React.createElement('div', null,
@@ -220,7 +220,7 @@ describe('react-ssr.test.ts', () => {
             )
         );
 
-        assert.ok(html.includes('loading:false'));
+        assert.ok(html.includes('loading:true'));
         assert.ok(html.includes('result:null'));
         assert.ok(html.includes('error:null'));
 
```

**File**: `test/react/react-hooks.test.tsx` (modified, +86/-0)
```diff
@@ -23,6 +23,7 @@ import { wrappedValidateAjvStorage } from '../../plugins/validate-ajv/index.mjs'
 import {
     RxDatabaseProvider,
     useRxDatabase,
+    useRxDocument,
     useRxQuery,
     useLiveRxQuery,
 } from '../../plugins/react/index.mjs';
@@ -282,4 +283,89 @@ describe('react-hooks.test.tsx', () => {
             await db.close();
         });
     });
+
+    describe('useRxDocument', () => {
+        it('should start with loading state as true when collection and primaryKey are provided', async () => {
+            const db = await createDatabase();
+            const collection: RxCollection<SimpleHumanDocumentType> = db.collections.humans;
+            const doc = schemaObjects.simpleHumanAge();
+            await collection.insert(doc);
+
+            const { result } = renderHook(
+                () => useRxDocument(collection, doc.passportId),
+                { wrapper: createWrapper(db) }
+            );
+
+            /**
+             * The initial loading state must be true because
+             * the subscription has not resolved yet.
+             * @link https://github.com/pubkey/rxdb/issues/8965
+             */
+            assert.strictEqual(result.current.loading, true);
+
+            await db.close();
+        });
+
+        it('should start with loading state as false when collection is null', () => {
+            const { result } = renderHook(
+                () => useRxDocument(null as any, 'some-id')
+            );
+            assert.strictEqual(result.current.loading, false);
+            assert.strictEqual(result.current.result, null);
+        });
+
+        it('should start with loading state as false when primaryKey is undefined', async () => {
+            const db = await createDatabase();
+            const collection: RxCollection<SimpleHumanDocumentType> = db.collections.humans;
+
+            const { result } = renderHook(
+                () => useRxDocument(collection, undefined),
+                { wrapper: createWrapper(db) }
+            );
+            assert.strictEqual(result.current.loading, false);
+            assert.strictEqual(result.current.result, null);
+
+            await db.close();
+        });
+
+        it('should return the document and set loading to false after subscription resolves', async () => {
+            const db = await createDatabase();
+            const collection: RxCollection<SimpleHumanDocumentType> = db.collections.humans;
+            const doc = schemaObjects.simpleHumanAge();
+            await collection.insert(doc);
+
+            const { result } = renderHook(
+                () => useRxDocument(collection, doc.passportId),
+                { wrapper: createWrapper(db) }
+            );
+
+            await waitFor(() => {
+                assert.strictEqual(result.current.loading, false);
+            });
+
+            assert.strictEqual(result.current.result?.passportId, doc.passportId);
+            assert.strictEqual(result.current.error, null);
+
+            await db.close();
+        });
+
+        it('should return null result with loading false when document does not exist', async () => {
+            const db = await createDatabase();
+            const collection: RxCollection<SimpleHumanDocumentType> = db.collections.humans;
+
+            const { result } = renderHook(
+                () => useRxDocument(collection, 'non-existent-id'),
+                { wrapper: createWrapper(db) }
+            );
+
+            await waitFor(() => {
+                assert.strictEqual(result.current.loading, false);
+            });
+
+            assert.strictEqual(result.current.result, null);
+            assert.strictEqual(result.current.error, null);
+
+            await db.close();
+        });
+    });
 });
```

---

### Incident Patch 8: `e03e921d` (2026-09-03)
**Commit Message**: FIX #9026 issue: a rejected bulkWrite permanently wedges the incremental-write queue (#9058)

**File**: `orga/changelog/fix-incremental-write-queue-error-wedging.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- FIX `IncrementalWriteQueue`: ensure storage `bulkWrite` errors are properly caught and reset queue runner state so the queue does not wedge on failure.
```

**File**: `src/incremental-write.ts` (modified, +90/-77)
```diff
@@ -94,87 +94,100 @@ export class IncrementalWriteQueue<RxDocType> {
          */
         const itemsById = this.queueByDocId;
         this.queueByDocId = new Map();
-        await Promise.all(
-            Array.from(itemsById.entries())
-                .map(async ([_docId, items]) => {
-                    const oldData = findNewestOfDocumentStates(
-                        items.map(i => i.lastKnownDocumentState)
-                    );
-                    let newData = oldData;
-                    for (const item of items) {
+        try {
+            await Promise.all(
+                Array.from(itemsById.entries())
+                    .map(async ([_docId, items]) => {
+                        const oldData = findNewestOfDocumentStates(
+                            items.map(i => i.lastKnownDocumentState)
+                        );
+                        let newData = oldData;
+                        for (const item of items) {
+                            try {
+                                newData = await item.modifier(
+                                    /**
+                                     * We have to clone() each time because the modifier
+                                     * might throw while it already changed some properties
+                                     * of the document.
+                                     */
+                                    clone(newData)
+                                ) as any;
+                            } catch (err: any) {
+                                item.reject(err);
+                                item.reject = () => { };
+                                item.resolve = () => { };
+                            }
+                        }
+
                         try {
-                            newData = await item.modifier(
-                                /**
-                                 * We have to clone() each time because the modifier
-                                 * might throw while it already changed some properties
-                                 * of the document.
-                                 */
-                                clone(newData)
-                            ) as any;
+                            await this.preWrite(newData, oldData);
                         } catch (err: any) {
-                            item.reject(err);
-                            item.reject = () => { };
-                            item.resolve = () => { };
+                            /**
+                             * If the before-hooks fail,
+                             * we reject all of the writes because it is
+                             * not possible to determine which one is to blame.
+                             */
+                            items.forEach(item => item.reject(err));
+                            return;
                         }
-                    }
-
-                    try {
-                        await this.preWrite(newData, oldData);
-                    } catch (err: any) {
-                        /**
-                         * If the before-hooks fail,
-                         * we reject all of the writes because it is
-                         * not possible to determine which one is to blame.
-                         */
-                        items.forEach(item => item.reject(err));
-                        return;
-                    }
-                    writeRows.push({
-                        previous: oldData,
-                        document: newData
-                    });
-                })
-        );
-        const writeResult: RxStorageBulkWriteResponse<RxDocType> = writeRows.length > 0 ?
-            await this.storageInstance.bulkWrite(writeRows, 'incremental-write') :
-            { error: [] };
-
-        // process success
-        await Promise.all(
-            getWrittenDocumentsFromBulkWriteResponse(this.primaryPath, writeRows, writeResult).map(re
```

**File**: `test/unit/rx-collection.test.ts` (modified, +32/-0)
```diff
@@ -2175,6 +2175,38 @@ describe('rx-collection.test.ts', () => {
 
                     db.close();
                 });
+                it('#9026 issue: a rejected bulkWrite permanently wedges the incremental-write queue', async () => {
+                    const collection = await humansCollection.create(1);
+                    const myDocument = await collection.findOne().exec(true);
+
+                    const storageInstance = collection.storageInstance;
+                    const realBulkWrite = storageInstance.bulkWrite.bind(storageInstance);
+                    storageInstance.bulkWrite = (rows: any, context: string) => {
+                        if (context === 'incremental-write' && rows.some((row: any) => row.document.age === 57)) {
+                            return Promise.reject(new Error('simulated transient storage failure'));
+                        }
+                        return realBulkWrite(rows, context);
+                    };
+
+                    let firstError: any;
+                    const first = myDocument.incrementalPatch({ age: 57 }).then(
+                        () => 'settled 0',
+                        (err) => {
+                            firstError = err;
+                        }
+                    );
+                    const second = myDocument.incrementalPatch({ age: 58 }).then(
+                        () => 'settled 1',
+                        () => { }
+                    );
+                    const outcome = await Promise.race([
+                        Promise.all([first, second]).then(() => 'settled'),
+                        AsyncTestUtil.wait(2000).then(() => 'still pending after 2 seconds')
+                    ]);
+                    assert.strictEqual(outcome, 'settled');
+                    assert.strictEqual(firstError.message, 'simulated transient storage failure');
+                    collection.database.close();
+                });
             });
         });
         describe('.remove()', () => {
```

#### Recent Merged Pull Requests:
- **PR #9160** (closed): Improve replication diagram animations and options (@pubkey)
- **PR #9157** (2026-09-30): Update dependency electron to v44.4.4 (@renovate[bot])
- **PR #9156** (2026-09-30): Update dependency vite to v8.3.0 (@renovate[bot])
- **PR #9155** (2026-09-29): Update dependency @supabase/supabase-js to v2.117.0 (@renovate[bot])
- **PR #9154** (2026-09-30): ADD Nostr signaling for the WebRTC replication (@pubkey)
- **PR #9153** (closed): Improve performance of sortObject() (@pubkey)
- **PR #9152** (2026-09-29): Recover replication after failed start (@Copilot)
- **PR #9151** (2026-09-29): Update dependency react-native-gesture-handler to v3.3.0 (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
