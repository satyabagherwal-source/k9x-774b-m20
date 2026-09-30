# Forensic Learning Record (Deep Inspection): bytedance/UI-TARS-desktop

> **Canonical Artifact**: `07_PROJECT_LEARNING/bytedance-ui-tars-desktop-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bytedance/UI-TARS-desktop](https://github.com/bytedance/UI-TARS-desktop))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:26:50.846Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bytedance/UI-TARS-desktop`
- **Description**: The Open-Source Multimodal AI Agent Stack: Connecting Cutting-Edge AI Models and Agent Infra
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 39172 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.lintstagedrc.mjs`
```
/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
export default {
  '*': ['secretlint'],
  '**/*.{ts,tsx}': ['prettier --write'],
  'src/{main,preload}/**/*.{ts,tsx}': [() => 'npm run typecheck:node'],
  'src/renderer/**/*.{ts,tsx}': [() => 'npm run typecheck:web'],
};

```

### Core Architecture Module: `.prettierrc.mjs`
```
/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
export default {
  arrowParens: 'always',
  bracketSameLine: false,
  bracketSpacing: true,
  semi: true,
  experimentalTernaries: false,
  singleQuote: true,
  jsxSingleQuote: false,
  quoteProps: 'as-needed',
  trailingComma: 'all',
  singleAttributePerLine: false,
  htmlWhitespaceSensitivity: 'css',
  vueIndentScriptAndStyle: false,
  proseWrap: 'preserve',
  insertPragma: false,
  requirePragma: false,
  tabWidth: 2,
  useTabs: false,
  embeddedLanguageFormatting: 'auto',
  endOfLine: 'auto',
  // importOrder: [
  //   '^node:(.*)$',
  //   '<THIRD_PARTY_MODULES>',
  //   '^@ui-tars/(.*)$',
  //   '^@main/(.*)$',
  //   '^@shared/(.*)$',
  //   '^@renderer/(.*)$',
  //   '^@resources/(.*)$',
  //   '^[./]',
  // ],
  // importOrderSeparation: true,
  // importOrderSortSpecifiers: true,
  // https://github.com/trivago/prettier-plugin-sort-imports/issues/229
  // plugins: ['@trivago/prettier-plugin-sort-imports'],
};

```

### Core Architecture Module: `apps/ui-tars/e2e/execBack.ts`
```
/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
// import { execute } from '@main/agent/execute';
// import { PredictionParsed } from '@ui-tars/shared/types';

// const screenWidth = 1310;
// const screenHeight = 813;
// const predictions: PredictionParsed[] = [
//   {
//     action_type: 'click',
//     action_inputs: {
//       start_box: '[0.256,0.431,0.256,0.431]',
//     },
//     reflection: 'reflection',
//     thought: 'thought',
//   },
//   {
//     action_type: 'type',
//     action_inputs: {
//       content: 'www.doubao.com',
//     },
//     reflection: 'reflection',
//     thought: 'thought',
//   },
// ];

// (async () => {
//   for (const prediction of predictions) {
//     await execute({
//       prediction,
//       screenWidth,
//       screenHeight,
//     });
//   }
// })();

```

### Core Architecture Module: `apps/ui-tars/electron.vite.config.ts`
```
/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import {
  defineConfig,
  externalizeDepsPlugin,
  bytecodePlugin,
} from 'electron-vite';
import tsconfigPaths from 'vite-tsconfig-paths';

import pkg from './package.json';
import { getExternalPkgs } from './scripts/getExternalPkgs';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  main: {
    define: {
      'process.env.UI_TARS_APP_PRIVATE_KEY_BASE64': JSON.stringify(
        process.env.UI_TARS_APP_PRIVATE_KEY_BASE64,
      ),
    },
    build: {
      outDir: 'dist/main',
      lib: {
        entry: './src/main/main.ts',
      },
      rollupOptions: {
        output: {
          manualChunks(id): string | void {
            // IMPORTANT: can't change the name of the chunk, avoid private key leak
            if (id.includes('app_private')) {
              return 'app_private';
            }
          },
        },
      },
    },
    plugins: [
      bytecodePlugin({
        chunkAlias: 'app_private',
        protectedStrings: [process.env.UI_TARS_APP_PRIVATE_KEY_BASE64!],
      }),
      tsconfigPaths(),
      externalizeDepsPlugin({
        include: [...getExternalPkgs()],
      }),
      {
        name: 'native-node-module-path',
        enforce: 'pre',
        resolveId(source) {
          if (source.includes('screencapturepermissions.node')) {
            return {
              id: '@computer-use/mac-screen-capture-permissions/build/Release/screencapturepermissions.node',
              external: true,
            };
          }
          return null;
        },
      },
    ],
  },
  preload: {
    build: {
      outDir: 'dist/preload',
      lib: {
        entry: './src/preload/index.ts',
      },
    },
    plugins: [tsconfigPaths()],
  },
  renderer: {
    root: 'src/renderer',
    build: {
      outDir: 'dist/renderer',
      rollupOptions: {
        input: {
          main: resolve('./src/renderer/index.html'),
        },
      },
      minify: true,
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern',
        },
      },
    },
    plugins: [react(), tsconfigPaths(), tailwindcss()],
    define: {
      APP_VERSION: JSON.stringify(pkg.version),
    },
    resolve: {
      alias: {
        crypto: resolve(__dirname, 'src/renderer/src/polyfills/crypto.ts'),
      },
    },
  },
});

```

### Core Architecture Module: `apps/ui-tars/forge.config.ts`
```
/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import fs, { readdirSync } from 'node:fs';
import { cp, readdir } from 'node:fs/promises';
import path, { resolve } from 'node:path';

import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import setLanguages from 'electron-packager-languages';
import { rimraf, rimrafSync } from 'rimraf';

import pkg from './package.json';
import { getExternalPkgs } from './scripts/getExternalPkgs';
import {
  getModuleRoot,
  getExternalPkgsDependencies,
  hooks,
} from '@common/electron-build';

const keepModules = new Set([
  ...getExternalPkgs(),
  '@computer-use/mac-screen-capture-permissions',
]);
const needSubDependencies = ['@computer-use/node-mac-permissions', 'sharp'];
const ignorePattern = new RegExp(
  `^/node_modules/(?!${[...keepModules].join('|')})`,
);
const unpack = `**/node_modules/{@img,${[...keepModules].join(',')}}/**/*`;

console.log('keepModules', Object.keys(pkg.dependencies));
console.log('needSubDependencies', needSubDependencies);
const keepLanguages = new Set(['en', 'en_GB', 'en-US', 'en_US']);
const noopAfterCopy = (
  _buildPath,
  _electronVersion,
  _platform,
  _arch,
  callback,
) => callback();

const enableOsxSign =
  process.env.APPLE_ID &&
  process.env.APPLE_PASSWORD &&
  process.env.APPLE_TEAM_ID;

// remove folders & files not to be included in the app
async function cleanSources(
  buildPath,
  _electronVersion,
  platform,
  _arch,
  callback,
) {
  // folders & files to be included in the app
  const appItems = new Set([
    'dist',
    'node_modules',
    'package.json',
    'resources',
  ]);

  if (platform === 'darwin' || platform === 'mas') {
    const frameworkResourcePath = resolve(
      buildPath,
      '../../Frameworks/Electron Framework.framework/Versions/A/Resources',
    );

    for (const file of readdirSync(frameworkResourcePath)) {
      if (file.endsWith('.lproj') && !keepLanguages.has(file.split('.')[0]!)) {
        rimrafSync(resolve(frameworkResourcePath, file));
      }
    }
  }

  // Keep only node_modules to be included in the app
  await Promise.all([
    ...(await readdir(buildPath).then((items) =>
      items
        .filter((item) => !appItems.has(item))
        .map((item) => rimraf(path.join(buildPath, item))),
    )),
    ...(await readdir(path.join(buildPath, 'node_modules')).then((items) =>
      items
        .filter((item) => !keepModules.has(item))
        .map((item) => rimraf(path.join(buildPath, 'node_modules', item))),
    )),
  ]);

  const projectRoot = path.resolve(__dirname, '.');

  await Promise.all(
    Array.from(keepModules.values()).map((item) => {
      // Check is exist
      if (fs.existsSync(path.join(buildPath, 'node_modules', item))) {
        // eslint-disable-next-line array-callback-return
        return;
      }

      try {
        const moduleRoot = getModuleRoot(projectRoot, item);

        if (fs.existsSync(moduleRoot)) {
          return cp(moduleRoot, path.join(buildPath, 'node_modules', item), {
            recursive: true,
          });
        }
      } catch (error) {
        console.error('copy_current_node_modules_error', error);
        return;
      }

      return;
    }),
  );

  const subDependencies = await getExternalPkgsDependencies(
    needSubDependencies,
    projectRoot,
  );
  await Promise.all(
    Array.from(subDependencies.values()).map((subDependency) => {
      if (
        fs.existsSync(path.join(buildPath, 'node_modules', subDependency.name))
      ) {
        return;
      }

      if (fs.existsSync(subDependency.path)) {
        return cp(
          subDependency.path,
          path.join(buildPath, 'node_modules', subDependency.name),
          {
            recursive: true,
          },
        );
      }
      return;
    }),
  );

  callback();
}

console.log('ignorePattern', ignorePattern);

const config: ForgeConfig = {
  packagerConfig: {
    name: 'UI TARS',
    icon: 'resources/icon',
    extraResource: ['./resources/app-update.yml'],
    asar: {
      unpack,
    },
    ignore: [ignorePattern],
    prune: false,
    afterCopy: [
      cleanSources,
      process.platform !== 'win32'
        ? noopAfterCopy
        : setLanguages([...keepLanguages.values()]),
    ],
    executableName: 'UI-TARS',
    ...(enableOsxSign
      ? {
          osxSign: {
            keychain: process.env.KEYCHAIN_PATH,
            optionsForFile: () => ({
              entitlements: 'build/entitlements.mac.plist',
            }),
          },
          osxNotarize: {
            appleId: process.env.APPLE_ID!,
            appleIdPassword: process.env.APPLE_PASSWORD!,
            teamId: process.env.APPLE_TEAM_ID!,
          },
        }
      : {}),
  },
  rebuildConfig: {},
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: { owner: 'bytedance', name: 'ui-tars-desktop' },
        draft: true,
        force: true,
        generateReleaseNotes: true,
      },
    },
  ],
  makers: [
    new MakerZIP({}, ['darwin']),
    new MakerSquirrel({
      // CamelCase version without spaces
      name: 'UiTars',
      setupIcon: 'resources/icon.ico',
    }),
    // https://github.com/electron/forge/issues/3712
    new MakerDMG({
      overwrite: true,
      background: 'static/dmg-background.png',
      // icon: 'static/dmg-icon.icns',
      iconSize: 160,
      format: 'UDZO',
      additionalDMGOptions: { window: { size: { width: 660, height: 400 } } },
      contents: (opts) => [
        { x: 180, y: 170, type: 'file', path: opts.appPath },
        { x: 480, y: 170, type: 'link', path: '/Applications' },
      ],
    }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    // https://github.com/microsoft/playwright/issues/28669#issuecomment-2268380066
    ...(process.env.CI === 'e2e'
      ? []
      : [
          new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
          }),
        ]),
  ],
  hooks: {
    postMake: async (forgeConfig, makeResults) => {
      return await hooks.postMake?.(forgeConfig, makeResults);
    },
  },
};

export default config;

```

### Core Architecture Module: `apps/ui-tars/playwright.config.ts`
```
/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  use: {
    trace: 'on-first-retry',
  },
  timeout: 60000,
});

```

### Core Architecture Module: `apps/ui-tars/scripts/getExternalPkgs.ts`
```
import pkg from '../package.json';

export const getExternalPkgs = () => {
  const { platform } = process;
  return [
    ...Object.keys(pkg.dependencies),
    ...(platform === 'darwin'
      ? ['@computer-use/libnut-darwin']
      : platform === 'win32'
        ? ['@computer-use/libnut-win32']
        : platform === 'linux'
          ? ['@computer-use/libnut-linux']
          : []),
  ];
};

```

### Core Architecture Module: `apps/ui-tars/src/main/agent/operator.ts`
```
/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Key, keyboard } from '@computer-use/nut-js';
import {
  type ScreenshotOutput,
  type ExecuteParams,
  type ExecuteOutput,
} from '@ui-tars/sdk/core';
import { NutJSOperator } from '@ui-tars/operator-nut-js';
import { clipboard } from 'electron';
import { desktopCapturer } from 'electron';

import * as env from '@main/env';
import { logger } from '@main/logger';
import { sleep } from '@ui-tars/shared/utils';
import { getScreenSize } from '@main/utils/screen';

export class NutJSElectronOperator extends NutJSOperator {
  static MANUAL = {
    ACTION_SPACES: [
      `click(start_box='[x1, y1, x2, y2]')`,
      `left_double(start_box='[x1, y1, x2, y2]')`,
      `right_single(start_box='[x1, y1, x2, y2]')`,
      `drag(start_box='[x1, y1, x2, y2]', end_box='[x3, y3, x4, y4]')`,
      `hotkey(key='')`,
      `type(content='') #If you want to submit your input, use "\\n" at the end of \`content\`.`,
      `scroll(start_box='[x1, y1, x2, y2]', direction='down or up or right or left')`,
      `wait() #Sleep for 5s and take a screenshot to check for any changes.`,
      `finished()`,
      `call_user() # Submit the task and call the user when the task is unsolvable, or when you need the user's help.`,
    ],
  };

  public async screenshot(): Promise<ScreenshotOutput> {
    const {
      physicalSize,
      logicalSize,
      scaleFactor,
      id: primaryDisplayId,
    } = getScreenSize(); // Logical = Physical / scaleX

    logger.info(
      '[screenshot] [primaryDisplay]',
      'logicalSize:',
      logicalSize,
      'scaleFactor:',
      scaleFactor,
    );

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(logicalSize.width),
        height: Math.round(logicalSize.height),
      },
    });
    const primarySource =
      sources.find(
        (source) => source.display_id === primaryDisplayId.toString(),
      ) || sources[0];

    if (!primarySource) {
      logger.error('[screenshot] Primary display source not found', {
        primaryDisplayId,
        availableSources: sources.map((s) => s.display_id),
      });
      // fallback to default screenshot
      return await super.screenshot();
    }

    const screenshot = primarySource.thumbnail;

    const resized = screenshot.resize({
      width: physicalSize.width,
      height: physicalSize.height,
    });

    return {
      base64: resized.toJPEG(75).toString('base64'),
      scaleFactor,
    };
  }

  async execute(params: ExecuteParams): Promise<ExecuteOutput> {
    const { action_type, action_inputs } = params.parsedPrediction;

    if (action_type === 'type' && env.isWindows && action_inputs?.content) {
      const content = action_inputs.content?.trim();

      logger.info('[device] type', content);
      const stripContent = content.replace(/\\n$/, '').replace(/\n$/, '');
      const originalClipboard = clipboard.readText();
      clipboard.writeText(stripContent);
      await keyboard.pressKey(Key.LeftControl, Key.V);
      await sleep(50);
      await keyboard.releaseKey(Key.LeftControl, Key.V);
      await sleep(50);
      clipboard.writeText(originalClipboard);
    } else {
      return await super.execute(params);
    }
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1822** (2026-02-27): **[Bug Report]: AgentRunner [Stream] Error in agent loop execution: TypeError: Cannot read properties of undefined (reading 'models')**
  *Symptoms*: ### Version  0.3.0  ### Issue Type  - [ ] Select a issue type 👇 - [ ] Agent TARS Web UI (`@agent-tars/web-ui`) - [ ] Agent TARS CLI (`@agent-tars/server`) - [x] Agent TARS Server (`@agent-tars/server`) - [ ] Agent TARS (`@agent-tars/core`) - [ ] MCP Agent (`@tarko/mcp-agent`) - [ ] Agent Kernel (`@tarko/agent`) - [ ] Other (please specify in description)  ### Model Provider  - [ ] Select a model provider 👇 - [ ] Volcengine - [ ] Anthropic - [ ] OpenAI - [ ] Azure OpenAI - [x] Other (please specify in description)  ### Problem Description  agent-tars --model.provider kimi --model.id kimi-k2.5 --model.displayName kimi k2.5 --model.apiKey xxxx --model.baseURL https://api.moonshot.cn/v1 --stream 启动正常，|   🎉  @agent-tars/core  is available at: http://localhost:8888   | |                                                                  | |   📁 Workspace: ~/e/ai/UI-TARS-desktop                           | |                                                                  | |   🤖 Model: kimi | kimi-k2.5   在浏览器输入提示词，直接报标题的错  ### Error Logs  Return initializationEvents [] AgentRunner [Stream] Error in agent loop execution: TypeError: Cannot read properties of undefined (reading 'models')

- **Issue #1814** (2026-02-13): **[Bug Report]: 顺利安装，但是操作浏览器功能十次有九次是失败的**
  *Symptoms*: ### Version  0.3  ### Issue Type  - [ ] Select a issue type 👇 - [ ] Agent TARS Web UI (`@agent-tars/web-ui`) - [ ] Agent TARS CLI (`@agent-tars/server`) - [ ] Agent TARS Server (`@agent-tars/server`) - [ ] Agent TARS (`@agent-tars/core`) - [ ] MCP Agent (`@tarko/mcp-agent`) - [ ] Agent Kernel (`@tarko/agent`) - [x] Other (please specify in description)  ### Model Provider  - [ ] Select a model provider 👇 - [ ] Volcengine - [ ] Anthropic - [ ] OpenAI - [ ] Azure OpenAI - [x] Other (please specify in description)  ### Problem Description  使用浏览器操作，经常报错：  帮我打开今日头条的新闻网站：www.toutiao.com的页面，并一直定时10秒刷新该页面，监控是否有新的要闻新闻出现，如果有的话，点开它，并向我展示内容。  EXECUTE_RETRY_ERROR: Too many action execute failures: Missing startX(739.8399999999999) or startY739.8399999999999. Error: Missing startX(739.8399999999999) or startY739.8399999999999.     at DefaultBrowserOperator.execute (F:\UI-TARS-desktop-0.3.0\apps\ui-tars\dist\main\main.js:155828:22)  就停止了。尝试了十次，只有第一次成功打开网站，后面全部要么没反应，要么报错。 等产品成熟一点再来尝试，别浪费时间。  ### Error Logs  _No response_

- **Issue #1813** (2026-02-13): **[Bug Report]: 顺利安装，但是十次有九次是失败的**
  *Symptoms*: ### Version  0.3  ### Issue Type  - [ ] Select a issue type 👇 - [ ] Agent TARS Web UI (`@agent-tars/web-ui`) - [ ] Agent TARS CLI (`@agent-tars/server`) - [ ] Agent TARS Server (`@agent-tars/server`) - [ ] Agent TARS (`@agent-tars/core`) - [ ] MCP Agent (`@tarko/mcp-agent`) - [ ] Agent Kernel (`@tarko/agent`) - [x] Other (please specify in description)  ### Model Provider  - [ ] Select a model provider 👇 - [ ] Volcengine - [ ] Anthropic - [ ] OpenAI - [ ] Azure OpenAI - [x] Other (please specify in description)  ### Problem Description  使用浏览器操作，经常报错：  帮我打开今日头条的新闻网站：www.toutiao.com的页面，并一直定时10秒刷新该页面，监控是否有新的要闻新闻出现，如果有的话，点开它，并向我展示内容。  EXECUTE_RETRY_ERROR: Too many action execute failures: Missing startX(739.8399999999999) or startY739.8399999999999. Error: Missing startX(739.8399999999999) or startY739.8399999999999.     at DefaultBrowserOperator.execute (F:\UI-TARS-desktop-0.3.0\apps\ui-tars\dist\main\main.js:155828:22)  就停止了。尝试了十次，只有第一次成功打开网站，后面全部要么没反应，要么报错。 等产品成熟一点再来尝试，别浪费时间。  ### Error Logs  _No response_

- **Issue #1626** (2025-09-24): **[Bug] webui config injection issue in agent server**
  *Symptoms*: ## Problem  The `tarko.config.ts` webui configuration is not being injected into `window.AGENT_WEB_UI_CONFIG` on the Web UI frontend.  ## Root Cause  In `multimodal/tarko/agent-cli/src/core/commands/start.ts`, the `setupUI` function has a bug in the configuration injection logic:  ```typescript // Line ~140 in setupUI function const mergedWebUIConfig = mergeWebUIConfig(webui, server);  const scriptTag = `<script>   window.AGENT_BASE_URL = "";   window.AGENT_WEB_UI_CONFIG = ${JSON.stringify(webui)}; // ❌ Bug: using original webui instead of mergedWebUIConfig   console.log("Agent: Using API baseURL:", window.AGENT_BASE_URL); </script>`; ```  ## Expected Behavior  When a user defines webui config in `tarko.config.ts`:  ```typescript export default {   webui: {     layout: {       enableSidebar: false,     },   }, }; ```  This configuration should be available in the frontend via `window.AGENT_WEB_UI_CONFIG`.  ## Actual Behavior  The merged configuration (which includes Agent constructor webui config) is calculated but not used. Only the base webui config is injected.  ## Solution  Replace the injection line:  ```typescript // Fix window.AGENT_WEB_UI_CONFIG = ${JSON.stringify(mergedWebUIConfig)}; ```  ## Impact  - Users cannot customize webui layout via tarko.config.ts - Agent constructor webui configurations are ignored - Frontend always falls back to default configuration  ## Files Affected  - `multimodal/tarko/agent-cli/src/core/commands/start.ts`

- **Issue #1493** (2025-10-01): **[Bug Report]: Docker image aio.sandbox:latest not available for public pull**
  *Symptoms*: ### Version  UI-TARS-desktop-0.3.0-beta.11  ### Issue Type  - [ ] Select a issue type 👇 - [ ] Agent TARS Web UI (`@agent-tars/web-ui`) - [ ] Agent TARS CLI (`@agent-tars/server`) - [ ] Agent TARS Server (`@agent-tars/server`) - [ ] Agent TARS (`@agent-tars/core`) - [ ] MCP Agent (`@tarko/mcp-agent`) - [ ] Agent Kernel (`@tarko/agent`) - [x] Other (please specify in description)  ### Model Provider  - [ ] Select a model provider 👇 - [x] Volcengine - [ ] Anthropic - [ ] OpenAI - [ ] Azure OpenAI - [ ] Other (please specify in description)  ### Problem Description  Hello Team 👋,  I was following the official documentation and tried to run the sandbox using Docker:  `docker pull aio.sandbox:latest`  But the image cannot be pulled:  ### Error response from daemon: pull access denied for aio.sandbox,  ### repository does not exist or may require 'docker login'   This suggests that the Docker image is either private or not published on a public registry.  👉 Could you please clarify:  Is there an official public Docker registry (Docker Hub / GHCR / Bytedance internal) for aio.sandbox:latest?  If not, can you provide the Dockerfile or instructions to build the sandbox image locally?  Alternatively, will you publish the prebuilt image in future releases?  This would help developers integrate and run the sandbox quickly without having to reverse engineer the build.  Thanks in advance 🙏  ### Error Logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > please help me 
  > See this [agent-infra/sandbox](https://github.com/agent-infra/sandbox) repository for more details.

- **Issue #1448** (2025-09-10): **[Bug]: Error loading remote config under Windows**
  *Symptoms*: ### Version  v0.2.10  ### Model  UI-TARS-1.5-7B  ### Deployment Method  Local  ### Issue Description  Steps to reproduce: 1. create global workspace with `agent-tars workspace --init` 2. update corresponding model/apiKey/id.. 3. start with `agent-tars`  ``` Error loading remote config from C:\Users\<User>\.agent-tars-workspace\agent-tars.config.ts: Only absolute URLs are supported ```  ### Error Logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > may have been fixed by #1449 

- **Issue #1424** (2025-09-07): **[Bug]: PromptEngine fails to parse incomplete tool call with JSON syntax error**
  *Symptoms*: ## Issue Description  **Expected behavior:** Agent should properly parse and execute tool calls from model responses  **Actual behavior:** Agent exits immediately without executing tools, throwing a JSON parsing error:  ``` PromptEngine Failed to parse incomplete tool call: SyntaxError: Unexpected non-whitespace character after JSON at position 3492 (line 13 column 1) ```  ## Error Details  The error occurs in the [`PromptEngineeringToolCallEngine`](https://github.com/bytedance/UI-TARS-desktop/blob/main/multimodal/tarko/agent/src/tool-call-engine/PromptEngineeringToolCallEngine.ts) when trying to parse incomplete tool call content.  ### Model Output Log  The model produces a valid streaming response with proper `<tool_call>` tags:  ```json {"id":"msg_vrtx_017ejnzszfWAPvxriigFbKfM","choices":[{"delta":{"role":"assistant"},"index":0}],"usage":{"completion_tokens":1,"prompt_tokens":23171,"total_tokens":23172}} {"id":"","choices":[{"delta":{"role":"assistant"},"index":0}]} {"id":"","choices":[{"delta":{"content":"<tool","role":"assistant"},"index":0}]} {"id":"","choices":[{"delta":{"content":"_call","role":"assistant"},"index":0}]} {"id":"","choices":[{"delta":{"content":">\n{","role":"assistant"},"index":0}]} {"id":"","choices":[{"delta":{"content":"\n  \"name","role":"assistant"},"index":0}]} {"id":"","choices":[{"delta":{"content":"\": \"edit","role":"assistant"},"index":0}]} {"id":"","choices":[{"delta":{"content":"_file","role":"assistant"},"index":0}]} {"id":"","choices":[{
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #1360 

- **Issue #1318** (2025-11-13): **[Bug]: Could not paste from clipboard:**
  *Symptoms*: ### Version  v0.2.4  ### Model  Doubao-1.5-UI-TARS  ### Deployment Method  Cloud  ### Issue Description  偶尔会报出这个错误，大部分情况下都是正常的 操作系统是windows10  ### Error Logs  [UITarsService] GUIAgent error: GUIAgentError: Command failed: F:\jzProject\ui-tars-desktop\node_modules\clipboardy\fallbacks\windows\clipboard_x86_64.exe --paste thread 'main' panicked at 'Error: Could not paste from clipboard: Error { repr: Os { code: 0, message: "操作成功完成。" } }', src\libcore\result.rs:906:4 note: Run with `RUST_BACKTRACE=1` for a backtrace.       at makeError (F:\jzProject\ui-tars-desktop\node_modules\execa\index.js:174:9)     at F:\jzProject\ui-tars-desktop\node_modules\execa\index.js:278:16     at processTicksAndRejections (node:internal/process/task_queues:95:5)     at async ClipboardClass.getContent (F:\jzProject\ui-tars-desktop\node_modules\@computer-use\nut-js\lib\clipboard.class.ts:27:21)     at async NutJSOperator.execute (webpack://@ui-tars/operator-nut-js/./src/index.ts:244:39)     at async GUIAgent.run (webpack://@ui-tars/sdk/./src/GUIAgent.ts:440:35)     at async UITarsService.executeTask (F:\jzProject\ui-tars-desktop\apps\server\src\services\UITarsService.ts:226:7)     at async TaskService.executeTask (F:\jzProject\ui-tars-desktop\apps\server\src\services\TaskService.ts:180:22)     at async TaskService.processNextTask (F:\jzProject\ui-tars-desktop\apps\server\src\services\TaskService.ts:150:7)     at async Timeout._onTimeout (F:\jzProject\ui-tars-desktop\apps\server\src\services\TaskServic
  **Post-Mortem & Fix Analysis**:
  > 你这个问题查出来是为什么了吗，我最近也遇到了这个问题，在我笔记本上是好的，家里面台式机就使用type这一步不能输入内容 

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

### Incident Patch 1: `2ff41a9e` (2026-09-24)
**Commit Message**: fix(security): validate Host header to prevent DNS rebinding in agent-server(-next) (#1975)

Co-authored-by: 陈昊励 <chenhaoli@bytedance.com>

**File**: `multimodal/tarko/agent-server-next/examples/bootstrap.ts` (modified, +2/-0)
```diff
@@ -9,6 +9,7 @@ import {
   ContextStorageHook,
   createCorsHook,
   createCsrfProtectionHook,
+  createHostValidationHook,
   SecurityHeadersHook,
 } from '../src/index';
 import { resolve } from 'path';
@@ -147,6 +148,7 @@ const logger = {
 };
 
 server.setLogger(logger);
+server.registerHook(createHostValidationHook(server.port));
 server.registerHook(SecurityHeadersHook);
 server.registerHook(AuthHook);
 server.registerHook(createCorsHook(server.port));
```

**File**: `multimodal/tarko/agent-server-next/src/hooks/builtInHooks.ts` (modified, +66/-0)
```diff
@@ -228,3 +228,69 @@ export const SecurityHeadersHook: HookRegistrationOptions = {
         c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
     },
 };
+
+/**
+ * Build the set of Host header values that this server will answer on.
+ *
+ * The CORS Origin check alone does not protect against DNS rebinding: an
+ * attacker-controlled domain (e.g. `evil.example`) can be rebound to
+ * `127.0.0.1` after the initial page load, and same-origin GET fetches from
+ * the attacker's page will arrive at the local server **without an Origin
+ * header**, bypassing the Origin allowlist. Validating that the request's
+ * `Host` header is one we actually serve catches this — a DNS-rebound request
+ * carries `Host: evil.example:<port>`, not `localhost:<port>`.
+ *
+ * Operators that deliberately expose the server to other names (e.g. behind a
+ * reverse proxy or a custom hostname) can extend the allowlist via
+ * `TARKO_ALLOWED_HOSTS` (comma-separated).
+ */
+export function buildAllowedHosts(port: number): Set<string> {
+    const allowed = new Set<string>([
+        `localhost:${port}`,
+        `127.0.0.1:${port}`,
+        `[::1]:${port}`,
+        `[::ffff:127.0.0.1]:${port}`,
+    ]);
+    const extra = process.env.TARKO_ALLOWED_HOSTS;
+    if (extra) {
+        for (const h of extra.split(',')) {
+            const trimmed = h.trim();
+            if (trimmed) allowed.add(trimmed.toLowerCase());
+        }
+    }
+    return allowed;
+}
+
+/**
+ * Create a Host header validation hook — DNS rebinding defense.
+ *
+ * Must run before the CORS hook so attacker-controlled hostnames are rejected
+ * even when the Origin header is absent (e.g. a same-origin GET from a
+ * DNS-rebound iframe at `evil.example:<port>` sends no Origin header but
+ * does send `Host: evil.example:<port>`).
+ *
+ * @param port The server port to allow in Host headers
+ */
+export function createHostValidationHook(port: number): HookRegistrationOptions {
+    const allowedHosts = buildAllowedHosts(port);
+    return {
+        id: 'host-validation',
+        name: 'Host Validation',
+        priority: BuiltInPriorities.CORS + 20, // Before CORS and SecurityHeaders
+        description: 'Rejects requests whose Host header is not in the allowlist (DNS rebinding defense)',
+        handler: async (c, next) => {
+            const host = (c.req.header('Host') || '').toLowerCase();
+            if (!host || !allowedHosts.has(host)) {
+                return c.json(
+                    {
+                        error: 'Invalid Host header',
+                        message:
+                            'Request Host header does not match the server. Set TARKO_ALLOWED_HOSTS to allow additional hostnames.',
+                    },
+                    403,
+                );
+            }
+            await next();
+        },
+    };
+}
```

**File**: `multimodal/tarko/agent-server-next/src/hooks/index.ts` (modified, +2/-0)
```diff
@@ -10,8 +10,10 @@ export {
   AuthHook,
   ContextStorageHook,
   SecurityHeadersHook,
+  buildAllowedHosts,
   createCorsHook,
   createCsrfProtectionHook,
+  createHostValidationHook,
   generateCsrfToken,
 } from './builtInHooks'
 export * from './types';
\ No newline at end of file
```

**File**: `multimodal/tarko/agent-server-next/tests/host-validation.test.ts` (added, +133/-0)
```diff
@@ -0,0 +1,133 @@
+/*
+ * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+import { describe, it, expect, beforeEach, afterEach } from 'vitest';
+import { Hono } from 'hono';
+import { buildAllowedHosts, createHostValidationHook } from '../src/hooks/builtInHooks';
+
+const PORT = 3000;
+
+describe('buildAllowedHosts', () => {
+  const ORIG_ALLOWED_HOSTS = process.env.TARKO_ALLOWED_HOSTS;
+  afterEach(() => {
+    if (ORIG_ALLOWED_HOSTS === undefined) delete process.env.TARKO_ALLOWED_HOSTS;
+    else process.env.TARKO_ALLOWED_HOSTS = ORIG_ALLOWED_HOSTS;
+  });
+
+  it('includes the four default loopback host:port pairs', () => {
+    delete process.env.TARKO_ALLOWED_HOSTS;
+    const allowed = buildAllowedHosts(PORT);
+    expect(allowed.has(`localhost:${PORT}`)).toBe(true);
+    expect(allowed.has(`127.0.0.1:${PORT}`)).toBe(true);
+    expect(allowed.has(`[::1]:${PORT}`)).toBe(true);
+    expect(allowed.has(`[::ffff:127.0.0.1]:${PORT}`)).toBe(true);
+  });
+
+  it('rejects unrelated hostnames at the same port', () => {
+    delete process.env.TARKO_ALLOWED_HOSTS;
+    const allowed = buildAllowedHosts(PORT);
+    expect(allowed.has(`evil.example:${PORT}`)).toBe(false);
+    expect(allowed.has(`localhost.evil:${PORT}`)).toBe(false);
+    expect(allowed.has(`127.0.0.1.evil:${PORT}`)).toBe(false);
+  });
+
+  it('rejects the same hostnames at a different port', () => {
+    delete process.env.TARKO_ALLOWED_HOSTS;
+    const allowed = buildAllowedHosts(PORT);
+    expect(allowed.has(`localhost:${PORT + 1}`)).toBe(false);
+    expect(allowed.has(`127.0.0.1:${PORT - 1}`)).toBe(false);
+  });
+
+  it('honors TARKO_ALLOWED_HOSTS (comma-separated, case-insensitive)', () => {
+    process.env.TARKO_ALLOWED_HOSTS = 'agent.local:3000, AGENT-2.local:3000';
+    const allowed = buildAllowedHosts(PORT);
+    expect(allowed.has('agent.local:3000')).toBe(true);
+    expect(allowed.has('agent-2.local:3000')).toBe(true);
+  });
+});
+
+describe('createHostValidationHook', () => {
+  let app: Hono;
+  const ORIG_ALLOWED_HOSTS = process.env.TARKO_ALLOWED_HOSTS;
+
+  beforeEach(() => {
+    delete process.env.TARKO_ALLOWED_HOSTS;
+    app = new Hono();
+    app.use('*', createHostValidationHook(PORT).handler as any);
+    app.get('/api/v1/sessions', (c) => c.json({ sessions: ['leak'] }, 200));
+    app.post('/api/v1/sessions/delete', (c) => c.json({ ok: true }, 200));
+  });
+
+  afterEach(() => {
+    if (ORIG_ALLOWED_HOSTS === undefined) delete process.env.TARKO_ALLOWED_HOSTS;
+    else process.env.TARKO_ALLOWED_HOSTS = ORIG_ALLOWED_HOSTS;
+  });
+
+  async function fetchWith(host: string | undefined, method = 'GET', path = '/api/v1/sessions') {
+    const headers: Record<string, string> = {};
+    if (host !== undefined) headers.Host = host;
+    return app.fetch(new Request(`http://example.test${path}`, { method, headers }));
+  }
+
+  it('allows GET with Host: localhost:<port>', async () => {
+    const res = await fetchWith(`localhost:${PORT}`);
+    expect(res.status).toBe(200);
+    expect(await res.json()).toEqual({ sessions: ['leak'] });
+  });
+
+  it('allows GET with Host: 127.0.0.1:<port>', async () => {
+    const res = await fetchWith(`127.0.0.1:${PORT}`);
+    expect(res.status).toBe(200);
+  });
+
+  it('rejects a DNS-rebinding GET (Host: evil.example:<port>) with 403', async () => {
+    // This is the core DNS-rebinding scenario: same-origin GET from an
+    // attacker-controlled domain that has been rebound to 127.0.0.1 carries
+    // Host: evil.example:<port>, not localhost:<port>. Origin would be absent
+    // (same-origin GET), so the CORS Origin check passes — Host validation is
+    // the gate that catches it.
+    const res = await fetchWith(`evil.example:${PORT}`);
+    expect(res.status).toBe(403);
+    expect(await res.json()).toMatchObject({ error: 'Invalid Host header' });
+  });
+
+  it('rejects a DNS-rebinding POST with valid CSRF (Host: evil.example:<port>)'
```

**File**: `multimodal/tarko/agent-server-next/vitest.config.mts` (modified, +0/-1)
```diff
@@ -10,6 +10,5 @@ export default defineConfig({
     globals: true,
     environment: 'node',
     testTimeout: 10000,
-    setupFiles: ['./tests/setup.ts'],
   },
 });
\ No newline at end of file
```

---

### Incident Patch 2: `d634845f` (2026-09-24)
**Commit Message**: fix(agent-server): require a token once the server leaves loopback (#2026)

**File**: `multimodal/pnpm-lock.yaml` (modified, +7/-0)
```diff
@@ -929,6 +929,9 @@ importers:
       express:
         specifier: 4.21.2
         version: 4.21.2
+      express-rate-limit:
+        specifier: ^7.5.0
+        version: 7.5.0(express@4.21.2)
       http-proxy-middleware:
         specifier: ^2.0.6
         version: 2.0.9(@types/express@4.17.22)
@@ -23189,6 +23192,10 @@ snapshots:
       jest-message-util: 29.7.0
       jest-util: 29.7.0
 
+  express-rate-limit@7.5.0(express@4.21.2):
+    dependencies:
+      express: 4.21.2
+
   express-rate-limit@7.5.0(express@5.1.0):
     dependencies:
       express: 5.1.0
```

**File**: `multimodal/tarko/agent-cli/src/config/builder.ts` (modified, +7/-2)
```diff
@@ -65,6 +65,7 @@ export function buildAppConfig<
     quiet,
     port,
     host,
+    authToken,
     stream,
     headless,
     input,
@@ -120,7 +121,7 @@ export function buildAppConfig<
 
   // Apply CLI shortcuts
   applyLoggingShortcuts(config, { debug, quiet });
-  applyServerConfiguration(config, { port, host });
+  applyServerConfiguration(config, { port, host, authToken });
 
   // Apply WebUI defaults
   applyWebUIDefaults(config as AgentAppConfig);
@@ -246,7 +247,7 @@ function parseLogLevel(level: string): LogLevel | undefined {
  */
 function applyServerConfiguration(
   config: AgentAppConfig,
-  serverOptions: { port?: number; host?: string },
+  serverOptions: { port?: number; host?: string; authToken?: string },
 ): void {
   if (!config.server) {
     config.server = {
@@ -268,6 +269,10 @@ function applyServerConfiguration(
     config.server.host = serverOptions.host;
   }
 
+  if (serverOptions.authToken) {
+    config.server.auth = { ...config.server.auth, token: serverOptions.authToken };
+  }
+
   config.server.host = resolveServerHost(config.server.host);
 }
 
```

**File**: `multimodal/tarko/agent-cli/src/core/commands/serve.ts` (modified, +4/-1)
```diff
@@ -37,11 +37,14 @@ export async function startHeadlessServer(
       `${chalk.cyan('API URL:')} ${chalk.underline(serverUrl)}`,
       '',
       `${chalk.cyan('Bound to:')} ${chalk.yellow(`${server.host}:${port}`)}${
-        isExternallyReachableHost(server.host)
+        isExternallyReachableHost(server.host) && !server.auth.required
           ? ` ${chalk.red('- reachable from the network, and unauthenticated')}`
           : ''
       }`,
       '',
+      ...(server.auth.required
+        ? [`${chalk.cyan('Access token:')} ${chalk.yellow(server.auth.token!)}`, '']
+        : []),
       `${chalk.cyan('Mode:')} ${chalk.yellow('Headless (API only)')}`,
     ].join('\n');
 
```

**File**: `multimodal/tarko/agent-cli/src/core/commands/start.ts` (modified, +25/-2)
```diff
@@ -57,6 +57,9 @@ export async function startInteractiveWebUI(
 
   const port = appConfig.server!.port!;
   const serverUrl = formatServerUrl(server.host, port);
+  // The token rides in the URL so opening the link is enough to get the web UI
+  // authenticated; it stores the value and sends it as a header from then on.
+  const webUIUrl = server.auth.required ? `${serverUrl}/?token=${server.auth.token}` : serverUrl;
 
   if (appConfig.logLevel !== LogLevel.SILENT) {
     // Define brand colors
@@ -77,10 +80,13 @@ export async function startInteractiveWebUI(
       `📁 ${chalk.gray('Workspace:')} ${brandGradient(workspaceDir)}`,
       '',
       `🔌 ${chalk.gray('Bound to:')} ${brandGradient(`${server.host}:${port}`)}${
-        isExternallyReachableHost(server.host)
+        isExternallyReachableHost(server.host) && !server.auth.required
           ? ` ${chalk.red('- reachable from the network, and unauthenticated')}`
           : ''
       }`,
+      ...(server.auth.required
+        ? ['', `🔑 ${chalk.gray('Access token:')} ${brandGradient(server.auth.token!)}`]
+        : []),
       '',
       `🤖 ${chalk.gray('Model:')} ${appConfig.model?.provider ? brandGradient(`${provider} | ${modelId}`) : chalk.gray('Not specified')}`,
     ].join('\n');
@@ -95,7 +101,24 @@ export async function startInteractiveWebUI(
       }),
     );
 
-    if (options.open) {
+    if (server.auth.required) {
+      // Outside the box on purpose: boxen clips a line that exceeds the
+      // terminal width, and a link missing the tail of its token is worse than
+      // no link at all.
+      console.log(chalk.gray('Open this link to sign the web UI in:'));
+      console.log(chalk.underline(webUIUrl));
+      console.log();
+    }
+
+    if (options.open && server.auth.required) {
+      // Handing the URL to the OS opener would put the token in a command line,
+      // which other local users can read. Leave it to the operator.
+      console.log(
+        chalk.yellow('Not opening a browser: the URL carries an access token. Open it yourself.'),
+      );
+    }
+
+    if (options.open && !server.auth.required) {
       const url = `http://localhost:${port}`;
       const command =
         process.platform === 'darwin'
```

**File**: `multimodal/tarko/agent-cli/src/core/options.ts` (modified, +13/-3)
```diff
@@ -22,9 +22,19 @@ export function addCommonOptions(command: Command): Command {
       '--host <host>',
       `Network interface to bind (default: ${DEFAULT_SERVER_HOST})
 
-                            The server exposes agent execution without authentication, so it binds
-                            loopback only by default. Pass --host 0.0.0.0 to listen on every
-                            interface, and only do so behind a proxy that authenticates requests.
+                            The server exposes agent execution, so it binds loopback only by
+                            default. Pass --host 0.0.0.0 to listen on every interface; an access
+                            token is then required, and is generated and printed if you set none.
+      `,
+    )
+    .option(
+      '--auth-token <token>',
+      `Token callers must present to reach the API
+
+                            Sent as \`Authorization: Bearer <token>\` or a \`token\` query parameter.
+                            Also read from TARKO_AUTH_TOKEN. Required once the server binds an
+                            address other machines can reach; setting it turns the check on for any
+                            bind address.
       `,
     )
     .option('--open', 'Open the web UI in the default browser on server start')
```

---

### Incident Patch 3: `0ac7c9e2` (2026-09-24)
**Commit Message**: fix(agent-ui): stop html previews from escaping their iframe sandbox (#1938)

**File**: `multimodal/tarko/agent-ui/src/common/constants/iframeSandbox.ts` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+/*
+ * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+/**
+ * Sandbox policies for frames that carry content the UI does not author.
+ *
+ * `allow-same-origin` lets a framed document keep its own origin. Whether that is safe
+ * depends entirely on what "its own origin" resolves to:
+ *
+ * - `srcdoc` documents inherit the embedder's origin, so granting it there hands the UI's
+ *   origin to the framed content. Combined with `allow-scripts` the sandbox is void and the
+ *   content can reach `parent.document`, storage and same-origin APIs.
+ * - A document loaded from a cross-origin URL keeps that remote origin, which the embedder is
+ *   already walled off from, so the flag buys the framed app its own storage without giving it
+ *   any reach into the UI.
+ */
+
+/** Preview of agent-authored HTML, always handed over through `srcDoc`: opaque origin only. */
+export const HTML_PREVIEW_SANDBOX = 'allow-scripts';
+
+/** Embedded tools (code-server, VNC) drive their own forms, popups and dialogs. */
+const EMBED_FRAME_SANDBOX = 'allow-scripts allow-forms allow-popups allow-modals';
+
+/**
+ * Sandbox for an embedded tool, decided per URL.
+ *
+ * Cross-origin `http(s)` targets keep `allow-same-origin`, because losing their origin also
+ * loses their cookies, `localStorage` and same-origin requests. Anything that could end up
+ * sharing this page's origin — a relative or same-origin URL, an unparsable one, or a scheme
+ * such as `javascript:` or `data:` that inherits or opaques the origin — gets the strict policy.
+ */
+export function resolveEmbedFrameSandbox(src: string): string {
+  try {
+    const target = new URL(src, window.location.href);
+    const isRemoteHttpOrigin =
+      (target.protocol === 'https:' || target.protocol === 'http:') &&
+      target.origin !== window.location.origin;
+
+    if (isRemoteHttpOrigin) {
+      return `${EMBED_FRAME_SANDBOX} allow-same-origin`;
+    }
+  } catch {
+    // Unparsable URL: fall through to the strict policy
+  }
+
+  return EMBED_FRAME_SANDBOX;
+}
```

**File**: `multimodal/tarko/agent-ui/src/standalone/workspace/components/FullscreenModal.tsx` (modified, +2/-1)
```diff
@@ -5,6 +5,7 @@ import { MarkdownRenderer } from '@tarko/ui';
 import { MessageContent } from './shared';
 import { FullscreenFileData } from '../types/panelContent';
 import { normalizeFilePath } from '@tarko/ui';
+import { HTML_PREVIEW_SANDBOX } from '@/common/constants/iframeSandbox';
 
 interface FullscreenModalProps {
   data: FullscreenFileData | null;
@@ -85,7 +86,7 @@ export const FullscreenModal: React.FC<FullscreenModalProps> = ({ data, onClose
                 srcDoc={data.content}
                 className="w-full h-full border-0"
                 title="HTML Preview"
-                sandbox="allow-scripts allow-same-origin"
+                sandbox={HTML_PREVIEW_SANDBOX}
                 style={{ backgroundColor: 'white' }}
               />
             </div>
```

**File**: `multimodal/tarko/agent-ui/src/standalone/workspace/components/ThrottledHtmlRenderer.tsx` (modified, +75/-87)
```diff
@@ -1,119 +1,97 @@
 import React, { useRef, useEffect, useState } from 'react';
 import { useStableValue } from '@/common/hooks/useStableValue';
+import { HTML_PREVIEW_SANDBOX } from '@/common/constants/iframeSandbox';
 
 interface ThrottledHtmlRendererProps {
   content: string;
   isStreaming?: boolean;
   className?: string;
 }
 
+/** Minimum gap between two document swaps while content is still streaming in. */
+const STREAMING_UPDATE_INTERVAL = 200;
+
+const FRAME_INDEXES = [0, 1] as const;
+
 /**
- * ThrottledHtmlRenderer - A component that renders HTML content with throttling to prevent flickering
+ * ThrottledHtmlRenderer - renders HTML content in a sandboxed iframe
  *
- * Features:
- * - Throttled updates during streaming to reduce flickering
- * - Smooth DOM replacement instead of full rebuild
- * - Automatic iframe sizing and content injection
+ * The frame is sandboxed without `allow-same-origin`, so its document lives in an opaque
+ * origin and is unreachable from here: content can only be handed over through `srcDoc`.
+ * To keep streaming updates smooth without touching the frame's DOM, two frames alternate —
+ * the next document is parsed in the hidden one and swapped in once it has loaded, so the
+ * viewer never sees a blank frame mid-stream.
  */
 export const ThrottledHtmlRenderer: React.FC<ThrottledHtmlRendererProps> = ({
   content,
   isStreaming = false,
   className = '',
 }) => {
-  const iframeRef = useRef<HTMLIFrameElement>(null);
-  const [lastRenderedContent, setLastRenderedContent] = useState('');
-  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
+  const [frameContents, setFrameContents] = useState<[string, string]>(['', '']);
+  const [visibleIndex, setVisibleIndex] = useState(0);
+
+  const frameContentsRef = useRef<[string, string]>(['', '']);
+  const visibleIndexRef = useRef(0);
+  const pendingIndexRef = useRef<number | null>(null);
+  const renderedContentRef = useRef('');
+  const lastRenderAtRef = useRef(0);
+  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 
   // Use stable content to reduce unnecessary updates
   const stableContent = useStableValue(content, (a, b) => a === b);
 
+  const showFrame = (index: number) => {
+    visibleIndexRef.current = index;
+    setVisibleIndex(index);
+  };
+
   // Throttling logic for streaming updates
   useEffect(() => {
-    if (!iframeRef.current) return;
+    if (stableContent === renderedContentRef.current) return;
 
-    // Clear any pending render
-    if (renderTimeoutRef.current) {
-      clearTimeout(renderTimeoutRef.current);
-    }
-
-    const shouldRender = () => {
-      if (stableContent === lastRenderedContent) return false;
+    const renderContent = () => {
+      renderTimeoutRef.current = null;
+      renderedContentRef.current = stableContent;
+      lastRenderAtRef.current = Date.now();
 
-      // If not streaming, render immediately
-      if (!isStreaming) return true;
+      const targetIndex = visibleIndexRef.current === 0 ? 1 : 0;
 
-      // During streaming, throttle updates to reduce flickering
-      const contentDelta = Math.abs(stableContent.length - lastRenderedContent.length);
-      const shouldThrottle = contentDelta < 100; // Only throttle small changes
+      // An unchanged srcDoc fires no load event, so nothing would trigger the swap
+      if (frameContentsRef.current[targetIndex] === stableContent) {
+        pendingIndexRef.current = null;
+        showFrame(targetIndex);
+        return;
+      }
 
-      return !shouldThrottle;
+      frameContentsRef.current =
+        targetIndex === 0
+          ? [stableContent, frameContentsRef.current[1]]
+          : [frameContentsRef.current[0], stableContent];
+      pendingIndexRef.current = targetIndex;
+      setFrameContents(frameContentsRef.current);
     };
 
-    const renderContent = () => {
-      if (!iframeRef.current || stableContent === lastRenderedContent) return;
-
-      try {
-        const if
```

**File**: `multimodal/tarko/agent-ui/src/standalone/workspace/renderers/EmbedFrameRenderer.tsx` (modified, +5/-2)
```diff
@@ -1,6 +1,7 @@
 import React, { useRef, useEffect, useState } from 'react';
 import type { StandardPanelContent } from '../types/panelContent';
 import { FileDisplayMode } from '../types';
+import { resolveEmbedFrameSandbox } from '@/common/constants/iframeSandbox';
 
 interface EmbedFrameRendererProps {
   panelContent: StandardPanelContent;
@@ -19,6 +20,8 @@ export const EmbedFrameRenderer: React.FC<EmbedFrameRendererProps> = ({
   const src =
     typeof panelContent.source === 'string' ? panelContent.source : panelContent.link || '';
 
+  const sandbox = resolveEmbedFrameSandbox(src);
+
   const handleOpenInNewTab = () => {
     if (src) {
       window.open(src, '_blank');
@@ -136,7 +139,7 @@ export const EmbedFrameRenderer: React.FC<EmbedFrameRendererProps> = ({
               className="border-0"
               style={{ width: '1280px', height: '958px' }}
               title={panelContent.title}
-              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
+              sandbox={sandbox}
               loading="lazy"
             />
           </div>
@@ -161,7 +164,7 @@ export const EmbedFrameRenderer: React.FC<EmbedFrameRendererProps> = ({
             className="border-0"
             style={{ width: '1280px', height: '958px' }}
             title={panelContent.title}
-            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
+            sandbox={sandbox}
             loading="lazy"
           />
         </div>
```

---

### Incident Patch 4: `73867bfa` (2026-09-24)
**Commit Message**: fix(docs): keep showcase pages working without the share API (#1937)

**File**: `multimodal/websites/docs/env.d.ts` (modified, +0/-7)
```diff
@@ -1,8 +1 @@
 /// <reference types="@rspress/theme-default" />
-
-// Virtual module for build-time injected showcase data
-declare module 'showcase-data' {
-  import type { ApiShareItem } from './src/services/api';
-  export const showcaseData: ApiShareItem[];
-  export const lastUpdated: string;
-}
```

**File**: `multimodal/websites/docs/package.json` (modified, +2/-1)
```diff
@@ -5,7 +5,8 @@
   "scripts": {
     "build": "rspress build",
     "dev": "rspress dev",
-    "preview": "rspress preview"
+    "preview": "rspress preview",
+    "refresh:showcase-data": "node scripts/refresh-showcase-data.mjs"
   },
   "dependencies": {
     "@rspress/core": "2.0.0-beta.34",
```

**File**: `multimodal/websites/docs/plugins/showcase-data-plugin.ts` (removed, +0/-24)
```diff
@@ -1,24 +0,0 @@
-import type { RspressPlugin } from '@rspress/core';
-
-/**
- * Rspress plugin to fetch showcase data at build time
- */
-export function showcaseDataPlugin(): RspressPlugin {
-  return {
-    name: 'showcase-data-plugin',
-    async addRuntimeModules() {
-      try {
-        const response = await fetch('https://agent-tars.toxichl1994.workers.dev/shares/public?page=1&limit=100');
-        const data = await response.json();
-        
-        return {
-          'showcase-data': `export const showcaseData = ${JSON.stringify(data.success ? data.data : [])};`,
-        };
-      } catch {
-        return {
-          'showcase-data': 'export const showcaseData = [];',
-        };
-      }
-    },
-  };
-}
```

**File**: `multimodal/websites/docs/rspress.config.ts` (modified, +0/-2)
```diff
@@ -3,7 +3,6 @@ import { defineConfig } from '@rspress/core';
 import mermaid from 'rspress-plugin-mermaid';
 
 import { SEO_CONFIG } from './src/shared/seoConfig';
-import { showcaseDataPlugin } from './plugins/showcase-data-plugin';
 
 const isProd = process.env.NODE_ENV === 'production';
 
@@ -82,7 +81,6 @@ export default defineConfig({
         fontSize: 16,
       },
     }),
-    showcaseDataPlugin(),
   ],
   themeConfig: {
     darkMode: false,
```

**File**: `multimodal/websites/docs/scripts/refresh-showcase-data.mjs` (added, +210/-0)
```diff
@@ -0,0 +1,210 @@
+#!/usr/bin/env node
+/**
+ * Rewrites the committed showcase snapshot (`src/data/showcaseShares.ts`) from the
+ * public shares API. Maintainer-only: it is deliberately kept out of `build` and
+ * `dev` so the site never needs the API to be up.
+ *
+ * Environment:
+ *   SHOWCASE_API_BASE   API origin, default is the production worker.
+ *   SHOWCASE_FETCH_VIA  Request template containing `{url}`, into which the target
+ *                       URL is substituted URL-encoded. Networks that cannot reach
+ *                       the worker directly can relay through a CORS/HTTP proxy,
+ *                       e.g. 'https://api.allorigins.win/raw?url={url}'.
+ */
+import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
+import path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+const DEFAULT_API_BASE = 'https://agent-tars.toxichl1994.workers.dev';
+const REQUEST_TIMEOUT_MS = 30_000;
+
+// Must match the ApiShareItem field order in src/shared/types.ts.
+const KNOWN_FIELDS = [
+  'sessionId',
+  'slug',
+  'url',
+  'tags',
+  'title',
+  'description',
+  'imageUrl',
+  'languages',
+  'author',
+  'authorGithub',
+  'authorTwitter',
+  'date',
+];
+const REQUIRED_FIELDS = ['sessionId', 'slug', 'url'];
+
+const scriptDir = path.dirname(fileURLToPath(import.meta.url));
+const targetFile = path.join(scriptDir, '..', 'src', 'data', 'showcaseShares.ts');
+
+function fail(message) {
+  console.error(`refresh-showcase-data: ${message}`);
+  process.exit(1);
+}
+
+function buildRequestUrl(apiUrl) {
+  const template = process.env.SHOWCASE_FETCH_VIA;
+  if (!template) return apiUrl;
+  if (!template.includes('{url}')) {
+    fail("SHOWCASE_FETCH_VIA must contain the '{url}' placeholder");
+  }
+  return template.replace('{url}', encodeURIComponent(apiUrl));
+}
+
+async function fetchShares(apiUrl) {
+  const requestUrl = buildRequestUrl(apiUrl);
+  console.log(`fetching ${requestUrl}`);
+
+  const response = await fetch(requestUrl, {
+    headers: { accept: 'application/json' },
+    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
+  });
+  if (!response.ok) {
+    throw new Error(`HTTP ${response.status} ${response.statusText}`);
+  }
+
+  const body = await response.text();
+  let payload;
+  try {
+    payload = JSON.parse(body);
+  } catch {
+    throw new Error(`response is not JSON: ${body.slice(0, 200)}`);
+  }
+
+  if (payload.success !== true) {
+    throw new Error(
+      `API reported failure: ${payload.error ?? JSON.stringify(payload).slice(0, 200)}`,
+    );
+  }
+  if (!Array.isArray(payload.data) || payload.data.length === 0) {
+    throw new Error('API returned no records; refusing to overwrite the snapshot');
+  }
+  return payload;
+}
+
+function validateRecords(records) {
+  const unknownFields = new Set();
+  records.forEach((record, index) => {
+    for (const field of REQUIRED_FIELDS) {
+      if (typeof record[field] !== 'string' || record[field].length === 0) {
+        throw new Error(`record #${index} is missing a usable '${field}'`);
+      }
+    }
+    for (const [field, value] of Object.entries(record)) {
+      if (!KNOWN_FIELDS.includes(field)) {
+        unknownFields.add(field);
+      } else if (value !== null && typeof value !== 'string') {
+        // ApiShareItem models every field as `string | null`; anything else would
+        // silently break the build instead of failing here.
+        throw new Error(
+          `record #${index} field '${field}' is ${typeof value}, expected string or null`,
+        );
+      }
+    }
+  });
+
+  if (unknownFields.size > 0) {
+    throw new Error(
+      `API returned unknown fields (${[...unknownFields].join(', ')}); ` +
+        'add them to ApiShareItem in src/shared/types.ts and to KNOWN_FIELDS here first',
+    );
+  }
+}
+
+/** Emits records verbatim: no scheme fixing, no reordering, no text rewriting. */
+function renderDataFile(records, { apiUrl, fetchedAt }) {
+  const entries = 
```

---

### Incident Patch 5: `c3347f8d` (2026-09-24)
**Commit Message**: fix(agent-server): block request-body injection into agent constructor options (#1939)

**File**: `multimodal/tarko/agent-cli/src/config/builder.ts` (modified, +13/-3)
```diff
@@ -3,7 +3,7 @@
  * SPDX-License-Identifier: Apache-2.0
  */
 
-import { deepMerge, isTest } from '@tarko/shared-utils';
+import { deepMerge, isTest, resolveServerHost } from '@tarko/shared-utils';
 import { getStaticPath } from '@tarko/agent-ui-builder';
 import {
   CommonFilterOptions,
@@ -64,6 +64,7 @@ export function buildAppConfig<
     debug,
     quiet,
     port,
+    host,
     stream,
     headless,
     input,
@@ -119,7 +120,7 @@ export function buildAppConfig<
 
   // Apply CLI shortcuts
   applyLoggingShortcuts(config, { debug, quiet });
-  applyServerConfiguration(config, { port });
+  applyServerConfiguration(config, { port, host });
 
   // Apply WebUI defaults
   applyWebUIDefaults(config as AgentAppConfig);
@@ -243,7 +244,10 @@ function parseLogLevel(level: string): LogLevel | undefined {
 /**
  * Apply server configuration with defaults
  */
-function applyServerConfiguration(config: AgentAppConfig, serverOptions: { port?: number }): void {
+function applyServerConfiguration(
+  config: AgentAppConfig,
+  serverOptions: { port?: number; host?: string },
+): void {
   if (!config.server) {
     config.server = {
       port: 8888,
@@ -259,6 +263,12 @@ function applyServerConfiguration(config: AgentAppConfig, serverOptions: { port?
   if (serverOptions.port) {
     config.server.port = serverOptions.port;
   }
+
+  if (serverOptions.host) {
+    config.server.host = serverOptions.host;
+  }
+
+  config.server.host = resolveServerHost(config.server.host);
 }
 
 /**
```

**File**: `multimodal/tarko/agent-cli/src/core/commands/run.ts` (modified, +4/-0)
```diff
@@ -5,6 +5,7 @@
 
 import { LogLevel } from '@tarko/interface';
 import { AgentServer, resolveAgentImplementation } from '@tarko/agent-server';
+import { DEFAULT_SERVER_HOST } from '@tarko/shared-utils';
 import { ConsoleInterceptor } from '../../utils';
 import { AgentCLIRunCommandOptions } from '../../types';
 
@@ -73,9 +74,12 @@ export async function processServerRun(options: AgentCLIRunCommandOptions): Prom
 
   const { appConfig } = agentServerInitOptions;
 
+  // This server only exists to serve the one-shot request issued below, so keep it
+  // on loopback regardless of any configured host.
   appConfig.server = {
     ...(appConfig.server || {}),
     port: 8899,
+    host: DEFAULT_SERVER_HOST,
   };
 
   const { result, logs } = await ConsoleInterceptor.run(
```

**File**: `multimodal/tarko/agent-cli/src/core/commands/serve.ts` (modified, +8/-1)
```diff
@@ -8,6 +8,7 @@ import { LogLevel } from '@tarko/interface';
 import { AgentCLIServeCommandOptions } from '../../types';
 import { AgentServer } from '@tarko/agent-server';
 import { ensureServerConfig } from '../../utils';
+import { formatServerUrl, isExternallyReachableHost } from '@tarko/shared-utils';
 import boxen from 'boxen';
 import chalk from 'chalk';
 
@@ -27,14 +28,20 @@ export async function startHeadlessServer(
   const httpServer = await server.start();
 
   const port = appConfig.server!.port!;
-  const serverUrl = `http://localhost:${port}`;
+  const serverUrl = formatServerUrl(server.host, port);
 
   if (appConfig.logLevel !== LogLevel.SILENT) {
     const boxContent = [
       `${chalk.bold(`${server.getCurrentAgentName()} Headless Server`)}`,
       '',
       `${chalk.cyan('API URL:')} ${chalk.underline(serverUrl)}`,
       '',
+      `${chalk.cyan('Bound to:')} ${chalk.yellow(`${server.host}:${port}`)}${
+        isExternallyReachableHost(server.host)
+          ? ` ${chalk.red('- reachable from the network, and unauthenticated')}`
+          : ''
+      }`,
+      '',
       `${chalk.cyan('Mode:')} ${chalk.yellow('Headless (API only)')}`,
     ].join('\n');
 
```

**File**: `multimodal/tarko/agent-cli/src/core/commands/start.ts` (modified, +8/-2)
```diff
@@ -17,7 +17,7 @@ import boxen from 'boxen';
 import chalk from 'chalk';
 import gradient from 'gradient-string';
 import { logger, toUserFriendlyPath, ensureServerConfig } from '../../utils';
-import { createPathMatcher } from '@tarko/shared-utils';
+import { createPathMatcher, formatServerUrl, isExternallyReachableHost } from '@tarko/shared-utils';
 import { AgentCLIRunInteractiveUICommandOptions } from '../../types';
 
 /**
@@ -56,7 +56,7 @@ export async function startInteractiveWebUI(
   }
 
   const port = appConfig.server!.port!;
-  const serverUrl = `http://localhost:${port}`;
+  const serverUrl = formatServerUrl(server.host, port);
 
   if (appConfig.logLevel !== LogLevel.SILENT) {
     // Define brand colors
@@ -76,6 +76,12 @@ export async function startInteractiveWebUI(
       '',
       `📁 ${chalk.gray('Workspace:')} ${brandGradient(workspaceDir)}`,
       '',
+      `🔌 ${chalk.gray('Bound to:')} ${brandGradient(`${server.host}:${port}`)}${
+        isExternallyReachableHost(server.host)
+          ? ` ${chalk.red('- reachable from the network, and unauthenticated')}`
+          : ''
+      }`,
+      '',
       `🤖 ${chalk.gray('Model:')} ${appConfig.model?.provider ? brandGradient(`${provider} | ${modelId}`) : chalk.gray('Not specified')}`,
     ].join('\n');
 
```

**File**: `multimodal/tarko/agent-cli/src/core/options.ts` (modified, +10/-0)
```diff
@@ -5,6 +5,7 @@
 
 import { Command } from 'cac';
 import { AgentCLIArguments, AgentImplementation } from '@tarko/interface';
+import { DEFAULT_SERVER_HOST } from '@tarko/shared-utils';
 import { AgioProvider } from '../agio/AgioProvider';
 
 export type { AgentCLIArguments };
@@ -17,6 +18,15 @@ export const DEFAULT_PORT = 8888;
 export function addCommonOptions(command: Command): Command {
   const baseCommand = command
     .option('--port <port>', 'Port to run the server on', { default: DEFAULT_PORT })
+    .option(
+      '--host <host>',
+      `Network interface to bind (default: ${DEFAULT_SERVER_HOST})
+
+                            The server exposes agent execution without authentication, so it binds
+                            loopback only by default. Pass --host 0.0.0.0 to listen on every
+                            interface, and only do so behind a proxy that authenticates requests.
+      `,
+    )
     .option('--open', 'Open the web UI in the default browser on server start')
     .option(
       '--config, -c <path>',
```

---

### Incident Patch 6: `c2ad42e3` (2026-07-01)
**Commit Message**: fix(mcp-http-server): default host to 127.0.0.1, not all interfaces (#1918)

**File**: `packages/agent-infra/mcp-http-server/README.md` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ await startSseAndStreamableHttpMcpServer({
 | Parameter | Type | Description |
 |-----------|------|-------------|
 | `port` | `number` | Port to listen on (default: 8080) |
-| `host` | `string` | Host to bind to (default: '::') |
+| `host` | `string` | Host to bind to (default: '127.0.0.1') |
 | `stateless` | `boolean` | Enable stateless mode for streamable HTTP (default: true) |
 | `middlewares` | `MiddlewareFunction[]` | Custom Express middlewares |
 | `routes` | `RoutesConfig` | Custom route configuration |
```

**File**: `packages/agent-infra/mcp-http-server/src/startServer.ts` (modified, +1/-1)
```diff
@@ -259,7 +259,7 @@ export async function startSseAndStreamableHttpMcpServer(
     },
   );
 
-  const HOST = host || '::';
+  const HOST = host || '127.0.0.1';
   const PORT = Number(port || process.env.PORT || 8080);
 
   return new Promise((resolve, reject) => {
```

**File**: `packages/agent-infra/mcp-http-server/tests/startServer-server.test.ts` (modified, +4/-4)
```diff
@@ -148,7 +148,7 @@ describe('MCP Server HTTP Server Tests', () => {
       );
 
       const transport = new SSEClientTransport(
-        new URL(`http://localhost:${port}/sse`),
+        new URL(`http://127.0.0.1:${port}/sse`),
       );
 
       await client.connect(transport);
@@ -371,7 +371,7 @@ describe('MCP Server HTTP Server Tests', () => {
 
     it('should handle health check endpoint via custom middleware', async () => {
       const response = await fetch(
-        `http://localhost:${customMiddlewarePort}/health`,
+        `http://127.0.0.1:${customMiddlewarePort}/health`,
       );
 
       expect(response.status).toBe(200);
@@ -440,7 +440,7 @@ describe('MCP Server HTTP Server Tests', () => {
       });
 
       try {
-        const response = await fetch(`http://localhost:${middlewarePort}/mcp`, {
+        const response = await fetch(`http://127.0.0.1:${middlewarePort}/mcp`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
@@ -530,7 +530,7 @@ describe('MCP Server HTTP Server Tests', () => {
 
       try {
         const response = await fetch(
-          `http://localhost:${statefulTestPort}/mcp`,
+          `http://127.0.0.1:${statefulTestPort}/mcp`,
           {
             method: 'POST',
             headers: {
```

**File**: `packages/agent-infra/mcp-servers/browser/src/index.ts` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ program
   .option('--headless', 'run browser in headless mode, headed by default')
   .option(
     '--host <host>',
-    'host to bind server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces.',
+    'host to bind server to. Default is 127.0.0.1 (loopback). Use 0.0.0.0 to bind to all interfaces.',
   )
   // .option('--ignore-https-errors', 'ignore https errors')
   // .option(
```

**File**: `packages/agent-infra/mcp-servers/commands/README.md` (modified, +4/-4)
```diff
@@ -120,8 +120,8 @@ npx @agent-infra/mcp-server-commands --port 8089
 ```
 
 You can use one of the two MCP Server remote endpoint:
-- Streamable HTTP(Recommended): `http://127.0.0.1::8089/mcp`
-- SSE: `http://127.0.0.1::8089/sse`
+- Streamable HTTP(Recommended): `http://127.0.0.1:8089/mcp`
+- SSE: `http://127.0.0.1:8089/sse`
 
 
 And then in MCP client config, set the `url` to the SSE endpoint:
@@ -130,7 +130,7 @@ And then in MCP client config, set the `url` to the SSE endpoint:
 {
   "mcpServers": {
     "commands": {
-      "url": "http://127.0.0.1::8089/sse"
+      "url": "http://127.0.0.1:8089/sse"
     }
   }
 }
@@ -143,7 +143,7 @@ And then in MCP client config, set the `url` to the SSE endpoint:
   "mcpServers": {
     "commands": {
       "type": "streamable-http", // If there is MCP Client support
-      "url": "http://127.0.0.1::8089/mcp"
+      "url": "http://127.0.0.1:8089/mcp"
     }
   }
 }
```

---

### Incident Patch 7: `7986f5ae` (2026-03-27)
**Commit Message**: fix(security): add CSRF protection, CORS whitelist, and security headers (#1853)

**File**: `multimodal/tarko/agent-server-next/examples/bootstrap.ts` (modified, +11/-2)
```diff
@@ -3,7 +3,14 @@
  * SPDX-License-Identifier: Apache-2.0
  */
 import { getContext } from 'hono/context-storage';
-import { AuthHook, CorsHook, AgentServer, ContextStorageHook } from '../src/index';
+import {
+  AuthHook,
+  AgentServer,
+  ContextStorageHook,
+  createCorsHook,
+  createCsrfProtectionHook,
+  SecurityHeadersHook,
+} from '../src/index';
 import { resolve } from 'path';
 import { ContextVariables } from '../src/types';
 
@@ -140,8 +147,10 @@ const logger = {
 };
 
 server.setLogger(logger);
+server.registerHook(SecurityHeadersHook);
 server.registerHook(AuthHook);
-server.registerHook(CorsHook);
+server.registerHook(createCorsHook(server.port));
+server.registerHook(createCsrfProtectionHook());
 server.registerHook(ContextStorageHook);
 
 console.log('🚀 Starting TARS Agent Server...');
```

**File**: `multimodal/tarko/agent-server-next/src/hooks/builtInHooks.ts` (modified, +154/-1)
```diff
@@ -3,6 +3,7 @@
  * SPDX-License-Identifier: Apache-2.0
  */
 
+import crypto from 'crypto';
 import { cors } from "hono/cors";
 import { BuiltInPriorities, HookRegistrationOptions } from "./types";
 import { accessLogMiddleware, errorHandlingMiddleware, requestIdMiddleware } from "../middlewares";
@@ -36,20 +37,89 @@ export const ContextStorageHook: HookRegistrationOptions = {
     handler: contextStorage(),
 }
 
+/**
+ * Check if an origin is allowed for CORS.
+ * Allows localhost/127.0.0.1 on the server port, file:// protocol,
+ * and any additional origins from TARKO_ALLOWED_ORIGINS env var.
+ */
+function isAllowedOrigin(origin: string, port: number): boolean {
+    const allowedOrigins = new Set([
+        `http://localhost:${port}`,
+        `http://127.0.0.1:${port}`,
+        'file://',
+    ]);
+
+    // Support additional origins via environment variable
+    const extraOrigins = process.env.TARKO_ALLOWED_ORIGINS;
+    if (extraOrigins) {
+        for (const o of extraOrigins.split(',')) {
+            const trimmed = o.trim();
+            if (trimmed) {
+                allowedOrigins.add(trimmed);
+            }
+        }
+    }
 
+    if (allowedOrigins.has(origin)) {
+        return true;
+    }
 
+    // Allow file:// origins (which may have a path suffix)
+    if (origin.startsWith('file://')) {
+        return true;
+    }
+
+    return false;
+}
+
+/**
+ * Create a CORS hook with origin whitelist based on server port.
+ * @param port The server port to allow in CORS origins
+ */
+export function createCorsHook(port: number): HookRegistrationOptions {
+    return {
+        id: 'cors',
+        name: 'CORS',
+        priority: BuiltInPriorities.CORS,
+        description: 'Cross-Origin Resource Sharing middleware with origin whitelist',
+        handler: cors({
+            origin: (origin) => {
+                if (!origin || isAllowedOrigin(origin, port)) {
+                    return origin || '*';
+                }
+                return null;
+            },
+            allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
+            allowHeaders: [
+                'Content-Type',
+                'Authorization',
+                'X-Requested-With',
+                'X-CSRF-Token',
+                'x-user-info',
+                'x-jwt-token',
+            ],
+            credentials: true,
+        }),
+    };
+}
+
+/**
+ * @deprecated Use createCorsHook(port) instead for proper origin validation.
+ * This export uses permissive CORS with ACCESS_ALLOW_ORIGIN env var fallback to '*'.
+ */
 export const CorsHook: HookRegistrationOptions = {
     id: 'cors',
     name: 'CORS',
     priority: BuiltInPriorities.CORS,
-    description: 'Cross-Origin Resource Sharing middleware',
+    description: 'Cross-Origin Resource Sharing middleware (deprecated: use createCorsHook)',
     handler: cors({
         origin: process.env.ACCESS_ALLOW_ORIGIN || '*',
         allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
         allowHeaders: [
             'Content-Type',
             'Authorization',
             'X-Requested-With',
+            'X-CSRF-Token',
             'x-user-info',
             'x-jwt-token',
         ],
@@ -75,3 +145,86 @@ export const AuthHook: HookRegistrationOptions = {
     description: 'Authentication and authorization middleware',
     handler: authMiddleware,
 }
+
+// ---- CSRF Token Management ----
+
+const CSRF_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
+const CSRF_MAX_TOKENS = 1000;
+const csrfTokenStore = new Map<string, number>();
+
+function cleanExpiredCsrfTokens(): void {
+    const now = Date.now();
+    for (const [token, expiry] of csrfTokenStore) {
+        if (expiry <= now) {
+            csrfTokenStore.delete(token);
+        }
+    }
+}
+
+export function generateCsrfToken(): string {
+    if (csrfTokenStore.size > CSRF_MAX_TOKENS) {
+        cleanExpiredCsrfTokens();
+    }
+    const token = crypto.randomBytes(32).toString('hex');
+    csrf
```

**File**: `multimodal/tarko/agent-server-next/src/hooks/index.ts` (modified, +10/-1)
```diff
@@ -4,5 +4,14 @@
  */
 
 export { HookManager } from './HookManager';
-export { CorsHook, AccessLogHook, AuthHook, ContextStorageHook } from './builtInHooks'
+export {
+  CorsHook,
+  AccessLogHook,
+  AuthHook,
+  ContextStorageHook,
+  SecurityHeadersHook,
+  createCorsHook,
+  createCsrfProtectionHook,
+  generateCsrfToken,
+} from './builtInHooks'
 export * from './types';
\ No newline at end of file
```

**File**: `multimodal/tarko/agent-server-next/src/routes/csrf.ts` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+/*
+ * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+import { Hono } from 'hono';
+import { generateCsrfToken } from '../hooks/builtInHooks';
+import type { ContextVariables } from '../types';
+
+/**
+ * Create CSRF token routes
+ */
+export function createCsrfRoutes(): Hono<{ Variables: ContextVariables }> {
+  const router = new Hono<{ Variables: ContextVariables }>();
+
+  router.get('/api/v1/csrf-token', (c) => {
+    const token = generateCsrfToken();
+    return c.json({ token });
+  });
+
+  return router;
+}
```

**File**: `multimodal/tarko/agent-server-next/src/routes/index.ts` (modified, +2/-1)
```diff
@@ -6,4 +6,5 @@
 export { createQueryRoutes } from './queries';
 export { createSessionRoutes } from './sessions';
 export { createShareRoutes } from './share';
-export { createSystemRoutes } from './system';
\ No newline at end of file
+export { createSystemRoutes } from './system';
+export { createCsrfRoutes } from './csrf';
\ No newline at end of file
```

---

### Incident Patch 8: `de904997` (2026-03-10)
**Commit Message**: fix(agent): repair unterminated strings in truncated tool call JSON (#1836)

**File**: `multimodal/tarko/agent/src/tool-call-engine/PromptEngineeringToolCallEngine.ts` (modified, +41/-12)
```diff
@@ -559,6 +559,45 @@ ${JSON.stringify(schema)}
     return trimmed;
   }
 
+  /**
+   * Repair truncated JSON by closing unterminated strings and missing braces.
+   * Handles cases where LLM output was cut off mid-string (e.g. long HTML content).
+   */
+  private repairTruncatedJson(content: string): string {
+    if (!content) return content;
+
+    let repaired = content;
+
+    // Count unescaped double quotes to detect unterminated strings
+    let inString = false;
+    for (let i = 0; i < repaired.length; i++) {
+      if (repaired[i] === '\\' && inString) {
+        i++; // skip escaped character
+        continue;
+      }
+      if (repaired[i] === '"') {
+        inString = !inString;
+      }
+    }
+
+    // Close unterminated string
+    if (inString) {
+      repaired += '"';
+      this.logger.debug('Closed unterminated string in truncated JSON');
+    }
+
+    // Close missing braces
+    const openBraces = (repaired.match(/\{/g) || []).length;
+    const closeBraces = (repaired.match(/\}/g) || []).length;
+    const missingBraces = openBraces - closeBraces;
+    if (missingBraces > 0) {
+      repaired += '}'.repeat(missingBraces);
+      this.logger.debug(`Added ${missingBraces} closing braces to complete JSON`);
+    }
+
+    return repaired;
+  }
+
   /**
    * Complete a tool call when closing tag is found
    */
@@ -618,18 +657,8 @@ ${JSON.stringify(schema)}
         // Add closing brace if it seems like valid JSON that was truncated
         let toolCallContent = this.extractCleanJsonContent(extendedState.currentToolCallBuffer);
 
-        // Attempt to repair incomplete JSON
-        if (toolCallContent && !toolCallContent.endsWith('}')) {
-          // Simple heuristic: if it looks like JSON and has opening braces, try to close them
-          const openBraces = (toolCallContent.match(/\{/g) || []).length;
-          const closeBraces = (toolCallContent.match(/\}/g) || []).length;
-          const missingBraces = openBraces - closeBraces;
-
-          if (missingBraces > 0) {
-            toolCallContent += '}'.repeat(missingBraces);
-            this.logger.debug(`Added ${missingBraces} closing braces to complete JSON`);
-          }
-        }
+        // Attempt to repair incomplete JSON (unterminated strings + missing braces)
+        toolCallContent = this.repairTruncatedJson(toolCallContent);
 
         const toolCallData = JSON.parse(toolCallContent);
 
```

---

### Incident Patch 9: `239b6544` (2026-02-27)
**Commit Message**: fix(model-provider): handle unknown providers by defaulting to openai-compatible (#1823)

**File**: `.secretlintrc.json` (modified, +14/-1)
```diff
@@ -28,7 +28,20 @@
             "pattern": "/\\b(?<key>(?:password|pass|secret|token|apiKey)(?:[_-]\\w+)?)\\b\\s*[:=]\\s*(?<value>(?!['\"]?\\s*['\"]?$)(?!\\d+\\.\\d+(?:\\.\\d+)?(?:\\s|$))\\S.*)/i"
           }
         ],
-        "allows": ["your_api_key", "YOUR_API_KEY"]
+        "allows": [
+          "your_api_key",
+          "YOUR_API_KEY",
+          "undefined",
+          "test-key",
+          "original-key",
+          "custom-key",
+          "deepseek-key",
+          "azure-key",
+          "kimi-api-key",
+          "ollama",
+          "/agentModel\\?\\.apiKey/",
+          "/defaultConfig\\.apiKey/"
+        ]
       }
     },
     { "id": "@secretlint/secretlint-rule-privatekey" }
```

**File**: `multimodal/tarko/model-provider/src/model-resolver.ts` (modified, +20/-1)
```diff
@@ -7,13 +7,32 @@ import { AgentModel, ModelProviderName, BaseModelProviderName } from './types';
 import { HIGH_LEVEL_MODEL_PROVIDER_CONFIGS } from './constants';
 import { addClaudeHeadersIfNeeded } from './claude-headers';
 import { addAzureClaudeParamsIfNeeded } from './azure-claude-params';
+import { models } from '@tarko/llm-client';
+
+/**
+ * Known base model providers from llm-client
+ */
+const KNOWN_BASE_PROVIDERS = new Set(Object.keys(models));
 
 /**
  * Get the actual provider implementation name
+ * For unknown providers (like 'kimi'), defaults to 'openai-compatible'
  */
 function getActualProvider(providerName: ModelProviderName): BaseModelProviderName {
+  // First check if there's a high-level config that extends a base provider
   const config = HIGH_LEVEL_MODEL_PROVIDER_CONFIGS.find((c) => c.name === providerName);
-  return (config?.extends || providerName) as BaseModelProviderName;
+  if (config?.extends) {
+    return config.extends;
+  }
+
+  // If the provider is a known base provider, use it directly
+  if (KNOWN_BASE_PROVIDERS.has(providerName)) {
+    return providerName as BaseModelProviderName;
+  }
+
+  // For unknown providers, default to 'openai-compatible'
+  // This handles custom providers like 'kimi' that use OpenAI-compatible APIs
+  return 'openai-compatible';
 }
 
 /**
```

**File**: `multimodal/tarko/model-provider/tests/integration.test.ts` (modified, +17/-24)
```diff
@@ -111,25 +111,17 @@ describe('Integration Tests', () => {
   describe('Claude Headers Integration', () => {
     it('should automatically add Claude headers when resolving Claude models', () => {
       // Test with Claude model
-      const claudeModel = resolveModel(
-        undefined,
-        'claude-3-sonnet',
-        'anthropic'
-      );
-      
+      const claudeModel = resolveModel(undefined, 'claude-3-sonnet', 'anthropic');
+
       expect(claudeModel.headers?.['anthropic-beta']).toBe(
-        'fine-grained-tool-streaming-2025-05-14,token-efficient-tools-2025-02-19'
+        'fine-grained-tool-streaming-2025-05-14,token-efficient-tools-2025-02-19',
       );
     });
 
     it('should not add Claude headers for non-Claude models', () => {
       // Test with non-Claude model
-      const openaiModel = resolveModel(
-        undefined,
-        'gpt-4',
-        'openai'
-      );
-      
+      const openaiModel = resolveModel(undefined, 'gpt-4', 'openai');
+
       expect(openaiModel.headers?.['anthropic-beta']).toBeUndefined();
     });
 
@@ -139,14 +131,14 @@ describe('Integration Tests', () => {
         provider: 'anthropic',
         headers: {
           'X-Custom': 'value',
-          'Authorization': 'Bearer token'
-        }
+          Authorization: 'Bearer token',
+        },
       });
-      
+
       expect(customModel.headers?.['X-Custom']).toBe('value');
       expect(customModel.headers?.['Authorization']).toBe('Bearer token');
       expect(customModel.headers?.['anthropic-beta']).toBe(
-        'fine-grained-tool-streaming-2025-05-14,token-efficient-tools-2025-02-19'
+        'fine-grained-tool-streaming-2025-05-14,token-efficient-tools-2025-02-19',
       );
     });
 
@@ -155,13 +147,13 @@ describe('Integration Tests', () => {
         'claude-3-sonnet',
         'claude-3-5-sonnet-20241022',
         'claude-3-haiku',
-        'anthropic/claude-3-opus'
+        'anthropic/claude-3-opus',
       ];
-      
-      models.forEach(modelId => {
+
+      models.forEach((modelId) => {
         const model = resolveModel(undefined, modelId, 'anthropic');
         expect(model.headers?.['anthropic-beta']).toBe(
-          'fine-grained-tool-streaming-2025-05-14,token-efficient-tools-2025-02-19'
+          'fine-grained-tool-streaming-2025-05-14,token-efficient-tools-2025-02-19',
         );
       });
     });
@@ -173,16 +165,17 @@ describe('Integration Tests', () => {
   });
 
   describe('Error handling', () => {
-    it('should handle invalid provider gracefully', () => {
-      // TypeScript should prevent this, but test runtime behavior
+    it('should handle unknown provider by falling back to openai-compatible', () => {
+      // Unknown providers (like 'kimi') should default to openai-compatible
+      // to support custom OpenAI-compatible APIs
       const resolved = resolveModel(
         undefined,
         'test-model',
         'invalid-provider' as ModelProviderName,
       );
 
       expect(resolved.provider).toBe('invalid-provider');
-      expect(resolved.baseProvider).toBe('invalid-provider'); // Falls back to same name
+      expect(resolved.baseProvider).toBe('openai-compatible'); // Falls back to openai-compatible for unknown providers
       expect(resolved.baseURL).toBeUndefined();
       expect(resolved.apiKey).toBeUndefined();
     });
```

**File**: `multimodal/tarko/model-provider/tests/model-resolver.test.ts` (modified, +24/-0)
```diff
@@ -164,4 +164,28 @@ describe('resolveModel', () => {
       baseProvider: 'azure-openai',
     });
   });
+
+  it('should handle custom OpenAI-compatible providers like kimi', () => {
+    // Test case for issue #1822: custom providers should default to openai-compatible
+    const agentModel: AgentModel = {
+      provider: 'kimi' as any, // Custom provider not in predefined list
+      id: 'kimi-k2.5',
+      displayName: 'kimi k2.5',
+      apiKey: 'kimi-api-key',
+      baseURL: 'https://api.moonshot.cn/v1',
+    };
+
+    const result = resolveModel(agentModel);
+
+    expect(result).toEqual({
+      provider: 'kimi',
+      id: 'kimi-k2.5',
+      displayName: 'kimi k2.5',
+      baseURL: 'https://api.moonshot.cn/v1',
+      apiKey: 'kimi-api-key',
+      headers: {},
+      params: undefined,
+      baseProvider: 'openai-compatible', // Should default to openai-compatible for unknown providers
+    });
+  });
 });
```

---

### Incident Patch 10: `a3cfa5f1` (2026-02-24)
**Commit Message**: docs: fix extra parenthesis in README (#1804)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -137,7 +137,7 @@ For more use cases, please check out [#842](https://github.com/bytedance/UI-TARS
 
 ### Core Features
 
-- 🖱️ **One-Click Out-of-the-box CLI** - Supports both **headful** [Web UI](https://agent-tars.com/guide/basic/web-ui.html) and **headless** [server](https://agent-tars.com/guide/advanced/server.html)) [execution](https://agent-tars.com/guide/basic/cli.html).
+- 🖱️ **One-Click Out-of-the-box CLI** - Supports both **headful** [Web UI](https://agent-tars.com/guide/basic/web-ui.html) and **headless** [server](https://agent-tars.com/guide/advanced/server.html) [execution](https://agent-tars.com/guide/basic/cli.html).
 - 🌐 **Hybrid Browser Agent** - Control browsers using [GUI Agent](https://agent-tars.com/guide/basic/browser.html#visual-grounding), [DOM](https://agent-tars.com/guide/basic/browser.html#dom), or a hybrid strategy.
 - 🔄 **Event Stream** - Protocol-driven Event Stream drives [Context Engineering](https://agent-tars.com/beta#context-engineering) and [Agent UI](https://agent-tars.com/blog/2025-06-25-introducing-agent-tars-beta.html#easy-to-build-applications).
 - 🧰 **MCP Integration** - The kernel is built on MCP and also supports mounting [MCP Servers](https://agent-tars.com/guide/basic/mcp.html) to connect to real-world tools.
```

#### Recent Merged Pull Requests:
- **PR #2026** (2026-09-24): fix(agent-server): require a token once the server leaves loopback (@ulivz)
- **PR #1983** (closed): Master (@DHaru85)
- **PR #1980** (closed): fix(mcp-filesystem): allow nested directory creation (@dvd233)
- **PR #1975** (2026-09-24): fix(security): validate Host header to prevent DNS rebinding in agent-server(-next) (@aaronjmars)
- **PR #1955** (closed): fix(operator-adb): await async ADB actions so execute() reflects device state (@OHMFOHS)
- **PR #1939** (2026-09-24): fix(agent-server): block request-body injection into agent constructor options (@ulivz)
- **PR #1938** (2026-09-24): fix(agent-ui): stop html previews from escaping their iframe sandbox (@ulivz)
- **PR #1937** (2026-09-24): fix(docs): keep showcase pages working without the share API (@ulivz)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
