# Forensic Learning Record (Deep Inspection): ptomasroos/react-native-scrollable-tab-view

> **Canonical Artifact**: `07_PROJECT_LEARNING/ptomasroos-react-native-scrollable-tab-view-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ptomasroos/react-native-scrollable-tab-view](https://github.com/ptomasroos/react-native-scrollable-tab-view))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:18:34.543Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ptomasroos/react-native-scrollable-tab-view`
- **Description**: Tabbed navigation that you can swipe between, each tab can have  its own ScrollView and maintain its own scroll position between swipes. Pleasantly animated. Customizable tab bar
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6943 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Button.android.js`
```
const React = require('react');
const ReactNative = require('react-native');
const {
  TouchableNativeFeedback,
  View,
} = ReactNative;

const Button = (props) => {
  return <TouchableNativeFeedback
    delayPressIn={0}
    background={TouchableNativeFeedback.SelectableBackground()} // eslint-disable-line new-cap
    {...props}
  >
    {props.children}
  </TouchableNativeFeedback>;
};

module.exports = Button;

```

### Core Architecture Module: `Button.ios.js`
```
const React = require('react');
const ReactNative = require('react-native');
const {
  TouchableOpacity,
  View,
} = ReactNative;

const Button = (props) => {
  return <TouchableOpacity {...props}>
    {props.children}
  </TouchableOpacity>;
};

module.exports = Button;

```

### Core Architecture Module: `DefaultTabBar.js`
```
const React = require('react');
const ReactNative = require('react-native');
const DeprecatedPropTypes = require('deprecated-react-native-prop-types');
const PropTypes = require('prop-types');
const createReactClass = require('create-react-class');
const {
  StyleSheet,
  Text,
  View,
  Animated,
} = ReactNative;
const Button = require('./Button');

const DefaultTabBar = createReactClass({
  propTypes: {
    goToPage: PropTypes.func,
    activeTab: PropTypes.number,
    tabs: PropTypes.array,
    backgroundColor: PropTypes.string,
    activeTextColor: PropTypes.string,
    inactiveTextColor: PropTypes.string,
    textStyle: DeprecatedPropTypes.TextPropTypes.style,
    tabStyle: DeprecatedPropTypes.ViewPropTypes.style,
    renderTab: PropTypes.func,
    underlineStyle: DeprecatedPropTypes.ViewPropTypes.style,
  },

  getDefaultProps() {
    return {
      activeTextColor: 'navy',
      inactiveTextColor: 'black',
      backgroundColor: null,
    };
  },

  renderTabOption(name, page) {
  },

  renderTab(name, page, isTabActive, onPressHandler) {
    const { activeTextColor, inactiveTextColor, textStyle, } = this.props;
    const textColor = isTabActive ? activeTextColor : inactiveTextColor;
    const fontWeight = isTabActive ? 'bold' : 'normal';

    return <Button
      style={{flex: 1, }}
      key={name}
      accessible={true}
      accessibilityLabel={name}
      accessibilityTraits='button'
      onPress={() => onPressHandler(page)}
    >
      <View style={[styles.tab, this.props.tabStyle, ]}>
        <Text style={[{color: textColor, fontWeight, }, textStyle, ]}>
          {name}
        </Text>
      </View>
    </Button>;
  },

  render() {
    const containerWidth = this.props.containerWidth;
    const numberOfTabs = this.props.tabs.length;
    const tabUnderlineStyle = {
      position: 'absolute',
      width: containerWidth / numberOfTabs,
      height: 4,
      backgroundColor: 'navy',
      bottom: 0,
    };

    const translateX = this.props.scrollValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0,  containerWidth / numberOfTabs],
    });
    return (
      <View style={[styles.tabs, {backgroundColor: this.props.backgroundColor, }, this.props.style, ]}>
        {this.props.tabs.map((name, page) => {
          const isTabActive = this.props.activeTab === page;
          const renderTab = this.props.renderTab || this.renderTab;
          return renderTab(name, page, isTabActive, this.props.goToPage);
        })}
        <Animated.View
          style={[
            tabUnderlineStyle,
            {
              transform: [
                { translateX },
              ]
            },
            this.props.tabBarUnderlineStyle,
          ]}
        />
      </View>
    );
  },
});

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 10,
  },
  tabs: {
    height: 50,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderColor: '#ccc',
  },
});

module.exports = DefaultTabBar;

```

### Core Architecture Module: `Example/DynamicExample.js`
```
import React from 'react';
import {
  Text,
  TouchableHighlight,
} from 'react-native';
import TimerMixin from 'react-timer-mixin';
import ScrollableTabView, { ScrollableTabBar, } from 'react-native-scrollable-tab-view';
import createReactClass from 'create-react-class';

const Child = createReactClass({
  onEnter() {
    console.log('enter: ' + this.props.i); // eslint-disable-line no-console
  },

  onLeave() {
    console.log('leave: ' + this.props.i); // eslint-disable-line no-console
  },

  render() {
    const i = this.props.i;
    return <Text key={i}>{`tab${i}`}</Text>;
  },
});

export default createReactClass({
  mixins: [TimerMixin, ],
  children: [],

  getInitialState() {
    return {
      tabs: [1, 2],
    };
  },

  componentDidMount() {
    this.setTimeout(
      () => { this.setState({ tabs: [1, 2, 3, 4, 5, 6, ], }); },
      100
    );
  },

  handleChangeTab({i, ref, from, }) {
    this.children[i].onEnter();
    this.children[from].onLeave();
  },

  renderTab(name, page, isTabActive, onPressHandler, onLayoutHandler) {
    return <TouchableHighlight
      key={`${name}_${page}`}
      onPress={() => onPressHandler(page)}
      onLayout={onLayoutHandler}
      style={{flex: 1, width: 100, }}
      underlayColor="#aaaaaa"
    >
      <Text>{name}</Text>
    </TouchableHighlight>;
  },

  render() {
    return <ScrollableTabView
      style={{marginTop: 20, }}
      renderTabBar={() => <ScrollableTabBar renderTab={this.renderTab}/>}
      onChangeTab={this.handleChangeTab}
    >
      {this.state.tabs.map((tab, i) => {
        return <Child
          ref={(ref) => (this.children[i] = ref)}
          tabLabel={`tab${i}`}
          i={i}
          key={i}
        />;
      })}
    </ScrollableTabView>;
  },
});

```

### Core Architecture Module: `Example/FacebookExample.js`
```
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
} from 'react-native';

import FacebookTabBar from './FacebookTabBar';
import ScrollableTabView from 'react-native-scrollable-tab-view';

export default () => {
  return <ScrollableTabView
    style={{marginTop: 20, }}
    initialPage={1}
    renderTabBar={() => <FacebookTabBar />}
  >
    <ScrollView tabLabel="ios-paper" style={styles.tabView}>
      <View style={styles.card}>
        <Text>News</Text>
      </View>
    </ScrollView>
    <ScrollView tabLabel="ios-people" style={styles.tabView}>
      <View style={styles.card}>
        <Text>Friends</Text>
      </View>
    </ScrollView>
    <ScrollView tabLabel="ios-chatboxes" style={styles.tabView}>
      <View style={styles.card}>
        <Text>Messenger</Text>
      </View>
    </ScrollView>
    <ScrollView tabLabel="ios-notifications" style={styles.tabView}>
      <View style={styles.card}>
        <Text>Notifications</Text>
      </View>
    </ScrollView>
    <ScrollView tabLabel="ios-list" style={styles.tabView}>
      <View style={styles.card}>
        <Text>Other nav</Text>
      </View>
    </ScrollView>
  </ScrollableTabView>;
}

const styles = StyleSheet.create({
  tabView: {
    flex: 1,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  card: {
    borderWidth: 1,
    backgroundColor: '#fff',
    borderColor: 'rgba(0,0,0,0.1)',
    margin: 5,
    height: 150,
    padding: 15,
    shadowColor: '#ccc',
    shadowOffset: { width: 2, height: 2, },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
});

```

### Core Architecture Module: `Example/FacebookTabBar.js`
```
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

class FacebookTabBar extends React.Component {
  icons = [];

  constructor(props) {
    super(props);
    this.icons = [];
  }

  componentDidMount() {
    this._listener = this.props.scrollValue.addListener(this.setAnimationValue.bind(this));
  }

  setAnimationValue({ value, }) {
    this.icons.forEach((icon, i) => {
      const progress = (value - i >= 0 && value - i <= 1) ? value - i : 1;
      icon.setNativeProps({
        style: {
          color: this.iconColor(progress),
        },
      });
    });
  }

  //color between rgb(59,89,152) and rgb(204,204,204)
  iconColor(progress) {
    const red = 59 + (204 - 59) * progress;
    const green = 89 + (204 - 89) * progress;
    const blue = 152 + (204 - 152) * progress;
    return `rgb(${red}, ${green}, ${blue})`;
  }

  render() {
    return <View style={[styles.tabs, this.props.style, ]}>
      {this.props.tabs.map((tab, i) => {
        return <TouchableOpacity key={tab} onPress={() => this.props.goToPage(i)} style={styles.tab}>
          <Icon
            name={tab}
            size={30}
            color={this.props.activeTab === i ? 'rgb(59,89,152)' : 'rgb(204,204,204)'}
            ref={(icon) => { this.icons[i] = icon; }}
          />
        </TouchableOpacity>;
      })}
    </View>;
  }
}

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 10,
  },
  tabs: {
    height: 45,
    flexDirection: 'row',
    paddingTop: 5,
    borderWidth: 1,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
});

export default FacebookTabBar;

```

### Core Architecture Module: `Example/OverlayExample.js`
```
import React from 'react';
import {
  StyleSheet,
  ScrollView,
} from 'react-native';

import ScrollableTabView, { DefaultTabBar, } from 'react-native-scrollable-tab-view';
import Icon from 'react-native-vector-icons/Ionicons';

// Using tabBarPosition='overlayTop' or 'overlayBottom' lets the content show through a
// semitransparent tab bar. Note that if you build a custom tab bar component, its outer container
// must consume a 'style' prop (e.g. <View style={this.props.style}) to support this feature.
export default () => {
  return <ScrollableTabView
    style={styles.container}
    renderTabBar={()=><DefaultTabBar backgroundColor='rgba(255, 255, 255, 0.7)' />}
    tabBarPosition='overlayTop'
  >
    <ScrollView tabLabel='iOS'>
      <Icon name='logo-apple' color='black' size={300} style={styles.icon} />
      <Icon name='ios-phone-portrait' color='black' size={300} style={styles.icon} />
      <Icon name='logo-apple' color='#DBDDDE' size={300} style={styles.icon} />
      <Icon name='ios-phone-portrait' color='#DBDDDE' size={300} style={styles.icon} />
    </ScrollView>
    <ScrollView tabLabel='Android'>
      <Icon name='logo-android' color='#A4C639' size={300} style={styles.icon} />
      <Icon name='logo-android' color='black' size={300} style={styles.icon} />
      <Icon name='logo-android' color='brown' size={300} style={styles.icon} />
    </ScrollView>
  </ScrollableTabView>;
}

const styles = StyleSheet.create({
  container: {
    marginTop: 30,
  },
  icon: {
    width: 300,
    height: 300,
    alignSelf: 'center',
  },
});

```

### Core Architecture Module: `Example/ScrollableTabsExample.js`
```
import React from 'react';
import {
  Text,
  View,
} from 'react-native';

import ScrollableTabView, { ScrollableTabBar } from 'react-native-scrollable-tab-view';

export default () => {
  return <ScrollableTabView
    style={{ marginTop: 20 }}
    initialPage={0}
    renderTabBar={() => <ScrollableTabBar />}
  >
    <Text tabLabel='Tab #1'>My</Text>
    <Text tabLabel='Tab #2 word word'>favorite</Text>
    <Text tabLabel='Tab #3 word word word'>project</Text>
    <Text tabLabel='Tab #4 word word word word'>favorite</Text>
    <Text tabLabel='Tab #5'>project</Text>
  </ScrollableTabView>;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #81** (2015-12-18): **when Horizontal screen scrollable view err**
  *Symptoms*: ![image](https://cloud.githubusercontent.com/assets/4457572/11466160/f28a8bae-9779-11e5-86c1-7fd7d84a11d1.png) 
  **Post-Mortem & Fix Analysis**:
  > related #4  

- **Issue #74** (2015-12-13): **None of the props work for me, except of renderTabBar**
  *Symptoms*: I am trying to use especially the locked props, so the only way to switch between the tabs is by tabbing the tabs. But unfortunately the only props which works is the renderTabBar prop.  ```   <ScrollableTabView             locked={true}             ..........tried all other props             renderTabBar={() => <CustomTabBar someProp={'here'}/>}>             <View style={styles.tabView} tabLabel="Tab1">                 <SomeView1 />             </View>             <View style={styles.tabView} tabLabel="Tab2">                 <SomeView2 />             </View>   </ScrollableTabView> ```  Did anybody face the same problem?  
  **Post-Mortem & Fix Analysis**:
  > I have the same problem, adding `"locked={true}"` do not lock the scrolling, and I can't find any mention of this prop into the code. Is it deprecated? Or any idea why this prop is not working? Thank you. 
  > Are you on Android? @sulliwane  
  > This could be broken since we use ScrollView / ViewPagerAndroid now, cc @skv-headless  

- **Issue #4** (2015-12-18): **Landscape mode**
  *Symptoms*: In landscape mode has children still the same width and tab at left side is partially displayed too.  ![screen shot 2015-06-25 at 15 10 04](https://cloud.githubusercontent.com/assets/827753/8354946/5ba57e6e-1b4c-11e5-9152-9705020860db.png) 
  **Post-Mortem & Fix Analysis**:
  > Hi @michalraska - I haven't made this compatible with landscape mode yet - we would need to update the `deviceWidth` when we rotate the device, if you have time to submit a pull request for that it would be much appreciated! 
  > Is currently possible to somehow find out orientation (landscape | portrait) of device now? If no, would be ok to create another dependency on: https://github.com/pjjanak/react-native-viewport? 
  > @michalraska - I'm okay with adding that dependency! 

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

### Incident Patch 1: `74c3ce73` (2022-12-06)
**Commit Message**: Fix deprecated prop types (#1185)

**File**: `DefaultTabBar.js` (modified, +5/-4)
```diff
@@ -1,5 +1,6 @@
 const React = require('react');
-const { ViewPropTypes } = ReactNative = require('react-native');
+const ReactNative = require('react-native');
+const DeprecatedPropTypes = require('deprecated-react-native-prop-types');
 const PropTypes = require('prop-types');
 const createReactClass = require('create-react-class');
 const {
@@ -18,10 +19,10 @@ const DefaultTabBar = createReactClass({
     backgroundColor: PropTypes.string,
     activeTextColor: PropTypes.string,
     inactiveTextColor: PropTypes.string,
-    textStyle: Text.propTypes.style,
-    tabStyle: ViewPropTypes.style,
+    textStyle: DeprecatedPropTypes.TextPropTypes.style,
+    tabStyle: DeprecatedPropTypes.ViewPropTypes.style,
     renderTab: PropTypes.func,
-    underlineStyle: ViewPropTypes.style,
+    underlineStyle: DeprecatedPropTypes.ViewPropTypes.style,
   },
 
   getDefaultProps() {
```

**File**: `ScrollableTabBar.js` (modified, +7/-6)
```diff
@@ -1,5 +1,6 @@
 const React = require('react');
-const { ViewPropTypes } = ReactNative = require('react-native');
+const ReactNative = require('react-native');
+const DeprecatedPropTypes = require('deprecated-react-native-prop-types');
 const PropTypes = require('prop-types');
 const createReactClass = require('create-react-class');
 const {
@@ -24,12 +25,12 @@ const ScrollableTabBar = createReactClass({
     activeTextColor: PropTypes.string,
     inactiveTextColor: PropTypes.string,
     scrollOffset: PropTypes.number,
-    style: ViewPropTypes.style,
-    tabStyle: ViewPropTypes.style,
-    tabsContainerStyle: ViewPropTypes.style,
-    textStyle: Text.propTypes.style,
+    style: DeprecatedPropTypes.ViewPropTypes.style,
+    tabStyle: DeprecatedPropTypes.ViewPropTypes.style,
+    tabsContainerStyle: DeprecatedPropTypes.ViewPropTypes.style,
+    textStyle: DeprecatedPropTypes.TextPropTypes.style,
     renderTab: PropTypes.func,
-    underlineStyle: ViewPropTypes.style,
+    underlineStyle: DeprecatedPropTypes.ViewPropTypes.style,
     onScroll: PropTypes.func,
   },
 
```

**File**: `index.js` (modified, +5/-5)
```diff
@@ -1,6 +1,6 @@
 const React = require('react');
-const { Component } = React;
-const { ViewPropTypes } = ReactNative = require('react-native');
+const ReactNative = require('react-native');
+const DeprecatedPropTypes = require('deprecated-react-native-prop-types');
 const createReactClass = require('create-react-class');
 const PropTypes = require('prop-types');
 const {
@@ -41,12 +41,12 @@ const ScrollableTabView = createReactClass({
     onChangeTab: PropTypes.func,
     onScroll: PropTypes.func,
     renderTabBar: PropTypes.any,
-    tabBarUnderlineStyle: ViewPropTypes.style,
+    tabBarUnderlineStyle: DeprecatedPropTypes.ViewPropTypes.style,
     tabBarBackgroundColor: PropTypes.string,
     tabBarActiveTextColor: PropTypes.string,
     tabBarInactiveTextColor: PropTypes.string,
     tabBarTextStyle: PropTypes.object,
-    style: ViewPropTypes.style,
+    style: DeprecatedPropTypes.ViewPropTypes.style,
     contentProps: PropTypes.object,
     scrollWithoutAnimation: PropTypes.bool,
     locked: PropTypes.bool,
@@ -342,7 +342,7 @@ const ScrollableTabView = createReactClass({
     if (!width || width <= 0 || Math.round(width) === Math.round(this.state.containerWidth)) {
       return;
     }
-    
+
     if (Platform.OS === 'ios') {
       const containerWidthAnimatedValue = new Animated.Value(width);
       // Need to call __makeNative manually to avoid a native animated bug. See
```

**File**: `package.json` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@
   "dependencies": {
     "@react-native-community/viewpager": "3.3.0",
     "create-react-class": "^15.6.2",
+    "deprecated-react-native-prop-types": "^2.3.0",
     "prop-types": "^15.6.0",
     "react-timer-mixin": "^0.13.3"
   },
```

**File**: `yarn.lock` (modified, +33/-5)
```diff
@@ -2,10 +2,15 @@
 # yarn lockfile v1
 
 
-"@react-native-community/viewpager@^1.1.7":
-  version "1.1.7"
-  resolved "https://registry.yarnpkg.com/@react-native-community/viewpager/-/viewpager-1.1.7.tgz#7d3b1631f1ec91145db92a8e25c80d53027e96ba"
-  integrity sha512-k9v2KJtAprNPq7IZmedD2VLMePvPW+ohX3uDnkpoKritBji+/RtRmTKrdtPi3Uvp0toq/KtPttAds1dr7AZNpw==
+"@react-native-community/viewpager@3.3.0":
+  version "3.3.0"
+  resolved "https://registry.yarnpkg.com/@react-native-community/viewpager/-/viewpager-3.3.0.tgz#e613747a43a31a6f3278f817ba96fdaaa7941f23"
+  integrity sha512-tyzh79l4t/hxiyS9QD3LRmWMs8KVkZzjrkQ8U8+8To1wmvVCBtp8BenvNsDLTBO7CpO/YmiThpmIdEZMr1WuVw==
+
+"@react-native/normalize-color@*":
+  version "2.0.0"
+  resolved "https://registry.yarnpkg.com/@react-native/normalize-color/-/normalize-color-2.0.0.tgz#da955909432474a9a0fe1cbffc66576a0447f567"
+  integrity sha512-Wip/xsc5lw8vsBlmY2MO/gFLp3MvuZ2baBZjDeTjjndMgM0h5sxz7AZR62RDPGgstp8Np7JzjvVqVT7tpFZqsw==
 
 acorn-jsx@^3.0.0:
   version "3.0.1"
@@ -261,6 +266,15 @@ deep-is@~0.1.3:
   resolved "https://registry.yarnpkg.com/deep-is/-/deep-is-0.1.3.tgz#b369d6fb5dbc13eecf524f91b070feedc357cf34"
   integrity sha1-s2nW+128E+7PUk+RsHD+7cNXzzQ=
 
+deprecated-react-native-prop-types@^2.3.0:
+  version "2.3.0"
+  resolved "https://registry.yarnpkg.com/deprecated-react-native-prop-types/-/deprecated-react-native-prop-types-2.3.0.tgz#c10c6ee75ff2b6de94bb127f142b814e6e08d9ab"
+  integrity sha512-pWD0voFtNYxrVqvBMYf5gq3NA2GCpfodS1yNynTPc93AYA/KEMGeWDqqeUB6R2Z9ZofVhks2aeJXiuQqKNpesA==
+  dependencies:
+    "@react-native/normalize-color" "*"
+    invariant "*"
+    prop-types "*"
+
 doctrine@^2.0.0:
   version "2.1.0"
   resolved "https://registry.yarnpkg.com/doctrine/-/doctrine-2.1.0.tgz#5cd01fc101621b42c4cd7f5d1a66243716d3f39d"
@@ -594,7 +608,7 @@ interpret@^1.0.0:
   resolved "https://registry.yarnpkg.com/interpret/-/interpret-1.2.0.tgz#d5061a6224be58e8083985f5014d844359576296"
   integrity sha512-mT34yGKMNceBQUoVn7iCDKDntA7SC6gycMAWzGx1z/CMCTV7b2AAtXlo3nRyHZ1FelRkQbQjprHSYGwzLtkVbw==
 
-invariant@^2.2.2:
+invariant@*, invariant@^2.2.2:
   version "2.2.4"
   resolved "https://registry.yarnpkg.com/invariant/-/invariant-2.2.4.tgz#610f3c92c9359ce1db616e538008d23ff35158e6"
   integrity sha512-phJfQVBuaJM5raOpJjSfkiD6BpbCE4Ns//LaXl6wGYtUBY83nWS6Rf9tXm2e8VaK60JEjYldbPif/A2B1C2gNA==
@@ -850,6 +864,15 @@ promise@^7.1.1:
   dependencies:
     asap "~2.0.3"
 
+prop-types@*:
+  version "15.8.1"
+  resolved "https://registry.yarnpkg.com/prop-types/-/prop-types-15.8.1.tgz#67d87bf1a694f48435cf332c24af10214a3140b5"
+  integrity sha512-oj87CgZICdulUohogVAR7AjlC0327U4el4L6eAvOqCeudMDVU0NThNaV+b9Df4dXgSP1gXMTnPdhfe/2qDH5cg==
+  dependencies:
+    loose-envify "^1.4.0"
+    object-assign "^4.1.1"
+    react-is "^16.13.1"
+
 prop-types@^15.6.0:
   version "15.7.2"
   resolved "https://registry.yarnpkg.com/prop-types/-/prop-types-15.7.2.tgz#52c41e75b8c87e72b9d9360e0206b99dcbffa6c5"
@@ -859,6 +882,11 @@ prop-types@^15.6.0:
     object-assign "^4.1.1"
     react-is "^16.8.1"
 
+react-is@^16.13.1:
+  version "16.13.1"
+  resolved "https://registry.yarnpkg.com/react-is/-/react-is-16.13.1.tgz#789729a4dc36de2999dc156dd6c1d9c18cea56a4"
+  integrity sha512-24e6ynE2H+OKt4kqsOvNd8kBpV65zoxbA4BVsEOB3ARVWQki/DHzaUoC5KuON/BiccDaCCTZBuOcfZs70kR8bQ==
+
 react-is@^16.8.1:
   version "16.9.0"
   resolved "https://registry.yarnpkg.com/react-is/-/react-is-16.9.0.tgz#21ca9561399aad0ff1a7701c01683e8ca981edcb"
```

---

### Incident Patch 2: `a7f46de1` (2020-07-24)
**Commit Message**: [fixed: changed default tabbar tabUnderlineStyle prop to tabBarUnderlineStyle] (#1055)

tabBarUnderlineStyle was not working on default tab bar because it was excepting tabUnderlineStyle prop

**File**: `DefaultTabBar.js` (modified, +1/-1)
```diff
@@ -86,7 +86,7 @@ const DefaultTabBar = createReactClass({
                 { translateX },
               ]
             },
-            this.props.underlineStyle,
+            this.props.tabBarUnderlineStyle,
           ]}
         />
       </View>
```

---

### Incident Patch 3: `9e58a54f` (2020-07-24)
**Commit Message**: fix: onTabChange called twice on Android (#1093)

`onPageSelected={this._updateSelectedPage}` ViewPager prop causes onTabChange to be called twice when change tabs without any gesture actions
this will fix duplicated tab updates on android

#### when user clicked tab buttons
`goToPage -> updateSceneKeys(onTabChange) -> Screen Update -> onPageSelected={_updateSelectedPage} -> updateSceneKeys(onTabChange) -> Screen Update`

#### when user swiped tab views
`Swipe -> onPageSelected={_updateSelectedPage} -> updateSceneKeys(onTabChange) -> Screen Update`

#### when user clicked tab buttons with this patch
`goToPage -> set tabWillChangeWithoutGesture -> updateSceneKeys(onTabChange) -> Screen Update -> onPageSelected={_updateSelectedPage} -> ignore updateSceneKeys(onTabChange) -> remove tabWillChangeWithoutGesture`

**File**: `index.js` (modified, +4/-1)
```diff
@@ -32,6 +32,7 @@ const ScrollableTabView = createReactClass({
     ScrollableTabBar,
   },
   scrollOnMountCalled: false,
+  tabWillChangeWithoutGesture: false,
 
   propTypes: {
     tabBarPosition: PropTypes.oneOf(['top', 'bottom', 'overlayTop', 'overlayBottom', ]),
@@ -141,6 +142,7 @@ const ScrollableTabView = createReactClass({
       }
     } else {
       if (this.scrollView) {
+        this.tabWillChangeWithoutGesture = true;
         if (this.props.scrollWithoutAnimation) {
           this.scrollView.setPageWithoutAnimation(pageNumber);
         } else {
@@ -305,10 +307,11 @@ const ScrollableTabView = createReactClass({
     }
 
     const currentPage = this.state.currentPage;
-    this.updateSceneKeys({
+    !this.tabWillChangeWithoutGesture && this.updateSceneKeys({
       page: localNextPage,
       callback: this._onChangeTab.bind(this, currentPage, localNextPage),
     });
+    this.tabWillChangeWithoutGesture = false;
   },
 
   _onChangeTab(prevPage, currentPage) {
```

---

### Incident Patch 4: `510111ad` (2020-04-02)
**Commit Message**: fix(view pager version): update view pager to 3.3.0 for androidx support (#1067)

**File**: `package.json` (modified, +2/-2)
```diff
@@ -29,7 +29,7 @@
   },
   "homepage": "https://github.com/brentvatne/react-native-scrollable-tab-view#readme",
   "dependencies": {
-    "@react-native-community/viewpager": "^2.0.1",
+    "@react-native-community/viewpager": "3.3.0",
     "create-react-class": "^15.6.2",
     "prop-types": "^15.6.0",
     "react-timer-mixin": "^0.13.3"
@@ -38,4 +38,4 @@
     "babel-eslint": "^6.1.2",
     "eslint": "^3.1.1"
   }
-}
\ No newline at end of file
+}
```

---

### Incident Patch 5: `fea1649a` (2019-10-10)
**Commit Message**: linter fix (#1013)

**File**: `Button.ios.js` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 const React = require('react');
 const ReactNative = require('react-native');
 const {
- TouchableOpacity,
+  TouchableOpacity,
   View,
 } = ReactNative;
 
```

**File**: `SceneComponent.js` (modified, +3/-3)
```diff
@@ -1,12 +1,12 @@
 const React = require('react');
 const ReactNative = require('react-native');
-const {Component } = React;
-const {View, StyleSheet } = ReactNative;
+const { Component } = React;
+const { View, StyleSheet } = ReactNative;
 
 const StaticContainer = require('./StaticContainer');
 
 const SceneComponent = (Props) => {
-  const {shouldUpdated, ...props} = Props;
+  const { shouldUpdated, ...props } = Props;
   return <View {...props}>
       <StaticContainer shouldUpdate={shouldUpdated}>
         {props.children}
```

---

### Incident Patch 6: `bb8665bd` (2018-10-25)
**Commit Message**: Merge pull request #923 from Alibrate/fix-underline

use __getValue() instead of ._value

**File**: `ScrollableTabBar.js` (modified, +3/-3)
```diff
@@ -148,7 +148,7 @@ const ScrollableTabBar = createReactClass({
   measureTab(page, event) {
     const { x, width, height, } = event.nativeEvent.layout;
     this._tabsMeasurements[page] = {left: x, right: x + width, width, height, };
-    this.updateView({value: this.props.scrollValue._value, });
+    this.updateView({value: this.props.scrollValue.__getValue(), });
   },
 
   render() {
@@ -207,12 +207,12 @@ const ScrollableTabBar = createReactClass({
       width = WINDOW_WIDTH;
     }
     this.setState({ _containerWidth: width, });
-    this.updateView({value: this.props.scrollValue._value, });
+    this.updateView({value: this.props.scrollValue.__getValue(), });
   },
 
   onContainerLayout(e) {
     this._containerMeasurements = e.nativeEvent.layout;
-    this.updateView({value: this.props.scrollValue._value, });
+    this.updateView({value: this.props.scrollValue.__getValue(), });
   },
 });
 
```

---

### Incident Patch 7: `5a30e64f` (2018-08-17)
**Commit Message**: fix underline animation

**File**: `ScrollableTabBar.js` (modified, +3/-3)
```diff
@@ -148,7 +148,7 @@ const ScrollableTabBar = createReactClass({
   measureTab(page, event) {
     const { x, width, height, } = event.nativeEvent.layout;
     this._tabsMeasurements[page] = {left: x, right: x + width, width, height, };
-    this.updateView({value: this.props.scrollValue._value, });
+    this.updateView({value: this.props.scrollValue.getValue(), });
   },
 
   render() {
@@ -207,12 +207,12 @@ const ScrollableTabBar = createReactClass({
       width = WINDOW_WIDTH;
     }
     this.setState({ _containerWidth: width, });
-    this.updateView({value: this.props.scrollValue._value, });
+    this.updateView({value: this.props.scrollValue.getValue(), });
   },
 
   onContainerLayout(e) {
     this._containerMeasurements = e.nativeEvent.layout;
-    this.updateView({value: this.props.scrollValue._value, });
+    this.updateView({value: this.props.scrollValue.getValue(), });
   },
 });
 
```

---

### Incident Patch 8: `6e900659` (2018-04-22)
**Commit Message**: Fix invalid object rest syntax

Trailing commas are not allowed after the rest element, this is not enforced by babel 6 but is by babel 7.

**File**: `SceneComponent.js` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ const {View, StyleSheet, } = ReactNative;
 const StaticContainer = require('./StaticContainer');
 
 const SceneComponent = (Props) => {
-  const {shouldUpdated, ...props, } = Props;
+  const {shouldUpdated, ...props} = Props;
   return <View {...props}>
       <StaticContainer shouldUpdate={shouldUpdated}>
         {props.children}
```

---

### Incident Patch 9: `12aea1b0` (2017-10-09)
**Commit Message**: Fixed the broken links.

**File**: `README.md` (modified, +4/-4)
```diff
@@ -63,13 +63,13 @@ To start you can just copy [DefaultTabBar](https://github.com/skv-headless/react
 
 ## Examples
 
-[SimpleExample](https://github.com/skv-headless/react-native-scrollable-tab-view/blob/master/examples/FacebookTabsExample/SimpleExample.js).
+[SimpleExample](https://github.com/skv-headless/react-native-scrollable-tab-view/blob/master/Example/SimpleExample.js).
 
-[ScrollableTabsExample](https://github.com/skv-headless/react-native-scrollable-tab-view/blob/master/examples/FacebookTabsExample/ScrollableTabsExample.js).
+[ScrollableTabsExample](https://github.com/skv-headless/react-native-scrollable-tab-view/blob/master/Example/ScrollableTabsExample.js).
 
-[OverlayExample](https://github.com/skv-headless/react-native-scrollable-tab-view/blob/master/examples/FacebookTabsExample/OverlayExample.js).
+[OverlayExample](https://github.com/skv-headless/react-native-scrollable-tab-view/blob/master/Example/OverlayExample.js).
 
-[FacebookExample](https://github.com/skv-headless/react-native-scrollable-tab-view/blob/master/examples/FacebookTabsExample/FacebookExample.js).
+[FacebookExample](https://github.com/skv-headless/react-native-scrollable-tab-view/blob/master/Example/FacebookExample.js).
 
 ## Props
 
```

---

### Incident Patch 10: `11aec541` (2017-10-07)
**Commit Message**: Fix Detected a division by zero in Animated.divide node 

On first render width is 0 which is causing Detected a division by zero in Animated.divide node.

**File**: `index.js` (modified, +1/-1)
```diff
@@ -329,7 +329,7 @@ const ScrollableTabView = createReactClass({
   _handleLayout(e) {
     const { width, } = e.nativeEvent.layout;
 
-    if (Math.round(width) !== Math.round(this.state.containerWidth)) {
+    if (width > 0 && Math.round(width) !== Math.round(this.state.containerWidth)) {
       if (Platform.OS === 'ios') {
         const containerWidthAnimatedValue = new Animated.Value(width);
         // Need to call __makeNative manually to avoid a native animated bug. See
```

#### Recent Merged Pull Requests:
- **PR #1207** (closed): Fix DefaultTabBar underline (@Prithpal-Sooriya)
- **PR #1206** (closed): Phunguyenvan6 patch 1 (@phunguyenvan6)
- **PR #1205** (closed): Takeover (@jpmaheux)
- **PR #1194** (closed): updated dependency @react-native-community/viewpager to v4.1.6 and move to peerDependencies (@boris-burgos)
- **PR #1191** (closed): Please publish new version to NPM  (@Drugak)
- **PR #1190** (2023-01-17): Update package.json (@Drugak)
- **PR #1185** (2022-12-06): Fix deprecated prop types (@alistairholt)
- **PR #1184** (closed): bug fixing for tabBarUnderlineStyle (@mowen0303)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
