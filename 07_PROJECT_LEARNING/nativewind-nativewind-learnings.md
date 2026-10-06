# Forensic Learning Record (Deep Inspection): nativewind/nativewind

> **Canonical Artifact**: `07_PROJECT_LEARNING/nativewind-nativewind-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nativewind/nativewind](https://github.com/nativewind/nativewind))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:15:08.261Z  
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

### Core Architecture Module: `example/app.config.ts`
```
import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    name: "example",
    slug: "example",
    userInterfaceStyle: "automatic",
    android: {
      package: "dev.nativewind",
    },
    ios: {
      bundleIdentifier: "dev.nativewind",
    },
    experiments: {
      reactCompiler: false,
      buildCacheProvider:
        process.env.CI || process.env.EAS_BUILD_CACHE_PROVIDER
          ? "eas"
          : undefined,
    },
  };
};

```

### Core Architecture Module: `example/babel.config.js`
```
module.exports = function (api) {
  api.cache(true);

  return {
    presets: ["babel-preset-expo"],
  };
};

```

### Core Architecture Module: `example/index.js`
```
import { registerRootComponent } from "expo";

import App from "./src/App";

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

```

### Core Architecture Module: `example/ios/example/AppDelegate.swift`
```
import Expo
import React
import ReactAppDependencyProvider

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

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

### Incident Patch 1: `f9cfae6c` (2026-09-15)
**Commit Message**: docs: align Nativewind guidance with the v5 RC

**File**: `.claude/skills/add-test/SKILL.md` (modified, +4/-2)
```diff
@@ -27,7 +27,7 @@ describe("Feature Name", () => {
 });
 ```
 
-For custom utilities that map to non-style props (like `elevation`, `tint`, `ripple`), the expected output includes those props directly:
+Check `theme.css` and existing tests to distinguish style properties from component props. Elevation remains in `style`; ripple utilities map to `android_ripple`. Do not move every custom utility directly onto component props:
 
 ```typescript
 test("elevation-sm", async () => {
@@ -49,4 +49,6 @@ test("elevation-sm", async () => {
 
 4. **Write the test**: Follow the exact convention above. Place it in the appropriate existing test file, or create a new one if it's a new category.
 
-5. **Run the test**: Execute `yarn test` to verify it passes.
+5. **Run the test**: Run the affected Jest file with `yarn test <test-path>` and the required repository checks. These tests exercise local source with mocked native hosts; they do not establish device rendering or interaction coverage.
+
+Use `sourceFile` or `sourceInline` when testing class discovery and `optimize` when the production compilation path matters. Check the option definitions in `src/test-utils.tsx` before adding an integration case.
```

**File**: `.claude/skills/architecture/SKILL.md` (modified, +3/-1)
```diff
@@ -6,7 +6,7 @@ allowed-tools: Read, Grep, Glob
 
 You are explaining the architecture of **Nativewind v5** to a contributor.
 
-Start by reading `DEVELOPMENT.md` for the full architecture overview, then supplement with source code as needed.
+Start by reading `DEVELOPMENT.md` for the full architecture overview, then read `docs/expo57-rc.md` for the published RC pair and `docs/rc-compatibility.md` for platform and value limits. Supplement these with the current source code.
 
 ## How to explain
 
@@ -24,3 +24,5 @@ Start by reading `DEVELOPMENT.md` for the full architecture overview, then suppl
 4. **Show relevant code**: Read the actual source files to illustrate points. The src/ is small enough to show most of it.
 
 5. **Answer follow-up questions** by searching the codebase.
+
+Keep v4 APIs separate from v5: `styled` returns a wrapper that callers must render; v4 global `cssInterop` and `remapProps` are not v5 exports. Read `src/index.tsx` and the pinned engine contract before describing an API. Explain import rewriting separately from runtime styling and distinguish compiler tests from device verification.
```

**File**: `.claude/skills/debug-nw/SKILL.md` (modified, +26/-41)
```diff
@@ -1,69 +1,54 @@
 ---
 name: debug-nw
-description: Debug a Nativewind v5 setup issue. Walks through common configuration problems with metro, babel, postcss, and dependencies.
+description: Debug a Nativewind v5 RC setup issue by checking actual dependencies, Metro, Babel, PostCSS, CSS and runtime behavior.
 allowed-tools: Read, Grep, Glob, Bash
 ---
 
-You are helping debug a Nativewind v5 configuration issue. Walk through these checks systematically.
+Read `DEVELOPMENT.md`, `docs/expo57-rc.md` and the relevant sections of `docs/rc-compatibility.md`. Inspect the application's files and resolved dependencies before proposing changes. If the installed package is v4, use the v4 documentation; do not apply v5 configuration to it.
 
-## 1. Version check
+## 1. Check the version pair
 
-- Is `nativewind` at v5.x? (`package.json`)
-- Is `react-native-css` installed as a peer dependency? Must be `^3.0.1`
-- Is `tailwindcss` v4+? Must be `>4.1.11`
-- Is `@tailwindcss/postcss` installed?
+The current target is `nativewind@5.0.0-rc.0` with exactly `react-native-css@3.1.0-rc.0`. Check the manifest, lockfile and installed versions. Do not substitute `@latest`, `@preview` or the old `^3.0.1` engine range. The repository manifest can retain a preview version between releases; use the published release contract for consumer setup.
 
-## 2. PostCSS config
+The tested target is Expo 57.0.22, React Native 0.86.3, React 19.2.3, Reanimated 4.5.1 and Worklets 0.10.1. The tested CSS toolchain uses Tailwind CSS and `@tailwindcss/postcss` 4.1.12 with Lightning CSS 1.30.1. Engine peer minimums are not evidence of runtime verification on every older SDK. Treat an Expo upgrade as a separate step and preserve the app's package manager and unrelated configuration.
 
-Nativewind v5 uses Tailwind CSS v4's PostCSS plugin. Check for `postcss.config.mjs`:
+## 2. Check PostCSS and the CSS entry
 
-```javascript
-export default {
-  plugins: {
-    "@tailwindcss/postcss": {},
-  },
-};
-```
-
-**Common mistake**: Using Tailwind v3's `tailwindcss` PostCSS plugin instead of `@tailwindcss/postcss`.
+Expo 57 discovers `postcss.config.js` and `postcss.config.mjs`, but not `postcss.config.cjs`. Use `@tailwindcss/postcss`, not the Tailwind v3 PostCSS plugin:
 
-## 3. CSS entry file
+```js
+export default { plugins: { "@tailwindcss/postcss": {} } };
+```
 
-Check that the global CSS file imports the nativewind theme:
+Import the CSS once from `App.tsx` or the Router root layout. Keep utilities unlayered so React Native Web defaults do not override them:
 
 ```css
-@import "tailwindcss";
+@import "tailwindcss/theme.css" layer(theme);
+@import "tailwindcss/preflight.css" layer(base);
+@import "tailwindcss/utilities.css";
 @import "nativewind/theme";
 ```
 
-**Common mistake**: Missing `@import "nativewind/theme"` — this provides RN-specific utilities.
+Check the existing package manager overrides or resolutions for Lightning CSS 1.30.1. Preserve custom theme values, plugins, source discovery and workspace paths.
 
-## 4. Metro config
+## 3. Check Metro and Babel
 
-Check `metro.config.js` for `withNativewind()`:
-
-```javascript
-const { withNativewind } = require("nativewind/metro");
-module.exports = withNativewind(config);
-```
+Wrap the existing Metro configuration with `withNativewind` from `nativewind/metro`. Preserve custom resolvers and transformers. The deprecated `withNativeWind` alias still exists; its spelling alone does not explain a failure.
 
-**Common mistake**: Using `withNativeWind` (capital W) — deprecated.
+Keep `babel-preset-expo` and unrelated plugins. Remove the v4 Nativewind Babel preset and `jsxImportSource` settings when migrating from v4. The v5 Metro integration enables the engine's import rewriting; do not add the old v4 preset to fix it.
 
-## 5. Babel config
+## 4. Check TypeScript and component contracts
 
-Check that the babel plugin is configured. The react-native-css babel plugin should be active (this is handled by `withNativewind` in metro config, but verify).
+Ensure the generated `nativewind-env.d.ts` references `react-native-css/types` and belongs to the TypeScript project. A type error about `className` can indicate missing declarations or an unsupported component, not necessarily a Babel problem. If the TypeScript project checks CSS side effect imports, include `declare module "*.css";` in an application declaration file.
 
-## 6. TypeScript
+Read the actual exports in `src/index.tsx`. V5 does not export v4 `cssInterop`, `remapProps` or `verifyInstallation`. `styled` returns a component that callers must render; it does not globally register the original component. Use the RC mapping contract, including `nativeStyleMapping` and the supported `nativeStyleToProp` alias. Do not invent a `global` option or suppress unsupported props with casts.
 
-Check for `nativewind-env.d.ts` in project root — should be auto-generated. If missing, the `withNativewind` metro config may not be running.
+For dynamic variables, ch
```

**File**: `.claude/skills/triage/SKILL.md` (modified, +32/-35)
```diff
@@ -1,19 +1,19 @@
 ---
 name: triage
-description: Triage a Nativewind or react-native-css GitHub issue. Reads the issue, determines version/repo, creates a reproduction, tests against latest published and local HEAD, then drafts a comment.
+description: Triage a Nativewind or react-native-css GitHub issue. Reads the issue, determines version/repo, creates a reproduction, tests against the applicable published release and local HEAD, then drafts a comment.
 argument-hint: <issue-number-or-url>
 allowed-tools: Read, Grep, Glob, Bash, Write, Edit, Agent, WebFetch
 ---
 
-You are triaging a GitHub issue for either **nativewind/nativewind** or **nativewind/react-native-css**. Your goal is to understand the issue, reproduce it, verify it against the latest releases and local HEAD, and draft a response.
+You are triaging a GitHub issue for either **nativewind/nativewind** or **nativewind/react-native-css**. Your goal is to understand the issue, reproduce it, verify it against the applicable published release and local HEAD, and draft a response.
 
 ## Project context
 
 Before diving in, read the relevant project docs for architecture and conventions:
 
-- **Nativewind v5**: Read `CLAUDE.md` and `DEVELOPMENT.md` in `/Users/dan/Developer/nativewind/nativewind/`
-- **react-native-css**: Read `CLAUDE.md` and `DEVELOPMENT.md` in `/Users/dan/Developer/nativewind/react-native-css/`
-- **Nativewind v4**: Read `CONTRIBUTING.md` and check test structure in `/Users/dan/Developer/nativewind/nativewind-v4/`
+- **Nativewind v5**: Read repository instructions, `DEVELOPMENT.md`, `docs/expo57-rc.md` and `docs/rc-compatibility.md` in the v5 checkout.
+- **react-native-css**: Locate its checkout and read its repository instructions and `DEVELOPMENT.md`.
+- **Nativewind v4**: Locate a checkout of the `v4` branch, read its contributing guide and inspect its test structure. Do not apply the v5 repository layout to v4.
 
 These docs describe the architecture, test conventions, commands, and common pitfalls for each project. Use them to inform your reproduction strategy and root cause analysis.
 
@@ -53,8 +53,8 @@ Read `DEVELOPMENT.md` in the react-native-css repo for the full architecture dia
 |---|---|
 | Branch | `main` |
 | npm package | `react-native-css` |
-| npm tag | `@latest` |
-| Local repo path | `/Users/dan/Developer/nativewind/react-native-css` |
+| RC consumer version | `3.1.0-rc.0` (paired with Nativewind 5.0.0-rc.0) |
+| Local repo path | `<react-native-css-checkout>` |
 
 ### If filed on `nativewind/nativewind`
 
@@ -63,16 +63,16 @@ Figure out whether this is a **v4** or **v5** issue. Clues:
 - Presence of `tailwind.config.js` = v4 (v5 uses Tailwind CSS v4's `@tailwindcss/postcss`)
 - Presence of `react-native-css-interop` = v4; `react-native-css` = v5
 - Mention of `@import "nativewind/theme"` = v5
-- If unclear, assume v5 (the active development branch) but note the ambiguity
+- If unclear, inspect the lockfile or ask for resolved versions before applying version specific configuration. A Tailwind config file alone does not establish the installed major version.
 
-| | Nativewind v4 (stable) | Nativewind v5 (preview) |
+| | Nativewind v4 (stable) | Nativewind v5 (release candidate) |
 |---|---|---|
 | Branch | `v4` | `main` |
 | Tailwind | v3 | v4 |
 | Runtime | `react-native-css-interop` | `react-native-css` |
-| npm tag | `@latest` | `@preview` |
+| Current version | `4.2.7` | `5.0.0-rc.0` with `react-native-css@3.1.0-rc.0` |
 | Repro template | `npx rn-new@latest --nativewind` | `npx rn-new@next --nativewind` |
-| Local repo path | `/Users/dan/Developer/nativewind/nativewind-v4` | `/Users/dan/Developer/nativewind/nativewind` |
+| Local repo path | `<nativewind-v4-checkout>` | `<nativewind-v5-checkout>` |
 
 ## Step 3: Assess reproducibility
 
@@ -133,31 +133,32 @@ describe("Issue #<number>", () => {
 });
 ```
 
-Run with: `cd /Users/dan/Developer/nativewind/react-native-css && yarn test src/__tests__/native/triage-<issue-number>.test.tsx`
+Run with: `cd <react-native-css-checkout> && yarn test src/__tests__/native/triage-<issue-number>.test.tsx`
 
 **For compiler issues** (CSS parses wrong, wrong JSON output):
 
 Read existing tests in `src/__tests__/compiler/` (e.g., `compiler.test.tsx`, `declarations.test.tsx`) to match the pattern. Compiler tests verify the JSON output structure from `compile()`.
 
-Run with: `cd /Users/dan/Developer/nativewind/react-native-css && yarn test compiler`
+Run with: `cd <react-native-css-checkout> && yarn test compiler`
 
 **For babel issues** (import rewriting broken):
 
 Read existing tests in `src/__tests__/babel/` which use `babel-plugin-tester`.
 
-Run with: `cd /Users/dan/Developer/nativewind/react-native-css && yarn test babel`
+Run with: `cd <react-native-css-checkout> && yarn test babel`
 
 **For runtime issues that need a full app:**
 ```bash
-cd /Users/dan/Developer/nativewind/react-native-css/example
-yarn example start:build  # Rebuilds library + starts Metro
+cd <react
```

**File**: `.github/ISSUE_TEMPLATE/bug_report.md` (modified, +5/-2)
```diff
@@ -11,9 +11,9 @@ assignees: ''
 A clear and concise description of what the bug is.
 
 **Reproduction**
-Please see our contribution guide: https://github.com/nativewind/nativewind/blob/main/contributing.md#opening-an-issue
+Please see our contribution guide: https://github.com/nativewind/nativewind/blob/main/contributing.md#report-an-issue
 
-⚠️ **Important**: Issues without a valid reproduction link will not be reviewed and will be automatically closed. Use the rn-new template to create a reproduction:
+Provide a public reproduction repository when possible. The reproduction workflow can scaffold an app when a link is missing, but a starter may not reproduce your configuration or custom components. Use the appropriate rn-new template:
 - `npx rn-new@latest --nativewind`
 - `npx rn-new@latest --nativewind --expo-router`
 - `npx rn-new@next --nativewind`
@@ -24,5 +24,8 @@ If you have a usage question, please use the [Discord](https://discord.gg/ypNakA
 **Expected behavior**
 A clear and concise description of what you expected to happen.
 
+**Environment**
+Include exact resolved Nativewind and engine versions, Expo SDK, React Native, Reanimated and Worklets versions, package manager, platform and OS version, and development or Release mode. For v5 RC setup, follow [the release contract](https://github.com/nativewind/nativewind/blob/main/docs/expo57-rc.md).
+
 **Additional context**
 Add any other context about the problem here. If applicable, add screenshots to help explain your problem.
```

**File**: `.github/scripts/judge-repro.py` (modified, +9/-4)
```diff
@@ -161,7 +161,7 @@ def main() -> int:
         )
 
     prompt = (
-        "You are a CI judge for the NativeWind project. A user filed a bug "
+        "You are a CI judge for the Nativewind project. A user filed a bug "
         "report and our CI tried to reproduce it on the platforms below.\n\n"
         "Decide whether the reported bug *actually reproduces* in the "
         "captured evidence. Treat these as runtime signal, in roughly this "
@@ -177,12 +177,17 @@ def main() -> int:
         "  4. `build_log_tail` / `repro_status` — a build failure that "
         "matches the reported symptom is itself a reproduction.\n\n"
         "The bug reproduces when the captured evidence contains the described "
-        "error message, stack trace, or visibly broken UI. The bug does NOT "
-        "reproduce when the app launches normally and the described symptom "
-        "is not observed. Classify as `inconclusive` when: the build failed "
+        "error message, stack trace, or visibly broken UI. Use `cannot-reproduce` "
+        "only when the reported trigger was exercised in the relevant "
+        "environment and the symptom was not observed. A successful build or "
+        "normal launch alone cannot rule out issues involving input, themes, "
+        "mappings, navigation or animations. Keep results specific to each "
+        "tested platform and configuration. Do not infer package versions or "
+        "broader compatibility from a generator tag. Classify as `inconclusive` when: the build failed "
         "for reasons unrelated to the reported issue (toolchain/SDK mismatch); "
         "the RN red-box says \"No script URL provided\" or similar bundler "
         "plumbing failures (we never ran the user JS, so we cannot judge); "
+        "the reported trigger or required interaction was not exercised; "
         "or the captured channels are empty/missing.\n\n"
         "Before judging, look at `evidence_summary.flags` for each platform. "
         "You may not claim a channel is empty if its size in "
```

**File**: `.github/workflows/issue-repro.yml` (modified, +1/-1)
```diff
@@ -251,7 +251,7 @@ jobs:
             // freshly-generated `rn-new` starter. Pick the channel/stack
             // hinted at in the body so the starter is at least plausibly
             // close to the reporter's setup.
-            const wantsNext = /\b(nativewind\s*v?5|next|5\.0\.0-preview|preview\.?\d)\b/i.test(body);
+            const wantsNext = /\b(nativewind[\s@]*v?5|next|5\.0\.0-(?:preview|rc)|preview\.?\d)\b/i.test(body);
             const wantsExpoRouter = /\bexpo[\s-]?router\b/i.test(body);
             const wantsReactNavigation = /\breact[\s-]?navigation\b/i.test(body);
             // expo-router takes precedence if both are mentioned (it implies
```

**File**: `DEVELOPMENT.md` (modified, +12/-5)
```diff
@@ -3,11 +3,12 @@
 ## Version Context
 
 This is **Nativewind v5** (main branch), targeting **Tailwind CSS v4**.
-The stable version (v4, targeting Tailwind v3) lives on the `v4` branch.
+The stable version (v4.2.7, targeting Tailwind v3) lives on the `v4` branch.
+The published v5 target is Nativewind 5.0.0-rc.0 with exactly react-native-css 3.1.0-rc.0. Read [the release setup](docs/expo57-rc.md) and [compatibility limits](docs/rc-compatibility.md) before advising consumers. A preview version in the source manifest does not identify the current published consumer target.
 
 ## Documentation
 
-- **v5 docs (preview):** https://www.nativewind.dev/v5
+- **v5 docs (release candidate):** https://www.nativewind.dev/v5
 - **v4 docs (stable):** https://www.nativewind.dev/
 
 The docs site is maintained in a separate repository: https://github.com/nativewind/website
@@ -40,7 +41,7 @@ theme.css provides RN-specific theme values
     ↓
 react-native-css compiler processes CSS → React Native styles
     ↓
-react-native-css babel plugin transforms JSX for className support
+react-native-css Babel plugin rewrites imports for className support
     ↓
 react-native-css runtime applies styles reactively
 ```
@@ -80,7 +81,7 @@ yarn test                # Run tests (Jest)
 yarn test:watch          # Watch mode
 yarn typecheck           # TypeScript validation
 yarn lint                # ESLint + Prettier
-yarn release             # Publish via release-it (maintainers only)
+# Maintainers: see contributing.md and .github/workflows/release.yml for publishing
 ```
 
 ### Example App
@@ -103,7 +104,7 @@ yarn example android     # Build and run on Android
     });
   });
   ```
-- **Options:** `renderCurrentTest` supports `css`, `extraCss`, `theme`, `preflight`, `plugin`, `debug`
+- **Options:** `renderCurrentTest` supports `css`, `extraCss`, `className`, `sourceInline`, `sourceFile`, `optimize`, `theme`, `preflight`, `plugin`, `debug`
 - **CSS compilation happens in tests** via `react-native-css/jest` — no separate build step needed
 
 ## Code Conventions
@@ -123,3 +124,9 @@ yarn example android     # Build and run on Android
 - **Tailwind v4 only** — uses `@tailwindcss/postcss` plugin system, not v3's `tailwind.config.js`
 - **`@map` variant** is the key integration point — it generates `@nativeMapping` directives that `react-native-css` understands
 - **`withNativewind` vs `withNativeWind`** — the capital-W version is deprecated
+
+## Agent guidance
+
+Contributor skills live in `.claude/skills/`: `architecture`, `debug-nw`, `add-test` and `triage`. Application migration skills live in `skills/nativewind-v4-to-v5` and `skills/nativewind-preview-to-rc`; both include read only inventory scripts and measured verification limits. Update affected guidance when changing setup or public contracts. Keep historical evaluation versions intact and distinguish them from the current stable release.
+
+The website repository generates `/llms.txt`, `/llms-full.txt`, their `/v5` equivalents and page Markdown endpoints from the documentation. Changes to shared MDX helpers must remain represented in those exports. Run its `pnpm test:llm` and `pnpm build` checks when changing that pipeline.
```

---

### Incident Patch 2: `696a0bbb` (2026-09-14)
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
-        installed = { name: data.name, version: data.version, manifest: fs.realpathSync(candidate), peers: data.peerDependencies || {} };
-        if (data.name !== name) add('installed-identity-mismatch', 'incompatible', 'Repair the resolved package identity before migration.', [name, installed]);
-      } catch (e) { add('installed-manifest-unreadable', 'needs-review', 'Inspect the installed package manifest.', [candidate, e.message]); }
+        installed = {
+          name: data.name,
+          version: data.version,
+          manifest: fs.realpathSync(candidate),
+          peers: data.peerDependencies || {},
+        };
+        if (data.name !== name)
+          add(
+            "installed-identity-mismatch",
+            "incompatible",
+            "Repair the resolved package identity before migration.",
+            [name, installed],
+          );
+      } catch (e) {
+        add(
+          "installed-manifest-unreadable",
+          "needs-review",
+          "Inspect the installed package 
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
-        installed = { name: data.name, version: data.version, manifest: fs.realpathSync(candidate), peers: data.peerDependencies || {} };
-        if (data.name !== name) add('installed-identity-mismatch', 'incompatible', 'Repair the resolved package identity before migration.', [name, installed]);
-      } catch (e) { add('installed-manifest-unreadable', 'needs-review', 'Inspect the installed package manifest.', [candidate, e.message]); }
+        installed = {
+          name: data.name,
+          version: data.version,
+          manifest: fs.realpathSync(candidate),
+          peers: data.peerDependencies || {},
+        };
+        if (data.name !== name)
+          add(
+            "installed-identity-mismatch",
+            "incompatible",
+            "Repair the resolved package identity before migration.",
+            [name, installed],
+          );
+      } catch (e) {
+        add(
+          "installed-manifest-unreadable",
+          "needs-review",
+          "Inspect the installed package 
```

---

### Incident Patch 3: `9be5eddc` (2026-09-13)
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

### Incident Patch 4: `999403a6` (2026-09-12)
**Commit Message**: docs: prepare Nativewind Expo 57 RC guidance and migration draft

**File**: `docs/expo57-rc.md` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+# Nativewind v5 Expo 57 release candidate
+
+Publication draft. These versions are prepared locally and are not available on npm yet. Do not announce the installation commands until registry verification and public tag promotion succeed.
+
+Proposed pair: Nativewind 5.0.0-rc.0 and react-native-css 3.1.0-rc.0. Nativewind's peer dependency selects that exact engine candidate. The target is Expo 57.0.22, React Native 0.86.3, React 19.2.3, Reanimated 4.5.1, and Worklets 0.10.1.
+
+## Installation after publication
+
+In an Expo 57 project:
+
+```sh
+npm install --save-exact nativewind@5.0.0-rc.0 react-native-css@3.1.0-rc.0 tailwindcss@4.1.12 @tailwindcss/postcss@4.1.12 lightningcss@1.30.1
+npx expo install react-native-reanimated react-native-worklets react-native-safe-area-context expo-system-ui
+```
+
+Keep the native dependency versions selected by the supported Expo SDK. Restart Metro after installing or upgrading the engine. Rebuild the native app when native dependencies change.
+
+Use postcss.config.js:
+
+```js
+module.exports = { plugins: { '@tailwindcss/postcss': {} } };
+```
+
+Use metro.config.cjs:
+
+```js
+const { getDefaultConfig } = require('expo/metro-config');
+const { withNativewind } = require('nativewind/metro');
+module.exports = withNativewind(getDefaultConfig(__dirname));
+```
+
+Use global.css and import it once in the root layout:
+
+```css
+@import "tailwindcss";
+@import "nativewind/theme";
+```
+
+Keep babel-preset-expo in Babel configuration. Enable userInterfaceStyle automatic in app.json for system appearance changes. TypeScript setup generates the Nativewind environment declaration and ensures it belongs to the TypeScript project.
+
+## Migration from v4
+
+Upgrade Tailwind 3 configuration to Tailwind 4 CSS configuration. Replace the v4 Metro integration with withNativewind above. Remove the v4 Nativewind Babel preset and JSX import source setting; keep the Expo preset. Use react-native-css adapters for third party components and validate prop mappings against the new mapping contract. The old react-native-css-interop engine is not the v5 engine.
+
+For default dark variants, use system appearance media queries. Read useColorScheme from react-native. Set Appearance.setColorScheme('dark') or 'light' for a native override and 'unspecified' to restore the system preference on this Expo target. Legacy @cssInterop and @react-native configuration directives report migration errors. Use compiler inlineVariables.exclude for variables that must remain available at runtime. Prefer VariableContextProvider over the deprecated vars helper. Express cross platform length variables with units, such as '80.5px'.
+
+Keep a copy of your previous package.json, lockfile, and configuration before migration. To revert, restore those files, reinstall the previous dependencies, and rebuild native apps if their native dependencies changed.
+
+## Changes and limitations
+
+The candidate contains Expo alignment, production prop mapping fixes, layout and style regression fixes, Node ESM tooling entries, TypeScript declaration membership fixes, and compiler cache invalidation. Detailed evidence distinguishes compiler, runtime, integration, and device verification.
+
+Android animation cancellation remains affected by [Reanimated issue 10507](https://github.com/software-mansion/react-native-reanimated/issues/10507). Changing a running rotation to animationName none or removing the animation styles can leave its final transform in place. Direct Reanimated controls reproduce the issue without either library. The behavior is intermittent: an isolated none check passed while the complete integrated audit reproduced the failure. The exact Android animate-none reset case is retained as an accepted upstream defect and is excluded from passing support claims. The iPhone case, browser cancellation checks and all other motion cases remain required. No experimental dependency patch is included. Physical Android testing is excluded; Android verification uses an emulator.
+
+The complete inventory review accounts for 6,129 entries with no unresolved dispositions. The final matrix requires 4,985 executions across compiler, runtime, tooling, rendering and interaction layers. All 4,985 required executions passed the final integrity checked release gate, with zero missing assertions. These counts describe the reviewed scope and do not claim that every CSS value works on every platform. The audit is complete. Public source review and a subsequent publication instruction remain necessary before npm release.
+
+The [compatibility guide](rc-compatibility.md) records supported value domains, migrations, safe rejections and platform limits. Browser image fitting in the historical React Native Web and Expo Image adapters requires explicit resizeMode or contentFit/contentPosition props. The original WebKit backface scene and Firefox select-all interaction remain unverified. The generated select-none utility requires
```

**File**: `docs/rc-compatibility.md` (modified, +10/-2)
```diff
@@ -54,9 +54,9 @@ Static screenshots and geometry establish only the recorded component, values an
 
 Browser cursor checks verify computed properties because screenshots do not capture the system cursor. The selected Firefox and WebKit backdrop checks also verify computed properties where plain CSS screenshot controls are insensitive. Firefox overscroll containment and WebKit snap stopping remain unverified as behavior. Touch gestures are tested in Chromium; those gesture results do not establish Firefox or WebKit behavior. WebKit rendering for the selected `divide-solid` and `divide-double` scenes remains unverified. The compatibility report retains these gaps alongside the independently required passing cells.
 
-Android animation cancellation remains tracked as an upstream Reanimated limitation in [Reanimated issue 10507](https://github.com/software-mansion/react-native-reanimated/issues/10507). No local Reanimated patch is included. Physical Android verification was waived; the Android Release emulator and physical iPhone remain required.
+Android animation cancellation remains tracked in [Reanimated issue 10507](https://github.com/software-mansion/react-native-reanimated/issues/10507). Changing a running rotation to animationName none or removing its animation styles can retain the final transform. Isolated none checks can pass, so a passing isolated example does not resolve the defect. The exact Android animate-none reset case is explicitly excluded from passing support claims; iPhone and browser cancellation and every other required motion case remain independently verified. No local Reanimated patch is included. Physical Android verification was waived; the Android Release emulator and physical iPhone remain required.
 
-This guide will receive final audit results and exact installation commands before publication. The public v4 to v5 migration skill follows RC delivery and must be verified against the released packages.
+See [release notes](expo57-rc.md) for the exact installation commands and audit status. The public v4 to v5 migration skill follows RC delivery and must be verified against the released packages.
 
 The remaining browser documentation is tested as explicit examples. Rendering hints such as will-change, font smoothing and OpenType feature selection are checked as computed declarations. Those checks do not promise performance improvements, specific font glyphs or rasterization. Print fragmentation and automatic hyphenation also remain limited to computed declarations; printer pagination and language dictionary behavior are outside this RC claim.
 
@@ -75,3 +75,11 @@ Use the public hyphenated React Native prop for ARIA modifiers, for example `<Vi
 ## Interaction qualifications
 
 The release audit checks touch routing against independent reference presses; focus and active group modifiers retain initial, changed and restored states. Native `select-all` and `select-auto` certify that Text selection is enabled. They do not promise CSS selection expansion semantics. The caret color contract uses Android TextInput `cursorColor`; it does not claim the same prop works on iOS. White, explicit red and CSS current color examples are sampled across seven cursor blink frames. Browser caret paint is outside that native check. Android ripple colors and borderless extent use six frames during a held press. Responsive and safe area rotation require an actual window orientation change.
+
+## Browser component and reference limits
+
+For the original React Native Web Image and Expo Image object fitting examples, use resizeMode or contentFit/contentPosition props on web. Class mapping to the outer View does not certify the nested image renderer. Native image adapter and HTML img utility checks are separate.
+
+The original WebKit backface example and Firefox select-all drag reference remain unverified. WebKit select-none requires the explicit WebkitUserSelect:none style in the pinned engine. The generated utility alone does not prevent selection there. These exact historical nonpassing examples are retained as limitations, with native and other browser coverage required independently.
+
+All three pinned browsers ignore break-before:all and break-after:all; Firefox also ignores avoid-page and column. Matching ignored declarations is recorded as an unsupported fallback, not pagination support. Native animation capture retains the layout effect and mount callback as separate checkpoints. The required trajectory samples start after that callback, with at least two initial observations within 100 milliseconds and the original 60 millisecond tolerance.
```

**File**: `skills/nativewind-v4-to-v5/SKILL.md` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+---
+name: nativewind-v4-to-v5
+description: Migrate an existing Nativewind v4 application to the pinned Nativewind v5 release, preserving custom configuration and verifying the application's native and web behavior.
+---
+
+# Migrate Nativewind v4 to v5
+
+This draft targets Nativewind 5.0.0-rc.0 and react-native-css 3.1.0-rc.0 on Expo 57.0.22. It is staged for evaluation after RC publication. It has not yet passed the independent application migration acceptance matrix and must not be advertised as a verified migration tool. Read [the target and verification contract](references/target.md) before changing dependencies. Verify that both exact versions are available; do not substitute a preview, latest tag or newer RC.
+
+## Inspect before changing
+
+Record the package manager, package and lockfile versions, Expo SDK, React Native, Tailwind, Reanimated and Worklets. Locate Router roots, workspaces, browser entry points, CSS imports, Babel, Metro, PostCSS and TypeScript configuration. Preserve unrelated edits and capture the original configuration and lockfile for recovery.
+
+Search application code for `cssInterop`, `remapProps`, `vars`, `useColorScheme`, `useUnstableNativeVariable`, third party component mappings and imports from `react-native-css-interop`. Inventory custom theme values, plugins and utilities. A partially migrated app needs diagnosis before another conversion pass. Do not remove a dependency still used by another workspace package.
+
+If the Expo version differs from the target, explain the required Expo upgrade and verify it as a separate step within the user's requested scope. Keep native dependencies aligned with Expo. Do not force incompatible React Native, Reanimated or Worklets versions to satisfy a styling migration.
+
+## Apply applicable conversions
+
+Use the project's existing package manager and install the exact package pair in the target contract. Translate Tailwind 3 theme values into Tailwind 4 CSS configuration. Preserve custom values and plugins; when no verified equivalent exists, retain their source and report the manual decision with file locations.
+
+Use `@tailwindcss/postcss` for PostCSS. Import `tailwindcss` and `nativewind/theme` in the root CSS and import that CSS once from the application root. For workspace classes, add the relevant Tailwind `@source` paths. Use `withNativewind` from `nativewind/metro` around Expo's default Metro config while preserving unrelated Metro customizations. Remove the v4 Nativewind Babel preset and Nativewind JSX import source option, preserving `babel-preset-expo` and unrelated plugins. Validate generated environment declarations are included in the TypeScript project; remove obsolete v4 declarations only after all remaining callers are addressed.
+
+Use the v5 public `styled` mapping contract for supported custom components. Do not mechanically rename `cssInterop` or `remapProps`: identity, nesting, prop destinations and precedence can differ. Check the target package's declarations and a representative runtime example for each mapping. Explicit meaningful component props can override generated props. Nested Text inheritance and CSS variables have separate contracts.
+
+Prefer `VariableContextProvider` for variable propagation. Preserve runtime variables by configuring `inlineVariables.exclude` where required. Use units for length variables shared with browsers. Do not treat deprecated `vars` or `useUnstableNativeVariable` as removed APIs; assess their callers and migrate only to verified equivalents.
+
+For the default native dark variants, read `useColorScheme` from `react-native`. Use `Appearance.setColorScheme('dark')` or `'light'` for an override, and `'unspecified'` to restore system appearance on this target. Configure Expo `userInterfaceStyle: 'automatic'` when the app follows system appearance. Preserve intentionally custom browser theme behavior; native Appearance does not replace a browser class selector.
+
+Read [the utility migration candidates](references/utility-migrations.json) only when corresponding utilities occur. These are Tailwind migration intentions with compiled CSS evidence, not proofs of native equivalence. Check the linked compatibility notes for input domains, adapter requirements and explicit platform limitations. Do not globally replace every matching class without validating its use.
+
+## Verify and report
+
+Run dependency consistency and available type, build and application checks. Rebuild native apps when native dependencies change and restart Metro after engine or configuration changes. Exercise the actual native and browser surfaces the application supports. Include rendering, interactions, theme override and system restoration, navigation or remounts, and affected component mappings. Compilation alone does not prove visual parity. Compare representative states with the original app or independent native styles, and use a deliberately wrong value to establish that the obser
```

**File**: `skills/nativewind-v4-to-v5/references/compatibility.md` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
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
+The theme now emits the correct foreground ripple property, preserves numeric ripple radii alongside ripple colors, and converts `corner-rounded` to the engine's circular corner value. Ripple properties apply to Android Pressable components; corner curves use the iOS host style.
+
+An animation name supplied through a CSS variable now resolves to keyframes before it reaches Reanimated. Missing or invalid names are omitted safely, and fallback, removal, restoration and `none` are covered by regression tests.
+
+Use React Native Appearance and `useColorScheme` for native dark mode. The deprecated Nativewind hook delegates to Appearance during migration. The v4 class dark mode configuration is rejected with migration guidance.
+
+## Verification boundaries
+
+Parameterized preview entries such as `w-[n]` describe a value category, not permission to use every CSS expression. The RC audit records the supported domain and representative rendering examples for each reviewed pattern.
+
+| Value category | Native qualification |
+| :--- | :--- |
+| Lay
```

**File**: `skills/nativewind-v4-to-v5/references/installation.md` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+# Nativewind v5 Expo 57 release candidate
+
+Publication draft. These versions are prepared locally and are not available on npm yet. Do not announce the installation commands until registry verification and public tag promotion succeed.
+
+Proposed pair: Nativewind 5.0.0-rc.0 and react-native-css 3.1.0-rc.0. Nativewind's peer dependency selects that exact engine candidate. The target is Expo 57.0.22, React Native 0.86.3, React 19.2.3, Reanimated 4.5.1, and Worklets 0.10.1.
+
+## Installation after publication
+
+In an Expo 57 project:
+
+```sh
+npm install --save-exact nativewind@5.0.0-rc.0 react-native-css@3.1.0-rc.0 tailwindcss@4.1.12 @tailwindcss/postcss@4.1.12 lightningcss@1.30.1
+npx expo install react-native-reanimated react-native-worklets react-native-safe-area-context expo-system-ui
+```
+
+Keep the native dependency versions selected by the supported Expo SDK. Restart Metro after installing or upgrading the engine. Rebuild the native app when native dependencies change.
+
+Use postcss.config.js:
+
+```js
+module.exports = { plugins: { '@tailwindcss/postcss': {} } };
+```
+
+Use metro.config.cjs:
+
+```js
+const { getDefaultConfig } = require('expo/metro-config');
+const { withNativewind } = require('nativewind/metro');
+module.exports = withNativewind(getDefaultConfig(__dirname));
+```
+
+Use global.css and import it once in the root layout:
+
+```css
+@import "tailwindcss";
+@import "nativewind/theme";
+```
+
+Keep babel-preset-expo in Babel configuration. Enable userInterfaceStyle automatic in app.json for system appearance changes. TypeScript setup generates the Nativewind environment declaration and ensures it belongs to the TypeScript project.
+
+## Migration from v4
+
+Upgrade Tailwind 3 configuration to Tailwind 4 CSS configuration. Replace the v4 Metro integration with withNativewind above. Remove the v4 Nativewind Babel preset and JSX import source setting; keep the Expo preset. Use react-native-css adapters for third party components and validate prop mappings against the new mapping contract. The old react-native-css-interop engine is not the v5 engine.
+
+For default dark variants, use system appearance media queries. Read useColorScheme from react-native. Set Appearance.setColorScheme('dark') or 'light' for a native override and 'unspecified' to restore the system preference on this Expo target. Legacy @cssInterop and @react-native configuration directives report migration errors. Use compiler inlineVariables.exclude for variables that must remain available at runtime. Prefer VariableContextProvider over the deprecated vars helper. Express cross platform length variables with units, such as '80.5px'.
+
+Keep a copy of your previous package.json, lockfile, and configuration before migration. To revert, restore those files, reinstall the previous dependencies, and rebuild native apps if their native dependencies changed.
+
+## Changes and limitations
+
+The candidate contains Expo alignment, production prop mapping fixes, layout and style regression fixes, Node ESM tooling entries, TypeScript declaration membership fixes, and compiler cache invalidation. Detailed evidence distinguishes compiler, runtime, integration, and device verification.
+
+Android animation cancellation remains affected by [Reanimated issue 10507](https://github.com/software-mansion/react-native-reanimated/issues/10507). Changing a running rotation to animationName none or removing the animation styles can leave its final transform in place. Direct Reanimated controls reproduce the issue without either library. The behavior is intermittent: an isolated none check passed while the complete integrated audit reproduced the failure. The exact Android animate-none reset case is retained as an accepted upstream defect and is excluded from passing support claims. The iPhone case, browser cancellation checks and all other motion cases remain required. No experimental dependency patch is included. Physical Android testing is excluded; Android verification uses an emulator.
+
+The complete inventory review accounts for 6,129 entries with no unresolved dispositions. The final matrix requires 4,985 executions across compiler, runtime, tooling, rendering and interaction layers. All 4,985 required executions passed the final integrity checked release gate, with zero missing assertions. These counts describe the reviewed scope and do not claim that every CSS value works on every platform. The audit is complete. Public source review and a subsequent publication instruction remain necessary before npm release.
+
+The [compatibility guide](compatibility.md) records supported value domains, migrations, safe rejections and platform limits. Browser image fitting in the historical React Native Web and Expo Image adapters requires explicit resizeMode or contentFit/contentPosition props. The original WebKit backface scene and Firefox select-all interaction remain unverified. The generated select-none utility requires an
```

**File**: `skills/nativewind-v4-to-v5/references/target.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+# Target and verification contract
+
+Draft revision: Expo 57 RC0. The package pair is Nativewind 5.0.0-rc.0 and react-native-css 3.1.0-rc.0. Nativewind requires this exact engine RC. The tested Expo target is 57.0.22, React Native 0.86.3, React 19.2.3, Reanimated 4.5.1 and Worklets 0.10.1. Consumer CSS tooling is Tailwind and @tailwindcss/postcss 4.1.12 with lightningcss 1.30.1. These are pinned contract values, not a claim about today's latest releases.
+
+The [RC installation guide](installation.md) and [compatibility notes](compatibility.md) are public companion documents in the same repository. They contain the setup, accepted defects, input domains and recovery guidance. End users do not need access to the private audit repository.
+
+Before applying this skill, verify exact package availability and the project's environment. Native packages should be selected through Expo's installer. Preserve the project's package manager. Record the exact resolved versions in the migration report.
+
+The accepted Reanimated Android cancellation issue is [10507](https://github.com/software-mansion/react-native-reanimated/issues/10507). Direct animation style removal can retain the final rotation. No experimental dependency patch is part of this RC. Report application exposure explicitly.
+
+Before advertising this skill as verified, evaluate the complete downloadable folder in a fresh agent session against a minimal Expo v4 app, a Router app with custom theme and plugins, a workspace, and an app with mappings, variables, images, SVG, inputs and animations. Include a browser fixture for any claimed browser migration support. Record skill revision, model, input commit, output diff, exact registry package identities, native and browser assertions, preservation of unrelated edits, unsupported customization handling, interrupted migration handling, and a second invocation with no new edits. Structural skill validation is separate from those behavioral checks. Repeat the matrix before stable promotion with the stable package pair.
```

**File**: `skills/nativewind-v4-to-v5/references/utility-migrations.json` (added, +632/-0)
```diff
@@ -0,0 +1,632 @@
+{
+  "source": "https://tailwindcss.com/docs/upgrade-guide",
+  "sourceSection": "Changes from v3: removed deprecated utilities and renamed utilities",
+  "note": "Documentation provides migration intent. CSS was separately compiled with the pinned Nativewind and Tailwind stacks. Native presets can override upstream defaults.",
+  "rows": [
+    {
+      "v4Class": "shadow-sm",
+      "v5Replacement": "shadow-xs",
+      "upstreamClassification": "Documented Tailwind v3 to v4 migration",
+      "v4Css": [
+        {
+          "property": "--tw-shadow-color",
+          "value": "rgba(0, 0, 0, 0.35)"
+        },
+        {
+          "property": "-rn-shadow-color",
+          "value": "var(--tw-shadow-color)"
+        },
+        {
+          "property": "-rn-shadow-offset-width",
+          "value": "0px"
+        },
+        {
+          "property": "-rn-shadow-offset-height",
+          "value": "1px"
+        },
+        {
+          "property": "-rn-shadow-radius",
+          "value": "1px"
+        },
+        {
+          "property": "-rn-shadow-opacity",
+          "value": "1px"
+        }
+      ],
+      "v5SameNameCss": [
+        {
+          "property": "--tw-shadow",
+          "value": "0 1px 3px 0 var(--tw-shadow-color, rgb(0 0 0 / 0.1)), 0 1px 2px -1px var(--tw-shadow-color, rgb(0 0 0 / 0.1))"
+        },
+        {
+          "property": "box-shadow",
+          "value": "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"
+        }
+      ],
+      "v5ReplacementCss": [
+        {
+          "property": "--tw-shadow",
+          "value": "0 1px 2px 0 var(--tw-shadow-color, rgb(0 0 0 / 0.05))"
+        },
+        {
+          "property": "box-shadow",
+          "value": "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"
+        }
+      ],
+      "nativeClassification": "Requires renderer contract; upstream migration does not prove native equivalence"
+    },
+    {
+      "v4Class": "shadow",
+      "v5Replacement": "shadow-sm",
+      "upstreamClassification": "Documented Tailwind v3 to v4 migration",
+      "v4Css": [
+        {
+          "property": "--tw-shadow-color",
+          "value": "rgba(0, 0, 0, 0.35)"
+        },
+        {
+          "property": "-rn-shadow-color",
+          "value": "var(--tw-shadow-color)"
+        },
+        {
+          "property": "-rn-shadow-offset-width",
+          "value": "0px"
+        },
+        {
+          "property": "-rn-shadow-offset-height",
+          "value": "1px"
+        },
+        {
+          "property": "-rn-shadow-radius",
+          "value": "4px"
+        },
+        {
+          "property": "-rn-shadow-opacity",
+          "value": "1px"
+        }
+      ],
+      "v5SameNameCss": [
+        {
+          "property": "--tw-shadow",
+          "value": "0 1px 3px 0 var(--tw-shadow-color, rgb(0 0 0 / 0.1)), 0 1px 2px -1px var(--tw-shadow-color, rgb(0 0 0 / 0.1))"
+        },
+        {
+          "property": "box-shadow",
+          "value": "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"
+        }
+      ],
+      "v5ReplacementCss": [
+        {
+          "property": "--tw-shadow",
+          "value": "0 1px 3px 0 var(--tw-shadow-color, rgb(0 0 0 / 0.1)), 0 1px 2px -1px var(--tw-shadow-color, rgb(0 0 0 / 0.1))"
+        },
+        {
+          "property": "box-shadow",
+          "value": "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"
+        }
+      ],
+      "nativeClassification": "Requires renderer contract; upstream migration does not prove native equivalence"
+    },
+    {
+      "v4Class": "drop-shadow-sm",
+      "v5Replacement": "drop-shadow-xs",
+      "upstreamClassification": "Documented Tailwind v3 to v4 migration",
+      "v4Css": [
+        {
+          "property": "--tw-drop-shadow",
+          "value": "drop-shadow(0 1px 1px rgb(0 0 0 / 0.05))"
+        },
+        {
+          "property": "filter",
+          "value": "var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow)"
+        }
+      ],
+      "v5SameNameCss": [
+        {
+          "property": "--tw-drop-shadow-size",
+          "value": "drop-shadow(0 1px 2px var(--tw-drop-shadow-color, rgb(0 0 0 / 0.15)))"
+        },
+        {
+          "property": "--tw-drop-shadow",
+          "value": "drop-shadow(var(--drop-shadow-sm))"
+        },
+        {
+          "property": "filter",
+          "value": "var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) var(--tw-hue-rotate,) var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) var(--tw-drop-shadow,)"
+        }
+      ],
+      
```

---

### Incident Patch 5: `361e90b0` (2026-09-11)
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
+The theme now emits the correct foreground ripple property, preserves numeric ripple radii alongside ripple colors, and converts `corner-rounded` to the engine's circular corner value. Ripple properties apply to Android Pressable components; corner curves use the iOS host style.
+
+An animation name supplied through a CSS variable now resolves to keyframes before it reaches Reanimated. Missing or invalid names are omitted safely, and fallback, removal, restoration and `none` are covered by regression tests.
+
+Use React Native Appearance and `useColorScheme` for native dark mode. The deprecated Nativewind hook delegates to Appearance during migration. The v4 class dark mode configuration is rejected with migration guidance.
+
+## Verification boundaries
+
+Parameterized preview entries such as `w-[n]` describe a value category, not permission to use every CSS expression. The RC audit records the supported domain and representative rendering examples for each reviewed pattern.
+
+| Value category | Native qualification |
+| :--- | :--- |
+| Lay
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

**File**: `docs/v4-to-v5-migration.md` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+# Migrating an Expo application from Nativewind v4 to v5
+
+Draft for the Expo 57 release candidate. No RC has been published. The final installation command must use the exact verified Nativewind and react-native-css registry versions. Local development archive names are not public package versions.
+
+## Establish a baseline
+
+Create a branch and preserve the application lockfile. Record the Expo SDK, React Native, React, Reanimated, Worklets, Tailwind, and Nativewind versions. Capture the existing application on every supported platform, including theme changes, interactive components, animations, and third party components that receive mapped props.
+
+Upgrade the application to the selected Expo SDK using Expo's dependency alignment. For this candidate, the verification target is Expo 57.0.21, React 19.2.3, React Native 0.86.3, Reanimated 4.5.1, and Worklets 0.10.1. Do not independently advance Reanimated or Worklets beyond the verified Expo pair. Resolve duplicate runtime packages before judging styling failures.
+
+## Replace the configuration
+
+V5 uses Tailwind 4 and react-native-css. Remove the v4 Nativewind Babel preset and JSX import source setting where they were added for Nativewind. Preserve unrelated Babel plugins. The verified Expo consumer uses:
+
+```js
+module.exports = { presets: ['babel-preset-expo'] };
+```
+
+Use the v5 Metro wrapper spelling:
+
+```js
+const { getDefaultConfig } = require('expo/metro-config');
+const { withNativewind } = require('nativewind/metro');
+module.exports = withNativewind(getDefaultConfig(__dirname));
+```
+
+Configure PostCSS with `@tailwindcss/postcss` and import the stylesheet once from the application entry or Router root layout:
+
+```css
+@import "tailwindcss";
+@import "nativewind/theme";
+```
+
+Migrate project theme extensions and plugins deliberately to Tailwind 4 configuration. Do not delete custom v4 configuration until each custom token, variant, plugin, and source location has a replacement. Register shared workspace sources with `@source` relative to the stylesheet when automatic discovery does not include them. Keep complete utility strings in source.
+
+## Review application contracts
+
+For Expo, set `expo.userInterfaceStyle` to `automatic` and install the Expo aligned `expo-system-ui` package for Android. Rebuild the native app after changing native configuration. An absent appearance setting defaults to Light, which prevents restoring an app override from following a dark system preference. See [Expo color theme configuration](https://docs.expo.dev/develop/user-interface/color-themes/).
+
+Use `dark:` with the default media query contract. On native, import `Appearance` and `useColorScheme` from React Native. Call `Appearance.setColorScheme('light')` or `'dark'` for a manual preference and `'unspecified'` to restore system preference on this target. Verify restoration on a device. Browser media query behavior needs a separate browser check. Do not add an ancestor dark class merely to implement the native default.
+
+Review custom styled component and prop mapping wrappers against the v5 API. The engine supports `nativeStyleMapping`; its deprecated `nativeStyleToProp` alias remains accepted, with the current option taking precedence. `target: false` discards unmapped compiled styles while preserving original inline styles. Do not mechanically rename v4 wrapper APIs without checking their prop destinations and update behavior.
+
+For mapping paths containing `&`, use bracketed utility syntax such as `@map-[&.test]:color-black`. Test discovery from actual application source. Forcing a utility through an inline declaration does not prove automatic source scanning.
+
+Legacy `@cssInterop` configuration, `@react-native config` directives, and class qualified root selectors now produce explicit migration errors. Use the contracts documented in `v5-engine-contracts.md` instead of suppressing those errors.
+
+## Give transitions numeric endpoints
+
+An unspecified width is `auto`, not numeric zero. When a width should interpolate, use explicit numeric classes in both states, for example `w-0` and `w-[100px]`, together with the same transition duration and timing classes. To animate a collapse, switch back to `w-0` rather than removing the width class. Avoid an inline width that overrides the class you intend to animate.
+
+The physical iPhone verification measures zero to 100, 100 to 200, and 100 to zero alongside a direct Reanimated reference. These explicit numeric transitions pass; the historical tests assuming automatic zero endpoints fail and remain retained. This is a clarified contract, not evidence that the old automatic behavior was restored.
+
+## Verify the migrated application
+
+1. Install from the final exact registry pair into a clean checkout and retain the lockfile. Confirm one React, React Native, react-native-css, Reanimated, and Worklets installation per application runtime.
+2. Run application type checks 
```

**File**: `docs/v5-engine-contracts.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+# V5 engine contract migration notes
+
+Nativewind v5 dark mode follows the [documented Appearance API](https://www.nativewind.dev/v5/core-concepts/dark-mode). The default `dark:` variant compiles to `prefers-color-scheme: dark`. On native, use React Native `Appearance.setColorScheme("light")` or `Appearance.setColorScheme("dark")` for manual selection, and `useColorScheme` from `react-native` to read it. On this Expo target, `Appearance.setColorScheme("unspecified")` restores the system preference. Web uses its CSS media query; native override verification does not establish a browser override mechanism.
+
+Legacy `@cssInterop set darkMode ...` configuration and class-qualified `:root` selectors have no native document root contract. The compiler now reports an explicit error before variable optimization can accidentally apply conditional values unconditionally. Migrate theme behavior to media queries and Appearance. Ordinary ancestor class selectors remain supported as selectors; adding a `dark` ancestor is not required by the documented default v5 theme API.
+
+For preserved CSS variables, use the compiler option `inlineVariables: { exclude: ["--variable-name"] }`. The old `@react-native config { preserve-variables: ... }` directive reports a migration error rather than silently ignoring the option.
+
+The declared deprecated `nativeStyleToProp` option remains supported as an alias for `nativeStyleMapping`. The current option takes precedence when both are provided, including an empty mapping. `target: false` discards unmapped compiled styles while retaining original inline styles.
+
+Unit verification covers compiler semantics, Appearance event subscription, mapping destinations and restoration, and animation metadata delivered to Reanimated. It does not prove native frame interpolation or OS event delivery. The new engine package still requires renderer verification before RC approval.
```

**File**: `example/package.json` (modified, +16/-12)
```diff
@@ -11,26 +11,30 @@
     "web": "expo start --web"
   },
   "dependencies": {
-    "@expo/metro-runtime": "~6.1.2",
+    "@babel/core": "^7.29.0",
+    "@expo/metro-config": "57.0.12",
+    "@expo/metro-runtime": "~57.0.15",
+    "@react-native/metro-config": "0.86.3",
     "@tailwindcss/postcss": "^4.1.11",
     "eas-build-cache-provider": "^16.4.2",
-    "expo": "~54.0.10",
-    "expo-status-bar": "~3.0.8",
-    "expo-system-ui": "~6.0.7",
+    "expo": "57.0.22",
+    "expo-status-bar": "~57.0.1",
+    "expo-system-ui": "~57.0.4",
+    "lightningcss": "^1.30.1",
     "metro-runtime": "^0.83.0",
     "nativewind": "link:../",
-    "react": "19.1.0",
-    "react-dom": "19.1.0",
-    "react-native": "0.81.4",
+    "react": "19.2.3",
+    "react-dom": "19.2.3",
+    "react-native": "0.86.3",
     "react-native-css": "^3.0.6",
-    "react-native-reanimated": "~4.1.0",
-    "react-native-web": "^0.21.0",
-    "react-native-worklets": "~0.5.0",
+    "react-native-reanimated": "4.5.1",
+    "react-native-web": "~0.21.0",
+    "react-native-worklets": "0.10.1",
     "react-refresh": "^0.17.0"
   },
   "devDependencies": {
-    "@babel/core": "^7.20.0",
-    "@types/react": "^19.1.9",
+    "@babel/core": "^7.29.0",
+    "@types/react": "~19.2.0",
     "react-native-builder-bob": "^0.40.13",
     "react-native-monorepo-config": "^0.1.9"
   },
```

---

### Incident Patch 6: `82a78534` (2026-05-15)
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

### Incident Patch 7: `1cfb9956` (2026-05-15)
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

### Incident Patch 8: `30e83f0d` (2026-03-13)
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

### Incident Patch 9: `b071b94a` (2026-03-08)
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

### Incident Patch 10: `c51a7869` (2026-03-08)
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

### Incident Patch 11: `a4090140` (2026-03-08)
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

### Incident Patch 12: `dacc1d6a` (2026-03-03)
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

---

### Incident Patch 13: `e3d05ba1` (2025-10-22)
**Commit Message**: update contirbuting guide to reflect use of release-it and publishing instructions, update github urls from marklawlor/nativewind to nativewind/nativewind

**File**: `README.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 
 [![npm version](https://img.shields.io/npm/v/nativewind)](https://www.npmjs.com/package/nativewind)
 [![npm downloads](https://img.shields.io/npm/dw/nativewind)](https://www.npmjs.com/package/nativewind)
-[![Github](https://img.shields.io/github/license/marklawlor/nativewind)](https://github.com/nativewind/nativewind)
+[![Github](https://img.shields.io/github/license/nativewind/nativewind)](https://github.com/nativewind/nativewind)
 [![Discord](https://img.shields.io/discord/968718419904057416?logo=discord&logoColor=ffffff&label=Discord&color=%235865F2)](https://discord.gg/ypNakAFQ65)
 [![Twitter](https://img.shields.io/twitter/follow/nativewindcss?link=https%3A%2F%2Fx.com%2Ftailwindcss)](https://x.com/nativewindcss)
 
```

**File**: `contributing.md` (modified, +17/-6)
```diff
@@ -112,19 +112,30 @@ More information on how `react-native-css-interop` works is coming soon.
 
 Once you've made your changes and tested that it works locally, run the tests using `npm run test` in the root directory. You should also add a test to cover your own contribution, if relevant.
 
-If your changes alter and/or add to the behavior of the Nativewind, or fix a bug in it, then we encourage you to also create a **changeset**. A changeset is a quick summary that expresses the intention to bump the version of the package. This is used by our CI in order to automatically manage releases to NPM.
+### Publishing a Release (Maintainers Only)
 
-To introduce a new changeset, run:
+If you're a maintainer and need to publish a new version to npm, the project uses **release-it** for automated releases.
+
+To publish a new version:
 
 ```shell
-npx changeset
+npm run release
 ```
 
-This will prompt you for the kind of version bump your changes introduce (`patch`, `minor`, `major`), and for a quick summary of your changes. If the change is small enough, it is valid to just replicate the contents of your commit message. If it's more complex, the changeset summary (generated in the root `.changeset` directory) can be edited to include more information.
+This will:
+1. Run the build and test suite (via the `prepublishOnly` hook)
+2. Prompt you for the version bump type (`patch`, `minor`, `major`)
+3. Update the version in `package.json`
+4. Create a git commit and tag
+5. Push changes and tags to GitHub
+6. Publish the package to npm
 
-The generated changeset file should be included in your commit. That way, when the new version releases, you will be properly credited on GitHub's release page and in the project's changelog.
+Make sure you have:
+- Proper npm authentication (`npm login`)
+- Write access to the GitHub repository
+- Publish permissions for the npm package
 
 > [!NOTE]
-> If you're not sure what kind of version bump your changes introduce, you can reach out to one of the maintainers in the PR comments and we'll try to help you out!
+> Contributors do not need to worry about releases - maintainers will handle version bumps and publishing to npm. Just focus on making your changes and opening a great pull request!
 
 > **_TODO:_** Add template for pull requests and issues
\ No newline at end of file
```

---

### Incident Patch 14: `3e3ef272` (2025-10-11)
**Commit Message**: chore: bump min version of react-native-css

**File**: `package.json` (modified, +2/-2)
```diff
@@ -122,7 +122,7 @@
     "react": "19.1.0",
     "react-native": "0.81.4",
     "react-native-builder-bob": "^0.40.13",
-    "react-native-css": "3.0.0-preview.5",
+    "react-native-css": "^3.0.0",
     "react-native-reanimated": "~4.1.0",
     "react-native-safe-area-context": "5.6.1",
     "react-native-worklets": "~0.5.0",
@@ -135,7 +135,7 @@
     "typescript-eslint": "^8.40.0"
   },
   "peerDependencies": {
-    "react-native-css": "^3.0.0",
+    "react-native-css": "^3.0.1",
     "tailwindcss": ">4.1.11"
   },
   "react-native-builder-bob": {
```

**File**: `yarn.lock` (modified, +19/-2)
```diff
@@ -9718,7 +9718,7 @@ __metadata:
     react: "npm:19.1.0"
     react-native: "npm:0.81.4"
     react-native-builder-bob: "npm:^0.40.13"
-    react-native-css: "npm:3.0.0-preview.5"
+    react-native-css: "npm:^3.0.0"
     react-native-reanimated: "npm:~4.1.0"
     react-native-safe-area-context: "npm:5.6.1"
     react-native-worklets: "npm:~0.5.0"
@@ -9730,7 +9730,7 @@ __metadata:
     typescript: "npm:^5.9.2"
     typescript-eslint: "npm:^8.40.0"
   peerDependencies:
-    react-native-css: ^3.0.0
+    react-native-css: ^3.0.1
     tailwindcss: ">4.1.11"
   languageName: unknown
   linkType: soft
@@ -10822,6 +10822,23 @@ __metadata:
   languageName: node
   linkType: hard
 
+"react-native-css@npm:^3.0.0":
+  version: 3.0.1
+  resolution: "react-native-css@npm:3.0.1"
+  dependencies:
+    babel-plugin-react-compiler: "npm:^19.1.0-rc.2"
+    colorjs.io: "npm:0.6.0-alpha.1"
+    comment-json: "npm:^4.2.5"
+    debug: "npm:^4.4.1"
+  peerDependencies:
+    "@expo/metro-config": ">=54"
+    lightningcss: ">=1.27.0"
+    react: ">=19"
+    react-native: ">=0.81"
+  checksum: 10c0/61fd8bb657d68d1a901852b46d0e3b8778a634ea9451ff03eb0575d47a8f733be954f83c77cae3ef97bee89e423c2db8d85e493f203e6527cd1ca8e1775e2453
+  languageName: node
+  linkType: hard
+
 "react-native-is-edge-to-edge@npm:^1.2.1":
   version: 1.2.1
   resolution: "react-native-is-edge-to-edge@npm:1.2.1"
```

---

### Incident Patch 15: `be351996` (2025-10-11)
**Commit Message**: fix: broken types exports (#1638)

**File**: `package.json` (modified, +2/-2)
```diff
@@ -9,12 +9,12 @@
     ".": {
       "import": "./dist/module/index.js",
       "require": "./dist/commonjs/index.js",
-      "typescript": "./dist/typescript/commonjs/src/index.d.ts"
+      "types": "./dist/typescript/commonjs/src/index.d.ts"
     },
     "./babel": {
       "import": "./dist/module/babel.js",
       "require": "./dist/commonjs/babel.js",
-      "typescript": "./dist/typescript/commonjs/src/babel.d.ts"
+      "types": "./dist/typescript/commonjs/src/babel.d.ts"
     },
     "./metro": {
       "source": "./src/metro.ts",
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
