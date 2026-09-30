# Forensic Learning Record (Deep Inspection): pinterest/gestalt

> **Canonical Artifact**: `07_PROJECT_LEARNING/pinterest-gestalt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pinterest/gestalt](https://github.com/pinterest/gestalt))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:46:50.032Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pinterest/gestalt`
- **Description**: A set of React UI components that supports Pinterest’s design language
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4379 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.eslintrc.js`
```
const OFF = 'off';
const ERROR = 'error';
const NEVER = 'never';

const baseExtends = [
  'airbnb',
  'plugin:@next/next/recommended',
  'plugin:eslint-comments/recommended',
  'plugin:jest/recommended',
  'plugin:jsx-a11y/recommended',
  'plugin:react/recommended',
  'prettier',
];

const basePlugins = [
  'eslint-comments',
  'eslint-plugin-gestalt',
  'import',
  'jest',
  'jsx-a11y',
  'react',
  'react-compiler',
  'react-hooks',
  'simple-import-sort',
  'testing-library',
  'validate-jsx-nesting',
];

const baseRules = {
  'eslint-comments/no-unused-disable': ERROR,
  'gestalt/only-valid-tokens': ERROR,
  'import/extensions': [
    ERROR,
    {
      css: 'always',
      js: 'never',
      ts: 'never',
      tsx: 'never',
      json: 'always',
      mjs: 'never',
    },
  ],
  'import/first': ERROR,
  'import/newline-after-import': ERROR,
  'import/no-anonymous-default-export': ERROR,
  'import/no-duplicates': ERROR,
  'import/no-extraneous-dependencies': OFF,
  'import/no-namespace': ERROR,
  'import/no-relative-parent-imports': OFF,
  'import/no-unresolved': OFF,
  'import/order': OFF,
  'jsx-a11y/label-has-associated-control': [
    ERROR,
    {
      'labelComponents': ['Label'],
      'labelAttributes': ['htmlFor'],
      'controlComponents': ['CheckBox'],
      'depth': 3,
    },
  ],
  'jsx-a11y/label-has-for': [ERROR, { 'components': ['label'], 'allowChildren': true }],
  'no-await-in-loop': OFF,
  'no-constant-condition': ERROR,
  'no-return-await': OFF,
  'prefer-arrow-callback': OFF,
  'react-hooks/exhaustive-deps': ERROR,
  'react-hooks/rules-of-hooks': ERROR,
  'react/destructuring-assignment': OFF,
  'react/prefer-exact-props': OFF,
  'react/prop-types': OFF, // Already covered by TypeScript
  'react/jsx-filename-extension': OFF,
  'react/jsx-fragments': [ERROR, 'element'],
  'react/jsx-key': [ERROR, { 'checkFragmentShorthand': true }],
  'react/jsx-props-no-spreading': OFF,
  'react/jsx-sort-props': ERROR,
  'react/no-access-state-in-setstate': ERROR,
  'react/no-array-index-key': ERROR,
  'react/react-in-jsx-scope': OFF,
  'react/require-default-props': OFF,
  'react/sort-comp': OFF,
  'react/state-in-constructor': [ERROR, NEVER],
  'react/static-property-placement': [ERROR, 'static public field'],
  'simple-import-sort/imports': [
    ERROR,
    {
      groups: [
        // Groups are an array of arrays, and the outer array adds blank lines between groups
        [
          '^\\u0000', // side-effect imports
          // eslint-disable-next-line global-require
          `^(${require('module').builtinModules.join('|')})(/|$)`, // node builtins
          '^react',
          '^', // catch-all for other packages
          '^gestalt',
          '^\\.', // relative paths for "siblings" (e.g. ./Button)
          '^\\.\\.', // relative paths for "parents" (e.g. ../Button)
        ],
      ],
    },
  ],
  'simple-import-sort/exports': ERROR,
  'validate-jsx-nesting/no-invalid-jsx-nesting': ERROR,
};

module.exports = {
  'extends': [...baseExtends],
  'env': {
    'browser': true,
    'es6': true,
  },
  'parser': '@typescript-eslint/parser',
  'plugins': [...basePlugins, '@typescript-eslint'],
  'settings': {
    'next': {
      'rootDir': 'docs/',
    },
  },
  'rules': {
    ...baseRules,
  },
  'overrides': [
    {
      files: ['**/*.{ts,tsx}'],
      extends: [...baseExtends, 'plugin:@typescript-eslint/recommended'],
      rules: {
        ...baseRules,
        'no-shadow': 'off',
        '@typescript-eslint/no-shadow': 'error',
        '@typescript-eslint/prefer-as-const': 'off',
        '@typescript-eslint/no-this-alias': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unnecessary-type-constraint': 'off',
        '@typescript-eslint/no-loss-of-precision': 'off',
        '@typescript-eslint/no-unused-vars': [
          'error',
          { 'args': 'after-used', 'argsIgnorePattern': '^_' },
        ],
      },
    },
    {
      files: ['**/*.js'],
      extends: [...baseExtends],
      parser: '@babel/eslint-parser',
      plugins: [...basePlugins],
      rules: {
        ...baseRules,
        'no-unused-vars': [ERROR, { 'args': 'after-used', 'argsIgnorePattern': '^_' }],
      },
    },
    {
      'files': ['packages/gestalt-design-tokens/**/*.{js,ts,tsx}'],
      'rules': {
        'gestalt/only-valid-tokens': OFF,
      },
    },
    {
      'files': ['scripts/templates/*.{js,ts,tsx}'],
      'rules': {
        'import/no-unresolved': OFF,
      },
    },
    {
      'files': ['packages/gestalt-codemods/**/*.{js,ts,tsx}'],
      'rules': {
        'react/jsx-sort-props': OFF,
      },
    },
    {
      'files': ['packages/**/*.{js,ts,tsx}'],
      'rules': {
        '@next/next/no-img-element': OFF,
        'react-compiler/react-compiler': ERROR,
      },
    },
    {
      'files': ['docs/examples/**/*.{js,ts,tsx}'],
      'rules': {
        // Allows us to avoid directing the user off our docs site in examples
        'jsx-a11y/anchor-is-valid': OFF,
        '@next/next/no-img-element': OFF,
      },
    },
    {
      'files': ['**/*.test.{js,ts,tsx}'],
      'env': {
        'jest': true,
      },
      'extends': ['plugin:testing-library/react'],
      'globals': {
        'page': true,
        'browser': true,
      },
      'rules': {
        'import/no-namespace': OFF,
        'jest/expect-expect': [
          ERROR,
          { 'assertFunctionNames': ['expect', 'runInlineTest', 'runTest'] },
        ],
      },
    },
    {
      'files': ['playwright/**/*.ts', 'scripts/templates/*.spec.ts'],
      'extends': ['plugin:playwright/playwright-test'],
      'rules': {
        'playwright/missing-playwright-await': ERROR,
        'playwright/no-element-handle': ERROR,
        'playwright/no-eval': ERROR,
        'playwright/no-focused-test': ERROR,
        'playwright/no-force-option': ERROR,
        'playwright/no-page-pause': ERROR,
        'playwright/no-skipped-test': OFF, // Can be turned on when what's new is removed
        'playwright/no-wait-for-timeout': ERROR,
        'jest/expect-expect': OFF,
        'jest/no-done-callback': OFF,
        'jest/valid-expect': OFF,
      },
    },
  ],
};

```

### Core Architecture Module: `babel.config.js`
```
module.exports = {
  presets: [
    ['@babel/preset-env', { modules: process.env.NODE_ENV === 'production' ? false : 'auto' }],
    ['@babel/preset-react', { 'runtime': 'automatic' }],
    '@babel/preset-typescript',
  ],
  plugins: [
    '@babel/proposal-class-properties',
    // '@babel/transform-typescript',
    [
      process.env.NODE_ENV === 'development'
        ? '@babel/plugin-transform-react-jsx-self'
        : '@babel/plugin-transform-react-jsx',
      {
        runtime: 'automatic',
        useBuiltIns: true,
      },
    ],
  ],
};

```

### Core Architecture Module: `packages/eslint-plugin-gestalt/rollup.config.js`
```
import { relative } from 'path';
import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import typescript from '@rollup/plugin-typescript';

const rollupConfig = {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/eslint-plugin-gestalt.js',
      format: 'umd',
      name: 'eslint-plugin-gestalt',
      exports: 'named',
      sourcemap: false,
    },
    {
      file: 'dist/eslint-plugin-gestalt.es.js',
      format: 'es',
      name: 'eslint-plugin-gestalt',
      exports: 'named',
      sourcemap: false,
    },
  ],
  plugins: [
    nodeResolve(),
    replace({
      preventAssignment: true,
      values: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      },
    }),
    typescript({ tsconfig: relative(__dirname, './tsconfig.json') }),
    babel({
      babelrc: false,
      babelHelpers: 'bundled',
      presets: [['@babel/preset-env', { targets: { node: true } }], '@babel/preset-typescript'],
      plugins: ['@babel/proposal-class-properties'],
      exclude: 'node_modules/**',
    }),
    commonjs(),
  ],
};

export default rollupConfig;

```

### Core Architecture Module: `packages/eslint-plugin-gestalt/src/__fixtures__/button-icon-restrictions/invalid/invalid-renamed.tsx`
```
// @ts-nocheck
import { Button as GestaltButton } from 'gestalt';

export default function TestElement() {
  return <GestaltButton iconEnd="arrow-up" size="lg" text="Menu" />;
}

```

### Core Architecture Module: `packages/eslint-plugin-gestalt/src/__fixtures__/button-icon-restrictions/invalid/invalid-wrong-icon.tsx`
```
// @ts-nocheck
import { Button } from 'gestalt';

export default function TestElement() {
  return <Button color="white" iconEnd="arrow-up" size="lg" text="Menu" />;
}

```

### Core Architecture Module: `packages/eslint-plugin-gestalt/src/__fixtures__/button-icon-restrictions/invalid/invalid-wrong-link-role-icon.tsx`
```
// @ts-nocheck
import { Button } from 'gestalt';

export default function TestElement() {
  return <Button color="white" iconEnd="arrow-up-right" size="lg" text="Link" role="link" />;
}

```

### Core Architecture Module: `packages/eslint-plugin-gestalt/src/__fixtures__/button-icon-restrictions/valid/valid-size.tsx`
```
// @ts-nocheck
import { Button } from 'gestalt';

export default function TestElement() {
  return (
  <Box>
    <Button color="white" iconEnd="arrow-down" size="lg" text="Menu" />
    <Button role="link" iconEnd="visit" size="lg" text="link" />
  </Box>
  );
}

```

### Core Architecture Module: `packages/eslint-plugin-gestalt/src/__fixtures__/no-box-dangerous-style-duplicates/invalid/invalid-alignContent-input.tsx`
```
// @ts-nocheck
import { Box } from 'gestalt';

export default function TestElement() {
  return <Box dangerouslySetInlineStyle={{ __style: { alignContent: 'space-between' } }} />;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4094** (2025-11-21): **[Gestalt web][patch] Pog: Changed path for the Focus.css file**
  *Symptoms*: ## Pull Request Template  ### Summary  #### What changed?  This PR fixes the import path for `Focus.css` in Gestalt Web tests. The path has been updated from `./Focus.css` to `../Focus.css` to correctly reference the file location.  #### Why?  Tests in Gestalt Web were failing with an error indicating that `./Focus.css` cannot be found. This was due to an incorrect relative path that didn't account for the actual file structure. The file is located one directory level up from where the import statement was looking.  ``` [Error: ENOENT: no such file or directory, open 'gestalt/packages/gestalt/src/Pog/Focus.css'] {   errno: -2,   code: 'ENOENT',   syscall: 'open',   path: '/gestalt/packages/gestalt/src/Pog/Focus.css' } ```  By correcting this path to `../Focus.css`, the tests can now properly locate and import the Focus styles, resolving the test failures and ensuring the test suite runs successfully. This is a simple path correction that aligns the import with the actual project structure.  ### Links  - [Jira](https://pinterest.atlassian.net/browse/UXE-42)
  **Post-Mortem & Fix Analysis**:
  > @Kostya92 is attempting to deploy a commit to the **Pinterest - Subsites** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=Pinterest%20-%20Subsites&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22dcd633b55e0c6deab062fe8603f9581773f9e5e4%22%7D%2C%22id%22%3A%22QmQzKYBWKoiYVauyhRXg6q1RXUQQd69MuXAqGHZAcar1oB%22%2C%22org%22%3A%22pinterest%22%2C%22prId%22%3A4094%2C%22repo%22%3A%22gestalt%22%7D).  
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *gestalt* ready! Built [without sensitive environment variables](https://docs.netlify.com/configure-builds/environment-variables/#sensitive-variable-policy)  |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | dcd633b55e0c6deab062fe8603f9581773f9e5e4 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/gestalt/deploys/6915b9c75ab5fe00081b57c9 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-4094--gestalt.netlify.app](https://deploy-preview-4094--gestalt.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTQwOTQtLWdlc3RhbHQubmV0bGlmeS5hcHAifQ.tA46ivcpr9fLsCNZiZ46glDwi-f2bJVDjT2mezNPEg4)<br /><br />_Use your smartphone cam

- **Issue #3146** (2023-08-22): **Masonry: Allow positionStore to be externally managed**
  *Symptoms*: ### Summary  #### What changed?  This PR adds an optional `positionStore` prop to Masonry in order to allow its position cache to be externally persisted (similar to measurementStore).  #### Why?  For the two column experiment in Pinboard, it was reported that navigating _away_ from a grid and then navigating back would result in the browser freezing. I was able to repro the issue and, while I was not able to get a profile due to the browser hanging, Chrome did point to this line before crashing: https://github.com/pinterest/gestalt/blob/master/packages/gestalt/src/Masonry/defaultTwoColumnModuleLayout.js#L75  Our original thought when building out the graph was that, because we already had the measurements cached, re-generating the actual graph per render should be cheap. However, it seems this is not the case.    ### Links  - [Jira](https://jira.pinadmin.com/browse/SSP-208)  ### Checklist - Tested this by patching gestalt locally and updating Pinboard code to use an external positionStore. Verified that the issue no longer happens 
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *gestalt* ready! Built [without sensitive environment variables](https://docs.netlify.com/configure-builds/environment-variables/#sensitive-variable-policy)  |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | af8b3c4db99da84cfcc26207648f41aeb219f9b8 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/sites/gestalt/deploys/64e471dbf81ff300089c50b5 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-3146--gestalt.netlify.app](https://deploy-preview-3146--gestalt.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTMxNDYtLWdlc3RhbHQubmV0bGlmeS5hcHAifQ.rNbrA99OYTnkhr3mD8rvukSoxnSMAOwxwhsd8hdOu1Q)<br /><br />_Use your smartphone camera

- **Issue #2615** (2023-01-20): **Revert "Masonry: deprecate Item prop in favor of renderItem prop"**
  *Symptoms*: This reverts commit d41bdf7e37c38b8f4de8125880f0016033a8f450, which was accidentally merged without CI and code review 
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *gestalt* ready! Built [without sensitive environment variables](https://docs.netlify.com/configure-builds/environment-variables/#sensitive-variable-policy)  |  Name | Link | |---------------------------------|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 7d4e8a61571fd440486152f6beedd8eac095f8b5 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/sites/gestalt/deploys/63ca0d560964c60009f63104 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-2615--gestalt.netlify.app](https://deploy-preview-2615--gestalt.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTI2MTUtLWdlc3RhbHQubmV0bGlmeS5hcHAifQ.5-7-tl0uSkcgaTqBnSGtGRwh9VZRa0586_5Fe7cFptk)<br /><br

- **Issue #2400** (2022-09-19): **Revert "Popover: Add support to handle content that overflows the viewport height"**
  *Symptoms*: This reverts commit [Popover: Add support to handle content that overflows the viewport height ([#2384](https://github.com/pinterest/gestalt/pull/2384))]  This was motivated by: - https://pinterest.slack.com/archives/GG6T5UG3X/p1663601895689729 - https://pinterest.slack.com/archives/G01GN7CE99S/p1663265961230629  Bug repro: https://www.loom.com/share/50731be953b34c4e82521fc3c18d7f00 & https://www.loom.com/share/dfef5d196be5411caff4eb1b3f7b4f03
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *gestalt* ready!   |  Name | Link | |---------------------------------|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 6c416124acbfe2ed1280c7fa1a23cac4990681a3 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/sites/gestalt/deploys/6328a608ef5d41000be11e61 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-2400--gestalt.netlify.app](https://deploy-preview-2400--gestalt.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTI0MDAtLWdlc3RhbHQubmV0bGlmeS5hcHAifQ.nA62MFJpvHvGb0DrHuuo-rCSSR-fIZCd6s4Fr04jLfE)<br /><br />_Use your smartphone camera to open QR code link._</details> | ---  _To edit notification comments on pull requests, go to your [Netlify

- **Issue #1557** (2021-06-15): **Button: fix incorrect styling for disabled buttons on Safari / iOS**
  *Symptoms*: This fixes #1556 by changing the `key` value every time `disabled` is changed  Before: ![Screen Shot 2021-06-15 at 10 57 27 AM](https://user-images.githubusercontent.com/5341184/122105431-9ebb5900-cdcd-11eb-9d3d-1706631781de.png)  After: ![Screen Shot 2021-06-15 at 11 34 05 AM](https://user-images.githubusercontent.com/5341184/122105448-a4b13a00-cdcd-11eb-940f-e77d32706bdb.png) 
  **Post-Mortem & Fix Analysis**:
  > :heavy_check_mark: Deploy Preview for *gestalt* ready!   :hammer: Explore the source changes: 2ed4c649675b3efa679f782795cd64a186c2cd2c  :mag: Inspect the deploy log: [https://app.netlify.com/sites/gestalt/deploys/60c8f2c28af4bf0007a0ec40](https://app.netlify.com/sites/gestalt/deploys/60c8f2c28af4bf0007a0ec40?utm_source=github&utm_campaign=bot_dl)  :sunglasses: Browse the preview: [https://deploy-preview-1557--gestalt.netlify.app/](https://deploy-preview-1557--gestalt.netlify.app/?utm_source=github&utm_campaign=bot_dp) 
  > Taking on this bug

- **Issue #1327** (2021-01-08): **Layer: fix a bug where Layer ummounts children on rerender when zIndex changes**
  *Symptoms*: This fixes #1326.  When we pass `zIndex` indexable object and the reference is changed, the cleanup routine of `useEffect` hook, which depends on `zIndex` would be fired and would replace the entire children tree with a new one. I believe this is an oversight when we added `zIndex` support in #1223. I am fixing this bug by:  1. make sure the `useEffect` hook which appends/removes a div element only runs on mount/unmount. 2. the zIndex is handled by a separate `useEffect` after the `useEffect` hook above so that it (1) initiailizes the zIndex after the div has been created on mount, and (2) updates zIndex-related attributes of the div element whenever the value of the zIndex prop changes.  I also removed the documentation where we encourage people to avoid rerendering. Avoid rerendering should only be a perf optimization and should not be used as a semantic guarentee.
  **Post-Mortem & Fix Analysis**:
  > :heavy_check_mark: Deploy preview for *gestalt* ready!   :hammer: Explore the source changes: 89354de9c310de704cda88d0e6b140b4fe337f97  :mag: Inspect the deploy logs: [https://app.netlify.com/sites/gestalt/deploys/5ff8d09b878f3b0008f2897a](https://app.netlify.com/sites/gestalt/deploys/5ff8d09b878f3b0008f2897a?utm_source=github&utm_campaign=bot_dl)  :sunglasses: Browse the preview: [https://deploy-preview-1327--gestalt.netlify.app](https://deploy-preview-1327--gestalt.netlify.app?utm_source=github&utm_campaign=bot_dp) 
  > @chrislloyd I addressed the comments. can you please take another look?

- **Issue #1322** (2020-12-22): **Modal: fix bad flow types**
  *Symptoms*: Fix flow errors for Modal introduced in https://github.com/pinterest/gestalt/pull/1316
  **Post-Mortem & Fix Analysis**:
  > :heavy_check_mark: Deploy preview for *gestalt* ready!   :hammer: Explore the source changes: 3f74fa57f8f345cd4515dc36430ffdd9bef9b16b  :mag: Inspect the deploy logs: [https://app.netlify.com/sites/gestalt/deploys/5fe27fa9115cf800070d7b54](https://app.netlify.com/sites/gestalt/deploys/5fe27fa9115cf800070d7b54?utm_source=github&utm_campaign=bot_dl)  :sunglasses: Browse the preview: [https://deploy-preview-1322--gestalt.netlify.app](https://deploy-preview-1322--gestalt.netlify.app?utm_source=github&utm_campaign=bot_dp) 

- **Issue #1066** (2020-07-21): **Docs: fix broken CodeSandbox links**
  *Symptoms*: This PR fixes CodeSandbox links in docs, which do not work since #1058  before ![Screenshot 2020-07-21 13 37 06](https://user-images.githubusercontent.com/5341184/88104865-ed2d8c80-cb57-11ea-89bf-ba3c051fa86e.png)  after ![Screenshot 2020-07-21 13 38 05](https://user-images.githubusercontent.com/5341184/88104880-f28ad700-cb57-11ea-9dca-284a9fd4796f.png)  ## Test Plan  manually tested on localhost 
  **Post-Mortem & Fix Analysis**:
  > Deploy preview for *gestalt* ready!  Built with commit d2a38f1e95992ea51a290ebab8c0c44e3e56420d  https://deploy-preview-1066--gestalt.netlify.app

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

### Incident Patch 1: `8be1e847` (2025-04-07)
**Commit Message**: Docs: fix in redirect (#4071)

**File**: `docs/pages/foundations/international_design/icon_localization.tsx` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ Some icons might need to be removed because they don’t apply to an RTL languag
         />
         <MainSection.Subsection
           description={`
-          **[Iconography guidelines](https://gestalt.pinterest.systems/foundations/iconography/library)**
+          **[Iconography guidelines](http://pinch.pinadmin.com/iconLibrary)**
           Usage guidelines and best practices for our product icon library
           `}
         />
```

**File**: `docs/pages/foundations/international_design/rtl_guidelines/iconography.tsx` (modified, +1/-1)
```diff
@@ -415,7 +415,7 @@ representations of time. In RTL, decide whether to show circular or horizontal d
           />
           <MainSection.Subsection
             description={`
-          **[Iconography guidelines](https://gestalt.pinterest.systems/foundations/iconography/library)**
+          **[Iconography guidelines](http://pinch.pinadmin.com/iconLibrary)**
           Usage guidelines and best practices for our product icon library
           `}
           />
```

**File**: `docs/redirects.js` (modified, +1/-0)
```diff
@@ -238,6 +238,7 @@ const misc = [
   {
     source: '/foundations/iconography/library',
     destination: 'http://pinch.pinadmin.com/iconLibrary',
+    basePath: false,
     permanent: true,
   },
   {
```

**File**: `packages/gestalt/src/Accordion.tsx` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ type Props = {
    */
   dataTestId?: string;
   /**
-   * Name of icon to display in front of title. Will not be displayed if `title` is not provided. Not to be used with `badge` or `iconButton`. For a full list of icons, see [Iconography and SVGs](https://gestalt.pinterest.systems/foundations/iconography/library#Search-icon-library). See the [icon variant](https://gestalt.pinterest.systems/web/accordion#Static-Icon) for more details.
+   * Name of icon to display in front of title. Will not be displayed if `title` is not provided. Not to be used with `badge` or `iconButton`. For a full list of icons, see [Iconography and SVGs](http://pinch.pinadmin.com/iconLibrary#Search-icon-library). See the [icon variant](https://gestalt.pinterest.systems/web/accordion#Static-Icon) for more details.
    */
   icon?: keyof typeof icons;
   /**
```

**File**: `packages/gestalt/src/Icon.tsx` (modified, +2/-2)
```diff
@@ -36,7 +36,7 @@ type Props = {
   /**
    * SVG icon from the Gestalt icon library to use within Icon.
    *
-   * See the [icon library](https://gestalt.pinterest.systems/foundations/iconography/library) to explore available options.
+   * See the [icon library](http://pinch.pinadmin.com/iconLibrary) to explore available options.
    */
   icon?: keyof typeof icons;
   /**
@@ -65,7 +65,7 @@ const IconNames: ReadonlyArray<keyof typeof icons> = Object.keys(icons);
 /**
  * [Icons](https://gestalt.pinterest.systems/web/icon) are the symbolic representation of an action or information, providing visual context and improving usability.
  *
- * See the [Iconography and SVG guidelines](https://gestalt.pinterest.systems/foundations/iconography/library) to explore the full icon library.
+ * See the [Iconography and SVG guidelines](http://pinch.pinadmin.com/iconLibrary) to explore the full icon library.
  *
  * ![Icon light mode](https://raw.githubusercontent.com/pinterest/gestalt/master/playwright/visual-test/Icon-list.spec.ts-snapshots/Icon-list-chromium-darwin.png)
  * ![Icon dark mode](https://raw.githubusercontent.com/pinterest/gestalt/master/playwright/visual-test/Icon-list-dark.spec.ts-snapshots/Icon-list-dark-chromium-darwin.png)
```

---

### Incident Patch 2: `ad2f2212` (2025-04-02)
**Commit Message**: Button: Fixing docs (#4065)

**File**: `docs/pages/web/buttonsocial.tsx` (modified, +3/-0)
```diff
@@ -2,6 +2,7 @@ import { ButtonSocial } from 'gestalt';
 import AccessibilitySection from '../../docs-components/AccessibilitySection';
 import CombinationNew from '../../docs-components/CombinationNew';
 import docGen, { type DocGen } from '../../docs-components/docgen';
+import GeneratedPropTable from '../../docs-components/GeneratedPropTable';
 import MainSection from '../../docs-components/MainSection';
 import Page from '../../docs-components/Page';
 import PageHeader from '../../docs-components/PageHeader';
@@ -16,6 +17,8 @@ export default function DocsPage({ generatedDocGen }: { generatedDocGen: DocGen
         <SandpackExample code={main} hideEditor name="Main ButtonSocial example" />
       </PageHeader>
 
+      <GeneratedPropTable generatedDocGen={generatedDocGen} />
+
       <AccessibilitySection name={generatedDocGen?.displayName} />
 
       <MainSection name="Localization" />
```

**File**: `packages/gestalt/src/ButtonSocial.tsx` (modified, +3/-3)
```diff
@@ -16,7 +16,7 @@ import Text from './Text';
 import useFocusVisible from './useFocusVisible';
 import useExperimentalTheme from './utils/useExperimentalTheme';
 
-type ButtonProps = {
+type Props = {
   /**
    * Available for testing purposes, if needed. Consider [better queries](https://testing-library.com/docs/queries/about/#priority) before using this prop.
    */
@@ -44,8 +44,8 @@ type ButtonProps = {
  * ![ButtonSocial dark mode](https://raw.githubusercontent.com/pinterest/gestalt/master/playwright/visual-test/ButtonSocial-dark.spec.ts-snapshots/ButtonSocial-dark-chromium-darwin.png)
  */
 
-const ButtonSocialWithForwardRef = forwardRef<HTMLButtonElement, ButtonProps>(function ButtonSocial(
-  { dataTestId, onClick, type, service },
+const ButtonSocialWithForwardRef = forwardRef<HTMLButtonElement, Props>(function ButtonSocial(
+  { dataTestId, onClick, type, service }: Props,
   ref,
 ) {
   const innerRef = useRef<null | HTMLButtonElement>(null);
```

---

### Incident Patch 3: `dde572ba` (2025-04-01)
**Commit Message**: Masonry: Add unit test to verify the overlap bug on dynamic heights v2 is fixed (#4017)

**File**: `packages/gestalt/src/Masonry/dynamicHeightsUtils.test.ts` (modified, +101/-0)
```diff
@@ -494,4 +494,105 @@ describe('dynamic heights on masonry', () => {
       expect(newPos).toEqual(expectedPos[index]);
     });
   });
+
+  test('item height increases more than next item height, should not cause an overlap when there is a multi-column affected', () => {
+    const measurementStore = new MeasurementStore<Record<any, any>, number>();
+    const positionCache = new MeasurementStore<Record<any, any>, Position>();
+    const items: readonly [Item, Item, ...Item[]] = [
+      { 'name': 'Pin 0', 'height': 250, 'color': '#EAE6CA' },
+      { 'name': 'Pin 1', 'height': 150, 'color': '#AEA04B' },
+      { 'name': 'Pin 2', 'height': 400, 'color': '#C51D34' },
+      { 'name': 'Pin 3', 'height': 200, 'color': '#063971' },
+      { 'name': 'Pin 4', 'height': 250, 'color': '#7F7679' },
+      { 'name': 'Pin 5', 'height': 250, 'color': '#CDA434' },
+      { 'name': 'Pin 6', 'height': 200, 'color': '#FF2301' },
+      { 'name': 'Pin 7', 'height': 400, 'color': '#F44611' },
+      { 'name': 'Pin 8', 'height': 450, 'color': '#D0D0D0' },
+      { 'name': 'Pin 9', 'height': 150, 'color': '#A52019', columnSpan: 3 },
+      { 'name': 'Pin 10', 'height': 350, 'color': '#CF3476' },
+      { 'name': 'Pin 11', 'height': 400, 'color': '#474B4E' },
+      { 'name': 'Pin 12', 'height': 250, 'color': '#F6F6F6' },
+      { 'name': 'Pin 13', 'height': 315, 'color': '#2F4538' },
+      { 'name': 'Pin 14', 'height': 255, 'color': '#D84B20' },
+    ];
+    items.forEach((item: any) => {
+      measurementStore.set(item, item.height);
+    });
+
+    const layout = defaultLayout({
+      gutter,
+      columnWidth: 236,
+      align: 'start',
+      measurementCache: measurementStore,
+      positionCache,
+      layout: 'basic',
+      minCols: 5,
+      rawItemCount: items.length,
+      width: 236 * 5,
+      _getColumnSpanConfig: getColumnSpanConfig,
+      originalItems: items,
+    });
+
+    const positions = layout(items);
+
+    const expectedOriginalPos = [
+      { top: 0, left: 0, width: 236, height: 250 },
+      { top: 0, left: 236, width: 236, height: 150 },
+      { top: 0, left: 472, width: 236, height: 400 },
+      { top: 0, left: 708, width: 236, height: 200 },
+      { top: 0, left: 944, width: 236, height: 250 },
+      { top: 150, left: 236, width: 236, height: 250 },
+      { top: 200, left: 708, width: 236, height: 200 },
+      { top: 250, left: 0, width: 236, height: 400 },
+      { top: 250, left: 944, width: 236, height: 450 },
+      { top: 400, left: 236, width: 708, height: 150 },
+      { top: 550, left: 236, width: 236, height: 350 },
+      { top: 550, left: 472, width: 236, height: 400 },
+      { top: 550, left: 708, width: 236, height: 250 },
+      { top: 650, left: 0, width: 236, height: 315 },
+      { top: 700, left: 944, width: 236, height: 255 },
+    ];
+
+    items.forEach((_, index) => {
+      const originalPos = positions[index]!;
+      expect(originalPos).toEqual(expectedOriginalPos[index]);
+    });
+
+    const changedItemIndex = 3; // Pin 3
+    const heightDelta = 400;
+    const itemHeight = items[changedItemIndex]!.height;
+    const changedItemIndexNewHeight = itemHeight + heightDelta;
+
+    recalcHeights({
+      items,
+      changedItem: items[changedItemIndex],
+      newHeight: changedItemIndexNewHeight,
+      positionStore: positionCache,
+      measurementStore,
+      gutter,
+    });
+
+    const expectedPos = [
+      { top: 0, left: 0, width: 236, height: 250 },
+      { top: 0, left: 236, width: 236, height: 150 },
+      { top: 0, left: 472, width: 236, height: 400 },
+      { top: 0, left: 708, width: 236, height: 600 },
+      { top: 0, left: 944, width: 236, height: 250 },
+      { top: 150, left: 236, width: 236, height: 250 },
+      { top: 600, left: 708, width: 236, height: 200 },
+      { top: 250, left: 0, width: 236, height: 400 },
+      { top: 250, left: 944, width: 236, height: 450 },
+      { top: 800, left: 236, width: 708, height: 150 },
+      { top: 950,
```

---

### Incident Patch 4: `58400b7b` (2025-04-01)
**Commit Message**: Internal: fixing codemods (#4061)

**File**: `package.json` (modified, +3/-2)
```diff
@@ -74,7 +74,8 @@
     "jest": "28.0.3",
     "jest-environment-jsdom": "^28.0.2",
     "jest-fail-on-console": "^2.4.2",
-    "jscodeshift": "^0.11.0",
+    "jscodeshift": "^17.3.0",
+    "jscodeshift-helper": "^1.0.0",
     "lint-staged": "^10.4.0",
     "lottie-react": "^2.3.1",
     "netlify-cli": "^7.1.0",
@@ -103,7 +104,7 @@
   "resolutions": {
     "ansi-regex": "5.0.1",
     "bl": "4.0.3",
-    "browserslist": "4.16.5",
+    "browserslist": "4.24.4",
     "cssnano": "6.0.3",
     "css-select": "4.1.3",
     "glob-parent": "5.1.2",
```

**File**: `packages/gestalt-codemods/generic-codemods/entry.sh` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ if [[ $# -eq 0 ]]; then
   exit 0
 fi
 
-yarn jscodeshift --ignore-pattern=**/node_modules/** --ignore-pattern=build/** --parser=tsx -t="${DIR}"/"${1}".ts "${@:2}"
+yarn jscodeshift --ignore-pattern=**/node_modules/** --ignore-pattern=build/** --extensions=tsx --parser=tsx -t="${DIR}"/"${1}".ts "${@:2}"
 modified_files=$(git diff --relative --name-only -- '**/*.tsx' | xargs)
 if [ -n "${modified_files}" ]; then
   yarn prettier --write "$(git diff --relative --name-only -- '**/*.tsx' | xargs)"
```

**File**: `packages/gestalt-codemods/generic-codemods/utils.ts` (modified, +14/-2)
```diff
@@ -118,6 +118,16 @@ const checkComponentName = ({
       nodepath.parentPath.parentPath.value.name?.property?.name === subcomponentName
     : nodepath.parentPath.parentPath.value.name?.name === componentName;
 
+const getNumericString = (value: string) => {
+  let newValue = value;
+
+  if (value.startsWith('_')) {
+    newValue = value.replace('_', '');
+  }
+
+  return newValue;
+};
+
 /**
  * filterJSXByAttribute: Returns a collection containing the Gestalt JSX components with matching prop/value attributes
  */
@@ -137,8 +147,10 @@ const filterJSXByAttribute = ({
   value?: string | number | boolean;
 }): Collection => {
   if (typeof value === 'string') {
+    const newValue = getNumericString(value);
+
     return jSXCollection
-      .find(j.JSXAttribute, { name: { name: prop }, value: { value } })
+      .find(j.JSXAttribute, { name: { name: prop }, value: { value: newValue } })
       .filter((nodepath) => checkComponentName({ nodepath, componentName, subcomponentName }));
   }
 
@@ -199,7 +211,7 @@ const buildAttributeFromValue = ({
 }) => {
   switch (typeof value) {
     case 'string':
-      return j.jsxAttribute(j.jsxIdentifier(prop), j.stringLiteral(value));
+      return j.jsxAttribute(j.jsxIdentifier(prop), j.stringLiteral(getNumericString(value)));
     case 'number':
       return j.jsxAttribute(
         j.jsxIdentifier(prop),
```

**File**: `yarn.lock` (modified, +320/-350)
```diff
@@ -107,14 +107,6 @@
     "@babel/highlight" "^7.24.7"
     picocolors "^1.0.0"
 
-"@babel/code-frame@^7.25.7":
-  version "7.25.7"
-  resolved "https://registry.yarnpkg.com/@babel/code-frame/-/code-frame-7.25.7.tgz#438f2c524071531d643c6f0188e1e28f130cebc7"
-  integrity sha512-0xZJFNE5XMpENsgfHYTw8FbX4kv53mFLn2i3XPoq69LyhYSCBJtitaHx9QnsVTrsogI4Z3+HtEfZ2/GFPOtf5g==
-  dependencies:
-    "@babel/highlight" "^7.25.7"
-    picocolors "^1.0.0"
-
 "@babel/code-frame@^7.26.2":
   version "7.26.2"
   resolved "https://registry.yarnpkg.com/@babel/code-frame/-/code-frame-7.26.2.tgz#4b5fab97d33338eff916235055f0ebc21e573a85"
@@ -158,31 +150,10 @@
   resolved "https://registry.yarnpkg.com/@babel/compat-data/-/compat-data-7.24.7.tgz#d23bbea508c3883ba8251fb4164982c36ea577ed"
   integrity sha512-qJzAIcv03PyaWqxRgO4mSU3lihncDT296vnyuE2O8uA4w3UHWI4S3hgeZd1L8W1Bft40w9JxJ2b412iDUFFRhw==
 
-"@babel/compat-data@^7.25.7":
-  version "7.25.7"
-  resolved "https://registry.yarnpkg.com/@babel/compat-data/-/compat-data-7.25.7.tgz#b8479fe0018ef0ac87b6b7a5c6916fcd67ae2c9c"
-  integrity sha512-9ickoLz+hcXCeh7jrcin+/SLWm+GkxE2kTvoYyp38p4WkdFXfQJxDFGWp/YHjiKLPx06z2A7W8XKuqbReXDzsw==
-
-"@babel/core@^7.1.6":
-  version "7.25.7"
-  resolved "https://registry.yarnpkg.com/@babel/core/-/core-7.25.7.tgz#1b3d144157575daf132a3bc80b2b18e6e3ca6ece"
-  integrity sha512-yJ474Zv3cwiSOO9nXJuqzvwEeM+chDuQ8GJirw+pZ91sCGCyOZ3dJkVE09fTV0VEVzXyLWhh3G/AolYTPX7Mow==
-  dependencies:
-    "@ampproject/remapping" "^2.2.0"
-    "@babel/code-frame" "^7.25.7"
-    "@babel/generator" "^7.25.7"
-    "@babel/helper-compilation-targets" "^7.25.7"
-    "@babel/helper-module-transforms" "^7.25.7"
-    "@babel/helpers" "^7.25.7"
-    "@babel/parser" "^7.25.7"
-    "@babel/template" "^7.25.7"
-    "@babel/traverse" "^7.25.7"
-    "@babel/types" "^7.25.7"
-    convert-source-map "^2.0.0"
-    debug "^4.1.0"
-    gensync "^1.0.0-beta.2"
-    json5 "^2.2.3"
-    semver "^6.3.1"
+"@babel/compat-data@^7.26.8":
+  version "7.26.8"
+  resolved "https://registry.yarnpkg.com/@babel/compat-data/-/compat-data-7.26.8.tgz#821c1d35641c355284d4a870b8a4a7b0c141e367"
+  integrity sha512-oH5UPLMWR3L2wEFLnFJ1TZXqHufiTKAiLfqw5zkhS4dKXLJ10yVztfil/twG8EDTA4F/tvVNw9nOl4ZMslB8rQ==
 
 "@babel/core@^7.11.4":
   version "7.11.6"
@@ -311,6 +282,27 @@
     json5 "^2.2.3"
     semver "^6.3.1"
 
+"@babel/core@^7.24.7":
+  version "7.26.10"
+  resolved "https://registry.yarnpkg.com/@babel/core/-/core-7.26.10.tgz#5c876f83c8c4dcb233ee4b670c0606f2ac3000f9"
+  integrity sha512-vMqyb7XCDMPvJFFOaT9kxtiRh42GwlZEg1/uIgtZshS5a/8OaduUfCi7kynKgc3Tw/6Uo2D+db9qBttghhmxwQ==
+  dependencies:
+    "@ampproject/remapping" "^2.2.0"
+    "@babel/code-frame" "^7.26.2"
+    "@babel/generator" "^7.26.10"
+    "@babel/helper-compilation-targets" "^7.26.5"
+    "@babel/helper-module-transforms" "^7.26.0"
+    "@babel/helpers" "^7.26.10"
+    "@babel/parser" "^7.26.10"
+    "@babel/template" "^7.26.9"
+    "@babel/traverse" "^7.26.10"
+    "@babel/types" "^7.26.10"
+    convert-source-map "^2.0.0"
+    debug "^4.1.0"
+    gensync "^1.0.0-beta.2"
+    json5 "^2.2.3"
+    semver "^6.3.1"
+
 "@babel/eslint-parser@^7.17.0":
   version "7.17.0"
   resolved "https://registry.npmjs.org/@babel/eslint-parser/-/eslint-parser-7.17.0.tgz"
@@ -386,12 +378,13 @@
     "@jridgewell/trace-mapping" "^0.3.25"
     jsesc "^2.5.1"
 
-"@babel/generator@^7.25.7":
-  version "7.25.7"
-  resolved "https://registry.yarnpkg.com/@babel/generator/-/generator-7.25.7.tgz#de86acbeb975a3e11ee92dd52223e6b03b479c56"
-  integrity sha512-5Dqpl5fyV9pIAD62yK9P7fcA768uVPUyrQmqpqstHWgMma4feF1x/oFysBCVZLY5wJ2GkMUCdsNDnGZrPoR6rA==
+"@babel/generator@^7.26.10", "@babel/generator@^7.27.0":
+  version "7.27.0"
+  resolved "https://registry.yarnpkg.com/@babel/generator/-/generator-7.27.0.tgz#764382b5392e5b9aff93cadb190d0745866cbc2c"
+  integrity sha512-VybsKvpiN1gU1sdMZIp7FcqphVVKEwcuj02x73uvcHE0PTihx1nlBcowYWhDwjpoAXRv43+gDzyggGnn1XZhVw==
   dependencies:
-    "@babel/types" "^7.25.7"
+    "@
```

---

### Incident Patch 5: `75563fea` (2025-03-31)
**Commit Message**: Internal: fixes dark mode adding DesignTokensProvider (#4059)

**File**: `docs/pages/integration-test/masonry.tsx` (modified, +29/-27)
```diff
@@ -1,7 +1,7 @@
 import { ReactElement, useEffect, useState } from 'react';
 import LazyHydrate from 'react-lazy-hydration';
 import { useRouter } from 'next/router';
-import { ColorSchemeProvider, Masonry, MasonryV2 } from 'gestalt';
+import { ColorSchemeProvider, DesignTokensProvider, Masonry, MasonryV2 } from 'gestalt';
 import generateExampleItems from '../../integration-test-helpers/masonry/items-utils/generateExampleItems';
 import generateMultiColumnExampleItems from '../../integration-test-helpers/masonry/items-utils/generateMultiColumnExampleItems';
 import generateRealisticExampleItems from '../../integration-test-helpers/masonry/items-utils/generateRealisticExampleItems';
@@ -146,32 +146,34 @@ export default function TestPage({
 
   return (
     <ColorSchemeProvider colorScheme={darkModeValue ? 'dark' : 'light'}>
-      <MaybeLazyHydrate ssrOnly={ssrOnly}>
-        <MasonryContainer
-          constrained={constrainedValue}
-          dynamicHeights={dynamicHeightsValue}
-          dynamicHeightsV2={dynamicHeightsV2Value}
-          externalCache={externalCacheValue}
-          finiteLength={finiteLengthValue}
-          flexible={flexibleValue}
-          initialItems={getInitialItems()}
-          logWhitespace={logWhitespaceValue}
-          manualFetch={manualFetchValue}
-          MasonryComponent={experimentalValue ? MasonryV2 : Masonry}
-          measurementStore={measurementStore}
-          multiColPositionAlgoV2={multiColPositionAlgoV2Value}
-          multiColTest={multiColTestValue}
-          noScroll={noScrollValue}
-          offsetTop={offsetTopValue}
-          pinHeightsSample={realisticPinHeightsValue ? pinHeightsSample : undefined}
-          positionStore={positionStore}
-          scrollContainer={scrollContainerValue}
-          twoColItems={twoColItemsValue}
-          virtualBoundsBottom={virtualBoundsBottomValue}
-          virtualBoundsTop={virtualBoundsTopValue}
-          virtualize={virtualizeValue}
-        />
-      </MaybeLazyHydrate>
+      <DesignTokensProvider>
+        <MaybeLazyHydrate ssrOnly={ssrOnly}>
+          <MasonryContainer
+            constrained={constrainedValue}
+            dynamicHeights={dynamicHeightsValue}
+            dynamicHeightsV2={dynamicHeightsV2Value}
+            externalCache={externalCacheValue}
+            finiteLength={finiteLengthValue}
+            flexible={flexibleValue}
+            initialItems={getInitialItems()}
+            logWhitespace={logWhitespaceValue}
+            manualFetch={manualFetchValue}
+            MasonryComponent={experimentalValue ? MasonryV2 : Masonry}
+            measurementStore={measurementStore}
+            multiColPositionAlgoV2={multiColPositionAlgoV2Value}
+            multiColTest={multiColTestValue}
+            noScroll={noScrollValue}
+            offsetTop={offsetTopValue}
+            pinHeightsSample={realisticPinHeightsValue ? pinHeightsSample : undefined}
+            positionStore={positionStore}
+            scrollContainer={scrollContainerValue}
+            twoColItems={twoColItemsValue}
+            virtualBoundsBottom={virtualBoundsBottomValue}
+            virtualBoundsTop={virtualBoundsTopValue}
+            virtualize={virtualizeValue}
+          />
+        </MaybeLazyHydrate>
+      </DesignTokensProvider>
     </ColorSchemeProvider>
   );
 }
```

**File**: `docs/pages/visual-test/Accordion-dark.tsx` (modified, +4/-2)
```diff
@@ -1,10 +1,12 @@
-import { ColorSchemeProvider } from 'gestalt';
+import { ColorSchemeProvider, DesignTokensProvider } from 'gestalt';
 import ModuleVisualTest from './Accordion';
 
 export default function Screenshot() {
   return (
     <ColorSchemeProvider colorScheme="dark">
-      <ModuleVisualTest />
+      <DesignTokensProvider>
+        <ModuleVisualTest />
+      </DesignTokensProvider>
     </ColorSchemeProvider>
   );
 }
```

**File**: `docs/pages/visual-test/ActivationCard-dark.tsx` (modified, +33/-31)
```diff
@@ -1,39 +1,41 @@
-import { ActivationCard, Box, ColorSchemeProvider, Flex } from 'gestalt';
+import { ActivationCard, Box, ColorSchemeProvider, DesignTokensProvider, Flex } from 'gestalt';
 
 export default function Snapshot() {
   return (
     <ColorSchemeProvider colorScheme="dark">
-      <Box color="default" display="inlineBlock" padding={1}>
-        <Flex
-          direction="column"
-          gap={{
-            row: 0,
-            column: 2,
-          }}
-        >
-          <ActivationCard
-            dismissButton={{
-              accessibilityLabel: 'Dismiss card',
-              onDismiss: () => {},
+      <DesignTokensProvider>
+        <Box color="default" display="inlineBlock" padding={1}>
+          <Flex
+            direction="column"
+            gap={{
+              row: 0,
+              column: 2,
             }}
-            link={{
-              accessibilityLabel: 'Learn more about tag health',
-              href: 'https://pinterest.com',
-              label: 'Learn more',
-            }}
-            message="Oops! Your tag must be healthy to continue."
-            status="needsAttention"
-            statusMessage="Needs attention"
-            title="Tag is unhealthy"
-          />
-          <ActivationCard
-            message="Tag is installed and healthy"
-            status="complete"
-            statusMessage="Completed"
-            title="Nice work"
-          />
-        </Flex>
-      </Box>
+          >
+            <ActivationCard
+              dismissButton={{
+                accessibilityLabel: 'Dismiss card',
+                onDismiss: () => {},
+              }}
+              link={{
+                accessibilityLabel: 'Learn more about tag health',
+                href: 'https://pinterest.com',
+                label: 'Learn more',
+              }}
+              message="Oops! Your tag must be healthy to continue."
+              status="needsAttention"
+              statusMessage="Needs attention"
+              title="Tag is unhealthy"
+            />
+            <ActivationCard
+              message="Tag is installed and healthy"
+              status="complete"
+              statusMessage="Completed"
+              title="Nice work"
+            />
+          </Flex>
+        </Box>
+      </DesignTokensProvider>
     </ColorSchemeProvider>
   );
 }
```

**File**: `docs/pages/visual-test/Avatar-dark.tsx` (modified, +11/-9)
```diff
@@ -1,16 +1,18 @@
-import { Avatar, Box, ColorSchemeProvider } from 'gestalt';
+import { Avatar, Box, ColorSchemeProvider, DesignTokensProvider } from 'gestalt';
 
 export default function Snapshot() {
   return (
     <ColorSchemeProvider colorScheme="dark">
-      <Box color="default" display="inlineBlock" padding={1}>
-        <Avatar
-          name="Keerthi"
-          size="xl"
-          src="https://i.pinimg.com/originals/bf/bc/27/bfbc27685d81eb9a8f65c201ea661f0e.jpg"
-          verified
-        />
-      </Box>
+      <DesignTokensProvider>
+        <Box color="default" display="inlineBlock" padding={1}>
+          <Avatar
+            name="Keerthi"
+            size="xl"
+            src="https://i.pinimg.com/originals/bf/bc/27/bfbc27685d81eb9a8f65c201ea661f0e.jpg"
+            verified
+          />
+        </Box>
+      </DesignTokensProvider>
     </ColorSchemeProvider>
   );
 }
```

**File**: `docs/pages/visual-test/AvatarGroup-dark.tsx` (modified, +23/-21)
```diff
@@ -1,28 +1,30 @@
-import { AvatarGroup, Box, ColorSchemeProvider } from 'gestalt';
+import { AvatarGroup, Box, ColorSchemeProvider, DesignTokensProvider } from 'gestalt';
 
 export default function Snapshot() {
   return (
     <ColorSchemeProvider colorScheme="dark">
-      <Box color="default" display="inlineBlock" padding={1}>
-        <AvatarGroup
-          accessibilityLabel="Collaborators: Keerthi, Alberto, Shanice."
-          collaborators={[
-            {
-              name: 'Keerthi',
-              src: 'https://i.pinimg.com/originals/bf/bc/27/bfbc27685d81eb9a8f65c201ea661f0e.jpg',
-            },
-            {
-              name: 'Alberto',
-              src: 'https://i.pinimg.com/originals/c5/5c/ac/c55caca43a7c16766215ec165b649c1c.jpg',
-            },
-            {
-              name: 'Shanice',
-              src: 'https://i.pinimg.com/originals/ab/c5/4a/abc54abd85df131e90ca6b372368b738.jpg',
-            },
-          ]}
-          size="md"
-        />
-      </Box>
+      <DesignTokensProvider>
+        <Box color="default" display="inlineBlock" padding={1}>
+          <AvatarGroup
+            accessibilityLabel="Collaborators: Keerthi, Alberto, Shanice."
+            collaborators={[
+              {
+                name: 'Keerthi',
+                src: 'https://i.pinimg.com/originals/bf/bc/27/bfbc27685d81eb9a8f65c201ea661f0e.jpg',
+              },
+              {
+                name: 'Alberto',
+                src: 'https://i.pinimg.com/originals/c5/5c/ac/c55caca43a7c16766215ec165b649c1c.jpg',
+              },
+              {
+                name: 'Shanice',
+                src: 'https://i.pinimg.com/originals/ab/c5/4a/abc54abd85df131e90ca6b372368b738.jpg',
+              },
+            ]}
+            size="md"
+          />
+        </Box>
+      </DesignTokensProvider>
     </ColorSchemeProvider>
   );
 }
```

---

### Incident Patch 6: `2a389c7d` (2025-03-27)
**Commit Message**: Masonry: Fix the props on Masonry V2 (#4052)

**File**: `packages/gestalt/src/MasonryV2.tsx` (modified, +6/-0)
```diff
@@ -176,6 +176,10 @@ type Props<T> = {
    * This is an experimental prop and may be removed or changed in the future
    */
   _earlyBailout?: (columnSpan: number) => number;
+  /**
+   * Experimental flag to enable new multi column position layout algorithm
+   */
+  _multiColPositionAlgoV2?: boolean;
 };
 
 type MasonryRef = {
@@ -674,6 +678,7 @@ function Masonry<T>(
     _dynamicHeights,
     _dynamicHeightsV2Experiment,
     _earlyBailout,
+    _multiColPositionAlgoV2,
   }: Props<T>,
   ref:
     | {
@@ -826,6 +831,7 @@ function Masonry<T>(
     _getColumnSpanConfig,
     _getResponsiveModuleConfigForSecondItem,
     _earlyBailout,
+    _multiColPositionAlgoV2,
   });
   useEffect(() => {
     maxHeightRef.current = height;
```

---

### Incident Patch 7: `1470d23e` (2025-03-24)
**Commit Message**: Masonry: Fix scroll position glitch on load (#4045)

**File**: `packages/gestalt/src/Masonry.tsx` (modified, +4/-1)
```diff
@@ -296,6 +296,8 @@ export default class Masonry<T> extends ReactComponent<Props<T>, State<T>> {
 
   scrollContainer: ScrollContainer | null | undefined;
 
+  maxHeight: number = 0;
+
   /**
    * Delays resize handling in case the scroll container is still being resized.
    */
@@ -691,8 +693,9 @@ export default class Masonry<T> extends ReactComponent<Props<T>, State<T>> {
       const measuringPositions = getPositions(itemsToMeasure);
       // Math.max() === -Infinity when there are no positions
       const height = positions.length
-        ? Math.max(...positions.map((pos) => pos.top + pos.height))
+        ? Math.max(...positions.map((pos) => pos.top + pos.height), this.maxHeight)
         : 0;
+      if (height > this.maxHeight || !positions.length) this.maxHeight = height;
 
       gridBody = (
         <div ref={this.setGridWrapperRef} style={{ width: '100%' }}>
```

**File**: `packages/gestalt/src/MasonryV2.tsx` (modified, +12/-1)
```diff
@@ -381,6 +381,7 @@ function useLayout<T>({
   minCols,
   positionStore,
   width,
+  maxHeight,
   heightUpdateTrigger,
   _logTwoColWhitespace,
   _measureAll,
@@ -398,6 +399,7 @@ function useLayout<T>({
   minCols: number;
   positionStore: Cache<T, Position>;
   width: number | null | undefined;
+  maxHeight: number;
   heightUpdateTrigger: number;
   _logTwoColWhitespace?: (
     additionalWhitespace: ReadonlyArray<number>,
@@ -505,7 +507,10 @@ function useLayout<T>({
 
   // Math.max() === -Infinity when there are no positions
   const height = positions.length
-    ? Math.max(...positions.map((pos) => (pos && pos.top >= 0 ? pos.top + pos.height : 0)))
+    ? Math.max(
+        ...positions.map((pos) => (pos && pos.top >= 0 ? pos.top + pos.height : 0)),
+        maxHeight,
+      )
     : 0;
 
   return {
@@ -798,6 +803,8 @@ function Masonry<T>(
     ],
   );
 
+  const maxHeightRef = useRef(0);
+
   const { hasPendingMeasurements, height, positions, updateMeasurement } = useLayout<T>({
     align,
     columnWidth,
@@ -808,6 +815,7 @@ function Masonry<T>(
     minCols,
     positionStore,
     width,
+    maxHeight: maxHeightRef.current,
     heightUpdateTrigger,
     _logTwoColWhitespace,
     _measureAll,
@@ -816,6 +824,9 @@ function Masonry<T>(
     _getResponsiveModuleConfigForSecondItem,
     _earlyBailout,
   });
+  useEffect(() => {
+    maxHeightRef.current = height;
+  }, [height]);
 
   useFetchOnScroll({
     containerHeight,
```

---

### Incident Patch 8: `3cae45f5` (2025-03-21)
**Commit Message**: SearchField: fix rtl in VR bug (#4047)

**File**: `packages/gestalt/src/SearchField/VRSearchField.css` (modified, +3/-3)
```diff
@@ -116,7 +116,7 @@
 }
 
 html[dir="rtl"] .md_inputStartPadding {
-  padding-left: calc(
+  padding-right: calc(
     var(--sema-space-300) + var(--sema-space-200) + var(--sema-space-400) -
       var(--sema-space-25)
   );
@@ -190,7 +190,7 @@ html:not([dir="rtl"]) .md_endClearButtonWrapper {
   right: calc(var(--sema-space-300) - var(--sema-space-150));
 }
 
-html[dir="rtl"] .md_ClearButtonWrapper {
+html[dir="rtl"] .md_endClearButtonWrapper {
   left: calc(var(--sema-space-300) - var(--sema-space-150));
 }
 
@@ -298,6 +298,6 @@ html:not([dir="rtl"]) .lg_endClearButtonWrapper {
   right: calc(var(--sema-space-400) - var(--sema-space-150));
 }
 
-html[dir="rtl"] .lg_ClearButtonWrapper {
+html[dir="rtl"] .lg_endClearButtonWrapper {
   left: calc(var(--sema-space-400) - var(--sema-space-150));
 }
```

---

### Incident Patch 9: `68fcd7ac` (2025-03-19)
**Commit Message**: RadioGroup: fix in CSS file for width (#4046)

**File**: `packages/gestalt/src/RadioGroupButton.css` (modified, +2/-2)
```diff
@@ -41,11 +41,11 @@
 }
 
 .BorderCheckedSm {
-  border-width: "6px";
+  border-width: 6px;
 }
 
 .BorderCheckedMd {
-  border-width: "8px";
+  border-width: 8px;
 }
 
 .BorderSelected {
```

---

### Incident Patch 10: `f4446ccb` (2025-03-19)
**Commit Message**: Internal: [Snyk] Security upgrade react-cookie from 4.1.1 to 8.0.1 (#4044)

Co-authored-by: snyk-bot <snyk-bot@snyk.io>

**File**: `docs/package.json` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@
     "next": "^12.3.0",
     "next-mdx-remote": "^4.0.2",
     "react": "^18.1.0",
-    "react-cookie": "^4.1.1",
+    "react-cookie": "^8.0.1",
     "react-dom": "^18.1.0",
     "react-live": "^3.0.0",
     "remark-breaks": "^3.0.2",
```

#### Recent Merged Pull Requests:
- **PR #4109** (2026-08-06): Docs: Remove Google Analytics [SUB-14846] (@SandroAugusto)
- **PR #4101** (2026-01-07): Docs: Add DocSearch transformData prop (@Tlcardoso2)
- **PR #4100** (2025-12-09): Docs: Update Banner component styling with design tokens (@kostya-gromov)
- **PR #4099** (closed): Bump node-forge from 1.3.1 to 1.3.2 (@dependabot[bot])
- **PR #4098** (2025-11-22): Docs: GlobalEventsHandlerProvider work around (@jroeckle)
- **PR #4097** (2025-11-21): Docs: Remove root to home redirect (@jroeckle)
- **PR #4096** (closed): Docs: Enabled legacy banner content [UXE-229] (@jroeckle)
- **PR #4095** (2025-11-21): Docs: Re-enable legacy banner button for Gestalt 2.0 [UXE-229] (@rondevera)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
