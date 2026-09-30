# Forensic Learning Record (Deep Inspection): futurice/pepperoni-app-kit

> **Canonical Artifact**: `07_PROJECT_LEARNING/futurice-pepperoni-app-kit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/futurice/pepperoni-app-kit](https://github.com/futurice/pepperoni-app-kit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:16:50.745Z  
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

### Core Architecture Module: `src/components/DeveloperMenu.ios.js`
```
import React, {Component} from 'react';
import * as snapshot from '../utils/snapshot';

import {
  TouchableOpacity,
  ActionSheetIOS,
  StyleSheet
} from 'react-native';

/**
 * Simple developer menu, which allows e.g. to clear the app state.
 * It can be accessed through a tiny button in the bottom right corner of the screen.
 * ONLY FOR DEVELOPMENT MODE!
 */
class DeveloperMenu extends Component {
  static displayName = 'DeveloperMenu';

  showDeveloperMenu() {
    const options = {
      clearState: 0,
      showLogin: 1,
      cancel: 2
    };

    const callback = async index => {
      if (index === options.clearState) {
        await snapshot.clearSnapshot();
        console.warn('(╯°□°）╯︵ ┻━┻ \nState cleared, Cmd+R to reload the application now');
      }
    };

    ActionSheetIOS.showActionSheetWithOptions({
      options: [
        'Clear state',
        'Cancel'
      ],
      cancelButtonIndex: options.cancel
    }, callback);
  }

  render() {
    if (!__DEV__) {
      return null;
    }

    return (
      <TouchableOpacity
        style={styles.circle}
        onPress={this.showDeveloperMenu}
        />
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
  }
});

export default DeveloperMenu;

```

### Core Architecture Module: `src/components/DeveloperMenu.js`
```
import React from 'react';
import {View} from 'react-native';

// For tests
const DeveloperMenu = () => <View/>;
export default DeveloperMenu;

```

### Core Architecture Module: `src/modules/AppView.android.js`
```
import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {View, StyleSheet, StatusBar, ActivityIndicator, BackHandler} from 'react-native';
import NavigatorViewContainer from './navigator/NavigatorViewContainer';
import * as snapshotUtil from '../utils/snapshot';
import * as SessionStateActions from '../modules/session/SessionState';
import store from '../redux/store';
import DeveloperMenu from '../components/DeveloperMenu';

import {NavigationActions} from 'react-navigation';

class AppView extends Component {
  static displayName = 'AppView';

  static propTypes = {
    isReady: PropTypes.bool.isRequired,
    dispatch: PropTypes.func.isRequired
  };

  navigateBack() {
    const navigatorState = store.getState().get('navigatorState');

    const currentStackScreen = navigatorState.get('index');
    const currentTab = navigatorState.getIn(['routes', 0, 'index']);

    if (currentTab !== 0 || currentStackScreen !== 0) {
      store.dispatch(NavigationActions.back());
      return true;
    }

    // otherwise let OS handle the back button action
    return false;
  }

  componentWillMount() {
    BackHandler.addEventListener('hardwareBackPress', this.navigateBack);
  }

  componentDidMount() {
    snapshotUtil.resetSnapshot()
      .then(snapshot => {
        const {dispatch} = this.props;

        if (snapshot) {
          dispatch(SessionStateActions.resetSessionStateFromSnapshot(snapshot));
        } else {
          dispatch(SessionStateActions.initializeSessionState());
        }

        store.subscribe(() => {
          snapshotUtil.saveSnapshot(store.getState());
        });
      });
  }

  render() {
    if (!this.props.isReady) {
      return (
        <View style={{flex: 1}}>
          <ActivityIndicator style={styles.centered} />
        </View>
      );
    }

    return (
      <View style={{flex: 1}}>
        <StatusBar backgroundColor='#455a64' barStyle='light-content' />
        <NavigatorViewContainer />
        {__DEV__ && <DeveloperMenu />}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignSelf: 'center'
  }
});

export default AppView;

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

### Incident Patch 1: `143f8a89` (2017-07-25)
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

### Incident Patch 2: `192effea` (2017-03-08)
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

---

### Incident Patch 3: `89e1d2bf` (2017-03-08)
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

---

### Incident Patch 4: `1f8de9e1` (2017-03-07)
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

---

### Incident Patch 5: `8f792d44` (2017-02-27)
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

### Incident Patch 6: `6e2fa4be` (2017-02-26)
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

### Incident Patch 7: `3e265c6d` (2016-12-01)
**Commit Message**: Fix jest-react-native to 17.0.2 (#159)

We need to use this specific version for compatibility

**File**: `package.json` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@
     "fetch-mock": "^5.5.0",
     "istanbul": "1.0.0-alpha.2",
     "jest": "^17.0.2",
-    "jest-react-native": "^17.0.2",
+    "jest-react-native": "~17.0.2",
     "react-addons-test-utils": "~15.3.2",
     "react-native-mock": "~0.2.5",
     "react-test-renderer": "^15.3.2",
```

---

### Incident Patch 8: `e3331187` (2016-11-23)
**Commit Message**: Fix unresolvable ReactUpdate (#153)

**File**: `package.json` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@
     "immutable": "^3.7.6",
     "lodash": "^4.11.0",
     "moment": "^2.12.0",
-    "react": "^15.3.2",
+    "react": "~15.3.2",
     "react-dom": "~15.2.0",
     "react-native": "^0.35.0",
     "react-native-lock": "futurice/react-native-lock#feature/customizedTheme",
```

---

### Incident Patch 9: `f6a60c22` (2016-11-05)
**Commit Message**: Merge pull request #145 from futurice/fix/nav-header-title

Fix/ Missing Navigation Title

**File**: `src/modules/navigation/NavigationView.js` (modified, +1/-5)
```diff
@@ -2,7 +2,6 @@ import React, {PropTypes} from 'react';
 import {
   NavigationExperimental,
   View,
-  Platform,
   StyleSheet
 } from 'react-native';
 const {
@@ -13,8 +12,6 @@ const {
 import AppRouter from '../AppRouter';
 import TabBar from '../../components/TabBar';
 
-// Height duplicated from React Native NavigationHeader component
-const APP_BAR_HEIGHT = Platform.OS === 'ios' ? 64 : 56;
 // Customize bottom tab bar height here if desired
 const TAB_BAR_HEIGHT = 50;
 
@@ -66,7 +63,7 @@ const NavigationView = React.createClass({
           key={'stack_' + tabKey}
           onNavigateBack={this.props.onNavigateBack}
           navigationState={scenes}
-          renderOverlay={this.renderHeader}
+          renderHeader={this.renderHeader}
           renderScene={this.renderScene}
         />
         <TabBar
@@ -86,7 +83,6 @@ const styles = StyleSheet.create({
   },
   sceneContainer: {
     flex: 1,
-    marginTop: APP_BAR_HEIGHT,
     marginBottom: TAB_BAR_HEIGHT
   }
 });
```

---

### Incident Patch 10: `10e0d131` (2016-11-04)
**Commit Message**: Merge pull request #144 from futurice/fix/ios-setup-readme

Add note to use .xworkspace file to iOS setup

**File**: `docs/SETUP.md` (modified, +2/-0)
```diff
@@ -39,6 +39,8 @@ Create a blank configuration file
 3. Build the app and run the simulator:
 
         $ react-native run-ios
+        
+**Note: When you want to run the app with Xcode, you need to open the `.xcworkspace` file instead of the `.xcodeproj` file**
 
 ### Running the Android application
 
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
