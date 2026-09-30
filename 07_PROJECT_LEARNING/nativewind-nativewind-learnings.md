# Forensic Learning Record (Deep Inspection): nativewind/nativewind

> **Canonical Artifact**: `07_PROJECT_LEARNING/nativewind-nativewind-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nativewind/nativewind](https://github.com/nativewind/nativewind))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:17:08.136Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nativewind/nativewind`
- **Description**: The utility-first workflow you love from Tailwind CSS in your React Native applications.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8107 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.config/commitlint.config.mjs`
```
export default { extends: ["@commitlint/config-conventional"] };

```

### Core Architecture Module: `.config/eslint.config.mjs`
```
import eslint from "@eslint/js";
import prettier from "eslint-plugin-prettier/recommended";
import { globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  globalIgnores([
    "**/dist/*",
    ".yarn/*",
    "coverage/*",
    "**/eslint.config.[cm]js",
    "**/prettier.config.[cm]js",
    "**/babel.config.js",
    "**/metro.config.js",
  ]),
  {
    rules: {
      "prefer-const": [
        "error",
        {
          destructuring: "all",
        },
      ],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "after-used",
          ignoreRestSiblings: true,
          argsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allow: [{ name: ["Error", "URL", "URLSearchParams"], from: "lib" }],
          allowAny: true,
          allowBoolean: true,
          allowNullish: true,
          allowNumber: true,
          allowRegExp: true,
        },
      ],
    },
  },
  // Standalone skill scripts run in Node without the library TypeScript project.
  {
    files: ["skills/*/scripts/**/*.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { process: "readonly" },
    },
  },
  // Test file specific rules
  // These rules are causing false positives with @react-native/testing-library
  {
    files: ["**/__tests__/**/*", "**/*.test.*", "**/*.spec.*"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
    },
  },
);

```

### Core Architecture Module: `.config/jest.setup.js`
```
import { setUpTests } from "react-native-reanimated";

/* global jest */

// Worklets 0.10 requires its native implementation to be mocked in Jest.
jest.mock("react-native-worklets", () =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Jest returns the untyped Worklets mock module.
  jest.requireActual("react-native-worklets/src/mock"),
);

setUpTests();

```

### Core Architecture Module: `.config/prettier.config.mjs`
```
/**
 * @see https://prettier.io/docs/en/configuration.html
 * @type {import("prettier").Config}
 */
const config = {
  plugins: ["@ianvs/prettier-plugin-sort-imports"],
  importOrderParserPlugins: ["typescript", "jsx"],
  importOrder: [
    "^react$|^react-native$",
    "",
    "<BUILTIN_MODULES>",
    "",
    "<THIRD_PARTY_MODULES>",
    "",
    "^[.]",
  ],
};

export default config;

```

### Core Architecture Module: `.config/release-it.config.ts`
```
import type { Config } from "release-it";

export default {
  git: {
    commitArgs: ["--no-verify"],
  },
  github: {
    release: true,
  },
} satisfies Config;

```

### Core Architecture Module: `babel.config.js`
```
module.exports = (api) => {
  const isTest = api.env("test");

  if (isTest) {
    return {
      presets: ["babel-preset-expo"],
    };
  } else {
    return {
      overrides: [
        {
          exclude: /\/node_modules\//,
          presets: ["module:react-native-builder-bob/babel-preset"],
        },
        {
          include: /\/node_modules\//,
          presets: ["module:@react-native/babel-preset"],
        },
      ],
    };
  }
};

```

### Core Architecture Module: `css.d.ts`
```
declare module "*.css";

```

### Core Architecture Module: `eslint.config.mjs`
```
export { default } from "./.config/eslint.config.mjs";

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1054** (2024-10-25): **V4.1: ScrollView indicatorStyle prop causing "TypeError: right operand of 'in' is not an object"**
  *Symptoms*: **Describe the bug** ScrollView indicatorStyle prop throwing an error. Same error as #1012    **Reproduction** - nativewind@4.1.7 (nativewind@next)  Create ScrollView with indicatorStyle prop ```tsx <ScrollView indicatorStyle={'white'}></ScrollView> ``` https://stackblitz.com/edit/nativewind-test-vfyfwd?file=nativewind.test.tsx  **Additional context** ![image](https://github.com/user-attachments/assets/43ddd323-9cb6-438c-8cb9-50c876b43bf2) 
  **Post-Mortem & Fix Analysis**:
  > This is still an issue in 4.1.10
  > Oh, just ran into this. 
  > Could [this line](https://github.com/nativewind/nativewind/blob/8e319604350dafe61d16eb2557c797ae168b4e74/packages/react-native-css-interop/src/runtime/components.ts#L43) be the cause of this?

- **Issue #1038** (2024-09-11): **docs: add `mdx` ending to `tailwind.config.js`'s `content` array file paths to watch**
  *Symptoms*: **Describe the bug**  I'm not sure if this is really is necessary, but I ran into an issue today which nearly drove me crazy because of the `mdx` files not being processed by tailwind. I'm not sure why this is even necessary, because my project doesn't contain any `.mdx` files. But when running on node-js 22.5.1 with this dependencies:  ``` ├── expo-router@3.5.23 ├── expo@51.0.32 ├── nativewind@4.1.6 ├── tailwindcss@3.4.10 ```  I'm getting the following errors on some reloads:  ``` (node:73054) Warning: To load an ES module, set "type": "module" in the package.json or use the .mjs extension. ```  And this in combination with a further bug lead into some hours of bug-hunting...  Just reporting this, so that some other people running into this thing. Decide yourself, if this is something to adjust, or if its some weird stuff only happening on my machine...
  **Post-Mortem & Fix Analysis**:
  > @becknik thanks for flagging, can you repro using create expo stack? https://github.com/nativewind/nativewind/blob/main/contributing.md#opening-an-issue
  > I just decided to ignore this document, since my "bug" is rather a question if it makes sense to add the `mdx` to the doc or not. I have not enough knowledge in expo, fast reload or any other technology to reason if so.  However, during the previous bug-fighting, I have tried to use your Stackblitz template to file an issue to figure out what's wrong with my project setup since I followed the instructions. I couldn't get to the point where I could run the `expo start -c` and see, if the fast reload on save works in there.
  > Can you try reproducing via `npx create-expo-stack@latest --nativewind` instead?

- **Issue #67** (2022-06-01): **Multiple warnings - No utility classes were detected in your source files.**
  *Symptoms*: Under some configurations the warning `No utility classes were detected in your source files.` may repeatedly print in the console.  I'm aware of the issue and working on a fix.
  **Post-Mortem & Fix Analysis**:
  > :tada: This issue has been resolved in version 1.7.3 :tada:  The release is available on: - [GitHub release](https://github.com/marklawlor/tailwindcss-react-native/releases/tag/v1.7.3) - [npm package (@latest dist-tag)](https://www.npmjs.com/package/tailwindcss-react-native/v/1.7.3)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:
  > :tada: This issue has been resolved in version 1.7.4 :tada:  The release is available on: - [GitHub release](https://github.com/marklawlor/tailwindcss-react-native/releases/tag/v1.7.4) - [npm package (@latest dist-tag)](https://www.npmjs.com/package/tailwindcss-react-native/v/1.7.4)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #64** (2022-05-28): **Usage on Windows**
  *Symptoms*: I'm currently investigating issues with the Babel plugin not working as expected on Windows system. This affects both the Babel transform and compilation.  If you are affected by this issue, you can still use the library either by compiling with Tailwind CLI or PostCSS CLI. 
  **Post-Mortem & Fix Analysis**:
  > :tada: This issue has been resolved in version 1.5.1 :tada:  The release is available on: - [GitHub release](https://github.com/marklawlor/tailwindcss-react-native/releases/tag/v1.5.1) - [npm package (@latest dist-tag)](https://www.npmjs.com/package/tailwindcss-react-native/v/1.5.1)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #10** (2022-04-08): **[Bug] rem/em not being parsed correctly on native **
  *Symptoms*: The `postcss-rem-to-pixel` doesn't appear to be working in all instances. Additionally it only does `rem`.   `tailwind-rn` use their own [rex-to-px](https://github.com/vadimdemedes/tailwind-rn/blob/master/source/lib/rem-to-px.ts) and [ex-to-px transform](https://github.com/vadimdemedes/tailwind-rn/blob/master/source/lib/em-to-px.ts). We might have to do the same thing - however I would like to fix it via a `postcss` plugin
  **Post-Mortem & Fix Analysis**:
  > I just encountered this too, using `my-8` (for example).
  > I think I'll need to write a custom css transform library to solve this. I was hoping that `css-to-react-native` and some postcss plugins would solve the issue, but it doesn't seem to be the case.  In the mean time, the work around is to use arbitrary values eg `my-[20px]`
  > Vanilla tailwindcss styles (eg `my-8`) will now work on version `0.0.21`. Arbitrary styles using `em`/`rem` are not supported on native. They currently error with a not great error message, but in a future feature we'll provide warnings if you are trying to use an unsupported unit for the platform eg `Native does not support unit rem. Consider adding a platform prefix or separating this component into different platform files.`

- **Issue #6** (2022-04-04): **[Bug] Ignore native elements on web**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Fixed in `0.0.14`

- **Issue #5** (2022-04-05): **Property '__useParseTailwind' doesn't exist**
  *Symptoms*: Hey, I see this is very new, but I love the idea and I'm excited to use it in a new project.   I'm getting a `Property '__useParseTailwind' doesn't exist` error when adding it to a React Native app, in the iOS simulator.   It happens both when using the babel plugin as `'tailwindcss-react-native/babel'` or `['tailwindcss-react-native/babel', { platform: 'native' }]`
  **Post-Mortem & Fix Analysis**:
  > Hi! Yes sorry this is still a work in progress. Can you please try version `0.0.11` which resolves a couple of issues.  Unfortunately I don't have immediate access to an iOS simulator, so I won't be able to test it for a little bit. I'm currently just testing with `android` simulator with Expo and on web with `@expo/next-adapter`.   I'm not sure if it helps but my test repo is https://github.com/marklawlor/solito-tailwind
  > Sorry, not working in `0.0.11`. I'll give you some time to get the project going more :)
  > Cheers, just watch the repo for releases. I'll tag version 1.0.0 when its stable.   Just curious - are you using Expo or vanilla react-native?

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

### Incident Patch 1: `696a0bbb` (2026-09-14)
**Commit Message**: fix: lint standalone migration preflight scripts

**File**: `.config/eslint.config.mjs` (modified, +8/-0)
```diff
@@ -55,6 +55,14 @@ export default tseslint.config(
       ],
     },
   },
+  // Standalone skill scripts run in Node without the library TypeScript project.
+  {
+    files: ["skills/*/scripts/**/*.mjs"],
+    extends: [tseslint.configs.disableTypeChecked],
+    languageOptions: {
+      globals: { process: "readonly" },
+    },
+  },
   // Test file specific rules
   // These rules are causing false positives with @react-native/testing-library
   {
```

**File**: `skills/nativewind-preview-to-rc/scripts/preflight.mjs` (modified, +384/-69)
```diff
@@ -1,113 +1,428 @@
 #!/usr/bin/env node
 // Read-only inventory. Reads JSON/text only; never loads application modules.
-import fs from 'node:fs';
-import path from 'node:path';
-import { fileURLToPath } from 'node:url';
+import fs from "node:fs";
+import path from "node:path";
+import { fileURLToPath } from "node:url";
 
-const workflow = path.basename(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
-const target = { nativewind: '5.0.0-rc.0', 'react-native-css': '3.1.0-rc.0', expo: '57.0.22', react: '19.2.3', 'react-native': '0.86.3', 'react-native-reanimated': '4.5.1', 'react-native-worklets': '0.10.1', tailwindcss: '4.1.12', '@tailwindcss/postcss': '4.1.12', lightningcss: '1.30.1' };
+const workflow = path.basename(
+  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
+);
+const target = {
+  nativewind: "5.0.0-rc.0",
+  "react-native-css": "3.1.0-rc.0",
+  expo: "57.0.22",
+  react: "19.2.3",
+  "react-native": "0.86.3",
+  "react-native-reanimated": "4.5.1",
+  "react-native-worklets": "0.10.1",
+  tailwindcss: "4.1.12",
+  "@tailwindcss/postcss": "4.1.12",
+  lightningcss: "1.30.1",
+};
 const risks = [];
-const add = (code, severity, action, evidence = []) => risks.push({ code, severity, action, evidence });
-const exists = p => fs.existsSync(p);
-const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
+const add = (code, severity, action, evidence = []) =>
+  risks.push({ code, severity, action, evidence });
+const exists = (p) => fs.existsSync(p);
+const json = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
 try {
-  if (process.argv.length !== 3) throw new Error('Usage: node scripts/preflight.mjs /absolute/path/to/app');
+  if (process.argv.length !== 3)
+    throw new Error("Usage: node scripts/preflight.mjs /absolute/path/to/app");
   const root = fs.realpathSync(process.argv[2]);
-  const manifest = json(path.join(root, 'package.json'));
+  const manifest = json(path.join(root, "package.json"));
   const declared = { ...manifest.devDependencies, ...manifest.dependencies };
   const ancestors = [];
   for (let dir = root; ; dir = path.dirname(dir)) {
     ancestors.push(dir);
     if (path.dirname(dir) === dir) break;
   }
-  const lockNames = ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb'];
-  const lockfiles = ancestors.flatMap(dir => lockNames.filter(n => exists(path.join(dir, n))).map(n => path.join(dir, n)));
-  const workspaceRoots = ancestors.filter(dir => {
-    try { return Boolean(json(path.join(dir, 'package.json')).workspaces) || exists(path.join(dir, 'pnpm-workspace.yaml')); } catch { return exists(path.join(dir, 'pnpm-workspace.yaml')); }
+  const lockNames = [
+    "package-lock.json",
+    "npm-shrinkwrap.json",
+    "yarn.lock",
+    "pnpm-lock.yaml",
+    "bun.lock",
+    "bun.lockb",
+  ];
+  const lockfiles = ancestors.flatMap((dir) =>
+    lockNames
+      .filter((n) => exists(path.join(dir, n)))
+      .map((n) => path.join(dir, n)),
+  );
+  const workspaceRoots = ancestors.filter((dir) => {
+    try {
+      return (
+        Boolean(json(path.join(dir, "package.json")).workspaces) ||
+        exists(path.join(dir, "pnpm-workspace.yaml"))
+      );
+    } catch {
+      return exists(path.join(dir, "pnpm-workspace.yaml"));
+    }
   });
   const packages = {};
-  for (const name of [...Object.keys(target), 'react-native-css-interop']) {
+  for (const name of [...Object.keys(target), "react-native-css-interop"]) {
     let installed = null;
     // Node-style ancestor lookup also handles hoisted deps and pnpm symlink entries.
     // Do not execute require(), import(), package exports, or app configuration.
     for (const dir of ancestors) {
-      const candidate = path.join(dir, 'node_modules', name, 'package.json');
+      const candidate = path.join(dir, "node_modules", name, "package.json");
       if (!exists(candidate)) continue;
       try {
         const data = json(candidate);
-        installed = { na
```

**File**: `skills/nativewind-v4-to-v5/scripts/preflight.mjs` (modified, +384/-69)
```diff
@@ -1,113 +1,428 @@
 #!/usr/bin/env node
 // Read-only inventory. Reads JSON/text only; never loads application modules.
-import fs from 'node:fs';
-import path from 'node:path';
-import { fileURLToPath } from 'node:url';
+import fs from "node:fs";
+import path from "node:path";
+import { fileURLToPath } from "node:url";
 
-const workflow = path.basename(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
-const target = { nativewind: '5.0.0-rc.0', 'react-native-css': '3.1.0-rc.0', expo: '57.0.22', react: '19.2.3', 'react-native': '0.86.3', 'react-native-reanimated': '4.5.1', 'react-native-worklets': '0.10.1', tailwindcss: '4.1.12', '@tailwindcss/postcss': '4.1.12', lightningcss: '1.30.1' };
+const workflow = path.basename(
+  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
+);
+const target = {
+  nativewind: "5.0.0-rc.0",
+  "react-native-css": "3.1.0-rc.0",
+  expo: "57.0.22",
+  react: "19.2.3",
+  "react-native": "0.86.3",
+  "react-native-reanimated": "4.5.1",
+  "react-native-worklets": "0.10.1",
+  tailwindcss: "4.1.12",
+  "@tailwindcss/postcss": "4.1.12",
+  lightningcss: "1.30.1",
+};
 const risks = [];
-const add = (code, severity, action, evidence = []) => risks.push({ code, severity, action, evidence });
-const exists = p => fs.existsSync(p);
-const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
+const add = (code, severity, action, evidence = []) =>
+  risks.push({ code, severity, action, evidence });
+const exists = (p) => fs.existsSync(p);
+const json = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
 try {
-  if (process.argv.length !== 3) throw new Error('Usage: node scripts/preflight.mjs /absolute/path/to/app');
+  if (process.argv.length !== 3)
+    throw new Error("Usage: node scripts/preflight.mjs /absolute/path/to/app");
   const root = fs.realpathSync(process.argv[2]);
-  const manifest = json(path.join(root, 'package.json'));
+  const manifest = json(path.join(root, "package.json"));
   const declared = { ...manifest.devDependencies, ...manifest.dependencies };
   const ancestors = [];
   for (let dir = root; ; dir = path.dirname(dir)) {
     ancestors.push(dir);
     if (path.dirname(dir) === dir) break;
   }
-  const lockNames = ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb'];
-  const lockfiles = ancestors.flatMap(dir => lockNames.filter(n => exists(path.join(dir, n))).map(n => path.join(dir, n)));
-  const workspaceRoots = ancestors.filter(dir => {
-    try { return Boolean(json(path.join(dir, 'package.json')).workspaces) || exists(path.join(dir, 'pnpm-workspace.yaml')); } catch { return exists(path.join(dir, 'pnpm-workspace.yaml')); }
+  const lockNames = [
+    "package-lock.json",
+    "npm-shrinkwrap.json",
+    "yarn.lock",
+    "pnpm-lock.yaml",
+    "bun.lock",
+    "bun.lockb",
+  ];
+  const lockfiles = ancestors.flatMap((dir) =>
+    lockNames
+      .filter((n) => exists(path.join(dir, n)))
+      .map((n) => path.join(dir, n)),
+  );
+  const workspaceRoots = ancestors.filter((dir) => {
+    try {
+      return (
+        Boolean(json(path.join(dir, "package.json")).workspaces) ||
+        exists(path.join(dir, "pnpm-workspace.yaml"))
+      );
+    } catch {
+      return exists(path.join(dir, "pnpm-workspace.yaml"));
+    }
   });
   const packages = {};
-  for (const name of [...Object.keys(target), 'react-native-css-interop']) {
+  for (const name of [...Object.keys(target), "react-native-css-interop"]) {
     let installed = null;
     // Node-style ancestor lookup also handles hoisted deps and pnpm symlink entries.
     // Do not execute require(), import(), package exports, or app configuration.
     for (const dir of ancestors) {
-      const candidate = path.join(dir, 'node_modules', name, 'package.json');
+      const candidate = path.join(dir, "node_modules", name, "package.json");
       if (!exists(candidate)) continue;
       try {
         const data = json(candidate);
-        installed = { na
```

---

### Incident Patch 2: `9be5eddc` (2026-09-13)
**Commit Message**: fix: pin Nativewind to the published engine RC

**File**: `example/package.json` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@
     "react": "19.2.3",
     "react-dom": "19.2.3",
     "react-native": "0.86.3",
-    "react-native-css": "https://github.com/nativewind/react-native-css.git#commit=5d45e60bd2659ae220bb8e6fb48273ad9c19fc1e",
+    "react-native-css": "3.1.0-rc.0",
     "react-native-reanimated": "4.5.1",
     "react-native-web": "~0.21.0",
     "react-native-worklets": "0.10.1",
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -140,7 +140,7 @@
     "react": "19.2.3",
     "react-native": "0.86.3",
     "react-native-builder-bob": "^0.40.13",
-    "react-native-css": "https://github.com/nativewind/react-native-css.git#commit=5d45e60bd2659ae220bb8e6fb48273ad9c19fc1e",
+    "react-native-css": "3.1.0-rc.0",
     "react-native-reanimated": "4.5.1",
     "react-native-safe-area-context": "~5.7.0",
     "react-native-worklets": "0.10.1",
@@ -153,7 +153,7 @@
     "typescript-eslint": "^8.40.0"
   },
   "peerDependencies": {
-    "react-native-css": "^3.0.1",
+    "react-native-css": "3.1.0-rc.0",
     "tailwindcss": ">4.1.11"
   },
   "react-native-builder-bob": {
```

**File**: `yarn.lock` (modified, +7/-7)
```diff
@@ -10474,7 +10474,7 @@ __metadata:
     react: "npm:19.2.3"
     react-native: "npm:0.86.3"
     react-native-builder-bob: "npm:^0.40.13"
-    react-native-css: "https://github.com/nativewind/react-native-css.git#commit=5d45e60bd2659ae220bb8e6fb48273ad9c19fc1e"
+    react-native-css: "npm:3.1.0-rc.0"
     react-native-reanimated: "npm:4.5.1"
     react-native-safe-area-context: "npm:~5.7.0"
     react-native-worklets: "npm:0.10.1"
@@ -10486,7 +10486,7 @@ __metadata:
     typescript: "npm:~6.0.3"
     typescript-eslint: "npm:^8.40.0"
   peerDependencies:
-    react-native-css: ^3.0.1
+    react-native-css: 3.1.0-rc.0
     tailwindcss: ">4.1.11"
   languageName: unknown
   linkType: soft
@@ -11501,7 +11501,7 @@ __metadata:
     react-dom: "npm:19.2.3"
     react-native: "npm:0.86.3"
     react-native-builder-bob: "npm:^0.40.13"
-    react-native-css: "https://github.com/nativewind/react-native-css.git#commit=5d45e60bd2659ae220bb8e6fb48273ad9c19fc1e"
+    react-native-css: "npm:3.1.0-rc.0"
     react-native-monorepo-config: "npm:^0.1.9"
     react-native-reanimated: "npm:4.5.1"
     react-native-web: "npm:~0.21.0"
@@ -11510,9 +11510,9 @@ __metadata:
   languageName: unknown
   linkType: soft
 
-"react-native-css@https://github.com/nativewind/react-native-css.git#commit=5d45e60bd2659ae220bb8e6fb48273ad9c19fc1e":
-  version: 3.0.7
-  resolution: "react-native-css@https://github.com/nativewind/react-native-css.git#commit=5d45e60bd2659ae220bb8e6fb48273ad9c19fc1e"
+"react-native-css@npm:3.1.0-rc.0":
+  version: 3.1.0-rc.0
+  resolution: "react-native-css@npm:3.1.0-rc.0"
   dependencies:
     "@types/debug": "npm:^4.1.12"
     babel-plugin-react-compiler: "npm:^19.1.0-rc.2"
@@ -11524,7 +11524,7 @@ __metadata:
     lightningcss: ">=1.27.0"
     react: ">=19"
     react-native: ">=0.81"
-  checksum: 10c0/b4fca88c70e96c011ffa450ba4210ddfb22b5d71b703fdbe11043233104f830f63fe5ca8d179891c4971f643f697dab60c3db2b4fe2a05f1ae43346444aad919
+  checksum: 10c0/2170c000c5fc5e7a885a19f870f333337753ab586f19903a3dfd9eed4e60f97f03498fb4be06bdccd7858740936328460796fbff5d0dda3066b323a4ceb7a966
   languageName: node
   linkType: hard
 
```

---

### Incident Patch 3: `361e90b0` (2026-09-11)
**Commit Message**: fix: prepare Expo 57 compatibility for RC audit

**File**: `.config/jest.setup.js` (modified, +8/-0)
```diff
@@ -1,3 +1,11 @@
 import { setUpTests } from "react-native-reanimated";
 
+/* global jest */
+
+// Worklets 0.10 requires its native implementation to be mocked in Jest.
+jest.mock("react-native-worklets", () =>
+  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Jest returns the untyped Worklets mock module.
+  jest.requireActual("react-native-worklets/src/mock"),
+);
+
 setUpTests();
```

**File**: `css.d.ts` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+declare module "*.css";
```

**File**: `docs/known-issues.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+# Known Expo 57 dependency limitation
+
+With Expo 57.0.21, React Native 0.86.3, Reanimated 4.5.1, and Worklets 0.10.1, cancelling a CSS animation on Android can leave the component at its last animated transform. A spinning view can remain tilted after switching to `animationName: "none"` or removing the animation styles. In Nativewind, this affects changing `animate-spin` to `animate-none`.
+
+The failure reproduces with a direct Reanimated `Animated.View` without Nativewind or react-native-css. It is tracked in [Reanimated #10507](https://github.com/software-mansion/react-native-reanimated/issues/10507). The confirmed environment is an Android API 34 emulator with Fabric, Hermes, and a Release build. The integrated physical iPhone cancellation case passed. Later Reanimated versions and physical Android have not been verified.
+
+The planned RC retains Expo's exact dependency versions and discloses this limitation. Neither library includes the experimental Reanimated patch. Applications relying on CSS animation cancellation must account for this known behavior. No production workaround is currently verified by this release effort.
+
+The issue includes a [standalone reproduction](https://gist.github.com/danstepanov/03d34ece59f03628deb77a028e8a9a03). When an official fix becomes available in the supported Expo environment, rerun the cancellation and motion checks before removing this notice. This notice does not claim that the RC has been published or that the rest of its release gate is complete.
```

**File**: `docs/rc-compatibility.md` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+# Nativewind v5 RC compatibility notes
+
+Draft for the Expo 57 RC. The release is still under audit and has not been published.
+
+The target is Expo 57.0.22 with React Native 0.86.3, React 19.2.3, Reanimated 4.5.1 and Worklets 0.10.1. The intended package pair is Nativewind 5.0.0-rc.0 and react-native-css 3.1.0-rc.0. Installation instructions become active only after that exact pair is published.
+
+## Corrections to the preview documentation
+
+Several preview tables describe CSS utilities as fully supported even though the engine's original tests explicitly reject them on native platforms. The RC retains those rejection contracts. These are existing limitations, not newly supported features or regressions introduced by the Expo upgrade.
+
+| Utilities | Native behavior and migration |
+| :--- | :--- |
+| `border-inherit`, `text-inherit`, `caret-inherit`, `decoration-inherit` | Explicit CSS `inherit` is rejected. Use an explicit value or a CSS variable shared with the relevant styled ancestor. This differs from ordinary nested Text inheritance. |
+| `border-none`, `outline-double` | These border and outline styles are rejected. `border-0` removes the border by setting its width. |
+| `basis-auto`, `inset-auto`, `inset-x-auto`, `inset-y-auto` | These utility values are rejected. Use the appropriate React Native layout props or omit the constraint. |
+| `order-first`, `order-last`, `order-none` | CSS flex order is rejected. Arrange native children in the intended order. |
+| `overflow-auto`, `overflow-clip`, `overflow-scroll`, all `overflow-x-*` and `overflow-y-*` entries listed in the audit | CSS scroll containers and axis specific overflow are rejected. Use React Native scrolling components or the supported whole view overflow behavior. |
+| `fixed`, `sticky` | CSS position values are rejected. Use native layout, overlay or sticky header APIs appropriate to the component. They are not interchangeable with CSS viewport positioning. |
+| `w-min`, `w-max`, `w-fit`, `h-min`, `h-max`, `h-fit`, and the corresponding min/max size forms | Intrinsic CSS size keywords are rejected. Use native flex layout or explicit dimensions. |
+| The nine named `origin-*` utilities | CSS transform origin is rejected by this compiler. Where needed, configure React Native's `transformOrigin` style directly. |
+| `decoration-wavy`, `overline` | These text decoration values are rejected. |
+| `align-baseline`, `align-text-top`, `align-text-bottom`, `align-sub`, `align-super` | These CSS vertical alignment values are rejected. Native text layout has a different contract. |
+
+The exact literal inventory and expected warning values are recorded in the compatibility repository's `release/documented-native-rejections.json`. Each listed utility must still be discovered from a real TSX file and safely rejected in both development and production. A deliberate width declaration must make its rejection check fail. Browser support is evaluated independently; this table makes no new browser support claim.
+
+## API and runtime corrections
+
+The RC removes stale v4 ambient declarations for `cssInterop`, `placeholderClassName`, `indicatorClassName`, `presentationClassName`, and a standalone StatusBar `className`. They did not correspond to v5 runtime mappings. Use `styled` mappings for custom components and the documented `placeholder:` utility for TextInput placeholder color. KeyboardAvoidingView now maps `contentContainerClassName` to `contentContainerStyle`; React Native uses that container with `behavior="position"`.
+
+Nested style mappings preserve both independent target paths and caller owned objects. Attribute selectors use full class tokens, CSS whitespace boundaries, exact language matching and explicit ASCII case flags. Dynamic `clamp()` respects its minimum when bounds cross. Dynamic two color mixing preserves existing alpha and correctly normalizes explicit percentages.
+
+The theme now emits the correct foreground ripple property,
```

**File**: `docs/source-discovery.md` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+# Mapping utilities and source discovery
+
+Nativewind v5 receives utility candidates from Tailwind's source scanner. A mapping must be discoverable from the application's source before Nativewind can compile it.
+
+Use bracketed syntax for mapping paths containing `&`:
+
+| Input | Use in application source |
+| :--- | :--- |
+| `@map/&.test:color-black` | `@map-[&.test]:color-black` |
+| `@map/&.test.nested:color-black` | `@map-[&.test.nested]:color-black` |
+
+The bracketed forms retain the same destination and value. Mappings to ordinary props, such as `@map/test:color-black`, remain valid. Mappings selecting a particular style field also use brackets, for example `@map-[&.test]/fontSize:text-base`.
+
+Tailwind 4.1.12, 4.1.13, and 4.3.3 omit the two unbracketed ampersand candidates when scanning TSX. Explicit inline source declarations can force those candidates through the compiler, so a passing compiler test alone does not establish application source discovery. Automatic discovery of these two legacy spellings is outside the proposed RC contract; migrate to their bracketed equivalents. This is an existing preview limitation and has not been established as an Expo upgrade regression.
+
+Tests in `src/__tests__/mapping-source.test.tsx` write actual TSX files, process them with optimization enabled and disabled, and check the rendered prop destinations and values. A control verifies that a class absent from the file does not get generated. Separate tests preserve the observed omissions without labeling them successful discovery.
+
+Keep complete utility strings in application source. Tailwind's [source detection documentation](https://tailwindcss.com/docs/detecting-classes-in-source-files) explains discovery and explicitly registered sources. Adding inline declarations for these omitted aliases does not verify automatic discovery.
```

---

### Incident Patch 4: `82a78534` (2026-05-15)
**Commit Message**: fix(release): use whatBump:false to bypass broken preset loader (#1791)

ignoreRecommendedBump only gates the disablePlugin lifecycle hook in
@release-it/conventional-changelog@10.0.1; getRecommendedVersion still
runs Bumper.bump and crashes with "whatBump is not a function" because
conventional-changelog-conventionalcommits@8 no longer exposes
recommendedBumpOpts.whatBump (the plugin reads from there).

Setting whatBump: false makes the plugin return a stub
(() => ({ releaseType: null })) and skip the preset-based bump
calculation entirely, which is fine because the workflow always passes
an explicit --increment or --preRelease.

**File**: `.config/release-it.config.ts` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ export default {
   },
   plugins: {
     "@release-it/conventional-changelog": {
-      ignoreRecommendedBump: true,
+      whatBump: false,
       preset: {
         name: "conventionalcommits",
         types: [
```

---

### Incident Patch 5: `1cfb9956` (2026-05-15)
**Commit Message**: fix(release): skip recommended bump in release-it config (#1790)

The @release-it/conventional-changelog@10.0.1 plugin fails with
"whatBump is not a function" when called against the conventionalcommits
preset, because the recommendedBumpOpts.whatBump shape doesn't match
what conventional-recommended-bump expects.

The workflow always passes an explicit increment (--preRelease=preview
or --increment=<type>), so we don't need the plugin to *recommend* a
bump anyway. ignoreRecommendedBump: true bypasses the broken path while
keeping CHANGELOG generation intact.

**File**: `.config/release-it.config.ts` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@ export default {
   },
   plugins: {
     "@release-it/conventional-changelog": {
+      ignoreRecommendedBump: true,
       preset: {
         name: "conventionalcommits",
         types: [
```

---

### Incident Patch 6: `30e83f0d` (2026-03-13)
**Commit Message**: fix(ci): use Podfile.lock instead of ios/** in hashFiles

The ios/** glob causes hashFiles to fail when the directory contains
symlinks or partial state from the pods cache restore. Podfile.lock
is a better cache key anyway — it captures dependency changes without
needing to traverse the entire generated ios directory.

**File**: `.github/actions/ios-dev-app/action.yml` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ runs:
       with:
         path: |
           example/ios/build/DerivedData
-        key: ios-dev-${{ runner.os }}-${{ hashFiles('example/ios/**', 'example/package.json', 'package.json') }}
+        key: ios-dev-${{ runner.os }}-${{ hashFiles('example/ios/Podfile.lock', 'example/package.json', 'package.json') }}
         restore-keys: |
           ios-dev-${{ runner.os }}-
 
```

---

### Incident Patch 7: `b071b94a` (2026-03-08)
**Commit Message**: chore: add Claude Code skills for architecture, testing, and debugging

**File**: `.claude/skills/add-test/SKILL.md` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+---
+name: add-test
+description: Scaffold a test for a Tailwind utility or Nativewind feature following the project's testing conventions.
+argument-hint: [css-class-or-feature]
+allowed-tools: Read, Grep, Glob, Edit, Write
+---
+
+## Context
+
+Nativewind v5 tests live in `src/__tests__/` and use the `renderCurrentTest()` helper from `src/test-utils.tsx`.
+
+## Convention
+
+The test name IS the className being tested. `renderCurrentTest()` auto-extracts it:
+
+```typescript
+import { renderCurrentTest } from "../test-utils";
+
+describe("Feature Name", () => {
+  test("class-name", async () => {
+    expect(await renderCurrentTest()).toStrictEqual({
+      props: {
+        style: { /* expected RN style */ },
+      },
+    });
+  });
+});
+```
+
+For custom utilities that map to non-style props (like `elevation`, `tint`, `ripple`), the expected output includes those props directly:
+
+```typescript
+test("elevation-sm", async () => {
+  expect(await renderCurrentTest()).toStrictEqual({
+    props: {
+      style: { elevation: 3 },
+    },
+  });
+});
+```
+
+## Steps
+
+1. **Identify the feature**: What CSS class or Nativewind feature needs testing? Use `$ARGUMENTS` as the starting point.
+
+2. **Find existing tests**: Search `src/__tests__/` for similar tests to understand the pattern and where the new test should go.
+
+3. **Determine expected output**: Figure out what React Native style the CSS class should produce. Check Tailwind docs, theme.css, and the react-native-css compiler if needed.
+
+4. **Write the test**: Follow the exact convention above. Place it in the appropriate existing test file, or create a new one if it's a new category.
+
+5. **Run the test**: Execute `yarn test` to verify it passes.
```

**File**: `.claude/skills/architecture/SKILL.md` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+---
+name: architecture
+description: Explain the Nativewind v5 architecture, CSS pipeline, and key files. Use when a contributor wants to understand how the codebase works.
+allowed-tools: Read, Grep, Glob
+---
+
+You are explaining the architecture of **Nativewind v5** to a contributor.
+
+Start by reading `DEVELOPMENT.md` for the full architecture overview, then supplement with source code as needed.
+
+## How to explain
+
+1. **Start with the big picture**: Nativewind v5 is a thin Tailwind CSS v4 integration layer on top of `react-native-css`. Most logic is NOT in this repo.
+
+2. **Show the pipeline**: Walk through how a Tailwind class like `bg-red-500` goes from CSS to a React Native style, referencing the specific files involved:
+   - `theme.css` — Tailwind v4 theme with RN-specific values
+   - `src/plugin.tsx` — `@map` variant generates `@nativeMapping` directives
+   - `src/metro.tsx` — `withNativewind()` wraps react-native-css's Metro config
+   - `src/babel.tsx` — re-exports react-native-css's babel plugin
+   - `src/index.tsx` — re-exports react-native-css's runtime API
+
+3. **Clarify the boundary**: What belongs here vs. in react-native-css. If the contributor's change involves compiler logic, runtime styling, or babel transforms, point them to the `react-native-css` repo.
+
+4. **Show relevant code**: Read the actual source files to illustrate points. The src/ is small enough to show most of it.
+
+5. **Answer follow-up questions** by searching the codebase.
```

**File**: `.claude/skills/debug-nw/SKILL.md` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+---
+name: debug-nw
+description: Debug a Nativewind v5 setup issue. Walks through common configuration problems with metro, babel, postcss, and dependencies.
+allowed-tools: Read, Grep, Glob, Bash
+---
+
+You are helping debug a Nativewind v5 configuration issue. Walk through these checks systematically.
+
+## 1. Version check
+
+- Is `nativewind` at v5.x? (`package.json`)
+- Is `react-native-css` installed as a peer dependency? Must be `^3.0.1`
+- Is `tailwindcss` v4+? Must be `>4.1.11`
+- Is `@tailwindcss/postcss` installed?
+
+## 2. PostCSS config
+
+Nativewind v5 uses Tailwind CSS v4's PostCSS plugin. Check for `postcss.config.mjs`:
+
+```javascript
+export default {
+  plugins: {
+    "@tailwindcss/postcss": {},
+  },
+};
+```
+
+**Common mistake**: Using Tailwind v3's `tailwindcss` PostCSS plugin instead of `@tailwindcss/postcss`.
+
+## 3. CSS entry file
+
+Check that the global CSS file imports the nativewind theme:
+
+```css
+@import "tailwindcss";
+@import "nativewind/theme";
+```
+
+**Common mistake**: Missing `@import "nativewind/theme"` — this provides RN-specific utilities.
+
+## 4. Metro config
+
+Check `metro.config.js` for `withNativewind()`:
+
+```javascript
+const { withNativewind } = require("nativewind/metro");
+module.exports = withNativewind(config);
+```
+
+**Common mistake**: Using `withNativeWind` (capital W) — deprecated.
+
+## 5. Babel config
+
+Check that the babel plugin is configured. The react-native-css babel plugin should be active (this is handled by `withNativewind` in metro config, but verify).
+
+## 6. TypeScript
+
+Check for `nativewind-env.d.ts` in project root — should be auto-generated. If missing, the `withNativewind` metro config may not be running.
+
+## 7. Common symptoms
+
+- **"className is not a valid prop"**: Babel plugin not active — check metro config
+- **Styles not applying**: CSS file not imported, or PostCSS not processing
+- **Build errors with Tailwind**: Wrong Tailwind version (needs v4+)
+- **Runtime errors about react-native-css**: Missing peer dependency
+
+## Approach
+
+Ask the user what symptom they're seeing, then check the relevant configs. Read their actual files to diagnose rather than guessing.
```

---

### Incident Patch 8: `c51a7869` (2026-03-08)
**Commit Message**: fix: fix build-ios-dev CI job

- Add pod install step after expo prebuild (the ios folder is committed
  so prebuild reuses it and skips pod install)
- Cache CocoaPods to speed up subsequent runs
- Remove unnecessary gem install xcpretty (pre-installed on macos runners)
- Tee xcodebuild output so errors are visible when the build fails
  instead of being swallowed by xcpretty

**File**: `.github/actions/ios-dev-app/action.yml` (modified, +16/-3)
```diff
@@ -4,6 +4,14 @@ description: Create IOS Development App
 runs:
   using: composite
   steps:
+    - name: Cache CocoaPods
+      uses: actions/cache@v4
+      with:
+        path: example/ios/Pods
+        key: pods-${{ runner.os }}-${{ hashFiles('example/ios/Podfile.lock') }}
+        restore-keys: |
+          pods-${{ runner.os }}-
+
     - name: Cache iOS development build
       id: ios-dev-cache
       uses: actions/cache@v4
@@ -37,9 +45,10 @@ runs:
       shell: bash
       run: yarn example expo prebuild --platform ios
 
-    - name: Install xcpretty
+    - name: Install CocoaPods dependencies
       shell: bash
-      run: gem install xcpretty
+      working-directory: example/ios
+      run: pod install
 
     - name: Build iOS development app
       id: build
@@ -57,7 +66,11 @@ runs:
           -sdk iphonesimulator \
           -derivedDataPath build/DerivedData \
           CODE_SIGNING_ALLOWED=NO \
-          build | xcpretty
+          build 2>&1 | tee /tmp/xcodebuild.log | xcpretty || {
+          echo "❌ xcodebuild failed. Raw output:"
+          cat /tmp/xcodebuild.log | grep -A 5 "error:"
+          exit 1
+        }
 
         cd ..
 
```

---

### Incident Patch 9: `a4090140` (2026-03-08)
**Commit Message**: fix: make CI green

- Add .yarn/cache/ and .yarn/install-state.gz to .gitignore (fixes
  "unstaged files detected" in CI after yarn install)
- Add yarn build step before yarn test in CI workflow (tests resolve
  through package.json exports pointing at ./dist/)
- Fix @typescript-eslint/unbound-method in plugin.tsx by avoiding
  destructured matchVariant
- Fix @typescript-eslint/no-unsafe-assignment in test-utils.tsx

**File**: `.github/workflows/ci.yml` (modified, +3/-0)
```diff
@@ -38,6 +38,9 @@ jobs:
       - name: Setup
         uses: ./.github/actions/setup
 
+      - name: Build package
+        run: yarn build
+
       - name: Run unit tests
         run: yarn test --maxWorkers=2 --coverage
 
```

**File**: `.gitignore` (modified, +4/-0)
```diff
@@ -71,6 +71,10 @@ typings/
 # Yarn Integrity file
 .yarn-integrity
 
+# Yarn 4
+.yarn/cache/
+.yarn/install-state.gz
+
 # dotenv environment variables file
 .env
 .env.test
```

**File**: `src/plugin.tsx` (modified, +27/-30)
```diff
@@ -7,19 +7,17 @@ function kebabCase(str: string) {
   );
 }
 
-const nativewind: PluginCreator = plugin.withOptions(
-  () =>
-    ({ matchVariant }) => {
-      matchVariant(
-        "@map",
-        (value = "", { modifier }) => {
-          value = kebabCase(value.replace(/&/, "\\&"));
-
-          if (modifier) {
-            modifier = modifier.replace(/&/, "\\&");
-          }
-
-          /**
+const nativewind: PluginCreator = plugin.withOptions(() => (api) => {
+  api.matchVariant(
+    "@map",
+    (value = "", { modifier }) => {
+      value = kebabCase(value.replace(/&/, "\\&"));
+
+      if (modifier) {
+        modifier = modifier.replace(/&/, "\\&");
+      }
+
+      /**
            Adding @media all is a hack for Tailwind CSS which has undocumented behavior
            If we do this `@nativeMapping { ...values } @slot;` it doesn't work, even if we
            wrap it like `& { @nativeMapping { ...values } @slot; }`
@@ -31,23 +29,22 @@ const nativewind: PluginCreator = plugin.withOptions(
            This does lead to weird looking CSS, but it works inside the browser and React Native
            */
 
-          if (modifier && value) {
-            // @nativeMapping-[value]/<modifier>:text-red-500
-            // In this instance, we are moving value (the style nativeMapping) to the modifier (the target key)
-            return `@nativeMapping { ${modifier}:${value} }; @media all`;
-          } else if (modifier && !value) {
-            // @nativeMapping/<modifier>:text-red-500
-            // In this instance, we are moving the last style value to the modifier
-            return `@nativeMapping ${modifier}; @media all`;
-          } else if (!modifier && value) {
-            return `@nativeMapping ${value}; @media all`;
-          } else {
-            return "";
-          }
-        },
-        { values: { DEFAULT: undefined } },
-      );
+      if (modifier && value) {
+        // @nativeMapping-[value]/<modifier>:text-red-500
+        // In this instance, we are moving value (the style nativeMapping) to the modifier (the target key)
+        return `@nativeMapping { ${modifier}:${value} }; @media all`;
+      } else if (modifier && !value) {
+        // @nativeMapping/<modifier>:text-red-500
+        // In this instance, we are moving the last style value to the modifier
+        return `@nativeMapping ${modifier}; @media all`;
+      } else if (!modifier && value) {
+        return `@nativeMapping ${value}; @media all`;
+      } else {
+        return "";
+      }
     },
-);
+    { values: { DEFAULT: undefined } },
+  );
+});
 
 export default nativewind;
```

**File**: `src/test-utils.tsx` (modified, +5/-3)
```diff
@@ -120,9 +120,11 @@ function getClassNames(
   }
 
   if (component.props.children) {
-    const children: ReactElement[] = Array.isArray(component.props.children)
-      ? component.props.children
-      : [component.props.children];
+    const children = (
+      Array.isArray(component.props.children)
+        ? component.props.children
+        : [component.props.children]
+    ) as ReactElement[];
 
     for (const child of children) {
       getClassNames(child as ReactElement<PropsWithChildren>, classNames);
```

---

### Incident Patch 10: `dacc1d6a` (2026-03-03)
**Commit Message**: fix: fix broken ./types export condition

The "./types" export uses the non-standard "typescript" condition
(not recognized by TypeScript) and points to a missing file.

Fix the condition to "types" (matching the fix in #1638 for "." and
"./babel") and add the missing types.d.ts that re-exports className
augmentations from react-native-css/types.

**File**: `package.json` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@
       }
     },
     "./types": {
-      "typescript": "./types.d.ts"
+      "types": "./types.d.ts"
     },
     "./theme": "./theme.css"
   },
```

**File**: `types.d.ts` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+/// <reference types="react-native-css/types" />
```

#### Recent Merged Pull Requests:
- **PR #1868** (2026-09-15): docs: sync skills and contributor guidance with the v5 RC (@danstepanov)
- **PR #1867** (2026-09-14): Update published RC release documentation (@danstepanov)
- **PR #1866** (2026-09-14): Update migration skills for Nativewind v5 RC (@danstepanov)
- **PR #1865** (2026-09-14): Version Packages (@github-actions[bot])
- **PR #1864** (2026-09-14): Update Nativewind v4 for Expo SDK 57 (@danstepanov)
- **PR #1859** (2026-09-13): ci: add RC publishing to the release workflow (@danstepanov)
- **PR #1858** (2026-09-13): fix: resolve Nativewind v5 compatibility issues with Expo 57 (@danstepanov)
- **PR #1853** (closed): fix(react-native-css-interop): declaration guard retains previousState, leaking every past render (@suminc7)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
