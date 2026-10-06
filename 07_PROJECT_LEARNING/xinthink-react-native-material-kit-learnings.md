# Forensic Learning Record (Deep Inspection): xinthink/react-native-material-kit

> **Canonical Artifact**: `07_PROJECT_LEARNING/xinthink-react-native-material-kit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xinthink/react-native-material-kit](https://github.com/xinthink/react-native-material-kit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:18:23.615Z  
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

### Core Architecture Module: `iOS/RCTMaterialKit/MKUtils.h`
```
//
//  MKUtils.h
//  RCTMaterialKit
//
//  Created by Yingxin Wu on 15/6/6.
//  Copyright (c) 2015年 xinthink. All rights reserved.
//

#ifndef RCTMaterialKit_MKUtils_h
#define RCTMaterialKit_MKUtils_h

@import Foundation;

static inline NSString* trim(NSString *str) {
    return [str stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]];
}

static inline BOOL isBlank(NSString *str) {
    return str == Nil || trim(str).length == 0;
}

static inline BOOL isNotBlank(NSString *str) {
    return !isBlank(str);
}

static inline BOOL isEqual(CGFloat a, CGFloat b) {
    return fabs(a - b) <= 1E-6;
}

static inline BOOL isNotEqual(CGFloat a, CGFloat b) {
    return !isEqual(a, b);
}

#endif

```

### Core Architecture Module: `src/utils.ts`
```
// Utilities
//
// Created by ywu on 15/7/18.
//
import PropTypes from 'prop-types';
import { Component } from 'react';
import { PixelRatio, Platform, processColor, TouchableWithoutFeedback } from 'react-native';

import { compose, indexOf, isNil, keys, not, ObjPred, partial, pickBy, reject } from 'ramda';

// Add some is-Type methods:
function isType(type: string, obj: any): boolean {
  return Object.toString.call(obj) === `[object ${type}]`;
}

export const isArgument = partial(isType, ['Arguments']);
export const isFunction = partial(isType, ['Function']);
export const isString = partial(isType, ['String']);
export const isNumber = partial(isType, ['Number']);
export const isDate = partial(isType, ['Date']);
export const isRegExp = partial(isType, ['RegExp']);
export const isError = partial(isType, ['Error']);

// Remove keys with null value from the given object
const compact = reject(isNil);

const isNotNil = compose(
  not,
  isNil
);

function capitalize(str: string) {
  return str.substring(0, 1).toUpperCase() + str.substring(1);
}

// Convert dips to pixels
const toPixels = PixelRatio.getPixelSizeForLayoutSize.bind(PixelRatio);

// Convert pixels back to dips
function toDips(px: number): number {
  return px / PixelRatio.get();
}

// Convert native coordinate value into unit used in JSX
function convertCoordinate(value: number): number {
  return Platform.OS === 'android' ? toDips(value) : value;
}

// Get font size according to the screen density
function getFontSize(sp: number): number {
  return sp * PixelRatio.getFontScale();
}

// Extract the specified props from the given component instance.
// - {`object`} `view` the component instance
// - {`(v,k):boolean`} `filter` predictor to determine which prop should be extracted
function extractPropsBy(view: Component, filter: ObjPred) {
  return pickBy(filter, view.props);
}

// Extract the specified props from the given component instance.
// - {`object`} `view` the component instance
// - {`array`|`object`} `propTypes` props definitions
function extractProps(view: Component, propTypes: object) {
  const propNames = Array.isArray(propTypes) ? propTypes : keys(propTypes);
  const filter: ObjPred = (v, k) => indexOf(k, propNames) >= 0 && isNotNil(v);
  return pickBy(filter, view.props);
}

// Extract Touchable props from the given component instance.
// - {`object`} `view` the component instance
function extractTouchableProps(view: Component) {
  return extractProps(view, {
    // @ts-ignore: View.propTypes
    ...TouchableWithoutFeedback.propTypes,
    testID: PropTypes.string,
  });
}

// ## Public interface
export {
  capitalize,
  compact,
  toPixels,
  toDips,
  convertCoordinate,
  getFontSize,
  extractProps,
  extractPropsBy,
  extractTouchableProps,
  processColor as parseColor, // parse stringified color as int
};

```

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

### Core Architecture Module: `example/app/textfields.tsx`
```
/**
 * Created by ywu on 15/7/16.
 */
import React, { createRef } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';

import { Textfield, MKColor } from 'react-native-material-kit';

import appStyles from './styles';

const styles = Object.assign(
  {},
  appStyles,
  StyleSheet.create({
    col: {
      flex: 1,
      flexDirection: 'column',
      // alignItems: 'center', // this will prevent TFs from stretching horizontal
      marginLeft: 7,
      marginRight: 7,
      // backgroundColor: MKColor.Lime,
    },
    textfield: {
      height: 28, // have to do it on iOS
      marginTop: 32,
    },
    textfieldWithFloatingLabel: {
      height: 48, // have to do it on iOS
      marginTop: 10,
    },
  }),
);

export default class extends React.Component {
  defaultInputRef = createRef<Textfield>();

  componentDidMount() {
    setTimeout(() => {
      this.defaultInputRef.current && this.defaultInputRef.current.focus();
    }, 500);
  }

  render = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <View style={styles.row}>
        <View style={styles.col}>
          <Textfield
            floatingLabelEnabled={false}
            placeholder="Text..."
            style={styles.textfield}
            textInputStyle={{
              flex: 1,
            }}
          />
          <Text style={styles.legendLabel}>Textfield</Text>
        </View>
        <View style={styles.col}>
          <Textfield
            ref={this.defaultInputRef}
            placeholder="Number..."
            style={styles.textfieldWithFloatingLabel}
            textInputStyle={{ flex: 1 }}
            floatingLabelFont={{
              fontSize: 12,
              fontStyle: 'italic',
              fontWeight: '200',
            }}
            keyboardType={'numeric'}
          />
          <Text style={styles.legendLabel}>With floating label</Text>
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.col}>
          <Textfield
            floatingLabelEnabled={false}
            placeholder="Text..."
            style={styles.textfield}
            textInputStyle={{
              flex: 1,
              color: MKColor.Orange,
            }}
            tint={MKColor.Lime}
          />
          <Text style={styles.legendLabel}>Textfield</Text>
        </View>
        <View style={styles.col}>
          <Textfield
            password
            placeholder="Password"
            defaultValue="!123"
            style={styles.textfieldWithFloatingLabel}
            textInputStyle={{ flex: 1 }}
            highlightColor={MKColor.DeepPurple}
            onFocus={e => console.log('Focus', !!e)}
            onBlur={e => console.log('Blur', !!e)}
            onEndEditing={e => console.log('EndEditing', !!e)}
            onSubmitEditing={e => console.log('SubmitEditing', !!e)}
            onTextChange={s => console.log('TextChange', s)}
            onChangeText={s => console.log('ChangeText', s)}
          />
          <Text style={styles.legendLabel}>With floating label</Text>
        </View>
      </View>
      {/* <TF /> */}
    </ScrollView>
  );
}

// /** Test controlled state of builtin `TextInput` */
// class TF extends React.Component {
//   constructor(props) {
//     super(props);
//     this.state = {
//       count: 10,
//     };
//   }

//   render = () => (
//     <View style={styles.row}>
//       <View style={styles.col}>
//         <TextInput
//           defaultValue={this.state.count < 1 ? undefined : `${this.state.count}`}
//           underlineColorAndroid={MKColor.Amber}
//           onChangeText={s => console.log(`text => ${s}`)}
//         />
//       </View>
//       <Button title="Change" onPress={() => this.setState({ count: 0 })} />
//     </View>
//   );
// }

```

### Core Architecture Module: `example/app/toggles.tsx`
```
/**
 * Created by ywu on 15/7/24.
 */

import React, { Component } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';

import {
  getTheme,
  MKColor,
  setTheme,
  Checkbox,
  CheckedEvent,
  IconToggle,
  RadioButton,
  RadioButtonGroup,
  Switch,
} from 'react-native-material-kit';

import appStyles from './styles';

// customize the material design theme
// setTheme({
//   primaryColor: MKColor.Amber,
//   primaryColorRGB: MKColor.RGBAmber,
//   accentColor: MKColor.Teal,
// });

//setTheme({radioStyle: {
//  fillColor: `rgba(${MKColor.RGBTeal},.8)`,
//  borderOnColor: `rgba(${MKColor.RGBTeal},.6)`,
//  borderOffColor: `rgba(${MKColor.RGBTeal},.3)`,
//  rippleColor: `rgba(${MKColor.RGBTeal},.15)`,
//}});

setTheme({
  checkboxStyle: {
    fillColor: MKColor.Amber,
    borderOnColor: MKColor.Amber,
    borderOffColor: `rgba(${MKColor.RGBAmber},.65)`,
    rippleColor: `rgba(${MKColor.RGBTeal},.15)`,
  },
});

const styles = Object.assign(
  {},
  appStyles,
  StyleSheet.create({
    toggleText: {
      fontSize: 16,
      fontStyle: 'italic',
      fontWeight: 'bold',
      color: '#616161',
    },
    toggleTextOn: {
      color: getTheme().primaryColor as any,
    },
    switch: {
      marginTop: 2,
      // marginBottom: 5,
    },
    appleSwitch: {
      marginTop: 7,
      marginBottom: 7,
    },
  }),
);

class Toggles extends Component {
  radioGroup = new RadioButtonGroup();

  _onChecked(event: CheckedEvent) {
    console.log(`icon toggle is checked? ${event.checked}`);
  }

  _onToggleClicked() {
    console.log('you clicked a toggle');
  }

  render() {
    return (
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
        <View style={styles.row}>
          <View style={styles.col}>
            <IconToggle checked onCheckedChange={this._onChecked} onPress={this._onToggleClicked}>
              <Text
                // @ts-ignore
                stateChecked
                style={[styles.toggleText, styles.toggleTextOn]}>
                T
              </Text>
              <Text style={styles.toggleText}>T</Text>
            </IconToggle>
            <Text style={styles.legendLabel}>Icon on</Text>
          </View>
          <View style={styles.col}>
            <IconToggle>
              <Text
                // @ts-ignore
                stateChecked
                style={[styles.toggleText, styles.toggleTextOn]}>
                B
              </Text>
              <Text style={styles.toggleText}>B</Text>
            </IconToggle>
            <Text style={styles.legendLabel}>Icon off</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.col}>
            <Switch checked style={styles.switch} />
            <Text style={styles.legendLabel}>Switch on</Text>
          </View>
          <View style={styles.col}>
            <Switch
              style={styles.appleSwitch}
              trackSize={30}
              trackLength={52}
              onColor="rgba(255,152,0,.3)"
              thumbOnColor={MKColor.Orange}
              rippleColor="rgba(255,152,0,.2)"
              onPress={() => console.log('orange switch pressed')}
              onCheckedChange={({ checked }) => console.log('orange switch checked:', checked)}
            />
            <Text style={styles.legendLabel}>Switch off</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.col}>
            <RadioButton checked={true} group={this.radioGroup} />
            <Text style={styles.legendLabel}>First</Text>
          </View>
          <View style={styles.col}>
            <RadioButton group={this.radioGroup} />
            <Text style={styles.legendLabel}>Second</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.col}>
            <Checkbox checked />
            <Text style={styles.legendLabel}>Checked</Text>
          </View>
          <View style={styles.col}>
            <Checkbox />
            <Text style={styles.legendLabel}>Unchecked</Text>
          </View>
        </View>
      </ScrollView>
    );
  }
}

export default Toggles;

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

### Incident Patch 8: `481d85b5` (2019-04-29)
**Commit Message**: prevent NPE when rect is null (#408)

**File**: `android/src/main/java/com/github/xinthink/rnmk/widget/MKSpinner.java` (modified, +4/-1)
```diff
@@ -318,7 +318,10 @@ protected void onDraw(Canvas canvas) {
         initPaints();
 
         canvas.rotate(containerAngle, getWidth() / 2f, getHeight() / 2f);  // rotate the whole spinner
-        canvas.drawArc(rect, arcStartAngle, arcSweepAngle, false, arcPaint);
+        
+	if (rect != null) {
+	    canvas.drawArc(rect, arcStartAngle, arcSweepAngle, false, arcPaint);
+	}
 
         if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {  // fix #69
             canvas.restore();
```

---

### Incident Patch 9: `cad0613e` (2019-04-29)
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

### Incident Patch 10: `da1c292e` (2019-04-01)
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

### Incident Patch 11: `b992d9e7` (2019-03-05)
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

---

### Incident Patch 12: `8e14bda8` (2019-01-01)
**Commit Message**: refactor Button, replaced builders with variances

**File**: `.eslintignore` (modified, +1/-0)
```diff
@@ -1,2 +1,3 @@
 .*
+lib
 node_modules
```

**File**: `src/MKColor.ts` (modified, +1/-1)
```diff
@@ -73,6 +73,6 @@ const MkColor: Palette = {
   palette_green_500: 'rgb(76,175,80)',
   palette_red_500: 'rgb(244,67,54)',
   palette_yellow_600: 'rgb(253,216,53)',
-}
+};
 
 export default MkColor
```

**File**: `src/builder.ts` (modified, +1/-40)
```diff
@@ -6,17 +6,14 @@
 // Created by ywu on 15/7/16.
 //
 import {
-  getTheme,
-
-  // types
   AttrValue,
+  getTheme,
   NullableAttrValue,
   NullableStyle,
   Style,
 } from './theme';
 import {
   capitalize,
-  NullableString,
 } from './utils'
 
 
@@ -108,39 +105,3 @@ export class Builder {
     this.style = ([] as NullableStyle[]).concat(base, this.style);
   }
 }
-
-
-//
-// ## <section id='TextViewBuilder'>TextViewBuilder</section>
-// Text-based component builder
-//
-export class TextViewBuilder extends Builder {
-  text: NullableString = undefined
-  textStyle: NullableStyle = undefined
-
-  withText(text: string) {
-    this.text = text;
-    return this;
-  }
-
-  withTextStyle(style: Style) {
-    this.textStyle = style;
-    return this;
-  }
-
-  mergeTextStyleWith(base: Style) {
-    this.textStyle = ([] as Array<NullableStyle>).concat(base, this.textStyle);
-  }
-
-  mergeStyle() {
-    super.mergeStyle();
-    this.mergeStyleWith({
-      padding: 8,
-      justifyContent: 'center',
-      alignItems: 'center',
-    });
-    this.mergeTextStyleWith({
-      fontSize: getTheme().fontSize,
-    });
-  }
-}
```

**File**: `src/index.ts` (modified, +24/-12)
```diff
@@ -6,18 +6,30 @@ export {default as MKColor} from './MKColor'
 
 export * from './theme'
 
-// Shortcuts, and also compatibility for legacy native components like MKButton
+// Shortcuts
 export {
-  Button as MKButton,
-  Textfield as MKTextField,
-  Switch as MKSwitch,
-  IconToggle as MKIconToggle,
+  Button,
+  ButtonProps,
+  ButtonStyles,
+  ColoredRaisedButton,
+  RaisedButton,
+  AccentRaisedButton,
+  FlatButton,
+  Fab,
+  ColoredFab,
+  AccentFab,
 
-  Ripple as MKRipple,
-  Progress as MKProgress,
-  Slider as MKSlider,
-  RangeSlider as MKRangeSlider,
-  Spinner as MKSpinner,
-  RadioButton as MKRadioButton,
-  Checkbox as MKCheckbox,
+  // Textfield as MKTextField,
+  // Switch as MKSwitch,
+  // IconToggle as MKIconToggle,
+
+  Ripple,
+  RippleProps,
+
+  // Progress as MKProgress,
+  // Slider as MKSlider,
+  // RangeSlider as MKRangeSlider,
+  // Spinner as MKSpinner,
+  // RadioButton as MKRadioButton,
+  // Checkbox as MKCheckbox,
 } from './mdl'
```

**File**: `src/mdl/Button.tsx` (modified, +148/-163)
```diff
@@ -9,34 +9,32 @@
 // Created by ywu on 15/7/2.
 //
 
-import React, {Component} from 'react'
+import React, {Component, SFC} from 'react'
 
 import {
   LayoutChangeEvent,
-  Text,
   TextStyle,
   TouchableWithoutFeedback,
   TouchableWithoutFeedbackProps,
 } from 'react-native'
 
-import {TextViewBuilder} from '../builder'
 import MKColor from '../MKColor'
-import {getTheme, Theme} from '../theme'
+import {AttrValue, getTheme, Theme} from '../theme'
 import * as utils from '../utils'
 import Ripple, {RippleProps} from './Ripple'
 
 // ## <section id='props'>ButtonProps</section>
 export interface ButtonProps extends TouchableWithoutFeedbackProps, RippleProps {
   // Whether this's a FAB
-  fab: boolean
+  fab?: boolean
 
   // Whether the button is enabled
-  enabled?: boolean,
+  enabled?: boolean
 }
 
 interface ButtonState {
-  width: number,
-  height: number,
+  width: number
+  height: number
 }
 
 
@@ -75,10 +73,6 @@ export default class Button extends Component<ButtonProps, ButtonState> {
     }
   };
 
-  _renderChildren() {
-    return this.props.children;
-  }
-
   render() {
     const touchableProps: TouchableWithoutFeedbackProps = {};
     if (this.props.enabled) {
@@ -109,190 +103,181 @@ export default class Button extends Component<ButtonProps, ButtonState> {
     return (
       <TouchableWithoutFeedback {...touchableProps}>
         <Ripple
-          ref="container"
           {...this.props}
           {...maskProps}
           style={[
             this.props.style,
             fabStyle,
           ]}
-        >
-          {this._renderChildren()}
-        </Ripple>
+        />
       </TouchableWithoutFeedback>
     );
   }
 }
 
-
 // --------------------------
-// Builder
-//
-
-//
-// ## Button builder
-// - @see [TextViewBuilder](../builder.html#TextViewBuilder)
-//
-class ButtonBuilder extends TextViewBuilder {
-  mergeStyle() {
-    this.choseBackgroundColor();
-    if (this.fab) {
-      this.styleFab();
-    }
-    super.mergeStyle();
-  }
-
-  // merge default FAB style with custom setting
-  styleFab() {
-    this.mergeStyleWith({
-      width: 48,
-      height: 48,
-      borderRadius: 24,
-    });
-  }
-
-  build() {
-    const theBuilder = this;
-    const props = this.toProps();
-
-    const BuiltButton = class extends Button {
-      _renderChildren() {
-        // use a text or a custom content
-        return theBuilder.text ? (
-          <Text style={theBuilder.textStyle || {}}>
-            {theBuilder.text}
-          </Text>
-        ) : this.props.children;
-      }
-    };
-    BuiltButton.defaultProps = Object.assign({}, Button.defaultProps, props);
-    return BuiltButton;
-  }
+// Pre-defined button variances.
+export const RaisedButton: SFC<ButtonProps> = props =>
+  customizedButton(raisedButton(), props);
+
+export const ColoredRaisedButton: SFC<ButtonProps> = props =>
+  customizedButton(coloredRaisedButton(), props);
+
+export const AccentRaisedButton: SFC<ButtonProps> = props =>
+  customizedButton(accentRaisedButton(), props);
+
+export const FlatButton: SFC<ButtonProps> = props =>
+  customizedButton(flatButton(), props);
+
+export const Fab: SFC<ButtonProps> = props =>
+  customizedButton(fab(), props);
+
+export const ColoredFab: SFC<ButtonProps> = props =>
+  customizedButton(coloredFab(), props);
+
+export const AccentFab: SFC<ButtonProps> = props =>
+  customizedButton(accentFab(), props);
+
+// Factory method to create a button variance
+function customizedButton(
+  {style: baseStyle, ...baseProps}: ButtonProps,
+  {style: customStyle, ...customProps}: ButtonProps
+): JSX.Element {
+  return <Button
+    {...baseProps}
+    {...customProps}
+    style={[baseStyle, customStyle]}
+  />;
 }
 
-// define builder method for each prop
-ButtonBuilder.defineProps(Button.propTypes);
-
-
-// ----------
-// ## <section id="builders">Built-in builders</section>
-//
+// (Most of them are defined as functions, in order to lazy-resolve the theme)
+// default button props
+const button: ButtonProps = {
+  style: {
+    alignItems: 'center',
+    justifyContent: 'center',
+    padding: 8,
+  },
+};
+
+// Text style for buttons, default color is `black`
+function buttonText(theme = getTheme(), color: AttrValue = 'black'): TextStyle {
+  return {
+    // @ts-ignore AttrValue will be resolved to string
+    color,
+    // @ts-ignore
+    fontSize: theme.fontSize,
+    fontWeight: 'bold',
+  };
+}
 
-// Colored raised button
-// FIXME shadow not work on Android
-// @see https://facebook.github.io/react-native/docs/known-issues.html#no-support-for-shadows-on-android
-function coloredRaisedButton() {
-  return new ButtonBuilder()
-    .withStyle({
-      borderRadius: 2,
-      shadowRadius: 1,
-      shadowOffset: { width: 0, height: 0.5 },
-      shadowOpacity: 0.7,
-      shadowColor: 'black',
-      elevation: 4,
-    })
-    .withTextStyle({
-      color: 'white',
-      fontWeight: 'bold',
-    });
+// Text style for colored buttons
+function coloredButtonT
```

**File**: `src/mdl/Ripple.tsx` (modified, +4/-4)
```diff
@@ -101,7 +101,7 @@ export default class Ripple extends Component<RippleProps, RippleState> {
     shadowAniEnabled: true,
   };
 
-  private ref = createRef<Component>();
+  private containerRef = createRef<Component>();
   private maskRef = createRef<Component>();
   private rippleRef = createRef<Component>();
   private _animatedAlpha = new Animated.Value(0);
@@ -126,8 +126,8 @@ export default class Ripple extends Component<RippleProps, RippleState> {
   }
 
   measure(cb: MeasureOnSuccessCallback) {
-    return this.ref.current &&
-      UIManager.measure(findNodeHandle(this.ref.current), cb);
+    return this.containerRef.current &&
+      UIManager.measure(findNodeHandle(this.containerRef.current), cb);
   }
 
   // Start the ripple effect
@@ -192,7 +192,7 @@ export default class Ripple extends Component<RippleProps, RippleState> {
 
     return (
       <MKTouchable
-        ref={this.ref}
+        ref={this.containerRef}
         {...this.props}
         style={[this.props.style, shadowStyle]}
         onTouch={this._onTouchEvent}
```

**File**: `src/mdl/index.ts` (modified, +24/-12)
```diff
@@ -1,16 +1,28 @@
 /**
  * Created by ywu on 15/7/28.
  */
-exports.Switch = require('./Switch');
-exports.IconToggle = require('./IconToggle');
-exports.Textfield = require('./Textfield');
-exports.Progress = require('./Progress');
-exports.Progress.Indeterminate = require('./IndeterminateProgress');
-exports.Spinner = require('./Spinner');
-exports.Slider = require('./Slider');
-exports.RangeSlider = require('./RangeSlider');
-exports.Ripple = require('./Ripple');
-exports.RadioButton = require('./RadioButton');
+// exports.Switch = require('./Switch');
+// exports.IconToggle = require('./IconToggle');
+// exports.Textfield = require('./Textfield');
+// exports.Progress = require('./Progress');
+// exports.Progress.Indeterminate = require('./IndeterminateProgress');
+// exports.Spinner = require('./Spinner');
+// exports.Slider = require('./Slider');
+// exports.RangeSlider = require('./RangeSlider');
+// exports.RadioButton = require('./RadioButton');
 
-export { default as Button } from './Button'
-export { default as Checkbox } from './Checkbox'
+export {
+  default as Button,
+  ButtonProps,
+  ButtonStyles,
+
+  RaisedButton,
+  ColoredRaisedButton,
+  AccentRaisedButton,
+  FlatButton,
+  Fab,
+  ColoredFab,
+  AccentFab,
+} from './Button'
+// export {default as Checkbox} from './Checkbox'
+export {default as Ripple, RippleProps} from './Ripple'
```

**File**: `src/theme.ts` (modified, +43/-24)
```diff
@@ -1,3 +1,4 @@
+/* tslint:disable:max-classes-per-file */
 // Theme definition
 //
 // Created by ywu on 15/7/18.
@@ -7,13 +8,13 @@ import MKColor from './MKColor'
 export type AttrValue = string | number | Theme | AttrReference
 export type NullableAttrValue = AttrValue | null | undefined
 export type Theme = {[name: string]: AttrValue}
-export type Style = object | Array<any>
-export type NullableStyle = object | Array<any> | null | undefined
+export type Style = object | any[]
+export type NullableStyle = object | any[] | null | undefined
 
 const theme: Theme = {};
 
 class AttrReference {
-  attr: string
+  attr: string;
 
   constructor(attr: string) {
     this.attr = attr;
@@ -25,7 +26,7 @@ class AttrReference {
 }
 
 class RGBAttrReference extends AttrReference {
-  alpha: number
+  alpha: number;
 
   constructor(attr: string, alpha: number) {
     super(attr);
@@ -48,28 +49,33 @@ const accentColorRef = new AttrReference('accentColor');
 Object.assign(theme, {
   primaryColor: MKColor.Indigo,
   primaryColorRGB: MKColor.RGBIndigo,
+
   accentColor: MKColor.Pink,
   accentColorRGB: MKColor.RGBPink,
-  bgPlain: 'rgba(158, 158, 158, 0.2)',
+
   bgDisabled: 'rgba(0, 0, 0, 0.12)',
+  bgPlain: 'rgba(158, 158, 158, 0.2)',
   fontColor: 'rgb(117, 117, 117)',
   fontSize: 14,
   rippleColor: 'rgba(255, 255, 255, 0.125)',
+
   textfieldStyle: {
-    tintColor: 'rgba(0, 0, 0, 0.12)',
     highlightColor: new RGBAttrReference('primaryColorRGB', 0.9),
     textInputStyle: {
       color: new AttrReference('fontColor'),
       fontSize: 16,
       paddingLeft: 0,
       paddingRight: 0,
     },
+    tintColor: 'rgba(0, 0, 0, 0.12)',
   },
+
   progressStyle: {
     backgroundColor: new RGBAttrReference('primaryColorRGB', 0.3),
-    progressColor: primaryColorRef,
     bufferColor: new RGBAttrReference('primaryColorRGB', 0.3),
+    progressColor: primaryColorRef,
   },
+
   spinnerStyle: {
     strokeColor: [
       MKColor.palette_blue_400,
@@ -78,77 +84,90 @@ Object.assign(theme, {
       MKColor.palette_green_500,
     ],
   },
+
   sliderStyle: {
     lowerTrackColor: primaryColorRef,
     upperTrackColor: '#cccccc',
   },
+
   iconToggleStyle: {
-    onColor: new RGBAttrReference('primaryColorRGB', 0.4),
     offColor: 'rgba(0, 0, 0, 0.25)',
+    onColor: new RGBAttrReference('primaryColorRGB', 0.4),
     rippleColor: new AttrReference('bgPlain'),
   },
+
   switchStyle: {
-    onColor: new RGBAttrReference('primaryColorRGB', 0.4),
     offColor: 'rgba(0, 0, 0, 0.25)',
-    thumbOnColor: primaryColorRef,
-    thumbOffColor: MKColor.Silver,
+    onColor: new RGBAttrReference('primaryColorRGB', 0.4),
     rippleColor: new RGBAttrReference('primaryColorRGB', 0.2),
+    thumbOffColor: MKColor.Silver,
+    thumbOnColor: primaryColorRef,
   },
+
   radioStyle: {
-    borderOnColor: primaryColorRef,
     borderOffColor: primaryColorRef,
+    borderOnColor: primaryColorRef,
     fillColor: primaryColorRef,
     rippleColor: new RGBAttrReference('primaryColorRGB', 0.2),
   },
+
   checkboxStyle: {
-    borderOnColor: primaryColorRef,
     borderOffColor: 'rgba(0, 0, 0, 0.56)',
+    borderOnColor: primaryColorRef,
     fillColor: primaryColorRef,
-    rippleColor: new RGBAttrReference('primaryColorRGB', 0.2),
     inset: 0,
+    rippleColor: new RGBAttrReference('primaryColorRGB', 0.2),
   },
+
   cardStyle: {
     backgroundColor: '#ffffff',
-    borderRadius: 2,
     borderColor: '#ffffff',
+    borderRadius: 2,
     borderWidth: 1,
     shadowColor: 'rgba(0, 0, 0, 0.12)',
-    shadowOpacity: 0.8,
-    shadowRadius: 2,
     shadowOffset: {
       height: 1,
       width: 2,
     },
+    shadowOpacity: 0.8,
+    shadowRadius: 2,
   },
+
   cardImageStyle: {
     height: 170,
     resizeMode: 'cover',
   },
+
   cardTitleStyle: {
     position: 'absolute',
-    top: 120,
+
     left: 26,
+    top: 120,
+
     backgroundColor: 'transparent',
-    padding: 16,
-    fontSize: 24,
     color: '#000000',
+    fontSize: 24,
     fontWeight: 'bold',
+    padding: 16,
   },
+
   cardContentStyle: {
-    padding: 15,
     color: 'rgba(0, 0, 0, 0.54)',
+    padding: 15,
   },
+
   cardActionStyle: {
     borderStyle: 'solid',
     borderTopColor: 'rgba(0, 0, 0, 0.1)',
     borderTopWidth: 1,
     padding: 15,
   },
+
   cardMenuStyle: {
+    backgroundColor: 'transparent',
     position: 'absolute',
-    top: 16,
     right: 16,
-    backgroundColor: 'transparent',
+    top: 16,
   },
 });
 
@@ -209,6 +228,6 @@ export function getTheme(): Theme {
 export default {
   AttrReference,
   RGBAttrReference,
-  primaryColorRef,
   accentColorRef,
+  primaryColorRef,
 }
```

---

### Incident Patch 13: `76cb22fa` (2018-03-02)
**Commit Message**: Fix Issue 174 - <TextField /> is not remeasured on orientation change (#328)

<TextField /> is not being updated then orientation changes.

**File**: `lib/mdl/Textfield.js` (modified, +1/-1)
```diff
@@ -529,7 +529,7 @@ class Textfield extends Component {
     });
 
     return (
-      <View style={this.props.style} >
+      <View style={this.props.style} onLayout={this._doMeasurement.bind(this)}>
         {floatingLabel}
         <TextInput  // the input
           ref="input"
```

---

### Incident Patch 14: `cf6a7814` (2017-11-11)
**Commit Message**: Fix ViewPropTypes issue for older versions of react-native. Fix floating label crash (#339)

* 0.4.2

* Fixed floating label issue

* 0.4.3

* Fixed ViewPropTypes to work for newer and older versions of react-native

* Handle Android RN 0.47 breaking change

* 0.4.4

* Update package.json

**File**: `lib/internal/MKTouchable.js` (modified, +2/-1)
```diff
@@ -13,6 +13,7 @@ import {
   requireNativeComponent,
   NativeModules,
   findNodeHandle,
+  View
 } from 'react-native';
 const UIManager = NativeModules.UIManager;
 
@@ -56,7 +57,7 @@ class MKTouchable extends Component {
 // ## <section id='props'>Props</section>
 MKTouchable.propTypes = {
   // [RN.View Props](https://facebook.github.io/react-native/docs/view.html#props)...
-  ...ViewPropTypes,
+  ...(ViewPropTypes || View.propTypes),
 
   // Touch events callback
   onTouch: PropTypes.func,
```

**File**: `lib/internal/Thumb.js` (modified, +1/-1)
```diff
@@ -201,7 +201,7 @@ class Thumb extends Component {
 
 Thumb.propTypes = {
   // [RN.View Props](https://facebook.github.io/react-native/docs/view.html#props)...
-  ...ViewPropTypes,
+  ...(ViewPropTypes || View.propTypes),
 
   // Callback to handle onPanResponderGrant gesture
   onGrant: PropTypes.func,
```

**File**: `lib/mdl/IndeterminateProgress.js` (modified, +2/-2)
```diff
@@ -17,7 +17,7 @@ import { ViewPropTypes } from '../utils';
 import {
   Animated,
   Easing,
-  View,
+  View
 } from 'react-native';
 
 import { getTheme } from '../theme';
@@ -31,7 +31,7 @@ class IndeterminateProgress extends Component {
   // ## <section id='Props'>Props</section>
   static propTypes = {
     // [View Props](https://facebook.github.io/react-native/docs/view.html#props)...
-    ...ViewPropTypes,
+    ...(ViewPropTypes || View.propTypes),
 
     // Color of the progress layer
     progressColor: PropTypes.string,
```

**File**: `lib/mdl/Progress.js` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ class Progress extends Component {
   // ## <section id='props'>Props</section>
   static propTypes = {
     // [View Props](https://facebook.github.io/react-native/docs/view.html#props)...
-    ...ViewPropTypes,
+    ...(ViewPropTypes || View.propTypes),
 
     // Initial value of progress, Number: [0, 1.0]
     progress: PropTypes.number,
```

**File**: `lib/mdl/RangeSlider.js` (modified, +1/-1)
```diff
@@ -390,7 +390,7 @@ Object.defineProperty(RangeSlider.prototype, 'maxValue', {
 // ## <section id='props'>Props</section>
 RangeSlider.propTypes = {
   // [RN.View Props](https://facebook.github.io/react-native/docs/view.html#props)...
-  ...ViewPropTypes,
+  ...(ViewPropTypes || View.propTypes),
 
   // Minimum value of the range, default is `0`
   min: PropTypes.number,
```

**File**: `lib/mdl/Ripple.js` (modified, +2/-1)
```diff
@@ -18,6 +18,7 @@ import {
   Platform,
   NativeModules,
   findNodeHandle,
+  View
 } from 'react-native';
 const UIManager = NativeModules.UIManager;
 
@@ -263,7 +264,7 @@ class Ripple extends Component {
 // ## <section id='props'>Props</section>
 Ripple.propTypes = {
   // [RN.View Props](https://facebook.github.io/react-native/docs/view.html#props)...
-  ...ViewPropTypes,
+  ...(ViewPropTypes || View.propTypes),
 
   // Color of the `Ripple` layer
   rippleColor: PropTypes.string,
```

**File**: `lib/mdl/Slider.js` (modified, +2/-2)
```diff
@@ -17,7 +17,7 @@ import { ViewPropTypes } from '../utils';
 import {
   Animated,
   PanResponder,
-  View,
+  View
 } from 'react-native';
 
 import { getTheme } from '../theme';
@@ -40,7 +40,7 @@ class Slider extends Component {
   // ## <section id='props'>Props</section>
   static propTypes = {
     // [RN.View Props](https://facebook.github.io/react-native/docs/view.html#props)...
-    ...ViewPropTypes,
+    ...(ViewPropTypes || View.propTypes),
 
     // Minimum value of the range, default is `0`
     min: PropTypes.number,
```

**File**: `lib/mdl/Spinner.android.js` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ import React, {
 import PropTypes from 'prop-types';
 
 import {
-  requireNativeComponent,
+  requireNativeComponent
 } from 'react-native';
 
 import { getTheme } from '../theme';
```

---

### Incident Patch 15: `f7a6ed23` (2017-11-11)
**Commit Message**: fix(RangeSlider): step not working when min > 0 (#327)

* fix(RangeSlider): step not working when min > 0

* divisor should support range slider with min>0

**File**: `lib/mdl/RangeSlider.js` (modified, +2/-2)
```diff
@@ -115,7 +115,7 @@ class RangeSlider extends Component {
   };
 
   _defaultStepIncrement = () =>
-    this._toPixelScale(this.props.max) / (this.props.max / (this.props.step));
+    this._toPixelScale(this.props.max) / ((this.props.max - this.props.min) / (this.props.step));
 
   // endregion
 
@@ -266,7 +266,7 @@ class RangeSlider extends Component {
 
   // Step must be a divisor of max
   _verifyStep() {
-    const divisor = this.props.max / this.props.step;
+    const divisor = (this.props.max - this.props.min) / this.props.step;
     if (divisor % 1 !== 0) {
       throw new Error(`Given step ( ${this.props.step} ) must be \
         a divisor of max ( ${this.props.max} )`);
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
