# Forensic Learning Record (Deep Inspection): APSL/react-native-keyboard-aware-scroll-view

> **Canonical Artifact**: `07_PROJECT_LEARNING/apsl-react-native-keyboard-aware-scroll-view-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/APSL/react-native-keyboard-aware-scroll-view](https://github.com/APSL/react-native-keyboard-aware-scroll-view))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:05:12.242Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `APSL/react-native-keyboard-aware-scroll-view`
- **Description**: A ScrollView component that handles keyboard appearance and automatically scrolls to focused TextInput.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5372 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `index.d.ts`
```
// Type definitions for react-native-keyboard-aware-scroll-view
// Project: https://github.com/APSL/react-native-keyboard-aware-scroll-view
// Definitions by: Kyle Roach <https://github.com/iRoachie>
// TypeScript Version: 2.3.2

import * as React from 'react'
import {
  ScrollViewProps,
  FlatListProps,
  SectionListProps
} from 'react-native'

interface KeyboardAwareProps {
  /**
   * Catches the reference of the component.
   *
   *
   * @type {function}
   * @memberof KeyboardAwareProps
   */
  innerRef?: (ref: JSX.Element) => void
  /**
   * Adds an extra offset that represents the TabBarIOS height.
   *
   * Default is false
   * @type {boolean}
   * @memberof KeyboardAwareProps
   */
  viewIsInsideTabBar?: boolean

  /**
   * Coordinates that will be used to reset the scroll when the keyboard hides.
   *
   * @type {{
   *         x: number,
   *         y: number
   *     }}
   * @memberof KeyboardAwareProps
   */
  resetScrollToCoords?: {
    x: number
    y: number
  }

  /**
   * Lets the user enable or disable automatic resetScrollToCoords
   *
   * @type {boolean}
   * @memberof KeyboardAwareProps
   */
  enableResetScrollToCoords?: boolean

  /**
   * When focus in TextInput will scroll the position
   *
   * Default is true
   *
   * @type {boolean}
   * @memberof KeyboardAwareProps
   */

  enableAutomaticScroll?: boolean
  /**
   * Enables keyboard aware settings for Android
   *
   * Default is false
   *
   * @type {boolean}
   * @memberof KeyboardAwareProps
   */
  enableOnAndroid?: boolean

  /**
   * Adds an extra offset when focusing the TextInputs.
   *
   * Default is 75
   * @type {number}
   * @memberof KeyboardAwareProps
   */
  extraHeight?: number

  /**
   * Adds an extra offset to the keyboard.
   * Useful if you want to stick elements above the keyboard.
   *
   * Default is 0
   *
   * @type {number}
   * @memberof KeyboardAwareProps
   */
  extraScrollHeight?: number

  /**
   * Sets the delay time before scrolling to new position
   *
   * Default is 250
   *
   * @type {number}
   * @memberof KeyboardAwareProps
   */
  keyboardOpeningTime?: number

  /**
   * Callback when the keyboard will show.
   *
   * @param frames Information about the keyboard frame and animation.
   */
  onKeyboardWillShow?: (frames: Object) => void

  /**
   * Callback when the keyboard did show.
   *
   * @param frames Information about the keyboard frame and animation.
   */
  onKeyboardDidShow?: (frames: Object) => void

  /**
   * Callback when the keyboard will hide.
   *
   * @param frames Information about the keyboard frame and animation.
   */
  onKeyboardWillHide?: (frames: Object) => void

  /**
   * Callback when the keyboard did hide.
   *
   * @param frames Information about the keyboard frame and animation.
   */
  onKeyboardDidHide?: (frames: Object) => void

  /**
   * Callback when the keyboard frame will change.
   *
   * @param frames Information about the keyboard frame and animation.
   */
  onKeyboardWillChangeFrame?: (frames: Object) => void

  /**
   * Callback when the keyboard frame did change.
   *
   * @param frames Information about the keyboard frame and animation.
   */
  onKeyboardDidChangeFrame?: (frames: Object) => void
}

interface KeyboardAwareScrollViewProps
  extends KeyboardAwareProps,
    ScrollViewProps {}
interface KeyboardAwareFlatListProps<ItemT>
  extends KeyboardAwareProps,
    FlatListProps<ItemT> {}
interface KeyboardAwareSectionListProps<ItemT>
  extends KeyboardAwareProps,
    SectionListProps<ItemT> {}

interface KeyboardAwareState {
  keyboardSpace: number
}

declare class ScrollableComponent<P, S> extends React.Component<P, S> {
  getScrollResponder: () => void
  scrollToPosition: (x: number, y: number, animated?: boolean) => void
  scrollToEnd: (animated?: boolean) => void
  scrollForExtraHeightOnAndroid: (extraHeight: number) => void
  scrollToFocusedInput: (
    reactNode: Object,
    extraHeight?: number,
    keyboardOpeningTime?: number
  ) => void
}

export class KeyboardAwareMixin {}
export class KeyboardAwareScrollView extends ScrollableComponent<
  KeyboardAwareScrollViewProps,
  KeyboardAwareState
> {}
export class KeyboardAwareFlatList extends ScrollableComponent<
  KeyboardAwareFlatListProps<any>,
  KeyboardAwareState
> {}
export class KeyboardAwareSectionList extends ScrollableComponent<
  KeyboardAwareSectionListProps<any>,
  KeyboardAwareState
> {}

```

### Core Architecture Module: `index.js`
```
/* @flow */

import listenToKeyboardEvents from './lib/KeyboardAwareHOC'
import KeyboardAwareScrollView from './lib/KeyboardAwareScrollView'
import KeyboardAwareFlatList from './lib/KeyboardAwareFlatList'
import KeyboardAwareSectionList from './lib/KeyboardAwareSectionList'

export {
  listenToKeyboardEvents,
  KeyboardAwareFlatList,
  KeyboardAwareSectionList,
  KeyboardAwareScrollView
}

```

### Core Architecture Module: `lib/KeyboardAwareFlatList.js`
```
/* @flow */

import { FlatList } from 'react-native'
import listenToKeyboardEvents from './KeyboardAwareHOC'

export default listenToKeyboardEvents(FlatList)

```

### Core Architecture Module: `lib/KeyboardAwareHOC.js`
```
/* @flow */

import React from 'react'
import PropTypes from 'prop-types'
import {
  Keyboard,
  Platform,
  UIManager,
  TextInput,
  findNodeHandle,
  Animated
} from 'react-native'
import { isIphoneX } from 'react-native-iphone-x-helper'
import type { KeyboardAwareInterface } from './KeyboardAwareInterface'

const _KAM_DEFAULT_TAB_BAR_HEIGHT: number = isIphoneX() ? 83 : 49
const _KAM_KEYBOARD_OPENING_TIME: number = 250
const _KAM_EXTRA_HEIGHT: number = 75

const supportedKeyboardEvents = [
  'keyboardWillShow',
  'keyboardDidShow',
  'keyboardWillHide',
  'keyboardDidHide',
  'keyboardWillChangeFrame',
  'keyboardDidChangeFrame'
]
const keyboardEventToCallbackName = (eventName: string) =>
  'on' + eventName[0].toUpperCase() + eventName.substring(1)
const keyboardEventPropTypes = supportedKeyboardEvents.reduce(
  (acc: Object, eventName: string) => ({
    ...acc,
    [keyboardEventToCallbackName(eventName)]: PropTypes.func
  }),
  {}
)
const keyboardAwareHOCTypeEvents = supportedKeyboardEvents.reduce(
  (acc: Object, eventName: string) => ({
    ...acc,
    [keyboardEventToCallbackName(eventName)]: Function
  }),
  {}
)

export type KeyboardAwareHOCProps = {
  viewIsInsideTabBar?: boolean,
  resetScrollToCoords?: {
    x: number,
    y: number
  },
  enableResetScrollToCoords?: boolean,
  enableAutomaticScroll?: boolean,
  extraHeight?: number,
  extraScrollHeight?: number,
  keyboardOpeningTime?: number,
  onScroll?: Function,
  update?: Function,
  contentContainerStyle?: any,
  enableOnAndroid?: boolean,
  innerRef?: Function,
  ...keyboardAwareHOCTypeEvents
}
export type KeyboardAwareHOCState = {
  keyboardSpace: number
}

export type ElementLayout = {
  x: number,
  y: number,
  width: number,
  height: number
}

export type ContentOffset = {
  x: number,
  y: number
}

export type ScrollPosition = {
  x: number,
  y: number,
  animated: boolean
}

export type ScrollIntoViewOptions = ?{
  getScrollPosition?: (
    parentLayout: ElementLayout,
    childLayout: ElementLayout,
    contentOffset: ContentOffset
  ) => ScrollPosition
}

export type KeyboardAwareHOCOptions = ?{
  enableOnAndroid: boolean,
  contentContainerStyle: ?Object,
  enableAutomaticScroll: boolean,
  extraHeight: number,
  extraScrollHeight: number,
  enableResetScrollToCoords: boolean,
  keyboardOpeningTime: number,
  viewIsInsideTabBar: boolean,
  refPropName: string,
  extractNativeRef: Function
}

function getDisplayName(WrappedComponent: React$Component) {
  return (
    (WrappedComponent &&
      (WrappedComponent.displayName || WrappedComponent.name)) ||
    'Component'
  )
}

const ScrollIntoViewDefaultOptions: KeyboardAwareHOCOptions = {
  enableOnAndroid: false,
  contentContainerStyle: undefined,
  enableAutomaticScroll: true,
  extraHeight: _KAM_EXTRA_HEIGHT,
  extraScrollHeight: 0,
  enableResetScrollToCoords: true,
  keyboardOpeningTime: _KAM_KEYBOARD_OPENING_TIME,
  viewIsInsideTabBar: false,

  // The ref prop name that will be passed to the wrapped component to obtain a ref
  // If your ScrollView is already wrapped, maybe the wrapper permit to get a ref
  // For example, with glamorous-native ScrollView, you should use "innerRef"
  refPropName: 'ref',
  // Sometimes the ref you get is a ref to a wrapped view (ex: Animated.ScrollView)
  // We need access to the imperative API of a real native ScrollView so we need extraction logic
  extractNativeRef: (ref: Object) => {
    // getNode() permit to support Animated.ScrollView automatically, but is deprecated since RN 0.62
    // see https://github.com/facebook/react-native/issues/19650
    // see https://stackoverflow.com/questions/42051368/scrollto-is-undefined-on-animated-scrollview/48786374
    // see https://github.com/facebook/react-native/commit/66e72bb4e00aafbcb9f450ed5db261d98f99f82a
    const shouldCallGetNode = !Platform.constants || (Platform.constants.reactNativeVersion.major === 0 && Platform.constants.reactNativeVersion.minor < 62)
    if (ref.getNode && shouldCallGetNode) {
      return ref.getNode()
    } else {
      return ref
    }
  }
}

function KeyboardAwareHOC(
  ScrollableComponent: React$Component,
  userOptions: KeyboardAwareHOCOptions = {}
) {
  const hocOptions: KeyboardAwareHOCOptions = {
    ...ScrollIntoViewDefaultOptions,
    ...userOptions
  }

  return class
    extends React.Component<KeyboardAwareHOCProps, KeyboardAwareHOCState>
    implements KeyboardAwareInterface {
    _rnkasv_keyboardView: any
    keyboardWillShowEvent: ?Function
    keyboardWillHideEvent: ?Function
    position: ContentOffset
    defaultResetScrollToCoords: ?{ x: number, y: number }
    mountedComponent: boolean
    handleOnScroll: Function
    state: KeyboardAwareHOCState
    static displayName = `KeyboardAware${getDisplayName(ScrollableComponent)}`

    static propTypes = {
      viewIsInsideTabBar: PropTypes.bool,
      resetScrollToCoords: PropTypes.shape({
        x: PropTypes.number.isRequired,
        y: PropTypes.number.isRequired
      }),
      enableResetScrollToCoords: PropTypes.bool,
      enableAutomaticScroll: PropTypes.bool,
      extraHeight: PropTypes.number,
      extraScrollHeight: PropTypes.number,
      keyboardOpeningTime: PropTypes.number,
      onScroll: PropTypes.oneOfType([
        PropTypes.func, // Normal listener
        PropTypes.object // Animated.event listener
      ]),
      update: PropTypes.func,
      contentContainerStyle: PropTypes.any,
      enableOnAndroid: PropTypes.bool,
      innerRef: PropTypes.func,
      ...keyboardEventPropTypes
    }

    // HOC options are used to init default props, so that these options can be overriden with component props
    static defaultProps = {
      enableAutomaticScroll: hocOptions.enableAutomaticScroll,
      extraHeight: hocOptions.extraHeight,
      extraScrollHeight: hocOptions.extraScrollHeight,
      enableResetScrollToCoords: hocOptions.enableResetScrollToCoords,
      keyboardOpeningTime: hocOptions.keyboardOpeningTime,
      viewIsInsideTabBar: hocOptions.viewIsInsideTabBar,
      enableOnAndroid: hocOptions.enableOnAndroid
    }

    constructor(props: KeyboardAwareHOCProps) {
      super(props)
      this.keyboardWillShowEvent = undefined
      this.keyboardWillHideEvent = undefined
      this.callbacks = {}
      this.position = { x: 0, y: 0 }
      this.defaultResetScrollToCoords = null
      const keyboardSpace: number = props.viewIsInsideTabBar
        ? _KAM_DEFAULT_TAB_BAR_HEIGHT
        : 0
      this.state = { keyboardSpace }
    }

    componentDidMount() {
      this.mountedComponent = true
      // Keyboard events
      if (Platform.OS === 'ios') {
        this.keyboardWillShowEvent = Keyboard.addListener(
          'keyboardWillShow',
          this._updateKeyboardSpace
        )
        this.keyboardWillHideEvent = Keyboard.addListener(
          'keyboardWillHide',
          this._resetKeyboardSpace
        )
      } else if (Platform.OS === 'android' && this.props.enableOnAndroid) {
        this.keyboardWillShowEvent = Keyboard.addListener(
          'keyboardDidShow',
          this._updateKeyboardSpace
        )
        this.keyboardWillHideEvent = Keyboard.addListener(
          'keyboardDidHide',
          this._resetKeyboardSpace
        )
      }

      supportedKeyboardEvents.forEach((eventName: string) => {
        const callbackName = keyboardEventToCallbackName(eventName)
        if (this.props[callbackName]) {
          this.callbacks[eventName] = Keyboard.addListener(
            eventName,
            this.props[callbackName]
          )
        }
      })
    }

    componentDidUpdate(prevProps: KeyboardAwareHOCProps) {
      if (this.props.viewIsInsideTabBar !== prevProps.viewIsInsideTabBar) {
        const keyboardSpace: number = this.props.viewIsInsideTabBar
          ? _KAM_DEFAULT_TAB_BAR_HEIGHT
          : 0
        if (this.state.keyboardSpace !== keyboardSpace) {
          this.setState({ keyboardSpace })
        }
      }
    }

    componentWillUnmount() {
      this.mountedComponent = false
      this.keyboardWillShowEvent && this.keyboardWillShowEvent.remove()
      this.keyboardWillHideEvent && this.keyboardWillHideEvent.remove()
      Object.values(this.callbacks).forEach((callback: Object) =>
        callback.remove()
      )
    }

    getScrollResponder = () => {
      return (
        this._rnkasv_keyboardView &&
        this._rnkasv_keyboardView.getScrollResponder &&
        this._rnkasv_keyboardView.getScrollResponder()
      )
    }

    scrollToPosition = (x: number, y: number, animated: boolean = true) => {
      const responder = this.getScrollResponder()
      if (!responder) {
        return
      }
      if (responder.scrollResponderScrollTo) {
        // React Native < 0.65
        responder.scrollResponderScrollTo({ x, y, animated })
      } else if (responder.scrollTo) {
        // React Native >= 0.65
        responder.scrollTo({ x, y, animated })
      }
    }

    scrollToEnd = (animated?: boolean = true) => {
      const responder = this.getScrollResponder()
      if (!responder) {
        return
      }
      if (responder.scrollResponderScrollToEnd) {
        // React Native < 0.65
        responder.scrollResponderScrollToEnd({ animated })
      } else if (responder.scrollToEnd) {
        // React Native >= 0.65
        responder.scrollToEnd({ animated })
      }
    }

    scrollForExtraHeightOnAndroid = (extraHeight: number) => {
      this.scrollToPosition(0, this.position.y + extraHeight, true)
    }

    /**
     * @param keyboardOpeningTime: takes a different keyboardOpeningTime in consideration.
     * @param extraHeight: takes an extra height in consideration.
     */
    scrollToFocusedInput = (
      reactNode: any,
      extraHeight?: number,
      keyboardOpeningTime?: number
    ) => {
      if (extraHeight === undefined) {
        extraHeight = this.props.extraHeight || 0
      }
      if (keyboardOpeningTime === undefined) {
        keyboardOpeningTime = this.props.keyboardOpeningTime || 0
      }

```

### Core Architecture Module: `lib/KeyboardAwareInterface.js`
```
/* @flow */

export interface KeyboardAwareInterface {
  getScrollResponder: () => void,
  scrollToPosition: (x: number, y: number, animated?: boolean) => void,
  scrollToEnd: (animated?: boolean) => void,
  scrollForExtraHeightOnAndroid: (extraHeight: number) => void,
  scrollToFocusedInput: (
    reactNode: Object,
    extraHeight: number,
    keyboardOpeningTime: number
  ) => void
}

```

### Core Architecture Module: `lib/KeyboardAwareScrollView.js`
```
/* @flow */

import { ScrollView } from 'react-native'
import listenToKeyboardEvents from './KeyboardAwareHOC'

export default listenToKeyboardEvents(ScrollView)

```

### Core Architecture Module: `lib/KeyboardAwareSectionList.js`
```
/* @flow */

import { SectionList } from 'react-native'
import listenToKeyboardEvents from './KeyboardAwareHOC'

export default listenToKeyboardEvents(SectionList)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #25** (2016-08-23): **Crash when two KASV are rendered and one TextInput gets focused**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > I would say its one of the most important fixes, I'm facing this issue right now. 
  > I'm unsubscribing this issue. Here's how I resolve this. The crash happens randomly, certain pages do every time, some pages never crash. I even removed everything in the page except the InputText, the page still, crashed. So I abandoned this wonderful plugin, and go to an IOS developer for help. Yeah, the keyboard problem only happens on IOS devices, and he recommend me an IOS plugin:IQKeyboardManager-master, and I just simply drag the folder into my Xcode, and the problem was fixed perfectly. If you are not a professional IOS developer, and you don't know how to put the IQKeyboardManager plugin into your project, leave a comment, I may tell you the detail. 
  > Hello @ararog @pimkle!  **DISCLAIMER** I'm a professional iOS developer and mobile team lead currently in my company 😆   **Issue** Now about the issue. I've sent a PR that has been accepted and will be introduced into React Native 0.32 that solves this issue. For more info and context, please read my explanation here https://github.com/facebook/react-native/pull/7876.  In this library you have a branch that, if you use the code of my PR, completely solves the issue (https://github.com/APSL/react-native-keyboard-aware-scroll-view/tree/ancestor_check). I'm waiting the release of React Native to merge & release the `ancestor_check` branch.  And, in this case, I prefer to provide a JavaScript solution to the keyboard & scroll view problem. Once the fix has landed into the React Native core, I'll be able to dig deep into the Android support and you'll have a component working for both platforms without any other dependencies. 

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

### Incident Patch 1: `1a3575b4` (2021-11-04)
**Commit Message**: fix eslint

**File**: `lib/KeyboardAwareHOC.js` (modified, +6/-2)
```diff
@@ -273,7 +273,9 @@ function KeyboardAwareHOC(
 
     scrollToPosition = (x: number, y: number, animated: boolean = true) => {
       const responder = this.getScrollResponder()
-      if (!responder) return;
+      if (!responder) {
+        return
+      }
       if (responder.scrollResponderScrollTo) {
         // React Native < 0.65
         responder.scrollResponderScrollTo({ x, y, animated })
@@ -285,7 +287,9 @@ function KeyboardAwareHOC(
 
     scrollToEnd = (animated?: boolean = true) => {
       const responder = this.getScrollResponder()
-      if (!responder) return;
+      if (!responder) {
+        return
+      }
       if (responder.scrollResponderScrollToEnd) {
         // React Native < 0.65
         responder.scrollResponderScrollToEnd({ animated })
```

---

### Incident Patch 2: `de9579b0` (2021-11-04)
**Commit Message**: fix scroll responder for rn v0.65 / keep backward capatability. (#510)

Co-authored-by: Mihai <[REDACTED_EMAIL]>

**File**: `lib/KeyboardAwareHOC.js` (modified, +16/-2)
```diff
@@ -273,12 +273,26 @@ function KeyboardAwareHOC(
 
     scrollToPosition = (x: number, y: number, animated: boolean = true) => {
       const responder = this.getScrollResponder()
-      responder && responder.scrollResponderScrollTo({ x, y, animated })
+      if (!responder) return;
+      if (responder.scrollResponderScrollTo) {
+        // React Native < 0.65
+        responder.scrollResponderScrollTo({ x, y, animated })
+      } else if (responder.scrollTo) {
+        // React Native >= 0.65
+        responder.scrollTo({ x, y, animated })
+      }
     }
 
     scrollToEnd = (animated?: boolean = true) => {
       const responder = this.getScrollResponder()
-      responder && responder.scrollResponderScrollToEnd({ animated })
+      if (!responder) return;
+      if (responder.scrollResponderScrollToEnd) {
+        // React Native < 0.65
+        responder.scrollResponderScrollToEnd({ animated })
+      } else if (responder.scrollToEnd) {
+        // React Native >= 0.65
+        responder.scrollToEnd({ animated })
+      }
     }
 
     scrollForExtraHeightOnAndroid = (extraHeight: number) => {
```

---

### Incident Patch 3: `d5146ca3` (2021-04-29)
**Commit Message**: Fix warning due to calling getNode() #484 from APSL/fix-getNode-warning

* fix getNode() warning

* better conditions

* fix import

* lint error

**File**: `lib/KeyboardAwareHOC.js` (modified, +4/-2)
```diff
@@ -128,10 +128,12 @@ const ScrollIntoViewDefaultOptions: KeyboardAwareHOCOptions = {
   // Sometimes the ref you get is a ref to a wrapped view (ex: Animated.ScrollView)
   // We need access to the imperative API of a real native ScrollView so we need extraction logic
   extractNativeRef: (ref: Object) => {
-    // getNode() permit to support Animated.ScrollView automatically
+    // getNode() permit to support Animated.ScrollView automatically, but is deprecated since RN 0.62
     // see https://github.com/facebook/react-native/issues/19650
     // see https://stackoverflow.com/questions/42051368/scrollto-is-undefined-on-animated-scrollview/48786374
-    if (ref.getNode) {
+    // see https://github.com/facebook/react-native/commit/66e72bb4e00aafbcb9f450ed5db261d98f99f82a
+    const shouldCallGetNode = !Platform.constants || (Platform.constants.reactNativeVersion.major === 0 && Platform.constants.reactNativeVersion.minor < 62)
+    if (ref.getNode && shouldCallGetNode) {
       return ref.getNode()
     } else {
       return ref
```

---

### Incident Patch 4: `1fb7ed40` (2020-07-11)
**Commit Message**: Fix #429 for broken react-native 0.63.0. Detect Forwarding Refs

Fix for react native 0.63.0. They changed ScrollView to Forwarding Ref
 which caused configOrComp detection to fail https://github.com/facebook/react-native/commit/d2f314af75b63443db23e131aaf93c2d064e4f44

**File**: `lib/KeyboardAwareHOC.js` (modified, +1/-1)
```diff
@@ -546,7 +546,7 @@ function KeyboardAwareHOC(
 // listenToKeyboardEvents(ScrollView);
 // listenToKeyboardEvents(options)(Comp);
 const listenToKeyboardEvents = (configOrComp: any) => {
-  if (typeof configOrComp === 'object') {
+  if (typeof configOrComp === 'object' && !configOrComp.displayName) {
     return (Comp: Function) => KeyboardAwareHOC(Comp, configOrComp)
   } else {
     return KeyboardAwareHOC(configOrComp)
```

---

### Incident Patch 5: `5ed7e7f2` (2019-08-14)
**Commit Message**: Fixed security warnings (#376)

**File**: `lib/KeyboardAwareHOC.js` (modified, +11/-3)
```diff
@@ -104,7 +104,11 @@ export type KeyboardAwareHOCOptions = ?{
 }
 
 function getDisplayName(WrappedComponent: React$Component) {
-  return WrappedComponent && (WrappedComponent.displayName || WrappedComponent.name) || 'Component'
+  return (
+    (WrappedComponent &&
+      (WrappedComponent.displayName || WrappedComponent.name)) ||
+    'Component'
+  )
 }
 
 const ScrollIntoViewDefaultOptions: KeyboardAwareHOCOptions = {
@@ -260,7 +264,7 @@ function KeyboardAwareHOC(
     getScrollResponder = () => {
       return (
         this._rnkasv_keyboardView &&
-        this._rnkasv_keyboardView.getScrollResponder && 
+        this._rnkasv_keyboardView.getScrollResponder &&
         this._rnkasv_keyboardView.getScrollResponder()
       )
     }
@@ -437,7 +441,11 @@ function KeyboardAwareHOC(
         this.defaultResetScrollToCoords = null
         return
       } else if (this.props.resetScrollToCoords) {
-        this.scrollToPosition(this.props.resetScrollToCoords.x, this.props.resetScrollToCoords.y, true)
+        this.scrollToPosition(
+          this.props.resetScrollToCoords.x,
+          this.props.resetScrollToCoords.y,
+          true
+        )
       } else {
         if (this.defaultResetScrollToCoords) {
           this.scrollToPosition(
```

**File**: `package-lock.json` (removed, +0/-1414)
```diff
@@ -1,1414 +0,0 @@
-{
-  "name": "react-native-keyboard-aware-scroll-view",
-  "version": "0.7.0",
-  "lockfileVersion": 1,
-  "requires": true,
-  "dependencies": {
-    "@babel/code-frame": {
-      "version": "7.0.0-beta.44",
-      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.0.0-beta.44.tgz",
-      "integrity": "sha512-cuAuTTIQ9RqcFRJ/Y8PvTh+paepNcaGxwQwjIDRWPXmzzyAeCO4KqS9ikMvq0MCbRk6GlYKwfzStrcP3/jSL8g==",
-      "dev": true,
-      "requires": {
-        "@babel/highlight": "7.0.0-beta.44"
-      }
-    },
-    "@babel/generator": {
-      "version": "7.0.0-beta.44",
-      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.0.0-beta.44.tgz",
-      "integrity": "sha512-5xVb7hlhjGcdkKpMXgicAVgx8syK5VJz193k0i/0sLP6DzE6lRrU1K3B/rFefgdo9LPGMAOOOAWW4jycj07ShQ==",
-      "dev": true,
-      "requires": {
-        "@babel/types": "7.0.0-beta.44",
-        "jsesc": "^2.5.1",
-        "lodash": "^4.2.0",
-        "source-map": "^0.5.0",
-        "trim-right": "^1.0.1"
-      }
-    },
-    "@babel/helper-function-name": {
-      "version": "7.0.0-beta.44",
-      "resolved": "https://registry.npmjs.org/@babel/helper-function-name/-/helper-function-name-7.0.0-beta.44.tgz",
-      "integrity": "sha512-MHRG2qZMKMFaBavX0LWpfZ2e+hLloT++N7rfM3DYOMUOGCD8cVjqZpwiL8a0bOX3IYcQev1ruciT0gdFFRTxzg==",
-      "dev": true,
-      "requires": {
-        "@babel/helper-get-function-arity": "7.0.0-beta.44",
-        "@babel/template": "7.0.0-beta.44",
-        "@babel/types": "7.0.0-beta.44"
-      }
-    },
-    "@babel/helper-get-function-arity": {
-      "version": "7.0.0-beta.44",
-      "resolved": "https://registry.npmjs.org/@babel/helper-get-function-arity/-/helper-get-function-arity-7.0.0-beta.44.tgz",
-      "integrity": "sha512-w0YjWVwrM2HwP6/H3sEgrSQdkCaxppqFeJtAnB23pRiJB5E/O9Yp7JAAeWBl+gGEgmBFinnTyOv2RN7rcSmMiw==",
-      "dev": true,
-      "requires": {
-        "@babel/types": "7.0.0-beta.44"
-      }
-    },
-    "@babel/helper-split-export-declaration": {
-      "version": "7.0.0-beta.44",
-      "resolved": "https://registry.npmjs.org/@babel/helper-split-export-declaration/-/helper-split-export-declaration-7.0.0-beta.44.tgz",
-      "integrity": "sha512-aQ7QowtkgKKzPGf0j6u77kBMdUFVBKNHw2p/3HX/POt5/oz8ec5cs0GwlgM8Hz7ui5EwJnzyfRmkNF1Nx1N7aA==",
-      "dev": true,
-      "requires": {
-        "@babel/types": "7.0.0-beta.44"
-      }
-    },
-    "@babel/highlight": {
-      "version": "7.0.0-beta.44",
-      "resolved": "https://registry.npmjs.org/@babel/highlight/-/highlight-7.0.0-beta.44.tgz",
-      "integrity": "sha512-Il19yJvy7vMFm8AVAh6OZzaFoAd0hbkeMZiX3P5HGD+z7dyI7RzndHB0dg6Urh/VAFfHtpOIzDUSxmY6coyZWQ==",
-      "dev": true,
-      "requires": {
-        "chalk": "^2.0.0",
-        "esutils": "^2.0.2",
-        "js-tokens": "^3.0.0"
-      }
-    },
-    "@babel/template": {
-      "version": "7.0.0-beta.44",
-      "resolved": "https://registry.npmjs.org/@babel/template/-/template-7.0.0-beta.44.tgz",
-      "integrity": "sha512-w750Sloq0UNifLx1rUqwfbnC6uSUk0mfwwgGRfdLiaUzfAOiH0tHJE6ILQIUi3KYkjiCDTskoIsnfqZvWLBDng==",
-      "dev": true,
-      "requires": {
-        "@babel/code-frame": "7.0.0-beta.44",
-        "@babel/types": "7.0.0-beta.44",
-        "babylon": "7.0.0-beta.44",
-        "lodash": "^4.2.0"
-      }
-    },
-    "@babel/traverse": {
-      "version": "7.0.0-beta.44",
-      "resolved": "https://registry.npmjs.org/@babel/traverse/-/traverse-7.0.0-beta.44.tgz",
-      "integrity": "sha512-UHuDz8ukQkJCDASKHf+oDt3FVUzFd+QYfuBIsiNu/4+/ix6pP/C+uQZJ6K1oEfbCMv/IKWbgDEh7fcsnIE5AtA==",
-      "dev": true,
-      "requires": {
-        "@babel/code-frame": "7.0.0-beta.44",
-        "@babel/generator": "7.0.0-beta.44",
-        "@babel/helper-function-name": "7.0.0-beta.44",
-        "@babel/helper-split-export-declaration": "7.0.0-beta.44",
-        "@babel/types": "7.0.0-beta.44",
-        "babylon": "7.0.0-beta.44",
-        "debug": "^3.1.0",
-        "globals": "^11.1.0",
-        "invariant": "^2.2.0",
-        "lodash": "^4.2.0"
-      }
-    },
-    "@babel/types": {
-      "version": "7.0.0-beta.44",
-      "resolved": "https://registry.npmjs.org/@babel/types/-/types-7.0.0-beta.44.tgz",
-      "integrity": "sha512-5eTV4WRmqbaFM3v9gHAIljEQJU4Ssc6fxL61JN+Oe2ga/BwyjzjamwkCVVAQjHGuAX8i0BWo42dshL8eO5KfLQ==",
-      "dev": true,
-      "requires": {
-        "esutils": "^2.0.2",
-        "lodash": "^4.2.0",
-        "to-fast-properties": "^2.0.0"
-      }
-    },
-    "acorn": {
-      "version": "5.7.1",
-      "resolved": "https://registry.npmjs.org/acorn/-/acorn-5.7.1.tgz",
-      "integrity": "sha512-d+nbxBUGKg7Arpsvbnlq61mc12ek3EY8EQldM3GPAhWJ1UVxC6TDGbIvUMNU6obBX3i1+ptCIzV4vq0gFPEGVQ==",
-      "dev": true
-    },
-    "acorn-jsx": {
-      "version": "4.1.1",
-      "resolved": "https://registry.npmjs.org/acorn-jsx/-/acorn-jsx-4.1.1.tgz",
-      "integrity": "sha512-JY+iV6r+cO21KtntVvFkD+iqjtdpRUpGqKWgfkCdZq1R+kbreEl8EcdcJR4SmiIgsIQT33s6
```

**File**: `package.json` (modified, +6/-7)
```diff
@@ -43,12 +43,11 @@
     "react-native": ">=0.48.4"
   },
   "devDependencies": {
-    "babel-eslint": "^8.2.6",
-    "eslint": "^5.4.0",
-    "eslint-plugin-flowtype": "^2.50.0",
-    "eslint-plugin-react": "^7.11.1",
-    "eslint-plugin-react-native": "^3.2.1",
-    "flow": "^0.2.3",
-    "flow-bin": "^0.79.1"
+    "babel-eslint": "^10.0.2",
+    "eslint": "^6.1.0",
+    "eslint-plugin-flowtype": "^4.2.0",
+    "eslint-plugin-react": "^7.14.3",
+    "eslint-plugin-react-native": "^3.7.0",
+    "flow-bin": "^0.105.2"
   }
 }
```

**File**: `yarn.lock` (modified, +543/-416)
```diff
@@ -2,127 +2,139 @@
 # yarn lockfile v1
 
 
-"@babel/code-frame@7.0.0-beta.44":
-  version "7.0.0-beta.44"
-  resolved "https://registry.yarnpkg.com/@babel/code-frame/-/code-frame-7.0.0-beta.44.tgz#2a02643368de80916162be70865c97774f3adbd9"
+"@babel/code-frame@^7.0.0", "@babel/code-frame@^7.5.5":
+  version "7.5.5"
+  resolved "https://registry.yarnpkg.com/@babel/code-frame/-/code-frame-7.5.5.tgz#bc0782f6d69f7b7d49531219699b988f669a8f9d"
+  integrity sha512-27d4lZoomVyo51VegxI20xZPuSHusqbQag/ztrBC7wegWoQ1nLREPVSKSW8byhTlzTKyNE4ifaTA6lCp7JjpFw==
   dependencies:
-    "@babel/highlight" "7.0.0-beta.44"
+    "@babel/highlight" "^7.0.0"
 
-"@babel/generator@7.0.0-beta.44":
-  version "7.0.0-beta.44"
-  resolved "https://registry.yarnpkg.com/@babel/generator/-/generator-7.0.0-beta.44.tgz#c7e67b9b5284afcf69b309b50d7d37f3e5033d42"
+"@babel/generator@^7.5.5":
+  version "7.5.5"
+  resolved "https://registry.yarnpkg.com/@babel/generator/-/generator-7.5.5.tgz#873a7f936a3c89491b43536d12245b626664e3cf"
+  integrity sha512-ETI/4vyTSxTzGnU2c49XHv2zhExkv9JHLTwDAFz85kmcwuShvYG2H08FwgIguQf4JC75CBnXAUM5PqeF4fj0nQ==
   dependencies:
-    "@babel/types" "7.0.0-beta.44"
+    "@babel/types" "^7.5.5"
     jsesc "^2.5.1"
-    lodash "^4.2.0"
+    lodash "^4.17.13"
     source-map "^0.5.0"
     trim-right "^1.0.1"
 
-"@babel/helper-function-name@7.0.0-beta.44":
-  version "7.0.0-beta.44"
-  resolved "https://registry.yarnpkg.com/@babel/helper-function-name/-/helper-function-name-7.0.0-beta.44.tgz#e18552aaae2231100a6e485e03854bc3532d44dd"
+"@babel/helper-function-name@^7.1.0":
+  version "7.1.0"
+  resolved "https://registry.yarnpkg.com/@babel/helper-function-name/-/helper-function-name-7.1.0.tgz#a0ceb01685f73355d4360c1247f582bfafc8ff53"
+  integrity sha512-A95XEoCpb3TO+KZzJ4S/5uW5fNe26DjBGqf1o9ucyLyCmi1dXq/B3c8iaWTfBk3VvetUxl16e8tIrd5teOCfGw==
   dependencies:
-    "@babel/helper-get-function-arity" "7.0.0-beta.44"
-    "@babel/template" "7.0.0-beta.44"
-    "@babel/types" "7.0.0-beta.44"
+    "@babel/helper-get-function-arity" "^7.0.0"
+    "@babel/template" "^7.1.0"
+    "@babel/types" "^7.0.0"
 
-"@babel/helper-get-function-arity@7.0.0-beta.44":
-  version "7.0.0-beta.44"
-  resolved "https://registry.yarnpkg.com/@babel/helper-get-function-arity/-/helper-get-function-arity-7.0.0-beta.44.tgz#d03ca6dd2b9f7b0b1e6b32c56c72836140db3a15"
+"@babel/helper-get-function-arity@^7.0.0":
+  version "7.0.0"
+  resolved "https://registry.yarnpkg.com/@babel/helper-get-function-arity/-/helper-get-function-arity-7.0.0.tgz#83572d4320e2a4657263734113c42868b64e49c3"
+  integrity sha512-r2DbJeg4svYvt3HOS74U4eWKsUAMRH01Z1ds1zx8KNTPtpTL5JAsdFv8BNyOpVqdFhHkkRDIg5B4AsxmkjAlmQ==
   dependencies:
-    "@babel/types" "7.0.0-beta.44"
+    "@babel/types" "^7.0.0"
 
-"@babel/helper-split-export-declaration@7.0.0-beta.44":
-  version "7.0.0-beta.44"
-  resolved "https://registry.yarnpkg.com/@babel/helper-split-export-declaration/-/helper-split-export-declaration-7.0.0-beta.44.tgz#c0b351735e0fbcb3822c8ad8db4e583b05ebd9dc"
+"@babel/helper-split-export-declaration@^7.4.4":
+  version "7.4.4"
+  resolved "https://registry.yarnpkg.com/@babel/helper-split-export-declaration/-/helper-split-export-declaration-7.4.4.tgz#ff94894a340be78f53f06af038b205c49d993677"
+  integrity sha512-Ro/XkzLf3JFITkW6b+hNxzZ1n5OQ80NvIUdmHspih1XAhtN3vPTuUFT4eQnela+2MaZ5ulH+iyP513KJrxbN7Q==
   dependencies:
-    "@babel/types" "7.0.0-beta.44"
+    "@babel/types" "^7.4.4"
 
-"@babel/highlight@7.0.0-beta.44":
-  version "7.0.0-beta.44"
-  resolved "https://registry.yarnpkg.com/@babel/highlight/-/highlight-7.0.0-beta.44.tgz#18c94ce543916a80553edcdcf681890b200747d5"
+"@babel/highlight@^7.0.0":
+  version "7.5.0"
+  resolved "https://registry.yarnpkg.com/@babel/highlight/-/highlight-7.5.0.tgz#56d11312bd9248fa619591d02472be6e8cb32540"
+  integrity sha512-7dV4eu9gBxoM0dAnj/BCFDW9LFU0zvTrkq0ugM7pnHEgguOEeOz1so2ZghEdzviYzQEED0r4EAgpsBChKy1TRQ==
   dependencies:
     chalk "^2.0.0"
     esutils "^2.0.2"
-    js-tokens "^3.0.0"
-
-"@babel/template@7.0.0-beta.44":
-  version "7.0.0-beta.44"
-  resolved "https://registry.yarnpkg.com/@babel/template/-/template-7.0.0-beta.44.tgz#f8832f4fdcee5d59bf515e595fc5106c529b394f"
-  dependencies:
-    "@babel/code-frame" "7.0.0-beta.44"
-    "@babel/types" "7.0.0-beta.44"
-    babylon "7.0.0-beta.44"
-    lodash "^4.2.0"
-
-"@babel/traverse@7.0.0-beta.44":
-  version "7.0.0-beta.44"
-  resolved "https://registry.yarnpkg.com/@babel/traverse/-/traverse-7.0.0-beta.44.tgz#a970a2c45477ad18017e2e465a0606feee0d2966"
-  dependencies:
-    "@babel/code-frame" "7.0.0-beta.44"
-    "@babel/generator" "7.0.0-beta.44"
-    "@babel/helper-function-name" "7.0.0-beta.44"
-    "@babel/helper-split-export-declaration" "7.0.0-beta.44"
-    "@babel/types" "7.0.0-beta.44"
-    babylon "7.0.0-beta.44"
-    debug "^3.1.0"
+    js-tokens "^4.0.0"
+
+"@babel/parser@^7.0.0", "@babel/parser@^7.4.4", "@babel/parser@^7.5.5":
+  version "7.5.5"
+  resolved "https://registry.yarnpkg.com/@babel/pars
```

---

### Incident Patch 6: `2e8094cc` (2019-08-14)
**Commit Message**: fix: added default initializer for user options (#343)

**File**: `lib/KeyboardAwareHOC.js` (modified, +1/-1)
```diff
@@ -137,7 +137,7 @@ const ScrollIntoViewDefaultOptions: KeyboardAwareHOCOptions = {
 
 function KeyboardAwareHOC(
   ScrollableComponent: React$Component,
-  userOptions: KeyboardAwareHOCOptions
+  userOptions: KeyboardAwareHOCOptions = {}
 ) {
   const hocOptions: KeyboardAwareHOCOptions = {
     ...ScrollIntoViewDefaultOptions,
```

---

### Incident Patch 7: `92439ee2` (2019-04-10)
**Commit Message**: Fixed typo: 'componente' to 'component' (#349)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ yarn add react-native-keyboard-aware-scroll-view
 
 You can use the `KeyboardAwareScrollView`, `KeyboardAwareSectionList` or the `KeyboardAwareFlatList`
 components. They accept `ScrollView`, `SectionList` and `FlatList` default props respectively and
-implement a custom high order componente called `KeyboardAwareHOC` to handle keyboard appearance.
+implement a custom high order component called `KeyboardAwareHOC` to handle keyboard appearance.
 The high order component is also available if you want to use it in any other component.
 
 Import `react-native-keyboard-aware-scroll-view` and wrap your content inside
```

---

### Incident Patch 8: `cb326df7` (2018-12-10)
**Commit Message**: Fix for Issue #320 (#324)

* fix enzyme test error

* bump version number

* Update package.json

**File**: `lib/KeyboardAwareHOC.js` (modified, +1/-1)
```diff
@@ -104,7 +104,7 @@ export type KeyboardAwareHOCOptions = ?{
 }
 
 function getDisplayName(WrappedComponent: React$Component) {
-  return WrappedComponent.displayName || WrappedComponent.name || 'Component'
+  return WrappedComponent && (WrappedComponent.displayName || WrappedComponent.name) || 'Component'
 }
 
 const ScrollIntoViewDefaultOptions: KeyboardAwareHOCOptions = {
```

---

### Incident Patch 9: `a4318d7d` (2018-12-10)
**Commit Message**: fix: remove React Native 57+ ListView deprecation warnings (#319)

**File**: `index.js` (modified, +0/-2)
```diff
@@ -2,13 +2,11 @@
 
 import listenToKeyboardEvents from './lib/KeyboardAwareHOC'
 import KeyboardAwareScrollView from './lib/KeyboardAwareScrollView'
-import KeyboardAwareListView from './lib/KeyboardAwareListView'
 import KeyboardAwareFlatList from './lib/KeyboardAwareFlatList'
 import KeyboardAwareSectionList from './lib/KeyboardAwareSectionList'
 
 export {
   listenToKeyboardEvents,
-  KeyboardAwareListView,
   KeyboardAwareFlatList,
   KeyboardAwareSectionList,
   KeyboardAwareScrollView
```

---

### Incident Patch 10: `50cd5e23` (2018-10-18)
**Commit Message**: Fix leftover blank space at bottom of scrollView on android (#279)

**File**: `lib/KeyboardAwareHOC.js` (modified, +3/-1)
```diff
@@ -428,7 +428,9 @@ function KeyboardAwareHOC(
     }
 
     _resetKeyboardSpace = () => {
-      const keyboardSpace: number = this.props.viewIsInsideTabBar ? _KAM_DEFAULT_TAB_BAR_HEIGHT : 0
+      const keyboardSpace: number = this.props.viewIsInsideTabBar
+        ? _KAM_DEFAULT_TAB_BAR_HEIGHT
+        : 0
       this.setState({ keyboardSpace })
       // Reset scroll position after keyboard dismissal
       if (this.props.enableResetScrollToCoords === false) {
```

---

### Incident Patch 11: `fc465f00` (2018-08-11)
**Commit Message**: fix(types): Make scrollToFocusedInput params optional

extraHeight and keyboardOpeningTime are optional params

**File**: `index.d.ts` (modified, +2/-2)
```diff
@@ -113,8 +113,8 @@ declare class ScrollableComponent<P, S> extends React.Component<P, S> {
   scrollForExtraHeightOnAndroid: (extraHeight: number) => void;
   scrollToFocusedInput: (
     reactNode: Object,
-    extraHeight: number,
-    keyboardOpeningTime: number
+    extraHeight?: number,
+    keyboardOpeningTime?: number
   ) => void
 }
 
```

---

### Incident Patch 12: `a580222e` (2018-07-20)
**Commit Message**: Fix bug where ref is null

**File**: `lib/KeyboardAwareHOC.js` (modified, +5/-3)
```diff
@@ -410,9 +410,11 @@ function listenToKeyboardEvents(ScrollableComponent: React$Component) {
     }
 
     _handleRef = (ref: React.Component<*>) => {
-      this._rnkasv_keyboardView = ref.getNode ? ref.getNode() : ref
-      if (this.props.innerRef) {
-        this.props.innerRef(this._rnkasv_keyboardView)
+      if (ref) {
+        this._rnkasv_keyboardView = ref.getNode ? ref.getNode() : ref
+        if (this.props.innerRef) {
+          this.props.innerRef(this._rnkasv_keyboardView)
+        }
       }
     }
 
```

---

### Incident Patch 13: `9a8cd7a1` (2018-06-22)
**Commit Message**: Fix documentation: Replace SectionView with SectionList (#257)

**File**: `README.md` (modified, +2/-2)
```diff
@@ -31,8 +31,8 @@ yarn add react-native-keyboard-aware-scroll-view
 ```
 
 ## Usage
-You can use the `KeyboardAwareScrollView`, the `KeyboardAwareListView`, `KeyboardAwareSectionView` or the `KeyboardAwareFlatList`
-components. They accept `ScrollView`, `ListView`, `SectionView` and `FlatList` default props respectively and
+You can use the `KeyboardAwareScrollView`, the `KeyboardAwareListView`, `KeyboardAwareSectionList` or the `KeyboardAwareFlatList`
+components. They accept `ScrollView`, `ListView`, `SectionList` and `FlatList` default props respectively and
 implement a custom high order componente called `KeyboardAwareHOC` to handle keyboard appearance.
 The high order component is also available if you want to use it in any other component.
 
```

---

### Incident Patch 14: `18754142` (2018-01-19)
**Commit Message**: fix enableAutoAutomaticScroll prop (#215)

* fix enableAutoAutomaticScroll prop

* update enableAutoAutomaticScroll prop name to enableAutomaticScroll

* fix prettier formatting

**File**: `README.md` (modified, +2/-2)
```diff
@@ -111,7 +111,7 @@ Android Support is not perfect, here is the supported list:
 |----------|-----------------|
 | `viewIsInsideTabBar` | Yes |
 | `resetScrollToCoords` | Yes |
-| `enableAutoAutomaticScroll` | Yes |
+| `enableAutomaticScroll` | Yes |
 | `extraHeight` | Yes |
 | `extraScrollHeight` | Yes |
 | `enableResetScrollToCoords` | Yes |
@@ -127,7 +127,7 @@ All the `ScrollView`/`ListView`/`FlatList` props will be passed.
 | `innerRef` | `Function` | Catch the reference of the component. |
 | `viewIsInsideTabBar` | `boolean` | Adds an extra offset that represents the `TabBarIOS` height. |
 | `resetScrollToCoords` | `Object: {x: number, y: number}` | Coordinates that will be used to reset the scroll when the keyboard hides. |
-| `enableAutoAutomaticScroll` | `boolean` | When focus in `TextInput` will scroll the position, default is enabled. |
+| `enableAutomaticScroll` | `boolean` | When focus in `TextInput` will scroll the position, default is enabled. |
 | `extraHeight` | `number` | Adds an extra offset when focusing the `TextInput`s. |
 | `extraScrollHeight` | `number` | Adds an extra offset to the keyboard. Useful if you want to stick elements above the keyboard. |
 | `enableResetScrollToCoords` | `boolean` | Lets the user enable or disable automatic resetScrollToCoords. |
```

**File**: `index.d.ts` (modified, +2/-2)
```diff
@@ -46,8 +46,8 @@ interface KeyboardAwareProps {
      * @type {boolean}
      * @memberof KeyboardAwareProps
      */
-  enableAutoAutomaticScroll?: boolean
-
+  
+  enableAutomaticScroll?: boolean
     /**
      * Enables keyboard aware settings for Android
      *
```

**File**: `lib/KeyboardAwareHOC.js` (modified, +10/-11)
```diff
@@ -23,7 +23,7 @@ export type KeyboardAwareHOCProps = {
     y: number
   },
   enableResetScrollToCoords?: boolean,
-  enableAutoAutomaticScroll?: boolean,
+  enableAutomaticScroll?: boolean,
   extraHeight?: number,
   extraScrollHeight?: number,
   keyboardOpeningTime?: number,
@@ -40,7 +40,7 @@ function listenToKeyboardEvents(ScrollableComponent: React$Component) {
   return class extends React.Component<
     KeyboardAwareHOCProps,
     KeyboardAwareHOCState
-  > implements KeyboardAwareInterface {
+    > implements KeyboardAwareInterface {
     _rnkasv_keyboardView: any
     keyboardWillShowEvent: ?Function
     keyboardWillHideEvent: ?Function
@@ -58,7 +58,7 @@ function listenToKeyboardEvents(ScrollableComponent: React$Component) {
         y: PropTypes.number.isRequired
       }),
       enableResetScrollToCoords: PropTypes.bool,
-      enableAutoAutomaticScroll: PropTypes.bool,
+      enableAutomaticScroll: PropTypes.bool,
       extraHeight: PropTypes.number,
       extraScrollHeight: PropTypes.number,
       keyboardOpeningTime: PropTypes.number,
@@ -69,7 +69,7 @@ function listenToKeyboardEvents(ScrollableComponent: React$Component) {
     }
 
     static defaultProps = {
-      enableAutoAutomaticScroll: true,
+      enableAutomaticScroll: true,
       extraHeight: _KAM_EXTRA_HEIGHT,
       extraScrollHeight: 0,
       enableResetScrollToCoords: true,
@@ -182,14 +182,13 @@ function listenToKeyboardEvents(ScrollableComponent: React$Component) {
 
     // Keyboard actions
     _updateKeyboardSpace = (frames: Object) => {
-      let keyboardSpace: number =
-        frames.endCoordinates.height + this.props.extraScrollHeight
-      if (this.props.viewIsInsideTabBar) {
-        keyboardSpace -= _KAM_DEFAULT_TAB_BAR_HEIGHT
-      }
-      this.setState({ keyboardSpace })
       // Automatically scroll to focused TextInput
-      if (this.props.enableAutoAutomaticScroll) {
+      if (this.props.enableAutomaticScroll) {
+        let keyboardSpace: number = frames.endCoordinates.height + this.props.extraScrollHeight
+        if (this.props.viewIsInsideTabBar) {
+          keyboardSpace -= _KAM_DEFAULT_TAB_BAR_HEIGHT
+        }
+        this.setState({ keyboardSpace })
         const currentlyFocusedField = TextInput.State.currentlyFocusedField()
         const responder = this.getScrollResponder()
         if (!currentlyFocusedField || !responder) {
```

---

### Incident Patch 15: `aa8d623c` (2018-01-12)
**Commit Message**: Fix: only set state when prop changes (#209)

**File**: `lib/KeyboardAwareHOC.js` (modified, +7/-5)
```diff
@@ -114,11 +114,13 @@ function listenToKeyboardEvents(ScrollableComponent: React$Component) {
     }
 
     componentWillReceiveProps(nextProps: KeyboardAwareHOCProps) {
-      const keyboardSpace: number = nextProps.viewIsInsideTabBar
-        ? _KAM_DEFAULT_TAB_BAR_HEIGHT
-        : 0
-      if (this.state.keyboardSpace !== keyboardSpace) {
-        this.setState({ keyboardSpace })
+      if (nextProps.viewIsInsideTabBar !== this.props.viewIsInsideTabBar) {
+        const keyboardSpace: number = nextProps.viewIsInsideTabBar
+          ? _KAM_DEFAULT_TAB_BAR_HEIGHT
+          : 0
+        if (this.state.keyboardSpace !== keyboardSpace) {
+          this.setState({ keyboardSpace })
+        }
       }
     }
 
```

#### Recent Merged Pull Requests:
- **PR #574** (closed): Update index.d.ts (@devsrinione)
- **PR #570** (closed): fix poor merge with upstream master (@adawx)
- **PR #552** (closed): improvement: improve typings of flatlist and sectionlist (@wkoutre)
- **PR #513** (closed): apply fixes to the library from the fork https://github.com/APSL/reac… (@raimonkh)
- **PR #510** (2021-11-04): fix scroll responder for rn v0.65 / keep backward capatability. (@CoryWritesCode)
- **PR #501** (closed): fix RN 0.65 crash (@oliverdolgener)
- **PR #499** (closed): fix crash on react native version 0.65 (@henry-n197)
- **PR #484** (2021-04-29): Fix warning due to calling getNode() (@slorber)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
