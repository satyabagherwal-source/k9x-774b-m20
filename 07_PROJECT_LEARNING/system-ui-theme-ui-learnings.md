# Forensic Learning Record (Deep Inspection): system-ui/theme-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/system-ui-theme-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/system-ui/theme-ui](https://github.com/system-ui/theme-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:43:24.319Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `system-ui/theme-ui`
- **Description**: Build consistent, themeable React apps based on constraint-based design principles
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5399 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
  },
  extends: ['react-app'],
  plugins: ['@typescript-eslint'],
  globals: {
    __PATH_PREFIX__: true,
  },
  rules: {
    'no-use-before-define': 'off',
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-redeclare': 'off',

    // Ensure peerDependencies and dependencies are properly configured
    'import/no-extraneous-dependencies': 'error',

    // TypeScript checks this
    'no-undef': 'off',
    'no-lone-blocks': 'off',

    'react/jsx-pascal-case': 'off', // needs a fix in @theme-ui/mdx
  },
  overrides: [
    {
      files: [
        'packages/**/test/**/*.{ts,tsx,js,jsx}',
        'packages/e2e/**/*.{ts,tsx}',
      ],
      rules: {
        'import/no-extraneous-dependencies': 'off',
        'react/jsx-pascal-case': 'off',
      },
    },
  ],
}

```

### Core Architecture Module: `auto.config.ts`
```
import { AutoRc } from '@auto-it/core'
import { INpmConfig } from '@auto-it/npm'
import { ConventionalCommitsOptions } from '@auto-it/conventional-commits'
import { IAllContributorsPluginOptions } from '@auto-it/all-contributors'
import { IOmitCommitsPluginOptions } from '@auto-it/omit-commits'

const npmOptions: INpmConfig = {
  exact: true,
  commitNextVersion: true,
}

const conventionalCommitsOptions: ConventionalCommitsOptions = {
  defaultReleaseType: 'none',
}

const _allContributorsOptions: IAllContributorsPluginOptions = {
  exclude: [
    'dependabot',
    'dependabot[bot]',
    '@dependabot[bot]',
    'dependabot-preview',
    'dependabot-preview[bot]',
    '@dependabot-preview[bot]',
  ],
  types: {
    infra: ['./github/**/*'],
    example: ['examples/**/*'],
    doc: ['**/*.mdx', '**/*.md', 'packages/docs/**/*'],
    test: ['**/*.test.*', '**/*.spec.*'],
    code: [
      'packages/**/*.js',
      'packages/**/*.ts',
      'packages/**/*.jsx',
      'packages/**/*.tsx',
      '**/package.json',
      '**/tsconfig.json',
    ],
  },
}

const omitCommitsOptions: IOmitCommitsPluginOptions = {
  subject: [
    'Merge branch',
    `Merge remote-tracking branch 'origin/stable' into develop`,
    'chore:',
    'chore(',
    'ci(',
    'ci:',
    'test:',
    'test(',
    'fix(ci):',
  ],
}

export default function config(): AutoRc {
  return {
    baseBranch: 'stable',
    prereleaseBranches: ['develop'],
    plugins: [
      ['npm', npmOptions],
      ['conventional-commits', conventionalCommitsOptions],
      'first-time-contributor',
      'released',
      // ['all-contributors', allContributorsOptions],
      ['omit-commits', omitCommitsOptions],
      // 'magic-zero',
    ],
    labels: [
      {
        name: 'pushToBaseBranch',
        changelogTitle: '👨‍💻 Minor changes', // 😈
      },
    ],
  }
}

```

### Core Architecture Module: `babel.config.js`
```
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        bugfixes: true,
        loose: true,
        modules: false,
        targets: '> 0.25%, not dead, not ie 11',
      },
    ],
    [
      '@babel/react',
      {
        runtime: 'automatic',
        importSource: '@theme-ui/core',
      },
    ],
    '@babel/preset-typescript',
  ],
  env: {
    test: {
      plugins: ['@babel/plugin-transform-runtime'],
    },
  },
}

```

### Core Architecture Module: `examples/gatsby-plugin/gatsby-config.js`
```
/** @type {import('gatsby').GatsbyConfig} */
module.exports = {
  plugins: ['gatsby-plugin-mdx', 'gatsby-plugin-theme-ui'],
}

```

### Core Architecture Module: `examples/gatsby-plugin/src/gatsby-plugin-theme-ui/index.js`
```
const theme = {
  config: {
    initialColorModeName: 'light',
  },
  colors: {
    text: '#000',
    background: '#fff',
    primary: '#07c',
    secondary: '#609',
  },
  fonts: {
    body:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    heading: 'inherit',
  },
  lineHeights: {
    body: 1.5,
    heading: 1.25,
  },
  fontWeights: {
    body: 400,
    heading: 900,
    bold: 700,
  },
  styles: {
    root: {
      fontFamily: 'body',
      fontWeight: 'body',
      lineHeight: 'body',
      py: 2,
      px: 4,
    },
    a: {
      color: 'primary',
      textDecoration: 'none',
      ':hover': {
        color: 'secondary',
        textDecoration: 'underline',
      },
    },
  },
}

export default theme

```

### Core Architecture Module: `examples/gatsby-plugin/src/layout.js`
```
/** @jsxImportSource theme-ui */
import { Themed } from 'theme-ui'

const Layout = (props) => (
  <Themed.root>
    <header>
      <h2>Theme UI Gatsby Example</h2>
    </header>
    <main>
      <div sx={{ fontFamily: 'body' }}>{props.children}</div>
    </main>
  </Themed.root>
)

export default Layout

```

### Core Architecture Module: `examples/gatsby/gatsby-browser.js`
```
import { WrapRootElement } from './src'

export const wrapRootElement = ({ element }) => (
  <WrapRootElement element={element} />
)

```

### Core Architecture Module: `examples/gatsby/gatsby-config.js`
```
/** @type {import('gatsby').GatsbyConfig} */
module.exports = {
  jsxRuntime: 'automatic',
  plugins: [
    'gatsby-plugin-mdx',
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        name: 'pages',
        path: `${__dirname}/src/pages`,
      },
    },
  ],
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2456** (2024-01-24): **Several TypeScript errors when upgrading to 0.16.1**
  *Symptoms*: **Describe the bug** When upgrading to 0.16.1, we have introduced a bunch of TypeScript errors. An example of one such error, is when trying to access a string key on a `Scale` type property (e.g `theme.shadow`). An array index works as expected without any TS errors, but when trying to access a key (our shadow property in the theme is an object, not an array) we see a TS error.  This can be solved with type assertions, but it would be quite cumbersome to update all instances like this.  E.g ```typescript <div   sx={{     boxShadow: (theme) => theme.shadows.firstLevel   }} /> ```  ``` Property 'firstLevel' does not exist on type 'Scale<BoxShadow>'.   Property 'firstLevel' does not exist on type 'BoxShadow[]'.ts(2339) ```  **To Reproduce** Steps to reproduce the behavior:  1. Clone [this CRA sandbox](https://github.com/matt-koevort/react-theme-ui) 2. Open the project in a TypeScript enabled editor, or run `tsc --noEmit` (for example) 3. Note error when trying to access a string key on `theme.shadows` (as opposed to a numbered index)  **Expected behavior** The type `Scale` indicates that it can be an array or an object. Out of the box it seems to assume that any property of type `Scale` is an array.  **Screenshots**  ![image](https://github.com/system-ui/theme-ui/assets/35453138/a12f7809-7112-4b19-9d2a-658e363723c1)  ![image](https://github.com/system-ui/theme-ui/assets/35453138/06e6b1f0-7bdf-42b9-8185-2b31131f32dd)   **Additional context** 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the issue, and the reproduction @matt-koevort.   It's interesting, because the error shows up on a scale read from the theme, but not if it's a standalone variable of the same type.  <img width="391" alt="image" src="https://github.com/system-ui/theme-ui/assets/15332326/9dd29e7a-f483-4011-b3fe-5de84ac55194">  Looking into it!
  > Okay, it seems that we can no longer read string keys from an union of array and object with string index signature.  This is a bit of a tricky case then, because we need to keep accepting an array OR a dict in the theme user gives to the theme provider, but give out a broader type in `sx` prop so it can be read safely. I'm not sure if a bugfix is even possible, but I have an idea for a feature that would solve this and give you a better, stricter type.  I'm curious why does it work as expected in my commercial production project which is using the same versions. Do you know which specific version update of either Theme UI or TypeScript caused this issue?  In the meantime, may I interest you in using `makeTheme` and an assertion for a workaround? It's not ideal, but you'll get more safety & autocomplete.  ```tsx /** @jsxImportSource theme-ui */  import { makeTheme } from "@theme-ui/css/utils";  const theme = makeTheme({   shadows: {     firstLevel: "0 0 4px 2px rgba(0,
  > @hasparus thanks for looking into this. To be honest I had a fiddle with this in TypeScript and also found it difficult to achieve the broader type as you mentioned.   The only problem we would have with your suggestion, is that (a) we have far too many instances of the theme callback so updating all of them would be a bit of a headache, and (b) we don't actually have the specific typing on the theme as this is a library that is used in another application which actually sets the theme via the ThemeProvider.  It doesn't seem to be a typescript (v5.2.2) upgrade that is causing this, but rather the upgrade to `@theme-ui/core@0.16.1`

- **Issue #2369** (2023-04-25): **Flex sx prop don't take a function**
  *Symptoms*: **Describe the bug** According to [the docs](https://theme-ui.com/components/flex):  >The `Flex` component is identical to the `Box` component, but with `display: flex` set. If you need to alter the display property, use the `Box` component instead.  But it breaks when we pass a function to the `sx` prop, instead of an object. You can see why when looking at its implementation, where we spread the `sx` prop, assuming it's always an object.  **To Reproduce** Steps to reproduce the behavior:  1. Use `Flex` and add some styles using the `sx` prop as an object. 2. Change the implementation and use a function for the `sx` prop that returns that same object. 3. See how the styles break.  **Expected behavior** `Flex` should also accept a function for its `sx` prop, just like `Box`.  **Additional context** Maybe this was working before? We recently made a significant upgrade to one of our projects that was using quite an old version of `theme-ui` and noticed that some components broke because of this bug.
  **Post-Mortem & Fix Analysis**:
  > @dani-mp It seems to work fine. I tried this locally with the latest `develop` branch.    https://user-images.githubusercontent.com/47112778/234279896-f61abcc4-fa4f-478e-99e1-434eee45ac15.mp4  
  > @dev-cj interesting, it wasn't working for us 5 months ago and I don't see anything has changed in the `Flex` component implementation. Maybe it did somewhere else (e.g. emotion)?  Could you put that in a codesanbox so I can play with it?
  > @dev-cj btw, [this is the implementation](https://github.com/system-ui/theme-ui/blob/cbea6302a721a06b4240850ad9df2313ff0d56d3/packages/components/src/Flex.tsx#L20), the `sx` prop is overwritten and then spread. If you spread a fn inside an object, you get nothing. <img width="196" alt="image" src="https://user-images.githubusercontent.com/2881251/234300531-aeeb5e51-3d65-4b57-a191-a3dbcb738f47.png">  What am I missing?

- **Issue #2349** (2025-12-26): **theme styles generate duplication css output**
  *Symptoms*: **Describe the bug** When I want to use the styles attribute to customize the native html tag style, for example: blockquote, but the style that ends up being generated to the page is repeated twice  **To Reproduce** 1. clone my reproduction project [blog production](https://github.com/zhaohuanyuu/blog-reproduction/tree/main) 2. yarn install & yarn start 3. Click the Blog header 4. Route to the named reproduction article 5. Inspect text content is "this is theme-ui style custom style" element  **Expected behavior**  I don't know why generate duplication css output,that should generate css only once  **Screenshots** ![image](https://user-images.githubusercontent.com/25791574/197392034-62304b2a-2006-4d92-b88f-071c51e8741f.png)  ![image](https://user-images.githubusercontent.com/25791574/197390105-f2170d86-de68-453c-ac33-d31f1511e8b8.png)   **Additional context** As long as the styles defined from the styles object of theme-ui config have the problem of generating duplicate css 
  **Post-Mortem & Fix Analysis**:
  > Yep, I'm having this issue too on sites like https://lachlanjc.com/ — not sure what's going on
  > I don't see this problem in a commercial project nor in [CodeSandbox](https://codesandbox.io/s/theme-ui-0-15-0-develop-test-ovttsl?file=/next.config.js).  Also, not all classes in @lachlanjc's websites have duplicate styles.  <img width="336" alt="image" src="https://user-images.githubusercontent.com/15332326/202686771-3aa8ae5a-0e04-4a97-85bb-b17474914b70.png">  Do you guys think we can narrow this? When does it happen? When does it not happen?
  > I can confirm that duplication takes place in some undisclosed cases. It's not clear at the moment what causes this behavior.   <img width="429" alt="Screenshot 2023-02-14 at 18 52 33" src="https://user-images.githubusercontent.com/918009/218773447-96b171b8-d3ee-493f-90d8-e762fe2095c6.png"> 

- **Issue #2319** (2022-09-18): **0.15.0-develop release is broken**
  *Symptoms*: I managed to break the automatic release when fixing tests in `opt-in-mdx` branch 😅  To fix it, I'll need to  - remove `--no-frozen-lockfile` from the install command on CI — Auto fails with   ```   Error: Working directory is not clean, make sure all files are committed [607](https://github.com/system-ui/theme-ui/actions/runs/3048416051/jobs/4913534038#step:8:608)     at Auto.checkClean (/home/runner/work/theme-ui/theme-ui/node_modules/.pnpm/@auto-it+core@10.37.4_typescript@4.8.2/node_modules/@auto-it/core/src/auto.ts:2046:11)    ```  - make sure it installs properly with the same versions of dependencies - ensure the publish runs after `yarn build` (actual production build) not `yarn dev` (preconstruct links)  ---  Original error in 0.15.0-develop.26 reported by @LekoArts in https://github.com/system-ui/theme-ui/issues/2288#issuecomment-1246331696:  ``` Error: Cannot find module '../../../node_modules/.pnpm/@preconstruct+hook@0.4.0/node_modules/@preconstruct/hook' Require stack: - /Users/lejoe/code/github/gatsby-themes/node_modules/theme-ui/dist/theme-ui.cjs.js ``` 
  **Post-Mortem & Fix Analysis**:
  > I fixed some problems on the CI, got rate-limited by GitHub, and ended up releasing `v0.15.0-develop.30` manually.  [My test CodeSandbox getting some problems from `@mdx-js/loader` in Next.js](https://codesandbox.io/s/theme-ui-0-15-0-develop-test-ovttsl?file=/package.json), but it's disconnected from Theme UI.

- **Issue #2197** (2022-04-21): **`useBreakpointIndex` and `useResponsiveValue` don't handle full `@media` queries in `theme.breakpoints`**
  *Symptoms*: `useBreakpointIndex` and `useResponsiveValue` don't handle full `@media` queries in `theme.breakpoints`.  Thanks for finding this @danimadmolil 🙏.  ### Discussed in https://github.com/system-ui/theme-ui/discussions/2195  <div type='discussions-op-text'>  <sup>Originally posted by **danimadmolil** April  7, 2022</sup> Hellow, i'm new to theme-ui. my project is simple react-app.on index.js i create a theme and use it with ThemeProvider like this: ### index.js ``` const theme = {  breakpoints: [     "@media screen and (min-width:300px) and (max-width:499px)",     "@media screen and (min-width: 500px) and (max-width:899px)",     "@media screen and (min-width: 900px)",   ], }  <ThemeProvider theme={theme}>    <App/> </ThemeProvider>  ``` ### App.js ``` import { useResponsiveValue, useBreakpointIndex } from "@theme-ui/match-media"; function App(){   const color = useResponsiveValue((theme) => ["red", "blue", "orange"]);   return <div className="app" style={{backgroundColor:color}}></div> }  ```  the result color is always red. i'm not whay it's like that. can any one help me please? **note**:if i use breakpoint:['40em','50em','60em'] it work fine but i like to use media queries with condition like (min-width) and (max-width).</div>
  **Post-Mortem & Fix Analysis**:
  > <!-- GITHUB_RELEASE COMMENT: released --> :rocket: Issue was released in [`v0.14.3`](https://github.com/system-ui/theme-ui/releases/tag/v0.14.3) :rocket:
  > Not sure if a regression or I'm just misconfiguring but the same issue originally reported is happening for me in v0.16.1
  > none of the versions works for me

- **Issue #2171** (2022-03-22): **Can't use ref on Switch component**
  *Symptoms*: **Describe the bug** Can't use ref on Switch component when creating an HOC.   **To Reproduce**  ```js export const CustomSwitch = React.forwardRef<HTMLInputElement, SwitchProps>((props, ref) => {   return <Switch ref={ref} {...props}  />; } ``` Throws the TS error  ``` Type 'string' is not assignable to type 'Ref<HTMLInputElement> | undefined' ```  There seems to be a clash between `props.ref` and the forwardedRef, where `props.ref` uses a LegacyRef which accepts a string.  **Hint** I believe we just need to update `ComponentProps` to `ComponentPropsWithRef` here?  [  extends Assign<React.ComponentProps<'input'>, BoxOwnProps> {](https://github.com/system-ui/theme-ui/blob/6f09ac088e98531080da7b282ea6311a6c0bdd44/packages/components/src/Switch.tsx#L14)  
  **Post-Mortem & Fix Analysis**:
  > Note: workaround I'm using right now is to just remove the offending `ref` from the props ```ts React.forwardRef<HTMLInputElement, SwitchProps>(({ ref: legacyRefNotToBeUsed, ...props}, ref) => ```
  > I think this is now the case with all components. I just upgraded to 0.14 and now no refs can be passed down to `Box` and `Flex` either.
  > Thanks for the issue @herrethan!

- **Issue #2042** (2021-12-22): **`theme-ui` along with `next.js` color mode is rendered incorrectly**
  *Symptoms*: **Describe the bug** Hi there, once again thanks a lot of the great library, I am facing some issues with the `useColorMode` hook as it seems that it get's messed up with the hydration mode of `next.js`. As I am switching through the color modes upon refreshing the rendered results is pretty weird.  **To Reproduce** Steps to reproduce the behavior:  1. Go to https://stackblitz.com/edit/nextjs-7whv5w?file=components/color-switcher.js 2. Click on `Toggle Mode icon` 3. Refresh the "inner window of the editor" 4. See the weird state of the icon.  **Expected behavior** The rendered icon should reflect the color mode state.  **Screenshots**   https://user-images.githubusercontent.com/1022166/145886214-f2dffad1-c566-4c42-8eef-774cbbe68294.mov    
  **Post-Mortem & Fix Analysis**:
  > Hey @vorillaz, I can't reproduce this and to be fair, I'm not quite sure how Theme UI would affect the rendering of that icon.
  > @hasparus Closing this one, it appears that it is an issue with SSR from Next.js. Thanks for the help.

- **Issue #2038** (2021-12-30): **Gatsby Plugin Theme UI incompatible with newer versions of theme-ui and Gatsby 4.0**
  *Symptoms*: The plugin depends on theme-ui version `^0.11`. https://github.com/system-ui/theme-ui/blob/fa1fea4a2845a25f2a794a2e1a5398b06ce9d8cb/packages/gatsby-plugin-theme-ui/package.json#L9  Perhaps it should be `"^0.11.0"` instead. This might be the cause of this error when trying to run `npm install`:  ``` npm ERR! code ERESOLVE npm ERR! ERESOLVE unable to resolve dependency tree npm ERR!  npm ERR! While resolving: minimal-blog@1.0.0 npm ERR! Found: theme-ui@0.12.1 npm ERR! node_modules/theme-ui npm ERR!   theme-ui@"^0.12.1" from the root project npm ERR!  npm ERR! Could not resolve dependency: npm ERR! peer theme-ui@"^0.11" from gatsby-plugin-theme-ui@0.12.1 npm ERR! node_modules/gatsby-plugin-theme-ui npm ERR!   gatsby-plugin-theme-ui@"^0.12.1" from the root project npm ERR!  npm ERR! Fix the upstream dependency conflict, or retry npm ERR! this command with --force, or --legacy-peer-deps npm ERR! to accept an incorrect (and potentially broken) dependency resolution. npm ERR!  ```  **To Reproduce** Try to `npm i` in a folder which has this basic `package.json`. You should get the same error. ``` {   "name": "test-themeui",   "version": "1.0.0",   "description": "",   "main": "index.js",   "scripts": {     "test": "echo \"Error: no test specified\" && exit 1"   },   "author": "",   "license": "ISC",   "dependencies": {     "theme-ui": "^0.12.1",     "gatsby-plugin-theme-ui": "^0.12.1"   } }  ```   **Expected behavior**  No errors when i
  **Post-Mortem & Fix Analysis**:
  > If we revert to using `0.11.0`, we would be forced to downgrade to Gatsby 3.0, because Gatsby 4.0 was only added recently in 0.11.4, see https://github.com/system-ui/theme-ui/pull/1980
  > Oh no! Thanks for the issue.
  > Installing that package.json with Theme UI 0.13, I’m not seeing that issue: https://codesandbox.io/s/festive-ully-j026f?file=/package.json  Will close for now since the versions have been bumped here, but please flag if you’re still seeing this!  https://github.com/system-ui/theme-ui/blob/348177b9e61ff66d1403eaae789c44151ab06d17/packages/gatsby-plugin-theme-ui/package.json#L8-L10

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

### Incident Patch 1: `bc875924` (2026-03-05)
**Commit Message**: Merge pull request #2567 from system-ui/fix-next

fix next example build

**File**: `CHANGELOG.md` (modified, +35/-0)
```diff
@@ -1,3 +1,38 @@
+# v0.17.4 (Fri Jan 02 2026)
+
+
+
+---
+
+# v0.17.3 (Fri Jan 02 2026)
+
+#### 🐛 Bug Fix
+
+- Update Textarea snapshot for field-sizing: content [#2555](https://github.com/system-ui/theme-ui/pull/2555) ([@Copilot](https://github.com/Copilot))
+- Update Alert snapshot for role="alert" attribute [#2554](https://github.com/system-ui/theme-ui/pull/2554) ([@Copilot](https://github.com/Copilot))
+
+#### 👨‍💻 Minor changes
+
+- Update package.json to 0.17.3-develop.9 ([@hasparus](https://github.com/hasparus))
+- Bump version to 0.17.3-develop.8 ([@hasparus](https://github.com/hasparus))
+- Bump version to 0.17.3-develop.4 ([@hasparus](https://github.com/hasparus))
+- Merge stable into develop for release preparation ([@hasparus](https://github.com/hasparus))
+- Trigger CI ([@hasparus](https://github.com/hasparus))
+- docs: Update Resources links ([@lachlanjc](https://github.com/lachlanjc))
+
+#### 🏠 Internal
+
+- components: [Textarea] Add field-sizing: content [#2553](https://github.com/system-ui/theme-ui/pull/2553) ([@lachlanjc](https://github.com/lachlanjc) [@Copilot](https://github.com/Copilot) [@hasparus](https://github.com/hasparus))
+- components: [Alert] Add ARIA role [#2552](https://github.com/system-ui/theme-ui/pull/2552) ([@lachlanjc](https://github.com/lachlanjc) [@Copilot](https://github.com/Copilot) [@hasparus](https://github.com/hasparus))
+
+#### Authors: 3
+
+- [@Copilot](https://github.com/Copilot)
+- Lachlan Campbell ([@lachlanjc](https://github.com/lachlanjc))
+- Piotr Monwid-Olechnowicz ([@hasparus](https://github.com/hasparus))
+
+---
+
 # v0.17.2 (Fri Feb 14 2025)
 
 #### 🐛 Bug Fix
```

**File**: `examples/next/package.json` (modified, +2/-3)
```diff
@@ -7,7 +7,7 @@
   "license": "MIT",
   "scripts": {
     "dev": "next",
-    "build": "next build",
+    "build": "cd ../.. && pnpm build && cd examples/next && next build",
     "start": "next start",
     "typecheck": "tsc --noEmit"
   },
@@ -24,7 +24,6 @@
   },
   "devDependencies": {
     "@types/react": "^18.2.12",
-    "typescript": "^5",
-    "webpack": "^5.104.1"
+    "typescript": "^5"
   }
 }
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@theme-ui/monorepo",
-  "version": "0.17.3-develop.9",
+  "version": "0.17.4",
   "private": true,
   "scripts": {
     "build": "preconstruct build",
```

**File**: `packages/color-modes/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@theme-ui/color-modes",
-  "version": "0.17.2-develop.1",
+  "version": "0.17.4",
   "main": "dist/theme-ui-color-modes.cjs.js",
   "module": "dist/theme-ui-color-modes.esm.js",
   "types": "dist/theme-ui-color-modes.cjs.d.ts",
```

**File**: `packages/color/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@theme-ui/color",
-  "version": "0.17.2-develop.1",
+  "version": "0.17.4",
   "source": "src/index.ts",
   "main": "dist/theme-ui-color.cjs.js",
   "module": "dist/theme-ui-color.esm.js",
```

---

### Incident Patch 2: `49f80e77` (2026-03-05)
**Commit Message**: Merge origin/develop into fix-next

**File**: `pnpm-lock.yaml` (modified, +163/-78)
```diff
@@ -184,10 +184,10 @@ importers:
         version: 5.13.7(babel-eslint@10.1.0(eslint@8.57.1))(encoding@0.1.13)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(type-fest@2.19.0)(typescript@5.6.3)
       gatsby-plugin-mdx:
         specifier: ^5
-        version: 5.13.1(@mdx-js/react@2.3.0(react@18.3.1))(gatsby-source-filesystem@5.15.0(gatsby@5.13.7(babel-eslint@10.1.0(eslint@8.57.1))(encoding@0.1.13)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(type-fest@2.19.0)(typescript@5.6.3)))(gatsby@5.13.7(babel-eslint@10.1.0(eslint@8.57.1))(encoding@0.1.13)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(type-fest@2.19.0)(typescript@5.6.3))(graphql@15.9.0)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
+        version: 5.13.1(@mdx-js/react@2.3.0(react@18.3.1))(gatsby-source-filesystem@5.16.0(gatsby@5.13.7(babel-eslint@10.1.0(eslint@8.57.1))(encoding@0.1.13)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(type-fest@2.19.0)(typescript@5.6.3)))(gatsby@5.13.7(babel-eslint@10.1.0(eslint@8.57.1))(encoding@0.1.13)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(type-fest@2.19.0)(typescript@5.6.3))(graphql@15.9.0)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       gatsby-source-filesystem:
         specifier: latest
-        version: 5.15.0(gatsby@5.13.7(babel-eslint@10.1.0(eslint@8.57.1))(encoding@0.1.13)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(type-fest@2.19.0)(typescript@5.6.3))
+        version: 5.16.0(gatsby@5.13.7(babel-eslint@10.1.0(eslint@8.57.1))(encoding@0.1.13)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(type-fest@2.19.0)(typescript@5.6.3))
       react:
         specifier: ^18.1.0
         version: 18.3.1
@@ -221,7 +221,7 @@ importers:
         version: 5.13.7(babel-eslint@10.1.0(eslint@8.57.1))(encoding@0.1.13)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(type-fest@2.19.0)(typescript@5.6.3)
       gatsby-plugin-mdx:
         specifier: ^5
-        version: 5.13.1(@mdx-js/react@3.0.1(@types/react@18.3.11)(react@18.3.1))(gatsby-source-filesystem@5.15.0(gatsby@5.13.7(babel-eslint@10.1.0(eslint@8.57.1))(encoding@0.1.13)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(type-fest@2.19.0)(typescript@5.6.3)))(gatsby@5.13.7(babel-eslint@10.1.0(eslint@8.57.1))(encoding@0.1.13)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(type-fest@2.19.0)(typescript@5.6.3))(graphql@16.9.0)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
+        version: 5.13.1(@mdx-js/react@3.0.1(@types/react@18.3.11)(react@18.3.1))(gatsby-source-filesystem@5.16.0(gatsby@5.13.7(babel-eslint@10.1.0(eslint@8.57.1))(encoding@0.1.13)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(type-fest@2.19.0)(typescript@5.6.3)))(gatsby@5.13.7(babel-eslint@10.1.0(eslint@8.57.1))(encoding@0.1.13)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)(type-fest@2.19.0)(typescript@5.6.3))(graphql@16.9.0)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
       gatsby-plugin-theme-ui:
         specifier: workspace:^
         version: link:../../packages/gatsby-plugin-theme-ui
@@ -252,13 +252,13 @@ importers:
         version: 11.13.3(@types/react@18.3.11)(react@18.3.1)
       '@mdx-js/loader':
         specifier: ^2.3.0
-        version: 2.3.0(webpack@5.104.1)
+        version: 2.3.0(webpack@5.105.0)
       '@mdx-js/react':
         specifier: ^2.3.0
         version: 2.3.0(react@18.3.1)
       '@next/mdx':
         specifier: ^14.0.4
-        version: 14.2.15(@mdx-js/loader@2.3.0(webpack@5.104.1))(@mdx-js/react@2.3.0(react@18.3.1))
+        version: 14.2.15(@mdx-js/loader@2.3.0(webpack@5.105.0))(@mdx-js/react@2.3.0(react@18.3.1))
       '@theme-ui/css':
         specifier: workspace:^
         version: link:../../packages/css
@@ -479,7 +479,7 @@ importers:
         version: 11.13.3(@types/react@18.3.11)(react@18.3.1)
       '@mdx-js/loader':
         specifier: ^2.3.0
-        version: 2.3.0(webpack@5.104.1)
+        version: 2.3.0(webpack@5.105.0)
       '@mdx-js/react':
         specifier: ^2.3.0
         version: 2.3.0(react@18.3.1)
@@ -1161,7 +1161,7 @@ importers:
         version: 5.1.1
       tailwindc
```

---

### Incident Patch 3: `57c1fec9` (2026-03-05)
**Commit Message**: Fix Next.js example Vercel build

Run preconstruct build before next build so dist/ contains compiled JS
instead of preconstruct dev proxies that re-export raw TypeScript source.
Also remove unused webpack devDependency.

**File**: `examples/next/package.json` (modified, +2/-3)
```diff
@@ -7,7 +7,7 @@
   "license": "MIT",
   "scripts": {
     "dev": "next",
-    "build": "next build",
+    "build": "cd ../.. && pnpm build && cd examples/next && next build",
     "start": "next start",
     "typecheck": "tsc --noEmit"
   },
@@ -24,7 +24,6 @@
   },
   "devDependencies": {
     "@types/react": "^18.2.12",
-    "typescript": "^5",
-    "webpack": "^5.91.0"
+    "typescript": "^5"
   }
 }
```

**File**: `pnpm-lock.yaml` (modified, +4/-130)
```diff
@@ -252,13 +252,13 @@ importers:
         version: 11.13.3(@types/react@18.3.11)(react@18.3.1)
       '@mdx-js/loader':
         specifier: ^2.3.0
-        version: 2.3.0(webpack@5.95.0)
+        version: 2.3.0(webpack@5.104.1)
       '@mdx-js/react':
         specifier: ^2.3.0
         version: 2.3.0(react@18.3.1)
       '@next/mdx':
         specifier: ^14.0.4
-        version: 14.2.15(@mdx-js/loader@2.3.0(webpack@5.95.0))(@mdx-js/react@2.3.0(react@18.3.1))
+        version: 14.2.15(@mdx-js/loader@2.3.0(webpack@5.104.1))(@mdx-js/react@2.3.0(react@18.3.1))
       '@theme-ui/css':
         specifier: workspace:^
         version: link:../../packages/css
@@ -281,9 +281,6 @@ importers:
       typescript:
         specifier: ^5
         version: 5.6.3
-      webpack:
-        specifier: ^5.91.0
-        version: 5.95.0
 
   examples/typography:
     dependencies:
@@ -3806,9 +3803,6 @@ packages:
   '@types/estree@0.0.39':
     resolution: {integrity: sha512-EYNwp3bU+98cpU4lAWYYL7Zz+2gryWH1qbdDTidVd6hkiR6weksdbMadyXKXNPEkQFhXM+hVO9ZygomHXp+AIw==}
 
-  '@types/estree@1.0.5':
-    resolution: {integrity: sha512-/kYRxGDLWzHOB7q+wtSUQlFrtcdUccpfy+X+9iMBpHK8QLLhx2wIPYuS5DYtR9Wa/YlZAbIovy7qVdB1Aq6Lyw==}
-
   '@types/estree@1.0.6':
     resolution: {integrity: sha512-AYnb1nQyY49te+VRAVgmzfcgjYS91mY5P0TKUDCLEM+gNnA+3T6rWITXRLYCpahpqSQbN5cE+gHpnPyXjHWxcw==}
 
@@ -4244,11 +4238,6 @@ packages:
     peerDependencies:
       acorn: ^8
 
-  acorn-import-attributes@1.9.5:
-    resolution: {integrity: sha512-n02Vykv5uA3eHGM/Z2dQrcD56kL8TyDb2p1+0P83PClMnC/nc+anbQRhIOWnSq4Ke/KvDPrY3C9hDtC/A3eHnQ==}
-    peerDependencies:
-      acorn: ^8
-
   acorn-import-phases@1.0.4:
     resolution: {integrity: sha512-wKmbr/DDiIXzEOiWrTTUcDm24kQ2vGfZQvM2fwg2vXqR5uW6aapr7ObPtj1th32b9u90/Pf4AItvdTh42fBmVQ==}
     engines: {node: '>=10.13.0'}
@@ -4282,11 +4271,6 @@ packages:
     engines: {node: '>=0.4.0'}
     hasBin: true
 
-  acorn@8.10.0:
-    resolution: {integrity: sha512-F0SAmZ8iUtS//m8DmCTA0jlh6TDKkHQyK6xc6V4KDTyZKA9dnvX9/3sRTVQrWm79glUAZbnmmNcdYwUIHWVybw==}
-    engines: {node: '>=0.4.0'}
-    hasBin: true
-
   acorn@8.13.0:
     resolution: {integrity: sha512-8zSiw54Oxrdym50NlZ9sUusyO1Z1ZchgRLWRaK6c86XJFClyCgFKetdowBg5bKxyp/u+CDBJG4Mpp0m3HLZl9w==}
     engines: {node: '>=0.4.0'}
@@ -4881,11 +4865,6 @@ packages:
     resolution: {integrity: sha512-WHVocJYavUwVgVViC0ORikPHQquXwVh939TaelZ4WDqpWgTX/FsGhl/+P4qBUAGcRvtOgDgC+xftNWWp2RUTAQ==}
     hasBin: true
 
-  browserslist@4.21.11:
-    resolution: {integrity: sha512-xn1UXOKUz7DjdGlg9RrUr0GGiWzI97UQJnugHtH0OLDfJB7jMgoIkYvRIEO1l9EeEERVqeqLYOcFBW9ldjypbQ==}
-    engines: {node: ^6 || ^7 || ^8 || ^9 || ^10 || ^11 || ^12 || >=13.7}
-    hasBin: true
-
   browserslist@4.24.0:
     resolution: {integrity: sha512-Rmb62sR1Zpjql25eSanFGEhAxcFwfA1K0GuQcLoaJBAcENegrQut3hYdhXFF1obQfiDyqIW/cLM5HSJ/9k884A==}
     engines: {node: ^6 || ^7 || ^8 || ^9 || ^10 || ^11 || ^12 || >=13.7}
@@ -5018,9 +4997,6 @@ packages:
   caniuse-db@1.0.30001384:
     resolution: {integrity: sha512-Yz+Kzpb2jjAX05W5vfzdnbdRiimdnxmIaxZQ6A62MQheyF1o8vPNI8PqshSBmN+TIAFFD6tsfBykkVP0Y9v6Kw==}
 
-  caniuse-lite@1.0.30001669:
-    resolution: {integrity: sha512-DlWzFDJqstqtIVx1zeSpIMLjunf5SmwOw0N2Ck/QSQdS8PLS4+9HrLaYei4w8BIAL7IB/UEDu889d8vhCTPA0w==}
-
   caniuse-lite@1.0.30001761:
     resolution: {integrity: sha512-JF9ptu1vP2coz98+5051jZ4PwQgd2ni8A+gYSN7EA7dPKIMf0pDlSUxhdmVOaV3/fYK5uWBkgSXJaRLr4+3A6g==}
 
@@ -6001,9 +5977,6 @@ packages:
   egzek@1.2.0:
     resolution: {integrity: sha512-CtAwJYXtvNatDXHRqgwihnxQpvk/iShqvPkMeDx/V+Gg7sO3Ds95jXZSCxozH94htGGT5DB0WK8huJ6p389OYQ==}
 
-  electron-to-chromium@1.4.527:
-    resolution: {integrity: sha512-EafxEiEDzk2aLrdbtVczylHflHdHkNrpGNHIgDyA63sUQLQVS2ayj2hPw3RsVB42qkwURH+T2OxV7kGPUuYszA==}
-
   electron-to-chromium@1.5.267:
     resolution: {integrity: sha512-0Drusm6MVRXSOJpGbaSVgcQsuB4hEkMpHXaVstcPmhu5LIedxs1xNK/nIxmQIU/RPC0+1/o0AVZfBTkTNJOdUw==}
 
@@ -6158,10 +6131,6 @@ packages:
     engines: {node: '>=18'
```

---

### Incident Patch 4: `8ad58637` (2025-12-29)
**Commit Message**: chore: Fix Next.js example

**File**: `examples/next/next-env.d.ts` (modified, +2/-1)
```diff
@@ -1,5 +1,6 @@
 /// <reference types="next" />
 /// <reference types="next/image-types/global" />
+/// <reference path="./.next/types/routes.d.ts" />
 
 // NOTE: This file should not be edited
-// see https://nextjs.org/docs/basic-features/typescript for more information.
+// see https://nextjs.org/docs/pages/api-reference/config/typescript for more information.
```

**File**: `examples/next/next.config.js` (modified, +17/-5)
```diff
@@ -4,18 +4,30 @@ const withMDX = require('@next/mdx')()
 
 module.exports = withMDX({
   pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'mdx'],
-  webpack(config) {
-    // This is just for the sake of example app.
-    // yarn link doesn't play well with React hooks.
-    // https://github.com/facebook/react/issues/14257
+  webpack(config, { isServer }) {
+    // Ensure single instances of React and theme-ui packages in the monorepo
     Object.assign(config.resolve.alias, {
       react: path.resolve(__dirname, './node_modules/react'),
       'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
+      'theme-ui': path.resolve(__dirname, '../../packages/theme-ui'),
+      '@theme-ui/core': path.resolve(__dirname, '../../packages/core'),
+      '@theme-ui/css': path.resolve(__dirname, '../../packages/css'),
+      '@theme-ui/color-modes': path.resolve(__dirname, '../../packages/color-modes'),
+      '@theme-ui/components': path.resolve(__dirname, '../../packages/components'),
+      '@theme-ui/theme-provider': path.resolve(__dirname, '../../packages/theme-provider'),
+      '@emotion/react': path.resolve(__dirname, './node_modules/@emotion/react'),
     })
 
+    // Don't follow symlinks - use package.json exports to resolve to built files
+    config.resolve.symlinks = false
+
+    // Use CJS on server to avoid async ESM module interop issues with @emotion
+    if (isServer) {
+      config.resolve.conditionNames = ['require', 'node', 'default']
+    }
+
     return config
   },
-  // don't typecheck the packages in the example build
   typescript: {
     ignoreBuildErrors: true,
   },
```

---

### Incident Patch 5: `5f1defb0` (2025-12-29)
**Commit Message**: fix(ci): add moduleResolution override for auto script

TS_NODE_COMPILER_OPTIONS was setting module to commonjs but tsconfig
has moduleResolution: Bundler which requires ES modules. Adding
moduleResolution: node makes them compatible.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

**File**: `package.json` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
     "postinstall": "preconstruct dev",
     "dev": "preconstruct dev",
     "release": "pnpm clean && pnpm build && pnpm shipit && node scripts/publish-to-npm.mjs",
-    "auto": "cross-env TS_NODE_COMPILER_OPTIONS=\"{ \\\"module\\\": \\\"commonjs\\\", \\\"isolatedModules\\\": false }\" auto",
+    "auto": "cross-env TS_NODE_COMPILER_OPTIONS=\"{ \\\"module\\\": \\\"commonjs\\\", \\\"moduleResolution\\\": \\\"node\\\", \\\"isolatedModules\\\": false }\" auto",
     "shipit": "pnpm auto shipit",
     "shipit:verbose": "pnpm auto shipit -v",
     "auto:version": "pnpm auto version -v",
```

---

### Incident Patch 6: `5e09f149` (2025-02-14)
**Commit Message**: chore: fix types from accepted PR #2535

**File**: `packages/components/src/Flex.tsx` (modified, +5/-3)
```diff
@@ -1,4 +1,6 @@
 import React from 'react'
+import { Theme } from '@theme-ui/core'
+
 import { Box, BoxOwnProps, BoxProps } from './Box'
 import { ForwardRef } from './types'
 
@@ -11,14 +13,14 @@ export type FlexProps = BoxProps
  */
 export const Flex: ForwardRef<HTMLElement, FlexProps> = React.forwardRef(
   function Flex(props: FlexProps, ref) {
-    const { sx } = props;
+    const { sx } = props
     return (
       <Box
         ref={ref}
         {...props}
-        sx={theme => ({
+        sx={(theme: Theme) => ({
           display: 'flex',
-          ...(typeof sx === "function" ? sx(theme) : sx),
+          ...(typeof sx === 'function' ? sx(theme) : sx),
         })}
       />
     )
```

---

### Incident Patch 7: `93ce9f6d` (2025-02-12)
**Commit Message**: fix(Flex): handle derived sx in Flex

**File**: `packages/components/src/Flex.tsx` (modified, +4/-3)
```diff
@@ -11,14 +11,15 @@ export type FlexProps = BoxProps
  */
 export const Flex: ForwardRef<HTMLElement, FlexProps> = React.forwardRef(
   function Flex(props: FlexProps, ref) {
+    const { sx } = props;
     return (
       <Box
         ref={ref}
         {...props}
-        sx={{
+        sx={theme => ({
           display: 'flex',
-          ...props.sx,
-        }}
+          ...(typeof sx === "function" ? sx(theme) : sx),
+        })}
       />
     )
   }
```

---

### Incident Patch 8: `401b7945` (2024-10-24)
**Commit Message**: fix(types): don't lock csstype version

**File**: `packages/css/package.json` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@
     "access": "public"
   },
   "dependencies": {
-    "csstype": "3.0.10"
+    "csstype": "^3.0.10"
   },
   "peerDependencies": {
     "@emotion/react": "^11.11.1"
```

**File**: `packages/css/test/errors-and-inference.ts` (modified, +0/-63)
```diff
@@ -7,42 +7,6 @@ const expectSnippet = expecter(`
 `)
 
 describe('Theme', () => {
-  test('shows friendly error only on bad property', () => {
-    expectSnippet(`
-      css({
-        bg: 'salmon',
-        whiteSpace: 'no-works',
-        '> form': {
-          color: 'blue',
-          widows: 'bar',
-          // unknown CSS property is accepted
-          whitePace: 'this-works',
-        },
-      })
-    `).toFail(
-      /Error snippet\.tsx \(\d+,\d+\): Type '"no-works"' is not assignable to type [\s\S]+'./
-    )
-  })
-
-  test('shows friendly error on nested object', () => {
-    expectSnippet(`
-      css({
-        bg: 'salmon',
-        '> form': {
-          color: 'blue',
-          whiteSpace: 'banana',
-        },
-      })
-    `).toFail(
-      new RegExp(
-        `Error snippet\\.tsx \\(\\d+,\\d+\\): Type '{ color: "blue"; whiteSpace: "banana"; }'` +
-          ` is not assignable to type '[\\s\\S]+'.\\n\\s+` +
-          `Types of property 'whiteSpace' are incompatible.\\n\\s+` +
-          `Type '"banana"' is not assignable to type [\\s\\S]+`
-      )
-    )
-  })
-
   test('accepts unknown CSS property without error', () => {
     expect(css({ '> form': { windows: 'baz' } })({})).toStrictEqual({
       '> form': { windows: 'baz' },
@@ -96,9 +60,6 @@ describe('Theme', () => {
     css({ size: (t) => get(t, 'space.3') + get(t, 'sizes.5') })
 
     const parse = (x: string | number | undefined | {}) => parseInt(String(x))
-    css({
-      size: (t) => parse(t.space?.[3]) + parse(t.sizes?.[5]),
-    })
 
     // Current limitation. If you broke this one, that's actually pretty awesome,
     // but TypeScript chapter in the docs needs an update.
@@ -110,30 +71,6 @@ describe('Theme', () => {
   })
 })
 
-// This is not a feature, but the TypeScript chapter in the docs will need an
-// update if this test fails.
-test('inferred type `string` is too wide for `whiteSpace`', () => {
-  expectSnippet(`
-    const style = {
-      whiteSpace: 'pre-line'
-    }
-
-    css(style);
-  `).toFail(
-    /Type '{ whiteSpace: string; }' is not assignable to type 'ThemeUICSSObject'./
-  )
-
-  expectSnippet(`
-    import { ThemeUICSSObject } from './packages/css'
-
-    const style: ThemeUICSSObject = {
-      whiteSpace: 'pre-line'
-    }
-
-    css(style);
-  `).toSucceed()
-})
-
 describe('ColorMode', () => {
   const expectedSnippet = expectSnippet(`
     import { ColorMode } from './packages/css/src'
```

**File**: `packages/css/test/past-bugs.ts` (modified, +7/-0)
```diff
@@ -32,3 +32,10 @@ describe('theme scales, get and default object property (#1439)', () => {
     expect(actual).toStrictEqual({ zIndex: 1 })
   })
 })
+
+// https://github.com/system-ui/theme-ui/issues/2520
+it('accepts number as aspect ratio', () => {
+  const actual = css({ aspectRatio: 0.5 })({})
+
+  expect(actual).toStrictEqual({ aspectRatio: 0.5 })
+})
```

**File**: `packages/docs/src/pages/guides/typescript.mdx` (modified, +0/-47)
```diff
@@ -127,50 +127,3 @@ const syntaxHighlighting = theme.syntaxHighlighting
 
 _[Try it in TypeScript Playground.](https://www.typescriptlang.org/v2/en/play?#code/JYWwDg9gTgLgBAbzgFQBYFMTrgXzgMyghDgHIYMsBaAV2FIG4AoJ4AOxnSnwEMBjbAFkAngGVhHHgA8AEsADmqADYLUMdvLSZsCJnALR08ojTYATAFxwAzjCgbmOFmfR8lPKNhAQzNJdnJKdFp6RD04dk5ufmwtLDD9fWsJGGk5RRVFdTZ5KxFxSVlVTLUNOPRwpycmPgg2WzgKbStyuABeBJsUtOLVbNzO-XxDYwhTSzIAYgAmWdIAGkqmHGYauobkwvTlPo12xqCAOk3UoozdnLX6+C4iKH2mrGPhGDYe86yNJiA)_
 
-## Common Problems
-
-### Union types are not inferred without explicit annotation
-
-Style objects defined outside of `css` function and `sx` prop need explicit
-annotation to prevent following error.
-
-```tsx
-/** @jsxImportSource theme-ui */
-
-const style = { whiteSpace: 'pre-line' }
-
-// Type '{ whiteSpace: string; }' is not assignable to type 'ThemeUICSSObject'.
-// Type 'string' is not assignable to type '"inherit" | "initial" | "revert" | "unset" | "normal" | "break-spaces"
-return <div sx={style} />
-```
-
-_[Try it on CodeSandbox.](https://codesandbox.io/s/theme-ui-inferrence-too-wide-vkrf5?file=/src/index.tsx&view=editor&previewwindow=tests)_
-
-TypeScript assumes that `whiteSpace` here is a `string`, but the `whiteSpace`
-property in `ThemeUICSSObject` is a union of possible white-space values
-([see on MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/white-space#Values))
-or a nested style object.
-
-We can explicitly annotate `style` ensure that it is a correct Theme UI style
-object and that `whiteSpace` is one of appropriate values.
-
-```tsx
-/** @jsxImportSource theme-ui */
-import { ThemeUICSSObject } from 'theme-ui'
-
-const style: ThemeUICSSObject = { whiteSpace: 'pre-line' }
-
-// No error
-return <div sx={style} />
-```
-
-_[Try it on CodeSandbox.](https://codesandbox.io/s/theme-ui-inferrence-too-wide-vkrf5?file=/src/index.tsx&view=editor&previewwindow=tests)_
-
-We could also fix our problem by narrowing the type of `style` with a
-[const assertion](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions).
-
-```tsx
-const style = { whiteSpace: 'pre-line' } as const
-```
-
-This is succinct, but error prone, because we won't get TS intellisense support inside of this object.
```

**File**: `packages/typography/package.json` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
     "@types/modularscale": "^2.0.0",
     "@types/typography": "^0.16.4",
     "compass-vertical-rhythm": "^1.4.5",
-    "csstype": "3.0.10",
+    "csstype": "^3.0.10",
     "modularscale": "^2.0.1",
     "type-fest": "^2.18.0"
   },
```

---

### Incident Patch 9: `f9fbb7de` (2024-10-17)
**Commit Message**: Merge pull request #2519 from system-ui/fix-root-styles

fix(color-modes): make useRootStyles=false work with useCustomProperties

**File**: `.github/workflows/ci.yml` (modified, +3/-3)
```diff
@@ -17,7 +17,7 @@ jobs:
 
       - uses: pnpm/action-setup@v2
         with:
-          version: 8
+          version: 9.12.1
 
       - uses: actions/setup-node@v3
         with:
@@ -81,7 +81,7 @@ jobs:
 
       - uses: pnpm/action-setup@v2
         with:
-          version: 8
+          version: 9.12.1
 
       - uses: actions/setup-node@v3
         with:
@@ -90,7 +90,7 @@ jobs:
           registry-url: 'https://registry.npmjs.org'
 
       - name: Install
-        run: pnpm install --no-optional --no-frozen-lockfile
+        run: pnpm install --no-optional
 
       - name: Queue in release turnstile
         id: turnstyle
```

**File**: `.github/workflows/e2e.yml` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ jobs:
 
       - uses: pnpm/action-setup@v2
         with:
-          version: 7
+          version: 9.12.1
 
       - uses: actions/setup-node@v2
         with:
```

**File**: `auto.config.ts` (modified, +2/-2)
```diff
@@ -13,7 +13,7 @@ const conventionalCommitsOptions: ConventionalCommitsOptions = {
   defaultReleaseType: 'none',
 }
 
-const allContributorsOptions: IAllContributorsPluginOptions = {
+const _allContributorsOptions: IAllContributorsPluginOptions = {
   exclude: [
     'dependabot',
     'dependabot[bot]',
@@ -61,7 +61,7 @@ export default function config(): AutoRc {
       ['conventional-commits', conventionalCommitsOptions],
       'first-time-contributor',
       'released',
-      ['all-contributors', allContributorsOptions],
+      // ['all-contributors', allContributorsOptions],
       ['omit-commits', omitCommitsOptions],
       // 'magic-zero',
     ],
```

**File**: `examples/gatsby-plugin/package.json` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
     "build": "gatsby build"
   },
   "dependencies": {
-    "@emotion/react": "^11.11.1",
+    "@emotion/react": "^11.13.3",
     "gatsby": "^5",
     "gatsby-plugin-mdx": "^5",
     "gatsby-plugin-theme-ui": "workspace:^",
```

**File**: `examples/gatsby/package.json` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
     "build": "gatsby build"
   },
   "dependencies": {
-    "@emotion/react": "^11.11.1",
+    "@emotion/react": "^11.13.3",
     "@mdx-js/react": "^2.3.0",
     "@theme-ui/mdx": "workspace:^",
     "gatsby": "^5",
```

---

### Incident Patch 10: `ef9aa897` (2024-10-17)
**Commit Message**: chore(docs): fix a bug in sidenav

**File**: `packages/docs/src/components/sidenav.tsx` (modified, +3/-1)
```diff
@@ -123,7 +123,9 @@ export const AccordionButton = (props: {
   onClick: EventHandler<MouseEvent<HTMLButtonElement>>
 }) => {
   const transform = props.open ? 'rotate(-180 8 8)' : 'rotate(0 8 8)'
-  const disabled = props.pathname ? props.pathname === props.href : false
+  const disabled = props.pathname
+    ? props.href.startsWith(props.pathname)
+    : false
 
   return (
     <button
```

#### Recent Merged Pull Requests:
- **PR #2569** (closed): chore(deps): bump next from 15.5.9 to 15.5.15 (@dependabot[bot])
- **PR #2568** (closed): chore(deps): bump next from 15.5.9 to 15.5.14 (@dependabot[bot])
- **PR #2567** (2026-03-05): fix next example build (@hasparus)
- **PR #2566** (2026-03-05): chore(deps-dev): bump webpack from 5.95.0 to 5.104.1 (@dependabot[bot])
- **PR #2564** (closed): chore(deps): bump next from 15.5.9 to 16.1.5 (@dependabot[bot])
- **PR #2562** (2025-12-30): chore(deps): bump @types/node from 20.16.11 to 25.0.3 (@dependabot[bot])
- **PR #2561** (2025-12-30): chore(deps): bump gatsby-plugin-react-helmet from 6.13.1 to 6.15.0 (@dependabot[bot])
- **PR #2560** (2025-12-30): chore(deps): bump esbuild from 0.24.0 to 0.27.2 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
