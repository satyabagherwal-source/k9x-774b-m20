# Forensic Learning Record (Deep Inspection): streetwriters/notesnook

> **Canonical Artifact**: `07_PROJECT_LEARNING/streetwriters-notesnook-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/streetwriters/notesnook](https://github.com/streetwriters/notesnook))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:54:14.543Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `streetwriters/notesnook`
- **Description**: A fully open source & end-to-end encrypted note taking alternative to Evernote.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 14715 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/desktop/src/utils/asset-manager.ts`
```
/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import { NativeImage, nativeImage } from "electron";
import path from "path";
import { isDevelopment } from "./index";
import { ParsedImage, parseICO } from "icojs";
import { getSystemTheme } from "./theme";
import { readFile } from "fs/promises";

type Formats = "ico" | "png" | "icns";
type IconOptions<TFormat extends Formats> = {
  size?: 16 | 22 | 24 | 32 | 48 | 64 | 128 | 256 | 512 | 1024;
  format?: TFormat;
};

type IconNames = (typeof icons)[number];
type Prefixes = (typeof prefixes)[number];

type FlexibleIcon<TFormat extends Formats> = TFormat extends "ico"
  ? string
  : NativeImage;

const RESOURCES_DIR = isDevelopment()
  ? process.cwd()
  : process.platform === "darwin"
  ? path.normalize(path.join(path.dirname(process.execPath), "..", "Resources"))
  : path.join(path.dirname(process.execPath), "resources");

const prefixes = ["", ".dark"];
const icons = [
  "note-add",
  "notebook-add",
  "reminder-add",
  "quit",
  "tray-icon"
] as const;

const ALL_ICONS: {
  id: IconNames;
  prefix: Prefixes;
  images: ParsedImage[];
}[] = [];

export class AssetManager {
  static async loadIcons() {
    if (ALL_ICONS.length) return;

    for (const prefix of prefixes) {
      for (const icon of icons) {
        const icoPath = path.join(
          RESOURCES_DIR,
          "assets",
          "icons",
          `${icon}${prefix}.ico`
        );
        const icoBuffer = await readFile(icoPath);
        const images = await parseICO(icoBuffer, "image/png");
        ALL_ICONS.push({ id: icon, images, prefix });
      }
    }
  }

  static appIcon(options: IconOptions<Formats>) {
    const { size = 32, format = "png" } = options;

    if (format === "ico") return "assets\\icons\\app.ico";
    if (format === "icns") return "assets/icons/app.icns";

    return `assets/icons/${size}x${size}.png`;
  }

  static icon<TFormat extends Formats>(
    name: IconNames,
    options: IconOptions<TFormat>
  ): FlexibleIcon<TFormat> {
    const { size = 16, format = "png" } = options;

    const prefix: Prefixes = getSystemTheme() === "dark" ? ".dark" : "";

    const icoPath = path.join(
      RESOURCES_DIR,
      "assets",
      "icons",
      `${name}${prefix}.ico`
    );
    if (format === "ico") return icoPath as FlexibleIcon<TFormat>;

    const icon = ALL_ICONS.find((a) => a.id === name && a.prefix === prefix);
    if (!icon)
      return nativeImage.createFromPath(
        AssetManager.appIcon(options)
      ) as FlexibleIcon<TFormat>;

    return nativeImage.createFromBuffer(
      Buffer.from(
        (icon.images.find((i) => i.height === size) || icon.images[0]).buffer
      )
    ) as FlexibleIcon<TFormat>;
  }
}

```

### Core Architecture Module: `apps/desktop/src/utils/autolaunch.ts`
```
/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
import { app } from "electron";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import path from "path";

const LINUX_DESKTOP_ENTRY = (hidden: boolean) => `[Desktop Entry]
Type=Application
Version=${app.getVersion()}
Name=${app.getName()}
Comment=${app.getName()} startup script
Exec=${
  process.env.APPIMAGE
    ? `${process.env.APPIMAGE}${hidden ? " --hidden" : ""}`
    : `${process.execPath}${hidden ? " --hidden" : ""}`
}
StartupNotify=false
Terminal=false`;

const LINUX_AUTOSTART_DIRECTORY_PATH = path.join(
  app.getPath("home"),
  ".config",
  "autostart"
);

const HIDDEN_ARG = "--hidden";

export class AutoLaunch {
  static enable(hidden: boolean) {
    if (process.platform === "linux") {
      mkdirSync(LINUX_AUTOSTART_DIRECTORY_PATH, { recursive: true });
      writeFileSync(
        path.join(
          LINUX_AUTOSTART_DIRECTORY_PATH,
          `${app.getName().toLowerCase()}.desktop`
        ),
        LINUX_DESKTOP_ENTRY(hidden)
      );
    } else {
      const loginItemSettings = app.getLoginItemSettings({
        args: hidden ? [HIDDEN_ARG] : undefined
      });
      if (loginItemSettings.openAtLogin) return;
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: hidden,
        args: hidden ? [HIDDEN_ARG] : undefined
      });
    }
  }

  static disable() {
    if (process.platform === "linux") {
      const desktopFilePath = path.join(
        LINUX_AUTOSTART_DIRECTORY_PATH,
        `${app.getName().toLowerCase()}.desktop`
      );
      if (!existsSync(desktopFilePath)) return;
      rmSync(desktopFilePath);
    } else {
      app.setLoginItemSettings({ openAtLogin: false, openAsHidden: false });
    }
  }
}

```

### Core Architecture Module: `apps/desktop/src/utils/autoupdater.ts`
```
/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import { autoUpdater } from "electron-updater";
import { config } from "./config";

async function configureAutoUpdater() {
  const releaseTrack =
    config.releaseTrack === "stable" ? "latest" : config.releaseTrack;
  autoUpdater.setFeedURL({
    provider: "generic",
    url: `https://notesnook.com/api/v1/releases/${process.platform}/${releaseTrack}`,
    useMultipleRangeRequest: false,
    channel: releaseTrack
  });

  autoUpdater.autoDownload = config.automaticUpdates;
  autoUpdater.allowDowngrade =
    // only allow downgrade if the current version is a prerelease
    // and the user has changed the release track to stable
    config.releaseTrack === "stable" &&
    autoUpdater.currentVersion.prerelease.length > 0;
  autoUpdater.allowPrerelease = false;
  // Do NOT auto-install on quit. On Windows, if the system shuts down while
  // the NSIS installer is running, it first removes all old files and then
  // gets killed before copying new ones — leaving an empty install directory.
  // Updates should only be installed when the user explicitly triggers it.
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.disableWebInstaller = true;
}

export { configureAutoUpdater };

```

### Core Architecture Module: `apps/desktop/src/utils/bring-to-front.ts`
```
/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import { WindowState } from "./window-state";

export function bringToFront() {
  if (!globalThis.window) return;

  if (globalThis.window.isMinimized()) {
    if (new WindowState({}).isMaximized) {
      globalThis.window.maximize();
    } else globalThis.window.restore();
  }
  globalThis.window.show();
  globalThis.window.focus();
  globalThis.window.moveTop();
  globalThis.window.webContents.focus();
}

```

### Core Architecture Module: `apps/desktop/src/utils/config.ts`
```
/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import { nativeTheme } from "electron";
import { JSONStorage } from "./json-storage";
import { z } from "zod";
import { autoUpdater } from "electron-updater";
import { PATHS } from "../constants";

export const DesktopIntegration = z.object({
  autoStart: z.boolean().optional(),
  startMinimized: z.boolean().optional(),
  minimizeToSystemTray: z.boolean().optional(),
  closeToSystemTray: z.boolean().optional(),
  nativeTitlebar: z.boolean().optional()
});

export type DesktopIntegration = z.infer<typeof DesktopIntegration>;

export const config = {
  desktopSettings: <DesktopIntegration>{
    autoStart: false,
    startMinimized: false,
    minimizeToSystemTray: false,
    closeToSystemTray: false,
    nativeTitlebar: false
  },
  privacyMode: false,
  isSpellCheckerEnabled: true,
  zoomFactor: 1,
  theme: nativeTheme.themeSource,
  automaticUpdates: true,
  proxyRules: "",
  customDns: true,
  releaseTrack: autoUpdater.currentVersion.raw.includes("-beta")
    ? "beta"
    : "stable",

  backgroundColor: nativeTheme.themeSource === "dark" ? "#0f0f0f" : "#ffffff",
  windowControlsIconColor:
    nativeTheme.themeSource === "dark" ? "#ffffff" : "#000000",
  backupDirectory: PATHS.backupsDirectory,
  appLanguage: ""
};

type ConfigKey = keyof typeof config;
for (const key in config) {
  const defaultValue = config[<ConfigKey>key];
  if (Object.hasOwn(config, key)) {
    Object.defineProperty(config, key, {
      get: () => JSONStorage.get(key, defaultValue),
      set: (value) => JSONStorage.set(key, value)
    });
  }
}

```

### Core Architecture Module: `apps/desktop/src/utils/custom-dns.ts`
```
/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import { app } from "electron";

export function enableCustomDns() {
  app.configureHostResolver({
    secureDnsServers: [
      "https://mozilla.cloudflare-dns.com/dns-query",
      "https://dns.quad9.net/dns-query"
    ],
    enableBuiltInResolver: true
  });
}

export function disableCustomDns() {
  app.configureHostResolver({
    secureDnsServers: [],
    enableBuiltInResolver: true
  });
}

```

### Core Architecture Module: `apps/desktop/src/utils/desktop-integration.ts`
```
/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
import { app } from "electron";
import { DesktopIntegration, config } from "./config";
import { setupTray, destroyTray } from "./tray";
import { AutoLaunch } from "./autolaunch";

export function setupDesktopIntegration(
  desktopIntegration: DesktopIntegration
) {
  if (
    desktopIntegration.closeToSystemTray ||
    desktopIntegration.minimizeToSystemTray
  ) {
    setupTray();
  } else {
    destroyTray();
  }

  // when close to system tray is enabled, it becomes nigh impossible
  // to "quit" the app. This is necessary in order to fix that.
  app.on("before-quit", () =>
    desktopIntegration.closeToSystemTray ? app.exit(0) : null
  );

  globalThis.window?.on("close", (e) => {
    if (config.desktopSettings.closeToSystemTray) {
      e.preventDefault();
      if (process.platform == "darwin") {
        // on macOS window cannot be minimized/hidden if it is already fullscreen
        // so we just close it.
        if (globalThis.window?.isFullScreen()) app.exit(0);
        else app.hide();
      } else {
        try {
          globalThis.window?.minimize();
          globalThis.window?.hide();
        } catch (error) {
          console.error(error);
        }
      }
    }
  });

  globalThis.window?.on("minimize", () => {
    if (config.desktopSettings.minimizeToSystemTray) {
      if (process.platform == "darwin") {
        app.hide();
      } else {
        globalThis.window?.hide();
      }
    }
  });

  if (desktopIntegration.autoStart) {
    AutoLaunch.enable(!!desktopIntegration.startMinimized);
  }
}

```

### Core Architecture Module: `apps/desktop/src/utils/index.ts`
```
/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import { app } from "electron";
import { existsSync } from "fs";

export function isDevelopment() {
  return process.env.ELECTRON_IS_DEV
    ? Number.parseInt(process.env.ELECTRON_IS_DEV, 10) === 1
    : !app.isPackaged;
}

export function isFlatpak() {
  return existsSync("/.flatpak-info");
}

export function isSnap() {
  return process.env.SNAP !== undefined;
}

export function isPortable() {
  return process.env.PORTABLE_EXECUTABLE_DIR !== undefined;
}

```

### Core Architecture Module: `apps/desktop/src/utils/json-storage.ts`
```
/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import { readFileSync, writeFileSync } from "fs";
import { app } from "electron";
import { join } from "path";

const directory = app.getPath("userData");
const filename = "config.json";
const filePath = join(directory, filename);
class JSONStorage {
  static get<T>(key: string, def?: T): T {
    const json = this.readJson();
    return json[key] === undefined ? def : json[key];
  }

  static set(key: string, value: unknown) {
    const json = this.readJson();
    json[key] = value;
    this.writeJson(json);
  }

  static clear() {
    this.writeJson({});
  }

  private static readJson() {
    try {
      const json = readFileSync(filePath, "utf-8");
      return JSON.parse(json);
    } catch (e) {
      console.error(e);
      return {};
    }
  }

  private static writeJson(json: Record<string, unknown>) {
    try {
      writeFileSync(filePath, JSON.stringify(json));
    } catch (e) {
      console.error(e);
    }
  }
}
export { JSONStorage };

```

### Core Architecture Module: `apps/desktop/src/utils/jumplist.ts`
```
/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import { app, Menu } from "electron";
import { AssetManager } from "./asset-manager";
import { bringToFront } from "./bring-to-front";
import { bridge } from "../api/bridge";
import { strings } from "@notesnook/intl";

export function setupJumplist() {
  if (process.platform === "win32") {
    setJumplistOnWindows();
  } else if (process.platform === "darwin") {
    setDockMenuOnMacOs();
  }
}

function setJumplistOnWindows() {
  app.setJumpList([
    {
      type: "custom",
      name: strings.quickActions(),
      items: [
        {
          program: process.execPath,
          iconIndex: 0,
          iconPath: AssetManager.icon("note-add", { format: "ico" }),
          args: "new note",
          description: strings.createNewNote(),
          title: strings.newNote(),
          type: "task"
        },
        {
          program: process.execPath,
          iconIndex: 0,
          iconPath: AssetManager.icon("notebook-add", { format: "ico" }),
          args: "new notebook",
          description: strings.createNewNotebook(),
          title: strings.newNotebook(),
          type: "task"
        },
        {
          program: process.execPath,
          iconIndex: 0,
          iconPath: AssetManager.icon("reminder-add", { format: "ico" }),
          args: "new reminder",
          description: strings.addNewReminder(),
          title: strings.newReminder(),
          type: "task"
        }
      ]
    }
  ]);
}

function setDockMenuOnMacOs() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: strings.newNote(),
      type: "normal",
      click: () => {
        bringToFront();
        bridge.onCreateItem("note");
      }
    },
    {
      label: strings.newNotebook(),
      type: "normal",
      click: () => {
        bringToFront();
        bridge.onCreateItem("notebook");
      }
    },
    {
      label: strings.newReminder(),
      type: "normal",
      click: () => {
        bringToFront();
        bridge.onCreateItem("reminder");
      }
    }
  ]);
  app.dock?.setMenu(contextMenu);
}

```

### Core Architecture Module: `apps/desktop/src/utils/locale.ts`
```
/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import { app } from "electron";
import { config } from "./config";
import { initLocale as initIntlLocale } from "@notesnook/intl";

export async function initLocale() {
  return initIntlLocale({
    getSavedLocale: () => config.appLanguage,
    systemLocale: app.getLocale() || "en"
  });
}


```

### Core Architecture Module: `apps/desktop/src/utils/menu.ts`
```
/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import { strings } from "@notesnook/intl";
import { Menu, MenuItem, clipboard, shell } from "electron";

function setupMenu() {
  if (!globalThis.window) return;

  globalThis.window.webContents.on("context-menu", (_event, params) => {
    const menu = new Menu();

    // Add each spelling suggestion
    for (const suggestion of params.dictionarySuggestions) {
      menu.append(
        new MenuItem({
          label: suggestion,
          click: () =>
            globalThis.window?.webContents.replaceMisspelling(suggestion)
        })
      );
    }

    // Allow users to add the misspelled word to the dictionary
    if (params.misspelledWord) {
      menu.append(
        new MenuItem({
          label: strings.addToDictionary(),
          click: () =>
            globalThis.window?.webContents.session.addWordToSpellCheckerDictionary(
              params.misspelledWord
            )
        })
      );
    }

    if (menu.items.length > 0)
      menu.append(
        new MenuItem({
          type: "separator"
        })
      );

    if (params.linkURL.length) {
      menu.append(
        new MenuItem({
          label: strings.openInBrowser(),
          click: () => shell.openExternal(params.linkURL)
        })
      );
    }

    if (params.isEditable) {
      menu.append(
        new MenuItem({
          label: strings.undo(),
          role: "undo",
          enabled: params.isEditable,
          accelerator: "CommandOrControl+Z"
        })
      );

      menu.append(
        new MenuItem({
          label: strings.redo(),
          role: "redo",
          enabled: params.isEditable,
          accelerator: "CommandOrControl+Y"
        })
      );

      menu.append(
        new MenuItem({
          type: "separator"
        })
      );
    }

    if (params.isEditable)
      menu.append(
        new MenuItem({
          label: strings.cut(),
          role: "cut",
          enabled: params.selectionText.length > 0,
          accelerator: "CommandOrControl+X"
        })
      );

    if (params.linkURL?.length) {
      menu.append(
        new MenuItem({
          label: strings.copyLink(),
          click() {
            clipboard.writeText(params.linkURL);
          }
        })
      );

      menu.append(
        new MenuItem({
          label: strings.copyLinkText(),
          click() {
            clipboard.writeText(params.linkText);
          }
        })
      );
    }

    if (params.selectionText.length) {
      menu.append(
        new MenuItem({
          label: strings.copy(),
          role: "copy",
          accelerator: "CommandOrControl+C"
        })
      );
    }

    if (params.mediaType === "image")
      menu.append(
        new MenuItem({
          id: "copy-image",
          label: strings.copyImage(),
          click() {
            globalThis.window?.webContents.copyImageAt(params.x, params.y);
          }
        })
      );

    if (params.isEditable) {
      menu.append(
        new MenuItem({
          label: strings.paste(),
          role: "paste",
          enabled: clipboard.readText("clipboard").length > 0,
          accelerator: "CommandOrControl+V"
        })
      );

      menu.append(
        new MenuItem({
          label:
            process.platform === "darwin"
              ? strings.pasteAndMatchStyle()
              : strings.pasteWithoutFormatting(),
          role: "pasteAndMatchStyle",
          enabled: clipboard.readText("clipboard").length > 0,
          accelerator:
            process.platform === "darwin"
              ? "Option+Shift+Command+V"
              : "Shift+CommandOrControl+V"
        })
      );

      menu.append(
        new MenuItem({
          type: "separator"
        })
      );
      menu.append(
        new MenuItem({
          label: strings.spellCheck(),
          role: "toggleSpellChecker"
        })
      );
    }

    if (menu.items.length > 0) menu.popup();
  });
}
export { setupMenu };

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #10437** (2026-09-30): **Fix/locale translations**
  *Symptoms*: ## Description This PR resolves two main locale detection issues across Desktop, Web, and Mobile: 1. **Desktop Native Locale Bridge:** Removed a legacy Electron switch that was hardcoding the renderer language to `en-US` on desktop (causing fresh installs on macOS/Windows to ignore the OS language). Exposed the native `app.getLocale()` to the renderer via IPC. 2. **Dynamic "Auto" Device Language Sync:**     - Initial app launch now dynamically follows the device/system language without hardcoding or saving a fixed language into settings.    - Added an **"Auto"** option in Language Settings (Web, Desktop, and Mobile) so users can easily reset any manual language selection and resume syncing with their device language.   ## Type of Change - [x] Bug fix - [x] Feature  ## Visuals - [ ] Attached relevant screenshots / screen recording / GIF - [x] N/A (not a feature or no UI changes)  ## Testing - [ ] Ran all E2E tests - [ ] Ran all integration tests - [x] Added/updated tests for this change (if needed) - [ ] N/A (tests not needed — explanation provided below)  ### If tests were not added, explain why <!-- explanation -->  ## Platform <!-- Describe which platforms this PR is related to -->  - [x] Web - [x] Mobile - [x] Desktop  ## Sign-off - [ ] QA passed - [ ] UI/UX passed 

- **Issue #10430** (2026-09-28): **Fix/locale translations**
  *Symptoms*: ## Description This PR extends our ongoing localization efforts by resolving remaining hardcoded user-facing strings across @notesnook/web, @notesnook/mobile and @notesnook/common.  ## Type of Change - [x] Bug fix - [ ] Feature  ## Visuals - [ ] Attached relevant screenshots / screen recording / GIF - [x] N/A (not a feature or no UI changes)  ## Testing - [ ] Ran all E2E tests - [ ] Ran all integration tests - [ ] Added/updated tests for this change (if needed) - [x] N/A (tests not needed — explanation provided below)  ### If tests were not added, explain why <!-- explanation -->  ## Platform <!-- Describe which platforms this PR is related to -->  - [x] Web - [x] Mobile - [x] Desktop  ## Sign-off - [ ] QA passed - [ ] UI/UX passed 

- **Issue #10429** (2026-09-27): **Sort by "date created" does not sort by date created**
  *Symptoms*: ### What happened?  Here's what seems to be a big bug: In "home/all notes", I ungrouped. No groups. Just the notes. Then selected "SORT BY created date".   The note I created in June that I modified today STILL showed up at the top of the list. "Date Created" means the original date that the original note was created on.   "Date Edited" means the (last) date that an actual change was made to the note (which aslo counts as "Modified".)  "Date Modified" means the last time the note was 'touched,' whether or not it was edited - for instance, perhaps someone simply adds a tag, copies a paragraph of it to another note, etc., without changing the note. Unless I am wrong about my understanding of this, "Date Created" should sort by date created, and not date modified or edited. Right?? But the "Date Created" option does not seem to function that way. This is creating a major problem when trying to organize my notes.  ### Steps to reproduce the problem  To reproduce: Make a note. Wait a day - then make another (second) note. Go back to your first note and do somthing to it. Don't touch the second one. Then go to "home/all notes" and select "sort by date created" and see which one shows up on top when sorted by "oldest to newest".  RE: THE PLATFORM/OS question below: I am using both Linux (laptop) and Android (phone). This happens on BOTH. (i.e. the bug seems to sync.)  ### Version  3.4.8-f910e2b-web AND 3.4.12 Android  ### Platform/OS  Other browser  ### Relevant log output  ```shell
  **Post-Mortem & Fix Analysis**:
  > I just figured out what the problem here is. It's my own stupidity. Here's what happened: I copied a note (with the same note title) to another notebook that I created today. It is showing up as "new" because it is in fact a "new" note in a new notebook. My confusion was that I kept the same title.... Rather confusing...but I get it now. Hopefully what I just experienced, and my description of it (and "solution") can help someone else who makes the same mistake!

- **Issue #10423** (2026-09-24): **web: keep separators between multiselect menu items (NN-1187)**
  *Symptoms*:  ## Description <!-- Add a detailed summary of what this feature/bugfix does -->  ## Type of Change - [ ] Bug fix - [ ] Feature  ## Visuals - [ ] Attached relevant screenshots / screen recording / GIF - [ ] N/A (not a feature or no UI changes)  ## Testing - [ ] Ran all E2E tests - [ ] Ran all integration tests - [ ] Added/updated tests for this change (if needed) - [ ] N/A (tests not needed — explanation provided below)  ### If tests were not added, explain why <!-- explanation -->  ## Platform <!-- Describe which platforms this PR is related to -->  - [ ] Web - [ ] Mobile - [ ] Desktop  ## Sign-off - [ ] QA passed - [ ] UI/UX passed 

- **Issue #10422** (2026-09-24): **web: sidebar design fixes**
  *Symptoms*:   ## Description <!-- Add a detailed summary of what this feature/bugfix does -->  web: sidebar design fixes      * NN-1189     * NN-1186     * NN-1181     * NN-1176     * NN-1172     * NN-1158     * NN-1157     * NN-1156     * NN-1155     * NN-1150  ## Type of Change - [ ] Bug fix - [ ] Feature  ## Visuals - [ ] Attached relevant screenshots / screen recording / GIF - [ ] N/A (not a feature or no UI changes)  ## Testing - [ ] Ran all E2E tests - [ ] Ran all integration tests - [ ] Added/updated tests for this change (if needed) - [ ] N/A (tests not needed — explanation provided below)  ### If tests were not added, explain why <!-- explanation -->  ## Platform <!-- Describe which platforms this PR is related to -->  - [ ] Web - [ ] Mobile - [ ] Desktop  ## Sign-off - [ ] QA passed - [ ] UI/UX passed 
  **Post-Mortem & Fix Analysis**:
  > @01zulfi resolve conflicts and merge

- **Issue #10416** (2026-09-24): **Attachment storage is temporarily unavailable. Please try again later**
  *Symptoms*: ### What happened?  This has been happening all evening and my uploaded have not been going thru.  I tried on an iphone and on windows PC and same error  ### Steps to reproduce the problem  create note, add text, click + and choose Upload image or Take image.  Then i get there error even though the image shows in the note but the images don't load on other devices  ### Version  3.4.8-f910e2b-web  ### Platform/OS  Windows  ### Relevant log output  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > Today I was able to take a screenshot and add it to a different / new note and it seemed to sync.  I also tried adding a jpeg and HEIC and they now seem to work

- **Issue #10409** (2026-09-26): **Fix/locale translations**
  *Symptoms*: ## Description Fixes untranslated and static strings across the app (plans screen features, group headers, and reminder times) by localizing titles directly at the source, ensuring proper i18n instance synchronization across packages, and adding missing translation tags and catalogs in @notesnook/intl. (Additional translation fixes will be added to this PR).  ## Type of Change - [x] Bug fix - [ ] Feature  ## Visuals - [ ] Attached relevant screenshots / screen recording / GIF - [ ] N/A (not a feature or no UI changes)  ## Testing - [ ] Ran all E2E tests - [ ] Ran all integration tests - [ ] Added/updated tests for this change (if needed) - [ ] N/A (tests not needed — explanation provided below)  ### If tests were not added, explain why <!-- explanation -->  ## Platform <!-- Describe which platforms this PR is related to -->  - [ ] Web - [ ] Mobile - [ ] Desktop  ## Sign-off - [ ] QA passed - [ ] UI/UX passed 

- **Issue #10393** (2026-09-26): **web: redesign various dialogs**
  *Symptoms*:   ## Description <!-- Add a detailed summary of what this feature/bugfix does -->  web: redesign various dialogs  Redesign the followign dialogs: * Confirm dialog * Create color dialog * Edit note creation date dialog * Item dialog * Note expiry date dialog * Password dialog * Progress dialog * Prompt dialog * Recovery key dialog  ## Type of Change - [ ] Bug fix - [ ] Feature  ## Visuals - [ ] Attached relevant screenshots / screen recording / GIF - [ ] N/A (not a feature or no UI changes)  ## Testing - [ ] Ran all E2E tests - [ ] Ran all integration tests - [ ] Added/updated tests for this change (if needed) - [ ] N/A (tests not needed — explanation provided below)  ### If tests were not added, explain why <!-- explanation -->  ## Platform <!-- Describe which platforms this PR is related to -->  - [ ] Web - [ ] Mobile - [ ] Desktop  ## Sign-off - [ ] QA passed - [ ] UI/UX passed 
  **Post-Mortem & Fix Analysis**:
  > @01zulfi resolve conflicts and merge.

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

### Incident Patch 1: `bf909697` (2026-09-18)
**Commit Message**: Merge pull request #10366 from mohdsultan18/fix/archive-notes-bleed

web: isolate archive route cache and clear stale context notes on switch

**File**: `apps/web/src/navigation/routes.tsx` (modified, +1/-1)
```diff
@@ -107,7 +107,7 @@ const routes = defineRoutes({
   "/archive": () => {
     useNoteStore.getState().setContext({ type: "archive" });
     return defineRoute({
-      key: "notes",
+      key: "archive",
       title: strings.archive(),
       type: "notes",
       component: Notes
```

**File**: `apps/web/src/stores/note-store.ts` (modified, +1/-0)
```diff
@@ -58,6 +58,7 @@ class NoteStore extends BaseStore<NoteStore> {
   };
 
   setContext = async (context?: Context) => {
+    this.set({ context, contextNotes: undefined });
     const groupOptions =
       context?.type === "notebook" ||
       context?.type === "tag" ||
```

---

### Incident Patch 2: `bbcbfd61` (2026-09-18)
**Commit Message**: global: migrate packages off lingui to @notesnook/intl

Co-authored-by: Abdullah Atta <[REDACTED_EMAIL]>

**File**: `apps/desktop/package-lock.json` (modified, +0/-76)
```diff
@@ -10,7 +10,6 @@
       "hasInstallScript": true,
       "license": "GPL-3.0-or-later",
       "dependencies": {
-        "@lingui/core": "5.1.2",
         "@notesnook/intl": "file:../../packages/intl",
         "@notesnook/ui": "file:../../packages/ui",
         "@trpc/client": "10.45.2",
@@ -103,15 +102,6 @@
         "react-modal": ">=3"
       }
     },
-    "node_modules/@babel/runtime": {
-      "version": "7.29.7",
-      "resolved": "https://registry.npmjs.org/@babel/runtime/-/runtime-7.29.7.tgz",
-      "integrity": "sha512-Nq8OhGWiZIZGV6hLHoyAKLLcJihP/xFeBMGJoUrxTX2psI8dCifzLhZISFb+VWS3wFMRDmCGw5R+dOySCqPLhw==",
-      "license": "MIT",
-      "engines": {
-        "node": ">=6.9.0"
-      }
-    },
     "node_modules/@borewit/text-codec": {
       "version": "0.2.2",
       "resolved": "https://registry.npmjs.org/@borewit/text-codec/-/text-codec-0.2.2.tgz",
@@ -975,45 +965,6 @@
       "dev": true,
       "license": "MIT"
     },
-    "node_modules/@lingui/core": {
-      "version": "5.1.2",
-      "resolved": "https://registry.npmjs.org/@lingui/core/-/core-5.1.2.tgz",
-      "integrity": "sha512-biqmMCWuBBj7ERSpgGSV91hTShnSrR/RIFUcNKjWuZYgDd3HpBdEmXKCo9NTanQYbkBUpmyw/bgwsSBex6vkDA==",
-      "license": "MIT",
-      "dependencies": {
-        "@babel/runtime": "^7.20.13",
-        "@lingui/message-utils": "^5.1.2",
-        "unraw": "^3.0.0"
-      },
-      "engines": {
-        "node": ">=20.0.0"
-      },
-      "peerDependencies": {
-        "@lingui/babel-plugin-lingui-macro": "5.1.2",
-        "babel-plugin-macros": "2 || 3"
-      },
-      "peerDependenciesMeta": {
-        "@lingui/babel-plugin-lingui-macro": {
-          "optional": true
-        },
-        "babel-plugin-macros": {
-          "optional": true
-        }
-      }
-    },
-    "node_modules/@lingui/message-utils": {
-      "version": "5.9.5",
-      "resolved": "https://registry.npmjs.org/@lingui/message-utils/-/message-utils-5.9.5.tgz",
-      "integrity": "sha512-t3dNbjb1dWkvcpXGMXIEyBDO3l4B8J2ColZXi0NTG1ioAj+sDfFxFB8fepVgd3JAk+AwARlOLvF14oS0mAdgpw==",
-      "license": "MIT",
-      "dependencies": {
-        "@messageformat/parser": "^5.0.0",
-        "js-sha256": "^0.10.1"
-      },
-      "engines": {
-        "node": ">=20.0.0"
-      }
-    },
     "node_modules/@malept/cross-spawn-promise": {
       "version": "2.0.0",
       "resolved": "https://registry.npmjs.org/@malept/cross-spawn-promise/-/cross-spawn-promise-2.0.0.tgz",
@@ -1092,15 +1043,6 @@
         "node": ">= 10.0.0"
       }
     },
-    "node_modules/@messageformat/parser": {
-      "version": "5.1.1",
-      "resolved": "https://registry.npmjs.org/@messageformat/parser/-/parser-5.1.1.tgz",
-      "integrity": "sha512-3p0YRGCcTUCYvBKLIxtDDyrJ0YijGIwrTRu1DT8gIviIDZru8H23+FkY6MJBzM1n9n20CiM4VeDYuBsrrwnLjg==",
-      "license": "MIT",
-      "dependencies": {
-        "moo": "^0.5.1"
-      }
-    },
     "node_modules/@noble/hashes": {
       "version": "2.2.0",
       "resolved": "https://registry.npmjs.org/@noble/hashes/-/hashes-2.2.0.tgz",
@@ -4473,12 +4415,6 @@
       "integrity": "sha512-WZzeDOEtTOBK4Mdsar0IqEU5sMr3vSV2RqkAIzUEV2BHnUfKGyswWFPFwK5EeDo93K3FohSHbLAjj0s1Wzd+dg==",
       "license": "BSD-3-Clause"
     },
-    "node_modules/js-sha256": {
-      "version": "0.10.1",
-      "resolved": "https://registry.npmjs.org/js-sha256/-/js-sha256-0.10.1.tgz",
-      "integrity": "sha512-5obBtsz9301ULlsgggLg542s/jqtddfOpV5KJc4hajc9JV8GeY2gZHSVpYBn4nWqAUTJ9v+xwtbJ1mIBgIH5Vw==",
-      "license": "MIT"
-    },
     "node_modules/js-tokens": {
       "version": "9.0.1",
       "resolved": "https://registry.npmjs.org/js-tokens/-/js-tokens-9.0.1.tgz",
@@ -4773,12 +4709,6 @@
       "integrity": "sha512-gKLcREMhtuZRwRAfqP3RFW+TK4JqApVBtOIftVgjuABpAtpxhPGaDcfvbhNvD0B8iD1oUr/txX35NjcaY6Ns/A==",
       "license": "MIT"
     },
-    "node_modules/moo": {
-      "version": "0.5.3",
-      "resolved": "https://registry.npmjs.org/moo/-/moo-0.5.3.tgz",
-      "integrity": "sha512-m2fmM2dDm7GZQsY7KK2cme8agi+AAljILjQnof7p1ZMDe6dQ4bdnSMx0cPppudoeNv5hEFQirN6u+O4fDE0IWA==",
-      "license": "BSD-3-Clause"
-    },
     "node_modules/ms": {
       "version": "2.1.3",
       "resolved": "https://registry.npmjs.org/ms/-/ms-2.1.3.tgz",
@@ -6866,12 +6796,6 @@
         "node": ">= 4.0.0"
       }
     },
-    "node_modules/unraw": {
-      "version": "3.0.0",
-      "resolved": "https://registry.npmjs.org/unraw/-/unraw-3.0.0.tgz",
-      "integrity": "sha512-08/DA66UF65OlpUDIQtbJyrqTR0jTAlJ+jsnkQ4jxR7+K5g5YG1APZKQSMCE1vqqmD+2pv6+IdEjmopFatacvg==",
-      "license": "MIT"
-    },
     "node_modules/unzipper": {
       "version": "0.12.5",
       "resolved": "https://registry.npmjs.org/unzipper/-/unzipper-0.12.5.tgz",
```

**File**: `apps/desktop/package.json` (modified, +0/-1)
```diff
@@ -38,7 +38,6 @@
   "repository": "https://github.com/streetwriters/notesnook",
   "license": "GPL-3.0-or-later",
   "dependencies": {
-    "@lingui/core": "5.1.2",
     "@notesnook/intl": "file:../../packages/intl",
     "@notesnook/ui": "file:../../packages/ui",
     "@trpc/client": "10.45.2",
```

**File**: `apps/desktop/src/api/os-integration.ts` (modified, +6/-3)
```diff
@@ -38,6 +38,8 @@ import { observable } from "@trpc/server/observable";
 import { AssetManager } from "../utils/asset-manager";
 import { isFlatpak, isPortable, isSnap } from "../utils";
 import { setupDesktopIntegration } from "../utils/desktop-integration";
+import { setupJumplist } from "../utils/jumplist";
+import { initLocale } from "../utils/locale";
 import { disableCustomDns, enableCustomDns } from "../utils/custom-dns";
 import type { MenuItem as NNMenuItem } from "@notesnook/ui";
 import { platform } from "os";
@@ -138,10 +140,11 @@ export const osIntegrationRouter = t.router({
   }),
   setAppLanguage: t.procedure
     .input(z.string())
-    .mutation(({ input: language }) => {
+    .mutation(async ({ input: language }) => {
       config.appLanguage = language;
-      app.relaunch();
-      app.exit();
+      await initLocale();
+      setupDesktopIntegration(config.desktopSettings);
+      setupJumplist();
     }),
   restart: t.procedure.query(() => {
     app.relaunch();
```

**File**: `apps/mobile/app/app.tsx` (modified, +1/-7)
```diff
@@ -16,8 +16,6 @@ GNU General Public License for more details.
 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
-import { i18n } from "@notesnook/intl";
-import { I18nProvider } from "@lingui/react";
 import {
   ScopedThemeProvider,
   THEME_COMPATIBILITY_VERSION,
@@ -179,11 +177,7 @@ export const withTheme = (
       }
     }, [colorScheme, darkTheme, lightTheme]);
 
-    return (
-      <I18nProvider i18n={i18n as any}>
-        <Element {...props} />
-      </I18nProvider>
-    );
+    return <Element {...props} />;
   };
 };
 
```

**File**: `apps/mobile/lingui.config.js` (removed, +0/-27)
```diff
@@ -1,27 +0,0 @@
-/*
-This file is part of the Notesnook project (https://notesnook.com/)
-
-Copyright (C) 2023 Streetwriters (Private) Limited
-
-This program is free software: you can redistribute it and/or modify
-it under the terms of the GNU General Public License as published by
-the Free Software Foundation, either version 3 of the License, or
-(at your option) any later version.
-
-This program is distributed in the hope that it will be useful,
-but WITHOUT ANY WARRANTY; without even the implied warranty of
-MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
-GNU General Public License for more details.
-
-You should have received a copy of the GNU General Public License
-along with this program.  If not, see <http://www.gnu.org/licenses/>.
-*/
-
-/** @type {import('@lingui/conf').LinguiConfig} */
-
-module.exports = {
-  locales: ["en", "cs", "fr"],
-  sourceLocale: "en",
-  format: "po",
-  compileNamespace: "ts"
-};
```

**File**: `apps/mobile/package.json` (modified, +0/-2)
```diff
@@ -42,8 +42,6 @@
     "@formatjs/intl-locale": "4.0.0",
     "@formatjs/intl-pluralrules": "5.2.14",
     "@legendapp/list": "^2.0.14",
-    "@lingui/core": "5.1.2",
-    "@lingui/react": "5.1.2",
     "@mdi/js": "^6.7.96",
     "@messageformat/parser": "^5.1.1",
     "@notesnook/common": "file:../../packages/common",
```

**File**: `apps/mobile/rspack.config.js` (modified, +0/-1)
```diff
@@ -109,7 +109,6 @@ module.exports = (env) => {
         "@mdi/js": path.join(__dirname, "node_modules/@mdi/js/mdi.js"),
         katex: path.join(__dirname, "node_modules/katex"),
         tinycolor2: path.join(__dirname, "node_modules/tinycolor2"),
-        "@lingui/core": path.join(__dirname, "node_modules/@lingui/core"),
         "@swc/helpers": path.join(__dirname, "node_modules/@swc/helpers"),
         "@messageformat/parser": path.join(
           __dirname,
```

**File**: `apps/monograph/app/components/monographpost/editor.client.tsx` (modified, +3/-11)
```diff
@@ -29,19 +29,11 @@ import { useLayoutEffect, useMemo, useRef } from "react";
 import { Flex } from "@theme-ui/components";
 import TipTap, { type TipTapProps } from "./tiptap";
 import { ScopedThemeProvider } from "../theme-provider";
-import { setI18nGlobal, Messages } from "@notesnook/intl";
-import { i18n } from "@lingui/core";
+import { initLocale } from "@notesnook/intl";
 
-const locale = import.meta.env.DEV
-  ? import("@notesnook/intl/locales/$pseudo-LOCALE.json")
-  : import("@notesnook/intl/locales/$en.json");
-locale.then(({ default: locale }) => {
-  i18n.load({
-    en: locale.messages as unknown as Messages
-  });
-  i18n.activate("en");
+initLocale({
+  systemLocale: typeof navigator !== "undefined" ? navigator.language : "en"
 });
-setI18nGlobal(i18n);
 
 export type EditorType = typeof Editor;
 
```

---

### Incident Patch 3: `8cc3a56a` (2026-09-17)
**Commit Message**: intl: localize remaining strings and fix 2FA/localization

Co-authored-by: Abdullah Atta <[REDACTED_EMAIL]>

**File**: `apps/mobile/app/components/attachments/index.tsx` (modified, +5/-2)
```diff
@@ -521,7 +521,8 @@ export const AttachmentDialog = ({
               style={{
                 height: "100%",
                 justifyContent: "center",
-                alignItems: "center"
+                alignItems: "center",
+                paddingHorizontal: DefaultAppStyles.GAP
               }}
             >
               {loading ? (
@@ -533,7 +534,9 @@ export const AttachmentDialog = ({
                     size={60}
                     color={colors.secondary.icon}
                   />
-                  <Paragraph>{strings.noAttachments()}</Paragraph>
+                  <Paragraph style={{ textAlign: "center" }}>
+                    {strings.noAttachments()}
+                  </Paragraph>
                 </>
               )}
             </View>
```

**File**: `apps/mobile/app/components/auth/two-factor.tsx` (modified, +9/-4)
```diff
@@ -101,7 +101,14 @@ const TwoFactorVerification = ({
         setLoading(false);
       },
       (e) => {
-        setError(e);
+        if (
+          e?.message &&
+          /valid multi-factor authentication code/i.test(e.message)
+        ) {
+          setError(new Error(strings.validMfaCodeRequired()));
+        } else {
+          setError(e);
+        }
       }
     );
     setLoading(false);
@@ -155,9 +162,7 @@ const TwoFactorVerification = ({
       setSending(false);
     } catch (e) {
       setSending(false);
-      setError(
-        new Error(`Error sending 2FA Code. Tap "Send code" to try again `)
-      );
+      setError(new Error(strings.unableToSend2faCode()));
     }
   }, [currentMethod.method, secondsRef, sending, start]);
 
```

**File**: `apps/mobile/app/components/dialogs/progress/index.tsx` (modified, +2/-1)
```diff
@@ -30,6 +30,7 @@ import { ProgressBarComponent } from "../../ui/svg/lazy";
 import Heading from "../../ui/typography/heading";
 import Paragraph from "../../ui/typography/paragraph";
 import { DefaultAppStyles } from "../../../utils/styles";
+import { strings } from "@notesnook/intl";
 
 export type ProgressOptions = {
   progress?: string;
@@ -167,7 +168,7 @@ export default function Progress() {
 
           {!data?.canHideProgress ? null : (
             <Button
-              title={cancelCallback.current ? "Cancel" : "Hide"}
+              title={cancelCallback.current ? strings.cancel() : strings.hide()}
               type="secondaryAccented"
               onPress={() => {
                 if (cancelCallback.current) {
```

**File**: `apps/mobile/app/components/note-history/index.tsx` (modified, +6/-2)
```diff
@@ -228,7 +228,10 @@ export default function NoteHistory({
               ) : (
                 <>
                   <Icon name="history" size={50} color={colors.primary.icon} />
-                  <Paragraph color={colors.secondary.paragraph}>
+                  <Paragraph
+                    color={colors.secondary.paragraph}
+                    style={{ textAlign: "center" }}
+                  >
                     {strings.noteHistoryPlaceholder()}
                   </Paragraph>
                 </>
@@ -242,7 +245,8 @@ export default function NoteHistory({
         size={AppFontSize.xs}
         color={colors.secondary.paragraph}
         style={{
-          alignSelf: "center"
+          textAlign: "center",
+          paddingHorizontal: DefaultAppStyles.GAP
         }}
       >
         {strings.noteHistoryNotice[0]()}{" "}
```

**File**: `apps/mobile/app/components/sheets/link-note/index.tsx` (modified, +4/-1)
```diff
@@ -350,7 +350,10 @@ export default function LinkNote(props: {
                   alignItems: "center"
                 }}
               >
-                <Paragraph color={colors.secondary.paragraph}>
+                <Paragraph
+                  color={colors.secondary.paragraph}
+                  style={{ textAlign: "center" }}
+                >
                   {blockLinking?.error}
                 </Paragraph>
                 <Button
```

**File**: `apps/mobile/app/components/sheets/notebooks/index.tsx` (modified, +5/-2)
```diff
@@ -195,10 +195,13 @@ export const Notebooks = (props: {
             width: "100%",
             height: "100%",
             justifyContent: "center",
-            alignItems: "center"
+            alignItems: "center",
+            paddingHorizontal: DefaultAppStyles.GAP
           }}
         >
-          <Paragraph>{strings.emptyPlaceholders("notebook")}</Paragraph>
+          <Paragraph style={{ textAlign: "center" }}>
+            {strings.emptyPlaceholders("notebook")}
+          </Paragraph>
         </View>
       ) : (
         <>
```

**File**: `apps/mobile/app/components/sheets/progress/index.tsx` (modified, +5/-1)
```diff
@@ -28,6 +28,7 @@ import { ProgressBarComponent } from "../../ui/svg/lazy";
 import Heading from "../../ui/typography/heading";
 import Paragraph from "../../ui/typography/paragraph";
 import { strings } from "@notesnook/intl";
+import { DefaultAppStyles } from "../../../utils/styles";
 export const Progress = () => {
   const { colors } = useThemeColors();
   const { progress } = useSyncProgress();
@@ -48,12 +49,15 @@ export const Progress = () => {
         width: "100%",
         justifyContent: "center",
         alignItems: "center",
+        paddingHorizontal: DefaultAppStyles.GAP,
         paddingTop: 25,
         paddingBottom: 15
       }}
     >
       <Heading size={AppFontSize.lg}>{strings.syncingHeading()}</Heading>
-      <Paragraph>{strings.syncingDesc()}</Paragraph>
+      <Paragraph style={{ textAlign: "center" }}>
+        {strings.syncingDesc()}
+      </Paragraph>
       <Seperator />
       <View
         style={{
```

**File**: `apps/mobile/app/components/sheets/references/index.tsx` (modified, +10/-3)
```diff
@@ -360,7 +360,8 @@ const ListNoteItem = ({
           style={{
             justifyContent: "center",
             alignItems: "center",
-            width: "100%"
+            width: "100%",
+            paddingHorizontal: DefaultAppStyles.GAP
           }}
         >
           {loading ? (
@@ -373,7 +374,10 @@ const ListNoteItem = ({
               {listType === "linkedNotes" ? (
                 <>
                   {linkedBlocks.length === 0 ? (
-                    <Paragraph color={colors.secondary.paragraph}>
+                    <Paragraph
+                      color={colors.secondary.paragraph}
+                      style={{ textAlign: "center" }}
+                    >
                       {strings.noBlocksLinked()}
                     </Paragraph>
                   ) : (
@@ -383,7 +387,10 @@ const ListNoteItem = ({
               ) : (
                 <>
                   {noteInternalLinks.length === 0 ? (
-                    <Paragraph color={colors.secondary.paragraph}>
+                    <Paragraph
+                      color={colors.secondary.paragraph}
+                      style={{ textAlign: "center" }}
+                    >
                       {strings.noReferencesFound()}
                     </Paragraph>
                   ) : (
```

---

### Incident Patch 4: `c69863b2` (2026-09-16)
**Commit Message**: intl: localize UI strings across mobile, web and editor

**File**: `apps/desktop/src/api/os-integration.ts` (modified, +2/-2)
```diff
@@ -187,8 +187,8 @@ export const osIntegrationRouter = t.router({
         if (globalThis.window) {
           await dialog.showMessageBox(globalThis.window, {
             type: "error",
-            title: "Path not found",
-            message: `The path does not exist:\n${wrapPath(resolvedPath)}`
+            title: strings.pathNotFound(),
+            message: strings.pathDoesNotExist(wrapPath(resolvedPath))
           });
         }
         return;
```

**File**: `apps/desktop/src/main.ts` (modified, +7/-8)
```diff
@@ -40,6 +40,7 @@ import { disableCustomDns, enableCustomDns } from "./utils/custom-dns";
 import { PATHS } from "./constants";
 import { normalizePathString } from "./utils/resolve-path";
 import { initLocale } from "./utils/locale";
+import { strings } from "@notesnook/intl";
 
 const appHostnames = isDevelopment()
   ? ["localhost", "127.0.0.1"]
@@ -223,11 +224,10 @@ app.once("ready", async () => {
   if (app.runningUnderARM64Translation) {
     console.log("App is running under ARM64 translation");
     dialog.showMessageBoxSync({
-      message:
-        "Notesnook detected that it is running under ARM64 translation. For the best performance, please download the ARM64 build of Notesnook from our website.",
+      message: strings.arm64TranslationWarning(),
       type: "warning",
-      buttons: ["Okay"],
-      title: "Degraded Performance Warning"
+      buttons: [strings.okay()],
+      title: strings.degradedPerformanceWarning()
     });
   }
 
@@ -313,11 +313,10 @@ async function migrateBackupDirectory() {
   } catch (e) {
     console.error("Failed to migrate backup directory", e);
     const pressedButton = dialog.showMessageBoxSync(globalThis.window, {
-      message:
-        "Failed to migrate backup directory. It has been reset to default.",
-      title: "Backup Directory Migration Failed",
+      message: strings.backupDirMigrationFailedDesc(),
+      title: strings.backupDirMigrationFailed(),
       type: "error",
-      buttons: ["Set backup directory", "Ignore"]
+      buttons: [strings.setBackupDir(), strings.ignore()]
     });
     if (pressedButton === 0) {
       await api.integration.selectBackupDirectory();
```

**File**: `apps/desktop/src/utils/jumplist.ts` (modified, +12/-11)
```diff
@@ -21,6 +21,7 @@ import { app, Menu } from "electron";
 import { AssetManager } from "./asset-manager";
 import { bringToFront } from "./bring-to-front";
 import { bridge } from "../api/bridge";
+import { strings } from "@notesnook/intl";
 
 export function setupJumplist() {
   if (process.platform === "win32") {
@@ -34,33 +35,33 @@ function setJumplistOnWindows() {
   app.setJumpList([
     {
       type: "custom",
-      name: "Quick actions",
+      name: strings.quickActions(),
       items: [
         {
           program: process.execPath,
           iconIndex: 0,
           iconPath: AssetManager.icon("note-add", { format: "ico" }),
           args: "new note",
-          description: "Create a new note",
-          title: "New note",
+          description: strings.createNewNote(),
+          title: strings.newNote(),
           type: "task"
         },
         {
           program: process.execPath,
           iconIndex: 0,
           iconPath: AssetManager.icon("notebook-add", { format: "ico" }),
           args: "new notebook",
-          description: "Create a new notebook",
-          title: "New notebook",
+          description: strings.createNewNotebook(),
+          title: strings.newNotebook(),
           type: "task"
         },
         {
           program: process.execPath,
           iconIndex: 0,
           iconPath: AssetManager.icon("reminder-add", { format: "ico" }),
           args: "new reminder",
-          description: "Add a new reminder",
-          title: "New reminder",
+          description: strings.addNewReminder(),
+          title: strings.newReminder(),
           type: "task"
         }
       ]
@@ -71,29 +72,29 @@ function setJumplistOnWindows() {
 function setDockMenuOnMacOs() {
   const contextMenu = Menu.buildFromTemplate([
     {
-      label: "New note",
+      label: strings.newNote(),
       type: "normal",
       click: () => {
         bringToFront();
         bridge.onCreateItem("note");
       }
     },
     {
-      label: "New notebook",
+      label: strings.newNotebook(),
       type: "normal",
       click: () => {
         bringToFront();
         bridge.onCreateItem("notebook");
       }
     },
     {
-      label: "New reminder",
+      label: strings.newReminder(),
       type: "normal",
       click: () => {
         bringToFront();
         bridge.onCreateItem("reminder");
       }
     }
   ]);
-  app.dock.setMenu(contextMenu);
+  app.dock?.setMenu(contextMenu);
 }
```

**File**: `apps/desktop/src/utils/tray.ts` (modified, +5/-4)
```diff
@@ -22,6 +22,7 @@ import { AssetManager } from "./asset-manager";
 import { isFlatpak } from "./index";
 import { bringToFront } from "./bring-to-front";
 import { bridge } from "../api/bridge";
+import { strings } from "@notesnook/intl";
 
 let tray: Tray | undefined = undefined;
 export function destroyTray() {
@@ -42,7 +43,7 @@ export function setupTray() {
 
   const contextMenu = Menu.buildFromTemplate([
     {
-      label: "Show app",
+      label: strings.showApp(),
       type: "normal",
       icon: isFlatpak()
         ? undefined
@@ -51,7 +52,7 @@ export function setupTray() {
     },
     { type: "separator" },
     {
-      label: "New note",
+      label: strings.newNote(),
       type: "normal",
       icon: isFlatpak()
         ? undefined
@@ -62,7 +63,7 @@ export function setupTray() {
       }
     },
     {
-      label: "New notebook",
+      label: strings.newNotebook(),
       type: "normal",
       icon: isFlatpak()
         ? undefined
@@ -74,7 +75,7 @@ export function setupTray() {
     },
     { type: "separator" },
     {
-      label: "Quit",
+      label: strings.quit(),
       icon: isFlatpak()
         ? undefined
         : AssetManager.icon("quit", { size: trayIconSize }),
```

**File**: `apps/mobile/app/common/filesystem/upload.ts` (modified, +1/-1)
```diff
@@ -238,7 +238,7 @@ export async function uploadFile(
       );
       if (status !== "granted") {
         ToastManager.show({
-          message: `The permission to show file upload notification was disallowed by the user.`,
+          message: strings.fileUploadNotificationPermissionDisallowed(),
           type: "info"
         });
       }
```

**File**: `apps/mobile/app/components/auth/signup.tsx` (modified, +2/-2)
```diff
@@ -387,8 +387,8 @@ export const Signup = ({
       ) : (
         <>
           <Loading
-            title={"Setting up your account..."}
-            description="Your account is almost ready, please wait..."
+            title={strings.settingUpAccount()}
+            description={strings.accountAlmostReady()}
           />
         </>
       )}
```

**File**: `apps/mobile/app/components/auth/two-factor.tsx` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ const TwoFactorVerification = ({
   const onNext = async () => {
     if (!code.current || code.current.length < 6) {
       setError(
-        new Error("Please provide a valid multi-factor authentication code.")
+        new Error(strings.validMfaCodeRequired())
       );
       return;
     }
```

**File**: `apps/mobile/app/components/dialogs/jump-to-section/index.tsx` (modified, +2/-1)
```diff
@@ -44,6 +44,7 @@ import BaseDialog from "../../dialog/base-dialog";
 import { Pressable } from "../../ui/pressable";
 import Paragraph from "../../ui/typography/paragraph";
 import { DefaultAppStyles } from "../../../utils/styles";
+import { formatGroupTitle } from "@notesnook/common";
 
 const JumpToSectionDialog = () => {
   const scrollRef = useRef<RefObject<FlatList>>(undefined);
@@ -207,7 +208,7 @@ const JumpToSectionDialog = () => {
                         textAlign: "center"
                       }}
                     >
-                      {item.group.title}
+                      {formatGroupTitle(item.group.title)}
                     </Paragraph>
                   </Pressable>
                 );
```

---

### Incident Patch 5: `825d3910` (2026-09-14)
**Commit Message**: Merge pull request #10359 from streetwriters/fix/copy-url

Fix copying url to clipboard on mobile not working

**File**: `apps/mobile/app/screens/editor/tiptap/use-editor-events.tsx` (modified, +11/-8)
```diff
@@ -399,13 +399,6 @@ export const useEditorEvents = (
         return onBackPress();
       }
 
-      if (
-        editorMessage.sessionId !== editor.sessionId.current &&
-        editorMessage.type !== NativeEvents.status
-      ) {
-        return;
-      }
-
       const noteId = useTabStore
         .getState()
         .getNoteIdForTab(editorMessage.tabId);
@@ -538,7 +531,13 @@ export const useEditorEvents = (
         case EditorEvents.getLinkData: {
           const url = (editorMessage.value as any)?.url as string;
           const link = parseInternalLink(url);
-          if (!link) return;
+          if (!link) {
+            editor.postMessage(NativeEvents.resolve, {
+              resolverId: editorMessage.resolverId,
+              data: undefined
+            });
+            return;
+          }
           switch (link.type) {
             case "note":
             case "notebook":
@@ -687,6 +686,10 @@ export const useEditorEvents = (
         }
         case EditorEvents.copyToClipboard: {
           Clipboard.setString(editorMessage.value as string);
+          ToastManager.show({
+            message: strings.linkCopied(),
+            type: "success"
+          });
           break;
         }
         case EditorEvents.saveScroll: {
```

---

### Incident Patch 6: `bdc14cb1` (2026-09-11)
**Commit Message**: web: fix clear account data & reset password (#10352)

**File**: `apps/web/src/views/recovery.tsx` (modified, +10/-5)
```diff
@@ -424,14 +424,19 @@ function NewPassword(props: BaseRecoveryComponentProps<"new">) {
         const user = await db.user.getUser();
         if (!user) throw new Error(strings.notLoggedIn());
 
-        if (!formData?.recoveryKey)
-          throw new Error("Recovery key is required to reset password.");
-
         if (form.password !== form.confirmPassword)
           throw new Error("Passwords do not match.");
 
-        if (formData?.userResetRequired && !(await db.user.resetUser()))
-          throw new Error("Failed to reset user.");
+        if (formData?.userResetRequired) {
+          if (!(await db.user.resetPasswordWithoutRecoveryKey(form.password)))
+            throw new Error("Could not reset account password.");
+
+          navigate("final");
+          return;
+        }
+
+        if (!formData?.recoveryKey)
+          throw new Error("Recovery key is required to reset password.");
 
         if (
           !(await db.user.resetPassword({
```

**File**: `packages/core/src/api/user-manager.ts` (modified, +51/-3)
```diff
@@ -374,7 +374,7 @@ class UserManager {
   }
 
   changePassword(oldPassword: string, newPassword: string) {
-    return this._updatePassword("change", {
+    return this.updatePassword("change", {
       old_password: oldPassword,
       new_password: newPassword
     });
@@ -398,12 +398,60 @@ class UserManager {
     newPassword: string;
     encryptionKey: SerializedKey;
   }) {
-    return this._updatePassword("reset", {
+    return this.updatePassword("reset", {
       new_password: options.newPassword,
       encryptionKey: options.encryptionKey
     });
   }
 
+  async resetPasswordWithoutRecoveryKey(newPassword: string) {
+    if (!newPassword) throw new Error("New password is required.");
+
+    const token = await this.tokenManager.getAccessToken();
+    const user = await this.getUser();
+    if (!token || !user) throw new Error("You are not logged in.");
+
+    const updateUserPayload: Partial<User> = {};
+    const newMasterKey = await this.db
+      .storage()
+      .generateCryptoKey(newPassword, user.salt);
+
+    updateUserPayload.dataEncryptionKey = await this.keyManager.wrapKey(
+      await this.db.crypto().generateRandomKey(),
+      newMasterKey
+    );
+
+    if (!(await this.resetUser())) throw new Error("Failed to reset user.");
+
+    await http.patch.json(
+      `${constants.API_HOST}/users/password/reset`,
+      {
+        newPassword: await this.db
+          .storage()
+          .hash(newPassword, user.email.toLowerCase()),
+        userKeys: updateUserPayload
+      },
+      token
+    );
+
+    await this.db.storage().deriveCryptoKey({
+      password: newPassword,
+      salt: user.salt
+    });
+
+    this.keyManager.clearCache();
+    await this.setUser({
+      ...user,
+      ...updateUserPayload,
+      attachmentsKey: undefined,
+      monographPasswordsKey: undefined,
+      inboxKeys: undefined,
+      legacyDataEncryptionKey: undefined
+    });
+
+    return true;
+  }
+
   async getDataEncryptionKeys(): Promise<
     { version: KeyVersion; key: SerializedKey }[] | undefined
   > {
@@ -667,7 +715,7 @@ class UserManager {
     }
   }
 
-  async _updatePassword(
+  private async updatePassword(
     type: "change" | "reset",
     data: {
       new_password: string;
```

---

### Incident Patch 7: `8576f206` (2026-09-10)
**Commit Message**: mobile: fix copy url not working in editor on mobile

**File**: `apps/mobile/app/screens/editor/tiptap/use-editor-events.tsx` (modified, +11/-8)
```diff
@@ -399,13 +399,6 @@ export const useEditorEvents = (
         return onBackPress();
       }
 
-      if (
-        editorMessage.sessionId !== editor.sessionId.current &&
-        editorMessage.type !== NativeEvents.status
-      ) {
-        return;
-      }
-
       const noteId = useTabStore
         .getState()
         .getNoteIdForTab(editorMessage.tabId);
@@ -538,7 +531,13 @@ export const useEditorEvents = (
         case EditorEvents.getLinkData: {
           const url = (editorMessage.value as any)?.url as string;
           const link = parseInternalLink(url);
-          if (!link) return;
+          if (!link) {
+            editor.postMessage(NativeEvents.resolve, {
+              resolverId: editorMessage.resolverId,
+              data: undefined
+            });
+            return;
+          }
           switch (link.type) {
             case "note":
             case "notebook":
@@ -687,6 +686,10 @@ export const useEditorEvents = (
         }
         case EditorEvents.copyToClipboard: {
           Clipboard.setString(editorMessage.value as string);
+          ToastManager.show({
+            message: strings.linkCopied(),
+            type: "success"
+          });
           break;
         }
         case EditorEvents.saveScroll: {
```

---

### Incident Patch 8: `de2b9ffc` (2026-09-09)
**Commit Message**: ci: fix help docs publish (#10354)

**File**: `.github/workflows/help.publish.yml` (modified, +1/-0)
```diff
@@ -32,3 +32,4 @@ jobs:
 
       - name: Publish on Cloudflare Pages
         run: npx --yes wrangler deploy
+        working-directory: ./docs/help
```

---

### Incident Patch 9: `1d3f8985` (2026-09-09)
**Commit Message**: docs: fix sitemap urls (#10353)

**File**: `docs/help/.vitepress/config.mts` (modified, +2/-1)
```diff
@@ -36,7 +36,8 @@ export default defineConfig({
   lastUpdated: true,
   metaChunk: true,
   sitemap: {
-    hostname: "https://notesnook.com/help",
+    // Keep the trailing slash so sitemap URLs resolve under /help/.
+    hostname: "https://notesnook.com/help/",
     // Only the latest docs belong in the sitemap.
     transformItems: (items) =>
       items.filter(
```

---

### Incident Patch 10: `6911b2fa` (2026-09-09)
**Commit Message**: core: bound API request time with abort timeout (#10346)

Signed-off-by: dvalin21 <[REDACTED_EMAIL]>

**File**: `packages/core/src/utils/http.ts` (modified, +6/-2)
```diff
@@ -139,9 +139,11 @@ export function errorTransformer(errorJson: {
   };
 }
 
-async function fetchWrapped(input: string, init: RequestInit) {
+async function fetchWrapped(input: string, init: RequestInit, timeoutMs = 30000) {
+  const controller = new AbortController();
+  const timeout = setTimeout(() => controller.abort(), timeoutMs);
   try {
-    const response = await fetch(input, init);
+    const response = await fetch(input, { ...init, signal: controller.signal });
     return response;
   } catch (e) {
     const host = extractHostname(input);
@@ -154,6 +156,8 @@ async function fetchWrapped(input: string, init: RequestInit) {
       );
 
     throw e;
+  } finally {
+    clearTimeout(timeout);
   }
 }
 
```

---

### Incident Patch 11: `143892e2` (2026-09-07)
**Commit Message**: Merge pull request #10282 from kashaf-ansari-dev/fix-uncompressed-images-lost

mobile: prevent dropping uncompressed image attachments on new notes

**File**: `apps/mobile/app/screens/editor/tiptap/picker.ts` (modified, +18/-3)
```diff
@@ -123,10 +123,17 @@ const file = async (fileOptions: PickerOptions) => {
       console.log(e, "error");
     });
 
+    const isNewNote = fileOptions.noteId === undefined;
+    const currentFileNoteId =
+      fileOptions.tabId !== undefined
+        ? useTabStore.getState().getNoteIdForTab(fileOptions.tabId)
+        : undefined;
+
+    const isSameNote = currentFileNoteId === fileOptions.noteId;
+
     if (
       fileOptions.tabId !== undefined &&
-      useTabStore.getState().getNoteIdForTab(fileOptions.tabId) ===
-        fileOptions.noteId
+      (isSameNote || isNewNote)
     ) {
       editorController.current?.commands.insertAttachment(
         {
@@ -245,6 +252,7 @@ const handleImageResponse = async (
   response: Image[],
   options: PickerOptions
 ) => {
+  const isNewNote = options.noteId === undefined;
   const result = await AttachImage.present(response, options.context);
 
   if (!result) return;
@@ -295,9 +303,16 @@ const handleImageResponse = async (
 
     RNFetchBlob.fs.unlink(uri).catch((e) => {});
 
+    const currentNoteId =
+      options.tabId !== undefined
+        ? useTabStore.getState().getNoteIdForTab(options.tabId)
+        : undefined;
+
+    const isSameNote = currentNoteId === options.noteId;
+
     if (
       options.tabId !== undefined &&
-      useTabStore.getState().getNoteIdForTab(options.tabId) === options.noteId
+      (isSameNote || isNewNote)
     ) {
       editorController.current?.commands.insertImage(
         {
```

---

### Incident Patch 12: `4c4ac1c1` (2026-09-02)
**Commit Message**: Merge pull request #10313 from streetwriters/editor/fix-failing-editor-tests

editor: fix three failing editor tests

**File**: `packages/editor/src/extensions/check-list-item/__tests__/check-list-item.test.ts` (modified, +1/-2)
```diff
@@ -21,7 +21,6 @@ import { describe, expect, test } from "vitest";
 import {
   createEditor,
   h,
-  p,
   checkList,
   checkListItem
 } from "../../../../test-utils/index.js";
@@ -36,7 +35,7 @@ describe("check list item", () => {
    */
   test("inline image as first child in check list item", async () => {
     const el = checkList(
-      checkListItem([p(["item 1"])]),
+      checkListItem(["item 1"]),
       checkListItem([h("img", [], { src: "image.png" })])
     );
 
```

**File**: `packages/editor/src/extensions/image/tests/image.test.ts` (modified, +8/-6)
```diff
@@ -55,17 +55,19 @@ test("copy image to clipboard when Ctrl+C is pressed on selected image", async (
   const editorElement = h("div");
   const { editor } = createEditor({
     element: editorElement,
+    // the image is put there as content rather than with `insertImage`, which
+    // needs the attachment extension: what is under test is the copying
+    initialContent: h("img", [], {
+      src: "test.png",
+      "data-hash": testHash,
+      "data-mime": "image/png",
+      "data-filename": "test.png"
+    }).outerHTML,
     extensions: {
       image: ImageNode
     }
   });
   editor.storage.getAttachmentData = vi.fn().mockResolvedValue(mockImageData);
-  editor.commands.insertImage({
-    src: "test.png",
-    hash: testHash,
-    mime: "image/png",
-    filename: "test.png"
-  });
   editor.commands.setNodeSelection(0);
 
   expect(editor.isActive("image")).toBe(true);
```

**File**: `packages/editor/src/extensions/task-item/__tests__/task-item.test.ts` (modified, +1/-2)
```diff
@@ -21,7 +21,6 @@ import { describe, expect, test } from "vitest";
 import {
   createEditor,
   h,
-  p,
   taskList,
   taskItem
 } from "../../../../test-utils/index.js";
@@ -36,7 +35,7 @@ describe("task list item", () => {
    */
   test("inline image as first child in task list item", async () => {
     const el = taskList(
-      taskItem([p(["item 1"])]),
+      taskItem(["item 1"]),
       taskItem([h("img", [], { src: "image.png" })])
     );
 
```

---

### Incident Patch 13: `0a09ad59` (2026-09-02)
**Commit Message**: editor: fix three failing editor tests

The list fixtures passed a paragraph into taskItem/checkListItem, which
wrap their children in one already. The nested markup reparsed into an
extra empty paragraph, so the snapshots never matched. Every other caller
passes strings.

The image test called insertImage, which has delegated to insertAttachment
since 08cf21b0 and is not registered there. It puts the image in as content
instead; copying it is what the test is about.

**File**: `packages/editor/src/extensions/check-list-item/__tests__/check-list-item.test.ts` (modified, +1/-2)
```diff
@@ -21,7 +21,6 @@ import { describe, expect, test } from "vitest";
 import {
   createEditor,
   h,
-  p,
   checkList,
   checkListItem
 } from "../../../../test-utils/index.js";
@@ -36,7 +35,7 @@ describe("check list item", () => {
    */
   test("inline image as first child in check list item", async () => {
     const el = checkList(
-      checkListItem([p(["item 1"])]),
+      checkListItem(["item 1"]),
       checkListItem([h("img", [], { src: "image.png" })])
     );
 
```

**File**: `packages/editor/src/extensions/image/tests/image.test.ts` (modified, +8/-6)
```diff
@@ -55,17 +55,19 @@ test("copy image to clipboard when Ctrl+C is pressed on selected image", async (
   const editorElement = h("div");
   const { editor } = createEditor({
     element: editorElement,
+    // the image is put there as content rather than with `insertImage`, which
+    // needs the attachment extension: what is under test is the copying
+    initialContent: h("img", [], {
+      src: "test.png",
+      "data-hash": testHash,
+      "data-mime": "image/png",
+      "data-filename": "test.png"
+    }).outerHTML,
     extensions: {
       image: ImageNode
     }
   });
   editor.storage.getAttachmentData = vi.fn().mockResolvedValue(mockImageData);
-  editor.commands.insertImage({
-    src: "test.png",
-    hash: testHash,
-    mime: "image/png",
-    filename: "test.png"
-  });
   editor.commands.setNodeSelection(0);
 
   expect(editor.isActive("image")).toBe(true);
```

**File**: `packages/editor/src/extensions/task-item/__tests__/task-item.test.ts` (modified, +1/-2)
```diff
@@ -21,7 +21,6 @@ import { describe, expect, test } from "vitest";
 import {
   createEditor,
   h,
-  p,
   taskList,
   taskItem
 } from "../../../../test-utils/index.js";
@@ -36,7 +35,7 @@ describe("task list item", () => {
    */
   test("inline image as first child in task list item", async () => {
     const el = taskList(
-      taskItem([p(["item 1"])]),
+      taskItem(["item 1"]),
       taskItem([h("img", [], { src: "image.png" })])
     );
 
```

---

### Incident Patch 14: `1e42f89b` (2026-09-01)
**Commit Message**: ci: fix ios platform not found error

**File**: `.github/workflows/ios.publish.yml` (modified, +26/-2)
```diff
@@ -21,8 +21,32 @@ jobs:
 
       - name: Setup iOS Platform
         run: |
-          xcodebuild -downloadPlatform iOS -exportPath ~/Downloads
-          xcodebuild -importPlatform ~/Downloads/iphonesimulator_26.1_23B86.dmg
+          # GitHub runs this as `/bin/bash -e`, so `set +e` is required -- without
+          # it the first failure aborts the step before any retry can happen.
+          # Both commands hit "Unable to connect to simulator" (exit 70) when
+          # CoreSimulatorService is wedged, so retry each and bounce it between.
+          set +e
+          DL_DIR="$RUNNER_TEMP/ios-platform"
+
+          retry() {
+            for i in 1 2 3; do
+              "$@" && return 0
+              echo "Attempt $i failed ($*); resetting CoreSimulator..."
+              sudo killall -9 com.apple.CoreSimulator.CoreSimulatorService simdiskimaged 2>/dev/null
+              sleep 20
+              xcrun simctl list runtimes >/dev/null 2>&1
+            done
+            echo "::error::Failed after 3 attempts: $*"
+            exit 1
+          }
+
+          xcrun simctl list runtimes >/dev/null 2>&1
+          retry xcodebuild -downloadPlatform iOS -exportPath "$DL_DIR"
+
+          # Find the dmg; its name embeds a build number that changes.
+          DMG="$(find "$DL_DIR" -name '*.dmg' | head -n1)"
+          [ -n "$DMG" ] || { echo "::error::No dmg in $DL_DIR"; exit 1; }
+          retry xcodebuild -importPlatform "$DMG"
 
       - name: Install node modules
         run: |
```

---

### Incident Patch 15: `a44c35af` (2026-08-31)
**Commit Message**: Merge pull request #10265 from streetwriters/fix/android-backspace-bug

editor: fix android backspace stopped working after prosemirror-view update

**File**: `packages/editor/patches/prosemirror-view+1.42.2.patch` (modified, +200/-4)
```diff
@@ -1,5 +1,5 @@
 diff --git a/node_modules/prosemirror-view/dist/index.cjs b/node_modules/prosemirror-view/dist/index.cjs
-index a615cb7..c1a6cbb 100644
+index a615cb7..e07b6e0 100644
 --- a/node_modules/prosemirror-view/dist/index.cjs
 +++ b/node_modules/prosemirror-view/dist/index.cjs
 @@ -1005,8 +1005,8 @@ var ViewDesc = function () {
@@ -12,7 +12,64 @@ index a615cb7..c1a6cbb 100644
            if (anchor != head) domSel.extend(headDOM.node, headDOM.offset);
            domSelExtended = true;
          } catch (_) {}
-@@ -3647,7 +3647,7 @@ function handleDrop(view, event, dragging) {
+@@ -2935,6 +2935,8 @@ var InputState = _createClass(function InputState() {
+   this.lastSelectionOrigin = null;
+   this.lastSelectionTime = 0;
+   this.lastIOSEnter = 0;
++  this.lastAndroidEnter = 0;
++  this.androidEnterFallbackTimeout = -1;
+   this.lastIOSEnterFallbackTimeout = -1;
+   this.lastFocus = 0;
+   this.lastTouch = 0;
+@@ -2978,6 +2980,7 @@ function destroyInput(view) {
+   for (var type in view.input.eventHandlers) view.dom.removeEventListener(type, view.input.eventHandlers[type]);
+   clearTimeout(view.input.composingTimeout);
+   clearTimeout(view.input.lastIOSEnterFallbackTimeout);
++  clearTimeout(view.input.androidEnterFallbackTimeout);
+ }
+ function ensureListeners(view) {
+   view.someProp("handleDOMEvents", function (currentHandlers) {
+@@ -3003,11 +3006,30 @@ function _dispatchEvent(view, event) {
+ }
+ editHandlers.keydown = function (view, _event) {
+   var event = _event;
++  if (android && event.keyCode == 13) {
++    var enterNow = Date.now();
++    view.input.lastAndroidEnter = enterNow;
++    clearTimeout(view.input.androidEnterFallbackTimeout);
++    view.input.androidEnterFallbackTimeout = setTimeout(function () {
++      if (view.input.lastAndroidEnter == enterNow) {
++        view.input.lastAndroidEnter = 0;
++        view.domObserver.forceFlush();
++        view.domObserver.flush();
++        view.someProp("handleKeyDown", function (f) {
++          return f(view, keyEvent(13, "Enter"));
++        });
++      }
++    }, 200);
++  }
+   view.input.shiftKey = event.keyCode == 16 || event.shiftKey;
+   if (inOrNearComposition(view)) return;
+   view.input.lastKeyCode = event.keyCode;
+   view.input.lastKeyCodeTime = Date.now();
+-  if (android && chrome && event.keyCode == 13) return;
++  if (android && chrome && event.keyCode == 13) {
++    view.domObserver.forceFlush();
++    view.domObserver.flush();
++    if (view.state.selection.empty) return;
++  }
+   if (event.keyCode != 229) view.domObserver.forceFlush();
+   if (ios && event.keyCode == 13 && !event.ctrlKey && !event.altKey && !event.metaKey) {
+     var now = Date.now();
+@@ -3023,6 +3045,7 @@ editHandlers.keydown = function (view, _event) {
+   } else if (view.someProp("handleKeyDown", function (f) {
+     return f(view, event);
+   }) || captureKeyDown(view, event)) {
++    if (android && event.keyCode == 13) view.input.lastAndroidEnter = 0;
+     event.preventDefault();
+   } else {
+     setSelectionOrigin(view, "key");
+@@ -3647,7 +3670,7 @@ function handleDrop(view, event, dragging) {
      });
      tr.setSelection(selectionBetween(view, $pos, tr.doc.resolve(end)));
    }
@@ -21,8 +78,45 @@ index a615cb7..c1a6cbb 100644
    view.dispatch(tr.setMeta("uiEvent", "drop"));
  }
  handlers.focus = function (view) {
+@@ -3674,6 +3697,7 @@ handlers.blur = function (view, _event) {
+ };
+ handlers.beforeinput = function (view, _event) {
+   var event = _event;
++  if (android && /^insert(Paragraph|LineBreak)/.test(event.inputType)) view.input.lastAndroidEnter = Date.now();
+   if (android && event.inputType == "deleteContentBackward") {
+     view.domObserver.flushSoon();
+     var domChangeCount = view.input.domChangeCount;
+@@ -4841,6 +4865,7 @@ function readDOMChange(view, from, to, typeOver, addedNodes) {
+     return f(view, keyEvent(13, "Enter"));
+   })) {
+     view.input.lastIOSEnter = 0;
++    view.input.lastAndroidEnter = 0;
+     return;
+   }
+   if (!change) {
+@@ -4881,10 +4906,11 @@ function readDOMChange(view, from, to, typeOver, addedNodes) {
+   var inlineChange = $from.sameParent($to) && $from.parent.inlineContent && $fromA.end() >= change.endA;
+   if ((ios && view.input.lastIOSEnter > Date.now() - 225 && (!inlineChange || addedNodes.some(function (n) {
+     return n.nodeName == "DIV" || n.nodeName == "P";
+-  })) || !inlineChange && $from.pos < parse.doc.content.size && (!$from.sameParent($to) || !$from.parent.inlineContent) && $from.pos < $to.pos && !/\S/.test(parse.doc.textBetween($from.pos, $to.pos, "", ""))) && view.someProp("handleKeyDown", function (f) {
++  })) || (!android || view.input.lastAndroidEnter > Date.now() - 225) && !inlineChange && $from.pos < parse.doc.content.size && (!$from.sameParent($to) || !$from.parent.inlineContent) && $from.pos < $to.pos && !/\S/.test(parse.doc.textBetween($from.pos, $to.pos, "", ""))) && view.someProp("handleKeyDown", function (f) {
+     return f(view, keyEvent
```

#### Recent Merged Pull Requests:
- **PR #10437** (2026-09-30): Fix/locale translations (@kashaf-ansari-dev)
- **PR #10430** (2026-09-28): Fix/locale translations (@kashaf-ansari-dev)
- **PR #10423** (2026-09-24): web: keep separators between multiselect menu items (NN-1187) (@01zulfi)
- **PR #10422** (2026-09-24): web: sidebar design fixes (@01zulfi)
- **PR #10409** (2026-09-26): Fix/locale translations (@kashaf-ansari-dev)
- **PR #10393** (2026-09-26): web: redesign various dialogs (@01zulfi)
- **PR #10388** (2026-09-22): ui: redesign menu (@01zulfi)
- **PR #10379** (2026-09-18): mobile: release 3.4.13 (@ammarahm-ed)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
