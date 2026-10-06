# Forensic Learning Record (Deep Inspection): gitpoint/git-point

> **Canonical Artifact**: `07_PROJECT_LEARNING/gitpoint-git-point-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gitpoint/git-point](https://github.com/gitpoint/git-point))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:20:39.879Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gitpoint/git-point`
- **Description**: GitHub in your pocket :iphone:
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4773 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/components/state-badge.component.js`
```
import React from 'react';
import styled from 'styled-components';

import { colors, fonts, normalize } from 'config';
import { t } from 'utils';

type Props = {
  issue: Object,
  isMerged: boolean,
  text: string,
  type: string,
  style: Object,
  locale: string,
};

const Badge = styled.View`
  padding: 3px 12px;
  border-radius: 20px;
  background-color: ${props => props.color};
`;

const BadgeText = styled.Text`
  color: ${colors.white};
  font-size: ${normalize(12)};
  ${fonts.fontPrimarySemiBold};
`;

export const StateBadge = ({
  issue,
  isMerged,
  text,
  type,
  style,
  locale,
}: Props) => {
  let issueState = type;
  let issueText = text;

  if (isMerged) {
    issueState = 'merged';
    issueText = t('Merged', locale);
  } else if (issue && issue.state === 'open') {
    issueState = 'open';
    issueText = t('Open', locale);
  } else if (issue && issue.state === 'closed') {
    issueState = 'closed';
    issueText = t('Closed', locale);
  }

  const stateColor = {
    merged: colors.purple,
    open: colors.green,
    closed: colors.red,
  };
  const issueStateColor = stateColor[issueState]
    ? stateColor[issueState]
    : colors.gray;

  return (
    <Badge color={issueStateColor} style={style}>
      <BadgeText>{issueText}</BadgeText>
    </Badge>
  );
};

```

### Core Architecture Module: `src/utils/action-helper.js`
```
export const createActionSet = actionName => ({
  PENDING: `${actionName}_PENDING`,
  SUCCESS: `${actionName}_SUCCESS`,
  ERROR: `${actionName}_ERROR`,
  actionName,
});

export const createPaginationActionSet = actionName => ({
  ...createActionSet(actionName),
  RESET: `${actionName}_RESET`,
});

```

### Core Architecture Module: `src/utils/api-helpers.js`
```
import { Alert } from 'react-native';

export const getPaginationKey = args => args.join('-');

export const actionNameForCall = (namespace, method, prefix = '') => {
  const upperCased = `${namespace}_${method}`
    .replace(/([A-Z])/g, '_$1')
    .toUpperCase();

  return `${prefix}${upperCased}`;
};

// TODO: used mainly for developping this PR, but may come handy for #430
export const displayError = error => {
  Alert.alert('API Error', error);

  return Promise.reject(error);
};

```

### Core Architecture Module: `src/utils/color-helpers.js`
```
import { colors } from 'config';

export const getFontColorByBackground = bgColor => {
  const r = parseInt(bgColor.substr(0, 2), 16);
  const g = parseInt(bgColor.substr(2, 2), 16);
  const b = parseInt(bgColor.substr(4, 2), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;

  return yiq >= 128 ? colors.black : colors.white;
};

```

### Core Architecture Module: `src/utils/event-helpers.js`
```
import differenceInMilliseconds from 'date-fns/difference_in_milliseconds';

export function formatEventsToRender(events = []) {
  return events
    .filter(({ event }) => event !== 'mentioned' && event !== 'subscribed')
    .filter(({ event }, index, list) => {
      if (index === 0) {
        return true;
      }

      // Merge events are always followed by a closed event, but we don't
      // want to render them.
      if (event === 'closed' && list[index - 1].event === 'merged') {
        return false;
      }

      return true;
    })
    .reduce((results, event, index, list) => {
      // Label events are recorded individually, but we want to group them for display
      const labelEvents = ['labeled', 'unlabeled'];
      const prevEvent = index > 0 ? list[index - 1] : {};

      if (
        index > 0 &&
        labelEvents.includes(event.event) &&
        labelEvents.includes(prevEvent.event) &&
        differenceInMilliseconds(event.created_at, prevEvent.created_at) <
          10000 &&
        event.actor.login === prevEvent.actor.login
      ) {
        const labelGroup = results[results.length - 1];

        if (event.event === 'labeled') {
          labelGroup.labeled.push(event);
        } else {
          labelGroup.unlabeled.push(event);
        }
      } else if (labelEvents.includes(event.event)) {
        const labelGroup = {
          event: 'label-group',
          labeled: [],
          unlabeled: [],
          created_at: event.created_at,
          actor: event.actor,
        };

        if (event.event === 'labeled') {
          labelGroup.labeled.push(event);
        } else {
          labelGroup.unlabeled.push(event);
        }

        results.push(labelGroup);
      } else {
        results.push(event);
      }

      return results;
    }, []);
}

```

### Core Architecture Module: `src/utils/index.js`
```
export * from './action-helper';
export * from './api-helpers';
export * from './loading-animation';
export * from './text-helper';
export * from './method-helpers';
export * from './color-helpers';
export * from './event-helpers';
export * from './localization-helper';
export * from './migration-helper';

```

### Core Architecture Module: `src/utils/loading-animation.js`
```
import { Animated } from 'react-native';
import React from 'react';

export const loadingAnimation = state => {
  const duration = 500;
  const iterations = 10;
  let opacity1 = 0.3;
  let opacity2 = 0.7;
  const animatedTimings = [];

  for (let i = 0; i < iterations; i += 1) {
    animatedTimings.push(
      Animated.timing(state, { toValue: opacity1, duration })
    );
    const tempFrom = opacity2;

    opacity2 = opacity1;
    opacity1 = tempFrom;
  }

  return Animated.sequence(animatedTimings);
};

export const withFadeAnimation = WrappedComponent => {
  return class extends React.Component {
    constructor(props) {
      super(props);
      this.fadeFrom = 0.3;
      this.fadeTo = 0.6;
      this.state = {
        fadeAnimValue: new Animated.Value(this.fadeTo),
      };
    }

    componentDidMount() {
      this.runAnimation();
    }

    runAnimation() {
      const animatedTimings = [];
      const duration = 1000;

      animatedTimings.push(
        Animated.timing(this.state.fadeAnimValue, {
          toValue: this.fadeFrom,
          duration,
        })
      );
      animatedTimings.push(
        Animated.timing(this.state.fadeAnimValue, {
          toValue: this.fadeTo,
          duration,
        })
      );

      return Animated.sequence(animatedTimings).start(() => {
        this.runAnimation();
      });
    }

    render() {
      return <WrappedComponent opacity={this.state.fadeAnimValue} />;
    }
  };
};

export type FadeAnimationProps = {
  opacity: number,
};

```

### Core Architecture Module: `src/utils/localization-helper.js`
```
import React from 'react';
import AsyncStorage from '@react-native-community/async-storage';
import distanceInWords from 'date-fns/distance_in_words';

import { common } from 'config';
import I18n from 'locale';

export const t = (message, locale, interpolation = null) => {
  let translation = I18n.t(message, locale, interpolation);

  if (translation === '') {
    translation = message;
  }

  const componentPlaceholdersReg = /({([^}]+)})/g;

  const retval = [];

  let ongoing = '';
  let lastIndex = 0;
  let key = 0;

  translation.replace(
    componentPlaceholdersReg,
    (match, placeholder, name, index) => {
      key += 1;
      ongoing += translation.substring(lastIndex, index);
      const value = interpolation[name];
      const type = typeof value;

      if (type === 'undefined') {
        ongoing += '[unknown placeholder]';
      } else if (type === 'object') {
        retval.push(ongoing);
        retval.push(React.cloneElement(value, { key }));
        ongoing = '';
      } else if (type === 'string' || type === 'number') {
        ongoing += value;
      }
      lastIndex = index + match.length;
    }
  );

  if (lastIndex < translation.length) {
    ongoing += translation.substring(lastIndex);
  }

  if (ongoing.length) {
    retval.push(ongoing);
  }

  if (retval.length === 1) {
    return retval[0];
  }

  return retval;
};

export const getLocale = () => {
  // If for some reason a locale cannot be determined, fall back to defaultLocale.
  const locale =
    (I18n.locale && I18n.locale.toLowerCase()) || common.defaultLocale;
  const specialLocales = {
    'zh-hans': 'zh-cn',
    'zh-hans-cn': 'zh-cn',
    'zh-hans-sg': 'zh-cn',
    'zh-hans-hk': 'zh-hk',
    'zh-hant': 'zh-tw',
    'zh-hant-tw': 'zh-tw',
    'zh-hant-hk': 'zh-tw',
  };

  return specialLocales[locale] || locale;
};

export async function getCurrentLocale() {
  const deviceLocale = getLocale();
  const locale = await AsyncStorage.getItem('locale').then(settingLocale => {
    return settingLocale || deviceLocale;
  });

  return locale;
}

export const configureLocale = locale => {
  I18n.locale = locale;
};

export async function saveLocale(locale) {
  await AsyncStorage.setItem('locale', locale);

  return true;
}

/** Wrapper for date-fns' distanceInWordsStrict applaying current locale. */
export function relativeTimeToNow(date) {
  const locale = getLocale();
  // Custom locale config to get our own translations for relative time and
  // avoid date-fns translations.
  // Overrides date-fns `distanceInWords` function.
  // https://github.com/date-fns/date-fns/blob/v1.29.0/src/locale/en/build_distance_in_words_locale/index.js
  const localeConfig = {
    distanceInWords: {
      localize: (token, count) => {
        switch (token) {
          case 'lessThanXSeconds':
            return t('{lessThanXSeconds}s', locale, {
              lessThanXSeconds: count,
            });
          case 'xSeconds':
            return t('{xSeconds}s', locale, { xSeconds: count });
          case 'halfAMinute':
            return t('{halfAMinute}s', locale, { halfAMinute: count });
          case 'lessThanXMinutes':
            return t('{lessThanXMinutes}m', locale, {
              lessThanXMinutes: count,
            });
          case 'xMinutes':
            return t('{xMinutes}m', locale, { xMinutes: count });
          case 'aboutXHours':
            return t('{aboutXHours}h', locale, { aboutXHours: count });
          case 'xHours':
            return t('{xHours}h', locale, { xHours: count });
          case 'xDays':
            return t('{xDays}d', locale, { xDays: count });
          case 'aboutXMonths':
            return t('{aboutXMonths}mo', locale, { aboutXMonths: count });
          case 'xMonths':
            return t('{xMonths}mo', locale, { xMonths: count });
          case 'aboutXYears':
            return t('{aboutXYears}y', locale, { aboutXYears: count });
          case 'xYears':
            return t('{xYears}y', locale, { xYears: count });
          case 'overXYears':
            return t('{overXYears}y', locale, { overXYears: count });
          case 'almostXYears':
            return t('{almostXYears}y', locale, { almostXYears: count });
          default:
            return '?';
        }
      },
    },
  };

  return distanceInWords(date, new Date(), { locale: localeConfig });
}

```

### Core Architecture Module: `src/utils/method-helpers.js`
```
import { Platform, Linking } from 'react-native';
import SafariView from 'react-native-safari-view';
import { NavigationActions } from 'react-navigation';

export const openURLInView = url => {
  // Use SafariView on iOS
  if (Platform.OS === 'ios') {
    SafariView.show({
      url,
      fromBottom: true,
    });
  } else {
    Linking.openURL(url);
  }
};

export const resetNavigationTo = (routeName: string, navigation: {}) => {
  const resetAction = NavigationActions.reset({
    index: 0,
    key: null,
    actions: [NavigationActions.navigate({ routeName })],
  });

  navigation.dispatch(resetAction);
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export const delay = (delayed, ms) =>
  Promise.all([delayed, sleep(ms)]).then(([data]) => data);

```

### Core Architecture Module: `src/utils/migration-helper.js`
```
export const toOldUserFormat = user => {
  return {
    ...user,
    avatar_url: user.avatarUrl,
  };
};

export const toOldIssueFormat = (issue, repoId, isPr = false) => {
  return {
    ...issue,
    user: toOldUserFormat(issue.author),
    comments: issue.comments.totalCount,
    created_at: issue.createdAt,
    closed_at: issue.closedAt,
    state: issue.state.toLowerCase(),
    pull_request: isPr ? {} : null,
    url: `https://api.github.com/repos/${repoId}/issues/${issue.number}`,
  };
};

export const getRepoIdFromUrl = url =>
  url.replace(/https:\/\/api.github.com\/repos\/(.+)\/(.+)\/?/, '$1/$2');

```

### Core Architecture Module: `src/utils/text-helper.js`
```
import emoji from 'node-emoji';
import I18n from 'locale';

import { t } from 'utils';

export const emojifyText = text => {
  return emoji.emojify(text);
};

export const abbreviateNumber = count => {
  const thousandUnit = t('_thousandsAbbreviation', I18n.locale);

  if (count > 999) {
    return count % 1000 < 50
      ? (count / 1000).toFixed(0) + thousandUnit
      : (count / 1000).toFixed(1) + thousandUnit;
  }

  return count;
};

```

### Core Architecture Module: `.commitlint/index.js`
```
module.exports = {
  rules: {
    'body-leading-blank': [1, 'always'],
    'footer-leading-blank': [1, 'always'],
    'header-max-length': [2, 'always', 72],
    'scope-case': [2, 'always', 'lowerCase'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'type-case': [2, 'always', 'lowerCase'],
    'type-empty': [2, 'never'],
    'type-enum': [
      2,
      'always',
      [
        'build',
        'chore',
        'docs',
        'feat',
        'fix',
        'perf',
        'refactor',
        'revert',
        'style',
        'test',
      ],
    ],
  },
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #951** (2024-06-27): **GithudMErGE**
  *Symptoms*: <!--   Bonjour!    We can't express how grateful we are that you're working on making GitPoint   better! We're thrilled to take a look at the changes you've made and merge   them in as soon as possible. Please fill out this template to make the   reviewal process as quick and smooth as possible. In addition, please make   sure you remember to add yourself to the contributors list with the following   command:    $ yarn contributors:add    Make sure the title of your PR follows our commit style guidelines (see other   open PR's for reference if you're confused):    https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#-git-commit-guidelines    Thanks again for your hard work! -->  | Question         | Response    | | ---------------- | ----------- | | Version?         | v1.4.1      | | Devices tested?  | iPhone 7... | | Bug fix?         | yes/no      | | New feature?     | yes/no      | | Includes tests?  | yes/no      | | All Tests pass?  | yes/no      | | Related ticket?  | #...        |  ---  ## Screenshots  <!--   Replace the images in the table below with screenshots of your changes before   and after. If this is not applicable (i.e. absolutely NO visual changes), feel   free to delete this section. -->  | Before   | After    | | -------- | -------- | |![before](http://placekitten.com/700/1000)|![after](http://placekitten.com/700/1001)|  ## Description  <!--   What changes did you make? -->   <!-- DO NOT MODIFY 

- **Issue #950** (2024-06-17): **Error 403 (Forbidden)!!1**
  *Symptoms*: https://developer.android.com/codelabs/basic-android-kotlin-compose-first-app?continue=https%3A%2F%2Fdeveloper.android.com%2Fcourses%2Fpathways%2Fandroid-basics-compose-unit-1-pathway-2&hl=es-419#5

- **Issue #949** (2024-06-17): **5t**
  *Symptoms*: <!--   --- IMPORTANT ---   This is a template for a bug report! If you want to submit a feature request,   please paste this link into your browser and follow the instructions there.    https://github.com/gitpoint/git-point/issues/new?template=FEATURE_REQUEST.md   ----------------- -->  <!--   Hi there!    Thanks for considering to file a bug with GitPoint. Please take a moment to   answer the basic questions listed in this template. If there is no need for   certain fields or sections, please delete those headers before submitting. We   know not all tickets require those steps. Otherwise, please try to be as   detailed as possible.    If this is just a generic question, please consider talking with us on Gitter:   https://gitter.im/git-point    Thanks! -->  | Question         | Response    | | ---------------- | ----------- | | Version?         | v1.4.1      | | Devices tested?  | iPhone 7... |  ---  ## What Currently Happens?  <!--   Describe what happens. -->  ## What Do You Expect To Happen?  <!--   Describe what you expect to happen differently. -->  ## My Reproduction Steps  <!--   Please specify the exact steps you took for this bug to occur. Provide as much   detail as possible so we're able to reproduce these steps. -->  1. XXX 1. XXX 1. XXX 1. XXX   <!-- DO NOT MODIFY BELOW THIS LINE --> <!-- ----------------------------- --> <!-- GITPOINT_BUG --> 
  **Post-Mortem & Fix Analysis**:
  > - /bitcoin/transaction/6921e47b3ccd4e53522581425b7741bc8f55a243265df383fc0cfa09a686498f

- **Issue #943** (2024-06-17): **Question**
  *Symptoms*: Is this project dead?   <!-- DO NOT MODIFY BELOW THIS LINE --> <!-- ----------------------------- --> <!-- GITPOINT_INVALID --> 

- **Issue #925** (2024-06-17): **Fix issues**
  *Symptoms*: <!--   --- IMPORTANT ---   This is a template for a feature request! If you want to submit a bug report,   please paste this link into your browser and follow the instructions there.    https://github.com/gitpoint/git-point/issues/new?template=BUG_REPORT.md   ----------------- -->  <!--   Hi there!    Thanks for considering to file a feature request with GitPoint. Please take a   moment to answer the basic questions listed in this template. If there is no   need for certain fields or sections, please delete those headers before   submitting. We know not all tickets require those steps. Otherwise, please   try to be as detailed as possible.    If this is just a generic question, please consider talking with us on Gitter:   https://gitter.im/git-point    Thanks! -->  ## What Currently Happens?  <!--   Describe the current behavior. -->  ## What Would You Like To Happen?  <!--   Describe what you'd like to see added. Be as descriptive as possible so we can   have a good idea of what you want! Mockups or sketches are always welcome if   applicable! -->   <!-- DO NOT MODIFY BELOW THIS LINE --> <!-- ----------------------------- --> <!-- GITPOINT_FEATURE --> 
  **Post-Mortem & Fix Analysis**:
  > Enable Java script fix issues

- **Issue #924** (2024-06-17): **Fix all errors on phone**
  *Symptoms*: <!--   --- IMPORTANT ---   This is a template for a bug report! If you want to submit a feature request,   please paste this link into your browser and follow the instructions there.    https://github.com/gitpoint/git-point/issues/new?template=FEATURE_REQUEST.md   ----------------- -->  <!--   Hi there!    Thanks for considering to file a bug with GitPoint. Please take a moment to   answer the basic questions listed in this template. If there is no need for   certain fields or sections, please delete those headers before submitting. We   know not all tickets require those steps. Otherwise, please try to be as   detailed as possible.    If this is just a generic question, please consider talking with us on Gitter:   https://gitter.im/git-point    Thanks! -->  | Question         | Response    | | ---------------- | ----------- | | Version?         | v1.4.1      | | Devices tested?  | iPhone 7... |  ---  ## What Currently Happens?  <!--   Describe what happens. -->  ## What Do You Expect To Happen?  <!--   Describe what you expect to happen differently. -->  ## My Reproduction Steps  <!--   Please specify the exact steps you took for this bug to occur. Provide as much   detail as possible so we're able to reproduce these steps. -->  1. XXX 1. XXX 1. XXX 1. XXX   <!-- DO NOT MODIFY BELOW THIS LINE --> <!-- ----------------------------- --> <!-- GITPOINT_BUG --> 
  **Post-Mortem & Fix Analysis**:
  > Help needed Enable Java script

- **Issue #922** (2020-10-31): **Updated Dutch translations**
  *Symptoms*: ## Description  - Added missing Dutch translations - Updated "wrong" localisations for example *Bijdragers* (~Contributors) instead of *Medewerkers* (~employees) - Changed 2nd for translations to polite form  <!-- DO NOT MODIFY BELOW THIS LINE --> <!-- ----------------------------- --> <!-- GITPOINT_PR --> 
  **Post-Mortem & Fix Analysis**:
  > @eliottha sorry for the delay, thank you for your contribution! :)

- **Issue #921** (2020-10-31): **Adding Indonesia Translation**
  *Symptoms*: <!--   Bonjour!    We can't express how grateful we are that you're working on making GitPoint   better! We're thrilled to take a look at the changes you've made and merge   them in as soon as possible. Please fill out this template to make the   reviewal process as quick and smooth as possible. In addition, please make   sure you remember to add yourself to the contributors list with the following   command:    $ yarn contributors:add    Make sure the title of your PR follows our commit style guidelines (see other   open PR's for reference if you're confused):    https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#-git-commit-guidelines    Thanks again for your hard work! -->  | Question         | Response    | | ---------------- | ----------- | | Version?         | v1.4.1      | | Devices tested?  | Samsung J4... | | Bug fix?         | yes | | New feature?     | yes | | Includes tests?  | no | | All Tests pass?  | yes | | Related ticket?  | #439   |  ---  ## Screenshots  <!--   Replace the images in the table below with screenshots of your changes before   and after. If this is not applicable (i.e. absolutely NO visual changes), feel   free to delete this section. -->  | Before   | After    | | -------- | -------- | |![before](https://media.giphy.com/media/VduE8hXEeAwJMFQlXA/giphy.gif)|![after](https://media.giphy.com/media/VpBbW26jjMbb6sRim2/giphy.gif)|  ## Description  <!--   What changes did you make? --> * Add
  **Post-Mortem & Fix Analysis**:
  > hi @lex111 @nersoh @peterblazejewicz @andrewda @Jpfonseca @chinesedfan @machour  this is my first PR, let me know what you think
  > Seems good to me. But I ain't a maintainer 😅
  > > Seems good to me. But I ain't a maintainer 😅  aa haha, well hope the real one read this asap

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

### Incident Patch 1: `fd71727c` (2019-11-06)
**Commit Message**: fix: provide real safe area view (#911)

* fix(android): set SafeAreaView insets explicitly

* chore(dep): force to use react-native-safe-area-view@1.0.0

* chore: not need to use forceInset

* fix: use the fork to support pre-AndroidX

* fix: lint

* fix: ignore the line

**File**: `App.js` (modified, +6/-10)
```diff
@@ -7,10 +7,9 @@ import {
   StatusBar,
   Platform,
 } from 'react-native';
-import { SafeAreaView } from 'react-navigation';
-import DeviceInfo from 'react-native-device-info';
 import codePush from 'react-native-code-push';
 import { PersistGate } from 'redux-persist/integration/react';
+import { SafeAreaProvider } from 'react-native-safe-area-context'; // eslint-disable-line
 import { colors, getStatusBarConfig } from 'config';
 import { getCurrentLocale, configureLocale } from 'utils';
 import { GitPoint } from './routes';
@@ -32,11 +31,6 @@ if (console) {
   console.disableYellowBox = true; // eslint-disable-line no-console
 }
 
-if (Platform.OS === 'android' && DeviceInfo.hasNotch()) {
-  // FIXME: real value for status bar height + notch height
-  SafeAreaView.setStatusBarHeight(44);
-}
-
 class App extends Component {
   static async initLocale() {
     const locale = await getCurrentLocale();
@@ -107,9 +101,11 @@ class App extends Component {
     return (
       <Provider store={configureStore}>
         <PersistGate loading={this.renderLogo} persistor={persistor}>
-          <GitPoint onNavigationStateChange={this.statusBarHandler}>
-            <StatusBar />
-          </GitPoint>
+          <SafeAreaProvider>
+            <GitPoint onNavigationStateChange={this.statusBarHandler}>
+              <StatusBar />
+            </GitPoint>
+          </SafeAreaProvider>
         </PersistGate>
       </Provider>
     );
```

**File**: `android/app/build.gradle` (modified, +1/-0)
```diff
@@ -148,6 +148,7 @@ android {
 }
 
 dependencies {
+    implementation project(':react-native-safe-area-context')
     implementation project(':react-native-webview')
     implementation project(':@react-native-community_async-storage')
     compile project(':react-native-svg')
```

**File**: `android/app/src/main/java/com/gitpoint/MainApplication.java` (modified, +2/-0)
```diff
@@ -3,6 +3,7 @@
 import android.app.Application;
 
 import com.facebook.react.ReactApplication;
+import com.th3rdwave.safeareacontext.SafeAreaContextPackage;
 import com.reactnativecommunity.webview.RNCWebViewPackage;
 import com.reactnativecommunity.asyncstorage.AsyncStoragePackage;
 import com.horcrux.svg.SvgPackage;
@@ -40,6 +41,7 @@ public boolean getUseDeveloperSupport() {
     protected List<ReactPackage> getPackages() {
       return Arrays.<ReactPackage>asList(
           new MainReactPackage(),
+            new SafeAreaContextPackage(),
             new RNCWebViewPackage(),
             new AsyncStoragePackage(),
             new SvgPackage(),
```

**File**: `android/settings.gradle` (modified, +2/-0)
```diff
@@ -1,4 +1,6 @@
 rootProject.name = 'GitPoint'
+include ':react-native-safe-area-context'
+project(':react-native-safe-area-context').projectDir = new File(rootProject.projectDir, '../node_modules/react-native-safe-area-context/android')
 include ':react-native-webview'
 project(':react-native-webview').projectDir = new File(rootProject.projectDir, '../node_modules/react-native-webview/android')
 include ':@react-native-community_async-storage'
```

**File**: `ios/GitPoint.xcodeproj/project.pbxproj` (modified, +77/-6)
```diff
@@ -40,11 +40,13 @@
 		2DC1C633A0C24C4DAE02E60B /* libRNPhotoView.a in Frameworks */ = {isa = PBXBuildFile; fileRef = 1ABB0D8AB2424B1595DABB16 /* libRNPhotoView.a */; };
 		2DCD954D1E0B4F2C00145EB5 /* GitPointTests.m in Sources */ = {isa = PBXBuildFile; fileRef = 00E356F21AD99517003FC87E /* GitPointTests.m */; };
 		3074F532C67F4444983EDB54 /* Nunito-Bold.ttf in Resources */ = {isa = PBXBuildFile; fileRef = 24C757CE6CB049658C31ED0E /* Nunito-Bold.ttf */; };
+		34CAF34980E142918AAAB802 /* libRNCWebView.a in Frameworks */ = {isa = PBXBuildFile; fileRef = 1A0357426E304B6AA98645B8 /* libRNCWebView.a */; };
 		39AFBAA702774545A69EF780 /* MaterialCommunityIcons.ttf in Resources */ = {isa = PBXBuildFile; fileRef = 0AE8E7C54E014D1E803D4597 /* MaterialCommunityIcons.ttf */; };
 		3B4B2C15526143C288A991B2 /* libRNDeviceInfo.a in Frameworks */ = {isa = PBXBuildFile; fileRef = 651F5DC3BF71489BB193A32B /* libRNDeviceInfo.a */; };
 		48F49F6A1F19028D0012FAD6 /* libRNSearchBar.a in Frameworks */ = {isa = PBXBuildFile; fileRef = 48F49F671F19026D0012FAD6 /* libRNSearchBar.a */; };
 		4A0E0CE9909244398A873436 /* Nunito-SemiBold.ttf in Resources */ = {isa = PBXBuildFile; fileRef = FBD0F4CBD299403498005E08 /* Nunito-SemiBold.ttf */; };
 		50F35898A24848019AB181A2 /* EvilIcons.ttf in Resources */ = {isa = PBXBuildFile; fileRef = 47C78E5B8D574B96A51E3779 /* EvilIcons.ttf */; };
+		52AF08BFDBB141A08110475A /* libRNCAsyncStorage.a in Frameworks */ = {isa = PBXBuildFile; fileRef = E0C4D7095AD24919AD979CB8 /* libRNCAsyncStorage.a */; };
 		562B8AA6D1DA4F4C8294AD19 /* libz.tbd in Frameworks */ = {isa = PBXBuildFile; fileRef = 646DAC28E02143BEA99179AF /* libz.tbd */; };
 		5DC6C311356B4973AE2599BF /* Nunito-Light.ttf in Resources */ = {isa = PBXBuildFile; fileRef = ED1B22A89E134AA89E251577 /* Nunito-Light.ttf */; };
 		5E9157361DD0AC6A00FF2AA8 /* libRCTAnimation.a in Frameworks */ = {isa = PBXBuildFile; fileRef = 5E9157331DD0AC6500FF2AA8 /* libRCTAnimation.a */; };
@@ -66,8 +68,7 @@
 		DC5C35E71E37AD1800F3F526 /* FontAwesome.ttf in Resources */ = {isa = PBXBuildFile; fileRef = DC5C35DD1E37AD1800F3F526 /* FontAwesome.ttf */; };
 		EB0F176BE52B4561B9FF07AB /* libReactNativeConfig.a in Frameworks */ = {isa = PBXBuildFile; fileRef = D7043BDB577E427391ECFBB0 /* libReactNativeConfig.a */; };
 		F16AF5D05B394C8C832C7E68 /* Feather.ttf in Resources */ = {isa = PBXBuildFile; fileRef = 5B85AC9D921B42D4BDF35CC7 /* Feather.ttf */; };
-		52AF08BFDBB141A08110475A /* libRNCAsyncStorage.a in Frameworks */ = {isa = PBXBuildFile; fileRef = E0C4D7095AD24919AD979CB8 /* libRNCAsyncStorage.a */; };
-		34CAF34980E142918AAAB802 /* libRNCWebView.a in Frameworks */ = {isa = PBXBuildFile; fileRef = 1A0357426E304B6AA98645B8 /* libRNCWebView.a */; };
+		7FC463FD8AE047179EA94B4D /* libRNCSafeAreaContext.a in Frameworks */ = {isa = PBXBuildFile; fileRef = 9C486F4A450642369B75CE4D /* libRNCSafeAreaContext.a */; };
 /* End PBXBuildFile section */
 
 /* Begin PBXContainerItemProxy section */
@@ -176,6 +177,20 @@
 			remoteGlobalIDString = EB2648DF1C7BE17A00B8F155;
 			remoteInfo = ReactNativeConfig;
 		};
+		27CB36B5231BFD950071A6E2 /* PBXContainerItemProxy */ = {
+			isa = PBXContainerItemProxy;
+			containerPortal = 6389F544B2B64B5BB176E2A4 /* RNCAsyncStorage.xcodeproj */;
+			proxyType = 2;
+			remoteGlobalIDString = 134814201AA4EA6300B7C361;
+			remoteInfo = RNCAsyncStorage;
+		};
+		27CB36B8231BFD950071A6E2 /* PBXContainerItemProxy */ = {
+			isa = PBXContainerItemProxy;
+			containerPortal = 26B720B887404BDC8D51E8EB /* RNCWebView.xcodeproj */;
+			proxyType = 2;
+			remoteGlobalIDString = 134814201AA4EA6300B7C361;
+			remoteInfo = RNCWebView;
+		};
 		2D02E4911E0B4A5D006451C7 /* PBXContainerItemProxy */ = {
 			isa = PBXContainerItemProxy;
 			containerPortal = 83CBB9F71A601CBA00E9B192 /* Project object */;
@@ -479,8 +494,10 @@
 		13B07FB71A68108700A75B9A /* main.m */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.c.objc; name = main.m; path = GitPoint/main.m; sourceTree = "<group>"; };
 		146833FF1AC3E56700842450 /* React.xcodeproj */ = {isa = PBXFileReference; lastKnownFileType = "wrapper.pb-project"; name = React.xcodeproj; path = "../node_modules/react-native/React/React.xcodeproj"; sourceTree = "<group>"; };
 		18487F5E165143648CF0950E /* Menlo.ttf */ = {isa = PBXFileReference; explicitFileType = undefined; fileEncoding = 9; includeInIndex = 0; lastKnownFileType = unknown; name = Menlo.ttf; path = ../src/assets/fonts/Menlo.ttf; sourceTree = "<group>"; };
+		1A0357426E304B6AA98645B8 /* libRNCWebView.a */ = {isa = PBXFileReference; explicitFileType = undefined; fileEncoding = 9; includeInIndex = 0; lastKnownFileType = archive.ar; path = libRNCWebView.a; sourceTree = "<group>"; };
 		1ABB0D8AB2424B1595DABB16 /* libRNPhotoView.a */ = {isa = PBXFileReference; explicitFileType = undefined; fileEncoding = 9; includeInIndex = 0; lastKnownFileType = archive.ar; path = libRNPhotoView.a; sourceTree = "<group>"; };
 		24C757CE6CB049658C31ED
```

**File**: `package.json` (modified, +2/-0)
```diff
@@ -82,6 +82,7 @@
     "react-native-parallax-scroll-view": "^0.20.1",
     "react-native-photo-view": "^1.5.2",
     "react-native-safari-view": "^2.0.0",
+    "react-native-safe-area-context": "chinesedfan/react-native-safe-area-context#git-point",
     "react-native-search-bar": "^3.3.1",
     "react-native-simple-toast": "^0.0.8",
     "react-native-svg": "^6.3.1",
@@ -153,6 +154,7 @@
     "stylelint-processor-styled-components": "^1.0.0"
   },
   "resolutions": {
+    "react-native-safe-area-view": "1.0.0",
     "react-native-tab-view": "chinesedfan/react-native-tab-view#git-point"
   },
   "jest": {
```

**File**: `src/auth/screens/auth-profile.screen.js` (modified, +2/-2)
```diff
@@ -19,7 +19,7 @@ import {
   UserListItem,
   EntityInfo,
 } from 'components';
-import { colors, fonts, normalize } from 'config';
+import { colors, fonts, normalize, getHeaderForceInset } from 'config';
 import { getUser, getOrgs, getStarCount } from 'auth';
 import { emojifyText, openURLInView, t } from 'utils';
 
@@ -44,7 +44,7 @@ const mapDispatchToProps = dispatch =>
   );
 
 const StyledSafeAreaView = styled(SafeAreaView).attrs({
-  forceInset: { top: 'always', bottom: 'never' },
+  forceInset: getHeaderForceInset('MyProfile'),
 })`
   background-color: ${colors.primaryDark};
 `;
```

**File**: `src/auth/screens/login.screen.js` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ const ModalWrapper = styled.View`
 const StyledSafeAreaView = styled(SafeAreaView).attrs({
   forceInset: Platform.select({
     ios: { top: 'always', bottom: 'never' },
-    android: {},
+    android: { top: 'never', bottom: 'never' },
   }),
 })`
   background-color: ${colors.githubDark};
```

---

### Incident Patch 2: `99c0dedc` (2019-10-22)
**Commit Message**: fix(locale): Update locale text for ru

**File**: `src/locale/languages/ru.js` (modified, +6/-6)
```diff
@@ -14,7 +14,7 @@ module.exports = {
   'Are you sure?': 'Вы уверены?',
   'Assign Yourself': 'Назначить на самого себя',
   Assignees: 'Ответственные',
-  'Author: ': '',
+  'Author: ': 'Автор',
   BIO: 'СПРАВКА',
   CANCEL: 'ОТМЕНА',
   CONTACT: 'КОНТАКТЫ',
@@ -33,8 +33,8 @@ module.exports = {
   'Comment Actions': 'Действия с комментарием',
   'Commit Message': 'Текст сообщения коммита',
   'Commit Title': 'Заголовок коммита',
-  Commits: '',
-  'Committer: ': '',
+  Commits: 'Коммиты',
+  'Committer: ': 'Автор коммита',
   'Communicate on conversations, merge pull requests and more':
     'Общайтесь, принимайте пулреквесты и делайте многое другое',
   Company: 'Компания',
@@ -91,8 +91,8 @@ module.exports = {
   'New Issue': 'Новая ишью',
   'No README.md found': 'He yдалось найти README.md',
   'No closed issues found!': 'Не найдено закрытых ишью!',
-  'No closed pull requests found!': '',
-  'No commit found!': '',
+  'No closed pull requests found!': 'Не найдено ни одного пулреквеста!',
+  'No commit found!': 'Не найдено ни одного коммита!',
   'No contributors found': 'Участники не найдены',
   'No description provided.': 'Нет описания.',
   'No issues': 'Нет ишью',
@@ -163,7 +163,7 @@ module.exports = {
   Users: 'Пользователи',
   'View All': 'Смотреть все',
   'View Code': 'Смотреть код',
-  'View Commits': '',
+  'View Commits': 'Просмотр коммитов',
   'View and control all of your unread and participating notifications':
     'Просматривайте и управляйте всеми вашими непрочитанными и активными уведомлениями',
   Watch: 'Следить',
```

---

### Incident Patch 3: `4815274a` (2019-10-18)
**Commit Message**: fix(locale): Update locale text for pt-Br (#896)

**File**: `src/locale/languages/it.js` (modified, +2/-2)
```diff
@@ -14,7 +14,7 @@ module.exports = {
   'Are you sure?': 'Sei sicuro?',
   'Assign Yourself': 'Autoassegna',
   Assignees: 'Assegnatari',
-  'Author: ': 'Autori',
+  'Author: ': 'Autori: ',
   BIO: 'BIO',
   CANCEL: 'ANNULLA',
   CONTACT: 'CONTATTI',
@@ -34,7 +34,7 @@ module.exports = {
   'Commit Message': 'Messaggio di commit',
   'Commit Title': 'Titolo del commit',
   Commits: 'Commit',
-  'Committer: ': 'Autore del commit',
+  'Committer: ': 'Autore del commit: ',
   'Communicate on conversations, merge pull requests and more':
     'Comunica su conversazioni, fai il merge di PR e altro',
   Company: 'Azienda',
```

**File**: `src/locale/languages/pt.js` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ module.exports = {
   'Are you sure?': 'Tem  a certeza?',
   'Assign Yourself': 'Atribua a você',
   Assignees: 'Atribuída a',
-  'Author: ': 'Autor',
+  'Author: ': 'Autor: ',
   BIO: 'BIOGRAFIA',
   CANCEL: 'CANCELAR',
   CONTACT: 'CONTATO',
```

**File**: `src/locale/languages/ptBr.js` (modified, +3/-3)
```diff
@@ -14,7 +14,7 @@ module.exports = {
   'Are you sure?': 'Tem certeza?',
   'Assign Yourself': 'Atribua a você',
   Assignees: 'Atribuída a',
-  'Author: ': 'Autor',
+  'Author: ': 'Autor: ',
   BIO: 'BIO',
   CANCEL: 'CANCELAR',
   CONTACT: 'CONTATO',
@@ -164,7 +164,7 @@ module.exports = {
   Users: 'Usuários',
   'View All': 'Ver Todos',
   'View Code': 'Ver Código',
-  'View Commits': '',
+  'View Commits': 'Ver Commits',
   'View and control all of your unread and participating notifications':
     'Ver e controlar todas as suas notificações',
   Watch: 'Acompanhar',
@@ -238,7 +238,7 @@ module.exports = {
     '{actor} reaberto issue {issue} em {repo}',
   '{actor} reopened pull request {pr} at {repo}':
     '{actor} reaberto pull request {pr} em {repo}',
-  '{actor} starred {repo}': '{actor} favoritado {repo}',
+  '{actor} starred {repo}': '{actor} favoritou {repo}',
   '{almostXYears}y': '',
   '{halfAMinute}s': '',
   '{lessThanXMinutes}m': '',
```

---

### Incident Patch 4: `41b3a721` (2019-08-09)
**Commit Message**: fix(issue): refresh the list

**File**: `src/issue/screens/issue.screen.js` (modified, +2/-2)
```diff
@@ -247,9 +247,9 @@ class Issue extends Component {
 
     Promise.all([
       getIssue(issueRepository, issueNumber),
-      getIssueTimeline(issueRepository, issueNumber),
+      getIssueTimeline(issueRepository, issueNumber, { forceRefresh: true }),
       getRepo(issueRepository),
-      getContributors(issueRepository),
+      getContributors(issueRepository, { forceRefresh: true }),
     ])
       .then(() => {
         const issue = this.props.issue;
```

---

### Incident Patch 5: `4d21c608` (2019-08-09)
**Commit Message**: fix(notification): sort repositories by notification's last update time

**File**: `src/notifications/screens/notifications.screen.js` (modified, +11/-10)
```diff
@@ -236,16 +236,17 @@ class Notifications extends Component {
   }
 
   getSortedRepos = () => {
-    const repositories = [
-      ...new Set(
-        this.notifications().map(
-          notification => notification.repository.full_name
-        )
-      ),
-    ];
-
-    return repositories.sort((a, b) => {
-      return a.toLowerCase() > b.toLowerCase() ? 1 : -1;
+    const updateTimeMap = {};
+
+    this.notifications().forEach(notification => {
+      const repoName = notification.repository.full_name;
+
+      updateTimeMap[repoName] =
+        updateTimeMap[repoName] || notification.update_time;
+    });
+
+    return Object.keys(updateTimeMap).sort((a, b) => {
+      return new Date(a) - new Date(b);
     });
   };
 
```

---

### Incident Patch 6: `56344319` (2019-07-21)
**Commit Message**: fix(android): fix ViewPager by a fork branch

https://github.com/react-native-community/react-native-tab-view/pull/723

**File**: `package.json` (modified, +4/-1)
```diff
@@ -142,7 +142,7 @@
     "prettier-eslint-cli": "^5.0.0",
     "react-dom": "16.8.3",
     "react-native-cli": "^2.0.1",
-    "react-native-mock": "chinesedfan/react-native-mock",
+    "react-native-mock": "chinesedfan/react-native-mock#git-point",
     "react-test-renderer": "16.8.3",
     "reactotron-react-native": "^1.14.0",
     "reactotron-redux": "^1.13.0",
@@ -152,6 +152,9 @@
     "stylelint-config-styled-components": "^0.1.1",
     "stylelint-processor-styled-components": "^1.0.0"
   },
+  "resolutions": {
+    "react-native-tab-view": "chinesedfan/react-native-tab-view#git-point"
+  },
   "jest": {
     "preset": "react-native",
     "testMatch": [
```

**File**: `yarn.lock` (modified, +3/-3)
```diff
@@ -9237,7 +9237,7 @@ react-native-material-design-searchbar@^1.1.4:
     prop-types "^15.5.10"
     react-native-vector-icons "^4.2.0"
 
-react-native-mock@chinesedfan/react-native-mock:
+react-native-mock@chinesedfan/react-native-mock#git-point:
   version "0.3.1"
   resolved "https://codeload.github.com/chinesedfan/react-native-mock/tar.gz/eadfb9b0509666c2c0e56edc9f1e0b5babd200a1"
   dependencies:
@@ -9324,9 +9324,9 @@ react-native-syntax-highlighter@^1.2.1:
     babel-runtime "^6.23.0"
     react-syntax-highlighter "^5.6.2"
 
-"react-native-tab-view@github:react-navigation/react-native-tab-view":
+react-native-tab-view@chinesedfan/react-native-tab-view#git-point, "react-native-tab-view@github:react-navigation/react-native-tab-view":
   version "0.0.74"
-  resolved "https://codeload.github.com/react-navigation/react-native-tab-view/tar.gz/36ebd834d78b841fc19778c966465d02fd1213bb"
+  resolved "https://codeload.github.com/chinesedfan/react-native-tab-view/tar.gz/81c016aa0f05029c85d840f69279a548115520ba"
   dependencies:
     prop-types "^15.6.0"
 
```

---

### Incident Patch 7: `35e4a089` (2019-07-21)
**Commit Message**: fix(login): make welcome screen able to login

**File**: `src/auth/screens/welcome.screen.js` (modified, +38/-2)
```diff
@@ -1,17 +1,31 @@
+/* eslint-disable no-shadow */
 import React, { Component } from 'react';
 import styled from 'styled-components';
+import { bindActionCreators } from 'redux';
 import { connect } from 'react-redux';
 import { ActivityIndicator } from 'react-native';
+import CookieManager from 'react-native-cookies';
 
+import { auth, getUser } from 'auth';
 import { ViewContainer } from 'components';
 import { colors, fonts, normalize } from 'config';
-import { t } from 'utils';
+import { t, resetNavigationTo } from 'utils';
 
 const mapStateToProps = state => ({
   locale: state.auth.locale,
   isLoggingIn: state.auth.isLoggingIn,
+  isAuthenticated: state.auth.isAuthenticated,
 });
 
+const mapDispatchToProps = dispatch =>
+  bindActionCreators(
+    {
+      auth,
+      getUser,
+    },
+    dispatch
+  );
+
 const Container = styled.View`
   flex: 1;
   justify-content: center;
@@ -30,8 +44,30 @@ class Welcome extends Component {
   props: {
     locale: string,
     isLoggingIn: boolean,
+    isAuthenticated: boolean,
+    auth: Function,
+    getUser: Function,
+    navigation: Object,
   };
 
+  componentDidMount() {
+    const { isAuthenticated, navigation, auth, getUser } = this.props;
+    const { code, state } = navigation.state.params;
+
+    if (isAuthenticated) {
+      resetNavigationTo('Main', navigation);
+    } else {
+      CookieManager.clearAll().then(() => {
+        auth(code, state).then(() => {
+          getUser().then(() => {
+            console.log('resetNavigationTo Main');
+            resetNavigationTo('Main', navigation);
+          });
+        });
+      });
+    }
+  }
+
   render() {
     const { locale, isLoggingIn } = this.props;
 
@@ -46,4 +82,4 @@ class Welcome extends Component {
   }
 }
 
-export const WelcomeScreen = connect(mapStateToProps)(Welcome);
+export const WelcomeScreen = connect(mapStateToProps, mapDispatchToProps)(Welcome);
```

---

### Incident Patch 8: `161bd78b` (2019-07-21)
**Commit Message**: fix(login): add SafeAreaView and update color

**File**: `src/auth/screens/login.screen.js` (modified, +13/-2)
```diff
@@ -8,6 +8,7 @@ import { Button, Icon } from 'react-native-elements';
 import Swiper from 'react-native-swiper';
 import queryString from 'query-string';
 import CookieManager from 'react-native-cookies';
+import { SafeAreaView } from 'react-navigation';
 
 import { ViewContainer, ErrorScreen } from 'components';
 import { colors, fonts, normalize } from 'config';
@@ -42,8 +43,17 @@ const Modal = styled.Modal`
 
 const ModalWrapper = styled.View`
   flex: 1;
-  padding-top: 20;
-  background-color: #1f2327;
+  background-color: ${colors.githubDark}
+`;
+
+// https://github.com/facebook/react-native/issues/9090
+const StyledSafeAreaView = styled(SafeAreaView).attrs({
+  forceInset: Platform.select({
+    ios: { top: 'always', bottom: 'never' },
+    android: {},
+  }),
+})`
+  background-color: ${colors.githubDark};
 `;
 
 const Slide = styled.View`
@@ -342,6 +352,7 @@ class Login extends Component {
             visible={this.state.modalVisible}
           >
             <ModalWrapper>
+              <StyledSafeAreaView />
               <BrowserSection>
                 <WebView
                   source={{
```

**File**: `src/config/colors.js` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ export const colors = {
   lightPurple: '#bf54eb',
   purple: '#8e44ad',
   orange: '#e67e22',
-  githubDark: '#1f2327',
+  githubDark: '#24292e',
   alabaster: '#f7f7f7',
   topicLightBlue: '#f1f8ff',
 };
```

---

### Incident Patch 9: `5bdd37eb` (2019-07-21)
**Commit Message**: fix: clear forceInset for non-translucent status bar screens

**File**: `routes.js` (modified, +22/-1)
```diff
@@ -9,7 +9,7 @@ import {
 import { Icon } from 'react-native-elements';
 
 import { NotificationIcon } from 'components';
-import { colors } from 'config';
+import { colors, getHeaderForceInset } from 'config';
 import { t } from 'utils';
 
 // Auth
@@ -222,12 +222,33 @@ const sharedRoutes = {
   },
 };
 
+Object.keys(sharedRoutes).forEach(routeName => {
+  const { navigationOptions } = sharedRoutes[routeName];
+
+  if (navigationOptions.header !== null) {
+    // fix headerForceInset if the header is not disabled
+    const headerForceInset = getHeaderForceInset(routeName);
+
+    if (typeof navigationOptions === 'function') {
+      const fn = navigationOptions;
+
+      sharedRoutes[routeName].navigationOptions = (...args) => ({
+        ...fn(...args),
+        headerForceInset,
+      });
+    } else {
+      navigationOptions.headerForceInset = headerForceInset;
+    }
+  }
+});
+
 const HomeStackNavigator = StackNavigator(
   {
     Events: {
       screen: EventsScreen,
       navigationOptions: {
         headerTitle: 'GitPoint',
+        headerForceInset: getHeaderForceInset('Events'),
       },
     },
     ...sharedRoutes,
```

**File**: `src/config/status-bar.js` (modified, +3/-0)
```diff
@@ -24,3 +24,6 @@ export const getStatusBarConfig = routeName =>
   lightScreens.includes(routeName)
     ? getLightStatusBar(routeName)
     : darkStatusBar;
+
+export const getHeaderForceInset = routeName =>
+  lightScreens.includes(routeName) ? { top: 'always', bottom: 'never' } : {};
```

---

### Incident Patch 10: `88390628` (2019-07-21)
**Commit Message**: fix(android): set forceInset for translucent status bar screens

**File**: `src/auth/screens/auth-profile.screen.js` (modified, +3/-1)
```diff
@@ -43,7 +43,9 @@ const mapDispatchToProps = dispatch =>
     dispatch
   );
 
-const StyledSafeAreaView = styled(SafeAreaView)`
+const StyledSafeAreaView = styled(SafeAreaView).attrs({
+  forceInset: { top: 'always', bottom: 'never' },
+})`
   background-color: ${colors.primaryDark};
 `;
 
```

**File**: `src/organization/screens/organization-profile.screen.js` (modified, +3/-1)
```diff
@@ -18,7 +18,9 @@ import {
 import { emojifyText, t, openURLInView } from 'utils';
 import { colors, fonts } from 'config';
 
-const StyledSafeAreaView = styled(SafeAreaView)`
+const StyledSafeAreaView = styled(SafeAreaView).attrs({
+  forceInset: { top: 'always', bottom: 'never' },
+})`
   background-color: ${colors.primaryDark};
 `;
 
```

**File**: `src/repository/screens/repository.screen.js` (modified, +3/-1)
```diff
@@ -63,7 +63,9 @@ const mapDispatchToProps = {
   getCommits,
 };
 
-const StyledSafeAreaView = styled(SafeAreaView)`
+const StyledSafeAreaView = styled(SafeAreaView).attrs({
+  forceInset: { top: 'always', bottom: 'never' },
+})`
   background-color: ${colors.primaryDark};
 `;
 
```

**File**: `src/user/screens/profile.screen.js` (modified, +3/-1)
```diff
@@ -58,7 +58,9 @@ const mapDispatchToProps = dispatch =>
     dispatch
   );
 
-const StyledSafeAreaView = styled(SafeAreaView)`
+const StyledSafeAreaView = styled(SafeAreaView).attrs({
+  forceInset: { top: 'always', bottom: 'never' },
+})`
   background-color: ${colors.primaryDark};
 `;
 
```

---

### Incident Patch 11: `738ab343` (2019-07-14)
**Commit Message**: fix: composeWithDevTools should not be used in production

**File**: `App.js` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ import { configureStore, persistor } from './root.store';
 
 const Container = styled.View`
   align-items: center;
-  background-color: ${colors.white}
+  background-color: ${colors.white};
   flex: 1;
   justify-content: center;
 `;
```

**File**: `root.reducer.js` (modified, +18/-1)
```diff
@@ -1,4 +1,9 @@
 import { combineReducers } from 'redux';
+import { persistReducer } from 'redux-persist';
+import createEncryptor from 'redux-persist-transform-encrypt';
+import md5 from 'md5';
+import DeviceInfo from 'react-native-device-info';
+import AsyncStorage from '@react-native-community/async-storage';
 import { authReducer } from 'auth';
 import { userReducer } from 'user';
 import { repositoryReducer } from 'repository';
@@ -7,7 +12,17 @@ import { issueReducer } from 'issue';
 import { notificationsReducer } from 'notifications';
 import { entities, pagination } from 'api/reducers';
 
-export const rootReducer = combineReducers({
+const encryptor = createEncryptor({
+  secretKey: md5(DeviceInfo.getUniqueID()),
+});
+const rootPersistConfig = {
+  key: 'root',
+  storage: AsyncStorage,
+  transforms: [encryptor],
+  whitelist: ['auth'],
+};
+
+const rootReducer = combineReducers({
   auth: authReducer,
   user: userReducer,
   repository: repositoryReducer,
@@ -17,3 +32,5 @@ export const rootReducer = combineReducers({
   entities,
   pagination,
 });
+
+export default persistReducer(rootPersistConfig, rootReducer);
```

**File**: `root.store.js` (modified, +15/-24)
```diff
@@ -1,25 +1,12 @@
 import { compose, createStore, applyMiddleware } from 'redux';
-import { persistReducer, persistStore } from 'redux-persist';
-import createEncryptor from 'redux-persist-transform-encrypt';
-import md5 from 'md5';
-import DeviceInfo from 'react-native-device-info';
-import AsyncStorage from '@react-native-community/async-storage';
+import { persistStore } from 'redux-persist';
 import Reactotron from 'reactotron-react-native'; // eslint-disable-line import/no-extraneous-dependencies
 import createLogger from 'redux-logger';
 import reduxThunk from 'redux-thunk';
 import { composeWithDevTools } from 'redux-devtools-extension';
 import 'config/reactotron';
-import { rootReducer } from './root.reducer';
+import rootReducer from './root.reducer';
 
-const encryptor = createEncryptor({
-  secretKey: md5(DeviceInfo.getUniqueID()),
-});
-const persistConfig = {
-  key: 'root',
-  storage: AsyncStorage,
-  transforms: [encryptor],
-  whitelist: ['auth'],
-};
 const getMiddleware = () => {
   const middlewares = [reduxThunk];
 
@@ -34,16 +21,20 @@ const getMiddleware = () => {
 
 let store;
 
-if (__DEV__ && process.env.TRON_ENABLED) {
-  store = Reactotron.createStore(
-    persistReducer(persistConfig, rootReducer),
-    compose(getMiddleware())
-  );
+if (__DEV__) {
+  if (process.env.TRON_ENABLED) {
+    store = Reactotron.createStore(
+      rootReducer,
+      compose(getMiddleware())
+    );
+  } else {
+    store = createStore(
+      rootReducer,
+      composeWithDevTools(getMiddleware())
+    );
+  }
 } else {
-  store = createStore(
-    persistReducer(persistConfig, rootReducer),
-    composeWithDevTools(getMiddleware())
-  );
+  store = createStore(rootReducer, compose(getMiddleware()));
 }
 
 export const configureStore = store;
```

---

### Incident Patch 12: `862c7c17` (2019-07-11)
**Commit Message**: fix(icon): fix no back icon

**File**: `metro.config.js` (modified, +0/-3)
```diff
@@ -4,8 +4,6 @@
  *
  * @format
  */
-const path = require('path');
-
 module.exports = {
   transformer: {
     getTransformOptions: async () => ({
@@ -14,6 +12,5 @@ module.exports = {
         inlineRequires: false,
       },
     }),
-    assetRegistryPath: path.resolve(__dirname, './AssetRegistry.js'),
   },
 };
```

---

### Incident Patch 13: `017d2e5f` (2019-07-10)
**Commit Message**: fix(android): disable AndroidX

**File**: `android/gradle.properties` (modified, +2/-2)
```diff
@@ -17,5 +17,5 @@
 # http://www.gradle.org/docs/current/userguide/multi_project_builds.html#sec:decoupled_projects
 # org.gradle.parallel=true
 
-android.useAndroidX=true
-android.enableJetifier=true
+# android.useAndroidX=true
+# android.enableJetifier=true
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@
     "react-native-linear-gradient": "^2.4.0",
     "react-native-material-design-searchbar": "^1.1.4",
     "react-native-parallax-scroll-view": "^0.20.1",
-    "react-native-photo-view": "chinesedfan/react-native-photo-view",
+    "react-native-photo-view": "^1.5.2",
     "react-native-safari-view": "^2.0.0",
     "react-native-search-bar": "^3.3.1",
     "react-native-simple-toast": "^0.0.8",
```

**File**: `yarn.lock` (modified, +3/-2)
```diff
@@ -9256,9 +9256,10 @@ react-native-parallax-scroll-view@^0.20.1:
   dependencies:
     prop-types "^15.6.0"
 
-react-native-photo-view@chinesedfan/react-native-photo-view:
+react-native-photo-view@^1.5.2:
   version "1.5.2"
-  resolved "https://codeload.github.com/chinesedfan/react-native-photo-view/tar.gz/f6527be033006a3a69da39cb221cf80bd0c4c9e4"
+  resolved "https://registry.yarnpkg.com/react-native-photo-view/-/react-native-photo-view-1.5.2.tgz#5d7f406ed5532a5a8a78c8ef8f40e81f688de1e2"
+  integrity sha1-XX9AbtVTKlqKeMjvj0DoH2iN4eI=
   dependencies:
     prop-types "^15.5.10"
 
```

---

### Incident Patch 14: `e119a74c` (2019-07-05)
**Commit Message**: fix(test): new way to integrate with async storage mock

**File**: `package.json` (modified, +1/-1)
```diff
@@ -161,7 +161,7 @@
       "./testenv.js"
     ],
     "transformIgnorePatterns": [
-      "node_modules/(?!(jest-)?react-native|react-navigation)"
+      "node_modules/(?!(jest-)?react-native|react-navigation|@react-native-community)"
     ],
     "moduleNameMapper": {
       "styled-components": "<rootDir>/node_modules/styled-components/dist/styled-components.native.cjs.js"
```

**File**: `testenv.js` (modified, +3/-0)
```diff
@@ -1,5 +1,6 @@
 import 'react-native';
 import 'react-native-mock';
+import mockAsyncStorage from '@react-native-community/async-storage/jest/async-storage-mock';
 import Enzyme from 'enzyme';
 import Adapter from 'enzyme-adapter-react-16';
 
@@ -26,6 +27,8 @@ jest.mock('react-native-i18n', () => {
   };
 });
 
+jest.mock('@react-native-community/async-storage', () => mockAsyncStorage);
+
 jest.mock('react-native-communications', () => ({
   web: jest.fn(),
   email: jest.fn(),
```

---

### Incident Patch 15: `df9cb657` (2019-07-04)
**Commit Message**: fix(navi): add SafeAreaView correctly (#884)

* fix: upgrade dep and wrap with SafeAreaView

* fix: fix margin top

* fix: add SafeAreaView in screen to fix top color

* feat: prepare for Android notch

**File**: `App.js` (modified, +7/-0)
```diff
@@ -7,6 +7,8 @@ import {
   StatusBar,
   Platform,
 } from 'react-native';
+import { SafeAreaView } from 'react-navigation';
+import DeviceInfo from 'react-native-device-info';
 import codePush from 'react-native-code-push';
 import { PersistGate } from 'redux-persist/integration/react';
 import { colors, getStatusBarConfig } from 'config';
@@ -30,6 +32,11 @@ if (console) {
   console.disableYellowBox = true; // eslint-disable-line no-console
 }
 
+if (Platform.OS === 'android' && DeviceInfo.hasNotch()) {
+  // FIXME: real value for status bar height + notch height
+  SafeAreaView.setStatusBarHeight(44);
+}
+
 class App extends Component {
   static async initLocale() {
     const locale = await getCurrentLocale();
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -72,7 +72,7 @@
     "react-native-communications": "^2.2.1",
     "react-native-config": "^0.6.0",
     "react-native-cookies": "^3.2.0",
-    "react-native-device-info": "^0.15.2",
+    "react-native-device-info": "^2.2.1",
     "react-native-elements": "^0.18.2",
     "react-native-htmlview": "^0.12.0",
     "react-native-i18n": "^2.0.4",
@@ -89,7 +89,7 @@
     "react-native-syntax-highlighter": "^1.2.1",
     "react-native-table-component": "^1.1.0",
     "react-native-vector-icons": "^4.4.0",
-    "react-navigation": "^1.0.0-beta.27",
+    "react-navigation": "^1.0.0",
     "react-redux": "^5.0.2",
     "react-syntax-highlighter": "^5.6.2",
     "redux": "^3.6.0",
```

**File**: `src/auth/screens/auth-profile.screen.js` (modified, +7/-0)
```diff
@@ -9,6 +9,7 @@ import {
   Dimensions,
 } from 'react-native';
 import { ListItem } from 'react-native-elements';
+import { SafeAreaView } from 'react-navigation';
 
 import {
   ViewContainer,
@@ -42,6 +43,10 @@ const mapDispatchToProps = dispatch =>
     dispatch
   );
 
+const StyledSafeAreaView = styled(SafeAreaView)`
+  background-color: ${colors.primaryDark};
+`;
+
 const Note = styled.Text`
   font-size: ${normalize(11)};
   color: ${colors.primaryDark};
@@ -108,6 +113,8 @@ class AuthProfile extends Component {
 
     return (
       <ViewContainer>
+        <StyledSafeAreaView />
+
         <ParallaxScroll
           renderContent={() => (
             <UserProfile
```

**File**: `src/components/parallax-scroll.component.js` (modified, +1/-2)
```diff
@@ -5,9 +5,8 @@ import { Icon } from 'react-native-elements';
 import styled from 'styled-components';
 
 import { colors, normalize, fonts } from 'config';
-import { isIphoneX } from 'utils';
 
-const STICKY_HEADER_HEIGHT = isIphoneX() ? 76 : 62;
+const STICKY_HEADER_HEIGHT = 44;
 
 type Props = {
   renderContent: any,
```

**File**: `src/components/repository-profile.component.js` (modified, +4/-2)
```diff
@@ -2,7 +2,7 @@ import React from 'react';
 import { StyleSheet, Text, View, Platform } from 'react-native';
 import { Icon } from 'react-native-elements';
 
-import { emojifyText, abbreviateNumber, t, isIphoneX } from 'utils';
+import { emojifyText, abbreviateNumber, t } from 'utils';
 import { colors, fonts, normalize } from 'config';
 
 type Props = {
@@ -95,7 +95,9 @@ const styles = StyleSheet.create({
   },
   languageInfo: {
     flexDirection: 'row',
-    top: isIphoneX() ? 46 : 35,
+    alignItems: 'center',
+    top: 0,
+    height: 44,
     position: 'absolute',
   },
   languageInfoTitle: {
```

**File**: `src/notifications/screens/notifications.screen.js` (modified, +10/-3)
```diff
@@ -4,8 +4,9 @@ import React, { Component } from 'react';
 import styled from 'styled-components';
 import { connect } from 'react-redux';
 import { bindActionCreators } from 'redux';
-import { FlatList, View, ScrollView, Platform } from 'react-native';
+import { FlatList, View, ScrollView } from 'react-native';
 import { ButtonGroup, Card, Icon } from 'react-native-elements';
+import { SafeAreaView } from 'react-navigation';
 
 import {
   Button,
@@ -14,7 +15,7 @@ import {
   NotificationListItem,
 } from 'components';
 import { colors, fonts, normalize } from 'config';
-import { isIphoneX, t } from 'utils';
+import { t } from 'utils';
 import {
   getUnreadNotifications,
   getParticipatingNotifications,
@@ -52,9 +53,13 @@ const mapDispatchToProps = dispatch =>
     dispatch
   );
 
+const StyledSafeAreaView = styled(SafeAreaView)`
+  background-color: ${colors.greyLight};
+`;
+
 const ButtonGroupWrapper = styled.View`
   background-color: ${colors.greyLight};
-  padding-top: ${Platform.OS === 'ios' ? (isIphoneX() ? 40 : 30) : 10};
+  padding-top: 10;
   padding-bottom: 10;
   margin-bottom: 15;
 `;
@@ -441,6 +446,8 @@ class Notifications extends Component {
     return (
       <ViewContainer>
         <Container>
+          <StyledSafeAreaView />
+
           <ButtonGroupWrapper>
             <StyledButtonGroup
               onPress={this.switchType}
```

**File**: `src/organization/screens/organization-profile.screen.js` (modified, +7/-0)
```diff
@@ -4,6 +4,7 @@ import { connect } from 'react-redux';
 import { RefreshControl, ActivityIndicator } from 'react-native';
 import { ListItem } from 'react-native-elements';
 import ActionSheet from 'react-native-actionsheet';
+import { SafeAreaView } from 'react-navigation';
 import { RestClient } from 'api';
 import {
   ViewContainer,
@@ -17,6 +18,10 @@ import {
 import { emojifyText, t, openURLInView } from 'utils';
 import { colors, fonts } from 'config';
 
+const StyledSafeAreaView = styled(SafeAreaView)`
+  background-color: ${colors.primaryDark};
+`;
+
 const DescriptionListItem = styled(ListItem).attrs({
   subtitleStyle: {
     color: colors.greyDark,
@@ -113,6 +118,8 @@ class OrganizationProfile extends Component {
 
     return (
       <ViewContainer>
+        <StyledSafeAreaView />
+
         <ParallaxScroll
           renderContent={() => (
             <UserProfile
```

**File**: `src/repository/screens/repository.screen.js` (modified, +7/-0)
```diff
@@ -5,6 +5,7 @@ import styled from 'styled-components';
 import { RefreshControl, Share, ActivityIndicator } from 'react-native';
 import { ListItem } from 'react-native-elements';
 import ActionSheet from 'react-native-actionsheet';
+import { SafeAreaView } from 'react-navigation';
 import { v3, RestClient } from 'api';
 import {
   ViewContainer,
@@ -62,6 +63,10 @@ const mapDispatchToProps = {
   getCommits,
 };
 
+const StyledSafeAreaView = styled(SafeAreaView)`
+  background-color: ${colors.primaryDark};
+`;
+
 const LoadingMembersContainer = styled.View`
   padding: 5px;
 `;
@@ -269,6 +274,8 @@ class Repository extends Component {
 
     return (
       <ViewContainer>
+        <StyledSafeAreaView />
+
         <ParallaxScroll
           renderContent={() => {
             if (isPendingRepository) {
```

#### Recent Merged Pull Requests:
- **PR #951** (closed): GithudMErGE (@kiseCrow)
- **PR #922** (2020-10-31): Updated Dutch translations (@eliottha)
- **PR #921** (2020-10-31): Adding Indonesia Translation (@raihan71)
- **PR #918** (closed): chore(deps): bump handlebars from 4.1.2 to 4.7.6 (@dependabot[bot])
- **PR #917** (closed): chore(deps): bump lodash from 4.17.5 to 4.17.19 (@dependabot[bot])
- **PR #914** (closed): chore(deps): bump handlebars from 4.1.2 to 4.5.3 (@dependabot[bot])
- **PR #912** (2019-11-11): test: Add repository and organization actions tests (@nersoh)
- **PR #911** (2019-11-06): fix: provide real safe area view (@chinesedfan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
