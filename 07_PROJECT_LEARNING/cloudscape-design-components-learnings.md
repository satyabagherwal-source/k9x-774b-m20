# Forensic Learning Record (Deep Inspection): cloudscape-design/components

> **Canonical Artifact**: `07_PROJECT_LEARNING/cloudscape-design-components-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cloudscape-design/components](https://github.com/cloudscape-design/components))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:18:58.114Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cloudscape-design/components`
- **Description**: React components for Cloudscape Design System
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2653 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `eslint.config.mjs`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { includeIgnoreFile } from '@eslint/compat';
import eslint from '@eslint/js';
import headerPlugin from '@tony.ganchev/eslint-plugin-header';
import jestPlugin from 'eslint-plugin-jest';
import noUnsanitizedPlugin from 'eslint-plugin-no-unsanitized';
import eslintPrettier from 'eslint-plugin-prettier/recommended';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import simpleImportSortPlugin from 'eslint-plugin-simple-import-sort';
import unicornPlugin from 'eslint-plugin-unicorn';
import globals from 'globals';
import path from 'node:path';
import tsEslint from 'typescript-eslint';

import cloudscapeCommonRules from '@cloudscape-design/build-tools/eslint/index.js';

import cloudscapeComponentsRules from './build-tools/eslint/index.js';

export default tsEslint.config(
  includeIgnoreFile(path.resolve('.gitignore')),
  {
    // this code does not run, only used as a text content
    ignores: ['pages/code-editor/samples/**'],
  },
  {
    settings: {
      react: { version: 'detect' },
    },
  },
  eslint.configs.recommended,
  tsEslint.configs.recommended,
  noUnsanitizedPlugin.configs.recommended,
  reactPlugin.configs.flat.recommended,
  reactHooksPlugin.configs['recommended-latest'],
  eslintPrettier,
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSortPlugin,
      '@cloudscape-design/components': cloudscapeComponentsRules,
      '@cloudscape-design/build-tools': cloudscapeCommonRules,
      unicorn: unicornPlugin,
      header: headerPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-expressions': ['error', { allowTernary: true }],
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': 'allow-with-description' }],
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-explicit-any': 'off',
      'react/display-name': 'off',
      'react/no-danger': 'error',
      'react/no-unstable-nested-components': ['error', { allowAsProps: true }],
      'react/prop-types': 'off',
      'react/jsx-boolean-value': ['error', 'always'],
      '@cloudscape-design/build-tools/react-server-components-directive': 'error',
      '@cloudscape-design/build-tools/ban-files': [
        'error',
        [
          {
            pattern: './src/index.ts',
            message: "Disallowed import '{{ path }}' in favor of having smaller bundle sizes.",
          },
          {
            pattern: './src/*/index.tsx',
            message:
              "Disallowed import '{{ path }}'. Use the internal component for composition or the interface directly.",
          },
          {
            pattern: './src/*/index.js',
            message:
              "Disallowed import '{{ path }}'. Use the internal component for composition or the interface directly.",
          },
          {
            pattern: './src/i18n/{index,provider}.tsx',
            message:
              "Disallowed import '{{ path }}'. This raises the minimum TypeScript requirements of the current file.",
          },
        ],
      ],
      '@cloudscape-design/components/prefer-live-region': 'warn',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
      ],
      'react-hooks/exhaustive-deps': [
        'error',
        {
          additionalHooks: '(useContainerQuery|useContainerBreakpoints|useEffectOnUpdate)',
        },
      ],
      'unicorn/filename-case': 'error',
      curly: 'error',
      'dot-notation': 'error',
      eqeqeq: 'error',
      'no-return-await': 'error',
      'prefer-object-spread': 'error',
      'require-await': 'error',
      'header/header': [
        'error',
        {
          header: {
            commentType: 'line',
            lines: [
              ' Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.',
              ' SPDX-License-Identifier: Apache-2.0',
            ],
          },
          leadingComments: {
            comments: [
              {
                commentType: 'block',
                lines: ['*', ' * @jest-environment node', ' '],
              },
            ],
          },
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'BinaryExpression[operator="in"][left.type="Literal"]',
          message: 'Prefer a type guard function with `keyof` instead of raw `in` checks.',
        },
      ],
      'no-warning-comments': 'warn',
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // External packages come first.
            ['^react', '^(?!@cloudscape)@?\\w'],
            // Cloudscape packages.
            ['^@cloudscape'],
            // Things that start with a letter (or digit or underscore), or `~` followed by a letter.
            ['^~\\w'],
            // Anything not matched in another group.
            ['^'],
            // Styles come last.
            ['^.+\\.?(css)$', '^.+\\.?(css.js)$', '^.+\\.?(scss)$', '^.+\\.?(selectors.js)$'],
          ],
        },
      ],
      '@cloudscape-design/components/no-legacy-tokens': 'error',
      '@cloudscape-design/build-tools/no-internal-in-public-interfaces': 'error',
    },
  },
  {
    files: ['.github/**', 'build-tools/**', 'scripts/**', 'pages/webpack.*', 'jest.*.js', 'gulpfile.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.commonjs,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['src/**'],
    ignores: ['**/__tests__/**', '**/__integ__/**', '**/__motion__/**', '**/__a11y__/**', 'src/internal/vendor/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['lodash', 'lodash/*'],
              message: 'lodash is a commonjs module, which breaks webpack esm optimizations.',
            },
            {
              group: ['d3-scale', '!**/vendor/d3-scale'],
              message:
                '`d3-scale` gets shipped as a bundled dependency. Use `src/internal/vendor/d3-scale` as import source.',
            },
            {
              group: ['react-virtual', '!**/vendor/react-virtual'],
              message:
                '`react-virtual` gets shipped as a bundled dependency. Use `src/internal/vendor/react-virtual` as import source.',
            },
            {
              group: ['date-fns/*'],
              message:
                "Disallowed import '{{ path }}'. These imports are not allowed because are not specified as package exports in date-fns package.json.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/__tests__/**', '**/__integ__/**', '**/__motion__/**', '**/__a11y__/**'],
    ...jestPlugin.configs['flat/recommended'],
    rules: {
      ...jestPlugin.configs['flat/recommended'].rules,
      'jest/no-conditional-expect': 'off',
      'jest/no-standalone-expect': 'off',
      'jest/expect-expect': 'off',
    },
  },
  {
    files: ['src/test-utils/dom/**/*.ts'],
    rules: {
      '@cloudscape-design/build-tools/ban-files': [
        'error',
        [
          {
            pattern: './src/test-utils/dom/index.*s',
            message:
              "Do not import from the augmented ElementWrapper barrel '{{ path }}'. Use @cloudscape-design/test-utils-core/dom instead.",
          },
        ],
      ],
    },
  },
  {
    files: ['**/__integ__/**', '**/__motion__/**', '**/__a11y__/**', 'test/definitions/**'],
    rules: {
      // useBrowser is not a hook
     
```

### Core Architecture Module: `gulpfile.js`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const { series, parallel, watch } = require('gulp');
const {
  clean,
  docs,
  styleDocs,
  generateEnvironment,
  generateIcons,
  generateIndexFile,
  generateCustomCssPropertiesMap,
  packageJSON,
  unit,
  styles,
  typescript,
  buildPages,
  testUtils,
  a11y,
  generateI18nMessages,
  integ,
  motion,
  copyFiles,
  themeableSource,
  bundleVendorFiles,
  sizeLimit,
  testDefinitions,
} = require('./build-tools/tasks');

const quickBuild = series(
  clean,
  parallel(packageJSON, generateI18nMessages, generateEnvironment, generateIcons, generateIndexFile, copyFiles),
  parallel(generateCustomCssPropertiesMap, styles, typescript, testUtils),
  bundleVendorFiles
);

exports.clean = clean;
exports['quick-build'] = quickBuild;
exports.i18n = generateI18nMessages;
exports.build = series(quickBuild, parallel(buildPages, themeableSource, docs, styleDocs, sizeLimit, testDefinitions));
exports['build:test-definitions'] = testDefinitions;
exports.test = series(unit, integ, a11y);
exports['test:unit'] = unit;
exports['test:integ'] = integ;
exports['test:a11y'] = a11y;
exports['test:motion'] = motion;

exports.watch = () => {
  watch(
    [
      'src/**/*.{ts,tsx}',
      '!src/test-utils/**/*.ts',
      '!**/__tests__/**',
      '!**/__integ__/**',
      '!**/__a11y__/**',
      '!**/__motion__/**',
      '!src/internal/vendor/**/*.ts',
    ],
    typescript
  );
  watch(['src/i18n/messages/*.json'], generateI18nMessages);
  watch(['src/test-utils/dom/**/*.ts', '!src/test-utils/dom/index.ts'], testUtils);
  watch(['style-dictionary/**/*.ts', 'src/**/*.scss'], styles);
};

```

### Core Architecture Module: `jest.integ.config.js`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const path = require('path');
const os = require('os');

module.exports = {
  verbose: true,
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.integ.json',
      },
    ],
  },
  reporters: ['default', 'github-actions'],
  testTimeout: 60_000, // 1min
  maxWorkers: os.cpus().length * (process.env.GITHUB_ACTION ? 3 : 1),
  globalSetup: '<rootDir>/build-tools/integ/global-setup.js',
  globalTeardown: '<rootDir>/build-tools/integ/global-teardown.js',
  setupFilesAfterEnv: [path.join(__dirname, 'build-tools', 'integ', 'setup.integ.js')],
  moduleFileExtensions: ['js', 'ts'],
  testRegex: '(/(__integ__|__a11y__)/.*(\\.|/)test)\\.[jt]sx?$',
};

```

### Core Architecture Module: `jest.motion.config.js`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const path = require('path');
const integConfig = require('./jest.integ.config');

module.exports = {
  ...integConfig,
  setupFilesAfterEnv: [path.join(__dirname, 'build-tools', 'integ', 'setup.motion.js')],
  testRegex: '(/(__motion__)/.*(\\.|/)test)\\.[jt]sx?$',
};

```

### Core Architecture Module: `jest.unit.config.js`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const path = require('path');
const cloudscapePreset = require('@cloudscape-design/jest-preset/jest-preset');
const mergePresets = require('@cloudscape-design/jest-preset/merge');

module.exports = mergePresets(cloudscapePreset, {
  verbose: true,
  testEnvironment: 'jsdom',
  reporters: ['default', 'github-actions'],
  collectCoverage: process.env.CI === 'true',
  coveragePathIgnorePatterns: [
    '__tests__',
    '__integ__',
    '/design-tokens/',
    '/node_modules/',
    'styles.css.js$',
    'styles.scoped.css$',
    'styles.selectors.js$',
    'icons.js$',
    'environment.js$',
    '/internal\\/vendor/',
    '<rootDir>/pages',
    'test-utils/selectors',
  ],
  coverageThreshold: {
    global: {
      branches: 82,
      functions: 88,
      lines: 90,
      statements: 90,
    },
  },
  transform: {
    '(?!node_modules).*/lib/(components|design-tokens)/.*\\.js$': require.resolve(
      '@cloudscape-design/jest-preset/js-transformer'
    ),
    '(?!node_modules).*/lib/components/.*\\.css$': require.resolve('@cloudscape-design/jest-preset/css-transformer'),
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.unit.json',
      },
    ],
  },
  setupFilesAfterEnv: [path.join(__dirname, 'build-tools', 'jest', 'setup.js')],
  testRegex: '(/__tests__/.*(\\.|/)test)\\.[jt]sx?$',
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json', 'd.ts'],
});

```

### Core Architecture Module: `jest.visual.config.js`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const path = require('path');
const os = require('os');

module.exports = {
  verbose: true,
  testEnvironment: 'allure-jest/node',
  testEnvironmentOptions: {
    resultsDir: 'allure-results',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.visual.json',
      },
    ],
  },
  reporters: ['default', 'github-actions'],
  testTimeout: 240_000, // 4min — pages can be tall and slow to capture
  maxWorkers: os.cpus().length * (process.env.GITHUB_ACTION ? 3 : 1),
  globalSetup: '<rootDir>/build-tools/visual/global-setup.js',
  globalTeardown: '<rootDir>/build-tools/visual/global-teardown.js',
  setupFilesAfterEnv: [path.join(__dirname, 'build-tools', 'visual', 'setup.js')],
  moduleFileExtensions: ['js', 'ts'],
  testMatch: ['<rootDir>/test/visual/**/*.test.ts'],
};

```

### Core Architecture Module: `pages/action-card/common.tsx`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import React from 'react';

import { Box, Icon } from '~components';

export const shortHeader = 'Card header';
export const longHeader =
  'A very long header text that should wrap to multiple lines to test the layout behavior of the action card component';

export const shortDescription = 'A description of the action card';
export const longDescription =
  'A very long description text that should wrap to multiple lines to test the layout behavior of the action card component when content overflows';

export const shortContent = 'Card content';
export const longContent =
  'Very long content that should wrap to multiple lines to test the layout behavior of the action card component when the content area has a lot of text';

export const icon = <Icon name="angle-right" />;

export const reactNodeContent = (
  <Box padding="xs">
    <span>This is a React Node</span>
  </Box>
);

export const onClick = () => {};

```

### Core Architecture Module: `pages/action-card/link.page.tsx`
```
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import * as React from 'react';

import { ActionCard, Icon, SpaceBetween } from '~components';

import { SimplePage } from '../app/templates';

export default function ActionCardLinkPage() {
  const [lastFollowed, setLastFollowed] = React.useState<string | null>(null);

  return (
    <SimplePage title="Action Card link page" screenshotArea={{}}>
      <SpaceBetween size="l">
        <div>Last followed: {lastFollowed ?? 'None'}</div>

        <div style={{ maxInlineSize: '400px' }}>
          <SpaceBetween size="m">
            <ActionCard
              header={<b>Navigates with href</b>}
              description="Renders as an anchor element"
              href="#in-page"
              icon={<Icon name="angle-right" />}
              onFollow={event => {
                event.preventDefault();
                setLastFollowed('Header card');
              }}
            />

            <ActionCard
              ariaLabel="Standalone link card"
              href="#standalone"
              icon={<Icon name="angle-right" />}
              iconVerticalAlignment="center"
              onFollow={event => {
                event.preventDefault();
                setLastFollowed('Standalone card');
              }}
            >
              Standalone link card
            </ActionCard>

            <ActionCard
              header={<b>External link (new tab)</b>}
              description="Opens in a new tab"
              href="https://cloudscape.design/"
              target="_blank"
              icon={<Icon name="external" />}
            />

            <ActionCard
              header={<b>Disabled link</b>}
              description="href is removed when disabled"
              href="#disabled"
              disabled={true}
            />
          </SpaceBetween>
        </div>
      </SpaceBetween>
    </SimplePage>
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5058** (2026-09-28): **New 1**
  *Symptoms*: ### Describe the bug  _No response_  ### Code of Conduct  - [x] I agree to follow this project's [Code of Conduct](https://github.com/cloudscape-design/components/blob/main/CODE_OF_CONDUCT.md) - [x] I checked the [current issues](https://github.com/cloudscape-design/components/issues) for duplicate requests

- **Issue #4905** (2026-09-02): **[Bug]: Published CSS contains 30-50 duplicate license headers per file (26% of CSS bytes)**
  *Symptoms*: ### Browser  _No response_  ### Package version  v3.0.1345  ### React version  _No response_  ### Description  Every stylesheet published in `lib/components` contains the Apache license comment repeated 30-50 times.  Measured on a local `npm run build` of `c4816f9f1`:  | ---------------- | -------------------------------------------------------- | | stylesheets      | 227                                                      | | total CSS        | 2269 KB                                                  | | license comments | 598 KB (**26.4%**)                                       | | blocks per file  | median 35, max 51 (`file-token-group/styles.scoped.css`) |  Example: `popover/styles.scoped.css` is 27,483 bytes and holds 43 copies of the same 4-line comment.  ### Cause  318 of the 319 `.scss` files in `src/` open with a loud CSS comment (`/* ... */`) rather than a Sass silent comment (`// ...`). Sass preserves loud comments, and `theming-build` compiles with `style: 'expanded'`, so every module a `styles.scss` entry point transitively `@use`s contributes its header to that entry's output. `src/popover/styles.scss` loads 25+ modules, hence 43 headers. Most of those modules emit no CSS rules at all: for files like `src/internal/styles/typography/constants.scss` the header is the module's entire contribution to the compiled output.  ### Impact  Minifiers drop the comments, so the impact on end users is zero for apps that have a proper build pipeline.  Where this really hurts 
  **Post-Mortem & Fix Analysis**:
  > I've sent over a pair of PRs to fix this:  * https://github.com/cloudscape-design/build-tools/pull/75 (needs to land first) * https://github.com/cloudscape-design/components/pull/4906 (draft, will publish once the first PR is merged)
  > Hey Trevor,  Thanks for contributing! Our team will take a look at the proposed changes.

- **Issue #4551** (2026-06-08): **[Bug]: allowSkipTo doesn't enable navigation to immediately-next step when current step is optional**
  *Symptoms*: ### Browser  Safari  ### Package version  3.0.1011  ### React version  18.2.0  ### Description  - canSkip(fromIndex, toIndex) returns false when fromIndex >= toIndex (line: if (fromIndex >= toIndex) return false) - When on step N-1 targeting step N, it calls canSkip(N, N) which hits this guard - The fallback only allows it if the target is isOptional, but the target being mandatory shouldn't prevent navigation when the current step is optional - This creates inconsistency: Step 4 is clickable from Steps 1 and 2 (via intermediate optional checks) but not from Step 3 (the step right before it) - Expected: If I can skip to Step 4 from Step 1 (because Steps 2/3 are optional), I should also be able to skip to Step 4 from Step 3 (since the current step is optional and there are no intermediates to block) - Workaround: Mark the target step as isOptional: true, but this adds an unwanted "- optional" label  ### Source code  _No response_  ### Reproduction  _No response_  ### Code of Conduct  - [x] I agree to follow this project's [Code of Conduct](https://github.com/cloudscape-design/components/blob/main/CODE_OF_CONDUCT.md) - [x] I checked the [current issues](https://github.com/cloudscape-design/components/issues) for duplicate problems
  **Post-Mortem & Fix Analysis**:
  > Hey, Thanks for submitting this bug report.  I was able to reproduce the bug. Can you verify that this is what you mean (see video below)?  Best regards,  Simon
  > https://github.com/user-attachments/assets/82628e2b-5053-4242-b384-68f618539c10
  > Hello, Yes, this is exactly it. Please do look into it as this is a component in our production console. Thanks for the quick repro!

- **Issue #4440** (2026-05-04): **[Bug]: `Box` with `awsui-inline-code` variant should support relative font sizing**
  *Symptoms*: ### Browser  _No response_  ### Package version  latest  ### React version  _No response_  ### Description  # `Box` with `awsui-inline-code` variant should support relative font sizing  ## Description  The `awsui-inline-code` variant on `Box` hardcodes `font-size: 12px` (via `--font-size-body-s`). This means inline code inside headings, headers, or any large-text context renders at body-text size instead of scaling with its parent.  The `fontSize` prop only accepts predefined sizes (`body-s`, `body-m`, `heading-xs`, etc.) — there's no way to set `inherit` or a relative value like `85%` without resorting to `nativeAttributes`.  ## Example  ```tsx import { Box, Header } from "@cloudscape-design/components";  <Header variant="h1">   OpenSearch Schema Mapping for <Box variant="awsui-inline-code">getBookings</Box> API </Header> ```  <img width="923" height="150" alt="Image" src="https://github.com/user-attachments/assets/30af1c89-11a6-4e80-95b1-a6afb70c9a6d" />  **Expected:** The inline code `getBookings` scales with the h1 heading size.  **Actual:** `getBookings` renders at 12px while the rest of the heading is much larger.  ## Current workaround  ```tsx <Box   variant="awsui-inline-code"   nativeAttributes={{ style: { fontSize: "85%" } }} >   getBookings </Box> ```  ## Suggestion  Either:  1. Add `"inherit"` as a valid `fontSize` option on `Box` 2. Make the `awsui-inline-code` variant use a relative font size (e.g. `0.85em`) by default so it scales with its context   ### Source 
  **Post-Mortem & Fix Analysis**:
  > Hi, thanks for reaching out!                                                                                                                                                                                                                                                                                                                                                                                                              One option that might work well here is using the `fontSize` property on the Box component. Setting it one step below the heading size, for example `heading-l` for an h1, can give you a more proportionate inline code size:                                                                                                                                                                                                   ```tsx <Header variant="h1">   OpenSearch Schema Mapping for <Box fontSize="heading-l" variant="awsui-inline-code">getBookings</Box> API </Header> ``` Hope t

- **Issue #4411** (2026-05-07): **[Bug]: Text in read-only date range picker is unselectable**
  *Symptoms*: ### Browser  _No response_  ### Package version  v3.0.1267  ### React version  v19.2.3  ### Description  I'm displaying a date range using a `DateRangePicker` with `readOnly={true}`:  <img width="452" height="52" alt="Image" src="https://github.com/user-attachments/assets/1d233fc1-1bd7-4d67-9b6f-108eda2cfba5" />  When I do this, the text shown in the widget is unselectable by the user. This is perhaps expected for a `disabled` component, but not for a `readOnly` one. It's a usability issue, and potentially an accessibility issue as well.  ### Source code  _No response_  ### Reproduction  _No response_  ### Code of Conduct  - [x] I agree to follow this project's [Code of Conduct](https://github.com/cloudscape-design/components/blob/main/CODE_OF_CONDUCT.md) - [x] I checked the [current issues](https://github.com/cloudscape-design/components/issues) for duplicate problems
  **Post-Mortem & Fix Analysis**:
  > Hey Trevor,  Thanks for reporting! The issue looks valid, our team is working on it now.
  > Update: just saw your PR, thanks for contributing! ❤️ 
  > Hi @TrevorBurnham , thanks again for the contribution. Note that I have submitted a couple of comments in the PR.

- **Issue #4357** (2026-03-24): **[Bug]: PanelLayout overflow content is hidden when display is set to panel-only**
  *Symptoms*: ### Browser  _No response_  ### Package version  latest  ### React version  _No response_  ### Description  ### Steps to reproduce this issue  Open https://cloudscape.design/components/panel-layout/?tabId=playground, set `display` to `panel-only` and `panelContent` to   ``` <table style={{width: 3000, borderCollapse: "collapse" }}>     <thead>         <tr>             {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (             <th key={i} style={{border: "1px solid #ccc" , padding: "8px 16px" , whiteSpace: "nowrap" }}>                 Column {i}             </th>             ))}         </tr>     </thead>     <tbody>         {[1,2,3].map(row => (         <tr key={row}>             {[1,2,3,4,5,6,7,8,9,10,11,12].map(col => (             <td key={col} style={{border: "1px solid #ccc" , padding: "8px 16px" , whiteSpace: "nowrap" }}>                 Row {row}, Cell {col}             </td>             ))}         </tr>         ))}     </tbody> </table> ```  <img width="1397" height="491" alt="Image" src="https://github.com/user-attachments/assets/d3ae9210-9212-432a-993e-cc4280bb24f8" />  ### Source code  _No response_  ### Reproduction  _No response_  ### Code of Conduct  - [x] I agree to follow this project's [Code of Conduct](https://github.com/cloudscape-design/components/blob/main/CODE_OF_CONDUCT.md) - [x] I checked the [current issues](https://github.com/cloudscape-design/components/issues) for duplicate problems
  **Post-Mortem & Fix Analysis**:
  > Hi Zhang,  Thank you for creating the bug report and providing steps to reproduce the issue! Cloudscape team is now working on the fix.

- **Issue #4264** (2026-03-02): **[Bug]: Rollup error - "validateProps" is not exported**
  *Symptoms*: ### Browser  _No response_  ### Package version  3.0.1204  ### React version  19.1.0  ### Description  I am building a TS library that provides reusable react components that use CloudScape components. I am bundling this library with TSUP. The library itself builds without issues. However, if I am using this library in another project, I am getting an error when running yarn build:  ``` x Build failed in 16.76s error during build: node_modules/@cloudscape-design/components/alert/index.js (7:9): "validateProps" is not exported by "node_modules/@cloudscape-design/components/node_modules/@cloudscape-design/component-toolkit/internal/index.js", imported by "node_modules/@cloudscape-design/components/alert/index.js". file: /myproject/node_modules/@cloudscape-design/components/alert/index.js:7:9  5: import CoreComponent from './internal-do-not-use-core'; 6: import { applyDisplayName } from '../internal/utils/apply-display-name'; 7: import { validateProps } from '@cloudscape-design/component-toolkit/internal';             ^      at getRollupError (file:///myproject/node_modules/rollup/dist/es/shared/parseAst.js:401:41)     at error (file:///myproject/node_modules/rollup/dist/es/shared/parseAst.js:397:42)     at Module.error (file:///myproject/node_modules/rollup/dist/es/shared/node-entry.js:16875:16)     at Module.traceVariable (file:///myproject/node_modules/rollup/dist/es/shared/node-entry.js:17327:29)     at ModuleScope.findVariable (file:///myproject/node_modules/rollup/dist/es/
  **Post-Mortem & Fix Analysis**:
  > Hey, Thanks for creating this bug report. Could you share the version of `@cloudscape-design/component-toolkit` that gets installed as a peer dependency of `@cloudscape-design/components`?  I checked the latest component-toolkit version whether`validateProps` is being exported and this seems to be the case. You can validate this here: `node_modules/@cloudscape-design/component-toolkit/internal/index.js`.  From your error logs: `node_modules/@cloudscape-design/components/node_modules/@cloudscape-design/component-toolkit/internal/index.js` This line lets me suspect there could be a problem in how the paths are being resolved in tsup. This should be `node_modules/@cloudscape-design/component-toolkit/internal/index.js` instead because component-toolkit and components should live in the same node_modules folder.
  > Could you possibly share a minimum setup example repository with your configuration where this error occurs? 
  > Hi @SpyZzey , thanks for the quick response!  The version where this occurs is "@cloudscape-design/component-toolkit": "^1.0.0-beta.138"  Do you indicate this is fixed in newer versions?  I cannot see `validateProps` being exported in that index.js, neither in "1.0.0-beta.111" nor in "1.0.0-beta.138".  I will try to come up with a minimum example over the weekend, but not sure how much effort it is.  Thanks!

- **Issue #4236** (2026-03-12): **[Bug]: resizableColumns: dynamically added columns ignore minWidth, fall back to DEFAULT_COLUMN_WIDTH**
  *Symptoms*: ### Browser  Chrome  ### Package version  v3.0.0 (@amzn/awsui-components-console)  ### React version  v19.2.3  ### Description  When using `resizableColumns` on a `<Table>`, columns that are dynamically added to `columnDefinitions` (e.g. swapping visible columns based on a filter/toggle) do not respect their `minWidth`. They are instead assigned `DEFAULT_COLUMN_WIDTH` (120px).  The issue is in [`use-column-widths.tsx` L171](https://github.com/cloudscape-design/components/blob/9a1b7c5bf8e597df72f40a152f58bee9d09d2ac8/src/table/use-column-widths.tsx#L171):  ```ts newColumnWidths.set(column.id, column.width || DEFAULT_COLUMN_WIDTH); ```  This only checks `column.width` and ignores `column.minWidth`. A column defined with `{ minWidth: 250 }` but no explicit `width` will get 120px when dynamically added.  The initial render handles this correctly in `readWidths` ([L28-L41](https://github.com/cloudscape-design/components/blob/9a1b7c5bf8e597df72f40a152f58bee9d09d2ac8/src/table/use-column-widths.tsx#L28-L41)) by doing `Math.max(width, minWidth)`, but the dynamic column path does not.  ### Expected behavior  Dynamically added columns should respect `minWidth`, consistent with the initial render behavior. The fix would be something like:  ```ts const minWidth = column.minWidth || column.width || DEFAULT_COLUMN_WIDTH; newColumnWidths.set(column.id, Math.max(column.width || DEFAULT_COLUMN_WIDTH, minWidth)); ```  ### Workaround  Set an explicit `width` equal to `minWidth` on affected colu
  **Post-Mortem & Fix Analysis**:
  > Hello Miles,  Thank you for reporting that, the issue seems valid.  I see that there is already a contribution request open for it: https://github.com/cloudscape-design/components/pull/4241. Our team is evaluating it now.

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

### Incident Patch 1: `818f03b7` (2026-09-28)
**Commit Message**: fix: Degrade gracefully instead of crashing on malformed locale messages (#5052)

**File**: `src/i18n/__tests__/i18n.test.tsx` (modified, +76/-0)
```diff
@@ -6,10 +6,17 @@ import { render } from '@testing-library/react';
 import * as IntlMessageFormat from 'intl-messageformat';
 import range from 'lodash/range';
 
+import { warnOnce } from '@cloudscape-design/component-toolkit/internal';
+
 import { I18nProvider, I18nProviderProps } from '../../../lib/components/i18n';
 import { namespace } from '../../../lib/components/i18n/context';
 import { MESSAGES, TestComponent } from './test-component';
 
+jest.mock('@cloudscape-design/component-toolkit/internal', () => ({
+  ...jest.requireActual('@cloudscape-design/component-toolkit/internal'),
+  warnOnce: jest.fn(),
+}));
+
 afterEach(() => {
   jest.restoreAllMocks();
 });
@@ -176,3 +183,72 @@ it('initializes an IntlMessageFormat instance once per message per render', () =
   );
   expect(constructorSpy).toHaveBeenCalledTimes(8);
 });
+
+describe('resilience against malformed messages', () => {
+  // AWSUI-62316: a message with a stale variable contract used to crash the whole page.
+
+  it('renders the component tree when a message references variables the component does not provide', () => {
+    const brokenMessages: I18nProviderProps.Messages = {
+      [namespace]: {
+        en: {
+          'test-component': {
+            topLevelFunction: '{operator, select, equals {equals} other {other}} label',
+          },
+        },
+      },
+    };
+
+    const { container } = render(
+      <I18nProvider messages={[brokenMessages]} locale="en">
+        <TestComponent />
+      </I18nProvider>
+    );
+
+    // Broken message degrades to empty string; the rest of the tree still renders.
+    expect(container.querySelector('#top-level-function')).toHaveTextContent('');
+    expect(container.querySelector('#top-level-string')).toBeInTheDocument();
+    expect(warnOnce).toHaveBeenCalledWith('I18nProvider', expect.stringContaining('Failed to format message'));
+  });
+
+  it('renders the component tree when a message has invalid ICU syntax', () => {
+    const brokenMessages: I18nProviderProps.Messages = {
+      [namespace]: {
+        en: {
+          'test-component': {
+            topLevelString: 'Unclosed {argument',
+          },
+        },
+      },
+    };
+
+    const { container } = render(
+      <I18nProvider messages={[MESSAGES, brokenMessages]} locale="en">
+        <TestComponent />
+      </I18nProvider>
+    );
+
+    // Unparseable message falls back; sibling messages are unaffected.
+    expect(container.querySelector('#top-level-string')).toHaveTextContent('');
+    expect(container.querySelector('#nested-string')).toHaveTextContent('nested string');
+  });
+
+  it('renders the component tree when a message is malformed and the value is provided via props', () => {
+    const brokenMessages: I18nProviderProps.Messages = {
+      [namespace]: {
+        en: {
+          'test-component': {
+            topLevelString: 'Unclosed {argument',
+          },
+        },
+      },
+    };
+
+    const { container } = render(
+      <I18nProvider messages={[brokenMessages]} locale="en">
+        <TestComponent topLevelString="Provided string" />
+      </I18nProvider>
+    );
+
+    expect(container.querySelector('#top-level-string')).toHaveTextContent('Provided string');
+  });
+});
```

**File**: `src/i18n/utils/__tests__/i18n-formatter.test.ts` (modified, +115/-0)
```diff
@@ -1,8 +1,19 @@
 // Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 // SPDX-License-Identifier: Apache-2.0
 
+import { warnOnce } from '@cloudscape-design/component-toolkit/internal';
+
 import { I18nFormatter, I18nMessages } from '../i18n-formatter';
 
+jest.mock('@cloudscape-design/component-toolkit/internal', () => ({
+  ...jest.requireActual('@cloudscape-design/component-toolkit/internal'),
+  warnOnce: jest.fn(),
+}));
+
+afterEach(() => {
+  jest.clearAllMocks();
+});
+
 const NAMESPACE = 'test-ns';
 const COMPONENT = 'my-component';
 
@@ -59,4 +70,108 @@ describe('I18nFormatter', () => {
 
     expect(result).toBe('5 items');
   });
+
+  describe('resilience against malformed messages', () => {
+    test('does not warn for well-formed messages', () => {
+      const formatter = new I18nFormatter('en', makeMessages('en', { greeting: 'Hello, {name}' }));
+      formatter.format<string | undefined, { name: string }>(NAMESPACE, COMPONENT, 'greeting', undefined, formatFn =>
+        formatFn({ name: 'World' })
+      );
+      expect(warnOnce).not.toHaveBeenCalled();
+    });
+
+    test('returns undefined and warns when a message has invalid ICU syntax', () => {
+      const formatter = new I18nFormatter('en', makeMessages('en', { greeting: 'Hello, {name' }));
+      expect(formatter.format(NAMESPACE, COMPONENT, 'greeting', undefined)).toBeUndefined();
+      expect(warnOnce).toHaveBeenCalledWith(
+        'I18nProvider',
+        expect.stringContaining(`Malformed message "${NAMESPACE}.${COMPONENT}.greeting" for locale "en"`)
+      );
+    });
+
+    test('returns undefined and warns when a message references a variable that is not provided', () => {
+      const formatter = new I18nFormatter('en', makeMessages('en', { greeting: 'Hello, {name}' }));
+      expect(formatter.format(NAMESPACE, COMPONENT, 'greeting', undefined)).toBeUndefined();
+      expect(warnOnce).toHaveBeenCalledWith(
+        'I18nProvider',
+        expect.stringContaining(`Failed to format message "${NAMESPACE}.${COMPONENT}.greeting" for locale "en"`)
+      );
+    });
+
+    test('formatting function returns an empty string and warns when formatting with a customHandler fails', () => {
+      // AWSUI-62316: the message demands variables the component no longer provides.
+      const messages = makeMessages('en', {
+        removeLabel: 'Remove filter, {token__operator, select, equals {equals} other {other}} {token__value}',
+      });
+      const formatter = new I18nFormatter('en', messages);
+
+      const result = formatter.format<string | undefined, { token__formattedText: string }>(
+        NAMESPACE,
+        COMPONENT,
+        'removeLabel',
+        undefined,
+        formatFn => formatFn({ token__formattedText: 'Name = foo' })
+      );
+
+      expect(result).toBe('');
+      expect(warnOnce).toHaveBeenCalledWith(
+        'I18nProvider',
+        expect.stringContaining(`Failed to format message "${NAMESPACE}.${COMPONENT}.removeLabel" for locale "en"`)
+      );
+    });
+
+    test('formatting function returned by customHandler is guarded when invoked after render', () => {
+      // Parses fine, but "itemCount" isn't passed, so it throws at format time.
+      const formatter = new I18nFormatter('en', makeMessages('en', { itemCount: '{itemCount} items' }));
+
+      // formatFn is invoked later, outside the formatter's call stack. It must not throw even then.
+      const lateFormatFn = formatter.format<((count: number) => string) | undefined, { count: number }>(
+        NAMESPACE,
+        COMPONENT,
+        'itemCount',
+        undefined,
+        formatFn => count => formatFn({ count })
+      );
+
+      expect(() => lateFormatFn!(5)).not.toThrow();
+      expect(lateFormatFn!(5)).toBe('');
+      expect(warnOnce).toHaveBeenCalledWith(
+        'I18nProvider',
+        expect.stringContaining(`Failed to format message "${NAMESPACE}.${COMPONENT}.itemCount" for locale "en"`)
+      );
+    });
+
+    test(
```

**File**: `src/i18n/utils/i18n-formatter.ts` (modified, +35/-6)
```diff
@@ -4,6 +4,8 @@
 import { MessageFormatElement } from '@formatjs/icu-messageformat-parser';
 import IntlMessageFormat from 'intl-messageformat';
 
+import { warnOnce } from '@cloudscape-design/component-toolkit/internal';
+
 import { CustomHandler } from '../context';
 import { getMatchableLocales } from './locales';
 import { normalizeMessages } from './messages';
@@ -37,7 +39,7 @@ export class I18nFormatter {
   // Not memoizing it allows us to reset the cache when the component rerenders
   // with potentially different locale or messages. We expect this component to
   // be placed above AppLayout and therefore rerender very infrequently.
-  private _localeFormatterCache = new Map<string, IntlMessageFormat>();
+  private _localeFormatterCache = new Map<string, IntlMessageFormat | null>();
 
   constructor(locale: string, messages: I18nMessages) {
     this._locale = locale.toLowerCase();
@@ -62,6 +64,10 @@ export class I18nFormatter {
     let intlMessageFormat: IntlMessageFormat;
 
     const cachedFormatter = this._localeFormatterCache.get(cacheKey);
+    // A null entry means this message already failed to parse; don't retry.
+    if (cachedFormatter === null) {
+      return provided;
+    }
     if (cachedFormatter) {
       // If an IntlMessageFormat instance was cached for this locale, just use that.
       intlMessageFormat = cachedFormatter;
@@ -83,14 +89,37 @@ export class I18nFormatter {
       }
 
       // Lazily create an IntlMessageFormat object for this key.
-      intlMessageFormat = new IntlMessageFormat(message, this._locale);
-      this._localeFormatterCache.set(cacheKey, intlMessageFormat);
+      // Invalid ICU syntax falls back to the provided value instead of crashing the render.
+      try {
+        intlMessageFormat = new IntlMessageFormat(message, this._locale);
+        this._localeFormatterCache.set(cacheKey, intlMessageFormat);
+      } catch (error) {
+        warnOnce('I18nProvider', `Malformed message "${cacheKey}" for locale "${this._locale}": ${error}`);
+        this._localeFormatterCache.set(cacheKey, null);
+        return provided;
+      }
     }
 
+    // Formatting can throw at runtime (e.g. a message/component contract mismatch),
+    // so degrade gracefully instead of crashing the consumer's page.
     if (customHandler) {
-      return customHandler(args => intlMessageFormat.format(args) as string);
+      // The returned formatFn may be invoked later during render, so guard it. It must return a string.
+      return customHandler(args => {
+        try {
+          return intlMessageFormat.format(args) as string;
+        } catch (error) {
+          warnOnce('I18nProvider', `Failed to format message "${cacheKey}" for locale "${this._locale}": ${error}`);
+          return '';
+        }
+      });
+    }
+    try {
+      // Assuming `ReturnValue extends string` since a customHandler wasn't provided.
+      return intlMessageFormat.format() as ReturnValue;
+    } catch (error) {
+      warnOnce('I18nProvider', `Failed to format message "${cacheKey}" for locale "${this._locale}": ${error}`);
+      // Fall back so the component's own default string logic takes over.
+      return provided;
     }
-    // Assuming `ReturnValue extends string` since a customHandler wasn't provided.
-    return intlMessageFormat.format() as ReturnValue;
   }
 }
```

---

### Incident Patch 2: `aa76658c` (2026-09-25)
**Commit Message**: fix: Fixes table sticky columns flickering (#5044)

**File**: `src/table/sticky-columns/__tests__/use-sticky-columns.test.tsx` (modified, +41/-0)
```diff
@@ -157,6 +157,47 @@ test('generates empty sticky cell state if not enough scrollable space', () => {
   });
 });
 
+test('allows for the padding the first sticky cell gets when scrolled', () => {
+  const { result, rerender } = renderHook(() =>
+    useStickyColumns({ visibleColumns: [1, 2, 3], stickyColumnsFirst: 1, stickyColumnsLast: 0 })
+  );
+  // Sticky cell 100px + minimum scrollable space 148px + table padding 20px = 268px.
+  const { wrapper, table, cells } = createMockTable(result.current, 268, 500, 100, 200, 200);
+  table.style.paddingInlineStart = table.style.paddingInlineEnd = '10px';
+  const isEnabled = () => result.current.store.get().cellState.size > 0;
+  const setWidth = (element: HTMLElement, width: number) =>
+    jest.spyOn(element, 'getBoundingClientRect').mockImplementation(() => ({ width }) as DOMRect);
+  const scroll = () => wrapper.dispatchEvent(new UIEvent('scroll'));
+
+  // Wait for effect
+  rerender({});
+  expect(isEnabled()).toBe(false);
+
+  setWidth(wrapper, 269);
+  scroll();
+  expect(isEnabled()).toBe(true);
+
+  // Scrolling applies the padding and widens the first cell, which must not disable the feature.
+  wrapper.scrollLeft = 20;
+  scroll();
+  setWidth(cells[0], 118);
+  scroll();
+  expect(result.current.store.get().cellState.get(1)?.padInlineStart).toBe(true);
+  expect(isEnabled()).toBe(true);
+
+  // With selection the padding is set but the first cell does not grow: narrowing the wrapper while scrolled keeps
+  // the feature (100px + 124px + 20px = 244px), scrolling back disables it as the wrapper is below 268px.
+  setWidth(cells[0], 100);
+  setWidth(wrapper, 260);
+  scroll();
+  expect(isEnabled()).toBe(true);
+  wrapper.scrollLeft = 0;
+  // The first update removes the padding, the next one (any later scroll or resize) evaluates without it.
+  scroll();
+  scroll();
+  expect(isEnabled()).toBe(false);
+});
+
 test('generates non-empty styles for sticky cells', () => {
   const { result, rerender } = renderHook(() =>
     useStickyColumns({ visibleColumns: [1, 2, 3], stickyColumnsFirst: 0, stickyColumnsLast: 1 })
```

**File**: `src/table/sticky-columns/use-sticky-columns.ts` (modified, +12/-4)
```diff
@@ -20,6 +20,12 @@ import { isCellStatesEqual, isWrapperStatesEqual, updateCellOffsets } from './ut
 // We allow the table to have a minimum of 148px of available space besides the sum of the widths of the sticky columns
 // This value is an UX recommendation and is approximately 1/3 of our smallest breakpoint (465px)
 const MINIMUM_SCROLLABLE_SPACE = 148;
+// The first sticky cell gets extra padding when the table is scrolled (see padInlineStart), which is then included in
+// the measured sticky width. A lower minimum applies in that case, so that applying the padding cannot disable the
+// feature. The difference must not be smaller than the padding in any theme or density mode. Removing the padding can
+// disable the feature within a range of wrapper widths up to that difference (largest for tables with selection, where
+// the padding is set but does not change the cell width).
+const MINIMUM_SCROLLABLE_SPACE_WHILE_STUCK = MINIMUM_SCROLLABLE_SPACE - 24;
 
 export interface StickyColumnsModel {
   store: ReadonlyAsyncStore<StickyColumnsState>;
@@ -367,10 +373,12 @@ class StickyColumnsStore extends AsyncStore<StickyColumnsState> {
     }
 
     const totalStickySpace = this.cellOffsets.stickyWidthInlineStart + this.cellOffsets.stickyWidthInlineEnd;
-    const tablePaddingLeft = parseFloat(getComputedStyle(props.table).paddingLeft) || 0;
-    const tablePaddingRight = parseFloat(getComputedStyle(props.table).paddingRight) || 0;
-    const hasEnoughScrollableSpace =
-      totalStickySpace + MINIMUM_SCROLLABLE_SPACE + tablePaddingLeft + tablePaddingRight < wrapperWidth;
+    const tablePaddingInlineStart = parseFloat(getComputedStyle(props.table).paddingInlineStart) || 0;
+    const tablePaddingInlineEnd = parseFloat(getComputedStyle(props.table).paddingInlineEnd) || 0;
+    const tablePaddings = tablePaddingInlineStart + tablePaddingInlineEnd;
+    const isFirstCellPadded = this.get().cellState.get(props.visibleColumns[0])?.padInlineStart ?? false;
+    const minimumScrollableSpace = isFirstCellPadded ? MINIMUM_SCROLLABLE_SPACE_WHILE_STUCK : MINIMUM_SCROLLABLE_SPACE;
+    const hasEnoughScrollableSpace = minimumScrollableSpace < wrapperWidth - totalStickySpace - tablePaddings;
     if (!hasEnoughScrollableSpace) {
       return false;
     }
```

---

### Incident Patch 3: `6208f4ae` (2026-09-25)
**Commit Message**: fix: Migrate th locale PropertyFilter messages to current contract (#5050)

Co-authored-by: Nathnael Dereje <natidere@amazon.com>

**File**: `src/i18n/messages/all.th.json` (modified, +1/-1)
```diff
@@ -199,7 +199,7 @@
     "i18nStrings.tokenLimitShowFewer": "แสดงน้อยลง",
     "i18nStrings.tokenLimitShowMore": "แสดงเพิ่มเติม",
     "i18nStrings.valueText": "ค่า",
-    "i18nStrings.removeTokenButtonAriaLabel": "{token__operator, select, equals {ลบตัวกรอง {token__propertyLabel} เท่ากับ {token__value}} not_equals {ลบตัวกรอง {token__propertyLabel} ไม่เท่ากับ {token__value}} greater_than {ลบตัวกรอง {token__propertyLabel} มากกว่า {token__value}} greater_than_equal {ลบตัวกรอง {token__propertyLabel} มากกว่าหรือเท่ากับ {token__value}} less_than {ลบตัวกรอง {token__propertyLabel} น้อยกว่า {token__value}} less_than_equal {ลบตัวกรอง {token__propertyLabel} น้อยกว่าหรือเท่ากับ {token__value}} contains {ลบตัวกรอง {token__propertyLabel} ประกอบด้วย {token__value}} not_contains {ลบตัวกรอง {token__propertyLabel} ไม่มี {token__value}} starts_with {ลบตัวกรอง {token__propertyLabel} เริ่มต้นด้วย {token__value}} other {}}"
+    "i18nStrings.removeTokenButtonAriaLabel": "ลบตัวกรอง {token__formattedText}"
   },
   "s3-resource-selector": {
     "i18nStrings.inContextSelectPlaceholder": "เลือกเวอร์ชัน",
```

---

### Incident Patch 4: `3fb837bc` (2026-09-22)
**Commit Message**: fix: Align container header with description in One Theme (#5035)

**File**: `src/expandable-section/styles.scss` (modified, +16/-0)
```diff
@@ -30,6 +30,12 @@ $icon-offset-container: awsui.$space-xxs;
 // Useful to keep elements correctly aligned.
 $icon-total-space-normal: calc(#{$icon-width-normal} + #{$icon-margin-left} + #{$icon-margin-right-normal});
 $icon-total-space-medium: calc(#{$icon-width-medium} + #{$icon-margin-left} + #{$icon-margin-right-medium});
+// In One Theme the container caret is an x-small (12px) icon with no start margin and
+// $icon-margin-right-small as end margin (see .icon-container below), so it occupies less
+// space than the medium caret. Keep in sync with that rule and with the icon size chosen
+// in expandable-section-header.tsx.
+$icon-width-x-small: 12px;
+$icon-total-space-container-one-theme: calc(#{$icon-width-x-small} + #{$icon-margin-right-small});
 
 // Extra inline padding that widens the navigation caret pointer target to 24px (WCAG 2.5.8).
 $nav-caret-pad-normal: calc(24px - #{$icon-width-normal});
@@ -200,6 +206,9 @@ $nav-caret-pad-one-theme: 12px; // 24px minus the one-theme x-small (12px) icon
     }
     &:not(.header-deprecated) {
       padding-inline-start: calc(#{container.$header-padding-horizontal} + #{$icon-total-space-medium});
+      @include theming.one-theme-only {
+        padding-inline-start: calc(#{container.$header-padding-horizontal} + #{$icon-total-space-container-one-theme});
+      }
     }
 
     @include focus-visible.when-visible {
@@ -252,6 +261,13 @@ $nav-caret-pad-one-theme: 12px; // 24px minus the one-theme x-small (12px) icon
 
   &-container-button {
     margin-inline-start: calc(-1 * #{$icon-total-space-medium});
+    // Only when the caret is at the start. The end-icon layout resets this margin
+    // below (.header-button-icon-end) and a theme-scoped rule would outrank that reset.
+    &:not(.header-button-icon-end) {
+      @include theming.one-theme-only {
+        margin-inline-start: calc(-1 * #{$icon-total-space-container-one-theme});
+      }
+    }
   }
 
   &-container {
```

---

### Incident Patch 5: `7fbd2ff6` (2026-09-21)
**Commit Message**: chore: Report success for visual regression in the merge queue (#5036)

**File**: `.github/workflows/visual-regression-merge-queue.yml` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+name: Visual regression (merge queue)
+
+# Reports the required "Visual regression result" check on the merge-queue branch.
+# The real comparison runs on pull_request (deploy.yml); it is not run again in the merge queue.
+
+on:
+  merge_group:
+
+permissions:
+  contents: read
+
+jobs:
+  visual-regression-result:
+    name: Visual regression result
+    runs-on: ubuntu-latest
+    steps:
+      - name: Pass in merge queue
+        run: echo "Visual regression not re-run; already validated on the PR head. Marking as passed."
```

---

### Incident Patch 6: `dedd0713` (2026-09-17)
**Commit Message**: fix: Show table empty state when skeleton is enabled and load completes with no items (#5013)

**File**: `src/table/__tests__/skeleton.test.tsx` (modified, +11/-0)
```diff
@@ -49,6 +49,17 @@ describe('Table skeleton loading', () => {
       expect(rows).toHaveLength(0);
     });
 
+    test('renders the empty state when loading has finished with no items', () => {
+      const wrapper = renderTable({
+        items: [],
+        loading: false,
+        skeleton: { totalRows: 5 },
+        empty: 'No resources',
+      });
+      expect(wrapper.findAll('tr[aria-hidden="true"]')).toHaveLength(0);
+      expect(wrapper.findTable()!.findEmptySlot()!.getElement()).toHaveTextContent('No resources');
+    });
+
     test('renders a screen-reader-only loading announcement', () => {
       const wrapper = renderTable({
         items: [],
```

**File**: `src/table/internal.tsx` (modified, +1/-1)
```diff
@@ -681,7 +681,7 @@ const InternalTable = React.forwardRef(
                           colIndexOffset={colIndexOffset}
                           renderCell={skeleton?.renderCell}
                         />
-                      ) : !skeleton && (loading || allItems.length === 0) ? (
+                      ) : allItems.length === 0 || (loading && !skeleton) ? (
                         <tr>
                           <NoDataCell
                             totalColumnsCount={totalColumnsCount}
```

---

### Incident Patch 7: `ac914645` (2026-09-17)
**Commit Message**: fix: Aligns locale fallback handling in calendar and date range picker (#5017)

**File**: `src/__tests__/snapshot-tests/__snapshots__/documenter.test.ts.snap` (modified, +6/-3)
```diff
@@ -7746,7 +7746,8 @@ as you would for other form elements.",
     {
       "defaultValue": "''",
       "description": "Specifies the locale to use to render month names and determine the starting day of the week.
-If you don't provide this, the locale is determined by the page and browser locales.
+If you don't provide this, the locale is determined by the locale of the surrounding I18nProvider,
+or the page and browser locales otherwise.
 Supported values and formats are listed in the
 [JavaScript Intl API specification](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#Locale_identification_and_negotiation).",
       "name": "locale",
@@ -11416,7 +11417,8 @@ as you would for other form elements.",
     },
     {
       "description": "Specifies the locale to use to render month names and determine the starting day of the week.
-If you don't provide this, the locale is determined by the page and browser locales.
+If you don't provide this, the locale is determined by the locale of the surrounding I18nProvider,
+or the page and browser locales otherwise.
 Supported values and formats are listed in the
 [JavaScript Intl API specification](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#Locale_identification_and_negotiation).",
       "name": "locale",
@@ -12149,7 +12151,8 @@ Ensure that your function checks for missing fields in the value.",
       "defaultValue": "''",
       "description": "The locale to be used for rendering month names and defining the
 starting date of the week. If not provided, it will be determined
-from the page and browser locales. Supported values and formats
+from the locale of the surrounding I18nProvider,
+or the page and browser locales otherwise. Supported values and formats
 are as-per the [JavaScript Intl API specification](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#Locale_identification_and_negotiation).",
       "name": "locale",
       "optional": true,
```

**File**: `src/calendar/__tests__/calendar.test.tsx` (modified, +24/-0)
```diff
@@ -9,6 +9,7 @@ import MockDate from 'mockdate';
 
 import '../../__a11y__/to-validate-a11y';
 import Calendar, { CalendarProps } from '../../../lib/components/calendar';
+import TestI18nProvider from '../../../lib/components/i18n/testing';
 import { KeyCode } from '../../../lib/components/internal/keycode';
 import createWrapper, { CalendarWrapper } from '../../../lib/components/test-utils/dom';
 
@@ -99,6 +100,29 @@ describe('Calendar locale DE', () => {
   });
 });
 
+describe('Calendar I18nProvider locale', () => {
+  function renderWithProvider(props: CalendarProps = defaultProps) {
+    const { container } = render(
+      <TestI18nProvider messages={{}} locale="de-DE">
+        <Calendar {...props} />
+      </TestI18nProvider>
+    );
+    return createWrapper(container).findCalendar()!;
+  }
+
+  test('uses I18nProvider locale when no locale property is provided', () => {
+    const wrapper = renderWithProvider({ ...defaultProps, value: '2022-01-07' });
+    expect(findCalendarWeekdays(wrapper)[0]).toBe('Mo');
+    expect(wrapper.findHeader().getElement()).toHaveTextContent('Januar 2022');
+  });
+
+  test('explicit locale property takes precedence over I18nProvider locale', () => {
+    const wrapper = renderWithProvider({ ...defaultProps, value: '2022-01-07', locale: 'en-US' });
+    expect(findCalendarWeekdays(wrapper)[0]).toBe('Sun');
+    expect(wrapper.findHeader().getElement()).toHaveTextContent('January 2022');
+  });
+});
+
 describe('aria labels', () => {
   describe('aria-label', () => {
     test('can be set', () => {
```

**File**: `src/calendar/interfaces.ts` (modified, +2/-1)
```diff
@@ -29,7 +29,8 @@ export interface CalendarProps extends BaseComponentProps {
 
   /**
    * Specifies the locale to use to render month names and determine the starting day of the week.
-   * If you don't provide this, the locale is determined by the page and browser locales.
+   * If you don't provide this, the locale is determined by the locale of the surrounding I18nProvider,
+   * or the page and browser locales otherwise.
    * Supported values and formats are listed in the
    * [JavaScript Intl API specification](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#Locale_identification_and_negotiation).
    */
```

**File**: `src/calendar/internal.tsx` (modified, +3/-1)
```diff
@@ -7,6 +7,7 @@ import { addMonths, addYears, isSameDay, isSameMonth, isSameYear } from 'date-fn
 
 import { useUniqueId } from '@cloudscape-design/component-toolkit/internal';
 
+import { useLocale } from '../i18n/context.js';
 import { getBaseProps } from '../internal/base-component';
 import { fireNonCancelableEvent } from '../internal/events/index.js';
 import checkControlled from '../internal/hooks/check-controlled/index.js';
@@ -50,7 +51,8 @@ export default function Calendar({
   checkControlled('Calendar', 'value', value, 'onChange', onChange);
 
   const baseProps = getBaseProps(rest);
-  const normalizedLocale = normalizeLocale('Calendar', locale);
+  const contextLocale = useLocale();
+  const normalizedLocale = normalizeLocale('Calendar', locale || contextLocale);
 
   const gridWrapperRef = useRef<HTMLDivElement>(null);
   const [focusedDate, setFocusedDate] = useState<Date | null>(null);
```

**File**: `src/date-range-picker/__tests__/date-range-picker.test.tsx` (modified, +29/-0)
```diff
@@ -586,6 +586,35 @@ describe('Date range picker', () => {
   });
 });
 
+describe('I18nProvider locale', () => {
+  const value: DateRangePickerProps.Value = {
+    type: 'absolute',
+    startDate: '2020-03-02T05:00:00+00:00',
+    endDate: '2020-03-12T13:05:21+00:00',
+  };
+
+  function renderWithProviderLocale(props?: Partial<DateRangePickerProps>) {
+    const { container } = render(
+      <TestI18nProvider messages={{}} locale="de-DE">
+        <DateRangePicker {...defaultProps} locale={undefined} value={value} {...props} />
+      </TestI18nProvider>
+    );
+    const wrapper = createWrapper(container).findDateRangePicker()!;
+    wrapper.openDropdown();
+    return wrapper;
+  }
+
+  test('uses I18nProvider locale when no locale property is provided', () => {
+    const wrapper = renderWithProviderLocale();
+    expect(wrapper.findDropdown()!.findHeader().getElement()).toHaveTextContent('März 2020');
+  });
+
+  test('explicit locale property takes precedence over I18nProvider locale', () => {
+    const wrapper = renderWithProviderLocale({ locale: 'en-US' });
+    expect(wrapper.findDropdown()!.findHeader().getElement()).toHaveTextContent('March 2020');
+  });
+});
+
 describe('renderTriggerContent', () => {
   test('renders custom trigger content when provided', () => {
     const { wrapper } = renderDateRangePicker({
```

---

### Incident Patch 8: `3dc4191d` (2026-09-16)
**Commit Message**: chore: Add workflow to override visual regression test results (#4954)

Co-authored-by: Copilot Autofix powered by AI <175728472+Copilot@users.noreply.github.com>

**File**: `.github/workflows/deploy.yml` (modified, +53/-0)
```diff
@@ -15,6 +15,7 @@ permissions:
   id-token: write
   actions: read
   contents: read
+  statuses: read # Needed to check if the visual regression test result has been overridden
   deployments: write
 
 jobs:
@@ -135,3 +136,55 @@ jobs:
       test-utils-artifact-name: test-utils-selectors
       baseline-artifact-name: visual-baseline-pages
       caller-run-id: ${{ github.run_id }}
+      commit-sha: ${{ github.event.pull_request.head.sha }}
+
+  # Required status check for branch protection. Runs for every PR so the context
+  # is always reported.
+  #
+  # It passes when any of these hold:
+  #   - the PR is from a fork (visual regression cannot run, so it is skipped);
+  #   - the visual job succeeded;
+  #   - the commit has a maintainer override status.
+  #
+  # The override is checked directly here (not only via the visual job result) so
+  # that after an override this job can be re-run on its own to turn the check
+  # green, without rebuilding or redeploying the (unchanged) pages.
+  visual-regression-result:
+    name: Visual regression result
+    needs: [visual]
+    if: always()
+    runs-on: ubuntu-latest
+    steps:
+      - name: Evaluate result
+        env:
+          GH_TOKEN: ${{ github.token }}
+          REPO: ${{ github.repository }}
+          SHA: ${{ github.event.pull_request.head.sha }}
+          IS_FORK: ${{ github.event.pull_request.head.repo.full_name != github.repository }}
+          VISUAL_RESULT: ${{ needs.visual.result }}
+        run: |
+          if [ "$IS_FORK" = "true" ]; then
+            echo "::notice::Fork pull request: visual regression does not run. Marking as passed."
+            exit 0
+          fi
+
+          if [ "$VISUAL_RESULT" = "success" ]; then
+            echo "Visual regression passed."
+            exit 0
+          fi
+
+          if [ "$VISUAL_RESULT" = "skipped" ] || [ "$VISUAL_RESULT" = "cancelled" ]; then
+            echo "::error::Visual regression did not run (result: ${VISUAL_RESULT})."
+            exit 1
+          fi
+
+          OVERRIDDEN=$(gh api \
+            "repos/${REPO}/commits/${SHA}/status" \
+            --jq 'any(.statuses[]; .context == "visual-regression-override" and .state == "success")' 2>/dev/null || echo "false")
+          if [ "$OVERRIDDEN" = "true" ]; then
+            echo "::notice::Visual regression was overridden for this commit by a maintainer. Marking as passed."
+            exit 0
+          fi
+
+          echo "::error::Visual regression did not pass (result: ${VISUAL_RESULT}). If the differences are intentional, comment '/override-visual-regression <justification>' on the PR."
+          exit 1
```

**File**: `.github/workflows/visual-regression-override.yml` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+name: Override visual regression
+
+# Overrides the mandatory visual regression check when the visual differences are
+# intentional.
+#
+# The override is scoped to a single commit: pushing a new commit produces a new
+# SHA with no override status, so the comparison runs again.
+#
+# Two ways to trigger it:
+#   1. Comment `/override-visual-regression <justification>` on the pull request
+#      (right from the PR page). Only users with write or admin access can do this.
+#   2. Run it manually from the Actions tab, passing a commit SHA.
+
+on:
+  issue_comment:
+    types: [created]
+  workflow_dispatch:
+    inputs:
+      commit-sha:
+        description: 'The commit SHA whose visual changes are intentional.'
+        required: true
+        type: string
+
+# Run one override at a time per PR (comment) or per commit (manual dispatch).
+concurrency:
+  group: visual-regression-override@${{ github.event.issue.number || inputs.commit-sha }}
+  cancel-in-progress: true
+
+permissions:
+  statuses: write # Needed to post the override commit status
+  actions: write # Needed to re-run the deploy workflow
+  pull-requests: read # Needed to resolve PR head SHA for issue_comment overrides
+
+jobs:
+  override:
+    name: Apply visual regression override
+    # Override comments must be posted on a PR and start with the command; the trailing
+    # space requires text after it, which serves as the override justification
+    # (for example: "/override-visual-regression Expected padding changes in Container border radii").
+    # Manual runs (workflow_dispatch) skip the comment check.
+    if: >-
+      github.event_name == 'workflow_dispatch' ||
+      (github.event.issue.pull_request != null &&
+       startsWith(github.event.comment.body, '/override-visual-regression '))
+    runs-on: ubuntu-latest
+    steps:
+      - name: Authorize commenter
+        if: github.event_name == 'issue_comment'
+        env:
+          GH_TOKEN: ${{ github.token }}
+          REPO: ${{ github.repository }}
+          ACTOR: ${{ github.actor }}
+        run: |
+          PERMISSION=$(gh api "repos/${REPO}/collaborators/${ACTOR}/permission" --jq '.permission' 2>/dev/null || echo "none")
+          echo "@${ACTOR} has '${PERMISSION}' permission."
+          case "$PERMISSION" in
+            admin|write|maintain)
+              echo "Authorized." ;;
+            *)
+              echo "::error::@${ACTOR} is not authorized to override the visual regression check (requires admin, write or maintain access)."
+              exit 1 ;;
+          esac
+
+      - name: Resolve the commit SHA
+        id: resolve
+        if: success()
+        env:
+          GH_TOKEN: ${{ github.token }}
+          REPO: ${{ github.repository }}
+          EVENT_NAME: ${{ github.event_name }}
+          INPUT_SHA: ${{ inputs.commit-sha }}
+          COMMENT_PR: ${{ github.event.issue.number }}
+        run: |
+          if [ "$EVENT_NAME" = "issue_comment" ]; then
+            # Resolve the head commit of the PR the command was posted on.
+            RESOLVED=$(gh api "repos/${REPO}/pulls/${COMMENT_PR}" --jq '.head.sha')
+          else
+            # workflow_dispatch: the SHA is provided directly.
+            RESOLVED="$INPUT_SHA"
+          fi
+
+          if [ -z "$RESOLVED" ]; then
+            echo "::error::Could not resolve a commit SHA to override."
+            exit 1
+          fi
+
+          echo "Overriding visual regression for commit ${RESOLVED}."
+          echo "sha=${RESOLVED}" >> "$GITHUB_OUTPUT"
+
+      - name: Post override commit status
+        if: steps.resolve.outputs.sha != ''
+        env:
+          GH_TOKEN: ${{ github.token }}
+          REPO: ${{ github.repository }}
+          SHA: ${{ steps.resolve.outputs.sha }}
+          ACTOR: ${{ github.actor }}
+          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
+        run: |
+          gh api --method POST "repos/${REPO}/sta
```

**File**: `.github/workflows/visual-regression.yml` (modified, +42/-4)
```diff
@@ -15,6 +15,10 @@ on:
         description: 'Name of the artifact containing baseline pages (built by the caller workflow).'
         required: true
         type: string
+      commit-sha:
+        description: 'The commit SHA under test, used to check for a per-commit override.'
+        required: false
+        type: string
 
 defaults:
   run:
@@ -24,11 +28,45 @@ permissions:
   id-token: write
   contents: read
   actions: read
+  statuses: read
   deployments: write
 
 jobs:
+  # Checks whether a maintainer has explicitly approved the visual changes for
+  # this exact commit via the manual override workflow
+  # (.github/workflows/visual-regression-override.yml). The approval is a commit
+  # status posted on the head SHA, so it applies only to that commit: a new push
+  # produces a new SHA with no override and the comparison runs again.
+  check-override:
+    name: Check for commit override
+    runs-on: ubuntu-latest
+    outputs:
+      overridden: ${{ steps.status.outputs.overridden }}
+    steps:
+      - name: Look for override commit status
+        id: status
+        env:
+          GH_TOKEN: ${{ github.token }}
+          REPO: ${{ github.repository }}
+          SHA: ${{ inputs.commit-sha }}
+        run: |
+          if [ -z "$SHA" ]; then
+            echo "No commit SHA provided; treating as not overridden."
+            echo "overridden=false" >> "$GITHUB_OUTPUT"
+            exit 0
+          fi
+          OVERRIDDEN=$(gh api \
+            "repos/${REPO}/commits/${SHA}/status" \
+            --jq 'any(.statuses[]; .context == "visual-regression-override" and .state == "success")' 2>/dev/null || echo "false")
+          echo "Override status present for ${SHA}: ${OVERRIDDEN}"
+          echo "overridden=${OVERRIDDEN}" >> "$GITHUB_OUTPUT"
+
   visual:
     name: Visual regression (shard ${{ matrix.shard }})
+    needs: check-override
+    # Skip the (expensive) screenshot comparison when the changes have been
+    # explicitly overridden by a maintainer.
+    if: ${{ needs.check-override.outputs.overridden != 'true' }}
     runs-on: ubuntu-latest
     strategy:
       fail-fast: false
@@ -130,8 +168,8 @@ jobs:
 
   report:
     name: Generate Allure Report
-    if: always()
-    needs: [visual]
+    if: ${{ always() && needs.check-override.outputs.overridden != 'true' }}
+    needs: [check-override, visual]
     runs-on: ubuntu-latest
     steps:
       - name: Setup Node.js
@@ -158,8 +196,8 @@ jobs:
 
   deploy-report:
     name: Deploy Allure Report
-    if: always()
-    needs: [report]
+    if: ${{ always() && needs.check-override.outputs.overridden != 'true' }}
+    needs: [check-override, report]
     uses: cloudscape-design/actions/.github/workflows/deploy.yml@main
     secrets: inherit
     with:
```

**File**: `docs/RUNNING_TESTS.md` (modified, +25/-5)
```diff
@@ -75,14 +75,34 @@ The deploy workflow (`.github/workflows/deploy.yml`) orchestrates the full pipel
 
 The visual regression workflow (`.github/workflows/visual-regression.yml`):
 
-1. Resolves the PR deployment URL from the GitHub Deployments API.
-2. Serves the baseline pages locally.
-3. Runs the test suite sharded across multiple runners. Each test navigates to a page on both hosts, captures screenshots, and compares them pixel-by-pixel.
-4. Produces an Allure report with image diffs for any failures, deployed to a preview environment.
+1. Checks the commit for a `visual-regression-override` status (see [Overriding](#overriding-intentional-visual-changes) below).
+2. Resolves the PR deployment URL from the GitHub Deployments API.
+3. Serves the baseline pages locally.
+4. Runs the test suite sharded across multiple runners. Each test navigates to a page on both hosts, captures screenshots, and compares them pixel-by-pixel.
+5. Produces an Allure report with image diffs for any failures, deployed to a preview environment.
+6. The deploy workflow's `Visual regression result` job surfaces the pass/fail outcome as the required check.
+
+The `Visual regression result` check (from `deploy.yml`) passes when every shard passes, when the commit is overridden (see below), or for fork PRs where visual regression is skipped.
 
 ### Reviewing failures
 
-When the CI job fails, check the deployed Allure report (linked from the GitHub deployment). It shows expected vs actual vs diff images for each failing test. If the diff is expected (intentional visual change), note it in your PR description.
+When the CI job fails, check the deployed Allure report (linked from the GitHub deployment). It shows expected vs actual vs diff images for each failing test. If the diff is expected (intentional visual change), override the check as described below.
+
+### Overriding intentional visual changes
+
+Because baselines are rebuilt from `origin/main` at run time (there are no committed
+screenshots to update), an intentional visual change is approved by overriding the
+check rather than by updating snapshots.
+
+The override is **scoped to a single commit**. It approves the exact SHA you reviewed;
+pushing a new commit produces a new SHA with no override, so the comparison runs again.
+
+To override, first confirm the diffs in the Allure report are intentional, then use either method:
+
+- **From the PR page (recommended):** comment `/override-visual-regression <Reason to override>` on the pull request.
+- **From the Actions tab:** run the **Override visual regression** workflow (`.github/workflows/visual-regression-override.yml`) manually, passing the commit SHA to approve.
+
+Either way the workflow posts a `visual-regression-override` success commit status on that SHA and re-runs the deploy workflow. On the re-run, the screenshot comparison is skipped and the `Visual regression result` check passes.
 
 ### Adding tests for a new component
 
```

---

### Incident Patch 9: `e26ae03c` (2026-09-16)
**Commit Message**: chore: Add visual regression test for input inline label (#4979)

**File**: `test/definitions/visual/input.ts` (modified, +5/-0)
```diff
@@ -16,6 +16,11 @@ const suite: TestSuite = {
       path: 'input/style-permutations',
       screenshotType: 'permutations',
     },
+    {
+      description: 'Inline label permutations',
+      path: 'input/inline-label-permutations',
+      screenshotType: 'permutations',
+    },
   ],
 };
 
```

---

### Incident Patch 10: `eaee5d01` (2026-09-14)
**Commit Message**: chore: Fix border radii bug for one-theme (#5006)

**File**: `src/button-dropdown/category-elements/styles.scss` (modified, +1/-4)
```diff
@@ -60,10 +60,7 @@
       padding-inline: awsui.$space-button-horizontal;
       border-block: awsui.$border-item-width solid awsui.$color-border-dropdown-item-hover;
       border-inline: awsui.$border-item-width solid awsui.$color-border-dropdown-item-hover;
-      border-start-start-radius: awsui.$border-radius-item;
-      border-start-end-radius: awsui.$border-radius-item;
-      border-end-start-radius: awsui.$border-radius-item;
-      border-end-end-radius: awsui.$border-radius-item;
+      @include styles.logical-radius(awsui.$border-radius-dropdown);
       z-index: 2;
 
       &.no-content-styling {
```

**File**: `src/button-dropdown/item-element/styles.scss` (modified, +1/-4)
```diff
@@ -40,10 +40,7 @@
 
     background-color: awsui.$color-background-dropdown-item-hover;
     border-color: awsui.$color-border-dropdown-item-hover;
-    border-start-start-radius: awsui.$border-radius-item;
-    border-start-end-radius: awsui.$border-radius-item;
-    border-end-start-radius: awsui.$border-radius-item;
-    border-end-end-radius: awsui.$border-radius-item;
+    @include styles.logical-radius(awsui.$border-radius-dropdown);
 
     &.disabled {
       color: awsui.$color-text-dropdown-item-dimmed;
```

**File**: `src/internal/components/selectable-item/styles.scss` (modified, +2/-8)
```diff
@@ -15,13 +15,6 @@ $border-offset-double: calc(2 * #{$border-offset});
 $divider-w: awsui.$border-divider-list-width;
 $neg-divider-w: calc(-1 * #{$divider-w});
 
-@mixin logical-radius($radius) {
-  border-start-start-radius: $radius;
-  border-start-end-radius: $radius;
-  border-end-start-radius: $radius;
-  border-end-end-radius: $radius;
-}
-
 @function add-offset($value, $offset: $border-offset) {
   @return calc(#{$value} + #{$offset});
 }
@@ -133,13 +126,14 @@ $neg-divider-w: calc(-1 * #{$divider-w});
   &.highlighted,
   &.selected {
     color: var(#{custom-props.$optionColorHighlighted}, #{awsui.$color-text-dropdown-item-highlighted});
-    @include logical-radius(awsui.$border-radius-item);
+    @include styles.logical-radius(awsui.$border-radius-item);
   }
 
   &.highlighted {
     z-index: 3;
     background-color: var(#{custom-props.$optionBackgroundHighlighted}, #{awsui.$color-background-dropdown-item-hover});
     @include highlighted-shadow;
+    @include styles.logical-radius(awsui.$border-radius-dropdown);
     &.disabled {
       box-shadow: inset 0 0 0 $border-offset awsui.$color-border-dropdown-item-dimmed-hover;
       background-color: awsui.$color-background-dropdown-item-dimmed;
```

**File**: `src/internal/styles/utils/mixins.scss` (modified, +7/-0)
```diff
@@ -42,6 +42,13 @@
   text-overflow: ellipsis;
 }
 
+@mixin logical-radius($radius) {
+  border-start-start-radius: $radius;
+  border-start-end-radius: $radius;
+  border-end-start-radius: $radius;
+  border-end-end-radius: $radius;
+}
+
 @mixin base-pseudo-element {
   content: '';
   position: absolute;
```

#### Recent Merged Pull Requests:
- **PR #5083** (2026-09-30): chore: refactor motion tests to use shared sass compiler (@mxschll)
- **PR #5077** (2026-09-30): chore: Make the colorBackgroundLayoutPanelContent themeable (@at-susie)
- **PR #5076** (2026-09-29): feat: add popover component motion (@mxschll)
- **PR #5071** (2026-09-29): feat: add expandable section component motion (@mxschll)
- **PR #5069** (2026-09-29): feat: radio button component motion (@mxschll)
- **PR #5068** (2026-09-29): chore: Update chat bubble background for one-theme (@at-susie)
- **PR #5062** (2026-09-29): chore: Internal style api v2 for radio button (@vvaliyev)
- **PR #5061** (2026-09-28): chore: Internal style api v2 for Toggle (@vvaliyev)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
