# Forensic Learning Record (Deep Inspection): obytes/react-native-template-obytes

> **Canonical Artifact**: `07_PROJECT_LEARNING/obytes-react-native-template-obytes-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/obytes/react-native-template-obytes](https://github.com/obytes/react-native-template-obytes))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:16:02.030Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `obytes/react-native-template-obytes`
- **Description**: 📱 A template for your next React Native project: Expo, PNPM, TypeScript, TailwindCSS, Husky, EAS, GitHub Actions, Env Vars, expo-router, react-query, react-hook-form.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4350 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/utils.js`
```
#!/usr/bin/env node
const { exec } = require('child_process');
const { consola } = require('consola');

const execShellCommand = (cmd) => {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.warn(error);
        reject(error);
      }
      resolve(stdout ? stdout : stderr);
    });
  });
};

const runCommand = async (
  command,
  { loading = 'loading ....', success = 'success', error = 'error' }
) => {
  consola.start(loading);
  try {
    await execShellCommand(command);
    consola.success(success);
  } catch (err) {
    consola.error(`Failed to execute ${command}`, err);
    process.exit(1);
  }
};
// show more details message using chalk
const showMoreDetails = (projectName) => {
  consola.box(
    'Your project is ready to go! \n\n\n',
    '🚀 To get started, run the following commands: \n\n',
    `   \`cd ${projectName}\` \n`,
    '   IOS     :  `pnpm ios` \n',
    '   Android :  `pnpm android` \n\n',
    '📚 Starter Documentation: https://starter.obytes.com'
  );
};

module.exports = {
  runCommand,
  showMoreDetails,
  execShellCommand,
};

```

### Core Architecture Module: `src/components/ui/form-utils.ts`
```
export function getFieldError(
  field: any,
): string | undefined {
  if (!field.state.meta.isTouched || !field.state.meta.errors.length) {
    return undefined;
  }

  const error = field.state.meta.errors[0];

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Handle object errors with message property (Zod errors)
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }

  // Fallback: convert to string
  return String(error);
}

```

### Core Architecture Module: `src/components/ui/utils.tsx`
```
/* eslint-disable react-refresh/only-export-components */
import type { AxiosError } from 'axios';
import { Dimensions, Platform } from 'react-native';
import { showMessage } from 'react-native-flash-message';

export const IS_IOS = Platform.OS === 'ios';
const { width, height } = Dimensions.get('screen');

export const WIDTH = width;
export const HEIGHT = height;

// for onError react queries and mutations
export function showError(error: AxiosError) {
  console.log(JSON.stringify(error?.response?.data));
  const description = extractError(error?.response?.data).trimEnd();

  showMessage({
    message: 'Error',
    description,
    type: 'danger',
    duration: 4000,
    icon: 'danger',
  });
}

export function showErrorMessage(message: string = 'Something went wrong ') {
  showMessage({
    message,
    type: 'danger',
    duration: 4000,
  });
}

export function extractError(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }
  if (Array.isArray(data)) {
    const messages = data.map((item) => {
      return `  ${extractError(item)}`;
    });

    return `${messages.join('')}`;
  }

  if (typeof data === 'object' && data !== null) {
    const messages = Object.entries(data).map((item) => {
      const [key, value] = item;
      const separator = Array.isArray(value) ? ':\n ' : ': ';

      return `- ${key}${separator}${extractError(value)} \n `;
    });
    return `${messages.join('')} `;
  }
  return 'Something went wrong ';
}

```

### Core Architecture Module: `src/lib/api/utils.tsx`
```
import type {
  GetNextPageParamFunction,
  GetPreviousPageParamFunction,
} from '@tanstack/react-query';

export type PaginateQuery<T> = {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
};

type KeyParams = {
  [key: string]: any;
};
export const DEFAULT_LIMIT = 10;

export function getQueryKey<T extends KeyParams>(key: string, params?: T) {
  return [key, ...(params ? [params] : [])];
}

// for infinite query pages  to flatList data
export function normalizePages<T>(pages?: PaginateQuery<T>[]): T[] {
  return pages
    ? pages.reduce((prev: T[], current) => [...prev, ...current.results], [])
    : [];
}

// a function that accept a url and return params as an object
export function getUrlParameters(
  url: string | null,
): { [k: string]: string } | null {
  if (url === null) {
    return null;
  }
  const regex = /[?&]([^=#]+)=([^&#]*)/g;
  const params = {};
  let match;
  while ((match = regex.exec(url))) {
    if (match[1] !== null) {
      // @ts-expect-error - Dynamic key assignment
      params[match[1]] = match[2];
    }
  }
  return params;
}

export const getPreviousPageParam: GetNextPageParamFunction<
  unknown,
  PaginateQuery<unknown>
> = page => getUrlParameters(page.previous)?.offset ?? null;

export const getNextPageParam: GetPreviousPageParamFunction<
  unknown,
  PaginateQuery<unknown>
> = page => getUrlParameters(page.next)?.offset ?? null;

```

### Core Architecture Module: `src/lib/auth/utils.tsx`
```
import { getItem, removeItem, setItem } from '@/lib/storage';

const TOKEN = 'token';

export type TokenType = {
  access: string;
  refresh: string;
};

export const getToken = () => getItem<TokenType>(TOKEN);
export const removeToken = () => removeItem(TOKEN);
export const setToken = (value: TokenType) => setItem<TokenType>(TOKEN, value);

```

### Core Architecture Module: `src/lib/hooks/index.tsx`
```
/* eslint-disable react-refresh/only-export-components */
export * from './use-is-first-time';
export * from './use-selected-theme';

```

### Core Architecture Module: `src/lib/hooks/use-is-first-time.tsx`
```
import { useMMKVBoolean } from 'react-native-mmkv';

import { storage } from '../storage';

const IS_FIRST_TIME = 'IS_FIRST_TIME';

export function useIsFirstTime() {
  const [isFirstTime, setIsFirstTime] = useMMKVBoolean(IS_FIRST_TIME, storage);
  if (isFirstTime === undefined) {
    return [true, setIsFirstTime] as const;
  }
  return [isFirstTime, setIsFirstTime] as const;
}

```

### Core Architecture Module: `src/lib/hooks/use-selected-theme.tsx`
```
import * as React from 'react';
import { useMMKVString } from 'react-native-mmkv';
import { Uniwind, useUniwind } from 'uniwind';

import { storage } from '../storage';

const SELECTED_THEME = 'SELECTED_THEME';
export type ColorSchemeType = 'light' | 'dark' | 'system';
/**
 * this hooks should only be used while selecting the theme
 * This hooks will return the selected theme which is stored in MMKV
 * selectedTheme should be one of the following values 'light', 'dark' or 'system'
 * don't use this hooks if you want to use it to style your component based on the theme use useUniwind from uniwind instead
 *
 */
export function useSelectedTheme() {
  const { theme: _theme } = useUniwind();
  const [theme, _setTheme] = useMMKVString(SELECTED_THEME, storage);

  const setSelectedTheme = React.useCallback(
    (t: ColorSchemeType) => {
      Uniwind.setTheme(t);
      _setTheme(t);
    },
    [_setTheme],
  );

  const selectedTheme = (theme ?? 'system') as ColorSchemeType;
  return { selectedTheme, setSelectedTheme } as const;
}
// to be used in the root file to load the selected theme from MMKV
export function loadSelectedTheme() {
  const theme = storage.getString(SELECTED_THEME);
  if (theme !== undefined) {
    console.log('theme', theme);
    Uniwind.setTheme(theme as ColorSchemeType);
  }
}

```

### Core Architecture Module: `src/lib/i18n/utils.tsx`
```
import type TranslateOptions from 'i18next';
import type { Language, resources } from './resources';
import type { RecursiveKeyOf } from './types';
import i18n from 'i18next';
import memoize from 'lodash.memoize';
import { useCallback } from 'react';
import { I18nManager, NativeModules, Platform } from 'react-native';

import { useMMKVString } from 'react-native-mmkv';
import RNRestart from 'react-native-restart';
import { storage } from '../storage';

type DefaultLocale = typeof resources.en.translation;
export type TxKeyPath = RecursiveKeyOf<DefaultLocale>;

export const LOCAL = 'local';

export const getLanguage = () => storage.getString(LOCAL); // 'Marc' getItem<Language | undefined>(LOCAL);

export const translate = memoize(
  (key: TxKeyPath, options = undefined) =>
    i18n.t(key, options) as unknown as string,
  (key: TxKeyPath, options: typeof TranslateOptions) =>
    options ? key + JSON.stringify(options) : key,
);

export function changeLanguage(lang: Language) {
  i18n.changeLanguage(lang);
  if (lang === 'ar') {
    I18nManager.forceRTL(true);
  }
  else {
    I18nManager.forceRTL(false);
  }
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    if (__DEV__)
      NativeModules.DevSettings.reload();
    else RNRestart.restart();
  }
  else if (Platform.OS === 'web') {
    window.location.reload();
  }
}

export function useSelectedLanguage() {
  const [language, setLang] = useMMKVString(LOCAL);

  const setLanguage = useCallback(
    (lang: Language) => {
      setLang(lang);
      if (lang !== undefined)
        changeLanguage(lang as Language);
    },
    [setLang],
  );

  return { language: language as Language, setLanguage };
}

```

### Core Architecture Module: `src/lib/utils.ts`
```
import type { StoreApi, UseBoundStore } from 'zustand';
import { Linking } from 'react-native';

export function openLinkInBrowser(url: string) {
  Linking.canOpenURL(url).then(canOpen => canOpen && Linking.openURL(url));
}

type WithSelectors<S> = S extends { getState: () => infer T }
  ? S & { use: { [K in keyof T]: () => T[K] } }
  : never;

export function createSelectors<S extends UseBoundStore<StoreApi<object>>>(_store: S) {
  const store = _store as WithSelectors<typeof _store>;
  store.use = {};
  for (const k of Object.keys(store.getState())) {
    (store.use as any)[k] = () => store(s => s[k as keyof typeof s]);
  }

  return store;
}

```

### Core Architecture Module: `__mocks__/@gorhom/bottom-sheet.ts`
```
module.exports = require('@gorhom/bottom-sheet/mock');

```

### Core Architecture Module: `__mocks__/expo-localization.ts`
```
export const locale = 'en-US';
export const locales = ['en-US'];
export const timezone = 'UTC';
export const isRTL = false;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #127** (2023-02-23): **Eslint issue with github action **
  *Symptoms*: # Summary:  We are using [this plugin ](https://github.com/jamesacarr/eslint-formatter-github-actions) to add annotations  on  Github for Pr for better experience. but look like the plugin start throwing errors recently.    Already opened an issue [here ](https://github.com/jamesacarr/eslint-formatter-github-actions/issues/18). asking for recommendation but we are open for alternatives  probably [reviewdog/action-eslint](https://github.com/reviewdog/action-eslint)    

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

### Incident Patch 1: `fd9b358e` (2026-06-02)
**Commit Message**: Merge pull request #531 from obytes/codex/fix-splash-screen-hide

fix: hide splash screen from root layout

**File**: `src/app/(app)/_layout.tsx` (modified, +1/-13)
```diff
@@ -1,6 +1,5 @@
-import { Link, Redirect, SplashScreen, Tabs } from 'expo-router';
+import { Link, Redirect, Tabs } from 'expo-router';
 import * as React from 'react';
-import { useCallback, useEffect } from 'react';
 
 import { Pressable, Text } from '@/components/ui';
 import {
@@ -14,17 +13,6 @@ import { useIsFirstTime } from '@/lib/hooks/use-is-first-time';
 export default function TabLayout() {
   const status = useAuth.use.status();
   const [isFirstTime] = useIsFirstTime();
-  const hideSplash = useCallback(async () => {
-    await SplashScreen.hideAsync();
-  }, []);
-  useEffect(() => {
-    if (status !== 'idle') {
-      const timer = setTimeout(() => {
-        hideSplash();
-      }, 1000);
-      return () => clearTimeout(timer);
-    }
-  }, [hideSplash, status]);
 
   if (isFirstTime) {
     return <Redirect href="/onboarding" />;
```

**File**: `src/app/_layout.tsx` (modified, +21/-2)
```diff
@@ -1,3 +1,4 @@
+import type { ViewProps } from 'react-native';
 import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
 
 import { ThemeProvider } from '@react-navigation/native';
@@ -34,8 +35,19 @@ SplashScreen.setOptions({
 });
 
 export default function RootLayout() {
+  const hasHiddenSplash = React.useRef(false);
+
+  const onLayoutRootView = React.useCallback(() => {
+    if (hasHiddenSplash.current) {
+      return;
+    }
+
+    hasHiddenSplash.current = true;
+    SplashScreen.hide();
+  }, []);
+
   return (
-    <Providers>
+    <Providers onLayout={onLayoutRootView}>
       <Stack>
         <Stack.Screen name="(app)" options={{ headerShown: false }} />
         <Stack.Screen name="onboarding" options={{ headerShown: false }} />
@@ -45,10 +57,17 @@ export default function RootLayout() {
   );
 }
 
-function Providers({ children }: { children: React.ReactNode }) {
+function Providers({
+  children,
+  onLayout,
+}: {
+  children: React.ReactNode;
+  onLayout: ViewProps['onLayout'];
+}) {
   const theme = useThemeConfig();
   return (
     <GestureHandlerRootView
+      onLayout={onLayout}
       style={styles.container}
       // eslint-disable-next-line better-tailwindcss/no-unknown-classes
       className={theme.dark ? `dark` : undefined}
```

---

### Incident Patch 2: `8f6b7394` (2026-06-02)
**Commit Message**: fix: hide splash screen from root layout

**File**: `src/app/(app)/_layout.tsx` (modified, +1/-13)
```diff
@@ -1,6 +1,5 @@
-import { Link, Redirect, SplashScreen, Tabs } from 'expo-router';
+import { Link, Redirect, Tabs } from 'expo-router';
 import * as React from 'react';
-import { useCallback, useEffect } from 'react';
 
 import { Pressable, Text } from '@/components/ui';
 import {
@@ -14,17 +13,6 @@ import { useIsFirstTime } from '@/lib/hooks/use-is-first-time';
 export default function TabLayout() {
   const status = useAuth.use.status();
   const [isFirstTime] = useIsFirstTime();
-  const hideSplash = useCallback(async () => {
-    await SplashScreen.hideAsync();
-  }, []);
-  useEffect(() => {
-    if (status !== 'idle') {
-      const timer = setTimeout(() => {
-        hideSplash();
-      }, 1000);
-      return () => clearTimeout(timer);
-    }
-  }, [hideSplash, status]);
 
   if (isFirstTime) {
     return <Redirect href="/onboarding" />;
```

**File**: `src/app/_layout.tsx` (modified, +21/-2)
```diff
@@ -1,3 +1,4 @@
+import type { ViewProps } from 'react-native';
 import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
 
 import { ThemeProvider } from '@react-navigation/native';
@@ -34,8 +35,19 @@ SplashScreen.setOptions({
 });
 
 export default function RootLayout() {
+  const hasHiddenSplash = React.useRef(false);
+
+  const onLayoutRootView = React.useCallback(() => {
+    if (hasHiddenSplash.current) {
+      return;
+    }
+
+    hasHiddenSplash.current = true;
+    SplashScreen.hide();
+  }, []);
+
   return (
-    <Providers>
+    <Providers onLayout={onLayoutRootView}>
       <Stack>
         <Stack.Screen name="(app)" options={{ headerShown: false }} />
         <Stack.Screen name="onboarding" options={{ headerShown: false }} />
@@ -45,10 +57,17 @@ export default function RootLayout() {
   );
 }
 
-function Providers({ children }: { children: React.ReactNode }) {
+function Providers({
+  children,
+  onLayout,
+}: {
+  children: React.ReactNode;
+  onLayout: ViewProps['onLayout'];
+}) {
   const theme = useThemeConfig();
   return (
     <GestureHandlerRootView
+      onLayout={onLayout}
       style={styles.container}
       // eslint-disable-next-line better-tailwindcss/no-unknown-classes
       className={theme.dark ? `dark` : undefined}
```

---

### Incident Patch 3: `98991ed9` (2026-02-24)
**Commit Message**: fix(docs): Update UniWind link to the correct repository (#513)

**File**: `docs/src/content/docs/overview.md` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ We value the feedback and contributions of our users, and we encourage you to le
 
 - [Expo](https://docs.expo.io/)
 - [Expo Router](https://docs.expo.dev/router/introduction/)
-- [Uniwind](https://github.com/huozhi/uniwind)
+- [Uniwind](https://github.com/uni-stack/uniwind)
 - [Flash list](https://github.com/Shopify/flash-list)
 - [React Query](https://tanstack.com/query/v4)
 - [Axios](https://axios-http.com/docs/intro)
```

---

### Incident Patch 4: `a2734c6b` (2026-01-28)
**Commit Message**: fix: fix github action

**File**: `.github/actions/eas-build/action.yml` (modified, +1/-8)
```diff
@@ -13,9 +13,6 @@
 #        `ANDROID`, true by default, set to true if you don't want to trigger build for Android.
 #        `IOS`, false by default, set to true if you  want to trigger build for IOS.
 
-# Before triggering the build, we run a pre-build script to generate the necessary native folders based on the APP_ENV.
-# Based on the ANDROID and IOS inputs, we trigger the build for the corresponding platform with the corresponding flags.
-
 # 👀 Example usage:
 #      - name: ⏱️ EAS Build
 #        uses: ./.github/actions/eas-build
@@ -29,7 +26,7 @@ name: 'Setup EAS Build + Trigger Build'
 description: 'Setup EAS Build + Trigger Build'
 inputs:
   APP_ENV:
-    description: 'APP_ENV (one of): development, staging, production'
+    description: 'APP_ENV (one of): development, preview, production'
     required: true
     default: staging
   AUTO_SUBMIT: # # TODO: we need to handle this too
@@ -70,10 +67,6 @@ runs:
         eas-version: latest
         token: ${{ inputs.EXPO_TOKEN }}
 
-    - name: ⚙️ Run Prebuild
-      run: pnpm prebuild:${{ inputs.APP_ENV }}
-      shell: bash
-
     - name: 📱 Run Android Build
       if: ${{ inputs.ANDROID == 'true' }}
       run: pnpm build:${{ inputs.APP_ENV }}:android --non-interactive  --no-wait --message "Build  ${{ inputs.APP_ENV }} ${{ inputs.VERSION }}"
```

**File**: `.github/workflows/eas-build-preview.yml` (renamed, +1/-1)
```diff
@@ -40,7 +40,7 @@ jobs:
       - name: ⏱️ EAS Build
         uses: ./.github/actions/eas-build
         with:
-          APP_ENV: staging
+          APP_ENV: preview
           EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
           VERSION: ${{ github.event.release.tag_name }}
           IOS: false # TODO: set as true when IOS account is ready
```

**File**: `cli/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "create-obytes-app",
-  "version": "1.7.1",
+  "version": "1.8.0",
   "description": "Obytes expo starter cli",
   "homepage": "https://github.com/obytes/react-native-template-obytes",
   "repository": {
```

---

### Incident Patch 5: `c893cb71` (2026-01-28)
**Commit Message**: fix: correct env file reference from env.js to env.ts

The install script was trying to read env.js, but the actual file
in the project is env.ts, causing ENOENT during dependency installation.
This change updates the reference to the correct file.

**File**: `cli/setup-project.js` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ const updatePackageInfos = async (projectName) => {
 };
 
 const updateProjectConfig = async (projectName) => {
-  const configPath = path.join(process.cwd(), `${projectName}/env.js`);
+  const configPath = path.join(process.cwd(), `${projectName}/env.ts`);
   const contents = fs.readFileSync(configPath, {
     encoding: 'utf-8',
   });
```

---

### Incident Patch 6: `f21f48af` (2026-01-27)
**Commit Message**: fix: fix expo doctor

**File**: `metro.config.js` (modified, +0/-2)
```diff
@@ -1,5 +1,3 @@
-/* eslint-env node */
-
 const { getDefaultConfig } = require('expo/metro-config');
 const { withUniwindConfig } = require('uniwind/metro');
 
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@
     "@tanstack/zod-form-adapter": "^0.42.1",
     "app-icon-badge": "^0.1.2",
     "axios": "^1.13.2",
-    "expo": "~54.0.31",
+    "expo": "~54.0.32",
     "expo-constants": "~18.0.13",
     "expo-crypto": "^15.0.8",
     "expo-dev-client": "~6.0.20",
```

**File**: `pnpm-lock.yaml` (modified, +100/-100)
```diff
@@ -13,7 +13,7 @@ importers:
         version: 0.4.2
       '@expo/metro-runtime':
         specifier: ^6.1.2
-        version: 6.1.2(expo@54.0.31)(react-dom@19.1.0(react@19.1.0))(react-native@0.81.5(@babel/core@7.28.6)(@types/react@19.1.17)(react@19.1.0))(react@19.1.0)
+        version: 6.1.2(expo@54.0.32)(react-dom@19.1.0(react@19.1.0))(react-native@0.81.5(@babel/core@7.28.6)(@types/react@19.1.17)(react@19.1.0))(react@19.1.0)
       '@gorhom/bottom-sheet':
         specifier: ^5.2.8
         version: 5.2.8(@types/react@19.1.17)(react-native-gesture-handler@2.28.0(react-native@0.81.5(@babel/core@7.28.6)(@types/react@19.1.17)(react@19.1.0))(react@19.1.0))(react-native-reanimated@4.1.6(@babel/core@7.28.6)(react-native-worklets@0.7.2(@babel/core@7.28.6)(react-native@0.81.5(@babel/core@7.28.6)(@types/react@19.1.17)(react@19.1.0))(react@19.1.0))(react-native@0.81.5(@babel/core@7.28.6)(@types/react@19.1.17)(react@19.1.0))(react@19.1.0))(react-native@0.81.5(@babel/core@7.28.6)(@types/react@19.1.17)(react@19.1.0))(react@19.1.0)
@@ -36,41 +36,41 @@ importers:
         specifier: ^1.13.2
         version: 1.13.2
       expo:
-        specifier: ~54.0.31
-        version: 54.0.31(@babel/core@7.28.6)(@expo/metro-runtime@6.1.2)(expo-router@6.0.22)(react-native@0.81.5(@babel/core@7.28.6)(@types/react@19.1.17)(react@19.1.0))(react@19.1.0)
+        specifier: ~54.0.32
+        version: 54.0.32(@babel/core@7.28.6)(@expo/metro-runtime@6.1.2)(expo-router@6.0.22)(react-native@0.81.5(@babel/core@7.28.6)(@types/react@19.1.17)(react@19.1.0))(react@19.1.0)
       expo-constants:
         specifier: ~18.0.13
-        version: 18.0.13(expo@54.0.31)(react-native@0.81.5(@babel/core@7.28.6)(@types/react@19.1.17)(react@19.1.0))
+        version: 18.0.13(expo@54.0.32)(react-native@0.81.5(@babel/core@7.28.6)(@types/react@19.1.17)(react@19.1.0))
       expo-crypto:
         specifier: ^15.0.8
-        version: 15.0.8(expo@54.0.31)
+        version: 15.0.8(expo@54.0.32)
       expo-dev-client:
         specifier: ~6.0.20
-        version: 6.0.20(expo@54.0.31)
+        version: 6.0.20(expo@54.0.32)
       expo-font:
         specifier: ~14.0.11
-        version: 14.0.11(expo@54.0.31)(react-native@0.81.5(@babel/core@7.28.6)(@types/react@19.1.17)(react@19.1.0))(react@19.1.0)
+        version: 14.0.11(expo@54.0.32)(react-native@0.81.5(@babel/core@7.28.6)(@types/react@19.1.17)(react@19.1.0))(react@19.1.0)
       expo-image:
         specifier: ~3.0.11
-        version: 3.0.11(expo@54.0.31)(react-native-web@0.21.2(react-dom@19.1.0(react@19.1.0))(react@19.1.0))(react-native@0.81.5(@babel/core@7.28.6)(@types/react@19.1.17)(react@19.1.0))(react@19.1.0)
+        version: 3.0.11(expo@54.0.32)(react-native-web@0.21.2(react-dom@19.1.0(react@19.1.0))(react@19.1.0))(react-native@0.81.5(@babel/core@7.28.6)(@types/react@19.1.17)(react@19.1.0))(react@19.1.0)
       expo-linking:
         specifier: ~8.0.11
-        version: 8.0.11(expo@54.0.31)(react-native@0.81.5(@babel/core@7.28.6)(@types/react@19.1.17)(react@19.1.0))(react@19.1.0)
+        version: 8.0.11(expo@54.0.32)(react-native@0.81.5(@babel/core@7.28.6)(@types/react@19.1.17)(react@19.1.0))(react@19.1.0)
       expo-localization:
         specifier: ~17.0.8
-        version: 17.0.8(expo@54.0.31)(react@19.1.0)
+        version: 17.0.8(expo@54.0.32)(react@19.1.0)
       expo-router:
         specifier: ~6.0.22
-        version: 6.0.22(7685cb546f9fca472a3d751aa95b1069)
+        version: 6.0.22(4a6017a91b786242661fffb6a6a94848)
       expo-splash-screen:
         specifier: ~31.0.13
-        version: 31.0.13(expo@54.0.31)
+        version: 31.0.13(expo@54.0.32)
       expo-status-bar:
         specifier: ~3.0.9
         version: 3.0.9(react-native@0.81.5(@babel/core@7.28.6)(@types/react@19.1.17)(react@19.1.0))(react@19.1.0)
       expo-system-ui:
         specifier: ~6.0.9
-        version: 6.0.9(expo@54.0.31)(react-native-web@0.21.2(react-dom@19.1.0(react@19.1.0))(react@19.1.0))(react-native@0.81.5(@babel/core@7.28.6)(@types/react@19.1.17)(react@19.1.0))
+        version: 6.0.9(expo@54.0.32)(react-native-web@0.21.2(react-dom@19.1.0(react@19.1.0))(react@19.1.0))(react-native@0.81.5(@babel/core@7.28.6)(@types/react@19.1.17)(react@19.1.0))
       i18next:
         specifier: ^25.8.0
         version: 25.8.0(typescript@5.9.3)
@@ -170,7 +170,7 @@ importers:
         version: 20.3.1
       '@dev-plugins/react-query':
         specifier: ^0.4.0
-        version: 0.4.0(@tanstack/react-query@5.90.19(react@19.1.0))(expo@54.0.31)(react@19.1.0)
+        version: 0.4.0(@tanstack/react-query@5.90.19(react@19.1.0))(expo@54.0.32)(react@19.1.0)
       '@eslint-react/eslint-plugin':
         specifier: ^2.7.2
         version: 2.7.2(eslint@9.39.2(jiti@2.6.1))(typescript@5.9.3)
@@ -245,7 +245,7 @@ importers:
         version: 29.7.0(@types/node@25.0.9)
       jest-expo:
         specifier: ~54.0.16
-        version: 54.0.16(@babel/core@7.28.6)(expo@54.0.31)(jest@29.7.0(@types/node@25.0.9))(react-native@0.81.5(@babel/core@
```

**File**: `tsconfig.json` (modified, +2/-1)
```diff
@@ -15,7 +15,8 @@
     "**/*.tsx",
     ".expo/types/**/*.ts",
     "expo-env.d.ts",
-    "nativewind-env.d.ts"
+    "nativewind-env.d.ts",
+    "env.ts"
   ],
   "exclude": [
     "node_modules",
```

---

### Incident Patch 7: `6c9a0256` (2026-01-27)
**Commit Message**: fix: fix warnings

**File**: `app.config.ts` (modified, +5/-1)
```diff
@@ -1,9 +1,13 @@
 import type { ConfigContext, ExpoConfig } from '@expo/config';
+
 import type { AppIconBadgeConfig } from 'app-icon-badge/types';
-import Env from './env';
 
 import 'tsx/cjs';
 
+// adding lint exception as we need to import tsx/cjs before env.ts is imported
+// eslint-disable-next-line perfectionist/sort-imports
+import Env from './env';
+
 const EXPO_ACCOUNT_OWNER = 'obytes';
 const EAS_PROJECT_ID = 'c3e1075b-6fe7-4686-aa49-35b46a229044';
 
```

**File**: `env.ts` (modified, +0/-2)
```diff
@@ -1,5 +1,3 @@
-/* eslint-env node */
-
 import z from 'zod';
 
 import packageJSON from './package.json';
```

**File**: `src/app/(app)/_layout.tsx` (modified, +2/-1)
```diff
@@ -19,9 +19,10 @@ export default function TabLayout() {
   }, []);
   useEffect(() => {
     if (status !== 'idle') {
-      setTimeout(() => {
+      const timer = setTimeout(() => {
         hideSplash();
       }, 1000);
+      return () => clearTimeout(timer);
     }
   }, [hideSplash, status]);
 
```

**File**: `src/app/+html.tsx` (modified, +1/-0)
```diff
@@ -27,6 +27,7 @@ export default function Root({ children }: { children: React.ReactNode }) {
         <ScrollViewStyleReset />
 
         {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
+        {/* eslint-disable-next-line react-dom/no-dangerously-set-innerhtml */}
         <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
         {/* Add any additional <head> elements that you want globally available on web... */}
       </head>
```

**File**: `src/app/_layout.tsx` (modified, +2/-0)
```diff
@@ -18,6 +18,7 @@ import '../global.css';
 
 export { ErrorBoundary } from 'expo-router';
 
+// eslint-disable-next-line react-refresh/only-export-components
 export const unstable_settings = {
   initialRouteName: '(app)',
 };
@@ -49,6 +50,7 @@ function Providers({ children }: { children: React.ReactNode }) {
   return (
     <GestureHandlerRootView
       style={styles.container}
+      // eslint-disable-next-line better-tailwindcss/no-unknown-classes
       className={theme.dark ? `dark` : undefined}
     >
       <KeyboardProvider>
```

**File**: `src/components/ui/button.test.tsx` (modified, +0/-1)
```diff
@@ -1,4 +1,3 @@
-/* eslint-disable max-lines-per-function */
 import * as React from 'react';
 import { Text } from 'react-native';
 
```

**File**: `src/components/ui/button.tsx` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
+/* eslint-disable better-tailwindcss/no-unknown-classes */
 import type { PressableProps, View } from 'react-native';
 import type { VariantProps } from 'tailwind-variants';
 import * as React from 'react';
```

**File**: `src/components/ui/icons/index.tsx` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
+/* eslint-disable react-refresh/only-export-components */
 export * from './arrow-right';
 export * from './caret-down';
 export * from './feed';
```

---

### Incident Patch 8: `653f9e8b` (2026-01-27)
**Commit Message**: feat: add project documentation and development workflow guidelines

**File**: `claude.md` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+> This project was generated from the [Obytes React Native Template](https://github.com/obytes/react-native-template-obytes), a production-ready React Native starter with modern tooling and best practices.
+
+## What: Technology Stack
+
+- **Expo SDK 54** with React Native 0.81.5 - Managed React Native development
+- **TypeScript** - Strict type safety throughout
+- **Expo Router 6** - File-based routing (like Next.js)
+- **TailwindCSS** via Uniwind/Nativewind - Utility-first styling for React Native
+- **Zustand** - Lightweight global state management
+- **React Query** - Server state and data fetching
+- **TanStack Form + Zod** - Type-safe form handling and validation
+- **MMKV** - Encrypted local storage
+- **Jest + React Testing Library** - Unit testing
+
+## What: Project Structure
+
+```
+src/
+├── app/              # Expo Router file-based routes (add new routes here)
+├── features/         # Feature modules - auth, feed, settings are EXAMPLES
+├── components/ui/    # Pre-built UI components (button, input, modal, etc.)
+├── lib/              # Pre-configured utilities (api, auth, i18n, storage)
+├── translations/     # i18n files (en.json, ar.json - add more languages)
+└── global.css        # TailwindCSS configuration
+
+Root Files:
+├── env.ts           # Environment config (CUSTOMIZE bundle IDs, API URLs)
+├── app.config.ts    # Expo configuration
+└── README.md        # Project-specific documentation
+```
+
+## How: Development Workflow
+
+**Essential Commands:**
+```bash
+pnpm start              # Start dev server
+pnpm ios/android        # Run on platform
+pnpm lint               # ESLint check
+pnpm type-check         # TypeScript validation
+pnpm test               # Run Jest tests
+pnpm check-all          # All quality checks
+```
+
+**Environment-Specific:**
+```bash
+pnpm start:preview              # Preview environment
+pnpm ios:production             # Production iOS
+pnpm build:production:ios       # EAS production build
+```
+
+## How: Key Patterns
+
+- **Create features**: New folder in `src/features/[your-feature]/` with screens, components, API hooks
+- **Add routes**: Create files in `src/app/` (file-based routing)
+- **Forms**: Use TanStack Form + Zod (see `src/features/auth/components/login-form.tsx`)
+- **Data fetching**: Use React Query (see `src/features/feed/api.ts`)
+- **Global state**: Use Zustand (see `src/features/auth/use-auth-store.tsx`)
+- **Styling**: NativeWind/Tailwind classes (see `src/components/ui/button.tsx`)
+- **Storage**: Use MMKV via `src/lib/storage.tsx` for sensitive data
+- **Imports**: Always use `@/` prefix, never relative imports
+
+## How: Essential Rules
+
+- ✅ **DO** use absolute imports: `@/components/ui/button`
+- ✅ **DO** follow feature-based structure: `src/features/[name]/`
+- ✅ **DO** use TanStack Form for forms (not react-hook-form)
+- ✅ **DO** use MMKV storage for sensitive data (not AsyncStorage)
+- ✅ **DO** use EAS Build for production: `pnpm build:production:ios`
+- ✅ **DO** prefix env vars with `EXPO_PUBLIC_*` for app access
+- ❌ **DO NOT** modify `android/` or `ios/` directly (use Expo config plugins)
```

---

### Incident Patch 9: `829da2f8` (2026-01-21)
**Commit Message**: refactor: update storage implementation to use createMMKV and fix method names

**File**: `.gitignore` (modified, +2/-0)
```diff
@@ -13,6 +13,8 @@ yarn-error.log
 /coverage
 # macOS
 .DS_Store
+/ios
+/android
 
 # @generated expo-cli sync-2b81b286409207a5da26e14c78851eb30d8ccbdb
 # The following patterns were generated by expo-cli
```

**File**: `package.json` (modified, +71/-67)
```diff
@@ -47,90 +47,93 @@
     "e2e-test": "maestro test .maestro/ -e APP_ID=com.obytes.development"
   },
   "dependencies": {
-    "@expo/metro-runtime": "^5.0.4",
-    "@gorhom/bottom-sheet": "^5.0.5",
-    "@hookform/resolvers": "^3.9.0",
-    "@shopify/flash-list": "1.7.6",
-    "@tanstack/react-query": "^5.52.1",
+    "@expo/metro-runtime": "^6.1.2",
+    "@gorhom/bottom-sheet": "^5.2.8",
+    "@hookform/resolvers": "^5.2.2",
+    "@shopify/flash-list": "2.0.2",
+    "@tanstack/react-query": "^5.90.19",
     "app-icon-badge": "^0.1.2",
-    "axios": "^1.7.5",
-    "expo": "~53.0.12",
-    "expo-constants": "~17.1.6",
-    "expo-crypto": "^14.1.5",
-    "expo-dev-client": "~5.2.1",
-    "expo-font": "~13.3.1",
-    "expo-image": "~2.3.0",
-    "expo-linking": "~7.1.5",
-    "expo-localization": "~16.1.5",
-    "expo-router": "~5.1.0",
-    "expo-splash-screen": "~0.30.9",
-    "expo-status-bar": "~2.2.3",
-    "expo-system-ui": "~5.0.9",
-    "i18next": "^23.14.0",
+    "axios": "^1.13.2",
+    "expo": "~54.0.31",
+    "expo-constants": "~18.0.13",
+    "expo-crypto": "^15.0.8",
+    "expo-dev-client": "~6.0.20",
+    "expo-font": "~14.0.11",
+    "expo-image": "~3.0.11",
+    "expo-linking": "~8.0.11",
+    "expo-localization": "~17.0.8",
+    "expo-router": "~6.0.22",
+    "expo-splash-screen": "~31.0.13",
+    "expo-status-bar": "~3.0.9",
+    "expo-system-ui": "~6.0.9",
+    "i18next": "^25.8.0",
     "lodash.memoize": "^4.1.2",
-    "moti": "^0.29.0",
-    "nativewind": "^4.1.21",
-    "react": "19.0.0",
-    "react-dom": "19.0.0",
-    "react-error-boundary": "^4.0.13",
-    "react-hook-form": "^7.53.0",
-    "react-i18next": "^15.0.1",
-    "react-native": "0.79.4",
-    "react-native-edge-to-edge": "^1.6.0",
+    "moti": "^0.30.0",
+    "nativewind": "^4.2.1",
+    "react": "19.1.0",
+    "react-dom": "19.1.0",
+    "react-error-boundary": "^6.1.0",
+    "react-hook-form": "^7.71.1",
+    "react-i18next": "^16.5.3",
+    "react-native": "0.81.5",
+    "react-native-edge-to-edge": "^1.7.0",
     "react-native-flash-message": "^0.4.2",
-    "react-native-gesture-handler": "~2.24.0",
-    "react-native-keyboard-controller": "^1.17.4",
-    "react-native-mmkv": "~3.1.0",
-    "react-native-reanimated": "~3.17.5",
+    "react-native-gesture-handler": "~2.28.0",
+    "react-native-keyboard-controller": "^1.18.5",
+    "react-native-mmkv": "~4.1.1",
+    "react-native-nitro-modules": "^0.33.2",
+    "react-native-reanimated": "~4.1.6",
     "react-native-restart": "0.0.27",
-    "react-native-safe-area-context": "5.4.0",
-    "react-native-screens": "^4.11.1",
-    "react-native-svg": "~15.11.2",
-    "react-native-url-polyfill": "^2.0.0",
-    "react-native-web": "~0.20.0",
-    "react-query-kit": "^3.3.0",
-    "tailwind-variants": "^0.2.1",
-    "zod": "^3.23.8",
-    "zustand": "^5.0.5"
+    "react-native-safe-area-context": "5.6.2",
+    "react-native-screens": "^4.16.0",
+    "react-native-svg": "~15.12.1",
+    "react-native-url-polyfill": "^3.0.0",
+    "react-native-web": "~0.21.2",
+    "react-native-worklets": "^0.7.2",
+    "react-query-kit": "^3.3.2",
+    "tailwind-merge": "^3.4.0",
+    "tailwind-variants": "^3.2.2",
+    "zod": "^4.3.5",
+    "zustand": "^5.0.10"
   },
   "devDependencies": {
     "@antfu/eslint-config": "^7.2.0",
-    "@babel/core": "^7.26.0",
-    "@commitlint/cli": "^19.2.2",
-    "@commitlint/config-conventional": "^19.2.2",
-    "@dev-plugins/react-query": "^0.0.7",
+    "@babel/core": "^7.28.6",
+    "@commitlint/cli": "^20.3.1",
+    "@commitlint/config-conventional": "^20.3.1",
+    "@dev-plugins/react-query": "^0.4.0",
     "@eslint-react/eslint-plugin": "^2.7.2",
-    "@expo/config": "~11.0.10",
-    "@testing-library/jest-dom": "^6.5.0",
-    "@testing-library/react-native": "^12.7.2",
-    "@types/i18n-js": "^3.8.9",
+    "@expo/config": "~12.0.13",
+    "@testing-library/jest-dom": "^6.9.1",
+    "@testing-library/react-native": "^13.3.3",
+    "@types/i18n-js": "^4.0.1",
     "@types/invariant": "^2.2.37",
-    "@types/jest": "^29.5.12",
+    "@types/jest": "^29.5.14",
     "@types/lodash.memoize": "^4.1.9",
-    "@types/react": "~19.0.14",
+    "@types/react": "~19.1.17",
     "babel-plugin-module-resolver": "^5.0.2",
-    "cross-env": "^7.0.3",
-    "dotenv": "^16.4.5",
+    "cross-env": "^10.1.0",
+    "dotenv": "^17.2.3",
     "eslint": "^9.39.2",
-    "eslint-import-resolver-typescript": "^4.4.3",
+    "eslint-import-resolver-typescript": "^4.4.4",
     "eslint-plugin-i18n-json": "^4.0.1",
-    "eslint-plugin-import": "^2.31.0",
+    "eslint-plugin-import": "^2.32.0",
     "eslint-plugin-react-compiler": "19.1.0-rc.2",
     "eslint-plugin-react-hooks": "^7.0.1",
     "eslint-plugin-react-refresh": "^0.4.26",
-    "eslint-plugin-tailwindcss": "^3.18.0",
-    "eslint-plugin-testing-library": "^7.5.2",
-    "eslint-plugin-unicorn": "^59.0.1",
-    "husky": "^9.1.5",
+    "eslint-plugin-tailwindcss": "^3.18.2",
+    "eslint-plugin-testing-library": "^7.15.4",

```

**File**: `src/app/(app)/index.tsx` (modified, +0/-1)
```diff
@@ -28,7 +28,6 @@ export default function Feed() {
         renderItem={renderItem}
         keyExtractor={(_, index) => `item-${index}`}
         ListEmptyComponent={<EmptyList isLoading={isPending} />}
-        estimatedItemSize={300}
       />
     </View>
   );
```

**File**: `src/components/login-form.tsx` (modified, +2/-2)
```diff
@@ -11,12 +11,12 @@ const schema = z.object({
   name: z.string().optional(),
   email: z
     .string({
-      required_error: 'Email is required',
+      message: 'Email is required',
     })
     .email('Invalid email format'),
   password: z
     .string({
-      required_error: 'Password is required',
+      message: 'Password is required',
     })
     .min(6, 'Password must be at least 6 characters'),
 });
```

**File**: `src/lib/i18n/index.tsx` (modified, +3/-3)
```diff
@@ -1,4 +1,4 @@
-import { locale } from 'expo-localization';
+import { getLocales } from 'expo-localization';
 import i18n from 'i18next';
 import { initReactI18next } from 'react-i18next';
 import { I18nManager } from 'react-native';
@@ -10,9 +10,9 @@ export * from './utils';
 
 i18n.use(initReactI18next).init({
   resources,
-  lng: getLanguage() || locale, // TODO: if you are not supporting multiple languages or languages with multiple directions you can set the default value to `en`
+  lng: getLanguage() || getLocales()[0]?.languageTag, // TODO: if you are not supporting multiple languages or languages with multiple directions you can set the default value to `en`
   fallbackLng: 'en',
-  compatibilityJSON: 'v3', // By default React Native projects does not support Intl
+  compatibilityJSON: 'v4', // Updated to v4 for i18next compatibility
 
   // allows integrating dynamic values into translations.
   interpolation: {
```

**File**: `src/lib/storage.tsx` (modified, +3/-3)
```diff
@@ -1,6 +1,6 @@
-import { MMKV } from 'react-native-mmkv';
+import { createMMKV } from 'react-native-mmkv';
 
-export const storage = new MMKV();
+export const storage = createMMKV();
 
 export function getItem<T>(key: string): T | null {
   const value = storage.getString(key);
@@ -12,5 +12,5 @@ export async function setItem<T>(key: string, value: T) {
 }
 
 export async function removeItem(key: string) {
-  storage.delete(key);
+  storage.remove(key);
 }
```

---

### Incident Patch 10: `9cb16958` (2026-01-21)
**Commit Message**: fix: update ESLint configuration and improve type error handling in Jest setup
refactor: clean up imports and reformat component props in Card and Colors components

**File**: `eslint.config.mjs` (modified, +2/-1)
```diff
@@ -39,6 +39,7 @@ export default antfu(
       'docs/',
       'cli/',
       'expo-env.d.ts',
+      'migration/*',
     ],
   },
 
@@ -51,7 +52,7 @@ export default antfu(
       'react/no-inline-styles': 'off',
       'react/destructuring-assignment': 'off',
       'react/require-default-props': 'off',
-      'react-refresh/only-export-components': 'off', // Too strict for React Native
+      'react-refresh/only-export-components': 'warn', // Too strict for React Native
       'unicorn/filename-case': [
         'error',
         {
```

**File**: `jest-setup.ts` (modified, +5/-2)
```diff
@@ -1,7 +1,10 @@
+/* eslint-disable ts/ban-ts-comment */
+/* eslint-disable no-restricted-globals */
 import '@testing-library/react-native/extend-expect';
 
 // react-hook form setup for testing
-// @ts-ignore
+// @ts-expect-error
 global.window = {};
-// @ts-ignore
+
+// @ts-expect-error
 global.window = global;
```

**File**: `src/components/card.tsx` (modified, +3/-3)
```diff
@@ -1,11 +1,9 @@
 import type { Post } from '@/api';
-import { Link } from 'expo-router';
 
+import { Link } from 'expo-router';
 import * as React from 'react';
 import { Image, Pressable, Text, View } from '@/components/ui';
 
-type Props = Post;
-
 const images = [
   'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?auto=format&fit=crop&w=800&q=80',
   'https://images.unsplash.com/photo-1564507004663-b6dfb3c824d5?auto=format&fit=crop&w=800&q=80',
@@ -14,6 +12,8 @@ const images = [
   'https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?auto=format&fit=crop&w=800&q=80',
 ];
 
+type Props = Post;
+
 export function Card({ title, body, id }: Props) {
   return (
     <Link href={`/feed/${id}`} asChild>
```

**File**: `src/components/colors.tsx` (modified, +0/-1)
```diff
@@ -1,5 +1,4 @@
 import * as React from 'react';
-
 import { Text, View } from '@/components/ui';
 import colors from '@/components/ui/colors';
 
```

---

### Incident Patch 11: `ae94e508` (2025-06-27)
**Commit Message**: fix: fix status bar theme based on the selected colorScheme

**File**: `src/components/ui/focus-aware-status-bar.tsx` (modified, +6/-1)
```diff
@@ -11,5 +11,10 @@ export const FocusAwareStatusBar = ({ hidden = false }: Props) => {
 
   if (Platform.OS === 'web') return null;
 
-  return isFocused ? <SystemBars style={colorScheme} hidden={hidden} /> : null;
+  return isFocused ? (
+    <SystemBars
+      style={colorScheme === 'light' ? 'dark' : 'light'}
+      hidden={hidden}
+    />
+  ) : null;
 };
```

---

### Incident Patch 12: `4bdbde6d` (2025-06-25)
**Commit Message**: fix: bundle name in script

**File**: `package.json` (modified, +2/-2)
```diff
@@ -38,7 +38,7 @@
     "test:ci": "pnpm run test --coverage",
     "test:watch": "pnpm run test --watch",
     "install-maestro": "curl -Ls 'https://get.maestro.mobile.dev' | bash",
-    "e2e-test": "maestro test .maestro/ -e APP_ID=com.jestesjuz.development"
+    "e2e-test": "maestro test .maestro/ -e APP_ID=com.obytes.development"
   },
   "dependencies": {
     "@expo/metro-runtime": "^5.0.4",
@@ -48,6 +48,7 @@
     "@tanstack/react-query": "^5.52.1",
     "app-icon-badge": "^0.1.2",
     "axios": "^1.7.5",
+    "expo": "~53.0.12",
     "expo-constants": "~17.1.6",
     "expo-crypto": "^14.1.5",
     "expo-dev-client": "~5.2.1",
@@ -119,7 +120,6 @@
     "eslint-plugin-testing-library": "^7.5.2",
     "eslint-plugin-unicorn": "^59.0.1",
     "eslint-plugin-unused-imports": "^4.1.4",
-    "expo": "~53.0.12",
     "husky": "^9.1.5",
     "jest": "^29.7.0",
     "jest-environment-jsdom": "^29.7.0",
```

**File**: `pnpm-lock.yaml` (modified, +3/-3)
```diff
@@ -29,6 +29,9 @@ importers:
       axios:
         specifier: ^1.7.5
         version: 1.7.5
+      expo:
+        specifier: ~53.0.12
+        version: 53.0.12(@babel/core@7.26.0)(@expo/metro-runtime@5.0.4(react-native@0.79.4(@babel/core@7.26.0)(@types/react@19.0.14)(react@19.0.0)))(react-native@0.79.4(@babel/core@7.26.0)(@types/react@19.0.14)(react@19.0.0))(react@19.0.0)
       expo-constants:
         specifier: ~17.1.6
         version: 17.1.6(expo@53.0.12(@babel/core@7.26.0)(@expo/metro-runtime@5.0.4(react-native@0.79.4(@babel/core@7.26.0)(@types/react@19.0.14)(react@19.0.0)))(react-native@0.79.4(@babel/core@7.26.0)(@types/react@19.0.14)(react@19.0.0))(react@19.0.0))(react-native@0.79.4(@babel/core@7.26.0)(@types/react@19.0.14)(react@19.0.0))
@@ -237,9 +240,6 @@ importers:
       eslint-plugin-unused-imports:
         specifier: ^4.1.4
         version: 4.1.4(@typescript-eslint/eslint-plugin@8.34.0(@typescript-eslint/parser@8.34.0(eslint@9.29.0(jiti@1.21.6))(typescript@5.8.3))(eslint@9.29.0(jiti@1.21.6))(typescript@5.8.3))(eslint@9.29.0(jiti@1.21.6))
-      expo:
-        specifier: ~53.0.12
-        version: 53.0.12(@babel/core@7.26.0)(@expo/metro-runtime@5.0.4(react-native@0.79.4(@babel/core@7.26.0)(@types/react@19.0.14)(react@19.0.0)))(react-native@0.79.4(@babel/core@7.26.0)(@types/react@19.0.14)(react@19.0.0))(react@19.0.0)
       husky:
         specifier: ^9.1.5
         version: 9.1.5
```

---

### Incident Patch 13: `7e2efcab` (2025-06-25)
**Commit Message**: fix(lint): ignore auto-generated types

**File**: `eslint.config.mjs` (modified, +1/-0)
```diff
@@ -29,6 +29,7 @@ export default defineConfig([
     '.vscode',
     'docs/',
     'cli/',
+    'expo-env.d.ts',
   ]),
   expoConfig,
   eslintPluginPrettierRecommended,
```

---

### Incident Patch 14: `6c820350` (2025-06-15)
**Commit Message**: refactor: prebuild native directories

**File**: `android/.kotlin/errors/errors-1750066517022.log` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+kotlin version: 2.0.21
+error message: The daemon has terminated unexpectedly on startup attempt #1 with error code: 0. The daemon process output:
+    1. Kotlin compile daemon is ready
+
```

**File**: `android/app/build.gradle` (modified, +5/-4)
```diff
@@ -14,6 +14,7 @@ react {
     hermesCommand = new File(["node", "--print", "require.resolve('react-native/package.json')"].execute(null, rootDir).text.trim()).getParentFile().getAbsolutePath() + "/sdks/hermesc/%OS-BIN%/hermesc"
     codegenDir = new File(["node", "--print", "require.resolve('@react-native/codegen/package.json', { paths: [require.resolve('react-native/package.json')] })"].execute(null, rootDir).text.trim()).getParentFile().getAbsoluteFile()
 
+    enableBundleCompression = (findProperty('android.enableBundleCompression') ?: false).toBoolean()
     // Use Expo CLI to bundle the app, this ensures the Metro config
     // works correctly with Expo projects.
     cliFile = new File(["node", "--print", "require.resolve('@expo/cli', { paths: [require.resolve('expo/package.json')] })"].execute(null, rootDir).text.trim())
@@ -78,7 +79,7 @@ def enableProguardInReleaseBuilds = (findProperty('android.enableProguardInRelea
  * give correct results when using with locales other than en-US. Note that
  * this variant is about 6MiB larger per architecture than default.
  */
-def jscFlavor = 'org.webkit:android-jsc:+'
+def jscFlavor = 'io.github.react-native-community:jsc-android:2026004.+'
 
 android {
     ndkVersion rootProject.ext.ndkVersion
@@ -156,15 +157,15 @@ dependencies {
 
     if (isGifEnabled) {
         // For animated gif support
-        implementation("com.facebook.fresco:animated-gif:${reactAndroidLibs.versions.fresco.get()}")
+        implementation("com.facebook.fresco:animated-gif:${expoLibs.versions.fresco.get()}")
     }
 
     if (isWebpEnabled) {
         // For webp support
-        implementation("com.facebook.fresco:webpsupport:${reactAndroidLibs.versions.fresco.get()}")
+        implementation("com.facebook.fresco:webpsupport:${expoLibs.versions.fresco.get()}")
         if (isWebpAnimatedEnabled) {
             // Animated webp support
-            implementation("com.facebook.fresco:animated-webp:${reactAndroidLibs.versions.fresco.get()}")
+            implementation("com.facebook.fresco:animated-webp:${expoLibs.versions.fresco.get()}")
         }
     }
 
```

**File**: `android/app/src/main/AndroidManifest.xml` (modified, +0/-1)
```diff
@@ -25,7 +25,6 @@
         <category android:name="android.intent.category.DEFAULT"/>
         <category android:name="android.intent.category.BROWSABLE"/>
         <data android:scheme="obytesApp"/>
-        <data android:scheme="com.obytes.development"/>
         <data android:scheme="exp+obytesapp"/>
       </intent-filter>
     </activity>
```

**File**: `android/app/src/main/java/com/obytes/development/MainApplication.kt` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ class MainApplication : Application(), ReactApplication {
           override fun getPackages(): List<ReactPackage> {
             val packages = PackageList(this).packages
             // Packages that cannot be autolinked yet can be added manually here, for example:
-            // packages.add(new MyReactNativePackage());
+            // packages.add(MyReactNativePackage())
             return packages
           }
 
```

**File**: `android/app/src/main/res/values/styles.xml` (modified, +0/-7)
```diff
@@ -1,15 +1,8 @@
 <resources xmlns:tools="http://schemas.android.com/tools">
   <style name="AppTheme" parent="Theme.EdgeToEdge">
-    <item name="android:textColor">@android:color/black</item>
-    <item name="android:editTextStyle">@style/ResetEditText</item>
     <item name="android:editTextBackground">@drawable/rn_edit_text_material</item>
     <item name="colorPrimary">@color/colorPrimary</item>
   </style>
-  <style name="ResetEditText" parent="@android:style/Widget.EditText">
-    <item name="android:padding">0dp</item>
-    <item name="android:textColorHint">#c8c8c8</item>
-    <item name="android:textColor">@android:color/black</item>
-  </style>
   <style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">
     <item name="windowSplashScreenBackground">@color/splashscreen_background</item>
     <item name="windowSplashScreenAnimatedIcon">@drawable/splashscreen_logo</item>
```

**File**: `android/build.gradle` (modified, +28/-32)
```diff
@@ -1,41 +1,37 @@
 // Top-level build file where you can add configuration options common to all sub-projects/modules.
 
 buildscript {
-    ext {
-        buildToolsVersion = findProperty('android.buildToolsVersion') ?: '35.0.0'
-        minSdkVersion = Integer.parseInt(findProperty('android.minSdkVersion') ?: '24')
-        compileSdkVersion = Integer.parseInt(findProperty('android.compileSdkVersion') ?: '35')
-        targetSdkVersion = Integer.parseInt(findProperty('android.targetSdkVersion') ?: '34')
-        kotlinVersion = findProperty('android.kotlinVersion') ?: '1.9.24'
-
-        ndkVersion = "26.1.10909125"
-    }
-    repositories {
-        google()
-        mavenCentral()
-    }
-    dependencies {
-        classpath('com.android.tools.build:gradle')
-        classpath('com.facebook.react:react-native-gradle-plugin')
-        classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')
-    }
+  repositories {
+    google()
+    mavenCentral()
+  }
+  dependencies {
+    classpath('com.android.tools.build:gradle')
+    classpath('com.facebook.react:react-native-gradle-plugin')
+    classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')
+  }
 }
 
-apply plugin: "com.facebook.react.rootproject"
+def reactNativeAndroidDir = new File(
+  providers.exec {
+    workingDir(rootDir)
+    commandLine("node", "--print", "require.resolve('react-native/package.json')")
+  }.standardOutput.asText.get().trim(),
+  "../android"
+)
 
 allprojects {
-    repositories {
-        maven {
-            // All of React Native (JS, Obj-C sources, Android binaries) is installed from npm
-            url(new File(['node', '--print', "require.resolve('react-native/package.json')"].execute(null, rootDir).text.trim(), '../android'))
-        }
-        maven {
-            // Android JSC is installed from npm
-            url(new File(['node', '--print', "require.resolve('jsc-android/package.json', { paths: [require.resolve('react-native/package.json')] })"].execute(null, rootDir).text.trim(), '../dist'))
-        }
-
-        google()
-        mavenCentral()
-        maven { url 'https://www.jitpack.io' }
+  repositories {
+    maven {
+      // All of React Native (JS, Obj-C sources, Android binaries) is installed from npm
+      url(reactNativeAndroidDir)
     }
+
+    google()
+    mavenCentral()
+    maven { url 'https://www.jitpack.io' }
+  }
 }
+
+apply plugin: "expo-root-project"
+apply plugin: "com.facebook.react.rootproject"
```

**File**: `android/gradle/wrapper/gradle-wrapper.properties` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 distributionBase=GRADLE_USER_HOME
 distributionPath=wrapper/dists
-distributionUrl=https\://services.gradle.org/distributions/gradle-8.10.2-all.zip
+distributionUrl=https\://services.gradle.org/distributions/gradle-8.13-bin.zip
 networkTimeout=10000
 validateDistributionUrl=true
 zipStoreBase=GRADLE_USER_HOME
```

**File**: `android/gradlew` (modified, +1/-2)
```diff
@@ -86,8 +86,7 @@ done
 # shellcheck disable=SC2034
 APP_BASE_NAME=${0##*/}
 # Discard cd standard output in case $CDPATH is set (https://github.com/gradle/gradle/issues/25036)
-APP_HOME=$( cd -P "${APP_HOME:-./}" > /dev/null && printf '%s
-' "$PWD" ) || exit
+APP_HOME=$( cd -P "${APP_HOME:-./}" > /dev/null && printf '%s\n' "$PWD" ) || exit
 
 # Use the maximum available, or set MAX_FD != -1 to use that value.
 MAX_FD=maximum
```

---

### Incident Patch 15: `35f360af` (2025-02-18)
**Commit Message**: fix: fix doctor warnings

**File**: `package.json` (modified, +10/-10)
```diff
@@ -44,21 +44,21 @@
     "@expo/metro-runtime": "^4.0.1",
     "@gorhom/bottom-sheet": "^5.0.5",
     "@hookform/resolvers": "^3.9.0",
-    "@shopify/flash-list": "1.7.1",
+    "@shopify/flash-list": "1.7.3",
     "@tanstack/react-query": "^5.52.1",
     "app-icon-badge": "^0.1.2",
     "axios": "^1.7.5",
-    "expo": "~52.0.26",
-    "expo-constants": "~17.0.4",
-    "expo-dev-client": "~5.0.9",
+    "expo": "~52.0.35",
+    "expo-constants": "~17.0.6",
+    "expo-dev-client": "~5.0.12",
     "expo-font": "~13.0.3",
-    "expo-image": "~2.0.4",
-    "expo-linking": "~7.0.4",
+    "expo-image": "~2.0.5",
+    "expo-linking": "~7.0.5",
     "expo-localization": "~16.0.1",
     "expo-router": "~4.0.17",
-    "expo-splash-screen": "~0.29.21",
+    "expo-splash-screen": "~0.29.22",
     "expo-status-bar": "~2.0.1",
-    "expo-system-ui": "~4.0.7",
+    "expo-system-ui": "~4.0.8",
     "i18next": "^23.14.0",
     "lodash.memoize": "^4.1.2",
     "moti": "^0.29.0",
@@ -68,7 +68,7 @@
     "react-error-boundary": "^4.0.13",
     "react-hook-form": "^7.53.0",
     "react-i18next": "^15.0.1",
-    "react-native": "0.76.6",
+    "react-native": "0.76.7",
     "react-native-edge-to-edge": "^1.1.2",
     "react-native-flash-message": "^0.4.2",
     "react-native-gesture-handler": "~2.20.2",
@@ -118,7 +118,7 @@
     "husky": "^9.1.5",
     "jest": "^29.7.0",
     "jest-environment-jsdom": "^29.7.0",
-    "jest-expo": "~52.0.3",
+    "jest-expo": "~52.0.4",
     "jest-junit": "^16.0.0",
     "lint-staged": "^15.2.9",
     "np": "^10.0.7",
```

#### Recent Merged Pull Requests:
- **PR #541** (closed): feat: adding redesign (@tothepoweroftom)
- **PR #531** (2026-06-02): fix: hide splash screen from root layout (@0x1337ak)
- **PR #530** (closed): Fix typo in app releasing process documentation (@softwarebyze)
- **PR #529** (closed): Feat/accounts (@Cordelia242)
- **PR #527** (closed): Update README.md to correct link name from Nativewind to Uniwind (@hooneun)
- **PR #525** (closed): Remove .env from version control and ignore secrets (@thanhcanhit)
- **PR #524** (closed): fix: hide splash screen on onboarding and login screens (@songyipan)
- **PR #522** (closed): update: adding mobile basics.  (@tothepoweroftom)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
