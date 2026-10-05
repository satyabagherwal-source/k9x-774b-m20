# Forensic Learning Record (Deep Inspection): wix/react-native-calendars

> **Canonical Artifact**: `07_PROJECT_LEARNING/wix-react-native-calendars-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wix/react-native-calendars](https://github.com/wix/react-native-calendars))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:49:40.404Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wix/react-native-calendars`
- **Description**: React Native Calendar Components 🗓️ 📆 
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10319 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/dateutils.ts`
```
const XDate = require('xdate');
const {toMarkingFormat} = require('./interface');

const latinNumbersPattern = /[0-9]/g;

function isValidXDate(date: any) {
  return date && (date instanceof XDate);
}

export function sameMonth(a?: XDate, b?: XDate) {
  if (!isValidXDate(a) || !isValidXDate(b)) {
    return false;
  } else {
    return a?.getFullYear() === b?.getFullYear() && a?.getMonth() === b?.getMonth();
  }
}

export function sameDate(a?: XDate, b?: XDate) {
  if (!isValidXDate(a) || !isValidXDate(b)) {
    return false;
  } else {
    return a?.getFullYear() === b?.getFullYear() && a?.getMonth() === b?.getMonth() && a?.getDate() === b?.getDate();
  }
}

export function onSameDateRange({
  firstDay,
  secondDay,
  numberOfDays,
  firstDateInRange
}: {
  firstDay: string;
  secondDay: string;
  numberOfDays: number;
  firstDateInRange: string;
}){
  const aDate = new XDate(firstDay);
  const bDate = new XDate(secondDay);
  const firstDayDate = new XDate(firstDateInRange);
  const aDiff = aDate.getTime() - firstDayDate.getTime();
  const bDiff = bDate.getTime() - firstDayDate.getTime();
  const aTotalDays = Math.ceil(aDiff / (1000 * 3600 * 24));
  const bTotalDays = Math.ceil(bDiff / (1000 * 3600 * 24));
  const aWeek = Math.floor(aTotalDays / numberOfDays);
  const bWeek = Math.floor(bTotalDays / numberOfDays);
  return aWeek === bWeek;
}

export function sameWeek(a: string, b: string, firstDayOfWeek: number) {
  const weekDates = getWeekDates(a, firstDayOfWeek, 'yyyy-MM-dd');
  const element = weekDates instanceof XDate ? new XDate(b) : b;
  return weekDates?.includes(element);
}

export function isPastDate(date: string) {
  const today = new XDate();
  const d = new XDate(date);

  if (today.getFullYear() > d.getFullYear()) {
    return true;
  }
  if (today.getFullYear() === d.getFullYear()) {
    if (today.getMonth() > d.getMonth()) {
      return true;
    }
    if (today.getMonth() === d.getMonth()) {
      if (today.getDate() > d.getDate()) {
        return true;
      }
    }
  }
  return false;
}

export function isToday(date?: XDate | string) {
  const d = date instanceof XDate ? date : new XDate(date);
  return sameDate(d, XDate.today());
}

export function isGTE(a: XDate, b: XDate) {
  if (a && b) {
    return b.diffDays(a) > -1;
  }
}

export function isLTE(a: XDate, b: XDate) {
  if (a && b) {
    return a.diffDays(b) > -1;
  }
}

export function formatNumbers(date: any) {
  const numbers = getLocale().numbers;
  return numbers ? date.toString().replace(latinNumbersPattern, (char: any) => numbers[+char]) : date;
}

function fromTo(a: XDate, b: XDate): XDate[] {
  const days: XDate[] = [];
  let from = +a;
  const to = +b;

  for (; from <= to; from = new XDate(from, true).addDays(1).getTime()) {
    days.push(new XDate(from, true));
  }
  return days;
}

export function month(date: XDate) { // exported for tests only
  const year = date.getFullYear(),
    month = date.getMonth();
  const days = new XDate(year, month + 1, 0).getDate();

  const firstDay: XDate = new XDate(year, month, 1, 0, 0, 0, true);
  const lastDay: XDate = new XDate(year, month, days, 0, 0, 0, true);

  return fromTo(firstDay, lastDay);
}

export function weekDayNames(firstDayOfWeek = 0) {
  let weekDaysNames = getLocale().dayNamesShort;
  const dayShift = firstDayOfWeek % 7;
  if (dayShift) {
    weekDaysNames = weekDaysNames.slice(dayShift).concat(weekDaysNames.slice(0, dayShift));
  }
  return weekDaysNames;
}

export function page(date: XDate, firstDayOfWeek = 0, showSixWeeks = false) {
  const days = month(date);
  let before: XDate[] = [];
  let after: XDate[] = [];

  const fdow = (7 + firstDayOfWeek) % 7 || 7;
  const ldow = (fdow + 6) % 7;

  firstDayOfWeek = firstDayOfWeek || 0;

  const from = days[0].clone();
  const daysBefore = from.getDay();

  if (from.getDay() !== fdow) {
    from.addDays(-(from.getDay() + 7 - fdow) % 7);
  }

  const to = days[days.length - 1].clone();
  const day = to.getDay();
  if (day !== ldow) {
    to.addDays((ldow + 7 - day) % 7);
  }

  const daysForSixWeeks = (daysBefore + days.length) / 6 >= 6;

  if (showSixWeeks && !daysForSixWeeks) {
    to.addDays(7);
  }

  if (isLTE(from, days[0])) {
    before = fromTo(from, days[0]);
  }

  if (isGTE(to, days[days.length - 1])) {
    after = fromTo(days[days.length - 1], to);
  }

  return before.concat(days.slice(1, days.length - 1), after);
}

export function isDateNotInRange(date: XDate, minDate: string, maxDate: string) {
  return (minDate && !isGTE(date, new XDate(minDate))) || (maxDate && !isLTE(date, new XDate(maxDate)));
}

export function getWeekDates(date: string, firstDay = 0, format?: string) {
  const d: XDate = new XDate(date);
  if (date && d.valid()) {
    const daysArray = [d];
    let dayOfTheWeek = d.getDay() - firstDay;
    if (dayOfTheWeek < 0) {
      // to handle firstDay > 0
      dayOfTheWeek = 7 + dayOfTheWeek;
    }

    let newDate = d;
    let index = dayOfTheWeek - 1;
    while (index >= 0) {
      newDate = newDate.clone().addDays(-1);
      daysArray.unshift(newDate);
      index -= 1;
    }

    newDate = d;
    index = dayOfTheWeek + 1;
    while (index < 7) {
      newDate = newDate.clone().addDays(1);
      daysArray.push(newDate);
      index += 1;
    }

    if (format) {
      return daysArray.map(d => d.toString(format));
    }

    return daysArray;
  }
}

export function getPartialWeekDates(date?: string, numberOfDays = 7) {
  let index = 0;
  const partialWeek: string[] = [];
  while (index < numberOfDays) {
    partialWeek.push(generateDay(date || new XDate(), index));
    index++;
  }
  return partialWeek;
}

export function generateDay(originDate: string | XDate, daysOffset = 0) {
  const baseDate = originDate instanceof XDate ? originDate : new XDate(originDate);
  return toMarkingFormat(baseDate.clone().addDays(daysOffset));
}

export function getLocale() {
  return XDate.locales[XDate.defaultLocale];
}

```

### Core Architecture Module: `src/day-state-manager.ts`
```
const {isToday, isDateNotInRange, sameMonth} = require('./dateutils');
const {toMarkingFormat} = require('./interface');

export function getState(day: XDate, current: XDate, props: any, disableDaySelection: boolean) {
  const {minDate, maxDate, disabledByDefault, disabledByWeekDays, context} = props;
  let state;

  if (!disableDaySelection && (context?.selectedDate ?? toMarkingFormat(current)) === toMarkingFormat(day)) {
    state = 'selected';
  } else if (isToday(day)) {
    state = 'today';
  } else if (disabledByDefault) {
    state = 'disabled';
  } else if (isDateNotInRange(day, minDate, maxDate)) {
    state = 'disabled';
  } else if (!sameMonth(day, current)) {
    state = 'disabled';
  } else if (disabledByWeekDays && disabledByWeekDays.indexOf(day.getDay()) !== -1) {
    state = 'disabled';
  }

  return state;
}

```

### Core Architecture Module: `src/hooks.ts`
```
import React, {useEffect, useRef, DependencyList} from 'react';

/**
 * This hook avoid calling useEffect on the initial value of his dependency array
 */
export const useDidUpdate = (callback: () => void, dep: DependencyList) => {
  const isMounted = useRef<boolean>(false);

  useEffect(() => {
    if (isMounted.current) {
      callback();
    } else {
      isMounted.current = true;
    }
  }, dep);
};

export const useCombinedRefs = (...refs: React.Ref<any>[]) => {
  const targetRef = React.useRef();

  React.useEffect(() => {
    refs.forEach(ref => {
      if (!ref) {
        return;
      }

      if (typeof ref === 'function') {
        ref(targetRef.current);
      } else {
        // @ts-expect-error
        ref.current = targetRef.current;
      }
    });
  }, [refs]);

  return targetRef;
};

```

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
  env: {
    es6: true,
    node: true,
    'jest/globals': true
  },
  globals: {
    expect: true,
    it: true,
    describe: true
  },
  root: true,
  extends: ['@react-native', 'plugin:react-hooks/recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      experimentalObjectRestSpread: true,
      jsx: true
    },
    sourceType: 'module'
  },
  plugins: ['react', 'react-native', 'jest', '@typescript-eslint'],
  rules: {
    'prettier/prettier': ['warn'],
    'comma-dangle': ['error', 'never'],
    'curly': 'off',
    'eol-last': 'error',
    'no-unused-expressions': 'off',
    'max-len': ['warn', {code: 120, ignoreComments: true, ignoreStrings: true}],
    'new-cap': 'off',
    'no-mixed-operators': ['off'],
    'no-trailing-spaces': 'off',
    'no-undef': 'off',
    'operator-linebreak': 'off',
    'semi': ['error', 'always'],
    '@typescript-eslint/ban-ts-comment': 1,
    '@typescript-eslint/explicit-function-return-type': 0,
    '@typescript-eslint/no-shadow': 0,
    '@typescript-eslint/no-unused-vars': ['warn', {argsIgnorePattern: '^_'}],
    '@typescript-eslint/no-use-before-define': 0,
    '@typescript-eslint/no-var-requires': 0,
    'react/jsx-tag-spacing': [
      'error',
      {
        closingSlash: 'never',
        beforeSelfClosing: 'never',
        afterOpening: 'never',
        beforeClosing: 'never'
      }
    ],
    'react/jsx-no-bind': [
      'off',
      {
        ignoreRefs: true,
        allowArrowFunctions: false,
        allowBind: false
      }
    ],
    'react/jsx-uses-react': 2,
    'react/jsx-uses-vars': 2,
    'react-native/no-inline-styles': 1
  }
};

```

### Core Architecture Module: `android/app/src/main/java/com/calendarsexample/MainActivity.kt`
```
package com.calendarsexample

import android.os.Bundle;

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "CalendarsExample"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
      
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }
}

```

### Core Architecture Module: `android/app/src/main/java/com/calendarsexample/MainApplication.kt`
```
package com.calendarsexample

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.flipper.ReactNativeFlipper
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(this.applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, false)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
    ReactNativeFlipper.initializeFlipper(this, reactNativeHost.reactInstanceManager)
  }
}

```

### Core Architecture Module: `babel.config.js`
```
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        root: ['.'],
        alias: {
          'react-native-calendars': './src/index.ts'
        }
      }
    ]
  ]
};

```

### Core Architecture Module: `detox.config.js`
```
module.exports = {
  configurations: {
    "ios.sim.debug": {
      binaryPath: "ios/build/Build/Products/Debug-iphonesimulator/CalendarsExample.app",
      build: "xcodebuild -workspace ios/CalendarsExample.xcworkspace -scheme CalendarsExample -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build",
      type: "ios.simulator",
      device: {
        type: "iPhone 11",
        os: "iOS 13.7"
      }
    },
    "ios.sim.release": {
      binaryPath: "ios/build/Build/Products/Release-iphonesimulator/CalendarsExample.app",
      build: "xcodebuild -workspace ios/CalendarsExample.xcworkspace -scheme CalendarsExample -configuration Release -sdk iphonesimulator -derivedDataPath ios/build",
      type: "ios.simulator",
      device: {
        type: "iPhone 11",
        os: "iOS 13.7"
      }
    }
  },
  artifacts: {
    plugins: {
      uiHierarchy: process.env.JENKINS_CI ? "enabled" : undefined
    }
  },
  testRunner: "mocha"
};

```

### Core Architecture Module: `e2e/init.js`
```
const detox = require('detox');
const config = require('../package.json').detox;
const adapter = require('detox/runners/mocha/adapter');

before(async () => {
  await detox.init(config);
  await device.launchApp();
});

beforeEach(async function () {
  await adapter.beforeEach(this);
});

afterEach(async function () {
  await adapter.afterEach(this);
});

after(async () => {
  await detox.cleanup();
});

```

### Core Architecture Module: `example/src/app.tsx`
```
import './wdyr'; // <--- must be first import
import React from 'react';
import {AppRegistry} from 'react-native';
//@ts-expect-error
import {LocaleConfig} from 'react-native-calendars';
import {name as appName} from '../app.json';
import MenuScreen from './screens/menuScreen';

/** Locale */

LocaleConfig.locales['en'] = {
  formatAccessibilityLabel: "dddd d 'of' MMMM 'of' yyyy",
  monthNames: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ],
  monthNamesShort: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
  dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  dayNamesShort: ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  // numbers: ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] // <--- number localization example
};
LocaleConfig.locales['fr'] = {
  monthNames: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
  monthNamesShort: ['Janv.','Févr.','Mars','Avril','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.'],
  dayNames: ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'],
  dayNamesShort: ['Dim.','Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.'],
  today: 'Aujourd\'hui'
};
LocaleConfig.locales['he'] = {
  formatAccessibilityLabel: "dddd d 'of' MMMM 'of' yyyy",
  monthNames: [
    'ינואר',
    'פברואר',
    'מרץ',
    'אפריל',
    'מאי',
    'יוני',
    'יולי',
    'אוגוסט',
    'ספטמבר',
    'אוקטובר',
    'נובמבר',
    'דצמבר'
  ],
  monthNamesShort: ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'],
  dayNames: ['ראון', 'שני', 'שלישי', 'קביעי', 'חמישי', 'שישי', 'שבת'],
  dayNamesShort: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
};
LocaleConfig.defaultLocale = 'en';

export default function App() {
  return <MenuScreen/>;
}
AppRegistry.registerComponent(appName, () => App);

```

### Core Architecture Module: `example/src/mocks/AgendaItem.tsx`
```
import isEmpty from 'lodash/isEmpty';
import React, {useCallback} from 'react';
import {StyleSheet, Alert, View, Text, TouchableOpacity, Button} from 'react-native';
import testIDs from '../testIDs';

interface ItemProps {
  item: any;
}

const AgendaItem = (props: ItemProps) => {
  const {item} = props;

  const buttonPressed = useCallback(() => {
    Alert.alert('Show me more');
  }, []);

  const itemPressed = useCallback(() => {
    Alert.alert(item.title);
  }, [item]);

  if (isEmpty(item)) {
    return (
      <View style={styles.emptyItem}>
        <Text style={styles.emptyItemText}>No Events Planned Today</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={itemPressed} style={styles.item} testID={testIDs.agenda.ITEM}>
      <View>
        <Text style={styles.itemHourText}>{item.hour}</Text>
        <Text style={styles.itemDurationText}>{item.duration}</Text>
      </View>
      <Text style={styles.itemTitleText}>{item.title}</Text>
      <View style={styles.itemButtonContainer}>
        <Button color={'grey'} title={'Info'} onPress={buttonPressed}/>
      </View>
    </TouchableOpacity>
  );
};

export default React.memo(AgendaItem);

const styles = StyleSheet.create({
  item: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: 'lightgrey',
    flexDirection: 'row'
  },
  itemHourText: {
    color: 'black'
  },
  itemDurationText: {
    color: 'grey',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4
  },
  itemTitleText: {
    color: 'black',
    marginLeft: 16,
    fontWeight: 'bold',
    fontSize: 16
  },
  itemButtonContainer: {
    flex: 1,
    alignItems: 'flex-end'
  },
  emptyItem: {
    paddingLeft: 20,
    height: 52,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'lightgrey'
  },
  emptyItemText: {
    color: 'lightgrey',
    fontSize: 14
  }
});

```

### Core Architecture Module: `example/src/mocks/agendaItems.ts`
```
import isEmpty from 'lodash/isEmpty';
import {MarkedDates} from '../../../src/types';

const today = new Date().toISOString().split('T')[0];
const pastDate = getPastDate(3);
const futureDates = getFutureDates(12);
const dates = [pastDate, today].concat(futureDates);

function getFutureDates(numberOfDays: number) {
  const array: string[] = [];
  for (let index = 1; index <= numberOfDays; index++) {
    let d = Date.now();
    if (index > 8) {
      // set dates on the next month
      const newMonth = new Date(d).getMonth() + 1;
      d = new Date(d).setMonth(newMonth);
    }
    const date = new Date(d + 864e5 * index); // 864e5 == 86400000 == 24*60*60*1000
    const dateString = date.toISOString().split('T')[0];
    array.push(dateString);
  }
  return array;
}
function getPastDate(numberOfDays: number) {
  return new Date(Date.now() - 864e5 * numberOfDays).toISOString().split('T')[0];
}

export const agendaItems = [
  {
    title: dates[0],
    data: [{hour: '12am', duration: '1h', title: 'First Yoga'}, {hour: '9am', duration: '1h', title: 'Long Yoga', itemCustomHeightType: 'LongEvent'}]
  },
  {
    title: dates[1],
    data: [
      {hour: '4pm', duration: '1h', title: 'Pilates ABC'},
      {hour: '5pm', duration: '1h', title: 'Vinyasa Yoga'}
    ]
  },
  {
    title: dates[2],
    data: [
      {hour: '1pm', duration: '1h', title: 'Ashtanga Yoga'},
      {hour: '2pm', duration: '1h', title: 'Deep Stretches'},
      {hour: '3pm', duration: '1h', title: 'Private Yoga'}
    ]
  },
  {
    title: dates[3],
    data: [{hour: '12am', duration: '1h', title: 'Ashtanga Yoga'}]
  },
  {
    title: dates[4],
    data: [{}]
  },
  {
    title: dates[5],
    data: [
      {hour: '9pm', duration: '1h', title: 'Middle Yoga'},
      {hour: '10pm', duration: '1h', title: 'Ashtanga'},
      {hour: '11pm', duration: '1h', title: 'TRX'},
      {hour: '12pm', duration: '1h', title: 'Running Group'}
    ]
  },
  {
    title: dates[6],
    data: [
      {hour: '12am', duration: '1h', title: 'Ashtanga Yoga'}
    ]
  },
  {
    title: dates[7],
    data: [{}]
  },
  {
    title: dates[8],
    data: [
      {hour: '9pm', duration: '1h', title: 'Pilates Reformer'},
      {hour: '10pm', duration: '1h', title: 'Ashtanga'},
      {hour: '11pm', duration: '1h', title: 'TRX'},
      {hour: '12pm', duration: '1h', title: 'Running Group'}
    ]
  },
  {
    title: dates[9],
    data: [
      {hour: '1pm', duration: '1h', title: 'Ashtanga Yoga'},
      {hour: '2pm', duration: '1h', title: 'Deep Stretches'},
      {hour: '3pm', duration: '1h', title: 'Private Yoga'}
    ]
  },
  {
    title: dates[10],
    data: [
      {hour: '12am', duration: '1h', title: 'Last Yoga'}
    ]
  },
  {
    title: dates[11],
    data: [
      {hour: '1pm', duration: '1h', title: 'Ashtanga Yoga'},
      {hour: '2pm', duration: '1h', title: 'Deep Stretches'},
      {hour: '3pm', duration: '1h', title: 'Private Yoga'}
    ]
  },
  {
    title: dates[12],
    data: [
      {hour: '12am', duration: '1h', title: 'Last Yoga'}
    ]
  },
  {
    title: dates[13],
    data: [
      {hour: '12am', duration: '1h', title: 'Last Yoga'}
    ]
  }
];

export function getMarkedDates() {
  const marked: MarkedDates = {};

  agendaItems.forEach(item => {
    // NOTE: only mark dates with data
    if (item.data && item.data.length > 0 && !isEmpty(item.data[0])) {
      marked[item.title] = {marked: true};
    } else {
      marked[item.title] = {disabled: true};
    }
  });
  return marked;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2787** (2026-05-13): **Calendário**
  *Symptoms*: AgendaScreen.js
  **Post-Mortem & Fix Analysis**:
  > const agenda = [   {     tipo: "Treino",     data: "15/05/2026",     horario: "18:30",     descricao: "Treino de finalização"   },   {     tipo: "Jogo",     data: "20/05/2026",     horario: "09:00",     descricao: "União Barbarense x Escolinha"   } ]

- **Issue #2786** (2026-05-11): **feat/updated calendar layout**
  *Symptoms*: 

- **Issue #2785** (2026-05-11): **feat/updated calendar layout**
  *Symptoms*: 

- **Issue #2784** (2026-05-05): **[Accessibility] Month Navigation is Unnavigable with iOS VoiceOver activated**
  *Symptoms*: ## Issue  We use React Native Calendars on our mobile app, and are in the midst of an Accessibility improvement effort. We found that when VoiceOver is active on an iOS device, the caret icons `<` and `>` for navigating to a new month are unreachable by VoiceOver, and swiping gestures are unable to change the months as well.  This issue is not present on Android devices. TalkBack is able to focus on the buttons and toggle the months normally.  ## Evidence  https://github.com/user-attachments/assets/debdeae2-8aff-4ea1-b2f1-451ffc22c563  ## Fix  We created a React Native patch that appears to fix the issue and allow for a more logical focus order on the Calendar month selection header
  **Post-Mortem & Fix Analysis**:
  > Turns out this is a non-issue. The month changing is accessible by swiping up/down, which we didn't realize until just a short bit ago. Closing this issue.

- **Issue #2782** (2026-10-04): **Bump fast-xml-parser from 4.5.3 to 4.5.6**
  *Symptoms*: Bumps [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) from 4.5.3 to 4.5.6. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/NaturalIntelligence/fast-xml-parser/releases">fast-xml-parser's releases</a>.</em></p> <blockquote> <h2>Summary update on all the previous releases from v4.2.4</h2> <ul> <li>Multiple minor fixes provided in the validator and parser</li> <li>v6 is added for experimental use.</li> <li>ignoreAttributes support function, and array of string or regex</li> <li>Add support for parsing HTML numeric entities</li> <li>v5 of the application is ESM module now. However, JS is also supported</li> </ul> <p><strong>Note</strong>: Release section in not updated frequently. Please check <a href="https://github.com/NaturalIntelligence/fast-xml-parser/blob/master/CHANGELOG.md">CHANGELOG</a> or <a href="https://github.com/NaturalIntelligence/fast-xml-parser/tags">Tags</a> for latest release information.</p> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/NaturalIntelligence/fast-xml-parser/commit/42fbb0bc95e753e03fe52cb0805a8774bba4bf28"><code>42fbb0b</code></a> update release info</li> <li><a href="https://github.com/NaturalIntelligence/fast-xml-parser/commit/805671cb6c19108b171b876cf3e8865f18cdb8fd"><code>805671c</code></a> increase expansion limit as many system need it</li> <li><a href="https://github.com/NaturalIntelligence/fast-xml-parser/commit/9a2cf0
  **Post-Mortem & Fix Analysis**:
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #2777** (2026-04-23): **Bump fast-xml-parser from 4.5.3 to 4.5.5**
  *Symptoms*: Bumps [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) from 4.5.3 to 4.5.5. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/NaturalIntelligence/fast-xml-parser/releases">fast-xml-parser's releases</a>.</em></p> <blockquote> <h2>Summary update on all the previous releases from v4.2.4</h2> <ul> <li>Multiple minor fixes provided in the validator and parser</li> <li>v6 is added for experimental use.</li> <li>ignoreAttributes support function, and array of string or regex</li> <li>Add support for parsing HTML numeric entities</li> <li>v5 of the application is ESM module now. However, JS is also supported</li> </ul> <p><strong>Note</strong>: Release section in not updated frequently. Please check <a href="https://github.com/NaturalIntelligence/fast-xml-parser/blob/master/CHANGELOG.md">CHANGELOG</a> or <a href="https://github.com/NaturalIntelligence/fast-xml-parser/tags">Tags</a> for latest release information.</p> </blockquote> </details> <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/NaturalIntelligence/fast-xml-parser/blob/master/CHANGELOG.md">fast-xml-parser's changelog</a>.</em></p> <blockquote> <p><!-- raw HTML omitted -->Note: If you find missing information about particular minor version, that version must have been changed without any functional change in this library.<!-- raw HTML omitted --></p> <p>Note: Due to some last quick changes on v4, detail of v4.5.3 &amp; v
  **Post-Mortem & Fix Analysis**:
  > Superseded by #2782.

- **Issue #2775** (2026-10-04): **Bump lodash from 4.17.21 to 4.18.1**
  *Symptoms*: Bumps [lodash](https://github.com/lodash/lodash) from 4.17.21 to 4.18.1. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/lodash/lodash/releases">lodash's releases</a>.</em></p> <blockquote> <h2>4.18.1</h2> <h2>Bugs</h2> <p>Fixes a <code>ReferenceError</code> issue in <code>lodash</code> <code>lodash-es</code> <code>lodash-amd</code> and <code>lodash.template</code> when using the <code>template</code> and <code>fromPairs</code> functions from the modular builds. See <a href="https://redirect.github.com/lodash/lodash/issues/6167#issuecomment-4165269769">lodash/lodash#6167</a></p> <p>These defects were related to how lodash distributions are built from the main branch using <a href="https://github.com/lodash-archive/lodash-cli">https://github.com/lodash-archive/lodash-cli</a>. When internal dependencies change inside lodash functions, equivalent updates need to be made to a mapping in the lodash-cli. (hey, it was ahead of its time once upon a time!). We know this, but we missed it in the last release. It's the kind of thing that passes in CI, but fails bc the build is not the same thing you tested.</p> <p>There is no diff on main for this, but you can see the diffs for each of the npm packages on their respective branches:</p> <ul> <li><code>lodash</code>: <a href="https://github.com/lodash/lodash/compare/4.18.0-npm...4.18.1-npm">https://github.com/lodash/lodash/compare/4.18.0-npm...4.18.1-npm</a></li> <li><code>lodash-es</code>: <a hr
  **Post-Mortem & Fix Analysis**:
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #2772** (2026-04-09): **Bump fast-xml-parser from 4.5.3 to 4.5.4**
  *Symptoms*: Bumps [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) from 4.5.3 to 4.5.4. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/NaturalIntelligence/fast-xml-parser/releases">fast-xml-parser's releases</a>.</em></p> <blockquote> <h2>Summary update on all the previous releases from v4.2.4</h2> <ul> <li>Multiple minor fixes provided in the validator and parser</li> <li>v6 is added for experimental use.</li> <li>ignoreAttributes support function, and array of string or regex</li> <li>Add support for parsing HTML numeric entities</li> <li>v5 of the application is ESM module now. However, JS is also supported</li> </ul> <p><strong>Note</strong>: Release section in not updated frequently. Please check <a href="https://github.com/NaturalIntelligence/fast-xml-parser/blob/master/CHANGELOG.md">CHANGELOG</a> or <a href="https://github.com/NaturalIntelligence/fast-xml-parser/tags">Tags</a> for latest release information.</p> </blockquote> </details> <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/NaturalIntelligence/fast-xml-parser/blob/master/CHANGELOG.md">fast-xml-parser's changelog</a>.</em></p> <blockquote> <p><!-- raw HTML omitted -->Note: If you find missing information about particular minor version, that version must have been changed without any functional change in this library.<!-- raw HTML omitted --></p> <p>Note: Due to some last quick changes on v4, detail of v4.5.3 &amp; v
  **Post-Mortem & Fix Analysis**:
  > Superseded by #2777.

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

### Incident Patch 1: `808c6e10` (2026-01-29)
**Commit Message**: Fix/dedupe and 2748 (#2761)

* yarn dedupe and pod install

* Prevent FlatList from rendering with empty data see #2748

**File**: `ios/Podfile.lock` (modified, +34/-44)
```diff
@@ -944,12 +944,6 @@ PODS:
   - React-Mapbuffer (0.73.11):
     - glog
     - React-debug
-  - react-native-safe-area-context (4.5.0):
-    - RCT-Folly
-    - RCTRequired
-    - RCTTypeSafety
-    - React-Core
-    - ReactCommon/turbomodule/core
   - React-nativeconfig (0.73.11)
   - React-NativeModulesApple (0.73.11):
     - glog
@@ -1173,7 +1167,6 @@ DEPENDENCIES:
   - React-jsinspector (from `../node_modules/react-native/ReactCommon/jsinspector-modern`)
   - React-logger (from `../node_modules/react-native/ReactCommon/logger`)
   - React-Mapbuffer (from `../node_modules/react-native/ReactCommon`)
-  - react-native-safe-area-context (from `../node_modules/react-native-safe-area-context`)
   - React-nativeconfig (from `../node_modules/react-native/ReactCommon`)
   - React-NativeModulesApple (from `../node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios`)
   - React-perflogger (from `../node_modules/react-native/ReactCommon/reactperflogger`)
@@ -1268,8 +1261,6 @@ EXTERNAL SOURCES:
     :path: "../node_modules/react-native/ReactCommon/logger"
   React-Mapbuffer:
     :path: "../node_modules/react-native/ReactCommon"
-  react-native-safe-area-context:
-    :path: "../node_modules/react-native-safe-area-context"
   React-nativeconfig:
     :path: "../node_modules/react-native/ReactCommon"
   React-NativeModulesApple:
@@ -1316,7 +1307,7 @@ EXTERNAL SOURCES:
 SPEC CHECKSUMS:
   boost: d3f49c53809116a5d38da093a8aa78bf551aed09
   CocoaAsyncSocket: 065fd1e645c7abab64f7a6a2007a48038fdc6a99
-  DoubleConversion: fea03f2699887d960129cc54bba7e52542b6f953
+  DoubleConversion: 831926d9b8bf8166fd87886c4abab286c2422662
   FBLazyVector: b46891061bfe0a9b07f601813114c8653a72a45c
   FBReactNativeSpec: 9a01850c21d81027fa7b20b9dcc25d9bfae083da
   Flipper: c7a0093234c4bdd456e363f2f19b2e4b27652d44
@@ -1328,55 +1319,54 @@ SPEC CHECKSUMS:
   Flipper-PeerTalk: 116d8f857dc6ef55c7a5a75ea3ceaafe878aadc9
   FlipperKit: 37525a5d056ef9b93d1578e04bc3ea1de940094f
   fmt: ff9d55029c625d3757ed641535fd4a75fedc7ce9
-  glog: c5d68082e772fa1c511173d6b30a9de2c05a69a2
+  glog: 476ee3e89abb49e07f822b48323c51c57124b572
   hermes-engine: d992945b77c506e5164e6a9a77510c9d57472c59
   libevent: 4049cae6c81cdb3654a443be001fb9bdceff7913
   OpenSSL-Universal: ebc357f1e6bc71fa463ccb2fe676756aff50e88c
-  RCT-Folly: cd21f1661364f975ae76b3308167ad66b09f53f5
+  RCT-Folly: 7169b2b1c44399c76a47b5deaaba715eeeb476c0
   RCTRequired: 415e56f7c33799a6483e41e4dce607f3daf1e69b
   RCTTypeSafety: e984a88e713281c2d8c2309a1a6d2775af0107ae
   React: ab885684e73c5f659bad63446a977312fd3d1ecb
   React-callinvoker: 50a2d1ce3594637c700401ba306373321231eb71
-  React-Codegen: 0ca856c100b98ab436c73601f9b1296a58d26b92
-  React-Core: d5166294382484f57e25dfde05ba00596703d51c
-  React-CoreModules: 459534f8112ee73e94f04f5e58276b3d236efd16
-  React-cxxreact: d5716540fd97df323792ef1d227f50515fb3e1a8
+  React-Codegen: 0b62f5a15aac03c4e04e7d62ebee702071d93660
+  React-Core: 9d66a8a953d975aee4989abccf4602e7ba7c65fa
+  React-CoreModules: e93a24aaae933d496329112cec78b681c76cdc53
+  React-cxxreact: 8f6abe06e11f79f2292c7939dc6390027e53e5ba
   React-debug: cbc88cbcffdca42184a32d073ceb7d9b11122b8d
-  React-Fabric: 0008b953afdacf3dd5ac38947a36d9c280e3a0a1
-  React-FabricImage: 51198a14587c3269e12cf823e81a6f3b642dd136
-  React-graphics: 977137c75673c2f31a1515ce48db31a076771112
-  React-hermes: 59ff965e45955d66977a23d51fe9235b44a09bd4
-  React-ImageManager: 5c8d5e6246c22613a0cb198c51044f4794e8c518
-  React-jserrorhandler: 90c29c95fb32abfdb61ab9c8eb425e6af097a0b9
-  React-jsi: 36f85df7d83197707e9fd9320d857eac616e6df3
-  React-jsiexecutor: a68ea442fd94c7ecf5d9355bde2443f0241531d9
+  React-Fabric: f22d9c367ae9536650d06d7c338383abf41daa73
+  React-FabricImage: d5b397555e58147bfbcd24c9d2cd10e566ea29ee
+  React-graphics: eb385065f994ca67550ae69df58dcbc27fdf1b07
+  React-hermes: c2877efac91c02266c66cd62ccef3fa7c36d8604
+  React-ImageManager: 99ffa733ce3406463da89bf74fd55a12c5aeb053
+  React-jserrorhandler: 5a90e88499755b6cfe263c01c208ac3782f535ad
+  React-jsi: 5da729c3787b5d58b8612fcd4308290e88af9dde
+  React-jsiexecutor: 911f565c4dcb2faf750e274a18012c88355fc33c
   React-jsinspector: a98428936fb888cc15d857226a26d9ac0a668a0e
-  React-logger: 6e4873d1f9c54cca30f6c91a6617f8c91b75ba4c
-  React-Mapbuffer: 57bf49a458398d329dad2bf8bc660e3e35b96989
-  react-native-safe-area-context: 863c9695a24b9e6bb6c412f1c8ddb4dfc3ae3862
+  React-logger: 6c1170f7bc315878ef4bd3b918e09130cf632798
+  React-Mapbuffer: 41c166b84fc479afc78097cd51404109ec9edf68
   React-nativeconfig: 8fd29a35a3e4e8c37682d976667663d834ba6165
-  React-NativeModulesApple: 83d7077877f8eda8e1b6055b3f8f16f7db8463b5
+  React-NativeModulesApple: 68eb729eaf628ba066bca5308dd4ccacaaacba97
   React-perflogger: 3887a05940ccd34a83457fd153fdeda509b31737
   React-RCTActionSheet: 2f42b4797374b53e93b65c79eaa8a0d292e255ac
-  React-RCTAnimation: 5639dcd418b798b28e9caacaed18ff5472454837
-  React-RCTAppDelegate: 37d3142bfa7cb9f2f8cd41feedc6b50c95986029
-  Re
```

**File**: `src/agenda/reservation-list/index.tsx` (modified, +3/-2)
```diff
@@ -262,8 +262,9 @@ class ReservationList extends Component<ReservationListProps, State> {
 
   render() {
     const {items, selectedDay, theme, style} = this.props;
-    
-    if (!items || selectedDay && !items[toMarkingFormat(selectedDay)]) {
+    const noItems = !items || selectedDay && !items[toMarkingFormat(selectedDay)];
+    const noReservations = !this.state.reservations || this.state.reservations.length === 0;
+    if (noItems || noReservations) {
       if (isFunction(this.props.renderEmptyData)) {
         return this.props.renderEmptyData?.();
       }
```

**File**: `yarn.lock` (modified, +2/-23)
```diff
@@ -1607,18 +1607,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@eslint-community/eslint-utils@npm:^4.2.0":
-  version: 4.4.1
-  resolution: "@eslint-community/eslint-utils@npm:4.4.1"
-  dependencies:
-    eslint-visitor-keys: "npm:^3.4.3"
-  peerDependencies:
-    eslint: ^6.0.0 || ^7.0.0 || >=8.0.0
-  checksum: 10c0/2aa0ac2fc50ff3f234408b10900ed4f1a0b19352f21346ad4cc3d83a1271481bdda11097baa45d484dd564c895e0762a27a8240be7a256b3ad47129e96528252
-  languageName: node
-  linkType: hard
-
-"@eslint-community/eslint-utils@npm:^4.4.0":
+"@eslint-community/eslint-utils@npm:^4.2.0, @eslint-community/eslint-utils@npm:^4.4.0":
   version: 4.5.1
   resolution: "@eslint-community/eslint-utils@npm:4.5.1"
   dependencies:
@@ -2782,7 +2771,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@types/react@npm:^18":
+"@types/react@npm:^18, @types/react@npm:^18.2.6":
   version: 18.3.20
   resolution: "@types/react@npm:18.3.20"
   dependencies:
@@ -2792,16 +2781,6 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@types/react@npm:^18.2.6":
-  version: 18.3.18
-  resolution: "@types/react@npm:18.3.18"
-  dependencies:
-    "@types/prop-types": "npm:*"
-    csstype: "npm:^3.0.2"
-  checksum: 10c0/8fb2b00672072135d0858dc9db07873ea107cc238b6228aaa2a9afd1ef7a64a7074078250db38afbeb19064be8ea6af5eac32d404efdd5f45e093cc4829d87f8
-  languageName: node
-  linkType: hard
-
 "@types/scheduler@npm:^0.16":
   version: 0.16.8
   resolution: "@types/scheduler@npm:0.16.8"
```

---

### Incident Patch 2: `965a7cc9` (2026-01-29)
**Commit Message**: fix: removed unused react-native-safe-area-context from Dependency  (#2755)

* fix:(deps) move react-native-safe-area-context to peerDependencies

* chore: update yarn.lock after dependency change

* fix: removed react-native-safe-area-context from peerDeps

* chore: update yarn.lock after removing dependency

**File**: `package.json` (modified, +0/-1)
```diff
@@ -37,7 +37,6 @@
     "lodash": "^4.17.15",
     "memoize-one": "^5.2.1",
     "prop-types": "^15.5.10",
-    "react-native-safe-area-context": "4.5.0",
     "react-native-swipe-gestures": "^1.0.5",
     "recyclerlistview": "^4.0.0",
     "xdate": "^0.8.0"
```

**File**: `yarn.lock` (modified, +0/-11)
```diff
@@ -9673,7 +9673,6 @@ __metadata:
     prop-types: "npm:^15.5.10"
     react: "npm:18.2.0"
     react-native: "npm:0.73.11"
-    react-native-safe-area-context: "npm:4.5.0"
     react-native-swipe-gestures: "npm:^1.0.5"
     react-recipes: "npm:^1.4.0"
     react-test-renderer: "npm:18.2.0"
@@ -9689,16 +9688,6 @@ __metadata:
   languageName: unknown
   linkType: soft
 
-"react-native-safe-area-context@npm:4.5.0":
-  version: 4.5.0
-  resolution: "react-native-safe-area-context@npm:4.5.0"
-  peerDependencies:
-    react: "*"
-    react-native: "*"
-  checksum: 10c0/cd9dfe25803b7b120940c243d9c9f10b0b61d262ad5875245909cdbf0025684241189b2796d35028519fee0e7a94e6f47bcaf2e23fc7801875d5f633a7778296
-  languageName: node
-  linkType: hard
-
 "react-native-swipe-gestures@npm:^1.0.5":
   version: 1.0.5
   resolution: "react-native-swipe-gestures@npm:1.0.5"
```

---

### Incident Patch 3: `32a5eed2` (2025-06-09)
**Commit Message**: Fix ExpandableCalendar StartHeight calculations (#2661)

**File**: `src/expandableCalendar/index.tsx` (modified, +5/-3)
```diff
@@ -191,22 +191,24 @@ const ExpandableCalendar = forwardRef<ExpandableCalendarRef, ExpandableCalendarP
 
   const [position, setPosition] = useState(numberOfDays ? Positions.CLOSED : initialPosition);
   const isOpen = position === Positions.OPEN;
-  const getOpenHeight = () => {
+  const getOpenHeight = useCallback(() => {
     if (!horizontal) {
       return Math.max(constants.screenHeight, constants.screenWidth);
     }
     return headerHeight + (WEEK_HEIGHT * (numberOfWeeks.current)) + (hideKnob ? 0 : KNOB_CONTAINER_HEIGHT);
-  };
+  }, [headerHeight, horizontal, hideKnob, numberOfWeeks]);
+
   const openHeight = useRef(getOpenHeight());
   const closedHeight = useMemo(() => headerHeight + WEEK_HEIGHT + (hideKnob || Number(numberOfDays) > 1 ? 0 : KNOB_CONTAINER_HEIGHT), [numberOfDays, hideKnob, headerHeight]);
-  const startHeight = useMemo(() => isOpen ? openHeight.current : closedHeight, [closedHeight, isOpen]);
+  const startHeight = useMemo(() => isOpen ? getOpenHeight() : closedHeight, [closedHeight, isOpen, getOpenHeight]);
   const _height = useRef(startHeight);
   const deltaY = useMemo(() => new Animated.Value(startHeight), [startHeight]);
   const headerDeltaY = useRef(new Animated.Value(isOpen ? -headerHeight : 0));
 
   useEffect(() => {
     _height.current = startHeight;
     deltaY.setValue(startHeight);
+    _wrapperStyles.current.style.height = startHeight;
   }, [startHeight]);
 
   useEffect(() => {
```

---

### Incident Patch 4: `848a8f40` (2025-05-29)
**Commit Message**: Fix playgroundScreen.tsx typo (#2673)

**File**: `example/src/screens/playgroundScreen.tsx` (modified, +2/-2)
```diff
@@ -54,7 +54,7 @@ export default function PlaygroundScreen() {
     );
   };
 
-  const renderExpendableCalendar = () => {
+  const renderExpandableCalendar = () => {
     return (
       <CalendarProvider date={INITIAL_DATE}>
         <ExpandableCalendar
@@ -76,7 +76,7 @@ export default function PlaygroundScreen() {
       case elements.LIST:
         return renderCalendarList();
       case elements.EXPANDABLE:
-        return renderExpendableCalendar();
+        return renderExpandableCalendar();
       default:
         return renderCalendar(); 
     }
```

---

### Incident Patch 5: `083daee5` (2025-05-29)
**Commit Message**: fix: modify the incorrect code in the readme (#2652)

Co-authored-by: songxinglin <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -204,7 +204,7 @@ export default App;
         dayTextColor: '#2d4150',
         textDisabledColor: '#dd99ee'
       }}
-    </Calendar>
+    />
 ```
 
 ## Customized Calendar Examples
```

---

### Incident Patch 6: `7795d076` (2025-05-29)
**Commit Message**: Fix: ensure unique keys in WeekCalendar FlatList to prevent React war… (#2671)

* Fix: ensure unique keys in WeekCalendar FlatList to prevent React warnings

* Fix: ensure unique keys in WeekCalendar FlatList to prevent React warnings

**File**: `src/expandableCalendar/WeekCalendar/index.tsx` (modified, +1/-1)
```diff
@@ -133,7 +133,7 @@ const WeekCalendar = (props: WeekCalendarProps) => {
     );
   },[firstDay, _onDayPress, context, date, markedDates]);
 
-  const keyExtractor = useCallback((item) => item, []);
+  const keyExtractor = useCallback((item, index) => `${item}-${index}`, []);
 
   const renderWeekDaysNames = useMemo(() => {
     return (
```

---

### Incident Patch 7: `e3b84985` (2025-05-25)
**Commit Message**: CalendarList - Passing testID to renderHeader function (#2672)

* Removing renderHeader from calendar with static header

* Passing testID to renderHeader function callback

* Revert changes to calendar-list/index

**File**: `src/calendar/header/index.tsx` (modified, +2/-2)
```diff
@@ -57,7 +57,7 @@ export interface CalendarHeaderProps {
   /** Apply custom disable color to selected day names indexes */
   disabledDaysIndexes?: number[];
   /** Replace default title with custom one. the function receive a date as parameter */
-  renderHeader?: (date?: XDate) => ReactNode; //TODO: replace with string
+  renderHeader?: (date?: XDate, info?: Pick<CalendarHeaderProps, 'testID'>) => ReactNode; //TODO: replace with string
   /** Replace default title with custom element */
   customHeaderTitle?: JSX.Element;
   /** Test ID */
@@ -204,7 +204,7 @@ const CalendarHeader = forwardRef((props: CalendarHeaderProps, ref) => {
     const webProps = Platform.OS === 'web' ? {'aria-level': webAriaLevel} : {};
 
     if (renderHeader) {
-      return renderHeader(month);
+      return renderHeader(month, {testID});
     }
 
     if (customHeaderTitle) {
```

---

### Incident Patch 8: `6dd0ed90` (2025-05-21)
**Commit Message**: Timeline - fix api file and add one for TimelineList (#2668)

**File**: `src/timeline-list/timelineList.api.json` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+{
+  "name": "TimelineList",
+  "description": "TimelineList component",
+  "images": [
+    "https://github.com/wix/react-native-calendars/blob/master/demo/assets/timeline-calendar.gif?raw=true"
+  ],
+  "extends": ["InfiniteList"],
+  "extendsLink": ["https://github.com/wix/react-native-calendars/blob/1.1311.1/src/infinite-list/index.tsx"],
+  "example": "https://github.com/wix/react-native-calendars/blob/1.1311.1/example/src/screens/timelineCalendarScreen.tsx",
+  "props": [
+    {
+      "name": "events",
+      "type": "{[date: string]: TimelineProps['events']}",
+      "description": "Map of all timeline events ({[date]: events})"
+    },
+    {
+      "name": "timelineProps",
+      "type": "Omit<TimelineProps, 'events' | 'scrollToFirst' | 'showNowIndicator' | 'scrollToNow' | 'initialTime'>",
+      "description": "General timeline props to pass to each timeline item"
+    },
+    {
+      "name": "renderItem",
+      "type": "(timelineProps: TimelineProps, info: TimelineListRenderItemInfo) => JSX.Element",
+      "description": "Pass to render a custom Timeline item"
+    },
+    {
+      "name": "scrollToFirst",
+      "type": "boolean",
+      "description": "Should scroll to first event of the day"
+    },
+    {
+      "name": "showNowIndicator",
+      "type": "boolean",
+      "description": "Should show now indicator (shown only on 'today' timeline)"
+    },
+    {
+      "name": "scrollToNow",
+      "type": "boolean",
+      "description": "Should initially scroll to current time (relevant only for 'today' timeline)"
+    },
+    {
+      "name": "initialTime",
+      "type": "TimelineProps['initialTime']",
+      "description": "Should initially scroll to a specific time (relevant only for NOT 'today' timelines)"
+    }
+  ]
+}
```

**File**: `src/timeline/timeline.api.json` (modified, +67/-7)
```diff
@@ -6,12 +6,12 @@
   ],
   "extends": ["ScrollView"],
   "extendsLink": ["https://reactnative.dev/docs/scrollview"],
-  "example": "https://github.com/wix/react-native-calendars/blob/master/example/src/screens/timelineCalendar.tsx",
+  "example": "https://github.com/wix/react-native-calendars/blob/master/example/src/screens/timelineCalendarScreen.tsx",
   "props": [
     {
-      "name": "theme",
-      "type": "Theme",
-      "description": "Specify theme properties to override specific styles for calendar parts"
+      "name": "date",
+      "type": "string | string[]",
+      "description": "The date / dates of this timeline instance in ISO format (e.g. 2011-10-25)"
     },
     {
       "name": "events",
@@ -46,21 +46,54 @@
       "description": "Handler which gets executed when background's long pressed released. Pass to handle creation of a new event"
     },
     {
-      "name": "renderEvent",
-      "type": "(event: PackedEvent) => JSX.Element",
-      "description": "Specify a custom event block"
+      "name": "theme",
+      "type": "Theme",
+      "description": "Specify theme properties to override specific styles for calendar parts"
     },
     {
       "name": "scrollToFirst",
       "type": "boolean",
       "description": "Whether to scroll to the first event"
     },
+    {
+      "name": "scrollToNow",
+      "type": "boolean",
+      "description": "Whether to scroll to the current time on first render",
+      "default": "false"
+    },
+    {
+      "name": "initialTime",
+      "type": "NewEventTime",
+      "description": "The initial time to scroll to when the timeline is first rendered",
+      "default": "{ hour: 0, minute: 0 }"
+    },
     {
       "name": "format24h",
       "type": "boolean",
       "description": "Whether to use 24 hours format for the timeline hours",
       "default": "true"
     },
+    {
+      "name": "renderEvent",
+      "type": "(event: PackedEvent) => JSX.Element",
+      "description": "Specify a custom event block"
+    },
+    {
+      "name": "showNowIndicator",
+      "type": "boolean",
+      "description": "Whether to show the now indicator",
+      "default": "false"
+    },
+    {
+      "name": "scrollOffset",
+      "type": "number",
+      "description": "A scroll offset value that the timeline will sync with"
+    },
+    {
+      "name": "onChangeOffset",
+      "type": "(offset: number) => void",
+      "description": "Listen to onScroll event of the timeline component"
+    },
     {
       "name": "overlapEventsSpacing",
       "type": "number",
@@ -72,6 +105,33 @@
       "type": "number",
       "description": "Spacing to keep at the right edge (for background press)",
       "default": "10"
+    },
+    {
+      "name": "unavailableHours",
+      "type": "UnavailableHours[]",
+      "description": "Range of available hours"
+    },
+    {
+      "name": "unavailableHoursColor",
+      "type": "string",
+      "description": "Background color for unavailable hours"
+    },
+    {
+      "name": "numberOfDays",
+      "type": "number",
+      "description": "The number of days to present in the timeline calendar",
+      "default": "1"
+    },
+    {
+      "name": "timelineLeftInset",
+      "type": "number",
+      "description": "The left inset of the timeline calendar (sidebar width)",
+      "default": "72"
+    },
+    {
+      "name": "testID",
+      "type": "string",
+      "description": "Identifier for testing"
     }
   ]
 }
```

---

### Incident Patch 9: `a739c0b5` (2025-04-24)
**Commit Message**: CalendarContextProvider - fix the return update source (#2648)

* CalendarContextProvider - fix the return update source from events to avoid breaking change

* fix tests

**File**: `src/expandableCalendar/Context/Provider.tsx` (modified, +13/-4)
```diff
@@ -80,21 +80,30 @@ const CalendarProvider = (props: CalendarContextProviderProps) => {
     }
   }, [date]);
 
+  const getUpdateSource = useCallback((updateSource: UpdateSources) => {
+    // NOTE: this comes to avoid breaking those how listen to the update source in onDateChanged and onMonthChange - remove on V2
+    if (updateSource === UpdateSources.ARROW_PRESS || updateSource === UpdateSources.WEEK_ARROW_PRESS) {
+      return UpdateSources.PAGE_SCROLL;
+    }
+    return updateSource;
+  }, []);
+
   const _setDate = useCallback((date: string, updateSource: UpdateSources) => {
     prevDate.current = currDate.current;
     currDate.current = date;
+    
     setCurrentDate(date);
     if (!includes(disableAutoDaySelection, updateSource as string)) {
       setSelectedDate(date);
     }
     setUpdateSource(updateSource);
 
-    onDateChanged?.(date, updateSource);
-
+    const _updateSource = getUpdateSource(updateSource);
+    onDateChanged?.(date, _updateSource);
     if (!sameMonth(new XDate(date), new XDate(prevDate.current))) {
-      onMonthChange?.(xdateToData(new XDate(date)), updateSource);
+      onMonthChange?.(xdateToData(new XDate(date)), _updateSource);
     }
-  }, [onDateChanged, onMonthChange]);
+  }, [onDateChanged, onMonthChange, getUpdateSource]);
 
   const _setDisabled = useCallback((disabled: boolean) => {
     if (showTodayButton) {
```

**File**: `src/expandableCalendar/__tests__/index.spec.ts` (modified, +11/-11)
```diff
@@ -185,8 +185,8 @@ describe('ExpandableCalendar', () => {
         jest.runAllTimers();
         const expectedDate = today.clone().setDate(1).addMonths(direction === Direction.RIGHT ? 1 : -1);
         driver.pressOnHeaderArrow({left: direction === Direction.LEFT});
-        expect(onDateChanged).toHaveBeenCalledWith(toMarkingFormat(expectedDate), UpdateSources.ARROW_PRESS);
-        expect(onMonthChange).toHaveBeenCalledWith(xdateToData(expectedDate), UpdateSources.ARROW_PRESS);
+        expect(onDateChanged).toHaveBeenCalledWith(toMarkingFormat(expectedDate), UpdateSources.PAGE_SCROLL);
+        expect(onMonthChange).toHaveBeenCalledWith(xdateToData(expectedDate), UpdateSources.PAGE_SCROLL);
       });
 
       it(`should call onDateChanged and onMonthChanged for first day in initial month when changing to initial month`, () => {
@@ -197,8 +197,8 @@ describe('ExpandableCalendar', () => {
         driver.pressOnHeaderArrow({left: true});
         jest.runAllTimers();
         const expectedDate = today.clone().setDate(1);
-        expect(onDateChanged).toHaveBeenNthCalledWith(2, toMarkingFormat(expectedDate), UpdateSources.ARROW_PRESS);
-        expect(onMonthChange).toHaveBeenNthCalledWith(2, xdateToData(expectedDate), UpdateSources.ARROW_PRESS);
+        expect(onDateChanged).toHaveBeenNthCalledWith(2, toMarkingFormat(expectedDate), UpdateSources.PAGE_SCROLL);
+        expect(onMonthChange).toHaveBeenNthCalledWith(2, xdateToData(expectedDate), UpdateSources.PAGE_SCROLL);
       });
 
       it(`should navigate 6 months ahead and back successfully`, () => {
@@ -209,13 +209,13 @@ describe('ExpandableCalendar', () => {
         });
         jest.runAllTimers();
         const expectedFutureDate = today.clone().setDate(1).addMonths(6);
-        expect(onDateChanged).toHaveBeenNthCalledWith(6, toMarkingFormat(expectedFutureDate), UpdateSources.ARROW_PRESS);
-        expect(onMonthChange).toHaveBeenNthCalledWith(6, xdateToData(expectedFutureDate), UpdateSources.ARROW_PRESS);
+        expect(onDateChanged).toHaveBeenNthCalledWith(6, toMarkingFormat(expectedFutureDate), UpdateSources.PAGE_SCROLL);
+        expect(onMonthChange).toHaveBeenNthCalledWith(6, xdateToData(expectedFutureDate), UpdateSources.PAGE_SCROLL);
         times(6, () => driver.pressOnHeaderArrow({left: true}));
         jest.runAllTimers();
         const expectedDate = today.clone().setDate(1);
-        expect(onDateChanged).toHaveBeenNthCalledWith(12, toMarkingFormat(expectedDate), UpdateSources.ARROW_PRESS);
-        expect(onMonthChange).toHaveBeenNthCalledWith(12, xdateToData(expectedDate), UpdateSources.ARROW_PRESS);
+        expect(onDateChanged).toHaveBeenNthCalledWith(12, toMarkingFormat(expectedDate), UpdateSources.PAGE_SCROLL);
+        expect(onMonthChange).toHaveBeenNthCalledWith(12, xdateToData(expectedDate), UpdateSources.PAGE_SCROLL);
       });
     });
   });
@@ -247,14 +247,14 @@ describe('ExpandableCalendar', () => {
         const currentDay = today.getDay();
         const expectedDate = today.clone().addDays(direction === Direction.LEFT ? -(currentDay + 7) : (7 - currentDay));
         driver.pressOnHeaderArrow({left: direction === Direction.LEFT});
-        expect(onDateChanged).toHaveBeenCalledWith(toMarkingFormat(expectedDate), UpdateSources.WEEK_ARROW_PRESS);
+        expect(onDateChanged).toHaveBeenCalledWith(toMarkingFormat(expectedDate), UpdateSources.PAGE_SCROLL);
       });
 
       it(`should call onDateChanged for first day of initial week when changing to initial week`, () => {
         driver.pressOnHeaderArrow({left: false});
         driver.pressOnHeaderArrow({left: true});
         const expectedDate = today.clone().addDays(-(today.getDay()));
-        expect(onDateChanged).toHaveBeenNthCalledWith(2, toMarkingFormat(expectedDate), UpdateSources.WEEK_ARROW_PRESS);
+        expect(onDateChanged).toHaveBeenNthCalledWith(2, toMarkingFormat(expectedDate), UpdateSources.PAGE_SCROLL);
       });
 
       it('should fetch next weeks when in last week of the list', () => {
@@ -270,7 +270,7 @@ describe('ExpandableCalendar', () => {
         const diff = Math.ceil(((endOfMonth.getUTCDate() + 1) - today.getUTCDate()) / 7) + ((today.getUTCDay() > endOfMonth.getUTCDay()) ? 1 : 0);
         const expectedDate = today.clone().setDate(today.getDate() + 7 * diff - today.getDay());
         times(diff, () => driver.pressOnHeaderArrow({left: false}));
-        expect(onMonthChange).toHaveBeenCalledWith(xdateToData(expectedDate), UpdateSources.WEEK_ARROW_PRESS);
+        expect(onMonthChange).toHaveBeenCalledWith(xdateToData(expectedDate), UpdateSources.PAGE_SCROLL);
       });
     });
   });
```

---

### Incident Patch 10: `85d8dcae` (2025-04-23)
**Commit Message**: InfiniteAgendaList - fix calendar not updating properly when on list drag (#2651)

**File**: `src/expandableCalendar/AgendaList/infiniteAgendaList.tsx` (modified, +2/-2)
```diff
@@ -184,7 +184,7 @@ const InfiniteAgendaList = ({
     onScroll?.(event as any);
   }, [onScroll]);
 
-  const _onVisibleIndicesChanged = useCallback(debounce((all: number[]) => {
+  const _onVisibleIndicesChanged = useCallback((all: number[]) => {
     if (all && all.length && !sectionScroll.current) {
       const topItemIndex = all[0];
       const topSection = data[findItemTitleIndex(topItemIndex)];
@@ -196,7 +196,7 @@ const InfiniteAgendaList = ({
         }
       }
     }
-  }, infiniteListProps?.visibleIndicesChangedDebounce ?? 1000, {leading: false, trailing: true},), [avoidDateUpdates, setDate, data]);
+  }, [avoidDateUpdates, setDate, data]);
 
   const findItemTitleIndex = useCallback((itemIndex: number) => {
     let titleIndex = itemIndex;
```

---

### Incident Patch 11: `13a5da89` (2025-04-15)
**Commit Message**: Fix error with Platform.constants doesn't exists on react-native-web (#2639)

* Added check for react native version before usage

* Added optional chanining to check

**File**: `src/commons/constants.ts` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ const isIOS = Platform.OS === 'ios';
 const screenAspectRatio = screenWidth < screenHeight ? screenHeight / screenWidth : screenWidth / screenHeight;
 const isTablet = (Platform as PlatformIOSStatic).isPad || (screenAspectRatio < 1.6 && Math.max(screenWidth, screenHeight) >= 900);
 const isAndroidRTL = isAndroid && isRTL;
-const isRN73 = () => Platform.constants.reactNativeVersion?.minor >= 73;
+const isRN73 = () => !!Platform?.constants?.reactNativeVersion && Platform.constants.reactNativeVersion?.minor >= 73;
 
 export default {
   screenWidth,
```

---

### Incident Patch 12: `bb2004de` (2025-04-03)
**Commit Message**: Android RTL fix for RN73 and above (#2631)

* CalendarList and WeekCalendar - fix android rtl issue for RN73 and above.
InfinitList and TimelineList - fix memo and deps

* asCalendarConsumer - fix import

* fix undefined error

**File**: `src/calendar-list/index.tsx` (modified, +6/-8)
```diff
@@ -1,10 +1,8 @@
 import findIndex from 'lodash/findIndex';
 import PropTypes from 'prop-types';
 import XDate from 'xdate';
-
 import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react';
 import {FlatList, FlatListProps, View, ViewStyle} from 'react-native';
-
 import {extractCalendarProps, extractHeaderProps} from '../componentUpdater';
 import {parseDate, toMarkingFormat, xdateToData} from '../interface';
 import {page, sameDate, sameMonth} from '../dateutils';
@@ -112,7 +110,7 @@ const CalendarList = (props: CalendarListProps & ContextProp, ref: any) => {
 
   const [currentMonth, setCurrentMonth] = useState(parseDate(current));
 
-  const shouldUseAndroidRTLFix = useMemo(() => constants.isAndroidRTL && horizontal, [horizontal]);
+  const shouldFixRTL = useMemo(() => !constants.isRN73() && constants.isAndroidRTL && horizontal, [horizontal]);
   /**
    * we render a lot of months in the calendar list and we need to measure the header only once
    * so we use this ref to limit the header measurement to the first render
@@ -194,12 +192,12 @@ const CalendarList = (props: CalendarListProps & ContextProp, ref: any) => {
   const scrollToMonth = useCallback((date: XDate | string) => {
     const scrollTo = parseDate(date);
     const diffMonths = Math.round(initialDate?.current?.clone().setDate(1).diffMonths(scrollTo?.clone().setDate(1)));
-    const scrollAmount = calendarSize * (shouldUseAndroidRTLFix ? pastScrollRange - diffMonths : pastScrollRange + diffMonths);
+    const scrollAmount = calendarSize * (shouldFixRTL ? pastScrollRange - diffMonths : pastScrollRange + diffMonths);
 
     if (scrollAmount !== 0) {
       list?.current?.scrollToOffset({offset: scrollAmount, animated: animateScroll});
     }
-  }, [calendarSize, shouldUseAndroidRTLFix, pastScrollRange, animateScroll]);
+  }, [calendarSize, shouldFixRTL, pastScrollRange, animateScroll]);
 
   const addMonth = useCallback((count: number) => {
     const day = currentMonth?.clone().addMonths(count, true);
@@ -289,7 +287,7 @@ const CalendarList = (props: CalendarListProps & ContextProp, ref: any) => {
 
   const onViewableItemsChanged = useCallback(({viewableItems}: any) => {
     const newVisibleMonth = parseDate(viewableItems[0]?.item);
-    if (shouldUseAndroidRTLFix) {
+    if (shouldFixRTL) {
       const centerIndex = items.findIndex((item) => isEqual(parseDate(current), item));
       const adjustedOffset = centerIndex - items.findIndex((item) => isEqual(newVisibleMonth, item));
       visibleMonth.current = items[centerIndex + adjustedOffset];
@@ -300,7 +298,7 @@ const CalendarList = (props: CalendarListProps & ContextProp, ref: any) => {
         setCurrentMonth(visibleMonth.current);
       }
     }
-  }, [items, shouldUseAndroidRTLFix, current]);
+  }, [items, shouldFixRTL, current]);
 
   const viewabilityConfigCallbackPairs = useRef([
     {
@@ -313,7 +311,7 @@ const CalendarList = (props: CalendarListProps & ContextProp, ref: any) => {
     <View style={style.current.flatListContainer} testID={testID}>
       <FlatList
         ref={list}
-        windowSize={shouldUseAndroidRTLFix ? pastScrollRange + futureScrollRange + 1 : undefined}
+        windowSize={shouldFixRTL ? pastScrollRange + futureScrollRange + 1 : undefined}
         style={listStyle}
         showsVerticalScrollIndicator={showScrollIndicator}
         showsHorizontalScrollIndicator={showScrollIndicator}
```

**File**: `src/commons/constants.ts` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ const isIOS = Platform.OS === 'ios';
 const screenAspectRatio = screenWidth < screenHeight ? screenHeight / screenWidth : screenWidth / screenHeight;
 const isTablet = (Platform as PlatformIOSStatic).isPad || (screenAspectRatio < 1.6 && Math.max(screenWidth, screenHeight) >= 900);
 const isAndroidRTL = isAndroid && isRTL;
-const isRN73 = () => Platform.constants.reactNativeVersion.minor >= 73;
+const isRN73 = () => Platform.constants.reactNativeVersion?.minor >= 73;
 
 export default {
   screenWidth,
```

**File**: `src/expandableCalendar/Context/asCalendarConsumer.tsx` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 import React, {Component, Ref} from 'react';
 import hoistNonReactStatic from 'hoist-non-react-statics';
-import CalendarContext from '.';
+import CalendarContext from './index';
 
 
 function asCalendarConsumer<PROPS>(WrappedComponent: React.ComponentType<any>): React.ComponentClass<PROPS> {
```

**File**: `src/expandableCalendar/WeekCalendar/index.tsx` (modified, +6/-6)
```diff
@@ -1,8 +1,6 @@
 import XDate from 'xdate';
-
 import React, {useCallback, useContext, useMemo, useRef, useState} from 'react';
 import {FlatList, View, ViewToken} from 'react-native';
-
 import {sameWeek, onSameDateRange, getWeekDates} from '../../dateutils';
 import {toMarkingFormat} from '../../interface';
 import {DateData, MarkedDates} from '../../types';
@@ -50,6 +48,8 @@ const WeekCalendar = (props: WeekCalendarProps) => {
   const list = useRef<FlatList>(null);
   const currentIndex = useRef(NUMBER_OF_PAGES);
 
+  const shouldFixRTL = useMemo(() => !constants.isRN73() && constants.isAndroidRTL, []);
+
   useDidUpdate(() => {
     items.current = getDatesArray(date, firstDay, numberOfDays);
     setListData(items.current);
@@ -69,7 +69,7 @@ const WeekCalendar = (props: WeekCalendarProps) => {
           }) :
           sameWeek(item, date, firstDay));
       if (pageIndex !== currentIndex.current) {
-        const adjustedIndexFrScroll = (constants.isAndroidRTL && !constants.isRN73()) ? NUM_OF_ITEMS - 1 - pageIndex : pageIndex;
+        const adjustedIndexFrScroll = shouldFixRTL ? NUM_OF_ITEMS - 1 - pageIndex : pageIndex;
         if (pageIndex >= 0) {
           visibleWeek.current = items.current[adjustedIndexFrScroll];
           currentIndex.current = adjustedIndexFrScroll;
@@ -80,7 +80,7 @@ const WeekCalendar = (props: WeekCalendarProps) => {
         pageIndex <= 0 ? onEndReached() : list?.current?.scrollToIndex({index: adjustedIndexFrScroll, animated: false});
       }
     }
-  }, [date, updateSource]);
+  }, [date, updateSource, shouldFixRTL]);
 
   const containerWidth = useMemo(() => {
     return calendarWidth ?? constants.screenWidth;
@@ -179,7 +179,7 @@ const WeekCalendar = (props: WeekCalendarProps) => {
     const currItems = items.current;
     const newDate = viewableItems[0]?.item;
     if (newDate !== visibleWeek.current) {
-      if (constants.isAndroidRTL) {
+      if (shouldFixRTL) {
         //in android RTL the item we see is the one in the opposite direction
         const newDateOffset = -1 * (NUMBER_OF_PAGES - currItems.indexOf(newDate));
         const adjustedNewDate = currItems[NUMBER_OF_PAGES - newDateOffset];
@@ -198,7 +198,7 @@ const WeekCalendar = (props: WeekCalendarProps) => {
         }
       }
     }
-  }, [onEndReached]);
+  }, [onEndReached, shouldFixRTL]);
 
   const viewabilityConfigCallbackPairs = useRef([{
       viewabilityConfig: {
```

**File**: `src/infinite-list/index.tsx` (modified, +4/-6)
```diff
@@ -1,11 +1,9 @@
 import inRange from 'lodash/inRange';
 import debounce from 'lodash/debounce';
 import noop from 'lodash/noop';
-
 import React, {forwardRef, useCallback, useEffect, useMemo, useRef} from 'react';
 import {ScrollViewProps} from 'react-native';
 import {DataProvider, LayoutProvider, RecyclerListView, RecyclerListViewProps} from 'recyclerlistview';
-
 import constants from '../commons/constants';
 import {useCombinedRefs} from '../hooks';
 
@@ -70,10 +68,10 @@ const InfiniteList = (props: InfiniteListProps, ref: any) => {
       }
     )
   );
-
+  
   const shouldFixRTL = useMemo(() => {
     return isHorizontal && constants.isRTL && (constants.isRN73() || constants.isAndroid);
-  }, []);
+  }, [isHorizontal]);
 
   const listRef = useCombinedRefs(ref);
   const pageIndex = useRef<number>();
@@ -93,7 +91,7 @@ const InfiniteList = (props: InfiniteListProps, ref: any) => {
       // @ts-expect-error
       listRef.current?.scrollToOffset?.(x, y, false);
     }, 0);
-  }, [data, disableScrollOnDataChange]);
+  }, [data, disableScrollOnDataChange, isHorizontal]);
 
   const _onScroll = useCallback(
     (event, offsetX, offsetY) => {
@@ -133,7 +131,7 @@ const InfiniteList = (props: InfiniteListProps, ref: any) => {
 
       onScroll?.(event, offsetX, offsetY);
     },
-    [onScroll, onPageChange, data.length, reloadPagesDebounce]
+    [onScroll, onPageChange, data.length, reloadPagesDebounce, isHorizontal, shouldFixRTL]
   );
 
   const onMomentumScrollEnd = useCallback(
```

**File**: `src/timeline-list/index.tsx` (modified, +5/-5)
```diff
@@ -1,9 +1,7 @@
 import throttle from 'lodash/throttle';
 import flatten from 'lodash/flatten';
 import dropRight from 'lodash/dropRight';
-
 import React, {useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
-
 import {isToday, generateDay} from '../dateutils';
 import InfiniteList from '../infinite-list';
 import Context from '../expandableCalendar/Context';
@@ -53,7 +51,7 @@ export interface TimelineListProps {
 
 const TimelineList = (props: TimelineListProps) => {
   const {timelineProps, events, renderItem, showNowIndicator, scrollToFirst, scrollToNow, initialTime} = props;
-  const shouldFixRTL = constants.isRTL && (constants.isRN73() || constants.isAndroid); // isHorizontal = true
+  const shouldFixRTL = useMemo(() => constants.isRTL && (constants.isRN73() || constants.isAndroid), []); // isHorizontal = true
   const {date, updateSource, setDate, numberOfDays = 1, timelineLeftInset} = useContext(Context);
   const listRef = useRef<any>();
   const prevDate = useRef(date);
@@ -75,7 +73,9 @@ const TimelineList = (props: TimelineListProps) => {
     prevDate.current = date;
   }, [updateSource]);
 
-  const initialOffset = useMemo(() => shouldFixRTL ? constants.screenWidth * (PAGES_COUNT - INITIAL_PAGE - 1) : constants.screenWidth * INITIAL_PAGE, []);
+  const initialOffset = useMemo(() => {
+    return shouldFixRTL ? constants.screenWidth * (PAGES_COUNT - INITIAL_PAGE - 1) : constants.screenWidth * INITIAL_PAGE;
+  }, [shouldFixRTL]);
 
   useEffect(() => {
     if (date !== prevDate.current) {
@@ -102,7 +102,7 @@ const TimelineList = (props: TimelineListProps) => {
         setDate(newDate, UpdateSources.LIST_DRAG);
       }
     }, 0),
-    [pages]
+    [pages, shouldFixRTL]
   );
 
   const onReachNearEdge = useCallback(() => {
```

---

### Incident Patch 13: `e94d511e` (2025-03-31)
**Commit Message**: Fix example typo (#2621)

Fixed variable name fastDate -> pastDate

**File**: `example/src/mocks/agendaItems.ts` (modified, +2/-2)
```diff
@@ -2,9 +2,9 @@ import isEmpty from 'lodash/isEmpty';
 import {MarkedDates} from '../../../src/types';
 
 const today = new Date().toISOString().split('T')[0];
-const fastDate = getPastDate(3);
+const pastDate = getPastDate(3);
 const futureDates = getFutureDates(12);
-const dates = [fastDate, today].concat(futureDates);
+const dates = [pastDate, today].concat(futureDates);
 
 function getFutureDates(numberOfDays: number) {
   const array: string[] = [];
```

---

### Incident Patch 14: `ed9b13b1` (2025-02-27)
**Commit Message**: fix lint errors (rn73 linter) (#2608)

* fix lint errors (rn73 linter)

* revert AgendaList change

**File**: `example/src/mocks/agendaItems.ts` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ function getPastDate(numberOfDays: number) {
 export const agendaItems = [
   {
     title: dates[0],
-    data: [{hour: '12am', duration: '1h', title: 'First Yoga'}, {hour: '9am', duration: '1h', title: 'Long Yoga', itemCustomHeightType: 'LongEvent'}],
+    data: [{hour: '12am', duration: '1h', title: 'First Yoga'}, {hour: '9am', duration: '1h', title: 'Long Yoga', itemCustomHeightType: 'LongEvent'}]
   },
   {
     title: dates[1],
```

**File**: `example/src/screens/agendaInfiniteListScreen.tsx` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ const AgendaInfiniteListScreen = (props: Props) => {
             itemHeight: 80,
             titleHeight: 50,
             itemHeightByType: {
-              LongEvent: 120,
+              LongEvent: 120
             }
           }
         }
```

**File**: `example/src/screens/calendarPlaygroundScreen.tsx` (modified, +1/-1)
```diff
@@ -564,7 +564,7 @@ const styles = StyleSheet.create({
   },
   text: {
     fontSize: 14, 
-    fontWeight: 'bold', 
+    fontWeight: 'bold' 
   },
   buttonText: {
     color: GREEN,
```

**File**: `example/src/screens/calendarScreen.tsx` (modified, +29/-29)
```diff
@@ -210,7 +210,7 @@ const CalendarScreen = () => {
               customContainerStyle: {
                 borderTopRightRadius: 5,
                 borderBottomRightRadius: 5,
-                backgroundColor: "green"
+                backgroundColor: 'green'
               }
             },
             [getDate(25)]: {inactive: true, disableTouchEvent: true}
@@ -381,37 +381,37 @@ const CalendarScreen = () => {
     );
   };
 
-  const renderCalendarWithCustomHeaderTitle = () => {
-    const [selectedValue, setSelectedValue] = useState(new Date());
+  const [selectedValue, setSelectedValue] = useState(new Date());
 
-    const getNewSelectedDate = useCallback(
-      (date, shouldAdd) => {
-        const newMonth = new Date(date).getMonth();
-        const month = shouldAdd ? newMonth + 1 : newMonth - 1;
-        const newDate = new Date(selectedValue.setMonth(month));
-        const newSelected = new Date(newDate.setDate(1));
-        return newSelected;
-      },
-      [selectedValue]
-    );
-    const onPressArrowLeft = useCallback(
-      (subtract, month) => {
-        const newDate = getNewSelectedDate(month, false);
-        setSelectedValue(newDate);
-        subtract();
-      },
-      [getNewSelectedDate]
-    );
+  const getNewSelectedDate = useCallback(
+    (date, shouldAdd) => {
+      const newMonth = new Date(date).getMonth();
+      const month = shouldAdd ? newMonth + 1 : newMonth - 1;
+      const newDate = new Date(selectedValue.setMonth(month));
+      const newSelected = new Date(newDate.setDate(1));
+      return newSelected;
+    },
+    [selectedValue]
+  );
+  const onPressArrowLeft = useCallback(
+    (subtract, month) => {
+      const newDate = getNewSelectedDate(month, false);
+      setSelectedValue(newDate);
+      subtract();
+    },
+    [getNewSelectedDate]
+  );
 
-    const onPressArrowRight = useCallback(
-      (add, month) => {
-        const newDate = getNewSelectedDate(month, true);
-        setSelectedValue(newDate);
-        add();
-      },
-      [getNewSelectedDate]
-    );
+  const onPressArrowRight = useCallback(
+    (add, month) => {
+      const newDate = getNewSelectedDate(month, true);
+      setSelectedValue(newDate);
+      add();
+    },
+    [getNewSelectedDate]
+  );
 
+  const renderCalendarWithCustomHeaderTitle = () => {
     const CustomHeaderTitle = (
       <TouchableOpacity style={styles.customTitleContainer} onPress={() => console.warn('Tapped!')}>
         <Text style={styles.customTitle}>{selectedValue.getMonth() + 1}-{selectedValue.getFullYear()}</Text>
```

**File**: `example/src/screens/playgroundScreen.tsx` (modified, +3/-3)
```diff
@@ -85,9 +85,9 @@ export default function PlaygroundScreen() {
   return (
     <>
       <View style={styles.buttonsContainer}>
-        <Button color={BLUE} title='Calendar' onPress={() => setElement(elements.CALENDAR)}/>
-        <Button color={BLUE} title='Calendar List' onPress={() => setElement(elements.LIST)}/>
-        <Button color={BLUE} title='Expandable' onPress={() => setElement(elements.EXPANDABLE)}/>
+        <Button color={BLUE} title="Calendar" onPress={() => setElement(elements.CALENDAR)}/>
+        <Button color={BLUE} title="Calendar List" onPress={() => setElement(elements.LIST)}/>
+        <Button color={BLUE} title="Expandable" onPress={() => setElement(elements.EXPANDABLE)}/>
       </View>
       <Text style={styles.text}>Selected Date: {selectedDate}</Text>
       <Profiler id={element}>
```

**File**: `example/src/screens/timelineCalendarScreen.tsx` (modified, +1/-1)
```diff
@@ -113,7 +113,7 @@ export default class TimelineCalendarScreen extends Component {
     // end: 24,
     unavailableHours: [{start: 0, end: 6}, {start: 22, end: 24}],
     overlapEventsSpacing: 8,
-    rightEdgeSpacing: 24,
+    rightEdgeSpacing: 24
   };
 
   render() {
```

**File**: `src/agenda/index.tsx` (modified, +3/-3)
```diff
@@ -337,7 +337,7 @@ export default class Agenda extends Component<AgendaProps, State> {
         ...reservationListProps,
         selectedDay: this.state.selectedDay,
         topDay: this.state.topDay,
-        onDayChange: this.onDayChange,
+        onDayChange: this.onDayChange
       });
     }
 
@@ -375,7 +375,7 @@ export default class Agenda extends Component<AgendaProps, State> {
 
   renderKnob() {
     const {showClosingKnob, hideKnob, renderKnob} = this.props;
-    let knob: JSX.Element | null = <View style={this.style.knobContainer} />;
+    let knob: JSX.Element | null = <View style={this.style.knobContainer}/>;
 
     if (!hideKnob) {
       const knobView = renderKnob ? renderKnob() : <View style={this.style.knob}/>;
@@ -454,7 +454,7 @@ export default class Agenda extends Component<AgendaProps, State> {
     const scrollPadPosition = (shouldAllowDragging ? HEADER_HEIGHT : openCalendarScrollPadPosition) - KNOB_HEIGHT;
     const scrollPadStyle = {
       height: KNOB_HEIGHT,
-      top: scrollPadPosition,
+      top: scrollPadPosition
     };
 
     return (
```

**File**: `src/calendar-list/index.tsx` (modified, +2/-2)
```diff
@@ -231,7 +231,7 @@ const CalendarList = (props: CalendarListProps & ContextProp, ref: any) => {
   }, []);
 
   const isDateInRange = useCallback((date) => {
-    for(let i = -range.current; i <= range.current; i++) {
+    for (let i = -range.current; i <= range.current; i++) {
       const newMonth = currentMonth?.clone().addMonths(i, true);
       if (sameMonth(date, newMonth)) {
         return true;
@@ -308,7 +308,7 @@ const CalendarList = (props: CalendarListProps & ContextProp, ref: any) => {
     {
       viewabilityConfig: viewabilityConfig.current,
       onViewableItemsChanged
-    },
+    }
   ]);
 
   return (
```

---

### Incident Patch 15: `174cbe50` (2025-02-13)
**Commit Message**: TimelineList - fix for RTL under RN73 (#2598)

**File**: `example/src/app.tsx` (modified, +25/-5)
```diff
@@ -29,20 +29,40 @@ LocaleConfig.locales['en'] = {
   monthNamesShort: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
   dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
   dayNamesShort: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
-  // numbers: ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] // number localization example
+  // numbers: ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] // <--- number localization example
 };
-LocaleConfig.defaultLocale = 'en';
 
-/*
 LocaleConfig.locales['fr'] = {
   monthNames: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
   monthNamesShort: ['Janv.','Févr.','Mars','Avril','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.'],
   dayNames: ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'],
   dayNamesShort: ['Dim.','Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.'],
   today: 'Aujourd\'hui'
 };
-LocaleConfig.defaultLocale = 'fr';
-*/
+
+LocaleConfig.locales['he'] = {
+  formatAccessibilityLabel: "dddd d 'of' MMMM 'of' yyyy",
+  monthNames: [
+    'ינואר',
+    'פברואר',
+    'מרץ',
+    'אפריל',
+    'מאי',
+    'יוני',
+    'יולי',
+    'אוגוסט',
+    'ספטמבר',
+    'אוקטובר',
+    'נובמבר',
+    'דצמבר'
+  ],
+  monthNamesShort: ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'],
+  dayNames: ['ראון', 'שני', 'שלישי', 'קביעי', 'חמישי', 'שישי', 'שבת'],
+  dayNamesShort: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'],
+};
+
+LocaleConfig.defaultLocale = 'en';
+
 
 Navigation.events().registerAppLaunchedListener(() => {
   Navigation.setRoot({
```

**File**: `src/infinite-list/index.tsx` (modified, +5/-5)
```diff
@@ -70,8 +70,9 @@ const InfiniteList = (props: InfiniteListProps, ref: any) => {
       }
     )
   );
-  const shouldUseAndroidRTLFix = useMemo(() => {
-    return constants.isAndroidRTL && isHorizontal;
+
+  const shouldFixRTL = useMemo(() => {
+    return isHorizontal && constants.isRTL && (constants.isRN73() || constants.isAndroid);
   }, []);
 
   const listRef = useCombinedRefs(ref);
@@ -87,7 +88,7 @@ const InfiniteList = (props: InfiniteListProps, ref: any) => {
     }
 
     setTimeout(() => {
-      const x = isHorizontal ? constants.isAndroidRTL ? Math.floor(data.length / 2) + 1 : Math.floor(data.length / 2) * pageWidth : 0;
+      const x = isHorizontal ? shouldFixRTL ? Math.floor(data.length / 2) + 1 : Math.floor(data.length / 2) * pageWidth : 0;
       const y = isHorizontal ? 0 : positionIndex * pageHeight;
       // @ts-expect-error
       listRef.current?.scrollToOffset?.(x, y, false);
@@ -100,7 +101,7 @@ const InfiniteList = (props: InfiniteListProps, ref: any) => {
 
       const contentOffset = event.nativeEvent.contentOffset;
       const y = contentOffset.y;
-      const x = shouldUseAndroidRTLFix ? (pageWidth * data.length - contentOffset.x) : contentOffset.x;
+      const x = shouldFixRTL ? (pageWidth * data.length - contentOffset.x) : contentOffset.x;
       const newPageIndex = Math.round(isHorizontal ? x / pageWidth : y / pageHeight);
       if (pageIndex.current !== newPageIndex) {
         if (pageIndex.current !== undefined) {
@@ -175,7 +176,6 @@ const InfiniteList = (props: InfiniteListProps, ref: any) => {
       // @ts-expect-error
       ref={listRef}
       isHorizontal={isHorizontal}
-      disableRecycling={shouldUseAndroidRTLFix}
       rowRenderer={renderItem}
       dataProvider={dataProvider}
       layoutProvider={layoutProvider ?? _layoutProvider.current}
```

**File**: `src/timeline-list/index.tsx` (modified, +4/-4)
```diff
@@ -53,13 +53,14 @@ export interface TimelineListProps {
 
 const TimelineList = (props: TimelineListProps) => {
   const {timelineProps, events, renderItem, showNowIndicator, scrollToFirst, scrollToNow, initialTime} = props;
+  const shouldFixRTL = constants.isRTL && (constants.isRN73() || constants.isAndroid); // isHorizontal = true
   const {date, updateSource, setDate, numberOfDays = 1, timelineLeftInset} = useContext(Context);
   const listRef = useRef<any>();
   const prevDate = useRef(date);
   const [timelineOffset, setTimelineOffset] = useState();
 
   const {pages, pagesRef, resetPages, resetPagesDebounce, scrollToPageDebounce, shouldResetPages, isOutOfRange} =
-    useTimelinePages({date, listRef, numberOfDays});
+    useTimelinePages({date, listRef, numberOfDays, shouldFixRTL});
 
   const scrollToCurrentDate = useCallback((date: string) => {
     const datePageIndex = pagesRef.current.indexOf(date);
@@ -74,8 +75,7 @@ const TimelineList = (props: TimelineListProps) => {
     prevDate.current = date;
   }, [updateSource]);
 
-  const initialOffset = useMemo(() =>
-  constants.isAndroidRTL ? constants.screenWidth * (PAGES_COUNT - INITIAL_PAGE - 1) : constants.screenWidth * INITIAL_PAGE, []);
+  const initialOffset = useMemo(() => shouldFixRTL ? constants.screenWidth * (PAGES_COUNT - INITIAL_PAGE - 1) : constants.screenWidth * INITIAL_PAGE, []);
 
   useEffect(() => {
     if (date !== prevDate.current) {
@@ -97,7 +97,7 @@ const TimelineList = (props: TimelineListProps) => {
 
   const onPageChange = useCallback(
     throttle((pageIndex: number) => {
-      const newDate = pages[constants.isAndroidRTL ? pageIndex - 1 : pageIndex];
+      const newDate = pages[shouldFixRTL ? pageIndex - 1 : pageIndex];
       if (newDate !== prevDate.current) {
         setDate(newDate, UpdateSources.LIST_DRAG);
       }
```

**File**: `src/timeline-list/useTimelinePages.ts` (modified, +3/-2)
```diff
@@ -15,9 +15,10 @@ interface UseTimelinePagesProps {
   date: string;
   listRef: RefObject<any>;
   numberOfDays: number;
+  shouldFixRTL: boolean;
 }
 
-const UseTimelinePages = ({date, listRef, numberOfDays}: UseTimelinePagesProps) => {
+const UseTimelinePages = ({date, listRef, numberOfDays, shouldFixRTL}: UseTimelinePagesProps) => {
   const pagesRef = useRef(
     times(PAGES_COUNT, i => {
       return generateDay(date, numberOfDays * (i - Math.floor(PAGES_COUNT / 2)));
@@ -48,7 +49,7 @@ const UseTimelinePages = ({date, listRef, numberOfDays}: UseTimelinePagesProps)
   }, []);
 
   const scrollToPage = (pageIndex: number) => {
-    listRef.current?.scrollToOffset(constants.isAndroidRTL ? ((PAGES_COUNT - 1 - pageIndex) * constants.screenWidth) : (pageIndex * constants.screenWidth), 0, false);
+    listRef.current?.scrollToOffset(shouldFixRTL ? ((PAGES_COUNT - 1 - pageIndex) * constants.screenWidth) : (pageIndex * constants.screenWidth), 0, false);
   };
 
   const resetPages = (date: string) => {
```

#### Recent Merged Pull Requests:
- **PR #2786** (closed): feat/updated calendar layout (@Joey-iresponsive)
- **PR #2785** (closed): feat/updated calendar layout (@Joey-iresponsive)
- **PR #2782** (closed): Bump fast-xml-parser from 4.5.3 to 4.5.6 (@dependabot[bot])
- **PR #2777** (closed): Bump fast-xml-parser from 4.5.3 to 4.5.5 (@dependabot[bot])
- **PR #2775** (closed): Bump lodash from 4.17.21 to 4.18.1 (@dependabot[bot])
- **PR #2772** (closed): Bump fast-xml-parser from 4.5.3 to 4.5.4 (@dependabot[bot])
- **PR #2765** (closed): Bump tar from 7.4.3 to 7.5.9 (@dependabot[bot])
- **PR #2764** (closed): Bump tar from 7.4.3 to 7.5.7 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
