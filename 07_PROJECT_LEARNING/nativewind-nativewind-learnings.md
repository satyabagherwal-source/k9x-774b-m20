> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nativewind-nativewind-learnings.md`  
> **Source**: github ([https://github.com/nativewind/nativewind](https://github.com/nativewind/nativewind))  
> **Source Version**: `7dbaf182`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T02:37:09.361Z  
> **Learning ID**: `learn-github-nativewind-nativewind`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): nativewind/nativewind

> **Canonical Artifact**: `07_PROJECT_LEARNING/nativewind-nativewind-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nativewind/nativewind](https://github.com/nativewind/nativewind))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T02:37:09.355Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nativewind/nativewind`
- **Description**: The utility-first workflow you love from Tailwind CSS in your React Native applications.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8114 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1054** (2024-10-25): **V4.1: ScrollView indicatorStyle prop causing "TypeError: right operand of 'in' is not an object"**
  *Symptoms*: **Describe the bug** ScrollView indicatorStyle prop throwing an error. Same error as #1012    **Reproduction** - nativewind@4.1.7 (nativewind@next)  Create ScrollView with indicatorStyle prop ```tsx <ScrollView indicatorStyle={'white'}></ScrollView> ``` https://stackblitz.com/edit/nativewind-test-vfyfwd?file=nativewind.test.tsx  **Additional context** ![image](https://github.com/user-attachments/assets/43ddd323-9cb6-438c-8cb9-50c876b43bf2) 
  **Post-Mortem & Fix Analysis**:
  > This is still an issue in 4.1.10
  > Oh, just ran into this. 

- **Issue #1038** (2024-09-11): **docs: add `mdx` ending to `tailwind.config.js`'s `content` array file paths to watch**
  *Symptoms*: **Describe the bug**  I'm not sure if this is really is necessary, but I ran into an issue today which nearly drove me crazy because of the `mdx` files not being processed by tailwind. I'm not sure why this is even necessary, because my project doesn't contain any `.mdx` files. But when running on node-js 22.5.1 with this dependencies:  ``` ├── expo-router@3.5.23 ├── expo@51.0.32 ├── nativewind@4.1.6 ├── tailwindcss@3.4.10 ```  I'm getting the following errors on some reloads:  ``` (node:73054) Warning: To load an ES module, set "type": "module" in the package.json or use the .mjs extension. ```  And this in combination with a further bug lead into some hours of bug-hunting...  Just reporting this, so that some other people running into this thing. Decide yourself, if this is something to adjust, or if its some weird stuff only happening on my machine...

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

### Incident Patch 1: `82a78534` (2026-05-15)
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

### Incident Patch 2: `1cfb9956` (2026-05-15)
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

### Incident Patch 3: `f9cfae6c` (2026-09-15)
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

#### Recent Merged Pull Requests:
- **PR #1873** (2026-10-16): ci(issue-repro): scope issues:write to jobs that need it (@sammoore)
- **PR #1868** (2026-09-15): docs: sync skills and contributor guidance with the v5 RC (@danstepanov)
- **PR #1867** (2026-09-14): Update published RC release documentation (@danstepanov)
- **PR #1866** (2026-09-14): Update migration skills for Nativewind v5 RC (@danstepanov)
- **PR #1865** (2026-09-14): Version Packages (@github-actions[bot])
- **PR #1864** (2026-09-14): Update Nativewind v4 for Expo SDK 57 (@danstepanov)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. release): use whatBump:false to bypass broken preset loader (#1791)

**RULE**:
When implementing operations in `.config/release-it.config.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nativewind/nativewind. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `82a78534`: release): use whatBump:false to bypass broken preset loader (#1791). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.config/release-it.config.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
      whatBump: false,
```

**NEGATIVE CONSTRAINT**:
```javascript
// Anti-pattern to NEVER write (induced failure mode):
      ignoreRecommendedBump: true,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `82a78534` are properly handled with clean fallback behavior.
