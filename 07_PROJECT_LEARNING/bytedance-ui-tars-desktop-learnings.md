# Forensic Learning Record (Deep Inspection): bytedance/UI-TARS-desktop

> **Canonical Artifact**: `07_PROJECT_LEARNING/bytedance-ui-tars-desktop-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bytedance/UI-TARS-desktop](https://github.com/bytedance/UI-TARS-desktop))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:13:26.860Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bytedance/UI-TARS-desktop`
- **Description**: The Open-Source Multimodal AI Agent Stack: Connecting Cutting-Edge AI Models and Agent Infra
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 39205 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/ui-tars/src/main/electron-updater/utils.ts`
```
/**
 * The following code is modified based on
 * https://github.com/electron-userland/electron-builder/blob/master/packages/electron-updater/src/util.ts
 *
 * The MIT License (MIT)
 * Copyright (c) 2015 Loopline Systems
 * https://github.com/electron-userland/electron-builder/blob/master/LICENSE
 */

// if baseUrl path doesn't ends with /, this path will be not prepended to passed pathname for new URL(input, base)
import { URL } from 'url';

// addRandomQueryToAvoidCaching is false by default because in most cases URL already contains version number,
// so, it makes sense only for Generic Provider for channel files
export function newUrlFromBase(
  pathname: string,
  baseUrl: URL,
  addRandomQueryToAvoidCaching = false,
): URL {
  const result = new URL(pathname, baseUrl);
  // search is not propagated (search is an empty string if not specified)
  const search = baseUrl.search;
  if (search != null && search.length !== 0) {
    result.search = search;
  } else if (addRandomQueryToAvoidCaching) {
    result.search = `noCache=${Date.now().toString(32)}`;
  }
  return result;
}

export function getChannelFilename(channel: string): string {
  return `${channel}.yml`;
}

```

### Core Architecture Module: `apps/ui-tars/src/main/util.ts`
```
/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import path from 'path';
import { URL } from 'url';

import { isDev, port } from '@main/env';

export function resolveHtmlPath(htmlFileName: string) {
  if (isDev) {
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }
  return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
}

```

### Core Architecture Module: `apps/ui-tars/src/main/utils/agent.ts`
```
import { UITarsModelVersion } from '@ui-tars/shared/constants';
import {
  Operator,
  SearchEngineForSettings,
  VLMProviderV2,
} from '../store/types';
import {
  getSystemPrompt,
  getSystemPromptDoubao_15_15B,
  getSystemPromptDoubao_15_20B,
  getSystemPromptV1_5,
} from '../agent/prompts';
import {
  closeScreenMarker,
  hideScreenWaterFlow,
  hideWidgetWindow,
  showScreenWaterFlow,
  showWidgetWindow,
} from '../window/ScreenMarker';
import { hideMainWindow, showMainWindow } from '../window';
import { SearchEngine } from '@ui-tars/operator-browser';

export const getModelVersion = (
  provider: VLMProviderV2 | undefined,
): UITarsModelVersion => {
  switch (provider) {
    case VLMProviderV2.ui_tars_1_5:
      return UITarsModelVersion.V1_5;
    case VLMProviderV2.ui_tars_1_0:
      return UITarsModelVersion.V1_0;
    case VLMProviderV2.doubao_1_5:
      return UITarsModelVersion.DOUBAO_1_5_15B;
    case VLMProviderV2.doubao_1_5_vl:
      return UITarsModelVersion.DOUBAO_1_5_20B;
    default:
      return UITarsModelVersion.V1_0;
  }
};

export const getSpByModelVersion = (
  modelVersion: UITarsModelVersion,
  language: 'zh' | 'en',
  operatorType: 'browser' | 'computer',
) => {
  switch (modelVersion) {
    case UITarsModelVersion.DOUBAO_1_5_20B:
      return getSystemPromptDoubao_15_20B(language, operatorType);
    case UITarsModelVersion.DOUBAO_1_5_15B:
      return getSystemPromptDoubao_15_15B(language);
    case UITarsModelVersion.V1_5:
      return getSystemPromptV1_5(language, 'normal');
    default:
      return getSystemPrompt(language);
  }
};

export const getLocalBrowserSearchEngine = (
  engine?: SearchEngineForSettings,
) => {
  return (engine || SearchEngineForSettings.GOOGLE) as unknown as SearchEngine;
};

export const beforeAgentRun = async (operator: Operator) => {
  switch (operator) {
    case Operator.RemoteComputer:
      break;
    case Operator.RemoteBrowser:
      break;
    case Operator.LocalComputer:
      showWidgetWindow();
      showScreenWaterFlow();
      hideMainWindow();
      break;
    case Operator.LocalBrowser:
      hideMainWindow();
      showWidgetWindow();
      break;
    default:
      break;
  }
};

export const afterAgentRun = (operator: Operator) => {
  switch (operator) {
    case Operator.RemoteComputer:
      break;
    case Operator.RemoteBrowser:
      break;
    case Operator.LocalComputer:
      hideWidgetWindow();
      closeScreenMarker();
      hideScreenWaterFlow();
      showMainWindow();
      break;
    case Operator.LocalBrowser:
      hideWidgetWindow();
      showMainWindow();
      break;
    default:
      break;
  }
};

```

### Core Architecture Module: `apps/ui-tars/src/main/utils/dock.ts`
```
/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { app } from 'electron';
import { Promisable } from 'type-fest';

export const ensureDockIsShowing = async (action: () => Promisable<void>) => {
  const wasDockShowing = app.dock.isVisible();
  if (!wasDockShowing) {
    await app.dock.show();
  }

  await action();

  if (!wasDockShowing) {
    app.dock.hide();
  }
};

export const ensureDockIsShowingSync = (action: () => void) => {
  const wasDockShowing = app.dock.isVisible();
  if (!wasDockShowing) {
    app.dock.show();
  }

  action();

  if (!wasDockShowing) {
    app.dock.hide();
  }
};

```

### Core Architecture Module: `apps/ui-tars/src/main/utils/image.ts`
```
/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import sharp from 'sharp';

import { Conversation, type PredictionParsed } from '@ui-tars/shared/types';

import { logger } from '@main/logger';
import { setOfMarksOverlays } from '@main/shared/setOfMarks';

// TODO: use jimp to mark click position
export async function markClickPosition(data: {
  base64: string;
  screenshotContext: NonNullable<Conversation['screenshotContext']>;
  parsed: PredictionParsed[];
}): Promise<string> {
  if (!data?.parsed?.length) {
    return data.base64;
  }
  try {
    const imageBuffer = Buffer.from(data.base64, 'base64');
    const { overlays = [] } = setOfMarksOverlays({
      predictions: data.parsed,
      screenshotContext: data.screenshotContext,
    });
    const imageOverlays: sharp.OverlayOptions[] = overlays
      .map((o) => {
        if (o.yPos && o.xPos) {
          return {
            input: Buffer.from(o.svg),
            top: o.yPos + o.offsetY,
            left: o.xPos + o.offsetX,
          };
        }
        return null;
      })
      .filter((overlay) => !!overlay);

    if (!imageOverlays?.length) {
      return '';
    }

    const result = await sharp(imageBuffer).composite(imageOverlays).toBuffer();

    return result.toString('base64');
  } catch (error) {
    logger.error('图片处理出错:', error);
    // return origin base64
    return '';
  }
}

```

### Core Architecture Module: `apps/ui-tars/src/main/utils/sanitizeState.ts`
```
/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */

export function sanitizeState(state: Record<string, unknown>) {
  const safeState: Record<string, unknown> = {};

  for (const statePropName in state) {
    const stateProp = state[statePropName];
    if (typeof stateProp !== 'function') {
      safeState[statePropName] = stateProp;
    }
  }

  return safeState;
}

```

### Core Architecture Module: `apps/ui-tars/src/main/utils/screen.ts`
```
/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { screen } from 'electron';

import * as env from '@main/env';

export const getScreenSize = () => {
  const primaryDisplay = screen.getPrimaryDisplay();

  const logicalSize = primaryDisplay.size; // Logical = Physical / scaleX
  // Mac retina display scaleFactor = 1
  const scaleFactor = env.isMacOS ? 1 : primaryDisplay.scaleFactor;

  const physicalSize = {
    width: Math.round(logicalSize.width * scaleFactor),
    height: Math.round(logicalSize.height * scaleFactor),
  };

  return {
    id: primaryDisplay.id,
    physicalSize,
    logicalSize,
    scaleFactor,
  };
};

```

### Core Architecture Module: `apps/ui-tars/src/main/utils/systemPermissions.ts`
```
/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  hasPromptedForPermission,
  hasScreenCapturePermission,
  openSystemPreferences,
} from '@computer-use/mac-screen-capture-permissions';
import permissions from '@computer-use/node-mac-permissions';

import * as env from '@main/env';
import { logger } from '@main/logger';

let hasScreenRecordingPermission = false;
let hasAccessibilityPermission = false;

const wrapWithWarning =
  (message, nativeFunction) =>
  (...args) => {
    console.warn(message);
    return nativeFunction(...args);
  };

const askForAccessibility = (nativeFunction, functionName) => {
  const accessibilityStatus = permissions.getAuthStatus('accessibility');
  logger.info('[accessibilityStatus]', accessibilityStatus);

  if (accessibilityStatus === 'authorized') {
    hasAccessibilityPermission = true;
    return nativeFunction;
  } else if (
    accessibilityStatus === 'not determined' ||
    accessibilityStatus === 'denied'
  ) {
    hasAccessibilityPermission = false;
    permissions.askForAccessibilityAccess();
    return wrapWithWarning(
      `##### WARNING! The application running this script tries to access accessibility features to execute ${functionName}! Please grant requested access and visit https://github.com/nut-tree/nut.js#macos for further information. #####`,
      nativeFunction,
    );
  }
};
const askForScreenRecording = (nativeFunction, functionName) => {
  const screenCaptureStatus = permissions.getAuthStatus('screen');

  if (screenCaptureStatus === 'authorized') {
    hasScreenRecordingPermission = true;
    return nativeFunction;
  } else if (
    screenCaptureStatus === 'not determined' ||
    screenCaptureStatus === 'denied'
  ) {
    hasScreenRecordingPermission = false;
    permissions.askForScreenCaptureAccess();
    return wrapWithWarning(
      `##### WARNING! The application running this script tries to screen recording features to execute ${functionName}! Please grant the requested access for further information. #####`,
      nativeFunction,
    );
  }
};

export const ensurePermissions = (): {
  screenCapture: boolean;
  accessibility: boolean;
} => {
  if (env.isE2eTest) {
    return {
      screenCapture: true,
      accessibility: true,
    };
  }

  logger.info('Has asked permissions?', hasPromptedForPermission());

  hasScreenRecordingPermission = hasScreenCapturePermission();
  logger.info('Has permissions?', hasScreenRecordingPermission);
  logger.info('Has asked permissions?', hasPromptedForPermission());

  if (!hasScreenRecordingPermission) {
    openSystemPreferences();
  }

  askForAccessibility(() => {}, 'execute accessibility');
  askForScreenRecording(() => {}, 'execute screen recording');

  logger.info(
    '[ensurePermissions] hasScreenRecordingPermission',
    hasScreenRecordingPermission,
    'hasAccessibilityPermission',
    hasAccessibilityPermission,
  );

  return {
    screenCapture: hasScreenRecordingPermission,
    accessibility: hasAccessibilityPermission,
  };
};

```

### Core Architecture Module: `apps/ui-tars/src/main/utils/updateApp.ts`
```
import { UpdateInfo } from 'builder-util-runtime';
import { app, dialog, BrowserWindow } from 'electron';
import { logger } from '@main/logger';
import {
  AppUpdater as ElectronAppUpdater,
  autoUpdater,
} from 'electron-updater';
import { CustomGitHubProvider } from '@main/electron-updater/GitHubProvider';
import { env } from 'node:process';
import { REPO_OWNER, REPO_NAME } from '@main/shared/constants';

export class AppUpdater {
  autoUpdater: ElectronAppUpdater = autoUpdater;

  checkReleaseName(releaseInfo: UpdateInfo): boolean {
    const releaseName = releaseInfo?.files?.[0]?.url;

    return Boolean(
      releaseName && /ui[-.\s]?tars/i.test(releaseName.toLowerCase()),
    );
  }

  constructor(mainWindow: BrowserWindow) {
    autoUpdater.logger = logger;
    autoUpdater.autoDownload = false;

    autoUpdater.setFeedURL({
      // hack for custom provider
      provider: 'custom' as 'github',
      owner: REPO_OWNER,
      repo: REPO_NAME,
      // @ts-expect-error hack for custom provider
      updateProvider: CustomGitHubProvider,
    });

    autoUpdater.on('error', (error) => {
      logger.error('Update_Error', error);
      mainWindow.webContents.send('main:error', error);
    });

    autoUpdater.on('update-available', (releaseInfo: UpdateInfo) => {
      logger.info('new version', releaseInfo);

      if (this.checkReleaseName(releaseInfo)) {
        mainWindow.webContents.send('app-update-available', releaseInfo);
        autoUpdater.downloadUpdate();
      } else {
        logger.info('Cannot match');
      }
    });

    // Listen for download progress (optional)
    autoUpdater.on('download-progress', (progressObj) => {
      const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`;
      logger.info(logMessage);
    });

    // Listen for update download completion
    autoUpdater.on('update-downloaded', (info) => {
      logger.info('Update downloaded');
      dialog
        .showMessageBox({
          type: 'info',
          title: 'Update Ready',
          message: 'New version has been downloaded. Install now?',
          buttons: ['Install Now', 'Install Later'],
          detail: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/tag/v${info.version}`,
        })
        .then((response) => {
          if (response.response === 0) {
            // User chose "Install Now"
            autoUpdater.quitAndInstall(); // Quit and install update
          }
        });
    });

    this.autoUpdater = autoUpdater;

    if (app.isPackaged) {
      // Only check for updates in the packaged version!
      this.autoUpdater.checkForUpdatesAndNotify();
      // }
    }
  }

  async checkForUpdatesDetail() {
    if (env.isWindows && 'PORTABLE_EXECUTABLE_DIR' in process.env) {
      return {
        currentVersion: app.getVersion(),
        updateInfo: null,
      };
    }

    try {
      const update = await this.autoUpdater.checkForUpdates();
      if (
        update?.isUpdateAvailable &&
        update?.updateInfo &&
        this.checkReleaseName(update.updateInfo)
      ) {
        this.autoUpdater.downloadUpdate();
      }

      return {
        currentVersion: this.autoUpdater.currentVersion.toString(),
        updateInfo: update?.updateInfo,
      };
    } catch (error) {
      logger.error('Failed to check for update:', error);
      return {
        currentVersion: app.getVersion(),
        updateInfo: null,
      };
    }
  }

  // Function to manually check for updates
  checkForUpdates() {
    autoUpdater.checkForUpdates();

    // Listen for update check start
    autoUpdater.on('checking-for-update', () => {
      logger.info('Checking for updates...');
    });

    // Listen for no available updates
    autoUpdater.on('update-not-available', (_) => {
      logger.info('No updates available.');
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Check',
        message: 'You are using the latest version. No updates needed.',
      });
    });

    // Listen for available updates
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      logger.info(`New version found: ${info.version}`);
      if (this.checkReleaseName(info)) {
        dialog.showMessageBox({
          type: 'info',
          title: 'Update Available',
          message: `New version ${info.version} available, downloading...`,
          detail: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/tag/v${info.version}`,
        });
        autoUpdater.downloadUpdate();
      } else {
        logger.info('Cannot match');
      }
    });
  }
}

```

### Core Architecture Module: `apps/ui-tars/src/renderer/src/App.tsx`
```
/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Route, HashRouter, Routes } from 'react-router';
import { lazy, Suspense } from 'react';
import { Toaster } from 'sonner';

import { MainLayout } from './layouts/MainLayout';

import './styles/globals.css';

const Home = lazy(() => import('./pages/home'));
const LocalOperator = lazy(() => import('./pages/local'));
const FreeRemoteOperator = lazy(() => import('./pages/remote/free'));
// const PaidRemoteOperator = lazy(() => import('./pages/remote/paid'));

const Widget = lazy(() => import('./pages/widget'));

export default function App() {
  return (
    <HashRouter>
      <Suspense
        fallback={
          <div className="loading-container">
            <div className="loading-spinner" />
          </div>
        }
      >
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/local" element={<LocalOperator />} />
            <Route path="/free-remote" element={<FreeRemoteOperator />} />
            {/* <Route path="/paid-remote" element={<PaidRemoteOperator />} /> */}
          </Route>

          <Route path="/widget" element={<Widget />} />
        </Routes>
        <Toaster
          position="top-right"
          offset={{ top: '48px' }}
          mobileOffset={{ top: '48px' }}
        />
      </Suspense>
    </HashRouter>
  );
}

```

### Core Architecture Module: `apps/ui-tars/src/renderer/src/api.ts`
```
/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { createClient } from '@ui-tars/electron-ipc/renderer';
import type { Router } from '@main/ipcRoutes';

export const api = createClient<Router>({
  ipcInvoke: window.electron.ipcRenderer.invoke,
});

```

### Core Architecture Module: `apps/ui-tars/src/renderer/src/components/AlertDialog/delSessionDialog.tsx`
```
/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog';

interface DeleteSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteSessionDialog({
  open,
  onOpenChange,
  onConfirm,
}: DeleteSessionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Session</AlertDialogTitle>
          <AlertDialogDescription>
            The current session is running. Navigating away will forcibly stop
            the session. Do you still want to proceed?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-500 hover:bg-red-600"
            onClick={onConfirm}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
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

Co-authored-by: 陈昊励 <[REDACTED_EMAIL]>

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
+  it('rejects a DNS-rebinding POST with valid CSRF (Host: evil.example:<port>)', async () => {
+    // Even if the attacker has captured a CSRF token via the same chain,
+    // mutations from a rebound origin should be rejected at the Host layer.
+    const res = await fetchWith(`evil.example:${PORT}`, 'POST', '/api/v1/sessions/delete');
+    expect(res.status).toBe(403);
+  });
+
+  it('rejects requests with a missing Host header with 403', async () => {
+    const res = await fetchWith(undefined);
+    expect(res.status).toBe(403);
+  });
+
+  it('is case-insensitive in Host comparison', async () => {
+    const res = await fetchWith(`LOCALHOST:${PORT}`);
+    expect(res.status).toBe(200);
+  });
+
+  it('rejects hostnames that share a prefix with localhost (no implicit suffix match)', async () => {
+    const res = await fetchWith(`localhost.evil:${PORT}`);
+    expect(res.status).toBe(403);
+  });
+
+  it('rejects loopback Host with the wrong port', async () => {
+    const res = await fetchWith(`localhost:${PORT + 1}`);
+    expect(res.status).toBe(403);
+ 
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

**File**: `multimodal/tarko/agent-server/package.json` (modified, +1/-0)
```diff
@@ -37,6 +37,7 @@
     "@types/supertest": "^6.0.2",
     "cors": "^2.8.5",
     "express": "4.21.2",
+    "express-rate-limit": "^7.5.0",
     "http-proxy-middleware": "^2.0.6",
     "lowdb": "^6.0.1",
     "nanoid": "^5.0.8",
```

**File**: `multimodal/tarko/agent-server/src/api/index.ts` (modified, +45/-3)
```diff
@@ -1,8 +1,17 @@
 import express from 'express';
 import cors from 'cors';
 import { registerAllRoutes } from './routes';
-import { setupWorkspaceStaticServer } from '../utils/workspace-static-server';
+import {
+  isWorkspaceFileRequest,
+  setupWorkspaceStaticServer,
+} from '../utils/workspace-static-server';
 import { csrfProtectionMiddleware } from './middleware/csrf-protection';
+import { createHostValidationMiddleware } from './middleware/host-validation';
+import {
+  createAuthRateLimiter,
+  createNetworkAuthMiddleware,
+  createScopedAuthMiddleware,
+} from './middleware/network-auth';
 import { registerCsrfRoutes } from './routes/csrf';
 
 /**
@@ -12,7 +21,10 @@ import { registerCsrfRoutes } from './routes/csrf';
  */
 function isAllowedOrigin(origin: string | undefined, port: number): boolean {
   if (!origin) {
-    // Allow requests with no Origin header (e.g., curl, same-origin)
+    // Non-browser clients send no Origin, and neither does a same-origin GET,
+    // so this cannot be a decision point on its own. The Host check ahead of it
+    // is what rejects a rebound hostname, and the auth token is what a caller
+    // outside the browser has to present.
     return true;
   }
 
@@ -50,7 +62,10 @@ function isAllowedOrigin(origin: string | undefined, port: number): boolean {
  */
 export function getDefaultCorsOptions(port: number): cors.CorsOptions {
   return {
-    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
+    origin: (
+      origin: string | undefined,
+      callback: (err: Error | null, allow?: boolean) => void,
+    ) => {
       if (isAllowedOrigin(origin, port)) {
         callback(null, true);
       } else {
@@ -88,19 +103,35 @@ export function setupAPI(
     workspacePath?: string;
     isDebug?: boolean;
     port?: number;
+    host?: string;
+    authToken?: string;
   },
 ) {
   const port = options?.port ?? 3000;
+  const host = options?.host ?? '127.0.0.1';
 
   // Apply security headers
   app.use(securityHeadersMiddleware);
 
+  // Reject rebound hostnames before CORS, which cannot see them: a same-origin
+  // request from the attacker's page arrives with no Origin header at all.
+  app.use(createHostValidationMiddleware({ port, host }));
+
   // Apply CORS middleware with origin whitelist
   app.use(cors(getDefaultCorsOptions(port)));
 
   // Apply JSON body parser middleware
   app.use(express.json({ limit: '20mb' }));
 
+  // Guards the whole API, the CSRF token endpoint included: that token defends
+  // against cross-site requests, it does not identify a caller. Scoped to /api
+  // so the web UI shell still loads and can then present the token itself.
+  const authToken = options?.authToken;
+  const authMiddleware = authToken ? createNetworkAuthMiddleware(authToken) : undefined;
+  if (authToken && authMiddleware) {
+    app.use('/api', createAuthRateLimiter(authToken), authMiddleware);
+  }
+
   // Register CSRF token endpoint (before CSRF protection so GET is accessible)
   registerCsrfRoutes(app);
 
@@ -125,6 +156,17 @@ export function setupAPI(
 
   // Setup workspace static server (lower priority, after API routes)
   if (options?.workspacePath) {
+    // Workspace files are session data and need the token too, but only those:
+    // everything else here falls through to the web UI shell, which has to stay
+    // loadable so the page can present a token in the first place.
+    if (authToken && authMiddleware) {
+      app.use(
+        '/',
+        createAuthRateLimiter(authToken, isWorkspaceFileRequest),
+        createScopedAuthMiddleware(authMiddleware, isWorkspaceFileRequest),
+      );
+    }
+
     setupWorkspaceStaticServer(app, options.workspacePath, options.isDebug);
   }
 }
```

**File**: `multimodal/tarko/agent-server/src/api/middleware/host-validation.ts` (added, +184/-0)
```diff
@@ -0,0 +1,184 @@
+/*
+ * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+import type { NextFunction, Request, Response } from 'express';
+
+/**
+ * Host header validation, a DNS rebinding defense.
+ *
+ * The Origin allowlist does not cover rebinding. Once an attacker re-resolves a
+ * domain they control to the address this server listens on, requests issued by
+ * their page are same-origin, and a same-origin GET carries no Origin header for
+ * the allowlist to inspect. What still differs is the Host header: it holds the
+ * name the browser was pointed at, `evil.example:8888` rather than
+ * `localhost:8888`.
+ *
+ * Rebinding needs a DNS name, so a Host that is a literal IP address cannot come
+ * out of it: a page reaching us at `http://192.168.1.5:8888` was served from that
+ * address to begin with. Names have to be ones we already expect, which means
+ * loopback, whatever the operator chose to bind, or an explicit
+ * `TARKO_ALLOWED_HOSTS` entry.
+ *
+ * This constrains browsers only. Every other client writes its own Host header,
+ * so it stops rebinding rather than network access; `network-auth.ts` is what
+ * keeps unauthenticated callers out.
+ */
+
+const LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1', '::1', '::ffff:127.0.0.1'];
+
+const WILDCARD_HOSTS = new Set(['0.0.0.0', '::', '::0']);
+
+const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;
+
+export interface HostValidationOptions {
+  /** Port the server listens on. */
+  port: number;
+  /** Address the server bound to, already resolved by `resolveServerHost`. */
+  host: string;
+  /**
+   * Additional hostnames to accept, comma separated, each optionally carrying a
+   * port. Defaults to `TARKO_ALLOWED_HOSTS`, for reverse proxies and custom
+   * names that this server cannot infer on its own.
+   */
+  allowedHosts?: string;
+}
+
+interface ParsedHost {
+  hostname: string;
+  port?: string;
+}
+
+function parseHostHeader(rawValue: string): ParsedHost | null {
+  const value = rawValue.trim().toLowerCase();
+  if (!value) {
+    return null;
+  }
+
+  if (value.startsWith('[')) {
+    const closing = value.indexOf(']');
+    if (closing === -1) {
+      return null;
+    }
+    const hostname = value.slice(1, closing);
+    const remainder = value.slice(closing + 1);
+    if (!remainder) {
+      return { hostname };
+    }
+    return remainder.startsWith(':') ? { hostname, port: remainder.slice(1) } : null;
+  }
+
+  const separator = value.indexOf(':');
+  if (separator === -1) {
+    return { hostname: value };
+  }
+
+  // More than one colon can only be an unbracketed IPv6 address. That is not
+  // valid in a Host header, but reading a port off it would be a guess.
+  if (value.indexOf(':', separator + 1) !== -1) {
+    return { hostname: value };
+  }
+
+  return { hostname: value.slice(0, separator), port: value.slice(separator + 1) };
+}
+
+/**
+ * Whether a hostname is an IP address rather than a name. A DNS name is the one
+ * thing rebinding can repoint, so literals are safe to accept.
+ */
+function isIpLiteral(hostname: string): boolean {
+  if (IPV4_PATTERN.test(hostname)) {
+    return hostname.split('.').every((octet) => Number(octet) <= 255);
+  }
+
+  // A colon cannot appear in a DNS name, so it marks an IPv6 literal.
+  return hostname.includes(':');
+}
+
+function buildAllowedNames(options: HostValidationOptions): Set<string> {
+  const names = new Set<string>(LOOPBACK_HOSTNAMES);
+
+  // A wildcard bind names no single address, and a literal is covered by
+  // `isIpLiteral`; only a hostname the operator picked needs recording here.
+  const boundHost = options.host.trim().toLowerCase();
+  if (boundHost && !WILDCARD_HOSTS.has(boundHost) && !isIpLiteral(boundHost)) {
+    names.add(boundHost);
+  }
+
+  return names;
+}
+
+function buildExplicitEntries(allowedHosts?: string): Set<string> {
+  const entries = new Set<string>();
+  if (!allowedHosts) {
+    return entries;
+  }
+
+  for (const entry of allowedHosts.split(',')) {
+    const trimmed = entry.trim().toLowerCase();
+    if (trimmed) {
+      entries.add(trimmed);
+    }
+  }
+
+  return entries;
+}
+
+export function isAllowedHostHeader(
+  hostHeader: string | undefined,
+  options: HostValidationOptions,
+): boolean {
+  if (!hostHeader) {
+    return false;
+  }
+
+  const explicitEntries = buildExplicitEntries(
+    options.allowedHosts ?? process.env.TARKO_ALLOWED_HOSTS,
+  );
+
+  // Matched before the port check so an operator can allow a proxy that
+  // forwards from a different port.
+  if (explicitEntries.has(hostHeader.trim().toLowerCase())) {
+    return true;
+  }
+
+  const parsed = parseHostHeader(hostHeader);
+  if (!parsed) {
+    return false;
+  }
+
+  if (explicitEntries.has(parsed.hostname)) {
+    return true;
+  }
+
+  if (parsed.port !== undefined && parsed.port !== String(options.port)) {
+    return false;
+  }
+
+  if (isIpLiteral(parsed.hostname)) {
+    return true;
+
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
-        const iframe = iframeRef.current;
-        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
-
-        if (!iframeDoc) return;
-
-        // For streaming, try to update content smoothly
-        if (isStreaming && lastRenderedContent) {
-          // Check if we can do partial update
-          if (stableContent.startsWith(lastRenderedContent)) {
-            // Content is appended, try to append to existing DOM
-            const additionalContent = stableContent.slice(lastRenderedContent.length);
-            if (additionalContent.trim()) {
-              // Create a temporary container to parse new content
-              const tempDiv = iframeDoc.createElement('div');
-              tempDiv.innerHTML = additionalContent;
-
-              // Append new nodes to body
-              while (tempDiv.firstChild) {
-                iframeDoc.body.appendChild(tempDiv.firstChild);
-              }
-
-              setLastRenderedContent(stableContent);
-              retu
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
+  const entries = records
+    .map((record) => {
+      const fields = KNOWN_FIELDS.filter((field) => field in record)
+        .map((field) => `    ${field}: ${JSON.stringify(record[field])},`)
+        .join('\n');
+      return `  {\n${fields}\n  },`;
+    })
+    .join('\n');
+
+  return `/**
+ * Showcase share records captured from the public shares API.
+ *
+ * Committed on purpose: the showcase list, detail and replay pages read this
+ * snapshot, so they keep working when the upstream API is down or unreachable.
+ * Values are stored exactly as the API returns them — notably \`url\` and
+ * \`imageUrl\` carry no scheme, which \`ensureHttps\` adds at render time.
+ *
+ * Regenerate with \`pnpm refresh:showcase-data\`; it never runs during build or dev.
+ *
+ * source: ${apiUrl}
+ * fetchedAt: ${fetchedAt}
+ * records: ${records.length}
+ */
+import type { ApiShareItem } from '../shared/types';
+
+export const showcaseShares: ApiShareItem[] = [
+${entries}
+];
+`;
+}
+
+function readPreviousRecor
```

**File**: `multimodal/websites/docs/src/data/showcaseShares.ts` (added, +285/-0)
```diff
@@ -0,0 +1,285 @@
+/**
+ * Showcase share records captured from the public shares API.
+ *
+ * Committed on purpose: the showcase list, detail and replay pages read this
+ * snapshot, so they keep working when the upstream API is down or unreachable.
+ * Values are stored exactly as the API returns them — notably `url` and
+ * `imageUrl` carry no scheme, which `ensureHttps` adds at render time.
+ *
+ * Regenerate with `pnpm refresh:showcase-data`; it never runs during build or dev.
+ *
+ * source: https://agent-tars.toxichl1994.workers.dev/shares/public?page=1&limit=100
+ * fetchedAt: 2026-08-01T19:50:41.478Z
+ * records: 17
+ */
+import type { ApiShareItem } from '../shared/types';
+
+export const showcaseShares: ApiShareItem[] = [
+  {
+    sessionId: 'RYlOoD54GnHlq6g7cDCxE',
+    slug: 'analyze-google-network-request-ea86c5',
+    url: 'lf3-static.bytednsdoc.com/obj/eden-cn/zyha-aulnh/ljhwZthlaukjlkulzlp/shared-conversations/agent-tars-RYlOoD54GnHlq6g7cDCxE-1753404574396.html',
+    tags: 'codeact',
+    title: 'Analyze Google Network Request',
+    description: "Use command to help me analyze Google's network request.",
+    imageUrl:
+      'lf3-static.bytednsdoc.com/obj/eden-cn/zyha-aulnh/ljhwZthlaukjlkulzlp/storage/general/analyze-google-network-request-ea86c5.jpg',
+    languages: '',
+    author: 'ULIVZ',
+    authorGithub: 'ulivz',
+    authorTwitter: '_ulivz',
+    date: '2026-06-23T18:38:00.210Z',
+  },
+  {
+    sessionId: '7OKl6U30doK0fidzTM7PI',
+    slug: 'featagent-respnse-api-3e7e29',
+    url: 'lf3-static.bytednsdoc.com/obj/eden-cn/zyha-aulnh/ljhwZthlaukjlkulzlp/shared-conversations/agent-tars-7OKl6U30doK0fidzTM7PI-1753634591847.html',
+    tags: 'codeact',
+    title: 'Use Remote Feat Agent Api Branch',
+    description: '直接直接使用远程的  feat/agent-respnse-api 分支',
+    imageUrl:
+      'lf3-static.bytednsdoc.com/obj/eden-cn/zyha-aulnh/ljhwZthlaukjlkulzlp/storage/general/featagent-respnse-api-3e7e29.jpg',
+    languages: '',
+    author: 'ULIVZ',
+    authorGithub: 'ulivz',
+    authorTwitter: '_ulivz',
+    date: '2025-07-27T17:28:27.563Z',
+  },
+  {
+    sessionId: 'PtpHIoKvSJc6T81LabtGL',
+    slug: 'claude-code-gemini-cli-d3fbf7',
+    url: 'lf3-static.bytednsdoc.com/obj/eden-cn/zyha-aulnh/ljhwZthlaukjlkulzlp/shared-conversations/agent-tars-PtpHIoKvSJc6T81LabtGL-1753404703049.html',
+    tags: 'research',
+    title: 'Research on CLI Parameters of Claude Code and Gemini',
+    description:
+      '帮我调研一下，claude code 和 gemini 使用 cli 直接运行，输入 prompt 的 cli 参数是什么？',
+    imageUrl:
+      'lf3-static.bytednsdoc.com/obj/eden-cn/zyha-aulnh/ljhwZthlaukjlkulzlp/storage/general/claude-code-gemini-cli-d3fbf7.jpg',
+    languages: '',
+    author: 'ULIVZ',
+    authorGithub: 'ulivz',
+    authorTwitter: '_ulivz',
+    date: '2025-07-27T17:26:28.743Z',
+  },
+  {
+    sessionId: 'CNhJRab__u5dU64NY48qB',
+    slug: 'httpsbeianmiitgovcnintegratedrecordquery-httpswwwbytedancec-120388',
+    url: 'lf3-static.bytednsdoc.com/obj/eden-cn/zyha-aulnh/ljhwZthlaukjlkulzlp/shared-conversations/agent-tars-CNhJRab__u5dU64NY48qB-1753636318327.html',
+    tags: 'ai-browser',
+    title: 'Query Website Filings On MIIT',
+    description:
+      '帮我打开 https://beian.miit.gov.cn/#/Integrated/recordQuery 查看以下网站的备案\r\n\r\n- https://www.bytedance.com\r\n- https://www.douyin.com\r\n- http://toutiao.com/\r\n\r\n整理成表格发给我，注意每次切换 website 要清空输入框',
+    imageUrl:
+      'lf3-static.bytednsdoc.com/obj/eden-cn/zyha-aulnh/ljhwZthlaukjlkulzlp/storage/general/httpsbeianmiitgovcnintegratedrecordquery-httpswwwbytedancec-120388.jpg',
+    languages: '',
+    author: 'ULIVZ',
+    authorGithub: 'ulivz',
+    authorTwitter: '_ulivz',
+    date: '2025-07-27T17:12:37.309Z',
+  },
+  {
+    sessionId: '6GgWgKN7eqzDl3OV3kvOn',
+    slug: 'draw-me-a-chart-34bc8d',
+    url: 'lf3-static.bytednsdoc.com/obj/eden-cn/zyha-aulnh/ljhwZthlaukjlkulzlp/shared-conversations/agent-tars-6GgWgKN7eqzDl3OV3kvOn-1753634924390.html',
+    tags: 'mcp',
+    title: "Draw Chart of Hangzhou's Weather",
+    description: "Draw me a chart of Hangzhou's weather for one month",
+    imageUrl:
+      'lf3-static.bytednsdoc.com/obj/eden-cn/zyha-aulnh/ljhwZthlaukjlkulzlp/storage/general/draw-me-a-chart-34bc8d.jpg',
+    languages: '',
+    author: 'ULIVZ',
+    authorGithub: 'ulivz',
+    authorTwitter: '_ulivz',
+    date: '2025-07-27T16:50:00.471Z',
+  },
+  {
+    sessionId: 'DBV1DcP9eDBaTRGJZpnl5',
+    slug: 'another-git-process-seems-b6495e',
+    url: 'lf3-static.bytednsdoc.com/obj/eden-cn/zyha-aulnh/ljhwZthlaukjlkulzlp/shared-conversations/agent-tars-DBV1DcP9eDBaTRGJZpnl5-1753634645808.html',
+    tags: 'codeact',
+    title: 'How To Fix Git Process Error',
+    description:
+      "如何修复这个报错：Another git process seems to be running in this repository, e.g.\r\nan editor opened by 'git commit'. Please make sure all processes\r\nare terminated then try again. If it still fails, a git process\r\nmay have crashed in this repository earlier:\r\nremove the file manually to 
```

**File**: `multimodal/websites/docs/src/hooks/useShowcaseData.ts` (modified, +32/-41)
```diff
@@ -1,11 +1,11 @@
-import { useState, useEffect, useMemo } from 'react';
-import { shareAPI, ApiShareItem } from '../services/api';
+import { useCallback, useMemo } from 'react';
+import { showcaseShares } from '../data/showcaseShares';
 import {
   processShowcaseData,
   ProcessedShowcaseData,
   ShowcaseItem,
 } from '../services/dataProcessor';
-import { showcaseData } from 'showcase-data';
+import type { ApiShareItem } from '../shared/types';
 
 interface UseShowcaseDataResult {
   items: ShowcaseItem[];
@@ -21,54 +21,45 @@ interface UseShowcaseDataProps {
 }
 
 /**
- * Showcase data hook using build-time data for public shares
+ * `extractIdFromPath` tells slugs and sessionIds apart by looking for a dash, so a
+ * sessionId containing one arrives here labelled as a slug. Matching either field
+ * keeps those links resolvable.
+ */
+function findShare(id: string): ApiShareItem | undefined {
+  return showcaseShares.find((share) => share.slug === id || share.sessionId === id);
+}
+
+/**
+ * Showcase data hook backed by the committed snapshot: resolving a list, a
+ * sessionId or a slug never touches the network, so the pages survive the share
+ * API being down. Unknown ids yield an empty result, which callers render as 404.
  */
 export function useShowcaseData({
   sessionId,
   slug,
 }: UseShowcaseDataProps = {}): UseShowcaseDataResult {
-  const [apiItems, setApiItems] = useState<ApiShareItem[]>([]);
-  const [isLoading, setIsLoading] = useState(true);
-  const [error, setError] = useState<string | null>(null);
+  const id = sessionId || slug || null;
 
-  const processedData = useMemo(() => {
-    if (apiItems.length === 0) return null;
-    return processShowcaseData(apiItems);
-  }, [apiItems]);
+  const apiItems = useMemo(() => {
+    if (!id) return showcaseShares;
+    const match = findShare(id);
+    return match ? [match] : [];
+  }, [id]);
 
-  const items = processedData?.items || [];
-
-  const fetchData = async () => {
-    try {
-      setIsLoading(true);
-      setError(null);
-
-      if (!sessionId && !slug) {
-        // Use build-time data for public shares
-        setApiItems(showcaseData.length > 0 ? showcaseData : await shareAPI.getPublicShares(1, 100).then(r => r.data));
-      } else if (sessionId) {
-        const response = await shareAPI.getShare(sessionId);
-        setApiItems(response.success ? [response.data] : []);
-      } else if (slug) {
-        const response = await shareAPI.getShareBySlug(slug);
-        setApiItems(response.success ? [response.data] : []);
-      }
-    } catch (err) {
-      setError(err instanceof Error ? err.message : 'Unknown error');
-    } finally {
-      setIsLoading(false);
-    }
-  };
+  const processedData = useMemo(
+    () => (apiItems.length > 0 ? processShowcaseData(apiItems) : null),
+    [apiItems],
+  );
 
-  useEffect(() => {
-    fetchData();
-  }, [sessionId, slug]);
+  // Part of the hook's contract for the retry buttons; the snapshot is bundled, so
+  // there is nothing left to fetch.
+  const refetch = useCallback(async () => {}, []);
 
   return {
-    items,
+    items: processedData?.items || [],
     processedData,
-    isLoading,
-    error,
-    refetch: fetchData,
+    isLoading: false,
+    error: null,
+    refetch,
   };
 }
```

**File**: `multimodal/websites/docs/src/services/api.ts` (removed, +0/-135)
```diff
@@ -1,135 +0,0 @@
-interface ApiShareItem {
-  sessionId: string;
-  slug: string;
-  url: string;
-  tags: string;
-  title?: string;
-  description?: string;
-  imageUrl?: string;
-  languages?: string;
-  author?: string;
-  authorGithub?: string;
-  authorTwitter?: string;
-  date?: string;
-}
-
-interface ApiResponse<T> {
-  success: boolean;
-  data: T;
-  error?: string;
-}
-
-interface ApiListResponse<T> extends ApiResponse<T[]> {
-  pagination: {
-    currentPage: number;
-    totalPages: number;
-    totalRecords: number;
-    limit: number;
-    hasNextPage: boolean;
-    hasPrevPage: boolean;
-  };
-}
-
-interface CreateShareData {
-  sessionId: string;
-  slug: string;
-  url: string;
-  title?: string;
-  description?: string;
-  tags?: string;
-  imageUrl?: string;
-  languages?: string;
-  author?: string;
-  authorGithub?: string;
-  authorTwitter?: string;
-}
-
-interface UpdateShareData {
-  title?: string;
-  description?: string;
-  tags?: string;
-  imageUrl?: string;
-  languages?: string;
-  author?: string;
-  authorGithub?: string;
-  authorTwitter?: string;
-}
-
-class ShareAPI {
-  private baseUrl = 'https://agent-tars.toxichl1994.workers.dev';
-
-  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
-    const url = `${this.baseUrl}${path}`;
-    const response = await fetch(url, {
-      headers: {
-        'Content-Type': 'application/json',
-        ...options.headers,
-      },
-      ...options,
-    });
-
-    const data = await response.json();
-
-    if (!response.ok) {
-      throw new Error(data.error || `HTTP ${response.status}`);
-    }
-
-    return data;
-  }
-
-  async getShares(page = 1, limit = 100): Promise<ApiListResponse<ApiShareItem>> {
-    return this.request<ApiListResponse<ApiShareItem>>(`/shares?page=${page}&limit=${limit}`);
-  }
-
-  async getPublicShares(page = 1, limit = 100): Promise<ApiListResponse<ApiShareItem>> {
-    return this.request<ApiListResponse<ApiShareItem>>(
-      `/shares/public?page=${page}&limit=${limit}`,
-    );
-  }
-
-  async getShare(sessionId: string): Promise<ApiResponse<ApiShareItem>> {
-    const encodedId = encodeURIComponent(sessionId);
-    return this.request<ApiResponse<ApiShareItem>>(`/shares/${encodedId}`);
-  }
-
-  async getShareBySlug(slug: string): Promise<ApiResponse<ApiShareItem>> {
-    const encodedSlug = encodeURIComponent(slug);
-    return this.request<ApiResponse<ApiShareItem>>(`/shares/slug/${encodedSlug}`);
-  }
-
-  async createShare(shareData: CreateShareData): Promise<ApiResponse<ApiShareItem>> {
-    return this.request<ApiResponse<ApiShareItem>>('/shares', {
-      method: 'POST',
-      body: JSON.stringify(shareData),
-    });
-  }
-
-  async updateShare(
-    sessionId: string,
-    updateData: UpdateShareData,
-  ): Promise<ApiResponse<ApiShareItem>> {
-    const encodedId = encodeURIComponent(sessionId);
-    return this.request<ApiResponse<ApiShareItem>>(`/shares/${encodedId}`, {
-      method: 'PUT',
-      body: JSON.stringify(updateData),
-    });
-  }
-
-  async updateShareBySlug(
-    slug: string,
-    updateData: UpdateShareData,
-  ): Promise<ApiResponse<ApiShareItem>> {
-    const encodedSlug = encodeURIComponent(slug);
-    return this.request<ApiResponse<ApiShareItem>>(`/shares/slug/${encodedSlug}`, {
-      method: 'PUT',
-      body: JSON.stringify(updateData),
-    });
-  }
-
-  async health(): Promise<ApiResponse<any>> {
-    return this.request<ApiResponse<any>>('/health');
-  }
-}
-
-export const shareAPI = new ShareAPI();
-export type { ApiShareItem, ApiResponse, ApiListResponse, CreateShareData, UpdateShareData };
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

**File**: `multimodal/tarko/agent-cli/src/utils/server-setup.ts` (modified, +3/-7)
```diff
@@ -1,21 +1,17 @@
-/*
- * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
- * SPDX-License-Identifier: Apache-2.0
- */
-
 import { AgentAppConfig } from '@tarko/interface';
+import { resolveServerHost } from '@tarko/shared-utils';
 import chalk from 'chalk';
 import { findAvailablePort } from './port';
 
 export async function ensureServerConfig(appConfig: AgentAppConfig): Promise<void> {
-  // Ensure server config exists with defaults
   if (!appConfig.server) {
     appConfig.server = {
       port: 8888,
     };
   }
 
-  // Find available port
+  appConfig.server.host = resolveServerHost(appConfig.server.host);
+
   const availablePort = await findAvailablePort(appConfig.server.port!);
   if (availablePort !== appConfig.server.port) {
     console.log(
```

**File**: `multimodal/tarko/agent-cli/tests/config-builder.test.ts` (modified, +8/-0)
```diff
@@ -58,6 +58,7 @@ describe('buildAppConfig', () => {
             "provider": "openai",
           },
           "server": {
+            "host": "127.0.0.1",
             "port": 3000,
             "storage": {
               "type": "sqlite",
@@ -234,6 +235,7 @@ describe('buildAppConfig', () => {
       const result = buildAppConfig(cliArgs, userConfig);
 
       expect(result.server).toEqual({
+        host: '127.0.0.1',
         port: 8888, // Default port
         storage: {
           type: 'sqlite',
@@ -255,6 +257,7 @@ describe('buildAppConfig', () => {
       const result = buildAppConfig(cliArgs, userConfig);
 
       expect(result.server).toEqual({
+        host: '127.0.0.1',
         port: 3000, // CLI overrides user config
         storage: {
           type: 'sqlite',
@@ -300,6 +303,7 @@ describe('buildAppConfig', () => {
       const result = buildAppConfig(cliArgs, {});
 
       expect(result.server).toEqual({
+        host: '127.0.0.1',
         port: 8888, // Default port always added
         storage: {
           type: 'sqlite',
@@ -340,6 +344,7 @@ describe('buildAppConfig', () => {
             "provider": "openai",
           },
           "server": {
+            "host": "127.0.0.1",
             "port": 8888,
             "storage": {
               "type": "sqlite",
@@ -455,6 +460,7 @@ describe('buildAppConfig', () => {
             "provider": "openai",
           },
           "server": {
+            "host": "127.0.0.1",
             "port": 8888,
             "storage": {
               "type": "sqlite",
@@ -612,6 +618,7 @@ describe('buildAppConfig', () => {
       const result = buildAppConfig(cliArgs, userConfig);
 
       expect(result.server).toEqual({
+        host: '127.0.0.1',
         port: 9999,
         storage: {
           type: 'file',
@@ -681,6 +688,7 @@ describe('buildAppConfig', () => {
       const result = buildAppConfig(cliArgs, userConfig);
 
       expect(result.server).toEqual({
+        host: '127.0.0.1',
         port: 9999,
         storage: {
           type: 'file',
```

**File**: `multimodal/tarko/agent-server-next/src/controllers/sessions.ts` (modified, +39/-1)
```diff
@@ -7,6 +7,12 @@ import type { HonoContext } from '../types';
 import { getCurrentUserId } from '../middlewares/auth';
 import { SessionInfo } from '@tarko/interface';
 import { ShareService } from '../services';
+import { InvalidSessionInputError } from '../services/session/AgentSessionFactory';
+import {
+  ALLOWED_SESSION_AGENT_OPTION_KEYS,
+  filterDeclaredRuntimeSettings,
+  sanitizeSessionAgentOptions,
+} from '@tarko/shared-utils';
 import { filterSessionModel } from '../utils';
 
 /**
@@ -67,6 +73,9 @@ export async function createSession(c: HonoContext) {
       201,
     );
   } catch (error) {
+    if (error instanceof InvalidSessionInputError) {
+      return c.json({ error: error.message, ...error.details }, 400);
+    }
     console.error('Failed to create session:', error);
     return c.json({ error: 'Failed to create session' }, 500);
   }
@@ -200,10 +209,39 @@ export async function updateSession(c: HonoContext) {
       return c.json({ error: 'Session not found' }, 404);
     }
 
+    // Session metadata is replayed into the Agent constructor on every session
+    // initialization, so hold its agent-facing fields to the same boundary as
+    // session creation instead of persisting the payload verbatim.
+    const sanitizedUpdates = { ...metadataUpdates };
+
+    if ('agentOptions' in sanitizedUpdates) {
+      const { value, rejectedKeys } = sanitizeSessionAgentOptions(sanitizedUpdates.agentOptions);
+      if (rejectedKeys.length > 0) {
+        return c.json(
+          {
+            error: 'Unsupported agentOptions',
+            message: `agentOptions may only contain ${ALLOWED_SESSION_AGENT_OPTION_KEYS.join(', ')}; rejected: ${rejectedKeys.join(', ')}. Configure anything else on the server.`,
+            allowed: ALLOWED_SESSION_AGENT_OPTION_KEYS,
+            rejected: rejectedKeys,
+          },
+          400,
+        );
+      }
+      sanitizedUpdates.agentOptions = value;
+    }
+
+    if ('runtimeSettings' in sanitizedUpdates) {
+      const { value } = filterDeclaredRuntimeSettings(
+        sanitizedUpdates.runtimeSettings,
+        server.appConfig?.server?.runtimeSettings?.schema,
+      );
+      sanitizedUpdates.runtimeSettings = value;
+    }
+
     const updatedMetadata = await server.daoFactory.updateSessionInfo(sessionId, {
       metadata: {
         ...sessionInfo.metadata,
-        ...metadataUpdates,
+        ...sanitizedUpdates,
       },
     });
 
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

**File**: `packages/agent-infra/mcp-servers/commands/src/index.ts` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ program
   .option('--cwd <cwd>', 'current working directory')
   .option(
     '--host <host>',
-    'host to bind server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces.',
+    'host to bind server to. Default is 127.0.0.1 (loopback). Use 0.0.0.0 to bind to all interfaces.',
   )
   .option('--port <port>', 'port to listen on for SSE and HTTP transport.')
   .action(async (options) => {
```

**File**: `packages/agent-infra/mcp-servers/filesystem/src/index.ts` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ program
   )
   .option(
     '--host <host>',
-    'host to bind server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces.',
+    'host to bind server to. Default is 127.0.0.1 (loopback). Use 0.0.0.0 to bind to all interfaces.',
   )
   .option('--port <port>', 'port to listen on for SSE and HTTP transport.')
   .action(async (options) => {
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
+    csrfTokenStore.set(token, Date.now() + CSRF_TOKEN_EXPIRY_MS);
+    return token;
+}
+
+function isValidCsrfToken(token: string): boolean {
+    const expiry = csrfTokenStore.get(token);
+    if (!expiry) return false;
+    if (Date.now() > expiry) {
+        csrfTokenStore.delete(token);
+        return false;
+    }
+    return true;
+}
+
+const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
+
+/**
+ * Create a CSRF protection hook.
+ * Validates X-CSRF-Token header on mutation requests (POST/PUT/DELETE).
+ */
+export function createCsrfProtectionHook(): HookRegistrationOptions {
+    return {
+        id: 'csrf-protection',
+        name: 'CSRF Protection',
+        priority: BuiltInPriorities.AUTH - 10, // Just before auth
+        description: 'CSRF token validation for mutation requests',
+        handler: async (c, next) => {
+            if (SAFE_METHODS.has(c.req.method)) {
+                await next();
+                return;
+            }
+
+            const token = c.re
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

**File**: `multimodal/tarko/agent-server-next/src/server.ts` (modified, +2/-0)
```diff
@@ -27,6 +27,7 @@ import {
   createSessionRoutes,
   createShareRoutes,
   createSystemRoutes,
+  createCsrfRoutes,
 } from './routes';
 import { createUserConfigRoutes } from './routes/user';
 import { HookManager, BuiltInPriorities, type HookRegistrationOptions } from './hooks';
@@ -166,6 +167,7 @@ export class AgentServer<T extends AgentAppConfig = AgentAppConfig> {
    */
   private setupRoutes(): void {
     // Register all API routes
+    this.app.route('/', createCsrfRoutes());
     this.app.route('/', createQueryRoutes());
     this.app.route('/', createSessionRoutes());
     this.app.route('/', createShareRoutes());
```

**File**: `multimodal/tarko/agent-server/src/api/index.ts` (modified, +82/-9)
```diff
@@ -2,38 +2,111 @@ import express from 'express';
 import cors from 'cors';
 import { registerAllRoutes } from './routes';
 import { setupWorkspaceStaticServer } from '../utils/workspace-static-server';
+import { csrfProtectionMiddleware } from './middleware/csrf-protection';
+import { registerCsrfRoutes } from './routes/csrf';
 
 /**
- * Get default CORS options if none are provided
- *
- * TODO: support cors config.
+ * Check if an origin is allowed for CORS.
+ * Allows localhost/127.0.0.1 on the server port, file:// protocol,
+ * and any additional origins from TARKO_ALLOWED_ORIGINS env var.
  */
-export function getDefaultCorsOptions(): cors.CorsOptions {
+function isAllowedOrigin(origin: string | undefined, port: number): boolean {
+  if (!origin) {
+    // Allow requests with no Origin header (e.g., curl, same-origin)
+    return true;
+  }
+
+  const allowedOrigins = new Set([
+    `http://localhost:${port}`,
+    `http://127.0.0.1:${port}`,
+    'file://',
+  ]);
+
+  // Support additional origins via environment variable
+  const extraOrigins = process.env.TARKO_ALLOWED_ORIGINS;
+  if (extraOrigins) {
+    for (const o of extraOrigins.split(',')) {
+      const trimmed = o.trim();
+      if (trimmed) {
+        allowedOrigins.add(trimmed);
+      }
+    }
+  }
+
+  if (allowedOrigins.has(origin)) {
+    return true;
+  }
+
+  // Also allow file:// origins (which may have a path suffix)
+  if (origin.startsWith('file://')) {
+    return true;
+  }
+
+  return false;
+}
+
+/**
+ * Get CORS options with origin whitelist based on server port.
+ */
+export function getDefaultCorsOptions(port: number): cors.CorsOptions {
   return {
-    origin: '*',
+    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
+      if (isAllowedOrigin(origin, port)) {
+        callback(null, true);
+      } else {
+        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
+      }
+    },
     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
-    allowedHeaders: ['Content-Type', 'Authorization'],
+    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
   };
 }
 
+/**
+ * Security headers middleware
+ */
+function securityHeadersMiddleware(
+  _req: express.Request,
+  res: express.Response,
+  next: express.NextFunction,
+): void {
+  res.setHeader('X-Content-Type-Options', 'nosniff');
+  res.setHeader('X-Frame-Options', 'DENY');
+  res.setHeader('X-XSS-Protection', '1; mode=block');
+  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
+  next();
+}
+
 /**
  * Setup API middleware and routes
  * @param app Express application instance
- * @param options Server options
+ * @param options Server options including port for CORS configuration
  */
 export function setupAPI(
   app: express.Application,
   options?: {
     workspacePath?: string;
     isDebug?: boolean;
+    port?: number;
   },
 ) {
-  // Apply CORS middleware
-  app.use(cors(getDefaultCorsOptions()));
+  const port = options?.port ?? 3000;
+
+  // Apply security headers
+  app.use(securityHeadersMiddleware);
+
+  // Apply CORS middleware with origin whitelist
+  app.use(cors(getDefaultCorsOptions(port)));
 
   // Apply JSON body parser middleware
   app.use(express.json({ limit: '20mb' }));
 
+  // Register CSRF token endpoint (before CSRF protection so GET is accessible)
+  registerCsrfRoutes(app);
+
+  // Apply CSRF protection middleware (after body parser, before routes)
+  app.use(csrfProtectionMiddleware);
+
   // Add app.group method
   app.group = (
     prefix: string,
```

**File**: `multimodal/tarko/agent-server/src/api/middleware/csrf-protection.ts` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+/*
+ * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+import crypto from 'crypto';
+import type { Request, Response, NextFunction } from 'express';
+
+const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
+const MAX_TOKENS = 1000;
+
+const tokenStore = new Map<string, number>();
+
+function cleanExpiredTokens(): void {
+  const now = Date.now();
+  for (const [token, expiry] of tokenStore) {
+    if (expiry <= now) {
+      tokenStore.delete(token);
+    }
+  }
+}
+
+export function generateCsrfToken(): string {
+  // Clean expired tokens periodically
+  if (tokenStore.size > MAX_TOKENS) {
+    cleanExpiredTokens();
+  }
+
+  const token = crypto.randomBytes(32).toString('hex');
+  tokenStore.set(token, Date.now() + TOKEN_EXPIRY_MS);
+  return token;
+}
+
+function isValidToken(token: string): boolean {
+  const expiry = tokenStore.get(token);
+  if (!expiry) {
+    return false;
+  }
+  if (Date.now() > expiry) {
+    tokenStore.delete(token);
+    return false;
+  }
+  return true;
+}
+
+const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
+
+/**
+ * CSRF protection middleware for Express.
+ * Validates X-CSRF-Token header on mutation requests (POST/PUT/DELETE).
+ * Safe methods (GET/HEAD/OPTIONS) are allowed through.
+ */
+export function csrfProtectionMiddleware(req: Request, res: Response, next: NextFunction): void {
+  if (SAFE_METHODS.has(req.method)) {
+    next();
+    return;
+  }
+
+  const token = req.headers['x-csrf-token'] as string | undefined;
+  if (!token || !isValidToken(token)) {
+    res.status(403).json({
+      error: 'CSRF token missing or invalid',
+      message: 'A valid CSRF token is required for mutation requests. Obtain one via GET /api/v1/csrf-token.',
+    });
+    return;
+  }
+
+  next();
+}
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

---

### Incident Patch 11: `427f1448` (2026-02-24)
**Commit Message**: docs: fix grammar in README news entry (#1805)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -72,7 +72,7 @@ English | [简体中文](./README.zh-CN.md)
 ## News
 
 - **\[2025-11-05\]** 🎉 We're excited to announce the release of [Agent TARS CLI v0.3.0](https://github.com/bytedance/UI-TARS-desktop/releases/tag/v0.3.0)! This version brings streaming support for multiple tools (shell commands, multi-file structured display), runtime settings with timing statistics for tool calls and deep thinking, Event Stream Viewer for data flow tracking and debugging. Additionally, it features exclusive support for [AIO agent Sandbox](https://github.com/agent-infra/sandbox) as isolated all-in-one tools execution environment.
-- **\[2025-06-25\]** We released a Agent TARS Beta and Agent TARS CLI - [Introducing Agent TARS Beta](https://agent-tars.com/blog/2025-06-25-introducing-agent-tars-beta.html), a multimodal AI agent that aims to explore a work form that is closer to human-like task completion through rich multimodal capabilities (such as GUI Agent, Vision) and seamless integration with various real-world tools.
+- **\[2025-06-25\]** We released an Agent TARS Beta and Agent TARS CLI - [Introducing Agent TARS Beta](https://agent-tars.com/blog/2025-06-25-introducing-agent-tars-beta.html), a multimodal AI agent that aims to explore a work form that is closer to human-like task completion through rich multimodal capabilities (such as GUI Agent, Vision) and seamless integration with various real-world tools.
 - **\[2025-06-12\]** - 🎁 We are thrilled to announce the release of UI-TARS Desktop v0.2.0! This update introduces two powerful new features: **Remote Computer Operator** and **Remote Browser Operator**—both completely free. No configuration required: simply click to remotely control any computer or browser, and experience a new level of convenience and intelligence.
 - **\[2025-04-17\]** - 🎉 We're thrilled to announce the release of new UI-TARS Desktop application v0.1.0, featuring a redesigned Agent UI. The application enhances the computer using experience, introduces new browser operation features, and supports [the advanced UI-TARS-1.5 model](https://seed-tars.com/1.5) for improved performance and precise control.
 - **\[2025-02-20\]** - 📦 Introduced [UI TARS SDK](./docs/sdk.md), is a powerful cross-platform toolkit for building GUI automation agents.
```

---

### Incident Patch 12: `476c5a19` (2026-02-23)
**Commit Message**: chore: remove debug console.logs and fix typos (#1820)

**File**: `multimodal/tarko/agent-server/src/utils/agent-resolver.ts` (modified, +12/-12)
```diff
@@ -21,23 +21,23 @@ interface AgentResolutionOptions {
 }
 
 export async function resolveAgentImplementation(
-  implementaion?: AgentImplementation,
+  implementation?: AgentImplementation,
   options?: AgentResolutionOptions,
 ): Promise<AgentResolutionResult> {
-  if (!implementaion) {
-    throw new Error(`Missing agent implmentation`);
+  if (!implementation) {
+    throw new Error(`Missing agent implementation`);
   }
 
-  if (isAgentImplementationType(implementaion, 'module')) {
+  if (isAgentImplementationType(implementation, 'module')) {
     return {
-      agentName: implementaion.label ?? implementaion.constructor.label ?? 'Anonymous',
-      agentConstructor: implementaion.constructor,
-      agioProviderConstructor: implementaion.agio,
+      agentName: implementation.label ?? implementation.constructor.label ?? 'Anonymous',
+      agentConstructor: implementation.constructor,
+      agioProviderConstructor: implementation.agio,
     };
   }
 
-  if (isAgentImplementationType(implementaion, 'modulePath')) {
-    const agentModulePathIdentifier = implementaion.value;
+  if (isAgentImplementationType(implementation, 'modulePath')) {
+    const agentModulePathIdentifier = implementation.value;
 
     try {
       // Build resolve options with workspace path if provided
@@ -74,9 +74,9 @@ export async function resolveAgentImplementation(
       }
 
       return {
-        agentName: implementaion.label ?? agentConstructor.label ?? 'Anonymous',
+        agentName: implementation.label ?? agentConstructor.label ?? 'Anonymous',
         agentConstructor,
-        agioProviderConstructor: implementaion.agio,
+        agioProviderConstructor: implementation.agio,
       };
     } catch (error) {
       throw new Error(
@@ -85,5 +85,5 @@ export async function resolveAgentImplementation(
     }
   }
 
-  throw new Error(`Non-supported agent type: ${implementaion.type}`);
+  throw new Error(`Non-supported agent type: ${implementation.type}`);
 }
```

**File**: `packages/ui-tars/visualizer/src/component/detail-panel.tsx` (modified, +0/-4)
```diff
@@ -170,8 +170,6 @@ const DetailPanel = (): JSX.Element => {
           (nextTask.timing.start - activeTask.timing.start) / playbackSpeed;
       }
 
-      console.log('nextIndex', nextIndex, nextTask);
-
       timeoutId = setTimeout(() => {
         setActiveTask(nextTask);
       }, delay);
@@ -228,8 +226,6 @@ const DetailPanel = (): JSX.Element => {
     };
   });
 
-  console.log('startReplay', startReplay);
-
   return (
     <div className="detail-panel">
       <div className="view-switcher">
```

---

### Incident Patch 13: `3f254968` (2026-01-05)
**Commit Message**: Fix typo, launch* instead of luanch (#1774)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -147,7 +147,7 @@ For more use cases, please check out [#842](https://github.com/bytedance/UI-TARS
 <img alt="Agent TARS CLI" src="https://agent-tars.com/agent-tars-cli.png">
 
 ```bash
-# Luanch with `npx`.
+# Launch with `npx`.
 npx @agent-tars/cli@latest
 
 # Install globally, required Node.js >= 22
```

---

### Incident Patch 14: `482122e0` (2025-12-15)
**Commit Message**: feat(agent-ui): optimize session status action design (#1766)

**File**: `multimodal/tarko/agent-ui/src/common/hooks/useSession.ts` (modified, +1/-26)
```diff
@@ -21,7 +21,6 @@ import {
   deleteSessionAction,
   sendMessageAction,
   abortQueryAction,
-  checkSessionStatusAction,
 } from '../state/actions/sessionActions';
 import {
   initConnectionMonitoringAction,
@@ -64,29 +63,6 @@ export function useSession() {
   const abortQuery = useSetAtom(abortQueryAction);
   const initConnectionMonitoring = useSetAtom(initConnectionMonitoringAction);
   const checkServerStatus = useSetAtom(checkConnectionStatusAction);
-  const checkSessionStatus = useSetAtom(checkSessionStatusAction);
-
-  const statusCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
-
-  useEffect(() => {
-    if (!activeSessionId || !connectionStatus.connected || isReplayMode) return;
-
-    if (statusCheckTimeoutRef.current) {
-      clearTimeout(statusCheckTimeoutRef.current);
-    }
-
-    statusCheckTimeoutRef.current = setTimeout(() => {
-      if (activeSessionId && connectionStatus.connected && !isReplayMode) {
-        checkSessionStatus(activeSessionId);
-      }
-    }, 200);
-
-    return () => {
-      if (statusCheckTimeoutRef.current) {
-        clearTimeout(statusCheckTimeoutRef.current);
-      }
-    };
-  }, [activeSessionId, connectionStatus.connected, checkSessionStatus, isReplayMode]);
 
   const sessionState = useMemo(
     () => ({
@@ -122,7 +98,7 @@ export function useSession() {
       initConnectionMonitoring,
       checkServerStatus,
 
-      checkSessionStatus,
+
     }),
     [
       sessions,
@@ -151,7 +127,6 @@ export function useSession() {
       setWorkspaceDisplayState,
       initConnectionMonitoring,
       checkServerStatus,
-      checkSessionStatus,
     ],
   );
 
```

**File**: `multimodal/tarko/agent-ui/src/common/state/actions/eventProcessors/handlers/AgentRunHandler.ts` (modified, +11/-10)
```diff
@@ -1,7 +1,6 @@
-import { isProcessingAtom } from '@/common/state/atoms/ui';
+import { sessionProcessingStatesAtom } from '@/common/state/atoms/ui';
 import { AgentEventStream } from '@/common/types';
 import { EventHandler, EventHandlerContext } from '../types';
-import { shouldUpdateProcessingState } from '../utils/panelContentUpdater';
 
 export class AgentRunStartHandler implements EventHandler<AgentEventStream.AgentRunStartEvent> {
   canHandle(event: AgentEventStream.Event): event is AgentEventStream.AgentRunStartEvent {
@@ -15,10 +14,11 @@ export class AgentRunStartHandler implements EventHandler<AgentEventStream.Agent
   ): void {
     const { set } = context;
 
-    // Update processing state
-    if (shouldUpdateProcessingState(sessionId)) {
-      set(isProcessingAtom, true);
-    }
+    // Update session-isolated processing state
+    set(sessionProcessingStatesAtom, (prev) => ({
+      ...prev,
+      [sessionId]: true,
+    }));
   }
 }
 
@@ -30,9 +30,10 @@ export class AgentRunEndHandler implements EventHandler<AgentEventStream.Event>
   handle(context: EventHandlerContext, sessionId: string, event: AgentEventStream.Event): void {
     const { set } = context;
 
-    // Update processing state
-    if (shouldUpdateProcessingState(sessionId)) {
-      set(isProcessingAtom, false);
-    }
+    // Update session-isolated processing state
+    set(sessionProcessingStatesAtom, (prev) => ({
+      ...prev,
+      [sessionId]: false,
+    }));
   }
 }
```

**File**: `multimodal/tarko/agent-ui/src/common/state/actions/eventProcessors/utils/panelContentUpdater.ts` (modified, +0/-9)
```diff
@@ -17,12 +17,3 @@ export function shouldUpdatePanelContent(get: Getter, sessionId: string): boolea
 
   return true;
 }
-
-/**
- * Helper function to determine if processing state should be updated for a session
- * Always allow processing state updates for the session that owns the event
- */
-export function shouldUpdateProcessingState(sessionId: string): boolean {
-  // Processing state is now session-isolated, so we always update for the event's session
-  return Boolean(sessionId);
-}
```

**File**: `multimodal/tarko/agent-ui/src/common/state/actions/sessionActions.ts` (modified, +23/-45)
```diff
@@ -4,7 +4,7 @@ import { apiService } from '../../services/apiService';
 import { sessionsAtom, activeSessionIdAtom } from '../atoms/session';
 import { messagesAtom } from '../atoms/message';
 import { toolResultsAtom, toolCallResultMap } from '../atoms/tool';
-import { sessionPanelContentAtom, isProcessingAtom } from '../atoms/ui';
+import { sessionPanelContentAtom, sessionProcessingStatesAtom, isProcessingAtom } from '../atoms/ui';
 import { processEventAction } from './eventProcessors';
 import { Message, SessionInfo } from '@/common/types';
 import { connectionStatusAtom } from '../atoms/ui';
@@ -150,7 +150,7 @@ export const setActiveSessionAction = atom(null, async (get, set, sessionId: str
       });
     }
 
-    // Processing state will be managed by SSE events
+
 
     toolCallResultMap.clear();
 
@@ -169,6 +169,27 @@ export const setActiveSessionAction = atom(null, async (get, set, sessionId: str
       }
     }
 
+    // Status recovery with higher priority - always called after events processing
+    // This ensures accurate processing state when SSE connection is established
+    // and overrides any incorrect state from events processing
+    if (!replayState.isActive) {
+      try {
+        const status = await apiService.getSessionStatus(sessionId);
+        set(sessionProcessingStatesAtom, (prev) => ({
+          ...prev,
+          [sessionId]: status.isProcessing,
+        }));
+        console.log(`Recovered processing state for session ${sessionId}: ${status.isProcessing}`);
+      } catch (error) {
+        console.warn(`Failed to recover session status for ${sessionId}:`, error);
+        // Default to false on error to avoid stuck processing state
+        set(sessionProcessingStatesAtom, (prev) => ({
+          ...prev,
+          [sessionId]: false,
+        }));
+      }
+    }
+
     // Always ensure we have the latest session metadata (including modelConfig)
     // This is lightweight since server always provides it
     try {
@@ -410,46 +431,3 @@ export const abortQueryAction = atom(null, async (get, set) => {
     return false;
   }
 });
-
-// Cache to prevent frequent status checks for the same session
-const statusCheckCache = new Map<string, { timestamp: number; promise?: Promise<any> }>();
-const STATUS_CACHE_TTL = 2000; // 2 seconds cache
-
-export const checkSessionStatusAction = atom(null, async (get, set, sessionId: string) => {
-  if (!sessionId) return;
-
-  const now = Date.now();
-  const cached = statusCheckCache.get(sessionId);
-
-  // If we have a recent check or an ongoing request, skip
-  if (cached) {
-    if (cached.promise) {
-      // There's already an ongoing request for this session
-      return cached.promise;
-    }
-    if (now - cached.timestamp < STATUS_CACHE_TTL) {
-      // Recent check, skip
-      return;
-    }
-  }
-
-  try {
-    // Mark that we're making a request
-    const promise = apiService.getSessionStatus(sessionId);
-    statusCheckCache.set(sessionId, { timestamp: now, promise });
-
-    const status = await promise;
-
-    // Update simple processing state
-    set(isProcessingAtom, status.isProcessing);
-
-    // Clear the promise and update timestamp
-    statusCheckCache.set(sessionId, { timestamp: now });
-
-    return status;
-  } catch (error) {
-    console.error('Failed to check session status:', error);
-    // Clear the failed request
-    statusCheckCache.delete(sessionId);
-  }
-});
```

**File**: `multimodal/tarko/agent-ui/src/common/state/atoms/ui.ts` (modified, +24/-2)
```diff
@@ -57,9 +57,31 @@ export const sidebarCollapsedAtom = atom<boolean>(true);
 export const workspacePanelCollapsedAtom = atom<boolean>(false);
 
 /**
- * Simple processing state atom based on SSE events
+ * Session-isolated processing state atom based on SSE events
+ * Maps session IDs to their processing states
  */
-export const isProcessingAtom = atom<boolean>(false);
+export const sessionProcessingStatesAtom = atom<Record<string, boolean>>({});
+
+/**
+ * Derived atom for the current active session's processing state
+ * Automatically isolates state by active session
+ */
+export const isProcessingAtom = atom(
+  (get) => {
+    const activeSessionId = get(activeSessionIdAtom);
+    const sessionProcessingStates = get(sessionProcessingStatesAtom);
+    return activeSessionId ? sessionProcessingStates[activeSessionId] ?? false : false;
+  },
+  (get, set, update: boolean) => {
+    const activeSessionId = get(activeSessionIdAtom);
+    if (activeSessionId) {
+      set(sessionProcessingStatesAtom, (prev) => ({
+        ...prev,
+        [activeSessionId]: update,
+      }));
+    }
+  },
+);
 
 /**
  * Workspace display mode - determines what content is shown in the workspace
```

---

### Incident Patch 15: `52ae5fb8` (2025-12-15)
**Commit Message**: feat(agent-ui): add embed-frame support for nav items (#1761)

**File**: `multimodal/omni-tars/omni-agent/src/index.ts` (modified, +3/-0)
```diff
@@ -205,11 +205,14 @@ export default class OmniTARSAgent extends ComposableAgent {
           title: 'Code Server',
           link: sandboxBaseUrl + '/code-server/',
           icon: 'code',
+          behavior: 'new-page',
         },
         {
           title: 'VNC',
           link: sandboxBaseUrl + '/vnc/index.html?autoconnect=true',
           icon: 'monitor',
+          behavior: 'embed-frame',
+          autoActive: true,
         },
       ],
     },
```

**File**: `multimodal/tarko/agent-ui/docs/runtime-settings-autoactive.md` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+# Runtime Settings-based AutoActive Feature
+
+## Overview
+
+The `autoActive` property in `workspace.navItems` supports dynamic evaluation based on `api/v1/runtime-settings` values, enabling conditional auto-activation of embedded frames.
+
+## How It Works
+
+### autoActive Design Logic
+
+1. **Backward Compatibility**: `autoActive?: boolean` works as before
+2. **String Expressions**: `autoActive?: string` accepts JavaScript expressions
+3. **Dynamic Evaluation**: Navbar fetches runtime settings and evaluates expressions in real-time
+4. **Safe Execution**: Uses `new Function()` with limited scope for security
+
+### Runtime Settings Consumption
+
+1. **API Endpoint**: `apiService.getSessionRuntimeSettings(sessionId)` returns current settings
+2. **Data Structure**: `{ currentValues: Record<string, any> }` contains user settings
+3. **Real-time Updates**: Refetched when session changes
+4. **Expression Context**: Runtime settings passed as `runtimeSettings` parameter
+
+## Usage Examples
+
+### Basic Boolean (Backward Compatible)
+```json
+{
+  "workspace": {
+    "navItems": [
+      {
+        "title": "Code Server",
+        "link": "{prefix}/code-server/",
+        "icon": "code",
+        "behavior": "embed-frame",
+        "autoActive": true
+      }
+    ]
+  }
+}
+```
+
+### Dynamic Expression
+```json
+{
+  "workspace": {
+    "navItems": [
+      {
+        "title": "VNC",
+        "link": "{prefix}/vnc/index.html?autoconnect=true",
+        "icon": "monitor",
+        "behavior": "embed-frame",
+        "autoActive": "runtimeSettings.agentMode === 'game'"
+      }
+    ]
+  }
+}
+```
+
+## Real-world Example
+
+From `examples/webui-config.json`:
+```json
+{
+  "workspace": {
+    "navItems": [
+      {
+        "title": "Code Server",
+        "link": "{prefix}/code-server/",
+        "icon": "code",
+        "behavior": "embed-frame"
+      },
+      {
+        "title": "VNC",
+        "link": "{prefix}/vnc/index.html?autoconnect=true",
+        "icon": "monitor",
+        "behavior": "embed-frame",
+        "autoActive": "debug(runtimeSettings) && runtimeSettings.agentMode === 'game'"
+      }
+    ]
+  }
+}
+```
```

**File**: `multimodal/tarko/agent-ui/examples/webui-config.json` (added, +185/-0)
```diff
@@ -0,0 +1,185 @@
+{
+  "logo": "https://lf3-static.bytednsdoc.com/obj/eden-cn/zyha-aulnh/ljhwZthlaukjlkulzlp/icon.png",
+  "title": "Omni Agent",
+  "subtitle": "Offering seamless integration with a wide range of real-world tools.",
+  "welcomTitle": "Let’s work it out",
+  "welcomePrompts": [],
+  "welcomeCards": [
+    {
+      "title": "2048",
+      "category": "Game",
+      "image": "https://img.poki-cdn.com/cdn-cgi/image/q=78,scq=50,width=80,height=80,fit=cover,f=auto/cb8c967c-4a78-4ffa-8506-cbac69746f4f/2048.png",
+      "agentOptions": {
+        "agentMode": {
+          "id": "game",
+          "link": "https://poki.com/zh/g/2048",
+          "browserMode": "hybrid"
+        }
+      }
+    },
+    {
+      "title": "Four in a Row",
+      "category": "Game",
+      "image": "https://img.poki-cdn.com/cdn-cgi/image/q=78,scq=50,width=80,height=80,fit=cover,f=auto/e80686db-b0fb-4f2c-bd2f-3a89734f102a/four-in-a-row.jpg",
+      "agentOptions": {
+        "agentMode": {
+          "id": "game",
+          "link": "https://poki.com/zh/g/four-in-a-row",
+          "browserMode": "hybrid"
+        }
+      }
+    },
+    {
+      "title": "Block the Pig",
+      "category": "Game",
+      "image": "https://img.poki-cdn.com/cdn-cgi/image/q=78,scq=50,width=80,height=80,fit=cover,f=auto/9fec1234ce2afd5e789f56da463dcffc/block-the-pig.jpeg",
+      "agentOptions": {
+        "agentMode": {
+          "id": "game",
+          "link": "https://poki.com/zh/g/block-the-pig",
+          "browserMode": "hybrid"
+        }
+      }
+    },
+    {
+      "title": "Factory Balls Forever",
+      "category": "Game",
+      "image": "https://img.poki-cdn.com/cdn-cgi/image/q=78,scq=50,width=80,height=80,fit=cover,f=auto/2a503d0a1d9475d6e62c7ea11caa429ab952aa8f500755613a34e66e2196fe82/factory-balls-forever.png",
+      "agentOptions": {
+        "agentMode": {
+          "id": "game",
+          "link": "https://poki.com/zh/g/factory-balls-forever",
+          "browserMode": "hybrid"
+        }
+      }
+    },
+    {
+      "title": "Snake Solver",
+      "category": "Game",
+      "image": "https://img.poki-cdn.com/cdn-cgi/image/q=78,scq=50,width=80,height=80,fit=cover,f=auto/e466baf845544ef47e0dfbd60f127071/snake-solver.png",
+      "agentOptions": {
+        "agentMode": {
+          "id": "game",
+          "link": "https://poki.com/zh/g/snake-solver",
+          "browserMode": "hybrid"
+        }
+      }
+    },
+    {
+      "title": "Penalty Kicks",
+      "category": "Game",
+      "image": "https://img.poki-cdn.com/cdn-cgi/image/q=78,scq=50,width=80,height=80,fit=cover,f=auto/0770daaa8c4ff3c36dd53e6e41f59396/penalty-kicks.png",
+      "agentOptions": {
+        "agentMode": {
+          "id": "game",
+          "link": "https://poki.com/zh/g/penalty-kicks",
+          "browserMode": "hybrid"
+        }
+      }
+    },
+    {
+      "title": "GUI Agent Research",
+      "category": "Research",
+      "prompt": "Search for the latest GUI Agent papers",
+      "image": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop&crop=center"
+    },
+    {
+      "title": "UI TARS Information",
+      "category": "Research",
+      "prompt": "Find information about UI TARS",
+      "image": "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=300&fit=crop&crop=center"
+    },
+    {
+      "title": "ProductHunt Trends",
+      "category": "Research",
+      "prompt": "Tell me the top 5 most popular projects on ProductHunt today",
+      "image": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop&crop=center"
+    },
+    {
+      "title": "Python Hello World",
+      "category": "Code",
+      "prompt": "Write hello world using python",
+      "image": "https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=400&h=300&fit=crop&crop=center"
+    },
+    {
+      "title": "Jupyter Math Comparison",
+      "category": "Code",
+      "prompt": "Use jupyter to calculate which is greater in 9.11 and 9.9",
+      "image": "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=300&fit=crop&crop=center"
+    },
+    {
+      "title": "Reproduce Seed-TARS",
+      "category": "Code",
+      "prompt": "Write code to reproduce seed-tars.com",
+      "image": "https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=400&h=300&fit=crop&crop=center"
+    },
+    {
+      "title": "Seed-TARS Summary",
+      "category": "Research",
+      "prompt": "Summary seed-tars.com/1.5",
+      "image": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop&crop=center"
+    },
+    {
+      "title": "PDF to Markdown Converter",
+      "category": "Code",
+      "prompt": "Write a python code to download the paper https://arxiv.org/abs/2505.12370, and convert the pdf to markdown",
+      "image": "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=300&fit=crop&crop=center"
+    },
+    {
+      "title"
```

**File**: `multimodal/tarko/agent-ui/src/common/hooks/useSession.ts` (modified, +17/-1)
```diff
@@ -4,7 +4,13 @@ import { messagesAtom, groupedMessagesAtom } from '../state/atoms/message';
 import { toolResultsAtom } from '../state/atoms/tool';
 
 import { sessionFilesAtom } from '../state/atoms/files';
-import { isProcessingAtom, activePanelContentAtom, connectionStatusAtom } from '../state/atoms/ui';
+import {
+  isProcessingAtom,
+  activePanelContentAtom,
+  connectionStatusAtom,
+  activeEmbedFrameAtom,
+  workspaceDisplayStateAtom,
+} from '../state/atoms/ui';
 import { replayStateAtom } from '../state/atoms/replay';
 import {
   loadSessionsAction,
@@ -35,6 +41,8 @@ export function useSession() {
   const [isProcessing, setIsProcessing] = useAtom(isProcessingAtom);
   const [activePanelContent, setActivePanelContent] = useAtom(activePanelContentAtom);
   const [connectionStatus, setConnectionStatus] = useAtom(connectionStatusAtom);
+  const [activeEmbedFrame, setActiveEmbedFrame] = useAtom(activeEmbedFrameAtom);
+  const [workspaceDisplayState, setWorkspaceDisplayState] = useAtom(workspaceDisplayStateAtom);
 
   const [replayState, setReplayState] = useAtom(replayStateAtom);
 
@@ -91,6 +99,8 @@ export function useSession() {
       isProcessing,
       activePanelContent,
       connectionStatus,
+      activeEmbedFrame,
+      workspaceDisplayState,
 
       replayState,
       sessionMetadata,
@@ -106,6 +116,8 @@ export function useSession() {
       abortQuery,
 
       setActivePanelContent,
+      setActiveEmbedFrame,
+      setWorkspaceDisplayState,
 
       initConnectionMonitoring,
       checkServerStatus,
@@ -122,6 +134,8 @@ export function useSession() {
       isProcessing,
       activePanelContent,
       connectionStatus,
+      activeEmbedFrame,
+      workspaceDisplayState,
       replayState,
       sessionMetadata,
       loadSessions,
@@ -133,6 +147,8 @@ export function useSession() {
       sendMessage,
       abortQuery,
       setActivePanelContent,
+      setActiveEmbedFrame,
+      setWorkspaceDisplayState,
       initConnectionMonitoring,
       checkServerStatus,
       checkSessionStatus,
```

**File**: `multimodal/tarko/agent-ui/src/common/state/actions/eventProcessors/handlers/SystemHandler.ts` (modified, +5/-5)
```diff
@@ -5,6 +5,7 @@ import { messagesAtom } from '@/common/state/atoms/message';
 import { sessionPanelContentAtom } from '@/common/state/atoms/ui';
 import { shouldUpdatePanelContent } from '../utils/panelContentUpdater';
 import { ChatCompletionContentPartImage } from '@tarko/agent-interface';
+import { StandardPanelContent } from '@/standalone/workspace/types/index';
 
 export class SystemMessageHandler implements EventHandler<AgentEventStream.SystemEvent> {
   canHandle(event: AgentEventStream.Event): event is AgentEventStream.SystemEvent {
@@ -91,21 +92,20 @@ export class EnvironmentInputHandler
         const currentSessionPanel = currentPanelContent[sessionId];
 
         // Common panel properties
-        const basePanelContent = {
+        const basePanelContent: Partial<StandardPanelContent> = {
           title: event.description || 'Environment Screenshot',
           timestamp: event.timestamp,
-          originalContent: event.content,
           environmentId: event.id,
         };
 
-        let panelContent = null;
+        let panelContent: StandardPanelContent | null = null;
 
         if (isFirstEnvironmentInput) {
           // First environment input: always show as simple image
           panelContent = {
             ...basePanelContent,
             type: 'image',
-            source: imageContent.image_url.url,
+            source: imageContent.image_url.url as string,
           };
         } else if (
           currentSessionPanel?.type === 'browser_vision_control' ||
@@ -115,7 +115,7 @@ export class EnvironmentInputHandler
           panelContent = {
             ...basePanelContent,
             type: 'browser_vision_control',
-            source: null,
+            source: undefined,
             title: event.description || 'Browser Screenshot',
           };
         }
```

**File**: `multimodal/tarko/agent-ui/src/common/state/actions/eventProcessors/handlers/ToolHandler.ts` (modified, +77/-56)
```diff
@@ -5,12 +5,17 @@ import { AgentEventStream, ToolResult, Message } from '@/common/types';
 import { determineToolRendererType } from '@/common/utils/tool-renderers';
 import { messagesAtom } from '@/common/state/atoms/message';
 import { toolResultsAtom, toolCallResultMap } from '@/common/state/atoms/tool';
-import { sessionPanelContentAtom } from '@/common/state/atoms/ui';
+import {
+  sessionPanelContentAtom,
+  showToolContentAtom,
+  workspaceDisplayStateAtom,
+} from '@/common/state/atoms/ui';
 import { rawToolMappingAtom } from '@/common/state/atoms/rawEvents';
 import { toolCallArgumentsCache, streamingToolCallCache } from '../utils/cacheManager';
 import { collectFileInfo } from '../utils/fileCollector';
 import { normalizeSearchResult } from '../utils/searchNormalizer';
 import { shouldUpdatePanelContent } from '../utils/panelContentUpdater';
+import { StandardPanelContent } from '@/standalone/workspace/types/panelContent';
 
 export class ToolCallHandler implements EventHandler<AgentEventStream.ToolCallEvent> {
   canHandle(event: AgentEventStream.Event): event is AgentEventStream.ToolCallEvent {
@@ -126,58 +131,63 @@ export class ToolResultHandler implements EventHandler<AgentEventStream.ToolResu
 
     // Update panel content only for active session
     if (shouldUpdatePanelContent(get, sessionId)) {
+      const panelContent: StandardPanelContent = {
+        type: result.type,
+        source: result.content,
+        title: result.name,
+        timestamp: result.timestamp,
+        toolCallId: result.toolCallId,
+        error: result.error,
+        arguments: args,
+        _extra: result._extra,
+      };
+
+      // Check if embed frame is currently active - if so, don't override it
+      const workspaceState = get(workspaceDisplayStateAtom);
+      const isEmbedFrameActive = workspaceState.mode === 'embed-frame';
+
       // Special handling for browser vision control to preserve environment context
       if (result.type === 'browser_vision_control') {
-        set(sessionPanelContentAtom, (prev) => {
-          const currentContent = prev[sessionId];
-          if (currentContent && currentContent.type === 'image' && currentContent.environmentId) {
-            const environmentId = currentContent.environmentId;
-
-            return {
-              ...prev,
-              [sessionId]: {
-                ...currentContent,
-                type: 'browser_vision_control',
-                source: event.content,
-                title: currentContent.title,
-                timestamp: event.timestamp,
-                toolCallId: event.toolCallId,
-                error: event.error,
-                arguments: args,
-                originalContent: currentContent.source,
-                environmentId: environmentId,
-                processedEnvironmentIds: [environmentId], // Track processed environment IDs
-              },
-            };
-          } else {
-            return {
-              ...prev,
-              [sessionId]: {
-                type: result.type,
-                source: result.content,
-                title: result.name,
-                timestamp: result.timestamp,
-                toolCallId: result.toolCallId,
-                error: result.error,
-                arguments: args,
-              },
-            };
+        const currentContent = get(sessionPanelContentAtom)[sessionId];
+        if (currentContent && currentContent.type === 'image' && currentContent.environmentId) {
+          const environmentId = currentContent.environmentId;
+
+          const enhancedPanelContent: StandardPanelContent = {
+            ...panelContent,
+            type: 'browser_vision_control' as const,
+            environmentId: environmentId,
+          };
+
+          set(sessionPanelContentAtom, (prev) => ({
+            ...prev,
+            [sessionId]: enhancedPanelContent,
+          }));
+
+          // Only update workspace display state if embed frame is not active
+          if (!isEmbedFrameActive) {
+            set(showToolContentAtom, enhancedPanelContent);
+          }
+        } else {
+          set(sessionPanelContentAtom, (prev) => ({
+            ...prev,
+            [sessionId]: panelContent,
+          }));
+
+          // Only update workspace display state if embed frame is not active
+          if (!isEmbedFrameActive) {
+            set(showToolContentAtom, panelContent);
           }
-        });
+        }
       } else {
         set(sessionPanelContentAtom, (prev) => ({
           ...prev,
-          [sessionId]: {
-            type: result.type,
-            source: result.content,
-            title: result.name,
-            timestamp: result.timestamp,
-            toolCallId: result.toolCallId,
-            error: result.error,
-            arguments: args,
-            _extra: result._extra,
-          },
+          [sessionId]: panelContent,
         }));
+
+        // Only update workspace display state if embed frame is n
```

**File**: `multimodal/tarko/agent-ui/src/common/state/actions/eventProcessors/utils/cacheManager.ts` (modified, +3/-3)
```diff
@@ -6,11 +6,11 @@ import { ToolCallArgumentsCache, StreamingToolCallCache } from '../types';
 class ToolCallArgumentsCacheImpl implements ToolCallArgumentsCache {
   private cache = new Map<string, unknown>();
 
-  get(toolCallId: string): unknown {
-    return this.cache.get(toolCallId);
+  get(toolCallId: string): Record<string, unknown> {
+    return this.cache.get(toolCallId) as Record<string, unknown>;
   }
 
-  set(toolCallId: string, args: unknown): void {
+  set(toolCallId: string, args: Record<string, unknown>): void {
     this.cache.set(toolCallId, args);
   }
 
```

**File**: `multimodal/tarko/agent-ui/src/common/state/atoms/ui.ts` (modified, +101/-6)
```diff
@@ -1,13 +1,14 @@
 import { atom } from 'jotai';
-import { SessionItemMetadata, LayoutMode } from '@tarko/interface';
+import { SessionItemMetadata, LayoutMode, WorkspaceNavItem } from '@tarko/interface';
 import { getDefaultLayoutMode } from '@/config/web-ui-config';
-import { ConnectionStatus, PanelContent, SanitizedAgentOptions } from '@/common/types';
+import { ConnectionStatus, SanitizedAgentOptions } from '@/common/types';
 import { activeSessionIdAtom } from './session';
+import { StandardPanelContent } from '@/standalone/workspace/types/panelContent';
 
 /**
  * Session-specific panel content storage
  */
-export const sessionPanelContentAtom = atom<Record<string, PanelContent | null>>({});
+export const sessionPanelContentAtom = atom<Record<string, StandardPanelContent | null>>({});
 
 /**
  * Derived atom for the content currently displayed in the panel
@@ -19,7 +20,7 @@ export const activePanelContentAtom = atom(
     const sessionPanelContent = get(sessionPanelContentAtom);
     return activeSessionId ? sessionPanelContent[activeSessionId] || null : null;
   },
-  (get, set, update: PanelContent | null) => {
+  (get, set, update: StandardPanelContent | null) => {
     const activeSessionId = get(activeSessionIdAtom);
     if (activeSessionId) {
       set(sessionPanelContentAtom, (prev) => ({
@@ -60,6 +61,100 @@ export const workspacePanelCollapsedAtom = atom<boolean>(false);
  */
 export const isProcessingAtom = atom<boolean>(false);
 
+/**
+ * Workspace display mode - determines what content is shown in the workspace
+ */
+export type WorkspaceDisplayMode =
+  | 'idle' // Empty state
+  | 'embed-frame' // Show embed frame (VNC, Code Server, etc.)
+  | 'tool-content'; // Show tool call result
+
+/**
+ * Workspace display state - unified state for workspace content
+ */
+export interface WorkspaceDisplayState {
+  mode: WorkspaceDisplayMode;
+  embedFrame?: WorkspaceNavItem; // Only when mode is 'embed-frame'
+  toolContent?: StandardPanelContent; // Only when mode is 'tool-content'
+}
+
+/**
+ * Session-specific workspace display state storage
+ */
+export const sessionWorkspaceDisplayStateAtom = atom<Record<string, WorkspaceDisplayState>>({});
+
+/**
+ * Derived atom for current workspace display state
+ * Automatically isolates state by active session
+ */
+export const workspaceDisplayStateAtom = atom(
+  (get) => {
+    const activeSessionId = get(activeSessionIdAtom);
+    const sessionWorkspaceDisplayState = get(sessionWorkspaceDisplayStateAtom);
+    return (
+      activeSessionId
+        ? sessionWorkspaceDisplayState[activeSessionId] || { mode: 'idle' }
+        : { mode: 'idle' }
+    ) as WorkspaceDisplayState;
+  },
+  (get, set, update: Partial<WorkspaceDisplayState> | WorkspaceDisplayState) => {
+    const activeSessionId = get(activeSessionIdAtom);
+    if (activeSessionId) {
+      const currentState = get(workspaceDisplayStateAtom);
+      const newState: WorkspaceDisplayState =
+        'mode' in update ? (update as WorkspaceDisplayState) : { ...currentState, ...update };
+      set(sessionWorkspaceDisplayStateAtom, (prev) => ({
+        ...prev,
+        [activeSessionId]: newState,
+      }));
+    }
+  },
+);
+
+/**
+ * Convenience atoms for specific actions
+ */
+export const showEmbedFrameAtom = atom(null, (get, set, navItem: WorkspaceNavItem) => {
+  set(workspaceDisplayStateAtom, {
+    mode: 'embed-frame',
+    embedFrame: navItem,
+  });
+});
+
+export const hideEmbedFrameAtom = atom(null, (get, set) => {
+  set(workspaceDisplayStateAtom, { mode: 'idle' });
+});
+
+export const showToolContentAtom = atom(null, (get, set, content: StandardPanelContent) => {
+  set(workspaceDisplayStateAtom, {
+    mode: 'tool-content',
+    toolContent: content,
+  });
+});
+
+export const clearWorkspaceAtom = atom(null, (get, set) => {
+  set(workspaceDisplayStateAtom, { mode: 'idle' });
+});
+
+/**
+ * Backward compatibility - derived atoms for existing code
+ */
+export const sessionActiveEmbedFrameAtom = atom<Record<string, WorkspaceNavItem | null>>({});
+
+export const activeEmbedFrameAtom = atom(
+  (get) => {
+    const workspaceState = get(workspaceDisplayStateAtom);
+    return workspaceState.mode === 'embed-frame' ? workspaceState.embedFrame || null : null;
+  },
+  (get, set, update: WorkspaceNavItem | null) => {
+    if (update) {
+      set(showEmbedFrameAtom, update);
+    } else {
+      set(hideEmbedFrameAtom);
+    }
+  },
+);
+
 /**
  * Atom for offline mode state (view-only when disconnected)
  */
@@ -117,10 +212,10 @@ export const mobileBottomSheetAtom = atom({
 /**
  * Actions for mobile bottom sheet
  */
-export const openMobileBottomSheetAtom = atom(null, (get, set, fullscreen: boolean = false) => {
+export const openMobileBottomSheetAtom = atom(null, (get, set, fullscreen = false) => {
   set(mobileBottomSheetAtom, {
     isOpen: true,
-    isFullscreen: fullscreen,
+    isFullscreen: fullscreen as boolean,
   });
 });
 
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
