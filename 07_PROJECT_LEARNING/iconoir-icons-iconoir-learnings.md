# Forensic Learning Record (Deep Inspection): iconoir-icons/iconoir

> **Canonical Artifact**: `07_PROJECT_LEARNING/iconoir-icons-iconoir-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/iconoir-icons/iconoir](https://github.com/iconoir-icons/iconoir))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:16:54.545Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `iconoir-icons/iconoir`
- **Description**: An open source icons library with 1600+ icons, supporting React, React Native, Flutter, Vue, Figma, and Framer.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4564 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

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
- **Issue #635** (2026-09-30): **[ICON]**
  *Symptoms*: <!-- Before creating an icon request, please search to see if someone has requested the icon already. If there is an open request, please upvote it or add a comment. -->  ## Icon Request  - Icon name: - Use case: - Screenshots of similar icons: 

- **Issue #632** (2026-09-04): **[ICON]no smell**
  *Symptoms*: <!-- Before creating an icon request, please search to see if someone has requested the icon already. If there is an open request, please upvote it or add a comment. -->  ## Icon Request  - Icon name: - Use case: - Screenshots of similar icons: 

- **Issue #628** (2026-08-21): **[ICON]**
  *Symptoms*: <!-- Before creating an icon request, please search to see if someone has requested the icon already. If there is an open request, please upvote it or add a comment. -->  ## Icon Request  - Icon name: - Use case: - Screenshots of similar icons: 

- **Issue #627** (2026-09-03): **[ICON]**
  *Symptoms*: <!-- Before creating an icon request, please search to see if someone has requested the icon already. If there is an open request, please upvote it or add a comment. -->  ## Icon Request  - Icon name: - Use case: - Screenshots of similar icons: 

- **Issue #626** (2026-08-12): **fix(ci): make release publishing idempotent and fix pub.dev version**
  *Symptoms*: The `v7.12.0` release half-published. Two independent bugs:  ### 1. `pnpm -r publish` is all-or-nothing  `iconoir-solid-js` has never existed on npm, and `NPM_TOKEN` is a granular token scoped to selected packages — it can't *create* a package. The 403 aborted the run **before `@iconoir/vue`**, which is still stuck at 7.11.1.  Now each package is published individually: anything already on the registry is skipped, and a failure on one doesn't stop the rest (the step still fails the job, so it stays visible). Re-pushing a tag retries only what's missing.  ### 2. Flutter published from the pre-bump commit  `publish-flutter.yml` checked out the tag ref, which at trigger time still points at the commit *before* the version bump — hence `Version 7.11.1 of package iconoir_flutter already exists`. The `Update tag` step does force-move the tag onto the bump commit, but that push uses the persisted `GITHUB_TOKEN`, and **pushes made with `GITHUB_TOKEN` don't trigger workflows**, so it never re-ran.  Folded the pub.dev publish back into `release.yaml` after the bump, as it was before #618. It has to live there: pub.dev validates the OIDC `ref` claim against the `v{{version}}` tag pattern, so the job must be triggered by the tag push itself — a `workflow_run`-triggered job would carry `refs/heads/main` and be rejected. `release.yaml` already has `id-token: write`, and `pnpm run build` already covers the `flutter` target. A `GITHUB_REF_NAME` guard replaces the trigger's `v[0-9]+.[0-9]+.[0

- **Issue #625** (2026-08-11): **[ICON]**
  *Symptoms*: <!-- Before creating an icon request, please search to see if someone has requested the icon already. If there is an open request, please upvote it or add a comment. -->  ## Icon Request  - Icon name: - Use case: - Screenshots of similar icons: 

- **Issue #624** (2026-08-02): **Visernic Icon**
  *Symptoms*: <!-- Before creating an icon request, please search to see if someone has requested the icon already. If there is an open request, please upvote it or add a comment. -->  ## Icon Request  - Icon name: Visernic - Use case: https://github.com/sarfenaz/branding/tree/main/SVG/Icon - Screenshots of similar icons:  <img width="150" height="150" alt="Image" src="https://github.com/user-attachments/assets/9b620051-648e-415e-8260-86e5f6f38f0d" />

- **Issue #623** (2026-07-25): **chore: tidy up solid-js target after #493**
  *Symptoms*: Small cosmetic follow-up to #493 (SolidJS support). No functional or build-output changes.  ### Changes - **`bin/build/targets/solid-js/index.js`** — rename the leftover `vuePath` variable (copy-paste from the Vue target) to `solidPath`. - **`.gitignore`** — normalize back to LF line endings. It was converted to CRLF in #493, which showed the whole file as changed for a one-line addition. No content changed (verified with `git diff --ignore-all-space`).  Note: the stale package version (`7.10.1` vs current `7.11.1`) is intentionally left for the normal release/publish flow to bump.

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

### Incident Patch 1: `7b9eb508` (2026-08-12)
**Commit Message**: fix(ci): make release publishing idempotent and fix pub.dev version (#626)

fix(ci): publish npm packages individually and move pub.dev publish into release

The v7.12.0 release half-published because of two independent bugs.

`pnpm -r publish` is all-or-nothing: the 403 on the brand-new
`iconoir-solid-js` (a granular NPM_TOKEN cannot create a package that
does not exist yet) aborted the run before `@iconoir/vue`, leaving it at
7.11.1. Publish package by package instead, skipping anything already on
the registry and continuing past failures, so re-pushing a tag retries
only what is missing.

`publish-flutter.yml` checked out the tag, which at trigger time still
points at the pre-bump commit, so it tried to publish the previous
version. The tag force-push that follows the bump uses the persisted
GITHUB_TOKEN and therefore never re-triggers a workflow. Fold the pub.dev
publish back into release.yaml after the bump, as it was before #618:
pub.dev validates the OIDC ref claim against the `v{{version}}` tag
pattern, so it has to stay on the tag-triggered workflow.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `.cursor/rules/releases.mdc` (modified, +21/-7)
```diff
@@ -11,10 +11,16 @@ Use semver tags like `v7.11.1` (patch) or `v7.12.0` (minor). The tag must match
 
 ## What a release does
 
-Pushing a `v*` tag triggers two workflows:
+Pushing a `v*` tag triggers **`release.yaml`**, which does everything: builds all targets, bumps versions on `main`, commits and force-moves the tag onto that commit, then publishes
 
-1. **`release.yaml`** — builds all targets, bumps versions on `main`, publishes npm packages (`iconoir`, `iconoir-react`, `iconoir-react-native`, `iconoir-vue`). Skips npm publish if that version is already on the registry (safe to re-tag).
-2. **`publish-flutter.yml`** — builds Flutter icons and publishes `iconoir_flutter` to pub.dev via **GitHub OIDC** (no stored OAuth tokens).
+- npm: `iconoir`, `iconoir-react`, `iconoir-react-native`, `iconoir-solid-js`, `@iconoir/vue`
+- pub.dev: `iconoir_flutter`, via **GitHub OIDC** (no stored OAuth tokens)
+
+Every publish is per-package and idempotent — anything already on the registry is skipped — so re-pushing a tag retries only what is missing.
+
+Flutter publishing has to live in this workflow and after the version bump. pub.dev validates the OIDC `ref` claim against the `v{{version}}` tag pattern, so the job must be triggered by the tag push itself, and it reads the version from the bumped `pubspec.yaml`.
+
+**Gotcha:** the `Update tag` step pushes with the persisted `GITHUB_TOKEN`, and pushes made with `GITHUB_TOKEN` do not trigger workflows. Never rely on that force-push to re-trigger anything — a separate tag-triggered workflow would only ever see the *pre-bump* commit. (That's what broke `v7.12.0`.)
 
 ## Secrets required
 
@@ -43,19 +49,27 @@ git tag v7.11.1
 git push origin v7.11.1
 ```
 
-Or create the release/tag from GitHub UI — both trigger the workflows.
+Or create the release/tag from GitHub UI — both trigger the workflow.
 
-## Re-publishing Flutter only
+## Retrying a partial release
 
-If npm succeeded but Flutter failed, merge any workflow fixes to `main`, then re-push the same tag:
+If some packages published and others failed, merge any fixes to `main`, then re-push the same tag:
 
 ```bash
 git checkout main && git pull
 git tag -fa v7.11.1 -m "v7.11.1"
 git push -f origin v7.11.1
 ```
 
-npm publish will be skipped; Flutter publish will retry.
+Already-published packages are skipped; only the missing ones are retried. Push the tag yourself — a re-push from within the workflow would not re-trigger it.
+
+## Adding a new package
+
+`NPM_TOKEN` is a granular token scoped to selected packages, so **CI cannot create a package that does not exist yet** — the first publish 403s with `You may not perform that action with these credentials`. For a brand-new package:
+
+1. Build it locally (`pnpm run build <target>`) and publish once by hand from its directory: `npm publish --access public`.
+2. Add the new package to the granular token's package list at npmjs.com → Access Tokens.
+3. Add its directory to the publish loop in `release.yaml` and to `bin/prepublish.js` (the two lists must stay in sync).
 
 ## CI / lockfile
 
```

**File**: `.github/workflows/publish-flutter.yml` (removed, +0/-37)
```diff
@@ -1,37 +0,0 @@
-name: Publish Flutter to pub.dev
-
-on:
-  push:
-    tags:
-      - 'v[0-9]+.[0-9]+.[0-9]+'
-
-permissions:
-  id-token: write
-  contents: read
-
-jobs:
-  publish:
-    name: Publish Flutter
-    runs-on: ubuntu-latest
-    steps:
-      - name: Checkout repository
-        uses: actions/checkout@v4
-
-      - name: Setup
-        uses: ./.github/actions/setup
-
-      - name: Build Flutter package
-        run: pnpm run build flutter
-
-      - name: Setup Dart
-        uses: dart-lang/setup-dart@65eb853c7ba17dde3be364c3d2858773e7144260
-
-      - name: Setup Flutter
-        uses: flutter-actions/setup-flutter@18c66a64fb6f6d3338c63cabbc5cd6da395e7f1d
-
-      - name: Publish to pub.dev
-        working-directory: packages/iconoir-flutter
-        run: |
-          dart pub get
-          dart pub publish --dry-run
-          dart pub publish -f
```

**File**: `.github/workflows/release.yaml` (modified, +43/-8)
```diff
@@ -51,15 +51,50 @@ jobs:
           git -c user.email="actions@github.com" -c user.name="GitHub Actions" tag -fa ${{ github.ref_name }} -m "${{ github.ref_name }}"
           git push -f origin ${{ github.ref_name }}
 
-      - name: Publish packages
+      # Publish package by package, skipping the ones already on the registry, so
+      # that re-pushing a tag retries only what is missing. Keep the directory
+      # list in sync with bin/prepublish.js.
+      - name: Publish npm packages
         run: |
-          ROOT_VERSION=$(node -p "require('./package.json').version")
-          PUBLISHED=$(npm view iconoir@"$ROOT_VERSION" version 2>/dev/null || true)
-          if [ "$PUBLISHED" = "$ROOT_VERSION" ]; then
-            echo "npm packages already at $ROOT_VERSION, skipping publish"
-          else
-            pnpm -r publish --access public
-          fi
+          FAILED=0
+          for DIR in . packages/iconoir-react packages/iconoir-react-native packages/iconoir-solid-js packages/iconoir-vue; do
+            NAME=$(node -p "require('./$DIR/package.json').name")
+            VERSION=$(node -p "require('./$DIR/package.json').version")
+            if [ "$(npm view "$NAME@$VERSION" version 2>/dev/null || true)" = "$VERSION" ]; then
+              echo "::notice::$NAME@$VERSION already published, skipping"
+              continue
+            fi
+            echo "Publishing $NAME@$VERSION"
+            (cd "$DIR" && pnpm publish --access public --no-git-checks) \
+              || { echo "::error::Failed to publish $NAME@$VERSION"; FAILED=1; }
+          done
+          exit $FAILED
         env:
           NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
           NPM_CONFIG_PROVENANCE: true
+
+      - name: Setup Dart
+        uses: dart-lang/setup-dart@65eb853c7ba17dde3be364c3d2858773e7144260
+
+      - name: Setup Flutter
+        uses: flutter-actions/setup-flutter@18c66a64fb6f6d3338c63cabbc5cd6da395e7f1d
+
+      # Must run in this workflow rather than a separate one: pub.dev validates
+      # the OIDC `ref` claim against the `v{{version}}` tag pattern, so the job
+      # has to be triggered by the tag push. It also has to run *after* the
+      # version bump above, which is what pubspec.yaml is read from.
+      - name: Publish to pub.dev
+        working-directory: packages/iconoir-flutter
+        run: |
+          if ! echo "$GITHUB_REF_NAME" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$'; then
+            echo "$GITHUB_REF_NAME is not a release tag, skipping pub.dev publish"
+            exit 0
+          fi
+          VERSION=$(grep -m1 '^version:' pubspec.yaml | awk '{print $2}')
+          if curl -sfo /dev/null "https://pub.dev/api/packages/iconoir_flutter/versions/$VERSION"; then
+            echo "::notice::iconoir_flutter $VERSION already published, skipping"
+            exit 0
+          fi
+          dart pub get
+          dart pub publish --dry-run
+          dart pub publish -f
```

---

### Incident Patch 2: `46ae9bbe` (2026-07-25)
**Commit Message**: Fix: Safari/Arc-safe SVG download data URLs (#515) (#604)

fix(site): Safari-safe SVG download data URLs (#515)

Made-with: Cursor

**File**: `iconoir.com/components/Icon.tsx` (modified, +30/-16)
```diff
@@ -8,14 +8,27 @@ import { DEFAULT_CUSTOMIZATIONS } from './IconList';
 
 const HEADER = '<?xml version="1.0" encoding="UTF-8"?>';
 
+function svgToDataUrl(svg: string) {
+  // RFC 2397: encode as a URI component so `#`, `<`, non-Latin1, etc. stay valid.
+  // `btoa` is Latin-1 only and breaks Safari/Arc downloads for some SVGs (#515).
+  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
+}
+
 function bakeSvg(
   svgString: string,
   color: string,
   strokeWidth: string | number,
 ) {
+  // Serialized SVG from the DOM already includes stroke-width on stroked
+  // elements; blindly appending after stroke="currentColor" duplicates the
+  // attribute and breaks strict XML parsers (e.g. network-* icons).
+  const withoutStrokeWidth = svgString.replace(
+    /\sstroke-width=(["'])[^"']*\1/g,
+    '',
+  );
   return (
     HEADER
-    + svgString
+    + withoutStrokeWidth
       .replace(
         /stroke="currentColor"/g,
         `stroke="currentColor" stroke-width="${strokeWidth}"`,
@@ -163,24 +176,25 @@ export function Icon({ iconWidth, icon }: IconProps) {
   }, []);
 
   React.useEffect(() => {
-    if (iconContainerRef.current) {
-      htmlContentsRef.current = bakeSvg(
-        (iconContainerRef.current.firstChild as SVGElement).outerHTML,
-        iconContext.color || DEFAULT_CUSTOMIZATIONS.hexColor,
-        iconContext.strokeWidth || DEFAULT_CUSTOMIZATIONS.strokeWidth,
-      );
-    }
-  }, [iconContext, supportsClipboard]);
+    const container = iconContainerRef.current;
+    const svgEl = container?.firstChild as SVGElement | undefined;
+    if (!svgEl) return;
 
-  React.useEffect(() => {
-    const element = downloadRef.current || (iconContainerRef.current as unknown as HTMLAnchorElement);
+    const baked = bakeSvg(
+      svgEl.outerHTML,
+      iconContext.color || DEFAULT_CUSTOMIZATIONS.hexColor,
+      iconContext.strokeWidth || DEFAULT_CUSTOMIZATIONS.strokeWidth,
+    );
+    htmlContentsRef.current = baked;
+
+    const downloadTarget = supportsClipboard
+      ? downloadRef.current
+      : (container as unknown as HTMLAnchorElement | null);
 
-    if (element) {
-      element.href = `data:image/svg+xml;base64,${btoa(
-        htmlContentsRef.current,
-      )}`;
+    if (downloadTarget) {
+      downloadTarget.href = svgToDataUrl(baked);
     }
-  }, [iconContext, supportsClipboard]);
+  }, [icon, iconContext, supportsClipboard]);
 
   return (
     <div className="icon-container">
```

---

### Incident Patch 3: `bfbd464f` (2026-06-06)
**Commit Message**: Revert "chore: replace website workflow with cross-repo dispatch trigger"

This reverts commit d283fc3d9a5b2c70e3ff3fd3052e7d7f206bd900.

**File**: `.github/workflows/notify-website.yaml` (removed, +0/-31)
```diff
@@ -1,31 +0,0 @@
-name: Notify Website
-
-on:
-  workflow_run:
-    workflows:
-      - Release
-    types:
-      - completed
-  workflow_dispatch:
-
-jobs:
-  notify:
-    name: Trigger website rebuild
-    runs-on: ubuntu-latest
-    if: >
-      github.event_name == 'workflow_dispatch' ||
-      github.event.workflow_run.conclusion == 'success'
-    steps:
-      - name: Dispatch to iconoir-web
-        run: |
-          curl -X POST \
-            -H "Authorization: token ${{ secrets.WEBSITE_TRIGGER_TOKEN }}" \
-            -H "Accept: application/vnd.github.v3+json" \
-            https://api.github.com/repos/lucaburgio/iconoir-web/dispatches \
-            -d "{
-              \"event_type\": \"icons-updated\",
-              \"client_payload\": {
-                \"sha\": \"${{ github.sha }}\",
-                \"ref\": \"${{ github.ref }}\"
-              }
-            }"
```

**File**: `.github/workflows/website.yaml` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+name: Website
+
+on:
+  workflow_dispatch:
+  workflow_run:
+    workflows:
+      - Release
+    types:
+      - completed
+
+permissions:
+  actions: read
+  contents: read
+  pages: write
+  id-token: write
+
+concurrency:
+  group: ${{ github.workflow }}
+  cancel-in-progress: true
+
+jobs:
+  build:
+    name: Build
+    runs-on: ubuntu-latest
+    steps:
+      - name: Checkout repository
+        uses: actions/checkout@v4
+
+      - name: Setup
+        uses: ./.github/actions/setup
+
+      - name: Build
+        run: pnpm run build react
+
+      - name: Build website
+        run: pnpm run build
+        working-directory: iconoir.com
+        env:
+          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+
+      - name: Setup GitHub Pages
+        uses: actions/configure-pages@v5
+
+      - name: Upload artifact
+        uses: actions/upload-pages-artifact@v3
+        with:
+          path: ./iconoir.com/out
+
+  deploy:
+    name: Deploy
+    needs: build
+    runs-on: ubuntu-latest
+    environment:
+      name: github-pages
+      url: ${{ steps.deployment.outputs.page_url }}
+    steps:
+      - name: Deploy to GitHub Pages
+        id: deployment
+        uses: actions/deploy-pages@v4
```

---

### Incident Patch 4: `a87b96d3` (2026-04-15)
**Commit Message**: fix on readability

**File**: `iconoir.com/components/Ad.tsx` (removed, +0/-51)
```diff
@@ -1,51 +0,0 @@
-import React from 'react';
-import styled from 'styled-components';
-
-const AdContainer = styled.div`
-  #carbonads {
-    margin: 24px 0 0 0;
-    a {
-      text-decoration: none;
-    }
-    .carbon-wrap {
-      display: flex;
-      align-items: flex-start;
-      > :first-child {
-        margin-right: 12px;
-      }
-      & > a > img {
-        width: 100px;
-        height: 74px;
-        filter: grayscale(100%);
-      }
-    }
-    .carbon-text {
-      font-size: 14px;
-    }
-    .carbon-poweredby {
-      text-align: center;
-      font-size: 12px;
-    }
-  }
-`;
-
-export function Ad() {
-  const containerRef = React.useRef<HTMLDivElement>(null);
-  const addedScript = React.useRef(false);
-
-  React.useEffect(() => {
-    const container = containerRef.current;
-
-    if (container && !addedScript.current) {
-      addedScript.current = true;
-      const script = document.createElement('script');
-      script.async = true;
-      script.type = 'text/javascript';
-      script.src = '//cdn.carbonads.com/carbon.js?serve=CESDK5QJ&placement=iconoircom';
-      script.id = '_carbonads_js';
-      container.appendChild(script);
-    }
-  }, []);
-
-  return <AdContainer ref={containerRef} />;
-}
```

**File**: `iconoir.com/components/CarbonCoverAd.tsx` (modified, +0/-2)
```diff
@@ -8,12 +8,10 @@ const CarbonCoverAdContainer = styled.div`
       text-decoration: none;
     }
     .carbon-text {
-      color: var(--black-80);
       font-size: 14px;
     }
     .carbon-poweredby {
       font-size: 12px;
-      color: var(--black-40);
     }
   }
 `;
```

---

### Incident Patch 5: `3aea04b0` (2026-04-14)
**Commit Message**: fix: colors

**File**: `iconoir.com/components/Ad.tsx` (modified, +0/-2)
```diff
@@ -20,13 +20,11 @@ const AdContainer = styled.div`
       }
     }
     .carbon-text {
-      color: var(--black-80);
       font-size: 14px;
     }
     .carbon-poweredby {
       text-align: center;
       font-size: 12px;
-      color: var(--black-40);
     }
   }
 `;
```

---

### Incident Patch 6: `2911b580` (2025-07-27)
**Commit Message**: Fix building on Windows (#553)

**File**: `bin/build/lib/ts.js` (modified, +3/-2)
```diff
@@ -1,3 +1,4 @@
+import { normalize } from 'node:path';
 import ts from 'typescript';
 
 /**
@@ -16,7 +17,7 @@ export function getDts(path, content, options) {
   const _readFile = host.readFile;
 
   host.readFile = (filename) => {
-    if (filename === path)
+    if (normalize(filename) === path)
       return content;
 
     return _readFile(filename);
@@ -25,7 +26,7 @@ export function getDts(path, content, options) {
   const dtsFilename = path.replace(/\.(m|c)?(ts|js)x?$/, '.d.$1ts');
 
   host.writeFile = (filename, contents) => {
-    if (filename === dtsFilename)
+    if (normalize(filename) === dtsFilename)
       output = contents;
   };
 
```

**File**: `bin/build/targets/css/index.js` (modified, +2/-1)
```diff
@@ -1,4 +1,5 @@
 import fs from 'node:fs/promises';
+import { EOL } from 'node:os';
 import path from 'node:path';
 import { fileURLToPath } from 'node:url';
 
@@ -29,7 +30,7 @@ export default async (ctx, target) => {
       const fileContent = await fs.readFile(icon.path, 'utf8');
 
       const transformedContent = fileContent
-        .replace(/\n/g, '')
+        .replaceAll(EOL, '')
         .replace(/(width|height)="\d+px"/g, '')
         .replace(/ +/g, ' ');
 
```

---

### Incident Patch 7: `91f5ff77` (2025-07-26)
**Commit Message**: Fix react-native module file path (#552)

**File**: `packages/iconoir-react-native/package.json` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@
     }
   },
   "main": "dist/index.js",
-  "module": "dist/esm/index.js",
+  "module": "dist/esm/index.mjs",
   "types": "dist/index.d.ts",
   "files": [
     "dist"
```

---

### Incident Patch 8: `ea8474ed` (2025-07-21)
**Commit Message**: fix: eslint

**File**: `iconoir.com/components/DocumentationNavigation.tsx` (modified, +4/-4)
```diff
@@ -174,10 +174,10 @@ export function DocumentationNavigation({
                 <span>{documentationItem.title}</span>
                 {documentationItem.label
                   ? (
-                    <NavigationItemLabel>
-                      {documentationItem.label}
-                    </NavigationItemLabel>
-                  )
+                      <NavigationItemLabel>
+                        {documentationItem.label}
+                      </NavigationItemLabel>
+                    )
                   : null}
               </NavigationItem>
             </Link>
```

**File**: `iconoir.com/pages/index.tsx` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ import { HeaderBackground } from '../components/HeaderBackground';
 import { Layout } from '../components/Layout';
 import { SEO } from '../components/SEO';
 import { Stat, StatsContainer } from '../components/Stats';
-import { Text15, Text18 } from '../components/Typography';
+import { Text18 } from '../components/Typography';
 import { REPO, SUPPORT_LINK } from '../lib/constants';
 import { getHeaderProps } from '../lib/getHeaderProps';
 import { getAllIcons } from '../lib/getIcons';
```

---

### Incident Patch 9: `80608c71` (2025-04-13)
**Commit Message**: fix: add newline on package.json for eslint update

**File**: `package.json` (modified, +1/-1)
```diff
@@ -73,4 +73,4 @@
       }
     }
   }
-}
\ No newline at end of file
+}
```

---

### Incident Patch 10: `0805c8fd` (2024-12-26)
**Commit Message**: Fix react resolution for @types/react-window

**File**: `package.json` (modified, +5/-0)
```diff
@@ -65,6 +65,11 @@
         "peerDependencies": {
           "@types/react": "18"
         }
+      },
+      "@types/react-window": {
+        "dependencies": {
+          "@types/react": "19"
+        }
       }
     }
   }
```

#### Recent Merged Pull Requests:
- **PR #626** (2026-08-12): fix(ci): make release publishing idempotent and fix pub.dev version (@lucaburgio)
- **PR #623** (2026-07-25): chore: tidy up solid-js target after #493 (@lucaburgio)
- **PR #618** (2026-06-18): Migrate Flutter publishing to pub.dev OIDC (@lucaburgio)
- **PR #617** (2026-06-18): Add React 19 support for iconoir-react-native (#567) (@lucaburgio)
- **PR #604** (2026-07-25): Fix: Safari/Arc-safe SVG download data URLs (#515) (@gkarasek)
- **PR #582** (closed): build(deps): bump next from 15.4.4 to 15.4.9 in /examples/next (@dependabot[bot])
- **PR #581** (closed): build(deps): bump next from 15.4.4 to 15.4.8 in /examples/next (@dependabot[bot])
- **PR #564** (closed): build(deps-dev): bump vite from 7.0.6 to 7.0.7 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
