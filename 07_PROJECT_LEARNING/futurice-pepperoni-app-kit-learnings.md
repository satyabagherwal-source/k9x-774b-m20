# Forensic Learning Record (Deep Inspection): futurice/pepperoni-app-kit

> **Canonical Artifact**: `07_PROJECT_LEARNING/futurice-pepperoni-app-kit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/futurice/pepperoni-app-kit](https://github.com/futurice/pepperoni-app-kit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:49:27.444Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `futurice/pepperoni-app-kit`
- **Description**: Pepperoni - React Native App Starter Kit for Android and iOS
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4596 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/modules/counter/CounterState.js`
```
import {Map} from 'immutable';
import {loop, Effects} from 'redux-loop-symbol-ponyfill';
import {generateRandomNumber} from '../../services/randomNumberService';

// Initial state
const initialState = Map({
  value: 0,
  loading: false
});

// Actions
const INCREMENT = 'CounterState/INCREMENT';
const RESET = 'CounterState/RESET';
const RANDOM_REQUEST = 'CounterState/RANDOM_REQUEST';
const RANDOM_RESPONSE = 'CounterState/RANDOM_RESPONSE';

// Action creators
export function increment() {
  return {type: INCREMENT};
}

export function reset() {
  return {type: RESET};
}

export function random() {
  return {
    type: RANDOM_REQUEST
  };
}

export async function requestRandomNumber() {
  return {
    type: RANDOM_RESPONSE,
    payload: await generateRandomNumber()
  };
}

// Reducer
export default function CounterStateReducer(state = initialState, action = {}) {
  switch (action.type) {
    case INCREMENT:
      return state.update('value', value => value + 1);

    case RESET:
      return initialState;

    case RANDOM_REQUEST:
      return loop(
        state.set('loading', true),
        Effects.promise(requestRandomNumber)
      );

    case RANDOM_RESPONSE:
      return state
        .set('loading', false)
        .set('value', action.payload);

    default:
      return state;
  }
}

```

### Core Architecture Module: `src/modules/navigator/NavigatorState.js`
```
import {fromJS} from 'immutable';
import {NavigationActions} from 'react-navigation';
import includes from 'lodash/includes';

import AppNavigator from './Navigator';

export default function NavigatorReducer(state, action) {
  // Initial state
  if (!state) {
    return fromJS(AppNavigator.router.getStateForAction(action, state));
  }

  // Is this a navigation action that we should act upon?
  if (includes(NavigationActions, action.type)) {
    return fromJS(AppNavigator.router.getStateForAction(action, state.toJS()));
  }

  return state;
}

```

### Core Architecture Module: `src/modules/session/SessionState.js`
```
import {Map} from 'immutable';

export const RESET_STATE = 'SessionState/RESET';
export const INITIALIZE_STATE = 'SessionState/INITIALIZE';
// Initial state
const initialState = Map({isReady: false});

export function resetSessionStateFromSnapshot(state) {
  return {
    type: RESET_STATE,
    payload: state
  };
}

export function initializeSessionState() {
  return {
    type: INITIALIZE_STATE
  };
}

// Reducer
export default function SessionStateReducer(state = initialState, action = {}) {
  switch (action.type) {
    case INITIALIZE_STATE:
    case RESET_STATE:
      return state.set('isReady', true);

    default:
      return state;
  }
}

```

### Core Architecture Module: `src/utils/api.js`
```
import Promise from 'bluebird';
import HttpError from 'standard-http-error';
import {getConfiguration} from '../utils/configuration';
import {getAuthenticationToken} from '../utils/authentication';

const EventEmitter = require('event-emitter');

const TIMEOUT = 6000;

/**
 * All HTTP errors are emitted on this channel for interested listeners
 */
export const errors = new EventEmitter();

/**
 * GET a path relative to API root url.
 * @param {String}  path Relative path to the configured API endpoint
 * @param {Boolean} suppressRedBox If true, no warning is shown on failed request
 * @returns {Promise} of response body
 */
export async function get(path, suppressRedBox) {
  return bodyOf(request('get', path, null, suppressRedBox));
}

/**
 * POST JSON to a path relative to API root url
 * @param {String} path Relative path to the configured API endpoint
 * @param {Object} body Anything that you can pass to JSON.stringify
 * @param {Boolean} suppressRedBox If true, no warning is shown on failed request
 * @returns {Promise}  of response body
 */
export async function post(path, body, suppressRedBox) {
  return bodyOf(request('post', path, body, suppressRedBox));
}

/**
 * PUT JSON to a path relative to API root url
 * @param {String} path Relative path to the configured API endpoint
 * @param {Object} body Anything that you can pass to JSON.stringify
 * @param {Boolean} suppressRedBox If true, no warning is shown on failed request
 * @returns {Promise}  of response body
 */
export async function put(path, body, suppressRedBox) {
  return bodyOf(request('put', path, body, suppressRedBox));
}

/**
 * DELETE a path relative to API root url
 * @param {String} path Relative path to the configured API endpoint
 * @param {Boolean} suppressRedBox If true, no warning is shown on failed request
 * @returns {Promise}  of response body
 */
export async function del(path, suppressRedBox) {
  return bodyOf(request('delete', path, null, suppressRedBox));
}

/**
 * Make arbitrary fetch request to a path relative to API root url
 * @param {String} method One of: get|post|put|delete
 * @param {String} path Relative path to the configured API endpoint
 * @param {Object} body Anything that you can pass to JSON.stringify
 * @param {Boolean} suppressRedBox If true, no warning is shown on failed request
 */
export async function request(method, path, body, suppressRedBox) {
  try {
    const response = await sendRequest(method, path, body, suppressRedBox);
    return handleResponse(
      path,
      response
    );
  }
  catch (error) {
    if (!suppressRedBox) {
      logError(error, url(path), method);
    }
    throw error;
  }
}

/**
 * Takes a relative path and makes it a full URL to API server
 */
export function url(path) {
  const apiRoot = getConfiguration('API_ROOT');
  return path.indexOf('/') === 0
    ? apiRoot + path
    : apiRoot + '/' + path;
}

/**
 * Constructs and fires a HTTP request
 */
async function sendRequest(method, path, body) {

  try {
    const endpoint = url(path);
    const token = await getAuthenticationToken();
    const headers = getRequestHeaders(body, token);
    const options = body
      ? {method, headers, body: JSON.stringify(body)}
      : {method, headers};

    return timeout(fetch(endpoint, options), TIMEOUT);
  } catch (e) {
    throw new Error(e);
  }
}

/**
 * Receives and reads a HTTP response
 */
async function handleResponse(path, response) {
  try {
    const status = response.status;

    // `fetch` promises resolve even if HTTP status indicates failure. Reroute
    // promise flow control to interpret error responses as failures
    if (status >= 400) {
      const message = await getErrorMessageSafely(response);
      const error = new HttpError(status, message);

      // emit events on error channel, one for status-specific errors and other for all errors
      errors.emit(status.toString(), {path, message: error.message});
      errors.emit('*', {path, message: error.message}, status);

      throw error;
    }

    // parse response text
    const responseBody = await response.text();
    return {
      status: response.status,
      headers: response.headers,
      body: responseBody ? JSON.parse(responseBody) : null
    };
  } catch (e) {
    throw e;
  }
}

function getRequestHeaders(body, token) {
  const headers = body
    ? {'Accept': 'application/json', 'Content-Type': 'application/json'}
    : {'Accept': 'application/json'};

  if (token) {
    return {...headers, Authorization: token};
  }

  return headers;
}

// try to get the best possible error message out of a response
// without throwing errors while parsing
async function getErrorMessageSafely(response) {
  try {
    const body = await response.text();
    if (!body) {
      return '';
    }

    // Optimal case is JSON with a defined message property
    const payload = JSON.parse(body);
    if (payload && payload.message) {
      return payload.message;
    }

    // Should that fail, return the whole response body as text
    return body;

  } catch (e) {
    // Unreadable body, return whatever the server returned
    return response._bodyInit;
  }
}

/**
 * Rejects a promise after `ms` number of milliseconds, it is still pending
 */
function timeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise
      .then(response => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch(reject);
  });
}

async function bodyOf(requestPromise) {
  try {
    const response = await requestPromise;
    return response.body;
  } catch (e) {
    throw e;
  }
}

/**
 * Make best effort to turn a HTTP error or a runtime exception to meaningful error log message
 */
function logError(error, endpoint, method) {
  if (error.status) {
    const summary = `(${error.status} ${error.statusText}): ${error._bodyInit}`;
    console.error(`API request ${method.toUpperCase()} ${endpoint} responded with ${summary}`);
  }
  else {
    console.error(`API request ${method.toUpperCase()} ${endpoint} failed with message "${error.message}"`);
  }
}

```

### Core Architecture Module: `src/utils/authentication.js`
```
import {AsyncStorage} from 'react-native';

const AUTHENTICATION_STORAGE_KEY = 'PepperoniState:Authentication';

export function getAuthenticationToken() {
  return AsyncStorage.getItem(AUTHENTICATION_STORAGE_KEY);
}

export async function setAuthenticationToken(token) {
  return AsyncStorage.setItem(AUTHENTICATION_STORAGE_KEY, token);
}

export async function clearAuthenticationToken() {
  return AsyncStorage.removeItem(AUTHENTICATION_STORAGE_KEY);
}

```

### Core Architecture Module: `src/utils/configuration.js`
```
import {Map} from 'immutable';

let configuration = Map();

export function setConfiguration(name, value) {
  configuration = configuration.set(name, value);
}

export function setAll(properties) {
  configuration = configuration.merge(properties);
}

export function unsetConfiguration(name) {
  configuration = configuration.delete(name);
}

export function getConfiguration(key) {
  if (!configuration.has(key)) {
    throw new Error('Undefined configuration key: ' + key);
  }

  return configuration.get(key);
}

```

### Core Architecture Module: `src/utils/snapshot.js`
```
import {AsyncStorage} from 'react-native';
import {fromJS} from 'immutable';
const STATE_STORAGE_KEY = 'PepperoniAppTemplateAppState:Latest';

export async function resetSnapshot() {
  const state = await rehydrate();
  if (state) {
    return fromJS(state);
  }

  return null;
}

export async function saveSnapshot(state) {
  await persist(state.toJS());
}

export async function clearSnapshot() {
  await clear();
}

/**
 * Saves provided state object to async storage
 *
 * @returns {Promise}
 */
async function persist(state) {
  try {
    await AsyncStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Error persisting application state', e);
  }
}

/**
 * Reads state object from async storage
 *
 * @returns {Promise}
 */
async function rehydrate() {
  try {
    const state = await AsyncStorage.getItem(STATE_STORAGE_KEY);
    return state
      ? JSON.parse(state)
      : null;
  } catch (e) {
    console.error('Error reading persisted application state', e);
    return null;
  }
}

async function clear() {
  try {
    await AsyncStorage.removeItem(STATE_STORAGE_KEY);
  } catch (e) {
    console.error('Error clearing peristed application state', e);
  }
}

```

### Core Architecture Module: `env.example.js`
```
// Secrets for the applications. Do NOT commit any secrets to version control.
// 1. cp env.example.js env.js
// 2. Fill in the blanks

module.exports = {
};

```

### Core Architecture Module: `index.js`
```
import {Provider} from 'react-redux';
import store from './src/redux/store';
import AppViewContainer from './src/modules/AppViewContainer';

import React, {Component} from 'react';
import {AppRegistry} from 'react-native';

class PepperoniAppTemplate extends Component {
  render() {
    return (
      <Provider store={store}>
        <AppViewContainer />
      </Provider>
    );
  }
}

AppRegistry.registerComponent('PepperoniAppTemplate', () => PepperoniAppTemplate);

```

### Core Architecture Module: `ios/PepperoniAppTemplate/AppDelegate.h`
```
/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import <UIKit/UIKit.h>

@interface AppDelegate : UIResponder <UIApplicationDelegate>

@property (nonatomic, strong) UIWindow *window;

@end

```

### Core Architecture Module: `plopfile.js`
```
module.exports = function (plop) {

  /* TODO
  -----------
  ** __specs__ for module generator
  ** Additional prompt for stateless module generator
  ** Better way to append reducers ? If dev deletes the commented lines it won't work.
  ** Component generator
  ** Any way to get name inline ? Like ` plop module name `
  **/

  plop.setGenerator('module', {
    description: 'Generates new module with redux connection',
    prompts: [{
      type: 'input',
      name: 'name',
      message: 'Module name (Casing will be modified)'
    }],
    actions: [
      {
        type: 'add',
        path: 'src/modules/{{camelCase name}}/{{properCase name}}State.js',
        templateFile: 'generators/module/ModuleState.js.hbs'
      },
      {
        type: 'add',
        path: 'src/modules/{{camelCase name}}/{{properCase name}}View.js',
        templateFile: 'generators/module/ModuleView.js.hbs'
      },
      {
        type: 'add',
        path: 'src/modules/{{camelCase name}}/{{properCase name}}ViewContainer.js',
        templateFile: 'generators/module/ModuleViewContainer.js.hbs'
      },
      {
        type: 'modify',
        path: 'src/redux/reducer.js',
        pattern: /\/\/ ## Generator Reducer Imports/gi,
        template: '// ## Generator Reducer Imports\r\nimport {{properCase name}}Reducer from \'../modules/{{camelCase name}}/{{properCase name}}State\';'
      },
      {
        type: 'modify',
        path: 'src/redux/reducer.js',
        pattern: /\/\/ ## Generator Reducers/gi,
        template: '// ## Generator Reducers\r\n  {{camelCase name}}: {{properCase name}}Reducer,'
      }
    ]
  });
}

```

### Core Architecture Module: `src/components/DeveloperMenu.android.js`
```
import React, {Component} from 'react';
import * as snapshot from '../utils/snapshot';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet
} from 'react-native';

/**
 * Simple developer menu, which allows e.g. to clear the app state.
 * It can be accessed through a tiny button in the bottom right corner of the screen.
 * ONLY FOR DEVELOPMENT MODE!
 */
class DeveloperMenu extends Component {
  static displayName = 'DeveloperMenu';

  constructor(props) {
    super(props);
    this.state = {visible: false};
  }

  showDeveloperMenu = () => {
    this.setState({isVisible: true});
  };

  clearState = async () => {
    await snapshot.clearSnapshot();
    console.warn('(╯°□°）╯︵ ┻━┻ \nState cleared, Cmd+R to reload the application now');
    this.closeMenu();
  };

  closeMenu = () => {
    this.setState({isVisible: false});
  };

  renderMenuItem(text, onPress) {
    return (
      <TouchableOpacity
        key={text}
        onPress={onPress}
        style={styles.menuItem}
        >
        <Text style={styles.menuItemText}>{text}</Text>
      </TouchableOpacity>
    );
  }

  render() {
    if (!__DEV__) {
      return null;
    }

    if (!this.state.isVisible) {
      return (
        <TouchableOpacity
          style={styles.circle}
          onPress={this.showDeveloperMenu}
          />
      );
    }

    const buttons = [
      this.renderMenuItem('Clear state', this.clearState),
      this.renderMenuItem('Cancel', this.closeMenu)
    ];

    return (
      <View style={styles.menu}>
        {buttons}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  circle: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff'
  },
  menu: {
    backgroundColor: 'white',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0
  },
  menuItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    padding: 10,
    height: 60
  },
  menuItemText: {
    fontSize: 20
  }
});

export default DeveloperMenu;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #136** (2016-11-05): **NavigationView is not working in 0.35**
  *Symptoms*: Hey I've used this kit about 2-3 weeks ago, it was ok.  Today i've cloned repo again, but this time the `NavigationExperimental` doesn't work properly.  Screenshot here: [simulator screen shot 19 oct 2016 13 19 27](https://cloud.githubusercontent.com/assets/12139447/19515164/f83c69c6-95fe-11e6-82f3-db7c1d0f7390.png)  I've just started investigating, if someone has ideas - please let me know.  RN cli is up to date no errors in debugging console `NavigationView` `render` method initiated, but `renderHeader` is not. ([Link](https://github.com/futurice/pepperoni-app-kit/blob/26df0277911d8d54dbdbbcd3eb8766c8c5265d99/src/modules/navigation/NavigationView.js#L35))  ...to be continued 
  **Post-Mortem & Fix Analysis**:
  > https://github.com/facebook/react-native/releases/tag/v0.32.0  https://github.com/facebook/react-native/commit/ca8531105e29f2204e0c997783e71b214390bedf 
  > Thanks @anton-aleksandrov, yes this is a regression that the RN 0.35 upgrade introduced, the positioning used to be absolute, now it isn't. If you have time a PR would be appreciated, if not we'll do our best to fix it as soon as possible. 
  > @anton-aleksandrov @krivachy I've created a PR #145 which fixes the title issue. Let me know if it works for you. 

- **Issue #99** (2016-10-07): **Plain objects in state get serialized and rehydrated as ImmutableJS structures**
  *Symptoms*: - If one adds plain JS objects in the state the app breaks on reload - Probably we should enforce immutable objects to avoid confusion 
  **Post-Mortem & Fix Analysis**:
  > @tehmou thanks for reporting this! I submitted a fix, can you see if that fixes your issue> 
  > Okay, I can now see that https://github.com/futurice/pepperoni-app-kit/issues/100 isn't a sufficient fix for this. 

- **Issue #77** (2017-02-02): **Error to build iOS app on fresh clone**
  *Symptoms*: Might related to #25  ### Error:  ``` === BUILD TARGET PepperoniAppTemplate OF PROJECT PepperoniAppTemplate WITH CONFIGURATION Debug ===  Check dependencies  PhaseScriptExecution [CP]\ Check\ Pods\ Manifest.lock build/Build/Intermediates/PepperoniAppTemplate.build/Debug-iphonesimulator/PepperoniAppTemplate.build/Script-64ECB2A37DD1E0D254C2E832.sh     cd /tmp/pepperoni-app-kit/ios     /bin/sh -c /tmp/pepperoni-app-kit/ios/build/Build/Intermediates/PepperoniAppTemplate.build/Debug-iphonesimulator/PepperoniAppTemplate.build/Script-64ECB2A37DD1E0D254C2E832.sh  Ld build/Build/Products/Debug-iphonesimulator/PepperoniAppTemplate.app/PepperoniAppTemplate normal x86_64     cd /tmp/pepperoni-app-kit/ios     export IPHONEOS_DEPLOYMENT_TARGET=7.0     export PATH="/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/usr/bin:/Applications/Xcode.app/Contents/Developer/usr/bin:/Users/wjiang/.rvm/gems/ruby-2.3.1/bin:/Users/wjiang/.rvm/gems/ruby-2.3.1@global/bin:/Users/wjiang/.rvm/rubies/ruby-2.3.1/bin:/Users/wjiang/.rvm/bin:/Users/wjiang/.nvm/versions/node/v6.3.0/bin:/Users/wjiang/workspace/go/bin:/usr/local/heroku/bin:/Users/wjiang/.rbenv/shims:/Users/wjiang/.rbenv/shims:/Users/wjiang/.rbenv/bin:/Developer/NVIDIA/CUDA-7.5/bin:/Users/wjiang/opt/bin:/usr/local/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/X11/bin:/usr/local/go/bin:/Library/TeX/texbin:/Users/wjiang/opt/android/sdk/tools:/Users/wjiang/opt/android/sdk/platform-tools:/Users/wjiang/workspa
  **Post-Mortem & Fix Analysis**:
  > I actually had the app running in the iOS simulator briefly, but after wiping and trying again I can't seem to get it running - just getting that same error: `":CFBundleIdentifier", Does Not Exist` 
  > Yes, I can replicate this. Investigating. This appears to be reported in https://github.com/facebook/react-native/issues/7308 and https://github.com/facebook/react-native/issues/7806 as well. 
  > I had this problem and solved with the `react-native upgrade` command like that guy commented on [https://github.com/facebook/react-native/issues/7308](url). @jevakallio  thanks for the reference! 😄  

- **Issue #13** (2016-08-07): **Navigation Header getTitle never gets invoked**
  *Symptoms*: https://github.com/futurice/pepperoni-app-kit/blob/master/src/modules/navigation/NavigationTabView.js#L25  This line never gets invoked. Currently pepperoni does not support displaying the title for the inner card stack (not the tabs). 
  **Post-Mortem & Fix Analysis**:
  > This is fixed by https://github.com/futurice/pepperoni-app-kit/pull/89 (merged as part of https://github.com/futurice/pepperoni-app-kit/pull/95). You can (or MUST) now provide `title` property with each navigation route pushed to the navigation stack, and that title is displayed in the navigation bar. 

- **Issue #10** (2016-08-07): **Navigation.Header header covers Navigation.Card content**
  *Symptoms*: If the content in Navigation.Card starts at the top, it will be covered by the header. 
  **Post-Mortem & Fix Analysis**:
  > Any progress on this? Any suggested workarounds?  It's a bit quirky to always check if the header is shown and then add an offset to the top.  With this kind of bugs as open issues, I'm getting a little worried that this project will not be around for long. Does anyone use Pepperoni as a base for production apps?  If I had the knowledge I'd try to contribute, of course. But I'm still struggling with learning React/Redux/Immutable. 
  > @michaelswe this has been now fixed by https://github.com/futurice/pepperoni-app-kit/pull/97/files.  Our apologies for the slow response time.   The problem isn't that nobody is using Pepperoni in production, quite the opposite! Since the launch, we have been unexpectedly busy building production apps and we haven't had the opportunity to backport the discovered fixes and improvements back to Pepperoni.  Thanks for caring, hope we can support better in the future 🍕 🚀  

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

### Incident Patch 1: `e7e5b516` (2017-10-18)
**Commit Message**: Android version 23.0.1 to match build.gradle

**File**: `.travis.yml` (modified, +2/-2)
```diff
@@ -38,8 +38,8 @@ matrix:
         components:
           - tools
           - platform-tools
-          - build-tools-26.0.1
-          - android-26
+          - build-tools-23.0.1
+          - android-23
           - extra-android-m2repository
           - extra-google-google_play_services
           - extra-google-m2repository
```

---

### Incident Patch 2: `3b7e37f0` (2017-10-18)
**Commit Message**: Updated react-redux to 5.0.6

**File**: `package-lock.json` (modified, +5/-12)
```diff
@@ -7775,23 +7775,16 @@
       }
     },
     "react-redux": {
-      "version": "4.4.8",
-      "resolved": "https://registry.npmjs.org/react-redux/-/react-redux-4.4.8.tgz",
-      "integrity": "sha1-57wd0QDotk6WrIIS2xEyObni4I8=",
+      "version": "5.0.6",
+      "resolved": "https://registry.npmjs.org/react-redux/-/react-redux-5.0.6.tgz",
+      "integrity": "sha512-8taaaGu+J7PMJQDJrk/xiWEYQmdo3mkXw6wPr3K3LxvXis3Fymiq7c13S+Tpls/AyNUAsoONkU81AP0RA6y6Vw==",
       "requires": {
-        "create-react-class": "15.6.2",
-        "hoist-non-react-statics": "1.2.0",
+        "hoist-non-react-statics": "2.3.1",
         "invariant": "2.2.2",
         "lodash": "4.17.4",
+        "lodash-es": "4.17.4",
         "loose-envify": "1.3.1",
         "prop-types": "15.6.0"
-      },
-      "dependencies": {
-        "hoist-non-react-statics": {
-          "version": "1.2.0",
-          "resolved": "https://registry.npmjs.org/hoist-non-react-statics/-/hoist-non-react-statics-1.2.0.tgz",
-          "integrity": "sha1-qkSM8JhtVcxAdzsXF0t90GbLfPs="
-        }
       }
     },
     "react-test-renderer": {
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -20,7 +20,7 @@
   "private": false,
   "scripts": {
     "start": "node node_modules/react-native/local-cli/cli.js start",
-    "bundle:ios": "node ./node_modules/react-native/local-cli/cli.js bundle --platform ios --entry-file index.ios.js --bundle-output ios/PepperoniAppTemplate/main.jsbundle --dev=false --verbose",
+    "bundle:ios": "node ./node_modules/react-native/local-cli/cli.js bundle --platform ios --entry-file index.js --bundle-output ios/PepperoniAppTemplate/main.jsbundle --dev=false --verbose",
     "test": "jest",
     "test:watch": "jest --watch",
     "lint": "eslint src test",
@@ -47,7 +47,7 @@
     "react-native": "^0.49.3",
     "react-native-vector-icons": "^4.0.0",
     "react-navigation": "^1.0.0-beta.9",
-    "react-redux": "^4.4.5",
+    "react-redux": "^5.0.6",
     "redux": "^3.4.0",
     "redux-logger": "^2.6.1",
     "redux-loop-symbol-ponyfill": "^2.2.0",
```

---

### Incident Patch 3: `143f8a89` (2017-07-25)
**Commit Message**: Fix react-navigator options, which broke with the release of v1.0.0-beta.9

**File**: `package.json` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@
     "react-dom": "~15.4.2",
     "react-native": "0.42.0",
     "react-native-vector-icons": "^4.0.0",
-    "react-navigation": "^1.0.0-beta.7",
+    "react-navigation": "^1.0.0-beta.9",
     "react-redux": "^4.4.5",
     "redux": "^3.4.0",
     "redux-logger": "^2.6.1",
```

**File**: `src/modules/colors/ColorView.js` (modified, +5/-9)
```diff
@@ -18,17 +18,13 @@ class ColorView extends Component {
 
   static navigationOptions = {
     title: 'Colors!',
-    tabBar: () => ({
-      icon: (props) => (
+    tabBarIcon: (props) => (
         <Icon name='color-lens' size={24} color={props.tintColor} />
-      )
-    }),
+      ),
     // TODO: move this into global config?
-    header: {
-      tintColor: 'white',
-      style: {
-        backgroundColor: '#39babd'
-      }
+    headerTintColor: 'white',
+    headerStyle: {
+      backgroundColor: '#39babd'
     }
   }
 
```

**File**: `src/modules/counter/CounterView.js` (modified, +1/-3)
```diff
@@ -14,11 +14,9 @@ class CounterView extends Component {
 
   static navigationOptions = {
     title: 'Counter',
-    tabBar: () => ({
-      icon: (props) => (
+    tabBarIcon: (props) => (
         <Icon name='plus-one' size={24} color={props.tintColor} />
       )
-    })
   }
 
   static propTypes = {
```

**File**: `src/modules/navigator/Navigator.js` (modified, +4/-6)
```diff
@@ -25,12 +25,10 @@ export const MainScreenNavigator = TabNavigator({
 
 MainScreenNavigator.navigationOptions = {
   title: 'Pepperoni App Template',
-  header: {
-    titleStyle: {color: 'white'},
-    style: {
-      backgroundColor: headerColor,
-      elevation: 0 // disable header elevation when TabNavigator visible
-    }
+  headerTitleStyle: {color: 'white'},
+  headerStyle: {
+    backgroundColor: headerColor,
+    elevation: 0 // disable header elevation when TabNavigator visible
   }
 };
 
```

---

### Incident Patch 4: `192effea` (2017-03-08)
**Commit Message**: Merge pull request #192 from futurice/bugfix/android-hmr

Fix HMR on Android with patched redux-loop using Symbol ponyfill

**File**: `index.android.js` (modified, +0/-1)
```diff
@@ -1,4 +1,3 @@
-import 'es6-symbol/implement';
 import {Provider} from 'react-redux';
 import store from './src/redux/store';
 import AppViewContainer from './src/modules/AppViewContainer';
```

**File**: `package.json` (modified, +1/-2)
```diff
@@ -32,7 +32,6 @@
   },
   "dependencies": {
     "bluebird": "^3.3.5",
-    "es6-symbol": "^3.0.2",
     "event-emitter": "^0.3.4",
     "immutable": "^3.7.6",
     "lodash": "^4.11.0",
@@ -44,7 +43,7 @@
     "react-redux": "^4.4.5",
     "redux": "^3.4.0",
     "redux-logger": "^2.6.1",
-    "redux-loop": "^2.1.0",
+    "redux-loop-symbol-ponyfill": "^2.2.0",
     "redux-promise": "^0.5.3",
     "redux-thunk": "^2.0.1",
     "standard-http-error": "^2.0.0"
```

**File**: `src/modules/counter/CounterState.js` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 import {Map} from 'immutable';
-import {loop, Effects} from 'redux-loop';
+import {loop, Effects} from 'redux-loop-symbol-ponyfill';
 import {generateRandomNumber} from '../../services/randomNumberService';
 
 // Initial state
```

**File**: `src/modules/counter/__specs__/CounterState.spec.js` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 /*eslint-disable max-nested-callbacks, no-unused-expressions*/
 
-import {Effects} from 'redux-loop';
+import {Effects} from 'redux-loop-symbol-ponyfill';
 import {initialState, dispatch} from '../../../../test/state';
 import * as CounterStateActions from '../CounterState';
 
```

**File**: `src/redux/reducer.js` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 import {Map, fromJS} from 'immutable';
-import {loop, combineReducers} from 'redux-loop';
+import {loop, combineReducers} from 'redux-loop-symbol-ponyfill';
 import NavigationStateReducer from '../modules/navigation/NavigationState';
 import CounterStateReducer from '../modules/counter/CounterState';
 import SessionStateReducer, {RESET_STATE} from '../modules/session/SessionState';
```

**File**: `src/redux/store.js` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 import {applyMiddleware, createStore, compose} from 'redux';
-import * as reduxLoop from 'redux-loop';
+import * as reduxLoop from 'redux-loop-symbol-ponyfill';
 import middleware from './middleware';
 import reducer from './reducer';
 
```

**File**: `yarn.lock` (modified, +78/-66)
```diff
@@ -52,9 +52,9 @@ ajv-keywords@^1.0.0:
   version "1.5.1"
   resolved "https://registry.yarnpkg.com/ajv-keywords/-/ajv-keywords-1.5.1.tgz#314dd0a4b3368fad3dfcdc54ede6171b886daf3c"
 
-ajv@^4.7.0:
-  version "4.11.3"
-  resolved "https://registry.yarnpkg.com/ajv/-/ajv-4.11.3.tgz#ce30bdb90d1254f762c75af915fb3a63e7183d22"
+ajv@^4.7.0, ajv@^4.9.1:
+  version "4.11.4"
+  resolved "https://registry.yarnpkg.com/ajv/-/ajv-4.11.4.tgz#ebf3a55d4b132ea60ff5847ae85d2ef069960b45"
   dependencies:
     co "^4.6.0"
     json-stable-stringify "^1.0.1"
@@ -195,10 +195,6 @@ async@^2.0.1, async@^2.1.4:
   dependencies:
     lodash "^4.14.0"
 
-async@~0.2.6:
-  version "0.2.10"
-  resolved "https://registry.yarnpkg.com/async/-/async-0.2.10.tgz#b6bbe0b0674b9d719708ca38de8c237cb526c3d1"
-
 asynckit@^0.4.0:
   version "0.4.0"
   resolved "https://registry.yarnpkg.com/asynckit/-/asynckit-0.4.0.tgz#c79ed97f7f34cb8f2ba1bc9790bcc366474b4b79"
@@ -1025,8 +1021,8 @@ beeper@^1.0.0:
   resolved "https://registry.yarnpkg.com/beeper/-/beeper-1.1.1.tgz#e6d5ea8c5dad001304a70b22638447f69cb2f809"
 
 bluebird@^3.3.5:
-  version "3.4.7"
-  resolved "https://registry.yarnpkg.com/bluebird/-/bluebird-3.4.7.tgz#f72d760be09b7f76d08ed8fae98b289a8d05fab3"
+  version "3.5.0"
+  resolved "https://registry.yarnpkg.com/bluebird/-/bluebird-3.5.0.tgz#791420d7f551eea2897453a8a77653f96606d67c"
 
 body-parser@~1.13.3:
   version "1.13.3"
@@ -1084,12 +1080,18 @@ browser-resolve@^1.11.2:
   dependencies:
     resolve "1.1.7"
 
-bser@1.0.2, bser@^1.0.2:
+bser@1.0.2:
   version "1.0.2"
   resolved "https://registry.yarnpkg.com/bser/-/bser-1.0.2.tgz#381116970b2a6deea5646dd15dd7278444b56169"
   dependencies:
     node-int64 "^0.4.0"
 
+bser@^1.0.2:
+  version "1.0.3"
+  resolved "https://registry.yarnpkg.com/bser/-/bser-1.0.3.tgz#d63da19ee17330a0e260d2a34422b21a89520317"
+  dependencies:
+    node-int64 "^0.4.0"
+
 buffer-shims@^1.0.0:
   version "1.0.0"
   resolved "https://registry.yarnpkg.com/buffer-shims/-/buffer-shims-1.0.0.tgz#9978ce317388c649ad8793028c3477ef044a8b51"
@@ -1135,9 +1137,9 @@ cardinal@^1.0.0:
     ansicolors "~0.2.1"
     redeyed "~1.0.0"
 
-caseless@~0.11.0:
-  version "0.11.0"
-  resolved "https://registry.yarnpkg.com/caseless/-/caseless-0.11.0.tgz#715b96ea9841593cc33067923f5ec60ebda4f7d7"
+caseless@~0.12.0:
+  version "0.12.0"
+  resolved "https://registry.yarnpkg.com/caseless/-/caseless-0.12.0.tgz#1b681c21ff84033c826543090689420d187151dc"
 
 center-align@^0.1.1:
   version "0.1.3"
@@ -1391,13 +1393,13 @@ cryptiles@2.x.x:
     boom "2.x.x"
 
 csrf@~3.0.0:
-  version "3.0.4"
-  resolved "https://registry.yarnpkg.com/csrf/-/csrf-3.0.4.tgz#ba01423e5b5bea7b655e38b0bdd1323954cbdaa5"
+  version "3.0.5"
+  resolved "https://registry.yarnpkg.com/csrf/-/csrf-3.0.5.tgz#3c3aa86f395dd39f86d68fcf1734a2380f466112"
   dependencies:
     base64-url "1.3.3"
     rndm "1.2.0"
     tsscmp "1.0.5"
-    uid-safe "2.1.3"
+    uid-safe "2.1.4"
 
 css-select@~1.2.0:
   version "1.2.0"
@@ -1630,8 +1632,8 @@ enzyme@^2.2.0:
     prr "~0.0.0"
 
 error-ex@^1.2.0:
-  version "1.3.0"
-  resolved "https://registry.yarnpkg.com/error-ex/-/error-ex-1.3.0.tgz#e67b43f3e82c96ea3a584ffee0b9fc3325d802d9"
+  version "1.3.1"
+  resolved "https://registry.yarnpkg.com/error-ex/-/error-ex-1.3.1.tgz#f855a86ce61adc4e8621c3cda21e7a7612c3a8dc"
   dependencies:
     is-arrayish "^0.2.1"
 
@@ -1695,7 +1697,7 @@ es6-set@~0.1.3:
     es6-symbol "3"
     event-emitter "~0.3.4"
 
-es6-symbol@3, es6-symbol@^3.0.2, es6-symbol@~3.1, es6-symbol@~3.1.0:
+es6-symbol@3, es6-symbol@^3.1.0, es6-symbol@~3.1, es6-symbol@~3.1.0:
   version "3.1.0"
   resolved "https://registry.yarnpkg.com/es6-symbol/-/es6-symbol-3.1.0.tgz#94481c655e7a7cad82eba832d97d5433496d7ffa"
   dependencies:
@@ -1758,8 +1760,8 @@ eslint-plugin-react@^6.7.1:
     object.assign "^4.0.4"
 
 eslint@^3.10.1:
-  version "3.16.1"
-  resolved "https://registry.yarnpkg.com/eslint/-/eslint-3.16.1.tgz#9bc31fc7341692cf772e80607508f67d711c5609"
+  version "3.17.1"
+  resolved "https://registry.yarnpkg.com/eslint/-/eslint-3.17.1.tgz#b80ae12d9c406d858406fccda627afce33ea10ea"
   dependencies:
     babel-code-frame "^6.16.0"
     chalk "^1.1.3"
@@ -2019,15 +2021,15 @@ flux-standard-action@^0.6.1:
   dependencies:
     lodash.isplainobject "^3.2.0"
 
-for-in@^0.1.5:
-  version "0.1.6"
-  resolved "https://registry.yarnpkg.com/for-in/-/for-in-0.1.6.tgz#c9f96e89bfad18a545af5ec3ed352a1d9e5b4dc8"
+for-in@^1.0.1:
+  version "1.0.2"
+  resolved "https://registry.yarnpkg.com/for-in/-/for-in-1.0.2.tgz#81068d295a8142ec0ac726c6e2200c30fb6d5e80"
 
 for-own@^0.1.4:
-  version "0.1.4"
-  resolved "https://registry.yarnpkg.com/for-own/-/for-own-0.1.4.tgz#0149b41a39088c7515f51ebe1c1386d45f935072"
+  version "0.1.5"
+  resolved "https://registry.yarnpkg.com/for-own/-/for-own-0.1.5.tgz#5265c681a4f294dabbf17c9509b6763aa84510ce"
   dependencies:
-    for-in "^0.1.5"
+    for-in "^1.0.1"
 
 foreach@^2.0.5:
   version "2.0.5"
@@ -2226,14 +2228,16 @@ handlebars@^4.0.1, handlebars@
```

---

### Incident Patch 5: `89e1d2bf` (2017-03-08)
**Commit Message**: Merge branch 'master' into bugfix/android-hmr

# Conflicts:
#	yarn.lock

**File**: `.flowconfig` (modified, +5/-3)
```diff
@@ -22,6 +22,8 @@ node_modules/react-native/flow
 flow/
 
 [options]
+emoji=true
+
 module.system=haste
 
 experimental.strict_type_args=true
@@ -34,11 +36,11 @@ suppress_type=$FlowIssue
 suppress_type=$FlowFixMe
 suppress_type=$FixMe
 
-suppress_comment=\\(.\\|\n\\)*\\$FlowFixMe\\($\\|[^(]\\|(\\(>=0\\.\\(3[0-7]\\|[1-2][0-9]\\|[0-9]\\).[0-9]\\)? *\\(site=[a-z,_]*react_native[a-z,_]*\\)?)\\)
-suppress_comment=\\(.\\|\n\\)*\\$FlowIssue\\((\\(>=0\\.\\(3[0-7]\\|1[0-9]\\|[1-2][0-9]\\).[0-9]\\)? *\\(site=[a-z,_]*react_native[a-z,_]*\\)?)\\)?:? #[0-9]+
+suppress_comment=\\(.\\|\n\\)*\\$FlowFixMe\\($\\|[^(]\\|(\\(>=0\\.\\(3[0-8]\\|[1-2][0-9]\\|[0-9]\\).[0-9]\\)? *\\(site=[a-z,_]*react_native[a-z,_]*\\)?)\\)
+suppress_comment=\\(.\\|\n\\)*\\$FlowIssue\\((\\(>=0\\.\\(3[0-8]\\|1[0-9]\\|[1-2][0-9]\\).[0-9]\\)? *\\(site=[a-z,_]*react_native[a-z,_]*\\)?)\\)?:? #[0-9]+
 suppress_comment=\\(.\\|\n\\)*\\$FlowFixedInNextDeploy
 
 unsafe.enable_getters_and_setters=true
 
 [version]
-^0.37.0
+^0.38.0
```

**File**: `.travis.yml` (modified, +8/-8)
```diff
@@ -19,7 +19,7 @@ matrix:
   include:
     - language: android
       os: linux
-      jdk: oraclejdk7
+      jdk: oraclejdk8
       before_cache:
         - rm -f  $HOME/.gradle/caches/modules-2/modules-2.lock
         - rm -fr $HOME/.gradle/caches/*/plugin-resolution/
@@ -28,10 +28,10 @@ matrix:
       before_install:
         - nvm install 7
         - node --version
-        - curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
+        - travis_retry curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
         - echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
-        - sudo apt-get update -qq
-        - sudo apt-get install -y -qq yarn
+        - travis_retry sudo apt-get update -qq
+        - travis_retry sudo apt-get install -y -qq yarn
       install:
         - yarn
       android:
@@ -51,14 +51,14 @@ matrix:
       before_install:
         - nvm install 7
         - node --version
-        - npm install -g yarn
+        - travis_retry npm install -g yarn
         - yarn -version
       install:
-        - gem install xcpretty
-        - yarn
+        - travis_retry gem install xcpretty
+        - travis_retry yarn
       xcode_project: ios/PepperoniAppTemplate.xcodeproj
       xcode_scheme: ios/PepperoniAppTemplateTests
       script:
         - cd ios
         - xcodebuild -scheme PepperoniAppTemplate -sdk iphonesimulator ONLY_ACTIVE_ARCH=NO | xcpretty
-        - xctool run-tests -scheme PepperoniAppTemplate -sdk iphonesimulator ONLY_ACTIVE_ARCH=NO
+        - travis_retry xctool run-tests -scheme PepperoniAppTemplate -sdk iphonesimulator -launch-timeout 90  ONLY_ACTIVE_ARCH=NO
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ React Native Starter Kit is a part of [Pepperoni](http://getpepperoni.com), a fr
 Sounds good and you just want to see how it works? Here is a quick start guide:
 
 ```
-git clone git@github.com:futurice/pepperoni-app-kit.git
+git clone https://github.com/futurice/pepperoni-app-kit.git
 cd pepperoni-app-kit
 yarn install
 react-native run-ios
```

**File**: `android/app/src/main/AndroidManifest.xml` (modified, +2/-1)
```diff
@@ -19,7 +19,8 @@
       <activity
         android:name=".MainActivity"
         android:label="@string/app_name"
-        android:configChanges="keyboard|keyboardHidden|orientation|screenSize">
+        android:configChanges="keyboard|keyboardHidden|orientation|screenSize"
+        android:windowSoftInputMode="adjustResize">
         <intent-filter>
             <action android:name="android.intent.action.MAIN" />
             <category android:name="android.intent.category.LAUNCHER" />
```

**File**: `android/app/src/main/java/com/pepperoniapptemplate/MainApplication.java` (modified, +0/-2)
```diff
@@ -1,10 +1,8 @@
 package com.pepperoniapptemplate;
 
 import android.app.Application;
-import android.util.Log;
 
 import com.facebook.react.ReactApplication;
-import com.facebook.react.ReactInstanceManager;
 import com.facebook.react.ReactNativeHost;
 import com.facebook.react.ReactPackage;
 import com.facebook.react.shell.MainReactPackage;
```

**File**: `android/build.gradle` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ buildscript {
         jcenter()
     }
     dependencies {
-        classpath 'com.android.tools.build:gradle:1.3.1'
+        classpath 'com.android.tools.build:gradle:2.2.3'
 
         // NOTE: Do not place your application dependencies here; they belong
         // in the individual module build.gradle files
```

**File**: `android/gradle/wrapper/gradle-wrapper.properties` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@ distributionBase=GRADLE_USER_HOME
 distributionPath=wrapper/dists
 zipStoreBase=GRADLE_USER_HOME
 zipStorePath=wrapper/dists
-distributionUrl=https\://services.gradle.org/distributions/gradle-2.4-all.zip
+distributionUrl=https\://services.gradle.org/distributions/gradle-2.14.1-all.zip
```

**File**: `ios/PepperoniAppTemplate/Info.plist` (modified, +2/-1)
```diff
@@ -5,7 +5,7 @@
     <key>CFBundleDevelopmentRegion</key>
     <string>en</string>
     <key>CFBundleDisplayName</key>
-	  <string>PepperoniAppTemplate</string>
+	<string>PepperoniAppTemplate</string>
     <key>CFBundleExecutable</key>
     <string>$(EXECUTABLE_NAME)</string>
     <key>CFBundleIdentifier</key>
@@ -41,6 +41,7 @@
     <key>NSLocationWhenInUseUsageDescription</key>
     <string/>
     <key>NSAppTransportSecurity</key>
+    <!--See http://ste.vn/2015/06/10/configuring-app-transport-security-ios-9-osx-10-11/ -->
     <dict>
       <key>NSExceptionDomains</key>
       <dict>
```

---

### Incident Patch 6: `1f8de9e1` (2017-03-07)
**Commit Message**: Fix HMR on Android with patched redux-loop using Symbol ponyfill

**File**: `index.android.js` (modified, +0/-1)
```diff
@@ -1,4 +1,3 @@
-import 'es6-symbol/implement';
 import {Provider} from 'react-redux';
 import store from './src/redux/store';
 import AppViewContainer from './src/modules/AppViewContainer';
```

**File**: `package.json` (modified, +1/-2)
```diff
@@ -32,7 +32,6 @@
   },
   "dependencies": {
     "bluebird": "^3.3.5",
-    "es6-symbol": "^3.0.2",
     "event-emitter": "^0.3.4",
     "immutable": "^3.7.6",
     "lodash": "^4.11.0",
@@ -44,7 +43,7 @@
     "react-redux": "^4.4.5",
     "redux": "^3.4.0",
     "redux-logger": "^2.6.1",
-    "redux-loop": "^2.1.0",
+    "redux-loop-symbol-ponyfill": "^2.2.0",
     "redux-promise": "^0.5.3",
     "redux-thunk": "^2.0.1",
     "standard-http-error": "^2.0.0"
```

**File**: `src/modules/counter/CounterState.js` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 import {Map} from 'immutable';
-import {loop, Effects} from 'redux-loop';
+import {loop, Effects} from 'redux-loop-symbol-ponyfill';
 import {generateRandomNumber} from '../../services/randomNumberService';
 
 // Initial state
```

**File**: `src/modules/counter/__specs__/CounterState.spec.js` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 /*eslint-disable max-nested-callbacks, no-unused-expressions*/
 
-import {Effects} from 'redux-loop';
+import {Effects} from 'redux-loop-symbol-ponyfill';
 import {initialState, dispatch} from '../../../../test/state';
 import * as CounterStateActions from '../CounterState';
 
```

**File**: `src/redux/reducer.js` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 import {Map, fromJS} from 'immutable';
-import {loop, combineReducers} from 'redux-loop';
+import {loop, combineReducers} from 'redux-loop-symbol-ponyfill';
 import NavigationStateReducer from '../modules/navigation/NavigationState';
 import CounterStateReducer from '../modules/counter/CounterState';
 import SessionStateReducer, {RESET_STATE} from '../modules/session/SessionState';
```

**File**: `src/redux/store.js` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 import {applyMiddleware, createStore, compose} from 'redux';
-import * as reduxLoop from 'redux-loop';
+import * as reduxLoop from 'redux-loop-symbol-ponyfill';
 import middleware from './middleware';
 import reducer from './reducer';
 
```

**File**: `yarn.lock` (modified, +201/-180)
```diff
@@ -1,12 +1,14 @@
 # THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
 # yarn lockfile v1
-
-
 abab@^1.0.3:
   version "1.0.3"
   resolved "https://registry.yarnpkg.com/abab/-/abab-1.0.3.tgz#b81de5f7274ec4e756d797cd834f303642724e5d"
 
-abbrev@1, abbrev@1.0.x:
+abbrev@1:
+  version "1.1.0"
+  resolved "https://registry.yarnpkg.com/abbrev/-/abbrev-1.1.0.tgz#d0554c2256636e2f56e7c2e5ad183f859428d81f"
+
+abbrev@1.0.x:
   version "1.0.9"
   resolved "https://registry.yarnpkg.com/abbrev/-/abbrev-1.0.9.tgz#91b4792588a7738c25f35dd6f63752a2f8776135"
 
@@ -40,21 +42,25 @@ acorn-jsx@^3.0.0:
   dependencies:
     acorn "^3.0.4"
 
-acorn@4.0.4, acorn@^4.0.4:
-  version "4.0.4"
-  resolved "https://registry.yarnpkg.com/acorn/-/acorn-4.0.4.tgz#17a8d6a7a6c4ef538b814ec9abac2779293bf30a"
-
 acorn@^3.0.4:
   version "3.3.0"
   resolved "https://registry.yarnpkg.com/acorn/-/acorn-3.3.0.tgz#45e37fb39e8da3f25baee3ff5369e2bb5f22017a"
 
+acorn@^4.0.4:
+  version "4.0.11"
+  resolved "https://registry.yarnpkg.com/acorn/-/acorn-4.0.11.tgz#edcda3bd937e7556410d42ed5860f67399c794c0"
+
+acorn@4.0.4:
+  version "4.0.4"
+  resolved "https://registry.yarnpkg.com/acorn/-/acorn-4.0.4.tgz#17a8d6a7a6c4ef538b814ec9abac2779293bf30a"
+
 ajv-keywords@^1.0.0:
   version "1.5.1"
   resolved "https://registry.yarnpkg.com/ajv-keywords/-/ajv-keywords-1.5.1.tgz#314dd0a4b3368fad3dfcdc54ede6171b886daf3c"
 
-ajv@^4.7.0:
-  version "4.11.3"
-  resolved "https://registry.yarnpkg.com/ajv/-/ajv-4.11.3.tgz#ce30bdb90d1254f762c75af915fb3a63e7183d22"
+ajv@^4.7.0, ajv@^4.9.1:
+  version "4.11.4"
+  resolved "https://registry.yarnpkg.com/ajv/-/ajv-4.11.4.tgz#ebf3a55d4b132ea60ff5847ae85d2ef069960b45"
   dependencies:
     co "^4.6.0"
     json-stable-stringify "^1.0.1"
@@ -185,7 +191,7 @@ assert-plus@^1.0.0:
   version "1.0.0"
   resolved "https://registry.yarnpkg.com/assert-plus/-/assert-plus-1.0.0.tgz#f12e0f3c5d77b0b1cdd9146942e4e96c1e4dd525"
 
-async@1.x, async@^1.4.0, async@^1.4.2:
+async@^1.4.0, async@^1.4.2, async@1.x:
   version "1.5.2"
   resolved "https://registry.yarnpkg.com/async/-/async-1.5.2.tgz#ec6a61ae56480c0c3cb241c95618e20892f9672a"
 
@@ -195,10 +201,6 @@ async@^2.0.1, async@^2.1.4:
   dependencies:
     lodash "^4.14.0"
 
-async@~0.2.6:
-  version "0.2.10"
-  resolved "https://registry.yarnpkg.com/async/-/async-0.2.10.tgz#b6bbe0b0674b9d719708ca38de8c237cb526c3d1"
-
 asynckit@^0.4.0:
   version "0.4.0"
   resolved "https://registry.yarnpkg.com/asynckit/-/asynckit-0.4.0.tgz#c79ed97f7f34cb8f2ba1bc9790bcc366474b4b79"
@@ -587,7 +589,7 @@ babel-plugin-transform-es2015-computed-properties@^6.5.0, babel-plugin-transform
     babel-runtime "^6.22.0"
     babel-template "^6.22.0"
 
-babel-plugin-transform-es2015-destructuring@6.x, babel-plugin-transform-es2015-destructuring@^6.5.0, babel-plugin-transform-es2015-destructuring@^6.6.5, babel-plugin-transform-es2015-destructuring@^6.8.0:
+babel-plugin-transform-es2015-destructuring@^6.5.0, babel-plugin-transform-es2015-destructuring@^6.6.5, babel-plugin-transform-es2015-destructuring@^6.8.0, babel-plugin-transform-es2015-destructuring@6.x:
   version "6.23.0"
   resolved "https://registry.yarnpkg.com/babel-plugin-transform-es2015-destructuring/-/babel-plugin-transform-es2015-destructuring-6.23.0.tgz#997bb1f1ab967f682d2b0876fe358d60e765c56d"
   dependencies:
@@ -599,7 +601,7 @@ babel-plugin-transform-es2015-for-of@^6.5.0, babel-plugin-transform-es2015-for-o
   dependencies:
     babel-runtime "^6.22.0"
 
-babel-plugin-transform-es2015-function-name@6.x, babel-plugin-transform-es2015-function-name@^6.5.0, babel-plugin-transform-es2015-function-name@^6.8.0:
+babel-plugin-transform-es2015-function-name@^6.5.0, babel-plugin-transform-es2015-function-name@^6.8.0, babel-plugin-transform-es2015-function-name@6.x:
   version "6.22.0"
   resolved "https://registry.yarnpkg.com/babel-plugin-transform-es2015-function-name/-/babel-plugin-transform-es2015-function-name-6.22.0.tgz#f5fcc8b09093f9a23c76ac3d9e392c3ec4b77104"
   dependencies:
@@ -613,7 +615,7 @@ babel-plugin-transform-es2015-literals@^6.5.0, babel-plugin-transform-es2015-lit
   dependencies:
     babel-runtime "^6.22.0"
 
-babel-plugin-transform-es2015-modules-commonjs@6.x, babel-plugin-transform-es2015-modules-commonjs@^6.5.0, babel-plugin-transform-es2015-modules-commonjs@^6.7.0, babel-plugin-transform-es2015-modules-commonjs@^6.8.0:
+babel-plugin-transform-es2015-modules-commonjs@^6.5.0, babel-plugin-transform-es2015-modules-commonjs@^6.7.0, babel-plugin-transform-es2015-modules-commonjs@^6.8.0, babel-plugin-transform-es2015-modules-commonjs@6.x:
   version "6.23.0"
   resolved "https://registry.yarnpkg.com/babel-plugin-transform-es2015-modules-commonjs/-/babel-plugin-transform-es2015-modules-commonjs-6.23.0.tgz#cba7aa6379fb7ec99250e6d46de2973aaffa7b92"
   dependencies:
@@ -629,7 +631,7 @@ babel-plugin-transform-es2015-object-super@^6.6.5, babel-plugin-transform-es2015
     babel-helper-replace-supers "^6.22.0"
     babel-runtime "^6.22.0"
 
-babel-p
```

---

### Incident Patch 7: `1862f27b` (2017-03-03)
**Commit Message**: Bump ios launch timeout and retry to see if it helps on travis

**File**: `.travis.yml` (modified, +7/-7)
```diff
@@ -28,10 +28,10 @@ matrix:
       before_install:
         - nvm install 7
         - node --version
-        - curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
+        - travis_retry curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
         - echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
-        - sudo apt-get update -qq
-        - sudo apt-get install -y -qq yarn
+        - travis_retry sudo apt-get update -qq
+        - travis_retry sudo apt-get install -y -qq yarn
       install:
         - yarn
       android:
@@ -51,14 +51,14 @@ matrix:
       before_install:
         - nvm install 7
         - node --version
-        - npm install -g yarn
+        - travis_retry npm install -g yarn
         - yarn -version
       install:
-        - gem install xcpretty
-        - yarn
+        - travis_retry gem install xcpretty
+        - travis_retry yarn
       xcode_project: ios/PepperoniAppTemplate.xcodeproj
       xcode_scheme: ios/PepperoniAppTemplateTests
       script:
         - cd ios
         - xcodebuild -scheme PepperoniAppTemplate -sdk iphonesimulator ONLY_ACTIVE_ARCH=NO | xcpretty
-        - xctool run-tests -scheme PepperoniAppTemplate -sdk iphonesimulator ONLY_ACTIVE_ARCH=NO
+        - travis_retry xctool run-tests -scheme PepperoniAppTemplate -sdk iphonesimulator -launch-timeout 90  ONLY_ACTIVE_ARCH=NO
```

---

### Incident Patch 8: `8f792d44` (2017-02-27)
**Commit Message**: Fix yarn install on node.js jobs

**File**: `.travis.yml` (modified, +4/-2)
```diff
@@ -10,8 +10,6 @@ cache:
     - $HOME/.gradle/wrapper/
 env:
   - NODE_ENV='test'
-install:
-  - yarn
 script:
   - cp env.example.js env.js
   - npm run lint
@@ -34,6 +32,8 @@ matrix:
         - echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
         - sudo apt-get update -qq
         - sudo apt-get install -y -qq yarn
+      install:
+        - yarn
       android:
         components:
           - build-tools-23.0.1
@@ -53,7 +53,9 @@ matrix:
         - node --version
         - npm install -g yarn
         - yarn -version
+      install:
         - gem install xcpretty
+        - yarn
       xcode_project: ios/PepperoniAppTemplate.xcodeproj
       xcode_scheme: ios/PepperoniAppTemplateTests
       script:
```

---

### Incident Patch 9: `77a1e39b` (2017-02-26)
**Commit Message**: Merge pull request #183 from futurice/update/redux-dev-tools

Add Redux Dev Tools (via React Native Debugger)

**File**: `README.md` (modified, +13/-0)
```diff
@@ -112,6 +112,19 @@ $ npm run coverage
 
 Read the **[Testing guide](docs/TESTING.md)** for more information about writing tests.
 
+## Debugging
+
+For standard debugging select *Debug JS Remotely* from the React Native Development context menu (To open the context menu, press *CMD+D* in iOS or *D+D* in Android). This will open a new Chrome tab under [http://localhost:8081/debugger-ui](http://localhost:8081/debugger-ui) and prints all actions to the console.
+
+For advanced debugging under **macOS** we suggest using the standalone [React Native Debugger](https://github.com/jhen0409/react-native-debugger), which is based on the official debugger of React Native.
+It includes the React Inspector and Redux DevTools so you can inspect React views and get a detailed history of the Redux state.
+
+You can install it via [brew](https://brew.sh/) and run it as a standalone app:
+```
+$ brew update && brew cask install react-native-debugger
+```
+> Note: Make sure you close all active chrome debugger tabs and then restart the debugger from the React Native Development context menu.
+
 ## Deployment
 
 Read the **[Deployment guide](docs/DEPLOYMENT.md)** to learn how to deploy the application to test devices, app stores, and how to use Code Push to push updates to your users immediately.
```

**File**: `package.json` (modified, +1/-0)
```diff
@@ -65,6 +65,7 @@
     "istanbul": "1.0.0-alpha.2",
     "jest": "^17.0.2",
     "react-addons-test-utils": "~15.4.2",
+    "remote-redux-devtools": "^0.5.7",
     "react-native-mock": "~0.2.5",
     "react-test-renderer": "~15.4.2",
     "rimraf": "^2.5.2"
```

**File**: `src/redux/store.js` (modified, +12/-3)
```diff
@@ -1,13 +1,22 @@
 import {applyMiddleware, createStore, compose} from 'redux';
 import * as reduxLoop from 'redux-loop';
-
 import middleware from './middleware';
 import reducer from './reducer';
 
-const enhancer = compose(
+const enhancers = [
   applyMiddleware(...middleware),
   reduxLoop.install()
-);
+];
+
+/* Enable redux dev tools only in development.
+ * We suggest using the standalone React Native Debugger extension:
+ * https://github.com/jhen0409/react-native-debugger
+ */
+/* eslint-disable no-undef */
+const composeEnhancers = (__DEV__ && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) || compose;
+/* eslint-enable no-undef */
+
+const enhancer = composeEnhancers(...enhancers);
 
 // create the store
 const store = createStore(
```

**File**: `yarn.lock` (modified, +349/-228)
```diff
@@ -2,7 +2,7 @@
 # yarn lockfile v1
 
 
-abab@^1.0.0:
+abab@^1.0.3:
   version "1.0.3"
   resolved "https://registry.yarnpkg.com/abab/-/abab-1.0.3.tgz#b81de5f7274ec4e756d797cd834f303642724e5d"
 
@@ -28,37 +28,33 @@ accepts@~1.3.0:
     mime-types "~2.1.11"
     negotiator "0.6.1"
 
-acorn-globals@^1.0.4:
-  version "1.0.9"
-  resolved "https://registry.yarnpkg.com/acorn-globals/-/acorn-globals-1.0.9.tgz#55bb5e98691507b74579d0513413217c380c54cf"
+acorn-globals@^3.1.0:
+  version "3.1.0"
+  resolved "https://registry.yarnpkg.com/acorn-globals/-/acorn-globals-3.1.0.tgz#fd8270f71fbb4996b004fa880ee5d46573a731bf"
   dependencies:
-    acorn "^2.1.0"
+    acorn "^4.0.4"
 
-acorn-jsx@^3.0.0, acorn-jsx@^3.0.1:
+acorn-jsx@^3.0.0:
   version "3.0.1"
   resolved "https://registry.yarnpkg.com/acorn-jsx/-/acorn-jsx-3.0.1.tgz#afdf9488fb1ecefc8348f6fb22f464e32a58b36b"
   dependencies:
     acorn "^3.0.4"
 
-acorn@^2.1.0, acorn@^2.4.0:
-  version "2.7.0"
-  resolved "https://registry.yarnpkg.com/acorn/-/acorn-2.7.0.tgz#ab6e7d9d886aaca8b085bc3312b79a198433f0e7"
+acorn@4.0.4, acorn@^4.0.4:
+  version "4.0.4"
+  resolved "https://registry.yarnpkg.com/acorn/-/acorn-4.0.4.tgz#17a8d6a7a6c4ef538b814ec9abac2779293bf30a"
 
 acorn@^3.0.4:
   version "3.3.0"
   resolved "https://registry.yarnpkg.com/acorn/-/acorn-3.3.0.tgz#45e37fb39e8da3f25baee3ff5369e2bb5f22017a"
 
-acorn@^4.0.1:
-  version "4.0.4"
-  resolved "https://registry.yarnpkg.com/acorn/-/acorn-4.0.4.tgz#17a8d6a7a6c4ef538b814ec9abac2779293bf30a"
-
 ajv-keywords@^1.0.0:
   version "1.5.1"
   resolved "https://registry.yarnpkg.com/ajv-keywords/-/ajv-keywords-1.5.1.tgz#314dd0a4b3368fad3dfcdc54ede6171b886daf3c"
 
 ajv@^4.7.0:
-  version "4.11.2"
-  resolved "https://registry.yarnpkg.com/ajv/-/ajv-4.11.2.tgz#f166c3c11cbc6cb9dcc102a5bcfe5b72c95287e6"
+  version "4.11.3"
+  resolved "https://registry.yarnpkg.com/ajv/-/ajv-4.11.3.tgz#ce30bdb90d1254f762c75af915fb3a63e7183d22"
   dependencies:
     co "^4.6.0"
     json-stable-stringify "^1.0.1"
@@ -194,8 +190,8 @@ async@1.x, async@^1.4.0, async@^1.4.2:
   resolved "https://registry.yarnpkg.com/async/-/async-1.5.2.tgz#ec6a61ae56480c0c3cb241c95618e20892f9672a"
 
 async@^2.0.1, async@^2.1.4:
-  version "2.1.4"
-  resolved "https://registry.yarnpkg.com/async/-/async-2.1.4.tgz#2d2160c7788032e4dd6cbe2502f1f9a2c8f6cde4"
+  version "2.1.5"
+  resolved "https://registry.yarnpkg.com/async/-/async-2.1.5.tgz#e587c68580994ac67fc56ff86d3ac56bdbe810bc"
   dependencies:
     lodash "^4.14.0"
 
@@ -212,8 +208,8 @@ aws-sign2@~0.6.0:
   resolved "https://registry.yarnpkg.com/aws-sign2/-/aws-sign2-0.6.0.tgz#14342dd38dbcc94d0e5b87d763cd63612c0e794f"
 
 aws4@^1.2.1:
-  version "1.5.0"
-  resolved "https://registry.yarnpkg.com/aws4/-/aws4-1.5.0.tgz#0a29ffb79c31c9e712eeb087e8e7a64b4a56d755"
+  version "1.6.0"
+  resolved "https://registry.yarnpkg.com/aws4/-/aws4-1.6.0.tgz#83ef5ca860b2b32e4a0deedee8c771b9db57471e"
 
 babel-code-frame@^6.16.0, babel-code-frame@^6.22.0:
   version "6.22.0"
@@ -223,19 +219,19 @@ babel-code-frame@^6.16.0, babel-code-frame@^6.22.0:
     esutils "^2.0.2"
     js-tokens "^3.0.0"
 
-babel-core@^6.0.0, babel-core@^6.21.0, babel-core@^6.22.0, babel-core@^6.7.2, babel-core@^6.9.0:
-  version "6.22.1"
-  resolved "https://registry.yarnpkg.com/babel-core/-/babel-core-6.22.1.tgz#9c5fd658ba1772d28d721f6d25d968fc7ae21648"
+babel-core@^6.0.0, babel-core@^6.21.0, babel-core@^6.23.0, babel-core@^6.7.2, babel-core@^6.9.0:
+  version "6.23.1"
+  resolved "https://registry.yarnpkg.com/babel-core/-/babel-core-6.23.1.tgz#c143cb621bb2f621710c220c5d579d15b8a442df"
   dependencies:
     babel-code-frame "^6.22.0"
-    babel-generator "^6.22.0"
-    babel-helpers "^6.22.0"
-    babel-messages "^6.22.0"
-    babel-register "^6.22.0"
+    babel-generator "^6.23.0"
+    babel-helpers "^6.23.0"
+    babel-messages "^6.23.0"
+    babel-register "^6.23.0"
     babel-runtime "^6.22.0"
-    babel-template "^6.22.0"
-    babel-traverse "^6.22.1"
-    babel-types "^6.22.0"
+    babel-template "^6.23.0"
+    babel-traverse "^6.23.1"
+    babel-types "^6.23.0"
     babylon "^6.11.0"
     convert-source-map "^1.1.0"
     debug "^2.1.1"
@@ -257,17 +253,18 @@ babel-eslint@^7.1.0:
     babylon "^6.13.0"
     lodash.pickby "^4.6.0"
 
-babel-generator@^6.18.0, babel-generator@^6.21.0, babel-generator@^6.22.0:
-  version "6.22.0"
-  resolved "https://registry.yarnpkg.com/babel-generator/-/babel-generator-6.22.0.tgz#d642bf4961911a8adc7c692b0c9297f325cda805"
+babel-generator@^6.18.0, babel-generator@^6.21.0, babel-generator@^6.23.0:
+  version "6.23.0"
+  resolved "https://registry.yarnpkg.com/babel-generator/-/babel-generator-6.23.0.tgz#6b8edab956ef3116f79d8c84c5a3c05f32a74bc5"
   dependencies:
-    babel-messages "^6.22.0"
+    babel-messages "^6.23.0"
     babel-runtime "^6.22.0"
-    babel-types "^6.22.0"
+    babel-types "^6.23.0"
     detect-indent "^4.0.0"
     jsesc "^1.3.0"
     lodash "^4.2.0"
     source-map "^0.5.0"
+    trim-right "^1.0.1"
 
 babel-helper-bind
```

---

### Incident Patch 10: `47dfa71d` (2017-02-26)
**Commit Message**: Merge pull request #160 from FruitieX/switchtab-keys

switchTab supports both keys and indices

**File**: `src/components/TabBar.js` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ const TabBar = React.createClass({
           <TabBarButton
             key={'tab-bar-button-' + route.key}
             text={route.title}
-            action={() => this.props.switchTab(index)}
+            action={() => this.props.switchTab(route.key)}
             isSelected={index === this.props.currentTabIndex}
           />
         ))}
```

**File**: `src/modules/navigation/NavigationState.js` (modified, +13/-4)
```diff
@@ -1,6 +1,6 @@
 import {fromJS} from 'immutable';
-
 import {NavigationExperimental} from 'react-native';
+import {isNumber} from 'lodash';
 
 const {StateUtils: NavigationStateUtils} = NavigationExperimental;
 
@@ -9,10 +9,10 @@ const PUSH_ROUTE = 'NavigationState/PUSH_ROUTE';
 const POP_ROUTE = 'NavigationState/POP_ROUTE';
 const SWITCH_TAB = 'NavigationState/SWITCH_TAB';
 
-export function switchTab(index) {
+export function switchTab(key) {
   return {
     type: SWITCH_TAB,
-    payload: index
+    payload: key
   };
 }
 
@@ -87,7 +87,16 @@ export default function NavigationReducer(state = initialState, action) {
     case SWITCH_TAB: {
       // Switches the tab.
       const tabs = state.get('tabs').toJS();
-      const nextTabs = NavigationStateUtils.jumpToIndex(tabs, action.payload);
+
+      let nextTabs;
+      try {
+        nextTabs = isNumber(action.payload)
+          ? NavigationStateUtils.jumpToIndex(tabs, action.payload)
+          : NavigationStateUtils.jumpTo(tabs, action.payload);
+      } catch (e) {
+        nextTabs = tabs;
+      }
+
       if (tabs !== nextTabs) {
         return state.set('tabs', fromJS(nextTabs));
       }
```

**File**: `src/modules/navigation/NavigationViewContainer.js` (modified, +2/-2)
```diff
@@ -7,8 +7,8 @@ export default connect(
     navigationState: state.get('navigationState').toJS()
   }),
   dispatch => ({
-    switchTab(index) {
-      dispatch(switchTab(index));
+    switchTab(key) {
+      dispatch(switchTab(key));
     },
     pushRoute(index) {
       dispatch(pushRoute(index));
```

---

### Incident Patch 11: `a06379dc` (2017-02-26)
**Commit Message**: Configure travis to build android and ios versions of pepperoni

**File**: `.gitignore` (modified, +5/-0)
```diff
@@ -60,3 +60,8 @@ yarn-error.log
 fastlane/report.xml
 fastlane/Preview.html
 fastlane/screenshots
+
+# React Native bundles
+
+ios/PepperoniAppTemplate/main.jsbundle
+ios/PepperoniAppTemplate/main.jsbundle.meta
```

**File**: `.travis.yml` (modified, +66/-11)
```diff
@@ -1,11 +1,66 @@
-language: node_js
-node_js:
-  - "6.9"
-  - "7.1"
-sudo: false
-env:
-  - NODE_ENV='test'
-script:
-  - cp env.example.js env.js
-  - npm run lint
-  - npm test
+matrix:
+  include:
+    - language: node_js
+      cache: yarn
+      node_js:
+        - "6.9"
+        - "7.1"
+      sudo: false
+      env:
+        - NODE_ENV='test'
+      script:
+        - cp env.example.js env.js
+        - npm run lint
+        - npm test
+        - npm run bundle:ios
+    - language: android
+      os: linux
+      jdk: oraclejdk7
+      before_cache:
+        - rm -f  $HOME/.gradle/caches/modules-2/modules-2.lock
+        - rm -fr $HOME/.gradle/caches/*/plugin-resolution/
+      cache:
+        directories:
+          - $HOME/.yarn-cache
+          - $HOME/.gradle/caches/
+          - $HOME/.gradle/wrapper/
+      sudo: required
+      before_install:
+        - nvm install 7
+        - node --version
+        - curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
+        - echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
+        - sudo apt-get update -qq
+        - sudo apt-get install -y -qq yarn
+      install:
+        - yarn
+      android:
+        components:
+          - build-tools-23.0.1
+          - android-23
+          - extra-android-m2repository
+          - extra-google-google_play_services
+          - extra-google-m2repository
+          - addon-google_apis-google-16
+      script:
+        - cd android && ./gradlew assembleDebug && ./gradlew assembleRelease
+    - language: objective-c
+      os: osx
+      osx_image: xcode8.2
+      cache:
+        directories:
+          - $HOME/.yarn-cache
+      before_install:
+        - nvm install 7
+        - node --version
+        - npm install -g yarn
+        - yarn -version
+      install:
+        - gem install xcpretty
+        - yarn
+      xcode_project: ios/PepperoniAppTemplate.xcodeproj
+      xcode_scheme: ios/PepperoniAppTemplateTests
+      script:
+        - cd ios
+        - xcodebuild -scheme PepperoniAppTemplate -sdk iphonesimulator ONLY_ACTIVE_ARCH=NO | xcpretty
+        - xctool run-tests -scheme PepperoniAppTemplate -sdk iphonesimulator ONLY_ACTIVE_ARCH=NO
```

**File**: `ios/PepperoniAppTemplateTests/PepperoniAppTemplateTests.m` (modified, +3/-3)
```diff
@@ -13,8 +13,8 @@
 #import <React/RCTLog.h>
 #import <React/RCTRootView.h>
 
-#define TIMEOUT_SECONDS 600
-#define TEXT_TO_LOOK_FOR @"Welcome to React Native!"
+#define TIMEOUT_SECONDS 180
+#define TEXT_TO_LOOK_FOR @"Increment counter"
 
 @interface PepperoniAppTemplateTests : XCTestCase
 
@@ -35,7 +35,7 @@ - (BOOL)findSubviewInView:(UIView *)view matching:(BOOL(^)(UIView *view))test
   return NO;
 }
 
-- (void)testRendersWelcomeScreen
+- (void)testRendersMainScreen
 {
   UIViewController *vc = [[[[UIApplication sharedApplication] delegate] window] rootViewController];
   NSDate *date = [NSDate dateWithTimeIntervalSinceNow:TIMEOUT_SECONDS];
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
   "private": false,
   "scripts": {
     "start": "node node_modules/react-native/local-cli/cli.js start",
-    "bundle:ios": "node ./node_modules/react-native/local-cli/cli.js bundle --platform ios --entry-file index.ios.js --bundle-output ios/PepperoniAppTemplate/main.jsbundle --dev=false --minify --verbose",
+    "bundle:ios": "node ./node_modules/react-native/local-cli/cli.js bundle --platform ios --entry-file index.ios.js --bundle-output ios/PepperoniAppTemplate/main.jsbundle --dev=false --verbose",
     "test": "jest",
     "test:watch": "jest --watch",
     "lint": "eslint src test",
```

**File**: `src/modules/counter/CounterView.js` (modified, +10/-2)
```diff
@@ -65,20 +65,28 @@ const CounterView = React.createClass({
         {this.renderUserInfo()}
 
         <TouchableOpacity
+          accessible={true}
+          accessibilityLabel={'Increment counter'}
           onPress={this.increment}
           style={[styles.counterButton, loadingStyle]}>
           <Text style={styles.counter}>
             {this.props.counter}
           </Text>
         </TouchableOpacity>
 
-        <TouchableOpacity onPress={this.reset}>
+        <TouchableOpacity
+            accessible={true}
+            accessibilityLabel={'Reset counter'}
+            onPress={this.reset}>
           <Text style={styles.linkButton}>
             Reset
           </Text>
         </TouchableOpacity>
 
-        <TouchableOpacity onPress={this.random}>
+        <TouchableOpacity
+            accessible={true}
+            accessibilityLabel={'Randomize counter'}
+            onPress={this.random}>
           <Text style={styles.linkButton}>
             Random
           </Text>
```

---

### Incident Patch 12: `6e2fa4be` (2017-02-26)
**Commit Message**: Update reduxDevTools and use standalone RN debugger

**File**: `README.md` (modified, +11/-0)
```diff
@@ -112,6 +112,17 @@ $ npm run coverage
 
 Read the **[Testing guide](docs/TESTING.md)** for more information about writing tests.
 
+## Debugging
+
+For standard debugging select *Debug JS Remotely* from the React Native Development contect menu (To open it, press CMD+D in iOS or D+D in Android). This will open a new Chrome tab under http://localhost:8081/debugger-ui and logs all actions to the console.
+
+For advanced debugging we suggest using the standalone [React Native Debugger extension](https://github.com/jhen0409/react-native-debugger). With that you can inspect React views and get a detailed history of the Redux state.
+
+You can install it via brew using the following command:
+```
+$ brew update && brew cask install react-native-debugger
+```
+
 ## Deployment
 
 Read the **[Deployment guide](docs/DEPLOYMENT.md)** to learn how to deploy the application to test devices, app stores, and how to use Code Push to push updates to your users immediately.
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -46,7 +46,6 @@
     "redux-loop": "^2.1.0",
     "redux-promise": "^0.5.3",
     "redux-thunk": "^2.0.1",
-    "remote-redux-devtools": "^0.5.7",
     "standard-http-error": "^2.0.0"
   },
   "devDependencies": {
@@ -65,6 +64,7 @@
     "istanbul": "1.0.0-alpha.2",
     "jest": "^17.0.2",
     "react-addons-test-utils": "~15.4.2",
+    "remote-redux-devtools": "^0.5.7",
     "react-native-mock": "~0.2.5",
     "react-test-renderer": "~15.4.2",
     "rimraf": "^2.5.2"
```

**File**: `src/redux/store.js` (modified, +8/-5)
```diff
@@ -8,12 +8,15 @@ let enhancers = [
   reduxLoop.install()
 ];
 
-if (__DEV__) {
-  let devTools = require('remote-redux-devtools');
-  enhancers = [...enhancers, devTools()];
-}
+/* Enable redux dev tools only in development.
+ * We suggest using the standalone React Native Debugger extension:
+ * https://github.com/jhen0409/react-native-debugger
+ */
+/* eslint-disable no-undef */
+const composeEnhancers = (__DEV__ && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) || compose;
+/* eslint-enable no-undef */
 
-const enhancer = compose(...enhancers);
+const enhancer = composeEnhancers(...enhancers);
 
 // create the store
 const store = createStore(
```

---

### Incident Patch 13: `685cc9ac` (2017-02-09)
**Commit Message**: Change current iOS build version to 1.0.0

**File**: `ios/PepperoniAppTemplate/Info.plist` (modified, +2/-2)
```diff
@@ -15,7 +15,7 @@
     <key>CFBundlePackageType</key>
     <string>APPL</string>
     <key>CFBundleShortVersionString</key>
-    <string>1.0</string>
+    <string>1.0.0</string>
     <key>CFBundleSignature</key>
     <string>????</string>
     <key>CFBundleVersion</key>
@@ -62,4 +62,4 @@
       <string>Zocial.ttf</string>
     </array>
   </dict>
-</plist>
\ No newline at end of file
+</plist>
```

---

### Incident Patch 14: `bfbb9284` (2017-02-09)
**Commit Message**: iOS builds: Use version name and code from package.json

**File**: `package.json` (modified, +2/-1)
```diff
@@ -24,7 +24,8 @@
     "test": "jest",
     "test:watch": "jest --watch",
     "lint": "eslint src test",
-    "coverage": "rimraf coverage && jest --coverage"
+    "coverage": "rimraf coverage && jest --coverage",
+    "version": "support/version-ios.sh"
   },
   "jest": {
     "preset": "react-native"
```

**File**: `support/version-ios.sh` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+#!/bin/bash
+
+# adapted from: https://medium.com/@andr3wjack/versioning-react-native-apps-407469707661
+
+PROJECT_DIR="ios/PepperoniAppTemplate"
+INFOPLIST_FILE="Info.plist"
+INFOPLIST_DIR="${PROJECT_DIR}/${INFOPLIST_FILE}"
+
+# get package version from package.json
+PACKAGE_VERSION=$(cat package.json | grep -m1 \"version\": | cut -d'"' -f4)
+
+# get build number from plist, increment it
+BUILD_NUMBER=$(/usr/libexec/PlistBuddy -c "Print CFBundleVersion" "${INFOPLIST_DIR}")
+BUILD_NUMBER=$(($BUILD_NUMBER + 1))
+
+# update plist with new values
+/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString ${PACKAGE_VERSION#*v}" "${INFOPLIST_DIR}"
+/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD_NUMBER" "${INFOPLIST_DIR}"
+
+git add "${INFOPLIST_DIR}"
```

---

### Incident Patch 15: `9e17de00` (2017-02-09)
**Commit Message**: Android builds: Use version name and code from package.json

**File**: `android/app/build.gradle` (modified, +2/-2)
```diff
@@ -90,8 +90,8 @@ android {
         applicationId "com.pepperoniapptemplate"
         minSdkVersion 16
         targetSdkVersion 22
-        versionCode 1
-        versionName "1.0"
+        versionCode versionMajor * 10000 + versionMinor * 100 + versionPatch
+        versionName "${versionMajor}.${versionMinor}.${versionPatch}"
         ndk {
             abiFilters "armeabi-v7a", "x86"
         }
```

**File**: `android/build.gradle` (modified, +22/-0)
```diff
@@ -1,5 +1,27 @@
 // Top-level build file where you can add configuration options common to all sub-projects/modules.
 
+import groovy.json.JsonSlurper
+
+def getNpmVersion() {
+    def inputFile = new File("../package.json")
+    def packageJson = new JsonSlurper().parseText(inputFile.text)
+    return packageJson["version"]
+}
+
+def getNpmVersionArray() { // major [0], minor [1], patch [2]
+    def (major, minor, patch) = getNpmVersion().tokenize('.')
+    return [Integer.parseInt(major), Integer.parseInt(minor), Integer.parseInt(patch)] as int[]
+}
+
+subprojects {
+    ext {
+        def npmVersion = getNpmVersionArray()
+        versionMajor = npmVersion[0]
+        versionMinor = npmVersion[1]
+        versionPatch = npmVersion[2]
+    }
+}
+
 buildscript {
     repositories {
         jcenter()
```

#### Recent Merged Pull Requests:
- **PR #252** (closed): Bump moment from 2.19.1 to 2.29.2 (@dependabot[bot])
- **PR #250** (closed): Bump lodash from 4.17.13 to 4.17.19 (@dependabot[bot])
- **PR #248** (2019-11-19): Mark pepperoni as deprecated (@tino-junge)
- **PR #247** (2019-11-19): Bump lodash from 4.17.4 to 4.17.13 (@dependabot[bot])
- **PR #241** (closed): Added proper documentation for reasonaboutability (@tino-junge)
- **PR #240** (closed): Update to RN 0.57.2 (@tino-junge)
- **PR #239** (closed): Remove package-lock to avoid inconsistencies with yarn.lock (@tino-junge)
- **PR #238** (closed): [Chore] Add integrity sha entries for packages in yarn.lock (@tino-junge)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
