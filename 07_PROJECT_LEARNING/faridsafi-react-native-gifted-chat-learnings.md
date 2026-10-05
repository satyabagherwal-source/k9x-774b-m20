# Forensic Learning Record (Deep Inspection): FaridSafi/react-native-gifted-chat

> **Canonical Artifact**: `07_PROJECT_LEARNING/faridsafi-react-native-gifted-chat-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/FaridSafi/react-native-gifted-chat](https://github.com/FaridSafi/react-native-gifted-chat))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:58:51.889Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `FaridSafi/react-native-gifted-chat`
- **Description**: 💬 The most complete chat UI for React Native
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 14444 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `example/app/chat/customized-rendering.tsx`
```
import CustomizedRenderingExample from '@/components/chat-examples/CustomizedRenderingExample'

export default CustomizedRenderingExample

```

### Core Architecture Module: `example/components/chat-examples/CustomizedRenderingExample.tsx`
```
import React from 'react'
import { StyleSheet, View, useColorScheme } from 'react-native'
import Chats from '../../example-gifted-chat/src/Chats'
import { getColorSchemeStyle } from '../../utils/styleUtils'

export default function CustomizedRenderingExample () {
  const colorScheme = useColorScheme()

  return (
    <View style={[styles.container, getColorSchemeStyle(styles, 'container', colorScheme)]}>
      <Chats />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container_dark: {
    backgroundColor: '#000',
  },
})

```

### Core Architecture Module: `example/example-expo/mediaUtils.ts`
```
import * as ImagePicker from 'expo-image-picker'
import { getCurrentPositionAsync, LocationObjectCoords, requestForegroundPermissionsAsync } from 'expo-location'

export async function getLocationAsync (): Promise<LocationObjectCoords | undefined> {
  const response = await requestForegroundPermissionsAsync()
  if (!response.granted)
    return

  const location = await getCurrentPositionAsync()
  if (!location)
    return

  return location.coords
}

export async function pickImageAsync (): Promise<string[] | undefined> {
  const response = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!response.granted)
    return

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [4, 3],
  })

  if (result.canceled)
    return

  return result.assets.map(({ uri }) => uri)
}

export async function takePictureAsync (): Promise<string[] | undefined> {
  const response = await ImagePicker.requestCameraPermissionsAsync()
  if (!response.granted)
    return

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 3],
  })

  if (result.canceled)
    return

  return result.assets.map(({ uri }) => uri)
}

```

### Core Architecture Module: `example/hooks/use-color-scheme.ts`
```
export { useColorScheme } from 'react-native'

```

### Core Architecture Module: `example/hooks/use-color-scheme.web.ts`
```
import { useEffect, useState } from 'react'
import { useColorScheme as useRNColorScheme } from 'react-native'

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme () {
  const [hasHydrated, setHasHydrated] = useState(false)

  useEffect(() => {
    setHasHydrated(true)
  }, [])

  const colorScheme = useRNColorScheme()

  if (hasHydrated)
    return colorScheme

  return 'light'
}

```

### Core Architecture Module: `example/hooks/use-theme-color.ts`
```
/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'

export function useThemeColor (
  props: { light?: string, dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light'
  const colorFromProps = props[theme]

  if (colorFromProps)
    return colorFromProps
  else
    return Colors[theme][colorName]
}

```

### Core Architecture Module: `example/hooks/useKeyboardVerticalOffset.ts`
```
import { useHeaderHeight } from '@react-navigation/elements'

/**
 * Hook to get the correct keyboardVerticalOffset for GiftedChat.
 *
 * The offset equals the distance from the screen top to the GiftedChat container top.
 * Uses useHeaderHeight() which includes status bar + navigation header height on iOS.
 *
 * Note: This hook requires the component to be rendered inside a proper navigation screen
 * (not conditional rendering). If useHeaderHeight returns 0, ensure your chat screen
 * is a real navigation screen with a visible header.
 *
 * @returns {number} keyboardVerticalOffset to pass to keyboardAvoidingViewProps
 */
export function useKeyboardVerticalOffset () {
  // useHeaderHeight() returns status bar + navigation header height on iOS
  return useHeaderHeight()
}

```

### Core Architecture Module: `example/utils/styleUtils.ts`
```
export function getColorSchemeStyle<T>(styles: T, baseName: string, colorScheme: string | null | undefined) {
  const key = `${baseName}_${colorScheme}` as keyof T
  return styles[key]
}

```

### Core Architecture Module: `src/hooks/useColorScheme.ts`
```
import { useColorScheme as useRNColorScheme } from 'react-native'
import { useChatContext } from '../GiftedChatContext'

/**
 * Custom hook that returns the color scheme from GiftedChat context if provided,
 * otherwise falls back to the system color scheme from React Native.
 * 
 * @returns The current color scheme ('light', 'dark', null, or undefined)
 */
export function useColorScheme() {
  const { getColorScheme } = useChatContext()
  const contextColorScheme = getColorScheme()
  const systemColorScheme = useRNColorScheme()
  
  return contextColorScheme !== undefined && contextColorScheme !== null
    ? contextColorScheme
    : systemColorScheme
}

```

### Core Architecture Module: `src/hooks/useUpdateLayoutEffect.ts`
```
import { DependencyList, useLayoutEffect, useRef } from 'react'

/**
 * A custom useEffect hook that only triggers on updates, not on initial mount
 * Idea stolen from: https://stackoverflow.com/a/55075818/1526448
 * @param {()=>void} effect the function to call
 * @param {DependencyList} dependencies the state(s) that fires the update
 */
export function useUpdateLayoutEffect (
  effect: () => void,
  dependencies: DependencyList = []
) {
  const isInitialMount = useRef(true)

  useLayoutEffect(() => {
    if (isInitialMount.current)
      isInitialMount.current = false
    else
      effect()
  }, dependencies)
}

```

### Core Architecture Module: `src/utils.ts`
```
import React, { useCallback, useEffect, useRef } from 'react'
import dayjs from 'dayjs'
import { IMessage } from './Models'

export function renderComponentOrElement<TProps extends Record<string, any>>(
  component: React.ComponentType<TProps> | React.ReactElement | ((props: TProps) => React.ReactNode) | null | undefined,
  props: TProps
): React.ReactNode {
  if (!component)
    return null

  if (React.isValidElement(component))
    // If it's already a React element, clone it with props
    return React.cloneElement(component, props as any)

  if (typeof component === 'function') {
    // Check if it's a class component (has prototype.isReactComponent)
    // Class components must use React.createElement
    const isClassComponent = component.prototype && component.prototype.isReactComponent

    if (isClassComponent)
      return React.createElement(component as React.ComponentType<TProps>, props as any)

    // For function components and render functions, call directly
    // Using createElement with inline arrow functions causes unmount/remount
    // when function reference changes, this matches v2.x behavior
    return (component as (props: TProps) => React.ReactNode)(props)
  }

  // Check for React.memo or React.forwardRef wrapped components
  // These have $$typeof property and should be rendered with createElement
  if (typeof component === 'object' && component !== null && '$$typeof' in component)
    return React.createElement(component as React.ComponentType<TProps>, props as any)

  // If it's neither, return it as-is
  return component
}

export function isSameDay (
  currentMessage: IMessage,
  diffMessage: IMessage | null | undefined
) {
  if (!diffMessage || !diffMessage.createdAt)
    return false

  const currentCreatedAt = dayjs(currentMessage.createdAt)
  const diffCreatedAt = dayjs(diffMessage.createdAt)

  if (!currentCreatedAt.isValid() || !diffCreatedAt.isValid())
    return false

  return currentCreatedAt.isSame(diffCreatedAt, 'day')
}

export function isSameUser (
  currentMessage: IMessage,
  diffMessage: IMessage | null | undefined
) {
  return !!(
    diffMessage &&
    diffMessage.user &&
    currentMessage.user &&
    diffMessage.user._id === currentMessage.user._id
  )
}

function processCallbackArguments (args: unknown[]): unknown[] {
  const [e, ...rest] = args
  const { nativeEvent } = (e as { nativeEvent?: unknown }) || {}
  let params: unknown[] = []
  if (e) {
    if (nativeEvent)
      params.push({ nativeEvent })
    else
      params.push(e)
    if (rest)
      params = params.concat(rest)
  }

  return params
}

export function useCallbackDebounced<T extends (...args: any[]) => any>(callbackFunc: T, deps: React.DependencyList = [], time: number): (...args: Parameters<T>) => void {
  const timeoutId = useRef<ReturnType<typeof setTimeout>>(undefined)

  const savedFunc = useCallback((...args: Parameters<T>) => {
    const params = processCallbackArguments(args)
    if (timeoutId.current)
      clearTimeout(timeoutId.current)
    timeoutId.current = setTimeout(() => {
      callbackFunc(...params as Parameters<T>)
    }, time)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackFunc, time, ...deps])

  useEffect(() => {
    return () => {
      if (timeoutId.current)
        clearTimeout(timeoutId.current)
    }
  }, [])

  return savedFunc
}

export function useCallbackThrottled<T extends (...args: any[]) => any>(callbackFunc: T, deps: React.DependencyList = [], time: number): (...args: Parameters<T>) => void {
  const lastExecution = useRef<number>(0)
  const timeoutId = useRef<ReturnType<typeof setTimeout>>(undefined)

  // we use function instead of arrow to access arguments object
  const savedFunc = useCallback((...args: Parameters<T>) => {
    const params = processCallbackArguments(args)

    const now = Date.now()
    const timeSinceLastExecution = now - lastExecution.current

    if (timeSinceLastExecution >= time) {
      // Execute immediately if enough time has passed
      lastExecution.current = now
      callbackFunc(...params as Parameters<T>)
    } else {
      // Schedule execution for the remaining time
      clearTimeout(timeoutId.current)
      timeoutId.current = setTimeout(() => {
        lastExecution.current = Date.now()
        callbackFunc(...params as Parameters<T>)
      }, time - timeSinceLastExecution)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackFunc, time, ...deps])

  useEffect(() => {
    return () => {
      clearTimeout(timeoutId.current)
    }
  }, [])

  return savedFunc
}

```

### Core Architecture Module: `eslint.config.js`
```
import stylistic from '@stylistic/eslint-plugin'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import importPlugin from 'eslint-plugin-import'
import jestPlugin from 'eslint-plugin-jest'
import perfectionistPlugin from 'eslint-plugin-perfectionist'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/lib/**',
      '**/build/**',
      '**/.expo/**',
      '**/android/**',
      '**/ios/**',
      // Config files
      'example/*.js',
      'example/*.config.js',
      'example/scripts/**',
    ],
  },
  {
    files: ['src/**/*.{js,jsx,ts,tsx}', 'tests/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: typescriptParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        fetch: 'readonly',
        navigator: 'readonly',
        __DEV__: 'readonly',
        XMLHttpRequest: 'readonly',
        FormData: 'readonly',
        React$Element: 'readonly',
        requestAnimationFrame: 'readonly',

        // Node.js globals for build scripts and configuration files
        require: 'readonly',
        module: 'readonly',
        process: 'readonly',
        global: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',

        // Jest globals
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        jest: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
      },
    },
    plugins: {
      '@stylistic': stylistic,
      '@typescript-eslint': typescriptEslint,
      'import': importPlugin,
      'perfectionist': perfectionistPlugin,
      'react': react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
      'import/core-modules': ['react', 'react-native'],
    },
    rules: {
      // Import rules
      'import/no-unresolved': 'error',
      'import/named': 'error',
      'import/default': 'error',
      'import/namespace': 'error',
      'import/export': 'error',
      'import/no-absolute-path': 'error',
      'import/no-self-import': 'error',
      'import/no-cycle': 'warn',
      'import/no-useless-path-segments': 'error',
      'import/no-duplicates': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'warn',
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          js: 'never',
          jsx: 'never',
          ts: 'never',
          tsx: 'never',
        },
      ],

      // React rules
      'react/react-in-jsx-scope': 'off',
      'react/no-unknown-property': 'off',
      'react/display-name': 'off',
      'react/prop-types': 'off',

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': [
        'warn',
        {
          additionalHooks:
            '(useAnimatedStyle|useSharedValue|useAnimatedGestureHandler|useAnimatedScrollHandler|useAnimatedProps|useDerivedValue|useAnimatedRef|useAnimatedReact|useAnimatedReaction|useCallbackDebounced|useCallbackThrottled)',
        },
      ],

      // TypeScript rules
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error'],

      // Stylistic rules
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/member-delimiter-style': [
        'error',
        {
          multiline: {
            delimiter: 'none',
            requireLast: true,
          },
          singleline: {
            delimiter: 'comma',
            requireLast: false,
          },
        },
      ],
      '@stylistic/indent': [
        'error',
        2,
        {
          SwitchCase: 1,
          VariableDeclarator: 'first',
          ignoredNodes: ['TemplateLiteral'],
        },
      ],
      '@stylistic/quotes': ['error', 'single'],
      '@stylistic/jsx-quotes': ['error', 'prefer-single'],
      '@stylistic/comma-dangle': [
        'error',
        {
          arrays: 'always-multiline',
          objects: 'always-multiline',
          imports: 'always-multiline',
          exports: 'never',
          functions: 'never',
        },
      ],
      '@stylistic/arrow-parens': ['error', 'as-needed'],
      '@stylistic/template-curly-spacing': 'off',
      '@stylistic/linebreak-style': ['off', 'unix'],
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: false }],
      '@stylistic/jsx-closing-bracket-location': ['error', 'line-aligned'],

      // General rules
      'no-func-assign': 'off',
      'no-class-assign': 'off',
      'no-useless-escape': 'off',
      'no-unused-vars': 'off', // Use @typescript-eslint/no-unused-vars instead
      'no-unreachable': 'error',
      'curly': [2, 'multi', 'consistent'],
      'nonblock-statement-body-position': ['error', 'below'],

      // Perfectionist rules
      'perfectionist/sort-imports': [
        'error',
        {
          groups: [
            'react',
            'external',
            'internal',
            ['parent', 'sibling'],
            'index',
          ],
          customGroups: [
            {
              groupName: 'react',
              elementNamePattern: ['^react$', '^react-native$'],
            },
          ],
          newlinesBetween: 'ignore',
        },
      ],
      'perfectionist/sort-interfaces': 'off',
    },
  },
  // Example app configuration with path aliases
  {
    files: ['example/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: typescriptParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        project: './example/tsconfig.json',
      },
      globals: {
        fetch: 'readonly',
        navigator: 'readonly',
        __DEV__: 'readonly',
        XMLHttpRequest: 'readonly',
        FormData: 'readonly',
        React$Element: 'readonly',
        requestAnimationFrame: 'readonly',
        require: 'readonly',
        module: 'readonly',
        process: 'readonly',
        global: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    plugins: {
      '@stylistic': stylistic,
      '@typescript-eslint': typescriptEslint,
      'import': importPlugin,
      'perfectionist': perfectionistPlugin,
      'react': react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './example/tsconfig.json',
        },
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
      'import/core-modules': ['react', 'react-native', 'expo-router', 'expo-blur', 'expo-haptics', 'expo-symbols', 'expo-system-ui', 'expo-web-browser', 'expo-font', 'expo-splash-screen', 'expo-status-bar', 'react-native-gifted-chat'],
    },
    rules: {
      // Import rules
      'import/no-unresolved': 'error',
      'import/named': 'error',
      'import/default': 'error',
      'import/namespace': 'error',
      'import/export': 'error',
      'import/no-absolute-path': 'error',
      'import/no-self-import': 'error',
      'import/no-cycle': 'warn',
      'import/no-useless-path-segments': 'error',
      'import/no-duplicates': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'warn',
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          js: 'never',
          jsx: 'never',
          ts: 'never',
          tsx: 'never',
        },
      ],

      // React rules
      'react/react-in-jsx-scope': 'off',
      'react/no-unknown-property': 'off',
      'react/display-name': 'off',
      'react/prop-types': 'off',

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': [
        'warn',
        {
          additionalHooks:
            '(useAnimatedStyle|useSharedValue|useAnimatedGestureHandler|useAnimatedScrollHandler|useAnimatedProps|useDerivedValue|useAnimatedRef|useAnimatedReact|useAnimatedReaction|useCallbackDebounced|useCallbackThrottled)',
        },
      ],

      // TypeScript rules
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error'],

      // Stylistic rules
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/member-delimiter-style': [
        'error',
        {
          multiline: {
            delimiter: 'none',
            requireLast: true,
          },
          singleline: {
            delimiter: 'comma',
            requireLast: false,
          },
        },
      ],
      '@stylistic/indent': [
        'error',
        2,
        {
          SwitchCase: 1,
          VariableDeclarator: 'first',
          ignoredNodes: ['TemplateLiteral'],
        },
      ],
      '@stylistic/quotes': ['error', 'single'],
      '@stylistic/jsx-quotes': ['error', 'prefer-single'],
      '@stylistic/comma-dangle': [
        'error',
        {
          arrays: 'always-multiline',
          objects: 'always-multiline',
          imports: 'always-multi
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1819** (2020-06-24): **Typing animation is causing memory leaks**
  *Symptoms*: #### Issue Description  When you open a chat you can see the device CPU constantly around 50 to 60% as well as a steady incline in memory usage.  #### Steps to Reproduce / Code Snippets  Open a chat, look at your metrics.  #### Expected Results  It doesn't leak memory/cpu  #### Additional Information  * Nodejs version: v12.14.1 * React version: 16.11 * React Native version: 0.62.2 * react-native-gifted-chat version: 0.16.1 * Platform(s) (iOS, Android, or both?): both (I think) * TypeScript version: 3.9.3  After a lot of searching I finally arrived at the root of this, the react-native-typing-animation used in TypingIndicator is CONSTANTLY animating causing this to happen. Good options would be to either not use this and write one that's less performance hungry OR not mount it until the user is actually typing. The current solution seems to be letting it run in background and hiding it with the opacity which is suboptimal 
  **Post-Mortem & Fix Analysis**:
  > Hello, I would just like to point out that I think this is still an issue.  I did some ugly checking by removing the whole `isTyping` block and the CPU jumped to almost 0% (as it should be)  This doesn't seem to be an issue on Android (as I never noticed this) but on iOS it has a very bad impact
  > Hi @marqroldan, I removed it from the render tree if not typing, maybe this is an issue on unmount? https://github.com/FaridSafi/react-native-gifted-chat/commit/d83c800f707e07489b628c0331c12bdda64ad617 Can you please share your performance analysis (ie. screenshots)? 
  > @KDederichs how did you discover that the animation was to blame for this?

- **Issue #1778** (2020-05-13): **Typing Indicator is positioned off screen with full page of messages**
  *Symptoms*: #### Issue Description  Typing indicator is positioned off screen with full screen of messages, and is positioned at the middle of the screen with one message.  #### Steps to Reproduce / Code Snippets  Set isTyping={true}  #### Expected Results  Typing indicator positioned  where the next chat bubble would be, or possibly at the bottom of the screen.  #### Additional Information  * Nodejs version: 10.19 * React version: 16.9.0 * React Native version: 0.61.5 * react-native-gifted-chat version: 0.14.1 * Platform(s) (iOS, Android, or both?): Both * TypeScript version: 3.8.3  ![typing](https://user-images.githubusercontent.com/4968936/81480928-59078680-91f2-11ea-91f7-1d4706f8dba0.gif)  ![Simulator Screen Shot - iPhone 11 - 2020-05-09 at 12 41 18](https://user-images.githubusercontent.com/4968936/81480937-66247580-91f2-11ea-8f79-ad3e41ea4d08.png) 
  **Post-Mortem & Fix Analysis**:
  > Hi, https://github.com/FaridSafi/react-native-gifted-chat/blob/70291e856c39c0881f0bc50ecfc9c012dc09f726/src/TypingIndicator.tsx#L31 Obviously the `height animation` not working as expected. Then I will change the `height animation` by an `opacity animation`. 
  > @xcarpentier, just encountered this also, any news on your fix? Thanks!
  > @xcarpentier Just encountered it again in 2 chat screen while not in the third one, kindly do let us know when the bug is fixed

- **Issue #1559** (2019-12-16): **Wrong parsePattern type definition**
  *Symptoms*: #### Issue Description  parsePattern is describe in TS as `() => React.ReactNode` but is incompatible (as documented) with actual functionality.   #### Steps to Reproduce / Code Snippets  ``` <GifedChat parsePatterns={style => [{type: "url" ...}]} /> ```  this will trigger a TS error similar to this   > Type '(style: any) => { pattern: RegExp; style: any[]; onPress: () => void; }[]' is not assignable to type '() => ReactNode'.ts(2322)   #### Additional Information  * Nodejs version: 10 * React version: 16.8 * React Native version: 0.59 * react-native-gifted-chat version: 0.11.4
  **Post-Mortem & Fix Analysis**:
  > :+1: but would it not be better to use the actual types in the return type instead of any?      type ParseShape = DefaultParseShape | CustomParseShape;  https://github.com/taskrabbit/react-native-parsed-text/blob/2f1d51ab8c78bf57f171dcfa3910383eda646d01/src/ParsedText.d.ts#L19

- **Issue #1488** (2020-01-07): **Missing TypeScript type definition file**
  *Symptoms*: #### Issue Description  When using `react-native-gifted-chat` as a dependency in a TypeScript 3.x project, TypeScript Compiler lists a dozen of type script errors because of a missing type definition file, for instance: ``` Could not find a declaration file for module './types'. '***/node_modules/react-native-gifted-chat/lib/types.js' implicitly has an 'any' type.  import { IMessage } from './types'; ```  #### Steps to Reproduce / Code Snippets 1. Add `react-native-gifted-chat` as a project dependency in a TS project 2. Import anything from the `react-native-gifted-chat` package 3. Run TSC, e.g `yarn tsc`  #### Expected Results There are no TypeErrors errors stemming from the fact that the project is using `react-native-gifted-chat`.  #### Additional Information * Nodejs version: 12.0.0 * React version: 16.8.6 * React Native version: 0.60.5 * react-native-gifted-chat version: 0.11.3 * Platform(s) (iOS, Android, or both?): Android * TypeScript version: 3.5.3  #### Probable reason: I think the issue might have been introduced in this line: https://github.com/FaridSafi/react-native-gifted-chat/commit/03372f37864a8a2470c81a4f56a03cc5e9326702#diff-0fd4ef892d9d4990033701887c2f9bccR24 As this commit removes the `types.d.ts` file from files managed by NPM. 
  **Post-Mortem & Fix Analysis**:
  > Sorry about that 
  > This issue has been automatically marked as stale because it has not had recent activity. It will be closed if no further activity occurs. Thank you for your contributions. 

- **Issue #1484** (2020-06-06): **ref error when resizing parent view and unmounting**
  *Symptoms*: #### Issue Description  > TypeError: Cannot read property 'scrollToEnd' of null > scrollToBottom     MessageContainer.js:91:17  When you resize the view where the FlatList of GiftedChat is in, the onLayout event handler of the flatlist calls this.scrollToBottom: ```         this.scrollToBottom = (animated = true) => {             const { inverted } = this.props;             if (inverted) {                 this.scrollTo({ offset: 0, animated });             }             else {                 this.props.forwardRef.current.scrollToEnd({ animated });             }         }; ``` if inverted = false it calls a function of the forwarded ref and in my case it seems that `this.props.forwardRef.current` is null, as the resizing animation ends with unmounting the Chat and therefore FlatList. So the onLayout call appears after FlatList is unmounted and therefore the ref is null.  I could solve it by adding a check if forwardRef.current is null before using scrollToEnd of forwarded ref: ``` // Temporary fix when unmounted before onLayout is called if(this.props.forwardRef.current !== null) this.props.forwardRef.current.scrollToEnd({ animated }); ```  Should I do a pull request with this change?   #### Steps to Reproduce / Code Snippets  Resize wrapper view of Gifted Chat with inverted=false e.g. by using panresponder and Animated and then unmount GiftedChat at the end of animation  #### Expected Results  onLayout of FlatList shouldn't be called when
  **Post-Mortem & Fix Analysis**:
  > Any idea when we expect this fix to be included?
  > same here.. 
  > same here Do you have any plan fix this? // Temporary fix when unmounted before onLayout is called ` if (this.props.forwardRef && this.props.forwardRef.current){    this.props.forwardRef!.current!.scrollToEnd({ animated }) } `

- **Issue #1434** (2019-10-03): **GiftedChat cDU comparison does not allow you to update messages**
  *Symptoms*: #### Issue Description  In https://github.com/FaridSafi/react-native-gifted-chat/commit/ac984958c3761c15a9a1ebc6c6fca8d49ecd2bec the `componentDidUpdate` comparison for messages was changed, however the comparison no longer allows us to update messages.  #### Steps to Reproduce / Code Snippets  e.g.  -> user sends message  ```js // messages array passed to <GiftedChat /> [{ id: 1, status: 'SENDING' }] ```  -> websocket subscription updates message status  ```js // messages array passed to <GiftedChat /> [{ id: 1, status: 'DELIVERED' }] ```  The `componentDidUpdate` only is checking if the array lengths are still the same, which they are, and so it does not update and my `renderBubble` method is not called.   #### Expected Results  The `componentDidUpdate` should either a) check if contents of messages array has changed, or b) allow the user an opt-in like the [shouldMessageUpdate](https://github.com/FaridSafi/react-native-gifted-chat/blob/3cbadaf07ba683d160b35d6a9c42c2204ce48886/src/Message.tsx#L99) function that is passed to `Message` component  #### Additional Information  * Nodejs version: 10.16.0 * React version: 16.9.0 * React Native version: 0.61.x * react-native-gifted-chat version: 0.10.0 * Platform(s) (iOS, Android, or both?): both * TypeScript version: 3.6.3 
  **Post-Mortem & Fix Analysis**:
  > I was just about to post this issue! We are having the same issue (for me in was checking the update in `renderTime`) - as soon as we updated from GiftedChat version `0.9.11` we were experiencing this. After many days of trouble shooting and making sure that our redux state was being deep cloned properly I figured it was ONLY checking for the length of the messages array since updating the messages was not re-rendering until the length of messages changed.  My notes from the issue:  - Deleting a message will cause re-render - Adding a new message will cause re-render - Deleting a message and adding a new one at the same time will not cause a re-render (messages array length stays the same)  I was running out of options during our debugging process - if this could be changed back to work the way it did in `0.9.11` or some toggle to let us manually cause a re-render that would be awesome  Thank you
  > Hi, Sorry about that. @audiolion can you please test this version and let me know? `react-native-gifted-chat@0.10.3` Thanks
  > @xcarpentier thank you for the fast response and resolution. The problem has been resolved in @0.10.3 thank you!

- **Issue #1105** (2019-01-28): **next.createdAt.getTime is not a function when loading or sending messages**
  *Symptoms*: I think the latest version of Gifted Chat that was updated 7 hours ago broke the entire rendering of messages. I had just updated to 0.7.1 and on loading of my messages from a firebase server, which is passed to redux and then passed as a prop to the messages in gifted chat, I get an error saying   TypeError : next.createdAt.getTime is not a function (In 'next.createdAt.getTime()', 'next.createdAt.getTime' is undefined)  I have since reverted back to 0.6.0 (the previously working version) and it is working perfectly.   I expected that my messages would be updated on the screen after I sent this text, but right as I sent the text, or loaded the messages from firebase, I got the aforementioned error.  #### Additional Information  * Nodejs version: v10.14.2 * React version: 16.7 (latest at the time) * React Native version: 0.58 (latest at the time) * react-native-gifted-chat version: 0.7.1 -> error : 0.6.0 -> no error * Platform(s) (iOS, Android, or both?): IOS 
  **Post-Mortem & Fix Analysis**:
  > Close with https://github.com/FaridSafi/react-native-gifted-chat/commit/2c915f0281f8475331025f992ad9098c79a01e1a

- **Issue #1048** (2019-01-28): **Too large list of message fail to display**
  *Symptoms*: #### Issue Description  Too large list of message fail to display  #### Steps to Reproduce / Code Snippets  try a big list of message  #### Expected Results  Seeing something  #### Additional Information  * Nodejs version: 10 * React version: 16 * React Native version: 0.57 * react-native-gifted-chat version: 0.5.0 * Platform(s) (iOS, Android, or both?): both 
  **Post-Mortem & Fix Analysis**:
  > Follow: https://github.com/FaridSafi/react-native-gifted-chat/pull/1076

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

### Incident Patch 1: `5fefcfcc` (2026-06-19)
**Commit Message**: docs: flesh out 3.4.1 changelog (emoji reactions, day-header fixes, deps/CI)

**File**: `CHANGELOG.md` (modified, +21/-1)
```diff
@@ -4,7 +4,27 @@
 
 ## [3.4.1] - 2026-06-19
 
-### 🔧 Changes
+### ✨ Features
+- **Emoji message reactions** (#2725): long-press a message to react with emojis; reactions render as toggleable pills below the bubble. Adds the `reactions` prop on `<GiftedChat>`, the `MessageReactions` display and a lightweight `ReactionPicker`, the `MessageReaction` model, and `IMessage.reactions`. A full emoji browser can be supplied via `renderReactionPicker`.
+- **Animated day header `isAnimated` flag** (#2721, #2748): `renderDay` now receives an `isAnimated` flag so custom day renderers can style the floating/sticky header differently from inline day separators.
+
+### 🐛 Bug Fixes
+- Animated day header showed the wrong date while scrolling (#2709, #2746).
+- Duplicate day badge produced by the animated header (#2709, #2747).
+- Reworked the animated day header into a Telegram-style sticky push for smoother transitions.
+- Auto-scroll to the newest message when `inverted` is `false` (#2612, #2745).
+- Composer not resizing after send; added a `disableKeyboardProvider` opt-out for custom keyboard setups.
+
+### 🔧 Improvements
+- Refactored the animated day header (DRY, with a reusable debug helper).
+- Added a **Day Animated** example screen and tidied the example chat header.
+- Refreshed lockfiles to pull in-range security patches (#2744) and bumped transitive deps (launch-editor, brace-expansion, yaml, flatted, lodash, shell-quote, @babel/core).
+- CI: dropped EOL Node 20 (now tests on Node 22 and 24), install example deps so lint can resolve example imports, and stopped tracking `example/ios`.
+
+### 📝 Documentation
+- Documented emoji reactions in the README with screenshots and linked the Features list to their sections.
+
+### 🗒️ Maintenance
 - Entered maintenance mode. Added an install-time notice pointing to the maintained fork **[@kesha-antonov/react-native-chat](https://www.npmjs.com/package/@kesha-antonov/react-native-chat)** (printed once on install; silence with `GIFTED_CHAT_NO_NOTICE=1`). No API or runtime changes.
 
 ## [3.4.0] - 2026-06-16
```

---

### Incident Patch 2: `f6d6edca` (2026-06-19)
**Commit Message**: Merge pull request #2750 from FaridSafi/fix/dayanimated-telegram-push

fix: Telegram-style sticky day header (slide, no flash, no duplicate)

**File**: `docs/DAY_ANIMATED_SPEC.md` (added, +123/-0)
```diff
@@ -0,0 +1,123 @@
+# DayAnimated (floating day header) - animation spec
+
+How the Telegram-style sticky day header works in this library. Describes the
+final implementation across `DayAnimated`, `Item` (inline separators),
+`MessagesContainer`, and the shared `dayLayout` constants.
+
+## 1. Reference behaviour (Telegram iOS, what we replicate)
+
+The conversation is an inverted list (newest at the bottom). Each day has a
+centered date pill. Two elements together read as one sticky header:
+
+1. **Inline separator** - a pill at the top of each day's group, scrolls with the
+   content like a normal row.
+2. **Floating header** - while you scroll, the date of the *topmost visible day*
+   sticks just under the nav bar.
+
+Behaviour:
+
+- **Scroll-gated visibility.** Hidden at rest. Fades in fast when scrolling
+  starts, stays fully opaque for the *entire gesture* (drag + momentum, including
+  slow drags and pauses), fades out shortly after motion fully stops.
+- **Which date.** The day of the messages at the top of the viewport (the "stuck"
+  day), pinned at a small offset under the nav bar.
+- **Slide, not fade.** At a day boundary the date *slides*, it never cross-fades.
+  - Scrolling into an **older** day (scroll up / toward top): the new (older) date
+    **slides down from the top edge to the pin, pixel by pixel**, as the previous
+    date slides down below it.
+  - Scrolling into a **newer** day (scroll down / toward bottom): the newer date
+    rises from below to the pin and the previous date is pushed up and off.
+  - During the transition the two dates are **different**, separated by a margin,
+    moving together. Never two of the same date; never a dip to 0; never a jump.
+- **Top of history / "Load earlier".** At the very top the oldest day is stuck.
+  Once the oldest day's own separator drops back below the pin (the "Load earlier"
+  button scrolls in) nothing is stuck: the header hands the date back to the inline
+  separator and hides - no duplicate over the loader. While actively loading, the
+  header tucks above the top edge.
+
+## 2. Structure & geometry
+
+- Inverted `FlatList`. `daysPositions` (shared value) holds, per day, the cell's
+  `{ y, height, createdAt }` measured via `onLayout`.
+- Two elements in different view trees: inline separators (`AnimatedDayWrapper` in
+  `Item`) and the floating overlay (`DayAnimated`).
+- On-screen Y of a day separator's top edge (dp):
+  `separatorScreenTop = (listHeight + scrolledY) - (day.y + day.height)`
+- The inline pill renders `DAY_MARGIN_TOP` below `separatorScreenTop` (Day's
+  container marginTop). The floating overlay overrides that margin to 0, so when it
+  is pinned at `top = DAY_PIN_OFFSET` its pill lines up exactly with an inline
+  separator whose `separatorScreenTop == DAY_PIN_OFFSET - DAY_MARGIN_TOP`. That
+  shared line is **`DAY_HANDOFF_OFFSET = DAY_PIN_OFFSET - DAY_MARGIN_TOP`**.
+  (Verified on device, all dp; the display-density factor cancels.)
+
+## 3. Mechanics (final implementation)
+
+### Stuck-day selection (`DayAnimated`, worklet)
+- `daysPositionsArray` is sorted by **`createdAt` (newest first)**, NOT by measured
+  `y`. `y` jitters while cells are (re)measured mid-scroll; sorting by date keeps
+  the selection deterministic so it can't briefly jump to the wrong neighbour.
+- The stuck day = the newest day whose `separatorScreenTop <= DAY_HANDOFF_OFFSET`.
+
+### Position - the scroll-driven slide (`DayAnimated`, worklet)
+- The floating header's `top` is positioned off the *next (newer)* day's separator:
+  `top = min(DAY_PIN_OFFSET, nextSeparatorScreenTop + DAY_MARGIN_TOP - headerHeight - DAY_PUSH_GAP)`
+- When the next separator is far below, `top = DAY_PIN_OFFSET` (pinned).
+- As the next separator nears the pin the header slides with it, pixel by pixel:
+  it slides **down from the top edge** as an older day takes over (scrolling up), or
+  is **pushed up and off** as a newer day rises (scrolling down). `DAY_PUSH_GAP`
+  keeps a margin between the outgoing and incoming pills.
+- While `isLoading`, `top = -headerHeight` (tucked above the top).
+
+### Handoff opacity - hard cutoffs (no fades)
+The date stays solid (opacity 1) through the floating <-> inline handoff because
+both sides hard-cut at the same pixel, rather than cross-fading:
+- **Inline separator** (`Item`): `opacity = (belowHandoff || !headerShowsThisDay) ? 1 : 0`
+  where `belowHandoff = separatorScreenTop > DAY_HANDOFF_OFFSET` and
+  `headerShowsThisDay = floatingRenderedDate === this day's createdAt`.
+- **Floating header `stuckGate`** (`DayAnimated`): `curSep <= DAY_HANDOFF_OFFSET ? 1 : 0`
+  (hard hide when nothing is stuck - the top-of-history / loader case).
+
+### Render gate - covering the JS-thread text lag
+The header's date *text* is React state, updated via `runOnJS`, so it lags the
+worklet by ~1 frame. Without handling, scrolling into a newer day flashes the old
+date at the pin (the header takes over on-screen there; scrolling 
```

**File**: `example/app/(tabs)/explore.tsx` (modified, +2/-1)
```diff
@@ -8,14 +8,15 @@ import { ThemedText } from '@/components/themed-text'
 import { ThemedView } from '@/components/themed-view'
 import { useThemeColor } from '@/hooks/use-theme-color'
 
-type ChatExample = 'basic' | 'customized-rendering' | 'slack' | 'links' | 'reply'
+type ChatExample = 'basic' | 'customized-rendering' | 'slack' | 'links' | 'reply' | 'day-animated'
 
 const examples: Array<{ id: ChatExample, title: string, description: string }> = [
   { id: 'basic', title: 'Basic Example', description: 'Basic chat with keyboard logging for testing' },
   { id: 'links', title: 'Links & Patterns', description: 'Phone numbers, emails, URLs, hashtags, and mentions' },
   { id: 'customized-rendering', title: 'Customized Rendering', description: 'Customized chat with all rendering options' },
   { id: 'slack', title: 'Slack Style', description: 'Slack-like message styling' },
   { id: 'reply', title: 'Reply Example', description: 'Example demonstrating reply functionality' },
+  { id: 'day-animated', title: 'Day Animated', description: 'Multi-day chat with Load earlier for testing the animated day header' },
 ]
 
 export default function ExploreScreen () {
```

**File**: `example/app/chat/_layout.tsx` (modified, +6/-6)
```diff
@@ -1,4 +1,4 @@
-import { TouchableOpacity, Text, StyleSheet } from 'react-native'
+import { TouchableOpacity, StyleSheet } from 'react-native'
 import { Ionicons } from '@expo/vector-icons'
 import { Stack, useRouter } from 'expo-router'
 import { useSafeAreaInsets } from 'react-native-safe-area-context'
@@ -11,11 +11,11 @@ export default function ChatLayout () {
     <Stack
       screenOptions={{
         headerShown: true,
+        headerTitleAlign: 'center',
         contentStyle: { paddingBottom: insets.bottom, backgroundColor: '#fff' },
         headerLeft: () => (
           <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
             <Ionicons name='chevron-back' size={24} color='#007AFF' />
-            <Text style={styles.backText}>Back</Text>
           </TouchableOpacity>
         ),
       }}
@@ -40,6 +40,10 @@ export default function ChatLayout () {
         name='slack'
         options={{ title: 'Slack Style' }}
       />
+      <Stack.Screen
+        name='day-animated'
+        options={{ title: 'Day Animated' }}
+      />
     </Stack>
   )
 }
@@ -50,8 +54,4 @@ const styles = StyleSheet.create({
     alignItems: 'center',
     marginLeft: -8,
   },
-  backText: {
-    color: '#007AFF',
-    fontSize: 17,
-  },
 })
```

**File**: `example/app/chat/day-animated.tsx` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+import DayAnimatedExample from '@/components/chat-examples/DayAnimatedExample'
+
+export default DayAnimatedExample
```

**File**: `example/components/chat-examples/DayAnimatedExample.tsx` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+import React, { useCallback, useMemo, useState } from 'react'
+import { StyleSheet, View, useColorScheme } from 'react-native'
+import { GiftedChat, IMessage } from 'react-native-gifted-chat'
+import { useKeyboardVerticalOffset } from '../../hooks/useKeyboardVerticalOffset'
+import { getColorSchemeStyle } from '../../utils/styleUtils'
+
+// Generates a labelled chat spanning several days so the floating/animated day
+// header and the inline day separators can be exercised. Each "day" is a fixed
+// number of days before today with a handful of messages, alternating sides.
+const MESSAGES_PER_DAY = 6
+const INITIAL_DAYS = 4
+const LOAD_EARLIER_DAYS = 3
+
+const generateDay = (dayOffset: number): IMessage[] => {
+  const messages: IMessage[] = []
+  for (let m = MESSAGES_PER_DAY - 1; m >= 0; m--) {
+    const createdAt = new Date()
+    createdAt.setDate(createdAt.getDate() - dayOffset)
+    createdAt.setHours(10, m, 0, 0)
+    const fromMe = m % 2 === 0
+    messages.push({
+      _id: `day-${dayOffset}-msg-${m}`,
+      text: `Day -${dayOffset} · message ${m}`,
+      createdAt,
+      user: fromMe
+        ? { _id: 1, name: 'Developer' }
+        : { _id: 2, name: 'John Doe' },
+    })
+  }
+  return messages
+}
+
+// Inclusive range of day offsets, newest message first (descending createdAt).
+const generateRange = (fromDayOffset: number, toDayOffset: number): IMessage[] => {
+  let messages: IMessage[] = []
+  for (let day = fromDayOffset; day <= toDayOffset; day++)
+    messages = messages.concat(generateDay(day))
+
+  return messages.sort(
+    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
+  )
+}
+
+export default function DayAnimatedExample () {
+  const [messages, setMessages] = useState<IMessage[]>(() => generateRange(0, INITIAL_DAYS - 1))
+  const [oldestDayOffset, setOldestDayOffset] = useState(INITIAL_DAYS - 1)
+  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false)
+  const colorScheme = useColorScheme()
+
+  const keyboardVerticalOffset = useKeyboardVerticalOffset()
+
+  const user = useMemo(() => ({
+    _id: 1,
+    name: 'Developer',
+  }), [])
+
+  const onSend = useCallback((newMessages: IMessage[] = []) => {
+    setMessages(previousMessages => GiftedChat.append(previousMessages, newMessages))
+  }, [])
+
+  const onPressLoadEarlierMessages = useCallback(() => {
+    setIsLoadingEarlier(true)
+    setTimeout(() => {
+      const from = oldestDayOffset + 1
+      const to = oldestDayOffset + LOAD_EARLIER_DAYS
+      setMessages(previousMessages =>
+        GiftedChat.prepend(previousMessages, generateRange(from, to))
+      )
+      setOldestDayOffset(to)
+      setIsLoadingEarlier(false)
+    }, 1500)
+  }, [oldestDayOffset])
+
+  return (
+    <View style={[styles.container, getColorSchemeStyle(styles, 'container', colorScheme)]}>
+      <GiftedChat
+        messages={messages}
+        onSend={onSend}
+        user={user}
+        loadEarlierMessagesProps={{
+          isAvailable: true,
+          isLoading: isLoadingEarlier,
+          onPress: onPressLoadEarlierMessages,
+        }}
+        messagesContainerStyle={getColorSchemeStyle(styles, 'messagesContainer', colorScheme)}
+        textInputProps={{
+          style: getColorSchemeStyle(styles, 'composer', colorScheme),
+        }}
+        keyboardAvoidingViewProps={{ keyboardVerticalOffset }}
+        isScrollToBottomEnabled
+      />
+    </View>
+  )
+}
+
+const styles = StyleSheet.create({
+  container: {
+    flex: 1,
+    backgroundColor: '#fff',
+  },
+  container_dark: {
+    backgroundColor: '#000',
+  },
+  messagesContainer_dark: {
+    backgroundColor: '#000',
+  },
+  composer_dark: {
+    backgroundColor: '#1a1a1a',
+    color: '#fff',
+  },
+})
```

**File**: `src/MessagesContainer/components/DayAnimated/debug.tsx` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+import React, { useState } from 'react'
+import { StyleSheet, Text } from 'react-native'
+import { runOnJS, useAnimatedReaction } from 'react-native-reanimated'
+
+// Debug switches for the animated day header. All OFF/1 for production - flip them
+// here when working on the animation.
+export const DAY_DEBUG = {
+  // Multiply the fade durations/delay so the fades can be captured frame-by-frame.
+  timeScale: 1,
+  // Keep the floating header at full opacity (ignore the scroll fade) so the
+  // slide/push geometry can be studied independently of the fade.
+  forceOpacity: false,
+  // Render an on-screen readout of the sticky worklet values.
+  overlay: false,
+}
+
+// On-screen readout for the header, driven by a worklet `select` that returns the
+// readout string. Returns null (and runs nothing) when DAY_DEBUG.overlay is off.
+export function useDayDebugOverlay (select: () => string, deps: unknown[]): React.ReactElement | null {
+  const [text, setText] = useState('')
+
+  useAnimatedReaction(
+    () => (DAY_DEBUG.overlay ? select() : ''),
+    value => {
+      if (value)
+        runOnJS(setText)(value)
+    },
+    deps
+  )
+
+  if (!DAY_DEBUG.overlay)
+    return null
+
+  return <Text style={styles.overlay}>{text}</Text>
+}
+
+const styles = StyleSheet.create({
+  overlay: {
+    position: 'absolute',
+    top: 2,
+    left: 4,
+    fontSize: 11,
+    color: 'red',
+    zIndex: 9999,
+    backgroundColor: 'rgba(255,255,255,0.8)',
+  },
+})
```

**File**: `src/MessagesContainer/components/DayAnimated/index.tsx` (modified, +104/-97)
```diff
@@ -1,135 +1,139 @@
-import React, { useCallback, useEffect, useMemo, useState } from 'react'
+import React, { useEffect, useMemo, useState, useCallback } from 'react'
 import { LayoutChangeEvent } from 'react-native'
-import Animated, { interpolate, useAnimatedStyle, useDerivedValue, useSharedValue, useAnimatedReaction, withTiming, runOnJS } from 'react-native-reanimated'
+import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, useAnimatedReaction, runOnJS } from 'react-native-reanimated'
 import { Day } from '../../../Day'
 import stylesCommon from '../../../styles'
-import { isSameDay } from '../../../utils'
-import { useAbsoluteScrolledPositionToBottomOfDay, useRelativeScrolledPositionToBottomOfDay } from '../Item'
+import { DAY_HANDOFF_OFFSET, DAY_MARGIN_TOP, DAY_PIN_OFFSET, DAY_PUSH_GAP, dayPositionScreenTop } from '../dayLayout'
+import { DAY_DEBUG, useDayDebugOverlay } from './debug'
 import styles from './styles'
 import { DayAnimatedProps } from './types'
+import { useScrollGatedOpacity } from './useScrollGatedOpacity'
 
 export * from './types'
 
-export const DayAnimated = ({ scrolledY, daysPositions, listHeight, renderDay, messages, isLoading, ...rest }: DayAnimatedProps) => {
-  const opacity = useSharedValue(0)
-  const fadeOutOpacityTimeoutId = useSharedValue<ReturnType<typeof setTimeout> | undefined>(undefined)
+export const DayAnimated = ({ scrolledY, daysPositions, listHeight, isScrollActive, floatingRenderedDate, renderDay, isLoading, ...rest }: DayAnimatedProps) => {
   const containerHeight = useSharedValue(0)
-
-  const isScrolledOnMount = useSharedValue(false)
   const isLoadingAnim = useSharedValue(isLoading)
 
+  // Telegram only shows the floating date while scrolling; this opacity fades in on
+  // scroll start and out after the gesture fully ends.
+  const opacity = useScrollGatedOpacity(isScrollActive)
+
+  // Sort newest day first. Sorting by createdAt (stable) rather than measured y
+  // keeps the order deterministic even while cells are (re)measured mid-scroll, so
+  // the stuck-day selection below can't briefly jump to the wrong day.
   const daysPositionsArray = useDerivedValue(() => Object.values(daysPositions.value).sort((a, b) => {
     'worklet'
 
-    return a.y - b.y
+    return b.createdAt - a.createdAt
   }))
 
   const [createdAt, setCreatedAt] = useState<number | undefined>()
 
-  const dayTopOffset = useMemo(() => 10, [])
-  const dayBottomMargin = useMemo(() => 10, [])
-  const absoluteScrolledPositionToBottomOfDay = useAbsoluteScrolledPositionToBottomOfDay(listHeight, scrolledY, containerHeight, dayBottomMargin, dayTopOffset)
-  const relativeScrolledPositionToBottomOfDay = useRelativeScrolledPositionToBottomOfDay(listHeight, scrolledY, daysPositions, containerHeight, dayBottomMargin, dayTopOffset)
+  // Telegram-style sticky day header (iOS section-header behaviour).
+  //
+  // The list is inverted: older days sit higher on screen, newer days lower.
+  // `daysPositionsArray` is sorted by createdAt (newest first), so index 0 is the
+  // newest day. Each separator's on-screen top edge is `dayPositionScreenTop`; the
+  // separator's pill renders DAY_MARGIN_TOP below that, and the floating header
+  // overrides that margin to 0, so its pinned pill (top = DAY_PIN_OFFSET) lines up
+  // with an inline separator at separatorScreenTop === DAY_HANDOFF_OFFSET.
+  //
+  // A day becomes "stuck" (shown by the floating header) the instant its separator
+  // reaches the handoff line. At that same pixel the inline separator hard-cuts off
+  // (see Item) and the floating hard-cuts on - the date hands off floating<->inline
+  // with no fade and no duplicate. The floating is then positioned off the next
+  // (newer) day's separator so it slides pixel by pixel: down from the top edge as
+  // an older day takes over (scrolling up), or up and off as a newer day rises
+  // (scrolling down), keeping a DAY_PUSH_GAP margin between the two pills.
+  const sticky = useDerivedValue(() => {
+    'worklet'
 
-  const messagesDates = useMemo(() => {
-    const messagesDates: number[] = []
+    const days = daysPositionsArray.value
+    const n = days.length
+    if (n === 0)
+      return { top: DAY_PIN_OFFSET, createdAt: undefined as number | undefined, curSep: NaN }
 
-    for (let i = 1; i < messages.length; i++) {
-      const previousMessage = messages[i - 1]
-      const message = messages[i]
+    const scrolledTop = listHeight.value + scrolledY.value
 
-      if (!isSameDay(previousMessage, message) || !messagesDates.includes(new Date(message.createdAt).getTime()))
-        messagesDates.push(new Date(message.createdAt).getTime())
-    }
+    let idx = n - 1
+    for (let i = 0; i < n; i++)
+      if (dayPositionScreenTop(scrolledTop, days[i]) <= DAY_HANDOFF_OFFSET) {
+        idx = i
+        break
+      }
 
-    return messagesDates
-  }, [messages])
+    const current = days[idx]
+    const curSep = dayPositionScreenTop(scrolledTop, current)
 
-  const
```

**File**: `src/MessagesContainer/components/DayAnimated/types.ts` (modified, +4/-2)
```diff
@@ -1,12 +1,14 @@
 import { DayProps } from '../../../Day'
-import { IMessage } from '../../../Models'
 import { DaysPositions } from '../../types'
 
 export interface DayAnimatedProps extends Omit<DayProps, 'createdAt'> {
   scrolledY: { value: number }
   daysPositions: { value: DaysPositions }
   listHeight: { value: number }
+  isScrollActive: { value: boolean }
+  // Mirror of the date the floating header is currently rendering. The header writes
+  // it; the inline separators read it to cover the header's 1-frame text lag.
+  floatingRenderedDate: { value: number | undefined }
   renderDay?: (props: DayProps) => React.ReactNode
-  messages: IMessage[]
   isLoading: boolean
 }
```

---

### Incident Patch 3: `a769b7c1` (2026-06-19)
**Commit Message**: refactor: tidy the animated day header (DRY + reusable debug)

Behavior-preserving cleanup of the animated day header.

- DRY the geometry: dayLayout owns dayPositionScreenTop() and findDayPosition()
  worklet helpers, so the separatorScreenTop formula lives in one place instead
  of being duplicated across DayAnimated and Item.
- Simplify Item: drop the two legacy position hooks
  (useAbsolute/useRelativeScrolledPositionToBottomOfDay) and their
  dayTopOffset/dayBottomMargin/onLayout machinery in favour of one direct
  separatorScreenTop derived value.
- Extract the scroll-gated fade into useScrollGatedOpacity, and the debug
  switches + on-screen overlay into a DAY_DEBUG config and a useDayDebugOverlay
  hook so future animation work has one place to flip.
- Remove the dead DAY_HANDOFF_FADE constant and fix stale comments.
- Fix DayAnimated.test.tsx, which was missing the now-required isScrollActive
  and floatingRenderedDate props.

**File**: `src/MessagesContainer/components/DayAnimated/debug.tsx` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+import React, { useState } from 'react'
+import { StyleSheet, Text } from 'react-native'
+import { runOnJS, useAnimatedReaction } from 'react-native-reanimated'
+
+// Debug switches for the animated day header. All OFF/1 for production - flip them
+// here when working on the animation.
+export const DAY_DEBUG = {
+  // Multiply the fade durations/delay so the fades can be captured frame-by-frame.
+  timeScale: 1,
+  // Keep the floating header at full opacity (ignore the scroll fade) so the
+  // slide/push geometry can be studied independently of the fade.
+  forceOpacity: false,
+  // Render an on-screen readout of the sticky worklet values.
+  overlay: false,
+}
+
+// On-screen readout for the header, driven by a worklet `select` that returns the
+// readout string. Returns null (and runs nothing) when DAY_DEBUG.overlay is off.
+export function useDayDebugOverlay (select: () => string, deps: unknown[]): React.ReactElement | null {
+  const [text, setText] = useState('')
+
+  useAnimatedReaction(
+    () => (DAY_DEBUG.overlay ? select() : ''),
+    value => {
+      if (value)
+        runOnJS(setText)(value)
+    },
+    deps
+  )
+
+  if (!DAY_DEBUG.overlay)
+    return null
+
+  return <Text style={styles.overlay}>{text}</Text>
+}
+
+const styles = StyleSheet.create({
+  overlay: {
+    position: 'absolute',
+    top: 2,
+    left: 4,
+    fontSize: 11,
+    color: 'red',
+    zIndex: 9999,
+    backgroundColor: 'rgba(255,255,255,0.8)',
+  },
+})
```

**File**: `src/MessagesContainer/components/DayAnimated/index.tsx` (modified, +34/-102)
```diff
@@ -1,35 +1,24 @@
-import React, { useCallback, useEffect, useMemo, useState } from 'react'
-import { LayoutChangeEvent, Text } from 'react-native'
-import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, useAnimatedReaction, withTiming, runOnJS } from 'react-native-reanimated'
+import React, { useEffect, useMemo, useState, useCallback } from 'react'
+import { LayoutChangeEvent } from 'react-native'
+import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, useAnimatedReaction, runOnJS } from 'react-native-reanimated'
 import { Day } from '../../../Day'
 import stylesCommon from '../../../styles'
-import { DAY_HANDOFF_OFFSET, DAY_MARGIN_TOP, DAY_PIN_OFFSET, DAY_PUSH_GAP } from '../dayLayout'
+import { DAY_HANDOFF_OFFSET, DAY_MARGIN_TOP, DAY_PIN_OFFSET, DAY_PUSH_GAP, dayPositionScreenTop } from '../dayLayout'
+import { DAY_DEBUG, useDayDebugOverlay } from './debug'
 import styles from './styles'
 import { DayAnimatedProps } from './types'
+import { useScrollGatedOpacity } from './useScrollGatedOpacity'
 
 export * from './types'
 
-// --- Debug switches (all OFF/1 for production) ---------------------------------
-// Multiply fade durations/delay so the fades can be captured frame-by-frame.
-const DEBUG_TIME_SCALE = 1
-// Keep the floating header at full opacity (ignore the scroll fade) so the push
-// geometry can be studied independently of the fade.
-const DEBUG_FORCE_OPACITY = false
-// Render an on-screen readout of the sticky worklet values.
-const DEBUG_OVERLAY = false
-// -------------------------------------------------------------------------------
-
-const FADE_IN_DURATION = 150 * DEBUG_TIME_SCALE
-const FADE_OUT_DURATION = 300 * DEBUG_TIME_SCALE
-const FADE_OUT_DELAY = 600 * DEBUG_TIME_SCALE
-
 export const DayAnimated = ({ scrolledY, daysPositions, listHeight, isScrollActive, floatingRenderedDate, renderDay, isLoading, ...rest }: DayAnimatedProps) => {
-  const opacity = useSharedValue(0)
-  const fadeOutOpacityTimeoutId = useSharedValue<ReturnType<typeof setTimeout> | undefined>(undefined)
   const containerHeight = useSharedValue(0)
-
   const isLoadingAnim = useSharedValue(isLoading)
 
+  // Telegram only shows the floating date while scrolling; this opacity fades in on
+  // scroll start and out after the gesture fully ends.
+  const opacity = useScrollGatedOpacity(isScrollActive)
+
   // Sort newest day first. Sorting by createdAt (stable) rather than measured y
   // keeps the order deterministic even while cells are (re)measured mid-scroll, so
   // the stuck-day selection below can't briefly jump to the wrong day.
@@ -44,23 +33,19 @@ export const DayAnimated = ({ scrolledY, daysPositions, listHeight, isScrollActi
   // Telegram-style sticky day header (iOS section-header behaviour).
   //
   // The list is inverted: older days sit higher on screen, newer days lower.
-  // `daysPositionsArray` is sorted ascending by y, so index 0 is the newest day.
-  //
-  // For each day separator the on-screen Y of its top edge is:
-  //   separatorScreenTop = (listHeight + scrolledY) - (day.y + day.height)
-  // and the separator's pill renders DAY_MARGIN_TOP below that (Day's container
-  // marginTop). The floating header overrides that margin to 0, so when it is
-  // pinned at DAY_PIN_OFFSET its pill lines up with an inline separator whose
-  // separatorScreenTop === DAY_HANDOFF_OFFSET (= DAY_PIN_OFFSET - DAY_MARGIN_TOP).
+  // `daysPositionsArray` is sorted by createdAt (newest first), so index 0 is the
+  // newest day. Each separator's on-screen top edge is `dayPositionScreenTop`; the
+  // separator's pill renders DAY_MARGIN_TOP below that, and the floating header
+  // overrides that margin to 0, so its pinned pill (top = DAY_PIN_OFFSET) lines up
+  // with an inline separator at separatorScreenTop === DAY_HANDOFF_OFFSET.
   //
   // A day becomes "stuck" (shown by the floating header) the instant its separator
-  // reaches the handoff line (separatorScreenTop <= DAY_HANDOFF_OFFSET). At that same
-  // pixel the inline separator hard-cuts off (see Item) and the floating hard-cuts
-  // on, so the date hands off floating<->inline with no fade and no duplicate. The
-  // floating is then positioned by the next (newer) day's separator so it slides
-  // pixel by pixel:
-  //   top = min(DAY_PIN_OFFSET, nextSeparatorScreenTop + DAY_MARGIN_TOP - headerHeight - DAY_PUSH_GAP)
-  // so the outgoing pill keeps a DAY_PUSH_GAP margin above the rising pill.
+  // reaches the handoff line. At that same pixel the inline separator hard-cuts off
+  // (see Item) and the floating hard-cuts on - the date hands off floating<->inline
+  // with no fade and no duplicate. The floating is then positioned off the next
+  // (newer) day's separator so it slides pixel by pixel: down from the top edge as
+  // an older day takes over (scrolling up), or up and off as a newer day rises
+  // (scrolling down), keeping a DAY_PUSH_GAP margin between the two pills.
   const sticky = useDerivedValu
```

**File**: `src/MessagesContainer/components/DayAnimated/useScrollGatedOpacity.ts` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+import { useCallback } from 'react'
+import { runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated'
+import { DAY_DEBUG } from './debug'
+
+const FADE_IN_DURATION = 150
+const FADE_OUT_DURATION = 300
+const FADE_OUT_DELAY = 600
+
+// Opacity (0..1) that follows the scroll gesture, Telegram-style: the floating date
+// header is hidden at rest, fades in fast when scrolling starts, stays fully opaque
+// for the whole gesture (drag + momentum, including slow drags and short pauses),
+// and fades out a short delay after scrolling fully stops. Driven by the
+// `isScrollActive` flag (begin/end drag + momentum) rather than per-scroll-delta
+// idle timers, so a pause mid-drag doesn't flicker it out and back in.
+export function useScrollGatedOpacity (isScrollActive: { value: boolean }) {
+  const opacity = useSharedValue(0)
+  const fadeOutTimeoutId = useSharedValue<ReturnType<typeof setTimeout> | undefined>(undefined)
+
+  const fadeOut = useCallback(() => {
+    'worklet'
+
+    opacity.value = withTiming(0, { duration: FADE_OUT_DURATION * DAY_DEBUG.timeScale })
+  }, [opacity])
+
+  const scheduleFadeOut = useCallback(() => {
+    clearTimeout(fadeOutTimeoutId.value)
+
+    fadeOutTimeoutId.value = setTimeout(fadeOut, FADE_OUT_DELAY * DAY_DEBUG.timeScale)
+  }, [fadeOut, fadeOutTimeoutId])
+
+  useAnimatedReaction(
+    () => isScrollActive.value,
+    (active, prevActive) => {
+      if (active === prevActive)
+        return
+
+      if (active) {
+        clearTimeout(fadeOutTimeoutId.value)
+        opacity.value = withTiming(1, { duration: FADE_IN_DURATION * DAY_DEBUG.timeScale })
+      } else {
+        runOnJS(scheduleFadeOut)()
+      }
+    },
+    [isScrollActive, scheduleFadeOut, fadeOutTimeoutId]
+  )
+
+  return opacity
+}
```

**File**: `src/MessagesContainer/components/Item/index.tsx` (modified, +17/-86)
```diff
@@ -1,81 +1,15 @@
-import React, { useCallback, useMemo } from 'react'
-import { LayoutChangeEvent, View } from 'react-native'
-import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue } from 'react-native-reanimated'
+import React, { useMemo } from 'react'
+import { View } from 'react-native'
+import Animated, { useAnimatedStyle, useDerivedValue } from 'react-native-reanimated'
 import { Day } from '../../../Day'
 import { Message, MessageProps } from '../../../Message'
 import { IMessage } from '../../../Models'
 import { isSameDay } from '../../../utils'
-import { DaysPositions } from '../../types'
-import { DAY_HANDOFF_OFFSET, DAY_MARGIN_TOP } from '../dayLayout'
+import { DAY_HANDOFF_OFFSET, dayPositionScreenTop, findDayPosition } from '../dayLayout'
 import { ItemProps } from './types'
 
 export * from './types'
 
-// y-position of current scroll position relative to the bottom of the day container. (since we have inverted list it is bottom)
-export const useAbsoluteScrolledPositionToBottomOfDay = (listHeight: { value: number }, scrolledY: { value: number }, containerHeight: { value: number }, dayBottomMargin: number, dayTopOffset: number) => {
-  const absoluteScrolledPositionToBottomOfDay = useDerivedValue(() =>
-    listHeight.value + scrolledY.value - containerHeight.value - dayBottomMargin - dayTopOffset
-  , [listHeight, scrolledY, containerHeight, dayBottomMargin, dayTopOffset])
-
-  return absoluteScrolledPositionToBottomOfDay
-}
-
-export const useRelativeScrolledPositionToBottomOfDay = (
-  listHeight: { value: number },
-  scrolledY: { value: number },
-  daysPositions: { value: DaysPositions },
-  containerHeight: { value: number },
-  dayBottomMargin: number,
-  dayTopOffset: number,
-  createdAt?: number
-) => {
-  const dayMarginTop = useMemo(() => DAY_MARGIN_TOP, [])
-
-  const absoluteScrolledPositionToBottomOfDay = useAbsoluteScrolledPositionToBottomOfDay(listHeight, scrolledY, containerHeight, dayBottomMargin, dayTopOffset)
-
-  // find current day position by scrolled position
-  const currentDayPosition = useDerivedValue(() => {
-    'worklet'
-
-    // When createdAt is provided (called from AnimatedDayWrapper for a specific message),
-    // directly find the day position by createdAt without sorting the entire array.
-    // This avoids O(n log n) sorting and O(n) search for each message item.
-    if (createdAt != null) {
-      const values = Object.values(daysPositions.value)
-      for (let i = 0; i < values.length; i++)
-        if (values[i].createdAt === createdAt)
-          return values[i]
-    }
-
-    // Fallback: sort and search when createdAt is not provided (e.g., from DayAnimated)
-    const sortedArray = Object.values(daysPositions.value).sort((a, b) => {
-      'worklet'
-
-      return a.y - b.y
-    })
-    for (let i = 0; i < sortedArray.length; i++) {
-      const day = sortedArray[i]
-      const dayPosition = day.y + day.height
-      if (absoluteScrolledPositionToBottomOfDay.value < dayPosition || i === sortedArray.length - 1)
-        return day
-    }
-
-    return undefined
-  }, [daysPositions, absoluteScrolledPositionToBottomOfDay, createdAt])
-
-  const relativeScrolledPositionToBottomOfDay = useDerivedValue(() => {
-    const scrolledBottomY = listHeight.value + scrolledY.value - (
-      (currentDayPosition.value?.y ?? 0) +
-      (currentDayPosition.value?.height ?? 0) +
-      dayMarginTop
-    )
-
-    return scrolledBottomY
-  }, [listHeight, scrolledY, currentDayPosition, dayMarginTop])
-
-  return relativeScrolledPositionToBottomOfDay
-}
-
 const DayWrapper = <TMessage extends IMessage>(props: MessageProps<TMessage>) => {
   const {
     renderDay: renderDayProp,
@@ -114,22 +48,23 @@ const AnimatedDayWrapper = <TMessage extends IMessage>(props: ItemProps<TMessage
     ...rest
   } = props
 
-  const dayContainerHeight = useSharedValue(0)
-  const dayTopOffset = useMemo(() => 10, [])
-  const dayBottomMargin = useMemo(() => 10, [])
-
   const createdAt = useMemo(() =>
     new Date(props.currentMessage.createdAt).getTime()
   , [props.currentMessage.createdAt])
 
-  const relativeScrolledPositionToBottomOfDay = useRelativeScrolledPositionToBottomOfDay(listHeight, scrolledY, daysPositions, dayContainerHeight, dayBottomMargin, dayTopOffset, createdAt)
+  // On-screen Y of this day's separator. Infinity (treated as below the pin, i.e.
+  // visible) until the day has been measured.
+  const separatorScreenTop = useDerivedValue(() => {
+    'worklet'
+
+    const day = findDayPosition(daysPositions.value, createdAt)
+    if (!day)
+      return Infinity
 
-  const handleLayoutDayContainer = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
-    dayContainerHeight.value = nativeEvent.layout.height
-  }, [dayContainerHeight])
+    return dayPositionScreenTop(listHeight.value + scrolledY.value, day)
+  }, [daysPositions, listHeight, scrolledY, createdAt])
 
   const style = useAnimatedStyle(() => {
-    // rel = separatorScreenTop 
```

**File**: `src/MessagesContainer/components/dayLayout.ts` (modified, +36/-16)
```diff
@@ -1,29 +1,49 @@
-// Shared layout constants so the inline day separators (rendered inside the
-// list) and the floating sticky day header (the DayAnimated overlay) hand off
+import { DaysPositions } from '../types'
+
+// Shared layout constants and math so the inline day separators (rendered inside
+// the list) and the floating sticky day header (the DayAnimated overlay) hand off
 // at exactly the same screen line. Keeping these in sync is what makes the
-// Telegram-style "push" read as a single sticky header with no duplicate badge
-// and no gap at the day boundary.
+// Telegram-style sticky push read as a single header with no duplicate badge and
+// no gap at the day boundary.
 
-// Screen-Y (px from the top of the list) where a day header sticks and where
-// the inline separator hands over to the floating header.
+// Screen-Y (px from the top of the list) where a day header sticks and where the
+// inline separator hands over to the floating header.
 export const DAY_PIN_OFFSET = 10
 
-// Vertical margin baked into the inline separator's relative-scroll math
-// (see useRelativeScrolledPositionToBottomOfDay). rel = separatorScreenTop - DAY_MARGIN_TOP.
+// Vertical margin baked into the inline separator's pill position (Day's container
+// marginTop). The inline pill renders this far below its separatorScreenTop.
 export const DAY_MARGIN_TOP = 5
 
-// Px range over which the inline separator cross-fades around the pin line as
-// the floating header takes over, to avoid a one-frame pop at the handoff.
-export const DAY_HANDOFF_FADE = 10
-
 // Vertical gap kept between the outgoing floating header and the incoming
 // separator's pill during the push, so the two dates don't touch.
 export const DAY_PUSH_GAP = 8
 
 // The separatorScreenTop value at which an inline separator's pill reaches the
-// floating header's pinned pill position, so they hand off at the exact same
-// spot. The inline pill sits `DAY_MARGIN_TOP` below its separatorScreenTop
-// (Day's container marginTop); the floating header overrides that margin to 0,
-// so its pinned pill sits `DAY_MARGIN_TOP` higher. They coincide at
+// floating header's pinned pill. The inline pill sits DAY_MARGIN_TOP below its
+// separatorScreenTop; the floating header overrides that margin to 0, so its
+// pinned pill sits DAY_MARGIN_TOP higher. They coincide - and hand off - at
 // separatorScreenTop = DAY_PIN_OFFSET - DAY_MARGIN_TOP.
 export const DAY_HANDOFF_OFFSET = DAY_PIN_OFFSET - DAY_MARGIN_TOP
+
+type DayPosition = DaysPositions[string]
+
+// On-screen Y of a day separator's top edge. `scrolledTop` is `listHeight + scrolledY`.
+// (Inverted list: a separator is above the pin when this is <= DAY_HANDOFF_OFFSET.)
+export const dayPositionScreenTop = (scrolledTop: number, day: DayPosition) => {
+  'worklet'
+
+  return scrolledTop - (day.y + day.height)
+}
+
+// The measured position of the day with the given createdAt (ms), or undefined if
+// that day hasn't been laid out yet.
+export const findDayPosition = (positions: DaysPositions, createdAt: number): DayPosition | undefined => {
+  'worklet'
+
+  const values = Object.values(positions)
+  for (let i = 0; i < values.length; i++)
+    if (values[i].createdAt === createdAt)
+      return values[i]
+
+  return undefined
+}
```

**File**: `src/__tests__/DayAnimated.test.tsx` (modified, +6/-3)
```diff
@@ -3,11 +3,12 @@ import { View, Text } from 'react-native'
 import { render } from '@testing-library/react-native'
 import { DayProps } from '../Day'
 import { DayAnimated } from '../MessagesContainer/components/DayAnimated'
-import { DEFAULT_TEST_MESSAGE } from './data'
 
 const mockDaysPositions = { value: {} }
 const mockScrolledY = { value: 0 }
 const mockListHeight = { value: 800 }
+const mockIsScrollActive = { value: false }
+const mockFloatingRenderedDate = { value: undefined }
 
 describe('DayAnimated', () => {
   it('should render DayAnimated with default Day component', () => {
@@ -16,7 +17,8 @@ describe('DayAnimated', () => {
         scrolledY={mockScrolledY}
         daysPositions={mockDaysPositions}
         listHeight={mockListHeight}
-        messages={[DEFAULT_TEST_MESSAGE]}
+        isScrollActive={mockIsScrollActive}
+        floatingRenderedDate={mockFloatingRenderedDate}
         isLoading={false}
       />
     )
@@ -35,7 +37,8 @@ describe('DayAnimated', () => {
         scrolledY={mockScrolledY}
         daysPositions={mockDaysPositions}
         listHeight={mockListHeight}
-        messages={[DEFAULT_TEST_MESSAGE]}
+        isScrollActive={mockIsScrollActive}
+        floatingRenderedDate={mockFloatingRenderedDate}
         isLoading={false}
         renderDay={customRenderDay}
       />
```

---

### Incident Patch 4: `1f9a6468` (2026-06-19)
**Commit Message**: fix: rework animated day header into a Telegram-style sticky push

Reworks the floating day header (DayAnimated) and the inline day separators
so the date reads as a single sticky header that slides between days, fixing
several glitches reported while scrolling.

- Scroll-driven slide: the header is positioned off the next (newer) day's
  separator, so an older day slides down from the top edge to the pin pixel by
  pixel, and a newer day pushes the current one up and off. A DAY_PUSH_GAP keeps
  a margin between the two date pills during the transition.
- Hard handoff (no cross-fade): the inline separator and the header hard-cut at
  the shared DAY_HANDOFF_OFFSET line, so the date goes floating <-> inline at the
  same pixel with no dip to 0 and no fading duplicate.
- Gesture-driven visibility: the header fades in/out from the scroll begin/end
  drag and momentum events (isScrollActive) instead of per-scroll-delta idle
  timers, so it stays fully opaque through slow drags and short pauses.
- Render gate: the header publishes the date it is actually rendering
  (floatingRenderedDate) and is hidden for the ~1 frame its React-state text lags
  the worklet; the inline separator covers 

**File**: `docs/DAY_ANIMATED_SPEC.md` (added, +123/-0)
```diff
@@ -0,0 +1,123 @@
+# DayAnimated (floating day header) - animation spec
+
+How the Telegram-style sticky day header works in this library. Describes the
+final implementation across `DayAnimated`, `Item` (inline separators),
+`MessagesContainer`, and the shared `dayLayout` constants.
+
+## 1. Reference behaviour (Telegram iOS, what we replicate)
+
+The conversation is an inverted list (newest at the bottom). Each day has a
+centered date pill. Two elements together read as one sticky header:
+
+1. **Inline separator** - a pill at the top of each day's group, scrolls with the
+   content like a normal row.
+2. **Floating header** - while you scroll, the date of the *topmost visible day*
+   sticks just under the nav bar.
+
+Behaviour:
+
+- **Scroll-gated visibility.** Hidden at rest. Fades in fast when scrolling
+  starts, stays fully opaque for the *entire gesture* (drag + momentum, including
+  slow drags and pauses), fades out shortly after motion fully stops.
+- **Which date.** The day of the messages at the top of the viewport (the "stuck"
+  day), pinned at a small offset under the nav bar.
+- **Slide, not fade.** At a day boundary the date *slides*, it never cross-fades.
+  - Scrolling into an **older** day (scroll up / toward top): the new (older) date
+    **slides down from the top edge to the pin, pixel by pixel**, as the previous
+    date slides down below it.
+  - Scrolling into a **newer** day (scroll down / toward bottom): the newer date
+    rises from below to the pin and the previous date is pushed up and off.
+  - During the transition the two dates are **different**, separated by a margin,
+    moving together. Never two of the same date; never a dip to 0; never a jump.
+- **Top of history / "Load earlier".** At the very top the oldest day is stuck.
+  Once the oldest day's own separator drops back below the pin (the "Load earlier"
+  button scrolls in) nothing is stuck: the header hands the date back to the inline
+  separator and hides - no duplicate over the loader. While actively loading, the
+  header tucks above the top edge.
+
+## 2. Structure & geometry
+
+- Inverted `FlatList`. `daysPositions` (shared value) holds, per day, the cell's
+  `{ y, height, createdAt }` measured via `onLayout`.
+- Two elements in different view trees: inline separators (`AnimatedDayWrapper` in
+  `Item`) and the floating overlay (`DayAnimated`).
+- On-screen Y of a day separator's top edge (dp):
+  `separatorScreenTop = (listHeight + scrolledY) - (day.y + day.height)`
+- The inline pill renders `DAY_MARGIN_TOP` below `separatorScreenTop` (Day's
+  container marginTop). The floating overlay overrides that margin to 0, so when it
+  is pinned at `top = DAY_PIN_OFFSET` its pill lines up exactly with an inline
+  separator whose `separatorScreenTop == DAY_PIN_OFFSET - DAY_MARGIN_TOP`. That
+  shared line is **`DAY_HANDOFF_OFFSET = DAY_PIN_OFFSET - DAY_MARGIN_TOP`**.
+  (Verified on device, all dp; the display-density factor cancels.)
+
+## 3. Mechanics (final implementation)
+
+### Stuck-day selection (`DayAnimated`, worklet)
+- `daysPositionsArray` is sorted by **`createdAt` (newest first)**, NOT by measured
+  `y`. `y` jitters while cells are (re)measured mid-scroll; sorting by date keeps
+  the selection deterministic so it can't briefly jump to the wrong neighbour.
+- The stuck day = the newest day whose `separatorScreenTop <= DAY_HANDOFF_OFFSET`.
+
+### Position - the scroll-driven slide (`DayAnimated`, worklet)
+- The floating header's `top` is positioned off the *next (newer)* day's separator:
+  `top = min(DAY_PIN_OFFSET, nextSeparatorScreenTop + DAY_MARGIN_TOP - headerHeight - DAY_PUSH_GAP)`
+- When the next separator is far below, `top = DAY_PIN_OFFSET` (pinned).
+- As the next separator nears the pin the header slides with it, pixel by pixel:
+  it slides **down from the top edge** as an older day takes over (scrolling up), or
+  is **pushed up and off** as a newer day rises (scrolling down). `DAY_PUSH_GAP`
+  keeps a margin between the outgoing and incoming pills.
+- While `isLoading`, `top = -headerHeight` (tucked above the top).
+
+### Handoff opacity - hard cutoffs (no fades)
+The date stays solid (opacity 1) through the floating <-> inline handoff because
+both sides hard-cut at the same pixel, rather than cross-fading:
+- **Inline separator** (`Item`): `opacity = (belowHandoff || !headerShowsThisDay) ? 1 : 0`
+  where `belowHandoff = separatorScreenTop > DAY_HANDOFF_OFFSET` and
+  `headerShowsThisDay = floatingRenderedDate === this day's createdAt`.
+- **Floating header `stuckGate`** (`DayAnimated`): `curSep <= DAY_HANDOFF_OFFSET ? 1 : 0`
+  (hard hide when nothing is stuck - the top-of-history / loader case).
+
+### Render gate - covering the JS-thread text lag
+The header's date *text* is React state, updated via `runOnJS`, so it lags the
+worklet by ~1 frame. Without handling, scrolling into a newer day flashes the old
+date at the pin (the header takes over on-screen there; scrolling 
```

**File**: `src/MessagesContainer/components/DayAnimated/index.tsx` (modified, +156/-81)
```diff
@@ -1,135 +1,201 @@
 import React, { useCallback, useEffect, useMemo, useState } from 'react'
-import { LayoutChangeEvent } from 'react-native'
-import Animated, { interpolate, useAnimatedStyle, useDerivedValue, useSharedValue, useAnimatedReaction, withTiming, runOnJS } from 'react-native-reanimated'
+import { LayoutChangeEvent, Text } from 'react-native'
+import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, useAnimatedReaction, withTiming, runOnJS } from 'react-native-reanimated'
 import { Day } from '../../../Day'
 import stylesCommon from '../../../styles'
-import { isSameDay } from '../../../utils'
-import { useAbsoluteScrolledPositionToBottomOfDay, useRelativeScrolledPositionToBottomOfDay } from '../Item'
+import { DAY_HANDOFF_OFFSET, DAY_MARGIN_TOP, DAY_PIN_OFFSET, DAY_PUSH_GAP } from '../dayLayout'
 import styles from './styles'
 import { DayAnimatedProps } from './types'
 
 export * from './types'
 
-export const DayAnimated = ({ scrolledY, daysPositions, listHeight, renderDay, messages, isLoading, ...rest }: DayAnimatedProps) => {
+// --- Debug switches (all OFF/1 for production) ---------------------------------
+// Multiply fade durations/delay so the fades can be captured frame-by-frame.
+const DEBUG_TIME_SCALE = 1
+// Keep the floating header at full opacity (ignore the scroll fade) so the push
+// geometry can be studied independently of the fade.
+const DEBUG_FORCE_OPACITY = false
+// Render an on-screen readout of the sticky worklet values.
+const DEBUG_OVERLAY = false
+// -------------------------------------------------------------------------------
+
+const FADE_IN_DURATION = 150 * DEBUG_TIME_SCALE
+const FADE_OUT_DURATION = 300 * DEBUG_TIME_SCALE
+const FADE_OUT_DELAY = 600 * DEBUG_TIME_SCALE
+
+export const DayAnimated = ({ scrolledY, daysPositions, listHeight, isScrollActive, floatingRenderedDate, renderDay, isLoading, ...rest }: DayAnimatedProps) => {
   const opacity = useSharedValue(0)
   const fadeOutOpacityTimeoutId = useSharedValue<ReturnType<typeof setTimeout> | undefined>(undefined)
   const containerHeight = useSharedValue(0)
 
-  const isScrolledOnMount = useSharedValue(false)
   const isLoadingAnim = useSharedValue(isLoading)
 
+  // Sort newest day first. Sorting by createdAt (stable) rather than measured y
+  // keeps the order deterministic even while cells are (re)measured mid-scroll, so
+  // the stuck-day selection below can't briefly jump to the wrong day.
   const daysPositionsArray = useDerivedValue(() => Object.values(daysPositions.value).sort((a, b) => {
     'worklet'
 
-    return a.y - b.y
+    return b.createdAt - a.createdAt
   }))
 
   const [createdAt, setCreatedAt] = useState<number | undefined>()
 
-  const dayTopOffset = useMemo(() => 10, [])
-  const dayBottomMargin = useMemo(() => 10, [])
-  const absoluteScrolledPositionToBottomOfDay = useAbsoluteScrolledPositionToBottomOfDay(listHeight, scrolledY, containerHeight, dayBottomMargin, dayTopOffset)
-  const relativeScrolledPositionToBottomOfDay = useRelativeScrolledPositionToBottomOfDay(listHeight, scrolledY, daysPositions, containerHeight, dayBottomMargin, dayTopOffset)
-
-  const messagesDates = useMemo(() => {
-    const messagesDates: number[] = []
-
-    for (let i = 1; i < messages.length; i++) {
-      const previousMessage = messages[i - 1]
-      const message = messages[i]
+  // Telegram-style sticky day header (iOS section-header behaviour).
+  //
+  // The list is inverted: older days sit higher on screen, newer days lower.
+  // `daysPositionsArray` is sorted ascending by y, so index 0 is the newest day.
+  //
+  // For each day separator the on-screen Y of its top edge is:
+  //   separatorScreenTop = (listHeight + scrolledY) - (day.y + day.height)
+  // and the separator's pill renders DAY_MARGIN_TOP below that (Day's container
+  // marginTop). The floating header overrides that margin to 0, so when it is
+  // pinned at DAY_PIN_OFFSET its pill lines up with an inline separator whose
+  // separatorScreenTop === DAY_HANDOFF_OFFSET (= DAY_PIN_OFFSET - DAY_MARGIN_TOP).
+  //
+  // A day becomes "stuck" (shown by the floating header) the instant its separator
+  // reaches the handoff line (separatorScreenTop <= DAY_HANDOFF_OFFSET). At that same
+  // pixel the inline separator hard-cuts off (see Item) and the floating hard-cuts
+  // on, so the date hands off floating<->inline with no fade and no duplicate. The
+  // floating is then positioned by the next (newer) day's separator so it slides
+  // pixel by pixel:
+  //   top = min(DAY_PIN_OFFSET, nextSeparatorScreenTop + DAY_MARGIN_TOP - headerHeight - DAY_PUSH_GAP)
+  // so the outgoing pill keeps a DAY_PUSH_GAP margin above the rising pill.
+  const sticky = useDerivedValue(() => {
+    'worklet'
 
-      if (!isSameDay(previousMessage, message) || !messagesDates.includes(new Date(message.createdAt).getTime()))
-        messagesDates.push(new Date(message.createdAt).getTime())
+    const days = daysPositionsArray.value
+
```

**File**: `src/MessagesContainer/components/DayAnimated/types.ts` (modified, +4/-2)
```diff
@@ -1,12 +1,14 @@
 import { DayProps } from '../../../Day'
-import { IMessage } from '../../../Models'
 import { DaysPositions } from '../../types'
 
 export interface DayAnimatedProps extends Omit<DayProps, 'createdAt'> {
   scrolledY: { value: number }
   daysPositions: { value: DaysPositions }
   listHeight: { value: number }
+  isScrollActive: { value: boolean }
+  // Mirror of the date the floating header is currently rendering. The header writes
+  // it; the inline separators read it to cover the header's 1-frame text lag.
+  floatingRenderedDate: { value: number | undefined }
   renderDay?: (props: DayProps) => React.ReactNode
-  messages: IMessage[]
   isLoading: boolean
 }
```

**File**: `src/MessagesContainer/components/Item/index.tsx` (modified, +24/-20)
```diff
@@ -1,11 +1,12 @@
 import React, { useCallback, useMemo } from 'react'
 import { LayoutChangeEvent, View } from 'react-native'
-import Animated, { interpolate, useAnimatedStyle, useDerivedValue, useSharedValue } from 'react-native-reanimated'
+import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue } from 'react-native-reanimated'
 import { Day } from '../../../Day'
 import { Message, MessageProps } from '../../../Message'
 import { IMessage } from '../../../Models'
 import { isSameDay } from '../../../utils'
 import { DaysPositions } from '../../types'
+import { DAY_HANDOFF_OFFSET, DAY_MARGIN_TOP } from '../dayLayout'
 import { ItemProps } from './types'
 
 export * from './types'
@@ -28,7 +29,7 @@ export const useRelativeScrolledPositionToBottomOfDay = (
   dayTopOffset: number,
   createdAt?: number
 ) => {
-  const dayMarginTop = useMemo(() => 5, [])
+  const dayMarginTop = useMemo(() => DAY_MARGIN_TOP, [])
 
   const absoluteScrolledPositionToBottomOfDay = useAbsoluteScrolledPositionToBottomOfDay(listHeight, scrolledY, containerHeight, dayBottomMargin, dayTopOffset)
 
@@ -109,6 +110,7 @@ const AnimatedDayWrapper = <TMessage extends IMessage>(props: ItemProps<TMessage
     scrolledY,
     daysPositions,
     listHeight,
+    floatingRenderedDate,
     ...rest
   } = props
 
@@ -126,24 +128,26 @@ const AnimatedDayWrapper = <TMessage extends IMessage>(props: ItemProps<TMessage
     dayContainerHeight.value = nativeEvent.layout.height
   }, [dayContainerHeight])
 
-  const style = useAnimatedStyle(() => ({
-    opacity: interpolate(
-      relativeScrolledPositionToBottomOfDay.value,
-      [
-        -dayTopOffset,
-        -0.0001,
-        0,
-        dayContainerHeight.value + dayTopOffset,
-      ],
-      [
-        0,
-        0,
-        1,
-        1,
-      ],
-      'clamp'
-    ),
-  }), [relativeScrolledPositionToBottomOfDay, dayContainerHeight, dayTopOffset])
+  const style = useAnimatedStyle(() => {
+    // rel = separatorScreenTop - DAY_MARGIN_TOP, so separatorScreenTop = rel + DAY_MARGIN_TOP.
+    // The inline separator is the in-conversation date marker. It is shown while its
+    // day is below the handoff line, and hidden once its day is the one the floating
+    // header is actually rendering at the pin - a hard step (no fade) so the date
+    // goes floating(1) <-> inline(1) at the same pixel with no dip and no duplicate.
+    //
+    // Hiding on `floatingRenderedDate` (the header's *rendered* date) rather than on
+    // position alone is what kills the 1-frame flash when scrolling into a newer day:
+    // the worklet picks the new stuck day instantly but the header's text only
+    // updates ~1 frame later on the JS thread; until it does, this inline separator
+    // stays up and shows the correct date, so the header never flashes the old one.
+    const separatorScreenTop = relativeScrolledPositionToBottomOfDay.value + DAY_MARGIN_TOP
+    const belowHandoff = separatorScreenTop > DAY_HANDOFF_OFFSET
+    const headerShowsThisDay = floatingRenderedDate != null && floatingRenderedDate.value === createdAt
+
+    return {
+      opacity: belowHandoff || !headerShowsThisDay ? 1 : 0,
+    }
+  }, [relativeScrolledPositionToBottomOfDay, floatingRenderedDate, createdAt])
 
   return (
     <Animated.View
```

**File**: `src/MessagesContainer/components/Item/types.ts` (modified, +4/-0)
```diff
@@ -9,5 +9,9 @@ export interface ItemProps<TMessage extends IMessage> extends MessagesContainerP
   scrolledY: { value: number }
   daysPositions: { value: DaysPositions }
   listHeight: { value: number }
+  // The date currently rendered by the floating header (createdAt ms). Lets the
+  // inline separator stay visible until the header has actually rendered that day,
+  // covering the ~1-frame JS-thread lag on the floating header's text.
+  floatingRenderedDate?: { value: number | undefined }
   isDayAnimationEnabled?: boolean
 }
```

**File**: `src/MessagesContainer/components/dayLayout.ts` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+// Shared layout constants so the inline day separators (rendered inside the
+// list) and the floating sticky day header (the DayAnimated overlay) hand off
+// at exactly the same screen line. Keeping these in sync is what makes the
+// Telegram-style "push" read as a single sticky header with no duplicate badge
+// and no gap at the day boundary.
+
+// Screen-Y (px from the top of the list) where a day header sticks and where
+// the inline separator hands over to the floating header.
+export const DAY_PIN_OFFSET = 10
+
+// Vertical margin baked into the inline separator's relative-scroll math
+// (see useRelativeScrolledPositionToBottomOfDay). rel = separatorScreenTop - DAY_MARGIN_TOP.
+export const DAY_MARGIN_TOP = 5
+
+// Px range over which the inline separator cross-fades around the pin line as
+// the floating header takes over, to avoid a one-frame pop at the handoff.
+export const DAY_HANDOFF_FADE = 10
+
+// Vertical gap kept between the outgoing floating header and the incoming
+// separator's pill during the push, so the two dates don't touch.
+export const DAY_PUSH_GAP = 8
+
+// The separatorScreenTop value at which an inline separator's pill reaches the
+// floating header's pinned pill position, so they hand off at the exact same
+// spot. The inline pill sits `DAY_MARGIN_TOP` below its separatorScreenTop
+// (Day's container marginTop); the floating header overrides that margin to 0,
+// so its pinned pill sits `DAY_MARGIN_TOP` higher. They coincide at
+// separatorScreenTop = DAY_PIN_OFFSET - DAY_MARGIN_TOP.
+export const DAY_HANDOFF_OFFSET = DAY_PIN_OFFSET - DAY_MARGIN_TOP
```

**File**: `src/MessagesContainer/index.tsx` (modified, +27/-3)
```diff
@@ -58,6 +58,14 @@ export const MessagesContainer = <TMessage extends IMessage>(props: MessagesCont
   const listHeight = useSharedValue(0)
   const contentHeight = useSharedValue(0)
   const scrolledY = useSharedValue(0)
+  // The date (createdAt ms) the floating day header is currently rendering. Used to
+  // keep the inline separator visible until the header's text has caught up, hiding
+  // the 1-frame JS-thread lag of the header on each day change.
+  const floatingRenderedDate = useSharedValue<number | undefined>(undefined)
+  // true while the user is actively scrolling (finger down dragging or momentum
+  // running). Drives the floating day header visibility so it stays opaque for the
+  // whole gesture and only fades once scrolling fully stops.
+  const isScrollActive = useSharedValue(false)
 
   const renderTypingIndicator = useCallback(() => {
     if (renderTypingIndicatorProp)
@@ -211,6 +219,7 @@ export const MessagesContainer = <TMessage extends IMessage>(props: MessagesCont
         scrolledY,
         daysPositions,
         listHeight,
+        floatingRenderedDate,
         isDayAnimationEnabled,
       }
 
@@ -220,7 +229,7 @@ export const MessagesContainer = <TMessage extends IMessage>(props: MessagesCont
     }
 
     return null
-  }, [messages, restProps, isInverted, scrolledY, daysPositions, listHeight, isDayAnimationEnabled, user])
+  }, [messages, restProps, isInverted, scrolledY, daysPositions, listHeight, floatingRenderedDate, isDayAnimationEnabled, user])
 
   const emptyContent = useMemo(() => {
     if (!renderChatEmptyProp)
@@ -388,7 +397,21 @@ export const MessagesContainer = <TMessage extends IMessage>(props: MessagesCont
 
       runOnJS(handleOnScroll)(event)
     },
-  }, [handleOnScroll])
+    onBeginDrag: () => {
+      isScrollActive.value = true
+    },
+    onEndDrag: () => {
+      // Momentum (if any) re-asserts isScrollActive via onMomentumBegin within the
+      // header's fade-out delay, so a flick keeps the header visible.
+      isScrollActive.value = false
+    },
+    onMomentumBegin: () => {
+      isScrollActive.value = true
+    },
+    onMomentumEnd: () => {
+      isScrollActive.value = false
+    },
+  }, [handleOnScroll, isScrollActive])
 
   // removes unrendered days positions when messages are added/removed
   useEffect(() => {
@@ -455,8 +478,9 @@ export const MessagesContainer = <TMessage extends IMessage>(props: MessagesCont
           scrolledY={scrolledY}
           daysPositions={daysPositions}
           listHeight={listHeight}
+          isScrollActive={isScrollActive}
+          floatingRenderedDate={floatingRenderedDate}
           renderDay={renderDayProp}
-          messages={messages}
           isLoading={loadEarlierMessagesProps?.isLoading ?? false}
           dateFormat={props.dateFormat}
           dateFormatCalendar={props.dateFormatCalendar}
```

---

### Incident Patch 5: `7c2768df` (2026-06-18)
**Commit Message**: feat: expose isAnimated flag to renderDay for floating header (#2721) (#2748)

renderDay is used for both the inline day separators and the floating
animated day header. Previously there was no way to tell the two apart,
so a custom renderDay was forced to use the same look for both.

Pass isAnimated in the DayProps given to renderDay (true for the floating
header, false for the inline separators) so a single renderDay can branch
and style each differently. dateFormat/dateFormatCalendar already flow to
the floating header, so custom date formats stay in sync there too.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -446,7 +446,7 @@ See full example in [LinksExample](example/components/chat-examples/LinksExample
 - **`timeFormat`** _(String)_ - Format to use for rendering times; default is `'LT'` (see [Day.js Format](https://day.js.org/docs/en/display/format))
 - **`dateFormat`** _(String)_ - Format to use for rendering dates; default is `'D MMMM'` (see [Day.js Format](https://day.js.org/docs/en/display/format))
 - **`dateFormatCalendar`** _(Object)_ - Format to use for rendering relative times; default is `{ sameDay: '[Today]' }` (see [Day.js Calendar](https://day.js.org/docs/en/plugin/calendar))
-- **`renderDay`** _(Component | Function)_ - Custom day above a message
+- **`renderDay`** _(Component | Function)_ - Custom day above a message. The same function renders both the inline day separators and the floating/animated day header that sticks to the top while scrolling. Read `props.isAnimated` (`true` for the floating header, `false` for the inline separator) to give each a different look.
 - **`dayProps`** _(Object)_ - Props to pass to the Day component:
   - `containerStyle` - Custom style for the day container
   - `wrapperStyle` - Custom style for the day wrapper
```

**File**: `src/Day/types.ts` (modified, +6/-0)
```diff
@@ -12,4 +12,10 @@ export interface DayProps {
   wrapperStyle?: StyleProp<ViewStyle>
   /** Props to pass to the Text component (e.g., style, allowFontScaling, numberOfLines) */
   textProps?: Partial<TextProps>
+  /**
+   * `true` when rendered as the floating/animated day header that sticks to the
+   * top while scrolling, `false`/`undefined` for the inline day separators.
+   * Use this in a custom `renderDay` to give the floating header a different look.
+   */
+  isAnimated?: boolean
 }
```

**File**: `src/MessagesContainer/components/DayAnimated/index.tsx` (modified, +2/-1)
```diff
@@ -135,11 +135,12 @@ export const DayAnimated = ({ scrolledY, daysPositions, listHeight, renderDay, m
       return null
 
     return renderDay
-      ? renderDay({ ...rest, createdAt })
+      ? renderDay({ ...rest, createdAt, isAnimated: true })
       : <Day
         {...rest}
         containerStyle={[styles.dayAnimatedDayContainerStyle, rest.containerStyle]}
         createdAt={createdAt}
+        isAnimated
       />
   }, [createdAt, renderDay, rest])
 
```

**File**: `src/MessagesContainer/components/Item/index.tsx` (modified, +2/-2)
```diff
@@ -97,8 +97,8 @@ const DayWrapper = <TMessage extends IMessage>(props: MessageProps<TMessage>) =>
     <View>
       {
         renderDayProp
-          ? renderDayProp({ ...rest, createdAt: currentMessage.createdAt })
-          : <Day {...rest} createdAt={currentMessage.createdAt} />
+          ? renderDayProp({ ...rest, createdAt: currentMessage.createdAt, isAnimated: false })
+          : <Day {...rest} createdAt={currentMessage.createdAt} isAnimated={false} />
       }
     </View>
   )
```

---

### Incident Patch 6: `ba485ba7` (2026-06-18)
**Commit Message**: fix: avoid duplicate day badge from animated header (#2709) (#2747)

After aligning the animated header's date with the visible group, the
floating header could briefly show the same date as the inline day
separator while that separator was still on screen, producing a stacked
duplicate date badge during scroll.

Gate the floating header's opacity on relativeScrolledPositionToBottomOfDay:
only show it once the current day's inline separator has scrolled off the
top (< 0). While the inline separator is still visible (>= 0) it already
shows the date, so the floating copy stays hidden - a clean handoff with no
duplicate.

**File**: `src/MessagesContainer/components/DayAnimated/index.tsx` (modified, +11/-2)
```diff
@@ -71,8 +71,17 @@ export const DayAnimated = ({ scrolledY, daysPositions, listHeight, renderDay, m
   }), [relativeScrolledPositionToBottomOfDay, containerHeight, dayTopOffset, isLoadingAnim])
 
   const contentStyle = useAnimatedStyle(() => ({
-    opacity: opacity.value,
-  }), [opacity])
+    // Only show the floating header once the current day's inline separator has
+    // scrolled off the top (relativeScrolledPositionToBottomOfDay < 0). While the
+    // inline separator is still on screen (>= 0) it already shows the date, so
+    // hiding the floating copy avoids a duplicate date badge (#2709).
+    opacity: opacity.value * interpolate(
+      relativeScrolledPositionToBottomOfDay.value,
+      [-0.0001, 0],
+      [1, 0],
+      'clamp'
+    ),
+  }), [opacity, relativeScrolledPositionToBottomOfDay])
 
   const fadeOut = useCallback(() => {
     'worklet'
```

---

### Incident Patch 7: `c2fb1c99` (2026-06-18)
**Commit Message**: fix: animated day header shows wrong date while scrolling (#2709) (#2746)

The floating day header picked its date with a different threshold
(`day.y + day.height - containerHeight - dayBottomMargin`) than the one
that drives its vertical position (`currentDayPosition`, which uses
`day.y + day.height`). The mismatch made the displayed date switch at a
different scroll point than the header's visual transition, so it could
show the adjacent day's date (e.g. the previous day) for the group in view.

Align the date selection with the position logic: same `day.y + day.height`
threshold and the same last-item fallback.

**File**: `src/MessagesContainer/components/DayAnimated/index.tsx` (modified, +7/-3)
```diff
@@ -46,16 +46,20 @@ export const DayAnimated = ({ scrolledY, daysPositions, listHeight, renderDay, m
   }, [messages])
 
   const createdAtDate = useDerivedValue(() => {
+    // Pick the day the header is currently positioned over. This must use the
+    // same threshold (day.y + day.height) and last-item fallback as
+    // `currentDayPosition` which drives the header's vertical position;
+    // otherwise the displayed date can lag the visible group by one day (#2709).
     for (let i = 0; i < daysPositionsArray.value.length; i++) {
       const day = daysPositionsArray.value[i]
-      const dayPosition = day.y + day.height - containerHeight.value - dayBottomMargin
+      const dayPosition = day.y + day.height
 
-      if (absoluteScrolledPositionToBottomOfDay.value < dayPosition)
+      if (absoluteScrolledPositionToBottomOfDay.value < dayPosition || i === daysPositionsArray.value.length - 1)
         return day.createdAt
     }
 
     return messagesDates[messagesDates.length - 1]
-  }, [daysPositionsArray, absoluteScrolledPositionToBottomOfDay, messagesDates, containerHeight, dayBottomMargin])
+  }, [daysPositionsArray, absoluteScrolledPositionToBottomOfDay, messagesDates])
 
   const style = useAnimatedStyle(() => ({
     top: interpolate(
```

---

### Incident Patch 8: `76222515` (2026-06-18)
**Commit Message**: fix: auto-scroll to new message when inverted is false (#2612) (#2745)

A non-inverted message list appends new messages off-screen at the end and
never scrolled to reveal them (inverted lists keep the newest message
visible on their own). Track the latest message and, when it changes in a
non-inverted list, scroll to the bottom - but only when the user is already
near the bottom, so it doesn't yank them away while reading earlier messages.

**File**: `src/MessagesContainer/index.tsx` (modified, +36/-2)
```diff
@@ -1,4 +1,4 @@
-import React, { useCallback, useEffect, useMemo, useState } from 'react'
+import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
 import {
   View,
   LayoutChangeEvent,
@@ -56,6 +56,7 @@ export const MessagesContainer = <TMessage extends IMessage>(props: MessagesCont
 
   const daysPositions = useSharedValue<DaysPositions>({})
   const listHeight = useSharedValue(0)
+  const contentHeight = useSharedValue(0)
   const scrolledY = useSharedValue(0)
 
   const renderTypingIndicator = useCallback(() => {
@@ -125,6 +126,7 @@ export const MessagesContainer = <TMessage extends IMessage>(props: MessagesCont
       (!isInverted && lastScrolledY.value < contentOffsetY)
 
     lastScrolledY.value = contentOffsetY
+    contentHeight.value = contentSizeHeight
 
     if (isInverted)
       if (contentOffsetY > scrollToBottomOffset!)
@@ -138,7 +140,39 @@ export const MessagesContainer = <TMessage extends IMessage>(props: MessagesCont
       changeScrollToBottomVisibility(false)
     else
       changeScrollToBottomVisibility(false)
-  }, [isInverted, scrollToBottomOffset, changeScrollToBottomVisibility, isScrollingDown, lastScrolledY, listPropsOnScrollProp])
+  }, [isInverted, scrollToBottomOffset, changeScrollToBottomVisibility, isScrollingDown, lastScrolledY, contentHeight, listPropsOnScrollProp])
+
+  // Auto-scroll to the newest message when it arrives in a non-inverted list.
+  // Inverted lists keep the newest message visible on their own, but a
+  // non-inverted list appends new messages off-screen at the end (#2612).
+  // Only scroll when the user is already near the bottom so we don't yank
+  // them away while they are reading earlier messages.
+  const latestMessageId = !isInverted && messages.length > 0
+    ? messages[messages.length - 1]._id
+    : undefined
+  const previousLatestMessageId = useRef(latestMessageId)
+  useEffect(() => {
+    if (isInverted) {
+      previousLatestMessageId.current = latestMessageId
+      return
+    }
+
+    if (
+      latestMessageId != null &&
+      latestMessageId !== previousLatestMessageId.current &&
+      // skip the very first render; initial positioning is handled on layout
+      previousLatestMessageId.current !== undefined
+    ) {
+      const isNearBottom =
+        contentHeight.value === 0 ||
+        lastScrolledY.value + listHeight.value >= contentHeight.value - scrollToBottomOffset!
+
+      if (isNearBottom)
+        doScrollToBottom(true)
+    }
+
+    previousLatestMessageId.current = latestMessageId
+  }, [latestMessageId, isInverted, doScrollToBottom, contentHeight, lastScrolledY, listHeight, scrollToBottomOffset])
 
   const restProps = useMemo(() => {
     // eslint-disable-next-line @typescript-eslint/no-unused-vars
```

---

### Incident Patch 9: `44802f32` (2026-06-18)
**Commit Message**: chore(deps): refresh lockfiles to pull in-range security patches (#2744)

Regenerate root and example lockfiles so transitive dependencies resolve
to their highest in-range (patched) versions, clearing Dependabot alerts
for ws, minimatch (3/8/9/10.x), picomatch (2/4.x), node-forge,
@xmldom/xmldom, flatted, js-yaml 4.x, @isaacs/brace-expansion and @babel/core.

All are dev / example transitive dependencies; none are runtime
dependencies of the published package (which ships only `lib`).

js-yaml 3.x and uuid 7.x are not bumped: their parents pin a major below
the patched release, so they can't be upgraded without breaking them.



---

### Incident Patch 10: `5f7b9071` (2026-06-18)
**Commit Message**: Bump brace-expansion from 1.1.12 to 1.1.15 in /example (#2732)

Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion) from 1.1.12 to 1.1.15.
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v1.1.12...v1.1.15)

---
updated-dependencies:
- dependency-name: brace-expansion
  dependency-version: 1.1.13
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `example/yarn.lock` (modified, +4/-11)
```diff
@@ -3407,21 +3407,14 @@ bplist-parser@^0.3.1:
     big-integer "1.6.x"
 
 brace-expansion@^1.1.7:
-  version "1.1.12"
-  resolved "https://registry.yarnpkg.com/brace-expansion/-/brace-expansion-1.1.12.tgz#ab9b454466e5a8cc3a187beaad580412a9c5b843"
-  integrity sha512-9T9UjW3r0UW5c1Q7GTwllptXwhvYmEzFhzMfZ9H7FQWt+uZePjZPjBP/W1ZEyZ1twGWom5/56TF4lPcqjnDHcg==
+  version "1.1.15"
+  resolved "https://registry.yarnpkg.com/brace-expansion/-/brace-expansion-1.1.15.tgz#a6d90d54067236e5f42570a3b7378d594d9b7738"
+  integrity sha512-EwOCDEex4quD37XhqM3omwtMoJjr//isUZz1JopUNWms+4Z2ViyM/k1YIRePpoVNnQhENnxtFjLaxNHrT7xIUg==
   dependencies:
     balanced-match "^1.0.0"
     concat-map "0.0.1"
 
-brace-expansion@^2.0.1:
-  version "2.0.2"
-  resolved "https://registry.yarnpkg.com/brace-expansion/-/brace-expansion-2.0.2.tgz#54fc53237a613d854c7bd37463aad17df87214e7"
-  integrity sha512-Jt0vHyM+jmUBqojB7E1NIYadt0vI0Qxjxd2TErW94wDz+E2LAm5vKMXXwg6ZZBTHPuUlDgQHKXvjGBdfcF1ZDQ==
-  dependencies:
-    balanced-match "^1.0.0"
-
-brace-expansion@^2.0.2:
+brace-expansion@^2.0.1, brace-expansion@^2.0.2:
   version "2.1.1"
   resolved "https://registry.yarnpkg.com/brace-expansion/-/brace-expansion-2.1.1.tgz#c68b1c4111c76aae3a6fba55d496cee10c39dad8"
   integrity sha512-WR1cURNjuvBLMZBMbqM0UoE+WAfdUcEV1ccD8PVBVOI+Z3ND4+SZbN8RsfT2bMuG1qwz5RFvPukSZm5fF2D5eA==
```

---

### Incident Patch 11: `cb535959` (2026-06-18)
**Commit Message**: fix: composer resize after send + add disableKeyboardProvider opt-out

- Reset the web composer height back to its minimum when the text is
  cleared, so the input shrinks after sending a multiline message (#2716).
  Native already auto-resizes; this was a web-only gap.
- Add `disableKeyboardProvider` prop to skip the built-in KeyboardProvider
  wrapper. Lets apps that mount their own provider avoid the forced
  edge-to-edge (statusBarTranslucent / navigationBarTranslucent) wrapper
  that caused layout shift, mount flicker and header distortion on
  Android/Expo (#2707, #2728, #2731, #2593).
- Document `disableKeyboardProvider` in the README, including the caveat
  that keyboard avoidance requires a KeyboardProvider ancestor.

**File**: `README.md` (modified, +31/-0)
```diff
@@ -251,6 +251,7 @@ interface User {
 - **`keyboardProviderProps`** _(Object)_ - Props to be passed to the [`KeyboardProvider`](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/keyboard-provider) for keyboard handling. Default values:
   - `statusBarTranslucent: true` - Required on Android for correct keyboard height calculation when status bar is translucent (edge-to-edge mode)
   - `navigationBarTranslucent: true` - Required on Android for correct keyboard height calculation when navigation bar is translucent (edge-to-edge mode)
+- **`disableKeyboardProvider`** _(Bool)_ - Skip rendering the built-in `KeyboardProvider` wrapper; default is `false`. Enable this when your app already mounts its own `KeyboardProvider` (e.g. once at the root), or when the default edge-to-edge behavior causes a layout shift, flicker on mount, or a header/content jump on Android/Expo. See [Using your own `KeyboardProvider`](#using-your-own-keyboardprovider) below.
 - **`keyboardAvoidingViewProps`** _(Object)_ - Props to be passed to the [`KeyboardAvoidingView`](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-avoiding-view). See **keyboardVerticalOffset** below for proper keyboard handling.
 - **`isAlignedTop`** _(Boolean)_ Controls whether or not the message bubbles appear at the top of the chat (Default is false - bubbles align to bottom)
 - **`isInverted`** _(Bool)_ - Reverses display order of `messages`; default is `true`
@@ -287,6 +288,36 @@ function ChatScreen() {
 
 **Why this matters:** Without the correct offset, the keyboard may overlap the input field or leave extra space. The KeyboardAvoidingView uses this value to calculate how much to shift the content when the keyboard appears.
 
+#### Using your own `KeyboardProvider`
+
+By default GiftedChat wraps itself in a [`KeyboardProvider`](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/keyboard-provider) with `statusBarTranslucent` and `navigationBarTranslucent` enabled. On some Android/Expo (edge-to-edge) setups this can cause the screen to shift down, flicker on mount, or distort a navigation header - especially when another `KeyboardProvider` already exists higher in the tree.
+
+Set **`disableKeyboardProvider`** to skip the built-in wrapper:
+
+```jsx
+import { KeyboardProvider } from 'react-native-keyboard-controller'
+
+// Mount a single KeyboardProvider once, near the root of your app
+function App() {
+  return (
+    <KeyboardProvider>
+      {/* ...navigation / screens... */}
+    </KeyboardProvider>
+  )
+}
+
+function ChatScreen() {
+  return (
+    <GiftedChat
+      disableKeyboardProvider
+      // ... other props
+    />
+  )
+}
+```
+
+> **Important:** GiftedChat's keyboard avoidance relies on a `KeyboardProvider` being present in the tree. When you set `disableKeyboardProvider`, you **must** mount your own `KeyboardProvider` above GiftedChat - otherwise the keyboard will cover the input. Mounting exactly one provider (yours) is what avoids the double edge-to-edge shift.
+
 ### Text Input & Composer
 
 - **`text`** _(String)_ - Input text; default is `undefined`, but if specified, it will override GiftedChat's internal state. Useful for managing text state outside of GiftedChat (e.g. with Redux). Don't forget to implement `textInputProps.onChangeText` to update the text state.
```

**File**: `src/Composer.tsx` (modified, +9/-1)
```diff
@@ -1,4 +1,4 @@
-import React, { useCallback, useMemo, useState } from 'react'
+import React, { useCallback, useEffect, useMemo, useState } from 'react'
 import {
   Platform,
   StyleSheet,
@@ -36,6 +36,14 @@ export function Composer ({
 
   const [height, setHeight] = useState<number | undefined>(minHeight)
 
+  // Reset the (web) auto-grown height back to its minimum once the text is
+  // cleared, e.g. after sending. Without this the composer stays expanded at
+  // the height of the previously sent multiline message. (#2716)
+  useEffect(() => {
+    if (Platform.OS === 'web' && text.length === 0)
+      setHeight(minHeight)
+  }, [text, minHeight])
+
   const handleContentSizeChange = useMemo(() => {
     if (Platform.OS === 'web')
       return (e: TextInputContentSizeChangeEvent) => {
```

**File**: `src/GiftedChat/index.tsx` (modified, +14/-7)
```diff
@@ -347,19 +347,26 @@ function GiftedChat<TMessage extends IMessage = IMessage> (
 function GiftedChatWrapper<TMessage extends IMessage = IMessage> (props: GiftedChatProps<TMessage>) {
   const {
     keyboardProviderProps,
+    disableKeyboardProvider = false,
     ...rest
   } = props
 
+  const chat = <GiftedChat<TMessage> {...rest} />
+
   return (
     <GestureHandlerRootView style={styles.fill}>
       <SafeAreaProvider>
-        <KeyboardProvider
-          statusBarTranslucent
-          navigationBarTranslucent
-          {...keyboardProviderProps}
-        >
-          <GiftedChat<TMessage> {...rest} />
-        </KeyboardProvider>
+        {disableKeyboardProvider
+          ? chat
+          : (
+            <KeyboardProvider
+              statusBarTranslucent
+              navigationBarTranslucent
+              {...keyboardProviderProps}
+            >
+              {chat}
+            </KeyboardProvider>
+          )}
       </SafeAreaProvider>
     </GestureHandlerRootView>
   )
```

**File**: `src/GiftedChat/types.ts` (modified, +9/-0)
```diff
@@ -146,6 +146,15 @@ export interface GiftedChatProps<TMessage extends IMessage> extends Partial<Omit
   ) => React.ReactNode
   renderQuickReplySend?: () => React.ReactNode
   keyboardProviderProps?: React.ComponentProps<typeof KeyboardProvider>
+  /**
+   * Skip rendering the built-in `KeyboardProvider` wrapper.
+   * Enable this when your app already mounts its own `KeyboardProvider`
+   * (e.g. once at the root), or when the default `statusBarTranslucent` /
+   * `navigationBarTranslucent` edge-to-edge behavior causes layout shift,
+   * flicker on mount, or a header/content jump on Android/Expo.
+   * Default is `false`.
+   */
+  disableKeyboardProvider?: boolean
   /** Props for KeyboardAvoidingView. Use `keyboardVerticalOffset` to account for headers or iOS predictive text bar (~44pt). */
   keyboardAvoidingViewProps?: KeyboardAvoidingViewProps
   /** Enable animated day label that appears on scroll; default is true */
```

---

### Incident Patch 12: `ddbed8a5` (2026-06-16)
**Commit Message**: test: cover default `text` prop preserved on initial render (#603)

#603 (default input text cleared on first render) no longer reproduces:
the text state initializes from `props.text` and the initial-layout pass
preserves it. Add a regression test. The old `onInputTextChanged` reset
path from that report no longer exists in the current API.

**File**: `src/__tests__/GiftedChat.test.tsx` (modified, +23/-1)
```diff
@@ -1,5 +1,5 @@
 import React from 'react'
-import { render } from '@testing-library/react-native'
+import { render, fireEvent } from '@testing-library/react-native'
 
 import { GiftedChat } from '..'
 
@@ -29,6 +29,28 @@ it('should render <GiftedChat/> and compare with snapshot', () => {
   expect(toJSON()).toMatchSnapshot()
 })
 
+it('preserves the default `text` prop on initial render (#603)', () => {
+  const { getByDisplayValue, getByTestId } = render(
+    <GiftedChat
+      messages={messages}
+      onSend={() => {}}
+      user={{
+        _id: 1,
+      }}
+      text='test'
+    />
+  )
+
+  // Mount the input toolbar by simulating the initial layout pass (this is also
+  // where the text-init/reset logic runs that #603 reported as clearing text).
+  fireEvent(getByTestId('GC_WRAPPER'), 'layout', {
+    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
+  })
+
+  // The composer must show the provided default text, not a cleared value.
+  expect(getByDisplayValue('test')).toBeTruthy()
+})
+
 it('should render <GiftedChat/> with light colorScheme and compare with snapshot', () => {
   const { toJSON } = render(
     <GiftedChat
```

---

### Incident Patch 13: `a6c146b1` (2026-06-16)
**Commit Message**: fix: MessageImage onPress not firing on Android (#2714)

The content Animated.View inside the custom TouchableOpacity captured
touches and swallowed the RNGH BaseButton's press on Android. Mark it
pointerEvents: 'none' (via StyleSheet, not an inline style object) so the
press reaches the button. iOS was unaffected.

**File**: `src/__tests__/__snapshots__/Actions.test.tsx.snap` (modified, +3/-0)
```diff
@@ -48,6 +48,9 @@ exports[`should render <Actions /> and compare with snapshot 1`] = `
         {
           "opacity": 1,
         },
+        {
+          "pointerEvents": "none",
+        },
       ]
     }
   >
```

**File**: `src/__tests__/__snapshots__/InputToolbar.test.tsx.snap` (modified, +3/-0)
```diff
@@ -123,6 +123,9 @@ exports[`should render <InputToolbar /> and compare with snapshot 1`] = `
             {
               "opacity": 1,
             },
+            {
+              "pointerEvents": "none",
+            },
           ]
         }
         testID="GC_SEND_TOUCHABLE"
```

**File**: `src/__tests__/__snapshots__/LoadEarlier.test.tsx.snap` (modified, +3/-0)
```diff
@@ -41,6 +41,9 @@ exports[`should render <LoadEarlierMessages /> and compare with snapshot 1`] = `
       {
         "opacity": 1,
       },
+      {
+        "pointerEvents": "none",
+      },
     ]
   }
 >
```

**File**: `src/__tests__/__snapshots__/MessageImage.test.tsx.snap` (modified, +3/-0)
```diff
@@ -35,6 +35,9 @@ exports[`MessageImage should  render <MessageImage /> and compare with snapshot
         {
           "opacity": 1,
         },
+        {
+          "pointerEvents": "none",
+        },
       ]
     }
   >
```

**File**: `src/__tests__/__snapshots__/Send.test.tsx.snap` (modified, +9/-0)
```diff
@@ -52,6 +52,9 @@ exports[`Send should always render <Send /> and compare with snapshot 1`] = `
         {
           "opacity": 1,
         },
+        {
+          "pointerEvents": "none",
+        },
       ]
     }
     testID="GC_SEND_TOUCHABLE"
@@ -132,6 +135,9 @@ exports[`Send should not render <Send /> and compare with snapshot 1`] = `
         {
           "opacity": 1,
         },
+        {
+          "pointerEvents": "none",
+        },
       ]
     }
     testID="GC_SEND_TOUCHABLE"
@@ -212,6 +218,9 @@ exports[`Send should render <Send /> where there is input and compare with snaps
         {
           "opacity": 1,
         },
+        {
+          "pointerEvents": "none",
+        },
       ]
     }
     testID="GC_SEND_TOUCHABLE"
```

**File**: `src/components/TouchableOpacity.tsx` (modified, +11/-1)
```diff
@@ -1,4 +1,5 @@
 import React, { useCallback } from 'react'
+import { StyleSheet } from 'react-native'
 import { BaseButton } from 'react-native-gesture-handler'
 import Animated, {
   useAnimatedStyle,
@@ -58,10 +59,19 @@ export const TouchableOpacity: React.FC<TouchableOpacityProps> = ({
       onActiveStateChange={handleActiveStateChange}
     >
       <Animated.View
-        style={[style, animatedStyle]}
+        // The content view must not capture touches, otherwise it swallows the
+        // BaseButton's press on Android (see #2714). pointerEvents in style is
+        // the non-deprecated form on RN's New Architecture.
+        style={[style, animatedStyle, styles.content]}
       >
         {children}
       </Animated.View>
     </BaseButton>
   )
 }
+
+const styles = StyleSheet.create({
+  content: {
+    pointerEvents: 'none',
+  },
+})
```

---

### Incident Patch 14: `a7adbffe` (2026-06-16)
**Commit Message**: fix: support react-native-gesture-handler v3 (#2739)

RNGH 3 removed the `Text` re-export, breaking the components that did
`import { Text } from 'react-native-gesture-handler'`. Move those imports
to `react-native`; this works on both RNGH 2 and 3. All other RNGH APIs
in use (BaseButton, GestureHandlerRootView, ReanimatedSwipeable, TextInput,
Pressable, FlatList) remain valid in both majors, and the peer range
(>=2.0.0) already spans both.

Also upgrade the library dev/test toolchain to the React Native 0.85 line:
- @react-native/* 0.85.3, react/react-dom/react-test-renderer 19.2.3
- migrate to @react-native/jest-preset (RN 0.85 moved the preset out of core)
  and scope transformIgnorePatterns to RN/Expo packages
- drop @babel/preset-env from the jest babel config (it conflicted with
  @react-native/babel-preset's class-properties transform)
- bump eslint/typescript tooling; migrate perfectionist config to v5
- widen GiftedChat color-scheme typing for RN 0.85's ColorSchemeName
- refresh affected snapshots

Verified green against RNGH 2 (typecheck, lint, 39 tests).

**File**: `babel.config.cjs` (modified, +0/-1)
```diff
@@ -3,7 +3,6 @@ module.exports = function (api) {
 
   return {
     presets: [
-      '@babel/preset-env',
       'module:@react-native/babel-preset',
       '@babel/preset-typescript',
     ],
```

**File**: `eslint.config.js` (modified, +10/-8)
```diff
@@ -198,11 +198,12 @@ export default [
             ['parent', 'sibling'],
             'index',
           ],
-          customGroups: {
-            value: {
-              react: ['^react$', '^react-native$'],
+          customGroups: [
+            {
+              groupName: 'react',
+              elementNamePattern: ['^react$', '^react-native$'],
             },
-          },
+          ],
           newlinesBetween: 'ignore',
         },
       ],
@@ -374,11 +375,12 @@ export default [
             ['parent', 'sibling'],
             'index',
           ],
-          customGroups: {
-            value: {
-              react: ['^react$', '^react-native$'],
+          customGroups: [
+            {
+              groupName: 'react',
+              elementNamePattern: ['^react$', '^react-native$'],
             },
-          },
+          ],
           newlinesBetween: 'ignore',
         },
       ],
```

**File**: `jest.config.cjs` (modified, +4/-3)
```diff
@@ -1,16 +1,17 @@
 module.exports = {
-  preset: 'react-native',
+  preset: '@react-native/jest-preset',
   resetMocks: true,
   setupFilesAfterEnv: [
-    './node_modules/react-native/jest-preset',
     './node_modules/react-native-gesture-handler/jestSetup.js',
     './tests/setup.ts',
   ],
   moduleFileExtensions: ['js', 'jsx', 'json', 'ts', 'tsx'],
   transform: {
     '\\.js$': ['babel-jest', { configFile: './babel.config.cjs' }],
   },
-  transformIgnorePatterns: [],
+  transformIgnorePatterns: [
+    'node_modules/(?!((jest-)?react-native|@react-native|@expo|expo))',
+  ],
   testMatch: ['**/*.test.ts?(x)'],
   modulePathIgnorePatterns: ['./example'],
   coveragePathIgnorePatterns: ['./src/__tests__/'],
```

**File**: `package.json` (modified, +35/-34)
```diff
@@ -51,55 +51,56 @@
   "dependencies": {
     "@expo/react-native-action-sheet": "^4.1.1",
     "@types/lodash.isequal": "^4.5.8",
-    "dayjs": "^1.11.19",
+    "dayjs": "^1.11.21",
     "lodash.isequal": "^4.5.0",
-    "react-native-zoom-reanimated": "^1.5.2"
+    "react-native-zoom-reanimated": "^1.5.3"
   },
   "devDependencies": {
-    "@babel/core": "^7.28.5",
-    "@babel/plugin-transform-react-jsx": "^7.27.1",
-    "@babel/plugin-transform-unicode-property-regex": "^7.27.1",
-    "@babel/preset-env": "^7.28.5",
-    "@react-native-community/cli": "20.0.0",
-    "@react-native-community/cli-platform-android": "20.0.0",
-    "@react-native-community/cli-platform-ios": "20.0.0",
-    "@react-native/babel-preset": "0.81.5",
-    "@react-native/eslint-config": "0.81.5",
-    "@react-native/metro-config": "0.81.5",
-    "@react-native/typescript-config": "0.81.5",
-    "@stylistic/eslint-plugin": "^3.1.0",
+    "@babel/core": "^7.29.7",
+    "@babel/plugin-transform-react-jsx": "^7.29.7",
+    "@babel/plugin-transform-unicode-property-regex": "^7.29.7",
+    "@babel/preset-env": "^7.29.7",
+    "@react-native-community/cli": "20.1.3",
+    "@react-native-community/cli-platform-android": "20.1.3",
+    "@react-native-community/cli-platform-ios": "20.1.3",
+    "@react-native/babel-preset": "0.85.3",
+    "@react-native/eslint-config": "0.85.3",
+    "@react-native/jest-preset": "0.85.3",
+    "@react-native/metro-config": "0.85.3",
+    "@react-native/typescript-config": "0.85.3",
+    "@stylistic/eslint-plugin": "^5.10.0",
     "@testing-library/dom": "^10.4.1",
     "@testing-library/react": "^16.3.0",
     "@testing-library/react-native": "^13.3.3",
-    "@types/jest": "^29.5.13",
-    "@types/react": "^19.2.5",
+    "@types/jest": "^29.5.14",
+    "@types/react": "^19.2.17",
     "@types/react-dom": "^19.2.3",
-    "@types/react-native": "^0.72.8",
+    "@types/react-native": "^0.73.0",
     "@types/react-test-renderer": "^19.1.0",
-    "@typescript-eslint/eslint-plugin": "^8.46.4",
-    "@typescript-eslint/parser": "^8.46.4",
+    "@typescript-eslint/eslint-plugin": "^8.61.1",
+    "@typescript-eslint/parser": "^8.61.1",
     "babel-jest": "^29.7.0",
-    "eslint": "^9.18.0",
-    "eslint-import-resolver-typescript": "^4.4.4",
+    "eslint": "^9.39.4",
+    "eslint-import-resolver-typescript": "^4.4.5",
     "eslint-plugin-import": "^2.32.0",
     "eslint-plugin-jest": "^28.11.0",
-    "eslint-plugin-perfectionist": "^4.15.1",
+    "eslint-plugin-perfectionist": "^5.9.1",
     "eslint-plugin-react": "^7.37.5",
-    "eslint-plugin-react-hooks": "^5.1.0",
+    "eslint-plugin-react-hooks": "^7.1.1",
     "husky": "^9.1.7",
     "jest": "^29.7.0",
     "json": "^11.0.0",
-    "lint-staged": "^15.5.0",
-    "react": "19.1.0",
-    "react-dom": "19.1.0",
-    "react-native": "0.81.5",
-    "react-native-gesture-handler": "~2.30.0",
-    "react-native-keyboard-controller": "1.20.6",
-    "react-native-reanimated": "~4.2.1",
-    "react-native-safe-area-context": "~5.6.2",
-    "react-native-worklets": "0.7.2",
-    "react-test-renderer": "19.1.0",
-    "typescript": "^5.9.3"
+    "lint-staged": "^17.0.7",
+    "react": "19.2.3",
+    "react-dom": "19.2.3",
+    "react-native": "0.85.3",
+    "react-native-gesture-handler": "~2.31.1",
+    "react-native-keyboard-controller": "^1.21.11",
+    "react-native-reanimated": "^4.4.1",
+    "react-native-safe-area-context": "^5.8.0",
+    "react-native-worklets": "^0.9.2",
+    "react-test-renderer": "19.2.3",
+    "typescript": "^6.0.3"
   },
   "peerDependencies": {
     "react": ">=18.0.0",
```

**File**: `src/Actions.tsx` (modified, +1/-3)
```diff
@@ -5,11 +5,9 @@ import {
   StyleProp,
   ViewStyle,
   TextStyle,
-} from 'react-native'
-import { Text } from 'react-native-gesture-handler'
+  Text } from 'react-native'
 import { Color } from './Color'
 import { TouchableOpacity } from './components/TouchableOpacity'
-
 import { useChatContext } from './GiftedChatContext'
 import stylesCommon from './styles'
 
```

**File**: `src/Bubble/index.tsx` (modified, +1/-2)
```diff
@@ -2,9 +2,8 @@ import React, { useCallback, useMemo } from 'react'
 import {
   View,
   Pressable,
-} from 'react-native'
+  Text } from 'react-native'
 
-import { Text } from 'react-native-gesture-handler'
 
 import { MessageReply } from '../components/MessageReply'
 import { useChatContext } from '../GiftedChatContext'
```

**File**: `src/Day/index.tsx` (modified, +1/-4)
```diff
@@ -1,14 +1,11 @@
 import React, { useMemo } from 'react'
 import {
   View,
-} from 'react-native'
+  Text } from 'react-native'
 import dayjs from 'dayjs'
 import calendar from 'dayjs/plugin/calendar'
 import relativeTime from 'dayjs/plugin/relativeTime'
-
-import { Text } from 'react-native-gesture-handler'
 import { DATE_FORMAT } from '../Constant'
-
 import { useChatContext } from '../GiftedChatContext'
 import stylesCommon from '../styles'
 import styles from './styles'
```

**File**: `src/GiftedAvatar.tsx` (modified, +1/-2)
```diff
@@ -6,8 +6,7 @@ import {
   StyleProp,
   ImageStyle,
   TextStyle,
-} from 'react-native'
-import { Text } from 'react-native-gesture-handler'
+  Text } from 'react-native'
 import { Color } from './Color'
 import { TouchableOpacity } from './components/TouchableOpacity'
 import { User } from './Models'
```

---

### Incident Patch 15: `c1bc1a69` (2026-05-12)
**Commit Message**: fix(example): fix eslint config

**File**: `example/tsconfig.json` (modified, +20/-1)
```diff
@@ -1,6 +1,17 @@
 {
-  "extends": "expo/tsconfig.base",
   "compilerOptions": {
+    "allowJs": true,
+    "customConditions": ["react-native"],
+    "esModuleInterop": true,
+    "jsx": "react-jsx",
+    "lib": ["DOM", "ESNext"],
+    "module": "preserve",
+    "moduleDetection": "force",
+    "moduleResolution": "bundler",
+    "noEmit": true,
+    "resolveJsonModule": true,
+    "skipLibCheck": true,
+    "target": "ESNext",
     "strict": true,
     "paths": {
       "@/*": [
@@ -13,5 +24,13 @@
     "**/*.tsx",
     ".expo/types/**/*.ts",
     "expo-env.d.ts"
+  ],
+  "exclude": [
+    "node_modules",
+    "babel.config.js",
+    "metro.config.js",
+    "jest.config.js",
+    "android",
+    "ios"
   ]
 }
```

#### Recent Merged Pull Requests:
- **PR #2757** (closed): chore(deps): bump shell-quote from 1.8.4 to 1.10.0 (@dependabot[bot])
- **PR #2756** (closed): 🐛 [Fix] Today label is not translated and hardcoded (@kevinhuang78)
- **PR #2753** (closed): chore(deps): bump js-yaml from 3.14.2 to 3.15.0 in /example (@dependabot[bot])
- **PR #2752** (2026-06-19): docs: document and link the remaining Features (@kesha-antonov)
- **PR #2751** (2026-06-19): docs: link Features list to their README sections (@kesha-antonov)
- **PR #2750** (2026-06-19): fix: Telegram-style sticky day header (slide, no flash, no duplicate) (@kesha-antonov)
- **PR #2749** (closed): fix: align DayAnimated sticky header with inline separators (Telegram-style push) (@kesha-antonov)
- **PR #2748** (2026-06-18): feat: expose isAnimated flag to renderDay for floating day header (#2721) (@kesha-antonov)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
