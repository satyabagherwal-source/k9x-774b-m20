# Forensic Learning Record (Deep Inspection): ChromeDevTools/chrome-devtools-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/chromedevtools-chrome-devtools-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T03:08:46.540Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ChromeDevTools/chrome-devtools-mcp`
- **Description**: Chrome DevTools for coding agents
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 52763 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `eslint.config.js`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import js from '@eslint/js';
import stylisticPlugin from '@stylistic/eslint-plugin';
import {defineConfig, globalIgnores} from 'eslint/config';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import localPlugin from './scripts/eslint_rules/local-plugin.js';

const RESTRICTED_IMPORT_DEVTOOLS_MCP = {
  regex: '.*devtools-frontend/(?!mcp/mcp.js$).*',
  message:
    'Import only the devtools-frontend code exported via devtools-frontend/mcp/mcp.js',
};
const RESTRICTED_IMPORT_MCP_CLIENT = {
  group: ['@modelcontextprotocol/client', '@modelcontextprotocol/client/*'],
  message:
    'Do not import @modelcontextprotocol/client in src/; it is only for tests and scripts.',
};

export default defineConfig([
  globalIgnores([
    '**/node_modules',
    '**/build/',
    'third_party/devtools-frontend/**',
    'tests/tools/fixtures/',
    'tests/fixtures/',
    'src/third_party/lighthouse-devtools-mcp-bundle.js',
  ]),
  importPlugin.flatConfigs.typescript,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',

      globals: {
        ...globals.node,
      },

      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'prettier.config.js',
            'puppeteer.config.js',
            'eslint.config.js',
            'rollup.config.js',
          ],
        },
      },

      parser: tseslint.parser,
    },

    plugins: {
      js,
      '@local': localPlugin,
      '@typescript-eslint': tseslint.plugin,
      '@stylistic': stylisticPlugin,
    },

    settings: {
      'import/resolver': {
        typescript: true,
      },
    },

    extends: ['js/recommended'],
  },
  tseslint.configs.recommended,
  tseslint.configs.stylistic,
  {
    name: 'TypeScript rules',
    rules: {
      '@local/check-license': 'error',
      curly: ['error', 'all'],

      // ESLint 10 newly recommends these rules. Disable them explicitly so this
      // dependency upgrade does not require unrelated source changes.
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off',

      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': [
        'error',
        {
          ignoreRestArgs: true,
        },
      ],
      // This optimizes the dependency tracking for type-only files.
      '@typescript-eslint/consistent-type-imports': 'error',
      // So type-only exports get elided.
      '@typescript-eslint/consistent-type-exports': 'error',
      // Prefer interfaces over types for shape like.
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/array-type': [
        'error',
        {
          default: 'array-simple',
        },
      ],
      '@typescript-eslint/no-floating-promises': 'error',

      // Incompatible with ESLint 10
      // 'import/order': [
      //   'error',
      //   {
      //     'newlines-between': 'always',

      //     alphabetize: {
      //       order: 'asc',
      //       caseInsensitive: true,
      //     },
      //   },
      // ],

      'import/no-cycle': [
        'error',
        {
          maxDepth: Infinity,
        },
      ],

      'import/enforce-node-protocol-usage': ['error', 'always'],

      '@stylistic/function-call-spacing': 'error',
      '@stylistic/semi': 'error',

      'no-restricted-imports': [
        'error',
        {
          patterns: [RESTRICTED_IMPORT_DEVTOOLS_MCP],
        },
      ],
    },
  },
  {
    name: 'Source files',
    files: ['src/**/*.ts'],
    rules: {
      '@local/no-direct-third-party-imports': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            RESTRICTED_IMPORT_DEVTOOLS_MCP,
            RESTRICTED_IMPORT_MCP_CLIENT,
          ],
        },
      ],
    },
  },
  {
    name: 'Tools definitions',
    files: ['src/tools/**/*.ts'],
    rules: {
      '@local/enforce-zod-schema': 'error',
      '@local/require-parsed-arguments': 'error',
    },
  },
  {
    name: 'Tests',
    files: ['**/*.test.ts'],
    rules: {
      // With the Node.js test runner, `describe` and `it` are technically
      // promises, but we don't need to await them.
      '@typescript-eslint/no-floating-promises': 'off',
      '@local/enforce-using': 'error',
    },
  },
]);

```

### Core Architecture Module: `prettier.config.js`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @type {import('prettier').Config}
 */
export default {
  bracketSpacing: false,
  singleQuote: true,
  trailingComma: 'all',
  arrowParens: 'avoid',
  singleAttributePerLine: true,
  htmlWhitespaceSensitivity: 'strict',
  endOfLine: 'lf',
};

```

### Core Architecture Module: `puppeteer.config.js`
```
/**
 * @license
 * Copyright 2025 Google Inc.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @type {import("puppeteer").Configuration}
 */
export default {
  chrome: {
    skipDownload: false,
  },
  ['chrome-headless-shell']: {
    skipDownload: true,
  },
  firefox: {
    skipDownload: true,
  },
};

```

### Core Architecture Module: `rollup.config.js`
```
/**
 * Copyright 2021 Google LLC.
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview taken from {@link https://github.com/GoogleChromeLabs/chromium-bidi/blob/main/rollup.config.mjs | chromium-bidi}
 * and modified to specific requirement.
 */

import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import {nodeResolve} from '@rollup/plugin-node-resolve';
import cleanup from 'rollup-plugin-cleanup';
import license from 'rollup-plugin-license';

const isProduction = process.env.NODE_ENV === 'production';

const allowedLicenses = [
  'MIT',
  'Apache 2.0',
  'Apache-2.0',
  'BSD-3-Clause',
  'BSD-2-Clause',
  'ISC',
  '0BSD',
];

const thirdPartyDir = './build/src/third_party';

const {devDependencies = {}} = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'),
);

// special case for puppeteer, from which we only bundle puppeteer-core
devDependencies['puppeteer-core'] = devDependencies['puppeteer'];

const packageLock = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'package-lock.json'), 'utf-8'),
);

function getResolvedVersion(packageName) {
  const packageEntry = packageLock.packages?.[`node_modules/${packageName}`];
  return packageEntry?.version || null;
}

function getDevToolsFrontendCommit() {
  try {
    return execSync('git rev-parse HEAD', {
      cwd: path.join(process.cwd(), 'third_party/devtools-frontend'),
      encoding: 'utf-8',
    }).trim();
  } catch {
    return null;
  }
}

const aggregatedStats = {
  bundlesProcessed: 0,
  totalBundles: 0,
  bundledPackages: new Set(),
};

const projectNodeModulesPath =
  path.join(process.cwd(), 'node_modules') + path.sep;

function getPackageName(modulePath) {
  // Handle rollup's virtual module paths (paths starting with 0x00)
  const absolutePathStart = modulePath.indexOf(projectNodeModulesPath);
  if (absolutePathStart < 0) {
    return null;
  }

  const relativePath = modulePath.slice(
    projectNodeModulesPath.length + absolutePathStart,
  );
  const segments = relativePath.split(path.sep);

  // handle scoped packages
  if (segments[0].startsWith('@') && segments[1]) {
    return `${segments[0]}/${segments[1]}`;
  }
  return segments[0];
}

/**
 * @returns {import('rollup').Plugin}
 */
function listBundledDeps() {
  aggregatedStats.totalBundles++;
  return {
    name: 'gather-bundled-dependencies',
    generateBundle(options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk' && chunk.modules) {
          // chunk.modules is an object where keys are the absolute file paths
          Object.keys(chunk.modules).forEach(modulePath => {
            const packageName = getPackageName(modulePath);
            if (packageName) {
              aggregatedStats.bundledPackages.add(packageName);
            }
          });
        }
      }
      aggregatedStats.bundlesProcessed++;

      // Only write the file when the last bundle is finished
      if (aggregatedStats.bundlesProcessed === aggregatedStats.totalBundles) {
        const outputPath = path.join(thirdPartyDir, 'bundled-packages.json');

        const bundledDevDeps = {};
        for (const [name, versionRange] of Object.entries(devDependencies)) {
          if (
            aggregatedStats.bundledPackages.has(name) ||
            name === 'lighthouse'
          ) {
            const resolvedVersion = getResolvedVersion(name);
            bundledDevDeps[name] = resolvedVersion || versionRange;
          }
        }

        const devtoolsFrontendCommit = getDevToolsFrontendCommit();
        if (devtoolsFrontendCommit) {
          bundledDevDeps[
            'https://github.com/ChromeDevTools/devtools-frontend'
          ] = devtoolsFrontendCommit;
        }

        fs.writeFileSync(outputPath, JSON.stringify(bundledDevDeps, null, 2));
      }
    },
  };
}

const seenDependencies = new Map();

/**
 * @param {string} wrapperIndexName
 * @param {import('rollup').OutputOptions} [extraOutputOptions={}]
 * @param {import('rollup').ExternalOption} [external=[]]
 * @returns {import('rollup').RollupOptions}
 */
const bundleDependency = (
  wrapperIndexName,
  extraOutputOptions = {},
  external = [],
) => ({
  input: path.join(thirdPartyDir, wrapperIndexName),
  output: {
    ...extraOutputOptions,
    file: path.join(thirdPartyDir, wrapperIndexName),
    sourcemap: !isProduction,
    format: 'esm',
  },
  plugins: [
    cleanup({
      // Keep license comments. Other comments are removed due to
      // http://b/390559299 and
      // https://github.com/microsoft/TypeScript/issues/60811.
      comments: [/Copyright/i],
    }),
    license({
      thirdParty: {
        allow: {
          test: dependency => {
            return allowedLicenses.includes(dependency.license);
          },
          failOnUnlicensed: true,
          failOnViolation: true,
        },
        output: {
          file: path.join(thirdPartyDir, 'THIRD_PARTY_NOTICES'),
          template(dependencies) {
            for (const dependency of dependencies) {
              const key = `${dependency.name}:${dependency.version}`;
              seenDependencies.set(key, dependency);
            }

            const stringifiedDependencies = Array.from(
              seenDependencies.values(),
            ).map(dependency => {
              let arr = [];
              arr.push(`Name: ${dependency.name ?? 'N/A'}`);
              let url = dependency.homepage ?? dependency.repository;
              if (url !== null && typeof url !== 'string') {
                url = url.url;
              }
              arr.push(`URL: ${url ?? 'N/A'}`);
              arr.push(`Version: ${dependency.version ?? 'N/A'}`);
              arr.push(`License: ${dependency.license ?? 'N/A'}`);
              if (dependency.licenseText !== null) {
                arr.push('');
                arr.push(dependency.licenseText.replaceAll('\r', ''));
              }
              return arr.join('\n');
            });

            // Manual license handling for devtools-frontend third_party
            const tsConfig = JSON.parse(
              fs.readFileSync(
                path.join(process.cwd(), 'tsconfig.json'),
                'utf-8',
              ),
            );
            const thirdPartyDirectories = tsConfig.include.filter(location =>
              location.includes(
                'third_party/devtools-frontend/front_end/third_party',
              ),
            );

            const manualLicenses = [];
            // Add devtools-frontend main license
            const cdtfLicensePath = path.join(
              process.cwd(),
              'third_party/devtools-frontend/LICENSE',
            );
            if (fs.existsSync(cdtfLicensePath)) {
              const devtoolsFrontendCommit = getDevToolsFrontendCommit();
              const licenseLines = [
                'Name: devtools-frontend',
                'URL: https://github.com/ChromeDevTools/devtools-frontend',
              ];
              if (devtoolsFrontendCommit) {
                licenseLines.push(`Version: ${devtoolsFrontendCommit}`);
              }
              licenseLines.push(
                'License: Apache-2.0',
                '',
                fs.readFileSync(cdtfLicensePath, 'utf-8'),
              );
              manualLicenses.pus
```

### Core Architecture Module: `scripts/append-lighthouse-notices.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const TARGET_DIR = path.join(ROOT_DIR, 'build/src/third_party');
const SOURCE_DIR = path.join(ROOT_DIR, 'src/third_party');

function main() {
  const lighthouseNotices = fs.readFileSync(
    path.join(SOURCE_DIR, 'LIGHTHOUSE_MCP_BUNDLE_THIRD_PARTY_NOTICES'),
    'utf8',
  );
  const bundledNotices = fs.readFileSync(
    path.join(TARGET_DIR, 'THIRD_PARTY_NOTICES'),
    'utf8',
  );
  fs.writeFileSync(
    path.join(TARGET_DIR, 'THIRD_PARTY_NOTICES'),
    bundledNotices +
      '\n\n-------------------- DEPENDENCY DIVIDER --------------------\n\n' +
      lighthouseNotices,
  );
  console.log('Done.');
}

main();

```

### Core Architecture Module: `scripts/clean-submodules.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {rmSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';

const projectRoot = process.cwd();

console.log('Cleaning submodules...');

const directoriesToRemove = [
  resolve(projectRoot, 'third_party', 'devtools-frontend'),
  resolve(projectRoot, '.git', 'modules', 'devtools-frontend'),
];

for (const dir of directoriesToRemove) {
  try {
    if (existsSync(dir)) {
      rmSync(dir, {recursive: true, force: true});
      console.log(`Removed ${dir}`);
    }
  } catch (error) {
    console.error(`Failed to remove ${dir}:`, error);
  }
}

console.log(
  'Submodules cleaned. You can now run `npm run prepare` to re-initialize them.',
);

```

### Core Architecture Module: `scripts/count_tokens.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {readFileSync} from 'node:fs';
import {parseArgs} from 'node:util';

import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

const {values, positionals} = parseArgs({
  options: {
    model: {
      type: 'string',
      default: 'gemini-2.5-flash',
    },
    file: {
      type: 'string',
      short: 'f',
    },
  },
  allowPositionals: true,
});

let contents = positionals[0];

if (values.file) {
  contents = readFileSync(values.file, 'utf8');
}

if (!contents) {
  console.error('Usage: npm run count-tokens -- [-f <file>] [<text>]');
  process.exit(1);
}

const response = await ai.models.countTokens({
  model: values.model,
  contents,
});
console.log(`Input: ${values.file || positionals[0]}`);
console.log(`Tokens: ${response.totalTokens}`);

```

### Core Architecture Module: `scripts/eslint_rules/check-license-rule.js`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const currentYear = new Date().getFullYear();
const licenseHeader = `
/**
 * @license
 * Copyright ${currentYear} Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
`;

export default {
  name: 'check-license',
  meta: {
    type: 'layout',
    docs: {
      description: 'Validate existence of license header',
    },
    fixable: 'code',
    schema: [],
    messages: {
      licenseRule: 'Add license header.',
      emptyLine: 'Add empty line after license header.',
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode;
    const comments = sourceCode.getAllComments();
    let insertAfter = [0, 0];
    let header = null;
    // Check only the first 2 comments
    for (let index = 0; index < 2; index++) {
      const comment = comments[index];
      if (!comment) {
        break;
      }
      // Shebang comments should be at the top
      if (
        comment.type === 'Shebang' ||
        (comment.type === 'Line' && comment.value.startsWith('#!'))
      ) {
        insertAfter = comment.range;
        continue;
      }
      if (comment.type === 'Block') {
        header = comment;
        break;
      }
    }

    return {
      Program(node) {
        if (context.filename.endsWith('.json')) {
          return;
        }

        if (
          header &&
          (header.value.includes('@license') ||
            header.value.includes('License') ||
            header.value.includes('Copyright'))
        ) {
          const nextToken = sourceCode.getTokenAfter(header, {
            includeComments: true,
          });
          if (
            nextToken &&
            nextToken.loc.start.line === header.loc.end.line + 1
          ) {
            context.report({
              node: node,
              loc: header.loc,
              messageId: 'emptyLine',
              fix(fixer) {
                return fixer.insertTextAfter(header, '\n');
              },
            });
          }
          return;
        }

        // Add header license
        if (!header || !header.value.includes('@license')) {
          context.report({
            node: node,
            messageId: 'licenseRule',
            fix(fixer) {
              return fixer.insertTextAfterRange(insertAfter, licenseHeader);
            },
          });
        }
      },
    };
  },
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #322** (2025-10-13): **Chrome.exe proble,**
  *Symptoms*: ### Description of the bug  . Working on it for the past two days and it is not working with cursor, the new version will not integrate and the previous 0.1.0 works but then the chrome.exe is the problem...  My chrome is in: \AppData\Local\Google\Chrome\Application and also in : Program Files\Google\Chrome\Application  but still the "Unknown SPAWN" error when cursor calls the tools  ### Reproduction  _No response_  ### Expectation  _No response_  ### MCP configuration  _No response_  ### Node version  _No response_  ### Chrome version  _No response_  ### Coding agent version  _No response_  ### Model version  _No response_  ### Chat log  _No response_  ### Operating system  None
  **Post-Mortem & Fix Analysis**:
  > Can you please try setting the following environment variable?   ``` {   "mcpServers": {     "chrome-devtools": {       "env": {         "PROGRAMFILES": "C:\\Program Files"        },       "command": "npx",       "args": ["-y", "chrome-devtools-mcp@latest"]     }   } }  ```
  > <img width="352" height="186" alt="Image" src="https://github.com/user-attachments/assets/a2d02fa5-1205-48d9-b38d-c6f8d80bd521" />  not working
  > `{   "mcpServers": {     "chrome-devtools": {       "env": {         "PROGRAMFILES": "C:\\Program Files"        },       "command": "npx",       "args": ["-y", "chrome-devtools-mcp@0.1.0"]     }   } } `  This works but when I ask Cursor to let's say go to google.com, then the tool call give this: "spawn UNKNOWN"

- **Issue #304** (2025-10-08): **Publishing to the MCP registry fails with validation errors**
  *Symptoms*: See https://github.com/ChromeDevTools/chrome-devtools-mcp/actions/runs/18336260242/job/52221040509  Started failing without changes on our side. cc @natorion @sebastianbenz @Lightning00Blade 

- **Issue #300** (2025-10-08): **Unable to resolve resource extension:mcp.config.usrlocal.chromedevtools/chrome-devtools-mcp/mcpServer**
  *Symptoms*: **Describe the bug** Unable to resolve resource extension:mcp.config.usrlocal.chromedevtools/chrome-devtools-mcp/mcpServer  **To Reproduce** Steps to reproduce the behavior:  1. I've installed the Chrome Devtools MCP 2. I've tried to add the tool as context in the Agent chat  **Expected behavior** I should be able to chat in agent mode using the Devrools MCP  **Chrome version:** Version 141.0.7390.54 (Official Build) (arm64) **Coding agent version:** Visual Studio Code 1.104.2 **Model version:** Claude Sonnet 3.5  **Screenshots**  <img width="1909" height="1042" alt="Image" src="https://github.com/user-attachments/assets/c683a756-ed5e-44af-ae03-bd48d073061c" />  <img width="466" height="141" alt="Image" src="https://github.com/user-attachments/assets/eefd3535-cd96-442e-b76c-ea308c64e9c3" />   **Chat log** ``` [error] [Janela] Ocorreu um erro desconhecido. Verifique o log para obter detalhes. 2025-10-07 12:02:35.295 [error] [Janela] Error: Unable to resolve resource extension:mcp.config.usrlocal.chromedevtools/chrome-devtools-mcp/mcpServer     at YKe.r (vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js:1226:21649)     at YKe.r (vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js:1226:21635)     at async pTt.acquire (vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/workbench/
  **Post-Mortem & Fix Analysis**:
  > How did you install the MCP server? Can you show your JSON MCP config?
  > Hey @sebastianbenz I've installed from https://github.com/mcp this is my JSON config: ``` "chromedevtools/chrome-devtools-mcp": { 			"type": "stdio", 			"command": "npx", 			"args": [ 				"chrome-devtools-mcp@latest", 				"--browserUrl", 				"${input:browser_url}", 				"--headless", 				"${input:headless}", 				"--isolated", 				"${input:isolated}", 				"--channel", 				"${input:chrome_channel}" 			], 			"gallery": "https://api.mcp.github.com/v0/servers/13749964-2447-4c31-bcab-32731cced504", 			"version": "0.0.1-seed" 		} ```
  > Thanks! That helps! If you remove the following it should work:  ``` "--browserUrl", 				"${input:browser_url}", 				"--headless", 				"${input:headless}", 				"--isolated", 				"${input:isolated}", 				"--channel", 				"${input:chrome_channel}" ```

- **Issue #294** (2025-10-07): **Bug: --viewport option and resize_page tool fail in headless mode with Browser.setContentsSize error**
  *Symptoms*: ## Bug Report: `--viewport` option and `resize_page` tool fail in headless mode  ### Environment - **chrome-devtools-mcp version**: 0.5.1 (latest) - **Chrome version**: 139.0.7258.138 - **OS**: Ubuntu 22.04.5 LTS - **Configuration**: `--headless=true --isolated=true --viewport=1280x720`  ### Description The `--viewport` option causes all MCP tools to fail with a protocol error in headless mode. The `resize_page` tool also fails with the same error.  ### Steps to Reproduce 1. Configure `.mcp.json` with `--viewport=1280x720`: ```json {   "chrome-devtools": {     "command": "npx",     "args": [       "chrome-devtools-mcp@latest",       "--channel=stable",       "--headless=true",       "--isolated=true",       "--viewport=1280x720"     ]   } } ```  2. Restart MCP server 3. Try to use any tool (e.g., `list_pages`, `navigate_page`, or `resize_page`)  ### Expected Behavior - `--viewport` option should set the initial viewport size - `resize_page` tool should resize the page viewport - All other tools should work normally  ### Actual Behavior All tools fail with the error: ``` Protocol error (Browser.setContentsSize): 'Browser.setContentsSize' wasn't found ```  ### Root Cause Analysis After investigating the source code, I found:  1. Both `--viewport` initialization and `resize_page` tool use `page.resize()` (marked as `@ts-expect-error internal API for now`) 2. This internal API calls `Browser.setContentsSize` from Chrome DevTools Protocol 3. `Browser.setContentsSize` is marked as 
  **Post-Mortem & Fix Analysis**:
  > Chrome 139 is not a current stable version. Could you please try with the current stable version which 141+?
  > Able to reproduce it with the latest version but somehow it was not caught in tests.
  > Thank you for confirming the bug @OrKoN. I've upgraded Chrome from 139 to 141.0.7390.54 and can confirm the issue persists, though with different behavior.  **Environment:** - Chrome version: 141.0.7390.54 - chrome-devtools-mcp: latest (npx chrome-devtools-mcp@latest) - OS: Ubuntu 22.04.5 LTS - Mode: `--headless=true --viewport=1280x720`  **Test Results:**  1. **`resize_page` tool fails silently**    - Called `resize_page({width: 1920, height: 1080})`    - Expected: viewport resized to 1920x1080    - Actual: viewport remains 800x513 (no error thrown)    - Verification: `window.innerWidth=800, window.innerHeight=513`  2. **`--viewport` startup option also ignored**    - MCP server started with `--viewport=1280x720`    - Expected: viewport initialized to 1280x720    - Actual: viewport defaults to 800x600 (screen.width=800, screen.height=600)  **Observation:** Unlike Chrome 139 which threw `'Browser.setContentsSize' wasn't found` error, Chrome 141 fails silently - the tool returns success

- **Issue #292** (2025-10-13): **Misleading error message in headless environment**
  *Symptoms*: **Describe the bug** When running the MCP server in a headless container (e.g. cloudtop), the error message is:  ```  MCP tool 'new_page' reported tool error for function call: {"name":"new_page","args":{"url":"https://example.com"}} with response: [{"functionResponse":{"name":"new_page","response":{"error":{"content":[{"type":"text","text":"The browser is already running for                                                                 │  │    ...... Use --isolated to run multiple browser instances."}],"isError":true}}}}] ```  Using `--isolated` is the wrong suggestion here. We should have a better   **To Reproduce** Use default config with Gemini CLI in a headless container (e.g. cloudtop for googlers) and run a simple prompt like: "Check performance of example.com"  **Expected behavior** There should be an error message that explains that the MCP server is running in a headless environment and needs the `headless` flag. 
  **Post-Mortem & Fix Analysis**:
  > Interesting. I started using this MCP on 10/8 and I did get it working in WSL.    Now today on 10/10, no matter what I do, I get  ``` Error: The browser is already running for /home/user/.cache/chrome-devtools-mcp/chrome-profile. Use --isolated to run      multiple browser instances. ```  **Edit: I was able to resolve the error by rolling back to `0.6.1`**

- **Issue #269** (2025-10-06): **"Not connected"in vscode cline**
  *Symptoms*: # Chrome DevTools MCP 修复报告  ## 问题诊断结果  ### ✅ 已确认正常的组件 1. **Chrome安装**：Chrome已正确安装在 `C:\Program Files\Google\Chrome\Application\chrome.exe` 2. **环境变量**：`CHROME_PATH` 环境变量已正确设置为 `C:\Program Files\Google\Chrome\Application\chrome.exe` 3. **Chrome调试端口**：端口9222正常响应，返回Chrome版本信息 4. **MCP服务器启动**：服务器可以正常启动并显示启动消息  ### ❌ 识别的问题 **MCP客户端连接问题**：尽管MCP服务器运行正常，但客户端显示"Not connected"错误  ## 修复步骤执行  ### 1. 环境检查 ✅ - Chrome路径：`C:\Program Files\Google\Chrome\Application\chrome.exe` ✓ - 环境变量：`CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe` ✓  ### 2. 进程管理 ✅ - 终止所有旧的Node.js进程 ✓ - 清理可能冲突的MCP实例 ✓  ### 3. 服务器启动 ✅ - 方法1：使用`--executablePath`参数启动 ✓ - 方法2：使用`--browserUrl`参数启动 ✓ - Chrome远程调试端口9222正常响应 ✓  ### 4. 连接测试 ❌ - MCP客户端仍显示"Not connected"错误 - 服务器端运行正常，问题在客户端连接配置  ## 根本原因分析  **问题定位**：这是一个MCP客户端配置问题，而非服务器端功能问题。  **技术分析**： 1. MCP服务器启动正常，显示正确的启动消息 2. Chrome调试端口响应正常 3. MCP客户端无法连接到运行中的服务器实例 4. 可能的原因：    - MCP客户端缓存了旧的连接配置    - 客户端连接协议不匹配    - 客户端需要重新启动以刷新连接  ## 当前状态  ### 服务器端状态 ✅ - Chrome进程：运行正常，调试端口9222响应 - MCP服务器：已启动，显示正常启动消息 - 环境配置：所有路径和变量正确设置  ### 客户端状态 ❌ - 连接状态：显示"Not connected" - 错误类型：MCP协议连接错误 - 影响范围：无法使用chrome-devtools MCP工具  ## 解决方案  ### 立即解决方案 1. **重启MCP客户端**：完全关闭当前MCP客户端并重新打开 2. **清理配置缓存**：清除MCP客户端的连接配置缓存 3. **等待初始化**：给服务器30秒完全启动时间  ### 备用解决方案 1. **使用备用启动脚本**：创建新的启动脚本文件 2. **检查防火墙设置**：确保本地连接不受限制 3. **验证MCP协议版本**：确保客户端和服务器协议版本兼容  ## 验证命令  ### 检查Chrome调试端口 ```bash curl -s http://127.0.0.1:9222/json/version ```  ### 启动MCP服务器（方法1） ```bash npx chrome-devtools-mcp@latest --executablePa
  **Post-Mortem & Fix Analysis**:
  > This seems this is resolved (if google translate got it right)

- **Issue #262** (2025-10-07): **SyntaxError when running npx chrome-devtools-mcp@latest - UserMetric.js file**
  *Symptoms*: **Describe the bug**  The published npm package chrome-devtools-mcp@latest contains a truncated JavaScript file (UserMetrics.js) that causes an immediate syntax error when attempting to run the package. This prevents users from adding the MCP server to the coding agent.  Note: Building from source works correctly - this issue is specific to the published npm package.  **To Reproduce**  Steps to reproduce the behavior: 1. Run npx chrome-devtools-mcp@latest --help ( from Troubleshooting guide )  2. See error  **Expected behavior**  The command should execute successfully without any error. Instead, Node.js fails with a SyntaxError  **Error Output**  ```   file:///Users/username/.npm/_npx/.../node_modules/chrome-devtools-mcp/build/node_modules/chrome-devtools-frontend/front_end/core/host/UserMetrics.js:774       IssueCreated[IssueCreated["CookieIssue::ExcludeContextDowngrade::SetCookie::Secure"] = 28] =   "CookieIssue::ExcludeContextDowngrade::SetCookie::S    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^    SyntaxError: Invalid or unexpected token       at compileSourceTextModule (node:internal/modules/esm/utils:338:16)       at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:102:18)       at #translate (node:internal/modules/esm/loader:468:12)       at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:515:27) ```  **Node.Js version:** v22.14.0 **Chrome version:** N/A **Coding agent version:** N/A **Model version:** N/A  
  **Post-Mortem & Fix Analysis**:
  > Hello,  Thanks for reporting. Unfortunately I am unable to reproduce, using Node v22.14, and **v0.6.0** of this package:  ``` [scratch/mcp-bug] $ node -v v22.14.0 [scratch/mcp-bug] $ npx chrome-devtools-mcp@latest --help Options:    [removed, but they output as expected here] [scratch/mcp-bug] $ npx chrome-devtools-mcp@latest --version 0.6.0 ```  Is it possible that something went wrong for you in the npx install step (bad internet connection?) that caused a file to be truncated?  Please could you try again and let us know if it works? Thanks 
  > <img width="888" height="295" alt="Image" src="https://github.com/user-attachments/assets/cf93fbfd-65e7-4810-8ac2-91f9f2770fb9" />  <img width="888" height="516" alt="Image" src="https://github.com/user-attachments/assets/78f5e37a-69ff-4a9d-91aa-a040919b4d3d" />  yeah I think something wrong with my npx setup, I tried running with `pnpm dlx chrome-devtools-mcp@latest --help` and it worked fine. False alarm. You can close it, thanks !
  > You are spot on ! I believe it is a corrupted download and the cache was serving that truncated version. I removed the npx cache and tried it again with npx command, it worked. Thanks !

- **Issue #261** (2025-10-10): **Headless isolated launch fails as root without --no-sandbox**
  *Symptoms*:   ## Summary   Running `chrome-devtools-mcp` as the root user causes Chrome to exit immediately with `Running as root without --no-sandbox is not supported`, so the MCP client receives `Target closed / Connection closed`   errors.    ## Environment   - chrome-devtools-mcp 0.6.0   - Node.js 22.20.0   - OS: Linux container (root user)   - Command: `node build/src/index.js --headless --isolated`    ## Steps to Reproduce   1. Checkout v0.6.0   2. Run `npm install && npm run build`   3. Execute `node build/src/index.js --headless --isolated` as root   4. Observe Chrome crashing with the log above and the MCP server exiting    ## Expected Behavior   The bundled Chrome should launch successfully even when the server runs as root (typical for containers/CI), without requiring extra flags from the user.    ## Suggested Fix   Automatically add sandbox flags when running as root. For example in `src/browser.ts`:    ```ts   const args = [     ...(options.args ?? []),     '--hide-crash-restore-bubble',   ];    if (process.getuid?.() === 0 && !args.some(arg => arg.startsWith('--no-sandbox'))) {     args.push('--no-sandbox', '--disable-setuid-sandbox');   }    Then rebuild (npm run build) so the generated build/src/browser.js picks up the same logic.
  **Post-Mortem & Fix Analysis**:
  > Encountering the same issue, can confirm the proposed solution works. it'll be nice to just allow passing additional args to chrome as launch args. e.g `--launch-arg="--no-sandbox --disable-setuid-sandbox"'
  > Generally we cannot recommend running without Chrome sandboxes or turn them off automatically but we can allow passing additional args to Chrome. Started a PR here https://github.com/ChromeDevTools/chrome-devtools-mcp/issues/261

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

### Incident Patch 1: `45c1c6cc` (2026-09-29)
**Commit Message**: fix: reject unrestricted paths with an explicit workspace (#2858)

The CLI documents `--allow-unrestricted-paths` and `--workspace` as
incompatible, but currently accepts both. Reject the explicit
combination while preserving standalone flags and the CLI default.

Validation: `npm run test` (1243 passed, 2 skipped); `npm run
check-format`.

**File**: `src/config/mcp-options.ts` (modified, +1/-0)
```diff
@@ -459,6 +459,7 @@ const CONFLICTING_ARGS: Array<Array<keyof typeof mcpOptions>> = [
   ['autoConnect', 'isolated'],
   ['autoConnect', 'executablePath'],
   ['blockedUrlPattern', 'allowedUrlPattern'],
+  ['allowUnrestrictedPaths', 'filesystemRoot'],
   ['categoryPwa', 'autoConnect'],
   ['categoryPwa', 'browserUrl', 'wsEndpoint'],
   ['categoryExtensions', 'autoConnect'],
```

**File**: `tests/cli.test.ts` (modified, +77/-0)
```diff
@@ -180,6 +180,83 @@ describe('cli args parsing', () => {
       assert.strictEqual(args.allowUnrestrictedPaths, true);
     });
 
+    it('accepts an explicit unrestricted flag in CLI mode', async () => {
+      const args = parseArguments(['--viaCli', '--allow-unrestricted-paths']);
+      assert.strictEqual(args.allowUnrestrictedPaths, true);
+      assert.strictEqual(args.filesystemRoot, undefined);
+    });
+
+    it('rejects unrestricted paths with a CLI workspace', async () => {
+      assert.throws(
+        () =>
+          parseArguments([
+            '--viaCli',
+            '--allow-unrestricted-paths',
+            '--workspace=/tmp/one',
+          ]),
+        /Arguments allowUnrestrictedPaths and filesystemRoot are mutually exclusive/,
+      );
+    });
+
+    it('rejects unrestricted paths with a direct filesystem root', async () => {
+      assert.throws(
+        () =>
+          parseArguments([
+            '--allow-unrestricted-paths',
+            '--filesystem-root=/tmp/one',
+          ]),
+        /Arguments allowUnrestrictedPaths and filesystemRoot are mutually exclusive/,
+      );
+    });
+
+    it('rejects a config unrestricted flag with a CLI workspace', async () => {
+      using testConfig = createTempFile(
+        JSON.stringify({allowUnrestrictedPaths: true}),
+        'cd4a.test.config.unrestricted-workspace.json',
+      );
+      assert.throws(
+        () =>
+          parseArguments([
+            '--viaCli',
+            '--config',
+            testConfig.path,
+            '--workspace=/tmp/one',
+          ]),
+        /Arguments allowUnrestrictedPaths and filesystemRoot are mutually exclusive/,
+      );
+    });
+
+    it('rejects a config filesystem root with a CLI unrestricted flag', async () => {
+      using testConfig = createTempFile(
+        JSON.stringify({filesystemRoot: ['/tmp/one']}),
+        'cd4a.test.config.root-unrestricted.json',
+      );
+      assert.throws(
+        () =>
+          parseArguments([
+            '--config',
+            testConfig.path,
+            '--allow-unrestricted-paths',
+          ]),
+        /Arguments allowUnrestrictedPaths and filesystemRoot are mutually exclusive/,
+      );
+    });
+
+    it('lets an explicit false override config unrestricted with a workspace', async () => {
+      using testConfig = createTempFile(
+        JSON.stringify({allowUnrestrictedPaths: true}),
+        'cd4a.test.config.unrestricted-false.json',
+      );
+      const args = parseArguments([
+        '--config',
+        testConfig.path,
+        '--no-allow-unrestricted-paths',
+        '--workspace=/tmp/one',
+      ]);
+      assert.strictEqual(args.allowUnrestrictedPaths, false);
+      assert.deepStrictEqual(args.filesystemRoot, ['/tmp/one']);
+    });
+
     it('lets an explicit workspace override the CLI unrestricted default', async () => {
       const args = parseArguments(['--viaCli', '--workspace=/tmp/one']);
       assert.strictEqual(args.allowUnrestrictedPaths, false);
```

---

### Incident Patch 2: `2a7ef504` (2026-09-29)
**Commit Message**: fix: fail fast on tool calls stuck after a dead browser connection (#2699)

Root cause: when the debugged browser's CDP transport dies mid-call —
silently, without ever firing a `close`/`error`/`disconnected` event (as
opposed to a clean disconnect) — the in-flight tool call just hangs
forever waiting on a response that will never come. Because
`ToolHandler` serializes every tool call behind a single shared `Mutex`,
that one stuck call blocks all subsequent tool calls too, effectively
taking the whole MCP server down until someone manually reconnects via
`/mcp`.

Observed when an Android app being debugged over `chrome-devtools-mcp`
was reinstalled/relaunched mid-session, the MCP server's tools went
completely unavailable, even though the underlying CDP endpoint
(http://127.0.0.1:9222/json) stayed reachable the whole time. This
wasn't a startup/connection-time failure, which the existing "next-call
self-heal" logic already handles fine — it was a hang mid-call, so there
was never a clean "next call" for that self-heal to run on.

- `browser.ts`: export `forgetBrowser()` and attach a `disconnected`
listener after every successful connect/launch, so a browser Puppeteer
does detect as

**File**: `src/BrowserManager.ts` (modified, +110/-3)
```diff
@@ -23,6 +23,13 @@ export interface BrowserManagerOptions {
   logFile?: fs.WriteStream;
 }
 
+/**
+ * Identity token for an in-flight connect/launch attempt. Instances carry no
+ * data and are never inspected structurally — only ever compared by
+ * reference (`!==`) — see BrowserManager#abandonPendingAttempt().
+ */
+class BrowserAttempt {}
+
 export class BrowserManager {
   #browser?: Browser;
   #browserMode?: 'launched' | 'connected';
@@ -32,6 +39,8 @@ export class BrowserManager {
   #serverArgs: ParsedArguments;
   #options: BrowserManagerOptions;
 
+  #browserAttempt: BrowserAttempt = new BrowserAttempt();
+
   constructor(
     serverArgs: ParsedArguments,
     options: BrowserManagerOptions = {},
@@ -126,20 +135,64 @@ export class BrowserManager {
     if (this.#closingCount > 0) {
       throw new Error('Browser was closed while initializing.');
     }
+    // Captured before acquiring #mutex, not after: a caller queued here can
+    // have its own timeout fire (abandonPendingAttempt()) while it's still
+    // waiting for the lock. Capturing only after acquiring it would let such
+    // a call silently adopt the freshly-rotated token as its own baseline
+    // once the lock frees up, defeating the abandonment check entirely.
+    const attempt = this.#browserAttempt;
     using _guard = await this.#mutex.acquire();
     if (this.#closingCount > 0) {
       throw new Error('Browser was closed while initializing.');
     }
+    if (this.#browserAttempt !== attempt) {
+      // Abandoned while queued for the lock — #browser was never touched by
+      // this call, so bail immediately without #closeBrowser(), which could
+      // otherwise tear down a different, still-current attempt's browser.
+      throw new Error('Connection attempt was abandoned before it completed.');
+    }
     if (!this.#browser?.connected) {
       await this.#initBrowser();
     }
-    if (this.#closingCount > 0 || !this.#browser) {
+    if (
+      this.#closingCount > 0 ||
+      this.#browserAttempt !== attempt ||
+      !this.#browser
+    ) {
+      const reason =
+        this.#closingCount > 0
+          ? 'Browser was closed while initializing.'
+          : 'Connection attempt was abandoned before it completed.';
       await this.#closeBrowser();
-      throw new Error('Browser was closed while initializing.');
+      throw new Error(reason);
     }
     return this.#browser;
   }
 
+  /**
+   * Signals that whoever was waiting on the in-flight ensureBrowser() call
+   * has given up (e.g. a tool-call timeout). There's no way to cancel a
+   * pending connect()/launch(), so this doesn't stop it — it rotates the
+   * token to a fresh value and clears #initPromise, so a late-resolving
+   * attempt gets discarded by #ensureBrowserLocked() instead of silently
+   * installed for a caller who already walked away.
+   *
+   * Also forgets the cached #browser, if any. This only ever fires from a
+   * getContext()-level timeout, which covers both ensureBrowser() and the
+   * McpContext initialization built on it — if ensureBrowser() already
+   * resolved and it's that later step hanging (e.g. a dead CDP transport),
+   * the token rotation alone does nothing, since #browser is already
+   * cached. Safe to forget unconditionally here: the tool mutex serializes
+   * every call, so there's no concurrent caller to disrupt.
+   */
+  abandonPendingAttempt(): void {
+    this.#browserAttempt = new BrowserAttempt();
+    this.#initPromise = undefined;
+    if (this.#browser) {
+      this.forget(this.#browser);
+    }
+  }
+
   async #initBrowser(): Promise<Browser> {
     if (
       this.#serverArgs.browserUrl ||
@@ -245,7 +298,9 @@ export class BrowserManager {
       }
       this.#browserMode = 'launched';
       this.#browser = browser;
-      return browser;
+      const launched = browser;
+      launched.once('disconnected', () => this.#evictIfCurrent(launched));
+      return launched;
     } catch (error) {
       await b
```

**File**: `src/ToolHandler.ts` (modified, +111/-48)
```diff
@@ -10,7 +10,7 @@ import type {McpPage} from './McpPage.js';
 import {McpResponse} from './McpResponse.js';
 import {SlimMcpResponse} from './SlimMcpResponse.js';
 import {ClearcutLogger} from './telemetry/ClearcutLogger.js';
-import type {CallToolResult} from './third_party/index.js';
+import type {Browser, CallToolResult} from './third_party/index.js';
 import {zod} from './third_party/index.js';
 import {labels} from './tools/categories.js';
 import {categoryToFlagName} from './config/category-options.js';
@@ -25,6 +25,21 @@ import type {Mutex} from './third_party/index.js';
 import {fileURLToPath, pathToFileURL} from 'node:url';
 import {isLocalhost} from './utils/url.js';
 
+/**
+ * Upper bound on how long a single tool call may wait on the browser
+ * connection. Puppeteer normally rejects in-flight CDP calls when the
+ * underlying transport closes, but a transport that dies silently (e.g. an
+ * adb port-forward torn down mid-call, rather than closed cleanly) never
+ * fires `close`/`error`/`disconnected`, so the call would otherwise hang
+ * until an external (client-side) timeout gives up on the whole server. This
+ * bound turns that into a fast, clear error instead, and forgets the cached
+ * browser handle so the next call reconnects rather than reusing a handle
+ * that still looks connected.
+ */
+export const TOOL_CALL_TIMEOUT_MS = 60_000;
+
+class ToolCallTimeoutError extends Error {}
+
 function buildDisabledMessage(
   toolName: string,
   flag: string,
@@ -162,6 +177,8 @@ export class ToolHandler {
     private readonly serverArgs: ParsedArguments,
     private readonly getContext: () => Promise<McpContext>,
     private readonly toolMutex: Mutex,
+    private readonly forgetBrowserOnTimeout: (browser: Browser) => void,
+    private readonly abandonPendingBrowserAttemptOnTimeout: () => void,
   ) {
     const {disabled, reason} = getToolStatusInfo(tool, serverArgs);
     this.disabledReason = reason;
@@ -171,6 +188,36 @@ export class ToolHandler {
     this.registeredInputSchema = zod.object(this.inputSchema).strict();
   }
 
+  /**
+   * Races a promise against TOOL_CALL_TIMEOUT_MS, calling onTimeout() if the
+   * timer wins. The loser of the race is left running — there is no way to
+   * cancel a pending Puppeteer call — but since nothing is left awaiting it,
+   * it cannot block subsequent tool calls.
+   */
+  async #raceWithTimeout<T>(
+    promise: Promise<T>,
+    onTimeout: () => void,
+  ): Promise<T> {
+    const timeoutError = new ToolCallTimeoutError(
+      `Tool "${this.tool.name}" timed out after ${TOOL_CALL_TIMEOUT_MS}ms waiting on the browser connection. The connection may have been lost (for example, the debugged browser or app restarted). It will be re-established automatically on the next tool call.`,
+    );
+    let timer: ReturnType<typeof setTimeout> | undefined;
+    const timeout = new Promise<never>((_, reject) => {
+      timer = setTimeout(() => reject(timeoutError), TOOL_CALL_TIMEOUT_MS);
+      timer.unref?.();
+    });
+    try {
+      return await Promise.race([promise, timeout]);
+    } catch (err) {
+      if (err === timeoutError) {
+        onTimeout();
+      }
+      throw err;
+    } finally {
+      clearTimeout(timer);
+    }
+  }
+
   handle = async (params: Record<string, unknown>): Promise<CallToolResult> => {
     using _guard = await this.toolMutex.acquire();
 
@@ -194,7 +241,15 @@ export class ToolHandler {
       logger?.(
         `${this.tool.name} request: ${JSON.stringify(params, null, '  ')}`,
       );
-      const context = await this.getContext();
+      // ensureBrowser() has no cancellation mechanism, so this timeout only
+      // stops us from waiting — the attempt itself keeps running abandoned.
+      // abandonPendingBrowserAttemptOnTimeout() tells BrowserManager to
+      // discard that attempt if it succeeds later instead of handing it to a
+      // subsequent caller — see BrowserManager#abandonPendingAttempt()'s doc
+      // comment f
```

**File**: `src/index.ts` (modified, +2/-0)
```diff
@@ -289,6 +289,8 @@ export class McpServer {
       this.#serverArgs,
       () => this.#getContext(),
       this.#toolMutex,
+      browser => this.#browserManager.forget(browser),
+      () => this.#browserManager.abandonPendingAttempt(),
     );
 
     this.#tools.set(tool.name, toolHandler);
```

**File**: `tests/ToolHandler.test.ts` (modified, +225/-1)
```diff
@@ -18,7 +18,7 @@ import {McpPage} from '../src/McpPage.js';
 import {McpResponse, type DataFormat} from '../src/McpResponse.js';
 import {ClearcutLogger} from '../src/telemetry/ClearcutLogger.js';
 import {zod} from '../src/third_party/index.js';
-import {ToolHandler} from '../src/ToolHandler.js';
+import {TOOL_CALL_TIMEOUT_MS, ToolHandler} from '../src/ToolHandler.js';
 import {ToolCategory} from '../src/tools/categories.js';
 import {
   definePageTool,
@@ -70,6 +70,8 @@ describe('ToolHandler', () => {
       serverArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
 
     assert.strictEqual(toolHandler.disabled, false);
@@ -115,6 +117,8 @@ describe('ToolHandler', () => {
       serverArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
 
     assert.strictEqual(toolHandler.disabled, false);
@@ -156,6 +160,8 @@ describe('ToolHandler', () => {
       serverArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
 
     assert.strictEqual(toolHandler.disabled, false);
@@ -213,6 +219,8 @@ describe('ToolHandler', () => {
         serverArgs,
         async () => mockContext,
         new Mutex(),
+        sinon.spy(),
+        sinon.spy(),
       ).handle({});
 
       sinon.assert.calledOnceWithExactly(handleStub, mockContext, expected);
@@ -288,6 +296,8 @@ describe('ToolHandler', () => {
         serverArgs,
         async () => mockContext,
         toolMutex,
+        sinon.spy(),
+        sinon.spy(),
       );
 
       await toolHandler.handle({});
@@ -335,6 +345,8 @@ describe('ToolHandler', () => {
       serverArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
 
     const params = {
@@ -389,6 +401,8 @@ describe('ToolHandler', () => {
       serverArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
 
     assert.strictEqual(toolHandler.disabled, true);
@@ -420,6 +434,8 @@ describe('ToolHandler', () => {
       defaultServerArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
     assert.strictEqual(defaultHandler.disabled, false);
 
@@ -439,6 +455,8 @@ describe('ToolHandler', () => {
       disabledServerArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
     assert.strictEqual(disabledHandler.disabled, true);
 
@@ -467,6 +485,8 @@ describe('ToolHandler', () => {
       cliServerArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
     assert.strictEqual(cliHandler.disabled, false);
     const cliResult = await cliHandler.handle({function: '() => 1'});
@@ -497,6 +517,8 @@ describe('ToolHandler', () => {
       defaultServerArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
     assert.strictEqual(defaultHandler.disabled, false);
 
@@ -516,6 +538,8 @@ describe('ToolHandler', () => {
       disabledServerArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
     assert.strictEqual(disabledHandler.disabled, true);
   });
@@ -568,6 +592,8 @@ describe('ToolHandler', () => {
       serverArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
 
     const testFile = path.resolve('/workspace/url-file.txt');
@@ -644,6 +670,8 @@ describe('ToolHandler', () => {
       serverArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
 
     const result = await toolHandler.handle({
@@ -700,6 +728,8 @@ describe('ToolHandler', () => {
       serverArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
 
     const testPath = path.resolve('/workspace/upload.png');
@@ -757,6 +787,8 @@ describe
```

**File**: `tests/browser.test.ts` (modified, +268/-0)
```diff
@@ -302,6 +302,274 @@ describe('browser', () => {
       sinon.assert.calledOnce(launchStub);
       sinon.assert.calledOnceWithExactly(pptrBrowser.close);
     });
+
+    describe('forget', () => {
+      it('does nothing when the candidate is not the current browser', async () => {
+        const pptrBrowser = createMockPuppeteerBrowser();
+        const other = createMockPuppeteerBrowser();
+        sinon.stub(puppeteer, 'launch').resolves(pptrBrowser);
+
+        const manager = new BrowserManager(
+          createMockParsedArguments({headless: true, isolated: true}),
+        );
+        await manager.ensureBrowser();
+
+        manager.forget(other);
+
+        sinon.assert.notCalled(other.close);
+        sinon.assert.notCalled(other.disconnect);
+        sinon.assert.notCalled(pptrBrowser.close);
+        sinon.assert.notCalled(pptrBrowser.disconnect);
+      });
+
+      it('disconnects the current browser when it was connected', async () => {
+        const pptrBrowser = createMockPuppeteerBrowser();
+        sinon.stub(puppeteer, 'connect').resolves(pptrBrowser);
+
+        const manager = new BrowserManager(
+          createMockParsedArguments({browserUrl: 'http://127.0.0.1:9222'}),
+        );
+        const browser = await manager.ensureBrowser();
+
+        manager.forget(browser);
+
+        sinon.assert.calledOnceWithExactly(pptrBrowser.disconnect);
+        sinon.assert.notCalled(pptrBrowser.close);
+      });
+
+      it('closes the current browser when it was launched', async () => {
+        const pptrBrowser = createMockPuppeteerBrowser();
+        sinon.stub(puppeteer, 'launch').resolves(pptrBrowser);
+
+        const manager = new BrowserManager(
+          createMockParsedArguments({headless: true, isolated: true}),
+        );
+        const browser = await manager.ensureBrowser();
+
+        manager.forget(browser);
+
+        sinon.assert.calledOnceWithExactly(pptrBrowser.close);
+        sinon.assert.notCalled(pptrBrowser.disconnect);
+      });
+    });
+
+    describe('push-based disconnect eviction', () => {
+      it('proactively evicts a disconnected browser without waiting for a lazy connected check', async () => {
+        const firstBrowser = createMockPuppeteerBrowser();
+        const secondBrowser = createMockPuppeteerBrowser();
+        const launchStub = sinon
+          .stub(puppeteer, 'launch')
+          .onFirstCall()
+          .resolves(firstBrowser)
+          .onSecondCall()
+          .resolves(secondBrowser);
+
+        const manager = new BrowserManager(
+          createMockParsedArguments({headless: true, isolated: true}),
+        );
+
+        const first = await manager.ensureBrowser();
+        assert.strictEqual(first, firstBrowser);
+
+        firstBrowser.emit('disconnected', undefined);
+
+        // The mock's `connected` getter still reports true — proves the next
+        // ensureBrowser() reconnected because of the push-based eviction,
+        // not because a lazy `!browser.connected` check caught it.
+        assert.strictEqual(firstBrowser.connected, true);
+
+        const second = await manager.ensureBrowser();
+        assert.strictEqual(second, secondBrowser);
+        sinon.assert.calledTwice(launchStub);
+      });
+
+      it('does not evict the current browser when disconnected fires on an already-superseded one', async () => {
+        const oldBrowser = createMockPuppeteerBrowser();
+        const newBrowser = createMockPuppeteerBrowser();
+        let oldConnected = true;
+        sinon.stub(oldBrowser, 'connected').get(() => oldConnected);
+        const launchStub = sinon
+          .stub(puppeteer, 'launch')
+          .onFirstCall()
+          .resolves(oldBrowser)
+          .onSecondCall()
+          .resolves(newBrowser);
+
+        const manager = new BrowserManager(
+          createMockParsedArguments({headless: true, isolated: true}),
+        );
+
+        const first = await manager.ensureBrowser();
+        assert.strictEqual(fi
```

---

### Incident Patch 3: `efb0d028` (2026-09-29)
**Commit Message**: fix: escape client-supplied values in McpContext logs and errors (#2832)

## Summary

`McpContext.validatePath` wrote two diagnostic lines to stderr that
interpolate client-supplied values verbatim: the tool's `filePath`, and
a `root.uri` from the client's `roots/list` response. A newline in
either value split one log record into several and let the client write
whole lines into the server's stderr (reproduced in #2831).

This PR encodes both values, plus the `realpath` error text that repeats
them, with a small helper, `escapeForLog()`. Each log call now stays on
one line, and quoted client input is always distinguishable from server
text. Following review, the client's path is also encoded in the three
errors `McpContext` throws with it: the two `Access denied` errors from
`validatePath`, and `Could not write …` when saving a file fails.

Behaviour is otherwise unchanged. The same paths are still refused; only
the stderr lines and the path inside those three error messages change
(it is now quoted and escaped).

## Why not just `JSON.stringify`

`JSON.stringify` alone (the fix suggested in #2831, and the first commit
here) escapes C0 controls and `"`, but it leaves these characte

**File**: `src/McpContext.ts` (modified, +8/-5)
```diff
@@ -49,6 +49,7 @@ import type {TraceResult} from './processors/PerformanceTrace.js';
 import type {Logger} from './types.js';
 import type {ExtensionServiceWorker} from './types.js';
 import {getTempFilePath, resolveCanonicalPath} from './utils/files.js';
+import {escapeForLog} from './utils/logger.js';
 import {isAllowedUrl} from './utils/url.js';
 interface McpContextOptions {
   // Whether the DevTools windows are exposed as pages for debugging of DevTools.
@@ -241,10 +242,10 @@ export class McpContext implements Context {
     } catch (err) {
       const errMsg = err instanceof Error ? err.message : String(err);
       console.error(
-        `[MCP Context] Error resolving real path for ${filePath}: ${errMsg}`,
+        `[MCP Context] Error resolving real path for ${escapeForLog(filePath)}: ${escapeForLog(errMsg)}`,
       );
       throw new Error(
-        `Access denied: Cannot resolve base path for ${filePath}.`,
+        `Access denied: Cannot resolve base path for ${escapeForLog(filePath)}.`,
       );
     }
 
@@ -289,15 +290,15 @@ export class McpContext implements Context {
         const errMsg =
           rootErr instanceof Error ? rootErr.message : String(rootErr);
         console.warn(
-          `[MCP Context] Could not resolve configured root ${root.uri}: ${errMsg}`,
+          `[MCP Context] Could not resolve configured root ${escapeForLog(root.uri)}: ${escapeForLog(errMsg)}`,
         );
         // Skip this root if it cannot be resolved.
       }
     }
 
     if (!allowed) {
       throw new Error(
-        `Access denied: path ${filePath} (canonical: ${canonicalPath}) is not within any of the configured workspace roots.`,
+        `Access denied: path ${escapeForLog(filePath)} (canonical: ${escapeForLog(canonicalPath)}) is not within any of the configured workspace roots.`,
       );
     }
 
@@ -681,7 +682,9 @@ export class McpContext implements Context {
         mode: 0o600,
       });
     } catch (err) {
-      throw new Error(`Could not write ${filepath}`, {cause: err});
+      throw new Error(`Could not write ${escapeForLog(filepath)}`, {
+        cause: err,
+      });
     }
   }
 
```

**File**: `src/utils/logger.ts` (modified, +13/-0)
```diff
@@ -39,6 +39,19 @@ export function flushLogs(
   });
 }
 
+/**
+ * Encodes a value for interpolation into a one-line log or error message. The
+ * result is a JSON string literal that also escapes DEL, C1 controls and
+ * U+2028/U+2029, which JSON.stringify leaves raw but terminals and line
+ * readers act on.
+ */
+export function escapeForLog(value: string): string {
+  return JSON.stringify(value).replace(
+    /[\u007f-\u009f\u2028\u2029]/g,
+    char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
+  );
+}
+
 export const logger: Logger = (...args: unknown[]) => {
   if (logFileStream) {
     logFileStream.write(
```

**File**: `tests/roots.test.ts` (modified, +111/-1)
```diff
@@ -5,13 +5,19 @@
  */
 
 import assert from 'node:assert';
+import fs from 'node:fs/promises';
 import os from 'node:os';
 import path from 'node:path';
-import {describe, it} from 'node:test';
+import {afterEach, describe, it} from 'node:test';
 import {pathToFileURL} from 'node:url';
 
+import sinon from 'sinon';
+
+import {McpContext} from '../src/McpContext.js';
 import {resolveCanonicalPath} from '../src/utils/files.js';
+import {escapeForLog} from '../src/utils/logger.js';
 
+import {createMockPuppeteerBrowser} from './mocks.js';
 import {createTempDir, withMcpContext} from './utils.js';
 
 describe('McpContext Roots', () => {
@@ -139,3 +145,107 @@ describe('McpContext Roots', () => {
     });
   });
 });
+
+const UNESCAPED_LINE_BREAK = /[\n\r\u2028\u2029]/;
+const INJECTED = 'x\n\u2028[MCP Context] injected line';
+
+function enoent(filePath: string): Error {
+  return Object.assign(new Error(`ENOENT: ${filePath}`), {code: 'ENOENT'});
+}
+
+// Payload paths hold characters some file systems reject; report them missing
+// so every OS takes the same branch.
+function stubMissingPaths(...missingPaths: string[]) {
+  const realpath = sinon.stub(fs, 'realpath').callThrough();
+  for (const missingPath of missingPaths) {
+    realpath.withArgs(missingPath).rejects(enoent(missingPath));
+  }
+  return realpath;
+}
+
+describe('McpContext path validation escaping', () => {
+  afterEach(() => sinon.restore());
+
+  async function createContext(): Promise<McpContext> {
+    const browser = createMockPuppeteerBrowser();
+    browser.targets.returns([]);
+    return await McpContext.from(browser, undefined, {
+      experimentalDevToolsDebugging: false,
+      performanceCrux: false,
+    });
+  }
+
+  it('escapes the file path when it cannot be resolved', async () => {
+    const context = await createContext();
+    const filePath = path.join(os.tmpdir(), 'file.txt', INJECTED);
+    const errMsg = `ENOTDIR: not a directory, realpath '${filePath}'`;
+    sinon
+      .stub(fs, 'realpath')
+      .rejects(Object.assign(new Error(errMsg), {code: 'ENOTDIR'}));
+    const errorStub = sinon.stub(console, 'error');
+
+    await assert.rejects(context.validatePath(filePath), {
+      message: `Access denied: Cannot resolve base path for ${escapeForLog(filePath)}.`,
+    });
+
+    sinon.assert.calledWithMatch(
+      errorStub,
+      sinon.match((message: string) => !UNESCAPED_LINE_BREAK.test(message)),
+    );
+    sinon.assert.calledOnceWithExactly(
+      errorStub,
+      `[MCP Context] Error resolving real path for ${escapeForLog(filePath)}: ${escapeForLog(errMsg)}`,
+    );
+  });
+
+  it('escapes the path when it is outside the configured roots', async () => {
+    const context = await createContext();
+    const unlikelyDir = 'a_very_unlikely_path_name_12345';
+    const filePath = path.resolve(
+      path.parse(os.tmpdir()).root,
+      unlikelyDir,
+      INJECTED,
+    );
+    stubMissingPaths(filePath, path.dirname(filePath));
+    const canonicalPath = await resolveCanonicalPath(filePath);
+
+    await assert.rejects(context.validatePath(filePath), {
+      message: `Access denied: path ${escapeForLog(filePath)} (canonical: ${escapeForLog(canonicalPath)}) is not within any of the configured workspace roots.`,
+    });
+  });
+
+  it('escapes the path when the file cannot be written', async () => {
+    const context = await createContext();
+    const clientPath = path.join(os.tmpdir(), `${INJECTED}.png`);
+    const realpath = stubMissingPaths(clientPath);
+    const filePath = await context.ensureExtension(clientPath, '.png');
+    realpath.withArgs(filePath).rejects(enoent(filePath));
+    sinon
+      .stub(fs, 'mkdir')
+      .rejects(Object.assign(new Error('EACCES'), {code: 'EACCES'}));
+
+    await assert.rejects(
+      context.saveFile(new Uint8Array([0]), clientPath, '.png'),
+      {message: `Could not write ${escapeForLog(filePath)}`},
+    );
+  });
+
+  it('escapes the root URI when a root cannot be resol
```

**File**: `tests/utils/logger.test.ts` (modified, +28/-1)
```diff
@@ -9,7 +9,11 @@ import fs from 'node:fs';
 import {afterEach, describe, it, mock} from 'node:test';
 import util from 'node:util';
 
-import {puppeteerLogger, saveLogsToFile} from '../../src/utils/logger.js';
+import {
+  escapeForLog,
+  puppeteerLogger,
+  saveLogsToFile,
+} from '../../src/utils/logger.js';
 
 describe('puppeteerLogger', () => {
   afterEach(() => {
@@ -66,3 +70,26 @@ describe('puppeteerLogger', () => {
     assert.ok(writeArg.includes('hello world\n'));
   });
 });
+
+describe('escapeForLog', () => {
+  it('returns a JSON string literal', () => {
+    assert.strictEqual(escapeForLog('a"b\\c'), '"a\\"b\\\\c"');
+  });
+
+  it('escapes characters that break a log line or control a terminal', () => {
+    const cases: Array<[string, string]> = [
+      ['\n', '\\n'],
+      ['\r', '\\r'],
+      ['\u001b', '\\u001b'],
+      ['\u007f', '\\u007f'],
+      ['\u0085', '\\u0085'],
+      ['\u009b', '\\u009b'],
+      ['\u2028', '\\u2028'],
+      ['\u2029', '\\u2029'],
+    ];
+    for (const [char, escaped] of cases) {
+      assert.strictEqual(escapeForLog(`a${char}b`), `"a${escaped}b"`);
+      assert.strictEqual(JSON.parse(escapeForLog(`a${char}b`)), `a${char}b`);
+    }
+  });
+});
```

---

### Incident Patch 4: `c14e616d` (2026-09-28)
**Commit Message**: fix: reject JSON arrays as 3p and WebMCP tool params (#2785)

## Summary
`execute_3p_developer_tool` and `execute_webmcp_tool` parse a JSON
string as params. Arrays pass `typeof parsed === 'object' && parsed !==
null`, so `[]` skipped the object check and failed later with a
misleading error (`Tool not found` or a Puppeteer private-field
TypeError).

Reject arrays the same way `wsHeaders` already does.

## Testing
- `npm run test tests/tools/thirdPartyDeveloper.test.ts
tests/tools/webmcp.test.ts`
- `npm run typecheck`
- `npm run check-format`

AI-assisted (Grok)

Co-authored-by: Wolfgang Beyer <wolfi@chromium.org>

**File**: `src/tools/thirdPartyDeveloper.ts` (modified, +5/-1)
```diff
@@ -85,7 +85,11 @@ export const executeThirdPartyDeveloperTool = definePageTool(() => ({
     if (request.params.params) {
       try {
         const parsed = JSON.parse(request.params.params);
-        if (typeof parsed === 'object' && parsed !== null) {
+        if (
+          typeof parsed === 'object' &&
+          parsed !== null &&
+          !Array.isArray(parsed)
+        ) {
           params = parsed;
         } else {
           throw new Error('Parsed params is not an object');
```

**File**: `src/tools/webmcp.ts` (modified, +5/-1)
```diff
@@ -47,7 +47,11 @@ export const executeWebMcpTool = definePageTool(() => ({
     if (request.params.input) {
       try {
         const parsed = JSON.parse(request.params.input);
-        if (typeof parsed === 'object' && parsed !== null) {
+        if (
+          typeof parsed === 'object' &&
+          parsed !== null &&
+          !Array.isArray(parsed)
+        ) {
           input = parsed;
         } else {
           throw new Error('Parsed input is not an object');
```

**File**: `tests/tools/thirdPartyDeveloper.test.ts` (modified, +24/-1)
```diff
@@ -5,7 +5,7 @@
  */
 
 import assert from 'node:assert';
-import {describe, it} from 'node:test';
+import {afterEach, describe, it} from 'node:test';
 
 import sinon from 'sinon';
 
@@ -18,9 +18,14 @@ import {
   listThirdPartyDeveloperTools,
 } from '../../src/tools/thirdPartyDeveloper.js';
 import type {ToolGroups} from '../../src/tools/thirdPartyDeveloper.js';
+import {createHandlerMocks} from '../mocks.js';
 import {withMcpContext} from '../utils.js';
 
 describe('thirdPartyDeveloperTools', () => {
+  afterEach(() => {
+    sinon.restore();
+  });
+
   describe('list_3p_developer_tools', () => {
     it('lists tools', async () => {
       await withMcpContext(
@@ -391,6 +396,24 @@ describe('thirdPartyDeveloperTools', () => {
       });
     });
 
+    it('rejects JSON array params', async () => {
+      const {page, context, response, args} = createHandlerMocks();
+      await assert.rejects(
+        executeThirdPartyDeveloperTool(args).handler(
+          {
+            params: {
+              toolName: 'test-tool',
+              params: '[]',
+            },
+            page,
+          },
+          response,
+          context,
+        ),
+        {message: /Parsed params is not an object/},
+      );
+    });
+
     it('throws if parameters are invalid', async () => {
       await withMcpContext(
         async (response, context, args) => {
```

**File**: `tests/tools/webmcp.test.ts` (modified, +23/-1)
```diff
@@ -5,14 +5,21 @@
  */
 
 import assert from 'node:assert';
-import {describe, it} from 'node:test';
+import {afterEach, describe, it} from 'node:test';
+
+import sinon from 'sinon';
 
 import type {McpPage} from '../../src/McpPage.js';
 import {listPages, navigatePage, selectPage} from '../../src/tools/pages.js';
 import {executeWebMcpTool} from '../../src/tools/webmcp.js';
+import {createHandlerMocks} from '../mocks.js';
 import {html, withMcpContext} from '../utils.js';
 
 describe('webmcp', () => {
+  afterEach(() => {
+    sinon.restore();
+  });
+
   describe('list_webmcp_tools', () => {
     it('list webmcp tools in navigate_page response', async () => {
       await withMcpContext(async (response, context, args) => {
@@ -110,6 +117,21 @@ describe('webmcp', () => {
       );
     });
 
+    it('rejects JSON array input', async () => {
+      const {page, context, response, args} = createHandlerMocks();
+      await assert.rejects(
+        executeWebMcpTool(args).handler(
+          {
+            params: {toolName: 'test_tool', input: '[]'},
+            page,
+          },
+          response,
+          context,
+        ),
+        {message: /Parsed input is not an object/},
+      );
+    });
+
     it('throws if input is invalid', async () => {
       await withMcpContext(
         async (response, context, args) => {
```

---

### Incident Patch 5: `ae0aaef8` (2026-09-25)
**Commit Message**: fix: reject --blockedUrlPattern/--allowedUrlPattern hostname regexp groups (#2796)

## Problem

`--blockedUrlPattern`/`--allowedUrlPattern` accept any URLPattern
string, including hostnames that use a regexp group (for example
`*://(127\.\d+\.\d+\.\d+):*/*`, meant to cover a whole IP range). That
pattern is enforced correctly by the target-attach check
(`TargetManager#isUrlAllowed`, using the real `URLPattern.test()`), but
the actual network-level blocking runs through the CDP command
`Network.emulateNetworkConditionsByRule`, passing the raw pattern string
as `NetworkConditions.urlPattern`. That command's native matching does
not apply the pattern consistently on redirects, so a page allowed to
load can redirect straight through a blocked host range while an
exact-hostname pattern stays blocked in both cases.

Root-caused and written up in more detail on #2777.

This isn't something fixable from this repo's side (the mismatch is
between the documented CDP `urlPattern` semantics and the underlying
Chromium implementation for `emulateNetworkConditionsByRule`, not in
`puppeteer-core` or `chrome-devtools-mcp`), so instead of leaving the
gap silent, this rejects patterns this repo can't

**File**: `docs/configuration.md` (modified, +2/-2)
```diff
@@ -168,11 +168,11 @@ The Chrome DevTools MCP server supports the following configuration option:
   - **Type:** number
 
 - **`--blockedUrlPattern`/ `--blocked-url-pattern`**
-  Restricts browser's network access by blocking specified URL patterns (uses https://urlpattern.spec.whatwg.org/). Silently detaches from targets with blocked URLs upon connection, and blocks runtime requests (including navigations and subresources). Accepts an array of patterns.
+  Restricts browser's network access by blocking specified URL patterns (uses https://urlpattern.spec.whatwg.org/). Silently detaches from targets with blocked URLs upon connection, and blocks runtime requests (including navigations and subresources). Accepts an array of patterns. A pattern that uses a regexp group in any component (for example `(127\.\d+\.\d+\.\d+)` in the hostname) is rejected, because it is not enforced on redirects or subresources; use an exact value or a `*`/`:name` wildcard instead.
   - **Type:** array
 
 - **`--allowedUrlPattern`/ `--allowed-url-pattern`**
-  Restricts browser's network access by allowing only specified URL patterns (uses https://urlpattern.spec.whatwg.org/). Requires Chrome 149+. Silently detaches from targets with unallowed URLs upon connection, and blocks runtime requests (including navigations and subresources). Accepts an array of patterns.
+  Restricts browser's network access by allowing only specified URL patterns (uses https://urlpattern.spec.whatwg.org/). Requires Chrome 149+. Silently detaches from targets with unallowed URLs upon connection, and blocks runtime requests (including navigations and subresources). Accepts an array of patterns. A pattern that uses a regexp group in any component (for example `(127\.\d+\.\d+\.\d+)` in the hostname) is rejected, because it is not enforced on redirects or subresources; use an exact value or a `*`/`:name` wildcard instead.
   - **Type:** array
 
 - **`--performanceCrux`/ `--performance-crux`**
```

**File**: `src/config/mcp-options.ts` (modified, +28/-2)
```diff
@@ -12,6 +12,8 @@ import path from 'node:path';
 
 export const DEFAULT_FILESYSTEM_ROOT = [os.tmpdir()];
 
+import {findUnenforceablePattern} from '../utils/url.js';
+
 import {getCategoryOptions} from './category-options.js';
 import {getBrowserOptions} from './browser-options.js';
 
@@ -132,15 +134,39 @@ export const mcpOptions = {
     type: 'array',
     string: true,
     describe:
-      "Restricts browser's network access by blocking specified URL patterns (uses https://urlpattern.spec.whatwg.org/). Silently detaches from targets with blocked URLs upon connection, and blocks runtime requests (including navigations and subresources). Accepts an array of patterns.",
+      "Restricts browser's network access by blocking specified URL patterns (uses https://urlpattern.spec.whatwg.org/). Silently detaches from targets with blocked URLs upon connection, and blocks runtime requests (including navigations and subresources). Accepts an array of patterns. A pattern that uses a regexp group in any component (for example `(127\\.\\d+\\.\\d+\\.\\d+)` in the hostname) is rejected, because it is not enforced on redirects or subresources; use an exact value or a `*`/`:name` wildcard instead.",
     conflicts: ['allowedUrlPattern'],
+    coerce: (arg: string[] | undefined) => {
+      if (arg === undefined) {
+        return undefined;
+      }
+      const pattern = findUnenforceablePattern(arg);
+      if (pattern) {
+        throw new Error(
+          `Invalid --blockedUrlPattern "${pattern}": a regexp group is not enforced on redirects or subresources. Use an exact value or a "*"/":name" wildcard instead.`,
+        );
+      }
+      return arg;
+    },
   },
   allowedUrlPattern: {
     type: 'array',
     string: true,
     describe:
-      "Restricts browser's network access by allowing only specified URL patterns (uses https://urlpattern.spec.whatwg.org/). Requires Chrome 149+. Silently detaches from targets with unallowed URLs upon connection, and blocks runtime requests (including navigations and subresources). Accepts an array of patterns.",
+      "Restricts browser's network access by allowing only specified URL patterns (uses https://urlpattern.spec.whatwg.org/). Requires Chrome 149+. Silently detaches from targets with unallowed URLs upon connection, and blocks runtime requests (including navigations and subresources). Accepts an array of patterns. A pattern that uses a regexp group in any component (for example `(127\\.\\d+\\.\\d+\\.\\d+)` in the hostname) is rejected, because it is not enforced on redirects or subresources; use an exact value or a `*`/`:name` wildcard instead.",
     conflicts: ['blockedUrlPattern'],
+    coerce: (arg: string[] | undefined) => {
+      if (arg === undefined) {
+        return undefined;
+      }
+      const pattern = findUnenforceablePattern(arg);
+      if (pattern) {
+        throw new Error(
+          `Invalid --allowedUrlPattern "${pattern}": a regexp group is not enforced on redirects or subresources. Use an exact value or a "*"/":name" wildcard instead.`,
+        );
+      }
+      return arg;
+    },
   },
   performanceCrux: {
     type: 'boolean',
```

**File**: `src/utils/url.ts` (modified, +27/-0)
```diff
@@ -112,6 +112,33 @@ export function isAllowedUrl(
 
 const DISALLOWED_PROTOCOLS = new Set(['javascript:', 'data:', 'vbscript:']);
 
+/**
+ * Finds the first pattern that uses a URLPattern regexp group (for example
+ * `(127\.\d+\.\d+\.\d+)`) in any component -- protocol, username, password,
+ * hostname, port, pathname, search, or hash. Chromium's
+ * `SimpleUrlPatternMatcher::Component::Create` rejects any component whose
+ * `HasRegexGroups()` is true and silently drops the rule, so
+ * `Network.emulateNetworkConditionsByRule` does not enforce these patterns
+ * on redirects or subresources, unlike the initial navigation check. A plain
+ * wildcard (`*`) or named group (`:name`) has no regexp group and is
+ * unaffected.
+ *
+ * @param patterns The `--blockedUrlPattern`/`--allowedUrlPattern` values to check.
+ * @returns The first unenforceable pattern, or undefined if all are safe.
+ * @throws Error if a pattern's syntax is invalid (via `new URLPattern`).
+ */
+export function findUnenforceablePattern(
+  patterns: string[],
+): string | undefined {
+  for (const raw of patterns) {
+    const parsed = new URLPattern(raw);
+    if (parsed.hasRegExpGroups) {
+      return raw;
+    }
+  }
+  return undefined;
+}
+
 /**
  * Validates a URL string by parsing it with `new URL` and checking for disallowed protocols and restricted schemes.
  *
```

**File**: `tests/cli.test.ts` (modified, +44/-0)
```diff
@@ -425,6 +425,50 @@ describe('cli args parsing', () => {
     ]);
   });
 
+  it('rejects a blocked-url-pattern with a regexp group', async () => {
+    assert.throws(
+      () =>
+        parseArguments([
+          String.raw`--blocked-url-pattern=*://(127\.\d+\.\d+\.\d+):*/*`,
+        ]),
+      /Invalid --blockedUrlPattern .*a regexp group is not enforced/,
+    );
+
+    assert.throws(
+      () =>
+        parseArguments([
+          '--blocked-url-pattern=https://a.com/*',
+          String.raw`--blocked-url-pattern=*://example.com/(foo|bar)`,
+        ]),
+      /Invalid --blockedUrlPattern .*a regexp group is not enforced/,
+    );
+  });
+
+  it('rejects an allowed-url-pattern with a regexp group', async () => {
+    assert.throws(
+      () =>
+        parseArguments([
+          String.raw`--allowed-url-pattern=*://(127\.\d+\.\d+\.\d+):*/*`,
+        ]),
+      /Invalid --allowedUrlPattern .*a regexp group is not enforced/,
+    );
+
+    assert.throws(
+      () =>
+        parseArguments([
+          '--allowed-url-pattern=https://a.com/*',
+          String.raw`--allowed-url-pattern=(http|https)://example.com/*`,
+        ]),
+      /Invalid --allowedUrlPattern .*a regexp group is not enforced/,
+    );
+  });
+
+  it('rejects a blocked-url-pattern with invalid syntax', async () => {
+    assert.throws(() =>
+      parseArguments(['--blocked-url-pattern=*://example.com/(unterminated']),
+    );
+  });
+
   it('parses source-maps flag', async () => {
     const defaultParsed = parseArguments(['main.js']);
     assert.strictEqual(defaultParsed.sourceMaps, true);
```

**File**: `tests/utils/url.test.ts` (modified, +89/-1)
```diff
@@ -7,7 +7,12 @@
 import assert from 'node:assert';
 import {describe, it} from 'node:test';
 
-import {isAllowedUrl, isLocalhost, validateUrl} from '../../src/utils/url.js';
+import {
+  findUnenforceablePattern,
+  isAllowedUrl,
+  isLocalhost,
+  validateUrl,
+} from '../../src/utils/url.js';
 
 describe('isLocalhost', () => {
   it('should return true for valid localhost and loopback URLs', () => {
@@ -429,3 +434,86 @@ describe('isAllowedUrl', () => {
     );
   });
 });
+
+describe('findUnenforceablePattern', () => {
+  it('flags a hostname regexp group', () => {
+    assert.strictEqual(
+      findUnenforceablePattern([String.raw`*://(127\.\d+\.\d+\.\d+):*/*`]),
+      String.raw`*://(127\.\d+\.\d+\.\d+):*/*`,
+    );
+  });
+
+  it('returns the first offending pattern among several', () => {
+    assert.strictEqual(
+      findUnenforceablePattern([
+        '*://127.0.0.1:*/*',
+        '*://*.example.com/*',
+        String.raw`*://(localhost|127\.0\.0\.1):*/*`,
+      ]),
+      String.raw`*://(localhost|127\.0\.0\.1):*/*`,
+    );
+  });
+
+  it('allows an exact hostname', () => {
+    assert.strictEqual(
+      findUnenforceablePattern(['*://127.0.0.1:*/*']),
+      undefined,
+    );
+  });
+
+  it('allows a wildcard hostname', () => {
+    assert.strictEqual(
+      findUnenforceablePattern(['*://*.example.com/*']),
+      undefined,
+    );
+  });
+
+  it('allows a named group hostname', () => {
+    assert.strictEqual(
+      findUnenforceablePattern(['*://:sub.example.com/*']),
+      undefined,
+    );
+  });
+
+  it('flags a regexp group in the pathname', () => {
+    assert.strictEqual(
+      findUnenforceablePattern(['*://example.com/(foo|bar)']),
+      '*://example.com/(foo|bar)',
+    );
+  });
+
+  it('flags a regexp group in the protocol', () => {
+    assert.strictEqual(
+      findUnenforceablePattern(['(http|https)://example.com/*']),
+      '(http|https)://example.com/*',
+    );
+  });
+
+  it('flags a regexp group in the port', () => {
+    assert.strictEqual(
+      findUnenforceablePattern(['*://example.com:(80|443)/*']),
+      '*://example.com:(80|443)/*',
+    );
+  });
+
+  it('flags a regexp group in the search or hash', () => {
+    assert.strictEqual(
+      findUnenforceablePattern(['*://example.com/*?(foo|bar)']),
+      '*://example.com/*?(foo|bar)',
+    );
+    assert.strictEqual(
+      findUnenforceablePattern(['*://example.com/*#(foo|bar)']),
+      '*://example.com/*#(foo|bar)',
+    );
+  });
+
+  it('throws for a pattern that fails to construct', () => {
+    assert.throws(() =>
+      findUnenforceablePattern(['*://example.com/(unterminated']),
+    );
+  });
+
+  it('returns undefined for an empty list', () => {
+    assert.strictEqual(findUnenforceablePattern([]), undefined);
+  });
+});
```

---

### Incident Patch 6: `adfc1ffa` (2026-09-25)
**Commit Message**: fix: set empty filePath to undefined instead of empty string (#2836)

closes #2825

**File**: `src/ToolHandler.ts` (modified, +8/-2)
```diff
@@ -74,7 +74,10 @@ function isPageScopedTool(
 async function validateAndResolvePathOrUrl(
   filePathOrUrl: string,
   context: McpContext,
-): Promise<string> {
+): Promise<string | undefined> {
+  if (filePathOrUrl.trim().length === 0) {
+    return undefined;
+  }
   try {
     const url = new URL(filePathOrUrl);
     if (url.protocol === 'file:') {
@@ -130,7 +133,10 @@ async function validateToolFiles(
         const updated: unknown[] = [];
         for (const item of val) {
           if (typeof item === 'string') {
-            updated.push(await validateAndResolvePathOrUrl(item, context));
+            const resolved = await validateAndResolvePathOrUrl(item, context);
+            if (resolved !== undefined) {
+              updated.push(resolved);
+            }
           } else {
             throw new Error(
               'Unexpected non-string value as a file path or URL',
```

**File**: `tests/ToolHandler.test.ts` (modified, +50/-0)
```diff
@@ -26,6 +26,7 @@ import {
   type ToolDefinition,
 } from '../src/tools/ToolDefinition.js';
 import {createTools} from '../src/tools/tools.js';
+import {createMockMcpContext} from './mocks.js';
 import {getMockBrowser} from './utils.js';
 import {Mutex} from '../src/third_party/index.js';
 
@@ -1120,4 +1121,53 @@ describe('ToolHandler', () => {
       filePath: canonicalFilePath,
     });
   });
+
+  it('skips validation and clears empty or whitespace-only file paths in params', async () => {
+    let receivedParams: Record<string, unknown> | undefined;
+    const tool: ToolDefinition = {
+      name: 'file_tool',
+      description: 'A tool with file verification',
+      annotations: {
+        category: ToolCategory.DEBUGGING,
+        readOnlyHint: false,
+      },
+      schema: {
+        filePath: zod.string().optional(),
+        filePaths: zod.array(zod.string()).optional(),
+      },
+      blockedByDialog: false,
+      verifyFilesSchema: {
+        filePath: true,
+        filePaths: true,
+      },
+      handler: async request => {
+        receivedParams = request.params;
+      },
+    };
+
+    const mockContext = createMockMcpContext();
+    mockContext.browser = getMockBrowser();
+    const serverArgs = parseArguments('1.0.0', ['node', 'script.js'], {
+      CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: 'true',
+    });
+
+    const toolHandler = new ToolHandler(
+      tool,
+      serverArgs,
+      async () => mockContext,
+      new Mutex(),
+    );
+
+    const result = await toolHandler.handle({
+      filePath: '     ',
+      filePaths: ['   ', ''],
+    });
+
+    assert.strictEqual(result.isError, undefined);
+    sinon.assert.notCalled(mockContext.validatePath);
+    assert.deepStrictEqual(receivedParams, {
+      filePath: undefined,
+      filePaths: [],
+    });
+  });
 });
```

---

### Incident Patch 7: `9624e64a` (2026-09-24)
**Commit Message**: fix: better config support for chrome-devtools CLI (#2819)

**File**: `src/bin/chrome-devtools.ts` (modified, +12/-40)
```diff
@@ -35,7 +35,7 @@ import {commands} from '../config/cli-options.js';
 import {
   mcpOptions,
   parseArguments,
-  getMcpOptionsForViaCli,
+  getCliOptions,
 } from '../config/mcp-options.js';
 
 await checkForUpdates(
@@ -44,25 +44,18 @@ await checkForUpdates(
 
 const DEFAULT_CLI_ARGS = ['--viaCli'];
 
-async function start(args: string[], sessionId: string) {
+async function start(args: string[], sessionId: string, stopExisting = false) {
   const combinedArgs = [...DEFAULT_CLI_ARGS, ...args];
+  const parsedArgs = parseArguments(VERSION, [
+    process.execPath,
+    process.argv[1],
+    ...combinedArgs,
+  ]);
+  if (stopExisting && isDaemonRunning(sessionId)) {
+    await stopDaemon(sessionId);
+  }
   await startDaemon(combinedArgs, sessionId);
-  logDisclaimers(parseArguments(VERSION, combinedArgs));
-}
-
-function getCliOptions() {
-  const options: Partial<typeof mcpOptions> = {
-    ...getMcpOptionsForViaCli(),
-  };
-
-  // Missing CLI serialization.
-  delete options.viewport;
-
-  // Change the defaults for the CLI.
-  delete options.experimentalStructuredContent;
-  delete options.experimentalInteropTools;
-
-  return options;
+  logDisclaimers(parsedArgs);
 }
 
 const y = yargs(hideBin(process.argv))
@@ -135,29 +128,8 @@ y.command(
       )
       .strict(),
   async argv => {
-    if (isDaemonRunning(argv.sessionId)) {
-      await stopDaemon(argv.sessionId);
-    }
-    // Defaults but we do not want to affect the yargs conflict resolution.
-    if (
-      argv.isolated === undefined &&
-      argv.userDataDir === undefined &&
-      !argv.autoConnect &&
-      !argv.browserUrl &&
-      !argv.wsEndpoint
-    ) {
-      argv.isolated = true;
-    }
-    if (
-      argv.headless === undefined &&
-      !argv.autoConnect &&
-      !argv.browserUrl &&
-      !argv.wsEndpoint
-    ) {
-      argv.headless = true;
-    }
     const args = serializeArgs(getCliOptions(), argv);
-    await start(args, argv.sessionId);
+    await start(args, argv.sessionId, /* stopExisting= */ true);
     process.exit(0);
   },
 ).strict(); // Re-enable strict validation for other commands; this is applied to the yargs instance itself
```

**File**: `src/config/mcp-options.ts` (modified, +56/-7)
```diff
@@ -8,6 +8,7 @@ import type {YargsOptions} from '../third_party/index.js';
 import {yargs, hideBin} from '../third_party/index.js';
 import os from 'node:os';
 import {readFileSync} from 'node:fs';
+import path from 'node:path';
 
 export const DEFAULT_FILESYSTEM_ROOT = [os.tmpdir()];
 
@@ -273,6 +274,12 @@ export const mcpOptions = {
   config: {
     type: 'string',
     describe: 'Path to JSON configuration file.',
+    coerce: (configPath: string | undefined) => {
+      if (!configPath) {
+        return;
+      }
+      return path.resolve(configPath);
+    },
   },
 } satisfies Record<string, YargsOptions>;
 
@@ -317,6 +324,36 @@ export function getMcpOptionsForViaCli(): typeof mcpOptions {
   };
 }
 
+export function getCliOptions(): Partial<
+  Record<keyof typeof mcpOptions, YargsOptions>
+> {
+  const options: Partial<Record<keyof typeof mcpOptions, YargsOptions>> = {
+    ...getMcpOptionsForViaCli(),
+  };
+
+  // Missing CLI serialization.
+  delete options.viewport;
+
+  // Change the defaults for the CLI.
+  delete options.experimentalStructuredContent;
+  delete options.experimentalInteropTools;
+
+  const recordOptions: Record<string, YargsOptions | undefined> = options;
+  for (const [key, option] of Object.entries(recordOptions)) {
+    if (option?.default !== undefined) {
+      const copy: YargsOptions = {
+        ...option,
+        defaultDescription:
+          option.defaultDescription ?? JSON.stringify(option.default),
+      };
+      delete copy.default;
+      recordOptions[key] = copy;
+    }
+  }
+
+  return options;
+}
+
 /**
  * Exported only for testing to not trigger process exit.
  */
@@ -337,13 +374,25 @@ export function parser(
     .options(options)
     .showHelpOnFail(false, 'Specify --help for available options')
     .middleware(args => {
-      if (isViaCli && args.filesystemRoot === DEFAULT_FILESYSTEM_ROOT) {
-        const cliFilesystemArgs: {
-          allowUnrestrictedPaths?: boolean;
-          filesystemRoot?: unknown;
-        } = args;
-        cliFilesystemArgs.allowUnrestrictedPaths = true;
-        cliFilesystemArgs.filesystemRoot = undefined;
+      if (isViaCli) {
+        if (args.filesystemRoot === DEFAULT_FILESYSTEM_ROOT) {
+          const cliFilesystemArgs: {
+            allowUnrestrictedPaths?: boolean;
+            filesystemRoot?: unknown;
+          } = args;
+          cliFilesystemArgs.allowUnrestrictedPaths = true;
+          cliFilesystemArgs.filesystemRoot = undefined;
+        }
+        // Defaults that cannot be set in options without affecting yargs conflict resolution.
+        if (
+          args.isolated === undefined &&
+          args.userDataDir === undefined &&
+          !args.autoConnect &&
+          !args.browserUrl &&
+          !args.wsEndpoint
+        ) {
+          args.isolated = true;
+        }
       }
       // We can't set default in the options else
       // Yargs will complain
```

**File**: `tests/cli.test.ts` (modified, +53/-0)
```diff
@@ -5,12 +5,14 @@
  */
 
 import assert from 'node:assert';
+import path from 'node:path';
 import {describe, it} from 'node:test';
 
 import {buildCommand} from '../src/config/cli-commands.js';
 import {commands} from '../src/config/cli-options.js';
 import {
   DEFAULT_FILESYSTEM_ROOT,
+  getCliOptions,
   mcpOptions,
   parser,
 } from '../src/config/mcp-options.js';
@@ -61,6 +63,7 @@ describe('cli args parsing', () => {
     const args = parseArguments(['--viaCli']);
     assert.strictEqual(args.allowUnrestrictedPaths, true);
     assert.strictEqual(args.headless, true);
+    assert.strictEqual(args.isolated, true);
     assert.strictEqual(args.memoryDebugging, true);
     assert.strictEqual(args.categoryExtensions, true);
     assert.strictEqual(args.experimentalStructuredContent, true);
@@ -501,6 +504,33 @@ describe('cli args parsing', () => {
     assert.deepStrictEqual(args.viewport, {width: 800, height: 600});
   });
 
+  it('resolves relative config path and respects config with viaCli', async () => {
+    using testConfig = createTempFile(
+      JSON.stringify({
+        userDataDir: '/tmp/custom-profile',
+        headless: false,
+      }),
+      'cd4a.test.config.viacli.json',
+    );
+    const relativePath = path.relative(process.cwd(), testConfig.path);
+    const args = parseArguments(['--viaCli', '--config', relativePath]);
+    assert.strictEqual(args.config, testConfig.path);
+    assert.strictEqual(args.userDataDir, '/tmp/custom-profile');
+    assert.strictEqual(args.isolated, undefined);
+    assert.strictEqual(args.headless, false);
+  });
+
+  it('respects isolated=false in config with viaCli', async () => {
+    using testConfig = createTempFile(
+      JSON.stringify({
+        isolated: false,
+      }),
+      'cd4a.test.config.viacli-isolated.json',
+    );
+    const args = parseArguments(['--viaCli', '--config', testConfig.path]);
+    assert.strictEqual(args.isolated, false);
+  });
+
   it('parses config should not allow no prefix', async () => {
     using testConfig = createTempFile(
       JSON.stringify({
@@ -533,6 +563,29 @@ describe('cli args parsing', () => {
     const args = parseArguments(['--devtoolsComments']);
     assert.strictEqual(args.devtoolsComments, true);
   });
+
+  it('clears default values and populates defaultDescription in getCliOptions', () => {
+    const cliOptions = getCliOptions();
+
+    assert.strictEqual(cliOptions.viewport, undefined);
+    assert.strictEqual(cliOptions.experimentalStructuredContent, undefined);
+    assert.strictEqual(cliOptions.experimentalInteropTools, undefined);
+
+    for (const [key, option] of Object.entries(cliOptions)) {
+      assert.strictEqual(
+        option && 'default' in option,
+        false,
+        `Expected 'default' property for ${key} to be omitted`,
+      );
+    }
+
+    assert.strictEqual(cliOptions.headless?.defaultDescription, 'true');
+    assert.strictEqual(cliOptions.memoryDebugging?.defaultDescription, 'true');
+    assert.strictEqual(
+      cliOptions.filesystemRoot?.defaultDescription,
+      'OS temp directory',
+    );
+  });
 });
 
 describe('cli command strings', () => {
```

**File**: `tests/e2e/chrome-devtools-start-stop.test.ts` (modified, +57/-0)
```diff
@@ -13,6 +13,7 @@ import {
   assertDaemonIsNotRunning,
   assertDaemonIsRunning,
   createTempDir,
+  createTempFile,
   runCli,
 } from '../utils.js';
 
@@ -111,4 +112,60 @@ describe('chrome-devtools', () => {
       `workspace was not forwarded: ${statusResult.stdout}`,
     );
   });
+
+  it('can start the daemon with a config file', async () => {
+    using userDataDir = createTempDir('chrome-devtools-config-profile-');
+    using configFile = createTempFile(
+      JSON.stringify({
+        userDataDir: userDataDir.path,
+        headless: true,
+      }),
+      'chrome-devtools-config.json',
+    );
+
+    const relativeConfigPath = path.relative(process.cwd(), configFile.path);
+    const startResult = await runCli(
+      ['start', '--config', relativeConfigPath],
+      sessionId,
+    );
+    assert.strictEqual(
+      startResult.status,
+      0,
+      `start command failed: ${startResult.stderr}`,
+    );
+
+    const statusResult = await runCli(['status'], sessionId);
+    assert.strictEqual(statusResult.status, 0);
+    assert.ok(
+      statusResult.stdout.includes(
+        JSON.stringify(`--config=${configFile.path}`),
+      ),
+      `resolved config path was not forwarded: ${statusResult.stdout}`,
+    );
+    assert.ok(
+      !statusResult.stdout.includes('--headless'),
+      `default --headless should not be forwarded when not specified on CLI: ${statusResult.stdout}`,
+    );
+    assert.ok(
+      !statusResult.stdout.includes('--filesystem-root'),
+      `default --filesystem-root should not be forwarded when not specified on CLI: ${statusResult.stdout}`,
+    );
+
+    const overrideResult = await runCli(
+      ['start', '--config', relativeConfigPath, '--headless'],
+      sessionId,
+    );
+    assert.strictEqual(
+      overrideResult.status,
+      0,
+      `start command with --headless override failed: ${overrideResult.stderr}`,
+    );
+
+    const overrideStatusResult = await runCli(['status'], sessionId);
+    assert.strictEqual(overrideStatusResult.status, 0);
+    assert.ok(
+      overrideStatusResult.stdout.includes('"--headless"'),
+      `explicit --headless CLI flag was not forwarded: ${overrideStatusResult.stdout}`,
+    );
+  });
 });
```

---

### Incident Patch 8: `d7c9b554` (2026-09-23)
**Commit Message**: fix(build): resolve node export conditions in rollup bundle (#2814)

pkce-challenge (a dependency of @modelcontextprotocol/client) defines
package.json exports with only 'browser' and 'node' conditions and no
'default' condition. Because @rollup/plugin-node-resolve defaults to
['default', 'module', 'import'], it failed to resolve pkce-challenge
during 'npm run bundle'. Rollup then emitted an UNRESOLVED_IMPORT
warning and left an unbundled external 'import "pkce-challenge"' in
build/src/third_party/index.js, causing the published npm package to
fail at runtime with ERR_MODULE_NOT_FOUND.

Configure nodeResolve with exportConditions: ['node'] and
preferBuiltins: true, mark optional @puppeteer/browsers peer
dependencies (proxy-agent, yauzl) as external, and fail the Rollup build
on any UNRESOLVED_IMPORT warning.

Closes https://github.com/ChromeDevTools/chrome-devtools-mcp/issues/2813

**File**: `rollup.config.js` (modified, +23/-3)
```diff
@@ -293,8 +293,19 @@ const bundleDependency = (
     listBundledDeps(),
     commonjs(),
     json(),
-    nodeResolve(),
+    nodeResolve({
+      exportConditions: ['node'],
+      preferBuiltins: true,
+    }),
   ],
+  onwarn(warning, warn) {
+    if (warning.code === 'UNRESOLVED_IMPORT') {
+      throw new Error(
+        `Unresolved import: ${warning.message}. All third-party dependencies must be bundled or explicitly marked as external.`,
+      );
+    }
+    warn(warning);
+  },
   external,
 });
 
@@ -305,10 +316,19 @@ export default [
       inlineDynamicImports: true,
     },
     (source, importer, _isResolved) => {
+      const normalizedImporter = importer?.replaceAll('\\', '/');
       if (
         source === 'yargs' &&
-        importer &&
-        importer.includes('puppeteer-core')
+        normalizedImporter &&
+        normalizedImporter.includes('puppeteer-core')
+      ) {
+        return true;
+      }
+
+      if (
+        (source === 'proxy-agent' || source === 'yauzl') &&
+        normalizedImporter &&
+        normalizedImporter.includes('@puppeteer/browsers')
       ) {
         return true;
       }
```

**File**: `tests/third_party_notices.test.js.snapshot` (modified, +30/-0)
```diff
@@ -1155,6 +1155,36 @@ The above copyright notice and this permission notice shall be included in all c
 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 
 
+-------------------- DEPENDENCY DIVIDER --------------------
+
+Name: pkce-challenge
+URL: https://github.com/crouchcd/pkce-challenge#readme
+Version: <VERSION>
+License: MIT
+
+MIT License
+
+Copyright (c) 2019 
+
+Permission is hereby granted, free of charge, to any person obtaining a copy
+of this software and associated documentation files (the "Software"), to deal
+in the Software without restriction, including without limitation the rights
+to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
+copies of the Software, and to permit persons to whom the Software is
+furnished to do so, subject to the following conditions:
+
+The above copyright notice and this permission notice shall be included in all
+copies or substantial portions of the Software.
+
+THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
+IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
+FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
+AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
+LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
+OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
+SOFTWARE.
+
+
 -------------------- DEPENDENCY DIVIDER --------------------
 
 Name: uri-js
```

---

### Incident Patch 9: `2250cdcd` (2026-09-23)
**Commit Message**: docs: fix categories not being configured correclty (#2807)

**File**: `docs/configuration.md` (modified, +25/-0)
```diff
@@ -4,6 +4,16 @@ The Chrome DevTools MCP server supports the following configuration option:
 
 <!-- BEGIN AUTO GENERATED OPTIONS -->
 
+- **`--categoryInput`/ `--category-input`**
+  Set to false to exclude tools related to input.
+  - **Type:** boolean
+  - **Default:** `true`
+
+- **`--categoryNavigation`/ `--category-navigation`**
+  Set to false to exclude tools related to navigation.
+  - **Type:** boolean
+  - **Default:** `true`
+
 - **`--categoryEmulation`/ `--category-emulation`**
   Set to false to exclude tools related to emulation.
   - **Type:** boolean
@@ -19,6 +29,11 @@ The Chrome DevTools MCP server supports the following configuration option:
   - **Type:** boolean
   - **Default:** `true`
 
+- **`--categoryDebugging`/ `--category-debugging`**
+  Set to false to exclude tools related to debugging.
+  - **Type:** boolean
+  - **Default:** `true`
+
 - **`--categoryExtensions`/ `--category-extensions`**
   Set to true to include tools related to extensions. Note: This feature is currently only supported with a pipe connection. autoConnect, browserUrl, and wsEndpoint are not supported with this feature until 149 will be released.
   - **Type:** boolean
@@ -29,6 +44,16 @@ The Chrome DevTools MCP server supports the following configuration option:
   - **Type:** boolean
   - **Default:** `false`
 
+- **`--categoryMemory`/ `--category-memory`**
+  Set to false to exclude tools related to memory.
+  - **Type:** boolean
+  - **Default:** `true`
+
+- **`--categoryExperimentalWebmcp`/ `--category-experimental-webmcp`**
+  Set to true to enable debugging WebMCP tools. Requires Chrome 150+ with the following flag: `--enable-features=WebMCP`
+  - **Type:** boolean
+  - **Default:** `false`
+
 - **`--categoryPwa`/ `--category-pwa`**
   Set to true to include tools for automating Progressive Web Apps (install, launch, uninstall, and OS state). This feature is only supported with a pipe connection; autoConnect, browserUrl, and wsEndpoint are not supported.
   - **Type:** boolean
```

**File**: `src/config/category-options.ts` (modified, +13/-4)
```diff
@@ -30,8 +30,12 @@ const categoryOverrides: Record<
     offByDefault?: boolean;
   }
 > = {
-  [ToolCategory.INPUT]: {},
-  [ToolCategory.NAVIGATION]: {},
+  [ToolCategory.INPUT]: {
+    hidden: false,
+  },
+  [ToolCategory.NAVIGATION]: {
+    hidden: false,
+  },
   [ToolCategory.EMULATION]: {
     hidden: false,
   },
@@ -41,12 +45,17 @@ const categoryOverrides: Record<
   [ToolCategory.NETWORK]: {
     hidden: false,
   },
-  [ToolCategory.DEBUGGING]: {},
-  [ToolCategory.MEMORY]: {},
+  [ToolCategory.DEBUGGING]: {
+    hidden: false,
+  },
+  [ToolCategory.MEMORY]: {
+    hidden: false,
+  },
   [ToolCategory.WEBMCP]: {
     describe:
       'Set to true to enable debugging WebMCP tools. Requires Chrome 150+ with the following flag: `--enable-features=WebMCP`',
     offByDefault: true,
+    hidden: false,
   },
   [ToolCategory.EXTENSIONS]: {
     describe:
```

---

### Incident Patch 10: `266112b9` (2026-09-22)
**Commit Message**: fix: handle JavaScript dialogs opened during input tool actions (#2794)

Locator actions time out while the page is blocked by a JavaScript
dialog, even though the action was dispatched and opened that dialog.
That surfaced as an error contradicting the "Call handle_dialog to
handle it before continuing" hint in the same response. These are now
reported as an interruption instead of a failure, and `fill_form` stops
rather than trying to fill the remaining elements against a blocked
page.

**File**: `src/McpPage.ts` (modified, +1/-1)
```diff
@@ -461,7 +461,7 @@ export class McpPage implements ContextPage {
   }
 
   waitForEventsAfterAction(
-    action: () => Promise<unknown>,
+    action: (signal: AbortSignal) => Promise<unknown>,
     options?: {
       timeout?: number;
       waitForStableDom?: boolean;
```

**File**: `src/third_party/index.ts` (modified, +2/-0)
```diff
@@ -46,6 +46,8 @@ export type ShapeOutput<T extends zod.ZodRawShape> = zod.output<
 
 export {default as ajv} from 'ajv';
 export {
+  Dialog,
+  ElementHandle,
   Locator,
   PredefinedNetworkConditions,
   KnownDevices,
```

**File**: `src/tools/ToolDefinition.ts` (modified, +1/-1)
```diff
@@ -379,7 +379,7 @@ export type ContextPage = Readonly<{
   clearDialog(): void;
   throwIfDialogOpen(): void;
   waitForEventsAfterAction(
-    action: () => Promise<unknown>,
+    action: (signal: AbortSignal) => Promise<unknown>,
     options?: {
       timeout?: number;
       waitForStableDom?: boolean;
```

**File**: `src/tools/input.ts` (modified, +182/-80)
```diff
@@ -4,7 +4,6 @@
  * SPDX-License-Identifier: Apache-2.0
  */
 
-import type {McpContext} from '../McpContext.js';
 import {TimeoutError, zod} from '../third_party/index.js';
 import type {ElementHandle, KeyInput} from '../third_party/index.js';
 import type {TextSnapshotNode} from '../types.js';
@@ -33,7 +32,18 @@ const submitKeySchema = zod
     'Optional key to press after typing. E.g., "Enter", "Tab", "Escape"',
   );
 
-function handleActionError(error: unknown, uid: string) {
+/**
+ * Locator actions abort or time out while the page is blocked by a JavaScript
+ * dialog, even though the action itself was dispatched and opened that dialog.
+ * The open dialog is already reported in the response, so treat this as an
+ * interruption instead of a failure.
+ */
+function handleActionError(error: unknown, uid: string, page: ContextPage) {
+  if (page.getDialog()) {
+    logger?.('action interrupted by a dialog', error);
+    return;
+  }
+
   logger?.('failed to act using a locator', error);
   const reason =
     error instanceof TimeoutError
@@ -49,7 +59,10 @@ function handleActionError(error: unknown, uid: string) {
   );
 }
 
-async function selectNativeSelectOption(handle: ElementHandle<Element>) {
+async function selectNativeSelectOption(
+  handle: ElementHandle<Element>,
+  signal: AbortSignal,
+) {
   using selectHandle = await handle.evaluateHandle(node => {
     if (!(node instanceof HTMLOptionElement)) {
       return null;
@@ -82,7 +95,7 @@ async function selectNativeSelectOption(handle: ElementHandle<Element>) {
   if (typeof value !== 'string') {
     return false;
   }
-  await select.asLocator().fill(value);
+  await select.asLocator().fill(value, {signal});
 
   return true;
 }
@@ -112,18 +125,21 @@ export const click = definePageTool(() => ({
     const shouldSelectNativeOption =
       !request.params.dblClick && aXNode?.role === 'option';
     try {
-      const result = await request.page.waitForEventsAfterAction(async () => {
-        if (
-          shouldSelectNativeOption &&
-          (await selectNativeSelectOption(handle))
-        ) {
-          return;
-        }
-
-        await handle.asLocator().click({
-          count: request.params.dblClick ? 2 : 1,
-        });
-      });
+      const result = await request.page.waitForEventsAfterAction(
+        async signal => {
+          if (
+            shouldSelectNativeOption &&
+            (await selectNativeSelectOption(handle, signal))
+          ) {
+            return;
+          }
+
+          await handle.asLocator().click({
+            count: request.params.dblClick ? 2 : 1,
+            signal,
+          });
+        },
+      );
       response.appendResponseLine(
         request.params.dblClick
           ? `Successfully double clicked on the element`
@@ -134,7 +150,12 @@ export const click = definePageTool(() => ({
         response.includeSnapshot();
       }
     } catch (error) {
-      handleActionError(error, uid);
+      handleActionError(error, uid, request.page);
+      response.appendResponseLine(
+        request.params.dblClick
+          ? `The element was double clicked and it opened a dialog.`
+          : `The element was clicked and it opened a dialog.`,
+      );
     }
   },
 }));
@@ -195,20 +216,50 @@ export const hover = definePageTool(() => ({
     const uid = request.params.uid;
     using handle = await request.page.getElementByUid(uid);
     try {
-      const result = await request.page.waitForEventsAfterAction(async () => {
-        await handle.asLocator().hover();
-      });
+      const result = await request.page.waitForEventsAfterAction(
+        async signal => {
+          await handle.asLocator().hover({signal});
+        },
+      );
       response.appendResponseLine(`Successfully hovered over the element`);
       response.attachWaitForResult(result);
       if (request.params.includeSnapshot) {
         response.includeSnapshot();
       }
     } catch (error) {
-      handleActionError(error, 
```

**File**: `src/utils/WaitForHelper.ts` (modified, +11/-8)
```diff
@@ -100,6 +100,9 @@ export class WaitForHelper {
   }
 
   timeout(time: number): Promise<void> {
+    if (this.#abortController.signal.aborted) {
+      return Promise.resolve();
+    }
     return new Promise<void>(res => {
       const id = setTimeout(res, time);
       this.#abortController.signal.addEventListener('abort', () => {
@@ -110,7 +113,7 @@ export class WaitForHelper {
   }
 
   async waitForEventsAfterAction(
-    action: () => Promise<unknown>,
+    action: (signal: AbortSignal) => Promise<unknown>,
     options?: {
       timeout?: number;
       waitForStableDom?: boolean;
@@ -127,16 +130,12 @@ export class WaitForHelper {
     ) => {
       this.#dialogDetected = true;
 
-      if (!options?.handleDialog) {
-        return;
-      }
-
       let actionToTake: DialogAction | undefined;
 
-      if (typeof options.handleDialog === 'object') {
+      if (typeof options?.handleDialog === 'object') {
         actionToTake = options.handleDialog[dialog.type()];
       } else {
-        actionToTake = options.handleDialog;
+        actionToTake = options?.handleDialog;
       }
 
       if (actionToTake) {
@@ -148,6 +147,10 @@ export class WaitForHelper {
         } else {
           void dialog.accept(actionToTake);
         }
+      } else {
+        this.#abortController.abort(
+          new Error('Action interrupted by a dialog'),
+        );
       }
     };
     this.#page.on('dialog', dialogHandler);
@@ -231,7 +234,7 @@ export class WaitForHelper {
       });
 
     try {
-      await action();
+      await action(this.#abortController.signal);
     } catch (error) {
       // Clear up pending promises
       this.#abortController.abort();
```

#### Recent Merged Pull Requests:
- **PR #2872** (closed): refactor: pass the config locator as the second ConfigParser argument (@Lightning00Blade)
- **PR #2871** (closed): feat: allow turning off config file discovery via env variable (@Lightning00Blade)
- **PR #2870** (closed): feat: add --watchConfig to apply config file changes without restarting (@Lightning00Blade)
- **PR #2869** (closed): feat: apply configuration changes to a running server (@Lightning00Blade)
- **PR #2868** (closed): feat: discover the config file in predefined locations (@Lightning00Blade)
- **PR #2867** (closed): refactor: rename screenshot options to tool options (@Lightning00Blade)
- **PR #2866** (closed): refactor: register only the tools of the current slim mode (@Lightning00Blade)
- **PR #2865** (closed): refactor: keep registered tool handles in McpServer (@Lightning00Blade)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
