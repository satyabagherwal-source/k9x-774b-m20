# Forensic Learning Record (Deep Inspection): react95-io/React95

> **Canonical Artifact**: `07_PROJECT_LEARNING/react95-io-react95-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react95-io/React95](https://github.com/react95-io/React95))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:41:20.553Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react95-io/React95`
- **Description**: 🌈🕹  Windows 95 style UI component library for React
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 7269 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
  extends: [
    'plugin:@typescript-eslint/recommended',
    'airbnb',
    'plugin:prettier/recommended',
    'plugin:react-hooks/recommended'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['react', 'prettier'],
  env: {
    browser: true,
    es6: true,
    jest: true
  },
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_\\d*$'
      }
    ],
    'import/extensions': ['error', { js: 'never', ts: 'never', tsx: 'never' }],
    'import/no-unresolved': [
      'error',
      // TODO: Remove ../../test/utils when TypeScript migration is complete
      { ignore: ['react95', '../../test/utils'] }
    ],
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    'import/prefer-default-export': 'off',
    'jsx-a11y/label-has-associated-control': ['error', { assert: 'either' }],
    'jsx-a11y/label-has-for': 'off',
    'no-nested-ternary': 'off',
    'prettier/prettier': 'error',
    'react/forbid-prop-types': 'off',
    'react/jsx-filename-extension': [
      'warn',
      { extensions: ['.js', '.jsx', '.tsx'] }
    ],
    'react/jsx-props-no-spreading': 'off',
    'react/no-array-index-key': 'off',
    'react/prop-types': 'off',
    'react/require-default-props': 'off',
    'react/static-property-placement': ['error', 'static public field']
  },
  overrides: [
    {
      files: ['*.spec.@(js|jsx|ts|tsx)', '*.stories.@(js|jsx|ts|tsx)'],
      rules: {
        'no-console': 'off'
      }
    },
    {
      files: ['*.@(ts|tsx)'],
      rules: {
        // This is handled by @typescript-eslint/no-unused-vars
        'no-undef': 'off'
      }
    }
  ],
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx']
    },
    'import/resolver': {
      typescript: {}
    }
  }
};

```

### Core Architecture Module: `.storybook/decorators/withGlobalStyle.tsx`
```
import { DecoratorFn } from '@storybook/react';
import React from 'react';
import { createGlobalStyle } from 'styled-components';

import ms_sans_serif from '../../src/assets/fonts/dist/ms_sans_serif.woff2';
import ms_sans_serif_bold from '../../src/assets/fonts/dist/ms_sans_serif_bold.woff2';
import styleReset from '../../src/common/styleReset';

const GlobalStyle = createGlobalStyle`
  ${styleReset}
  @font-face {
    font-family: 'ms_sans_serif';
    src: url('${ms_sans_serif}') format('woff2');
    font-weight: 400;
    font-style: normal
  }
  @font-face {
    font-family: 'ms_sans_serif';
    src: url('${ms_sans_serif_bold}') format("woff2");
    font-weight: bold;
    font-style: normal
  }
  html, body, #root {
   height: 100%;
  }
  #root > * {
    height: 100%;
    box-sizing: border-box;
  }
  body {
    font-family: 'ms_sans_serif', 'sans-serif';
  }
`;

export const withGlobalStyle: DecoratorFn = story => (
  <>
    <GlobalStyle />
    {story()}
  </>
);

```

### Core Architecture Module: `.storybook/main.ts`
```
import type { StorybookConfig } from '@storybook/react/types';
import type { PropItem } from 'react-docgen-typescript';

const path = require('path');

const storybookConfig: StorybookConfig = {
  stories: ['../@(docs|src)/**/*.stories.@(tsx|mdx)'],
  addons: [
    {
      name: '@storybook/addon-docs',
      options: {
        sourceLoaderOptions: {
          injectStoryParameters: false
        }
      }
    },
    '@storybook/addon-storysource',
    './theme-picker/register.ts'
  ],
  core: {
    builder: 'webpack5'
  },
  features: {
    babelModeV7: true,
    storyStoreV7: true,
    modernInlineRender: true,
    postcss: false
  },
  typescript: {
    check: false,
    checkOptions: {},
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop: PropItem) =>
        prop.parent ? !/node_modules/.test(prop.parent.fileName) : true
    }
  },
  webpackFinal: config => {
    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        react95: path.resolve(__dirname, '../src/index')
      }
    };

    return config;
  }
};

module.exports = storybookConfig;

```

### Core Architecture Module: `.storybook/manager.ts`
```
import './manager.css';

import { addons } from '@storybook/addons';
import theme from './theme';

addons.setConfig({
  theme
});

```

### Core Architecture Module: `.storybook/preview.ts`
```
import { DecoratorFn, Parameters } from '@storybook/react';
import { withGlobalStyle } from './decorators/withGlobalStyle';
import { withThemesProvider } from './theme-picker/ThemeProvider';

export const decorators: DecoratorFn[] = [withGlobalStyle, withThemesProvider];

export const parameters: Parameters = {
  layout: 'fullscreen',
  options: {
    storySort: {
      order: [
        'Docs',
        [
          'Welcome to React95',
          'Getting Started',
          'Contributing',
          'Submit your Project'
        ],
        'Controls',
        'Environment',
        'Layout',
        'Typography',
        'Other'
      ]
    }
  }
};

```

### Core Architecture Module: `.storybook/theme-picker/ThemeButton.tsx`
```
import React, { useCallback } from 'react';
import { ThemeProvider } from 'styled-components';
import { Button } from '../../src/Button/Button';
import { Theme } from '../../src/types';

export function ThemeButton({
  active,
  onChoose,
  theme
}: {
  active: boolean;
  onChoose: (themeName: string) => void;
  theme: Theme;
}) {
  const handleClick = useCallback(() => {
    onChoose(theme.name);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <Button active={active} onClick={handleClick}>
        {theme.name}
      </Button>
    </ThemeProvider>
  );
}

```

### Core Architecture Module: `.storybook/theme-picker/ThemeList.tsx`
```
import { useAddonState } from '@storybook/api';
import React, { useCallback } from 'react';
import styled from 'styled-components';

import themes from '../../src/common/themes';
import { Theme } from '../../src/types';
import { THEMES_ID } from './constants';
import { ThemeButton } from './ThemeButton';

const {
  original,
  rainyDay,
  vaporTeal,
  theSixtiesUSA,
  olive,
  tokyoDark,
  rose,
  plum,
  matrix,
  travel,
  ...otherThemes
} = themes;

const themeList = [
  original,
  rainyDay,
  vaporTeal,
  theSixtiesUSA,
  olive,
  tokyoDark,
  rose,
  plum,
  matrix,
  travel,
  ...Object.values(otherThemes)
];

type ThemesProps = {
  active?: boolean;
};

const Wrapper = styled.div<{ theme: Theme }>`
  display: grid;
  padding: 1em;
  gap: 1em;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  grid-template-rows: repeat(auto-fill, 40px);
  background-color: ${({ theme }) => theme.material};
`;

export function ThemeList({ active }: ThemesProps) {
  const [themeName, setThemeName] = useAddonState(THEMES_ID, 'original');

  const handleChoose = useCallback(
    (newThemeName: string) => {
      setThemeName(newThemeName);
    },
    [setThemeName]
  );

  if (!active) {
    return <></>;
  }

  return (
    <Wrapper key={THEMES_ID} theme={themes.original}>
      {themeList.map(theme => (
        <ThemeButton
          active={themeName === theme.name}
          key={theme.name}
          onChoose={handleChoose}
          theme={theme}
        />
      ))}
    </Wrapper>
  );
}

```

### Core Architecture Module: `.storybook/theme-picker/ThemeProvider.tsx`
```
import { useAddonState } from '@storybook/client-api';
import { DecoratorFn } from '@storybook/react';
import React from 'react';
import { ThemeProvider } from 'styled-components';

import themes from '../../src/common/themes/index';
import { THEMES_ID } from './constants';

export const withThemesProvider: DecoratorFn = story => {
  const [themeName] = useAddonState(THEMES_ID, 'original');

  return (
    <ThemeProvider theme={themes[themeName] ?? themes.original}>
      {story()}
    </ThemeProvider>
  );
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #383** (2023-04-24): **"Active" button not getting focused state (dashed inner border)**
  *Symptoms*: "Active" button not getting focused state (dashed inner border):  <img width="62" alt="Screenshot 2023-04-08 at 14 59 09" src="https://user-images.githubusercontent.com/28541613/230722457-c34dd73c-41ec-4af0-a79f-f1e290ae6578.png"> 
  **Post-Mortem & Fix Analysis**:
  > Please assign this issue to me for working on it. Thanks
  > @afzalzbr awesome. Thank you and good luck!
  > The `focusOutline` was not including any case for active === true.  I've made changes in the file: `src\Button\Button.tsx`: ![image](https://user-images.githubusercontent.com/49808043/230751214-4c4bb5e6-7284-4563-aabc-6a9c24f7aec4.png)  Following is the working example of the fix for the 'Active' button, followed by a picture showing no other buttons' styles are being compromised: ![image](https://user-images.githubusercontent.com/49808043/230751259-83238241-9786-4669-b4f6-23327495f802.png)  ![image](https://user-images.githubusercontent.com/49808043/230751296-63440370-85d7-429c-84b4-4c110eddb07b.png)  I hope this helps!  @arturbien, Lemme know if anything else needs to be done. 

- **Issue #351** (2022-09-10): **fix(coverage): fix Jest coverage not properly referencing code points correctly**
  *Symptoms*: Code coverage depends on TypeScript sourceMap, which we disabled for builds.
  **Post-Mortem & Fix Analysis**:
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arturbien/React95/pr/351/builds/280519) or the icon next to each commit SHA.  Latest deployment of this branch, based on commit 4bdb91370e6c24f26d093d2269cc771ab0f76b46:  |Sandbox| Source | |--|--| |[React95 template](https://codesandbox.io/s/react95-template-f5he5v)| Configuration | 
  > **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Updated | | :--- | :----- | :------ | :------ | | **react95** | ✅ Ready ([Inspect](https://vercel.com/arturbien/react95/9LjirTgca7ctn83bgWXWZiJw86C5)) | [Visit Preview](https://react95-git-fix-wesjest-coverage-arturbien.vercel.app) | Aug 10, 2022 at 11:05PM (UTC) |  

- **Issue #349** (2022-08-06): **build: remove babel-plugin-polyfill-corejs3 to avoid Babel issue building Storybook**
  *Symptoms*: The build error happens inside that plugin, which shouldn't be necessary in modern browsers.
  **Post-Mortem & Fix Analysis**:
  > **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Updated | | :--- | :----- | :------ | :------ | | **react95** | ✅ Ready ([Inspect](https://vercel.com/arturbien/react95/EmmZZ7WZrgAYYhFFixsgnnfkC8Zh)) | [Visit Preview](https://react95-git-build-wesremove-corejs3-arturbien.vercel.app) | Aug 6, 2022 at 4:36PM (UTC) |  
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arturbien/React95/pr/349/builds/278924) or the icon next to each commit SHA.  Latest deployment of this branch, based on commit ac1599028e1e63fd0dbe1f89c0a066fe0c176fe0:  |Sandbox| Source | |--|--| |[React95 template](https://codesandbox.io/s/react95-template-xo5e88)| Configuration | 
  > :tada: This PR is included in version 4.0.0-beta.13 :tada:  The release is available on: - [npm package (@beta dist-tag)](https://www.npmjs.com/package/react95/v/4.0.0-beta.13) - [GitHub release](https://github.com/arturbien/React95/releases/tag/v4.0.0-beta.13)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #347** (2022-08-07): **build: fix TypeScript export for themes**
  *Symptoms*: Currently, Rollup configures themes as a `dir` output type, with `preserveModules` enabled, but the types are not exported accordingly, so importing modules directly fails type checking:  ```js import original from 'react95/dist/themes/original'; ```

- **Issue #338** (2022-08-05): **build: configure rollup-plugin-dts to use special compilerOptions**
  *Symptoms*: An alternative to #329, passing specific TypeScript `compilerOptions` to `rollup-plugin-dts`.
  **Post-Mortem & Fix Analysis**:
  > **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Updated | | :--- | :----- | :------ | :------ | | **react95** | ✅ Ready ([Inspect](https://vercel.com/arturbien/react95/45912yGQv1v3c2YMiddt6wFuxEyH)) | [Visit Preview](https://react95-git-build-wesdts-config-arturbien.vercel.app) | Aug 4, 2022 at 8:58PM (UTC) |  
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arturbien/React95/pr/338/builds/278363) or the icon next to each commit SHA.  Latest deployment of this branch, based on commit 4724175b335b636f3bc6e7162ccc3223392f7de5:  |Sandbox| Source | |--|--| |[React95 template](https://codesandbox.io/s/react95-template-pu2l5t)| Configuration | 
  > @arturbien @luizbaldi although this exported files on the correct locations, it still didn't generate one file per theme as expected.  Any objection to either: - Export one bundle with all themes in one object - Export the themes together with `react95` and only have one entry

- **Issue #336** (2022-08-05): **chore: restore React 16 support**
  *Symptoms*: This restores importing React and the ESLint rule react/react-in-jsx-scope to preserve React 16 compatibility.  This also moves some types around so themes can be exported as a standalone with its own TypeScript config.
  **Post-Mortem & Fix Analysis**:
  > **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Updated | | :--- | :----- | :------ | :------ | | **react95** | ✅ Ready ([Inspect](https://vercel.com/arturbien/react95/CFqrKyCN19dWJmVB5xgo8vgHy63j)) | [Visit Preview](https://react95-git-fork-wessouza-chore-wesjsx-react-arturbien.vercel.app) | Aug 4, 2022 at 8:26PM (UTC) |  
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arturbien/React95/pr/336/builds/278349) or the icon next to each commit SHA.  Latest deployment of this branch, based on commit b1ea0b33426628865a58242aac8ec7e96449b7bb:  |Sandbox| Source | |--|--| |[React95 template](https://codesandbox.io/s/react95-template-26thr9)| Configuration | 
  > :tada: This PR is included in version 4.0.0-beta.12 :tada:  The release is available on: - [npm package (@beta dist-tag)](https://www.npmjs.com/package/react95/v/4.0.0-beta.12) - [GitHub release](https://github.com/arturbien/React95/releases/tag/v4.0.0-beta.12)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #329** (2022-08-07): **build: update build to preserve modules and use @rollup/plugin-typescript**
  *Symptoms*: This changes the main output to also preserve modules, allowing tree shaking when users build their projects.  This also replaces rollup-plugin-dts with the more traditional @rollup/plugin-typescript, which exports type declarations for individual files fixing issues with themes imports.  It also adds missing `displayName` to `Select`, `Toolbar`, `TreeView` and `WindowHeader`, as well as improves the return type generics of `Select` and `TreeView`.  Closes #346, #347.
  **Post-Mortem & Fix Analysis**:
  > **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)  | Name | Status | Preview | Updated | | :--- | :----- | :------ | :------ | | **react95** | ✅ Ready ([Inspect](https://vercel.com/arturbien/react95/C2PF6wHoGYnjG19r3QwTnreFUpeV)) | [Visit Preview](https://react95-git-fork-wessouza-build-plugin-typescript-arturbien.vercel.app) | Aug 6, 2022 at 3:23PM (UTC) |  
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/arturbien/React95/pr/329/builds/278922) or the icon next to each commit SHA.  Latest deployment of this branch, based on commit 841f273f04f6f1c8bc6893b004a78844dc0cdde2:  |Sandbox| Source | |--|--| |[React95 template](https://codesandbox.io/s/react95-template-jdfqxg)| Configuration | 
  > :tada: This PR is included in version 4.0.0-beta.13 :tada:  The release is available on: - [npm package (@beta dist-tag)](https://www.npmjs.com/package/react95/v/4.0.0-beta.13) - [GitHub release](https://github.com/arturbien/React95/releases/tag/v4.0.0-beta.13)  Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot :package::rocket:

- **Issue #192** (2020-10-31): **Cutout component not looking good on the docs **
  *Symptoms*: The `Cutout` component is not looking exactly like we want, this is probably related to styling and might be a good opportunity for a first contribution.  Current looking: <img width="350" alt="Screen Shot 2020-10-06 at 09 53 09" src="https://user-images.githubusercontent.com/17226904/95204153-14d8dc00-07ba-11eb-95c7-22507beda989.png">  Expected looking (you can check [storybook](https://storybook.react95.io/?path=/story/cutout--default)): <img width="396" alt="Screen Shot 2020-10-06 at 09 52 45" src="https://user-images.githubusercontent.com/17226904/95204112-07235680-07ba-11eb-990c-a1badc12e705.png">  ### How to reproduce: 1. Fork and clone the repo 2. Install the necessary dependêncies using npm (run `npm i` on the root folder)  3. Start docs locally by running `npm run docs:dev`, this will start a local server running the documentation on `http://localhost:3000/` 4. Navigate to the `Cutout` component through the Menu (Components > Cutout)  ### Aditional information This documentation was written using [Docz](https://www.docz.site) and we structured it following the [colocation](https://kentcdodds.com/blog/colocation) idea, so every component folder has its own documentation file, and everything generally related to the documentation can be found at the `docs/` folder _or_ (this is a known problem) `src/gatsby-theme-docz` that has some Docz only related files used to extend the documentation behavior.  ---   Before start working on this bug leave a comme
  **Post-Mortem & Fix Analysis**:
  > Hello, can I work on it?
  > @branopuzder Of course, thank you! Feel free to drop questions/comments here if you need anything 🚀 
  > Hey there. I've found the problem and fixed it. Should I run `npm run docs:build` before creating a PR or will it be done on Github? Sorry for asking such a question, I'm quite new into it.

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

### Incident Patch 1: `871d5335` (2023-04-09)
**Commit Message**: fix(Button): active button focus outline

bug fix: active button focus issue resolved

removed !active flag from line 167.

bug fix: "Active" button not getting focused state

**File**: `src/Button/Button.tsx` (modified, +1/-1)
```diff
@@ -164,7 +164,7 @@ export const StyledButton = styled.button<StyledButtonProps>`
           }
           &:focus:after,
           &:active:after {
-            ${!active && !disabled && focusOutline}
+            ${!disabled && focusOutline}
             outline-offset: -8px;
           }
           &:active:focus:after,
```

---

### Incident Patch 2: `8d8a376a` (2023-03-01)
**Commit Message**: docs(storybook): fix styling order

Fixed styling order in Getting Started docs

**File**: `docs/Getting-Started.stories.mdx` (modified, +1/-1)
```diff
@@ -40,6 +40,7 @@ import ms_sans_serif from 'react95/dist/fonts/ms_sans_serif.woff2';
 import ms_sans_serif_bold from 'react95/dist/fonts/ms_sans_serif_bold.woff2';
 
 const GlobalStyles = createGlobalStyle`
+  ${styleReset}
   @font-face {
     font-family: 'ms_sans_serif';
     src: url('${ms_sans_serif}') format('woff2');
@@ -55,7 +56,6 @@ const GlobalStyles = createGlobalStyle`
   body, input, select, textarea {
     font-family: 'ms_sans_serif';
   }
-  ${styleReset}
 `;
 
 const App = () => (
```

---

### Incident Patch 3: `c76f191e` (2022-11-10)
**Commit Message**: fix(radio): remove 'menu' variant

BREAKING CHANGE: remove 'menu' variant of Radio component

**File**: `src/Radio/Radio.stories.tsx` (modified, +2/-74)
```diff
@@ -1,15 +1,6 @@
 import { ComponentMeta } from '@storybook/react';
 import React, { useState } from 'react';
-import {
-  GroupBox,
-  MenuList,
-  MenuListItem,
-  Radio,
-  ScrollView,
-  Separator,
-  Window,
-  WindowContent
-} from 'react95';
+import { GroupBox, Radio, ScrollView, Window, WindowContent } from 'react95';
 import styled from 'styled-components';
 
 const Wrapper = styled.div`
@@ -25,6 +16,7 @@ const Wrapper = styled.div`
     }
   }
 `;
+
 export default {
   title: 'Controls/Radio',
   component: Radio,
@@ -143,67 +135,3 @@ export function Flat() {
 Flat.story = {
   name: 'flat'
 };
-
-export function Menu() {
-  const [state, setState] = useState({
-    tool: 'Brush',
-    color: 'Black'
-  });
-  const handleToolChange = (e: React.ChangeEvent<HTMLInputElement>) =>
-    setState({ ...state, tool: e.target.value });
-  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) =>
-    setState({ ...state, color: e.target.value });
-
-  const { tool, color } = state;
-
-  return (
-    <MenuList>
-      <MenuListItem size='sm'>
-        <Radio
-          variant='menu'
-          checked={tool === 'Brush'}
-          onChange={handleToolChange}
-          value='Brush'
-          label='Brush'
-          name='tool'
-        />
-      </MenuListItem>
-      <MenuListItem size='sm'>
-        <Radio
-          variant='menu'
-          checked={tool === 'Pencil'}
-          onChange={handleToolChange}
-          value='Pencil'
-          label='Pencil'
-          name='tool'
-        />
-      </MenuListItem>
-      <Separator />
-      <MenuListItem size='sm' disabled>
-        <Radio
-          disabled
-          variant='menu'
-          checked={color === 'Black'}
-          onChange={handleColorChange}
-          value='Black'
-          label='Black'
-          name='color'
-        />
-      </MenuListItem>
-      <MenuListItem size='sm' disabled>
-        <Radio
-          disabled
-          variant='menu'
-          checked={color === 'Red'}
-          onChange={handleColorChange}
-          value='Red'
-          label='Red'
-          name='color'
-        />
-      </MenuListItem>
-    </MenuList>
-  );
-}
-Menu.story = {
-  name: 'menu'
-};
```

**File**: `src/Radio/Radio.tsx` (modified, +4/-35)
```diff
@@ -8,11 +8,10 @@ import {
   StyledInput,
   StyledLabel
 } from '../common/SwitchBase';
-import { StyledMenuListItem } from '../MenuList/MenuList';
 import { StyledScrollView } from '../ScrollView/ScrollView';
 import { CommonStyledProps } from '../types';
 
-type RadioVariant = 'default' | 'flat' | 'menu';
+type RadioVariant = 'default' | 'flat';
 
 type RadioProps = {
   checked?: boolean;
@@ -78,15 +77,6 @@ const StyledFlatCheckbox = styled.div<StyledCheckboxProps>`
     border-radius: 50%;
   }
 `;
-const StyledMenuCheckbox = styled.div`
-  ${sharedCheckboxStyles}
-  position: relative;
-  display: inline-block;
-  box-sizing: border-box;
-  border: none;
-  outline: none;
-  background: none;
-`;
 
 type IconProps = {
   'data-testid': 'checkmarkIcon';
@@ -106,34 +96,13 @@ const Icon = styled.span.attrs(() => ({
   height: 6px;
   transform: translate(-50%, -50%);
   border-radius: 50%;
-  ${({ $disabled, theme, variant }) =>
-    variant === 'menu'
-      ? css`
-          background: ${$disabled
-            ? theme.materialTextDisabled
-            : theme.materialText};
-          filter: drop-shadow(
-            1px 1px 0px
-              ${$disabled ? theme.materialTextDisabledShadow : 'transparent'}
-          );
-        `
-      : css`
-          background: ${$disabled ? theme.checkmarkDisabled : theme.checkmark};
-        `}
-  ${StyledMenuListItem}:hover & {
-    ${({ $disabled, theme, variant }) =>
-      !$disabled &&
-      variant === 'menu' &&
-      css`
-        background: ${theme.materialTextInvert};
-      `};
-  }
+  background: ${p =>
+    p.$disabled ? p.theme.checkmarkDisabled : p.theme.checkmark};
 `;
 
 const CheckboxComponents = {
   flat: StyledFlatCheckbox,
-  default: StyledCheckbox,
-  menu: StyledMenuCheckbox
+  default: StyledCheckbox
 };
 
 const Radio = forwardRef<HTMLInputElement, RadioProps>(
```

---

### Incident Patch 4: `17eec67f` (2022-11-10)
**Commit Message**: fix(checkbox): remove 'menu' variant

Remove 'menu' variant, as this should be a part of MenuList component

BREAKING CHANGE: Removal of 'menu' Checkbox variant

**File**: `src/Checkbox/Checkbox.stories.tsx` (modified, +1/-49)
```diff
@@ -2,14 +2,7 @@ import React, { useState } from 'react';
 import styled from 'styled-components';
 
 import { ComponentMeta } from '@storybook/react';
-import {
-  Checkbox,
-  GroupBox,
-  MenuList,
-  MenuListItem,
-  ScrollView,
-  Separator
-} from 'react95';
+import { Checkbox, GroupBox, ScrollView } from 'react95';
 
 const Wrapper = styled.div`
   background: ${({ theme }) => theme.material};
@@ -237,44 +230,3 @@ export function Flat() {
 Flat.story = {
   name: 'flat'
 };
-
-export function Menu() {
-  return (
-    <MenuList>
-      <MenuListItem size='md'>
-        <Checkbox
-          name='useGradient'
-          variant='menu'
-          value='useGradient'
-          label='Use gradient'
-          defaultChecked
-        />
-      </MenuListItem>
-      <MenuListItem size='md'>
-        <Checkbox
-          name='thickBrush'
-          variant='menu'
-          defaultChecked={false}
-          value='thickBrush'
-          label='Thick brush'
-          indeterminate
-        />
-      </MenuListItem>
-      <Separator />
-      <MenuListItem size='md' disabled>
-        <Checkbox
-          name='autoSave'
-          variant='menu'
-          value='autoSave'
-          checked
-          label='Auto-save'
-          disabled
-        />
-      </MenuListItem>
-    </MenuList>
-  );
-}
-
-Menu.story = {
-  name: 'menu'
-};
```

**File**: `src/Checkbox/Checkbox.tsx` (modified, +8/-67)
```diff
@@ -10,7 +10,6 @@ import {
   StyledLabel
 } from '../common/SwitchBase';
 import { noOp } from '../common/utils';
-import { StyledMenuListItem } from '../MenuList/MenuList';
 import { StyledScrollView } from '../ScrollView/ScrollView';
 import { CommonThemeProps } from '../types';
 
@@ -25,7 +24,7 @@ type CheckboxProps = {
   onChange?: React.ChangeEventHandler<HTMLInputElement>;
   style?: React.CSSProperties;
   value?: number | string;
-  variant?: 'default' | 'flat' | 'menu';
+  variant?: 'default' | 'flat';
 } & Omit<
   React.InputHTMLAttributes<HTMLInputElement>,
   | 'checked'
@@ -41,7 +40,7 @@ type CheckboxProps = {
 
 type CheckmarkProps = {
   $disabled: boolean;
-  variant: 'default' | 'flat' | 'menu';
+  variant: 'default' | 'flat';
 };
 
 const sharedCheckboxStyles = css`
@@ -77,20 +76,6 @@ const StyledFlatCheckbox = styled.div<CommonThemeProps>`
     $disabled ? theme.flatLight : theme.canvas};
 `;
 
-const StyledMenuCheckbox = styled.div<CommonThemeProps>`
-  position: relative;
-  box-sizing: border-box;
-  display: inline-block;
-  background: ${({ $disabled, theme }) =>
-    $disabled ? theme.flatLight : theme.canvas};
-  ${sharedCheckboxStyles}
-  width: ${size - 4}px;
-  height: ${size - 4}px;
-  background: none;
-  border: none;
-  outline: none;
-`;
-
 const CheckmarkIcon = styled.span.attrs(() => ({
   'data-testid': 'checkmarkIcon'
 }))<CheckmarkProps>`
@@ -113,30 +98,8 @@ const CheckmarkIcon = styled.span.attrs(() => ({
     border-width: 0 3px 3px 0;
     transform: translate(-50%, -50%) rotate(45deg);
 
-    ${({ $disabled, theme, variant }) =>
-      variant === 'menu'
-        ? css`
-            border-color: ${$disabled
-              ? theme.materialTextDisabled
-              : theme.materialText};
-            filter: drop-shadow(
-              1px 1px 0px
-                ${$disabled ? theme.materialTextDisabledShadow : 'transparent'}
-            );
-          `
-        : css`
-            border-color: ${$disabled
-              ? theme.checkmarkDisabled
-              : theme.checkmark};
-          `}
-    ${StyledMenuListItem}:hover & {
-      ${({ $disabled, theme, variant }) =>
-        !$disabled &&
-        variant === 'menu' &&
-        css`
-          border-color: ${theme.materialTextInvert};
-        `};
-    }
+    border-color: ${p =>
+      p.$disabled ? p.theme.checkmarkDisabled : p.theme.checkmark};
   }
 `;
 const IndeterminateIcon = styled.span.attrs(() => ({
@@ -145,16 +108,9 @@ const IndeterminateIcon = styled.span.attrs(() => ({
   display: inline-block;
   position: relative;
 
-  ${({ variant }) =>
-    variant === 'menu'
-      ? css`
-          height: calc(100% - 4px);
-          width: calc(100% - 4px);
-        `
-      : css`
-          width: 100%;
-          height: 100%;
-        `}
+  width: 100%;
+  height: 100%;
+
   &:after {
     content: '';
     display: block;
@@ -167,27 +123,12 @@ const IndeterminateIcon = styled.span.attrs(() => ({
         mainColor: $disabled ? theme.checkmarkDisabled : theme.checkmark
       })}
     background-position: 0px 0px, 2px 2px;
-
-    ${({ $disabled, theme, variant }) =>
-      variant === 'menu' &&
-      css`
-        ${StyledMenuListItem}:hover & {
-          ${createHatchedBackground({
-            mainColor: theme.materialTextInvert
-          })}
-        }
-        filter: drop-shadow(
-          1px 1px 0px
-            ${$disabled ? theme.materialTextDisabledShadow : 'transparent'}
-        );
-      `};
   }
 `;
 
 const CheckboxComponents = {
   flat: StyledFlatCheckbox,
-  default: StyledCheckbox,
-  menu: StyledMenuCheckbox
+  default: StyledCheckbox
 };
 
 const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
```

---

### Incident Patch 5: `f5047a01` (2022-11-10)
**Commit Message**: style(textinput.stories): fix typo in file name



---

### Incident Patch 6: `ec6f3924` (2022-11-10)
**Commit Message**: fix(numberinput): pass otherProps down to the wrapper

**File**: `src/NumberInput/NumberInput.tsx` (modified, +3/-1)
```diff
@@ -104,7 +104,8 @@ const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
       style,
       value,
       variant = 'default',
-      width
+      width,
+      ...otherProps
     },
     ref
   ) => {
@@ -160,6 +161,7 @@ const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
           ...style,
           width: width !== undefined ? getSize(width) : 'auto'
         }}
+        {...otherProps}
       >
         <TextInput
           value={valueDerived}
```

---

### Incident Patch 7: `390edd87` (2022-11-09)
**Commit Message**: fix(tabs): pass 'value' as first argument in 'onChange'

**File**: `src/Tabs/Tab.tsx` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@ import { CommonStyledProps } from '../types';
 type TabProps = {
   children?: React.ReactNode;
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
-  onClick?: (event: React.MouseEvent<HTMLButtonElement>, value: any) => void;
+  onClick?: (value: any, event: React.MouseEvent<HTMLButtonElement>) => void;
   selected?: boolean;
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   value?: any;
@@ -76,7 +76,7 @@ const Tab = forwardRef<HTMLButtonElement, TabProps>(
         aria-selected={selected}
         selected={selected}
         onClick={(e: React.MouseEvent<HTMLButtonElement>) =>
-          onClick?.(e, value)
+          onClick?.(value, e)
         }
         ref={ref}
         role='tab'
```

**File**: `src/Tabs/Tabs.spec.tsx` (modified, +1/-1)
```diff
@@ -61,7 +61,7 @@ describe('<Tabs />', () => {
 
       fireEvent.click(getAllByRole('tab')[1]);
       expect(handleChange).toBeCalledTimes(1);
-      expect(handleChange.mock.calls[0][1]).toBe(1);
+      expect(handleChange.mock.calls[0][0]).toBe(1);
     });
   });
 
```

**File**: `src/Tabs/Tabs.stories.tsx` (modified, +7/-7)
```diff
@@ -32,9 +32,12 @@ export function Default() {
   });
 
   const handleChange = (
-    _: React.MouseEvent<HTMLButtonElement>,
-    value: number
-  ) => setState({ activeTab: value });
+    value: number,
+    event: React.MouseEvent<HTMLButtonElement>
+  ) => {
+    console.log({ value, event });
+    setState({ activeTab: value });
+  };
 
   const { activeTab } = state;
   return (
@@ -88,10 +91,7 @@ export function MultiRow() {
     activeTab: 'Shoes'
   });
 
-  const handleChange = (
-    _: React.MouseEvent<HTMLButtonElement>,
-    value: string
-  ) => setState({ activeTab: value });
+  const handleChange = (value: string) => setState({ activeTab: value });
 
   const { activeTab } = state;
   return (
```

---

### Incident Patch 8: `0471ccba` (2022-11-09)
**Commit Message**: fix(checkbox): add missing semicolon in styles

**File**: `src/Checkbox/Checkbox.tsx` (modified, +9/-8)
```diff
@@ -22,7 +22,7 @@ type CheckboxProps = {
   indeterminate?: boolean;
   label?: number | string;
   name?: string;
-  onChange?: React.InputHTMLAttributes<HTMLInputElement>['onChange'];
+  onChange?: React.ChangeEventHandler<HTMLInputElement>;
   style?: React.CSSProperties;
   value?: number | string;
   variant?: 'default' | 'flat' | 'menu';
@@ -129,13 +129,14 @@ const CheckmarkIcon = styled.span.attrs(() => ({
               ? theme.checkmarkDisabled
               : theme.checkmark};
           `}
-  ${StyledMenuListItem}:hover & {
-    ${({ $disabled, theme, variant }) =>
-      !$disabled &&
-      variant === 'menu' &&
-      css`
-        border-color: ${theme.materialTextInvert};
-      `};
+    ${StyledMenuListItem}:hover & {
+      ${({ $disabled, theme, variant }) =>
+        !$disabled &&
+        variant === 'menu' &&
+        css`
+          border-color: ${theme.materialTextInvert};
+        `};
+    }
   }
 `;
 const IndeterminateIcon = styled.span.attrs(() => ({
```

---

### Incident Patch 9: `2c6e1413` (2022-11-09)
**Commit Message**: fix(slider): do not pass event to onChange handlers

**File**: `src/Slider/Slider.spec.tsx` (modified, +2/-2)
```diff
@@ -343,8 +343,8 @@ describe('<Slider />', () => {
       );
 
       expect(handleChange).toHaveBeenCalledTimes(2);
-      expect(handleChange.mock.calls[0][1]).toBe(80);
-      expect(handleChange.mock.calls[1][1]).toBe(78);
+      expect(handleChange.mock.calls[0][0]).toBe(80);
+      expect(handleChange.mock.calls[1][0]).toBe(78);
     });
   });
 
```

**File**: `src/Slider/Slider.stories.tsx` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ export default {
 export function Default() {
   const [state, setState] = React.useState(0);
 
-  const onChange: SliderOnChangeHandler = (_, newValue) => setState(newValue);
+  const onChange: SliderOnChangeHandler = newValue => setState(newValue);
 
   return (
     <div className='row'>
```

**File**: `src/Slider/Slider.tsx` (modified, +7/-14)
```diff
@@ -24,14 +24,7 @@ import { clamp, getSize, roundValueToStep } from '../common/utils';
 import { StyledScrollView } from '../ScrollView/ScrollView';
 import { CommonStyledProps } from '../types';
 
-export type SliderOnChangeHandler = (
-  event:
-    | MouseEvent
-    | React.KeyboardEvent<HTMLSpanElement>
-    | React.MouseEvent<HTMLDivElement>
-    | TouchEvent,
-  value: number
-) => void;
+export type SliderOnChangeHandler = (value: number) => void;
 
 type SliderProps = {
   defaultValue?: number;
@@ -419,8 +412,8 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
         setValueState(newValue);
         setFocusVisible(true);
 
-        onChange?.(event, newValue);
-        onChangeCommitted?.(event, newValue);
+        onChange?.(newValue);
+        onChangeCommitted?.(newValue);
       }
     );
 
@@ -466,7 +459,7 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
         setValueState(newValue);
         setFocusVisible(true);
 
-        onChange?.(event, newValue);
+        onChange?.(newValue);
       }
     );
 
@@ -480,7 +473,7 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
 
         const newValue = getNewValue(finger);
 
-        onChangeCommitted?.(event, newValue);
+        onChangeCommitted?.(newValue);
 
         touchId.current = undefined;
 
@@ -505,7 +498,7 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
         if (finger) {
           const newValue = getNewValue(finger);
           setValueState(newValue);
-          onChange?.(event, newValue);
+          onChange?.(newValue);
         }
 
         const doc = ownerDocument(sliderRef.current);
@@ -530,7 +523,7 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
       if (finger) {
         const newValue = getNewValue(finger);
         setValueState(newValue);
-        onChange?.(event, newValue);
+        onChange?.(newValue);
       }
 
       const doc = ownerDocument(sliderRef.current);
```

---

### Incident Patch 10: `acaacd8c` (2022-10-30)
**Commit Message**: fix(slider): fix thumb not draggable

fix #357

**File**: `src/Slider/Slider.stories.tsx` (modified, +7/-2)
```diff
@@ -1,6 +1,6 @@
 import { ComponentMeta } from '@storybook/react';
 import React from 'react';
-import { ScrollView, Slider } from 'react95';
+import { ScrollView, Slider, SliderOnChangeHandler } from 'react95';
 import styled from 'styled-components';
 
 const Wrapper = styled.div`
@@ -41,6 +41,10 @@ export default {
 } as ComponentMeta<typeof Slider>;
 
 export function Default() {
+  const [state, setState] = React.useState(0);
+
+  const onChange: SliderOnChangeHandler = (_, newValue) => setState(newValue);
+
   return (
     <div className='row'>
       <div className='col'>
@@ -66,7 +70,8 @@ export function Default() {
           min={0}
           max={6}
           step={1}
-          defaultValue={0}
+          value={state}
+          onChange={onChange}
           marks={[
             { value: 0, label: '0°C' },
             { value: 2, label: '2°C' },
```

**File**: `src/Slider/Slider.tsx` (modified, +44/-68)
```diff
@@ -17,31 +17,31 @@ import {
   createHatchedBackground
 } from '../common';
 import useControlledOrUncontrolled from '../common/hooks/useControlledOrUncontrolled';
+import useEventCallback from '../common/hooks/useEventCallback';
 import useForkRef from '../common/hooks/useForkRef';
 import { useIsFocusVisible } from '../common/hooks/useIsFocusVisible';
 import { clamp, getSize, roundValueToStep } from '../common/utils';
 import { StyledScrollView } from '../ScrollView/ScrollView';
 import { CommonStyledProps } from '../types';
 
+export type SliderOnChangeHandler = (
+  event:
+    | MouseEvent
+    | React.KeyboardEvent<HTMLSpanElement>
+    | React.MouseEvent<HTMLDivElement>
+    | TouchEvent,
+  value: number
+) => void;
+
 type SliderProps = {
   defaultValue?: number;
   disabled?: boolean;
   marks?: boolean | { label?: string; value: number }[];
   max?: number;
   min?: number;
   name?: string;
-  onChange?: (
-    event:
-      | MouseEvent
-      | React.KeyboardEvent<HTMLSpanElement>
-      | React.MouseEvent<HTMLDivElement>
-      | TouchEvent,
-    value: number
-  ) => void;
-  onChangeCommitted?: (
-    event: MouseEvent | React.KeyboardEvent<HTMLSpanElement> | TouchEvent,
-    value: number
-  ) => void;
+  onChange?: SliderOnChangeHandler;
+  onChangeCommitted?: SliderOnChangeHandler;
   onMouseDown?: (event: React.MouseEvent<HTMLDivElement>) => void;
   orientation?: 'horizontal' | 'vertical';
   size?: string | number;
@@ -330,21 +330,20 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
     const handleFocusRef = useForkRef(focusVisibleRef, sliderRef);
     const handleRef = useForkRef(ref, handleFocusRef);
 
-    const handleFocus = useCallback(
+    const handleFocus = useEventCallback(
       (event: React.FocusEvent<HTMLSpanElement>) => {
         if (isFocusVisible(event)) {
           setFocusVisible(true);
         }
-      },
-      [isFocusVisible]
+      }
     );
 
-    const handleBlur = useCallback(() => {
+    const handleBlur = useEventCallback(() => {
       if (focusVisible !== false) {
         setFocusVisible(false);
         onBlurVisible();
       }
-    }, [focusVisible, onBlurVisible]);
+    });
 
     const touchId = useRef<number>();
 
@@ -363,7 +362,7 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
       [marksProp, max, min, step]
     );
 
-    const handleKeyDown = useCallback(
+    const handleKeyDown = useEventCallback(
       (event: React.KeyboardEvent<HTMLSpanElement>) => {
         const tenPercents = (max - min) / 10;
         const marksValues = marks.map(mark => mark.value);
@@ -422,17 +421,7 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
 
         onChange?.(event, newValue);
         onChangeCommitted?.(event, newValue);
-      },
-      [
-        marks,
-        max,
-        min,
-        onChange,
-        onChangeCommitted,
-        setValueState,
-        step,
-        valueDerived
-      ]
+      }
     );
 
     const getNewValue = useCallback(
@@ -464,7 +453,7 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
       [marks, max, min, step, vertical]
     );
 
-    const handleTouchMove = useCallback(
+    const handleTouchMove = useEventCallback(
       (event: MouseEvent | TouchEvent) => {
         const finger = trackFinger(event, touchId.current);
 
@@ -478,11 +467,10 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
         setFocusVisible(true);
 
         onChange?.(event, newValue);
-      },
-      [getNewValue, onChange, setValueState]
+      }
     );
 
-    const handleTouchEnd = useCallback(
+    const handleTouchEnd = useEventCallback(
       (event: MouseEvent | TouchEvent) => {
         const finger = trackFinger(event, touchId.current);
 
@@ -501,11 +489,10 @@ const Slider = forwardRef<HTMLDivElement, SliderProps>(
         doc.removeEventListener('mouseup', handleTouchEnd);
         doc.removeEventListener('touchmove', handleTouchMove);
         doc.removeEventListener('touchend', handl
```

**File**: `src/common/hooks/useEventCallback.ts` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+import * as React from 'react';
+
+const useEnhancedEffect =
+  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;
+
+/**
+ * https://github.com/facebook/react/issues/14099#issuecomment-440013892
+ */
+export default function useEventCallback<Args extends unknown[], Return>(
+  fn: (...args: Args) => Return
+): (...args: Args) => Return {
+  const ref = React.useRef(fn);
+  useEnhancedEffect(() => {
+    ref.current = fn;
+  });
+  return React.useCallback(
+    (...args: Args) =>
+      // @ts-expect-error hide `this`
+      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
+      (0, ref.current!)(...args),
+    []
+  );
+}
```

#### Recent Merged Pull Requests:
- **PR #400** (closed): Phase 1 scaffold 2421418690062196697 (@yethranayeh)
- **PR #385** (closed): build(deps): bump vm2 from 3.9.13 to 3.9.16 (@dependabot[bot])
- **PR #384** (2023-04-24): bug fix: "Active" button not getting focused state (@afzalzbr)
- **PR #382** (closed): build(deps): bump vm2 from 3.9.13 to 3.9.15 (@dependabot[bot])
- **PR #380** (2023-03-02): docs(storybook): fix styling order (@xsu1010)
- **PR #378** (2023-01-09): build(deps): bump json5 from 1.0.1 to 1.0.2 (@dependabot[bot])
- **PR #372** (2023-01-09): build(deps): bump loader-utils from 1.4.0 to 1.4.2 (@dependabot[bot])
- **PR #369** (2022-11-13): Beta (@arturbien)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
