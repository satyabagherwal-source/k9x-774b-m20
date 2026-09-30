# Forensic Learning Record (Deep Inspection): xinthink/react-native-material-kit

> **Canonical Artifact**: `07_PROJECT_LEARNING/xinthink-react-native-material-kit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xinthink/react-native-material-kit](https://github.com/xinthink/react-native-material-kit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:38:57.560Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xinthink/react-native-material-kit`
- **Description**: Bringing Material Design to React Native
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4812 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
  root: true,
  extends: '@react-native-community',
  rules: {
    'prettier/prettier': ['error', {
      singleQuote: true,
      trailingComma: 'es5',
      printWidth: 110,
    }],
    semi: 'off',
    'react-native/no-inline-styles': 'off',
  },
};

```

### Core Architecture Module: `example/.eslintrc.js`
```
module.exports = {
  root: true,
  extends: '@react-native-community',
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    'prettier/prettier': ['error', {
      bracketSpacing: true,
      jsxBracketSameLine: true,
      singleQuote: true,
      trailingComma: 'all', // 'es5'
      printWidth: 120,
    }],
    semi: 'off',
    'react-native/no-inline-styles': 'off',
  },
};

```

### Core Architecture Module: `example/app/buttons.tsx`
```
/**
 * Created by ywu on 15/7/16.
 */
import React from 'react';
import { StyleSheet, Text, View, ScrollView, Image } from 'react-native';

import {
  ButtonStyles,
  ColoredRaisedButton,
  RaisedButton,
  FlatButton,
  Fab,
  ColoredFab,
  AccentFab,
  // MKColor,
  // setTheme,
  getTheme,
} from 'react-native-material-kit';

import appStyles from './styles';

const { buttonText, buttonTextAccent, buttonTextPrimary, coloredButtonText } = ButtonStyles;

// customize the material design theme
// setTheme({
//   primaryColor: MKColor.Teal,
//   accentColor: MKColor.Purple,
// });

const styles = Object.assign(
  {},
  appStyles,
  StyleSheet.create({
    buttonText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: 'white',
    },
    fab: {
      // width: 200,
      // height: 200,
      // borderRadius: 100,
    },
  }),
);

const Buttons = () => (
  <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
    <View style={styles.row}>
      <View style={styles.col}>
        <RaisedButton>
          <Text style={buttonText()}>BUTTON</Text>
        </RaisedButton>
        <Text style={styles.legendLabel}>Raised button</Text>
      </View>
      <View style={styles.col}>
        <ColoredRaisedButton>
          <Text style={coloredButtonText()}>BUTTON</Text>
        </ColoredRaisedButton>
        <Text style={styles.legendLabel}>Colored</Text>
      </View>
      <View style={styles.col}>
        {/* Or use AccentRaisedButton */}
        <ColoredRaisedButton
          style={{
            backgroundColor: getTheme().accentColor as any,
          }}>
          <Text style={[coloredButtonText(), styles.buttonText]}>BUTTON</Text>
        </ColoredRaisedButton>
        <Text style={styles.legendLabel}>Accent colored</Text>
      </View>
    </View>
    <View style={styles.row}>
      <View style={styles.col}>
        <Fab>
          <Image source={require('./img/plus_dark.png')} />
        </Fab>
        <Text style={styles.legendLabel}>Plain FAB</Text>
      </View>
      <View style={styles.col}>
        <ColoredFab>
          <Image source={require('./img/plus_white.png')} />
        </ColoredFab>
        <Text style={styles.legendLabel}>Colored</Text>
      </View>
      <View style={styles.col}>
        <AccentFab>
          <Image source={require('./img/plus_white.png')} />
        </AccentFab>
        <Text style={styles.legendLabel}>Accent colored</Text>
      </View>
    </View>
    <View style={styles.row}>
      <View style={styles.col}>
        <FlatButton>
          <Text style={buttonText()}>BUTTON</Text>
        </FlatButton>
        <Text style={styles.legendLabel}>Flat button</Text>
      </View>
      <View style={styles.col}>
        <FlatButton>
          <Text style={buttonTextPrimary()}>BUTTON</Text>
        </FlatButton>
        <Text style={styles.legendLabel}>Colored</Text>
      </View>
      <View style={styles.col}>
        {/* custom ripple color */}
        <FlatButton rippleColor="rgba(253, 216, 53, 0.3)">
          <Text style={buttonTextAccent()}>BUTTON</Text>
        </FlatButton>
        <Text style={styles.legendLabel}>Accent colored</Text>
      </View>
    </View>
  </ScrollView>
);

export default Buttons;

```

### Core Architecture Module: `example/app/cards.tsx`
```
import React from 'react';
import { Text, View, ScrollView, Image } from 'react-native';

import { IconToggle, getTheme, CheckedListener } from 'react-native-material-kit';

import styles from './styles';

const theme = getTheme();

const base64Icon = 'http://www.getmdl.io/assets/demos/welcome_card.jpg';

const onIconChecked: CheckedListener = ({ checked }) => console.log(`the IconToggle is ${checked ? 'ON' : 'OFF'}`);
const onIconClicked = () => console.log('-- clicked --');

const action = <Text> My action</Text>;
const menu = (
  <IconToggle checked={true} onCheckedChange={onIconChecked} onPress={onIconClicked}>
    <Text style={styles.toggleTextOff}>Off</Text>
    <Text
      // @ts-ignore
      stateChecked
      style={styles.toggleTextOn}>
      On
    </Text>
  </IconToggle>
);

const Cards = () => (
  <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
    {/* Here the magic happens*/}
    <View style={theme.cardStyle as any}>
      <Image source={{ uri: base64Icon }} style={theme.cardImageStyle as any} />
      <Text style={theme.cardTitleStyle as any}>Welcome</Text>
      <View // TextView padding not handled well on Android https://github.com/facebook/react-native/issues/3233
        style={{
          padding: 15,
        }}>
        <Text style={[theme.cardContentStyle as any, { padding: 0 }]}>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris sagittis pellentesque lacus eleifend
          lacinia...
        </Text>
      </View>
      <View style={theme.cardMenuStyle as any}>{menu}</View>
      <View style={theme.cardActionStyle as any}>{action}</View>
    </View>
  </ScrollView>
);

export default Cards;

```

### Core Architecture Module: `example/app/index.tsx`
```
/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 */
import React from 'react';
import { StyleSheet, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, StackNavigationProp } from '@react-navigation/stack';

// import { setTheme, MKColor } from 'react-native-material-kit';

// customize the material design theme
// setTheme({
//   primaryColor: MKColor.Purple,
//   primaryColorRGB: MKColor.RGBPurple,
//   accentColor: MKColor.Amber,
// });

import Buttons from './buttons';
import TextFields from './textfields';
import Toggles from './toggles';
import Progress from './progress';
import Sliders from './sliders';
import Cards from './cards';

type RootStackParamList = {
  Home: undefined;
  Buttons: undefined;
  Cards: undefined;
  Progress: undefined;
  Sliders: undefined;
  Textfields: undefined;
  Toggles: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const App = () => (
  <NavigationContainer>
    <Stack.Navigator initialRouteName="Home">
      <Stack.Screen name="Home" component={Home} options={{ title: 'Examples' }} />
      <Stack.Screen name="Buttons" component={Buttons} options={{ title: 'Buttons' }} />
      <Stack.Screen name="Cards" component={Cards} options={{ title: 'Cards' }} />
      <Stack.Screen name="Progress" component={Progress} options={{ title: 'Progress' }} />
      <Stack.Screen name="Sliders" component={Sliders} options={{ title: 'Sliders' }} />
      <Stack.Screen name="Toggles" component={Toggles} options={{ title: 'Toggles' }} />
      <Stack.Screen name="Textfields" component={TextFields} options={{ title: 'Text Fields' }} />
    </Stack.Navigator>
  </NavigationContainer>
);

interface ScreenProps {
  navigation: StackNavigationProp<RootStackParamList, 'Home'>;
}

function Home(props: ScreenProps) {
  const navigate = (route: keyof RootStackParamList) => props.navigation.navigate(route);
  return (
    <ScrollView style={styles.list} contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => navigate('Buttons')}>
        <Text style={styles.pushLabel}>Buttons</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigate('Cards')}>
        <Text style={styles.pushLabel}>Cards</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigate('Progress')}>
        <Text style={styles.pushLabel}>Loading</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigate('Sliders')}>
        <Text style={styles.pushLabel}>Sliders</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigate('Textfields')}>
        <Text style={styles.pushLabel}>Text Fields</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigate('Toggles')}>
        <Text style={styles.pushLabel}>Toggles</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: '#F5FCFF',
    paddingTop: Platform.OS === 'ios' ? 20 : 0,
  },
  container: {
    flex: 1,
    alignItems: 'center',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginTop: 20,
    marginBottom: 0,
  },
  pushLabel: {
    padding: 10,
    color: '#2196F3',
  },
});

export default App;

```

### Core Architecture Module: `example/app/progress.tsx`
```
/**
 * Created by ywu on 15/8/13.
 */
import React, { createRef } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';

import { Progress, Spinner } from 'react-native-material-kit';
import appStyles from './styles';

const styles = Object.assign(
  {},
  appStyles,
  StyleSheet.create({
    progress: {
      width: 150,
      //height: 2,
    },
    spinner: {
      // width: 22,
      // height: 22,
    },
  }),
);

export default class extends React.Component {
  _progRef = createRef<Progress>();
  _progWithBufferRef = createRef<Progress>();

  constructor(props: any) {
    super(props);
  }

  componentDidMount() {
    setTimeout(() => {
      const progBarWithBuffer = this._progWithBufferRef.current;
      if (progBarWithBuffer) {
        progBarWithBuffer.buffer = 0.8;
      }
    }, 1000);
    setTimeout(() => {
      const progBar = this._progRef.current;
      const progBarWithBuffer = this._progWithBufferRef.current;
      if (progBar && progBarWithBuffer) {
        progBar.progress = 0.6;
        progBarWithBuffer.progress = 0.6;
      }
    }, 1600);
  }

  render = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <View style={styles.row}>
        <View style={styles.col}>
          <Progress ref={this._progRef} style={styles.progress} progress={0.2} />
          <Text style={styles.legendLabel}>Default progress bar</Text>
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.col}>
          <Progress.Indeterminate style={styles.progress} />
          <Text style={styles.legendLabel}>Indeterminate</Text>
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.col}>
          <Progress ref={this._progWithBufferRef} style={styles.progress} progress={0.2} buffer={0.3} />
          <Text style={styles.legendLabel}>Buffering</Text>
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.col}>
          <Spinner style={styles.spinner} />
          <Text style={styles.legendLabel}>Default spinner</Text>
        </View>
        <View style={styles.col}>
          <Spinner style={styles.spinner} strokeColor="purple" />
          <Text style={styles.legendLabel}>Single color</Text>
        </View>
      </View>
    </ScrollView>
  );
}

```

### Core Architecture Module: `example/app/sliders.tsx`
```
/**
 * Created by ywu on 15/8/31.
 */

import React, { Component, createRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Slider, RangeSlider, NumRange } from 'react-native-material-kit';

import appStyles from './styles';

// customize the material design theme
// setTheme({
//   primaryColor: MKColor.Orange,
// });

const styles = Object.assign(
  {},
  appStyles,
  StyleSheet.create({
    slider: {
      width: 130,
    },
  }),
);

interface ValueTextProps {
  initial: string;
  rangeText?: string;
}

interface ValueTextStyle {
  curValue: string;
}

class ValueText extends Component<ValueTextProps, ValueTextStyle> {
  constructor(props: ValueTextProps) {
    super(props);
    this.state = {
      curValue: props.initial,
    };
  }

  onChange(curValue: string) {
    this.setState({ curValue });
  }

  render = () => (
    <Text style={styles.legendLabel}>
      {this.state.curValue} {this.props.rangeText ? `(${this.props.rangeText})` : ''}
    </Text>
  );
}

class Sliders extends Component {
  sliderWithValue = createRef<Slider>();
  rangeSlider = createRef<RangeSlider>();
  valueText = createRef<ValueText>();
  rangeValueText = createRef<ValueText>();

  componentDidMount() {
    const slider = this.sliderWithValue.current;
    // const ranged = this.rangeSlider.current;

    setTimeout(() => {
      if (slider) {
        slider.value = 75;
      }
      // if (ranged) {
      //   ranged.maxValue = 95;
      // }
    }, 1000);
  }

  render() {
    return (
      <View
        style={[
          styles.scrollView,
          styles.container,
          {
            paddingTop: 120,
          },
        ]}>
        <View style={styles.row}>
          <View style={styles.col}>
            <Slider style={styles.slider} />
            <Text style={styles.legendLabel}>Slider</Text>
          </View>
          <View style={styles.col}>
            <Slider
              ref={this.sliderWithValue}
              min={10}
              max={100}
              value={25}
              style={styles.slider}
              onChange={this._onChange}
            />
            <ValueText ref={this.valueText} initial="25.00" rangeText="10~100" />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.col}>
            <RangeSlider style={styles.slider} />
            <Text style={styles.legendLabel}>Range Slider</Text>
          </View>
          <View style={styles.col}>
            <RangeSlider
              ref={this.rangeSlider}
              range={{ min: 20, max: 75 }}
              step={5}
              style={styles.slider}
              onChange={this._onRangeChange}
            />
            <ValueText ref={this.rangeValueText} initial="20.00-75.00" rangeText="10~100" />
          </View>
        </View>
      </View>
    );
  }

  _onChange = (value: number) => {
    const text = this.valueText.current;
    if (text) {
      text.onChange(value.toFixed(2));
    }
  };

  _onRangeChange = (range: NumRange) => {
    const text = this.rangeValueText.current;
    if (text) {
      text.onChange(range.min.toFixed(2) + '-' + range.max.toFixed(2));
    }
  };
}

export default Sliders;

```

### Core Architecture Module: `example/app/styles.ts`
```
import { StyleSheet } from 'react-native';
import { MKColor } from 'react-native-material-kit';

export default StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF',
    padding: 24,
  },
  row: {
    flexDirection: 'row',
  },
  col: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    marginLeft: 7,
    marginRight: 7,
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginTop: 10,
    marginBottom: 20,
  },
  legendLabel: {
    textAlign: 'center',
    color: '#666666',
    marginTop: 10,
    marginBottom: 20,
    fontSize: 12,
    fontWeight: '300',
  },
  toggleTextOn: {
    fontSize: 18,
    color: MKColor.Lime,
  },
  toggleTextOff: {
    fontSize: 18,
    color: MKColor.BlueGrey,
  },
});

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #214** (2016-11-27): **[android] Need Fix the readme**
  *Symptoms*: My environment is gradle 2.4 on Android.   The `ReactMaterialKitPackage` should be added in the `MainApplication.java` file.   Moreover, I encountered errors like   `:react-native-material-kit:prepareReleaseDependencies FAILED FAILURE: Build failed with an exception. * What went wrong:...`.    I fix this problem by editing some lines of  `node_modules/react-native-material-kit/android/build.gradle` from `dependencies {     provided 'com.facebook.react:react-native:0.+' }` to `dependencies {     compile 'com.facebook.react:react-native:0.+' }` 
  **Post-Mortem & Fix Analysis**:
  > +1  It should be `compile` instead of `provided`.   Otherwise `react-native run-android` will throw this error -   ``` Project react-native-material-kit: provided dependencies can only be jars. com.facebook.react:react-native:aar:0.32.0 is an Android Library. :react-native-material-kit:prepareReleaseDependencies FAILED ``` 

- **Issue #198** (2016-07-19): **Fix Switch issue with setState**
  *Symptoms*: Should fix #189  

- **Issue #195** (2016-07-19): **Added this.refs.input check**
  *Symptoms*: I was having issues with this.refs.input being undefined in the setPlaceHolder(placeholder) method, I added a check and only update the place holder if it is defined. 
  **Post-Mortem & Fix Analysis**:
  > Adding a check can not be bad.  Thank for the PR! 
  > The password fix has appeared here too. Sorry I am a bit new to github. 
  > You have to revert the password fix and create a new branch with it. If you don't know how to do that, I'll do it later ;). 

- **Issue #189** (2016-07-19): **MKSwitch dont change while use setState in callback**
  *Symptoms*: Were I use:  ```           <MKSwitch             style={styles.isMainPrinciple_Switch}             trackSize={30}             trackLength={52}             onColor="rgba(255,152,0,.3)"             thumbOnColor={MKColor.Orange}             rippleColor="rgba(255,152,0,.2)"             onCheckedChange={(e) => this.setState({newKindsOfPrincipleIsMainPrinciple: e.checked})}             /> ```  it will not change to the normally checked state, while this does:  ```           <MKSwitch             style={styles.isMainPrinciple_Switch}             trackSize={30}             trackLength={52}             onColor="rgba(255,152,0,.3)"             thumbOnColor={MKColor.Orange}             rippleColor="rgba(255,152,0,.2)"             onCheckedChange={(e) => console.log(e)}             /> ```  strangely. 
  **Post-Mortem & Fix Analysis**:
  > @linonetwo I am curious to know if this is seen on Android or iOS or both. 
  > Oh, you're right. I'm having this issue with RN 0.29 on iOS. Can you confirm your RN version? Also are you using `extends Component` or `React.createClasse()` ? 
  > I use the currently latest version.  And extends, es6 . 

- **Issue #178** (2016-06-22): **Can not override styles on MKIconToggle**
  *Symptoms*: Upgraded to version v0.3.2 and it seems that MKIconToggle is ignoring the styles that I'm passing to it. It was working in the previous version.  I was using it to make the toggle a bit bigger than the default size so if there is better way to do it now would be interested to know. 
  **Post-Mortem & Fix Analysis**:
  > Hi,   Thanks for reporting this issue. How do you currently override the default style? Like that I'll be able to reproduce the same issue and try to fix it.  
  > Was using like this:  ``` <MKIconToggle   style={{ width: 100 }} /> ``` 
  > I found the issue(It was introduced "long" time ago : https://github.com/xinthink/react-native-material-kit/commit/116760340ca7d734a9768c6d1d464cdddf9e2221#diff-d3366018012b3dfe74baecaf89a0c7d1L86). I'll check with @xinthink to see if there is a good reason for this modification. In the meantime you can patch it yourself to see if it breaks something else ;)  

- **Issue #57** (2015-12-05): **_onLayout function in Button.js never been callback (from Ripple.js)**
  *Symptoms*: I made a break point in the _onLayout function in the Button.js. I found it is not been callback ever.  I checked the props from the constructor function from Ripple. The onLayout prop is undefined.  
  **Post-Mortem & Fix Analysis**:
  > looks like it conflicts with the built-in `onLayout` prop, renaming can make it works 

- **Issue #56** (2015-12-05): **invoke 'undefined' object measure function in Textfield.js**
  *Symptoms*: This happens when the current page quick unmounted. The code should be changed more defensive.  _doMeasurement() {     if (this.refs.input) {       this.refs.input.measure(this._onInputMeasured.bind(this));       if (this.props.floatingLabelEnabled) {         this.refs.floatingLabel.measure(this._onLabelMeasured.bind(this));       }     }   } 
  **Post-Mortem & Fix Analysis**:
  > Hi,  Could you make a PR with a more defensive code?  
  > looks like I should refactor all the `onMeasurement` stuff, or switch to `onLayout` 
  > +1 

- **Issue #45** (2015-10-25): **`MKSpinner` has no propType for native prop `MKSpinnner.scaleX`of native type `number`**
  *Symptoms*: Getting this when trying to use it in android. 
  **Post-Mortem & Fix Analysis**:
  > Seeing the same error too after upgrading react-native to `0.13.1`. 

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

### Incident Patch 1: `dd2e614b` (2020-02-18)
**Commit Message**: fix publish workflow

**File**: `.github/workflows/publish.yaml` (modified, +3/-4)
```diff
@@ -4,9 +4,6 @@ on:
   release:
     types: published
 
-env:
-  NPM_TOKEN: ${{ secrets.NPM_ACCESS_TOKEN }}
-
 jobs:
   publish:
     runs-on: ubuntu-latest
@@ -21,7 +18,9 @@ jobs:
       with:
         cmd: build-publish
     - name: Publish
-      run: npm publish
+      run: |
+        echo '//registry.npmjs.org/:_authToken=${{ secrets.NPM_ACCESS_TOKEN }}' >> ~/.npmrc
+        npm publish
     - name: notification
       if: cancelled() == false
       uses: xinthink/action-telegram@v1.1
```

---

### Incident Patch 2: `ae5b06f0` (2020-01-11)
**Commit Message**: fix workflows

**File**: `.github/workflows/check.yaml` (modified, +4/-0)
```diff
@@ -13,6 +13,10 @@ jobs:
     runs-on: ubuntu-latest
     steps:
     - uses: actions/checkout@v1
+    - name: Install
+      uses: borales/actions-yarn/@v2.0.0
+      with:
+        cmd: install
     - name: Build
       uses: borales/actions-yarn/@v2.0.0
       with:
```

**File**: `.github/workflows/docs.yaml` (modified, +4/-0)
```diff
@@ -9,6 +9,10 @@ jobs:
     runs-on: ubuntu-latest
     steps:
     - uses: actions/checkout@v1
+    - name: Install
+      uses: borales/actions-yarn/@v2.0.0
+      with:
+        cmd: install
     - name: Generate tsdoc
       uses: borales/actions-yarn/@v2.0.0
       with:
```

**File**: `.github/workflows/publish.yaml` (modified, +4/-0)
```diff
@@ -9,6 +9,10 @@ jobs:
     runs-on: ubuntu-latest
     steps:
     - uses: actions/checkout@v1
+    - name: Install
+      uses: borales/actions-yarn/@v2.0.0
+      with:
+        cmd: install
     - name: Build
       uses: borales/actions-yarn/@v2.0.0
       with:
```

---

### Incident Patch 3: `b09a292a` (2020-01-10)
**Commit Message**: fix Textfield behavior on Android devices

**File**: `src/mdl/Textfield.tsx` (modified, +16/-11)
```diff
@@ -26,9 +26,6 @@ import CompositeAnimation = Animated.CompositeAnimation;
 
 /** Props of the {@link Textfield} component */
 export interface TextfieldProps extends TextInputProps, FloatingLabelPublicProps, UnderlinePublicProps {
-  /** Initial text of the input, alias to `value` */
-  text?: string;
-
   /** alias to `onChangeText` */
   onTextChange?: (text: string) => void;
 
@@ -93,7 +90,6 @@ export default class Textfield extends Component<TextfieldProps, TextfieldState>
   private underlineRef = createRef<Underline>();
   private anim?: CompositeAnimation;
   private _bufferedValue: NullableString;
-  private _originPlaceholder: NullableString;
 
   constructor(props: TextfieldProps) {
     super(props);
@@ -115,7 +111,11 @@ export default class Textfield extends Component<TextfieldProps, TextfieldState>
   }
 
   private set placeholder(placeholder: string) {
-    this.inputRef.current && this.inputRef.current.setNativeProps({ placeholder });
+    this.inputRef.current &&
+      this.inputRef.current.setNativeProps({
+        placeholder,
+        text: this._bufferedValue,
+      });
   }
 
   /**
@@ -141,16 +141,21 @@ export default class Textfield extends Component<TextfieldProps, TextfieldState>
   }
 
   UNSAFE_componentWillMount() {
-    this.bufferedValue = this.props.value || this.props.text || this.props.defaultValue;
-    this._originPlaceholder = this.props.placeholder;
+    this.bufferedValue = this.props.value || this.props.defaultValue;
   }
 
   UNSAFE_componentWillReceiveProps(nextProps: TextfieldProps) {
-    const newText = nextProps.value || nextProps.text || nextProps.defaultValue;
+    const newText = nextProps.value || nextProps.defaultValue;
     if (newText) {
       this.bufferedValue = newText;
     }
-    this._originPlaceholder = nextProps.placeholder;
+
+    if (nextProps.value) {
+      this.bufferedValue = nextProps.value;
+    } else if (nextProps.defaultValue && this.props.defaultValue !== nextProps.defaultValue) {
+      // use defaultValue if it's changed
+      this.bufferedValue = nextProps.defaultValue;
+    }
   }
 
   componentDidMount() {
@@ -271,7 +276,7 @@ export default class Textfield extends Component<TextfieldProps, TextfieldState>
       // and show floating label
       // FIXME workaround https://github.com/facebook/react-native/issues/3220
       if (this.labelRef.current) {
-        this.labelRef.current.updateLabel(this._originPlaceholder || '');
+        this.labelRef.current.updateLabel(this.props.placeholder || '');
       }
     }
 
@@ -289,7 +294,7 @@ export default class Textfield extends Component<TextfieldProps, TextfieldState>
       const onEnd = () => {
         if (this.props.floatingLabelEnabled) {
           // show fixed placeholder after floating label collapsed
-          this.placeholder = this._originPlaceholder || '';
+          this.placeholder = this.props.placeholder || '';
 
           // and hide floating label
           // FIXME workaround https://github.com/facebook/react-native/issues/3220
```

---

### Incident Patch 4: `f4c80f14` (2019-08-04)
**Commit Message**: Merge ds8k-bugfix/update-sdk-version into master

**File**: `android/build.gradle` (modified, +2/-1)
```diff
@@ -12,7 +12,8 @@ buildscript {
 apply plugin: 'com.android.library'
 
 android {
-    compileSdkVersion 28
+    compileSdkVersion project.hasProperty('compileSdkVersion') ? project.compileSdkVersion : 28
+    if (project.hasProperty('buildToolsVersion')) buildToolsVersion project.buildToolsVersion
 
     defaultConfig {
         minSdkVersion 16
```

---

### Incident Patch 5: `806b7319` (2019-08-04)
**Commit Message**: Merge branch 'bugfix/update-sdk-version' of git://github.com/ds8k/react-native-material-kit into ds8k-bugfix/update-sdk-version

# Conflicts:
#	android/build.gradle

**File**: `android/build.gradle` (modified, +2/-1)
```diff
@@ -12,7 +12,8 @@ buildscript {
 apply plugin: 'com.android.library'
 
 android {
-    compileSdkVersion 28
+    compileSdkVersion project.hasProperty('compileSdkVersion') ? project.compileSdkVersion : 28
+    if (project.hasProperty('buildToolsVersion')) buildToolsVersion project.buildToolsVersion
 
     defaultConfig {
         minSdkVersion 16
```

---

### Incident Patch 6: `11970dbf` (2019-07-29)
**Commit Message**: fix lint alerts

**File**: `package.json` (modified, +1/-2)
```diff
@@ -28,7 +28,6 @@
   },
   "devDependencies": {
     "@types/ramda": "^0.25.40",
-    "@types/react": "^16.4.18",
     "@types/react-native": "^0.57.7",
     "babel-eslint": "^9.0.0",
     "eslint": "^5.5.0",
@@ -55,6 +54,6 @@
   "scripts": {
     "lint": "tslint -p .",
     "test": "jest",
-    "build": "lint && tsc"
+    "build": "yarn lint && tsc"
   }
 }
```

**File**: `src/builder.ts` (modified, +10/-9)
```diff
@@ -24,15 +24,6 @@ import {
 export class Builder {
   [index: string]: any // index signature
 
-  // Background color
-  backgroundColor: NullableAttrValue = undefined
-
-  // Accent color
-  accent: NullableAttrValue = undefined
-
-  // Style
-  style: NullableStyle = undefined
-
   // Define builder method `withXxx` for prop `xxx`
   static defineProp(name: string) {
     const methodName = `with${capitalize(name)}`;
@@ -61,6 +52,15 @@ export class Builder {
     });
   }
 
+  // Background color
+  backgroundColor: NullableAttrValue = undefined
+
+  // Accent color
+  accent: NullableAttrValue = undefined
+
+  // Style
+  style: NullableStyle = undefined
+
   getTheme = getTheme;
 
   // Accent color
@@ -80,6 +80,7 @@ export class Builder {
   }
 
   build() {
+    // do nothing
   }
 
   toProps() {
```

**File**: `src/mdl/Checkbox.tsx` (modified, +5/-4)
```diff
@@ -70,11 +70,12 @@ export default class Checkbox extends Component<CheckboxProps, CheckboxState> {
     style: {
       height: 20,
       width: 20,
-      overflow: "hidden", // To fix the Android overflow issue on Android SDK 26
+
       alignItems: 'center',
       borderRadius: 1,
       borderWidth: 2,
       justifyContent: 'center',
+      overflow: "hidden", // To fix the Android overflow issue on Android SDK 26
     },
   };
 
@@ -100,8 +101,8 @@ export default class Checkbox extends Component<CheckboxProps, CheckboxState> {
   //     this.initView(nextProps.checked);
   //   }
   // }
-  
-  // On iPhone X - iOS 12, at times the checkbox doesn't changes it's state. This 
+
+  // On iPhone X - iOS 12, at times the checkbox doesn't changes it's state. This
   // will fix that. EDIT : 29/03/2019 - Apparently the last one was only half a fix
   // so added another condition to fix it.
   // EDIT : 30/04/2019 - There was a problem with the condition that was applied in
@@ -110,7 +111,7 @@ export default class Checkbox extends Component<CheckboxProps, CheckboxState> {
   componentDidUpdate(prevProps: CheckboxProps, prevState: CheckboxState) {
     if (prevProps.checked !== this.props.checked ||
         prevState.checked !== this.state.checked){
-      this._initView(this.props.checked);
+      this.initView(this.props.checked);
     }
   }
 
```

**File**: `src/utils.ts` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ import {
 
 // Add some is-Type methods:
 function isType(type: string, obj: any): boolean {
-  return toString.call(obj) === `[object ${name}]`;
+  return Object.toString.call(obj) === `[object ${type}]`;
 }
 
 export const isArgument = partial(isType, ['Arguments']);
```

**File**: `tsconfig.json` (modified, +12/-6)
```diff
@@ -1,9 +1,9 @@
 {
   "compilerOptions": {
     /* Basic Options */
-    "target": "ES2015",                          /* Specify ECMAScript target version: 'ES3' (default), 'ES5', 'ES2015', 'ES2016', 'ES2017','ES2018' or 'ESNEXT'. */
-    "module": "commonjs",                     /* Specify module code generation: 'none', 'commonjs', 'amd', 'system', 'umd', 'es2015', or 'ESNext'. */
-    // "lib": [],                             /* Specify library files to be included in the compilation. */
+    "target": "esnext",                          /* Specify ECMAScript target version: 'ES3' (default), 'ES5', 'ES2015', 'ES2016', 'ES2017','ES2018' or 'ESNEXT'. */
+    // "module": "commonjs",                     /* Specify module code generation: 'none', 'commonjs', 'amd', 'system', 'umd', 'es2015', or 'ESNext'. */
+    "lib": ["es6"],                             /* Specify library files to be included in the compilation. */
     // "allowJs": true,                       /* Allow javascript files to be compiled. */
     // "checkJs": true,                       /* Report errors in .js files. */
     "jsx": "react",                           /* Specify JSX code generation: 'preserve', 'react-native', or 'react'. */
@@ -15,7 +15,7 @@
     // "rootDir": "./",                       /* Specify the root directory of input files. Use to control the output directory structure with --outDir. */
     // "composite": true,                     /* Enable project compilation */
     // "removeComments": true,                /* Do not emit comments to output. */
-    // "noEmit": true,                        /* Do not emit outputs. */
+    "noEmit": true,                        /* Do not emit outputs. */
     // "importHelpers": true,                 /* Import emit helpers from 'tslib'. */
     // "downlevelIteration": true,            /* Provide full support for iterables in 'for-of', spread, and destructuring when targeting 'ES5' or 'ES3'. */
     // "isolatedModules": true,               /* Transpile each file as a separate module (similar to 'ts.transpileModule'). */
@@ -36,12 +36,15 @@
     // "noFallthroughCasesInSwitch": true,    /* Report errors for fallthrough cases in switch statement. */
 
     /* Module Resolution Options */
-    // "moduleResolution": "node",            /* Specify module resolution strategy: 'node' (Node.js) or 'classic' (TypeScript pre-1.6). */
+    "moduleResolution": "node",            /* Specify module resolution strategy: 'node' (Node.js) or 'classic' (TypeScript pre-1.6). */
     // "baseUrl": "./",                       /* Base directory to resolve non-absolute module names. */
     // "paths": {},                           /* A series of entries which re-map imports to lookup locations relative to the 'baseUrl'. */
     // "rootDirs": [],                        /* List of root folders whose combined content represents the structure of the project at runtime. */
     // "typeRoots": [],                       /* List of folders to include type definitions from. */
-    // "types": [],                           /* Type declaration files to be included in compilation. */
+    // "types": [
+    //   "react",
+    //   "react-native"
+    // ],                           /* Type declaration files to be included in compilation. */
     "allowSyntheticDefaultImports": true,  /* Allow default imports from modules with no default export. This does not affect code emit, just typechecking. */
     "esModuleInterop": true                   /* Enables emit interoperability between CommonJS and ES Modules via creation of namespace objects for all imports. Implies 'allowSyntheticDefaultImports'. */
     // "preserveSymlinks": true,              /* Do not resolve the real path of symlinks. */
@@ -59,5 +62,8 @@
   "compileOnSave": true,
   "include": [
     "src"
+  ],
+  "exclude": [
+    "node_modules"
   ]
 }
```

---

### Incident Patch 7: `9b3a9eed` (2019-07-31)
**Commit Message**: Fixes react 0.60 issue with deprecated sendInutEventWithName: (#416)

**File**: `iOS/RCTMaterialKit/MKTouchableManager.m` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ - (void)sendTouchEvent:(NSString*)type touch:(UITouch*)touch source:(MKTouchable
                            @"x": [NSNumber numberWithFloat:location.x],
                            @"y": [NSNumber numberWithFloat:location.y],
                            };
-    [self.bridge.eventDispatcher sendInputEventWithName:@"topChange" body:dict];
+    [self.bridge enqueueJSCall:@"RCTEventEmitter" method:@"receiveEvent" args:@[dict[@"target"], RCTNormalizeInputEventName(@"topChange"), dict] completion:NULL];
 }
 
 @end
```

---

### Incident Patch 8: `cad0613e` (2019-04-29)
**Commit Message**: Fix for Checkbox not updating visual state, on iOS (#410)

This fix addresses the issue when on devices like iPhone X running iOS 12, when we try to check the checkbox initially, it shows the ripple, and gives it's new state in code but visually it doesn't changes it's state. That is, it looks like it's not checked (whereas internally it is). So, this fix shall fix this inconsistency between internal state and visual state of this component.

**File**: `src/mdl/Checkbox.tsx` (modified, +5/-3)
```diff
@@ -102,9 +102,11 @@ export default class Checkbox extends Component<CheckboxProps, CheckboxState> {
   // }
   
   // On iPhone X - iOS 12, at times the checkbox doesn't changes it's state. This 
-  // will fix that.
-  componentDidUpdate(prevProps: CheckboxProps) {
-    if (prevProps.checked !== this.props.checked){
+  // will fix that. EDIT : 29/03/2019 - Apparently the last one was only half a fix
+  // so added another condition to fix it.
+  componentDidUpdate(prevProps: CheckboxProps, prevState: CheckboxState) {
+    if (prevProps.checked !== this.props.checked &&
+        prevState.checked !== this.state.checked){
       this._initView(this.props.checked);
     }
   }
```

---

### Incident Patch 9: `da1c292e` (2019-04-01)
**Commit Message**: Fix "UIView+React.h" missing header error (#409)

This header was moved into the "React" namespace as of react-native 0.44.0: https://github.com/facebook/react-native/releases/tag/v0.40.0

**File**: `iOS/RCTMaterialKit/MKTouchableManager.m` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 
 #import <React/RCTViewManager.h>
 #import <React/RCTEventDispatcher.h>
-#import <UIView+React.h>
+#import <React/UIView+React.h>
 #import "MKTouchable.h"
 
 @interface MKTouchableManager : RCTViewManager <MKTouchableDelegate>
```

**File**: `iOS/RCTMaterialKit/TickViewManager.m` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 //
 
 #import <React/RCTViewManager.h>
-#import <UIView+React.h>
+#import <React/UIView+React.h>
 #import "TickView.h"
 
 @interface TickViewManager : RCTViewManager
```

---

### Incident Patch 10: `b992d9e7` (2019-03-05)
**Commit Message**: Android overflow fix & prop not applying fix (#405)

This fix will make fix the overflow issue that was seen on Android SDK 26+, where in the checkbox in checked mode, fills the entire screen. This fix also contains a patch that helps in avoiding scenarios where the checkbox doesn't changes it's checked state, (as encountered on iPhone X running iOS 12).

**File**: `src/mdl/Checkbox.tsx` (modified, +12/-4)
```diff
@@ -70,7 +70,7 @@ export default class Checkbox extends Component<CheckboxProps, CheckboxState> {
     style: {
       height: 20,
       width: 20,
-
+      overflow: "hidden", // To fix the Android overflow issue on Android SDK 26
       alignItems: 'center',
       borderRadius: 1,
       borderWidth: 2,
@@ -95,9 +95,17 @@ export default class Checkbox extends Component<CheckboxProps, CheckboxState> {
     this.initView(this.props.checked);
   }
 
-  componentWillReceiveProps(nextProps: CheckboxProps) {
-    if (nextProps.checked !== this.props.checked) {
-      this.initView(nextProps.checked);
+  // componentWillReceiveProps(nextProps: CheckboxProps) {
+  //   if (nextProps.checked !== this.props.checked) {
+  //     this.initView(nextProps.checked);
+  //   }
+  // }
+  
+  // On iPhone X - iOS 12, at times the checkbox doesn't changes it's state. This 
+  // will fix that.
+  componentDidUpdate(prevProps: CheckboxProps) {
+    if (prevProps.checked !== this.props.checked){
+      this._initView(this.props.checked);
     }
   }
 
```

#### Recent Merged Pull Requests:
- **PR #443** (closed): Adding mavenCentral() as jcenter() is shutting (@maheshwarimrinal)
- **PR #439** (closed): Bump lodash from 4.17.15 to 4.17.19 in /example (@dependabot[bot])
- **PR #438** (closed): Bump lodash from 4.17.10 to 4.17.19 (@dependabot[bot])
- **PR #435** (closed): sync with xinthink (@siderakis)
- **PR #429** (2020-03-08): Changed component from MKTextField to Textfield (@Kunalpaul12)
- **PR #426** (2020-02-16): Bump mixin-deep from 1.3.1 to 1.3.2 (@dependabot[bot])
- **PR #425** (closed): Bump handlebars from 4.1.2 to 4.5.3 (@dependabot[bot])
- **PR #424** (2020-02-16): Bump eslint-utils from 1.4.0 to 1.4.3 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
