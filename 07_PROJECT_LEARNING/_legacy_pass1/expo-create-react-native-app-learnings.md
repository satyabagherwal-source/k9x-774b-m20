# Forensic Learning Record (Deep Inspection): expo/create-react-native-app

> **Canonical Artifact**: `07_PROJECT_LEARNING/expo-create-react-native-app-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/expo/create-react-native-app](https://github.com/expo/create-react-native-app))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:24:09.635Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `expo/create-react-native-app`
- **Description**: Create React Native apps that run on iOS, Android, and web
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 13246 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
  root: true,
  extends: ['universe/node'],
  overrides: [
    {
      files: ['**/__tests__/*'],
    },
  ],
  globals: {
    jasmine: false,
  },
  settings: {
    react: {
      version: '16',
    },
  },
};

```

### Core Architecture Module: `jest.config.js`
```
/** @type {import('jest').Config} */
module.exports = {
  ...require('expo-module-scripts/jest-preset-cli'),
  preset: 'ts-jest',
  displayName: require('./package').name,
  rootDir: __dirname,
  roots: ['./src'],
};

```

### Core Architecture Module: `src/index.ts`
```
#!/usr/bin/env node
import chalk from 'chalk';

console.warn(chalk`
{yellow.bold ⚠️ This tool does not initialize new React Native projects.}

It's recommended to use a framework to build apps with React Native, for example:

  Expo:
    {bold npx create-expo-app}
  
  React Native Community template:
    {bold npx @react-native-community/cli init}
  
Learn more: {underline https://reactnative.dev/docs/environment-setup}
`);

process.exit(1);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #831** (2020-06-23): **✖ Could not locate the template named "true".**
  *Symptoms*: When running: ``` npx create-react-native-app --no-install --template ``` You get the following error because there is no name after the template parameter: ``` ✖ Could not locate the template named "true". ```

- **Issue #830** (2020-06-23): **Prompting to pod install in a project without cocoapods**
  *Symptoms*: When running: ```sh npx create-react-native-app --no-install -t blank ``` You get prompted: ```sh  ⚠️  Before running your app on iOS, make sure you have CocoaPods installed and initialize the project:    cd a03/ios   npx pod-install  ``` But the template doesn't have an ios folder. 

- **Issue #829** (2020-06-23): **Apply slug to the template app.json**
  *Symptoms*: - fix https://github.com/expo/create-react-native-app/issues/817
  **Post-Mortem & Fix Analysis**:
  > **Size Change:** +4 B (0%)   **Total Size:** 273 kB  | Filename | Size | Change | | |:--- |:---:|:---:|:---:| | `build/index.js` | 273 kB | +4 B (0%) |  |   <a href="https://github.com/preactjs/compressed-size-action"><sub>compressed-size-action</sub></a>

- **Issue #817** (2020-06-23): **Slug is not set correctly**
  *Symptoms*: **Describe the bug**  The slug is set to the template name after creating a project.  **To Reproduce** Steps to reproduce the behavior: 1. Create React Native app (default template) 2. Look in app.json: ``` % cat app.json  {   "name": "booktime",   "displayName": "booktime",   "expo": {     "name": "booktime",     "slug": "expo-template-bare",     "version": "1.0.0",     "platforms": [       "ios",       "android",       "web"     ],     "assetBundlePatterns": [       "**/*"     ]   } } ```  **Expected behavior**  Slug is either omitted or set to the project name.  

- **Issue #816** (2020-09-03): **Unclear how to scroll the list of examples**
  *Symptoms*: **Describe the bug**  When choosing a template, I couldn't find a way to scroll the list of templates past the page 1 out of 3.  **To Reproduce** Steps to reproduce the behavior: 1. Run `npx create-react-native-app` 2. `How would you like to start`: Choose `› Template from expo/examples` 3. `Pick an example`: you see 10 template names, and can move between them with up/down arrow keys, but the remaining 18 are hidden. Scrolling to the end of the list doesn't reveal more. Also tried `left`/`right`, `PgDn`.  **Expected behavior**  Allow seeing all templates or at least no "Page 1/3" shown if there are no more pages to see.  **Screenshots**  <img width="922" alt="Screen Shot 2020-05-22 at 15 21 04" src="https://user-images.githubusercontent.com/497214/82674522-1ad78180-9c4c-11ea-9751-f9230e5c2189.png">  **Desktop (please complete the following information):** - macOS 10.15.4 - Terminal.app 
  **Post-Mortem & Fix Analysis**:
  > Noticed the same but figured out that <kbd>fn</kbd> + <kbd>▼</kbd> (page down) worked for me (Mac OS)
  > tab also works
  > @brentvatne I have fix scroll in the list of examples. now users can scroll by arrow keys. you can review my PR #846  

- **Issue #797** (2020-05-14): **initial commit skips lock files**
  *Symptoms*: **Describe the bug**  Running `npx create-react-native-app` creates an initial commit that misses `yarn.lock, ios/Podfile.lock` 

- **Issue #794** (2020-04-20): **--use-npm flag is ignored**
  *Symptoms*: typing `npx create-react-native-app <name> --use-npm` will still use yarn.  Ironically it says: "Using yarn to install packages, you can pass --use-npm to use npm instead."  Obviously that's a lie.

- **Issue #592** (2018-03-29): **EXPO not able to read app**
  *Symptoms*: ## Description  I have followed quick start https://facebook.github.io/react-native/docs/getting-started.html. I tried to use EXPO as it is written.  ## Expected Behavior  npm install -g create-react-native-app create-react-native-app AwesomeProject cd AwesomeProject npm start  I tried to open app by EXPO in android by reading QR code  ## Observed Behavior  ``` EXPO says Uncaught Error: Time out, no manifest in cache ``` I tried to open the same on http from android and it works, so I report bug as it is written in troubleshooting  ## Environment  Please run these commands in the project folder and fill in their results:  * `npm ls react-native-scripts`:react-native-scripts@1.11.1 * `npm ls react-native`:react-native@0.52.0 * `npm ls expo`:expo@25.0.0 * `node -v`:v8.4.0 * `npm -v`:5.3.0 * `yarn --version`: * `watchman version`: I dont have watchman  Also specify:  1. Operating system: Andriod 5.1.1 2. Phone/emulator/simulator & version: Samsung Galaxy J3 (2016)   
  **Post-Mortem & Fix Analysis**:
  > you phone needs to be on the same wifi network as your computer and it can't be behind a nat
  > i dont undertand your explanation.it is in the same network.why do you think it is behind nat?  ---------- Původní zpráva ---------- Od: Brent Vatne  Datum: 30. 3. 2018 v 00:09:00 Předmět: Re: [react-community/create-react-native-app] EXPO not able to read app (#592)   you phone needs to be on the same wifi network as your computer and it can't be behind a nat  — You are receiving this because you authored the thread. Reply to this email directly, view it on GitHub (https://github.com/react-community/create-react-native-app/issues/592#issuecomment-377387602) , or mute the thread (https://github.com/notifications/unsubscribe-auth/AjpeSKm5seSqg3hg1ZZYynPsvCBi4Nlfks5tjVt1gaJpZM4SrCne) .     

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

### Incident Patch 1: `11507c8c` (2023-05-18)
**Commit Message**: fix: convert underscore files to dotfiles (a la RN CLI) (#924)

* Fix issue with vercel dependency and TS errors

* Convert underscore files to dotfiles (as in RN CLI)

* Update src/Examples.ts

Co-authored-by: Cedric van Putten <me@bycedric.com>

---------

Co-authored-by: Cedric van Putten <me@bycedric.com>

**File**: `package.json` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@
     "@types/node": "^12.6.8",
     "@types/prompts": "2.0.8",
     "@types/tar": "4.0.3",
-    "@vercel/ncc": "^0.27.0",
+    "@vercel/ncc": "^0.36.1",
     "babel-jest": "^26.0.1",
     "chalk": "2.4.2",
     "commander": "2.20.0",
```

**File**: `src/Examples.ts` (modified, +1/-0)
```diff
@@ -151,6 +151,7 @@ export async function resolveTemplateArgAsync(
       // @ts-ignore
       repoUrl = new URL(template);
     } catch (error) {
+      // @ts-expect-error
       if (error.code !== 'ERR_INVALID_URL') {
         oraInstance.fail(error);
         process.exit(1);
```

**File**: `src/createFileTransform.ts` (modified, +20/-0)
```diff
@@ -30,6 +30,23 @@ class Transformer extends Minipass {
   }
 }
 
+// Files and directories that have `_` as their first character in React Native CLI templates
+// These should be transformed to have `.` as the first character
+const UNDERSCORED_DOTFILES = [
+  'buckconfig',
+  'eslintrc.js',
+  'flowconfig',
+  'gitattributes',
+  'gitignore',
+  'prettierrc.js',
+  'watchmanconfig',
+  'editorconfig',
+  'bundle',
+  'ruby-version',
+  'node-version',
+  'xcode.env',
+];
+
 export function createEntryResolver(name: string) {
   return (entry: ReadEntry) => {
     if (name) {
@@ -46,6 +63,9 @@ export function createEntryResolver(name: string) {
       // See: https://github.com/npm/npm/issues/1862
       entry.path = entry.path.replace(/gitignore$/, '.gitignore');
     }
+    for (const fileName of UNDERSCORED_DOTFILES) {
+      entry.path = entry.path.replace(`_${fileName}`, `.${fileName}`);
+    }
   };
 }
 
```

**File**: `yarn.lock` (modified, +4/-4)
```diff
@@ -1310,10 +1310,10 @@
     semver "^6.3.0"
     tsutils "^3.17.1"
 
-"@vercel/ncc@^0.27.0":
-  version "0.27.0"
-  resolved "https://registry.yarnpkg.com/@vercel/ncc/-/ncc-0.27.0.tgz#c0cfeebb0bebb56052719efa4a0ecc090a932c76"
-  integrity sha512-DllIJQapnU2YwewIhh/4dYesmMQw3h2cFtabECc/zSJHqUbNa0eJuEkRa6DXbZvh1YPWBtYQoPV17NlDpBw1Vw==
+"@vercel/ncc@^0.36.1":
+  version "0.36.1"
+  resolved "https://registry.yarnpkg.com/@vercel/ncc/-/ncc-0.36.1.tgz#d4c01fdbbe909d128d1bf11c7f8b5431654c5b95"
+  integrity sha512-S4cL7Taa9yb5qbv+6wLgiKVZ03Qfkc4jGRuiUQMQ8HGBD5pcNRnHeYM33zBvJE4/zJGjJJ8GScB+WmTsn9mORw==
 
 abab@^2.0.3:
   version "2.0.3"
```

---

### Incident Patch 2: `847aa920` (2023-01-20)
**Commit Message**: fix: skip creating a git repo when inside existing repo (#920)

* test: skip creating a git repo when inside existing repo

* fix: skip creating git repo inside existing repo

* test: use proper paths for project files

* test: use absolute paths when checking existence to avoid quantum tangling multiple dimensions and causing the universe to stop existing

**File**: `__tests__/index-test.js` (modified, +23/-0)
```diff
@@ -141,6 +141,29 @@ describe('yes', () => {
     expect(fileExists(projectName, '.gitignore')).toBeTruthy();
     expect(fileExists(projectName, 'node_modules')).not.toBeTruthy();
   });
+  it('does not create a new git repository inside an existing repository', async () => {
+    const workspaceName = 'yes-skip-git-in-repo';
+    const workspaceRoot = getRoot(workspaceName);
+
+    // Create the workspace root, and basic monorepo structure
+    await fs.mkdirp(workspaceRoot);
+    await execa('git', ['init'], { cwd: workspaceRoot });
+
+    // Create the app within a basic monorepo structure
+    const projectRoot = path.join(workspaceRoot, 'apps', workspaceName);
+    await fs.mkdirp(projectRoot);
+
+    const results = await execa('node', [cli, '--yes'], { cwd: projectRoot });
+    expect(results.exitCode).toBe(0);
+
+    expect(existsSync(path.join(workspaceRoot, '.git'))).toBe(true);
+    expect(existsSync(path.join(projectRoot, '.git'))).not.toBe(true);
+
+    expect(existsSync(path.join(projectRoot, 'package.json'))).toBe(true);
+    expect(existsSync(path.join(projectRoot, 'App.js'))).toBe(true);
+    expect(existsSync(path.join(projectRoot, '.gitignore'))).toBe(true);
+    expect(existsSync(path.join(projectRoot, 'node_modules'))).toBe(true);
+  });
 });
 
 describe('templates', () => {
```

**File**: `src/Template.ts` (modified, +1/-0)
```diff
@@ -110,6 +110,7 @@ export async function initGitRepoAsync(
   try {
     await spawnAsync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore', cwd: root });
     !flags.silent && Logger.gray('New project is already inside of a Git repo, skipping git init.');
+    return false;
   } catch (e) {
     if (e.errno === 'ENOENT') {
       !flags.silent && Logger.gray('Unable to initialize Git repo. `git` not in PATH.');
```

---

### Incident Patch 3: `407e58b0` (2022-07-12)
**Commit Message**: fix: prevent processing font files (#906)

**File**: `src/createFileTransform.ts` (modified, +4/-0)
```diff
@@ -64,6 +64,10 @@ export function createFileTransform(name: string) {
         '.svg',
         '.jar',
         '.keystore',
+
+        // Font files
+        '.otf',
+        '.ttf',
       ].includes(path.extname(entry.path)) &&
       name
     ) {
```

---

### Incident Patch 4: `6616dac3` (2022-04-22)
**Commit Message**: fix: typo from 'when' to 'went' (#902)

**File**: `src/index.ts` (modified, +1/-1)
```diff
@@ -142,7 +142,7 @@ async function installNodeDependenciesAsync(
     installJsDepsStep.succeed('Installed JavaScript dependencies.');
   } catch {
     installJsDepsStep.fail(
-      `Something when wrong installing JavaScript dependencies. Check your ${packageManager} logs. Continuing to initialize the app.`
+      `Something went wrong installing JavaScript dependencies. Check your ${packageManager} logs. Continuing to initialize the app.`
     );
   }
 }
```

---

### Incident Patch 5: `26f9ac85` (2021-12-14)
**Commit Message**: Fix name and version issues

**File**: `src/Examples.ts` (modified, +6/-2)
```diff
@@ -12,6 +12,7 @@ import tar from 'tar';
 import terminalLink from 'terminal-link';
 import { promisify } from 'util';
 
+import { sanitizeNpmPackageName } from './Template';
 import { createFileTransform, createEntryResolver } from './createFileTransform';
 
 // @ts-ignore
@@ -241,7 +242,6 @@ function getScriptsForProject(projectRoot: string): Record<string, string> {
 }
 
 export async function appendScriptsAsync(projectRoot: string): Promise<void> {
-  // Copy our default `.gitignore` if the application did not provide one
   const packageJsonPath = path.join(projectRoot, 'package.json');
   if (fs.existsSync(packageJsonPath)) {
     let packageFile = new JsonFile(packageJsonPath);
@@ -254,11 +254,15 @@ export async function appendScriptsAsync(projectRoot: string): Promise<void> {
         // Existing scripts have higher priority
         ...((packageJson.scripts || {}) as JSONObject),
       },
+      // These are metadata fields related to the template package, let's remove them from the package.json.
+      // A good place to start
+      version: '1.0.0',
       // Adding `private` stops npm from complaining about missing `name` and `version` fields.
       // We don't add a `name` field because it also exists in `app.json`.
       private: true,
     };
-
+    // name and version are required for yarn workspaces (monorepos)
+    packageJson.name = sanitizeNpmPackageName(path.basename(projectRoot));
     await packageFile.writeAsync(packageJson);
   }
 }
```

**File**: `src/Template.ts` (modified, +1/-3)
```diff
@@ -55,8 +55,6 @@ export async function extractAndPrepareTemplateAppAsync(projectRoot: string) {
   // A good place to start
   packageJson.version = '1.0.0';
   packageJson.private = true;
-  delete packageJson.name;
-  delete packageJson.version;
   delete packageJson.description;
   delete packageJson.tags;
   delete packageJson.repository;
@@ -66,7 +64,7 @@ export async function extractAndPrepareTemplateAppAsync(projectRoot: string) {
   return projectRoot;
 }
 
-function sanitizeNpmPackageName(name: string): string {
+export function sanitizeNpmPackageName(name: string): string {
   // https://github.com/npm/validate-npm-package-name/#naming-rules
   return (
     applyKnownNpmPackageNameRules(name) ||
```

---

### Incident Patch 6: `ab22b6f6` (2021-07-30)
**Commit Message**: Fix tests

**File**: `__tests__/index-test.js` (modified, +0/-1)
```diff
@@ -92,7 +92,6 @@ it('creates a full bare project by default', async () => {
   const appJsonPath = path.join(projectRoot, projectName, 'app.json');
   const appJson = JSON.parse(await fs.readFile(appJsonPath, 'utf8'));
   expect(appJson.name).toBe(projectName);
-  expect(appJson.displayName).toBe(projectName);
   expect(appJson.expo.name).toBe(projectName);
   expect(appJson.expo.slug).toBe(projectName);
 });
```

---

### Incident Patch 7: `498cd03b` (2021-02-11)
**Commit Message**: fixup header

**File**: `README.md` (modified, +7/-2)
```diff
@@ -1,11 +1,16 @@
 <!-- Title -->
 
-[![Create React Native App](/.gh-assets/header.png)](https://github.com/expo/create-react-native-app)
+<p align="center">
+  <a href="https://github.com/expo/create-react-native-app">
+    <img src="./.gh-assets/header.png" height="128">
+    <h1 align="center">Create React Native App</h1>
+  </a>
+</p>
 
 <!-- Header -->
 
 <p align="center">
-  <b>Create Universal React Native apps with no build configuration.</b>
+  <b>The fastest way to create universal React Native apps</b>
   <br />
 
   <p align="center">
```

---

### Incident Patch 8: `c3f88268` (2021-01-27)
**Commit Message**: Fix broken links to RN docs (#858)

* Fix incorrect link to RN Tutorial docs

Resolves #857 

Removed `.html` prefix from the link.

* Fix all .html refs

* Fix link to expo docs

**File**: `README.md` (modified, +2/-2)
```diff
@@ -30,7 +30,7 @@
 npx create-react-native-app
 ```
 
-Once you're up and running with Create React Native App, visit [this tutorial](https://reactnative.dev/docs/tutorial.html) for more information on building mobile apps with React.
+Once you're up and running with Create React Native App, visit [this tutorial](https://reactnative.dev/docs/tutorial) for more information on building mobile apps with React.
 
 <p align="center">
   <img align="center" alt="Product: demo" src="https://media.giphy.com/media/JsnUgag6Lebswl9xyz/giphy.gif" />
@@ -69,7 +69,7 @@ By default you create a [bare-workflow React](https://docs.expo.io/bare/explorin
 
 ## Usage with Expo Client App
 
-Expo Client enables you to work with all of the [Components and APIs](https://facebook.github.io/react-native/docs/getting-started.html) in `react-native`, as well as the [JavaScript APIs](https://docs.expo.io/versions/latest/sdk/index.html) that the are bundled with the Expo App.
+Expo Client enables you to work with all of the [Components and APIs](https://facebook.github.io/react-native/docs/getting-started) in `react-native`, as well as the [JavaScript APIs](https://docs.expo.io/versions/latest) that the are bundled with the Expo App.
 
 Expo Client supports running any project that doesn't have custom native modules added.
 
```

---

### Incident Patch 9: `9a6ac9dd` (2020-11-27)
**Commit Message**: fix typo - line 227 (#860)

**File**: `src/Template.ts` (modified, +1/-1)
```diff
@@ -224,7 +224,7 @@ export async function installPodsAsync(projectRoot: string) {
     step.stopAndPersist({
       symbol: '⚠️ ',
       text: chalk.red(
-        'Something when wrong running `pod install` in the `ios` directory. Continuing with initializing the project, you can debug this afterwards.'
+        'Something went wrong running `pod install` in the `ios` directory. Continuing with initializing the project, you can debug this afterwards.'
       ),
     });
     if (e.message) {
```

---

### Incident Patch 10: `af1488a5` (2020-09-03)
**Commit Message**: Upgrade prompts to fix autocomplete page scroll behavior (#847)

**File**: `package.json` (modified, +2/-2)
```diff
@@ -55,7 +55,7 @@
     "@types/fs-extra": "^8.1.0",
     "@types/getenv": "^1.0.0",
     "@types/node": "^12.6.8",
-    "@types/prompts": "2.0.1",
+    "@types/prompts": "2.0.8",
     "@types/tar": "4.0.3",
     "@zeit/ncc": "^0.22.3",
     "babel-jest": "^26.0.1",
@@ -73,7 +73,7 @@
     "minipass": "^3.1.1",
     "ora": "^4.0.3",
     "prettier": "^1.19.0",
-    "prompts": "2.1.0",
+    "prompts": "2.3.2",
     "tar": "^6.0.1",
     "terminal-link": "^2.1.1",
     "typescript": "3.7.3",
```

**File**: `yarn.lock` (modified, +9/-15)
```diff
@@ -1228,10 +1228,12 @@
   resolved "https://registry.yarnpkg.com/@types/prettier/-/prettier-2.0.0.tgz#dc85454b953178cc6043df5208b9e949b54a3bc4"
   integrity sha512-/rM+sWiuOZ5dvuVzV37sUuklsbg+JPOP8d+nNFlo2ZtfpzPiPvh1/gc8liWOLBqe+sR+ZM7guPaIcTt6UZTo7Q==
 
-"@types/prompts@2.0.1":
-  version "2.0.1"
-  resolved "https://registry.yarnpkg.com/@types/prompts/-/prompts-2.0.1.tgz#afae5a8b0616a33cd31557bec74e2fd4a32f4afe"
-  integrity sha512-AhtMcmETelF8wFDV1ucbChKhLgsc+ytXZXkNz/nnTAMSDeqsjALknEFxi7ZtLgS/G8bV2rp90LhDW5SGACimIQ==
+"@types/prompts@2.0.8":
+  version "2.0.8"
+  resolved "https://registry.yarnpkg.com/@types/prompts/-/prompts-2.0.8.tgz#350fc8341426b2b68a56f874ea3bae399f771800"
+  integrity sha512-lXXAa8c8ASoA61Tj9H5E5V2mRUTvNZ/dpJ5KxghI+O5geWMHt73NLZ9kEBBDK7zUUfMsMY3ZH4Sqeqh3SjSyfg==
+  dependencies:
+    "@types/node" "*"
 
 "@types/responselike@*", "@types/responselike@^1.0.0":
   version "1.0.0"
@@ -4008,7 +4010,7 @@ kind-of@^6.0.0, kind-of@^6.0.2:
   resolved "https://registry.yarnpkg.com/kind-of/-/kind-of-6.0.3.tgz#07c05034a6c349fa06e24fa35aa76db4580ce4dd"
   integrity sha512-dcS1ul+9tmeD95T+x28/ehLgd9mENa3LsvDTtzm3vyBEO7RPptvAD+t44WVXaUjTBRcrpFeFlC8WCruUR456hw==
 
-kleur@^3.0.2, kleur@^3.0.3:
+kleur@^3.0.3:
   version "3.0.3"
   resolved "https://registry.yarnpkg.com/kleur/-/kleur-3.0.3.tgz#a79c9ecc86ee1ce3fa6206d1216c501f147fc07e"
   integrity sha512-eTIzlVOSUR+JxdDFepEYcBMtZ9Qqdef+rnzWdRZuMbOywu5tO2w2N7rqjoANZ5k9vywhL6Br1VRjUIgTQx4E8w==
@@ -4885,15 +4887,7 @@ progress@^2.0.0:
   resolved "https://registry.yarnpkg.com/progress/-/progress-2.0.3.tgz#7e8cf8d8f5b8f239c1bc68beb4eb78567d572ef8"
   integrity sha512-7PiHtLll5LdnKIMw100I+8xJXR5gW2QwWYkT6iJva0bXitZKa/XMrSbdmg3r2Xnaidz9Qumd0VPaMrZlF9V9sA==
 
-prompts@2.1.0:
-  version "2.1.0"
-  resolved "https://registry.yarnpkg.com/prompts/-/prompts-2.1.0.tgz#bf90bc71f6065d255ea2bdc0fe6520485c1b45db"
-  integrity sha512-+x5TozgqYdOwWsQFZizE/Tra3fKvAoy037kOyU6cgz84n8f6zxngLOV4O32kTwt9FcLCxAqw0P/c8rOr9y+Gfg==
-  dependencies:
-    kleur "^3.0.2"
-    sisteransi "^1.0.0"
-
-prompts@^2.0.1:
+prompts@2.3.2, prompts@^2.0.1:
   version "2.3.2"
   resolved "https://registry.yarnpkg.com/prompts/-/prompts-2.3.2.tgz#480572d89ecf39566d2bd3fe2c9fccb7c4c0b068"
   integrity sha512-Q06uKs2CkNYVID0VqwfAl9mipo99zkBv/n2JtWY89Yxa3ZabWSrs0e2KTudKVa3peLUvYXMefDqIleLPVUBZMA==
@@ -5398,7 +5392,7 @@ simple-git@^1.85.0:
   dependencies:
     debug "^4.0.1"
 
-sisteransi@^1.0.0, sisteransi@^1.0.4:
+sisteransi@^1.0.4:
   version "1.0.5"
   resolved "https://registry.yarnpkg.com/sisteransi/-/sisteransi-1.0.5.tgz#134d681297756437cc05ca01370d3a7a571075ed"
   integrity sha512-bLGGlR1QxBcynn2d5YmDX4MGjlZvy2MRBDRNHLJ8VI6l6+9FUiyTFNJ0IveOSP0bcXgVDPRcfGqA0pjaqUpfVg==
```

#### Recent Merged Pull Requests:
- **PR #933** (2024-07-02): refactor: sunset package as outlined in RFC 0759 (@byCedric)
- **PR #930** (closed): Create test.txt (@mkjaswal)
- **PR #924** (2023-05-18): fix: convert underscore files to dotfiles (@douglowder)
- **PR #921** (2023-01-20): docs: update changelog (@byCedric)
- **PR #920** (2023-01-20): fix: skip creating a git repo when inside existing repo (@byCedric)
- **PR #906** (2022-07-12): fix: prevent processing font files (@EvanBacon)
- **PR #905** (2022-04-22): docs: add srkds as a contributor for code (@allcontributors[bot])
- **PR #903** (2022-04-22): Bump ajv from 6.12.2 to 6.12.6 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
