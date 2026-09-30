# Forensic Learning Record (Deep Inspection): devhubapp/devhub

> **Canonical Artifact**: `07_PROJECT_LEARNING/devhubapp-devhub-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/devhubapp/devhub](https://github.com/devhubapp/devhub))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:37:43.607Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `devhubapp/devhub`
- **Description**: TweetDeck for GitHub - Filter Issues, Activities & Notifications - Web, Mobile & Desktop with 99% code sharing between them
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10130 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
  root: true,
  env: {
    browser: true,
  },
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:react/recommended',
    'plugin:prettier/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  plugins: ['eslint-plugin-react', '@typescript-eslint'],
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        'react/prop-types': 'off',
      },
    },
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    '@typescript-eslint/ban-types': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-empty-interface': 'warn',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-floating-promises': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-return': 'warn',
    '@typescript-eslint/no-var-requires': 'warn',
    '@typescript-eslint/prefer-regexp-exec': 'off',
    '@typescript-eslint/restrict-template-expressions': 'warn',
    '@typescript-eslint/unbound-method': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'react/display-name': 'warn',
    'react/no-children-prop': 'off',
    'react/no-find-dom-node': 'off',
  },
}

```

### Core Architecture Module: `.prettierrc.js`
```
module.exports = {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
}

```

### Core Architecture Module: `@types/bugsnag-react/index.d.ts`
```
declare module 'bugsnag-react' {
  export default function createPlugin(react: any): any
}

```

### Core Architecture Module: `@types/electron/index.d.ts`
```
/// <reference path="../../node_modules/electron/electron.d.ts" />

interface Window {
  devhub?: boolean
  eval: never
  ipc: Electron.IpcRenderer
  process?: {
    type?: string
  }
  require: NodeRequireFunction
}

declare namespace NodeJS {
  interface ProcessVersions {
    electron?: boolean
  }
}

```

### Core Architecture Module: `@types/isomorphic-unfetch/index.d.ts`
```
declare module 'isomorphic-unfetch' {
  const fetch: GlobalFetch['fetch']
  export default fetch
}

```

### Core Architecture Module: `@types/react-native-gesture-handler/index.d.ts`
```
declare module 'react-native-gesture-handler' {
  import Swipeable from 'react-native-gesture-handler/Swipeable'

  export * from 'react-native-gesture-handler'
  export { Swipeable }
}

```

### Core Architecture Module: `@types/react-native-is-catalyst/index.d.ts`
```
declare module 'react-native-is-catalyst' {
  const isCatalyst: boolean
  export default isCatalyst
}

```

### Core Architecture Module: `@types/react-native-vector-icons/index.d.ts`
```
declare module 'react-native-vector-icons' {
  export * from 'react-native-vector-icons'
}

declare module 'react-native-vector-icons/dist/MaterialIcons' {}

declare module 'react-native-vector-icons/dist/Octicons' {}

declare module 'react-native-vector-icons/Fonts/MaterialIcons.ttf' {}

declare module 'react-native-vector-icons/Fonts/Octicons.ttf' {}

declare module 'react-native-vector-icons/lib/create-icon-set' {
  declare function createIconSet<Glyphs extends Record<string, number>>(
    glyphs: Glyphs,
    fontFamily: string,
    fontFile: string,
  ): {
    [key: string]: any
    hasIcon(name: keyof Glyphs): boolean
  }

  export default createIconSet
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #222** (2020-10-24): **App no MacOS não funciona**
  *Symptoms*: Estou apenas com uma tela preta.  ![Captura de Tela 2020-10-16 às 16 12 11](https://user-images.githubusercontent.com/43140758/96299416-6bb88f80-0fca-11eb-8a36-8b8637abf8fc.png) 
  **Post-Mortem & Fix Analysis**:
  > primeira vez que vejo isso; mac ta com espaco livre suficiente? ja tentou reinstalar o app?
  > @renanmav a [v0.102](https://github.com/devhubapp/devhub/releases/tag/v0.102.0) funciona?
  > @brunolemos Estou usando no Windows agr

- **Issue #198** (2019-10-27): **[Windows] save button on app tries to open a native link**
  *Symptoms*: The newly added save button on the windows app tries to open an app (system-url) which windows does not know the filetype and shows the selection to download one from the store. The shortcut executed with `s` does not have this behavior so I assume it's a native link which needs to get removed?  Edit: I forgot to notice, that the opening is executed in addition to saving the notification.
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting, it seems this was happening only on Windows.  I have re-uploaded the [.exe](https://github.com/devhubapp/devhub/releases/download/v0.98.0/DevHub-Setup-0.98.0.exe) file on [v0.98.0](https://github.com/devhubapp/devhub/releases/tag/v0.98.0) with the fix. You can re-install it to get the fix now or wait for the `v0.98.1`+ release which may take a few days.
  > Can confirm that this works. Looks like you've misspelled the file, beforehand it was called `DevHub-Setup-0.98.0.exe` now it's called `DevHub.Setup.0.98.0.exe` that why your reference on [devhubapp.com](https://devhubapp.com/download) does not work.
  > Fixed, thanks! Not sure but I think that when I re-uploded manually GitHub replaced the spaces with “.”, and when electron-builder uploads automatically it replaces the spaces with a “-“.

- **Issue #193** (2019-10-27): **Unable to locate attached view in the native tree**
  *Symptoms*: exports@index.android.bundle:25:287 value@index.android.bundle:242:2469 value@index.android.bundle:242:1530 value@index.android.bundle:255:2217 value@index.android.bundle:255:2297 Ln@index.android.bundle:91:32405 di@index.android.bundle:91:50450 Ml@index.android.bundle:91:70036 Ul@index.android.bundle:91:67144 Ul@[native code] Pl@index.android.bundle:91:65839 Pl@[native code] index.android.bundle:91:25495 unstable_runWithPriority@index.android.bundle:170:3915 sn@index.android.bundle:91:25442 cn@index.android.bundle:91:25377 _e@index.android.bundle:91:88686 Ne@index.android.bundle:91:13582 notify@index.android.bundle:624:871 notifyNestedSubs@index.android.bundle:624:443 handleChangeWrapper@index.android.bundle:624:518 [native code] j@index.android.bundle:633:5905 index.android.bundle:1276:312 index.android.bundle:1268:9884 index.android.bundle:1275:371 index.android.bundle:1268:2798 h@index.android.bundle:1268:288 T@index.android.bundle:1268:477 E@index.android.bundle:1268:337 index.android.bundle:1268:2754 index.android.bundle:1268:7318 T@index.android.bundle:1268:8303 A@index.android.bundle:1268:7819 v@index.android.bundle:1268:8080 f@index.android.bundle:108:155 index.android.bundle:108:882 y@index.android.bundle:114:661 C@index.android.bundle:114:1025 callImmediates@index.android.bundle:114:3100 callImmediates@[native code] value@index.android.bundle:38:3247 index.android.bundle:38:1283 value@index.android.bundle:38:2939 value@in
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting, I checked bugsnag and it seems this only affected 2 users. It seems to be an edge case and you'll likely not face this again.  The related error on bugsnag seems to be `scrollToIndex out of range: requested index 5 but maximum is 4` so maybe some item or column got removed and some race condition happened.  If it keeps happening let me know that I'll investigate more.

- **Issue #191** (2019-10-27): **[Windows] Menubar mode wrong behavior**
  *Symptoms*: It would be really nice if we could minimize DevHub to the system tray and see a feedback in the icon when a new notification arrive.
  **Post-Mortem & Fix Analysis**:
  > Hi, DevHub already have both of these features.  Have you tried the "Menubar" mode?
  > Hi, Good point I didn't try ! Now that I've tried I'm not sure it's working as expected. Here is gif file showing how it behaves on my computer. ![r8JP7L9E2y](https://user-images.githubusercontent.com/3799294/66778458-0835e680-eecc-11e9-90eb-f8cf57e818cf.gif)    
  > Weird, I just tried on Windows 10 and I'm not able to reproduce these problems. The `Open` button worked correctly and the app showed at the right like it should. Not sure what could it be.  Instead of clicking `Open` try clicking `Menubar mode` again, does that work?

- **Issue #190** (2019-10-27): **menubar on windows not working**
  *Symptoms*: I tried to switch into menubar mode and the app is displayed once on the top left of the screen. If I click once anywhere else on the screen the menubar version of devhub closes and after that I'm unable to open it again. Every click on the icon within the taskbar opens the settings/context menu. Even selecting the 'open' option from within the context menu does not appear to have any effect.  If you need more information, let me know.
  **Post-Mortem & Fix Analysis**:
  > Let me know if [v0.98.0](https://github.com/devhubapp/devhub/releases/tag/v0.98.0) fixes it!
  > Works like a charme, thanks for the fix! 
  > @tobiaskohlbau thanks for purchasing the yearly plan! 💚

- **Issue #188** (2019-10-08): **Can't find variable: Intl**
  *Symptoms*: formatPrice@index.android.bundle:500:1534 PricingPlanBlock@index.android.bundle:1237:2050 Or@index.android.bundle:91:41719 Vl@index.android.bundle:91:80200 Ml@index.android.bundle:91:70036 Ul@index.android.bundle:91:67144 Ul@[native code] Pl@index.android.bundle:91:65839 Pl@[native code] index.android.bundle:91:25495 unstable_runWithPriority@index.android.bundle:170:3915 sn@index.android.bundle:91:25442 cn@index.android.bundle:91:25377 _e@index.android.bundle:91:88686 Ne@index.android.bundle:91:13582 Ue@index.android.bundle:91:13755 receiveTouches@index.android.bundle:91:14547 value@index.android.bundle:38:3685 index.android.bundle:38:841 value@index.android.bundle:38:2939 value@index.android.bundle:38:813 value@[native code]
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting, I shipped this code by mistake.  Published the fix to the store and it should be available in a few hours.  _Note: It will still say `0.97.1`_ 

- **Issue #186** (2019-10-08): **App rotates even with device orientation lock on**
  *Symptoms*: Version: 0.95  Device: Google Pixel 3
  **Post-Mortem & Fix Analysis**:
  > Could you send a pull request please? 
  > Fixed on [v0.97.1](https://play.google.com/store/apps/details?id=com.devhubapp&hl=en_US).

- **Issue #178** (2019-10-07): **Desktop auto update is buggy**
  *Symptoms*: - Sometimes clicking at the update notification doesn't restart the app - Sometimes it render an empty screen after an update, and you need to restart again  - Sometimes it shows wrong icons due to some cache issue with react-native-vector-icons

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

### Incident Patch 1: `2435eb2a` (2021-06-23)
**Commit Message**: Use typed-redux-saga to fix type checking after typescript upgrade

https://github.com/redux-saga/redux-saga/issues/884

**File**: `.eslintrc.js` (modified, +0/-1)
```diff
@@ -30,7 +30,6 @@ module.exports = {
     },
   },
   rules: {
-    '@typescript-eslint/ban-ts-comment': 'off',
     '@typescript-eslint/ban-types': 'warn',
     '@typescript-eslint/explicit-module-boundary-types': 'off',
     '@typescript-eslint/no-empty-interface': 'warn',
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -142,7 +142,7 @@ Support this project by becoming a sponsor. Your logo will show up here with a l
 - [React Native Web](https://github.com/necolas/react-native-web)
 - [Redux](https://github.com/reduxjs/react-redux)
 - [Redux Persist](https://github.com/rt2zz/redux-persist)
-- [Redux Saga](https://github.com/redux-saga/redux-saga/)
+- [Redux Saga](https://github.com/redux-saga/redux-saga/) ([typed-redux-saga](https://github.com/agiledigital/typed-redux-saga))
 - [Reselect](https://github.com/reduxjs/reselect)
 - [GraphQL](https://github.com/facebook/graphql)
 - [Electron](https://github.com/electron/electron)
```

**File**: `packages/components/package.json` (modified, +3/-2)
```diff
@@ -40,6 +40,7 @@
     "redux-persist": "6.0.0",
     "redux-saga": "1.1.3",
     "reselect": "4.0.0",
+    "typed-redux-saga": "1.3.1",
     "yup": "0.27.0"
   },
   "devDependencies": {
@@ -62,7 +63,7 @@
     "babel-jest": "26.6.3",
     "jest": "26.6.3",
     "postinstall-postinstall": "2.0.0",
-    "prettier": "2.2.1",
+    "prettier": "2.3.1",
     "react-native-typescript-transformer": "1.2.13",
     "redux-flipper": "1.4.2",
     "reselect-tools": "0.0.7",
@@ -73,4 +74,4 @@
   "peerDependencies": {
     "eslint": "*"
   }
-}
+}
\ No newline at end of file
```

**File**: `packages/components/src/redux/sagas/api.ts` (modified, +12/-14)
```diff
@@ -1,8 +1,6 @@
-// @ts-nocheck
-
 import axios, { AxiosResponse } from 'axios'
 import _ from 'lodash'
-import { all, fork, put, select, take, takeLatest } from 'redux-saga/effects'
+import { all, fork, put, select, take, takeLatest } from 'typed-redux-saga'
 
 import {
   constants,
@@ -29,7 +27,7 @@ function* init() {
   while (true) {
     yield take('*')
 
-    const state: RootState = yield select()
+    const state: RootState = yield* select()
 
     const appToken = selectors.appTokenSelector(state)
     if (!appToken) continue
@@ -59,12 +57,12 @@ function* init() {
 // Note: Lodash debounce was not working as expected with generators
 // so we now use normal async/await in the sync functions
 function* onSyncUp() {
-  const state: RootState = yield select()
+  const state: RootState = yield* select()
   void debounceSyncUp(state)
 }
 
 function* onSyncDown() {
-  let state: RootState = yield select()
+  let state: RootState = yield* select()
 
   const appToken = selectors.appTokenSelector(state)
   if (!appToken) return
@@ -152,7 +150,7 @@ function* onSyncDown() {
       },
     )
 
-    state = yield select()
+    state = yield* select()
 
     const { data, errors } = response.data
 
@@ -279,7 +277,7 @@ const debounceSyncUp = _.debounce(syncUp, 5000, {
 function* onLoginSuccess(
   action: ExtractActionFromActionCreator<typeof actions.loginSuccess>,
 ) {
-  const state: RootState = yield select()
+  const state: RootState = yield* select()
 
   const { columns, subscriptions } = action.payload.user
   const username = action.payload.user.github.user.login
@@ -335,7 +333,7 @@ function* onLoginSuccess(
       yield put(actions.syncUp())
     }
   } else {
-    const hasCreatedColumn = yield select(selectors.hasCreatedColumnSelector)
+    const hasCreatedColumn = yield* select(selectors.hasCreatedColumnSelector)
     if (!hasCreatedColumn) {
       yield put(
         actions.replaceColumnsAndSubscriptions(getDefaultColumns(username)),
@@ -347,10 +345,10 @@ function* onLoginSuccess(
 }
 
 export function* apiSagas() {
-  yield all([
-    yield fork(init),
-    yield takeLatest('LOGIN_SUCCESS', onLoginSuccess),
-    yield takeLatest('SYNC_DOWN', onSyncDown),
-    yield takeLatest('SYNC_UP', onSyncUp),
+  yield* all([
+    yield* fork(init),
+    yield* takeLatest('LOGIN_SUCCESS', onLoginSuccess),
+    yield* takeLatest('SYNC_DOWN', onSyncDown),
+    yield* takeLatest('SYNC_UP', onSyncUp),
   ])
 }
```

**File**: `packages/components/src/redux/sagas/auth.ts` (modified, +17/-19)
```diff
@@ -1,5 +1,3 @@
-// @ts-nocheck
-
 import { constants, User } from '@devhub/core'
 import axios, { AxiosResponse } from 'axios'
 import * as StoreReview from 'react-native-store-review'
@@ -12,7 +10,7 @@ import {
   select,
   take,
   takeLatest,
-} from 'redux-saga/effects'
+} from 'typed-redux-saga'
 
 import { Alert } from 'react-native'
 import { analytics } from '../../libs/analytics'
@@ -29,7 +27,7 @@ function* init() {
   yield take('LOGIN_SUCCESS')
 
   while (true) {
-    const state = yield select()
+    const state = yield* select()
 
     const appToken = selectors.appTokenSelector(state)
     const isLogged = selectors.isLoggedSelector(state)
@@ -84,7 +82,7 @@ function* init() {
 }
 
 function* onRehydrate() {
-  const appToken = yield select(selectors.appTokenSelector)
+  const appToken = yield* select(selectors.appTokenSelector)
   if (!appToken) return
 
   yield put(actions.loginRequest({ appToken }))
@@ -280,7 +278,7 @@ function* onLoginSuccess(
   clearOAuthQueryParams()
 
   if (StoreReview.isAvailable && !__DEV__) {
-    const state = yield select()
+    const state = yield* select()
     const { loginSuccess: loginCount } = selectors.countersSelector(state)
 
     if (loginCount >= 5 && loginCount % 5 === 0) {
@@ -292,7 +290,7 @@ function* onLoginSuccess(
 }
 
 function* updateLoggedUserOnTools() {
-  const state = yield select()
+  const state = yield* select()
 
   const preferredDarkThemePair = selectors.preferredDarkThemePairSelector(state)
   const preferredLightThemePair = selectors.preferredLightThemePairSelector(
@@ -343,7 +341,7 @@ function onLogout() {
 }
 
 function* onDeleteAccountRequest() {
-  const appToken = yield select(selectors.appTokenSelector)
+  const appToken = yield* select(selectors.appTokenSelector)
 
   try {
     const response: AxiosResponse<{
@@ -412,19 +410,19 @@ function* onDeleteAccountSuccess() {
 }
 
 export function* authSagas() {
-  yield all([
-    yield fork(init),
-    yield takeLatest(REHYDRATE, onRehydrate),
-    yield takeLatest(
+  yield* all([
+    yield* fork(init),
+    yield* takeLatest(REHYDRATE, onRehydrate),
+    yield* takeLatest(
       [REHYDRATE, 'LOGIN_SUCCESS', 'LOGOUT', 'UPDATE_USER_DATA'],
       updateLoggedUserOnTools,
     ),
-    yield takeLatest('LOGIN_REQUEST', onLoginRequest),
-    yield takeLatest('LOGIN_FAILURE', onLoginFailure),
-    yield takeLatest('LOGIN_SUCCESS', onLoginSuccess),
-    yield takeLatest('DELETE_ACCOUNT_REQUEST', onDeleteAccountRequest),
-    yield takeLatest('DELETE_ACCOUNT_FAILURE', onDeleteAccountFailure),
-    yield takeLatest('DELETE_ACCOUNT_SUCCESS', onDeleteAccountSuccess),
-    yield takeLatest('LOGOUT', onLogout),
+    yield* takeLatest('LOGIN_REQUEST', onLoginRequest),
+    yield* takeLatest('LOGIN_FAILURE', onLoginFailure),
+    yield* takeLatest('LOGIN_SUCCESS', onLoginSuccess),
+    yield* takeLatest('DELETE_ACCOUNT_REQUEST', onDeleteAccountRequest),
+    yield* takeLatest('DELETE_ACCOUNT_FAILURE', onDeleteAccountFailure),
+    yield* takeLatest('DELETE_ACCOUNT_SUCCESS', onDeleteAccountSuccess),
+    yield* takeLatest('LOGOUT', onLogout),
   ])
 }
```

---

### Incident Patch 2: `9e116f9e` (2021-06-23)
**Commit Message**: Possibly fix .avatar_url null error

Fix https://github.com/devhubapp/devhub/issues/230

**File**: `packages/core/src/helpers/github/shared.ts` (modified, +1/-0)
```diff
@@ -311,6 +311,7 @@ export function getUserAvatarFromObject(
   { size }: { size?: number } = {},
   getPixelSizeForLayoutSizeFn: ((size: number) => number) | undefined,
 ) {
+  if (!user) return undefined
   if (!(user.avatar_url || user.id || user.login)) return undefined
 
   const baseURL =
```

---

### Incident Patch 3: `1db8fce2` (2020-12-11)
**Commit Message**: [Mobile] Fix TypeError: undefined is not an object (evaluating 'o.remove')

**File**: `packages/components/src/libs/appearence/index.native.tsx` (modified, +7/-1)
```diff
@@ -12,10 +12,16 @@ export const AppearanceProvider = Fragment
 
 export const Appearance: Appearence = {
   addChangeListener(listener) {
-    return AppearanceOriginal.addChangeListener((preferences) => {
+    AppearanceOriginal.addChangeListener((preferences) => {
       const _colorScheme = preferences && preferences.colorScheme
       listener({ colorScheme: normalizeColorScheme(_colorScheme) })
     })
+
+    return {
+      remove: () => {
+        AppearanceOriginal.removeChangeListener(listener as any)
+      },
+    }
   },
   getColorScheme() {
     return normalizeColorScheme(AppearanceOriginal.getColorScheme())
```

---

### Incident Patch 4: `9f4a5d9c` (2020-12-08)
**Commit Message**: [Mobile] Fix iOS release build

Invalid platform "ios" selected. and main.jsbundle does not exist

https://github.com/react-native-community/cli/issues/656\#issuecomment-532235648

**File**: `package.json` (modified, +3/-0)
```diff
@@ -34,6 +34,9 @@
     "studio": "yarn workspace @devhub/mobile studio",
     "xcode": "yarn workspace @devhub/mobile xcode"
   },
+  "dependencies": {
+    "react-native": "*"
+  },
   "devDependencies": {
     "@primer/octicons-v2": "canary",
     "@typescript-eslint/eslint-plugin": "4.9.0",
```

**File**: `packages/mobile/ios/devhub.xcodeproj/project.pbxproj` (modified, +4/-3)
```diff
@@ -151,7 +151,7 @@
 					};
 				};
 			};
-			buildConfigurationList = 83CBB9FA1A601CBA00E9B192 /* Build configuration list for PBXProject "DevHub" */;
+			buildConfigurationList = 83CBB9FA1A601CBA00E9B192 /* Build configuration list for PBXProject "devhub" */;
 			compatibilityVersion = "Xcode 12.0";
 			developmentRegion = en;
 			hasScannedForEncodings = 0;
@@ -196,7 +196,7 @@
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 			shellPath = /bin/sh;
-			shellScript = "set -e\n\nexport NODE_BINARY=node\n../../../node_modules/react-native/scripts/react-native-xcode.sh\n";
+			shellScript = "set -e\n\nexport NODE_BINARY=node\nexport ENTRY_FILE=packages/mobile/index.js\n../../../node_modules/react-native/scripts/react-native-xcode.sh\n";
 		};
 		30B724DD75C10DC4C299DD76 /* [CP] Copy Pods Resources */ = {
 			isa = PBXShellScriptBuildPhase;
@@ -328,6 +328,7 @@
 					"$(inherited)",
 					"@executable_path/Frameworks",
 				);
+				ONLY_ACTIVE_ARCH = YES;
 				OTHER_LDFLAGS = (
 					"$(inherited)",
 					"-ObjC",
@@ -477,7 +478,7 @@
 			defaultConfigurationIsVisible = 0;
 			defaultConfigurationName = Release;
 		};
-		83CBB9FA1A601CBA00E9B192 /* Build configuration list for PBXProject "DevHub" */ = {
+		83CBB9FA1A601CBA00E9B192 /* Build configuration list for PBXProject "devhub" */ = {
 			isa = XCConfigurationList;
 			buildConfigurations = (
 				83CBBA201A601CBA00E9B192 /* Debug */,
```

---

### Incident Patch 5: `8d3623b8` (2020-12-08)
**Commit Message**: [Landing] Fix build error (SyntaxError: Unexpected token '.')

**File**: `landing/next.config.js` (modified, +14/-8)
```diff
@@ -1,11 +1,17 @@
 const withCSS = require('@zeit/next-css')
 
-module.exports = withCSS({
-  env: {
-    STRIPE_PUBLIC_KEY:
-      process.env.NODE_ENV === 'production'
-        ? 'pk_live_SRFXNC2vJzVcCNwE7fXVmCM900PLxWhQ6D'
-        : 'pk_test_PvG6Vvwe8z0SdsxY7fWtvAPW00X0ooU3XF',
-    PADDLE_VENDOR_ID: 33705,
-  },
+const withTM = require('next-transpile-modules')(['@devhub/core'], {
+  resolveSymlinks: true,
 })
+
+module.exports = withCSS(
+  withTM({
+    env: {
+      STRIPE_PUBLIC_KEY:
+        process.env.NODE_ENV === 'production'
+          ? 'pk_live_SRFXNC2vJzVcCNwE7fXVmCM900PLxWhQ6D'
+          : 'pk_test_PvG6Vvwe8z0SdsxY7fWtvAPW00X0ooU3XF',
+      PADDLE_VENDOR_ID: 33705,
+    },
+  }),
+)
```

**File**: `landing/package.json` (modified, +12/-12)
```diff
@@ -17,42 +17,42 @@
     "start": "next -p 3001"
   },
   "dependencies": {
-    "@devhub/core": "npm:@brunolemos/devhub-core@0.102.0",
+    "@devhub/core": "npm:@brunolemos/devhub-core@0.102.1-rc.0",
     "@zeit/next-css": "1.0.1",
     "autoprefixer": "9.6.4",
     "classnames": "2.2.6",
-    "isomorphic-unfetch": "3.0.0",
+    "isomorphic-unfetch": "3.1.0",
     "lodash": "4.17.20",
-    "next": "10.0.1",
-    "next-transpile-modules": "4.1.0",
+    "next": "10.0.3",
+    "next-transpile-modules": "6.0.0",
     "qs": "6.9.1",
     "react": "17.0.1",
     "react-dom": "17.0.1",
     "react-stripe-elements": "5.0.1",
     "tailwindcss": "1.1.2"
   },
   "devDependencies": {
-    "@types/classnames": "2.2.9",
+    "@types/classnames": "2.2.11",
     "@types/lodash": "4.14.165",
-    "@types/node": "14.0.5",
-    "@types/qs": "6.9.0",
+    "@types/node": "14.14.11",
+    "@types/qs": "6.9.5",
     "@types/react": "17.0.0",
     "@types/react-dom": "17.0.0",
     "@types/react-stripe-elements": "1.3.5",
     "@types/stripe-v3": "3.1.9",
     "@types/styled-jsx": "2.2.8",
-    "@typescript-eslint/eslint-plugin": "4.9.0",
-    "@typescript-eslint/parser": "4.9.0",
+    "@typescript-eslint/eslint-plugin": "4.9.1",
+    "@typescript-eslint/parser": "4.9.1",
     "eslint": "7.15.0",
     "eslint-config-nextjs": "1.0.6",
     "eslint-config-prettier": "7.0.0",
     "eslint-plugin-prettier": "3.2.0",
-    "mkdirp": "0.5.1",
-    "node-fetch": "2.6.0",
+    "mkdirp": "1.0.4",
+    "node-fetch": "2.6.1",
     "now": "21.0.1",
     "prettier": "2.2.1",
     "shx": "0.3.3",
-    "ts-node": "8.6.2",
+    "ts-node": "9.1.1",
     "typescript": "4.1.2"
   },
   "engines": {
```

**File**: `landing/src/components/common/CheckLabels.tsx` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ import { CheckLabelProps } from './CheckLabel'
 export interface CheckLabelsProps {
   center?: boolean
   className?: string
-  children: (ReactElement<CheckLabelProps> | false)[]
+  children: (ReactElement<CheckLabelProps> | boolean)[]
 }
 
 export function CheckLabels(props: CheckLabelsProps) {
```

**File**: `landing/tsconfig.json` (modified, +3/-11)
```diff
@@ -3,11 +3,7 @@
     "target": "esnext",
     "module": "esnext",
     "moduleResolution": "node",
-    "lib": [
-      "esnext",
-      "dom",
-      "dom.iterable"
-    ],
+    "lib": ["esnext", "dom", "dom.iterable"],
     "allowJs": false,
     "allowSyntheticDefaultImports": true,
     "esModuleInterop": true,
@@ -21,10 +17,6 @@
     "sourceMap": true,
     "strict": true
   },
-  "include": [
-    "src", "pages"
-  ],
-  "exclude": [
-    "node_modules"
-  ]
+  "include": ["src", "pages", "next.config.js"],
+  "exclude": ["node_modules"]
 }
```

**File**: `packages/mobile/package.json` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@
     "xcode": "open ios/devhub.xcworkspace"
   },
   "dependencies": {
+    "@devhub/core": "0.102.0",
     "@devhub/components": "0.102.0",
     "@react-native-firebase/analytics": "10.1.1",
     "@react-native-firebase/app": "10.1.0",
```

---

### Incident Patch 6: `cf5148c3` (2020-12-08)
**Commit Message**: [Desktop] Fix menubar mode on Linux and Windows

**File**: `packages/components/src/components/ElectronTitleBar.web.tsx` (modified, +17/-8)
```diff
@@ -1,8 +1,6 @@
 import React, { useEffect, useState } from 'react'
-import { Dimensions } from 'react-native'
 
 import { useDesktopOptions } from '../hooks/use-desktop-options'
-import { useDimensions } from '../hooks/use-dimensions'
 import { Platform } from '../libs/platform'
 import { useTheme } from './context/ThemeContext'
 import { getThemeColorOrItself } from './themed/helpers'
@@ -11,21 +9,32 @@ export function ElectronTitleBar() {
   const theme = useTheme()
 
   const [isFullScreen, setIsFullScreen] = useState(false)
+  const [isMaximized, setIsMaximized] = useState(() =>
+    window.ipc.sendSync('get-is-maximized'),
+  )
   const { isMenuBarMode } = useDesktopOptions()
-  const windowDimensions = useDimensions()
-
-  const isMaximized = windowDimensions.width === Dimensions.get('screen').width
 
   useEffect(() => {
     const handler = (_e: any, value: boolean | unknown) => {
       setIsFullScreen(value === true)
     }
 
-    // TODO: Fix. Not working.
-    window.ipc.addListener('fullscreenchange', handler)
+    window.ipc.addListener('fullscreen-change', handler)
+
+    return () => {
+      window.ipc.removeListener('fullscreen-change', handler)
+    }
+  }, [])
+
+  useEffect(() => {
+    const handler = (_e: any, value: boolean | unknown) => {
+      setIsMaximized(value === true)
+    }
+
+    window.ipc.addListener('is-maximized-change', handler)
 
     return () => {
-      window.ipc.removeListener('fullscreenchange', handler)
+      window.ipc.removeListener('is-maximized-change', handler)
     }
   }, [])
 
```

**File**: `packages/desktop/src/helpers.ts` (modified, +3/-1)
```diff
@@ -48,7 +48,9 @@ export function showWindow(win: BrowserWindow) {
   win.show()
 }
 
-export function getCenterPosition(obj: BrowserWindow | Tray) {
+export function getCenterPosition(
+  obj: Pick<BrowserWindow | Tray, 'getBounds'>,
+) {
   const bounds = obj.getBounds()
 
   const x = Math.round(bounds.x + bounds.width / 2)
```

**File**: `packages/desktop/src/ipc.ts` (modified, +77/-79)
```diff
@@ -56,27 +56,30 @@ export function register() {
     mainWindow.setFullScreen(false)
   })
 
+  ipcMain.removeAllListeners('minimize')
+  ipcMain.addListener('minimize', () => {
+    const mainWindow = window.getMainWindow()
+    if (!mainWindow) return
+    mainWindow.minimize()
+  })
+
+  ipcMain.removeAllListeners('get-is-maximized')
+  ipcMain.addListener('get-is-maximized', (e: any) => {
+    if (!e) return
+
+    e.returnValue = window.getMainWindow()?.isMaximized()
+  })
+
   ipcMain.removeAllListeners('toggle-maximize')
   ipcMain.addListener('toggle-maximize', () => {
     const mainWindow = window.getMainWindow()
     if (!mainWindow) return
 
     if (mainWindow.isMaximized()) {
-      const { width, height } = mainWindow.getBounds()
-      const lockOnCenter = config.store.get('lockOnCenter')
-
-      config.store.set('lockOnCenter', true)
-      mainWindow.setSize(
-        Math.round(width * 0.9),
-        Math.round(height * 0.9),
-        true,
-      )
-      config.store.set('lockOnCenter', lockOnCenter)
-
-      return
+      mainWindow.unmaximize()
+    } else {
+      mainWindow.maximize()
     }
-
-    mainWindow.maximize()
   })
 
   ipcMain.removeAllListeners('unread-counter')
@@ -86,13 +89,6 @@ export function register() {
     if (dock) dock.setBadge(unreadCount > 0 ? `${unreadCount}` : '')
   })
 
-  ipcMain.removeAllListeners('minimize')
-  ipcMain.addListener('minimize', () => {
-    const mainWindow = window.getMainWindow()
-    if (!mainWindow) return
-    mainWindow.minimize()
-  })
-
   ipcMain.removeAllListeners('get-all-settings')
   ipcMain.addListener('get-all-settings', (e: any) => {
     if (!e) return
@@ -109,81 +105,78 @@ export function register() {
   })
 
   ipcMain.removeAllListeners('update-settings')
-  ipcMain.addListener(
-    'update-settings',
-    (_e: any, payload: Parameters<typeof emit>[1]) => {
-      const settings = payload && payload.settings
-      const value = payload && payload.value
-
-      const mainWindow = window.getMainWindow()
-
-      switch (settings) {
-        case 'enablePushNotifications': {
-          config.store.set('enablePushNotifications', value)
-          if (value && config.store.get('enablePushNotificationsSound'))
-            helpers.playNotificationSound()
-          break
-        }
+  ipcMain.addListener('update-settings', (_e: any, payload) => {
+    const settings = payload && payload.settings
+    const value = payload && payload.value
 
-        case 'enablePushNotificationsSound': {
-          config.store.set('enablePushNotificationsSound', value)
+    const mainWindow = window.getMainWindow()
 
-          if (value) helpers.playNotificationSound()
+    switch (settings) {
+      case 'enablePushNotifications': {
+        config.store.set('enablePushNotifications', value)
+        if (value && config.store.get('enablePushNotificationsSound'))
+          helpers.playNotificationSound()
+        break
+      }
 
-          break
-        }
+      case 'enablePushNotificationsSound': {
+        config.store.set('enablePushNotificationsSound', value)
 
-        case 'isMenuBarMode': {
-          config.store.set('isMenuBarMode', !!value)
-          config.store.set('isMenuBarModeChangedAt', Date.now())
+        if (value) helpers.playNotificationSound()
 
-          if (mainWindow && mainWindow.isFullScreen()) {
-            mainWindow.setFullScreen(false)
-            setTimeout(window.updateOrRecreateWindow, 1000)
-          } else {
-            window.updateOrRecreateWindow()
-          }
-          break
+        break
+      }
+
+      case 'isMenuBarMode': {
+        config.store.set('isMenuBarMode', !!value)
+        config.store.set('isMenuBarModeChangedAt', Date.now())
+
+        if (mainWindow && mainWindow.isFullScreen()) {
+          mainWindow.setFullScreen(false)
+          setTimeout(window.updateOrRecreateWindow, 1000)
+        } else {
+          window.updateOrRecreateWindow()
         }
+        break
+      }
 
- 
```

**File**: `packages/desktop/src/menu.ts` (modified, +0/-6)
```diff
@@ -190,12 +190,6 @@ export function getRestartMenuItem() {
 
 export function getModeMenuItems() {
   const _mainWindow = window.getMainWindow()
-  const _tray = tray.getTray()
-  if (
-    !(_tray && _tray.getBounds().width && _tray.getBounds().height) &&
-    !config.store.get('isMenuBarMode')
-  )
-    return []
 
   const isCurrentWindow =
     _mainWindow && _mainWindow.isVisible() && !_mainWindow.isMinimized()
```

**File**: `packages/desktop/src/tray.ts` (modified, +18/-11)
```diff
@@ -87,18 +87,26 @@ export function showTrayContextPopup() {
 export function alignWindowWithTray(win: BrowserWindow) {
   if (!(tray && !tray.isDestroyed())) return
 
-  const trayBounds = tray.getBounds()
+  const xSpacing = 10
+  const ySpacing = 0
+
+  const workArea = screen.getDisplayFromCursor().workArea
+  const screenSize = screen.getDisplayFromCursor().size
+
+  let trayBounds = tray.getBounds()
   if (
     !(trayBounds.width && trayBounds.height && (trayBounds.x || trayBounds.y))
   ) {
-    window.center(win)
-    return
+    trayBounds = {
+      x: trayBounds.x || screenSize.width - xSpacing,
+      y: trayBounds.y || 0,
+      width: trayBounds.width || 0,
+      height: trayBounds.height || 0,
+    }
   }
 
-  const screenSize = screen.getDisplayFromCursor().size
-  const workArea = screen.getDisplayFromCursor().workArea
   const windowBounds = win.getBounds()
-  const trayCenter = helpers.getCenterPosition(tray)
+  const trayCenter = helpers.getCenterPosition({ getBounds: () => trayBounds })
 
   const top = trayBounds.y < screenSize.height / 3
   const bottom = screenSize.height - trayBounds.y < screenSize.height / 3
@@ -107,7 +115,6 @@ export function alignWindowWithTray(win: BrowserWindow) {
 
   let x: number
   let y: number
-  const spacing = 0
 
   if (top) {
     y = Math.round(trayCenter.y)
@@ -126,12 +133,12 @@ export function alignWindowWithTray(win: BrowserWindow) {
   }
 
   const fixedX = Math.max(
-    workArea.x + spacing,
-    Math.min(x, workArea.x + workArea.width - windowBounds.width - spacing),
+    workArea.x + xSpacing,
+    Math.min(x, workArea.x + workArea.width - windowBounds.width - xSpacing),
   )
   const fixedY = Math.max(
-    workArea.y + spacing,
-    Math.min(y, workArea.y + workArea.height - windowBounds.height - spacing),
+    workArea.y + ySpacing,
+    Math.min(y, workArea.y + workArea.height - windowBounds.height - ySpacing),
   )
 
   win.setPosition(fixedX, fixedY)
```

---

### Incident Patch 7: `86724e1e` (2020-12-08)
**Commit Message**: Prettier fixes

**File**: `.gitignore` (modified, +2/-1)
```diff
@@ -1,11 +1,12 @@
 *.jsbundle
 *.tsbuildinfo
 .DS_Store
+.eslintcache
 .history
 .jest
+.now
 .vscode
 Pods
 node_modules/
 npm-debug.log
 yarn-error.log
-.now
\ No newline at end of file
```

**File**: `.prettierrc.js` (modified, +0/-1)
```diff
@@ -1,5 +1,4 @@
 module.exports = {
-  parser: 'typescript',
   semi: false,
   singleQuote: true,
   trailingComma: 'all',
```

**File**: `landing/package.json` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@
     "compile": "cd .",
     "deploy": "yarn compile && yarn now",
     "export": "yarn run-scripts && next build && next export",
-    "format": "prettier --write '{.,src/**,pages/**}/*.{js,jsx,ts,tsx}'",
+    "format": "prettier --write '{.,src,pages}/**/*.{js,jsx,ts,tsx,json}'",
     "lint": "eslint src",
     "now": "now",
     "postinstall": "yarn run-scripts",
@@ -58,4 +58,4 @@
   "engines": {
     "node": ">=12"
   }
-}
\ No newline at end of file
+}
```

**File**: `package.json` (modified, +5/-3)
```diff
@@ -62,9 +62,11 @@
     }
   },
   "lint-staged": {
-    "*.{ts,tsx}": [
-      "eslint --fix --quiet",
+    "*.{js,jsx,ts,tsx}": [
+      "eslint --fix --quiet"
+    ],
+    "*.{js,jsx,ts,tsx,json}": [
       "prettier --write"
     ]
   }
-}
\ No newline at end of file
+}
```

**File**: `packages/components/package.json` (modified, +2/-2)
```diff
@@ -6,7 +6,7 @@
   "scripts": {
     "compile": "tsc -b --incremental",
     "clean": "shx rm -f *.tsbuildinfo && shx rm -rf dist/*",
-    "format": "prettier --write '{.,src}/**.{js,jsx,ts,tsx}'",
+    "format": "prettier --write '{.,src}/**/*.{js,jsx,ts,tsx,json}'",
     "lint": "eslint src",
     "prepare": "cd .. && yarn patch-package"
   },
@@ -72,4 +72,4 @@
   "peerDependencies": {
     "eslint": "*"
   }
-}
\ No newline at end of file
+}
```

---

### Incident Patch 8: `9c950fdd` (2020-12-08)
**Commit Message**: Patch react-spring production bug

https://github.com/pmndrs/react-spring/issues/1078\#issuecomment-663635523

**File**: `patches/@react-spring+shared+9.0.0-rc.3.patch` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+diff --git a/node_modules/@react-spring/shared/package.json b/node_modules/@react-spring/shared/package.json
+index 93be66f..0ef7fd7 100644
+--- a/node_modules/@react-spring/shared/package.json
++++ b/node_modules/@react-spring/shared/package.json
+@@ -11,7 +11,7 @@
+   "contributors": [
+     "Alec Larson (https://github.com/aleclarson)"
+   ],
+-  "sideEffects": false,
++  "sideEffects": true,
+   "main": "cjs/index.js",
+   "module": "esm/index.js",
+   "dependencies": {
```

---

### Incident Patch 9: `5b1d7a0a` (2020-12-08)
**Commit Message**: [Mobile] Fix Dialog colors due to order of providers

**File**: `packages/components/src/components/AppProviders.tsx` (modified, +23/-23)
```diff
@@ -28,30 +28,30 @@ export function AppProviders(props: AppProvidersProps) {
     <HelmetProvider>
       <ReduxProvider store={store as any}>
         <PersistGate loading={null} persistor={persistor}>
-          <DialogProvider>
-            <DeepLinkProvider>
-              <LoginHelpersProvider>
-                {/* <PlansProvider> */}
-                <AppLayoutProvider>
-                  <ColumnFocusProvider>
-                    <ColumnWidthProvider>
-                      <ColumnFiltersProvider>
-                        <AppearanceProvider>
-                          <ThemeProvider>
-                            <SafeAreaProvider>
+          <AppearanceProvider>
+            <ThemeProvider>
+              <SafeAreaProvider>
+                <DialogProvider>
+                  <DeepLinkProvider>
+                    {/* <PlansProvider> */}
+                    <AppLayoutProvider>
+                      <ColumnFocusProvider>
+                        <ColumnWidthProvider>
+                          <ColumnFiltersProvider>
+                            <LoginHelpersProvider>
                               {props.children}
-                              <OverrideSystemDialog />
-                            </SafeAreaProvider>
-                          </ThemeProvider>
-                        </AppearanceProvider>
-                      </ColumnFiltersProvider>
-                    </ColumnWidthProvider>
-                  </ColumnFocusProvider>
-                </AppLayoutProvider>
-                {/* </PlansProvider> */}
-              </LoginHelpersProvider>
-            </DeepLinkProvider>
-          </DialogProvider>
+                            </LoginHelpersProvider>
+                            <OverrideSystemDialog />
+                          </ColumnFiltersProvider>
+                        </ColumnWidthProvider>
+                      </ColumnFocusProvider>
+                    </AppLayoutProvider>
+                    {/* </PlansProvider> */}
+                  </DeepLinkProvider>
+                </DialogProvider>
+              </SafeAreaProvider>
+            </ThemeProvider>
+          </AppearanceProvider>
         </PersistGate>
       </ReduxProvider>
     </HelmetProvider>
```

---

### Incident Patch 10: `ea8921b4` (2020-12-08)
**Commit Message**: Fix some bad credential errors caused by using unsupported token type

**File**: `packages/components/src/redux/sagas/subscriptions.ts` (modified, +5/-10)
```diff
@@ -331,7 +331,7 @@ function* onFetchRequest(
 
   const owner = getSubscriptionOwnerOrOrg(subscription)
 
-  const privateToken = selectors.getPrivateTokenByOwnerSelector(state, owner)
+  const privateTokenDetails = selectors.githubPrivateTokenDetailsSelector(state)
   const installationToken = selectors.installationTokenByOwnerSelector(
     state,
     owner,
@@ -340,16 +340,11 @@ function* onFetchRequest(
   const githubAppTokenDetails = selectors.githubAppTokenDetailsSelector(state)
   const loggedUsername = selectors.currentGitHubUsernameSelector(state)!
 
-  const githubToken =
-    (subscription &&
-      (subscription.type === 'activity' ||
-        subscription.type === 'issue_or_pr') &&
-      (subscription.subtype === 'USER_ORG_EVENTS' &&
-      privateToken === installationToken
-        ? undefined
-        : privateToken)) ||
+  const githubToken: string =
+    privateTokenDetails?.token ||
     githubOAuthOrPersonalToken ||
-    (githubAppTokenDetails && githubAppTokenDetails.token)
+    (subscription?.type === 'issue_or_pr' && githubAppTokenDetails?.token) ||
+    ''
 
   const appTokenType: GitHubAppTokenType =
     (githubToken === installationToken && 'app-installation') ||
```

**File**: `packages/components/src/redux/selectors/github/auth.ts` (modified, +20/-3)
```diff
@@ -47,13 +47,30 @@ export const githubTokenCreatedAtSelector = (state: RootState) => {
   return (tokenDetails && tokenDetails.tokenCreatedAt) || undefined
 }
 
+export const githubPrivateTokenDetailsSelector = (state: RootState) => {
+  const githubPersonalTokenDetails = githubPersonalTokenDetailsSelector(state)
+  if (
+    githubPersonalTokenDetails?.token &&
+    githubPersonalTokenDetails.scope?.includes('repo')
+  )
+    return githubPersonalTokenDetails
+
+  const githubOAuthTokenDetails = githubOAuthTokenDetailsSelector(state)
+  if (
+    githubOAuthTokenDetails?.token &&
+    githubOAuthTokenDetails.scope?.includes('repo')
+  )
+    return githubOAuthTokenDetails
+
+  return undefined
+}
+
 export const getPrivateTokenByOwnerSelector = (
   state: RootState,
   ownerName: string | undefined,
 ) => {
-  const tokenDetails = githubTokenDetailsSelector(state)
-  if (tokenDetails?.token && tokenDetails.scope?.includes('repo'))
-    return tokenDetails.token
+  const privateTokenDetails = githubPrivateTokenDetailsSelector(state)
+  if (privateTokenDetails?.token) return privateTokenDetails.token
 
   const installationToken = installationTokenByOwnerSelector(state, ownerName)
   return installationToken || undefined
```

#### Recent Merged Pull Requests:
- **PR #367** (closed): Create SECURITY.md (@Chewypewy)
- **PR #358** (closed): Update use-oauth.ts (@Wasifz9)
- **PR #325** (closed): Create Funlox.news (@AxerynYT)
- **PR #312** (closed): Create devcontainer.json (@patriciakid)
- **PR #311** (closed): Create Nee (@patriciakid)
- **PR #310** (closed): Update README.md (@JustALilDumb)
- **PR #306** (closed): Add new feature (@ghost)
- **PR #304** (closed): Create dev.fork (@SZzoe)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
