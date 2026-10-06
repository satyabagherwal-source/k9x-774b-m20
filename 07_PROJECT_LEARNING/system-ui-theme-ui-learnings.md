# Forensic Learning Record (Deep Inspection): system-ui/theme-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/system-ui-theme-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/system-ui/theme-ui](https://github.com/system-ui/theme-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:04:18.457Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `system-ui/theme-ui`
- **Description**: Build consistent, themeable React apps based on constraint-based design principles
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5398 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/components/src/util.ts`
```
import type { ThemeUICSSObject, ThemeUICSSProperties } from '@theme-ui/css'

export const getProps =
  (test: (k: string) => boolean) =>
  <T extends object>(props: T): T => {
    const next: Partial<T> = {}
    for (const key in props) {
      if (test(key || '')) next[key] = props[key]
    }
    return next as T
  }

const MRE = /^m[trblxy]?$/

export interface MarginProps
  extends Pick<
    ThemeUICSSProperties,
    'm' | 'mt' | 'mr' | 'mb' | 'ml' | 'mx' | 'my'
  > {}

export const getMargin: (props: MarginProps) => MarginProps = getProps((k) =>
  MRE.test(k)
)
export const omitMargin = getProps((k) => !MRE.test(k))

/** @internal */
export function __internalProps(props: __ThemeUIComponentsInternalProps) {
  return props as {}
}

/**
 * @internal Props used by Theme UI Components not intended for user code.
 */
export interface __ThemeUIComponentsInternalProps {
  __css?: ThemeUICSSObject
  __themeKey?: string
}

```

### Core Architecture Module: `packages/core/src/index.ts`
```
import {
  jsx as emotionJsx,
  ThemeContext as EmotionContext,
} from '@emotion/react'
import { Theme } from '@theme-ui/css'
import * as React from 'react'
import deepmerge from 'deepmerge'
import packageInfo from '@emotion/react/package.json'
import { parseProps } from './parseProps'

import { ThemeUIJSX } from './jsx-namespace'
export type { ThemeUIJSX } from './jsx-namespace'

export type {
  CSSObject,
  CSSOthersObject,
  CSSProperties,
  CSSPseudoSelectorProps,
  ColorMode,
  ColorModesScale,
  Label,
  ResponsiveStyleValue,
  Scale,
  StylePropertyValue,
  TLengthStyledSystem,
  ThemeDerivedStyles,
  ThemeStyles,
  ThemeUICSSObject,
  ThemeUICSSProperties,
  ThemeUIExtendedCSSProperties,
  ThemeUIStyleObject,
  VariantProperty,
} from '@theme-ui/css'

export * from './types'

const __EMOTION_VERSION__ = packageInfo.version

export const jsx: typeof React.createElement = <P extends {}>(
  type: React.FunctionComponent<P> | React.ComponentClass<P> | string,
  props: React.Attributes & P,
  ...children: React.ReactNode[]
): any => emotionJsx(type, parseProps(props), ...children)

/**
 * @internal for Babel JSX pragma
 * @see https://github.com/system-ui/theme-ui/issues/1603
 */
export const createElement: unknown = jsx

export declare namespace jsx {
  export namespace JSX {
    export interface Element extends ThemeUIJSX.Element {}
    export interface ElementClass extends ThemeUIJSX.ElementClass {}
    export interface ElementAttributesProperty
      extends ThemeUIJSX.ElementAttributesProperty {}
    export interface ElementChildrenAttribute
      extends ThemeUIJSX.ElementChildrenAttribute {}
    export type LibraryManagedAttributes<C, P> =
      ThemeUIJSX.LibraryManagedAttributes<C, P>
    export interface IntrinsicAttributes
      extends ThemeUIJSX.IntrinsicAttributes {}
    export interface IntrinsicClassAttributes<T>
      extends ThemeUIJSX.IntrinsicClassAttributes<T> {}
    export type IntrinsicElements = ThemeUIJSX.IntrinsicElements
  }
}

export interface ThemeUIContextValue {
  __EMOTION_VERSION__: string
  theme: Theme
}

/**
 * @internal
 */
export const __themeUiDefaultContextValue: ThemeUIContextValue = {
  __EMOTION_VERSION__,
  theme: {},
}

/**
 * @internal
 */
export const __ThemeUIContext = React.createContext(
  __themeUiDefaultContextValue
)

export const useThemeUI = () => React.useContext(__ThemeUIContext)

const canUseSymbol = typeof Symbol === 'function' && Symbol.for

const REACT_ELEMENT = canUseSymbol ? Symbol.for('react.element') : 0xeac7
const FORWARD_REF = canUseSymbol ? Symbol.for('react.forward_ref') : 0xeac7

const deepmergeOptions: deepmerge.Options = {
  isMergeableObject: (n) => {
    return (
      !!n &&
      typeof n === 'object' &&
      (n as React.ExoticComponent).$$typeof !== REACT_ELEMENT &&
      (n as React.ExoticComponent).$$typeof !== FORWARD_REF
    )
  },
  arrayMerge: (_leftArray, rightArray) => rightArray,
}

/**
 * Deeply merge themes
 */
export const merge = (a: Theme, b: Theme): Theme =>
  deepmerge(a, b, deepmergeOptions)

function mergeAll<A, B>(a: A, B: B): A & B
function mergeAll<A, B, C>(a: A, B: B, c: C): A & B & C
function mergeAll<A, B, C, D>(a: A, B: B, c: C, d: D): A & B & C & D
function mergeAll<T = Theme>(...args: Partial<T>[]) {
  return deepmerge.all<T>(args, deepmergeOptions)
}

merge.all = mergeAll

export interface __ThemeUIInternalBaseThemeProviderProps {
  context: ThemeUIContextValue
  children: React.ReactNode
}
/**
 * @internal
 */
export const __ThemeUIInternalBaseThemeProvider = ({
  context,
  children,
}: __ThemeUIInternalBaseThemeProviderProps) =>
  jsx(
    EmotionContext.Provider,
    { value: context.theme },
    jsx(__ThemeUIContext.Provider, {
      value: context,
      children,
    })
  )

export interface ThemeProviderProps {
  theme: Theme | ((outerTheme: Theme) => Theme)
  children?: React.ReactNode
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const outer = useThemeUI()

  if (process.env.NODE_ENV !== 'production') {
    if (outer.__EMOTION_VERSION__ !== __EMOTION_VERSION__) {
      console.warn(
        'Multiple versions of Emotion detected,',
        'and theming might not work as expected.',
        'Please ensure there is only one copy of @emotion/react installed in your application.'
      )
    }
  }

  const context =
    typeof theme === 'function'
      ? { ...outer, theme: theme(outer.theme) }
      : merge.all({}, outer, { theme })

  return jsx(__ThemeUIInternalBaseThemeProvider, { context, children })
}

```

### Core Architecture Module: `packages/core/src/jsx-dev-runtime.ts`
```
// @ts-ignore
import { jsxDEV as emotionJsxDEV } from '@emotion/react/jsx-dev-runtime'
import { ThemeUIJSX } from './jsx-namespace'
import { parseProps } from './parseProps'
import type { ElementType } from 'react'

export { Fragment } from 'react'
export type { ThemeUIJSX as JSX } from './jsx-namespace'

export const jsxDEV = <P>(
  type: ElementType<P>,
  props: P,
  key: string | undefined,
  isStaticChildren: boolean,
  source: {
    filename: string
    lineNumber: number
    columnNumber: number
  },
  self: any
): ThemeUIJSX.Element =>
  emotionJsxDEV(type, parseProps(props), key, isStaticChildren, source, self)

```

### Core Architecture Module: `packages/core/src/jsx-namespace.ts`
```
import type { SxProp } from './types'
import type { JSX as ReactJSX } from 'react'

type WithConditionalSxProp<P> = 'className' extends keyof P
  ? string extends P['className']
    ? P & SxProp
    : P
  : P

export declare namespace ThemeUIJSX {
  export type Element = ReactJSX.Element
  export type ElementType = ReactJSX.ElementType
  export type ElementClass = ReactJSX.ElementClass
  export type ElementAttributesProperty = ReactJSX.ElementAttributesProperty
  export type ElementChildrenAttribute = ReactJSX.ElementChildrenAttribute
  export type LibraryManagedAttributes<C, P> = WithConditionalSxProp<P> &
    // We are not removing incompatible `sx` props, because touching this breaks
    // inference in generic components.
    // Yes, we steal any prop called `sx` at runtime, but we
    // can't represent it on type level without breaking compatibility with
    // our own Field, react-hook-form, and a bunch of other generic components.
    // Don't touch ReactJSXLibraryManagedAttributes or you'll spend hours
    // debugging and entirely spoil your day.
    ReactJSX.LibraryManagedAttributes<C, P>
  export type IntrinsicAttributes = ReactJSX.IntrinsicAttributes
  export type IntrinsicClassAttributes<T> = ReactJSX.IntrinsicClassAttributes<T>
  export type IntrinsicElements = {
    [K in keyof ReactJSX.IntrinsicElements]: ReactJSX.IntrinsicElements[K] &
      SxProp
  }
}

```

### Core Architecture Module: `packages/core/src/jsx-runtime.ts`
```
import {
  // @ts-ignore
  jsx as emotionJsx,
  // @ts-ignore
  jsxs as emotionJsxs,
} from '@emotion/react/jsx-runtime'
import { ThemeUIJSX } from './jsx-namespace'
import { parseProps } from './parseProps'
import type { ElementType } from 'react'

export { Fragment } from 'react'
export type { ThemeUIJSX as JSX } from './jsx-namespace'

export const jsx = <P>(
  type: ElementType<P>,
  props: P,
  key?: string
): ThemeUIJSX.Element => emotionJsx(type, parseProps(props), key)

export const jsxs = <P>(
  type: ElementType<P>,
  props: P,
  key?: string
): ThemeUIJSX.Element => emotionJsxs(type, parseProps(props), key)

```

### Core Architecture Module: `packages/core/src/parseProps.tsx`
```
import { css } from '@theme-ui/css'

const getCSS = (props: any) => (theme: any) => {
  const styles = css(props.sx)(theme)
  const raw = typeof props.css === 'function' ? props.css(theme) : props.css
  return [styles, raw]
}

export function parseProps(props: any) {
  if (!props || (!props.sx && !props.css)) return props

  const next: Record<string, unknown> = {}

  for (let key in props) {
    if (key === 'sx') continue
    next[key] = props[key]
  }

  next.css = getCSS(props)
  return next
}

```

### Core Architecture Module: `packages/core/src/types.ts`
```
import { Interpolation } from '@emotion/react'
import {
  Scale,
  ScaleDict,
  ThemeUIStyleObject,
  Theme as ThemeUITheme,
} from '@theme-ui/css'

export interface UserThemes {}

/** @internal */
export type _UserTheme = UserThemes[keyof UserThemes]

/** Theme without array scales, so it's easier to read from inside of .sx prop */
export type WidenedTheme = {
  [P in keyof ThemeUITheme]: ThemeUITheme[P] extends Scale<infer R> | undefined
    ? ScaleDict<R>
    : ThemeUITheme[P]
} & ThemeUITheme

export type Theme<TTheme = {}> = _UserTheme extends never
  ? ThemeUITheme<TTheme>
  : _UserTheme

/** @internal */
export type _JSXTheme = _UserTheme extends never ? WidenedTheme : _UserTheme

export interface SxProp {
  /**
   * The sx prop lets you style elements inline, using values from your
   * theme.
   *
   * @see https://theme-ui.com/sx-prop/
   */
  sx?: ThemeUIStyleObject<_JSXTheme>
  /**
   * Theme UI uses Emotion's JSX function. You can pass styles to it directly
   * using `css` prop.
   * @see https://theme-ui.com/sx-prop/#raw-css
   */
  css?: Interpolation<ThemeUITheme>
}

```

### Core Architecture Module: `packages/css/src/utils.ts`
```
import type { ColorModesScale, Theme, ThemeStyles } from './types'

/**
 * Constrained identity function used to constrain user's theme type to Theme
 * while preserving its exact type.
 */
export const makeTheme = <T extends Theme>(theme: T): T => theme

/**
 * Constrained identity function used to create a styles dictionary
 * assignable to ThemeStyles while preserving its exact type.
 */
export const makeStyles = <T extends ThemeStyles>(styles: T): T => styles

export const makeColorsScale = <T extends ColorModesScale>(colors: T) => colors

```

### Core Architecture Module: `packages/gatsby-plugin-theme-ui/src/hooks/configOptions.js`
```
import { useStaticQuery, graphql } from 'gatsby'

const useThemeUiConfig = () => {
  const data = useStaticQuery(graphql`
    query {
      themeUiConfig(id: { eq: "gatsby-plugin-theme-ui-config" }) {
        preset
        prismPreset
      }
    }
  `)

  return data.themeUiConfig
}

export default useThemeUiConfig

```

### Core Architecture Module: `packages/gatsby-plugin-theme-ui/utils/preset-dictionary.js`
```
module.exports = {
  dracula: '@theme-ui/prism/presets/dracula.json',
  'duotone-dark': '@theme-ui/prism/presets/duotone-dark.json',
  'duotone-light': '@theme-ui/prism/presets/duotone-light.json',
  github: '@theme-ui/prism/presets/github.json',
  'night-owl-light': '@theme-ui/prism/presets/night-owl-light.json',
  'night-owl': '@theme-ui/prism/presets/night-owl.json',
  'oceanic-next': '@theme-ui/prism/presets/oceanic-next.json',
  'prism-coy': '@theme-ui/prism/presets/prism-coy.json',
  'prism-dark': '@theme-ui/prism/presets/prism-dark.json',
  'prism-funky': '@theme-ui/prism/presets/prism-funky.json',
  'prism-okaidia': '@theme-ui/prism/presets/prism-okaidia.json',
  'prism-solarizedlight': '@theme-ui/prism/presets/prism-solarizedlight.json',
  'prism-tomorrow': '@theme-ui/prism/presets/prism-tomorrow.json',
  'prism-twilight': '@theme-ui/prism/presets/prism-twilight.json',
  prism: '@theme-ui/prism/presets/prism.json',
  'shades-of-purple': '@theme-ui/prism/presets/shades-of-purple.json',
  'theme-ui': '@theme-ui/prism/presets/theme-ui.json',
  ultramin: '@theme-ui/prism/presets/ultramin.json',
  'vs-dark': '@theme-ui/prism/presets/vs-dark.json',
}

```

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

**File**: `packages/components/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@theme-ui/components",
-  "version": "0.17.2-develop.1",
+  "version": "0.17.4",
   "main": "dist/theme-ui-components.cjs.js",
   "module": "dist/theme-ui-components.esm.js",
   "types": "dist/theme-ui-components.cjs.d.ts",
```

**File**: `packages/core/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@theme-ui/core",
-  "version": "0.17.2-develop.1",
+  "version": "0.17.4",
   "source": "src/index.ts",
   "main": "dist/theme-ui-core.cjs.js",
   "module": "dist/theme-ui-core.esm.js",
```

**File**: `packages/css/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@theme-ui/css",
-  "version": "0.17.2-develop.1",
+  "version": "0.17.4",
   "source": "src/index.ts",
   "main": "dist/theme-ui-css.cjs.js",
   "module": "dist/theme-ui-css.esm.js",
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
       tailwindcss:
         specifier: ^3.0.15
-        version: 3.4.14(ts-node@10.9.2(@types/node@25.0.3)(typescript@5.9.3))
+        version: 3.4.14(ts-node@10.9.2(@types/node@25.2.1)(typescript@5.9.3))
 
   packages/test-utils:
     dependencies:
@@ -3899,6 +3899,9 @@ packages:
   '@types/node@25.0.3':
     resolution: {integrity: sha512-W609buLVRVmeW693xKfzHeIV6nJGGz98uCPfeXI1ELMLXVeKYZ9m15fAMSaUPBHYLGFsVRcMmSCksQOrZV9BYA==}
 
+  '@types/node@25.2.1':
+    resolution: {integrity: sha512-CPrnr8voK8vC6eEtyRzvMpgp3VyVRhgclonE7qYi6P9sXwYb59ucfrnmFBTaP0yUi8Gk4yZg/LlTJULGxvTNsg==}
+
   '@types/node@8.10.66':
     resolution: {integrity: sha512-tktOkFUA4kXx2hhhrB8bIFb5TbwzS4uOhKEmwiD+NoiL0qtP2OQ9mFldbgD4dV1djrlBYP6eBuQZiWjuHUpqFw==}
 
@@ -4788,8 +4791,8 @@ packages:
     resolution: {integrity: sha512-lGe34o6EHj9y3Kts9R4ZYs/Gr+6N7MCaMlIFA3F1R2O5/m7K06AxfSeO5530PEERE6/WyEg3lsuyw4GHlPZHog==}
     engines: {node: ^4.5.0 || >= 5.9}
 
-  baseline-browser-mapping@2.9.11:
-    resolution: {integrity: sha512-Sg
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
     engines: {node: '>=18'}
     hasBin: true
 
-  escalade@3.1.1:
-    resolution: {integrity: sha512-k0er2gUkLf8O0zKJiAhmkTnJlTvINGv7ygDNPbeIsX/TJjGJZHuh9B2UxbsaEkmlEo9MfhrSzmhIlhRlI2GXnw==}
-    engines: {node: '>=6'}
-
   escalade@3.2.0:
     resolution: {integrity: sha512-WUj2qlxaQtO4g6Pq5c29GTcWGDyd8itL8zTlipgECz3JesAiiOKotd8JU6otB3PACgG6xkJUyVhboMS+bje/jA==}
     engines: {node: '>=6'}
@@ -9135,9 +9104,6 @@ packages:
     resolution: {integrity: sha512-jY5dPJzw6NHd/KPSfPKJ+IHoFS81/tJ43r34ZeNMXGzCOM8jwQDCD12HYayKIB6MuznrnqIYy2e891NA2g0ibA==}
     engines: {node: '>=0.10.0'}
 
-  node-releases@2.0.13:
-    resolution: {integrity: sha512-uYr7J37ae/ORWdZeQ1xxMJe3NtdmqMC/JZK+geofDrkLUApKRHPd18/TxtBOJ4A0/+uUIliorNrfYV6s1b02eQ==}
-
   node-releases@2.0.18:
     resolution: {integrity: sha512-d9VeXT4SJ7ZeOqGX6R5EM022wpL+eWPooLI+5UpWn2jCT1aosUQEhQP214x33Wkwx3JQMvIm+tIoVOdodFS40g==}
 
@@ -11921,12 +11887,6 @@ packages:
     resolution: {integrity: sha512-KK8xQ1mkzZeg9inewmFVDNkg3l5LUhoq9kN6iWYB/CC9YMG8HA+c1Q8HwDe6
```

---

### Incident Patch 4: `80d78119` (2026-03-05)
**Commit Message**: Merge pull request #2566 from system-ui/dependabot/npm_and_yarn/webpack-5.104.1

chore(deps-dev): bump webpack from 5.95.0 to 5.104.1

**File**: `examples/next/package.json` (modified, +1/-1)
```diff
@@ -25,6 +25,6 @@
   "devDependencies": {
     "@types/react": "^18.2.12",
     "typescript": "^5",
-    "webpack": "^5.91.0"
+    "webpack": "^5.104.1"
   }
 }
```

**File**: `pnpm-lock.yaml` (modified, +165/-203)
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
-        version: 2.3.0(webpack@5.95.0)
+        version: 2.3.0(webpack@5.105.0)
       '@mdx-js/react':
         specifier: ^2.3.0
         version: 2.3.0(react@18.3.1)
       '@next/mdx':
         specifier: ^14.0.4
-        version: 14.2.15(@mdx-js/loader@2.3.0(webpack@5.95.0))(@mdx-js/react@2.3.0(react@18.3.1))
+        version: 14.2.15(@mdx-js/loader@2.3.0(webpack@5.105.0))(@mdx-js/react@2.3.0(react@18.3.1))
       '@theme-ui/css':
         specifier: workspace:^
         version: link:../../packages/css
@@ -282,8 +282,8 @@ importers:
         specifier: ^5
         version: 5.6.3
       webpack:
-        specifier: ^5.91.0
-        version: 5.95.0
+        specifier: ^5.104.1
+        version: 5.105.0
 
   examples/typography:
     dependencies:
@@ -482,7 +482,7 @@ importers:
         version: 11.13.3(@types/react@18.3.11)(react@18.3.1)
       '@mdx-js/loader':
         specifier: ^2.3.0
-        version: 2.3.0(webpack@5.104.1)
+        version: 2.3.0(webpack@5.105.0)
       '@mdx-js/react':
         specifier: ^2.3.0
         version: 2.3.0(react@18.3.1)
@@ -1164,7 +1164,7 @@ importers:
         version: 5.1.1
       tailwindcss:
         specifier: ^3.0.15
-        version: 3.4.14(ts-node@10.9.2(@types/node@25.0.3)(typescript@5.9.3))
+        version: 3.4.14(ts-node@10.9.2(@types/node@25.2.1)(typescript@5.9.3))
 
   packages/test-utils:
     dependencies:
@@ -3806,9 +3806,6 @@ packages:
   '@types/estree@0.0.39':
     resolution: {integrity: sha512-EYNwp3bU+98cpU4lAWYYL7Zz+2gryWH1qbdDTidVd6hkiR6weksdbMadyXKXNPEkQFhXM+hVO9ZygomHXp+AIw==}
 
-  '@types/estree@1.0.5':
-    resolution: {integrity: sha512-/kYRxGDLWzHOB7q+wtSUQlFrtcdUccpfy+X+9iMBpHK8QLLhx2wIPYuS5DYtR9Wa/YlZAbIovy7qVdB1Aq6Lyw==}
-
   '@types/estree@1.0.6':
     resolution: {integrity: sha512-AYnb1nQyY49te+VRAVgmzfcgjYS91mY5P0TKUDCLEM+gNnA+3T6rWITXRLYCpahpqSQbN5cE+gHpnPyXjHWxcw==}
 
@@ -3905,6 +3902,9 @@ pac
```

---

### Incident Patch 5: `fcbc1fdd` (2025-12-29)
**Commit Message**: chore(deps): bump esbuild from 0.24.0 to 0.27.2

Bumps [esbuild](https://github.com/evanw/esbuild) from 0.24.0 to 0.27.2.
- [Release notes](https://github.com/evanw/esbuild/releases)
- [Changelog](https://github.com/evanw/esbuild/blob/main/CHANGELOG-2024.md)
- [Commits](https://github.com/evanw/esbuild/compare/v0.24.0...v0.27.2)

---
updated-dependencies:
- dependency-name: esbuild
  dependency-version: 0.27.2
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `packages/e2e/package.json` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
     "@percy/cypress": "^3.1.1",
     "@testing-library/cypress": "^8.0.2",
     "cypress": "10.4.0",
-    "esbuild": "^0.24.0",
+    "esbuild": "^0.27.2",
     "wait-on": "^6.0.1"
   }
 }
```

**File**: `pnpm-lock.yaml` (modified, +124/-104)
```diff
@@ -738,7 +738,7 @@ importers:
     optionalDependencies:
       '@bahmutov/cypress-esbuild-preprocessor':
         specifier: ^2.2.3
-        version: 2.2.3(esbuild@0.24.0)
+        version: 2.2.3(esbuild@0.27.2)
       '@percy/cli':
         specifier: ^1.30.1
         version: 1.30.1(typescript@5.9.3)
@@ -752,8 +752,8 @@ importers:
         specifier: 10.4.0
         version: 10.4.0
       esbuild:
-        specifier: ^0.24.0
-        version: 0.24.0
+        specifier: ^0.27.2
+        version: 0.27.2
       wait-on:
         specifier: ^6.0.1
         version: 6.0.1
@@ -2437,146 +2437,158 @@ packages:
     peerDependencies:
       cosmiconfig: '>=6'
 
-  '@esbuild/aix-ppc64@0.24.0':
-    resolution: {integrity: sha512-WtKdFM7ls47zkKHFVzMz8opM7LkcsIp9amDUBIAWirg70RM71WRSjdILPsY5Uv1D42ZpUfaPILDlfactHgsRkw==}
+  '@esbuild/aix-ppc64@0.27.2':
+    resolution: {integrity: sha512-GZMB+a0mOMZs4MpDbj8RJp4cw+w1WV5NYD6xzgvzUJ5Ek2jerwfO2eADyI6ExDSUED+1X8aMbegahsJi+8mgpw==}
     engines: {node: '>=18'}
     cpu: [ppc64]
     os: [aix]
 
-  '@esbuild/android-arm64@0.24.0':
-    resolution: {integrity: sha512-Vsm497xFM7tTIPYK9bNTYJyF/lsP590Qc1WxJdlB6ljCbdZKU9SY8i7+Iin4kyhV/KV5J2rOKsBQbB77Ab7L/w==}
+  '@esbuild/android-arm64@0.27.2':
+    resolution: {integrity: sha512-pvz8ZZ7ot/RBphf8fv60ljmaoydPU12VuXHImtAs0XhLLw+EXBi2BLe3OYSBslR4rryHvweW5gmkKFwTiFy6KA==}
     engines: {node: '>=18'}
     cpu: [arm64]
     os: [android]
 
-  '@esbuild/android-arm@0.24.0':
-    resolution: {integrity: sha512-arAtTPo76fJ/ICkXWetLCc9EwEHKaeya4vMrReVlEIUCAUncH7M4bhMQ+M9Vf+FFOZJdTNMXNBrWwW+OXWpSew==}
+  '@esbuild/android-arm@0.27.2':
+    resolution: {integrity: sha512-DVNI8jlPa7Ujbr1yjU2PfUSRtAUZPG9I1RwW4F4xFB1Imiu2on0ADiI/c3td+KmDtVKNbi+nffGDQMfcIMkwIA==}
     engines: {node: '>=18'}
     cpu: [arm]
     os: [android]
 
-  '@esbuild/android-x64@0.24.0':
-    resolution: {integrity: sha512-t8GrvnFkiIY7pa7mMgJd7p8p8qqYIz1NYiAoKc75Zyv73L3DZW++oYMSHPRarcotTKuSs6m3hTOa5CKHaS02TQ==}
+  '@esbuild/android-x64@0.27.2':
+    resolution: {integrity: sha512-z8Ank4Byh4TJJOh4wpz8g2vDy75zFL0TlZlkUkEwYXuPSgX8yzep596n6mT7905kA9uHZsf/o2OJZubl2l3M7A==}
     engines: {node: '>=18'}
     cpu: [x64]
     os: [android]
 
-  '@esbuild/darwin-arm64@0.24.0':
-    resolution: {integrity: sha512-CKyDpRbK1hXwv79soeTJNHb5EiG6ct3efd/FTPdzOWdbZZfGhpbcqIpiD0+vwmpu0wTIL97ZRPZu8vUt46nBSw==}
+  '@esbuild/darwin-arm64@0.27.2':
+    resolution: {integrity: sha512-davCD2Zc80nzDVRwXTcQP/28fiJbcOwvdolL0sOiOsbwBa72kegmVU0Wrh1MYrbuCL98Omp5dVhQFWRKR2ZAlg==}
     engines: {node: '>=18'}
     cpu: [arm64]
     os: [darwin]
 
-  '@esbuild/darwin-x64@0.24.0':
-    resolution: {integrity: sha512-rgtz6flkVkh58od4PwTRqxbKH9cOjaXCMZgWD905JOzjFKW+7EiUObfd/Kav+A6Gyud6WZk9w+xu6QLytdi2OA==}
+  '@esbuild/darwin-x64@0.27.2':
+    resolution: {integrity: sha512-ZxtijOmlQCBWGwbVmwOF/UCzuGIbUkqB1faQRf5akQmxRJ1ujusWsb3CVfk/9iZKr2L5SMU5wPBi1UWbvL+VQA==}
     engines: {node: '>=18'}
     cpu: [x64]
     os: [darwin]
 
-  '@esbuild/freebsd-arm64@0.24.0':
-    resolution: {integrity: sha512-6Mtdq5nHggwfDNLAHkPlyLBpE5L6hwsuXZX8XNmHno9JuL2+bg2BX5tRkwjyfn6sKbxZTq68suOjgWqCicvPXA==}
+  '@esbuild/freebsd-arm64@0.27.2':
+    resolution: {integrity: sha512-lS/9CN+rgqQ9czogxlMcBMGd+l8Q3Nj1MFQwBZJyoEKI50XGxwuzznYdwcav6lpOGv5BqaZXqvBSiB/kJ5op+g==}
     engines: {node: '>=18'}
     cpu: [arm64]
     os: [freebsd]
 
-  '@esbuild/freebsd-x64@0.24.0':
-    resolution: {integrity: sha512-D3H+xh3/zphoX8ck4S2RxKR6gHlHDXXzOf6f/9dbFt/NRBDIE33+cVa49Kil4WUjxMGW0ZIYBYtaGCa2+OsQwQ==}
+  '@esbuild/freebsd-x64@0.27.2':
+    resolution: {integrity: sha512-tAfqtNYb4YgPnJlEFu4c212HYjQWSO/w/h/lQaBK7RbwGIkBOuNKQI9tqWzx7Wtp7bTPaGC6MJvWI608P3wXYA==}
     engines: {node: '>=18'}
     cpu: [x64]
     os: [freebsd]
 
-  '@esbuild/linux-arm64@0.24.0':
-    resolution: {integrity: sha512-TDijPXTOeE3eaMkRYpcy3LarIg13dS9wWHRdwYRnzlwlA370rNdZqbcp0WTyyV/k2zSxfko52+C7jU5F9Tfj1g==}
+  '@esbuild/linux-arm64@0.27.2':
+    resolution: {integrity: sha512-hYxN8pr66NsCCiRFkHUAsxylNOcAQaxSSkHMMjcpx0si13t1LHFphxJZUiGwojB1a/Hd5OiPIqDdXONia6bhTw==}
     engines: {node: '>=18'}
     cpu: [arm64]
     os: [linux]
 
-  '@esbuild/linux-arm@0.24.0':
-    resolution: {integrity: sha512-gJKIi2IjRo5G6Glxb8d3DzYXlxdEj2NlkixPsqePSZMhLudqPhtZ4BUrpIuTjJYXxvF9njql+vRjB2oaC9XpBw==}
+  '@esbuild/linux-arm@0.27.2':
+    resolution: {integrity: sha512-vWfq4GaIMP9AIe4yj1ZUW18RDhx6EPQKjwe7n8BbIecFtCQG4CfHGaHuh7fdfq+y3LIA2vGS/o9ZBGVxIDi9hw==}
     engines: {node: '>=18'}
     cpu: [arm]
     os: [linux]
 
-  '@esbuild/linux-ia32@0.24.0':
-    resolution: {integrity: sha512-K40ip1LAcA0byL05TbCQ4yJ4swvnbzHscRmUilrmP9Am7//0UjPreh4lpYzvThT2Quw66MhjG//20mrufm40mA==}
+  '@esbuild/linux-ia32@0.27.2':
+    resolution: {integrity: sha512-MJt5BRRSScPDwG2hLelYhAAKh9imjHK5+NE/tvnRLbIqUWa+0E9N4WNMjmp/kXXPHZGqPLxggwVhz7QP8CTR8w==}
     engines: {node: '>=18'}
     cpu: [ia32]
     os: [linux]
 
-  '@esbuild/linux-loong64@0.24.0':
-    resolution: {integrity: sha512-0mswrYP/9ai+CU0BzBfP
```

---

### Incident Patch 6: `8ad58637` (2025-12-29)
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

### Incident Patch 7: `5f1defb0` (2025-12-29)
**Commit Message**: fix(ci): add moduleResolution override for auto script

TS_NODE_COMPILER_OPTIONS was setting module to commonjs but tsconfig
has moduleResolution: Bundler which requires ES modules. Adding
moduleResolution: node makes them compatible.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

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

### Incident Patch 8: `4d9fc3b9` (2025-12-29)
**Commit Message**: Merge pull request #2553 from system-ui/lachlanjc-patch-2

components: [Textarea] Add field-sizing: content

**File**: `packages/components/src/Textarea.tsx` (modified, +1/-0)
```diff
@@ -35,6 +35,7 @@ export const Textarea: ForwardRef<HTMLTextAreaElement, TextareaProps> =
             borderRadius: 4,
             color: 'inherit',
             bg: 'transparent',
+            fieldSizing: 'content',
           },
         })}
       />
```

**File**: `packages/components/test/__snapshots__/index.tsx.snap` (modified, +1/-0)
```diff
@@ -1515,6 +1515,7 @@ exports[`Textarea renders 1`] = `
   border-radius: 4px;
   color: inherit;
   background-color: transparent;
+  field-sizing: content;
 }
 
 <textarea
```

---

### Incident Patch 9: `822161f9` (2025-12-29)
**Commit Message**: Merge pull request #2555 from system-ui/copilot/sub-pr-2553

Update Textarea snapshot for field-sizing: content

**File**: `packages/components/test/__snapshots__/index.tsx.snap` (modified, +1/-0)
```diff
@@ -1514,6 +1514,7 @@ exports[`Textarea renders 1`] = `
   border-radius: 4px;
   color: inherit;
   background-color: transparent;
+  field-sizing: content;
 }
 
 <textarea
```

---

### Incident Patch 10: `a43fca7d` (2025-12-29)
**Commit Message**: Merge pull request #2552 from system-ui/lachlanjc-patch-1

components: [Alert] Add ARIA role

**File**: `.github/dependabot.yml` (modified, +0/-1)
```diff
@@ -7,7 +7,6 @@ updates:
       interval: monthly
     open-pull-requests-limit: 10
     ignore:
-      - dependency-name: '@codechecks/client'
       - dependency-name: '*'
         update-types: ['version-update:semver-patch']
       - dependency-name: 'gatsby-plugin-mdx' # pinned to 2.4
```

**File**: `.github/workflows/ci.yml` (modified, +14/-14)
```diff
@@ -15,13 +15,11 @@ jobs:
     steps:
       - uses: actions/checkout@v4
 
-      - uses: pnpm/action-setup@v2
-        with:
-          version: 9.12.1
+      - uses: pnpm/action-setup@v4
 
-      - uses: actions/setup-node@v3
+      - uses: actions/setup-node@v4
         with:
-          node-version: 20.x
+          node-version: 22.x
           cache: 'pnpm'
 
       - name: Install
@@ -39,11 +37,13 @@ jobs:
       - name: Build
         run: pnpm build
 
-      - name: Run Codechecks
-        run: pnpm codechecks
-        env:
-          CC_SECRET: ${{ secrets.CC_SECRET }}
-        if: ${{ env.CC_SECRET != '' }}
+      # Commented out for now.
+      # - name: Check bundle size
+      #   uses: andresz1/size-limit-action@v1.8.0
+      #   with:
+      #     github_token: ${{ secrets.GITHUB_TOKEN }}
+      #     skip_step: install
+      #     package_manager: pnpm
 
   # Dependabot and PRs from forks should not release canaries,
   # but secrets and env vars cannot be read in `job.if`, so we check if
@@ -79,13 +79,13 @@ jobs:
           fetch-depth: 100
           fetch-tags: true
 
-      - uses: pnpm/action-setup@v2
+      - uses: pnpm/action-setup@v4
         with:
-          version: 9.12.1
+          version: 10
 
-      - uses: actions/setup-node@v3
+      - uses: actions/setup-node@v4
         with:
-          node-version: 20.x
+          node-version: 22.x
           cache: 'pnpm'
           registry-url: 'https://registry.npmjs.org'
 
```

**File**: `.github/workflows/e2e.yml` (modified, +3/-5)
```diff
@@ -21,13 +21,11 @@ jobs:
     steps:
       - uses: actions/checkout@v2
 
-      - uses: pnpm/action-setup@v2
-        with:
-          version: 9.12.1
+      - uses: pnpm/action-setup@v4
 
-      - uses: actions/setup-node@v2
+      - uses: actions/setup-node@v4
         with:
-          node-version: 18.x
+          node-version: 22.x
           cache: 'pnpm'
 
       - name: Install
```

**File**: `.nvmrc` (modified, +1/-1)
```diff
@@ -1 +1 @@
-18
+22
```

**File**: `.size-limit.json` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+[
+  { "path": "./packages/color/dist/theme-ui-color.esm.js", "gzip": true },
+  { "path": "./packages/color-modes/dist/theme-ui-color-modes.esm.js", "gzip": true },
+  { "path": "./packages/components/dist/theme-ui-components.esm.js", "gzip": true },
+  { "path": "./packages/core/dist/theme-ui-core.esm.js", "gzip": true },
+  { "path": "./packages/css/dist/theme-ui-css.esm.js", "gzip": true },
+  { "path": "./packages/custom-properties/dist/theme-ui-custom-properties.esm.js", "gzip": true },
+  { "path": "./packages/gatsby-plugin-theme-ui/dist/gatsby-plugin-theme-ui.cjs.js", "gzip": true },
+  { "path": "./packages/match-media/dist/theme-ui-match-media.esm.js", "gzip": true },
+  { "path": "./packages/mdx/dist/theme-ui-mdx.esm.js", "gzip": true },
+  { "path": "./packages/parse-props/dist/theme-ui-parse-props.esm.js", "gzip": true },
+  { "path": "./packages/prism/dist/theme-ui-prism.esm.js", "gzip": true },
+  { "path": "./packages/theme-provider/dist/theme-ui-theme-provider.esm.js", "gzip": true },
+  { "path": "./packages/theme-ui/dist/theme-ui.esm.js", "gzip": true },
+  { "path": "./packages/typography/dist/theme-ui-typography.esm.js", "gzip": true }
+]
```

**File**: `codechecks.yml` (removed, +0/-27)
```diff
@@ -1,27 +0,0 @@
-checks:
-  - name: build-size-watcher
-    options:
-      gzip: true
-      files:
-        - path: './packages/color/dist/theme-ui-color.esm.js'
-        - path: './packages/color-modes/dist/theme-ui-color-modes.esm.js'
-        - path: './packages/components/dist/theme-ui-components.esm.js'
-        - path: './packages/core/dist/theme-ui-core.esm.js'
-        - path: './packages/css/dist/theme-ui-css.esm.js'
-        - path: './packages/custom-properties/dist/theme-ui-custom-properties.esm.js'
-        - path: './packages/gatsby-plugin-theme-ui/dist/gatsby-plugin-theme-ui.cjs.js'
-        - path: './packages/match-media/dist/theme-ui-match-media.esm.js'
-        - path: './packages/mdx/dist/theme-ui-mdx.esm.js'
-        - path: './packages/parse-props/dist/theme-ui-parse-props.esm.js'
-        - path: './packages/prism/dist/theme-ui-prism.esm.js'
-        - path: './packages/theme-provider/dist/theme-ui-theme-provider.esm.js'
-        - path: './packages/theme-ui/dist/theme-ui.esm.js'
-        - path: './packages/typography/dist/theme-ui-typography.esm.js'
-  - name: typecov
-    options:
-      strict: true
-      atLeast: 96
-settings:
-  branches:
-    - develop
-    - stable
```

**File**: `examples/next/package.json` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
     "@mdx-js/react": "^2.3.0",
     "@next/mdx": "^14.0.4",
     "@theme-ui/css": "workspace:^",
-    "next": "^15.1.2",
+    "next": "^15.3.8",
     "react": "^18.1.0",
     "react-dom": "^18",
     "theme-ui": "workspace:^"
```

**File**: `examples/next/tsconfig.json` (modified, +3/-3)
```diff
@@ -8,13 +8,13 @@
     "forceConsistentCasingInFileNames": true,
     "noEmit": true,
     "esModuleInterop": true,
-    "module": "esnext",
-    "moduleResolution": "node",
+    "module": "ESNext",
+    "moduleResolution": "Bundler",
     "resolveJsonModule": true,
     "isolatedModules": true,
     "jsx": "preserve",
     "incremental": true
   },
-  "exclude": ["node_modules", ".next", "out"],
+  "exclude": ["node_modules", ".next", "out", "../../packages"],
   "include": ["**/*.ts", "**/*.tsx", "**/*.mdx", "lib/*.d.ts", "next-env.d.ts"]
 }
```

---

### Incident Patch 11: `35d021f7` (2025-12-29)
**Commit Message**: Add ci:build script

**File**: `packages/docs/package.json` (modified, +1/-0)
```diff
@@ -13,6 +13,7 @@
     "start": "gatsby develop",
     "dev": "gatsby develop",
     "build": "gatsby build",
+    "ci:build": "cd ../../ && pnpm build && pnpm run --filter docs build",
     "serve": "gatsby serve",
     "clean": "gatsby clean",
     "logo": "node ./scripts/svg-logo.js",
```

---

### Incident Patch 12: `c18e7181` (2025-12-29)
**Commit Message**: chore(ci): add engines to docs package.json to help Vercel build it

**File**: `packages/docs/package.json` (modified, +3/-0)
```diff
@@ -6,6 +6,9 @@
   "author": "Brent Jackson <jxnblk@gmail.com>",
   "license": "MIT",
   "repository": "system-ui/theme-ui",
+  "engines": {
+    "node": "22.x"
+  },
   "scripts": {
     "start": "gatsby develop",
     "dev": "gatsby develop",
```

---

### Incident Patch 13: `278543d8` (2025-12-29)
**Commit Message**: Merge pull request #2554 from system-ui/copilot/sub-pr-2552

Update Alert snapshot for role="alert" attribute

**File**: `packages/components/test/__snapshots__/index.tsx.snap` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@ exports[`Alert renders 1`] = `
 
 <div
   className="emotion-0"
+  role="alert"
 />
 `;
 
```

---

### Incident Patch 14: `5e09f149` (2025-02-14)
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

### Incident Patch 15: `93ce9f6d` (2025-02-12)
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
