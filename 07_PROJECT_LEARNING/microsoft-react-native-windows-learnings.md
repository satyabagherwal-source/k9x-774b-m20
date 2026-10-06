# Forensic Learning Record (Deep Inspection): microsoft/react-native-windows

> **Canonical Artifact**: `07_PROJECT_LEARNING/microsoft-react-native-windows-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/microsoft/react-native-windows](https://github.com/microsoft/react-native-windows))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:48:39.670Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/react-native-windows`
- **Description**: A framework for building native Windows apps with React.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 17353 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Components/TextInput/TextInputState.win32.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

// This class is responsible for coordinating the "focused" state for
// TextInputs. All calls relating to the keyboard should be funneled
// through here.

import type {HostInstance} from '../../../src/private/types/HostInstance';

import {Commands as AndroidTextInputCommands} from '../../Components/TextInput/AndroidTextInputNativeComponent';
import {Commands as iOSTextInputCommands} from '../../Components/TextInput/RCTSingelineTextInputNativeComponent';
import {Commands as Win32TextInputCommands} from '../../Components/TextInput/Win32TextInputNativeComponent';

const {findNodeHandle} = require('../../ReactNative/RendererProxy');
const Platform = require('../../Utilities/Platform').default;

let currentlyFocusedInputRef: ?HostInstance = null;
const inputs = new Set<HostInstance>();

function currentlyFocusedInput(): ?HostInstance {
  return currentlyFocusedInputRef;
}

/**
 * Returns the ID of the currently focused text field, if one exists
 * If no text field is focused it returns null
 */
function currentlyFocusedField(): ?number {
  if (__DEV__) {
    console.error(
      'currentlyFocusedField is deprecated and will be removed in a future release. Use currentlyFocusedInput',
    );
  }

  return findNodeHandle<$FlowFixMe>(currentlyFocusedInputRef);
}

function focusInput(textField: ?HostInstance): void {
  if (currentlyFocusedInputRef !== textField && textField != null) {
    currentlyFocusedInputRef = textField;
  }
}

function blurInput(textField: ?HostInstance): void {
  if (currentlyFocusedInputRef === textField && textField != null) {
    currentlyFocusedInputRef = null;
  }
}

function focusField(textFieldID: ?number): void {
  if (__DEV__) {
    console.error('focusField no longer works. Use focusInput');
  }

  return;
}

function blurField(textFieldID: ?number) {
  if (__DEV__) {
    console.error('blurField no longer works. Use blurInput');
  }

  return;
}

/**
 * @param {number} TextInputID id of the text field to focus
 * Focuses the specified text field
 * noop if the text field was already focused or if the field is not editable
 */
function focusTextInput(textField: ?HostInstance) {
  if (typeof textField === 'number') {
    if (__DEV__) {
      console.error(
        'focusTextInput must be called with a host component. Passing a react tag is deprecated.',
      );
    }

    return;
  }

  // [Win32
  if (Platform.OS === 'win32' && textField != null) {
    // On Windows, we cannot test if the currentlyFocusedInputRef equals the
    // target ref because the call to focus on the target ref may occur before
    // an onBlur event for the target ref has been dispatched to JS but after
    // the target ref has lost native focus.
    focusInput(textField);
    Win32TextInputCommands.focus(textField);
    // Win32]
  } else if (textField != null) {
    const fieldCanBeFocused =
      currentlyFocusedInputRef !== textField &&
      // $FlowFixMe[prop-missing] - `currentProps` is missing in `NativeMethods`
      textField.currentProps?.editable !== false;

    if (!fieldCanBeFocused) {
      return;
    }
    focusInput(textField);
    if (Platform.OS === 'ios') {
      // This isn't necessarily a single line text input
      // But commands don't actually care as long as the thing being passed in
      // actually has a command with that name. So this should work with single
      // and multiline text inputs. Ideally we'll merge them into one component
      // in the future.
      iOSTextInputCommands.focus(textField);
    } else if (Platform.OS === 'android') {
      AndroidTextInputCommands.focus(textField);
    }
  }
}

/**
 * @param {number} textFieldID id of the text field to unfocus
 * Unfocuses the specified text field
 * noop if it wasn't focused
 */
function blurTextInput(textField: ?HostInstance) {
  if (typeof textField === 'number') {
    if (__DEV__) {
      console.error(
        'blurTextInput must be called with a host component. Passing a react tag is deprecated.',
      );
    }

    return;
  }

  if (currentlyFocusedInputRef === textField && textField != null) {
    blurInput(textField);
    if (Platform.OS === 'ios') {
      // This isn't necessarily a single line text input
      // But commands don't actually care as long as the thing being passed in
      // actually has a command with that name. So this should work with single
      // and multiline text inputs. Ideally we'll merge them into one component
      // in the future.
      iOSTextInputCommands.blur(textField);
    } else if (Platform.OS === 'android') {
      AndroidTextInputCommands.blur(textField);
    }
    // [Win32
    else if (Platform.OS === 'win32') {
      Win32TextInputCommands.blur(textField);
    }
    // Win32]
  }
}

// [Win32
/**
 * @param {textField} textField id of the text field that has received focus
 * Should be called after the view has received focus and fired the onFocus event
 * noop if the focused text field is same
 */
function setFocusedTextInput(textField: HostInstance) {
  if (currentlyFocusedInputRef !== textField) {
    currentlyFocusedInputRef = textField;
  }
}

/**
 * @param {textField} textField id of the text field whose focus has to be cleared
 * Should be called after the view has cleared focus and fired the onFocus event
 * noop if the focused text field is not same
 */
function clearFocusedTextInput(textField: HostInstance) {
  if (currentlyFocusedInputRef === textField) {
    currentlyFocusedInputRef = null;
  }
}
// Win32]

function registerInput(textField: HostInstance) {
  if (typeof textField === 'number') {
    if (__DEV__) {
      console.error(
        'registerInput must be called with a host component. Passing a react tag is deprecated.',
      );
    }

    return;
  }

  inputs.add(textField);
}

function unregisterInput(textField: HostInstance) {
  if (typeof textField === 'number') {
    if (__DEV__) {
      console.error(
        'unregisterInput must be called with a host component. Passing a react tag is deprecated.',
      );
    }

    return;
  }
  inputs.delete(textField);
}

function isTextInput(textField: HostInstance): boolean {
  if (typeof textField === 'number') {
    if (__DEV__) {
      console.error(
        'isTextInput must be called with a host component. Passing a react tag is deprecated.',
      );
    }

    return false;
  }

  return inputs.has(textField);
}

const TextInputState = {
  currentlyFocusedInput,
  focusInput,
  blurInput,

  currentlyFocusedField,
  focusField,
  blurField,
  setFocusedTextInput, // [Win32]
  clearFocusedTextInput, // [Win32]
  focusTextInput,
  blurTextInput,
  registerInput,
  unregisterInput,
  isTextInput,
};

export default TextInputState;

```

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Core/Devtools/loadBundleFromServer.win32.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import Networking from '../../Network/RCTNetworking';
import DevLoadingView from '../../Utilities/DevLoadingView';
import HMRClient from '../../Utilities/HMRClient';
import getDevServer from './getDevServer';

declare var global: {
  globalEvalWithSourceUrl?: (string, string) => unknown,
  __BUNDLE_LOADER_REPORTER__?: {
    onStart: (url: string | URL) => void,
    onSuccess: (url: string | URL) => void,
    onError: (url: string | URL, error: Error) => void,
  },
  ...
};

let pendingRequests = 0;

const cachedPromisesByUrl = new Map<string, Promise<void>>();

export class LoadBundleFromServerError extends Error {
  url: string;
  isTimeout: boolean;
  constructor(
    message: string,
    url: string,
    isTimeout: boolean,
    options?: {cause: unknown, ...},
  ): void {
    super(message, options);
    this.url = url;
    this.isTimeout = isTimeout;
    this.name = 'LoadBundleFromServerError';
  }
}

export class LoadBundleFromServerRequestError extends LoadBundleFromServerError {
  constructor(
    message: string,
    url: string,
    isTimeout: boolean,
    options?: {cause: unknown, ...},
  ): void {
    super(message, url, isTimeout, options);
    this.name = 'LoadBundleFromServerRequestError';
  }
}

function asyncRequest(
  url: string,
): Promise<{body: string, headers: {[string]: string}}> {
  let id = null;
  let responseText = null;
  let headers = null;
  let dataListener;
  let completeListener;
  let responseListener;
  let incrementalDataListener;
  return new Promise<{body: string, headers: {[string]: string}}>(
    (resolve, reject) => {
      dataListener = Networking.addListener(
        'didReceiveNetworkData',
        ([requestId, response]) => {
          if (requestId === id) {
            responseText = response;
          }
        },
      );
      incrementalDataListener = Networking.addListener(
        'didReceiveNetworkIncrementalData',
        ([requestId, data]) => {
          if (requestId === id) {
            if (responseText != null) {
              responseText += data;
            } else {
              responseText = data;
            }
          }
        },
      );
      responseListener = Networking.addListener(
        'didReceiveNetworkResponse',
        ([requestId, status, responseHeaders]) => {
          if (requestId === id) {
            headers = responseHeaders;
          }
        },
      );
      completeListener = Networking.addListener(
        'didCompleteNetworkResponse',
        ([requestId, errorMessage, isTimeout]) => {
          if (requestId === id) {
            if (errorMessage) {
              reject(
                new LoadBundleFromServerRequestError(
                  'Could not load bundle',
                  url,
                  isTimeout,
                  {
                    cause: errorMessage,
                  },
                ),
              );
            } else {
              //$FlowFixMe[incompatible-type]
              resolve({body: responseText, headers});
            }
          }
        },
      );
      Networking.sendRequest(
        'GET',
        'asyncRequest',
        url,
        {},
        '',
        'text',
        true,
        0,
        requestId => {
          id = requestId;
        },
        true,
      );
    },
  ).finally(() => {
    dataListener?.remove();
    completeListener?.remove();
    responseListener?.remove();
    incrementalDataListener?.remove();
  });
}

function buildUrlForBundle(bundlePathAndQuery: string) {
  const {url: serverUrl} = getDevServer();
  return (
    serverUrl.replace(/\/+$/, '') + '/' + bundlePathAndQuery.replace(/^\/+/, '')
  );
}

export default function loadBundleFromServer(
  bundlePathAndQuery: string,
): Promise<void> {
  const requestUrl = buildUrlForBundle(bundlePathAndQuery);
  let loadPromise = cachedPromisesByUrl.get(requestUrl);

  if (loadPromise) {
    return loadPromise;
  }
  DevLoadingView.showMessage('Downloading...', 'load');
  ++pendingRequests;
  global.__BUNDLE_LOADER_REPORTER__?.onStart(requestUrl);

  loadPromise = asyncRequest(requestUrl)
    .then<void>(({body, headers}) => {
      if (
        headers['Content-Type'] != null &&
        headers['Content-Type'].indexOf('application/json') >= 0
      ) {
        // Errors are returned as JSON.
        throw new LoadBundleFromServerError(
          'Could not load bundle',
          bundlePathAndQuery,
          false, // isTimeout
          {
            cause:
              JSON.parse(body).message ||
              `Unknown error fetching '${bundlePathAndQuery}'`,
          },
        );
      }

      HMRClient.registerBundle(requestUrl);

      // Some engines do not support `sourceURL` as a comment. We expose a
      // `globalEvalWithSourceUrl` function to handle updates in that case.
      if (global.globalEvalWithSourceUrl) {
        global.globalEvalWithSourceUrl(body, requestUrl);
      } else {
        // [Windows #12704 - CodeQL patch]
        // eslint-disable-next-line no-eval
        eval(body); // CodeQL [js/eval-usage] Debug only. Developer inner loop.
      }
      global.__BUNDLE_LOADER_REPORTER__?.onSuccess(requestUrl);
    })
    .catch<void>(e => {
      cachedPromisesByUrl.delete(requestUrl);
      global.__BUNDLE_LOADER_REPORTER__?.onError(requestUrl, e);
      throw e;
    })
    .finally(() => {
      if (!--pendingRequests) {
        DevLoadingView.hide();
      }
    });

  cachedPromisesByUrl.set(requestUrl, loadPromise);
  return loadPromise;
}

```

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Core/ReactNativeVersionCheck.win32.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

import Platform from '../Utilities/Platform';

const ReactNativeVersion = require('./ReactNativeVersion');

/**
 * Checks that the version of this React Native JS is compatible with the native
 * code, throwing an error if it isn't.
 *
 * The existence of this module is part of the public interface of React Native
 * even though it is used only internally within React Native. React Native
 * implementations for other platforms (ex: Windows) may override this module
 * and rely on its existence as a separate module.
 */
export function checkVersions(): void {
  const nativeVersion = Platform.constants.reactNativeVersion;
  if (
    ReactNativeVersion.version.major !== nativeVersion.major ||
    ReactNativeVersion.version.minor !== nativeVersion.minor
  ) {
    // [Win32 We cannot always match versions. Warn instead of error
    console.warn(
      // Win32]
      `React Native version mismatch.\n\nJavaScript version: ${_formatVersion(
        ReactNativeVersion.version as $FlowFixMe,
      )}\n` +
        `Native version: ${_formatVersion(nativeVersion)}\n\n` +
        'Make sure that you have rebuilt the native code. If the problem ' +
        'persists try clearing the Watchman and packager caches with ' +
        '`watchman watch-del-all && npx @react-native-community/cli start --reset-cache`.',
    );
  }
}

function _formatVersion(
  version: (typeof Platform)['constants']['reactNativeVersion'],
): string {
  return (
    `${version.major}.${version.minor}.${version.patch}` +
    // eslint-disable-next-line eqeqeq
    (version.prerelease != undefined ? `-${version.prerelease}` : '')
  );
}

```

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Pressability/HoverState.win32.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

import Platform from '../Utilities/Platform';

let isEnabled = false;

/* $FlowFixMe[incompatible-type] Error found due to incomplete typing of
 * Platform.flow.js */
/* $FlowFixMe[invalid-compare] Error discovered during Constant Condition roll
 * out. See https://fburl.com/workplace/4oq3zi07. */
if (Platform.OS === 'web') {
  const canUseDOM = Boolean(
    typeof window !== 'undefined' &&
      window.document &&
      // $FlowFixMe[method-unbinding]
      window.document.createElement,
  );

  if (canUseDOM) {
    /**
     * Web browsers emulate mouse events (and hover states) after touch events.
     * This code infers when the currently-in-use modality supports hover
     * (including for multi-modality devices) and considers "hover" to be enabled
     * if a mouse movement occurs more than 1 second after the last touch event.
     * This threshold is long enough to account for longer delays between the
     * browser firing touch and mouse events on low-powered devices.
     */
    const HOVER_THRESHOLD_MS = 1000;
    let lastTouchTimestamp = 0;

    const enableHover = () => {
      if (isEnabled || Date.now() - lastTouchTimestamp < HOVER_THRESHOLD_MS) {
        return;
      }
      isEnabled = true;
    };

    const disableHover = () => {
      lastTouchTimestamp = Date.now();
      if (isEnabled) {
        isEnabled = false;
      }
    };

    document.addEventListener('touchstart', disableHover, true);
    document.addEventListener('touchmove', disableHover, true);
    document.addEventListener('mousemove', enableHover, true);
  }
  // [Windows
} else if (Platform.OS === 'windows' || Platform.OS === 'win32') {
  isEnabled = true;
  // Windows]
}

export function isHoverEnabled(): boolean {
  return isEnabled;
}

```

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Renderer/shims/ReactNativeTypes.win32.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @noformat
 * @nolint
 * @flow strict
 * @generated SignedSource<<92e869744dd405a4d74b1b6f50fa8d52>>
 */

import type {
  // $FlowFixMe[missing-export] TODO(@rubennorte) - Missing export from react-native
  // $FlowFixMe[nonstrict-import] TODO(@rubennorte)
  HostInstance as PublicInstance,
  // $FlowFixMe[missing-export] TODO(@rubennorte) - Missing export from react-native
  // $FlowFixMe[nonstrict-import] TODO(@rubennorte)
  MeasureOnSuccessCallback,
  // $FlowFixMe[missing-export] TODO(@rubennorte) - Missing export from react-native
  // $FlowFixMe[nonstrict-import] TODO(@rubennorte)
  PublicRootInstance,
  // $FlowFixMe[missing-export] TODO(@rubennorte) - Missing export from react-native
  // $FlowFixMe[nonstrict-import] TODO(@rubennorte)
  PublicTextInstance,
} from 'react-native';

import * as React from 'react';

export type AttributeType<T, V> =
  | true
  | Readonly<{
      diff?: (arg1: T, arg2: T) => boolean,
      process?: (arg1: V) => T,
    }>;

// We either force that `diff` and `process` always use unknown,
// or we allow them to define specific types and use this hack
export type AnyAttributeType = AttributeType<$FlowFixMe, $FlowFixMe>;

export type AttributeConfiguration = Readonly<{
  [propName: string]: AnyAttributeType | void,
  style?: Readonly<{
    [propName: string]: AnyAttributeType,
    ...
  }>,
  ...
}>;

export type ViewConfig = Readonly<{
  Commands?: Readonly<{[commandName: string]: number, ...}>,
  Constants?: Readonly<{[name: string]: unknown, ...}>,
  Manager?: string,
  NativeProps?: Readonly<{[propName: string]: string, ...}>,
  baseModuleName?: ?string,
  bubblingEventTypes?: Readonly<{
    [eventName: string]: Readonly<{
      phasedRegistrationNames: Readonly<{
        captured: string,
        bubbled: string,
        skipBubbling?: ?boolean,
      }>,
    }>,
    ...
  }>,
  directEventTypes?: Readonly<{
    [eventName: string]: Readonly<{
      registrationName: string,
    }>,
    ...
  }>,
  supportsRawText?: boolean,
  uiViewClassName: string,
  validAttributes: AttributeConfiguration,
}>;

export type PartialViewConfig = Readonly<{
  bubblingEventTypes?: ViewConfig['bubblingEventTypes'],
  directEventTypes?: ViewConfig['directEventTypes'],
  supportsRawText?: boolean,
  uiViewClassName: string,
  validAttributes?: AttributeConfiguration,
}>;

type InspectorDataProps = Readonly<{
  [propName: string]: string,
  ...
}>;

type InspectorDataGetter = (
  <TElementType extends React.ElementType>(
    componentOrHandle: React.ElementRef<TElementType> | number,
  ) => ?number,
) => Readonly<{
  measure: (callback: MeasureOnSuccessCallback) => void,
  props: InspectorDataProps,
}>;

export type InspectorData = Readonly<{
  closestInstance?: unknown,
  hierarchy: Array<{
    name: ?string,
    getInspectorData: InspectorDataGetter,
  }>,
  selectedIndex: ?number,
  props: InspectorDataProps,
  componentStack: string,
}>;

export type TouchedViewDataAtPoint = Readonly<
  {
    pointerY: number,
    touchedViewTag?: number,
    frame: Readonly<{
      top: number,
      left: number,
      width: number,
      height: number,
    }>,
    closestPublicInstance?: PublicInstance,
  } & InspectorData,
>;

export type RenderRootOptions = {
  onUncaughtError?: (
    error: unknown,
    errorInfo: {readonly componentStack?: ?string},
  ) => void,
  onCaughtError?: (
    error: unknown,
    errorInfo: {
      readonly componentStack?: ?string,
      // $FlowFixMe[unclear-type] unknown props and state.
      // $FlowFixMe[value-as-type] Component in react repo is any-typed, but it will be well typed externally.
      readonly errorBoundary?: ?React.Component<any, any>,
    },
  ) => void,
  onRecoverableError?: (
    error: unknown,
    errorInfo: {readonly componentStack?: ?string},
  ) => void,
  onDefaultTransitionIndicator?: () => void | (() => void),
};

export opaque type Node = unknown;
export opaque type InternalInstanceHandle = unknown;

export type ReactFabricType = {
  findHostInstance_DEPRECATED<TElementType extends React.ElementType>(
    componentOrHandle: ?(React.ElementRef<TElementType> | number),
  ): ?PublicInstance,
  findNodeHandle<TElementType extends React.ElementType>(
    componentOrHandle: ?(React.ElementRef<TElementType> | number),
  ): ?number,
  dispatchCommand(
    handle: PublicInstance,
    command: string,
    args: Array<unknown>,
  ): void,
  isChildPublicInstance(parent: PublicInstance, child: PublicInstance): boolean,
  sendAccessibilityEvent(handle: PublicInstance, eventType: string): void,
  render(
    element: React.MixedElement,
    containerTag: number,
    callback: ?() => void,
    concurrentRoot: ?boolean,
    options: ?RenderRootOptions,
  ): ?React.ElementRef<React.ElementType>,
  unmountComponentAtNode(containerTag: number): void,
  getNodeFromInternalInstanceHandle(
    internalInstanceHandle: InternalInstanceHandle,
  ): ?Node,
  getPublicInstanceFromInternalInstanceHandle(
    internalInstanceHandle: InternalInstanceHandle,
  ): PublicInstance | PublicTextInstance | null,
  getPublicInstanceFromRootTag(rootTag: number): PublicRootInstance | null,
  ...
};

export type ReactFabricEventTouch = {
  identifier: number,
  locationX: number,
  locationY: number,
  pageX: number,
  pageY: number,
  screenX: number,
  screenY: number,
  target: number,
  timestamp: number,
  force: number,
  ...
};

export type ReactFabricEvent = {
  touches: Array<ReactFabricEventTouch>,
  changedTouches: Array<ReactFabricEventTouch>,
  targetTouches: Array<ReactFabricEventTouch>,
  target: number,
  ...
};

// Imperative LayoutAnimation API types
//
export type LayoutAnimationType =
  | 'spring'
  | 'linear'
  | 'easeInEaseOut'
  | 'easeIn'
  | 'easeOut'
  | 'keyboard';

export type LayoutAnimationProperty =
  | 'opacity'
  | 'scaleX'
  | 'scaleY'
  | 'scaleXY';

export type LayoutAnimationAnimationConfig = Readonly<{
  duration?: number,
  delay?: number,
  springDamping?: number,
  initialVelocity?: number,
  type?: LayoutAnimationType,
  property?: LayoutAnimationProperty,
}>;

export type LayoutAnimationConfig = Readonly<{
  duration: number,
  create?: LayoutAnimationAnimationConfig,
  update?: LayoutAnimationAnimationConfig,
  delete?: LayoutAnimationAnimationConfig,
}>;

```

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Types/CoreEventTypes.win32.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

import type {HostInstance} from '../../src/private/types/HostInstance';

export type NativeSyntheticEvent<out T> = Readonly<{
  bubbles: ?boolean,
  cancelable: ?boolean,
  currentTarget: number | HostInstance,
  defaultPrevented: ?boolean,
  dispatchConfig: Readonly<{
    registrationName: string,
  }>,
  eventPhase: ?number,
  preventDefault: () => void,
  isDefaultPrevented: () => boolean,
  stopPropagation: () => void,
  isPropagationStopped: () => boolean,
  isTrusted: ?boolean,
  nativeEvent: T,
  persist: () => void,
  target: ?number | HostInstance,
  timeStamp: number,
  type: ?string,
}>;

export type ResponderSyntheticEvent<T> = Readonly<{
  ...NativeSyntheticEvent<T>,
  touchHistory: Readonly<{
    indexOfSingleActiveTouch: number,
    mostRecentTimeStamp: number,
    numberActiveTouches: number,
    touchBank: ReadonlyArray<
      Readonly<{
        touchActive: boolean,
        startPageX: number,
        startPageY: number,
        startTimeStamp: number,
        currentPageX: number,
        currentPageY: number,
        currentTimeStamp: number,
        previousPageX: number,
        previousPageY: number,
        previousTimeStamp: number,
      }>,
    >,
  }>,
}>;

export type LayoutRectangle = Readonly<{
  x: number,
  y: number,
  width: number,
  height: number,
}>;

export type TextLayoutLine = Readonly<{
  ...LayoutRectangle,
  ascender: number,
  capHeight: number,
  descender: number,
  text: string,
  xHeight: number,
}>;

export type LayoutChangeEvent = NativeSyntheticEvent<
  Readonly<{
    layout: LayoutRectangle,
  }>,
>;

/**
 * @deprecated Use `TextLayoutEvent` instead.
 */
type TextLayoutEventData = Readonly<{
  lines: Array<TextLayoutLine>,
}>;

export type TextLayoutEvent = NativeSyntheticEvent<TextLayoutEventData>;

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/UIEvent
 */
export interface NativeUIEvent {
  /**
   * Returns a long with details about the event, depending on the event type.
   */
  readonly detail: number;
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent
 */
export interface NativeMouseEvent extends NativeUIEvent {
  /**
   * The X coordinate of the mouse pointer in global (screen) coordinates.
   */
  readonly screenX: number;
  /**
   * The Y coordinate of the mouse pointer in global (screen) coordinates.
   */
  readonly screenY: number;
  /**
   * The X coordinate of the mouse pointer relative to the whole document.
   */
  readonly pageX: number;
  /**
   * The Y coordinate of the mouse pointer relative to the whole document.
   */
  readonly pageY: number;
  /**
   * The X coordinate of the mouse pointer in local (DOM content) coordinates.
   */
  readonly clientX: number;
  /**
   * The Y coordinate of the mouse pointer in local (DOM content) coordinates.
   */
  readonly clientY: number;
  /**
   * Alias for NativeMouseEvent.clientX
   */
  readonly x: number;
  /**
   * Alias for NativeMouseEvent.clientY
   */
  readonly y: number;
  /**
   * Returns true if the control key was down when the mouse event was fired.
   */
  readonly ctrlKey: boolean;
  /**
   * Returns true if the shift key was down when the mouse event was fired.
   */
  readonly shiftKey: boolean;
  /**
   * Returns true if the alt key was down when the mouse event was fired.
   */
  readonly altKey: boolean;
  /**
   * Returns true if the meta key was down when the mouse event was fired.
   */
  readonly metaKey: boolean;
  /**
   * The button number that was pressed (if applicable) when the mouse event was fired.
   */
  readonly button: number;
  /**
   * The buttons being depressed (if any) when the mouse event was fired.
   */
  readonly buttons: number;
  /**
   * The secondary target for the event, if there is one.
   */
  readonly relatedTarget: null | number | HostInstance;
  // offset is proposed: https://drafts.csswg.org/cssom-view/#extensions-to-the-mouseevent-interface
  /**
   * The X coordinate of the mouse pointer between that event and the padding edge of the target node
   */
  readonly offsetX: number;
  /**
   * The Y coordinate of the mouse pointer between that event and the padding edge of the target node
   */
  readonly offsetY: number;

  // [Windows
  readonly isLeftButton: boolean;
  readonly isRightButton: boolean;
  readonly isMiddleButton: boolean;
  readonly isBarrelButtonPressed: boolean;
  readonly isHorizontalScrollWheel: boolean;
  readonly isEraser: boolean;
  readonly target: ?number;
  // Windows]
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent
 */
export interface NativePointerEvent extends NativeMouseEvent {
  /**
   * A unique identifier for the pointer causing the event.
   */
  readonly pointerId: number;
  /**
   * The width (magnitude on the X axis), in CSS pixels, of the contact geometry of the pointer
   */
  readonly width: number;
  /**
   * The height (magnitude on the Y axis), in CSS pixels, of the contact geometry of the pointer.
   */
  readonly height: number;
  /**
   * The normalized pressure of the pointer input in the range 0 to 1, where 0 and 1 represent
   * the minimum and maximum pressure the hardware is capable of detecting, respectively.
   */
  readonly pressure: number;
  /**
   * The normalized tangential pressure of the pointer input (also known as barrel pressure or
   * cylinder stress) in the range -1 to 1, where 0 is the neutral position of the control.
   */
  readonly tangentialPressure: number;
  /**
   * The plane angle (in degrees, in the range of -90 to 90) between the Y–Z plane and the plane
   * containing both the pointer (e.g. pen stylus) axis and the Y axis.
   */
  readonly tiltX: number;
  /**
   * The plane angle (in degrees, in the range of -90 to 90) between the X–Z plane and the plane
   * containing both the pointer (e.g. pen stylus) axis and the X axis.
   */
  readonly tiltY: number;
  /**
   * The clockwise rotation of the pointer (e.g. pen stylus) around its major axis in degrees,
   * with a value in the range 0 to 359.
   */
  readonly twist: number;
  /**
   * Indicates the device type that caused the event (mouse, pen, touch, etc.)
   */
  readonly pointerType: string;
  /**
   * Indicates if the pointer represents the primary pointer of this pointer type.
   */
  readonly isPrimary: boolean;
}

export type PointerEvent = NativeSyntheticEvent<NativePointerEvent>;

export type NativeTouchEvent = Readonly<{
  altKey: ?boolean, // TODO(macOS)

  button: ?number, // TODO(macOS)
  /**
   * Array of all touch events that have changed since the last event
   */
  changedTouches: ReadonlyArray<NativeTouchEvent>,

  ctrlKey: ?boolean, // TODO(macOS)


  /**
   * 3D Touch reported force
   * @platform ios
   */
  force?: number,
  /**
   * The ID of the touch
   */
  identifier: number,
  /**
   * The X position of the touch, relative to the element
   */
  locationX: number,
  /**
   * The Y position of the touch, relative to the element
   */
  locationY: number,
  /**
   * The X position of the touch, relative to the screen
   */

  metaKey: ?boolean, // TODO(macOS)

  pageX: number,
  /**
   * The Y position of the touch, relative to the screen
   */
  pageY: number,

  shiftKey: ?boolean, // TODO(macOS)
  /**
   * The node id of the element receiving the touch event
   */
  target: ?number,
  /**
   * A time identifier for the touch, useful for velocity calculation
   */
  timestamp: number,
  /**
   * Array of all current touches on the screen
   */
  touches: ReadonlyArray<NativeTouchEvent>,
}>;

export type GestureResponderEvent = ResponderSyntheticEvent<NativeTouchEvent>;

export type NativeScrollRectangle = Readonly<{
  bottom: number,
  left: number,
  right: number,
  top: number,
}>;

export type NativeScrollPoint = Readonly<{
  y: number,
  x: number,
}>;

export type NativeScrollVelocity = Readonly<{
  y: number,
  x: number,
}>;

export type NativeScrollSize = Readonly<{
  height: number,
  width: number,
}>;

export type NativeScrollEvent = Readonly<{
  contentInset: NativeScrollRectangle,
  contentOffset: NativeScrollPoint,
  contentSize: NativeScrollSize,
  layoutMeasurement: NativeScrollSize,
  velocity?: NativeScrollVelocity,
  zoomScale?: number,
  responderIgnoreScroll?: boolean,
  /**
   * @platform ios
   */
  targetContentOffset?: NativeScrollPoint,
}>;

export type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

export type TargetedEvent = Readonly<{
  target: number,
  ...
}>;

export type BlurEvent = NativeSyntheticEvent<TargetedEvent>;

export type FocusEvent = NativeSyntheticEvent<TargetedEvent>;

// [Windows Mouse events on Windows don't match up with the version in core
// introduced for react-native-web. Replace typings with our values to catch
// anything dependent on react-native-web specific values
export type MouseEvent = NativeSyntheticEvent<
  Readonly<{
    target: number,
    identifier: number,
    clientX: number,
    clientY: number,
    pageX: number,
    pageY: number,
    locationX: number,
    locationY: number,
    timestamp: number,
    pointerType: string,
    force: number,
    isLeftButton: boolean,
    isRightButton: boolean,
    isMiddleButton: boolean,
    isBarrelButtonPressed: boolean,
    isHorizontalScrollWheel: boolean,
    isEraser: boolean,
    shiftKey: boolean,
    ctrlKey: boolean,
    altKey: boolean,
  }>,
>;
// Windows]
export type KeyEvent = Readonly<{
  /**
   * The actual key that was pressed. For example, F would be "f" or "F" depending on the shift key.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
   */
  key: string,
  /**
   * The key code of the key that was pressed. For example, F would be "KeyF"
   * @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
   */
  code: string,
  altKey: bo
```

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Utilities/BackHandler.win32.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import NativeDeviceEventManager from '../../Libraries/NativeModules/specs/NativeDeviceEventManager';
import {setEventInitTimeStamp} from '../../src/private/webapis/dom/events/internals/EventInternals';
import RCTDeviceEventEmitter from '../EventEmitter/RCTDeviceEventEmitter';
import {HardwareBackPressEvent} from './HardwareBackPressEvent';

const DEVICE_BACK_EVENT = 'hardwareBackPress';

type BackPressEventName = 'backPress' | 'hardwareBackPress';
type BackPressHandler = (event: HardwareBackPressEvent) => ?boolean;

const _backPressSubscriptions: Array<BackPressHandler> = [];

RCTDeviceEventEmitter.addListener(DEVICE_BACK_EVENT, function (nativeEvent) {
  const options = {};
  const nativeTimestamp = nativeEvent?.timeStamp;
  if (nativeTimestamp != null) {
    setEventInitTimeStamp(options, nativeTimestamp);
  }
  const event = new HardwareBackPressEvent(options);
  for (let i = _backPressSubscriptions.length - 1; i >= 0; i--) {
    if (_backPressSubscriptions[i]?.(event)) {
      return;
    }
  }

  BackHandler.exitApp();
});

/**
 * Detects hardware button presses for back navigation and lets you register
 * event listeners for the system's back action. Event subscriptions are called
 * in reverse order (i.e. last registered subscription first). If one
 * subscription returns `true`, earlier subscriptions are not called.
 *
 * @see https://reactnative.dev/docs/backhandler
 * @platform win32
 */
type TBackHandler = {
  readonly exitApp: () => void,
  readonly addEventListener: (
    eventName: BackPressEventName,
    handler: BackPressHandler,
  ) => {remove: () => void, ...},
};
const BackHandler: TBackHandler = {
  /**
   * Programmatically exit the app.
   */
  exitApp: function (): void {
    if (!NativeDeviceEventManager) {
      return;
    }

    NativeDeviceEventManager.invokeDefaultBackPressHandler();
  },

  /**
   * Listen for the `hardwareBackPress` event. The handler should return `true`
   * to prevent the event from bubbling to earlier registered listeners.
   */
  addEventListener: function (
    eventName: BackPressEventName,
    handler: BackPressHandler,
  ): {remove: () => void, ...} {
    if (_backPressSubscriptions.indexOf(handler) === -1) {
      _backPressSubscriptions.push(handler);
    }
    return {
      remove: (): void => {
        const index = _backPressSubscriptions.indexOf(handler);
        if (index !== -1) {
          _backPressSubscriptions.splice(index, 1);
        }
      },
    };
  },
};

export default BackHandler;

```

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Utilities/Dimensions.win32.js`
```
/**
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 *
 * @flow
 * @format
 */

import RCTDeviceEventEmitter from '../EventEmitter/RCTDeviceEventEmitter';
import EventEmitter, {
  type EventSubscription,
} from '../vendor/emitter/EventEmitter';
import NativeDeviceInfo, {
  type DimensionsPayload,
  type DisplayMetrics,
  type DisplayMetricsAndroid,
} from './NativeDeviceInfo';
import invariant from 'invariant';

export type {DimensionsPayload, DisplayMetrics, DisplayMetricsAndroid};

/** @deprecated Use DisplayMetrics */
export type ScaledSize = DisplayMetrics;

const eventEmitter = new EventEmitter<{
  change: [DimensionsPayload],
}>();
let dimensionsInitialized = false;
let dimensions: DimensionsPayload;

/**
 * Provides the application window's width and height. Prefer
 * `useWindowDimensions` in React components.
 *
 * @see https://reactnative.dev/docs/dimensions
 *
 * [Win32] While a global Dimensions object for window and screen dimensions is too simple for Win32,
 * attached to this object is also fontScale which is a system global value.  We expose this value
 * for large text scaling support while leaving other window dimension information undefined. These undefined
 * values will cause rendering issues if used but should avoid runtime failures in JS.
 */
class Dimensions {
  /**
   * Returns the current dimensions for `'window'` or `'screen'`. On Android,
   * `'window'` dimensions exclude the status bar and navigation bar.
   *
   * NOTE: `useWindowDimensions` is the preferred API for React components.
   *
   * Although dimensions are available immediately, they may change (e.g. due to
   * device rotation) so any rendering logic or styles that depend on these
   * constants should try to call this function on every render, rather than
   * caching the value.
   *
   * Example: `const {height, width} = Dimensions.get('window');`
   *
   * @param {string} dim Name of dimension as defined when calling `set`.
   * @returns {DisplayMetrics? | DisplayMetricsAndroid?} Value for the dimension.
   */
  static get(dim: string): DisplayMetrics | DisplayMetricsAndroid {
    // $FlowFixMe[invalid-computed-prop]
    invariant(dimensions[dim], 'No dimension set for key ' + dim);
    return dimensions[dim];
  }

  /**
   * This should only be called from native code by sending the
   * didUpdateDimensions event.
   *
   * @param {DimensionsPayload} dims Simple string-keyed object of dimensions to set
   */
  static set(dims: Readonly<DimensionsPayload>): void {
    let {screen, window} = dims;
    const {windowPhysicalPixels} = dims;
    if (windowPhysicalPixels) {
      window = {
        width: windowPhysicalPixels.width,
        height: windowPhysicalPixels.height,
        scale: windowPhysicalPixels.scale,
        fontScale: windowPhysicalPixels.fontScale,
      };
    }
    const {screenPhysicalPixels} = dims;
    if (screenPhysicalPixels) {
      screen = {
        width: screenPhysicalPixels.width,
        height: screenPhysicalPixels.height,
        scale: screenPhysicalPixels.scale,
        fontScale: screenPhysicalPixels.fontScale,
      };
    } else if (screen == null) {
      screen = window;
    }

    dimensions = {window, screen};
    if (dimensionsInitialized) {
      // Don't fire 'change' the first time the dimensions are set.
      eventEmitter.emit('change', dimensions);
    } else {
      dimensionsInitialized = true;
    }
  }

  /**
   * Add an event handler. Supported events:
   *
   * - `change`: Fires when a property within the `Dimensions` object changes,
   *   such as on device rotation or foldable device state changes. The argument
   *   to the event handler is a `DimensionsPayload` object with `window` and
   *   `screen` properties whose values are the same as the return values of
   *   `Dimensions.get('window')` and `Dimensions.get('screen')`, respectively.
   */
  static addEventListener(
    type: 'change',
    handler: Function,
  ): EventSubscription {
    invariant(
      type === 'change',
      'Trying to subscribe to unknown event: "%s"',
      type,
    );
    return eventEmitter.addListener(type, handler);
  }
}

// Subscribe before calling getConstants to make sure we don't miss any updates in between.
RCTDeviceEventEmitter.addListener(
  'didUpdateDimensions',
  (update: DimensionsPayload) => {
    Dimensions.set(update);
  },
);
Dimensions.set(NativeDeviceInfo.getConstants().Dimensions);

export default Dimensions;

```

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Utilities/FocusManager.win32.d.ts`
```
/**
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 *
 * @format
 */

import React from 'react';

export declare class FocusManager {
  static focus(ref: React.Ref<any>, setWindowFocus: boolean): void;
}

```

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Utilities/FocusManager.win32.js`
```
/**
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 *
 * @flow
 * @format
 */

'use strict';

import * as React from 'react';
import {findNodeHandle, UIManager} from 'react-native';

/*
 ** This is a helper class intended to allow usage of Polite/Aggressive Focus for win32.
 */
class FocusManager {
  // This function takes in a ref to a React Component and a bool value. If setWindowFocus = true, call aggressive focus.
  // Else, call polite focus

  static focus(ref: React.RefObject<any>, setWindowFocus: boolean) {
    if (ref) {
      if (setWindowFocus) {
        UIManager.dispatchViewManagerCommand(
          // $FlowFixMe[incompatible-type]
          findNodeHandle(ref),
          UIManager.getViewManagerConfig('RCTView').Commands.aggressivefocus,
          [],
        );
      } else {
        UIManager.dispatchViewManagerCommand(
          // $FlowFixMe[incompatible-type]
          findNodeHandle(ref),
          UIManager.getViewManagerConfig('RCTView').Commands.politefocus,
          [],
        );
      }
    }
  }
}

export default FocusManager;

```

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Utilities/NativePlatformConstantsWin.js`
```
/**
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 *
 * @format
 * @flow strict
 */

export * from '../../src/private/specs_DEPRECATED/modules/NativePlatformConstantsWin';
import NativePlatformConstantsWin from '../../src/private/specs_DEPRECATED/modules/NativePlatformConstantsWin';

export default NativePlatformConstantsWin;

```

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Utilities/Platform.win32.js`
```
/**
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 *
 * @flow strict
 * @format
 */

import type {PlatformSelectSpec, PlatformType} from './PlatformTypes';

import NativePlatformConstantsWin from './NativePlatformConstantsWin';

const Platform: PlatformType = {
  __constants: null,
  OS: 'win32',
  // $FlowFixMe[unsafe-getters-setters]
  get Version(): number {
    // $FlowFixMe[object-this-reference]
    return this.constants.osVersion;
  },
  // $FlowFixMe[unsafe-getters-setters]
  get constants(): {
    forceTouchAvailable: boolean,
    interfaceIdiom: string,
    isTesting: boolean,
    isDisableAnimations?: boolean,
    osVersion: number,
    reactNativeVersion: {|
      major: number,
      minor: number,
      patch: number,
      prerelease: ?string,
    |},
    systemName: string,
    isMacCatalyst?: boolean,
  } {
    // $FlowFixMe[object-this-reference]
    if (this.__constants == null) {
      // $FlowFixMe[object-this-reference]
      this.__constants = NativePlatformConstantsWin.getConstants();
    }
    // $FlowFixMe[object-this-reference]
    return this.__constants;
  },
  // $FlowFixMe[unsafe-getters-setters]
  get isTesting(): boolean {
    if (__DEV__) {
      // $FlowFixMe[object-this-reference]
      return this.constants.isTesting;
    }
    return false;
  },
  // $FlowFixMe[unsafe-getters-setters]
  get isDisableAnimations(): boolean {
    // $FlowFixMe[object-this-reference]
    return this.constants.isDisableAnimations ?? this.isTesting;
  },
  // $FlowFixMe[unsafe-getters-setters]
  get isTV(): boolean {
    // $FlowFixMe[object-this-reference]
    return false;
  },
  // $FlowFixMe[unsafe-getters-setters]
  get isVision(): boolean {
    return false;
  },
  select: <T>(spec: PlatformSelectSpec<T>): T =>
    'win32' in spec
      ? // $FlowFixMe[incompatible-type]
        spec.win32
      : 'native' in spec
        ? // $FlowFixMe[incompatible-type]
          spec.native
        : // $FlowFixMe[incompatible-type]
          spec.default,
};

export default Platform;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #16141** (2026-07-08): **TextInput renders text outside of text field for certain scales**
  *Symptoms*: ### Problem Description  At certain display scales (reproducible at 100%), the `<TextInput/>` component renders text outside the boundaries of the text field. When typing into the TextInput, the entered text overflows and appears outside the input container rather than being properly contained within it.  ### Steps To Reproduce  This issue is reproducible consistently at the affected display scale (in my testing at 100% scale). Simply rendering a multiline TextInput and typing any text will cause the text to appear outside the field boundaries. ``` import { View, StyleSheet } from 'react-native'; import { TextInput } from 'react-native-windows';  export const ReproExample = () => {     return (         <View style={styles.container}>             <TextInput                 style={styles.textInput}                 placeholder="Type here..." ```  In the following `<TextInput/>` I just wrote "This is a test" and the text was renderer outside of the text field.  <img width="210" height="113" alt="Image" src="https://github.com/user-attachments/assets/02d1a173-eac0-4e9d-9335-5c98a37f7e31" />  ### Expected Results  _No response_  ### CLI version  20.0.0  ### Environment  ```markdown info Fetching system and libraries information... System:   OS: Windows 11 10.0.26100   CPU: (12) x64 13th Gen Intel(R) Core(TM) i7-1365U   Memory: 5.44 GB / 31.64 GB Binaries:   Node:     version: 22.13.0     path: C:\nvm4w\nodejs\node.exe   Yarn:     version: 1.22.22     path: C:\Program Files (x86)\Ya
  **Post-Mortem & Fix Analysis**:
  > I have seen this intermittently when switching monitors. It seems to happen when building the app on a display with 150% scale then moving the app to a display with 100% scale. Sometimes the text will be completely invisible, although the text cursor is still visible.  OS: windows 11 24H2 26100.8246 react: 19.2.5 react-native: 0.81.6 react-native-windows: 0.81.15
  > Confirmed this exists in 0.81.28 also. Seems to be reproducible with laptop monitor at 175% and second monitor at 100% scaling.  - Launch app on main screen scaled at 175% with TextInput hidden with a button - Drag app to second monitor at 100% scaling - Make TextInput visible, text in box is not visible.
  > @acoates-ms  Also exists in 0.83, reproduced in a clean minimal project.

- **Issue #16085** (2026-05-20): **Release builds fail on ARM Windows**
  *Symptoms*: ### Problem Description  A follow-up to #16084.  Even if I override the msbuild build props to use x64 Hermes on ARM Windows instead of x86 Hermes (by adding this build prop that sets `release\x64\hermes.exe`):  ```xml <HermesCompilerCommand Condition="'$(HermesCompilerCommand)' == ''">$(HermesPackage)\tools\native\release\x64\hermes.exe</HermesCompilerCommand> ```  ... the build still fails:  ```  √ Found Solution: C:\Users\jamie\Downloads\MyApp123\windows\MyApp123.sln  i Build configuration: Release  i Build platform: ARM64  × Building Solution: C:\Users\jamie\Downloads\MyApp123\node_modules\react-native-windows\PropertySheets\Bundle.C...  × Build failed with message C:\Users\jamie\Downloads\MyApp123\node_modules\react-native-windows\PropertySheets\Bundle.Common.targets(22,5): error MSB3075: ???? "C:\Users\jamie\.nuget\packages\microsoft.javascript.hermes\0.0.0-2511.7001-d7ca19b3\tools\native\release\x64\hermes.exe -emit-binary -out "C:\Users\jamie\Downloads\MyApp123\windows\MyApp123\Bundle\index.windows.bundle.hbc" "C:\Users\jamie\Downloads\MyApp123\windows\MyApp123\Bundle\index.windows.bundle" -O -output-source-map" ???? 5 ???????????????????????????????????????? [C:\Users\jamie\Downloads\MyApp123\windows\MyApp123\MyApp123.vcxproj]. Check your build configuration.  × It is possible your installation is missing required software dependencies. Dependencies can be automatically installed by running C:\Users\jamie\Downloads\MyApp123\node_modules\react-native-windows\scripts\r
  **Post-Mortem & Fix Analysis**:
  > @shirakaba - I think this is caused by issues in your template.  Instead of changing   settings.JavaScriptBundleFile(L".expo/.virtual-metro-entry"); you should set settings.DebugBundlePath(L".expo/.virtual-metro-entry");  And inside your vcxproj you should add <BundleEntryFile>index.ts</BundleEntryFile>  Basically, it's actually the bundle command before the hermes bytecode command that is failing.  I also hit an issue where metro wasn't being told windows was a platform, so had to add: config.resolver.platforms.push("windows"); Not sure if thats something that the expo config breaks... I didn't look into it too much.
  > @acoates-ms Thanks for catching this!  # `ReactNativeHost` instance settings  My template is derived from the [cpp-app](https://github.com/microsoft/react-native-windows/blob/main/vnext/templates/cpp-app/windows/MyApp/MyApp.cpp#L53).  Currently I'm making this change:  ```diff   #if BUNDLE     // Load the JS bundle from a file (not Metro):     // Set the path (on disk) where the .bundle file is located     settings.BundleRootPath(std::wstring(L"file://").append(appDirectory).append(L"\\Bundle\\").c_str());     // Set the name of the bundle file (without the .bundle extension)     settings.JavaScriptBundleFile(L"index.windows");     // Disable hot reload     settings.UseFastRefresh(false);   #else     // Load the JS bundle from Metro -   settings.JavaScriptBundleFile(L"index"); +   settings.JavaScriptBundleFile(L".expo/.virtual-metro-entry");     // Enable hot reload     settings.UseFastRefresh(true);   #endif ```  Are you suggesting that I make this change instead:  ```diff   #if BUNDL
  > > I assumed that "macos" and "windows" would be in any Metro config from `@rnx-kit/metro-config` by default. I swear I've been able to resolve `.windows.js` and `.macos.js` files just fine without that change in the past, though. CC [@tido64](https://github.com/tido64)  If you have a repro, hmu on Discord and I'll take a look.

- **Issue #16060** (2026-05-27): **accessibilityState={{ selected }} is crashing the app**
  *Symptoms*: ### Problem Description  The app is crashing for any component using `accessibilityState={{ selected }}`. While dev testing some changes, we noticed the app crashes when Narrator is active and when we navigate to these elements using Tab.  Looks like this was introduced by RNW (https://github.com/microsoft/react-native-windows/pull/14019)  shipped in 0.81.3+,  I believe. Narrator queries SelectionItemPattern and hits a null pointer in RNW's `get_SelectionContainer()`.  We managed to avoid the crash by setting the state to checked, but it provides wrong accessibility information.  ### Steps To Reproduce  1. Make sure you have an interactive element with `accessibilityState={{ selected }}` 2. Enable the screen reader Narrator 3. Navigate to this component 4. App should crash  ### Expected Results  Narrator should read the element with the correct selected state and the app shouldn't crash.  ### CLI version  20.0.0  ### Environment  ```markdown System:   OS: Windows 11 10.0.26100   CPU: (16) x64 Intel(R) Core(TM) Ultra 7 265H   Memory: 31.73 GB / 63.43 GB Binaries:   Node:     version: 22.22.0     path: C:\Program Files\nodejs\node.exe   Yarn:     version: 1.22.22     path: C:\Program Files (x86)\Yarn\bin\yarn.CMD   npm:     version: 10.9.4     path: C:\Program Files\nodejs\npm.CMD   Watchman: Not Found SDKs:   Android SDK: Not Found   Windows SDK:     AllowDevelopmentWithoutDevLicense: Enabled     AllowAllTrustedApps: Enabled     Versions:       - 10.0.19041.0       - 10.0.2262
  **Post-Mortem & Fix Analysis**:
  > the issue has been resolved

- **Issue #16047** (2026-05-05): **Scrolling Views not working with touch screen devices**
  *Symptoms*: ### Problem Description  When using a ScrollView, FlatList or VirtualizedList on a touch screen device if you have pressables or touchableOpacities inside after you scroll the view it seems to keep where you started scrolling pressed.  After this point other buttons no longer press normally and pressing in spots can trigger the button that was under your finger when you scrolled the view. Clicking buttons with a mouse still does work but when you click or press outside of buttons it triggers a press at where the scroll started  While this is happening I am also getting an error about touch identifier being greater then expected not sure if this is relevant  ### Steps To Reproduce  1. Using the [Scroll View Snap Sample](https://github.com/microsoft/react-native-windows/blob/main/packages/playground/Samples/scrollViewSnapSample.tsx) from the Playground repo 2. Scroll the component 3. Attempt to press the buttons inside of the view  https://github.com/user-attachments/assets/876fe052-fe07-454b-bc0f-b6e3ea04d315   ### Expected Results  Scroll should work and then afterwards buttons should still be pressable  ### CLI version  20.0.0  ### Environment  ```markdown System:   OS: Windows 11 10.0.26200   CPU: (20) x64 13th Gen Intel(R) Core(TM) i7-13800H   Memory: 34.63 GB / 63.83 GB Binaries:   Node:     version: 22.20.0     path: C:\nvm4w\nodejs\node.EXE   Yarn:     version: 1.22.22     path: C:\Program Files (x86)\Yarn\bin\yarn.CMD   npm:     version: 10.9.3     path: C:\nvm4w\nodej
  **Post-Mortem & Fix Analysis**:
  > I've seen that same issue. Try after https://github.com/microsoft/react-native-windows/pull/16048 gets backported to your version
  > > I've seen that same issue. Try after [#16048](https://github.com/microsoft/react-native-windows/pull/16048) gets backported to your version  Tested this on `0.84.0-preview.6` and still seeing this issue so don't believe those changes fix this
  > @Ben-Nipp Confirmed, i'm seeing this in my app as well 

- **Issue #15999** (2026-04-30): **SectionList scrollbar not visible without getItemLayout prop**
  *Symptoms*: ### Problem Description  When using a `SectionList` component without the `getItemLayout` prop (i.e., with dynamic/variable height items), the vertical scrollbar does not render at all. The list content is still scrollable via mouse wheel, but no scrollbar indicator is visible.  When `getItemLayout` is provided (even with an inaccurate estimated fixed height), the scrollbar appears. However, providing getItemLayout with a fixed height is not suitable for all use cases of React Native Windows.  My understanding is that the `SectionList` should display a scrollbar when content overflows, regardless of whether `getItemLayout` is provided.  ### Steps To Reproduce  1. Create a `SectionList` with multiple sections and enough items to overflow the container, using variable-height items (no `getItemLayout` prop):      ```tsx     <SectionList         sections={sections}         keyExtractor={(item) => item.id}         renderItem={({ item }) => <VariableHeightItem item={item} />}         renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}     />     ```  2. Run the app 3. Observe that the list content is scrollable (mouse wheel / touch), but no scrollbar is visible. 4. Now add a `getItemLayout` prop with any fixed height estimate:      ```tsx     <SectionList         sections={sections}         keyExtractor={(item) => item.id}         renderItem={({ item }) => <VariableHeightItem item={item} />}         renderSectionHeader={({ section }) => <SectionHeader tit
  **Post-Mortem & Fix Analysis**:
  > I have tried reproducing this issue in RNW 0.81.13 , but I could not reproduce it. I have attached my jsx here for reference.  Please have a look and let me know if I am missing something.  https://github.com/user-attachments/assets/ab1e5a47-8928-451d-9d3a-f62a17b21b5f  [App.tsx.txt](https://github.com/user-attachments/files/26771923/App.tsx.txt)
  > This issue has been automatically marked as stale because it has been marked as requiring author feedback but has not had any activity for **7 days**. It will be closed if no further activity occurs **within 7 days of this comment**. <!-- Policy app identification https://img.shields.io/static/v1?label=PullRequestIssueManagement. -->

- **Issue #15927** (2026-07-16): **0.84 Release Status**
  *Symptoms*: ### Problem Description    ### Summary   0.84 Release Status   [https://github.com/facebook/react-native/tree/0.84-stable](https://github.com/facebook/react-native/tree/0.84-stable)    ## Checklist    ### **Month before Preview** - [x] Check that the [CI pipeline](https://dev.azure.com/ms/react-native-windows/_build?definitionId=468&branchFilter=46671%2C46671) is passing on main. If it's not, file github issues to resolve as you will need them to pass for the PR pipeline for the stable branch. (**@protikbiswas100**)    ---  ### **Before Preview** - [x] Draft GitHub release notes from commit log (**@protikbiswas100**)   - [x] Promote canary build to preview using [wiki instructions](https://github.com/microsoft/react-native-windows/wiki/How-to-promote-a-release) (**@protikbiswas100**)   - [x] Push build to stable branch (**@protikbiswas100**)   - [x] Enable CI schedule for new branch of [CI pipeline](https://dev.azure.com/ms/react-native-windows/_apps/hub/ms.vss-ciworkflow.build-ci-hub?_a=edit-build-definition&id=468&view=Tab_Triggers) (**@protikbiswas100**)   - [x] Update [dashboard @ms](https://dev.azure.com/ms/react-native-windows/_dashboards/dashboard/28deb05d-f5bb-43e6-8aa9-36ad5e5476fb) with an entry for `CI ${version}` (**@protikbiswas100**)   - [x] Add release schedule for the new stable branch of [publish pipeline](https://dev.azure.com/microsoft/ReactNative/_apps/hub/ms.vss-ciworkflow.build-ci-hub?_a=edit-build-definition&id=63081&view=Tab_Triggers) (**@protikbiswas1
  **Post-Mortem & Fix Analysis**:
  > Any updates on this?

- **Issue #15851** (2026-03-27): **Cherry pick button property in 0.83**
  *Symptoms*: cherry pick in 0.83 https://github.com/microsoft/react-native-windows/pull/15819
  **Post-Mortem & Fix Analysis**:
  > @protikbiswas100 once the build is stable we need to cherry pick these changes
  > PR merged

- **Issue #15829** (2026-03-23): **📦 Bump sanitize-filename from 1.6.3 to 1.6.4**
  *Symptoms*: Bumps [sanitize-filename](https://github.com/parshap/node-sanitize-filename) from 1.6.3 to 1.6.4. <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/parshap/node-sanitize-filename/commit/6e5155272a856e32b6a89b116bf2dfbbb637d38c"><code>6e51552</code></a> 1.6.4</li> <li><a href="https://github.com/parshap/node-sanitize-filename/commit/9848644ef690ae1aa08b2af80072bf391691bea1"><code>9848644</code></a> Do not use vulnerable regex</li> <li><a href="https://github.com/parshap/node-sanitize-filename/commit/209c39b914c8eb48ee27bcbde64b2c7822fdf3de"><code>209c39b</code></a> Bump brace-expansion from 1.1.6 to 1.1.11 (<a href="https://redirect.github.com/parshap/node-sanitize-filename/issues/54">#54</a>)</li> <li>See full diff in <a href="https://github.com/parshap/node-sanitize-filename/compare/v1.6.3...v1.6.4">compare view</a></li> </ul> </details> <br />   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=sanitize-filename&package-manager=npm_and_yarn&previous-version=1.6.3&new-version=1.6.4)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)  Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.  [//]: # (dependabot-automerge-start) [//]: # (dependabot-automerge-end)  ---  <details> <summary>Dependabot co
  **Post-Mortem & Fix Analysis**:
  > /azp run PR
  > <samp> Azure Pipelines successfully started running 1 pipeline(s).<br>  </samp>

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

### Incident Patch 1: `1c5f6d1c` (2026-09-21)
**Commit Message**: Raise UIA events for selection changes (#16446)

* Raise UIA events for selection changes

Notify UI Automation clients when accessibilityState.selected changes and raise SelectionItem events according to the container's selection mode and selected item count.

Co-authored-by: Copilot <[REDACTED_EMAIL]>

Copilot-Session: 0f63ea4f-a16b-4fa3-b141-785aec89b5e4

* Announce focused single-selection changes

Co-authored-by: Copilot <[REDACTED_EMAIL]>

Copilot-Session: 0f63ea4f-a16b-4fa3-b141-785aec89b5e4

* Revert "Announce focused single-selection changes"

This reverts commit e3d3f9828fdae5026ab97f34b12c11c8b82c13e4.

* Announce focused selection changes

Co-authored-by: Copilot <[REDACTED_EMAIL]>

Copilot-Session: 0f63ea4f-a16b-4fa3-b141-785aec89b5e4

* Harden selected-state notification

Co-authored-by: Copilot <[REDACTED_EMAIL]>

Copilot-Session: 0f63ea4f-a16b-4fa3-b141-785aec89b5e4

* Retry flaky x86 E2E codegen

Co-authored-by: Copilot <[REDACTED_EMAIL]>

Copilot-Session: 0f63ea4f-a16b-4fa3-b141-785aec89b5e4

* Retry flaky x86 TextInput E2E test

Co-authored-by: Copilot <[REDACTED_EMAIL]>

Copilot-Session: 0f63ea4f-a16b-4fa3-b141-785aec89b5e4

---------

Co-authored-by: Anukrati A

**File**: `change/react-native-windows-22b1e2a3-5ecc-4c5c-b127-e625595c8026.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "Raise UI Automation selection events when accessibilityState.selected changes.",
+  "packageName": "react-native-windows",
+  "email": "anuagra@microsoft.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `vnext/Microsoft.ReactNative.IntegrationTests/Microsoft.ReactNative.IntegrationTests.vcxproj` (modified, +1/-0)
```diff
@@ -144,6 +144,7 @@
     <ClCompile Include="TestEventService.cpp" />
     <ClCompile Include="TestReactNativeHostHolder.cpp" />
     <ClCompile Include="TurboModuleTests.cpp" />
+    <ClCompile Include="UiaHelpersTests.cpp" />
     <ClCompile Include="main.cpp" />
     <ClCompile Include="pch.cpp">
       <PrecompiledHeader>Create</PrecompiledHeader>
```

**File**: `vnext/Microsoft.ReactNative.IntegrationTests/Microsoft.ReactNative.IntegrationTests.vcxproj.filters` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@
     <ClCompile Include="ReactPropertyBagTests.cpp" />
     <ClCompile Include="ReactNativeHostTests.cpp" />
     <ClCompile Include="TurboModuleTests.cpp" />
+    <ClCompile Include="UiaHelpersTests.cpp" />
     <ClCompile Include="main.cpp">
       <Filter>Utilities</Filter>
     </ClCompile>
```

**File**: `vnext/Microsoft.ReactNative.IntegrationTests/UiaHelpersTests.cpp` (added, +141/-0)
```diff
@@ -0,0 +1,141 @@
+// Copyright (c) Microsoft Corporation.
+// Licensed under the MIT License.
+
+#include "pch.h"
+
+#include "../Microsoft.ReactNative/Fabric/Composition/SelectionItemAutomationEvent.h"
+
+namespace ReactNativeIntegrationTests {
+
+namespace {
+
+struct SelectionNode {
+  bool mounted{true};
+  bool selectionContainer{false};
+  std::optional<bool> selected;
+  std::vector<SelectionNode *> children;
+};
+
+std::vector<SelectionNode *> GetSelectedItems(SelectionNode &selectionContainer) {
+  return winrt::Microsoft::ReactNative::implementation::GetSelectedItemsInSelectionContainer(
+      &selectionContainer,
+      [](const auto node) -> const auto & { return node->children; },
+      [](const auto node) { return node->mounted; },
+      [](const auto node) { return node->selectionContainer; },
+      [](const auto node) { return node->selected.value_or(false); });
+}
+
+} // namespace
+
+TEST_CLASS (UiaHelpersTests) {
+  TEST_METHOD(UnmountedSelectionItemStateChangesAreSuppressed) {
+    TestCheck(!winrt::Microsoft::ReactNative::implementation::ShouldRaiseSelectionItemStateChanged(
+        false, std::nullopt, true));
+    TestCheck(!winrt::Microsoft::ReactNative::implementation::ShouldRaiseSelectionItemStateChanged(false, false, true));
+    TestCheck(!winrt::Microsoft::ReactNative::implementation::ShouldRaiseSelectionItemStateChanged(false, true, false));
+  }
+
+  TEST_METHOD(MountedSelectionItemStateChangesUseMissingAsFalse) {
+    TestCheck(winrt::Microsoft::ReactNative::implementation::ShouldRaiseSelectionItemStateChanged(true, false, true));
+    TestCheck(winrt::Microsoft::ReactNative::implementation::ShouldRaiseSelectionItemStateChanged(true, true, false));
+    TestCheck(
+        winrt::Microsoft::ReactNative::implementation::ShouldRaiseSelectionItemStateChanged(true, std::nullopt, true));
+    TestCheck(
+        winrt::Microsoft::ReactNative::implementation::ShouldRaiseSelectionItemStateChanged(true, true, std::nullopt));
+    TestCheck(!winrt::Microsoft::ReactNative::implementation::ShouldRaiseSelectionItemStateChanged(true, false, false));
+    TestCheck(!winrt::Microsoft::ReactNative::implementation::ShouldRaiseSelectionItemStateChanged(
+        true, std::nullopt, false));
+    TestCheck(!winrt::Microsoft::ReactNative::implementation::ShouldRaiseSelectionItemStateChanged(
+        true, false, std::nullopt));
+    TestCheck(!winrt::Microsoft::ReactNative::implementation::ShouldRaiseSelectionItemStateChanged(
+        true, std::nullopt, std::nullopt));
+  }
+
+  TEST_METHOD(SelectedItemsComeFromMountedHierarchyAndStopAtNestedContainers) {
+    SelectionNode directSelected;
+    directSelected.selected = true;
+    SelectionNode directUnselected;
+    directUnselected.selected = false;
+    SelectionNode unspecifiedSelection;
+    SelectionNode wrappedSelected;
+    wrappedSelected.selected = true;
+    SelectionNode unmountedSelected;
+    unmountedSelected.mounted = false;
+    unmountedSelected.selected = true;
+    SelectionNode nestedSelected;
+    nestedSelected.selected = true;
+    SelectionNode nestedContainer;
+    nestedContainer.selectionContainer = true;
+    nestedContainer.selected = true;
+    nestedContainer.children = {&nestedSelected};
+    SelectionNode wrapper;
+    wrapper.children = {&wrappedSelected, &unmountedSelected, &nestedContainer};
+    SelectionNode root;
+    root.selectionContainer = true;
+    root.children = {&directSelected, &directUnselected, &unspecifiedSelection, &wrapper};
+
+    auto selectedItems = GetSelectedItems(root);
+
+    TestCheckEqual(size_t{3}, selectedItems.size());
+    TestCheckEqual(&directSelected, selectedItems[0]);
+    TestCheckEqual(&wrappedSelected, selectedItems[1]);
+    TestCheckEqual(&nestedContainer, selectedItems[2]);
+  }
+
+  TEST_METHOD(SelectedItemInSingleSelectionContainerRaisesElementSelected) {
+    TestCheckEqual(
+        UIA_SelectionItem_ElementSelectedEventId,
+        winrt::Microsoft::ReactNative::implementation::GetSelectionItemAutomationEventId(true, false, 1));
+  }
+
+  TEST_METHOD(FirstSelectedItemInMultiSelectionContainerRaisesElementSelected) {
+    TestCheckEqual(
+        UIA_SelectionItem_ElementSelectedEventId,
+        winrt::Microsoft::ReactNative::implementation::GetSelectionItemAutomationEventId(true, true, 1));
+  }
+
+  TEST_METHOD(AdditionalSelectedItemInMultiSelectionContainerRaisesElementAdded) {
+    TestCheckEqual(
+        UIA_SelectionItem_ElementAddedToSelectionEventId,
+        winrt::Microsoft::ReactNative::implementation::GetSelectionItemAutomationEventId(true, true, 2));
+  }
+
+  TEST_METHOD(RemovedItemRaisesElementRemoved) {
+    TestCheckEqual(
+        UIA_SelectionItem_ElementRemovedFromSelectionEventId,
+        winrt::Microsoft::ReactNative::implementation::GetSelectionItemAutomationEventId(false, true, 2));
+  }
+
+  TEST_METHOD(RemovedItemInSingleSelectionContainerRaisesElementRemoved) {
+    TestCheckEqual(
+        UIA_SelectionItem_ElementRemovedFro
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/CompositionDynamicAutomationProvider.cpp` (modified, +28/-46)
```diff
@@ -32,21 +32,7 @@ bool IsHiddenByParent(const winrt::Microsoft::ReactNative::ComponentView &view)
 
 CompositionDynamicAutomationProvider::CompositionDynamicAutomationProvider(
     const winrt::Microsoft::ReactNative::Composition::ComponentView &componentView) noexcept
-    : m_view{componentView} {
-  auto strongView = m_view.view();
-
-  if (!strongView)
-    return;
-
-  auto props = std::static_pointer_cast<const facebook::react::ViewProps>(
-      winrt::get_self<winrt::Microsoft::ReactNative::implementation::ComponentView>(strongView)->props());
-  if (!props)
-    return;
-
-  if (props->accessibilityState.has_value() && props->accessibilityState->selected.has_value()) {
-    AddSelectionItemsToContainer(this);
-  }
-}
+    : m_view{componentView} {}
 
 CompositionDynamicAutomationProvider::CompositionDynamicAutomationProvider(
     const winrt::Microsoft::ReactNative::Composition::ComponentView &componentView,
@@ -951,53 +937,49 @@ HRESULT __stdcall CompositionDynamicAutomationProvider::get_IsSelectionRequired(
 }
 
 HRESULT __stdcall CompositionDynamicAutomationProvider::GetSelection(SAFEARRAY **pRetVal) {
+  if (pRetVal == nullptr)
+    return E_POINTER;
+
+  *pRetVal = nullptr;
+
   auto strongView = m_view.view();
 
   if (!strongView)
     return UIA_E_ELEMENTNOTAVAILABLE;
 
-  std::vector<int> selectedItems;
-  for (size_t i = 0; i < m_selectionItems.size(); i++) {
-    auto selectionItem = m_selectionItems.at(i);
-
-    winrt::com_ptr<IUnknown> unkSelectionItemProvider;
-    auto hr = selectionItem->GetPatternProvider(UIA_SelectionItemPatternId, unkSelectionItemProvider.put());
-    if (FAILED(hr))
-      return hr;
-
-    auto selectionItemProvider = unkSelectionItemProvider.try_as<ISelectionItemProvider>();
-    if (!selectionItemProvider)
-      return E_FAIL;
-
-    BOOL selected;
-    hr = selectionItemProvider->get_IsSelected(&selected);
-    if (hr == S_OK && selected) {
-      selectedItems.push_back(int(i));
-    }
-  }
+  auto selectedItems = GetSelectedItemsInSelectionContainer(strongView);
 
   *pRetVal = SafeArrayCreateVector(VT_UNKNOWN, 0, ULONG(selectedItems.size()));
   if (*pRetVal == nullptr)
     return E_OUTOFMEMORY;
 
   for (size_t i = 0; i < selectedItems.size(); i++) {
+    auto selectionItem =
+        selectedItems[i].try_as<winrt::Microsoft::ReactNative::Composition::implementation::ComponentView>();
+    if (!selectionItem) {
+      SafeArrayDestroy(*pRetVal);
+      *pRetVal = nullptr;
+      return E_FAIL;
+    }
+
+    auto selectionItemProvider = selectionItem->EnsureUiaProvider().try_as<IRawElementProviderSimple>();
+    if (!selectionItemProvider) {
+      SafeArrayDestroy(*pRetVal);
+      *pRetVal = nullptr;
+      return E_FAIL;
+    }
+
     auto pos = static_cast<long>(i);
-    SafeArrayPutElement(*pRetVal, &pos, m_selectionItems.at(selectedItems.at(i)).get());
+    auto hr = SafeArrayPutElement(*pRetVal, &pos, selectionItemProvider.get());
+    if (FAILED(hr)) {
+      SafeArrayDestroy(*pRetVal);
+      *pRetVal = nullptr;
+      return hr;
+    }
   }
   return S_OK;
 }
 
-void CompositionDynamicAutomationProvider::AddToSelectionItems(winrt::com_ptr<IRawElementProviderSimple> &item) {
-  if (std::find(m_selectionItems.begin(), m_selectionItems.end(), item) != m_selectionItems.end()) {
-    return;
-  }
-  m_selectionItems.push_back(item);
-}
-
-void CompositionDynamicAutomationProvider::RemoveFromSelectionItems(winrt::com_ptr<IRawElementProviderSimple> &item) {
-  std::erase(m_selectionItems, item);
-}
-
 HRESULT __stdcall CompositionDynamicAutomationProvider::AddToSelection() {
   auto strongView = m_view.view();
 
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/CompositionDynamicAutomationProvider.h` (modified, +0/-3)
```diff
@@ -95,8 +95,6 @@ class CompositionDynamicAutomationProvider : public winrt::implements<
   virtual HRESULT __stdcall RemoveFromSelection() override;
   virtual HRESULT __stdcall Select() override;
 
-  void AddToSelectionItems(winrt::com_ptr<IRawElementProviderSimple> &item);
-  void RemoveFromSelectionItems(winrt::com_ptr<IRawElementProviderSimple> &item);
   winrt::Microsoft::ReactNative::ComponentView GetSelectionContainer() noexcept;
 
   void SetChildSiteLink(winrt::Microsoft::UI::Content::ChildSiteLink childSiteLink) {
@@ -111,7 +109,6 @@ class CompositionDynamicAutomationProvider : public winrt::implements<
   ::Microsoft::ReactNative::ReactTaggedView m_view;
   winrt::com_ptr<ITextProvider2> m_textProvider;
   winrt::com_ptr<IAnnotationProvider> m_annotationProvider;
-  std::vector<winrt::com_ptr<IRawElementProviderSimple>> m_selectionItems;
   // Non-null when this UIA node is the peer of a ContentIslandComponentView.
   winrt::Microsoft::UI::Content::ChildSiteLink m_childSiteLink{nullptr};
 };
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/CompositionViewComponentView.cpp` (modified, +19/-13)
```diff
@@ -23,6 +23,7 @@
 #include "CompositionDynamicAutomationProvider.h"
 #include "CompositionHelpers.h"
 #include "RootComponentView.h"
+#include "SelectionItemAutomationEvent.h"
 #include "Theme.h"
 #include "TooltipService.h"
 #include "UiaHelpers.h"
@@ -963,19 +964,6 @@ void ComponentView::updateAccessibilityProps(
         static_cast<int>(winrt::Microsoft::ReactNative::implementation::GetExpandCollapseState(oldExpanded)),
         static_cast<int>(winrt::Microsoft::ReactNative::implementation::GetExpandCollapseState(newExpanded)));
   }
-
-  if ((oldViewProps.accessibilityState.has_value() && oldViewProps.accessibilityState->selected.has_value()) !=
-      ((newViewProps.accessibilityState.has_value() && newViewProps.accessibilityState->selected.has_value()))) {
-    EnsureUiaProvider();
-    if (m_innerAutomationProvider) {
-      if ((newViewProps.accessibilityState.has_value() && newViewProps.accessibilityState->selected.has_value())) {
-        winrt::Microsoft::ReactNative::implementation::AddSelectionItemsToContainer(m_innerAutomationProvider.get());
-      } else {
-        winrt::Microsoft::ReactNative::implementation::RemoveSelectionItemsFromContainer(
-            m_innerAutomationProvider.get());
-      }
-    }
-  }
 }
 
 std::optional<std::string> ComponentView::getAccessiblityValue() noexcept {
@@ -1271,6 +1259,10 @@ void ViewComponentView::updateProps(
     facebook::react::Props::Shared const &oldProps) noexcept {
   const auto &oldViewProps = *std::static_pointer_cast<const facebook::react::ViewProps>(oldProps ? oldProps : m_props);
   const auto &newViewProps = *std::static_pointer_cast<const facebook::react::ViewProps>(props);
+  const auto oldSelected =
+      oldViewProps.accessibilityState.has_value() ? oldViewProps.accessibilityState->selected : std::nullopt;
+  const auto newSelected =
+      newViewProps.accessibilityState.has_value() ? newViewProps.accessibilityState->selected : std::nullopt;
 
   ensureVisual();
   if (oldViewProps.opacity != newViewProps.opacity) {
@@ -1286,6 +1278,20 @@ void ViewComponentView::updateProps(
   base_type::updateProps(props, oldProps);
 
   m_props = std::static_pointer_cast<facebook::react::ViewProps const>(props);
+
+  if (UiaClientsAreListening() &&
+      winrt::Microsoft::ReactNative::implementation::ShouldRaiseSelectionItemStateChanged(
+          isMounted(), oldSelected, newSelected)) {
+    auto provider = EnsureUiaProvider();
+    winrt::Microsoft::ReactNative::implementation::UpdateUiaProperty(
+        provider, UIA_SelectionItemIsSelectedPropertyId, oldSelected.value_or(false), newSelected.value_or(false));
+
+    if (m_innerAutomationProvider) {
+      auto root = rootComponentView();
+      winrt::Microsoft::ReactNative::implementation::RaiseSelectionItemAutomationEvent(
+          m_innerAutomationProvider.get(), newSelected.value_or(false), root && root->GetFocusedComponent() == *this);
+    }
+  }
 }
 
 const winrt::Microsoft::ReactNative::IComponentProps ViewComponentView::userProps(
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/SelectionItemAutomationEvent.h` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+// Copyright (c) Microsoft Corporation.
+// Licensed under the MIT License.
+
+#pragma once
+
+#include <UIAutomationClient.h>
+#include <cstddef>
+#include <functional>
+#include <optional>
+#include <string>
+#include <vector>
+
+namespace winrt::Microsoft::ReactNative::implementation {
+
+inline bool ShouldRaiseSelectionItemStateChanged(
+    bool isMounted,
+    const std::optional<bool> &oldSelected,
+    const std::optional<bool> &newSelected) noexcept {
+  return isMounted && oldSelected.value_or(false) != newSelected.value_or(false);
+}
+
+template <typename Node, typename GetChildren, typename IsMounted, typename IsSelectionContainer, typename IsSelected>
+std::vector<Node> GetSelectedItemsInSelectionContainer(
+    const Node &selectionContainer,
+    GetChildren &&getChildren,
+    IsMounted &&isMounted,
+    IsSelectionContainer &&isSelectionContainer,
+    IsSelected &&isSelected) {
+  std::vector<Node> selectedItems;
+  std::function<void(const Node &)> visitChildren = [&](const Node &parent) {
+    for (const auto &child : getChildren(parent)) {
+      if (!isMounted(child)) {
+        continue;
+      }
+
+      if (isSelected(child)) {
+        selectedItems.push_back(child);
+      }
+
+      if (!isSelectionContainer(child)) {
+        visitChildren(child);
+      }
+    }
+  };
+
+  visitChildren(selectionContainer);
+  return selectedItems;
+}
+
+inline EVENTID
+GetSelectionItemAutomationEventId(bool isSelected, bool canSelectMultiple, size_t selectedItemCount) noexcept {
+  if (isSelected && (!canSelectMultiple || selectedItemCount == 1)) {
+    return UIA_SelectionItem_ElementSelectedEventId;
+  }
+
+  if (isSelected) {
+    return UIA_SelectionItem_ElementAddedToSelectionEventId;
+  }
+
+  return canSelectMultiple && selectedItemCount == 1 ? UIA_SelectionItem_ElementSelectedEventId
+                                                     : UIA_SelectionItem_ElementRemovedFromSelectionEventId;
+}
+
+inline bool
+ShouldRaiseSelectionItemNotification(bool isSelected, bool canSelectMultiple, bool hasKeyboardFocus) noexcept {
+  return isSelected && !canSelectMultiple && hasKeyboardFocus;
+}
+
+inline std::wstring GetSelectionItemNotificationText(const std::wstring &name, const std::wstring &selectedText) {
+  return name.empty() ? selectedText : name + L", " + selectedText;
+}
+
+} // namespace winrt::Microsoft::ReactNative::implementation
```

---

### Incident Patch 2: `42e7afc4` (2026-09-10)
**Commit Message**:  Fix inactive Modal title bar contrast (#16434)

* Change files

* Fix inactive Modal title bar contrast

Use theme-aware AppWindowTitleBar colors for active and inactive Modal caption states while preserving true window activation and runtime theme updates.

Co-authored-by: Copilot <[REDACTED_EMAIL]>

Copilot-Session: 8f4dac7d-4a14-4053-bd3b-a7cda2967006

---------

Co-authored-by: Anukrati Agrawal <[REDACTED_EMAIL]>
Copilot-Session: 8f4dac7d-4a14-4053-bd3b-a7cda2967006

**File**: `change/react-native-windows-580ee5e2-c630-4ce8-a1a3-14ee5a18a571.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "Fix Modal title bar contrast when the native window is inactive",
+  "packageName": "react-native-windows",
+  "email": "anuagra@microsoft.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/Modal/WindowsModalHostViewComponentView.cpp` (modified, +107/-0)
```diff
@@ -15,6 +15,22 @@
 
 namespace winrt::Microsoft::ReactNative::Composition::implementation {
 
+static winrt::Windows::UI::Color CompositeOverOpaqueBackground(
+    const winrt::Windows::UI::Color &foreground,
+    const winrt::Windows::UI::Color &background) noexcept {
+  const uint32_t alpha = foreground.A;
+  const uint32_t inverseAlpha = 0xFF - alpha;
+  const auto compositeChannel = [alpha, inverseAlpha](uint8_t foregroundChannel, uint8_t backgroundChannel) {
+    return static_cast<uint8_t>((foregroundChannel * alpha + backgroundChannel * inverseAlpha + 0x7F) / 0xFF);
+  };
+
+  return {
+      0xFF,
+      compositeChannel(foreground.R, background.R),
+      compositeChannel(foreground.G, background.G),
+      compositeChannel(foreground.B, background.B)};
+}
+
 struct ModalHostState
     : winrt::implements<ModalHostState, winrt::Microsoft::ReactNative::Composition::IPortalStateData> {
   ModalHostState(winrt::Microsoft::ReactNative::LayoutConstraints layoutConstraints, float scaleFactor)
@@ -36,6 +52,8 @@ struct ModalHostState
 struct ModalHostView : public winrt::implements<ModalHostView, winrt::Windows::Foundation::IInspectable>,
                        ::Microsoft::ReactNativeSpecs::BaseModalHostView<ModalHostView> {
   ~ModalHostView() {
+    UnsubscribeFromThemeChanges();
+
     if (m_popUp) {
       // Unregister closing event handler
       if (m_appWindowClosingToken) {
@@ -171,16 +189,55 @@ struct ModalHostView : public winrt::implements<ModalHostView, winrt::Windows::F
 
  private:
   void OnMounted(const winrt::Microsoft::ReactNative::ComponentView &view) noexcept {
+    SubscribeToThemeChanges(view);
     m_mounted = true;
     if (m_visible) {
       QueueShow(view);
     }
   }
 
   void OnUnmounted(const winrt::Microsoft::ReactNative::ComponentView & /*view*/) noexcept {
+    UnsubscribeFromThemeChanges();
     m_mounted = false;
   }
 
+  void SubscribeToThemeChanges(const winrt::Microsoft::ReactNative::ComponentView &view) noexcept {
+    UnsubscribeFromThemeChanges();
+
+    auto themeSource = view.Parent().as<winrt::Microsoft::ReactNative::Composition::ComponentView>();
+    m_themeSource = winrt::make_weak(themeSource);
+    m_theme = themeSource.Theme();
+    const auto themeSubscriptionGeneration = m_themeSubscriptionGeneration;
+    m_themeChangedToken = themeSource.ThemeChanged([wkThis = get_weak(), themeSubscriptionGeneration](
+                                                       const winrt::Windows::Foundation::IInspectable &sender,
+                                                       const winrt::Windows::Foundation::IInspectable & /*args*/) {
+      auto theme = sender.as<winrt::Microsoft::ReactNative::Composition::ComponentView>().Theme();
+      if (auto strongThis = wkThis.get()) {
+        strongThis->m_reactContext.UIDispatcher().Post([wkThis, theme, themeSubscriptionGeneration]() {
+          if (auto strongThis = wkThis.get()) {
+            if (strongThis->m_themeSubscriptionGeneration != themeSubscriptionGeneration) {
+              return;
+            }
+            strongThis->m_theme = theme;
+            strongThis->UpdateTitleBarColors();
+          }
+        });
+      }
+    });
+  }
+
+  void UnsubscribeFromThemeChanges() noexcept {
+    if (m_themeChangedToken) {
+      if (auto themeSource = m_themeSource.get()) {
+        themeSource.ThemeChanged(m_themeChangedToken);
+      }
+      m_themeChangedToken = {};
+    }
+    m_themeSource = {};
+    m_theme = nullptr;
+    ++m_themeSubscriptionGeneration;
+  }
+
   void AdjustWindowSize(const winrt::Microsoft::ReactNative::LayoutMetrics &layoutMetrics) noexcept {
     if (!m_rnWindow) {
       return;
@@ -318,6 +375,52 @@ struct ModalHostView : public winrt::implements<ModalHostView, winrt::Windows::F
 
       titleBar.IconShowOptions(winrt::Microsoft::UI::Windowing::IconShowOptions::HideIconAndSystemMenu);
     }
+
+    UpdateTitleBarColors();
+  }
+
+  void UpdateTitleBarColors() noexcept {
+    if (!m_rnWindow || !m_theme || !m_localProps || m_localProps->hideTitleBar.value_or(false) ||
+        !winrt::Microsoft::UI::Windowing::AppWindowTitleBar::IsCustomizationSupported()) {
+      return;
+    }
+
+    winrt::Windows::UI::Color background;
+    winrt::Windows::UI::Color activeForeground;
+    winrt::Windows::UI::Color inactiveForeground;
+    winrt::Windows::UI::Color buttonHoverBackground;
+    winrt::Windows::UI::Color buttonPressedBackground;
+    winrt::Windows::UI::Color buttonPressedForeground;
+    if (!m_theme.TryGetPlatformColor(L"SolidBackgroundFillColorBase", background) ||
+        !m_theme.TryGetPlatformColor(L"TextFillColorPrimary", activeForeground) ||
+        !m_theme.TryGetPlatformColor(L"TextFillColorSecondary", inactiveForeground) ||
+        !m_theme.TryGetPlatformColor(L"ControlFillColorSecondary", buttonHoverBackground) ||
+        !m_theme.TryGetPlatformColor(L"ControlFillColorTertiary", buttonPressedBackground) ||
+        !m_theme.TryGetPlatformColor(L"ButtonForegr
```

---

### Incident Patch 3: `0bab52cf` (2026-09-01)
**Commit Message**: Fix use-after-free when an Image is destroyed mid-download (#11) (#16345)

**File**: `change/react-native-windows-eba3d592-2ea0-4067-8880-2beea6638837.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "Fix use-after-free crash when an Image is destroyed while its download is still in flight",
+  "packageName": "react-native-windows",
+  "email": "gordomacmaster@gmail.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `vnext/Microsoft.ReactNative/Fabric/WindowsImageManager.cpp` (modified, +40/-13)
```diff
@@ -186,6 +186,16 @@ facebook::react::ImageRequest WindowsImageManager::requestImage(
   auto weakObserverCoordinator = (std::weak_ptr<const facebook::react::ImageResponseObserverCoordinator>)
                                      imageRequest.getSharedObserverCoordinator();
 
+  // ImageResponseObserverCoordinator copies its observer list under a lock but dereferences the raw
+  // observer pointers after releasing it. Observers are added and removed on the UI thread (from
+  // ImageComponentView::setStateAndResubscribeImageResponseObserver), and that is also where the
+  // owning ImageComponentView - and with it the WindowsImageResponseObserver - is destroyed. Notifying
+  // the coordinator from the download/completion threads therefore races that teardown and can call
+  // into a freed observer. Marshal every notification onto the UI thread so subscription and
+  // notification are serialized on the same thread. Image decoding deliberately stays off the UI
+  // thread; only the notification itself is posted.
+  auto uiDispatcher = m_reactContext.UIDispatcher();
+
   auto rnImageSource = winrt::Microsoft::ReactNative::Composition::implementation::MakeImageSource(imageSource);
   auto provider = m_uriImageManager->TryGetUriImageProvider(m_reactContext.Handle(), rnImageSource);
 
@@ -202,45 +212,62 @@ facebook::react::ImageRequest WindowsImageManager::requestImage(
     source.sourceType = ImageSourceType::Download;
     source.body = imageSource.body;
 
-    auto progressCallback = [weakObserverCoordinator](int64_t loaded, int64_t total) {
-      if (auto observerCoordinator = weakObserverCoordinator.lock()) {
-        float progress = total > 0 ? static_cast<float>(loaded) / static_cast<float>(total) : 1.0f;
-        observerCoordinator->nativeImageResponseProgress(progress, loaded, total);
-      }
+    auto progressCallback = [weakObserverCoordinator, uiDispatcher](int64_t loaded, int64_t total) {
+      float progress = total > 0 ? static_cast<float>(loaded) / static_cast<float>(total) : 1.0f;
+      uiDispatcher.Post([weakObserverCoordinator, progress, loaded, total]() {
+        if (auto observerCoordinator = weakObserverCoordinator.lock()) {
+          observerCoordinator->nativeImageResponseProgress(progress, loaded, total);
+        }
+      });
     };
     imageResponseTask = GetImageRandomAccessStreamAsync(source, progressCallback);
   }
 
-  imageResponseTask.Completed([weakObserverCoordinator](auto asyncOp, auto status) {
-    auto observerCoordinator = weakObserverCoordinator.lock();
-    if (!observerCoordinator) {
+  imageResponseTask.Completed([weakObserverCoordinator, uiDispatcher](auto asyncOp, auto status) {
+    if (weakObserverCoordinator.expired()) {
       return;
     }
 
+    auto postComplete = [weakObserverCoordinator, uiDispatcher](auto image) {
+      uiDispatcher.Post([weakObserverCoordinator, image = std::move(image)]() {
+        if (auto observerCoordinator = weakObserverCoordinator.lock()) {
+          observerCoordinator->nativeImageResponseComplete(facebook::react::ImageResponse(image, nullptr /*metadata*/));
+        }
+      });
+    };
+
+    auto postFailure = [weakObserverCoordinator,
+                        uiDispatcher](std::shared_ptr<facebook::react::ImageErrorInfo> errorInfo) {
+      uiDispatcher.Post([weakObserverCoordinator, errorInfo = std::move(errorInfo)]() {
+        if (auto observerCoordinator = weakObserverCoordinator.lock()) {
+          observerCoordinator->nativeImageResponseFailed(facebook::react::ImageLoadError(errorInfo));
+        }
+      });
+    };
+
     switch (status) {
       case winrt::Windows::Foundation::AsyncStatus::Completed: {
         auto imageResponse = asyncOp.GetResults();
         auto selfImageResponse =
             winrt::get_self<winrt::Microsoft::ReactNative::Composition::implementation::ImageResponse>(imageResponse);
         auto imageResultOrError = selfImageResponse->ResolveImage();
         if (imageResultOrError.image) {
-          observerCoordinator->nativeImageResponseComplete(
-              facebook::react::ImageResponse(imageResultOrError.image, nullptr /*metadata*/));
+          postComplete(std::move(imageResultOrError.image));
         } else {
-          observerCoordinator->nativeImageResponseFailed(facebook::react::ImageLoadError(imageResultOrError.errorInfo));
+          postFailure(std::move(imageResultOrError.errorInfo));
         }
         break;
       }
       case winrt::Windows::Foundation::AsyncStatus::Canceled: {
         auto errorInfo = std::make_shared<facebook::react::ImageErrorInfo>();
         errorInfo->error = FormatHResultError(winrt::hresult_error(asyncOp.ErrorCode()));
-        observerCoordinator->nativeImageResponseFailed(facebook::react::ImageLoadError(errorInfo));
+        postFailure(std::move(errorInfo));
         break;
       }
       case winrt::Windows::Foundation::AsyncStatus::Error: {
         auto errorInfo = std::make_shared<facebook::react::ImageErrorInfo>(
```

---

### Incident Patch 4: `ba65c6b4` (2026-08-21)
**Commit Message**: Fix crash modifying outline property (#16386)

* Fix crash modifying outline property

* Change files

**File**: `change/react-native-windows-c1af9f4d-e4f1-4dea-9a73-b66033f3bb8d.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "Fix crash modifying outline property",
+  "packageName": "react-native-windows",
+  "email": "30809111+acoates-ms@users.noreply.github.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/BorderPrimitive.cpp` (modified, +1/-1)
```diff
@@ -713,7 +713,7 @@ BorderPrimitive::BorderPrimitive(
     : m_outer(&outer), m_rootVisual(rootVisual), m_ownsRootVisual(false) {}
 
 BorderPrimitive::BorderPrimitive(winrt::Microsoft::ReactNative::Composition::implementation::ComponentView &outer)
-    : m_outer(&outer), m_rootVisual(outer.CompositionContext().CreateSpriteVisual()) {}
+    : m_outer(&outer), m_rootVisual(outer.CompositionContext().CreateSpriteVisual()), m_ownsRootVisual(true) {}
 
 winrt::Microsoft::ReactNative::Composition::Experimental::IVisual BorderPrimitive::RootVisual() const noexcept {
   return m_rootVisual;
```

---

### Incident Patch 5: `124897f1` (2026-08-20)
**Commit Message**: Fix CI pipeline and add warn-feed script (#16379)

**File**: `.ado/image/rnw-img-vs2026-node24.json` (modified, +45/-3)
```diff
@@ -21,6 +21,9 @@
         {
             "name": "windows-gitinstall"
         },
+        {
+            "name": "windows-git-lfs"
+        },
         {
             "name": "windows-AzPipeline-ImageHelpers"
         },
@@ -33,18 +36,32 @@
         {
             "name": "windows-AzPipeline-7zip"
         },
+        {
+            "name": "windows-chocolatey",
+            "parameters": {
+                "packages": "nasm"
+            }
+        },
         {
             "name": "windows-visualstudio-bootstrapper",
             "parameters": {
-                "Workloads": "--add Microsoft.VisualStudio.Workload.ManagedDesktop --add Microsoft.VisualStudio.Workload.NativeDesktop --add Microsoft.VisualStudio.Workload.Universal --add Microsoft.VisualStudio.ComponentGroup.NativeDesktop.Core --add Microsoft.VisualStudio.ComponentGroup.UWP.Support --add Microsoft.VisualStudio.ComponentGroup.UWP.VC --add Microsoft.Component.MSBuild --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --add Microsoft.VisualStudio.Component.Windows11SDK.22621 --includeRecommended --includeOptional",
+                "Workloads": "--add Microsoft.VisualStudio.Workload.ManagedDesktop --add Microsoft.VisualStudio.Workload.NativeDesktop --add Microsoft.VisualStudio.Workload.Universal --add Microsoft.VisualStudio.ComponentGroup.NativeDesktop.Core --add Microsoft.VisualStudio.ComponentGroup.UWP.Support --add Microsoft.VisualStudio.ComponentGroup.UWP.VC --add Microsoft.Component.MSBuild --add Microsoft.VisualStudio.Component.VC.CoreBuildTools --add Microsoft.VisualStudio.Component.VC.CoreIde --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --add Microsoft.VisualStudio.Component.VC.Tools.ARM64 --add Microsoft.VisualStudio.Component.VC.Llvm.Clang --add Microsoft.VisualStudio.Component.VC.Llvm.ClangToolset --add Microsoft.VisualStudio.Component.VC.CMake.Project --add Microsoft.VisualStudio.Component.Windows11SDK.26100 --add Microsoft.VisualStudio.Component.Windows11Sdk.WindowsPerformanceToolkit --add Microsoft.VisualStudio.Component.Windows11SDK.22621 --add Microsoft.VisualStudio.Component.VC.ATL --add Microsoft.VisualStudio.Component.VC.ATL.ARM64 --add Microsoft.VisualStudio.Component.VC.ATLMFC --add Microsoft.VisualStudio.Component.VC.MFC.ARM64 --add Microsoft.VisualStudio.Component.UWP.VC.ARM64 --add Microsoft.VisualStudio.Component.VC.Runtimes.x86.x64.Spectre --add Microsoft.VisualStudio.Component.VC.Runtimes.ARM64.Spectre --add Microsoft.VisualStudio.Component.VC.ATL.Spectre --add Microsoft.VisualStudio.Component.VC.ATL.ARM64.Spectre --includeRecommended --includeOptional",
                 "SKU": "Enterprise",
                 "VSBootstrapperURL": "https://aka.ms/vs/18/stable/vs_Enterprise.exe"
             }
         },
         {
             "name": "Windows-NodeJS",
             "parameters": {
-                "Version": "24.16.0"
+                "Version": "24.x",
+                "UseARM": "false"
+            }
+        },
+        {
+            "name": "windows-install-python",
+            "parameters": {
+                "Version": "latest",
+                "Architecture": "x64"
             }
         },
         {
@@ -56,11 +73,36 @@
         {
             "name": "windows-dotnetcore-sdk",
             "parameters": {
-                "DotNetCoreVersion": "10.0.300"
+                "DotNetCoreVersion": "latest",
+                "Channel": "10.0"
+            }
+        },
+        {
+            "name": "windows-1es-pt-prerequisites-v2",
+            "parameters": {
+                "KVSecret_AppSecret": "https://pipelinesidentity.vault.azure.net/secrets/1es-gpt-read-only-app-secret"
             }
         },
         {
             "name": "Windows-AzureCLI"
+        },
+        {
+            "name": "windows-updateregistry",
+            "parameters": {
+                "RegistryPath": "HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\VisualStudio\\Setup",
+                "RegistryKey": "BackgroundDownloadDisabled",
+                "DataType": "REG_DWORD",
+                "Value": "1"
+            }
+        },
+        {
+            "name": "windows-updateregistry",
+            "parameters": {
+                "RegistryPath": "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\VisualStudio\\Setup",
+                "RegistryKey": "BackgroundDownloadDisabled",
+                "DataType": "REG_DWORD",
+                "Value": "1"
+            }
         }
     ]
 }
```

**File**: `.ado/release-pipeline.yml` (modified, +36/-0)
```diff
@@ -229,6 +229,42 @@ extends:
             owners: 'vmorozov@microsoft.com'
             approvers: 'khosany@microsoft.com'
 
+      - job: PushNpmPublicAdo
+        displayName: ADO - npm - react-native-public
+        timeoutInMinutes: 30
+        templateContext:
+          type: releaseJob
+          isProduction: true
+          inputs:
+          - input: pipelineArtifact
+            pipeline: 'CI'
+            artifactName: 'NpmPackedTarballs'
+            targetPath: '$(Pipeline.Workspace)/npm-feed-packages'
+        steps:
+        - template: .ado/templates/publish-npm-to-ado-feed.yml@self
+          parameters:
+            npmFeedRegistry: 'https://pkgs.dev.azure.com/ms/react-native/_packaging/react-native-public/npm/registry/'
+            packagesPath: '$(Pipeline.Workspace)/npm-feed-packages'
+            feedDisplayName: 'ms/react-native-public'
+
+      - job: PushNpmPrivateAdo
+        displayName: ADO - npm - react-native
+        timeoutInMinutes: 30
+        templateContext:
+          type: releaseJob
+          isProduction: true
+          inputs:
+          - input: pipelineArtifact
+            pipeline: 'CI'
+            artifactName: 'NpmPackedTarballs'
+            targetPath: '$(Pipeline.Workspace)/npm-feed-packages'
+        steps:
+        - template: .ado/templates/publish-npm-to-ado-feed.yml@self
+          parameters:
+            npmFeedRegistry: 'https://pkgs.dev.azure.com/ms/_packaging/react-native/npm/registry/'
+            packagesPath: '$(Pipeline.Workspace)/npm-feed-packages'
+            feedDisplayName: 'ms/react-native'
+
       - job: PushPrivateAdo
         displayName: ADO - nuget - react-native
         timeoutInMinutes: 30
```

**File**: `.ado/templates/msbuild-sln.yml` (modified, +0/-1)
```diff
@@ -47,7 +47,6 @@ steps:
         /p:PlatformToolset=${{parameters.platformToolset}}
         /p:PublishToolDuringBuild=true
         /p:RestoreLockedMode=true
-        /p:RestoreForceEvaluate=true
         /bl:$(BuildLogDirectory)\MsBuild.binlog
         /flp1:errorsonly;logfile=$(BuildLogDirectory)\MsBuild.err.log
         /flp2:warningsonly;logfile=$(BuildLogDirectory)\MsBuild.wrn.log
```

**File**: `.ado/templates/prepare-build-env.yml` (modified, +4/-4)
```diff
@@ -31,15 +31,15 @@ parameters:
     # invoked. Example: ['RNTesterApp-Fabric', 'Playground'].
 
 steps:
-  # The VS Installer's background auto-update service otherwise wakes up mid-build and
-  # downloads VS updates from the MS CDN, which trips the network isolation policy.
-  # Follow-up: bake this into the agent image so it doesn't have to run per job.
+  # VS Installer's background auto-update (BackgroundDownload.exe) fetches VS updates from the MS
+  # CDN mid-build and trips network isolation. Interim belt; the durable fix is BackgroundDownloadDisabled=1
+  # baked into the agent image JSON (.ado/image/rnw-img-vs2026-node24.json) — remove once that image ships.
   - pwsh: |
       foreach ($key in @(
           'HKLM:\SOFTWARE\Microsoft\VisualStudio\Setup',
           'HKLM:\SOFTWARE\Policies\Microsoft\VisualStudio\Setup')) {
         New-Item -Path $key -Force | Out-Null
-        New-ItemProperty -Path $key -Name BackgroundDownload -PropertyType DWord -Value 0 -Force | Out-Null
+        New-ItemProperty -Path $key -Name BackgroundDownloadDisabled -PropertyType DWord -Value 1 -Force | Out-Null
       }
       Get-Process -Name BackgroundDownload -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
     displayName: Disable VS Installer background download
```

**File**: `.ado/templates/publish-npm-to-ado-feed.yml` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+# Publishes packed npm tarballs to an Azure Artifacts feed's npm registry, mirroring
+# publish-nuget-to-ado-feed.yml. Auth uses the shared managed identity (same identity/
+# resource the NuGet feed publish uses).
+parameters:
+- name: azureSubscription
+  type: string
+  default: 'Office-Hermes-Windows-Bot'
+- name: npmFeedRegistry
+  type: string
+- name: packagesPath
+  type: string
+- name: feedDisplayName
+  type: string
+
+steps:
+- task: AzureCLI@2
+  displayName: Acquire ${{ parameters.feedDisplayName }} feed token
+  inputs:
+    azureSubscription: ${{ parameters.azureSubscription }}
+    visibleAzLogin: false
+    scriptType: pscore
+    scriptLocation: inlineScript
+    inlineScript: |
+      $token = az account get-access-token --query accessToken --resource 499b84ac-1321-427f-aa17-267ca6975798 -o tsv
+      if ([string]::IsNullOrWhiteSpace($token)) { throw 'Failed to acquire a feed access token.' }
+      Write-Host "##vso[task.setsecret]$token"
+      Write-Host "##vso[task.setvariable variable=AdoNpmFeedToken;issecret=true]$token"
+
+- pwsh: |
+    # The .npmrc holds only the ${NPM_FEED_TOKEN} placeholder; npm expands it from the masked env
+    # var at run time, so the raw token never lands in a file. A version already present in the feed
+    # (locally or via its npmjs upstream) returns 409, which we treat as success.
+    $registry = '${{ parameters.npmFeedRegistry }}'
+    $key = ($registry -replace '^https?:', '')
+    Set-Content -Path (Join-Path $env:USERPROFILE '.npmrc') -Encoding ascii -Value @(
+      "registry=$registry"
+      "${key}:_authToken=`${NPM_FEED_TOKEN}"
+    )
+    $tgzs = @(Get-ChildItem -Path '${{ parameters.packagesPath }}' -Filter *.tgz -Recurse)
+    Write-Host "Publishing $($tgzs.Count) package(s) to ${{ parameters.feedDisplayName }}"
+    $failed = @()
+    foreach ($tgz in $tgzs) {
+      $out = & npm publish $tgz.FullName --registry $registry 2>&1 | Out-String
+      if ($LASTEXITCODE -eq 0) { Write-Host "published $($tgz.Name)" }
+      elseif ($out -match 'already exists|EPUBLISHCONFLICT|cannot publish over|\b409\b') { Write-Host "skipped (already in feed): $($tgz.Name)" }
+      else { Write-Host "##[error]Failed to publish $($tgz.Name): $out"; $failed += $tgz.Name }
+    }
+    if ($failed.Count -gt 0) { throw "Failed to publish $($failed.Count) package(s) to ${{ parameters.feedDisplayName }}." }
+  displayName: Publish npm packages to ${{ parameters.feedDisplayName }}
+  env:
+    NPM_FEED_TOKEN: $(AdoNpmFeedToken)
```

**File**: `.ado/templates/run-windows-with-certificates.yml` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ parameters:
     default: true
   - name: restoreForceEvaluate
     type: boolean
-    default: true
+    default: false
   - name: errorOnNuGetLockChanges
     type: boolean
     default : true
```

**File**: `.ado/warm-feed-cache-pipeline.yml` (modified, +68/-49)
```diff
@@ -1,81 +1,100 @@
+# Scheduled feed-warming pipeline (office/ISS).
 #
-# Scheduled feed-warming pipeline (office/ISS, non-production).
-#
-# Runs Warm-RnwFeedCache.ps1 to save the CLI-init toolchain closure into the
-# ms/react-native-public feed with an authenticated identity, so anonymous PR
-# builds restore cleanly instead of 404ing on a not-yet-cached transitive package.
-#
-# Runs every 6 hours; drop to hourly later if it stays light.
+# Enumerates the ms/react-native-public feed and re-pulls, with the pipeline's
+# managed identity, the latest patch of every npm/NuGet major.minor line already
+# in use, so anonymous network-isolated PR/CI builds can restore them.
 #
+# Runs out of band (never in a PR build) because saving into the feed needs the
+# managed identity. A maintainer can also queue it with the `packages` parameter
+# to warm a specific set of versions on demand.
 
-name: 0.0.$(Date:yyMM.d)$(Rev:rrr)
+name: $(Date:yyyyMMdd).$(Rev:r)
 
 trigger: none
 pr: none
 
+parameters:
+  - name: packages
+    displayName: 'One-off warm (space-separated): npm:foo@1.2.3 nuget:Bar@4.0.0'
+    type: string
+    default: ' '
+
 schedules:
-  - cron: "0 0,6,12,18 * * *"
+  - cron: '0 0,6,12,18 * * *'
     displayName: Every 6 hours
     branches:
       include:
         - main
     always: true
 
+# Route npm/Yarn/NuGet through the ms/react-native-public feed (matches CI) under network isolation.
+variables:
+  - template: variables/shared.yml
+
 resources:
   repositories:
-  - repository: OfficePipelineTemplates
-    type: git
-    name: 1ESPipelineTemplates/OfficePipelineTemplates
-    ref: refs/tags/release
+    - repository: OfficePipelineTemplates
+      type: git
+      name: 1ESPipelineTemplates/OfficePipelineTemplates
+      ref: refs/tags/release
 
 extends:
   template: v1/Office.Unofficial.PipelineTemplate.yml@OfficePipelineTemplates
   parameters:
     pool:
-      name: fabric-internal-pool-large
-      demands: ImageOverride -equals rnw-img-vs2026-node24
+      name: Azure-Pipelines-1ESPT-ExDShared
+      vmImage: windows-latest
+      os: windows
     sdl:
       bandit:
         enabled: false
+      # Skip ESLint SDL on this utility pipeline (CI/Release run it on the code); the Unofficial
+      # template's --exit-on-fatal-error trips on repo-wide Guardian ES5-parser parse noise.
       eslint:
-        enableExclusions: true
+        enabled: false
       suppression:
         suppressionFile: $(Build.SourcesDirectory)\.ado\guardian\sdl\.gdnsuppress
     stages:
-    - stage: Warm
-      displayName: Warm feed cache
-      jobs:
-      - job: WarmFeed
-        displayName: Warm npm and NuGet feed cache
-        timeoutInMinutes: 60
-        steps:
-        - checkout: self
-          fetchDepth: 1
+      - stage: Warm
+        displayName: Warm feed cache
+        jobs:
+          - job: WarmFeed
+            displayName: Warm npm and NuGet feed cache
+            timeoutInMinutes: 60
+            steps:
+              - checkout: self
+                fetchDepth: 1
+
+              - task: UseNode@1
+                displayName: Use Node.js 24.x
+                inputs:
+                  version: '24.x'
 
-        - task: UseNode@1
-          displayName: Use Node.js 24.x
-          inputs:
-            version: '24.x'
+              # Authenticate npm/Yarn to the feed before install (same MI as CI).
+              - template: .ado/templates/auth-npm-feed.yml@self
 
-        # The agent image does not guarantee Yarn (build-template.yml installs it
-        # explicitly), and the warm script runs `yarn install`. Authenticate npm to
-        # the feed, then install the same pinned Yarn from it.
-        - template: .ado/templates/auth-npm-feed.yml@self
+              - script: yarn install --immutable
+                displayName: yarn install
+                retryCountOnTaskFailure: 2
 
-        - task: CmdLine@2
-          displayName: Install pinned Yarn from the feed
-          inputs:
-            script: npm install --global yarn@1.22.22 --registry https://pkgs.dev.azure.com/ms/react-native/_packaging/react-native-public/npm/registry/
+              - script: npx lage build --scope @rnw-scripts/warm-feed
+                displayName: Build warm-feed
+                retryCountOnTaskFailure: 2
 
-        # Interim identity (shared with auth-npm-feed.yml); swap to the RNW managed
-        # identity once it is provisioned. AzureCLI@2 logs in az as this identity, so
-        # the script's `az account get-access-token` authenticates to the feed.
-        - task: AzureCLI@2
-          displayName: Warm ms/react-native-public feed
-          inputs:
-            azureSubscription: Office-Hermes-Windows-Bot
-            scriptType: pscore
-            scriptLocation: inlineScript
-            inlineScript: |
-              $ErrorActionPreference = 'Stop'
-              & "$(Build.SourcesDirectory)/vnext/Scripts/Warm-RnwFeedCache.ps1"
+              # AzureCLI logs `az` in as the man
```

**File**: `.ado/warm-feed-pipeline.yml` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+# Scheduled feed-warming pipeline (office/ISS).
+#
+# Enumerates the ms/react-native-public feed and re-pulls, with the pipeline's
+# managed identity, the latest patch of every npm/NuGet major.minor line already
+# in use, so anonymous network-isolated PR/CI builds can restore them.
+#
+# Runs out of band (never in a PR build) because saving into the feed needs the
+# managed identity. A maintainer can also queue it with the `packages` parameter
+# to warm a specific set of versions on demand.
+
+name: $(Date:yyyyMMdd).$(Rev:r)
+
+trigger: none
+pr: none
+
+parameters:
+  - name: packages
+    displayName: 'One-off warm (space-separated): npm:foo@1.2.3 nuget:Bar@4.0.0'
+    type: string
+    default: ' '
+
+schedules:
+  - cron: '0 0,6,12,18 * * *'
+    displayName: Every 6 hours
+    branches:
+      include:
+        - main
+    always: true
+
+# Route npm/Yarn/NuGet through the ms/react-native-public feed (matches CI) under network isolation.
+variables:
+  - template: variables/shared.yml
+
+resources:
+  repositories:
+    - repository: OfficePipelineTemplates
+      type: git
+      name: 1ESPipelineTemplates/OfficePipelineTemplates
+      ref: refs/tags/release
+
+extends:
+  template: v1/Office.Unofficial.PipelineTemplate.yml@OfficePipelineTemplates
+  parameters:
+    pool:
+      name: Azure-Pipelines-1ESPT-ExDShared
+      vmImage: windows-latest
+      os: windows
+    sdl:
+      bandit:
+        enabled: false
+      # Skip ESLint SDL on this utility pipeline (CI/Release run it on the code); the Unofficial
+      # template's --exit-on-fatal-error trips on repo-wide Guardian ES5-parser parse noise.
+      eslint:
+        enabled: false
+      suppression:
+        suppressionFile: $(Build.SourcesDirectory)\.ado\guardian\sdl\.gdnsuppress
+    stages:
+      - stage: Warm
+        displayName: Warm feed cache
+        jobs:
+          - job: WarmFeed
+            displayName: Warm npm and NuGet feed cache
+            timeoutInMinutes: 60
+            steps:
+              - checkout: self
+                fetchDepth: 1
+
+              - task: UseNode@1
+                displayName: Use Node.js 24.x
+                inputs:
+                  version: '24.x'
+
+              # Authenticate npm/Yarn to the feed before install (same MI as CI).
+              - template: .ado/templates/auth-npm-feed.yml@self
+
+              - script: yarn install --immutable
+                displayName: yarn install
+                retryCountOnTaskFailure: 2
+
+              - script: npx lage build --scope @rnw-scripts/warm-feed
+                displayName: Build warm-feed
+                retryCountOnTaskFailure: 2
+
+              # AzureCLI logs `az` in as the managed identity, so
+              # `az account get-access-token` mints the feed token the tool reads
+              # from WARM_FEED_TOKEN.
+              - task: AzureCLI@2
+                displayName: Warm ms/react-native-public feed
+                inputs:
+                  azureSubscription: Office-Hermes-Windows-Bot
+                  scriptType: pscore
+                  scriptLocation: inlineScript
+                  inlineScript: |
+                    $ErrorActionPreference = 'Stop'
+                    $env:WARM_FEED_TOKEN = az account get-access-token `
+                      --resource 499b84ac-1321-427f-aa17-267ca6975798 --query accessToken -o tsv
+                    $pkgs = '${{ parameters.packages }}'.Trim()
+                    $warmArgs = @()
+                    if ($pkgs) { foreach ($p in ($pkgs -split '\s+')) { $warmArgs += @('--packages', $p) } }
+                    npx warm-feed @warmArgs
```

---

### Incident Patch 6: `36939f87` (2026-08-10)
**Commit Message**: fix(pointer): null-check the capturing component view before notifying OnPointerCaptureLost (#16337)

CapturePointer and releasePointerCapture look the capturing component up by its
cached m_pointerCapturingComponentTag and dereference the result unguarded. That
tag can outlive the component it names: when list/ScrollView virtualization
recycles the capturing row mid-pan, componentViewDescriptorWithTag returns a
descriptor whose .view is null, so winrt::get_self(...)->OnPointerCaptureLost()
dereferences null and terminates the process with 0xc0000005.

Null-check targetComponentView at both sites. Skipping the notify loses no state
transition: CapturePointer overwrites the stale tag immediately below, and
releasePointerCapture clears it via the existing m_capturedPointers.empty()
branch.

main twin of #16334 (0.83-stable).

**File**: `change/react-native-windows-capture-null-guard-main.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"type":"prerelease","dependentChangeType":"patch","email":"collindanielschneide@gmail.com","packageName":"react-native-windows","comment":"Null-check the capturing component view before notifying OnPointerCaptureLost (crash when the capturing component was unmounted)"}
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/CompositionEventHandler.cpp` (modified, +17/-4)
```diff
@@ -1520,8 +1520,16 @@ bool CompositionEventHandler::CapturePointer(
       auto targetComponentView =
           fabricuiManager->GetViewRegistry().componentViewDescriptorWithTag(m_pointerCapturingComponentTag).view;
 
-      winrt::get_self<winrt::Microsoft::ReactNative::implementation::ComponentView>(targetComponentView)
-          ->OnPointerCaptureLost();
+      // Guard against a stale capturing tag. If the previously-capturing component
+      // was unmounted (e.g. list/ScrollView virtualization recycled it during a pan)
+      // without releasing capture, componentViewDescriptorWithTag returns a
+      // descriptor whose .view is null - and the unguarded get_self(...) call then
+      // dereferences null and crashes the process (0xc0000005). Skip the notify when
+      // the view is gone; the tag is overwritten just below.
+      if (targetComponentView) {
+        winrt::get_self<winrt::Microsoft::ReactNative::implementation::ComponentView>(targetComponentView)
+            ->OnPointerCaptureLost();
+      }
     }
   }
 
@@ -1550,8 +1558,13 @@ bool CompositionEventHandler::releasePointerCapture(PointerId pointerId, faceboo
       auto targetComponentView =
           fabricuiManager->GetViewRegistry().componentViewDescriptorWithTag(m_pointerCapturingComponentTag).view;
 
-      winrt::get_self<winrt::Microsoft::ReactNative::implementation::ComponentView>(targetComponentView)
-          ->OnPointerCaptureLost();
+      // Same stale-tag null-view guard as CapturePointer above: a pointer release
+      // after the capturing component was unmounted would otherwise dereference a
+      // null view and crash (0xc0000005).
+      if (targetComponentView) {
+        winrt::get_self<winrt::Microsoft::ReactNative::implementation::ComponentView>(targetComponentView)
+            ->OnPointerCaptureLost();
+      }
     }
 
     if (m_capturedPointers.empty()) {
```

---

### Incident Patch 7: `5411eac2` (2026-08-10)
**Commit Message**: fix(pointer): label a touch/pen contact as the primary button (#16338)

onPointerPressed maps ActiveTouch.button exclusively from PointerUpdateKind, a
mouse-only concept. A touch or pen contact matches no case, falls through to
default: button = -1, and the derived W3C buttons bitmask becomes 0. The
pointerdown delivered to JS therefore claims no button is pressed, so
pointer-event-driven press handling discards finger contacts while identical
mouse clicks work.

Per W3C pointer-events a touch/pen contact IS the primary button: button 0,
buttons 1. Set that after the switch when the mouse mapping left it negative.

main counterpart of the button-labeling change in #16333 (0.83-stable), tracking
#16332. Ports only that change: main already covers the tag == -1 release leak
and the stale-pointer-reuse leak via #16048 (dispatching a synthesized touch
Cancel), and cancels capture loss per pointer. #16333's cancel-all loop,
IsPrimary purge and stale-touch backstop are deliberately not ported - they do
not exist on main and their necessity there has not been assessed.

**File**: `change/react-native-windows-touch-primary-button-main.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "Fix(fabric): dispatch touch/pen contacts with the W3C primary button (button 0, buttons 1) instead of button -1 / buttons 0, so pointer-event-driven press handling responds to finger taps the same as mouse left-clicks",
+  "packageName": "react-native-windows",
+  "email": "collindanielschneide@gmail.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/CompositionEventHandler.cpp` (modified, +10/-0)
```diff
@@ -1413,6 +1413,16 @@ void CompositionEventHandler::onPointerPressed(
         break;
     }
 
+    // A touch (or pen) contact has no mouse PointerUpdateKind, so it fell
+    // through to button = -1 — and the derived W3C buttons bitmask became 0.
+    // The dispatched pointerdown therefore told JS "no button is pressed", so
+    // press machinery driven by pointer events ignored finger taps while
+    // identical mouse clicks (button 0 / buttons 1) worked. Per W3C
+    // pointer-event semantics a touch/pen contact IS the primary button.
+    if (pointerPoint.PointerDeviceType() != Composition::Input::PointerDeviceType::Mouse && activeTouch.button < 0) {
+      activeTouch.button = 0;
+    }
+
     while (targetComponentView) {
       if (auto eventEmitter =
               winrt::get_self<winrt::Microsoft::ReactNative::implementation::ComponentView>(targetComponentView)
```

---

### Incident Patch 8: `031b6acd` (2026-08-05)
**Commit Message**: fix(textinput): correct placeholder layout constraints (px vs DIP) and no-op NaN fontSize guard (#16317)

* fix(textinput): correct placeholder layout constraints (px vs DIP) and no-op NaN fontSize guard

Forward-port of #16303 (0.83-stable) to main.

CreatePlaceholderLayout fed m_imgWidth/m_imgHeight - which are physical
pixels (frame * pointScaleFactor) - into LayoutConstraints, which are
expressed in DIPs. The placeholder was laid out in a box pointScaleFactor
times too large, so it measured and positioned at a different height than
the typed text. Divide by pointScaleFactor.

The NaN fontSize guard was also a no-op: it evaluated
defaultTextAttributes().fontSize as a discarded expression statement
instead of assigning it, so a placeholder with no fontSize never picked
up the default.

* add beachball change file

* Update release type to prerelease

Change type from 'patch' to 'prerelease' for react-native-windows.

---------

Co-authored-by: Andrew Coates <[REDACTED_EMAIL]>

**File**: `change/react-native-windows-fix-textinput-placeholder-main.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "Fix placeholder layout constraints fed physical px instead of DIPs; fix no-op NaN fontSize guard in CreatePlaceholderLayout",
+  "packageName": "react-native-windows",
+  "email": "collindanielschneide@gmail.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/TextInput/WindowsTextInputComponentView.cpp` (modified, +7/-3)
```diff
@@ -1743,16 +1743,20 @@ winrt::com_ptr<::IDWriteTextLayout> WindowsTextInputComponentView::CreatePlaceho
   const auto &props = windowsTextInputProps();
   facebook::react::TextAttributes textAttributes = props.textAttributes;
   if (std::isnan(props.textAttributes.fontSize)) {
-    facebook::react::TextAttributes::defaultTextAttributes().fontSize;
+    textAttributes.fontSize = facebook::react::TextAttributes::defaultTextAttributes().fontSize;
   }
   textAttributes.fontSizeMultiplier = m_fontSizeMultiplier;
   fragment1.string = props.placeholder;
   fragment1.textAttributes = textAttributes;
   attributedString.appendFragment(std::move(fragment1));
 
   facebook::react::LayoutConstraints constraints;
-  constraints.maximumSize.width = static_cast<FLOAT>(m_imgWidth);
-  constraints.maximumSize.height = static_cast<FLOAT>(m_imgHeight);
+  // m_imgWidth/m_imgHeight are physical pixels (frame * pointScaleFactor), but
+  // LayoutConstraints are expressed in DIPs. Feeding physical px laid the
+  // placeholder out in a box pointScaleFactor x too large, so the placeholder was
+  // measured/positioned at a different height than the typed text. Convert to DIPs.
+  constraints.maximumSize.width = static_cast<FLOAT>(m_imgWidth) / m_layoutMetrics.pointScaleFactor;
+  constraints.maximumSize.height = static_cast<FLOAT>(m_imgHeight) / m_layoutMetrics.pointScaleFactor;
 
   facebook::react::WindowsTextLayoutManager::GetTextLayout(
       facebook::react::AttributedStringBox(attributedString), {} /*TODO*/, constraints, textLayout);
```

---

### Incident Patch 9: `c470288a` (2026-08-05)
**Commit Message**: fix(scrollview): honor programmatic scrollTo when scrollEnabled={false} (#16336)

scrollEnabled={false} must only disable user scroll gestures, matching iOS and
Android where setContentOffset / scrollToOffset still work when scrolling is
disabled. The scrollTo command (and scrollToIndex / scrollToOffset, which route
through it) previously hit a scrollEnabled early-return and was silently
dropped. User-gesture input is gated separately via m_scrollVisual.ScrollEnabled
(set from scrollEnabled in updateProps), so honoring a programmatic scroll here
does not re-enable user scrolling.

main-branch twin of #16304 (0.83-stable).

**File**: `change/react-native-windows-scrollto-scrollenabled-main.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"type":"prerelease","dependentChangeType":"patch","email":"collindanielschneide@gmail.com","packageName":"react-native-windows","comment":"Honor programmatic scrollTo when scrollEnabled={false}, matching iOS/Android"}
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/ScrollViewComponentView.cpp` (modified, +8/-4)
```diff
@@ -1192,10 +1192,14 @@ void ScrollViewComponentView::HandleCommand(const winrt::Microsoft::ReactNative:
 }
 
 void ScrollViewComponentView::scrollTo(winrt::Windows::Foundation::Numerics::float3 offset, bool animate) noexcept {
-  if (!std::static_pointer_cast<const facebook::react::ScrollViewProps>(viewProps())->scrollEnabled) {
-    return;
-  }
-
+  // scrollEnabled={false} must only disable *user* scroll gestures, matching
+  // iOS and Android where setContentOffset / scrollToOffset still work when
+  // scrolling is disabled. Programmatic scrolls - the scrollTo command, and
+  // scrollToIndex / scrollToOffset which route through it - previously hit a
+  // scrollEnabled early-return here and were silently dropped. User-gesture
+  // input is gated separately (m_scrollVisual.ScrollEnabled, set from
+  // scrollEnabled in updateProps), so it is safe to always honor a
+  // programmatic scroll here.
   m_scrollVisual.TryUpdatePosition(offset, animate);
 }
 
```

---

### Incident Patch 10: `b85e8dca` (2026-07-14)
**Commit Message**: Fix a crash calling CallInvoker during shutdown (#16310)

* Fix a crash calling CallInvoker during shutdown

* Change files

* build fix

**File**: `change/react-native-windows-4672fa37-ea7f-4ffd-82cd-40e7d8b41de5.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "Fix a crash calling CallInvoker during shutdown",
+  "packageName": "react-native-windows",
+  "email": "30809111+acoates-ms@users.noreply.github.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `vnext/Microsoft.ReactNative.Cxx/TurboModuleProvider.cpp` (modified, +14/-8)
```diff
@@ -13,17 +13,23 @@ struct AbiCallInvoker final : facebook::react::CallInvoker {
   AbiCallInvoker(IReactContext const &context) : m_context(context) {}
 
   void invokeAsync(facebook::react::CallFunc &&func) noexcept override {
-    m_context.CallInvoker().InvokeAsync(
-        [context = m_context, func = std::move(func)](const winrt::Windows::Foundation::IInspectable &runtimeHandle) {
-          func(GetOrCreateContextRuntime(context, runtimeHandle));
-        });
+    auto callInvoker = m_context.CallInvoker();
+    if (callInvoker) {
+      callInvoker.InvokeAsync(
+          [context = m_context, func = std::move(func)](const winrt::Windows::Foundation::IInspectable &runtimeHandle) {
+            func(GetOrCreateContextRuntime(context, runtimeHandle));
+          });
+    }
   }
 
   void invokeSync(facebook::react::CallFunc &&func) override {
-    m_context.CallInvoker().InvokeSync(
-        [context = m_context, func = std::move(func)](const winrt::Windows::Foundation::IInspectable &runtimeHandle) {
-          func(GetOrCreateContextRuntime(context, runtimeHandle));
-        });
+    auto callInvoker = m_context.CallInvoker();
+    if (callInvoker) {
+      callInvoker.InvokeSync(
+          [context = m_context, func = std::move(func)](const winrt::Windows::Foundation::IInspectable &runtimeHandle) {
+            func(GetOrCreateContextRuntime(context, runtimeHandle));
+          });
+    }
   }
 
  private:
```

---

### Incident Patch 11: `b3683c52` (2026-07-07)
**Commit Message**: Fix: text input scaling with different screen scales (#16288)

* Fixes misalginment with TextInput on different display scales

* Change files

**File**: `change/react-native-windows-7d9b1431-48aa-416e-b5eb-712e0d1c34be.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "Fixes misalginment with TextInput on different display scales",
+  "packageName": "react-native-windows",
+  "email": "dlucas@seabird.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/TextInput/WindowsTextInputComponentView.cpp` (modified, +1/-1)
```diff
@@ -1329,7 +1329,7 @@ void WindowsTextInputComponentView::updateLayoutMetrics(
     facebook::react::LayoutMetrics const &oldLayoutMetrics) noexcept {
   // Set Position & Size Properties
 
-  if ((layoutMetrics.pointScaleFactor != m_layoutMetrics.pointScaleFactor)) {
+  if (m_textServices && layoutMetrics.pointScaleFactor > 0) {
     LRESULT res;
     winrt::check_hresult(m_textServices->TxSendMessage(
         (WM_USER + 328), // EM_SETDPI
```

---

### Incident Patch 12: `c3bae8f0` (2026-06-24)
**Commit Message**: Fix validate-overrides for react-native GitHub org rename (#16280)

* Fix validate-overrides for react-native GitHub org rename

The upstream React Native repo moved from facebook/react-native to
react/react-native. Update the hardcoded GitHub URLs in
react-native-platform-override to use the new org, fixing
validate-overrides failures caused by 301 redirects that node-fetch
cannot handle cleanly.

Co-authored-by: Copilot <[REDACTED_EMAIL]>

* Add change file for react-native-platform-override

Co-authored-by: Copilot <[REDACTED_EMAIL]>

* Use workspace resolution for react-native-platform-override

The root package.json pinned react-native-platform-override to a
published npm version (0.0.0-canary.1017), which meant yarn
validate-overrides ran the old npm code rather than the local workspace
source. Since the npm version still has the old facebook/react-native
GitHub URL, CI agents that cannot follow the 301 redirect fail.

Change the dependency to workspace:* so Yarn resolves to the local
workspace package (which contains our URL fix), matching the pattern
used by other workspace tools (@rnw-scripts/*).

Co-authored-by: Copilot <[REDACTED_EMAIL]>

---------

Co-authored-by: Anukr

**File**: `change/react-native-platform-override-8955b0be-3b2f-4956-a970-8d6e98eca3b5.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "comment": "Update GitHub org from facebook/react-native to react/react-native",
+  "email": "anuagra@microsoft.com",
+  "dependentChangeType": "patch",
+  "type": "prerelease",
+  "packageName": "react-native-platform-override"
+}
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@
     "prettier-plugin-hermes-parser": "0.21.1",
     "react": "19.2.3",
     "react-native": "0.85.0-nightly-20260128-36f07a1b2",
-    "react-native-platform-override": "0.0.0-canary.1017",
+    "react-native-platform-override": "workspace:*",
     "typescript": "5.0.4"
   },
   "resolutions": {
```

**File**: `packages/react-native-platform-override/src/GitReactFileRepository.ts` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ import {VersionedReactFileRepository} from './FileRepository';
 import {getNpmPackage} from './PackageUtils';
 import {fetchFullRef} from './refFromVersion';
 
-const RN_GITHUB_URL = 'https://github.com/facebook/react-native.git';
+const RN_GITHUB_URL = 'https://github.com/react/react-native.git';
 
 /**
  * Retrieves React Native files using the React Native Github repo. Switching
```

**File**: `packages/react-native-platform-override/src/refFromVersion.ts` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ async function fetchFullCommitHash(
   // We cannot get abbreviated hash directly from a remote, so query Github's
   // API for it.
   const commitInfo = await fetch(
-    `https://api.github.com/repos/facebook/react-native/commits/${abbrevHash}`,
+    `https://api.github.com/repos/react/react-native/commits/${abbrevHash}`,
     {
       headers: {
         'Content-Type': 'application/json',
```

**File**: `yarn.lock` (modified, +4/-35)
```diff
@@ -4175,7 +4175,7 @@ __metadata:
   languageName: unknown
   linkType: soft
 
-"@react-native-windows/fs@npm:0.0.0-canary.72, @react-native-windows/fs@npm:^0.0.0-canary.70, @react-native-windows/fs@npm:^0.0.0-canary.72, @react-native-windows/fs@workspace:packages/@react-native-windows/fs":
+"@react-native-windows/fs@npm:0.0.0-canary.72, @react-native-windows/fs@npm:^0.0.0-canary.72, @react-native-windows/fs@workspace:packages/@react-native-windows/fs":
   version: 0.0.0-use.local
   resolution: "@react-native-windows/fs@workspace:packages/@react-native-windows/fs"
   dependencies:
@@ -4194,7 +4194,7 @@ __metadata:
   languageName: unknown
   linkType: soft
 
-"@react-native-windows/package-utils@npm:0.0.0-canary.98, @react-native-windows/package-utils@npm:^0.0.0-canary.96, @react-native-windows/package-utils@npm:^0.0.0-canary.98, @react-native-windows/package-utils@workspace:packages/@react-native-windows/package-utils":
+"@react-native-windows/package-utils@npm:0.0.0-canary.98, @react-native-windows/package-utils@npm:^0.0.0-canary.98, @react-native-windows/package-utils@workspace:packages/@react-native-windows/package-utils":
   version: 0.0.0-use.local
   resolution: "@react-native-windows/package-utils@workspace:packages/@react-native-windows/package-utils"
   dependencies:
@@ -16324,38 +16324,7 @@ __metadata:
   languageName: node
   linkType: hard
 
-"react-native-platform-override@npm:0.0.0-canary.1017":
-  version: 0.0.0-canary.1017
-  resolution: "react-native-platform-override@npm:0.0.0-canary.1017"
-  dependencies:
-    "@react-native-windows/fs": "npm:^0.0.0-canary.70"
-    "@react-native-windows/package-utils": "npm:^0.0.0-canary.96"
-    "@typescript-eslint/eslint-plugin": "npm:^7.1.1"
-    "@typescript-eslint/parser": "npm:^7.1.1"
-    async: "npm:^3.2.3"
-    chalk: "npm:^4.1.0"
-    fp-ts: "npm:^2.5.0"
-    globby: "npm:^11.1.0"
-    inquirer: "npm:^7.1.0"
-    io-ts: "npm:^2.1.1"
-    isutf8: "npm:^3.0.0"
-    lodash: "npm:^4.17.15"
-    node-fetch: "npm:^2.6.7"
-    ora: "npm:^3.4.0"
-    semver: "npm:^7.3.2"
-    simple-git: "npm:^3.3.0"
-    source-map-support: "npm:^0.5.19"
-    upath: "npm:^1.2.0"
-    yargs: "npm:^16.2.0"
-  peerDependencies:
-    react-native: "*"
-  bin:
-    react-native-platform-override: bin.js
-  checksum: 10c0/406b6e4ec9e1902d1fd1acb55f721bad779c30bbcddef9d64ca3cdb1efd833f28f763221c6beaa714ea53ae0a1dab3e393dc1ca2b62e3b3acdcefaf3f6844450
-  languageName: node
-  linkType: hard
-
-"react-native-platform-override@npm:0.0.0-canary.1022, react-native-platform-override@workspace:packages/react-native-platform-override":
+"react-native-platform-override@npm:0.0.0-canary.1022, react-native-platform-override@workspace:*, react-native-platform-override@workspace:packages/react-native-platform-override":
   version: 0.0.0-use.local
   resolution: "react-native-platform-override@workspace:packages/react-native-platform-override"
   dependencies:
@@ -16476,7 +16445,7 @@ __metadata:
     prettier-plugin-hermes-parser: "npm:0.21.1"
     react: "npm:19.2.3"
     react-native: "npm:0.85.0-nightly-20260128-36f07a1b2"
-    react-native-platform-override: "npm:0.0.0-canary.1017"
+    react-native-platform-override: "workspace:*"
     typescript: "npm:5.0.4"
   languageName: unknown
   linkType: soft
```

---

### Incident Patch 13: `9fd45a5c` (2026-06-22)
**Commit Message**: Fix crash attempting to get runtime when shutting down instance (#16238)

* Fix crash attempting to get runtime when shutting down instance

* Change files

**File**: `change/react-native-windows-7a98fbf7-0186-4130-b6ab-409caa188bee.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "Fix crash attempting to get runtime when shutting down instance",
+  "packageName": "react-native-windows",
+  "email": "30809111+acoates-ms@users.noreply.github.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `vnext/Microsoft.ReactNative.Cxx/NativeModules.h` (modified, +2/-1)
```diff
@@ -527,7 +527,8 @@ struct ModuleJsiInitMethodInfo<void (TModule::*)(ReactContext const &, facebook:
     return
         [module = static_cast<ModuleType *>(module), method](
             ReactContext const &reactContext, winrt::Windows::Foundation::IInspectable const &runtimeHandle) noexcept {
-          (module->*method)(reactContext, GetOrCreateContextRuntime(reactContext, runtimeHandle));
+          if (runtimeHandle)
+            (module->*method)(reactContext, GetOrCreateContextRuntime(reactContext, runtimeHandle));
         };
   }
 };
```

---

### Incident Patch 14: `b50c94d4` (2026-06-10)
**Commit Message**: fix: Unicode Text length Calculation (#16219)

* fix: Unicode Text length Calculation

* Change files

* yarn format fix

**File**: `change/react-native-windows-c3de21ab-adb1-4f1d-a290-4f0c29f087ef.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "fix: Unicode Text length Calculation",
+  "packageName": "react-native-windows",
+  "email": "66076509+vineethkuttan@users.noreply.github.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `vnext/Common/unicode.cpp` (modified, +36/-0)
```diff
@@ -93,6 +93,42 @@ std::wstring Utf8ToUtf16(const std::string &utf8) {
   return Utf8ToUtf16(utf8.c_str(), utf8.length());
 }
 
+size_t Utf8ToUtf16Length(const char *utf8, size_t utf8Len) {
+  if (utf8Len == 0) {
+    return 0;
+  }
+
+  if (utf8Len > static_cast<size_t>((std::numeric_limits<int>::max)())) {
+    throw std::overflow_error("Length of input string to Utf8ToUtf16Length() must fit into an int.");
+  }
+
+  const int utf8Length = static_cast<int>(utf8Len);
+
+  constexpr DWORD flags = 0;
+
+  const int utf16Length = ::MultiByteToWideChar(
+      CP_UTF8, // Source string is in UTF-8.
+      flags, // Conversion flags.
+      utf8, // Source UTF-8 string pointer.
+      utf8Length, // Length of the source UTF-8 string, in chars.
+      nullptr, // Do not convert, just request the size.
+      0 // Request size of destination buffer, in wchar_ts.
+  );
+
+  if (utf16Length == 0) {
+    throw UnicodeConversionException(
+        "Cannot get result string length when converting from UTF-8 to UTF-16 "
+        "(MultiByteToWideChar failed).",
+        GetLastError());
+  }
+
+  return static_cast<size_t>(utf16Length);
+}
+
+size_t Utf8ToUtf16Length(const std::string &utf8) {
+  return Utf8ToUtf16Length(utf8.c_str(), utf8.length());
+}
+
 #if _HAS_CXX17
 std::wstring Utf8ToUtf16(const std::string_view &utf8) {
   return Utf8ToUtf16(utf8.data(), utf8.length());
```

**File**: `vnext/Common/unicode.h` (modified, +8/-0)
```diff
@@ -55,6 +55,14 @@ class UnicodeConversionException : public std::runtime_error {
 /* (4) */ std::wstring Utf8ToUtf16(const std::string_view &utf8);
 #endif
 
+// The following functions return the length of the UTF-16 string that would
+// result from converting the input UTF-8 string, without actually performing
+// the conversion or allocating a temporary std::wstring. This is useful in
+// hot paths where only the length is needed (e.g. DirectWrite text ranges).
+//
+size_t Utf8ToUtf16Length(const char *utf8, size_t utf8Len);
+size_t Utf8ToUtf16Length(const std::string &utf8);
+
 // The following functions convert UTF-16BE strings to UTF-8 strings. Their
 // behaviors mirror those of the above Utf8ToUtf16 functions.
 //
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/ParagraphComponentView.cpp` (modified, +6/-4)
```diff
@@ -153,11 +153,12 @@ facebook::react::SharedViewEventEmitter ParagraphComponentView::eventEmitterAtPo
       uint32_t textPosition = metrics.textPosition;
 
       for (auto fragment : m_attributedStringBox.getValue().getFragments()) {
-        if (textPosition < fragment.string.length()) {
+        uint32_t utf16Length = static_cast<uint32_t>(::Microsoft::Common::Unicode::Utf8ToUtf16Length(fragment.string));
+        if (textPosition < utf16Length) {
           return std::static_pointer_cast<const facebook::react::ViewEventEmitter>(
               fragment.parentShadowView.eventEmitter);
         }
-        textPosition -= static_cast<uint32_t>(fragment.string.length());
+        textPosition -= utf16Length;
       }
     }
   }
@@ -210,10 +211,11 @@ bool ParagraphComponentView::IsTextSelectableAtPoint(facebook::react::Point pt)
 
       // Finds which fragment contains this text position
       for (auto fragment : m_attributedStringBox.getValue().getFragments()) {
-        if (textPosition < fragment.string.length()) {
+        uint32_t utf16Length = static_cast<uint32_t>(::Microsoft::Common::Unicode::Utf8ToUtf16Length(fragment.string));
+        if (textPosition < utf16Length) {
           return true;
         }
-        textPosition -= static_cast<uint32_t>(fragment.string.length());
+        textPosition -= utf16Length;
       }
     }
   }
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/TextDrawing.cpp` (modified, +1/-1)
```diff
@@ -66,7 +66,7 @@ void RenderText(
   unsigned int position = 0;
   unsigned int length = 0;
   for (auto fragment : attributedString.getFragments()) {
-    length = static_cast<UINT32>(fragment.string.length());
+    length = static_cast<UINT32>(::Microsoft::Common::Unicode::Utf8ToUtf16Length(fragment.string));
     DWRITE_TEXT_RANGE range = {position, length};
     if (fragment.textAttributes.foregroundColor &&
             (fragment.textAttributes.foregroundColor != textAttributes.foregroundColor) ||
```

**File**: `vnext/Microsoft.ReactNative/Fabric/platform/react/renderer/textlayoutmanager/WindowsTextLayoutManager.cpp` (modified, +1/-1)
```diff
@@ -262,7 +262,7 @@ void WindowsTextLayoutManager::GetTextLayout(
       attachments.push_back(attachment);
       position += 1;
     } else {
-      unsigned int length = static_cast<UINT32>(fragment.string.length());
+      unsigned int length = static_cast<UINT32>(Microsoft::Common::Unicode::Utf8ToUtf16Length(fragment.string));
       DWRITE_TEXT_RANGE range = {position, length};
       TextAttributes attributes = fragment.textAttributes;
       DWRITE_FONT_STYLE fragmentStyle = DWRITE_FONT_STYLE_NORMAL;
```

---

### Incident Patch 15: `5be8c05b` (2026-06-07)
**Commit Message**: fix: WebSocket binaryType handling — stop unconditional Blob interception of binary messages (#16173)

* blob support (#8)

* blob support

* pr comments

* pr comments

* Update DefaultBlobResource.cpp

* Create react-native-windows-c3827e14-777b-475a-bf00-dc169bf89f3d.json

* Add WebSocketArrayBuffer headless test (#9)

* Add WebSocketArrayBuffer headless test

* Skip test by default

* pr comments

* Update overrides (#10)

---------

Co-authored-by: Julio César Rocha <[REDACTED_EMAIL]>

**File**: `change/react-native-windows-c3827e14-777b-475a-bf00-dc169bf89f3d.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "Fix WebSocket binaryType handling — stop unconditional Blob interception of binary messages",
+  "packageName": "react-native-windows",
+  "email": "gordomacmaster@gmail.com",
+  "dependentChangeType": "patch"
+}
\ No newline at end of file
```

**File**: `vnext/Desktop.IntegrationTests/RNTesterHeadlessTests.cpp` (modified, +30/-0)
```diff
@@ -63,6 +63,36 @@ TEST_CLASS (RNTesterHeadlessTests) {
     auto status = TestModule::AwaitCompletion();
     Assert::IsTrue(status == TestStatus::Passed, L"Test did not pass (JS did not call markTestPassed within timeout)");
   }
+
+  BEGIN_TEST_METHOD_ATTRIBUTE(WebSocketArrayBuffer)
+  TEST_IGNORE()
+  END_TEST_METHOD_ATTRIBUTE()
+  TEST_METHOD(WebSocketArrayBuffer) {
+    TestModule::Reset();
+
+    winrt::handle instanceLoadedEvent{CreateEvent(nullptr, TRUE, FALSE, nullptr)};
+    bool instanceFailed{false};
+
+    auto holder = TestReactNativeHostHolder(
+        L"IntegrationTests/WebSocketArrayBufferTest",
+        [&instanceLoadedEvent, &instanceFailed](msrn::ReactNativeHost const &host) noexcept {
+          host.InstanceSettings().InstanceLoaded(
+              [&instanceLoadedEvent, &instanceFailed](auto const &, msrn::InstanceLoadedEventArgs args) noexcept {
+                instanceFailed = args.Failed();
+                SetEvent(instanceLoadedEvent.get());
+              });
+        });
+
+    WaitForSingleObject(instanceLoadedEvent.get(), INFINITE);
+    if (instanceFailed) {
+      auto err = holder.GetLastError();
+      auto msg = L"InstanceLoaded reported failure: " + (err.empty() ? L"(no error captured)" : err);
+      Assert::Fail(msg.c_str());
+    }
+
+    auto status = TestModule::AwaitCompletion();
+    Assert::IsTrue(status == TestStatus::Passed, L"Test did not pass (JS did not call markTestPassed within timeout)");
+  }
 };
 
 } // namespace Microsoft::React::Test
```

**File**: `vnext/Shared/Modules/IWebSocketModuleContentHandler.h` (modified, +15/-0)
```diff
@@ -18,11 +18,26 @@ namespace Microsoft::React {
 struct IWebSocketModuleContentHandler {
   virtual ~IWebSocketModuleContentHandler() noexcept {}
 
+  /// Returns true if this handler should process messages for the given socket.
+  virtual bool CanHandleSocket(int64_t socketId) noexcept = 0;
+
   virtual void ProcessMessage(std::string &&message, winrt::Microsoft::ReactNative::JSValueObject &params) noexcept = 0;
 
   virtual void ProcessMessage(
       std::vector<uint8_t> &&message,
       winrt::Microsoft::ReactNative::JSValueObject &params) noexcept = 0;
+
+  /// Check CanHandleSocket() then ProcessMessage() in one call.
+  /// Returns true if the message was handled.
+  virtual bool TryProcessMessage(
+      int64_t socketId,
+      std::string &&message,
+      winrt::Microsoft::ReactNative::JSValueObject &params) noexcept = 0;
+
+  virtual bool TryProcessMessage(
+      int64_t socketId,
+      std::vector<uint8_t> &&message,
+      winrt::Microsoft::ReactNative::JSValueObject &params) noexcept = 0;
 };
 
 } // namespace Microsoft::React
```

**File**: `vnext/Shared/Modules/WebSocketModule.cpp` (modified, +8/-3)
```diff
@@ -83,18 +83,23 @@ shared_ptr<IWebSocketResource> WebSocketTurboModule::CreateResource(int64_t id,
     if (auto prop = propBag.Get(BlobModuleContentHandlerPropertyId()))
       contentHandler = prop.Value().lock();
 
+    bool handled = false;
     if (contentHandler) {
       if (isBinary) {
         auto buffer = CryptographicBuffer::DecodeFromBase64String(winrt::to_hstring(message));
         winrt::com_array<uint8_t> arr;
         CryptographicBuffer::CopyToByteArray(buffer, arr);
         auto data = vector<uint8_t>(arr.begin(), arr.end());
 
-        contentHandler->ProcessMessage(std::move(data), args);
+        handled = contentHandler->TryProcessMessage(id, std::move(data), args);
       } else {
-        contentHandler->ProcessMessage(string{message}, args);
+        handled = contentHandler->TryProcessMessage(id, string{message}, args);
       }
-    } else {
+    }
+    // When the content handler processes the message, it takes ownership of the
+    // payload and populates args itself (e.g. as a blob reference), so we only
+    // fall back to setting args["data"] when no handler claimed the message.
+    if (!handled) {
       args["data"] = message;
     }
 
```

**File**: `vnext/Shared/Networking/DefaultBlobResource.cpp` (modified, +37/-0)
```diff
@@ -221,6 +221,11 @@ BlobWebSocketModuleContentHandler::BlobWebSocketModuleContentHandler(shared_ptr<
 
 #pragma region IWebSocketModuleContentHandler
 
+bool BlobWebSocketModuleContentHandler::CanHandleSocket(int64_t socketId) noexcept /*override*/ {
+  scoped_lock lock{m_mutex};
+  return m_socketIds.find(socketId) != m_socketIds.end();
+}
+
 void BlobWebSocketModuleContentHandler::ProcessMessage(
     string &&message,
     msrn::JSValueObject &params) noexcept /*override*/
@@ -241,6 +246,38 @@ void BlobWebSocketModuleContentHandler::ProcessMessage(
   params[blobKeys.Type] = blobKeys.Blob;
 }
 
+bool BlobWebSocketModuleContentHandler::TryProcessMessage(
+    int64_t socketId,
+    string &&message,
+    msrn::JSValueObject &params) noexcept /*override*/
+{
+  scoped_lock lock{m_mutex};
+  if (m_socketIds.find(socketId) == m_socketIds.end())
+    return false;
+
+  params[blobKeys.Data] = std::move(message);
+  return true;
+}
+
+bool BlobWebSocketModuleContentHandler::TryProcessMessage(
+    int64_t socketId,
+    vector<uint8_t> &&message,
+    msrn::JSValueObject &params) noexcept /*override*/
+{
+  scoped_lock lock{m_mutex};
+  if (m_socketIds.find(socketId) == m_socketIds.end())
+    return false;
+
+  auto blob = msrn::JSValueObject{
+      {blobKeys.Offset, 0},
+      {blobKeys.Size, message.size()},
+      {blobKeys.BlobId, m_blobPersistor->StoreMessage(std::move(message))}};
+
+  params[blobKeys.Data] = std::move(blob);
+  params[blobKeys.Type] = blobKeys.Blob;
+  return true;
+}
+
 #pragma endregion IWebSocketModuleContentHandler
 
 void BlobWebSocketModuleContentHandler::Register(int64_t socketID) noexcept {
```

**File**: `vnext/Shared/Networking/DefaultBlobResource.h` (modified, +12/-0)
```diff
@@ -51,11 +51,23 @@ class BlobWebSocketModuleContentHandler final : public IWebSocketModuleContentHa
 
 #pragma region IWebSocketModuleContentHandler
 
+  bool CanHandleSocket(int64_t socketId) noexcept override;
+
   void ProcessMessage(std::string &&message, winrt::Microsoft::ReactNative::JSValueObject &params) noexcept override;
 
   void ProcessMessage(std::vector<uint8_t> &&message, winrt::Microsoft::ReactNative::JSValueObject &params) noexcept
       override;
 
+  bool TryProcessMessage(
+      int64_t socketId,
+      std::string &&message,
+      winrt::Microsoft::ReactNative::JSValueObject &params) noexcept override;
+
+  bool TryProcessMessage(
+      int64_t socketId,
+      std::vector<uint8_t> &&message,
+      winrt::Microsoft::ReactNative::JSValueObject &params) noexcept override;
+
 #pragma endregion IWebSocketModuleContentHandler
 
   void Register(int64_t socketID) noexcept;
```

**File**: `vnext/overrides.json` (modified, +4/-0)
```diff
@@ -256,6 +256,10 @@
       "type": "platform",
       "file": "src-win/IntegrationTests/websocket_integration_test_server_blob.js"
     },
+    {
+      "type": "platform",
+      "file": "src-win/IntegrationTests/WebSocketArrayBufferTest.js"
+    },
     {
       "type": "platform",
       "file": "src-win/IntegrationTests/WebSocketBinaryTest.js"
```

**File**: `vnext/src-win/IntegrationTests/WebSocketArrayBufferTest.js` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+/**
+ * Copyright (c) Microsoft Corporation.
+ * Licensed under the MIT License.
+ * @format
+ */
+
+'use strict';
+
+const {TurboModuleRegistry} = require('react-native');
+const TestModule = TurboModuleRegistry.get('TestModule');
+
+if (!TestModule) {
+  throw new Error('TestModule is not available');
+}
+
+// eslint-disable-next-line @microsoft/sdl/no-insecure-url
+const WS_URL = 'ws://localhost:5555/rnw/rntester/websocketbinarytest';
+
+const socket = new WebSocket(WS_URL);
+socket.binaryType = 'arraybuffer';
+
+socket.addEventListener('open', () => {
+  socket.send('hello');
+});
+
+socket.addEventListener('message', event => {
+  const data = event.data;
+
+  if (!(data instanceof ArrayBuffer)) {
+    console.log(
+      'WebSocketArrayBufferTest FAIL: expected ArrayBuffer, got ' + typeof data,
+    );
+    TestModule.markTestPassed(false);
+    socket.close();
+    return;
+  }
+
+  const bytes = new Uint8Array(data);
+  const expected = new Uint8Array([4, 5, 6, 7]);
+
+  if (bytes.length !== expected.length) {
+    console.log(
+      'WebSocketArrayBufferTest FAIL: expected ' +
+        expected.length +
+        ' bytes, got ' +
+        bytes.length,
+    );
+    TestModule.markTestPassed(false);
+    socket.close();
+    return;
+  }
+
+  for (let i = 0; i < expected.length; i++) {
+    if (bytes[i] !== expected[i]) {
+      console.log(
+        'WebSocketArrayBufferTest FAIL: byte[' +
+          i +
+          '] expected ' +
+          expected[i] +
+          ' got ' +
+          bytes[i],
+      );
+      TestModule.markTestPassed(false);
+      socket.close();
+      return;
+    }
+  }
+
+  TestModule.markTestPassed(true);
+  socket.close();
+});
+
+socket.addEventListener('error', () => {
+  console.log('WebSocketArrayBufferTest FAIL: WebSocket error');
+  TestModule.markTestPassed(false);
+});
```

#### Recent Merged Pull Requests:
- **PR #16461** (closed): 📦 Bump the all-dependencies group across 1 directory with 8 updates (@dependabot[bot])
- **PR #16459** (closed): 📦 Bump the all-dependencies group across 1 directory with 9 updates (@dependabot[bot])
- **PR #16458** (2026-09-26): Warm the CLI-init app closure in warm-feed (@vmoroz)
- **PR #16457** (closed): 📦 [0.81]: Bump the all-dependencies group across 1 directory with 25 updates (@dependabot[bot])
- **PR #16455** (closed): 📦 [0.84]: Bump the all-dependencies group across 1 directory with 16 updates (@dependabot[bot])
- **PR #16454** (2026-09-25): RELEASE: Releasing 12 package(s) (0.85-stable) (@azure-pipelines[bot])
- **PR #16453** (2026-09-24): Integrate React Native 0.87.0-nightly-20260704-e04ff69ab (July 4th) (@anuagragith)
- **PR #16450** (closed): 📦 Bump the all-dependencies group across 1 directory with 8 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
