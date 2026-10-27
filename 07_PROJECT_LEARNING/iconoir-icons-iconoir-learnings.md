> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/iconoir-icons-iconoir-learnings.md`  
> **Source**: github ([https://github.com/iconoir-icons/iconoir](https://github.com/iconoir-icons/iconoir))  
> **Source Version**: `285be69c`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T23:44:03.461Z  
> **Learning ID**: `learn-github-iconoir-icons-iconoir`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): iconoir-icons/iconoir

> **Canonical Artifact**: `07_PROJECT_LEARNING/iconoir-icons-iconoir-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/iconoir-icons/iconoir](https://github.com/iconoir-icons/iconoir))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T23:44:03.049Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `iconoir-icons/iconoir`
- **Description**: Free, open source (MIT) SVG icon library: 1,383 icons (1,671 SVGs with solid variants) for React, React Native, Vue, Solid, Flutter, CSS, Figma and Framer.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4608 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/iconoir-flutter/example/windows/runner/utils.cpp`
```
#include "utils.h"

#include <flutter_windows.h>
#include <io.h>
#include <stdio.h>
#include <windows.h>

#include <iostream>

void CreateAndAttachConsole() {
  if (::AllocConsole()) {
    FILE *unused;
    if (freopen_s(&unused, "CONOUT$", "w", stdout)) {
      _dup2(_fileno(stdout), 1);
    }
    if (freopen_s(&unused, "CONOUT$", "w", stderr)) {
      _dup2(_fileno(stdout), 2);
    }
    std::ios::sync_with_stdio();
    FlutterDesktopResyncOutputStreams();
  }
}

std::vector<std::string> GetCommandLineArguments() {
  // Convert the UTF-16 command line arguments to UTF-8 for the Engine to use.
  int argc;
  wchar_t** argv = ::CommandLineToArgvW(::GetCommandLineW(), &argc);
  if (argv == nullptr) {
    return std::vector<std::string>();
  }

  std::vector<std::string> command_line_arguments;

  // Skip the first argument as it's the binary name.
  for (int i = 1; i < argc; i++) {
    command_line_arguments.push_back(Utf8FromUtf16(argv[i]));
  }

  ::LocalFree(argv);

  return command_line_arguments;
}

std::string Utf8FromUtf16(const wchar_t* utf16_string) {
  if (utf16_string == nullptr) {
    return std::string();
  }
  int target_length = ::WideCharToMultiByte(
      CP_UTF8, WC_ERR_INVALID_CHARS, utf16_string,
      -1, nullptr, 0, nullptr, nullptr);
  std::string utf8_string;
  if (target_length == 0 || target_length > utf8_string.max_size()) {
    return utf8_string;
  }
  utf8_string.resize(target_length);
  int converted_length = ::WideCharToMultiByte(
      CP_UTF8, WC_ERR_INVALID_CHARS, utf16_string,
      -1, utf8_string.data(),
      target_length, nullptr, nullptr);
  if (converted_length == 0) {
    return std::string();
  }
  return utf8_string;
}

```

### Core Architecture Module: `packages/iconoir-flutter/example/windows/runner/utils.h`
```
#ifndef RUNNER_UTILS_H_
#define RUNNER_UTILS_H_

#include <string>
#include <vector>

// Creates a console for the process, and redirects stdout and stderr to
// it for both the runner and the Flutter library.
void CreateAndAttachConsole();

// Takes a null-terminated wchar_t* encoded in UTF-16 and returns a std::string
// encoded in UTF-8. Returns an empty std::string on failure.
std::string Utf8FromUtf16(const wchar_t* utf16_string);

// Gets the command line arguments passed in as a std::vector<std::string>,
// encoded in UTF-8. Returns an empty std::vector<std::string> on failure.
std::vector<std::string> GetCommandLineArguments();

#endif  // RUNNER_UTILS_H_

```

### Core Architecture Module: `bin/prepublish.js`
```
/* eslint-disable no-console */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { updateYamlKey } from '@atomist/yaml-updater';
import semver from 'semver';

const newVersion = semver.valid(semver.coerce(process.env.TAG_NAME));
console.info('New version is %s', newVersion);

if (!newVersion) {
  throw new Error(`Tag name ${process.env.TAG_NAME} is not valid.`);
}

publishNpmPackage('iconoir');
publishNpmPackage('iconoir-react');
publishNpmPackage('iconoir-react-native');
publishNpmPackage('iconoir-solid-js');
publishNpmPackage('iconoir-vue');
publishPubPackage('iconoir-flutter');

function publishNpmPackage(name) {
  console.info('Publishing %s', name);

  const packageJsonPath = name === 'iconoir'
    ? 'package.json'
    : path.join('packages', name, 'package.json');

  const contents = JSON.parse(fs.readFileSync(packageJsonPath).toString());
  contents.version = newVersion;

  fs.writeFileSync(packageJsonPath, JSON.stringify(contents, undefined, 2));
  console.info('package.json updated');
}

function publishPubPackage(name) {
  const pubspecFilepath = path.join('packages', name, 'pubspec.yaml');
  const pubspecContents = fs.readFileSync(pubspecFilepath).toString();

  fs.writeFileSync(
    pubspecFilepath,
    updateYamlKey('version', newVersion, pubspecContents),
  );

  console.info('pubspec.yaml updated');
}

```

### Core Architecture Module: `eslint.config.js`
```
// @ts-check
import antfu from '@antfu/eslint-config';
import nextPlugin from '@next/eslint-plugin-next';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import hooksPlugin from 'eslint-plugin-react-hooks';

export default antfu({
  typescript: true,
  formatters: true,
  stylistic: {
    semi: true,
    overrides: {
      'style/arrow-parens': 'error',
      'style/brace-style': ['error', '1tbs', { allowSingleLine: true }],
    },
  },
  javascript: {
    overrides: {
      'antfu/no-top-level-await': 'off',
    },
  },
  ignores: [
    'css/*.css',
    'iconoir.com/out/',
    '**/.expo/',
    'packages/iconoir-flutter/.dart_tool/',
    'packages/iconoir-flutter/build/',
    'packages/iconoir-flutter/example/',

  ],
  rules: {
    'style/padding-line-between-statements': [
      'error',
      {
        blankLine: 'always',
        prev: [
          'block',
          'block-like',
          'cjs-export',
          'class',
          'multiline-block-like',
          'multiline-const',
          'multiline-expression',
          'multiline-let',
          'multiline-var',
        ],
        next: '*',
      },
      {
        blankLine: 'always',
        prev: ['const', 'let'],
        next: [
          'block',
          'block-like',
          'cjs-export',
          'class',
        ],
      },
      {
        blankLine: 'always',
        prev: '*',
        next: [
          'multiline-block-like',
          'multiline-const',
          'multiline-expression',
          'multiline-let',
          'multiline-var',
        ],
      },
    ],
  },
}, {
  files: ['iconoir.com/**'],
  plugins: {
    '@next/next': nextPlugin,
    'react': reactPlugin,
    'react-hooks': hooksPlugin,
    'jsx-a11y': jsxA11yPlugin,
  },
  settings: {
    next: {
      rootDir: 'iconoir.com/',
    },
    react: {
      version: 'detect',
    },

  },
  // @ts-ignore
  rules: {
    ...nextPlugin.configs.recommended.rules,
    ...nextPlugin.configs['core-web-vitals'].rules,
    ...reactPlugin.configs.recommended.rules,
    ...hooksPlugin.configs.recommended.rules,

    // rules from "eslint-config-next"
    'react/no-unknown-property': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'jsx-a11y/alt-text': [
      'warn',
      {
        elements: ['img'],
        img: ['Image'],
      },
    ],
    'jsx-a11y/aria-props': 'warn',
    'jsx-a11y/aria-proptypes': 'warn',
    'jsx-a11y/aria-unsupported-elements': 'warn',
    'jsx-a11y/role-has-required-aria-props': 'warn',
    'jsx-a11y/role-supports-aria-props': 'warn',
    'react/jsx-no-target-blank': 'off',
  },
});

```

### Core Architecture Module: `examples/next/app/layout.tsx`
```
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Iconoir',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

```

### Core Architecture Module: `examples/next/app/page.tsx`
```
import {
  Check,
  Iconoir,
  IconoirProvider,
  Medal1st,
  Medal1stSolid,
} from 'iconoir-react';
import { AdobeAfterEffects as AdobeAfterEffectsRegular } from 'iconoir-react/regular';
import { AdobeAfterEffects as AdobeAfterEffectsSolid } from 'iconoir-react/solid';

export default function Home() {
  return (
    <>
      <Iconoir />
      <Medal1st color="red" height={36} width={36} />
      <Medal1stSolid />
      <AdobeAfterEffectsRegular color="red" />
      <AdobeAfterEffectsSolid color="green" />

      <IconoirProvider
        iconProps={{
          color: '#1E441E',
          strokeWidth: 1,
          width: '2em',
          height: '2em',
        }}
      >
        <Check />
      </IconoirProvider>
    </>
  );
}

```

### Core Architecture Module: `examples/next/next.config.ts`
```
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['iconoir-react'],
  },
};

export default nextConfig;

```

### Core Architecture Module: `examples/react-native/App.tsx`
```
import { Check, Iconoir, IconoirProvider } from 'iconoir-react-native';
import { View } from 'react-native';

export default function App() {
  return (
    <View>
      <Iconoir />

      <IconoirProvider
        iconProps={{
          color: '#1E441E',
          strokeWidth: 1,
          width: '2em',
          height: '2em',
        }}
      >
        <Check />
      </IconoirProvider>
    </View>
  );
}

```

### Core Architecture Module: `examples/react-native/index.ts`
```
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

```

### Core Architecture Module: `examples/react-native/metro.config.js`
```
/*
 * Workaround to be able to import iconoir lib from workspace.
 * See also: https://github.com/pnpm/pnpm/issues/4286
 */

const { makeMetroConfig } = require('@rnx-kit/metro-config');
const MetroSymlinksResolver = require('@rnx-kit/metro-resolver-symlinks');
const { getDefaultConfig } = require('expo/metro-config');

const symlinksResolver = MetroSymlinksResolver({
  remapModule: (_context, moduleName) => {
    if (moduleName === 'iconoir-react-native') {
      return require.resolve(moduleName);
    }

    return moduleName;
  },
},
);

/** @type {import('expo/metro-config').MetroConfig} */
const expoConfig = getDefaultConfig(__dirname);

/** @type {import('expo/metro-config').MetroConfig} */
module.exports = makeMetroConfig({
  ...expoConfig,
  resolver: {
    ...expoConfig.resolver,
    resolveRequest: symlinksResolver,
  },
});

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #641** (2026-10-25): **email[ICON]**
  *Symptoms*: <!-- Before creating an icon request, please search to see if someone has requested the icon already. If there is an open request, please upvote it or add a comment. -->  ## Icon Request  - Icon name: - Use case: - Screenshots of similar icons: 

- **Issue #640** (2026-10-18): **feat(site): link the icon sheet to the icon's own page**
  *Symptoms*: Adds a small info icon in the bottom-right corner of the icon sheet's code snippet. It links to the icon's own page at `iconoir.com/icons/<name>` (SVG download, regular and solid previews, snippets for every package, related icons).  - Muted 18px `InfoCircle`, black on hover, with a tooltip and an accessible label ("Open the heart icon page"). - Icons now carry their `icons.csv` name (`icon.name`), shared by regular and solid variants. `filename` is rebuilt from the component name and doesn't always match: 49 icons with digits come out wrong (`arc-3d` → `arc3d`, `battery-25` → `battery25`), and the icon pages use the real name. Solid variants link to their regular icon's page, which shows both.  ## Checked - Dev server: the arc-3d-center-point sheet links to `/icons/arc-3d-center-point` (live: 200; `arc3d-center-point` would be 404). heart-solid links to `/icons/heart`. The icon sits 10px from the corner and turns black on hover. - `eslint` and `tsc --noEmit` pass on the changed files.  ## Notes - The sheet only renders after a click, so search engines won't follow this link. Making the explorer's tiles real links would, and could come in a follow-up. - Unrelated, not fixed here: the same `filename` mismatch gives those 49 icons wrong SVG/PNG download names and a wrong CSS class in the CSS snippet (`iconoir-arc3d`).

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

### Incident Patch 1: `0c903c4c` (2026-10-25)
**Commit Message**: fix(site): drop tabindex=1 from the icon search field

A positive tabindex breaks the natural tab order (Lighthouse a11y audit).

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `iconoir.com/components/FiltersEditor.tsx` (modified, +0/-1)
```diff
@@ -122,7 +122,6 @@ export function FiltersEditor({ filters, categories, onChange }: FiltersEditorPr
           value={search}
           type="search"
           autoCapitalize="none"
-          tabIndex={1}
           onFocus={(e) => {
             if (!didScrollRef.current) {
               e.target.scrollIntoView({
```

---

### Incident Patch 2: `4da87361` (2026-10-25)
**Commit Message**: fix(deps): patch high-severity Dependabot alerts

Bump vite and Vue; add pnpm overrides for transitive dependency fixes.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `examples/vue/package.json` (modified, +2/-2)
```diff
@@ -10,7 +10,7 @@
     "type-check": "vue-tsc --build"
   },
   "dependencies": {
-    "vue": "^3.5.40"
+    "vue": "^3.5.42"
   },
   "devDependencies": {
     "@iconoir/vue": "workspace:*",
@@ -20,7 +20,7 @@
     "@vue/tsconfig": "^0.7.0",
     "npm-run-all2": "^8.0.4",
     "typescript": "~5.8.3",
-    "vite": "^7.3.6",
+    "vite": "^7.3.7",
     "vite-plugin-vue-devtools": "^7.7.10",
     "vue-tsc": "^3.3.8"
   }
```

**File**: `package.json` (modified, +13/-3)
```diff
@@ -56,18 +56,28 @@
     "semver": "^7.8.5",
     "tinypool": "^2.1.2",
     "typescript": "~5.8.3",
-    "vite": "^7.3.6",
+    "vite": "^7.3.7",
     "vite-plugin-dts": "^4.5.4",
     "vite-plugin-solid": "2.11.7"
   },
   "pnpm": {
     "overrides": {
       "@tootallnate/once@<2.0.1": "^2.0.1",
+      "@xmldom/xmldom@<=0.8.14": "^0.8.15",
+      "@xmldom/xmldom@<=0.9.10": "^0.9.12",
+      "compression@<1.8.2": "^1.8.2",
+      "fast-uri@<3.1.7": "^3.1.7",
+      "image-size@<=2.0.2": "^2.0.3",
+      "js-yaml@>=4.0.0 <4.3.2": "^4.3.2",
+      "js-yaml@>=3.0.0 <3.15.1": "^3.15.1",
       "postcss@<8.5.18": "^8.5.23",
       "seroval@<=1.6.0": "^1.6.2",
       "shell-quote@<1.11.0": "^1.11.0",
-      "sharp@<0.35.0": "^0.35.3",
-      "tinypool@<=2.1.1": "^2.1.2"
+      "sharp@<0.35.5": "^0.35.5",
+      "source-map-js@<1.2.2": "^1.2.2",
+      "tinypool@<=2.1.1": "^2.1.2",
+      "undici@>=6.23.0 <6.29.1": "^6.29.1",
+      "vue@<3.5.42": "^3.5.42"
     }
   }
 }
\ No newline at end of file
```

**File**: `pnpm-lock.yaml` (modified, +360/-276)
```diff
@@ -6,11 +6,21 @@ settings:
 
 overrides:
   '@tootallnate/once@<2.0.1': ^2.0.1
+  '@xmldom/xmldom@<=0.8.14': ^0.8.15
+  '@xmldom/xmldom@<=0.9.10': ^0.9.12
+  compression@<1.8.2: ^1.8.2
+  fast-uri@<3.1.7: ^3.1.7
+  image-size@<=2.0.2: ^2.0.3
+  js-yaml@>=4.0.0 <4.3.2: ^4.3.2
+  js-yaml@>=3.0.0 <3.15.1: ^3.15.1
   postcss@<8.5.18: ^8.5.23
   seroval@<=1.6.0: ^1.6.2
   shell-quote@<1.11.0: ^1.11.0
-  sharp@<0.35.0: ^0.35.3
+  sharp@<0.35.5: ^0.35.5
+  source-map-js@<1.2.2: ^1.2.2
   tinypool@<=2.1.1: ^2.1.2
+  undici@>=6.23.0 <6.29.1: ^6.29.1
+  vue@<3.5.42: ^3.5.42
 
 packageExtensionsChecksum: sha256-cBTyUPq+IGZAZgWgvReLGDDDIq+QC1sEPJbt4H4UmnQ=
 
@@ -20,7 +30,7 @@ importers:
     devDependencies:
       '@antfu/eslint-config':
         specifier: ^5.4.1
-        version: 5.4.1(@next/eslint-plugin-next@15.5.28)(@typescript-eslint/typescript-estree@8.65.0(typescript@5.8.3))(@typescript-eslint/utils@8.65.0(eslint@9.39.5)(typescript@5.8.3))(@vue/compiler-sfc@3.5.40)(eslint-plugin-format@1.5.0(eslint@9.39.5))(eslint-plugin-jsx-a11y@6.10.2(eslint@9.39.5))(eslint-plugin-react-hooks@5.2.0(eslint@9.39.5))(eslint@9.39.5)(typescript@5.8.3)
+        version: 5.4.1(@next/eslint-plugin-next@15.5.28)(@typescript-eslint/typescript-estree@8.65.0(typescript@5.8.3))(@typescript-eslint/utils@8.65.0(eslint@9.39.5)(typescript@5.8.3))(@vue/compiler-sfc@3.5.44)(eslint-plugin-format@1.5.0(eslint@9.39.5))(eslint-plugin-jsx-a11y@6.10.2(eslint@9.39.5))(eslint-plugin-react-hooks@5.2.0(eslint@9.39.5))(eslint@9.39.5)(typescript@5.8.3)
       '@atomist/yaml-updater':
         specifier: ^1.0.2
         version: 1.0.2
@@ -35,7 +45,7 @@ importers:
         version: 8.1.0(@svgr/core@8.1.0(typescript@5.8.3))
       '@vitejs/plugin-vue':
         specifier: ^6.0.8
-        version: 6.0.8(vite@7.3.6(@types/node@26.1.1)(lightningcss@1.27.0)(terser@5.49.0)(yaml@2.9.0))(vue@3.5.40(typescript@5.8.3))
+        version: 6.0.8(vite@7.3.7(@types/node@26.1.1)(lightningcss@1.27.0)(terser@5.49.0)(yaml@2.9.0))(vue@3.5.44(typescript@5.8.3))
       esbuild:
         specifier: ^0.25.12
         version: 0.25.12
@@ -70,14 +80,14 @@ importers:
         specifier: ~5.8.3
         version: 5.8.3
       vite:
-        specifier: ^7.3.6
-        version: 7.3.6(@types/node@26.1.1)(lightningcss@1.27.0)(terser@5.49.0)(yaml@2.9.0)
+        specifier: ^7.3.7
+        version: 7.3.7(@types/node@26.1.1)(lightningcss@1.27.0)(terser@5.49.0)(yaml@2.9.0)
       vite-plugin-dts:
         specifier: ^4.5.4
-        version: 4.5.4(@types/node@26.1.1)(rollup@4.62.2)(typescript@5.8.3)(vite@7.3.6(@types/node@26.1.1)(lightningcss@1.27.0)(terser@5.49.0)(yaml@2.9.0))
+        version: 4.5.4(@types/node@26.1.1)(rollup@4.62.2)(typescript@5.8.3)(vite@7.3.7(@types/node@26.1.1)(lightningcss@1.27.0)(terser@5.49.0)(yaml@2.9.0))
       vite-plugin-solid:
         specifier: 2.11.7
-        version: 2.11.7(solid-js@1.9.14)(vite@7.3.6(@types/node@26.1.1)(lightningcss@1.27.0)(terser@5.49.0)(yaml@2.9.0))
+        version: 2.11.7(solid-js@1.9.14)(vite@7.3.7(@types/node@26.1.1)(lightningcss@1.27.0)(terser@5.49.0)(yaml@2.9.0))
 
   examples/next:
     dependencies:
@@ -156,8 +166,8 @@ importers:
   examples/vue:
     dependencies:
       vue:
-        specifier: ^3.5.40
-        version: 3.5.40(typescript@5.8.3)
+        specifier: ^3.5.42
+        version: 3.5.44(typescript@5.8.3)
     devDependencies:
       '@iconoir/vue':
         specifier: workspace:*
@@ -170,22 +180,22 @@ importers:
         version: 22.20.1
       '@vitejs/plugin-vue':
         specifier: ^6.0.8
-        version: 6.0.8(vite@7.3.6(@types/node@22.20.1)(lightningcss@1.27.0)(terser@5.49.0)(yaml@2.9.0))(vue@3.5.40(typescript@5.8.3))
+        version: 6.0.8(vite@7.3.7(@types/node@22.20.1)(lightningcss@1.27.0)(terser@5.49.0)(yaml@2.9.0))(vue@3.5.44(typescript@5.8.3))
       '@vue/tsconfig':
         specifier: ^0.7.0
-        version: 0.7.0(typescript@5.8.3)(vue@3.5.40(typescript@5.8.3))
+        version: 0.7.0(typescript@5.8.3)(vue@3.5.44(typescript@5.8.3))
       npm-run-all2:
         specifier: ^8.0.4
         version: 8.0.4
       typescript:
         specifier: ~5.8.3
         version: 5.8.3
       vite:
-        specifier: ^7.3.6
-        version: 7.3.6(@types/node@22.20.1)(lightningcss@1.27.0)(terser@5.49.0)(yaml@2.9.0)
+        specifier: ^7.3.7
+        version: 7.3.7(@types/node@22.20.1)(lightningcss@1.27.0)(terser@5.49.0)(yaml@2.9.0)
       vite-plugin-vue-devtools:
         specifier: ^7.7.10
-        version: 7.7.10(rollup@4.62.2)(vite@7.3.6(@types/node@22.20.1)(lightningcss@1.27.0)(terser@5.49.0)(yaml@2.9.0))(vue@3.5.40(typescript@5.8.3))
+        version: 7.7.10(rollup@4.62.2)(vite@7.3.7(@types/node@22.20.1)(lightningcss@1.27.0)(terser@5.49.0)(yaml@2.9.0))(vue@3.5.44(typescript@5.8.3))
       vue-tsc:
         specifier: ^3.3.8
         version: 3.3.8(typescript@5.8.3)
@@ -318,12 +328,12 @@ importers:
   packages/iconoir-vue:
     dependencies:
       vue:
-        specifier: '3'
-        version: 3.5.40(typescrip
```

---

### Incident Patch 3: `b14009a3` (2026-10-25)
**Commit Message**: fix(deps): patch critical Dependabot vulnerabilities

Bump Next.js and tinypool; add pnpm overrides for seroval and shell-quote.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `examples/next/package.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
     "lint": "next lint"
   },
   "dependencies": {
-    "next": "^15.5.21",
+    "next": "^15.5.24",
     "react": "^19.2.8",
     "react-dom": "^19.2.8"
   },
```

**File**: `iconoir.com/package.json` (modified, +2/-2)
```diff
@@ -24,11 +24,11 @@
     "@types/react-dom": "^19.2.3",
     "@types/react-window": "^1.8.8",
     "csvtojson": "^2.0.14",
-    "eslint-config-next": "^15.5.21",
+    "eslint-config-next": "^15.5.24",
     "iconoir-react": "workspace:*",
     "lodash": "^4.18.1",
     "moment": "^2.30.1",
-    "next": "^15.5.21",
+    "next": "^15.5.24",
     "next-mdx-remote": "^6.0.0",
     "react": "^19.2.8",
     "react-dom": "^19.2.8",
```

**File**: `package.json` (modified, +5/-2)
```diff
@@ -54,7 +54,7 @@
     "prettier": "^3.9.6",
     "scule": "^1.3.0",
     "semver": "^7.8.5",
-    "tinypool": "1.1.1",
+    "tinypool": "^2.1.2",
     "typescript": "~5.8.3",
     "vite": "^7.3.6",
     "vite-plugin-dts": "^4.5.4",
@@ -64,7 +64,10 @@
     "overrides": {
       "@tootallnate/once@<2.0.1": "^2.0.1",
       "postcss@<8.5.18": "^8.5.23",
-      "sharp@<0.35.0": "^0.35.3"
+      "seroval@<=1.6.0": "^1.6.2",
+      "shell-quote@<1.11.0": "^1.11.0",
+      "sharp@<0.35.0": "^0.35.3",
+      "tinypool@<=2.1.1": "^2.1.2"
     }
   }
 }
\ No newline at end of file
```

**File**: `pnpm-lock.yaml` (modified, +79/-82)
```diff
@@ -5,9 +5,12 @@ settings:
   excludeLinksFromLockfile: false
 
 overrides:
-  postcss@<8.5.18: ^8.5.23
   '@tootallnate/once@<2.0.1': ^2.0.1
+  postcss@<8.5.18: ^8.5.23
+  seroval@<=1.6.0: ^1.6.2
+  shell-quote@<1.11.0: ^1.11.0
   sharp@<0.35.0: ^0.35.3
+  tinypool@<=2.1.1: ^2.1.2
 
 packageExtensionsChecksum: sha256-cBTyUPq+IGZAZgWgvReLGDDDIq+QC1sEPJbt4H4UmnQ=
 
@@ -17,7 +20,7 @@ importers:
     devDependencies:
       '@antfu/eslint-config':
         specifier: ^5.4.1
-        version: 5.4.1(@next/eslint-plugin-next@15.5.21)(@typescript-eslint/typescript-estree@8.65.0(typescript@5.8.3))(@typescript-eslint/utils@8.65.0(eslint@9.39.5)(typescript@5.8.3))(@vue/compiler-sfc@3.5.40)(eslint-plugin-format@1.5.0(eslint@9.39.5))(eslint-plugin-jsx-a11y@6.10.2(eslint@9.39.5))(eslint-plugin-react-hooks@5.2.0(eslint@9.39.5))(eslint@9.39.5)(typescript@5.8.3)
+        version: 5.4.1(@next/eslint-plugin-next@15.5.28)(@typescript-eslint/typescript-estree@8.65.0(typescript@5.8.3))(@typescript-eslint/utils@8.65.0(eslint@9.39.5)(typescript@5.8.3))(@vue/compiler-sfc@3.5.40)(eslint-plugin-format@1.5.0(eslint@9.39.5))(eslint-plugin-jsx-a11y@6.10.2(eslint@9.39.5))(eslint-plugin-react-hooks@5.2.0(eslint@9.39.5))(eslint@9.39.5)(typescript@5.8.3)
       '@atomist/yaml-updater':
         specifier: ^1.0.2
         version: 1.0.2
@@ -61,8 +64,8 @@ importers:
         specifier: ^7.8.5
         version: 7.8.5
       tinypool:
-        specifier: 1.1.1
-        version: 1.1.1
+        specifier: ^2.1.2
+        version: 2.2.0
       typescript:
         specifier: ~5.8.3
         version: 5.8.3
@@ -79,8 +82,8 @@ importers:
   examples/next:
     dependencies:
       next:
-        specifier: ^15.5.21
-        version: 15.5.21(@babel/core@7.29.7)(@types/node@22.20.1)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
+        specifier: ^15.5.24
+        version: 15.5.28(@babel/core@7.29.7)(@types/node@22.20.1)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
       react:
         specifier: ^19.2.8
         version: 19.2.8
@@ -235,8 +238,8 @@ importers:
         specifier: ^2.0.14
         version: 2.0.14
       eslint-config-next:
-        specifier: ^15.5.21
-        version: 15.5.21(eslint@9.39.5)(typescript@5.8.3)
+        specifier: ^15.5.24
+        version: 15.5.28(eslint@9.39.5)(typescript@5.8.3)
       iconoir-react:
         specifier: workspace:*
         version: link:../packages/iconoir-react
@@ -247,8 +250,8 @@ importers:
         specifier: ^2.30.1
         version: 2.30.1
       next:
-        specifier: ^15.5.21
-        version: 15.5.21(@babel/core@7.29.7)(@types/node@22.20.1)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
+        specifier: ^15.5.24
+        version: 15.5.28(@babel/core@7.29.7)(@types/node@22.20.1)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
       next-mdx-remote:
         specifier: ^6.0.0
         version: 6.0.0(@types/react@19.2.17)(react@19.2.8)
@@ -1702,56 +1705,56 @@ packages:
       '@emnapi/core': ^1.7.1
       '@emnapi/runtime': ^1.7.1
 
-  '@next/env@15.5.21':
-    resolution: {integrity: sha512-hjJI/GfrjWHgNguRIBzItjRRu0m3Nrz17GhxsjuHfjIvg9hyg3239REd2dpI+bpMTFuVrVprHzEQ19m++cDtbw==}
+  '@next/env@15.5.28':
+    resolution: {integrity: sha512-xxW5EBI8fMPuVTPBW7LL980IRbuDXlbkUAwp9DDhtb4Lnich3nJ13uYpvrX4VE74hWPf6AvHHAMmGCidcHjbfg==}
 
-  '@next/eslint-plugin-next@15.5.21':
-    resolution: {integrity: sha512-5MoR9vO3dE1lU3LixogB54xrn7OhMGempTqk1q3WlvbKrT6cNt5mV2mMkX5sghAk0vZF6Nz1HxoTb9YmZv8wRg==}
+  '@next/eslint-plugin-next@15.5.28':
+    resolution: {integrity: sha512-EsR/G+skBFfu8Z35P6V/yuu4IV8zkZXIssGOgIRD0ZXqB4CTEuEHQC1ySOQi31u4xjmgHVAdG1RT3QAasRmcZA==}
 
-  '@next/swc-darwin-arm64@15.5.21':
-    resolution: {integrity: sha512-ZfjqPEdi6TRC/fWx7UDbwb1fbVgyh2uD5tVTRKIDZDlYM+UNuE/LafDG2fwuAoZilADpABh46OY/F5qf9JjqLQ==}
+  '@next/swc-darwin-arm64@15.5.28':
+    resolution: {integrity: sha512-dPoQYXcfSIqx5o+TOXVXO7kONK5qbtNRDeiTfII0bT3puGIT6VF5e0QwmxNZfEZ5Zety5f3m9P/p4xqwfiLlPg==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [darwin]
 
-  '@next/swc-darwin-x64@15.5.21':
-    resolution: {integrity: sha512-TlCf1NpxgQLzTrexuev75xwmNCJMd1/qkJpTVP1GRRcih93hlIBn1P72hkh8T0gnRFr6BmWksQtbyG3jT6jnww==}
+  '@next/swc-darwin-x64@15.5.28':
+    resolution: {integrity: sha512-RgCJ7buBivTH+6sddqaVm+/v8kwMHlFkobvdt3DfETutws5HrxnToMIWSN9X3MZ3aAi7BbKrGZZWUDQLEycXqw==}
     engines: {node: '>= 10'}
     cpu: [x64]
     os: [darwin]
 
-  '@next/swc-linux-arm64-gnu@15.5.21':
-    resolution: {integrity: sha512-LXRsq1p+HvHSi7ygwNcSEEcK0zuo5jS75ZlqFHtOH+LF7qntXAJVJxah+1Pi/GyBm7EpkwU7m4EgbvIKrMqm9A==}
+  '@next/swc-linux-arm64-gnu@15.5.28':
+    resolution: {integrity: sha512-OHXQe13olE59aKe++zHavGcJPh5SLHXi6Anret3BBeq1+qhSuOJDNAli/EDDfxs6UTqA4Qddo4uyYry2slyjiQ==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [linux]
 
-  '@next/swc-linux-arm64-musl@15.5.21':
-    resolution: {integrity: sha512-hyGixhFxpDKjqoev6l4KlcRBlt9AXWrGhDZwmwg49sMJM5tnKQPSi+SEj9+e5n+l/bthRGZUdh59GKIs6lQPRw==}
+  '@next/swc-
```

#### Recent Merged Pull Requests:
- **PR #640** (2026-10-18): feat(site): link the icon sheet to the icon's own page (@lucaburgio)
- **PR #637** (2026-10-17): fix(site): always show Carbon's small ad card, never the Cover card (@lucaburgio)
- **PR #636** (closed): feat(site): make iconoir.com readable by AI agents (@lucaburgio)
- **PR #626** (2026-08-12): fix(ci): make release publishing idempotent and fix pub.dev version (@lucaburgio)
- **PR #623** (2026-07-25): chore: tidy up solid-js target after #493 (@lucaburgio)
- **PR #618** (2026-06-18): Migrate Flutter publishing to pub.dev OIDC (@lucaburgio)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
