# Forensic Learning Record (Deep Inspection): React95/React95

> **Canonical Artifact**: `07_PROJECT_LEARNING/react95-react95-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/React95/React95](https://github.com/React95/React95))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:16:33.515Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `React95/React95`
- **Description**: A React components library with Win95 UI
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3828 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `babel.config.js`
```
module.exports = {
  presets: [
    '@babel/preset-env',
    '@babel/preset-react',
    '@babel/preset-typescript',
  ],
  env: {
    esm: {
      presets: [['@babel/preset-env', { modules: false }]],
      ignore: ['**/*.test.tsx'],
    },
    cjs: { presets: ['@babel/preset-env'], ignore: ['**/*.test.tsx'] },
  },
  plugins: [
    ['@babel/plugin-proposal-private-methods', { loose: true }],
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    ['@babel/plugin-proposal-private-property-in-object', { loose: true }],
  ],
};

```

### Core Architecture Module: `config/mocks/fileMock.js`
```
export default 'test-file-stub';

```

### Core Architecture Module: `config/mocks/styleMock.js`
```
module.exports = {};

```

### Core Architecture Module: `config/setup/clippy.setup.js`
```
import { vi } from 'vitest';

vi.mock('clippyjs', () => {
  return {
    initAgent: vi.fn(async () => ({
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn(),
    })),
  };
});

vi.mock('clippyjs/agents', () => {
  const loader = {};
  return {
    Bonzi: loader,
    Clippy: loader,
    F1: loader,
    Genie: loader,
    Genius: loader,
    Links: loader,
    Merlin: loader,
    Peedy: loader,
    Rocky: loader,
    Rover: loader,
  };
});

```

### Core Architecture Module: `config/setup/core.setup.js`
```
import { beforeAll, vi } from 'vitest';
import fileMock from '../mocks/fileMock';

vi.mock('icojs', () => ({
  isICO: vi.fn(() => true),
  parse: vi.fn(() =>
    Promise.resolve([
      {
        width: 16,
        buffer: 'buffer-16-4-1',
        bpp: 4,
        variant: 1,
      },
      {
        width: 32,
        buffer: 'buffer-32-4-1',
        bpp: 4,
        variant: 1,
      },
      {
        width: 32,
        buffer: 'buffer-32-4-2',
        bpp: 4,
        variant: 2,
      },
    ]),
  ),
}));

vi.mock('@react95/icons', async () => {
  const actual = await vi.importActual('@react95/icons');

  const entries = Object.keys(actual).map(name => {
    return [name, `svg ${fileMock}`];
  });

  return Object.fromEntries(entries);
});

beforeAll(() => {
  global.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      arrayBuffer: vi.fn(() => ({})),
    }),
  );
  global.Blob = class Blob {
    constructor(buff) {
      this.buffer = buff;
    }

    toString() {
      return this.buffer.toString();
    }
  };

  global.URL.createObjectURL = vi.fn(data => data.toString());
});

```

### Core Architecture Module: `packages/clippy/babel.config.js`
```
module.exports = {
  extends: '../../babel.config.js',
};

```

### Core Architecture Module: `packages/clippy/index.ts`
```
export * from './src';

```

### Core Architecture Module: `packages/clippy/src/ClippyContext.ts`
```
import { initAgent } from 'clippyjs';
import { createContext } from 'react';

export type ClippyAgent = Awaited<ReturnType<typeof initAgent>>;

export const ClippyContext = createContext<{
  clippy: ClippyAgent | undefined;
}>({
  clippy: undefined,
});

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #81** (2019-03-30): **Assets folder isn't builded**
  *Symptoms*: It throws an error when use some component that render an Icon.  To fix  that,  the assets folder need to be present inside dist folder after build process end. 
  **Post-Mortem & Fix Analysis**:
  > Wouldn't this issue be more suited to a solution using Webpack and loaders (style-loader, css-loader, url-loader, file-loader, etc)? There are ways to accomplish this via Babel plugins, but they're more workarounds to avoid Webpack. Babel is a transpiler first and foremost, not a bundler. All these plugins are doing is transforming the imports at build time.  Using Webpack alongside Babel, you could do all the same things you're doing currently with Babel and simply add the transpilation to the the bundling process, avoid these resolution issues, and get the benefit of additional tools at your disposal during build (minifying code, SASS or whatever else for styling, autoprefixing, etc).  I could be missing some key point that makes this a less than optimal solution, but I feel like Webpack is the move here.
  > Hi @Zachari   Me and @ggdaltoso have searched a lot about this when we were thinking about bundling this library.  After all the content that we found about this, we decided that we do not need Webpack, Rollup, Parcel or any bundler tool. We reached the idea that Webpack is more for application than for libraries.  And about using any kind of css loader, how we are not using css files, we do not need it.  We just need to transpile our code, the code minification will be maded by the application that will use React95.  Here's some content that we read about this: https://medium.com/@lawliet29/tree-shaking-in-real-world-what-could-go-wrong-b398c2b2ebbb  But we might be wrong, so we accept PR's and other suggestions!  Thank you for your point of view.
  > That's understandable. I suggested Webpack because it's the one I have the most experience with when it comes to static assets. Admittedly, Webpack doesn't seem to be the best fit for a library. However, I do disagree that bundlers in general are a good fit towards applications only. Rollup, in particular, appears to be perfect for libraries, especially in situations such as this. However, I can't tinker with it until tomorrow so I can't say whether or not it'd be optimal here. I will tomorrow, however.  I don't fault the logic behind the choice, though. If that's the approach, simply including them in a shared folder to avoid resolution issues seems to be the way to go.

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

### Incident Patch 1: `f2f6ee1d` (2026-09-02)
**Commit Message**: Merge pull request #545 from React95/fix/svg-data-uri-quoting

fix: restore SVG icons lost to data URI quoting

**File**: `packages/core/components/Checkbox/Checkbox.css.ts` (modified, +2/-2)
```diff
@@ -55,7 +55,7 @@ export const label = style({
 });
 
 globalStyle(`${field}:checked + ${icon}`, {
-  backgroundImage: `url('${check}')`,
+  backgroundImage: `url("${check}")`,
 });
 
 globalStyle(`${field}:focus ~ ${text}, ${field}:active ~ ${text}`, {
@@ -65,7 +65,7 @@ globalStyle(`${field}:focus ~ ${text}, ${field}:active ~ ${text}`, {
 });
 
 globalStyle(`${field}:checked:disabled + ${icon}`, {
-  backgroundImage: `url('${checkDisabled}')`,
+  backgroundImage: `url("${checkDisabled}")`,
   backgroundSize: '7px 7px, 1.9px 1.9px',
 });
 
```

**File**: `packages/core/components/List/List.css.ts` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ export const listItem = style({
       right: contract.space[8],
       content: "''",
       backgroundColor: contract.colors.materialText,
-      maskImage: `url('${rightcaret}')`,
+      maskImage: `url("${rightcaret}")`,
       maskPosition: 'center center',
       maskSize: `${contract.space[5]} ${contract.space[8]}`,
       maskRepeat: 'no-repeat',
```

---

### Incident Patch 2: `e285a43a` (2026-09-02)
**Commit Message**: Merge branch 'master' into fix/svg-data-uri-quoting

**File**: `.github/workflows/build_and_publish.yml` (modified, +18/-2)
```diff
@@ -30,11 +30,28 @@ jobs:
         env:
           GH_TOKEN: ${{ secrets.GH_TOKEN }}
 
-      - uses: actions/setup-node@v6
+      # Keep this on a Node line that bundles npm >= 11.5.1, which is what trusted
+      # publishing needs. Node 24 has shipped it since 24.5.0 and npm only moves forward
+      # within a major, so tracking 24 satisfies it. Pinning an older Node would not.
+      - uses: actions/setup-node@v7
         with:
           node-version: 24
           registry-url: https://registry.npmjs.org/
 
+      # setup-node's `registry-url` writes `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}`
+      # into the runner .npmrc, and that one line breaks both things this job needs.
+      #
+      # Installing: v6 hid the missing secret behind a dummy NODE_AUTH_TOKEN export. v7
+      # removed that, so yarn now hits an unresolved placeholder and fails with
+      # "Failed to replace env in config". That is what reverted the last v7 bump.
+      #
+      # Publishing: npm treats any auth line as "already authenticated" and never starts
+      # the OIDC exchange, so trusted publishing dies with ENEEDAUTH.
+      #
+      # Dropping the line before anything runs settles both. The registry stays.
+      - name: Clear placeholder npm auth line
+        run: sed -i '/_authToken/d' "$NPM_CONFIG_USERCONFIG"
+
       - name: Install dependencies
         run: yarn --pure-lockfile --non-interactive
 
@@ -55,7 +72,6 @@ jobs:
           ./scripts/publish
         env:
           GH_TOKEN: ${{ secrets.GH_TOKEN }}
-          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
 
       - name: Build storybook
         if: github.ref == 'refs/heads/master'
```

**File**: `.github/workflows/labeler.yml` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ jobs:
       pull-requests: write
 
     steps:
-      - uses: actions/labeler@v6
+      - uses: actions/labeler@v7
         with:
           repo-token: '${{ secrets.GH_TOKEN }}'
           sync-labels: true
```

**File**: `.github/workflows/scorecard.yml` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ jobs:
           persist-credentials: false
 
       - name: Run analysis
-        uses: ossf/scorecard-action@v2.4.3
+        uses: ossf/scorecard-action@v2.4.4
         with:
           results_file: results.sarif
           results_format: sarif
```

**File**: `.nvmrc` (modified, +1/-1)
```diff
@@ -1 +1 @@
-20.16.0
\ No newline at end of file
+24
```

---

### Incident Patch 3: `cdcd9823` (2026-09-02)
**Commit Message**: fix(List): restore missing submenu caret

Same data URI quoting problem as the Checkbox icon: the single-quoted
url() ended early on the SVG's own attribute quotes, so the mask-image
on nested list items was dropped.

**File**: `packages/core/components/List/List.css.ts` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ export const listItem = style({
       right: contract.space[8],
       content: "''",
       backgroundColor: contract.colors.materialText,
-      maskImage: `url('${rightcaret}')`,
+      maskImage: `url("${rightcaret}")`,
       maskPosition: 'center center',
       maskSize: `${contract.space[5]} ${contract.space[8]}`,
       maskRepeat: 'no-repeat',
```

---

### Incident Patch 4: `61886cbb` (2026-09-02)
**Commit Message**: fix(Checkbox): restore missing check icon

Vite inlines small SVGs as raw data URIs and rewrites the attribute
quotes to single quotes. Wrapping that value in single quotes ended the
CSS string at the first attribute quote, so the background-image
declaration was dropped and the check mark never rendered.

Use double quotes as the url() delimiter instead.

**File**: `packages/core/components/Checkbox/Checkbox.css.ts` (modified, +2/-2)
```diff
@@ -55,7 +55,7 @@ export const label = style({
 });
 
 globalStyle(`${field}:checked + ${icon}`, {
-  backgroundImage: `url('${check}')`,
+  backgroundImage: `url("${check}")`,
 });
 
 globalStyle(`${field}:focus ~ ${text}, ${field}:active ~ ${text}`, {
@@ -65,7 +65,7 @@ globalStyle(`${field}:focus ~ ${text}, ${field}:active ~ ${text}`, {
 });
 
 globalStyle(`${field}:checked:disabled + ${icon}`, {
-  backgroundImage: `url('${checkDisabled}')`,
+  backgroundImage: `url("${checkDisabled}")`,
   backgroundSize: '7px 7px, 1.9px 1.9px',
 });
 
```

---

### Incident Patch 5: `3435b869` (2026-07-17)
**Commit Message**: Merge pull request #542 from React95/revert-541-dependabot/github_actions/github-actions-eefdb6dedd

Revert "chore(deps): bump actions/setup-node from 6 to 7 in the github-actions group"

**File**: `.github/workflows/build_and_publish.yml` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ jobs:
         env:
           GH_TOKEN: ${{ secrets.GH_TOKEN }}
 
-      - uses: actions/setup-node@v7
+      - uses: actions/setup-node@v6
         with:
           node-version: 24
           registry-url: https://registry.npmjs.org/
```

---

### Incident Patch 6: `cf572554` (2026-07-17)
**Commit Message**: Revert "chore(deps): bump actions/setup-node from 6 to 7 in the github-actions group"

**File**: `.github/workflows/build_and_publish.yml` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ jobs:
         env:
           GH_TOKEN: ${{ secrets.GH_TOKEN }}
 
-      - uses: actions/setup-node@v7
+      - uses: actions/setup-node@v6
         with:
           node-version: 24
           registry-url: https://registry.npmjs.org/
```

---

### Incident Patch 7: `c6be8142` (2026-07-08)
**Commit Message**: Merge pull request #540 from React95/fix/nx-release-publish-noop-executor

fix(release): pin the publish executor for dist-published packages

**File**: `packages/clippy/package.json` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@
   "nx": {
     "targets": {
       "nx-release-publish": {
+        "executor": "@nx/js:release-publish",
         "options": {
           "packageRoot": "{projectRoot}/dist"
         }
```

**File**: `packages/core/package.json` (modified, +1/-0)
```diff
@@ -231,6 +231,7 @@
   "nx": {
     "targets": {
       "nx-release-publish": {
+        "executor": "@nx/js:release-publish",
         "options": {
           "packageRoot": "{projectRoot}/dist"
         }
```

**File**: `packages/icons/package.json` (modified, +1/-0)
```diff
@@ -67,6 +67,7 @@
   "nx": {
     "targets": {
       "nx-release-publish": {
+        "executor": "@nx/js:release-publish",
         "options": {
           "packageRoot": "{projectRoot}/dist"
         }
```

---

### Incident Patch 8: `2140baf8` (2026-07-08)
**Commit Message**: fix(release): pin the publish executor for dist-published packages

Overriding the nx-release-publish target's options via the package.json
"nx" field (to set packageRoot) replaced the executor inferred by the
release plugin with nx:noop instead of merging with it. As a result,
core, icons, and clippy's nx-release-publish task silently completed
in 0s and reported success without ever calling npm publish, while
cra-template and cra-template-typescript (which don't override this
target) published correctly.

Pin the executor explicitly alongside the packageRoot override so the
real @nx/js:release-publish executor is used.

**File**: `packages/clippy/package.json` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@
   "nx": {
     "targets": {
       "nx-release-publish": {
+        "executor": "@nx/js:release-publish",
         "options": {
           "packageRoot": "{projectRoot}/dist"
         }
```

**File**: `packages/core/package.json` (modified, +1/-0)
```diff
@@ -231,6 +231,7 @@
   "nx": {
     "targets": {
       "nx-release-publish": {
+        "executor": "@nx/js:release-publish",
         "options": {
           "packageRoot": "{projectRoot}/dist"
         }
```

**File**: `packages/icons/package.json` (modified, +1/-0)
```diff
@@ -67,6 +67,7 @@
   "nx": {
     "targets": {
       "nx-release-publish": {
+        "executor": "@nx/js:release-publish",
         "options": {
           "packageRoot": "{projectRoot}/dist"
         }
```

---

### Incident Patch 9: `bdd1d44e` (2026-07-08)
**Commit Message**: Merge pull request #539 from React95/fix/clippy-engines-node

fix(clippy): declare minimum supported Node.js version

**File**: `packages/clippy/package.json` (modified, +3/-0)
```diff
@@ -12,6 +12,9 @@
   "homepage": "https://react95.github.io/React95",
   "license": "MIT",
   "main": "index.js",
+  "engines": {
+    "node": ">=18"
+  },
   "publishConfig": {
     "access": "public",
     "directory": "dist",
```

---

### Incident Patch 10: `3a75ce9c` (2026-07-08)
**Commit Message**: fix(clippy): declare minimum supported Node.js version

publint flagged the missing engines.node field on the published
package. Declare the same minimum version already implied by the
workspace tooling.

**File**: `packages/clippy/package.json` (modified, +3/-0)
```diff
@@ -12,6 +12,9 @@
   "homepage": "https://react95.github.io/React95",
   "license": "MIT",
   "main": "index.js",
+  "engines": {
+    "node": ">=18"
+  },
   "publishConfig": {
     "access": "public",
     "directory": "dist",
```

#### Recent Merged Pull Requests:
- **PR #548** (2026-09-30): chore(storybook): upgrade to Storybook 10 and rework the theme panel (@ggdaltoso)
- **PR #547** (2026-09-02): ci: bump github-actions group and publish to npm via OIDC (@ggdaltoso)
- **PR #546** (closed): ci: publish to npm via OIDC trusted publishing (@ggdaltoso)
- **PR #545** (2026-09-02): fix: restore SVG icons lost to data URI quoting (@ggdaltoso)
- **PR #544** (closed): chore(deps): bump the github-actions group across 1 directory with 3 updates (@dependabot[bot])
- **PR #543** (closed): chore(deps): bump the github-actions group with 2 updates (@dependabot[bot])
- **PR #542** (2026-07-17): Revert "chore(deps): bump actions/setup-node from 6 to 7 in the github-actions group" (@ggdaltoso)
- **PR #541** (2026-07-17): chore(deps): bump actions/setup-node from 6 to 7 in the github-actions group (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
