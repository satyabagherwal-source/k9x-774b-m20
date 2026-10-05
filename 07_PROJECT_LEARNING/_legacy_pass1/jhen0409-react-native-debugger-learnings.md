# Forensic Learning Record (Deep Inspection): jhen0409/react-native-debugger

> **Canonical Artifact**: `07_PROJECT_LEARNING/jhen0409-react-native-debugger-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jhen0409/react-native-debugger](https://github.com/jhen0409/react-native-debugger))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:35:17.039Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jhen0409/react-native-debugger`
- **Description**: The standalone app based on official debugger of React Native, and includes React Inspector / Redux DevTools
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10439 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `__e2e__/fixture/apollo.js`
```
/* eslint-disable import/no-extraneous-dependencies */
/*
 * Create an Apollo Client to test the bridge messages sent
 * wouldn't break the debugger proxy.
 */

import { ApolloClient, InMemoryCache } from '@apollo/client'
import gql from 'graphql-tag'

const client = new ApolloClient({
  uri: 'https://spacex-production.up.railway.app/',
  cache: new InMemoryCache(),
})

export default async function run() {
  return client.query({
    query: gql`
      query ExampleQuery {
        company {
          name
          ceo
          employees
        }
      }
    `,
  })
}

```

### Core Architecture Module: `__e2e__/fixture/app.js`
```
import './setup'

import runXHRTest from './xhr-test' // Install fetch polyfill before initial apollo-client
import runApolloTest from './apollo'
import runReduxTest from './redux'
import runMobXTest from './mobx'
import runRemoteDevTest from './remotedev'

runReduxTest()
runMobXTest()
runRemoteDevTest()
runApolloTest().catch((e) => console.error(e))
runXHRTest().catch((e) => console.error(e))

```

### Core Architecture Module: `__e2e__/fixture/mobx.js`
```
/* eslint prefer-arrow-callback: 0 */
import { observable, action, useStrict } from 'mobx'
import remotedev from 'mobx-remotedev/lib/dev'

useStrict(true)

export default function run() {
  const store = observable({ value: 0 })
  store.testPassForMobXStore1 = action(function testPassForMobXStore1() {})

  remotedev(store, { name: 'MobX store instance 1' }).testPassForMobXStore1()

  const store2 = observable({ value: 1 })
  store2.testPassForMobXStore2 = action(function testPassForMobXStore2() {})

  remotedev(store2, { name: 'MobX store instance 2' }).testPassForMobXStore2()
}

```

### Core Architecture Module: `__e2e__/fixture/redux.js`
```
/* eslint no-underscore-dangle: 0 */

import { createStore } from 'redux'

export default function run() {
  // Enhancer
  const store1 = createStore(
    (state) => state,
    { value: 0 },
    window.__REDUX_DEVTOOLS_EXTENSION__({
      name: 'Redux store instance 1',
      actionsWhitelist: ['@@INIT', 'TEST_PASS_FOR_REDUX_STORE_1', '^SHOW_FOR_REDUX_STORE_1$'],
    }),
  )

  // Compose enhancers
  const store2 = createStore(
    (state) => state,
    { value: 1 },
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
      name: 'Redux store instance 2',
      actionsBlacklist: ['NOT_SHOW_1_FOR_REDUX_STORE_2', 'NOT_SHOW_2_FOR_REDUX_STORE_2'],
      predicate: (state, action) => action.type !== 'NOT_SHOW_3_FOR_REDUX_STORE_2',
    })(/* No enhancers */),
  )

  store1.dispatch({ type: 'TEST_PASS_FOR_REDUX_STORE_1' })
  store1.dispatch({ type: 'SHOW_FOR_REDUX_STORE_1' })
  store1.dispatch({ type: 'NOT_SHOW_FOR_REDUX_STORE_1' })

  store2.dispatch({ type: 'TEST_PASS_FOR_REDUX_STORE_2' })
  store2.dispatch({ type: 'NOT_SHOW_1_FOR_REDUX_STORE_2' })
  store2.dispatch({ type: 'NOT_SHOW_2_FOR_REDUX_STORE_2' })
  store2.dispatch({ type: 'NOT_SHOW_3_FOR_REDUX_STORE_2' })
}

```

### Core Architecture Module: `__e2e__/fixture/remotedev.js`
```
import { createStore } from 'redux'

const connectViaExtension = window.devToolsExtension.connect

const logReducer = (reducer) => {
  const remotedev = connectViaExtension({
    name: 'RemoteDev store instance 1',
    actionCreators: {
      test: () => {},
    },
  })
  return (state, action) => {
    const reducedState = reducer(state, action)
    remotedev.send(action, reducedState)
    return reducedState
  }
}

const logRemotely = (next) => (reducer, initialState) => next(logReducer(reducer), initialState)

export default function run() {
  const store = logRemotely(createStore)((state) => state, { value: 0 })

  store.dispatch({ type: 'TEST_PASS_FOR_REMOTEDEV_STORE_1' })
}

```

### Core Architecture Module: `__e2e__/fixture/setup.js`
```
/* eslint-disable no-restricted-globals */
/* eslint no-underscore-dangle: 0 */

self.window = global

// Remove native fetch as react-native use whatwg-fetch polyfill
self.fetch = undefined

const MessageQueue = function MessageQueue() {}
MessageQueue.spy = () => {}
MessageQueue.prototype.__spy = null

const requiredModules = {
  NativeModules: {},
  Platform: {},
  setupDevtools: undefined,
  AsyncStorage: {},
  MessageQueue,
}
// Simulate React Native's window.require polyfill
window.require = (moduleName) => {
  if (typeof moduleName !== 'number') {
    // From https://github.com/facebook/react-native/blob/5403946f098cc72c3d33ea5cee263fb3dd03891d/packager/src/Resolver/polyfills/require.js#L97
    console.warn(
      `Requiring module '${moduleName}' by name is only supported for `
        + 'debugging purposes and will BREAK IN PRODUCTION!',
    )
  }
  return requiredModules[moduleName]
}
window.__DEV__ = true
window.__fbBatchedBridge = new MessageQueue()

```

### Core Architecture Module: `__e2e__/mockRNServer.js`
```
import http from 'http'
import WebSocket from 'ws'

export default function createMockRNServer(port = 8081) {
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/debugger-ui') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html></html>')
    }
  })
  const wss = new WebSocket.Server({ server })
  server.listen(port)
  return { server, wss }
}

```

### Core Architecture Module: `app/actions/debugger.js`
```
export const SET_DEBUGGER_LOCATION = 'SET_DEBUGGER_LOCATION'
export const SET_DEBUGGER_STATUS = 'SET_DEBUGGER_STATUS'
export const SET_DEBUGGER_WORKER = 'SET_DEBUGGER_WORKER'
export const SYNC_STATE = 'SYNC_STATE'
export const BEFORE_WINDOW_CLOSE = 'BEFORE_WINDOW_CLOSE'

export const setDebuggerLocation = (loc) => ({
  type: SET_DEBUGGER_LOCATION,
  loc,
})

export const setDebuggerStatus = (status) => ({
  type: SET_DEBUGGER_STATUS,
  status,
})

export const setDebuggerWorker = (worker, status) => ({
  type: SET_DEBUGGER_WORKER,
  worker,
  status,
})

export const syncState = (payload) => ({
  type: SYNC_STATE,
  payload,
})

export const beforeWindowClose = () => ({
  type: BEFORE_WINDOW_CLOSE,
})

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #565** (2021-01-13): **Apollo Dev Tools don't refresh data**
  *Symptoms*: I'm not able to see whats in my cache via apollo dev tools. ![image](https://user-images.githubusercontent.com/7379922/103500627-b8ac5380-4e9f-11eb-81ec-7b6a27cd9255.png)  However I can see the cache if I run __APOLLO_CLIENT__.cache.data.data in the console, so the data is there. ![image](https://user-images.githubusercontent.com/7379922/103500651-d24d9b00-4e9f-11eb-805f-3259e507d6b1.png)  I found a similar issue in apollo-client-devtools repo: https://github.com/apollographql/apollo-client-devtools/issues/294  The above issue is resolved in v2.3.4 https://github.com/apollographql/apollo-client-devtools/pull/321  I think we need to bump up the Apollo dev tool to the latest. 

- **Issue #564** (2023-07-21): **`rndebugger-open` makes no action on RN 0.63.3**
  *Symptoms*: React Native Debugger app version: 0.11.6 react-native-debugger-open: 0.3.25 react-native: 0.63.3 @react-native-community/cli: 4.13.0 @react-native-community/cli-server-api: 4.13.0 Platform: iOS Is real device of platform: No Operating System: macOS  This is bit similar to #328, however in this case`rndebugger-open` command silently passes without making any patch.  Latest `0.3.25` version doesn't seem to support latest `@react-native-community` version as its structure has changed and apparently patch script should now target `cli-server-api` package rather than `cli`, meanwhile none of the `rnFlags` point to new location.  Also, I think result of this line https://github.com/jhen0409/react-native-debugger/blob/master/npm-package/src/injectDevToolsMiddleware.js#L183 should be returned (as well as the other branch of the same condition). Otherwise, as in described scenario, it returns `false`, however inject function returns `true` even though patch wasn't successful:  ```javascript return (Array.isArray(flagList) ? flagList : [flagList]).some(flag => injectCode(modulePath, flag)); ```

- **Issue #507** (2020-05-05): **ReactInspector: Fix layout update issue if backend try to reconnect**
  *Symptoms*: Related #494.  NOTE: This just fixed the inspector UI update issue, but not for the console errors. (it's upstream issue)

- **Issue #506** (2020-05-05): **Check module isn't null on lookupForRNModules**
  *Symptoms*: Closes #500.

- **Issue #505** (2020-05-05): **Fix setTouchBar due to API change**
  *Symptoms*: Closes #495.

- **Issue #503** (2020-05-05): **Fix inspector style issue on Electron >= v8.0**
  *Symptoms*: Closes #502.

- **Issue #502** (2020-05-05): **[UI chaos]  ui layer error**
  *Symptoms*:  ![image](https://user-images.githubusercontent.com/29938227/80173125-73056e80-8621-11ea-90b6-b0185881a5d2.png)   React Native Debugger app version: [0.11.1] React Native version: [0.62.2] Operating System: [macOs]  <!-- Love react-native-debugger? Please consider supporting our collective: 👉  https://opencollective.com/react-native-debugger/donate --> 
  **Post-Mortem & Fix Analysis**:
  > Same here

- **Issue #500** (2020-05-05): **React-native app with polyfills limits debug functionalities**
  *Symptoms*: <!-- Before submitting the issue:  - You're using the latest version of react-native-debugger - You have read the documentation - For the feature requests / issues of devtools integration like React / Redux / Apollo, you should submit an issue to that repo   - https://github.com/facebook/react-devtools/issues   - https://github.com/reduxjs/redux-devtools/issues   - https://github.com/apollographql/apollo-client-devtools/issues -->  <!-- Please provide the following information for bug report or question, if you can provide a minimal example project or screenshot or even video would be helpful for reproduce the problem. You can just removed these if you want to submit a feature request: -->  React Native Debugger app version: 0.10.7 React Native version: 0.61.4 Platform: android (need to test on iOS) Is real device of platform: yes Operating System: macOS (need to test on other OS)  In a react-native app, adding this (requiring core-js polyfills) to the start of the entrypoint index.js: ```javascript import 'core-js/stable'; import 'regenerator-runtime/runtime'; ```  Will limit some of the functionalities of React Native Debugger such as: - reloading the app from the debugger - see react-native native modules from the js console of the debugger - toggle the inspector from the debugger  Expected: React Native Debugger should detect this case and handle it in order not to lose the functionalities described above.  <!-- Love react-native-debugge
  **Post-Mortem & Fix Analysis**:
  > In comparison, debugging using `http://localhost:8081/debugger-ui/` on Chrome works as intended (reload the app button works).

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

### Incident Patch 1: `988fae8c` (2023-07-30)
**Commit Message**: Revert patch of apollo-client-devtools in dist/

**File**: `dist/patches/apollo-client-devtools+4.1.4.patch` (added, +254/-0)
```diff
@@ -0,0 +1,254 @@
+diff --git a/node_modules/apollo-client-devtools/build/background.js b/node_modules/apollo-client-devtools/build/background.js
+index 1b46d15..5767881 100644
+--- a/node_modules/apollo-client-devtools/build/background.js
++++ b/node_modules/apollo-client-devtools/build/background.js
+@@ -171,21 +171,21 @@ chrome.runtime.onConnect.addListener(port => {
+ 
+ Object.defineProperty(exports, "__esModule", ({ value: true }));
+ exports.RELOAD_TAB_COMPLETE = exports.RELOADING_TAB = exports.EXPLORER_RESPONSE = exports.EXPLORER_REQUEST = exports.PANEL_CLOSED = exports.PANEL_OPEN = exports.UPDATE = exports.REQUEST_DATA = exports.ACTION_HOOK_FIRED = exports.CREATE_DEVTOOLS_PANEL = exports.APOLLO_CLIENT_FOUND = exports.FIND_APOLLO_CLIENT = exports.DEVTOOLS_INITIALIZED = exports.REQUEST_TAB_ID = exports.CLIENT_FOUND = void 0;
+-exports.CLIENT_FOUND = "client-found";
+-exports.REQUEST_TAB_ID = "request-tab-id";
+-exports.DEVTOOLS_INITIALIZED = "devtools-initialized";
+-exports.FIND_APOLLO_CLIENT = "find-apollo-client";
+-exports.APOLLO_CLIENT_FOUND = "apollo-client-found";
+-exports.CREATE_DEVTOOLS_PANEL = "create-devtools-panel";
+-exports.ACTION_HOOK_FIRED = "action-hook-fired";
+-exports.REQUEST_DATA = "request-data";
+-exports.UPDATE = "update";
+-exports.PANEL_OPEN = "panel-open";
+-exports.PANEL_CLOSED = "panel-closed";
+-exports.EXPLORER_REQUEST = "explorer-request";
+-exports.EXPLORER_RESPONSE = "explorer-response";
+-exports.RELOADING_TAB = "reloading-tab";
+-exports.RELOAD_TAB_COMPLETE = "reload-tab-complete";
++exports.CLIENT_FOUND = "ac-devtools:client-found";
++exports.REQUEST_TAB_ID = "ac-devtools:request-tab-id";
++exports.DEVTOOLS_INITIALIZED = "ac-devtools:devtools-initialized";
++exports.FIND_APOLLO_CLIENT = "ac-devtools:find-apollo-client";
++exports.APOLLO_CLIENT_FOUND = "ac-devtools:apollo-client-found";
++exports.CREATE_DEVTOOLS_PANEL = "ac-devtools:create-devtools-panel";
++exports.ACTION_HOOK_FIRED = "ac-devtools:action-hook-fired";
++exports.REQUEST_DATA = "ac-devtools:request-data";
++exports.UPDATE = "ac-devtools:update";
++exports.PANEL_OPEN = "ac-devtools:panel-open";
++exports.PANEL_CLOSED = "ac-devtools:panel-closed";
++exports.EXPLORER_REQUEST = "ac-devtools:explorer-request";
++exports.EXPLORER_RESPONSE = "ac-devtools:explorer-response";
++exports.RELOADING_TAB = "ac-devtools:reloading-tab";
++exports.RELOAD_TAB_COMPLETE = "ac-devtools:reload-tab-complete";
+ 
+ 
+ /***/ })
+diff --git a/node_modules/apollo-client-devtools/build/devtools.js b/node_modules/apollo-client-devtools/build/devtools.js
+index 165495f..8290715 100644
+--- a/node_modules/apollo-client-devtools/build/devtools.js
++++ b/node_modules/apollo-client-devtools/build/devtools.js
+@@ -165,22 +165,21 @@ exports["default"] = EventTarget;
+ 
+ Object.defineProperty(exports, "__esModule", ({ value: true }));
+ exports.RELOAD_TAB_COMPLETE = exports.RELOADING_TAB = exports.EXPLORER_RESPONSE = exports.EXPLORER_REQUEST = exports.PANEL_CLOSED = exports.PANEL_OPEN = exports.UPDATE = exports.REQUEST_DATA = exports.ACTION_HOOK_FIRED = exports.CREATE_DEVTOOLS_PANEL = exports.APOLLO_CLIENT_FOUND = exports.FIND_APOLLO_CLIENT = exports.DEVTOOLS_INITIALIZED = exports.REQUEST_TAB_ID = exports.CLIENT_FOUND = void 0;
+-exports.CLIENT_FOUND = "client-found";
+-exports.REQUEST_TAB_ID = "request-tab-id";
+-exports.DEVTOOLS_INITIALIZED = "devtools-initialized";
+-exports.FIND_APOLLO_CLIENT = "find-apollo-client";
+-exports.APOLLO_CLIENT_FOUND = "apollo-client-found";
+-exports.CREATE_DEVTOOLS_PANEL = "create-devtools-panel";
+-exports.ACTION_HOOK_FIRED = "action-hook-fired";
+-exports.REQUEST_DATA = "request-data";
+-exports.UPDATE = "update";
+-exports.PANEL_OPEN = "panel-open";
+-exports.PANEL_CLOSED = "panel-closed";
+-exports.EXPLORER_REQUEST = "explorer-request";
+-exports.EXPLORER_RESPONSE = "explorer-response";
+-exports.RELOADING_TAB = "reloading-tab";
+-exports.RELOAD_TAB_COMPLETE = "reload-tab-complete";
+-
++exports.CLIENT_FOUND = "ac-d
```

---

### Incident Patch 2: `7a01a43e` (2023-07-30)
**Commit Message**: Fix host of adb client on electron 25 (node 18)

**File**: `app/utils/adb.js` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 import adb from 'adbkit'
 
-export const client = adb.createClient()
+export const client = adb.createClient({ host: '127.0.0.1' })
 
 const reverse = (device, port) => client.reverse(device, `tcp:${port}`, `tcp:${port}`)
 
```

---

### Incident Patch 3: `9146b413` (2023-07-30)
**Commit Message**: Revert "Use styled-components for global styles"

**File**: `app/globalStyles.js` (modified, +1/-45)
```diff
@@ -1,50 +1,6 @@
 import { css, createGlobalStyle } from 'styled-components'
 
-const commonStyles = css`
-  html,
-  body {
-    font-family: monaco, Consolas, Lucida Console, monospace;
-    overflow: hidden;
-    font-size: 100%;
-    margin: 0;
-    padding: 0;
-    width: 100%;
-    height: 100%;
-    background-color: rgb(53, 59, 70);
-  }
-
-  #root {
-    width: 100%;
-    height: 100%;
-  }
-  #logs {
-    position: fixed;
-    top: 0;
-    left: 0;
-    white-space: pre;
-  }
-  #loading {
-    color: #aaa;
-    font-size: 30px;
-    display: flex;
-    height: 100%;
-    justify-content: center;
-    align-items: center;
-  }
-
-  @media print {
-    @page {
-      size: auto;
-      margin: 0;
-    }
-    body {
-      position: static;
-    }
-  }
-  .CodeMirror {
-    font-family: monaco, Consolas, Lucida Console, monospace !important;
-  }
-`
+const commonStyles = css``
 
 export const GlobalStyle =
   process.platform !== 'darwin'
```

**File**: `dist/app.html` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
   <head>
     <meta charset=utf-8>
     <title>React Native Debugger</title>
+    <link href='css/style.css' rel="stylesheet" />
   </head>
   <body>
     <div id="root">
```

**File**: `dist/css/style.css` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+html,
+body {
+  font-family: monaco, Consolas, Lucida Console, monospace;
+  overflow: hidden;
+  font-size: 100%;
+  margin: 0;
+  padding: 0;
+  width: 100%;
+  height: 100%;
+  background-color: rgb(53, 59, 70);
+}
+
+#root {
+  width: 100%;
+  height: 100%;
+}
+#logs {
+  position: fixed;
+  top: 0;
+  left: 0;
+  white-space: pre;
+}
+#loading {
+  color: #aaa;
+  font-size: 30px;
+  display: flex;
+  height: 100%;
+  justify-content: center;
+  align-items: center;
+}
+
+::-webkit-scrollbar {
+  width: 8px;
+  height: 8px;
+  background-color: #555;
+}
+::-webkit-scrollbar-thumb {
+  background-color: #333;
+}
+::-webkit-scrollbar-corner {
+  background-color: #333;
+}
+
+@media print {
+  @page {
+    size: auto;
+    margin: 0;
+  }
+  body {
+    position: static;
+  }
+}
+.CodeMirror {
+  font-family: monaco, Consolas, Lucida Console, monospace !important;
+}
```

**File**: `electron/app.html` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
   <head>
     <meta charset=utf-8>
     <title>React Native Debugger</title>
+    <link href='../dist/css/style.css' rel="stylesheet" />
   </head>
   <body>
     <div id="root">
```

---

### Incident Patch 4: `fe185790` (2023-07-29)
**Commit Message**: Redux DevTools: Fix overflow

**File**: `app/containers/redux/DevTools.js` (modified, +5/-2)
```diff
@@ -1,11 +1,14 @@
 import React from 'react'
 import { useSelector, useDispatch } from 'react-redux'
+import styled from 'styled-components'
 import { Container, Notification } from '@redux-devtools/ui'
 import { clearNotification } from '@redux-devtools/app/lib/esm/actions'
 import Actions from '@redux-devtools/app/lib/esm/containers/Actions'
 import Settings from './Settings'
 import Header from './Header'
 
+const StyledContainer = styled(Container)`overflow: hidden;`
+
 function App() {
   const section = useSelector((state) => state.section)
   const theme = useSelector((state) => state.theme)
@@ -23,7 +26,7 @@ function App() {
   }
 
   return (
-    <Container themeData={theme}>
+    <StyledContainer themeData={theme}>
       <Header section={section} />
       {body}
       {notification && (
@@ -34,7 +37,7 @@ function App() {
           {notification.message}
         </Notification>
       )}
-    </Container>
+    </StyledContainer>
   )
 }
 
```

---

### Incident Patch 5: `a3eacd67` (2023-07-28)
**Commit Message**: Fix source map warning from react-devtools

**File**: `scripts/patch-modules.js` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+const shell = require('shelljs')
+const path = require('path')
+
+console.log('Patch react-devtools-core')
+
+const rdStandalone = path.join(
+  __dirname,
+  '../dist/node_modules/react-devtools-core/dist/standalone.js',
+)
+
+// Avoid source map not found war
+shell.sed(
+  '-i',
+  /sourceMappingURL=importFile\.worker\.worker\.js\.map'\]\)\),\{name:"\[name\]\.worker\.js/g,
+  `sourceMappingURL_NotUsed=importFile.worker.worker.js.map'])),{name:"ReactDevToolsImportFile.worker.js`,
+  rdStandalone,
+)
```

**File**: `scripts/postinstall.js` (modified, +2/-0)
```diff
@@ -15,6 +15,8 @@ async function run() {
     '-rf',
     'node_modules/apollo-client-devtools/{assets,build,development,shells/dev,src}',
   )
+  // eslint-disable-next-line
+  require('./patch-modules')
 }
 
 run()
```

---

### Incident Patch 6: `569b3c74` (2023-07-26)
**Commit Message**: Fix react root render

**File**: `app/index.js` (modified, +0/-1)
```diff
@@ -43,7 +43,6 @@ const handleReady = () => {
           <App />
         </PersistGate>
       </Provider>,
-      document.getElementById('root'),
     )
   })
 };
```

---

### Incident Patch 7: `4345db48` (2023-07-23)
**Commit Message**: Fix react-devtools projectRoots parse

**File**: `electron/url-handle/handleURL.js` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ export const parseUrl = _url => {
   const query = {
     host: resolveHost(host),
     port: Number(port) || 8081,
-    projectRoots: Array.isArray(projectRoots) ? filterPaths(projectRoots.split(',')) : undefined,
+    projectRoots: filterPaths(Array.isArray(projectRoots) ? projectRoots : [projectRoots]),
   };
   return query;
 };
```

**File**: `npm-package/src/injectDevToolsMiddleware.js` (modified, +2/-1)
```diff
@@ -91,7 +91,8 @@ const rnFlags = {
       replaceFunc:
         "function launchDefaultDebugger(host, port, args = '', skipRNDebugger) {",
       funcCall: '(host, port, args, true)',
-      args: "(host || 'localhost') + '&port=' + port + '&args=' + args",
+      args: "(host || 'localhost') + '&port=' + port + '&projectRoots=' + process.cwd() + " +
+        "'&args=' + args",
     },
   ],
 };
```

---

### Incident Patch 8: `05f42b59` (2023-07-23)
**Commit Message**: Revert "Fix react-devtools not auto detect system theme"

This reverts commit 98ed518bdc5e365a3e8ed812842ce4f747a15f3b.

**File**: `scripts/patch-modules.js` (removed, +0/-19)
```diff
@@ -1,19 +0,0 @@
-const shell = require('shelljs');
-const path = require('path');
-
-console.log('Patch react-devtools-core');
-
-const rdStandalone = path.join(
-  __dirname,
-  '../dist/node_modules/react-devtools-core/dist/standalone.js'
-);
-
-// Make react-devtools-core to auto detect theme
-// We still use this patch because patch-package to patch js bundle is not very ideal
-shell.sed(
-  '-i',
-  // eslint-disable-next-line
-  /bridge:e,browserTheme:t="light"/,
-  'bridge:e,browserTheme:t="auto"',
-  rdStandalone
-);
```

**File**: `scripts/postinstall.js` (modified, +0/-2)
```diff
@@ -15,8 +15,6 @@ async function run() {
     '-rf',
     'node_modules/apollo-client-devtools/{assets,build,development,shells/dev,src}'
   );
-  // eslint-disable-next-line
-  require('./patch-modules');
 }
 
 run();
```

---

### Incident Patch 9: `98ed518b` (2023-07-23)
**Commit Message**: Fix react-devtools not auto detect system theme

**File**: `scripts/patch-modules.js` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+const shell = require('shelljs');
+const path = require('path');
+
+console.log('Patch react-devtools-core');
+
+const rdStandalone = path.join(
+  __dirname,
+  '../dist/node_modules/react-devtools-core/dist/standalone.js'
+);
+
+// Make react-devtools-core to auto detect theme
+// We still use this patch because patch-package to patch js bundle is not very ideal
+shell.sed(
+  '-i',
+  // eslint-disable-next-line
+  /bridge:e,browserTheme:t="light"/,
+  'bridge:e,browserTheme:t="auto"',
+  rdStandalone
+);
```

**File**: `scripts/postinstall.js` (modified, +2/-0)
```diff
@@ -15,6 +15,8 @@ async function run() {
     '-rf',
     'node_modules/apollo-client-devtools/{assets,build,development,shells/dev,src}'
   );
+  // eslint-disable-next-line
+  require('./patch-modules');
 }
 
 run();
```

---

### Incident Patch 10: `8cc850b6` (2023-07-22)
**Commit Message**: Fix devtools left toolbar not removed

**File**: `electron/devtools.js` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ export const removeUnecessaryTabs = win => {
         tabbedPane.closeTab('audits2');
         tabbedPane.closeTab('lighthouse');
 
-        tabbedPane._leftToolbar._contentElement.remove();
+        tabbedPane.leftToolbar().element.remove();
       }
     })()`);
   }
```

#### Recent Merged Pull Requests:
- **PR #791** (closed): Bump electron from 25.3.0 to 25.8.1 (@dependabot[bot])
- **PR #790** (closed): Bump electron from 25.3.0 to 25.5.0 (@dependabot[bot])
- **PR #783** (2023-07-28): Upgrade apollo-client-devtools to v4 (@jhen0409)
- **PR #782** (2023-07-25): Bump ESLint & related deps (@jhen0409)
- **PR #781** (2023-07-25): Upgrade @redux-devtools/app (previously remotedev-app) to latest version (@jhen0409)
- **PR #780** (closed): Bump json5 and expo in /examples/test-old-bridge (@dependabot[bot])
- **PR #779** (closed): Bump xml2js and expo in /examples/test-old-bridge (@dependabot[bot])
- **PR #778** (2023-07-22): Upgrade dev dependencies (@jhen0409)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
