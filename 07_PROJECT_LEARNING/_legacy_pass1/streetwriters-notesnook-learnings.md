# Forensic Learning Record (Deep Inspection): streetwriters/notesnook

> **Canonical Artifact**: `07_PROJECT_LEARNING/streetwriters-notesnook-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/streetwriters/notesnook](https://github.com/streetwriters/notesnook))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:15:15.958Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `streetwriters/notesnook`
- **Description**: A fully open source & end-to-end encrypted note taking alternative to Evernote.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 14703 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.commitlintrc.js`
```
/* eslint-disable @typescript-eslint/no-var-requires */

const { execSync } = require("child_process");
const { readFileSync } = require("fs");

const authorEmail = execSync(`git config --global --get user.email`)
  .toString("utf-8")
  .trim();
const authors = readFileSync("AUTHORS", "utf-8");
const isAuthor = authors.includes(`<${authorEmail}>`);

const SCOPES = [
  // for full list of scopes + details see: https://github.com/streetwriters/notesnook/blob/master/CONTRIBUTING.md#commit-guidelines

  "mobile",
  "web",
  "vericrypt",
  "monograph",
  "desktop",
  "crypto",
  "editor",
  "logger",
  "theme",
  "server",
  "core",
  "fs",
  "ui",
  "clipper",
  "config",
  "ci",
  "setup",
  "docs",
  "refactor",
  "misc",
  "common",
  "global",
  "docs",
  "themebuilder",
  "intl",
  "webclipper"
];

module.exports = {
  rules: {
    "signed-off-by": [isAuthor ? 0 : 2, "always", `Signed-off-by:`],
    "type-enum": [2, "always", SCOPES],
    "type-empty": [2, "never"]
  }
};

```

### Core Architecture Module: `.eslintrc.js`
```
const LICENSE = [
  "",
  "This file is part of the Notesnook project (https://notesnook.com/)",
  "",
  "Copyright (C) 2023 Streetwriters (Private) Limited",
  "",
  "This program is free software: you can redistribute it and/or modify",
  "it under the terms of the GNU General Public License as published by",
  "the Free Software Foundation, either version 3 of the License, or",
  "(at your option) any later version.",
  "",
  "This program is distributed in the hope that it will be useful,",
  "but WITHOUT ANY WARRANTY; without even the implied warranty of",
  "MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the",
  "GNU General Public License for more details.",
  "",
  "You should have received a copy of the GNU General Public License",
  "along with this program.  If not, see <http://www.gnu.org/licenses/>.",
  ""
];

module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true,
    "jest/globals": true
  },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/jsx-runtime",
    "plugin:jest/style"
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: "latest",
    sourceType: "module"
  },
  plugins: [
    "react",
    "@typescript-eslint",
    "unused-imports",
    "detox",
    "jest",
    "react-native",
    "header",
    "react-hooks"
  ],
  rules: {
    "react-hooks/rules-of-hooks": "error", // Checks rules of Hooks
    "react-hooks/exhaustive-deps": "warn", // Checks effect dependencies
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": [
      "warn",
      {
        vars: "all",
        varsIgnorePattern: "^_",
        args: "after-used",
        argsIgnorePattern: "^_"
      }
    ],
    "linebreak-style": ["error", "unix"],
    "jest/no-mocks-import": 0,
    "@typescript-eslint/no-var-requires": 0,
    quotes: [
      "error",
      "double",
      { avoidEscape: true, allowTemplateLiterals: true }
    ],
    semi: ["error", "always"],
    "@typescript-eslint/no-empty-function": "off",
    "react/prop-types": "off",
    "header/header": ["error", "block", LICENSE, 1],
    "@typescript-eslint/no-empty-interface": [
      "error",
      {
        allowSingleExtends: true
      }
    ]
  },
  settings: {
    react: {
      version: "17"
    }
  },
  overrides: [
    {
      files: ["apps/web/__e2e__/**/**/*.{jsx,tsx,ts,js}"],
      rules: { "react-hooks/rules-of-hooks": "off" }
    },
    {
      files: ["apps/mobile/**/**/*.{jsx,tsx,ts,js}"],
      env: {
        "react-native/react-native": true,
        es2021: true,
        browser: true,
        "detox/detox": true
      },
      rules: {
        // TODO: remove this gradually
        "@typescript-eslint/ban-ts-comment": "off",
        "react/react-in-jsx-scope": 2,
        "react/jsx-uses-react": 2
      }
    }
  ]
};

```

### Core Architecture Module: `.prettierrc.js`
```
module.exports = {
  trailingComma: "none",
  singleQuote: false,
  semi: true,
  printWidth: 80,
  useTabs: false,
  tabWidth: 2,
  bracketSpacing: true,
  endOfLine: "lf"
};

```

### Core Architecture Module: `apps/desktop/global.d.ts`
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
/* eslint-disable no-var */

import { BrowserWindow } from "electron";
import {
  type FormData as FormDataType,
  type Headers as HeadersType,
  type Request as RequestType,
  type Response as ResponseType
} from "undici";

declare global {
  var window: BrowserWindow | null;
  var RELEASE: boolean;
  var MAC_APP_STORE: boolean;

  // Re-export undici fetch function and various classes to global scope.
  // These are classes and functions expected to be at global scope according to Node.js v18 API
  // documentation.
  // See: https://nodejs.org/dist/latest-v18.x/docs/api/globals.html
  // eslint-disable-next-line no-var
  export var {
    FormData,
    Headers,
    Request,
    Response,
    fetch
  }: typeof import("undici");

  type FormData = FormDataType;
  type Headers = HeadersType;
  type Request = RequestType;
  type Response = ResponseType;
}

// NOTE: the import in the global block above needs to be a var for this to work properly.
globalThis.fetch = fetch;
globalThis.FormData = FormData;
globalThis.Headers = Headers;
globalThis.Request = Request;
globalThis.Response = Response;

```

### Core Architecture Module: `apps/desktop/playwright.config.ts`
```
/* eslint-disable header/header */
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type {
  Config,
  PlaywrightTestOptions,
  PlaywrightWorkerOptions
} from "@playwright/test";
import * as path from "path";

process.env.PWPAGE_IMPL = "electron";
process.env.TEST_DESKTOP = "true";
const outputDir = path.join(__dirname, "test-results");
const testDir = path.join(__dirname, "__tests__");
const config: Config<PlaywrightWorkerOptions & PlaywrightTestOptions> = {
  testDir,
  outputDir,
  expect: {
    timeout: 10000
  },
  use: {
    acceptDownloads: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retry-with-video",
    viewport: {
      width: 1920,
      height: 1080
    }
  },
  timeout: 60000,
  globalTimeout: 5400000,
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["dot"], ["json", { outputFile: path.join(outputDir, "report.json") }]]
    : "line",
  projects: [],
  globalSetup: "./__tests__/electron-test/global-setup.ts"
};

const metadata = {
  platform: process.platform,
  headless: "headed",
  browserName: "electron",
  channel: undefined,
  mode: "default",
  video: false
};

config.projects?.push({
  name: "notesnook-desktop",
  // Share screenshots with chromium.
  snapshotPathTemplate:
    "{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-electron{ext}",
  use: {
    browserName: "chromium",
    headless: false
  },
  testDir: "__tests__",
  metadata
});

config.projects?.push({
  name: "notesnook-web",
  // Share screenshots with chromium.
  snapshotPathTemplate:
    "{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-electron{ext}",
  use: {
    browserName: "chromium",
    headless: false
  },
  testDir: path.resolve(__dirname, "../web/__e2e__"),
  metadata
});

export default config;

```

### Core Architecture Module: `apps/desktop/scripts/dev.mjs`
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

import path from "path";
import fs from "fs/promises";
import chokidar from "chokidar";
import { execSync, spawn } from "child_process";
import { fileURLToPath } from "url";
import treekill from "tree-kill";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, "..");
const RUNNING_PROCESSES = [];
const RESTARTABLE_PROCESSES = [];
let lastBundleHash = null;
const ENV = {
  ...process.env,
  NO_COLOR: "true",
  FORCE_COLOR: "false",
  COLOR: "0"
};
process.chdir(root);

await onChange(true);

console.log("Watching...");

const watcher = chokidar.watch("src/", { ignoreInitial: true });
watcher.on("all", () => {
  onChange(false);
});

process.on("SIGINT", async (s) => {
  await cleanup();
});

async function onChange(first) {
  if (first) {
    await fs.rm("./build/", { force: true, recursive: true });

    await exec(
      "npm run postinstall --verbose",
      path.join(root, "node_modules", "electron")
    );

    await exec("yarn electron-builder install-app-deps", root);
  }

  await exec(`yarn run bundle`, root);
  await exec(`yarn run build`, root);

  if (await isBundleSame()) {
    console.log("Bundle is same. Doing nothing.");
    return;
  }

  if (first) {
    await spawnAndWaitUntil(
      ["npm", "run", "start:desktop"],
      path.join(__dirname, "..", "..", "web"),
      (data) => data.includes("Network: use --host to expose")
    );
  }

  if (!first) {
    console.log("Restarting...", RESTARTABLE_PROCESSES.length);
    await killProcesses(RESTARTABLE_PROCESSES);
  }

  execAsync(
    "yarn",
    ["electron", path.join("build", "electron.js")],
    true,
    cleanup
  );
}

function spawnAndWaitUntil(cmd, cwd, predicate) {
  return new Promise((resolve) => {
    console.log(">", ...cmd);

    const s = spawn(cmd[0], cmd.slice(1), {
      cwd,
      env: ENV,
      shell: false
    });

    RUNNING_PROCESSES.push(s);

    s.stderr.pipe(process.stderr);
    s.stdout.on("data", (data) => {
      process.stdout.write(data);
      if (predicate(data)) resolve(undefined); //
    });
  });
}

async function exec(cmd, cwd) {
  try {
    console.log(">", cmd, cwd);

    return execSync(cmd, {
      env: ENV,
      stdio: "inherit",
      shell: false,
      cwd: cwd || process.cwd()
    });
  } catch {
    //ignore
  }
}

function execAsync(cmd, args, restartable, onExit) {
  try {
    console.log(">", cmd, ...args);

    const proc = spawn(cmd, args, {
      stdio: "inherit",
      env: ENV,
      shell: false
    });

    const array = restartable ? RESTARTABLE_PROCESSES : RUNNING_PROCESSES;
    array.push(proc);
    proc.on("exit", (code, signal) => {
      console.log(cmd, ...args, "closed with code", code);
      if (code === 0 && !signal) {
        array.splice(array.indexOf(proc), 1);
        onExit && onExit();
      }
    });
  } catch {
    //ignore
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function killProcesses(processes) {
  for (const process of processes.slice()) {
    processes.splice(processes.indexOf(process), 1);
    await new Promise((resolve, reject) =>
      treekill(process.pid, (err) => (err ? reject(err) : resolve()))
    );
  }
}

async function cleanup() {
  console.log("Cleaning up");

  await killProcesses(RESTARTABLE_PROCESSES);
  await killProcesses(RUNNING_PROCESSES);
  await sleep(1000);

  await fs.rm("./build/", { force: true, recursive: true });
  process.exit();
}

async function isBundleSame() {
  const bundle = Buffer.concat([
    await fs.readFile(path.join(__dirname, "..", "build", "electron.js")),
    await fs.readFile(path.join(__dirname, "..", "build", "preload.js"))
  ]);

  const hashSum = crypto.createHash("sha256");
  hashSum.update(bundle);
  const hex = hashSum.digest("hex");

  if (!lastBundleHash) {
    lastBundleHash = hex;
    return false;
  }
  if (hex === lastBundleHash) return true;
  lastBundleHash = hex;
  return false;
}

```

### Core Architecture Module: `apps/desktop/scripts/patch-better-sqlite3.mjs`
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

import { readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function patchBetterSQLite3() {
  console.log("Patching better-sqlite3");

  const jsonPath = path.join(
    __dirname,
    "..",
    "node_modules",
    "better-sqlite3-multiple-ciphers",
    "package.json"
  );
  const json = JSON.parse(await readFile(jsonPath, "utf-8"));

  delete json.homepage;
  delete json.repository;

  await writeFile(jsonPath, JSON.stringify(json));

  await rm(
    path.join(
      __dirname,
      "..",
      "node_modules",
      "better-sqlite3-multiple-ciphers",
      "build"
    ),
    { force: true, recursive: true }
  );
}

if (process.argv[1] === __filename) {
  patchBetterSQLite3();
}

```

### Core Architecture Module: `apps/desktop/scripts/removeLocales.js`
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

//https://www.electron.build/configuration/configuration#afterpack
exports.default = async function (context) {
  //console.log(context)
  var fs = require("fs");
  var localeDir = context.appOutDir + "/locales/";

  fs.readdir(localeDir, function (err, files) {
    //files is array of filenames (basename form)
    if (!(files && files.length)) return;
    for (var i = 0, len = files.length; i < len; i++) {
      var match = files[i].match(/en-US\.pak/);
      if (match === null) {
        fs.unlinkSync(localeDir + files[i]);
      }
    }
  });
};

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

### Incident Patch 2: `825d3910` (2026-09-14)
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

### Incident Patch 3: `bdc14cb1` (2026-09-11)
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

### Incident Patch 4: `8576f206` (2026-09-10)
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

### Incident Patch 5: `de2b9ffc` (2026-09-09)
**Commit Message**: ci: fix help docs publish (#10354)

**File**: `.github/workflows/help.publish.yml` (modified, +1/-0)
```diff
@@ -32,3 +32,4 @@ jobs:
 
       - name: Publish on Cloudflare Pages
         run: npx --yes wrangler deploy
+        working-directory: ./docs/help
```

---

### Incident Patch 6: `1d3f8985` (2026-09-09)
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

### Incident Patch 7: `143892e2` (2026-09-07)
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

### Incident Patch 8: `4c4ac1c1` (2026-09-02)
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

### Incident Patch 9: `0a09ad59` (2026-09-02)
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

### Incident Patch 10: `1e42f89b` (2026-09-01)
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
